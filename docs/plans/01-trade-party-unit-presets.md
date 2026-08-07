# 01 — Trade `party` / `unit` presets

**Risk:** Med · **Size:** M · **Backlog:** §1, Top-ROI #4

## Current state

`state.tradePreset` is read (`trade.js:151`) and the Config select offers all
three values (`ui.js:666`, labelled *"party (unimplemented)"*). The `party`/`unit`
branch logs and skips:

```js
// trade.js:155-157
} else if (state.autoTrade && (preset === 'party' || preset === 'unit')) {
  gbLogT('trade-preset-' + preset, 300000, `trade: preset=${preset} — unimplemented, fill-storage skipped`);
}
```

This is correct behaviour (it does not silently run storage) but the UI promises
a feature that does nothing. Selecting `party` makes `autoTrade` a no-op — a
user-visible trap.

## Goal

Both presets become **deficit-driven** planners: instead of "even out the
warehouses", ship exactly what a named goal is short of, and stop when the goal
is funded.

| Preset | Goal | Deficit source |
|---|---|---|
| `party` | Fund a culture celebration in each culture-enabled town | `CULTURE_COSTS[type]` (`culture.js:5`) minus town stock |
| `unit` | Fund the configured recruit queue | `state.recruitTargets[townId]` × unit cost from unit metadata (`recruit.js:88-153`) |

## Design

Add to `trade.js`, reusing the existing ledger so I9 stays fixed:

```js
function tradeGoalDeficit(townId, preset)   // → {wood,stone,iron} | null (blind)
function tradeGoalJobs(towns, L, preset)    // → jobs[], ledger-aware
```

1. **Target selection.** For each town, compute the goal cost.
   - `party`: the type `cultureScan` would pick for that town. Reuse
     `CULTURE_COSTS`; **exclude `olympic`** — it is 50 gold + Academy 30, not
     resources (`culture.js:3`), so it can never be funded by trade.
   - `unit`: sum `unitCost × count` over `state.recruitTargets[townId]`. If any
     unit's cost is unreadable, that town's deficit is **blind** — skip the town
     and `gbLogT` once. Same rule as `recruit.js:145`: unknown cost must block.
2. **Deficit** = `max(0, cost.X − ledger[town].X)` per resource. Zero deficit ⇒
   town is funded ⇒ no job.
3. **Source selection.** Reuse the `tradeFillStorageJobs` donor rule — donor must
   be above `reserve`, have `tradeCap ≥ minBatch`, and not be the target. Prefer
   the donor with the largest surplus **of the specific resource needed**, not the
   largest overall fill.
4. **Cap the job** at `min(donor.tradeCap, deficit)` and `tradeApplyJob` it into
   the ledger before considering the next job. Same 6-job ceiling.
5. **Never overshoot.** A job that would push the target above `cost` is clamped
   to the deficit — the point is to fund a goal, not to fill a warehouse.
6. `islandShip` jobs still append afterwards, unchanged.

## Interaction with plan 08

`party` trade and cave stashing compete for iron. Land 08 first, or gate `party`
behind the same "iron reserved for cave" check, otherwise trade ships iron out of
a town that cave is about to need.

## Files

- `src/trade.js` — new functions + wire the `party`/`unit` branch
- `src/ui.js:666` — drop "(unimplemented)" from both option labels
- `src/culture.js` — export nothing new; `CULTURE_COSTS` is already in scope
  (single IIFE), but **verify concat order**: `culture.js` precedes `trade.js` in
  `build.py`, so the const is initialised. Confirm before relying on it.

## Risks

- **Freighter burn.** A goal 40k short with 5k tradeCap generates a job every
  cadence for hours. Mitigate: skip when `deficit > donorTradeCap × 4` and log —
  the goal is unreachable this session.
- **Thrash with fill-storage.** Presets are mutually exclusive by design (the
  `if/else` already enforces it). Do not "helpfully" run storage as a fallback.
- **Cross-island.** Depends on plan 07; until then a `party` job can burn a
  cross-island trip.

## Validation

1. Dry-run ON. Set preset `party`, one town below festival cost.
   Expect `DRY-RUN trade: {...}` with wood/stone/iron ≤ deficit, no send.
2. Hand-run one festival to fund the town; next scan must produce **no** job.
3. Preset `unit` with `recruitTargets` empty ⇒ single `gbLogT`, no jobs.
4. Preset `unit` with a unit whose cost is unreadable ⇒ town skipped, logged
   once, other towns still planned.
5. Stats tab: `trade` success rate unchanged; no new error class.
6. Dry-run OFF on `es146`, one job only, confirm arrival matches the payload.

## Done when

- Both presets produce clamped, ledger-aware jobs and stop at the goal.
- `ui.js` no longer says "unimplemented".
- A funded town generates zero jobs (idle, so `orchIdleFactor` widens the
  cadence rather than spinning).
