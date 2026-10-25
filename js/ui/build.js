/* Build tab: race, class, background, ability scores, languages and proficiencies. */
const rows = (opts, key, chosen) =>
  opts
    .map(
      (o) =>
        `<div class="rw${chosen.includes(o.id) ? ' on' : ''}${pv && pv.id === o.id && pv.k === key ? ' pv' : ''}" data-a="pv" data-id="${esc(o.id)}" data-k="${esc(key)}"><span>${chosen.includes(o.id) ? '✓ ' : ''}${esc(o.name)}</span><span class="src">SRD</span></div>`,
    )
    .join('');
function root(t, k, ty) {
  const e = idx()[ch[k]];
  return (
    `<div class="ph"><span>${t}</span></div>` +
    (e
      ? `<div class="rw on" data-a="pv" data-id="${esc(e.id)}" data-k="${k}"><span>✓ ${esc(e.name)}</span><span class="src">SRD<b class="x" data-a="rm" data-k="${k}" title="Remove">✕</b></span></div>`
      : rows(ofType(ty), k, []))
  );
}
const selPanel = (s) =>
  `<div class="ph"><span>${esc(s.name)} · ${esc(s.owner)}</span><span>${s.chosen.length}/${s.n}</span></div>` +
  rows(s.opts, s.key, s.chosen);
function choose(k, id) {
  if (ROOT.race && ['race', 'cls', 'bg'].includes(k)) {
    ch[k] = id;
    pv = null;
    return;
  }
  const cur = ch.picks[k] || [],
    s = resolve(ch).sels.find((x) => x.key === k),
    n = s ? s.n : 1;
  ch.picks[k] =
    n === 1 ? [id] : cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < n ? [...cur, id] : cur;
}
function baseDescPane() {
  const I = idx();
  let e =
    pv &&
    (I[pv.id] ||
      (/^skill:/.test(pv.id)
        ? { name: pv.id.slice(6), desc: 'Skill (' + AN[SK[pv.id.slice(6)]] + ').', rules: [] }
        : null));
  if (!e)
    return '<p class="hint">Click a row to read what it gives you. Double-click it, or press Select, to choose it.</p>';
  const root_ = ['race', 'cls', 'bg'].includes(pv.k),
    on = root_ ? ch[pv.k] === pv.id : (ch.picks[pv.k] || []).includes(pv.id);
  return (
    describe(e) +
    `<p><button data-a="pick" data-id="${esc(pv.id)}" data-k="${esc(pv.k)}"${on && root_ ? ' disabled' : ''}>${on ? (root_ ? 'Selected' : 'Remove') : 'Select'}</button></p>`
  );
}
function descPane() {
  const e = pv && pv.k !== 'item' && idx()[pv.id];
  if (!e || !INFO[e.id]) return baseDescPane();
  const ro = ['race', 'cls', 'bg'].includes(pv.k),
    on = ro ? ch[pv.k] === pv.id : (ch.picks[pv.k] || []).includes(pv.id);
  return (
    `<h2>${esc(e.name)}</h2><p><button data-a="pick" data-id="${esc(pv.id)}" data-k="${esc(pv.k)}"${on && ro ? ' disabled' : ''}>${on ? (ro ? 'Selected' : 'Remove') : 'Select'}</button></p>` +
    (INFO[e.id][0] === '<' ? INFO[e.id] : rich(INFO[e.id]))
  );
}
const KP = (r) =>
  [...r.prof]
    .map((p) => (p.startsWith('save:') ? AN[p.slice(5)] + ' saving throw' : p.slice(6)))
    .concat([...r.pfs].map((x) => PFN[x[0]] + ': ' + x.slice(2)));
function abTab() {
  const r = resolve(ch),
    pts = AB.reduce(
      (t, a) => t + ({ 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }[ch.ab[a]] ?? 99),
      0,
    );
  return `<div class="bar">${[
    ['array', 'Standard array'],
    ['buy', 'Point buy'],
    ['roll', 'Roll 4d6, drop lowest'],
  ]
    .map(
      ([m, n]) => `<button class="${ch.method === m ? '' : 'alt'}" data-a="meth" data-v="${m}">${n}</button>`,
    )
    .join('')}${ch.method === 'buy' ? `<span class="hint">${27 - pts} of 27 points left</span>` : ''}</div>
 <div class="abs">${AB.map((a) => {
   const b = r.stats[a] || 0,
     t = ch.ab[a] + b;
   return `<div class="abc"><small>${AN[a]}</small><b>${t}</b><span class="m">${sg(mod(t))}</span><div><button data-a="ab" data-k="${a}" data-d="-1">▼</button> <button data-a="ab" data-k="${a}" data-d="1">▲</button></div><small>base ${ch.ab[a]}${b ? ' · race ' + sg(b) : ''}</small></div>`;
 }).join('')}</div>`;
}
function expHtml(r) {
  ch.exp = ch.exp || {};
  const sk = [...r.prof].filter((p) => p.startsWith('skill:')).map((p) => p.slice(6));
  return r.exp
    .map((s) => {
      const c = ch.exp[s.key] || [];
      return (
        `<div class="ph"><span>Expertise · ${esc(s.cls)} level ${s.level}</span><span>${c.filter((x) => sk.includes(x)).length}/${s.n}</span></div>` +
        (sk
          .map(
            (n) =>
              `<div class="rw${c.includes(n) ? ' on' : ''}" data-a="ex" data-k="${esc(s.key)}" data-id="${esc(n)}"><span>${c.includes(n) ? '✓ ' : ''}${esc(n)}</span><span class="src">double proficiency</span></div>`,
          )
          .join('') || '<p class="hint">Gain skill proficiencies first.</p>')
      );
    })
    .join('');
}

function renderBuild() {
  const m = $('#main');
  m.className = 'main';
  const r = resolve(ch);
  let L = '',
    R = '';
  if (ROOT[sub]) {
    const [t, k, ty] = ROOT[sub];
    L =
      root(t, k, ty) +
      r.sels
        .filter((s) => (KIND[sub] || []).includes(s.kind))
        .map(selPanel)
        .join('');
  } else if (sub === 'abil') {
    L = abTab();
    R =
      '<h2>Ability scores</h2><p>Ability scores describe your strengths and weaknesses. Race bonuses are added on top of the base scores you set here.</p><p class="hint">Standard array assigns 15, 14, 13, 12, 10, 8. Point buy lets you spend 27 points on scores from 8 to 15.</p>';
  } else {
    const known = sub === 'lang' ? langList(r) : KP(r);
    L =
      `<div class="ph"><span>Known ${sub === 'lang' ? 'languages' : 'proficiencies'}</span></div>` +
      (known.map((n) => `<div class="rw"><span>${esc(n)}</span></div>`).join('') ||
        '<p class="hint">Nothing yet.</p>') +
      r.sels
        .filter((s) => (sub === 'lang' ? s.kind === 'Language' : ['Skill', 'Tool', 'Gear'].includes(s.kind)))
        .map(selPanel)
        .join('');
  }
  if (!R) R = descPane();
  m.innerHTML = `<div class="left">${L}</div><div class="right">${R}</div>`;
  if (sub === 'prof' && r.exp.length) $('#main .left').insertAdjacentHTML('beforeend', expHtml(r));
}
