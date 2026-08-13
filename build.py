#!/usr/bin/env python3
"""Concat src modules into grepbot.user.js (Phase 6 modularity).

Gates (v1.4.0): the build used to be a blind concat, so a syntax error or a
duplicate top-level declaration only surfaced after pasting into Tampermonkey.
Now the artifact is checked before it is written off as done:

  1. `node --check` on the output (skipped with a warning if node is missing)
  2. duplicate top-level `function`/`const`/`let` names across modules — the
     concat order makes those a hard TDZ/redeclare failure inside one IIFE
  3. reminder when src/ changed but @version in src/header.js did not
  4. the JS body is \\u-escaped to pure ASCII, so no install path can decode it
     as Latin-1 and turn every accent into mojibake

Also strips // and /* */ comments from the artifact (UserScript header kept).
src/ retains comments for humans; only grepbot.user.js is cleaned.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
OUT = os.path.join(ROOT, 'grepbot.user.js')
STAMP = os.path.join(ROOT, '.build-stamp.json')

MODULES = [
    'header.js',
    'core.js',
    'planner.js',
    'tx.js',
    'bridge.js',
    'journal.js',
    'spy.js',
    'parse-inline.js',
    'farms.js',
    'towns.js',
    'collect.js',
    'bandit.js',
    'build-tab.js',
    'goals.js',
    'build-targets.js',
    'native-ui.js',
    'build-auto.js',
    'cave.js',
    'culture.js',
    'emergency.js',
    'trade.js',
    'transport.js',
    'dump.js',
    'rural.js',
    'research-graph.js',
    'research.js',
    'alerts.js',
    'merchant.js',
    'phoenician.js',
    'favor.js',
    'god-spells.js',
    'wonder.js',
    'dodge.js',
    'recruit.js',
    'qol.js',
    'orchestrate.js',
    'intel.js',
    'quests.js',
    'attack.js',
    'shared-plan.js',
    'military.js',
    'support.js',
    'diagnostics.js',
    'stats.js',
    'context-menu.js',
    'hud.js',
    'queue-center.js',
    'ui.js',
    'relay.js',
    'boot.js',
    'footer.js',
]

# Top-level here means "two spaces of indent" — the whole script is one IIFE and
# every module body is written at that depth.
DECL_RE = re.compile(
    r'^  (?:(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)'
    r'|class\s+([A-Za-z_$][\w$]*)'
    r'|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*='
    # `import` / `export` declarations are top-level in ESM. The repo doesn't
    # use ESM today, but a future module that sneaks one in would otherwise
    # silently pass the duplicate-decl gate.
    r'|import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+[\'"][^\'"]+[\'"]'
    r'|export\s+(?:default\s+)?(?:function\s*\*?\s*([A-Za-z_$][\w$]*)|class\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)))'
)
VERSION_RE = re.compile(r'^// @version\s+(\S+)', re.M)
USERSCRIPT_HEADER_RE = re.compile(r'^﻿?// ==UserScript==.*?// ==/UserScript==\n?', re.S)

# '/' starts a regex after these punctuation tokens (not after values like ) ] ).
_RE_PREV = frozenset('([{;=,:!&|?~^%*+\n\r-')
_RE_KEYWORDS = frozenset({
    'return', 'throw', 'case', 'else', 'do', 'typeof', 'void', 'new',
    'delete', 'await', 'yield', 'in', 'of', 'instanceof',
})


def strip_js_comments(src):
    """Remove // and /* */ outside strings, templates, and regex literals."""
    n = len(src)
    out = []
    i = 0

    def last_non_ws():
        for c in reversed(out):
            if c not in ' \t\n\r':
                return c
        return ''

    def prev_word():
        j = len(out) - 1
        while j >= 0 and out[j] in ' \t':
            j -= 1
        end = j
        while j >= 0 and (out[j].isalnum() or out[j] in '_$'):
            j -= 1
        return ''.join(out[j + 1:end + 1]) if end >= 0 else ''

    def can_regex():
        c = last_non_ws()
        if c == '' or c in _RE_PREV:
            return True
        return prev_word() in _RE_KEYWORDS

    while i < n:
        c = src[i]
        nxt = src[i + 1] if i + 1 < n else ''

        if c == '/' and nxt == '/':
            i += 2
            while i < n and src[i] not in '\n\r':
                i += 1
            continue

        if c == '/' and nxt == '*':
            i += 2
            while i < n - 1 and not (src[i] == '*' and src[i + 1] == '/'):
                i += 1
            i = i + 2 if i < n - 1 else n
            if out and out[-1] not in ' \t\n\r' and i < n and src[i] not in ' \t\n\r;,)}]:':
                out.append(' ')
            continue

        if c in "'\"":
            quote = c
            out.append(c)
            i += 1
            while i < n:
                ch = src[i]
                out.append(ch)
                if ch == '\\':
                    i += 1
                    if i < n:
                        out.append(src[i])
                        i += 1
                    continue
                if ch == quote:
                    i += 1
                    break
                i += 1
            continue

        if c == '`':
            out.append(c)
            i += 1
            while i < n:
                ch = src[i]
                out.append(ch)
                if ch == '\\':
                    i += 1
                    if i < n:
                        out.append(src[i])
                        i += 1
                    continue
                if ch == '`':
                    i += 1
                    break
                if ch == '$' and i + 1 < n and src[i + 1] == '{':
                    out.append('{')
                    i += 2
                    depth = 1
                    expr = []
                    while i < n and depth:
                        ec = src[i]
                        if ec in "'\"":
                            q = ec
                            expr.append(ec)
                            i += 1
                            while i < n:
                                x = src[i]
                                expr.append(x)
                                if x == '\\':
                                    i += 1
                                    if i < n:
                                        expr.append(src[i])
                                        i += 1
                                    continue
                                if x == q:
                                    i += 1
                                    break
                                i += 1
                            continue
                        if ec == '`':
                            expr.append(ec)
                            i += 1
                            while i < n:
                                x = src[i]
                                expr.append(x)
                                if x == '\\':
                                    i += 1
                                    if i < n:
                                        expr.append(src[i])
                                        i += 1
                                    continue
                                if x == '`':
                                    i += 1
                                    break
                                if x == '$' and i + 1 < n and src[i + 1] == '{':
                                    expr.append('{')
                                    i += 2
                                    d2 = 1
                                    while i < n and d2:
                                        y = src[i]
                                        if y == '{':
                                            d2 += 1
                                        elif y == '}':
                                            d2 -= 1
                                        expr.append(y)
                                        i += 1
                                    continue
                                i += 1
                            continue
                        if ec == '{':
                            depth += 1
                            expr.append(ec)
                            i += 1
                            continue
                        if ec == '}':
                            depth -= 1
                            if depth == 0:
                                out.append(strip_js_comments(''.join(expr)))
                                out.append('}')
                                i += 1
                                break
                            expr.append(ec)
                            i += 1
                            continue
                        if ec == '/' and i + 1 < n and src[i + 1] == '/':
                            i += 2
                            while i < n and src[i] not in '\n\r':
                                i += 1
                            continue
                        if ec == '/' and i + 1 < n and src[i + 1] == '*':
                            i += 2
                            while i < n - 1 and not (src[i] == '*' and src[i + 1] == '/'):
                                i += 1
                            i = i + 2 if i < n - 1 else n
                            continue
                        expr.append(ec)
                        i += 1
                    continue
                i += 1
            continue

        if c == '/' and can_regex():
            out.append(c)
            i += 1
            while i < n:
                ch = src[i]
                out.append(ch)
                if ch == '\\':
                    i += 1
                    if i < n:
                        out.append(src[i])
                        i += 1
                    continue
                if ch == '[':
                    i += 1
                    while i < n:
                        x = src[i]
                        out.append(x)
                        if x == '\\':
                            i += 1
                            if i < n:
                                out.append(src[i])
                                i += 1
                            continue
                        if x == ']':
                            i += 1
                            break
                        i += 1
                    continue
                if ch == '/':
                    i += 1
                    while i < n and src[i].isalpha():
                        out.append(src[i])
                        i += 1
                    break
                i += 1
            continue

        out.append(c)
        i += 1

    text = ''.join(out)
    text = re.sub(r'\n[ \t]*\n(?:[ \t]*\n)+', '\n\n', text)
    text = re.sub(r'[ \t]+\n', '\n', text)
    return text


def strip_artifact_comments(body):
    """Keep ==UserScript== metadata; strip every other JS comment."""
    m = USERSCRIPT_HEADER_RE.match(body)
    if not m:
        return strip_js_comments(body)
    header = m.group(0)
    if not header.endswith('\n'):
        header += '\n'
    return header + strip_js_comments(body[m.end():])


def compact_whitespace(text):
    """Conservative whitespace squeeze for the --prod artifact.

    Deliberately NOT a minifier: it never renames, never reorders, never drops
    a statement and never touches anything inside a string or template literal.
    A real minifier would need a JS parser this repo does not ship and cannot
    validate against fixtures, and a wrong rename in a paste-only userscript is
    unfixable from the user's side.

    It only strips leading indentation and drops blank lines, which the
    ==UserScript== block tolerates and `node --check` still verifies.
    """
    out = []
    in_block = False
    for line in text.split('\n'):
        # The metadata block is parsed as TEXT by Tampermonkey, not as JS, so
        # its exact leading '// ' must survive untouched.
        if '// ==UserScript==' in line:
            in_block = True
        if in_block:
            out.append(line)
            if '// ==/UserScript==' in line:
                in_block = False
            continue
        stripped = line.strip()
        if not stripped:
            continue
        out.append(stripped if _safe_to_strip(line) else line)
    return '\n'.join(out) + '\n'


def _safe_to_strip(line):
    """True when leading whitespace is not inside a multi-line template literal.

    Counting unescaped backticks per line is a heuristic, so it errs toward
    KEEPING the line untouched: an odd count means we are entering or leaving a
    template and the indentation may be significant.
    """
    ticks = 0
    i = 0
    while i < len(line):
        c = line[i]
        if c == '\\':
            i += 2
            continue
        if c == '`':
            ticks += 1
        i += 1
    return ticks % 2 == 0


def ascii_escape_artifact(body):
    """Escape every non-ASCII char in the JS body to \\uXXXX.

    The source is UTF-8, but the artifact is installed by paste or by dragging
    a file:// URL onto a Tampermonkey tab — neither path carries a charset, so
    the browser guesses, and a Latin-1 guess renders 'Economia' as 'EconomAa'
    and the ellipsis as 'a€|'. A pure-ASCII artifact has no bytes left to
    misdecode: \\uXXXX produces the identical runtime string under any charset.

    Comments are already stripped by this point, so the only non-ASCII left is
    inside string/template/regex literals, where \\uXXXX is valid everywhere.
    The ==UserScript== metadata block is NOT JavaScript — Tampermonkey parses
    it as text, so an escape there would ship literally into the install
    dialog. Keep it ASCII at the source instead.
    """
    m = USERSCRIPT_HEADER_RE.match(body)
    if not m:
        raise SystemExit('error: ==UserScript== metadata block not at the top of the artifact')
    header, code = m.group(0), body[m.end():]
    if not header.isascii():
        bad = sorted({c for c in header if not c.isascii()})
        print('error: non-ASCII in the ==UserScript== metadata block: '
              + ' '.join(f'U+{ord(c):04X} {c!r}' for c in bad))
        print('  TM parses that block as text, not JS, so it cannot be \\u-escaped.')
        print('  Use plain ASCII in src/header.js (e.g. "Automatizacion").')
        raise SystemExit(1)
    out = []
    for ch in code:
        if ch.isascii():
            out.append(ch)
        elif ord(ch) > 0xFFFF:  # astral -> surrogate pair
            n = ord(ch) - 0x10000
            out.append(f'\\u{0xD800 + (n >> 10):04x}\\u{0xDC00 + (n & 0x3FF):04x}')
        else:
            out.append(f'\\u{ord(ch):04x}')
    return header + ''.join(out)


def read_modules():
    parts = []
    for name in MODULES:
        path = os.path.join(SRC, name)
        if not os.path.exists(path):
            raise SystemExit(f'missing module: {path}')
        with open(path, encoding='utf-8-sig') as f:
            parts.append((name, f.read()))
    return parts


def check_duplicate_decls(parts):
    seen = {}
    dupes = []
    for name, text in parts:
        for line in text.splitlines():
            m = DECL_RE.match(line)
            if not m:
                continue
            # Groups 4-6 are the `export` alternatives; reading only 1-3 made
            # every ESM export collapse to ident=None, and two of them in
            # different modules then reported a bogus duplicate named "None".
            # The bare `import ... from '...'` alternative captures nothing.
            ident = next((g for g in m.groups() if g), None)
            if ident is None:
                continue
            if ident in seen and seen[ident] != name:
                dupes.append((ident, seen[ident], name))
            else:
                seen.setdefault(ident, name)
    return dupes


def node_check(path):
    node = shutil.which('node')
    if not node:
        print('warn: node not found - skipped syntax check')
        return True
    res = subprocess.run([node, '--check', path], capture_output=True, text=True)
    if res.returncode != 0:
        print('SYNTAX ERROR in built artifact:')
        detail = (res.stderr or '').strip() or (res.stdout or '').strip()
        print(detail or f'node --check exited {res.returncode} with no output')
        return False
    return True


def version_of(parts):
    for name, text in parts:
        if name == 'header.js':
            m = VERSION_RE.search(text)
            return m.group(1) if m else None
    return None


def version_gate(parts, version):
    if not version:
        print('error: no "// @version <x>" line in src/header.js '
              '- Tampermonkey needs it to install/update')
        return False
    digest = hashlib.sha256(''.join(t for _, t in parts).encode('utf-8')).hexdigest()
    prev = {}
    if os.path.exists(STAMP):
        try:
            with open(STAMP, encoding='utf-8') as f:
                prev = json.load(f)
        except Exception:
            prev = {}
    changed = prev.get('src') not in (None, digest)
    if changed and prev.get('version') == version:
        print(f'error: src/ changed but @version is still {version} '
              '- bump src/header.js (TM will not auto-update otherwise)')
        return False
    with open(STAMP, 'w', encoding='utf-8') as f:
        json.dump({'src': digest, 'version': version}, f)
    return True


def build():
    parts = read_modules()
    dupes = check_duplicate_decls(parts)
    if dupes:
        print('duplicate top-level declarations (one IIFE - these collide):')
        for ident, a, b in dupes:
            print(f'  {ident}: {a} and {b}')
        raise SystemExit(1)
    body = strip_artifact_comments('\n'.join(t.rstrip() for _, t in parts).rstrip() + '\n')
    if '// ==UserScript==' not in body or '// ==/UserScript==' not in body:
        print('error: ==UserScript== metadata block missing from the artifact '
              '- src/header.js must open with it (TM refuses to install without it)')
        raise SystemExit(1)
    prod = '--prod' in sys.argv
    tmp = OUT.replace('.user.js', '.build.js')  # node --check needs a .js name
    if prod:
        body = compact_whitespace(body)
    body = ascii_escape_artifact(body)
    if not body.isascii():
        print('error: artifact still holds non-ASCII after escaping')
        raise SystemExit(1)
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(body)
    if not node_check(tmp):
        os.remove(tmp)
        raise SystemExit(1)
    version = version_of(parts)
    if not version_gate(parts, version):
        os.remove(tmp)
        raise SystemExit(1)
    # --prod writes a SIBLING file. Never in place: a broken prod build must not
    # be able to take out the dev paste path the whole workflow depends on.
    dest = OUT + '.prod' if prod else OUT
    os.replace(tmp, dest)
    size = os.path.getsize(dest)
    print(f'built {dest} ({len(parts)} modules, v{version}, {size // 1024} KB)')


if __name__ == '__main__':
    sys.exit(build())
