# 02 — Wonder favor cast

**Risk:** Med · **Size:** M · **Backlog:** §1, §4 (ROADMAP 11.4) — **DEFERRED**

## Recommendation

**Do not build this yet.** It applies only to World Wonder worlds. `es146` (the
validation world, `docs/TASKS.md`) is not one, so the feature cannot be validated
in-game — and an unvalidatable HIGH-RISK post is exactly what `CLAUDE.md` says
not to ship. Keep this plan on file; execute only when the account is on a WW
world with an active wonder.

Everything below is the design to pick up at that point.

## Current state

`wonder.js` donates **resources** only. It is already well-hardened:
`wood+stone+iron ≤ tradeCap`, `tradeCap===0` skips (`wonder.js:57-59`), daily
budget persisted via `wonderSaveSpent` (`wonder.js:110,129`), day from
`gameNow()`. There is no favor path — `grep -riE "wonderFavor|favorCast"` = 0 hits.

`favor.js` casts favor at **farm villages** (`temple_plunder`, HIGH-RISK, default
OFF). Its power-id discipline is the model to copy: never default a power id.

## Goal

Spend surplus favor on the alliance wonder, under the same budget + confirm
discipline as resource donation.

## Design

1. **Read favor before posting.** Per-god current favor + cap via the god model.
   Use `gbProbeNum` over the candidate getter names. Unreadable ⇒ `blind` ⇒ log
   once and let the server decide (the `CLAUDE.md` precondition invariant), but
   **do not** treat blind as "cast freely" — pair it with the daily budget so a
   blind read cannot drain a temple.
2. **Explicit power id.** The wonder-favor power id must be **sniffed from a
   hand-cast**, exactly like `claimTpl` / `attackTpl`. No guessed constant, no
   `call_of_the_ocean`-style default (`CLAUDE.md`, recruit note). Store
   world-scoped as `wonderFavorTpl` via `WORLD_SCOPED_BASES`.
3. **Reserve.** New `wonderFavorReserve` (default 50%): never spend favor below
   that fraction of cap, so dodge/militia/attack support still have favor.
4. **Budget.** Extend the existing `wonderSpentToday` record with a `favor`
   field, persisted the same way. One ledger, one save path.
5. **Post** through `bridgePost` (feature key `wonder`) so dry-run, the captcha
   breaker, the request budget and the journal all cover it for free.
6. **Default OFF**, own toggle `wonderFavorCast`, HIGH-RISK label in Config.

## Files

- `src/wonder.js` — favor read, reserve, cast, ledger field
- `src/core.js` — `STORE.WONDER_FAVOR_TPL` + add to `WORLD_SCOPED_BASES`
- `src/ui.js` — toggle + reserve input under the existing Wonder config
- `src/stats.js` — preflight row: "wonder favor tpl learned? favor readable?"

## Risks

- HIGH-RISK ToS surface: another automated post class.
- Blind favor read + no reserve = drained temple, no defensive favor. The reserve
  is not optional.
- Wonder day rollover must use `gameNow()`, not local time — already the rule in
  `wonder.js`.

## Validation (WW world only)

1. Sniff: hand-cast favor at the wonder, confirm `wonderFavorTpl` is learned and
   logged. **Gate: payload matches the UI action.**
2. Dry-run ON: `DRY-RUN wonder: {...}` matches the sniffed payload field-for-field.
3. Reserve honoured: set reserve 90%, confirm zero casts while favor < 90% cap.
4. Budget: confirm `favor` spend persists across a page reload (the I10 lesson).
5. Only then dry-run OFF, single cast, verify in the wonder UI.

## Done when

- Cast only fires with a **sniffed** power id, above reserve, within budget.
- Toggle defaults OFF and is labelled HIGH-RISK.
- Reload does not reset the daily favor budget.
