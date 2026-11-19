/* Phone Home screen for the D&D tab. Load after bottombar.js.
   On phones, replaces the Start > Character collection screen with the compact layout:
   header, system switch, Drive card, character rows, New / Open buttons, backup reminder.
   Sources, Monsters (DM), Theme and the Player/DM switch live in a small link row at the bottom. */
(() => {
  const MQ = window.matchMedia('(max-width: 860px)');
  const KEY = 'hs-lastsave';

  const isHome = () => MQ.matches && system === 'dnd5e' && tab === 'start' && startSub === 'chars' && !mfocus;

  const offline = () => {
    const ok = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
    return ok ? '<span class="hm-off"><i></i>Works offline</span>' : '';
  };

  function backupText() {
    let t = 0;
    try { t = +localStorage.getItem(KEY) || 0; } catch (e) {}
    if (!t) return 'No file backup yet';
    const d = Math.floor((Date.now() - t) / 864e5);
    return 'Last file backup: ' + (d < 1 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago');
  }

  /* Drive card. Sync.html() draws the Drive button(s) in whatever state Sync is in.
     To show "synced 2 minutes ago · 3 characters" and a Sync now button, replace the body here with Sync's status. */
  function driveCard() {
    if (typeof Sync === 'undefined') return '';
    return `<div class="hm-card"><span class="hm-txt"><b>Google Drive</b><small>Keeps your characters on every device.</small></span><span class="bar">${Sync.html('alt')}</span></div>`;
  }

  function html() {
    const list = store.chars.filter((c) => !!c.dm === (mode === 'dm'));
    const rows = list
      .map(
        (c) =>
          `<div class="crow" data-a="open" data-id="${esc(c.id)}">${cardFace(c)}<span class="cwho"><b>${esc(c.name || 'Unnamed hero')}</b><small>${esc(summary(c))}</small></span>${cardHp(c)}${
            delId === c.id
              ? `<span class="bar"><button data-a="delyes" data-id="${esc(c.id)}">Delete</button><button class="alt" data-a="delno">Keep</button></span>`
              : `<b class="x" data-a="del" data-id="${esc(c.id)}" title="Delete">✕</b>`
          }</div>`,
      )
      .join('');
    const sys = SYSTEMS.map(([k, n]) => `<button class="hm-s${system === k ? ' on' : ''}" data-a="system" data-v="${k}">${n}</button>`).join('');
    const links =
      '<button class="lnk" data-a="startsub" data-v="sources">Sources</button>' +
      (mode === 'dm' ? '<button class="lnk" data-a="startsub" data-v="mons">Monsters</button><button class="lnk" data-a="tab" data-v="enc">Encounter</button>' : '') +
      '<button class="lnk" data-a="themeopen">Theme</button>' +
      `<button class="lnk" data-a="mode" data-v="${mode === 'dm' ? 'player' : 'dm'}">${mode === 'dm' ? 'Player mode' : 'DM mode'}</button>`;
    return (
      `<div class="left hm">` +
      `<div class="hm-top"><span class="hm-brand">${LOGO}Hearthscribe${mode === 'dm' ? ' (DM)' : ''}</span>${offline()}</div>` +
      `<div class="hm-sys">${sys}</div>` +
      driveCard() +
      `<h3 class="hm-h">Your characters</h3>` +
      (list.length ? `<div class="clist">${rows}</div>` : '<p class="hint hm-empty">No characters yet. Choose New character to start.</p>') +
      `<div class="hm-cta"><button data-a="new">New character</button><label class="btn alt">Open file<input id="open" type="file" accept=".json,application/json" hidden></label></div>` +
      (typeof hsInstallCard === 'function' ? hsInstallCard() : '') +
      `<div class="hm-gap"></div>` +
      `<div class="hm-card hm-bak"><span class="hm-txt"><b>${backupText()}</b><small>A saved file is a second copy of your characters.</small></span><button data-a="save">Save copy</button></div>` +
      `<div class="hm-links">${links}</div></div>`
    );
  }

  function paint() {
    // Play tab on phones: header, cards and rests only; the old tab/pill rows are hidden by CSS
    document.body.classList.toggle('pl-on', MQ.matches && system === 'dnd5e' && !mfocus && tab === 'play');
    // Spells and Gear on phones: their own title and tab switch replace the sub-tab row
    document.body.classList.toggle('sp-on', MQ.matches && system === 'dnd5e' && !mfocus && tab === 'magic');
    document.body.classList.toggle('ge-on', MQ.matches && system === 'dnd5e' && !mfocus && tab === 'equip');
    const on = isHome();
    document.body.classList.toggle('hm-on', on);
    if (!on) return;
    const m = document.getElementById('main');
    if (!m) return;
    m.className = 'main one';
    m.innerHTML = html();
  }

  /* Gear (see equipment.js): tap a row to open its actions; "+ Add item" opens the custom item form.
     Registered here because events.js, which defines on(), loads after equipment.js. */
  on('geopen', (d) => {
    const i = +d.i;
    geOpen.has(i) ? geOpen.delete(i) : geOpen.add(i);
  });
  on('gearadd', () => {
    eqs = 'inv';
    geAdd = true;
    setTimeout(() => {
      const f = $('#geadd');
      if (f) f.scrollIntoView({ block: 'start' });
    }, 80);
  });

  const baseDraw = draw;
  draw = function () {
    baseDraw();
    paint();
  };
  /* On phones the status line becomes a short toast: it only shows while there is a message (see CSS). */
  const baseChrome = chrome;
  chrome = function () {
    baseChrome();
    const st = document.getElementById('status');
    if (st) st.classList.toggle('has-msg', !!msg);
  };
  MQ.addEventListener('change', () => draw());
  paint();
})();
