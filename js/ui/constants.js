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

/* Weapon Mastery properties (SRD 5.2). Each weapon's desc names one: "Mastery: Topple." */
const MASTERY = {
  Cleave: "When you hit a creature with a melee attack using this weapon, you can make a melee attack against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon's damage, but don't add your ability modifier unless it is negative. Once per turn.",
  Graze: "If your attack roll with this weapon misses a creature, you can still deal damage to it equal to the ability modifier you used for the attack. The damage is the weapon's type, and can only be increased by raising that modifier.",
  Nick: 'When you make the extra attack of the Light property, you can make it as part of the Attack action instead of as a Bonus Action. Once per turn.',
  Push: 'If you hit a creature with this weapon, you can push it up to 10 feet straight away from you if it is Large or smaller.',
  Sap: 'If you hit a creature with this weapon, it has Disadvantage on its next attack roll before the start of your next turn.',
  Slow: "If you hit a creature with this weapon and deal damage, you can reduce its Speed by 10 feet until the start of your next turn. Multiple hits don't stack beyond 10 feet.",
  Topple: 'If you hit a creature with this weapon, you can force it to make a Constitution saving throw (DC 8 + the ability modifier you used for the attack + your Proficiency Bonus). On a failure, it has the Prone condition.',
  Vex: 'If you hit a creature with this weapon and deal damage, you have Advantage on your next attack roll against that creature before the end of your next turn.',
};
