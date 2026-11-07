/* Call of Cthulhu screens (prototype). Sample investigator, nothing is saved yet.
   shell.js calls renderCoc() and cocChrome() while system === 'coc'. */
const COC_TABS = [
  ['inv', 'Investigator'],
  ['skills', 'Skills'],
  ['gear', 'Gear'],
  ['sanity', 'Sanity'],
  ['story', 'Backstory'],
  ['sheet', 'Handout sheet'],
];
let cocTab = 'inv';
const COC = {
  name: 'Eleanor Whitcombe',
  job: 'Antiquarian, age 34',
  chars: [['STR', 60], ['CON', 55], ['SIZ', 65], ['DEX', 50], ['APP', 45], ['INT', 70], ['POW', 60], ['EDU', 75]],
  skills: [
    ['Library Use', 60], ['Spot Hidden', 55], ['History', 50], ['Occult', 40], ['Persuade', 40],
    ['Psychology', 35], ['Language (Latin)', 35], ['First Aid', 30], ['Dodge', 25], ['Fighting (Brawl)', 25],
    ['Firearms (Handgun)', 20], ['Stealth', 20], ['Credit Rating', 45], ['Cthulhu Mythos', 0],
  ],
};
const cocHalf = (n) => Math.floor(n / 2),
  cocFifth = (n) => Math.floor(n / 5);

on('coctab', (d) => {
  cocTab = d.v;
});

const COC_LOGO =
  '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10.6" stroke-dasharray="1.2 2.1"/><path d="M3.4 11.4c2.6-3.9 5.4-5.7 8.6-5.7s6 1.8 8.6 5.7c-2.6 3.9-5.4 5.7-8.6 5.7s-6-1.8-8.6-5.7z" fill="currentColor" fill-opacity=".18"/><circle cx="12" cy="11.4" r="3.3" fill="currentColor" fill-opacity=".5"/><ellipse cx="12" cy="11.4" rx=".9" ry="2.9" fill="currentColor" stroke="none"/><path d="M8.7 15.6c-.9 2.5-2.7 3.3-3.9 2.2M15.3 15.6c.9 2.5 2.7 3.3 3.9 2.2M12 17.1c-.3 1.9.7 3 1.9 2.8M10.4 16.6c-.3 1.6-1.2 2.4-2.1 2.4M13.6 16.6c.3 1.6 1.2 2.4 2.1 2.4"/></svg>';

function cocChrome() {
  $('#top .brand').innerHTML = COC_LOGO + 'Hearthscribe';
  $('#top .who').innerHTML = `<div><b>${esc(COC.name)}</b><small>${esc(COC.job)}</small></div>`;
  $('#nav').innerHTML =
    COC_TABS.map(([k, n]) => `<button class="tab${cocTab === k ? ' on' : ''}" data-a="coctab" data-v="${k}">${n}</button>`).join('') +
    '<span class="modes"><button class="md on">Investigator</button><button class="md">Keeper</button></span>';
  $('#sub').innerHTML = '<span class="hint">Prototype: sample investigator, nothing is saved yet.</span>';
  $('#status').innerHTML = '<span>Call of Cthulhu prototype</span><span>Hearthscribe 0.7</span>';
}

function renderCoc() {
  const m = $('#main');
  m.className = 'main';
  if (cocTab !== 'inv') {
    m.innerHTML = `<div class="left coc"><div class="ph"><span>${esc(COC_TABS.find((t) => t[0] === cocTab)[1])}</span></div><p class="hint">This screen is not built yet.</p></div>`;
    return;
  }
  const v = Object.fromEntries(COC.chars),
    san = v.POW,
    hp = Math.floor((v.CON + v.SIZ) / 10),
    mp = cocFifth(v.POW);
  m.innerHTML = `<div class="left coc">
    <h2>${esc(COC.name)}</h2><p class="case">Arkham, Massachusetts. Case file opened 1925.</p>
    <div class="ph"><span>Characteristics</span></div>
    <div class="chars">${COC.chars.map(([n, x]) => `<div class="cc2"><span>${n}</span><b>${x}</b><i>${cocHalf(x)} · ${cocFifth(x)}</i></div>`).join('')}</div>
    <p class="hint">Under each score: half and one-fifth values.</p>
    <div class="ph"><span>Skills</span></div>
    <ul class="skl">${COC.skills.map(([n, x], i) => `<li class="${i === 0 ? 'sel' : ''}${n === 'Cthulhu Mythos' ? ' mythos' : ''}"><span>${esc(n)}</span><em>${cocHalf(x)} · ${cocFifth(x)}</em><b>${x}</b></li>`).join('')}</ul>
  </div>
  <div class="right coc">
    <h2>Sanity</h2>
    <div class="bigsan">${san} <small>of 99</small></div>
    <div class="gauge"><div class="fill" style="width:${(san / 99) * 100}%"></div><div class="tick"></div></div>
    <div class="glbl"><span>0</span><span>99</span></div>
    <p class="hint">Maximum Sanity is 99 minus Cthulhu Mythos.</p>
    <div class="vit"><div><b>${hp}</b><span>Hit points</span></div><div><b>${mp}</b><span>Magic points</span></div><div><b>55</b><span>Luck</span></div></div>
    <div class="ph"><span>Library Use</span></div>
    <p>Finding a single book, article or record in a library, archive or private collection.</p>
  </div>`;
}
