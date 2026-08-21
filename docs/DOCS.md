through `redactFindingsExport` (or equivalent)
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
`renderFarms` / `renderAttack` for canonical pattern.

---

## 9. Render runs while tab hidden — MEDIUM

`sec.hidden` guard present in `renderBuild` / `renderStats` /
`renderIntel` / `renderOverview` / `renderAttack` but missing on
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
`dodgeScan`, `orchTick`) schedulers — features they call expected
to take own locks. Not missing-lock bug by itself.

Rule: every feature path that posts must `gbLock(name)` + TTL entry in
`GB_LOCK_TTL`.

---

## 11. `gbTimerBag` leak / raw `clearTimeout` — MEDIUM

Bypassing timer registry grows entry per run; eventually bag
dominates memory and timeouts can't cancel on dispose.

- `build-tab.js:249` — `clearTimeout(watchdog)` bypasses bag removal (watchdog `gbTimeout`)
- `build-tab.js:642` — same, `abScan` watchdog
- `ui.js:1288` — `farmsInputTimer` cleared with raw `clearTimeout` (created via `gbTimeout`)
- `bandit.js:245` — `banditClearLoop` raw `clearTimeout(banditLoopTimer)`
- `attack.js:380` — armed timers cleared with raw `clearTimeout`

Rule: `gbTimeout` / bag-aware clear exclusively; never raw
`clearTimeout` on ids from `gbTimeout`.

---

## 12. Defense / target-type filter bypassed — MEDIUM

Hostile-only canonical types; town-only attack targets. Bypassing
either opens wrong-target posts.

- `military.js:60` — synthesizes `{town_id, kind:'town'}` without `resolveTarget`
- `favor.js:73-122` — `targetType` defaults to `farm_town`, then posts Town
  `sendUnits` with that id (bypasses `attackSendAllowed`, which refuses farm_town)
- `dodge.js:70-71` — own-origin filter; later `!a.incoming` check mostly unreachable
  after `is_attack` short-circuit
- `recruit.js:17-18` — unconditional `building_barracks` fallback for land units
  missing god/myth/naval flags (intentional default, but wrong for odd clients)

Rule: route every attack/support/dodge through `resolveTarget` or
explicit type guard (`is_attack`, `kind:'town'`, controller name).

---

## 13. PRECONDITION gaps on bridge posts — MEDIUM

Cost / capacity / queue / building level not read before posting.
Burns request budget slot on guaranteed rejection.

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
inside user-triggered diag dump.

---

## 15. Magic constants / falsy-fallback traps — MEDIUM

`|| default` swallows legitimate `0` / `''` / cleared values. Hardcoded
numbers ignore user settings.

- `research.js:177` — `queueMax = 2` hardcoded (no `researchQueueMax` setting)
- `build-tab.js:8` — `state.ibFreeThresh || 300` (0 / NaN → 300)
- `ui.js:1110` — `saveNum` passes `+e.target.value` with no NaN guard
- `ui.js:1233` — `telegramChatId || undefined` drops cleared value
- `ui.js:978-989` — `configBound` re-sync path only refreshes subset of controls; rest keep stale DOM
- `core.js:322-324` — `ibAction` / `farmOptionMap` `|| '<default>'` falsy-string reset
- ~~`core.js:313` — `STORE.FARM_ACTION` legacy `wkey` fallback~~ **CORRECTED 2026-08-10**:
  no fallback exists. `farmAction` loads plainly (`core.js:233`) and
  `STORE.FARM_ACTION` **is** in `WORLD_SCOPED_BASES` (`header.js:189`), so
  `load`/`save` apply `wkey()` themselves; explicit `wkey()` in
  `learnFarmAction` (`farms.js:624`) belt-and-braces. `core.js:313` is
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
- `spy.js:99` — bare `id` keys queued as report ids when URL reportish
- `spy.js:129-131` — `queueReportList()` takes no params; callers pass hint URL that discarded
- `ui.js:908-918` — findings Copy uses clipboard only (OK); Export blob paths if added need revoke
- `ui.js:1296-1327` — drag + resize bind `document` mousemove/mouseup for session
- `qol.js:6-7` — `document` mousemove (activity pause) unthrottled
- `ui.js:897-903` — `#gb-ab-now` forces `abAuto=true` and leaves it on (comment acknowledges)

Rule: every `addEventListener` needs off-switch (`gbListen`); blob URLs
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

Gate that catches name collisions in concat misses some declaration
shapes. New module using these forms bypasses gate.

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

- `parse-inline.js:2` — header says "pure, node-runnable, no GM/DOM" but `pickNum` defined in `farms.js:651`
- `parse-inline.js:57-64` — `serverTs` accepts any positive number; `Date.parse` no upper bound
- `parse-inline.js:76-77` — `r.defender?.x ?? r.x` may take defender **player** coords as town coords
- `parse-inline.js:102` — `line.startsWith(id)` false for some pipe forms; falls back to whole line
- `parse-inline.js:108` — skip Set holds literal `"null null"` / `"null,null"` when x/y null
- `parse-inline.js:140` — inner JSON.parse catch returns outer `data` instead of signalling failure

Rule: enforce self-contained claim; bind `pickNum` locally; reject
non-numeric / out-of-range timestamps.

---

## 20. JSON / state save unconditional full-write — LOW

Every cadence rewrites whole key, even when value identical.
`migrateConfig` re-writes every `WORLD_SCOPED_BASES` key on v1→v2.

- `towns.js:154` — `save(STORE.TOWNS, state.towns)` even when identical
- `core.js:422-442` — `migrateConfig` bumps `configVer` and re-saves every scoped base once

Rule: shallow-compare before save; migrations idempotent (only write
when current `state.configVer` differs).

---

## 21. Stats / preflight probes can't fail — LOW

`ok` predicate tautological. Diag reports green when probe broken.

- `stats.js:18` — `ok: r.ok !== false` (probe that forgets to return `ok` → pass)
- `stats.js:25-26` — `gameUw()` / `gameBridgeStatus()` outside any probe (throw aborts whole preflight)
- `stats.js:114` — `RESEARCH_CS_FAST[0]` indexed with no length check
- `stats.js:120` — `ok: blind < 5` (passes with 4 of 5 cost tables unreadable)
- `stats.js:131` / `152` / `168` — `ok: true` hardcoded (cancel / incoming / scheduler never fail)
- `stats.js:157` — `ok: n >= 0` tautology (quests probe can never fail)

Rule: every probe must have falsy default (`ok: false`); explicit
checks for each truth condition.

---

## 22. Inline jtag inconsistent across bridge paths — LOW

`bridgePost` uses `jrnTag()`; `gameAjaxPost` constructs `jtag` inline
with different shape. Stats rollups split across transports.

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
fetches scheduled earlier outlive mid-iteration pause flip.

- `towns.js:168` — host/paused re-check inside forEach after parent path
- `towns.js:155` — HTTP fallback only when `state.towns` already empty
- `bandit.js:125-131` — offense filter deletes units while iterating `Object.keys` snapshot (OK for keys;
  mutating `units` mid-loop intentional but easy to misread)

Rule: snapshot decision state at start of iteration; re-check only on
result, not mid-iteration.

---

## 24. Orphans / dead / fragile paths — LOW

- ~~`core.js:313` — `STORE.FARM_ACTION` legacy fallback~~ — **stale, see #15**: that
  fallback does not exist in tree
- `spy.js:13-15` — no-op `_grepbot` re-bind branch
- `build-tab.js:213-221` — `finishInstantly` fallback never calls `ibLearnAction`
- Pattern #9 / #8 overlap: hidden-tab + thrash often co-occur on same renderers

---

## Cross-cutting rules (consolidated)

1. **Every feature-catch must `gbLog`.** Pattern #1.
2. **Call sites bail on `automationPaused` early; never bypass `bridgePost`/`gameAjaxPost`.** Pattern #2.
3. **Irreversible posts reconcile inside callback.** Patterns #3, #5.
4. **Blind probe `{blind:true}` + `gbLogT` once, defer to server (never fabricate 0/false).** Pattern #4.
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
... (repeats ~every 1–3 s for whole skip window)
```

`done` never moves past `0/1`; nothing completed; bot hammers single
free order with zero progress.

## Root cause

Two stacked bugs surface as one symptom.

### 1. Original 3 hard failures opened `decisionSkips` window (legitimate)

`bridgePost` (src/core.js:1329) records every exit into decision journal
(src/journal.js:96 `jrnPush`). Key from `jrnTag` (src/journal.js:50):

```
feature | action                        | target
build   | BuildingOrder/completeInstant | <town_id>
```

**Target is town, not order.** `arguments.order_id` not one of
ids `jrnTag` prefers (`building_id` / `research_id` / `farm_town_id` /
`offer_id` / `power_id` / `id`), so falls through to `payload.town_id`. One
hard failure on one order therefore silences **every** free order of that town,
and model keeps reporting all of them as free.

After **3 consecutive `jrnHard` results** (any result that is not `ok`,
`timeout`, `captcha`, or `skip:*`) `jrnNote` (src/journal.js:164) writes
`state.decisionSkips[key]` entry with 5/15/60 min backoff and bot logs
`memory: build … failed 3x (<err>) - skipping Nm`.

Most likely triggers for `completeInstant` posts on live world right now:

- Client renamed action. Server returns `unknown action` / `invalid action`.
  `ibComplete` falls back to `finishInstantly` once (src/build-tab.js:250); if
  client also rejected that, two `err` calls in row for same
  order, which trips window after next scan.
- Post hit `data.error` from `classify` (src/core.js:1395). Anything not captcha/timeout becomes hard err.
- Post blocked by template-health gate (`bail('tpl-stale')`,
  src/core.js:1349). `tpl-stale` **not** in `JRN_SKIP_ERRS`, so `jrnResult`
  returned it verbatim and `jrnHard` counted it: invalidated `ibAction` also
  opened `decisionSkips` window, two independent blocks from one root
  cause, one of which outlives 30 min `TPL_HEALTH_STALE_MS` self-heal.

Not trigger, contrary to earlier draft of this doc: `resolve('unknown')`
(src/build-tab.js, timeout branch) is *promise* value of `ibComplete`, not a
journal result. Journal saw `timeout`, and `jrnHard` (src/journal.js:44)
excludes `timeout`, `captcha`, `ok` and `skip:*`.

Once window opens, **every** subsequent `bridgePost` for that exact key
short-circuits at `jrnSkipped(jtag)` (src/core.js:1341) with `err =
'remembered'`, logged by `ibComplete` (src/build-tab.js:261) as:

```
instant-build complete error: remembered
```

### 2. Bot never backs off when posts short-circuited

`ibCompleteAll` (src/build-tab.js:274) chains `ibComplete` calls with
`gbTimeout(next, 400 + Math.random() * 200)` and, when batch ends, fires
`gbTimeout(ibScan, 3000)` (src/build-tab.js:290) **unconditionally** — even when
`done === 0` and every result was `remembered` skip. Combined with boot loop:

- `gbInterval(scan, IB_CHECK_MS)` every 10 s (src/boot.js:113)
- `ibArmNext` re-arming on next visible countdown (src/build-tab.js:310)
- `visibilitychange` / `pageshow` re-running `ibScan` (src/boot.js:70, 80)
- build-button click hook (src/boot.js:103)

…bot restarts `ibScan` ~every 1–3 s. Each scan re-detects same free
order (model still says `gold===0 && timeLeft<=thresh`), calls
`ibCompleteAll`, every call short-circuits at `jrnSkipped`, `done` stays `0`,
and cycle restarts.

Order genuinely still free in model because server never
actually completed it — bot's posts rejected, so building clock
keeps running and model keeps reporting `isFree: true` until either
real countdown hits 0 or user completes it by hand.

### Why this looks spammy even when bot "doing the right thing"

- `bridgePost` already uses `gbLogT('mem-skip-<key>', 60000)` (src/core.js:1342)
  so skip reason itself throttled. But `ibComplete` then receives
  `err='remembered'` from its callback and logs un-throttled line
  `instant-build complete error: remembered` (src/build-tab.js:261).
- `instant: completed 0/1` fires every batch (src/build-tab.js:288) with no
  throttle and no differentiation between "0 because everything was real
  error" and "0 because everything was skip".

So during entire 5–60 min backoff, user sees wall of identical
`complete error: remembered` lines.

## Solution (shipped v1.6.6)

Five changes. None touch bridge contract or captcha breaker.

### A. Don't re-arm `ibScan` 3 s after batch that completed nothing

`ibCompleteAll` fired `gbTimeout(ibScan, 3000)` unconditionally. Now gated
on `done > 0`, and batch line throttled:

```js
gbLogT('ib-batch-done', 60000,
  `instant: completed ${done}/${free.length}${captcha ? ' (captcha abort)' : ''}`);
if (done) { flash(`instantánea x${done}`); gbTimeout(ibScan, 3000); }
```

10 s `IB_CHECK_MS` interval (src/boot.js:113) is recovery path; 3 s
accelerator only earns keep when something actually moved.

### B. Skip remembered orders in `ibScan`, before batch announced

This is the change that actually stops the loop. A/B/C only quiet it: scan
still walked batch to have every post short-circuit at `jrnSkipped`. New
journal helper (src/journal.js), plus `ibJrnPayload(order)` in build-tab so
scan can key on same tag without posting:

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
`ibActionFor`, `arguments.order_id`, `town_id`) — keep two in sync, or
pre-check silently stops matching window it meant to read.

### C. Throttle callback logs in `ibComplete`

`remembered` gets `gbLogT('ib-remembered-<order>', 60000)`. Pure local gates
(`tpl-stale`, `budget`, `disabled`, `dryrun`) resolve `'skip'` rather than
`'err'` and log under `gbLogT('ib-gate-<err>', 60000)` — nothing posted, so
not evidence about payload. Reconciliation via `goneOk()` runs
first on `captcha` / `timeout` / `remembered` / `paused`; on synchronous
bail paths cheap no-op, on async ones converts real completion
into `'ok'`.

### D. `tpl-stale` is skip, not hard failure

src/journal.js, `JRN_SKIP_ERRS` now includes `'tpl-stale'`. Local gate,
so must not feed `gbFailStreak` — otherwise invalidated template opened
second, longer block (up to 60 min) on top of 30 min template window it came
from.

### E. Re-learn `ibAction` when both free actions rejected

`ibResetLearnedAction(kind, err)` fires only from `finishInstantly` fallback
path and only for `ibUnknownActionErr(err)`: clears `state.ibAction` /
`state.ibActionR` and persists `null`, so `ibActionFor` falls back to constant
`'completeInstant'` on next scan. Side effect worth knowing:
`tplHealthOk` returns `true` when `state[name]` empty (src/core.js:721), so
clearing learned name also lifts `tpl-stale` gate.

## Immediate user-side workaround

While fix not built, recover without reload:

1. Open panel **Log** tab → **Decisiones** sub-view.
2. Filter for `build` → look at most recent record. Confirm `r` is
   same hard error three times (trip that opened window).
3. Click **Limpiar saltos** (src/ui.js:806) to clear every active skip window.
4. If original failures `unknown action`, **hand-click free
   complete in game UI once** so `ibLearnAction` (src/build-tab.js:192)
   sniffs new action name from request body and persists it.
5. Toggle `autoBuild`/`state.ibAuto` off and on (or run `ibScan` once via panel)
   to restart loop.

If same loop comes back within seconds, learned `ibAction` still
wrong — clear from panel, hand-click, retry. Or set
`state.decisionMemory = false` (Config → "Memoria de decisiones") to suppress
skip window while validating new action name in dry run with
`state.dryRun = true`.

## Recovery behaviour after v1.6.6

- `jrnSkipped` (src/journal.js) returns `false` when window expires and
  decrements `trips` once, so after 5 min town retried.
- If action still rejected, 3 more hard fails re-trip window — but no
  longer *within one batch*: scan now drops remembered orders (B) and does
  not self-re-arm at 3 s (A), so decisions accumulate at 10 s interval, not
  at 1–3 s.
- 5/15/60 min ladder still caps at 60 min. What changed: unknown-action
  root cause now self-heals (E) instead of pinning town for hour per retry.

## Related

- `docs/ROADMAP.md` — Phase 8.5 instant build + research.
- `docs/TASKS.md` — gate 8.5: validate free-complete post end-to-end on
  `es146` before relying on auto.
- `docs/error-patterns.md` — post-v1.6.6 shape of this bug in panel log
  is single throttled `instant: #<id> skipped from memory (<err>, Nm left)`
  per minute, not wall of `complete error: remembered`.

---

## plan-academy-queue.md

# Plan — academy ("universidad"/Investigación) research queue: does not appear, does not work

**Status: coded v2.9.0.** Steps 1–7 implemented except C1/C2/C3
*selection* in step 0, which still needs live DOM read. Rather than block on
it, v2.9.0 ships defensive superset of all three (see *Implementation notes*
at bottom) — each candidate handled by read that fails closed, so
console snippet now **diagnostic**, not gate. Step 8 in-game validation
with Dry run ON still outstanding.

Symptom (user, live world): research queue neither **appears** (no `[+]`
controls in Academy window, no `Cola GrepBot · Investigación` panel) nor
**works** (nothing ever posted from FIFO lane).

Shipped v2.8.1 (`567f00b`), never validated in-game. Repo clean at v2.8.2.

## Evidence already gathered (from `archive/captures/grepo-dump/js/game.min.js`)

- Academy tech tree click handler: `this.$el.off(e).on(e,".btn_upgrade, .btn_downgrade", function(e){ e=$(e.currentTarget).data("research_id"); this.controller.onBtnClick(e) })`.
  Game's own user-guide selector `.tech_tree_box .button_upgrade[data-research_id=X]`.
  Two different class names (`btn_upgrade` vs `button_upgrade`) in play.
- Template data passed per tech: `{research_id:e, column_number:p, is_researched:f, in_progress:g, ...}`.
- Research start is **frontend_bridge** call, not legacy controller:
  `GameModels.ResearchOrder` (`urlRoot:"ResearchOrder"`) has
  `research:function(e){this.execute("research",{id:this.getType()},e)}` and
  `GrepoApiHelper.execute` = `gpAjax.ajaxPost('frontend_bridge','execute',{model_url,action_name,captcha:null,arguments})`.
  GrepBot posts `gameAjaxPost('research','building_academy','research',{id,town_id})` instead.
- Available research points in this client:
  `getAvailableResearchPoints: function(){ return this.getCurrentResearchPoints() - this.getSpentResearchPoints() }`.
  GrepBot's `researchPointsAvailable` probes `getAvailableResearchPoints` /
  `getFreeResearchPoints` / `getResearchPoints` on **town model**, then
  `researches().attributes` keys. Those getters live on academy
  *controller*, not town.
- Town proxy DOES expose `researches()` (`this.researches=function(){return this.getResearches()}`)
  and `getBuildings()`. So `info.techs` / `info.academy` readable.
- Town proxy does NOT expose `getResearchOrdersCollection` (0 hits in dump).
  Research orders live in MM collection registered by `model_class`
  `"ResearchOrder"`, backed by `TownAgnosticCollection` with
  `segmentation_key:"town_id"`. `MM.getOnlyCollectionByName` returns `i[0]`.

## Hypotheses, ranked

### "Does not work" (posting path) — VERIFIED against dump

- **H1 — CONFIRMED. Primary "does not work" root cause.**
  `researchPointsAvailable` (`src/research.js:73`) probes
  `getAvailableResearchPoints` / `getFreeResearchPoints` / `getResearchPoints` on
  **town proxy**. All three absent there: `getAvailableResearchPoints`
  exists exactly once in dump, on `GameControllers.AcademyBaseController`
  (`getCurrentResearchPoints() - getSpentResearchPoints()`); other two have
  0 hits. `researches().attributes` fallback cannot help either — that model
  `urlRoot:"Researches"` with `hasResearch(e){return !0===this.get(e)}`, i.e.
  attributes `{<tech>: bool}` only; `research_points` never appears on any
  model (all 17 hits `GameData.researches[x].research_points`).
  ⇒ returns `null` always ⇒ `researchCanAfford` returns
  `{ok:false, why:'available research points unreadable'}` for every tech in
  every town, forever. Nothing ever posted.
  **Correction to original plan:** `researchPointCost` FINE —
  `research_points` real GameData property. Only *available* side broken.
  Real formula to port:
  `current = academyLevel * Game.constants.academy.points_per_academy_level + (library===1 ? points_per_library_level : 0)`
  (capture: `points_per_academy_level:4`, `points_per_library_level:12`; minus
  one academy level while academy tearing down), and
  `spent = Σ research_points over techs where hasResearch(t) || isResearchInQueue(t)`.
- **H2 — REFUTED. Not live blocker; do not treat as fix.**
  Real entry shape (verbatim from saved page):
  `"berth":{"id":"berth","research_dependencies":[],"building_dependencies":{"academy":22},"requires_farming_villages":false,"resources":{"wood":8900,"stone":5200,"iron":7800},"required_time":13500,"research_points":6}`.
  Every gate at `src/research.js:146-148` passes. `academy_level` probe at
  `:144` matches nothing but no-op, not block.
  Blind-verdict refactor still worth doing for CLAUDE.md invariant —
  just not as fix.
- **H3 — CONFIRMED client-side** (server-side unprovable offline).
  `building_academy` has **0 hits** in `game.min.js`, `game.min_Em_n.js` and
  saved page. Only start path
  `buyResearch(e) → new GameModels.ResearchOrder({research_type:e}).research() → execute('research',{id:getType()}) → gpAjax.ajaxPost('frontend_bridge','execute',{model_url:'ResearchOrder',action_name:'research',captcha:null,arguments:{id}})`.
  `bridgePost` (`src/bridge.js:190`) already sends exactly that envelope with
  dry-run / journal / captcha / watcher intact.
  **Missed by original plan:** `town_id` must go at **top level** of
  post, not inside `arguments` — `gpAjax._ajax` does
  `if(!o)o={town_id:Game.townId};else if(!o.town_id)o.town_id=Game.townId`, so
  without it every research silently retargets currently-open town instead of
  `job.townId`.
  `tplNameFor` needs no change: `research` absent from `TPL_FEATURE_MAP`
  (`src/core.js:736-748`), so tpl-stale gate already no-op here.
- **H4 — CONFIRMED, and worse than stated. Must fix BEFORE H1.**
  `ITowns.addToTowns` constructs each `Town` with building-order, unit-order,
  unit, supporting-unit, god and casted-power fragments — **no research-orders
  fragment**. That why `abGetTown(id).buildingOrders()` works per town and
  research has no equivalent.
  MM fallback provably carries only current town: `research_orders`
  `TownAgnosticCollection`, and only its `getCurrentFragment()` working copy
  registered under `d.collections['ResearchOrder']`; `getOnlyCollectionByName`
  returns `i[0]`, and that working copy `reset()` to current town on every
  town switch. ⇒ `info.orders` correct for `Game.townId` and **always `[]`**
  elsewhere, so "already queued" and "queue full" silently pass for every other
  town and `nativeQueueReconcileResearch` never prunes there.
  Working per-town reads:
  `MM.getFirstTownAgnosticCollectionByName('ResearchOrder').getFragment(townId).models`
  (careful: `getFragment` *creates* empty fragment on miss, so empty ≠
  unknown), or `MM.getModels().ResearchOrder` filtered on `get('town_id')`.
  Whether server pushes other towns' ResearchOrder models at all
  unprovable offline — treat miss as **unknown**, not as "empty".

### Additional posting-path defects found during verification

- **A1 — queue max hardcoded to 2** (`src/research.js:157`, `:219`). Real value
  `GameDataConstructionQueue.getResearchOrdersQueueLength()` →
  `GameDataPremium.hasCurator() ? 7 : 2`. Caps Curator accounts at 2. Mirror
  `abQueueMax()` (`src/build-auto.js:33`).
- **A2 — `requires_farming_villages` / `on_small_island` never checked.** Game's own
  `can_be_bought` includes it. On small island those techs guaranteed
  server rejections — one request-budget slot and one decision-memory
  strike every cadence. Exactly v1.5.4 regression class named in CLAUDE.md.
- **A3 — cost unmodified.** Game uses
  `GameDataResearches.getResearchCosts` = `resources × GeneralModifications.getResearchResourcesModification(Game.townId)`.
  `src/research.js:52-63` reads raw `resources`, so over-estimates once
  diplomacy researched. Conservative, not blocking — fix with rest.

### "Does not appear" (mount path) — VERIFIED against dump

- **H5 — REFUTED.** Tech tree does emit `data-research_id` as real HTML
  attribute: click handler binds `.btn_upgrade, .btn_downgrade` and reads
  `$(e.currentTarget).data("research_id")`, and jQuery `.data()` reads
  `data-research_id` attribute; user guide independently builds literal
  selector `.tech_tree_box .button_upgrade[data-research_id=X]`. Class-name
  mismatch exists (`btn_upgrade` in handler vs `button_upgrade` in user
  guide) but irrelevant — `NATIVE_RESEARCH_SEL` (`src/native-ui.js:615`) attribute-based
  and will match. Tech tree template itself
  server-rendered and absent from dump, so per-builder class
  unprovable offline; attribute's presence forced by handler.
- **H6 — REFUTED on clipping claim; no-anchor gap real but minor.**
  `nativeUiScan` (`src/native-ui.js:766-767`) already re-targets `button`/`a`
  nodes to `parentElement`, so control never appended inside sprite
  button. `.gb-native-qctl` CSS (`src/native-ui.js:538`)
  `position:relative; display:inline-flex; vertical-align:middle` plus
  `z-index:2147482000` — no `overflow:hidden`, no absolute positioning, so
  sits in flow and above `.tech_tree_box` overlays. Real gap only that
  build lane has explicit anchor logic (`src/native-ui.js:669`) and
  research lane does bare `tile.appendChild(ctl)`. Tech-tree cell's own
  `overflow` not in dump — resolve in-game, not by guessing.
- **H7 — CONFIRMED. Dominant "does not appear" cause.**
  `ensureDomObserver` (`src/collect.js:182-188`) observes `#ui_box` plus
  `.window_content` nodes that exist at arm time, falling back to `document.body`
  only when that list empty. Grepolis windows **not** inside `#ui_box`:
  `WindowsView` `el:"body"` and `renderWindow` mounts with
  `$parent:this.$el` (= body); saved page shows `#ui_box` (line 1351) and
  open window `window_c970` (line 2755) as **sibling children of `<body>`**. 
  `subtree:true` observer on `#ui_box` cannot see insertion in sibling
  subtree, so opening Academy fires no mutation and `scheduleNativeUiScan`
  never called. Remaining triggers: one-shot at `src/boot.js:81` (too
  early), 5s loop at `src/boot.js:82-87` (gated on `nativeQueueHasPending`,
  false while lane empty — chicken-and-egg lock), and SPA nav (opening
  window not SPA nav).
  **Correction to original plan:** `attributeFilter` note red herring — `childList`
  mutations not gated by `attributeFilter`. Fix is observer's *target*, not filter: observe `document.body` (or re-arm
  from body-level root), and/or ungate 5s re-scan.
- **H8 — CONFIRMED on missing attribute, but not cause on own.**
  Window template carries no town-id attribute
  (`<div id="window_<%= model.cid %>" class="js-window-main-container …">`) and
  Academy has no `input[name="town_id"]`, so `nativeWindowTownId`
  (`src/native-ui.js:555-569`) falls through to GPWindowMgr focus path.
  Both `getFocusedWindow` and `getJQElement` exist, and `getJQElement` returns
  `.js-window-main-container`, which **contains** `.window_content` that
  `nativeUiScan` passes as `root` — so `el.contains(root)` holds and
  **focused** window resolves fine. Only un-focused windows return null, which intended
  conservative behaviour. Not reported symptom.

**Verifier's bottom line:** H5 and H6 do not explain symptom; H8 explains it
only for un-focused windows; **H7 alone explains it.**

### Contradiction — RESOLVED against H7

User confirmed in-game: **Senate build `[+]` and Barracks/Docks recruit `[+]`
appear fine; Academy shows no `Cola GrepBot · Investigación` panel at all.**

Third verifier established full trigger inventory: only trigger that
survives window open is 5s loop at `src/boot.js:82-87`, gated on
`nativeQueueHasPending` for any lane. Since build/recruit controls appear,
that loop **is** ticking, so `nativeUiScan` runs every 5s and does re-scan
`document.querySelectorAll('.window_content,.gpwindow_content,#unit_order')` —
including Academy window whenever open.

⇒ **H7 real but NOT cause of this user's symptom.** Scan runs; it
just produces `researchN === 0`, and `nativeUiScan` (`src/native-ui.js:771`)
only calls `nativeRenderQueuePanel` for lane `if (researchN)` — otherwise it
*removes* panel. "No panel at all" exactly that branch.

H7 remains worth fixing as real robustness bug (fresh install with all three
lanes empty has no trigger at all — chicken-and-egg: no scan ⇒ no `[+]` ⇒ lane
stays empty ⇒ no scan), but must not be sold as fix.

### What can produce `researchN === 0` — needs live DOM, not more dump reading

Academy tech tree markup **server-rendered with window payload** and
absent from every capture: `grep -c research_id "Grepolis - Atenas.html"` = 0,
and only `tech_tree` hits in `game.min.js` are two user-guide selector
strings. Both prior verifiers ended at "unprovable offline" here. Remaining
candidates, in order:

- **C1 — no `data-research_id` attribute in real DOM.** Click handler
  reads `$(e.currentTarget).data("research_id")`, and jQuery `.data()` checks own
  store *before* attribute — so template that sets it via `.data()` in
  JS leaves no attribute for `NATIVE_RESEARCH_SEL` to match. User-guide
  selector argues attribute exists, but on `.button_upgrade`, class click handler
  does not use.
- **C2 — id values not `GameData.researches` keys.** `nativeResearchId`
  (`src/native-ui.js:616-627`) only accepts value for which
  `researchDef(v)` truthy. Numeric ids, or `research_type` spelling that
  differs from GameData key, yield `null` for every tile ⇒ `researchN === 0`.
- **C3 — `nativeWindowTownId` returns null for Academy root.** If
  Academy window contains more than one distinct `input[name="town_id"]` /
  `data-town-id` value, `ids.size > 1` ⇒ `return null` (`src/native-ui.js:560`)
  ⇒ whole root skipped and every control removed. Senate/Barracks would
  be unaffected. Also fits "no panel at all".

**Next action is live DOM read, not another offline pass.** Console snippet in
step 0 below settles C1/C2/C3 in one paste.


## Work order

Posting-path order now fixed by dependency first pass missed: correct
available-points formula subtracts `getSpentResearchPoints`, which counts
researched techs **plus queued orders**. With `info.orders` empty for non-current
towns (H4), "fixed" H1 would over-report points and post unaffordable
research. **H4 before H1.**

0. **Live DOM read (blocking — decides whole mount fix).** Open Academy
   in-game, then paste this in browser console (page context, F12):

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
     must go class-based and read jQuery data store).
   - `attr_us > 0` but values not in `gameDataKeys` ⇒ **C2** (relax
     `nativeResearchId`'s `researchDef` gate).
   - `townIds.length > 1` ⇒ **C3** (`nativeWindowTownId` bails; scope town-id
     collection to window root and prefer focused window's town).
   - `sample` also shows whether cell would clip inline-flex control (H6
     anchor).
1. **Instrument.** One-shot `gbLogT` when root contains `.tech_tree_box` but
   matched zero research tiles, and when `nativeWindowTownId` returns null for
   such root. Add Preflight row for academy read path: techs readable,
   academy level, orders count/readable, research points readable,
   `GameData.researches` size. Keeps this diagnosable without console next
   time.
2. **H4 — per-town research orders.** Read via
   `MM.getFirstTownAgnosticCollectionByName('ResearchOrder').getFragment(townId)`
   or `MM.getModels().ResearchOrder` filtered on `town_id`; keep current
   working-copy read for `Game.townId`. Miss must surface as **unknown**, not
   as empty queue — do not prune and do not claim free slot on unknown.
3. **H1 — available research points.** Port real formula
   (`academy × points_per_academy_level + library bonus − Σ research_points of
   researched-or-queued techs`) using `Game.constants.academy`. Where it still
   cannot be read, return `blind` verdict (log once, let server decide),
   per CLAUDE.md precondition invariant. Leave `researchPointCost` alone —
   it correct.
4. **H3 — transport.** Send research through `bridgePost` with
   `model_url:'ResearchOrder'`, `action_name:'research'`, `arguments:{id}` and
   **`town_id` at top level of post**. Drop or demote
   `building_academy/research` to fallback. No `tplNameFor` change needed.
5. **A1/A2/A3 — remaining precondition gaps.** Real queue length via
   `GameDataConstructionQueue.getResearchOrdersQueueLength()`; skip
   `requires_farming_villages` techs on small island; apply
   `getResearchResourcesModification` to cost.
6. **H2 — invariant cleanup only.** Convert `researchDepsOk` /
   `researchCanAfford` unreadable paths to `blind`. Not fix for reported
   symptom; do not let it displace real ones.
7. **Mount fixes.** Whatever step 0 returns (C1 / C2 / C3) drives main fix.
   Alongside it, unconditionally: move MutationObserver target to
   `document.body` — Grepolis windows body-level siblings of `#ui_box`
   (`WindowsView` `el:"body"`, `renderWindow` mounts with `$parent:this.$el`;
   saved page shows `#ui_box` at line 1351 and `window_c970` at line 2755 as
   sibling body children) — and ungate 5s `scheduleNativeUiScan` so empty
   lane can still mount `[+]` (H7's chicken-and-egg). Add research-lane
   anchor to match build lane (H6). Do **not** touch `attributeFilter`
   (`childList` mutations not gated by it).
8. Bump `@version` in `src/header.js`, `python3 build.py`, headless smoke via
   `run-grepbot` skill, then in-game validation with **Dry run ON**.

## Non-goals

- No test harness, no npm, no server (CLAUDE.md).
- Do not enable anything HIGH-RISK by default.
- Do not "simplify" precondition into unconditional post.

## Implementation notes (v2.9.0)

Posting path, in plan's order:

- **H4** — `researchOrdersFor(townId)` returns `{orders, known}` and
  `researchTownTechs` surfaces it as `info.ordersKnown`. Three reads, in order:
  `ResearchOrder` TownAgnostic fragment, flat `MM.getModels().ResearchOrder`
  sweep, then working copy (open town only). Empty result only counts as
  known-empty for open town, or when flat sweep holds order for some
  *other* town — which proves server pushes them world-wide. Unknown blocks
  post (`cola real ilegible; abre esa ciudad una vez`) instead of claiming free
  slot, and `nativeQueueReconcileResearch` stops using real queue for
  pruning while unknown (researched flags still prune).
- **H1** — `researchPointsAvailable` ports
  `AcademyBaseController.getCurrentResearchPoints() - getSpentResearchPoints()`
  off `Game.constants.academy`, including library bonus (`level === 1`) and
  one-level drop while academy tears down. `researchPointsSpent` sums
  `research_points` over researched-or-queued techs, so returns null while
  `ordersKnown` false. `researchPointCost` already correct and unchanged.
- **H3** — `researchPayload` now
  `{model_url:'ResearchOrder', action_name:'research', arguments:{id}, town_id}`
  through `bridgePost`, with `town_id` **top level**. `txIntent` already keyed
  research off `d.town_id` + `arguments.id`, so decision-memory keys unchanged.
- **A1** — `researchQueueMax()` reads
  `GameDataConstructionQueue.getResearchOrdersQueueLength()`, falling back to
  `hasCurator()`/`isAdvisorActivated('curator')`, then 2.
- **A2** — `requires_farming_villages` blocks only when `on_small_island` was
  actually read as true.
- **A3** — `researchCost(tech, townId)` multiplies by
  `GeneralModifications.getResearchResourcesModification(townId)`; unreadable
  modifier keeps raw (higher) cost.
- **H2** — `researchDepsVerdict` returns `{ok, blind, why}`; `researchDepsOk`
  keeps boolean contract for existing callers and returns **true** on blind.
  `researchCanAfford` likewise returns `{ok, blind, why}` and only blocks on value it read (a `gbAfford` shortfall on *unreadable* resource does not count).

Mount path — step 0's console snippet not run, so all three candidates
handled rather than one selected:

- **C1** — `nativeResearchId` falls back to jQuery data store (which
  `.data()` reads before attribute), and `NATIVE_RESEARCH_SEL_ALL` adds
  class hooks game itself binds (`.btn_upgrade`, `.button_upgrade`,
  `.research_icon`). Class-only node still has to resolve to real GameData
  tech or skipped.
- **C2** — `nativeResearchKey` maps raw tile value through
  `GameData.researches`' own `id`/`research_id`/`research_type`/`name` fields,
  and `nativeResearchFromClass` reads `getResearchCssClass` convention
  (`<tech>`, `<tech>_old`, `<tech>_bpv`).
- **C3** — `nativeWindowTownId` no longer aborts whole root on multiple town
  ids: if open town among them and this root focused window, that is
  town. Otherwise still returns null, now with throttled log.
- **H7** (real, but not this symptom) — MutationObserver target moved to
  `document.body`, since Grepolis windows body-level siblings of `#ui_box`;
  observer's ignore filter grew `#grepbot-panel` / `#grepbot-queue-center` so
  bot's own repaints do not feed it. 5s `scheduleNativeUiScan` now
  ungated, closing empty-lane chicken-and-egg.
- **H6** — research control anchors next to tech caption like build lane
  does; its removal query descendant-scoped to match.
- **Step 1 instrumentation** — throttled logs for "academy root matched N nodes
  but resolved 0 techs" (with attribute/class/`tech_tree_box` counts) and for
  "academy window open but its town id unreadable", plus Preflight
  **academy read path** row: `GameData.researches` size, academy, library, real
  queue + max, research points, small-island flag.

Still open: step 0 as diagnostic if lane still absent in-game, and step
8 (in-game validation with Dry run ON).