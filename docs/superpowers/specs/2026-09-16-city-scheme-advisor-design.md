# City-scheme advisor — auto role + mythical pairing + transport plan

Status: draft (brainstorming path, architectural)
Date: 2026-09-16
Author: Claude (brainstorming session)

## 1. Context

GrepBot already runs `src/role-advisor.js` (372 lines). That module scores
each city across CD profiles (`cd_defense`, `cd_slinger_50ls`, plus the
naval profiles under `CD_PROFILE_DEFAULTS`) and applies the winner via
`goalSetProfile()`. It is profile-only: it never reads what the player
intends, never tracks which god/mythical a city is supposed to recruit,
never enforces any balance rule across cities.

The player maintains the **in-game Notas window** as the canonical
city-scheme ledger:

```
Atenas - ataque tierra
Atenas2 - hoplitas
Atenas3 - hydra
...
Atenas17 - manticora
Atenas18 -
...
```

`role-advisor` cannot see this. The current bot therefore never matches
the player's intent: profile reassignment can swap a hydra city into a
slinger profile, and the player has to catch the change manually.

The user's request: read the Notas, derive a per-city role+mythical
scheme, enforce a **2-cities-per-(god, mythical) pairing** rule, plan
recruit + transport + fire-ship quantities per city, and propose the
same scheme for any new town that appears in the world but is not yet
in the Notas. **Advisor-only**: surface proposals, let the user click
Apply per row.

## 2. Goals & non-goals

### Goals

- One new module, `src/city-scheme.js`, ~250 lines.
- Read the in-game Notas window (DOM scrape, with model probe fallback).
- Parse `<CityName> - <keyword>` lines; map name → townId via the
  existing `townsFromGame()` accessor.
- Per row produce:
  - `role` — one of `def_tierra`, `def_agua`, `ataque_tierra`,
    `ataque_agua`, `mixed` (the user vocabulary).
  - `mythical` — unit id (`hydra`, `ladon`, `griffin`, `harpy`,
    `manticore`, …) or `null` for non-mythical cities.
  - `god` — derived from the mythical via a configurable mapping table
    (default ships with `MYTHICAL_UNIT_GOD` extended with `ladon`,
    `griffin`, `harpy`, `manticore`).
  - `recruit` — target quantity per unit (mythical qty, fire ship qty).
  - `transport` — big_transporter / small_transporter qty when needed.
  - `farmLevelsBuildable` — count of farm levels still buildable given
    current population.
  - `popHeadroom` — free population after the proposed recruit.
- Pairing: for each `(god, mythical)` ensure exactly 2 cities. If the
  notes show 1 or 3+, propose the closest change to reach 2.
- New-city template: any town present in `townsFromGame()` but missing
  from the Notas gets a proposed line string the user can copy into the
  editor (default role derived from coast + threat state).
- UI: a new panel section inside the existing `roleAdvisorRender`
  container in Stats. New toggle in Ajustes: `autoCityScheme` (default
  ON — advisory only, no writes).
- Storage: `STORE.CITY_SCHEME_NOTES_CACHE` (last scrape fingerprint +
  parsed rows, world-scoped) and `STORE.CITY_SCHEME_CFG` (mapping
  table overrides + the per-(god,mythical) target count).

### Non-goals

- No writes: this module never calls `bridgePost`, `gameAjaxPost`,
  `recruitPost`, `transportBalanceJobs`, etc. Pure advisory.
- No auto-apply: even when the user accepts a row, the only effect is
  that the proposed role line is shown beside the existing Notas line.
  The actual profile change still goes through `roleAdvisorApply`, and
  recruit/build changes still go through their own toggles.
- No edits to the Notas window itself. The player keeps editing the
  notes in-game; the bot only reads and proposes.
- No new recruitment or transport features — only proposals.

## 3. Approach overview

Layered on top of the existing role-advisor:

```
Notas (DOM scrape)
   │  parse lines → rows
   ▼
city-scheme.js
   │  pairs + qty proposals
   ▼
role-advisor.js (existing)
   │  profile scoring + apply
   ▼
recruit.js / transport.js (existing)
```

Three new responsibilities sit in `city-scheme.js`:

1. **Note parser** — read `.window_main_container.notes .preview_box`,
   split lines, normalize whitespace, tokenize the ` - ` / ` · ` /
   ` — ` separator, drop empty tokens.
2. **Scheme planner** — for each parsed row, build `{role, mythical,
   god, recruitPlan, transportPlan, fireShips, farmHeadroom, popOk}`.
   Pure function of inputs; no I/O.
3. **Pairing enforcer** — group rows by `(god, mythical)`, count
   occurrences, propose add/remove actions to reach 2. Pure function
   of the parsed rows.

The module exposes a `citySchemeTick()` driven by a 60s timer (same
cadence as `roleAdvisorScanMinMs`), reads the cached notes on tick,
recomputes proposals, repaints the panel section via the existing
`gbPaint(host, build, {key})` path.

## 4. Module: `src/city-scheme.js`

Order in `build.py` MODULES: directly after `src/role-advisor.js` (it
imports nothing but consumes the cached `state.roleAssignments`).

```
src/header.js
src/core.js
src/planner.js
src/tx.js
src/bridge.js
src/journal.js
src/role-advisor.js
src/city-scheme.js   ← NEW
... (other feature modules, unchanged)
src/boot.js
src/footer.js
```

### 4.1 Constants

```js
const CITY_SCHEME_DEFAULTS = Object.freeze({
  enabled: true,
  pairTarget: 2,                 // cities per (god, mythical)
  fireShipsOnAttack: 10,         // min naves incendiarias on attack cities
  mythicalPerCity: 30,           // default recruit target for the city-mythical
  bigTransporterMythical: 1,     // big_transporter per naval mythical city
  parseSelectors: Object.freeze({
    window: '.window_main_container.notes, .gpwindow_content.notes, [class*="notes"]:not(.gb-):not([class*="gb-notes"])',
    preview: '.preview_box, .notes_preview',
    textarea: 'textarea[name*="note"], .editable_note textarea',
  }),
});
```

### 4.2 God mapping

Extend the existing `MYTHICAL_UNIT_GOD` table (currently `{ hydra:
'poseidon' }`) with the entries below. Loaded from
`STATE.CITY_SCHEME_CFG.gods` so the user can override.

```js
const MYTHICAL_GOD_DEFAULTS = Object.freeze({
  hydra: 'poseidon',
  ladon: 'poseidon',         // Greek sea serpent — same god as hydra
  griffin: 'zeus',           // grifo
  harpy: 'athena',           // arpía
  manticore: 'athena',       // mantícora
  // add new entries here when the user discovers more
});
```

Conflict rule: when two cities share a mythical but different gods
(player edited the table), the second row wins and the first is
flagged `godConflict: true`.

### 4.3 Note parser

```js
function citySchemeNotesScrape() {
  // probe order: textarea > preview_box > gameUw model
  const sel = CITY_SCHEME_DEFAULTS.parseSelectors;
  const textarea = document.querySelector(sel.textarea);
  if (textarea && textarea.value) return textarea.value;
  const preview = document.querySelector(sel.preview);
  if (preview && preview.textContent) return preview.innerHTML
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  // model fallback (best-effort, probe-only, never throw)
  try {
    const win = gameUw();
    const notes = (win.Game && win.Game.notesCollection) ||
                  (win.MM && win.MM.getCollections && win.MM.getCollections().notes) ||
                  (win.ITowns && win.ITowns.getNotes && win.ITowns.getNotes());
    if (Array.isArray(notes)) return notes.join('\n');
  } catch (_) {}
  return null; // unreadable → return previous cache + flag in journal
}
```

Lines that fail the parser go into `unparseable: []` so the UI can
show the user which entries need fixing. Empty lines and lines that
don't contain a separator are dropped silently (the user's notes have
empty trailing rows).

### 4.4 Line tokenizer

```js
function citySchemeTokenize(rawLine) {
  const line = String(rawLine || '').trim();
  if (!line) return null;
  const m = line.match(/^(.+?)\s*[-·—]\s*(.+)$/);
  if (!m) return null;
  return { cityHint: m[1].trim(), keyword: m[2].trim().toLowerCase() };
}
```

The `cityHint` is matched against `townsFromGame()` names with a
fuzzy fallback: exact → case-insensitive → leading substring (so
`Atenas3` matches `Atenas3 - hydra` even when the in-game name is
`Atenas` and the island number is metadata).

### 4.5 Keyword → scheme

```js
const KEYWORD_TO_SCHEME = Object.freeze({
  'ataque tierra': { role:'ataque_tierra', mythical:null,     god:null },
  'ataque agua':   { role:'ataque_agua',   mythical:null,     god:null },
  'ataque':        { role:'ataque_tierra', mythical:null,     god:null },
  'def tierra':    { role:'def_tierra',    mythical:null,     god:null },
  'def agua':      { role:'def_agua',      mythical:null,     god:null },
  'def':           { role:'def_tierra',    mythical:null,     god:null },
  'hoplitas':      { role:'ataque_tierra', mythical:'hoplite',god:'ares' },
  'hydra':         { role:'ataque_agua',   mythical:'hydra',   god:'poseidon' },
  'ladon':         { role:'ataque_tierra', mythical:'ladon',   god:'poseidon' },
  'grifo':         { role:'ataque_tierra', mythical:'griffin', god:'zeus' },
  'harpia':        { role:'ataque_tierra', mythical:'harpy',   god:'athena' },
  'manticora':     { role:'ataque_agua',   mythical:'manticore',god:'athena' },
  'trireme':       { role:'ataque_agua',   mythical:null,     god:null, transport:'trireme' },
});
```

Unknown keywords → `scheme: null`, surfaced in the UI as
`unknownKeyword` with the raw text shown verbatim so the user can
either rename the line or extend the table.

### 4.6 Pairing logic

```js
function citySchemePairing(rows, cfg) {
  const groups = Object.create(null);
  for (const r of rows) {
    if (!r.mythical) continue;
    const key = `${r.god}|${r.mythical}`;
    (groups[key] = groups[key] || []).push(r);
  }
  for (const [key, list] of Object.entries(groups)) {
    if (list.length === cfg.pairTarget) { list.forEach(r => r.pairing = 'ok'); continue; }
    if (list.length < cfg.pairTarget) {
      // propose converting one attack city with the same god but different mythical
      list.forEach(r => r.pairing = 'under');
      list.forEach(r => r.pairingProposal = list.length === 0 ? 'convert' : 'add-mate');
    } else {
      // surplus: keep the 2 strongest, demote the rest
      list.forEach(r => r.pairing = 'over');
      list.forEach(r => r.pairingProposal = list.length > cfg.pairTarget ? 'demote' : null);
    }
  }
  return groups;
}
```

"Convert" / "demote" proposals carry the source town name and the
target role string so the UI can show a one-line suggestion:

> `Atenas18 - def tierra` *(convert from trireme: too many naval
> attack cities, 4 vs pairTarget 2)*

### 4.7 Recruit / transport / fire-ship plan

For each row, compute:

- `recruit[mythical] = cfg.mythicalPerCity` if the city has the
  mythical, else 0. Coerced with `gbNum`; `null` (unreadable unit cost)
  → `recruitPlanBlind: true`, journal `city-scheme:mythical-cost-unreadable`.
- `recruit.fire_ship = (row.role starts with ataque_agua || row has any
  naval mythical) ? cfg.fireShipsOnAttack : 0`.
- `transport.big_transporter = (city needs sea mythical AND
  `gbTownModel` is non-coastal) ? cfg.bigTransporterMythical : 0`.
- `transport.trireme = role==='ataque_agua' && !hasNavalMythical
  ? 8 : 0` — keep two naval-attack lines independent: pure attack_agua
  builds triremes, mythical-naval cities keep their unit role.
- `farmLevelsBuildable = clamp(popMax - popCurrent, 0, 5)` — derived
  from `gbTownPop(townId)` and `gbProbeNum([...farmMax])`.
- `popHeadroom = populationCapacity - recruitTotalPop` — em dash when
  `gbNum()` returns null, never `0` (Hard rule: never render unreadable
  as 0).

### 4.8 New-city template

For each town in `townsFromGame()` that has no row in the parsed notes:

- coast === true AND threat === false → `ataque_agua`
- threat === true → `def_tierra`
- otherwise → `ataque_tierra`

The proposal is shown as a copy-paste-ready line:

> `Atenas23 - ataque tierra   (new city, default role)`

The user pastes it into the Notas editor manually.

### 4.9 Storage keys

```js
// core.js STORE table — append after ROLE_ASSIGNMENTS
CITY_SCHEME_CFG:      'grepbot:city-scheme-cfg',
CITY_SCHEME_NOTES:    'grepbot:city-scheme-notes',     // last scrape
CITY_SCHEME_ROWS:     'grepbot:city-scheme-rows',      // last computed plans
CITY_SCHEME_PAIRS:    'grepbot:city-scheme-pairs',     // pairing history
```

World-scoped (`state.worldId` is already the namespace prefix used by
every other storage key in core.js). 24h TTL on the scrape cache is
NOT applied — the notes rarely change and we want to repaint on the
next tick when the user edits.

### 4.10 Tick

```js
function citySchemeTick() {
  const cfg = citySchemeCfg();
  if (!cfg.enabled) return false;
  const raw = citySchemeNotesScrape();
  if (raw == null) return false; // wait for the Notas window
  const cache = state.citySchemeNotes || {};
  if (cache.raw === raw && cache.at && Date.now() - cache.at < 60000) return false;
  const rows = citySchemeParse(raw, citySchemeTownMap());
  const pairs = citySchemePairing(rows, cfg);
  state.citySchemeRows = rows;
  state.citySchemePairs = pairs;
  state.citySchemeNotes = { raw, at: Date.now(), fingerprint: citySchemeFingerprint(rows) };
  save(STORE.CITY_SCHEME_NOTES, state.citySchemeNotes);
  save(STORE.CITY_SCHEME_ROWS, rows);
  return true;
}
```

Boot wiring in `boot.js`: register the tick on the same
`BOOT_TIMING.ROLE_ADVISOR_TICK_MS` constant (60000) — extend the
existing role-advisor boot block, do NOT add a naked literal.

### 4.11 UI

Extend the existing `roleAdvisorRender` section with a second
collapsible `details` block titled **"Esquema de ciudades (Notas)"**:

- town | nota actual | rol propuesto | mítico | propuesta
  apareamiento | recluta | transporte | granero | estado
- bottom row: per-row "Copiar línea propuesta" button + a header
  "Copiar todas" which concatenates proposals for towns not yet in
  the notes.
- a help line that links to the per-town pairing delta when `pairing
  !== 'ok'`.

All cells use `textContent` (Hard rule: wire values via textContent,
not innerHTML). All repaint goes through `gbPaint(host, build, {key})`
(Hard rule: no bare `replaceChildren` on a timer).

## 5. Hard rules honored

| Rule | Where honored |
|---|---|
| A check may only block on a value it actually read. | `gbNum()` coerces every numeric read; unreadable → `recruitPlanBlind`, never 0. |
| Coerce with `gbNum`, never `+raw` + `isFinite`. | every numeric site in `citySchemeRecruitPlan`. |
| All writes go through `bridgePost` / `gameAjaxPost`. | N/A — this module never writes. |
| New write features must be in `TX_WRITE_FEATURES`. | N/A — no new write feature. |
| `gbPaint(host, build, {key})` for repaints. | `citySchemeRender` only calls `gbPaint`. |
| `innerHTML` only via `gbLit`, wire via `textContent`. | `preview_box` is read via `.textContent` / `.innerHTML.replace(/<br>/g, '\n')`, never injected. |
| `data-cfg` stable across renames. | new control name `autoCityScheme` is stable; user-visible label lives in i18n. |
| `<option value>` pinned. | N/A (no `<select>` in this UI). |
| Spanish for UI strings; em dash for unreadable. | column headers, buttons, help text in Spanish; em dash for `popHeadroom`. |
| `*Soon` coalescers in sweeps. | N/A (no sweep writes). |
| `BOOT_TIMING` constants, no naked literals in `boot.js`. | tick wired through `BOOT_TIMING.ROLE_ADVISOR_TICK_MS`. |
| Decision memory ring 400, 7-day TTL. | N/A (no posts). |
| Lock registry only via `gbLock`. | N/A (no locks). |
| `orchTick` sole econ scheduler; new features ride existing loops. | this is advisory, ticks every 60s on the existing role-advisor cadence. |

## 6. Testing

- Build: `rtk python3 build.py` (must pass gates 1–4).
- Surface: `rtk python3 tests/artifact_surface.py` (no new surface
  symbols, only `__grepbotTest.cityScheme*` exports).
- Snapshot: `rtk python3 tests/diff.py tests/snapshots/pre-refactor.json
  --warn-only` (review warnings; never recapture baseline).
- Headless: `rtk node .claude/skills/run-grepbot/driver.mjs` boots and
  visits the new section without throwing.
- Manual: open Notas window in-game, confirm the panel populates.
  Edit a line → confirm repaint within 60s. Add a new city → confirm
  the "Copiar todas" line shows the proposed entry.

## 7. Out of scope (deferred)

- Auto-applying the proposed profile (would require a per-feature
  HIGH-RISK toggle; deferred to a separate spec).
- Editing the Notas window from the bot (would require a model
  write + new toggle; deferred).
- Auto-recruit of mythicals / auto-transport for the mythical plan
  (would add `recruit-mythical` and `transport-mythical` to
  `TX_WRITE_FEATURES`; deferred).
- Per-town pairing beyond the 2-cities rule (player configurable
  later via `STATE.CITY_SCHEME_CFG.pairOverrides[god|mythical]`).