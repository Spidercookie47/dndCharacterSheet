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
  '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"><path d="M12 7l5.5 9.5h-11z" fill="currentColor"/><path d="M12 2L3.5 7H12zM12 2l8.5 5H12z" fill="currentColor" fill-opacity=".55"/><path d="M3.5 7H12l-5.5 9.5zM20.5 7H12l5.5 9.5z" fill="currentColor" fill-opacity=".38"/><path d="M3.5 7l3 9.5-3 .5zM20.5 7l-3 9.5 3 .5z" fill="currentColor" fill-opacity=".2"/><path d="M3.5 17l3-.5L12 22zM20.5 17l-3-.5L12 22zM6.5 16.5h11L12 22z" fill="currentColor" fill-opacity=".25"/><path d="M12 2l8.5 5v10L12 22l-8.5-5V7z" fill="none" stroke-width="1.6"/></svg>';
const plusBtn = () =>
  mode === 'dm' && tab !== 'start' && !(tab === 'build' && (sub === 'race' || sub === 'class'))
    ? '<button class="lnk" data-a="xopen" title="Add an extra feat, language or spell">+ Add</button>'
    : '';
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
  document.documentElement.dataset.sys = system;
  $('#top').innerHTML =
    `<span class="brand">${LOGO}Hearthscribe${mode === 'dm' ? ' (DM)' : ''}</span>` +
    SYSTEMS.map(
      ([k, n]) => `<button class="sys${system === k ? ' on' : ''}" data-a="system" data-v="${k}">${n}</button>`,
    ).join('') +
    `<div class="who"><div><b>${esc(mfocus ? mon.name || 'Unnamed monster' : ch.name || 'Unnamed')}</b><small>${esc(mfocus ? monSummary(mon) : summary(ch))}</small></div>${!mfocus && ch.img ? `<img class="av" src="${ch.img}">` : ''}</div>`;
  if (!$('#nav')) $('#top').insertAdjacentHTML('afterend', '<div id="nav" class="nav"></div>');
  $('#nav').innerHTML =
    (mfocus ? MTABS : TABS)
      .map(([k, n]) => `<button class="tab${tab === k ? ' on' : ''}" data-a="tab" data-v="${k}">${n}</button>`)
      .join('') +
    `<span class="modes"><button class="md${mode === 'player' ? ' on' : ''}" data-a="mode" data-v="player">Player</button><button class="md${mode === 'dm' ? ' on' : ''}" data-a="mode" data-v="dm">DM</button></span>`;
  let left = '';
  if (mfocus && tab === 'mbuild') left = subTabs(MSUBS, msb, 'mbsub');
  else if (mfocus && tab === 'mref') left = subTabs(MRSUBS, mrSub, 'mrsub');
  else if (mfocus && tab === 'mblock') left = '<span class="hint">Stat block</span>';
  else if (tab === 'start') left = subTabs(mode === 'dm' ? STARTSUB_DM : STARTSUB, startSub, 'startsub');
  else if (tab === 'build') left = subTabs(SUBS, sub, 'sub');
  else if (tab === 'magic')
    left = subTabs([['cast', 'Spellcasting'], ...casters(resolve(ch)).map((n) => [n, n])], msp, 'msp');
  else if (tab === 'equip') left = subTabs(ESUB, eqs, 'esub');
  else if (tab === 'manage') left = subTabs(MSUB, msub, 'msub');
  else left = '<span class="hint">Live character sheet</span>';
  $('#sub').innerHTML = left + `<span class="acts">${mfocus ? MACTS : plusBtn() + ACTS}</span>`;
  const n = store.chars.filter((c) => !!c.dm === (mode === 'dm')).length,
    on = Loader.packs.filter((p) => p.enabled).length;
  $('#status').innerHTML =
    `<span>${esc(msg) || 'Saved in this browser · ' + n + ' character' + (n == 1 ? '' : 's')}</span><span>${on} content source${on == 1 ? '' : 's'} · Hearthscribe 1.3</span>`;
  if (system === 'coc') cocChrome();
  themeApply();
}


function renderDm() {
  const m = $('#main');
  m.className = 'main one';
  m.innerHTML = '<div class="left"><div class="ph"><span>DM mode</span></div><p class="hint">DM tools will go here.</p></div>';
}
function main() {
  if (system === 'coc') return renderCoc();
  if (mfocus && tab === 'mref') return renderMRef();
  if (mfocus && (tab === 'mbuild' || tab === 'mblock')) return tab === 'mbuild' ? renderMBuild() : renderMBlock();
  if (tab === 'start') renderStart();
  else if (tab === 'build') (sub === 'asi' ? renderAsi : renderBuild)();
  else if (tab === 'magic') renderMagic();
  else if (tab === 'equip') renderEquip();
  else if (tab === 'manage') renderManage();
  else renderSheet();
}

function draw() {
  if (mfocus) {
    if (tab === 'mbuild' || tab === 'mblock' || store.mons.some((x) => x.id === mon.id)) persistMon(); // browsing the reference does not save a blank monster
  } else if (tab !== 'start' || store.chars.some((c) => c.id === ch.id)) persist();

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
