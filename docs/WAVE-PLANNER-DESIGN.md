# Wave planner merge — design note

OPEN-PLAN 2.6: attack.js + reinforce.js have 5 near-identical function pairs (~250 LOC, HIGH risk). Strategy pattern recommended per research fact sheet.

## Status: DEFERRED

Risk profile too high for batch edit without in-game validation on `es146`. Per Strangler-Fig + Expand/Contract:

- Step 1 (extract): land a new `wave-planner.js` with the 5 shared functions, keep both attack.js/reinforce.js calling it through thin wrappers. **Safe** if the shared fns are 1:1 verbatim.
- Step 2 (parameterise): replace per-mission branches (units for target, sources filter, arm/fire confirm text) with a `mission` parameter. **Medium** — each call site changes behaviour.
- Step 3 (delete legacy): drop attack.js/reinforce.js wrappers, route everything through wave-planner. **Irreversible** — Expand/Contract step 4.

Steps 2 and 3 require the smoke driver run + a real-world arm/fire cycle. Out of scope for the batch phase 2 sweep.

## Function pairs to extract

| Pair | attack.js | reinforce.js | Shared shape |
|---|---|---|---|
| `buildAttackSchedule` ↔ `rfBuildSchedule` | 473-505 | 175-207 | pick sources → fit army → spread travel |
| `armAttackWave` ↔ `rfArmWave` | 647-745 | 311-395 | stale units + delay + fresh-units loop |
| `fireAttackNow` ↔ `rfFireNow` | 746-774 | 396-440 | confirm gate → bridge post |
| `resolveTarget` ↔ `rfResolveTarget` | 351-397 | 128-149 | target id resolver |
| `attackUnitsForTarget` ↔ `rfUnitsForTarget` | 458-471 | 118-127 | unit roster per target |

## Mission discriminator

The two paths differ only in:
- `supportTpl.action_name` vs `attackTpl.action_name`
- target validation (own towns only for reinforce)
- confirm text (Spanish: "Refuerzos a X" vs "Atacar X")
- sources filter (attack excludes target town, reinforce allows same-island)

## Proposed signature

```js
// wave-planner.js (new module)
function buildWaveSchedule(target, opts) { /* opts: { mission, tpl, sources } */ }
function armWave(target, opts, onDone) { /* opts: { mission, tpl, sources, maxMs } */ }
function fireWaveNow(target, opts, onDone) { /* opts: { mission, confirm } */ }
function resolveWaveTarget(input, opts) { /* opts: { mission } */ }
function unitsForWaveTarget(target, opts) { /* opts: { mission } */ }
```

## Migration sequencing

1. Create wave-planner.js with verbatim-extracted copies of the 5 functions
2. Land arm wave-planner.js export; attack.js and reinforce.js each call into it
3. Verify smoke + in-game that both paths still work
4. Parameterise (Step 2)
5. After validation, drop the wrappers (Step 3)

Each step is its own commit, its own version bump, its own smoke run.
