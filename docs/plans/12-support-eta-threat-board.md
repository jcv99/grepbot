# 12 — Support ETA on threat board

**Risk:** Low · **Size:** S · **Backlog:** §4

## Current state

`intelThreatBoard()` (`intel.js:48-50`) is a thin passthrough:

```js
return (typeof dodgeIncomingMovements === 'function') ? dodgeIncomingMovements() : [];
```

Incoming rows show *that* something is inbound, not *when* it lands.
`grep -riE "supportEta|landsIn"` = 0 hits.

The arrival data is already present — `dodge.js` must know arrival times to
decide when to dodge, and `attack.js` computes travel (`travel`, `sendAt`,
`attack.js:566`). This is a display gap, not a data gap.

## Goal

Each incoming row shows **"lands in 4h12m"** (and absolute local time), counting
down, plus enough context to act: is it an attack or support, from whom, at which
town.

## Design

1. **Read arrival** from the movement model that `dodgeIncomingMovements` already
   returns. Prefer an explicit arrival field; derive from `gameNow()` +
   remaining seconds if that is what the model carries. **Use `gameNow()`, never
   `Date.now()`** — server clock skew is exactly what makes a dodge land late
   (already the rule for wonder day, `CLAUDE.md`).
2. **Format** `landsIn` as `Xh Ym` (drop seconds above 1 h, show `Ym Ss` below
   10 min so the endgame is precise).
3. **Live countdown** without a new timer: the threat board already re-renders;
   reuse the existing render cadence rather than adding a per-row `setInterval`.
   If a dedicated tick is unavoidable, register it via `gbInterval` so dispose
   cleans it up, and only run it while the Intel tab is visible — the same rule
   `renderLog` follows (`CLAUDE.md`, v0.5.0).
4. **Hostile classification stays canonical.** Attack-vs-support must use the
   existing hostile-only rule — `is_attack` / attack command names, **never**
   `incoming`/`started_at` alone (`CLAUDE.md`, v1.5.3 audit). Do not invent a
   second classifier here; call whatever `dodge.js` uses.
5. **Sort** by soonest arrival. Colour/emphasis for < 30 min.
6. Unreadable arrival ⇒ render `"eta unknown"`, not a fabricated time, and do not
   drop the row — an incoming you cannot time is more alarming, not less.

## Files

- `src/intel.js` — enrich `intelThreatBoard()` rows, format helper, sort
- `src/ui.js` — threat board row rendering (keyed rows, plan 21)

## Risks

- Very low; read-only, no post.
- Only real trap is a fabricated ETA from a bad clock source — hence `gameNow()`
  and the explicit "eta unknown" state.
- If a per-row timer is added carelessly it leaks on dispose (C2's lesson).

## Validation

1. Incoming attack visible ⇒ row shows a countdown that matches the in-game
   timer within a few seconds.
2. Support incoming ⇒ labelled distinctly from an attack; classification comes
   from the hostile-only rule.
3. Countdown decrements while the Intel tab is open; no timer runs while hidden.
4. Arrival unreadable ⇒ `"eta unknown"`, row still listed.
5. Reinject the script ⇒ no duplicate/leaked timer (check `gbTimerBag`).
6. Rows sorted soonest-first.

## Done when

- Every incoming row carries a live, server-clock-based ETA or an explicit
  unknown.
- No new leaked timer, no second hostility classifier.
