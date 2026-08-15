# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

GrepBot = Grepolis scout + farm + build + trade + culture + (opt-in) military
automation. One Tampermonkey userscript, built by concatenating `src/` modules
into `grepbot.user.js`. **ToS-breaking** — runs against any `*.grepolis.com`
world; ban risk is user-accepted. HIGH-RISK toggles (recruit, dodge auto, favor,
god spells, support send, resource dump, emergency cave) default OFF.

Current: **v5.2.2**, 50 modules, ~1.1 MB artifact. Everything is coded; the
outstanding work is **manual in-game validation** on `es146`.

**NO SERVER.** No `server.py`, no `127.0.0.1:*`, no `/api/*`, no XPI
self-update, no log relay, no AI command channel. Paste-only: build → install
`grepbot.user.js` in Tampermonkey → Export/Copy from the panel. Never ship an
anticaptcha solver and never reintroduce a phone-home server.

## Repo layout

```
src/                  # 50 feature modules — concat order matters
build.py              # python3 build.py → grepbot.user.js (concat + 4 gates)
.build-stamp.json     # build gate bookkeeping (src hash + last built version)
grepbot.user.js       # built output — paste this into Tampermonkey
grepbot.user.js.prod  # pinned reference build, not the working copy
AGENTS.md             # short orientation for other agents; points here
docs/
  DOCS.md             # concatenated project docs: BACKLOG / ROADMAP / TASKS /
                      # error-patterns. The in-game validation gate list lives
                      # in its `## TASKS.md` section.
  PLANS.md            # every numbered plan (1.x–8.x, "v4 plan N" in code comments)
  REGRESSIONS.md      # bug archaeology + helper detail (read before touching a
                      # subsystem it names)
  AUDIT-*.md          # point-in-time audit reports
  COMBAT-POINTS-PLAN.md
  archive-audits/AUDITS.md
archive/              # nothing here is needed to build or run
  grepbot.user.js.bak # pre-0.5.0 monolithic build (rollback reference)
  src-1.6.9/          # old source snapshot
  split_modules.py    # one-off: re-split the artifact back into src/
  data/               # optional local dumps — findings JSON from Export
  captures/           # saved game page + HAR + grepo-dump (reverse-eng refs)
data/                 # smoke driver output — ephemeral, delete when done
.claude/skills/run-grepbot/  # headless smoke driver + REPL
```

`build.py` MODULES is the source of truth for module order — read it, never
hand-maintain a copy. The order is dependency-driven: `header.js` opens the
IIFE, `core.js` defines shared state/logging/storage/locks/paint,
`planner.js` / `tx.js` / `bridge.js` define the transaction + post layer every
feature posts through, `journal.js` records every exit, then feature modules,
`boot.js` runs setup/teardown, `footer.js` closes the IIFE. Reordering breaks
top-level declarations (one IIFE = one scope).

## Build and install

```sh
python3 build.py
```

Not a blind concat. It refuses to write the artifact when a gate fails:

1. **duplicate top-level declarations** across modules — two modules declaring
   the same `function`/`const` name is a hard redeclare/TDZ failure. Exit 1,
   names both modules.
2. **`node --check`** on the concatenated output (skipped with a warning when
   `node` is missing).
3. **version reminder** — `src/` changed but `@version` in `src/header.js` did
   not → warning (not fatal). State in `.build-stamp.json`.
4. **ASCII artifact** (`ascii_escape_artifact`) — every non-ASCII char in the JS
   body is rewritten to `\uXXXX` (surrogate pairs for astral), so the shipped
   file has zero bytes above 0x7F. Runs before `node --check`, so the check
   validates the bytes that ship. The `==UserScript==` block is **not** JS — TM
   parses it as text, so non-ASCII in `src/header.js` is a hard error instead.

Write UTF-8 in `src/` as normal (`á`, `·`, `—`, `→`). The escape is a build
step, never a source convention.

Every `src/` edit: bump `@version` in `src/header.js` when behavior changes →
`python3 build.py` (gates 1, 2, 4 fatal; exit 1 = artifact NOT written) →
install in Tampermonkey (Dashboard → edit script → paste full file, or drag the
file onto a TM tab). **Never** start a local HTTP server for install/update.

**Pre-edit smoke** (optional, cheap): `node .claude/skills/run-grepbot/driver.mjs`
builds, `node --check`s, boots the artifact in headless Chromium over CDP,
clicks every panel tab, runs Preflight, screenshots each step. Init smoke only —
does not exercise bridge posts. REPL: `… driver.mjs repl`. Detail:
`.claude/skills/run-grepbot/SKILL.md`.

## Tooling and validation

No linter, no test runner, no Node build workflow — **paste-only mode**. Phase 7
removed the parser test harness deliberately. Don't introduce `npm test` /
`eslint` / prettier. If a parser needs verification, eyeball fixtures in
`archive/data/` or log via `gbLog` from the panel. Validation is manual in-game
(`docs/DOCS.md` § TASKS.md), best done with **dry run** ON first.

## Hard rules

Every one of these is a bug that shipped. `docs/REGRESSIONS.md` has the story.

**Posting**
- A check may only block on a value it **actually read**. Unreadable → `blind`
  → log once (`gbLogT`) and let the server be the authority. A guard that goes
  silently dead when a client getter is renamed is worse than no guard.
- Never render an unreadable number as `0` or a fabricated ETA — em dash it.
- Every feature checks preconditions **before** it posts (resources, free queue
  slot, timer elapsed, container not already full). A server rejection costs a
  request-budget slot and a decision-memory strike every cadence.
- All writes go through `bridgePost` / `gameAjaxPost` (→ `txRun`). A new
  transport that bypasses them silently loses dry run, the circuit breaker,
  safe mode, template health, tx dedup, the planner and the journal.
- New write features must be listed in `TX_WRITE_FEATURES` (planner.js) or they
  take the READ path and skip every guard.
- Timeout ≠ retry for an irreversible action. Reconcile instead.
- Never guess game data: action ids, claim option indexes, power ids, research
  prerequisites are **learned** from the player's own traffic or read live from
  `GameData`. Unknown markup = post nothing.
- Never default a divine power id (`call_of_the_ocean` spends favor the user
  never asked for).
- Learned templates are per payload, not per feature key; don't share one
  between features (`supportTpl` ≠ `attackTpl` on purpose).

**Scheduling**
- `orchTick` is the sole econ scheduler. Do not add a per-feature `gbInterval`
  for anything it drives. New features ride an existing loop (`orchTick` 20s,
  `dodgeScan` 5s, `farmTick` 15s, the 10s lock sweep) or a self-rescheduling
  `gbTimeout` chain.
- Locks only: `gbLock` / `gbUnlock` / `gbLocked` + a `GB_LOCK_TTL` entry. Never
  a module-local `*InFlight` boolean.
- Scrape cadence is deadline-based and persisted; stamp the deadline at the
  START of the scrape. Never `setTimeout(scrape, 5min)` (background throttling).

**Rendering**
- Repaint through `gbPaint(host, build, {key})`. Never a bare
  `replaceChildren()` on a timer — that wipes what the user is typing.
- Keyed rows rebuild only when the id **set** changes (membership, not order),
  or a user column-sort is wiped every repaint.
- `innerHTML` goes through `gbLit` (literal only, no `${}`) or `gbSafe`
  (DOMPurify) — never raw with a wire value in it.

**Config / UI**
- A control may move between Config groups but must keep its `data-cfg` value;
  `bindConfig` resolves by `[data-cfg=…]`.
- Pin an explicit `<option value>` when translating a label — two shipped bugs
  submitted the option *text* to the server.

## Architecture

Single-script loop pattern, one IIFE, `gameUw()` → `unsafeWindow`.

**Post layer.** `bridgePost(feature, payload, cb)` /
`gameAjaxPost(controller, …)` → `txRun` (`tx.js`) applies, in order: dry run,
circuit breaker, safe mode, template health, tx dedup, the planner
(`planner.js`, affordability + cost ledger), request budget, captcha breaker.
Posts land as `gpAjax.ajaxPost('frontend_bridge', 'execute', …)`. Both the
gpAjax callback and `gbAjaxWatch` (settled by the XHR spy on `loadend`) race to
settle a post; `settled` dedupes. `txRunAsync` is the Promise wrapper.

**Guards.** Captcha breaker (per-feature 5/15/60min backoff, global
kill-switch, `captcha_required === true` is the real flag); server-pressure bus
(`gbServerCooldown`, 429/503/`Retry-After` → one global cooldown honoured by
`automationPaused`); request budget/min shared by bridge + `gbXhr`; lock
registry with TTL + 10s sweeper (`gbUnlockAll` on `pagehide`/`beforeunload`);
safe mode (blocks high-impact features); dry run (`state.dryRun`, logs the
payload, journals `skip:dryrun`, sends nothing — the way to validate a payload
against a hand-clicked action).

**Decision memory** (`journal.js`). Every post exit — ok, error, captcha,
timeout, every skip — is journaled world-scoped (`state.decisions`, ring 400,
7-day TTL, batched save 5s, flush on pagehide). Identical decision+result inside
10min bumps `n`. Three consecutive *hard* errors on one
`feature|action|target` open a 5/15/60min skip window; later posts short-circuit
as `remembered`. captcha/timeout never trip it (their own breaker owns that).
Transient shortages (`planner-wood:…`, `-tradeCap`, …) journal as `skip:`, not
error (`jrnTransientDynamicResult`). Read API for modules: `jrnFailStreak`.
Toggle `decisionMemory` disables *skipping* only; recording always runs.

**Scheduling.** `orchTick` (20s) is the cadence-aware sole scheduler for econ
features: up to `ORCH_MAX_PER_TICK` (3) due features per tick spaced ~450ms,
±20% cadence jitter, overdue-ness breaks priority ties past 2 ticks, adaptive
backoff doubles a quiet feature's cadence up to 8× (measured by journal entry
count 4s after the run) and resets on the first post. `orchStatus()` feeds
Stats. Off orch: `ibScan` (10s + armed timers), `dodgeScan` (5s, also drives
support + emergency cave), `farmTick` (15s), scrape deadlines, the 10s lock
sweep, `diagnosticsTick`.

**Reads.** `townResState(townId)` (3s memo) is the one warehouse
capacity/fill definition. `gbProbeNum` / `gbProbeAttr` probe a list of
build-specific getter names and keep the first finite number; `gbTownModel`,
`gbTownPop`, `gbPlayerGold`, `gbBuildingLevel`, `gbAfford`
(`{ok, blind, short, detail}`). `gameNow()` for server time.

**UI.** Draggable panel with 3 tab groups / 6 tabs (`TAB_GROUPS` in `ui.js`):
Inicio → Resumen; Militar → Ataques, Inteligencia; Sistema → Ajustes,
Diagnóstico, Registro. Separate windows: Queue Center (header `Colas`), the
native-UI queue panels mounted into the game's own building windows, and
`gbWidget`-registered HUD widgets (drag + geometry persistence + teardown are
solved there — reuse it, don't hand-roll a window). Ajustes = ~300 `data-cfg`
controls in 11 `gbCfgGroup()` `<details>` blocks (General y seguridad /
Recoleccion y aldeas / Construccion e investigacion / Almacen, cueva y comercio
/ Cultura / Ritmo y pausas / Interfaz / Avisos y notificaciones / Diagnostico y
datos / Defensa y militar / Premium y favor — last two flagged `risk`), with a
filter box that hides rows via the `hidden` property (a matched row drags its
`gb-cfg-sub` / `gb-cfg-note` siblings with it). Stats tab renders journal
rollups over 1h/24h/7d plus **Preflight**, which probes every module's read path
(collections present, learned keys `claimTpl` / `ibAction` / `ibActionR` /
`attackTpl` / farm option map, readable capacity, cost reads) and sends nothing.
Log tab = ring buffer 200 + a **Decisions** sub-view.

**Native queue lanes** (`state.nativeQueue`, world-scoped). One root
`{version, seq, towns:{<id>:{build, recruit, recruitNaval, research, paused{},
mode{}}}}` driven by the `nativeQueue*` API. Per lane `mode` is `'legacy'`
(goal planner owns it) or `'fifo'` (virtual list owns it); a manual `[+]` sets
`'fifo'`, "Cola automática" hands it back. Only the HEAD of a lane is ever
posted, so appends are always safe. Barracks and docks are separate lanes
(`recruit` / `recruitNaval`). Each reconciler prunes against the live model —
an unreadable model is UNKNOWN, never "done" — and clears a stuck `inflight`
after 120s into `manualReview`.

**Game-facing plumbing.** `huntCsrf` (5s, first match wins; still needed for
`GM_xmlhttpRequest` report fetching — the gpAjax path signs itself); AJAX spy
(`hookFetch` + `hookXhr`) which also sniffs request bodies on `frontend_bridge`
to *learn* payload templates; `marketLocale()` keyed by `Game.market_id` for DOM
fallbacks only (bridge paths are locale-free).

### Feature map

Read the header comment of a module before editing it — each one states its own
contract, risk class and why a tempting shortcut is forbidden.

| Module | Entry | Toggle (default) | Notes |
|---|---|---|---|
| `farms.js` | `autoClaimFarms`, `farmSleepClaimNow` | `autoFarm` OFF, `farmSleepAuto` OFF | claim option index is **learned** (`farmLearnOptionFromClaim`, snapped to `FARM_DURATIONS`); 10min where villager-loyalty research is done, else 5min; sleep claim once/local day under fill %, day stamped after verified claims |
| `towns.js` / `collect.js` | scrape deadlines, `autoCollectResources` | `collectAll` | collect walks a TreeWalker for `/^\d{1,2}\s*min$/` up to a `Recoger` button, marks `dataset.grepbotClicked` |
| `bandit.js` | `banditViaGame` | `autoBandit` | reward via `hasReward()`→`useReward`/`stashReward`, cooldown via `getCooldownDuration()`, en-route via `MovementsUnits[*].destination_is_attack_spot`; model path needs no window |
| `build-tab.js` / `build-auto.js` / `goals.js` / `build-targets.js` | `ibScan`, `ibCompleteAll`, `abScan` | `ibAuto` OFF, `abAuto` | free instant only when remaining ≤ thresh **and** `GameDataInstantBuy` price === 0; **never** falls back to `buyInstant`; `ibArmNext` arms one timer at `remaining - ibFreeThresh()`; the 10s loop is the safety net |
| `native-ui.js` / `queue-center.js` | `nativeUiScan`, `renderQueueCenter` | — | virtual FIFO beside the game's real queue; mutations only via `nativeQueue*` |
| `cave.js` | `caveScan` | `autoCave` OFF | stash iron ≥ `caveThreshPct`% of warehouse via `BuildingHide`/`storeIron`; ∞ sentinel is `-1`; unreadable finite cap/stored → skip |
| `emergency.js` | `emergencyScan`, `emergencyStashAllNow` | `emergencyCaveAuto` OFF (HIGH-RISK) | pre-stash before a hostile lands; same `caveStoreIron` payload, own lock + feature key; rides `dodgeScan` |
| `culture.js` | `cultureScan` | `autoCulture` OFF | festival/procession/theater via `building_place`/`start_celebration`; olympic is 50 gold + Academy 30 → needs `allowPremiumCulture` + daily `cultureGoldBudget`, never modeled as resources |
| `trade.js` / `transport.js` / `dump.js` | `tradeScan`, `transportBalanceJobs`, `dumpJobs` | `autoTrade`, `islandShip`, `autoTransport`, `autoDump` OFF (HIGH-RISK) | there is **no** transport endpoint — every inter-city move is `tradeSend`; `transport.js` is the read-only capacity/ETA model (returns `blind`, never a fabricated number); `dump.js` is policy on top |
| `rural.js` | `ruralTradeScan`, `ruralLevelScan` | `autoRuralTrade`, `autoRuralLevel` | `FarmTownPlayerRelation` trade / unlock / upgrade; per-relation cooldown + destination-capacity checks required |
| `research.js` / `research-graph.js` | `researchScan`, `researchGraph*` | `autoResearch` | graph is **read-only** over live `GameData.researches` — no static id table; absent data = `blind`, never "no prerequisites" |
| `phoenician.js` | `ptTradeScan` | `autoPtTrade` OFF | ratio pump 0.5:1 → `targetRatio`; view URL + payload learned from the player's traffic; parse miss = post nothing; aborts if the ratio doesn't move |
| `merchant.js` / `favor.js` / `god-spells.js` / `wonder.js` | `merchantScan`, `favorScan`, `godSpellScan`, `wonderScan` | all OFF (favor + spells HIGH-RISK) | merchant needs exact item id + explicit price; favor needs `temple_plunder` + farm_town target; spells need an operator-typed power id; wonder day from `gameNow()` |
| `dodge.js` | `dodgeScan` (5s) | `dodgeMode` `'notify'` (`'auto'` HIGH-RISK), `autoMilitia` OFF | hostile-only canonical types (`is_attack` / attack command names), never `incoming`/`started_at` alone; militia is its own toggle + captcha feature; never dodge into a town that itself has incoming |
| `support.js` | `supportScan` | `supportCfg.auto` OFF (HIGH-RISK) | own `supportTpl`, confirm gate per destination, own lock + captcha key; rides `dodgeScan`, only arms for movements dodge didn't act on |
| `recruit.js` | `recruitScan` | `autoRecruit` OFF (HIGH-RISK) | controller resolved from unit metadata (barracks/docks/temple); unknown unit cost blocks |
| `attack.js` / `military.js` / `shared-plan.js` | planner dialog, `sharedPlanImport` | manual confirm only | `attackTpl` learned by `sniffBridgeBody`; town targets only + overdue refuse + 90s arm window; shared plans are **paste-import only**, never fetched, never auto-sent |
| `quests.js` | `questScanTick`, `questAutoClaim` | `questAutoRes`, `questAutoBuild` | auto-claim only when **every** reward is safe; no DOM fallback after a bridge timeout; success after model reconcile |
| `intel.js` | threat board, dossiers | — | player/alliance notes, Grepodata Index+ assist, watchlist matches `f.town.id` |
| `alerts.js` | `alertWebhook` | OFF | optional Discord URL; captcha/attack/culture events, 5min rate-limit |
| `qol.js` | pause-on-activity, night pause, templates, `gbWidget*` | — | config import/export, Overview health |
| `hud.js` | `hudEnsure`, `hudRestore` | `hudProduction`, `hudCountdown` | read-only `gbWidget` widgets; unreadable value = em dash |
| `context-menu.js` | `contextMenuScan` | `contextMenu` | mounts a **sibling** menu beside the game's own town-info popup; intercepts no game event; the map is canvas, so the popup is the only readable anchor |
| `diagnostics.js` | `diagnosticsTick` | snapshots ON, profiler/mem OFF | 6 snapshot slots, 5min, 200 KB budget, **whitelisted** state slices (never a wholesale `state` serialize); rides the 10s lock sweep |
| `stats.js` | Stats tab, Preflight | — | journal rollups + read-path probe; sends nothing |

## UI language

The **panel UI is Spanish** (tabs, buttons, Config labels/tooltips,
placeholders, `flash()`/`confirm()`/`prompt()`, empty states, Overview / Intel /
Stats / Preflight bodies). Resource wording follows the game's Spanish client:
`iron` renders as **plata**.

Deliberately **not** translated — machine surface, not UI:

- `gbLog` / `gbLogT` messages and `diagRun()` output (correlated with
  `docs/DOCS.md` § error-patterns.md and pasted into issues).
- journal result codes (`ok`, `skip:*`, `remembered`, …), feature keys, lock
  names, `data-*` values, ids, CSS classes, storage keys.
- `<option value>` attributes (pin an explicit `value` when translating a label).
- `abAffordScratch` short-strings (`wood 100/200`, `pop 5/10`) — `abEtaMs`
  regex-matches `wood|stone|iron` and `startsWith('pop ')`; only
  `abPlanVerdictLabel` maps them through `AB_RES_ES`.
- DOM fallback needles keyed off the game's own markup (`marketLocale()`,
  `/^\d{1,2}\s*min$/`, the `Recoger` button text).

## Helpers to reach for by name

Detail in `docs/REGRESSIONS.md` § 8. `structuredClone` (state/config
snapshots, not `JSON.parse(JSON.stringify)`); `BOOT_TIMING` (every boot cadence,
frozen — a naked `30000` in `boot.js` is a regression); `txRunAsync`;
`gbLit` / `gbSafe`; `statsYieldToMain`; `gbPaint`; the `gbListen` +
`AbortController` listener bag; `gbWidgetRegister`.

**Coalescers (v5.3.0).** Anything inside a per-item sweep uses the `*Soon` form,
never the bare one: `saveSoon(key, val)` (400ms, flushed by `saveFlush()` from
`releaseLocks` + `__grepbotDispose` — a debounced write with no flush loses the
tail of a sweep on tab exit), `renderFarmsSoon` / `renderWorldSoon` (120ms),
`checkThresholdsSoon` (200ms). The bare `save` / `render*` / `checkThresholds`
stay for click paths that must land now. **`txSave` is deliberately NOT
debounced** — a committed transaction has to be durable before the next tick, or
a crash re-posts an irreversible action.

`renderFarms` / `renderWorld` / `renderTimers` bail on `document.hidden` and on a
hidden hosting `section[data-tab]`; `boot.js` repaints all of them on
`visibilitychange` / `pageshow`, which is what keeps the guard honest.

## Tab visibility

In-app SPA navigation (Reports / World / Farms) keeps the tab visible → no
`setTimeout` throttling. A browser-minimized tab throttles to a ~1min floor —
unavoidable without a service worker, which is why armed timers always keep an
interval as the safety net and `boot.js` re-scans on
`visibilitychange`/`pageshow`.

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
rtk uv run <cmd>        # Compact uv project command output
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->
