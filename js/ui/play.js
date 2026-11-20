/* Play tab: the sheet as you use it at the table. Hit points, stats, resources, spell slots, rests and prepared spells.
   Uses hdInfo()/hpInfo() from sheet.js and spellCard() from magic.js.
   Phone: header, hit points, four stat tiles, resource cards, spell slots, rests. Spell list and Cast buttons
   (phone: its own Spells view, only for spellcasters, with Cast buttons in the bottom sheet). Abilities only show on wide screens (see play.css). */
const ordTxt = (n) => n + (['st', 'nd', 'rd'][n - 1] || 'th');
const isSlotKey = (k) => /^slot\d$|^pact$/.test(k);

/* Spells you can cast right now: cantrips, known or prepared, always-prepared and feature spells, lowest level first. */
function playSpells(r) {
  const I = idx(),
    B = new Map(),
    add = (id, tag) => {
      if (I[id] && !B.has(id)) B.set(id, { s: I[id], tag });
    };
  featSpells(r).forEach((f) => add(f.id, f.note));
  casters(r).forEach((n) => {
    const st = spOf(n),
      md = MODE[n];
    st.c.forEach((id) => add(id, ''));
    domOf(r, n).forEach((id) => add(id, 'always prepared'));
    (md === 'known' ? st.k : st.p).forEach((id) => add(id, ''));
  });
  return [...B.values()].sort((a, b) => a.s.lvl - b.s.lvl || a.s.name.localeCompare(b.s.name));
}

const slotLeft = (R, k) => {
  const x = R.find((y) => y.k === k);
  return x ? x.max - Math.min((ch.used || {})[k] || 0, x.max) : 0;
};

function playHead(c) {
  const r = resolve(ch),
    rc = r.els.find((e) => e.type === 'Race'),
    sr = r.els.find((e) => e.type === 'Sub Race'),
    cn = Object.entries(classLevels(ch))
      .map(([k, n]) => ((idx()[k] || {}).name || '') + (Object.keys(classLevels(ch)).length > 1 ? ' ' + n : ''))
      .join(' / '),
    ini = (ch.name || 'Hero')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join(''),
    face = imgSrc(ch.img)
      ? `<img class="av big" src="${imgSrc(ch.img)}" alt="" style="margin:0;width:56px;height:56px">`
      : `<svg width="56" height="56" viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,4 90,27 90,73 50,96 10,73 10,27" fill="var(--sel)" stroke="var(--acc)" stroke-width="4"/><text x="50" y="61" text-anchor="middle" font-size="30" font-family="Fraunces,Georgia,serif" fill="var(--ink)">${esc(ini)}</text></svg>`;
  return `<div class="plhead">${face}<span class="plwho"><b>${esc(ch.name || 'Unnamed hero')}</b><small>Level ${ch.level} · ${esc((sr || rc || {}).name || '—')} ${esc(cn)}</small></span><button data-a="lvlwiz">Level up</button></div>`;
}

/* ---- hit points ----
   Damage / Heal / Temp HP first open a small amount row (plHp), then the existing hpdmg / hpheal / hptemp
   actions read the number from #hpamt, exactly as on the Sheet tab. */
let plHp = null; // 'dmg' | 'heal' | 'temp' while the amount row is open
const HPM = { dmg: ['hpdmg', 'Damage', 'Apply damage'], heal: ['hpheal', 'Heal', 'Apply healing'], temp: ['hptemp', 'Temp HP', 'Set temp HP'] };
on('plhpm', (d) => {
  plHp = d.v && d.v !== plHp ? d.v : null;
});
// capture phase: runs before events.js redraws, so the amount row closes after Apply or any other tap
document.addEventListener(
  'click',
  (e) => {
    const a = e.target.closest && e.target.closest('[data-a]');
    if (a && a.dataset.a !== 'plhpm') plHp = null;
  },
  true,
);

/* ---- phone views: Play | Features | Skills (the switch is hidden on wide screens, see homephone.css) ---- */
let plView = 'play';
const plOpen = new Set(); // feature dropdowns the person has opened (kept across redraws)
on('plview', (d) => {
  plView = d.v || 'play';
  const mm = $('#main');
  if (mm) mm.scrollTop = 0;
  window.scrollTo(0, 0);
});
document.addEventListener(
  'toggle',
  (e) => {
    const d = e.target;
    if (d && d.matches && d.matches('details.plf')) d.open ? plOpen.add(d.dataset.id) : plOpen.delete(d.dataset.id);
  },
  true,
);
/* The Spells view only exists for spellcasters (Wizard, Eldritch Knight, ...): it sits between Play and Features. */
const plViews = (sp) => [['play', 'Play'], ...(sp ? [['spells', 'Spells']] : []), ['features', 'Features'], ['skills', 'Skills']];
const plSwitch = (v, sp) =>
  `<div class="plswitch" role="group" aria-label="Screen">${plViews(sp).map(([k, n]) => `<button class="${k === v ? 'on' : ''}" data-a="plview" data-v="${k}">${n}</button>`).join('')}</div>`;

/* Features, grouped by where they come from (class, subclass, race, background, feats). Each one is a dropdown. */
function playFeatures(r, R) {
  const own = {},
    rank = (t) => (t === 'Class' ? 0 : t === 'Subclass' ? 1 : t === 'Race' || t === 'Sub Race' ? 2 : t === 'Background' ? 3 : 4),
    G = new Map();
  r.els.forEach((e) =>
    (e.rules || []).forEach((x) => {
      if (x.grant && !own[x.grant]) own[x.grant] = e;
    }),
  );
  r.els
    .filter((e) => /Trait|Feature|Style|^Feat$/.test(e.type))
    .forEach((f) => {
      const o = own[f.id],
        k = o ? o.name : f.type === 'Feat' ? 'Feats' : 'Other',
        rk = o ? rank(o.type) : f.type === 'Feat' ? 5 : 6;
      if (!G.has(k)) G.set(k, { rk, list: [] });
      G.get(k).list.push(f);
    });
  if (!G.size) return '<p class="hint">Features from your race, class and background appear here.</p>';
  return [...G]
    .sort((a, b) => a[1].rk - b[1].rk)
    .map(
      ([k, g]) =>
        `<div class="plsp-h plgh"><span>${esc(k)}</span><small class="hint">${g.list.length}</small></div>` +
        g.list
          .map((f) => {
            const u = R.find((x) => x.n.toLowerCase() === f.name.toLowerCase()),
              chip = u && u.max !== Infinity ? `<span class="plfu">${u.max - Math.min((ch.used || {})[u.k] || 0, u.max)} / ${u.max}</span>` : '',
              body = INFO[f.id] && INFO[f.id][0] === '<' ? clean(INFO[f.id]) : '<p>' + esc(f.desc || '') + '</p>';
            return `<details class="plf" data-id="${esc(f.id)}"${plOpen.has(f.id) ? ' open' : ''}><summary><span>${esc(f.name)}</span>${chip}</summary>${body}</details>`;
          })
          .join(''),
    )
    .join('');
}

/* Abilities, saving throws and skills, in compact form. */
function playSkills(c) {
  const dot = (p, x) => (x ? '◆' : p ? '●' : '○'),
    ab = AB.map((a) => `<div class="ab"><span>${a.toUpperCase()}</span><b>${sg(mod(c.sc[a]))}</b><span>${c.sc[a]}</span></div>`).join(''),
    sv = AB.map((a) => `<li class="${c.sv[a].p ? 'p' : ''}"><span>${dot(c.sv[a].p)} ${AN[a]}</span><b>${sg(c.sv[a].v)}</b></li>`).join(''),
    sk = Object.entries(c.sk)
      .map(([n, s]) => `<li class="${s.p ? 'p' : ''}"><span>${dot(s.p, s.x)} ${esc(n)}</span><b>${sg(s.v)}</b></li>`)
      .join('');
  return `<div class="abg">${ab}</div><div class="plsp-h">Saving throws</div><ul class="sk plsk">${sv}</ul><div class="plsp-h">Skills</div><ul class="sk plsk">${sk}</ul><p class="hint">● proficient · ◆ expertise · Initiative ${sg(c.init)} · Passive Perception ${c.pp}</p>`;
}

function playHp(c) {
  const h = hpInfo(c);
  if (!h.max) return '';
  const pct = Math.round((h.now / h.max) * 100),
    tone = pct <= 25 ? 'crit' : pct <= 50 ? 'lo' : '',
    hd = hdInfo(),
    left = hd.reduce((s, x) => s + x.left, 0),
    tot = hd.reduce((s, x) => s + x.n, 0),
    dice = [...new Set(hd.map((x) => 'd' + x.d))].join('/'),
    nxt = hd.find((x) => x.left > 0),
    hdBtn = hd.length
      ? `<button class="plhd" data-a="hdspend" data-c="${esc((nxt || hd[0]).k)}"${nxt ? '' : ' disabled'} aria-label="Spend a hit die">Hit dice ${left} / ${tot} · ${dice}</button>`
      : '',
    act =
      plHp && HPM[plHp]
        ? `<div class="plamt"><button class="alt" data-a="plhpm" data-v="" aria-label="Cancel">✕</button><input type="number" id="hpamt" min="1" value="1" inputmode="numeric" aria-label="${HPM[plHp][1]} amount"><button data-a="${HPM[plHp][0]}">${HPM[plHp][2]}</button></div>`
        : `<div class="plhb">${Object.entries(HPM)
            .map(([k, v]) => `<button class="alt" data-a="plhpm" data-v="${k}">${v[1]}</button>`)
            .join('')}</div>`;
  return (
    `<section class="hpcard"><div class="plhh"><span>Hit points</span>${hdBtn}</div>` +
    `<div class="hpnum"><button data-a="hp" data-d="-1" aria-label="Lose 1 hit point">−</button><div class="hpv"><b>${h.now}</b><span> / ${h.max}</span>${h.temp ? `<small>+${h.temp} temporary</small>` : h.now === 0 ? '<small>Down at 0 hit points</small>' : ''}</div><button data-a="hp" data-d="1" aria-label="Gain 1 hit point">+</button></div>` +
    `<div class="hpbar" role="progressbar" aria-label="Hit points" aria-valuemin="0" aria-valuemax="${h.max}" aria-valuenow="${h.now}"><i class="${tone}" style="width:${pct}%"></i></div>` +
    act +
    '</section>'
  );
}

/* ---- resources: filled dots are uses left; tap a spent (empty) dot to get one back ---- */
function playRes(R) {
  return R.filter((x) => !isSlotKey(x.k))
    .map((x) => {
      const inf = x.max === Infinity,
        u = inf ? 0 : Math.min((ch.used || {})[x.k] || 0, x.max),
        left = inf ? '∞' : x.max - u,
        k = esc(x.k),
        m = inf ? 0 : x.max,
        dots = !inf && x.max <= 12,
        pips = dots
          ? `<span class="pips" role="group" aria-label="${left} of ${x.max} left">${'<i class="on"></i>'.repeat(x.max - u)}${`<i class="used" role="button" aria-label="Get one back" data-a="res" data-k="${k}" data-d="-1" data-m="${m}"></i>`.repeat(u)}</span>`
          : `<b>${left}${inf ? '' : ' / ' + x.max}</b>`;
      return (
        `<section class="plres"><span class="plmain"><b>${esc(x.n)}</b><small>${x.note ? esc(x.note) + ' · ' : ''}back on a ${x.rest === 'S' ? 'short' : 'long'} rest</small>${pips}</span>` +
        `<span class="plbtn"><button data-a="res" data-k="${k}" data-d="1" data-m="${m}"${left === 0 ? ' disabled' : ''}>Use one</button>${dots ? '' : `<button class="lnk" data-a="res" data-k="${k}" data-d="-1" data-m="${m}">Restore</button>`}</span></section>`
      );
    })
    .join('');
}

function playSlots(R, c, r) {
  const S = R.filter((x) => isSlotKey(x.k));
  if (!S.length) return '';
  const ci = casterInfo(r, c);
  return (
    `<section class="plres" style="display:block"><div class="bar" style="justify-content:space-between"><b>Spell slots</b><span class="hint">${ci ? 'Save DC ' + ci.dc + ' · Attack ' + sg(ci.atk) : ''}</span></div>` +
    `<div class="slots">${S.map((x) => {
      const left = slotLeft(R, x.k),
        lab = x.k === 'pact' ? 'Pact' : 'L' + x.k.slice(4);
      return `<button class="slot${left === 0 ? ' empty' : left < x.max ? ' part' : ''}" data-a="plslot" data-k="${x.k}" data-m="${x.max}" aria-label="${esc(x.n)}: ${left} of ${x.max} left. Tap to spend one, tap when empty to get one back"><small>${lab}</small><b>${left}/${x.max}</b></button>`;
    }).join('')}</div></section>`
  );
}

function playSpellList(r, R) {
  const L = playSpells(r);
  if (!L.length) return '';
  let h = '',
    last = -1;
  L.forEach(({ s, tag }) => {
    if (s.lvl !== last) {
      last = s.lvl;
      h += `<div class="ph"><span>${s.lvl === 0 ? 'Cantrips' : ordTxt(s.lvl) + ' level'}</span><span class="src">${s.lvl === 0 ? 'at will' : slotLeft(R, 'slot' + s.lvl) + ' slots left'}</span></div>`;
    }
    h += `<div class="rw${pv && pv.k === 'spell' && pv.id === s.id ? ' pv' : ''}" data-a="plpv" data-id="${esc(s.id)}"><span>${esc(s.name)}</span><span class="src">${esc(tag)}</span></div>`;
  });
  return '<h3 style="margin-top:18px">Spells you can cast</h3><p class="hint">Tap a spell to read it and cast it.</p>' + h;
}

function playDetail(r, R) {
  const s = pv && pv.k === 'spell' && idx()[pv.id];
  if (!s) return '<p class="hint">Tap a spell to read it and cast it.</p>';
  let h = spellCard(s);
  if (s.lvl === 0) return h + '<p class="hint">A cantrip: cast it as often as you like.</p>';
  const o = [];
  for (let l = s.lvl; l <= 9; l++) {
    const left = slotLeft(R, 'slot' + l);
    if (left > 0) o.push({ k: 'slot' + l, t: ordTxt(l) + ' level (' + left + ' left)' });
  }
  const S = slotsFor(r);
  if (S.pact && S.pact.l >= s.lvl && slotLeft(R, 'pact') > 0) o.push({ k: 'pact', t: 'a pact slot, level ' + S.pact.l + ' (' + slotLeft(R, 'pact') + ' left)' });
  return (
    h +
    (o.length
      ? '<div class="bar" style="margin-top:10px">' +
        o.map((x, i) => `<button class="${i ? 'alt' : ''}" data-a="plcast" data-k="${x.k}" data-id="${esc(s.id)}">Cast at ${x.t}</button>`).join('') +
        '</div>'
      : '<p class="hint">No spell slots left that can cast this. Rest to get them back.</p>')
  );
}

/* Phone only (see .pl-links in homephone.css): the things the old action row used to hold. */
const PL_LINKS = [
  ['tab', 'manage', 'Manage'],
  ['pdf', '', 'Export PDF'],
  ['save', '', 'Save'],
  ['opt', '', 'Options'],
  ['lvl', '', 'Level &amp; HP'],
];

function renderPlay() {
  const m = $('#main'),
    r = resolve(ch),
    c = calc(ch, r);
  ch.used = ch.used || {};
  if (!r.cls || !c.hp) {
    m.className = 'main one';
    m.innerHTML = '<div class="left"><p class="hint">Choose a class on the Build tab, then come back here to play.</p></div>';
    return;
  }
  m.className = 'main plmain';
  const sp = casters(r).length > 0;
  if (plView === 'spells' && !sp) plView = 'play';
  m.dataset.v = plView;
  const R = resources(r, c),
    tiles = [['AC', c.ac], ['Init', sg(c.init)], ['Speed', c.speed + ' ft'], ['Prof', sg(c.pb)]]
      .map(([n, v]) => `<div class="stat"><b>${v}</b><span>${n}</span></div>`)
      .join(''),
    abil = AB.map((a) => `<div class="ab"><span>${a.toUpperCase()}</span><b>${sg(mod(c.sc[a]))}</b><span>${c.sc[a]}</span></div>`).join(''),
    rest = '<div class="bar plrest" style="margin-top:4px"><button class="alt" data-a="rest" data-v="S">Short rest</button><button class="alt" data-a="rest" data-v="L">Long rest</button></div>',
    links = '<div class="pl-links">' + PL_LINKS.map(([a, v, n]) => `<button class="lnk" data-a="${a}"${v ? ` data-v="${v}"` : ''}>${n}</button>`).join('') + '</div>';
  m.innerHTML =
    `<div class="left"><div class="plgrid"><div class="plcol">${playHead(c)}${plSwitch('play', sp)}${playHp(c)}<div class="stats">${tiles}</div></div>` +
    `<div class="plcol">${playRes(R)}${playSlots(R, c, r)}${rest}<div class="plspells">${playSpellList(r, R)}</div>${links}</div></div>` +
    (sp ? `<div class="plspv">${playHead(c)}${plSwitch('spells', sp)}${playSlots(R, c, r)}${playSpellList(r, R) || '<p class="hint">No spells chosen yet. Pick them on the Spells tab.</p>'}${links}</div>` : '') +
    `<div class="plfeat">${playHead(c)}${plSwitch('features', sp)}${playFeatures(r, R)}${links}</div>` +
    `<div class="plskills">${playHead(c)}${plSwitch('skills', sp)}${playSkills(c)}${links}</div></div>` +
    `<div class="right">${playDetail(r, R)}<div class="plabil">${abil}</div></div>`;
  if (plHp) {
    const i = $('#hpamt');
    if (i) {
      i.focus();
      i.select();
    }
  }
}

on('plpv', (d) => {
  pv = { id: d.id, k: 'spell' }; // a single tap only reads the spell; Cast is a separate button
});
on('plslot', (d) => {
  ch.used = ch.used || {};
  const max = +d.m || 0,
    u = Math.min(ch.used[d.k] || 0, max);
  ch.used[d.k] = u < max ? u + 1 : Math.max(0, u - 1);
});
on('plcast', (d) => {
  const s = idx()[d.id],
    R = resources(resolve(ch), calc(ch, resolve(ch))),
    x = R.find((y) => y.k === d.k);
  if (!s || !x || slotLeft(R, d.k) < 1) {
    note('No slot left for that.');
    return false;
  }
  ch.used = ch.used || {};
  ch.used[d.k] = Math.min(x.max, (ch.used[d.k] || 0) + 1);
  note('Cast ' + s.name + ' using ' + (d.k === 'pact' ? 'a pact slot' : 'a ' + ordTxt(+d.k.slice(4)) + '-level slot') + '.');
});
