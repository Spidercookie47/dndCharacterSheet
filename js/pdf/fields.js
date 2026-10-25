/* Official character sheet: maps character data to the PDF form fields and fills them with pdf-lib. */
(function (g) {
  const sg = (n) => (n >= 0 ? '+' : '') + n;
  const AB = ['str', 'dex', 'con', 'int', 'wis', 'cha'],
    AF = {
      str: ['STR', 'STRmod'],
      dex: ['DEX', 'DEXmod '],
      con: ['CON', 'CONmod'],
      int: ['INT', 'INTmod'],
      wis: ['WIS', 'WISmod'],
      cha: ['CHA', 'CHamod'],
    };
  const AN = {
    str: 'Strength',
    dex: 'Dexterity',
    con: 'Constitution',
    int: 'Intelligence',
    wis: 'Wisdom',
    cha: 'Charisma',
  };
  const SKF = {
    Acrobatics: 'Acrobatics',
    'Animal Handling': 'Animal',
    Arcana: 'Arcana',
    Athletics: 'Athletics',
    Deception: 'Deception ',
    History: 'History ',
    Insight: 'Insight',
    Intimidation: 'Intimidation',
    Investigation: 'Investigation ',
    Medicine: 'Medicine',
    Nature: 'Nature',
    Perception: 'Perception ',
    Performance: 'Performance',
    Persuasion: 'Persuasion',
    Religion: 'Religion',
    'Sleight of Hand': 'SleightofHand',
    Stealth: 'Stealth ',
    Survival: 'Survival',
  };
  g.buildFields = (m) => {
    const t = {},
      size = {},
      ck = [];
    t['CharacterName'] = t['CharacterName 2'] = m.name;
    t.ClassLevel = m.classLevel;
    t.Background = m.bg;
    t['Race '] = m.race;
    AB.forEach((a, i) => {
      t[AF[a][0]] = sg(m.mods[a]);
      t[AF[a][1]] = String(m.scores[a]);
      t['ST ' + AN[a]] = sg(m.saves[a].v);
      if (m.saves[a].p) ck.push(i ? 'Check Box ' + (17 + i) : 'Check Box 11');
    });
    Object.keys(SKF).forEach((s, i) => {
      t[SKF[s]] = sg(m.skills[s].v);
      if (m.skills[s].p) ck.push('Check Box ' + (23 + i));
    });
    t.ProfBonus = sg(m.pb);
    t.AC = String(m.ac);
    t.Initiative = sg(m.init);
    t.Speed = String(m.speed);
    t.HPMax = String(m.hp);
    t.HPCurrent = String(m.hp);
    if (m.hdt) {
      t.HDTotal = m.hdt;
      t.HD = m.hdt;
    }
    t.Passive = String(m.pp);
    Object.assign(t, m.extra || {});
    [
      'PersonalityTraits ',
      'Ideals',
      'Bonds',
      'Flaws',
      'Backstory',
      'Allies',
      'Feat+Traits',
      'AttacksSpellcasting',
    ].forEach((k) => (size[k] = 8));
    if (m.prof) {
      t.ProficienciesLang = m.prof;
      size.ProficienciesLang = 9;
    }
    t['Features and Traits'] = m.features;
    size['Features and Traits'] = 7;
    t.Equipment = m.equipment;
    size.Equipment = 9;
    if (m.caster) {
      t['Spellcasting Class 2'] = m.caster.cls;
      t['SpellcastingAbility 2'] = m.caster.ab;
      t['SpellSaveDC  2'] = String(m.caster.dc);
      t['SpellAtkBonus 2'] = sg(m.caster.atk);
    }
    (m.xchecks || []).forEach((n) => ck.push(n));
    return { text: t, size, checks: ck, images: m.images };
  };
  g.fillSheet = async (L, bytes, d) => {
    const doc = await L.PDFDocument.load(bytes),
      f = doc.getForm(),
      H = await doc.embedFont(L.StandardFonts.Helvetica);
    const t = (n, v, s) => {
      let x;
      try {
        x = f.getTextField(n);
      } catch (e) {
        return;
      }
      try {
        x.setText(String(v));
      } catch (e) {
        x.setText(
          String(v)
            .normalize('NFD')
            .replace(/[^\x20-\x7e\n]/g, ''),
        );
      }
      if (s) {
        try {
          x.setFontSize(s);
        } catch (e) {
          x.acroField.setDefaultAppearance('/Helv ' + s + ' Tf 0 g');
        }
      }
    };
    for (const n in d.text) if (d.text[n] !== '' && d.text[n] != null) t(n, d.text[n], d.size[n]);
    d.checks.forEach((n) => {
      try {
        f.getCheckBox(n).check();
      } catch (e) {}
    });
    if (d.images)
      for (const [nm, u] of [
        ['CHARACTER IMAGE', d.images.portrait],
        ['Faction Symbol Image', d.images.symbol],
      ]) {
        if (!u) continue;
        try {
          const bt = Uint8Array.from(atob(u.split(',')[1]), (c) => c.charCodeAt(0)),
            im = /^data:image\/png/.test(u) ? await doc.embedPng(bt) : await doc.embedJpg(bt);
          f.getButton(nm).setImage(im);
        } catch (e) {}
      }
    f.updateFieldAppearances(H);
    return doc.save();
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
const SPF = {
  0: [
    { f: 'Spells 1014', b: null },
    { f: 'Spells 1016', b: null },
    { f: 'Spells 1017', b: null },
    { f: 'Spells 1018', b: null },
    { f: 'Spells 1019', b: null },
    { f: 'Spells 1020', b: null },
    { f: 'Spells 1021', b: null },
    { f: 'Spells 1022', b: null },
  ],
  1: [
    { f: 'Spells 1015', b: 'Check Box 251' },
    { f: 'Spells 1023', b: 'Check Box 309' },
    { f: 'Spells 1024', b: 'Check Box 3010' },
    { f: 'Spells 1025', b: 'Check Box 3011' },
    { f: 'Spells 1026', b: 'Check Box 3012' },
    { f: 'Spells 1027', b: 'Check Box 3013' },
    { f: 'Spells 1028', b: 'Check Box 3014' },
    { f: 'Spells 1029', b: 'Check Box 3015' },
    { f: 'Spells 1030', b: 'Check Box 3016' },
    { f: 'Spells 1031', b: 'Check Box 3017' },
    { f: 'Spells 1032', b: 'Check Box 3018' },
    { f: 'Spells 1033', b: 'Check Box 3019' },
  ],
  2: [
    { f: 'Spells 1046', b: 'Check Box 313' },
    { f: 'Spells 1034', b: 'Check Box 310' },
    { f: 'Spells 1035', b: 'Check Box 3020' },
    { f: 'Spells 1036', b: 'Check Box 3021' },
    { f: 'Spells 1037', b: 'Check Box 3022' },
    { f: 'Spells 1038', b: 'Check Box 3023' },
    { f: 'Spells 1039', b: 'Check Box 3024' },
    { f: 'Spells 1040', b: 'Check Box 3025' },
    { f: 'Spells 1041', b: 'Check Box 3026' },
    { f: 'Spells 1042', b: 'Check Box 3027' },
    { f: 'Spells 1043', b: 'Check Box 3028' },
    { f: 'Spells 1044', b: 'Check Box 3029' },
    { f: 'Spells 1045', b: 'Check Box 3030' },
  ],
  3: [
    { f: 'Spells 1048', b: 'Check Box 315' },
    { f: 'Spells 1047', b: 'Check Box 314' },
    { f: 'Spells 1049', b: 'Check Box 3031' },
    { f: 'Spells 1050', b: 'Check Box 3032' },
    { f: 'Spells 1051', b: 'Check Box 3033' },
    { f: 'Spells 1052', b: 'Check Box 3034' },
    { f: 'Spells 1053', b: 'Check Box 3035' },
    { f: 'Spells 1054', b: 'Check Box 3036' },
    { f: 'Spells 1055', b: 'Check Box 3037' },
    { f: 'Spells 1056', b: 'Check Box 3038' },
    { f: 'Spells 1057', b: 'Check Box 3039' },
    { f: 'Spells 1058', b: 'Check Box 3040' },
    { f: 'Spells 1059', b: 'Check Box 3041' },
  ],
  4: [
    { f: 'Spells 1061', b: 'Check Box 3011' },
    { f: 'Spells 1060', b: 'Check Box 3012' },
    { f: 'Spells 1062', b: 'Check Box 3013' },
    { f: 'Spells 1063', b: 'Check Box 3014' },
    { f: 'Spells 1064', b: 'Check Box 3015' },
    { f: 'Spells 1065', b: 'Check Box 3016' },
    { f: 'Spells 1066', b: 'Check Box 3017' },
    { f: 'Spells 1067', b: 'Check Box 3018' },
    { f: 'Spells 1068', b: 'Check Box 3019' },
    { f: 'Spells 1069', b: 'Check Box 3049' },
    { f: 'Spells 1070', b: 'Check Box 3050' },
    { f: 'Spells 1071', b: 'Check Box 3051' },
    { f: 'Spells 1072', b: 'Check Box 3052' },
  ],
  5: [
    { f: 'Spells 1074', b: 'Check Box 3022' },
    { f: 'Spells 1073', b: 'Check Box 3023' },
    { f: 'Spells 1075', b: 'Check Box 3024' },
    { f: 'Spells 1076', b: 'Check Box 3025' },
    { f: 'Spells 1077', b: 'Check Box 3026' },
    { f: 'Spells 1078', b: 'Check Box 3027' },
    { f: 'Spells 1079', b: 'Check Box 3028' },
    { f: 'Spells 1080', b: 'Check Box 3029' },
    { f: 'Spells 1081', b: 'Check Box 3030' },
  ],
  6: [
    { f: 'Spells 1083', b: 'Check Box 321' },
    { f: 'Spells 1082', b: 'Check Box 314' },
    { f: 'Spells 1084', b: 'Check Box 3031' },
    { f: 'Spells 1085', b: 'Check Box 3032' },
    { f: 'Spells 1086', b: 'Check Box 3033' },
    { f: 'Spells 1087', b: 'Check Box 3034' },
    { f: 'Spells 1088', b: 'Check Box 3035' },
    { f: 'Spells 1089', b: 'Check Box 3036' },
    { f: 'Spells 1090', b: 'Check Box 3037' },
  ],
  7: [
    { f: 'Spells 1092', b: 'Check Box 3041' },
    { f: 'Spells 1091', b: 'Check Box 251' },
    { f: 'Spells 1093', b: 'Check Box 309' },
    { f: 'Spells 1094', b: 'Check Box 3010' },
    { f: 'Spells 1095', b: 'Check Box 3011' },
    { f: 'Spells 1096', b: 'Check Box 3012' },
    { f: 'Spells 1097', b: 'Check Box 3013' },
    { f: 'Spells 1098', b: 'Check Box 3014' },
    { f: 'Spells 1099', b: 'Check Box 3015' },
  ],
  8: [
    { f: 'Spells 10101', b: 'Check Box 3019' },
    { f: 'Spells 10100', b: 'Check Box 3049' },
    { f: 'Spells 10102', b: 'Check Box 3050' },
    { f: 'Spells 10103', b: 'Check Box 3051' },
    { f: 'Spells 10104', b: 'Check Box 3052' },
    { f: 'Spells 10105', b: 'Check Box 3077' },
    { f: 'Spells 10106', b: 'Check Box 3078' },
  ],
  9: [
    { f: 'Spells 10108', b: 'Check Box 3024' },
    { f: 'Spells 10107', b: 'Check Box 3025' },
    { f: 'Spells 10109', b: 'Check Box 3026' },
    { f: 'Spells 101010', b: 'Check Box 3027' },
    { f: 'Spells 101011', b: 'Check Box 3028' },
    { f: 'Spells 101012', b: 'Check Box 3029' },
    { f: 'Spells 101013', b: 'Check Box 3030' },
  ],
};

const SLT = {
  1: 'SlotsTotal 19',
  2: 'SlotsTotal 20',
  3: 'SlotsTotal 21',
  4: 'SlotsTotal 22',
  5: 'SlotsTotal 23',
  6: 'SlotsTotal 24',
  7: 'SlotsTotal 25',
  8: 'SlotsTotal 26',
  9: 'SlotsTotal 27',
};
