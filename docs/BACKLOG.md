# GrepBot feature backlog

Ideas for what to add or finish next. Phases 0–15 are **coded**; `TASKS.md` tracks
**in-game validation**. This file prioritizes gaps, reliability fixes, smarts, and
UX — not raw feature count.

Last reviewed: 2026-08-07 (against `src/` @ v1.5.x + `audit-findings-2026-08-06.md`).

---

## Suggested order

```text
Validate TASKS (8.1 cave → 8.2–8.7 econ) with dry-run ON
    ↓
Fix C4/C5/I9/I11 (dodge queue, intel crash, trade ledger, captcha on XHR)
    ↓
Warehouse deadlock + build planner v2 + evidence dump
    ↓
Trade party/unit presets + webhook/Telegram UI
    ↓
HIGH-RISK 8.12/8.13 only after payload sniff matches UI
```

---

## 1. Finish what's stubbed or deferred

Already in the tree but incomplete.

| Gap | Why it matters | Risk |
|-----|----------------|------|
| **Trade presets `party` / `unit`** | UI shows "unimplemented"; only fill-storage works (`trade.js`) | Med |
| **Wonder favor cast** (ROADMAP 11.4) | WW worlds only; deferred | Med |
| **Telegram webhooks** | Comment in `alerts.js`; Discord-only payload + no chat_id UI | Low |
| **`webhookEvents` / `allianceNotes`** | Loaded in state, no panel wiring | Low |
| **`tradePreset` in Config** | Loaded but never read by trade logic | Low |

Low risk, clear wins — no new automation surface, just completing planned behavior.

---

## 2. Reliability fixes (audit backlog)

From `audit-findings-2026-08-06.md`. Do these before adding new features.

| ID | Issue | Fix sketch |
|----|-------|------------|
| **C4** | Auto-dodge drops simultaneous attacks — `dodgeSeen[key]` before act, single lock | Queue + states `notified\|pending\|sent\|failed`; retry with backoff |
| **C5** | `intelDossiers()` throws — object key, missing `units:[]` | Map by id/name string; init `units:[]`, `towns:[]` |
| **C3** | World state not isolated — findings, towns, attack plan, etc. leak cross-world | Scope id-bearing maps under `wkey()`; migrate on `configVer` bump |
| **C2** | Dispose incomplete — fetch/XHR/SPA/questMo not restored on reinject | Save originals; restore in dispose; abort GM handles |
| **C1** | `priorityOrder` load default still 6 keys; dead `*_CHECK_MS` constants | Migrate stored lists to full 12; drop or wire dead cadence consts |
| **C7** | Auto-on without consent — host + `autoFarm`/`ibAuto`/… default ON | Host OFF; risky toggles OFF; explicit per-world enable |
| **I9** | Trade over-allocates — no mutable ledger across jobs | Deduct src stock / tradeCap / tgt deficit per job |
| **I10** | Wonder donations — 3× capacity; `wonderSpentToday` RAM-only | `wood+stone+iron ≤ tradeCap`; persist daily budget |
| **I11** | Global captcha lost on reload; GM XHR skips captcha check | Persist `wkey(CAPTCHA_GLOBAL_UNTIL)`; central check on all HTTP |
| **I12** | GM XHR no timeout — scrape locks stick forever | Add timeout/ontimeout + abort on dispose |
| **I13** | Decision journal dedup order stale | Splice + push on dedup hit |
| **I14** | Findings trim deletes `seen[id]` → inbox re-fetch loop | Keep seen independent of visible findings cap |
| **I15** | Quest row `innerHTML` with user strings | `createElement` + `textContent` |
| **C6** | `@connect *` in header | Tighten to grepolis + webhook host pattern |

### Ops tooling

- **Evidence dump** (Log → Evidence): last-OK, last-skip, captcha windows, orch
  queue, learned templates — shrink TASKS gates to paste Diag+Evidence.

---

## 3. Economy smarts

Highest "new value" without HIGH-RISK toggles. Bridge-first + preconditions.

| # | Feature | Notes |
|---|---------|-------|
| 1 | **Warehouse deadlock resolver** | Full WH + farm paused → orch forces cave → trade → rural before farm |
| 2 | **Build-phase planner v2** | Resource-aware next building + "next 3" on Build tab |
| 3 | **Island-aware trade graph** | Refuse freighter-burning cross-island hops |
| 4 | **Culture ↔ cave coordination** | Skip festival if iron needed for cave threshold soon |
| 5 | **Farm option auto-teach** | When loyalty research completes, auto-learn 10min option |
| 6 | **Resume-burst serializer** | Tab focus wake ≠ farm+ib+bandit+collect same second (captcha vector) |
| 7 | **Learned-payload health** | Age + last-success on claimTpl/ibAction/attack; invalidate after N hard fails |

---

## 4. Military / intel

Mostly coded in v1.0 spine; validation + small adds.

| Item | Status | Notes |
|------|--------|-------|
| Cancel/recall helper | CODED (`military.js`) | Validate v1.5.9 TASKS; dry-run first |
| Hero transfer | CODED (Attack tab) | Confirm + sniff `heroTpl` |
| Harassment presets | CODED (Attack tab chips) | Confirm-send only |
| **Support ETA on threat board** | BACKLOG | "lands in 4h12m" on incoming rows |
| **Attack pattern alerts** | BACKLOG | Same attacker 3×/24h → webhook |
| **Offline report catch-up** | BACKLOG | Bounded by `lastSeenTs` |
| **Watchlist "why"** | BACKLOG | Show match reason (player / coords / alliance) |
| Wonder favor cast (11.4) | DEFERRED | WW worlds only |

HIGH-RISK: auto-dodge (8.12), auto-recruit (8.13) — payload sniff + dry-run before enable.

---

## 5. UX

| # | Feature |
|---|---------|
| 1 | **Config presets**: AFK overnight / Active farming / War (HIGH-RISK OFF in all) |
| 2 | **Footer last-action chip** — e.g. `farm: claim OK 12s ago` |
| 3 | **Per-tab sticky filters** — Farms / World / Intel remember sort/filter |
| 4 | **Captcha backoff UI** — edit 5/15/60min; reset after clean hour |
| 5 | **Storage quota alarm** — warn before GM 5MB; offer prune seen/alerted |
| 6 | **Diff-render rows** — less flicker on World / Build / Attack (partial v1.4) |
| 7 | **`tradeReservePct` / `tradeMinBatch`** — wire or expose in Config UI |

---

## 6. Hardening (no ToS escalation)

| # | Feature |
|---|---------|
| 1 | Humanization jitter + soft posts/min ceiling |
| 2 | Captcha trip → editable backoff UI |
| 3 | Storage quota alarm + prune UI |
| 4 | Tighten `@connect` (see C6) |

---

## 7. Out of scope forever

Per ROADMAP / CLAUDE — do not implement:

- Anticaptcha solvers
- Phone-home server / auto-update XPI (`server.py`, `127.0.0.1:35657`)
- Fully unattended auto-dodge / auto-recruit without confirm gates
- Credential exfil or remote code load

Moat = reliability + intel + dry-run validation, not reckless automation.

---

## Top ROI picks (implement next)

If choosing one thing to code:

1. **Intel dossier crash fix (C5)** — small diff, unblocks Intel tab
2. **Evidence dump** — speeds every future TASKS gate
3. **Orch warehouse deadlock** — real overnight econ win
4. **Trade party/unit presets** — completes existing UI promise

---

## Related docs

- `ROADMAP.md` — phase plan and competitor parity table
- `TASKS.md` — in-game validation checklist (current gate order)
- `audit-findings-2026-08-06.md` — detailed bug IDs (C*, I*)
- `CLAUDE.md` — architecture and regression notes
