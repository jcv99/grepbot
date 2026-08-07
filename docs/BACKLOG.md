# GrepBot feature backlog

Ideas for what to add or finish next. Phases 0–15 are **coded**; `TASKS.md` tracks
**in-game validation**. This file prioritizes gaps, reliability fixes, smarts, and
UX — not raw feature count.

Last reviewed: 2026-08-07 (against `src/` @ v1.5.14 + `docs/plans/`).

**Implementation plans:** one file per open item under [`docs/plans/`](plans/README.md).
Do not plan off the stale audit tables — see [`plans/00-reconciliation.md`](plans/00-reconciliation.md).

---

## Suggested order

```text
00 reconciliation (docs)
    ↓
04 evidence dump
    ↓
03 · 09 · 07 · 12  (small, isolated)
    ↓
05 · 10 · 11       (reliability / overnight)
    ↓
08 · 01 · 06       (culture/cave → trade presets → build planner)
    ↓
13 · 14 · 15       (military / intel)
    ↓
17 → 19 → 18 → 20 → 21 → 16 → 22  (UX + hardening)
    ↓
02 wonder favor cast (WW worlds only — last)
    ↓
HIGH-RISK 8.12/8.13 only after payload sniff matches UI
```

---

## 1. Finish what's stubbed or deferred

Already in the tree but incomplete. Plans: `01`, `02`, `03`.

| Gap | Why it matters | Risk | Plan |
|-----|----------------|------|------|
| **Trade presets `party` / `unit`** | UI shows "unimplemented"; only fill-storage works (`trade.js`) | Med | 01 |
| **Wonder favor cast** (ROADMAP 11.4) | WW worlds only; deferred | Med | 02 |
| **Alliance notes UI** | `intelSetAllianceNote` has no panel caller | Low | 03 |

Done elsewhere (do not re-open): Telegram webhooks, `webhookEvents` Config wiring,
`tradePreset` read path, `tradeReservePct` / `tradeMinBatch` Config UI.

---

## 2. Reliability fixes (audit backlog)

**C1–C7, I8–I15 fixed as of v1.5.13** — see
[`docs/plans/00-reconciliation.md`](plans/00-reconciliation.md).
Historical write-up:
[`docs/archive-audits/audit-findings-2026-08-06.md`](archive-audits/audit-findings-2026-08-06.md)
(CLOSED; per-item OPEN labels are stale).

### Ops tooling

- **Evidence dump** (Log → Evidence): last-OK, last-skip, captcha windows, orch
  queue, learned templates — shrink TASKS gates to paste Diag+Evidence. Plan **04**.

---

## 3. Economy smarts

Highest "new value" without HIGH-RISK toggles. Bridge-first + preconditions.
Plans **05–11**.

| # | Feature | Notes | Plan |
|---|---------|-------|------|
| 1 | **Warehouse deadlock resolver** | Full WH + farm paused → orch forces cave → trade → rural before farm | 05 |
| 2 | **Build-phase planner v2** | Resource-aware next building + "next 3" on Build tab | 06 |
| 3 | **Island-aware trade graph** | Refuse freighter-burning cross-island hops | 07 |
| 4 | **Culture ↔ cave coordination** | Skip festival if iron needed for cave threshold soon | 08 |
| 5 | **Farm option auto-teach** | When loyalty research completes, auto-learn 10min option | 09 |
| 6 | **Resume-burst serializer** | Tab focus wake ≠ farm+ib+bandit+collect same second | 10 |
| 7 | **Learned-payload health** | Age + last-success on claimTpl/ibAction/attack; invalidate after N hard fails | 11 |

---

## 4. Military / intel

Mostly coded in v1.0 spine; validation + small adds. Plans **12–15**, **02**.

| Item | Status | Notes | Plan |
|------|--------|-------|------|
| Cancel/recall helper | CODED (`military.js`) | Validate v1.5.9 TASKS; dry-run first | — |
| Hero transfer | CODED (Attack tab) | Confirm + sniff `heroTpl` | — |
| Harassment presets | CODED (Attack tab chips) | Confirm-send only | — |
| **Support ETA on threat board** | BACKLOG | "lands in 4h12m" on incoming rows | 12 |
| **Attack pattern alerts** | BACKLOG | Same attacker 3×/24h → webhook | 13 |
| **Offline report catch-up** | BACKLOG | Bounded by `lastSeenTs` | 14 |
| **Watchlist "why"** | BACKLOG | Show match reason (player / coords / alliance) | 15 |
| Wonder favor cast (11.4) | DEFERRED | WW worlds only | 02 |

HIGH-RISK: auto-dodge (8.12), auto-recruit (8.13) — payload sniff + dry-run before enable.

---

## 5. UX

Plans **16–21**. (`tradeReservePct` / `tradeMinBatch` already wired — dropped.)

| # | Feature | Plan |
|---|---------|------|
| 1 | **Config presets**: AFK overnight / Active farming / War (HIGH-RISK OFF in all) | 16 |
| 2 | **Footer last-action chip** — e.g. `farm: claim OK 12s ago` | 17 |
| 3 | **Per-tab sticky filters** — Farms / World / Intel remember sort/filter | 18 |
| 4 | **Captcha backoff UI** — edit 5/15/60min; reset after clean hour | 19 |
| 5 | **Storage quota alarm** — warn before GM 5MB; offer prune seen/alerted | 20 |
| 6 | **Diff-render rows** — less flicker on World / Build / Attack (partial v1.4) | 21 |

---

## 6. Hardening (no ToS escalation)

| # | Feature | Plan |
|---|---------|------|
| 1 | Humanization jitter + soft posts/min ceiling | 22 |
| 2 | Captcha trip → editable backoff UI | 19 (same as §5.4) |
| 3 | Storage quota alarm + prune UI | 20 (same as §5.5) |
| 4 | Tighten `@connect` | **DONE** (C6) |

---

## 6b. v1.6 user requests (CODED, validation open)

| # | Feature | Notes | Plan |
|---|---------|-------|------|
| 1 | **Custom per-town build queue** | Ordered list beats the heuristic; strict order by default | 23 |
| 2 | **Instant build precision** | Timer armed at doneAt-5min; per-town order queues (all towns) | 24 |
| 3 | **Phoenician ratio pump** | 5×1-unit trades lift 0.5:1 to 1:1, then bulk. Default OFF, offer parser unconfirmed | 25 |

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

1. **Evidence dump** — speeds every future TASKS gate (plan 04)
2. **Orch warehouse deadlock** — real overnight econ win (plan 05)
3. **Trade party/unit presets** — completes existing UI promise (plan 01)

---

## Related docs

- `plans/README.md` — per-feature implementation plans (source of truth for open work)
- `ROADMAP.md` — phase plan and competitor parity table
- `TASKS.md` — in-game validation checklist (current gate order)
- `archive-audits/` — historical audits (CLOSED / stale; do not re-implement from them)
- `CLAUDE.md` — architecture and regression notes
