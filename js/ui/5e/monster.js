/* Monster maker (DM mode). Monsters have their own tabs (Start / Build / Stat block), their own
   collection on the Start tab, and produce a stat block instead of the player character sheet. */
store.mons = store.mons || [];

const MSIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
const MDIE = { Tiny: 4, Small: 6, Medium: 8, Large: 10, Huge: 12, Gargantuan: 20 };
const MTYPES = [
  'aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental', 'fey',
  'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant', 'undead',
];
const MALIGN = [
  'unaligned', 'any alignment', 'any non-good alignment', 'any non-lawful alignment', 'any evil alignment', 'any chaotic alignment', 'lawful good', 'neutral good', 'chaotic good', 'lawful neutral',
  'neutral', 'chaotic neutral', 'lawful evil', 'neutral evil', 'chaotic evil',
];
const MCR = ['0', '1/8', '1/4', '1/2'].concat(Array.from({ length: 30 }, (_, i) => String(i + 1)));
const MXP = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300,
  7: 2900, 8: 3900, 9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
  16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000, 21: 33000, 22: 41000, 23: 50000,
  24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000,
};

const freshMon = () => ({
  id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
  name: '',
  size: 'Medium',
  type: 'beast',
  tags: '',
  align: 'unaligned',
  cr: '1',
  ab: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  ac: 10,
  acNote: '',
  hpAuto: true,
  hdn: 2,
  hp: 10,
  spd: { walk: 30, burrow: 0, climb: 0, fly: 0, swim: 0 },
  hover: false,
  saves: {},
  skills: {},
  vuln: '',
  res: '',
  imm: '',
  cimm: '',
  sen: { darkvision: 0, blindsight: 0, tremorsense: 0, truesight: 0 },
  langs: '',
  traits: [],
  actions: [],
  bonus: [],
  reactions: [],
  legN: 3,
  leg: [],
});
let mon = freshMon(), // the monster being edited
  msb = 'basic', // Build sub-tab
  mDelId = null;

const saveStore = () => {
  try {
    localStorage.setItem('aw-store', JSON.stringify(store));
  } catch (e) {}
};
function persistMon() {
  const i = store.mons.findIndex((x) => x.id === mon.id);
  i < 0 ? store.mons.push(mon) : (store.mons[i] = mon);
  saveStore();
}
const monSummary = (m) => m.size + ' ' + m.type + ' · CR ' + m.cr;

/* ---------- numbers ---------- */
const crNum = (cr) => (String(cr).includes('/') ? +cr.split('/')[0] / +cr.split('/')[1] : +cr);
const mPB = (cr) => {
  const n = crNum(cr);
  return n < 5 ? 2 : 2 + Math.ceil((n - 4) / 4);
};
function monCalc(m) {
  const pb = mPB(m.cr),
    mods = Object.fromEntries(AB.map((a) => [a, mod(+m.ab[a] || 10)])),
    die = MDIE[m.size] || 8,
    n = Math.max(1, +m.hdn || 1),
    cm = mods.con,
    avg = Math.max(1, Math.floor((n * (die + 1)) / 2 + n * cm)),
    hp = m.hpAuto ? avg : Math.max(1, +m.hp || 1),
    sk = (s) => +m.skills[s] || 0;
  return {
    pb,
    mods,
    die,
    hp,
    hpTxt: m.hpAuto ? hp + ' (' + n + 'd' + die + (cm ? (cm > 0 ? ' + ' : ' - ') + Math.abs(n * cm) : '') + ')' : String(hp),
    saves: AB.filter((a) => m.saves[a]).map((a) => AN[a].slice(0, 3) + ' ' + sg(mods[a] + pb)),
    skills: Object.keys(SK).filter(sk).map((s) => s + ' ' + sg(mods[SK[s]] + pb * sk(s))),
    pp: 10 + mods.wis + pb * sk('Perception'),
  };
}
function mSpeed(m) {
  const s = m.spd || {},
    p = [];
  if (+s.walk) p.push(s.walk + ' ft.');
  ['burrow', 'climb', 'fly', 'swim'].forEach((k) => {
    if (+s[k]) p.push(k + ' ' + s[k] + ' ft.' + (k === 'fly' && m.hover ? ' (hover)' : ''));
  });
  return p.join(', ') || '0 ft.';
}

/* ---------- the stat block as data (used by the preview and the PDF) ---------- */
function monModel(m) {
  const c = monCalc(m),
    name = m.name || 'Unnamed monster',
    sen = ['darkvision', 'blindsight', 'tremorsense', 'truesight']
      .filter((k) => +m.sen[k])
      .map((k) => k + ' ' + m.sen[k] + ' ft.');
  sen.push('passive Perception ' + c.pp);
  const secs = [];
  if (m.actions.length) secs.push({ h: 'Actions', list: m.actions });
  if (m.bonus.length) secs.push({ h: 'Bonus Actions', list: m.bonus });
  if (m.reactions.length) secs.push({ h: 'Reactions', list: m.reactions });
  if (m.leg.length)
    secs.push({
      h: 'Legendary Actions',
      list: m.leg,
      intro:
        'The ' + name.toLowerCase() + ' can take ' + (m.legN || 3) +
        " legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The " +
        name.toLowerCase() + ' regains spent legendary actions at the start of its turn.',
    });
  return {
    name,
    sub: m.size + ' ' + m.type + (m.tags ? ' (' + m.tags + ')' : '') + ', ' + String(m.align || 'unaligned').toLowerCase(),
    top: [
      ['Armor Class', m.ac + (m.acNote ? ' (' + m.acNote + ')' : '')],
      ['Hit Points', c.hpTxt],
      ['Speed', mSpeed(m)],
    ],
    abil: AB.map((a) => [a.toUpperCase(), (+m.ab[a] || 10) + ' (' + sg(c.mods[a]) + ')']),
    props: [
      ['Saving Throws', c.saves.join(', ')],
      ['Skills', c.skills.join(', ')],
      ['Damage Vulnerabilities', m.vuln],
      ['Damage Resistances', m.res],
      ['Damage Immunities', m.imm],
      ['Condition Immunities', m.cimm],
      ['Senses', sen.join(', ')],
      ['Languages', m.langs || '—'],
      ['Challenge', m.cr + ' (' + (MXP[m.cr] || 0).toLocaleString('en-US') + ' XP)'],
      ['Proficiency Bonus', sg(c.pb)],
    ].filter((x) => x[1]),
    traits: m.traits,
    secs,
  };
}
/* *stars* make italics in descriptions, like the printed books do for attack types */
const mRich = (t) => esc(t || '').replace(/\*([^*\n]+)\*/g, '<i>$1</i>').replace(/\n/g, '<br>');
const mRuns = (t, base) =>
  String(t || '')
    .split('*')
    .map((s, i) => ({ t: s, f: i % 2 ? (base === 'b' ? 'bi' : 'i') : base || 'r' }))
    .filter((r) => r.t);

function monBlock(m) {
  const M = monModel(m),
    pl = ([l, v]) => `<p class="mp"><b>${esc(l)}</b> ${esc(v)}</p>`,
    ent = (e) => `<p class="mp"><b><i>${esc(e.n || 'Unnamed')}.</i></b> ${mRich(e.d)}</p>`;
  return (
    `<h2>${esc(M.name)}</h2><div class="mbs">${esc(M.sub)}</div><hr>` +
    M.top.map(pl).join('') +
    `<hr><div class="mab">${M.abil.map(([a, v]) => `<div>${a}<span>${esc(v)}</span></div>`).join('')}</div><hr>` +
    M.props.map(pl).join('') +
    (M.traits.length ? '<hr>' + M.traits.map(ent).join('') : '') +
    M.secs
      .map((s) => `<h3>${s.h}</h3>` + (s.intro ? `<p class="mp">${esc(s.intro)}</p>` : '') + s.list.map(ent).join(''))
      .join('')
  );
}

/* ---------- editing helpers ---------- */
const mI = (path, label, val, type) =>
  `<label>${label}<input type="${type || 'text'}" data-mf="${path}" value="${esc(val == null ? '' : val)}"></label>`;
const mS = (path, label, val, opts, num) =>
  `<label>${label}<select data-mf="${path}"${num ? ' data-num' : ''}>${opts
    .map((o) => `<option${String(o) === String(val) ? ' selected' : ''}>${esc(o)}</option>`)
    .join('')}</select></label>`;
const mC = (path, label, on) =>
  `<label class="opt" style="font-weight:400;margin:0"><input type="checkbox" data-mf="${path}"${on ? ' checked' : ''}><span>${label}</span></label>`;
function mSet(path, val) {
  const k = path.split('.');
  let o = mon;
  for (let i = 0; i < k.length - 1; i++) {
    if (o[k[i]] == null) o[k[i]] = {};
    o = o[k[i]];
  }
  o[k[k.length - 1]] = val;
}
function mList(key, title, extra) {
  const a = mon[key];
  return (
    `<div class="ph"><span>${title}</span><span class="src">${a.length}</span></div>` +
    a
      .map(
        (e, i) =>
          `<div class="rw" style="cursor:default;display:block"><div class="bar"><input type="text" data-mf="${key}.${i}.n" value="${esc(e.n)}" placeholder="Name" style="max-width:260px"><button class="lnk" data-a="mmv" data-l="${key}" data-i="${i}" data-d="-1">↑</button><button class="lnk" data-a="mmv" data-l="${key}" data-i="${i}" data-d="1">↓</button><button class="lnk" data-a="mrm" data-l="${key}" data-i="${i}">✕</button></div><textarea rows="3" data-mf="${key}.${i}.d" placeholder="Description. Put *stars* around words to italicise them.">${esc(e.d)}</textarea></div>`,
      )
      .join('') +
    `<div class="bar"><button class="alt" data-a="madd" data-l="${key}">+ Add</button><button class="alt" data-a="mpopen" data-k="${key}">From reference</button>${extra || ''}</div>`
  );
}
function mCalcText() {
  const c = monCalc(mon);
  if (msb === 'basic') return 'Proficiency bonus ' + sg(c.pb) + ' · ' + (MXP[mon.cr] || 0).toLocaleString('en-US') + ' XP';
  if (msb === 'def') return 'Hit points ' + c.hpTxt + ' · hit die d' + c.die + ' (' + mon.size.toLowerCase() + ')';
  if (msb === 'sense') return 'Passive Perception ' + c.pp;
  return '';
}
function mRefresh() {
  const pv = $('#mpv'),
    cc = $('#mcalc');
  if (pv) pv.innerHTML = monBlock(mon);
  if (cc) cc.textContent = mCalcText();
  AB.forEach((a) => {
    const el = document.querySelector('[data-mod="' + a + '"]');
    if (el) el.textContent = sg(mod(+mon.ab[a] || 10));
  });
}

function mPane() {
  const m = mon;
  if (msb === 'basic')
    return `<div class="ph"><span>Basics</span></div><div class="fg">${mI('name', 'Name', m.name)}${mS('size', 'Size', m.size, MSIZES)}${mS('type', 'Type', m.type, MTYPES)}${mI('tags', 'Tags (optional, e.g. goblinoid)', m.tags)}${mS('align', 'Alignment', m.align, MALIGN)}${mS('cr', 'Challenge rating', m.cr, MCR)}</div><p class="hint" id="mcalc">${mCalcText()}</p>${mFillHtml()}`;
  if (msb === 'abil')
    return `<div class="ph"><span>Ability scores</span></div><p class="hint">Any score from 1 to 30.</p><div class="abs">${AB.map((a) => `<div class="abc"><small>${AN[a]}</small><input type="number" min="1" max="30" data-mf="ab.${a}" value="${m.ab[a]}" style="width:72px"><span class="m" data-mod="${a}">${sg(mod(+m.ab[a] || 10))}</span></div>`).join('')}</div>`;
  if (msb === 'def') {
    const sp = (k, n) => mI('spd.' + k, n + ' (ft)', m.spd[k], 'number');
    return (
      `<div class="ph"><span>Armor and hit points</span></div><div class="fg">${mI('ac', 'Armor class', m.ac, 'number')}${mI('acNote', 'Armor type (optional)', m.acNote)}</div>` +
      `<div class="bar" style="margin:8px 0">${mC('hpAuto', 'Work out hit points from hit dice', m.hpAuto)}</div><div class="fg">${m.hpAuto ? mI('hdn', 'Number of hit dice', m.hdn, 'number') : mI('hp', 'Hit points', m.hp, 'number')}</div><p class="hint" id="mcalc">${mCalcText()}</p>` +
      `<div class="ph"><span>Speed</span></div><div class="fg">${sp('walk', 'Walk')}${sp('burrow', 'Burrow')}${sp('climb', 'Climb')}${sp('fly', 'Fly')}${sp('swim', 'Swim')}</div><div class="bar" style="margin-top:6px">${mC('hover', 'Can hover', m.hover)}</div>` +
      `<div class="ph"><span>Saving throw proficiencies</span></div><div class="bar">${AB.map((a) => mC('saves.' + a, AN[a], m.saves[a])).join('')}</div>` +
      `<div class="ph"><span>Skills</span></div><div class="fg">${Object.keys(SK)
        .map(
          (s) =>
            `<label>${s} (${AN[SK[s]].slice(0, 3)})<select data-mf="skills.${s}" data-num>${[['0', '—'], ['1', 'Proficient'], ['2', 'Expertise']]
              .map(([v, t]) => `<option value="${v}"${(+m.skills[s] || 0) === +v ? ' selected' : ''}>${t}</option>`)
              .join('')}</select></label>`,
        )
        .join('')}</div>` +
      `<div class="ph"><span>Resistances and immunities</span></div><div class="fg">${mI('vuln', 'Damage vulnerabilities', m.vuln)}${mI('res', 'Damage resistances', m.res)}${mI('imm', 'Damage immunities', m.imm)}${mI('cimm', 'Condition immunities', m.cimm)}</div>`
    );
  }
  if (msb === 'sense')
    return `<div class="ph"><span>Senses</span></div><div class="fg">${['darkvision', 'blindsight', 'tremorsense', 'truesight'].map((k) => mI('sen.' + k, k[0].toUpperCase() + k.slice(1) + ' (ft)', m.sen[k], 'number')).join('')}</div><p class="hint" id="mcalc">${mCalcText()}</p><div class="ph"><span>Languages</span></div><div class="fg">${mI('langs', 'Languages (e.g. Common, Goblin; telepathy 60 ft.)', m.langs)}</div>`;
  if (msb === 'traits') return mList('traits', 'Traits');
  if (msb === 'actions')
    return (
      mList(
        'actions',
        'Actions',
        '<button class="alt" data-a="mtpl" data-t="multi">+ Multiattack</button><button class="alt" data-a="mtpl" data-t="melee">+ Melee attack</button><button class="alt" data-a="mtpl" data-t="ranged">+ Ranged attack</button>',
      ) +
      mList('bonus', 'Bonus actions') +
      mList('reactions', 'Reactions')
    );
  return `<div class="ph"><span>Legendary actions</span></div><div class="fg">${mS('legN', 'Legendary actions per round', m.legN, [1, 2, 3, 4, 5], true)}</div><p class="hint">The introduction text is added to the stat block for you.</p>${mList('leg', 'Options')}`;
}
function renderMBuild() {
  const m = $('#main');
  m.className = 'main';
  m.innerHTML = `<div class="left">${mPane()}</div><div class="right"><div class="mb" id="mpv">${monBlock(mon)}</div></div>`;
}
function renderMBlock() {
  const m = $('#main');
  m.className = 'main one';
  m.innerHTML = `<div class="left"><div class="bar"><button data-a="mpdf">Download stat block (PDF)</button><button class="alt" data-a="msave">Save monster file</button></div><div class="mb" id="mpv" style="max-width:540px;margin-top:12px">${monBlock(mon)}</div></div>`;
}

/* ---------- Start tab: the monster collection ---------- */
function monsHtml() {
  const cards = store.mons
    .map(
      (x) =>
        `<div class="card" data-a="mopen" data-id="${x.id}"><b>${esc(x.name || 'Unnamed monster')}</b><small>${esc(monSummary(x))}</small><div class="bar" style="margin-top:6px"><button class="lnk" data-a="mdup" data-id="${x.id}">Duplicate</button></div>${
          mDelId === x.id
            ? `<div class="bar" style="margin-top:6px"><button data-a="mdelyes" data-id="${x.id}">Delete</button><button class="alt" data-a="mdelno">Keep</button></div>`
            : `<b class="x" data-a="mdel" data-id="${x.id}" title="Delete">✕</b>`
        }</div>`,
    )
    .join('');
  return `<div class="ph"><span>Monster maker</span></div>
    <p class="hint">Build a monster from scratch. It has its own tabs and produces a stat block instead of a character sheet. Monsters are kept in this browser, or save one to a file.</p>
    <div class="bar"><button data-a="mnew">New monster</button><button class="alt" data-a="mref">Browse SRD reference</button><label class="btn alt" style="margin:0">Open monster file<input id="open" type="file" accept=".json,application/json" hidden></label></div>
    <div class="ph"><span>Monsters</span></div>${store.mons.length ? '<div class="grid">' + cards + '</div>' : '<p class="hint">No monsters yet. Choose New monster to start.</p>'}`;
}
function importMon(j) {
  mon = Object.assign(freshMon(), j, { id: freshMon().id });
  mfocus = true;
  tab = 'mbuild';
  msb = 'basic';
  panel = null;
  persistMon();
  draw();
}

/* ---------- actions ---------- */
on('mnew', () => {
  mon = freshMon();
  mfocus = true;
  tab = 'mbuild';
  msb = 'basic';
  panel = null;
  pv = null;
});
on('mopen', (d) => {
  mon = store.mons.find((x) => x.id === d.id) || mon;
  mfocus = true;
  tab = 'mbuild';
  msb = 'basic';
  panel = null;
  pv = null;
});
on('mdel', (d) => {
  mDelId = d.id;
});
on('mdelno', () => {
  mDelId = null;
});
on('mdelyes', (d) => {
  store.mons = store.mons.filter((x) => x.id !== d.id);
  if (mon.id === d.id) mon = freshMon();
  mDelId = null;
  saveStore();
});
on('mdup', (d) => {
  const s = store.mons.find((x) => x.id === d.id);
  if (!s) return;
  const c = JSON.parse(JSON.stringify(s));
  c.id = freshMon().id;
  c.name = (s.name || 'Monster') + ' (copy)';
  store.mons.push(c);
  saveStore();
});
on('mbsub', (d) => {
  msb = d.v;
  if (panel === 'mfeat') panel = null;
});
on('madd', (d) => {
  mon[d.l].push({ n: '', d: '' });
});
on('mrm', (d) => {
  mon[d.l].splice(+d.i, 1);
});
on('mmv', (d) => {
  const a = mon[d.l],
    i = +d.i,
    j = i + +d.d;
  if (j >= 0 && j < a.length) [a[i], a[j]] = [a[j], a[i]];
});
on('mtpl', (d) => {
  const c = monCalc(mon),
    nm = mon.name || 'creature',
    plus = (n) => (n ? (n > 0 ? ' + ' : ' - ') + Math.abs(n) : ''),
    atk = (a, kind, reach, dtype) =>
      `*${kind} Weapon Attack:* ${sg(a + c.pb)} to hit, ${reach}, one target. *Hit:* ${Math.max(1, 4 + a)} (1d8${plus(a)}) ${dtype} damage.`;
  if (d.t === 'multi') mon.actions.unshift({ n: 'Multiattack', d: 'The ' + nm.toLowerCase() + ' makes two attacks.' });
  else if (d.t === 'melee') mon.actions.push({ n: 'Slam', d: atk(Math.max(c.mods.str, c.mods.dex), 'Melee', 'reach 5 ft.', 'bludgeoning') });
  else mon.actions.push({ n: 'Ranged attack', d: atk(c.mods.dex, 'Ranged', 'range 80/320 ft.', 'piercing') });
});
on('msave', () => {
  const nm = (mon.name || 'Monster').replace(/[^\w\- ]+/g, '').trim() || 'Monster';
  dl(
    nm + '.monster.json',
    JSON.stringify({ format: 'hearthscribe-monster', version: 1, app: 'Hearthscribe', monster: mon }, null, 2),
    'application/json',
  );
  return false;
});
on('mpdf', () => {
  monPdf();
  return false;
});

/* typing and picking in the editor. Typing only refreshes the live stat block, so the cursor stays put. */
document.addEventListener('input', (e) => {
  const t = e.target,
    d = t.dataset;
  if (d.mf === undefined || t.type === 'checkbox' || t.tagName === 'SELECT') return;
  mSet(d.mf, t.type === 'number' ? (t.value === '' ? 0 : +t.value) : t.value);
  persistMon();
  mRefresh();
  chrome();
});
document.addEventListener('change', (e) => {
  const t = e.target,
    d = t.dataset;
  if (d.mf === undefined || (t.type !== 'checkbox' && t.tagName !== 'SELECT')) return;
  let v = t.type === 'checkbox' ? t.checked : t.value;
  if (d.num !== undefined) v = +v;
  mSet(d.mf, v);
  persistMon();
  draw();
});

/* ---------- PDF stat block ---------- */
async function monPdfBytes(m) {
  const L = PDFLib,
    { rgb } = L,
    doc = await L.PDFDocument.create(),
    F = {
      r: await doc.embedFont(L.StandardFonts.Helvetica),
      b: await doc.embedFont(L.StandardFonts.HelveticaBold),
      i: await doc.embedFont(L.StandardFonts.HelveticaOblique),
      bi: await doc.embedFont(L.StandardFonts.HelveticaBoldOblique),
    },
    W = 612, H = 792, MX = 96, MY = 60, CW = W - MX * 2,
    red = rgb(0.48, 0.11, 0.05),
    M = monModel(m);
  let page = doc.addPage([W, H]),
    y = H - MY;
  const need = (h) => {
      if (y - h < MY) {
        page = doc.addPage([W, H]);
        y = H - MY;
      }
    },
    line = (th) => page.drawLine({ start: { x: MX, y }, end: { x: MX + CW, y }, thickness: th, color: red }),
    rule = () => {
      need(12);
      y -= 5;
      line(1.4);
      y -= 7;
    },
    para = (runs, size = 9.5, lh = 12.5) => {
      const toks = [];
      runs.forEach((r) =>
        pdfText(r.t)
          .split('\n')
          .forEach((ln, li) => {
            if (li) toks.push({ br: true });
            ln.split(/ +/).filter(Boolean).forEach((w) => toks.push({ w, f: F[r.f || 'r'] }));
          }),
      );
      let cur = [],
        lw = 0;
      const flush = () => {
        need(lh);
        y -= lh;
        let x = MX;
        cur.forEach((k) => {
          page.drawText(k.w, { x, y, size, font: k.f });
          x += k.f.widthOfTextAtSize(k.w + ' ', size);
        });
        cur = [];
        lw = 0;
      };
      toks.forEach((k) => {
        if (k.br) return flush();
        const w = k.f.widthOfTextAtSize(k.w + ' ', size);
        if (cur.length && lw + w > CW + 3) flush();
        cur.push(k);
        lw += w;
      });
      if (cur.length) flush();
      y -= 2;
    },
    prop = ([l, v]) => para([{ t: l + ' ', f: 'b' }].concat(mRuns(v))),
    ent = (e) => para([{ t: (e.n || 'Unnamed') + '. ', f: 'bi' }].concat(mRuns(e.d)));
  let ts = 20;
  while (ts > 10 && F.b.widthOfTextAtSize(pdfText(M.name), ts) > CW) ts--;
  y -= 20;
  page.drawText(pdfText(M.name), { x: MX, y, size: ts, font: F.b, color: red });
  y -= 14;
  page.drawText(pdfText(M.sub), { x: MX, y, size: 10, font: F.i });
  y -= 2;
  rule();
  M.top.forEach(prop);
  rule();
  need(34);
  y -= 12;
  const cw = CW / 6;
  M.abil.forEach(([a, v], i) => {
    const x = MX + i * cw + cw / 2;
    page.drawText(a, { x: x - F.b.widthOfTextAtSize(a, 9) / 2, y, size: 9, font: F.b, color: red });
    page.drawText(v, { x: x - F.r.widthOfTextAtSize(v, 9.5) / 2, y: y - 12, size: 9.5, font: F.r });
  });
  y -= 18;
  rule();
  M.props.forEach(prop);
  if (M.traits.length) {
    rule();
    M.traits.forEach(ent);
  }
  M.secs.forEach((s) => {
    need(40);
    y -= 20;
    page.drawText(s.h, { x: MX, y, size: 13, font: F.b, color: red });
    y -= 4;
    line(0.8);
    y -= 3;
    if (s.intro) para(mRuns(s.intro));
    s.list.forEach(ent);
  });
  return doc.save();
}
async function monPdf() {
  try {
    const bytes = await monPdfBytes(mon),
      nm = (mon.name || 'Monster').replace(/[^\w\- ]+/g, '').trim() || 'Monster';
    await dl(nm + ' - stat block.pdf', bytes, 'application/pdf');
  } catch (e) {
    note('Could not create the stat block: ' + ((e && e.message) || e));
  }
}

/* ---------- Reference: stat blocks and a feature library, built from the Monster elements of the loaded packs ----------
   A pack adds monsters with  { "id": "Monster:Goblin", "type": "Monster", "name": "Goblin", "desc": "...", "stat": { ...same fields as a saved monster... } }.
   They get a source label, the source filter and homebrew support like every other element. */
let mrSub = 'blocks', // Reference sub-tab: blocks | feat
  mrq = '', // stat block search
  mrt = '', // type filter
  mrc = '', // CR band filter
  mrSel = null, // selected stat block id
  mfk = 'all', // feature kind filter
  mfq = '', // feature search
  mfSel = null; // selected feature key
const MFK = [
  ['all', 'All'],
  ['traits', 'Traits'],
  ['actions', 'Actions'],
  ['bonus', 'Bonus actions'],
  ['reactions', 'Reactions'],
  ['leg', 'Legendary'],
];
const MSEC = { traits: 'Trait', actions: 'Action', bonus: 'Bonus action', reactions: 'Reaction', leg: 'Legendary action' };
const MBANDS = [
  ['', 'Any CR'],
  ['0', 'CR 0 to 1/2'],
  ['1', 'CR 1 to 4'],
  ['2', 'CR 5 to 10'],
  ['3', 'CR 11 to 16'],
  ['4', 'CR 17 and up'],
];
const mBand = (cr, b) => {
  const n = crNum(cr);
  return b === '0' ? n <= 0.5 : b === '1' ? n >= 1 && n <= 4 : b === '2' ? n >= 5 && n <= 10 : b === '3' ? n >= 11 && n <= 16 : n >= 17;
};
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const refMons = () =>
  DB.filter((e) => e.type === 'Monster' && e.stat && srcOk(e)).sort((a, b) => a.name.localeCompare(b.name));
/* a reference stat block as an editable monster (deep copy, defaults filled in) */
function fromRef(e) {
  const b = freshMon(),
    s = JSON.parse(JSON.stringify(e.stat));
  ['ab', 'spd', 'sen', 'saves', 'skills'].forEach((k) => {
    b[k] = Object.assign({}, b[k], s[k]);
    delete s[k];
  });
  return Object.assign(b, s, { name: e.name, base: e.id });
}

/* Every trait and action in the loaded monsters, grouped by name. Text that only differs by the monster's own
   name ("the wolf" / "the kobold") counts as the same feature, so Pack Tactics is one entry with one wording. */
function featIndex() {
  const out = new Map();
  refMons().forEach((e) => {
    const names = [...new Set([e.name.toLowerCase(), e.name.toLowerCase().split(' ').pop()])].sort((a, b) => b.length - a.length),
      re = new RegExp('\\b(?:the) (?:' + names.map(escRe).join('|') + ')\\b', 'gi');
    Object.keys(MSEC).forEach((k) =>
      (e.stat[k] || []).forEach((f) => {
        const nm = String(f.n || '').trim(),
          key = nm.toLowerCase();
        if (!key) return;
        const d = String(f.d || '').trim().replace(re, (m) => m[0] + 'he {name}');
        let g = out.get(key);
        if (!g) out.set(key, (g = { key, name: nm, vs: [], mons: new Set() }));
        let v = g.vs.find((x) => x.k === k && x.d === d);
        if (!v) g.vs.push((v = { k, d, mons: [] }));
        if (!v.mons.includes(e.name)) v.mons.push(e.name);
        g.mons.add(e.name);
      }),
    );
  });
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function mrList() {
  const all = refMons(),
    rs = all.filter((e) => (!mrq || e.name.toLowerCase().includes(mrq)) && (!mrt || e.stat.type === mrt) && (!mrc || mBand(e.stat.cr, mrc)));
  return (
    `<div class="ph"><span>Stat blocks</span><span class="src">${rs.length} / ${all.length}</span></div>` +
    (rs
      .map(
        (e) =>
          `<div class="rw${mrSel === e.id ? ' pv' : ''}" data-a="mrpick" data-id="${esc(e.id)}"><span>${esc(e.name)}</span><span class="src">${e.src ? esc(e.src) + ' · ' : ''}CR ${esc(e.stat.cr)} · ${esc(e.stat.type)}</span></div>`,
      )
      .join('') || '<p class="hint">Nothing matches.</p>')
  );
}
function mrPane() {
  const e = mrSel && idx()[mrSel];
  if (!e || !e.stat) return '<p class="hint">Click a stat block to read it. Use it as the starting point for a new monster, then change whatever you like on the Build tab.</p>';
  const canRep = store.mons.some((x) => x.id === mon.id);
  return (
    `<div class="bar"><button data-a="mruse" data-id="${esc(e.id)}">Use as a new monster</button>${canRep ? `<button class="alt" data-a="mrrep" data-id="${esc(e.id)}">Replace “${esc(mon.name || 'Unnamed monster')}”</button>` : ''}</div>` +
    `<div class="mb" style="margin-top:10px">${monBlock(fromRef(e))}</div>`
  );
}
function mfList() {
  const all = featIndex(),
    q = mfq,
    rs = all.filter(
      (g) =>
        (mfk === 'all' || g.vs.some((v) => v.k === mfk)) &&
        (!q || g.name.toLowerCase().includes(q) || g.vs.some((v) => v.d.toLowerCase().includes(q))),
    );
  return (
    `<div class="ph"><span>Features</span><span class="src">${rs.length} / ${all.length}</span></div>` +
    (rs
      .map(
        (g) =>
          `<div class="rw${mfSel === g.key ? ' pv' : ''}" data-a="mfpick" data-id="${esc(g.key)}"><span>${esc(g.name)}</span><span class="src">${[...new Set(g.vs.map((v) => MSEC[v.k]))].join(', ')} · ${g.mons.size} monster${g.mons.size === 1 ? '' : 's'}</span></div>`,
      )
      .join('') || '<p class="hint">Nothing matches.</p>')
  );
}
function mfPane() {
  const g = mfSel && featIndex().find((x) => x.key === mfSel);
  if (!g) return '<p class="hint">Click a feature to see how each monster words it, then add it to the monster you are building. Mix and match as many as you like.</p>';
  return (
    `<h2>${esc(g.name)}</h2><p class="hint">Adding to: <b>${esc(mon.name || 'Unnamed monster')}</b></p>` +
    g.vs
      .map(
        (v, i) =>
          `<div class="rw" style="cursor:default;display:block"><div class="hint">${MSEC[v.k]} · ${esc(v.mons.join(', '))}</div><p>${mRich(v.d.replace(/\{name\}/g, 'creature'))}</p><div class="bar"><select id="mft${i}" style="width:auto">${Object.keys(MSEC).map((k) => `<option value="${k}"${k === v.k ? ' selected' : ''}>Add as ${MSEC[k].toLowerCase()}</option>`).join('')}</select><button data-a="mfadd" data-id="${esc(g.key)}" data-vi="${i}">Add</button></div></div>`,
      )
      .join('')
  );
}
function renderMRef() {
  const m = $('#main');
  m.className = 'main';
  if (!DB.some((e) => e.type === 'Monster')) {
    m.className = 'main one';
    m.innerHTML =
      '<div class="left"><div class="ph"><span>Reference</span></div><p class="hint">No monster data is loaded. Add <code>monsters.json</code> to the SRD pack (list it in that folder’s <code>index.json</code>), or add a homebrew pack that contains elements of type “Monster”.</p></div>';
    return;
  }
  if (mrSub === 'feat') {
    m.innerHTML = `<div class="left"><div class="bar">${srcSel()}<input type="text" id="mfq" placeholder="Search features…" value="${esc(mfq)}" style="max-width:220px"></div><div class="chips">${MFK.map(([k, t]) => `<button class="lnk${mfk === k ? ' on' : ''}" data-a="mfk" data-v="${k}">${t}</button>`).join('')}</div><div id="mfl">${mfList()}</div></div><div class="right">${mfPane()}</div>`;
    return;
  }
  const types = [...new Set(refMons().map((e) => e.stat.type))].sort();
  m.innerHTML = `<div class="left"><div class="bar">${srcSel()}<input type="text" id="mrq" placeholder="Search monsters…" value="${esc(mrq)}" style="max-width:200px"><select data-mr="t" style="width:auto"><option value="">Any type</option>${types.map((t) => `<option${t === mrt ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select><select data-mr="c" style="width:auto">${MBANDS.map(([v, t]) => `<option value="${v}"${v === mrc ? ' selected' : ''}>${t}</option>`).join('')}</select></div><div id="mrl">${mrList()}</div></div><div class="right">${mrPane()}</div>`;
}

on('mref', () => {
  mon = freshMon(); // coming from Start: begin with a blank monster so nothing saved gets replaced by accident
  mfocus = true;
  tab = 'mref';
  mrSub = 'blocks';
  panel = null;
  pv = null;
});
on('mrsub', (d) => {
  mrSub = d.v;
});
on('mrpick', (d) => {
  mrSel = d.id;
});
on('mfpick', (d) => {
  mfSel = d.id;
});
on('mfk', (d) => {
  mfk = d.v;
});
on('mruse', (d) => {
  const e = idx()[d.id];
  if (!e || !e.stat) return false;
  mon = fromRef(e);
  tab = 'mbuild';
  msb = 'basic';
});
on('mrrep', (d) => {
  const e = idx()[d.id];
  if (!e || !e.stat || !confirm('Replace ' + (mon.name || 'this monster') + ' with the ' + e.name + ' stat block?')) return false;
  mon = Object.assign(fromRef(e), { id: mon.id });
  tab = 'mbuild';
  msb = 'basic';
});
function mAddFeat(key, vi, k) {
  const g = featIndex().find((x) => x.key === key),
    v = g && g.vs[+vi];
  if (!v) return false;
  k = k || v.k;
  const txt = v.d.replace(/\{name\}/g, (mon.name || 'creature').toLowerCase());
  if (mon[k].some((x) => x.n === g.name && x.d === txt)) {
    note(g.name + ' is already on this monster.');
    return false;
  }
  mon[k].push({ n: g.name, d: txt });
  note('Added ' + g.name + ' to ' + (mon.name || 'your monster') + '.');
  return true;
}
on('mfadd', (d) => {
  const sel = document.getElementById('mft' + d.vi);
  mAddFeat(d.id, d.vi, sel && sel.value);
  return false;
});

/* ---------- inside Build: side panel of reference features, and "Fill from a stat block" ---------- */
let mpk = 'traits', // list the side panel adds to
  mpq = '',
  mpAny = false, // show features of every kind, not just the list's own kind
  mbSel = '',
  mbScope = 'abil';
function mpList() {
  const have = mon[mpk] || [],
    rs = [];
  featIndex().forEach((g) =>
    g.vs.forEach((v, i) => {
      if ((mpAny || v.k === mpk) && (!mpq || g.name.toLowerCase().includes(mpq) || v.d.toLowerCase().includes(mpq))) rs.push({ g, v, i });
    }),
  );
  return (
    `<div class="ph"><span>${MSEC[mpk]}s</span><span class="src">${rs.length}</span></div>` +
    (rs
      .slice(0, 150)
      .map(({ g, v, i }) => {
        const on = have.some((x) => x.n === g.name),
          txt = v.d.replace(/\{name\}/g, 'creature').replace(/\*/g, '');
        return `<div class="rw${on ? ' on' : ''}" data-a="mpadd" data-id="${esc(g.key)}" data-vi="${i}" style="display:block"><b>${on ? '✓ ' : ''}${esc(g.name)}</b><div class="src">${esc(v.mons.slice(0, 3).join(', '))}${v.mons.length > 3 ? ' +' + (v.mons.length - 3) : ''}</div><div class="src">${esc(txt.slice(0, 110))}${txt.length > 110 ? '…' : ''}</div></div>`;
      })
      .join('') || '<p class="hint">Nothing matches.</p>')
  );
}
function mpPanel() {
  if (!refMons().length) return '<p class="hint">No monster data is loaded. Add monsters.json to the SRD pack, or a homebrew pack with Monster elements.</p>';
  return `<p class="hint">Click a feature to add it to <b>${esc(mon.name || 'your monster')}</b> as a ${MSEC[mpk].toLowerCase()}.</p><div class="bar">${srcSel()}<button class="lnk${mpAny ? ' on' : ''}" data-a="mpany">Any kind</button></div><input type="text" id="mpq" placeholder="Search features…" value="${esc(mpq)}"><div id="mpl">${mpList()}</div>`;
}
function mFillHtml() {
  const rs = refMons();
  if (!rs.length) return '';
  const sc = [
    ['all', 'Everything (keeps my name)'],
    ['basics', 'Size, type and CR'],
    ['abil', 'Ability scores'],
    ['def', 'Defenses'],
    ['sense', 'Senses and languages'],
    ['feats', 'Traits and actions (replace mine)'],
    ['featsadd', 'Traits and actions (add to mine)'],
  ];
  return `<div class="ph"><span>Fill from a stat block</span></div><p class="hint">Copy part or all of an SRD stat block into this monster, then adjust it.</p><div class="bar">${srcSel()}<select id="mbr" style="width:auto;max-width:230px">${rs.map((e) => `<option value="${esc(e.id)}"${e.id === mbSel ? ' selected' : ''}>${esc(e.name)} (CR ${esc(e.stat.cr)})</option>`).join('')}</select><select id="mbs" style="width:auto">${sc.map(([v, t]) => `<option value="${v}"${v === mbScope ? ' selected' : ''}>${t}</option>`).join('')}</select><button data-a="mbfill">Fill</button></div>`;
}
on('mpopen', (d) => {
  const same = panel === 'mfeat' && mpk === d.k;
  mpk = d.k;
  panel = same ? null : 'mfeat';
});
on('mpany', () => {
  mpAny = !mpAny;
});
on('mpadd', (d) => {
  mAddFeat(d.id, d.vi, mpk);
});
on('mbfill', () => {
  const sel = document.getElementById('mbr'),
    sc = (document.getElementById('mbs') || {}).value,
    e = sel && idx()[sel.value];
  if (!e || !e.stat) {
    note('Pick a stat block first.');
    return false;
  }
  const r = fromRef(e),
    G = {
      basics: ['size', 'type', 'tags', 'align', 'cr'],
      abil: ['ab'],
      def: ['ac', 'acNote', 'hpAuto', 'hdn', 'hp', 'spd', 'hover', 'saves', 'skills', 'vuln', 'res', 'imm', 'cimm'],
      sense: ['sen', 'langs'],
      feats: ['traits', 'actions', 'bonus', 'reactions', 'leg', 'legN'],
    },
    take = (ks) => ks.forEach((k) => (mon[k] = JSON.parse(JSON.stringify(r[k])))),
    ADD = ['traits', 'actions', 'bonus', 'reactions', 'leg'];
  if (sc === 'all') {
    if (!confirm('Replace everything on ' + (mon.name || 'this monster') + ' except its name?')) return false;
    take(Object.values(G).flat());
    if (!mon.name) mon.name = e.name;
    mon.base = e.id;
  } else if (sc === 'featsadd')
    ADD.forEach((k) =>
      (r[k] || []).forEach((f) => {
        if (!mon[k].some((x) => x.n === f.n && x.d === f.d)) mon[k].push(JSON.parse(JSON.stringify(f)));
      }),
    );
  else take(G[sc]);
  note('Filled from ' + e.name + '.');
});
document.addEventListener('input', (e) => {
  if (e.target.id !== 'mpq') return;
  mpq = e.target.value.toLowerCase();
  if ($('#mpl')) $('#mpl').innerHTML = mpList();
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'mbr') mbSel = e.target.value;
  else if (e.target.id === 'mbs') mbScope = e.target.value;
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'mrq') {
    mrq = t.value.toLowerCase();
    if ($('#mrl')) $('#mrl').innerHTML = mrList();
  } else if (t.id === 'mfq') {
    mfq = t.value.toLowerCase();
    if ($('#mfl')) $('#mfl').innerHTML = mfList();
  }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.mr === 't') mrt = t.value;
  else if (t.dataset.mr === 'c') mrc = t.value;
  else return;
  draw();
});

/* ---------- look of the stat block (its own parchment colours, readable in any theme) ---------- */
document.head.insertAdjacentHTML(
  'beforeend',
  `<style>
.mb{background:#fdf1dc;color:#1c1a17;border:1px solid #c9b48a;border-top:4px solid #7a1c0c;border-bottom:4px solid #7a1c0c;padding:14px 18px;font:14px/1.45 Georgia,serif;box-shadow:0 1px 4px rgba(0,0,0,.25)}
.mb h2{color:#7a1c0c;margin:0;font-size:24px;font-variant:small-caps;border:0;padding:0}
.mb .mbs{font-style:italic;margin-bottom:4px}
.mb hr{border:0;border-top:2px solid #7a1c0c;margin:8px 0}
.mb p.mp{margin:2px 0;color:#1c1a17}
.mb p.mp b{color:#7a1c0c}
.mb h3{color:#7a1c0c;font-size:19px;font-variant:small-caps;border-bottom:1px solid #7a1c0c;margin:14px 0 6px;font-weight:400;padding:0}
.mb .mab{display:grid;grid-template-columns:repeat(6,1fr);text-align:center;color:#7a1c0c;font-weight:700;font-size:13px}
.mb .mab span{display:block;color:#1c1a17;font-weight:400}
</style>`,
);
