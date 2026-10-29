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
SUF = ' (5.2)'   # every 5.2 id ends with this, so 5.1 and 5.2 content can both be loaded and mixed
def sid(t, n): return t + ':' + n + SUF

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
old_langs = set()
if OLD and os.path.exists(os.path.join(OLD, 'languages.json')):
    old_langs = {e['name'] for e in json.load(open(os.path.join(OLD, 'languages.json'), encoding='utf-8'))['elements']}
# languages are shared with 5.1 (same ids), so a language is never offered twice
lang_els = [el('Language:' + l['name'], 'Language', l['name'], l['name'] + ' is a language your character can speak, read and write.' + (' (Rare language.)' if (l['is_rare'] or l['name'] in RARE) else '')) for l in langs if l['name'] not in old_langs]
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
    sp_els.append(el(sid('Spell', s['name']), 'Spell', s['name'], desc, [],
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
old_gear = set(); skipped_gear = []
if OLD and os.path.exists(os.path.join(OLD, 'equipment.json')):
    old_gear = {(x['name'], x['cp'], x['wt']) for x in json.load(open(os.path.join(OLD, 'equipment.json'), encoding='utf-8'))['elements'] if x['type'] == 'Gear'}
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
        eq_els.append(el(sid('Weapon', e['name']), 'Weapon', e['name'], d, [], **base))
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
        eq_els.append(el(sid('Armor', e['name']), 'Armor', e['name'], d, [], **base))
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
        if (e['name'], base['cp'], base['wt']) in old_gear: skipped_gear.append(e['name']); continue  # identical to the 5.1 item
        eq_els.append(el(sid('Gear', e['name']), 'Gear', e['name'], d, [], **base))
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
    mg_els.append(el(sid('Magic', m['name']), 'Magic', m['name'], d, [], **x))
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
        ft_els.append(el(sid('Fighting Style', n.replace('Two Weapon', 'Two-Weapon')), 'Fighting Style', n.replace('Two Weapon', 'Two-Weapon'), d, [], cls='FPR'))
        continue
    pre = prereq_txt(f)
    if n == 'Magic Initiate':
        for lst in ['Cleric', 'Druid', 'Wizard']:
            rules = [{'select': {'name': 'Cantrips', 'type': 'Spell', 'n': 2, 'spl': lst, 'lvl': 0}},
                     {'select': {'name': 'Level 1 spell', 'type': 'Spell', 'n': 1, 'spl': lst, 'lvl': 1}}]
            ft_els.append(el(sid('Feat', 'Magic Initiate (%s)' % lst), 'Feat', 'Magic Initiate (%s)' % lst,
                d + '\n\nSpell list for this feat: %s.' % lst, rules, cls='origin'))
        continue
    rules = []
    if n == 'Skilled': rules = [{'select': {'name': 'Skills', 'n': 3, 'from': SKILLS}}]
    ft_els.append(el(sid('Feat', n), 'Feat', n, pre + d, rules, cls=catmap.get(f['type'], 'general')))
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
    if n == 'Relentless Endurance': r.append({'resource': {'id': 'relentless-endurance-52', 'name': n, 'rest': 'L', 'max': 1}})
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
    if n in trait_els: return sid('Racial Trait', n)
    t = T[ti['index']]
    trait_els[n] = el(sid('Racial Trait', n), 'Racial Trait', n, clean(t['description']), trait_rules(t))
    return sid('Racial Trait', n)
for s in species:
    rid = sid('Race', s['name'])
    rules = [{'stat': {'speed': s['speed']}}, {'grant': 'Language:Common'}]  # Common is shared with 5.1
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
                fs.append([ti.get('level', 1), sid('Spell', sp['spell']['name']), 'lineage spell'])
            txt.append(ti['name'] + ' (level %s)' % ti.get('level', 1))
        elif t and t.get('speed'):
            rules.append({'stat': {'speed': t['speed']}}); rules.append({'grant': trait_el(ti)})
        else:
            rules.append({'grant': trait_el(ti)})
    # lineage spell traits that carry no `spells` field are plain text: list them in the description
    extra = {}
    if fs: extra['featSpells'] = fs
    sub_out.append(el(sid('Sub Race', nm), 'Sub Race', nm, ('%s. ' % sb['name']) + ('Spells: ' + ', '.join(txt) + '.' if txt else '') + (' Damage type: %s.' % sb['damage_type']['name'] if sb.get('damage_type') else ''), rules, supports=sid('Race', sp_name), **extra))
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
    rules.append({'grant': sid('Feat', featname)})
    rules.append({'select': {'name': 'Languages', 'type': 'Language', 'n': 2, 'ids': standard_ids}})
    equip = None
    for o in b.get('equipment_options', []):
        equip = o['desc']
    d = 'Ability scores: %s. Origin feat: %s. Skills: %s.%s' % (', '.join(ABN[a] for a in abil), featname, ', '.join(skills), (' Tool: %s.' % ', '.join(tools)) if tools else '')
    x = {'abilities': abil}
    if equip: x['equipment'] = equip
    bg_els.append(el(sid('Background', b['name']), 'Background', b['name'], d, rules, **x))
put('backgrounds.json', {'elements': bg_els})

# ---------------- classes and subclasses ----------------
CLS = L('Classes'); LVL = L('Levels'); FEAT = L('Features'); SUBS = L('Subclasses')
SPELL_NAMES = {x['name'] for x in spells}
def nm(x): return x.replace('\u2019', "'").lower().strip()
levels = {}
for l in LVL:
    if 'subclass' in l: continue
    levels.setdefault(l['class']['name'], {})[l['level']] = l
feat_by_index = {f['index']: f for f in FEAT}
INFO = {}

def num(v):
    if isinstance(v, (int, float)): return int(v)
    m = re.search(r'\d+', str(v)); return int(m.group()) if m else 0
def table(cn, key):
    return [num((levels[cn].get(i, {}).get('class_specific') or {}).get(key, 0)) for i in range(1, 21)]
def first_para(t, limit=230):
    t = clean(t).split('\n\n')[0].replace('\n', ' ')
    if len(t) <= limit: return t
    cut = t[:limit]; k = max(cut.rfind('. '), cut.rfind('; '))
    return (cut[:k + 1] if k > 80 else cut.rsplit(' ', 1)[0] + '...')
def fid(label): return sid('Class Feature', label)

# equipment lookup (5.2 first, then 5.1 for identical gear that was left out)
NAMEID = {}
if OLD and os.path.exists(os.path.join(OLD, 'equipment.json')):
    for x in json.load(open(os.path.join(OLD, 'equipment.json'), encoding='utf-8'))['elements']: NAMEID[nm(x['name'])] = x['id']
for x in eq_els: NAMEID[nm(x['name'])] = x['id']
raw_eq = {e['name']: e for e in eq}
def wcat(e): return {c['index'] for c in e.get('equipment_categories', [])}
def wprops(e): return {p['name'] for p in e.get('properties', [])}
def melee(e): return 'melee-weapons' in wcat(e)
def is_weapon(e): return bool(e.get('damage'))
ELIG = {
 'Barbarian': lambda e: melee(e),
 'Fighter': lambda e: True, 'Paladin': lambda e: True, 'Ranger': lambda e: True,
 'Rogue': lambda e: 'simple-weapons' in wcat(e) or bool(wprops(e) & {'Finesse', 'Light'}),
}
def mastery_ids(cn):
    return [sid('Weapon', e['name']) for e in eq if is_weapon(e) and e.get('mastery') and ELIG[cn](e)]
STYLE_IDS = [e['id'] for e in ft_els if e['type'] == 'Fighting Style']
SKL = [x for x in SKILLS]

def res(id_, name, mx, rest='L', **x):
    d = {'id': id_, 'name': name, 'max': mx, 'rest': rest}; d.update(x); return {'resource': d}
def overlay(cn, f):
    C_ = cn + SUF; T = lambda k: {'class': C_, 'table': table(cn, k)}
    O = {
     ('Barbarian', 'Rage'): [res('rage52', 'Rage', T('rage_count'), 'L')],
     ('Barbarian', 'Unarmored Defense'): [{'acFormula': {'base': 10, 'add': ['dex', 'con']}}],
     ('Barbarian', 'Fast Movement'): [{'speedBonus': {'max': 10, 'noHeavy': True}}],
     ('Bard', 'Bardic Inspiration'): [res('bi52', 'Bardic Inspiration', {'mod': 'cha'}, 'L', min=1, restShort={'class': C_, 'level': 5}, note='short rest from level 5')],
     ('Bard', 'Jack of All Trades'): [{'halfProf': {'abilities': 'all', 'round': 'down'}}],
     ('Cleric', 'Channel Divinity'): [res('cd52', 'Channel Divinity', T('channel_divinity_charges'), 'L', note='1 back on a short rest')],
     ('Cleric', 'Divine Intervention'): [res('di52', 'Divine Intervention', 1, 'L')],
     ('Druid', 'Wild Shape'): [res('ws52', 'Wild Shape', T('wild_shape_uses'), 'L', note='1 back on a short rest')],
     ('Fighter', 'Second Wind'): [res('sw52', 'Second Wind', T('second_wind_uses'), 'L', note='1 back on a short rest')],
     ('Fighter', 'Action Surge'): [res('as52', 'Action Surge', {'class': C_, 'table': [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2]}, 'S')],
     ('Fighter', 'Indomitable'): [res('ind52', 'Indomitable', {'class': C_, 'table': [0] * 8 + [1] * 4 + [2] * 4 + [3] * 4}, 'L')],
     ('Monk', "Monk's Focus"): [res('focus52', 'Focus points', T('focus_points'), 'S')],
     ('Monk', 'Unarmored Defense'): [{'acFormula': {'base': 10, 'add': ['dex', 'wis'], 'noShield': True}}],
     ('Monk', 'Unarmored Movement'): [{'speedBonus': {'unarmored': True, 'max': T('unarmored_movement_bonus')}}],
     ('Monk', 'Uncanny Metabolism'): [res('um52', 'Uncanny Metabolism', 1, 'L')],
     ('Paladin', 'Lay On Hands'): [res('loh52', 'Lay on Hands (pool)', {'class': C_, 'mult': 5}, 'L')],
     ('Paladin', 'Channel Divinity'): [res('pcd52', 'Channel Divinity', {'class': C_, 'table': [0, 0] + [2] * 10 + [3] * 8}, 'L', note='1 back on a short rest')],
     ('Paladin', 'Aura of Protection'): [{'saveBonus': {'mod': 'cha', 'min': 1}}],
     ('Paladin', "Paladin's Smite"): [res('smite52', "Paladin's Smite (free cast)", 1, 'L')],
     ('Ranger', 'Favored Enemy'): [res('fe52', "Hunter's Mark (free casts)", T('favored_enemies'), 'L')],
     ('Ranger', 'Roving'): [{'speedBonus': {'max': 10, 'noHeavy': True}}],
     ('Ranger', 'Tireless'): [res('tl52', 'Tireless', {'mod': 'wis'}, 'L', min=1)],
     ('Ranger', "Nature's Veil"): [res('nv52', "Nature's Veil", {'pb': True}, 'L')],
     ('Rogue', 'Stroke of Luck'): [res('sol52', 'Stroke of Luck', 1, 'S')],
     ('Sorcerer', 'Innate Sorcery'): [res('is52', 'Innate Sorcery', 2, 'L')],
     ('Sorcerer', 'Font of Magic'): [res('sp52', 'Sorcery points', T('sorcery_points'), 'L')],
     ('Warlock', 'Magical Cunning'): [res('mc52', 'Magical Cunning', 1, 'L')],
     ('Wizard', 'Arcane Recovery'): [res('ar52', 'Arcane Recovery', 1, 'L')],
    }
    return O.get((cn, f), [])

def parse_spell_rows(desc, header_re=None):
    rows = {}; cur = None
    for ln in [x.strip() for x in desc.split('\n')]:
        m = re.match(r'^(\d+)\s+(.+)$', ln)
        if m and int(m.group(1)) <= 20: cur = int(m.group(1)); rows[cur] = m.group(2)
        elif cur and ln and re.match(r"^[A-Za-z' ,\u2019/-]+$", ln) and not re.match(r'^(Cleric|Druid|Paladin|Sorcerer|Warlock|Wizard)\b.*(Level|Spells)', ln): rows[cur] += ' ' + ln
        else: cur = None if ln else cur
    out = {}
    for lv, txt in rows.items():
        names = [n.strip().strip(',') for n in txt.split(',') if n.strip().strip(',')]
        good = {nm(n): n for n in SPELL_NAMES}
        if not all(nm(n) in good for n in names): return None
        out[str(lv)] = [sid('Spell', good[nm(n)]) for n in names]
    return out if len(out) >= 3 else None

class_els = []; feat_els = {}; sub_els = []; land_els = []; notes = []
def feature_el(label, name, text, rules):
    if label not in feat_els:
        feat_els[label] = el(fid(label), 'Class Feature', name, first_para(text), rules)
        feat_els[label]['full'] = clean(text)
    return fid(label)
def lookup_feature(cn, fname):
    for f in FEAT:
        if f['class']['name'] == cn and f['name'] == fname and not f.get('subclass'): return f
    return None

for c in CLS:
    cn = c['name']; C_ = cn + SUF; rules = []; granted = set(); infoparts = []
    for p in c['proficiencies']:
        if p['index'].startswith('saving-throw-'): rules.append({'grant': 'save:' + p['index'][-3:]})
    for chc in c.get('proficiency_choices') or []:
        opts = []
        try:
            for o in chc['from']['options']:
                it = o.get('item') or {}
                if it.get('name', '').startswith('Skill: '): opts.append(it['name'][7:])
        except Exception: pass
        if not opts and 'skill' in chc.get('desc', '').lower(): opts = SKL
        if opts: rules.append({'select': {'name': 'Skills (choose %d)' % chc['choose'], 'n': chc['choose'], 'from': opts}})
    tools = [{'tool-thieves-tools': "t:Thieves' Tools", 'herbalism-kit': 't:Herbalism Kit'}[p['index']] for p in c['proficiencies'] if p['index'] in ('tool-thieves-tools', 'herbalism-kit')]
    if tools: rules.append({'pf': tools})
    # armor / weapon proficiencies as in the 5.1 pack
    AP = {'light-armor': 'a:Light armor', 'medium-armor': 'a:Medium armor', 'shields': 'a:Shields', 'simple-weapons': 'w:Simple weapons', 'martial-weapons': 'w:Martial weapons'}
    def prof_list(lst):
        out = []
        for p in lst:
            i = p['index']
            if i == 'all-armor': out += ['a:Light armor', 'a:Medium armor', 'a:Heavy armor']
            elif i in AP: out.append(AP[i])
            elif i in ('scimitars', 'shortswords', 'hand-crossbows', 'longswords', 'rapiers', 'whips'): out.append('w:' + p['name'].title())
        return out
    ap = prof_list(c['proficiencies']); mp = prof_list(c.get('multi_classing', {}).get('proficiencies', []))
    wp = []
    for p in c['proficiencies']:
        i = p['index']
        if i == 'simple-weapons': wp.append('simple')
        elif i == 'martial-weapons': wp.append('martial')
        elif i in ('scimitars', 'shortswords', 'hand-crossbows', 'longswords', 'rapiers', 'whips'): wp.append(p['name'].rstrip('s').title() if i != 'hand-crossbows' else 'Hand Crossbow')
    # languages
    if cn == 'Rogue': rules.append({'grant': "Language:Thieves' Cant"})
    if cn == 'Druid': rules.append({'grant': 'Language:Druidic'})
    # features level by level
    mastery_t = table(cn, 'weapon_mastery') if cn in ('Barbarian', 'Fighter') else None
    prev_inv = 0; prev_meta = 0; subclass_done = False; mastery_done = 0
    for lv in range(1, 21):
        rec = levels[cn].get(lv)
        if not rec: continue
        infoparts.append('LEVEL %d' % lv)
        for fr in rec['features']:
            fname = fr['name']
            f = feat_by_index.get(fr['index']) or lookup_feature(cn, fname)
            text = f['description'] if f else ''
            infoparts.append(fname + '.' + clean(text).replace('\n\n', '\n').split('\n')[0] if text else fname + '.')
            if fname == 'Ability Score Improvement': rules.append({'asi': 1, 'level': lv}); continue
            if fname == 'Epic Boon': rules.append({'asi': 1, 'level': lv, 'epic': True}); continue
            if fname.endswith('Subclass'):
                if not subclass_done:
                    rules.append({'select': {'name': fname.replace(' Subclass', ' Subclass'), 'type': 'Subclass', 'supports': 'Class:' + C_}, 'level': lv}); subclass_done = True
                continue
            if fname == 'Expertise': rules.append({'expertise': 2, 'level': lv}); continue
            if fname == 'Scholar': rules.append({'expertise': 1, 'level': lv}); continue
            if fname == 'Fighting Style':
                rules.append({'select': {'name': 'Fighting Style', 'type': 'Fighting Style', 'ids': STYLE_IDS}, 'level': lv}); continue
            if fname == 'Weapon Mastery':
                ids = mastery_ids(cn)
                rules.append({'select': {'name': 'Weapon Mastery', 'type': 'Weapon', 'n': mastery_t[0] if mastery_t else 2, 'ids': ids}, 'level': lv}); mastery_done = mastery_t[0] if mastery_t else 2
                continue
            if fname == 'Eldritch Invocations':
                continue  # handled below
            if fname == 'Metamagic':
                continue  # handled below
            if f is None: continue
            label = '%s (%s)' % (fname, cn)
            if label in granted: continue
            granted.add(label)
            r_ = overlay(cn, fname)
            if cn == 'Sorcerer' and fname == 'Font of Magic': pass
            rules.append({'grant': feature_el(label, fname, text, r_), 'level': lv})
        # increments of chosen options by level
        if mastery_t and lv > 1 and mastery_t[lv - 1] > mastery_done:
            rules.append({'select': {'name': 'Weapon Mastery (more)', 'type': 'Weapon', 'n': mastery_t[lv - 1] - mastery_done, 'ids': mastery_ids(cn)}, 'level': lv}); mastery_done = mastery_t[lv - 1]
        if cn == 'Warlock':
            inv = table(cn, 'eldritch_invocations')[lv - 1]
            if inv > prev_inv:
                rules.append({'select': {'name': 'Eldritch Invocations' + (' (more)' if prev_inv else ''), 'type': 'Invocation', 'n': inv - prev_inv}, 'level': lv}); prev_inv = inv
            if lv == 1:
                f = lookup_feature(cn, 'Eldritch Invocations')
                if f: rules.append({'grant': feature_el('Eldritch Invocations (Warlock)', 'Eldritch Invocations', f['description'], []), 'level': 1})
        if cn == 'Sorcerer':
            meta = {2: 2, 10: 4, 17: 6}.get(lv)
            if meta and meta > prev_meta:
                rules.append({'select': {'name': 'Metamagic' + (' (more)' if prev_meta else ''), 'type': 'Metamagic', 'n': meta - prev_meta}, 'level': lv}); prev_meta = meta
            if lv == 2:
                f = lookup_feature(cn, 'Metamagic')
                if f: rules.append({'grant': feature_el('Metamagic (Sorcerer)', 'Metamagic', f['description'], []), 'level': 2})
    # casting
    casting = None
    sp = c.get('spellcasting')
    if sp:
        rows = []; prep = []
        for lv in range(1, 21):
            q = (levels[cn].get(lv) or {}).get('spellcasting') or {}
            rows.append([q.get('cantrips_known', 0)] + [q.get('spell_slots_level_%d' % i, 0) for i in range(1, 10)])
            prep.append(q.get('prepared_spells', 0))
        casting = {'ability': sp['spellcasting_ability']['index'], 'mode': 'book' if cn == 'Wizard' else 'prep', 'half': cn in ('Paladin', 'Ranger'), 'halfUp': cn in ('Paladin', 'Ranger'),
                   'rows': rows, 'known': None, 'prep': prep, 'list': cn}
    # prerequisites for multiclassing
    mc = c.get('multi_classing', {}); prereq = None
    if mc.get('prerequisites'):
        ab = [p['ability_score']['index'] for p in mc['prerequisites']]
        prereq = ab if len(ab) == 1 else ['&'] + ab
    elif mc.get('prerequisite_options'):
        prereq = [o['ability_score']['index'] for o in mc['prerequisite_options']['from']['options']]
    # starting equipment
    start = {'f': [], 'g': []}
    for so in c.get('starting_equipment_options', []):
        opts = []
        for op in so['from']['options']:
            parts = []
            items = op['items'] if op['option_type'] == 'multiple' else [op]
            for it in items:
                if it['option_type'] == 'counted_reference':
                    iid = NAMEID.get(nm(it['of']['name']))
                    if nm(it['of']['name']) == 'holy symbols': parts.append({'c': 'holy-symbols', 'q': it['count']})
                    elif iid: parts.append({'i': iid, 'q': it['count']})
                    else: notes.append('%s start: %s not found' % (cn, it['of']['name']))
                elif it['option_type'] == 'money': parts.append({'gp': it['count']})
                else: notes.append('%s start: skipped %s' % (cn, it['option_type']))
            opts.append(parts)
        start['g'].append({'d': so['desc'], 'o': opts})
    d = '%s Hit die d%d. Primary ability: %s.' % ('', c['hit_die'], c['primary_ability']['desc'])
    x = {'hd': c['hit_die'], 'wp': wp, 'ap': ap, 'mp': mp, 'start': start}
    if prereq: x['prereq'] = prereq
    if casting: x['casting'] = casting
    ce = el('Class:' + C_, 'Class', C_, d.strip(), rules, **x)
    class_els.append(ce)
    INFO[ce['id']] = cn.upper() + '\nHit Die.d%d\nPrimary Ability.%s\n\nFEATURES BY LEVEL\n' % (c['hit_die'], c['primary_ability']['desc']) + '\n'.join(infoparts)

# subclasses
for sc in SUBS:
    cn = sc['class']['name']; C_ = cn + SUF; sname = sc['name']; rules = []
    prepared = None; landfeat = None
    for f in sc['features']:
        label = '%s (%s)' % (f['name'].split('\n')[0][:60], sname)
        ftxt = f['description']
        fname = f['name'].split('\n')[0]
        if sname == 'Circle of the Land' and fname.startswith('Circle of the Land Spells'):
            fname = 'Circle of the Land Spells'; landfeat = f; label = '%s (%s)' % (fname, sname)
            ftxt = 'Whenever you finish a Long Rest, choose one type of land: arid, polar, temperate, or tropical. You have the matching circle spells prepared for your Druid level and lower.'
        if re.search(r' Spells$', fname) and not fname.startswith('Sculpt') and sname != 'Circle of the Land':
            pr = parse_spell_rows(ftxt)
            if pr: prepared = {'class': C_, 'levels': pr}
            else: notes.append('%s: spell table in "%s" not parsed - left as text' % (sname, fname))
        rules.append({'grant': feature_el(label, fname, ftxt, []), 'level': f['level']})
    if landfeat:
        txt = landfeat['description']
        lands = re.split(r'\n(?=\w+ Land\n)', txt[txt.find('Arid Land'):])
        sel_ids = []
        for blk in lands:
            m = re.match(r'(\w+) Land\n', blk)
            if not m: continue
            pr = parse_spell_rows(blk)
            if not pr: notes.append('Circle of the Land %s not parsed' % m.group(1)); continue
            lname = m.group(1)
            land_els.append(el(sid('Land Type', lname), 'Land Type', lname, 'Circle spells for the %s land.' % lname.lower(), [], prepared={'class': C_.replace(cn, 'Druid') if False else 'Druid' + SUF, 'levels': pr}))
            sel_ids.append(sid('Land Type', lname))
        rules.append({'select': {'name': 'Land Type', 'type': 'Land Type', 'ids': sel_ids}, 'level': 3})
    x = {'supports': 'Class:' + C_}
    if prepared: x['prepared'] = prepared
    se = el(sid('Subclass', sname), 'Subclass', sname, (sc.get('summary') or '') + ('. ' if sc.get('summary') else '') + first_para(sc['description']), rules, **x)
    sub_els.append(se)
    INFO[se['id']] = sname.upper() + '\n' + clean(sc['description']).split('\n')[0] + '\n\n' + '\n'.join('%s.%s' % (f['name'].split('\n')[0], first_para(f['description'], 400)) for f in sc['features'])

# move long text into info and drop the helper field
for e in feat_els.values(): e.pop('full', None)
put('classes.json', {'elements': class_els + list(feat_els.values()) + land_els})
put('subclasses.json', {'elements': sub_els})
print('classes %d | class features %d | land types %d | subclasses %d' % (len(class_els), len(feat_els), len(land_els), len(sub_els)))
for n in notes: print('NOTE:', n)

# ---------------- tables / info / index ----------------
put('tables.json', {'tables': {}})  # XP and trinkets come from the 5.1 pack; both packs are always loaded
put('info.json', {'info': INFO})
put('index.json', {'format': 'hearthscribe-index', 'version': 1,
    'source': {'id': 'srd52', 'name': 'System Reference Document 5.2', 'short': 'SRD 5.2', 'license': 'CC-BY-4.0',
        'credit': 'This work includes material from the System Reference Document 5.2.1 (SRD 5.2.1) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.'},
    'files': ['races.json', 'languages.json', 'classes.json', 'subclasses.json', 'spells.json', 'equipment.json', 'magic-items.json', 'backgrounds.json', 'feats.json', 'info.json', 'tables.json']})
print('languages %d | spells %d | equipment %d (weapons %d, armor %d, gear %d) | magic %d (%d with effects) | feats %d | races %d + traits %d + sub races %d | backgrounds %d' % (
    len(lang_els), len(sp_els), len(eq_els), sum(e['type']=='Weapon' for e in eq_els), sum(e['type']=='Armor' for e in eq_els), sum(e['type']=='Gear' for e in eq_els),
    len(mg_els), len(fx_used), len(ft_els), len(sp_out), len(trait_els), len(sub_out), len(bg_els)))
print('effects reused from 5.1:', ', '.join(fx_used))
print('gear identical to 5.1 and left out (5.1 copy is used):', len(skipped_gear))
