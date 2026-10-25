/* Application state: the character in progress, the saved collection, persistence. */
const fresh = () => ({
  id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
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
let store = { chars: [], cur: null },
  tab = 'start',
  sub = 'race',
  pv = null,
  ch = fresh();
try {
  store = JSON.parse(localStorage.getItem('aw-store')) || store;
} catch (e) {}
store.chars = store.chars || [];
if (store.cur) ch = store.chars.find((c) => c.id === store.cur) || ch;
function persist() {
  const i = store.chars.findIndex((c) => c.id === ch.id);
  i < 0 ? store.chars.push(ch) : (store.chars[i] = ch);
  store.cur = ch.id;
  try {
    localStorage.setItem('aw-store', JSON.stringify(store));
  } catch (e) {}
}
const saveFile = () =>
  dl(
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
const setF = (k, v) => {
  if (k.startsWith('d.')) ch.d[k.slice(2)] = v;
  else ch[k] = v;
};
