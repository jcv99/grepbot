# 23 — Custom per-town build queue

**Risk:** Low · **Size:** M · **Status:** CODED in v1.6.2

## Problem

`abScan` built toward per-building target levels (`state.abTargets`) chosen by a
weight/ETA heuristic (`buildPlanNext`), with one pinned building per town
(`abGetPin`). There was no way to say "in this town, build exactly this sequence,
in this order".

## Design

`state.abCustomQueue = { [townId]: [{ b, lvl }, …] }`, stored under
`STORE.AB_CUSTOM_Q` and world-scoped (the key is in `WORLD_SCOPED_BASES`, because
a town id means nothing on another world).

- Helpers in `build-tab.js` next to the pin helpers: `abCqGet/Set/Add/Remove/Move`,
  `abCqWantLevel` (an entry with no `lvl` means "+1 from here"), `abCqPrune`.
- `buildPlanNext(townId, n)` consumes the custom list at the head of the plan:
  the first unsatisfied entry becomes the pick (`custom: true`, score `Infinity`),
  the scratch ledger and simulated levels advance exactly as for a heuristic
  pick, and the existing weight/ETA path fills whatever slots remain. A non-empty
  custom queue **supersedes the pin** and logs that once.
- `abPickBatch` honours order: `state.abQueueStrict` (default ON) stops at the
  first unaffordable entry instead of building past it; OFF skips it and logs.
  `blind` (unreadable cost) still never blocks — server stays the authority.
- `abCqPrune` drops satisfied entries. `abCurrentLevels` already folds queued
  orders into levels, so an entry clears as soon as its upgrade is queued.
  Pruning runs in `abScan` per town and in `renderAbQueue`.

## UI

Build tab, between "Next 3" and the target table: ordered rows (`.cq-row`,
`renderCqRows`) with ▲/▼/✕, a building select + level input + **Add**, plus
**strict**, **Copy to all** (confirm) and **Clear**. Custom rows in the "Next 3"
plan render with the `.custom` background so they are distinguishable from a pin.

## Validation

Dry run ON → queue three buildings, confirm the `DRY-RUN build: … buildUp`
sequence matches the list order, then that entries disappear as their orders are
queued.
