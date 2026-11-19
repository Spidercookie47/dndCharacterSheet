/* Desktop Character sheet (1000px and wider): Play | Export / PDF.
   Load after events.js, sheet.js, magic.js, play.js and homephone.js. Phones and tablets keep the old sheet.
   Uses the existing actions: hp, hpdmg, hpheal, hptemp, hdspend, res, rest, pick, prev, pdf, save. */
(() => {
  const MQ = window.matchMedia('(min-width: 1000px)');
  const st = { sub: 'play', pdf: null, pdfPage: 0, right: 'spell', spell: null, feat: null, gear: null, spells: true, items: true };
  window.hsPdfOpts = st; // pdf code can read hsPdfOpts.spells and hsPdfOpts.items

  const active = () => MQ.matches && system === 'dnd5e' && !mfocus;
  const ord = (n) => n + (['st', 'nd', 'rd'][n - 1] || 'th');
  const isSK = (k) => (typeof isSlotKey === 'function' ? isSlotKey(k) : /^(slot\d|pact)$/.test(k));
  const left = (R, k) => {
    if (typeof slotLeft === 'function') return slotLeft(R, k);
    const x = R.find((y) => y.k === k);
    return x ? x.max - Math.min((ch.used || {})[k] || 0, x.max) : 0;
  };
  const slotLvl = (k, r) => (k === 'pact' ? (slotsFor(r).pact || { l: 0 }).l : +k.slice(4));
  const sgm = (n) => sg(n).replace('-', '−');
  const tile = (l, b, e) => `<div class="ds-tile"><small>${l}</small><b>${b}</b>${e != null ? `<em>${e}</em>` : ''}</div>`;

  /* ---- spells the character has ready, grouped by level ---- */
  function spellData(r) {
    const I = idx(), groups = {}, seen = new Set(), owner = {};
    const put = (s, n, tag) => {
      if (!s || seen.has(s.id)) return;
      seen.add(s.id);
      if (n) owner[s.id] = n;
      (groups[s.lvl] = groups[s.lvl] || []).push({ s, tag });
    };
    casters(r).forEach((n) =>
      ['c', 'p'].forEach((k) => spellRows(n, r, k).filter((x) => x.on).forEach((x) => put(x.s, n, x.m.includes('★') ? '★ ' : ''))),
    );
    featSpells(r).forEach((f) => put(I[f.id], null, ''));
    Object.values(groups).forEach((a) => a.sort((x, y) => x.s.name.localeCompare(y.s.name)));
    return { groups, owner };
  }

  /* ---- column 1: character ---- */
  function colA(r, c, R) {
    const h = hpInfo(c), hd = hdInfo();
    const pct = h.max ? Math.round((h.now / h.max) * 100) : 0, tone = pct <= 25 ? 'crit' : pct <= 50 ? 'lo' : '';
    const hdL = hd.reduce((s, x) => s + x.left, 0), hdN = hd.reduce((s, x) => s + x.n, 0), hdK = hd.find((x) => x.left > 0);
    const face = imgSrc(ch.img) ? `<img src="${imgSrc(ch.img)}" alt="">` : esc((ch.name || 'Hero').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join(''));
    return (
      `<div class="ds-who"><div class="ds-av">${face}</div><div><div class="ds-nm">${esc(ch.name || 'Unnamed hero')}</div><small>${esc(summary(ch))}</small></div></div>` +
      (h.max
        ? `<section class="ds-card hpcard"><div class="ds-row"><span class="ds-lab">Hit points</span><span class="ds-lab">Hit dice ${hdL} / ${hdN}</span></div>` +
          `<div class="ds-hp"><button data-a="hp" data-d="-1" aria-label="Lose 1 hit point">−</button><div class="ds-big">${h.now}<span> / ${h.max}</span>${h.temp ? `<small>+${h.temp} temporary</small>` : ''}</div><button data-a="hp" data-d="1" aria-label="Gain 1 hit point">+</button></div>` +
          `<div class="hpbar" role="progressbar" aria-label="Hit points" aria-valuemin="0" aria-valuemax="${h.max}" aria-valuenow="${h.now}"><i class="${tone}" style="width:${pct}%"></i></div>` +
          `<div class="ds-act"><input type="number" id="hpamt" min="1" value="1" aria-label="Amount"><button class="go" data-a="hpdmg">Damage</button><button data-a="hpheal">Heal</button><button data-a="hptemp">Temp</button></div>` +
          (hdK ? `<div class="ds-act"><button data-a="hdspend" data-c="${esc(hdK.k)}">Spend hit die (d${hdK.d})</button></div>` : '') +
          '</section>'
        : '<section class="ds-card"><p class="ds-hint" style="margin:0">Choose a class on the Build tab to track hit points.</p></section>') +
      `<div class="ds-st">${tile('AC', c.ac)}${tile('INIT', sg(c.init))}${tile('SPEED', c.speed)}${tile('PROF', sg(c.pb))}</div>` +
      `<div class="ds-ab">${AB.map((a) => tile(a.toUpperCase(), sg(mod(c.sc[a])).replace('-', '−'), c.sc[a])).join('')}</div>` +
      `<div class="ds-pp">Passive Perception <b>${c.pp}</b></div>`
    );
  }

  /* ---- column 2: resources, slots, rests, spells ---- */
  function colB(r, c, R, sd) {
    const slotR = R.filter((x) => isSK(x.k)), other = R.filter((x) => !isSK(x.k));
    const info = casterInfo(r, c);
    let h = other
      .map((x) => {
        const inf = x.max === Infinity, u = inf ? 0 : Math.min(ch.used[x.k] || 0, x.max), lf = inf ? '∞' : x.max - u, m = inf ? 0 : x.max;
        const pips = !inf && x.max <= 12 ? `<div class="ds-pips">${'<i class="f"></i>'.repeat(x.max - u)}${'<i></i>'.repeat(u)}</div>` : '';
        return (
          `<section class="ds-card"><div class="ds-row"><div class="ds-name">${esc(x.n)}<small>${x.rest === 'S' ? 'back on a short rest' : 'back on a long rest'}${x.note ? ' · ' + esc(x.note) : ''}</small></div>` +
          `<span class="bar"><button class="alt" data-a="res" data-k="${esc(x.k)}" data-d="-1" data-m="${m}">Restore</button><button class="alt" data-a="res" data-k="${esc(x.k)}" data-d="1" data-m="${m}">Use one</button></span></div>` +
          (pips || `<p class="ds-hint">${lf}${inf ? '' : ' / ' + x.max} left</p>`) + '</section>'
        );
      })
      .join('');
    if (slotR.length)
      h +=
        `<section class="ds-card"><div class="ds-row"><div class="ds-name" style="margin:0">Spell slots</div>${info ? `<span class="ds-lab" style="letter-spacing:0;text-transform:none">Save DC ${info.dc} · Attack ${sg(info.atk)}</span>` : ''}</div>` +
        `<div class="ds-slots">${slotR
          .map((x) => {
            const lf = left(R, x.k);
            return `<button class="${lf < x.max ? 'u' : ''}" data-a="res" data-k="${esc(x.k)}" data-d="${lf > 0 ? 1 : -1}" data-m="${x.max}" aria-label="${x.k === 'pact' ? 'Pact slots' : 'Level ' + slotLvl(x.k, r) + ' slots'}: ${lf} of ${x.max} left"><small>${x.k === 'pact' ? 'Pact' : 'L' + slotLvl(x.k, r)}</small><b>${lf}/${x.max}</b></button>`;
          })
          .join('')}</div><p class="ds-hint">Blue = some slots spent. Tap a level to spend one; at 0 a tap gives one back.</p></section>`;
    if (R.length) h += '<div class="ds-rest"><button data-a="rest" data-v="S">Short rest</button><button data-a="rest" data-v="L">Long rest</button></div>';
    const lv = Object.keys(sd.groups).map(Number).sort((a, b) => a - b);
    h += lv
      .map((l) => {
        const sr = slotR.find((x) => x.k === 'slot' + l);
        return (
          `<div class="ds-sh"><span>${l ? ord(l) + ' level' : 'Cantrips'}</span>${sr ? `<small>${left(R, sr.k)} slots left</small>` : ''}</div>` +
          sd.groups[l].map(({ s, tag }) => `<button class="ds-sp${st.spell === s.id ? ' on' : ''}" data-a="dsspell" data-id="${esc(s.id)}"><span>${tag}${esc(s.name)}</span><small>${l ? ord(l) : 'at will'}</small></button>`).join('')
        );
      })
      .join('');
    if (!lv.length && !other.length && !slotR.length) h += '<section class="ds-card"><p class="ds-hint" style="margin:0">Resources and spells appear here once your class gives you some.</p></section>';
    return h;
  }

  /* ---- column 3: spell or feature detail ---- */
  function spellDetail(s, sd, R, r) {
    const n = sd.owner[s.id], md = n && MODE[n], rows = [];
    let cast = '';
    if (s.lvl === 0) cast = '<p class="ds-hint">Cantrip: cast it at will.</p>';
    else {
      const opts = R.filter((x) => isSK(x.k) && slotLvl(x.k, r) >= s.lvl && left(R, x.k) > 0);
      cast =
        '<div class="ds-lab" style="letter-spacing:0;text-transform:none;font-size:.9rem">Cast using a slot</div>' +
        (opts.length
          ? `<div class="ds-cb">${opts.map((x, i) => `<button class="${i ? '' : 'on'}" data-a="res" data-k="${esc(x.k)}" data-d="1" data-m="${x.max}">${x.k === 'pact' ? 'Pact' : ord(slotLvl(x.k, r)) + ' level'} · ${left(R, x.k)} left</button>`).join('')}</div>`
          : '<p class="ds-hint">No slots left at this level or higher.</p>');
    }
    const lab = s.lvl === 0 ? 'Remove cantrip' : md === 'known' ? 'Forget' : 'Unprepare';
    return (
      `<h2 class="ds-t">${esc(s.name)}</h2><p class="ds-sub">${esc(lvTxt(s))}</p>` +
      `<div class="ds-dl"><b>Casting time</b><span>${esc(s.cast)}</span><b>Range</b><span>${esc(s.range)}</span><b>Components</b><span>${esc(s.comp.replace(/,/g, ', '))}${s.mat ? ' (' + esc(s.mat) + ')' : ''}</span><b>Duration</b><span>${esc(s.dur)}</span></div>` +
      `<div class="ds-body">${s.desc.split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('')}</div><p class="ds-hint">${esc(s.lists.join(' · '))}</p>` +
      `<div class="ds-cast">${cast}${n ? `<button class="ds-wide" data-a="pick" data-k="spell" data-id="${esc(s.id)}">${lab}</button>` : ''}</div>`
    );
  }
  function featureDetail(r, R) {
    const feats = r.els.filter((e) => /Trait|Feature|Style|^Feat$/.test(e.type));
    if (!feats.length) return '<p class="ds-hint">Features from your race, class and background appear here.</p>';
    const grp = {};
    feats.forEach((f) => {
      const g = /Racial|Race/.test(f.type) ? 'Race' : /Background/.test(f.type) ? 'Background' : /^Class Feature$/.test(f.type) ? 'Class' : f.type;
      (grp[g] = grp[g] || []).push(f);
    });
    const sel = feats.find((f) => f.id === st.feat) || feats[0];
    const body = INFO[sel.id] && INFO[sel.id][0] === '<' ? clean(INFO[sel.id]) : '<p>' + esc(sel.desc || '') + '</p>';
    return (
      Object.entries(grp)
        .map(([g, a]) => `<div class="ds-sh"><span>${esc(g)}</span><small>${a.length}</small></div>` +
          a.map((f) => {
            const x = R.find((y) => y.n === f.name);
            return `<button class="ds-sp${f.id === sel.id ? ' on' : ''}" data-a="dsfeat" data-id="${esc(f.id)}"><span>${esc(f.name)}</span>${x ? `<small>${x.max === Infinity ? '∞' : left(R, x.k) + ' / ' + x.max}</small>` : ''}</button>`;
          }).join(''))
        .join('') + `<div class="ds-feat ds-body"><h3 class="ds-h">${esc(sel.name)}</h3>${body}</div>`
    );
  }
  /* ---- equipped weapons and items (the Gear view) ---- */
  function weaponStat(i, e, r, c) {
    const cu = !idx()[i.id], d = e.desc || '';
    const rng = cu ? i.wk === 'ranged' : /Ammunition/.test(d);
    const fin = cu ? i.wk === 'finesse' : /Finesse/.test(d);
    const k = rng ? 'dex' : fin && c.sc.dex > c.sc.str ? 'dex' : 'str', m = mod(c.sc[k]);
    const pr = cu || profW(r, e), mw = magicB(ch).wpn;
    const dm = cu ? [0, i.dice || '', i.dt || ''] : d.match(/Damage (\d+d\d+) (\w+)/) || [];
    return { atk: sgm(m + (pr ? c.pb : 0) + mw), dmg: dm[1] ? dm[1] + (m + mw ? sgm(m + mw) : '') : '', type: dm[2] || '' };
  }
  function gearData(r, c) {
    const W = [], T = [];
    (ch.inv || []).forEach((i, n) => {
      const e = ent(i);
      if (!e) return;
      if (e.type === 'Weapon' || i.tp === 'Weapon') {
        if (i.eq) W.push({ i, e, n, w: weaponStat(i, e, r, c) });
      } else if (i.eq || i.att) T.push({ i, e, n });
    });
    return { W, T };
  }
  function gearDetail(r, c) {
    const g = gearData(r, c), all = [...g.W, ...g.T];
    if (!all.length) return '<p class="ds-hint">Equip weapons and armor on the Equipment tab and they show up here.</p>';
    const sel = all.find((x) => x.n === st.gear) || all[0];
    const row = (x, small) => `<button class="ds-sp${x === sel ? ' on' : ''}" data-a="dsgear" data-i="${x.n}"><span>${x.i.att ? '◆ ' : ''}${esc(x.e.name)}${x.i.q > 1 ? ' ×' + x.i.q : ''}</span><small>${esc(small)}</small></button>`;
    const list = (title, a, small) => (a.length ? `<div class="ds-sh"><span>${title}</span><small>${a.length}</small></div>` + a.map((x) => row(x, small(x))).join('') : '');
    const itemTag = (x) => (x.e.type === 'Armor' ? (x.e.kind === 'Shield' ? 'Shield' : 'Armor') : x.e.rar || x.e.type || 'Item') + (x.i.att ? ' · attuned' : x.i.eq ? '' : ' · not equipped');
    const { i, e, n, w } = sel;
    const body = String(e.desc || '').split('\n\n').filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('');
    const extra = i.desc && i.desc !== e.desc ? `<p>${esc(i.desc)}</p>` : '';
    const canEq = ['Armor', 'Weapon', 'Magic'].includes(e.type) || i.tp === 'Weapon';
    return (
      list('Weapons', g.W, (x) => x.w.atk + (x.w.dmg ? ' · ' + x.w.dmg + (x.w.type ? ' ' + x.w.type : '') : '')) +
      list('Equipped items', g.T, itemTag) +
      `<div class="ds-feat ds-body"><h3 class="ds-h">${esc(e.name)}</h3>` +
      (w ? `<div class="ds-dl"><b>Attack</b><span>${w.atk}</span><b>Damage</b><span>${esc(w.dmg || '—')}${w.type ? ' ' + esc(w.type) : ''}</span></div>` : '') +
      body + extra + effTxt(e, i) + masteryBox(masteryName(e)) +
      (canEq ? `<button class="ds-wide" style="margin-top:12px" data-a="eqi" data-i="${n}" data-d="">${i.eq ? 'Unequip' : 'Equip'}</button>` : '') +
      '</div>'
    );
  }
  function colC(r, c, R, sd) {
    const I = idx(), all = Object.values(sd.groups).flat();
    const sel = I[st.spell] && all.some((x) => x.s.id === st.spell) ? I[st.spell] : (all[0] || {}).s;
    return (
      `<div class="ds-card fill"><div class="ds-seg"><button class="${st.right === 'spell' ? 'on' : ''}" data-a="dsright" data-v="spell">Spell</button><button class="${st.right === 'feat' ? 'on' : ''}" data-a="dsright" data-v="feat">Features</button><button class="${st.right === 'gear' ? 'on' : ''}" data-a="dsright" data-v="gear">Gear</button></div>` +
      (st.right === 'feat' ? featureDetail(r, R) : st.right === 'gear' ? gearDetail(r, c) : sel ? spellDetail(sel, sd, R, r) : '<p class="ds-hint">Pick spells on the Magic tab and they show up here.</p>') +
      '</div>'
    );
  }

  /* ---- column 4: saves and skills ---- */
  function colD(c) {
    const row = (n, v, m) => `<div class="ds-r ${m}"><span><i class="ds-m ${m || 'n'}"></i>${esc(n)}</span><b>${sg(v).replace('-', '−')}</b></div>`;
    return (
      `<div class="ds-card fill"><h3 class="ds-h">Saving throws</h3>${AB.map((a) => row(AN[a], c.sv[a].v, c.sv[a].p ? 'p' : '')).join('')}` +
      `<h3 class="ds-h" style="margin-top:14px">Skills</h3>${Object.entries(c.sk).map(([n, s]) => row(n, s.v, s.x ? 'e' : s.p ? 'p' : '')).join('')}` +
      '<p class="ds-hint"><i class="ds-m p"></i>proficient · <i class="ds-m e"></i>expertise</p></div>'
    );
  }

  function playHtml() {
    const r = resolve(ch), c = calc(ch, r), R = resources(r, c), sd = spellData(r);
    ch.used = ch.used || {};
    return `<div class="ds-col ds-a">${colA(r, c, R)}</div><div class="ds-col ds-b">${colB(r, c, R, sd)}</div><div class="ds-col ds-c">${colC(r, c, R, sd)}</div><div class="ds-col ds-d">${colD(c)}</div>`;
  }

  /* ---- Export: a live paper preview of the sheet (page 1), spell page and item page ---- */
  function paperSheet(r, c) {
    const I = idx(), d = ch.d || {};
    const cn = Object.entries(classLevels(ch)).map(([k, n]) => ((I[k] || {}).name || '') + ' ' + n).join(' / ');
    const rc = r.els.find((e) => e.type === 'Sub Race') || r.els.find((e) => e.type === 'Race'), bg = I[ch.bg];
    const box = (l, v) => `<div class="pp-box"><b>${v}</b><small>${l}</small></div>`;
    const row = (n, v, m) => `<div class="pp-r"><span>${m ? '● ' : ''}${esc(n)}</span><span>${sgm(v)}</span></div>`;
    const atk = [1, 2, 3].filter((n) => d['a' + n + 'n']).map((n) => `<div class="pp-r"><span>${esc(d['a' + n + 'n'])}</span><span>${esc(d['a' + n + 'b'] || '')}</span><span>${esc(d['a' + n + 'd'] || '')}</span></div>`).join('');
    const feats = r.els.filter((e) => /Trait|Feature|Style|^Feat$/.test(e.type)).slice(0, 24).map((f) => `<div>• ${esc(f.name)}</div>`).join('');
    const hd = hdInfo().map((x) => `${x.n}d${x.d}`).join(' + ');
    const h = hpInfo(c);
    const txt = (l, v) => (v ? `<div class="pp-t"><small>${l}</small>${esc(v)}</div>` : '');
    return (
      `<div class="pp-head"><div class="pp-name">${esc(ch.name || 'Unnamed hero')}</div><div class="pp-meta">${esc(cn || '(no class)')} · ${esc((rc || {}).name || '')} · ${esc((bg || {}).name || '')}</div></div>` +
      '<div class="pp-cols">' +
      `<div class="pp-c1">${AB.map((a) => `<div class="pp-ab"><small>${a.toUpperCase()}</small><b>${sgm(mod(c.sc[a]))}</b><span>${c.sc[a]}</span></div>`).join('')}` +
      `<div class="pp-s">Saving throws</div>${AB.map((a) => row(AN[a], c.sv[a].v, c.sv[a].p)).join('')}</div>` +
      `<div class="pp-c2"><div class="pp-grid">${box('Armor Class', c.ac)}${box('Initiative', sgm(c.init))}${box('Speed', c.speed + ' ft')}${box('Proficiency', sgm(c.pb))}</div>` +
      `<div class="pp-hp"><small>Hit point maximum</small><b>${h.max || '—'}</b><span>Hit dice ${esc(hd || '—')}</span></div>` +
      `<div class="pp-s">Attacks</div>${atk || '<div class="pp-mut">None filled in yet</div>'}<div class="pp-s">Skills</div>${Object.entries(c.sk).map(([n, k]) => row(n, k.v, k.p || k.x)).join('')}</div>` +
      `<div class="pp-c3">${txt('Personality traits', d.traits)}${txt('Ideals', d.ideal)}${txt('Bonds', d.bond)}${txt('Flaws', d.flaw)}<div class="pp-s">Features &amp; traits</div>${feats || '<div class="pp-mut">None yet</div>'}<div class="pp-s">Languages</div><div>${esc(langList(r).join(', ') || '—')}</div></div>` +
      '</div>'
    );
  }
  /* ---- Export: the real filled PDF, drawn with pdf.js (same bytes as the download) ----
     mk() is export.js: it fills the official sheet and appends the spell and item cards. */
  const hash = (t) => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return h + ':' + t.length; };
  const pdfKey = () => { try { return hash(JSON.stringify(ch)) + '|' + st.spells + '|' + st.items + '|' + (window.hsCustomKey ? window.hsCustomKey() : ''); } catch (e) { return String(Date.now()); } };
  const onExport = () => active() && tab === 'sheet' && st.sub === 'export';

  function pdfPaint() {
    const el = document.getElementById('dsprev');
    if (el && onExport()) el.innerHTML = pdfInner();
  }
  async function pdfBuild() {
    const key = pdfKey();
    if (st.pdf && st.pdf.key === key) return;
    const job = (st.pdf = { key, status: 'busy', pages: [], total: 0, err: '' });
    st.pdfPage = 0;
    try {
      if (typeof mk !== 'function' || !window.PDFLib) throw new Error('the PDF tools did not load');
      const bytes = await mk();
      if (!window.pdfjsLib) throw new Error('the PDF viewer did not load');
      pdfjsLib.GlobalWorkerOptions.workerSrc = window.HS_PDFJS_WORKER || 'vendor/pdf.worker.min.js';
      const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
      job.total = doc.numPages;
      for (let i = 1; i <= Math.min(doc.numPages, 16); i++) {
        if (st.pdf !== job) return; // the character changed: a newer build took over
        const pg = await doc.getPage(i), vp = pg.getViewport({ scale: 1.4 }), cv = document.createElement('canvas');
        cv.width = vp.width;
        cv.height = vp.height;
        await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
        job.pages.push(cv.toDataURL('image/jpeg', 0.85));
        if (i < 3 || i % 4 === 0) pdfPaint();
      }
      job.status = 'ok';
    } catch (e) {
      job.status = 'err';
      job.err = (e && e.message) || String(e);
    }
    if (st.pdf === job) pdfPaint();
  }
  function pdfInner() {
    const P = st.pdf || { status: 'busy', pages: [], total: 0 };
    if (P.status === 'err') {
      const r = resolve(ch), c = calc(ch, r);
      return `<div class="ds-prev"><div class="ds-paper" data-a="prev" title="Click to look closer"><div class="pp">${paperSheet(r, c)}</div></div></div><p class="ds-hint">Could not build the PDF preview (${esc(P.err)}). This is a simplified page; the download still works.</p>`;
    }
    if (!P.pages.length) return '<div class="ds-prev"><div class="ds-pdfpage ds-wait"><span>Preparing preview…</span></div></div>';
    const i = Math.min(st.pdfPage || 0, P.pages.length - 1), busy = P.status === 'busy';
    return (
      `<div class="ds-prev"><div class="ds-pdfpage" data-a="prev" title="Click to look closer"><img src="${P.pages[i]}" alt="Page ${i + 1}"></div>` +
      `<div class="ds-th">${P.pages.map((u, k) => `<img class="${k === i ? 'on' : ''}" src="${u}" data-a="dspdfpage" data-v="${k}" alt="Page ${k + 1}">`).join('')}` +
      `<span class="ds-hint">Page ${i + 1} of ${P.total || P.pages.length}${busy ? ' · loading…' : ''}${P.total > P.pages.length ? '<br>The download has all ' + P.total + ' pages.' : ''}</span></div></div>`
    );
  }
  function exportHtml() {
    let t = 0;
    try { t = +localStorage.getItem('hs-lastsave') || 0; } catch (e) {}
    const d = t ? Math.floor((Date.now() - t) / 864e5) : -1;
    const bak = d < 0 ? 'No file backup yet' : 'Last file backup: ' + (d < 1 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago');
    return (
      `<div class="ds-col"><section class="ds-card fill"><div class="ds-row" style="margin-bottom:12px"><span class="ds-lab">Preview · the file you would download</span><button class="alt" data-a="prev">Look closer</button></div><div id="dsprev">${pdfInner()}</div></section></div>` +
      '<div class="ds-col"><section class="ds-card"><h2 class="ds-t" style="font-size:1.8rem">Download</h2><p class="hint">The official fillable sheet, filled in from this character.</p>' +
      `<label class="ds-chk"><input type="checkbox" data-dsopt="spells"${st.spells ? ' checked' : ''}>Add spell cards</label><label class="ds-chk"><input type="checkbox" data-dsopt="items"${st.items ? ' checked' : ''}>Add item cards</label>` +
      (window.customCard ? window.customCard() : '') +
      '<button class="ds-go" data-a="pdf">Download official sheet (PDF)</button><button class="ds-exp-b" data-a="prev">Open full preview</button><button class="ds-exp-b" data-a="save">Save character file (.hearth.json)</button>' +
      `<p class="ds-hint">${bak}</p></section></div>`
    );
  }

  /* The two checkboxes now decide what export.js builds, for the preview and the download alike. */
  const baseSpells = preparedSpells, baseItems = equippedItems;
  preparedSpells = () => (st.spells ? baseSpells() : []);
  equippedItems = () => (st.items ? baseItems() : []);

  /* ---- hook into the draw cycle ---- */
  const baseSheet = renderSheet;
  renderSheet = function () {
    if (!active()) return baseSheet();
    const m = $('#main');
    m.className = 'main ds' + (st.sub === 'export' ? ' exp' : '');
    m.innerHTML = st.sub === 'export' ? exportHtml() : playHtml();
    if (st.sub === 'export') setTimeout(pdfBuild, 0);
  };
  const baseChrome = chrome;
  chrome = function () {
    if (active() && tab === 'play') tab = 'sheet'; // desktop has no Play tab: the Character sheet does the same job
    baseChrome();
    if (!active()) return;
    const pt = document.querySelector('#nav .tab[data-v="play"]');
    if (pt) pt.remove();
    if (tab !== 'sheet') return;
    const sb = document.querySelector('#sub .subtabs');
    if (sb) sb.innerHTML = subTabs([['play', 'Play'], ['export', 'Export / PDF']], st.sub, 'dssub');
    const sp = document.querySelector('#sub [data-a="sheetpanel"]'); // the side summary panel is replaced by this screen
    if (sp) sp.remove();
  };

  on('dssub', (d) => { st.sub = d.v; });
  on('dspdfpage', (d) => { st.pdfPage = +d.v || 0; });
  on('dsright', (d) => { st.right = d.v; });
  on('dsfeat', (d) => { st.feat = d.id; });
  on('dsgear', (d) => { st.gear = +d.i; });
  on('dsspell', (d) => {
    st.spell = d.id;
    st.right = 'spell';
    const n = spellData(resolve(ch)).owner[d.id];
    if (n) spc = n; // so Unprepare changes the right class
  });
  document.addEventListener('change', (e) => {
    const k = e.target.dataset && e.target.dataset.dsopt;
    if (k) { st[k] = e.target.checked; draw(); }
  });
  MQ.addEventListener('change', () => draw());
})();
