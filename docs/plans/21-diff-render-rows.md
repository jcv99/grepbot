# 21 — Diff-render remaining tabs

**Risk:** Low · **Size:** M · **Backlog:** §5.6 (audit P8, "partial v1.4")

## Current state

v1.4.0 introduced keyed-row patching: `renderFarms` / `renderWorld` /
`renderAttack` patch `tr[data-key]` / `div[data-town]` and rebuild only when the
id **set** changes — comparing membership, not order, so a user column-sort is
not wiped on every repaint (`CLAUDE.md`, v1.4.0 render note).

But `grep -n "data-key" src/ui.js` finds only **two** patch sites
(`ui.js:112`, `ui.js:189`). The remaining heavy tables — Build, Attack detail,
Stats, Intel/threat board, Log/Decisions — still rebuild wholesale on every
render, which is what produces the visible flicker and drops scroll position.

## Goal

Extend keyed patching to the remaining tables, from one shared helper rather than
a fourth hand-rolled copy.

## Design

1. **Extract the existing pattern** into one helper — the two current call sites
   are near-duplicates, and adding more copies guarantees they drift:

   ```js
   gbPatchRows(tbody, items, keyOf, buildRow, updateRow)
   ```
   - membership compare on the key set (**not order** — that is the whole point
     of the v1.4.0 fix)
   - set unchanged ⇒ `updateRow` in place
   - set changed ⇒ rebuild, then re-apply sort/filter (plan 18)
2. **Migrate the two existing call sites first**, verify no regression, then add
   Build, threat board, Stats and Decisions.
3. **Preserve on rebuild:** scroll position, focused element and text selection.
   A rebuild that steals focus mid-typing is worse than flicker.
4. **No `innerHTML` with game strings.** `renderAttack` already stopped
   interpolating town names into `innerHTML` (v1.4.0); the new call sites must
   use `createElement` + `textContent` from the start. Player, alliance, town and
   quest strings are all attacker-controlled (I15).
5. **Respect tab visibility.** `renderLog` is deferred 250 ms and skipped while
   hidden (`CLAUDE.md`, v0.5.0), and bails when the Decisions sub-view is active.
   Every migrated renderer should follow the same rule — patching a hidden tab is
   pure waste.

## Files

- `src/ui.js` — `gbPatchRows` + migrate call sites (Build, threat board, Stats,
  Decisions)
- `src/build-tab.js`, `src/stats.js`, `src/intel.js` — if their row builders live
  outside `ui.js`

## Risks

- **Refactoring the two working call sites can regress the v1.4.0 fix.** Migrate
  them first and validate sort-preservation before touching anything new — a
  regression here is subtle and only shows up when a user sorts a column.
- Stale rows if `keyOf` is not stable (e.g. keyed on an index instead of an id).
- Over-patching: if `updateRow` forgets a field, the row shows stale data
  indefinitely — worse than a rebuild. Update every mutable field.

## Validation

1. Sort Farms by a column, force a repaint with an unchanged id set ⇒ sort held
   (existing v1.4.0 behaviour, must not regress).
2. Add/remove a farm ⇒ set changes ⇒ rebuild ⇒ sort re-applied (plan 18).
3. Build tab updating during a queue change ⇒ no flicker, scroll held.
4. Type in a filter box while a render fires ⇒ focus and caret preserved.
5. Row with a name containing HTML ⇒ literal text, no execution.
6. Hidden tab ⇒ no patch work (instrument with a counter).
7. Values that change without the id set changing (resources, timers) ⇒ visibly
   update. Guards against over-patching.

## Done when

- One helper serves every keyed table.
- Sort, scroll and focus survive repaints.
- No new `innerHTML` path carries game strings.
