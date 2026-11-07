/* Character sheet tab: live sheet and resources. */
function sheetHTML() {
  const r = resolve(ch),
    c = calc(ch, r),
    cl = r.els.filter((e) => e.type === 'Class')[0],
    rc = r.els.find((e) => e.type === 'Race'),
    sr = r.els.find((e) => e.type === 'Sub Race');
  const feats = r.els.filter((e) => /Trait|Feature|Style|^Feat$/.test(e.type));
  return `<h2>${esc(ch.name || 'Unnamed hero')}</h2><p class="sub">Level ${ch.level} ${esc(sr?.name || rc?.name || '—')} ${esc(cl?.name || '(no class)')}${ch.bg ? ' · ' + esc(ch.bg.split(':')[1]) : ''}</p>
<div class="stats"><div class="stat"><b>${c.ac}</b><span>Armor Class</span></div><div class="stat"><b>${c.hp || '—'}</b><span>Hit Points</span></div><div class="stat"><b>${c.speed} ft</b><span>Speed</span></div><div class="stat"><b>${sg(c.pb)}</b><span>Proficiency</span></div></div>
<div class="abg">${AB.map((a) => `<div class="ab"><span>${a.toUpperCase()}</span><b>${sg(mod(c.sc[a]))}</b><span>${c.sc[a]}</span></div>`).join('')}</div>
<div class="two"><div><h3>Saving throws</h3><ul class="sk">${AB.map((a) => `<li class="${c.sv[a].p ? 'p' : ''}"><span>${AN[a]}</span><span>${sg(c.sv[a].v)}</span></li>`).join('')}</ul><p class="hint">Initiative ${sg(c.init)} · Passive Perception ${c.pp}</p></div>
<div><h3>Skills</h3><ul class="sk">${Object.entries(c.sk)
    .map(([n, s]) => `<li class="${s.p ? 'p' : ''}"><span>${n}</span><span>${sg(s.v)}</span></li>`)
    .join('')}</ul></div></div>
<h3 style="margin-top:14px">Features</h3>${feats.map((f) => `<details><summary>${esc(f.name)}</summary>${INFO[f.id] && INFO[f.id][0] === '<' ? INFO[f.id] : '<p>' + esc(f.desc) + '</p>'}</details>`).join('') || '<p class="hint">Features from your race, class and background appear here.</p>'}`;
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
      return `<div class="rw" style="cursor:default"><span>${esc(x.n)} <span class="src">${x.rest === 'S' ? 'short' : 'long'} rest${x.note ? ' · ' + esc(x.note) : ''}</span></span><span>${vis}</span><button class="lnk" data-a="res" data-k="${x.k}" data-d="1" data-m="${inf ? 0 : x.max}">Use</button><button class="lnk" data-a="res" data-k="${x.k}" data-d="-1" data-m="${inf ? 0 : x.max}">Restore</button></div>`;
    }).join('') +
    '</section>'
  );
}

function renderSheet() {
  const m = $('#main');
  m.className = 'main one';
  m.innerHTML = `<div class="left"><div class="bar"><button data-a="prev">Preview sheet</button><button data-a="pdf">Download official sheet (PDF)</button><button class="alt" data-a="save">Save character file</button></div>${resHtml()}<section class="cs" style="margin-top:14px">${sheetHTML()}</section></div>`;
}
