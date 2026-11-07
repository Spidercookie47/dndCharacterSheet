/* Rule constants: ability names, skills, coin values, proficiency labels. */
const AB = ['str', 'dex', 'con', 'int', 'wis', 'cha'],
  AN = {
    str: 'Strength',
    dex: 'Dexterity',
    con: 'Constitution',
    int: 'Intelligence',
    wis: 'Wisdom',
    cha: 'Charisma',
  };
const SK = {
  Acrobatics: 'dex',
  'Animal Handling': 'wis',
  Arcana: 'int',
  Athletics: 'str',
  Deception: 'cha',
  History: 'int',
  Insight: 'wis',
  Intimidation: 'cha',
  Investigation: 'int',
  Medicine: 'wis',
  Nature: 'int',
  Perception: 'wis',
  Performance: 'cha',
  Persuasion: 'cha',
  Religion: 'int',
  'Sleight of Hand': 'dex',
  Stealth: 'dex',
  Survival: 'wis',
};
const CPV = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };
const PFN = { a: 'Armor', w: 'Weapons', t: 'Tools' };
