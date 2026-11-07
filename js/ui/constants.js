/* Tab names, sub-tab lists and option lists used by the screens. */
const TABS = [
  ['start', 'Start'],
  ['build', 'Build'],
  ['magic', 'Magic'],
  ['equip', 'Equipment'],
  ['manage', 'Manage'],
  ['sheet', 'Character sheet'],
];
const SUBS = [
  ['race', 'Race'],
  ['class', 'Class'],
  ['bg', 'Background'],
  ['abil', 'Ability scores'],
  ['lang', 'Languages'],
  ['prof', 'Proficiencies'],
  ['asi', 'Feats & improvements'],
];
const ROOT = {
  race: ['Race', 'race', 'Race'],
  class: ['Class', 'cls', 'Class'],
  bg: ['Background', 'bg', 'Background'],
};
const KIND = {
  race: ['Sub Race', 'Draconic Ancestry', 'Ability Increase', 'Spell'],
  class: [
    'Fighting Style',
    'Divine Domain',
    'Subclass',
    'Metamagic',
    'Invocation',
    'Pact Boon',
    'Favored Enemy',
    'Favored Terrain',
    'Land Type',
    'Dragon Ancestor',
  ],
  lang: ['Language'],
  prof: ['Skill', 'Tool', 'Gear'],
};
const ALIGN = [
  'Lawful Good',
  'Neutral Good',
  'Chaotic Good',
  'Lawful Neutral',
  'Neutral',
  'Chaotic Neutral',
  'Lawful Evil',
  'Neutral Evil',
  'Chaotic Evil',
];
const ECATS = [
  'Adventuring Gear',
  'Equipment Packs',
  'Tools',
  'Musical Instruments',
  'Armor',
  'Weapons',
  'Ammunition',
  'Spellcasting Focus',
  'Mounts and Vehicles',
  'Magic Armor',
  'Magic Weapons',
  'Wondrous Items',
  'Rings',
  'Rods',
  'Staffs',
  'Wands',
  'Potions',
  'Scrolls',
  'Magic Ammunition',
];
const ESUB = [
  ['shop', 'Equipment'],
  ['inv', 'Inventory'],
  ['start', 'Starting equipment'],
  ['treasure', 'Additional treasure & quest items'],
];
const CHL = [
  ['traits', 'Personality traits', 'traits'],
  ['ideal', 'Ideal', 'ideals'],
  ['bond', 'Bond', 'bonds'],
  ['flaw', 'Flaw', 'flaws'],
];

const MSUB = [
  ['char', 'Character'],
  ['story', 'Backstory'],
  ['notes', 'Notes'],
  ['allies', 'Allies & organizations'],
  ['atk', 'Attacks & spellcasting'],
];
const STARTSUB = [
  ['chars', 'Character collection'],
  ['sources', 'Sources'],
];
const SYSTEMS = [['dnd5e', 'D&D 5e'], ['coc', 'Call of Cthulhu']];
const DMTABS = [['dm', 'DM screen']];

/* Monster maker (DM mode): its own tabs. The editor itself is in monster.js. */
const MTABS = [
  ['start', 'Start'],
  ['mref', 'Reference'],
  ['mbuild', 'Build'],
  ['mblock', 'Stat block'],
];
const MSUBS = [
  ['basic', 'Basics'],
  ['abil', 'Ability scores'],
  ['def', 'Defenses'],
  ['sense', 'Senses & languages'],
  ['traits', 'Traits'],
  ['actions', 'Actions'],
  ['leg', 'Legendary'],
];
const MRSUBS = [
  ['blocks', 'Stat blocks'],
  ['feat', 'Features'],
];
const STARTSUB_DM = [
  ['chars', 'Characters'],
  ['mons', 'Monsters'],
  ['sources', 'Sources'],
];
const MACTS =
  '<button class="lnk" data-a="msave">Save</button><button class="lnk" data-a="mpdf">Stat block PDF</button>';

