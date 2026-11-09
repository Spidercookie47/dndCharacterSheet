/* Start tab helper. */
const summary = (c) => {
  const I = idx();
  return 'Level ' + c.level + ' ' + [(I[c.race] || {}).name, (I[c.cls] || {}).name].filter(Boolean).join(' ');
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
  if (startSub === 'sources') {
    m.innerHTML = '<div class="left">' + sourcesHtml() + '</div>';
    return;
  }
  const list = store.chars.filter((c) => !!c.dm === (mode === 'dm')),
    cards = list
    .map(
      (c) =>
        `<div class="card" data-a="open" data-id="${c.id}">${
          c.img
            ? `<img src="${c.img}" alt="" style="display:block;margin:0 auto 10px;width:140px;height:140px;border-radius:14px;object-fit:cover">`
            : ''
        }<b>${esc(c.name || 'Unnamed hero')}</b><small>${esc(summary(c))}</small>${
          delId === c.id
            ? `<div class="bar" style="margin-top:6px"><button data-a="delyes" data-id="${c.id}">Delete</button><button class="alt" data-a="delno">Keep</button></div>`
            : `<b class="x" data-a="del" data-id="${c.id}" title="Delete">✕</b>`
        }</div>`,
    )
    .join('');
  m.innerHTML = `<div class="left"><div class="ph"><span>Welcome to Hearthscribe${mode === 'dm' ? ' (DM)' : ''}</span></div>
    <p class="hint">Build 5e characters from rules data, keep them in this browser, or save them to a file you can load and change later. Add more content (homebrew) on the Sources tab.</p>
    <div class="bar"><button data-a="new">New character</button><label class="btn alt" style="margin:0">Open character file<input id="open" type="file" accept=".json,application/json" hidden></label>${typeof Sync !== 'undefined' ? Sync.html('alt') : ''}</div>
    <div class="ph"><span>Characters</span></div>${list.length ? '<div class="grid">' + cards + '</div>' : '<p class="hint">No characters yet. Choose New character to start.</p>'}</div>`;
}