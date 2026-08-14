#!/usr/bin/env bash
# List every relay command name declared in src/relay.js's RELAY_CMDS table.
# One name per line, sorted, unique. Used by check-parity.sh to enforce
# `mcp ⊇ bot` parity.
#
# Format invariant: RELAY_CMDS = { entries look like
#       <name>: {
# and the closing `};` is at the same indentation as the opening `= {`.
# Multi-line `args: { ... }` blocks inside an entry do not match the regex
# because they are indented deeper than the entry opener.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SRC="${ROOT}/src/relay.js"

# Range: from `RELAY_CMDS = {` to the matching `^    };`. The opening brace
# line is unique (one table), and the closing is the first `^    };` after it.
awk '/RELAY_CMDS = \{/,/^    \};/' "${SRC}" \
  | grep -oE '^      [a-z_]+: \{$' \
  | sed -e 's/^      //' -e 's/: {$//' \
  | sort -u