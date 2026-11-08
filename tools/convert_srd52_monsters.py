#!/usr/bin/env python3
"""Builds monsters.json for the SRD 5.2 pack from the 5e-bits/5e-database project (src/2024/en).
Usage: python3 tools/convert_srd52_monsters.py [out_dir] [source_file]
 - out_dir:     where monsters.json is written (default data/5e/srd52)
 - source_file: a local copy of 5e-SRD-Monsters.json (downloaded automatically if missing)
Then add "monsters.json" to the "files" list in data/5e/srd52/index.json.
SRD 5.2.1 (c) Wizards of the Coast LLC, CC-BY-4.0. 5e-database structure is MIT licensed."""
import json, os, re, sys, urllib.request

OUT = sys.argv[1] if len(sys.argv) > 1 else 'data/5e/srd52'
SRC = sys.argv[2] if len(sys.argv) > 2 else '5e-SRD-Monsters.json'
URL = 'https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2024/en/5e-SRD-Monsters.json'
SUF = ' (5.2)'  # every 5.2 id ends with this, so 5.1 and 5.2 content can be loaded together
if not os.path.exists(SRC):
    urllib.request.urlretrieve(URL, SRC)
data = json.load(open(SRC, encoding='utf-8'))

AB = ['str', 'dex', 'con', 'int', 'wis', 'cha']
SKILLS = ['Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History', 'Insight', 'Intimidation',
          'Investigation', 'Medicine', 'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
          'Sleight of Hand', 'Stealth', 'Survival']
DIE = {'Tiny': 4, 'Small': 6, 'Medium': 8, 'Large': 10, 'Huge': 12, 'Gargantuan': 20}
mod = lambda s: (s - 10) // 2
ft = lambda v: int(re.sub(r'\D', '', str(v)) or 0)

def cr_txt(c):
    return {0.125: '1/8', 0.25: '1/4', 0.5: '1/2'}.get(c, str(int(c)) if float(c).is_integer() else str(c))

def pb_of(cr):
    n = {'1/8': .125, '1/4': .25, '1/2': .5}.get(cr, None)
    n = n if n is not None else float(cr)
    return 2 if n < 5 else 2 + -(-(n - 4) // 4)

LEADS = re.compile(r'(?<![\w*])((?:Melee or Ranged|Melee|Ranged) Attack Roll|(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) Saving Throw|Hit or Miss|Failure or Success|Hit|Failure|Success):')
def rich(t):
    return LEADS.sub(r'*\1:*', (t or '').replace('\r', '').strip())

def usage(u):
    if not u: return ''
    t = u.get('type')
    if t == 'per day':
        s = '%d/Day' % u['times']
        if u.get('times_in_lair'): s += ', or %d/Day in Lair' % u['times_in_lair']
        return ' (' + s + ')'
    if t == 'recharge on roll':
        m = u.get('min_value', 6)
        return ' (Recharge %s)' % (str(m) if m == 6 else '%d\u20136' % m)
    if t == 'recharge after rest':
        r = u.get('rest_types') or ['short', 'long']
        return ' (Recharge after a %s Rest)' % ' or '.join(x.capitalize() for x in r)
    return ''

def feats(lst):
    return [{'n': a['name'] + usage(a.get('usage')), 'd': rich(a.get('desc'))} for a in (lst or [])]

def names(lst):
    return ', '.join((x['name'] if isinstance(x, dict) else str(x)).lower() for x in (lst or []))

out, mism = [], 0
for m in sorted(data, key=lambda x: x['name']):
    size0 = m['size']
    size = size0 if size0 in DIE else size0.split()[0].capitalize()  # "Medium or small" -> Medium
    typ, tags = m['type'], ''
    if typ.startswith('swarm of'):
        tags = typ[:1].upper() + typ[1:].replace(' tiny ', ' Tiny ')
        typ = typ.split()[-1].rstrip('s') if typ.endswith('beasts') else typ.split()[-1]
        typ = 'beast' if typ == 'beast' else typ
    cr = cr_txt(m['challenge_rating'])
    pb = pb_of(cr)
    ab = dict(zip(AB, [m['strength'], m['dexterity'], m['constitution'], m['intelligence'], m['wisdom'], m['charisma']]))
    saves, skills = {}, {}
    for p in m.get('proficiencies') or []:
        n, v = p['proficiency']['name'], p['value']
        if n.startswith('Saving Throw: '):
            saves[n[14:].lower()] = True
        elif n.startswith('Skill: ') and n[7:] in SKILLS:
            sk = n[7:]
            a = {'Acrobatics': 'dex', 'Animal Handling': 'wis', 'Arcana': 'int', 'Athletics': 'str', 'Deception': 'cha',
                 'History': 'int', 'Insight': 'wis', 'Intimidation': 'cha', 'Investigation': 'int', 'Medicine': 'wis',
                 'Nature': 'int', 'Perception': 'wis', 'Performance': 'cha', 'Persuasion': 'cha', 'Religion': 'int',
                 'Sleight of Hand': 'dex', 'Stealth': 'dex', 'Survival': 'wis'}[sk]
            skills[sk] = 2 if round((v - mod(ab[a])) / pb) >= 2 else 1
    n = int(m['hit_dice'].split('d')[0])
    auto_hp = max(1, (n * (DIE.get(size, 8) + 1)) // 2 + n * mod(ab['con']))
    hp_auto = auto_hp == m['hit_points']
    mism += not hp_auto
    ac = m['armor_class'][0]
    ac_note = ', '.join(a['name'].lower() for a in ac.get('armor') or [])
    spd = {k: ft(v) for k, v in m['speed'].items() if k != 'hover'}
    stat = {
        'size': size, 'type': typ, 'align': m['alignment'], 'cr': cr, 'ab': ab, 'ac': ac['value'],
        'hdn': n, 'spd': {k: spd[k] for k in ('walk', 'burrow', 'climb', 'fly', 'swim') if k in spd}, 'hpAuto': hp_auto,
    }
    if tags: stat['tags'] = tags
    if ac_note: stat['acNote'] = ac_note
    if not hp_auto: stat['hp'] = m['hit_points']
    if m['speed'].get('hover'): stat['hover'] = True
    if saves: stat['saves'] = saves
    if skills: stat['skills'] = skills
    if m['damage_vulnerabilities']: stat['vuln'] = names(m['damage_vulnerabilities'])
    if m['damage_resistances']: stat['res'] = names(m['damage_resistances'])
    if m['damage_immunities']: stat['imm'] = names(m['damage_immunities'])
    if m['condition_immunities']: stat['cimm'] = names(m['condition_immunities'])
    sen = {k: ft(m['senses'][k]) for k in ('darkvision', 'blindsight', 'tremorsense', 'truesight') if k in m['senses']}
    if sen: stat['sen'] = sen
    if m.get('languages') and m['languages'] != '-': stat['langs'] = m['languages']
    for key, src in (('traits', 'special_abilities'), ('actions', 'actions'), ('bonus', 'bonus_actions'),
                     ('reactions', 'reactions'), ('leg', 'legendary_actions')):
        v = feats(m.get(src))
        if v: stat[key] = v
    if stat.get('leg'): stat['legN'] = 3
    if not stat.get('actions'): stat['actions'] = []
    head = '%s %s%s, %s. Challenge %s.' % (size0, m['type'] if not tags else tags.lower(), ' (%s)' % tags if False else '', m['alignment'], cr)
    out.append({'id': 'Monster:' + m['name'] + SUF, 'type': 'Monster', 'name': m['name'], 'desc': head, 'stat': stat})

os.makedirs(OUT, exist_ok=True)
json.dump({'elements': out}, open(os.path.join(OUT, 'monsters.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('wrote', len(out), 'monsters to', os.path.join(OUT, 'monsters.json'), '(%d with a fixed HP value)' % mism)
