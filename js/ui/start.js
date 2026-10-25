/* Start tab helper. */
const summary = (c) => {
  const I = idx();
  return 'Level ' + c.level + ' ' + [(I[c.race] || {}).name, (I[c.cls] || {}).name].filter(Boolean).join(' ');
};

function renderStart() {
  const m = $('#main');
  m.className = 'main one';
  if (startSub === 'sources') {
    m.innerHTML = '<div class="left">' + sourcesHtml() + '</div>';
    return;
  }
  const cards = store.chars
    .map(
      (c) =>
        `<div class="card" data-a="open" data-id="${c.id}"><b>${esc(c.name || 'Unnamed hero')}</b><small>${esc(summary(c))}</small>${
          delId === c.id
            ? `<div class="bar" style="margin-top:6px"><button data-a="delyes" data-id="${c.id}">Delete</button><button class="alt" data-a="delno">Keep</button></div>`
            : `<b class="x" data-a="del" data-id="${c.id}" title="Delete">✕</b>`
        }</div>`,
    )
    .join('');
  m.innerHTML = `<div class="left"><div class="ph"><span>Welcome to Hearthscribe</span></div>
    <p class="hint">Build 5e characters from rules data, keep them in this browser, or save them to a file you can load and change later. Add more content (homebrew) on the Sources tab.</p>
    <div class="bar"><button data-a="new">New character</button><label class="btn alt" style="margin:0">Open character file<input id="open" type="file" accept=".json,application/json" hidden></label></div>
    <div class="ph"><span>Characters</span></div>${store.chars.length ? '<div class="grid">' + cards + '</div>' : '<p class="hint">No characters yet. Choose New character to start.</p>'}</div>`;
}
