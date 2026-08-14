# GrepBot relay MCP wrapper

Local-only MCP server that wraps GrepBot's `ws://127.0.0.1:8731` relay
(`src/relay.js` in the bot). Speaks MCP over stdio, listens on the
loopback, exposes every relay command as an MCP tool.

## Wire contract

```
MCP (stdio)     <->   this server   <->   WS 127.0.0.1:8731   <->  GrepBot tab
```

The bot dials in from `src/relay.js` (uses an outbound WebSocket, opens
the connection itself). This server only accepts that single connection.

Per-tool call:

1. Caller invokes an MCP tool like `gbStatus`.
2. Server sends `{type:'command', id, cmd:'status', args:{}}` on the WS.
3. Bot runs its own gate ladder (`relayCommands` -> `relayRaw` -> arm
   window -> per-hour write cap -> per-call min-gap). Refusals round-trip
   as a result with `ok:false`.
4. Bot replies `{type:'result', id, cmd, ok, data?, error?, gate?}`.
5. Server returns the JSON to the MCP caller.

A call whose reply never arrives rejects with `relay-timeout:<cmd>`
after 30s. The bot's own relay-timeout is 25s; we wait a bit longer to
catch late results that follow a server-side retry.

## Build

```sh
cd tools/relay-mcp
npm install
npm run build
```

Output: `dist/index.js`. The `.mcp.json` and `.kimi-code/mcp.json`
already point here.

## Run

Direct (for debugging):

```sh
GREPBOT_RELAY_URL=ws://127.0.0.1:8731 node dist/index.js
```

Through Claude Code or Kimi: the MCP server is auto-loaded once
`.mcp.json` (repo root) or `.kimi-code/mcp.json` declares it. Check the
host agent's tool list -- `gb*` tools should appear.

## Tools

- 1 `gbListTools` (local, no bot contact) -- lists every relay tool and
  its JSON Schema.
- 1 `gbManifest` per relay `manifest` (ask the bot) -- includes the
  runnable command set as the bot sees it.
- `gbStatus`, `gbSnapshot`, `gbUnits`, `gbTown`, `gbIncoming`,
  `gbOutgoing`, `gbQueues`, `gbPlan`, `gbSimulate`, `gbIntel`,
  `gbJournal`, `gbPreflight` -- reads.
- `gbArm`, `gbDisarm` (arm window) + writes (`gbAttack`, `gbSupport`,
  `gbCancel`, `gbDodge`, `gbClaimFarms`, `gbCave`, `gbTrade`, `gbRural`,
  `gbQueueAdd`, `gbQueueRemove`, `gbQueueMove`, `gbQueueMode`,
  `gbResearch`, `gbRecruit`, `gbCulture`, `gbSpell`, `gbHero`,
  `gbInstant`, `gbQuest`, `gbSetTarget`, `gbToggle`, `gbKick`,
  `gbPanic`, `gbRecover`).
- Raw (`gbBridge`, `gbAjax`) -- require `state.relayRaw === true` in the
  bot. Default OFF.

Total: `gbListTools` + `commandCount()` (currently 38).

## Agent rules

- Confirm a tab is connected (`gbStatus` -> world resolvable) before any
  tool call. The server is useless otherwise.
- Writes need the arm window OPEN. `gbArm` only EXTENDS a live window.
  A truly cold start requires the human to arm from the bot UI.
- Master toggles (`relayCommands`, `relayRaw`, `enabledHosts`,
  `captchaGlobalKill`) cannot be flipped from MCP -- they stay in the
  tab's Config.
- Honour `state.dryRun` (set in the bot). The relay forwards it as a
  journal `skip:dryrun`; posts are not made.
- After a high-risk tool call, log the result envelope. Decision memory
  lives in the tab.

## Local-only

Port defaults to 8731 and binds to `127.0.0.1`. Override with
`GREPBOT_RELAY_URL`. Do NOT bind to `0.0.0.0` -- the bot has no auth and
would be wide open on the LAN.
