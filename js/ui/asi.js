/* Ability score improvements, feats and attack auto-fill. */
function renderAsi() {
  const m = $('#main');
  m.className = 'main one';
  const r = resolve(ch);
  ch.asi = ch.asi || {};
  const allFeats = ofType('Feat'),
    featsFor = (slot) =>
      allFeats.filter((f) => (slot.epic ? f.cls === 'epic' : !f.cls || f.cls === 'general' || f.cls === 'origin')), // origin feats have no prerequisite, so they can be taken at an improvement slot too
    fo = ch.opt && ch.opt.feats !== false;
  const ab = (k, p, v) =>
    `<select data-asi="${k}" data-p="${p}"><option value="">Ability…</option>${AB.map((a) => `<option value="${a}"${v === a ? ' selected' : ''}>${AN[a]}</option>`).join('')}</select>`;
  const rows = r.asi
    .map((s) => {
      const c = ch.asi[s.key] || {},
        t = c.t || '';
      return `<div class="rw" style="cursor:default;flex-wrap:wrap;align-items:center"><b style="min-width:170px">${esc(s.cls)} · level ${s.level}</b><select data-asi="${s.key}" data-p="t"><option value="">Choose…</option>${s.epic ? '' : `<option value="2"${t === '2' ? ' selected' : ''}>+2 to one ability</option><option value="11"${t === '11' ? ' selected' : ''}>+1 to two abilities</option>`}${fo || s.epic ? `<option value="f"${t === 'f' ? ' selected' : ''}>Take a feat</option>` : ''}</select>${t === '2' ? ab(s.key, 'a', c.a) : t === '11' ? ab(s.key, 'a', c.a) + ab(s.key, 'b', c.b) : t === 'f' ? `<select data-asi="${s.key}" data-p="f"><option value="">Feat…</option>${featsFor(s).map((f) => `<option value="${esc(f.id)}"${c.f === f.id ? ' selected' : ''}>${esc(f.name)}</option>`).join('')}</select>` : ''}</div>`;
    })
    .join('');
  m.innerHTML = `<div class="left"><div class="ph"><span>Ability score improvements and feats</span></div><p class="hint">Each slot comes from a class level. Scores stop at 20. Feats can be turned off in Character options.</p>${rows || '<p class="hint">No slots yet. They unlock at class levels 4, 8, 12, 16 and 19 (Fighters and Rogues get extra ones).</p>'}</div>`;
}
function atkFill() {
  const r = resolve(ch),
    c = calc(ch, r),
    I = idx(),
    Wl = (ch.inv || []).filter((i) => i.eq && I[i.id] && I[i.id].type === 'Weapon').slice(0, 3);
  if (!Wl.length) {
    note('Equip a weapon on the Equipment tab first.');
    return;
  }

  Wl.forEach((i, n) => {
    const e = I[i.id],
      rng = /Ammunition/.test(e.desc),
      fin = /Finesse/.test(e.desc),
      k = rng ? 'dex' : fin && c.sc.dex > c.sc.str ? 'dex' : 'str',
      m = mod(c.sc[k]),
      pr = profW(r, e),
      dm = e.desc.match(/Damage (\d+d\d+) (\w+)/) || [];
    ch.d['a' + (n + 1) + 'n'] = e.name;
    const ar = rng && r.els.some((x) => x.type === 'Fighting Style' && x.name === 'Archery') ? 2 : 0,
      du =
        !rng &&
        Wl.length === 1 &&
        !/Two-handed|Heavy/.test(e.desc) &&
        r.els.some((x) => x.type === 'Fighting Style' && x.name === 'Dueling')
          ? 2
          : 0;
    {
      const mw = magicB(ch).wpn;
      ch.d['a' + (n + 1) + 'b'] = sg(m + (pr ? c.pb : 0) + ar + mw);
      ch.d['a' + (n + 1) + 'd'] = (dm[1] || '') + sg(m + du + mw) + ' ' + (dm[2] || '');
    }
  });
}
