# Plan for AUDIT-2026-08-13

Verification pass over `docs/AUDIT-2026-08-13.md` against `src/` at v4.49.0,
plus the work order. Every claim below was re-checked in the tree; the audit's
line citations are still accurate unless noted.

## 0. Audit claims that are WRONG or already refuted in-source

Do not spend work here.

- **Cross-cutting #10 / §E H3 / §C H2 — "`navigator.locks` leader election is
  acquired but never used for coordination."** False. `gbTabLeader` gates
  `hostEnabled()` (`src/bridge.js:565`), and `hostEnabled()` is the gate on
  every automation post. It also gates the native-UI click handlers
  (`src/native-ui.js:804,811`), the Queue Center mutations
  (`src/queue-center.js:144`) and the status pill (`src/ui.js:2996`).
  Cross-tab serialization exists. The remaining true sub-point is §C H2's
  narrower one: the per-feature `gbLocks` map is tab-local, so two tabs that
  are *both* briefly leader can double-post; the 10 s `lastSelfBridge`
  fingerprint is the only guard. Low frequency, keep as a note.
- **§B H3 — "narrow the body-level `MutationObserver` to `#ui_box`."**
  `src/collect.js:212-213` already documents why: the game's WindowsView mounts
  as a **sibling** of `#ui_box` under `<body>`, so an `#ui_box` subtree
  observer misses every dialog. WONTFIX.
- **§D M1 — "drop the ASCII escape."** `CLAUDE.md` regression note for v2.9.1
  forbids it: the escape is what killed the Latin-1 mojibake on the TM-paste
  and file-drop install paths. WONTFIX.
- **§E H1 — `@updateURL` / `@downloadURL`.** There is no git remote and
  `CLAUDE.md` states the bot is paste-only with no self-update. Nothing to
  point the URLs at. WONTFIX until a remote exists.
- **§E H2 — drop `@noframes`.** Grepolis is not iframed on its own hosts;
  dropping it makes the 1.1 MB script boot inside every ad/embed iframe on the
  page. WONTFIX.
- **§E L3 — "Violentmonkey's `GM_setValue` returns `undefined` on quota."**
  `GM_setValue` returns `undefined` on *success* in every engine, so there is
  no return value to test. Needs real evidence before any code moves.
- **Cross-cutting #1 / §A H3-H4 / §D H7 — eslint / prettier / tsc / tests /
  CI.** Directly contradicts `CLAUDE.md` ("No linter, no test runner, no Node
  workflow — paste-only mode"; Phase 7 deliberately removed the test harness).
  Counter-proposal in Tier 3 keeps the intent (mechanical checks) inside
  `build.py` instead of adding an npm workflow. User decision, not a task.
- **§D top-5 (ESM/esbuild, god-module split, `src/config.schema.js`).** A
  rewrite of the build and the module graph for a working paste-only artifact.
  Out of scope; the `MODULES` concat order is load-bearing and gated.

## Tier 1 — verified defects, cheap, user-visible

1. **`bindConfig` rebind leaves ~130 controls stale** (`src/ui.js:1743`,
   branch `:1750-1801`). Confirmed: 166 distinct `[data-cfg]` controls exist,
   the `configBound` branch syncs about 35 and `return`s. Every caller that is
   not first boot hits it: tab switch (`:448`, `:461`), wizard import
   (`:1421`), undo/redo (`:1431`, `:1435`), preset apply (`:2681`), snapshot
   restore (`:2444`), profile apply (`:2387`), `qol.js:825`. So "undo" or
   "restore snapshot" repaints stale values and the next click writes the stale
   value back.
   *Fix:* one `bindConfigSync(sec)` that walks **every** `[data-cfg]` node from
   a `CFG_BINDINGS = { key: {get, set?} }` table, called unconditionally at the
   top of `bindConfig`; `bindConfigAttach(sec)` keeps the listener install and
   still runs once. Element lookups cached into a `Map` on first pass — that
   also closes §B M1 (131 `querySelector` walks per invocation).
   *Risk:* highest-value and highest-touch item. Do it alone, in its own
   commit, and walk the Config tab in the headless smoke run.
2. **Duplicate theme CSS** (`src/ui.js:533-586`). Verified byte-identical to
   the default block at `:478-531` via `diff`. Delete the `.gb-theme-dark`
   rule; the default rule already carries the dark values for both the
   class-less and the `gb-theme-dark` case.
3. **`GM_addStyle` double-inject across hot reload** (`src/ui.js:468`,
   `src/native-ui.js:748`). `__grepbotDispose` (`src/core.js:206-241`) removes
   the panel, widgets and native controls but never the `<style>` elements, so
   each reload adds another full copy of both sheets.
   *Fix:* keep the element `GM_addStyle` returns, tag it
   `data-grepbot-style=<name>`, remove any pre-existing tagged node before
   injecting, and drop them in `__grepbotDispose`. Same shape as
   `src/queue-center.js:51`'s guard but reload-safe.
4. **`gbAjaxPending` survives disposal** (`src/bridge.js:7`; dispose at
   `src/core.js:206`). Entries linger until the 8 s TTL or
   `GB_AJAX_PENDING_MAX` eviction while the spy still resolves them.
   *Fix:* `gbAjaxPending.length = 0` from the dispose path (via `txDispose`'s
   sibling hook or a `gbAjaxDispose()`).
5. **`storagePruneForQuota` prunes 5 rings, ignores the rest**
   (`src/core.js:1488`). Confirmed set: decisions, seen, alerted, findings,
   farmResources. Not pruned: `tplHealth`, `dodgeReturns`, `snapshots`,
   `whyLog`, `profileRings`, `txState`. If one of those is the offending
   write, the prune frees nothing and the retry re-trips.
   *Fix:* add the missing rings with caps; replace the `drop * 80` style byte
   guesses with `JSON.stringify(...).length` so the log is honest.
6. **`src/quests.js:525` reimplements `unsafeWindow`** instead of using
   `gameUw()`. One-line change (§E M3).
7. **Annotate the four `innerHTML=` sites** (`src/ui.js:802`, `src/ui.js:2706`,
   `src/queue-center.js:618`, `src/attack.js:798`) with "LITERAL ONLY - no
   interpolation" (§C M5). All four are literal today; the comment is the only
   guard the repo will accept given the no-eslint policy.

## Tier 2 — perf, measurable, low blast radius

8. **`saveSoon(key, val)`** — microtask/rAF-coalesced `GM_setValue` wrapper
   (§B M5, `src/core.js:1508`). In-memory `state` stays live; only the write is
   debounced. Route the Config tab's checkbox and `saveNum` chains through it.
   Must flush on `pagehide` next to `jrnFlush`.
9. **Gate boot intervals on their feature flags** (§B H2, `src/boot.js:37-141`,
   14 `gbInterval` calls). Keep `renderTimers` (1 s), `updateStatus` (5 s),
   `gbLockSweep`/`diagnosticsTick` (10 s) unconditional; the rest already
   bail fast, so this is a wake/GC win, not a correctness one. Do **not** move
   econ features off `orchTick` while doing it (v1.1.0 thrash bug).
10. **Cache `queueCenterTownIds`** by a `{count}:{lastFetchAt}` signature
    (§B M8, `src/queue-center.js:84`).
11. **Short-circuit `updateStatus` on unchanged inputs** (§B M2,
    `src/ui.js:2973`) — it already diffs the output string, but recomputes all
    ~7 `Object.values` walks first, and it is called from `gbWakeDrain`,
    `captchaTrip`, panic and activity paths on top of the 5 s cadence.
12. **`state.seen` prune** (§B M4, `src/core.js:1275`) — full `Object.keys` +
    sort + N `delete` exactly when the system is loaded. Convert to a `Map`
    with insertion-order eviction.
13. **`logThrottle` overflow evicts by iteration order, not age**
    (§B M7, `src/core.js:1240`) — a just-inserted key can be dropped while a
    stale one survives. Sort-free fix: delete by timestamp cutoff only, and
    raise the cap if that under-frees.

## Tier 3 — structural, needs a design decision first

14. **World-scope inversion** (§C H1 / §D M3 / §E M5). Verified: 225 STORE
    keys, 111 in `WORLD_SCOPED_BASES`. The 114 unscoped keys really do bleed
    between worlds, and `AUTO_*` flags plus pace tunables (`FARM_MIN`,
    `IB_FREE_THRESH`, `CAVE_THRESH`) are the sharp end — a HIGH-RISK toggle
    turned on for world A is on when world B loads.
    *Staged approach, do not do it in one commit:*
    - 14a. `build.py` gate: every `STORE.X` must appear in exactly one of
      `WORLD_SCOPED_BASES` / a new `CROSS_WORLD_KEYS`. Build fails on a key
      that is in neither. This alone stops the leak from growing and is
      zero-risk at runtime.
    - 14b. Classify the 114 keys. Genuinely global: `THEME`, `KEYBINDINGS`,
      `PANEL_GEOM`, `WIDGET_GEOM`, `CONTEXT_MENU`, `NOTIFY_*`, `WEBHOOK_URL`,
      `WEBHOOK_EVENTS`, `ENABLED_HOSTS`, `EXPORT_REDACT`, `ACTIVE_TAB`.
      Everything else is per-world.
    - 14c. Move them behind a `CONFIG_VER` 13 migration that reads the legacy
      unscoped value once per host and writes it to `wkey()`. Without the
      read-fallback every user's config silently resets, so this step is the
      one that needs care. `state.tplHealth` is already scoped, contrary to the
      audit's claim.
15. **`src/native-ui.js` is hand-minified** (verified: 1124 lines, avg 72
    chars, max line 1632). Re-formatting is mechanical and `build.py`'s
    `node --check` + duplicate-decl gate catch structural damage, but nothing
    catches a behavior change, and this file owns the in-game queue panel
    mounts. Only worth doing right before a session that will validate the
    native UI in-game. Split into 3-4 commits by region.
16. **`preflightRun` 563 lines / 30 probes** (`src/stats.js:155`) into a
    `PROBES` table (§A H2). Pure refactor, read-only code path, safe to do
    whenever. `bindConfig` (item 1) already covers the other half of §A M1.
17. **`build.py` mechanical checks instead of eslint** (counter-proposal to
    cross-cutting #1): the duplicate-decl gate exists; add (a) the STORE-key
    coverage gate from 14a, (b) an empty-`catch` counter printed as a warning
    so `catch (_) {}` growth is visible, (c) a check that
    `__grepbotTest`'s export list (`src/boot.js:159-287`) names only symbols
    that are actually declared (§A top-5 #5). No npm, no new runtime deps.
18. **`gbSafe(fn, fallback, logKey)`** (cross-cutting #9). ~688 swallowing
    catches; converting them is a repo-wide churn commit with real merge cost
    and no behavior change. Recommend: land the helper, use it in *new* code
    and in the modules touched by Tiers 1-2, and never do a sweeping rewrite.

## Sequencing

Each step is `src/` edit, `@version` bump in `src/header.js`, `python3 build.py`,
then the headless smoke run before the commit.

1. Tier 1 items 2, 3, 4, 6, 7 — small, independent, one commit.
2. Tier 1 item 5 (quota prune) — one commit.
3. Tier 1 item 1 (`bindConfig` split) — its own commit, its own smoke pass over
   the Config tab, undo/redo, preset apply and snapshot restore.
4. Tier 2 items 8-13 — one commit each; 8 and 9 want a live tab-visibility
   check.
5. Tier 3 item 14a (build gate) — cheap, do early. 14b/14c only with an
   explicit go-ahead, since it rewrites user config.
6. Tier 3 items 15-18 — opportunistic.

## Open questions for the user

- **14b/14c**: proceed with the world-scope migration? It touches every user's
  saved config and is the only item here that can lose settings if the
  read-fallback is wrong.
- **17**: are build-time mechanical checks acceptable, given `CLAUDE.md`'s
  no-tooling rule? They add no npm dependency, only Python in `build.py`.
- **15**: re-format `native-ui.js` now, or hold it until an in-game validation
  session is planned?
