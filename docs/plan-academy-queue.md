# Plan — academy ("universidad"/Investigación) research queue: does not appear, does not work

**Status: coded in v2.9.0.** Steps 1–7 are implemented except the C1/C2/C3
*selection* in step 0, which still needs the live DOM read. Rather than block on
it, v2.9.0 ships the defensive superset of all three (see *Implementation notes*
at the bottom) — each candidate is handled by a read that fails closed, so the
console snippet is now a **diagnostic**, not a gate. Step 8 in-game validation
with Dry run ON is still outstanding.

Symptom (user, live world): the research queue neither **appears** (no `[+]`
controls in the Academy window, no `Cola GrepBot · Investigación` panel) nor
**works** (nothing is ever posted from the FIFO lane).

Shipped in v2.8.1 (`567f00b`), never validated in-game. Repo is clean at v2.8.2.

## Evidence already gathered (from `archive/captures/grepo-dump/js/game.min.js`)

- Academy tech tree click handler: `this.$el.off(e).on(e,".btn_upgrade, .btn_downgrade", function(e){ e=$(e.currentTarget).data("research_id"); this.controller.onBtnClick(e) })`.
  The game's own user-guide selector is `.tech_tree_box .button_upgrade[data-research_id=X]`.
  Two different class names (`btn_upgrade` vs `button_upgrade`) are in play.
- Template data passed per tech: `{research_id:e, column_number:p, is_researched:f, in_progress:g, ...}`.
- Research start is a **frontend_bridge** call, not a legacy controller:
  `GameModels.ResearchOrder` (`urlRoot:"ResearchOrder"`) has
  `research:function(e){this.execute("research",{id:this.getType()},e)}` and
  `GrepoApiHelper.execute` = `gpAjax.ajaxPost('frontend_bridge','execute',{model_url,action_name,captcha:null,arguments})`.
  GrepBot posts `gameAjaxPost('research','building_academy','research',{id,town_id})` instead.
- Available research points in this client:
  `getAvailableResearchPoints: function(){ return this.getCurrentResearchPoints() - this.getSpentResearchPoints() }`.
  GrepBot's `researchPointsAvailable` probes `getAvailableResearchPoints` /
  `getFreeResearchPoints` / `getResearchPoints` on the **town model**, then
  `researches().attributes` keys. Those getters live on the academy
  *controller*, not the town.
- Town proxy DOES expose `researches()` (`this.researches=function(){return this.getResearches()}`)
  and `getBuildings()`. So `info.techs` / `info.academy` are readable.
- Town proxy does NOT expose `getResearchOrdersCollection` (0 hits in the dump).
  Research orders live in the MM collection registered by `model_class`
  `"ResearchOrder"`, backed by a `TownAgnosticCollection` with
  `segmentation_key:"town_id"`. `MM.getOnlyCollectionByName` returns `i[0]`.

## Hypotheses, ranked

### "Does not work" (posting path) — VERIFIED against the dump

- **H1 — CONFIRMED. Primary "does not work" root cause.**
  `researchPointsAvailable` (`src/research.js:73`) probes
  `getAvailableResearchPoints` / `getFreeResearchPoints` / `getResearchPoints` on
  the **town proxy**. All three are absent there: `getAvailableResearchPoints`
  exists exactly once in the dump, on `GameControllers.AcademyBaseController`
  (`getCurrentResearchPoints() - getSpentResearchPoints()`); the other two have
  0 hits. The `researches().attributes` fallback cannot help either — that model
  is `urlRoot:"Researches"` with `hasResearch(e){return !0===this.get(e)}`, i.e.
  attributes are `{<tech>: bool}` only; `research_points` never appears on any
  model (all 17 hits are `GameData.researches[x].research_points`).
  ⇒ returns `null` always ⇒ `researchCanAfford` returns
  `{ok:false, why:'available research points unreadable'}` for every tech in
  every town, forever. Nothing is ever posted.
  **Correction to the original plan:** `researchPointCost` is FINE —
  `research_points` is the real GameData property. Only the *available* side is
  broken.
  Real formula to port:
  `current = academyLevel * Game.constants.academy.points_per_academy_level + (library===1 ? points_per_library_level : 0)`
  (capture: `points_per_academy_level:4`, `points_per_library_level:12`; minus
  one academy level while the academy is tearing down), and
  `spent = Σ research_points over techs where hasResearch(t) || isResearchInQueue(t)`.
- **H2 — REFUTED. Not a live blocker; do not treat as a fix.**
  Real entry shape (verbatim from the saved page):
  `"berth":{"id":"berth","research_dependencies":[],"building_dependencies":{"academy":22},"requires_farming_villages":false,"resources":{"wood":8900,"stone":5200,"iron":7800},"required_time":13500,"research_points":6}`.
  Every gate at `src/research.js:146-148` passes. The `academy_level` probe at
  `:144` matches nothing but is a no-op, not a block.
  The blind-verdict refactor is still worth doing for the CLAUDE.md invariant —
  just not as the fix.
- **H3 — CONFIRMED client-side** (server-side unprovable offline).
  `building_academy` has **0 hits** in `game.min.js`, `game.min_Em_n.js` and the
  saved page. The only start path is
  `buyResearch(e) → new GameModels.ResearchOrder({research_type:e}).research() → execute('research',{id:getType()}) → gpAjax.ajaxPost('frontend_bridge','execute',{model_url:'ResearchOrder',action_name:'research',captcha:null,arguments:{id}})`.
  `bridgePost` (`src/bridge.js:190`) already sends exactly that envelope with
  dry-run / journal / captcha / watcher intact.
  **Missed by the original plan:** `town_id` must go at the **top level** of the
  post, not inside `arguments` — `gpAjax._ajax` does
  `if(!o)o={town_id:Game.townId};else if(!o.town_id)o.town_id=Game.townId`, so
  without it every research silently retargets the currently-open town instead
  of `job.townId`.
  `tplNameFor` needs no change: `research` is absent from `TPL_FEATURE_MAP`
  (`src/core.js:736-748`), so the tpl-stale gate is already a no-op here.
- **H4 — CONFIRMED, and worse than stated. Must be fixed BEFORE H1.**
  `ITowns.addToTowns` constructs each `Town` with building-order, unit-order,
  unit, supporting-unit, god and casted-power fragments — **no research-orders
  fragment**. That is why `abGetTown(id).buildingOrders()` works per town and
  research has no equivalent.
  The MM fallback provably carries only the current town: `research_orders` is a
  `TownAgnosticCollection`, and only its `getCurrentFragment()` working copy is
  registered under `d.collections['ResearchOrder']`; `getOnlyCollectionByName`
  returns `i[0]`, and that working copy is `reset()` to the current town on every
  town switch. ⇒ `info.orders` is correct for `Game.townId` and **always `[]`**
  elsewhere, so "already queued" and "queue full" silently pass for every other
  town and `nativeQueueReconcileResearch` never prunes there.
  Working per-town reads:
  `MM.getFirstTownAgnosticCollectionByName('ResearchOrder').getFragment(townId).models`
  (careful: `getFragment` *creates* an empty fragment on miss, so empty ≠
  unknown), or `MM.getModels().ResearchOrder` filtered on `get('town_id')`.
  Whether the server pushes other towns' ResearchOrder models at all is
  unprovable offline — treat a miss as **unknown**, not as "empty".

### Additional posting-path defects found during verification

- **A1 — queue max hardcoded to 2** (`src/research.js:157`, `:219`). Real value
  is `GameDataConstructionQueue.getResearchOrdersQueueLength()` →
  `GameDataPremium.hasCurator() ? 7 : 2`. Caps Curator accounts at 2. Mirror
  `abQueueMax()` (`src/build-auto.js:33`).
- **A2 — `requires_farming_villages` / `on_small_island` never checked.** The
  game's own `can_be_bought` includes it. On a small island those techs are
  guaranteed server rejections — one request-budget slot and one decision-memory
  strike every cadence. Exactly the v1.5.4 regression class named in CLAUDE.md.
- **A3 — cost is unmodified.** The game uses
  `GameDataResearches.getResearchCosts` = `resources × GeneralModifications.getResearchResourcesModification(Game.townId)`.
  `src/research.js:52-63` reads raw `resources`, so it over-estimates once
  diplomacy is researched. Conservative, not blocking — fix with the rest.

### "Does not appear" (mount path) — VERIFIED against the dump

- **H5 — REFUTED.** The tech tree does emit `data-research_id` as a real HTML
  attribute: the click handler binds `.btn_upgrade, .btn_downgrade` and reads
  `$(e.currentTarget).data("research_id")`, and jQuery `.data()` reads the
  `data-research_id` attribute; the user guide independently builds the literal
  selector `.tech_tree_box .button_upgrade[data-research_id=X]`. Class-name
  mismatch exists (`btn_upgrade` in the handler vs `button_upgrade` in the user
  guide) but is irrelevant — `NATIVE_RESEARCH_SEL` (`src/native-ui.js:615`) is
  attribute-based and will match. The tech tree template itself is
  server-rendered and absent from the dump, so the per-builder class is
  unprovable offline; the attribute's presence is forced by the handler.
- **H6 — REFUTED on the clipping claim; the no-anchor gap is real but minor.**
  `nativeUiScan` (`src/native-ui.js:766-767`) already re-targets `button`/`a`
  nodes to `parentElement`, so the control is never appended inside the sprite
  button. `.gb-native-qctl` CSS (`src/native-ui.js:538`) is
  `position:relative; display:inline-flex; vertical-align:middle` plus
  `z-index:2147482000` — no `overflow:hidden`, no absolute positioning, so it
  sits in flow and above `.tech_tree_box` overlays. The real gap is only that
  the build lane has explicit anchor logic (`src/native-ui.js:669`) and the
  research lane does a bare `tile.appendChild(ctl)`. The tech-tree cell's own
  `overflow` is not in the dump — resolve in-game, not by guessing.
- **H7 — CONFIRMED. Dominant "does not appear" cause.**
  `ensureDomObserver` (`src/collect.js:182-188`) observes `#ui_box` plus the
  `.window_content` nodes that exist at arm time, falling back to `document.body`
  only when that list is empty. Grepolis windows are **not** inside `#ui_box`:
  `WindowsView` is `el:"body"` and `renderWindow` mounts with
  `$parent:this.$el` (= body); the saved page shows `#ui_box` (line 1351) and the
  open window `window_c970` (line 2755) as **sibling children of `<body>`**. A
  `subtree:true` observer on `#ui_box` cannot see an insertion in a sibling
  subtree, so opening the Academy fires no mutation and `scheduleNativeUiScan`
  is never called. Remaining triggers: the one-shot at `src/boot.js:81` (too
  early), the 5s loop at `src/boot.js:82-87` (gated on `nativeQueueHasPending`,
  false while the lane is empty — a chicken-and-egg lock), and SPA nav (opening
  a window is not SPA nav).
  **Correction to the original plan:** the `attributeFilter` note is a red
  herring — `childList` mutations are not gated by `attributeFilter`. The fix is
  the observer's *target*, not its filter: observe `document.body` (or re-arm
  from a body-level root), and/or ungate the 5s re-scan.
- **H8 — CONFIRMED on the missing attribute, but not a cause on its own.**
  The window template carries no town-id attribute
  (`<div id="window_<%= model.cid %>" class="js-window-main-container …">`) and
  the Academy has no `input[name="town_id"]`, so `nativeWindowTownId`
  (`src/native-ui.js:555-569`) falls through to the GPWindowMgr focus path.
  Both `getFocusedWindow` and `getJQElement` exist, and `getJQElement` returns
  the `.js-window-main-container`, which **contains** the `.window_content` that
  `nativeUiScan` passes as `root` — so `el.contains(root)` holds and the
  **focused** window resolves fine. Only un-focused windows return null, which is
  the intended conservative behaviour. Not the reported symptom.

**Verifier's bottom line:** H5 and H6 do not explain the symptom; H8 explains it
only for un-focused windows; **H7 alone explains it.**

### Contradiction — RESOLVED against H7

User confirmed in-game: **Senate build `[+]` and Barracks/Docks recruit `[+]`
appear fine; the Academy shows no `Cola GrepBot · Investigación` panel at all.**

A third verifier established the full trigger inventory: the only trigger that
survives a window open is the 5s loop at `src/boot.js:82-87`, gated on
`nativeQueueHasPending` for any lane. Since the build/recruit controls do appear,
that loop **is** ticking, so `nativeUiScan` runs every 5s and does re-scan
`document.querySelectorAll('.window_content,.gpwindow_content,#unit_order')` —
including the Academy window whenever it is open.

⇒ **H7 is real but is NOT the cause of this user's symptom.** The scan runs; it
just produces `researchN === 0`, and `nativeUiScan` (`src/native-ui.js:771`)
only calls `nativeRenderQueuePanel` for a lane `if (researchN)` — otherwise it
*removes* the panel. "No panel at all" is exactly that branch.

H7 remains worth fixing as a real robustness bug (a fresh install with all three
lanes empty has no trigger at all — chicken-and-egg: no scan ⇒ no `[+]` ⇒ lane
stays empty ⇒ no scan), but it must not be sold as the fix.

### What can produce `researchN === 0` — needs live DOM, not more dump reading

The Academy tech tree markup is **server-rendered with the window payload** and
is absent from every capture: `grep -c research_id "Grepolis - Atenas.html"` = 0,
and the only `tech_tree` hits in `game.min.js` are the two user-guide selector
strings. Both prior verifiers ended at "unprovable offline" here. Remaining
candidates, in order:

- **C1 — no `data-research_id` attribute in the real DOM.** The click handler
  reads `$(e.currentTarget).data("research_id")`, and jQuery `.data()` checks its
  own store *before* the attribute — so a template that sets it via `.data()` in
  JS leaves no attribute for `NATIVE_RESEARCH_SEL` to match. The user-guide
  selector argues the attribute exists, but on `.button_upgrade`, a class the
  click handler does not use.
- **C2 — the id values are not `GameData.researches` keys.** `nativeResearchId`
  (`src/native-ui.js:616-627`) only accepts a value for which
  `researchDef(v)` is truthy. Numeric ids, or a `research_type` spelling that
  differs from the GameData key, yield `null` for every tile ⇒ `researchN === 0`.
- **C3 — `nativeWindowTownId` returns null for the Academy root.** If the
  Academy window contains more than one distinct `input[name="town_id"]` /
  `data-town-id` value, `ids.size > 1` ⇒ `return null` (`src/native-ui.js:560`)
  ⇒ the whole root is skipped and every control removed. Senate/Barracks would
  be unaffected. Also fits "no panel at all".

**Next action is a live DOM read, not another offline pass.** Console snippet in
step 0 below settles C1/C2/C3 in one paste.


## Work order

Posting-path order is now fixed by a dependency the first pass missed: the
correct available-points formula subtracts `getSpentResearchPoints`, which counts
researched techs **plus queued orders**. With `info.orders` empty for non-current
towns (H4), a "fixed" H1 would over-report points and post unaffordable
research. **H4 before H1.**

0. **Live DOM read (blocking — decides the whole mount fix).** Open the Academy
   in-game, then paste this in the browser console (page context, F12):

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
     must go class-based and read the jQuery data store).
   - `attr_us > 0` but the values are not in `gameDataKeys` ⇒ **C2** (relax
     `nativeResearchId`'s `researchDef` gate).
   - `townIds.length > 1` ⇒ **C3** (`nativeWindowTownId` bails; scope the town-id
     collection to the window root and prefer the focused window's town).
   - `sample` also shows whether the cell would clip an inline-flex control (H6
     anchor).
1. **Instrument.** One-shot `gbLogT` when a root contains `.tech_tree_box` but
   matched zero research tiles, and when `nativeWindowTownId` returns null for
   such a root. Add a Preflight row for the academy read path: techs readable,
   academy level, orders count/readable, research points readable,
   `GameData.researches` size. Keeps this diagnosable without a console next
   time.
2. **H4 — per-town research orders.** Read via
   `MM.getFirstTownAgnosticCollectionByName('ResearchOrder').getFragment(townId)`
   or `MM.getModels().ResearchOrder` filtered on `town_id`; keep the current
   working-copy read for `Game.townId`. A miss must surface as **unknown**, not
   as an empty queue — do not prune and do not claim a free slot on unknown.
3. **H1 — available research points.** Port the real formula
   (`academy × points_per_academy_level + library bonus − Σ research_points of
   researched-or-queued techs`) using `Game.constants.academy`. Where it still
   cannot be read, return a `blind` verdict (log once, let the server decide),
   per the CLAUDE.md precondition invariant. Leave `researchPointCost` alone —
   it is correct.
4. **H3 — transport.** Send research through `bridgePost` with
   `model_url:'ResearchOrder'`, `action_name:'research'`, `arguments:{id}` and
   **`town_id` at the top level of the post**. Drop or demote
   `building_academy/research` to a fallback. No `tplNameFor` change needed.
5. **A1/A2/A3 — remaining precondition gaps.** Real queue length via
   `GameDataConstructionQueue.getResearchOrdersQueueLength()`; skip
   `requires_farming_villages` techs on a small island; apply
   `getResearchResourcesModification` to the cost.
6. **H2 — invariant cleanup only.** Convert `researchDepsOk` /
   `researchCanAfford` unreadable paths to `blind`. Not a fix for the reported
   symptom; do not let it displace the real ones.
7. **Mount fixes.** Whatever step 0 returns (C1 / C2 / C3) drives the main fix.
   Alongside it, unconditionally: move the MutationObserver target to
   `document.body` — Grepolis windows are body-level siblings of `#ui_box`
   (`WindowsView` is `el:"body"`, `renderWindow` mounts with `$parent:this.$el`;
   the saved page shows `#ui_box` at line 1351 and `window_c970` at line 2755 as
   sibling body children) — and ungate the 5s `scheduleNativeUiScan` so an empty
   lane can still mount its `[+]` (H7's chicken-and-egg). Add the research-lane
   anchor to match the build lane (H6). Do **not** touch `attributeFilter`
   (`childList` mutations are not gated by it).
8. Bump `@version` in `src/header.js`, `python3 build.py`, headless smoke via
   the `run-grepbot` skill, then in-game validation with **Dry run ON**.

## Non-goals

- No test harness, no npm, no server (CLAUDE.md).
- Do not enable anything HIGH-RISK by default.
- Do not "simplify" a precondition into an unconditional post.

## Implementation notes (v2.9.0)

Posting path, in the plan's order:

- **H4** — `researchOrdersFor(townId)` returns `{orders, known}` and
  `researchTownTechs` surfaces it as `info.ordersKnown`. Three reads, in order:
  the `ResearchOrder` TownAgnostic fragment, a flat `MM.getModels().ResearchOrder`
  sweep, then the working copy (open town only). An empty result only counts as
  known-empty for the open town, or when the flat sweep holds an order for some
  *other* town — which proves the server pushes them world-wide. Unknown blocks
  the post (`cola real ilegible; abre esa ciudad una vez`) instead of claiming a
  free slot, and `nativeQueueReconcileResearch` stops using the real queue for
  pruning while it is unknown (researched flags still prune).
- **H1** — `researchPointsAvailable` ports
  `AcademyBaseController.getCurrentResearchPoints() - getSpentResearchPoints()`
  off `Game.constants.academy`, including the library bonus (`level === 1`) and
  the one-level drop while the academy tears down. `researchPointsSpent` sums
  `research_points` over researched-or-queued techs, so it returns null while
  `ordersKnown` is false. `researchPointCost` was already correct and is unchanged.
- **H3** — `researchPayload` is now
  `{model_url:'ResearchOrder', action_name:'research', arguments:{id}, town_id}`
  through `bridgePost`, with `town_id` **top level**. `txIntent` already keyed
  research off `d.town_id` + `arguments.id`, so decision-memory keys are unchanged.
- **A1** — `researchQueueMax()` reads
  `GameDataConstructionQueue.getResearchOrdersQueueLength()`, falling back to
  `hasCurator()`/`isAdvisorActivated('curator')`, then 2.
- **A2** — `requires_farming_villages` blocks only when `on_small_island` was
  actually read as true.
- **A3** — `researchCost(tech, townId)` multiplies by
  `GeneralModifications.getResearchResourcesModification(townId)`; an unreadable
  modifier keeps the raw (higher) cost.
- **H2** — `researchDepsVerdict` returns `{ok, blind, why}`; `researchDepsOk`
  keeps its boolean contract for existing callers and returns **true** on blind.
  `researchCanAfford` likewise returns `{ok, blind, why}` and only blocks on a
  value it read (a `gbAfford` shortfall on an *unreadable* resource does not count).

Mount path — step 0's console snippet was not run, so all three candidates are
handled rather than one being selected:

- **C1** — `nativeResearchId` falls back to the jQuery data store (which
  `.data()` reads before the attribute), and `NATIVE_RESEARCH_SEL_ALL` adds the
  class hooks the game itself binds (`.btn_upgrade`, `.button_upgrade`,
  `.research_icon`). A class-only node still has to resolve to a real GameData
  tech or it is skipped.
- **C2** — `nativeResearchKey` maps a raw tile value through
  `GameData.researches`' own `id`/`research_id`/`research_type`/`name` fields,
  and `nativeResearchFromClass` reads the `getResearchCssClass` convention
  (`<tech>`, `<tech>_old`, `<tech>_bpv`).
- **C3** — `nativeWindowTownId` no longer aborts the whole root on multiple town
  ids: if the open town is among them and this root is the focused window, that
  is the town. Otherwise it still returns null, now with a throttled log.
- **H7** (real, but not this symptom) — the MutationObserver target moved to
  `document.body`, since Grepolis windows are body-level siblings of `#ui_box`;
  the observer's ignore filter grew `#grepbot-panel` / `#grepbot-queue-center` so
  the bot's own repaints do not feed it. The 5s `scheduleNativeUiScan` is now
  ungated, closing the empty-lane chicken-and-egg.
- **H6** — the research control anchors next to the tech caption like the build
  lane does; its removal query is descendant-scoped to match.
- **Step 1 instrumentation** — throttled logs for "academy root matched N nodes
  but resolved 0 techs" (with attribute/class/`tech_tree_box` counts) and for
  "academy window open but its town id is unreadable", plus a Preflight
  **academy read path** row: `GameData.researches` size, academy, library, real
  queue + max, research points, small-island flag.

Still open: step 0 as a diagnostic if the lane is still absent in-game, and step
8 (in-game validation with Dry run ON).
