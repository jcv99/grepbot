# GrepBot Code Improvement & Optimization Audit

**Date:** 2026-08-14
**Scope:** `src/` (~50 modules, ~25,000 lines of concatenated artifact, ~1.2 MB), `build.py`, `header.js`, `CLAUDE.md`, `docs/`.
**Method:** parallel swarm of four read-only investigation agents (code-quality, performance, architecture, out-of-the-box) over the working tree at `git` HEAD. No profiler was run against a live game tab — perf cost figures are static-analysis estimates.
**Goal:** collect concrete, actionable improvements grouped by area, with file:line citations and quick-wins at the top so the next commits have a clear queue.

> Companion to `docs/AUDIT-2026-08-13.md` and `docs/AUDIT-2026-08-13-PLAN.md`. Where this audit overlaps those, this one supersedes for the listed items.

---

## TL;DR — the 9 things to do first

In rough order of "effort ÷ impact" (smallest patches first):

1. ~~**`src/spy.js:87-107`** — attach the XHR `load` listener only when the URL matches a report/quest pattern.~~ **Done (v5.3.0)** — `SPY_LOAD_GATE_RE`.
2. ~~**`src/farms.js:1020-1023`** and **`src/towns.js:138-167`** — debounce the per-village cascade.~~ **Done (v5.3.0)** — `saveSoon` / `renderFarmsSoon` / `renderWorldSoon` / `checkThresholdsSoon`, flushed by `saveFlush()` on pagehide.
3. ~~**`src/boot.js:70` + `src/ui.js:3104`** — `document.hidden` / hidden-section guards on `renderTimers` / `renderFarms` / `renderWorld`.~~ **Done (v5.3.0)**, with `boot.js` repainting on `visibilitychange`/`pageshow`. **Correction to this item:** the O(N²) `renderFarms` repaint it describes cannot be happening — `.farms-list`, `.world-list`, `.world-totals` and `#gb-sleep-status` are absent from the panel markup in the current tab set, so `renderFarms`/`renderWorld`/`renderSleepStatus` early-return on every call. Whether those tables should come back is a product decision, not a perf fix.
4. ~~**`src/relay.js:390, 1098-1099, 1126`** — route the relay's raw timers + socket through `gbInterval`/`gbTimeout`/`gbXhrBag`, and close the socket in `__grepbotDispose`.~~ **Done (v5.0.0).** The relay module and the MCP wrapper (`tools/relay-mcp/`) were removed; raw timers + WebSocket in the bot are gone with them.
5. ~~**`src/context-menu.js:134-160`** — skip the 750 ms poll when `document.hidden`.~~ **Done (v5.3.0).** The "only on popup appear" half is still open.
6. ~~**`src/qol.js:134-156`** — register `Ctrl+Shift+Backspace` as a panic key.~~ **Done (v5.3.0).** Required fixing `gbKeyFingerprints`, which rejected every Alt binding and every named (non-printable) key — see `docs/REGRESSIONS.md` §8.
7. ~~**`src/ui.js:449-740`** — add `:focus-visible`, `prefers-reduced-motion`, `forced-colors` blocks.~~ **Done (v5.3.0).**
8. ~~**`src/ui.js` (status pill in `updateStatus`)** — render `reqBudgetByScope` + `captchaGlobalUntil` countdown.~~ **Done (v5.3.0)** — `req:<scrape>/<read>/<action>·<cap>` (hidden while all-zero) and `||ALL:<mm:ss>`; soft delay added to the tooltip.
9. **`src/collect.js:222-228`** — **partly moot.** The `attributeFilter` carries no `class`/`style` today (verified at v5.2.5), so the animation-frame storm this described does not happen. Hoisting `GB_OWN_SEL`/`ownEl` out of the per-record callback is still open.
10. ~~**`src/stats.js:1076-1115` + UI** — discoverable `bundleCopy` / `bundleDownload`.~~ **Already done** (buttons at `src/ui.js:1652-1655`); the `Ctrl+Shift+B` default bind landed in v5.3.0.

---

## 1. Code Quality

### 1.1 Empty `catch (_) {}` everywhere

- **513 occurrences across 48 files** — severity **high** for the bulk; **medium** for the ones that have a reason.
- Examples with **no logging and no reason**:
  - `src/boot.js:7` — `try { ensureDomObserver(); } catch (_) {}` swallows observer-init errors.
  - `src/boot.js:52-67` — eight `catch (_) {}` in the visibility/pageshow handler.
  - `src/boot.js:142-153` — ten of them in `releaseLocks`, every error silenced.
- **Fix:** introduce a `safeTry(fn, fallback, tag)` helper that logs via `gbLogT('catch-' + tag, 60000, String(e).slice(0, 80))` and migrates the silent ones; add `// LINT: intentional silent` comments on the keepers (e.g. the ones around idempotent `save()` retries).
- **Specific exceptions to consider fixing in place**:
  - `src/core.js:1281` `gbGameDataLookup` returns `null` for both "game not loaded yet" and "key missing" — replace with `{ found: false, reason: 'no-game'|'no-key'|'no-table' }` so callers can distinguish.
  - `src/core.js:223` `gbAddStyle` — `catch (_) { return null; }` then falls through to a `querySelectorAll` fallback that hides which engine failed.
  - `src/parse-inline.js:213, 219` `parseBodyLoose` has nested `try { JSON.parse(...) } catch (_) {}` patterns that hide the difference between "bad JSON" and "no body".

### 1.2 Magic numbers and tunables scattered across modules

- 5 files each own one of the same-shape cadences; cross-file references rely on concat order:
  - `ORCH_MS` → defined `src/qol.js:860`, consumed `src/orchestrate.js:124,149,152,204` and `src/boot.js:127`.
  - `IB_CHECK_MS` → defined `src/bandit.js:409`, consumed `src/boot.js:92`.
  - `DODGE_CHECK_MS` → defined `src/wonder.js:285`, consumed `src/boot.js:120`.
  - `QUEST_SCAN_MS` → defined `src/intel.js:1180`, consumed `src/boot.js:77` (scanner lives in `src/quests.js:466`).
  - `TX_WRITE_FEATURES` / `TX_TERMINAL_TTL` / `TX_UNKNOWN_MAX_MS` / `TX_INSTANT_TOMBSTONE_TTL` → defined `src/planner.js:259-273`, consumed `src/tx.js:541,15-16`, `src/journal.js:64`, `src/relay.js:996`.
- **Fix:** co-locate each constant with its primary consumer, or centralise into a single `src/tunables.js` loaded first in `MODULES`.

### 1.3 Repeated patterns begging for a utility

- The "try + swallow + log + return fallback" pattern is everywhere; needs `safeTry` (see §1.1).
- Per-feature DOM scraping follows the same `querySelector → closest(GB_OWN_SEL) → check class → return` recipe in `farms.js`, `collect.js`, `bandit.js`, `build-tab.js`. A `scrapeEl(root, selector, transform)` would cut ~150 LOC.
- `Object.assign({}, state.X, …)` to "clone" state fragments appears in 6+ places and does **not** deep-clone; either accept that or use `structuredClone`.

### 1.4 Comment quality

- Comments are generally very good (lots of `// why:` notes) but two classes of staleness spotted:
  - `src/ui.js:1` says `state.tabFilters` was v1.5 and unused — `tabFilters()` at `:3` now uses it but `STORE.TAB_FILTERS` (`src/header.js:233`) is still not in `WORLD_SCOPED_BASES`.
  - `src/relay.js:42` reads `u.__gbState` but nothing writes it; the surrounding comment ("Same escape hatch planner.js uses") is misleading.
- **Fix:** audit comments against current behaviour as part of each module's next edit.

### 1.5 Input validation on entry points

- `bridgePost(feature, payload, onDone)` (`src/bridge.js:263-269`) does not validate `feature ∈ TX_WRITE_FEATURES`; a typo would silently bypass the planner.
- `gameAjaxPost(feature, controller, action, data, onDone)` (`:271-…`) has the same gap.
- GM_xmlhttpRequest callbacks pass `this.responseText` straight into `tryParseJson` without checking `this.status`.
- **Fix:** add a `gbRequireFeature(name)` guard at the top of each public entry.

### 1.6 MutationObserver hygiene

- `src/collect.js:222-228` global observer with `attributes` filter — `style` mutations fire on every CSS animation frame the game runs (e.g. timer countdowns). Drop `'style'` unless a feature actually reads it.
- `src/quests.js:508-513` — subscribes to `attributes` with `attributeFilter: ['class', 'style']` on the quest subtree; same `style` problem.
- `src/qol.js:83-87` — every registered widget installs its own `mousemove` handler. Consolidate into one document-level listener.

### 1.7 Dead code to delete

- `src/relay.js:42` — `getState()` and `__gbState` (the read site is the only mention in the tree).
- `src/core.js:1795-1802` — `I18N` is a 6-language × 3-string dictionary that no UI string ever calls. Either commit to i18n or delete.
- `src/parse-inline.js:1-259` — leaf module with no `state`, no `GM_*`, no relay interaction; check whether anything actually imports it, otherwise expose as `__grepbotParseReport` for the MCP.
- `data/smoke/` — `.dom.html` + PNG fixtures, but no JS to drive assertions. Either revive a runner or document the "no tests" policy in `CLAUDE.md`.

### 1.8 Browser API usage

- Uses `new RegExp(...)` rebuilt per call in several hot paths (§2.4 perf).
- `new URLSearchParams(text)` used as a JSON-or-form fallback (`src/parse-inline.js:213, 219`) but the failure mode returns `{}` rather than the raw text — fine, but undocumented.
- No deprecated API usage spotted, but `unsafeWindow` accessors (`src/core.js:1428-1457` `uwCached`) and `MM.getOnlyCollectionByName` (`:1437-1457`) cache across page lifecycle and can mask a collection swap (§2.6 perf).

---

## 2. Performance

> Static analysis only — no live profiler. Cost figures are order-of-magnitude estimates.

### 2.1 Hot-path timers

| # | Location | Severity | Problem | Fix |
|---|---|---|---|---|
| 1 | `src/boot.js:70` + `src/ui.js:3104` | **high** | `gbInterval(renderTimers, 1000)` runs forever, calling `farmClaimTiming()` → `farmsFromGame()` → rebuild + `JSON.stringify` every second regardless of tab focus. | Early-return on `document.hidden` / `section[data-tab=farms].hidden`; cache `farmClaimTiming()` for ~5 s. |
| 2 | `src/farms.js:166` | medium | `farmClaimTiming()` refetches the whole relation collection instead of accepting `state.farmsParsed`. | Pass `state.farmsParsed` from `renderTimers`; only refresh on the 15 s `farmTick`. |
| 3 | `src/bandit.js:381-406` | medium | `banditScheduleNext()` re-arms a **1.5 s** self-chaining timer; each pass calls `txPrune()` (full walk + `txSave()` if anything changed). | Raise the idle floor to 5–10 s; move `txPrune` to the existing 10 s sweep (`src/boot.js:141`). |
| 4 | `src/boot.js:120` + `src/wonder.js:285` | medium | `DODGE_CHECK_MS = 5000`; `dodgeScan` only bails when dodge **and** CS-alert **and** militia are all off, but `csAlert` defaults on. `dodgeIncomingMovements()` allocates a `Set` per pass. | 15 s when only the read-only CS alert is on; memoize the own-town `Set` per `uwCached()` window. |
| 5 | `src/context-menu.js:134-160` | **high** | `contextMenuScan` re-arms every `CTX_SCAN_MS = 750` ms, each pass does `querySelectorAll` + `getBoundingClientRect` per node + `elementFromPoint` — three forced style/layout flushes 80×/min, no `document.hidden` guard. | Skip when hidden; drive from the existing MutationObserver; run `ctxHitCheck()` once per menu build. |
| 6 | `src/boot.js:96-113` | medium | The 5 s loop calls `scheduleNativeUiScan()` unconditionally ("ungated" by design). | Gate on `document.querySelector('.window_content,.gpwindow_content,#unit_order')` being non-null. |
| 7 | `src/qol.js:105` | low | A widget's tick interval is created on `open()` but `close()` (`:107`) only sets `display:none`; the interval keeps firing. | `gbClearInterval(timer); timer = 0;` inside `close()`. |
| 8 | `src/core.js:24-33` | low | `gbInterval` adds no jitter — 14+ intervals land on aligned 1/5/10/15/30/60 s boundaries; ~8 callbacks in the same frame every 30 s. | Add a small random phase offset (`setTimeout(rand, 0..ms)`) before the first tick. |

### 2.2 DOM thrash on render paths

| # | Location | Severity | Problem | Fix |
|---|---|---|---|---|
| 9 | `src/ui.js:130` | **high** | `renderFarms()` has **no** `sec.hidden` guard; calls `farmProfitRefresh()`, builds a full cells array per farm and runs `tbody.querySelector('tr[data-key=…]')` **inside the per-farm loop** (`src/ui.js:151`) — O(N²) selector work over a table nobody is looking at. | Hidden guard + replace per-row `querySelector` with a `Map` built once from `tbody.children`. |
| 10 | `src/ui.js:185` | medium | `renderWorld()` no hidden guard + `townPopState(t.id)` per town (`:202`); `towns.js` calls it once **per scraped town** (`src/towns.js:138,151,167,195`). | Hidden guard + one `renderWorld()` at the end of the sweep. |
| 11 | `src/farms.js:1020-1023` | **high** | Per village: `save(STORE.FARM_RES, <whole map>)` + `renderFarms()` + `checkThresholds()`. For 40 villages that's 40 full-map serializations + 40 full table repaints + 40 threshold sweeps per 5-min cycle. | Mark dirty + flush once at the sweep's completion handler. |
| 12 | `src/towns.js:138,151,167` | medium | Same pattern for `STORE.TOWN_RES` + `renderWorld()` per town. | Same debounce/flush. |
| 13 | `src/ui.js:3039` | low | `updateStatus` (5 s) calls `Object.values(state.farmResources).filter(...)` twice (`:3045`, `:3047`) plus several scans of circuits/txState before the string-equality short-circuit at `:3089`. | Compute ok/err counts once during the scrape and cache on `state`. |
| 14 | `src/qol.js:83-87` | medium | Every widget installs its own `mousemove`; the drag branch reads `host.offsetWidth/offsetHeight` (layout) then writes `style.left/top` (invalidate) on **every** mousemove. | One shared document listener; cache host size in `mousedown`. |
| 15 | `src/native-ui.js:961-971` | low | `nativeQctlHitCheck` schedules `getBoundingClientRect` + `elementFromPoint` 250 ms after **every** control mount; a Senate with ~20 tiles fires 20 hit tests per rebuild. | Run once per root per scan. |
| 16 | `src/core.js:93-116` | low | `gbPaint` always builds the entire subtree into a detached `<div>` before deciding it is identical — full throwaway tree per second for 1 s queue-center/HUD ticks. | Accept an optional `sig`; skip `build()` when signature is unchanged. |

### 2.3 MutationObserver and DOM scanning

- **`src/collect.js:222-228`** (severity: **high**) — global observer on `document.body` with `childList + subtree + attributes` (12 attribute filters). On the Grepolis map/town view with animations this delivers large record batches continuously; the callback allocates per record (`[...addedNodes, ...removedNodes].filter(...)` + `el.closest(GB_OWN_SEL)` with a 5-selector union). **Fix:** bail above a record-count threshold; hoist `GB_OWN_SEL`/`ownEl` out of the callback; mark GrepBot roots with a `data-gb-root` attribute so ownership is a single attribute read.
- **`src/collect.js:186-208`** (medium) — same callback re-arms three scans for *any* non-own mutation, including the game's text countdown clocks ticking every second. **Fix:** ignore records whose only change is `characterData`/text inside a known timer class, or raise the native-scan debounce from 80 ms to ~250 ms.
- **`src/native-ui.js:1086-1087`** (medium) — `candidates.filter((x,i,a)=>a.indexOf(x)===i)` is O(n²) dedup, then `candidates.filter(x => candidates.some(y => y.contains(x)))` is another O(n²) with `DOM.contains` each. Use `Set` + single ancestor pass.
- **`src/native-ui.js:976`** (**high**) — per building tile, per scan, builds a signature via `JSON.stringify([...jobs.map(...)])` **and** calls `nativeQueueList` / `nativeQueueProjectedBuildLevel` / `nativeQueuePosition`. With the Senate open (~20 tiles) at the 80 ms debounce: up to ~250 `JSON.stringify`/s. **Fix:** cheap numeric/string signature (join of ids + status chars); memoize per-town job list once per scan.
- **`src/quests.js:508-513`** (low) — `attributes` filter includes `'style'`, firing on every CSS animation. **Fix:** drop `'style'`.

### 2.4 Network interception

- **`src/spy.js:87-107`** (severity: **high**) — the XHR `send` hook attaches a `load` listener to **every** game request and, for responses under 100 KB, reads `this.responseText` + `tryParseJson(txt)` — a complete JSON parse of every SPA response. **Fix:** check the URL against report/quest patterns **first**; only attach the listener when it matches. Keep the existing `>100 KB` regex as the fallback.
- **`src/spy.js:191-219`** (**high**) — `scanResponseForReports` walks the whole parsed tree with `Object.entries(obj)` (allocates a pair array per object) with no depth limit or node budget. **Fix:** `for (const k in obj)`, depth cap ~6, visited-node budget ~5000.
- **`src/spy.js:57-71`** (medium) — 6–8 regex `test`/`match` calls run on every XHR URL on the send path (and again on the fetch hook, `:22-27`). **Fix:** one combined pre-filter regex (`/report|quest|farm|collect/i`) as a gate before detailed matching.
- **`src/core.js:1693` `gbXhr`** (medium) — request budget but no in-flight **dedup**: two callers asking for the same `action=farm_town_info&town_id=X` both spend a slot. `src/farms.js:952` walks a guess ladder per village with no memo of which guesses already failed this sweep. **Fix:** keyed in-flight map + per-sweep negative cache.
- **`src/relay.js:399-416`** (medium) — every 15 s the relay rebuilds and sends **six** full snapshots (farms, towns, player, queues, bp, map) with no dirty check, even though `lastSnapshot` is already kept (`:322`, `:404`). `snapshotMap` (`:227-253`) walks 25 map chunks and up to `MAP_TOWN_CAP = 400` towns per tick. **Fix:** diff each kind against `lastSnapshot` (cheap length+hash); drop `map` to 60 s or on-request only.

### 2.5 Storage write amplification and unbounded keys

- **`src/core.js:838-843` `whyNote`** (**high**) — every decision note re-serializes and writes the **entire 200-row** `whyLog` through `GM_setValue`. **Fix:** debounce like `jrnSave` (`src/journal.js:104-115`), flush on `pagehide` via `releaseLocks`.
- **`src/tx.js:1` `txSave`** (**high**) — writes the whole `state.txState` map synchronously at ~8 points in a single transaction lifecycle (`src/tx.js:651,652,655,662,668,670,676,…`). **Fix:** `txSaveSoon()` debounce (250 ms) with immediate flush on terminal transitions and in `txDispose`.
- **`src/intel.js:804-806`** (medium) — `intelWatchlistScan` (15 s) writes `STORE.WATCH_HITS` on **every** pass while a match persists. **Fix:** only save when the previous hit is older than ~5 min.
- **`src/diagnostics.js:45-60`** (medium) — `snapshotBuild` does `JSON.stringify(payload)` → `JSON.parse(text)` (a second full parse purely to deep-clone) → `save(STORE.SNAPSHOTS, ring)`. Snapshots are on by default (`state.snapshotsOn === false` is the only off switch), every 5 min + once on every page exit. **Fix:** store the already-serialized `text` in the slot; per-slot keys if storage layout allows.
- **`src/core.js:1583-1588` + `src/farms.js:280`** (medium, correctness ⇒ perf) — `state.alerted` is shared by farm thresholds (`{key,ts}` keyed by village id) and intel alerts (raw timestamps keyed by movement id, `src/intel.js:868`, `:1165`), but `refreshFarmsParsed` prunes the map down to **farm ids only**. Every refresh deletes all intel dedup entries and re-fires the alerts they suppressed. **Fix:** namespace intel keys into their own store, or prune with a key prefix test.
- **`src/farms.js:273`** (medium) — `refreshFarmsParsed` uses `JSON.stringify(state.farmsParsed)` as a change signature; each row carries both `_attrs` **and** the live Backbone model `_rel` (`:250-251`); `save(STORE.FARMS_PARSED, …)` persists that same duplicated payload. **Fix:** signature from a projection (`vill_id|lootable_at|relation_id`); strip `_rel`/`_attrs` before save.
- **`src/core.js:1531-1544` `loadValueOk`** (low) — `JSON.stringify(v).length` fully serializes every non-string value **on read** just to measure it — 222 times at boot (§2.7). **Fix:** measure strings only; for objects sample `Object.keys().length` or skip.
- **Unbounded-ish keys** (low) — `state.seen` is capped at `SEEN_MAX = 2000` but the overflow path sorts all keys by value (`src/core.js:1384-1388`); `seenThisRun` (`src/spy.js:4`) is a `Set` that grows for the life of the tab with no cap. `state.alerted`, `state.farmResources`, `state.spellCooldown` are only pruned on a quota exception or farm refresh. **Fix:** LRU cap on `seenThisRun` (~5000); add alerted/dodgeReturns TTL prunes to the existing 10 s sweep.

### 2.6 Leaks and instance hygiene

- **`src/relay.js:390, 1068, 1098-1099, 1126`** (severity: **high**) — relay uses **raw** `setInterval`/`setTimeout` and a raw `WebSocket`, none of which are registered in `gbTimerBag`/`gbXhrBag`; `GB_ROOT.__grepbotDispose` (`src/core.js:250`) never touches them. After a hot reload, the old status/tick/ping timers **and** the old socket all survive: N reloads ⇒ N sockets pushing N duplicate snapshot sets every 15 s. `statusTimer` is never cleared at all, even by `clearTimers()` (`:1060-1064`). **Fix:** route all four through `gbInterval`/`gbTimeout`; add `__grepbotRelayDispose` that clears timers and calls `ws.close()`.
- **`src/core.js:250-290` vs 119 raw `addEventListener` call sites** (medium) — only 30 of 149 listener registrations go through `gbListen`. `src/military.js:645-697` and parts of `src/ui.js` re-bind panel-section handlers on paths that can run more than once (`renderAttack()` is called from its own refresh buttons). Sections guarded by `dataset.uxBound` are safe; `military.js` is not obviously guarded. **Fix:** same `dataset.*Bound` idiom in `renderAttack`.
- **`src/core.js:34-45`** (low) — `gbTimeout` removes its entry with `gbTimerBag.indexOf(entry)` (O(n)) on every fire; with wake queue + per-village scrape chains + per-job timers, the bag can hold hundreds, making teardown quadratic in bursts. **Fix:** store the bag index on the entry, or use a `Set`.
- **`src/core.js:1428-1457`** (low) — `_uwCache` (400 ms) and `_mmColCache` (400 ms) cache `unsafeWindow` results, but `mmCol` also caches the resolved collection — a successful `MM.getOnlyCollectionByName` never re-resolves even if the collection is replaced. **Fix:** separate `MM_COL_CACHE_MS`; bust on collection mutation.

### 2.7 Startup and artifact size

- **`src/core.js:385-…`** (severity: **high**) — the `state` literal performs **222 synchronous `GM_getValue` calls** at boot; for world-scoped keys on a pre-v3 world, each can do a *second* legacy read (`src/core.js:1515-1519`) — up to ~350 sync storage reads before the panel exists, each paying `loadValueOk`'s `JSON.stringify` (§2.5). **Fix:** one `GM_getValue('grepbot:blob@host')` holding the whole config object with per-key `save()` writing back, or at minimum skip the legacy branch once `CONFIG_VER >= 3` is cached in a single up-front read.
- **`grepbot.user.js` — 1.20 MB / 25 353 lines** (medium) — the dev artifact is parsed on every world page load; `--prod` only strips indentation and blank lines (1.04 MB, `build.py:332-360`) because a real minifier is out of scope. ~25–60 ms parse/compile per tab + a few MB of retained code objects. Every module body executes at boot regardless of which features are on. **Fix (staged):** (a) make `--prod` the documented install path; (b) defer rarely-used modules — `intel.js` (1183 lines), `stats.js` (1115), `attack.js` (996) are pure feature surfaces.
- **`build.py:507`** (low) — concatenates with no size/complexity budget reported. **Fix:** print per-module byte contribution; fail the build above a configured artifact ceiling.

---

## 3. Architecture

### 3.1 Module boundaries & ownership

- **F1 (high)** — `src/core.js:385` declares `const state = { … 200 keys … }`; writes scattered across `src/ui.js:1554`, `src/native-ui.js:19`, `src/diagnostics.js:80`. Nothing declares who owns each key. **Fix:** introduce a `stateApi({ get, set, mutate, persist })` wrapping the literal; treat `state` as private. Module-facing reads go through the api.
- **F2 (medium)** — Top-level tunables live far from their primary module (see §1.2). Same fix.
- **F3 (medium)** — `src/core.js:650` does `const moduleHealth = state.health || {}`, then `:823` writes `state.health = moduleHealth`. Works only because every migration mutates in place. **Fix:** single `getHealth()` helper.
- **F6 (low)** — `gbPaint`/`gbPaintPatch` (`src/core.js:93-158`) and `gbAddStyle` (`:212-248`) are the only DOM-rendering code in core.js. **Fix:** move to `src/ui.js` or a new `src/render.js`; keep core.js DOM-free.
- **F7 (low)** — `state` literal is a 250-line dictionary parsed and executed at every boot (§2.7). **Fix:** split into per-domain blocks (`coreStateBoot()`, `plannerStateBoot()`, …).

### 3.2 Hidden coupling

- **F8 (medium)** — `TX_WRITE_FEATURES` is the de facto feature registry and lives in `planner.js`. Adding a write feature requires editing `planner.js:259-269` + `src/tx.js:270-501` (three trees) + `src/journal.js:64`. **Fix:** lift into a single `tx/` table keyed by feature name with handler objects.
- **F10 (low)** — `gbXhr` (`src/core.js:1693-1774`) decides host gating on `opts.scope`. The cross-origin contract is `@connect` in `src/header.js:17-19` plus a hand-rolled regex `alertWebhookUrlOk` (`src/alerts.js:4-8`). **Fix:** centralise allowed hosts in `core.js` and have `gbXhr` enforce before issuing the request.

### 3.3 Build.py gaps

- **F12 (medium)** — `check_duplicate_decls` (`build.py:432-451`) rejects duplicate `function`/`const`/`let` declarations but doesn't check TDZ-like ordering. `ORCH_MS`, `QUEST_SCAN_MS` etc. work only because the concat order puts the constant before the consumer; nothing enforces it. **Fix:** add a `check_const_order` pass: every `const X = …` must precede every read of `X` in the concatenated text.
- **F13 (medium)** — `MODULES` (`build.py:31-83`) is a 52-entry list with no comments. Reordering breaks at runtime with no error. **Fix:** add an `ARCH.txt` describing dependencies (`X depends on Y`), or compute once and fail on a cycle.
- **F14 (low)** — `--prod` whitespace squeeze still emits the same 1.23 MB. **Fix:** drop `--prod` or alias to a future minifier once one is allowed.
- **F15 (low)** — `node --check` runs on the *stripped* artifact (`build.py:522`); if a source comment contains a string that LOOKS like a comment, the stripper may mis-handle it. **Fix:** run `node --check` on the *source* concatenation too; add a regression fixture.
- **F16 (low)** — `moduleHealth` survives a `__grepbotDispose` reset only because it aliases `state.health`. **Fix:** explicitly null `moduleHealth = null` in `grepbotDispose`; re-read in `markModuleHealth`.

### 3.4 Hot-reload safety

- **F17 (medium)** — `gbDispose()` (`src/core.js:250-290`) does **not** touch `moduleHealth`, `userPausedUntil`, `panicUntil`, `panicNeedsClear`, `captchaGlobalUntil`. `panicNeedsClear` is a sticky latch — if it was true at reload, the new instance boots in `'panic-grace'` and refuses to act until `gbPanicRecover` is called. **Fix:** explicit dispose block for the panic state and `moduleHealth`.
- **F18 (high)** — `hostEnabled()` (`src/bridge.js:571-574`) returns `state.enabledHosts[location.host] === true && gbTabLeader`. Two problems: (a) per-tab `gbTabLeader` means the second tab disables itself entirely; (b) `state.enabledHosts` is global (not world-scoped — `STORE.ENABLED_HOSTS` is not in `WORLD_SCOPED_BASES`), so enabling for one Grepolis world disables for every other world. **Fix:** verify `STORE.ENABLED_HOSTS` scoping; reconsider the per-tab disable rule.
- **F19 (medium)** — *Removed in v5.0.0.* The relay module and its WebSocket are gone; the stale-handshake class of bug this entry described no longer exists.

### 3.5 Test exposure

- **F20 (medium)** — `__grepbotTest` (`src/boot.js:159-287`) is a 125-key god object gated only by `__grepbotTestMode === true`. The list includes `state` (live), `bridgePost`, `txRun`, `plannerSnapshot`, `simulateTown`, `simulateAccount`, `renderDashboard`, `preflightRun`, `nativeQueue*`, etc. There is no test runner; `data/smoke/` has only `.dom.html` + PNG fixtures. **Fix:** commit to a real harness (per `docs/PLANS.md` plans 5.x/6.x), or trim the surface to what the smoke fixtures need.
- **F21 (high)** — `__grepbotTest` shares `state` by reference — a test can mutate live config and persist it. **Fix:** in test mode, wrap `state` in a `Proxy` that logs writes, or deep-clone per test.

### 3.6 Configuration sprawl

- **F22 (medium)** — `STORE` is a 240-key object; `WORLD_SCOPED_BASES` is a separate hand-maintained 110-key list. Adding a config key requires editing both. **Fix:** add `STORE.meta` alongside each key: `{ worldScoped: bool, persisted: bool, redact: bool }`. Migration is `Object.keys(STORE).filter(k => STORE[k].worldScoped)`.
- **F23 (low)** — Config migrations have grown to v12 in a single `migrateConfig` (`src/core.js:655-819`). **Fix:** factor into `const MIGRATIONS = [v2, v3, …, v12]; for (let i = +state.configVer; i < MIGRATIONS.length; i++) MIGRATIONS[i]();`.
- **F24 (medium)** — `migrateConfig` v2 blindly re-saves everything from `WORLD_SCOPED_BASES` (`src/core.js:661-667`). On a fresh install this writes empty/defaults to 110 keys, polluting storage. **Fix:** only re-save entries whose value differs from default.
- **F25 (low)** — `I18N` is 6 languages × 3 strings; rest of UI is hard-coded Spanish. **Fix:** commit to i18n or delete dead code.

### 3.7 Bridge / Tx architecture

- **F26 (medium)** — `txRun` is a 130-line function (`src/tx.js:540-715`) with ten distinct responsibilities: classification, gate evaluation, capture, budget/timing, journal, tx state, lock, transport, reconcile, error normalisation. **Fix:** split into `txPrepare`, `txDispatch`, `txReconcileLoop` — each <50 lines.
- **F27 (medium)** — `txCapture`/`txIntent`/`txReconcileNow` (`src/tx.js:270-501`) are per-feature trees. **Fix:** register a feature with `{ capture, intent, reconcile, journalTag }` object — see F8.
- **F28 (low)** — `bridgePost` and `gameAjaxPost` duplicate the watcher/fingerprint logic (`src/bridge.js:156-216` `bridgeRaw` vs `:217-262` `gameAjaxRaw`). **Fix:** unify on `rawSend({ transport, payload, settle })`.
- **F29 (low)** — *Removed in v5.0.0.* The relay timeout constant it referenced no longer exists.

### 3.8 UI / Panel

- **F30 (high)** — Panel binds 166 `[data-cfg]` controls in one 1000-line `bindConfig` (`src/ui.js:1708-2700`). The audit at `docs/AUDIT-2026-08-13-PLAN.md:56` flagged this as Tier-1 DONE, but the function is still 1000 lines and the audit's `CFG_BINDINGS` table was not adopted. **Fix:** extract `CFG_BINDINGS` as proposed, or split per-tab.
- **F31 (low)** — `state.tabFilters` was "always there but never read or written" until `tabFilters()` (`src/ui.js:3`) finally uses it. But `STORE.TAB_FILTERS` (`src/header.js:233`) is not in `WORLD_SCOPED_BASES`, so per-tab UI state leaks across worlds. **Fix:** add `STORE.TAB_FILTERS` to `WORLD_SCOPED_BASES`.

### 3.9 Caches & invalidation

- **F32 (medium)** — Three `Object.create(null)` caches (`_townResCache`, `_townPopCache`, `_mmColCache`) use `TOWN_RES_CACHE_MS = 3000` but never invalidate on town change. **Fix:** add `townCacheInvalidate(townId)` called on writes, or scope cache keys to an epoch.
- **F33 (low)** — `_uwCache` and `_mmColCache` use the same 400 ms TTL constant. **Fix:** separate `MM_COL_CACHE_MS`; bust on collection mutation.

### 3.10 Boot sequence & timer sprawl

- **F34 (medium)** — 24 setIntervals set in `boot.js` alone (1 s, 5 s, 10 s, 12 s, 15 s, 20 s, 30 s, 60 s). Many overlap on boundaries. **Fix:** cluster into a single cadence scheduler (`gbSchedule(key, ms, fn)`) that records `lastRun` and dedupes.
- **F35 (high)** — `releaseLocks` (`src/boot.js:142-154`) calls into every module's internals (`cancelArmedAttack`, `ibClearArmed`, `banditAttackSentAt = 0`, `dodgeQueueSave`, `questClaimFailSave`, `persistServerCooldown`, `nativeQueueSaveFlush`, `snapshotBuild('exit')`). Adding a new module's persistent state requires hand-editing this function. **Fix:** modules register their own teardown handlers (`gbOnDispose(fn)`); `releaseLocks` walks the list.

### 3.11 Other

- **F36 (medium)** — `safeModeBlock` (`src/planner.js:168`) is a string-list check against `feature === 'attack'`. **Fix:** `TX_WRITE_FEATURES_RISK = { attack: 'high', culture-olympic: 'premium', … }`.
- **F37 (low)** — `INTEL_DIGEST_QUEUE_CAP = 60` and `INTEL_DIGEST_MAX = 12` (`src/alerts.js:190-218`) interact (`while queue > 60 shift`, `splice(0, 12)`) but undocumented. **Fix:** comment block explaining the burst/cadence interaction.
- **F38 (low)** — `data/smoke/` is a fixture dump, not a test runner. **Fix:** revive a minimal smoke runner (Node + JSDOM) or document the "no tests" policy.
- **F39 (low)** — `parse-inline.js` is a leaf module. **Fix:** leave as-is; no external MCP imports it (the MCP wrapper was removed in v5.0.0).
- **F40 (low)** — `gbInstanceAlive` is checked 100+ times but never auto-cleaned. After `gbDisposed = true`, the interval keeps firing (just no-ops) until clearTimeout. **Fix:** on dispose, walk `gbTimerBag` and clear even after `gbDisposed`.

---

## 4. Out-of-the-box — modern APIs, UX, a11y, safety, self-healing

### 4.1 Modern Web APIs the script does NOT use

GrepBot uses **zero** of: `AbortController`, `BroadcastChannel`, `IntersectionObserver`, `PerformanceObserver`, `requestIdleCallback`, `requestAnimationFrame`, `URLPattern`, `scheduler.postTask`, `IndexedDB`, `Web Worker`, `matchMedia('(prefers-reduced-motion)')`, `matchMedia('(prefers-contrast: more)')`, `matchMedia('(forced-colors: active)')`. Each has a clear win:

- **BroadcastChannel for cross-tab coordination** (medium, low effort, ~50 LOC) — Leader election today uses `navigator.locks` only (`src/core.js:10-62`). Two Grepolis worlds open in different tabs share no state. `BroadcastChannel('grepbot:events')` carrying captcha/panic/decisions lets one tab's break trigger another tab's pause. **Where:** `src/core.js:10-62`. **Next step:** add `gbBroadcast({type, payload})`; wire `captchaTrip`, `gbPanicActivate`, `serverCooldown` to emit.
- **AbortController for in-flight requests** (medium, low effort) — `gbAbortXhrs` calls `.abort()` on a bag at dispose (`src/core.js:154`), but a feature wanting to cancel its OWN pending requests has no API. Every scrape/bridge/farm survives past panel close until bridge timeout. **Fix:** each `gbXhr` allocates an `AbortController`; `gbAbortFeature(feature)` aborts every entry whose `feature === X`.
- **`scheduler.postTask` / `requestIdleCallback`** (low perf, low effort) — `renderOverview`/`renderIntel`/`renderStats`/`intelGrepodataAssist`/`intelWatchlistScan` all fire on a 15 s `setInterval` (`src/boot.js:128-135`). With `setInterval`, the same task runs whether the tab is foregrounded or not. **Fix:** `gbIntervalIdle(fn, ms)` wrapper.
- **IntersectionObserver for widget visibility** (low perf, low effort) — A widget scrolled out of view or behind the game's main panel keeps ticking (`src/qol.js:31-119`; `src/hud.js` countdown widget 1 s). **Fix:** `IntersectionObserver` in `gbWidgetRegister` calling `api.pauseRender()` / `api.resumeRender()`.
- **PerformanceObserver for longtask / layout-shift** (medium observability, low effort) — `profTime` in `diagnostics.js:93-125` is opt-in but only times user code. Add `PerformanceObserver({entryTypes:['longtask','layout-shift']})` to surface >50 ms blocking tasks — the actual user-perceived "the bot is freezing my game" complaints. **Fix:** accumulate into the same ring as `memSample`; surface "longtasks in last 5 min: N, max M ms" line.
- **IndexedDB for snapshots and journal** (**high** storage, medium effort ~150 LOC) — `GM_setValue` quota on Tampermonkey is ~5 MB per script. Snapshots alone can eat a quarter; `storagePruneForQuota` is the only thing keeping writes alive (`src/core.js:1572-1687`). IndexedDB has GB-scale room and is async. **Fix:** `gbIdbGet/Set/Delete` in `core.js`; store snapshots and `state.decisions`; fall back to `GM_setValue` only when IDB unavailable.
- **URLPattern for action matching** (low maintainability, low effort) — `new URLPattern({pathname:'/game/report', search:'action=view'})` replaces dozens of `u.match(/[?&]action=…/)` calls in `src/spy.js:15-25`, `src/farms.js`, `src/bridge.js` (`CSRF_PROBES`). **Fix:** `gbUrlMatch(pattern, url)` helper with regex fallback; migrate `spy.js` first as proof.
- **Web Worker for heavy simulation** (low perf, medium effort) — `simulateAccount` (`src/qol.js:379-380`) walks every town's `goalPlanTown`, planner snapshot, and forecast — synchronously blocks main thread for hundreds of ms on a 30-town account. **Fix:** spawn a `sim.worker.js` (as string + `URL.createObjectURL`); post snapshot of planner + goal state over `postMessage`; return per-town results.

### 4.2 UX wins

- **Tab navigation is click-only** (medium a11y, ~30 LOC) — `role="tablist"` exists (`src/ui.js:782-784`) but no `tabindex`. Arrow keys, `Home`/`End`, `Enter`/`Space`. **Where:** `src/qol.js:208-225` `gbKeyBind`.
- **Escape does nothing** (medium UX) — `Escape` should close queue-center, collapse panel, or cancel an armed attack. **Where:** `src/qol.js:208-225`, `src/ui.js` modal at `src/queue-center.js:1-50`.
- **`flash()` toast has no queue and no actions** (medium UX) — Two toasts in 1.5 s overwrite each other. No "Undo" on `bundle copied` or on `captcha tripped`. Real API: (a) queue messages, (b) stack vertically, (c) action button, (d) `aria-live` region. **Where:** `src/ui.js:2968-2976`. **Next:** `gbToast(msg, {action, sticky, ttl})`.
- **No focus trap in queue-center / no return-focus on close** (low a11y) — When modal opens, focus first interactive; on close, return focus to trigger. **Where:** `src/queue-center.js:1-50`.
- **Panel cannot be resized from edges** (low) — A bottom-right resize handle would let users grow the panel past the 700 px breakpoint (`@media (max-width:700px)` at `src/ui.js:741`). **Fix:** `<span class="gb-resize">` + pointerdown → `state.panelGeom.width/height`.
- **Mobile/responsive is one breakpoint** (low, medium effort) — `@media (max-width:480px)` rules: stack nav horizontally, drop dashboard grid to single column, shrink queue-center to full screen.
- **No "undo" on risky actions** (medium safety) — Wrap every "high-risk" `flash()` site with `gbToast(..., {action: {label:'Deshacer', run: invert}})`. **Where:** `src/qol.js:493-560`.
- **No drag-and-drop reordering for queue-center jobs** (low) — `native-ui.js`, `queue-center.js` use button-only `nativeQueueMove`. **Fix:** HTML5 drag-and-drop on each row.
- **"First run" onboarding** (medium UX) — Today the user lands in a panel with 30 toggles all OFF. Detect "first run" by `state.configVer === 1 && !seenHost`; show `gbFirstRun` overlay that calls `qolApplyPreset('afk')` + `state.enabledHosts[location.host] = true`.

### 4.3 Accessibility (a11y)

Whole codebase has 6 `aria-*` attributes and 0 `tabindex` — and they are only on the navbar (`src/ui.js:772-783`).

- **Only 3 a11y attributes in the whole panel** (high) — `data-cfg=*` selects/inputs have no `<label>` or `aria-label`. **Fix:** add `aria-label` to every form control that lacks a visible `<label>`; `aria-describedby` to inputs with helper text.
- **No focus indicator on custom widgets** (high) — `src/ui.js:574` panel header has `cursor:move` but no `:focus-visible` outline anywhere in the stylesheet. **Fix:** one CSS rule at the top of `gbAddStyle('panel', …)` (`src/ui.js:449`).
- **No live region for status changes** (medium) — Status pill updates silently. **Fix:** `aria-live="polite" aria-atomic="true"` on the status pill in `updateStatus`.
- **No `prefers-reduced-motion`** (low) — Transitions on hover/drag and toast appear/disappear. **Fix:** one CSS rule.
- **No `prefers-contrast: more` / `forced-colors`** (medium) — Only `.gb-theme-light` exists (`src/ui.js:512`); default is dark. **Fix:** `@media (forced-colors: active) { #grepbot-panel { border: 1px solid CanvasText; background: Canvas; color: CanvasText; } }`.
- **Color is the only state indicator** (medium) — OK/WARN/ERR pills rely on green/yellow/red. **Fix:** add shape glyphs (`✓ ⚠ ✕`) like `AI_STATES` in `src/relay.js` already does (`○ ◐ ●`).

### 4.4 Internationalization

- **Hardcoded Spanish strings** (~250 sites; **high** reach) — `flash('PANICO: automatizacion detenida')` etc. across `src/ui.js`, `src/qol.js`, `src/core.js`, `src/header.js:5`. The current `I18N` (`src/core.js:1795-1802`) covers 6 languages for 3 keys. **Fix:** `gbI18n.t(key, vars)` keyed by `navigator.language`; ship `es.json` + `en.json` first; keep Spanish as default.
- **No locale-aware number/date formatting** (low) — `fmtHMS`/`fmtSec` (`src/core.js:1742-1750`) and `journal.js`/`diagnostics.js` timestamps don't pass `navigator.language` to `toLocaleString`. **Fix:** `gbLocale()` helper.

### 4.5 Observability

- **`profilerOn` is opt-in but never wired to a hotkey** (low) — `Ctrl+Shift+P` opens preflight; no `Ctrl+Alt+P` to flip `profilerOn`. **Fix:** add to `GB_KEY_ACTIONS` (`src/qol.js:134-156`).
- **`bundleCopy` / `bundleDownload` are hidden** (medium) — Stats tab has no obvious button; only secret shortcut works. **Fix:** two prominent buttons next to preflight; default-bind `bundleCopy` to `Ctrl+Shift+B`.
- **No log filter / log level** (low) — `gbLog`/`gbLogT` (`src/core.js:1639-1674`) is a flat ring of 200 entries with no level. **Fix:** add `{level}` and a `<select>` in `renderLog`.
- **No "explain this skip" tool** (medium UX) — When the user sees "cave: defer cap hit", no path from the log line to the explanation. **Fix:** `renderJournal()` for per-feature skip counts; wire log lines with `feature|action|status|why` to a click handler that filters the journal.

### 4.6 User safety (kill switch)

- **`gbPanicActivate` exists but no keyboard shortcut** (medium safety) — A single key (e.g. `Ctrl+Shift+Backspace`) should immediately call `gbPanicActivate` from anywhere. **Where:** `src/core.js:884-892`, `src/qol.js:134-156`.
- **No confirmation on `gbPanicRecover`** (medium) — Recovery re-enables automation in 30 s; today the user clicks one button. **Fix:** confirm dialog or sticky toast with `Reanudar` action.
- **`state.dryRun` is sticky after panic** (medium) — Recovery never turns dry-run back OFF, and there's no obvious way to turn it on either. **Fix:** show "modo simulación sigue activado" pill in status row whenever `state.dryRun === true`.
- **Captcha global kill has no countdown** (low UX) — `captchaGlobalUntil > now` but pill just says "captcha". **Fix:** show "Captcha kill: 14 min left" in pill.
- **Arm window expires silently** (low safety) — *Removed in v5.0.0.* The relay arm window is gone; no disarm toast to emit.

### 4.7 Self-healing when the game DOM changes

- **`tplHealthOk` covers action templates only** (**high** resilience) — Script learned to recover from stale `action_name` templates (`src/core.js:1127-1226`), but the CSS selectors in `src/farms.js` (`.collect_btn`), `src/collect.js` (`.farm_town_silver_loot_button`), `src/bandit.js`, `src/build-tab.js` have no such gate. **Fix:** `selectorHealthOk(selector)` records hit/miss; auto-recover a selector that returns 0 matches across N scans; surface as a "selectores obsoletos: …" banner.
- **No fingerprint compare against client version** (medium diagnostics) — `snapshotPlayer` records `gb_version` but not the game's. **Fix:** capture `Game.js_build_number` on first load; store in `state.clientFp`; on mismatch show a one-time toast. (Originally the comparison was anchored on `src/relay.js:124-132`; the relay was removed in v5.0.0 — the fingerprint check itself is still useful.)
- **Snapshot restore is gated by `safeMode` only** (low safety) — Restore path silently overwrites `abTargets`, `researchTargets`, `merchantWish`, `txState`. **Fix:** confirmation modal listing changes (re-use `qolPrepareConfigImport` machinery at `src/qol.js:540-575`).

### 4.8 Performance-budget overlay

- **`reqBudgetByScope` exists, no overlay** (medium UX) — `reqBudgetByScope` (`src/core.js:1148-1150`), `reqBudgetPool` (`:1049`). **Fix:** live "request budget" pill showing `scrape 12/24 · read 8/34 · action 5/40` in `updateStatus`.
- **No "throttle everything" kill switch** (low) — Single "Slow down" button that halves `state.reqBudgetPerMin` for the next hour, then restores. **Where:** `src/ui.js:1466`.
- **No CPU/render-time instrumentation visible** (low) — `profTopLines(8)` computed but no callsite renders it (`src/diagnostics.js:115-125`). **Fix:** add a "slowest ops" table to Stats tab when `state.profilerOn`.

### 4.9 Telemetry dump for bug reports

- **`bundleCopy` works but no GitHub issue integration** (medium) — Add "Report a bug" button that opens `github.com/.../issues/new?title=GrepBot <ver> on <host>: <short>&body=<first 4KB of bundle redacted>`.
- **Bundle has no redaction of webhook URL** (low privacy) — `gbBundleText` (`src/stats.js:1049-1075`) calls `qolExportConfigForUi` which is redacted, but `state.webhookUrl` is never included — that's the current behaviour. Either document "intentionally absent" or include with a "ROTATE AFTER SHARING" warning.
- **No way to send bundle to relay/AI** (low) — *Removed in v5.0.0.* There is no relay socket to send a bundle to.

### 4.10 Dynamic feature loading

- **Everything is in one IIFE, no lazy paths** (medium bundle/first-run) — Each feature module could split into core + extension loaded only when the user enables the toggle. **Where:** `src/boot.js`, `src/qol.js:31-119`. **Fix (high effort):** start with `attack.js`, `native-ui.js` (relay was removed in v5.0.0).
- **No way to disable a feature without editing source** (low) — Add `state.disabledFeatures = []` and have `boot.js` skip initialisation for each.
- **AI command list is hardcoded** (low) — *Removed in v5.0.0.* `RELAY_TOGGLES` is gone.

### 4.11 Config export/import (`qolExportConfig` exists)

- **Export format is internal; share URL would be useful** (low) — `qolConfigShareUrl()` base64-encodes the export into a `#config=…` fragment the import page reads on load.
- **Validation only checks shape, not values** (medium safety) — A config with `transportMin: -1000` or `priorityOrder: ['lol']` passes. **Fix:** per-key value bounds mirroring `gbCfgClamp` (`src/core.js:1237`).
- **Import is wizard-only; no undo beyond history** (low) — Tag `qolHistoryPush` with `{reason, source}` so UI can group entries.
- **Profile auto-rules are bounded but invisible** (low UX) — When `qolApplyPreset('farming')` fires, log AND show "auto-profile switched to farming 5 min ago" pill. **Where:** `src/qol.js:740-810`.

---

## 5. Where to start — three staged rollout

The findings above overlap and conflict in places; the order below keeps each step verifiable on its own.

### Stage A — small patches, big wins (≈ 1 day)

1. `src/spy.js:87-107` — gate XHR `load` listener by URL pattern (§2.4).
2. `src/collect.js:222-228` — drop `attributes` filter where `class`/`style` not needed; hoist `GB_OWN_SEL` (§2.3).
3. `src/farms.js:1020-1023` + `src/towns.js:138-167` — debounce per-village saves (§2.2 #11, #12).
4. `src/boot.js:70` + `src/ui.js:130,3104` — `document.hidden` / `sec.hidden` guards on `renderTimers`, `renderFarms` (§2.1 #1, §2.2 #9).
5. ~~`src/relay.js:390, 1098-1099, 1126` — route raw timers + socket through `gbInterval`/`gbTimeout`/`gbXhrBag`; close socket in dispose (§2.6).~~ **Done (v5.0.0).** Relay module removed.
6. `src/context-menu.js:134-160` — `document.hidden` skip on 750 ms poll (§2.1 #5).
7. `src/qol.js:134-156` — register `Ctrl+Shift+Backspace` panic shortcut (§4.6).
8. `src/ui.js:449-740` — `:focus-visible` + `prefers-reduced-motion` + `forced-colors` CSS (§4.3).
9. `src/ui.js updateStatus` — surface `reqBudgetByScope` + `captchaGlobalUntil` countdown (§4.8).
10. `src/stats.js` + UI — discoverable `bundleCopy` / `bundleDownload` (§4.5).

### Stage B — structural cleanups (≈ 1 week)

11. `src/core.js:385-638` — split `state` literal into per-domain `*StateBoot()` (§3.1 F1, F7).
12. `src/ui.js:1708-2700` — extract `CFG_BINDINGS` table (§3.8 F30).
13. `src/tunables.js` — centralise the 5 cross-file cadences (§1.2 / §3.1 F2).
14. ~~`src/relay.js` — drop inner IIFE or expose `__gbApi` (§3.1 F4).~~ **Done (v5.0.0).** Relay module removed.
15. `src/tx.js:540-715` — split `txRun` into `txPrepare`/`txDispatch`/`txReconcileLoop` (§3.7 F26).
16. `src/planner.js:259-269` + `src/tx.js` + `src/journal.js:64` — feature registry table (§3.2 F8).
17. `src/header.js:24-257` + `src/header.js:263-289` — merge `STORE` + `WORLD_SCOPED_BASES` into `STORE.meta` (§3.6 F22).
18. `src/boot.js:142-154` — `releaseLocks` walks a `gbOnDispose` registry instead of hard-coded list (§3.10 F35).
19. `src/core.js:838-843` + `src/tx.js:1` — debounce `whyNote` and `txSave` (§2.5).
20. `src/core.js:1572-1687` + new `src/idb.js` — IndexedDB for snapshots + journal (§4.1).

### Stage C — feature surface (≈ 1 sprint)

21. `src/qol.js:31-119` + `src/hud.js` — `IntersectionObserver` pause for off-screen widgets (§4.1).
22. `src/diagnostics.js` — `PerformanceObserver({entryTypes:['longtask','layout-shift']})` (§4.1).
23. `src/core.js:10-62` — `BroadcastChannel('grepbot:events')` cross-tab safety (§4.1).
24. `src/spy.js` + `src/farms.js` + `src/bridge.js` — `URLPattern` migration (§4.1).
25. `src/core.js:1693-1774` — in-flight `AbortController` per request + `gbAbortFeature` (§4.1).
26. `src/ui.js:1708-…` + new `src/i18n.js` — `gbI18n.t()` with `es.json` + `en.json` (§4.4).
27. `src/core.js:1127-1226` + feature modules — `selectorHealthOk` + auto-recovery banner (§4.7).
28. `src/qol.js:587-625` — `qolConfigShareUrl()` + value-bounds validators (§4.11).
29. ~~`src/relay.js:1074-1116` — embed `GB_INSTANCE_ID` in relay `hello` (§3.4 F19).~~ **Done (v5.0.0).** Relay module removed.
30. `build.py:31-83` — `ARCH.txt` dependency diagram + `check_const_order` pass (§3.3 F12, F13).

---

## 6. Scorecards

### 6.1 Architecture

| Concern | Status |
|---|---|
| Module boundaries | Implicit; cross-file constants and shared `state` make boundaries blurry |
| State ownership | One mega-object; reads/writes scattered |
| Build safety | `node --check` + dup-decl gate; no TDZ/order check |
| Hot-reload | Mostly safe; `grepbotDispose` is thorough but misses `moduleHealth` / `panicNeedsClear` |
| Test surface | 125-key god object, no actual tests |
| Cross-origin contract | Implicit in `@connect`; no runtime validation |
| Concurrency | `gbLocks` map per-tab; `navigator.locks` for tab leader — solid |
| Config versioning | v12 monolithic function; works but fragile |
| Timer sprawl | 24+ intervals in `boot.js`; no central scheduler |

### 6.2 Performance (by area)

| Area | Status | Top issue |
|---|---|---|
| Hot-path timers | mixed | `renderTimers` every 1 s with no `document.hidden` gate (§2.1 #1) |
| DOM thrash | mixed | O(N²) selector work in `renderFarms` (§2.2 #9) |
| MutationObserver | weak | Global observer watches `attributes` on `document.body` (§2.3) |
| Network interception | weak | Every game XHR triggers a full `responseText`+`JSON.parse` (§2.4) |
| Storage writes | weak | Per-village full-map `GM_setValue` cascades (§2.5 #11) |
| Leaks / instance hygiene | weak | Hard-module boot init runs synchronously (§2.6 — was: `relay.js` raw timers + socket; removed v5.0.0) |
| Startup | weak | 222+ synchronous `GM_getValue` calls at boot (§2.7) |

### 6.3 A11y / UX / Safety gap

| Concern | Status |
|---|---|
| Keyboard nav | Tablist role exists; no `tabindex`/`ArrowKeys`/focus indicator |
| Live regions | 0 across the panel |
| Theme support | Dark default; no `forced-colors` fallback |
| Reduced motion | Not honoured |
| i18n | 250 hard-coded Spanish strings; 6-language × 3-key dictionary unused |
| Toast API | Single `flash()` overwrite; no queue, no actions |
| Panic UX | Button works; no global hotkey, no confirm on recover |
| Self-healing | Template names covered; CSS selectors not |

---

## 7. Notes & open questions

- All perf costs are static-analysis estimates. Before scheduling a perf-stage commit, run a 30 min profiler pass on a live game tab (Chrome DevTools Performance, with `profilerOn = true` and a 10-town account) and confirm the §2 ranking.
- The ToS risk stated in `src/header.js:5` ("Los ToS prohiben la automatizacion; riesgo = ban") should drive every safety/UX decision in §4.6 — anything that lowers the chance of an accidental automated click is a real win, not a polish item.
- The `__grepbotTest` exposure (§3.5 F20, F21) is a security footgun: any code path that ships to production with `__grepbotTestMode === true` would let a page-script mutate state. Consider gating it behind `?grepbotTest=1` query param and stripping on load.
- The "AI command list" (§3.2 F9, §4.10) was the most user-trust-sensitive surface — the more transparent and per-toggled it became, the more confident the user could be in enabling relay mode. Removed in v5.0.0.

---

*Generated 2026-08-14 by parallel swarm (code-quality, performance, architecture, out-of-the-box) over the working tree at `git` HEAD.*
