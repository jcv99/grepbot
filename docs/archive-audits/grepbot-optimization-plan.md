# GrepBot — Optimization & Code-Quality Plan

Scope: reduce duplication, catch structural errors earlier, and improve runtime
efficiency of the single-file Tampermonkey userscript (`grepbot.user.js`,
v5.10.2, ~1.3 MB, 52 modules concatenated into one IIFE).

## Hard constraints (do not break)

- Single IIFE = single scope. Module concat order in `build.py` MODULES is load-bearing.
- Paste-only artifact. No server, no Node workflow shipped, no @require CDN.
- The four build gates stay fail-fast: dup top-level decls → `node --check` → version drift (warn) → ascii escape.
- Hard rules: guards block only on values actually read (unreadable = blind, never 0);
  `gbNum(raw)` for wire numbers; every write goes through `bridgePost`/`gameAjaxPost` → `txRun`
  and new write features must be added to `TX_WRITE_FEATURES`.
- High-risk toggles stay default OFF.
- New tooling is dev-side only (build gates, local reports). Nothing new ships in the artifact
  except smaller/cleaner code.

## Baseline first (Phase 0 — safety net)

Before touching anything, make the current state measurable and protected.

1. Snapshot: commit/tag the current `src/` + artifact as the pre-refactor baseline.
2. Baseline metrics, written to `docs/METRICS.md`:
   - artifact bytes/lines; per-module lines from `src/*.js`
   - function count and top-20 longest functions
   - jscpd duplication % (report only)
   - fan-in of `core.gbLogT, core.gbLog, core.save, core.gameUw, core.bindConfig`
3. Add dev-only tooling (warn-only, not gating yet):
   - `npx jscpd src/ --min-lines 8 --min-tokens 60 --reporters console,html`
     (copy-paste detection; jsinspect or PMD CPD are equivalent alternatives)
   - ESLint flat config, dev-only, minimal ruleset:
     - `no-undef` (env: browser + greasemonkey globals) — works because of the single scope
     - `no-unreachable`, `no-fallthrough`, `no-dupe-keys`, `no-redeclare`,
       `no-use-before-define` (functions: false — hoisting is used deliberately)
     - `no-unused-vars` (args: none — too noisy at first)
   - `eslint-plugin-no-unsanitized` — enforces "wire values via textContent,
     `gbLit` for literal markup only" now that gbSafe/DOMPurify are gone.
4. Extend `.claude/skills/run-grepbot/driver.mjs` smoke to assert:
   - zero console errors on boot
   - every tab renders without throwing
   - Queue Center opens, Preflight runs, 0 FAIL rows
5. Fix the `build.py` MODULES list: it documents several modules twice
   (cave, merchant, intel, native-ui). Dedupe the list itself.

Exit criteria: gates run green on the unmodified codebase; metrics committed.

## Phase 1 — Quick dedup wins (low risk, high fan-in safe)

All helpers land in `src/core.js` (early in concat order) so every module can use them.
One helper per commit; run the smoke after each.

1. `learnTemplate(storeKey, j, {stripArgs, label})` — collapses the ~10 copies in
   `sniffBridgeBody` (claimTpl, acceptUnitsTpl, attackTpl, supportTpl, spyTpl,
   cancelTpl, wonderFavorTpl, heroTpl, ibAction/ibActionR). Same shape everywhere:
   parse → `isSelfBridge` check → build `{model_url, action_name, arguments, town_id,
   version, learned_at}` → `save` → `gbLog` → `tplHealthMarkLearned`.
2. `backoffFor(streak, ladder)` — one implementation of the 5/15/60-style ladder,
   replacing the inline math in `captchaTrip`, `jrnNote`, `questClaimFailed`,
   and the dodge fail backoff (`DODGE_FAIL_BACKOFF`).
3. `movementModels()` — single walker over `MovementsUnits` collections; replaces
   the triple-walk in `txMovementCount`, `banditMovementEvidence`,
   `militaryMovementsUnitsModels`.
4. `xhrLadder(guesses, opts)` — generic "try learned action first, then guesses,
   with `httpRetryAfterMs` pressure retries" loop; dedupes `fetchFarmResources`,
   `fetchOwnedTowns`, `fetchTownResources`.
5. `runBatchLoop(feature, items, fn, {spacing, lockTtl})` — the shared skeleton of
   caveScan / cultureScan / tradeScan / ruralTradeScan / researchScan / recruitScan /
   spyCycle: gate checks → `gbLock` → iterate with `gbLockTouch` → spaced `gbTimeout`
   → unlock; captcha aborts the batch. Centralizing this also centralizes the
   "captcha never trips the fail streak" invariant.
6. `gbTry(fn, fallback, tag)` — replaces silent `catch (_) {}` in non-probe paths:
   keeps fail-quiet behavior but logs once per tag via `gbLogT`. Probe paths
   (GameData shape sniffing) keep silent catches on purpose — mark them `catch (_) {}`
   with a comment so the lint rule can whitelist them.

Exit criteria: artifact size down ~3–5%; smoke green; in-game validation of farms,
cave, research on es146 with dry-run ON.

## Phase 2 — Structural dedup (medium risk)

1. `STATE_SCHEMA` — one table `{ key, store, default, worldScoped }` that generates
   the `STORE` map, the `state = {…}` initializer, and `WORLD_SCOPED_BASES`.
   Today those are three hand-synced registries; this removes the
   "added a key, forgot to scope it" bug class. Touch only `core.js`.
2. Table-driven `bindConfig` — replace the ~400-line sequence of
   `setChk/setNum/onCfg` calls with a `CONFIG_SCHEMA` array
   `{ sel, key, store, type, clamp, onChange }` plus one binding loop.
   Keeps the ~170 `data-cfg` controls declarative and greppable.
3. Unified wave planner — merge the Attack/Reinforce clone pair
   (`buildAttackSchedule`/`rfBuildSchedule`, `armAttackWave`/`rfArmWave`,
   `fireAttackNow`/`rfFireNow`, `renderAttack`/`renderReinforce`,
   `bindAttackTab`/`bindReinforceTab`, `patchAttackFireStatus`/`rfPatchFireStatus`,
   `cancelArmedAttack`/`rfCancelArmed`) into one module parameterized by
   mission (`attack` | `support`) and template (`attackTpl` | `supportTpl`).
   Largest single win: several hundred lines.
4. `townEcon(townId)` — one cached reader returning the superset of what
   `townResState`, `caveTownInfo`, `tradeTownRes`, `transportTownRes`,
   `txTownResourceSnap` compute today (res, cap, pop, tradeCap, production).
   Keeps the 3 s memo. Callers pick fields.
5. `bridgeRaw`/`gameAjaxRaw` — merge into one raw sender parameterized by the
   actual post call; keep the watcher/timeout/classify chain identical.

Exit criteria: artifact size down ~10–15% total; smoke green; full manual
validation list from `docs/DOCS.md § TASKS.md` on es146.

## Phase 3 — Runtime efficiency (medium risk)

1. Loop registry — one scheduler table `{ name, ms, fn, enabledIf }` driving the
   ~15 `gbInterval` loops (orchTick, dodgeScan, farmTick, ibScan, sweeps, renders…).
   Benefits: single place to see every loop, per-loop enable/disable for
   diagnostics, less timer drift, easier adaptive cadence.
2. `load()` read-through cache — `GM_getValue` is a sync cross-context call;
   cache reads and invalidate on `save`. Profile first: if `load` isn't hot, skip.
3. MutationObserver scoping — the body-wide observer is debounced already; consider
   scoping to the containers that actually matter (quest log, unit order, popups)
   if profiling shows callback pressure.
4. Optional minify gate in `build.py` — produce `grepbot.min.user.js` alongside the
   readable artifact (Python: `rjsmin`, or keep it optional and off by default).
   Cuts Tampermonkey parse time and memory on every page load. The `==UserScript==`
   block must stay unminified, and the ascii-escape gate still runs last.
   Keep the unminified artifact as the debug/default build.
5. Hot-path `gameUw()` → `uwCached()` — audit remaining direct `gameUw()` calls in
   per-tick paths and switch them to the 400 ms cached shim.

## Phase 4 — Permanent quality gates

1. jscpd moves from warn-only to a build gate: fail if duplication % exceeds the
   Phase-2 exit baseline + 1%. (Gate 5 in `build.py`.)
2. ESLint moves from warn-only to a build gate for the minimal ruleset. (Gate 6.)
3. TDZ/order check — static pass (acorn or a regex-based heuristic) that flags any
   top-level identifier referenced by a module earlier in MODULES order than the
   module that defines it. Catches the single-scope landmine that gate 1 can't.
4. Complexity report per release (e.g., a small Python script over `src/*.js`:
   function length, branch count) appended to `docs/METRICS.md`; track trend, not
   absolute limits.
5. Sanitizer lint (`no-unsanitized`) stays on forever — it is the enforcement of
   the post-v5.10.2 markup rule.

## Bug-hunt audit list (verify, then fix or document)

These are suspicious spots, not confirmed bugs. Each gets a `docs/REGRESSIONS.md`
entry whatever the outcome.

- `plannerEffect` trade/wonder branches use `+a.wood || 0` style coercion on
  payload arguments. Arguments are bot-constructed (not raw wire), so this is
  probably safe — but it sits next to hard rule #2. Audit all `+raw || 0` and
  `+raw` sites; convert any that read game/wire data to `gbNum`.
- Silent `catch (_) {}` inside write-adjacent paths (anything that can end in
  `bridgePost`): confirm none of them swallow an error that should trip the
  journal fail-streak or the circuit breaker.
- `farmSnapDuration` 20% tolerance: confirm no two `FARM_DURATIONS` entries can
  both match a stale `lootable_at` read.
- `caveCapacityFromLevel` hardcodes `n*1000` and level 10 = unlimited: confirm
  against live `GameDataBuildings` on es146; if the game ever changes the table,
  this becomes a silent wrong-capacity read (blind-rule violation).
- `parseTimerMinutes` only parses `min`/`h` shapes: confirm against the es market
  strings; a miss silently skips collect buttons.
- `updateStatus` builds a `JSON.stringify` tooltip every 5 s — cheap, but confirm
  it doesn't run while `document.hidden`.
- Confirm every `gbInterval` callback is in the loop registry after Phase 3 and
  bails on `document.hidden` where the old code did.

## Validation protocol (every phase, every commit)

1. `python3 build.py` — four gates green (+ new gates once enabled).
2. `node .claude/skills/run-grepbot/driver.mjs` — headless smoke green,
   zero console errors, Preflight 0 FAIL.
3. Manual in-game on es146, dry-run ON first, per `docs/DOCS.md § TASKS.md`.
4. `docs/REGRESSIONS.md` entry for every module touched.
5. Metrics diff appended to `docs/METRICS.md`.

## Expected outcome

- ~10–15% smaller artifact after Phase 2, mostly from the wave-planner merge,
  template-learning helper, batch-loop helper, and the config/state registries.
- Fewer shipped regressions: TDZ order check + no-undef + dup-decl gate cover the
  three historical single-scope failure modes.
- Duplication can no longer creep back: jscpd gate fails the build.
