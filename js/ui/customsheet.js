/* Use my own sheet: upload fillable PDFs, keep them in a saved list, pick which one the export fills.
   Load after desksheet.js and custom.js. It needs no change to export.js: it takes over fillSheet(), which mk() calls.
   The card shows up on Character sheet > Export / PDF through window.customCard (desksheet.js calls it).
   Saved in this browser (IndexedDB): 'lib' = list of sheets (no bytes), 'sheet:<id>' = one sheet with its PDF, 'active' = id in use. */
(() => {
  const S = { lib: [], sheet: null, busy: false, msg: '', items: [] }; // sheet = the active one, with its bytes
  window.hsCustom = S;
  window.hsCustomKey = () => (S.sheet ? S.sheet.id + '|' + S.sheet.at + '|' + !!S.sheet.swap : '');

  /* ---- storage (IndexedDB: PDFs are too big for localStorage) ---- */
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
  const get = (k) => kv('readonly', (s) => s.get(k));
  const put = (k, v) => kv('readwrite', (s) => s.put(v, k)).catch(() => {});
  const del = (k) => kv('readwrite', (s) => s.delete(k)).catch(() => {});
  const meta = (r) => ({ id: r.id, name: r.name, at: r.at, stats: r.stats, unmapped: r.unmapped, notes: r.notes });
  const saveSheet = () => put('sheet:' + S.sheet.id, S.sheet);
  const saveLib = () => put('lib', S.lib);

  async function openId(id) {
    const r = id ? await get('sheet:' + id).catch(() => null) : null;
    S.sheet = r || null;
    S.items = [];
    await put('active', r ? r.id : null);
  }
  const redraw = () => {
    const a = document.activeElement;
    if (typeof draw === 'function' && !(a && /^(TEXTAREA|INPUT|SELECT)$/.test(a.tagName) && a.type !== 'radio' && a.type !== 'checkbox')) draw();
  };

  /* start-up: read the list and the sheet that was in use. (Version 2.0.3 kept a single sheet under 'sheet': move it into the list.) */
  (async () => {
    try {
      let lib = (await get('lib')) || [];
      const old = await get('sheet');
      if (old && old.bytes) {
        const r = { ...old, id: 's' + (old.at || Date.now()) };
        delete r.use;
        await put('sheet:' + r.id, r);
        lib = lib.concat(meta(r));
        await put('lib', lib);
        await put('active', old.use === false ? null : r.id);
        await del('sheet');
      }
      S.lib = lib;
      const act = await get('active');
      if (act) await openId(act);
      redraw();
    } catch (e) {
      /* no storage: the feature still works for this visit, it just is not remembered */
    }
  })();

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

  /* ---- export.js calls fillSheet(); when a saved sheet is picked, fill that one instead of the official sheet ---- */
  const official = window.fillSheet;
  window.fillSheet = async (L, bytes, d) => {
    if (!(S.sheet && window.HSCustom)) return official(L, bytes, d);
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
    const radio = (id, name, sub) =>
      `<div class="ds-row"><label class="ds-chk"><input type="radio" name="hscsel" data-hsc="pick" value="${esc(id)}"${(c ? c.id : '') === id ? ' checked' : ''}><span>${esc(name)}${sub ? `<br><small class="ds-hint">${esc(sub)}</small>` : ''}</span></label>` +
      (id ? `<button class="lnk" data-a="hscdel" data-id="${esc(id)}">Delete</button>` : '') + '</div>';
    let h = '<div class="ds-feat" id="hscard"><div class="ds-lab">Sheet to fill</div>';
    h += radio('', 'Official sheet', '') + S.lib.map((s) => radio(s.id, s.name, s.stats.mapped + ' things matched')).join('');
    if (c)
      h +=
        `<label class="ds-chk"><input type="checkbox" data-hsc="swap"${c.swap ? ' checked' : ''}>Swap ability score and modifier</label>` +
        `<p class="ds-hint">${c.unmapped ? c.unmapped + ' text boxes on this sheet are left empty.' : 'Every text box was matched.'}` +
        (bad.length ? `<br>Too long for the box: ${esc(bad.slice(0, 5).map((i) => i.key.replace(/#.*/, '')).join(', '))}.` : '') +
        (c.notes && c.notes.length ? '<br>' + c.notes.map(esc).join('<br>') : '') + '</p>';
    else if (!S.lib.length)
      h += '<p class="ds-hint">Upload a fillable PDF. Hearthscribe matches its boxes to your character and fills it. It is saved here so you can pick it again later. Spell and item cards are still added.</p>';
    h +=
      `<label class="btn alt ds-wide" style="text-align:center;cursor:pointer">${S.busy ? 'Reading…' : 'Add my own sheet (PDF)'}<input id="hscfile" type="file" accept="application/pdf,.pdf" hidden></label>` +
      (S.msg ? `<p class="ds-hint">${esc(S.msg)}</p>` : '') +
      '</div>';
    return h;
  };
  window.customCard = html;
  function refresh() {
    const el = document.getElementById('hscard');
    if (el) el.outerHTML = html();
  }

  /* ---- upload: read it, match it, save it to the list and use it ---- */
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
        const at = Date.now(), rec = { id: 's' + at, name: f.name.replace(/\.pdf$/i, ''), bytes: r.bytes, plan: r.plan, stats: r.stats, notes: r.notes, unmapped: r.unmapped.length, swap: false, at };
        S.sheet = rec;
        S.items = [];
        S.lib = S.lib.concat(meta(rec));
        S.msg = '';
        await saveSheet();
        await saveLib();
        await put('active', rec.id);
      }
    } catch (e) {
      S.msg = 'Could not use that PDF: ' + ((e && e.message) || e);
    }
    S.busy = false;
    draw();
  }

  document.addEventListener('change', async (e) => {
    const t = e.target, k = t.dataset && t.dataset.hsc;
    if (t.id === 'hscfile') {
      const f = t.files && t.files[0];
      t.value = '';
      if (f) load(f);
    } else if (k === 'pick') {
      await openId(t.value);
      draw();
    } else if (k === 'swap' && S.sheet) {
      S.sheet.swap = t.checked;
      S.items = [];
      await saveSheet();
      draw();
    }
  });
  on('hscdel', (d) => {
    const s = S.lib.find((x) => x.id === d.id);
    if (!s || !confirm('Delete the saved sheet "' + s.name + '"?')) return false;
    S.lib = S.lib.filter((x) => x.id !== d.id);
    if (S.sheet && S.sheet.id === d.id) {
      S.sheet = null;
      S.items = [];
      put('active', null);
    }
    del('sheet:' + d.id);
    saveLib();
  });
})();
