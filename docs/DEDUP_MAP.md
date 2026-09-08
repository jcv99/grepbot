# GrepBot — Dedup Map (PR 1 inventory, 0 LOC)

Verified against `src/` @ v6.0.16 (53 modules) on 2026-09-01. Supersedes the
site counts in `archive-audits/DEDUP-PLAN.md` (v5.10.3 era) where they
differ — the 6.x merge moved several. PR order and constraints come from
`DEDUP-PLAN.md`; this file is only the inventory. No behavior change.

Legend: **writes?** = the pattern sits on or feeds a post path (defer per
DEDUP-PLAN hard-not-touch list). **Smoke** = minimum validation after the
PR lands (CDP = `node .claude/skills/run-grepbot/driver.mjs`, in-game =
manual on es146 with dry run ON).

## A. DOM button / empty-state / badge construction (PR 2)

Raw `document.createElement('button')` sites: **25 in 10 files**

| File | Sites | Notes |
|---|---|---|
| `ui.js` | 7 | panel chrome + config rows — migrate only the clearest |
| `qol.js` | 5 | widget/template buttons |
| `recruit.js` | 3 | recruit popover — HIGH-RISK-adjacent UI, presentation only |
| `military.js` | 3 | composition table controls |
| `queue-center.js` | 1 | rest already goes through `queueCenterButton` (7 hits) |
| `native-ui.js` | 1 | in-place `[+]`/`[-]` tile controls |
| `context-menu.js` | 1 | sibling popup |
| `shared-plan.js` | 1 | |
| `trade.js` | 1 | |
| `build-auto.js` | 1 | |

Empty states (`gb-qc-empty` / `placeholder(`): `ui.js` 3, `intel.js` 3,
`queue-center.js` 2 — **8 sites**, identical shape (div + class +
textContent).

- Existing functions: none shared; `queueCenterButton` is QC-local.
- New helpers: `gbButton(label, opts)` + `gbEmptyState(text, className)` in
  `core.js` (per DEDUP-PLAN constraint 3 — not `ui.js`).
- writes? **No** — presentation only. Recruit/military buttons mutate no
  write state at construction time.
- Smoke: CDP full pass (9 tabs + QC 4 lanes + preflight 0 FAIL). No in-game
  needed for pure construction swaps.
- PR 2 scope: 10–15 clearest sites, QC action rows first. Est. -30 to -60
  LOC.

## B. Config binding shapes (PR 3)

`onCfg(` call sites in `ui.js`: **62**. Shapes seen: bool
(`checked` → `state.X` → `save(STORE.X)`), number (`+value` → normalize →
save), select (pinned `value` → save). `bindConfig` resolves by
`[data-cfg=…]`; row markup stays hand-written.

- Existing functions: `bindConfig`, `onCfg` (both `ui.js`).
- New helpers: `cfgBindBool` / `cfgBindNumber` next to `bindConfig`
  (DEDUP-PLAN constraint 4 — runtime binders, not row builders).
- writes? **No** for the migration set. Exclusion list (do NOT migrate):
  HIGH-RISK toggles, scheduler-waking controls, migration/multi-key legacy
  readers — full list in `NEXT-PLAN-2026-09-01.md` Phase 2.3.
- Smoke: CDP + REPL `cfg <key> <value>` round-trip per migrated control
  (assert storage key + side effect fire).
- Est. -80 to -120 LOC.

## C. Queue Center presentation (PR 4)

`gb-qc-job` / `gb-qc-badge` / `queueCenterButton` shapes: 7 hits in
`queue-center.js`; four lane renders (build / research / recruit land /
recruit naval) repeat real-queue row + FIFO row + status badge + move /
remove buttons.

- Existing functions: `queueCenterButton`, lane render fns in
  `queue-center.js`.
- writes? **No** — presentation merge only. Keep
  `nativeQueueReconcileBuild/Research/Recruit` and FIFO ownership separate
  (DEDUP-PLAN constraint 5).
- Smoke: CDP QC lane walk + in-game dry run (open from Senate / Academy /
  Barracks / Docks, verify town+lane follow).
- Est. -100 to -200 LOC. Only after PR 2 stable.

## D. Queue state utilities (PR 5)

Lane-invariant state shape (`{version, seq, towns:{…}}`, `paused`,
`inflight`, `manualReview`) shared by `native-ui.js` + `queue-center.js`.

- writes? **No**, but state-shape changes — medium risk.
- Smoke: **full in-game** (not just CDP).
- Est. -50 to -100 LOC.

## E. Template learning (item 2.7)

Learned-template write sites: **12 in 6 files**

| Site | Template |
|---|---|
| `parse-inline.js:348` | `spyTpl` |
| `parse-inline.js:597` | `claimTpl` |
| `parse-inline.js:611` | `acceptUnitsTpl` |
| `parse-inline.js:655` | `attackTpl` |
| `parse-inline.js:675` | `cancelTpl` |
| `parse-inline.js:685` | `wonderFavorTpl` |
| `parse-inline.js:697` | `heroTpl` (per-action map) |
| `collect.js:17` | `collectTpl` (`learnCollectAction`) |
| `farms.js:1356` | farm action (`learnFarmAction`) |
| `support.js:37` | `supportTpl` |
| `phoenician.js:280` | `ptTradeTpl` |
| `quests.js:288` | quest rewards (`learnQuestRewardsFromPayload`) |

- New helper: `learnTemplate(stateKey, storeKey, j, {stripArgs, label})`.
- writes? **Adjacent** (feeds write templates) but the learn itself is a
  read-path side effect. Per-template `stripArgs` differ — keep them
  parameterized. Templates stay per-feature (`supportTpl` ≠ `attackTpl`).
- Smoke: CDP + in-game dry run, one manual action per migrated template to
  confirm re-learn.
- Est. HIGH value, low risk.

## F. `bridgeRaw` + `gameAjaxRaw` merge (item 2.8)

`bridge.js:166` (`bridgeRaw`) and `bridge.js:223` (`gameAjaxRaw`) share the
settled-dedup + `gbAjaxWatch` skeleton; differ in payload shape and settle
semantics.

- writes? **Yes-adjacent** — both sit under `bridgePost` / `gameAjaxPost`.
  Merge the transport skeleton only; do not touch guard order in `txRun`.
- Smoke: CDP dry-run post + in-game dry run.
- Est. -60 LOC.

## G. `gbTownModel()` adoption sweep (item 2.9)

Hand-rolled `uw.ITowns.getTown ? … : towns[id]` sites: **15 in 12 files**
(`cave.js` 3, `bridge.js` 2, `core.js`, `emergency.js`, `attack.js`,
`phoenician.js`, `research-graph.js`, `rural.js`, `transport.js`,
`culture.js`, `build-auto.js`, `towns.js` 1 each). `gbTownModel` itself has
34 call sites in 14 files — the sweep converts the stragglers.

- writes? No — read-path mechanical swap.
- Smoke: CDP preflight 0 FAIL (exercises most of these readers).
- Est. MED, mechanical.

## H. `movementModels()` in `core.js` (item 2.10)

`MovementsUnits` walkers: **22 mentions in 5 files** — `dodge.js` 6,
`tx.js` 5, `shared-plan.js` 5, `bandit.js` 4, `diagnostics.js` 2. Three
distinct walk shapes (incoming hostile, outgoing own, attack-spot en-route).

- writes? **Yes-adjacent** (dodge/support decisions). Collapse the
  collection-walk only; per-caller filters stay.
- Smoke: CDP + in-game dry run with a fake incoming (report paste).
- Est. MED.

## I. `gbTry(fn, fallback, tag)` (item 2.11)

`try/catch` sites in `boot.js`: **39** — mostly boot-step guards. Helper
lives in `boot.js` or `core.js`; replaces the mechanical
`try { x() } catch (_) {}` sites only, never a catch that logs or
reconciles.

- writes? No.
- Smoke: CDP boot (title `SMOKE_OK`, 0 page errors).
- Est. MED, mechanical.

## J. `xhrLadder(guesses, opts)` (item 2.12)

Ladder/guess lists: `towns.js` 5 (`TOWN_LIST_GUESSES`, `townLadder`, …),
`farms.js` 2, `core.js` 2, `ui.js` 1 — **10 sites**.

- writes? Mixed — `towns.js` ladders feed scrapes (read posts). Keep
  learned-key pinning semantics identical.
- Smoke: CDP + in-game dry run of a town scrape.
- Est. MED.

## K. `countUnits(units)` (item 2.13)

Unit-sum reduces: part of the **28** `reduce((n/a/s/acc…` sites in 13
files; the unit-counting subset (`attack.js` 5, `reinforce.js` 5,
`support.js` 2, `native-ui.js` 2, …) is ~11 sites per the 8/23 audit.

- writes? **Yes-adjacent** (attack/reinforce sizing). ≤3 LOC helper;
  migrate only exact `Object.values(units).reduce((n, v) => n + (+v || 0),
  0)` shapes.
- Smoke: CDP + in-game dry run of an armed wave plan.
- Est. LOW.

## L. `backoffFor(streak, ladder)` (item 2.14)

Backoff/ladder mentions: **17 in 5 files** (`core.js` 7, `collect.js` 5,
`ui.js` 2, `quests.js` 2, `journal.js` 1). The captcha ladder
(`captchaLadder()`, `core.js`) is hard-not-touch; target the
quiet-feature/retry ladders only.

- writes? Mixed. Captcha/circuit logic excluded.
- Smoke: CDP.
- Est. LOW-MED.

## M. `uwCached()` adoption audit (item 2.15)

Current `uwCached()` use: **15 sites** (`cave.js` 5, `farms.js` 4,
`build-tab.js` 3, `core.js` 3). Audit the per-tick `gameUw()` call sites
(`gameBridgeStatus`, scan loops) for conversion; `gameUw` semantics
(identity, `unsafeWindow` resolution) are hard-not-touch.

- writes? No.
- Smoke: CDP.
- Est. MED, mechanical.

## N. Wave-planner merge attack.js ↔ reinforce.js (item 2.6)

~250 LOC duplicated wave/arm/schedule logic parameterized by mission +
template. **HIGH risk — own session.** Both feed the Militar tab; hold
until attack.js + reinforce.js are validated in-game on es146 (open
question 3 in `NEXT-PLAN-2026-09-01.md`).

## Sequencing reminder

PR 2 → PR 3 → PR 4 → PR 5, one PR per session, each with `@version` bump +
build + CDP smoke + same-turn commit per the Version commit rule. Items
E–M are opportunistic and can ride along with other refactors. Item N is
gated on in-game validation.
