#!/usr/bin/env python3
"""Diff a fresh snapshot against the committed baseline.

Exit 0 if equal; exit 1 with a structured report otherwise.

Used as build.py gate 5 (REDESIGN §5.1) and run manually after every
R-step. The diff walks dicts recursively so a missing/declared helper,
a STORE.* key delta, a sentinel call-site count, or a complexity
regression all surface as a single entry in the report.

Schema:

  python3 tests/diff.py <baseline.json> [<current.json>]

If <current.json> is omitted, runs `tests/snapshot.py` against the
live src/ and diffs against the baseline.

--warn-only exits 0 even on diff. Used by R0a first run so the
infra ships clean before the baseline is committed.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tests'))
import snapshot as snap_mod  # noqa: E402

WARN_ONLY = '--warn-only' in sys.argv
argv = [a for a in sys.argv[1:] if not a.startswith('--')]


def _walk(a, b, path=''):
    """Recursive diff. Returns list of (path, a_repr, b_repr) tuples.

    Dict: recurse on every key in either side (added/removed = diff).
    List: compare element-wise; length delta = diff.
    Scalar: compare values.
    None / missing: treat as 'absent'.
    """
    diffs = []
    if isinstance(a, dict) and isinstance(b, dict):
        keys = sorted(set(a) | set(b))
        for k in keys:
            diffs.extend(_walk(a.get(k), b.get(k), f'{path}.{k}' if path else k))
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            diffs.append((f'{path}[]', f'len={len(a)}', f'len={len(b)}'))
        for i, (x, y) in enumerate(zip(a, b)):
            diffs.extend(_walk(x, y, f'{path}[{i}]'))
    elif a != b:
        diffs.append((path or '<root>', repr(a)[:160], repr(b)[:160]))
    return diffs


def main():
    if not argv:
        raise SystemExit('usage: diff.py <baseline.json> [<current.json>] [--warn-only]')
    baseline_path = Path(argv[0])
    if not baseline_path.exists():
        raise SystemExit(f'error: baseline not found at {baseline_path}')
    baseline = json.loads(baseline_path.read_text(encoding='utf-8'))

    if len(argv) > 1:
        current = json.loads(Path(argv[1]).read_text(encoding='utf-8'))
    else:
        # Live snapshot — re-snapshot src/ in-process.
        current = snap_mod.snapshot()

    diffs = _walk(baseline, current)
    if not diffs:
        print(f'OK — {sum(len(f["decls"]) for f in baseline["files"].values())} '
              f'decls match, {len(baseline["data_cfg"])} data-cfg match, '
              f'sentinel totals match')
        return 0

    print(f'{len(diffs)} difference(s) vs {baseline_path.name}:')
    for path, was, now in diffs[:200]:
        print(f'  {path}')
        print(f'    was: {was}')
        print(f'    now: {now}')
    if len(diffs) > 200:
        print(f'  ... and {len(diffs) - 200} more (truncated)')
    if WARN_ONLY:
        print(f'\n--warn-only: exiting 0 despite diffs (R0a infra bootstrap)')
        return 0
    return 1


if __name__ == '__main__':
    sys.exit(main())