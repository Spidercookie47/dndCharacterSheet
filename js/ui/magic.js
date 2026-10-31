/* Magic tab: cantrips, known/prepared spells, racial and feature spells. */
const lvTxt = (s) =>
  s.lvl === 0
    ? s.school + ' cantrip'
    : s.lvl + (['st', 'nd', 'rd'][s.lvl - 1] || 'th') + '-level ' + s.school + (s.ritual ? ' (ritual)' : '');
const vsm = (s) =>
  ['V', 'S', 'M']
    .map(
      (x) =>
        `<span style="display:inline-block;width:14px;text-align:center">${s.comp.split(',').includes(x) ? '✓' : ''}</span>`,
    )
    .join('');
function spellRows(n, r, mode) {
  const st = spOf(n),
    md = MODE[n],
    tl = topLv(n, r),
    dm = domOf(r, n),
    all = DB.filter((e) => e.type === 'Spell' && (inList(e, n, r) || (n === 'Bard' && spall && secretsN(r))));
  if (mode === 'c')
    return all
      .filter((s) => s.lvl === 0)
      .map((s) => ({ s, on: st.c.includes(s.id), m: st.c.includes(s.id) ? '✓ ' : '' }));
  if (mode === 'k')
    return all
      .filter((s) => s.lvl >= 1 && s.lvl <= tl)
      .map((s) => ({ s, on: st.k.includes(s.id), m: st.k.includes(s.id) ? '✓ ' : '' }));
  let b = all.filter((s) => s.lvl >= 1 && s.lvl <= tl);
  if (md === 'book') b = b.filter((s) => st.k.includes(s.id));
  if (md === 'known') b = b.filter((s) => st.k.includes(s.id));
  return b.map((s) => {
    const al = dm.includes(s.id),
      on = al || md === 'known' || st.p.includes(s.id);
    return { s, on, m: al ? '★ ' : on ? '✓ ' : '' };
  });
}
const srow = ({ s, on, m }) =>
  `<div class="rw${on ? ' on' : ''}${pv && pv.id === s.id && pv.k === 'spell' ? ' pv' : ''}" data-a="pv" data-id="${esc(s.id)}" data-k="spell"><span>${m}${esc(s.name)}</span><span class="src">${s.src ? esc(s.src) + ' · ' : ''}<i>${esc(lvTxt(s))}</i> ${vsm(s)}</span></div>`;
function fillList() {
  const el = $('#sl');
  if (!el) return;
  const r = resolve(ch),
    c = calc(ch, r),
    cs = casters(r);
  if (!cs.includes(spc)) spc = cs[0];
  const n = msp === 'cast' ? spc : msp,
    md = MODE[n],
    fl = (x) => (!spl || String(x.s.lvl) === spl) && (!spq || x.s.name.toLowerCase().includes(spq)),
    st = spOf(n);
  let h = '';
  const P = (t, right, k) => {
    const rs = spellRows(n, r, k).filter(fl);
    return (
      `<div class="ph"><span>${t}</span><span class="src">${right}</span></div>` +
      (rs.map(srow).join('') || '<p class="hint">Nothing to show.</p>')
    );
  };
  if (msp === 'cast') {
    if (cantN(n)) h += P('Cantrips (' + n + ')', 'Selected ' + st.c.length + ' / ' + cantN(n), 'c');
    if (md === 'known') h += P('Spells known', 'Known ' + st.k.length + ' / ' + knownT(n, r), 'k');
    else if (md === 'book') h += P('Spellbook', 'In book ' + st.k.length + ' / ' + bookN(n), 'k');
    else
      h += '<p class="hint">' + n + ' prepares spells from the whole class list. Use the ' + n + ' tab.</p>';
  } else
    h += P(
      md === 'known' ? 'Spells known' : 'Spells',
      md === 'known'
        ? 'All known spells can be cast'
        : 'Prepared ' + st.p.filter((id) => !domOf(r, n).includes(id)).length + ' / ' + prepN(n, c),
      'p',
    );
  el.innerHTML =
    h +
    '<p class="hint">Double-click a spell to choose it. ★ marks always-prepared domain and oath spells, which don’t count against your limit.</p>';
}
function renderMagic() {
  const m = $('#main');
  m.className = 'main';
  const r = resolve(ch),
    c = calc(ch, r),
    cs = casters(r),
    I = idx();
  if (!cs.length) {
    const s0 = pv && pv.k === 'spell' && I[pv.id];
    m.innerHTML =
      '<div class="left"><p class="hint">Pick a spellcasting class (Bard, Cleric, Druid, Paladin, Ranger, Sorcerer, Warlock or Wizard) on the Build tab.</p>' +
      featPanel(resolve(ch)) +
      '</div><div class="right">' +
      (s0 ? spellCard(s0) : '<p class="hint">Click a spell to read it.</p>') +
      '</div>';
    return;
  }
  if (msp !== 'cast' && !cs.includes(msp)) msp = 'cast';
  if (!cs.includes(spc)) spc = cs[0];
  const n = msp === 'cast' ? spc : msp,
    S = slotsFor(r),
    ab = abOf(n, c);
  const sl =
    (S.sl
      .map((x, i) => (x ? x + '×L' + (i + 1) : ''))
      .filter(Boolean)
      .join(' ') || 'none') +
    (S.pact ? ' · Pact ' + S.pact.n + '×L' + S.pact.l : '') +
    (S.comb ? ' (combined)' : '');
  const sel =
    msp === 'cast' && cs.length > 1
      ? `<select data-sc style="width:auto">${cs.map((x) => `<option${x === spc ? ' selected' : ''}>${x}</option>`).join('')}</select>`
      : '';
  const chips = ['', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
    .map(
      (v) =>
        `<button class="lnk${spl === v ? ' on' : ''}" data-a="spl" data-v="${v}">${v === '' ? 'All' : v}</button>`,
    )
    .join('');
  const s = pv && pv.k === 'spell' && I[pv.id];
  m.innerHTML = `<div class="left"><div class="ph"><span>${n}</span><span class="src">Ability <b>${AN[CA[n]]}</b> · Attack ${sg(c.pb + ab + magicB(ch).spA)} · Save DC ${8 + c.pb + ab}</span></div><p class="hint">Spell slots: ${sl}</p><div class="bar">${sel}<input type="text" id="spq" placeholder="Search spells…" value="${esc(spq)}" style="max-width:240px"></div><div class="chips">${chips}${secChip(n, r)}</div><div id="sl"></div>${featPanel(r)}</div><div class="right">${s ? spellPane(s) : '<p class="hint">Click a spell to read it.</p>'}</div>`;
  fillList();
}
const spellCard = (s) =>
  `<h2>${esc(s.name)}</h2><p><i>${esc(lvTxt(s))}</i></p><p><b>Casting time:</b> ${esc(s.cast)}<br><b>Range:</b> ${esc(s.range)}<br><b>Components:</b> ${esc(s.comp.replace(/,/g, ', '))}${s.mat ? ' (' + esc(s.mat) + ')' : ''}<br><b>Duration:</b> ${esc(s.dur)}</p>${s.desc
    .split('\n\n')
    .map((p) => `<p>${esc(p)}</p>`)
    .join('')}<p class="hint">${s.src ? esc(s.src) + ' · ' : ''}${esc(s.lists.join(', '))}</p>`;
function spellPane(s) {
  if (!casters(resolve(ch)).length) return spellCard(s);
  const r = resolve(ch),
    cs = casters(r),
    n = msp === 'cast' ? (cs.includes(spc) ? spc : cs[0]) : msp,
    st = spOf(n),
    md = MODE[n];
  let lab, on;
  if (s.lvl === 0) {
    on = st.c.includes(s.id);
    lab = on ? 'Remove cantrip' : 'Select cantrip';
  } else if (md === 'prep' || (md === 'book' && msp !== 'cast')) {
    on = st.p.includes(s.id);
    lab = on ? 'Unprepare' : 'Prepare';
  } else {
    on = st.k.includes(s.id);
    lab = md === 'book' ? (on ? 'Remove from spellbook' : 'Add to spellbook') : on ? 'Forget' : 'Learn';
  }
  return `<h2>${esc(s.name)}</h2><p><i>${esc(lvTxt(s))}</i></p><p><b>Casting time:</b> ${esc(s.cast)}<br><b>Range:</b> ${esc(s.range)}<br><b>Components:</b> ${esc(s.comp.replace(/,/g, ', '))}${s.mat ? ' (' + esc(s.mat) + ')' : ''}<br><b>Duration:</b> ${esc(s.dur)}</p>${s.desc
    .split('\n\n')
    .map((p) => `<p>${esc(p)}</p>`)
    .join(
      '',
    )}<p class="hint">${s.src ? esc(s.src) + ' · ' : ''}${esc(s.lists.join(', '))}</p><p><button data-a="pick" data-k="spell" data-id="${esc(s.id)}">${lab}</button></p>`;
}
const secChip = (n, r) =>
  n === 'Bard' && msp === 'cast' && secretsN(r)
    ? `<button class="lnk${spall ? ' on' : ''}" data-a="spall">Magical Secrets: any class</button>`
    : '';
const featPanel = (r) => {
  const f = featSpells(r);
  return f.length
    ? '<div class="ph"><span>Racial and feature spells</span></div>' +
        f
          .map(
            (s) =>
              `<div class="rw" data-a="pv" data-id="${esc(s.id)}" data-k="spell"><span>${esc(s.name)}</span><span class="src">${(idx()[s.id] || {}).src ? esc(idx()[s.id].src) + ' · ' : ''}${esc(s.note)}</span></div>`,
          )
          .join('')
    : '';
};
