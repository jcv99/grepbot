# 09 — Farm option auto-teach after loyalty research

**Risk:** Low · **Size:** S · **Backlog:** §3.5

## Current state

Claim durations are **learned, never guessed** — `farmLearnOptionFromClaim`
watches a hand-clicked claim, re-reads `lootable_at` 4s later and snaps the delta
to `FARM_DURATIONS` (300/600/1200/2400/5400/14400/28800s), storing
`state.farmOptionMap` world-scoped. Seed is `{300: 1}` — the 5-minute payload the
bot always sent (`CLAUDE.md`, "Claim timers").

`farmDesiredDuration` picks **10 min where villager-loyalty research is done,
5 min elsewhere**, via `farmLoyaltyResearched` (techs from `researchTownTechs`,
loose match `/loyal|lealtad|diplom|conscript/i`, 60s cache).

The gap: when loyalty research **completes**, `farmDesiredDuration` starts
wanting 600s — but `farmOptionMap[600]` was never learned, because the user only
ever hand-clicked a 5-minute claim. So the bot logs "unknown duration" and falls
back to 5 min indefinitely. The upgrade the research paid for is never realised
until the user happens to hand-click a 10-minute claim.

`grep -riE "autoTeach|loyaltyAutoTeach"` = 0 hits.

## Goal

Detect the research flip and either learn the 10-minute option index, or tell the
user exactly what to click once.

## Design

Two paths, in preference order.

### A — Derive from the option list (preferred, no posts)

The claim dialog's option indices come from the game's own relation/option data.
If the option list is readable from the model (durations in order), the index for
600s is derivable without any post:

1. On loyalty-flip, read the option collection for one controlled village.
2. Map duration → index directly, merge into `state.farmOptionMap`, log the
   learned mapping.
3. **Verify before trusting**: on the next real claim, re-read `lootable_at` and
   confirm the delta snaps to 600s (`farmLearnOptionFromClaim` already does this
   — reuse it as the confirmation step, do not bypass it).

### B — Guided teach (fallback)

If the option list is unreadable, do **not** guess an index — a wrong index
claims the wrong duration and silently halves farm income.

1. Log + Farms-tab banner: *"Loyalty research done. Click one 10-minute claim by
   hand to teach the bot."*
2. `farmLearnOptionFromClaim` already handles the rest.
3. Banner clears when `farmOptionMap[600]` exists.

### Flip detection

- `farmLoyaltyResearched` is already cached 60s. Store the last observed value
  world-scoped; when it goes false → true, fire the teach path once.
- Also fire on first load if loyalty is true and `farmOptionMap[600]` is missing —
  covers users who installed after finishing the research.

## Files

- `src/farms.js` — flip detection, option-list read, banner state
- `src/core.js` — `STORE.FARM_LOYALTY_SEEN` + `WORLD_SCOPED_BASES`
- `src/ui.js` — Farms tab banner

## Risks

- **Guessing an index is the one unacceptable outcome.** Path A must be
  verified by the existing `lootable_at` reconcile before it is trusted; path B
  must be the fallback, not path A's error handler.
- World-scoped: option indices are world/client specific (`CLAUDE.md`). The
  "seen" flag must be scoped too, or a world switch replays the banner wrongly.

## Validation

1. World with loyalty **not** researched ⇒ no banner, 5 min claims, unchanged.
2. Simulate the flip (pin the tech in Config) ⇒ teach path fires exactly once.
3. Path A success ⇒ `farmOptionMap[600]` learned, then confirmed by the next
   claim's `lootable_at` delta ≈ 600s.
4. Path A unreadable ⇒ banner appears, **no** map write, no guessed index.
5. Hand-click a 10-minute claim ⇒ learned, banner clears.
6. Switch world ⇒ banner state does not leak.

## Done when

- A completed loyalty research results in 10-minute claims without the user
  having to know that a hand-click was required.
- No index is ever written without `lootable_at` confirmation.
