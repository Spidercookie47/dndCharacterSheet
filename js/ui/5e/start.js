/* Start tab helper. */
const summary = (c) => {
  const I = idx();
  return 'Level ' + c.level + ' ' + [(I[c.race] || {}).name, (I[c.cls] || {}).name].filter(Boolean).join(' ');
};

/* Character row on the Home screen: avatar, and current / max hit points. */
const cardFace = (c) => {
  if (imgSrc(c.img)) return `<img class="cav" src="${imgSrc(c.img)}" alt="">`;
  const ini = (c.name || 'Hero').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return `<svg width="52" height="52" viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,4 90,27 90,73 50,96 10,73 10,27" fill="var(--sel)" stroke="var(--acc)" stroke-width="4"/><text x="50" y="61" text-anchor="middle" font-size="30" font-family="Fraunces,Georgia,serif" fill="var(--ink)">${esc(ini)}</text></svg>`;
};
const cardHp = (c) => {
  try {
    const mx = calc(c, resolve(c)).hp || 0;
    if (!mx) return '';
    const now = c.hpNow == null ? mx : Math.max(0, Math.min(c.hpNow, mx));
    return `<span class="chp"><b>${now} / ${mx}</b><small>HP</small></span>`;
  } catch (e) {
    return '';
  }
};

function renderStart() {
  const m = $('#main');
  m.className = 'main one';
  if (startSub === 'mons' && mode === 'dm') {
    m.innerHTML =
      '<div class="left">' +
      (typeof monsHtml === 'function'
        ? monsHtml()
        : '<p class="hint">monster.js is not loaded. Add &lt;script src="js/ui/monster.js"&gt;&lt;/script&gt; to index.html, after events.js.</p>') +
      '</div>';
    return;
  }
  if (startSub === 'enc' && mode === 'dm') {
    if (typeof renderEnc === 'function') return renderEnc();
    m.innerHTML = '<div class="left"><p class="hint">encounter.js is not loaded.</p></div>';
    return;
  }
  if (startSub === 'sources') {
    m.innerHTML = '<div class="left">' + sourcesHtml() + '</div>';
    return;
  }
  const list = store.chars.filter((c) => !!c.dm === (mode === 'dm')),
    cards = list
      .map(
        (c) =>
          `<div class="crow" data-a="open" data-id="${esc(c.id)}">${cardFace(c)}<span class="cwho"><b>${esc(c.name || 'Unnamed hero')}</b><small>${esc(summary(c))}</small></span>${cardHp(c)}${
            delId === c.id
              ? `<span class="bar"><button data-a="delyes" data-id="${esc(c.id)}">Delete</button><button class="alt" data-a="delno">Keep</button></span>`
              : `<b class="x" data-a="del" data-id="${esc(c.id)}" title="Delete">✕</b>`
          }</div>`,
      )
      .join('');
  m.innerHTML = `<div class="left"><div class="ph"><span>Welcome to Hearthscribe${mode === 'dm' ? ' (DM)' : ''}</span></div>
    <p class="hint">Build 5e characters from rules data, keep them in this browser, or save them to a file you can load and change later. Add more content (homebrew) on the Sources tab.</p>
    <div class="bar"><button data-a="new">New character</button><label class="btn alt" style="margin:0">Open character file<input id="open" type="file" accept=".json,application/json" hidden></label>${typeof Sync !== 'undefined' ? Sync.html('alt') : ''}</div>
    ${typeof hsInstallCard === 'function' ? hsInstallCard() : ''}<div class="ph"><span>Characters</span></div>${list.length ? '<div class="clist">' + cards + '</div>' : '<p class="hint">No characters yet. Choose New character to start.</p>'}</div>`;
}