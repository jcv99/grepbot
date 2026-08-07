# 15 — Watchlist "why"

**Risk:** Low · **Size:** S · **Backlog:** §4

## Current state

The watchlist matches `f.town.id` (`CLAUDE.md`, intel section) and flags a
finding. The panel shows **that** something matched, not **which rule** matched.
With several entries — a player name, a coordinate pair, an alliance tag — a hit
is ambiguous, and the user cannot tell a stale rule from a live one.

`grep -riE "watchWhy|matchReason"` = 0 hits.

## Goal

Every watchlist hit carries its match reason: `player` / `coords` / `alliance` /
`town`, plus the specific rule text that fired.

## Design

1. **Return a reason, not a boolean.** Refactor the match to:

   ```js
   watchMatch(finding) // → {hit:true, kind:'player'|'coords'|'alliance'|'town', rule:'<entry>'} | null
   ```
   Single evaluation point — today's boolean check becomes the same code path
   returning richer data. Do not add a parallel "explain" function that can drift
   out of sync with the real matcher; that divergence is how the UI ends up
   confidently reporting the wrong reason.
2. **Order matters** when several rules match: report the most specific
   (`town` > `coords` > `player` > `alliance`) and note the count if more than one
   fired (`"+2 more"`).
3. **Render** the reason as a chip on the row, built with `createElement` +
   `textContent` — rule text is user input and finding fields are
   attacker-controlled (I15 lesson).
4. **Stale-rule signal.** Show last-hit time per watchlist entry so rules that
   never fire are obvious and can be pruned. Cheap, and it is most of the
   practical value of this feature.
5. Feeds plan 13's alerts: an alert can say *why* the target was being watched.

## Files

- `src/intel.js` — `watchMatch` returning reason, per-entry last-hit stamp
- `src/ui.js` — reason chip + last-hit column
- `src/core.js` — watchlist store already exists; add last-hit map to
  `WORLD_SCOPED_BASES` (entries are id/name-bearing)

## Risks

- Low. Read-only, no post, no new automation.
- Only real risk is the matcher and the explainer drifting apart — avoided by
  construction (one function).
- Watchlist matching currently keys on `f.town.id`; extending to player/alliance
  means touching the match semantics. Verify existing entries still match after
  the refactor, or users silently lose coverage.

## Validation

1. Entry by town id ⇒ hit shows `kind: town` with that id.
2. Entry by player name ⇒ hit shows `kind: player`.
3. Two entries matching one finding ⇒ most specific reported, `+1 more` shown.
4. Rule text containing HTML ⇒ rendered as literal text.
5. Pre-existing watchlist entries still match exactly as before the refactor
   (regression gate).
6. Entry that never matches ⇒ last-hit shows "never".
7. Switch world ⇒ last-hit data does not leak.

## Done when

- Every hit names its rule and kind.
- Never-firing rules are visible.
- No second matcher exists.
