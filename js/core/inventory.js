/* Inventory rules: armor class from worn armor, adding items, buying with coins. */
function eqArmor(c, dm) {
  const I = idx(),
    eq = (c.inv || []).filter((i) => i.eq && I[i.id]).map((i) => I[i.id]),
    a = eq.find((e) => e.type === 'Armor' && e.kind !== 'Shield'),
    sh = eq.some((e) => e.kind === 'Shield');
  return {
    ac:
      (a ? a.ac + (a.kind === 'Light' ? dm : a.kind === 'Medium' ? Math.min(dm, 2) : 0) : 10 + dm) +
      (sh ? 2 : 0),
    worn: !!a,
  };
}
const ent = (i) =>
  idx()[i.id] || (i.name ? { name: i.name, wt: i.wt || 0, type: 'Custom', cg: 'Custom' } : null);
function addQ(id, q) {
  ch.inv = ch.inv || [];
  q = Math.max(1, +q || 1);
  const x = ch.inv.find((i) => i.id === id);
  x ? (x.q += q) : ch.inv.push({ id, q, eq: false });
}
function buy(id, q) {
  const e = idx()[id];
  q = Math.max(1, +q || 1);
  if (!e || !e.cp) {
    note('No listed price for ' + (e ? e.name : 'that item') + '.');
    return false;
  }
  const c = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0, ...(ch.coins || {}) };
  let need = e.cp * q;
  for (const d of ['cp', 'sp', 'ep', 'gp', 'pp']) {
    if (need <= 0) break;
    const t = Math.min(c[d], Math.ceil(need / CPV[d]));
    c[d] -= t;
    need -= t * CPV[d];
  }
  if (need > 0) {
    note('Not enough coins: ' + fmtP(e.cp * q) + ' needed.');
    return false;
  }
  if (need < 0) {
    let ch_ = -need;
    c.gp += Math.floor(ch_ / 100);
    ch_ %= 100;
    c.sp += Math.floor(ch_ / 10);
    c.cp += ch_ % 10;
  }
  ch.coins = c;
  addQ(id, q);
  note('Bought ' + q + ' × ' + e.name + ' for ' + fmtP(e.cp * q) + '.');
  return true;
}
