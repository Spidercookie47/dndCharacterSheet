/* Character sheet tab: live sheet and resources. */
function sheetHTML() {
  const r = resolve(ch),
    c = calc(ch, r),
    cl = r.els.filter((e) => e.type === 'Class')[0],
    rc = r.els.find((e) => e.type === 'Race'),
    sr = r.els.find((e) => e.type === 'Sub Race');
  const feats = r.els.filter((e) => /Trait|Feature|Style|^Feat$/.test(e.type));
  return `<h2>${esc(ch.name || 'Unnamed hero')}</h2><p class="sub2">Level ${ch.level} ${esc(sr?.name || rc?.name || '—')} ${esc(cl?.name || '(no class)')}${ch.bg ? ' · ' + esc(ch.bg.split(':')[1]) : ''}</p>
<div class="stats"><div class="stat"><b>${c.ac}</b><span>Armor Class</span></div><div class="stat"><b>${exhHpMax(c.hp) || '—'}</b><span>Hit Points</span></div><div class="stat"><b>${exhSpeed(c.speed)} ft</b><span>Speed</span></div><div class="stat"><b>${sg(c.pb)}</b><span>Proficiency</span></div></div>${exhHtml(c)}
<div class="abg">${AB.map((a) => `<div class="ab"><span>${a.toUpperCase()}</span><b>${sg(mod(c.sc[a]))}</b><span>${c.sc[a]}</span></div>`).join('')}</div>
<div class="two"><div><h3>Saving throws</h3><ul class="sk">${AB.map((a) => `<li class="${c.sv[a].p ? 'p' : ''}"><span>${AN[a]}</span><span>${sg(c.sv[a].v)}</span></li>`).join('')}</ul><p class="hint">Initiative ${sg(c.init)} · Passive Perception ${c.pp}</p></div>
<div><h3>Skills</h3><ul class="sk">${Object.entries(c.sk)
    .map(([n, s]) => `<li class="${s.p ? 'p' : ''}"><span>${n}</span><span>${sg(s.v)}</span></li>`)
    .join('')}</ul></div></div>
<h3 style="margin-top:14px">Features</h3>${feats.map((f) => `<details><summary>${esc(f.name)}</summary>${INFO[f.id] && INFO[f.id][0] === '<' ? clean(INFO[f.id]) : '<p>' + esc(f.desc) + '</p>'}</details>`).join('') || '<p class="hint">Features from your race, class and background appear here.</p>'}`;
}
/* ---- Hit points: current, temporary and hit dice ----
   ch.hpNow missing means "at full health", so a new level or a higher Constitution raises it by itself.
   Only values that differ from the default are stored (Drive sync compares the whole character). */
const exhHpMax = (hp) => ((ch.exh || 0) >= 4 && hp ? Math.max(1, Math.floor(hp / 2)) : hp || 0); // exhaustion 4+: hit point maximum is halved
function hpInfo(c) {
  const max = exhHpMax(c.hp),
    now = ch.hpNow == null ? max : Math.max(0, Math.min(ch.hpNow, max));
  return { max, now, temp: Math.max(0, ch.tempHp || 0) };
}
function hdInfo() {
  const lc = classLevels(ch),
    I = idx(),
    used = ch.hdUsed || {};
  return Object.entries(lc)
    .filter(([k]) => I[k])
    .map(([k, n]) => ({ k, name: I[k].name, d: I[k].hd || 8, n, left: n - Math.min(n, used[k] || 0) }));
}
/* ---- Status effects (conditions). ch.cond = ['poisoned', ...], ch.exh = exhaustion level 0-6; both only stored when set.
   They are reminders: they do not change the numbers on the sheet. They sit inside the Hit points card, under the bar. ---- */
const CONDS = [
  ['blinded', 'Blinded', 'You cannot see. Attacks against you have advantage and your attacks have disadvantage.'],
  ['charmed', 'Charmed', 'You cannot attack the charmer or target them with harmful effects. They have advantage on social checks against you.'],
  ['deafened', 'Deafened', 'You cannot hear and automatically fail checks that rely on hearing.'],
  ['frightened', 'Frightened', 'Disadvantage on checks and attacks while the source of fear is in sight. You cannot willingly move closer to it.'],
  ['grappled', 'Grappled', 'Your speed is 0. Ends if the grappler is incapacitated or you are moved out of reach.'],
  ['incapacitated', 'Incapacitated', 'You cannot take actions or reactions.'],
  ['invisible', 'Invisible', 'Attacks against you have disadvantage and your attacks have advantage. You are hard to see.'],
  ['paralyzed', 'Paralyzed', 'Incapacitated, cannot move or speak. Attacks have advantage, and hits from within 5 feet are critical hits.'],
  ['petrified', 'Petrified', 'Turned to stone: incapacitated, unaware, resistant to all damage and immune to poison and disease.'],
  ['poisoned', 'Poisoned', 'Disadvantage on attack rolls and ability checks.'],
  ['prone', 'Prone', 'You can only crawl or stand up (costs half your movement). Melee attacks against you have advantage; ranged have disadvantage.'],
  ['restrained', 'Restrained', 'Your speed is 0. Attacks against you have advantage, yours have disadvantage, and Dexterity saves have disadvantage.'],
  ['stunned', 'Stunned', 'Incapacitated, cannot move, speak only falteringly. You fail Strength and Dexterity saves; attacks against you have advantage.'],
  ['unconscious', 'Unconscious', 'Incapacitated, prone and unaware. You drop what you hold, fail Strength and Dexterity saves, and attacks against you have advantage.'],
  ['concentrating', 'Concentrating', 'Maintaining a spell. Damage or a new concentration spell can end it (Constitution save).'],
  ['blessed', 'Blessed', 'Bless: add 1d4 to attack rolls and saving throws.', 1],
  ['hasted', 'Hasted', 'Haste: double speed, +2 AC, advantage on Dexterity saves and one extra action.', 1],
  ['raging', 'Raging', 'Rage: advantage on Strength checks and saves, bonus rage damage, resistance to bludgeoning, piercing and slashing damage.', 1],
  ['flying', 'Flying', 'You have a flying speed.', 1],
  ['shielded', 'Shielded', 'A spell or effect is raising your AC (Shield of Faith, Shield, Mage Armor...).', 1],
  ['resistant', 'Resistant', 'Resistance to a damage type: you take half damage from it.', 1],
  ['hidden', 'Hidden', 'You are hidden. Attacks against you have disadvantage and your first attack has advantage.', 1],
  ['bardic', 'Bardic Inspiration', 'You hold a Bardic Inspiration die to add to one d20 roll.', 1],
];
const EXH_TXT = [
  '',
  'Disadvantage on ability checks.',
  'Speed halved.',
  'Disadvantage on attack rolls and saving throws.',
  'Hit point maximum halved.',
  'Speed reduced to 0.',
  'Death.',
];
/* Exhaustion on the Play tab: speed and hit point maximum are really reduced (hpInfo above), checks and saves get a DIS tag, and a banner lists the effects.
   The core engine (calc) is not changed, so the sheet tab's AC and the PDF export keep the normal numbers. */
const exhTag = (kind) => ((ch.exh || 0) >= (kind === 'save' ? 3 : 1) ? '<em class="exdis" title="Disadvantage from exhaustion">DIS</em>' : '');
const exhSpeed = (sp) => {
  const n = ch.exh || 0;
  return n >= 5 ? 0 : n >= 2 ? Math.floor((+sp || 0) / 2) : sp;
};
function exhHtml(c) {
  const n = Math.max(0, Math.min(6, ch.exh || 0));
  if (!n) return '';
  const sp = exhSpeed(c.speed),
    fx = [
      'Ability checks: disadvantage',
      n >= 2 ? (sp !== c.speed ? 'Speed ' + c.speed + ' → ' + sp + ' ft' : '') : '',
      n >= 3 ? 'Attacks and saves: disadvantage' : '',
      n >= 4 && c.hp ? 'HP max ' + c.hp + ' → ' + exhHpMax(c.hp) : '',
      n === 6 ? 'Death' : '',
    ].filter(Boolean);
  return `<div class="exhpill"><b>Exhaustion ${n}</b><span>${esc(fx.join(' · '))}</span></div>`;
}
let condOpen = false; // the "add a status" picker is open
function statusHtml() {
  const on = new Set(ch.cond || []),
    ex = Math.max(0, Math.min(6, ch.exh || 0)),
    cn = on.has('concentrating') && ch.conc && (idx()[ch.conc] || {}).name, // spell you are concentrating on
    chip = (k, n, t, b) => `<button type="button" class="stchip${b ? ' buff' : ''}" data-a="cond" data-k="${k}" title="${esc(t)} Tap to remove." aria-label="Remove ${esc(n)}"><span>${esc(n)}</span><b aria-hidden="true">✕</b></button>`,
    chips =
      CONDS.filter((x) => on.has(x[0])).map((x) => chip(x[0], x[0] === 'concentrating' && cn ? x[1] + ': ' + cn : x[1], x[2], x[3])).join('') +
      (ex ? `<button type="button" class="stchip ex" data-a="exh" data-d="-1" title="${esc(EXH_TXT[ex])} Tap to lower." aria-label="Lower exhaustion"><span>Exhaustion ${ex}</span><b aria-hidden="true">✕</b></button>` : ''),
    opt = (x) => `<button type="button" class="stopt${on.has(x[0]) ? ' on' : ''}${x[3] ? ' buff' : ''}" data-a="cond" data-k="${x[0]}" title="${esc(x[2])}" aria-pressed="${on.has(x[0])}">${on.has(x[0]) ? '✓ ' : ''}${esc(x[1])}</button>`,
    picker = condOpen
      ? `<div class="stpick"><div class="stlab">Conditions</div><div class="stgrid">${CONDS.filter((x) => !x[3]).map(opt).join('')}</div><div class="stlab">Boosts</div><div class="stgrid">${CONDS.filter((x) => x[3]).map(opt).join('')}</div>` +
        `<div class="stex"><span>Exhaustion <b>${ex}</b></span><span class="stexb"><button type="button" class="alt" data-a="exh" data-d="-1" aria-label="Lower exhaustion"${ex ? '' : ' disabled'}>−</button><button type="button" class="alt" data-a="exh" data-d="1" aria-label="Raise exhaustion"${ex >= 6 ? ' disabled' : ''}>+</button></span></div>` +
        (ex ? `<p class="hint stexh">${esc(EXH_TXT[ex])}</p>` : '') +
        `<div class="stfoot">${on.size || ex ? '<button type="button" class="alt" data-a="condclear">Clear all</button>' : ''}<button type="button" data-a="condopen">Done</button></div></div>`
      : '';
  return `<div class="stbar${condOpen ? ' open' : ''}"><div class="stchips">${chips || '<span class="stnone">No status effects</span>'}<button type="button" class="stadd" data-a="condopen" aria-expanded="${condOpen}">${condOpen ? 'Close' : '+ Status'}</button></div>${picker}</div>`;
}

/* Death saves card: replaces the Hit points card while a character is at 0 hit points.
   cls = extra class for the desktop sheet cards ('ds-card'), '' elsewhere. */
function deathHtml(cls) {
  const d = dsGet(),
    dead = d.f >= 3,
    stable = d.s >= 3,
    pips = (t, n) =>
      [1, 2, 3].map((i) => `<button type="button" class="dspip ${t}${i <= n ? ' on' : ''}" data-a="dspip" data-t="${t}" data-n="${i}" aria-label="${t === 's' ? 'Success' : 'Failure'} ${i}"></button>`).join(''),
    skull = `<svg class="dsk-skull" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><path d="M32 6C18 6 9 16 9 28c0 8 4 13 9 16v8a3 3 0 0 0 3 3h22a3 3 0 0 0 3-3v-8c5-3 9-8 9-16C55 16 46 6 32 6z" fill="currentColor"/><circle cx="22" cy="30" r="6" fill="var(--panel)"/><circle cx="42" cy="30" r="6" fill="var(--panel)"/><path d="M32 36l-4 8h8z" fill="var(--panel)"/><path d="M25 52v6M32 52v6M39 52v6" stroke="var(--panel)" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    state = dead ? 'Dead' : stable ? 'Stable' : 'Dying',
    sub = dead
      ? 'Three failed death saves.'
      : stable
        ? 'Unconscious at 0 hit points. No more death saves.'
        : 'Unconscious at 0 hit points. Roll a death save each turn.';
  return (
    `<section class="${cls ? cls + ' ' : ''}hpcard dth${dead ? ' dead' : stable ? ' stable' : ''}">` +
    `<div class="dth-top"><span class="dth-lab">Death saves</span><span class="dth-state">${state}</span></div>` +
    `<div class="dth-sk">${skull}<p>${sub}</p></div>` +
    `<div class="dth-rows"><div class="dth-r"><span>Successes</span><span class="dth-pips">${pips('s', d.s)}</span></div><div class="dth-r"><span>Failures</span><span class="dth-pips">${pips('f', d.f)}</span></div></div>` +
    statusHtml() +
    (dead || stable
      ? ''
      : `<div class="dth-b"><button class="alt" data-a="dsok">Success</button><button class="alt" data-a="dsfail">Failure</button></div><button class="dth-roll" data-a="dsroll">Roll death save (d20)</button>`) +
    `<div class="dth-b"><input type="number" id="hpamt" min="1" value="1" aria-label="Healing amount"><button data-a="hpheal">Heal</button>${dead ? '<button class="alt" data-a="dsreset">Reset</button>' : stable ? '' : '<button class="alt" data-a="dsstab">Stabilize</button>'}</div>` +
    '</section>'
  );
}
function hpHtml() {
  const r = resolve(ch),
    c = calc(ch, r),
    h = hpInfo(c);
  if (!h.max) return '';
  if (h.now === 0) return deathHtml('');
  const pct = Math.round((h.now / h.max) * 100),
    tone = pct <= 25 ? ' crit' : pct <= 50 ? ' lo' : '';
  return (
    `<section class="hpcard"><div class="bar" style="justify-content:space-between"><h3 style="border:0;margin:0">Hit points</h3><span class="hint">${h.now === 0 ? 'Down at 0 hit points' : pct + '%'}</span></div>` +
    `<div class="hpnum"><button data-a="hp" data-d="-1" aria-label="Lose 1 hit point">−</button><div class="hpv"><b>${h.now}</b><span> / ${h.max}</span>${h.temp ? `<small>+${h.temp} temporary</small>` : ''}</div><button data-a="hp" data-d="1" aria-label="Gain 1 hit point">+</button></div>` +
    `<div class="hpbar" role="progressbar" aria-label="Hit points" aria-valuemin="0" aria-valuemax="${h.max}" aria-valuenow="${h.now}"><i class="${tone.trim()}" style="width:${pct}%"></i></div>` +
    statusHtml() +
    `<div class="bar" style="margin-top:12px"><input type="number" id="hpamt" min="1" value="1" aria-label="Amount"><button class="alt" data-a="hpdmg">Damage</button><button class="alt" data-a="hpheal">Heal</button><button class="alt" data-a="hptemp">Temp HP</button></div>` +
    hdInfo()
      .map(
        (x) =>
          `<div class="rw" style="cursor:default"><span>Hit dice d${x.d} <span class="src">${esc(x.name)} · ${x.left} / ${x.n} left</span></span><button class="lnk" data-a="hdspend" data-c="${esc(x.k)}"${x.left < 1 ? ' disabled' : ''}>Spend one</button></div>`,
      )
      .join('') +
    '</section>'
  );
}
function resHtml() {
  const r = resolve(ch),
    c = calc(ch, r),
    R = resources(r, c);
  ch.used = ch.used || {};
  if (!R.length) return '';
  return (
    `<section class="cs"><div class="bar" style="justify-content:space-between"><h3 style="border:0;margin:0">Resources</h3><span class="bar"><button class="alt" data-a="rest" data-v="S">Short rest</button><button class="alt" data-a="rest" data-v="L">Long rest</button></span></div>` +
    R.map((x) => {
      const inf = x.max === Infinity,
        u = inf ? 0 : Math.min(ch.used[x.k] || 0, x.max),
        left = inf ? '∞' : x.max - u,
        vis = !inf && x.max <= 12 ? '●'.repeat(x.max - u) + '○'.repeat(u) : left + (inf ? '' : ' / ' + x.max);
      return `<div class="rw" style="cursor:default"><span>${esc(x.n)} <span class="src">${x.rest === 'S' ? 'short' : 'long'} rest${x.note ? ' · ' + esc(x.note) : ''}</span></span><span>${vis}</span><button class="lnk" data-a="res" data-k="${esc(x.k)}" data-d="1" data-m="${inf ? 0 : x.max}">Use</button><button class="lnk" data-a="res" data-k="${esc(x.k)}" data-d="-1" data-m="${inf ? 0 : x.max}">Restore</button></div>`;
    }).join('') +
    '</section>'
  );
}

function renderSheet() {
  const m = $('#main');
  m.className = 'main one';
  m.innerHTML = `<div class="left"><div class="bar"><button data-a="prev">Preview sheet</button><button data-a="pdf">Download official sheet (PDF)</button><button class="alt" data-a="save">Save character file</button></div>${hpHtml()}${resHtml()}<section class="cs" style="margin-top:14px">${sheetHTML()}</section></div>`;
}
