# Regression notes and helper archaeology

Moved out of `CLAUDE.md` so the always-loaded file stays small. Nothing here is
optional reading when you touch the subsystem it names — every entry is a bug
that shipped once. `CLAUDE.md` § *Hard rules* carries the one-line version of
each invariant; this file carries the reason.

Ordered newest-ish first inside each section, not strictly chronological.

---

## 1. Encoding

- **v2.9.1 mojibake**: the panel rendered `EconomÃ­a` / `ConstrucciÃ³n` / `Â·` /
  `â€¦` in-game while `src/` **and** the artifact were both valid UTF-8. Nothing
  was double-encoded — the browser simply decoded the injected script as
  Latin-1, because neither install path carries a charset (TM editor paste, or
  dragging a `file://` .user.js onto a tab; `.user.js` has no BOM and no
  `Content-Type`). Do not "fix" this by re-encoding `src/`, adding a BOM, or
  setting `document.charset` — the artifact is now pure ASCII (build gate 4),
  so there are no multi-byte sequences left for any charset guess to corrupt.
  Verified: the built file decodes byte-identically as UTF-8 and as Latin-1.

## 2. Preconditions and blind reads

- **v1.5.4 preconditions**: gaps closed were **research** (posted techs with no
  resource / research-point check — every scan burned a budget slot on a
  guaranteed rejection), **merchant** (bought without reading the gold balance),
  **rural trade** (no per-relation trade cooldown check, and it traded `wantRes`
  into a town whose `wantRes` stock was already at capacity — the haul evaporates
  on arrival; the dead `if (!blocked && !state.autoRuralTrade)` line it replaced
  could never be true, `autoRuralTrade` is asserted at the top of the scan), and
  **militia/dodge** (`request_militia` with no farm / militia already standing /
  no free population, and `dodgeSafeTown` dodging *into* a town that itself had
  incoming — one lost town becomes two). Do not "simplify" any of these into an
  unconditional post; the server rejection is not free, it costs a request budget
  slot and a decision-memory strike every cadence.
- **v1.5.3 audit**: free instant requires model gold===0 + `gameNow()`; never
  `buyInstant` fallback on timeout; olympic needs `allowPremiumCulture`+budget;
  quests `every()`+no DOM fallback; dodge hostile-only; attack town targets +
  overdue refuse; favor `temple_plunder`; recruit by unit building; host-gated
  scrapes/reports; claim/sleep reconcile; `gbXhr` budget+captcha skip.

## 3. Scheduling and locks

- **v1.1.0**: `orchTick` is the sole econ scheduler (cadence-aware). Do not
  re-add per-feature `gbInterval` for cave/culture/trade/farm/ab/… alongside
  orch — that was the thrash bug.
- **v1.4.0 lock registry**: never reintroduce a module-local `*InFlight`
  boolean. A boolean can only be cleared by the path that set it, so a callback
  that never fires strands the feature until reload, and the `beforeunload`
  reset block did not run on bfcache/mobile exits. Use `gbLock(name)` /
  `gbUnlock(name)` / `gbLocked(name)` and add a TTL entry to `GB_LOCK_TTL` for
  new features.
- **v1.4.0 orch**: one-feature-per-tick was a throughput ceiling (3 actions/min)
  AND a starvation bug (strict list order). Keep the per-tick budget + overdue
  tie break; do not "simplify" it back to a single `return` after the first
  match.
- **v1.4.0 adaptive cadence** infers "did the feature act" from the journal
  entry count for that feature, sampled 4s after the run — feature scans return
  void, so there is no return value to trust.
- **v1.6 instant arming**: the armed timer is an *accelerator*. Never delete the
  10s `gbInterval` or the click hook in favour of it — a clamped background
  timer can fire minutes late, and the interval is what recovers that.
- **Farm/town scrape deadlines**: `nextFarmScrape` / `nextTownsScrape` added in
  v0.3.2, **persisted to storage in v0.4.1** so cadence survives reloads. Stamp
  the deadline at the START of every scrape (prevents double-fire when manual
  `Farms now` / `Towns now` zero it); manual buttons zero the deadline + call
  `farmTick()`, never arm their own timer. Never use chained
  `setTimeout(scrape, 5min)` — background tabs throttle it to ~20min.
- **`scrapeAllFarms` empty-list early-return bug** (fixed v0.3.1): the next
  deadline MUST be stamped even when `state.farmsParsed.length === 0` (stamp
  happens before the fetch queue since v0.4.1).
- **Parallel farm fetch bursts** (N farms × 6 endpoint guesses) got throttled by
  the game server — only the first farm updated (v0.4.1: sequential queue +
  cached `farmAction`).
- **v1.3.5**: log/reqBudget use head-index rings (no `shift()` thrash); bandit
  wakes off `banditIdleUntil` instead of a fixed 1.5s interval; DOM
  MutationObserver scopes to `#ui_box`/windows/quests; CSRF hit poll is 120s +
  force-hunt on captcha/auth errors.

## 4. Transport, ack and templates

- **v1.6.1 gpAjax callback contract** (was: *everything* logged `err timeout`
  while the action actually executed). Read `GPAjax` in
  `archive/captures/grepo-dump/js/game.min.js`: `_ajax` wraps a **bare
  function** callback as a SUCCESS-ONLY handler
  (`u=function(e,i,o,r){if("function"==typeof a)a(i,r)}`), and the success
  branch is skipped whole when the response lacks `json`/`_srvtime`. So a
  server-side rejection (`json.error` → HumanMessage) and an empty bridge
  payload both leave the caller hanging until `BRIDGE_TIMEOUT_MS`. Two
  consequences: (1) the bare callback's args are `(data, t_token)`, **not**
  `(wnd, data)` — the window handle is only passed to the `{success,error}`
  object form; (2) every post now also registers `gbAjaxWatch(sig, settle)` and
  the XHR spy settles it from the raw response on `loadend` (`gbAjaxClaim`
  matches by `model_url|action_name` for the bridge, `controller/action`
  otherwise). Do not drop the watcher and go back to trusting the gpAjax
  callback, and do not drop the callback either — whichever fires first wins,
  `settled` dedupes. `captcha_required === true` is the real captcha flag the
  game itself keys on.
- **v1.6.3 template health** is charged per **learned payload**, never per
  feature key. Feature `build` carries two different posts: auto-queue `buildUp`
  (hardcoded payload — no template can be stale) and instant complete (the only
  user of `ibAction`/`ibActionR`). Because both journaled under `build`, five
  ordinary auto-queue server rejections invalidated `ibAction`, and the
  `tpl-stale` gate in `bridgePost` then blocked *both* features until a
  hand-click. v1.6.1 lit it: those rejections used to settle as `timeout`, which
  `jrnHard` excludes. `tplNameFor(feature, payload)` now resolves by
  `action_name`/`model_url`; add a new learned template to that resolver, not
  just to `TPL_FEATURE_MAP`. `tplHealthOk` also treats an unlearned template as
  healthy (the caller falls back to a constant) and expires an invalidation
  after 30min — the gate blocks the only post that could ever record an `ok`, so
  without expiry one bad streak was permanent.
- **v1.4.0 dry run**: `state.dryRun` short-circuits inside `bridgePost` /
  `gameAjaxPost` only. Any new transport must route through those two or dry run
  silently stops covering it.
- **v1.1.0 journal scoping**: decision journal keys are world-scoped (`wkey`) —
  a town/village id means nothing on another world, so an unscoped journal would
  skip valid targets after a world switch. Skip windows must ignore `skip:*`
  results: night pause fires thousands of times and would otherwise look like a
  dead endpoint. `renderLog` also bails when `.log-list` is `hidden` (Decisions
  sub-view active).
- **v1.6 phoenician**: the offer parser (`ptParseOffers`) was written against the
  server-rendered markup **without a live sample** — treat a parse miss as
  unknown (post nothing), and confirm with Config → *Copy offer HTML* before
  trusting a bulk trade. Never let the scraped stock be the only bound on the
  bulk amount.

## 5. Rendering

- **v1.4.0 keyed rows**: `renderFarms` / `renderWorld` / `renderAttack` patch
  keyed rows (`tr[data-key]`, `div[data-town]`) and rebuild only when the id
  **set** changes — compare membership, not order, or a user column-sort is
  wiped on every repaint. `renderAttack` no longer interpolates town names into
  `innerHTML`.
- **v4.48.0 `gbPaint(host, build, {key})`** (core) generalises that convention to
  every window. `build(stage)` fills a **detached** node; identical structure is
  then patched in place (text data + attributes, plus `value`/`checked` on any
  control that is **not** `document.activeElement`), so live nodes keep their
  listeners, their scroll offset, their `:hover` and whatever the user was
  typing. It never moves/inserts/deletes nodes — a structural difference falls
  back to a wholesale replace. `key` is the identity of what the handlers close
  over (job ids, town id, row order); when it changes the subtree is replaced
  instead of patched, so a kept button can never fire for a job that moved or
  left. Users: Queue Center body, `nativeRenderQueuePanel`, `renderAbQueue`, and
  every `gbWidgetRegister` widget (`o.key` optional). Do not replace a `gbPaint`
  call with a bare `replaceChildren()` loop on a timer — that is the bug it
  exists to prevent (the Build tab's target inputs were wiped mid-typing by any
  queue mutation, and the 1s HUD countdown rebuilt its whole window every tick).
- **Queue Center render contract (v4.47.0)**: `renderQueueCenter()` is a
  *request* (dirty flag + 90ms coalesce) — a sweep that touches 20 jobs paints
  once, not 20 times. `renderQueueCenterFlush()` is the click path: paints now
  and skips the throttled `nativeQueueReconcileTown` because the mutation
  already reconciled the lane. Every paint renders into a detached node and
  swaps only when `queueCenterSig()` (innerHTML with the `.gb-qc-eta` cells
  blanked) differs; on a skipped swap the fresh eta baselines are copied onto
  the live cells. Real-queue clocks are moved by a 1s ticker that only writes
  text into `.gb-qc-eta` (`data-eta` seconds + `data-t0` stamp) and asks for one
  repaint when a row reaches 0. Background paints defer while a `<select>`
  inside the window holds focus.

## 6. Parsers and bridge discovery

- **v0.4.2**: farm discovery + claims + bandit moved to the game bridge
  (`MM`/`ITowns`/`gpAjax`) copied from ModernBot
  (github.com/Sau1707/ModernBot, `src/autoBootcamp.js` + `src/autoFarm.js`).
  DOM-only bandit clicking never worked unless the camp window was open and
  attackable — the model path needs no window.
- **v0.4.3**: objects passed INTO page functions must go through `cloneInto` in
  content-script contexts; the userscript sandbox only needs `unsafeWindow`. XHR
  spy sniffs request BODIES on `frontend_bridge` (`sniffBridgeBody`) — a manual
  Recoger click teaches the exact claim payload (`claimTpl`, persisted) that
  `claimFarm` mimics. `verifyClaims` re-reads relations 10s after firing and
  logs whether `lootable_at` flipped. `farmsFromGame` tries both
  `getOnlyCollectionByName` and `getCollections().FarmTownPlayerRelation[0]`,
  logs relation status distribution once per session.
- **`parseFarms`** accepts `12345 500 600 | notes` (bare id, no leading pipe)
  since v0.4.1; pipe format `id | x y | eta | notes` is still canonical.
- **Auto-collect regex must be anchored**: `/^\d{1,2}\s*min$/` — hour strings
  (`1h 30min`, `4h`) won't match, so they're skipped automatically.
- **v0.5.0 (merge)**: standalone `grepInstantBuild.js` (`@grant none`, page
  context) was ported into the Build tab. Two port gotchas: (1) the userscript
  is sandboxed, so `GPWindowMgr`/`gpAjax` MUST be reached via `gameUw()`, never
  `window.`; (2) auto-complete needs an in-flight guard (now `gbLock`) or a
  completion wave longer than the 10s scan interval re-fires and double-posts.
  `fetchReport` stamps `state.seen` only after a successful parse — stamping on
  any HTTP response lost reports to transient error pages.

## 7. Forks and dead branches

- **v2.7.0** merged the out-of-tree `GrepBot-2.5.9.user.js` "híbrido" fork. That
  file forked well before 2.5.9 (94 of 639 shared functions differed from the
  repo's own v2.5.9 build), so only two things came across: the Queue Center
  window and `jrnTransientDynamicResult`. Everything else the fork carried was
  **older**, and re-porting it would undo a named fix — its `nativeQueueAdd*`
  refused appends while the head was in flight (undone in v2.5.4), its
  `nativeQueueReconcileBuild` only reconciled `inflight.accepted` (leaving an
  un-acknowledged post stranded), and its `nativeUiScan` picked one host tile per
  building by visibility score instead of the v2.5.5 body-level panel mount. The
  fork also predates `gbAjaxWatch`, `captcha_required`, phoenician trade and the
  evidence system. Do not merge from it again without re-running the per-function
  diff.
- **Retired surfaces**: the WebExtension build (`web-ext/`, `grepbot.xpi`) and
  the standalone `grepInstantBuild.js` were retired in v0.5.0. The local relay
  (`src/relay.js`, `tools/relay-mcp/`, `.mcp.json`) and its two header pills
  were removed in v5.2.2; only the `airaw` write-feature + lock TTL entries
  survive, deliberately, so a future raw-payload caller inherits the guards.
  Any memory note describing an `.xpi` rebuild or a relay MCP is stale.

---

## 8. Better-practice helpers (v4.62–v4.65 sweep) — full notes

Platform primitives, no new dependencies. `CLAUDE.md` lists the names; the
detail is here.

- **`structuredClone(value)`** — prefer over `JSON.parse(JSON.stringify(x))` for
  any config / state snapshot. Preserves `Date` / `Map` / `Set` / `RegExp` /
  `ArrayBuffer` / typed arrays / `Error` with `cause` / `stack`, handles
  circular references, throws `DataCloneError` instead of silently dropping
  `undefined` / functions / `Symbol`s. Used in `qol.js` (`qolConfigSnapshot` /
  `qolSaveTemplate` / `qolApplyTemplate` / `qolImportConfig`).
- **`BOOT_TIMING`** (`src/boot.js`) — frozen module-scope object of every cadence
  the boot block uses (INBOX_SCRAPE_MS, FARM_TICK_MS, THRESHOLD_CHECK_MS,
  STATUS_UPDATE_MS, OVERVIEW_RENDER_MS, LOCK_SWEEP_MS, NATIVE_QUEUE_LOOP_MS,
  plus boot-step delays FARM_WAKE_MS / QUEST_SCAN_BOOT_MS / IB_SCAN_BOOT_MS /
  AB_TARGETS_MS / NATIVE_UI_SCAN_MS / NATIVE_QUEUE_BOOT_MS /
  ORCH_FIRST_TICK_MS / HUD_RESTORE_MS / IB_CLICK_HOOK_MS, plus
  FIRST_FARM_DEADLINE_MS / FIRST_TOWNS_DEADLINE_MS that pair with the persisted
  `state.nextFarmScrape` / `state.nextTownsScrape` deadlines). A naked `30000` /
  `15000` / `10000` in `boot.js` is a regression.
- **`txRunAsync(feature, transport, endpoint, data, rawSend, opts)`**
  (`src/tx.js`) — Promise wrapper around `txRun`. `opts.signal` cancels the
  OUTER promise via `AbortController`; the in-flight tx keeps going through its
  own state machine (server post + reconcile are already race-safe). Opt-in for
  modules that already use async; callback callers are unchanged.
- **`gbLit(html)` / `gbSafe(html)`** (`src/core.js`) — two named buckets for
  `innerHTML`. `gbLit` is LITERAL HTML ONLY (pass-through; the audit pass greps
  `innerHTML = gbLit(...)` and confirms no `${…}` interpolation). `gbSafe`
  routes through `DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })`
  for any markup that includes a wire value. Requires the `@require` DOMPurify
  line in `src/header.js`.
- **`statsYieldToMain()`** (`src/stats.js`) — `scheduler.yield()` when available
  (Chrome/Edge 129+, Firefox 142+), `setTimeout(0)` otherwise. The web.dev
  optimize-long-tasks deadline-batched shape; ready for the next async refactor
  of the `evidenceLastByFeature` / journal rollup walks.
- **Listener bag `AbortController`** (`src/core.js`) — one per-instance
  `AbortController`; every `gbListen` call passes `{ signal: gbListenerSignal }`
  so dispose calls `gbListenerAbort.abort()` and detaches every listener in one
  call. The bag survives as a debug mirror only.
- **`gbPaint` selection preservation** (`src/core.js`) — snapshots
  `document.activeElement.id` + `selectionStart` / `selectionEnd` /
  `selectionDirection` before a structural replace; restores focus + caret in the
  new tree via `CSS.escape(id)` + `setSelectionRange`. The patch path was already
  safe via the `activeElement` skip on `.value` / `.checked`; this guards the
  rarer REPLACE path.
- **`renderLog` rAF coalesce** (`src/core.js`) — a visible tab coalesces per
  frame via `requestAnimationFrame` so a burst of log lines paints once, not
  once-per-line. Hidden tab keeps a 250ms `gbTimeout` (rAF is paused).
- **`scheduleAutoCollect` rAF** (`src/collect.js`) — same pattern for the
  `MutationObserver` → auto-collect path; visible tab coalesces per frame,
  hidden tab keeps the 800ms timer.
- **JSON.parse size cap** (`src/bridge.js`) — `gbAjaxUnwrap` caps the
  `JSON.parse` input at `GB_AJSON_PARSE_MAX = 256 KB`. `noteCaptchaBody` still
  sniffs only the first 4 KB upstream; this guard is the second line against an
  oversized hostile body. The largest legitimate bridge payload today is the
  all-towns scrape at ~32 KB.
- **Captcha status pre-check** (`src/bridge.js`) — `gbAjaxWatch`'s settle
  callback classifies status-first: 429 / 503 open the server-pressure bus with
  `Retry-After` parsed to seconds; a 200 with an empty body short-circuits to
  `'soft-empty'` (a skip class, not a hard error, so three in a row don't open a
  `JRN_BACKOFF` skip window for nothing). `captcha_required === true` precedence
  is preserved.
- **`saveSoon(key, val)` / `saveFlush()`** (`src/core.js`, v5.3.0) — 400ms
  coalesced `GM_setValue`. `state` stays live in memory; only the write is
  debounced, last value per key wins. The village sweep was the motivating case:
  `fetchFarmResources` wrote the **whole** `state.farmResources` map and
  `towns.js` the whole `state.townResources` map once **per village/town**, so a
  40-village account paid 40 full serializations per 5min cycle. `whyNote` had
  the same shape (the entire 200-row `whyLog` re-serialized per decision note).
  **A debounced write is only safe because of the flush**: `saveFlush()` is
  called from `releaseLocks` (`boot.js`, on `pagehide`/`beforeunload`) as the
  LAST step — after every other handler has had its chance to queue a write —
  and from `__grepbotDispose` BEFORE `gbClearTimers()`, or the pending timer dies
  with its payload. `txSave` is deliberately left synchronous: a `committed`
  transaction must be durable immediately, since the recovery path for a lost
  write is re-posting an irreversible action.
- **`renderFarmsSoon` / `renderWorldSoon` / `checkThresholdsSoon`** (v5.3.0) —
  same fix on the paint side of that cascade; `checkThresholds` is a full walk of
  `farmsParsed`, and calling it per village made the sweep O(N²) for an answer
  that only depends on the finished state.
- **Hidden-tab render guards** (v5.3.0) — `renderTimers` (1s) called
  `farmClaimTiming()`, which walks the whole `FarmTownPlayerRelation` collection,
  against a tab nobody was looking at; `contextMenuScan` (750ms) ran
  `querySelectorAll` + `getBoundingClientRect` + `elementFromPoint`, three forced
  layout flushes 80×/min, likewise. All now bail on `document.hidden`, and
  `boot.js` repaints on `visibilitychange`/`pageshow` so the first visible frame
  is correct instead of a frozen countdown. The context menu deliberately does
  NOT dispose while hidden — a hidden tab is not a closed popup.
  **Note:** `renderFarms` / `renderWorld` also grew a hidden-section guard, but
  their hosts (`.farms-list`, `.world-list`, `.world-totals`, `#gb-sleep-status`)
  are **absent from the panel markup** in the current tab set, so both functions
  early-return on every call today. They were left in place rather than deleted:
  restoring those tables is a product decision, not a cleanup.
- **`SPY_LOAD_GATE_RE`** (`src/spy.js`, v5.3.0) — the XHR `load` reader used to
  be attached to **every** game request and, under 100KB, read `responseText` and
  ran a full `JSON.parse` plus a recursive report walk. The SPA issues these
  constantly. The listener is now attached only when the URL could plausibly
  carry a report or quest reward. A bare `/index.php?...` is deliberately NOT in
  the gate — it is the game's generic endpoint and matches nearly every request,
  which is the exact cost being removed. The tradeoff: the >100KB "report_id
  buried in an unnamed payload" scavenger no longer runs on those responses;
  named report URLs are still caught on the send path by `queueReport` /
  `queueReportList`.
- **Keyboard fingerprints** (`src/qol.js`, v5.3.0) — `gbKeyFingerprints` had
  `if (e.altKey) return []`, so **every** `Ctrl+Alt+…` binding was unreachable,
  and `gbKeyChars` only emitted single printable characters, so any binding on a
  named key (`Backspace`, `Escape`, …) could never match either. Both were silent
  — the binding simply never fired. Modifier order in a binding string is now
  fixed as `Ctrl+Alt+Shift+<key>`; Ctrl/Meta is still REQUIRED so a bare
  `Alt+key` still belongs to the game. New defaults: `Ctrl+Shift+Backspace`
  (panic — no confirm on the way in on purpose, it is the kill switch and is
  itself reversible via `gbPanicRecover`), `Ctrl+Alt+P` (profiler),
  `Ctrl+Shift+B` (copy bundle).
- **`Error.cause` on swallowed catches** — bare `catch (_) {}` in `alerts.js`
  (webhook save paths, desktop notify, intel digest) and `boot.js` (boot ticks,
  `visibilitychange` / `pageshow` handlers, releaseLocks sequence) route to
  `gbLogT('silent-err:tag', 60_000, 'name: ' + String(e?.message || e).slice(0, 80))`.
  The surrounding tick keeps running; the cause lands on the Log tab.
- **Favor pool attribute names** (`src/favor.js`, `src/stats.js`, `src/recruit.js`,
  v5.8.4) — every favor read probed `fav[god]` / `fav['favor_' + god]` and, for
  the cap, `max_favor_<god>` / `favor_<god>_max` / `max_<god>`. `PlayerGods`
  carries **none** of those names. From the captured client bundle
  (`archive/captures/grepo-dump/js/game.min.js`, `GameModels.PlayerGods`): the
  pool is `<god>_favor` (the model fires `change:<god>_favor`), the cap is a
  single global `max_favor`, and `production_overview` is
  `{ <god>: { current, production } }` with production in favor/hour. Symptoms:
  the HUD block printed `favor (dioses) no legible`, Preflight reported
  `0/8 pozo(s) legibles, 0 con maximo legible`, and `recruitCanBuild` /
  `recruitAffordableAmount` refused every mythical unit because the pool read
  came back `NaN`. Now there is ONE reader (`favorForGod` / `favorMaxPool` /
  `favorProdPerHour` / `favorGodsList` in `favor.js`) that every consumer calls;
  the legacy flat shapes stay as trailing probes, never as the primary. The HUD
  also prefers the client's own production number over its measured rate, so the
  ETA column is exact on the first paint instead of after two samples.
- **Farm scrape breaker could never revive from traffic** (`src/farms.js`,
  v5.8.4) — `learnFarmAction` returned early when the observed action equalled
  the stored one, and the `farmScrapeRevive` call sat *after* that return. On a
  world whose action had been learned in an earlier session the advertised
  recovery was impossible: the breaker tripped, Preflight said "teach it by
  opening a village", the player opened one, the identical action came back over
  the wire, and the breaker stayed dead until the Config toggle was cycled.
  Evidence is evidence whether or not the string changed — the revive now runs on
  every observation.
- **`tx registry` counted tombstones as live posts** (`src/stats.js`, v5.8.4) —
  the `inflight` regex matched `dryrun` and every terminal state
  (`aborted|failed|unknown|manual-review`) as well as the moving ones, so a
  registry full of tombstones reported `384 transactions, 213 live, 213 unknown`:
  the same entries counted twice, under a label claiming posts were in flight.
  `live` is now planned/precheck/sending/confirming/reconciling only, and
  `unknown` (still self-reconciling) is reported apart from `manual-review`
  (waiting on a human), in both the `tx registry` and `guards` probes.
- **manual-review tombstones grew without bound** (`src/tx.js`, `src/planner.js`,
  v5.8.4) — nothing has ever pruned `manual-review`, by design: it is a blocking
  tombstone. But it also kept its full reconciliation snapshot forever, and a
  live account reached 213 of them. `txPrune` now strips the snapshot down to
  `{kind, qid}` (all `txPrune` and `questClearReviewForTx` ever read back) when an
  entry becomes a tombstone, and `txCapReview` caps the pile at
  `TX_REVIEW_MAX = 100`, dropping oldest-first and **only** entries older than
  `TX_REVIEW_MIN_AGE_MS` (7 days), with a `gbLog` line. Nothing younger can be
  dropped and nothing is dropped silently.
- **`academy read path` probed the wrong town** (`src/stats.js`, v5.8.4) — the
  probe read `towns[0]`, but the research queue is a per-town fragment the client
  only fills for the town on screen. On any account whose first town is not the
  open one the probe reported `real queue UNREADABLE` and, through
  `researchPointsSpent`, `research points UNREADABLE` — a permanent warning about
  a read path that works. It now probes the open town (`Game.townId`) when that
  town is in the list, and names which town it read.
- **Wall damage / hero stamina are not in this client at all** (`src/build-auto.js`,
  `src/military.js`, `src/stats.js`, v5.8.4) — both readers were written as "the
  attribute name has not been captured yet". The captured bundle settles it:
  `GameModels.PlayerHero` declares level / experience_points / home_town_id /
  origin_town_* / target_town_* / cured_at / assignment_type / type and nothing
  else, and the only `*damage*` identifiers in the whole file are battle-report
  unit counts. The probes stay (a different world may ship a different build) but
  Preflight now says the client does not expose the value instead of implying a
  capture is pending, and the hero row only warns when `autoHero` is ON.
