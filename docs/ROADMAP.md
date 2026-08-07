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
