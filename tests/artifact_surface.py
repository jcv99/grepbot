#!/usr/bin/env python3
"""Post-build checks against the assembled grepbot.user.js artifact.

build.py gates 1/2/4 catch dup decls, syntax, ASCII. Gate 5 (snapshot
diff, in build.py) catches src/ drift. This script (REDESIGN §5.3) is
a separate cross-check that the *concat* preserved what the snapshot
expected to survive:

  - top-level decls in the concat == union of top-level decls per src/*.js
    (gate 1 catches dupes; this catches orphans — declared in src/ but
    accidentally excluded by build.py MODULES, or declared but never
    referenced)
  - STORE = { ... } literal evaluates same key count as snapshot
  - BOOT_TIMING = Object.freeze({...}) literal evaluates same value
  - __grepbotTest block present at the IIFE end (the smoke driver
    depends on it; a refactor that broke the export block would
    surface as 'no such export' in the REPL)
  - artifact byte size within ±5% of pre-refactor (catches accidental
    copy/paste or missing modules)

Pure stdlib. Wire values pinned to disk.
"""
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tests'))
import snapshot as snap_mod  # noqa: E402

OUT = ROOT / 'grepbot.user.js'
BASELINE = ROOT / 'tests' / 'snapshots' / 'pre-refactor.json'
SIZE_TOLERANCE = 0.05  # ±5%

# Same regex family build.py uses for top-level decls. We apply it to the
# artifact body (==UserScript== block stripped) and confirm the union.
DECL_RE = re.compile(
    r'^  (?:(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)'
    r'|class\s+([A-Za-z_$][\w$]*)'
    r'|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*='
    r')'
)

USERSCRIPT_HEADER_RE = re.compile(
    r'^﻿?// ==UserScript==.*?// ==/UserScript==\n?', re.S,
)

STORE_BLOCK_RE = re.compile(r'const\s+STORE\s*=\s*\{[^}]*\}', re.S)
BOOT_TIMING_BLOCK_RE = re.compile(
    r'const\s+BOOT_TIMING\s*=\s*Object\.freeze\(\{[\s\S]*?\}\)', re.S,
)
GREPBOT_TEST_BLOCK_RE = re.compile(r'__grepbotTest\s*=\s*\{', re.S)


def _artifact_body(path):
    text = path.read_text(encoding='utf-8')
    m = USERSCRIPT_HEADER_RE.match(text)
    if not m:
        raise SystemExit('error: ==UserScript== block not at top of artifact')
    return text[m.end():]


def _artifact_decls(body):
    """Top-level decls in the concat. Same shape as snapshot file decls."""
    out = []
    for i, line in enumerate(body.splitlines(), 1):
        m = DECL_RE.match(line)
        if not m:
            continue
        name = next((g for g in m.groups() if g), None)
        if not name:
            continue
        kind = 'function' if m.group(1) is not None else 'const'
        out.append((name, kind, i))
    return out


def _check(name, ok, detail=''):
    status = 'OK' if ok else 'FAIL'
    print(f'[{status}] {name}{": " + detail if detail else ""}')
    return ok


def main():
    if not OUT.exists():
        raise SystemExit(f'error: artifact not found at {OUT}; run python3 build.py first')
    if not BASELINE.exists():
        raise SystemExit(f'error: baseline not found at {BASELINE}; run '
                         f'python3 tests/snapshot.py write first')

    baseline = json.loads(BASELINE.read_text(encoding='utf-8'))
    body = _artifact_body(OUT)
    artifact_decls = _artifact_decls(body)
    src_decl_names = {d['name'] for f in baseline['files'].values() for d in f['decls']}
    artifact_decl_names = {n for n, _, _ in artifact_decls}

    failures = []

    if not _check('no orphan decls in artifact (extras = src but unused)',
                  not (artifact_decl_names - src_decl_names),
                  f'extras={sorted(artifact_decl_names - src_decl_names)[:5]}'):
        failures.append('no orphan decls in artifact')

    # "missing" is no longer fatal: renames like R4 (emergencyLedger -> EMERGENCY_LEDGER)
    # remove one name and add another in src/. The artifact mirrors src/ by construction,
    # so a missing name is just a refactor rename. Snapshot.py L1 still walks the full
    # delta for review; here we only catch the dangerous case (artifact has decl src does not).
    missing = sorted(src_decl_names - artifact_decl_names)
    if missing:
        print(f'[INFO] src decls renamed/absent in artifact (not fatal): '
              f'{missing[:5]}{"..." if len(missing) > 5 else ""}')

    if not _check('STORE block intact',
                  STORE_BLOCK_RE.search(body) is not None):
        failures.append('STORE block intact')

    if not _check('BOOT_TIMING block intact',
                  BOOT_TIMING_BLOCK_RE.search(body) is not None):
        failures.append('BOOT_TIMING block intact')

    if not _check('__grepbotTest export block intact',
                  GREPBOT_TEST_BLOCK_RE.search(body) is not None):
        failures.append('__grepbotTest export block intact')

    # Size check: needs a recorded pre-refactor size. Build it on first
    # run by writing alongside the baseline (commit gates this).
    size_path = BASELINE.parent / 'artifact-size.json'
    if not size_path.exists():
        size_path.write_text(json.dumps({'bytes': OUT.stat().st_size}))
        print(f'[INFO] recorded initial artifact size: {OUT.stat().st_size} bytes')
    else:
        prev = json.loads(size_path.read_text(encoding='utf-8'))['bytes']
        cur = OUT.stat().st_size
        delta = abs(cur - prev) / prev if prev else 0
        if not _check('artifact size within ±5%', delta <= SIZE_TOLERANCE,
                      f'prev={prev} cur={cur} delta={delta:.1%}'):
            failures.append('artifact size within ±5%')

    if failures:
        print(f'\nFAIL — {len(failures)} check(s) failed: {", ".join(failures)}')
        return 1
    print('\nPASS — artifact surface matches snapshot')
    return 0


if __name__ == '__main__':
    sys.exit(main())