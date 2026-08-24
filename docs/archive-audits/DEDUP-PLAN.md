# GrepBot dedup plan — v5.10.3 → v5.11

Single Tampermonkey userscript, 50 modules in `src/`, one IIFE, concat-built to
`grepbot.user.js`. Baseline: 30,782 LOC `src/`, ~1.3 MB artifact, v5.10.2.

## Source of this plan

- Investigator sweep 1: post / write wrappers (deferred — see "Out of scope").
- Investigator sweep 2: UI / config / render patterns.
- Investigator sweep 3: dead code + unused exports (repo is clean; nothing here).
- Repo hygiene: 309 verbatim comment blocks already collapsed (9dd7f5f);
  dead surfaces already dropped (0fea444); no dead top-level functions (1792
  names, all referenced); no dead `state.X` writes; no `if(DEBUG)` / `if(false)`
  branches; no TODO/FIXME; no duplicate top-level consts; no unreferenced STORE
  keys.

## Constraints (binding)

1. Order: UI render → config bindings → queue presentation → queue state.
   Not post wrappers.
2. Expand existing primitives (`gbTip`, `gbPaint`, `gbWidgetRegister`,
   `queueCenterButton`). Never a parallel UI framework.
3. `gbButton` and `gbEmptyState` go in `core.js` (or a new
   `src/ui-primitives.js` placed after `core.js` in `build.py` MODULES) — not
   inside `ui.js`, which is itself the largest target for migration.
4. `cfgBindBool` / `cfgBindNumber` go in `ui.js` next to `bindConfig`. They are
   runtime binders, NOT auto-row builders — row markup stays hand-written
   until PR4/5.
5. Queue lanes: presentation-only dedup. Keep
   `nativeQueueReconcileBuild` / `Research` / `Recruit` independent. Do not
   merge domain validation. FIFO list ownership / append / head replacement
   stays where it is.
6. Hard-not-touch list:
   - `txRun`, `txCapture`, `txIntent`, reconciliation, journal, planner
     reservations.
   - `bridgePost` / `gameAjaxPost`.
   - `gbNum`, `gameUw`, storage key scoping, save behavior.
   - CAPTCHA, circuit breaker, template-health, safe-mode logic.
   - `orchTick` priority / deadlock / farm-first behavior.
   - Any timeout / unknown-outcome path.
   - Attack, reinforce, dodge, spy-send, favor, wonder, emergency-cave writes.
7. Concat-build rule: helper placement = dependency order, not file aesthetics.
   Run the dup-decl gate (`build.py` gate 1) after every move.
8. Safety rule:
   - Never `+raw || 0` style; `gbNum` only.
   - Never collapse two `!x` checks when either can be unreadable; preserve
     `{ ok, blind, why }` shape.
9. Definition of "optimization" for this repo, in priority order:
   1. Correctness and safety.
   2. Maintainability (one config binder, one queue UI row, one status badge).
   3. Runtime work (avoid unnecessary DOM rebuilds / scans / GameData reads).
   4. Artifact size — last. Smaller is nice but never worth changing safety
      semantics.

## Already done (no need to repeat)

| Item | Source |
|---|---|
| 309 verbatim comment blocks collapsed | commit 9dd7f5f |
| Dead surfaces dropped | commit 0fea444 |
| Real feature keys, `gbNum`, dead random fallback | commit 0fea444, 24d9094 |
| One queue surface (building windows drive Queue Center) | commit fccfdd9 |
| Verbatim `// ----` comment dedup pass | commit 9dd7f5f |

→ No "remove dead code" PR. Repo is healthy.

## Still real, fix cheaply or separately

These are NOT dedup work — separate commits:

| Item | Where | Action |
|---|---|---|
| `__grepbotTest` 152-line block (test-only, never set in src/) | `boot.js:216–367` | Housekeeping commit |
| `__grepbotPlanner` export | `planner.js:156` | Same housekeeping commit |
| `STORE.ACCEPT_UNITS_TPL` saved never loaded | `farms.js:34` | Persistence bug fix |
| `STORE.HERO_EQUIP_SUGGEST` saved never loaded | `military.js:223` | Persistence bug fix |
| `STORE.AUTO_HERO` saved never loaded | `military.js:380` | Persistence bug fix |
| `STORE.HERO_LOW_STAMINA_PCT` saved never loaded | `military.js:391` | Persistence bug fix |
| Bare `save()` inside cadence scans (hard-rule violation) | `farms.js:1473` and similar | Coalescer sweep, fold into PR3 |

## Out of scope (deferred indefinitely)

These were identified by investigator 1 and 2. They are deferred because they
either touch writes or change UI language. Re-evaluate after PR1–5 ship.

| Helper | Reason deferred |
|---|---|
| `txBatch(name, jobs, ttl, opts)` | Touches every write loop; high blast radius |
| `txOnce(name, ttl, postFn, opts)` | Same |
| `txOnCaptcha` / `txOnUnresolved` / `txLogErr` | Error-path shape; per-feature semantics differ |
| `gbLogIdle` / `gbLogStale` / `gbSkipIfLocked` / `gbLockOrSkip` | Touches writes or write-adjacent paths |
| `saveSafe` (try/catch around save) | Changes save semantics |
| `gbFmtErr(e, n)` | Cosmetic |
| `gbSkipIfPaused` | Duplicates 51 sites but each carries a feature-specific reason |
| `cfgChk` / `cfgNum` / `cfgSel` (row builders) | Different scope from your `cfgBindBool` / `cfgBindNumber` |
| `gbCopy(text, okMsg)` | Tiny; not worth a PR |
| `gbI18n` registry | Changes literal Spanish UI strings |
| Inline CSS in `build-auto.js:567–614` | Variant per tile, no shared shape |
| Native game DOM scaffolding (collect TreeWalker, context-menu sibling popup) | Game-coupled, not duplication |

## PR sequence

### PR 1 — Inventory only (`docs/DEDUP_MAP.md`, no behavior change)

Per-candidate record:
- existing function(s)
- call sites (file:line)
- touches writes? (yes → defer)
- required smoke path

Sections:
- DOM button / card / empty-state / badge construction in `qol.js`,
  `queue-center.js`, `stats.js`, `ui.js`, `build-auto.js`.
- Config binding shapes: `setChk` / `setNum` / `onCfg` / `saveNum` /
  `bindToggle` — 130+ sites, mostly `ui.js:2413–2587`.
- Queue-center presentation only: cards, FIFO rows, real-queue rows, status
  badges, move/delete buttons (`queue-center.js`).
- Queue state: in-flight / manual-review / paused / paused-once presentation
  (`native-ui.js`, `queue-center.js`).

Skip: every write path.

LOC: 0.

### PR 2 — DOM helpers + Queue Center row/card rendering (first task)

Add to `core.js`:

```js
function gbButton(label, opts) {
  const o = opts || {};
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  if (o.className) b.className = o.className;
  if (o.title) gbTip(b, o.title);
  if (o.disabled) b.disabled = true;
  if (typeof o.onClick === 'function') b.addEventListener('click', o.onClick);
  return b;
}

function gbEmptyState(text, className) {
  const el = document.createElement('div');
  el.className = className || 'gb-qc-empty';
  el.textContent = text;
  return el;
}
```

Scope: Queue Center only.
- Replace button construction at `queue-center.js` action rows (move / remove /
  pause / review).
- Replace empty-state blocks where identical (Queue Center "Sin cola", "Sin
  entradas").
- Status badges: only collapse the clearly identical 3-class badge
  (label + className + optional sub). Skip if any badge includes inline icon
  or computed color.
- Do NOT touch `nativeQueueReconcileBuild` / `Research` / `Recruit` / queue
  mutation / FIFO logic.
- 10–15 clearest sites, then stop.

Smoke:
- `python3 build.py` (gates 1, 2, 4 pass).
- `node .claude/skills/run-grepbot/driver.mjs` — click every tab, open Queue
  Center from each building type.
- Manual in-game with dry run ON for any action-control UI test.

Success criteria: no changes in displayed labels, button states, tooltips, or
click routes. `@version` bump + same-turn commit per the Version commit rule.

LOC: ~30–60 net removed.

### PR 3 — Declarative config bindings (low-risk controls only)

Add to `ui.js` next to `bindConfig`:

```js
function cfgBindBool(sec, selector, stateKey, storeKey, onChange) {
  const el = sec.querySelector(selector);
  if (!el) return;
  el.checked = !!state[stateKey];
  onCfg(selector, 'change', e => {
    state[stateKey] = !!e.target.checked;
    save(storeKey, state[stateKey]);
    if (onChange) onChange(state[stateKey], e);
  });
}

function cfgBindNumber(sec, selector, storeKey, get, set, normalize) {
  const el = sec.querySelector(selector);
  if (!el) return;
  el.value = get();
  onCfg(selector, 'change', e => {
    const value = normalize ? normalize(e.target.value) : +e.target.value;
    set(value);
    save(storeKey, value);
  });
}
```

Migrate in order (low-risk → high-risk):

1. UI / theme / panel geometry (`PANEL_GEOM`, `THEME`, `WIDGET_GEOM`,
   `HUD_PRODUCTION`, `HUD_COUNTDOWN`).
2. Diagnostics / snapshots / profiler.
3. Read-only intel prefs.
4. Pause / night / activity gating (still safe — single bool, read-only
   effect).

Do NOT migrate in PR3:
- HIGH-RISK toggles (recruit, dodge auto, favor, god spells, support send,
  dump, emergency cave, attack, reinforce, spy-send, trade, rural-trade,
  phoenician-trade).
- Controls that wake a scheduler immediately (`ibAuto`, `abAuto`, `autoFarm`,
  `autoBandit`, `autoCollect`, `autoResearch`, `autoCave`, `autoRuralTrade`,
  `autoRuralLevel`, `autoCulture`, `autoDump`, `autoTrade`, `autoPtTrade`,
  `autoHero`, `autoWallRepair`).
- Controls with migrations or multi-key legacy reads (`KEYBINDINGS`,
  `PANEL_GEOM`, anything previously reading multiple legacy keys).

Also fold into PR3:
- The bare `save()` inside cadence scans → `saveSoon()` (hard-rule fix from
  `farms.js:1473` et al.).

Smoke: toggle each migrated control, verify storage key written
(`grepbot:*`), verify the same immediate side effect fires.

Success criteria: same toggle writes the same key and triggers the same
behavior. `@version` bump.

LOC: ~80–120 net removed from `ui.js:2413–2587`.

### PR 4 — Queue Center presentation (cards, rows, badges, move/remove)

Only after PR2 lands and is stable.

Extract:
- Real-queue row markup (`gb-qc-job` shape) used in renderBuild / renderResearch
  / renderRecruit(land|naval).
- FIFO row markup (virtual list head/tail).
- Status label mapping (`pending` / `in-flight` / `manual-review` / `paused`)
  — text-only, no game reads.
- Move / delete / pause action buttons.

Keep separate:
- `nativeQueueReconcileBuild` / `Research` / `Recruit` — domain validation per
  lane.
- FIFO list ownership — append / head replacement logic.
- Reader functions against `GameData` / `nativeQueue*` API.

Smoke: open Queue Center from Senate, Academy, Barracks, Docks. Verify
town+lane tracking unchanged. Verify `[+]`/`[-]` and recruit popover unchanged.

LOC: ~100–200.

### PR 5 — Queue state utilities (only if PR4 stable)

Consolidate lane-invariant only:
- Root + town + lane initialization shape
  (`{ version, seq, towns:{<id>:{…}} }`).
- `paused` / `inflight` / `manualReview` presentation helpers.
- Reconciliation cadence / deadline stamping.

Preserve separate: build/research/recruit validators and executors.

Full in-game smoke (not just CDP) — these are state-shape changes.

LOC: ~50–100.

## Realistic LOC removal

| PR | Net LOC | Risk |
|---|---|---|
| 1 (inventory) | 0 | none |
| 2 (DOM helpers + QC rendering) | -30 to -60 | low |
| 3 (config binders, low-risk only) | -80 to -120 | low |
| 4 (QC presentation) | -100 to -200 | low |
| 5 (QC state utils) | -50 to -100 | medium |
| **Total** | **-260 to -480** | |

≈1–1.5% of artifact. Smaller than the all-patterns estimate because post
wrapper work is out of scope.

## Open questions for PR2 start

1. `core.js` vs new `src/ui-primitives.js` (placed after `core.js` in
   `build.py` MODULES) as the home for `gbButton` / `gbEmptyState`.
2. PR2 scope: 4-branch dispatch + row markup in `queue-center.js` only, NOT
   FIFO internals in `native-ui.js`. Confirm.
3. `docs/DEDUP_MAP.md` updated incrementally per PR, or one final pass at
   PR5.

## Diagnostic commands (when something looks wrong)

| Symptom | Command |
|---|---|
| Build fails gate 1 (dup decl) after helper move | `rtk grep -nE "^(function\|const\|let\|var) [A-Za-z_]" src/*.js \| sort \| uniq -d` |
| Build fails gate 2 (node --check) | `node --check grepbot.user.js` |
| Smoke driver pass before in-game | `node .claude/skills/run-grepbot/driver.mjs` |
| Config toggle no longer writes the same key | `rtk grep -nH "<data-cfg key>" src/ui.js` then check `cfgBindBool` migration |
| Queue Center wrong town or lane | log grep `nativeQueueFollowCenter\|renderQueueCenter` |

## Version commit rule (unchanged)

Every `@version` bump in `src/header.js` lands as one new git commit in the
same turn. Flow: edit `src/` → bump `@version` → `python3 build.py` →
commit. Gates 1, 2, 4 already failed the turn if the artifact is not written.
