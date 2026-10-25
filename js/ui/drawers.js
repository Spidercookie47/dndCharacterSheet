/* Side panels: Level up and HP, Character options, sheet summary. */
function drawer() {
  const el = $('#dr');
  if (!panel) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  ensureLv(ch);
  const r = resolve(ch),
    c = calc(ch, r),
    I = idx(),
    xp = +ch.d.exp || 0,
    L = ch.level,
    lo = XPT[L - 1],
    hi = XPT[Math.min(L, 19)],
    pct = L >= 20 ? 100 : Math.min(100, Math.max(0, ((xp - lo) / (hi - lo)) * 100));
  const bar = `<div class="xp"><span>${lo} XP</span><div class="xb"><i style="width:${pct}%"></i></div><span>${L >= 20 ? 'Max' : hi + ' XP'}</span></div>`,
    hd_ = (n) => `<div class="dh"><b>${n}</b><button class="lnk" data-a="pclose">✕</button></div>`;
  let h = '';
  if (panel === 'lvl') {
    const lc = classLevels(ch),
      sc = c.sc;
    h =
      hd_('LEVEL UP & MULTICLASSING') +
      bar +
      `<label>Current XP<input type="number" min="0" data-f="d.exp" value="${xp}"></label>` +
      (xp >= hi && L < 20 ? '<p class="hint">You have enough XP to level up.</p>' : '') +
      `<div class="bar" style="justify-content:space-between;margin:10px 0"><b>YOUR CHARACTER IS LEVEL ${L}</b><button class="lnk" data-a="lvldown"${L < 2 ? ' disabled' : ''}>Remove the last level</button></div>`;
    if (!ch.cls) h += '<p class="hint">Choose a class on the Build tab first.</p>';
    else {
      h +=
        Object.entries(lc)
          .map(([cid, n]) => {
            const e = I[cid];
            if (!e) return '';
            let k = 0;
            const rows = ch.lv
              .map((x, i) => [x, i])
              .filter((o) => o[0].c === cid)
              .map(([x, i]) => {
                k++;
                const fixed = i === 0 || ch.opt.avg,
                  v = i === 0 ? e.hd : ch.opt.avg ? avgHp(e.hd) : x.v;
                return `<div class="hr"><span>LEVEL ${k}</span>${fixed ? '<span class="hrs"></span>' : `<input type="range" min="1" max="${e.hd}" value="${x.v}" data-hp="${i}">`}<b>+${v} HP</b></div>`;
              })
              .join('');
            return `<div class="cc"><div class="bar" style="justify-content:space-between"><b>${esc(e.name.toUpperCase())} (${n})</b><button class="lnk" data-a="lvlup" data-c="${esc(cid)}"${L >= 20 ? ' disabled' : ''}>Level up ⇧</button></div><p class="hint">${esc((e.desc || '').split('.')[0])}.</p><div class="bar" style="justify-content:space-between"><span class="hint">HIT POINTS</span><span class="hint">D${e.hd}</span></div>${rows}</div>`;
          })
          .join('') + `<p><b>Total hit points: <span id="hpt">${c.hp}</span></b></p>`;
      if (ch.opt.multi && L < 20)
        h +=
          '<div class="ph"><span>Multiclass</span></div>' +
          ofType('Class')
            .filter((e) => !lc[e.id])
            .map((e) => {
              const bad = [...Object.keys(lc), e.id].filter((x) => !preOk(x, sc));
              return `<div class="rw"><span>${esc(e.name)}${bad.length ? ` <span class="src">needs ${bad.map(preTxt).join('; ')}</span>` : ''}</span><button class="lnk" data-a="lvlup" data-c="${esc(e.id)}"${bad.length ? ' disabled' : ''}>Add level</button></div>`;
            })
            .join('');
    }
  } else if (panel === 'opt')
    h =
      hd_('CHARACTER OPTIONS') +
      [
        [
          'avg',
          'Average hit points',
          'The character is awarded the average amount of hit points based on their hit dice.',
        ],
        [
          'feats',
          'Feats',
          'Using the optional feats rule, you can forgo the Ability Score Improvement feature to take a feat instead. There are no feats in the data yet.',
        ],
        [
          'multi',
          'Multiclassing',
          'Multiclassing allows you to gain levels in multiple classes. To qualify for a new class, you must meet the ability score prerequisites for both your current class and your new one.',
        ],
      ]
        .map(
          ([k, n, d]) =>
            `<label class="oc"><input type="checkbox" data-o="${k}"${ch.opt[k] ? ' checked' : ''}> <b>${n}</b><small>${d}</small></label>`,
        )
        .join('') +
      '<div class="bar"><button data-a="optok">OK</button><button class="alt" data-a="optno">Cancel</button></div>';
  else {
    const cl = r.els.find((e) => e.type === 'Race'),
      sr = r.els.find((e) => e.type === 'Sub Race'),
      bg = r.els.find((e) => e.type === 'Background'),
      cn = Object.entries(classLevels(ch))
        .map(([k, n]) => ((I[k] || {}).name || '') + (Object.keys(classLevels(ch)).length > 1 ? ' ' + n : ''))
        .join(' / ');
    h =
      hd_(esc(ch.name || 'Unnamed hero').toUpperCase()) +
      bar +
      (ch.img ? `<img class="av big" src="${ch.img}">` : '<div class="av big"></div>') +
      `<h3 style="text-align:center;border:0">LEVEL ${L} ${esc((sr || cl || {}).name || '')} ${esc(cn).toUpperCase()}</h3><p class="hint" style="text-align:center">${esc(bg ? bg.name : '')} ${ch.d.gender ? '• ' + esc(ch.d.gender) : ''}</p><p style="text-align:center">Proficiency <b>${sg(c.pb)}</b> · Initiative <b>${sg(c.init)}</b> · AC <b>${c.ac}</b> · Speed <b>${c.speed}ft</b> · HP <b>${c.hp}</b></p>
  <div class="abg">${AB.map((a) => `<div class="ab"><span>${a.toUpperCase()}</span><b>${c.sc[a]} (${sg(mod(c.sc[a]))})</b></div>`).join('')}</div><div class="ph"><span>Skills</span></div><div class="skc">${Object.entries(
    c.sk,
  )
    .map(([n, s]) => `<div>${s.x ? '◆' : s.p ? '☑' : '☐'} ${sg(s.v)} ${n}</div>`)
    .join(
      '',
    )}</div><p>☑ ${c.pp} Passive Perception</p><div class="ph"><span>Saving throws</span></div><div class="skc">${AB.map((a) => `<div>${c.sv[a].p ? '☑' : '☐'} ${sg(c.sv[a].v)} ${AN[a]}</div>`).join('')}</div><div class="bar" style="margin-top:12px"><button class="alt" data-a="prev">Preview sheet</button><button data-a="pdf">Sheet PDF</button></div>`;
  }
  el.innerHTML = h;
}
