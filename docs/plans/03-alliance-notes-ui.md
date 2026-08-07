# 03 — Alliance notes UI

**Risk:** Low · **Size:** S · **Backlog:** §1 (`allianceNotes` row)

## Current state

The backlog says "`allianceNotes` loaded unused". That is **half right** —
worth correcting, because the read path is live:

| Path | Status | Evidence |
|---|---|---|
| Loaded into state | yes | `core.js` `ALLIANCE_NOTES` (`core.js:110`) |
| Read into dossiers | yes | `intel.js:42-43` sets `d.allianceNote` |
| Rendered | yes | `intel.js:71` `[ally: …]`, `intel.js:78-81` in the copy/export block |
| **Written** | **no** | `intelSetAllianceNote` (`intel.js:92-97`) **has no caller** |

So the map can only ever be populated by config import (`qol.js`). There is no
way to add an alliance note from the panel.

The **player** note path is the useful contrast: `intelSetNote` (`intel.js:86`)
does exactly the same job for players and **is** wired — `ui.js:863` calls
`intelSetNote(p, n); renderIntel(); flash('note saved')` from the Intel row
editor. So the pattern to copy already exists a few lines away; this is a
missing sibling, not a missing mechanism.

## Goal

Give `intelSetAllianceNote` the same panel path `intelSetNote` already has.

## Design

In the Intel dossier row renderer (`intel.js:68+`), mirroring the existing
player-note editor at `ui.js:863`:

1. Add an alliance-note control per dossier row when `d.alliance` is known.
2. Click ⇒ inline `<input>` prefilled with the current note ⇒ Enter/blur calls
   `intelSetAllianceNote` ⇒ `renderIntel()`. Same shape as the player path, so
   the two stay symmetrical.
3. Build the row with `createElement` + `textContent`. **No `innerHTML` with
   player/alliance strings** — those are attacker-controlled. This is the I15
   lesson; `quests.js` was already cleaned, do not reintroduce the pattern in
   `intel.js`. Note that `intel.js:71,81` currently build strings for the copy
   block — that is fine for a textarea/clipboard payload, but must not be
   assigned to `innerHTML`. Check how that block is inserted, and convert it if
   it is.
4. The setter already clamps to 200 chars (`intel.js:95`) — keep that, add
   `maxlength` on the input as UI affordance only, never as the enforcement.

## Storage scope

`ALLIANCE_NOTES` / `PLAYER_NOTES` are **id/name-bearing** — an alliance name on
one world means nothing on another. Confirm they are in `WORLD_SCOPED_BASES`
(`core.js:132`). If not, add them; that is a C3-class leak the audit missed
because it only listed `notes/watchlist` generically. Adding a base to the set is
enough — `load`/`save` auto-key (`core.js:731,745`).

## Files

- `src/intel.js` — alliance-note editor hook
- `src/ui.js` — inline editor beside the existing player-note editor (`ui.js:863`)
- `src/core.js` — add note stores to `WORLD_SCOPED_BASES` if absent

## Risks

- Very low. No new network post, no automation surface.
- Only real risk is XSS-by-innerHTML if the row is built the lazy way.

## Validation

1. Add an alliance note; confirm it renders in the dossier row as `[ally: …]`.
2. Player notes still work unchanged via `ui.js:863` (regression gate).
3. Reload ⇒ notes persist.
4. Set a note containing `<img src=x onerror=alert(1)>` ⇒ renders as **literal
   text**, no execution. This is the gate that matters.
5. Switch world ⇒ notes from the other world do not appear (after scoping).
6. Config export/import round-trips both maps (`qol.js:163` already lists
   `playerNotes`/`watchlist` — add `allianceNotes` if missing).

## Done when

- `intelSetAllianceNote` has a caller, symmetric with `intelSetNote`.
- Notes survive reload, are world-scoped, and render as text not HTML.
- The `BACKLOG.md` §1 row is corrected: `webhookEvents` is already wired, only
  `allianceNotes` was missing a UI.
