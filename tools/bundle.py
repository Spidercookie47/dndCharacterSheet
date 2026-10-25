#!/usr/bin/env python3
"""Builds dist/hearthscribe.html: the whole app in ONE file (CSS, JS, SRD data and the sheet PDF inlined).
Use it when you cannot serve the folder (opening from disk, sharing a single file, claude.ai artifacts).
Run from the project root:  python3 tools/bundle.py"""
import base64, json, os, re, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(root, p), encoding='utf-8').read()
html = rd('index.html')

# CSS
def css(m): return '<style>\n' + rd(m.group(1)) + '\n</style>'
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, html)

# vendor libraries -> CDN (allowed by the artifact sandbox)
html = re.sub(r'<!-- BUNDLE:vendor -->.*?<!-- /BUNDLE:vendor -->',
  '<script src="https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>\n<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>', html, flags=re.S)

# data
bundle = {}
idx = json.loads(rd('data/srd/index.json')); bundle['data/srd/index.json'] = idx
for f in idx['files']: bundle['data/srd/' + f] = json.loads(rd('data/srd/' + f))
pdf = base64.b64encode(open(os.path.join(root, 'assets/5E_CharacterSheet_Fillable.pdf'), 'rb').read()).decode()
safe = lambda s: re.sub(r'</(script)', r'<\\/\1', s, flags=re.I)
data = ('<script>window.__HS_BUNDLE__=' + safe(json.dumps(bundle, ensure_ascii=True, separators=(',', ':'))) + ';'
        'window.__HS_PDF_B64__="' + pdf + '";window.HS_PDFJS_WORKER="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";</script>')

# scripts in page order
scripts = re.findall(r'<script src="(js/[^"]+)"></script>', html)
inline = '\n'.join('/* ===== ' + s + ' ===== */\n' + safe(rd(s)) for s in scripts)
html = re.sub(r'<script src="js/[^"]+"></script>\s*', '', html)
html = html.replace('</body>', data + '\n<script>\n' + inline + '\n</script>\n</body>')
os.makedirs(os.path.join(root, 'dist'), exist_ok=True)
out = os.path.join(root, 'dist', 'hearthscribe.html')
open(out, 'w', encoding='utf-8').write(html)
print('wrote', out, round(os.path.getsize(out) / 1e6, 2), 'MB,', len(scripts), 'scripts')
