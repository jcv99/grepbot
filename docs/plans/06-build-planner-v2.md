# 06 — Build-phase planner v2

**Risk:** Low · **Size:** L · **Backlog:** §3.2

## Current state

`build-tab.js` (30.8 KB) runs `abScan` on a 30s orch cadence
(`orchestrate.js:21,52`) with `abEnsureTargets()` + `AB_CHECK_MS`/`abRandMs`
jitter, and `ibScan` handles instant-build on its own 10s loop. There is no
resource-aware ordering and no lookahead — `grep -riE "buildPlan|planNext"` = 0.

## Goal

1. Pick the next building **by affordability and payback**, not just list order.
2. Show the **next 3** on the Build tab so the user can see and override the plan.

## Design

### Scoring

For each candidate building in the town's target list:

```
affordable = gbAfford(cost)            // {ok, blind, short, detail}
etaMs      = time until `short` resources accrue at current production
score      = phaseWeight(building) / (etaMs + queueWaitMs)
```

- `gbAfford` already returns the `blind` verdict (`CLAUDE.md`, v1.5.4). **Blind
  ⇒ score it as affordable and let the server reject**, log once. Never let a
  renamed getter silently freeze the planner — that is the exact failure mode the
  precondition invariant exists to prevent.
- `phaseWeight`: early game favours warehouse/farm(pop)/timber; mid favours
  academy/harbour; late favours barracks/docks. Keep the table small, explicit
  and in one place — this is a heuristic, label it as such.

### Lookahead

- Simulate the queue: apply the chosen building's cost + build time to a scratch
  copy of town resources/production, then re-score for slots 2 and 3.
- Pure function, no posts. `buildPlanNext(townId, n = 3)` → array.
- Recompute per render; do not persist a stale plan.

### Execution

- `abScan` asks `buildPlanNext(townId, 1)[0]` instead of walking the raw target
  list. Existing precondition checks (free queue slot, resources, population)
  stay exactly as they are — this changes *selection*, not the guard.
- **Population** is a real blocker: a building that needs pop the town does not
  have must not be picked when a farm upgrade would unblock it. Prefer the
  unblocking building.

### UI

- Build tab: "Next 3" list per town — building, level, cost, `ok`/`short by X`/
  `blind`, ETA.
- Manual override: pin a building to slot 1 (persist per town, world-scoped).

## Files

- `src/build-tab.js` — `buildPlanNext`, `phaseWeight`, `abScan` selection
- `src/ui.js` — Next-3 rows (keyed rows, see plan 21)
- `src/core.js` — `STORE.BUILD_PIN` + `WORLD_SCOPED_BASES` (town ids)
- `src/stats.js` — preflight row: building-cost readable?

## Risks

- **Heuristic sprawl.** `phaseWeight` will attract endless tuning. Keep it one
  table, document that it is a heuristic, resist per-world special cases.
- **Blind reads freezing the planner** — covered above; must fall through.
- **Bad advice is cheap, bad posts are not.** Displaying Next-3 is harmless;
  changing `abScan` selection is the part that needs the dry-run gate.
- Size L — consider shipping the read-only Next-3 panel first, and only switching
  `abScan` over once the displayed plan looks right for a few days.

## Validation

1. `buildPlanNext` on a known town matches a hand-computed answer.
2. Blind cost read ⇒ candidate still scored, logged once, planner not frozen.
3. Population-blocked building ⇒ farm upgrade is chosen ahead of it.
4. Dry-run ON: `abScan` posts the same building the Next-3 panel shows in slot 1.
5. Pin a building ⇒ it takes slot 1 until built, survives reload, world-scoped.
6. No new interval added (`grep gbInterval src/build-tab.js` unchanged).

## Done when

- Next-3 renders per town with cost/ETA/verdict.
- `abScan` selects by score, with all existing preconditions intact.
- A renamed getter degrades to "let the server decide", never to a stall.
