const STORE = {
    FINDINGS: 'grepbot:findings',
    FARMS:    'grepbot:farms',
    FARMS_PARSED: 'grepbot:farms-parsed',
    FARM_RES: 'grepbot:resources',
    SEEN:     'grepbot:seen',
    TOWNS:    'grepbot:towns',
    TOWN_RES: 'grepbot:town-resources',
    THRESH:   'grepbot:thresholds',
    ALERTED:  'grepbot:alerted',
    COLLECT_ALL: 'grepbot:collect-all',
    AUTO_COLLECT: 'grepbot:auto-collect',
    COLLECT_TPL: 'grepbot:collect-tpl',
    AUTO_BANDIT: 'grepbot:auto-bandit',
    BANDIT_LOG:  'grepbot:bandit-log',
    NEXT_FARM:  'grepbot:next-farm',
    NEXT_TOWNS: 'grepbot:next-towns',
    FARM_ACTION: 'grepbot:farm-action',
    AUTO_FARM:  'grepbot:auto-farm',
    CLAIM_TPL:  'grepbot:claim-tpl',
    IB_AUTO:   'grepbot:ib-auto',
    IB_FREE_THRESH: 'grepbot:ib-free-thresh',
    QUEST_REWARDS: 'grepbot:quest-rewards',
    QUEST_AUTO_BUILD: 'grepbot:quest-auto-build',
    QUEST_AUTO_RES: 'grepbot:quest-auto-res',
    QUEST_HISTORY: 'grepbot:quest-history',
    COLLECT_MAX_MIN: 'grepbot:collect-max-min',
    FARM_MIN: 'grepbot:farm-min-ms',
    FARM_MAX: 'grepbot:farm-max-ms',
    TOWN_MIN: 'grepbot:town-min-ms',
    TOWN_MAX: 'grepbot:town-max-ms',
    ENABLED_HOSTS: 'grepbot:enabled-hosts',
    ATTACK_TPL: 'grepbot:attack-tpl',
    CANCEL_TPL: 'grepbot:cancel-tpl',
    HERO_TPL: 'grepbot:hero-tpl',
    ATTACK_PLAN: 'grepbot:attack-plan',
    ATTACK_HISTORY: 'grepbot:attack-history',
    ATTACK_RECENT: 'grepbot:attack-recent',
    CAPTCHA: 'grepbot:captcha-breakers',
    FINDINGS_FILTER: 'grepbot:findings-filter',
    PANEL_GEOM: 'grepbot:panel-geom',
    ACTIVE_TAB: 'grepbot:active-tab',
    CSRF: 'grepbot:csrf',
    FARM_SKIP_FULL: 'grepbot:farm-skip-full',
    FARM_FULL_MODE: 'grepbot:farm-full-mode',
    AB_AUTO: 'grepbot:ab-auto',
    AB_TARGETS: 'grepbot:ab-targets',
    AB_NEXT: 'grepbot:ab-next',
    BUILD_PIN: 'grepbot:build-pin',
    AB_CUSTOM_Q: 'grepbot:ab-custom-queue',
    AB_QUEUE_STRICT: 'grepbot:ab-queue-strict',
    AUTO_CAVE: 'grepbot:auto-cave',
    CAVE_THRESH: 'grepbot:cave-thresh',
    CAVE_TOWNS: 'grepbot:cave-towns',
    IB_ACTION: 'grepbot:ib-action',
    IB_RESEARCH: 'grepbot:ib-research',
    FARM_OPTION_MAP: 'grepbot:farm-option-map',
    FARM_LONG_CLAIMS: 'grepbot:farm-long-claims',
    FARM_LOYALTY_TECH: 'grepbot:farm-loyalty-tech',
    FARM_LOYALTY_SEEN: 'grepbot:farm-loyalty-seen',
    FARM_TEACH_BANNER: 'grepbot:farm-teach-banner',
    FARM_SLEEP_DUR: 'grepbot:farm-sleep-dur',
    FARM_SLEEP_AUTO: 'grepbot:farm-sleep-auto',
    FARM_SLEEP_FILL: 'grepbot:farm-sleep-fill',
    FARM_SLEEP_DAY: 'grepbot:farm-sleep-day',
    IB_ACTION_R: 'grepbot:ib-action-r',
    // Phase 8.2+ / 9-14
    AUTO_CULTURE: 'grepbot:auto-culture',
    CULTURE_TYPES: 'grepbot:culture-types',
    ALLOW_PREMIUM_CULTURE: 'grepbot:allow-premium-culture',
    CULTURE_GOLD_BUDGET: 'grepbot:culture-gold-budget',
    CULTURE_GOLD_SPENT: 'grepbot:culture-gold-spent',
    AUTO_TRADE: 'grepbot:auto-trade',
    TRADE_PRESET: 'grepbot:trade-preset',
    TRADE_RESERVE: 'grepbot:trade-reserve',
    TRADE_MIN: 'grepbot:trade-min',
    TRADE_MAX_HOPS: 'grepbot:trade-max-hops',
    AUTO_RURAL_TRADE: 'grepbot:auto-rural-trade',
    RURAL_TRADE_RATIO: 'grepbot:rural-trade-ratio',
    RURAL_TRADE_RES: 'grepbot:rural-trade-res',
    AUTO_RURAL_LEVEL: 'grepbot:auto-rural-level',
    RURAL_LEVEL_MAX: 'grepbot:rural-level-max',
    AUTO_RESEARCH: 'grepbot:auto-research',
    RESEARCH_TARGETS: 'grepbot:research-targets',
    PAUSE_ON_ACTIVITY: 'grepbot:pause-on-activity',
    PAUSE_ACTIVITY_MS: 'grepbot:pause-activity-ms',
    NIGHT_PAUSE: 'grepbot:night-pause',
    NIGHT_START: 'grepbot:night-start',
    NIGHT_END: 'grepbot:night-end',
    CITY_TEMPLATES: 'grepbot:city-templates',
    TOWN_GROUPS: 'grepbot:town-groups',
    WEBHOOK_URL: 'grepbot:webhook-url',
    WEBHOOK_EVENTS: 'grepbot:webhook-events',
    AUTO_MERCHANT: 'grepbot:auto-merchant',
    MERCHANT_WISH: 'grepbot:merchant-wish',
    AUTO_PT_TRADE: 'grepbot:auto-pt-trade',
    PT_CFG: 'grepbot:pt-cfg',
    PT_TRADE_TPL: 'grepbot:pt-trade-tpl',
    PT_VIEW_URL: 'grepbot:pt-view-url',
    AUTO_FAVOR: 'grepbot:auto-favor',
    FAVOR_CFG: 'grepbot:favor-cfg',
    AUTO_WONDER: 'grepbot:auto-wonder',
    WONDER_CFG: 'grepbot:wonder-cfg',
    AUTO_DODGE: 'grepbot:auto-dodge',
    DODGE_MODE: 'grepbot:dodge-mode',
    DODGE_FLOOR: 'grepbot:dodge-floor',
    AUTO_RECRUIT: 'grepbot:auto-recruit',
    RECRUIT_TARGETS: 'grepbot:recruit-targets',
    RECRUIT_SPELLS: 'grepbot:recruit-spells',
    PRIORITY_ORDER: 'grepbot:priority-order',
    ISLAND_SHIP: 'grepbot:island-ship',
    AUTO_MILITIA: 'grepbot:auto-militia',
    CS_ALERT: 'grepbot:cs-alert',
    PLAYER_NOTES: 'grepbot:player-notes',
    WATCHLIST: 'grepbot:watchlist',
    GREPODATA_INDEX: 'grepbot:grepodata-index',
    CAPTCHA_GLOBAL: 'grepbot:captcha-global',
    CAPTCHA_GLOBAL_UNTIL: 'grepbot:captcha-global-until',
    REQ_BUDGET: 'grepbot:req-budget',
    ALLIANCE_NOTES: 'grepbot:alliance-notes',
    LAST_SEEN_TS: 'grepbot:last-seen-ts',
    WATCH_HITS: 'grepbot:watch-hits',
    WONDER_FAVOR_TPL: 'grepbot:wonder-favor-tpl',
    AUTO_WONDER_FAVOR: 'grepbot:auto-wonder-favor',
    CONFIG_VER: 'grepbot:config-ver',
    WONDER_SPENT: 'grepbot:wonder-spent',
    // decision memory (world-scoped: a target id means nothing on another world)
    DECISIONS: 'grepbot:decisions',
    DECISION_SKIPS: 'grepbot:decision-skips',
    DECISION_MEM: 'grepbot:decision-memory',
    TPL_HEALTH: 'grepbot:tpl-health',
    ORCH_DEADLOCK: 'grepbot:orch-deadlock',
    CAPTCHA_LADDER: 'grepbot:captcha-ladder',
    POSTS_SOFT_PCT: 'grepbot:posts-soft-pct',
    TAB_FILTERS: 'grepbot:tab-filters',
    DRY_RUN: 'grepbot:dry-run',
    EXPORT_REDACT: 'grepbot:export-redact',
    ORCH_ADAPTIVE: 'grepbot:orch-adaptive',
    SERVER_COOLDOWN: 'grepbot:server-cooldown',
    QUEST_CLAIM_FAIL: 'grepbot:quest-claim-fail',
    DODGE_QUEUE: 'grepbot:dodge-queue',
  };

  // Full orch order - also the load/migrate default for priorityOrder (C1).
  const PRIORITY_ORDER_DEFAULT = ['culture', 'cave', 'build', 'research', 'trade', 'farm',
    'ruraltrade', 'rurallevel', 'recruit', 'merchant', 'pttrade', 'favor', 'wonder'];
  const CONFIG_VER_CURRENT = 2;

  // Id-bearing maps/lists auto-scoped by load/save (C3). Prefs/toggles stay global.
  // Caller-scoped learned keys (NOT in this set — call sites pass wkey(base) themselves):
  //   CSRF, FARM_ACTION, CLAIM_TPL, COLLECT_TPL, IB_ACTION, IB_ACTION_R, ATTACK_TPL,
  //   CANCEL_TPL, HERO_TPL, CAPTCHA, DECISIONS, DECISION_SKIPS, FARM_OPTION_MAP, …
  const WORLD_SCOPED_BASES = new Set([
    STORE.FINDINGS, STORE.FARMS, STORE.FARMS_PARSED, STORE.FARM_RES, STORE.SEEN,
    STORE.TOWNS, STORE.TOWN_RES, STORE.THRESH, STORE.ALERTED,
    STORE.NEXT_FARM, STORE.NEXT_TOWNS, STORE.BANDIT_LOG,
    STORE.QUEST_REWARDS, STORE.QUEST_HISTORY,
    STORE.ATTACK_PLAN, STORE.ATTACK_HISTORY, STORE.ATTACK_RECENT,
    STORE.AB_TARGETS, STORE.AB_NEXT, STORE.BUILD_PIN, STORE.AB_CUSTOM_Q, STORE.CAVE_TOWNS,
    STORE.RESEARCH_TARGETS, STORE.CITY_TEMPLATES, STORE.TOWN_GROUPS,
    STORE.MERCHANT_WISH, STORE.FAVOR_CFG, STORE.WONDER_CFG, STORE.WONDER_SPENT,
    STORE.CULTURE_GOLD_SPENT,
    STORE.RECRUIT_TARGETS, STORE.PRIORITY_ORDER,
    STORE.PLAYER_NOTES, STORE.WATCHLIST, STORE.ALLIANCE_NOTES,
    STORE.FARM_LOYALTY_SEEN, STORE.FARM_TEACH_BANNER,
    STORE.TPL_HEALTH, STORE.LAST_SEEN_TS, STORE.WATCH_HITS, STORE.WONDER_FAVOR_TPL,
    STORE.CAPTCHA_GLOBAL_UNTIL,
    STORE.SERVER_COOLDOWN, STORE.QUEST_CLAIM_FAIL, STORE.DODGE_QUEUE,
  ]);

  // World-scoped STORE keys - must not leak across hosts/worlds
  function wkey(base) { return base + '@' + location.hostname; }

  // ---------- reinject registry (Tampermonkey re-runs stack intervals otherwise) ----------
  const GB_ROOT = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
  if (typeof GB_ROOT.__grepbotDispose === 'function') {
    try { GB_ROOT.__grepbotDispose(); } catch (_) {}
  }
  const gbTimerBag = [];
  const gbListenerBag = [];
  const gbXhrBag = [];
  const gbMenuCmds = [];
  const gbHookOrig = { fetch: null, xhrOpen: null, xhrSend: null, pushState: null, replaceState: null };
  let gbDomObserver = null;
  function gbInterval(fn, ms) {
    const id = setInterval(fn, ms);
    gbTimerBag.push({ kind: 'i', id });
    return id;
  }
  function gbTimeout(fn, ms) {
    const entry = { kind: 't', id: 0 };
    entry.id = setTimeout(() => {
      const i = gbTimerBag.indexOf(entry);
      if (i >= 0) gbTimerBag.splice(i, 1);
      fn();
    }, ms);
    gbTimerBag.push(entry);
    return entry.id;
  }
  function gbListen(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    gbListenerBag.push({ target, type, fn, opts });
  }
  function gbClearTimers() {
    for (const t of gbTimerBag) {
      try { if (t.kind === 'i') clearInterval(t.id); else clearTimeout(t.id); } catch (_) {}
    }
    gbTimerBag.length = 0;
  }
  function gbAbortXhrs() {
    for (const h of gbXhrBag) {
      try { if (h && typeof h.abort === 'function') h.abort(); } catch (_) {}
    }
    gbXhrBag.length = 0;
  }
  function gbRestoreHooks() {
    try {
      const uw = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
      if (gbHookOrig.fetch) { uw.fetch = gbHookOrig.fetch; gbHookOrig.fetch = null; }
      if (uw.XMLHttpRequest && uw.XMLHttpRequest.prototype) {
        const P = uw.XMLHttpRequest.prototype;
        if (gbHookOrig.xhrOpen) { P.open = gbHookOrig.xhrOpen; gbHookOrig.xhrOpen = null; }
        if (gbHookOrig.xhrSend) { P.send = gbHookOrig.xhrSend; gbHookOrig.xhrSend = null; }
        try { delete P._grepbot_open; } catch (_) { P._grepbot_open = false; }
      }
      if (gbHookOrig.pushState) { history.pushState = gbHookOrig.pushState; gbHookOrig.pushState = null; }
      if (gbHookOrig.replaceState) { history.replaceState = gbHookOrig.replaceState; gbHookOrig.replaceState = null; }
    } catch (_) {}
  }
  function gbUnregisterMenus() {
    for (const id of gbMenuCmds) {
      try { if (typeof GM_unregisterMenuCommand === 'function') GM_unregisterMenuCommand(id); } catch (_) {}
    }
    gbMenuCmds.length = 0;
  }
  function gbMenu(label, fn) {
    try {
      const id = GM_registerMenuCommand(label, fn);
      if (id != null) gbMenuCmds.push(id);
    } catch (_) {
      try { GM_registerMenuCommand(label, fn); } catch (__) {}
    }
  }
  GB_ROOT.__grepbotDispose = function grepbotDispose() {
    gbClearTimers();
    gbAbortXhrs();
    gbRestoreHooks();
    gbUnregisterMenus();
    for (const L of gbListenerBag) {
      try { L.target.removeEventListener(L.type, L.fn, L.opts); } catch (_) {}
    }
    gbListenerBag.length = 0;
    if (gbDomObserver) {
      try { gbDomObserver.disconnect(); } catch (_) {}
      gbDomObserver = null;
    }
    try {
      if (typeof GB_ROOT.__grepbotQuestDispose === 'function') GB_ROOT.__grepbotQuestDispose();
    } catch (_) {}
    const p = document.getElementById('grepbot-panel');
    if (p) try { p.remove(); } catch (_) {}
  };

  // ---------- lock registry (v1.4.0) ----------
  // Replaces the 16 per-module `*InFlight` booleans. A boolean lock can only be
  // released by the code path that set it, so a callback that never fires (tab
  // frozen, bfcache restore, thrown handler) strands the feature forever and the
  // `beforeunload` reset block never runs on mobile / bfcache exits. Every lock
  // here carries an acquisition stamp and a TTL: the sweeper releases anything
  // older than its TTL and says so in the log.
  const GB_LOCK_TTL = {
    claim: 120000,
    'farm-scrape': 180000,
    'town-scrape': 180000,
    ib: 120000,
    ab: 120000,
    cave: 120000,
    culture: 120000,
    trade: 120000,
    'rural-trade': 120000,
    'rural-level': 120000,
    research: 120000,
    merchant: 120000,
    favor: 120000,
    wonder: 120000,
    'wonder-favor': 120000,
    dodge: 120000,
    recruit: 120000,
    'defense-pull': 120000,
    'pt-trade': 180000,
    cancel: 60000,
    hero: 60000,
    'collect-bg': 180000,
    'bandit-reward': 60000,
    'quest-claim': 60000,
    'quest-scan': 30000,
  };
  const GB_LOCK_DEFAULT_TTL = 120000;
  const gbLocks = Object.create(null); // name -> acquired-at ms
  function gbLockTtl(name) { return GB_LOCK_TTL[name] || GB_LOCK_DEFAULT_TTL; }
  function gbLocked(name) {
    const at = gbLocks[name];
    if (!at) return false;
    if (Date.now() - at >= gbLockTtl(name)) {
      delete gbLocks[name];
      gbLog(`lock: ${name} expired after ${Math.round((Date.now() - at) / 1000)}s (auto-released)`);
      return false;
    }
    return true;
  }
  // Returns false when the lock is already held - callers use it as the guard.
  function gbLock(name) {
    if (gbLocked(name)) return false;
    gbLocks[name] = Date.now();
    return true;
  }
  function gbUnlock(name) { delete gbLocks[name]; }
  function gbLockAge(name) { return gbLocks[name] ? Date.now() - gbLocks[name] : 0; }
  function gbUnlockAll() { for (const k of Object.keys(gbLocks)) delete gbLocks[k]; }
  function gbLockList() { return Object.keys(gbLocks); }
  function gbLockSweep() {
    for (const k of Object.keys(gbLocks)) gbLocked(k); // gbLocked expires + logs
  }

  const SEEN_MAX = 2000;
  const LOG_THROTTLE_MAX = 200;

  const state = {
    findings: load(STORE.FINDINGS, []),
    farms:    load(STORE.FARMS, ''),
    farmsParsed: load(STORE.FARMS_PARSED, []),
    farmResources: load(STORE.FARM_RES, {}),
    seen:     load(STORE.SEEN, {}),
    towns:    load(STORE.TOWNS, []),
    townResources: load(STORE.TOWN_RES, {}),
    thresholds: load(STORE.THRESH, {}),
    alerted:  load(STORE.ALERTED, {}),
    csrf:     load(wkey(STORE.CSRF), null) || load(STORE.CSRF, null),
    nextFarmScrape: load(STORE.NEXT_FARM, 0),
    nextTownsScrape: load(STORE.NEXT_TOWNS, 0),
    farmAction: load(wkey(STORE.FARM_ACTION), null) || load(STORE.FARM_ACTION, null),
    collectAll: load(STORE.COLLECT_ALL, false),
    autoCollect: load(STORE.AUTO_COLLECT, false),
    collectTpl: load(wkey(STORE.COLLECT_TPL), null) || load(STORE.COLLECT_TPL, null),
    autoBandit: load(STORE.AUTO_BANDIT, false),
    banditLog:  load(STORE.BANDIT_LOG, []),
    autoFarm:   load(STORE.AUTO_FARM, false),
    claimTpl:   load(wkey(STORE.CLAIM_TPL), null) || load(STORE.CLAIM_TPL, null),
    ibAuto:     load(STORE.IB_AUTO, false),
    ibFreeThresh: load(STORE.IB_FREE_THRESH, 300),
    ibAction:   load(wkey(STORE.IB_ACTION), null) || 'completeInstant',
    ibResearch: load(STORE.IB_RESEARCH, false),
    farmOptionMap: load(wkey(STORE.FARM_OPTION_MAP), null) || { 300: 1 },
    farmLongClaims: load(STORE.FARM_LONG_CLAIMS, true),
    farmLoyaltyTech: load(wkey(STORE.FARM_LOYALTY_TECH), '') || '',
    farmLoyaltySeen: load(STORE.FARM_LOYALTY_SEEN, false),
    farmTeachBanner: load(STORE.FARM_TEACH_BANNER, ''),
    farmSleepDur: load(STORE.FARM_SLEEP_DUR, 'auto'),
    farmSleepAuto: load(STORE.FARM_SLEEP_AUTO, false),
    farmSleepFillPct: load(STORE.FARM_SLEEP_FILL, 60),
    farmSleepDay: load(wkey(STORE.FARM_SLEEP_DAY), '') || '',
    ibActionR:  load(wkey(STORE.IB_ACTION_R), null) || 'completeInstant',
    questRewards: load(STORE.QUEST_REWARDS, {}),
    questAutoBuild: load(STORE.QUEST_AUTO_BUILD, false),
    questAutoRes: load(STORE.QUEST_AUTO_RES, false),
    questHistory: load(STORE.QUEST_HISTORY, []),
    collectMaxMin: load(STORE.COLLECT_MAX_MIN, 10),
    farmMinMs: load(STORE.FARM_MIN, 5 * 60 * 1000),
    farmMaxMs: load(STORE.FARM_MAX, 6 * 60 * 1000),
    townMinMs: load(STORE.TOWN_MIN, 6 * 60 * 1000),
    townMaxMs: load(STORE.TOWN_MAX, 7 * 60 * 1000),
    enabledHosts: load(STORE.ENABLED_HOSTS, {}),
    attackTpl: load(wkey(STORE.ATTACK_TPL), null) || load(STORE.ATTACK_TPL, null),
    cancelTpl: load(wkey(STORE.CANCEL_TPL), null) || load(STORE.CANCEL_TPL, null),
    heroTpl: load(wkey(STORE.HERO_TPL), null) || load(STORE.HERO_TPL, null) || {},
    attackPlan: load(STORE.ATTACK_PLAN, null),
    attackHistory: load(STORE.ATTACK_HISTORY, []),
    attackRecent: load(STORE.ATTACK_RECENT, []),
    captchaBreakers: load(wkey(STORE.CAPTCHA), null) || {},
    findingsFilter: load(STORE.FINDINGS_FILTER, { type: '', attacker: '' }),
    panelGeom: load(STORE.PANEL_GEOM, null),
    activeTab: load(STORE.ACTIVE_TAB, 'findings'),
    farmSkipFull: load(STORE.FARM_SKIP_FULL, true),
    farmFullMode: load(STORE.FARM_FULL_MODE, 'any'), // 'any' | 'all'
    abAuto: load(STORE.AB_AUTO, false),
    abTargets: load(STORE.AB_TARGETS, null),
    abNextAt: load(STORE.AB_NEXT, {}),
    abBuildPin: load(STORE.BUILD_PIN, {}),
    abCustomQueue: load(STORE.AB_CUSTOM_Q, {}) || {},
    abQueueStrict: load(STORE.AB_QUEUE_STRICT, true),
    autoCave: load(STORE.AUTO_CAVE, false),
    caveThreshPct: load(STORE.CAVE_THRESH, 90),
    caveTowns: load(STORE.CAVE_TOWNS, {}),
    autoCulture: load(STORE.AUTO_CULTURE, false),
    cultureTypes: load(STORE.CULTURE_TYPES, { festival: true, procession: false, theater: false, olympic: false }),
    allowPremiumCulture: load(STORE.ALLOW_PREMIUM_CULTURE, false),
    cultureGoldBudget: load(STORE.CULTURE_GOLD_BUDGET, 0),
    autoTrade: load(STORE.AUTO_TRADE, false),
    tradePreset: load(STORE.TRADE_PRESET, 'storage'), // storage | party | unit
    tradeReservePct: load(STORE.TRADE_RESERVE, 20),
    tradeMinBatch: load(STORE.TRADE_MIN, 1000),
    tradeMaxHops: load(STORE.TRADE_MAX_HOPS, 15),
    autoRuralTrade: load(STORE.AUTO_RURAL_TRADE, false),
    ruralTradeRatio: load(STORE.RURAL_TRADE_RATIO, 1.0),
    ruralTradeRes: load(STORE.RURAL_TRADE_RES, 'iron'),
    autoRuralLevel: load(STORE.AUTO_RURAL_LEVEL, false),
    ruralLevelMax: load(STORE.RURAL_LEVEL_MAX, 3),
    autoResearch: load(STORE.AUTO_RESEARCH, false),
    researchTargets: load(STORE.RESEARCH_TARGETS, null),
    pauseOnActivity: load(STORE.PAUSE_ON_ACTIVITY, false),
    pauseActivityMs: load(STORE.PAUSE_ACTIVITY_MS, 3 * 60 * 1000),
    nightPause: load(STORE.NIGHT_PAUSE, false),
    nightStart: load(STORE.NIGHT_START, 0), // hour 0-23 local
    nightEnd: load(STORE.NIGHT_END, 7),
    cityTemplates: load(STORE.CITY_TEMPLATES, {}),
    townGroups: load(STORE.TOWN_GROUPS, {}),
    webhookUrl: load(STORE.WEBHOOK_URL, ''),
    webhookEvents: load(STORE.WEBHOOK_EVENTS, { captcha: true, attack: true, warehouse: false, culture: false, pattern: true }),
    lastSeenTs: load(STORE.LAST_SEEN_TS, 0),
    watchHits: load(STORE.WATCH_HITS, {}) || {},
    autoMerchant: load(STORE.AUTO_MERCHANT, false),
    merchantWish: load(STORE.MERCHANT_WISH, []),
    autoPtTrade: load(STORE.AUTO_PT_TRADE, false),
    ptCfg: load(STORE.PT_CFG, null) || {
      targetRatio: 1.0, pumpAmount: 1, maxPumps: 6, reservePct: 10,
      wantRes: { wood: true, stone: true, iron: false },
    },
    ptTradeTpl: load(wkey(STORE.PT_TRADE_TPL), null),
    ptViewUrl: load(wkey(STORE.PT_VIEW_URL), null),
    autoFavor: load(STORE.AUTO_FAVOR, false),
    favorCfg: load(STORE.FAVOR_CFG, { god: 'athena', unit: 'harpy', thresh: 200, maxConcurrent: 2 }),
    autoWonder: load(STORE.AUTO_WONDER, false),
    wonderCfg: load(STORE.WONDER_CFG, { wonderId: null, wood: 0, stone: 0, iron: 0, reserve: 5000, budget: 50000 }),
    autoDodge: load(STORE.AUTO_DODGE, false),
    dodgeMode: load(STORE.DODGE_MODE, 'notify'), // notify | auto
    dodgeFloor: load(STORE.DODGE_FLOOR, 0),
    autoRecruit: load(STORE.AUTO_RECRUIT, false),
    recruitTargets: load(STORE.RECRUIT_TARGETS, {}),
    recruitSpells: load(STORE.RECRUIT_SPELLS, false),
    priorityOrder: load(STORE.PRIORITY_ORDER, PRIORITY_ORDER_DEFAULT.slice()),
    islandShip: load(STORE.ISLAND_SHIP, false),
    autoMilitia: load(STORE.AUTO_MILITIA, false),
    csAlert: load(STORE.CS_ALERT, true),
    playerNotes: load(STORE.PLAYER_NOTES, {}),
    watchlist: load(STORE.WATCHLIST, []),
    grepodataIndex: load(STORE.GREPODATA_INDEX, false),
    captchaGlobalKill: load(STORE.CAPTCHA_GLOBAL, true),
    reqBudgetPerMin: load(STORE.REQ_BUDGET, 40),
    allianceNotes: load(STORE.ALLIANCE_NOTES, {}),
    configVer: load(STORE.CONFIG_VER, 1),
    decisions: load(wkey(STORE.DECISIONS), []),
    decisionSkips: load(wkey(STORE.DECISION_SKIPS), {}),
    decisionMemory: load(STORE.DECISION_MEM, true),
    dryRun: load(STORE.DRY_RUN, false),
    exportRedact: load(STORE.EXPORT_REDACT, true),
    orchAdaptive: load(STORE.ORCH_ADAPTIVE, true),
    orchDeadlockResolve: load(STORE.ORCH_DEADLOCK, true),
    captchaLadder: load(STORE.CAPTCHA_LADDER, [5, 15, 60]),
    postsPerMinSoftPct: load(STORE.POSTS_SOFT_PCT, 60),
    tabFilters: load(STORE.TAB_FILTERS, {}) || {},
    wonderFavorTpl: load(STORE.WONDER_FAVOR_TPL, null),
    autoWonderFavor: load(STORE.AUTO_WONDER_FAVOR, false),
    tplHealth: load(STORE.TPL_HEALTH, {}) || {},
  };

  let panel = null;
  let userPausedUntil = 0;
  let captchaGlobalUntil = +load(STORE.CAPTCHA_GLOBAL_UNTIL, 0) || 0;
  const moduleHealth = {}; // feature -> { ok, err, captcha, last }
  const reqBudgetWindow = []; // timestamps of recent bridge posts
  function saveCaptchaGlobalUntil() {
    save(STORE.CAPTCHA_GLOBAL_UNTIL, captchaGlobalUntil || 0);
  }
  function migrateConfig() {
    let ver = +state.configVer || 1;
    if (ver < 2) {
      // C1: expand truncated priority lists to full 12
      const cur = Array.isArray(state.priorityOrder) ? state.priorityOrder.slice() : [];
      state.priorityOrder = cur.concat(PRIORITY_ORDER_DEFAULT.filter(k => cur.indexOf(k) === -1));
      save(STORE.PRIORITY_ORDER, state.priorityOrder);
      // C3: re-save id-bearing maps under wkey (load already fell back to legacy)
      for (const base of WORLD_SCOPED_BASES) {
        try {
          const v = load(base, null);
          if (v != null) save(base, v);
        } catch (_) {}
      }
      ver = 2;
    }
    if (ver !== state.configVer) {
      state.configVer = ver;
      save(STORE.CONFIG_VER, ver);
      gbLog('config migrated -> v' + ver);
    }
  }

  function markModuleHealth(feature, kind) {
    const h = moduleHealth[feature] || { ok: 0, err: 0, captcha: 0, last: 0 };
    if (kind === 'ok') h.ok++;
    else if (kind === 'captcha') h.captcha++;
    else h.err++;
    h.last = Date.now();
    moduleHealth[feature] = h;
  }
  // ---------- server pressure bus (v1.4.0) ----------
  // 429/503/Retry-After was only honoured on the GM_xmlhttpRequest scrape paths,
  // so a rate-limited server kept getting hammered by every bridge post. One
  // cooldown now covers both transports and every scheduler that asks.
  let serverCooldownUntil = 0;
  const SERVER_COOLDOWN_MAX = 300000;
  const SERVER_PRESSURE_RE = /too many|rate limit|429|503|502|504|temporarily unavailable|maintenance|slow down/i;
  (function loadServerCooldown() {
    try {
      const s = load(STORE.SERVER_COOLDOWN, null);
      if (s && +s.until > Date.now()) serverCooldownUntil = +s.until;
    } catch (_) {}
  })();
  function persistServerCooldown() {
    try {
      if (serverCooldownUntil > Date.now()) save(STORE.SERVER_COOLDOWN, { until: serverCooldownUntil });
      else save(STORE.SERVER_COOLDOWN, null);
    } catch (_) {}
  }
  function gbServerCooldown(ms, why) {
    if (!(ms > 0)) return;
    const until = Date.now() + Math.min(SERVER_COOLDOWN_MAX, ms);
    if (until <= serverCooldownUntil) return;
    serverCooldownUntil = until;
    persistServerCooldown();
    gbLogT('server-cooldown', 15000, `server pressure: pausing ${Math.round(ms / 1000)}s (${why || 'retry-after'})`);
    try { updateStatus(); } catch (_) {}
  }
  function gbServerPaused() { return serverCooldownUntil > Date.now(); }
  function gbServerCooldownLeftMs() { return Math.max(0, serverCooldownUntil - Date.now()); }
  // Bridge/gpAjax replies carry no status code - match the error text instead.
  function noteServerPressure(msg) {
    if (!msg || !SERVER_PRESSURE_RE.test(String(msg))) return false;
    gbServerCooldown(10000 + Math.floor(Math.random() * 10000), String(msg).slice(0, 40));
    return true;
  }
  function automationPaused(reasonOut) {
    if (captchaGlobalUntil && Date.now() < captchaGlobalUntil) {
      if (reasonOut) reasonOut.reason = 'captcha-global';
      return true;
    }
    if (gbServerPaused()) {
      if (reasonOut) reasonOut.reason = 'server';
      return true;
    }
    if (state.pauseOnActivity && Date.now() < userPausedUntil) {
      if (reasonOut) reasonOut.reason = 'user';
      return true;
    }
    if (state.nightPause) {
      const h = new Date().getHours();
      const a = Number.isFinite(+state.nightStart) ? +state.nightStart : 0;
      const b = Number.isFinite(+state.nightEnd) ? +state.nightEnd : 7;
      const inNight = a < b ? (h >= a && h < b) : (h >= a || h < b);
      if (inNight) {
        if (reasonOut) reasonOut.reason = 'night';
        return true;
      }
    }
    return false;
  }
  function bumpUserActivity() {
    if (!state.pauseOnActivity) return;
    userPausedUntil = Date.now() + (state.pauseActivityMs || 180000);
  }
  // Head-index ring: avoid O(n) Array.shift() under burst (budget checks run
  // on every bridgePost).
  let reqBudgetHead = 0;
  function reqBudgetOk() {
    const now = Date.now();
    const cutoff = now - 60000;
    while (reqBudgetHead < reqBudgetWindow.length && reqBudgetWindow[reqBudgetHead] < cutoff) reqBudgetHead++;
    if (reqBudgetHead > 64) {
      reqBudgetWindow.splice(0, reqBudgetHead);
      reqBudgetHead = 0;
    }
    return (reqBudgetWindow.length - reqBudgetHead) < (state.reqBudgetPerMin || 40);
  }
  function reqBudgetSoftDelayMs() {
    const soft = Math.max(5, Math.floor((state.reqBudgetPerMin || 40) *
      ((state.postsPerMinSoftPct != null ? state.postsPerMinSoftPct : 60) / 100)));
    const used = reqBudgetUsed();
    if (used < soft) return 0;
    return Math.min(8000, 400 * (used - soft + 1) + Math.floor(Math.random() * 300));
  }
  function reqBudgetMark() { reqBudgetWindow.push(Date.now()); }
  function reqBudgetUsed() {
    const cutoff = Date.now() - 60000;
    let n = 0;
    for (let i = reqBudgetHead; i < reqBudgetWindow.length; i++) if (reqBudgetWindow[i] >= cutoff) n++;
    return n;
  }

  // ---------- resume-burst serializer (plan 10) ----------
  const WAKE_SPACING_MS = 800;
  const gbWakeQueue = []; // {key, fn, priority, enqueuedAt}
  let gbWakeDraining = false;
  let gbWakeLastTickAt = Date.now();
  let gbWakeBurstUntil = 0;
  function gbWakeDepth() { return gbWakeQueue.length; }
  function gbWake(key, fn, opts) {
    if (!key || typeof fn !== 'function') return;
    const priority = (opts && opts.priority != null) ? +opts.priority : 50;
    const i = gbWakeQueue.findIndex(e => e.key === key);
    if (i >= 0) {
      if (priority < gbWakeQueue[i].priority) gbWakeQueue[i].priority = priority;
      gbWakeQueue[i].fn = fn;
      return;
    }
    gbWakeQueue.push({ key, fn, priority, enqueuedAt: Date.now() });
    gbWakeQueue.sort((a, b) => a.priority - b.priority);
    if (!gbWakeDraining) gbWakeDrain();
  }
  function gbWakeDrain() {
    if (gbWakeDraining) return;
    gbWakeDraining = true;
    (function step() {
      if (!gbWakeQueue.length) { gbWakeDraining = false; return; }
      if (automationPaused({})) {
        gbLogT('wake-paused', 60000, 'wake: paused - draining later');
        gbWakeDraining = false;
        return;
      }
      if (!reqBudgetOk()) {
        gbTimeout(step, 1500 + Math.floor(Math.random() * 500));
        return;
      }
      const item = gbWakeQueue.shift();
      try { item.fn(); } catch (e) { gbLogT('wake-err', 30000, 'wake: ' + item.key + ' ' + String(e).slice(0, 60)); }
      const spacing = WAKE_SPACING_MS + Math.floor(Math.random() * 400);
      if (gbWakeQueue.length) gbTimeout(step, spacing);
      else gbWakeDraining = false;
    })();
  }
  function gbWakeMarkResume(why) {
    gbWakeBurstUntil = Date.now() + 8000;
    gbLogT('wake-resume', 10000, 'wake: resume (' + (why || 'visible') + ') - serializing catch-up');
  }
  function gbInWakeBurst() { return Date.now() < gbWakeBurstUntil; }
  function gbWakeGapTick() {
    const now = Date.now();
    const gap = now - gbWakeLastTickAt;
    gbWakeLastTickAt = now;
    if (gap > 45000) gbWakeMarkResume('timer-gap ' + Math.round(gap / 1000) + 's');
  }

  // ---------- learned-payload health (plan 11) ----------
  const TPL_HEALTH_FAILS = 5;
  const TPL_FEATURE_MAP = {
    farm: 'claimTpl', claim: 'claimTpl',
    build: 'ibAction', 'instant-build': 'ibAction', 'instant-research': 'ibActionR',
    attack: 'attackTpl', cancel: 'cancelTpl', hero: 'heroTpl',
    collect: 'collectTpl',
    pttrade: 'ptTradeTpl',
  };
  function tplHealthSave() { save(STORE.TPL_HEALTH, state.tplHealth || {}); }
  function tplHealthEnsure(name) {
    if (!state.tplHealth) state.tplHealth = {};
    if (!state.tplHealth[name]) {
      state.tplHealth[name] = { learnedAt: 0, lastOkAt: 0, lastErrAt: 0, hardFails: 0, invalidated: false };
    }
    return state.tplHealth[name];
  }
  function tplHealthMarkLearned(name) {
    const h = tplHealthEnsure(name);
    h.learnedAt = Date.now();
    h.hardFails = 0;
    h.invalidated = false;
    h.lastOkAt = 0;
    tplHealthSave();
  }
  function tplHealthNote(feature, result) {
    const name = TPL_FEATURE_MAP[feature];
    if (!name) return;
    if (!state[name] && name !== 'farmAction') return;
    const h = tplHealthEnsure(name);
    if (!result || result === 'ok') {
      h.lastOkAt = Date.now();
      h.hardFails = 0;
      if (h.invalidated) { h.invalidated = false; gbLog('tpl: ' + name + ' recovered'); }
      tplHealthSave();
      return;
    }
    if (!jrnHard(result)) return; // captcha/timeout/skip never invalidate
    h.lastErrAt = Date.now();
    h.hardFails = (h.hardFails || 0) + 1;
    if (h.hardFails >= TPL_HEALTH_FAILS && !h.invalidated) {
      h.invalidated = true;
      gbLog('tpl: ' + name + ' invalidated after ' + h.hardFails + ' hard fails - hand-click to re-learn');
    }
    tplHealthSave();
  }
  function tplHealthOk(name) {
    const h = state.tplHealth && state.tplHealth[name];
    return !(h && h.invalidated);
  }
  function tplHealthBannerText() {
    const h = state.tplHealth || {};
    const bad = Object.keys(h).filter(k => h[k] && h[k].invalidated);
    if (!bad.length) return '';
    return 'Template stale: ' + bad.join(', ') + ' — hand-click once to re-learn';
  }

  // ---------- logging ----------
  // Everything goes to console.info AND the panel's Log tab (ring buffer)
  // (no server relay in paste-only mode)
  const logBuf = [];
  let logHead = 0;
  const logThrottle = new Map();
  const LOG_MAX = 200;
  function gbLog(...args) {
    console.info('[grepbot]', ...args);
    const msg = args.map(a => (typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch (_) { return String(a); } })())).join(' ');
    logBuf.push({ ts: Date.now(), msg });
    if (logBuf.length - logHead > LOG_MAX) logHead = logBuf.length - LOG_MAX;
    if (logHead > LOG_MAX) {
      logBuf.splice(0, logHead);
      logHead = 0;
    }
    renderLog();
  }
  // same key logged at most once per ms - for decisions made inside hot loops
  function gbLogT(key, ms, ...args) {
    const now = Date.now();
    if ((logThrottle.get(key) || 0) + ms > now) return;
    logThrottle.set(key, now);
    if (logThrottle.size > LOG_THROTTLE_MAX) {
      // drop stale (>60s) first; if still over, drop insertion-order half (no sort)
      const cutoff = now - 60000;
      for (const [k, ts] of logThrottle) {
        if (ts < cutoff) logThrottle.delete(k);
      }
      if (logThrottle.size > LOG_THROTTLE_MAX) {
        let n = logThrottle.size >> 1;
        for (const k of logThrottle.keys()) {
          if (n-- <= 0) break;
          logThrottle.delete(k);
        }
      }
    }
    gbLog(...args);
  }
  // Lazy prune: only Object.keys+sort when over SEEN_MAX (not every stamp)
  let seenCount = 0;
  try { seenCount = Object.keys(state.seen || {}).length; } catch (_) { seenCount = 0; }
  function rememberSeen(id) {
    const key = location.hostname + ':' + id;
    const isNew = state.seen[key] == null;
    state.seen[key] = Date.now();
    if (isNew) seenCount++;
    // also drop legacy unscoped key if present
    if (state.seen[id] != null) {
      delete state.seen[id];
      if (String(id) !== key) seenCount = Math.max(0, seenCount - 1);
    }
    if (seenCount > SEEN_MAX) {
      const keys = Object.keys(state.seen);
      keys.sort((a, b) => state.seen[a] - state.seen[b]);
      const drop = keys.length - SEEN_MAX;
      for (let i = 0; i < drop; i++) delete state.seen[keys[i]];
      seenCount = SEEN_MAX;
    }
  }
  function pruneMapsToIds(map, ids) {
    const keep = new Set(ids.map(String));
    let n = 0;
    for (const k of Object.keys(map)) {
      if (!keep.has(String(k))) { delete map[k]; n++; }
    }
    return n;
  }
  // DOM rewrite is deferred + skipped while the Log tab is hidden: gbLog fires
  // per line (hot loops) and rewriting 80 lines of textContent each time is waste
  let logRenderQueued = false;
  function renderLog() {
    const sec = panel && panel.querySelector('section[data-tab=log]');
    const list = sec && sec.querySelector('.log-list');
    // list.hidden = the Log tab is showing the Decisions sub-view instead
    if (!list || sec.hidden || list.hidden || logRenderQueued) return;
    logRenderQueued = true;
    gbTimeout(() => {
      logRenderQueued = false;
      if (sec.hidden || list.hidden) return;
      const start = Math.max(logHead, logBuf.length - 80);
      const lines = logBuf.slice(start);
      list.textContent = lines.map(l => new Date(l.ts).toLocaleTimeString() + ' ' + l.msg).join('\n');
      list.scrollTop = list.scrollHeight;
    }, 250);
  }

  // ---------- game bridge ----------
  // ModernBot-style: read the game's own backbone models instead of scraping
  // DOM/guessing endpoints, and send actions through gpAjax (auto-signs csrf).
  function gameUw() {
    // Never fall back to the sandboxed content-script `window` - it has no
    // MM/Game/gpAjax and returning it makes every bridge check look "ready"
    // while reading null forever.
    try {
      if (typeof unsafeWindow !== 'undefined' && unsafeWindow) return unsafeWindow;
    } catch (_) {}
    try {
      if (window.wrappedJSObject) return window.wrappedJSObject;
    } catch (_) {}
    return Object.create(null);
  }
  // Short-TTL memo of gameUw / MM collections - hot loops call these dozens of times per tick.
  let _uwCache = null, _uwCacheAt = 0;
  const UW_CACHE_MS = 400;
  function uwCached() {
    const now = Date.now();
    if (_uwCache && now - _uwCacheAt < UW_CACHE_MS) return _uwCache;
    _uwCache = gameUw();
    _uwCacheAt = now;
    return _uwCache;
  }
  const _mmColCache = Object.create(null);
  let _mmColCacheAt = 0;
  function mmCol(name) {
    const now = Date.now();
    if (now - _mmColCacheAt >= UW_CACHE_MS) {
      for (const k of Object.keys(_mmColCache)) delete _mmColCache[k];
      _mmColCacheAt = now;
    }
    if (name in _mmColCache) return _mmColCache[name];
    const uw = uwCached();
    let col = null;
    try { if (uw.MM && uw.MM.getOnlyCollectionByName) col = uw.MM.getOnlyCollectionByName(name); } catch (_) {}
    if (!col || !col.models) {
      try {
        const cols = uw.MM && uw.MM.getCollections && uw.MM.getCollections();
        col = (cols && cols[name] && cols[name][0]) || null;
      } catch (_) {}
    }
    _mmColCache[name] = (col && col.models) ? col : null;
    return _mmColCache[name];
  }
  function gameBridgeStatus() {
    const uw = gameUw();
    const s = { uw: !!uw, Game: false, MM: false, gpAjax: false, ITowns: false, GameData: false, farmRel: false, farmTown: false, townCol: false, attackSpot: false };
    try {
      s.Game = !!uw.Game;
      s.MM = !!uw.MM;
      s.gpAjax = !!(uw.gpAjax && uw.gpAjax.ajaxPost);
      s.ITowns = !!(uw.ITowns && uw.ITowns.towns);
      s.GameData = !!(uw.GameData && uw.GameData.units);
      if (s.MM) {
        s.farmRel = !!uw.MM.getOnlyCollectionByName('FarmTownPlayerRelation');
        s.farmTown = !!uw.MM.getOnlyCollectionByName('FarmTown');
        s.townCol = !!uw.MM.getOnlyCollectionByName('Town');
        s.attackSpot = !!uw.MM.getModelByNameAndPlayerId('PlayerAttackSpot');
      }
    } catch (_) {}
    return s;
  }
  function gameBridgeReady() {
    const s = gameBridgeStatus();
    return s.MM && s.gpAjax && s.ITowns;
  }
  // Game clocks are unix seconds (Timestamp.now -> Game.server_time). Wall clock
  // skew vs the server makes early/late lootable_at / cooldown checks.
  function gameNow() {
    const uw = gameUw();
    try {
      if (uw.Timestamp && typeof uw.Timestamp.now === 'function') {
        const t = uw.Timestamp.now();
        if (t > 0) return t;
      }
    } catch (_) {}
    try {
      if (uw.Game && uw.Game.server_time != null) {
        const t = +uw.Game.server_time;
        if (t > 0) return t;
      }
    } catch (_) {}
    return Math.floor(Date.now() / 1000);
  }

  const SYNC = {
    // only cadence ranges remain; no server sync interval
    get FARM_MIN_MS() { return state.farmMinMs; },
    get FARM_MAX_MS() { return state.farmMaxMs; },
    get TOWN_MIN_MS() { return state.townMinMs; },
    get TOWN_MAX_MS() { return state.townMaxMs; },
  };

  // ---------- storage ----------
  // WORLD_SCOPED_BASES auto-key under wkey(); callers that already pass wkey(base)
  // keep working (key contains '@'). Legacy unscoped values are read once as fallback.
  const LOAD_MAX_CHARS = 2 * 1024 * 1024; // refuse corrupt/huge values (~2MB)
  let storageWarnUntil = 0;
  let storageWarnMsg = '';
  function loadValueOk(v, key) {
    if (v === null || v === undefined) return true;
    try {
      const n = typeof v === 'string' ? v.length : JSON.stringify(v).length;
      if (n > LOAD_MAX_CHARS) {
        try {
          if (typeof gbLogT === 'function') gbLogT('load-huge', 60000, 'storage: refusing huge key', key, n);
          else console.warn('[grepbot] storage: refusing huge key', key, n);
        } catch (_) {}
        return false;
      }
    } catch (_) {}
    return true;
  }
  function load(key, fallback) {
    try {
      const scopedCall = String(key).indexOf('@') !== -1;
      if (!scopedCall && WORLD_SCOPED_BASES.has(key)) {
        const v = GM_getValue(wkey(key), null);
        if (v !== null && v !== undefined) return loadValueOk(v, key) ? v : fallback;
        const legacy = GM_getValue(key, null);
        if (legacy !== null && legacy !== undefined) return loadValueOk(legacy, key) ? legacy : fallback;
        return fallback;
      }
      const v = GM_getValue(key, null);
      if (v === null || v === undefined) return fallback;
      return loadValueOk(v, key) ? v : fallback;
    } catch (e) { return fallback; }
  }
  // Drop regenerable bulk so a QuotaExceeded write can retry. Never touch seen
  // aggressively (I14 inbox re-fetch loop) — trim to SEEN_MAX only.
  let storagePruneBusy = false;
  function storageRawSet(k, val) {
    try { GM_setValue(k, val); return true; } catch (_) { return false; }
  }
  function storagePruneForQuota() {
    if (storagePruneBusy) return 0;
    storagePruneBusy = true;
    let bytes = 0;
    try {
      const list = state.decisions;
      if (Array.isArray(list) && list.length > 50) {
        const drop = list.length - 50;
        list.splice(0, drop);
        bytes += drop * 80;
        storageRawSet(wkey(STORE.DECISIONS), list);
      }
    } catch (_) {}
    try {
      const ids = Object.keys(state.seen || {});
      if (ids.length > SEEN_MAX) {
        const drop = ids.length - SEEN_MAX;
        ids.slice(0, drop).forEach(k => { delete state.seen[k]; });
        bytes += drop * 20;
        storageRawSet(wkey(STORE.SEEN), state.seen);
      }
    } catch (_) {}
    try {
      const cut = Date.now() - 3 * 86400000;
      let n = 0;
      Object.keys(state.alerted || {}).forEach(k => {
        if ((state.alerted[k] || 0) < cut) { delete state.alerted[k]; n++; }
      });
      if (n) { bytes += n * 24; storageRawSet(wkey(STORE.ALERTED), state.alerted); }
    } catch (_) {}
    try {
      if (Array.isArray(state.findings) && state.findings.length > 100) {
        const drop = state.findings.length - 100;
        state.findings.splice(0, drop);
        bytes += drop * 200;
        storageRawSet(wkey(STORE.FINDINGS), state.findings);
      }
    } catch (_) {}
    try {
      const cut = Date.now() - 86400000;
      let n = 0;
      Object.keys(state.farmResources || {}).forEach(k => {
        const r = state.farmResources[k];
        if (r && r.ts && r.ts < cut) { delete state.farmResources[k]; n++; }
      });
      if (n) { bytes += n * 40; storageRawSet(wkey(STORE.FARM_RES), state.farmResources); }
    } catch (_) {}
    storagePruneBusy = false;
    return bytes;
  }
  function save(key, val) {
    const scopedCall = String(key).indexOf('@') !== -1;
    const k = (!scopedCall && WORLD_SCOPED_BASES.has(key)) ? wkey(key) : key;
    try {
      GM_setValue(k, val);
    } catch (e) {
      const isQuota = e && (e.name === 'QuotaExceededError' || /quota.?exceeded/i.test(String(e.message || e)));
      if (isQuota) {
        const pruned = storagePruneForQuota();
        try {
          GM_setValue(k, val);
          storageWarnUntil = Date.now() + 5 * 60000;
          storageWarnMsg = 'quota:pruned';
          gbLog('storage: QuotaExceeded on', key, '- pruned ~' + pruned + 'B and retried OK');
          try { updateStatus(); } catch (_) {}
          return;
        } catch (e2) {
          storageWarnUntil = Date.now() + 30 * 60000;
          storageWarnMsg = 'quota FULL';
          console.warn('[grepbot] save fail (quota)', key, e2);
          gbLog('storage: QuotaExceeded on', key, '- write LOST after prune');
          try { updateStatus(); } catch (_) {}
          return;
        }
      }
      console.warn('[grepbot] save fail', key, e);
      try { gbLog('storage: save fail', key, String(e).slice(0, 80)); } catch (_) {}
    }
  }
  // Central GM_xmlhttpRequest: timeout, abort-on-dispose, captcha sniff (I11/I12).
  const GM_XHR_DEFAULT_TIMEOUT = 30000;
  function gbXhr(opts) {
    const timeout = opts.timeout != null ? opts.timeout : GM_XHR_DEFAULT_TIMEOUT;
    const userOnload = opts.onload;
    const userOnerror = opts.onerror;
    const userOntimeout = opts.ontimeout;
    let handle = null;
    let done = false;
    const drop = () => {
      if (done) return;
      done = true;
      const i = gbXhrBag.indexOf(handle);
      if (i >= 0) gbXhrBag.splice(i, 1);
    };
    const noteCaptchaBody = (txt) => {
      if (!txt || typeof txt !== 'string') return false;
      const snip = txt.slice(0, 4000);
      if (!/captcha/i.test(snip)) return false;
      let data = null;
      try {
        if (snip[0] === '{' || snip[0] === '[') data = JSON.parse(txt);
      } catch (_) {}
      if (data && responseIsCaptcha(data)) {
        captchaTrip('http', 'gm-xhr-json');
        return true;
      }
      if (/<html/i.test(snip) || /captcha[_-]?required/i.test(snip)) {
        captchaTrip('http', 'gm-xhr-html');
        return true;
      }
      return false;
    };
    try {
      // Scrapers share the same budget as bridge posts (count attempts).
      reqBudgetMark();
      handle = GM_xmlhttpRequest(Object.assign({}, opts, {
        timeout,
        onload(res) {
          let captcha = false;
          try { captcha = noteCaptchaBody(res && res.responseText); } catch (_) {}
          drop();
          if (captcha) {
            // Do not deliver a normal success to consumers - typed captcha skip.
            if (userOnerror) userOnerror({ error: 'captcha', captcha: true, status: res && res.status });
            return;
          }
          if (userOnload) userOnload(res);
        },
        onerror(e) {
          drop();
          if (userOnerror) userOnerror(e);
        },
        ontimeout(e) {
          drop();
          if (userOntimeout) userOntimeout(e);
          else if (userOnerror) userOnerror(e || { error: 'timeout' });
        },
      }));
      if (handle) gbXhrBag.push(handle);
      return handle;
    } catch (e) {
      drop();
      if (userOnerror) userOnerror({ error: String(e) });
      return null;
    }
  }

  function runningVersion() {
    try { return (GM_info && GM_info.script && GM_info.script.version) || '0.0.0'; }
    catch (_) { return '0.0.0'; }
  }
  function fmtHMS(sec) {
    sec = Math.max(0, Math.floor(+sec || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const p = n => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
  }
  function fmtSec(s) {
    s = Math.max(0, Math.floor(+s || 0));
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60), r = s % 60;
    return r ? `${m}m${r}s` : `${m}m`;
  }

  // ---------- i18n (Phase 5) ----------
  const I18N = {
    es: { collect: 'Recoger', selectAll: 'Seleccionar todas las unidades', cooldown: 'tiempo de espera' },
    en: { collect: 'Collect', selectAll: 'Select all units', cooldown: 'cooldown' },
    de: { collect: 'Sammeln', selectAll: 'Alle Einheiten ausw\u00e4hlen', cooldown: 'Abklingzeit' },
    fr: { collect: 'Collecter', selectAll: 'S\u00e9lectionner toutes les unit\u00e9s', cooldown: 'temps d\'attente' },
    it: { collect: 'Raccogli', selectAll: 'Seleziona tutte le unit\u00e0', cooldown: 'tempo di attesa' },
    pt: { collect: 'Recolher', selectAll: 'Selecionar todas as unidades', cooldown: 'tempo de espera' },
  };
  function marketLocale() {
    const uw = gameUw();
    const m = (uw.Game && uw.Game.market_id) || (uw.Game && uw.Game.market) || '';
    const lang = String(m).slice(0, 2).toLowerCase();
    return I18N[lang] || I18N.en;
  }
  function i18n(key) { return (marketLocale()[key] || I18N.en[key] || key); }

  // ---------- captcha circuit breakers (Phase 2) ----------
  function captchaLadder() {
    const raw = state.captchaLadder;
    if (Array.isArray(raw) && raw.length >= 1) {
      const nums = raw.map(n => Math.max(1, Math.min(24 * 60, +n || 0))).filter(n => n >= 1);
      if (nums.length) return nums;
    }
    return [5, 15, 60];
  }
  const BRIDGE_TIMEOUT_MS = 15000;
  function saveCaptcha() { save(wkey(STORE.CAPTCHA), state.captchaBreakers); }
  function captchaPaused(feature) {
    const b = state.captchaBreakers[feature];
    if (!b || !b.until) return false;
    if (Date.now() >= b.until) {
      // window expired - allow a probe; decay trips so we don't stick at 60m forever
      if ((b.trips || 0) > 0) {
        b.trips = Math.max(0, (b.trips || 1) - 1);
        delete b.until;
        saveCaptcha();
      }
      return false;
    }
    // Clean-hour decay: if last trip was >1h ago and still paused, step down
    if (b.lastCaptchaAt && Date.now() - b.lastCaptchaAt > 3600000 && (b.trips || 0) > 1) {
      b.trips = Math.max(1, (b.trips || 1) - 1);
      saveCaptcha();
    }
    return true;
  }
  // Parent+child captcha gate (dodge<->militia, recruit<->spell).
  function captchaPausedAny(...features) {
    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      if (f && captchaPaused(f)) return true;
    }
    return false;
  }
  function captchaTrip(feature, detail) {
    const ladder = captchaLadder();
    const prev = state.captchaBreakers[feature] || { trips: 0 };
    const trips = Math.min((prev.trips || 0) + 1, ladder.length);
    const mins = ladder[trips - 1];
    state.captchaBreakers[feature] = {
      trips, until: Date.now() + mins * 60000, detail: detail || null,
      lastCaptchaAt: Date.now(),
    };
    saveCaptcha();
    // CSRF may be stale after captcha challenge
    state.csrf = null;
    save(wkey(STORE.CSRF), null);
    try { csrfForceHunt(); } catch (_) {}
    markModuleHealth(feature, 'captcha');
    // Phase 14.1: global kill-switch pauses ALL automation
    if (state.captchaGlobalKill !== false) {
      captchaGlobalUntil = Date.now() + mins * 60000;
      saveCaptchaGlobalUntil();
      gbLog(`CAPTCHA global kill: all features paused ${mins}m`);
    }
    gbLog(`CAPTCHA breaker: ${feature} paused ${mins}m`, detail || '');
    flash(`captcha: ${feature} en pausa ${mins}m`);
    try { if (typeof alertWebhook === 'function') alertWebhook('captcha', { feature, mins, detail }); } catch (_) {}
    updateStatus();
  }
  function captchaClear(feature) {
    if (feature) {
      if (!state.captchaBreakers[feature]) return;
      delete state.captchaBreakers[feature];
    } else {
      state.captchaBreakers = {};
      captchaGlobalUntil = 0;
      saveCaptchaGlobalUntil();
    }
    saveCaptcha();
    updateStatus();
  }
  function responseIsCaptcha(data) {
    if (!data) return false;
    // Unwrap {json: "..."} / {json: {...}} captcha envelopes
    let d = data;
    if (typeof d === 'string') {
      try { d = JSON.parse(d); } catch (_) { return /captcha/i.test(d); }
    }
    if (!d || typeof d !== 'object') return false;
    if (typeof d.json === 'string') {
      try { d = Object.assign({}, d, JSON.parse(d.json)); } catch (_) {}
    } else if (d.json && typeof d.json === 'object') {
      d = Object.assign({}, d, d.json);
    }
    // The game's own bridge wrapper keys on exactly this flag
    // (GrepoApiHelper.getWrappedCallback: `if (true === i.captcha_required)`).
    if (d.captcha_required === true || d.captcha_required === 1) return true;
    if (d.captcha === true || d.captcha === 1) return true;
    if (typeof d.captcha === 'string' && d.captcha.length) return true;
    if (d.json === 'captcha_required' || d.status === 'captcha_required') return true;
    // Real Grepolis signals - do NOT JSON.stringify entire objects (false trips
    // on any nested string containing "captcha", e.g. help text / i18n keys).
    if (d.exception != null && /captcha/i.test(String(d.exception))) return true;
    if (typeof d.html === 'string' && /captcha/i.test(d.html)) return true;
    if (typeof d.redirect === 'string' && /captcha/i.test(d.redirect)) return true;
    const err = d.error;
    if (typeof err === 'string' && /captcha/i.test(err)) return true;
    if (err && typeof err === 'object') {
      const msg = err.message || err.msg || err.code || err.type || '';
      if (msg && /captcha/i.test(String(msg))) return true;
    }
    return false;
  }
  // The XHR spy sees our own bridge posts too. Stamp each outgoing payload so
  // sniffBridgeBody can ignore it - otherwise the bot "learns" a template from
  // a payload it invented itself, and echoes every retry into the log.
  const lastSelfBridge = { sig: '', at: 0 };
  function isSelfBridge(j) {
    if (!j || !lastSelfBridge.sig) return false;
    if (Date.now() - lastSelfBridge.at > 5000) return false;
    return (String(j.model_url || '') + '|' + String(j.action_name || '')) === lastSelfBridge.sig;
  }
  // ---------- raw response tap ----------
  // gpAjax's callback contract is narrower than it looks (read the minified
  // GPAjax in archive/captures): `_ajax` wraps a bare function callback as a
  // SUCCESS-ONLY handler, and the success branch is skipped entirely unless the
  // response carries a non-empty `json` envelope. So:
  //   * a server-side rejection (`json.error`, shown as a HumanMessage) never
  //     calls back,
  //   * a bridge action that returns an empty payload never calls back either -
  //     even though the action executed.
  // Both cases used to hang until BRIDGE_TIMEOUT_MS, which is why every feature
  // logged `err timeout` while instant-build still completed ("timeout but order
  // gone"). Every post now also registers a watcher that the XHR spy settles
  // from the real response. Whichever arrives first wins (`settled` dedupes).
  const gbAjaxPending = [];
  const GB_AJAX_WATCH_MS = 8000;
  function gbAjaxWatch(sig, settle) {
    gbAjaxPending.push({ sig, at: Date.now(), settle });
    while (gbAjaxPending.length > 24) gbAjaxPending.shift();
  }
  function gbAjaxSigs(url, body) {
    const u = String(url || '');
    const out = [];
    if (/frontend_bridge/.test(u) && typeof body === 'string') {
      let j = null;
      try { j = parseBodyLoose(body); } catch (_) {}
      if (j && j.model_url) out.push('bridge:' + j.model_url + '|' + String(j.action_name || ''));
      return out;
    }
    const ctrl = (u.match(/[?&]controller=([a-z_0-9]+)/i) || u.match(/\/game\/([a-z_0-9]+)/i) || [])[1] || '';
    const act = (u.match(/[?&]action=([a-z_0-9]+)/i) || [])[1] || '';
    if (ctrl && act) out.push('ajax:' + ctrl + '/' + act);
    return out;
  }
  // Called by the XHR spy on send(). Returns the settle fn for our own post.
  function gbAjaxClaim(url, body) {
    if (!gbAjaxPending.length) return null;
    const now = Date.now();
    for (let i = gbAjaxPending.length - 1; i >= 0; i--) {
      if (now - gbAjaxPending[i].at > GB_AJAX_WATCH_MS) gbAjaxPending.splice(i, 1);
    }
    if (!gbAjaxPending.length) return null;
    const sigs = gbAjaxSigs(url, body);
    if (!sigs.length) return null;
    for (let i = 0; i < gbAjaxPending.length; i++) {
      if (sigs.indexOf(gbAjaxPending[i].sig) >= 0) return gbAjaxPending.splice(i, 1)[0].settle;
    }
    return null;
  }
  // {json:{...}, plain:{...}, _srvtime:…} -> the data the game hands its callbacks.
  function gbAjaxUnwrap(raw) {
    if (!raw || typeof raw !== 'object') return null;
    let d = Object.prototype.hasOwnProperty.call(raw, 'json') ? raw.json : raw;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) {} }
    if (d == null) d = {};
    else if (typeof d !== 'object') d = { data: d };
    if (raw.plain && typeof raw.plain === 'object') d = Object.assign({}, d, raw.plain);
    return d;
  }
  function bridgePost(feature, payload, onDone) {
    // Every exit path is journaled - skips are decisions too, and "why did the
    // bot do nothing" is the question the Log tab could never answer after a reload.
    const jtag = jrnTag(feature, payload);
    const bail = (err, why) => { jrnPush(jtag, jrnResult(why || err)); return onDone && onDone(err); };
    if (!hostEnabled()) return bail('disabled');
    const pauseInfo = {};
    if (automationPaused(pauseInfo)) {
      gbLogT('auto-pause-' + feature, 60000, feature + ': paused (' + pauseInfo.reason + ')');
      return bail('paused', 'paused:' + pauseInfo.reason);
    }
    if (captchaPaused(feature)) { gbLogT('captcha-pause-' + feature, 60000, feature + ': captcha breaker active'); return bail('captcha-pause'); }
    if (jrnSkipped(jtag)) {
      gbLogT('mem-skip-' + jrnId(jtag), 60000, feature + ': skipped from memory (' + jrnWhy(jtag) + ')');
      return bail('remembered');
    }
    {
      const tplName = TPL_FEATURE_MAP[feature];
      if (tplName && !tplHealthOk(tplName)) {
        gbLogT('tpl-stale-' + tplName, 120000, feature + ': template ' + tplName + ' invalidated - re-learn by hand');
        return bail('tpl-stale');
      }
    }
    if (!reqBudgetOk()) {
      gbLogT('req-budget-' + feature, 30000, feature + ': request budget exceeded');
      return bail('budget');
    }
    const softMs = reqBudgetSoftDelayMs();
    if (softMs > 0) {
      gbLogT('req-soft-' + feature, 30000, feature + ': soft ceiling - delaying ' + softMs + 'ms');
      gbTimeout(() => bridgePost(feature, payload, onDone), softMs);
      return;
    }
    // Dry run: the payload is the thing that needs validating on a live world
    // (TASKS.md gates 8.9-8.13). Log it, journal it, send nothing.
    if (state.dryRun) {
      gbLog(`DRY-RUN ${feature}: ${dryRunFmt(payload)}`);
      return bail('dryrun');
    }
    const uw = gameUw();
    if (!(uw.gpAjax && uw.gpAjax.ajaxPost)) return bail('noajax');
    reqBudgetMark();
    lastSelfBridge.sig = String(payload && payload.model_url || '') + '|' + String(payload && payload.action_name || '');
    lastSelfBridge.at = Date.now();
    let settled = false;
    const finish = (err, data) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!err) markModuleHealth(feature, 'ok');
      else if (err === 'captcha' || err === 'captcha-pause') markModuleHealth(feature, 'captcha');
      else markModuleHealth(feature, 'err');
      jrnPush(jtag, jrnResult(err), err);
      try { tplHealthNote(feature, jrnResult(err)); } catch (_) {}
      if (onDone) onDone(err, data);
    };
    const timer = setTimeout(() => {
      gbLogT('bridge-timeout-' + feature, 30000, feature + ': bridgePost timeout ' + BRIDGE_TIMEOUT_MS + 'ms');
      finish('timeout');
    }, BRIDGE_TIMEOUT_MS);
    const classify = (data) => {
      try {
        if (responseIsCaptcha(data)) {
          captchaTrip(feature, JSON.stringify(data).slice(0, 120));
          return finish('captcha');
        }
        if (data && (data.error || data.exception)) {
          const err = data.error || data.exception;
          const msg = typeof err === 'string' ? err : (err.message || err.msg || 'error');
          if (/csrf|token|unauthorized|login|session/i.test(String(msg))) {
            try { csrfForceHunt(); } catch (_) {}
          }
          noteServerPressure(msg);
          return finish(msg, data);
        }
        captchaClear(feature); // success clears breaker
        finish(null, data);
      } catch (e) {
        finish(String(e));
      }
    };
    gbAjaxWatch(
      'bridge:' + String(payload && payload.model_url || '') + '|' + String(payload && payload.action_name || ''),
      (status, raw) => {
        if (settled) return;
        if (!status) return finish('neterr');
        if (status < 200 || status >= 300) {
          noteServerPressure('http ' + status);
          return finish('http_' + status);
        }
        classify(gbAjaxUnwrap(raw));
      }
    );
    try {
      // gpAjax hands a bare-function callback (data, t_token) - NOT (wnd, data);
      // the window handle is only passed to the {success,error} object form.
      uw.gpAjax.ajaxPost('frontend_bridge', 'execute', payload, false, (data) => classify(data));
    } catch (e) {
      finish(String(e));
    }
  }
  // Non-bridge gpAjax posts (culture celebrations, town_info trade, barracks)
  function gameAjaxPost(feature, controller, action, data, onDone) {
    const jtag = { f: feature, a: String(controller + '/' + action).slice(0, 48), k: String((data && (data.building_id || data.research_id || data.research || data.farm_town_id || data.offer_id || data.id || data.town_id)) || '-').slice(0, 24) };
    const bail = (err, why) => { jrnPush(jtag, jrnResult(why || err)); return onDone && onDone(err); };
    if (!hostEnabled()) return bail('disabled');
    const pauseInfo = {};
    if (automationPaused(pauseInfo)) return bail('paused', 'paused:' + pauseInfo.reason);
    if (captchaPaused(feature) || (captchaGlobalUntil && Date.now() < captchaGlobalUntil)) return bail('captcha-pause');
    if (jrnSkipped(jtag)) {
      gbLogT('mem-skip-' + jrnId(jtag), 60000, feature + ': skipped from memory (' + jrnWhy(jtag) + ')');
      return bail('remembered');
    }
    {
      const tplName = TPL_FEATURE_MAP[feature];
      if (tplName && !tplHealthOk(tplName)) return bail('tpl-stale');
    }
    if (!reqBudgetOk()) return bail('budget');
    if (state.dryRun) {
      gbLog(`DRY-RUN ${feature}: ${controller}/${action} ${dryRunFmt(data)}`);
      return bail('dryrun');
    }
    const uw = gameUw();
    if (!(uw.gpAjax && uw.gpAjax.ajaxPost)) return bail('noajax');
    reqBudgetMark();
    let settled = false;
    const finish = (err, res) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!err) markModuleHealth(feature, 'ok');
      else markModuleHealth(feature, err === 'captcha' ? 'captcha' : 'err');
      jrnPush(jtag, jrnResult(err), err);
      try { tplHealthNote(feature, jrnResult(err)); } catch (_) {}
      if (onDone) onDone(err, res);
    };
    const timer = setTimeout(() => finish('timeout'), BRIDGE_TIMEOUT_MS);
    const classify = (res) => {
      try {
        if (responseIsCaptcha(res)) {
          captchaTrip(feature, JSON.stringify(res).slice(0, 120));
          return finish('captcha');
        }
        if (res && (res.error || res.exception)) {
          const err = res.error || res.exception;
          const msg = typeof err === 'string' ? err : (err.message || err.msg || 'error');
          noteServerPressure(msg);
          return finish(msg, res);
        }
        captchaClear(feature);
        finish(null, res);
      } catch (e) { finish(String(e)); }
    };
    gbAjaxWatch('ajax:' + controller + '/' + action, (status, raw) => {
      if (settled) return;
      if (!status) return finish('neterr');
      if (status < 200 || status >= 300) {
        noteServerPressure('http ' + status);
        return finish('http_' + status);
      }
      classify(gbAjaxUnwrap(raw));
    });
    try {
      // Bare-function callback signature is (data, t_token) - see bridgePost.
      uw.gpAjax.ajaxPost(controller, action, data, false, (res) => classify(res));
    } catch (e) { finish(String(e)); }
  }
  // Compact one-line payload for dry-run logs (full JSON floods the ring buffer)
  function dryRunFmt(payload) {
    try {
      const s = JSON.stringify(payload);
      return s.length > 220 ? s.slice(0, 220) + '...' : s;
    } catch (_) { return String(payload); }
  }
  // Finite numeric config - preserves 0 (unlike `+v || default`).
  function gbCfgNum(v, fallback) {
    const n = +v;
    return Number.isFinite(n) ? n : fallback;
  }
  // DOM side effects must respect dry-run (bridgePost/gameAjaxPost already do).
  function gbDomClick(el, feature) {
    if (!el) return false;
    if (state.dryRun) {
      const tag = el.tagName || '?';
      const hint = el.className ? String(el.className).split(/\s+/)[0] : '';
      gbLog(`DRY-RUN ${feature || 'dom'}: click blocked (${tag}${hint ? '.' + hint : ''})`);
      return false;
    }
    el.click();
    return true;
  }
  // Parse Retry-After / treat 429+5xx as retryable for GM_xmlhttpRequest paths.
  // Also feeds the global cooldown so bridge posts back off with the scrapers.
  function httpRetryAfterMs(res) {
    const st = res && res.status;
    if (!(st === 429 || st === 503 || st === 502 || st === 504)) return 0;
    const hdrs = String((res && res.responseHeaders) || '');
    const m = /retry-after:\s*(\d+)/i.exec(hdrs);
    const ms = m ? Math.min(120000, parseInt(m[1], 10) * 1000)
                 : 5000 + Math.floor(Math.random() * 5000);
    gbServerCooldown(ms, 'http ' + st);
    return ms;
  }

  // ---------- town warehouse state (shared reader, v1.4.0) ----------
  // Lived inside farms.js while cave/trade/sleep-claim each re-derived fill from
  // scratch. One reader, one 3s memo, one definition of "full".
  const _townResCache = Object.create(null);
  const TOWN_RES_CACHE_MS = 3000;
  function townResState(townId) {
    if (townId == null || townId === '') return null;
    const key = String(townId);
    const now = Date.now();
    const hit = _townResCache[key];
    if (hit && now - hit.at < TOWN_RES_CACHE_MS) return hit.v;
    const uw = gameUw();
    let t = null;
    try {
      t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]);
    } catch (_) {}
    let out = null;
    if (t) {
      let wood, stone, iron, resStorage = null;
      try {
        const r = t.resources && t.resources();
        if (r && r.wood != null) {
          wood = +r.wood; stone = +r.stone; iron = +r.iron;
          if (r.storage != null) resStorage = +r.storage;
        }
      } catch (_) {}
      if (wood != null) {
        // Prefer real capacity APIs - resources().storage is sometimes the building level.
        let cap = null;
        try { if (t.getStorageCapacity) cap = +t.getStorageCapacity(); } catch (_) {}
        try { if (!(cap > 0) && t.storage && t.storage.getCapacity) cap = +t.storage.getCapacity(); } catch (_) {}
        if (!(cap > 0) && resStorage > 100) cap = resStorage; // large value ~ capacity
        if (cap > 0) {
          const isFull = (v) => v >= cap || v / cap >= 0.99;
          const full = { wood: isFull(wood), stone: isFull(stone), iron: isFull(iron) };
          const n = (full.wood ? 1 : 0) + (full.stone ? 1 : 0) + (full.iron ? 1 : 0);
          const fillPct = Math.round(Math.max(wood, stone, iron) / cap * 100);
          out = { cap, wood, stone, iron, full, n, fillPct };
        }
      }
    }
    _townResCache[key] = { at: now, v: out };
    return out;
  }
  function townFillPct(townId) {
    const st = townResState(townId);
    return st ? st.fillPct : null;
  }
  // Shared pin helper for deadlock resolver (05) and culture↔cave (08).
  function townIsPinned(townId) {
    const st = townResState(townId);
    if (!st || !(st.cap > 0)) {
      gbLogT('pin-blind-' + townId, 300000, 'econ: cap unreadable town ' + townId + ' - not pinned (blind)');
      return false;
    }
    return Math.max(st.wood, st.stone, st.iron) / st.cap >= 0.97;
  }
  function townIronReserveForCave(townId) {
    // Iron needed to reach caveThreshPct of warehouse (culture must not drain below).
    const st = townResState(townId);
    if (!st || !(st.cap > 0)) return null;
    const thresh = Math.min(99, Math.max(50, +state.caveThreshPct || 90)) / 100;
    const need = Math.ceil(st.cap * thresh);
    return Math.max(0, need - (st.iron || 0));
  }
  const CAVE_SOON_MS = 15 * 60 * 1000;
  const cultureCaveDeferCount = Object.create(null); // townId -> consecutive defers
  function ironReservedForCave(townId) {
    // Culture/party-trade defer when cave will want this iron soon.
    if (!state.autoCave) return { reserved: false, etaMs: null, blind: false };
    const st = townResState(townId);
    if (!st || !(st.cap > 0) || st.iron == null) {
      gbLogT('cave-res-blind-' + townId, 300000, 'ironReservedForCave: blind - culture proceeds');
      return { reserved: false, etaMs: null, blind: true };
    }
    let hideLvl = 0, hideFull = false;
    try {
      if (typeof caveTownInfo === 'function') {
        const info = caveTownInfo(townId);
        if (info) {
          hideLvl = +info.hideLvl || 0;
          if (info.unlimited) hideFull = false;
          else if (info.hideCap > 0 && info.stored != null && info.stored >= info.hideCap) hideFull = true;
        }
      }
    } catch (_) {}
    if (!(hideLvl > 0) || hideFull) return { reserved: false, etaMs: null, blind: false };
    const thresh = Math.min(99, Math.max(50, +state.caveThreshPct || 90)) / 100;
    const need = Math.ceil(st.cap * thresh);
    if (st.iron >= need) return { reserved: true, etaMs: 0, blind: false };
    // Production rate: prefer model, else assume slow fill (blind-ish but allow)
    let ironPerSec = null;
    try {
      const uw = gameUw();
      const t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]);
      if (t) {
        const p = t.getProduction ? t.getProduction() : (t.production && t.production());
        if (p && p.iron != null) ironPerSec = +p.iron / 3600; // often per-hour
        if (p && p.iron != null && p.iron > 100) ironPerSec = +p.iron / 3600;
        else if (p && p.iron != null) ironPerSec = +p.iron; // already per-sec
      }
    } catch (_) {}
    if (!(ironPerSec > 0)) {
      return { reserved: false, etaMs: null, blind: true };
    }
    const short = need - st.iron;
    const etaMs = (short / ironPerSec) * 1000;
    return { reserved: etaMs <= CAVE_SOON_MS, etaMs, blind: false };
  }
  function cultureShouldDeferForCave(townId) {
    const r = ironReservedForCave(townId);
    if (!r.reserved) {
      cultureCaveDeferCount[townId] = 0;
      return false;
    }
    const n = (cultureCaveDeferCount[townId] || 0) + 1;
    cultureCaveDeferCount[townId] = n;
    if (n > 3) {
      gbLogT('culture-cave-override-' + townId, 120000,
        `culture: defer cap hit for town ${townId} - culture wins over cave reserve`);
      cultureCaveDeferCount[townId] = 0;
      return false;
    }
    gbLogT('culture-defer-' + townId, 60000,
      `culture: defer town ${townId} - iron reserved for cave (eta ${r.etaMs != null ? Math.round(r.etaMs / 1000) + 's' : '?'})`);
    return true;
  }

  // ---------- shared precondition readers (v1.5.2) ----------
  // Every feature asks the same questions before it posts: can this town pay,
  // is there a free slot, is the timer up. These are the shared readers for the
  // "can I pay" half; slot/timer checks stay in the module that owns them.
  //
  // Rule for every precondition in this codebase: only BLOCK on a value that was
  // actually read. Method names differ per client build, so a missing field means
  // "unknown", not "no" - the verdict carries `blind` and the feature logs once
  // and lets the server be the authority. A guard that goes silently dead when a
  // client renames a getter is worse than no guard.
  function gbProbeNum(obj, names, args) {
    if (!obj) return null;
    for (const n of names) {
      try {
        if (typeof obj[n] !== 'function') continue;
        const v = +obj[n].apply(obj, args || []);
        if (isFinite(v)) return v;
      } catch (_) {}
    }
    return null;
  }
  function gbProbeAttr(obj, names) {
    if (!obj) return null;
    const a = obj.attributes || obj;
    for (const n of names) {
      try {
        const v = +a[n];
        if (a[n] != null && isFinite(v)) return v;
      } catch (_) {}
    }
    return null;
  }
  function gbTownModel(townId) {
    try {
      const uw = gameUw();
      return (uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId])) || null;
    } catch (_) { return null; }
  }
  function gbTownPop(townId) {
    const t = gbTownModel(townId);
    if (!t) return null;
    const v = gbProbeNum(t, ['getAvailablePopulation', 'getFreePopulation', 'getPopulation']);
    if (v != null) return v;
    try {
      const r = t.resources && t.resources();
      if (r && r.population != null) return +r.population;
    } catch (_) {}
    return null;
  }
  function gbPlayerGold() {
    try {
      const uw = gameUw();
      const p = uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('Player');
      const v = gbProbeAttr(p, ['gold', 'premium_gold']);
      if (v != null) return v;
      if (uw.Game && uw.Game.player_gold != null) return +uw.Game.player_gold;
    } catch (_) {}
    return null;
  }
  const GB_RES_KEYS = ['wood', 'stone', 'iron'];
  // cost: { wood, stone, iron, population } - any subset; 0/absent = no requirement.
  // -> { ok, blind, short: ['wood 120/500', ...], detail }
  function gbAfford(townId, cost, opts) {
    const o = opts || {};
    const margin = o.margin != null ? +o.margin : 0;
    if (!cost) return { ok: true, blind: true, short: [], detail: 'no cost data' };
    const st = townResState(townId);
    const short = [];
    let blind = false;
    for (const k of GB_RES_KEYS) {
      const need = +cost[k] || 0;
      if (need <= 0) continue;
      if (!st || st[k] == null) { blind = true; continue; }
      if (st[k] < need + margin) short.push(`${k} ${Math.floor(st[k])}/${need}`);
    }
    const needPop = +cost.population || 0;
    if (needPop > 0) {
      const pop = gbTownPop(townId);
      if (pop == null) blind = true;
      else if (pop < needPop) short.push(`pop ${pop}/${needPop}`);
    }
    return { ok: short.length === 0, blind, short, detail: short.join(', ') };
  }
  // Building level in a town, or null when the client hides the collection.
  function gbBuildingLevel(townId, building) {
    const t = gbTownModel(townId);
    if (!t) return null;
    try {
      if (t.getBuildings) {
        const v = +t.getBuildings().get(building);
        if (isFinite(v)) return v;
      }
    } catch (_) {}
    try {
      const a = (t.buildings && t.buildings().attributes) || {};
      if (a[building] != null) return +a[building] || 0;
    } catch (_) {}
    return null;
  }

  // ---------- per-host enable (Phase 5 / C7) ----------
  function hostEnabled() {
    // Explicit opt-in only - undefined/false = OFF (safe default).
    return state.enabledHosts[location.host] === true;
  }
  function ensureHostDefault() {
    const h = location.host;
    if (state.enabledHosts[h] === undefined) {
      state.enabledHosts[h] = false;
      save(STORE.ENABLED_HOSTS, state.enabledHosts);
      gbLog('host ' + h + ' disabled by default - enable in Config');
    }
  }


  // ---------- csrf / token hunt ----------
  // Hoisted out of huntCsrf: the loop runs every 5s until a token is found and
  // every 30s after, so both the regexes and the candidate table were being
  // rebuilt (12 closures + 2 RegExp compiles per probe) on every tick.
  const CSRF_TOK16 = /^[a-f0-9]{16,64}$/i;
  const CSRF_TOK32 = /^[a-f0-9]{32,64}$/i;
  const CSRF_COOKIE_H = /(?:^|;\s*)h=([a-f0-9]{32,64})(?:;|$)/i;
  const CSRF_COOKIE_C = /(?:^|;\s*)csrf=([a-f0-9]{32,64})(?:;|$)/i;
  function csrfIsTok(v, min) {
    if (!v) return false;
    return (min >= 32 ? CSRF_TOK32 : CSRF_TOK16).test(String(v));
  }
  // Probes run cheapest-first: page globals, then DOM, then cookie/attribute
  // sweeps. Built once at module scope; each probe takes the page window.
  const CSRF_PROBES = [
    [w => w.csrfToken, 16],
    [w => w.csrf_token, 16],
    [w => w.h, 16],
    [w => w.Game && w.Game.csrfToken, 16],
    [w => w.Game && w.Game.h, 16],
    [() => document.querySelector('meta[name="csrf-token"]')?.content, 16],
    [() => document.querySelector('meta[name="h"]')?.content, 16],
    [() => document.querySelector('input[name="h"]')?.value, 16],
    [() => document.querySelector('input[name="csrfToken"]')?.value, 16],
    // cookie - exact name, hex >=32 (skip short analytics crumbs)
    [() => {
      const m = document.cookie.match(CSRF_COOKIE_H) || document.cookie.match(CSRF_COOKIE_C);
      return m ? m[1] : null;
    }, 32],
    // data-h: only accept token-shaped values (skip unrelated UI attrs)
    [() => {
      for (const el of document.querySelectorAll('[data-h]')) {
        const v = el.getAttribute('data-h');
        if (csrfIsTok(v, 32)) return v;
      }
      return null;
    }, 32],
  ];
  function huntCsrf() {
    const w = gameUw();
    for (const [fn, min] of CSRF_PROBES) {
      try {
        const v = fn(w);
        if (csrfIsTok(v, min)) return String(v);
      } catch (_) {}
    }
    return null;
  }
  // Immediate re-probe after captcha / auth-shaped bridge errors (no extra interval)
  function csrfForceHunt() {
    const fresh = huntCsrf();
    if (fresh && fresh !== state.csrf) {
      state.csrf = fresh;
      save(wkey(STORE.CSRF), state.csrf);
      gbLog('csrf refreshed', fresh.slice(0, 6) + '...');
      return fresh;
    }
    return fresh || null;
  }
  (function csrfLoop() {
    const fresh = huntCsrf();
    if (fresh && fresh !== state.csrf) {
      state.csrf = fresh;
      save(wkey(STORE.CSRF), state.csrf);
      gbLog('csrf found', fresh.slice(0,6)+'...');
    }
    else if (!fresh && !state.csrf) gbLogT('csrf-miss', 60000, 'csrf not found yet - retrying');
    // Stable token -> 120s (DOM probes are wasteful); miss -> 5s
    gbTimeout(csrfLoop, state.csrf ? 120000 : 5000);
  })();

