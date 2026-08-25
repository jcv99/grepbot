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
    'reinforce.js',
    'spy-send.js',
    'diagnostics.js',
    'stats.js',
    'context-menu.js',
    'hud.js',
    'ui.js',
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


# Per-module TDZ check: a `const X = ...` line that references an identifier
# that is declared `const`/`let` LATER in the same module is a Temporal Dead
# Zone failure at runtime (the IIFE re-orders nothing - declarations run
# top-to-bottom). `function` declarations hoist, so they don't trip this. The
# names of the globals from earlier modules are invisible here on purpose:
# cross-module reads are fine because the earlier module has already run.
# OPEN-PLAN 7.7.
_TDZ_DECL_RE = re.compile(
    r'^  (?:(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)'
    r'|(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=)'
)
_TDZ_REF_RE = re.compile(r'\b([A-Za-z_$][\w$]*)\b')
_TDZ_RESERVED = frozenset({
    'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
    'this', 'arguments', 'super',
})


def check_const_order(parts):
    """Per-module forward-reference check for const/let declarations.

    Only `const` / `let` initializer expressions are scanned - function
    declarations hoist fully (body included), so forward references inside
    a `function foo() { ... }` body are safe.

    The initializer may span multiple lines (`const X =\n  someLaterConst();`):
    the scan consumes continuation lines until the statement terminates, so a
    forward reference buried on a continuation line still trips the gate.

    Returns a list of (module, line, decl_name, referenced_name) tuples.
    """
    def _stmt_terminated(line, lines, line_idx):
        """True when the line ends a top-level statement - the next line is
        not part of this initializer. Tracks bracket depth and trailing
        operators/carriage-returns; a `;` or `,` at depth 0 ends the run."""
        depth_p = depth_b = depth_c = 0
        for ch in line:
            if ch == '(': depth_p += 1
            elif ch == ')': depth_p -= 1
            elif ch == '[': depth_b += 1
            elif ch == ']': depth_b -= 1
            elif ch == '{': depth_c += 1
            elif ch == '}': depth_c -= 1
        if depth_p or depth_b or depth_c:
            return False
        stripped = line.rstrip()
        if not stripped:
            return False  # blank line - keep gathering
        if stripped.endswith((';', ',')):
            return True
        # Trailing binary operator / arrow / chain token -> continue
        if stripped.endswith(('=', '+', '-', '*', '/', '%', '<', '>', '?', ':',
                              '.', ',', '&', '|', '^', '!')):
            return False
        if stripped.endswith(('&&', '||', '??', '=>', '**')):
            return False
        # A bare identifier on its own line is ambiguous - it terminates the
        # expression only if the next non-blank line does NOT begin a chained
        # call/member (`const B = foo\n  .bar();` is one statement).
        if re.match(r'^\s*[A-Za-z_$][\w$]*\s*$', stripped):
            for nxt in lines[line_idx + 1:]:
                ns = nxt.lstrip()
                if not ns:
                    continue
                return not ns.startswith(('.', '(', '[', '`', '+', '-', '!'))
            return True
        return True  # any other top-level close ends the initializer

    def _scan_initializer_body(line, lines, start_idx):
        """Gather the lines that form a single const/let initializer.
        Returns the joined text of every line that belongs to it."""
        body = [line]
        if _stmt_terminated(line, lines, start_idx):
            return body, start_idx
        j = start_idx + 1
        while j < len(lines):
            body.append(lines[j])
            if _stmt_terminated(lines[j], lines, j):
                return body, j
            j += 1
        return body, j - 1  # EOF - return what we have

    issues = []
    for name, text in parts:
        lines = text.splitlines()
        decls = []  # (line_no, ident, kind, body_text)
        i = 0
        while i < len(lines):
            m = _TDZ_DECL_RE.match(lines[i])
            if not m:
                i += 1
                continue
            ident = m.group(1) or m.group(2)
            kind = 'function' if m.group(1) else 'const'
            if kind == 'function':
                decls.append((i + 1, ident, kind, lines[i]))
                i += 1
                continue
            body, end_idx = _scan_initializer_body(lines[i], lines, i)
            decls.append((i + 1, ident, kind, '\n'.join(body)))
            i = end_idx + 1

        const_decls_after = {}
        for ln, ident, kind, _ in decls:
            if kind == 'const':
                const_decls_after[ln] = ident

        for ln, ident, kind, line_text in decls:
            if kind == 'function':
                continue  # hoisted - body forward refs are safe
            for ref in _TDZ_REF_RE.findall(line_text):
                if ref in _TDZ_RESERVED or ref == ident:
                    continue
                for oln, oident in const_decls_after.items():
                    if oln <= ln:
                        continue
                    if oident == ref:
                        issues.append((name, ln, ident, ref))
                        break
    return issues


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


def artifact_version(path):
    """@version of an already-written artifact, or None when unreadable."""
    try:
        with open(path, encoding='utf-8') as f:
            head = f.read(4096)
    except OSError:
        return None
    m = re.search(r'^// @version\s+(\S+)', head, re.M)
    return m.group(1) if m else None


def _vtuple(v):
    return tuple(int(p) for p in re.findall(r'\d+', v or ''))


def newer_artifact_gate(dest, version):
    """Refuse to overwrite an artifact that is NEWER than src/.

    v5.8.0 was built outside this repo and dropped in; a later plain
    `python3 build.py` rebuilt v5.3.1 from a stale src/ and silently erased
    every 5.8.x feature. The build is not allowed to lose work that src cannot
    reproduce. Override with --force once src/ has actually caught up.
    """
    if '--force' in sys.argv:
        return True
    have = artifact_version(dest)
    if not have or not version:
        return True
    if _vtuple(have) <= _vtuple(version):
        return True
    print(f'error: {os.path.basename(dest)} on disk is v{have}, newer than src/ v{version}.')
    print('  Building would overwrite features src/ cannot rebuild.')
    print('  Reconcile src/ with the artifact first, or re-run with --force.')
    return False


def build():
    parts = read_modules()
    dupes = check_duplicate_decls(parts)
    if dupes:
        print('duplicate top-level declarations (one IIFE - these collide):')
        for ident, a, b in dupes:
            print(f'  {ident}: {a} and {b}')
        raise SystemExit(1)
    order = check_const_order(parts)
    if order:
        print('forward-reference in const/let declarations (TDZ at boot):')
        for module, line, decl, ref in order:
            print(f'  {module}:{line}: {decl} references {ref} declared later')
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
    if not newer_artifact_gate(dest, version):
        os.remove(tmp)
        raise SystemExit(1)
    os.replace(tmp, dest)
    size = os.path.getsize(dest)
    print(f'built {dest} ({len(parts)} modules, v{version}, {size // 1024} KB)')


if __name__ == '__main__':
    sys.exit(build())
