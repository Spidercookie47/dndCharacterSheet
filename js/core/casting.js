/* Spellcasting rules: slots (including multiclass), spells known and prepared, domain and feature spells. */
const casters = (r) =>
  Object.keys(classLevels(ch))
    .map((k) => (idx()[k] || {}).name)
    .filter((n) => CLX[n] && (!SUBC[n] || r.els.some((e) => e.id === SUBC[n])));
const clv = (n) => classLevels(ch)['Class:' + n] || 0,
  abOf = (n, c) => mod(c.sc[CA[n]]),
  cantN = (n) => CLX[n][clv(n) - 1][0],
  knownN = (n) => (KN[n] ? KN[n][clv(n) - 1] : 0),
  bookN = (n) => 6 + 2 * (clv(n) - 1),
  prepN = (n, c) =>
    PT[n] ? PT[n][clv(n) - 1] || 0 : Math.max(1, abOf(n, c) + (n === 'Paladin' ? Math.floor(clv(n) / 2) : clv(n)));
const isW = (n) => n === 'Warlock' || n === 'Warlock (5.2)'; // Pact Magic classes from either edition
function slotsFor(r) {
  const cs = casters(r),
    nw = cs.filter((n) => !isW(n));
  let sl = Array(9).fill(0),
    comb = false;
  if (nw.length === 1) sl = CLX[nw[0]][clv(nw[0]) - 1].slice(1);
  else if (nw.length > 1) {
    comb = true;
    const L = nw.reduce(
      (s, n) =>
        s +
        (HALF[n] === 3
          ? Math.floor(clv(n) / 3)
          : HALF[n]
            ? HALF[n] === 2
              ? Math.ceil(clv(n) / 2)
              : Math.floor(clv(n) / 2)
            : clv(n)),
      0,
    ); // 5.2 half casters round up
    if (L > 0) sl = CLX.Cleric[Math.min(20, L) - 1].slice(1);
  }
  let pact = null;
  const wn = cs.find(isW);
  if (wn) {
    const w = CLX[wn][clv(wn) - 1].slice(1),
      i = w.findIndex((x) => x > 0);
    if (i >= 0) pact = { n: w[i], l: i + 1 };
  }
  return { sl, comb, pact };
}
function topLv(n, r) {
  const s = slotsFor(r);
  if (isW(n)) return s.pact ? s.pact.l : 0;
  let t = 0;
  s.sl.forEach((x, i) => {
    if (x) t = i + 1;
  });
  return t;
}
function domOf(r, n) {
  const o = [];
  r.els.forEach((e) => {
    const d = DOM2[e.id];
    if (d && d.c === n)
      Object.entries(d).forEach(([k, v]) => {
        if (k !== 'c' && +k <= clv(n)) o.push(...v.map((x) => (x.includes(':') ? x : 'Spell:' + x)));
      });
  });
  return o;
}
function spOf(n) {
  ch.sp = ch.sp || {};
  if (Array.isArray(ch.sp.c)) {
    const o = ch.sp;
    ch.sp = {};
    ch.sp[(idx()[ch.cls] || {}).name || 'Cleric'] = { c: o.c || [], k: [], p: o.p || [] };
  }
  return (ch.sp[n] = ch.sp[n] || { c: [], k: [], p: [] });
}
function toggleSpell(id) {
  const r = resolve(ch),
    c = calc(ch, r),
    s = idx()[id],
    cs = casters(r);
  if (!cs.length || !s) return;
  if (!cs.includes(spc)) spc = cs[0];
  const n = msp === 'cast' ? spc : msp;
  if (!cs.includes(n)) return;
  const st = spOf(n),
    md = MODE[n],
    tl = topLv(n, r),
    inCast = msp === 'cast',
    flip = (a, max, msg) => {
      const i = a.indexOf(id);
      if (i >= 0) a.splice(i, 1);
      else if (a.length < max) a.push(id);
      else note(msg);
    };
  if (!inList(s, n, r)) {
    const off = st.k.filter((x) => idx()[x] && !inList(idx()[x], n, r)).length;
    if (!(n === 'Bard' && msp === 'cast' && s.lvl > 0 && (st.k.includes(id) || off < secretsN(r)))) {
      note(s.name + ' is not on the ' + n + ' spell list.');
      return;
    }
  }
  if (s.lvl === 0) {
    if (!cantN(n)) {
      note(n + ' has no cantrips.');
      return;
    }
    flip(st.c, cantN(n), 'You know ' + cantN(n) + ' cantrips at this level. Remove one first.');
    return;
  }
  if (s.lvl > tl) {
    note('You have no spell slots of level ' + s.lvl + ' yet.');
    return;
  }
  if (md === 'prep' || (md === 'book' && !inCast)) {
    if (domOf(r, n).includes(id)) {
      note('Domain and oath spells are always prepared.');
      return;
    }
    if (md === 'book' && !st.k.includes(id)) {
      note('Add it to your spellbook first on the Spellcasting tab.');
      return;
    }
    flip(st.p, prepN(n, c), 'You can prepare ' + prepN(n, c) + ' spells. Unprepare one first.');
    return;
  }
  if (md === 'book') {
    flip(st.k, bookN(n), 'Your spellbook holds ' + bookN(n) + ' spells at this level.');
    if (!st.k.includes(id)) {
      const i = st.p.indexOf(id);
      if (i >= 0) st.p.splice(i, 1);
    }
    return;
  }
  if (inCast) flip(st.k, knownT(n, r), 'You know ' + knownT(n, r) + ' spells. Remove one first.');
  else note('Change your known spells on the Spellcasting tab.');
}
function spellFill(r, c) {
  const cs = casters(r),
    tx = {},
    ck = [];
  if (!cs.length && !featSpells(r).length) return { tx, ck };
  const I = idx(),
    S = slotsFor(r),
    B = Array.from({ length: 10 }, () => new Set());
  featSpells(r).forEach((s) => {
    if (I[s.id]) B[I[s.id].lvl].add(s.id);
  });
  cs.forEach((n) => {
    const st = spOf(n),
      md = MODE[n];
    st.c.forEach((id) => B[0].add(id));
    domOf(r, n).forEach((id) => I[id] && B[I[id].lvl].add(id));
    (md === 'known' ? st.k : st.p).forEach((id) => I[id] && B[I[id].lvl].add(id));
  });
  for (let l = 0; l <= 9; l++) {
    const ls = SPF[l] || [],
      ids = [...B[l]].filter((id) => I[id]).sort((a, b) => I[a].name.localeCompare(I[b].name));
    ids.slice(0, ls.length).forEach((id, i) => {
      tx[ls[i].f] = I[id].name;
      if (l > 0 && ls[i].b) ck.push(ls[i].b);
    });
    const tot = (l > 0 ? S.sl[l - 1] || 0 : 0) + (S.pact && S.pact.l === l ? S.pact.n : 0);
    if (l > 0 && tot && SLT[l]) tx[SLT[l]] = String(tot);
  }
  return { tx, ck };
}
function casterInfo(r, c) {
  const cs = casters(r);
  if (!cs.length) return null;
  const n = cs[0];
  return {
    cls: cs.map((x) => x.replace(/ \(5\.2\)$/, '')).join(' / '),
    ab: CA[n].toUpperCase(),
    dc: 8 + c.pb + abOf(n, c),
    atk: c.pb + abOf(n, c) + magicB(ch).spA,
  };
}
const secretsN = (r) => {
  const l = clv('Bard');
  return (
    (l >= 10 ? 2 : 0) +
    (l >= 14 ? 2 : 0) +
    (l >= 18 ? 2 : 0) +
    (r.els.some((e) => e.id === 'Subclass:College of Lore') && l >= 6 ? 2 : 0)
  );
};
const knownT = (n, r) => knownN(n) + (n === 'Bard' ? secretsN(r) : 0);
function inList(s, n, r) {
  if (s.lists.includes(LN[n] || n)) return true;
  return Object.entries(EXP).some(
    ([k, v]) => v.c === n && v.list.includes(s.name) && r.els.some((e) => e.id === k),
  );
}
function featSpells(r) {
  const o = [],
    I = idx();
  Object.entries(FS).forEach(([id, l]) => {
    if (r.els.some((e) => e.id === id))
      l.forEach(([lv, n, note]) => {
        const sid = n.includes(':') ? n : 'Spell:' + n; // 5.2 content gives full spell ids
        if (ch.level >= lv && I[sid]) o.push({ id: sid, name: I[sid].name, note });
      });
  });
  r.sels
    .filter((s) => s.kind === 'Spell')
    .forEach((s) =>
      s.chosen.forEach((id) => I[id] && o.push({ id, name: I[id].name, note: 'cantrip, Intelligence' })),
    );
  return o;
}
