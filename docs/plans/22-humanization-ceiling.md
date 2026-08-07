# 22 — Humanization jitter + soft posts/min ceiling

**Risk:** Low · **Size:** M · **Backlog:** §6.1

## Current state — partly done

| Mechanism | Status | Evidence |
|---|---|---|
| Orch cadence jitter ±20% | done | `ORCH_JITTER` (`orchestrate.js:17,105`) |
| Orch intra-tick spacing | done | `ORCH_SPACING_MS = 450` + random 0–200 ms (`orchestrate.js:16,181`) |
| Build (`abScan`) jitter 0–3 min | done | `abRandMs` (`build-tab.js:350`) |
| Trade inter-job delay | done | `800 + random*600` (`trade.js:178`) |
| Farm scrape spacing | done | 700–1000 ms sequential (`CLAUDE.md`) |
| **Hard request budget** | done | `reqBudgetOk`, `reqBudgetPerMin` default 40 (`core.js:407,525-533`) |
| **Global soft ceiling / pacing** | **missing** | budget is a hard cliff, nothing shapes the rate below it |

So jitter exists per-feature, and there is a hard cap. What does not exist is a
*soft* ceiling: below 40/min the bot posts as fast as features become due, then
slams into a wall at the limit. The traffic shape is bursty-then-blocked, which
is more machine-like than a steady rate would be.

## Goal

Shape the rate below the hard cap, and make the remaining fixed delays jittered.

## Design

1. **Soft ceiling.** New `postsPerMinSoft` (default ~60% of `reqBudgetPerMin`).
   When the trailing-minute count exceeds it, **delay** the next post by a
   jittered interval instead of rejecting it. The hard budget stays as the
   backstop — this only smooths the approach.
2. **Reuse the existing window.** `reqBudgetWindow` (`core.js:422`) already
   tracks post timestamps with a head-index ring (no `shift()` thrash, v1.3.5).
   Read from it; do not add a second window.
3. **Sweep the remaining fixed delays** for un-jittered constants and add ±20–30%
   where the delay is a pacing device (not a correctness timeout). Do **not**
   jitter: lock TTLs, captcha windows, scrape *deadlines* (the deadline pattern is
   deliberate — chained `setTimeout` gets throttled in background tabs,
   `CLAUDE.md`), or anything a reconcile depends on.
4. **Do not fake humanity beyond pacing.** No randomised mouse movement, no
   synthetic UI events, no attempt to defeat detection heuristics. The stated
   moat is "reliability + intel + dry-run validation, not reckless automation"
   (`BACKLOG.md` §7). This plan is about not hammering the server; it is not an
   evasion feature, and it should not be described or extended as one.
5. **Interacts with plan 10**: the resume-burst serializer is the bigger win for
   traffic shape. Land 10 first; this plan smooths steady state, 10 fixes the
   spike.

## Files

- `src/core.js` — soft ceiling check + delay path beside `reqBudgetOk`
- `src/ui.js` — Config input for `postsPerMinSoft` (validate < hard budget)
- `src/stats.js` — Stats/Evidence: current posts/min vs soft and hard limits

## Risks

- **Delaying a time-critical post.** Instant-build free-completion windows and
  dodge sends are deadline-bound. Either exempt them or give them priority in the
  delay queue — a smoother rate is not worth missing a dodge.
- Soft ceiling above the hard budget would be meaningless — validate the
  relationship in the UI.
- Adding delay everywhere makes the bot sluggish; tune against the Stats view
  rather than by feel.

## Validation

1. Drive many due features at once ⇒ posts spread out, trailing-minute rate stays
   near the soft ceiling instead of spiking to the hard cap.
2. Hard budget still enforced as a backstop (set soft above hard ⇒ rejected by
   validation).
3. Dodge / instant-build still fire promptly under load. **Primary gate.**
4. Stats shows current rate vs both limits.
5. Scrape deadlines unchanged (background tab still recovers on schedule).
6. No new interval or timer added; delays go through `gbTimeout`.
7. Overnight dry-run soak: no lock strands, no missed cadence.

## Done when

- Steady-state traffic approaches the cap smoothly rather than in bursts.
- Deadline-bound actions are exempt.
- No evasion behaviour is added — pacing only.
