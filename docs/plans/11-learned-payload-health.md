# 11 — Learned-payload health

**Risk:** Low · **Size:** M · **Backlog:** §3.7

## Current state

The bot's whole action surface depends on **learned** payloads, sniffed from the
user's own clicks and persisted world-scoped:

| Template | Learned by | Used by |
|---|---|---|
| `claimTpl` | `sniffBridgeBody` on a hand claim | `claimFarm` |
| `farmOptionMap` | `farmLearnOptionFromClaim` + `lootable_at` reconcile | claim duration |
| `farmAction` | `learnFarmAction` from game XHR | farm scrape |
| `ibAction` / `ibActionR` | sniff | instant build / research |
| `attackTpl`, `cancelTpl`, `heroTpl` | sniff | attack, cancel/recall, hero |
| `collectTpl` | sniff | collect |

These are stored once and **never expire**. If a client update renames an action
or changes a field, the stored template keeps being posted — every cadence,
forever — producing a steady stream of server rejections. Decision memory
(`journal.js`) will open a 5/15/60 min skip window after 3 consecutive hard
errors, which limits the bleeding, but nothing ever says *"the template itself is
stale, re-learn it"*. `grep -riE "tplHealth|payloadHealth"` = 0.

## Goal

Track age + last-success per template, surface staleness, and invalidate after N
hard failures so the bot asks to re-learn instead of posting a dead payload.

## Design

1. **Health record** per template, world-scoped:

   ```js
   { learnedAt, lastOkAt, lastErrAt, hardFails, invalidated }
   ```
   Stored under one `STORE.TPL_HEALTH` map (not one key per template) so it is a
   single save and a single migration.
2. **Hook the existing exits.** `bridgePost` / `gameAjaxPost` already journal
   every outcome (`CLAUDE.md`, decision memory). Update health from the same exit
   points — do **not** add a second interception layer.
   - success ⇒ `lastOkAt = now`, `hardFails = 0`
   - **hard** error ⇒ `hardFails++`
   - **captcha / timeout ⇒ ignore.** They have their own breakers and say nothing
     about payload validity. This mirrors the decision-memory rule exactly
     (`CLAUDE.md`: "captcha/timeout never trip it").
3. **Invalidate** at `hardFails >= N` (default 5, above the journal's 3 so the
   skip window trips first): mark `invalidated`, stop using the template, and
   surface a banner *"claim template stale — hand-click one claim to re-learn"*.
   The sniffers already re-learn on the next hand action; invalidation just stops
   the bot from posting garbage in the meantime.
4. **Age display only.** Age alone must **not** invalidate — a template that is
   two months old and still succeeding is fine. Only failures invalidate.
5. **Preflight + Evidence** (plan 04): per template show
   `learned? age lastOk hardFails invalidated`. Preflight already checks presence
   of `claimTpl`/`ibAction`/`attackTpl`/farm option map (`CLAUDE.md`) — this
   upgrades presence to health.

## Files

- `src/core.js` — health map, update hooks in `bridgePost`/`gameAjaxPost`,
  `STORE.TPL_HEALTH` + `WORLD_SCOPED_BASES`
- `src/journal.js` — reuse the hard-vs-soft error classification; do not fork it
- `src/stats.js` — preflight rows + Evidence block
- `src/ui.js` — re-learn banner

## Risks

- **Misclassifying a transient server error as a hard fail** would invalidate a
  perfectly good template. Reuse the journal's existing classification rather
  than writing a second one, and set N above the journal's threshold.
- Invalidating a template disables a feature until the user hand-clicks — that is
  the intent, but it must be **loudly visible**, not a silent stall.
- Do not auto-re-sniff by firing a synthetic action. Learning happens from real
  user clicks only.

## Validation

1. Force 5 hard errors on `claimTpl` (dry-run cannot produce these — use a
   deliberately corrupted template) ⇒ invalidated, banner shown, claims stop.
2. Hand-click a claim ⇒ re-learned, `hardFails` reset, banner clears, claims
   resume.
3. Trip a captcha 10× ⇒ `hardFails` stays 0. Key gate.
4. Time out 10× ⇒ `hardFails` stays 0.
5. Evidence dump shows age/lastOk per template with **no template values**
   (plan 04 redaction rule).
6. Switch world ⇒ health does not leak.

## Done when

- Every learned template has age + last-success + failure count.
- 5 hard fails stop the payload and ask for a re-learn.
- Captcha and timeout can never invalidate a template.
