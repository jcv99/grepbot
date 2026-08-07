# 17 — Footer last-action chip

**Risk:** Low · **Size:** S · **Backlog:** §5.2

## Goal

Footer shows the most recent successful action at a glance:
`farm: claim OK 12s ago`.

Today the footer carries actions + status badges only (pause reasons, `⏸srv:`,
`🅳DRY`, `mem:<n>`). Answering "is it actually doing anything?" means opening the
Log tab. `grep -riE "lastAction"` = 0 hits.

## Design

1. **Source: the journal, not a new counter.** Every `bridgePost` /
   `gameAjaxPost` exit is already journaled with feature, action, result and
   timestamp (`journal.js`, `CLAUDE.md` decision memory). `gbRecallAll` gives the
   most recent OK directly. Adding a separate "last action" variable would create
   a second source of truth that drifts the first time a path forgets to update
   it.
2. **Render** `<feature>: <action> OK <relative time>`, truncated to fit.
   Relative time formatted coarsely (`12s`, `4m`, `1h`).
3. **Update cheaply.** The footer already re-renders on a status cadence — reuse
   it. Do **not** add a per-second timer for the "ago" text; coarse granularity
   makes a slow refresh invisible.
4. **Distinguish idle from broken.** If the last OK is older than a threshold
   (say 15 min) while automation is enabled and unpaused, style it as a warning.
   That is the actual diagnostic value: "nothing has succeeded in an hour" is the
   signal a user needs, and it is not visible anywhere today.
5. **Dry-run**: show `DRY` on the chip, since journal entries in dry-run are
   `skip:dryrun`, not successes. Do not let a dry-run skip masquerade as an OK.
6. Respect the redaction toggle — town names can appear in action targets.

## Files

- `src/ui.js` — footer chip render (footer is `ui.js`; `footer.js` only closes
  the IIFE)
- `src/journal.js` — reuse `gbRecallAll`; add a helper only if none fits

## Risks

- Very low — display only.
- Two traps: a per-second timer (leaks on dispose, C2 lesson) and treating
  `skip:dryrun` as success.
- Footer space is limited; truncate rather than wrap.

## Validation

1. Trigger a real claim ⇒ chip shows `farm: claim OK <seconds> ago`, ticking up.
2. Dry-run ON ⇒ chip shows the dry-run state, never `OK`.
3. No successful action for > threshold with automation ON ⇒ warning style.
4. All automation OFF ⇒ neutral idle text, no warning.
5. Reinject ⇒ no leaked timer.
6. Redaction ON ⇒ no town name leaks into the chip.

## Done when

- The footer answers "is it working?" without opening the Log tab.
- The chip reads from the journal only.
