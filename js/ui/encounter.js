/* Encounter (DM mode, monster side): run a fight with monsters only.
   Monsters of the same kind form a group with one initiative roll. The party is a single row with a typed
   initiative. Damage and healing are typed amounts, to one monster or the whole group.
   Load after monster.js (needs monCalc, MXP, refMons, fromRef, monSummary) and events.js (needs on). */
const E = () => {
  const e = (store.enc = store.enc || { round: 1, cur: null, party: null, groups: [], sel: null, amt: 5, players: [] });
  e.players = e.players || []; // players / player groups: a name and an initiative, no hit points
  return e;
};
let encPick = false,
  encQ = '',
  encForm = null, // in-page form: { t: 'init', g } for one initiative, { t: 'add' } for adding players; also name / v / err drafts
  encSB = null, // stat block of the selected monster(s): null = default (on when the screen is wide enough for its own column, off on phones), true / false once toggled
  encTarget = '', // picker: '' = auto, 'newmix' = start a mixed group, or a group id to add into
  encAsk = false; // "Clear the whole encounter?" question is showing
const d20 = () => Math.floor(Math.random() * 20) + 1;
const encLetter = (k) => (k < 26 ? String.fromCharCode(65 + k) : String(k + 1));
const encAlive = (g) => g.mem.some((m) => m.hp > 0);
/* A group is one turn-order entry. Normally it holds one kind of monster (stats on the group). A mixed group (g.mixed)
   holds different kinds: each member then carries its own name, AC, max hit points, XP and key. */
const mOf = (g, m) => ({ name: m.name || g.name, ac: m.ac != null ? m.ac : g.ac, mx: m.mx != null ? m.mx : g.hp, xp: m.xp != null ? m.xp : g.xp });
const encLab = (g, m) => {
  const nm = m.name || g.name;
  return !g.mixed || g.mem.filter((x) => (x.name || g.name) === nm).length > 1 ? nm + ' ' + m.n : nm;
};
const encTitle = (g) => {
  if (!g.mixed) return g.name + (g.mem.length > 1 ? ' ×' + g.mem.length : '');
  const c = new Map();
  g.mem.forEach((m) => c.set(m.name || g.name, (c.get(m.name || g.name) || 0) + 1));
  return [...c].map(([n, k]) => n + (k > 1 ? ' ×' + k : '')).join(' + ');
};
const encAc = (g) => {
  const a = g.mem.map((m) => mOf(g, m).ac);
  if (!a.length) return g.ac;
  const lo = Math.min(...a), hi = Math.max(...a);
  return lo === hi ? lo : lo + '–' + hi;
};
const encXp = (g) => g.mem.reduce((s, m) => s + mOf(g, m).xp, 0);
const encTot = (g) => g.mem.reduce((s, m) => s + mOf(g, m).mx, 0);
/* Stat blocks: the monster behind a member comes from "mine:<id>" (Monsters tab) or "ref:<id>" (SRD reference); monBlock() is in monster.js */
function encMonOf(key) {
  const i = key.indexOf(':'),
    kind = key.slice(0, i),
    id = key.slice(i + 1);
  if (kind === 'mine') return store.mons.find((x) => x.id === id) || null;
  const r = refMons().find((x) => x.id === id);
  return r ? fromRef(r) : null;
}
const encSBon = () => (encSB === null ? window.matchMedia('(min-width: 1300px)').matches : encSB);
function encSbHtml(g, sel) {
  if (!encSBon()) return '';
  const keys = [],
    add = (k) => keys.includes(k) || keys.push(k);
  if (sel && sel.t !== 'all' && g.mem[+sel.t]) add(g.mem[+sel.t].key || g.key);
  else g.mem.forEach((m) => add(m.key || g.key)); // whole group: one block per kind of monster
  return (
    keys.map((k) => { const m = encMonOf(k); return m ? `<div class="mb ec-sb">${monBlock(m)}</div>` : ''; }).join('') ||
    '<p class="hint">The stat block is not available (the monster was removed, or its source is turned off).</p>'
  );
}
const encSbBtn = () => `<button class="alt" data-a="encsb" style="margin-top:12px">${encSBon() ? 'Hide stat block' : 'Stat block'}</button>`;
const encStat = (g) => (g.mixed ? `AC ${encAc(g)} · ${encXp(g).toLocaleString()} XP` : `AC ${g.ac} · ${g.xp} XP${g.mem.length > 1 ? ' each' : ''}`);

/* ---- In-page forms (no browser pop-ups): set one initiative, add players, confirm a new encounter ---- */
const encFocus = (sel) =>
  setTimeout(() => {
    const el = $(sel);
    if (el) {
      el.focus();
      if (el.select) el.select();
    }
  }, 60);

/* Linked monsters: a group can share its initiative with another group (g.link = that group's id), so different monsters act on one number. */
function encRoot(g) {
  const gs = E().groups,
    seen = new Set();
  while (g.link && !seen.has(g.id)) {
    seen.add(g.id);
    const n = gs.find((x) => x.id === g.link);
    if (!n) break;
    g = n;
  }
  return g;
}
function encSetInit(g, v) {
  const r = encRoot(g);
  r.init = v;
  E().groups.forEach((x) => {
    if (encRoot(x) === r) x.init = v;
  });
}
const encLinkTxt = (g) => {
  const t = g.link && E().groups.find((x) => x.id === g.link);
  return t ? ' · same initiative as ' + esc(t.name) : '';
};

function encInitForm(k) {
  const f = encForm;
  if (!f || f.t !== 'init' || f.g !== k) return '';
  const e = E(),
    pl = e.players.find((x) => x.id === k),
    g = e.groups.find((x) => x.id === k),
    name = pl ? pl.name : g ? g.name : 'Party',
    cur = pl ? pl.init : g ? g.init : e.party,
    v = f.v != null ? f.v : cur == null ? '' : cur,
    others = g ? e.groups.filter((x) => x !== g && encRoot(x) !== g) : [], // not itself, and not one that already follows it (no loops)
    link =
      g && others.length
        ? '<p class="hint" style="margin:10px 0 4px">Monsters that act together share one initiative.</p>' +
          `<select id="encfl" aria-label="Same initiative as" style="max-width:none"><option value="">Own initiative</option>${others
            .map((x) => `<option value="${esc(x.id)}"${g.link === x.id ? ' selected' : ''}>Same as ${esc(x.name)}${x.mem.length > 1 ? ' ×' + x.mem.length : ''} (${x.init == null ? '–' : x.init})</option>`)
            .join('')}</select>`
        : '';
  return (
    `<div class="ec-form"><b>Initiative · ${esc(name)}</b><div class="ec-fr">` +
    `<input type="number" id="encfi" inputmode="numeric" value="${esc(String(v))}" placeholder="Initiative" aria-label="Initiative">` +
    '<button data-a="encfok">Set</button><button class="alt" data-a="encfx">Cancel</button></div>' +
    link +
    (f.err ? `<p class="ec-err">${esc(f.err)}</p>` : '') +
    '</div>'
  );
}

function encPanel() {
  let h = '';
  const f = encForm;
  if (f && f.t === 'add') {
    const have = E().players.map((p) => p.name.toLowerCase()),
      chars = store.chars.filter((c) => !c.dm && c.name && !have.includes(c.name.toLowerCase())),
      names = (have.includes('party') ? [] : ['Party']).concat(chars.map((c) => c.name)); // "Party" = one group row that acts together
    h +=
      '<div class="ec-form" id="encaddf"><b>Add player or group</b>' +
      (names.length
        ? '<div class="ec-chips">' + names.map((n) => `<button class="alt" data-a="encchip" data-n="${esc(n)}">${esc(n)}</button>`).join('') + '</div>'
        : '') +
      '<div class="ec-fr">' +
      `<input type="text" id="encfn" placeholder="Name (a player, or a group like Party)" value="${esc(f.name || '')}" aria-label="Name" autocomplete="off">` +
      `<input type="number" id="encfi" inputmode="numeric" value="${esc(String(f.v || ''))}" placeholder="Init" aria-label="Initiative">` +
      '<button data-a="encfok">Add</button><button class="alt" data-a="encfx">Done</button></div>' +
      (f.err ? `<p class="ec-err">${esc(f.err)}</p>` : '') +
      '<p class="hint">Press Enter to go from name to initiative, then again to add. The form stays open for the next player. Leave initiative empty to set it later.</p></div>';
  }
  if (encAsk)
    h +=
      '<div class="ec-form"><b>Clear the whole encounter?</b><p class="hint" style="margin:4px 0 0">Your players stay in the list, with their initiative cleared.</p>' +
      '<div class="ec-fr"><button data-a="encnewyes">Clear it</button><button class="alt" data-a="encnewno">Keep it</button></div></div>';
  return h;
}

function encOrder() {
  const e = E(),
    L = e.groups.map((g, i) => ({ k: g.id, g, i, init: g.init }));
  if (e.players.length) e.players.forEach((p) => L.push({ k: p.id, pl: p, i: -1, init: p.init }));
  else L.push({ k: 'p', p: true, i: -1, init: e.party }); // no players added yet: the single Party row
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
    `<span class="ec-w"><b>${esc(encTitle(g))}</b><small>${cur ? 'Acting now · ' : ''}${n > 1 ? up + ' of ' + n + ' up · ' : ''}${encStat(g)}${encLinkTxt(g)}</small></span>` +
    (n === 1 ? `<span class="ec-hp"><b>${one.hp} / ${mOf(g, one).mx}</b></span>` : '') +
    '</div>';
  if (n === 1) h += encBar(one.hp, mOf(g, one).mx);
  else if (!open) h += '<div class="ec-mini">' + g.mem.map((m) => encBar(m.hp, mOf(g, m).mx)).join('') + '</div>';
  if (open) {
    if (n > 1)
      h +=
        '<div class="ec-seg">' +
        `<button class="${sel.t === 'all' ? 'on' : ''}" data-a="encsel" data-g="${gid}" data-t="all">Whole group</button>` +
        g.mem.map((m, i) => `<button class="${String(sel.t) === String(i) ? 'on' : ''}" data-a="encsel" data-g="${gid}" data-t="${i}">${esc(g.mixed ? encLab(g, m) : m.n)}</button>`).join('') +
        '</div>';
    h += `<div class="ec-a"><input type="number" id="encamt" min="1" value="${E().amt || 5}" inputmode="numeric" aria-label="Amount"><button data-a="encdmg">Damage</button><button class="alt" data-a="encheal">Heal</button></div>`;
    if (n > 1) {
      h += g.mem
        .map(
          (m, i) =>
            `<div class="ec-m${String(sel.t) === String(i) ? ' on' : ''}${m.hp <= 0 ? ' dn' : ''}" data-a="encsel" data-g="${gid}" data-t="${i}"><span><b>${esc(encLab(g, m))}</b>${encBar(m.hp, mOf(g, m).mx)}</span><span>${m.hp <= 0 ? 'Down' : m.hp + ' / ' + mOf(g, m).mx}</span></div>`,
        )
        .join('');
      if (sel.t === 'all') h += '<p class="hint">Applies to each one still up. Ones already down are skipped.</p>';
    }
    h += encSbBtn() + encSbHtml(g, sel) + `<div><button class="lnk" data-a="encrm" data-g="${gid}" style="margin-top:10px">Remove from encounter</button></div>`;
  }
  return h + '</div>';
}

const encPlayerRow = (p, cur) =>
  `<div class="ec${cur ? ' cur' : ''}"><div class="ec-h"><button class="ec-n" data-a="encinit" data-g="${esc(p.id)}" aria-label="Set initiative">${p.init == null ? '–' : p.init}</button><span class="ec-w"><b>${esc(p.name)}</b><small>${cur ? 'Acting now · ' : ''}Player · no hit points tracked</small></span><button class="lnk" data-a="encrmpl" data-g="${esc(p.id)}">Remove</button></div></div>`;

function encBody() {
  const e = E(),
    L = encOrder(),
    cur = e.cur && L.some((x) => x.k === e.cur) ? e.cur : L[0].k,
    xp = e.groups.reduce((s, g) => s + encXp(g), 0);
  const rows = L.map((en) =>
    (en.p
      ? `<div class="ec${cur === 'p' ? ' cur' : ''}"><div class="ec-h"><button class="ec-n" data-a="encinit" data-g="p" aria-label="Set party initiative">${e.party == null ? '–' : e.party}</button><span class="ec-w"><b>Party</b><small>${cur === 'p' ? 'Acting now · ' : ''}Players act together</small></span></div></div>`
      : en.pl
        ? encPlayerRow(en.pl, cur === en.k)
        : encCard(en, cur === en.k, e.sel)) + encInitForm(en.k),
  ).join('');
  return (
    `<div class="ec-top"><div><h2>Encounter</h2><span class="hint">Round ${e.round} · ${xp.toLocaleString()} XP</span></div><button data-a="encnext">Next turn</button></div>` +
    rows +
    encPanel() +
    (e.groups.length ? '' : '<p class="hint">No monsters yet. Choose Add monsters.</p>') +
    '<div class="ec-btm"><button data-a="encadd">Add monsters</button><button class="alt" data-a="encroll">Roll initiative</button></div>' +
    '<button class="alt" data-a="encaddpl" style="width:100%;min-height:48px;margin-top:8px">Add player or group</button>' +
    '<button class="lnk" data-a="encnew">New encounter</button>'
  );
}

function encPicker() {
  const have = {};
  E().groups.forEach((g) => g.mem.forEach((m) => (have[m.key || g.key] = (have[m.key || g.key] || 0) + 1)));
  const row = (s, id, name, sub) =>
    `<div class="rw" data-n="${esc(name.toLowerCase())}" data-a="encpick" data-s="${s}" data-id="${esc(id)}"${encQ && !name.toLowerCase().includes(encQ) ? ' style="display:none"' : ''}><span>${esc(name)}${have[s + ':' + id] ? ' <b>×' + have[s + ':' + id] + '</b>' : ''}</span><span class="src">${esc(sub)}</span></div>`;
  return (
    '<div class="ec-top"><h2>Add monsters</h2><button data-a="encdone">Done</button></div>' +
    '<select id="encgt" aria-label="Add into" style="max-width:none;margin-bottom:8px">' +
    `<option value="">Auto: the same monster stacks, others get their own entry</option><option value="newmix"${encTarget === 'newmix' ? ' selected' : ''}>Start a new mixed group (different monsters, one initiative)</option>` +
    E().groups.map((g) => `<option value="${esc(g.id)}"${encTarget === g.id ? ' selected' : ''}>Add into: ${esc(encTitle(g))} (initiative ${g.init == null ? '–' : g.init})</option>`).join('') +
    '</select>' +
    `<input type="text" id="encq" placeholder="Search monsters…" value="${esc(encQ)}">` +
    '<div id="encl">' +
    (store.mons.length ? '<div class="ph"><span>My monsters</span></div>' + store.mons.map((m) => row('mine', m.id, m.name || 'Unnamed monster', monSummary(m))).join('') : '') +
    '<div class="ph"><span>SRD reference</span></div>' +
    (refMons().map((r) => row('ref', r.id, r.name, 'CR ' + ((r.stat && r.stat.cr) || '?'))).join('') || '<p class="hint">No monsters loaded. Turn on a source with monsters.</p>') +
    '</div>'
  );
}

/* ---- Desktop layout (1000px and wider): turn order on the left, the selected combatant on the right.
   Uses the same actions as the phone layout (encdmg, encheal, encinit, encnext ...), so nothing else changes. ---- */
const encWide = () => window.matchMedia('(min-width: 1000px)').matches;

function encRowD(en, cur, sel) {
  const e = E();
  if (en.pl)
    return `<div class="ed-r${cur ? ' cur' : ''}"><button class="ec-n" data-a="encinit" data-g="${esc(en.pl.id)}" aria-label="Set initiative">${en.pl.init == null ? '–' : en.pl.init}</button><span class="ed-w"><b>${esc(en.pl.name)}</b><small>${cur ? 'Acting now · ' : ''}Player · no hit points tracked</small></span><button class="lnk" data-a="encrmpl" data-g="${esc(en.pl.id)}">Remove</button></div>`;
  if (en.p)
    return `<div class="ed-r${cur ? ' cur' : ''}"><button class="ec-n" data-a="encinit" data-g="p" aria-label="Set party initiative">${e.party == null ? '–' : e.party}</button><span class="ed-w"><b>Party</b><small>${cur ? 'Acting now · ' : ''}Players act together</small></span></div>`;
  const g = en.g,
    gid = esc(g.id),
    n = g.mem.length,
    up = g.mem.filter((m) => m.hp > 0).length,
    tot = encTot(g),
    now = g.mem.reduce((a, m) => a + m.hp, 0);
  return (
    `<div class="ed-r${cur ? ' cur' : ''}${sel && sel.g === g.id ? ' sel' : ''}${up ? '' : ' dn'}" data-a="encfocus" data-g="${gid}">` +
    `<button class="ec-n" data-a="encinit" data-g="${gid}" aria-label="Set initiative">${g.init == null ? '–' : g.init}</button>` +
    `<span class="ed-w"><b>${esc(encTitle(g))}</b><small>${cur ? 'Acting now · ' : ''}${n > 1 ? up + ' of ' + n + ' up · ' : ''}AC ${encAc(g)}${encLinkTxt(g)}</small>${encBar(now, tot)}</span>` +
    `<span class="ed-hp">${now}<small> / ${tot}</small></span></div>`
  );
}

function encDetailD(e) {
  const s = e.sel,
    g = s && e.groups.find((x) => x.id === s.g);
  if (!g) return '<div class="ed-card"><h2 class="ed-t">Nothing selected</h2><p class="ed-s">Add monsters, then click one in the turn order to deal damage or heal.</p></div>';
  const gid = esc(g.id),
    n = g.mem.length,
    tot = encTot(g),
    now = g.mem.reduce((a, m) => a + m.hp, 0);
  let h =
    `<div class="ed-card"><div class="ed-hd"><div><h2 class="ed-t">${esc(encTitle(g))}</h2><p class="ed-s">${encStat(g)} · Initiative ${g.init == null ? '–' : g.init}</p></div><div class="ed-big">${now}<span> / ${tot}</span></div></div>` +
    encBar(now, tot);
  if (n > 1)
    h +=
      '<div class="ec-seg">' +
      `<button class="${s.t === 'all' ? 'on' : ''}" data-a="encmem" data-g="${gid}" data-t="all">Whole group</button>` +
      g.mem.map((m, i) => `<button class="${String(s.t) === String(i) ? 'on' : ''}" data-a="encmem" data-g="${gid}" data-t="${i}">${esc(g.mixed ? encLab(g, m) : m.n)}</button>`).join('') +
      '</div>';
  h += `<div class="ec-a"><input type="number" id="encamt" min="1" value="${e.amt || 5}" inputmode="numeric" aria-label="Amount"><button data-a="encdmg">Damage</button><button class="alt" data-a="encheal">Heal</button></div>`;
  if (n > 1) {
    h += g.mem
      .map(
        (m, i) =>
          `<div class="ec-m${String(s.t) === String(i) ? ' on' : ''}${m.hp <= 0 ? ' dn' : ''}" data-a="encmem" data-g="${gid}" data-t="${i}"><span><b>${esc(encLab(g, m))}</b>${encBar(m.hp, mOf(g, m).mx)}</span><span>${m.hp <= 0 ? 'Down' : m.hp + ' / ' + mOf(g, m).mx}</span></div>`,
      )
      .join('');
    if (s.t === 'all') h += '<p class="hint">Applies to each one still up. Ones already down are skipped.</p>';
  }
  return h + encSbBtn() + (encSBon() ? `<div class="ec-sbin">${encSbHtml(g, s)}</div>` : '') + `<div><button class="lnk" data-a="encrm" data-g="${gid}" style="margin-top:14px">Remove from encounter</button></div></div>`;
}

function encDesk() {
  const e = E(),
    L = encOrder(),
    cur = e.cur && L.some((x) => x.k === e.cur) ? e.cur : L[0].k,
    xp = e.groups.reduce((s, g) => s + encXp(g), 0);
  if (e.sel && !e.groups.some((g) => g.id === e.sel.g)) e.sel = null;
  if (!e.sel && e.groups.some((g) => g.id === cur)) e.sel = { g: cur, t: 'all' }; // the monster whose turn it is stays open
  const sbg = encSBon() && e.sel ? e.groups.find((g) => g.id === e.sel.g) : null; // stat block shown in its own column on wide screens
  return (
    `<div class="ed-bar"><div><h2>Encounter</h2><span class="hint">Round ${e.round} · ${xp.toLocaleString()} XP</span></div>` +
    '<div class="ed-btns"><button class="lnk" data-a="encnew">New encounter</button><button class="alt" data-a="encaddpl">Add player or group</button><button class="alt" data-a="encadd">Add monsters</button><button class="alt" data-a="encroll">Roll initiative</button><button data-a="encnext">Next turn</button></div></div>' +
    `<div class="ed-grid${sbg ? ' sb3' : ''}"><div class="ed-list"><div class="ed-lab">Turn order</div>${L.map((en) => encRowD(en, cur === en.k, e.sel) + encInitForm(en.k)).join('')}${encPanel()}${e.groups.length ? '' : '<p class="hint">No monsters yet. Choose Add monsters.</p>'}</div>` +
    `<div class="ed-side">${encDetailD(e)}</div>${sbg ? `<div class="ed-sbcol">${encSbHtml(sbg, e.sel)}</div>` : ''}</div>`
  );
}

function renderEnc() {
  const m = $('#main');
  m.className = 'main one';
  if (!encPick && encWide()) {
    m.innerHTML = '<div class="left enc-d">' + encDesk() + '</div>';
    return;
  }
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
    m.hp = sign < 0 ? Math.max(0, m.hp - n) : Math.min(mOf(g, m).mx, m.hp + n);
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
on('encfocus', (d) => {
  const e = E();
  if (!(e.sel && e.sel.g === d.g)) e.sel = { g: d.g, t: 'all' };
});
on('encmem', (d) => {
  E().sel = { g: d.g, t: d.t };
});
on('encinit', (d) => {
  encAsk = false;
  if (encForm && encForm.t === 'init' && encForm.g === d.g) encForm = null;
  else {
    encForm = { t: 'init', g: d.g };
    encFocus('#encfi');
  }
});
on('encaddpl', () => {
  encAsk = false;
  encForm = { t: 'add', name: '', v: '' };
  encFocus('#encfn');
  setTimeout(() => {
    const f = $('#encaddf');
    if (f && f.scrollIntoView) f.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 80);
});
on('encchip', (d) => {
  encForm = { t: 'add', name: d.n, v: '' };
  encFocus('#encfi');
});
on('encsb', () => {
  encSB = !encSBon();
});
on('encfx', () => {
  encForm = null;
});
on('encfok', () => {
  const f = encForm;
  if (!f) return false;
  const iv = $('#encfi'),
    raw = iv ? iv.value.trim() : '',
    v = parseFloat(raw),
    e = E(),
    lk = $('#encfl'),
    tgt = f.t === 'init' && lk && lk.value ? e.groups.find((x) => x.id === lk.value) : null;
  if (f.t === 'init') {
    if (!tgt && !isFinite(v)) {
      f.v = raw;
      f.err = 'Type a number for the initiative.';
      return;
    }
    const pl = e.players.find((x) => x.id === f.g),
      g = !pl && f.g !== 'p' ? e.groups.find((x) => x.id === f.g) : null;
    if (pl) pl.init = v;
    else if (g) {
      if (tgt) {
        g.link = tgt.id;
        encSetInit(g, encRoot(tgt).init);
      } else {
        delete g.link;
        encSetInit(g, v);
      }
    } else e.party = v;
    encForm = null;
    writeStore();
    return;
  }
  const nm = $('#encfn'),
    name = nm ? nm.value.trim() : '';
  f.name = name;
  f.v = raw;
  if (!name) {
    f.err = 'Type a name first.';
    encFocus('#encfn');
    return;
  }
  if (raw && !isFinite(v)) {
    f.err = 'Initiative must be a number (or leave it empty).';
    encFocus('#encfi');
    return;
  }
  e.players.push({ id: 'pl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), name, init: raw ? v : null });
  encForm = { t: 'add', name: '', v: '' }; // stay open for the next player
  writeStore();
  encFocus('#encfn');
});
on('encrmpl', (d) => {
  const e = E();
  e.players = e.players.filter((x) => x.id !== d.g);
  if (e.cur === d.g) e.cur = null;
  writeStore();
});
on('encnext', () => {
  const e = E(),
    L = encOrder(),
    i = Math.max(0, L.findIndex((x) => x.k === e.cur));
  for (let s = 1; s <= L.length; s++) {
    const en = L[(i + s) % L.length];
    if (en.p || en.pl || encAlive(en.g)) {
      if (i + s >= L.length) e.round++;
      e.cur = en.k;
      e.sel = en.p || en.pl ? null : { g: en.k, t: 'all' };
      break;
    }
  }
  writeStore();
});
on('encroll', () => {
  const e = E();
  e.groups.forEach((g) => {
    if (encRoot(g) === g) g.init = d20() + g.dx;
  });
  e.groups.forEach((g) => (g.init = encRoot(g).init)); // linked groups take their leader's roll
  e.round = 1;
  const L = encOrder();
  e.cur = L[0].k;
  e.sel = L[0].p || L[0].pl ? null : { g: L[0].k, t: 'all' };
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
  const e = E(),
    newId = () => 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
    mk = (mixed) => {
      const g = { id: newId(), key: s.key, name: s.name, ac: s.ac, hp: s.hp, xp: s.xp, dx: s.dx, init: d20() + s.dx, mem: [], next: 0 };
      if (mixed) {
        g.mixed = true;
        g.cnt = {};
      }
      e.groups.push(g);
      return g;
    };
  let g = null;
  if (encTarget === 'newmix') {
    g = mk(true);
    encTarget = g.id; // the next monsters you tap join this group
  } else if (encTarget) {
    g = e.groups.find((x) => x.id === encTarget) || null;
    if (!g) encTarget = '';
  }
  if (!g) g = e.groups.find((x) => !x.mixed && x.key === s.key) || mk(false);
  if (g.mixed || g.key !== s.key) {
    if (!g.mixed) {
      // a one-kind group gets a different monster: each member now carries its own stats
      g.mixed = true;
      g.cnt = { [g.key]: g.next };
      g.mem.forEach((m) => Object.assign(m, { mx: g.hp, name: g.name, ac: g.ac, xp: g.xp, key: g.key }));
    }
    g.cnt = g.cnt || {};
    const k = g.cnt[s.key] || 0;
    g.cnt[s.key] = k + 1;
    g.mem.push({ n: encLetter(k), hp: s.hp, mx: s.hp, name: s.name, ac: s.ac, xp: s.xp, key: s.key });
  } else g.mem.push({ n: encLetter(g.next++), hp: g.hp });
  writeStore();
  note('Added ' + s.name + (g.mixed ? ' to ' + encTitle(g) : ' (' + g.mem.length + ')') + '.');
});
on('encrm', (d) => {
  const e = E();
  e.groups = e.groups.filter((x) => x.id !== d.g);
  e.groups.forEach((x) => {
    if (x.link === d.g) delete x.link;
  });
  if (e.sel && e.sel.g === d.g) e.sel = null;
  if (e.cur === d.g) e.cur = null;
  writeStore();
});
on('encnew', () => {
  encForm = null;
  encAsk = true;
});
on('encnewno', () => {
  encAsk = false;
});
on('encnewyes', () => {
  encAsk = false;
  encForm = null;
  const keep = E().players.map((x) => ({ ...x, init: null }));
  store.enc = null;
  E().players = keep;
  writeStore();
});
document.addEventListener('change', (ev) => {
  if (ev.target && ev.target.id === 'encgt') encTarget = ev.target.value;
});
document.addEventListener('keydown', (ev) => {
  const t = ev.target;
  if (!t || (t.id !== 'encfn' && t.id !== 'encfi')) return;
  if (ev.key === 'Escape') {
    encForm = null;
    draw();
  } else if (ev.key === 'Enter') {
    ev.preventDefault();
    if (t.id === 'encfn' && encForm && encForm.t === 'add') {
      const i = $('#encfi');
      if (i) i.focus();
    } else {
      const b = document.querySelector('[data-a="encfok"]');
      if (b) b.click();
    }
  }
});
document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.id !== 'encq') return;
  encQ = t.value.toLowerCase();
  document.querySelectorAll('#encl [data-n]').forEach((r) => (r.style.display = !encQ || r.dataset.n.includes(encQ) ? '' : 'none'));
});

const encStyle = document.createElement('style');
encStyle.textContent =
  '.enc{max-width:720px;width:100%;margin:0 auto}.ec-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.ec-top h2{margin:0}.ec{border:1px solid var(--line);border-radius:14px;background:var(--panel);padding:10px 12px;margin:8px 0}.ec.cur{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc)}.ec-h{display:flex;align-items:center;gap:12px;cursor:pointer}.ec .ec-n{flex:0 0 40px;width:40px;height:40px;min-height:40px;padding:0;border-radius:50%;background:var(--head);color:var(--ink);font:700 16px Fraunces,Georgia,serif}.ec-w{flex:1;min-width:0}.ec-w b{display:block;font:700 1.05rem Fraunces,Georgia,serif}.ec-w small{color:var(--mut)}.ec-hp{text-align:right}.ec-bar{height:8px;border-radius:4px;background:var(--line);overflow:hidden;margin-top:8px}.ec-bar i{display:block;height:100%;background:var(--ok)}.ec-bar i.lo{background:var(--acc)}.ec-mini{display:flex;gap:4px;margin-top:8px}.ec-mini .ec-bar{flex:1;margin:0}.ec-seg{display:flex;gap:4px;margin-top:10px;overflow-x:auto}.ec-seg button{flex:0 0 auto;min-height:40px;padding:4px 14px;background:var(--head);color:var(--ink)}.ec-seg button.on{background:var(--sel);box-shadow:inset 0 0 0 1px var(--acc)}.ec-a{display:flex;gap:8px;margin-top:10px}.ec-a input{flex:0 0 84px;width:84px;min-height:48px;text-align:center;font:600 1.3rem Fraunces,Georgia,serif}.ec-a button{flex:1;min-height:48px}.ec-m{display:flex;align-items:center;gap:10px;padding:6px 8px;margin-top:6px;border-radius:10px;cursor:pointer}.ec-m.on{background:var(--sel);box-shadow:inset 0 0 0 1px var(--acc)}.ec-m>span:first-child{flex:1}.ec-m.dn b{text-decoration:line-through;color:var(--mut)}.ec-btm{display:flex;gap:10px;margin:14px 0 4px}.ec-btm button{flex:1;min-height:48px}';
encStyle.textContent += '@media (min-width:1000px){.enc-d{max-width:1180px;width:100%;margin:0 auto}.ed-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}.ed-bar h2{margin:0;font-size:2rem}.ed-btns{display:flex;align-items:center;gap:10px}.ed-btns button{min-height:44px}.ed-grid{display:grid;grid-template-columns:minmax(360px,440px) minmax(0,1fr);gap:16px;align-items:start}.ed-list{display:flex;flex-direction:column;gap:8px}.ed-lab{color:var(--mut);font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;margin:0 0 2px 4px}.ed-r{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--line);border-radius:14px;background:var(--panel);cursor:pointer}.ed-r:hover{border-color:var(--mut)}.ed-r.cur{border-color:var(--acc)}.ed-r.sel{background:var(--sel);box-shadow:0 0 0 1px var(--acc)}.ed-r .ec-n{flex:0 0 40px;width:40px;height:40px;min-height:40px;padding:0;border-radius:50%;background:var(--head);color:var(--ink);font:700 16px Fraunces,Georgia,serif}.ed-w{flex:1;min-width:0}.ed-w b{display:block;font:700 1.05rem Fraunces,Georgia,serif}.ed-w small{color:var(--mut)}.ed-w .ec-bar{height:6px;margin-top:6px}.ed-r.dn .ed-w b{text-decoration:line-through;color:var(--mut)}.ed-hp{text-align:right;font:700 1.1rem Fraunces,Georgia,serif}.ed-hp small{font:400 .8rem Figtree,system-ui,sans-serif;color:var(--mut)}.ed-card{position:sticky;top:0;padding:22px;border:1px solid var(--line);border-radius:18px;background:var(--panel)}.ed-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.ed-t{margin:0;font:700 2.1rem/1.1 Fraunces,Georgia,serif;text-transform:none}.ed-s{margin:4px 0 0;color:var(--mut)}.ed-big{font:700 3rem/1 Fraunces,Georgia,serif;white-space:nowrap}.ed-big span{font-size:1.25rem;font-weight:500;color:var(--mut)}.ed-card .ec-bar{height:10px;margin:14px 0 4px}.ed-card .ec-a{margin-top:16px}.ed-card .ec-a input{flex:0 0 96px;width:96px}}';
encStyle.textContent +=
  '.ec-form{border:1px solid var(--acc);border-radius:14px;background:var(--panel);padding:12px;margin:8px 0}.ec-form>b{display:block;font:700 1.05rem Fraunces,Georgia,serif}.ec-fr{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.ec-fr input{flex:1 1 130px;min-width:0;max-width:none;min-height:48px}.ec-fr input[type=number]{flex:0 0 96px;text-align:center}.ec-fr button{min-height:48px}.ec-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.ec-chips button{min-height:40px}.ec-err{color:var(--acc);margin:6px 0 0}';
encStyle.textContent +=
  '.ec-sb{margin-top:12px;max-width:560px}.ed-sbcol{display:none}@media (min-width:1300px){.enc-d:has(.sb3){max-width:1640px}.ed-grid.sb3{grid-template-columns:minmax(300px,380px) minmax(0,1fr) minmax(0,540px)}.ed-grid.sb3 .ed-sbcol{display:block;position:sticky;top:0;max-height:calc((100vh - 170px) / .85);overflow:auto}.ed-grid.sb3 .ed-sbcol .ec-sb:first-child{margin-top:0}.ed-grid.sb3 .ec-sbin{display:none}}';
encStyle.textContent +=
  '.enc,.enc *,.enc-d,.enc-d *{scrollbar-width:none;-ms-overflow-style:none}.enc::-webkit-scrollbar,.enc *::-webkit-scrollbar,.enc-d::-webkit-scrollbar,.enc-d *::-webkit-scrollbar{display:none}'; // everything still scrolls (wheel, trackpad, touch); only the bars are hidden
encStyle.textContent += '@media (min-width:1000px){.enc-d{zoom:.85}}'; // PC: show the encounter a bit smaller (change .85 to taste)
document.head.appendChild(encStyle);
/* mouse wheel over the member buttons scrolls them sideways, since their scroll bar is hidden */
document.addEventListener(
  'wheel',
  (ev) => {
    const sg = ev.target.closest && ev.target.closest('.ec-seg');
    if (sg && sg.scrollWidth > sg.clientWidth && Math.abs(ev.deltaY) > Math.abs(ev.deltaX)) {
      sg.scrollLeft += ev.deltaY;
      ev.preventDefault();
    }
  },
  { passive: false },
);

/* redraw when the window crosses the desktop width, so the right layout shows */
window.matchMedia('(min-width: 1300px)').addEventListener('change', () => {
  if (typeof draw === 'function' && typeof tab !== 'undefined' && tab === 'enc') draw();
});
window.matchMedia('(min-width: 1000px)').addEventListener('change', () => {
  if (typeof draw === 'function' && typeof tab !== 'undefined' && tab === 'enc') draw();
});
