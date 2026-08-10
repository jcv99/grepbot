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

## 1. Still open

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

## 2. New value (plan 26 §C)

| # | Feature | Notes |
|---|---------|-------|
| 1 | **Adaptive claim duration** | 20min–3h options are learnable and completely unused; fewer claims = fewer posts |
| 2 | **Budget visibility in Stats** | slots by scope, soft delay, `skip:budget` count |
| 3 | **Preflight for post-v1.5 modules** | native-ui, queue-center, phoenician, tx, bridge have no probe |

---

## 3. Dead state to wire or delete (plan 26 §B6)

`orchDeadlockResolve` (`core.js:356`), `tabFilters` (`core.js:355`),
`abNextAt` (`core.js:277`), `tradeMaxHops` (`core.js:357`) are loaded into state
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

## 6. Top ROI picks

1. **Farm scrape circuit breaker** (26 §A1) — stops a dead loop from starving live automation
2. **Scope-aware budget + Stats visibility** (26 §A3 + §C2) — makes the next A1 self-evident
3. **Adaptive claim duration** (26 §C1) — more loot per request, less captcha surface

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
