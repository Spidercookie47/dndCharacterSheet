/* The page frame: top bar, sub bar, status bar, and the draw cycle. */
function note(m) {
  msg = m;
  chrome();
  setTimeout(() => {
    msg = '';
    chrome();
  }, 6000);
}

const LOGO =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 2l8.5 5v10L12 22l-8.5-5V7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 6.5c2.8 2.6 3.4 5.4 0 9.5-3.4-4.1-2.8-6.9 0-9.5z" fill="currentColor"/></svg>';
const ACTS =
  '<button class="lnk" data-a="save">Save</button><button class="lnk" data-a="lvl">Level up &amp; HP</button><button class="lnk" data-a="opt">Character options</button><button class="lnk" data-a="sheetpanel">Sheet</button>';

function subTabs(list, active, action) {
  return list
    .map(
      ([k, n]) =>
        `<button class="tab${active === k ? ' on' : ''}" data-a="${action}" data-v="${k}">${n}</button>`,
    )
    .join('');
}

function chrome() {
  $('#top').innerHTML =
    `<span class="brand">${LOGO}Hearthscribe</span>` +
    TABS.map(
      ([k, n]) => `<button class="tab${tab === k ? ' on' : ''}" data-a="tab" data-v="${k}">${n}</button>`,
    ).join('') +
    `<div class="who"><div><b>${esc(ch.name || 'Unnamed')}</b><small>${esc(summary(ch))}</small></div>${ch.img ? `<img class="av" src="${ch.img}">` : ''}</div>`;
  let left = '';
  if (tab === 'start') left = subTabs(STARTSUB, startSub, 'startsub');
  else if (tab === 'build') left = subTabs(SUBS, sub, 'sub');
  else if (tab === 'magic')
    left = subTabs([['cast', 'Spellcasting'], ...casters(resolve(ch)).map((n) => [n, n])], msp, 'msp');
  else if (tab === 'equip') left = subTabs(ESUB, eqs, 'esub');
  else if (tab === 'manage') left = subTabs(MSUB, msub, 'msub');
  else left = '<span class="hint">Live character sheet</span>';
  $('#sub').innerHTML = left + `<span class="acts">${ACTS}</span>`;
  const n = store.chars.length,
    on = Loader.packs.filter((p) => p.enabled).length;
  $('#status').innerHTML =
    `<span>${esc(msg) || 'Saved in this browser · ' + n + ' character' + (n == 1 ? '' : 's')}</span><span>${on} content source${on == 1 ? '' : 's'} · Hearthscribe 0.3</span>`;
}

function main() {
  if (tab === 'start') renderStart();
  else if (tab === 'build') (sub === 'asi' ? renderAsi : renderBuild)();
  else if (tab === 'magic') renderMagic();
  else if (tab === 'equip') renderEquip();
  else if (tab === 'manage') renderManage();
  else renderSheet();
}

function draw() {
  if (tab !== 'start' || store.chars.some((c) => c.id === ch.id)) persist();

  // 1) capture scroll before anything is rebuilt
  const SEL = ['#main', '#main .left', '#main .right', '#sl', '#el', '#dr'];
  const saved = SEL.map((s) => {
    const el = document.querySelector(s);
    return el ? { s, y: el.scrollTop } : null;
  }).filter((x) => x && x.y > 0);
  const pageY = window.scrollY;

  // 2) redraw as before
  chrome();
  main();
  drawer();

  // 3) put scroll positions back
  saved.forEach(({ s, y }) => {
    const el = document.querySelector(s);
    if (el) el.scrollTop = y;
  });
  if (window.scrollY !== pageY) window.scrollTo(0, pageY);
}
