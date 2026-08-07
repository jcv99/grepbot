# 10 — Resume-burst serializer

**Risk:** Low · **Size:** M · **Backlog:** §3.6 (audit "P6 leftover / main captcha trip vector")

## The problem

Several independent wake paths fire on tab focus / visibility change:

- `farmTick` runs on a 15s interval **and** on `visibilitychange`, firing a scrape
  when `Date.now() >= nextFarmScrape` (`CLAUDE.md`, farm scrape loop).
- The towns scrape has the same deadline pattern (`nextTownsScrape`).
- `ibScan` has its own 10s loop; `autoCollectResources` polls every 5s;
  `banditIdleUntil` wakes bandit; `orchTick` runs every 20s.

After the tab is backgrounded (timers throttled to ~1 min, or bfcache-frozen),
**every one of those deadlines is simultaneously overdue**. On focus they all
fire in the same second: farm scrape + towns scrape + instant-build + collect +
bandit + up to 3 orch features. That burst is the most human-implausible traffic
the bot ever emits, and it is the prime captcha trigger.

`orchTick` already spaces its own picks (`ORCH_SPACING_MS = 450`,
`orchestrate.js:16,181`) — but it only controls its own 12 econ features, not the
scrapers, `ibScan`, collect, or bandit. `grep -riE "resumeBurst|wakeQueue"` = 0.

## Goal

One wake queue. On resume, drain overdue work **serially with spacing and
jitter** instead of in parallel.

## Design

1. **Central queue** in `core.js`:

   ```js
   gbWake(key, fn, {priority})   // enqueue, dedupe by key
   ```
   Draining runs one entry per `WAKE_SPACING_MS` (~600–1200 ms, jittered), and
   respects `automationPaused`, the request budget, and captcha pauses between
   entries — re-checked per entry, not once up front (the `orchTick` lesson,
   `orchestrate.js:170-173`).
2. **Detect resume**, not just visibility: `visibilitychange` → visible,
   `pageshow` (incl. `persisted` for bfcache), and a **timer-gap heuristic** — if
   a 15s interval observes a `Date.now()` delta > ~45s, the tab was throttled.
   The gap check is what catches a minimised tab that never fires
   `visibilitychange`.
3. **Route the wake paths through it.** On resume, the deadline-driven callers
   enqueue instead of calling directly:
   `farmTick`, towns tick, `ibScan`, `autoCollectResources`, bandit wake,
   `orchTick`. Steady-state behaviour is unchanged — this only intercepts the
   post-throttle catch-up.
4. **Priority**: user-visible/time-critical first (instant-build, which has a
   real deadline), then farm claims, then scrapes (cheap to delay), then bandit.
5. **Do not add a scheduler.** The queue is a drain helper; `orchTick` stays the
   sole econ scheduler (v1.1.0 regression note).

## Files

- `src/core.js` — `gbWake`, drain loop, resume detection, gap heuristic
- `src/farms.js`, `src/towns.js`, `src/collect.js`, `src/bandit.js`,
  `src/build-tab.js`, `src/orchestrate.js` — enqueue on resume
- `src/stats.js` — Evidence shows queue depth + last drain

## Risks

- **Deadline stamping must not move.** Deadlines are stamped at the *start* of a
  scrape specifically to prevent double-fire (`CLAUDE.md` regression note). The
  queue sits between "deadline passed" and "scrape runs" — it must not re-stamp,
  and enqueueing must be idempotent per key or a slow drain will queue the same
  scrape twice.
- Over-delaying instant-build could miss a free-completion window — hence the
  priority ordering.
- Do not let the queue swallow errors silently; a dropped entry looks identical
  to a feature that decided to do nothing.

## Validation

1. Background the tab 10 min, refocus ⇒ log shows serialized drain with spacing,
   **not** simultaneous starts. This is the headline gate.
2. Request budget never exceeded during the drain (`reqBudgetOk`, `core.js:525`).
3. bfcache: navigate away and back (mobile / `pageshow.persisted`) ⇒ drain fires.
4. Minimised tab (no `visibilitychange`) ⇒ gap heuristic fires the drain.
5. Steady-state foreground: cadences unchanged vs before (compare Stats).
6. Captcha tripped mid-drain ⇒ remaining entries skip, logged, no queue leak.
7. Dry-run soak overnight ⇒ no duplicate scrapes, deadlines still honoured.

## Done when

- Resume produces a spaced sequence instead of a burst.
- No duplicate scrape from double-enqueue.
- The gap heuristic covers the minimised-tab case that `visibilitychange` misses.
