/* Phone bottom tab bar. Load after mobile.js.
   Manage, Full sheet and the Player/DM switch live as pills in the action row under the tabs. */
(() => {
  const BB = [['build', 'Build'], ['magic', 'Spells'], ['start', ''], ['equip', 'Gear'], ['play', 'Sheet']]; // '' = the d20 Home button
  const BBM = [['mref', 'Reference'], ['mbuild', 'Build'], ['start', ''], ['mblock', 'Stat block'], ['enc', 'Encounter']]; // monster maker
  const MQ = window.matchMedia('(max-width: 860px)');
  const bar = document.createElement('nav');
  bar.id = 'bb';
  document.body.appendChild(bar);

  function paint() {
    const show = system === 'dnd5e';
    document.body.classList.toggle('bb-on', show);
    if (!show) return;
    bar.innerHTML = (mfocus ? BBM : BB).map(
      ([k, n]) =>
        `<button class="bbt${n ? '' : ' bbh'}${tab === k ? ' on' : ''}" data-a="tab" data-v="${k}"${n ? '' : ' aria-label="Home"'}>${n || LOGO}</button>`,
    ).join('');
    const acts = document.querySelector('#sub .acts');
    if (acts && MQ.matches) {
      const sw = `<button class="lnk" data-a="mode" data-v="${mode === 'dm' ? 'player' : 'dm'}">${mode === 'dm' ? 'Player mode' : 'DM mode'}</button>`;
      // monster maker and Encounter: just the Player/DM switch; character screens: Manage, Full sheet (+ the switch on Start)
      acts.insertAdjacentHTML(
        'afterbegin',
        mfocus || tab === 'enc'
          ? sw
          : [['manage', 'Manage'], ['sheet', 'Full sheet']]
              .map(([k, n]) => `<button class="lnk${tab === k ? ' on' : ''}" data-a="tab" data-v="${k}">${n}</button>`)
              .join('') + (tab === 'start' ? sw : ''),
      );
    }
  }

  const baseDraw = draw;
  draw = function () {
    baseDraw();
    paint();
  };
  paint();
})();
