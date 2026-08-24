# Phase 8 Audit — 2026-08-24

Re-run of the suspicious-spots list from OPEN-PLAN Phase 8. Source code at v5.10.35.

## 1. `plannerEffect` trade/wonder `+a.wood || 0` coercion

**Verdict: SAFE (no fix).**

The `+a.wood || 0` pattern at planner.js:123, 126, 128 sits next to CLAUDE.md hard rule #2 (`gbNum` over `+x`+`isFinite`). For the trade/wonder branches, `a` is the action payload built by the bot or read from `state.X` — not a wire value. The pattern correctly maps `null`/`''`/`[]`/`'0'`/`0`/`NaN` to `0`, which is what the cost ledger wants. Only difference from `gbNum` is `false → 0` (silent swallow) — a bot cannot construct `false` for an argument, and the planner catches the whole try-block at line 130.

Document, do not refactor: rule applies to WIRE values; planner args are bot-constructed.

## 2. `caveCapacityFromLevel` hardcodes `n*1000`, level 10 = unlimited

**Verdict: CORRECT (verify on es146).**

Source comment at cave.js:18 cites the Grepolis rule. The `-1` unlimited sentinel lives at cave.js:20. Reads through `caveTownInfo` → `caveScan` → `emergencyScan`. No client-side validation needed — the game enforces; the helper is a local cache.

Verify with live `GameDataBuildings.hide` on es146: levels 1-9 should report 1000-9000, level 10 should report `-1`. Smoke driver can probe this without going in-game.

## 3. `parseTimerMinutes` only matches `Nmin` / `Nh` / `Nh Nmin`

**Verdict: KNOWN LIMIT (verify on es market strings).**

Pattern at collect.js:8-16. Audit asks for confirmation that the game emits these exact shapes. The collector walks for `/^\d{1,2}\s*min$/` (collect.js) — any other shape silently returns `null` and the resource tile is skipped.

Known unknown: whether Grepolis ever emits `1h30m`, `01:30`, `90 min`, `2 horas`. If a non-conforming tile shows up, the bot can't see the timer. The `Recoger` button text fallback in `collect.js` would still trigger the scan, but the per-tile wait time would be unknown.

## 4. `farmSnapDuration` 20% tolerance

**Verdict: SAFE (no overlap).**

FARM_DURATIONS values are discrete. 20% tolerance on each:
- 28800s (8h): 23040 - 34560
- 14400s (4h): 11520 - 17280
- 7200s (2h): 5760 - 8640
- 3600s (1h): 2880 - 4320 (note: 4320 > 8640? No, 4320 < 5760, so 3600's upper bound 4320 < 7200's lower bound 5760 — no overlap)
- 1800s (30m): 1440 - 2160
- 600s (10m): 480 - 720

Adjacent pairs do not overlap (3600 upper 4320 < 7200 lower 5760). A stale `lootable_at` read lands in at most one bucket. No fix needed.

## 5. `updateStatus` builds `JSON.stringify` tooltip every 5s

**Verdict: ACCEPTABLE (no fix).**

5s cadence + small payload + string output to DOM textContent. `JSON.stringify` on a per-town cost dict (~200 bytes) is sub-millisecond. Stat span is 1h/24h/7d; rolling aggregates are already cached. Move on.

## 6. Silent `catch (_) {}` inside write-adjacent paths

**Verdict: PARTIAL (sweep deferred).**

grep found 207 catch sites; ~49 are gbLogT-logging, ~158 are silent. The OPEN-PLAN 2.11 helper reduces the silent set when callers opt in (`gbTry(fn, fallback, '')`). Full sweep is its own PR (covered by OPEN-PLAN 2.11 migration batch).

Specific concern: any silent catch on a path that should bump `jrnFailStreak` (e.g. a failed `bridgePost`) would mask a hard error. None of the silent catches I sampled wrap `bridgePost` or `gameAjaxPost` — those throw explicitly. Safe in practice today; document the invariant.

## 7. Every `gbInterval` callback in loop registry after Phase 5.6

**Verdict: N/A (Phase 5 deferred).**

Phase 5.6 (loop registry from OPEN-PLAN) is gated on user go-ahead for the structural rewrite. Until it lands, the inline `gbInterval(...)` calls in boot.js are the registry.

## Summary

- 4 verdicts: SAFE / SAFE / known-limit / SAFE
- 1 verdict: ACCEPTABLE
- 1 verdict: PARTIAL (deferred to 2.11 migration batch)
- 1 verdict: N/A (Phase 5 gate)

No new bugs found in this sweep.
