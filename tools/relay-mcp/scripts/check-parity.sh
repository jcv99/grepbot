#!/usr/bin/env bash
# Parity check: every relay command declared by GrepBot (src/relay.js) must
# be exposed by the MCP wrapper (tools/relay-mcp/src/commands.ts).
#
# Goal: prove `mcp ⊇ bot ⊇ player(automatable)` (see docs/COVERAGE-2026-08-14.md)
# and fail CI when a new relay command lands without a matching MCP tool.
#
# Exits 0 with no output when parity is 100%. Exits 1 and prints the symmetric
# diff (commands only on the bot side, commands only on the MCP side) otherwise.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BOT_LISTER="${ROOT}/tools/relay-mcp/scripts/list-relay-commands.sh"
MCP_TS="${ROOT}/tools/relay-mcp/src/commands.ts"

BOT_CMDS="$("${BOT_LISTER}")"
MCP_CMDS="$(grep -oE "cmd: '[a-z_]+'" "${MCP_TS}" | sed -e "s/cmd: '//" -e "s/'//" | sort -u)"

BOT_ONLY="$(comm -23 <(printf '%s\n' "${BOT_CMDS}") <(printf '%s\n' "${MCP_CMDS}") || true)"
MCP_ONLY="$(comm -13 <(printf '%s\n' "${BOT_CMDS}") <(printf '%s\n' "${MCP_CMDS}") || true)"

if [[ -z "${BOT_ONLY}" && -z "${MCP_ONLY}" ]]; then
  echo "parity OK: $(printf '%s\n' "${BOT_CMDS}" | wc -l) commands, 100%"
  exit 0
fi

echo "parity FAIL" >&2
[[ -n "${BOT_ONLY}" ]] && { echo >&2; echo "in bot, missing from MCP:" >&2; printf '  %s\n' ${BOT_ONLY} >&2; }
[[ -n "${MCP_ONLY}" ]] && { echo >&2; echo "in MCP, missing from bot:" >&2; printf '  %s\n' ${MCP_ONLY} >&2; }
exit 1