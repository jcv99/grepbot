# 05 — Warehouse deadlock resolver

**Risk:** Med · **Size:** M · **Backlog:** §3.1, Top-ROI #3

## The deadlock

Overnight, a town fills its warehouse. Then:

- `autoClaimFarms` has nowhere to put loot ⇒ farm claims are wasted or skipped.
- `caveScan` only fires at `iron ≥ caveThreshPct%` — it drains **iron only**
  (`BuildingHide`/`storeIron`), so wood/stone stay pinned at cap.
- `tradeFillStorageJobs` requires a target below 25% empty (`trade.js:77-78`)
  — if *every* town is full, no town qualifies as a target, so trade produces
  zero jobs.
- Orchestrator then sees farm/cave/trade all returning nothing, and
  `orchIdleFactor` **widens their cadence up to 8×** (`orchestrate.js:97-102`).

That last step is the trap: the adaptive backoff is correct for "nothing to do"
but here it is "cannot do anything *yet*", and it makes recovery slower the
longer the deadlock lasts. The bot goes quiet exactly when it should act.

## Goal

Detect the pinned state and force the drain order **cave → trade → rural**
before farm, and suppress adaptive widening while a deadlock is open.

## Design

1. **Detect.** New `econDeadlock()` in `orchestrate.js` (or `core.js` beside
   `townResState`):
   - a town is *pinned* when `max(wood,stone,iron) / cap ≥ 0.97` using the shared
     reader `townResState` (`core.js:1115`) — one definition, no second opinion.
   - deadlock = **≥1 enabled town pinned** AND farm enabled AND farm produced no
     journal entry for ≥2 cadences.
   - `cap` unreadable ⇒ **not** a deadlock (blind ≠ pinned). Log once via
     `gbLogT`. Precondition invariant: only block on a value actually read.
2. **Resolve.** While a deadlock is open, `orchTick` overrides its due-list sort:
   promote `cave`, `trade`, `ruraltrade` ahead of `farm` regardless of
   `priorityOrder`, and set `orchIdleFactor` to 1 for those three.
3. **Relax the trade target rule.** Under deadlock, `tradeFillStorageJobs` may
   target a town that is *not* below 25% empty, provided it has headroom in the
   specific resource being shipped. Pass an explicit `opts.deadlock` flag — do
   **not** loosen the default rule, which exists to stop pointless shuffling.
4. **If nothing can drain** (all towns pinned, cave full, no rural target), log
   once and stop — do not spin. Surface it as a footer/Stats warning instead;
   this is a "go spend resources" signal for the human.
5. **Clear** when no town is pinned; restore normal ordering and log the exit.

## Interaction

- Plan 08 (culture↔cave) shares the "iron reserved" idea; land 08 after this one
  and let both read the same pinned/reserve helper.
- Plan 22 (posts/min ceiling): a deadlock burst must still respect the request
  budget. The resolver changes *order*, never the ceiling.

## Files

- `src/orchestrate.js` — `econDeadlock()`, tick override, idle-factor bypass
- `src/trade.js` — `opts.deadlock` relaxation in `tradeFillStorageJobs`
- `src/stats.js` — Stats + Evidence show `deadlock: open/closed` and which towns
- `src/ui.js` — footer badge (e.g. `⚠WH`) while open

## Risks

- **Freighter burn**: shuffling between two full towns achieves nothing. Guard:
  a deadlock trade job must strictly reduce the *pinned* resource in the source
  and the target must have real headroom in that resource.
- **Priority override surprises the user** — their `priorityOrder` is being
  ignored. Must be visible (badge + log), and ideally a toggle
  (`orchDeadlockResolve`, default ON since it is not a new post class).
- Do not add a new scheduler. This is a sort override inside `orchTick`, per the
  v1.1.0 regression note.

## Validation

1. Dry-run ON. Fill a test town to ~100% ⇒ Evidence shows `deadlock: open`, and
   the dry-run log shows cave/trade attempts ordered before farm.
2. Confirm `orchStatus()` shows cave/trade cadence back at base (idle factor 1)
   while open.
3. Drain the town by hand ⇒ deadlock closes, ordering returns to `priorityOrder`,
   exit logged.
4. All towns full + cave full ⇒ exactly one log line, no repeated attempts.
5. Unreadable `cap` (spoof by disabling the getter) ⇒ no deadlock declared, one
   `gbLogT`, normal scheduling continues.
6. Overnight dry-run soak: request budget never exceeded.

## Done when

- A pinned warehouse triggers cave/trade/rural ahead of farm, visibly.
- Adaptive backoff cannot slow the recovery path.
- Blind capacity never fabricates a deadlock.
