/* Use my own sheet: upload a fillable PDF, match its boxes (custom.js), and let the export fill it instead of the official sheet.
   Load after desksheet.js and custom.js. It needs no change to export.js: it takes over fillSheet(), which mk() calls.
   The card shows up on Character sheet > Export / PDF through window.customCard (desksheet.js calls it). */
(() => {
  const S = { sheet: null, use: true, busy: false, msg: '', items: [] };
  window.hsCustom = S;
  window.hsCustomKey = () => (S.sheet && S.use ? S.sheet.name + '|' + S.sheet.at + '|' + !!S.sheet.swap : '');

  /* ---- keep the uploaded sheet in this browser (IndexedDB: PDFs are too big for localStorage) ---- */
  const idb = () =>
    new Promise((ok, no) => {
      try {
        const q = indexedDB.open('hs-custom', 1);
        q.onupgradeneeded = () => q.result.createObjectStore('kv');
        q.onsuccess = () => ok(q.result);
        q.onerror = () => no(q.error);
      } catch (e) {
        no(e);
      }
    });
  const kv = async (mode, fn) => {
    const db = await idb();
    return new Promise((ok, no) => {
      const r = fn(db.transaction('kv', mode).objectStore('kv'));
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
    });
  };
  const save = () => kv('readwrite', (s) => s.put({ ...S.sheet, use: S.use }, 'sheet')).catch(() => {});
  const wipe = () => kv('readwrite', (s) => s.delete('sheet')).catch(() => {});
  kv('readonly', (s) => s.get('sheet'))
    .then((r) => {
      if (!r) return;
      S.sheet = r;
      S.use = r.use !== false;
      const a = document.activeElement;
      if (typeof draw === 'function' && !(a && /^(TEXTAREA|INPUT|SELECT)$/.test(a.tagName))) draw();
    })
    .catch(() => {});

  /* ---- character data -> the engine's keys ---- */
  function values() {
    const m = model(), r = resolve(ch), c = calc(ch, r), x = m.extra || {}, h = hpInfo(c), co = ch.coins || {};
    const V = {
      name: m.name, classlevel: m.classLevel, race: m.race, background: m.bg,
      player: x.PlayerName, alignment: x.Alignment, exp: x.XP, gender: ch.d.gender,
      age: x.Age, skin: x.Skin, eyes: x.Eyes, hair: x.Hair, height: x.Height, weight: x.Weight,
      eyeshair: [x.Eyes, x.Hair].filter(Boolean).join(' / '),
      heightweight: [x.Height, x.Weight].filter(Boolean).join(' / '),
      hpnow: String(h.now), hpmax: String(h.max), hptemp: h.temp ? String(h.temp) : '', hitdie: m.hdt,
      pb: sg(m.pb), pp: String(m.pp), ac: String(m.ac), init: sg(m.init), speed: String(m.speed),
      traits: x['PersonalityTraits '], ideals: x.Ideals, bonds: x.Bonds, flaws: x.Flaws,
      features: m.features, addfeat: x['Feat+Traits'], profs: m.prof, equipment: m.equipment,
      attacks: x.AttacksSpellcasting, backstory: x.Backstory, allies: x.Allies, treasure: x.Treasure,
    };
    ['cp', 'sp', 'ep', 'gp', 'pp'].forEach((k) => (V['coin:' + k] = co[k] ? String(co[k]) : ''));
    AB.forEach((a) => {
      V['ab:' + a + ':mod'] = sg(m.mods[a]);
      V['ab:' + a + ':score'] = String(m.scores[a]);
      V['save:' + a] = { bonus: sg(m.saves[a].v), prof: !!m.saves[a].p };
    });
    Object.keys(m.skills).forEach((n) => (V['skill:' + n] = { bonus: sg(m.skills[n].v), prof: !!(m.skills[n].p || m.skills[n].x) }));
    [1, 2, 3].forEach((i) => {
      V['atk:' + i + ':name'] = x['Wpn Name' + (i > 1 ? ' ' + i : '')];
      V['atk:' + i + ':bonus'] = x['Wpn' + i + ' AtkBonus' + (i === 2 ? ' ' : i === 3 ? '  ' : '')];
      V['atk:' + i + ':dmg'] = x['Wpn' + i + ' Damage' + (i > 1 ? ' ' : '')];
    });
    if (m.caster) {
      V.spclass = m.caster.cls; V.spab = m.caster.ab; V.spdc = String(m.caster.dc); V.spatk = sg(m.caster.atk);
    }
    const by = {};
    preparedSpells().forEach((s) => (by[s.lvl || 0] = by[s.lvl || 0] || []).push(s.name));
    V.cantrips = (by[0] || []).sort();
    const sl = slotsFor(r).sl || [];
    for (let n = 1; n <= 9; n++) {
      if (by[n]) V['spells:' + n] = by[n].sort().map((name) => ({ name, prepared: true }));
      if (sl[n - 1]) V['slots:' + n] = String(sl[n - 1]);
    }
    return V;
  }

  /* ---- export.js calls fillSheet(); when a custom sheet is on, fill that one instead ---- */
  const official = window.fillSheet;
  window.fillSheet = async (L, bytes, d) => {
    if (!(S.sheet && S.use && window.HSCustom)) return official(L, bytes, d);
    try {
      S.sheet.plan.opts = S.sheet.plan.opts || {};
      S.sheet.plan.opts.swapAbility = !!S.sheet.swap;
      const out = await HSCustom.fill(S.sheet.bytes, S.sheet.plan, values());
      S.items = out.items;
      setTimeout(refresh, 0);
      return out.bytes;
    } catch (e) {
      S.items = [];
      note('Your sheet could not be filled (' + ((e && e.message) || e) + '). The official sheet was used.');
      return official(L, bytes, d);
    }
  };

  /* ---- the card ---- */
  const html = () => {
    const c = S.sheet, bad = S.items.filter((i) => i.status === 'clipped');
    let h = '<div class="ds-feat" id="hscard"><div class="ds-lab">Your own sheet</div>';
    if (!c)
      h += '<p class="ds-hint">Upload a fillable PDF. Hearthscribe matches its boxes to your character and fills it. Your spell and item cards are still added.</p>';
    else
      h +=
        `<label class="ds-chk"><input type="checkbox" data-hsc="use"${S.use ? ' checked' : ''}>Use “${esc(c.name)}”</label>` +
        `<label class="ds-chk"><input type="checkbox" data-hsc="swap"${c.swap ? ' checked' : ''}>Swap ability score and modifier</label>` +
        `<p class="ds-hint">Matched ${c.stats.mapped} things in ${c.stats.fields} boxes${c.unmapped ? '; ' + c.unmapped + ' text boxes left empty' : ''}.` +
        (bad.length ? `<br>Too long for the box: ${esc(bad.slice(0, 5).map((i) => i.key.replace(/#.*/, '')).join(', '))}. The download still has the full text only where it fits.` : '') +
        (c.notes && c.notes.length ? '<br>' + c.notes.map(esc).join('<br>') : '') + '</p>';
    h +=
      `<label class="btn alt ds-wide" style="text-align:center;cursor:pointer">${c ? 'Replace my sheet' : 'Use my own sheet'}<input id="hscfile" type="file" accept="application/pdf,.pdf" hidden></label>` +
      (c ? '<button class="ds-exp-b" data-a="hscclear">Remove my sheet</button>' : '') +
      (S.msg ? `<p class="ds-hint">${esc(S.msg)}</p>` : '') +
      '</div>';
    return h;
  };
  window.customCard = html;
  function refresh() {
    const el = document.getElementById('hscard');
    if (el) el.outerHTML = html();
  }

  /* ---- upload ---- */
  async function load(f) {
    S.busy = true;
    S.msg = 'Reading ' + f.name + '…';
    refresh();
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (!window.pdfjsLib || !window.HSCustom) throw new Error('the PDF tools did not load');
      pdfjsLib.GlobalWorkerOptions.workerSrc = window.HS_PDFJS_WORKER || 'vendor/pdf.worker.min.js';
      const r = await HSCustom.prepare(bytes, await HSCustom.wordsFromPdfJs(pdfjsLib, bytes));
      if (!r.ok)
        S.msg = r.why === 'flat' ? 'That PDF has no fillable boxes, so it cannot be filled. Look for a "fillable" or "editable" version of the sheet.'
          : r.why === 'locked' ? 'That PDF is password protected.' : 'That PDF could not be read.';
      else {
        S.sheet = { name: f.name.replace(/\.pdf$/i, ''), bytes: r.bytes, plan: r.plan, stats: r.stats, notes: r.notes, unmapped: r.unmapped.length, swap: false, at: Date.now() };
        S.use = true;
        S.items = [];
        S.msg = '';
        await save();
      }
    } catch (e) {
      S.msg = 'Could not use that PDF: ' + ((e && e.message) || e);
    }
    S.busy = false;
    draw();
  }
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'hscfile') {
      const f = t.files && t.files[0];
      t.value = '';
      if (f) load(f);
    } else if (t.dataset && t.dataset.hsc && S.sheet) {
      if (t.dataset.hsc === 'use') S.use = t.checked;
      else S.sheet.swap = t.checked;
      S.items = [];
      save();
      draw();
    }
  });
  on('hscclear', () => {
    S.sheet = null;
    S.items = [];
    S.msg = '';
    wipe();
  });
})();
