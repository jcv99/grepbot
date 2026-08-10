# 26 - Improvement sweep (v2.9.1 -> v3.0)

Written 2026-08-10 against `src/` @ v2.9.1, fact-checked line by line.
Supersedes the priority list in `BACKLOG.md` (last reviewed at v1.5.14 - stale,
see §D).

Evidence sources: `src/` grep, `build.py` MODULES, `docs/plans/*`, and the live
panel screenshot at repo root (v2.9.0 footer: `farms:0/12 err:no endpoint
matched SAFE mem:3`).

---

## A. P0 - live waste that starves real automation

### A1. Farm HTTP resource scrape is dead and drains the shared request budget

Evidence:

- `src/farms.js:602` `ACTION_GUESSES = ['farm_town_info','get_farm_towns','farm_town_overview']`;
  `fetchFarmResources` (`farms.js:627-710`) walks the ladder per village and
  writes `err: 'no endpoint matched'` (`farms.js:633`) when all miss.
- Footer in the screenshot: `farms:0/12` - 12 villages, 0 ok. Zero ok also means
  `state.farmAction` was never learned, so `farmGuesses()` (`farms.js:605-614`)
  returns all 3 guesses for every village, every sweep, forever.
- Guesses inside one village fire with **no** spacing: every failure branch calls
  `tryGuess(entry, i+1, 0)` synchronously; only the 429/503 path is delayed.
  Villages are spaced 700-1000ms (`farms.js:756`).
- Each real request charges one slot of the shared budget: `gbXhr` marks
  `reqBudgetMark()` for `scope==='game'` (`core.js:1187-1188`);
  `fetchFarmResources` never sets `scope`, so it defaults to `game`. Pool is
  `reqBudgetPerMin` default 40 (`core.js:326`) over a 60s sliding window
  (`core.js:590-598`).
- The **same** pool gates every action: `bridgePost` (`bridge.js:190-193`) ->
  `txRun` (`tx.js:535`) -> `txActionGate` `if (!reqBudgetOk()) return 'budget'`
  (`tx.js:532`) plus a second pre-send check for writes (`tx.js:646-647`).
- Net effect per sweep: 36 slots burned by a scraper that has never returned
  data, leaving ~4/40 headroom for roughly the following minute. Farm claims,
  cave stash, and the armed free-instant post (which needs a ~10s window,
  CLAUDE.md "instant arming") can be dropped with `skip:budget` behind it.
  It also crosses the write soft-throttle at 60% of the pool
  (`reqBudgetSoftDelayMs`, `core.js:721-728`, applied in `tx.js:575-580`), so
  writes are additionally delayed up to 8s during the sweep.

Work:

1. Circuit breaker: `state.farmScrapeMisses`; after 2 consecutive sweeps with
   `ok === 0` set `state.farmScrapeDead = true`, log once, stop auto sweeps.
   A successful learn (`learnFarmAction`, `farms.js:616`) or a manual
   `Farms ahora` click clears it.
2. Config toggle `Escanear recursos de aldeas (HTTP)` - default OFF when
   `state.farmAction` was never learned; ON reproduces today's behaviour.
3. Clear the stale error rows when the breaker trips or the toggle goes OFF.
   The consumers **already** degrade correctly on missing data (`ui.js:73-81`
   renders `-`, `checkThresholds` `build-auto.js:456` does
   `if (!r || !r.ok || !t) continue;`), so no consumer change is needed - but
   existing `{ok:false, err:'no endpoint matched'}` entries survive up to 24h
   (prune cutoff `core.js:1132-1140`), so the Farms tab and the footer
   (`ui.js:1715`) would keep showing the old error after the feature is off.
   Delete `state.farmResources` entries on trip/disable and make the footer read
   `farms: scrape off`.
4. Bug found while verifying, fix in the same change: farms' `onerror`
   (`farms.js:701-707`) advances to the next guess for **any** error, including
   the `budget` / `disabled` `failEarly` paths of `gbXhr` (`core.js:1180-1188`),
   which route through this same `onerror`. `towns.js` already short-circuits
   those (~`towns.js:143-159`). As written, once the budget is gone mid-sweep
   the farm loop burns the whole remaining ladder instantly with no spacing.
5. Decide explicitly what the Diag "test fetch" path does: `ui.js:1849` calls
   `fetchFarmResources` directly, outside `scrapeAllFarms`. It should stay
   allowed (it is a manual probe and the way the endpoint gets re-learned), so
   put the breaker/toggle check in `scrapeAllFarms`, not in
   `fetchFarmResources`.
6. Preflight row `farm resource scrape`: pass / warn (never learned, or
   disabled) / fail (learned but 0 ok in the last sweep).

Not in scope: inventing a replacement endpoint. Farm-village stock is not in the
bridge model, and the only consumers are the Farms tab columns + threshold
flashes.

### A2. The two town guess ladders have no learned-action cache at all

- `towns.js:102` `TOWN_ACTION_GUESSES` is 6 deep x N towns. Unlike farms there is
  **no** cached winner: `fetchTownResources` (`towns.js:101-149`) always starts at
  `tryGuess(town, 0)`; no `townAction` symbol exists in `src/`. The screenshot
  shows `2 towns | 2 ok`, so some index succeeds - but every miss before it is a
  charged slot on every sweep.
- `towns.js:21` `TOWN_LIST_GUESSES` (5 deep) has the same problem in
  `fetchOwnedTowns`. It only fires when `state.towns` is empty, so it is
  lower-frequency, but it still remembers nothing.

Add a world-scoped `state.townAction` (+ `state.townListAction`) mirroring
`state.farmAction`, try it first, log once when it stops working.

Implementation note: `STORE.FARM_ACTION` is already in `WORLD_SCOPED_BASES`
(`header.js:189`), so `load()`/`save()` apply `wkey()` themselves - the explicit
`wkey()` in `learnFarmAction` (`farms.js:624`) is belt-and-braces, not the
mechanism. Do the same for the new keys and do **not** trust
`docs/error-patterns.md` §15/§24 here: it still describes a legacy
`wkey(...) || load(...)` fallback at `core.js:313` that no longer exists
(`farmAction` loads plainly at `core.js:233`). That doc needs a correction line.

### A3. Give actions a floor in the request budget

Root cause behind A1/A2: one 40/min pool serves scrapers (`gbXhr`) and actions
(`bridgePost`/`txRun`), so a scraper can starve an action with a hard timing
window. Note a soft ceiling already exists for **writes** -
`reqBudgetSoftDelayMs` (`core.js:721-728`) delays writes past
`postsPerMinSoftPct` (default 60, `core.js:354`) - but it throttles the actions,
not the scrapers, which is backwards when the scraper is the noisy one.

Proposal: scope-aware admission in `reqBudgetOk(scope)` - scrapes rejected above
a scrape cap (proposal 60% of the pool), actions keep the full pool. Surface both
pools in Stats.

Two constraints found while verifying, both must hold or this makes things worse:

- **Three buckets, not two.** `gbXhr` defaults everything without an explicit
  `scope` to `game` (`core.js:1176`), which today lumps the dead farm scrape in
  with report catch-up (`spy.js:157`, `fetchReportHttp`) - a time-sensitive
  intel path. Tag it separately (`scrape` / `read` / `action`) so catch-up is not
  throttled like the noise.
- **`gbWakeDrain` (`core.js:632`) must stay scope-neutral.** Wake entries are
  heterogeneous and carry no scope: `gbWake` callers include `ibScan`
  (`boot.js:55,63,82`), `orchTick` (`boot.js:105`, dispatches real writes),
  `farmTick` (`farms.js:864`, triggers the scrape) and `reportCatchUpRun`
  (`spy.js:120`). Either add per-item scope metadata to the queue or leave that
  gate alone and let the inner `gbXhr` / `txRun` calls do the scope-aware
  admission. Do not pass a fixed scope at line 632.

---

## B. P1 - genuinely open backlog items (re-verified, three of the five were wrong)

| # | Item | Verified status | Plan |
|---|------|-----------------|------|
| B1 | Captcha backoff UI | **OPEN.** `state.captchaLadder` default `[5,15,60]` (`core.js:353`), read at `core.js:848`, used at `core.js:1312`; zero hits in `ui.js` - the ladder is unreachable from the panel | 19 |
| B2 | Alliance notes UI | **OPEN, but the backlog names a function that does not exist.** There is no `intelSetAllianceNote` anywhere; `state.allianceNotes` has read paths only (`intel.js:66-67,103-106`, default `core.js:327`, redaction `qol.js:230`) and **no setter of any kind**. Work = write the setter + wire an Intel row, not "add a caller" | 03 |
| B3 | Config presets | **OPEN.** No preset mechanism outside `tradePreset` (`ui.js:717-718,1268,1388-1390`); zero `preset` hits in `qol.js` | 16 |
| B4 | Sticky sort/filters | **PARTLY DONE - narrow the scope.** `state.findingsFilter` already persists and restores (`core.js:270`, `ui.js:1523-1543`), and click-to-sort already exists (`makeSortable` `ui.js:1`, applied by `tableShell` `ui.js:35-49` to Farms `ui.js:93` and World `ui.js:165`). Open: the chosen sort is lost whenever the row **set** changes (`tbody.replaceChildren()` in `renderFarms`/`renderWorld`) and across reloads; the Journal filter (`ui.js:894,1527`) is not persisted; `state.tabFilters` (`core.js:355`) is loaded but never read or written | 18 |
| B5 | Humanization soft ceiling | **MECHANISM DONE, UI MISSING.** `postsPerMinSoftPct` (`core.js:354`) + `reqBudgetSoftDelayMs` (`core.js:721-728`) + write hook (`tx.js:575-580`) already implement the soft cap. Only remaining work: expose it in Config and show the current delay in Stats | 22 |

B1 and B5 are the cheapest (two Config fields). B2 pairs with B4's dead-state
cleanup. B3 pairs with A1 (an "AFK" preset should turn the dead scrape off).

### B6. Orphan state flags - one is a whole missing feature, three are litter

`BACKLOG.md` lists plan 05 (warehouse deadlock resolver) as the #2 ROI item and
the flag exists, but `state.orchDeadlockResolve` (`core.js:356`, key
`header.js:167`) is **loaded once and never read**; no deadlock logic exists
under any name. Either implement plan 05 (full warehouse + farm paused -> force
cave -> trade -> rural before farm) or delete the flag and its storage key.
Shipping a Config-shaped boolean that does nothing is worse than neither.

A field-by-field diff of every `state.*` initializer in `core.js` against all
uses in `src/` (147 fields) found only these with <=1 real use:

| Field | Where | Status |
|-------|-------|--------|
| `orchDeadlockResolve` | `core.js:356`, key `header.js:167` | dead - feature never built (above) |
| `tabFilters` | `core.js:355` | dead - abandoned start on B4 |
| `abNextAt` | `core.js:277`, key `header.js:70` | dead - zero other references |
| `tradeMaxHops` | `core.js:357`, key `header.js:168` | dead - never wired into the trade graph |
| `dodgeMode` | `core.js:313` | legacy - read only by the migration at `core.js:489` into `state.defenseCfg.mode`; live control writes `STORE.DEFENSE_CFG` (`ui.js:1367`). Keep, but comment it as migration-only |

Delete or wire each one, and add the same sweep to the build gates if it is
cheap (a `state.` initializer with no other reference is mechanically
detectable in `build.py`).

---

## C. P2 - new features (not in the backlog)

### C1. Adaptive claim duration (the unused mid options)

`FARM_DURATIONS` (`farms.js:304`) is `[300,600,1200,2400,5400,10800,14400,28800]`,
but `farmDesiredDuration` (`farms.js:400-403`) only ever returns 300 or 600, and
sleep claim (`farms.js:395-397`) only picks 14400/28800. Everything from 20min to
3h is reachable and unused.

Pick the longest **learned** option (present in `state.farmOptionMap` - never
guess an index, CLAUDE.md "claim timers") whose expected haul still fits
warehouse headroom (`townResState`) and whose end lands before the next expected
session. Fewer claims = fewer posts = less captcha surface and more loot per
request; it also directly relieves the budget pressure in §A.

### C2. Budget/starvation visibility in Stats

Stats renders the budget total; add slots consumed by scope (scrape vs action),
current `reqBudgetSoftDelayMs` value, and the count of `skip:budget` decisions in
the window. This is what would have surfaced A1 without a screenshot.

### C3. Preflight coverage for modules added since v1.5

`preflightRun` (`stats.js:12-191`) already probes `resource planner`
(`stats.js:171`) and `goal planner` (`stats.js:172`). Genuinely unprobed:
`native-ui.js`, `queue-center.js`, `phoenician.js`, `build-targets.js`,
`build-auto.js`, `tx.js`, `bridge.js`. (The `bridge` row at `stats.js:16-19`
probes the *game's* `MM`/`gpAjax` via `gameBridgeStatus()`, not our
`src/bridge.js`.) Add read-only probes - native queue mount points, Queue Center
town resolution, phoenician learned view URL + template, tx in-flight registry -
so a broken mount shows up before a play session, not during one.

---

## D. Docs drift (do first - ~20 minutes, and it stops the next plan being written off stale tables)

1. `BACKLOG.md` header says "Last reviewed 2026-08-07 against v1.5.14"; tree is
   v2.9.1. Verified **shipped** since, with evidence: 01 trade party/unit presets
   (`trade.js:175-222`, dispatch `trade.js:326`), 04 evidence dump
   (`stats.js:301`), 07 island trade (`trade.js:134`, called `trade.js:329`),
   08 culture/cave coordination (`ironReservedForCave` defined `core.js:658`,
   called `trade.js:178-179`; `culture.js:108`), 11 template health
   (`core.js:753-812`), 12 support ETA (`intel.js:89`), 13 attack patterns
   (`intel.js:109-111,212`), 14 offline report catch-up (`spy.js:117-163`),
   15 watchlist why (`intel.js:133-193`), 20 storage quota prune
   (`core.js:1087`), 23/24/25 (v1.6).
   Verified **not** shipped despite appearances: 05 warehouse deadlock (see B6).
2. `CLAUDE.md` "Repo layout" (lines 15-20) lists a module set that no longer
   matches `build.py` MODULES (`build.py:31-72`) - missing `planner.js`, `tx.js`,
   `bridge.js`, `goals.js`, `build-targets.js`, `native-ui.js`, `build-auto.js`,
   `phoenician.js` - and the concat order shown is wrong too (`journal.js` is not
   second any more). Regenerate that block from `MODULES`.
3. `TASKS.md` "Current phase" (line 6) still opens on the v1.6 gates (line 8).
   Re-head it on the v2.9.x gates (academy queue, Queue Center, ASCII artifact)
   plus A1.
4. `docs/error-patterns.md` §15/§24 describe a `core.js:313`
   `wkey(...) || load(...)` fallback for `STORE.FARM_ACTION` that no longer
   exists (see A2). Correct or strike those two paragraphs before anyone plans
   world-scoping work off them.

---

## Order of work

```
D (docs)  ->  A1  ->  A3 + C2  ->  A2  ->  B1 + B5  ->  B6 decision  ->  B2 + B4  ->  B3  ->  C1  ->  C3
```

A1 is the only item that changes live behaviour immediately; ship it alone, bump
`@version` in `src/header.js`, `python3 build.py`, install, and validate.

## Validation (per CLAUDE.md - dry run, no test harness)

- A1: Config -> scrape OFF; over 15 min the Log has zero `farm <id>: no data`,
  and Stats budget never approaches the ceiling during a farm sweep.
- A1/A3: with scrape ON and 12 villages, a hand-triggered farm claim fired
  during a sweep must still post - no `skip:budget` in the Decisions view.
- A2: Log shows `towns endpoint = <action>` once, and later sweeps issue one
  request per town instead of up to six.
- B5: change the soft percentage in Config; Stats shows the delay moving.
- C1: teach a 20min option by hand -> Log `farm: learned claim option n = 20min`;
  a town with headroom claims 20min, a near-full town stays at 5min.
