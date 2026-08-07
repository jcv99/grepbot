# 07 — Island-aware trade graph

**Risk:** Low · **Size:** S · **Backlog:** §3.3

## Current state

`tradeFillStorageJobs` (`trade.js:68-108`) pairs any town with any other town.
It reads `small` (`on_small_island`, `trade.js:16-17`) but only
`tradeIslandShipJobs` uses it, and only to route mainland → small island.

Island identity **is** available elsewhere: `towns.js:9,70` already capture
`island: a.island_id`, and `attack.js:106` has `isSameIsland(srcTownId, target)`.
`tradeTownRes` simply does not carry it.

So a fill-storage job between two towns on opposite sides of the map is
indistinguishable from one between neighbours — same plan, wildly different
freighter round-trip time.

## Goal

Prefer same-island trades; refuse long cross-island hops that tie up freighters
for hours to move resources that were not urgent.

## Design

1. **Carry island id.** Add `island` to the `tradeTownRes` return
   (`trade.js:19-23`), sourced the same way `towns.js:70` does it. Unreadable ⇒
   `island: null`.
2. **Distance.** Same island ⇒ 0. Different island ⇒ Chebyshev/Euclidean distance
   between island coords (already carried as `x`/`y` in `towns.js`).
3. **Rank donors** by `(surplus, −distance)` — a slightly smaller same-island
   surplus beats a large one across the map.
4. **Refuse** when `distance > tradeMaxHops` (new config, default modest) **and**
   the job is not urgent. Log once per pair per window.
5. **Blind handling.** `island == null` for either town ⇒ **do not refuse**.
   Treat unknown distance as allowed and log once. Refusing on an unreadable
   value would silently stop all trade the day a getter is renamed — the exact
   dead-guard failure the precondition invariant forbids.
6. **Exemptions:** `islandShip` jobs are cross-island *by definition* — they must
   bypass this rule entirely. Plan 05's deadlock jobs should also bypass it: a
   pinned warehouse is urgent.

## Files

- `src/trade.js` — `island` field, donor ranking, refusal rule
- `src/core.js` — `STORE.TRADE_MAX_HOPS`
- `src/ui.js` — Config number input beside `tradeReservePct`/`tradeMinBatch`
  (`ui.js:1175-1176`)

## Risks

- **Over-refusal starves a legitimately isolated town.** Mitigate with the
  urgency bypass and by making the threshold configurable.
- Reusing `isSameIsland` from `attack.js`: check concat order in `build.py` —
  `attack.js` comes **after** `trade.js`, so the function is not initialised when
  `trade.js`'s top level runs. It *is* available at call time (same IIFE, function
  declaration hoisting), but confirm rather than assume; the safe move is a small
  local helper in `trade.js`.

## Validation

1. Two towns, same island ⇒ job planned as before (no regression).
2. Two towns, distant islands ⇒ job refused, logged once, not once per scan.
3. Set `tradeMaxHops` high ⇒ the same job is planned again.
4. `island` unreadable on one town ⇒ job **allowed**, single log line.
5. `islandShip` still ships mainland → small island regardless of the setting.
6. Dry-run ON overnight: no increase in idle-trade log spam.

## Done when

- Donor selection prefers same island.
- Cross-island fill-storage beyond the threshold is refused and visible.
- Unknown island never blocks a trade.
