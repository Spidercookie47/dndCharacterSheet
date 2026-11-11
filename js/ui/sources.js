/* Sources: choose which content packs are active, add homebrew by link, file or pasted JSON. */
function sourcesHtml() {
  const byId = new Map(Loader.packs.map((p) => [p.id, p])),
    seen = new Set(),
    row = (p) => `<div class="rw" style="cursor:default;flex-wrap:wrap;align-items:center">
    <label class="opt" style="margin:0;font-weight:600"><input class="sw" type="checkbox" data-a="srctoggle" data-id="${esc(p.id)}"${p.enabled ? ' checked' : ''}><span>${esc(p.name)}<small>${p.count} elements${p.builtin ? ' · built in' : p.url ? ' · ' + esc(p.url) : ' · added from file'}${p.fetchedAt ? ' · cached ' + new Date(p.fetchedAt).toLocaleDateString() : ''}</small></span></label>
    <span class="src" style="flex:0 0 auto">${p.builtin ? '' : (p.url ? `<button class="lnk" data-a="srcrefresh" data-id="${esc(p.id)}">Refresh</button>` : '') + `<button class="lnk" data-a="srcremove" data-id="${esc(p.id)}">Remove</button>`}</span></div>`,
    tile = (p, q) =>
      `<label class="tile${p.enabled ? ' on' : ''}" data-n="${esc(p.name.toLowerCase())}"${q && !p.name.toLowerCase().includes(q) ? ' style="display:none"' : ''}><input class="sw" type="checkbox" data-a="srctoggle" data-id="${esc(p.id)}"${p.enabled ? ' checked' : ''}><span><b>${esc(p.name)}</b><small>${p.count} elements</small></span>${p.url ? `<button type="button" class="lnk" data-a="srcrefresh" data-id="${esc(p.id)}" title="Refresh this pack">↻</button>` : ''}</label>`;
  const groups = srcGroups
    .map((g) => {
      const ps = g.ids.map((id) => byId.get(id)).filter(Boolean);
      if (!ps.length) return '';
      ps.forEach((p) => seen.add(p.id));
      const q = (srcQ[g.id] || '').toLowerCase(),
        n = ps.filter((p) => p.enabled).length;
      return `<div class="ph"><span>${esc(g.name)}</span><span class="src">${n} / ${ps.length} on</span></div>
    <div class="bar" style="margin:8px 0"><input type="text" data-gq="${esc(g.id)}" placeholder="Search ${esc(g.name)}…" value="${esc(srcQ[g.id] || '')}" style="max-width:260px"><button class="lnk" data-a="srcgall" data-g="${esc(g.id)}" data-v="1">All on</button><button class="lnk" data-a="srcgall" data-g="${esc(g.id)}" data-v="0">All off</button><button class="lnk" data-a="srcgrefresh" data-g="${esc(g.id)}">Refresh all</button><button class="lnk" data-a="srcgrm" data-g="${esc(g.id)}">Remove group</button></div>
    <div class="tiles" data-gt="${esc(g.id)}">${ps.map((p) => tile(p, q)).join('')}</div>`;
    })
    .join('');
  const rows = Loader.packs.filter((p) => !seen.has(p.id)).map(row).join('') + groups;
  const m = srcMsg
    ? `<div class="rw" style="cursor:default;border-color:${srcMsg.ok ? 'var(--ok)' : 'var(--acc)'}"><span>${esc(srcMsg.text)}</span></div>`
    : '';
  const warn = Loader.warnings.map((w) => `<p class="hint">⚠ ${esc(w)}</p>`).join('');
  const credits = Loader.packs.filter((p) => p.credit).map((p) => p.credit);
  return `<div class="ph"><span>Content sources</span><button class="lnk" data-a="srcrefall">Refresh all sources</button></div>
    <p class="hint">Everything you can pick comes from a source. Turn a source off to hide its content. Characters keep working; missing content is simply not offered.</p>${rows}${warn}${m}
    ${missingHtml()}
    <div class="ph"><span>Add a source</span></div>
    <label for="srcurl">Link to a pack or index JSON file (for example a raw.githubusercontent.com link)</label>
    <div class="bar"><input type="text" id="srcurl" placeholder="https://raw.githubusercontent.com/you/your-homebrew/main/pack.json" value="${esc(srcUrl)}" style="max-width:620px"><button data-a="srcadd">Add</button></div>
    <div class="bar" style="margin-top:10px"><label class="btn alt" style="margin:0">Add from file<input id="srcfile" type="file" accept=".json,application/json" hidden></label><button class="alt" data-a="srcpaste">Add pasted JSON</button></div>
    <label for="srcpaste">…or paste pack JSON here</label><textarea id="srcpaste" rows="5" placeholder='{ "source": { "name": "My Homebrew" }, "elements": [ ... ] }'>${esc(srcPaste)}</textarea>
    <p class="hint">Packs are cached in this browser after the first download, so they keep working offline. Use Refresh to fetch the newest version. Pack format and a template are in <code>data/homebrew/_template/</code>.</p>
    ${credits.length ? `<div class="ph"><span>Credits</span></div>${credits.map((c) => `<p class="hint">${esc(c)}</p>`).join('')}` : ''}`;
}
function srcSel() {
  const so = Loader.packs.filter((p) => p.enabled).map((p) => p.name);
  if (srcF && !so.includes(srcF)) srcF = '';
  return `<select data-sf title="Filter by source" style="width:auto;max-width:260px"><option value="">All sources</option>${so.map((n) => `<option value="${esc(n)}"${srcF === n ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
}
let _sm = null,
  _smk = '';
function srcMap() {
  const k = Loader.packs.map((p) => p.id + p.enabled).join();
  if (k !== _smk) {
    _smk = k;
    _sm = new Map();
    Loader.packs.forEach((p) =>
      ((p.json && p.json.elements) || []).forEach((e) => {
        if (!_sm.has(e.id)) _sm.set(e.id, new Set());
        _sm.get(e.id).add(p.name);
      }),
    );
  }
  return _sm;
}
const srcOk = (e) => {
  if (!srcF) return true;
  const s = srcMap().get(e.id);
  return s ? s.has(srcF) : (e.src || '') === srcF;
};
let srcUrl = '',
  srcPaste = '';
let srcGroups = (() => {
    try {
      return JSON.parse(localStorage.getItem('hs-groups')) || [];
    } catch (e) {
      return [];
    }
  })(),
  srcQ = {};
const saveGroups = () => {
  try {
    localStorage.setItem('hs-groups', JSON.stringify(srcGroups));
  } catch (e) {}
};
document.addEventListener('input', (e) => {
  const g = e.target.dataset && e.target.dataset.gq;
  if (g === undefined) return;
  srcQ[g] = e.target.value;
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('.tiles').forEach((box) => {
    if (box.dataset.gt === g) box.querySelectorAll('.tile').forEach((t) => (t.style.display = t.dataset.n.includes(q) ? '' : 'none'));
  });
});
async function sourcesAction(fn, nameHint) {
  try {
    const r = await fn();
    if (r.length > 1 && nameHint !== false) {
      const nm = ((await nameHint) || 'Collection').trim(),
        id = nm.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        ids = r.map((x) => x.pack.id),
        g = srcGroups.find((x) => x.id === id);
      if (g) g.ids = [...new Set([...g.ids, ...ids])];
      else srcGroups.push({ id, name: nm, ids });
      saveGroups();
    }
    srcMsg = {
      ok: true,
      text: !r.length
        ? 'Done.'
        : (nameHint === false ? 'Refreshed ' : 'Added ') +
          r.map((x) => x.pack.name).join(', ') +
          (r.some((x) => x.warnings.length)
            ? ' (with warnings: ' +
              r
                .flatMap((x) => x.warnings)
                .slice(0, 2)
                .join(' ') +
              ')'
            : '.'),
    };
    srcUrl = '';
    srcPaste = '';
  } catch (e) {
    srcMsg = {
      ok: false,
      text:
        (e && e.message) ||
        String(e) +
          (location.protocol === 'file:'
            ? ' (opened from a file, so links cannot be fetched; serve the folder over http or use "Add from file")'
            : ''),
    };
  }
  draw();
}

/* ---- Missing content: things a saved character uses that are not available right now ---- */
function charRefs(c) {
  const ids = new Set(),
    add = (x) => {
      if (typeof x === 'string' && x.includes(':') && !/^(skill|save):/.test(x)) ids.add(x);
    };
  [c.race, c.bg, c.cls].forEach(add);
  (c.lv || []).forEach((x) => add(x && x.c));
  Object.values(c.picks || {}).forEach((a) => Array.isArray(a) && a.forEach(add));
  Object.values(c.asi || {}).forEach((v) => v && add(v.f));
  (c.inv || []).forEach((i) => add(i && i.id));
  Object.values(c.sp || {}).forEach((v) => {
    if (Array.isArray(v)) v.forEach(add);
    else ['c', 'k', 'p'].forEach((k) => ((v && v[k]) || []).forEach(add));
  });
  return [...ids];
}
function missingHtml() {
  const where = new Map(),
    have = idx();
  Loader.packs.forEach((p) =>
    ((p.json && p.json.elements) || []).forEach((e) => {
      if (!where.has(e.id)) where.set(e.id, []);
      where.get(e.id).push(p.name);
    }),
  );
  const rows = store.chars
    .map((c) => {
      const miss = charRefs(c).filter((id) => !have[id]);
      if (!miss.length) return '';
      const list = miss
        .slice(0, 8)
        .map((id) => {
          const p = where.get(id);
          return `<li>${esc(id.replace(/^[^:]*:/, ''))} <span class="src">${esc(id.split(':')[0])} · ${p ? 'turn on ' + esc(p.join(', ')) : 'not in any added source'}</span></li>`;
        })
        .join('');
      return `<div class="rw" style="cursor:default;display:block"><b>${esc(c.name || 'Unnamed hero')}</b> <span class="src">${miss.length} missing</span><ul style="margin:6px 0 0 18px">${list}${miss.length > 8 ? '<li class="src">…and ' + (miss.length - 8) + ' more</li>' : ''}</ul></div>`;
    })
    .join('');
  return `<div class="ph"><span>Missing content</span></div>${rows || '<p class="hint">Every saved character has all the content it uses.</p>'}`;
}
