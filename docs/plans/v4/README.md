# v4 feature plans — concrete derivation of plan 27

Plan `27-v4-wishlist-2026-08-10.md` is a **catalogue**: 61 features described by
one table row each (name, risk, size, module hint). That is not enough to code
from. This directory holds the concrete per-feature plan for every one of them.

**Baseline:** `src/` @ `@version 3.9.0` (`src/header.js:4`), 40 modules
(`build.py` MODULES). Written 2026-08-10.

> Plan 27 was written against v3.8.2; the tree is now v3.9.0, so some of its
> line references have drifted. Each plan below cites the line it actually
> verified rather than inheriting plan 27's.

One file per feature, named `<plan-27 id>-<slug>.md`, so the dependency graph in
plan 27 (§5 "5.1 requires 1.3", §10 coding order, §12 version buckets) keeps
resolving against these files.

> These plans **replace** plan 27 as the thing you code from. Plan 27 stays as
> the intake record and the policy source (§0 out-of-scope, §11 validation,
> §13 conventions). Do not start from plan 27's tables alone.

---

## Authoring contract

Every file in this directory follows the structure below. The quality bar is
`docs/plans/26-improvement-sweep-2026-08-10.md`: **every claim about the current
tree carries a `file.js:line` citation**, and anything not verifiable in `src/`
is labelled as an assumption, not stated as fact.

```markdown
# <id> — <Feature name>

**Bucket:** v4.x · **Risk:** Low|Med|High · **Size:** S|M|L
**Module:** <existing file to extend, or new file + its build.py MODULES slot>
**Depends on:** <plan-27 ids, or "none">
**Status:** PLANNED — written 2026-08-10 against `src/` @ v3.8.2

## 1. What exists today
Evidence with file:line for every claim. What is already coded, what is
partially coded, what is absent. If a symbol the catalogue names does not
exist, say so (plan 26 §B2 found exactly this).

## 2. Gap
The specific delta between §1 and the feature. One paragraph.

## 3. Design
How it works. Data flow in, decision, action out. Name the real functions it
calls.

## 4. Work items
Numbered. Each names the file, the function, and what changes. A competent
implementer should not need to re-derive anything.

## 5. State & storage
New `state.*` fields, `STORE.*` keys, whether the key goes in
`WORLD_SCOPED_BASES` (id-bearing ⇒ yes), `configVer` bump, prune TTL.

## 6. Config surface
Exact toggle/field labels, defaults. HIGH-RISK ⇒ default OFF.

## 7. Post surface & safety
Bridge-first route, `gbAjaxWatch(sig, settle)` registration, template name in
`TPL_FEATURE_MAP`/`tplNameFor`, `gbCaptchaPause` feature key, `gbLock` name +
`GB_LOCK_TTL` entry, dry-run behaviour. Read-only features: say "no post
surface" and skip the rest.

## 8. Failure modes
Including the precondition invariant: every guard names the value it read, and
an unreadable getter ⇒ `blind` ⇒ `gbLogT` once ⇒ let the server decide.

## 9. Validation gate
Manual, per plan 27 §11 risk class. Concrete: what to click, what the Log must
say, what must NOT appear.

## 10. Out of scope
What this plan deliberately does not do, and which plan/id owns it instead.
```

### Hard rules for authors

1. **Cite or don't claim.** No "presumably", no invented line numbers. Grep it.
2. **Never invent a game endpoint, action name, or payload field.** If the
   route is unknown, the work item is "sniff `<x>` via `gbAjaxWatch`, capture
   the template" — an explicit unknown, not a guess. (CLAUDE.md: never default
   a spell power id, never guess a claim-option index.)
3. **Respect plan 27 §0.** Nothing from the dropped list comes back: no
   anticaptcha, no phone-home server, no user-event I/O, no plugin system, no
   test harness.
4. **No new schedulers** (`gbInterval`), **no new `*InFlight` booleans**
   (`gbLock` + `GB_LOCK_TTL`), **no new top-level `function` declarations** that
   could trip the `build.py` duplicate-declaration gate — module-local IIFE.
5. **Dry-run gate before any live post.** Every write path.
6. Read-mostly features must state plainly that they add no post surface.

---

---

## What this sweep found wrong in plan 27

The single most valuable output of writing these 61 plans. Plan 27's table rows
were unverified; grepping the tree contradicted them in four distinct ways.

### Module hint wrong — the logic lives somewhere else

| id | Plan 27 said | Reality |
|---|---|---|
| 2.9 | extend `build-targets.js` | `goals.js` — the planner hook already lives there |
| 2.12 | extend `core.js` | `bridge.js:235-322` — `townResState`, `gbAfford`, `gbProbeNum` are all there, not in `core.js` |
| 3.7 | new `cs-tracker.js` | **no such module exists**; CS lives in `dodge.js` |
| 4.3 | new `hero.js` | extend `military.js` — all existing hero code is already there |
| 4.5 | new `wall.js` | extend `build-auto.js` + `build-targets.js`; wall is an ordinary building |
| 5.6 | extend `build-targets.js` | `native-ui.js` owns the native FIFO queue |
| 6.14 | `military.js` | the incoming-movement data is in `dodge.js` |
| 7.3 | new `alliance-pool.js` | extend `intel.js`; honest scope is ~120 lines |
| 7.5 | extend `qol.js` (autocomplete) | **phantom** — zero `autocomplete`/`datalist`/`typeahead` hits anywhere in `src/` |

### Symbols plan 27 names that do not exist

- **`orchestrator.skip`** (1.1) — not in `orchestrate.js:147-199`. Use the
  existing `automationPaused()` rather than inventing a parallel pause flag.
- **`transportTpl`** (1.3, 3.4, 5.1) — zero hits. There is no separate transport
  route; all three plans reuse `gameAjaxPost('trade', 'town_info', …)` from
  `tradeSend` (`trade.js:37-46`).
- **`state.supportTpl`** (3.2) — does not exist, and reusing `attackTpl` with
  `arguments.type='support'` would re-create the v2.5.7 favor-vs-attack template
  poison documented at `core.js:785-789`. 3.2 adds a discriminated template.

### Cannot be built as the catalogue describes

- **7.3 alliance resource pool** — alliance-wide resources for *other* members
  are not readable: zero `MM.getCollectionByName('Alliance')` hits in `src/`.
  Rescoped to own towns + last-seen spied towns + a user-typed self-report.
- **7.5 map tint** — the map is canvas, and plan 27 §0 itself forbids canvas
  work. Re-anchored as a CSS status overlay on Intel dossier rows.
- **2.12 loot capacity** — no per-unit carry constant exists anywhere in `src/`;
  it is server-side. Returns a `blind` sentinel until `GameData.units` is
  sniffed, rather than shipping a guessed number.
- **2.6 farm profitability** — depends on the farm resource scrape that plan 26
  §A1 proved is dead. Planned against claim history and travel time instead.

### Already coded — plan 26 §B2 is now stale

`intelSetAllianceNote` **does exist** (`intel.js:124`, wired at `ui.js:1006`);
plan 03 shipped since plan 26 was written. Also largely built already: 2.11
(reads existing `state.recruitTargets` + `state.townGoals[].units`, needs *no*
new state), 3.3's recall half (`militaryCancelCommand` `military.js:45-70`), and
4.3's hero transfer.

### Dependencies plan 27 missed

- **3.2 → 5.3**: support auto-send must consume the threat score, not invent a
  second one. Plan 27 lists only `1.3`.
- **6.13 → 7.2, 7.3, 7.6**: all four need the `[data-intel="view"]` selector that
  6.13 creates. It does not exist yet, so 6.13 gates the other three.
- **2.12 → 2.6**: once the calculator lands, 2.6 drops its local
  `ROOM_PER_HOUR` constant so the number has one home.

---

## Index

Filled in as plans land. Ids map 1:1 to plan 27.

| id | Feature | Risk | Size | Bucket |
|---|---|---|---|---|
| [1.1](1.1-panic-mode.md) | Panic mode (instant pause) | Low | S | v4.0 |
| [1.2](1.2-city-profiles.md) | City specialization profiles | Low | M | v4.0 |
| [1.3](1.3-transport-automation.md) | Inter-city transport automation | Med | M | v4.0 |
| [2.1](2.1-spy-report-deep-parse.md) | Spy report parser deep | Low | M | v4.0 |
| [2.2](2.2-enemy-city-timeline.md) | Enemy city timeline | Low | M | v4.0 |
| [2.3](2.3-ghost-town-detector.md) | Ghost town detector | Low | S | v4.0 |
| [2.4](2.4-player-inactivity-tracker.md) | Player inactivity tracker | Low | S | v4.0 |
| [2.5](2.5-battle-report-analyzer.md) | Battle report analyzer | Low | M | v4.0 |
| [2.6](2.6-farm-profitability-ranking.md) | Farm profitability ranking | Low | M | v4.0 |
| [2.7](2.7-population-management.md) | Population management | Low | S | v4.0 |
| [2.8](2.8-resource-capping-predictor.md) | Resource capping predictor | Low | S | v4.0 |
| [2.9](2.9-optimal-building-order.md) | Optimal building order | Low | M | v4.0 |
| [2.10](2.10-research-path-optimizer.md) | Research tree path optimizer | Low | L | v4.0 |
| [2.11](2.11-unit-composition-advisor.md) | Unit composition advisor | Low | M | v4.0 |
| [2.12](2.12-loot-capacity-calculator.md) | Loot capacity calculator | Low | S | v4.0 |
| [3.1](3.1-trade-route-manager.md) | Trade route manager | Med | M | v4.3 |
| [3.2](3.2-support-auto-send.md) | Support / reinforcement auto-send | Med | M | v4.3 |
| [3.3](3.3-colony-revolt-tracker.md) | Colony ship / revolt tracker | Low | M | v4.3 |
| [3.4](3.4-resource-dump.md) | Resource dump automation | Med | M | v4.3 |
| [3.5](3.5-emergency-cave-mode.md) | Emergency cave mode | High | L | v4.5 |
| [3.6](3.6-militia-smart-activation.md) | Militia smart activation | High | M | v4.5 |
| [3.7](3.7-counter-snipe-detector.md) | Counter-snipe detector (= 5.7) | Low | S | v4.3 |
| [4.1](4.1-auto-spy-scheduler.md) | Auto-spy scheduler | Med | M | v4.2 |
| [4.2](4.2-counter-intel-detection.md) | Counter-intel detection | Low | S | v4.2 |
| [4.3](4.3-hero-manager.md) | Hero manager | Med | L | v4.2 |
| [4.4](4.4-divine-spell-automation.md) | Divine spell automation | High | L | v4.5 |
| [4.5](4.5-wall-auto-repair.md) | Wall auto-repair | Med | M | v4.5 |
| [4.6](4.6-favor-regen-hud.md) | Favor regen optimizer (HUD) | Low | S | v4.2 |
| [5.1](5.1-resource-balancing-ai.md) | Resource balancing AI | Med | L | v4.2 |
| [5.2](5.2-adaptive-farming.md) | Adaptive farming | Med | M | v4.2 |
| [5.3](5.3-threat-assessment-engine.md) | Threat assessment engine | Low | M | v4.2 |
| [5.4](5.4-smart-dodge.md) | Smart dodge | High | L | v4.5 |
| [5.5](5.5-academy-slot-optimizer.md) | Academy slot optimizer | Low | M | v4.2 |
| [5.6](5.6-build-queue-optimizer.md) | Build queue optimizer | Low | S | v4.2 |
| [5.8](5.8-booty-camp-optimizer.md) | Booty camp optimizer | Low | S | v4.2 |
| [6.1](6.1-theme-system.md) | Dark mode / theme system | Low | S | v4.0 |
| [6.2](6.2-draggable-widgets.md) | Draggable widget system | Low | M | v4.1 |
| [6.3](6.3-keyboard-shortcuts.md) | Keyboard shortcuts | Low | M | v4.1 |
| [6.4](6.4-desktop-notifications.md) | Desktop notifications + sound | Low | S | v4.1 |
| [6.5](6.5-quick-action-toolbar.md) | Quick-action toolbar | Low | S | v4.0 |
| [6.6](6.6-city-quick-switch.md) | City quick-switch | Low | S | v4.0 |
| [6.7](6.7-map-context-menus.md) | Context menus on map | Med | M | v4.1 |
| [6.8](6.8-profile-auto-switching.md) | Profile auto-switching | Med | M | v4.1 |
| [6.9](6.9-config-wizard.md) | Config import/export wizard | Low | M | v4.1 |
| [6.10](6.10-config-undo-redo.md) | Undo/redo for config | Low | S | v4.0 |
| [6.11](6.11-production-overlay.md) | Real-time production overlay | Low | M | v4.1 |
| [6.12](6.12-growth-timeline-chart.md) | City growth timeline chart | Low | S | v4.1 |
| [6.13](6.13-alliance-intel-heatmap.md) | Alliance intel heatmap | Low | M | v4.1 |
| [6.14](6.14-attack-landing-countdown.md) | Attack landing countdown | Low | S | v4.1 |
| [7.1](7.1-shared-attack-planner-v2.md) | Shared attack planner v2 | Med | L | v4.4 |
| [7.2](7.2-defense-coordination-board.md) | Defense coordination board | Low | M | v4.4 |
| [7.3](7.3-alliance-resource-pool.md) | Alliance resource pool tracker | Low | M | v4.4 |
| [7.4](7.4-mass-intel-autopost.md) | Mass intel auto-post | Med | M | v4.4 |
| [7.5](7.5-nap-war-tracking.md) | NAP / war tracking | Low | M | v4.4 |
| [7.6](7.6-alliance-activity-dashboard.md) | Alliance member activity | Low | M | v4.4 |
| [8.1](8.1-circuit-breaker.md) | Per-module circuit breaker | Low | M | v4.1 |
| [8.2](8.2-state-snapshots.md) | State snapshots | Low | M | v4.1 |
| [8.3](8.3-performance-profiler.md) | Performance profiler | Low | M | v4.1 |
| [8.4](8.4-memory-leak-detector.md) | Memory leak detector | Low | S | v4.1 |
| [8.5](8.5-replay-system.md) | Replay system | Low | M | v4.1 |
| [8.7](8.7-build-minification.md) | Minification knob (dev/prod) | Low | S | v4.1 |

**Not planned here:** 5.7 (duplicate of 3.7 — see that file) and 8.6 (decision
audit trail, already shipped in `journal.js` v1.1.0, plan 27 §8). Plan 27 §9's
15 already-shipped items stay validation-only work in `TASKS.md`.
