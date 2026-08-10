# GrepBot improvement plans

One file per feature, derived from `docs/BACKLOG.md`.

**Baseline:** `src/` @ `@version 1.5.19` — backlog plans 00–22 **CODED**
(2026-08-07). In-game TASKS.md gates remain user-owned.

> Every plan below was checked against the actual tree before being written.
> `BACKLOG.md` and `audit-findings-2026-08-06.md` are **stale** on section 2 —
> see `00-reconciliation.md`. Do not start from the backlog table alone.

---

## Status of the backlog

| Backlog section | Items | Open | Already done |
|---|---|---|---|
| 1. Stubbed / deferred | 5 | 0 | 5 (02 default OFF) |
| 2. Reliability (C1–C7, I9–I15) | 14 | **0** | 14 |
| 2b. Ops tooling (evidence dump) | 1 | 0 | 1 |
| 3. Economy smarts | 7 | 0 | 7 |
| 4. Military / intel | 4 | 0 | 4 |
| 5. UX | 7 | 0 | 7 (sticky/diff partial) |
| 6. Hardening | 4 | 0 | 4 |

**All 14 audit bug IDs in §2 are fixed in the current tree** (15 including I8,
which only the audit file lists). Section 2 needs no work; it needs deleting from
the backlog.

Section 6 overlaps section 5 by design: its captcha-backoff, quota and
`@connect` rows are plans 19, 20 and C6 respectively — only C6 is done.

---

## Plans

### Complete what is stubbed
| # | Plan | Risk | Size |
|---|---|---|---|
| 01 | [Trade `party` / `unit` presets](01-trade-party-unit-presets.md) | Med | M |
| 02 | [Wonder favor cast](02-wonder-favor-cast.md) | Med | M |
| 03 | [Alliance notes UI](03-alliance-notes-ui.md) | Low | S |

### Ops tooling
| # | Plan | Risk | Size |
|---|---|---|---|
| 04 | [Evidence dump](04-evidence-dump.md) | Low | M |

### Economy smarts
| # | Plan | Risk | Size |
|---|---|---|---|
| 05 | [Warehouse deadlock resolver](05-warehouse-deadlock-resolver.md) | Med | M |
| 06 | [Build-phase planner v2](06-build-planner-v2.md) | Low | L |
| 07 | [Island-aware trade graph](07-island-aware-trade-graph.md) | Low | S |
| 08 | [Culture ↔ cave coordination](08-culture-cave-coordination.md) | Low | S |
| 09 | [Farm option auto-teach](09-farm-option-auto-teach.md) | Low | S |
| 10 | [Resume-burst serializer](10-resume-burst-serializer.md) | Low | M |
| 11 | [Learned-payload health](11-learned-payload-health.md) | Low | M |

### Military / intel
| # | Plan | Risk | Size |
|---|---|---|---|
| 12 | [Support ETA on threat board](12-support-eta-threat-board.md) | Low | S |
| 13 | [Attack pattern alerts](13-attack-pattern-alerts.md) | Low | S |
| 14 | [Offline report catch-up](14-offline-report-catchup.md) | Low | M |
| 15 | [Watchlist "why"](15-watchlist-why.md) | Low | S |

### UX
| # | Plan | Risk | Size |
|---|---|---|---|
| 16 | [Config presets](16-config-presets.md) | Med | M |
| 17 | [Footer last-action chip](17-footer-last-action-chip.md) | Low | S |
| 18 | [Per-tab sticky filters](18-per-tab-sticky-filters.md) | Low | M |
| 19 | [Captcha backoff UI](19-captcha-backoff-ui.md) | Low | S |
| 20 | [Storage quota alarm](20-storage-quota-alarm.md) | Low | M |
| 21 | [Diff-render remaining tabs](21-diff-render-rows.md) | Low | M |

### Hardening
| # | Plan | Risk | Size |
|---|---|---|---|
| 22 | [Humanization jitter + posts/min ceiling](22-humanization-ceiling.md) | Low | M |

### v1.6 user requests (CODED)
| # | Plan | Risk | Size |
|---|---|---|---|
| 23 | [Custom per-town build queue](23-custom-build-queue.md) | Low | M |
| 24 | [Instant build precision + all towns](24-instant-build-precision.md) | Low | M |
| 25 | [Phoenician salesman ratio pump](25-phoenician-ratio-pump.md) | Med | L |

### v3.x sweep (CODED - see commit log v3.0.0..v3.8.2)
| # | Plan | Risk | Size |
|---|---|---|---|
| 26 | [Improvement sweep](26-improvement-sweep-2026-08-10.md) | Low | L |

### v4 candidates (NOT the next plan of record - future sweep)
| # | Plan | Risk | Size |
|---|---|---|---|
| 27 | [User-wishlist sweep](27-v4-wishlist-2026-08-10.md) | varies | XL |

When the v3.x sweep + TASKS gates land, plan 27 splits into 4-5
narrower plans (one per risk bucket, per plan 27 §12). Do not start
from plan 27 alone.

---

## Recommended order

```text
00 reconciliation (delete dead backlog section 2)
    ↓
04 evidence dump  ──────────────► speeds every TASKS gate below
    ↓
03 alliance notes UI · 09 farm auto-teach · 07 island trade · 12 support ETA
   (small, isolated, no new post surface)
    ↓
05 warehouse deadlock · 10 resume-burst · 11 payload health
   (reliability; real overnight econ win)
    ↓
01 trade presets · 06 build planner v2 · 08 culture/cave
    ↓
16–21 UX · 22 hardening
    ↓
02 wonder favor cast (WW worlds only — defer unless on a WW world)
```

## Conventions every plan follows

- **Bridge-first.** `bridgePost` / `gameAjaxPost`; DOM only as fallback, and DOM
  side effects must route through `gbDomClick` so dry-run covers them.
- **Precondition invariant.** A check may only block on a value it actually
  read. Unreadable getter ⇒ `blind` ⇒ log once via `gbLogT`, let the server
  decide. Never a silent dead guard. (`gbAfford`, `gbProbeNum`, `CLAUDE.md`.)
- **No new `*InFlight` booleans.** Use `gbLock`/`gbUnlock` + a `GB_LOCK_TTL` entry.
- **No new schedulers.** Econ features get a cadence in `orchestrate.js`, not
  their own `gbInterval`.
- **World-scope id-bearing storage** via `WORLD_SCOPED_BASES` (`core.js:132`).
- **Every plan ships with a dry-run gate** before any live post.
- Bump `@version` in `src/header.js`, run `python3 build.py`, paste into
  Tampermonkey. Never start a local server.
