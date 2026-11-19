/* Application state: the character in progress, the saved collection, persistence. */
const fresh = (dm) => ({
  id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
  dm: !!dm, // true = built in DM mode (scores up to 30, + button for extras)
  name: '',
  level: 1,
  race: '',
  cls: '',
  bg: '',
  ab: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  method: 'array',
  picks: {},
  armor: 'none',
  shield: false,
  d: {},
});
/* ---- Safe storage -------------------------------------------------------------------------------
   Every part of the app saves through writeStore(). It reports failures instead of hiding them, skips
   writes that change nothing, keeps a backup copy, and follows changes made in another window. */
const STORE_KEY = 'aw-store',
  STORE_BAK = 'aw-store-bak';
let storeRecovered = false, // true when the main copy was unreadable and the backup was used
  saveFailed = false,
  adopting = false, // true while this window redraws after another window saved
  lastRaw = '', // the text last read from or written to storage
  askedPersist = false;

/* Reads the store. If the main copy is damaged the backup is used, and the damaged text is kept under
   'aw-store-corrupt' so it can still be recovered by hand. */
function loadStore() {
  for (const k of [STORE_KEY, STORE_BAK]) {
    let raw = null;
    try {
      raw = localStorage.getItem(k);
      const s = raw && JSON.parse(raw);
      if (s && typeof s === 'object' && !Array.isArray(s)) {
        if (k === STORE_KEY) {
          lastRaw = raw;
          try {
            localStorage.setItem(STORE_BAK, raw); // one backup copy per session
          } catch (e) {}
        } else storeRecovered = true;
        return s;
      }
    } catch (e) {}
    if (k === STORE_KEY && raw) {
      try {
        localStorage.setItem('aw-store-corrupt', raw);
      } catch (e) {}
    }
  }
  return null;
}

/* Asks the browser not to delete this site's data when space runs low. Chrome and Brave usually say yes to
   an installed app without asking. */
function askPersist() {
  askedPersist = true;
  try {
    if (navigator.storage && navigator.storage.persisted)
      navigator.storage
        .persisted()
        .then((p) => (p ? null : navigator.storage.persist()))
        .catch(() => {});
  } catch (e) {}
}

function writeStore() {
  if (adopting) return true; // we are only showing what another window saved
  let raw;
  try {
    raw = JSON.stringify(store);
  } catch (e) {
    return false;
  }
  if (raw === lastRaw) return true; // nothing changed
  try {
    localStorage.setItem(STORE_KEY, raw);
    lastRaw = raw;
    saveFailed = false;
    if (!askedPersist && store.chars && store.chars.length) askPersist();
    return true;
  } catch (e) {
    if (!saveFailed && typeof note === 'function') {
      note('Could not save to this browser (storage is full or blocked). Use Save to download a copy of your character.');
    }
    saveFailed = true;
    return false;
  }
}

let store = { chars: [], cur: null },
  tab = 'start',
  sub = 'race',
  pv = null,
  ch = fresh();
store = loadStore() || store;
store.chars = store.chars || [];
if (store.cur) ch = store.chars.find((c) => c.id === store.cur) || ch;
if (ch.dm) ch = fresh(); // the app opens in player mode
function persist() {
  const i = store.chars.findIndex((c) => c.id === ch.id);
  i < 0 ? store.chars.push(ch) : (store.chars[i] = ch);
  store.cur = ch.id;
  if (typeof Sync !== 'undefined' && Sync.touch) Sync.touch(ch); // stamp `updated` and debounce a Drive upload
  writeStore();
}
const saveFile = () => {
  try {
    localStorage.setItem('hs-lastsave', String(Date.now())); // shown on the phone Home backup card
  } catch (e) {}
  return dl(
    fname() + '.hearth.json',
    JSON.stringify(
      {
        format: 'hearthscribe-character',
        version: 1,
        app: 'Hearthscribe',
        savedAt: new Date().toISOString(),
        character: ch,
      },
      null,
      2,
    ),
    'application/json',
  );
};
const setF = (k, v) => {
  if (k.startsWith('d.')) ch.d[k.slice(2)] = v;
  else ch[k] = v;
};

/* Another window (the browser tab and the installed app share storage) saved something: take its data
   instead of overwriting it with our older copy. */
window.addEventListener('storage', (e) => {
  if (e.key !== STORE_KEY || !e.newValue || e.newValue === lastRaw) return;
  let s;
  try {
    s = JSON.parse(e.newValue);
  } catch (err) {
    return;
  }
  if (!s || typeof s !== 'object' || Array.isArray(s)) return;
  lastRaw = e.newValue;
  const cur = ch && ch.id;
  store = s;
  store.chars = store.chars || [];
  const same = store.chars.find((c) => c.id === cur);
  if (same) ch = same;
  const a = document.activeElement,
    typing = !!a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && /text|number|search/.test(a.type)));
  if (!typing && typeof draw === 'function') {
    adopting = true;
    try {
      draw();
    } finally {
      adopting = false;
    }
  }
});
if (storeRecovered)
  window.addEventListener('load', () =>
    setTimeout(() => {
      if (typeof note === 'function')
        note('Your saved data could not be read, so the last backup was restored. Please check your characters.');
    }, 1200),
  );
