#!/usr/bin/env python3
"""Split grepbot.user.js into src modules."""
import os, re

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
PATH = os.path.join(ROOT, 'grepbot.user.js')

with open(PATH, encoding='utf-8') as f:
    full = f.read()

m = re.match(r'(// ==UserScript==.*?==/UserScript==\s*/\* global.*?\*/\s*\(function \(\) \{\s*\'use strict\';\s*)', full, re.S)
header = m.group(1)
body = full[m.end():]
footer_start = body.rfind('  gbLog(\'active v')
footer = body[footer_start:]
body = body[:footer_start]

MARKERS = [
    ('core.js', 'const STORE', '  // ---------- ajax spy'),
    ('spy.js', '  // ---------- ajax spy', '  // parsers from src/parse.js'),
    ('parse-inline.js', '  // parsers from src/parse.js', '  function sniffBridgeBody'),
    ('farms.js', '  function sniffBridgeBody', '  // ---------- owned towns'),
    ('towns.js', '  // ---------- owned towns', '  // ---------- auto-collect'),
    ('collect.js', '  // ---------- auto-collect', '  // ---------- auto-bandit'),
    ('bandit.js', '  // ---------- auto-bandit', '  // ---------- instant build'),
    ('build-tab.js', '  // ---------- instant build', '  // ---------- attack builder'),
    ('attack.js', '  // ---------- attack builder', '  // ---------- sortable tables'),
    ('ui.js', '  // ---------- sortable tables', '  // ---------- sync to local server'),
    ('boot.js', '  // ---------- boot ----------', '  // ---------- self-update'),
    ('footer.js', '  // ---------- self-update', None),
]

os.makedirs(SRC, exist_ok=True)
with open(os.path.join(SRC, 'header.js'), 'w', encoding='utf-8') as f:
    f.write(header.rstrip() + '\n')

for name, start, end in MARKERS:
    s = body.index(start)
    e = body.index(end) if end else len(body)
    with open(os.path.join(SRC, name), 'w', encoding='utf-8') as f:
        f.write(body[s:e])

with open(os.path.join(SRC, 'footer.js'), 'w', encoding='utf-8') as f:
    f.write(body[body.index('  // ---------- self-update'):] + footer)

print('split into', len(MARKERS) + 1, 'modules')
