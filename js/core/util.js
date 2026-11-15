/* Small helpers: DOM, HTML escaping, ability modifier, money format, file download. */
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const mod = (s) => Math.floor((s - 10) / 2),
  sg = (n) => (n >= 0 ? '+' : '') + n;
const fmtP = (cp) =>
  (cp = Number.isFinite(cp) ? cp : 0)
    ? cp % 100 === 0
      ? cp / 100 + ' gp'
      : cp % 10 === 0
        ? cp / 10 + ' sp'
        : cp + ' cp'
    : '—';
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

/* Cleans HTML that comes from content packs: only a short list of tags and classes survives.
   Scripts, event handlers, images, links and styles are removed. Use it before putting pack HTML on the page. */
const CLEAN_TAGS = new Set('P B I EM STRONG U BR HR UL OL LI H2 H3 H4 H5 DIV SPAN TABLE THEAD TBODY TFOOT TR TH TD SUP SUB BLOCKQUOTE SMALL CODE'.split(' ')),
  CLEAN_DROP = new Set('SCRIPT STYLE IFRAME OBJECT EMBED SVG MATH TEMPLATE LINK META NOSCRIPT FORM TEXTAREA SELECT BUTTON INPUT AUDIO VIDEO IMG CANVAS'.split(' ')),
  CLEAN_CLASS = new Set(['tw', 'tb', 'tm', 'kv', 'hint', 'src']);
function clean(html) {
  const t = document.createElement('template'); // a template is inert: nothing runs or loads while we parse
  t.innerHTML = String(html == null ? '' : html);
  const walk = (n) => {
    for (const c of [...n.childNodes]) {
      if (c.nodeType === 3) continue;
      if (c.nodeType !== 1 || CLEAN_DROP.has(c.tagName.toUpperCase())) {
        c.remove();
        continue;
      }
      walk(c);
      if (!CLEAN_TAGS.has(c.tagName)) {
        c.replaceWith(...c.childNodes); // unknown tag: keep its text, drop the tag
        continue;
      }
      for (const a of [...c.attributes]) {
        const k = a.name.toLowerCase();
        if (k === 'class') {
          const v = a.value.split(/\s+/).filter((x) => CLEAN_CLASS.has(x)).join(' ');
          v ? c.setAttribute('class', v) : c.removeAttribute('class');
        } else if (!((k === 'colspan' || k === 'rowspan') && /^\d{1,2}$/.test(a.value))) c.removeAttribute(a.name);
      }
    }
  };
  walk(t.content);
  return t.innerHTML;
}
/* Portrait and symbol images are stored as data URLs; anything else is refused. */
const imgSrc = (u) => (/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+\/=]+$/.test(u || '') ? u : '');
