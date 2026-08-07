# 14 — Offline report catch-up

**Risk:** Low · **Size:** M · **Backlog:** §4

## Current state

Reports are discovered opportunistically: the AJAX spy (`hookFetch`/`hookXhr`)
catches report ids in live traffic, and `fetchReport` pulls each one, stamping
`state.seen[id]` **only after a successful parse** (`spy.js:140-146`; stamping on
any HTTP response used to lose reports to transient error pages — a fixed
regression, do not undo it).

While the tab is closed, nothing is discovered. On return, only reports that
happen to appear in the inbox traffic get picked up. Anything older is invisible
to the intel layer, which silently weakens dossiers (`intel.js`), plan 13's
pattern counting, and the threat board.

`grep -riE "catchUp|lastSeenTs"` = 0 hits.

## Goal

On resume, fetch the reports missed while away — **bounded**, so a two-week
absence does not trigger hundreds of requests.

## Design

1. **Track `lastSeenTs`** — the newest report timestamp successfully parsed,
   persisted world-scoped. Update it in the same place `state.seen` is stamped
   (`spy.js:140`), so it can never claim to have seen something that failed to
   parse.
2. **Trigger on resume**, via the plan 10 wake queue — this is exactly the kind
   of work that must not join a focus burst. Enqueue at **low priority**, behind
   claims and instant-build.
3. **Bound it, three ways:**
   - max reports per catch-up run (e.g. 25)
   - max age (e.g. 72 h) — older reports are not worth the requests
   - stop at the first id already in `state.seen`
4. **Serial fetch with spacing**, reusing the farm-scrape discipline: strictly
   sequential, 700–1000 ms apart (`CLAUDE.md`, farm scrape loop). Parallel bursts
   are what got throttled in v0.4.1. Never re-introduce them here.
5. **Host-gated** (`hostEnabled()`) and captcha/budget-aware — go through `gbXhr`,
   which already carries the timeout, abort-on-dispose, captcha sniff and budget
   check (`core.js:749`).
6. **Resume, don't restart.** If the run is interrupted (captcha, dispose, budget)
   record progress so the next resume continues rather than starting over.

## Files

- `src/spy.js` — `lastSeenTs`, catch-up queue + bounds
- `src/core.js` — `STORE.LAST_SEEN_TS` + `WORLD_SCOPED_BASES`
- `src/stats.js` — Evidence: last catch-up run, fetched/skipped counts
- `src/ui.js` — optional "catching up (n)" status

## Risks

- **Request burst is the main danger** — a long absence with weak bounds looks
  exactly like scraping. All three bounds are required, not optional.
- Interacts with plan 10: if the wake queue is not in place, gate this behind a
  simple spacing loop rather than firing it on raw `visibilitychange`.
- `state.seen` is capped at `SEEN_MAX = 2000` with lazy pruning
  (`core.js:299,582-600`). A very old report whose id was pruned could be
  re-fetched — the age bound is what stops that from looping. This is the same
  class of churn as I14; keep `lastSeenTs` independent of the findings cap.

## Validation

1. Close the tab 2 h with known new reports ⇒ on resume they appear, fetched
   serially with visible spacing in the log.
2. Absence of 2 weeks ⇒ capped at the per-run limit and the 72 h age bound; log
   states how many were skipped. **Silent truncation is not acceptable** — the
   count must be reported.
3. Request budget never exceeded during catch-up.
4. Captcha mid-run ⇒ stops, records progress, resumes next time without
   re-fetching what already parsed.
5. A report that fails to parse ⇒ not stamped, retried per existing retry logic,
   `lastSeenTs` not advanced past it.
6. Switch world ⇒ `lastSeenTs` does not leak.

## Done when

- Reports missed while away are recovered within explicit bounds.
- The run is serial, budgeted, interruptible, and reports what it skipped.
