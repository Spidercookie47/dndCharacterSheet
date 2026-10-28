/* Spell cards: builds card pages and appends them to the filled character sheet. */
const CARD = { w: 180, h: 252, cols: 3, rows: 3, pad: 8, pageW: 612, pageH: 792 }; // poker size, 9 per letter page
const INCLUDE_CANTRIPS = true; // cantrips are always ready, so they get cards too

/* ---- text helpers (the built-in PDF fonts only handle Latin-1) ---- */
function pdfText(s) {
  return String(s == null ? '' : s)
    .replace(/<\s*br\s*\/?>|<\/(p|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '-')
    .replace(/[^\n\x20-\x7E\u00A0-\u00FF]/g, '');
}

function wrapLines(text, font, size, maxW) {
  const out = [];
  text.split('\n').forEach((para) => {
    if (!para.trim()) {
      out.push('');
      return;
    }
    let line = '';
    para
      .split(/\s+/)
      .filter(Boolean)
      .forEach((w) => {
        const t = line ? line + ' ' + w : w;
        if (font.widthOfTextAtSize(t, size) <= maxW) line = t;
        else {
          if (line) out.push(line);
          line = w;
        }
      });
    out.push(line);
  });
  return out;
}

/* ---- turn a spell element into plain card text ---- */
function spellView(e) {
  const g = (...keys) => {
    for (const k of keys) if (e[k] != null && e[k] !== '') return e[k];
    return '';
  };
  const s = (v) => pdfText(Array.isArray(v) ? v.join(', ') : v);
  const lvl = Number(g('level', 'lvl')) || 0;
  const ord = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'][lvl] || lvl + 'th';
  const school = s(g('school'));
  const ritual = g('ritual') === true || /ritual/i.test(s(g('time', 'casting', 'castingTime')));
  const sub = (lvl === 0 ? school + ' cantrip' : ord + '-level ' + school.toLowerCase()) + (ritual ? ' (ritual)' : '');
  return {
    name: s(e.name),
    level: lvl,
    sub: sub.trim().replace(/^./, (c) => c.toUpperCase()),
    stats: [
      ['Casting Time', s(g('time', 'casting', 'castingTime', 'cast'))],
      ['Range', s(g('range'))],
      ['Components', s(g('components', 'comp'))],
      ['Duration', s(g('duration', 'dur'))],
    ].filter((x) => x[1]),
    body:
      pdfText(g('desc', 'description', 'text')) +
      (g('higher', 'atHigherLevels') ? '\n\nAt Higher Levels. ' + pdfText(g('higher', 'atHigherLevels')) : ''),
  };
}

/* ---- lay one spell out as one or more cards ---- */
function cardsFor(v, F) {
  const inner = CARD.w - CARD.pad * 2;
  const statSize = 6.5;
  const statRows = v.stats.map(([label, val]) => {
    const lw = F.bold.widthOfTextAtSize(label + ': ', statSize);
    return { label, lw, lines: wrapLines(val, F.font, statSize, inner - lw) };
  });
  const statLines = statRows.reduce((n, r) => n + r.lines.length, 0);
  const headH = CARD.pad + 12 + 10 + 6 + statLines * 8 + 6;
  const bodyH = CARD.h - headH - CARD.pad;

  let size = 5.5,
    lines;
  for (const sz of [7.5, 7, 6.5, 6, 5.5]) {
    const ls = wrapLines(v.body, F.font, sz, inner);
    if (ls.length * sz * 1.2 <= bodyH || sz === 5.5) {
      size = sz;
      lines = ls;
      break;
    }
  }
  const cap = Math.max(1, Math.floor(bodyH / (size * 1.2)));
  const chunks = [];
  for (let i = 0; i < lines.length; i += cap) chunks.push(lines.slice(i, i + cap));
  if (!chunks.length) chunks.push([]);
  return chunks.map((c, i) => ({ v, statRows, statSize, size, lines: c, part: i + 1, parts: chunks.length }));
}

/* ---- draw one card; (x, yTop) is its top-left corner ---- */
function drawCard(page, F, x, yTop, c) {
  const { rgb } = F.lib;
  const inner = CARD.w - CARD.pad * 2;
  page.drawRectangle({
    x,
    y: yTop - CARD.h,
    width: CARD.w,
    height: CARD.h,
    borderColor: rgb(0.55, 0.55, 0.55),
    borderWidth: 0.5,
  });
  let y = yTop - CARD.pad - 10;
  let title = c.v.name + (c.parts > 1 ? ' (' + c.part + '/' + c.parts + ')' : '');
  let ts = 11;
  while (ts > 7 && F.bold.widthOfTextAtSize(title, ts) > inner) ts -= 0.5;
  page.drawText(title, { x: x + CARD.pad, y, size: ts, font: F.bold });
  y -= 10;
  page.drawText(c.v.sub, { x: x + CARD.pad, y, size: 7, font: F.ital, color: rgb(0.3, 0.3, 0.3) });
  y -= 6;
  page.drawLine({
    start: { x: x + CARD.pad, y },
    end: { x: x + CARD.w - CARD.pad, y },
    thickness: 0.5,
    color: rgb(0.55, 0.55, 0.55),
  });
  y -= 3;
  c.statRows.forEach((r) => {
    r.lines.forEach((ln, i) => {
      y -= 8;
      if (i === 0) page.drawText(r.label + ':', { x: x + CARD.pad, y, size: c.statSize, font: F.bold });
      page.drawText(ln, { x: x + CARD.pad + r.lw, y, size: c.statSize, font: F.font });
    });
  });
  y -= 9;
  c.lines.forEach((ln) => {
    y -= c.size * 1.2;
    if (ln) page.drawText(ln, { x: x + CARD.pad, y, size: c.size, font: F.font });
  });
}

/* ---- append the cards to an existing PDF (bytes in, bytes out) ---- */
async function addSpellCards(lib, sheetBytes, spells) {
  const items = typeof equippedItems === 'function' ? equippedItems() : [];
  if (!spells.length && !items.length) return sheetBytes;
  const doc = await lib.PDFDocument.load(sheetBytes);
  const F = {
    lib,
    font: await doc.embedFont(lib.StandardFonts.Helvetica),
    bold: await doc.embedFont(lib.StandardFonts.HelveticaBold),
    ital: await doc.embedFont(lib.StandardFonts.HelveticaOblique),
  };
  const spellViews = spells
    .map(spellView)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  const cards = spellViews.concat(items).flatMap((v) => cardsFor(v, F)); // spells first, then item cards
  const per = CARD.cols * CARD.rows;
  const mx = (CARD.pageW - CARD.cols * CARD.w) / 2,
    my = (CARD.pageH - CARD.rows * CARD.h) / 2;
  for (let i = 0; i < cards.length; i += per) {
    const page = doc.addPage([CARD.pageW, CARD.pageH]);
    cards.slice(i, i + per).forEach((c, j) => {
      drawCard(page, F, mx + (j % CARD.cols) * CARD.w, CARD.pageH - my - Math.floor(j / CARD.cols) * CARD.h, c);
    });
  }
  return await doc.save();
}

/* ---- which spells get a card ----
   Mirrors spellFill() in casting.js: cantrips, domain/oath spells, feature and racial spells,
   plus prepared spells (or known spells for "known" casters like Bard, Sorcerer, Warlock). */
function preparedSpells() {
  const r = resolve(ch),
    I = idx(),
    ids = new Set();
  featSpells(r).forEach((s) => ids.add(s.id));
  casters(r).forEach((n) => {
    const st = spOf(n);
    st.c.forEach((id) => ids.add(id));
    domOf(r, n).forEach((id) => ids.add(id));
    (MODE[n] === 'known' ? st.k : st.p).forEach((id) => ids.add(id));
  });
  return [...ids].map((id) => I[id]).filter((s) => s && (INCLUDE_CANTRIPS || s.lvl > 0));
}

/* ---- item cards: equipped weapons, attuned/equipped magic items, equipped potions ----
   Order: magic weapons, weapons, magic items, potions. Plain gear and armor get no card.
   A potion only gets a card when you press Equip on it in the Inventory (that is the "important" marker). */
function itemView(x, r, c, soloWeapon) {
  const e = x.e,
    q = x.i.q || 1,
    kind = pdfText(e.cg || e.type || 'Item').replace(/s$/, '');
  const stats = [];
  const dm = (e.desc || '').match(/Damage (\d+d\d+) (\w+)/);
  if (e.type === 'Weapon' && dm) {
    const d = e.desc,
      rng = /Ammunition/.test(d),
      fin = /Finesse/.test(d),
      k = rng ? 'dex' : fin && c.sc.dex > c.sc.str ? 'dex' : 'str',
      m = mod(c.sc[k]),
      mw = magicB(ch).wpn,
      ar = rng && r.els.some((y) => y.type === 'Fighting Style' && y.name === 'Archery') ? 2 : 0,
      du =
        !rng && soloWeapon && !/Two-handed|Heavy/.test(d) && r.els.some((y) => y.type === 'Fighting Style' && y.name === 'Dueling')
          ? 2
          : 0;
    stats.push(['Attack', sg(m + (profW(r, e) ? c.pb : 0) + ar + mw)]);
    stats.push(['Damage', dm[1] + sg(m + du + mw) + ' ' + dm[2]]);
  }
  if (e.wt) stats.push(['Weight', e.wt + ' lb']);
  return {
    name: pdfText(e.name),
    level: 0,
    sub: kind + (e.rar ? ', ' + pdfText(e.rar) : '') + (e.att ? ' (requires attunement)' : '') + (q > 1 ? ' x' + q : ''),
    stats,
    body: pdfText(e.desc),
  };
}
function equippedItems() {
  const r = resolve(ch),
    c = calc(ch, r),
    rows = (ch.inv || []).map((i) => ({ i, e: ent(i) })).filter((x) => x.e && x.e.type);
  const byName = (a, b) => String(a.e.name).localeCompare(String(b.e.name));
  const eqW = rows.filter((x) => x.e.type === 'Weapon' && x.i.eq);
  const groups = [
    rows.filter((x) => x.e.cg === 'Magic Weapons' && (x.i.eq || x.i.att)),
    eqW,
    rows.filter(
      (x) =>
        x.e.type === 'Magic' && !['Magic Weapons', 'Potions'].includes(x.e.cg) && (x.i.att || x.i.eq),
    ),
    rows.filter((x) => x.e.cg === 'Potions' && x.i.eq),
  ];
  return groups.flatMap((g) => g.sort(byName)).map((x) => itemView(x, r, c, eqW.length === 1));
}
