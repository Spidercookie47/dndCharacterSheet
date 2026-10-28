/* Rules registry: holds every element (race, class, spell, item...) loaded from the enabled
   content packs, plus the lookup tables derived from them. Nothing here is hard-coded SRD:
   it all comes from data/*.json (see README.md and data/homebrew/_template). */
let DB = []; // every element of every enabled pack
let INFO = {}; // long descriptions (text or HTML) keyed by element id
let _idx = null; // id -> element cache

// Lookup tables rebuilt from the elements by buildTables()
let CLX = {},
  KN = {},
  MODE = {},
  HALF = {},
  CA = {},
  LN = {}; // spellcasting, keyed by class name (LN: the spell list a class uses, usually its own name)
let PRE = {},
  SEQ = {}; // multiclass prerequisites, starting equipment (class id / name)
let DOM2 = {},
  EXP = {},
  FS = {},
  MEF = {}; // always-prepared spells, expanded lists, feature spells, magic item effects
let SEQC = {},
  TRINK = [],
  XPT = [0]; // starting-equipment categories, trinkets, XP thresholds

const idx = () => _idx || (_idx = Object.fromEntries(DB.map((e) => [e.id, e])));
const ofType = (t) => DB.filter((e) => e.type === t).sort((a, b) => a.name.localeCompare(b.name));

/* Used by older helper code that builds elements on the fly (kept for homebrew scripts). */
function T(type, name, desc, rules = [], x = {}) {
  DB.push({ id: type + ':' + name, type, name, desc, rules, ...x });
  _idx = null;
}

function buildTables(tables) {
  [CLX, KN, MODE, HALF, CA, LN, PRE, SEQ, DOM2, EXP, FS, MEF].forEach((o) =>
    Object.keys(o).forEach((k) => delete o[k]),
  );
  for (const e of DB) {
    if (e.type === 'Class') {
      if (e.casting) {
        const c = e.casting;
        CLX[e.name] = c.rows;
        CA[e.name] = c.ability;
        LN[e.name] = c.list || e.name;
        MODE[e.name] = c.mode;
        if (c.half) HALF[e.name] = 1;
        if (c.known) KN[e.name] = c.known;
      }
      if (e.prereq) PRE[e.id] = e.prereq;
      if (e.start) SEQ[e.name] = e.start;
    }
    if (e.prepared) DOM2[e.id] = Object.assign({ c: e.prepared.class }, e.prepared.levels);
    if (e.expandedList) EXP[e.id] = { c: e.expandedList.class, list: e.expandedList.spells };
    if (e.featSpells) FS[e.id] = e.featSpells;
    if (e.effect) MEF[e.id] = e.effect;
  }
  tables = tables || {};
  XPT =
    tables.xp && tables.xp.length
      ? tables.xp
      : [
          0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000,
          195000, 225000, 265000, 305000, 355000,
        ];
  TRINK = tables.trinkets || [];
  SEQC = tables.startCategories || {};
}

/* Replace the registry contents. `parts` = [{elements, info, tables, source}] in load order;
   a later element with the same id replaces an earlier one (that is how homebrew overrides SRD). */
function setRegistry(parts) {
  const map = new Map(),
    info = {},
    tables = {};
  for (const p of parts) {
    for (const e of p.elements || [])
      map.set(
        e.id,
        Object.assign({}, e, { src: (p.source && (p.source.short || p.source.name)) || 'Homebrew' }),
      );
    Object.assign(info, p.info || {});
    for (const [k, v] of Object.entries(p.tables || {})) {
      if (Array.isArray(v) && Array.isArray(tables[k])) tables[k] = tables[k].concat(v);
      else if (v && typeof v === 'object' && !Array.isArray(v)) tables[k] = Object.assign(tables[k] || {}, v);
      else tables[k] = v;
    }
  }
  DB = [...map.values()];
  INFO = info;
  _idx = null;
  buildTables(tables);
}
