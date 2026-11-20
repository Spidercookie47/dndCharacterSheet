/* Level-up screen (phone, tablet and desktop). Load after events.js, shell.js and bottombar.js.
   Opening it adds the level right away; Cancel puts the character back the way it was. */
(() => {
  let wz = null; // { snap, cid, before, mode, rolled }
  const el = document.createElement('div');
  el.className = 'lw';
  el.id = 'lw';
  el.hidden = true;
  document.body.appendChild(el);

  const last = () => ch.lv[ch.lv.length - 1];

  /* change the hit points rolled for the new level; a hurt character keeps the same missing hit points */
  function setV(v) {
    const before = calc(ch, resolve(ch)).hp;
    last().v = v;
    const after = calc(ch, resolve(ch)).hp;
    if (ch.hpNow != null) hpSet(ch.hpNow + (after - before), after);
  }
  function applyMode() {
    const e = idx()[wz.cid];
    setV(wz.mode === 'avg' ? avgHp(e.hd) : wz.rolled);
  }

  on('lvlwiz', () => {
    ensureLv(ch);
    const l = ch.lv[ch.lv.length - 1],
      cid = (l && l.c) || ch.cls;
    if (!cid || !idx()[cid]) {
      note('Choose a class on the Build tab first.');
      return false;
    }
    const snap = JSON.stringify(ch),
      before = calc(ch, resolve(ch)).hp;
    if (Actions.lvlup({ c: cid }) === false) return false;
    note('');
    wz = { snap, cid, before, mode: ch.opt.avg ? 'avg' : 'roll', rolled: last().v };
  });
  on('lwcancel', () => {
    if (!wz) return;
    const s = JSON.parse(wz.snap);
    Object.keys(ch).forEach((k) => delete ch[k]);
    Object.assign(ch, s);
    wz = null;
  });
  on('lwok', () => {
    wz = null;
  });
  on('lwmode', (d) => {
    if (!wz || ch.opt.avg) return;
    wz.mode = d.v;
    applyMode();
  });
  on('lwroll', () => {
    if (!wz || ch.opt.avg || !ch.opt.reroll || wz.mode !== 'roll') return;
    wz.rolled = Math.floor(Math.random() * idx()[wz.cid].hd) + 1;
    applyMode();
  });
  on('lwasi', () => {
    wz = null;
    tab = 'build';
    sub = 'asi';
    pv = null;
  });

  function paint() {
    el.hidden = !wz;
    if (!wz) return;
    const I = idx(),
      e = I[wz.cid],
      r = resolve(ch),
      c = calc(ch, r),
      n = ch.lv.length,
      cl = classLevels(ch)[wz.cid] || 1,
      hd = e.hd,
      avg = avgHp(hd),
      useAvg = wz.mode === 'avg' || ch.opt.avg,
      shown = useAvg ? avg : wz.rolled,
      con = mod(c.sc.con),
      gain = c.hp - wz.before;
    const feats = (e.rules || []).filter((x) => x.grant && I[x.grant] && x.level === cl).map((x) => I[x.grant]),
      asi = r.asi.some((s) => s.cls === e.name && s.level === cl);
    const die = `<svg width="170" height="170" viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,4 90,27 90,73 50,96 10,73 10,27" fill="var(--sel)" stroke="var(--acc)" stroke-width="3"/><text x="50" y="63" text-anchor="middle" font-size="38" font-weight="700" font-family="Fraunces,Georgia,serif" fill="var(--ink)">${shown}</text></svg>`;
    const short = (t) => ((t || '').length > 140 ? t.slice(0, 140).trim() + '…' : t || '');
    el.innerHTML =
      `<div class="lwb"><button class="lnk" data-a="lwcancel">Cancel</button>` +
      `<h1 class="lwt">Level up to ${n}</h1><p class="sub2">${esc(e.name)} ${cl - 1} → ${esc(e.name)} ${cl}</p>` +
      `<section class="lwc"><div class="lwseg"><button class="${useAvg ? '' : 'on'}" data-a="lwmode" data-v="roll"${ch.opt.avg ? ' disabled' : ''}>Roll d${hd}</button><button class="${useAvg ? 'on' : ''}" data-a="lwmode" data-v="avg">Take average (${avg})</button></div>` +
      `<div class="lwdie">${die}</div>` +
      `<p class="lwtx">${useAvg ? 'Average of a d' + hd : 'Rolled ' + shown + ' on a d' + hd}<small>${con ? sg(con) + ' Constitution = ' : ''}<b>+${gain} hit points</b></small></p>` +
      `<button class="alt lwfull" data-a="lwroll"${useAvg || !ch.opt.reroll ? ' disabled' : ''}>Roll again</button>${!useAvg && !ch.opt.reroll ? '<p class="hint" style="text-align:center;margin:8px 0 0">Rerolls are off. Turn them on in Character options.</p>' : ''}</section>` +
      `<section class="lwc lwrow"><b>Maximum hit points</b><span class="lwhp">${wz.before} → ${c.hp}<i>+${gain}</i></span></section>` +
      `<section class="lwc"><div class="lwk">New at level ${cl}</div>` +
      (feats.map((f) => `<div class="lwf"><span><b>${esc(f.name)}</b><small>${esc(short(f.desc))}</small></span></div>`).join('') ||
        '<p class="hint">No new class features at this level.</p>') +
      (asi
        ? `<div class="lwf"><span><b>Ability score improvement</b><small>Raise a score or take a feat.</small></span><button class="alt" data-a="lwasi">Choose</button></div>`
        : '<p class="hint">No ability score improvement at this level.</p>') +
      `</section><div class="lwfoot"><button class="lwfull" data-a="lwok">Confirm level ${n}</button></div></div>`;
  }

  const baseDraw = draw;
  draw = function () {
    baseDraw();
    paint();
  };
})();
