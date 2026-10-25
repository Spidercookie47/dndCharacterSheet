/* All user input goes through here. Buttons carry data-a="action"; each action is a function
   registered below. Return false from an action to skip the redraw. */
const Actions = {};
const on = (name, fn) => {
  Actions[name] = fn;
};

const chooseAny = (k, id) => (k === 'item' ? addQ(id, eqn) : k === 'spell' ? toggleSpell(id) : choose(k, id));

/* ---- navigation ---- */
on('tab', (d) => {
  tab = d.v;
  pv = null;
});
on('sub', (d) => {
  sub = d.v;
  pv = null;
});
on('startsub', (d) => {
  startSub = d.v;
});
on('msub', (d) => {
  msub = d.v;
});
on('msp', (d) => {
  msp = d.v;
});
on('esub', (d) => {
  eqs = d.v;
});
on('ecat', (d) => {
  ecat = d.v;
});
on('spl', (d) => {
  spl = d.v;
});
on('spall', () => {
  spall = !spall;
});
on('pvx', () => {
  $('#ov').hidden = true;
  return false;
});

/* ---- picking rows (single click previews, a quick second click or the Select button chooses) ---- */
on('pv', (d) => {
  const n = Date.now(),
    twice = lastPv && lastPv.k === d.k && lastPv.id === d.id && n - lastPv.t < 450;
  pv = { id: d.id, k: d.k };
  if (twice) {
    lastPv = null;
    chooseAny(d.k, d.id);
  } else lastPv = { k: d.k, id: d.id, t: n };
});
on('pick', (d) => {
  chooseAny(d.k, d.id);
});
on('rm', (d) => {
  ch[d.k] = '';
  pv = null;
});

/* ---- characters ---- */
on('new', () => {
  ch = fresh();
  persist();
  tab = 'build';
  sub = 'race';
  pv = null;
});
on('open', (d) => {
  ch = store.chars.find((c) => c.id === d.id) || ch;
  tab = 'build';
  sub = 'race';
  pv = null;
});
on('del', (d) => {
  delId = d.id;
});
on('delno', () => {
  delId = null;
});
on('delyes', (d) => {
  store.chars = store.chars.filter((c) => c.id !== d.id);
  if (ch.id === d.id) {
    ch = fresh();
    store.cur = null;
  }
  delId = null;
  try {
    localStorage.setItem('aw-store', JSON.stringify(store));
  } catch (x) {}
});
on('save', () => {
  saveFile();
  return false;
});
on('pdf', () => {
  pdf();
  return false;
});
on('prev', () => {
  preview();
  return false;
});

/* ---- ability scores ---- */
on('meth', (d) => {
  ch.method = d.v;
  const R = () => Math.floor(Math.random() * 6) + 1;
  ch.ab =
    d.v === 'array'
      ? { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }
      : d.v === 'buy'
        ? { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }
        : Object.fromEntries(
            AB.map((k) => {
              const x = [R(), R(), R(), R()].sort();
              return [k, x[1] + x[2] + x[3]];
            }),
          );
});
on('ab', (d) => {
  const k = d.k,
    n = ch.ab[k] + +d.d,
    buy = ch.method === 'buy',
    lo = buy ? 8 : 3,
    hi = buy ? 15 : 18;
  if (n < lo || n > hi) return false;
  const old = ch.ab[k];
  ch.ab[k] = n;
  if (
    buy &&
    AB.reduce((s, q) => s + { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }[ch.ab[q]], 0) > 27
  )
    ch.ab[k] = old;
});
on('atkfill', () => {
  atkFill();
});
on('ex', (d) => {
  ch.exp = ch.exp || {};
  const k = d.k,
    id = d.id,
    s = resolve(ch).exp.find((x) => x.key === k),
    a = (ch.exp[k] = ch.exp[k] || []);
  if (a.includes(id)) a.splice(a.indexOf(id), 1);
  else if (a.length < (s ? s.n : 2)) {
    if (Object.entries(ch.exp).some(([kk, v]) => kk !== k && v.includes(id)))
      note(id + ' already has expertise.');
    else a.push(id);
  } else note('Choose only ' + (s ? s.n : 2) + ' skills for this feature.');
});

/* ---- side panels: level up, options, sheet summary ---- */
const openPanel = (p) => {
  if (p === 'opt' && panel !== 'opt') optBk = JSON.stringify((ensureLv(ch), ch.opt));
  panel = panel === p ? null : p;
};
on('lvl', () => openPanel('lvl'));
on('opt', () => openPanel('opt'));
on('sheetpanel', () => openPanel('sheet'));
on('sp', () => openPanel('sheet'));
on('pclose', () => {
  panel = null;
});
on('lvlup', (d) => {
  ensureLv(ch);
  const cid = d.c,
    lc = classLevels(ch);
  if (ch.level >= 20) return false;
  if (!lc[cid]) {
    if (!ch.opt.multi) {
      note('Multiclassing is turned off in Character options.');
      return false;
    }
    const sc = calc(ch, resolve(ch)).sc,
      bad = [...Object.keys(lc), cid].filter((x) => !preOk(x, sc));
    if (bad.length) {
      note('Requirements not met: ' + bad.map((x) => idx()[x].name + ' needs ' + preTxt(x)).join('; '));
      return false;
    }
  }
  ch.lv.push({ c: cid, v: avgHp(idx()[cid].hd) });
});
on('lvldown', () => {
  ensureLv(ch);
  if (ch.lv.length > 1) ch.lv.pop();
});
on('optok', () => {
  panel = null;
});
on('optno', () => {
  ch.opt = JSON.parse(optBk || '{}');
  panel = null;
});
on('imgrm', () => {
  ch.img = '';
});
on('symrm', () => {
  ch.sym = '';
});
on('res', (d) => {
  ch.used = ch.used || {};
  ch.used[d.k] = Math.max(0, Math.min(+d.m || 0, (ch.used[d.k] || 0) + +d.d));
});
on('rest', (d) => {
  const r = resolve(ch),
    R = resources(r, calc(ch, r));
  ch.used = ch.used || {};
  R.forEach((x) => {
    if (d.v === 'L' || x.rest === 'S') ch.used[x.k] = 0;
  });
  note(d.v === 'L' ? 'Long rest: everything restored.' : 'Short rest: short-rest resources restored.');
});

/* ---- backstory ---- */
on('roll', (d) => {
  const o = bgOpts(d.t);
  if (o && o.length) setPick(d.k, o[Math.floor(Math.random() * o.length)]);
  return false;
});
on('trroll', () => {
  ch.d.trinket = TRINK[Math.floor(Math.random() * TRINK.length)];
});

/* ---- equipment ---- */
on('addq', (d) => {
  addQ(d.id, eqn);
  note('Added to your inventory.');
});
on('buy', (d) => {
  buy(d.id, eqn);
});
on('eqi', (d) => {
  const inv = ch.inv,
    x = inv[+d.i],
    I = idx(),
    e0 = I[x.id] || {};
  x.eq = !x.eq;
  if (x.eq && e0.type === 'Armor')
    inv.forEach((o) => {
      const f = I[o.id] || {};
      if (o !== x && f.type === 'Armor' && (f.kind === 'Shield') === (e0.kind === 'Shield')) o.eq = false;
    });
});
on('att', (d) => {
  const inv = ch.inv,
    x = inv[+d.i];
  if (!x.att && inv.filter((o) => o.att).length >= 3) note('You can attune to at most 3 items.');
  else x.att = !x.att;
});
on('mv', (d) => {
  const inv = ch.inv,
    n = +d.i,
    j = n + +d.d;
  if (j >= 0 && j < inv.length) [inv[n], inv[j]] = [inv[j], inv[n]];
});
on('qty2', (d) => {
  const inv = ch.inv,
    x = inv[+d.i];
  x.q += +d.d;
  if (x.q < 1) inv.splice(+d.i, 1);
});
on('rmi2', (d) => {
  ch.inv.splice(+d.i, 1);
});
on('cadd', () => {
  if (!cust.n) {
    note('Give the item a name.');
    return false;
  }
  ch.inv.push({
    id: 'c' + Date.now(),
    name: cust.n,
    wt: +cust.w || 0,
    q: Math.max(1, +cust.q || 1),
    eq: false,
  });
  cust = { n: '', w: '', q: 1 };
});
on('addstart', () => {
  addStart();
});
on('addbg', () => {
  addBg();
});

/* ---- sources (content packs) ---- */
on('srctoggle', (d) => {
  Loader.toggle(d.id);
});
on('srcremove', (d) => {
  sourcesAction(async () => {
    await Loader.remove(d.id);
    return [];
  });
  return false;
});
on('srcrefresh', (d) => {
  sourcesAction(() => Loader.refresh(d.id));
  return false;
});
on('srcadd', () => {
  srcUrl = ($('#srcurl') || {}).value || '';
  sourcesAction(() => Loader.addUrl(srcUrl));
  return false;
});
on('srcpaste', () => {
  srcPaste = ($('#srcpaste') || {}).value || '';
  sourcesAction(() => Loader.addText(srcPaste));
  return false;
});

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-a]');
  if (!t) return;
  const fn = Actions[t.dataset.a];
  if (!fn) return;
  ch.inv = ch.inv || [];
  if (fn(t.dataset, t, e) !== false) draw();
});

/* ---- typing ---- */
document.addEventListener('input', (e) => {
  const t = e.target,
    d = t.dataset;
  if (d.f && (t.type === 'text' || t.tagName === 'TEXTAREA')) {
    setF(d.f, t.value);
    persist();
    chrome();
  } else if (d.hp !== undefined) {
    ensureLv(ch);
    ch.lv[+d.hp].v = +t.value;
    t.nextElementSibling.textContent = '+' + t.value + ' HP';
    persist();
    chrome();
    const s = $('#hpt');
    if (s) s.textContent = calc(ch, resolve(ch)).hp;
  } else if (t.id === 'spq') {
    spq = t.value.toLowerCase();
    fillList();
  } else if (t.id === 'eqs') {
    eqq = t.value.toLowerCase();
    fillEq();
  } else if (t.id === 'cin') cust.n = t.value;
  else if (t.id === 'ciw') cust.w = t.value;
  else if (t.id === 'ciq') cust.q = t.value;
  else if (t.id === 'eqn') eqn = Math.max(1, +t.value || 1);
  else if (t.id === 'srcurl') srcUrl = t.value;
  else if (t.id === 'srcpaste') srcPaste = t.value;
});

/* ---- choosing from lists and fields ---- */
function scaledImage(file, type, done) {
  const im = new Image(),
    u = URL.createObjectURL(file);
  im.onload = () => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const s = Math.min(im.width, im.height);
    cv.getContext('2d').drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 256, 256);
    URL.revokeObjectURL(u);
    done(cv.toDataURL(type, 0.85));
  };
  im.onerror = () => note('That image could not be read.');
  im.src = u;
}
function loadCharacterFile(text) {
  let j;
  try {
    j = JSON.parse(text);
  } catch (err) {
    note('That file is not valid JSON.');
    return;
  }
  if (!j || !/^(aurora-web|hearthscribe)-character$/.test(j.format) || !j.character) {
    note('That is not a Hearthscribe character file.');
    return;
  }
  const c = j.character,
    b = fresh();
  ch = { ...b, ...c, ab: { ...b.ab, ...c.ab }, picks: c.picks || {}, d: c.d || {} };
  persist();
  tab = 'build';
  sub = 'race';
  draw();
}
document.addEventListener('change', (e) => {
  const t = e.target,
    d = t.dataset,
    k = d.f;
  if (d.asi) {
    const c = (ch.asi = ch.asi || {}),
      v = (c[d.asi] = c[d.asi] || {});
    v[d.p] = t.value;
    if (d.p === 't') v.a = v.b = v.f = '';
    persist();
    draw();
  } else if (d.o) {
    ch.opt[d.o] = t.checked;
    persist();
    draw();
  } else if (d.sc !== undefined) {
    spc = t.value;
    draw();
  } else if (d.se !== undefined) {
    ch.se = ch.se || {};
    ch.se[d.se] = +t.value;
    persist();
  } else if (d.sk) {
    ch.se = ch.se || {};
    ch.se['k' + d.sk] = t.value;
    persist();
  } else if (d.pk !== undefined) {
    if (t.value !== '') setPick(d.pk, bgOpts(d.t)[+t.value]);
  } else if (d.tr !== undefined) {
    if (t.value !== '') {
      ch.d.trinket = TRINK[+t.value];
      persist();
      draw();
    }
  } else if (t.id === 'eqn') {
    eqn = Math.max(1, +t.value || 1);
    draw();
  } else if (k && k.startsWith('d.')) {
    setF(k, t.value);
    persist();
    if (t.closest('#dr')) drawer();
  } else if (k && k.startsWith('c.')) {
    ch.coins = ch.coins || {};
    ch.coins[k.slice(2)] = Math.max(0, +t.value || 0);
    persist();
  } else if (k && t.type !== 'text' && t.tagName !== 'TEXTAREA') {
    if (k === 'shield') ch.shield = t.checked;
    else ch[k] = t.value;
    draw();
  } else if (t.id === 'img' && t.files[0])
    scaledImage(t.files[0], 'image/jpeg', (u) => {
      ch.img = u;
      persist();
      draw();
    });
  else if (t.id === 'sym' && t.files[0])
    scaledImage(t.files[0], 'image/png', (u) => {
      ch.sym = u;
      persist();
      draw();
    });
  else if (t.id === 'open' && t.files[0]) {
    t.files[0].text().then(loadCharacterFile);
    t.value = '';
  } else if (t.id === 'srcfile' && t.files[0]) {
    const f = t.files[0];
    f.text().then((x) => sourcesAction(() => Loader.addText(x, f.name.replace(/\.json$/i, ''))));
    t.value = '';
  }
});
