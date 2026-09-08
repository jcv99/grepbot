# Plan for AUDIT-2026-08-13

Verification pass over `docs/AUDIT-2026-08-13.md` against `src/` at v4.49.0, plus work order. Every claim re-checked in tree; audit line citations still accurate unless noted.

## 0. Audit claims WRONG or already refuted in-source

Skip. No work here.

- **Cross-cutting #10 / §E H3 / §C H2 — "`navigator.locks` leader election acquired but never used for coordination."** False. `gbTabLeader` gates `hostEnabled()` (`src/bridge.js:565`), and `hostEnabled()` gates every automation post. Also gates native-UI click handlers (`src/native-ui.js:804,811`), Queue Center mutations (`src/queue-center.js:144`) and status pill (`src/ui.js:2996`). Cross-tab serialization exists. Remaining true sub-point is §C H2 narrower one: per-feature `gbLocks` map is tab-local, so two tabs both briefly leader can double-post; 10 s `lastSelfBridge` fingerprint is only guard. Low frequency, keep as note.
- **§B H3 — "narrow body-level `MutationObserver` to `#ui_box`."** `src/collect.js:212-213` already documents why: game's WindowsView mounts as sibling of `#ui_box` under `<body>`, so `#ui_box` subtree observer misses every dialog. WONTFIX.
- **§D M1 — "drop ASCII escape."** `CLAUDE.md` regression note for v2.9.1 forbids it: escape killed Latin-1 mojibake on TM-paste and file-drop install paths. WONTFIX.
- **§E H1 — `@updateURL` / `@downloadURL`.** No git remote; `CLAUDE.md` states bot is paste-only with no self-update. Nothing to point URLs at. WONTFIX until remote exists.
- **§E H2 — drop `@noframes`.** Grepolis not iframed on own hosts; dropping makes 1.1 MB script boot inside every ad/embed iframe on page. WONTFIX.
- **§E L3 — "Violentmonkey's `GM_setValue` returns `undefined` on quota."** `GM_setValue` returns `undefined` on success in every engine, so no return value to test. Needs real evidence before any code moves.
- **Cross-cutting #1 / §A H3-H4 / §D H7 — eslint / prettier / tsc / tests / CI.** Directly contradicts `CLAUDE.md` ("No linter, no test runner, no Node workflow — paste-only mode"; Phase 7 deliberately removed test harness). Counter-proposal in Tier 3 keeps intent (mechanical checks) inside `build.py` instead of adding npm workflow. User decision, not task.
- **§D top-5 (ESM/esbuild, god-module split, `src/config.schema.js`).** Rewrite of build and module graph for working paste-only artifact. Out of scope; `MODULES` concat order is load-bearing and gated.

## Tier 1 — verified defects, cheap, user-visible — DONE (v4.52.0)

Closed by `0221ea6` (items 2, 3, 4, 6, 7), `9ac825d` (item 5) and `bf6a661` (item 1). Two findings work turned up that audit missed: bind path had never initialised 11 controls (theme, diagnostics toggles, emergency-cave) on FIRST render, mirror image of repaint hole; and `GM_addStyle`'s return value cannot be trusted for dedupe tag, since in no GM spec and smoke stub returns nothing.

1. **`bindConfig` rebind leaves ~130 controls stale** (`src/ui.js:1743`, branch `:1750-1801`). Confirmed: 166 distinct `[data-cfg]` controls exist, `configBound` branch syncs ~35 and `return`s. Every caller that is not first boot hits it: tab switch (`:448`, `:461`), wizard import (`:1421`), undo/redo (`:1431`, `:1435`), preset apply (`:2681`), snapshot restore (`:2444`), profile apply (`:2387`), `qol.js:825`. So "undo" or "restore snapshot" repaints stale values and next click writes stale value back.
   *Fix:* one `bindConfigSync(sec)` that walks every `[data-cfg]` node from `CFG_BINDINGS = { key: {get, set?} }` table, called unconditionally at top of `bindConfig`; `bindConfigAttach(sec)` keeps listener install and still runs once. Element lookups cached into `Map` on first pass — also closes §B M1 (131 `querySelector` walks per invocation).
   *Risk:* highest-value and highest-touch item. Do alone, in own commit, walk Config tab in headless smoke run.
2. **Duplicate theme CSS** (`src/ui.js:533-586`). Verified byte-identical to default block at `:478-531` via `diff`. Delete `.gb-theme-dark` rule; default rule already carries dark values for both class-less and `gb-theme-dark` case.
3. **`GM_addStyle` double-inject across hot reload** (`src/ui.js:468`, `src/native-ui.js:748`). `__grepbotDispose` (`src/core.js:206-241`) removes panel, widgets and native controls but never `<style>` elements, so each reload adds another full copy of both sheets.
   *Fix:* keep element `GM_addStyle` returns, tag it `data-grepbot-style=<name>`, remove any pre-existing tagged node before injecting, drop them in `__grepbotDispose`. Same shape as `src/queue-center.js:51`'s guard but reload-safe.
4. **`gbAjaxPending` survives disposal** (`src/bridge.js:7`; dispose at `src/core.js:206`). Entries linger until 8 s TTL or `GB_AJAX_PENDING_MAX` eviction while spy still resolves them.
   *Fix:* `gbAjaxPending.length = 0` from dispose path (via `txDispose`'s sibling hook or `gbAjaxDispose()`).
5. **`storagePruneForQuota` prunes 5 rings, ignores rest** (`src/core.js:1488`). Confirmed set: decisions, seen, alerted, findings, farmResources. Not pruned: `tplHealth`, `dodgeReturns`, `snapshots`, `whyLog`, `profileRings`, `txState`. If one of those is offending write, prune frees nothing and retry re-trips.
   *Fix:* add missing rings with caps; replace `drop * 80` style byte guesses with `JSON.stringify(...).length` so log is honest.
6. **`src/quests.js:525` reimplements `unsafeWindow`** instead of using `gameUw()`. One-line change (§E M3).
7. **Annotate four `innerHTML=` sites** (`src/ui.js:802`, `src/ui.js:2706`, `src/queue-center.js:618`, `src/attack.js:798`) with "LITERAL ONLY - no interpolation" (§C M5). All four literal today; comment is only guard repo will accept given no-eslint policy.

## Tier 2 — perf, measurable, low blast radius

8. ~~**`saveSoon(key, val)`**~~ **Done (v5.3.0).** 400ms coalesce, `saveFlush()` wired into `releaseLocks` (last step) and `__grepbotDispose` (before `gbClearTimers`). Applied to farm/town village sweep and `whyNote`. Config checkbox / `saveNum` chains still on bare `save` — single user click is not write-amplification case this was built for.
9. **Gate boot intervals on feature flags** (§B H2, `src/boot.js:37-141`, 14 `gbInterval` calls). Keep `renderTimers` (1 s), `updateStatus` (5 s), `gbLockSweep`/`diagnosticsTick` (10 s) unconditional; rest already bail fast, so wake/GC win, not correctness one. Do **not** move econ features off `orchTick` while doing it (v1.1.0 thrash bug).
10. **Cache `queueCenterTownIds`** by `{count}:{lastFetchAt}` signature (§B M8, `src/queue-center.js:84`).
11. **Short-circuit `updateStatus` on unchanged inputs** (§B M2, `src/ui.js:2973`) — already diffs output string, but recomputes all ~7 `Object.values` walks first, called from `gbWakeDrain`, `captchaTrip`, panic and activity paths on top of 5 s cadence.
12. **`state.seen` prune** (§B M4, `src/core.js:1275`) — full `Object.keys` + sort + N `delete` exactly when system is loaded. Convert to `Map` with insertion-order eviction.
13. **`logThrottle` overflow evicts by iteration order, not age** (§B M7, `src/core.js:1240`) — just-inserted key can be dropped while stale one survives. Sort-free fix: delete by timestamp cutoff only, raise cap if that under-frees.

## Tier 3 — structural, needs design decision first

14. **World-scope inversion** (§C H1 / §D M3 / §E M5). Verified: 225 STORE keys, 111 in `WORLD_SCOPED_BASES`. 114 unscoped keys really do bleed between worlds, and `AUTO_*` flags plus pace tunables (`FARM_MIN`, `IB_FREE_THRESH`, `CAVE_THRESH`) are sharp end — HIGH-RISK toggle turned on for world A is on when world B loads.
    *Staged approach, do not do in one commit:*
    - 14a. `build.py` gate: every `STORE.X` must appear in exactly one of `WORLD_SCOPED_BASES` / new `CROSS_WORLD_KEYS`. Build fails on key in neither. Stops leak from growing alone, zero-risk at runtime.
    - 14b. Classify 114 keys. Genuinely global: `THEME`, `KEYBINDINGS`, `PANEL_GEOM`, `WIDGET_GEOM`, `CONTEXT_MENU`, `NOTIFY_*`, `WEBHOOK_URL`, `WEBHOOK_EVENTS`, `ENABLED_HOSTS`, `EXPORT_REDACT`, `ACTIVE_TAB`. Everything else per-world.
    - 14c. Move behind `CONFIG_VER` 13 migration that reads legacy unscoped value once per host and writes to `wkey()`. Without read-fallback every user's config silently resets, so this step needs care. `state.tplHealth` already scoped, contrary to audit's claim.
15. **`src/native-ui.js` is hand-minified** (verified: 1124 lines, avg 72 chars, max line 1632). Re-formatting mechanical, `build.py`'s `node --check` + duplicate-decl gate catch structural damage, but nothing catches behavior change, and file owns in-game queue panel mounts. Only worth doing right before session that will validate native UI in-game. Split into 3-4 commits by region.
16. **`preflightRun` 563 lines / 30 probes** (`src/stats.js:155`) into `PROBES` table (§A H2). Pure refactor, read-only code path, safe whenever. `bindConfig` (item 1) already covers other half of §A M1.
17. **`build.py` mechanical checks instead of eslint** (counter-proposal to cross-cutting #1): duplicate-decl gate exists; add (a) STORE-key coverage gate from 14a, (b) empty-`catch` counter printed as warning so `catch (_) {}` growth visible, (c) check that `__grepbotTest`'s export list (`src/boot.js:159-287`) names only symbols actually declared (§A top-5 #5). No npm, no new runtime deps.
18. **`gbSafe(fn, fallback, logKey)`** (cross-cutting #9). ~688 swallowing catches; converting is repo-wide churn commit with real merge cost and no behavior change. Recommend: land helper, use in *new* code and modules touched by Tiers 1-2, never do sweeping rewrite.

## Sequencing

Each step: `src/` edit, `@version` bump in `src/header.js`, `python3 build.py`, then headless smoke run before commit.

1. Tier 1 items 2, 3, 4, 6, 7 — small, independent, one commit.
2. Tier 1 item 5 (quota prune) — one commit.
3. Tier 1 item 1 (`bindConfig` split) — own commit, own smoke pass over Config tab, undo/redo, preset apply and snapshot restore.
4. Tier 2 items 8-13 — one commit each; 8 and 9 want live tab-visibility check.
5. Tier 3 item 14a (build gate) — cheap, do early. 14b/14c only with explicit go-ahead, since rewrites user config.
6. Tier 3 items 15-18 — opportunistic.

## Open questions for user

- **14b/14c**: proceed with world-scope migration? Touches every user's saved config and is only item here that can lose settings if read-fallback wrong.
- **17**: are build-time mechanical checks acceptable, given `CLAUDE.md`'s no-tooling rule? Add no npm dependency, only Python in `build.py`.
- **15**: re-format `native-ui.js` now, or hold until in-game validation session planned?