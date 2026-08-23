# GrepBot — Project Index

Quick map of the repo. Detail lives in `CLAUDE.md`, `AGENTS.md`, `docs/REGRESSIONS.md`, and per-module header comments.

## Snapshot

- **What:** Tampermonkey userscript that automates Grepolis (scout, farm, build, trade, culture; opt-in military). Paste-only, no server, no phone-home.
- **Version:** `5.10.4` (src + artifact in sync per `.build-stamp.json`).
- **Size:** 52 modules, ~30 000 LoC src → 1 360 KB artifact (`grepbot.user.js`), 1 043 KB prod (`--prod`).
- **ToS-breaking.** User accepts ban risk.

## Quick layout

| Path | Role |
|---|---|
| `src/` | 52 modules; concat order in `build.py` MODULES is the source of truth. |
| `build.py` | `python3 build.py` — concat + 4 gates (dup decl, `node --check`, version reminder, ASCII escape). |
| `grepbot.user.js` | Built artifact — paste this into Tampermonkey. |
| `grepbot.user.js.prod` | Pinned reference build; `--prod` writes a sibling, never overwrites. |
| `.build-stamp.json` | src SHA-256 + last built `@version`. |
| `docs/DOCS.md` | Concatenated backlog / roadmap / tasks / error-patterns. |
| `docs/REGRESSIONS.md` | Bug archaeology — read before touching a named module. |
| `docs/PLANS.md` | Numbered plans (1.x–8.x). |
| `docs/AUDIT-*.md`, `docs/COMBAT-POINTS-PLAN.md` | Point-in-time audits + combat-points plan. |
| `archive/` | Nothing needed to build/run. `grepbot.user.js.bak` is the pre-0.5.0 monolith rollback; `src-1.6.9/` is an old snapshot. |
| `data/smoke/` | Smoke driver output — ephemeral, delete when done. |
| `wiki_corpus/`, `wiki_dump.user.js` | Wiki scraping helper (separate tool, not built). |
| `.claude/skills/run-grepbot/` | Headless CDP smoke driver (`driver.mjs`) + `SKILL.md`. |
| `repos/` | Empty placeholder. |

## Build / install / smoke

```sh
python3 build.py                # gates 1/2/4 fatal; exit 1 = no artifact
python3 build.py --prod        # whitespace squeeze, writes .user.js.prod (sibling)
python3 build.py --force       # overwrite a newer artifact (after reconciling src/)

node .claude/skills/run-grepbot/driver.mjs          # headless init smoke
node .claude/skills/run-grepbot/driver.mjs repl      # CDP REPL
```

Install: paste `grepbot.user.js` into Tampermonkey (Dashboard → edit → paste, or drag file onto TM tab). **Never** start a local HTTP server for install/update.

## Module map (52)

Order = `build.py` MODULES. One IIFE, one scope — reordering breaks top-level decls.

| # | Module | Role |
|---|---|---|
| 1 | `header.js` | UserScript metadata block + `@version`. |
| 2 | `core.js` | Shared state, logging, storage, locks, paint, `gbNum`/`gbLit`/`gbPaint`/`gbWidget`. |
| 3 | `planner.js` | Affordability + cost ledger; `TX_WRITE_FEATURES` registry. |
| 4 | `tx.js` | `txRun` guard chain: dry → breaker → safe → health → dedup → planner → budget → captcha. |
| 5 | `bridge.js` | `bridgePost` / `gameAjaxPost` — every write goes through here. |
| 6 | `journal.js` | Decision memory: `state.decisions` ring 400, 7-day TTL, 10min hard-error window. |
| 7 | `spy.js` | Read-only town model probes. |
| 8 | `parse-inline.js` | Inline markup parsing helper. |
| 9 | `farms.js` | Auto-claim farms; learns option index. Toggle `autoFarm` OFF. |
| 10 | `towns.js` | Town index + scan helpers. |
| 11 | `collect.js` | Resource collection via TreeWalker. |
| 12 | `bandit.js` | Bandit camp farming; toggle `autoBandit`. |
| 13 | `build-tab.js` | Instant-buy tab UI + `ibScan`. |
| 14 | `goals.js` | Build goal planner. |
| 15 | `build-targets.js` | Build target tables. |
| 16 | `native-ui.js` | Native queue lanes (`nativeQueue*` API), single Queue Center since v5.10.0. |
| 17 | `build-auto.js` | Auto build loop; `ibFreeThresh`, no `buyInstant` fallback. |
| 18 | `cave.js` | Silver cave stash; toggle `autoCave` OFF. |
| 19 | `culture.js` | Festivals/procession/theater; toggle `autoCulture` OFF. |
| 20 | `emergency.js` | Pre-stash before hostile lands; `emergencyCaveAuto` OFF (HIGH-RISK). |
| 21 | `trade.js` | Inter-town `tradeSend`; toggle `autoTrade`. |
| 22 | `transport.js` | Read-only capacity/ETA model — returns `blind`, never fakes. |
| 23 | `dump.js` | Resource dump policy (HIGH-RISK). |
| 24 | `rural.js` | Rural village trade/unlock/upgrade. |
| 25 | `research-graph.js` | Read-only research prerequisite graph over `GameData.researches`. |
| 26 | `research.js` | Auto research; `autoResearch` toggle. |
| 27 | `alerts.js` | Optional Discord webhook (OFF). |
| 28 | `merchant.js` | Merchant purchase (OFF); needs explicit item id + price. |
| 29 | `phoenician.js` | Phoenician trader single-shot (`autoPtTrade` OFF). |
| 30 | `favor.js` | Divine favor spend (HIGH-RISK, OFF). |
| 31 | `god-spells.js` | God power casts (HIGH-RISK, OFF) — never default a power id. |
| 32 | `wonder.js` | Wonder construction; day from `gameNow()`. |
| 33 | `dodge.js` | Incoming-attack scan (5s); `dodgeMode` `'notify'` default, `'auto'` HIGH-RISK. |
| 34 | `recruit.js` | Auto recruit (HIGH-RISK, OFF); unit cost learned. |
| 35 | `qol.js` | QoL (pauses, templates, import/export, `gbWidget`). |
| 36 | `orchestrate.js` | `orchTick` 20s — sole econ scheduler; `ORCH_MAX_PER_TICK=3`, ±20% jitter. |
| 37 | `intel.js` | Threat board, dossiers, Grepodata assist. |
| 38 | `quests.js` | Quest auto-claim/build. |
| 39 | `attack.js` | Attack planner dialog; learned `attackTpl`; manual confirm only. |
| 40 | `shared-plan.js` | Shared attack plan paste-import (no fetch, no auto-send). |
| 41 | `military.js` | Military UI glue. |
| 42 | `support.js` | Support send (HIGH-RISK, OFF); own `supportTpl`. |
| 43 | `reinforce.js` | Manual reinforce arm + fire; `RF_ARM_MAX_MS` window. |
| 44 | `spy-send.js` | Manual spy (rapido/masivo); silver from cave. |
| 45 | `diagnostics.js` | 6 snapshot slots, 5min, 200 KB, **whitelisted** slices. |
| 46 | `stats.js` | Stats tab + Preflight (read-path probe, sends nothing). |
| 47 | `context-menu.js` | Sibling town-info menu (canvas map → popup is only anchor). |
| 48 | `hud.js` | Read-only HUD widgets (`gbWidget`). |
| 49 | `ui.js` | Panel shell: 4 tab groups / 9 tabs, `gbCfgGroup` blocks, `bindConfig`. |
| 50 | `boot.js` | Setup/teardown; `BOOT_TIMING` constants; repaint on `visibilitychange`/`pageshow`. |
| 51 | `footer.js` | Closes the IIFE. |

## Hard rules — quick link

Full text in `CLAUDE.md`. The cliff notes:

- **Posting:** guards block on values actually read (unreadable → `blind`); coerce with `gbNum` (never `+x`+`isFinite`); check preconditions before posting; **all writes through `bridgePost`/`gameAjaxPost`**; register new write features in `TX_WRITE_FEATURES`; timeout ≠ retry for irreversible; never guess game data; never default a divine power id; learned templates per payload.
- **Scheduling:** `orchTick` is sole econ scheduler; locks via `gbLock`/`gbUnlock`/`gbLocked` only; scrape deadlines stamped at start.
- **Rendering:** `gbPaint(host, build, {key})`; keyed rows on id-set change; `innerHTML` → `gbLit` (no `${}`), wire values → `textContent`.
- **Config:** `data-cfg` values stable; pin explicit `<option value>`.

## Don't-break invariants

| Invariant | Where | Consequence |
|---|---|---|
| `build.py` MODULES order | `build.py:31` | TDZ at boot |
| `TX_WRITE_FEATURES` complete | `planner.js` | New write skips every guard |
| Guard order in `txRun` | `tx.js` | dry→breaker→safe→health→dedup→planner→budget→captcha |
| `BOOT_TIMING` constants | `boot.js` | Naked ms literal = regression |
| Lock registry only | `core.js` | Module-local `*InFlight` bypasses TTL sweep |
| `data-cfg` stable | `ui.js` | `bindConfig` resolves by attribute |
| `<option value>` pinned | every `<select>` | Server reads value, not text |
| `innerHTML` via `gbLit`, wire via `textContent` | `core.js` | XSS |
| Repaint via `gbPaint` | `core.js` | Bare `replaceChildren` wipes focus |
| Learned templates per feature | `farms.js` etc. | `supportTpl ≠ attackTpl` |
| `state.dryRun` end-to-end | `tx.js` | Bypass = no dry-run coverage |
| `*Soon` coalescers inside sweeps | `core.js` | Bare save/render loses tail on tab exit |
| `txSave` deliberately NOT debounced | `tx.js` | Committed tx must survive crash |
| `state.decisions` ring 400, 7-day TTL | `core.js` | Bloat = memory misses |
| `ORCH_MAX_PER_TICK=3`, ±20% jitter | `orchestrate.js` | Naked numbers = regression |
| `data-cfg` rows inside 11 `gbCfgGroup` blocks | `ui.js` | Filter can't find |

## Diagnostic grep table

| Symptom | Command |
|---|---|
| Build fails gate 1 (dup decl) | `rtk grep -nE "^(function\|const\|let\|var) [A-Za-z_]" src/*.js \| sort \| uniq -d` |
| Build fails gate 2 (`node --check`) | `node --check grepbot.user.js` |
| Build fails gate 4 (ASCII) | `rtk grep -nP '[^\x00-\x7F]' src/*.js` |
| Panel won't open | log grep `hudEnsure` + `#gb-panel` exists |
| Feature posts nothing | log grep `<feature>\|skip:` |
| Lock stuck | log grep `gbLock\|gbUnlock\|gbUnlockAll` |
| Captcha ladder tripping | log grep `captcha\|gbServerCooldown` |
| Decision memory blocking | log grep `remembered\|jrnFailStreak` |
| Journal ring full | log grep `journal\|saveFlush\|decisions` |
| Storage quota near limit | log grep `quota\|storage\|prune` |
| HIGH-RISK toggle off but acted | log grep `safeMode\|HIGH-RISK` |
| `state.*` weird | Export → Diagnóstico dump, then `rtk json data/<dump>.json` |
| Version drift | `rtk git diff src/header.js \| rtk grep @version` |
| Build stale after src edit | `stat -c %Y grepbot.user.js src/header.js` |
| Decision strikes climbing | log grep `skip:planner-\|skip:tradeCap` |

## Where to look for X

- **"What does this module do?"** → top-of-file header comment in `src/<module>.js`.
- **"Why is this rule the way it is?"** → `docs/REGRESSIONS.md` (search by module/keyword).
- **"What's the roadmap?"** → `docs/DOCS.md` § ROADMAP.
- **"What's the backlog?"** → `docs/DOCS.md` § BACKLOG.
- **"What needs manual in-game validation?"** → `docs/DOCS.md` § TASKS.md.
- **"Which plan covers this?"** → `docs/PLANS.md` (1.x–8.x).
- **"What changed in past audits?"** → `docs/AUDIT-*.md`, `docs/archive-audits/`.
- **"What's the panel UI word?"** → Spanish per `CLAUDE.md` § UI language. Resource `iron` → `plata`.
- **"How do I run it?"** → `.claude/skills/run-grepbot/SKILL.md`.

## Edit protocol (one screen)

Editing any `src/*.js`? Run top-to-bottom:

1. Read module header comment (states contract).
2. Skim `docs/REGRESSIONS.md` for entries naming the module.
3. Identify which **Hard rules** apply; re-read those.
4. New write feature → register in `TX_WRITE_FEATURES` (`planner.js`).
5. New config control → `gbCfgGroup` + explicit `data-cfg` + pinned `<option value>`.
6. New user-facing string → Spanish; em dash for unreadable.
7. Behavior change → bump `@version` in `src/header.js`.
8. `python3 build.py` (gates 1/2/4 fatal).
9. Optional: `node .claude/skills/run-grepbot/driver.mjs`.
10. **Same turn** commit (`@version` bump + src delta + artifact together).