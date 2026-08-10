# Recurring error patterns

Verified 2026-08-07 against `src/` @ `@version 1.5.10`.
Originally generated from parallel scans; line citations and several
claims were stale or wrong. This pass re-checked every bullet against
current sources — drop or reframe anything that no longer matches.

Patterns grouped by anti-pattern. Severity = potential impact radius.
Line refs are `file:line` under `src/` (or `build.py` at repo root).

---

## 1. Empty `catch (_) {}` swallows real errors — HIGH

Exception swallowed, never logged, never surfaced to `gbLog`. Breaks
in-game triage because the panel log ring never sees it. (~192 empty
catches repo-wide; most are probe paths. Examples below are the ones
that hide *feature* failures.)

- `orchestrate.js:50-61` — every `ORCH_HANDLERS` entry wrapped in empty catch
- `boot.js:101-106` — teardown swallows `ReferenceError` if a helper is missing
- `qol.js:44` — `try{renderAbQueue&&renderAbQueue()}catch(_){}` swallows every render error
- `military.js:49` — bare catch around defense-pull model walk
- `military.js:129` / `136` / `140` / `189` — cancel/outgoing model walks swallow
  the same way (collection / per-movement attribute failures disappear)
- `recruit.js:159` — `resources()` / cost math catch → `continue` (unread stock looks like "can't afford")
- `bandit.js:238-240` — `try`/`finally` with no catch: throw escapes after `banditScheduleNext()`

Rule: every catch that can hide a feature failure must `gbLog(...)` or
re-throw. Probe-only catches (`gbProbeNum`, building getters) may stay quiet.

---

## 2. Call-site pause gate incomplete — MEDIUM

`bridgePost` / `gameAjaxPost` already call `automationPaused` + captcha
(core.js). A caller that skips the same check still won't post while
paused, but it can flash / build payload / burn UI work before the
central bail. DOM paths that bypass those two helpers are the real gap.

- `attack.js:327-329` — `sendAttackViaBridge` checks `hostEnabled` +
  `captchaPaused('attack')` but not `automationPaused` (relies on
  `bridgePost`); contrast `military.js:9` which checks all three
- `bandit.js:224-234` — DOM `atkBtn.click()` only re-checks pause inside
  the delayed callback; no `bridgePost` gate

Rule: every bridge *caller* should mirror `automationPaused({})` early
for UX; any path that posts without `bridgePost`/`gameAjaxPost` must
gate captcha + pause + budget itself.

---

## 3. Bridge ack treated as success — no reconcile — HIGH

Server 200 OK does not prove the post landed in game state. Missing
re-read of model / relations / order collection means a silently rejected
action looks identical to a successful one.

- `attack.js:366-370` — attack send: flash "sent" on callback with no movement re-read
- `military.js:60-62` — support send counts `!err` as done; no reconcile
- `recruit.js:180-183` — build success from ajax ack only (order collection not re-read)
- `farms.js:542` — `verifyClaims` uses strict `!==` on `lootable_at` (same-value re-stamp misses)
- `towns.js:160-167` — every town re-written from game data every scrape (no freshness / dirty check)

Rule: any irreversible post must re-read the model inside the bridge
callback, not infer success from `ok:true`.

---

## 4. Blind probe mishandling (CLAUDE.md regression) — HIGH

A renamed/missing getter must yield `blind`, never a fabricated `0` /
`false`. Both directions are wrong: silently parking a feature (block)
is worse than no guard; treating unread as "empty/absent" and acting
(act) posts on bad premises.

- `favor.js:62` — favor balance `+(…|| 0)`: unread → 0 → below thresh → proceeds to post
- `recruit.js:32` — `recruitHasSpell` `catch → false` → treats unread as "not cast" → re-cast
- `recruit.js:159` — cost/stock catch → `continue` (blocks on unread)
- `build-tab.js:500` — `abCanAfford` `resources()` catch → `false` (unread = can't afford)
- `build-tab.js:512` — `res.wood >= need.wood+margin` with missing fields → `false`
- `trade.js:122` — `keep = (src.cap||0)*reservePct` — cap unreadable → keep=0 → drain source

Rule: probe miss → return `{blind:true}`, log once via `gbLogT`, defer to server.

---

## 5. Timeout treated as transient → retry on irreversible action — HIGH

A support send / wonder donation / dodge that times out may have
landed. Retrying duplicates the action.

- `dodge.js:205-210` — any send `err` (including `timeout`) schedules retry backoff
- `wonder.js:117-128` — alternate `factions` controller after "unknown controller"
  on the first `wonders` post (timeout path at 99-102 correctly does **not**
  retry; the unknown-controller fallback still can double-donate)

Rule: timeouts on irreversible paths must reconcile only, never retry.
Unknown-controller fallbacks need the same discipline. CLAUDE.md
`v1.5.3 audit` regression note.

---

## 6. DOM/selector interpolation with game-sourced ids — HIGH

`querySelector` with interpolated untrusted id throws on quote chars
(kills render) or opens injection paths. `innerHTML` interpolation of
town names / player names is the same shape.

- `ui.js:112` — `tbody.querySelector(\`tr[data-key="${key}"]\`)` (farm vill_id)
- `ui.js:193` — same with town `t.id`
- `attack.js:398` — `querySelector('[data-town="' + r.townId + '"] …')`
- `attack.js:586` — `` querySelector(`div[data-town="${r.townId}"]`) ``
- `intel.js:58-84` — builds a string named `html` then assigns via
  `textContent` (safe today; one `innerHTML` edit away from XSS)
- `ui.js:477-478` — `panel.innerHTML` interpolates `runningVersion()` (owned string; fragile pattern)
- `alerts.js:32-33` — webhook body embeds `location.host` + raw `JSON.stringify(payload)`

Rule: every selector must `CSS.escape(key)` (or build via DOM APIs). Prefer
`textContent` / `createElement` over `innerHTML` for anything game-sourced.

---

## 7. Diag / Export dumps leak raw tokens, ids, names — HIGH

`Diag`, `Export config`, footer status, clipboard write — several paths
bypass `redactFindingsExport`. CSRF clipped to first 6 chars still
identifies the session.

- `stats.js:33` — preflight csrf detail: first 6 chars of token
- `ui.js:815-816` — Log → Decisions → Copy JSON: raw `state.decisions` + `decisionSkips`
- `ui.js:836-838` — Export config: `qolExportConfig()` includes `playerNotes` / `watchlist` verbatim
- `ui.js:1522-1542` — redaction keeps last 4 id digits + first letter of name + exact x/y
- `ui.js:1551` — footer status prints first 6 chars of CSRF
- `ui.js:1570` — `el.title` JSON carries `captchaBreakers` + memory skip keys
- `ui.js:1621-1631` — Diag lists every village id/name + every town id
- `ui.js:1660-1663` — unredacted diag report to console (+ clipboard)
- `alerts.js:32-33` — webhook body JSON omits redaction
- `intel.js:129` — webhook gets raw finding (attacker/defender names, ids, coords)
- `qol.js:160-166` — `qolImportConfig` type-checks envelope only; values written unvalidated

Rule: every dump must pass through `redactFindingsExport` (or equivalent)
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
`renderFarms` / `renderAttack` for the canonical pattern.

---

## 9. Render runs while tab is hidden — MEDIUM

`sec.hidden` guard present in `renderBuild` / `renderStats` /
`renderIntel` / `renderOverview` / `renderAttack` but missing on the
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
`dodgeScan`, `orchTick`) are schedulers — features they call are expected
to take their own locks. Not a missing-lock bug by itself.

Rule: every feature path that posts must `gbLock(name)` + TTL entry in
`GB_LOCK_TTL`.

---

## 11. `gbTimerBag` leak / raw `clearTimeout` — MEDIUM

Bypassing the timer registry grows an entry per run; eventually the
bag dominates memory and timeouts can't be cancelled on dispose.

- `build-tab.js:249` — `clearTimeout(watchdog)` bypasses bag removal (watchdog was `gbTimeout`)
- `build-tab.js:642` — same, `abScan` watchdog
- `ui.js:1288` — `farmsInputTimer` cleared with raw `clearTimeout` (created via `gbTimeout`)
- `bandit.js:245` — `banditClearLoop` raw `clearTimeout(banditLoopTimer)`
- `attack.js:380` — armed timers cleared with raw `clearTimeout`

Rule: `gbTimeout` / a bag-aware clear exclusively; never raw
`clearTimeout` on ids that came from `gbTimeout`.

---

## 12. Defense / target-type filter bypassed — MEDIUM

Hostile-only canonical types; town-only attack targets. Bypassing
either opens wrong-target posts.

- `military.js:60` — synthesizes `{town_id, kind:'town'}` without `resolveTarget`
- `favor.js:73-122` — `targetType` defaults to `farm_town`, then posts Town
  `sendUnits` with that id (bypasses `attackSendAllowed`, which refuses farm_town)
- `dodge.js:70-71` — own-origin filter; later `!a.incoming` check is mostly unreachable
  after the `is_attack` short-circuit
- `recruit.js:17-18` — unconditional `building_barracks` fallback for land units
  missing god/myth/naval flags (intentional default, but wrong for odd clients)

Rule: route every attack/support/dodge through `resolveTarget` or an
explicit type guard (`is_attack`, `kind:'town'`, controller name).

---

## 13. PRECONDITION gaps on bridge posts — MEDIUM

Cost / capacity / queue / building level not read before posting.
Burns a request budget slot on a guaranteed rejection.

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
inside the user-triggered diag dump.

---

## 15. Magic constants / falsy-fallback traps — MEDIUM

`|| default` swallows legitimate `0` / `''` / cleared values. Hardcoded
numbers ignore user settings.

- `research.js:177` — `queueMax = 2` hardcoded (no `researchQueueMax` setting)
- `build-tab.js:8` — `state.ibFreeThresh || 300` (0 / NaN → 300)
- `ui.js:1110` — `saveNum` passes `+e.target.value` with no NaN guard
- `ui.js:1233` — `telegramChatId || undefined` drops cleared value
- `ui.js:978-989` — `configBound` re-sync path only refreshes a subset of controls; rest keep stale DOM
- `core.js:322-324` — `ibAction` / `farmOptionMap` `|| '<default>'` falsy-string reset
- ~~`core.js:313` — `STORE.FARM_ACTION` legacy `wkey` fallback~~ **CORRECTED 2026-08-10**:
  no fallback exists. `farmAction` loads plainly (`core.js:233`) and
  `STORE.FARM_ACTION` **is** in `WORLD_SCOPED_BASES` (`header.js:189`), so
  `load`/`save` apply `wkey()` themselves; the explicit `wkey()` in
  `learnFarmAction` (`farms.js:624`) is belt-and-braces. `core.js:313` is
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
- `spy.js:99` — bare `id` keys queued as report ids when URL is reportish
- `spy.js:129-131` — `queueReportList()` takes no params; callers pass a hint URL that is discarded
- `ui.js:908-918` — findings Copy uses clipboard only (OK); Export blob paths if added need revoke
- `ui.js:1296-1327` — drag + resize bind `document` mousemove/mouseup for session
- `qol.js:6-7` — `document` mousemove (activity pause) unthrottled
- `ui.js:897-903` — `#gb-ab-now` forces `abAuto=true` and leaves it on (comment acknowledges)

Rule: every `addEventListener` needs an off-switch (`gbListen`); blob URLs
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

The gate that catches name collisions in concat misses some declaration
shapes. New module using these forms bypasses the gate.

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

- `parse-inline.js:2` — header says "pure, node-runnable, no GM/DOM" but `pickNum` is defined in `farms.js:651`
- `parse-inline.js:57-64` — `serverTs` accepts any positive number; `Date.parse` has no upper bound
- `parse-inline.js:76-77` — `r.defender?.x ?? r.x` may take defender **player** coords as town coords
- `parse-inline.js:102` — `line.startsWith(id)` false for some pipe forms; falls back to whole line
- `parse-inline.js:108` — skip Set holds literal `"null null"` / `"null,null"` when x/y null
- `parse-inline.js:140` — inner JSON.parse catch returns outer `data` instead of signalling failure

Rule: enforce self-contained claim; bind `pickNum` locally; reject
non-numeric / out-of-range timestamps.

---

## 20. JSON / state save unconditional full-write — LOW

Every cadence rewrites the whole key, even when value identical.
`migrateConfig` re-writes every `WORLD_SCOPED_BASES` key on v1→v2.

- `towns.js:154` — `save(STORE.TOWNS, state.towns)` even when identical
- `core.js:422-442` — `migrateConfig` bumps `configVer` and re-saves every scoped base once

Rule: shallow-compare before save; migrations idempotent (only write
when current `state.configVer` differs).

---

## 21. Stats / preflight probes can't fail — LOW

`ok` predicate is tautological. Diag reports green when probe is broken.

- `stats.js:18` — `ok: r.ok !== false` (probe that forgets to return `ok` → pass)
- `stats.js:25-26` — `gameUw()` / `gameBridgeStatus()` outside any probe (throw aborts whole preflight)
- `stats.js:114` — `RESEARCH_CS_FAST[0]` indexed with no length check
- `stats.js:120` — `ok: blind < 5` (passes with 4 of 5 cost tables unreadable)
- `stats.js:131` / `152` / `168` — `ok: true` hardcoded (cancel / incoming / scheduler never fail)
- `stats.js:157` — `ok: n >= 0` tautology (quests probe can never fail)

Rule: every probe must have a falsy default (`ok: false`); explicit
checks for each truth condition.

---

## 22. Inline jtag inconsistent across bridge paths — LOW

`bridgePost` uses `jrnTag()`; `gameAjaxPost` constructs `jtag` inline
with a different shape. Stats rollups split across transports.

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
fetches scheduled earlier outlive a mid-iteration pause flip.

- `towns.js:168` — host/paused re-check inside forEach after parent path
- `towns.js:155` — HTTP fallback only when `state.towns` already empty
- `bandit.js:125-131` — offense filter deletes units while iterating `Object.keys` snapshot (OK for keys;
  mutating `units` mid-loop is intentional but easy to misread)

Rule: snapshot decision state at start of iteration; re-check only on
result, not mid-iteration.

---

## 24. Orphans / dead / fragile paths — LOW

- ~~`core.js:313` — `STORE.FARM_ACTION` legacy fallback~~ — **stale, see #15**: that
  fallback does not exist in the tree
- `spy.js:13-15` — no-op `_grepbot` re-bind branch
- `build-tab.js:213-221` — `finishInstantly` fallback never calls `ibLearnAction`
- Pattern #9 / #8 overlap: hidden-tab + thrash often co-occur on the same renderers

---

## Cross-cutting rules (consolidated)

1. **Every feature-catch must `gbLog`.** Pattern #1.
2. **Call sites should bail on `automationPaused` early; never bypass `bridgePost`/`gameAjaxPost`.** Pattern #2.
3. **Irreversible posts must reconcile inside callback.** Patterns #3, #5.
4. **Blind probe → `{blind:true}` + `gbLogT` once, defer to server (never fabricate 0/false).** Pattern #4.
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
