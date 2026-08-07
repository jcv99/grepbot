---
name: run-grepbot
description: Build, syntax-check and headlessly drive the GrepBot Tampermonkey userscript. Runs python3 build.py, node --check on grepbot.user.js, then boots the artifact in headless Chromium over CDP, clicks every panel tab, runs Actions > Preflight, and screenshots each step. Also ships an interactive REPL for poking the live panel. Use when asked to "build the bot", "run/start GrepBot", "smoke-test GrepBot", "screenshot the panel", or to validate a src/ edit before manual in-game testing.
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

This is an **init smoke, not a game smoke**. It proves the concat boots,
the panel mounts and every tab renders. It cannot prove farm claims land
— that needs a logged-in world (see [Manual path](#manual-path)).

Paths below are relative to the repo root.

## Prerequisites

Present on the CachyOS host this was built on; nothing was installed:

```sh
python3 --version   # 3.14.6
node --version      # v22.23.1  (needs >= 22 for global WebSocket)
chromium --version  # /usr/bin/chromium
```

Different chromium binary? `GREPBOT_CHROME=google-chrome-stable node …`.

## Build

```sh
python3 build.py
# built /…/grepbot.user.js (31 modules, v1.5.8)
```

`build.py` is a gated concat: it refuses to write the artifact on a
duplicate top-level declaration across `src/*.js` (everything shares one
IIFE) or on a `node --check` failure, exiting 1 either way.

## Run (agent path)

```sh
node .claude/skills/run-grepbot/driver.mjs
```

Output of a clean run:

```
[driver] build: python3 build.py
built /…/grepbot.user.js (31 modules, v1.5.8)
[driver] artifact OK: 451788 bytes, v1.5.8, node --check clean
[driver] title: SMOKE_OK errors=0
[driver] panel header: GrepBot v1.5.8
[driver] tabs: findings:shown farms:shown world:shown attack:shown quests:shown build:shown overview:shown intel:shown config:shown stats:shown log:shown
[driver] preflight: 30 lines -> /…/data/smoke/1786083523334-preflight.txt
[driver] screenshot: /…/data/smoke/1786083523334-preflight.png
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
6. clicks all 11 tabs, screenshots each, asserts each section unhides
7. opens `Actions > Preflight`, dumps the Stats output to `.txt`
8. fails on any `window.error` / `unhandledrejection` / `console.error`

Artifacts land in `data/smoke/` (no `.gitignore` here — this repo is not
a git checkout; delete the dir when you are done):

```sh
ls data/smoke/
# <epoch>.dom.html  <epoch>-preflight.png  <epoch>-preflight.txt  <epoch>-tab-*.png
```

Exit codes: `0` pass, `1` build/artifact problem, `2` boot or panel
failure (page errors, missing panel, a tab that never showed).

Flags: `--no-build`, `--keep-open` (leave chromium running), env
`GREPBOT_SMOKE_OUT=./tmp-smoke`.

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

Tab ids: `findings farms world attack quests build overview intel config
stats log`.

## Direct invocation (no browser)

For edits confined to a parser (`parse-inline.js`, `spy.js`, `farms.js`)
that don't touch init wiring:

```sh
python3 build.py && node --check grepbot.user.js && grep -n 'function parseFarms' grepbot.user.js
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

- **The panel nav is two levels.** `.gb-nav` groups (Scout / Action /
  Account / System) and `.gb-subtabs` tabs. A sub-tab button **does not
  exist in the DOM** until its group is active, so `querySelector('[data-tab=stats]')`
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
| `panel header: GrepBot v0.0.0` | `GM_info` stub missing or the `fetch` for `@version` was blocked | keep `--allow-file-access-from-files`; check the `GM_info` block in `smoke.html` |
| `tab <id> did not become visible (no-button)` | the sub-tab button never appeared — usually a renamed tab id | check `section[data-tab=…]` in `src/ui.js` and update `TABS` in `driver.mjs` |
| `chromium never wrote DevToolsActivePort` | chromium failed to start (sandbox, missing lib) | the driver prints chromium's stderr; `--no-sandbox` is already set |
| `SMOKE_FAIL errors=N` + JSON dump | the IIFE threw during boot | the dump carries `msg` / `src` / `line` / `stack` against `grepbot.user.js` |
| exit 2 with all tabs `shown` | a `console.error` fired somewhere in the loops | inspect `data/smoke/<epoch>.dom.html`, `<pre id="log">` holds the full capture |

## Files

- `SKILL.md` — this file
- `driver.mjs` — build + CDP smoke + REPL; no npm deps
- `smoke.html` — stub page: `MM`, `ITowns`, `gpAjax`, `Game`,
  `GPWindowMgr`, `$`, `GM_info/xmlhttpRequest/setValue/getValue/addStyle/
  registerMenuCommand`, error capture into `window.__SMOKE_ERRORS__`, and
  a `SMOKE_OK` / `SMOKE_FAIL` verdict stamped into `<title>` after settle
