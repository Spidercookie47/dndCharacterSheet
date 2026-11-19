/* Custom sheet engine: read an uploaded fillable PDF, fix it up, match its boxes to character data, fill it, check it is readable.
   Needs pdf-lib (PDFLib global). The label list comes from pdf.js in the browser (labelsFromPdfJs) or from any tool that gives word boxes.
   Load after js/pdf/5e/export.js. No other app code is needed here: everything works on plain data, so it is also tested in Node (custom.test.js).
   Coordinates are PDF points, origin bottom-left, like pdf-lib. A "box" is {page, x, y, w, h}. */
(function (g) {
  'use strict';
  const L = g.PDFLib || (typeof require === 'function' ? require('pdf-lib') : null);

  const SAVES = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
  const AB = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const SKILLS = ['Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival'];

  /* What a printed label means. First match wins. Text is upper-cased, ":" removed, "&" kept. */
  const AMP = '( & | AND |/)?';
  const LABELS = [
    [/^(CHARACTER )?NAME$/, 'name'], [/^CLASS( & LVL| & LEVEL| AND LEVEL)?$|^CLASS ?& ?LV[LE]*$/, 'classlevel'],
    [/^(RACE|SPECIES)$/, 'race'], [/^BACKGROUND$/, 'background'], [/^PLAYER( NAME)?$/, 'player'], [/^ALIGNMENT$/, 'alignment'],
    [/^(EXP|XP|EXPERIENCE|EXPERIENCE POINTS)$/, 'exp'], [/^GENDER$/, 'gender'], [/^AGE$/, 'age'], [/^SKIN$/, 'skin'],
    [new RegExp('^EYES' + AMP + 'HAIR$'), 'eyeshair'], [/^EYES$/, 'eyes'], [/^HAIR$/, 'hair'],
    [new RegExp('^HEIGHT' + AMP + 'WEIGHT$'), 'heightweight'], [/^HEIGHT$/, 'height'], [/^WEIGHT$/, 'weight'],
    [/^(CURRENT HP|CURRENT HIT POINTS|HP)$/, 'hpnow'], [/^(MAX HP|MAXIMUM HP|HIT POINT MAXIMUM|MAX HIT POINTS)$/, 'hpmax'],
    [/^(TEMP HP|TEMPORARY HIT POINTS|TEMP HIT POINTS)$/, 'hptemp'], [/^HIT DI(E|CE)$/, 'hitdie'],
    [/^INSPIRATION$/, 'inspiration'], [/^PROFICIENCY( BONUS)?$/, 'pb'], [/^PASSIVE( WISDOM| PERCEPTION)?$/, 'pp'],
    [/^(AC|ARMOR CLASS)$/, 'ac'], [/^(INIT|INITIATIVE)$/, 'init'], [/^(SP|SPEED)$/, 'speed'],
    [/^(STR|STRENGTH)$/, 'ab:str'], [/^(DEX|DEXTERITY)$/, 'ab:dex'], [/^(CON|CONSTITUTION)$/, 'ab:con'],
    [/^(INT|INTELLIGENCE)$/, 'ab:int'], [/^(WIS|WISDOM)$/, 'ab:wis'], [/^(CHA|CHARISMA)$/, 'ab:cha'],
    [/^PERSONALITY TRAITS$/, 'traits'], [/^IDEALS?$/, 'ideals'], [/^BONDS?$/, 'bonds'], [/^FLAWS?$/, 'flaws'],
    [new RegExp('^FEATURES' + AMP + 'TRAITS$'), 'features'], [new RegExp('^ADDITIONAL FEATURES' + AMP + 'TRAITS$'), 'addfeat'],
    [new RegExp('^OTHER PROFICIENCIES' + AMP + 'LANGUAGES$'), 'profs'], [/^(PROFICIENCIES|LANGUAGES)$/, 'profs'],
    [/^EQUIPMENT$/, 'equipment'], [new RegExp('^ATTACKS' + AMP + 'SPELLCASTING$'), 'attacks'],
    [/^CHARACTER BACKSTORY$|^BACKSTORY$/, 'backstory'], [new RegExp('^ALLIES' + AMP + 'ORGANI[SZ]ATIONS$'), 'allies'], [/^TREASURE$/, 'treasure'],
    [/^CP$/, 'coin:cp'], [/^SP$/, 'coin:sp'], [/^EP$/, 'coin:ep'], [/^GP$/, 'coin:gp'], [/^PP$/, 'coin:pp'],
    [/^(0 )?CANTRIPS$/, 'cantrips'], [/^SP CASTING CLASS$|^SPELLCASTING CLASS$/, 'spclass'], [/^SP ATK BONUS$|^SPELL ATTACK BONUS$/, 'spatk'],
    [/^SP CASTING ABILITY$|^SPELLCASTING ABILITY$/, 'spab'], [/^SP SAVE DC$|^SPELL SAVE DC$/, 'spdc'],
  ];
  /* Curved or sideways banner text comes out as letters with no spaces and sometimes a missing end ("CLA", "&LVL"), so it is compared loosely. */
  const CURVED = [['NAME', 'name'], ['CHARACTERNAME', 'name'], ['CLASS&LVL', 'classlevel'], ['CLASS&LEVEL', 'classlevel'], ['SPCASTINGCLASS', 'spclass'], ['SPATKBONUS', 'spatk'], ['SPCASTINGABILITY', 'spab'], ['SPSAVEDC', 'spdc']];
  const labelKey = (t, curved) => {
    const s = String(t).toUpperCase().replace(/:/g, '').replace(/\s+/g, ' ').trim();
    for (const [re, k] of LABELS) if (re.test(s)) return k;
    if (curved) { const c = s.replace(/[^A-Z&]/g, ''); if (c.length >= 3) for (const [m, k] of CURVED) if (m === c || m.startsWith(c) || m.endsWith(c)) return k; }
    return null;
  };

  /* ---------- geometry ---------- */
  const R = (f) => ({ x: f.x, y: f.y, w: f.w, h: f.h, r: f.x + f.w, t: f.y + f.h });
  const gap = (a, b) => { const A = R(a), B = R(b); return { dx: Math.max(0, A.x - B.r, B.x - A.r), dy: Math.max(0, A.y - B.t, B.y - A.t) }; };
  const dist = (a, b) => { const d = gap(a, b); return Math.hypot(d.dx, d.dy); };
  const vOverlap = (a, b) => Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) / Math.min(a.h, b.h);
  const groupBy = (a, f) => { const m = new Map(); a.forEach((x) => { const k = f(x); (m.get(k) || m.set(k, []).get(k)).push(x); }); return m; };

  /* ---------- labels: merge loose words into phrases ---------- */
  function mergeLabels(words) {
    // some sheets print the blank and its label as ONE text run ("_____ STRENGTH"): cut the blank off and move the label's start past it
    const W = words.map((w) => { const m = /^[_\s]+/.exec(w.t); if (!m || m[0].length >= w.t.length) return w; const k = m[0].length / w.t.length; return { ...w, t: w.t.slice(m[0].length), x: w.x + w.w * k, w: w.w * (1 - k) }; })
      .filter((w) => w.t && !/^_+$/.test(w.t) && !(w.t.length === 1 && !/[A-Za-z0-9&]/.test(w.t))); // also drop lone bullet / circle glyphs
    const singles = W.filter((w) => w.t.length === 1 && w.t !== '&' || (w.t === '&' && false)), multi = W.filter((w) => !singles.includes(w));
    const out = [];
    // horizontal runs on the same baseline
    for (const [, ws] of groupBy(multi, (w) => w.p)) {
      ws.sort((a, b) => b.y - a.y || a.x - b.x);
      let cur = null;
      for (const w of ws) {
        if (cur && Math.abs(cur.y - w.y) <= 1.5 && w.x - (cur.x + cur.w) <= Math.max(1.5, 0.7 * w.h) && w.x >= cur.x) { cur.t += ' ' + w.t; cur.w = w.x + w.w - cur.x; cur.h = Math.max(cur.h, w.h); }
        else { if (cur) out.push(cur); cur = { ...w }; }
      }
      if (cur) out.push(cur);
    }
    // curved or sideways text arrives as single letters: chain letters that are close together
    for (const [, ws] of groupBy(W.filter((w) => w.t.length === 1), (w) => w.p)) {
      const seen = new Set();
      for (const s of ws) {
        if (seen.has(s)) continue;
        const grp = [s]; seen.add(s);
        for (let i = 0; i < grp.length; i++) for (const o of ws) if (!seen.has(o) && Math.hypot(o.x - grp[i].x, o.y - grp[i].y) <= Math.max(7, grp[i].h * 1.6)) { seen.add(o); grp.push(o); }
        if (grp.length < 3) { grp.forEach((a) => out.push({ ...a })); continue; }
        const xs = grp.map((a) => a.x), ys = grp.map((a) => a.y), wide = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys);
        grp.sort(wide ? (a, b) => a.x - b.x : (a, b) => b.y - a.y);
        const x0 = Math.min(...xs), y0 = Math.min(...ys);
        out.push({ p: s.p, t: grp.map((a) => a.t).join(''), x: x0, y: y0, w: Math.max(...grp.map((a) => a.x + (a.w || 3))) - x0, h: Math.max(...ys) - y0 + 5, curved: true });
      }
    }
    // two-line labels ("PROFICIENCY" over "BONUS"): add the joined text as an extra candidate
    const extra = [], inCol = (a) => out.filter((c) => c.p === a.p && !c.curved && Math.abs(c.x - a.x) <= 3 && Math.abs(c.y - a.y) <= 30).length > 2;
    for (const a of out) for (const b of out) if (a !== b && a.p === b.p && !a.curved && !b.curved && a.t.length > 1 && b.t.length > 1 && a.y > b.y && a.y - b.y <= 1.35 * a.h && Math.abs(a.x + a.w / 2 - (b.x + b.w / 2)) <= 10 && !inCol(a) && !inCol(b))
      extra.push({ p: a.p, t: a.t + ' ' + b.t, x: Math.min(a.x, b.x), y: b.y, w: Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x), h: a.y + a.h - b.y, extra: true });
    return out.concat(extra);
  }

  /* browser: word boxes from pdf.js (call with the pdfjsLib global) */
  async function wordsFromPdfJs(pdfjsLib, bytes) {
    const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise, out = [];
    for (let p = 0; p < doc.numPages; p++) {
      const tc = await (await doc.getPage(p + 1)).getTextContent();
      tc.items.forEach((it) => { const t = String(it.str || '').trim(); if (!t) return; const h = Math.abs(it.transform[3]) || it.height || 8; out.push({ p, t, x: it.transform[4], y: it.transform[5], w: it.width, h }); });
    }
    return out;
  }

  /* ---------- read the form ---------- */
  function readFields(doc) {
    const form = doc.getForm(), pages = doc.getPages(), owner = new Map();
    pages.forEach((pg, i) => { const an = pg.node.Annots(); if (an) for (let k = 0; k < an.size(); k++) { const o = doc.context.lookup(an.get(k)); if (o) owner.set(o, i); } });
    const out = [];
    form.getFields().forEach((f) => {
      const kind = f instanceof L.PDFTextField ? 'text' : f instanceof L.PDFCheckBox ? 'check' : 'other';
      f.acroField.getWidgets().forEach((w, i) => {
        const r = w.getRectangle(), p = owner.get(w.dict);
        if (p === undefined) return;
        out.push({ id: f.getName() + (i ? '#' + i : ''), name: f.getName(), kind, page: p, x: r.x, y: r.y, w: r.width, h: r.height, multiline: kind === 'text' && f.isMultiline() });
      });
    });
    return out;
  }

  /* ---------- find stacks of lines that should be one box ---------- */
  function hasSibling(f, all) { return all.some((o) => { if (o === f || o.page !== f.page || vOverlap(f, o) < 0.6 || Math.abs(o.h - f.h) > 3.5) return false; const d = gap(f, o); return d.dx > 0 && d.dx <= 8 && d.dy === 0 && Math.abs(f.y + f.h / 2 - (o.y + o.h / 2)) <= 3; }); }

  function findStacks(fields) {
    const stacks = [];
    for (const [, fs] of groupBy(fields, (f) => f.page)) {
      const cand = fs.filter((f) => f.kind === 'text' && !f.multiline && f.h <= 18 && f.w >= 50 && !hasSibling(f, fs)).sort((a, b) => b.y - a.y || a.x - b.x), chains = [];
      for (const f of cand) {
        let hit = null;
        for (const c of chains) {
          const last = c[c.length - 1], dy = last.y - f.y;
          if (dy < 7 || dy > 16 || Math.abs(last.h - f.h) > 2) continue;
          if (!(Math.abs(last.x + last.w - (f.x + f.w)) <= 3 || Math.abs(last.x - f.x) <= 3)) continue;
          if (c.length > 1 && Math.abs(dy - (c[0].y - c[1].y)) > 2.5) continue;
          hit = c; break;
        }
        hit ? hit.push(f) : chains.push([f]);
      }
      for (const c of chains) {
        if (c.length < 3) continue;
        const minX = Math.min(...c.map((f) => f.x)); // a line that starts further right carries a printed label (IDEALS: ...): it starts a new block
        let blocks = [], cur = [];
        c.forEach((f, i) => { if (i && f.x > minX + 10 && cur.length) { blocks.push(cur); cur = []; } cur.push(f); });
        blocks.push(cur);
        blocks.filter((b) => b.length >= 2).forEach((b) => stacks.push({ page: b[0].page, lines: b.map((f) => f.id), boxes: b.map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h })), pitch: b.length > 1 ? (b[0].y - b[b.length - 1].y) / (b.length - 1) : 11 }));
      }
    }
    stacks.forEach((s, i) => (s.id = 'hs_blk' + (i + 1)));
    return stacks;
  }

  /* pdf-lib's form.removeField() throws on boxes that have no appearance stream (the default sheet's cantrip lines) and leaves the file unsaveable.
     Take the boxes off their pages and out of the form by hand instead. */
  function dropField(doc, name) {
    const form = doc.getForm();
    let fld; try { fld = form.getField(name); } catch (e) { return; }
    const ctx = doc.context, widgets = fld.acroField.getWidgets();
    for (const pg of doc.getPages()) { const an = pg.node.Annots(); if (!an) continue; for (let i = an.size() - 1; i >= 0; i--) if (widgets.some((w) => ctx.lookup(an.get(i)) === w.dict)) an.remove(i); }
    form.acroForm.removeField(fld.acroField);
    if (form.fieldCache && form.fieldCache.invalidate) form.fieldCache.invalidate();
  }

  /* ---------- convert: replace each stack with one multi-line box ---------- */
  async function convert(doc, stacks) {
    const form = doc.getForm(), pages = doc.getPages(), done = [];
    for (const s of stacks) {
      s.lines.forEach((id) => dropField(doc, id.split('#')[0]));
      const minX = Math.min(...s.boxes.map((b) => b.x)), maxR = Math.max(...s.boxes.map((b) => b.x + b.w)), first = s.boxes[0], last = s.boxes[s.boxes.length - 1];
      const tf = form.createTextField(s.id);
      tf.enableMultiline();
      tf.addToPage(pages[s.page], { x: minX, y: last.y - 1, width: maxR - minX, height: first.y + first.h + 1 - (last.y - 1), borderWidth: 0, textColor: L.rgb(0, 0, 0) });
      s.rect = { x: minX, y: last.y - 1, w: maxR - minX, h: first.y + first.h + 1 - (last.y - 1) };
      done.push(s.id);
    }
    return done;
  }

  /* ---------- match boxes to character data ---------- */
  function autoMap(fields, stacks, labels) {
    const map = {}, taken = new Set(), notes = [];
    const put = (key, v) => { if (!map[key]) { map[key] = v; (v.fs || [v.f]).forEach((f) => taken.add(f)); return true; } return false; };
    const lab = labels.map((l) => ({ ...l, key: labelKey(l.t, l.curved) }));
    lab.forEach((l) => { if (l.key === 'speed' && /^SP$/i.test(l.t) && lab.some((o) => o !== l && o.p === l.p && /^(CP|EP|GP)$/i.test(o.t) && Math.abs(o.x - l.x) <= 8)) l.key = 'coin:sp'; });
    const byName = new Map(fields.map((f) => [f.name, f]));

    // 1) rows of "checkbox + bonus box + printed name": saving throws and skills
    const checks = fields.filter((f) => f.kind === 'check'), tx = fields.filter((f) => f.kind === 'text'), series = [];
    for (const [, cbs] of groupBy(checks, (c) => c.page + ':' + Math.round(c.x / 3))) {
      if (cbs.length < 4) continue;
      cbs.sort((a, b) => b.y - a.y);
      const rows = cbs.map((c) => {
        const t = tx.filter((f) => f.page === c.page && vOverlap(c, f) > 0.4 && f.x >= c.x && f.x - (c.x + c.w) <= 25).sort((a, b) => a.x - b.x)[0];
        const near = t && lab.filter((l) => l.p === c.page && Math.abs(l.y + l.h / 2 - (t.y + t.h / 2)) <= 6 && l.x >= t.x + t.w - 2 && l.x - (t.x + t.w) <= 40 && !l.curved && !l.extra).sort((a, b) => Math.abs(a.y + a.h / 2 - (t.y + t.h / 2)) - Math.abs(b.y + b.h / 2 - (t.y + t.h / 2)))[0];
        const nm = near && near.t.toUpperCase().replace(/ \(?(STR|DEX|CON|INT|WIS|CHA)\)?$/, '').trim();
        return { c, t, nm };
      });
      const ok = rows.filter((r) => r.t && r.nm && (SAVES.concat(SKILLS).some((s) => s.toUpperCase() === r.nm)));
      if (ok.length >= 4) series.push(ok);
      if (ok.length >= 4) rows.forEach((r) => { if (r.t) taken.add(r.t.name); taken.add(r.c.name); });
    }
    let sawSave = new Set();
    for (const s of series) for (const r of s) {
      const si = SAVES.findIndex((x) => x.toUpperCase() === r.nm), ki = SKILLS.findIndex((x) => x.toUpperCase() === r.nm);
      if (si >= 0 && !sawSave.has(si) && r.t.y > 0) { sawSave.add(si); put('save:' + AB[si], { t: 'bonus', f: r.t.name, cb: r.c.name, page: r.t.page }); }
      else if (ki >= 0) put('skill:' + SKILLS[ki], { t: 'bonus', f: r.t.name, cb: r.c.name, page: r.t.page });
    }
    series.length && notes.push('Saving throws and skills matched by their printed names (' + Object.keys(map).filter((k) => /^(save|skill):/.test(k)).length + ' of 24).');

    // 2) death save marks: two rows of three round boxes next to SUCCESSES / FAILURES
    const marks = checks.filter((c) => !taken.has(c.name) && c.w >= 12 && c.h >= 12);
    for (const [, row] of groupBy(marks, (c) => c.page + ':' + Math.round(c.y / 8))) {
      if (row.length < 3) continue;
      row.sort((a, b) => a.x - b.x);
      const l = lab.filter((x) => x.p === row[0].page && /^(SUCCESS|FAILURE)/i.test(x.t) && Math.abs(x.y - row[0].y) <= 30 && x.x < row[0].x + 20 && row[0].x - x.x < 160).sort((a, b) => Math.abs(a.y - row[0].y) - Math.abs(b.y - row[0].y))[0];
      if (l) { const k = /^S/i.test(l.t) ? 's' : 'f'; row.slice(0, 3).forEach((c, i) => put('death:' + k + (i + 1), { t: 'check', f: c.name, page: c.page })); }
    }

    // 3) spell rows: checkbox + line, grouped under a level header (slots box + free text)
    const sp = checks.filter((c) => !taken.has(c.name) && c.w <= 10 && tx.some((f) => f.page === c.page && !taken.has(f.name) && vOverlap(c, f) > 0.4 && f.x >= c.x && f.x - (c.x + c.w) <= 12));
    const spRows = sp.map((c) => ({ c, t: tx.filter((f) => f.page === c.page && vOverlap(c, f) > 0.4 && f.x >= c.x && f.x - (c.x + c.w) <= 12)[0] })).sort((a, b) => a.c.page - b.c.page || Math.round(a.c.x / 20) - Math.round(b.c.x / 20) || b.c.y - a.c.y);
    const runs = [];
    spRows.forEach((r) => { const run = runs[runs.length - 1], last = run && run[run.length - 1]; if (last && last.c.page === r.c.page && Math.abs(last.c.x - r.c.x) <= 15 && last.c.y - r.c.y >= 8 && last.c.y - r.c.y <= 16 && Math.abs(last.c.x - r.c.x) <= 15) run.push(r); else runs.push([r]); });
    // runs in the same column that continue each other are one level
    const levels = [];
    for (const run of runs) {
      const first = run[0], prev = levels.find((lv) => { const e = lv.rows[lv.rows.length - 1]; return e.c.page === first.c.page && Math.abs(e.c.x - first.c.x) <= 15 && e.c.y - first.c.y >= 8 && e.c.y - first.c.y <= 16; });
      prev ? prev.rows.push(...run) : levels.push({ rows: run.slice() });
    }
    for (const lv of levels) {
      const top = lv.rows[0], c0 = top.c;
      const hdr = tx.filter((f) => f.page === c0.page && !taken.has(f.name) && f.y - c0.y > 7 && f.y - c0.y <= 32 && f.x >= c0.x - 70 && f.x <= c0.x + 30);
      const hy = hdr.length ? Math.min(...hdr.map((f) => f.y)) : null, row = hy === null ? [] : hdr.filter((f) => Math.abs(f.y - hy) <= 3).sort((a, b) => a.x - b.x);
      const digit = row.length ? labels.find((l) => l.p === c0.page && /^[1-9]$/.test(l.t) && Math.abs(l.y - row[0].y) <= 8 && l.x < row[0].x + 4 && row[0].x - l.x <= 40) : null;
      const n = digit ? +digit.t : null;
      if (!n) { notes.push('A spell list on page ' + (c0.page + 1) + ' has no level number next to it, so it was left for you to match.'); continue; }
      lv.rows.forEach((r) => taken.add(r.t.name));
      put('spells:' + n, { t: 'spellrows', rows: lv.rows.map((r) => ({ f: r.t.name, cb: r.c.name, page: r.t.page })), fs: lv.rows.map((r) => r.t.name).concat(lv.rows.map((r) => r.c.name)), page: c0.page });
      const small = row.find((f) => f.w < 40);
      if (small) put('slots:' + n, { t: 'text', f: small.name, page: small.page });
    }

    // 4) attack table: columns of equal boxes under NAME / ATK / DAMAGE
    const rowsTx = tx.filter((f) => !taken.has(f.name) && f.h <= 16 && hasSibling(f, fields.filter((o) => o.kind === 'text')));
    const cols = [...groupBy(rowsTx, (f) => f.page + ':' + Math.round(f.x / 3) + ':' + Math.round(f.w / 3)).values()].filter((c) => c.length >= 3);
    const heads = labels.map((l) => ({ ...l })), usedHeads = new Set();
    const hd = cols.map((c) => { c.sort((a, b) => b.y - a.y); const top = c[0], h = heads.filter((l) => l.p === top.page && l.y >= top.y + top.h - 1 && l.y - top.y <= 40 && l.x < top.x + top.w && l.x + l.w > top.x - 6).sort((a, b) => a.y - b.y)[0]; if (h && /^(NAME|WEAPON|ATK|ATTACK|BONUS|DAMAGE)/i.test(h.t)) usedHeads.add(h.t + '@' + Math.round(h.x) + ',' + Math.round(h.y)); return { c, kind: h ? (/^(NAME|WEAPON)/i.test(h.t) ? 'name' : /^(ATK|ATTACK|BONUS)/i.test(h.t) ? 'bonus' : /^DAMAGE/i.test(h.t) ? 'dmg' : null) : null }; });
    const n = hd.length && Math.min(...hd.filter((h) => h.kind).map((h) => h.c.length));
    if (hd.filter((h) => h.kind).length >= 3 && n >= 3) hd.filter((h) => h.kind).forEach((h) => h.c.slice(0, n).forEach((f, i) => put('atk:' + (i + 1) + ':' + h.kind, { t: 'text', f: f.name, page: f.page })));

    // 5) everything else: nearest printed label, one box per label (ability boxes: two)
    const targets = [];
    const blockIds = new Set(stacks.map((s) => s.id));
    tx.filter((f) => !taken.has(f.name) && !blockIds.has(f.name)).forEach((f) => targets.push({ f: f.name, page: f.page, box: f, block: false }));
    stacks.forEach((s) => s.rect && targets.push({ f: s.id, page: s.page, box: { x: s.rect.x, y: s.rect.y, w: s.rect.w, h: s.rect.h }, block: true }));
    const pairs = [];
    lab.filter((l) => l.key && !usedHeads.has(l.t + '@' + Math.round(l.x) + ',' + Math.round(l.y))).forEach((l) => targets.forEach((t) => { if (t.page !== l.p) return; const d = dist(l, t.box), lim = t.block ? 34 : 24; if (d <= lim) pairs.push({ l, t, d: d + (t.block && !/^(features|traits|ideals|bonds|flaws|equipment|profs|backstory|allies|treasure|addfeat|cantrips)$/.test(l.key) ? 8 : 0) }); }));
    pairs.sort((a, b) => a.d - b.d);
    const usedT = new Set(), usedL = new Map();
    for (const p of pairs) {
      if (usedT.has(p.t.f) || taken.has(p.t.f)) continue;
      const k = p.l.key, isAb = k.startsWith('ab:'), cnt = usedL.get(p.l) || 0;
      if (cnt >= (isAb ? 2 : 1)) continue;
      if (/^coin:/.test(k) === false && p.t.block && k === 'spclass') continue;
      const key = isAb ? k + (cnt ? ':b' : ':a') : k;
      if (map[key]) continue;
      map[key] = { t: p.t.block ? 'block' : 'text', f: p.t.f, page: p.t.page };
      usedT.add(p.t.f); usedL.set(p.l, cnt + 1);
    }
    // ability boxes: the wider box is the modifier, the narrower the score (the user can swap this in the preview)
    for (const a of AB) {
      const A = map['ab:' + a + ':a'], B = map['ab:' + a + ':b'];
      if (A && B) { const fa = byName.get(A.f), fb = byName.get(B.f), big = fa.w >= fb.w ? A : B, small = big === A ? B : A; map['ab:' + a + ':mod'] = big; map['ab:' + a + ':score'] = small; }
      else if (A) map['ab:' + a + ':score'] = A;
      delete map['ab:' + a + ':a']; delete map['ab:' + a + ':b'];
    }
    return { map, notes };
  }

  /* ---------- prepare: the whole "upload" step ---------- */
  async function prepare(bytes, words) {
    let doc;
    try { doc = await L.PDFDocument.load(bytes); }
    catch (e) { return { ok: false, why: /encrypt/i.test(String(e && e.message)) ? 'locked' : 'unreadable' }; }
    const before = readFields(doc);
    if (!before.some((f) => f.kind === 'text')) return { ok: false, why: 'flat', pages: doc.getPageCount() };
    const stacks = findStacks(before);
    await convert(doc, stacks);
    const fields = readFields(doc), labels = mergeLabels(words || []), { map, notes } = autoMap(fields, stacks, labels);
    const taken = new Set(); Object.values(map).forEach((v) => (v.fs || [v.f, v.cb]).forEach((x) => x && taken.add(x)));
    const unmapped = fields.filter((f) => f.kind === 'text' && !taken.has(f.name)).map((f) => ({ f: f.name, page: f.page, x: f.x, y: f.y, w: f.w, h: f.h }));
    const pageSizes = doc.getPages().map((p) => ({ w: p.getWidth(), h: p.getHeight() }));
    return {
      ok: true, bytes: await doc.save(), pageSizes,
      plan: { v: 1, map, blocks: Object.fromEntries(stacks.map((s) => [s.id, { page: s.page, pitch: s.pitch, boxes: s.boxes, rect: s.rect }])), opts: { swapAbility: false } },
      stats: { fields: before.length, text: before.filter((f) => f.kind === 'text').length, checks: before.filter((f) => f.kind === 'check').length, stacks: stacks.length, linesMerged: stacks.reduce((n, s) => n + s.lines.length, 0), mapped: Object.keys(map).length, unmapped: unmapped.length },
      stacks: stacks.map((s) => ({ id: s.id, page: s.page, lines: s.lines.length, rect: s.rect })), unmapped, notes,
    };
  }

  /* ---------- fill ---------- */
  const safe = (font, s) => { const set = new Set(font.getCharacterSet()); return String(s == null ? '' : s).replace(/[\u2212\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\u00A0/g, ' ').split('').map((c) => (c === '\n' || set.has(c.codePointAt(0)) ? c : '?')).join(''); };
  function wrap(font, text, size, widths) {
    const out = []; let li = 0;
    for (const para of text.split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const room = (widths[Math.min(li, widths.length - 1)] || widths[widths.length - 1]) - 3, t = line ? line + ' ' + word : word;
        if (font.widthOfTextAtSize(t, size) <= room) line = t;
        else { if (line) { out.push(line); li++; } let w = word; const room2 = (widths[Math.min(li, widths.length - 1)]) - 3; while (font.widthOfTextAtSize(w, size) > room2 && w.length > 1) { let k = w.length - 1; while (k > 1 && font.widthOfTextAtSize(w.slice(0, k), size) > room2) k--; out.push(w.slice(0, k)); li++; w = w.slice(k); } line = w; }
      }
      out.push(line); li++;
    }
    return out;
  }

  /* values: { key: string | boolean | string[] }  ->  { bytes, items } ; items drive the readability check */
  async function fill(bytes, plan, values, opts) {
    opts = opts || {};
    const doc = await L.PDFDocument.load(bytes), form = doc.getForm(), font = await doc.embedFont(L.StandardFonts.Helvetica), items = [];
    const fields = new Map(readFields(doc).map((f) => [f.name, f])), V = Object.assign({}, values);
    if (plan.opts && plan.opts.swapAbility) AB.forEach((a) => { const m = V['ab:' + a + ':mod'], s = V['ab:' + a + ':score']; V['ab:' + a + ':mod'] = s; V['ab:' + a + ':score'] = m; });
    const MIN = opts.minSize || 5.5;
    const setText = (name, text, kind, key) => {
      const fb = fields.get(name); if (!fb) return;
      const tf = form.getTextField(name); text = safe(font, text);
      if (!text) { tf.setText(''); return; }
      if (kind === 'block') {
        const blk = plan.blocks[name], cap = blk.boxes.length, spaceW = font.widthOfTextAtSize(' ', 1), minX = Math.min(...blk.boxes.map((b) => b.x));
        const lh = font.heightAtSize(1), fit = Math.min(9, blk.pitch / lh);
        let size = fit, lines;
        for (; ; size -= 0.25) {
          const widths = blk.boxes.map((b) => b.w - (b.x - minX));
          lines = wrap(font, text, size, widths);
          if (lines.length <= cap || size <= MIN) break;
        }
        const shown = lines.slice(0, cap), cut = lines.length - shown.length;
        const ind = shown.map((l, i) => (i < blk.boxes.length && blk.boxes[i].x - minX > 4 ? ' '.repeat(Math.round((blk.boxes[i].x - minX) / (spaceW * size))) : '') + l);
        tf.setText(ind.join('\n')); tf.setFontSize(size);
        items.push({ key, field: name, page: fb.page, box: { x: fb.x, y: fb.y, w: fb.w, h: fb.h }, size, status: cut > 0 ? 'clipped' : size < 6.5 ? 'small' : 'ok', note: cut > 0 ? cut + ' line' + (cut > 1 ? 's' : '') + ' did not fit' : '', text });
        return;
      }
      text = text.replace(/\s*\n+\s*/g, ' '); // a single-line box cannot hold a line break
      const room = fb.w - 3, hmax = Math.min(11, fb.h - 1.5);
      let size = hmax; while (size > MIN && font.widthOfTextAtSize(text, size) > room) size -= 0.25;
      const clipped = font.widthOfTextAtSize(text, size) > room;
      tf.setText(text); tf.setFontSize(size);
      items.push({ key, field: name, page: fb.page, box: { x: fb.x, y: fb.y, w: fb.w, h: fb.h }, size, status: clipped ? 'clipped' : size < 6.5 ? 'small' : 'ok', note: clipped ? 'text is wider than its box' : '', text });
    };
    for (const [key, m] of Object.entries(plan.map)) {
      const v = V[key];
      if (v === undefined || v === null) continue;
      if (m.t === 'bonus') { setText(m.f, v.bonus !== undefined ? v.bonus : v, 'text', key); if (m.cb && v.prof !== undefined) { const cb = form.getCheckBox(m.cb); v.prof ? cb.check() : cb.uncheck(); } }
      else if (m.t === 'check') { const cb = form.getCheckBox(m.f); v ? cb.check() : cb.uncheck(); }
      else if (m.t === 'spellrows') (Array.isArray(v) ? v : []).slice(0, m.rows.length).forEach((s, i) => { const nm = typeof s === 'string' ? s : s.name; setText(m.rows[i].f, nm, 'text', key + '#' + (i + 1)); if (typeof s === 'object' && s.prepared !== undefined) { const cb = form.getCheckBox(m.rows[i].cb); s.prepared ? cb.check() : cb.uncheck(); } });
      else setText(m.f, Array.isArray(v) ? v.join('\n') : String(v), m.t, key);
    }
    form.updateFieldAppearances(font);
    return { bytes: await doc.save(), items };
  }

  /* a flattened copy: the boxes become part of the page, so every viewer and pdf.js draws exactly what is stored */
  async function flatten(bytes) { const d = await L.PDFDocument.load(bytes); d.getForm().flatten(); return d.save(); }

  /* ---------- verify ---------- */
  /* before / after: { data: RGBA bytes, width, height } of the same page, rendered at `scale` pixels per point (page height in points: ph) */
  function ink(before, after, box, scale, ph) {
    const x0 = Math.max(0, Math.floor(box.x * scale)), x1 = Math.min(after.width, Math.ceil((box.x + box.w) * scale)), y0 = Math.max(0, Math.floor((ph - box.y - box.h) * scale)), y1 = Math.min(after.height, Math.ceil((ph - box.y) * scale));
    let n = 0, tot = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * after.width + x) * 4; tot++; if (Math.abs(after.data[i] - before.data[i]) + Math.abs(after.data[i + 1] - before.data[i + 1]) + Math.abs(after.data[i + 2] - before.data[i + 2]) > 120) n++; }
    return { ink: n, area: tot, ratio: tot ? n / tot : 0 };
  }
  /* turns the fill items into a list the person can read. render(bytes,pageIndex) -> Promise<{data,width,height}> */
  async function verify(templateBytes, filledBytes, items, pageSizes, render, scale) {
    scale = scale || 2;
    const flatT = await flatten(templateBytes), flatF = await flatten(filledBytes), cache = new Map(), issues = [];
    const page = async (tag, b, p) => { const k = tag + p; if (!cache.has(k)) cache.set(k, await render(b, p)); return cache.get(k); };
    for (const it of items) {
      if (!String(it.text || '').trim()) continue;
      const a = await page('t', flatT, it.page), b = await page('f', flatF, it.page), r = ink(a, b, it.box, scale, pageSizes[it.page].h);
      const blank = r.ink < Math.max(4, r.area * 0.004);
      let status = it.status;
      if (blank) status = 'blank';
      if (status !== 'ok') issues.push({ key: it.key, page: it.page, box: it.box, status, size: Math.round(it.size * 10) / 10, note: blank ? 'nothing visible was drawn here' : it.note, text: it.text.slice(0, 60) });
    }
    return { ok: issues.every((i) => i.status === 'small'), checked: items.length, issues };
  }

  const api = { labelKey, mergeLabels, wordsFromPdfJs, readFields, findStacks, convert, autoMap, prepare, fill, flatten, verify, ink, SKILLS, SAVES, AB };
  g.HSCustom = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
