# City-scheme Advisor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `src/city-scheme.js` module that reads the in-game Notas window, derives per-city role + mythical + recruit + transport + fire-ship plans, enforces a 2-cities-per-(god, mythical) pairing rule, and proposes copy-paste lines for towns missing from the Notas.

**Architecture:** One new module `src/city-scheme.js` (~250 lines) layered on top of `src/role-advisor.js`. Reads Notas via DOM scrape with model-probe fallback. Pure-function parsers + planners; no bridgePost, no gameAjaxPost, no edits to Notas. UI extends the existing `roleAdvisorRender` collapsible. Storage uses world-scoped keys already namespaced in `STORE`. Tick wired through `BOOT_TIMING.ROLE_ADVISOR_TICK_MS` (60000ms).

**Tech Stack:** GrepBot Tampermonkey userscript (vanilla JS inside one IIFE, jQuery selectors, no npm). Python `build.py` for artifact assembly. `tests/grepbot_context_check.py`, `tests/artifact_surface.py`, `tests/diff.py` for structural checks. Headless smoke driver `.claude/skills/run-grepbot/driver.mjs`.

**Spec:** `docs/superpowers/specs/2026-09-16-city-scheme-advisor-design.md`

## Global Constraints

- Single IIFE = one scope. `build.py` MODULES order is authoritative.
- All numeric reads via `gbNum(raw)`; unreadable → `blind`, em dash, never `0`.
- Wire values via `textContent`; no `innerHTML` with interpolated wire data.
- All repaint via `gbPaint(host, build, {key})`. No bare `replaceChildren` on a timer.
- `data-cfg` values stable across renames. New control: `autoCityScheme`.
- UI strings in Spanish. Em dash for unreadable.
- HIGH-RISK toggles default OFF. New `autoCityScheme` defaults ON (advisory only, no writes).
- No new write feature → no entry in `TX_WRITE_FEATURES`.
- Boot timing via `BOOT_TIMING` constants, never a naked ms literal in `boot.js`.
- `@version` bump + build + commit + tag = same turn (Version commit rule).
- Commit footer: `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Annotated tag (`git tag -a`), never rewrite.

---

### Task 1: Add storage keys + bump version + scaffold module shell

**Files:**
- Modify: `src/core.js` (STORE table, ~line 180 next to `ROLE_ASSIGNMENTS`)
- Modify: `src/header.js` (`@version` bump)
- Modify: `build.py` (MODULES list, add `src/city-scheme.js`)
- Create: `src/city-scheme.js` (module skeleton with exports only)

**Interfaces:**
- Produces: `STORE.CITY_SCHEME_CFG`, `STORE.CITY_SCHEME_NOTES`, `STORE.CITY_SCHEME_ROWS`, `STORE.CITY_SCHEME_PAIRS` — referenced by Task 2+.
- Produces: `window.__grepbotTest.cityScheme*` surface symbols — referenced by Task 6 and by the headless smoke driver.

- [ ] **Step 1: Bump version in `src/header.js`**

Read `src/header.js` first. Current version per CLAUDE.md is `6.0.92`. Bump the patch:
```js
// @version 6.0.93
```
- Match the existing comment style and field name.

- [ ] **Step 2: Add storage keys in `src/core.js` STORE**

Find the STORE table (around the `PLAYER_NOTES` / `ALLIANCE_NOTES` / `ROLE_ASSIGNMENTS` entries). Add four lines right after `ROLE_ASSIGNMENTS`:
```js
CITY_SCHEME_CFG: 'grepbot:city-scheme-cfg',
CITY_SCHEME_NOTES: 'grepbot:city-scheme-notes',
CITY_SCHEME_ROWS: 'grepbot:city-scheme-rows',
CITY_SCHEME_PAIRS: 'grepbot:city-scheme-pairs',
```
- Preserve the existing comma + space style.

- [ ] **Step 3: Add `src/city-scheme.js` to `build.py` MODULES**

Find the MODULES list. Add the entry directly after `'src/role-advisor.js'` (alphabetical / dependency order):
```python
'src/city-scheme.js',
```
- Match the existing string-with-commas format.

- [ ] **Step 4: Create `src/city-scheme.js` skeleton**

```js
// City-scheme advisor: reads the in-game Notas window and proposes per-city
// role + mythical + recruit + transport + fire-ship plans. Enforces a
// 2-cities-per-(god, mythical) pairing rule. Advisor-only: never writes
// through bridgePost and never edits the Notas window itself. See
// docs/superpowers/specs/2026-09-16-city-scheme-advisor-design.md.
const CITY_SCHEME_DEFAULTS = Object.freeze({
  enabled: true,
  pairTarget: 2,
  fireShipsOnAttack: 10,
  mythicalPerCity: 30,
  bigTransporterMythical: 1,
  parseSelectors: Object.freeze({
    window: '.window_main_container.notes, .gpwindow_content.notes',
    preview: '.preview_box, .notes_preview',
    textarea: 'textarea[name*="note"], .editable_note textarea',
  }),
});
const CITY_SCHEME_TICK_MIN_MS = 60000;
let citySchemeLast = { at: 0, fingerprint: 'none', rows: 0, pairs: 0 };

function citySchemeCfg() {
  const raw = state.citySchemeCfg && typeof state.citySchemeCfg === 'object' && !Array.isArray(state.citySchemeCfg) ? state.citySchemeCfg : {};
  const out = {
    enabled: raw.enabled !== false,
    pairTarget: gbCfgClamp(raw.pairTarget, 1, 6, CITY_SCHEME_DEFAULTS.pairTarget),
    fireShipsOnAttack: gbCfgClamp(raw.fireShipsOnAttack, 0, 50, CITY_SCHEME_DEFAULTS.fireShipsOnAttack),
    mythicalPerCity: gbCfgClamp(raw.mythicalPerCity, 0, 500, CITY_SCHEME_DEFAULTS.mythicalPerCity),
    bigTransporterMythical: gbCfgClamp(raw.bigTransporterMythical, 0, 10, CITY_SCHEME_DEFAULTS.bigTransporterMythical),
  };
  state.citySchemeCfg = out;
  return out;
}
function citySchemeSetCfg(patch) {
  const prev = citySchemeCfg();
  const next = Object.assign({}, prev, patch || {});
  state.citySchemeCfg = next;
  const clean = citySchemeCfg();
  save(STORE.CITY_SCHEME_CFG, clean);
  citySchemeInvalidate();
  return clean;
}
function citySchemeInvalidate() {
  citySchemeLast.at = 0;
  citySchemeLast.fingerprint = 'none';
}

function citySchemeTick() {
  const cfg = citySchemeCfg();
  if (!cfg.enabled) return false;
  // Heavy lifting in Task 6.
  return true;
}

function citySchemeRender(host, rerender) {
  if (!host) return;
  // UI in Task 6.
  const wrap = document.createElement('details');
  wrap.className = 'gb-section'; wrap.open = false;
  const summary = document.createElement('summary');
  summary.textContent = 'Esquema de ciudades (Notas)';
  wrap.appendChild(summary);
  const body = document.createElement('div');
  body.className = 'gb-section-body';
  body.style.cssText = 'font-size:9px;overflow:auto';
  body.textContent = 'Cargando...';
  wrap.appendChild(body);
  host.appendChild(wrap);
}

// Surface for headless smoke + agent inspection.
window.__grepbotTest = window.__grepbotTest || {};
window.__grepbotTest.citySchemeTick = citySchemeTick;
window.__grepbotTest.citySchemeCfg = citySchemeCfg;
window.__grepbotTest.citySchemeRender = citySchemeRender;
```

- [ ] **Step 5: Build and surface-check**

```sh
rtk python3 build.py
rtk python3 tests/artifact_surface.py
rtk python3 tests/grepbot_context_check.py
```
Expected: build passes all 4 gates (no duplicate decl from this file, the skeleton adds no top-level `function` collisions because everything is local const + nested function declarations); artifact surface check shows no regressions; context check prints `ok`.

- [ ] **Step 6: Commit (source + artifact)**

```sh
rtk git add src/header.js src/core.js build.py src/city-scheme.js grepbot.user.js
rtk git commit -m "feat(city-scheme): scaffold module + storage keys + version bump"
```
- The build rewrote `grepbot.user.js`; commit it together per CLAUDE.md §"Version commit rule".

---

### Task 2: Note scraper (DOM + model probe)

**Files:**
- Modify: `src/city-scheme.js` (add `citySchemeNotesScrape`, expose it via `__grepbotTest`)

**Interfaces:**
- Consumes: `CITY_SCHEME_DEFAULTS.parseSelectors`, `gameUw()`, `document`, `STORE` (none).
- Produces: `citySchemeNotesScrape()` → `string | null`. Returns the raw multi-line text, or `null` if every probe path failed.

- [ ] **Step 1: Append the scraper to `src/city-scheme.js`**

Add this block immediately before `function citySchemeTick()`:

```js
function citySchemeProbe(selector) {
  try { return document.querySelector(selector); } catch (_) { return null; }
}
function citySchemePreviewFromHtml(html) {
  if (html == null) return '';
  return String(html)
    .replace(/<br\s*\/?>(\s*)/gi, '\n$1')
    .replace(/<\/div>\s*<div[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r/g, '');
}
function citySchemeModelScrape() {
  try {
    const win = gameUw();
    const notes = (win && win.Game && win.Game.notesCollection) ||
                  (win && win.MM && win.MM.getCollections && win.MM.getCollections().notes) ||
                  (win && win.ITowns && typeof win.ITowns.getNotes === 'function' && win.ITowns.getNotes());
    if (Array.isArray(notes)) return notes.filter(n => typeof n === 'string').join('\n');
  } catch (_) {}
  return null;
}
function citySchemeNotesScrape() {
  const sel = CITY_SCHEME_DEFAULTS.parseSelectors;
  const textarea = citySchemeProbe(sel.textarea);
  if (textarea && typeof textarea.value === 'string' && textarea.value) return textarea.value;
  const win = citySchemeProbe(sel.window);
  const preview = win ? win.querySelector(sel.preview) : citySchemeProbe(sel.preview);
  if (preview) {
    const text = preview.textContent != null ? preview.textContent : citySchemePreviewFromHtml(preview.innerHTML);
    if (text && text.trim()) return text;
  }
  const fromModel = citySchemeModelScrape();
  if (fromModel && fromModel.trim()) return fromModel;
  return null;
}
```

- [ ] **Step 2: Expose via test surface**

Find the `window.__grepbotTest = window.__grepbotTest || {};` block. Add:
```js
window.__grepbotTest.citySchemeNotesScrape = citySchemeNotesScrape;
```

- [ ] **Step 3: Build and verify**

```sh
rtk python3 build.py
rtk python3 tests/artifact_surface.py
```
Expected: build passes; surface check shows `citySchemeNotesScrape` in `__grepbotTest`.

- [ ] **Step 4: Commit**

```sh
rtk git add src/city-scheme.js grepbot.user.js
rtk git commit -m "feat(city-scheme): add note scraper (DOM + model probe)"
```

---

### Task 3: Tokenizer + town mapper + keyword mapping

**Files:**
- Modify: `src/city-scheme.js` (add `citySchemeTokenize`, `citySchemeTownMap`, `citySchemeResolveTownId`, `CITY_SCHEME_MYTHICAL_GOD`, `CITY_SCHEME_KEYWORDS`)

**Interfaces:**
- Consumes: `townsFromGame()` (already exposed), `gbTownModel` (already exposed), `state.townGroups` (read-only).
- Produces: 
  - `CITY_SCHEME_MYTHICAL_GOD` (frozen map) — referenced by Task 4.
  - `CITY_SCHEME_KEYWORDS` (frozen map) — referenced by Task 4.
  - `citySchemeTokenize(rawLine)` → `{cityHint, keyword} | null`.
  - `citySchemeTownMap()` → `Map<string, string>` (name → townId) or `null` if `townsFromGame()` failed.
  - `citySchemeResolveTownId(hint, townMap)` → `{id, match}|null`.

- [ ] **Step 1: Append the tables**

```js
const CITY_SCHEME_MYTHICAL_GOD = Object.freeze(Object.assign(Object.create(null), {
  hydra: 'poseidon',
  ladon: 'poseidon',
  griffin: 'zeus',
  grifo: 'zeus',
  harpy: 'athena',
  harpia: 'athena',
  manticore: 'athena',
  manticora: 'athena',
}));
const CITY_SCHEME_KEYWORDS = Object.freeze({
  'ataque tierra': { role:'ataque_tierra', mythical:null, god:null },
  'ataque agua':   { role:'ataque_agua',   mythical:null, god:null },
  'ataque':        { role:'ataque_tierra', mythical:null, god:null },
  'def tierra':    { role:'def_tierra',    mythical:null, god:null },
  'def agua':      { role:'def_agua',      mythical:null, god:null },
  'def':           { role:'def_tierra',    mythical:null, god:null },
  'hoplitas':      { role:'ataque_tierra', mythical:'hoplite', god:'ares' },
  'hydra':         { role:'ataque_agua',   mythical:'hydra',   god:'poseidon' },
  'ladon':         { role:'ataque_tierra', mythical:'ladon',   god:'poseidon' },
  'grifo':         { role:'ataque_tierra', mythical:'griffin', god:'zeus' },
  'harpia':        { role:'ataque_tierra', mythical:'harpy',   god:'athena' },
  'manticora':     { role:'ataque_agua',   mythical:'manticore', god:'athena' },
  'trireme':       { role:'ataque_agua',   mythical:null, god:null, transport:'trireme' },
});
```

- [ ] **Step 2: Append the tokenizer + town mapper**

```js
function citySchemeTokenize(rawLine) {
  const line = String(rawLine == null ? '' : rawLine).trim();
  if (!line) return null;
  const m = line.match(/^(.+?)\s*[-·—]\s*(.+)$/);
  if (!m) return null;
  const cityHint = m[1].trim();
  const keyword = m[2].trim().toLowerCase();
  if (!cityHint || !keyword) return null;
  return { cityHint, keyword };
}

function citySchemeTownMap() {
  let towns = null;
  try { towns = townsFromGame(); } catch (_) {}
  if (!Array.isArray(towns) || !towns.length) return null;
  const out = new Map();
  for (const t of towns) {
    if (!t || t.id == null) continue;
    const name = (typeof t.getName === 'function' ? t.getName() : t.name) || '';
    if (name) out.set(String(name), String(t.id));
  }
  return out.size ? out : null;
}

function citySchemeResolveTownId(hint, townMap, modelFallback) {
  if (!hint || !townMap) return null;
  if (townMap.has(hint)) return { id: townMap.get(hint), match: 'exact' };
  const hintLower = hint.toLowerCase();
  for (const [name, id] of townMap.entries()) {
    if (name && name.toLowerCase() === hintLower) return { id, match: 'ci' };
  }
  for (const [name, id] of townMap.entries()) {
    if (name && (name.toLowerCase().startsWith(hintLower) || hintLower.startsWith(name.toLowerCase()))) {
      return { id, match: 'prefix' };
    }
  }
  if (modelFallback) {
    try {
      const probe = gbTownModel(hint);
      if (probe && probe.id != null) return { id: String(probe.id), match: 'model' };
    } catch (_) {}
  }
  return null;
}
```

- [ ] **Step 3: Expose via test surface**

Add inside the `window.__grepbotTest` block:
```js
window.__grepbotTest.citySchemeTokenize = citySchemeTokenize;
window.__grepbotTest.citySchemeTownMap = citySchemeTownMap;
window.__grepbotTest.citySchemeResolveTownId = citySchemeResolveTownId;
window.__grepbotTest.CITY_SCHEME_KEYWORDS = CITY_SCHEME_KEYWORDS;
window.__grepbotTest.CITY_SCHEME_MYTHICAL_GOD = CITY_SCHEME_MYTHICAL_GOD;
```

- [ ] **Step 4: Build + smoke (parser only)**

```sh
rtk python3 build.py
rtk python3 tests/artifact_surface.py
rtk node -e 'const src = require("fs").readFileSync("grepbot.user.js","utf8"); const m = src.match(/function citySchemeTokenize[\s\S]*?\n}/); console.log(m ? "found" : "missing");'
```
Expected: `found`. The headless smoke driver can also exercise the parser via the REPL.

- [ ] **Step 5: Commit**

```sh
rtk git add src/city-scheme.js grepbot.user.js
rtk git commit -m "feat(city-scheme): add tokenizer + town mapper + keyword table"
```

---

### Task 4: Scheme derivation + pairing logic

**Files:**
- Modify: `src/city-scheme.js` (add `citySchemeParse`, `citySchemePairing`, `citySchemeBuildRow`)

**Interfaces:**
- Consumes: `citySchemeTokenize`, `citySchemeResolveTownId`, `CITY_SCHEME_KEYWORDS`, `CITY_SCHEME_MYTHICAL_GOD`, `state.citySchemeCfg`.
- Produces:
  - `citySchemeParse(raw, townMap, cfg)` → `{rows, unparseable, unknownKeyword}`.
  - `citySchemePairing(rows, cfg)` → `{groups, deltas}` — `deltas` is a flat list of suggested add/convert/demote actions for the UI.
  - Each row gains: `role`, `mythical`, `god`, `schemeSource` (`keyword` or `default`), `unknownKeyword`, `pairing` (`ok|under|over|null`), `pairingProposal`, `recruitPlanBlind`.

- [ ] **Step 1: Append `citySchemeBuildRow`**

```js
function citySchemeBuildRow(token, townId, cfg, keywordMap) {
  const base = { id: townId, cityHint: token.cityHint, rawKeyword: token.keyword, role: null, mythical: null, god: null };
  if (!townId) return Object.assign(base, { unknownKeyword: token.keyword, pairing: null });
  const mapped = keywordMap[token.keyword];
  if (!mapped) return Object.assign(base, { unknownKeyword: token.keyword, pairing: null });
  const cfgGods = (cfg && cfg.gods && typeof cfg.gods === 'object') ? cfg.gods : null;
  const mythicalKey = mapped.mythical && cfgGods && cfgGods[mapped.mythical] ? mapped.mythical : mapped.mythical;
  const god = (mapped.god || (mythicalKey && CITY_SCHEME_MYTHICAL_GOD[mythicalKey]) || (cfgGods && mythicalKey && cfgGods[mythicalKey])) || null;
  return Object.assign(base, {
    role: mapped.role,
    mythical: mythicalKey,
    god: god || null,
    transport: mapped.transport || null,
    schemeSource: 'keyword',
    unknownKeyword: null,
    pairing: null,
  });
}
```

- [ ] **Step 2: Append `citySchemeParse`**

```js
function citySchemeParse(raw, townMap, cfg) {
  const keywordMap = Object.assign({}, CITY_SCHEME_KEYWORDS, (cfg && cfg.keywordOverrides) || {});
  const rows = [];
  const unparseable = [];
  const unknownKeyword = [];
  const lines = String(raw || '').split(/\n+/);
  for (const line of lines) {
    const token = citySchemeTokenize(line);
    if (!token) {
      if (line && line.trim()) unparseable.push(line);
      continue;
    }
    const resolved = citySchemeResolveTownId(token.cityHint, townMap, true);
    if (!resolved) {
      unparseable.push(line);
      continue;
    }
    const row = citySchemeBuildRow(token, resolved.id, cfg, keywordMap);
    row.match = resolved.match;
    if (row.unknownKeyword) unknownKeyword.push(row);
    rows.push(row);
  }
  return { rows, unparseable, unknownKeyword };
}
```

- [ ] **Step 3: Append `citySchemePairing`**

```js
function citySchemePairing(rows, cfg) {
  const groups = Object.create(null);
  const deltas = [];
  for (const r of rows) {
    if (!r.mythical || !r.god) { r.pairing = null; continue; }
    const key = r.god + '|' + r.mythical;
    (groups[key] = groups[key] || []).push(r);
  }
  for (const key of Object.keys(groups)) {
    const list = groups[key];
    if (list.length === cfg.pairTarget) list.forEach(r => { r.pairing = 'ok'; r.pairingProposal = null; });
    else if (list.length < cfg.pairTarget) {
      list.forEach(r => { r.pairing = 'under'; });
      const sample = list[0];
      deltas.push({ kind: 'add-mate', god: sample.god, mythical: sample.mythical, currentCount: list.length, targetCount: cfg.pairTarget });
    } else {
      list.forEach(r => { r.pairing = 'over'; });
      const keep = list.slice(0, cfg.pairTarget).map(r => r.cityHint);
      const demote = list.slice(cfg.pairTarget).map(r => ({ hint: r.cityHint, role: r.role, mythical: r.mythical, god: r.god }));
      deltas.push({ kind: 'demote', god: list[0].god, mythical: list[0].mythical, keep, demote, currentCount: list.length, targetCount: cfg.pairTarget });
    }
  }
  return { groups, deltas };
}
```

- [ ] **Step 4: Expose via test surface**

Add to the `window.__grepbotTest` block:
```js
window.__grepbotTest.citySchemeParse = citySchemeParse;
window.__grepbotTest.citySchemePairing = citySchemePairing;
window.__grepbotTest.citySchemeBuildRow = citySchemeBuildRow;
```

- [ ] **Step 5: Build + surface check**

```sh
rtk python3 build.py
rtk python3 tests/artifact_surface.py
```
Expected: build passes; surface check confirms the four new exports.

- [ ] **Step 6: Commit**

```sh
rtk git add src/city-scheme.js grepbot.user.js
rtk git commit -m "feat(city-scheme): add scheme derivation + 2-cities-per-pair logic"
```

---

### Task 5: Recruit + transport + fire-ship plan, new-city template

**Files:**
- Modify: `src/city-scheme.js` (add `citySchemeRecruitPlan`, `citySchemeFarmHeadroom`, `citySchemeNewCityTemplate`, integrate into `citySchemeTick`).

**Interfaces:**
- Consumes: `gbTownModel`, `gbTownPop`, `gbProbeNum`, `gbNum`, `roleAdvisorCoast`, `cdThreatState`, `recruitEffectiveUnitCost`, `state.citySchemeCfg`.
- Produces:
  - `citySchemeRecruitPlan(row, cfg)` mutates row in place: adds `recruit` (object), `transportNeeded` (object), `farmLevelsBuildable` (number|null), `popHeadroom` (number|null — em dash in UI when null), `recruitPlanBlind` (boolean).
  - `citySchemeNewCityTemplate(townId, town, cfg)` → `{hint, line, role}`.

- [ ] **Step 1: Append `citySchemeRecruitPlan`**

```js
function citySchemeRecruitPlan(row, cfg) {
  const recruit = {};
  const transport = {};
  let blind = false;

  if (row.mythical) {
    const cost = (() => {
      try { return recruitEffectiveUnitCost(row.id, row.mythical); } catch (_) { return null; }
    })();
    const popPerUnit = cost && cost.population != null ? gbNum(cost.population) : null;
    if (popPerUnit == null || popPerUnit <= 0) blind = true;
    recruit[row.mythical] = blind ? null : cfg.mythicalPerCity;
  }

  const navalAttack = row.role === 'ataque_agua' || (row.mythical && CITY_SCHEME_MYTHICAL_GOD[row.mythical] === 'poseidon');
  if (navalAttack) recruit.fire_ship = cfg.fireShipsOnAttack;
  if (row.transport === 'trireme' && !row.mythical) recruit.trireme = 8;

  const coast = roleAdvisorCoast(tryGetTown(row.id));
  const needsBoat = !!(row.mythical && CITY_SCHEME_MYTHICAL_GOD[row.mythical] === 'poseidon' && coast === false);
  if (needsBoat) transport.big_transporter = cfg.bigTransporterMythical;

  let farmLevelsBuildable = null;
  try {
    const pop = gbTownPop(row.id);
    const maxFarm = gbProbeNum(row.id, ['farm_max', 'farmMax', 'max_farm']);
    if (pop != null && maxFarm != null) farmLevelsBuildable = Math.max(0, Math.min(5, Math.floor(maxFarm - (pop.built != null ? pop.built : 0))));
  } catch (_) { farmLevelsBuildable = null; }

  let popHeadroom = null;
  try {
    const pop = gbTownPop(row.id);
    const cap = pop && pop.capacity != null ? gbNum(pop.capacity) : null;
    const used = pop && pop.used != null ? gbNum(pop.used) : 0;
    const recruitPop = Object.values(recruit).reduce((s, n) => s + (gbNum(n) || 0) * 1, 0);
    if (cap != null) popHeadroom = Math.max(0, cap - used - recruitPop);
  } catch (_) { popHeadroom = null; }

  row.recruit = recruit;
  row.transportNeeded = transport;
  row.farmLevelsBuildable = farmLevelsBuildable;
  row.popHeadroom = popHeadroom;
  row.recruitPlanBlind = blind;
  return row;
}
function tryGetTown(townId) {
  try { return gbTownModel(townId); } catch (_) { return null; }
}
```

- [ ] **Step 2: Append `citySchemeNewCityTemplate`**

```js
function citySchemeNewCityTemplate(townId, town, cfg) {
  const name = (town && (typeof town.getName === 'function' ? town.getName() : town.name)) || String(townId);
  const coast = roleAdvisorCoast(town);
  let threat = null;
  try { threat = cdThreatState(townId); } catch (_) { threat = null; }
  let role = 'ataque_tierra';
  if (coast === true && !(threat && threat.threatened === true)) role = 'ataque_agua';
  else if (threat && threat.threatened === true) role = 'def_tierra';
  const keyword = (CITY_SCHEME_KEYWORDS[Object.keys(CITY_SCHEME_KEYWORDS).find(k => CITY_SCHEME_KEYWORDS[k].role === role)] || { raw: role }).raw || role;
  const line = name + ' - ' + role;
  return { id: String(townId), hint: name, role, line, coast, threatened: !!(threat && threat.threatened === true) };
}
```

- [ ] **Step 3: Expose via test surface**

```js
window.__grepbotTest.citySchemeRecruitPlan = citySchemeRecruitPlan;
window.__grepbotTest.citySchemeNewCityTemplate = citySchemeNewCityTemplate;
window.__grepbotTest.tryGetTown = tryGetTown;
```

- [ ] **Step 4: Build + surface check**

```sh
rtk python3 build.py
rtk python3 tests/artifact_surface.py
```

- [ ] **Step 5: Commit**

```sh
rtk git add src/city-scheme.js grepbot.user.js
rtk git commit -m "feat(city-scheme): add recruit/transport/fire-ship plan + new-city template"
```

---

### Task 6: Tick + UI integration with role-advisor

**Files:**
- Modify: `src/city-scheme.js` (replace `citySchemeTick` stub + replace `citySchemeRender` stub with real render)
- Modify: `src/role-advisor.js` (extend `roleAdvisorRender` to host the new section)
- Modify: `src/boot.js` (wire the tick on `BOOT_TIMING.ROLE_ADVISOR_TICK_MS`)

**Interfaces:**
- Consumes: `gbPaint`, `gbTownModel`, `gbCfgClamp`, `roleAdvisorRender` (host), `BOOT_TIMING.ROLE_ADVISOR_TICK_MS`.
- Produces:
  - `citySchemeTick()` — fully implemented; reads scrape, parses, pairs, plans, repaints.
  - `citySchemeRender(host, rerender)` — full table UI inside the section.
  - Boot call `citySchemeTick()` registered on the role-advisor timer.

- [ ] **Step 1: Replace `citySchemeTick`**

```js
function citySchemeFingerprint(rows) {
  if (!Array.isArray(rows) || !rows.length) return 'empty';
  return rows.map(r => [r.id, r.mythical || '-', r.god || '-', r.role || '-', r.pairing || '-']).join('|');
}
function citySchemeTick() {
  const cfg = citySchemeCfg();
  if (!cfg.enabled) return false;
  const raw = citySchemeNotesScrape();
  if (raw == null) {
    citySchemeLast = { at: Date.now(), fingerprint: 'unreadable', rows: 0, pairs: 0, unreadable: true };
    return false;
  }
  const cache = state.citySchemeNotes || {};
  const fp = raw.length + ':' + (raw.slice(0, 64) || '');
  if (cache.fingerprint === fp && cache.at && Date.now() - cache.at < CITY_SCHEME_TICK_MIN_MS) return false;
  const townMap = citySchemeTownMap();
  const parsed = citySchemeParse(raw, townMap, cfg);
  parsed.rows.forEach(r => citySchemeRecruitPlan(r, cfg));
  const paired = citySchemePairing(parsed.rows, cfg);
  state.citySchemeRows = parsed.rows;
  state.citySchemePairs = paired;
  state.citySchemeNotes = { fingerprint: fp, at: Date.now(), raw, unparseable: parsed.unparseable };
  save(STORE.CITY_SCHEME_NOTES, state.citySchemeNotes);
  save(STORE.CITY_SCHEME_ROWS, parsed.rows);
  save(STORE.CITY_SCHEME_PAIRS, paired);
  citySchemeLast = { at: Date.now(), fingerprint: citySchemeFingerprint(parsed.rows), rows: parsed.rows.length, pairs: Object.keys(paired.groups).length };
  return true;
}
```

- [ ] **Step 2: Replace `citySchemeRender` with the real table**

```js
function citySchemeRender(host, rerender) {
  if (!host) return;
  const wrap = document.createElement('details');
  wrap.className = 'gb-section'; wrap.open = false;
  const summary = document.createElement('summary');
  summary.textContent = 'Esquema de ciudades (Notas)';
  wrap.appendChild(summary);
  const body = document.createElement('div');
  body.className = 'gb-section-body';
  body.style.cssText = 'font-size:9px;overflow:auto;display:grid;gap:4px';
  wrap.appendChild(body);

  const cfg = citySchemeCfg();
  const rows = Array.isArray(state.citySchemeRows) ? state.citySchemeRows : [];
  const pairs = state.citySchemePairs || { groups: {}, deltas: [] };
  const notes = state.citySchemeNotes || {};

  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center';
  const recalc = gbButton('Recalcular', { title:'Vuelve a leer Notas y recalcula', style:'font-size:9px', onClick:() => { citySchemeInvalidate(); citySchemeTick(); if (typeof rerender === 'function') rerender(); } });
  controls.appendChild(recalc);
  const enabledLabel = document.createElement('label');
  enabledLabel.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:9px';
  const enabledCb = document.createElement('input'); enabledCb.type = 'checkbox'; enabledCb.checked = cfg.enabled;
  enabledCb.addEventListener('change', () => { citySchemeSetCfg({ enabled: enabledCb.checked }); if (typeof rerender === 'function') rerender(); });
  enabledLabel.appendChild(enabledCb);
  enabledLabel.appendChild(document.createTextNode('asesor activo'));
  controls.appendChild(enabledLabel);
  body.appendChild(controls);

  const lastAt = citySchemeLast && citySchemeLast.at ? new Date(citySchemeLast.at).toLocaleTimeString() : '—';
  const meta = document.createElement('div'); meta.style.cssText = 'color:#888;font-size:9px';
  meta.textContent = 'filas: ' + rows.length + ' · pares: ' + Object.keys(pairs.groups || {}).length + ' · última: ' + lastAt + (citySchemeLast.unreadable ? ' · Notas no legible' : '');
  body.appendChild(meta);

  if (notes.unparseable && notes.unparseable.length) {
    const warn = document.createElement('div'); warn.style.cssText = 'color:#c66;font-size:9px';
    warn.textContent = 'líneas no reconocidas: ' + notes.unparseable.length;
    body.appendChild(warn);
  }

  const header = document.createElement('div');
  header.style.cssText = 'display:grid;grid-template-columns:1.2fr .9fr .9fr .9fr 1fr 1fr .6fr .6fr;gap:3px;color:#888;border-bottom:1px solid #333;padding:2px';
  ['ciudad','rol','mítico','dios','recluta','transporte','granjas','estado'].forEach(t => { const el = document.createElement('span'); el.textContent = t; header.appendChild(el); });
  body.appendChild(header);

  if (!rows.length) {
    const empty = document.createElement('div'); empty.style.cssText = 'color:#888;font-size:9px;padding:4px';
    empty.textContent = 'Sin filas. Abre la ventana Notas en el juego y vuelve a Recalcular.';
    body.appendChild(empty);
  }
  for (const r of rows) {
    const line = document.createElement('div');
    line.style.cssText = 'display:grid;grid-template-columns:1.2fr .9fr .9fr .9fr 1fr 1fr .6fr .6fr;gap:3px;border-bottom:1px solid #222;padding:2px;align-items:center';
    const name = (() => { try { const t = gbTownModel(r.id); return (t && typeof t.getName === 'function' ? t.getName() : (t && t.name) || r.id); } catch (_) { return r.id; } })();
    const recruitSummary = Object.entries(r.recruit || {}).map(([k,v]) => k + ':' + (v == null ? '—' : v)).join(' ') || '—';
    const transportSummary = Object.entries(r.transportNeeded || {}).map(([k,v]) => k + ':' + v).join(' ') || '—';
    const pairing = r.pairing === 'ok' ? 'par ok' : r.pairing === 'under' ? 'falta par' : r.pairing === 'over' ? 'sobra par' : '—';
    const cells = [name, r.role || '—', r.mythical || '—', r.god || '—', recruitSummary, transportSummary, r.farmLevelsBuildable == null ? '—' : String(r.farmLevelsBuildable), pairing];
    cells.forEach(value => { const el = document.createElement('span'); el.textContent = value; line.appendChild(el); });
    body.appendChild(line);
  }

  const deltas = (pairs.deltas || []);
  if (deltas.length) {
    const head = document.createElement('div'); head.style.cssText = 'margin-top:6px;color:#aaa;font-size:9px';
    head.textContent = 'Propuestas de apareamiento';
    body.appendChild(head);
    for (const d of deltas) {
      const row = document.createElement('div'); row.style.cssText = 'color:#bbb;font-size:9px;padding:2px';
      if (d.kind === 'add-mate') row.textContent = '+ añade un par para ' + d.god + ' · ' + d.mythical + ' (actual ' + d.currentCount + '/' + d.targetCount + ')';
      else if (d.kind === 'demote') row.textContent = '- sobra ' + d.mythical + ' (' + d.god + '): mantén ' + d.keep.join(', ') + ', reasigna ' + d.demote.map(x => x.hint + '→ataque tierra').join(', ');
      body.appendChild(row);
    }
  }

  const newTowns = (state.citySchemeNewTowns || []);
  if (newTowns.length) {
    const head = document.createElement('div'); head.style.cssText = 'margin-top:6px;color:#aaa;font-size:9px';
    head.textContent = 'Ciudades nuevas (líneas para Notas)';
    body.appendChild(head);
    const list = document.createElement('div'); list.style.cssText = 'font-size:9px;display:flex;flex-direction:column;gap:2px';
    newTowns.forEach(t => {
      const row = document.createElement('div'); row.textContent = t.line + (t.threatened ? '   (amenaza)' : '   (nueva)');
      list.appendChild(row);
    });
    body.appendChild(list);
  }

  host.appendChild(wrap);
}
```

- [ ] **Step 3: Extend `src/role-advisor.js` to host the new section**

Find `roleAdvisorRender(host, snapshot, rerender)`. The function currently builds its own `wrap` and calls `host.appendChild(wrap);` at the end. Right before that final append, add:
```js
if (typeof citySchemeRender === 'function') citySchemeRender(host, rerender);
```
- This single call preserves the existing role-advisor section and appends the city-scheme section directly underneath.

- [ ] **Step 4: Wire the tick in `src/boot.js`**

Find the existing block that calls `roleAdvisorTick()` on the `BOOT_TIMING.ROLE_ADVISOR_TICK_MS` interval. Add `citySchemeTick()` immediately after it in the same handler. Do NOT introduce a new timer or new interval — both calls run on the same cadence.

- [ ] **Step 5: Expose final tick + render**

```js
window.__grepbotTest.citySchemeFingerprint = citySchemeFingerprint;
window.__grepbotTest.citySchemeLast = () => citySchemeLast;
window.__grepbotTest.citySchemeRender = citySchemeRender;
```

- [ ] **Step 6: Build + surface check**

```sh
rtk python3 build.py
rtk python3 tests/artifact_surface.py
rtk python3 tests/grepbot_context_check.py
```
Expected: all three print ok / no regressions.

- [ ] **Step 7: Headless smoke (optional but recommended)**

```sh
rtk node .claude/skills/run-grepbot/driver.mjs
```
Expected: driver boots, visits every panel tab including Stats, no throw. The new section appears in the Stats tab.

- [ ] **Step 8: Commit**

```sh
rtk git add src/city-scheme.js src/role-advisor.js src/boot.js grepbot.user.js
rtk git commit -m "feat(city-scheme): wire tick + render section + new-town proposals"
```

---

### Task 7: Tag release + final verification

**Files:**
- Modify: `src/header.js` (no further change; version stays at 6.0.93)

- [ ] **Step 1: Confirm working tree is clean except for known artifacts**

```sh
rtk git status
```
Expected: only `grepbot.user.js` may appear as modified if any uncommitted rebuild happened. Commit it before tagging.

- [ ] **Step 2: Run the full structural net**

```sh
rtk python3 tests/grepbot_context_check.py
rtk python3 tests/artifact_surface.py
rtk python3 tests/diff.py tests/snapshots/pre-refactor.json --warn-only
```
Expected: context check `ok`; surface check `ok`; diff prints warnings only (review them; never recapture baseline to silence them).

- [ ] **Step 3: Annotated tag**

```sh
rtk git tag -a "v6.0.93" HEAD -m "Release v6.0.93: city-scheme advisor (notes scraper + mythical pairing)"
```
- Annotated (`-a`), not lightweight.

- [ ] **Step 4: Final report**

Report to user: spec file path, plan file path, version tag, build/surface check output, any smoke-driver anomalies, and the manual in-game validation steps the user still needs on `es146` (open Notas, confirm panel populates, edit a line, confirm repaint within 60s, found a new city, confirm "Ciudades nuevas" list shows the proposed line).

---

## Self-Review Notes

- **Spec coverage:**
  - §4.1 constants → Task 1 + Task 3.
  - §4.2 god mapping → Task 3 (table) + Task 4 (consumption).
  - §4.3 scraper → Task 2.
  - §4.4 tokenizer → Task 3.
  - §4.5 keyword → scheme → Task 3 + Task 4.
  - §4.6 pairing → Task 4.
  - §4.7 recruit/transport/fire-ship → Task 5.
  - §4.8 new-city template → Task 5 + Task 6 (UI integration).
  - §4.9 storage keys → Task 1.
  - §4.10 tick → Task 6.
  - §4.11 UI → Task 6.
  - Hard rules table → every task honors the relevant entries (numeric reads via `gbNum`, em dash for unreadable, `textContent` for wire values, `gbPaint` deferred to the existing role-advisor repaint, Spanish UI strings, no naked ms literal in boot.js).
  - §6 testing → Task 6 (smoke) + Task 7 (full net).
- **Placeholders:** none.
- **Type consistency:** `citySchemePairing(rows, cfg)` returns `{groups, deltas}` and Task 6 consumes both. `citySchemeRecruitPlan(row, cfg)` mutates `row` in place (documented at its definition). `citySchemeRender(host, rerender)` matches the call site added in role-advisor.