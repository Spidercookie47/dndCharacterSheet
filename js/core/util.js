/* Small helpers: DOM, HTML escaping, ability modifier, money format, file download. */
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const mod = (s) => Math.floor((s - 10) / 2),
  sg = (n) => (n >= 0 ? '+' : '') + n;
const fmtP = (cp) =>
  cp ? (cp % 100 === 0 ? cp / 100 + ' gp' : cp % 10 === 0 ? cp / 10 + ' sp' : cp + ' cp') : '—';
const fname = () => (ch.name || 'Character').replace(/[^\w\- ]+/g, '').trim() || 'Character';
async function dl(name, data, type) {
  const b = new Blob([data], { type }),
    d = window.claude ? await window.claude.use('downloads') : null;
  try {
    if (d) await d.save({ filename: name, data: b });
    else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = name;
      a.click();
    }
  } catch (e) {
    if (!e || e.code !== 'declined') note('Could not save the file: ' + ((e && e.message) || e));
  }
}
