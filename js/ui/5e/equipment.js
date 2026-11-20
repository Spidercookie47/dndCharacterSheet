/* Equipment tab: item catalog, inventory, attunement, starting equipment, treasure. */
function eqPane(e) {
  const mg = e.type === 'Magic';
  return (
    `<h2>${esc(e.name)}</h2><p class="hint">${e.src ? esc(e.src) + ' · ' : ''}${esc(e.cg)}${e.rar ? ' · ' + esc(e.rar) : ''}${e.att ? ' · requires attunement' : ''}</p>` +
    (mg ? '' : `<p><b>Cost:</b> ${fmtP(e.cp)} · <b>Weight:</b> ${e.wt || 0} lb</p>`) +
    e.desc
      .split('\n\n')
      .map((p) => `<p>${esc(p)}</p>`)
      .join('') +
    masteryBox(masteryName(e)) +
    `<div class="bar"><label style="margin:0">Quantity <input type="number" min="1" id="eqn" value="${eqn}" style="width:76px"></label><button data-a="addq" data-id="${esc(e.id)}">Add</button>${e.cp ? `<button class="alt" data-a="buy" data-id="${esc(e.id)}">Buy (${fmtP(e.cp * eqn)})</button>` : ''}</div>`
  );
}
function fillEq() {
  const el = $('#el');
  if (!el) return;
  const rs = DB.filter((e) => e.cg === ecat && srcOk(e) && (!eqq || e.name.toLowerCase().includes(eqq)));
  el.innerHTML =
    rs
      .map(
        (e) =>
          `<div class="rw${pv && pv.id === e.id && pv.k === 'item' ? ' pv' : ''}" data-a="pv" data-id="${esc(e.id)}" data-k="item"><span>${esc(e.name)}</span><span class="src">${e.src ? esc(e.src) + ' · ' : ''}${e.type === 'Magic' ? esc(e.rar) : fmtP(e.cp) + ' · ' + (e.wt || 0) + ' lb'}</span></div>`,
      )
      .join('') || '<p class="hint">No items match.</p>';
}
/* Gear on phones: title, Inventory / Shop / Starting / Treasure switch, compact rows that open to show their actions. */
let geOpen = new Set(),
  geAdd = false;
/* the geopen / gearadd handlers are registered in homephone.js: events.js (which defines on()) loads after this file */
document.addEventListener(
  'toggle',
  (e) => {
    if (e.target && e.target.id === 'geadd') geAdd = e.target.open;
  },
  true,
);
document.addEventListener(
  'click',
  (e) => {
    if (e.target.closest && e.target.closest('[data-a="cadd"]')) geAdd = false;
  },
  true,
);
const GE_TABS = [['inv', 'Inventory'], ['shop', 'Shop'], ['start', 'Starting'], ['treasure', 'Treasure']];
const gearHead = () =>
  `<div class="gehd mob"><b>Gear</b><button class="alt" data-a="gearadd">+ Add item</button></div><div class="sg mob">${GE_TABS.map(([k, n]) => `<button class="${eqs === k ? 'on' : ''}" data-a="esub" data-v="${k}">${n}</button>`).join('')}</div>`;

function invView(r, c) {
  const inv = (ch.inv = ch.inv || []),
    I = idx(),
    co = ch.coins || {},
    wt = inv.reduce((s, i) => {
      const e = ent(i);
      return s + (e ? (e.wt || 0) * i.q : 0);
    }, 0),
    cap = c.sc.str * 15,
    at = inv.filter((i) => i.att).length;
  const b = (a, i, x, t) => `<button class="lnk" data-a="${a}" data-i="${i}" data-d="${x}">${t}</button>`;
  const tiles = `<div class="gsum"><div><small>Weight</small><b>${wt.toFixed(1)} / ${cap} lb</b>${wt > cap ? '<em>over</em>' : ''}</div><div><small>Attuned</small><b>${at} / 3</b></div><div><small>Armor class</small><b>${c.ac}</b></div></div>`;
  const rows =
    inv
      .map((i, n) => {
        const e = ent(i);
        if (!e) return '';
        const can = ['Armor', 'Weapon', 'Magic'].includes(e.type),
          warn =
            i.eq && e.type === 'Armor'
              ? !armorOk(r, e)
                ? '⚠ not proficient'
                : e.smin && c.sc.str < e.smin
                  ? '⚠ Strength ' + e.smin + ' needed (speed −10)'
                  : e.sd
                    ? 'stealth disadvantage'
                    : ''
              : '',
          open = geOpen.has(n);
        return (
          `<div class="gi${i.eq ? ' on' : ''}${open ? ' open' : ''}"><div class="gih" data-a="geopen" data-i="${n}"><span class="gin">${i.eq ? '<b class="k">✓</b> ' : ''}${i.att ? '<b class="a">◆</b> ' : ''}${esc(e.name)}${i.q > 1 ? ' ×' + i.q : ''}${warn.startsWith('⚠') ? '<span class="gwf">⚠</span>' : ''}</span><span class="src">${((e.wt || 0) * i.q).toFixed(1)} lb</span></div>` +
          `<div class="gib">${warn ? '<div>' + esc(warn) + '</div>' : ''}${effTxt(e, i)}${i.tp ? ' <span class="src">· ' + esc(i.tp) + '</span>' : ''}${i.desc ? '<div class="src">' + esc(i.desc) + '</div>' : ''}` +
          `<div class="gia">${can ? b('eqi', n, '', i.eq ? 'Unequip' : 'Equip') : ''}${e.att ? b('att', n, '', i.att ? 'Unattune' : 'Attune') : ''}${b('qty2', n, -1, '−')}${b('qty2', n, 1, '+')}${b('mv', n, -1, '↑')}${b('mv', n, 1, '↓')}${b('rmi2', n, '', 'Remove')}</div></div></div>`
        );
      })
      .join('') || '<p class="hint">Nothing yet. Add items from the Shop tab, or use Starting equipment.</p>';
  const coins = `<div class="ph"><span>Coins</span></div><div class="gco">${['pp', 'gp', 'ep', 'sp', 'cp'].map((k) => `<label><small>${k.toUpperCase()}</small><input type="number" min="0" data-f="c.${k}" value="${co[k] || 0}"></label>`).join('')}</div>`;
  return (
    tiles +
    rows +
    coins +
    `<details class="geadd" id="geadd"${geAdd ? ' open' : ''}><summary>Add a custom item</summary><div class="fg"><label>Name<input type="text" id="cin" value="${esc(cust.n)}"></label><label>Type<select id="cit"><option value=""></option>${['Weapon', 'Armor', 'Wondrous item', 'Ring', 'Potion', 'Scroll', 'Wand', 'Staff', 'Rod', 'Gear'].map((x) => `<option${cust.t === x ? ' selected' : ''}>${x}</option>`).join('')}</select></label><label>Weight (lb)<input type="number" id="ciw" min="0" value="${esc(cust.w)}"></label><label>Qty<input type="number" id="ciq" min="1" value="${cust.q}"></label></div>${cust.t === 'Weapon' ? `<div class="fg"><label>Damage dice<select id="cidc"><option value=""></option>${['1d4', '1d6', '1d8', '1d10', '1d12', '2d6'].map((x) => `<option${cust.dice === x ? ' selected' : ''}>${x}</option>`).join('')}</select></label><label>Damage type<select id="cidt"><option value=""></option>${['slashing', 'piercing', 'bludgeoning'].map((x) => `<option${cust.dt === x ? ' selected' : ''}>${x}</option>`).join('')}</select></label><label>Weapon kind<select id="ciwk"><option value="">Normal (Strength)</option><option value="finesse"${cust.wk === 'finesse' ? ' selected' : ''}>Finesse (Str or Dex)</option><option value="ranged"${cust.wk === 'ranged' ? ' selected' : ''}>Ranged (Dex)</option></select></label><label class="opt"><input type="checkbox" id="cimg"${cust.mg ? ' checked' : ''}><span>Magical weapon</span></label></div>` : ''}<label>Description<textarea id="cid" rows="3">${esc(cust.d)}</textarea></label><div class="fg"><label>AC bonus<input type="number" id="cia" value="${esc(cust.ac)}"></label><label>Saving throw bonus<input type="number" id="cis" value="${esc(cust.sv)}"></label><label>Saving throw applies to<select id="cisw"><option value="">All saving throws</option>${AB.map((a) => `<option value="${a}"${cust.svw === a ? ' selected' : ''}>${AN[a]} only</option>`).join('')}</select></label><label>Weapon attack and damage bonus<input type="number" id="ciwp" value="${esc(cust.wp)}"></label><label>Spell attack bonus<input type="number" id="cisp" value="${esc(cust.sp)}"></label></div><label>Resistances<input type="text" id="cir" value="${esc(cust.res)}" placeholder="fire, necrotic"></label><label class="opt"><input type="checkbox" id="cira"${cust.ra ? ' checked' : ''}><span>Requires attunement</span></label><p><button data-a="cadd">Add</button></p></details>`
  );
}
function startView(r) {
  const cn = (idx()[ch.cls] || {}).name,
    S = SEQ[cn],
    I = idx(),
    se = (ch.se = ch.se || {}),
    nm = (id) => (I[id] || {}).name || id;
  let h = '<div class="ph"><span>Starting equipment</span></div>';
  if (!S) h += '<p class="hint">Choose a class on the Build tab to see its starting equipment.</p>';
  else {
    h +=
      `<p class="hint">${esc(cn)} starting equipment. Pick one option in each row, then add it to your inventory.</p>` +
      (S.f.length
        ? '<div class="ph"><span>You always get</span></div>' +
          S.f
            .map(
              ([id, q]) =>
                `<div class="rw" style="cursor:default"><span>${esc(nm(id))}${q > 1 ? ' ×' + q : ''}</span></div>`,
            )
            .join('')
        : '') +
      S.g
        .map(
          (g, gi) =>
            `<div class="ph"><span>${esc(g.d)}</span></div>` +
            g.o
              .map((o, oi) => {
                const on = (se[gi] || 0) === oi;
                return `<label class="opt" style="font-weight:400"><input type="radio" name="sg${gi}" data-se="${gi}" value="${oi}"${on ? ' checked' : ''}><span>${o.map((p, pi) => (p.i ? esc(nm(p.i)) + (p.q > 1 ? ' ×' + p.q : '') : p.gp ? p.gp + ' gp' : `<select data-sk="${gi}.${oi}.${pi}" style="width:auto">${(SEQC[p.c] || []).map((x) => `<option value="${esc(x)}"${se['k' + gi + '.' + oi + '.' + pi] === x ? ' selected' : ''}>${esc(nm(x))}</option>`).join('')}</select>`)).join(' + ')}</span></label>`;
              })
              .join(''),
        )
        .join('') +
      '<p><button data-a="addstart">Add to inventory</button></p>';
  }
  if (ch.bg === 'Background:Acolyte')
    h +=
      '<div class="ph"><span>Acolyte background equipment</span></div><p class="hint">A holy symbol, prayer book, 5 sticks of incense, vestments, common clothes and 15 gp.</p><p><button class="alt" data-a="addbg">Add background equipment</button></p>';
  return h;
}
function addStart() {
  const cn = (idx()[ch.cls] || {}).name,
    S = SEQ[cn];
  if (!S) return;
  const se = ch.se || {},
    I = idx(),
    add = (id, q) => {
      const e = I[id];
      if (!e) return;
      addQ(id, e.bn ? Math.ceil(q / e.bn) : q);
    };
  S.f.forEach(([id, q]) => add(id, q));
  S.g.forEach((g, gi) => {
    const oi = se[gi] || 0,
      o = g.o[oi] || g.o[0];
    o.forEach((p, pi) => {
      if (p.i) add(p.i, p.q);
      else if (p.gp) ch.coins = { ...(ch.coins || {}), gp: ((ch.coins || {}).gp || 0) + p.gp };
      else {
        const id = se['k' + gi + '.' + oi + '.' + pi] || (SEQC[p.c] || [])[0];
        if (id) add(id, p.q);
      }
    });
  });
  note('Starting equipment added to your inventory.');
}
function addBg() {
  [
    ['Holy symbol (gift)', 1],
    ['Prayer book', 5],
    ['Incense (5 sticks)', 0],
    ['Vestments', 4],
    ['Common clothes', 3],
  ].forEach(([n, w]) => {
    ch.inv = ch.inv || [];
    ch.inv.push({
      id: 'c' + Date.now() + Math.random().toString(36).slice(2, 5),
      name: n,
      wt: w,
      q: 1,
      eq: false,
    });
  });
  ch.coins = { ...(ch.coins || {}), gp: ((ch.coins || {}).gp || 0) + 15 };
  note('Background equipment and 15 gp added.');
}
function renderEquip() {
  const m = $('#main'),
    r = resolve(ch),
    c = calc(ch, r);
  m.className = 'main' + (eqs === 'shop' ? '' : ' one');
  if (eqs === 'shop') {
    const I = idx();
    const s = pv && pv.k === 'item' && I[pv.id];
    m.innerHTML = `<div class="left">${gearHead()}<div class="chips">${ECATS.map((k) => `<button class="lnk${ecat === k ? ' on' : ''}" data-a="ecat" data-v="${esc(k)}">${k}</button>`).join('')}</div><div class="bar">${srcSel()}<input type="text" id="eqs" placeholder="Filter by name…" value="${esc(eqq)}" style="max-width:260px"></div><div class="ph"><span>${ecat}</span><span class="src">${ecat.startsWith('Magic') || /Wondrous|Rings|Rods|Staffs|Wands|Potions|Scrolls/.test(ecat) ? 'Rarity' : 'Price · Weight'}</span></div><div id="el"></div></div><div class="right">${s ? eqPane(s) : '<p class="hint">Click an item to read about it. Double-click it to add it, or use Buy to pay with your coins.</p>'}</div>`;
    fillEq();
  } else if (eqs === 'inv') m.innerHTML = `<div class="left">${gearHead()}${invView(r, c)}</div>`;
  else if (eqs === 'start') m.innerHTML = `<div class="left">${gearHead()}${startView(r)}</div>`;
  else
    m.innerHTML = `<div class="left">${gearHead()}<div class="ph"><span>Additional treasure and quest items</span></div><p class="hint">Gems, art objects, keys, letters and quest items. This goes on the sheet's treasure box.</p>${TA('treasure', 'Treasure and quest items', 12)}</div>`;
}
function effTxt(e, i) {
  const d = MEF[e.id] || i.fx,
    t = [];
  if (i.res) t.push('resist: ' + esc(i.res));
  if (i.dice) t.push(esc(i.dice) + (i.dt ? ' ' + esc(i.dt) : ''));
  if (i.mg) t.push('magical');
  if (!d) return t.length ? ` <span class="src">${t.join(', ')}</span>` : '';
  if (d.ac) t.push('+' + d.ac + ' AC');
  if (d.saves) t.push('+' + d.saves + ' saves');
  if (d.sa) Object.entries(d.sa).forEach(([a, v]) => t.push('+' + v + ' ' + AN[a] + ' saves'));
  if (d.brac) t.push('AC +' + d.brac + ' with no armor or shield');
  if (d.wpn) t.push('+' + d.wpn + ' to weapon rows');
  if (d.spA) t.push('+' + d.spA + ' spell attack');
  if (d.set)
    t.push(
      Object.entries(d.set)
        .map(([a, v]) => AN[a] + ' ' + v)
        .join(', '),
    );
  const on = d.att ? i.att : i.eq;
  return ` <span class="src">${t.join(', ')}${on ? '' : ' (inactive' + (d.att ? ': attune it' : ': equip it') + ')'}</span>`;
}
