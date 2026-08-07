# 19 — Captcha backoff UI

**Risk:** Low · **Size:** S · **Backlog:** §5.4, §6.2

## Current state

Captcha backoff is hardcoded 5 / 15 / 60 min exponential per feature
(`CLAUDE.md`, captcha breakers). The global kill-switch is persisted
(`captchaGlobalKill`, `STORE.CAPTCHA_GLOBAL`, `core.js:406`) and the global
window survives reload (`captchaGlobalUntil`, `core.js:420-424`) — I11 is fixed.
The footer shows `⏸farm,bandit,…` and `⏸ALL` (`ui.js:1609`).

What is missing is user control: the ladder cannot be edited, and it never
resets, so a single captcha hours ago still weights the next trip.
`grep -riE "captchaBackoff"` = 0 hits.

## Goal

1. Editable backoff ladder in Config.
2. Automatic decay: after a **clean hour** (no captcha on that feature), step the
   ladder back down one level.

## Design

1. **Config**: three number inputs (or a comma list) for the ladder, validated —
   ascending, minimum 1 min, sane ceiling (e.g. ≤ 24 h). Use `gbCfgNum`
   (`core.js:1081`) so a legitimate `0` is preserved rather than swallowed by
   `+v || default`.
2. **Store** as one array `STORE.CAPTCHA_LADDER`, default `[5, 15, 60]`.
   World-scoped? **No** — the ladder is a preference, not id-bearing. The
   *breaker state* is already world-scoped (`saveCaptcha`, `core.js:856`), which
   is the correct split.
3. **Decay**: track `lastCaptchaAt` per feature (already implied by the breaker
   record). On each breaker evaluation, if `now − lastCaptchaAt > CLEAN_MS`
   (1 h), decrement the ladder index by one and log it. Decay on evaluation, not
   on a new timer.
4. **Display remaining time** per paused feature in Config/Stats, not just the
   footer's feature list — "farm paused 12m" is actionable, "⏸farm" is not.
5. **Manual reset** button per feature and a "clear all" — useful when the user
   has just solved a captcha by hand and knows the coast is clear.
6. **Do not let the UI weaken safety**: a user setting `[1,1,1]` should be
   warned. Consider a floor. Never allow 0 — that disables the breaker entirely,
   which is precisely the protection that keeps a captcha loop from becoming a
   ban.

## Files

- `src/core.js` — ladder store, decay, `lastCaptchaAt`, validation
- `src/ui.js` — Config inputs, per-feature remaining + reset buttons
- `src/stats.js` — Evidence already reports captcha windows (plan 04); add ladder
  index

## Risks

- **User configures the breaker into uselessness.** Enforce a floor and warn.
  This is the one place where the UI can make the bot less safe.
- Decay logic firing too eagerly could mask a persistent captcha problem — one
  level per clean hour, never a full reset.
- Do not add a timer; evaluate lazily.

## Validation

1. Edit ladder to `[2,10,30]` ⇒ next trip uses 2 min. Persisted across reload.
2. Invalid input (descending, 0, negative, text) ⇒ rejected with a message, prior
   value kept.
3. Trip a feature, wait a clean hour (or shim the clock) ⇒ ladder index steps
   down once, logged.
4. Trip again within the hour ⇒ ladder escalates as before.
5. Manual reset ⇒ feature resumes immediately, breaker state cleared.
6. Global kill-switch still overrides per-feature settings.
7. Switch world ⇒ ladder persists (global), breaker state does not leak
   (world-scoped).

## Done when

- The ladder is editable, validated, floored, and decays one step per clean hour.
- Remaining pause time is visible per feature.
