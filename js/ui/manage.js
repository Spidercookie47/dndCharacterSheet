/* Manage tab: details, backstory tables, trinkets, allies and symbol. */
const TI = (k, n) => `<label>${n}<input type="text" data-f="d.${k}" value="${esc(ch.d[k] || '')}"></label>`,
  TA = (k, n, h) =>
    `<label>${n}<textarea rows="${h || 4}" data-f="d.${k}">${esc(ch.d[k] || '')}</textarea></label>`;
const SE = (k, n, o) =>
  `<label>${n}<select data-f="d.${k}"><option value=""></option>${o.map((x) => `<option${ch.d[k] === x ? ' selected' : ''}>${x}</option>`).join('')}</select></label>`;
const bgOpts = (tk) => {
  const bg = resolve(ch).els.find((e) => e.type === 'Background');
  return bg && bg.chars ? bg.chars[tk] : [];
};
function CH4(r) {
  const bg = r.els.find((e) => e.type === 'Background'),
    T_ = bg && bg.chars;
  return CHL.map(([k, n, tk]) => {
    const o = T_ && T_[tk];
    return `<label>${n}${o ? `<span class="bar" style="margin-top:2px"><select data-pk="${k}" data-t="${tk}" style="width:auto;max-width:360px"><option value="">Pick from the ${esc(bg.name)} table…</option>${o.map((x, i) => `<option value="${i}">${esc(x.length > 70 ? x.slice(0, 70) + '…' : x)}</option>`).join('')}</select><button type="button" class="alt" data-a="roll" data-k="${k}" data-t="${tk}">Roll</button></span>` : ''}<input type="text" data-f="d.${k}" value="${esc(ch.d[k] || '')}"></label>`;
  }).join('');
}
function setPick(k, text) {
  if (!text) return;
  ch.d[k] = k === 'traits' && ch.d.traits && !ch.d.traits.includes(text) ? ch.d.traits + ' ' + text : text;
  persist();
  draw();
}
const trinketHtml = () =>
  `<span class="bar"><select data-tr style="width:auto;max-width:420px"><option value="">Pick a trinket…</option>${TRINK.map((x, i) => `<option value="${i}">${esc(x)}</option>`).join('')}</select><button type="button" class="alt" data-a="trroll">Randomize</button></span><label>Your trinket<input type="text" data-f="d.trinket" value="${esc(ch.d.trinket || '')}"></label><p class="hint">An original list of trinkets (the Player’s Handbook table isn’t part of the open rules). Or write your own.</p>`;
const symHtml = () =>
  `<div class="bar" style="margin-top:8px">${ch.sym ? `<img class="av big" src="${ch.sym}" style="border-radius:8px;margin:0">` : ''}<label class="btn alt" style="margin:0">Choose symbol<input id="sym" type="file" accept="image/*" hidden></label>${ch.sym ? '<button class="alt" data-a="symrm">Remove</button>' : ''}</div>`;

function renderManage() {
  const m = $('#main');
  m.className = 'main one';
  const r = resolve(ch);
  let L = '';
  if (msub === 'char')
    L = `<div class="ph"><span>Character details</span></div><div class="fg"><label>Character name<input type="text" data-f="name" value="${esc(ch.name)}"></label><label>Level<input type="text" value="${ch.level} (use Level up &amp; HP)" disabled></label>${TI('gender', 'Gender')}${SE('align', 'Alignment', ALIGN)}${TI('player', 'Player name')}${TI('exp', 'Current experience')}${TI('deity', 'Deity (optional)')}</div><div class="ph"><span>Appearance</span></div><div class="fg">${['age', 'height', 'weight', 'eyes', 'skin', 'hair'].map((k) => TI(k, k[0].toUpperCase() + k.slice(1))).join('')}</div><div class="ph"><span>Portrait</span></div><div class="bar">${ch.img ? `<img class="av big" src="${ch.img}">` : ''}<label class="btn alt" style="margin:0">Choose image<input id="img" type="file" accept="image/*" hidden></label>${ch.img ? '<button class="alt" data-a="imgrm">Remove</button>' : ''}</div><div class="ph"><span>Additional features</span></div>${TA('addf', 'Features from outside your race, class or background', 5)}`;
  else if (msub === 'story')
    L =
      `<div class="ph"><span>Background characteristics</span></div>${CH4(r)}<div class="ph"><span>Background feature</span></div>` +
      (r.els
        .filter((e) => e.type === 'Background Feature')
        .map((e) => `<p><b>${esc(e.name)}.</b> ${esc(e.desc)}</p>`)
        .join('') || '<p class="hint">Pick a background to see its feature.</p>') +
      `<div class="ph"><span>Trinket</span></div>${trinketHtml()}<div class="ph"><span>Backstory</span></div>${TA('story', 'Write your story', 9)}`;
  else if (msub === 'notes')
    L = `<p class="hint">Optional notes for your character.</p><div class="fg">${TA('n1', 'Left column', 12)}${TA('n2', 'Right column', 12)}</div>`;
  else if (msub === 'allies')
    L = `<div class="ph"><span>Organization</span></div>${TI('org', 'Organization')}${symHtml()}<div class="ph"><span>Allies</span></div>${TA('allies', 'Mention your allies', 6)}`;
  else
    L =
      `<div class="ph"><span>Attacks</span></div><p class="hint">Up to three attacks go on the sheet.</p><p><button class="alt" data-a="atkfill">Fill from equipped weapons</button></p>` +
      [1, 2, 3]
        .map(
          (n) =>
            `<div class="fg">${TI('a' + n + 'n', 'Attack ' + n)}${TI('a' + n + 'b', 'Bonus')}${TI('a' + n + 'd', 'Damage / type')}</div>`,
        )
        .join('') +
      `<div class="ph"><span>Additional details</span></div>${TA('combat', 'Additional combat details', 5)}`;
  m.innerHTML = `<div class="left">${L}</div>`;
}
