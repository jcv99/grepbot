# GrepBot audit — compacted + verified 2026-08-06

> **CLOSED (2026-08-07).** C1–C7 and I8–I15 are fixed in `src/` as of v1.5.13+.
> Per-item OPEN/PARTIAL labels below are historical and **must not** drive new
> work. Evidence: [`docs/plans/00-reconciliation.md`](../plans/00-reconciliation.md).
> Archived from `docs/` so the live backlog stays truthful.

Source: critical review + future backlog. **Verified against `src/` @ v1.4.0**
(`python3` static checks + spot Read). Old wave P0–P15 (boot-missing fns,
reinject interval stack, `gameUw` fallback) largely shipped in v1.0–1.4 —
do not re-open unless reintroduced.

Status legend (historical): **OPEN** · **PARTIAL** · **FIXED** · **N/A**.

**Coded in v1.5.0 (2026-08-06):** C1–C7, I8–I15, Incomplete table.
Future § + Major optimizations backlog → see `docs/plans/` (not this file).

Repair order (still valid):  
1 safe defaults + no credential logs → 2 orch migrate → 3 world-isolate →
4 dispose/hooks → 5 dodge queue → 6 parse/trade/wonder/captcha → 7 storage/render.

---

## Critical (reliability / safety)

### C1 Orchestrator starves modules — PARTIAL (v1.4.0)

- **Was:** `priorityOrder` default 6 keys; one feature/20s tick → rural*/recruit/
  merchant/favor/wonder never re-ran after checkbox kick; `CAVE_CHECK_MS` etc unused.
- **Now:** `orchDefaultOrder()` has all 12; tick appends unranked after configured;
  overdue sort + `ORCH_MAX_PER_TICK=3` + adaptive idle cadence (`orchestrate.js`).
- **Still open:** `state.priorityOrder` **load default still 6** (`core.js`);
  stored old lists never migrated. Leftover `*_CHECK_MS` in `cave.js` /
  `trade.js` / `recruit.js` / `wonder.js` unused (dead constants).
- **Fix left:** migrate `PRIORITY_ORDER` → full 12; drop or wire dead cadence consts;
  TASKS gate: Stats scheduler shows every ON feature getting turns.

### C2 Dispose incomplete — OPEN

`__grepbotDispose` clears `gbTimerBag` / `gbListenerBag` / `gbDomObserver` /
panel — **does not restore**:

| Patch | Where | On dispose |
|---|---|---|
| `unsafeWindow.fetch` | `spy.js` `hookFetch` | no orig restore; `_grepbot` flag only skips rewrap |
| `XHR open/send` | `spy.js` `hookXhr` | same |
| `history.pushState/replaceState` | `boot.js` `hookSpaNav` | wrapper keeps remounting **old** panel ref |
| `questMo` | `quests.js` | never disconnected |
| `GM_registerMenuCommand` | `boot.js` | stacks on reinject |
| GM XHR handles | farms/towns/collect/spy | not aborted |

Worst: SPA nav after reinject → dual panels / dual state; old fetch/XHR still
call previous-instance closures.

**Fix:** save originals; restore in dispose; `questMo.disconnect`; abort GM
handles; replaceable global dispatcher for hooks; register drag/resize via
`gbListen` only.

### C3 World state not isolated — OPEN (majority)

`wkey()` used for: csrf, claim/attack/collect/ib templates, farmAction,
farmOptionMap, loyalty, sleepDay, captchaBreakers, decisions/skips.

**Still global** (cross-world leak risk): findings, seen, farms*, towns*,
thresholds, alerted, attackPlan/history, questRewards/history, abTargets,
caveTowns, cityTemplates, townGroups, notes/watchlist, wonderCfg,
nextFarm/Towns scrape, research/recruit targets, priorityOrder, …

**Fix:** prefs global; all id-bearing maps/lists under `wkey()`. Migrate on
`configVer` bump.

### C4 Auto-dodge drops simultaneous attacks — OPEN

`dodge.js`: `dodgeSeen[key]=now` **before** act; single `gbLock('dodge')`.
2nd/3rd incoming marked seen → never retried; no-safe-town / no-units also
permanently skipped until 1h prune.

**Fix:** queue + states `notified|pending|sent|failed`; mark complete only after
send cb; retry failed with backoff.

### C5 `intelDossiers()` throws — OPEN

`intel.js`: key = `f.attacker` object → `"[object Object]"`; no `units:[]` but
`d.units.push` → `TypeError` on first report with units → Intel panel dies.

**Fix:** Map by `id` or `name` string; init `units:[]`, `towns:[]`.

### C6 Diag / `@connect` credentials — PARTIAL

- Diag no longer dumps full csrf/`document.cookie` (footer/preflight: present /
  6-char prefix only) — **FIXED vs review claim**.
- `@connect *` still in `header.js` — **OPEN**; tighten to grepolis + webhook
  host pattern.

### C7 Auto-on without consent — OPEN

`ensureHostDefault` → `enabledHosts[h]=true`; defaults `autoFarm`/`ibAuto`/
`ibResearch`/`questAutoBuild`/`questAutoRes` = **true**.

**Safe defaults:** host OFF; those five OFF; explicit per-world enable.

---

## Important

### I8 `parseReport` too permissive — OPEN

Always returns object (`type:'unknown'`); never `null` though `ingestReport`
expects null. `data.json` string not unwrapped. `outcome: r.outcome || r.win`
loses `win===false` (use `??`). `nameOf` ignores bare string names.

### I9 Trade over-allocates — OPEN

`tradeFillStorageJobs` / `tradeIslandShipJobs`: jobs from original balances;
no deduct of src stock / tradeCap / tgt deficit → multi-job same origin or
multi-origin same tgt overbook. Fill path scales one job to `tradeCap` but
still no mutable ledger across jobs.

### I10 Wonder donations — OPEN

Per-resource `Math.min(..., t.tradeCap || want.X)` → 3× capacity; `tradeCap===0`
falls through to want. Need `wood+stone+iron ≤ tradeCap`. `wonderSpentToday`
memory-only → reload resets daily budget.

### I11 Global captcha lost on reload — OPEN

`captchaGlobalUntil` RAM-only; per-feature breakers persisted. Many
`GM_xmlhttpRequest` paths skip `responseIsCaptcha` → HTML captcha = "bad
endpoint", other modules keep posting.

**Fix:** persist `wkey(CAPTCHA_GLOBAL_UNTIL)`; central captcha check on all HTTP.

### I12 GM XHR no timeout — OPEN

farms/towns/collect/(spy HTTP): no `timeout`/`ontimeout` →
`farmScrapeInFlight` / `collectBgInFlight` can stick forever. No abort on dispose.

### I13 Decision journal order — OPEN

Dedup bumps `r.ts=now` in place (`journal.js`); array order stale →
`jrnPrune` / `gbFailStreak` / `gbRecall` / UI wrong.

**Fix:** splice + push on dedup hit.

### I14 Findings cap ↔ seen churn — OPEN

Trim >500 findings also `delete state.seen[id]` → inbox re-fetch loop.

**Fix:** seen independent of visible findings (`SEEN_MAX` already 2000 — stop
deleting on findings trim).

### I15 HTML injection — OPEN (quests)

`quests.js` row `innerHTML` with `q.title` / `q.questId`. Attack rows mostly
`textContent` now. Use `createElement` + `textContent`.

---

## Incomplete / disconnected

| Item | Status |
|---|---|
| `tradePreset` loaded, never read | OPEN |
| `tradeReservePct` / `tradeMinBatch` used in trade logic but weak/no Config UI | PARTIAL |
| `webhookEvents` queried, no panel edit/save | OPEN |
| `allianceNotes` loaded unused | OPEN |
| Webhook Discord-only payload (comment mentions Telegram) | OPEN |
| `CONFIG_VER` no migrations | OPEN |
| `qolApplyTemplate` assigns targets by reference | OPEN (`ab`/`research`; recruit group path clones) |
| Overview health: `'Health: '+…join() \|\| '(none yet)'` never shows empty | OPEN |

---

## Major optimizations (backlog, not bugs)

- Drop `raw:r` from findings (GM write weight).
- Batch farm save + table render (avoid per-farm full rewrite).
- XHR hook: early URL filter; `{once:true}` where safe.
- `gbTimeout` real cancel (entries linger until dispose).
- Module split already under `src/` — keep concat; add unit tests for
  parseReport, trade plan, orch pick, journal dedup, dodge queue.

Security note: no eval / remote code / hidden exfil seen; traffic = Grepolis +
optional webhook. Reliability blockers = C1–C5, C7, I8–I14.

---

## Future — highest value next

### Reliability / ops

1. Evidence dump (Log → Evidence): last-OK, last-skip, captcha windows, orch
   queue, learned templates — shrink TASKS gate to paste Diag+Evidence.
2. Orch warehouse deadlock: full WH + farm paused + cave/trade idle → force
   trade/cave/rural before farm.
3. Resume-burst serializer: single wake queue (tab focus ≠ farm+ib+bandit+collect
   same second) — audit P6 leftover / main captcha trip vector.
4. Learned-payload health: age + last-success on claimTpl/ibAction/quest/attack;
   invalidate after N hard fails.

### Economy smarts

5. Build-phase planner v2 — resource-aware next building; “next 3” on Build.
6. Farm option auto-teach after loyalty research flips.
7. Island-aware trade graph — refuse freighter-burning cross-island.
8. Culture budget — skip festival if iron needed for cave thresh &lt;N min.

### Military (deferred / HIGH-RISK)

9. Cancel/recall helper (confirm) — lower risk than auto-dodge.
10. Support ETA on Intel threat board.
11. Hero transfer gate after sniff.
12. Harassment presets — confirm-send only.

### Intel moat

13. Attack pattern alerts (same attacker 3×/24h).
14. Offline report catch-up bounded by lastSeenTs.
15. Watchlist “why” (coords / player / alliance).

### UX

16. Per-tab sticky filters + footer last-action chip.
17. Config presets: AFK overnight / Active / War (HIGH-RISK stays OFF).
18. Diff-render World/Build/Attack rows (audit P8 open).

### Hardening (no ToS escalation)

19. Humanization jitter + soft posts/min ceiling.
20. Captcha trip → editable backoff UI; reset after clean hour.
21. Storage quota alarm before GM 5MB; prune seen/alerted with UI.

---

## Old audit waves (v0.6 era) — disposition

| Block | Disposition @ v1.4.0 |
|---|---|
| P0 missing boot fns | FIXED (functions exist) |
| P1 gameUw / bridge contracts | mostly FIXED; sniff still owns live action names |
| P2 stuck InFlight | FIXED → `gbLocks` + TTL sweeper |
| P3 host leaks | PARTIAL — templates/csrf wkey'd; see **C3** |
| P4 reinject interval stack | PARTIAL — timer registry yes; hooks **C2** |
| P5 429/503 | PARTIAL — some GM paths honor Retry-After |
| P6 SPA remount | PARTIAL — hook exists; dispose **C2** |
| P7–P8 UX/perf | PARTIAL — some DONE notes in history; diff-render open |
| P9 races | PARTIAL — locks help; dodge **C4**; resume burst open |
| P10–P14 persistence/parse/captcha/privacy | mix; see **I*** / **C6** |

---

## Verify commands (re-run after fixes)

```sh
# syntax + smoke (skill)
python3 build.py && node --check grepbot.user.js

# claim status smoke (edit expected after each fix)
rg -n "ORCH_MAX_PER_TICK|orchDefaultOrder|priorityOrder:" src/
rg -n "dodgeSeen\[key\]|units\.push|tradeCap \|\| want|wonderSpentToday|captchaGlobalUntil|r\.ts = now|delete state\.seen" src/
rg -n "autoFarm:.*true|enabledHosts\[h\] = true|@connect" src/
```
