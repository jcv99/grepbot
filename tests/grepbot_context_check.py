#!/usr/bin/env python3
"""GrepBot AI-context recheck — gates every new patch.

Verifies the four sources of truth stay in sync and surfaces drift
that the build alone cannot catch:

  1. src/header.js        @version
  2. src/core.js          GB_RELEASE
  3. grepbot.user.js      @version   (assembled artifact)
  4. .build-stamp.json    version    (last build record)

Also reports whether src/ is newer than the artifact (would mean the
artifact is stale even though version strings match). Read-only —
exits non-zero only on hard drift.

Companion to `tests/artifact_surface.py`: that one proves the
artifact is well-formed; this one proves it agrees with the source
version. Together they are the pre-commit floor.

Optional flags:
  --strict     exit 1 on stale-artifact warnings too
  --quiet      only print the failing lines
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HEADER = ROOT / "src" / "header.js"
CORE = ROOT / "src" / "core.js"
ARTIFACT = ROOT / "grepbot.user.js"
STAMP = ROOT / ".build-stamp.json"

VER_HEADER = re.compile(r"@version\s+(\S+)")
VER_CORE = re.compile(r"GB_RELEASE\s*=\s*['\"](\S+)['\"]")


def _read(path: Path, pattern: re.Pattern[str]) -> str | None:
    if not path.is_file():
        return None
    m = pattern.search(path.read_text(encoding="utf-8", errors="replace"))
    return m.group(1) if m else None


def _stamp_version() -> str | None:
    if not STAMP.is_file():
        return None
    try:
        return json.loads(STAMP.read_text(encoding="utf-8")).get("version")
    except (OSError, json.JSONDecodeError):
        return None


def _mtime(path: Path) -> float:
    return path.stat().st_mtime if path.is_file() else 0.0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--strict", action="store_true",
                    help="fail on stale artifact warnings too")
    ap.add_argument("--quiet", action="store_true",
                    help="only print lines that fail")
    args = ap.parse_args()

    header_v = _read(HEADER, VER_HEADER)
    core_v = _read(CORE, VER_CORE)
    artifact_v = _read(ARTIFACT, VER_HEADER)
    stamp_v = _stamp_version()

    artifact_mtime = _mtime(ARTIFACT)
    header_mtime = _mtime(HEADER)

    fail: list[str] = []
    warn: list[str] = []

    def line(label: str, value: str, fail_on: bool = False) -> None:
        if args.quiet and not fail_on:
            return
        print(f"  {label:<10} {value}")

    print("grepbot context check")
    print(f"  root       {ROOT}")
    line("header",   header_v or "(missing)")
    line("core",     core_v or "(missing)")
    line("artifact", artifact_v or "(missing)")
    line("stamp",    stamp_v or "(missing)")

    if header_v and core_v and header_v != core_v:
        fail.append(f"version drift: header={header_v} core={core_v}")
    if artifact_v and header_v and artifact_v != header_v:
        fail.append(f"version drift: header={header_v} artifact={artifact_v}")
    if stamp_v and header_v and stamp_v != header_v:
        fail.append(f"version drift: header={header_v} stamp={stamp_v}")

    if header_mtime > artifact_mtime:
        warn.append("artifact older than src/header.js — run build.py")

    print()
    if fail:
        for f in fail:
            print(f"FAIL  {f}")
        return 1

    for w in warn:
        marker = "WARN(strict)" if args.strict else "WARN"
        print(f"{marker:14} {w}")
        if args.strict:
            return 1

    print("ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
