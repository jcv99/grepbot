# 18 — Per-tab sticky filters

**Risk:** Low · **Size:** M · **Backlog:** §5.3

## Goal

Farms / World / Intel remember their sort column, direction and filter text
across re-renders, tab switches and reloads.

`grep -riE "stickyFilter|sortState"` = 0 hits.

## Why it matters beyond convenience

`renderFarms` / `renderWorld` / `renderAttack` already patch keyed rows and
rebuild **only when the id set changes** — compare membership, not order,
*specifically so a user column-sort is not wiped on every repaint*
(`CLAUDE.md`, v1.4.0 render note). That fix protects sort **within** a render
cycle. It does not persist sort across a full rebuild (id set genuinely changed)
or a reload. This plan finishes that job.

## Design

1. **One state shape per tab**, persisted:

   ```js
   state.tabView = { farms: {sort:'eta', dir:'asc', filter:''}, world: {...}, intel: {...} }
   ```
   Single store key, single save — not one key per tab.
2. **Apply at render**, after rows are built: sort + filter come from state, so a
   full rebuild reproduces the user's view instead of resetting it.
3. **Persist on change**, debounced (~400 ms) so typing in a filter box does not
   hammer GM storage. Storage weight is a real concern here — see plan 20.
4. **Scope:** view preferences are **not** id-bearing, so they stay global (not
   `wkey`'d) — the same rule `CLAUDE.md` states for prefs. A sort column means
   the same thing on every world.
5. **Filter semantics**: plain substring, case-insensitive, matched against the
   row's text fields. Do not accept regex from the user — a bad pattern would
   throw inside the render loop and blank the tab.
6. **Empty-result guard**: if a filter hides everything, show "3 rows hidden by
   filter" rather than an empty table that reads as "no data". Silent emptiness
   is the classic bug report ("my farms disappeared").

## Files

- `src/ui.js` — sort/filter state, apply in the three renderers, controls
- `src/core.js` — `STORE.TAB_VIEW` (global, not world-scoped)

## Risks

- **Persisted filter hiding data after a reload** — the user forgets a filter is
  set and reports data loss. The hidden-count notice is the mitigation, and it is
  not optional.
- Debounce must not drop the final keystroke.
- Do not break the keyed-row patching by re-sorting the DOM on every patch;
  apply ordering when the row set is (re)built.

## Validation

1. Sort Farms by ETA ⇒ switch tab and back ⇒ sort retained.
2. Reload ⇒ sort and filter retained.
3. New farm appears (id set changes, full rebuild) ⇒ sort still applied.
4. Filter hiding all rows ⇒ hidden-count notice shown, not a blank table.
5. Type quickly in the filter ⇒ one save after settling, final keystroke kept.
6. Filter text with regex metacharacters (`(`, `[`, `*`) ⇒ treated literally, no
   throw, tab still renders.
7. Switch world ⇒ view preferences persist (intended: global).

## Done when

- All three tabs restore sort + filter across rebuilds and reloads.
- A filter can never silently look like missing data.
