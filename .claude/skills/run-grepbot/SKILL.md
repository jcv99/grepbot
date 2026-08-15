---
name: run-grepbot
description: Build, syntax-check and headlessly drive the GrepBot Tampermonkey userscript. Runs python3 build.py, node --check on grepbot.user.js, then boots the artifact in headless Chromium over CDP, clicks every panel tab, opens the Queue Center, runs Actions > Preflight, pushes a real write through bridgePost in dry run, and screenshots each step. Ships an interactive REPL that also reaches the bot's internals (state, planner, txRun, every *Scan) through the __grepbotTest export. Use when asked to "build the bot", "run/start GrepBot", "smoke-test GrepBot", "screenshot the panel", "call a bot internal", or to validate a src/ edit before manual in-game testing.
---

# run-grepbot

GrepBot is a Tampermonkey userscript that lives inside a real Grepolis
session (`*.grepolis.com`). No server, no CLI, no window of its own —
the only runnable surface is the panel it injects into a page.

So the driver **is** the app harness: it builds `grepbot.user.js`, loads
it into headless Chromium against a stub page that fakes the Grepolis
backbone models, then drives the panel over the DevTools protocol —
clicking tabs, running Preflight, capturing screenshots and page errors.

`.claude/skills/run-grepbot/driver.mjs` uses **only** Node 22 built-ins
(`WebSocket`, `fetch`, `child_process`) plus the system `chromium`. No
npm install, no Playwright.

It proves the concat boots, the panel mounts, every tab renders, the
Queue Center opens, and a write survives the whole `bridgePost → txRun`
stack in dry run. It cannot prove a farm claim *lands* — that needs a
logged-in world (see [Manual path](#manual-path)).

Paths below are relative to the repo root.

## Prerequisites

Present on the CachyOS host this was built on; nothing was installed:

```sh
python3 --version   # 3.14.7
node --version      # v22.23.1  (needs >= 22 for global WebSocket)
chromium --version  # Chromium 151.0.7922.108 Arch Linux  (/usr/bin/chromium)
```

Different chromium binary? `GREPBOT_CHROME=google-chrome-stable node …`.

## Build

```sh
python3 build.py
# built /…/grepbot.user.js (50 modules, v5.2.2, 1144 KB)
```

`build.py` is a gated concat. It refuses to write the artifact and exits 1
on any of: a duplicate top-level declaration across `src/*.js` (everything
shares one IIFE), a `node --check` failure, or an unbumped `@version`. It
also ASCII-escapes every non-ASCII char in the JS body (the
`==UserScript==` block stays raw — TM parses it as text).

The version gate is **fatal, not a warning** — `build.py:488` compares a
sha256 of the concatenated `src/` against `.build-stamp.json` and prints:

```
error: src/ changed but @version is still 5.2.2 - bump src/header.js (TM will not auto-update otherwise)
```

This fires on your own unbumped edit **and** when another session edits
`src/` underneath you. Check `ls -lt src/*.js` before you bump: if the
recent mtimes aren't yours, don't touch `@version` — run the driver with
`--no-build` against the existing artifact instead.

## Run (agent path)

```sh
node .claude/skills/run-grepbot/driver.mjs
```

Output of a clean run:

```
[driver] build: python3 build.py
built /…/grepbot.user.js (50 modules, v5.2.2, 1144 KB)
[driver] artifact OK: 1172315 bytes, v5.2.2, node --check clean
[driver] title: SMOKE_OK errors=0
[driver] panel header: GrepBot v5.2.2
[driver] tabs: attack:shown overview:shown intel:shown config:shown stats:shown log:shown
[driver] preflight: 67 lines -> /…/data/smoke/1786747983519-preflight.txt
[driver] screenshot: /…/data/smoke/1786747983519-preflight.png
[driver] test exports: 121
[driver] queue center: build:shown research:shown barracks:shown docks:shown
[driver] arm: armed host="" dryRun=true
[driver] dry-run post: res=dryrun journal=skip:dryrun
[driver] PASS — artifacts in /…/data/smoke
```

Steps, in order:

1. `python3 build.py` (skip with `--no-build`)
2. header sanity + artifact `@version` must equal what the build
   reported — with `--no-build` it must equal `src/header.js`, which is
   the stale-artifact check
3. `node --check grepbot.user.js`
4. chromium `--headless=new` on `smoke.html`, driven over CDP
5. asserts `#grepbot-panel` mounted and its header reads the built version
6. clicks all 6 tabs (`attack` `overview` `intel` `config` `stats`
   `log`), screenshots each, asserts each section unhides
7. opens `Actions > Preflight`, dumps the Stats output to `.txt`
8. asserts `window.__grepbotTest` published >50 internals
9. opens the Queue Center (`Colas`) and walks its 4 lanes
10. arms dry run, pushes `bridgePost('farm', …)` through the real
    `txRun` stack, asserts it returns `dryrun` and journals
    `skip:dryrun` — a write path exercised end to end, sending nothing
11. fails on any `window.error` / `unhandledrejection` / `console.error`

Artifacts land in `data/smoke/` (ephemeral per `CLAUDE.md` — delete
the dir when you are done):

```sh
ls data/smoke/
# <epoch>.dom.html          <epoch>-preflight.png  <epoch>-preflight.txt
# <epoch>-queue-center.png  <epoch>-tab-*.png
```

Exit codes: `0` pass, `1` build/artifact problem, `2` boot or panel
failure (page errors, missing panel, a tab that never showed).

Flags: `--no-build`, `--keep-open` (leave chromium running), `--notest`
(boot exactly as Tampermonkey does — no `__grepbotTest`, so the write-flow
step is skipped, not failed), env `GREPBOT_SMOKE_OUT=./tmp-smoke`.

### REPL — poke the live panel

```sh
node .claude/skills/run-grepbot/driver.mjs repl
```

Reads commands on stdin, so it pipes cleanly:

```sh
printf 'tab config\ntext #grepbot-panel section[data-tab=config]\nss cfg\nerrors\nquit\n' \
  | node .claude/skills/run-grepbot/driver.mjs repl --no-build
```

| command | effect |
|---|---|
| `tabs` | list tab ids |
| `tab <id>` | switch tab (handles the group nav); prints `shown` / `no-button` |
| `click <selector>` | `querySelector(sel).click()` |
| `text <selector>` / `html <selector>` | innerText / outerHTML, 4k cap |
| `eval <js>` | evaluate an expression in the page |
| `ss [name]` | screenshot to `data/smoke/<name>.png` |
| `errors` | dump `window.__SMOKE_ERRORS__` |
| `preflight` | run `Actions > Preflight`, print the Stats output |
| `queues [lane]` | open the Queue Center; lane = `build research barracks docks` |
| `cfg <key> [value]` | read/set a `[data-cfg=<key>]` control, firing `change`+`input` |
| `api [substr]` | list `__grepbotTest` exports, filtered |
| `arm` | enable this host + dry run — **every write needs both** |
| `post <feature> <json>` | `bridgePost` through the real `txRun` stack |
| `call <name> [json-args]` | invoke any export |
| `journal [n]` | last n decision-memory entries |

Tab ids: `attack overview intel config stats log` (six, in nav order;
matches `TABS` at `driver.mjs:48` and `TAB_GROUPS` at `src/ui.js:289`).
Queue Center lanes are `QTABS` at `driver.mjs:50`.

## Direct invocation — `window.__grepbotTest`

The bot is one sealed IIFE: nothing is on `window` in normal Tampermonkey
execution. But `src/boot.js:193` publishes **121 internals** —
`state`, `bridgePost`, `txRun`, `planner*`, `nativeQueue*`, `orchTick`,
every `*Scan` — on `window.__grepbotTest` when `__grepbotTestMode === true`
was set **before the IIFE evaluated**. `smoke.html:110` does that, so the
REPL has it. This is the path for a PR that touches one internal function.

```sh
printf 'api planner\ncall nativeQueueTown 7\ncall ibSafeFreeThresh\nquit\n' \
  | node .claude/skills/run-grepbot/driver.mjs repl --no-build
# plannerSnapshot plannerAvailable plannerEffect plannerCanReserve
#   plannerHold plannerRelease plannerCommit
# {"build":[],"recruit":[],"recruitNaval":[],"research":[],
#  "paused":{...},"mode":{"build":"legacy",…}}
# 290
```

`call` splices its argument straight into an argument list, so it takes
JSON: `call gbLocked "farm"` → `false`. A missing name prints
`no such export`; a `Promise` return is awaited.

### Driving a real write in dry run

```sh
printf 'arm\npost farm { town_id: 7, x: 1 }\njournal 1\nquit\n' \
  | node .claude/skills/run-grepbot/driver.mjs repl --no-build
# armed host="" dryRun=true
# {"res":"dryrun"}
# [ { "ts": …, "f": "farm", "a": "/", "k": "farm:7:undefined:undefined",
#     "r": "skip:dryrun", "n": 1 } ]
```

`arm` is not optional and not cosmetic — see the two gates in Gotchas.

For a pure-parser edit that touches no init wiring, the cheap check is
still just:

```sh
python3 build.py && node --check grepbot.user.js
```

## Manual path

Real in-game run — the only way to validate anything that posts:

1. Tampermonkey → Dashboard → edit the GrepBot script → paste the whole
   `grepbot.user.js`.
2. Load `https://<world>.grepolis.com/…` logged in.
3. Panel anchors top-right. Turn on `Dry run` in Config first: it makes
   `bridgePost` / `gameAjaxPost` log the payload and send nothing, which
   is how `docs/TASKS.md` gates are meant to be walked.

There is no scriptable path to this from a container — Grepolis is
auth-gated.

## Gotchas

- **A write needs TWO preconditions that are both false on the stub, and
  they fail in a way that looks like success.** `txRun` bails `'disabled'`
  unless `state.enabledHosts[location.host] === true` (`hostEnabled()`,
  `src/bridge.js:604`) — and on a `file://` page `location.host` is the
  **empty string**, which `ensureHostDefault` seeds to `false`. A post then
  journals `skip:disabled` and never reaches the dry-run gate, so you get a
  clean-looking result that proved nothing. Second: `if (write &&
  state.dryRun)` at `src/tx.js:533` only fires when the feature key is in
  `TX_WRITE_FEATURES` (`src/planner.js:259`). Posting `farmClaim` instead of
  `farm` takes the READ path — no dry run, no planner, no dedup — and on
  this stub it lands on the fake `gpAjax` and resolves `timeout` ~10s later.
  `arm` fixes the first; use an exact key from that Set for the second.
- **The panel nav is two levels.** `.gb-nav` groups (`Inicio` /
  `Militar` / `Sistema` — `TAB_GROUPS` at `src/ui.js:289`) and
  `.gb-subtabs` tabs. A sub-tab button **does not exist in the DOM**
  until its group is active, so `querySelector('[data-tab=stats]')`
  returns null from a cold start. Walk the group buttons first — that's
  what `selectTabExpr()` in the driver does.
- **`GM_info` must be stubbed or the panel lies about its version.**
  `runningVersion()` (src/core.js) falls back to `'0.0.0'`, so the header
  renders `GrepBot v0.0.0` and no stale-artifact check can ever fire.
  `smoke.html` `fetch`es the artifact, scrapes `@version` out of the
  metadata block, and patches `GM_info.script.version` *before* injecting
  the `<script>`.
- **Never stub bot-internal functions on `window`.** The old `smoke.html`
  set `window.scrapeInboxDom = () => {}` and three siblings, believing the
  v0.6.0 module split had dropped them. It hadn't (they're at
  `src/spy.js:114`, `src/farms.js:151`, `src/ui.js:1565`, `src/ui.js:1582`)
  — and it could not have helped if it had: the whole bot is one IIFE, so
  a `window.foo` assignment cannot shadow a missing inner declaration. The
  stubs were removed; the smoke still passes.
- **`chromium --screenshot=` is single-shot and cannot click.** Driving
  the panel needs `--remote-debugging-port` + CDP over the DevTools
  WebSocket. Node 22 has global `WebSocket` and `fetch`, so this needs no
  dependency at all.
- **Use `--remote-debugging-port=0`,** then read the real port from the
  first line of `<user-data-dir>/DevToolsActivePort`. A fixed port
  collides the moment two runs overlap.
- **Both `--allow-file-access-from-files` and `--disable-web-security`
  are required.** Without them the `file://` SOP reduces every throw
  inside the userscript to a bare `"Script error."` with no filename or
  line, and the `fetch(grepbot.user.js)` that feeds `GM_info` fails.
- **Preflight reporting `x` on every row is the expected result here.**
  The stub has no towns, no csrf, no learned templates. Preflight is a
  read-only probe — it sends nothing — so it is safe in the smoke; you
  are checking that it *runs and renders*, not that it passes.
- **`@version` can move under you.** If another session is editing
  `src/`, `src/header.js` may be bumped between build and check. The
  driver therefore compares the artifact to the version `build.py`
  printed, never to a fresh re-read of `src/header.js` (it re-reads only
  under `--no-build`, where that comparison is the point).
- **`__grepbotTestMode` must be set before the `<script>` is appended,
  not after.** `src/boot.js:193` reads it once, during boot. `smoke.html`
  sets it in the stub block near the top, well ahead of the
  `fetch(…).then(append <script>)`. Set it late and `window.__grepbotTest`
  is simply `undefined` with no error anywhere — the smoke's
  `test exports:` assertion exists to catch exactly that.
- **`__grepbotTest` is the smoke's one deliberate divergence from
  production.** Under Tampermonkey the flag is never true and the export
  block never runs. `--notest` turns it off (the driver appends `?notest`
  to the `file://` URL) if you need the production-identical boot path;
  verified, the panel still mounts with 0 page errors and 0 exports.
- **The Queue Center renders empty here and that is a pass.** Its four
  lanes read `ITowns` / `MM` collections; the stub returns no towns, so
  every lane shows its empty state. The smoke asserts the window *opens
  and switches lanes*, not that it lists jobs. Same reasoning as Preflight.
- **Config counts, if you are touching `bindConfig`:** 160
  `[data-cfg]` controls in 11 `<details>` groups, 62 `.gb-cfg-row`s
  (not every control lives in a row). The filter box is `.gb-cfg-filter`
  and hides rows via the `hidden` property — typing `cueva` leaves
  2 of 62 visible. It listens on `input`, not `change`, which is why the
  REPL's `cfg` fires both.
- **The screenshot is the panel over a black stub page**, not Grepolis.
  No map, no town list, no inbox — those come from the live game DOM.
- **No linter, no test runner, no npm.** Paste-only mode by design;
  the parser test harness was deliberately removed in Phase 7. Don't add
  `npm test` / eslint / prettier. Validation is dry-run + `docs/TASKS.md`
  in-game on `es146`.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `build.py exited 1` + `duplicate top-level declarations` | two `src/*.js` declare the same `function`/`const`; one IIFE, so it's a redeclare/TDZ crash | rename one; the message names both modules |
| `node --check failed` | syntax error in `src/` | the reported line is in the concatenated artifact — map it back by module offset |
| `artifact @version X != expected Y` | `grepbot.user.js` is stale relative to `src/header.js` | `python3 build.py` |
| `error: src/ changed but @version is still X` + exit 1 | fatal version gate (`build.py:488`) — your edit, or a concurrent session's | `ls -lt src/*.js`; bump `src/header.js` only if the edits are yours, else `--no-build` |
| `panel header: GrepBot v0.0.0` | `GM_info` stub missing or the `fetch` for `@version` was blocked | keep `--allow-file-access-from-files`; check the `GM_info` block in `smoke.html` |
| `tab <id> did not become visible (no-button)` | the sub-tab button never appeared — usually a renamed tab id | check `section[data-tab=…]` in `src/ui.js` and update `TABS` in `driver.mjs` |
| `chromium never wrote DevToolsActivePort` | chromium failed to start (sandbox, missing lib) | the driver prints chromium's stderr; `--no-sandbox` is already set |
| `SMOKE_FAIL errors=N` + JSON dump | the IIFE threw during boot | the dump carries `msg` / `src` / `line` / `stack` against `grepbot.user.js` |
| exit 2 with all tabs `shown` | a `console.error` fired somewhere in the loops | inspect `data/smoke/<epoch>.dom.html`, `<pre id="log">` holds the full capture |
| `window.__grepbotTest has 0 keys` | `__grepbotTestMode` wasn't `true` when the IIFE ran, or the export block moved | check `smoke.html:110` and the gate at `src/boot.js:193` |
| `api` prints `(none — is __grepbotTestMode set?)` | same as above, from the REPL | — |
| `post` returns `skip:disabled` | you skipped `arm`; `hostEnabled()` is false for the stub's empty `location.host` | run `arm` first |
| `post` hangs ~10s then returns `timeout` | feature key isn't in `TX_WRITE_FEATURES`, so it took the READ path to the fake `gpAjax` | use an exact key from `src/planner.js:259` |
| `call …` prints `no such export` | the name isn't in the `__grepbotTest` object | `api <substr>` to find the real one |
| `cfg <key>` prints `no such data-cfg` | control renamed, or it's in a group that isn't rendered | `tab config` first, then grep `data-cfg=` in `src/ui.js` |

## Files

- `SKILL.md` — this file
- `driver.mjs` — build + CDP smoke + REPL; no npm deps
- `smoke.html` — stub page: `MM`, `ITowns`, `gpAjax`, `Game`,
  `GPWindowMgr`, `$`, `GM_info/xmlhttpRequest/setValue/getValue/addStyle/
  registerMenuCommand`, `__grepbotTestMode` (line 110), error capture into
  `window.__SMOKE_ERRORS__`, and a `SMOKE_OK` / `SMOKE_FAIL` verdict
  stamped into `<title>` after settle
