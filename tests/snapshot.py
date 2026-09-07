#!/usr/bin/env python3
"""Capture a static snapshot of src/ for the refactor regression net.

Reads every src/*.js (one IIFE, one scope — concat order matters) and
captures the surface a structural move would silently break:

  - top-level function/const declarations per file (name + arity + line)
  - sha256 of each file (catches stray edits between snapshot/diff)
  - all `gb*` platform helper names + arities (the load-bearing helpers
    that every feature module calls)
  - `STORE.*` key list + string values (world-scoping decisions)
  - `BOOT_TIMING.*` values (naked ms literal in boot.js is a regression)
  - `TX_WRITE_FEATURES` set entries (every new write feature MUST
    register or it takes the READ path and skips every guard)
  - `NATIVE_QUEUE_LANES` / `NATIVE_RECRUIT_LANES` / `HARASS_CAPS` /
    `HARASS_PREF` / `RF_MODE_ES` (constants the queue center + militar
    tab bind to)
  - `NAVAL_MYTHICAL_UNITS` / `MYTHICAL_UNIT_GOD` (recruit + native-ui
    share this classifier)
  - `TAB_GROUPS` (panel chrome — drop one and a tab vanishes)
  - `[data-cfg=...]` controls + their `<details>` group (bindConfig
    resolves by attribute; rename = silent loss)
  - `<option value="...">` literals (pinned values per hard rule)
  - sentinel call-site counts per file (gbNum/gbLit/gbPaint/gbLock/
    bridgePost/gameAjaxPost/txRun/saveSoon/saveFlush/BOOT_TIMING./STORE.)
    — a missed rewire during a move shows up as a count delta
  - cyclomatic complexity for every function ≥ 20 (the 30 hotspots
    the graph returns — assert no hotspot regresses above pre-refactor)

Subcommands:

  python3 tests/snapshot.py write [PATH]
    Write a fresh snapshot to PATH (default
    tests/snapshots/pre-refactor.json).

  python3 tests/snapshot.py show [PATH]
    Print the snapshot at PATH (default tests/snapshots/pre-refactor.json)
    as compact JSON for diffing.

Pure stdlib — no npm, no test runner. Wire values pinned to disk.

See docs/REDESIGN.md §5 (Test strategy) for the full design.
"""
import hashlib
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
DEFAULT_BASELINE = ROOT / "tests" / "snapshots" / "pre-refactor.json"

# Same regex family build.py uses (DECL_RE in build.py:89). Top-level here
# means "two-space indent" — every module body is written at that depth.
DECL_RE = re.compile(
    r'^  (?:(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)'
    r'|class\s+([A-Za-z_$][\w$]*)'
    r'|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*='
    r')'
)
ARITY_RE = re.compile(
    r'^\s*(?:async\s+)?function(?:\s*\*)?\s*([A-Za-z_$][\w$]*)?\s*\(([^)]*)\)'
)
FN_BODY_END_RE = re.compile(r'^\s*\}')

# Platform primitives that every move must preserve. Listed explicitly
# rather than regex'd because a move that drops one of these from the
# IIFE is the regression class the snapshot exists to catch.
GB_HELPERS = [
    'gbNum', 'gbLit', 'gbPaint', 'gbLock', 'gbUnlock', 'gbLocked',
    'gbListen', 'gbListenerSignal', 'gbListenerAbort',
    'gbTry', 'gbClearTimeout', 'gbClearInterval', 'gbTimeout', 'gbInterval',
    'save', 'saveSoon', 'saveFlush',
    'gbAjaxWatch', 'gbAjaxDrop', 'gbAjaxDispose', 'gbAjaxClaim',
    'gbAjaxFp', 'gbAjaxUnwrap',
    'gameUw', 'gbTownModel', 'gbBuildingLevel', 'gbAfford',
    'gbProbeNum', 'gbProbeAttr', 'gbLog', 'gbLogT', 'uwCached',
]

# Sentinel call sites a refactor must preserve. Counted per file.
SENTINEL_PATTERNS = [
    ('gbNum(', re.compile(r'\bgbNum\s*\(')),
    ('gbLit(', re.compile(r'\bgbLit\s*\(')),
    ('gbPaint(', re.compile(r'\bgbPaint\s*\(')),
    ('gbLock(', re.compile(r'\bgbLock\s*\(')),
    ('gbUnlock(', re.compile(r'\bgbUnlock\s*\(')),
    ('gbListen(', re.compile(r'\bgbListen\s*\(')),
    ('saveSoon(', re.compile(r'\bsaveSoon\s*\(')),
    ('saveFlush(', re.compile(r'\bsaveFlush\s*\(')),
    ('bridgePost(', re.compile(r'\bbridgePost\s*\(')),
    ('gameAjaxPost(', re.compile(r'\bgameAjaxPost\s*\(')),
    ('txRun(', re.compile(r'\btxRun\s*\(')),
    ('BOOT_TIMING.', re.compile(r'\bBOOT_TIMING\.')),
    ('STORE.', re.compile(r'\bSTORE\.')),
    ('gbAjaxWatch(', re.compile(r'\bgbAjaxWatch\s*\(')),
    ('gbLog(', re.compile(r'\bgbLog\s*\(')),
    ('gbLogT(', re.compile(r'\bgbLogT\s*\(')),
]

# Public literal maps we cannot afford to drop silently.
NAMED_LITERALS = [
    ('STORE', 'gbStore', SRC / 'core.js'),
    ('BOOT_TIMING', 'gbBootTiming', SRC / 'boot.js'),
    ('TX_WRITE_FEATURES', 'gbTxWriteFeatures', SRC / 'planner.js'),
    ('NATIVE_QUEUE_LANES', 'gbNativeQueueLanes', SRC / 'native-ui.js'),
    ('NATIVE_RECRUIT_LANES', 'gbNativeRecruitLanes', SRC / 'native-ui.js'),
    ('HARASS_CAPS', 'gbHarassCaps', SRC / 'attack.js'),
    ('HARASS_PREF', 'gbHarassPref', SRC / 'attack.js'),
    ('RF_MODE_ES', 'gbRfModeEs', SRC / 'reinforce.js'),
    ('NAVAL_MYTHICAL_UNITS', 'gbNavalMythicalUnits', SRC / 'recruit.js'),
    ('MYTHICAL_UNIT_GOD', 'gbMythicalUnitGod', SRC / 'recruit.js'),
    ('TAB_GROUPS', 'gbTabGroups', SRC / 'ui.js'),
]


def _arity(fn_decl_line):
    """Approximate arity: split top-level commas between ( and )."""
    m = ARITY_RE.match(fn_decl_line)
    if not m:
        return 0
    params = m.group(2).strip()
    if not params:
        return 0
    depth = 0
    count = 1
    for c in params:
        if c in '([{':
            depth += 1
        elif c in ')]}':
            depth -= 1
        elif c == ',' and depth == 0:
            count += 1
    return count


def _top_level_decls(text):
    """Walk src/ text and return [(name, kind, line_no, arity)] for every
    top-level function/const at the IIFE body's indent (2 spaces)."""
    out = []
    for i, line in enumerate(text.splitlines(), 1):
        m = DECL_RE.match(line)
        if not m:
            continue
        name = next((g for g in m.groups() if g), None)
        if not name:
            continue
        kind = 'function' if (m.group(1) is not None) else 'const'
        arity = _arity(line) if kind == 'function' else None
        out.append((name, kind, i, arity))
    return out


def _file_sha(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def _extract_const_block(text, const_name):
    """Best-effort extract of `const NAME = { ... }` / `= [...]` body."""
    pattern = re.compile(
        r'^(?:const|let|var)\s+' + re.escape(const_name) +
        r'\s*=\s*(\{[^}]*\}|\[[^\]]*\])',
        re.M,
    )
    m = pattern.search(text)
    return m.group(1) if m else None


def _count_complexity_hotspots(text, threshold=20):
    """Naive cyclomatic complexity: count branching tokens in each fn body.

    Returns {fn_name: complexity}. Only includes functions ≥ threshold to
    keep the snapshot small — gate 1 only cares about hotspots anyway.
    """
    lines = text.splitlines()
    fn_starts = []
    for i, line in enumerate(lines):
        m = re.match(r'^  function\s+([A-Za-z_$][\w$]*)\s*\(', line)
        if m:
            fn_starts.append((i, m.group(1)))
    branch_tokens = re.compile(r'\b(if|else if|for|while|case|&&|\|\||\?)\b')
    hotspots = {}
    for idx, (start, name) in enumerate(fn_starts):
        end = len(lines)
        for j in range(start + 1, len(lines)):
            if FN_BODY_END_RE.match(lines[j]):
                end = j + 1
                break
        body = '\n'.join(lines[start:end])
        c = 1 + len(branch_tokens.findall(body))
        if c >= threshold:
            hotspots[name] = c
    return hotspots


def _count_sentinels(text):
    counts = {}
    for name, pat in SENTINEL_PATTERNS:
        counts[name] = len(pat.findall(text))
    return counts


def _extract_data_cfg(text):
    """Pull every `[data-cfg=...]` literal and the surrounding group block.

    bindConfig resolves by attribute; renaming one = silent loss.
    """
    cfg = []
    cfg_re = re.compile(r'data-cfg="([^"]+)"')
    group_re = re.compile(r'<details[^>]*>\s*<summary[^>]*>\s*([^<]+?)\s*</summary>')
    lines = text.splitlines()
    current_group = None
    for line in lines:
        g = group_re.search(line)
        if g:
            current_group = g.group(1).strip()
        m = cfg_re.search(line)
        if m:
            cfg.append({'key': m.group(1), 'group': current_group})
    return cfg


def _extract_option_values(text):
    """Pull every `<option value="...">` literal.

    Pinned values per hard rule. Server reads `value`, not visible text —
    if a translation rewrites a `<select>` without pinning value, the
    server receives option text (a documented bug class).
    """
    seen = []
    pat = re.compile(r'<option\s+value="([^"]+)"')
    for line in text.splitlines():
        m = pat.search(line)
        if m:
            seen.append(m.group(1))
    return seen


def _extract_gb_helpers(text):
    """Look up the arity of each GB_HELPERS entry in core.js."""
    arities = {}
    for name in GB_HELPERS:
        # Match `function name(` or `function *name(` at any indent.
        for line in text.splitlines():
            m = re.match(
                r'^  (?:async\s+)?function(?:\s*\*)?\s+' +
                re.escape(name) + r'\s*\(([^)]*)\)', line,
            )
            if m:
                params = m.group(1).strip()
                arities[name] = 0 if not params else (
                    1 + sum(1 for c in params if c == ',' and _safe_top_lev(params, c))
                )
                break
        else:
            arities[name] = None  # missing = regression signal
    return arities


def _safe_top_lev(params, _):
    # params string has no nested parens (regex limited), so every comma
    # is a parameter separator. Kept as a function for symmetry with the
    # _arity helper and to leave room for default/destructured args later.
    return True


def snapshot():
    """Build the full snapshot dict. Schema is stable; consumers depend
    on the keys (diff.py + tests in REDESIGN §5.1)."""
    if not SRC.is_dir():
        raise SystemExit(f'error: {SRC} not a directory')

    files = {}
    sentinel_total = Counter()
    for path in sorted(SRC.glob('*.js')):
        text = path.read_text(encoding='utf-8')
        rel = path.name
        decls = _top_level_decls(text)
        sentinels = _count_sentinels(text)
        sentinel_total.update(sentinels)
        files[rel] = {
            'sha256': _file_sha(text),
            'lines': text.count('\n') + 1,
            'decls': [{'name': n, 'kind': k, 'line': ln, 'arity': a}
                      for n, k, ln, a in decls],
            'sentinels': sentinels,
            'complexity_hotspots': _count_complexity_hotspots(text),
        }

    core_text = (SRC / 'core.js').read_text(encoding='utf-8')
    gb_arities = _extract_gb_helpers(core_text)

    literals = {}
    for label, key, path in NAMED_LITERALS:
        if not path.exists():
            literals[key] = None
            continue
        block = _extract_const_block(path.read_text(encoding='utf-8'), label)
        literals[key] = block

    ui_text = (SRC / 'ui.js').read_text(encoding='utf-8')
    data_cfg = _extract_data_cfg(ui_text)
    option_values = _extract_option_values(ui_text)

    return {
        'version': 1,
        'src_modules_count': len(files),
        'files': files,
        'gb_helpers': gb_arities,
        'literals': literals,
        'data_cfg': data_cfg,
        'option_values': option_values,
        'sentinel_total': dict(sentinel_total),
    }


def cmd_write(path):
    snap = snapshot()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(snap, indent=2, sort_keys=True), encoding='utf-8')
    print(f'wrote {path} '
          f'({len(snap["files"])} files, '
          f'{sum(len(f["decls"]) for f in snap["files"].values())} decls, '
          f'{len(snap["data_cfg"])} data-cfg, '
          f'{len(snap["option_values"])} option values)')


def cmd_show(path):
    if not path.exists():
        raise SystemExit(f'error: snapshot not found at {path}')
    print(json.dumps(json.loads(path.read_text(encoding='utf-8')),
                     indent=2, sort_keys=True))


def main():
    if len(sys.argv) < 2:
        sys.argv.append('show')
    cmd = sys.argv[1]
    if cmd == 'write':
        path = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_BASELINE
        cmd_write(path)
    elif cmd == 'show':
        path = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_BASELINE
        cmd_show(path)
    else:
        raise SystemExit(f'usage: {sys.argv[0]} {{write|show}} [PATH]')


if __name__ == '__main__':
    main()