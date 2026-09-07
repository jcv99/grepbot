# GrepBot — Architecture audit + structural redesign proposal

> **Status:** draft, awaiting user review. No edits to `src/` planned until
> this plan is signed off. Build is at **v6.0.46**; this document does
> **not** propose behaviour change, and every proposal respects the hard
> rules in `CLAUDE.md` + `docs/archive-audits/REGRESSIONS.md`.
>
> **Existing artefacts folded in:** `DEDUP_PLAN.md` (root), `docs/DEDUP_MAP.md`,
> `docs/OPEN-PLAN.md`, the v6.0.15-rc4-dev7/8 merge notes in REGRESSIONS
> § "Known divergences left on the 6.x side". The dedup inventory (PR 2-5
> + items E-N) is **already correct and authoritative** for that
> micro-class of refactors — this document does **not** rewrite it.
> REDESIGN.md fills the gap above it: module boundaries, dependency
> graph, "god modules", what changes when, and which proposals deliberately
> get parked.

---

## 1. Current state at a glance

- **53 modules, one IIFE**, concat order owned by `build.py` `MODULES`.
- **33091 lines of source**, biggest five:
  - `src/ui.js` — 3980
  - `src/core.js` — 2816
  - `src/recruit.js` — 2122
  - `src/native-ui.js` — 1573
  - `src/attack.js` — 1040 (955 in repo) / `tx.js` — 1056
- **5317 top-level `function`/`const`** declarations (live graph):
  `core.js` alone owns **215** of them, more than 4× the median module.
- Graph fan-in (callers across the codebase):
  - `gbLogT` 161, `gbLog` 154, `save` 140, `gameUw` 125 (all in `core.js`)
  - `bindConfig` 135 (in `ui.js`)
  - `preflightRun` 74, `txReconcileNow` 68, `txRun` 44, `goalPlanTown` 44
- Hard rule surface (every line in this list is load-bearing — verified
  in `CLAUDE.md` "Hard rules" and `REGRESSIONS.md`):
  `gbNum`, `gbLit`, `gbPaint`, `gbLock`, `bridgePost`/`gameAjaxPost` →
  `txRun`, `TX_WRITE_FEATURES`, `orchTick` as sole econ scheduler,
  `BOOT_TIMING`, `state.dryRun`, decision-memory ring 400 / 7-day TTL,
  Spanish UI strings, pinned `<option value>` / `data-cfg`.

## 2. Module boundary map (informal)

Layers, derived from the SIMILAR_TO + CALLS edges the graph already
carries. Each layer is owned by a small set of modules.

| Layer | Owned by | Read by | Notes |
|---|---|---|---|
| **Boot / shell** | `header.js`, `boot.js`, `footer.js` | every | IIFE scaffold, `BOOT_TIMING`, panel mount, `__grepbotDispose`, teardown registry |
| **State + infra primitives** | `core.js`, `journal.js`, `planner.js`, `tx.js`, `bridge.js` | every | `gbNum`, `gbLit`, `gbPaint`, `gbLock`, `gbListen`, `save`, `saveSoon`, `saveFlush`, `state`, `STORE`, `txRun`, `txCapture`, `txIntent`, `txReconcileNow`, journal ring, planner |
| **Game probe helpers** | `core.js`, `build-tab.js`, `parse-inline.js`, `research-graph.js`, `towns.js`, `farms.js` | features | `gbTownModel`, `gbBuildingLevel`, `gbGameDataLookup`, `gameUw`, `uwCached`, `townResState`, `farmFromGame`, `parseFarms`, `tryGuess` |
| **Feature scanners** | `farms.js`, `build-auto.js`, `goals.js`, `trade.js`, `cave.js`, `culture.js`, `research.js`, `recruit.js`, `attack.js`, `dodge.js`, `support.js`, … | `orchestrate.js`, `tx.js` | one `*Scan` per feature, scheduled by `orchTick` (20s) |
| **Schedulers / leader** | `orchestrate.js`, `boot.js`, `native-ui.js`, `bridge.js` (web-lock leader) | features | `orchTick`, `orchStatus`, `gbTryAcquireTabLeader`, `nativeQueueSweep` |
| **UI / render** | `ui.js`, `queue-center.js`, `hud.js`, `context-menu.js`, `stats.js`, `intel.js` | features | panel chrome, `bindConfig`, `gbPaint`, sortable tables, decision log render |
| **Out-of-band** | `telegram.js`, `alerts.js` | `core.js` boot | GM_xmlhttpRequest to Discord / Telegram |
| **Tab / movement renders** | `native-ui.js`, `queue-center.js` | UI | in‑game `[+]`/`[-]`, queue surface |

**Cross-cutting dependencies visible in the graph (`boundaries` table):**
- `native-ui → core` 53 calls, `build-auto → core` 42, `attack → core` 29.
- `native-ui → build-auto` 23, `build-auto → native-ui` 21 — these
  two dance on every build completion.
- `alerts → core` 13 — out-of-band module owns no core symbols, only
  consumes `gbLogT` + `save`.

**Owned but never called from outside their module** (from a quick
search): nothing material — most "private" helpers (`gbAjaxDispose`,
`gbAjaxDrop`, `nativeQueueSaveNow`) are exported through `__grepbotTest`
for the smoke driver. That contract is intentional and stays.

## 3. Pain points (concrete, with file:line evidence)

### 3.1 Two god modules dominate the surface

- **`core.js` (2816 lines, 215 top-level decls)** mixes four distinct
  responsibilities: state+storage infra (`state`, `STORE`, `save*`),
  game probe primitives (`gbTownModel`, `gbProbeNum`, `gbBuildingLevel`),
  presentation helpers (`tableShell`, `placeholder`, `farmCells`,
  `renderFarms`, `renderWorld`, `renderTimers`, `updateStatus`,
  `sortRows`, `makeSortable`, `patchCells`, `farmCells`, `farmProfitCell`)
  and the discord/telegram webhook plumbing (`alertWebhook`). The
  presentation helpers were added because `ui.js` is itself a god module
  (3980 lines, 66 decls) and pushing more into it was deemed worse —
  a status quo that papers over the underlying split.
- **`ui.js` (3980 lines, 66 decls)** is the only module owning Config
  (~170 `data-cfg` controls, 11 `gbCfgGroup` blocks), the tab panel
  chrome (`ensurePanel`, `panel`, `renderResumen`, `renderAjustes`,
  `renderIntel`, `renderDiagnostico`, `renderLog`), bindConfig,
  `bindConfig` itself (135-cyclomatic — see REGRESSIONS), the Stats tab,
  Preflight hooks, and the export/import pipeline. Adding a new tab or
  feature panel requires editing this file.
- **`recruit.js` (2122 lines, 98 decls)** mixes the recruit scan loop
  with the spell-cast logic (`recruitAutoSpellDecision`, `recruitCastSpell`,
  `spellCastPost`), the batch-recruit UI (`renderTrain`, `bindTrainTab`,
  `batchRecruitTownList`, `batchRecruitUiPaint`, 40-cyclomatic
  `bindTrainTab`), favor readout (`recruitFavorRead`, `recruitFavorProd`),
  and controller/unit classification (`recruitControllerFor`,
  `recruitIsNaval`, `NAVAL_MYTHICAL_UNITS`, `MYTHICAL_UNIT_GOD`).
  `recruitScan` alone is 42-cyclomatic.
- **`native-ui.js` (1573 lines, 124 decls)** owns the entire native
  queue — root accessors, per-town lane CRUD, FIFO reconciliation for
  build / research / recruit land / recruit naval, removers, movers,
  and the `nativeQueueReconcileBuild` real-queue match logic ported in
  v5.10.59. Lane invariant lives in 4 places (root accessors, lane
  meta, FIFO accept, planner clear).

**Why it bites:** every cross-cutting change (e.g. v5.10.59's
real-queue match) has to touch all three files; `core.js` alone
holds **40% of the codebase's log + save calls**; tests are paste-only
so this stays unmeasured. The OPEN-PLAN § Phase 5 already names
`txRun` split (`txPrepare` / `txDispatch` / `txReconcileLoop`,
`txBatch`/`txOnce`/`txOnCaptcha`/`txLogErr` feature registry, F8/F26)
— same class of fix.

### 3.2 Cross-module duplication the graph already knows about

`SIMILAR_TO` edges (the graph's duplication signal) — verified inline
in `docs/DEDUP_MAP.md` for the read paths, but these are not yet
inventoried:

| Pairs | LOC saved | Risk | Already inventoried |
|---|---|---|---|
| `attack` ↔ `reinforce`: `attackSetAllSources` / `rfSetAllSources`, `attackSelectRoleSources` / `rfSelectRoleSources`, `buildAttackSchedule` / `rfBuildSchedule` | ~250 | HIGH (own session) | DEDUP_MAP item N |
| Ledger+prune pattern across `emergencyLedger`, `recruitPacksRoot`, `recruitTargetsRoot`, `supportLedger` (`emergencyLastStashPrune` ↔ `supportLedgerPrune`) | ~40 | LOW-MED | no |
| `cultureGoldSpentLoad` ↔ `wonderLoadSpent` (premium-currency ledger pair) | ~10 | LOW | no |
| `godSpellReservePct` ↔ `counterIntelThreshold` (per-feature reserve threshold) | ~10 | LOW | no |
| `stats.bundleCopy` ↔ `stats.evidenceCopy` (clipboard + redaction copy) | ~20 | LOW | no |
| `ui.renderFarmsSoon` ↔ `ui.renderWorldSoon` (same coalescer pattern as `checkThresholdsSoon`) | ~10 | LOW | no |
| `bridgeRaw` / `gameAjaxRaw` (DEDUP_MAP item F) | ~60 | yes-adj (write transport skeleton only — **does NOT touch guard order in `txRun`**) | DEDUP_MAP item F |

**`farmSleepClaimNow` / `renderSleepStatus`** are confirmed gone
(grep returns 0 hit + 1 comment in `src/ui.js:60`). `txNum` survives
as 4-call thin wrapper over `gbNum` — inlinable but not a bug.
`seenThisRun` (parse-inline.js) is live and bounded.

### 3.3 Two parallel goal-planning shapes

`goals.js` carries **two** effective planners:
- The **manual planner** (`goalPlanTown`, 44-cyclomatic) — composes
  build/research/units targets into an `actions[]` plan, used by the
  city-designer profile and the manual Reclutar/Auto paths.
- The **city-designer** shape (`cdPhase`, `cdSyncTownGoal`,
  `cdBuildTargets`, `cdEffective`, `cdIsProfile`) interleaved
  throughout `goals.js`. `goalTownCfg`, `goalEffective`, and
  `goalEffectiveBuildTargets` every branch on `cdIsProfile(cfg.profile)`
  → `cd*` — three call sites in 100 LOC.

`city-designer.js` (1573 LOC) imports this dance and adds
  `cdDemolitionCandidate`, `cdAcademyDemolitionSafe`,
  `cdRollbackProvisionalStrip`, `cdProfileDefaults`. Not a duplication
  — a coupling that survives because both ship in `goals.js`'s scope.

### 3.4 Inventory already present but unsequenced

`docs/DEDUP_MAP.md` itemises 13 mechanical dedup ops (PRs A-M) sized
in LOC and risk. `docs/OPEN-PLAN.md` Phases 1-8 fold them with farm
correctness fixes, world-scoping, perf, structural and build-gate
items. **Neither file owns a sequencing diagram that bridges
module-boundary refactors with the existing dedup PRs.** That's the
gap this document fills.

### 3.5 Moduleth boundaries that are too tight

- **`recruit.js` ↔ `native-ui.js`**: `nativeRecruitSplitTown` lives in
  `native-ui.js` because it touches the native queue root, but it
  classifies by `recruitIsNaval` which lives in `core.js` and reads
  from `recruit.js`'s `MYTHICAL_UNIT_GOD`. Three modules, one
  classification. Open: keep it that way (recruit owns the god map,
  native-ui owns the lane move) — risk of moving it into `core.js` is
  that `core.js` grows further.
- **`goals.js` ↔ `city-designer.js` ↔ `build-auto.js`**: every profile
  read goes through `goalTownCfg` (goals), `cdBuildTargets` (cd),
  `abEnsureTargets` (build-auto). The `goalQueueSuppressed` check is
  applied in three different positions. Doesn't need a new one — needs
  one consolidation pass per OPEN-PLAN 5.5 / 5.6.
- **`farms.js` ↔ `parse-inline.js` ↔ `core.js`**: `FARM_DURATIONS`,
  `farmPostedOpts`, `farmOptionMapLearn`, `farmOptionSetDerive` split
  across farms.js (the learner), core.js (the duration snap table),
  parse-inline.js (the sniffer guard `isSelfBridge`). Tight, but
  warranted — the learner writes from one place.

## 4. Target structure

> **Constraint:** one IIFE = one scope; `build.py` MODULES is the
> source of truth for order. Any new module **appends** to the order
> and gets its own header comment that names its contract, risk
> class, and forbidden shortcuts (matching the existing convention
> every module already opens with).

### 4.1 Module split, no rename, no new public surface

> **Correction (post-R0b verification):** The §4.1 table in the first
> audit listed `tableShell` / `patchCells` / `placeholder` /
> `sortRows` / `sortApplySaved` / `makeSortable` / `farmCells` /
> `farmProfitCell` / `alertWebhook` / `alertNotify` / `renderFarms` /
> `renderWorld` / `renderTimers` / `updateStatus` / `renderTownSwitch`
> as still in `core.js`. Grep against the live source confirms they
> are **already in `ui.js` / `alerts.js` / `build-auto.js`** — the
> 5.8.x / 6.x merge cleanup (v6.0.15-rc4-dev7/8) moved them during
> reconciliation. R1-R3 + R6 as originally scoped are no-ops.

These are **moves** of top-level `function`/`const` blocks between
modules. Every name that is exported (or surfaced through
`__grepbotTest`) keeps its name and its argument signature.

Re-scoped moves — what **is** still in `core.js` and could move:

| Move | From → To | Reason | Risk |
|---|---|---|---|
| `gbTip`, `gbTipWalk` | `core.js` → `ui.js` | pure-DOM tooltip walker; ui.js is the rendering module | LOW |
| `gbButton`, `gbEmptyState` | `core.js` → `ui.js` | DOM construction helpers (added by DEDUP_MAP PR 2; constraint said "core.js, not ui.js" — revisit, no longer needs the constraint) | LOW |
| `renderLog` | `core.js` → `ui.js` (or `qol.js`) | log render: the Log tab is UI surface; renderLog is paired with `renderFarms`/`renderWorld` already moved | LOW |
| `gbAddStyle`, `gbRemoveStyles` | `core.js` → `ui.js` | CSS injection for panel chrome; UI concern | LOW |
| `fmtHMS`, `fmtSec` | `core.js` → `ui.js` | formatting helpers; UI concern | LOW |
| `i18n`, `marketLocale` | `core.js` → `ui.js` | locale lookup; UI concern | LOW |
| `gbMenu`, `gbUnregisterMenus` | `core.js` → `ui.js` | Tampermonkey menu plumbing, UI concern | LOW |
| `gbDomClick` | `core.js` → `ui.js` | DOM event helper, UI concern | LOW |
| `runningVersion` | `core.js` → `boot.js` | reads `GM_info`; only boot.js cares | LOW |
| `plannerZero`, `plannerNormCost`, `gbCfgNum`, `gbCfgClamp`, `gbServerDay` | `core.js` → `planner.js` | planner internals; planner.js already owns the public planner API | LOW |
| `NAVAL_MYTHICAL_UNITS`, `MYTHICAL_UNIT_GOD`, `mythicalUnitGod`, `recruitIsNaval` | stay in `core.js` | already shared by recruit + native-ui + bandit; current shape is correct | no change |
| `gbPaint`, `gbLit`, `gbNum`, `gbLock`, `gbUnlock`, `gbLocked`, `gbListen`, `gbListenerSignal`, `gbListenerAbort`, `gbTry`, `save`, `saveSoon`, `saveFlush`, `gbAjaxWatch`, `gbAjaxDrop`, `gbAjaxDispose`, `gbAjaxClaim`, `gbAjaxFp`, `gbAjaxUnwrap`, `uwCached`, `gameUw`, `gbTownModel`, `gbBuildingLevel`, `gbAfford`, `gbProbeNum`, `gbProbeAttr`, `gbLog`, `gbLogT` | stays in `core.js` | platform primitives; CONTAINS_FOLDER invariants | no change |

**Net result (target sizes, after the re-scoped split):**
- `core.js` ≈ 2400 LOC (down from 2816; ~-15%)
- `ui.js` ≈ 4200 LOC (absorbs the UI helper cluster)
- `planner.js` +20 LOC (plannerZero/NormCost/CfgNum/CfgClamp/ServerDay)
- `boot.js` +10 LOC (runningVersion)
- All other modules unchanged.

The earlier estimate of `core.js: 2816 → 1500 LOC` over-counted by
~900 LOC because it assumed those presentation helpers had stayed in
core.js — they had already moved during the 5.8.x/6.x merge. The
remaining scope is smaller and lower-risk.

### 4.2 Ledger helper (DEDUP_MAP item, NEW)

`boundedLedger({key, ttl, cap, saveKey, pruneKey})` in `core.js` —
single `boundedMap`-style helper that absorbs `emergencyLedger` /
`emergencyLastStashPrune`, `recruitPacksRoot` / `recruitPackPrune`,
`recruitTargetsRoot` / `recruitTargetPrune`, `supportLedger` /
`supportLedgerPrune`, `cultureGoldSpentLoad` (wonder's analogue).
Per-feature storage key, prune policy, and accessor remain caller-side.

LOC delta: -40 (5 sites × ~8 LOC). Risk: LOW (read path; no write).

### 4.3 Attack ↔ Reinforce merge (DEDUP_MAP item N — **gated, own session**)

`attack.js` `attackSetAllSources` / `attackSelectRoleSources` /
`buildAttackSchedule` ↔ `reinforce.js` `rfSetAllSources` /
`rfSelectRoleSources` / `rfBuildSchedule`. ~250 LOC shared wave/arm/
schedule logic parameterised by mission + template.

Per `docs/OPEN-PLAN.md` § Phase 2.6 + DEDUP_MAP item N: **own session,
gated on in-game validation on es146** because both feed the Militar
tab. Not part of this plan's commit sequence.

### 4.4 `txRun` decomposition (OPEN-PLAN § 5.3)

`txRun` is 44-cyclomatic across 130 LOC, owns 10 responsibilities:
dry-run, breaker, safe-mode, template-health, dedup, planner,
budget, captcha, send, reconcile. Decompose into:

- `txPrepare(feature, payload)` — gates 1-5 (dry → breaker → safe →
  health → dedup)
- `txDispatch(feature, prepared)` — planner + budget + captcha
- `txReconcileLoop()` — already `txReconcileNow`, just split loop body
- `txRun` becomes the orchestrator (~20 LOC)

`txCapture` / `txIntent` / `txReconcile` / `journalTag` per-feature
extracted to a `txBatch` / `txOnce` / `txOnCaptcha` / `txLogErr`
**feature registry object** on `TX_WRITE_FEATURES`. **Hard rule:**
guard order in `txRun` does not change. REGRESSIONS § "v5.9.9 guard
order" is the reason.

LOC delta: -50 (single 130-line function → 4 focused). Risk: HIGH
(transport-adjacent, replay every feature in dry run).

### 4.5 Loop registry (OPEN-PLAN § 5.6)

Replace the manual `gbInterval(foo, BAR_MS)` calls in `boot.js` with a
single registry object the boot pulls from:

```js
// shape only — actual call site in boot.js
const LOOPS = [
  { name: 'farmTick', fn: farmTick, ms: BOOT_TIMING.FARM_TICK_MS },
  { name: 'updateStatus', fn: updateStatus, ms: BOOT_TIMING.STATUS_UPDATE_MS },
  …
];
```

Adds: per-loop `enabledIf` (e.g. `state.autoFarm`), single boot
sequence test, single disposal (`gbClearTimers` already iterates
known intervals).

LOC delta: -30 (boot.js), +20 (registry). Risk: LOW (no logic change).

### 4.6 Read-side superset: `townEcon(townId)` (OPEN-PLAN § 5.5)

Replaces `townResState(townId)` + `caveTownInfo(townId)` +
`tradeTownRes(townId)` + `transportTownRes(townId)` +
`txTownResourceSnap(townId)` with one cached superset reader that
runs at 3s memo and returns `{known, wood, stone, iron, capacity,
fill, blind}` — call sites migrate one feature at a time. Per-feature
readers stay until all callers move; documented as "to be deleted
once N callers migrated".

Risk: MED (read path; numbers must match within memo TTL).

---

## 5. Test strategy (gate BEFORE any `src/` edit)

> Last refactor shipped a regression because the diff went in
> without a regression net. Every R-step in §6 lands **only** if L1 +
> L2 + L3 below are green first. Pure Python + the existing CDP
> driver — no npm, no test runner, paste-only.

### 5.1 L1 — Static snapshot tests (Python, gates `build.py`)

`tests/snapshot.py` + `tests/diff.py` (~200 LOC total). Reads
`src/*.js`, snapshots, diffs against committed baseline.

**Captured per file:**

- `function` / `const` top-level names + arity (parameter count from
  signature parse, falls back to regex over `function name(a, b)`)
- file path + line count + sha256 of source

**Captured globally:**

- All `gb*` platform helper signatures (arity): `gbNum`, `gbLit`,
  `gbPaint`, `gbLock`, `gbListen`, `gbListenerSignal`,
  `gbListenerAbort`, `save`, `saveSoon`, `saveFlush`, `gbAjaxWatch`,
  `gbAjaxDrop`, `gbAjaxDispose`, `gbAjaxClaim`, `gbAjaxFp`,
  `gbAjaxUnwrap`, `gameUw`, `gbTownModel`, `gbBuildingLevel`,
  `gbAfford`, `gbProbeNum`, `gbProbeAttr`, `gbLog`, `gbLogT`,
  `gbTry`, `uwCached`
- `STORE.*` keys (currently 140) + each key's string value
- `BOOT_TIMING.*` keys + each value (parses `Object.freeze({...})`)
- `TX_WRITE_FEATURES` set entries (parsed from `planner.js`)
- `NATIVE_QUEUE_LANES`, `NATIVE_RECRUIT_LANES`, `HARASS_CAPS`,
  `HARASS_PREF`, `RF_MODE_ES`
- `NAVAL_MYTHICAL_UNITS`, `MYTHICAL_UNIT_GOD` (literal maps)
- `TAB_GROUPS` from `ui.js` (group → tab id map)
- All `[data-cfg=...]` values + the `<details>` group each lives in
- All `<option value=...>` literals (pinned per hard rule)

**Sentinel call-site counts per file** (catches missed rewires):

- `gbNum(`, `gbLit(`, `gbPaint(`, `gbLock(`, `bridgePost(`,
  `gameAjaxPost(`, `txRun(`, `saveSoon(`, `saveFlush(`,
  `BOOT_TIMING.`, `STORE.`

**Cyclomatic complexity for every function ≥ 20** (the 30 hotspots
the graph already returned — `bindConfig` 135, `preflightRun` 74,
`txReconcileNow` 68, `txRun` 44, `goalPlanTown` 44, etc.). Assert:
no hotspot's complexity regresses above its pre-refactor value
(moves don't increase complexity; if they do, the move was wrong).

**Catches class of bugs:**

- Missed call site during a `core.js` → `ui.js` move.
- Accidental rename of a sentinel helper (REGRESSIONS § "v5.10.2
  gbSafe was an unescaped sink named 'safe'" — this would have
  fired).
- Dropped helper that downstream modules still call.
- Top-level orphan (declared but unused) — gate 1 catches dupes but
  not orphans.
- Signature drift (function gains/drops a parameter).
- Hard-rule break: `STORE.*` keys added/removed (every key is a
  world-scoping decision).
- `BOOT_TIMING` drift (REGRESSIONS § "naked `30000` in `boot.js` is
  a regression").

**`build.py` gate 5**: `python3 tests/diff.py
tests/snapshots/pre-refactor.json`. **Fatal from R1 onward.**
Initial capture (`tests/snapshot.py write`) runs in R0 step 0,
committed to repo, never regenerated except by an explicit
`snapshot.py write` invocation.

### 5.2 L2 — Driver REPL fixtures (`driver.mjs` extension)

`driver.mjs fixture <name>` runs `tests/fixtures/<name>.json`, a
list of REPL commands, captures each output line, hashes the
whole transcript. Per R-step the hash must match the committed
baseline (`tests/fixtures/baseline/<name>.sha256`).

**Fixtures shipped:**

| Name | Commands | Catches |
|---|---|---|
| `core-primitives.json` | `api` filter + `eval typeof X === 'function'` for every `gb*` platform helper + `eval typeof state === 'object'` + `eval typeof STORE === 'object'` + `eval typeof BOOT_TIMING === 'object'` | A move that drops a helper from the IIFE; a rename that breaks a load-on-boot path |
| `tx-pipeline.json` | `arm` → `post farm { town_id: 7, x: 1 }` → assert `res=dryrun` + `journal=skip:dryrun` | Every write path must still resolve through `txRun`; gate order invariant |
| `preflight.json` | `preflight` → parse Stats rows → assert `0 FAIL`, `warn_count ± 2` (stub randomness) | Read-path regression: a probe moved to wrong module returns null and Preflight fails |
| `queue-center.json` | `tab overview` → open Queue Center → walk `build research barracks docks` → assert every lane renders or shows empty-state | A move that breaks `nativeQueueList` access from QC's paint path |
| `tx-write-features.json` | `api` filter `TX_WRITE_FEATURES` → read length + every key | Hard rule: new write feature must register; this catches a missing entry |

Each fixture ships as both `.json` (commands) + `.sha256`
(baseline hash). Driver extension: ~50 LOC, no new deps.

### 5.3 L3 — Artifact public surface (Python, post-build)

After `python3 build.py`, `tests/artifact_surface.py` reads the
built `grepbot.user.js` (which already passed gate 1/2/4) and
asserts:

- Top-level decls in the concat == top-level decls in `src/*.js`
  union (gate 1 surfaces dupes; this surfaces orphans).
- `__grepbotTest` block intact at the IIFE end (re2 match for the
  export object literal).
- `STORE = { ... }` literal evaluates same key count.
- `BOOT_TIMING = Object.freeze({...})` evaluates same value.
- Artifact byte size within ±5% of pre-refactor (catches accidental
  copy/paste of helpers; an extra 200 LOC move would push size out
  of band).
- Node `--check` already passed (gate 2).

### 5.4 Per R-step sequence (every step, no exceptions)

```
1. python3 tests/snapshot.py write        # only on R0 step 0
2. python3 build.py                       # gates 1/2/4 + NEW gate 5
3. python3 tests/artifact_surface.py      # post-build
4. node .claude/skills/run-grepbot/driver.mjs fixture tests/fixtures/*.json
5. git diff tests/snapshots tests/fixtures/baseline  # only intended keys changed
6. commit + tag per Version commit rule
```

### 5.5 R0 — Test infra lands FIRST, before any R-step

`R0` is split into two sub-steps so the snapshot baseline exists
before any structural change:

| Sub-step | Files added | LOC |
|---|---|---|
| **R0a** — snapshot + diff scripts + `build.py` gate 5 wiring | `tests/snapshot.py`, `tests/diff.py`, `tests/artifact_surface.py`, edit `build.py` (gate 5 call, fatal flag off) | ~250 |
| **R0b** — capture baseline + commit | `tests/snapshots/pre-refactor.json` (committed), `tests/fixtures/*.json` + `tests/fixtures/baseline/*.sha256` | 0 (data only) |

R0a runs `--warn-only` first run (prints diffs but exits 0). R0b
writes baseline + commits. R0a becomes fatal on the first build
where R1 ships. From R1 onward, **no R-step commits if any L1/L2/L3
check fails**.

## 6. Sequencing (smallest first, gates intact)

Every step is **independent**, **single-purpose**, **buildable**, and
**one `@version` bump** per the Version commit rule. Per CLAUDE.md
"Module change protocol" + "Hard rules" — gates 1, 2, 4 still fatal.
**Gates 5 (snapshot diff) added in R0a.**

| # | Step | LOC delta | Risk | Smoke | Reference |
|---|---|---|---|---|---|
| **R0** | Read **only** + sign-off on this document | 0 | none | n/a | this file |
| **R1** | Move UI helper cluster from `core.js` to `ui.js`: `gbTip`, `gbTipWalk`, `gbButton`, `gbEmptyState`, `gbAddStyle`, `gbRemoveStyles`, `fmtHMS`, `fmtSec`, `gbMenu`, `gbUnregisterMenus`, `gbDomClick`, `renderLog`, `i18n`, `marketLocale` | core -350 / ui +350 | LOW | snapshot diff + 5 fixtures + artifact surface | §4.1 (re-scoped) |
| **R2** | Move `runningVersion` from `core.js` to `boot.js` | core -5 / boot +5 | LOW | snapshot diff + fixture PASS | §4.1 |
| **R3** | Move planner internals (`plannerZero`, `plannerNormCost`, `gbCfgNum`, `gbCfgClamp`, `gbServerDay`) from `core.js` to `planner.js` | core -50 / planner +50 | LOW-MED | snapshot diff + preflight fixture PASS | §4.1 |
| **R4** | Introduce `boundedLedger({key, ttl, cap, saveKey, pruneKey})` in `core.js`; migrate `emergencyLedger` / `emergencyLastStashPrune` first (read-only call sites only) | core +30, emergency -15 | LOW-MED | CDP preflight + 1 emergency cycle | §4.2, DEDUP_MAP item L |
| **R5** | Migrate remaining ledger sites: `recruitPacksRoot` / `recruitTargetsRoot`, `supportLedger`, `cultureGoldSpentLoad`, `wonderLoadSpent` | net -40 | LOW-MED | CDP per-feature toggle cycle | §4.2 |
| **R6** | Add loop registry `LOOPS = [{name, fn, ms, enabledIf?}]` in `boot.js`; replace `gbInterval` literal calls in `boot.js` (only) | boot ±10 | LOW | CDP boot (0 page errors) | OPEN-PLAN § 5.6 |
| **R7** | Bridge `bridgeRaw` / `gameAjaxRaw` skeleton merge (already a thin wrapper pair; unify only the `gbAjaxWatch`+`settled`-dedupe path) | bridge -60 | yes-adj | CDP dry-run post + in-game dry run of one attack wave | DEDUP_MAP item F |
| **R8** | (DEFERRED) `townEcon(townId)` superset reader | -120 over many | MED | full in-game (per-feature reader parity) | OPEN-PLAN § 5.5 |
| **R9** | (DEFERRED) `txRun` → `txPrepare` / `txDispatch` / `txReconcileLoop` + feature registry `txBatch` / `txOnce` / `txOnCaptcha` / `txLogErr`. Guard order **unchanged**. | tx -50 | HIGH | CDP full pass + per-feature dry run + decision journal assert | OPEN-PLAN § 5.3, 5.4 |
| **R10** | (GATED, OWN SESSION) `attack.js` ↔ `reinforce.js` wave-planner merge | -250 | HIGH | per-feature in-game on es146 | DEDUP_MAP item N, OPEN-PLAN § 2.6 |
| **R11** | (PARKED) Add mechanical checks (`jscpd`, minimal `eslint`, `BOOT_TIMING` drift detector) to `build.py` | build +100 | none | dev-only first, gate in step 7.5/7.6 | OPEN-PLAN § 7 |

Each R-step is one commit + one `@version` bump + build + CDP smoke +
annotated tag. R0 alone is review; user approval gates R1 onward.

## 7. What this plan explicitly does NOT do

- **No npm / bundler / linter / test runner dependency** in the shipped
  artifact. R12 is `jscpd`+`eslint` invoked from `build.py` at build
  time, dev-only first, optional.
- **No rename of wire values** (`data-cfg` attribute names, `<option
  value>` strings, storage keys, feature keys, lock names).
- **No change to high-risk default-off toggles** (recruit, dodge auto,
  favor, god spells, support send, dump, emergency cave, attack,
  reinforce, spy-send, trade, rural-trade, phoenician-trade).
- **No change to guard order in `txRun`** (REGRESSIONS § "v5.9.9 guard
  order").
- **No change to scheduler ownership** (`orchTick` 20s, `dodgeScan`
  5s, `farmTick` 15s, 10s lock sweep, scrape deadlines). Open-plan
  § "WONTFIX" list honoured: ESM/esbuild split, MutationObserver
  scope widening, I18N expansion, WW favor cast, gbSafe repo rewrite,
  `seenThisRun` cap, `native-ui.js` reformat, `@updateURL` /
  `@downloadURL` (no remote yet).
- **No data-driven world-scoping rewrite** (OPEN-PLAN § 3.3
  CONFIG_VER 13 migration). That step rewrites user config and
  needs its own user go-ahead — outside this plan.

## 8. Open questions for user (gate before R1)

1. **R1-R7 sign-off in one session?** Each step is small but the
   steps together pull ~400 LOC out of `core.js`. Confirm the
   `core.js`-as-platform-primitive boundary still holds after the
   moves.
1a. **Re-scoped R1 (UI helper cluster)**: original R1 listed
    `tableShell`/etc. but those already moved during 5.8/6.x merge.
    New R1 = move `gbTip`/`gbTipWalk`/`gbButton`/`gbEmptyState`/
    `gbAddStyle`/`gbRemoveStyles`/`fmtHMS`/`fmtSec`/`gbMenu`/
    `gbUnregisterMenus`/`gbDomClick`/`renderLog`/`i18n`/
    `marketLocale` to `ui.js`. Confirm scope.
2. **R9 `townEcon` reader — yes / no / defer?** Saves ~120 LOC across
   readers but touches every read path; needs its own in-game
   validation. Currently parked as DEFERRED.
3. **R10 `txRun` split — yes / no / later?** HIGH-risk transport
   change. Currently parked as DEFERRED. Recommended: only after
   R1-R8 land cleanly and the gate 1/2/4 baseline is stable.
4. **R11 wave-planner merge — own session, confirm.** Per
   `docs/OPEN-PLAN.md` § 2.6 + DEDUP_MAP item N. Currently parked.
5. **R12 mechanical checks — add at all?** CLAUDE.md § "Tooling and
   validation" says paste-only mode and "Don't introduce `npm test` /
   `eslint` / prettier". Currently parked as PARKED.
6. **L2 fixtures — all 5 (`core-primitives`, `tx-pipeline`, `preflight`,
   `queue-center`, `tx-write-features`) or just `core-primitives` +
   `tx-pipeline`?** Both ship in R0a; choose scope.
7. **Snapshot baseline commit** — `tests/snapshots/pre-refactor.json`
   is the regression net. Commit on R0b step 0 so the very first
   refactor (R1) has it as the diff anchor.

## 9. Diagnostic commands (per-step)

| Step | Symptom | Grep / command |
|---|---|---|
| R1-R3 (any) | gate 1 dup-decl trips | `rtk grep -nE "^(function\|const\|let\|var) [A-Za-z_]" src/*.js \| sort \| uniq -d` |
| R4-R5 | ledger site dropped a key | log grep `<feature>\|skip:` |
| R6 (per-tick refresh) | countdown widget stuck at 0 | log grep `renderTimers\|updateStatus` |
| R7 (loop registry) | interval starved | log grep `gbInterval\|state.auto*` |
| R8 (bridge merge) | dry-run post not logged | log grep `bridgePost\|gameAjaxPost\|gbAjaxWatch` |
| R10 (txRun split) | guard order changed | `rtk grep -nH 'dry\|breaker\|safe\|health\|dedup\|planner\|budget\|captcha' src/tx.js` (must keep dry→breaker→safe→health→dedup→planner→budget→captcha) |

---

## Appendix A: Hard rule verification

Every hard rule in `CLAUDE.md` + `REGRESSIONS.md` checked against the
R1-R11 surface:

| Rule | Touched by R-steps? | How it's preserved |
|---|---|---|
| Paste-only, no server | none | every change is a `src/*.js` move or |
| `gbNum` coercion | R4, R9 only | `boundedLedger` reads numbers via `gbNum`; `townEcon` same; nothing new written that takes `+`+`isFinite` |
| `txRun` guard order | R10 only | step explicitly states order unchanged + diagnostic command |
| `gbPaint` / `gbLit`-only DOM writes | R1, R2, R3, R6 | moves are 1:1; no rewrite introduces new DOM helpers |
| `TX_WRITE_FEATURES` registration | R10 only | feature registry objects on `TX_WRITE_FEATURES`; no new write features |
| `orchTick` sole econ scheduler | R7 only | loop registry reads `enabledIf` from `state.auto*`; econ scans still ride `orchTick` |
| `gbLock` / `GB_LOCK_TTL` | none | no new locks added in R1-R8 |
| Decision memory ring 400 / 7-day TTL | none | unchanged |
| Spanish UI strings | R1 only | `placeholder()` text is unchanged |
| Pinned `<option value>` / `data-cfg` | none | no UI renames |
| `*Soon` coalescers | R6 only | moved with their callers; no new bare `save` in sweeps |
| `txSave` deliberately NOT debounced | none | untouched |
| `state.decisions` ring 400 | none | untouched |
| `ORCH_MAX_PER_TICK = 3` | none | untouched |
| `data-cfg` rows inside `gbCfgGroup` | none | no new controls in R-steps |

## Appendix B: Inventory delta vs. existing artefacts

| Plan this overlaps with | Status | What we add |
|---|---|---|
| `DEDUP_PLAN.md` (root) PR 2-5 | active | this plan rides on them, doesn't replace |
| `docs/DEDUP_MAP.md` items E, F, H, I, J, K, L | active | sequenced into R-steps (E→R8, F→R8, H→R4, I→R5, J→R6, K→R1, L→R4) |
| `docs/DEDUP_MAP.md` items A-D, G, M | active | not in this plan — still single-PR path per DEDUP_PLAN |
| `docs/DEDUP_MAP.md` item N (attack↔reinforce) | gated own session | R11 |
| `docs/OPEN-PLAN.md` § Phase 5 (5.1, 5.3, 5.5, 5.6, 5.7) | active | this plan owns 5.3, 5.5, 5.6 via R10/R9/R7 |
| `docs/OPEN-PLAN.md` § Phase 5 (5.2, 5.8) | active | not in this plan |
| `docs/OPEN-PLAN.md` § Phase 7 | parked | R12 |
| `docs/OPEN-PLAN.md` § Phase 1 | independent | no overlap |
| `docs/OPEN-PLAN.md` § Phase 2 | partially merged into this plan | where this plan and DEDUP_MAP agree, no duplication |
| `docs/OPEN-PLAN.md` § Phase 3 | independent | user-gated, separate plan |
| `docs/OPEN-PLAN.md` § Phase 4 | independent | perf-only |
| `docs/OPEN-PLAN.md` § Phase 6 | independent | observability, opportunistic |
| `docs/OPEN-PLAN.md` § Phase 8 | active | re-verify at start of every R-step |