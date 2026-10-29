/* Rules engine: follows grants and choices from the chosen race/class/background and computes every number on the sheet. */
function resolve(ch) {
  let cur = ch.level,
    mc = false;
  const asi = [],
    exp = [],
    pfs = new Set(),
    langs = [],
    fx = [],
    sb = { race: {}, bg: {}, other: {} }; // ability increases by source
  let src = 'other';
  const I = idx(),
    els = [],
    sels = [],
    stats = {},
    prof = new Set(),
    seen = new Set();
  const give = (g, pk) => {
    if (/^(skill|save):/.test(g)) {
      if (!(mc && g.startsWith('save:'))) prof.add(g);
    } else {
      if (g.startsWith('Language:')) langs.push({ id: g, pk });
      add(g);
    }
  };
  function add(id) {
    const e = I[id];
    if (!e || seen.has(id)) return;
    seen.add(id);
    els.push(e);
    if (e.ap) (mc ? e.mp : e.ap).forEach((p) => pfs.add(p));
    (e.rules || []).forEach((r, i) => {
      if (r.level && r.level > cur) return;
      if (r.expertise) {
        const k = id + '@E' + r.level;
        exp.push({ key: k, cls: e.name, level: r.level, n: r.expertise });
        return;
      }
      if (r.pf) {
        if (!mc) [].concat(r.pf).forEach((p) => pfs.add(p));
        return;
      }
      if (r.asi) {
        const k = id + '@' + r.level,
          c = ch.asi && ch.asi[k];
        asi.push({ key: k, cls: e.name, level: r.level, epic: !!r.epic });
        if (c && c.t === 'f' && c.f) add(c.f);
        return;
      }
      if (r.grant) give(r.grant);
      if (r.acFormula || r.speedBonus || r.halfProf || r.saveBonus) fx.push(r);
      if (r.stat)
        for (const k in r.stat) {
          stats[k] = k === 'speed' ? r.stat[k] : (stats[k] || 0) + r.stat[k];
          if (AB.includes(k)) sb[src][k] = (sb[src][k] || 0) + r.stat[k];
        }
      if (r.select) {
        const s = r.select,
          key = id + '#' + i,
          n = s.n || 1;
        if (mc && (s.from || s.tool)) return;
        const opts = s.from
          ? s.from.map((x) => ({ id: 'skill:' + x, name: x }))
          : s.ids
            ? DB.filter((x) => s.ids.includes(x.id))
            : DB.filter(
                (x) =>
                  x.type === s.type &&
                  (!s.spl || (x.lists && x.lists.includes(s.spl) && x.lvl === (s.lvl || 0))) &&
                  (!s.supports || x.supports === s.supports) &&
                  (!s.cls || (x.cls || '').includes(s.cls)),
              );
        const chosen = (ch.picks[key] || []).filter((c) => opts.some((o) => o.id === c)).slice(0, n);
        sels.push({ key, name: s.name, n, opts, chosen, owner: e.name, kind: s.type || 'Skill' });
        chosen.forEach((g) => {
          give(g, true);
          if (s.tool && I[g]) pfs.add('t:' + I[g].name);
        });
      }
    });
  }
  give('Language:Common');
  const lc = classLevels(ch);
  [ch.race, ch.bg].forEach((x, i) => {
    cur = ch.level;
    src = i ? 'bg' : 'race';
    x && add(x);
  });
  src = 'other';
  Object.entries(lc).forEach(([k, n], i) => {
    if (!k) return;
    cur = n;
    mc = i > 0;
    add(k);
  });
  {
    const WL = classLevels(ch)['Class:Warlock'] || classLevels(ch)['Class:Warlock (5.2)'] || 0,
      pbs = new Set(sels.filter((s) => s.kind === 'Pact Boon').flatMap((s) => s.chosen)),
      wc = ((ch.sp && (ch.sp.Warlock || ch.sp['Warlock (5.2)'])) || {}).c || [];
    const ok = (o) =>
      (!o.lv || o.lv <= WL) &&
      (!o.pb || pbs.has('Pact Boon:Pact of the ' + o.pb)) &&
      (!o.sp || wc.includes('Spell:' + o.sp));
    sels.forEach((s) => {
      if (s.kind === 'Invocation') {
        s.opts = s.opts.filter(ok);
        s.chosen = s.chosen.filter((c) => s.opts.some((o) => o.id === c));
      }
    });
    ['Language', 'Metamagic', 'Invocation', 'Favored Enemy', 'Favored Terrain', 'Land Type', 'Weapon'].forEach((K) => {
      const kn = K === 'Language' ? new Set(langs.filter((x) => !x.pk).map((x) => x.id)) : new Set(),
        L = sels.filter((s) => s.kind === K),
        taken = new Set(kn);
      L.forEach((s) => {
        s.chosen = s.chosen.filter((c) => !taken.has(c));
        s.chosen.forEach((c) => taken.add(c));
      });
      L.forEach((s) => {
        const oth = new Set(kn);
        L.forEach((t) => {
          if (t !== s) t.chosen.forEach((c) => oth.add(c));
        });
        s.opts = s.opts.filter((o) => !oth.has(o.id));
      });
    });
  }
  /* Ability score increases come from the race (5.1 style) OR the background (5.2 style), never both.
     ch.boost = 'race' | 'bg'; when empty, a background that lists abilities means 'bg', otherwise 'race'. */
  const bgEl = I[ch.bg],
    mode = ch.boost || (bgEl && bgEl.abilities ? 'bg' : 'race'),
    drop = mode === 'bg' ? 'race' : 'bg',
    bgb = {};
  AB.forEach((a) => {
    if (sb[drop][a]) stats[a] = (stats[a] || 0) - sb[drop][a];
  });
  if (mode === 'bg' && bgEl && bgEl.abilities) {
    const ab = bgEl.abilities;
    if (ch.bgt === '111') ab.forEach((a) => (bgb[a] = 1));
    else if (ch.bgt === '21') {
      if (ch.bga && ab.includes(ch.bga)) bgb[ch.bga] = 2;
      if (ch.bgb && ab.includes(ch.bgb) && ch.bgb !== ch.bga) bgb[ch.bgb] = 1;
    }
    Object.entries(bgb).forEach(([a, v]) => (stats[a] = (stats[a] || 0) + v));
  }
  const boostBy = { mode, race: mode === 'race' ? sb.race : {}, bg: mode === 'bg' ? Object.assign({}, sb.bg, bgb) : {}, other: sb.other };
  return { els, sels, stats, prof, asi, exp, pfs, langs, fx, boostBy, cls: I[ch.cls] };
}
function calc(ch, r) {
  const sc = {};
  AB.forEach((a) => (sc[a] = Math.min((ch.opt || {}).uncap ? 30 : 20, ch.ab[a] + (r.stats[a] || 0) + asiB(ch, r, a))));
  {
    const sb = magicB(ch).set;
    AB.forEach((a) => {
      if (sb[a] && sc[a] < sb[a]) sc[a] = sb[a];
    });
  }
  const lv = ch.level,
    pb = 2 + Math.floor((lv - 1) / 4),
    hd = r.cls?.hd || 8,
    cm = mod(sc.con);
  const hp = r.cls
    ? hpCalc(ch, cm, r.stats.hpl || 0) +
      (hasF(r, 'Draconic Resilience') ? classLevels(ch)['Class:Sorcerer'] || 0 : 0)
    : 0;
  const dm = mod(sc.dex),
    ea = eqArmor(ch, dm);
  const ac = acCalc(ch, r, ea, sc);
  const half = hasF(r, 'Jack of All Trades') ? Math.floor(pb / 2) : 0,
    ra = hasF(r, 'Remarkable Athlete') ? Math.ceil(pb / 2) : 0,
    exs = new Set(Object.values(ch.exp || {}).flat());
  const sk = {};
  for (const s in SK) {
    const p = r.prof.has('skill:' + s),
      x = p && exs.has(s),
      a = SK[s],
      hh = Math.max(half, ['str', 'dex', 'con'].includes(a) ? ra : 0, halfBonus(r, a, pb));
    sk[s] = { p, x, v: mod(sc[a]) + (p ? pb * (x ? 2 : 1) : hh) };
  }
  const aura =
    Math.max(
      hasF(r, 'Aura of Protection') ? Math.max(1, mod(sc.cha)) : 0,
      ...(r.fx || [])
        .filter((x) => x.saveBonus)
        .map((x) => Math.max(x.saveBonus.min || 0, (x.saveBonus.mod ? mod(sc[x.saveBonus.mod]) : 0) + (x.saveBonus.n || 0))),
    ) + magicB(ch).saves;
  const sv = {};
  AB.forEach((a) => {
    const p = r.prof.has('save:' + a);
    sv[a] = { p, v: mod(sc[a]) + (p ? pb : 0) + aura };
  });
  return {
    sc,
    pb,
    hp,
    ac,
    sk,
    sv,
    init: dm + Math.max(half, ra, halfBonus(r, 'dex', pb)),
    speed: (r.stats.speed || 30) + speedB(ch, r, { sc, pb }),
    pp: 10 + sk.Perception.v,
  };
}
const asiB = (c, r, a) =>
  (r.asi || []).reduce((s, x) => {
    const v = (c.asi || {})[x.key] || {};
    return (
      s +
      (v.t === '2' && v.a === a
        ? 2
        : v.t === '11'
          ? (v.a === a ? 1 : 0) + (v.b === a && v.b !== v.a ? 1 : 0)
          : 0)
    );
  }, 0);
/* Half-proficiency style bonus from data rules: {"halfProf": {"abilities": "all" | ["str","dex","con"], "round": "up" | "down"}} */
const halfBonus = (r, a, pb) =>
  (r.fx || []).reduce((m, x) => {
    const h = x.halfProf;
    if (!h || !(h.abilities === 'all' || (h.abilities || []).includes(a))) return m;
    return Math.max(m, h.round === 'up' ? Math.ceil(pb / 2) : Math.floor(pb / 2));
  }, 0);
const hasF = (r, n) => r.els.some((e) => e.id === 'Class Feature:' + n);
function armorAC(c, r, ea, sc) {
  const dm = mod(sc.dex),
    I = idx(),
    sh = (c.inv || []).some((i) => i.eq && I[i.id] && I[i.id].kind === 'Shield');
  if (ea.worn) return ea.ac + (r.stats.acArm || 0);
  let b = 10 + dm;
  if (hasF(r, 'Barbarian Unarmored Defense')) b = Math.max(b, 10 + dm + mod(sc.con));
  if (hasF(r, 'Monk Unarmored Defense') && !sh) b = Math.max(b, 10 + dm + mod(sc.wis));
  if (hasF(r, 'Draconic Resilience')) b = Math.max(b, 13 + dm);
  (r.fx || []).forEach((x) => {
    const f = x.acFormula;
    if (f && !(f.noShield && sh))
      b = Math.max(b, (f.base || 10) + (f.add || []).reduce((t, a) => t + mod(sc[a]), 0));
  });
  return b + (sh ? 2 : 0);
}
function magicB(c) {
  const b = { ac: 0, saves: 0, wpn: 0, spA: 0, brac: 0, set: {} };
  (c.inv || []).forEach((i) => {
    const d = MEF[i.id];
    if (!d) return;
    if (d.att ? !i.att : !i.eq) return;
    ['ac', 'saves', 'wpn', 'spA', 'brac'].forEach((k) => {
      if (d[k]) b[k] += d[k];
    });
    if (d.set)
      Object.entries(d.set).forEach(([a, v]) => {
        b.set[a] = Math.max(b.set[a] || 0, v);
      });
  });
  return b;
}
function acCalc(c, r, ea, sc) {
  const mb = magicB(c),
    I = idx(),
    sh = (c.inv || []).some((i) => i.eq && I[i.id] && I[i.id].kind === 'Shield');
  return armorAC(c, r, ea, sc) + mb.ac + (!ea.worn && !sh ? mb.brac : 0);
}
function speedB(c, r, cc) {
  const I = idx(),
    eq = (c.inv || []).filter((i) => i.eq && I[i.id]).map((i) => I[i.id]),
    arm = eq.find((e) => e.type === 'Armor' && e.kind !== 'Shield'),
    sh = eq.some((e) => e.kind === 'Shield'),
    l = classLevels(c)['Class:Monk'] || 0;
  let b = 0;
  if (hasF(r, 'Fast Movement') && !(arm && arm.kind === 'Heavy')) b += 10;
  if (hasF(r, 'Unarmored Movement') && !arm && !sh)
    b += l >= 18 ? 30 : l >= 14 ? 25 : l >= 10 ? 20 : l >= 6 ? 15 : l >= 2 ? 10 : 0;
  (r.fx || []).forEach((x) => {
    const s = x.speedBonus;
    if (!s || (s.noHeavy && arm && arm.kind === 'Heavy') || (s.unarmored && (arm || sh))) return;
    b += resMax(s.max, cc || { sc: {}, pb: 0 }, (n) => classLevels(c)['Class:' + n] || 0);
  });
  return b;
}
