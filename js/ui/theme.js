/* Theme options: change any color with a hex color picker. Saved per system in this browser.
   Needs events.js (on) and shell.js (chrome() calls themeApply() at its end). */
const THEME_KEYS = [
  ['bg', 'Background'],
  ['bar', 'Top bar'],
  ['sub', 'Sub bar'],
  ['panel', 'Panels and cards'],
  ['head', 'Headers and soft buttons'],
  ['ink', 'Text'],
  ['mut', 'Muted text'],
  ['line', 'Lines and borders'],
  ['acc', 'Accent (title, highlights)'],
  ['sel', 'Selected row'],
  ['btn', 'Buttons'],
  ['ok', 'Chosen items'],
];
const THEME_PRESETS = {
 "Blood moon (default)": {
  "bg": "#1a1114",
  "bar": "#251d20",
  "sub": "#20171a",
  "panel": "#292023",
  "head": "#383033",
  "ink": "#efe4dc",
  "mut": "#9e9490",
  "line": "#433c3e",
  "acc": "#d68a6b",
  "ok": "#82c9a2",
  "sel": "#30282a",
  "btn": "#8e2a3a"
 },
 "Dragon's hoard": {
  "bg": "#10141f",
  "bar": "#171c2b",
  "sub": "#131826",
  "panel": "#181e2e",
  "head": "#222a3f",
  "ink": "#e6e9f2",
  "mut": "#96a0b8",
  "line": "#2a3350",
  "acc": "#e8b04a",
  "ok": "#7fc4a0",
  "sel": "#1f2740",
  "btn": "#b5402f"
 },
 "Arcane": {
  "bg": "#16121f",
  "bar": "#1e1930",
  "sub": "#1a1527",
  "panel": "#1f1a2e",
  "head": "#2b2340",
  "ink": "#ece8f5",
  "mut": "#a499bd",
  "line": "#352d4d",
  "acc": "#e0b050",
  "ok": "#7fd0aa",
  "sel": "#281f3d",
  "btn": "#6b4fc4"
 },
 "Tavern": {
  "bg": "#1b1612",
  "bar": "#241d17",
  "sub": "#201a14",
  "panel": "#251e18",
  "head": "#322920",
  "ink": "#eadfc8",
  "mut": "#a8997f",
  "line": "#3a3026",
  "acc": "#d4893a",
  "ok": "#8fbf8a",
  "sel": "#2d241c",
  "btn": "#9c3a2b"
 },
 "Druid": {
  "bg": "#121a16",
  "bar": "#19231d",
  "sub": "#151e19",
  "panel": "#1a241e",
  "head": "#243229",
  "ink": "#dfe6d6",
  "mut": "#8fa595",
  "line": "#2b3b30",
  "acc": "#c9a54e",
  "ok": "#8fd0a0",
  "sel": "#1f2c24",
  "btn": "#3f7a55"
 },
 "Frostpeak": {
  "bg": "#111820",
  "bar": "#1d242b",
  "sub": "#171e26",
  "panel": "#20272e",
  "head": "#30363d",
  "ink": "#e4eef5",
  "mut": "#949da4",
  "line": "#3c4248",
  "acc": "#7fc4e0",
  "ok": "#82c9a2",
  "sel": "#282e35",
  "btn": "#2f6f9c"
 },
 "Emberforge": {
  "bg": "#181412",
  "bar": "#24201e",
  "sub": "#1e1a18",
  "panel": "#272321",
  "head": "#363331",
  "ink": "#e9e2da",
  "mut": "#9a948e",
  "line": "#423e3d",
  "acc": "#d9733b",
  "ok": "#82c9a2",
  "sel": "#2e2a29",
  "btn": "#a8471f"
 },
 "Shadowfell": {
  "bg": "#0f0e16",
  "bar": "#1b1a22",
  "sub": "#15141c",
  "panel": "#1f1e25",
  "head": "#2e2d34",
  "ink": "#dcdce8",
  "mut": "#8e8e98",
  "line": "#3a3940",
  "acc": "#5fc2b8",
  "ok": "#82c9a2",
  "sel": "#26252c",
  "btn": "#58449e"
 },
 "Feywild": {
  "bg": "#0f1b1c",
  "bar": "#1b2627",
  "sub": "#152122",
  "panel": "#1f2a2b",
  "head": "#2e393a",
  "ink": "#e0f0ea",
  "mut": "#919f9c",
  "line": "#3a4445",
  "acc": "#e58fb0",
  "ok": "#82c9a2",
  "sel": "#263132",
  "btn": "#2f8a84"
 }
};
let themeSaved = {};
try {
  themeSaved = JSON.parse(localStorage.getItem('hs-theme')) || {};
} catch (e) {}
const themeStore = () => {
  try {
    localStorage.setItem('hs-theme', JSON.stringify(themeSaved));
  } catch (e) {}
};
const themeHex = (v) => {
  v = String(v || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) return ('#' + [...v.slice(1)].map((c) => c + c).join('')).toLowerCase();
  return '#000000';
};
const themeCur = (k) => themeHex(getComputedStyle(document.documentElement).getPropertyValue('--' + k));

/* Called at the end of chrome(): re-applies the saved colors and puts the Theme button in the top bar. */
function themeApply() {
  const root = document.documentElement,
    c = themeSaved[system] || {};
  THEME_KEYS.forEach(([k]) => root.style.removeProperty('--' + k));
  Object.entries(c).forEach(([k, v]) => root.style.setProperty('--' + k, v));
  if (!$('#themeBtn'))
    $('#top').insertAdjacentHTML(
      'beforeend',
      '<button class="lnk" id="themeBtn" data-a="themeopen" style="align-self:center;margin-bottom:6px">Theme</button>',
    );
}

function themePanel() {
  let el = $('#thm');
  if (!el) {
    document.body.insertAdjacentHTML('beforeend', '<div class="dr" id="thm" hidden></div>');
    el = $('#thm');
  }
  const saved = themeSaved[system] || {};
  el.innerHTML =
    '<div class="dh"><b>THEME</b><button class="lnk" data-a="themeclose">✕</button></div>' +
    '<p class="hint">Pick any color. Changes are saved in this browser and apply to the current system.</p>' +
    '<label>Start from a preset<select id="thmPre"><option value="">Choose a preset…</option>' +
    Object.keys(THEME_PRESETS).map((n) => `<option>${esc(n)}</option>`).join('') +
    '</select></label>' +
    '<div class="ph"><span>Colors</span></div>' +
    THEME_KEYS.map(([k, n]) => {
      const v = themeCur(k);
      return `<div class="thr"><span>${esc(n)}</span><input type="color" data-tk="${k}" value="${v}"><input type="text" data-th="${k}" value="${v}" maxlength="7" spellcheck="false">${saved[k] ? `<button class="lnk" data-a="themerow" data-k="${k}" title="Back to the default">↺</button>` : ''}</div>`;
    }).join('') +
    '<div class="bar" style="margin-top:14px"><button class="alt" data-a="themereset">Reset all to default</button></div>';
}

function themeSet(k, v, fromPicker) {
  (themeSaved[system] = themeSaved[system] || {})[k] = v;
  themeStore();
  document.documentElement.style.setProperty('--' + k, v);
  const t = document.querySelector(`[data-th="${k}"]`),
    p = document.querySelector(`[data-tk="${k}"]`);
  if (fromPicker && t) t.value = v;
  if (!fromPicker && p) p.value = v;
}

on('themeopen', () => {
  const el = $('#thm');
  if (el && !el.hidden) {
    el.hidden = true;
    return false;
  }
  themePanel();
  $('#thm').hidden = false;
  return false;
});
on('themeclose', () => {
  $('#thm').hidden = true;
  return false;
});
on('themereset', () => {
  delete themeSaved[system];
  themeStore();
  themeApply();
  themePanel();
  return false;
});
on('themerow', (d) => {
  if (themeSaved[system]) delete themeSaved[system][d.k];
  themeStore();
  themeApply();
  themePanel();
  return false;
});

document.addEventListener('input', (e) => {
  const t = e.target,
    d = t.dataset;
  if (d && d.tk) themeSet(d.tk, t.value.toLowerCase(), true);
  else if (d && d.th) {
    const v = t.value.trim(),
      hex = v[0] === '#' ? v : '#' + v;
    if (/^#[0-9a-f]{6}$/i.test(hex)) themeSet(d.th, hex.toLowerCase(), false);
  }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'thmPre' && t.value && THEME_PRESETS[t.value]) {
    themeSaved[system] = { ...THEME_PRESETS[t.value] };
    themeStore();
    themeApply();
    themePanel();
  } else if (t.dataset && t.dataset.th) themePanel(); // a typed value is accepted: refresh the reset arrows
  else if (t.dataset && t.dataset.tk) themePanel();
});

const themeStyle = document.createElement('style');
themeStyle.textContent =
  '.thr{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--line)}.thr>span{flex:1}.thr input[type=color]{width:42px;height:30px;padding:0;border:1px solid var(--line);border-radius:8px;background:none;cursor:pointer}.thr input[type=text]{width:92px;max-width:92px;font-family:monospace}.thr .lnk{padding:2px 8px}';
document.head.appendChild(themeStyle);
