# 24 — Instant build: precise arming + all towns

**Risk:** Low · **Size:** M · **Status:** CODED in v1.6.2

## Problem

Two gaps in the free-complete path (`ibScan`, `build-tab.js`):

1. **Late.** The only trigger was a 10s `gbInterval`, so a window opening at T
   was caught anywhere in T..T+10s — and a backgrounded tab clamps that interval
   to ~60s. Wanted: post inside the 4:50–5:00 band.
2. **Blind outside the current town.** Orders were read from the MM
   `BuildingOrder` / `ResearchOrder` collections, which only carry loaded towns,
   so a free order in any other town was never seen.

## Design

**Arming.** Every order now carries `active` (first order of its town — the only
one whose clock is running). `ibArmNext(orders)` takes the nearest
`display - ibFreeThresh()` in the future and arms **one** timer at that instant
+1.2s +0..1.5s jitter, re-armed on each scan and cleared when nothing counts
down. `ibArmedAt()` exposes it to Preflight. The 10s interval and the
`button_build` click hook stay as safety nets — the timer only accelerates a
scan, it never gates one. `boot.js` also kicks `gbWake('ibScan', …)` on
`visibilitychange` and `pageshow`, because a clamped hidden-tab timer can fire
late.

**All towns.** `ibTownCollections(kind)` walks `abTownIds()` and reads each
town's own `buildingOrders()` / `researchOrders()` through `abGetTown` — the
same per-town path `abQueueInfo` already uses — and `ibOrders` merges those with
the MM collection, deduping by order id (`seenIds`). `ibTownCoverage()` reports
readable/total for Preflight.

Unchanged safety: `gold === 0` requirement, no `buyInstant` fallback, timeout =
reconcile only, `ibFindLiveOrder` re-read immediately before posting.
`ibComplete` already sends `town_id: live.town_id`, so cross-town posts needed no
payload change.

## Validation

Preflight "instant build" row shows `order queues readable N/M towns` and
`next arm in …`. In-game: watch a build in a non-current town cross 5:00 and
confirm the post lands with 4:50–5:00 remaining.
