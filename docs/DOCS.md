## BACKLOG.md

# GrepBot feature backlog

Ideas for what to add or finish next. Phases 0–15 are **coded**; `TASKS.md` tracks
**in-game validation**. This file prioritizes gaps, reliability fixes, smarts, and
UX — not raw feature count.

Last reviewed: **2026-08-10** (against `src/` @ v2.9.1, every row grepped).

**Current plan of record:** [`plans/26-improvement-sweep-2026-08-10.md`](plans/26-improvement-sweep-2026-08-10.md).
The per-feature plans `01`–`25` predate v1.6; most of them shipped (see §7 below).
Do not plan off the old audit tables — see [`plans/00-reconciliation.md`](plans/00-reconciliation.md).

---

## Suggested order (from plan 26)

```text
docs drift
    ↓
farm scrape circuit breaker (A1)      ← P0: dead scrape starves the request budget
    ↓
scope-aware budget + Stats (A3 · C2)
    ↓
town action cache (A2)
    ↓
captcha ladder UI + soft-ceiling UI (B1 · B5)
    ↓
orphan flags: build plan 05 or delete (B6)
    ↓
alliance notes + sticky sort/filter (B2 · B4)
    ↓
config presets (B3)
    ↓
adaptive claim duration (C1)
    ↓
preflight coverage for post-v1.5 modules (C3)
    ↓
HIGH-RISK 8.12/8.13 only after payload sniff matches UI
```

---

## 1. Closed in the v3.0 sweep (2026-08-10, see git log v3.0.0..v3.8.0)

| Item | Plan | Shipped |
|------|------|---------|
| Farm scrape circuit breaker + Config toggle + clearer footer + Preflight | 26 §A1 | v3.0.0 (9ddefe6) |
| Scope-aware request budget (action 100% / read 85% / scrape 60%) + Stats per-scope + soft delay | 26 §A3 + §C2 | v3.1.0 (4f413be) |
| Town action cache (per-town + town-list) | 26 §A2 | v3.2.0 (e9415fc) |
| Captcha ladder UI + posts-soft-pct UI | 26 §B1 + §B5 | v3.3.0 (1b3d6ce) |
| Warehouse deadlock resolver + Config toggle + footer !WH + Stats line + Evidence | 26 §B6 (plan 05) | v3.4.0 (48310e5) |
| Alliance notes setter + Intel row | 26 §B2 (plan 03) | v3.5.0 (58699e8) |
| Sticky sort per tab + journal filter persistence (state.tabFilters wired) | 26 §B4 (plan 18) | v3.5.0 (58699e8) |
| Config presets (AFK / farming / war) with HIGH-RISK forced OFF | 26 §B3 (plan 16) | v3.6.0 (7242e82) |
| Adaptive claim duration (use the long options that already learned) | 26 §C1 | v3.7.0 (b62bcd4) |
| Preflight coverage for tx / phoenician / native queue / queue center | 26 §C3 | v3.8.0 (fa65c32) |
| Remove orphan flags state.abNextAt + state.tradeMaxHops | 26 §B6 | v3.4.0 (48310e5) |
| Fix farms.js onerror burning the ladder on budget/disabled | 26 §A1 | v3.0.0 (9ddefe6) |
| Correct stale `core.js:313` wkey claim in error-patterns.md | 26 §D | 2026-08-10 (eb43082) |
| Regenerate CLAUDE.md repo-layout + concat order from build.py MODULES | 26 §D | 2026-08-10 (eb43082) |
| Rewrite BACKLOG.md against the actual tree | 26 §D | 2026-08-10 (eb43082) |

---

## 3. Still open

| Gap | Why it matters | Risk | Plan |
|-----|----------------|------|------|
| **Farm HTTP resource scrape is dead** | 0/12 villages resolve; burns 36 of 40 budget slots per sweep and starves bridge posts | Low | 26 §A1 |
| **Town guess ladders have no learned cache** | 6-deep + 5-deep ladders re-guess every sweep | Low | 26 §A2 |
| **One budget pool for scrapes and actions** | A scraper can starve a timed post | Low | 26 §A3 |
| **Captcha backoff ladder has no UI** | `state.captchaLadder` is unreachable from the panel | Low | 19 / 26 §B1 |
| **Posts/min soft ceiling has no UI** | `postsPerMinSoftPct` works but cannot be tuned | Low | 22 / 26 §B5 |
| **Alliance notes have no setter at all** | `state.allianceNotes` is read-only in code | Low | 03 / 26 §B2 |
| **Sort/filter not persisted** | sort exists (`makeSortable`) but dies on row-set rebuild | Low | 18 / 26 §B4 |
| **Config presets** (AFK / farming / war) | one-click safe profiles | Low | 16 / 26 §B3 |
| **Warehouse deadlock resolver** | `orchDeadlockResolve` flag exists, feature does not | Med | 05 / 26 §B6 |
| **Trade presets `party` / `unit`** | shipped — kept here only as a validation gate | Med | TASKS |
| **Wonder favor cast** (ROADMAP 11.4) | WW worlds only; deferred | Med | 02 |

---

## 2. New value (plan 26 §C) — shipped in v3.0 sweep

| # | Feature | Shipped |
|---|---------|---------|
| 1 | **Adaptive claim duration** | v3.7.0 |
| 2 | **Budget visibility in Stats** | v3.1.0 |
| 3 | **Preflight for post-v1.5 modules** | v3.8.0 |

---

## 3. Dead state to wire or delete (plan 26 §B6)

`orchDeadlockResolve` is now wired (v3.4.0). `tabFilters` is now wired (v3.5.0).
`abNextAt` (`core.js:277`), `tradeMaxHops` (`core.js:357`) were removed in v3.4.0
— both were loaded into state and referenced nowhere else.
and never read anywhere. `dodgeMode` (`core.js:313`) is migration-only. Wire or
delete each; a Config-shaped boolean that does nothing is worse than neither.

---

## 4. Military / intel

| Item | Status |
|------|--------|
| Cancel/recall helper, hero transfer, harassment presets | CODED — validate per TASKS |
| Support ETA on threat board | **DONE** (`intel.js:89`) |
| Attack pattern alerts | **DONE** (`intel.js:109-111,212`) |
| Offline report catch-up | **DONE** (`spy.js:117-163`) |
| Watchlist "why" | **DONE** (`intel.js:133-193`) |
| Wonder favor cast (11.4) | DEFERRED — WW worlds only (plan 02) |

HIGH-RISK: auto-dodge (8.12), auto-recruit (8.13) — payload sniff + dry-run before enable.

---

## 5. Out of scope forever

Per ROADMAP / CLAUDE — do not implement:

- Anticaptcha solvers
- Phone-home server / auto-update XPI (`server.py`, `127.0.0.1:35657`)
- Fully unattended auto-dodge / auto-recruit without confirm gates
- Credential exfil or remote code load

Moat = reliability + intel + dry-run validation, not reckless automation.

---

## 6. Top ROI picks — for the next sweep

1. **Wonder favor cast** (plan 02) — WW-worlds only; deferred since v1.0
2. **Watchlist "why" detail in the panel** — only Export/Dump carries the match reason today
3. **Support ETA on the threat board** — already in the dump; render it on the Intel tab

---

## 7. Shipped since the last review (do not re-open)

Verified by grep at v2.9.1: trade `party`/`unit` presets (`trade.js:175-222,326`),
evidence dump (`stats.js:301`), island-aware trade (`trade.js:134,329`),
culture↔cave coordination (`ironReservedForCave` `core.js:658`, `trade.js:178-179`,
`culture.js:108`), learned-payload health (`core.js:753-812`), support ETA,
attack patterns, offline report catch-up, watchlist why (§4), storage quota
prune (`core.js:1087`), custom build queue / instant-build precision /
phoenician ratio pump (v1.6), Telegram webhooks, `webhookEvents` wiring,
`tradeReservePct` / `tradeMinBatch` Config UI, findings-filter persistence
(`ui.js:1523-1543`), posts/min soft ceiling mechanism (`core.js:721-728`).

Plans `01`, `04`, `07`–`15`, `20`, `23`–`25` are therefore closed. Plans `02`,
`03`, `05`, `16`, `18`, `19`, `22` remain open and are folded into plan 26.

## 8. Future sweep (plan 27)

[Plan 27](plans/27-v4-wishlist-2026-08-10.md) catalogues ~50 features
from a single user intake. It is **not** the next plan of record — once
plan 26 ships + TASKS gates pass, the v4 candidates split into 4–5
narrower per-risk-bucket plans (per plan 27 §10 + §12).

Out-of-scope items dropped there (anti-detection, REST/WebSocket, plugin
system, auto-recovery, etc.) are catalogued in plan 27 §0 and stay out
per `CLAUDE.md` policy.

---

## Related docs

- `plans/26-improvement-sweep-2026-08-10.md` — **current** plan of record
- `plans/README.md` — per-feature implementation plans (01–25, mostly closed)
- `ROADMAP.md` — phase plan and competitor parity table
- `TASKS.md` — in-game validation checklist (current gate order)
- `archive-audits/` — historical audits (CLOSED / stale; do not re-implement from them)
- `CLAUDE.md` — architecture and regression notes

---

## ROADMAP.md

# Project roadmap

Context: Phases 1–7 shipped in v0.6.0. Phase 8.1 (auto-cave) coded in v0.7.0.
**v1.0.0** encodes the Ultimate GrepBot path: Phase 0 foundation gate, Phase 8
packages 8.2–8.13, and Phases 9–14 (orchestration, military, gods, alliance,
intel moat, hardening). High-risk loops default OFF.

Do not start a later package’s *in-game validation* until the previous package’s
exit criteria pass. Coding may land ahead of validation; TASKS.md tracks gates.

## Phase 0: Foundation repair — CODED (v1.0.0)

### Outcome

Script boots, bridge posts match live Grepolis, multi-world state does not leak,
in-flight locks cannot stick forever.

### Packages

- **0.1 Boot P0:** `scrapeInboxDom`, `diagRun`, `updateStatus`, `refreshFarmsParsed`,
  `renderTimers` defined and called from boot/ui/farms/spy.
- **0.2 Bridge contracts:** `gameUw()` never falls back to sandboxed `window`;
  `bridgePost` timeout + try/catch; hardened `responseIsCaptcha`; `gameAjaxPost`
  for non-bridge controllers; sniff-driven `sendUnits` / `completeInstant`.
- **0.3 Host isolation:** CSRF, claim/attack/collect templates, farmAction,
  captcha breakers keyed by `wkey()` / hostname.
- **0.4 In-flight recovery:** timeouts clear locks; `beforeunload` resets
  claim/ib/ab/cave/culture/trade/… flags; reinject dispose registry.

### Exit criteria

Fresh paste — panel boots, Diag works, one farm claim + free instant, no
ReferenceErrors. Manual checklist in TASKS.md.

---

## Phases 1–7 — DONE (v0.6.0)

See git history / prior ROADMAP revisions. Summary: Config tab, captcha breakers,
findings filter, attack planner confirm-send, multi-world, module concat,
paste-only (no test harness).

---

## Phase 8: Competitor feature parity

### Outcome

GrepBot covers high-value loops advertised by ModernBot, GrepoHelper, Grepobot,
GFBot, Noct, GrepoPlus — bridge-first, paste-only.

| Pkg | Feature | Status | Risk |
|---|---|---|---|
| 8.1 | Auto-cave | CODED v0.7.0+ | Low |
| 8.2 | Auto-culture | CODED v1.0.0 (`culture.js`) | Low–med |
| 8.3 | Inter-city trade | CODED (`trade.js`) | Med |
| 8.4 | Rural village trade | CODED (`rural.js`) | Med |
| 8.5 | Farm village upgrade | CODED (`rural.js`) | Med |
| 8.6 | Academy research | CODED (`research.js`) | Med |
| 8.7 | Pause-on-activity, templates, overview | CODED (`qol.js`) | Low |
| 8.8 | Discord/Telegram webhooks | CODED (`alerts.js`) | Low |
| 8.9 | Phoenician merchant sniper | CODED (`merchant.js`) | Med spend |
| 8.10 | Favor farm (godsent) | CODED (`favor.js`) | **High** |
| 8.11 | WW donations | CODED (`wonder.js`) | Med |
| 8.12 | Incoming dodge (notify→auto) | CODED (`dodge.js`) | **Highest** |
| 8.13 | Auto-recruit (barracks path) | CODED (`recruit.js`) | **Highest** |

### Phase 8 exit (whole)

- 8.1–8.7 manually validated on live world.
- 8.8–8.11 shipped default-OFF where spendy.
- 8.12–8.13 behind HIGH-RISK toggles + CLAUDE.md docs.

---

## Phase 9: Economy orchestration — CODED (v1.0.0)

- **9.1** Priority manager (`orchestrate.js`) — round-robin feature budget.
- **9.2** Town groups + city templates (`qol.js`).
- **9.3** Mainland→island res ship (`trade.js` + `islandShip` toggle).
- **9.4** Night pause + activity pause (`core.js` / Config).

### Exit

Multi-town overnight econ without warehouse deadlock; Overview shows module health.

---

## Phase 10: Military precision — CODED (partial v1.0.0)

- **10.1** Timed attack/support — existing Attack tab (confirm / arm).
- **10.2** CS detect + alerts — `dodge.js` + webhook.
- **10.3** Defense pull — `military.js` `militaryDefensePull`.
- **10.4** Harassment presets — Attack tab chips (1/5 sling, light ≤8); confirm-send only.
- **10.5** Cancel/recall — list cancelable outgoing `MovementsUnits`; confirm → `Command/cancelCommand` (sniff `cancelTpl`, overview/command_info fallback).
- **10.6** Dodge v2 — notify vs auto + defense floor.

### Exit

Notify-mode CS alert verified; auto-dodge only after risk acceptance.

---

## Phase 11: Gods, spells, heroes — CODED (partial v1.0.0)

- **11.1** Recruit spell cast before train (`recruit.js` + `recruitSpells`).
- **11.2** Hero transfer — Attack tab: assign / unassign / cancel travel via `PlayerHero` bridge (confirm; sniff `heroTpl`).
- **11.3** Mythic favor loops (`favor.js`).
- **11.4** Wonder favor cast — deferred (tie to wonder worlds).

---

## Phase 12: Alliance / WW / Olympus — CODED (partial v1.0.0)

- **12.1** WW sends (`wonder.js`) with daily budget.
- **12.2** Olympus portal mission option in Attack tab.
- **12.3** Config import/export JSON (local alliance notes via `qolExportConfig`).
- **12.4** Player notes on Intel tab.

---

## Phase 13: GrepBot intel moat — CODED (v1.0.0)

- **13.1–13.2** Findings + dossiers (`intel.js`).
- **13.3** Incoming threat board.
- **13.4** Optional Grepodata Index+ assist.
- **13.5** Watchlist scan + webhook.

---

## Phase 15: Reliability + observability — CODED (v1.4.0)

- **15.1** Dry run (`state.dryRun`) — payload logged, nothing sent; validation
  path for every remaining HIGH-RISK gate.
- **15.2** Lock registry with TTL + sweeper (`gbLock`) replacing 16 `*InFlight`
  booleans; `pagehide` covers bfcache exits.
- **15.3** Orchestrator: per-tick budget, anti-starvation tie break, cadence
  jitter, journal-driven adaptive backoff for idle features.
- **15.4** Stats tab (journal rollups, scheduler state, budget, locks) +
  read-only Preflight probe of every module.
- **15.5** Global server-pressure cooldown shared by bridge + scrape transports.
- **15.6** Keyed-row rendering for farms / world / attack schedule.
- **15.7** Shared `townResState` capacity reader; export redaction toggle;
  build gates (duplicate decls, `node --check`, version reminder).

### Exit

Preflight all-pass on the live world; a full dry-run pass over 8.9-8.13 payloads
before any of them is enabled for real.

---

## Phase 14: Hardening — CODED (v1.0.0)

- **14.1** Global captcha kill-switch.
- **14.2** Request budget / min.
- **14.3** Config import/export + `configVer`.
- **14.4** Module health on Overview.
- **14.5** Docs (this file + TASKS + CLAUDE).

**Out of scope forever:** anticaptcha solvers, credential exfil, reintroduced
`server.py` / XPI phone-home.

---

## Execution order (validation)

1. Phase 0 smoke (boot + claim + instant)
2. Validate 8.1 cave
3. 8.2 → 8.7 econ + QoL
4. 8.8 webhooks
5. 9.x overnight orch
6. 8.9–8.11 spendy
7. 10.x notify military
8. 8.12 notify → 8.13 recruit → 8.12 auto
9. 11–13 as needed
10. 14 continuous

## Definition of “best ever”

- Competitor module coverage (table above) with GrepBot reliability bars
- Multi-town overnight econ without stuck locks / captcha-blind posting
- Military: timed confirm-send + CS alerts; auto-dodge/recruit gated
- Intel threat board + dossiers
- Install &lt;2 min: `python3 build.py` → Tampermonkey paste
- No server dependency

---

## TASKS.md

# Project tasks

Evidence for any gate: Actions/Log → **Evidence** (plus Diag). Paste the JSON;
do not describe state by hand. Evidence is read-only and redacts CSRF/templates.

## Current phase

- [ ] **v3.x gates** (plan `docs/plans/26-improvement-sweep-2026-08-10.md`)
  - Farm scrape breaker: with the endpoint unlearned, the Log shows
    `farm scrape: endpoint dead after 2 sweeps - disabling` once and then no
    further `farm <id>: no data` lines; footer reads `farms: scrape off`;
    Stats budget stays well under the ceiling across a farm cadence
  - Scope budget: with the scrape ON and 12 villages, a hand-triggered farm
    claim fired during a sweep still posts — no `skip:budget` in Decisions.
    Stats shows `peticiones` split into scrape / read / accion
  - Town action cache: Log shows `towns endpoint = <action>` once, and later
    sweeps issue one request per town instead of up to six
  - Captcha ladder + soft ceiling: edit both in Config, reload, values persist;
    Stats shows the soft delay moving when the ceiling is lowered
  - Deadlock resolver: with a full warehouse and farm paused, Log shows
    `orch: deadlock in town <id> - forcing cave/trade/rural` and the forced
    feature runs before farm
  - Adaptive claim duration: teach a 20min option by hand → Log
    `farm: learned claim option n = 20min`; a town with headroom claims 20min,
    a near-full town stays at 5min
  - Preflight: new rows (`farm resource scrape`, `native queue`, `queue center`,
    `phoenician`, `tx registry`) all report

- [ ] **v2.9.x gates**
  - Academy queue (see the 8.6 block below) end to end on a Curator account
  - Queue Center: `Colas` opens, all four tabs render the real queue beside the
    virtual plan, reorder / pause / remove work through `nativeQueue*`
  - Artifact stays pure ASCII: the panel shows `Economía` / `Construcción`
    correctly after a TM paste install (no `EconomÃ­a`)

- [ ] **v1.6 gates** (dry-run first)
  - Custom queue: three entries in one town → `DRY-RUN build … buildUp` fires in
    list order; entries vanish as their orders queue; strict ON waits on an
    unaffordable head entry instead of skipping it
  - Instant build: Preflight shows `order queues readable N/M towns` with N=M;
    a build in a **non-current** town completes free, and the post lands with
    4:50-5:00 remaining (Log `instant: armed in …` precedes it)
  - Merchant ship: open the window once (view URL learned) → **Copy offer HTML**
    → confirm the parser; one hand trade teaches `ptTradeTpl`; dry run shows
    5 × amount-1 posts then one bulk post; refuses everything before the
    template exists, and aborts when the ratio does not move

- [ ] **v1.5.3 audit gates** (dry-run first; no npm harness)
  - Host OFF 10min → zero bot-originated requests/clicks
  - Instant: price>0 or >5min left → zero posts; free+gold0 → one post; timeout → no buyInstant
  - Olympic without `allowPremiumCulture` / budget<50 → zero posts
  - Quest mixed safe+unsafe rewards → not claimed; timeout → no DOM click
  - Incoming support → no dodge/militia/dispatch
  - Merchant/wonder timeout → no second post
  - Bireme recruit → docks controller; unknown cost → no post
  - Attack village id → blocked (not Town/sendUnits); overdue after suspend → no fire
  - Favor without temple_plunder → no send

- [ ] **v1.4.0 gates** — run these first; they make every gate below cheaper
  - Stats tab: switch 1h/24h/7d, rows appear after the bot has acted once
  - **Preflight** (Stats tab or Actions menu): every line reports; `bridge`,
    `towns`, `farm claims` must pass on a logged-in world. Fix what it flags
    (unlearned `claimTpl` / `attackTpl` / sleep option) before the 8.x gates
  - **Dry run ON** (Config): trigger each risky feature and compare the logged
    `DRY-RUN <feature>: {…}` payload against the body of the same action clicked
    by hand (XHR spy logs both). Only then turn dry run OFF for that feature
  - Locks: no feature stays stuck after a soft nav or a tab restore; Log shows
    `lock: <name> expired after Ns` at most rarely, never repeatedly
  - Orchestrator: with 4+ econ features ON, Stats `scheduler` shows all of them
    getting turns; none sits at `next 0s` forever
  - Adaptive cadence: a feature with nothing to do (e.g. cave under threshold)
    logs `orch: cave idle 4x - widening cadence` and its Stats cadence grows
  - Server bus: on a 429/503 the footer shows `⏸srv:<time>` and posts stop
  - Export: Copy/Export redact names by default; toggling redaction OFF logs
    `export: redaction OFF`

- [ ] **Phase 0 smoke** — manual in-game after paste `grepbot.user.js` ≥ v1.0.0
  - Panel boots; Diag prints bridge status; no ReferenceErrors in Log
  - One farm claim + one free instant complete
  - Captcha breaker + global kill still pause posts

- [ ] **Instant research** (v1.3.0 / hardened v1.5.3) — in-game validation
  - Config `Instant free research (academy)` default OFF; start an academy
    research, wait until ≤5min left **and** free price 0 → Log `instant-research: … OK`
  - Timeout / unknown must NOT learn or post `buyInstant`; Build tab lists FREE only when gold===0
  - Build tab lists the research row as `res:<tech>` FREE

- [ ] **Claim timers 5/10min** (v1.3.0) — in-game validation
  - Config shows `learned claim options: 5min=1`; claim a 10min booty by hand
    in a farming village → Log `farm: learned claim option <n> = 10min`
  - Town with villager-loyalty research claims 10min, town without stays 5min
  - Loyalty tech auto-detect logs the matched key; wrong key can be pinned in
    Config (`Loyalty tech key`)

- [ ] **Sleep claim 4h/8h** (v1.3.0) — in-game validation
  - Teach the 4h and 8h options by hand once; Farms tab status turns grey
  - `Sleep claim (4h/8h)` button claims every ready village with the long timer
  - Auto mode: fires once per day only when the haul ends before 24:00 and every
    owning town is under the fill %; held runs log `sleep claim held: town …`

- [ ] **Phase 8.1** Auto-cave — in-game validation (coded since v0.7.0)
  - Config Auto-cave OFF by default; toggle persists
  - Iron ≥ thresh% → `cave: town <id> stored <n> iron`; cave storage up
  - Finite full → skip; max-level hide still stashes; per-town OFF skips

- [ ] **Decision memory** (v1.1.0) — in-game validation
  - Log tab → Decisions fills as farm/build loops run; survives F5
  - A repeatedly failing action gets `memory: … failed 3x … skipping 5m`,
    footer shows `mem:1`, next attempt logs `skipped from memory`
  - Success on that target clears the window; Clear skips works
  - Config toggle OFF stops skipping but records keep appearing

## Next (validation order)

- [ ] **8.2** Auto-culture — festival starts via bridge without culture window
- [ ] **8.3** Inter-city trade — two towns, surplus → needy
- [ ] **8.4** Rural trade — warehouse full → trade instead of silent skip
- [ ] **8.5** Rural level — one unlock/upgrade with spare BP
- [ ] **8.6** Research — one tech enters academy queue
  - v2.9.0 rewrote the whole path (see `docs/plan-academy-queue.md`). Validate in
    this order, Dry run ON first:
  - Stats → Preflight → **academy read path** row: no `UNREADABLE` field. A
    `real queue UNREADABLE` there means only the open town can be researched.
  - Open the Academy: `[[+]]` controls on the tech tiles and a
    `Cola GrepBot · Investigación` panel. If neither appears, the Log carries
    `academy root matched N research node(s) but resolved 0 techs` (or
    `its town id is unreadable`) — paste the step-0 console snippet from the plan.
  - Dry run ON, queue one tech: Log shows
    `DRY-RUN research: {"model_url":"ResearchOrder","action_name":"research","arguments":{"id":"<tech>"},"town_id":<id>}`.
    `town_id` must be the queued town, **not** the open one.
  - Dry run OFF: the tech lands in the real academy queue and the virtual job
    clears; a Curator account must accept more than 2 queued.
- [ ] **8.7** Activity pause + template apply + Overview numbers
- [ ] **8.8** Webhook — captcha trip → one Discord POST
- [ ] **9.1–9.4** Orch overnight + island ship + night pause
- [ ] **8.9–8.11** Merchant / favor / WW (default OFF)
- [ ] **10.4 / 10.5 / 11.2** Harassment + cancel + hero (v1.5.9)
  - Attack tab harass chips → Preview shows small stack; Send now still confirms
  - Outgoing list shows cancelable movements; Cancel asks confirm; Log `cancel: command … OK`
  - Heroes list Assign/Unassign/Cancel travel with confirm; dry-run logs `DRY-RUN hero:`
  - Hand-cancel once → Preflight `cancel` shows template learned; hand hero assign → `heroTpl`
- [ ] **10.x / 8.12 notify** CS alert + threat board
- [ ] **8.13** Recruit one unit on curator town (payload match UI)
- [ ] **8.12 auto** Dodge only on throwaway / accepted risk
- [ ] **13.x** Intel dossiers + Grepodata assist
- [ ] **14.x** Confirm global kill + budget + config import/export

- [x] Phases 1–7 (v0.6.0)
- [x] v0.6.7 warehouse-full farm gate + auto-queue builds
- [x] Phase 8.1 auto-cave coded (v0.7.0)
- [x] Phase 0 foundation (boot symbols, bridge, host scope, timeouts) — v1.0.0
- [x] Phase 8.2–8.13 modules coded (`culture`…`recruit`) — v1.0.0
- [x] Phases 9–14 spine coded (orch, military helpers, intel, harden) — v1.0.0
- [x] ROADMAP / TASKS / CLAUDE updated for Ultimate path

- [ ] **8.14** Village auto-recruit when saturated (v3.9.0) — coded, validate:
  - Open a farming village, click `Aceptar` once by hand on any unit slot → Log
    tab must show `learned accept-units template:` with `model_url` and `action_name`.
  - Actions → Preflight → `village recruit` row shows `tpl <action_name>` (no
    UNLEARNED warning), `units S/A/H/Sl`, `fill read OK (cap N)`.
  - Enable `state.dryRun` in console, enable `village-recruit` in Config, fill
    a village's warehouse to ≥ configured `village-recruit-fill` over two
    consecutive scrapes → Log tab shows `DRY-RUN villageRecruit:` with the
    expected payload.
  - Turn dry-run OFF, observe ONE live post → Stats tab increments the
    `villageRecruit` feature with an `ok` entry; the picked unit matches the
    pair heuristic (test the 13/130/50/50 example → sword).
  - Trigger a captcha on this path → `captchaPaused('villageRecruit')` is set
    and farm claims keep running (independent captcha key).
  - Force 3 hard errors (e.g. tampered `acceptUnitsTpl.arguments`) → decision
    memory opens a 5min skip window and the scan stops posting until expiry.

## Notes

- In-game validation cannot be completed by the agent; checkboxes above stay
  open until a live session on the user’s world confirms exit criteria.
- HIGH-RISK toggles (favor, dodge auto, recruit) must stay OFF until sniffed
  payloads match a genuine UI action on that world.

---

## error-patterns.md

# Recurring error patterns

Verified 2026-08-07 against `src/` @ `@version 1.5.10`.
Originally generated from parallel scans; line citations and several
claims were stale or wrong. This pass re-checked every bullet against
current sources — drop or reframe anything that no longer matches.

Patterns grouped by anti-pattern. Severity = potential impact radius.
Line refs are `file:line` under `src/` (or `build.py` at repo root).

---

## 1. Empty `catch (_) {}` swallows real errors — HIGH

Exception swallowed, never logged, never surfaced to `gbLog`. Breaks
in-game triage because the panel log ring never sees it. (~192 empty
catches repo-wide; most are probe paths. Examples below are the ones
that hide *feature* failures.)

- `orchestrate.js:50-61` — every `ORCH_HANDLERS` entry wrapped in empty catch
- `boot.js:101-106` — teardown swallows `ReferenceError` if a helper is missing
- `qol.js:44` — `try{renderAbQueue&&renderAbQueue()}catch(_){}` swallows every render error
- `military.js:49` — bare catch around defense-pull model walk
- `military.js:129` / `136` / `140` / `189` — cancel/outgoing model walks swallow
  the same way (collection / per-movement attribute failures disappear)
- `recruit.js:159` — `resources()` / cost math catch → `continue` (unread stock looks like "can't afford")
- `bandit.js:238-240` — `try`/`finally` with no catch: throw escapes after `banditScheduleNext()`

Rule: every catch that can hide a feature failure must `gbLog(...)` or
re-throw. Probe-only catches (`gbProbeNum`, building getters) may stay quiet.

---

## 2. Call-site pause gate incomplete — MEDIUM

`bridgePost` / `gameAjaxPost` already call `automationPaused` + captcha
(core.js). A caller that skips the same check still won't post while
paused, but it can flash / build payload / burn UI work before the
central bail. DOM paths that bypass those two helpers are the real gap.

- `attack.js:327-329` — `sendAttackViaBridge` checks `hostEnabled` +
  `captchaPaused('attack')` but not `automationPaused` (relies on
  `bridgePost`); contrast `military.js:9` which checks all three
- `bandit.js:224-234` — DOM `atkBtn.click()` only re-checks pause inside
  the delayed callback; no `bridgePost` gate

Rule: every bridge *caller* should mirror `automationPaused({})` early
for UX; any path that posts without `bridgePost`/`gameAjaxPost` must
gate captcha + pause + budget itself.

---

## 3. Bridge ack treated as success — no reconcile — HIGH

Server 200 OK does not prove the post landed in game state. Missing
re-read of model / relations / order collection means a silently rejected
action looks identical to a successful one.

- `attack.js:366-370` — attack send: flash "sent" on callback with no movement re-read
- `military.js:60-62` — support send counts `!err` as done; no reconcile
- `recruit.js:180-183` — build success from ajax ack only (order collection not re-read)
- `farms.js:542` — `verifyClaims` uses strict `!==` on `lootable_at` (same-value re-stamp misses)
- `towns.js:160-167` — every town re-written from game data every scrape (no freshness / dirty check)

Rule: any irreversible post must re-read the model inside the bridge
callback, not infer success from `ok:true`.

---

## 4. Blind probe mishandling (CLAUDE.md regression) — HIGH

A renamed/missing getter must yield `blind`, never a fabricated `0` /
`false`. Both directions are wrong: silently parking a feature (block)
is worse than no guard; treating unread as "empty/absent" and acting
(act) posts on bad premises.

- `favor.js:62` — favor balance `+(…|| 0)`: unread → 0 → below thresh → proceeds to post
- `recruit.js:32` — `recruitHasSpell` `catch → false` → treats unread as "not cast" → re-cast
- `recruit.js:159` — cost/stock catch → `continue` (blocks on unread)
- `build-tab.js:500` — `abCanAfford` `resources()` catch → `false` (unread = can't afford)
- `build-tab.js:512` — `res.wood >= need.wood+margin` with missing fields → `false`
- `trade.js:122` — `keep = (src.cap||0)*reservePct` — cap unreadable → keep=0 → drain source

Rule: probe miss → return `{blind:true}`, log once via `gbLogT`, defer to server.

---

## 5. Timeout treated as transient → retry on irreversible action — HIGH

A support send / wonder donation / dodge that times out may have
landed. Retrying duplicates the action.

- `dodge.js:205-210` — any send `err` (including `timeout`) schedules retry backoff
- `wonder.js:117-128` — alternate `factions` controller after "unknown controller"
  on the first `wonders` post (timeout path at 99-102 correctly does **not**
  retry; the unknown-controller fallback still can double-donate)

Rule: timeouts on irreversible paths must reconcile only, never retry.
Unknown-controller fallbacks need the same discipline. CLAUDE.md
`v1.5.3 audit` regression note.

---

## 6. DOM/selector interpolation with game-sourced ids — HIGH

`querySelector` with interpolated untrusted id throws on quote chars
(kills render) or opens injection paths. `innerHTML` interpolation of
town names / player names is the same shape.

- `ui.js:112` — `tbody.querySelector(\`tr[data-key="${key}"]\`)` (farm vill_id)
- `ui.js:193` — same with town `t.id`
- `attack.js:398` — `querySelector('[data-town="' + r.townId + '"] …')`
- `attack.js:586` — `` querySelector(`div[data-town="${r.townId}"]`) ``
- `intel.js:58-84` — builds a string named `html` then assigns via
  `textContent` (safe today; one `innerHTML` edit away from XSS)
- `ui.js:477-478` — `panel.innerHTML` interpolates `runningVersion()` (owned string; fragile pattern)
- `alerts.js:32-33` — webhook body embeds `location.host` + raw `JSON.stringify(payload)`

Rule: every selector must `CSS.escape(key)` (or build via DOM APIs). Prefer
`textContent` / `createElement` over `innerHTML` for anything game-sourced.

---

## 7. Diag / Export dumps leak raw tokens, ids, names — HIGH

`Diag`, `Export config`, footer status, clipboard write — several paths
bypass `redactFindingsExport`. CSRF clipped to first 6 chars still
identifies the session.

- `stats.js:33` — preflight csrf detail: first 6 chars of token
- `ui.js:815-816` — Log → Decisions → Copy JSON: raw `state.decisions` + `decisionSkips`
- `ui.js:836-838` — Export config: `qolExportConfig()` includes `playerNotes` / `watchlist` verbatim
- `ui.js:1522-1542` — redaction keeps last 4 id digits + first letter of name + exact x/y
- `ui.js:1551` — footer status prints first 6 chars of CSRF
- `ui.js:1570` — `el.title` JSON carries `captchaBreakers` + memory skip keys
- `ui.js:1621-1631` — Diag lists every village id/name + every town id
- `ui.js:1660-1663` — unredacted diag report to console (+ clipboard)
- `alerts.js:32-33` — webhook body JSON omits redaction
- `intel.js:129` — webhook gets raw finding (attacker/defender names, ids, coords)
- `qol.js:160-166` — `qolImportConfig` type-checks envelope only; values written unvalidated

Rule: every dump must pass through `redactFindingsExport` (or equivalent)
and clamp CSRF to `<redacted>`.

---

## 8. Render thrash — full repaint instead of keyed patch — MEDIUM

CLAUDE.md `v1.4.0 render` regression rule: compare membership, not order.
`Set`-vs-array length and blind `replaceChildren()` violate this.

- `ui.js:105` — `have.size === wanted.length` (Set vs array — dupes tear down every repaint)
- `ui.js:178` — same shape, World table
- `build-tab.js:680` — `box.replaceChildren()` rebuilds queue rows + listeners every call
- `build-tab.js:320` — `renderBuild` tail-calls `renderAbQueue` on 10s cadence
- `qol.js:118-122` — `renderOverview` has `sec.hidden` but no `_last` / membership guard
- `ui.js:1419` — `renderFindings` `replaceChildren()` + up to 80-row rebuild per filter keystroke
- `ui.js:296-310` — `paintNav` `replaceChildren()` + rebinds buttons on tab switch
- `ui.js:21` — sort re-appends every `tr` individually (N reflows)

Rule: keyed-row patch (`tr[data-key]`) + `_last` shadow state. See
`renderFarms` / `renderAttack` for the canonical pattern.

---

## 9. Render runs while tab is hidden — MEDIUM

`sec.hidden` guard present in `renderBuild` / `renderStats` /
`renderIntel` / `renderOverview` / `renderAttack` but missing on the
three high-frequency tables.

- `ui.js:91` — `renderFarms` no `sec.hidden` guard
- `ui.js:143` — `renderWorld` no `sec.hidden` guard
- `ui.js:1405` — `renderFindings` no `sec.hidden` guard
- `build-tab.js:766` — `checkThresholds` calls `renderFarms()` even when Farms tab hidden

Rule: every `render*` must start with `if (sec && sec.hidden) return`.

---

## 10. No lock (`gbLock`) on bridge-triggering path — MEDIUM

CLAUDE.md `v1.4.0 lock registry` regression note: never reintroduce
per-module `*InFlight` boolean. Re-entry possible.

- `bandit.js:104-144` — attack post uses `banditAttackSentAt` only (no `gbLock('bandit')`)
- `build-tab.js:246-249` — ib watchdog `unlock()` via raw `clearTimeout`; next() chain not aborted
- `build-tab.js:639-642` — `abScan` watchdog identical race

Note: `boot.js` `gbInterval` callbacks (`farmTick`, `questScanTick`,
`dodgeScan`, `orchTick`) are schedulers — features they call are expected
to take their own locks. Not a missing-lock bug by itself.

Rule: every feature path that posts must `gbLock(name)` + TTL entry in
`GB_LOCK_TTL`.

---

## 11. `gbTimerBag` leak / raw `clearTimeout` — MEDIUM

Bypassing the timer registry grows an entry per run; eventually the
bag dominates memory and timeouts can't be cancelled on dispose.

- `build-tab.js:249` — `clearTimeout(watchdog)` bypasses bag removal (watchdog was `gbTimeout`)
- `build-tab.js:642` — same, `abScan` watchdog
- `ui.js:1288` — `farmsInputTimer` cleared with raw `clearTimeout` (created via `gbTimeout`)
- `bandit.js:245` — `banditClearLoop` raw `clearTimeout(banditLoopTimer)`
- `attack.js:380` — armed timers cleared with raw `clearTimeout`

Rule: `gbTimeout` / a bag-aware clear exclusively; never raw
`clearTimeout` on ids that came from `gbTimeout`.

---

## 12. Defense / target-type filter bypassed — MEDIUM

Hostile-only canonical types; town-only attack targets. Bypassing
either opens wrong-target posts.

- `military.js:60` — synthesizes `{town_id, kind:'town'}` without `resolveTarget`
- `favor.js:73-122` — `targetType` defaults to `farm_town`, then posts Town
  `sendUnits` with that id (bypasses `attackSendAllowed`, which refuses farm_town)
- `dodge.js:70-71` — own-origin filter; later `!a.incoming` check is mostly unreachable
  after the `is_attack` short-circuit
- `recruit.js:17-18` — unconditional `building_barracks` fallback for land units
  missing god/myth/naval flags (intentional default, but wrong for odd clients)

Rule: route every attack/support/dodge through `resolveTarget` or an
explicit type guard (`is_attack`, `kind:'town'`, controller name).

---

## 13. PRECONDITION gaps on bridge posts — MEDIUM

Cost / capacity / queue / building level not read before posting.
Burns a request budget slot on a guaranteed rejection.

- `recruit.js:34-39` — `recruitCastSpell` no favor balance / favor-cost read
- `recruit.js:117` — `orders >= 7` treats global collection length as per-queue limit
- `recruit.js:161` — amount hardcoded cap 50, no config
- `favor.js:106` — no boat/island check for myth stack before send
- `favor.js:118-124` — never verifies target still plunderable (temple / not-already-plundered)
- `favor.js:133` — fabricates `'f'+Date.now()` movement id when response omits one
- `dodge.js:89-95` — `dodgeSafeTown` no island/distance preference
- `dodge.js:130-137` — no island/boat check on off-island land dodge
- `dodge.js:139-154` — `dodgeTownUnits` strips only militia (naval ships can be dodged out)
- `wonder.js:55-56` — only `tradeCap` checked; free freighter count never read
- `military.js:28-30` — defense-pull sends every sword/archer/hoplite/rider/chariot
- `military.js:33-38` — off-island branch adds transporters before `boatCapacityCheck` (order OK;
  still dumps full defensive stack)
- `attack.js:102` — magic `dist*50/speed` + `runtimeSetupTime` (no GameDataUnits source)
- `attack.js:132` — `boatCapacityCheck` returns `ok:true` for naval-only regardless of boats
- `attack.js:309-314` + `432-437` — missing `arrivalUnix` leaves `sendAt=null`; arm path
  `else` branch uses `idx * staggerMs` (near-immediate fire under `arrive_at`)
- `attack.js:348-351` — template arg copy keeps only `string|boolean`; numeric learned args dropped
- `attack.js:495` — blocking `confirm()` inside send-now loop setup
- `attack.js:526` — blocking `prompt()` in `editThreshold`

Rule: use `gbProbeNum` / `gbTownModel` / `gbAfford` / `gbTownPop` /
`gbPlayerGold` from `core.js` before any post.

---

## 14. `console.*` bypasses `gbLog` ring buffer — MEDIUM

Bypasses panel Log tab; persists after teardown; pollutes browser
console with bot internals.

- `core.js:742` — `console.warn('[grepbot] save fail', key, e)` (GM_setValue throw)
- `towns.js:52` — `console.info('[grepbot] towns:…')` every successful list fetch
- `ui.js:1661-1663` — diag `console.groupCollapsed` / `log` / `groupEnd`

Note: `gbLog` itself uses `console.info` by design (`core.js:546`).

Rule: feature code uses `gbLog` / `gbLogT` only; raw `console.*` only
inside the user-triggered diag dump.

---

## 15. Magic constants / falsy-fallback traps — MEDIUM

`|| default` swallows legitimate `0` / `''` / cleared values. Hardcoded
numbers ignore user settings.

- `research.js:177` — `queueMax = 2` hardcoded (no `researchQueueMax` setting)
- `build-tab.js:8` — `state.ibFreeThresh || 300` (0 / NaN → 300)
- `ui.js:1110` — `saveNum` passes `+e.target.value` with no NaN guard
- `ui.js:1233` — `telegramChatId || undefined` drops cleared value
- `ui.js:978-989` — `configBound` re-sync path only refreshes a subset of controls; rest keep stale DOM
- `core.js:322-324` — `ibAction` / `farmOptionMap` `|| '<default>'` falsy-string reset
- ~~`core.js:313` — `STORE.FARM_ACTION` legacy `wkey` fallback~~ **CORRECTED 2026-08-10**:
  no fallback exists. `farmAction` loads plainly (`core.js:233`) and
  `STORE.FARM_ACTION` **is** in `WORLD_SCOPED_BASES` (`header.js:189`), so
  `load`/`save` apply `wkey()` themselves; the explicit `wkey()` in
  `learnFarmAction` (`farms.js:624`) is belt-and-braces. `core.js:313` is
  `dodgeMode`
- `core.js:459` — `SERVER_PRESSURE_RE` includes `"slow down"` (broad; false-trips possible)

Rule: explicit nullish check `?? default`, never `|| default` for numeric /
boolean settings; honor user-cleared values.

---

## 16. Listener / timer / URL lifecycle leaks — MEDIUM

Bind-once, never unbound. Handlers accumulate on reused XHR; blob
URLs never revoked; document listeners stay across panel rebuilds.

- `spy.js:13-15` — `if (uw.fetch._grepbot) { /* re-bind comment only */ }` — no-op branch
- `spy.js:57` — new `load` listener attached on every `send()` (handler accumulation)
- `spy.js:99` — bare `id` keys queued as report ids when URL is reportish
- `spy.js:129-131` — `queueReportList()` takes no params; callers pass a hint URL that is discarded
- `ui.js:908-918` — findings Copy uses clipboard only (OK); Export blob paths if added need revoke
- `ui.js:1296-1327` — drag + resize bind `document` mousemove/mouseup for session
- `qol.js:6-7` — `document` mousemove (activity pause) unthrottled
- `ui.js:897-903` — `#gb-ab-now` forces `abAuto=true` and leaves it on (comment acknowledges)

Rule: every `addEventListener` needs an off-switch (`gbListen`); blob URLs
revoked in cleanup; reused XHR rebuilds handlers per `open()`, not `send()`.

---

## 17. Hot-path O(n) scan inside per-tick loop — LOW

Cheap at current data sizes; ceiling for 1k+ decisions or 100+ towns.

- `orchestrate.js:84-93` — `orchJrnCount` walks entire decisions list (sampled per feature)
- `ui.js:21` — sort re-appends every `tr` (use `DocumentFragment`)
- `ui.js:57` — `makeSortable` rebinds on `placeholder()` teardown
- `ui.js:1422-1426` — findings filter + `slice(0,80)` rescans per keystroke
- `stats.js:202-223` — journal rollup walk + per-feature loop per Stats repaint
- `stats.js:236` — `orchStatus()` once per render (OK; older draft claimed twice)
- `stats.js:41` — `gameNow()` re-evaluated per farm inside filter predicate
- `towns.js:154` — `save(STORE.TOWNS, …)` even when gameTowns identical
- `towns.js:170` — HTTP stagger uses `fromHttp * 600` (HTTP index), not town index
- `towns.js:178-180` — unlock delay time-based, not completion-based
- `towns.js:173-174` — `pruneMapsToIds` runs even on transient empty town lists

Rule: cache `Date.now()` / `gameNow()` once per tick; use
`DocumentFragment` for batch DOM ops.

---

## 18. build.py duplicate-detection false-negatives — LOW

The gate that catches name collisions in concat misses some declaration
shapes. New module using these forms bypasses the gate.

- `build.py:65` — `DECL_RE` misses `class Foo`, `async function foo`, `function* foo`
- `build.py:65` — anchored at exactly `^  ` (2 spaces); tabs / deeper indents skipped
- `build.py:321-324` — intra-module duplicates silently ignored (`setdefault` keeps first)
- `build.py:70` — regex-prev set can misclassify division vs regex in edge cases
- `build.py:119` — `/* */` comment space insertion can morph adjacent tokens
- `build.py:358` — `.build-stamp.json` mismatch yields warn-and-overwrite (no integrity check)

Rule: tighten `DECL_RE` to match `function|class|async function|function\*`
with flexible leading whitespace; flag intra-module dupes.

---

## 19. `parse-inline.js` claims self-contained but pulls from globals — LOW

Header comment lies. Renaming in caller breaks parser silently.

- `parse-inline.js:2` — header says "pure, node-runnable, no GM/DOM" but `pickNum` is defined in `farms.js:651`
- `parse-inline.js:57-64` — `serverTs` accepts any positive number; `Date.parse` has no upper bound
- `parse-inline.js:76-77` — `r.defender?.x ?? r.x` may take defender **player** coords as town coords
- `parse-inline.js:102` — `line.startsWith(id)` false for some pipe forms; falls back to whole line
- `parse-inline.js:108` — skip Set holds literal `"null null"` / `"null,null"` when x/y null
- `parse-inline.js:140` — inner JSON.parse catch returns outer `data` instead of signalling failure

Rule: enforce self-contained claim; bind `pickNum` locally; reject
non-numeric / out-of-range timestamps.

---

## 20. JSON / state save unconditional full-write — LOW

Every cadence rewrites the whole key, even when value identical.
`migrateConfig` re-writes every `WORLD_SCOPED_BASES` key on v1→v2.

- `towns.js:154` — `save(STORE.TOWNS, state.towns)` even when identical
- `core.js:422-442` — `migrateConfig` bumps `configVer` and re-saves every scoped base once

Rule: shallow-compare before save; migrations idempotent (only write
when current `state.configVer` differs).

---

## 21. Stats / preflight probes can't fail — LOW

`ok` predicate is tautological. Diag reports green when probe is broken.

- `stats.js:18` — `ok: r.ok !== false` (probe that forgets to return `ok` → pass)
- `stats.js:25-26` — `gameUw()` / `gameBridgeStatus()` outside any probe (throw aborts whole preflight)
- `stats.js:114` — `RESEARCH_CS_FAST[0]` indexed with no length check
- `stats.js:120` — `ok: blind < 5` (passes with 4 of 5 cost tables unreadable)
- `stats.js:131` / `152` / `168` — `ok: true` hardcoded (cancel / incoming / scheduler never fail)
- `stats.js:157` — `ok: n >= 0` tautology (quests probe can never fail)

Rule: every probe must have a falsy default (`ok: false`); explicit
checks for each truth condition.

---

## 22. Inline jtag inconsistent across bridge paths — LOW

`bridgePost` uses `jrnTag()`; `gameAjaxPost` constructs `jtag` inline
with a different shape. Stats rollups split across transports.

- `core.js:1020` — `gameAjaxPost` builds `jtag` inline; target from `data.building_id` etc.
- `core.js:1025` — redundant `captchaGlobalUntil` recheck (already inside `automationPaused`)
- `core.js:978-991` / `1039-1048` — `const timer` declared after `finish` closes over it
  (`bridgePost` timer @988, `gameAjaxPost` @1048; safe at call time, easy to break)
- `core.js:484-487` — `noteServerPressure` opens 10–20s cooldown on any regex hit
- `core.js:723-734` — `load()` silently swallows `GM_getValue` exceptions (corrupt key → empty)

Rule: single `jrnTag()` shape; lift `timer` above `finish`; tighten
`SERVER_PRESSURE_RE` to backend-specific phrases.

---

## 23. TOCTOU / mid-iteration state mutation — LOW

`host` / paused re-check happens inside forEach after parent guard;
fetches scheduled earlier outlive a mid-iteration pause flip.

- `towns.js:168` — host/paused re-check inside forEach after parent path
- `towns.js:155` — HTTP fallback only when `state.towns` already empty
- `bandit.js:125-131` — offense filter deletes units while iterating `Object.keys` snapshot (OK for keys;
  mutating `units` mid-loop is intentional but easy to misread)

Rule: snapshot decision state at start of iteration; re-check only on
result, not mid-iteration.

---

## 24. Orphans / dead / fragile paths — LOW

- ~~`core.js:313` — `STORE.FARM_ACTION` legacy fallback~~ — **stale, see #15**: that
  fallback does not exist in the tree
- `spy.js:13-15` — no-op `_grepbot` re-bind branch
- `build-tab.js:213-221` — `finishInstantly` fallback never calls `ibLearnAction`
- Pattern #9 / #8 overlap: hidden-tab + thrash often co-occur on the same renderers

---

## Cross-cutting rules (consolidated)

1. **Every feature-catch must `gbLog`.** Pattern #1.
2. **Call sites should bail on `automationPaused` early; never bypass `bridgePost`/`gameAjaxPost`.** Pattern #2.
3. **Irreversible posts must reconcile inside callback.** Patterns #3, #5.
4. **Blind probe → `{blind:true}` + `gbLogT` once, defer to server (never fabricate 0/false).** Pattern #4.
5. **Selectors / innerHTML escape untrusted ids.** Pattern #6.
6. **Diag / Export / webhook pass through `redactFindingsExport`.** Pattern #7.
7. **Keyed-row patch + `_last` guard + `sec.hidden` check.** Patterns #8, #9.
8. **`gbLock` + TTL on every bridge-triggering path.** Pattern #10.
9. **`gbTimeout` + bag-aware clear only.** Pattern #11.
10. **`resolveTarget` or canonical-type guard on attack/dodge/support.** Pattern #12.
11. **Precondition readers (`gbAfford`, `gbTownPop`, `gbPlayerGold`, `gbBuildingLevel`) before every post.** Pattern #13.
12. **`gbLog` / `gbLogT` over ad-hoc `console.*`.** Pattern #14.
13. **`?? default` over `|| default`.** Pattern #15.
14. **Listener / timer / blob lifecycle cleanup.** Pattern #16.
15. **Cache `Date.now()` / `gameNow()` per tick; `DocumentFragment`.** Pattern #17.
16. **build.py `DECL_RE` matches all declaration forms.** Pattern #18.
17. **parse-inline.js self-contained claim enforced.** Pattern #19.
18. **Idempotent saves / migrations.** Pattern #20.
19. **Stats probes default `ok: false`.** Pattern #21.
20. **Single `jrnTag()` shape across transports.** Pattern #22.

---

## Files covered

`header.js core.js boot.js footer.js orchestrate.js journal.js`
`attack.js military.js recruit.js bandit.js favor.js wonder.js spy.js dodge.js`
`farms.js collect.js cave.js culture.js trade.js rural.js research.js merchant.js`
`ui.js stats.js alerts.js qol.js intel.js parse-inline.js build-tab.js`
`towns.js quests.js build.py`

---

## instant-build-remembered-loop.md

# Instant-build `complete error: remembered` tight loop

## Symptom (panel log)

```
3:15:22 PM claimed Stridragavnos (rel 14684)
3:15:23 PM instant: 1 free order(s), auto-completing
3:15:23 PM instant-build complete error: remembered
3:15:23 PM instant: completed 0/1
3:15:24 PM instant: 1 free order(s), auto-completing
3:15:24 PM instant-build complete error: remembered
3:15:24 PM instant: completed 0/1
... (repeats ~every 1–3 s for the whole skip window)
```

`done` never moves past `0/1`; nothing is completed; the bot is hammering a single
free order with zero progress.

## Root cause

Two stacked bugs surface as one symptom.

### 1. Original 3 hard failures opened a `decisionSkips` window (legitimate)

`bridgePost` (src/core.js:1329) records every exit into the decision journal
(src/journal.js:96 `jrnPush`). The key comes from `jrnTag` (src/journal.js:50):

```
feature | action                        | target
build   | BuildingOrder/completeInstant | <town_id>
```

**The target is the town, not the order.** `arguments.order_id` is not one of
the ids `jrnTag` prefers (`building_id` / `research_id` / `farm_town_id` /
`offer_id` / `power_id` / `id`), so it falls through to `payload.town_id`. One
hard failure on one order therefore silences **every** free order of that town,
and the model keeps reporting all of them as free.

After **3 consecutive `jrnHard` results** (any result that is not `ok`,
`timeout`, `captcha`, or `skip:*`) `jrnNote` (src/journal.js:164) writes a
`state.decisionSkips[key]` entry with a 5/15/60 min backoff and the bot logs
`memory: build … failed 3x (<err>) - skipping Nm`.

The most likely triggers for `completeInstant` posts on a live world right now:

- Client renamed the action. Server returns `unknown action` / `invalid action`.
  `ibComplete` falls back to `finishInstantly` once (src/build-tab.js:250); if
  the client also rejected that, you get two `err` calls in a row for the same
  order, which trips the window after the next scan.
- The post hit `data.error` from `classify` (src/core.js:1395). Anything that is
  not captcha/timeout becomes a hard err.
- The post was blocked by the template-health gate (`bail('tpl-stale')`,
  src/core.js:1349). `tpl-stale` was **not** in `JRN_SKIP_ERRS`, so `jrnResult`
  returned it verbatim and `jrnHard` counted it: an invalidated `ibAction` also
  opened a `decisionSkips` window, i.e. two independent blocks from one root
  cause, one of which outlives the 30 min `TPL_HEALTH_STALE_MS` self-heal.

Not a trigger, contrary to an earlier draft of this doc: `resolve('unknown')`
(src/build-tab.js, timeout branch) is the *promise* value of `ibComplete`, not a
journal result. The journal saw `timeout`, and `jrnHard` (src/journal.js:44)
excludes `timeout`, `captcha`, `ok` and `skip:*`.

Once the window opens, **every** subsequent `bridgePost` for that exact key
short-circuits at `jrnSkipped(jtag)` (src/core.js:1341) with `err =
'remembered'`, which is logged by `ibComplete` (src/build-tab.js:261) as:

```
instant-build complete error: remembered
```

### 2. The bot never backs off when posts are short-circuited

`ibCompleteAll` (src/build-tab.js:274) chains `ibComplete` calls with
`gbTimeout(next, 400 + Math.random() * 200)` and, when the batch ends, fires
`gbTimeout(ibScan, 3000)` (src/build-tab.js:290) **unconditionally** — even when
`done === 0` and every result was a `remembered` skip. Combined with the boot
loop:

- `gbInterval(scan, IB_CHECK_MS)` every 10 s (src/boot.js:113)
- `ibArmNext` re-arming on the next visible countdown (src/build-tab.js:310)
- `visibilitychange` / `pageshow` re-running `ibScan` (src/boot.js:70, 80)
- build-button click hook (src/boot.js:103)

…the bot restarts `ibScan` ~every 1–3 s. Each scan re-detects the same free
order (model still says `gold===0 && timeLeft<=thresh`), calls
`ibCompleteAll`, every call short-circuits at `jrnSkipped`, `done` stays `0`,
and the cycle restarts.

The order is genuinely still free in the model because the server never
actually completed it — the bot's posts were rejected, so the building clock
keeps running and the model keeps reporting `isFree: true` until either the
real countdown hits 0 or the user completes it by hand.

### Why this looks spammy even when the bot is "doing the right thing"

- `bridgePost` already uses `gbLogT('mem-skip-<key>', 60000)` (src/core.js:1342)
  so the skip reason itself is throttled. But `ibComplete` then receives
  `err='remembered'` from its callback and logs the un-throttled line
  `instant-build complete error: remembered` (src/build-tab.js:261).
- `instant: completed 0/1` fires every batch (src/build-tab.js:288) with no
  throttle and no differentiation between "0 because everything was a real
  error" and "0 because everything was a skip".

So during the entire 5–60 min backoff, the user sees a wall of identical
`complete error: remembered` lines.

## Solution (shipped in v1.6.6)

Five changes. None touch the bridge contract or the captcha breaker.

### A. Don't re-arm `ibScan` 3 s after a batch that completed nothing

`ibCompleteAll` fired `gbTimeout(ibScan, 3000)` unconditionally. It is now gated
on `done > 0`, and the batch line is throttled:

```js
gbLogT('ib-batch-done', 60000,
  `instant: completed ${done}/${free.length}${captcha ? ' (captcha abort)' : ''}`);
if (done) { flash(`instantánea x${done}`); gbTimeout(ibScan, 3000); }
```

The 10 s `IB_CHECK_MS` interval (src/boot.js:113) is the recovery path; the 3 s
accelerator only earns its keep when something actually moved.

### B. Skip remembered orders in `ibScan`, before the batch is announced

This is the change that actually stops the loop. A/B/C only quiet it: the scan
still walked the batch to have every post short-circuit at `jrnSkipped`. New
journal helper (src/journal.js), plus `ibJrnPayload(order)` in build-tab so the
scan can key on the same tag without posting:

```js
function gbSkipActive(feature, payload) {
  const tag = jrnTag(feature, payload);
  return jrnSkipped(tag) ? (jrnWhy(tag) || 'remembered') : '';
}
```

```js
const live = free.filter(o => {
  const why = gbSkipActive('build', ibJrnPayload(o));
  if (!why) return true;
  gbLogT('ib-mem-' + o.town_id, 60000, `instant: #${o.id} skipped from memory (${why})`);
  return false;
});
if (!live.length) return;
```

`ibJrnPayload` mirrors `jrnTag`'s inputs (`model_url`, `action_name` from
`ibActionFor`, `arguments.order_id`, `town_id`) — keep the two in sync, or the
pre-check silently stops matching the window it is meant to read.

### C. Throttle the callback logs in `ibComplete`

`remembered` gets `gbLogT('ib-remembered-<order>', 60000)`. Pure local gates
(`tpl-stale`, `budget`, `disabled`, `dryrun`) resolve `'skip'` rather than
`'err'` and log under `gbLogT('ib-gate-<err>', 60000)` — nothing was posted, so
they are not evidence about the payload. Reconciliation via `goneOk()` runs
first on `captcha` / `timeout` / `remembered` / `paused`; on the synchronous
bail paths it is a cheap no-op, on the async ones it converts a real completion
into `'ok'`.

### D. `tpl-stale` is a skip, not a hard failure

src/journal.js, `JRN_SKIP_ERRS` now includes `'tpl-stale'`. It is a local gate,
so it must not feed `gbFailStreak` — otherwise an invalidated template opened a
second, longer block (up to 60 min) on top of the 30 min template window it came
from.

### E. Re-learn `ibAction` when both free actions are rejected

`ibResetLearnedAction(kind, err)` fires only from the `finishInstantly` fallback
path and only for `ibUnknownActionErr(err)`: it clears `state.ibAction` /
`state.ibActionR` and persists `null`, so `ibActionFor` falls back to the
constant `'completeInstant'` on the next scan. Side effect worth knowing:
`tplHealthOk` returns `true` when `state[name]` is empty (src/core.js:721), so
clearing the learned name also lifts the `tpl-stale` gate.

## Immediate user-side workaround

While the fix is not built, recover without a reload:

1. Open the panel **Log** tab → **Decisiones** sub-view.
2. Filter for `build` → look at the most recent record. Confirm `r` is the
   same hard error three times (the trip that opened the window).
3. Click **Limpiar saltos** (src/ui.js:806) to clear every active skip window.
4. If the original failures were `unknown action`, **hand-click a free
   complete in the game UI once** so `ibLearnAction` (src/build-tab.js:192)
   sniffs the new action name from the request body and persists it.
5. Toggle `autoBuild`/`state.ibAuto` off and on (or run `ibScan` once via the
   panel) to restart the loop.

If the same loop comes back within seconds, the learned `ibAction` is still
wrong — clear it from the panel, hand-click, retry. Or set
`state.decisionMemory = false` (Config → "Memoria de decisiones") to suppress
the skip window while validating the new action name in dry run with
`state.dryRun = true`.

## Recovery behaviour after v1.6.6

- `jrnSkipped` (src/journal.js) returns `false` when the window expires and
  decrements `trips` once, so after 5 min the town is retried.
- If the action is still rejected, 3 more hard fails re-trip the window — but no
  longer *within one batch*: the scan now drops remembered orders (B) and does
  not self-re-arm at 3 s (A), so decisions accumulate at the 10 s interval, not
  at 1–3 s.
- The 5/15/60 min ladder still caps at 60 min. What changed is that an
  unknown-action root cause now self-heals (E) instead of pinning the town for
  an hour per retry.

## Related

- `docs/ROADMAP.md` — Phase 8.5 instant build + research.
- `docs/TASKS.md` — gate 8.5: validate the free-complete post end-to-end on
  `es146` before relying on auto.
- `docs/error-patterns.md` — the post-v1.6.6 shape of this bug in the panel log
  is a single throttled `instant: #<id> skipped from memory (<err>, Nm left)`
  per minute, not a wall of `complete error: remembered`.

---

## plan-academy-queue.md

# Plan — academy ("universidad"/Investigación) research queue: does not appear, does not work

**Status: coded in v2.9.0.** Steps 1–7 are implemented except the C1/C2/C3
*selection* in step 0, which still needs the live DOM read. Rather than block on
it, v2.9.0 ships the defensive superset of all three (see *Implementation notes*
at the bottom) — each candidate is handled by a read that fails closed, so the
console snippet is now a **diagnostic**, not a gate. Step 8 in-game validation
with Dry run ON is still outstanding.

Symptom (user, live world): the research queue neither **appears** (no `[+]`
controls in the Academy window, no `Cola GrepBot · Investigación` panel) nor
**works** (nothing is ever posted from the FIFO lane).

Shipped in v2.8.1 (`567f00b`), never validated in-game. Repo is clean at v2.8.2.

## Evidence already gathered (from `archive/captures/grepo-dump/js/game.min.js`)

- Academy tech tree click handler: `this.$el.off(e).on(e,".btn_upgrade, .btn_downgrade", function(e){ e=$(e.currentTarget).data("research_id"); this.controller.onBtnClick(e) })`.
  The game's own user-guide selector is `.tech_tree_box .button_upgrade[data-research_id=X]`.
  Two different class names (`btn_upgrade` vs `button_upgrade`) are in play.
- Template data passed per tech: `{research_id:e, column_number:p, is_researched:f, in_progress:g, ...}`.
- Research start is a **frontend_bridge** call, not a legacy controller:
  `GameModels.ResearchOrder` (`urlRoot:"ResearchOrder"`) has
  `research:function(e){this.execute("research",{id:this.getType()},e)}` and
  `GrepoApiHelper.execute` = `gpAjax.ajaxPost('frontend_bridge','execute',{model_url,action_name,captcha:null,arguments})`.
  GrepBot posts `gameAjaxPost('research','building_academy','research',{id,town_id})` instead.
- Available research points in this client:
  `getAvailableResearchPoints: function(){ return this.getCurrentResearchPoints() - this.getSpentResearchPoints() }`.
  GrepBot's `researchPointsAvailable` probes `getAvailableResearchPoints` /
  `getFreeResearchPoints` / `getResearchPoints` on the **town model**, then
  `researches().attributes` keys. Those getters live on the academy
  *controller*, not the town.
- Town proxy DOES expose `researches()` (`this.researches=function(){return this.getResearches()}`)
  and `getBuildings()`. So `info.techs` / `info.academy` are readable.
- Town proxy does NOT expose `getResearchOrdersCollection` (0 hits in the dump).
  Research orders live in the MM collection registered by `model_class`
  `"ResearchOrder"`, backed by a `TownAgnosticCollection` with
  `segmentation_key:"town_id"`. `MM.getOnlyCollectionByName` returns `i[0]`.

## Hypotheses, ranked

### "Does not work" (posting path) — VERIFIED against the dump

- **H1 — CONFIRMED. Primary "does not work" root cause.**
  `researchPointsAvailable` (`src/research.js:73`) probes
  `getAvailableResearchPoints` / `getFreeResearchPoints` / `getResearchPoints` on
  the **town proxy**. All three are absent there: `getAvailableResearchPoints`
  exists exactly once in the dump, on `GameControllers.AcademyBaseController`
  (`getCurrentResearchPoints() - getSpentResearchPoints()`); the other two have
  0 hits. The `researches().attributes` fallback cannot help either — that model
  is `urlRoot:"Researches"` with `hasResearch(e){return !0===this.get(e)}`, i.e.
  attributes are `{<tech>: bool}` only; `research_points` never appears on any
  model (all 17 hits are `GameData.researches[x].research_points`).
  ⇒ returns `null` always ⇒ `researchCanAfford` returns
  `{ok:false, why:'available research points unreadable'}` for every tech in
  every town, forever. Nothing is ever posted.
  **Correction to the original plan:** `researchPointCost` is FINE —
  `research_points` is the real GameData property. Only the *available* side is
  broken.
  Real formula to port:
  `current = academyLevel * Game.constants.academy.points_per_academy_level + (library===1 ? points_per_library_level : 0)`
  (capture: `points_per_academy_level:4`, `points_per_library_level:12`; minus
  one academy level while the academy is tearing down), and
  `spent = Σ research_points over techs where hasResearch(t) || isResearchInQueue(t)`.
- **H2 — REFUTED. Not a live blocker; do not treat as a fix.**
  Real entry shape (verbatim from the saved page):
  `"berth":{"id":"berth","research_dependencies":[],"building_dependencies":{"academy":22},"requires_farming_villages":false,"resources":{"wood":8900,"stone":5200,"iron":7800},"required_time":13500,"research_points":6}`.
  Every gate at `src/research.js:146-148` passes. The `academy_level` probe at
  `:144` matches nothing but is a no-op, not a block.
  The blind-verdict refactor is still worth doing for the CLAUDE.md invariant —
  just not as the fix.
- **H3 — CONFIRMED client-side** (server-side unprovable offline).
  `building_academy` has **0 hits** in `game.min.js`, `game.min_Em_n.js` and the
  saved page. The only start path is
  `buyResearch(e) → new GameModels.ResearchOrder({research_type:e}).research() → execute('research',{id:getType()}) → gpAjax.ajaxPost('frontend_bridge','execute',{model_url:'ResearchOrder',action_name:'research',captcha:null,arguments:{id}})`.
  `bridgePost` (`src/bridge.js:190`) already sends exactly that envelope with
  dry-run / journal / captcha / watcher intact.
  **Missed by the original plan:** `town_id` must go at the **top level** of the
  post, not inside `arguments` — `gpAjax._ajax` does
  `if(!o)o={town_id:Game.townId};else if(!o.town_id)o.town_id=Game.townId`, so
  without it every research silently retargets the currently-open town instead
  of `job.townId`.
  `tplNameFor` needs no change: `research` is absent from `TPL_FEATURE_MAP`
  (`src/core.js:736-748`), so the tpl-stale gate is already a no-op here.
- **H4 — CONFIRMED, and worse than stated. Must be fixed BEFORE H1.**
  `ITowns.addToTowns` constructs each `Town` with building-order, unit-order,
  unit, supporting-unit, god and casted-power fragments — **no research-orders
  fragment**. That is why `abGetTown(id).buildingOrders()` works per town and
  research has no equivalent.
  The MM fallback provably carries only the current town: `research_orders` is a
  `TownAgnosticCollection`, and only its `getCurrentFragment()` working copy is
  registered under `d.collections['ResearchOrder']`; `getOnlyCollectionByName`
  returns `i[0]`, and that working copy is `reset()` to the current town on every
  town switch. ⇒ `info.orders` is correct for `Game.townId` and **always `[]`**
  elsewhere, so "already queued" and "queue full" silently pass for every other
  town and `nativeQueueReconcileResearch` never prunes there.
  Working per-town reads:
  `MM.getFirstTownAgnosticCollectionByName('ResearchOrder').getFragment(townId).models`
  (careful: `getFragment` *creates* an empty fragment on miss, so empty ≠
  unknown), or `MM.getModels().ResearchOrder` filtered on `get('town_id')`.
  Whether the server pushes other towns' ResearchOrder models at all is
  unprovable offline — treat a miss as **unknown**, not as "empty".

### Additional posting-path defects found during verification

- **A1 — queue max hardcoded to 2** (`src/research.js:157`, `:219`). Real value
  is `GameDataConstructionQueue.getResearchOrdersQueueLength()` →
  `GameDataPremium.hasCurator() ? 7 : 2`. Caps Curator accounts at 2. Mirror
  `abQueueMax()` (`src/build-auto.js:33`).
- **A2 — `requires_farming_villages` / `on_small_island` never checked.** The
  game's own `can_be_bought` includes it. On a small island those techs are
  guaranteed server rejections — one request-budget slot and one decision-memory
  strike every cadence. Exactly the v1.5.4 regression class named in CLAUDE.md.
- **A3 — cost is unmodified.** The game uses
  `GameDataResearches.getResearchCosts` = `resources × GeneralModifications.getResearchResourcesModification(Game.townId)`.
  `src/research.js:52-63` reads raw `resources`, so it over-estimates once
  diplomacy is researched. Conservative, not blocking — fix with the rest.

### "Does not appear" (mount path) — VERIFIED against the dump

- **H5 — REFUTED.** The tech tree does emit `data-research_id` as a real HTML
  attribute: the click handler binds `.btn_upgrade, .btn_downgrade` and reads
  `$(e.currentTarget).data("research_id")`, and jQuery `.data()` reads the
  `data-research_id` attribute; the user guide independently builds the literal
  selector `.tech_tree_box .button_upgrade[data-research_id=X]`. Class-name
  mismatch exists (`btn_upgrade` in the handler vs `button_upgrade` in the user
  guide) but is irrelevant — `NATIVE_RESEARCH_SEL` (`src/native-ui.js:615`) is
  attribute-based and will match. The tech tree template itself is
  server-rendered and absent from the dump, so the per-builder class is
  unprovable offline; the attribute's presence is forced by the handler.
- **H6 — REFUTED on the clipping claim; the no-anchor gap is real but minor.**
  `nativeUiScan` (`src/native-ui.js:766-767`) already re-targets `button`/`a`
  nodes to `parentElement`, so the control is never appended inside the sprite
  button. `.gb-native-qctl` CSS (`src/native-ui.js:538`) is
  `position:relative; display:inline-flex; vertical-align:middle` plus
  `z-index:2147482000` — no `overflow:hidden`, no absolute positioning, so it
  sits in flow and above `.tech_tree_box` overlays. The real gap is only that
  the build lane has explicit anchor logic (`src/native-ui.js:669`) and the
  research lane does a bare `tile.appendChild(ctl)`. The tech-tree cell's own
  `overflow` is not in the dump — resolve in-game, not by guessing.
- **H7 — CONFIRMED. Dominant "does not appear" cause.**
  `ensureDomObserver` (`src/collect.js:182-188`) observes `#ui_box` plus the
  `.window_content` nodes that exist at arm time, falling back to `document.body`
  only when that list is empty. Grepolis windows are **not** inside `#ui_box`:
  `WindowsView` is `el:"body"` and `renderWindow` mounts with
  `$parent:this.$el` (= body); the saved page shows `#ui_box` (line 1351) and the
  open window `window_c970` (line 2755) as **sibling children of `<body>`**. A
  `subtree:true` observer on `#ui_box` cannot see an insertion in a sibling
  subtree, so opening the Academy fires no mutation and `scheduleNativeUiScan`
  is never called. Remaining triggers: the one-shot at `src/boot.js:81` (too
  early), the 5s loop at `src/boot.js:82-87` (gated on `nativeQueueHasPending`,
  false while the lane is empty — a chicken-and-egg lock), and SPA nav (opening
  a window is not SPA nav).
  **Correction to the original plan:** the `attributeFilter` note is a red
  herring — `childList` mutations are not gated by `attributeFilter`. The fix is
  the observer's *target*, not its filter: observe `document.body` (or re-arm
  from a body-level root), and/or ungate the 5s re-scan.
- **H8 — CONFIRMED on the missing attribute, but not a cause on its own.**
  The window template carries no town-id attribute
  (`<div id="window_<%= model.cid %>" class="js-window-main-container …">`) and
  the Academy has no `input[name="town_id"]`, so `nativeWindowTownId`
  (`src/native-ui.js:555-569`) falls through to the GPWindowMgr focus path.
  Both `getFocusedWindow` and `getJQElement` exist, and `getJQElement` returns
  the `.js-window-main-container`, which **contains** the `.window_content` that
  `nativeUiScan` passes as `root` — so `el.contains(root)` holds and the
  **focused** window resolves fine. Only un-focused windows return null, which is
  the intended conservative behaviour. Not the reported symptom.

**Verifier's bottom line:** H5 and H6 do not explain the symptom; H8 explains it
only for un-focused windows; **H7 alone explains it.**

### Contradiction — RESOLVED against H7

User confirmed in-game: **Senate build `[+]` and Barracks/Docks recruit `[+]`
appear fine; the Academy shows no `Cola GrepBot · Investigación` panel at all.**

A third verifier established the full trigger inventory: the only trigger that
survives a window open is the 5s loop at `src/boot.js:82-87`, gated on
`nativeQueueHasPending` for any lane. Since the build/recruit controls do appear,
that loop **is** ticking, so `nativeUiScan` runs every 5s and does re-scan
`document.querySelectorAll('.window_content,.gpwindow_content,#unit_order')` —
including the Academy window whenever it is open.

⇒ **H7 is real but is NOT the cause of this user's symptom.** The scan runs; it
just produces `researchN === 0`, and `nativeUiScan` (`src/native-ui.js:771`)
only calls `nativeRenderQueuePanel` for a lane `if (researchN)` — otherwise it
*removes* the panel. "No panel at all" is exactly that branch.

H7 remains worth fixing as a real robustness bug (a fresh install with all three
lanes empty has no trigger at all — chicken-and-egg: no scan ⇒ no `[+]` ⇒ lane
stays empty ⇒ no scan), but it must not be sold as the fix.

### What can produce `researchN === 0` — needs live DOM, not more dump reading

The Academy tech tree markup is **server-rendered with the window payload** and
is absent from every capture: `grep -c research_id "Grepolis - Atenas.html"` = 0,
and the only `tech_tree` hits in `game.min.js` are the two user-guide selector
strings. Both prior verifiers ended at "unprovable offline" here. Remaining
candidates, in order:

- **C1 — no `data-research_id` attribute in the real DOM.** The click handler
  reads `$(e.currentTarget).data("research_id")`, and jQuery `.data()` checks its
  own store *before* the attribute — so a template that sets it via `.data()` in
  JS leaves no attribute for `NATIVE_RESEARCH_SEL` to match. The user-guide
  selector argues the attribute exists, but on `.button_upgrade`, a class the
  click handler does not use.
- **C2 — the id values are not `GameData.researches` keys.** `nativeResearchId`
  (`src/native-ui.js:616-627`) only accepts a value for which
  `researchDef(v)` is truthy. Numeric ids, or a `research_type` spelling that
  differs from the GameData key, yield `null` for every tile ⇒ `researchN === 0`.
- **C3 — `nativeWindowTownId` returns null for the Academy root.** If the
  Academy window contains more than one distinct `input[name="town_id"]` /
  `data-town-id` value, `ids.size > 1` ⇒ `return null` (`src/native-ui.js:560`)
  ⇒ the whole root is skipped and every control removed. Senate/Barracks would
  be unaffected. Also fits "no panel at all".

**Next action is a live DOM read, not another offline pass.** Console snippet in
step 0 below settles C1/C2/C3 in one paste.


## Work order

Posting-path order is now fixed by a dependency the first pass missed: the
correct available-points formula subtracts `getSpentResearchPoints`, which counts
researched techs **plus queued orders**. With `info.orders` empty for non-current
towns (H4), a "fixed" H1 would over-report points and post unaffordable
research. **H4 before H1.**

0. **Live DOM read (blocking — decides the whole mount fix).** Open the Academy
   in-game, then paste this in the browser console (page context, F12):

   ```js
   (()=>{const q=s=>document.querySelectorAll(s).length;
   const b=document.querySelector('.btn_upgrade,.button_upgrade,[data-research_id]');
   const tids=new Set();document.querySelectorAll('input[name="town_id"],[data-town-id],[data-town_id]')
     .forEach(n=>tids.add(n.value||n.getAttribute('data-town-id')||n.getAttribute('data-town_id')));
   console.log({attr_us:q('[data-research_id]'),attr_dash:q('[data-research-id]'),
     type_us:q('[data-research_type]'),btn_upgrade:q('.btn_upgrade'),
     button_upgrade:q('.button_upgrade'),tech_tree_box:q('.tech_tree_box'),
     window_content:q('.window_content'),townIds:[...tids],
     gameDataKeys:Object.keys((window.GameData||{}).researches||{}).slice(0,5),
     jqData:b&&window.jQuery?jQuery(b).data('research_id'):'n/a',
     sample:b&&b.outerHTML.slice(0,300)});})()
   ```

   - `attr_us === 0` but `btn_upgrade > 0` ⇒ **C1** (attribute absent; selector
     must go class-based and read the jQuery data store).
   - `attr_us > 0` but the values are not in `gameDataKeys` ⇒ **C2** (relax
     `nativeResearchId`'s `researchDef` gate).
   - `townIds.length > 1` ⇒ **C3** (`nativeWindowTownId` bails; scope the town-id
     collection to the window root and prefer the focused window's town).
   - `sample` also shows whether the cell would clip an inline-flex control (H6
     anchor).
1. **Instrument.** One-shot `gbLogT` when a root contains `.tech_tree_box` but
   matched zero research tiles, and when `nativeWindowTownId` returns null for
   such a root. Add a Preflight row for the academy read path: techs readable,
   academy level, orders count/readable, research points readable,
   `GameData.researches` size. Keeps this diagnosable without a console next
   time.
2. **H4 — per-town research orders.** Read via
   `MM.getFirstTownAgnosticCollectionByName('ResearchOrder').getFragment(townId)`
   or `MM.getModels().ResearchOrder` filtered on `town_id`; keep the current
   working-copy read for `Game.townId`. A miss must surface as **unknown**, not
   as an empty queue — do not prune and do not claim a free slot on unknown.
3. **H1 — available research points.** Port the real formula
   (`academy × points_per_academy_level + library bonus − Σ research_points of
   researched-or-queued techs`) using `Game.constants.academy`. Where it still
   cannot be read, return a `blind` verdict (log once, let the server decide),
   per the CLAUDE.md precondition invariant. Leave `researchPointCost` alone —
   it is correct.
4. **H3 — transport.** Send research through `bridgePost` with
   `model_url:'ResearchOrder'`, `action_name:'research'`, `arguments:{id}` and
   **`town_id` at the top level of the post**. Drop or demote
   `building_academy/research` to a fallback. No `tplNameFor` change needed.
5. **A1/A2/A3 — remaining precondition gaps.** Real queue length via
   `GameDataConstructionQueue.getResearchOrdersQueueLength()`; skip
   `requires_farming_villages` techs on a small island; apply
   `getResearchResourcesModification` to the cost.
6. **H2 — invariant cleanup only.** Convert `researchDepsOk` /
   `researchCanAfford` unreadable paths to `blind`. Not a fix for the reported
   symptom; do not let it displace the real ones.
7. **Mount fixes.** Whatever step 0 returns (C1 / C2 / C3) drives the main fix.
   Alongside it, unconditionally: move the MutationObserver target to
   `document.body` — Grepolis windows are body-level siblings of `#ui_box`
   (`WindowsView` is `el:"body"`, `renderWindow` mounts with `$parent:this.$el`;
   the saved page shows `#ui_box` at line 1351 and `window_c970` at line 2755 as
   sibling body children) — and ungate the 5s `scheduleNativeUiScan` so an empty
   lane can still mount its `[+]` (H7's chicken-and-egg). Add the research-lane
   anchor to match the build lane (H6). Do **not** touch `attributeFilter`
   (`childList` mutations are not gated by it).
8. Bump `@version` in `src/header.js`, `python3 build.py`, headless smoke via
   the `run-grepbot` skill, then in-game validation with **Dry run ON**.

## Non-goals

- No test harness, no npm, no server (CLAUDE.md).
- Do not enable anything HIGH-RISK by default.
- Do not "simplify" a precondition into an unconditional post.

## Implementation notes (v2.9.0)

Posting path, in the plan's order:

- **H4** — `researchOrdersFor(townId)` returns `{orders, known}` and
  `researchTownTechs` surfaces it as `info.ordersKnown`. Three reads, in order:
  the `ResearchOrder` TownAgnostic fragment, a flat `MM.getModels().ResearchOrder`
  sweep, then the working copy (open town only). An empty result only counts as
  known-empty for the open town, or when the flat sweep holds an order for some
  *other* town — which proves the server pushes them world-wide. Unknown blocks
  the post (`cola real ilegible; abre esa ciudad una vez`) instead of claiming a
  free slot, and `nativeQueueReconcileResearch` stops using the real queue for
  pruning while it is unknown (researched flags still prune).
- **H1** — `researchPointsAvailable` ports
  `AcademyBaseController.getCurrentResearchPoints() - getSpentResearchPoints()`
  off `Game.constants.academy`, including the library bonus (`level === 1`) and
  the one-level drop while the academy tears down. `researchPointsSpent` sums
  `research_points` over researched-or-queued techs, so it returns null while
  `ordersKnown` is false. `researchPointCost` was already correct and is unchanged.
- **H3** — `researchPayload` is now
  `{model_url:'ResearchOrder', action_name:'research', arguments:{id}, town_id}`
  through `bridgePost`, with `town_id` **top level**. `txIntent` already keyed
  research off `d.town_id` + `arguments.id`, so decision-memory keys are unchanged.
- **A1** — `researchQueueMax()` reads
  `GameDataConstructionQueue.getResearchOrdersQueueLength()`, falling back to
  `hasCurator()`/`isAdvisorActivated('curator')`, then 2.
- **A2** — `requires_farming_villages` blocks only when `on_small_island` was
  actually read as true.
- **A3** — `researchCost(tech, townId)` multiplies by
  `GeneralModifications.getResearchResourcesModification(townId)`; an unreadable
  modifier keeps the raw (higher) cost.
- **H2** — `researchDepsVerdict` returns `{ok, blind, why}`; `researchDepsOk`
  keeps its boolean contract for existing callers and returns **true** on blind.
  `researchCanAfford` likewise returns `{ok, blind, why}` and only blocks on a
  value it read (a `gbAfford` shortfall on an *unreadable* resource does not count).

Mount path — step 0's console snippet was not run, so all three candidates are
handled rather than one being selected:

- **C1** — `nativeResearchId` falls back to the jQuery data store (which
  `.data()` reads before the attribute), and `NATIVE_RESEARCH_SEL_ALL` adds the
  class hooks the game itself binds (`.btn_upgrade`, `.button_upgrade`,
  `.research_icon`). A class-only node still has to resolve to a real GameData
  tech or it is skipped.
- **C2** — `nativeResearchKey` maps a raw tile value through
  `GameData.researches`' own `id`/`research_id`/`research_type`/`name` fields,
  and `nativeResearchFromClass` reads the `getResearchCssClass` convention
  (`<tech>`, `<tech>_old`, `<tech>_bpv`).
- **C3** — `nativeWindowTownId` no longer aborts the whole root on multiple town
  ids: if the open town is among them and this root is the focused window, that
  is the town. Otherwise it still returns null, now with a throttled log.
- **H7** (real, but not this symptom) — the MutationObserver target moved to
  `document.body`, since Grepolis windows are body-level siblings of `#ui_box`;
  the observer's ignore filter grew `#grepbot-panel` / `#grepbot-queue-center` so
  the bot's own repaints do not feed it. The 5s `scheduleNativeUiScan` is now
  ungated, closing the empty-lane chicken-and-egg.
- **H6** — the research control anchors next to the tech caption like the build
  lane does; its removal query is descendant-scoped to match.
- **Step 1 instrumentation** — throttled logs for "academy root matched N nodes
  but resolved 0 techs" (with attribute/class/`tech_tree_box` counts) and for
  "academy window open but its town id is unreadable", plus a Preflight
  **academy read path** row: `GameData.researches` size, academy, library, real
  queue + max, research points, small-island flag.

Still open: step 0 as a diagnostic if the lane is still absent in-game, and step
8 (in-game validation with Dry run ON).

---

