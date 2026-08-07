# 08 — Culture ↔ cave coordination

**Risk:** Low · **Size:** S · **Backlog:** §3.4

## The conflict

Both features want the same iron:

- `cultureScan` starts a festival at `party: {wood:15000, stone:18000, iron:15000}`
  (`culture.js:5-6`) — it checks `r.iron < cost.iron` (`culture.js:91`) and fires
  when affordable.
- `caveScan` stashes iron when `iron ≥ caveThreshPct%` of warehouse (default 90%).

A festival spends 15k iron moments before the cave threshold would have been
reached, so the stash never happens; or the cave stashes first and the festival
is delayed a full cycle. Neither is wrong in isolation — they simply do not know
about each other. Orchestration runs them independently (`orchestrate.js:50-51`).

## Goal

When a town's iron is within a short window of the cave threshold, let cave win;
otherwise let culture proceed. One tiebreak, in one place.

## Design

1. **Shared helper** — put it beside `townResState` in `core.js` so both modules
   read one definition:

   ```js
   function ironReservedForCave(townId)  // → {reserved:boolean, etaMs, blind:boolean}
   ```

   - `reserved` when `state.autoCave` is ON, the town has a hide building, the
     hide is not full, and projected iron reaches `caveThreshPct%` within
     `CAVE_SOON_MS` (default ~15 min) at current production.
   - Any input unreadable ⇒ `blind: true`, `reserved: false`. Culture proceeds.
     Blind must never silently block culture forever.
2. **Culture defers**: in the affordability check, if `ironReservedForCave(town)`
   says reserved, skip that town this cadence and `gbLogT` once
   (`culture-defer-<townId>`). Cave's next orch turn drains it, then culture runs.
3. **Bounded deferral.** Cap consecutive defers per town (e.g. 3). After that,
   culture wins — otherwise a town that hovers just under the cave threshold
   could starve culture indefinitely. Log the override.
4. **Direction is deliberate:** cave wins the tiebreak because stashed iron is
   protected from raids, while a festival is a discretionary spend. Culture is
   only delayed, never cancelled.

## Files

- `src/core.js` — `ironReservedForCave`, `CAVE_SOON_MS`
- `src/culture.js` — defer check in the affordability path (`culture.js:89-91`)
- `src/cave.js` — no behaviour change; optionally expose its threshold helper so
  the core function does not re-derive it
- `src/stats.js` / Evidence (plan 04) — show current defers

## Risks

- **Starvation** of culture — bounded by the defer cap; do not omit it.
- **Double-counting** if `ironReservedForCave` re-derives capacity differently
  from `townResState`. It must call the shared reader, not read the model again.
- Depends on plan 05 only loosely; either order works, but both should use the
  same pinned/threshold helpers rather than growing a second copy.

## Validation

1. Town at 85% iron with cave ON and threshold 90% ⇒ culture defers, one log
   line, cave stashes on its next turn, culture then runs.
2. Same town with `autoCave` OFF ⇒ culture runs immediately, no defer.
3. Hide full ⇒ no reservation, culture runs.
4. Unreadable iron/capacity ⇒ `blind`, culture runs, single log line.
5. Town held just below threshold for 4 cycles ⇒ defer cap trips, culture runs,
   override logged.
6. Dry-run ON: no change in total posts, only in ordering.

## Done when

- Culture and cave stop cancelling each other on the same town.
- Deferral is bounded, visible, and never triggered by an unreadable value.
