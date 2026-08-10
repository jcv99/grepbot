# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

GrepBot = Grepolis scout + farm + build + trade + culture + (opt-in) military
automation. One Tampermonkey userscript (built from `src/` modules).
**ToS-breaking** — runs against any `*.grepolis.com` world. Ban risk is
user-accepted. HIGH-RISK toggles (recruit, dodge auto, favor) default OFF.

## Repo layout

```
src/                  # feature modules — concat order matters (build.py)
  header.js core.js journal.js spy.js parse-inline.js farms.js towns.js
  collect.js bandit.js build-tab.js cave.js culture.js trade.js rural.js
  research.js alerts.js merchant.js favor.js wonder.js dodge.js recruit.js
  qol.js orchestrate.js intel.js quests.js attack.js military.js stats.js
  queue-center.js ui.js boot.js footer.js
build.py              # python3 build.py → grepbot.user.js (concat + gates)
.build-stamp.json     # build gate bookkeeping (src hash + last built version)
grepbot.user.js       # built output — paste this into Tampermonkey
docs/
  ROADMAP.md          # Ultimate path: Phase 0 + 1–7 DONE + 8–14 coded
  TASKS.md            # current checklist (in-game validation gates)
  audit-findings-*.md # point-in-time audit reports
archive/              # nothing here is needed to build or run
  grepbot.user.js.bak # pre-0.5.0 backup (historical; has dead server sync)
  split_modules.py    # one-off: re-split grepbot.user.js back into src/
  data/               # optional local dumps — findings JSON from Export
  captures/           # saved game page + HAR + grepo-dump (reverse-eng refs)
```

Repo root is deliberately minimal: `grepbot.user.js`, `build.py`, `src/`,
`CLAUDE.md`. Everything else lives under `docs/` or `archive/`.

**NO SERVER.** There is no `server.py`, no `127.0.0.1:35657`, no `/api/*`,
no XPI self-update, no log relay. Bot is paste-only: build → install
`grepbot.user.js` in Tampermonkey → Export/Copy from the panel.

Module concat order is dependency-driven: `header.js` opens the IIFE,
`core.js` defines shared state/bridge/logging/storage, then feature
modules, `boot.js` runs setup/teardown at the end, `footer.js` just
closes the IIFE. Reordering breaks top-level declarations.

The WebExtension build (`web-ext/`, `grepbot.xpi`) and the standalone
`grepInstantBuild.js` were retired in v0.5.0. **v1.0.0** ships Phase 0
foundation + Phase 8.2–8.13 competitor parity + Phases 9–14 spine
(orchestration, military helpers, intel moat, hardening). HIGH-RISK
features (favor, dodge auto, recruit) default OFF — ToS escalation.

## Build

Edit files under `src/`, then:

```sh
python3 build.py
```

`build.py` is no longer a blind concat (v1.4.0). It refuses to write the
artifact when a gate fails:

1. **duplicate top-level declarations** across modules — everything lives in one
   IIFE, so two modules declaring the same `function`/`const` name is a hard
   redeclare/TDZ failure. Build exits 1 and names both modules.
2. **`node --check`** on the concatenated output (skipped with a warning when
   `node` is missing) — syntax errors never reach Tampermonkey.
3. **version reminder** — `src/` changed but `@version` in `src/header.js` did
   not → warning (not fatal). State lives in `.build-stamp.json`.
4. **ASCII artifact** (v2.9.1, `ascii_escape_artifact`) — every non-ASCII char
   in the JS body is rewritten to `\uXXXX` (surrogate pairs for astral), so the
   shipped file has zero bytes above 0x7F. Runs before `node --check`, so the
   check validates the bytes that ship. The `==UserScript==` block is **not**
   JS — TM parses it as text, so an escape there would ship literally into the
   install dialog; non-ASCII in `src/header.js` is a hard error instead.

Write UTF-8 in `src/` as normal — `á`, `·`, `—`, `→` are all fine. The escape
is a build step, never a source convention.

## UI language (v1.6.2)

The **panel UI is Spanish**: tab/group labels, buttons, Config labels and
tooltips, placeholders, `flash()` / `confirm()` / `prompt()` text, empty-state
rows, Overview / Intel / Stats / Preflight bodies. Deliberately **not**
translated (they are machine surface, not UI):

- `gbLog` / `gbLogT` messages and `diagRun()` output — they are correlated with
  `docs/error-patterns.md` and pasted into issues.
- journal result codes (`ok`, `skip:*`, `remembered`, …), feature keys, lock
  names, `data-*` attribute values, ids, CSS classes, storage keys.
- `<option value>` attributes. When translating an option label, **pin an
  explicit `value`** — `[data-atk=mission]` and `[data-cfg=rural-res]` submitted
  their option *text*, so a bare `<option>attack</option>` would have shipped
  `mission: 'ataque'` to the server.
- `abAffordScratch` short-strings (`wood 100/200`, `pop 5/10`) — `abEtaMs`
  regex-matches `wood|stone|iron` and `startsWith('pop ')`. Only the display in
  `abPlanVerdictLabel` maps them through `AB_RES_ES`.
- DOM fallback needles keyed off the game's own markup (`marketLocale()`,
  `/^\d{1,2}\s*min$/`, the `Recoger` button text).

Resource wording follows the game's Spanish client: `iron` renders as **plata**.

## Tooling

No linter, no test runner, no Node workflow — **paste-only mode**. Phase 7
explicitly removed the parser test harness. Validation is manual in-game
on `es146` (see docs/TASKS.md). Don't introduce `npm test` / `eslint` /
prettier; if a parser needs verification, eyeball fixtures in `archive/data/`
or log via `gbLog` from the panel.

## Manual validation evidence

Optional dumps may land in `archive/data/`: findings JSON from Export.
Panel Log tab is the live log — nothing is POSTed off-box. `archive/grepbot.user.js.bak`
is the pre-v0.5.0 monolithic build kept as a rollback reference.

## Architecture

Single-script loop pattern:

- **Config tab** (v0.6.0): collect-all, auto-bandit, auto-farm, auto-build, auto-cave toggles; `IB_FREE_THRESH`, `COLLECT_MAX_MIN`, cave thresh %, sync interval, farm/town cadence; per-host enable. Footer = actions + status badges only.
- **Captcha breakers** (v0.6.0): `bridgePost(feature, payload, cb)` wraps all bridge automation (farm claim, bandit, buyInstant, attack send, cave stash). On captcha response → feature pauses 5/15/60min exponential backoff; status line shows `⏸farm,bandit,…`.
- **Attack planner v2** (v0.6.0): `sniffBridgeBody` learns Town attack template; planner dialog has Copy + **Send attack** (confirm gate, payload logged). ToS escalation — manual confirm only.
- **i18n** (v0.6.0): `marketLocale()` keyed by `Game.market_id` for DOM fallbacks (collect button text, etc.). Bridge paths are locale-free.
- **Dry run** (v1.4.0, `state.dryRun`, Config, default OFF): `bridgePost` /
  `gameAjaxPost` log the payload (`DRY-RUN <feature>: {…}`), journal it as
  `skip:dryrun`, and send nothing. This is the safe way to validate a payload
  against a hand-clicked action before enabling a HIGH-RISK loop — the whole
  docs/TASKS.md gate list can be walked with it. Footer shows `🅳DRY`.
- **Lock registry** (v1.4.0, `gbLock`/`gbUnlock`/`gbLocked`/`gbLockSweep`):
  replaces the 16 per-module `*InFlight` booleans. Every lock carries an
  acquisition stamp + TTL (`GB_LOCK_TTL`, default 120s); a 10s sweeper releases
  anything stale and logs it. A dropped callback can no longer strand a feature,
  and bfcache/mobile exits (where `beforeunload` never fires) recover on their
  own. `pagehide` + `beforeunload` both call `gbUnlockAll()` as best effort.
- **Server pressure bus** (v1.4.0, `gbServerCooldown` / `gbServerPaused`):
  429/503/`Retry-After` on the GM_xmlhttpRequest paths **and** rate-limit-shaped
  bridge errors now open one global cooldown that `automationPaused` honours
  (reason `server`), so bridge posts back off with the scrapers. Footer shows
  `⏸srv:<time>`.
- **Stats tab + Preflight** (v1.4.0, `stats.js`): Stats renders journal rollups
  (per-feature ok/err/captcha/skip + success rate, top errors, top skip reasons,
  farm claims + instant completions, live scheduler cadences, request budget,
  held locks) over a 1h/24h/7d window. **Preflight** (Stats tab or Actions menu)
  probes every module's read path only — collections present, learned action keys
  (`claimTpl`, `ibAction`, `ibActionR`, `attackTpl`, farm option map), readable
  capacity — and prints pass/warn/fail. It sends nothing.
- **Shared warehouse reader** (v1.4.0, `townResState(townId)` in core, 3s memo):
  one definition of capacity/fill for farms, cave, trade and sleep-claim.
  `townWarehouseState` in farms.js is now a thin wrapper.
- **Precondition readers** (v1.5.4, core): `gbProbeNum` / `gbProbeAttr` (probe a
  list of build-specific getter/attribute names, keep the first finite number),
  `gbTownModel`, `gbTownPop`, `gbPlayerGold`, `gbBuildingLevel`, and `gbAfford`
  (`{ok, blind, short, detail}` for a `{wood,stone,iron,population}` cost).
  **Every feature must check before it posts** — resources, free queue slot,
  timer elapsed, container not already full. The invariant: *a check may only
  block on a value it actually read*. Client builds rename getters, so a missing
  field means "unknown", not "no": the verdict is `blind`, the feature logs once
  (`gbLogT`) and lets the server be the authority. A guard that goes silently
  dead when a getter is renamed is worse than no guard. Preflight's **cost
  reads** row shows which of stock/population/gold/research-cost/building-cost
  are readable right now.
- **Game bridge** (ModernBot-style): `gameUw()` → `unsafeWindow`. Reads backbone models and sends actions via `gpAjax.ajaxPost('frontend_bridge', 'execute', …)`. Prefer over DOM/HTTP guessing; HTTP/DOM remain fallbacks.
- **Auto-farm claims** (`autoClaimFarms`, toggle `autoFarm`, default OFF): every 60s, claims every controlled farm village (`FarmTownPlayerRelation` claim, `arguments:{farm_town_id,type:'resources',option:<idx>}`, `town_id` = own town on the same island) → collects loot + restarts the gather. Success only after bridge callback + `lootable_at` reconcile. Villages auto-discovered into `farmsParsed` (`mergedFarms`), textarea now optional/manual-only.
- **Claim timers** (v1.3.0): the claim `option` index is world/client specific, so it is **learned**, never guessed — `farmLearnOptionFromClaim` watches a hand-clicked claim, re-reads `lootable_at` 4s later and snaps the delta to `FARM_DURATIONS` (300/600/1200/2400/5400/14400/28800s), storing `state.farmOptionMap` world-scoped. Seed is `{300:1}` (the payload the bot always sent). Unknown duration → log once + fall back to 5min. `farmDesiredDuration` picks **10min where the villager-loyalty research is done, 5min elsewhere** (`farmLoyaltyResearched`, techs read via `researchTownTechs`, loose match `/loyal|lealtad|diplom|conscript/i`, pinnable in Config, 60s cache). Toggle `farmLongClaims` (default ON).
- **Sleep claim 4h/8h** (`farmSleepClaimNow` / `farmSleepAutoTick`): Farms-tab button, plus optional auto (`farmSleepAuto`, default OFF) that fires **once per local day** when the option is learned, the haul ends before 24:00, ≥80% of villages are claimable, and every owning town is under `farmSleepFillPct`% warehouse fill (default 60). Duration select `farmSleepDur` = auto/4h/8h; `farmSleepDay` (world-scoped) is stamped **after** verified claims, not before. Runs off `farmTick` (15s).
- **Custom build queue** (v1.6, `state.abCustomQueue`, world-scoped): ordered
  per-town list `{townId: [{b, lvl}]}` consumed at the head of `buildPlanNext`;
  the weight/ETA heuristic only fills the slots left over. `abQueueStrict`
  (default ON) waits on an unaffordable head entry instead of building past it;
  `blind` cost still never blocks. Entries self-prune via `abCqPrune` once the
  level is reached (queued orders count). A non-empty queue supersedes the pin.
- **Instant build arming** (v1.6): each order carries `active` (the only order of
  a town whose clock runs); `ibArmNext` arms ONE timer at
  `remaining - ibFreeThresh()` +1.2s +jitter so the free post lands at ~4:58,
  and `boot.js` re-scans on `visibilitychange`/`pageshow` (hidden tabs clamp
  timers). The 10s loop stays as the safety net. `ibTownCollections` reads every
  town's own `buildingOrders()`/`researchOrders()` via `abGetTown`, merged with
  the MM collection and deduped by id — the MM collection only carries loaded
  towns, so free orders elsewhere used to be invisible.
- **Phoenician ratio pump** (v1.6, `phoenician.js`, `autoPtTrade` default OFF):
  merchant-ship resource offers open at 0.5:1 and gain +0.1 per trade, so the bot
  fires `pumpAmount` (1) trades until `targetRatio` (1.0) then one bulk trade.
  The window is server-rendered: the view URL and the trade payload are both
  **learned** from the player's own traffic (`ptLearnFromXhr`), offers are parsed
  from markup (`ptParseOffers`, unknown markup = post nothing), and the loop
  aborts if the ratio does not move after a pump. All posts go through
  `gameAjaxPost('pttrade', …)`.
- **Auto-cave** (`caveScan`, toggle `autoCave`, default OFF, v0.7.0 / Phase 8.1): every 30s, for each enabled town with a hide building, if iron ≥ `caveThreshPct`% of warehouse (default 90%), stash excess via `BuildingHide`/`storeIron`. Finite full → skip (`stored >= hideLvl×getMaxStorageLimitPerHideLevel()`; ∞ sentinel is `-1`, never `hideCap >= unlim`). Max-level hide still stashes. Unreadable finite cap/stored → skip (no blind post). Per-town checkboxes in Config. Feature key `cave` on captcha breaker.
- **Auto-culture** (`cultureScan`, `autoCulture`, default OFF): festival / procession / theater via `building_place`/`start_celebration`. Olympic is **50 gold + Academy 30** — requires `allowPremiumCulture` + daily `cultureGoldBudget`; never modeled as resources. Projected KP/res/gold ledger per sweep.
- **Inter-city trade** (`tradeScan`, `autoTrade` / `islandShip`): `town_info`/`trade` Fill Storage + mainland→island ship. Presets `party`/`unit` are unimplemented (log+skip), not silent storage aliases.
- **Rural trade/level** (`ruralTradeScan` / `ruralLevelScan`): `FarmTownPlayerRelation` trade / unlock / upgrade.
- **Auto-research** (`researchScan`, `autoResearch`): `building_academy`/`research` with CS-fast preset.
- **Webhooks** (`alertWebhook`): optional Discord URL; captcha / attack / culture events, 5min rate-limit.
- **Merchant / favor / wonder** (`merchantScan` / `favorScan` / `wonderScan`): default OFF; favor is HIGH-RISK (requires `temple_plunder`, farm_town target). Merchant: exact item id + explicit price; no timeout→fallback. Wonder day from `gameNow()`.
- **Dodge / militia / CS** (`dodgeScan`): notify (default) or auto; CS badge + webhook. Auto dodge HIGH-RISK. Hostile-only canonical types (`is_attack` / attack command names) — never `incoming`/`started_at` alone. Militia is its own toggle + captcha feature.
- **Auto-recruit** (`recruitScan`, default OFF, HIGH-RISK): controller from unit metadata (barracks / docks / temple). Spells require explicit power id — never default to `call_of_the_ocean`. Unknown unit cost blocks.
- **Orchestration** (`orchTick`, v1.1.0, rebuilt v1.4.0): cadence-aware sole scheduler for econ features (farm/cave/culture/trade/ab/…); no parallel per-feature intervals. `ibScan` / `dodge` / scrapes stay on their own timers. v1.4.0: up to `ORCH_MAX_PER_TICK` (3) due features per 20s tick spaced ~450ms — one-per-tick capped the whole econ at 3 actions/min while cave+build+recruit alone want 6; overdue-ness breaks priority ties past 2 ticks so the tail of `priorityOrder` cannot starve; cadences carry ±20% jitter so features do not re-align into periodic bursts; **adaptive backoff** (`state.orchAdaptive`, default ON) doubles a feature's cadence up to 8× after 4 runs that posted nothing (measured by journal entry count) and resets on the first post. `orchStatus()` feeds the Stats tab.
- **QoL** (`qol.js`): pause-on-activity, night pause, city templates, Overview health, config import/export.
- **Intel** (`intel.js`): threat board, dossiers, player notes, Grepodata Index+ assist, watchlist (matches `f.town.id`).
- **Hardening** (v1.0.0 + v1.5.3 audit): global captcha kill-switch, request budget/min (bridge + `gbXhr`), `gameAjaxPost`, module health, captcha skips consumer onload, host-gated scrapes/reports, timeout ≠ retry for irreversible actions.
- **Instant build + research** (`ibScan`/`ibCompleteAll`, toggle `ibAuto`, default OFF): every 10s reads orders via `gameNow()`; free only when remaining ≤ thresh **and** `GameDataInstantBuy` price === 0. Posts `completeInstant` (or sniffed free action); **never** auto-falls back to `buyInstant`. Timeout → reconcile only. Academy research shares the path (`ibActionR`).
- **Auto-bandit v2** (`banditViaGame`): reward via `hasReward()` → `useReward`/`stashReward`; cooldown via `getCooldownDuration()`; en-route check via `MovementsUnits[*].destination_is_attack_spot`; attack = all land units of current town (militia/naval stripped) → `action_name:'attack'`. DOM fallback uses select-all only (no `maxlength` invent). Model path works with NO window open.
- **Quests** (`quests.js`, v0.6.x): auto-claim only when **every** reward is safe; no DOM fallback after bridge timeout; success after model reconcile.
- **Decision memory** (`journal.js`, v1.1.0): every `bridgePost` / `gameAjaxPost`
  exit — success, error, captcha, timeout, and every skip (`disabled`, `paused:<reason>`,
  `captcha-pause`, `budget`, `noajax`, `remembered`) — is journaled world-scoped
  (`state.decisions`, ring buffer 400, 7-day TTL, batched save 5s + flush on
  pagehide/hidden). Identical decision+result inside 10min bumps `n` instead of
  burning a slot. 3 consecutive *hard* errors on the same `feature|action|target`
  open a 5/15/60min skip window (`state.decisionSkips`) and later posts short-circuit
  with `'remembered'`; success clears it, expiry decays one trip. captcha/timeout
  never trip it (their own breaker owns that). Toggle `decisionMemory` (Config,
  default ON) disables skipping only — recording always runs. Read API for feature
  modules: `gbFailStreak` (`gbRecall` / `gbRecallAll` / `gbRemember` were never
  called by any module and were removed in v2.5.7). UI: Log tab →
  **Decisions** sub-view (filter, Copy JSON, Clear skips, Clear journal); footer
  status shows `mem:<n>` while windows are open. **Transient results are not
  memory** (v2.7.0, `jrnTransientDynamicResult`): `planner-wood:…` /
  `-stone` / `-iron` / `-population` / `-tradeCap` are a live shortage, so they
  journal as `skip:` instead of a hard error, and `jrnSkipped` deletes any window
  an older build persisted from one. Three shortages in a row used to freeze a
  now-affordable action for 5–60min.
- **Queue Center** (`queue-center.js`, v2.7.0, header button `Colas` + TM menu
  `GrepBot: colas`): one draggable window with a town selector and four tabs
  (Construcción / Investigación / Cuartel / Puerto). Each tab renders the game's
  **real** queue beside GrepBot's virtual FIFO plan for the same lane, with
  reorder / pause / remove. It mutates only through `nativeQueue*`, so the
  tab-leader gate, the in-flight freeze and the prerequisite-removal blocker in
  `nativeQueueRemove` all still apply; removal reuses the same confirm ladder as
  `nativeRenderQueuePanel`. Barracks and docks share ONE recruit lane — the list
  is filtered by hull type but positions and reorders speak the global index.
  `nativeQueueSave` / `nativeQueueSetJobState` re-render it.
- **Logging** (`gbLog`/`gbLogT`): console.info + ring buffer (200) rendered in the panel's **Log tab**. `gbLogT(key, ms, ...)` throttles repeat messages. `renderLog` is deferred 250ms and skipped while the Log tab is hidden (v0.5.0 — gbLog fires per line in hot loops). Diag button dumps `gameBridgeStatus()`.
- **CSRF hunt** (`huntCsrf`): every 5s, try `window.csrfToken`, `window.csrf_token`, `window.h`, `Game.csrfToken`, meta/input/data-h, cookie. First match wins. Still needed for GM_xmlhttpRequest report fetching (gpAjax path signs itself).
- **AJAX spy** (`hookFetch` + `hookXhr`): patches `unsafeWindow.fetch` + `XMLHttpRequest.prototype.open/send` to catch report id urls in real time. The response-JSON recursive walk is skipped for payloads >100KB unless the URL is report-ish (v0.5.0 — map payloads are huge).
- **Farm scrape loop**: deadline-based since v0.4.1. `scrapeAllFarms` stamps persisted `nextFarmScrape` (5–6min, STORE key), then fetches farms **strictly sequentially** (700–1000ms apart, `onDone`/`await` chained). `farmTick` (15s interval + `visibilitychange`) fires scrapes when `Date.now() >= deadline`. Never use chained `setTimeout(scrape, 5min)` — background tabs throttle it to ~20min.
- **Towns scrape loop**: same deadline pattern via persisted `nextTownsScrape` (6–7min); fetch stays staggered 600ms/town.
- **Farm endpoint discovery**: `state.farmAction` (persisted) caches the first working action; `farmGuesses()` tries it first. `learnFarmAction` sniffs farm-ish action names from the game's own XHR/fetch traffic. `ACTION_GUESSES` is module-scope — `fetchTownResources` also reads it. Both resource fetchers share `parseResourceJson` (v0.5.0).
- **Auto-collect**: `autoCollectResources` — TreeWalker finds leaf elements matching `/^\d{1,2}\s*min$/`, walks up to find a `Recoger` button, marks `btn.dataset.grepbotClicked` to prevent re-click. MutationObserver-debounced 400ms + 5s polling fallback.

## Workflow rule: version + syntax check

Any edit under `src/` should be followed by:

1. Bump `@version` in `src/header.js` when behavior changes.
2. `python3 build.py`
3. Install rebuilt `grepbot.user.js` in Tampermonkey (Dashboard → edit script →
   paste full file, or drag the file onto a Firefox/Chrome TM tab).

**Never** start a local HTTP server for install/update. No `python3 server.py`,
no `http://127.0.0.1:35657/...`.

## Tab visibility

In-app SPA navigation (Reports / World / Farms) keeps the tab visible → no `setTimeout` throttling. Browser-minimized tab throttles to ~1min floor — unavoidable without a service worker.

## Regression notes

- v2.9.1 mojibake: the panel rendered `EconomÃ­a` / `ConstrucciÃ³n` / `Â·` /
  `â€¦` in-game while `src/` **and** the artifact were both valid UTF-8. Nothing
  was double-encoded — the browser simply decoded the injected script as
  Latin-1, because neither install path carries a charset (TM editor paste, or
  dragging a `file://` .user.js onto a tab; `.user.js` has no BOM and no
  `Content-Type`). Do not "fix" this by re-encoding `src/`, adding a BOM, or
  setting `document.charset` — the artifact is now pure ASCII, so there are no
  multi-byte sequences left for any charset guess to corrupt. Verified: the
  built file decodes byte-identically as UTF-8 and as Latin-1.

- v1.5.4 preconditions: gaps closed were **research** (posted techs with no
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
- `scrapeAllFarms` empty-list early-return bug: fixed in v0.3.1. The next deadline MUST be stamped even when `state.farmsParsed.length === 0` (stamp happens before the fetch queue since v0.4.1).
- Timer state (`nextFarmScrape` / `nextTownsScrape`) added in v0.3.2, **persisted to storage in v0.4.1** so cadence survives reloads. Stamp the deadline at the START of every scrape (prevents double-fire when manual `Farms now` / `Towns now` zero it); manual buttons zero the deadline + call `farmTick()`, never arm their own timer.
- Parallel farm fetch bursts (N farms × 6 endpoint guesses) got throttled by the game server — only the first farm updated (v0.4.1: sequential queue + cached `farmAction`).
- `parseFarms` accepts `12345 500 600 | notes` (bare id, no leading pipe) since v0.4.1; pipe format `id | x y | eta | notes` still canonical.
- v0.4.2: farm discovery + claims + bandit moved to the game bridge (`MM`/`ITowns`/`gpAjax`) copied from ModernBot (github.com/Sau1707/ModernBot, src/autoBootcamp.js + src/autoFarm.js). DOM-only bandit clicking never worked unless the camp window was open and attackable — model path needs no window.
- v0.4.3: objects passed INTO page functions must go through `cloneInto` in content-script contexts; userscript sandbox only needs `unsafeWindow`. XHR spy sniffs request BODIES on `frontend_bridge` (`sniffBridgeBody`) — a manual Recoger click teaches the exact claim payload (`claimTpl`, persisted) that `claimFarm` mimics. `verifyClaims` re-reads relations 10s after firing and logs whether `lootable_at` flipped (proof claims landed). `farmsFromGame` tries both `getOnlyCollectionByName` and `getCollections().FarmTownPlayerRelation[0]`, logs relation status distribution once per session.
- Auto-collect regex must be anchored: `/^\d{1,2}\s*min$/` — hour strings (`1h 30min`, `4h`) won't match, so they're skipped automatically.
- v0.5.0 (merge): standalone `grepInstantBuild.js` (`@grant none`, page context) was ported into the Build tab. Two port gotchas: (1) the userscript is sandboxed, so `GPWindowMgr`/`gpAjax` MUST be reached via `gameUw()`, never `window.`; (2) auto-complete needs the `ibInFlight` guard or a completion wave longer than the 10s scan interval re-fires and double-posts `buyInstant`. `fetchReport` now stamps `state.seen` only after a successful parse — stamping on any HTTP response lost reports to transient error pages.
- v1.1.0: `orchTick` is the sole econ scheduler (cadence-aware). Do not re-add per-feature `gbInterval` for cave/culture/trade/farm/ab/… alongside orch — that was the thrash bug.
- v1.4.0 lock registry: never reintroduce a module-local `*InFlight` boolean. A
  boolean can only be cleared by the path that set it, so a callback that never
  fires strands the feature until reload, and the `beforeunload` reset block did
  not run on bfcache/mobile exits. Use `gbLock(name)` / `gbUnlock(name)` /
  `gbLocked(name)` and add a TTL entry to `GB_LOCK_TTL` for new features.
- v1.4.0 orch: one-feature-per-tick was a throughput ceiling (3 actions/min) AND
  a starvation bug (strict list order). Keep the per-tick budget + overdue tie
  break; do not "simplify" it back to a single `return` after the first match.
- v1.4.0 render: `renderFarms` / `renderWorld` / `renderAttack` patch keyed rows
  (`tr[data-key]`, `div[data-town]`) and rebuild only when the id **set** changes
  — compare membership, not order, or a user column-sort is wiped on every
  repaint. `renderAttack` no longer interpolates town names into `innerHTML`.
- v1.5.3 audit: free instant requires model gold===0 + gameNow(); never
  buyInstant fallback on timeout; olympic needs allowPremiumCulture+budget;
  quests every()+no DOM fallback; dodge hostile-only; attack town targets +
  overdue refuse; favor temple_plunder; recruit by unit building; host-gated
  scrapes/reports; claim/sleep reconcile; gbXhr budget+captcha skip.
- v1.4.0 dry run: `state.dryRun` short-circuits inside `bridgePost` /
  `gameAjaxPost` only. Any new transport must route through those two or dry run
  silently stops covering it.
- v1.4.0 adaptive cadence infers "did the feature act" from the journal entry
  count for that feature, sampled 4s after the run — feature scans return void,
  so there is no return value to trust.
- v1.3.5: log/reqBudget use head-index rings (no `shift()` thrash); bandit wakes off `banditIdleUntil` instead of a fixed 1.5s interval; DOM MO scopes to `#ui_box`/windows/quests; CSRF hit poll is 120s + force-hunt on captcha/auth errors.
- v1.1.0: decision journal keys are world-scoped (`wkey`) — a town/village id means
  nothing on another world, so an unscoped journal would skip valid targets after a
  world switch. Skip windows must ignore `skip:*` results: night pause fires
  thousands of times and would otherwise look like a dead endpoint. `renderLog` now
  also bails when `.log-list` is `hidden` (Decisions sub-view active).
- v1.6.1 gpAjax callback contract (was: *everything* logged `err timeout` while
  the action actually executed). Read `GPAjax` in `archive/captures/grepo-dump/js/game.min.js`:
  `_ajax` wraps a **bare function** callback as a SUCCESS-ONLY handler
  (`u=function(e,i,o,r){if("function"==typeof a)a(i,r)}`), and the success branch
  is skipped whole when the response lacks `json`/`_srvtime`. So a server-side
  rejection (`json.error` → HumanMessage) and an empty bridge payload both leave
  the caller hanging until `BRIDGE_TIMEOUT_MS`. Two consequences: (1) the bare
  callback's args are `(data, t_token)`, **not** `(wnd, data)` — the window
  handle is only passed to the `{success,error}` object form; (2) every post now
  also registers `gbAjaxWatch(sig, settle)` and the XHR spy settles it from the
  raw response on `loadend` (`gbAjaxClaim` matches by `model_url|action_name`
  for the bridge, `controller/action` otherwise). Do not drop the watcher and go
  back to trusting the gpAjax callback, and do not drop the callback either —
  whichever fires first wins, `settled` dedupes. `captcha_required === true` is
  the real captcha flag the game itself keys on.
- v1.6 instant arming: the armed timer is an *accelerator*. Never delete the 10s
  `gbInterval` or the click hook in favour of it — a clamped background timer can
  fire minutes late, and the interval is what recovers that.
- v1.6 phoenician: the offer parser (`ptParseOffers`) was written against the
  server-rendered markup **without a live sample** — treat a parse miss as
  unknown (post nothing), and confirm with Config → *Copy offer HTML* before
  trusting a bulk trade. Never let the scraped stock be the only bound on the
  bulk amount.
- v1.6.3 template health is charged per **learned payload**, never per feature
  key. Feature `build` carries two different posts: auto-queue `buildUp`
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
- v2.7.0 merged the out-of-tree `GrepBot-2.5.9.user.js` "híbrido" fork. That file
  forked well before 2.5.9 (94 of 639 shared functions differed from the repo's
  own v2.5.9 build), so only two things came across: the Queue Center window and
  `jrnTransientDynamicResult`. Everything else the fork carried was **older**,
  and re-porting it would undo a named fix — its `nativeQueueAdd*` refused
  appends while the head was in flight (undone in v2.5.4), its
  `nativeQueueReconcileBuild` only reconciled `inflight.accepted` (leaving an
  un-acknowledged post stranded), and its `nativeUiScan` picked one host tile per
  building by visibility score instead of the v2.5.5 body-level panel mount. The
  fork also predates `gbAjaxWatch`, `captcha_required`, phoenician trade and the
  evidence system. Do not merge from it again without re-running the per-function
  diff.
- Memory note: `memory/grepbot-xpi-rebuild.md` predates the v0.5.0 WebExtension retirement — ignore the `.xpi` rebuild steps; `web-ext/` no longer exists.

## Phase state

**v1.5.3** audit hardening (surgical P0/P1/P2): free-instant gold=0 + no
`buyInstant` fallback, olympic premium gate, quest `every`+no DOM fallback,
hostile-only dodge, merchant/wonder timeout≠retry, attack town-only targets +
90s arm window, favor temple_plunder, recruit controller by unit type, host-gated
scrapes/reports, claim/sleep reconcile, build/research/rural ledgers, unified
`gbXhr` budget+captcha skip. **No** mega `executeAction` rewrite and **no**
automated test harness — validate with dry-run + `docs/TASKS.md` in-game.

**v1.4.0** adds dry run, the lock registry, the rebuilt orchestrator, the
Stats/Preflight tab, the server-pressure bus, keyed-row rendering, the shared
warehouse reader, export-redaction toggle and build gates.

`docs/ROADMAP.md` Phases 1–7 DONE (v0.6.0). Phase 0 foundation + Phase 8.1–8.13
coding + Phases 9–14 spine shipped in **v1.0.0**. Remaining work is **manual
in-game validation** (docs/TASKS.md) — especially cave 8.1, then 8.2–8.7, then
HIGH-RISK 8.12/8.13 only after payload sniff matches UI on the live world.
Never ship anticaptcha solvers or reintroduce a phone-home server.
