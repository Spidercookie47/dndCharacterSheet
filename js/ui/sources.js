/* Sources: choose which content packs are active, add homebrew by link, file or pasted JSON. */
function sourcesHtml() {
  const rows = Loader.packs
    .map(
      (p) => `<div class="rw" style="cursor:default;flex-wrap:wrap;align-items:center">
    <label class="opt" style="margin:0;font-weight:600"><input type="checkbox" data-a="srctoggle" data-id="${esc(p.id)}"${p.enabled ? ' checked' : ''}><span>${esc(p.name)}<small>${p.count} elements${p.builtin ? ' · built in' : p.url ? ' · ' + esc(p.url) : ' · added from file'}${p.fetchedAt ? ' · cached ' + new Date(p.fetchedAt).toLocaleDateString() : ''}</small></span></label>
    <span class="src" style="flex:0 0 auto">${p.builtin ? '' : (p.url ? `<button class="lnk" data-a="srcrefresh" data-id="${esc(p.id)}">Refresh</button>` : '') + `<button class="lnk" data-a="srcremove" data-id="${esc(p.id)}">Remove</button>`}</span></div>`,
    )
    .join('');
  const m = srcMsg
    ? `<div class="rw" style="cursor:default;border-color:${srcMsg.ok ? 'var(--ok)' : 'var(--acc)'}"><span>${esc(srcMsg.text)}</span></div>`
    : '';
  const warn = Loader.warnings.map((w) => `<p class="hint">⚠ ${esc(w)}</p>`).join('');
  const credit = (Loader.packs.find((p) => p.credit) || {}).credit;
  return `<div class="ph"><span>Content sources</span></div>
    <p class="hint">Everything you can pick comes from a source. Turn a source off to hide its content. Characters keep working; missing content is simply not offered.</p>${rows}${warn}${m}
    <div class="ph"><span>Add a source</span></div>
    <label for="srcurl">Link to a pack or index JSON file (for example a raw.githubusercontent.com link)</label>
    <div class="bar"><input type="text" id="srcurl" placeholder="https://raw.githubusercontent.com/you/your-homebrew/main/pack.json" value="${esc(srcUrl)}" style="max-width:620px"><button data-a="srcadd">Add</button></div>
    <div class="bar" style="margin-top:10px"><label class="btn alt" style="margin:0">Add from file<input id="srcfile" type="file" accept=".json,application/json" hidden></label><button class="alt" data-a="srcpaste">Add pasted JSON</button></div>
    <label for="srcpaste">…or paste pack JSON here</label><textarea id="srcpaste" rows="5" placeholder='{ "source": { "name": "My Homebrew" }, "elements": [ ... ] }'>${esc(srcPaste)}</textarea>
    <p class="hint">Packs are cached in this browser after the first download, so they keep working offline. Use Refresh to fetch the newest version. Pack format and a template are in <code>data/homebrew/_template/</code>.</p>
    ${credit ? `<div class="ph"><span>Credits</span></div><p class="hint">${esc(credit)}</p>` : ''}`;
}
let srcUrl = '',
  srcPaste = '';
async function sourcesAction(fn) {
  try {
    const r = await fn();
    srcMsg = {
      ok: true,
      text: !r.length
        ? 'Done.'
        : 'Added ' +
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
