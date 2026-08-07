# Recurring error patterns

Generated 2026-08-07 from 5 parallel scans of `src/` (1360 nodes, 4996 edges).
Each pattern lists ≥2 file:line occurrences; standalone one-offs are omitted.

Patterns grouped by anti-pattern. Severity tag = potential impact radius.

---

## 1. Empty `catch (_) {}` swallows real errors — HIGH

Exception swallowed, never logged, never surfaced to `gbLog`. Breaks
in-game triage because the panel log ring never sees it.

- `orchestrate.js:50-62` — every `ORCH_HANDLERS` wrapped in empty catch
- `boot.js:101-103` — masks `ReferenceError` on missing `cancelArmedAttack` / `banditAttackSentAt`
- `qol.js:44` — `try{renderAbQueue&&renderAbQueue()}catch(_){}` swallows every render error
- `military.js:43` — bare catch swallows all model-read errors
- `recruit.js:144` — `resources()` catch → `continue` blocks on unread value
- `bandit.js:238` — try/finally no catch (throw escapes after scheduling)

Rule: every catch must `gbLog(...)` or re-throw.

---

## 2. POST without `automationPaused()` / captcha / server-cooldown gate — HIGH

Bridge call fires while feature should be paused. The server-pressure
bus + captcha breaker only work when each bridge path checks them.

- `attack.js:323` — `sendAttackViaBridge` checks hostEnabled + captcha but **never** `automationPaused({})`
- (recruit, wonder, favor paths) — to audit for the same gap

Rule: every bridge path must start with `if (automationPaused({reason:'feature'})) return skip('paused')`.

---

## 3. Bridge ack treated as success — no reconcile — HIGH

Server 200 OK does not prove the post landed in game state. Missing
re-read of model / relations / order collection means a silently rejected
action looks identical to a successful one.

- `attack.js:362` — attack send has no post-send reconcile
- `military.js:58` — no reconcile after support sends
- `recruit.js:180` — no post-build reconcile (order collection not re-read)
- `farms.js:509` — `verifyClaims` strict `!==` misses server same-value re-stamp
- `towns.js:161` — `townResourcesFromGame` re-reads every town every scrape with no freshness check

Rule: any irreversible post must re-read the model inside the bridge
callback, not infer success from `ok:true`.

---

## 4. Blind-means-block (CLAUDE.md regression) — HIGH

A renamed/missing getter must yield `blind`, never `false`. A guard that
silently parks a feature when a getter is renamed is worse than no guard.

- `favor.js:62` — favor balance 0 default → blind becomes "need favor" → always sends
- `recruit.js:20` — `recruitHasSpell` false on model-read failure → re-cast
- `recruit.js:144` — `resources()` catch → `continue` blocks on unread
- `build-tab.js:504` — `abCanAfford` false on unreadable resources, logs nothing
- `build-tab.js:512` — `res.wood >= need.wood+margin` with `undefined` → false
- `trade.js:122` — `keep = (src.cap||0)*reservePct` — cap unreadable → keep=0 → drain source

Rule: probe miss → return `{blind:true}`, log once via `gbLogT`, defer to server.

---

## 5. Timeout treated as transient → retry on irreversible action — HIGH

A support send / wonder donation / dodge that times out may have
landed. Retrying duplicates the action.

- `wonder.js:112` — "unknown controller" retries resource send → duplicate donation
- `dodge.js:199` — send failure retried without distinguishing timeout

Rule: timeouts on irreversible paths must reconcile only, never retry.
CLAUDE.md `v1.5.3 audit` regression note.

---

## 6. DOM/selector interpolation with game-sourced ids — HIGH

`querySelector` with interpolated untrusted id throws on quote chars
(kills render) or opens injection paths. `innerHTML` interpolation of
town names / player names is the same shape.

- `ui.js:112` — `tbody.querySelector(`tr[data-key="${key}"]`)`
- `ui.js:193` — same with `t.id`
- `attack.js:582` — selector built by interpolating `r.townId`
- `intel.js:58` — accumulator named `html` assigned via `textContent`; one `innerHTML` edit away from spoof
- `ui.js:477` — `panel.innerHTML` interpolates `runningVersion()` (safe today, fragile)
- `alerts.js:21` — payload JSON.stringify'd verbatim into webhook body
- `alerts.js:32` — body embeds `location.host` (world + account identifier)

Rule: every selector / innerHTML must escape or use `[data-key="..."]`
with CSS-escape (`CSS.escape(key)`), or build via DOM APIs.

---

## 7. Diag / Export dumps leak raw tokens, ids, names — HIGH

`Diag`, `Export config`, footer status, clipboard write — all bypass
`redactFindingsExport`. CSRF token clipped to first 6 chars still
identifies the session.

- `stats.js:33` — first 6 chars of CSRF token to panel + log ring
- `ui.js:798` — Copy JSON raw `state.decisions` + `decisionSkips`
- `ui.js:820` — Export config copies `playerNotes`/`watchlist` verbatim
- `ui.js:1512` — redaction keeps 4 digits + first letter + exact x/y
- `ui.js:1534` — footer status prints first 6 chars of CSRF
- `ui.js:1553` — `el.title` JSON carries `captchaBreakers` map + memory skip keys
- `ui.js:1604, 1614` — every village id/name + every town id
- `ui.js:1667` — unredacted diag report to system clipboard
- `alerts.js:21` — webhook body JSON omits redaction
- `intel.js:129` — sends raw finding (attacker/defender names, ids, coords)
- `qol.js:160` — `qolImportConfig` type-checks envelope only; values written unvalidated

Rule: every dump must pass through `redactFindingsExport` and clamp CSRF
to `<redacted>`.

---

## 8. Render thrash — full repaint instead of keyed patch — MEDIUM

CLAUDE.md `v1.4.0 render` regression rule: compare membership, not order.
`Set-vs-array length` and `replaceChildren()` violate this.

- `ui.js:105` — `have.size === wanted.length` (Set vs array — dupes tear down every repaint)
- `ui.js:178` — same shape, second table
- `build-tab.js:680` — `box.replaceChildren()` rebuilds 13 rows + 39 listeners every call
- `build-tab.js:320` — `renderBuild` tail-calls `renderAbQueue` on 10s cadence
- `qol.js:118` — `renderOverview` has no `_last` guard
- `stats.js:179` — three full journal passes per repaint
- `ui.js:1402` — `renderFindings` `replaceChildren()` + 80-row rebuild per report
- `ui.js:297` — `paintNav` `replaceChildren()` + rebinds every button on tab switch
- `ui.js:21` — sort re-appends every `tr` individually (N reflows)

Rule: keyed-row patch (`tr[data-key]`) + `_last` shadow state. See
`ui.js` and `build-tab.js` for canonical pattern.

---

## 9. Render runs while tab is hidden — MEDIUM

`sec.hidden` guard present in `renderBuild/renderStats/renderIntel/renderOverview`
but missing in three others. Hidden-tab DOM diffs still run; build tab
cadence keeps rebuilding on a hidden Farms tab.

- `ui.js:141` — `renderFarms` no `sec.hidden` guard
- `ui.js:204` — `renderWorld` no `sec.hidden` guard
- `ui.js:1405` — `renderFindings` no `sec.hidden` guard
- `farms.js:checkThresholds` — calls `renderFarms()` even when Farms tab hidden

Rule: every `render*` must start with `if (sec && sec.hidden) return`.

---

## 10. No lock (`gbLock`) on bridge-triggering path — MEDIUM

CLAUDE.md `v1.4.0 lock registry` regression note: never reintroduce
per-module `*InFlight` boolean. Re-entry possible.

- `bandit.js:133` — attack post no lock (only `banditAttackSentAt` guard)
- `boot.js:62, 71, 83, 86` — `gbInterval` callbacks (`farmTick`, `questScanTick`, `dodgeScan`, `orchTick`) no lock gate
- `build-tab.js:246` — watchdog `unlock()` releases lock without aborting next() chain
- `build-tab.js:639` — `abScan` watchdog identical race

Rule: every feature path that posts must `gbLock(name)` + TTL entry in
`GB_LOCK_TTL`.

---

## 11. `gbTimerBag` leak / raw `clearTimeout` — MEDIUM

Bypassing the timer registry grows an entry per run; eventually the
bag dominates memory and timeouts can't be cancelled.

- `build-tab.js:249` — `clearTimeout(watchdog)` bypasses `gbTimerBag`
- `build-tab.js:642` — same, `abScan` watchdog
- `ui.js:1272` — `farmsInputTimer` cleared with raw `clearTimeout`

Rule: `gbSetTimeout` / `gbClearTimer` exclusively; never raw.

---

## 12. Defense / target-type filter bypassed — MEDIUM

Hostile-only canonical types; town-only attack targets. Bypassing
either opens wrong-target posts.

- `military.js:54` — synthesizes `{town_id, kind:'town'}` bypassing `resolveTarget`
- `favor.js:118` — favor builds Town payload against `farm_town` id (bypasses `attackSendAllowed`)
- `dodge.js:70` — own-origin filter makes later `!a.incoming` check unreachable
- `recruit.js:18` — unconditional `building_barracks` fallback for any unit missing god/myth/naval flags

Rule: route every attack/support/dodge through `resolveTarget` or
explicit type guard (`is_attack`, `kind:'town'`, controller name).

---

## 13. PRECONDITION gaps on bridge posts — MEDIUM

Cost / capacity / queue / building level not read before posting.
Burns a request budget slot on a guaranteed rejection.

- `recruit.js:36` — `recruitCastSpell` no favor balance / favor-cost read
- `recruit.js:117` — `orders >= 7` treats global count as per-queue limit
- `recruit.js:161` — amount hardcoded 50, no config
- `favor.js:106` — no boat/island check for myth stack
- `favor.js:126` — never verifies target plunderable (temple / not-already-plundered)
- `favor.js:133` — fabricates `'f'+Date.now()` movement id (fictional en-route)
- `dodge.js:89` — `dodgeSafeTown` no island/distance preference
- `dodge.js:130` — no island/boat check on off-island land dodge
- `dodge.js:145` — `dodgeTownUnits` strips only militia (naval ships dodged out)
- `wonder.js:55` — only `tradeCap` checked; free freighter count never read
- `military.js:18` — defense-pull sends every sword/archer/hoplite/rider/chariot
- `military.js:31` — off-island branch adds warships before `boatCapacityCheck`
- `attack.js:102` — magic `dist*50/speed` + `runtimeSetupTime` no source
- `attack.js:132` — `boatCapacityCheck` returns `ok:true` for "naval-only" regardless
- `attack.js:306` — `null arrivalUnix` leaves `sendAt=null`; `armAttackWave` fires immediately
- `attack.js:344` — template arg copy keeps only `string|boolean`; numeric learned args dropped
- `attack.js:362` — see also pattern #3
- `attack.js:491` — blocking `confirm()` inside IIFE timer loop
- `attack.js:522` — blocking `prompt()` in `editThreshold`

Rule: use `gbProbeNum` / `gbTownModel` / `gbAfford` / `gbTownPop` /
`gbPlayerGold` from `core.js` before any post.

---

## 14. `console.*` bypasses `gbLog` ring buffer — MEDIUM

Bypasses panel Log tab; persists after teardown; pollutes browser
console with bot internals.

- `core.js:736` — `console.warn('[grepbot] save fail', key, e)` (real error site, `GM_setValue` throw)
- `towns.js:52` — `console.info('[grepbot] towns:…')` every successful list fetch
- `ui.js:1644` — diag `console.groupCollapsed`/`log`/`groupEnd`

Rule: `gbLog` / `gbLogT` exclusively; `console.warn` only inside the
diag dump itself, gated by user toggle.

---

## 15. Magic constants / falsy-fallback traps — MEDIUM

`|| default` swallows legitimate `0` / `''` / cleared values. Hardcoded
numbers ignore user settings.

- `research.js:177` — `queueMax = 2` hardcoded, ignores `researchQueueMax`
- `build-tab.js:8` — `state.ibFreeThresh || 300` (0/NaN → 300)
- `ui.js:1093` — `saveNum` passes `+e.target.value` with no NaN guard
- `ui.js:1216` — `telegramChatId || undefined` drops cleared value
- `ui.js:962` — configBound re-syncs 18 of ~60 controls; rest keep stale value
- `core.js:316-320` — `ibAction`/`farmOptionMap` `|| '<default>'` falsy-string reset
- `core.js:309` — `STORE.FARM_ACTION` NOT in `WORLD_SCOPED_BASES` (write path differs)
- `core.js:306-307` — csrf fallback chain (wkey → unscoped) — OK by design

Rule: explicit null check `?? default`, never `|| default` for numeric /
boolean settings; honor user-cleared values.

---

## 16. Listener / timer / URL lifecycle leaks — MEDIUM

Bind-once, never unbound. Handlers accumulate on reused XHR; blob
URLs never revoked; document listeners stay across panel rebuilds.

- `spy.js:13` — empty `if (uw.fetch._grepbot) {}` dead code block
- `spy.js:57` — new `load` listener attached on every `send()` (handler accumulation)
- `spy.js:99` — bare `id` keys queued as report ids whenever URL is reportish
- `spy.js:129` — `queueReportList()` declared with zero params, discards hint URL
- `ui.js:908` — `URL.createObjectURL` no `revokeObjectURL`
- `ui.js:1288` — drag binds `document mousemove` + `mouseup` for whole session
- `ui.js:1327` — resize binds second `document mousemove` (3 unthrottled total with `qol.js:6`)
- `qol.js:6` — `document mousemove` no throttle
- `ui.js:886` — empty `if (!was) { }` dead code block

Rule: every addEventListener needs an off-switch; blob URLs revoked in
the cleanup path; reused XHR rebuilds handlers per `open()`, not `send()`.

---

## 17. Hot-path O(n) scan inside per-tick loop — LOW

Cheap at current data sizes; ceiling for 1k+ decisions or 100+ towns.

- `orchestrate.js:84-93` — `orchJrnCount` walks entire decisions list per call (2 per feature per tick)
- `ui.js:21` — sort re-appends every `tr` (use `DocumentFragment`)
- `ui.js:57` — `makeSortable` rebinds on `placeholder()` teardown
- `ui.js:1409` — filter + `slice(0,80)` rescans per keystroke
- `stats.js:179` — three full journal passes per repaint
- `stats.js:214` — `orchStatus()` called twice per render
- `stats.js:41` — `gameNow()` re-evaluated per farm inside filter predicate
- `towns.js:154` — `save(STORE.TOWNS, state.towns)` even when gameTowns identical
- `towns.js:170` — `gbTimeout` delay uses `fromHttp * 600` index not town index
- `towns.js:178` — unlock delay time-based, not completion-based
- `towns.js:173` — `pruneMapsToIds` runs unconditionally (wipes cache on transient 0-town response)

Rule: cache `Date.now()` / `gameNow()` once per tick; use
`DocumentFragment` for batch DOM ops.

---

## 18. build.py duplicate-detection false-negatives — LOW

The gate that catches name collisions in concat misses some declaration
shapes. New module using these forms bypasses the gate.

- `build.py:65` — `DECL_RE` misses `class Foo`, `async function foo`, `function*foo`
- `build.py:65` — anchored at exactly `^  ` 2-space; tabs / deeper indents skipped
- `build.py:321` — intra-module duplicates silently ignored
- `build.py:70` — `can_regex` misclassifies `1.5/foo/` as division
- `build.py:119` — `/* */` comment space insertion can morph numeric literals
- `build.py:156` — template substitution `${…}` counter advance may overrun nested literal
- `build.py:358` — `.build-stamp.json` mismatch yields silent warn-and-overwrite (no integrity check)

Rule: tighten `DECL_RE` to match `function|class|async function|function\*`
followed by optional `*` and whitespace; expand indent detection to tabs
+ variable leading whitespace.

---

## 19. `parse-inline.js` claims self-contained but pulls from globals — LOW

Header comment lies. Renaming in caller breaks parser silently.

- `parse-inline.js:2` — header says "pure, node-runnable, no GM/DOM" but `pickNum` defined outside
- `parse-inline.js:57` — `serverTs` accepts any numeric field, no sanity floor (1970 dates)
- `parse-inline.js:63` — `Date.parse(c)` accepts locale-ambiguous strings, no upper bound
- `parse-inline.js:76` — `r.defender?.x ?? r.x` takes defender **player's** x as town coord
- `parse-inline.js:102` — `line.startsWith(id)` false for pipe form; falls back to whole line
- `parse-inline.js:108` — skip Set holds literal `"null null"` / `"null,null"`
- `parse-inline.js:140` — inner catch returns `data` (outer object) instead of signalling parse failure

Rule: enforce self-contained claim; bind `pickNum` locally; reject
non-numeric / out-of-range timestamps.

---

## 20. JSON / state save unconditional full-write — LOW

Every cadence rewrites the whole key, even when value identical.
`migrateConfig` writes every `WORLD_SCOPED_BASES` key on first run.

- `towns.js:154` — `save(STORE.TOWNS, state.towns)` even when identical
- `core.js:416-437` — `migrateConfig` bumps `state.configVer` unconditionally; writes every base key

Rule: shallow-compare before save; migrations idempotent (only write
when current `state.configVer` differs).

---

## 21. Stats / preflight probes can't fail — LOW

`ok` predicate is tautological. Diag reports green when probe is broken.

- `stats.js:18` — `ok: r.ok !== false` (probe that forgets to return ok → pass)
- `stats.js:25` — `gameUw()`/`gameBridgeStatus()` called outside any probe (throw aborts preflight, no rows)
- `stats.js:114` — `RESEARCH_CS_FAST[0]` indexed with no length check
- `stats.js:120` — `ok: blind < 5` (passes with 4 of 5 cost tables unreadable)
- `stats.js:129` — `ok: true` hardcoded (incoming probe can never fail)
- `stats.js:134` — `ok: n >= 0` is tautology (quests probe can never fail)

Rule: every probe must have a falsy default (`ok: false`); explicit
checks for each truth condition.

---

## 22. Inline jtag inconsistent across bridge paths — LOW

`core.js:bridgePost` uses `jrnTag()`; `gameAjaxPost` constructs `jtag`
inline with a different shape. Stats rollups split.

- `core.js:1014` — `gameAjaxPost` builds `jtag` inline; target pulled from `data.building_id` etc.
- `core.js:1019` — redundant `captchaGlobalUntil` recheck (already inside `automationPaused`)
- `core.js:982, 1042` — `const timer` declared **after** `finish` references it (TDZ-adjacent)
- `core.js:453` — `SERVER_PRESSURE_RE` matches "slow down" (broad; false-trips on game errors)
- `core.js:479-482` — `noteServerPressure` opens 10-20s cooldown on transient blips
- `core.js:717-730` — `load()` silently swallows GM_getValue exceptions (corrupted key looks empty)

Rule: single `jrnTag()` shape; lift `timer` declaration above `finish`;
tighten `SERVER_PRESSURE_RE` to backend-specific phrases.

---

## 23. TOCTOU / mid-iteration state mutation — LOW

`host/paused` re-check happens inside forEach after parent guard;
fetches scheduled earlier outlive a mid-iteration pause flip.

- `towns.js:168` — host/paused re-check inside forEach after parent guard
- `towns.js:155` — fallback branch `else if (!state.towns.length)` only fires when empty
- `bandit.js:129` — offense filter deletes units mid-iteration over its own Object.keys snapshot

Rule: snapshot decision state at start of iteration; re-check only on
result, not mid-iteration.

---

## 24. Orphans / dead code paths — LOW

- `core.js:309` — `load(wkey(STORE.FARM_ACTION), null) || load(STORE.FARM_ACTION, null)` legacy fallback
- `spy.js:13` — empty `if (uw.fetch._grepbot) {}` block
- `ui.js:886` — empty `if (!was) { }` block
- `build-tab.js:213` — `finishInstantly` fallback never calls `ibLearnAction`
- `build-tab.js:117` — `gbLogT('ib-src')` sits after the `!candidates` early return

---

## 25. Documenting intent vs observed behavior — LOW

`Sec.hidden` guards are present in `renderBuild`/`renderStats`/
`renderIntel`/`renderOverview` but absent in `renderFarms`/`renderWorld`/
`renderFindings`/`farms.js:checkThresholds`. Same intent, half coverage.

---

## Cross-cutting rules (consolidated)

1. **Every catch must `gbLog`.** Pattern #1.
2. **Every bridge path must `automationPaused({})` first.** Pattern #2.
3. **Irreversible posts must reconcile inside callback.** Patterns #3, #5.
4. **Blind probe → `gbLogT` once, defer to server.** Pattern #4.
5. **Selectors / innerHTML escape untrusted ids.** Pattern #6.
6. **Diag / Export / webhook pass through `redactFindingsExport`.** Patterns #7, #22.
7. **Keyed-row patch + `_last` guard + `sec.hidden` check.** Patterns #8, #9.
8. **`gbLock` + TTL on every bridge-triggering path.** Pattern #10.
9. **`gbSetTimeout` / `gbClearTimer` only.** Pattern #11.
10. **`resolveTarget` or canonical-type guard on attack/dodge/support.** Pattern #12.
11. **Precondition readers (`gbAfford`, `gbTownPop`, `gbPlayerGold`, `gbBuildingLevel`) before every post.** Pattern #13.
12. **`gbLog` / `gbLogT` over `console.*`.** Pattern #14.
13. **`?? default` over `|| default`.** Pattern #15.
14. **Listener / timer / blob lifecycle cleanup.** Pattern #16.
15. **Cache `Date.now()` / `gameNow()` per tick; `DocumentFragment`.** Pattern #17.
16. **build.py `DECL_RE` matches all declaration forms.** Pattern #18.
17. **parse-inline.js self-contained claim enforced.** Pattern #19.
18. **Idempotent saves / migrations.** Pattern #20.
19. **Stats probes default `ok: false`.** Pattern #21.
20. **Single `jrnTag()` shape across transports.** Pattern #22.

---

## Files touched

Generated from subagent scans of:
`header.js core.js boot.js footer.js orchestrate.js journal.js`
`attack.js military.js recruit.js bandit.js favor.js wonder.js spy.js dodge.js`
`farms.js collect.js cave.js culture.js trade.js rural.js research.js merchant.js`
`ui.js stats.js alerts.js qol.js intel.js parse-inline.js build-tab.js`
`towns.js quests.js build.py .build-stamp.json`
