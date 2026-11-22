/* Desktop Equipment > Inventory (861px and wider). Phones keep the Gear layout from equipment.js.
   Load after desksheet.js. Reuses the existing actions eqi, att, qty2, mv, rmi2, gearadd and data-f coin inputs. */
(() => {
  const MQ = window.matchMedia('(min-width: 861px)');
  let sel = null, cat = 'all', q = '';
  const active = () => MQ.matches && system === 'dnd5e' && !mfocus && tab === 'equip' && eqs === 'inv';
  const CATS = [['all', 'All'], ['Weapons', 'Weapons'], ['Armor', 'Armor'], ['Magic', 'Magic'], ['Gear', 'Gear']];
  const BADGE = { Weapons: 'W', Armor: 'A', Magic: 'M', Gear: 'G' };
  const catOf = (e) => (e.type === 'Weapon' ? 'Weapons' : e.type === 'Armor' ? 'Armor' : e.type === 'Magic' ? 'Magic' : 'Gear');
  const canEq = (e) => ['Armor', 'Weapon', 'Magic'].includes(e.type);

  function sub(e, i) {
    const t = [];
    if (e.type === 'Weapon') {
      const m = (e.desc || '').match(/Damage (\d+d\d+) (\w+)/);
      if (m) t.push(m[1] + ' ' + m[2]);
      else if (i.dice) t.push(i.dice + (i.dt ? ' ' + i.dt : ''));
      const mn = masteryName(e);
      if (mn) t.push('Mastery: ' + mn);
    } else if (e.type === 'Magic') {
      if (e.rar) t.push(e.rar);
      if (i.att) t.push('attuned');
    }
    if (!t.length) t.push(String(e.desc || i.desc || '').split('\n')[0].slice(0, 70));
    return t.join(' · ');
  }

  function wstat(i, e, r, c) {
    const cu = !idx()[i.id], d = e.desc || '';
    const rng = cu ? i.wk === 'ranged' : /Ammunition/.test(d);
    const fin = cu ? i.wk === 'finesse' : /Finesse/.test(d);
    const k = rng ? 'dex' : fin && c.sc.dex > c.sc.str ? 'dex' : 'str', m = mod(c.sc[k]);
    const pr = cu || profW(r, e), mw = magicB(ch).wpn;
    const dm = cu ? [0, i.dice || '', i.dt || ''] : d.match(/Damage (\d+d\d+) (\w+)/) || [];
    return { atk: sg(m + (pr ? c.pb : 0) + mw), dmg: (dm[1] || '') + sg(m + mw) };
  }

  function html() {
    const r = resolve(ch), c = calc(ch, r), inv = (ch.inv = ch.inv || []), co = ch.coins || {};
    const list = inv.map((i, n) => ({ i, n, e: ent(i) })).filter((x) => x.e);
    const cur = list.find((x) => x.i.id === sel) || list.find((x) => x.i.eq) || list[0];
    sel = cur ? cur.i.id : null;
    const wt = list.reduce((s, x) => s + (x.e.wt || 0) * x.i.q, 0), cap = c.sc.str * 15;
    const at = inv.filter((i) => i.att).length;
    const btn = (a, n, d, t, alt) => `<button class="${alt ? 'alt' : ''}" data-a="${a}" data-i="${n}" data-d="${d}">${t}</button>`;

    const row = ({ i, e, n }) =>
      `<div class="iv-r${i.eq ? ' eq' : ''}${cur && cur.n === n ? ' sel' : ''}" data-a="invsel" data-id="${esc(i.id)}" data-n="${esc((e.name || '').toLowerCase())}">` +
      `<span class="iv-b">${BADGE[catOf(e)]}</span>` +
      `<span class="iv-w"><b>${esc(e.name)}${i.att ? ' <i class="iv-a">◆</i>' : ''}${favHas(i.id) ? ' <i class="iv-a">★</i>' : ''}</b><small>${esc(sub(e, i))}</small></span>` +
      `<span class="iv-wt">${((e.wt || 0) * i.q).toFixed(1)} lb</span>` +
      `<span class="iv-q">${btn('qty2', n, -1, '−', 1)}<b>${i.q}</b>${btn('qty2', n, 1, '+', 1)}</span>` +
      `<span class="iv-x">${canEq(e) ? btn('eqi', n, '', i.eq ? 'Unequip' : 'Equip', i.eq) : ''}${e.att ? btn('att', n, '', i.att ? 'Unattune' : 'Attune', i.att) : ''}</span></div>`;

    const vis = (x) => (cat === 'all' || catOf(x.e) === cat) && (!q || x.e.name.toLowerCase().includes(q));
    const shown = list.filter(vis);
    const grp = (title, a) =>
      a.length
        ? `<div class="iv-g"><div class="iv-h"><h3>${title}</h3><span>${a.length} item${a.length === 1 ? '' : 's'}</span></div>${a.map(row).join('')}</div>`
        : '';
    const body =
      grp('Equipped', shown.filter((x) => x.i.eq)) +
      ['Weapons', 'Armor', 'Magic', 'Gear'].map((g) => grp(g, shown.filter((x) => !x.i.eq && catOf(x.e) === g))).join('');

    let form = '';
    if (geAdd) {
      const m = invView(r, c).match(/<details class="geadd"[\s\S]*<\/details>/);
      form = m ? m[0] : '';
    }

    const bar =
      `<div class="iv-bar"><input type="text" id="invq" placeholder="Filter your items…" value="${esc(q)}">` +
      CATS.map(([k, n]) => `<button class="lnk${cat === k ? ' on' : ''}" data-a="invcat" data-v="${k}">${n}</button>`).join('') +
      '<button class="iv-add" data-a="gearadd">+ Add custom item</button></div>';

    const pips = [0, 1, 2].map((k) => `<i class="${k < at ? 'f' : ''}"></i>`).join('');
    const carry =
      `<section class="iv-card"><div class="iv-lab">Carrying</div><div class="iv-big">${wt.toFixed(1)}<span> / ${cap} lb</span></div>` +
      `<div class="iv-meter"><i class="${wt > cap ? 'over' : ''}" style="width:${Math.min(100, (wt / cap) * 100)}%"></i></div>` +
      `<div class="iv-two"><div><div class="iv-lab">Attuned</div><div class="iv-pips">${pips}</div></div><div><div class="iv-lab">Armor class</div><div class="iv-big">${c.ac}</div></div></div>` +
      `<div class="iv-lab">Coins</div><div class="iv-coins">${['pp', 'gp', 'ep', 'sp', 'cp'].map((k) => `<label><small>${k.toUpperCase()}</small><input type="number" min="0" data-f="c.${k}" value="${co[k] || 0}"></label>`).join('')}</div></section>`;

    let det = '<section class="iv-card"><p class="hint">Nothing here yet. Add items from the Equipment tab or Starting equipment.</p></section>';
    if (cur) {
      const { i, e, n } = cur;
      const w = e.type === 'Weapon' ? wstat(i, e, r, c) : null;
      const d = String(e.desc || '')
        .split('\n\n')
        .filter(Boolean)
        .map((p) => `<p>${esc(p)}</p>`)
        .join('');
      det =
        `<section class="iv-card"><h2 class="iv-t">${esc(e.name)}</h2><p class="iv-s">${[e.type, e.rar, (e.wt || 0) + ' lb', i.eq ? 'equipped' : ''].filter(Boolean).map(esc).join(' · ')}</p>` +
        (w ? `<div class="iv-two"><div class="iv-tile"><div class="iv-lab">Attack</div><b>${w.atk}</b></div><div class="iv-tile"><div class="iv-lab">Damage</div><b>${esc(w.dmg)}</b></div></div>` : '') +
        d + (i.desc ? `<p>${esc(i.desc)}</p>` : '') + effTxt(e, i) + masteryBox(masteryName(e)) +
        `<div class="iv-act">${canEq(e) ? btn('eqi', n, '', i.eq ? 'Unequip' : 'Equip', i.eq) : ''}${e.att ? btn('att', n, '', i.att ? 'Unattune' : 'Attune', i.att) : ''}${btn('mv', n, -1, 'Move up', 1)}${btn('mv', n, 1, 'Move down', 1)}${favBtn(i.id, 'alt')}<button class="lnk" data-a="rmi2" data-i="${n}" data-d="">Remove</button></div></section>`;
    }

    return `<div class="left">${bar}${body || '<p class="hint">No items match.</p>'}${form}</div><div class="iv-side">${carry}${det}</div>`;
  }

  const base = renderEquip;
  renderEquip = function () {
    if (!active()) return base();
    const m = $('#main');
    m.className = 'main iv';
    m.innerHTML = html();
  };

  on('invsel', (d) => { sel = d.id; });
  on('invcat', (d) => { cat = d.v; });

  document.addEventListener('input', (e) => {
    if (e.target.id !== 'invq') return;
    q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('.iv-r').forEach((r) => (r.style.display = !q || r.dataset.n.includes(q) ? '' : 'none'));
    document.querySelectorAll('.iv-g').forEach((g) => (g.style.display = [...g.querySelectorAll('.iv-r')].some((r) => r.style.display !== 'none') ? '' : 'none'));
  });
  MQ.addEventListener('change', () => draw());
})();
