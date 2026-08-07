# 16 — Config presets

**Risk:** Med · **Size:** M · **Backlog:** §5.1

## Goal

Three one-click profiles: **AFK overnight**, **Active farming**, **War** —
with every HIGH-RISK toggle OFF in all three.

`grep -riE "configPreset|applyPreset"` = 0 hits. `qol.js` already has config
import/export (`qolExportConfig` `qol.js:141`, `qolImportConfig` `qol.js:160`),
which is the mechanism to build on.

## Preset contents (starting point, tune in-game)

| Toggle | AFK overnight | Active farming | War |
|---|---|---|---|
| `autoFarm` | ON, long claims (4h/8h sleep) | ON, 5–10 min claims | ON |
| `autoCave` | ON | ON | ON (protect iron) |
| `autoTrade` / `islandShip` | ON | ON | ON |
| `autoCulture` | ON | ON | OFF (save resources) |
| `autoResearch` | ON | ON | OFF |
| `abAuto` (build) | ON | ON | OFF |
| `ibAuto` (instant) | OFF | ON | OFF |
| `autoCollect` | OFF | ON | ON |
| Night pause | ON | OFF | OFF |
| Dodge | **notify only** | notify only | notify only |
| `autoRecruit` / `autoFavor` / dodge-auto | **OFF** | **OFF** | **OFF** |
| `dryRun` | untouched | untouched | untouched |

## Design

1. **Preset = a partial config patch**, applied through the existing import path
   so there is exactly one code path that mutates config
   (`qolImportConfig`, `qol.js:160`). Do not write a second setter that can
   drift from import's validation and `configVer` handling.
2. **Never touch, under any preset:**
   - `autoRecruit`, `autoFavor`, auto-dodge — HIGH-RISK, must stay user-set OFF
   - `dryRun` — the user's safety switch is not a preset's business
   - `enabledHosts` — per-world consent (C7) is explicit, not preset-driven
   - learned templates, journal, seen/findings
   This exclusion list is the whole safety story of the feature. Encode it as an
   explicit allow-list of preset-writable keys, not a deny-list — a deny-list
   silently starts writing every new toggle someone adds later.
3. **Preview + confirm.** Show a diff ("12 changes: autoCulture ON→OFF, …") and
   require confirmation. Applying blind is how a user loses a tuned config.
4. **Undo.** Snapshot the previous config before applying; one-click restore.
5. **Custom presets** out of scope for v1 — export/import already covers that.

## Files

- `src/qol.js` — preset definitions, allow-list, apply-via-import, snapshot/undo
- `src/ui.js` — Config tab preset buttons + diff dialog

## Risks

- **Silently flipping a HIGH-RISK toggle ON** is the worst possible outcome. The
  allow-list plus a test that asserts the three HIGH-RISK keys are absent from
  every preset is the mitigation. Write that test as an explicit checked
  invariant in code (a guard that logs and refuses), since the repo has no test
  runner (`CLAUDE.md`, paste-only mode).
- Clobbering a carefully tuned config — mitigated by preview + undo.
- Presets encode opinions that will age; keep them in one obvious table.

## Validation

1. Apply each preset ⇒ diff dialog lists exactly the changes it then makes.
2. After each preset: `autoRecruit`, `autoFavor`, auto-dodge all still OFF.
   **Primary gate.**
3. `dryRun` ON before applying ⇒ still ON after, for all three presets.
4. `enabledHosts` unchanged after applying.
5. Undo restores the prior config exactly (compare export before/after).
6. Apply preset, reload ⇒ settings persisted.
7. Add a new toggle to `core.js`, apply a preset ⇒ new toggle untouched
   (proves allow-list, not deny-list).

## Done when

- Three presets apply via the import path with preview + undo.
- No preset can write a HIGH-RISK toggle, `dryRun`, or host consent.
