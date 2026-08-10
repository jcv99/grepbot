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

---

## Related docs

- `plans/26-improvement-sweep-2026-08-10.md` — **current** plan of record
- `plans/README.md` — per-feature implementation plans (01–25, mostly closed)
- `ROADMAP.md` — phase plan and competitor parity table
- `TASKS.md` — in-game validation checklist (current gate order)
- `archive-audits/` — historical audits (CLOSED / stale; do not re-implement from them)
- `CLAUDE.md` — architecture and regression notes
