# 13 — Attack pattern alerts

**Risk:** Low · **Size:** S · **Backlog:** §4

## Goal

When the same attacker hits **3× within 24 h**, fire one webhook + panel alert:
this is a campaign, not a one-off raid.

`grep -riE "patternAlert|attackPattern"` = 0 hits.

## Current state — the pieces already exist

- `state.findings` holds parsed reports with attacker + `ts` (`spy.js`,
  `parse-inline.js`).
- `intelDossiers()` (`intel.js:18`) already groups findings per player with
  `reports`, `towns`, `last` — and keys correctly by `intelPlayerKey(raw)` string.
- `alertWebhook` (`alerts.js`) posts to Discord **or Telegram** with a 5 min
  rate limit and per-event gating via `state.webhookEvents` (`alerts.js:28`).
- `state.alerted` exists to dedupe alerts.

So this is a small aggregation + one new event type.

## Design

1. **Detect** in `intel.js`, off the existing dossier pass — do not re-walk
   findings a second time:
   - count findings per attacker key with `ts > now − 24 h`
   - trip at `>= 3`
2. **Dedupe.** Fire once per attacker per window; store
   `state.alerted['pattern:<key>:<windowBucket>']`. Re-arm only after the count
   drops below threshold or the window rolls, or a persistent attacker generates
   an alert every render.
3. **Event type** `pattern`, added to `state.webhookEvents` (default **ON** —
   it is low-volume and high-value, unlike `warehouse`). Wire the checkbox in
   `ui.js:1246-1253` alongside the existing ones.
4. **Payload**: attacker name, hit count, window, target towns, first/last
   timestamps. **Respect the export-redaction toggle** — this leaves the machine,
   so it follows the same rule as the Evidence dump (plan 04).
5. **Panel**: badge on the Intel tab + a line in the threat board.
6. Counting uses report timestamps, so it is inherently bounded by what has been
   fetched — plan 14 (offline catch-up) improves accuracy after a gap.

## Files

- `src/intel.js` — window count, trip, dedupe key
- `src/alerts.js` — `pattern` event type
- `src/core.js` — `webhookEvents.pattern` default
- `src/ui.js` — checkbox + Intel badge

## Risks

- **Alert spam** from a sustained attacker — the dedupe bucket is the whole
  defence; get it right or the webhook becomes noise and gets muted.
- **Name-keying collisions**: two players with similar names. Key by id where
  available, name only as fallback — `intelPlayerKey` already makes this choice,
  so reuse it rather than re-deriving.
- Webhook payload is off-box data. Redaction applies.

## Validation

1. Seed 3 findings from one attacker inside 24 h ⇒ exactly one alert.
2. Re-render 10× ⇒ still exactly one alert (dedupe gate).
3. 4th hit ⇒ no second alert until the window rolls.
4. Two different attackers at 3 hits each ⇒ two distinct alerts.
5. `webhookEvents.pattern = false` ⇒ no webhook, panel badge still shows.
6. Redaction ON ⇒ names masked in the webhook body.
7. No webhook URL configured ⇒ panel-only, no error spam.

## Done when

- Repeat attackers surface once per window, on the panel and (optionally) webhook.
- Dedupe holds across renders and reloads.
