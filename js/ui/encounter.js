/* Encounter (DM mode, monster side): run a fight with monsters only.
   Monsters of the same kind form a group with one initiative roll. The party is a single row with a typed
   initiative. Damage and healing are typed amounts, to one monster or the whole group.
   Load after monster.js (needs monCalc, MXP, refMons, fromRef, monSummary) and events.js (needs on). */
const E = () => (store.enc = store.enc || { round: 1, cur: null, party: null, groups: [], sel: null, amt: 5 });
let encPick = false,
  encQ = '';
const d20 = () => Math.floor(Math.random() * 20) + 1;
const encLetter = (k) => (k < 26 ? String.fromCharCode(65 + k) : String(k + 1));
const encAlive = (g) => g.mem.some((m) => m.hp > 0);

function encOrder() {
  const e = E(),
    L = e.groups.map((g, i) => ({ k: g.id, g, i, init: g.init }));
  L.push({ k: 'p', p: true, i: -1, init: e.party });
  return L.sort((a, b) => (b.init == null ? -99 : b.init) - (a.init == null ? -99 : a.init) || a.i - b.i);
}

function encMake(s, id) {
  let m = null;
  if (s === 'mine') m = store.mons.find((x) => x.id === id);
  else {
    const r = refMons().find((x) => x.id === id);
    m = r && fromRef(r);
  }
  if (!m) return null;
  const c = monCalc(m);
  return { key: s + ':' + id, name: m.name || 'Monster', ac: +m.ac || 10, hp: c.hp, xp: MXP[m.cr] || 0, dx: c.mods.dex };
}

const encBar = (hp, mx) => {
  const p = mx ? Math.round((hp / mx) * 100) : 0;
  return `<div class="ec-bar"><i class="${p <= 50 ? 'lo' : ''}" style="width:${p}%"></i></div>`;
};

function encCard(en, cur, sel) {
  const g = en.g,
    n = g.mem.length,
    up = g.mem.filter((m) => m.hp > 0).length,
    open = !!sel && sel.g === g.id,
    one = g.mem[0],
    gid = esc(g.id);
  let h =
    `<div class="ec${cur ? ' cur' : ''}"><div class="ec-h" data-a="encsel" data-g="${gid}" data-t="all">` +
    `<button class="ec-n" data-a="encinit" data-g="${gid}" aria-label="Set initiative">${g.init == null ? '–' : g.init}</button>` +
    `<span class="ec-w"><b>${esc(g.name)}${n > 1 ? ' ×' + n : ''}</b><small>${cur ? 'Acting now · ' : ''}${n > 1 ? up + ' of ' + n + ' up · ' : ''}AC ${g.ac} · ${g.xp} XP${n > 1 ? ' each' : ''}</small></span>` +
    (n === 1 ? `<span class="ec-hp"><b>${one.hp} / ${g.hp}</b></span>` : '') +
    '</div>';
  if (n === 1) h += encBar(one.hp, g.hp);
  else if (!open) h += '<div class="ec-mini">' + g.mem.map((m) => encBar(m.hp, g.hp)).join('') + '</div>';
  if (open) {
    if (n > 1)
      h +=
        '<div class="ec-seg">' +
        `<button class="${sel.t === 'all' ? 'on' : ''}" data-a="encsel" data-g="${gid}" data-t="all">Whole group</button>` +
        g.mem.map((m, i) => `<button class="${String(sel.t) === String(i) ? 'on' : ''}" data-a="encsel" data-g="${gid}" data-t="${i}">${esc(m.n)}</button>`).join('') +
        '</div>';
    h += `<div class="ec-a"><input type="number" id="encamt" min="1" value="${E().amt || 5}" inputmode="numeric" aria-label="Amount"><button data-a="encdmg">Damage</button><button class="alt" data-a="encheal">Heal</button></div>`;
    if (n > 1) {
      h += g.mem
        .map(
          (m, i) =>
            `<div class="ec-m${String(sel.t) === String(i) ? ' on' : ''}${m.hp <= 0 ? ' dn' : ''}" data-a="encsel" data-g="${gid}" data-t="${i}"><span><b>${esc(g.name)} ${esc(m.n)}</b>${encBar(m.hp, g.hp)}</span><span>${m.hp <= 0 ? 'Down' : m.hp + ' / ' + g.hp}</span></div>`,
        )
        .join('');
      if (sel.t === 'all') h += '<p class="hint">Applies to each one still up. Ones already down are skipped.</p>';
    }
    h += `<button class="lnk" data-a="encrm" data-g="${gid}">Remove from encounter</button>`;
  }
  return h + '</div>';
}

function encBody() {
  const e = E(),
    L = encOrder(),
    cur = e.cur && L.some((x) => x.k === e.cur) ? e.cur : L[0].k,
    xp = e.groups.reduce((s, g) => s + g.xp * g.mem.length, 0);
  const rows = L.map((en) =>
    en.p
      ? `<div class="ec${cur === 'p' ? ' cur' : ''}"><div class="ec-h"><button class="ec-n" data-a="encinit" data-g="p" aria-label="Set party initiative">${e.party == null ? '–' : e.party}</button><span class="ec-w"><b>Party</b><small>${cur === 'p' ? 'Acting now · ' : ''}Players act together</small></span></div></div>`
      : encCard(en, cur === en.k, e.sel),
  ).join('');
  return (
    `<div class="ec-top"><div><h2>Encounter</h2><span class="hint">Round ${e.round} · ${xp.toLocaleString()} XP</span></div><button data-a="encnext">Next turn</button></div>` +
    rows +
    (e.groups.length ? '' : '<p class="hint">No monsters yet. Choose Add monsters.</p>') +
    '<div class="ec-btm"><button data-a="encadd">Add monsters</button><button class="alt" data-a="encroll">Roll initiative</button></div>' +
    '<button class="lnk" data-a="encnew">New encounter</button>'
  );
}

function encPicker() {
  const have = {};
  E().groups.forEach((g) => (have[g.key] = g.mem.length));
  const row = (s, id, name, sub) =>
    `<div class="rw" data-n="${esc(name.toLowerCase())}" data-a="encpick" data-s="${s}" data-id="${esc(id)}"${encQ && !name.toLowerCase().includes(encQ) ? ' style="display:none"' : ''}><span>${esc(name)}${have[s + ':' + id] ? ' <b>×' + have[s + ':' + id] + '</b>' : ''}</span><span class="src">${esc(sub)}</span></div>`;
  return (
    '<div class="ec-top"><h2>Add monsters</h2><button data-a="encdone">Done</button></div>' +
    `<input type="text" id="encq" placeholder="Search monsters…" value="${esc(encQ)}">` +
    '<div id="encl">' +
    (store.mons.length ? '<div class="ph"><span>My monsters</span></div>' + store.mons.map((m) => row('mine', m.id, m.name || 'Unnamed monster', monSummary(m))).join('') : '') +
    '<div class="ph"><span>SRD reference</span></div>' +
    (refMons().map((r) => row('ref', r.id, r.name, 'CR ' + ((r.stat && r.stat.cr) || '?'))).join('') || '<p class="hint">No monsters loaded. Turn on a source with monsters.</p>') +
    '</div>'
  );
}

function renderEnc() {
  const m = $('#main');
  m.className = 'main one';
  m.innerHTML = '<div class="left enc">' + (encPick ? encPicker() : encBody()) + '</div>';
}

function encApply(sign) {
  const e = E(),
    s = e.sel,
    g = s && e.groups.find((x) => x.id === s.g);
  if (!g) {
    note('Tap a monster first.');
    return false;
  }
  const el = $('#encamt'),
    n = Math.floor(+(el && el.value));
  if (!(n > 0)) {
    note('Type an amount first.');
    return false;
  }
  e.amt = n;
  const t = s.t === 'all' ? g.mem.filter((m) => m.hp > 0) : [g.mem[+s.t]].filter(Boolean);
  t.forEach((m) => {
    m.hp = sign < 0 ? Math.max(0, m.hp - n) : Math.min(g.hp, m.hp + n);
  });
  writeStore();
}
on('encdmg', () => encApply(-1));
on('encheal', () => encApply(1));
on('encsel', (d) => {
  const e = E(),
    same = e.sel && e.sel.g === d.g && e.sel.t === d.t;
  e.sel = same && d.t === 'all' ? null : { g: d.g, t: d.t };
  writeStore();
});
on('encinit', (d) => {
  const e = E(),
    g = d.g === 'p' ? null : e.groups.find((x) => x.id === d.g),
    v = prompt('Initiative', (g ? g.init : e.party) == null ? '' : g ? g.init : e.party);
  if (v === null || !isFinite(parseFloat(v))) return false;
  if (g) g.init = parseFloat(v);
  else e.party = parseFloat(v);
  writeStore();
});
on('encnext', () => {
  const e = E(),
    L = encOrder(),
    i = Math.max(0, L.findIndex((x) => x.k === e.cur));
  for (let s = 1; s <= L.length; s++) {
    const en = L[(i + s) % L.length];
    if (en.p || encAlive(en.g)) {
      if (i + s >= L.length) e.round++;
      e.cur = en.k;
      e.sel = en.p ? null : { g: en.k, t: 'all' };
      break;
    }
  }
  writeStore();
});
on('encroll', () => {
  const e = E();
  e.groups.forEach((g) => (g.init = d20() + g.dx));
  e.round = 1;
  const L = encOrder();
  e.cur = L[0].k;
  e.sel = L[0].p ? null : { g: L[0].k, t: 'all' };
  writeStore();
});
on('encadd', () => {
  encPick = true;
});
on('encdone', () => {
  encPick = false;
});
on('encpick', (d) => {
  const s = encMake(d.s, d.id);
  if (!s) return false;
  const e = E();
  let g = e.groups.find((x) => x.key === s.key);
  if (!g) {
    g = { id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), key: s.key, name: s.name, ac: s.ac, hp: s.hp, xp: s.xp, dx: s.dx, init: d20() + s.dx, mem: [], next: 0 };
    e.groups.push(g);
  }
  g.mem.push({ n: encLetter(g.next++), hp: g.hp });
  writeStore();
  note('Added ' + g.name + ' (' + g.mem.length + ').');
});
on('encrm', (d) => {
  const e = E();
  e.groups = e.groups.filter((x) => x.id !== d.g);
  if (e.sel && e.sel.g === d.g) e.sel = null;
  if (e.cur === d.g) e.cur = null;
  writeStore();
});
on('encnew', () => {
  if (!confirm('Clear the whole encounter?')) return false;
  store.enc = null;
  E();
  writeStore();
});
document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.id !== 'encq') return;
  encQ = t.value.toLowerCase();
  document.querySelectorAll('#encl [data-n]').forEach((r) => (r.style.display = !encQ || r.dataset.n.includes(encQ) ? '' : 'none'));
});

const encStyle = document.createElement('style');
encStyle.textContent =
  '.enc{max-width:720px;margin:0 auto}.ec-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.ec-top h2{margin:0}.ec{border:1px solid var(--line);border-radius:14px;background:var(--panel);padding:10px 12px;margin:8px 0}.ec.cur{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc)}.ec-h{display:flex;align-items:center;gap:12px;cursor:pointer}.ec .ec-n{flex:0 0 40px;width:40px;height:40px;min-height:40px;padding:0;border-radius:50%;background:var(--head);color:var(--ink);font:700 16px Fraunces,Georgia,serif}.ec-w{flex:1;min-width:0}.ec-w b{display:block;font:700 1.05rem Fraunces,Georgia,serif}.ec-w small{color:var(--mut)}.ec-hp{text-align:right}.ec-bar{height:8px;border-radius:4px;background:var(--line);overflow:hidden;margin-top:8px}.ec-bar i{display:block;height:100%;background:var(--ok)}.ec-bar i.lo{background:var(--acc)}.ec-mini{display:flex;gap:4px;margin-top:8px}.ec-mini .ec-bar{flex:1;margin:0}.ec-seg{display:flex;gap:4px;margin-top:10px;overflow-x:auto}.ec-seg button{flex:0 0 auto;min-height:40px;padding:4px 14px;background:var(--head);color:var(--ink)}.ec-seg button.on{background:var(--sel);box-shadow:inset 0 0 0 1px var(--acc)}.ec-a{display:flex;gap:8px;margin-top:10px}.ec-a input{flex:0 0 84px;width:84px;min-height:48px;text-align:center;font:600 1.3rem Fraunces,Georgia,serif}.ec-a button{flex:1;min-height:48px}.ec-m{display:flex;align-items:center;gap:10px;padding:6px 8px;margin-top:6px;border-radius:10px;cursor:pointer}.ec-m.on{background:var(--sel);box-shadow:inset 0 0 0 1px var(--acc)}.ec-m>span:first-child{flex:1}.ec-m.dn b{text-decoration:line-through;color:var(--mut)}.ec-btm{display:flex;gap:10px;margin:14px 0 4px}.ec-btm button{flex:1;min-height:48px}';
document.head.appendChild(encStyle);
