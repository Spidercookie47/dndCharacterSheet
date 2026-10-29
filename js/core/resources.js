/* Limited-use resources (Rage, Ki, spell slots...) and what each rest restores. */
function resources(r, c) {
  const lc = classLevels(ch),
    L = (n) => lc['Class:' + n] || 0,
    id = (x) => r.els.some((e) => e.id === x),
    F = (n) => id('Class Feature:' + n),
    R = [],
    add = (k, n, max, rest, note) => {
      if (max > 0) R.push({ k, n, max, rest, note });
    },
    cm = mod(c.sc.cha);
  if (F('Rage')) {
    const l = L('Barbarian');
    add(
      'rage',
      'Rage',
      l >= 20 ? Infinity : l >= 17 ? 6 : l >= 12 ? 5 : l >= 6 ? 4 : l >= 3 ? 3 : 2,
      'L',
      'damage +' + (l >= 16 ? 4 : l >= 9 ? 3 : 2),
    );
  }
  if (F('Bardic Inspiration')) {
    const l = L('Bard');
    add(
      'bi',
      'Bardic Inspiration',
      Math.max(1, cm),
      l >= 5 ? 'S' : 'L',
      'd' + (l >= 15 ? 12 : l >= 10 ? 10 : l >= 5 ? 8 : 6),
    );
  }
  if (L('Cleric') >= 2) {
    const l = L('Cleric');
    add('cd', 'Channel Divinity', l >= 18 ? 3 : l >= 6 ? 2 : 1, 'S');
  }
  if (F('Channel Divinity: Sacred Weapon')) add('cdp', 'Channel Divinity (oath)', 1, 'S');
  if (F('Wild Shape')) add('ws', 'Wild Shape', 2, 'S');
  if (F('Second Wind')) add('sw', 'Second Wind', 1, 'S');
  if (F('Action Surge')) add('as', 'Action Surge', L('Fighter') >= 17 ? 2 : 1, 'S');
  if (F('Indomitable')) {
    const l = L('Fighter');
    add('ind', 'Indomitable', l >= 17 ? 3 : l >= 13 ? 2 : 1, 'L');
  }
  if (F('Ki')) add('ki', 'Ki points', L('Monk'), 'S');
  if (F('Wholeness of Body')) add('wob', 'Wholeness of Body', 1, 'L');
  if (F('Lay on Hands')) add('loh', 'Lay on Hands (pool)', 5 * L('Paladin'), 'L');
  if (F('Divine Sense')) add('dsn', 'Divine Sense', Math.max(1, 1 + cm), 'L');
  if (F('Cleansing Touch')) add('ct', 'Cleansing Touch', Math.max(1, cm), 'L');
  if (F('Font of Magic')) add('sp', 'Sorcery points', L('Sorcerer'), 'L');
  if (F('Arcane Recovery')) add('ar', 'Arcane Recovery', 1, 'L');
  if (F('Natural Recovery')) add('nr', 'Natural Recovery', 1, 'L');
  if (F('Stroke of Luck')) add('sol', 'Stroke of Luck', 1, 'S');
  if (F("Dark One's Own Luck")) add('dol', 'Dark One’s Own Luck', 1, 'S');
  if (id('Racial Trait:Breath Weapon')) add('bw', 'Breath Weapon', 1, 'S');
  if (id('Racial Trait:Relentless Endurance')) add('re', 'Relentless Endurance', 1, 'L');
  if (id('Racial Trait:Infernal Legacy')) {
    if (ch.level >= 3) add('hr', 'Hellish Rebuke (racial)', 1, 'L');
    if (ch.level >= 5) add('dk', 'Darkness (racial)', 1, 'L');
  }
  /* resources defined in pack data: { "resource": { id, name, max, rest, min, note, class } } */
  r.els.forEach((e) =>
    (e.rules || []).forEach((rl) => {
      const x = rl.resource;
      if (!x || !x.name) return;
      if (x.class && rl.level && L(x.class) < rl.level) return;
      add(
        'hb:' + (x.id || e.id + ':' + x.name),
        x.name,
        Math.max(x.min || 0, resMax(x.max, c, L)),
        x.rest === 'S' || (x.restShort && L(x.restShort.class) >= x.restShort.level) ? 'S' : 'L',
        x.note,
      );
    }),
  );
  const S = slotsFor(r);
  S.sl.forEach((x, i) => add('slot' + (i + 1), 'Level ' + (i + 1) + ' spell slots', x, 'L'));
  if (S.pact) add('pact', 'Pact slots (level ' + S.pact.l + ')', S.pact.n, 'S');
  return R;
}

/* How many uses a data-defined resource has. A number, "unlimited", one part, or a list of parts that are added.
   Parts: {"n":3} · {"class":"Name"} (class level) · {"class":"Name","table":[20 numbers]} · {"mod":"int"} · {"pb":true},
   each optionally with "mult" and "div" (rounded down). */
function resMax(m, c, L) {
  if (m === 'unlimited') return Infinity;
  if (typeof m === 'number') return m;
  if (Array.isArray(m)) return m.reduce((t, p) => t + resMax(p, c, L), 0);
  if (!m || typeof m !== 'object') return 0;
  const lv = m.class ? L(m.class) : 0;
  let v = 0;
  if ('n' in m) v = +m.n || 0;
  else if (m.table) v = lv ? m.table[Math.min(lv, m.table.length) - 1] || 0 : 0;
  else if (m.class) v = lv;
  else if (m.mod) v = mod(c.sc[m.mod]);
  else if (m.pb) v = c.pb;
  return Math.floor((v * (m.mult || 1)) / (m.div || 1));
}
