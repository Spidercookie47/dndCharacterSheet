/* Levels, hit points, multiclass requirements, languages and proficiency text. */
const avgHp = (hd) => Math.floor(hd / 2) + 1,
  pl = () => classLevels(ch)[ch.cls] || ch.level;
function ensureLv(c) {
  c.opt = c.opt || { avg: false, feats: true, multi: true };
  const I = idx();
  if (!c.lv || !c.lv.length) {
    c.lv = [];
    const hd = (I[c.cls] || {}).hd || 8;
    for (let i = 0; i < (c.level || 1); i++) c.lv.push({ c: c.cls || '', v: avgHp(hd) });
  }
  const o = c.lv[0].c;
  if (c.cls && o !== c.cls)
    c.lv.forEach((e) => {
      if (e.c === o) e.c = c.cls;
    });
  c.level = c.lv.length;
  return c;
}
function classLevels(c) {
  ensureLv(c);
  const o = {};
  c.lv.forEach((e) => {
    o[e.c] = (o[e.c] || 0) + 1;
  });
  return o;
}
function hpCalc(c, cm, hpl) {
  ensureLv(c);
  const I = idx();
  return c.lv.reduce((s, e, i) => {
    const hd = (I[e.c] || {}).hd || 8,
      b = i === 0 ? hd : c.opt.avg ? avgHp(hd) : Math.min(hd, Math.max(1, e.v));
    return s + Math.max(1, b + cm + hpl);
  }, 0);
}
const preOk = (x, sc) => {
  const p = PRE[x];
  return !p || (p[0] === '&' ? p.slice(1).every((a) => sc[a] >= 13) : p.some((a) => sc[a] >= 13));
};
const preTxt = (x) => {
  const p = PRE[x],
    a = p[0] === '&';
  return (
    p
      .filter((q) => q !== '&')
      .map((q) => AN[q])
      .join(a ? ' and ' : ' or ') + ' 13'
  );
};
function langList(r) {
  const s = new Set(),
    o = [];
  r.langs.forEach(({ id, pk }) => {
    const n = id.slice(9);
    if (!s.has(n)) {
      s.add(n);
      o.push(n);
    }
  });
  return o;
}
function profText(r, L) {
  const g = { a: [], w: [], t: [] };
  [...r.pfs].forEach((x) => g[x[0]].push(x.slice(2)));
  return Object.entries(g)
    .filter(([, v]) => v.length)
    .map(([k, v]) => PFN[k] + ': ' + v.join(', '))
    .concat(L.length ? ['Languages: ' + L.join(', ')] : [])
    .join('\n');
}
const armorOk = (r, e) => r.pfs.has('a:' + (e.kind === 'Shield' ? 'Shields' : e.kind + ' armor'));
function profW(r, e) {
  const w = [...r.pfs].filter((x) => x[0] === 'w').map((x) => x.slice(2).toLowerCase().replace(/s$/, '')),
    n = e.name.toLowerCase().replace(/s$/, '');
  return (
    (e.cat === 'simple' && w.includes('simple weapon')) ||
    (e.cat === 'martial' && w.includes('martial weapon')) ||
    w.includes(n)
  );
}
