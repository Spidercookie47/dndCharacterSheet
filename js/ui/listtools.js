/* List tools: sorting, search and small filters for the pick lists (race, class, background, feats).
   Load after events.js (needs on) and before build.js / asi.js render anything. */
const LF_NAMES = { race: 'races', class: 'classes', bg: 'backgrounds', feat: 'feats', lang: 'languages' };
const LF_SORTS = [
  ['az', 'A–Z (all books together)'],
  ['za', 'Z–A'],
  ['src', 'Group by source book'],
  ['chosen', 'Chosen first, then A–Z'],
  ['pack', 'Original pack order'],
];
const lf = { sort: 'az', q: {}, cat: '' }; // sort mode, search text per list, feat category filter
try {
  const s = localStorage.getItem('hs-sort');
  if (s && LF_SORTS.some((x) => x[0] === s)) lf.sort = s;
} catch (e) {}

const lfKey = () => (tab === 'build' && sub === 'asi' ? 'feat' : sub);
const lfN = (o) => esc(((o.name || '') + ' ' + (o.src || '')).toLowerCase()); // text the search matches against
const lfCatOk = (f) => !lf.cat || (lf.cat === 'origin' ? f.cls === 'origin' : !f.cls || f.cls === 'general');

const lfCmp = (a, b) =>
  (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true }) ||
  (a.src || '').localeCompare(b.src || '');

/* Sort a list of elements, then render each with row(o). In "group by source" mode a small header is added per book. */
function lfRows(list, chosen, row) {
  const L = [...list];
  if (lf.sort === 'pack') return L.map(row).join('');
  if (lf.sort === 'za') return L.sort((a, b) => lfCmp(b, a)).map(row).join('');
  if (lf.sort === 'chosen')
    return L.sort((a, b) => chosen.includes(b.id) - chosen.includes(a.id) || lfCmp(a, b))
      .map(row)
      .join('');
  if (lf.sort === 'src') {
    const g = new Map();
    L.sort((a, b) => (a.src || '').localeCompare(b.src || '') || lfCmp(a, b)).forEach((o) => {
      const k = o.src || 'Other';
      if (!g.has(k)) g.set(k, []);
      g.get(k).push(o);
    });
    return [...g]
      .map(([k, os]) => `<div class="src lf-h" style="padding:8px 4px 2px;font-weight:600">${esc(k)}</div>${os.map(row).join('')}`)
      .join('');
  }
  return L.sort(lfCmp).map(row).join('');
}

/* The sort box and search box (plus a category filter for feats). */
function lfBar(key) {
  return (
    `<select data-lfs title="Sort the list" style="width:auto">${LF_SORTS.map(([v, n]) => `<option value="${v}"${lf.sort === v ? ' selected' : ''}>${n}</option>`).join('')}</select>` +
    (key === 'feat'
      ? `<select data-lfc title="Feat category" style="width:auto"><option value="">All categories</option><option value="general"${lf.cat === 'general' ? ' selected' : ''}>General feats</option><option value="origin"${lf.cat === 'origin' ? ' selected' : ''}>Origin feats</option></select>`
      : '') +
    `<input type="text" data-lfq="${key}" placeholder="Search ${LF_NAMES[key] || 'list'}…" value="${esc(lf.q[key] || '')}" style="max-width:240px">`
  );
}

/* Hide rows that do not match the search text. Works on the DOM so typing never rebuilds the page or loses focus. */
function lfApply() {
  const m = $('#main');
  if (!m) return;
  const q = (lf.q[lfKey()] || '').trim().toLowerCase();
  m.querySelectorAll('[data-lfn]').forEach((el) => {
    el.style.display = !q || el.dataset.lfn.includes(q) ? '' : 'none';
  });
  m.querySelectorAll('.lf-h').forEach((h) => {
    let n = h.nextElementSibling,
      vis = false;
    while (n && !n.classList.contains('lf-h') && !n.classList.contains('ph')) {
      if (n.dataset.lfn !== undefined && n.style.display !== 'none') vis = true;
      n = n.nextElementSibling;
    }
    h.style.display = vis ? '' : 'none';
  });
}

document.addEventListener('input', (e) => {
  const t = e.target;
  if (!t.dataset || t.dataset.lfq === undefined) return;
  lf.q[t.dataset.lfq] = t.value;
  lfApply();
});
document.addEventListener('change', (e) => {
  const t = e.target,
    d = t.dataset;
  if (!d) return;
  if ('lfs' in d) {
    lf.sort = t.value;
    try {
      localStorage.setItem('hs-sort', lf.sort);
    } catch (err) {}
    draw();
  } else if ('lfc' in d) {
    lf.cat = t.value;
    draw();
  }
});

/* "Change feat" on an improvement slot: forget the chosen feat so the full list comes back. */
on('asifclear', (d) => {
  const c = ch.asi && ch.asi[d.k];
  if (c) delete c.f;
});
