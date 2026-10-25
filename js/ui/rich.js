/* Turns the plain-text or HTML descriptions in the data files into readable panels. */
function rich(t) {
  const H = ['Level', 'Features', 'Cantrips', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
  let o = '',
    tb = [];
  const fl = () => {
    if (tb.length) {
      o +=
        '<div class="tw"><table class="tb"><tr>' +
        H.map((h) => `<th>${h}</th>`).join('') +
        '</tr>' +
        tb.join('') +
        '</table></div>';
      tb = [];
    }
  };
  for (const raw of t.split('\n').slice(1)) {
    const l = raw.trim();
    if (!l || /^Level Features Cantrips/.test(l)) continue;

    // --- FIX: If the line contains ANY HTML tags, render it directly! ---
    if (/<[a-z][\s\S]*>/i.test(l)) {
      fl();
      o += l;
      continue;
    }
    // --------------------------------------------------------------------

    const tk = l.split(' ');
    if (/^\d+(st|nd|rd|th) /.test(l) && tk.length >= 12 && tk.slice(-10).every((x) => /^(\d+|—)$/.test(x))) {
      tb.push(
        '<tr><td>' +
          tk[0] +
          '</td><td>' +
          esc(tk.slice(1, -10).join(' ')) +
          '</td>' +
          tk
            .slice(-10)
            .map((x) => `<td>${x}</td>`)
            .join('') +
          '</tr>',
      );
      continue;
    }
    fl();
    if (/^[A-Z][A-Z0-9 ,:'&-]{2,}$/.test(l)) {
      o += '<h3>' + esc(l) + '</h3>';
      continue;
    }
    const kv = l.match(/^(\d+(?:st|nd|rd|th)) (.+)$/);
    if (kv && tk.length < 10) {
      o += `<div class="kv"><b>${kv[1]}</b><span>${esc(kv[2])}</span></div>`;
      continue;
    }
    const m = l.match(/^([A-Z][A-Za-z' ()]{1,34})[.:](?=[A-Z“" ])/);
    o += m
      ? `<p><b>${esc(m[1])}${m[0].slice(-1)}</b> ${esc(l.slice(m[0].length).trim())}</p>`
      : `<p>${esc(l)}</p>`;
  }
  fl();
  return o;
}
function describe(el) {
  const I = idx(),
    rl = el.rules || [];
  let h = `<h2>${esc(el.name)}</h2><p>${esc(el.desc || '')}</p>`;
  if (el.hd) h += `<p><b>Hit die:</b> d${el.hd}</p>`;
  const st = rl
    .filter((r) => r.stat)
    .map((r) =>
      Object.entries(r.stat)
        .map(([k, v]) =>
          k === 'speed'
            ? 'Speed ' + v + ' ft'
            : k === 'hpl'
              ? '+' + v + ' HP per level'
              : k === 'acArm'
                ? '+' + v + ' AC while armored'
                : AN[k] + ' +' + v,
        )
        .join(', '),
    )
    .join(', ');
  if (st) h += `<h3>Bonuses</h3><p>${esc(st)}</p>`;
  const pf = rl
    .filter((r) => /^(skill|save):/.test(r.grant || ''))
    .map((r) => (r.grant.startsWith('save:') ? AN[r.grant.slice(5)] + ' saving throw' : r.grant.slice(6)));
  if (pf.length) h += `<h3>Proficiencies</h3><p>${esc(pf.join(', '))}</p>`;
  const gr = rl.filter((r) => r.grant && I[r.grant]);
  if (gr.length)
    h +=
      '<h3>Features</h3>' +
      gr
        .map(
          (r) =>
            `<p><b>${esc(I[r.grant].name)}${r.level ? ' (level ' + r.level + ')' : ''}.</b> ${esc(I[r.grant].desc)}</p>`,
        )
        .join('');
  const ch_ = rl
    .filter((r) => r.select)
    .map((r) => r.select.name + (r.select.n > 1 ? ' ×' + r.select.n : ''));
  if (ch_.length) h += `<h3>You will choose</h3><p>${esc(ch_.join(', '))}</p>`;
  return h;
}