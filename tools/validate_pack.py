#!/usr/bin/env python3
"""Checks a homebrew pack before you share it.   python3 tools/validate_pack.py path/to/pack.json
Reports structure problems, duplicate ids, unknown element types and references to things that do not exist
(checked against the SRD plus the pack itself)."""
import json, os, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if len(sys.argv) < 2: sys.exit(__doc__)
pack = json.load(open(sys.argv[1], encoding='utf-8'))
srd = json.load(open(os.path.join(root, 'data/srd/index.json'), encoding='utf-8'))
known = {}
for f in srd['files']:
    for e in json.load(open(os.path.join(root, 'data/srd', f), encoding='utf-8')).get('elements', []): known[e['id']] = e['type']
types = set(known.values())
errors, warns, seen = [], [], set()
els = pack.get('elements', pack if isinstance(pack, list) else [])
if not isinstance(els, list): sys.exit('"elements" must be a list')
for i, e in enumerate(els):
    for k in ('id', 'type', 'name'):
        if k not in e: errors.append(f'element {i}: missing "{k}"')
    if 'id' in e:
        if e['id'] in seen: warns.append(f'duplicate id {e["id"]}')
        seen.add(e['id'])
        if e.get('type') and e['id'] != f'{e["type"]}:{e["name"]}': warns.append(f'{e["id"]}: id is usually "Type:Name"')
for e in els: known.setdefault(e.get('id'), e.get('type'))
def check(e, r):
    g = r.get('grant')
    if g and not g.split(':')[0] in ('skill', 'save') and g not in known: warns.append(f'{e["id"]}: grants "{g}" which does not exist')
    s = r.get('select')
    if s and not s.get('from') and not s.get('ids') and s.get('type') and s['type'] not in types | {x.get('type') for x in els}: warns.append(f'{e["id"]}: select of unknown type "{s["type"]}"')
for e in els:
    for r in e.get('rules', []): check(e, r)
    if e.get('type') == 'Class':
        for k in ('hd',):
            if k not in e: errors.append(f'{e["id"]}: a class needs "{k}"')
        c = e.get('casting')
        if c and (len(c.get('rows', [])) != 20 or any(len(r) != 10 for r in c['rows'])): errors.append(f'{e["id"]}: casting.rows must be 20 rows of 10 numbers [cantrips, slots 1-9]')
for m in errors: print('ERROR  ', m)
for m in warns: print('warning', m)
print(f'{len(els)} elements, {len(errors)} errors, {len(warns)} warnings')
sys.exit(1 if errors else 0)
