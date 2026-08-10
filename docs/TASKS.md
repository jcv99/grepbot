# Project tasks

Evidence for any gate: Actions/Log → **Evidence** (plus Diag). Paste the JSON;
do not describe state by hand. Evidence is read-only and redacts CSRF/templates.

## Current phase

- [ ] **v3.x gates** (plan `docs/plans/26-improvement-sweep-2026-08-10.md`)
  - Farm scrape breaker: with the endpoint unlearned, the Log shows
    `farm scrape: endpoint dead after 2 sweeps - disabling` once and then no
    further `farm <id>: no data` lines; footer reads `farms: scrape off`;
    Stats budget stays well under the ceiling across a farm cadence
  - Scope budget: with the scrape ON and 12 villages, a hand-triggered farm
    claim fired during a sweep still posts — no `skip:budget` in Decisions.
    Stats shows `peticiones` split into scrape / read / accion
  - Town action cache: Log shows `towns endpoint = <action>` once, and later
    sweeps issue one request per town instead of up to six
  - Captcha ladder + soft ceiling: edit both in Config, reload, values persist;
    Stats shows the soft delay moving when the ceiling is lowered
  - Deadlock resolver: with a full warehouse and farm paused, Log shows
    `orch: deadlock in town <id> - forcing cave/trade/rural` and the forced
    feature runs before farm
  - Adaptive claim duration: teach a 20min option by hand → Log
    `farm: learned claim option n = 20min`; a town with headroom claims 20min,
    a near-full town stays at 5min
  - Preflight: new rows (`farm resource scrape`, `native queue`, `queue center`,
    `phoenician`, `tx registry`) all report

- [ ] **v2.9.x gates**
  - Academy queue (see the 8.6 block below) end to end on a Curator account
  - Queue Center: `Colas` opens, all four tabs render the real queue beside the
    virtual plan, reorder / pause / remove work through `nativeQueue*`
  - Artifact stays pure ASCII: the panel shows `Economía` / `Construcción`
    correctly after a TM paste install (no `EconomÃ­a`)

- [ ] **v1.6 gates** (dry-run first)
  - Custom queue: three entries in one town → `DRY-RUN build … buildUp` fires in
    list order; entries vanish as their orders queue; strict ON waits on an
    unaffordable head entry instead of skipping it
  - Instant build: Preflight shows `order queues readable N/M towns` with N=M;
    a build in a **non-current** town completes free, and the post lands with
    4:50-5:00 remaining (Log `instant: armed in …` precedes it)
  - Merchant ship: open the window once (view URL learned) → **Copy offer HTML**
    → confirm the parser; one hand trade teaches `ptTradeTpl`; dry run shows
    5 × amount-1 posts then one bulk post; refuses everything before the
    template exists, and aborts when the ratio does not move

- [ ] **v1.5.3 audit gates** (dry-run first; no npm harness)
  - Host OFF 10min → zero bot-originated requests/clicks
  - Instant: price>0 or >5min left → zero posts; free+gold0 → one post; timeout → no buyInstant
  - Olympic without `allowPremiumCulture` / budget<50 → zero posts
  - Quest mixed safe+unsafe rewards → not claimed; timeout → no DOM click
  - Incoming support → no dodge/militia/dispatch
  - Merchant/wonder timeout → no second post
  - Bireme recruit → docks controller; unknown cost → no post
  - Attack village id → blocked (not Town/sendUnits); overdue after suspend → no fire
  - Favor without temple_plunder → no send

- [ ] **v1.4.0 gates** — run these first; they make every gate below cheaper
  - Stats tab: switch 1h/24h/7d, rows appear after the bot has acted once
  - **Preflight** (Stats tab or Actions menu): every line reports; `bridge`,
    `towns`, `farm claims` must pass on a logged-in world. Fix what it flags
    (unlearned `claimTpl` / `attackTpl` / sleep option) before the 8.x gates
  - **Dry run ON** (Config): trigger each risky feature and compare the logged
    `DRY-RUN <feature>: {…}` payload against the body of the same action clicked
    by hand (XHR spy logs both). Only then turn dry run OFF for that feature
  - Locks: no feature stays stuck after a soft nav or a tab restore; Log shows
    `lock: <name> expired after Ns` at most rarely, never repeatedly
  - Orchestrator: with 4+ econ features ON, Stats `scheduler` shows all of them
    getting turns; none sits at `next 0s` forever
  - Adaptive cadence: a feature with nothing to do (e.g. cave under threshold)
    logs `orch: cave idle 4x - widening cadence` and its Stats cadence grows
  - Server bus: on a 429/503 the footer shows `⏸srv:<time>` and posts stop
  - Export: Copy/Export redact names by default; toggling redaction OFF logs
    `export: redaction OFF`

- [ ] **Phase 0 smoke** — manual in-game after paste `grepbot.user.js` ≥ v1.0.0
  - Panel boots; Diag prints bridge status; no ReferenceErrors in Log
  - One farm claim + one free instant complete
  - Captcha breaker + global kill still pause posts

- [ ] **Instant research** (v1.3.0 / hardened v1.5.3) — in-game validation
  - Config `Instant free research (academy)` default OFF; start an academy
    research, wait until ≤5min left **and** free price 0 → Log `instant-research: … OK`
  - Timeout / unknown must NOT learn or post `buyInstant`; Build tab lists FREE only when gold===0
  - Build tab lists the research row as `res:<tech>` FREE

- [ ] **Claim timers 5/10min** (v1.3.0) — in-game validation
  - Config shows `learned claim options: 5min=1`; claim a 10min booty by hand
    in a farming village → Log `farm: learned claim option <n> = 10min`
  - Town with villager-loyalty research claims 10min, town without stays 5min
  - Loyalty tech auto-detect logs the matched key; wrong key can be pinned in
    Config (`Loyalty tech key`)

- [ ] **Sleep claim 4h/8h** (v1.3.0) — in-game validation
  - Teach the 4h and 8h options by hand once; Farms tab status turns grey
  - `Sleep claim (4h/8h)` button claims every ready village with the long timer
  - Auto mode: fires once per day only when the haul ends before 24:00 and every
    owning town is under the fill %; held runs log `sleep claim held: town …`

- [ ] **Phase 8.1** Auto-cave — in-game validation (coded since v0.7.0)
  - Config Auto-cave OFF by default; toggle persists
  - Iron ≥ thresh% → `cave: town <id> stored <n> iron`; cave storage up
  - Finite full → skip; max-level hide still stashes; per-town OFF skips

- [ ] **Decision memory** (v1.1.0) — in-game validation
  - Log tab → Decisions fills as farm/build loops run; survives F5
  - A repeatedly failing action gets `memory: … failed 3x … skipping 5m`,
    footer shows `mem:1`, next attempt logs `skipped from memory`
  - Success on that target clears the window; Clear skips works
  - Config toggle OFF stops skipping but records keep appearing

## Next (validation order)

- [ ] **8.2** Auto-culture — festival starts via bridge without culture window
- [ ] **8.3** Inter-city trade — two towns, surplus → needy
- [ ] **8.4** Rural trade — warehouse full → trade instead of silent skip
- [ ] **8.5** Rural level — one unlock/upgrade with spare BP
- [ ] **8.6** Research — one tech enters academy queue
  - v2.9.0 rewrote the whole path (see `docs/plan-academy-queue.md`). Validate in
    this order, Dry run ON first:
  - Stats → Preflight → **academy read path** row: no `UNREADABLE` field. A
    `real queue UNREADABLE` there means only the open town can be researched.
  - Open the Academy: `[[+]]` controls on the tech tiles and a
    `Cola GrepBot · Investigación` panel. If neither appears, the Log carries
    `academy root matched N research node(s) but resolved 0 techs` (or
    `its town id is unreadable`) — paste the step-0 console snippet from the plan.
  - Dry run ON, queue one tech: Log shows
    `DRY-RUN research: {"model_url":"ResearchOrder","action_name":"research","arguments":{"id":"<tech>"},"town_id":<id>}`.
    `town_id` must be the queued town, **not** the open one.
  - Dry run OFF: the tech lands in the real academy queue and the virtual job
    clears; a Curator account must accept more than 2 queued.
- [ ] **8.7** Activity pause + template apply + Overview numbers
- [ ] **8.8** Webhook — captcha trip → one Discord POST
- [ ] **9.1–9.4** Orch overnight + island ship + night pause
- [ ] **8.9–8.11** Merchant / favor / WW (default OFF)
- [ ] **10.4 / 10.5 / 11.2** Harassment + cancel + hero (v1.5.9)
  - Attack tab harass chips → Preview shows small stack; Send now still confirms
  - Outgoing list shows cancelable movements; Cancel asks confirm; Log `cancel: command … OK`
  - Heroes list Assign/Unassign/Cancel travel with confirm; dry-run logs `DRY-RUN hero:`
  - Hand-cancel once → Preflight `cancel` shows template learned; hand hero assign → `heroTpl`
- [ ] **10.x / 8.12 notify** CS alert + threat board
- [ ] **8.13** Recruit one unit on curator town (payload match UI)
- [ ] **8.12 auto** Dodge only on throwaway / accepted risk
- [ ] **13.x** Intel dossiers + Grepodata assist
- [ ] **14.x** Confirm global kill + budget + config import/export

- [x] Phases 1–7 (v0.6.0)
- [x] v0.6.7 warehouse-full farm gate + auto-queue builds
- [x] Phase 8.1 auto-cave coded (v0.7.0)
- [x] Phase 0 foundation (boot symbols, bridge, host scope, timeouts) — v1.0.0
- [x] Phase 8.2–8.13 modules coded (`culture`…`recruit`) — v1.0.0
- [x] Phases 9–14 spine coded (orch, military helpers, intel, harden) — v1.0.0
- [x] ROADMAP / TASKS / CLAUDE updated for Ultimate path

- [ ] **8.14** Village auto-recruit when saturated (v3.9.0) — coded, validate:
  - Open a farming village, click `Aceptar` once by hand on any unit slot → Log
    tab must show `learned accept-units template:` with `model_url` and `action_name`.
  - Actions → Preflight → `village recruit` row shows `tpl <action_name>` (no
    UNLEARNED warning), `units S/A/H/Sl`, `fill read OK (cap N)`.
  - Enable `state.dryRun` in console, enable `village-recruit` in Config, fill
    a village's warehouse to ≥ configured `village-recruit-fill` over two
    consecutive scrapes → Log tab shows `DRY-RUN villageRecruit:` with the
    expected payload.
  - Turn dry-run OFF, observe ONE live post → Stats tab increments the
    `villageRecruit` feature with an `ok` entry; the picked unit matches the
    pair heuristic (test the 13/130/50/50 example → sword).
  - Trigger a captcha on this path → `captchaPaused('villageRecruit')` is set
    and farm claims keep running (independent captcha key).
  - Force 3 hard errors (e.g. tampered `acceptUnitsTpl.arguments`) → decision
    memory opens a 5min skip window and the scan stops posting until expiry.

## Notes

- In-game validation cannot be completed by the agent; checkboxes above stay
  open until a live session on the user’s world confirms exit criteria.
- HIGH-RISK toggles (favor, dodge auto, recruit) must stay OFF until sniffed
  payloads match a genuine UI action on that world.
