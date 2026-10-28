#!/usr/bin/env python3
"""Convert the SRD 5.2.1 data from the 5e-bits/5e-database project (src/2024/en) into Hearthscribe pack files.
Usage: python3 convert_srd52.py [source_dir] [out_dir] [srd51_dir]
 - source_dir: folder holding 5e-SRD-*.json (downloaded automatically if missing)
 - out_dir:    where the pack files are written (default ./srd52)
 - srd51_dir:  your data/srd folder; used to reuse magic item `effect` fields and tables.json
SRD 5.2.1 © Wizards of the Coast LLC, CC-BY-4.0. 5e-database structure is MIT licensed."""
import json, os, re, sys, urllib.request

SRC = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = sys.argv[2] if len(sys.argv) > 2 else './srd52'
OLD = sys.argv[3] if len(sys.argv) > 3 else None
BASE = 'https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2024/en/5e-SRD-%s.json'
os.makedirs(OUT, exist_ok=True)

def L(name):
    p = os.path.join(SRC, '5e-SRD-%s.json' % name)
    if not os.path.exists(p):
        urllib.request.urlretrieve(BASE % name, p)
    return json.load(open(p, encoding='utf-8'))

def clean(t):
    t = t or ''
    t = t.replace('\r', '')
    t = re.sub(r'\*\*(.+?)\*\*', r'\1', t)
    t = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'\1', t)
    t = re.sub(r' {2,}\n', '\n', t)
    t = re.sub(r'\n[ \t]+', '\n', t)
    t = re.sub(r'\n(?!\n)', '\n\n', t) if '|' not in t else t
    t = re.sub(r'\n{3,}', '\n\n', t)
    return t.strip()

def put(name, obj):
    json.dump(obj, open(os.path.join(OUT, name), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)

SKILLS = ['Acrobatics','Animal Handling','Arcana','Athletics','Deception','History','Insight','Intimidation','Investigation','Medicine','Nature','Perception','Performance','Persuasion','Religion','Sleight of Hand','Stealth','Survival']
ids_seen = {}
def el(id_, type_, name, desc, rules=None, **x):
    if id_ in ids_seen:
        raise SystemExit('duplicate id ' + id_)
    ids_seen[id_] = 1
    d = {'id': id_, 'type': type_, 'name': name, 'desc': desc, 'rules': rules or []}
    d.update(x)
    return d

# ---------------- languages ----------------
RARE = {'Druidic'}  # the source data marks Druidic as standard; the SRD language table lists it as rare
langs = L('Languages')
lang_els = [el('Language:' + l['name'], 'Language', l['name'], l['name'] + ' is a language your character can speak, read and write.' + (' (Rare language.)' if (l['is_rare'] or l['name'] in RARE) else '')) for l in langs]
standard_ids = ['Language:' + l['name'] for l in langs if not l['is_rare'] and l['name'] not in RARE and l['name'] != 'Common']
put('languages.json', {'elements': lang_els})

# ---------------- spells ----------------
spells = L('Spells')
sp_els = []
for s in spells:
    higher = s.get('higher_level')
    if isinstance(higher, list): higher = '\n\n'.join(higher)
    desc = clean(s['description'])
    if higher:
        label = 'Cantrip Upgrade.' if s['level'] == 0 else 'Using a Higher-Level Spell Slot.'
        desc += '\n\n' + label + ' ' + clean(higher)
    dur = s['duration']
    if s.get('concentration') and not dur.lower().startswith('concentration'):
        dur = 'Concentration, ' + dur
    sp_els.append(el('Spell:' + s['name'], 'Spell', s['name'], desc, [],
        lvl=s['level'], school=s['school']['name'].lower(), comp=','.join(s['components']),
        cast=s['casting_time'], range=s['range'], dur=dur, ritual=bool(s['ritual']),
        lists=sorted(c['name'] for c in s['classes']), mat=s.get('material') or ''))
put('spells.json', {'elements': sp_els})

# ---------------- equipment ----------------
eq = L('Equipment')
def cats(e): return {c['index'] for c in e.get('equipment_categories', [])}
def cp_of(e):
    c = e.get('cost')
    return int(round(c['quantity'] * {'cp': 1, 'sp': 10, 'gp': 100}[c['unit']])) if c else 0
def common(e):
    cp = cp_of(e)
    return {'cg': None, 'cp': cp, 'price': cp / 100.0 if cp % 100 else cp // 100, 'wt': e.get('weight') or 0}
eq_els = []
for e in eq:
    c = cats(e); base = common(e)
    if e.get('damage'):  # weapon
        melee = 'melee-weapons' in c
        cat = 'martial' if 'martial-weapons' in c else 'simple'
        props = []
        for p in e.get('properties', []):
            n = p['name']
            if n == 'Versatile' and e.get('two_handed_damage'):
                n += ' (%s)' % e['two_handed_damage']['damage_dice']
            elif n in ('Ammunition', 'Thrown'):
                r = e.get('throw_range') if n == 'Thrown' else e.get('range')
                if r and r.get('long'): n += ' (%s/%s)' % (r.get('normal'), r['long'])
            props.append(n)
        d = 'Damage %s %s.' % (e['damage']['damage_dice'], e['damage']['damage_type']['name'].lower())
        if props: d += ' ' + ', '.join(props) + '.'
        if e.get('mastery'): d += ' Mastery: %s.' % e['mastery']['name']
        d += ' %s %s weapon.' % (cat.capitalize(), 'Melee' if melee else 'Ranged')
        base.update(cg='Weapons', cat=cat)
        eq_els.append(el('Weapon:' + e['name'], 'Weapon', e['name'], d, [], **base))
    elif e.get('armor_class'):
        ac = e['armor_class']
        kind = 'Shield' if 'shields' in c else ('Light' if 'light-armor' in c else 'Medium' if 'medium-armor' in c else 'Heavy')
        if kind == 'Shield': d = 'A shield grants +2 AC while equipped.'
        elif kind == 'Light': d = 'Light armor. Base AC %d + Dex modifier.' % ac['base']
        elif kind == 'Medium': d = 'Medium armor. Base AC %d + Dex modifier (max %d).' % (ac['base'], ac.get('max_bonus', 2))
        else: d = 'Heavy armor. Base AC %d.' % ac['base']
        sd = bool(e.get('stealth_disadvantage'))
        if sd: d += ' Stealth disadvantage.'
        if e.get('str_minimum'): d += ' Requires Strength %d.' % e['str_minimum']
        base.update(cg='Armor', ac=ac['base'], k=kind, smin=e.get('str_minimum') or 0, sd=sd, kind=kind)
        eq_els.append(el('Armor:' + e['name'], 'Armor', e['name'], d, [], **base))
    else:
        if 'equipment-packs' in c: cg = 'Equipment Packs'
        elif 'musical-instruments' in c: cg = 'Musical Instruments'
        elif c & {'arcane-foci', 'druidic-foci', 'holy-symbols'}: cg = 'Spellcasting Focus'
        elif 'ammunition' in c: cg = 'Ammunition'
        elif c & {'tools', 'artisans-tools', 'other-tools', 'gaming-sets'}: cg = 'Tools'
        else: cg = 'Adventuring Gear'
        d = clean(e.get('description') or '')
        if e.get('contents'):
            d = ((d + '\n\n') if d else '') + 'Contains: ' + ', '.join(('%s x%d' % (i['item']['name'], i['quantity'])) if i['quantity'] > 1 else i['item']['name'] for i in e['contents']) + '.'
        if not d: d = 'Adventuring gear.' if cg == 'Adventuring Gear' else cg[:-1] if cg.endswith('s') else cg
        base['cg'] = cg
        if cg == 'Ammunition' and e.get('quantity'): base['bn'] = e['quantity']
        eq_els.append(el('Gear:' + e['name'], 'Gear', e['name'], d, [], **base))
put('equipment.json', {'elements': eq_els})

# ---------------- magic items ----------------
old_fx = {}
if OLD and os.path.exists(os.path.join(OLD, 'magic-items.json')):
    for m in json.load(open(os.path.join(OLD, 'magic-items.json'), encoding='utf-8'))['elements']:
        if m.get('effect'): old_fx[m['name']] = m['effect']
mcat = {'Wondrous Items': 'Wondrous Items', 'Weapons': 'Magic Weapons', 'Armor': 'Magic Armor', 'Rings': 'Rings', 'Potions': 'Potions', 'Wands': 'Wands', 'Staffs': 'Staffs'}
mg_els = []; fx_used = []
for m in L('Magic-Items'):
    d = clean(m['desc'])
    x = dict(cg=mcat.get(m['equipment_category']['name'], 'Wondrous Items'), cp=0, price=0, wt=0, rar=m['rarity']['name'], att=bool(m['attunement']))
    if m['name'] in old_fx and not m.get('variant'):
        x['effect'] = old_fx[m['name']]; fx_used.append(m['name'])
    mg_els.append(el('Magic:' + m['name'], 'Magic', m['name'], d, [], **x))
put('magic-items.json', {'elements': mg_els})

# ---------------- feats ----------------
feats = L('Feats'); ft_els = []
catmap = {'origin': 'origin', 'general': 'general', 'epic-boon': 'epic'}
def prereq_txt(f):
    p = f.get('prerequisites') or {}
    bits = []
    if p.get('minimum_level'): bits.append('Level %d+' % p['minimum_level'])
    if p.get('feature_named'): bits.append(p['feature_named'] + ' feature')
    for o in f.get('prerequisite_options') or []:
        t = json.dumps(o)
        bits.append('see description')
    return ('Prerequisite: ' + ', '.join(bits) + '. ') if bits else ''
for f in feats:
    n = f['name']; d = clean(f['description'])
    if n == 'Ability Score Improvement':
        continue  # the app's own improvement slots already cover this
    if f['type'] == 'fighting-style':
        ft_els.append(el('Fighting Style:' + n.replace('Two Weapon', 'Two-Weapon'), 'Fighting Style', n.replace('Two Weapon', 'Two-Weapon'), d, [], cls='FPR'))
        continue
    pre = prereq_txt(f)
    if n == 'Magic Initiate':
        for lst in ['Cleric', 'Druid', 'Wizard']:
            rules = [{'select': {'name': 'Cantrips', 'type': 'Spell', 'n': 2, 'spl': lst, 'lvl': 0}},
                     {'select': {'name': 'Level 1 spell', 'type': 'Spell', 'n': 1, 'spl': lst, 'lvl': 1}}]
            ft_els.append(el('Feat:Magic Initiate (%s)' % lst, 'Feat', 'Magic Initiate (%s)' % lst,
                d + '\n\nSpell list for this feat: %s.' % lst, rules, cls='origin'))
        continue
    rules = []
    if n == 'Skilled': rules = [{'select': {'name': 'Skills', 'n': 3, 'from': SKILLS}}]
    ft_els.append(el('Feat:' + n, 'Feat', n, pre + d, rules, cls=catmap.get(f['type'], 'general')))
put('feats.json', {'elements': ft_els})

# ---------------- species (shown as Race) ----------------
traits = L('Traits'); T = {t['index']: t for t in traits}
species = L('Species'); subs = L('Subspecies')
sp_out = []
def short(n): return n.split(': ', 1)[1] if ': ' in n else n
RES_PB = re.compile(r'number of times equal to your Proficiency Bonus', re.I)
def trait_rules(t):
    r = []; d = t['description']; n = t['name']
    if RES_PB.search(d) and not t.get('spells'):
        rest = 'S' if re.search(r'Short or Long Rest', d) else 'L'
        r.append({'resource': {'id': re.sub(r'[^a-z0-9]+', '-', n.lower()).strip('-'), 'name': n, 'rest': rest, 'max': {'pb': True}}})
    if t['index'].startswith('giant-ancestry-') and not r:
        # the number of uses is stated in the parent Giant Ancestry trait: Proficiency Bonus times, Long Rest
        r.append({'resource': {'id': re.sub(r'[^a-z0-9]+', '-', n.lower()).strip('-'), 'name': short(n), 'rest': 'L', 'max': {'pb': True}}})
    if n == 'Dwarven Toughness': r.append({'stat': {'hpl': 1}})
    if n == 'Skillful': r.append({'select': {'name': 'Skillful', 'n': 1, 'from': SKILLS}})
    if n == 'Versatile': r.append({'select': {'name': 'Origin feat', 'type': 'Feat', 'cls': 'origin'}})
    pc = t.get('proficiency_choices')
    if pc and not r:
        opts = []
        for o in pc['from']['options']:
            it = o.get('item') or {}
            if it.get('name') in SKILLS: opts.append(it['name'])
        if opts: r.append({'select': {'name': n, 'n': pc.get('choose', 1), 'from': opts}})
    return r
trait_els = {}
def trait_el(ti):
    n = ti['name']
    if n in trait_els: return 'Racial Trait:' + n
    t = T[ti['index']]
    trait_els[n] = el('Racial Trait:' + n, 'Racial Trait', n, clean(t['description']), trait_rules(t))
    return 'Racial Trait:' + n
for s in species:
    rid = 'Race:' + s['name']
    rules = [{'stat': {'speed': s['speed']}}, {'grant': 'Language:Common'}]
    names = []
    for ti in s['traits']:
        if ti['name'] in ('Elven Lineage', 'Gnomish Lineage', 'Giant Ancestry', 'Fiendish Legacy') and s.get('subspecies'):
            continue  # replaced by the Sub Race choice below
        rules.append({'grant': trait_el(ti)}); names.append(ti['name'])
    if s.get('subspecies'):
        lab = {'Dragonborn': 'Draconic Ancestor', 'Elf': 'Elven Lineage', 'Gnome': 'Gnomish Lineage', 'Goliath': 'Giant Ancestry', 'Tiefling': 'Fiendish Legacy'}[s['name']]
        rules.append({'select': {'name': lab, 'type': 'Sub Race', 'supports': rid}})
    size = s.get('size') or 'Medium or Small (your choice)'
    sp_out.append(el(rid, 'Race', s['name'], '%s. %s. Speed %d ft.%s' % (s['type'], size, s['speed'], (' Traits: ' + ', '.join(names) + '.') if names else ''), rules))
sub_out = []
for sb in subs:
    sp_name = sb['species']['name']; nm = short(sb['name'])
    if sp_name == 'Dragonborn': nm += ' Dragon'
    rules = []; fs = []; txt = []
    for ti in sb['traits']:
        t = T.get(ti['index'])
        if t and t.get('spells'):
            for sp in t['spells']:
                fs.append([ti.get('level', 1), sp['spell']['name'], 'lineage spell'])
            txt.append(ti['name'] + ' (level %s)' % ti.get('level', 1))
        elif t and t.get('speed'):
            rules.append({'stat': {'speed': t['speed']}}); rules.append({'grant': trait_el(ti)})
        else:
            rules.append({'grant': trait_el(ti)})
    # lineage spell traits that carry no `spells` field are plain text: list them in the description
    extra = {}
    if fs: extra['featSpells'] = fs
    sub_out.append(el('Sub Race:' + nm, 'Sub Race', nm, ('%s. ' % sb['name']) + ('Spells: ' + ', '.join(txt) + '.' if txt else '') + (' Damage type: %s.' % sb['damage_type']['name'] if sb.get('damage_type') else ''), rules, supports='Race:' + sp_name, **extra))
put('races.json', {'elements': list(trait_els.values()) + sp_out + sub_out})

# ---------------- backgrounds ----------------
bg_els = []
feat_fix = {'Sage': 'Magic Initiate (Wizard)', 'Acolyte': 'Magic Initiate (Cleric)'}
ABN = {'str': 'Strength', 'dex': 'Dexterity', 'con': 'Constitution', 'int': 'Intelligence', 'wis': 'Wisdom', 'cha': 'Charisma'}
for b in L('Backgrounds'):
    featname = feat_fix.get(b['name'], b['feat']['name'] + ((' (%s)' % b['feat']['note']) if b['feat'].get('note') else ''))
    abil = [a['index'] for a in b['ability_scores']]
    skills = [p['name'].split(': ', 1)[1] for p in b['proficiencies'] if p['name'].startswith('Skill: ')]
    tools = [p['name'].split(': ', 1)[1] for p in b['proficiencies'] if p['name'].startswith('Tool: ')]
    rules = [{'grant': 'skill:' + s} for s in skills]
    if tools: rules.append({'pf': ['t:' + t for t in tools]})
    rules.append({'grant': 'Feat:' + featname})
    rules.append({'select': {'name': 'Languages', 'type': 'Language', 'n': 2, 'ids': standard_ids}})
    equip = None
    for o in b.get('equipment_options', []):
        equip = o['desc']
    d = 'Ability scores: %s. Origin feat: %s. Skills: %s.%s' % (', '.join(ABN[a] for a in abil), featname, ', '.join(skills), (' Tool: %s.' % ', '.join(tools)) if tools else '')
    x = {'abilities': abil}
    if equip: x['equipment'] = equip
    bg_els.append(el('Background:' + b['name'], 'Background', b['name'], d, rules, **x))
put('backgrounds.json', {'elements': bg_els})

# ---------------- tables / info / index ----------------
if OLD and os.path.exists(os.path.join(OLD, 'tables.json')):
    open(os.path.join(OUT, 'tables.json'), 'w', encoding='utf-8').write(open(os.path.join(OLD, 'tables.json'), encoding='utf-8').read())
else:
    put('tables.json', {'tables': {}})
put('info.json', {'info': {}})
put('index.json', {'format': 'hearthscribe-index', 'version': 1,
    'source': {'id': 'srd52', 'name': 'System Reference Document 5.2', 'short': 'SRD 5.2', 'license': 'CC-BY-4.0',
        'credit': 'This work includes material from the System Reference Document 5.2.1 (SRD 5.2.1) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.'},
    'files': ['races.json', 'languages.json', 'spells.json', 'equipment.json', 'magic-items.json', 'backgrounds.json', 'feats.json', 'info.json', 'tables.json']})
print('languages %d | spells %d | equipment %d (weapons %d, armor %d, gear %d) | magic %d (%d with effects) | feats %d | races %d + traits %d + sub races %d | backgrounds %d' % (
    len(lang_els), len(sp_els), len(eq_els), sum(e['type']=='Weapon' for e in eq_els), sum(e['type']=='Armor' for e in eq_els), sum(e['type']=='Gear' for e in eq_els),
    len(mg_els), len(fx_used), len(ft_els), len(sp_out), len(trait_els), len(sub_out), len(bg_els)))
print('effects reused from 5.1:', ', '.join(fx_used))
