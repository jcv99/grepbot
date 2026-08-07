# 04 — Evidence dump

**Status:** CODED (v1.5.15)

**Risk:** Low · **Size:** M · **Backlog:** §2 Ops tooling, Top-ROI #2

## Why this is first

Every other plan in this directory ends with an in-game validation gate, and
every gate in `docs/TASKS.md` currently means "reproduce the state, then describe
it by hand". An evidence dump turns each gate into *paste one blob*. It pays for
itself across plans 01, 05–11, and shortens the HIGH-RISK 8.12/8.13 gates most,
because those are the ones where a vague report is dangerous.

`grep -ri evidence src/` = 0 hits. Nothing exists yet.

## Goal

**Log tab → Evidence** button producing one copyable, redaction-aware snapshot
of everything needed to adjudicate a gate.

## Contents

Assemble from data that already exists — this is a reporting feature, it must
compute nothing new and post nothing.

| Block | Source |
|---|---|
| Build | `@version`, host, world key `wkey('')`, `configVer` |
| Toggles | every `auto*` flag + `dryRun` + `hostEnabled()` |
| Scheduler | `orchStatus()` (`orchestrate.js:126`) — on/cadence/idle/dueIn per feature |
| Learned templates | `claimTpl`, `ibAction`, `ibActionR`, `attackTpl`, `cancelTpl`, `heroTpl`, `collectTpl`, `farmAction`, `farmOptionMap` — **presence + shape only** |
| Captcha | per-feature breakers, `captchaGlobalUntil`, `captchaGlobalKill` |
| Server pressure | `gbServerCooldown` / `gbServerPaused` remaining |
| Locks | held locks + age (`gbLocked`, `GB_LOCK_TTL`) |
| Budget | `reqBudgetPerMin`, current window occupancy (`core.js:525`) |
| Last OK / last skip | per feature, from `state.decisions` — `gbRecall`/`gbRecallAll` (`journal.js`) |
| Decision skips | open `state.decisionSkips` windows + expiry |
| Scrape deadlines | `nextFarmScrape`, `nextTownsScrape` vs now |
| Counts | findings, seen, farms, towns, journal length |

## Redaction — non-negotiable

- **Never** emit `state.csrf`. Emit `present: true/false` and at most a 6-char
  prefix, matching what preflight already does (`stats.js:33`).
- Never emit cookies.
- Learned templates: emit **key names and value types**, not values. A claim
  template can carry ids that identify the account.
- Honour the existing export-redaction toggle (v1.4.0) — if the user has
  redaction on, town/player names and ids get masked here too.

This is a paste-into-a-chat artifact. Assume it will be posted publicly.

## Design

- New function in `src/stats.js` (it already owns preflight + `orchStatus`
  consumption, so the imports are in scope and concat order is satisfied).
- `gbEvidence()` returns a plain object; `gbEvidenceText()` formats it.
- Render into the Log tab beside Diag; a **Copy** button, same mechanism as the
  existing Copy JSON in the Decisions sub-view.
- **Read-only.** No bridge post, no `gbXhr`, no `gameAjaxPost`. It must be safe
  to click while paused, captcha-tripped, or mid-gate.

## Files

- `src/stats.js` — `gbEvidence`, `gbEvidenceText`
- `src/ui.js` — Log tab button + copy handler
- `docs/TASKS.md` — rewrite gates to "paste Diag + Evidence"

## Risks

- **Leakage** if redaction is sloppy — see above; that is the whole risk surface.
- Size: cap the output (e.g. last 20 decisions per feature) so it stays pasteable.

## Validation

1. Click Evidence with everything OFF ⇒ valid output, no exceptions.
2. Click during a captcha pause ⇒ shows the open window and remaining time.
3. `grep -i csrf` the output ⇒ only `present:true` / 6-char prefix, never a token.
4. Hold a lock artificially (dry-run a long feature) ⇒ lock shows with its age.
5. Output is valid JSON (or clean text) and under ~30 KB.
6. Walk one real `TASKS.md` gate using only the dump — if a question cannot be
   answered from it, add that field and repeat.

## Done when

- One click produces a complete, redacted, pasteable snapshot.
- `docs/TASKS.md` gates reference it.
- No secret appears in the output under any toggle combination.
