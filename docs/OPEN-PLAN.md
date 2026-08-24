# GrepBot — Unified Open Plan

Single file consolidating every **not-done** item from the audit/plan
corpus, with provenance. Generated 2026-08-24 against `src/` @ v5.10.9.

## Source provenance

| Doc | Era | Status when this plan was written |
|---|---|---|
| `AUDIT-2026-08-13.md` | v4.49.0 | raw findings, fully folded into the PLAN next to it |
| `AUDIT-2026-08-13-PLAN.md` | v4.49.0 | Tier 1 closed (v4.52.0); Tier 2 + 3 open |
| `AUDIT-2026-08-14-IMPROVEMENTS.md` | v5.2.5 | Stage A closed (v5.3.0); Stage B + C open |
| `AUDIT-2026-08-23-FINDINGS.md` | v5.10.6 | 11/40 fixed (CRIT + HIGH + 2 easy MED); 29 deferred |
| `DEDUP-PLAN.md` | v5.10.3 | PR 1–5 open |
| `grepbot-optimization-plan.md` | v5.10.2 | Phase 0–4 open |
| `COMBAT-POINTS-PLAN.md` | n/a | in-game config walkthrough, no code work |
| `DOCS.md` BACKLOG | v2.9.1 | historical; most rows already shipped in v3.x |
| `DOCS.md` error-patterns | v5.x | catalogued for grep + regression reference |

Items already shipped are **not** repeated here. The Aug-13 PLAN, the
Aug-14 IMPROVEMENTS doc, and the Aug-23 FINDINGS doc carry the "DONE"
markers themselves; this plan references them by section.

## Out of scope / WONTFIX (do not re-open)

These were re-checked against `src/` and `CLAUDE.md` policy. Documented
once here so the next agent does not re-litigate them.

- **ESLint / Prettier / tsc / tests / CI** — paste-only artifact, Phase 7
  removed the test harness. Counter-proposal: mechanical checks in
  `build.py` (see item C-6 below). Source: cross-cutting #1, §A H3-H4,
  §D H7.
- **Drop ASCII-escape** — regression risk on TM-paste and file-drop
  installs (v2.9.1). Source: `AUDIT-2026-08-13-PLAN.md` §0.
- **`@updateURL` / `@downloadURL`** — no git remote yet. CLAUDE.md states
  paste-only. Re-evaluate when remote exists. Source: §E H1.
- **Drop `@noframes`** — Grepolis not iframed; dropping would boot the
  1.3 MB script in every ad/embed iframe. Source: §E H2.
- **Body-level `MutationObserver` → `#ui_box` scope** — game mounts
  WindowsView as body sibling of `#ui_box`; subtree scope misses every
  dialog. Source: §B H3.
- **ESM / esbuild module split** — paste-only artifact; rewrites the
  load-bearing concat order. Source: §D top-5.
- **`native-ui.js` reformat (readable 4-space)** — file owns in-game
  queue panel mounts; only safe right before an in-game validation
  session. Split into 3–4 commits by region.
  Source: `AUDIT-2026-08-13-PLAN.md` Tier 3 #15.
- **I18N expansion** — Spanish is the only UI language by policy. The
  6-language × 3-key `I18N` table is dead; delete or commit to
  shipping `es.json` + `en.json` (Phase 3, item O-7).
- **WW favor cast** (DOCS.md §3) — WW-worlds only, deferred since v1.0.
  Re-open only if a WW-world user files a request.
- **`gbSafe(fn, fallback, logKey)` repo-wide rewrite** — repo-wide churn,
  no behaviour change. Land helper, use in new code + modules touched
  by other tiers; never sweep. Source: `AUDIT-2026-08-13-PLAN.md` #18.
- **Cap `seenThisRun`** (8/14 §2.5) — `Set` grows for life of tab.
  Acceptable today; revisit if 30+ min sessions show pressure.

---

## Phase 1 — Cheap correctness fixes (design-needed, low risk)

Each item is a single-feature edit, smoke-testable in-game on `es146`
with dry-run ON. Sequence: smallest first; one `@version` bump per
commit per `CLAUDE.md` "Version commit rule".

| # | Item | Source | Notes |
|---|---|---|---|
| 1.1 | `farms.js:1175` captcha-hot filter sticky for day | 8/23 #12 | scope to TTL window, not "any claim today" |
| 1.2 | `farms.js:1125` `farmClaimsToday` day-rollover race | 8/23 #13 | hold rollover inside the `claim` lock, single `saveSoon` |
| 1.3 | `farms.js:1303,1642` `farmScrapeRevive` race on lock expiry | 8/23 #14 | write token into "scrape in flight" marker breaker consults |
| 1.4 | `farms.js:447` split `farmLoyaltyResearched` read + `farmLoyaltyLearnTech` write | 8/23 #15 | remove hidden state side effect |
| 1.5 | `farms.js:1165` unify `farmProfitScore` + `farmDurationPick` loyalty value | 8/23 #16 | pick one (1.0 or 0.5/1.0) and apply everywhere |
| 1.6 | `farms.js:940` include `gbLocked('claim')` in `farmClaimPending` memo key | 8/23 #19 | post-batch memo expires on lock-drop |
| 1.8 | `dump.js:78` deep-clone ledger in `pickDumpDestination` probe | 8/23 #23 | `structuredClone`; or document contract + `Object.freeze` |
| 1.9 | `collect.js:155` defer `scheduleCollectBg` until after `gbUnlock` | 8/23 #26 | close lock-release → re-arm race |
| 1.10 | `ui.js:2998` chain `.catch` on `Notification.requestPermission` | 8/23 #24 | one-line fix |
| 1.12 | `bandit.js` move `banditTimer` from `collect.js` into `bandit.js`; wire `banditClearLoop` into `__grepbotDispose` | 8/23 #17 | cross-module split fix |

**Disputed / already verified safe** (do not re-open):
- 8/23 #20 (`scrapeAllFarms` stamp before lock) — disputed, no fix
  needed. Close.
- 8/23 #22 (`farmScheduleClaimWake` re-checks) — verified safe.
- 8/23 #21 (`farmApplyDropPolicies` mid-iter `farmProfit` read) —
  5-min TTL is documented intent. Document the TTL, do not code-fix.
- 8/23 #27 (`gbDomObserver`/`gbListenerAbort` reinit) — verified safe.
- 8/23 #28 (`farmSleepClaimNow` race with `farmTick`) — closed by
  v5.10.8: the entire overnight sleep-claim path
  (`farmSleepClaimNow` + config + state + STORE keys) was dropped in
  commit `89696b1`. The function no longer exists.
- 8/23 #25 (`ui.js` clipboard fallback leak) — closed: the
  `navigator.clipboard.writeText(...).then(done, fallback)` chain in
  `src/ui.js:991-997` already wraps the sync path in try/catch and
  the `.then(_, fallback)` keeps the async path from leaking.
- 8/23 #18 (`banditScheduleNext` non-UI guard) — closed: guard
  `if (!state.autoBandit) return;` already present in
  `src/bandit.js:358`.
- 8/13 #13 (`logThrottle` overflow evicts by timestamp cutoff) —
  closed: `gbLogT` in `src/core.js:1512-1529` already computes
  `cutoff = now - 60000`, deletes entries with `ts < cutoff`, and
  falls back to dropping the first half if still over
  `LOG_THROTTLE_MAX`. Just-inserted key has `ts = now`, so it cannot
  land in the first sweep.

## Phase 2 — Duplication (PR 2-5 of `DEDUP-PLAN.md`, fused with 8/23 #30-40)

Sequencing per `DEDUP-PLAN.md` PR order. Each PR is its own commit,
its own smoke run, its own `@version` bump.

| # | Item | Source | Scope |
|---|---|---|---|
| 2.1 | PR 1: write `docs/DEDUP_MAP.md` inventory | DEDUP PR 1 | 0 LOC, 0 risk |
| 2.2 | PR 2: `gbButton` + `gbEmptyState` in `core.js`; replace 10-15 clearest sites in `queue-center.js` action rows | DEDUP PR 2 + 8/23 #40 | -30 to -60 LOC, low risk |
| 2.3 | PR 3: `cfgBindBool` / `cfgBindNumber` in `ui.js`; migrate UI/theme/panel-geom/diagnostics/intel-prefs/pause-night | DEDUP PR 3 + 8/14 F30 | -80 to -120 LOC, low risk; fold bare `save()` inside cadence scans → `saveSoon()` |
| 2.4 | PR 4: Queue Center presentation (real-queue rows, FIFO rows, status badges, move/remove) | DEDUP PR 4 | -100 to -200 LOC, low risk; only after PR 2 stable |
| 2.5 | PR 5: Queue state utilities (lane-invariant only) | DEDUP PR 5 | -50 to -100 LOC, medium risk; full in-game smoke |
| 2.6 | attack.js ↔ reinforce.js wave planner merge | 8/23 #30 | ~250 LOC saved, HIGH risk; single module parameterised by mission + template |
| 2.7 | `learnTemplate(stateKey, storeKey, j, {stripArgs, label})` collapses 9 sites | 8/23 #31 + opt Phase 1 #1 | HIGH value, low risk |
| 2.8 | Merge `bridgeRaw` + `gameAjaxRaw` | 8/23 #32 + opt Phase 2 #5 | 60 LOC saved |
| 2.9 | `gbTownModel()` adoption sweep — 17 sites in 14 files | 8/23 #33 | MED, mechanical |
| 2.10 | `movementModels()` in `core.js` — collapses 3 walkers | 8/23 #34 + opt Phase 1 #3 | MED |
| 2.11 | `gbTry(fn, fallback, tag)` in `boot.js` — replaces 29 sites | 8/23 #35 + opt Phase 1 #6 | MED, mechanical |
| 2.12 | `xhrLadder(guesses, opts)` — collapses 3 sites | 8/23 #36 + opt Phase 1 #4 | MED |
| 2.13 | `countUnits(units)` helper — 11 sites | 8/23 #37 | LOW, ≤3 LOC helper |
| 2.14 | `backoffFor(streak, ladder)` — 5 sites | 8/23 #38 + opt Phase 1 #2 | LOW-MED |
| 2.15 | `uwCached()` adoption audit on per-tick `gameUw()` sites | 8/23 #39 + opt Phase 3 #5 | MED, mechanical |

**Constraint reminders** (from `DEDUP-PLAN.md` hard-not-touch list):
- `txRun`, `txCapture`, `txIntent`, reconciliation, journal, planner
  reservations
- `bridgePost` / `gameAjaxPost`
- `gbNum`, `gameUw` semantics, storage key scoping, save behaviour
- CAPTCHA, circuit breaker, template-health, safe-mode logic
- `orchTick` priority / deadlock / farm-first
- Attack, reinforce, dodge, spy-send, favor, wonder, emergency-cave
  writes (except via 2.6 wave-planner merge)

**Do not migrate in PR 3:**
- HIGH-RISK toggles (recruit, dodge auto, favor, god spells, support
  send, dump, emergency cave, attack, reinforce, spy-send, trade,
  rural-trade, phoenician-trade)
- Controls that wake a scheduler immediately (`ibAuto`, `abAuto`,
  `autoFarm`, `autoBandit`, `autoCollect`, `autoResearch`, `autoCave`,
  `autoRuralTrade`, `autoRuralLevel`, `autoCulture`, `autoDump`,
  `autoTrade`, `autoPtTrade`, `autoHero`, `autoWallRepair`)
- Controls with migrations or multi-key legacy reads

## Phase 3 — Storage + world-scoping (8/13 Tier 3 #14)

Multi-step; rewrite user config. Get explicit go-ahead before step
14c. Staged:

| # | Item | Source | Notes |
|---|---|---|---|
| 3.1 | 14a — build.py gate: every `STORE.X` must appear in exactly one of `WORLD_SCOPED_BASES` / new `CROSS_WORLD_KEYS` | 8/13 Tier 3 #14a | fail-fast; zero runtime risk |
| 3.2 | 14b — classify 114 unscoped keys | 8/13 Tier 3 #14b | `THEME`/`KEYBINDINGS`/`PANEL_GEOM`/`WIDGET_GEOM`/`CONTEXT_MENU`/`NOTIFY_*`/`WEBHOOK_*`/`ENABLED_HOSTS`/`EXPORT_REDACT`/`ACTIVE_TAB` are global; rest per-world |
| 3.3 | 14c — `CONFIG_VER 13` migration: read legacy unscoped value once per host, write to `wkey()` | 8/13 Tier 3 #14c | read-fallback is the dangerous step; one bad read = silent config reset. **User go-ahead required** |

**Note from 8/13 verification pass:** `state.tplHealth` is already
scoped, contrary to the original audit's claim. Verify before writing
14b.

## Phase 4 — Performance (8/13 Tier 2 + 8/14 Stage B)

| # | Item | Source | Notes |
|---|---|---|---|
| 4.1 | Gate boot intervals on `state.auto*` flags | 8/13 #9 + 8/14 §2.1 | keep `renderTimers` (1s), `updateStatus` (5s), `gbLockSweep`/`diagnosticsTick` (10s) unconditional; **do not** move econ features off `orchTick` (v1.1.0 thrash bug) |
| 4.2 | Cache `queueCenterTownIds` by `{count}:{lastFetchAt}` signature | 8/13 #10 + 8/14 §2.2 | one-line fix |
| 4.3 | Short-circuit `updateStatus` on unchanged inputs | 8/13 #11 | recomputes ~7 `Object.values` walks before diffing output; called from `gbWakeDrain`, `captchaTrip`, panic, activity paths on top of 5s cadence |
| 4.4 | `state.seen` prune — `Map` with insertion-order eviction | 8/13 #12 | current `Object.keys`+`sort`+`delete` runs on overflow when system is already loaded |
| 4.6 | `txSave` deliberately NOT debounced (already correct) | CLAUDE.md hard rule | regression check: confirm no `txSaveSoon` in any merged commit |
| 4.7 | `whyNote` and `txSave` debounce: `whyNote` is `txSave`-adjacent but journal not tx | 8/14 §2.5 | `txSave` itself stays as-is per CLAUDE.md |

## Phase 5 — Structural (8/14 Stage B + Stage C)

| # | Item | Source | Notes |
|---|---|---|---|
| 5.1 | `STATE_SCHEMA` table generating `STORE` + `state` + `WORLD_SCOPED_BASES` | opt Phase 2 #1 + 8/14 F1/F22 | one source of truth; replaces three hand-synced registries |
| 5.2 | `releaseLocks` → `gbOnDispose(fn)` registry | 8/14 F35 | modules register their own teardown; no more hand-edited function |
| 5.3 | `txRun` split into `txPrepare` / `txDispatch` / `txReconcileLoop` | 8/14 F26 + opt Phase 2 #3 | 130-line function with ten responsibilities |
| 5.4 | `txBatch` / `txOnce` / `txOnCaptcha` / `txLogErr` feature registry | 8/14 F8 + opt Phase 2 #2 | object with `{ capture, intent, reconcile, journalTag }` |
| 5.5 | `townEcon(townId)` — cached superset reader | opt Phase 2 #4 | replaces `townResState` + `caveTownInfo` + `tradeTownRes` + `transportTownRes` + `txTownResourceSnap` |
| 5.6 | Loop registry: `{ name, ms, fn, enabledIf }` driving ~15 `gbInterval` loops | opt Phase 3 #1 + 8/14 F34 | single place to see every loop, per-loop enable/disable |
| 5.7 | `load()` read-through cache (profile first) | opt Phase 3 #2 | skip if not hot |
| 5.8 | MutationObserver scope tightening | opt Phase 3 #3 | only after profiling shows callback pressure |

## Phase 6 — Observability / UX (8/14 Stage C + opt Phase 4)

| # | Item | Source | Notes |
|---|---|---|---|
| 6.1 | `BroadcastChannel('grepbot:events')` cross-tab | 8/14 §4.1 + opt Phase 3 #3 | captcha/panic/decisions propagate across tabs |
| 6.2 | `AbortController` per `gbXhr` + `gbAbortFeature(feature)` | 8/14 §4.1 | feature can cancel its own pending requests |
| 6.3 | `IntersectionObserver` in `gbWidgetRegister` for off-screen widgets | 8/14 §4.1 | 1s HUD countdown widget keeps ticking behind game panel |
| 6.4 | `PerformanceObserver({entryTypes:['longtask','layout-shift']})` | 8/14 §4.1 | surface >50ms blocking tasks |
| 6.5 | IndexedDB for snapshots + journal via `gbIdbGet/Set/Delete` | 8/14 §4.1 | fallback to `GM_setValue` only when IDB unavailable |
| 6.6 | `URLPattern` for action matching in `spy.js` / `farms.js` / `bridge.js` | 8/14 §4.1 | start with `spy.js` as proof |
| 6.7 | `selectorHealthOk(selector)` + auto-recovery banner | 8/14 §4.7 | covers CSS selectors like `.collect_btn`, `.farm_town_silver_loot_button`; `tplHealthOk` already covers action templates |
| 6.8 | Bundle "Report a bug" button → opens `github.com/.../issues/new?title=…&body=<redacted bundle>` | 8/14 §4.9 | only after remote exists (deferred with @updateURL) |
| 6.9 | `selectorHealthOk` for **game version mismatch** fingerprint (`Game.js_build_number`) | 8/14 §4.7 | one-time toast on first load if changed |

## Phase 7 — Build pipeline (8/13 Tier 3 #17, opt Phase 0+4)

| # | Item | Source | Notes |
|---|---|---|---|
| 7.1 | Fix `build.py` MODULES list self-duplicates (cave, merchant, intel, native-ui) | opt Phase 0 #5 | ship-pure fix — **closed** (current `build.py` MODULES has no duplicates) |
| 7.2 | Dev-only `jscpd src/ --min-lines 8 --min-tokens 60` (warn-only first) | opt Phase 0 #3 | jscpd moves to gate in 7.5 |
| 7.3 | Dev-only ESLint flat config (minimal ruleset) | opt Phase 0 #3 | moves to gate in 7.6 |
| 7.4 | `eslint-plugin-no-unsanitized` permanently on | opt Phase 0 #3 + Phase 4 #5 | enforces "wire values via textContent, `gbLit` for literal markup only" after `gbSafe`/DOMPurify removal (v5.10.2) |
| 7.5 | `build.py` gate 5: jscpd % fails above Phase-2 exit baseline + 1% | opt Phase 4 #1 | only after 7.2 metrics are stable |
| 7.6 | `build.py` gate 6: ESLint fails on minimal ruleset | opt Phase 4 #2 | only after 7.3 is clean |
| 7.7 | `build.py` TDZ / const-order check (`check_const_order`) | opt Phase 4 #3 + 8/14 F12 | catches single-scope landmine gate 1 cannot |
| 7.8 | Complexity report per release appended to `docs/METRICS.md` | opt Phase 4 #4 | function length, branch count, trend-only |
| 7.9 | Extend `.claude/skills/run-grepbot/driver.mjs` smoke: assert zero console errors, every tab renders, QC opens, Preflight 0 FAIL | opt Phase 0 #4 | small, low-risk |
| 7.10 | `docs/METRICS.md` baseline: artifact bytes/lines, per-module lines, top-20 longest functions, jscpd %, fan-in of `core.gbLogT`/`gbLog`/`save`/`gameUw`/`bindConfig` | opt Phase 0 #2 | reference for 7.5/7.6/7.8 |

## Phase 8 — Bug-hunt audit (opt plan end, re-verify at start of each phase)

Suspicious spots, not confirmed bugs. Each gets a `docs/REGRESSIONS.md`
entry whatever the outcome.

- `plannerEffect` trade/wonder branches use `+a.wood || 0` style
  coercion — arguments are bot-constructed (safe?) but sit next to
  hard rule #2.
- Silent `catch (_) {}` inside write-adjacent paths — confirm none
  swallow an error that should trip the journal fail-streak or
  circuit breaker.
- `farmSnapDuration` 20% tolerance — confirm no two `FARM_DURATIONS`
  entries can both match a stale `lootable_at` read.
- `caveCapacityFromLevel` hardcodes `n*1000` and level 10 = unlimited
  — confirm against live `GameDataBuildings` on `es146`.
- `parseTimerMinutes` only parses `min`/`h` shapes — confirm against
  the es market strings.
- `updateStatus` builds a `JSON.stringify` tooltip every 5s — confirm
  it does not run while `document.hidden`.
- Confirm every `gbInterval` callback is in the loop registry after
  Phase 5.6 and bails on `document.hidden` where the old code did.

## Sequencing

Per `AUDIT-2026-08-13-PLAN.md` § Sequencing, every step follows:
`src/` edit → `@version` bump in `src/header.js` → `python3 build.py`
→ headless smoke run → commit (gates 1/2/4 already failed the turn if
artifact is not written).

1. **Phase 1 (1.1 → 1.13)** — one commit per item; smallest, no
   cross-module risk. Open a session only with the 8/23 design notes
   in hand.
2. **Phase 7.1 + 7.9** — ship-pure build/smoke wins first; the
   smoke is the safety net for everything below.
3. **Phase 2.1 (PR 1 inventory)** — zero-LOC, enables the rest.
4. **Phase 2.2 → 2.5 (PR 2-5)** — one PR per session; full in-game
   smoke after each.
5. **Phase 2.6 (wave planner merge)** — its own commit, its own
   smoke; HIGH risk.
6. **Phase 2.7 → 2.15** — opportunistic, can ride along with other
   refactors.
7. **Phase 4 (perf)** — only after Phase 1 closes; defer to a perf
   session with the smoke driver and 30-min profiler pass on a real
   tab (8/14 §7 caveat).
8. **Phase 5 (structural)** — behind a user go-ahead; the
   module-graph changes are large.
9. **Phase 3 (world-scoping)** — gates 3.1/3.2 safe; **3.3 needs
   user sign-off** because the migration rewrites user config.
10. **Phase 6 + 7** — opportunistic; ship incrementally.
11. **Phase 8** — re-run at start of every phase.

## Open questions for user (gate before next phase)

- **Phase 1**: agree the 10 items are the right scope for the next
  1–2 sessions? Anything to add/remove?
- **Phase 3 step 3.3**: proceed with world-scope migration? Touches
  every user's saved config; only item that can lose settings if
  read-fallback is wrong.
- **Phase 7.3 / 7.5 / 7.6**: are build-time mechanical checks
  acceptable given CLAUDE.md's no-tooling rule? Add no npm dependency,
  only Python in `build.py`.
- **Phase 2.6** (wave planner merge): OK as its own session given
  attack.js and reinforce.js both feed the Militar tab? Or hold for
  when both are stable in-game?
- **native-ui.js reformat** (WONTFIX list): hold until an in-game
  validation session is planned, or attempt 1 region now?

## Diagnostic commands

| Symptom | Command |
|---|---|
| Build fails gate 1 (dup decl) | `rtk grep -nE "^(function\|const\|let\|var) [A-Za-z_]" src/*.js \| sort \| uniq -d` |
| Build fails gate 2 (node --check) | `node --check grepbot.user.js` |
| Build fails gate 4 (ASCII) | `rtk grep -nP '[^\x00-\x7F]' src/*.js` |
| Phase 1 farm change broke claims | log grep `farmClaimsToday\|farmCaptchaHot` |
| Phase 2 toggle no longer writes same key | `rtk grep -nH "<data-cfg key>" src/ui.js` then check `cfgBindBool` migration |
| Phase 2 Queue Center wrong town or lane | log grep `nativeQueueFollowCenter\|renderQueueCenter` |
| Phase 5 lock leak after dispose | log grep `gbLock\|gbUnlock\|gbUnlockAll` |
| Phase 7 jscpd gate suddenly tripping | run `npx jscpd src/ --min-lines 8 --min-tokens 60` for diff |
| Captcha ladder tripping | log grep `captcha\|gbServerCooldown` |
| Decision memory blocking | log grep `remembered\|jrnFailStreak` |

## In-game plans (no code work)

`COMBAT-POINTS-PLAN.md` is a configuration walkthrough for the
"reach 2000 combat points" goal. It does not generate any code, doc,
or test work. Re-read it when the user wants that in-game goal
re-validated, not when planning repo changes.

`DOCS.md` BACKLOG section 3 ("Still open") is from 2026-08-10
(v2.9.1). Every row in that table has shipped in v3.x per the
"Closed in the v3.0 sweep" table at §1 of the same doc. The only
items that survive to today are **Wonder favor cast** (WW-only,
deferred — see WONTFIX) and **Watchlist "why" detail in the panel**
(minor UX; fold into a future Intel tab pass).
