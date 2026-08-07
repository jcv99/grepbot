// ==UserScript==
// @name         GrepBot
// @namespace    grepbot
// @version      1.6.1
// @description  Grepolis scout/farm/build/trade/culture/recruit automation. ToS forbid automation; risk = ban.
// @author       j
// @match        https://*.grepolis.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @connect      grepolis.com
// @connect      discord.com
// @connect      discordapp.com
// @connect      api.telegram.org
// ==/UserScript==

(function () {
  'use strict';
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

  const PRIORITY_ORDER_DEFAULT = ['culture', 'cave', 'build', 'research', 'trade', 'farm',
    'ruraltrade', 'rurallevel', 'recruit', 'merchant', 'pttrade', 'favor', 'wonder'];
  const CONFIG_VER_CURRENT = 2;

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

  function wkey(base) { return base + '@' + location.hostname; }

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
  const gbLocks = Object.create(null);
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
    for (const k of Object.keys(gbLocks)) gbLocked(k);
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
    farmFullMode: load(STORE.FARM_FULL_MODE, 'any'),
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
    tradePreset: load(STORE.TRADE_PRESET, 'storage'),
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
    nightStart: load(STORE.NIGHT_START, 0),
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
    dodgeMode: load(STORE.DODGE_MODE, 'notify'),
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
  const moduleHealth = {};
  const reqBudgetWindow = [];
  function saveCaptchaGlobalUntil() {
    save(STORE.CAPTCHA_GLOBAL_UNTIL, captchaGlobalUntil || 0);
  }
  function migrateConfig() {
    let ver = +state.configVer || 1;
    if (ver < 2) {

      const cur = Array.isArray(state.priorityOrder) ? state.priorityOrder.slice() : [];
      state.priorityOrder = cur.concat(PRIORITY_ORDER_DEFAULT.filter(k => cur.indexOf(k) === -1));
      save(STORE.PRIORITY_ORDER, state.priorityOrder);

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

  const WAKE_SPACING_MS = 800;
  const gbWakeQueue = [];
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
    if (!jrnHard(result)) return;
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

  function gbLogT(key, ms, ...args) {
    const now = Date.now();
    if ((logThrottle.get(key) || 0) + ms > now) return;
    logThrottle.set(key, now);
    if (logThrottle.size > LOG_THROTTLE_MAX) {

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

  let seenCount = 0;
  try { seenCount = Object.keys(state.seen || {}).length; } catch (_) { seenCount = 0; }
  function rememberSeen(id) {
    const key = location.hostname + ':' + id;
    const isNew = state.seen[key] == null;
    state.seen[key] = Date.now();
    if (isNew) seenCount++;

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

  let logRenderQueued = false;
  function renderLog() {
    const sec = panel && panel.querySelector('section[data-tab=log]');
    const list = sec && sec.querySelector('.log-list');

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

  function gameUw() {

    try {
      if (typeof unsafeWindow !== 'undefined' && unsafeWindow) return unsafeWindow;
    } catch (_) {}
    try {
      if (window.wrappedJSObject) return window.wrappedJSObject;
    } catch (_) {}
    return Object.create(null);
  }

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

    get FARM_MIN_MS() { return state.farmMinMs; },
    get FARM_MAX_MS() { return state.farmMaxMs; },
    get TOWN_MIN_MS() { return state.townMinMs; },
    get TOWN_MAX_MS() { return state.townMaxMs; },
  };

  const LOAD_MAX_CHARS = 2 * 1024 * 1024;
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

      reqBudgetMark();
      handle = GM_xmlhttpRequest(Object.assign({}, opts, {
        timeout,
        onload(res) {
          let captcha = false;
          try { captcha = noteCaptchaBody(res && res.responseText); } catch (_) {}
          drop();
          if (captcha) {

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

      if ((b.trips || 0) > 0) {
        b.trips = Math.max(0, (b.trips || 1) - 1);
        delete b.until;
        saveCaptcha();
      }
      return false;
    }

    if (b.lastCaptchaAt && Date.now() - b.lastCaptchaAt > 3600000 && (b.trips || 0) > 1) {
      b.trips = Math.max(1, (b.trips || 1) - 1);
      saveCaptcha();
    }
    return true;
  }

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

    state.csrf = null;
    save(wkey(STORE.CSRF), null);
    try { csrfForceHunt(); } catch (_) {}
    markModuleHealth(feature, 'captcha');

    if (state.captchaGlobalKill !== false) {
      captchaGlobalUntil = Date.now() + mins * 60000;
      saveCaptchaGlobalUntil();
      gbLog(`CAPTCHA global kill: all features paused ${mins}m`);
    }
    gbLog(`CAPTCHA breaker: ${feature} paused ${mins}m`, detail || '');
    flash(`captcha: ${feature} paused ${mins}m`);
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

    if (d.captcha_required === true || d.captcha_required === 1) return true;
    if (d.captcha === true || d.captcha === 1) return true;
    if (typeof d.captcha === 'string' && d.captcha.length) return true;
    if (d.json === 'captcha_required' || d.status === 'captcha_required') return true;

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

  const lastSelfBridge = { sig: '', at: 0 };
  function isSelfBridge(j) {
    if (!j || !lastSelfBridge.sig) return false;
    if (Date.now() - lastSelfBridge.at > 5000) return false;
    return (String(j.model_url || '') + '|' + String(j.action_name || '')) === lastSelfBridge.sig;
  }

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
        captchaClear(feature);
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

      uw.gpAjax.ajaxPost('frontend_bridge', 'execute', payload, false, (data) => classify(data));
    } catch (e) {
      finish(String(e));
    }
  }

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

      uw.gpAjax.ajaxPost(controller, action, data, false, (res) => classify(res));
    } catch (e) { finish(String(e)); }
  }

  function dryRunFmt(payload) {
    try {
      const s = JSON.stringify(payload);
      return s.length > 220 ? s.slice(0, 220) + '...' : s;
    } catch (_) { return String(payload); }
  }

  function gbCfgNum(v, fallback) {
    const n = +v;
    return Number.isFinite(n) ? n : fallback;
  }

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

        let cap = null;
        try { if (t.getStorageCapacity) cap = +t.getStorageCapacity(); } catch (_) {}
        try { if (!(cap > 0) && t.storage && t.storage.getCapacity) cap = +t.storage.getCapacity(); } catch (_) {}
        if (!(cap > 0) && resStorage > 100) cap = resStorage;
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

  function townIsPinned(townId) {
    const st = townResState(townId);
    if (!st || !(st.cap > 0)) {
      gbLogT('pin-blind-' + townId, 300000, 'econ: cap unreadable town ' + townId + ' - not pinned (blind)');
      return false;
    }
    return Math.max(st.wood, st.stone, st.iron) / st.cap >= 0.97;
  }
  function townIronReserveForCave(townId) {

    const st = townResState(townId);
    if (!st || !(st.cap > 0)) return null;
    const thresh = Math.min(99, Math.max(50, +state.caveThreshPct || 90)) / 100;
    const need = Math.ceil(st.cap * thresh);
    return Math.max(0, need - (st.iron || 0));
  }
  const CAVE_SOON_MS = 15 * 60 * 1000;
  const cultureCaveDeferCount = Object.create(null);
  function ironReservedForCave(townId) {

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

    let ironPerSec = null;
    try {
      const uw = gameUw();
      const t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]);
      if (t) {
        const p = t.getProduction ? t.getProduction() : (t.production && t.production());
        if (p && p.iron != null) ironPerSec = +p.iron / 3600;
        if (p && p.iron != null && p.iron > 100) ironPerSec = +p.iron / 3600;
        else if (p && p.iron != null) ironPerSec = +p.iron;
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

  function hostEnabled() {

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

  const CSRF_TOK16 = /^[a-f0-9]{16,64}$/i;
  const CSRF_TOK32 = /^[a-f0-9]{32,64}$/i;
  const CSRF_COOKIE_H = /(?:^|;\s*)h=([a-f0-9]{32,64})(?:;|$)/i;
  const CSRF_COOKIE_C = /(?:^|;\s*)csrf=([a-f0-9]{32,64})(?:;|$)/i;
  function csrfIsTok(v, min) {
    if (!v) return false;
    return (min >= 32 ? CSRF_TOK32 : CSRF_TOK16).test(String(v));
  }

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

    [() => {
      const m = document.cookie.match(CSRF_COOKIE_H) || document.cookie.match(CSRF_COOKIE_C);
      return m ? m[1] : null;
    }, 32],

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

    gbTimeout(csrfLoop, state.csrf ? 120000 : 5000);
  })();

  const JRN_MAX = 400;
  const JRN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const JRN_DEDUP_MS = 10 * 60 * 1000;
  const JRN_SAVE_MS = 5000;
  const JRN_FAIL_TRIP = 3;
  const JRN_BACKOFF = [5, 15, 60];

  const JRN_SKIP_ERRS = { disabled: 1, paused: 1, 'captcha-pause': 1, budget: 1, noajax: 1, remembered: 1, dryrun: 1 };

  if (!Array.isArray(state.decisions)) state.decisions = [];
  if (!state.decisionSkips || typeof state.decisionSkips !== 'object') state.decisionSkips = {};

  let jrnHost = location.hostname;
  function jrnCheckHost() {
    if (location.hostname === jrnHost) return;
    try { jrnFlush(); } catch (_) {}
    jrnHost = location.hostname;
    const next = load(wkey(STORE.DECISIONS), []);
    state.decisions = Array.isArray(next) ? next : [];
    const skips = load(wkey(STORE.DECISION_SKIPS), {});
    state.decisionSkips = (skips && typeof skips === 'object') ? skips : {};
    gbLog('memory: reloaded for host ' + jrnHost);
  }
  try { jrnPrune(); } catch (_) {}

  function jrnResult(err) {
    if (!err) return 'ok';
    const s = String(err);
    if (JRN_SKIP_ERRS[s.split(':')[0]]) return 'skip:' + s.slice(0, 40);
    return s.slice(0, 60);
  }

  function jrnHard(r) {
    return !!r && r !== 'ok' && r !== 'timeout' && r !== 'captcha' && r.slice(0, 5) !== 'skip:';
  }
  function jrnId(tag) { return tag.f + '|' + tag.a + '|' + tag.k; }

  function jrnTag(feature, payload) {
    let action = '', target = '';
    try {
      const p = payload || {};
      action = p.action_name || p.action || '';
      const mu = String(p.model_url || p.model || '');
      if (mu) {
        const model = mu.split('/')[0] || mu;
        action = action ? model + '/' + action : model;
      }
      const args = p.arguments || {};

      target = args.building_id || args.research_id || args.research || args.farm_town_id
        || args.offer_id || args.offer || args.power_id
        || (args.id != null && String(args.id) !== String(p.town_id) ? args.id : '')
        || p.town_id || args.town_id || '';
    } catch (_) {}
    return { f: feature, a: String(action || 'post').slice(0, 48), k: String(target || '-').slice(0, 24) };
  }

  function jrnPrune() {
    const cut = Date.now() - JRN_TTL_MS;
    const list = state.decisions;
    let i = 0;
    while (i < list.length && list[i].ts < cut) i++;
    if (i) list.splice(0, i);
    while (list.length > JRN_MAX) list.shift();
  }

  let jrnSaveQueued = false;
  function jrnSave(immediate) {
    if (!immediate) {
      if (jrnSaveQueued) return;
      jrnSaveQueued = true;
      gbTimeout(() => { jrnSaveQueued = false; jrnSave(true); }, JRN_SAVE_MS);
      return;
    }
    jrnPrune();
    save(wkey(STORE.DECISIONS), state.decisions);
    save(wkey(STORE.DECISION_SKIPS), state.decisionSkips);
  }
  function jrnFlush() { if (jrnSaveQueued) { jrnSaveQueued = false; jrnSave(true); } }

  function jrnPush(tag, result, detail) {
    jrnCheckHost();
    const list = state.decisions;
    const now = Date.now();
    for (let i = list.length - 1, seen = 0; i >= 0 && seen < 40; i--, seen++) {
      const r = list[i];
      if (r.f !== tag.f || r.a !== tag.a || r.k !== tag.k) continue;
      if (r.r === result && now - r.ts < JRN_DEDUP_MS) {
        r.n = (r.n || 1) + 1;
        r.ts = now;

        list.splice(i, 1);
        list.push(r);
        jrnNote(tag, result);
        jrnSave();
        return r;
      }
      break;
    }
    const rec = { ts: now, f: tag.f, a: tag.a, k: tag.k, r: result, n: 1 };
    if (detail && jrnHard(result)) rec.d = String(detail).slice(0, 80);
    list.push(rec);
    jrnPrune();
    jrnNote(tag, result);
    jrnSave();
    return rec;
  }

  function gbFailStreak(feature, action, target) {
    const list = state.decisions;
    let n = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const r = list[i];
      if (r.f !== feature || r.a !== action || String(r.k) !== String(target)) continue;
      if (r.r === 'ok') break;
      if (!jrnHard(r.r)) continue;
      n += r.n || 1;
    }
    return n;
  }

  function gbRecall(feature, action, target) {
    const list = state.decisions;
    for (let i = list.length - 1; i >= 0; i--) {
      const r = list[i];
      if (feature && r.f !== feature) continue;
      if (action && r.a !== action) continue;
      if (target != null && String(r.k) !== String(target)) continue;
      return r;
    }
    return null;
  }
  function gbRecallAll(feature, action, target) {
    return state.decisions.filter(r =>
      (!feature || r.f === feature) &&
      (!action || r.a === action) &&
      (target == null || String(r.k) === String(target)));
  }

  function gbRemember(feature, action, target, result, detail) {
    return jrnPush({ f: feature, a: String(action || 'decide').slice(0, 48), k: String(target == null ? '-' : target).slice(0, 24) },
      jrnResult(result === 'ok' || result == null ? null : result), detail);
  }

  function jrnNote(tag, result) {
    const key = jrnId(tag);
    if (result === 'ok') {
      if (state.decisionSkips[key]) { delete state.decisionSkips[key]; jrnSave(); }
      return;
    }
    if (!jrnHard(result)) return;
    if (gbFailStreak(tag.f, tag.a, tag.k) < JRN_FAIL_TRIP) return;
    const prev = state.decisionSkips[key] || { trips: 0 };
    if (prev.until && Date.now() < prev.until) return;
    const trips = Math.min((prev.trips || 0) + 1, JRN_BACKOFF.length);
    const mins = JRN_BACKOFF[trips - 1];
    state.decisionSkips[key] = { trips, until: Date.now() + mins * 60000, r: result };
    gbLog(`memory: ${tag.f} ${tag.a} ${tag.k} failed ${JRN_FAIL_TRIP}x (${result}) - skipping ${mins}m`);
    jrnSave(true);
  }

  function jrnSkipped(tag) {
    jrnCheckHost();
    if (state.decisionMemory === false) return false;
    const s = state.decisionSkips[jrnId(tag)];
    if (!s || !s.until) return false;
    if (Date.now() >= s.until) {
      s.trips = Math.max(0, (s.trips || 1) - 1);
      delete s.until;
      jrnSave();
      return false;
    }
    return true;
  }
  function jrnWhy(tag) {
    const s = state.decisionSkips[jrnId(tag)];
    if (!s) return '';
    return (s.r || 'error') + ', ' + fmtSec(Math.round(((s.until || 0) - Date.now()) / 1000)) + ' left';
  }
  function jrnActiveSkips() {
    const now = Date.now();
    return Object.entries(state.decisionSkips)
      .filter(([, s]) => s && s.until && s.until > now)
      .map(([k, s]) => ({ key: k, until: s.until, trips: s.trips, r: s.r }));
  }
  function jrnClearSkips() {
    state.decisionSkips = {};
    jrnSave(true);
    gbLog('memory: skip windows cleared');
  }
  function jrnClear() {
    state.decisions = [];
    state.decisionSkips = {};
    jrnSave(true);
    gbLog('memory: journal cleared');
  }

  function jrnStats(windowMs) {
    const since = Date.now() - (windowMs || 24 * 60 * 60 * 1000);
    const byFeature = Object.create(null);
    const bySkip = Object.create(null);
    const byError = Object.create(null);
    let ok = 0, err = 0, captcha = 0, skip = 0, timeout = 0, dry = 0, total = 0;
    for (const r of (state.decisions || [])) {
      if (r.ts < since) continue;
      const n = r.n || 1;
      total += n;
      const f = byFeature[r.f] || (byFeature[r.f] = { ok: 0, err: 0, captcha: 0, skip: 0, timeout: 0, n: 0, last: 0 });
      f.n += n;
      f.last = Math.max(f.last, r.ts);
      const res = String(r.r || '');
      if (res === 'ok') { ok += n; f.ok += n; }
      else if (res === 'captcha') { captcha += n; f.captcha += n; }
      else if (res === 'timeout') { timeout += n; f.timeout += n; }
      else if (res.slice(0, 5) === 'skip:') {
        skip += n; f.skip += n;
        const why = res.slice(5);
        if (why.slice(0, 6) === 'dryrun') dry += n;
        bySkip[why] = (bySkip[why] || 0) + n;
      } else {
        err += n; f.err += n;
        const key = r.f + ' ' + r.a + ' ' + (r.k || '-') + ': ' + res.slice(0, 40);
        byError[key] = (byError[key] || 0) + n;
      }
    }
    const attempts = ok + err + captcha + timeout;
    const topSkips = Object.entries(bySkip).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const topErrors = Object.entries(byError).sort((a, b) => b[1] - a[1]).slice(0, 6);
    return {
      windowMs: windowMs || 86400000,
      total, ok, err, captcha, skip, timeout, dry, attempts,
      successPct: attempts ? Math.round(ok / attempts * 100) : null,
      byFeature, topSkips, topErrors,
    };
  }

  function jrnCountOk(feature, actionRe, windowMs) {
    const since = Date.now() - (windowMs || 86400000);
    let n = 0;
    for (const r of (state.decisions || [])) {
      if (r.ts < since || r.f !== feature || r.r !== 'ok') continue;
      if (actionRe && !actionRe.test(r.a || '')) continue;
      n += r.n || 1;
    }
    return n;
  }

  gbListen(window, 'pagehide', jrnFlush);
  gbListen(document, 'visibilitychange', () => { if (document.hidden) jrnFlush(); });

  const seenThisRun = new Set();
  const seenHost = location.hostname;
  function seenKey(id) { return seenHost + ':' + id; }

  function hookFetch() {
    const uw = unsafeWindow;
    if (!uw.fetch) return;
    if (!gbHookOrig.fetch) gbHookOrig.fetch = uw.fetch.bind(uw);
    const orig = gbHookOrig.fetch;
    if (uw.fetch._grepbot) {

    }
    uw.fetch = function patched(...args) {
      const [url, opts] = args;
      const u = String(url || '');
      const reportCtrl = /\/game\/report(?:\?|$)/.test(u) || /[?&]controller=report(?:&|$)/.test(u);
      const m = u.match(/[?&]action=(report|reports|combat_reports|tombstone|attack_planner)(?:&|$)/)
        || (reportCtrl && u.match(/[?&]action=(view|index|delete)(?:&|$)/));
      const idMatch = u.match(/[?&](?:id|report_id)=(\d+)/);
      if ((m || reportCtrl) && idMatch) queueReport(idMatch[1], u);
      else if (m || reportCtrl) queueReportList(u);
      learnCollectAction(u);
      learnFarmAction(u);
      try { ptLearnFromXhr(u, opts && opts.body); } catch (_) {}
      return orig.apply(uw, args);
    };
    uw.fetch._grepbot = true;
  }

  function hookXhr() {
    const uw = unsafeWindow;
    if (!uw.XMLHttpRequest) return;
    const P = uw.XMLHttpRequest.prototype;
    if (!gbHookOrig.xhrOpen) gbHookOrig.xhrOpen = P.open;
    if (!gbHookOrig.xhrSend) gbHookOrig.xhrSend = P.send;
    const origOpen = gbHookOrig.xhrOpen;
    const origSend = gbHookOrig.xhrSend;
    P.open = function (method, url) {
      this._grepbot_url = url;
      return origOpen.apply(this, arguments);
    };
    P.send = function () {
      const u = String(this._grepbot_url || '');
      const reportCtrl = /\/game\/report(?:\?|$)/.test(u) || /[?&]controller=report(?:&|$)/.test(u);
      const idMatch = u.match(/[?&](?:id|report_id)=(\d+)/);
      const actionReport = /[?&]action=(report|reports|combat_reports|tombstone|attack_planner)(?:&|$)/.test(u);
      if ((actionReport || reportCtrl) && idMatch) {
        queueReport(idMatch[1], u);
      } else if (actionReport || /[?&]action=(reports|combat_reports|tombstone)(?:&|$)/.test(u) || reportCtrl) {
        queueReportList(u);
      }
      learnCollectAction(u);
      learnFarmAction(u);
      sniffBridgeBody(u, arguments[0]);
      try { ptLearnFromXhr(u, arguments[0]); } catch (_) {}

      try {
        const settle = gbAjaxClaim(u, arguments[0]);
        if (settle) {
          this.addEventListener('loadend', () => {
            let raw = null;
            try { raw = tryParseJson(this.responseText || ''); } catch (_) {}
            try { settle(this.status, raw); } catch (_) {}
          });
        }
      } catch (_) {}
      this.addEventListener('load', () => {
        try {
          const txt = this.responseText || '';
          const reportish = /(?:^|\/)report(?:s)?(?:\?|$)|[?&](?:controller|action)=(report|reports|combat_reports|tombstone|attack_planner)/.test(u)
            || /\/game\/report/.test(u);
          if (txt.length > 100000 && !reportish) {

            const re = /"report_id"\s*:\s*(\d+)/g;
            let m; let n = 0;
            while ((m = re.exec(txt)) && n < 50) { queueReport(m[1], u); n++; }
            return;
          }
          const data = tryParseJson(txt);
          if (!data) return;
          scanResponseForReports(data, u, reportish);
          if (/island_quest|progressable|quest/i.test(u) || /IslandQuest|Progressable|claimReward/i.test(String(this._grepbot_url || '') + txt.slice(0, 500))) {
            learnQuestRewardsFromPayload(data);
          }
        } catch (_) {}
      });
      return origSend.apply(this, arguments);
    };
    P._grepbot_open = true;
  }

  function tryParseJson(txt) {
    if (!txt || typeof txt !== 'string') return null;
    const s = txt.replace(/^\uFEFF/, '').trim();
    if (!s || (s[0] !== '{' && s[0] !== '[' && s[0] !== '"')) return null;
    try { return JSON.parse(s); } catch (_) { return null; }
  }
  function scanResponseForReports(data, srcUrl, reportish) {
    if (!data || typeof data !== 'object') return;

    const collect = (obj, underReports) => {
      if (!obj) return;
      if (Array.isArray(obj)) { obj.forEach(x => collect(x, underReports)); return; }
      if (typeof obj !== 'object') return;
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (k === 'report_id' && (typeof v === 'number' || /^\d+$/.test(v))) {
          queueReport(String(v), srcUrl);
        } else if (k === 'id' && (typeof v === 'number' || /^\d+$/.test(v)) && (underReports || reportish)) {
          queueReport(String(v), srcUrl);
        } else if (k === 'reports' && Array.isArray(v)) {
          v.forEach(r => r && (r.id != null || r.report_id != null) && queueReport(String(r.report_id || r.id), srcUrl));
        } else {
          collect(v, underReports || k === 'reports' || k === 'report');
        }
      }
    };
    collect(data, false);
  }

  const reportRetry = Object.create(null);
  const REPORT_RETRY_MAX = 3;
  function scrapeInboxDom() {
    document.querySelectorAll('a[href*="action=report"][href*="id="]').forEach(a => {
      const m = a.href.match(/id=(\d+)/);
      if (m) queueReport(m[1], a.href);
    });
  }
  function queueReport(id, hintUrl) {
    if (!id) return;
    if (!hostEnabled() || automationPaused({}) || captchaPaused('report')) return;
    const k = seenKey(id);
    if (seenThisRun.has(k) || state.seen[k] || state.seen[id]) return;
    if (seenThisRun.size > 5000) seenThisRun.clear();
    seenThisRun.add(k);
    gbTimeout(() => fetchReport(id, hintUrl), 200 + Math.random() * 800);
  }
  function queueReportList() {

    gbTimeout(scrapeInboxDom, 1500);
  }

  function ingestReport(id, data) {
    const parsed = parseReport(id, data);
    if (!parsed) {
      seenThisRun.delete(seenKey(id));
      return false;
    }
    rememberSeen(id);
    delete reportRetry[id];
    save(STORE.SEEN, state.seen);
    if (parsed.ts && (!state.lastSeenTs || parsed.ts > state.lastSeenTs)) {
      state.lastSeenTs = parsed.ts;
      save(STORE.LAST_SEEN_TS, state.lastSeenTs);
    }
    state.findings.unshift(parsed);
    if (state.findings.length > 500) {

      state.findings.splice(500);
    }
    save(STORE.FINDINGS, state.findings);
    renderFindings();
    return true;
  }
  function reportFetchFail(id, why) {
    gbLogT('report-fail-' + id, 30000, 'report fetch fail', id, why || '');
    const n = (reportRetry[id] || 0) + 1;
    reportRetry[id] = n;
    if (n < REPORT_RETRY_MAX) seenThisRun.delete(seenKey(id));
    else gbLogT('report-retry-cap', 60000, 'report retry capped for', id);
  }

  function fetchReport(id, hintUrl) {
    if (state.seen[seenKey(id)] || state.seen[id]) return;
    if (!hostEnabled() || automationPaused({}) || captchaPaused('report')) {
      seenThisRun.delete(seenKey(id));
      return;
    }
    const params = { id: +id };
    if (hintUrl) {
      try {
        const hp = new URL(hintUrl, location.origin).searchParams;
        if (hp.has('town_id')) params.town_id = +hp.get('town_id');
      } catch (_) {}
    }
    const uw = gameUw();
    if (uw.gpAjax && uw.gpAjax.ajaxPost) {
      gameAjaxPost('report', 'report', 'view', params, (err, data) => {
        if (err === 'captcha' || err === 'captcha-pause') {
          reportFetchFail(id, 'captcha');
          return;
        }
        if (err === 'disabled' || err === 'paused' || err === 'budget' || err === 'dryrun' || err === 'remembered') {
          seenThisRun.delete(seenKey(id));
          return;
        }
        if (err) { reportFetchFail(id, err); return; }
        if (!data) { reportFetchFail(id, 'empty'); return; }
        if (!ingestReport(id, data)) reportFetchFail(id, 'unparsed');
      });
      return;
    }
    fetchReportHttp(id, hintUrl);
  }
  function fetchReportHttp(id, hintUrl) {
    if (!hostEnabled() || automationPaused({}) || captchaPaused('report')) {
      seenThisRun.delete(seenKey(id));
      return;
    }
    if (!reqBudgetOk()) {
      seenThisRun.delete(seenKey(id));
      gbLogT('report-budget', 30000, 'report: request budget exceeded');
      return;
    }
    reqBudgetMark();
    const u = buildReportUrl(id, hintUrl);
    const bodyObj = { id: +id };
    try {
      const hp = new URL(u, location.origin).searchParams;
      if (hp.has('town_id')) bodyObj.town_id = +hp.get('town_id');
    } catch (_) {}
    gbXhr({
      method: 'POST',
      url: u,
      data: 'json=' + encodeURIComponent(JSON.stringify(bodyObj)),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/plain, */*',
      },
      anonymous: false,
      onload(res) {
        try {
          if (res.status && res.status >= 400) {
            reportFetchFail(id, 'HTTP ' + res.status);
            return;
          }
          const data = tryParseJson(res.responseText);
          if (!data) {
            const snip = String(res.responseText || '').slice(0, 40).replace(/\s+/g, ' ');
            reportFetchFail(id, 'non-json: ' + snip);
            return;
          }
          if (responseIsCaptcha(data)) {
            captchaTrip('report', JSON.stringify(data).slice(0, 120));
            reportFetchFail(id, 'captcha');
            return;
          }
          if (!ingestReport(id, data)) reportFetchFail(id, 'unparsed');
        } catch (e) {
          reportFetchFail(id, String(e));
        }
      },
      onerror(e) {
        reportFetchFail(id, e && e.error || 'network');
      },
    });
  }

  function buildReportUrl(id, hintUrl) {

    const params = new URLSearchParams();
    params.set('action', 'view');
    params.set('id', id);
    const uw = gameUw();
    let townId = null;
    if (hintUrl) {
      try {
        const hp = new URL(hintUrl, location.origin).searchParams;
        ['town_id', 'attack_type', 'type'].forEach(k => { if (hp.has(k)) params.set(k, hp.get(k)); });
        if (hp.has('town_id')) townId = hp.get('town_id');
      } catch (_) {}
    }
    if (!params.has('town_id')) {
      try { townId = townId || (uw.Game && uw.Game.townId); } catch (_) {}
      if (townId != null) params.set('town_id', String(townId));
    }
    const csrf = state.csrf || (uw.Game && (uw.Game.csrfToken || uw.Game.h));
    if (csrf) params.set('h', csrf);
    return '/game/report?' + params.toString();
  }

  let reportCatchUpRunning = false;
  function reportCatchUpEnqueue() {
    if (!hostEnabled() || reportCatchUpRunning) return;
    if (typeof gbWake === 'function') {
      gbWake('reportCatchUp', () => reportCatchUpRun(), { priority: 80 });
    } else {
      reportCatchUpRun();
    }
  }
  function reportCatchUpRun() {
    if (!hostEnabled() || reportCatchUpRunning || automationPaused({}) || captchaPaused('report')) return;
    reportCatchUpRunning = true;
    const maxN = 25;
    const maxAgeMs = 72 * 3600000;
    const cut = Date.now() - maxAgeMs;
    const ids = [];
    try {
      document.querySelectorAll('a[href*="report"], a[href*="Report"]').forEach(a => {
        const m = /[?&]id=(\d+)/.exec(a.href || '') || /report\/(\d+)/.exec(a.href || '');
        if (!m) return;
        const id = m[1];
        if (state.seen[seenKey(id)] || state.seen[id] || seenThisRun.has(seenKey(id))) return;
        ids.push(id);
      });
    } catch (_) {}
    const batch = ids.slice(0, maxN);
    if (!batch.length) {
      reportCatchUpRunning = false;
      gbLogT('catchup-empty', 120000, 'report catch-up: nothing new in inbox DOM');
      return;
    }
    gbLog(`report catch-up: fetching up to ${batch.length} (cap ${maxN}, age≤72h, lastSeen=${state.lastSeenTs || 0})`);
    let i = 0, fetched = 0;
    (function step() {
      if (i >= batch.length) {
        reportCatchUpRunning = false;
        gbLog(`report catch-up done: ${fetched}/${batch.length}`);
        return;
      }
      if (!hostEnabled() || automationPaused({}) || captchaPaused('report') || !reqBudgetOk()) {
        reportCatchUpRunning = false;
        gbLog(`report catch-up paused mid-run at ${i}/${batch.length}`);
        return;
      }
      const id = batch[i++];

      if (state.lastSeenTs && state.lastSeenTs < cut) {

      }
      fetchReport(id);
      fetched++;
      gbTimeout(step, 700 + Math.random() * 300);
    })();
  }

  function nameOf(p) {
    if (p == null) return null;
    if (typeof p === 'string') {
      const s = p.trim();
      return s ? { id: null, name: s } : null;
    }
    if (typeof p !== 'object') return null;
    return { id: p.id ?? p.player_id ?? null, name: p.name || p.player_name || null };
  }

  function extractUnits(r) {
    const u = {};
    const src = r.units || r.attacker_units || {};
    Object.keys(src).forEach(k => { const v = src[k]; if (typeof v === 'number' && v > 0) u[k] = v; });
    return Object.keys(u).length ? u : null;
  }

  function extractResources(r) {
    const src = r.resources || r.loot || {};
    return {
      wood: src.wood ?? null, stone: src.stone ?? null, iron: src.iron ?? null,
      gold: src.gold ?? null, supply: src.supply ?? null,
    };
  }

  function parseReport(id, data) {
    if (data == null) return null;
    let root = data;

    for (let depth = 0; depth < 3 && root && typeof root === 'object' && root.json != null; depth++) {
      let inner = root.json;
      if (typeof inner === 'string') {
        try { inner = JSON.parse(inner); } catch (_) { break; }
      }
      if (!inner || typeof inner !== 'object') break;
      root = inner;
    }
    if (typeof root === 'string') {
      try { root = JSON.parse(root); } catch (_) { return null; }
    }
    if (!root || typeof root !== 'object') return null;
    const r = root.report || root;
    if (!r || typeof r !== 'object') return null;
    const type = r.type || r.report_type || null;

    if (!type && r.attacker == null && r.defender == null && !r.units && !r.attacker_units && r.outcome == null && r.win == null) {
      return null;
    }
    const now = Date.now();
    const serverTs = (() => {
      const keys = ['time', 'timestamp', 'created_at', 'reported_at', 'date', 'started_at', 'ended_at'];
      for (const k of keys) {
        const c = r[k];
        if (c == null || c === '') continue;
        if (typeof c === 'number' || (/^\d+(\.\d+)?$/.test(String(c)))) {
          let n = +c;
          if (!Number.isFinite(n) || n <= 0) continue;
          if (n < 1e12) n *= 1000;
          return Math.floor(n);
        }
        const parsed = Date.parse(c);
        if (!Number.isNaN(parsed)) return parsed;
      }
      return null;
    })();
    return {
      id, ts: serverTs != null ? serverTs : now,
      type: type || 'unknown',
      attacker: nameOf(r.attacker),
      defender: nameOf(r.defender),
      town: {
        id: r.defender?.town_id || r.town_id || null,
        name: r.defender?.town_name || r.town_name || null,
        x: r.defender?.x ?? r.x ?? null,
        y: r.defender?.y ?? r.y ?? null,
      },
      units: extractUnits(r),
      resources: extractResources(r),
      loot: r.resources || null,
      outcome: r.outcome ?? r.win ?? null,

    };
  }

  function parseFarms(text) {
    return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const parts = line.split('|').map(s => s.trim());
      let id = parts[0] && /^\d+$/.test(parts[0]) ? parts[0] : null;
      if (!id) {

        const m = line.match(/^(\d{4,})\s+/);
        if (m) id = m[1];
      }
      if (!id) return null;
      const out = { vill_id: id, x: null, y: null, eta: null, notes: null };

      const afterId = (line.startsWith(id) ? line.slice(id.length) : line).trimStart();
      const coordMatch = afterId.match(/^\|?\s*(-?\d{1,4})[,\s]+(-?\d{1,4})/);
      if (coordMatch) { out.x = +coordMatch[1]; out.y = +coordMatch[2]; }
      for (const p of parts) {
        if (/^\d+[hm]$/i.test(p) || /^\d{1,2}:\d{2}$/.test(p)) { out.eta = p; break; }
      }
      const skip = new Set([out.eta, out.x != null ? `${out.x} ${out.y}` : null, `${out.x},${out.y}`, id]);
      out.notes = parts.slice(1).filter(p => p && !skip.has(p)).join(' | ') || null;
      return out;
    }).filter(Boolean);
  }

  function parseBodyLoose(s) {
    let j = null;
    try { j = JSON.parse(s); } catch (_) {}
    if (!j) {
      try {
        const p = new URLSearchParams(s);
        j = {};
        for (const [k, v] of p) { try { j[k] = JSON.parse(v); } catch (_) { j[k] = v; } }
      } catch (_) { return null; }
    }

    let cur = j;
    for (let depth = 0; depth < 3 && cur && cur.json; depth++) {
      let inner = cur.json;
      if (typeof inner === 'string') {
        try { inner = JSON.parse(inner); } catch (_) { break; }
      }
      if (!inner || typeof inner !== 'object') break;
      if (inner.model_url || inner.action_name || inner.arguments) return inner;
      cur = inner;
    }
    return j;
  }

  function parseResourceJson(data) {
    const json = (data && data.json) ? (typeof data.json === 'string' ? (() => { try { return JSON.parse(data.json); } catch (_) { return data; } })() : data.json) : data;

    const r = (json && (json.town || json.town_info || json)) || {};
    let res_ = r.resources || r.resource || (json && json.resources) || {};
    if (res_ && typeof res_ === 'object' && res_.resources && typeof res_.resources === 'object') {
      res_ = res_.resources;
    }
    const pop = r.population || r.pop || {};
    const wood = pickNum(res_.wood, r.wood, json && json.wood);
    const stone = pickNum(res_.stone, r.stone, json && json.stone);
    const iron = pickNum(res_.iron, r.iron, json && json.iron);
    return {
      wood, stone, iron,
      pop: pop.current ?? pop.pop ?? null,
      cap: pop.max ?? pop.cap ?? null,
      name: r.name || r.town_name || null,
      got: wood != null || stone != null || iron != null || !!(r.name || r.town_name),
    };
  }
  function sniffBridgeBody(u, body) {
    try {
      if (!body || typeof body !== 'string' || !/frontend_bridge/.test(String(u))) return;
      if (/FarmTownPlayerRelation/.test(body)) {
        gbLog('sniffed farm bridge call:', body.slice(0, 300));
        const j = parseBodyLoose(body);
        if (j && j.model_url && /claim/i.test(j.action_name || '')) {
          state.claimTpl = {
            model_url: j.model_url, action_name: j.action_name,
            arguments: j.arguments || {}, town_id: j.town_id,
            version: 1, learned_at: Date.now(),
          };
          save(wkey(STORE.CLAIM_TPL), state.claimTpl);
          gbLog('learned claim template:', JSON.stringify(state.claimTpl).slice(0, 200));
          try { tplHealthMarkLearned('claimTpl'); } catch (_) {}

          if (!isSelfBridge(j)) farmLearnOptionFromClaim(j);
        }
      } else if (/PlayerAttackSpot/.test(body)) {
        gbLog('sniffed bandit bridge call:', body.slice(0, 300));
      } else if (/BuildingOrder/.test(body) && /Instant|instant/i.test(body)) {
        const j = parseBodyLoose(body);

        if (j && !isSelfBridge(j) && j.action_name && /instant/i.test(j.action_name)) {
          if (/buyInstant|buy_instant/i.test(j.action_name)) {
            gbLogT('ib-sniff-refuse', 60000, 'instant: sniffed buyInstant - not saved as free-complete action');
          } else if (typeof ibLearnAction === 'function') {
            ibLearnAction('build', j.action_name);
            gbLog('learned instant-build action:', j.action_name);
          } else {
            state.ibAction = j.action_name;
            save(wkey(STORE.IB_ACTION), state.ibAction);
            gbLog('learned instant-build action:', state.ibAction);
          }
        }
      } else if (/ResearchOrder/.test(body) && /Instant|instant/i.test(body)) {
        const j = parseBodyLoose(body);
        if (j && !isSelfBridge(j) && j.action_name && /instant/i.test(j.action_name)) {
          if (/buyInstant|buy_instant/i.test(j.action_name)) {
            gbLogT('ib-sniff-refuse', 60000, 'instant-research: sniffed buyInstant - not saved');
          } else if (typeof ibLearnAction === 'function') {
            ibLearnAction('research', j.action_name);
            gbLog('learned instant-research action:', j.action_name);
          } else {
            state.ibActionR = j.action_name;
            save(wkey(STORE.IB_ACTION_R), state.ibActionR);
            gbLog('learned instant-research action:', state.ibActionR);
          }
        }
      } else if (/model_url.*Town\//i.test(body) || (/Town/.test(body) && /attack|sendUnits/i.test(body))) {
        const j = parseBodyLoose(body);
        if (j && j.model_url && /attack|sendUnits/i.test(j.action_name || '')) {
          state.attackTpl = {
            model_url: j.model_url, action_name: j.action_name,
            arguments: j.arguments || {}, town_id: j.town_id,
            version: 1, learned_at: Date.now(),
          };
          save(wkey(STORE.ATTACK_TPL), state.attackTpl);
          gbLog('learned attack template:', JSON.stringify(state.attackTpl).slice(0, 200));
          try { tplHealthMarkLearned('attackTpl'); } catch (_) {}
          const destId = j.arguments && j.arguments.id;
          if (destId != null && typeof attackRememberTarget === 'function') {
            attackRememberTarget(destId, { src: 'learned' });
          }
        }
      } else if (/Command/.test(body) && /cancelCommand/i.test(body)) {
        const j = parseBodyLoose(body);
        if (j && j.action_name && /cancelCommand/i.test(j.action_name) && !isSelfBridge(j)) {
          state.cancelTpl = {
            model_url: j.model_url || 'Command',
            action_name: j.action_name,
            arguments: j.arguments || {},
            town_id: j.town_id,
            version: 1, learned_at: Date.now(),
          };
          save(wkey(STORE.CANCEL_TPL), state.cancelTpl);
          gbLog('learned cancel template:', JSON.stringify(state.cancelTpl).slice(0, 200));
        }
      } else if (/Wonder|wonder/i.test(body) && /cast|devote|contribute|favor/i.test(body) && /power|cast/i.test(body)) {
        const j = parseBodyLoose(body);
        if (j && j.action_name && !isSelfBridge(j)) {
          state.wonderFavorTpl = {
            model_url: j.model_url, action_name: j.action_name,
            arguments: j.arguments || {}, town_id: j.town_id,
            version: 1, learned_at: Date.now(),
          };
          save(wkey(STORE.WONDER_FAVOR_TPL), state.wonderFavorTpl);
          gbLog('learned wonder favor template:', j.action_name);
        }
      } else if (/PlayerHero/.test(body) && /assignToTown|unassignFromTown|cancelTownTravel/i.test(body)) {
        const j = parseBodyLoose(body);
        if (j && j.action_name && !isSelfBridge(j)) {
          if (!state.heroTpl || typeof state.heroTpl !== 'object') state.heroTpl = {};
          state.heroTpl[j.action_name] = {
            model_url: j.model_url || 'PlayerHero',
            action_name: j.action_name,
            arguments: j.arguments || {},
            town_id: j.town_id,
            version: 1, learned_at: Date.now(),
          };
          save(wkey(STORE.HERO_TPL), state.heroTpl);
          gbLog('learned hero template:', j.action_name, JSON.stringify(state.heroTpl[j.action_name]).slice(0, 160));
        }
      } else if (/IslandQuest|Progressable|claimReward|island_quest/i.test(body)) {
        const j = parseBodyLoose(body);
        if (j && !isSelfBridge(j)) {
          gbLogT('quest-sniff', 30000, 'sniffed quest bridge:', body.slice(0, 200));
          learnQuestRewardsFromPayload(j, j.progressable_id || (j.arguments && j.arguments.progressable_id));
        }
      }
    } catch (_) {}
  }

  let farmRelLogged = false;
  function farmRelationCol() {
    return mmCol('FarmTownPlayerRelation');
  }
  function farmRelationModel(farmOrRelId) {
    const relCol = farmRelationCol();
    if (!relCol) return null;
    const id = (farmOrRelId && typeof farmOrRelId === 'object') ? farmOrRelId.relation_id : farmOrRelId;
    if (id == null) return null;
    try {
      if (relCol.get) {
        const m = relCol.get(id);
        if (m) return m;
      }
    } catch (_) {}
    return relCol.models.find(r => (r.id ?? (r.attributes || {}).id) == id) || null;
  }

  function farmBelongsToPlayer(r, attrs) {
    try {
      if (typeof r.belongsToPlayer === 'function') return !!r.belongsToPlayer();
    } catch (_) {}
    const s = attrs.relation_status;
    return s != null && s > 0;
  }

  function farmIsLootable(r, attrs) {
    try {
      if (typeof r.isLootable === 'function') return !!r.isLootable();
    } catch (_) {}
    const at = attrs && attrs.lootable_at;
    if (at == null) return true;
    return gameNow() >= at;
  }
  function farmsFromGame() {
    try {
      const uw = uwCached();
      if (!uw.MM) return null;
      const relCol = farmRelationCol();
      const farmCol = mmCol('FarmTown');
      if (!relCol) return null;
      const farmById = {};
      ((farmCol && farmCol.models) || []).forEach(m => { const a = m.attributes || {}; farmById[a.id] = a; });
      const out = [];
      const statusCount = {};
      let noRelId = 0;
      relCol.models.forEach(r => {
        const a = r.attributes || {};
        statusCount[a.relation_status] = (statusCount[a.relation_status] || 0) + 1;
        if (!farmBelongsToPlayer(r, a)) return;
        const relId = r.id ?? a.id;
        if (relId == null) { noRelId++; return; }
        const f = farmById[a.farm_town_id] || {};
        out.push({
          vill_id: String(a.farm_town_id),
          relation_id: relId,
          x: f.island_x ?? null,
          y: f.island_y ?? null,
          lootable_at: a.lootable_at ?? null,
          name: f.name || null,
          fromGame: true,
          _rel: r,
          _attrs: a,
        });
      });
      if (!farmRelLogged) {
        farmRelLogged = true;
        gbLog(`farm relations: ${relCol.models.length} total, statuses ${JSON.stringify(statusCount)}, controlled ${out.length}${noRelId ? `, ${noRelId} missing relation id` : ''}`);
      }
      return out;
    } catch (e) { gbLogT('farmsFromGame', 60000, 'farmsFromGame fail', String(e)); return null; }
  }
  function mergedFarms() {
    const game = farmsFromGame() || [];
    const manual = parseFarms(state.farms);
    const seen = new Set(game.map(f => f.vill_id));
    return game.concat(manual.filter(f => !seen.has(f.vill_id)));
  }
  let farmsParsedSig = null;
  function refreshFarmsParsed() {
    state.farmsParsed = mergedFarms();

    const sig = JSON.stringify(state.farmsParsed);
    if (sig === farmsParsedSig) return;
    farmsParsedSig = sig;
    save(STORE.FARMS_PARSED, state.farmsParsed);

    const ids = state.farmsParsed.map(f => f.vill_id);
    if (pruneMapsToIds(state.farmResources, ids)) save(STORE.FARM_RES, state.farmResources);
    if (pruneMapsToIds(state.alerted, ids)) save(STORE.ALERTED, state.alerted);
    if (pruneMapsToIds(state.thresholds, ids)) save(STORE.THRESH, state.thresholds);
  }

  function islandTownMap() {
    const map = Object.create(null);
    const uw = uwCached();
    try {
      const towns = uw.ITowns && uw.ITowns.towns;
      if (!towns) return map;
      for (const tid of Object.keys(towns)) {
        const t = towns[tid];
        let x = null, y = null;
        try {
          if (t.getIslandCoordinateX) x = t.getIslandCoordinateX();
          if (t.getIslandCoordinateY) y = t.getIslandCoordinateY();
        } catch (_) {}
        if (x == null || y == null) continue;
        const key = x + ',' + y;
        if (map[key] == null) map[key] = tid;
      }
    } catch (_) {}
    return map;
  }
  function townIdForFarm(farm, islandMap) {

    if (farm.x == null || farm.y == null) return null;
    const map = islandMap || islandTownMap();
    const hit = map[farm.x + ',' + farm.y];
    return hit != null ? hit : null;
  }

  function townWarehouseState(townId) { return townResState(townId); }
  function townWarehouseBlocks(townId) {
    if (!state.farmSkipFull) return false;
    if (townId == null || townId === '') return false;
    const st = townWarehouseState(townId);
    if (!st) {
      gbLogT('wh-unknown-' + townId, 120000, `warehouse: could not read cap for town ${townId} (gate skipped)`);
      return false;
    }
    return state.farmFullMode === 'all' ? st.n >= 3 : st.n >= 1;
  }
  function currentTownWarehouseBlocks() {
    try {
      const uw = gameUw();
      const tid = uw.Game && uw.Game.townId;
      return tid != null && townWarehouseBlocks(tid);
    } catch (_) { return false; }
  }

  const FARM_DURATIONS = [300, 600, 1200, 2400, 5400, 10800, 14400, 28800];
  function farmDurLabel(sec) {
    if (sec >= 3600) return (sec / 3600) + 'h';
    return Math.round(sec / 60) + 'min';
  }
  function farmOptionFor(sec) {
    const m = state.farmOptionMap || {};
    const v = m[String(sec)];
    return v == null ? null : +v;
  }
  function farmOptionMapText() {
    const m = state.farmOptionMap || {};
    const parts = FARM_DURATIONS.filter(s => m[String(s)] != null).map(s => `${farmDurLabel(s)}=${m[String(s)]}`);
    return parts.length ? parts.join(' ') : 'none';
  }
  function farmSnapDuration(sec) {
    let best = null, bestDiff = Infinity;
    FARM_DURATIONS.forEach(d => {
      const diff = Math.abs(d - sec);
      if (diff < bestDiff) { best = d; bestDiff = diff; }
    });

    return best != null && bestDiff <= best * 0.2 ? best : null;
  }

  function farmLearnOptionFromClaim(j) {
    try {
      const a = (j && j.arguments) || {};
      const opt = +a.option;
      const vid = a.farm_town_id;
      if (!(opt > 0) || vid == null) return;
      gbTimeout(() => {
        const farms = farmsFromGame() || [];
        const f = farms.find(x => String(x.vill_id) === String(vid));
        if (!f || f.lootable_at == null) return;
        const sec = farmSnapDuration(f.lootable_at - gameNow());
        if (sec == null) return;
        const map = Object.assign({}, state.farmOptionMap || {});
        if (+map[String(sec)] === opt) return;
        map[String(sec)] = opt;
        state.farmOptionMap = map;
        save(wkey(STORE.FARM_OPTION_MAP), map);
        gbLog(`farm: learned claim option ${opt} = ${farmDurLabel(sec)} (map: ${farmOptionMapText()})`);
        if (sec === 600 && state.farmTeachBanner) farmSetTeachBanner('');
      }, 4000);
    } catch (_) {}
  }

  const FARM_LOYALTY_IDS = ['rural_loyalty', 'loyalty', 'villagers_loyalty'];
  const FARM_LOYALTY_RE = /loyal|lealtad|leal(?:tad)?|treue|fidel|aldean|villager|rural_loyalty/i;
  const farmLoyaltyCache = Object.create(null);
  function farmLoyaltyReset() {
    Object.keys(farmLoyaltyCache).forEach(k => { delete farmLoyaltyCache[k]; });
  }

  function farmLoyaltyPinHit(techs, pin) {
    const want = pin.toLowerCase();
    const keys = Object.keys(techs).filter(k => techs[k]);
    return keys.some(k => k.toLowerCase() === want || researchLabel(k).toLowerCase() === want);
  }
  function farmLoyaltyResearched(townId) {
    const now = Date.now();
    const c = farmLoyaltyCache[townId];
    if (c && now - c.ts < 60000) return c.val;
    let val = false;
    try {
      const info = researchTownTechs(townId);
      const techs = (info && info.techs) || null;
      if (techs) {
        const pin = String(state.farmLoyaltyTech || '').trim();
        if (pin) val = farmLoyaltyPinHit(techs, pin);
        else {
          const done = Object.keys(techs).filter(k => techs[k]);
          const hit = FARM_LOYALTY_IDS.find(id => done.indexOf(id) >= 0) ||
            done.find(k => FARM_LOYALTY_RE.test(k) || FARM_LOYALTY_RE.test(researchLabel(k)));
          if (hit) {
            state.farmLoyaltyTech = hit;
            save(wkey(STORE.FARM_LOYALTY_TECH), hit);
            gbLog(`farm: loyalty tech detected: ${hit}${researchLabel(hit) ? ' (' + researchLabel(hit) + ')' : ''}`);
            val = true;
          } else {

            gbLogT('farm-loyalty-miss', 900000, 'farm: loyalty tech not found; researched = ' +
              done.map(k => k + (researchLabel(k) ? '(' + researchLabel(k) + ')' : '')).join(',').slice(0, 600));
          }
        }
      }
    } catch (_) {}
    farmLoyaltyCache[townId] = { ts: now, val };
    return val;
  }
  function farmSleepDuration() {
    const want = state.farmSleepDur;
    if (!want || want === 'auto') return farmOptionFor(28800) != null ? 28800 : 14400;
    return +want;
  }

  function farmDesiredDuration(townId) {
    if (!state.farmLongClaims) return 300;
    return farmLoyaltyResearched(townId) ? 600 : 300;
  }

  function farmTryDeriveOptionMap() {
    const out = {};
    try {
      const uw = gameUw();
      const gd = uw.GameData || {};
      const candidates = [
        gd.farm_town_offers, gd.FarmTownOffers, gd.farm_town_claim_options,
        gd.farm_towns && gd.farm_towns.offers,
      ];
      for (const c of candidates) {
        if (!c) continue;
        const list = Array.isArray(c) ? c : (typeof c === 'object' ? Object.keys(c).map(k => c[k]) : null);
        if (!list || !list.length) continue;
        list.forEach((opt, i) => {
          if (opt == null) return;
          const idx = opt.option != null ? +opt.option : (opt.id != null ? +opt.id : i + 1);
          const sec = +opt.duration || +opt.time || +opt.booty_duration || +opt.collect_time;
          if (!(idx > 0) || !(sec > 0)) return;
          const snapped = farmSnapDuration(sec);
          if (snapped != null) out[String(snapped)] = idx;
        });
        if (out['600'] != null) break;
      }
    } catch (_) {}
    return out['600'] != null ? out : null;
  }
  function farmSetTeachBanner(msg) {
    state.farmTeachBanner = msg || '';
    save(STORE.FARM_TEACH_BANNER, state.farmTeachBanner);
    try { renderFarmTeachBanner(); } catch (_) {}
  }
  function renderFarmTeachBanner() {
    const el = panel && panel.querySelector('#gb-farm-teach-banner');
    if (!el) return;
    if (farmOptionFor(600) != null && state.farmTeachBanner) {
      state.farmTeachBanner = '';
      save(STORE.FARM_TEACH_BANNER, '');
    }
    const msg = state.farmTeachBanner || '';
    if (!msg) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = msg;
  }

  function farmLoyaltyAutoTeachTick() {
    if (!state.farmLongClaims) return;
    let anyLoyalty = false;
    try {
      const towns = townsFromGame() || state.towns || [];
      for (const t of towns) {
        if (farmLoyaltyResearched(t.id)) { anyLoyalty = true; break; }
      }
    } catch (_) {}
    const seen = !!state.farmLoyaltySeen;
    if (!anyLoyalty) {
      if (seen) {
        state.farmLoyaltySeen = false;
        save(STORE.FARM_LOYALTY_SEEN, false);
      }
      return;
    }
    if (farmOptionFor(600) != null) {
      if (!seen) { state.farmLoyaltySeen = true; save(STORE.FARM_LOYALTY_SEEN, true); }
      if (state.farmTeachBanner) farmSetTeachBanner('');
      return;
    }
    const flip = !seen;
    if (!flip && state.farmTeachBanner) return;
    state.farmLoyaltySeen = true;
    save(STORE.FARM_LOYALTY_SEEN, true);
    const derived = farmTryDeriveOptionMap();
    if (derived && derived['600'] != null) {

      const map = Object.assign({}, state.farmOptionMap || {}, derived);
      state.farmOptionMap = map;
      save(wkey(STORE.FARM_OPTION_MAP), map);
      gbLog(`farm: loyalty auto-teach provisional 10min option=${derived['600']} (confirm on next claim)`);
      farmSetTeachBanner('');
      return;
    }
    farmSetTeachBanner('Loyalty research done. Click one 10-minute claim by hand to teach the bot.');
    gbLog('farm: loyalty researched - 10min option unknown; hand-claim once to teach');
  }

  function claimFarm(farm, islandMap, whCache, durOverride, onDone) {
    const done = (err) => { if (onDone) onDone(err); };
    if (captchaPaused('farm')) return done('captcha');
    const tid = +townIdForFarm(farm, islandMap);
    if (!tid) {
      gbLogT('claim-no-town', 60000, `farm claim skip ${farm.vill_id}: no same-island town`);
      return done('skip');
    }
    let blocked = false;
    if (whCache) {
      if (!(tid in whCache)) whCache[tid] = townWarehouseBlocks(tid);
      blocked = whCache[tid];
    } else {
      blocked = townWarehouseBlocks(tid);
    }
    if (blocked) {
      gbLogT('claim-wh-block', 30000, `farm claim blocked (warehouse full) town ${tid} vill ${farm.vill_id}`);
      return done('skip');
    }
    const tplArgs = (state.claimTpl && state.claimTpl.arguments) || {};
    const wantSec = durOverride || farmDesiredDuration(tid);
    let option = farmOptionFor(wantSec);
    if (option == null) {
      gbLogT('farm-opt-' + wantSec, 900000,
        `farm claim: option index for ${farmDurLabel(wantSec)} unknown - claim that timer once by hand in game to teach it (using 5min)`);
      option = farmOptionFor(300) != null ? farmOptionFor(300) : 1;
    }

    const args = Object.assign({}, tplArgs, { type: 'resources', option, farm_town_id: +farm.vill_id });
    bridgePost('farm', {
      model_url: `FarmTownPlayerRelation/${farm.relation_id}`,
      action_name: (state.claimTpl && state.claimTpl.action_name) || 'claim',
      arguments: args,
      town_id: tid,
    }, (err) => done(err || null));
  }
  function autoClaimFarms(reason, durOverride, onBatchDone) {
    if (!hostEnabled() || !state.autoFarm || captchaPaused('farm') || automationPaused({})) {
      if (onBatchDone) onBatchDone({ done: 0, attempted: 0, captcha: false });
      return;
    }
    if (gbLocked('claim')) { gbLogT('claim-inflight', 30000, 'farm claim: skipped (in flight)'); return; }
    const uw = uwCached();
    if (!(uw.gpAjax && uw.gpAjax.ajaxPost)) { gbLogT('claim-noajax', 60000, 'farm claim: gpAjax not ready yet'); return; }
    const farms = farmsFromGame();
    if (!farms) { gbLogT('claim-nofarms', 60000, 'farm claim: game collections not ready'); return; }
    const now = gameNow();
    const islandMap = islandTownMap();
    const whCache = Object.create(null);
    let skippedFull = 0;
    const ready = farms.filter(f => {
      if (f._rel) {
        if (!farmIsLootable(f._rel, f._attrs || {})) return false;
      } else if (f.lootable_at != null && f.lootable_at > now) {
        return false;
      }
      const tid = townIdForFarm(f, islandMap);
      if (!tid) return false;
      if (!(tid in whCache)) whCache[tid] = townWarehouseBlocks(tid);
      if (whCache[tid]) { skippedFull++; return false; }
      return true;
    });
    if (skippedFull) {
      gbLogT('claim-wh-full', 60000, `farm claim: skipped ${skippedFull} (warehouse full, mode=${state.farmFullMode})`);
    }
    if (!ready.length) {
      const next = Math.min(...farms.map(f => f.lootable_at || Infinity));
      gbLogT('claim-none', 60000, `farm claim: 0/${farms.length} ready${skippedFull ? ` (${skippedFull} warehouse-full)` : ''}, next in ${next === Infinity ? '?' : Math.max(0, next - now) + 's'}`);
      if (onBatchDone) onBatchDone({ done: 0, attempted: 0, captcha: false });
      return;
    }
    gbLock('claim');
    gbLog(`farm claim${reason ? ' (' + reason + ')' : ''}: ${ready.length}/${farms.length} ready${skippedFull ? ` (${skippedFull} warehouse-full)` : ''}`);
    const before = {};
    farms.forEach(f => { before[f.vill_id] = f.lootable_at; });
    flash(`farm claim x${ready.length}`);
    let i = 0, done = 0, captcha = false;
    (function next() {
      if (i >= ready.length || captcha || captchaPaused('farm')) {
        gbTimeout(() => {
          try {
            const flipped = verifyClaims(before);

            if (onBatchDone) onBatchDone({
              done: flipped,
              attempted: ready.length,
              captcha,
              bridgeOk: done,
            });
          } finally { gbUnlock('claim'); }
        }, 10000);
        return;
      }
      const f = ready[i++];
      try {
        claimFarm(f, islandMap, whCache, durOverride, (err) => {
          if (err === 'captcha' || err === 'captcha-pause') captcha = true;
          else if (!err) {
            done++;
            gbLog(`  claimed ${f.name || f.vill_id} (rel ${f.relation_id})`);
          }

          gbTimeout(next, 700);
        });
      } catch (e) {
        gbLog('  claim FAIL', f.vill_id, String(e));
        gbTimeout(next, 700);
      }
    })();
  }

  function farmSleepDayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }
  function farmSleepClaimNow(reason, onDone) {
    const sec = farmSleepDuration();
    if (farmOptionFor(sec) == null) {
      gbLog(`sleep claim: ${farmDurLabel(sec)} option not learned yet - open a farming village, click that timer once by hand, then retry`);
      flash('sleep claim: teach ' + farmDurLabel(sec));
      if (onDone) onDone(null);
      return false;
    }
    if (!state.autoFarm) {
      gbLog('sleep claim: auto-farm is OFF - enable it in Config, the claim path is shared');
      flash('sleep claim: auto-farm OFF');
      if (onDone) onDone(null);
      return false;
    }
    gbLog(`sleep claim ${farmDurLabel(sec)}${reason ? ' (' + reason + ')' : ''}`);
    autoClaimFarms('sleep ' + farmDurLabel(sec), sec, onDone);
    return true;
  }
  function farmSleepAutoTick() {
    if (!state.farmSleepAuto || !state.autoFarm) return;
    if (!hostEnabled() || captchaPaused('farm') || gbLocked('claim')) return;
    const sec = farmSleepDuration();
    if (farmOptionFor(sec) == null) return;
    const day = farmSleepDayKey();
    if (state.farmSleepDay === day) return;
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    if (Date.now() + sec * 1000 >= midnight.getTime()) return;
    const farms = farmsFromGame();
    if (!farms || !farms.length) return;
    const now = gameNow();
    const ready = farms.filter(f => (f._rel ? farmIsLootable(f._rel, f._attrs || {}) : !(f.lootable_at > now)));

    if (ready.length < Math.ceil(farms.length * 0.8)) return;
    const islandMap = islandTownMap();
    const towns = new Set();
    ready.forEach(f => { const tid = townIdForFarm(f, islandMap); if (tid) towns.add(tid); });
    if (!towns.size) return;
    const limit = state.farmSleepFillPct || 60;
    for (const tid of towns) {
      const st = townWarehouseState(tid);
      if (!st || !(st.cap > 0)) return;
      const fill = Math.max(st.wood, st.stone, st.iron) / st.cap * 100;
      if (fill > limit) {
        gbLogT('sleep-fill', 600000, `sleep claim held: town ${tid} at ${Math.round(fill)}% full (limit ${limit}%)`);
        return;
      }
    }

    farmSleepClaimNow('auto', (stats) => {
      if (!stats) return;
      if (stats.done > 0 || stats.attempted === 0) {
        state.farmSleepDay = day;
        save(wkey(STORE.FARM_SLEEP_DAY), day);
      } else {
        gbLogT('sleep-day-hold', 60000, `sleep claim: day not marked (${stats.done}/${stats.attempted} ok)`);
      }
    });
  }
  function verifyClaims(before) {
    const farms = farmsFromGame();
    if (!farms) return 0;
    const now = gameNow();
    let updated = 0;
    farms.forEach(f => {
      if (f.lootable_at != null && f.lootable_at > now && before[f.vill_id] !== f.lootable_at) updated++;
    });
    gbLog(`farm claim verify: ${updated} village(s) now gathering${updated ? '' : ' - claims did NOT land (open Senado once, click Recoger manually, then paste me the Log tab)'}`);
    return updated;
  }

  const ACTION_GUESSES = ['farm_town_info', 'get_farm_towns', 'farm_town_overview'];
  const FARM_ACTION_OK = /^(farm_town_|get_farm|farm_info|island_farm)/;
  const FARM_ACTION_BAD = /farm_remove|village_attack|attack_log|farm_town_lock/;
  function farmGuesses() {
    const g = ACTION_GUESSES.slice();
    const a = state.farmAction;
    if (a) {
      const i = g.indexOf(a);
      if (i >= 0) g.splice(i, 1);
      g.unshift(a);
    }
    return g;
  }

  function learnFarmAction(u) {
    const m = String(u || '').match(/[?&]action=([a-z0-9_]+)/i);
    if (!m) return;
    const a = m[1].toLowerCase();
    if (FARM_ACTION_BAD.test(a)) return;
    if (!FARM_ACTION_OK.test(a) && !(/^farm/.test(a) && /town|info|overview/.test(a))) return;
    if (state.farmAction === a) return;
    state.farmAction = a;
    save(wkey(STORE.FARM_ACTION), a);
    gbLog('learned farm action', a);
  }
  function fetchFarmResources(entry, onDone) {
    if (captchaPaused('farm') || (captchaGlobalUntil && Date.now() < captchaGlobalUntil)) {
      if (onDone) onDone(false);
      return;
    }
    const guesses = farmGuesses();
    tryGuess(entry, 0);
    function tryGuess(entry, i) {
      if (captchaPaused('farm') || (captchaGlobalUntil && Date.now() < captchaGlobalUntil)) {
        if (onDone) onDone(false);
        return;
      }
      if (i >= guesses.length) {
        state.farmResources[entry.vill_id] = { ts: Date.now(), ok: false, err: 'no endpoint matched' };
        save(STORE.FARM_RES, state.farmResources);
        renderFarms();
        if (onDone) onDone(false);
        return;
      }
      const action = guesses[i];
      const params = new URLSearchParams();
      params.set('action', action);
      params.set('town_id', entry.vill_id);
      if (state.csrf) params.set('h', state.csrf);
      const u = '/index.php?' + params.toString();
      gbXhr({
        method: 'GET', url: u,
        anonymous: false,
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json, text/plain, */*' },
        onload(res) {
          const retryMs = httpRetryAfterMs(res);
          if (retryMs) {
            state.farmResources[entry.vill_id] = { ts: Date.now(), ok: false, err: 'HTTP ' + res.status };
            save(STORE.FARM_RES, state.farmResources);
            gbLogT('farm-http-' + res.status, 30000, `farm ${entry.vill_id}: HTTP ${res.status}, retry in ${retryMs}ms`);
            gbTimeout(() => tryGuess(entry, i), retryMs);
            return;
          }
          if (res.status && res.status >= 400) {
            return tryGuess(entry, i + 1);
          }
          const body = (res.responseText || '').slice(0, 500);

          const looksLikeJson = res.responseText && (res.responseText[0] === '{' || res.responseText[0] === '[');
          if (!looksLikeJson || /<html/i.test(body)) {

            return tryGuess(entry, i + 1);
          }
          try {
            const p = parseResourceJson(JSON.parse(res.responseText));

            if (!p.got) {

              if (i + 1 < guesses.length) return tryGuess(entry, i + 1);
              state.farmResources[entry.vill_id] = { ts: Date.now(), ok: false, err: 'no resource fields' };
              save(STORE.FARM_RES, state.farmResources);
              renderFarms();
              if (onDone) onDone(false);
              return;
            }
            if (state.farmAction !== action) {
              state.farmAction = action;
              save(wkey(STORE.FARM_ACTION), action);
              gbLog('farm endpoint =', action);
            }
            state.farmResources[entry.vill_id] = {
              ts: Date.now(),
              wood: p.wood, stone: p.stone, iron: p.iron,
              pop: p.pop, cap: p.cap, name: p.name,
              ok: true,
              action,
            };
          } catch (e) {
            if (i + 1 < guesses.length) return tryGuess(entry, i + 1);
            state.farmResources[entry.vill_id] = { ts: Date.now(), ok: false, err: String(e).slice(0, 100) };
          }
          save(STORE.FARM_RES, state.farmResources);

          renderFarms();
          checkThresholds();
          if (onDone) onDone(!!state.farmResources[entry.vill_id].ok);
        },
        onerror() {
          if (i + 1 < guesses.length) return tryGuess(entry, i + 1);
          state.farmResources[entry.vill_id] = { ts: Date.now(), ok: false, err: 'network' };
          save(STORE.FARM_RES, state.farmResources);
          renderFarms();
          if (onDone) onDone(false);
        },
      });
    }
  }
  function pickNum(...candidates) {
    for (const c of candidates) {
      if (typeof c === 'number' && Number.isFinite(c)) return c;
      if (typeof c === 'string' && /^-?\d+(\.\d+)?$/.test(c)) return Number(c);
    }
    return null;
  }

  function scrapeAllFarms() {
    if (!hostEnabled() || automationPaused({}) || captchaPaused('farm')) return;
    if (gbLocked('farm-scrape')) { gbLogT('farm-scrape-inflight', 30000, 'farm scrape: skipped (in flight)'); return; }
    gbLock('farm-scrape');
    refreshFarmsParsed();
    const wait = SYNC.FARM_MIN_MS + Math.random() * (SYNC.FARM_MAX_MS - SYNC.FARM_MIN_MS);
    state.nextFarmScrape = Date.now() + wait;
    save(STORE.NEXT_FARM, state.nextFarmScrape);
    renderTimers();
    const list = state.farmsParsed.slice();
    const gameFarms = list.filter(f => f.fromGame).length;
    if (!list.length) {
      gbUnlock('farm-scrape');
      gbLog('farm scrape: 0 farms known (no game data, textarea empty)');
      return;
    }
    gbLog(`farm scrape: ${list.length} farms (${gameFarms} auto-discovered, ${list.length - gameFarms} from textarea)`);
    let done = 0, ok = 0;

    (function step() {
      if (!hostEnabled() || automationPaused({}) || captchaPaused('farm')) {
        gbUnlock('farm-scrape');
        gbLog(`farm scrape aborted (host/pause): ${ok}/${done} ok`);
        return;
      }
      const f = list.shift();
      if (!f) {
        gbUnlock('farm-scrape');
        gbLog(`farm scrape done: ${ok}/${done} ok, next in ${fmtSec(Math.round(wait / 1000))}`);
        flash(`farms ${ok}/${done} ok`);
        return;
      }
      try {
        fetchFarmResources(f, (good) => {
          done++; if (good) ok++;
          if (!good) gbLogT('farm-nodata-' + f.vill_id, 60000, `  farm ${f.vill_id}: no data (${(state.farmResources[f.vill_id] || {}).err || '?'})`);
          gbTimeout(step, 700 + Math.random() * 300);
        });
      } catch (e) {
        done++;
        gbLogT('farm-scrape-throw', 30000, `farm scrape throw ${f.vill_id}: ${String(e).slice(0, 80)}`);
        gbTimeout(step, 700 + Math.random() * 300);
      }
    })();
  }

  function farmTick() {
    try { gbWakeGapTick(); } catch (_) {}
    const run = () => {
      const now = Date.now();
      if (hostEnabled() && !automationPaused({})) {
        if (now >= state.nextFarmScrape) scrapeAllFarms();
        if (now >= state.nextTownsScrape) scrapeAllTowns();
      }
      try { farmSleepAutoTick(); } catch (_) {}
      try { farmLoyaltyAutoTeachTick(); } catch (_) {}
      try { renderFarmTeachBanner(); } catch (_) {}
    };
    if (typeof gbInWakeBurst === 'function' && gbInWakeBurst()) {
      gbWake('farmTick', run, { priority: 20 });
      return;
    }
    run();
  }

  function townsFromGame() {
    try {
      const col = mmCol('Town');
      if (!col || !col.models || !col.models.length) return null;
      return col.models.map(m => {
        const a = m.attributes || {};
        return { id: String(a.id), name: a.name || null, x: a.island_x ?? null, y: a.island_y ?? null, island: a.island_id ?? null };
      });
    } catch (e) { return null; }
  }
  function townResourcesFromGame(id) {
    const uw = gameUw();
    try {
      const t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(id) : uw.ITowns.towns[id]);
      if (!t || !t.resources) return null;
      const r = t.resources();
      if (!r || r.wood == null) return null;
      return r;
    } catch (_) { return null; }
  }
  const TOWN_LIST_GUESSES = ['get_towns', 'towns_overview', 'get_owned_towns', 'overview_towns', 'town_list'];
  function fetchOwnedTowns(i = 0) {
    if (!state.csrf) return;
    if (captchaPaused('town') || (captchaGlobalUntil && Date.now() < captchaGlobalUntil)) return;
    if (i >= TOWN_LIST_GUESSES.length) { scrapeTownsDom(); return; }
    const action = TOWN_LIST_GUESSES[i];
    const params = new URLSearchParams();
    params.set('action', action); params.set('h', state.csrf);
    const u = '/index.php?' + params.toString();
    gbXhr({
      method: 'GET', url: u,
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      onload(res) {
        const retryMs = httpRetryAfterMs(res);
        if (retryMs) {
          gbLogT('towns-http', 30000, `towns list HTTP ${res.status}, retry ${retryMs}ms`);
          gbTimeout(() => fetchOwnedTowns(i), retryMs);
          return;
        }
        if (res.status && res.status >= 400) return fetchOwnedTowns(i + 1);
        const body = (res.responseText || '').slice(0, 2000);
        if (!body || body[0] !== '{') return fetchOwnedTowns(i + 1);
        try {
          const data = JSON.parse(res.responseText);
          const json = (data && data.json) ? data.json : data;
          const list = extractTowns(json);
          if (list && list.length) {
            state.towns = list;
            save(STORE.TOWNS, state.towns);
            renderWorld();
            console.info('[grepbot] towns:', list.length, 'via', action);
            return;
          }
        } catch (e) {  }
        fetchOwnedTowns(i + 1);
      },
      onerror() { fetchOwnedTowns(i + 1); },
    });
  }
  function extractTowns(json) {
    if (!json) return null;
    const out = [];
    const tryArr = (arr) => {
      if (!Array.isArray(arr)) return false;
      for (const t of arr) {
        if (!t || typeof t !== 'object') continue;
        const id = t.id ?? t.town_id;
        if (!id) continue;
        out.push({ id: String(id), name: t.name || null, x: t.x ?? null, y: t.y ?? null, island: t.island_id ?? null });
      }
      return out.length > 0;
    };
    if (tryArr(json)) return out;
    if (tryArr(json.towns)) return out;
    if (tryArr(json.owned_towns)) return out;
    const walk = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) { obj.forEach(walk); return; }
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (k === 'towns' && Array.isArray(v)) tryArr(v);
        else if (v && typeof v === 'object') walk(v);
      }
    };
    walk(json);
    return out.length ? out : null;
  }
  function scrapeTownsDom() {
    document.querySelectorAll('[data-townid], a[data-town-id]').forEach(a => {
      const id = a.getAttribute('data-townid') || a.getAttribute('data-town-id');
      if (!id || state.towns.find(t => t.id === id)) return;
      state.towns.push({ id: String(id), name: (a.textContent || '').trim() || null });
    });
    save(STORE.TOWNS, state.towns);
    renderWorld();
  }
  function fetchTownResources(town) {
    if (captchaPaused('town') || (captchaGlobalUntil && Date.now() < captchaGlobalUntil)) return;
    const TOWN_ACTION_GUESSES = ['town_info', 'get_town_info', 'town_overview', 'overview_towns', 'get_resources', 'resource_header'];
    tryGuess(town, 0);
    function tryGuess(town, i) {
      if (captchaPaused('town') || (captchaGlobalUntil && Date.now() < captchaGlobalUntil)) return;
      if (i >= TOWN_ACTION_GUESSES.length) {
        state.townResources[town.id] = { ts: Date.now(), ok: false, err: 'no endpoint' };
        save(STORE.TOWN_RES, state.townResources);
        renderWorld();
        return;
      }
      const action = TOWN_ACTION_GUESSES[i];
      const params = new URLSearchParams();
      params.set('action', action); params.set('town_id', town.id); params.set('h', state.csrf);
      const u = '/index.php?' + params.toString();
      gbXhr({
        method: 'GET', url: u,
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        anonymous: false,
        onload(res) {
          const retryMs = httpRetryAfterMs(res);
          if (retryMs) {
            gbLogT('town-res-http', 30000, `town ${town.id} HTTP ${res.status}, retry ${retryMs}ms`);
            gbTimeout(() => tryGuess(town, i), retryMs);
            return;
          }
          if (res.status && res.status >= 400) return tryGuess(town, i + 1);
          const body = (res.responseText || '').slice(0, 500);
          if (!body || body[0] !== '{' || /<html/i.test(body)) return tryGuess(town, i + 1);
          try {
            const p = parseResourceJson(JSON.parse(res.responseText));
            if (!p.got) return tryGuess(town, i + 1);
            state.townResources[town.id] = {
              ts: Date.now(), wood: p.wood, stone: p.stone, iron: p.iron,
              pop: p.pop, cap: p.cap, ok: true, action,
            };
            save(STORE.TOWN_RES, state.townResources);
            renderWorld();
          } catch (e) { tryGuess(town, i + 1); }
        },
        onerror() { tryGuess(town, i + 1); },
      });
    }
  }
  function scrapeAllTowns() {
    if (!hostEnabled() || automationPaused({}) || captchaPaused('town')) return;
    if (gbLocked('town-scrape')) { gbLogT('town-scrape-inflight', 30000, 'town scrape: skipped (in flight)'); return; }
    gbLock('town-scrape');
    const delay = SYNC.TOWN_MIN_MS + Math.random() * (SYNC.TOWN_MAX_MS - SYNC.TOWN_MIN_MS);
    state.nextTownsScrape = Date.now() + delay;
    save(STORE.NEXT_TOWNS, state.nextTownsScrape);
    renderTimers();
    try {
      const gameTowns = townsFromGame();
      if (gameTowns && gameTowns.length) {
        if (gameTowns.length !== state.towns.length) gbLog(`towns: ${gameTowns.length} from game data`);
        state.towns = gameTowns;
        save(STORE.TOWNS, state.towns);
      } else if (!state.towns.length) {
        gbLogT('towns-fallback', 300000, 'towns: game data unavailable, HTTP fallback');
        fetchOwnedTowns();
      }
      let fromGame = 0, fromHttp = 0;
      state.towns.forEach((t, i) => {
        const r = townResourcesFromGame(t.id);
        if (r) {
          fromGame++;
          state.townResources[t.id] = {
            ts: Date.now(), wood: r.wood ?? null, stone: r.stone ?? null, iron: r.iron ?? null,
            pop: r.population ?? null, cap: r.storage ?? null, ok: true, action: 'game-data',
          };
        } else if (hostEnabled() && !automationPaused({}) && !captchaPaused('town')) {
          fromHttp++;
          gbTimeout(() => fetchTownResources(t), fromHttp * 600);
        }
      });
      const ids = state.towns.map(t => t.id);
      pruneMapsToIds(state.townResources, ids);
      save(STORE.TOWN_RES, state.townResources);
      renderWorld();
      gbLog(`towns scrape: ${state.towns.length} towns (${fromGame} via game data, ${fromHttp} via HTTP)`);
    } finally {

      gbTimeout(() => { gbUnlock('town-scrape'); }, Math.max(2000, state.towns.length * 700));
    }
  }

  function collectMaxMin() { return state.collectMaxMin || 10; }
  const COLLECT_ACTIONS = [
    'collect', 'collect_resources', 'collectresources', 'collect_resource',
    'claim', 'claim_resources', 'claimreward', 'claimrewardresource',
    'gather', 'recoger', 'pickup', 'pick_up',
  ];
  const COLLECT_BTN_SEL = '.btn_claim_resources, button[data-action*="claim"], a[data-action*="claim"]';
  function parseTimerMinutes(txt) {
    const t = String(txt || '').replace(/\u00a0/g, ' ').trim().toLowerCase();
    if (!t) return null;
    let m = t.match(/^(\d{1,2})\s*min$/);
    if (m) return parseInt(m[1], 10);
    m = t.match(/^(\d+)\s*h(?:\s*(\d+)\s*min)?$/);
    if (m) return parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
    return null;
  }
  function learnCollectAction(u) {
    if (!u || state.collectTpl) return;
    const m = u.match(/[?&]action=([a-z0-9_]+)/i);
    if (!m) return;
    const a = m[1].toLowerCase();
    if (!COLLECT_ACTIONS.includes(a)) return;
    state.collectTpl = u;
    save(wkey(STORE.COLLECT_TPL), u);
    gbLog('learned collect action', a);
  }
  function buildCollectUrl(template, townId) {
    try {
      const u = new URL(template, location.origin);
      u.searchParams.set('town_id', String(townId));
      u.searchParams.set('h', state.csrf || u.searchParams.get('h') || '');
      return u.pathname + '?' + u.searchParams.toString();
    } catch (e) {
      return template.replace(/town_id=\d+/, `town_id=${townId}`);
    }
  }
  function autoCollectResources() {
    if (!state.autoCollect) return;
    if (!hostEnabled()) return;
    if (automationPaused({}) || captchaPaused('collect')) return;
    if (document.hidden) return;

    if (currentTownWarehouseBlocks()) {
      gbLogT('collect-wh-full', 60000, `auto-collect: skipped Recoger (warehouse full, mode=${state.farmFullMode})`);
      return;
    }
    const btns = Array.from(document.querySelectorAll(COLLECT_BTN_SEL));
    let clicked = 0, scanned = btns.length;
    const skipped = [];
    for (const btn of btns) {
      if (btn.dataset.grepbotClicked) { skipped.push('already-clicked'); continue; }
      const card = btn.closest('.action_card') || btn.closest('[class*="action_card"]') || btn.parentElement;
      if (!card) { skipped.push('no-card'); continue; }
      const timeEl = card.querySelector('.action_time');
      if (!timeEl) { skipped.push('no-time'); continue; }
      const min = parseTimerMinutes(timeEl.textContent);
      if (min == null || min === 0) { skipped.push('no-parse:' + (timeEl.textContent||'').trim()); continue; }
      if (!state.collectAll && min > collectMaxMin()) { skipped.push(`too-long:${min}min`); continue; }
      const collectTxt = i18n('collect');
      const label = btn.querySelector('span') || btn;
      const labelTxt = (label.textContent || '').replace(/\u00a0/g, ' ');
      if (collectTxt && labelTxt && !labelTxt.includes(collectTxt) &&
          !/Recoger|Collect|Sammeln|Collecter|Raccogli|Recolher/i.test(labelTxt)) {
        skipped.push('i18n:' + labelTxt.trim().slice(0, 12));
        continue;
      }
      btn.dataset.grepbotClicked = String(Date.now());
      if (gbDomClick(btn, 'collect')) clicked++;
    }
    updateCollectStateBadge(scanned, clicked);
    if (clicked) { gbLog(`auto-collect: clicked ${clicked}/${scanned} Recoger buttons`); flash(`auto-collect x${clicked}`); }
    else if (scanned > 0) gbLogT('collect-skip', 120000, `auto-collect: 0/${scanned} clickable`, skipped.slice(0, 4).join(', '));
  }
  function updateCollectStateBadge(scanned, clicked) {
    const e = panel?.querySelector('#gb-collect-state');
    if (!e) return;
    if (state.collectAll) {
      e.textContent = `* ALL ON (${scanned}/${clicked})`;
      e.style.color = '#f96';
    } else if (scanned > 0) {
      e.textContent = `auto: ${clicked}/${scanned}`;
      e.style.color = clicked ? '#6c6' : '#888';
    } else {
      const a = state.collectTpl && state.collectTpl.match(/action=([^&]+)/);
      e.textContent = state.collectTpl ? '* learn:' + (a ? a[1] : '?') : 'no btn';
      e.style.color = '#888';
    }
  }

  let collectBgBackoff = 90_000;
  let collectBgTimer = null;
  function scheduleCollectBg(ms) {
    if (collectBgTimer) return;
    collectBgTimer = gbTimeout(() => {
      collectBgTimer = null;
      collectAllBackground();
    }, ms);
  }
  function collectAllBackground() {
    if (!state.collectAll) return;
    if (!hostEnabled() || automationPaused({}) || captchaPaused('collect')) return;
    if (gbLocked('collect-bg') || collectBgTimer) return;
    if (!state.csrf) { scheduleCollectBg(30_000); return; }
    if (!state.collectTpl) { scheduleAutoCollect(); scheduleCollectBg(60_000); return; }
    if (!state.towns.length) fetchOwnedTowns();
    const n = state.towns.length;
    if (!n) { scheduleCollectBg(60_000); return; }

    let collectCtrl = null, collectAction = null;
    try {
      const u = new URL(state.collectTpl, location.origin);
      collectAction = u.searchParams.get('action');
      const parts = u.pathname.split('/').filter(Boolean);

      collectCtrl = parts.length >= 2 && parts[0] === 'game' ? parts[1] : parts[parts.length - 1];
    } catch (_) {}
    if (!collectCtrl || !collectAction) {
      gbLogT('collect-bg-nomethod', 120000, 'bg-collect: skip (learned URL method/controller unknown - no blind GET)');
      scheduleCollectBg(collectBgBackoff + Math.random() * 30_000);
      return;
    }
    gbLock('collect-bg');
    let pending = n;
    let errors = 0;
    const finish = () => {
      if (--pending > 0) return;
      gbUnlock('collect-bg');
      if (errors) collectBgBackoff = Math.min(collectBgBackoff * 2, 600_000);
      else collectBgBackoff = 90_000;
      scheduleCollectBg(collectBgBackoff + Math.random() * 30_000);
    };
    state.towns.forEach((t, i) => {
      gbTimeout(() => {
        if (!hostEnabled() || automationPaused({}) || captchaPaused('collect')) { finish(); return; }
        if (townWarehouseBlocks(t.id)) {
          gbLogT('bg-collect-wh-' + t.id, 120000, `bg-collect: skip town ${t.id} (warehouse full)`);
          finish();
          return;
        }
        gameAjaxPost('collect', collectCtrl, collectAction, { town_id: +t.id }, (err, res) => {
          if (err && err !== 'dryrun' && err !== 'disabled' && err !== 'paused' && err !== 'budget' && err !== 'remembered') {
            errors++;
            if (err !== 'captcha' && err !== 'captcha-pause') {
              flash(`collect ${t.name || t.id}: ${err}`);
            }
          } else if (!err && res && (res.error || res.err)) {
            errors++;
            flash(`collect ${t.name || t.id}: ${res.error || res.err}`);
          }
          finish();
        });
      }, i * 400);
    });
    flash(`bg-collect x${n}`);
  }
  let collectTimer = null;
  function scheduleAutoCollect() {
    if (collectTimer) return;
    collectTimer = gbTimeout(() => { collectTimer = null; autoCollectResources(); }, 800);
  }

  let gbDomObserverSig = '';
  function ensureDomObserver() {
    if (!gbDomObserver) {
      gbDomObserver = new MutationObserver(() => {
        if (document.hidden) return;
        if (state.autoCollect) scheduleAutoCollect();
        if (state.autoBandit) scheduleBanditScan();
      });
    }
    const targets = [];
    const ui = document.querySelector('#ui_box');
    if (ui) targets.push(ui);
    document.querySelectorAll('.window_content, .quests, #questlog').forEach(el => {
      if (el && targets.indexOf(el) < 0) targets.push(el);
    });
    if (!targets.length && document.body) targets.push(document.body);
    const sig = targets.map(t => (t.id || '') + '.' + (t.className || '')).join('|');
    if (sig === gbDomObserverSig) return;
    try { gbDomObserver.disconnect(); } catch (_) {}
    gbDomObserverSig = sig;
    for (const t of targets) {
      try { gbDomObserver.observe(t, { childList: true, subtree: true }); } catch (_) {}
    }
  }
  ensureDomObserver();
  let banditTimer = null;
  let banditAttackSentAt = 0;
  let banditIdleUntil = 0;
  function banditIdle(ms, cap) { banditIdleUntil = Date.now() + Math.min(ms, cap || 30000); }
  const BANDIT_OFFENSE_IDS = /^(slinger|rider|chariot|catapult|minotaur|manticore|cyclops?|zyklop|harpy|erinys|giant|godsent)$/i;
  function banditIsOffenseUnit(uw, id) {
    if (/^godsent$/i.test(id)) return true;
    try {
      const def = uw.GameData && uw.GameData.units && uw.GameData.units[id];
      const f = def && def.unit_function;
      if (f === 'function_off' || f === 'off') return true;
      if (f === 'function_def' || f === 'def') return false;
      if (f === 'function_both' || f === 'both' || f === 'function_none' || f === 'none') return false;
    } catch (_) {}
    return BANDIT_OFFENSE_IDS.test(id);
  }
  function movementsUnitsModels(uw) {
    try {
      const col = uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('MovementsUnits');
      if (col && col.models) return col.models;
    } catch (_) {}
    try {
      const cols = uw.MM.getCollections && uw.MM.getCollections().MovementsUnits;
      if (cols && cols[0] && cols[0].models) return cols[0].models;
    } catch (_) {}
    try {
      const map = uw.MM.getModels && uw.MM.getModels().MovementsUnits;
      if (map) return Object.keys(map).map(k => map[k]);
    } catch (_) {}
    return [];
  }
  function banditWrongIsland(uw, m) {
    try {
      if (m.hasReward && m.hasReward()) return false;
      if (typeof m.getIslandId !== 'function') return false;
      const campIsland = m.getIslandId();
      if (campIsland == null) return false;
      let townIsland = null;
      try {
        const towns = uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('Town');
        const cur = towns && towns.getCurrentTown && towns.getCurrentTown();
        if (cur && cur.getIslandId) townIsland = cur.getIslandId();
      } catch (_) {}
      if (townIsland == null) {
        try {
          const t = uw.ITowns && uw.ITowns.towns && uw.ITowns.towns[uw.Game.townId];
          if (t && t.getIslandId) townIsland = t.getIslandId();
        } catch (_) {}
      }
      if (townIsland == null) return false;
      return townIsland !== campIsland;
    } catch (_) { return false; }
  }
  function banditViaGame() {
    if (!hostEnabled() || captchaPaused('bandit')) return true;
    const uw = gameUw();
    let m = null;
    try { m = uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('PlayerAttackSpot'); } catch (_) {}
    if (!m || !(uw.gpAjax && uw.gpAjax.ajaxPost)) return false;
    const playerId = uw.Game && uw.Game.player_id;
    if (playerId == null) { gbLogT('bandit-nopid', 60000, 'bandit: Game.player_id missing'); return true; }
    const post = (action_name, args, onDone) => bridgePost('bandit', {
      model_url: `PlayerAttackSpot/${playerId}`, action_name, arguments: args,
      town_id: uw.Game && uw.Game.townId,
    }, onDone);
    try {
      if (typeof m.getLevel === 'function' && m.getLevel() == null) { gbLogT('bandit-none', 300000, 'bandit: no camp on this world'); banditIdle(300000, 300000); return true; }
      if (m.hasReward && m.hasReward()) {
        if (gbLocked('bandit-reward')) {
          gbLogT('bandit-reward-inflight', 10000, 'bandit: reward claim in flight');
          return true;
        }
        const r = (m.getReward && m.getReward()) || {};
        const pid = r.power_id || '';
        const action = (pid.includes('instant') && !pid.includes('favor')) ? 'useReward'
          : (r.stashable ? 'stashReward' : 'useReward');
        gbLock('bandit-reward');
        banditIdleUntil = 0;
        gbLog('bandit: reward claim posted via', action, pid || '(no power_id)');
        post(action, {}, (err) => {
          gbUnlock('bandit-reward');
          if (err) { gbLog('bandit: reward claim failed', err); return; }
          gbLog('bandit: reward claimed via', action, pid || '(no power_id)');
          flash('bandit: reward claimed');
          logBandit('collected');
        });
        return true;
      }
      const cd = m.getCooldownDuration ? m.getCooldownDuration() : 0;
      if (cd > 0) {
        gbLogT('bandit-cd', 60000, `bandit: cooldown ${Math.floor(cd / 60)}m${cd % 60}s left`);
        banditIdle(cd * 1000);
        return true;
      }
      for (const mov of movementsUnitsModels(uw)) {
        const a = (mov && mov.attributes) || {};
        if (a.destination_is_attack_spot || a.destinationIsAttackSpot ||
            a.origin_is_attack_spot || a.originIsAttackSpot) {
          gbLogT('bandit-enroute', 60000, 'bandit: attack already en route');
          banditIdle(15000);
          return true;
        }
      }
      if (Date.now() - banditAttackSentAt < 8000) {
        gbLogT('bandit-sent-guard', 10000, 'bandit: waiting for movement model after attack');
        banditIdle(8000);
        return true;
      }
      const townId = uw.Game && uw.Game.townId;
      if (townId != null && townWarehouseBlocks(townId)) {
        gbLogT('bandit-wh-full', 60000, `bandit: skip attack (warehouse full, mode=${state.farmFullMode})`);
        banditIdle(30000);
        return true;
      }
      if (banditWrongIsland(uw, m)) {
        gbLogT('bandit-island', 60000, 'bandit: camp on other island - switch town or skip');
        banditIdle(30000);
        return true;
      }
      const t = uw.ITowns && uw.ITowns.towns && uw.ITowns.towns[uw.Game.townId];
      if (!t || !t.units) { gbLogT('bandit-notown', 60000, 'bandit: current town units unavailable'); return true; }
      const units = Object.assign({}, t.units());
      delete units.militia;
      Object.keys(units).forEach(u => {
        try {
          const def = uw.GameData && uw.GameData.units && uw.GameData.units[u];
          if (!def || def.is_naval) delete units[u];
        } catch (_) { delete units[u]; }
        if (units[u] != null && !banditIsOffenseUnit(uw, u)) delete units[u];
        if (!units[u]) delete units[u];
      });
      if (!Object.keys(units).length) { gbLogT('bandit-nounits', 60000, 'bandit: no offense units in current town'); banditIdle(30000); return true; }
      post('attack', units, (err) => {
        if (err) {
          banditAttackSentAt = 0;
          gbLog('bandit: attack failed', err);
          return;
        }
        banditAttackSentAt = Date.now();
        gbLog('bandit: ATTACK confirmed', JSON.stringify(units));
        flash('bandit: attack sent');
        logBandit('attack');
      });
      banditAttackSentAt = Date.now();
      gbLog('bandit: ATTACK posted (await confirm)', JSON.stringify(units));
    } catch (e) { gbLog('bandit game-path fail', String(e)); }
    return true;
  }
  function banditScan() {
    if (!state.autoBandit) return;
    if (!hostEnabled() || automationPaused({}) || captchaPaused('bandit')) {
      banditScheduleNext();
      return;
    }
    if (Date.now() < banditIdleUntil) {
      banditScheduleNext();
      return;
    }
    try {
      if (banditViaGame()) return;
      gbLogT('bandit-dom', 120000, 'bandit: game bridge unavailable, DOM fallback');
      const victory = document.querySelector('.attack_spot_victory .btn_collect, .attack_spot_victory .button_new.double_border');
      if (victory && !victory.dataset.grepbotClicked) {
        victory.dataset.grepbotClicked = String(Date.now());
        if (gbDomClick(victory, 'bandit-reward')) {
          gbLog('bandit: collected reward (DOM)');
          flash('bandit: collected reward');
          logBandit('collected');
        }
        return;
      }
      try {
        const uw = gameUw();
        const tid = uw.Game && uw.Game.townId;
        if (tid != null && townWarehouseBlocks(tid)) {
          gbLogT('bandit-wh-full-dom', 60000, `bandit: skip DOM attack (warehouse full, mode=${state.farmFullMode})`);
          banditIdle(30000);
          return;
        }
      } catch (_) {}
      const camps = document.querySelectorAll('.js-window-main-container.attack_spot:not(.minimized):not(.attack_spot_victory)');
      for (const camp of camps) {
        const btn = camp.querySelector('.btn_attack');
        if (!btn) continue;
        const cdEl = camp.querySelector('.countdown, [class*="countdown"], .cooldown_time');
        if (cdEl && /\d/.test(cdEl.textContent || '')) continue;
        const disabled = btn.getAttribute('disabled') != null || btn.disabled === true
          || btn.getAttribute('aria-disabled') === 'true';
        if (disabled) continue;
        let filled = 0;
        let offense = null;
        try {
          const uwDom = gameUw();
          const tid = uwDom.Game && uwDom.Game.townId;
          const t = tid != null && uwDom.ITowns && uwDom.ITowns.towns && uwDom.ITowns.towns[tid];
          if (t && t.units) {
            offense = Object.assign({}, t.units());
            delete offense.militia;
            Object.keys(offense).forEach(u => {
              if (!offense[u] || !banditIsOffenseUnit(uwDom, u)) delete offense[u];
            });
          }
        } catch (_) {}
        if (!offense || !Object.keys(offense).length) {
          gbLogT('bandit-dom-nooff', 60000, 'bandit: no offense units for DOM fill');
          continue;
        }
        camp.querySelectorAll('.unit_container [data-unit_id], .unit_icon40x40[data-unit_id]').forEach(icon => {
          const uid = icon.getAttribute('data-unit_id');
          const n = uid && +offense[uid] || 0;
          if (!n) return;
          const box = icon.closest('.unit_container') || icon.parentElement;
          const input = box && box.querySelector('input.txt_unit, input[type=text], input[type=number]');
          if (!input || input.dataset.grepbotFilled) return;
          input.dataset.grepbotFilled = String(Date.now());
          input.value = String(n);
          try { input.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
          try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
          filled++;
        });
        if (!filled) {
          gbLogT('bandit-dom-nooff', 60000, 'bandit: no offense unit inputs in camp window');
          continue;
        }
        gbTimeout(() => {
          if (!hostEnabled() || automationPaused({}) || captchaPaused('bandit')) return;
          const atkBtn = camp.querySelector('.btn_attack');
          const stillOff = atkBtn && (atkBtn.getAttribute('disabled') != null || atkBtn.disabled === true);
          if (atkBtn && !stillOff) {
            atkBtn.dataset.grepbotClicked = String(Date.now());
            if (gbDomClick(atkBtn, 'bandit-attack')) {
              gbLog('bandit: attack sent (DOM, offense-only)');
              flash('bandit: attack sent');
              logBandit('attack');
            }
          }
        }, 250);
        return;
      }
    } finally {
      banditScheduleNext();
    }
  }
  let banditLoopTimer = null;
  function banditClearLoop() {
    if (banditLoopTimer) {
      try { clearTimeout(banditLoopTimer); } catch (_) {}
      banditLoopTimer = null;
    }
  }
  function banditScheduleNext() {
    if (banditLoopTimer) return;
    if (!state.autoBandit) return;
    const now = Date.now();
    let delay = 1500;
    if (banditIdleUntil > now) delay = Math.min(30000, Math.max(1500, banditIdleUntil - now));
    banditLoopTimer = gbTimeout(() => {
      banditLoopTimer = null;
      banditScan();
    }, delay);
  }
  function scheduleBanditScan() {
    if (banditTimer) return;
    banditTimer = gbTimeout(() => {
      banditTimer = null;
      banditIdleUntil = 0;
      banditClearLoop();
      banditScan();
    }, 600);
  }
  function logBandit(ev) {
    state.banditLog.push({ ts: Date.now(), ev });
    if (state.banditLog.length > 50) state.banditLog = state.banditLog.slice(-50);
    save(STORE.BANDIT_LOG, state.banditLog);
  }
  banditScheduleNext();

  const IB_CHECK_MS = 10000;
  const IB_FREE_ACTIONS = new Set(['completeInstant', 'finishInstantly']);
  function ibFreeThresh() { return state.ibFreeThresh || 300; }

  function ibGoldCost(kind, seconds) {
    try {
      const uw = uwCached();
      const gdi = uw.GameDataInstantBuy;
      if (!gdi || typeof gdi.getPriceForType !== 'function') return null;
      const type = kind === 'research' ? 'research' : 'building';
      const price = gdi.getPriceForType(type, Math.max(0, +seconds || 0));
      return Number.isFinite(+price) ? +price : null;
    } catch (_) { return null; }
  }
  function ibIsFreeOrder(doneAt, timeLeft, gold) {
    return !!doneAt && timeLeft <= ibFreeThresh() && gold === 0;
  }
  function ibOrderStillPresent(orderId) {
    return ibOrders().some(o => String(o.id) === String(orderId));
  }
  function ibFindLiveOrder(orderId, kind) {
    return ibOrders().find(o => String(o.id) === String(orderId) && (kind == null || o.kind === kind)) || null;
  }
  function ibUnknownActionErr(err) {
    return /unknown.?action|invalid.?action|action.?not.?found|does.?not.?exist|no.?such.?action/i.test(String(err || ''));
  }
  function ibTownNames(uw) {
    const names = {};
    try { (townsFromGame() || []).forEach(t => { names[t.id] = t.name; }); } catch (_) {}
    try {
      const gpCols = uw.GPWindowMgr && uw.GPWindowMgr._collections;
      if (gpCols && gpCols.towns && gpCols.towns.models) {
        gpCols.towns.models.forEach(tm => {
          const a = tm.attributes || tm;
          if (a.id != null && !names[a.id] && a.name) names[a.id] = a.name;
        });
      }
    } catch (_) {}
    return names;
  }

  function ibResearchOrders(names) {
    const now = gameNow();
    const out = [];
    const uw = uwCached();
    const cols = ibTownCollections('research');
    try {
      const col = mmCol('ResearchOrder');
      if (col && col.models && col.models.length) cols.push(col);
    } catch (_) {}
    if (!cols.length) {
      let gpCols = null;
      try { gpCols = uw.GPWindowMgr && uw.GPWindowMgr._collections; } catch (_) {}
      if (gpCols) {
        Object.keys(gpCols).forEach(k => {
          if (k.indexOf('research_orders') === 0 && gpCols[k] && gpCols[k].models) cols.push(gpCols[k]);
        });
      }
    }
    if (!cols.length) return out;
    const firstSeen = new Set();
    const seenIds = new Set();
    cols.forEach(col => {
      (col.models || []).forEach(model => {
        const r = model.attributes || model;
        if (!r.id || !r.town_id || seenIds.has(r.id)) return;
        seenIds.add(r.id);
        const doneAt = r.to_be_completed_at || r.toBeCompletedAt || r.completed_at || 0;
        const timeLeft = doneAt ? Math.max(0, doneAt - now) : (r.research_time || 0);
        const isFirst = !firstSeen.has(r.town_id);
        firstSeen.add(r.town_id);
        const display = isFirst ? timeLeft : (r.research_time || 0);
        const gold = ibGoldCost('research', display);
        out.push({
          id: r.id,
          kind: 'research',
          modelUrl: 'ResearchOrder/' + r.id,
          town_id: r.town_id,
          townName: names[r.town_id] || ('Town ' + r.town_id),
          type: 'res:' + (r.research_type || r.research_id || '?'),
          display,
          active: isFirst,
          isFree: ibIsFreeOrder(doneAt, timeLeft, gold),
          gold,
        });
      });
    });
    return out;
  }

  function ibTownCollections(kind) {
    const out = [];
    let ids = [];
    try { ids = abTownIds() || []; } catch (_) {}
    ids.forEach(id => {
      let t = null;
      try { t = abGetTown(id); } catch (_) {}
      if (!t) return;
      let col = null;
      try {
        if (kind === 'research') col = t.researchOrders ? t.researchOrders() : null;
        else col = t.buildingOrders ? t.buildingOrders() : null;
      } catch (_) { col = null; }
      if (col && col.models && col.models.length) out.push(col);
    });
    return out;
  }
  function ibTownCoverage() {
    let ids = [];
    try { ids = abTownIds() || []; } catch (_) {}
    let readable = 0;
    ids.forEach(id => {
      try {
        const t = abGetTown(id);
        if (t && typeof t.buildingOrders === 'function' && t.buildingOrders()) readable++;
      } catch (_) {}
    });
    return { readable, total: ids.length };
  }
  function ibOrders() {
    const now = gameNow();
    const out = [];
    const uw = uwCached();
    const names = ibTownNames(uw);
    const research = state.ibResearch ? ibResearchOrders(names) : [];
    let candidates = [], src = null;
    const perTown = ibTownCollections('build');
    if (perTown.length) { candidates = candidates.concat(perTown); src = 'ITowns'; }
    try {
      const col = mmCol('BuildingOrder');
      if (col && col.models && col.models.length) { candidates.push(col); src = src ? src + '+MM' : 'MM'; }
    } catch (_) {}
    let gpCols = null;
    try { gpCols = uw.GPWindowMgr && uw.GPWindowMgr._collections; } catch (_) {}
    if (!candidates.length && gpCols) {
      if (gpCols.building_orders && gpCols.building_orders.models) candidates.push(gpCols.building_orders);
      Object.keys(gpCols).forEach(k => {
        if (k.indexOf('building_orders_') === 0 && gpCols[k] && gpCols[k].models) candidates.push(gpCols[k]);
      });
      if (candidates.length) src = 'GPWindowMgr';
    }
    if (!candidates.length) return out.concat(research);
    gbLogT('ib-src', 300000, 'build orders source: ' + src);
    const firstSeen = new Set();
    const seenIds = new Set();
    candidates.forEach(col => {
      (col.models || []).forEach(model => {
        const r = model.attributes || model;
        if (!r.id || !r.town_id || seenIds.has(r.id)) return;
        seenIds.add(r.id);

        const doneAt = r.to_be_completed_at || r.toBeCompletedAt || r.completed_at || 0;
        const timeLeft = doneAt ? Math.max(0, doneAt - now) : (r.building_time || 0);
        const isFirst = !firstSeen.has(r.town_id);
        firstSeen.add(r.town_id);
        const display = isFirst ? timeLeft : (r.building_time || 0);
        const gold = ibGoldCost('build', display);
        out.push({
          id: r.id,
          kind: 'build',
          modelUrl: 'BuildingOrder/' + r.id,
          town_id: r.town_id,
          townName: names[r.town_id] || ('Town ' + r.town_id),
          type: r.building_type || '?',
          display,
          active: isFirst,
          isFree: ibIsFreeOrder(doneAt, timeLeft, gold),
          gold,
        });
      });
    });
    return out.concat(research);
  }
  function ibActionFor(kind) {
    const raw = kind === 'research'
      ? (state.ibActionR || 'completeInstant')
      : (state.ibAction || 'completeInstant');

    if (/buyInstant|buy_instant/i.test(String(raw))) return 'completeInstant';
    return raw;
  }
  function ibLearnAction(kind, action) {

    if (/buyInstant|buy_instant/i.test(String(action || ''))) {
      gbLogT('ib-learn-refuse', 60000, 'instant: refusing to learn premium action ' + action);
      return;
    }
    if (!IB_FREE_ACTIONS.has(String(action))) {
      gbLogT('ib-learn-refuse', 60000, 'instant: unknown free action ' + action + ' - learn manually via free click');
      return;
    }
    if (kind === 'research') { state.ibActionR = action; save(wkey(STORE.IB_ACTION_R), action); }
    else { state.ibAction = action; save(wkey(STORE.IB_ACTION), action); }
  }
  function ibComplete(order) {
    return new Promise(resolve => {
      if (!hostEnabled() || captchaPaused('build')) { resolve('pause'); return; }
      const kind = order.kind || 'build';
      const tag = kind === 'research' ? 'instant-research' : 'instant-build';

      const live = ibFindLiveOrder(order.id, kind);
      if (!live || !live.isFree) {
        gbLogT('ib-stale', 30000, `${tag}: #${order.id} no longer free (gold=${live && live.gold})`);
        resolve('skip');
        return;
      }
      const modelUrl = live.modelUrl || order.modelUrl || ('BuildingOrder/' + order.id);
      const action = ibActionFor(kind);
      const finishOk = () => {

        if (ibOrderStillPresent(order.id)) {
          gbLog(`${tag}: ${live.type} #${order.id} response OK but order still present - unknown_outcome`);
          resolve('unknown');
          return;
        }
        gbLog(`${tag}: ${live.type} #${order.id} OK`);
        resolve('ok');
      };
      const postFree = (actionName, isFallback) => {
        bridgePost('build', {
          model_url: modelUrl,
          action_name: actionName,
          captcha: null,
          arguments: { order_id: order.id },
          town_id: live.town_id,
        }, (err, data) => {
          if (err === 'captcha' || err === 'captcha-pause') { resolve('captcha'); return; }
          if (err === 'timeout') {

            if (!ibOrderStillPresent(order.id)) {
              gbLog(`${tag}: #${order.id} timeout but order gone - treating as OK`);
              resolve('ok');
            } else {
              gbLog(`${tag}: #${order.id} timeout_unknown - no fallback`);
              resolve('unknown');
            }
            return;
          }

          if (err && !isFallback && actionName === 'completeInstant' && ibUnknownActionErr(err)) {
            const again = ibFindLiveOrder(order.id, kind);
            if (!again || !again.isFree || again.gold !== 0) {
              gbLog(`${tag}: completeInstant unknown, order no longer free - inactive`);
              resolve('err');
              return;
            }
            gbLog(`${tag}: completeInstant unknown - trying finishInstantly (gold=0 only)`);
            postFree('finishInstantly', true);
            return;
          }
          if (err) { gbLog(tag + ' complete error: ' + err); resolve('err'); return; }
          const e = data && data.error;
          if (e) {
            gbLog(`${tag}: ${live.type} #${order.id} ERR ` + JSON.stringify(data).slice(0, 120));
            resolve('err');
            return;
          }
          finishOk();
        });
      };
      postFree(action, false);
    });
  }
  function ibCompleteAll(orders) {
    if (gbLocked('ib')) return;
    const free = (orders || ibOrders()).filter(o => o.isFree);
    if (!free.length) return;
    gbLock('ib');
    renderBuild();
    let i = 0, done = 0, captcha = false;
    const unlock = () => { gbUnlock('ib'); };

    const watchdog = gbTimeout(unlock, Math.max(30000, free.length * (BRIDGE_TIMEOUT_MS + 1000)));
    (function next() {
      if (i >= free.length || captcha) {
        try { clearTimeout(watchdog); } catch (_) {}
        unlock();
        gbLog(`instant: completed ${done}/${free.length}${captcha ? ' (captcha abort)' : ''}`);
        if (done) flash(`instant x${done}`);
        gbTimeout(ibScan, 3000);
        return;
      }
      ibComplete(free[i]).then(res => {
        if (res === 'ok') done++;
        if (res === 'captcha') captcha = true;
        i++;
        gbTimeout(next, 400 + Math.random() * 200);
      });
    })();
  }

  let ibFreeTimer = null;
  let ibFreeArmedAt = 0;
  function ibArmedAt() { return ibFreeArmedAt; }
  function ibArmNext(orders) {
    const now = Date.now();
    const thresh = ibFreeThresh() * 1000;
    let best = 0;
    (orders || []).forEach(o => {

      if (o.isFree || !o.active || !(o.display > 0)) return;
      const armIn = (o.display * 1000) - thresh;
      if (armIn <= 0) return;
      const at = now + armIn;
      if (!best || at < best) best = at;
    });
    if (!best) {
      if (ibFreeTimer) { try { clearTimeout(ibFreeTimer); } catch (_) {} }
      ibFreeTimer = null;
      ibFreeArmedAt = 0;
      return;
    }

    const fireAt = best + 1200 + Math.floor(Math.random() * 1500);
    if (ibFreeTimer && ibFreeArmedAt && Math.abs(ibFreeArmedAt - fireAt) < 3000) return;
    if (ibFreeTimer) { try { clearTimeout(ibFreeTimer); } catch (_) {} }
    ibFreeArmedAt = fireAt;
    ibFreeTimer = gbTimeout(() => {
      ibFreeTimer = null;
      ibFreeArmedAt = 0;
      ibScan();
    }, Math.max(500, fireAt - now));
    gbLogT('ib-arm', 60000, `instant: armed in ${fmtSec((fireAt - now) / 1000)} (free window at <=${ibFreeThresh()}s)`);
  }
  function ibScan() {
    const orders = ibOrders();
    renderBuild(orders);
    ibArmNext(orders);
    if (!state.ibAuto || gbLocked('ib')) return;
    const free = orders.filter(o => o.isFree);
    if (free.length) {
      gbLog(`instant: ${free.length} free order(s), auto-completing`);
      ibCompleteAll(free);
    }
  }
  function renderBuild(cached) {
    const sec = panel && panel.querySelector('section[data-tab=build]');
    if (!sec || sec.hidden) return;
    const rows = sec.querySelector('.ib-rows');
    const btn = sec.querySelector('#gb-ib-btn');
    const status = sec.querySelector('#gb-ib-status');
    const dot = sec.querySelector('#gb-ib-dot');
    const orders = cached || ibOrders();
    rows.replaceChildren();
    if (!orders.length) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#888;padding:6px 0;font-size:11px';
      e.textContent = 'no active build/research orders';
      rows.appendChild(e);
      dot.className = 'ib-dot';
      btn.disabled = true;
      status.textContent = gbLocked('ib') ? 'completing...' : '';
      renderAbQueue();
      return;
    }
    const byTown = new Map();
    let hasFree = false;
    orders.forEach(o => {
      if (o.isFree) hasFree = true;
      if (!byTown.has(o.townName)) byTown.set(o.townName, []);
      byTown.get(o.townName).push(o);
    });
    dot.className = 'ib-dot ' + (hasFree ? 'free' : 'paid');
    btn.disabled = !hasFree || gbLocked('ib');
    const mk = (cls, txt) => { const s = document.createElement('span'); s.className = cls; s.textContent = txt; return s; };
    for (const [town, ords] of byTown) {
      const t = document.createElement('div');
      t.className = 'ib-town';
      t.textContent = town;
      rows.appendChild(t);
      ords.forEach(o => {
        const r = document.createElement('div');
        r.className = 'ib-row';
        r.appendChild(mk('ib-type', o.type));
        r.appendChild(mk('ib-time', fmtHMS(o.display)));
        r.appendChild(mk(o.isFree ? 'ib-free' : 'ib-cost',
          o.isFree ? 'FREE' : (o.gold != null ? o.gold + ' gold' : '? gold')));
        rows.appendChild(r);
      });
    }
    status.textContent = (gbLocked('ib') ? 'completing... ' : '') + 'last scan: ' + new Date().toLocaleTimeString();
    renderAbQueue();
  }

  const AB_BUILDINGS = ['main', 'storage', 'farm', 'academy', 'temple', 'barracks', 'docks', 'market', 'hide', 'lumber', 'stoner', 'ironer', 'wall'];
  const AB_LABELS = {
    main: 'Senate', storage: 'Warehouse', farm: 'Farm', academy: 'Academy',
    temple: 'Temple', barracks: 'Barracks', docks: 'Harbor', market: 'Market',
    hide: 'Cave', lumber: 'Timber', stoner: 'Quarry', ironer: 'Silver', wall: 'Wall',
  };
  const AB_CS_FAST = {
    main: 15, storage: 20, farm: 22, academy: 28, docks: 20,
    barracks: 10, temple: 5, market: 10, hide: 10,
    lumber: 15, stoner: 15, ironer: 15, wall: 10,
  };

  const AB_PHASES = [
    { lumber: 3, stoner: 3, ironer: 3, farm: 4, storage: 4 },
    { main: 5, barracks: 5, temple: 3, storage: 5 },
    { farm: 8, main: 8, market: 6, storage: 8, academy: 7 },
    { farm: 15, storage: 15, main: 15, hide: 10 },
    { barracks: 10, docks: 10, academy: 13 },
    { academy: 28, docks: 20, farm: 22, storage: 20 },
    { lumber: 15, stoner: 15, ironer: 15, market: 10, temple: 5, wall: 10 },
  ];
  const AB_CHECK_MS = 30000;
  const AB_FILL_BATCH = 6;
  const AB_EXTRA_MS = 5 * 60 * 1000;
  function abRandMs() { return Math.floor(Math.random() * 3 * 60 * 1000); }

  const AB_PHASE_WEIGHT = {
    lumber: 1.25, stoner: 1.25, ironer: 1.25,
    storage: 1.35, farm: 1.45,
    main: 1.05, market: 0.95, hide: 0.85, temple: 0.75, wall: 0.65,
    academy: 1.15, docks: 1.1,
    barracks: 0.9,
  };
  const AB_ETA_UNKNOWN_MS = 24 * 3600 * 1000;
  const AB_ETA_POP_BLOCK_MS = 7 * 86400000;
  function phaseWeight(building, levels) {
    let w = AB_PHASE_WEIGHT[building] || 1;
    const lv = levels && levels[building] != null ? levels[building] : 0;

    if (lv < 8 && (building === 'lumber' || building === 'stoner' || building === 'ironer' || building === 'storage')) w *= 1.15;

    const core = ((levels && levels.main) || 0) + ((levels && levels.storage) || 0);
    if (core >= 12 && (building === 'academy' || building === 'docks')) w *= 1.12;

    if (((levels && levels.academy) || 0) >= 20 && (building === 'barracks' || building === 'docks')) w *= 1.08;
    return w;
  }
  function abGetPin(townId) {
    if (!state.abBuildPin || typeof state.abBuildPin !== 'object') return null;
    const p = state.abBuildPin[String(townId)];
    return p || null;
  }
  function abSetPin(townId, building) {
    if (!state.abBuildPin || typeof state.abBuildPin !== 'object') state.abBuildPin = {};
    if (!building) {
      delete state.abBuildPin[String(townId)];
    } else {
      state.abBuildPin[String(townId)] = building;
    }
    save(STORE.BUILD_PIN, state.abBuildPin);
  }

  function abCqSave() { save(STORE.AB_CUSTOM_Q, state.abCustomQueue || {}); }
  function abCqGet(townId) {
    if (!state.abCustomQueue || typeof state.abCustomQueue !== 'object') state.abCustomQueue = {};
    const list = state.abCustomQueue[String(townId)];
    return Array.isArray(list) ? list : [];
  }
  function abCqSet(townId, list) {
    if (!state.abCustomQueue || typeof state.abCustomQueue !== 'object') state.abCustomQueue = {};
    const clean = (list || []).filter(e => e && AB_BUILDINGS.indexOf(e.b) !== -1);
    if (clean.length) state.abCustomQueue[String(townId)] = clean;
    else delete state.abCustomQueue[String(townId)];
    abCqSave();
  }
  function abCqAdd(townId, building, lvl) {
    if (AB_BUILDINGS.indexOf(building) === -1) return;
    const list = abCqGet(townId).slice();
    list.push({ b: building, lvl: lvl == null ? null : abClampTarget(building, lvl) });
    abCqSet(townId, list);
  }
  function abCqRemove(townId, idx) {
    const list = abCqGet(townId).slice();
    if (idx < 0 || idx >= list.length) return;
    list.splice(idx, 1);
    abCqSet(townId, list);
  }
  function abCqMove(townId, idx, dir) {
    const list = abCqGet(townId).slice();
    const to = idx + dir;
    if (idx < 0 || idx >= list.length || to < 0 || to >= list.length) return;
    const tmp = list[idx];
    list[idx] = list[to];
    list[to] = tmp;
    abCqSet(townId, list);
  }

  function abCqWantLevel(entry, levels) {
    const cur = +((levels && levels[entry.b]) || 0);
    const want = entry.lvl == null ? cur + 1 : +entry.lvl;
    return Math.min(want, abMaxLevel(entry.b));
  }

  function abCqPrune(townId, levels) {
    if (!levels) return;
    const list = abCqGet(townId);
    if (!list.length) return;
    const keep = [];
    let dropped = 0;
    const sim = Object.assign({}, levels);
    list.forEach(e => {
      const want = abCqWantLevel(e, sim);
      if ((sim[e.b] || 0) >= want) { dropped++; return; }
      sim[e.b] = want;
      keep.push(e);
    });
    if (!dropped) return;
    abCqSet(townId, keep);
    gbLog(`auto-queue: town ${townId} custom queue - ${dropped} done, ${keep.length} left`);
  }
  function abTownProduction(townId) {
    const t = abGetTown(townId);
    if (!t) return null;
    try {
      const fn = t.getResourcesPerHour || t.getResourceProduction;
      if (typeof fn === 'function') {
        const r = fn.call(t);
        if (r && (r.wood != null || r.stone != null || r.iron != null)) {
          return { wood: +r.wood || 0, stone: +r.stone || 0, iron: +r.iron || 0 };
        }
      }
    } catch (_) {}
    try {
      const r = t.resources && t.resources();
      if (r) {
        const wood = +(r.wood_production || r.woodProduction || 0);
        const stone = +(r.stone_production || r.stoneProduction || 0);
        const iron = +(r.iron_production || r.ironProduction || 0);
        if (wood || stone || iron) return { wood, stone, iron };
      }
    } catch (_) {}
    const wood = gbProbeNum(t, ['getWoodProduction', 'getWoodPerHour', 'getProductionWood']);
    const stone = gbProbeNum(t, ['getStoneProduction', 'getStonePerHour', 'getProductionStone']);
    const iron = gbProbeNum(t, ['getIronProduction', 'getIronPerHour', 'getProductionIron']);
    if (wood != null || stone != null || iron != null) {
      return { wood: wood || 0, stone: stone || 0, iron: iron || 0 };
    }
    return null;
  }
  function abScratchStart(townId) {
    const st = townResState(townId);
    return {
      wood: st ? st.wood : null,
      stone: st ? st.stone : null,
      iron: st ? st.iron : null,
      pop: gbTownPop(townId),
      production: abTownProduction(townId),
    };
  }
  function abAffordScratch(scratch, cost, margin) {
    const m = margin != null ? +margin : 0;
    if (!cost) return { ok: true, blind: true, short: [], detail: 'no cost data' };
    const short = [];
    let blind = false;
    ['wood', 'stone', 'iron'].forEach(k => {
      const need = +cost[k] || 0;
      if (need <= 0) return;
      const have = scratch[k];
      if (have == null) { blind = true; return; }
      if (have < need + m) short.push(`${k} ${Math.floor(have)}/${need}`);
    });
    const needPop = +cost.pop || 0;
    if (needPop > 0) {
      if (scratch.pop == null) blind = true;
      else if (scratch.pop < needPop) short.push(`pop ${scratch.pop}/${needPop}`);
    }
    return { ok: short.length === 0, blind, short, detail: short.join(', ') };
  }
  function abEtaMs(scratch, afford) {
    if (afford.ok || afford.blind) return 0;
    const prod = scratch.production;
    let maxMs = 60000;
    (afford.short || []).forEach(s => {
      if (s.startsWith('pop ')) {
        maxMs = Math.max(maxMs, AB_ETA_POP_BLOCK_MS);
        return;
      }
      const m = s.match(/^(wood|stone|iron)\s+(\d+)\/(\d+)/);
      if (!m) return;
      const res = m[1];
      const have = +m[2];
      const need = +m[3];
      const deficit = need - have + 10;
      if (deficit <= 0) return;
      const rate = prod && prod[res];
      if (!(rate > 0)) {
        maxMs = Math.max(maxMs, AB_ETA_UNKNOWN_MS);
        return;
      }
      maxMs = Math.max(maxMs, (deficit / rate) * 3600000);
    });
    return maxMs;
  }
  function abQueueWaitMs(townId) {
    const q = abQueueInfo(townId);
    const now = gameNow();
    let wait = 0;
    q.orders.forEach(o => {
      const done = o.to_be_completed_at;
      if (done > now) wait += (done - now) * 1000;
      else wait += Math.max(0, o.building_time || 0) * 1000;
    });
    return wait;
  }
  function abPlanCandidates(levels) {
    const targets = abEnsureTargets();
    const out = [];
    AB_BUILDINGS.forEach(building => {
      const want = Math.min(targets[building] != null ? targets[building] : 0, abMaxLevel(building));
      if (want <= 0) return;
      if (levels[building] < want) out.push({ building, level: levels[building] + 1 });
    });
    return out;
  }
  function abScratchApply(scratch, cost) {
    if (!cost) return;
    if (scratch.wood != null) scratch.wood -= +cost.wood || 0;
    if (scratch.stone != null) scratch.stone -= +cost.stone || 0;
    if (scratch.iron != null) scratch.iron -= +cost.iron || 0;
    if (scratch.pop != null) scratch.pop -= +cost.pop || 0;
  }
  function abPlanEntryAfford(townId, building, scratch) {
    const raw = abBuildingCost(townId, building);
    const cost = raw ? {
      wood: raw.wood, stone: raw.stone, iron: raw.iron, pop: raw.pop || 0,
      buildTime: raw.buildTime,
    } : null;
    const afford = scratch
      ? abAffordScratch(scratch, cost, 10)
      : gbAfford(townId, cost ? { wood: cost.wood, stone: cost.stone, iron: cost.iron, population: cost.pop } : null, { margin: 10 });
    if (afford.blind) {
      gbLogT('ab-plan-blind', 300000, 'build plan: blind cost read - scoring as affordable');
    }
    return { cost, afford };
  }
  function buildPlanNext(townId, n) {
    n = n || 3;
    const levels = abCurrentLevels(townId);
    if (!levels) return [];
    const simLevels = Object.assign({}, levels);
    const scratch = abScratchStart(townId);
    let queueWait = abQueueWaitMs(townId);
    const plan = [];
    const pin = abGetPin(townId);

    const custom = abCqGet(townId).slice();
    if (custom.length && pin) {
      gbLogT('ab-cq-pin-' + townId, 300000,
        `auto-queue: town ${townId} has a custom queue - pin ${pin} ignored`);
    }
    let ci = 0;
    for (let slot = 0; slot < n; slot++) {

      while (ci < custom.length && (simLevels[custom[ci].b] || 0) >= abCqWantLevel(custom[ci], simLevels)) ci++;
      if (ci < custom.length) {
        const entry = custom[ci];
        const want = abCqWantLevel(entry, simLevels);
        const { cost, afford } = abPlanEntryAfford(townId, entry.b, scratch);
        const etaMs = abEtaMs(scratch, afford);
        plan.push({
          building: entry.b, level: (simLevels[entry.b] || 0) + 1,
          cost, afford, etaMs, score: Infinity, custom: true, cqTarget: want,
        });
        abScratchApply(scratch, cost);
        simLevels[entry.b] = (simLevels[entry.b] || 0) + 1;
        queueWait += cost && cost.buildTime ? Math.max(0, cost.buildTime) * 1000 : 0;
        continue;
      }
      const candidates = abPlanCandidates(simLevels);
      if (!candidates.length) break;
      const popBlockedExists = candidates.some(c => {
        const { afford } = abPlanEntryAfford(townId, c.building, scratch);
        return !afford.ok && !afford.blind && (afford.short || []).some(s => s.startsWith('pop '));
      });
      let pick = null;
      if (slot === 0 && pin) {
        const pinned = candidates.find(c => c.building === pin);
        if (pinned) {
          const { cost, afford } = abPlanEntryAfford(townId, pinned.building, scratch);
          const etaMs = abEtaMs(scratch, afford);
          pick = Object.assign({}, pinned, { cost, afford, etaMs, score: Infinity, pinned: true });
        }
      }
      if (!pick) {
        let bestScore = -1;
        candidates.forEach(cand => {
          const { cost, afford } = abPlanEntryAfford(townId, cand.building, scratch);
          let etaMs = abEtaMs(scratch, afford);
          let weight = phaseWeight(cand.building, simLevels);
          if (popBlockedExists) {
            if (cand.building === 'farm') weight *= 3;
            else if (!afford.ok && !afford.blind && (afford.short || []).some(s => s.startsWith('pop '))) {
              etaMs += AB_ETA_POP_BLOCK_MS;
            }
          }
          const score = weight / (etaMs + queueWait + 60000);
          if (score > bestScore) {
            bestScore = score;
            pick = Object.assign({}, cand, { cost, afford, etaMs, score });
          }
        });
      }
      if (!pick) break;
      plan.push(pick);
      abScratchApply(scratch, pick.cost);
      simLevels[pick.building] = (simLevels[pick.building] || 0) + 1;
      const btMs = pick.cost && pick.cost.buildTime ? Math.max(0, pick.cost.buildTime) * 1000 : 0;
      queueWait += btMs;
    }
    return plan;
  }
  function abPlanVerdictLabel(afford) {
    if (!afford) return '?';
    if (afford.ok) return 'ok';
    if (afford.blind) return 'blind';
    if (afford.detail) return 'short ' + afford.detail;
    return 'short';
  }
  function abPlanCostLabel(cost) {
    if (!cost) return '?';
    const parts = [];
    if (cost.wood) parts.push('w' + cost.wood);
    if (cost.stone) parts.push('s' + cost.stone);
    if (cost.iron) parts.push('i' + cost.iron);
    if (cost.pop) parts.push('pop' + cost.pop);
    return parts.length ? parts.join('/') : '0';
  }
  function renderAbPlan() {
    const sec = panel && panel.querySelector('section[data-tab=build]');
    if (!sec || sec.hidden) return;
    const box = sec.querySelector('.ab-plan');
    if (!box) return;
    const townId = abCurrentTownId() || (abTownIds()[0]);
    if (!townId) {
      box.replaceChildren();
      const e = document.createElement('div');
      e.style.cssText = 'color:#888;font-size:10px;padding:2px 0';
      e.textContent = 'no town';
      box.appendChild(e);
      return;
    }
    const plan = buildPlanNext(townId, 3);
    const pin = abGetPin(townId);
    const wantKeys = plan.map((p, i) => `ab-plan-${townId}-${i}`);
    const sameSet = box.querySelectorAll('.ab-plan-row[data-key]').length === wantKeys.length
      && wantKeys.every(k => box.querySelector(`.ab-plan-row[data-key="${k}"]`));
    if (!sameSet) box.replaceChildren();
    if (!plan.length) {
      if (!sameSet) {
        const e = document.createElement('div');
        e.style.cssText = 'color:#888;font-size:10px;padding:2px 0';
        e.textContent = 'all targets met';
        box.appendChild(e);
      }
      return;
    }
    const mk = (cls, txt, color) => {
      const s = document.createElement('span');
      if (cls) s.className = cls;
      s.textContent = txt;
      if (color) s.style.color = color;
      return s;
    };
    plan.forEach((p, i) => {
      const key = wantKeys[i];
      let row = sameSet ? box.querySelector(`.ab-plan-row[data-key="${key}"]`) : null;
      if (!row) {
        row = document.createElement('div');
        row.className = 'ab-plan-row' + (p.custom ? ' custom' : (p.pinned ? ' pinned' : ''));
        row.dataset.key = key;
        row.appendChild(mk('ab-plan-name', '', null));
        row.appendChild(mk('ab-plan-lvl', '', '#888'));
        row.appendChild(mk('ab-plan-cost', '', '#aaa'));
        row.appendChild(mk('ab-plan-verdict', '', null));
        row.appendChild(mk('ab-plan-eta', '', '#888'));
        const pinBtn = document.createElement('button');
        pinBtn.type = 'button';
        pinBtn.style.cssText = 'background:#333;border:1px solid #555;color:#fc6;padding:0 4px;cursor:pointer;font-size:9px';
        pinBtn.addEventListener('click', () => {
          abSetPin(townId, abGetPin(townId) === p.building ? null : p.building);
          renderAbPlan();
          renderAbQueue();
        });
        row.appendChild(pinBtn);
        box.appendChild(row);
      } else {
        row.className = 'ab-plan-row' + (p.custom ? ' custom' : (p.pinned || pin === p.building ? ' pinned' : ''));
      }
      row.querySelector('.ab-plan-name').textContent = AB_LABELS[p.building] || p.building;
      row.querySelector('.ab-plan-lvl').textContent = '->' + p.level;
      row.querySelector('.ab-plan-cost').textContent = abPlanCostLabel(p.cost);
      const verdictEl = row.querySelector('.ab-plan-verdict');
      const verdict = abPlanVerdictLabel(p.afford);
      verdictEl.textContent = verdict;
      verdictEl.style.color = p.afford && p.afford.ok ? '#6dda7e' : (p.afford && p.afford.blind ? '#fc6' : '#f08080');
      row.querySelector('.ab-plan-eta').textContent = p.etaMs ? fmtSec(Math.ceil(p.etaMs / 1000)) : 'now';
      const pinBtn = row.querySelector('button');
      if (pinBtn) {
        pinBtn.textContent = (pin === p.building) ? 'unpin' : 'pin';
        pinBtn.title = 'Pin to slot 1 (world-scoped, per town)';
      }
    });
  }

  function renderCqRows() {
    const sec = panel && panel.querySelector('section[data-tab=build]');
    if (!sec || sec.hidden) return;
    const box = sec.querySelector('.cq-rows');
    if (!box) return;
    const townId = abCurrentTownId() || abTownIds()[0];
    const label = sec.querySelector('#gb-cq-town');
    if (label) label.textContent = townId ? `town ${townId}` : 'no town';
    const strict = sec.querySelector('#gb-cq-strict');
    if (strict) strict.checked = state.abQueueStrict !== false;
    const pick = sec.querySelector('#gb-cq-b');
    const levels = townId ? abCurrentLevels(townId) : null;
    if (pick && !pick.options.length) {
      AB_BUILDINGS.forEach(b => {
        const o = document.createElement('option');
        o.value = b;
        o.textContent = AB_LABELS[b] || b;
        pick.appendChild(o);
      });
    }
    const lvlEl = sec.querySelector('#gb-cq-lvl');
    if (lvlEl && pick && document.activeElement !== lvlEl) {
      const cur = levels ? (levels[pick.value] || 0) : 0;
      lvlEl.value = String(Math.min(abMaxLevel(pick.value), cur + 1));
    }
    box.replaceChildren();
    const list = townId ? abCqGet(townId) : [];
    if (!list.length) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#888;font-size:10px;padding:2px 0';
      e.textContent = 'no custom queue - heuristic plan is used';
      box.appendChild(e);
      return;
    }
    const sim = Object.assign({}, levels || {});
    list.forEach((entry, i) => {
      const want = abCqWantLevel(entry, sim);
      sim[entry.b] = want;
      const row = document.createElement('div');
      row.className = 'cq-row';
      row.dataset.key = `cq-${townId}-${i}`;
      const idx = document.createElement('span');
      idx.textContent = String(i + 1) + '.';
      idx.style.color = '#666';
      const name = document.createElement('span');
      name.textContent = AB_LABELS[entry.b] || entry.b;
      name.style.color = '#aaa';
      const lvl = document.createElement('span');
      lvl.textContent = '->' + want;
      lvl.style.color = '#cfc';
      const cur = document.createElement('span');
      cur.textContent = levels ? String(levels[entry.b] != null ? levels[entry.b] : '?') : '?';
      cur.style.color = '#888';
      const btns = document.createElement('span');
      btns.style.cssText = 'display:flex;gap:2px';
      const mk = (txt, title, fn) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = txt;
        b.title = title;
        b.style.cssText = 'background:#333;border:1px solid #555;color:#eee;padding:0 4px;cursor:pointer;font-size:10px';
        b.addEventListener('click', () => { fn(); renderCqRows(); renderAbPlan(); });
        return b;
      };
      btns.appendChild(mk('^', 'move up', () => abCqMove(townId, i, -1)));
      btns.appendChild(mk('v', 'move down', () => abCqMove(townId, i, 1)));
      btns.appendChild(mk('x', 'remove', () => abCqRemove(townId, i)));
      row.appendChild(idx);
      row.appendChild(name);
      row.appendChild(cur);
      row.appendChild(lvl);
      row.appendChild(btns);
      box.appendChild(row);
    });
  }

  function abDefaultTargets() {
    return Object.assign({}, AB_CS_FAST);
  }
  function abEnsureTargets() {
    if (!state.abTargets || typeof state.abTargets !== 'object') {
      state.abTargets = abDefaultTargets();
      save(STORE.AB_TARGETS, state.abTargets);
    }
    AB_BUILDINGS.forEach(b => {
      if (state.abTargets[b] == null) state.abTargets[b] = AB_CS_FAST[b] || 0;
    });
    return state.abTargets;
  }
  function abMaxLevel(building) {
    try {
      const uw = gameUw();
      const d = uw.GameData && uw.GameData.buildings && uw.GameData.buildings[building];
      return d && d.max_level != null ? +d.max_level : 40;
    } catch (_) { return 40; }
  }
  function abMinLevel(building) {
    try {
      const uw = gameUw();
      const d = uw.GameData && uw.GameData.buildings && uw.GameData.buildings[building];
      return d && d.min_level != null ? +d.min_level : 0;
    } catch (_) { return 0; }
  }
  function abClampTarget(building, lvl) {
    const lo = abMinLevel(building);
    const hi = abMaxLevel(building);
    return Math.min(hi, Math.max(lo, Math.floor(+lvl || 0)));
  }
  function abSetTarget(building, lvl) {
    abEnsureTargets();
    state.abTargets[building] = abClampTarget(building, lvl);
    save(STORE.AB_TARGETS, state.abTargets);
  }
  function abLoadCsFast() {
    state.abTargets = abDefaultTargets();
    save(STORE.AB_TARGETS, state.abTargets);
    gbLog('auto-queue: loaded CS-fast targets');
    renderAbQueue();
  }
  function abGetTown(townId) {
    const uw = gameUw();
    try {
      return uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]);
    } catch (_) { return null; }
  }
  function abCurrentLevels(townId) {
    const t = abGetTown(townId);
    if (!t) return null;
    let attrs = null;
    try {
      const b = t.getBuildings ? t.getBuildings() : (t.buildings && t.buildings());
      attrs = b && (b.attributes || b);
    } catch (_) {}
    if (!attrs) return null;
    const levels = {};
    AB_BUILDINGS.forEach(id => { levels[id] = +(attrs[id] || 0); });

    try {
      const orders = t.buildingOrders ? t.buildingOrders() : null;
      const models = (orders && orders.models) || [];
      models.forEach(m => {
        const a = m.attributes || m;
        const type = a.building_type;
        if (!type || levels[type] == null) return;
        if (a.tear_down) levels[type] -= 1;
        else levels[type] += 1;
      });
    } catch (_) {}
    return levels;
  }
  function abQueueMax() {
    try {
      const uw = gameUw();
      if (uw.GameDataPremium && uw.GameDataPremium.isAdvisorActivated && uw.GameDataPremium.isAdvisorActivated('curator')) return 7;
      if (uw.GameDataConstructionQueue && uw.GameDataConstructionQueue.getBuildingOrdersQueueLength) {
        return uw.GameDataConstructionQueue.getBuildingOrdersQueueLength() || 2;
      }
    } catch (_) {}
    return 2;
  }
  function abQueueInfo(townId) {
    const t = abGetTown(townId);
    const max = abQueueMax();
    if (!t) return { len: 0, max, orders: [] };
    let models = [];
    try {
      const orders = t.buildingOrders ? t.buildingOrders() : null;
      models = (orders && orders.models) || [];
    } catch (_) {}
    const list = models.map(m => {
      const a = m.attributes || m;
      return {
        id: a.id,
        building_type: a.building_type,
        building_time: +(a.building_time || 0),
        to_be_completed_at: +(a.to_be_completed_at || 0),
        tear_down: !!a.tear_down,
      };
    });
    return { len: list.length, max, orders: list };
  }
  function abQueueFull(townId) {
    const q = abQueueInfo(townId);
    return q.len >= q.max;
  }
  function abDelayFromOrder(order) {

    const btSec = Math.max(0, +(order && order.building_time) || 0);
    return Math.floor(btSec / 2) * 1000 + AB_EXTRA_MS + abRandMs();
  }
  function abArmDeadline(townId, order, why) {
    const wait = abDelayFromOrder(order);
    state.abNextAt[townId] = Date.now() + wait;
    save(STORE.AB_NEXT, state.abNextAt);
    gbLog(`auto-queue: town ${townId} next fill in ${fmtSec(wait / 1000)} (${why || 'armed'}, half-build+5m+rand)`);
  }
  function abClearDeadline(townId) {
    if (state.abNextAt[townId] == null) return;
    delete state.abNextAt[townId];
    save(STORE.AB_NEXT, state.abNextAt);
  }
  function abBuildingCost(townId, building) {
    try {
      const uw = gameUw();
      let bbd = uw.MM && uw.MM.getModels && uw.MM.getModels().BuildingBuildData;
      if (!bbd) bbd = uw.MM && uw.MM.getModels && (uw.MM.getModels().BuildData || uw.MM.getModels().BuildingBuilder);
      const data = bbd && (bbd[townId] || bbd[String(townId)]);
      const bd = data && data.attributes && data.attributes.building_data && data.attributes.building_data[building];
      if (!bd) return null;
      const need = bd.resources_for;
      if (!need || need.wood == null || need.stone == null || need.iron == null) return null;
      return {
        wood: +need.wood || 0,
        stone: +need.stone || 0,
        iron: +need.iron || 0,
        pop: bd.population_for != null ? +bd.population_for : 0,
        buildTime: bd.building_time != null ? +bd.building_time : null,
      };
    } catch (_) { return null; }
  }
  function abCanAfford(townId, building, ledger) {
    const t = abGetTown(townId);
    if (!t) return false;
    let res = ledger;
    if (!res) {
      try { res = t.resources(); } catch (_) { return false; }
    }
    if (!res) return false;
    const need = abBuildingCost(townId, building);
    if (!need) return false;
    if (need.pop > 0) {
      const pop = ledger && ledger.pop != null
        ? ledger.pop
        : (t.getAvailablePopulation ? t.getAvailablePopulation() : (res.population || 0));
      if (pop < need.pop) return false;
    }
    const margin = 10;
    return res.wood >= need.wood + margin && res.stone >= need.stone + margin && res.iron >= need.iron + margin;
  }
  function abPickNextFromLevels(townId, levels, ledger) {
    const plan = buildPlanNext(townId, 1);
    const first = plan[0];
    if (!first) return null;
    const scratch = ledger ? {
      wood: ledger.wood, stone: ledger.stone, iron: ledger.iron, pop: ledger.pop,
      production: abTownProduction(townId),
    } : null;
    const { afford } = scratch
      ? abPlanEntryAfford(townId, first.building, scratch)
      : abPlanEntryAfford(townId, first.building, null);
    if (!afford.ok && !afford.blind) return null;
    return first.building;
  }
  function abPickNext(townId) {
    const plan = buildPlanNext(townId, 1);
    return plan[0] ? plan[0].building : null;
  }
  function abPickBatch(townId, n) {
    if (n <= 0) return [];
    const plan = buildPlanNext(townId, n);
    const out = [];
    for (const entry of plan) {
      if (!entry.afford.ok && !entry.afford.blind) {

        if (state.abQueueStrict !== false) {
          if (entry.custom) {
            gbLogT('ab-cq-wait-' + townId + '-' + entry.building, 120000,
              `auto-queue: town ${townId} waiting for ${AB_LABELS[entry.building] || entry.building} (${abPlanVerdictLabel(entry.afford)})`);
          }
          break;
        }
        gbLogT('ab-cq-skip-' + townId + '-' + entry.building, 120000,
          `auto-queue: town ${townId} skipping ${AB_LABELS[entry.building] || entry.building} (${abPlanVerdictLabel(entry.afford)}, strict off)`);
        continue;
      }
      out.push(entry.building);
    }
    return out;
  }
  function abBuildUp(townId, building) {
    return new Promise(resolve => {
      if (!hostEnabled() || captchaPaused('build')) { resolve('pause'); return; }
      bridgePost('build', {
        model_url: 'BuildingOrder',
        action_name: 'buildUp',
        arguments: { building_id: building },
        town_id: +townId,
      }, (err, data) => {
        if (err === 'captcha' || err === 'captcha-pause') { resolve('captcha'); return; }
        if (err) { gbLog(`auto-queue: ${building} @${townId} fail: ${err}`); resolve('err'); return; }
        gbLog(`auto-queue: ${AB_LABELS[building] || building} +1 in town ${townId}`);
        resolve('ok');
      });
    });
  }
  function abTownIds() {
    const fromGame = townsFromGame();
    if (fromGame && fromGame.length) return fromGame.map(t => t.id);
    return (state.towns || []).map(t => t.id);
  }

  function abScan(reason) {
    if (!hostEnabled() || !state.abAuto || captchaPaused('build') || gbLocked('ab')) return;
    const force = reason === 'manual';
    const ids = abTownIds();
    if (!ids.length) { gbLogT('ab-notowns', 120000, 'auto-queue: no towns'); return; }
    const jobs = [];
    const now = Date.now();
    ids.forEach(id => {
      if (abCqGet(id).length) abCqPrune(id, abCurrentLevels(id));
      const q = abQueueInfo(id);
      if (q.len > 1 && !force) {

        if (state.abNextAt[id] != null) abClearDeadline(id);
        return;
      }
      if (!force && q.len === 1) {
        const due = state.abNextAt[id];
        if (due == null) {
          abArmDeadline(id, q.orders[0], '1 left');
          return;
        }
        if (now < due) {
          gbLogT('ab-wait-' + id, 60000, `auto-queue: town ${id} waiting ${fmtSec((due - now) / 1000)} (1 left)`);
          return;
        }
      }

      const slots = Math.min(AB_FILL_BATCH, Math.max(0, q.max - q.len));
      if (slots <= 0) return;
      const batch = abPickBatch(id, slots);
      batch.forEach(building => jobs.push({ id, building }));
      if (batch.length) abClearDeadline(id);
    });
    if (!jobs.length) {
      gbLogT('ab-idle', 120000, `auto-queue: nothing to build${reason ? ' (' + reason + ')' : ''}`);
      renderAbQueue();
      return;
    }
    gbLock('ab');
    gbLog(`auto-queue${reason ? ' (' + reason + ')' : ''}: ${jobs.length} job(s) (batch<=${AB_FILL_BATCH})`);
    let i = 0, done = 0, captcha = false;
    const unlock = () => { gbUnlock('ab'); };
    const watchdog = gbTimeout(unlock, Math.max(30000, jobs.length * (BRIDGE_TIMEOUT_MS + 1000)));
    (function next() {
      if (i >= jobs.length || captcha) {
        try { clearTimeout(watchdog); } catch (_) {}
        unlock();
        if (done) flash(`auto-queue x${done}`);

        abTownIds().forEach(tid => {
          const q = abQueueInfo(tid);
          if (q.len === 1 && state.abNextAt[tid] == null) {
            abArmDeadline(tid, q.orders[0], 'post-fill');
          }
        });
        renderAbQueue();
        gbTimeout(ibScan, 2000);
        return;
      }
      const job = jobs[i++];
      abBuildUp(job.id, job.building).then(res => {
        if (res === 'ok') done++;
        if (res === 'captcha') captcha = true;
        gbTimeout(next, 1100 + Math.random() * 400);
      });
    })();
  }
  function abCurrentTownId() {
    try {
      const uw = gameUw();
      return uw.Game && uw.Game.townId;
    } catch (_) { return null; }
  }
  function renderAbQueue() {
    const sec = panel && panel.querySelector('section[data-tab=build]');
    if (!sec || sec.hidden) return;
    const box = sec.querySelector('.ab-queue');
    const status = sec.querySelector('#gb-ab-status');
    if (!box) return;
    abEnsureTargets();
    const townId = abCurrentTownId() || (abTownIds()[0]);
    const levels = townId ? abCurrentLevels(townId) : null;
    if (townId) abCqPrune(townId, levels);
    renderCqRows();
    box.replaceChildren();
    const head = document.createElement('div');
    head.style.cssText = 'display:grid;grid-template-columns:1.2fr .5fr .5fr .5fr auto;gap:4px;font-size:9px;color:#888;margin-bottom:2px';
    ['building', 'cur', 'tgt', 'max', ''].forEach(t => {
      const s = document.createElement('span'); s.textContent = t; head.appendChild(s);
    });
    box.appendChild(head);
    AB_BUILDINGS.forEach(b => {
      const row = document.createElement('div');
      row.className = 'ab-row';
      row.style.cssText = 'display:grid;grid-template-columns:1.2fr .5fr .5fr .5fr auto;gap:4px;align-items:center;padding:1px 0;border-bottom:1px solid #2a2a2a;font-size:10px';
      const name = document.createElement('span');
      name.textContent = AB_LABELS[b] || b;
      name.style.color = '#aaa';
      const cur = document.createElement('span');
      const curLvl = levels ? levels[b] : '?';
      cur.textContent = String(curLvl);
      const tgt = state.abTargets[b] || 0;
      const max = abMaxLevel(b);
      if (levels && curLvl >= tgt) cur.style.color = '#6dda7e';
      else if (levels && curLvl < tgt) cur.style.color = '#f0c060';
      const tgtEl = document.createElement('input');
      tgtEl.type = 'number';
      tgtEl.min = String(abMinLevel(b));
      tgtEl.max = String(max);
      tgtEl.value = String(tgt);
      tgtEl.style.cssText = 'width:42px;background:#111;color:#cfc;border:1px solid #333;font:10px monospace';
      tgtEl.addEventListener('change', () => {
        abSetTarget(b, +tgtEl.value);
        renderAbQueue();
      });
      const maxEl = document.createElement('span');
      maxEl.textContent = String(max);
      maxEl.style.color = '#666';
      const btns = document.createElement('span');
      btns.style.cssText = 'display:flex;gap:2px';
      const mkBtn = (txt, fn) => {
        const b2 = document.createElement('button');
        b2.textContent = txt;
        b2.style.cssText = 'background:#333;border:1px solid #555;color:#eee;padding:0 4px;cursor:pointer;font-size:10px';
        b2.addEventListener('click', fn);
        return b2;
      };
      btns.appendChild(mkBtn('-', () => { abSetTarget(b, (state.abTargets[b] || 0) - 1); renderAbQueue(); }));
      btns.appendChild(mkBtn('+', () => { abSetTarget(b, (state.abTargets[b] || 0) + 1); renderAbQueue(); }));
      btns.appendChild(mkBtn('max', () => { abSetTarget(b, max); renderAbQueue(); }));
      row.appendChild(name);
      row.appendChild(cur);
      row.appendChild(tgtEl);
      row.appendChild(maxEl);
      row.appendChild(btns);
      box.appendChild(row);
    });
    if (status) {
      const q = townId ? abQueueInfo(townId) : null;
      const due = townId && state.abNextAt[townId];
      const next = townId && q && q.len <= 1 ? abPickNext(townId) : null;
      let waitTxt = '';
      if (due && Date.now() < due) waitTxt = `  |  refill in ${fmtSec((due - Date.now()) / 1000)}`;
      else if (q && q.len > 1) waitTxt = `  |  wait until 1 left (${q.len}/${q.max})`;
      status.textContent = (gbLocked('ab') ? 'queueing... ' : '')
        + (townId ? `town ${townId}` : 'no town')
        + (q ? `  |  queue ${q.len}/${q.max}` : '')
        + (next ? `  |  next: ${AB_LABELS[next] || next}` : '  |  idle')
        + waitTxt
        + (state.abAuto ? '  |  AUTO' : '  |  off');
    }
  }

  function checkThresholds() {
    let changed = false;
    for (const f of state.farmsParsed) {
      const r = state.farmResources[f.vill_id];
      const t = state.thresholds[f.vill_id];
      if (!r || !r.ok || !t) continue;
      const fields = ['wood','stone','iron','pop'];
      const hits = fields.filter(k => t[k] != null && r[k] != null && r[k] >= t[k]);
      const key = hits.sort().join(',') || 'none';
      const prev = state.alerted[f.vill_id];
      if (!prev || prev.key !== key) {
        if (hits.length) flash(`WARN farm ${f.vill_id} ${hits.join('+')} >= threshold`);
        state.alerted[f.vill_id] = { key, ts: Date.now() };
        changed = true;
      }
    }
    if (changed) { save(STORE.ALERTED, state.alerted); renderFarms(); }
  }

  const CAVE_MIN_STORE = 100;

  function caveTownEnabled(townId) {
    const id = String(townId);
    const map = state.caveTowns || {};

    return map[id] !== false;
  }
  function setCaveTownEnabled(townId, on) {
    const id = String(townId);
    if (!state.caveTowns) state.caveTowns = {};
    state.caveTowns[id] = !!on;
    save(STORE.CAVE_TOWNS, state.caveTowns);
  }

  const CAVE_CAP_FNS = ['getHideStorageCapacity', 'getEspionageStorageCapacity', 'getHideCapacity',
    'getMaxEspionageStorage', 'getEspionageStoreCapacity'];
  const CAVE_STORED_FNS = ['getEspionageStorage', 'getHideStorage', 'getEspionageStore',
    'getStoredIron', 'getHideIron'];

  function caveUnlimSentinel() {
    try {
      const gdb = uwCached().GameDataBuildings;
      if (gdb && typeof gdb.getHideStorageLevelUnlimited === 'function') {
        const v = +gdb.getHideStorageLevelUnlimited();
        if (isFinite(v)) return v;
      }
    } catch (_) {}
    return -1;
  }
  function cavePerLevelLimit() {
    try {
      const gdb = uwCached().GameDataBuildings;
      if (gdb && typeof gdb.getMaxStorageLimitPerHideLevel === 'function') {
        const v = +gdb.getMaxStorageLimitPerHideLevel();
        if (isFinite(v) && v > 0) return v;
      }
    } catch (_) {}
    return null;
  }

  function caveTownInfo(townId) {
    const uw = uwCached();
    let t = null;
    try {
      t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]);
    } catch (_) {}
    if (!t) return null;
    let hideLvl = 0;
    try {
      if (t.getBuildings) hideLvl = +t.getBuildings().get('hide') || 0;
      else if (t.buildings) hideLvl = +(t.buildings().attributes || {}).hide || 0;
    } catch (_) {}
    let iron = null, cap = null, resStorage = null;
    try {
      const r = t.resources && t.resources();
      if (r && r.iron != null) iron = +r.iron;
      if (r && r.storage != null) resStorage = +r.storage;
    } catch (_) {}

    const shared = townResState(townId);
    if (shared) {
      cap = shared.cap;
      if (iron == null) iron = shared.iron;
    }
    if (!(cap > 0)) cap = gbProbeNum(t, ['getStorageCapacity', 'getStorage', 'getResourceCapacity']);
    if (!(cap > 0)) cap = gbProbeNum(t.storage, ['getCapacity']);

    if (!(cap > 0) && resStorage > 100) cap = resStorage;
    if (!(cap > 0)) cap = null;

    let hideCap = null, stored = null, unlimited = false;
    hideCap = gbProbeNum(t, CAVE_CAP_FNS);
    if (hideCap == null) hideCap = gbProbeAttr(t, ['hide_capacity', 'espionage_storage_capacity']);
    stored = gbProbeNum(t, CAVE_STORED_FNS);
    if (stored == null) stored = gbProbeAttr(t, ['espionage_storage', 'hide_storage', 'stored_iron']);
    try {

      const hb = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('BuildingHide');
      const hm = hb && hb.models && hb.models.filter(m => String((m.attributes || {}).town_id) === String(townId))[0];
      if (hm) {
        if (hideCap == null) hideCap = gbProbeNum(hm, CAVE_CAP_FNS) ?? gbProbeAttr(hm, ['capacity', 'max_storage']);
        if (stored == null) stored = gbProbeNum(hm, CAVE_STORED_FNS) ?? gbProbeAttr(hm, ['storage', 'iron', 'stored_iron']);
      }
    } catch (_) {}
    try {
      const gdb = uw.GameDataBuildings;
      const gd = uw.GameData && uw.GameData.buildings && uw.GameData.buildings.hide;
      const maxHide = gd && gd.max_level;
      if (maxHide != null && hideLvl >= +maxHide) unlimited = true;

      const unlim = caveUnlimSentinel();
      if (hideCap != null && (hideCap === unlim || hideCap < 0)) unlimited = true;

      if (!unlimited && !(hideCap > 0) && hideLvl > 0) {
        const per = cavePerLevelLimit();
        if (per > 0) hideCap = hideLvl * per;
      }
      if (!unlimited && !(hideCap > 0) && gd && gd.storage != null) {
        const s = gd.storage;
        const v = +(Array.isArray(s) || typeof s === 'object' ? s[hideLvl] : s);
        if (isFinite(v) && v > 0) hideCap = v;
      }

      if (!unlimited && !(hideCap > 0) && gdb) {
        hideCap = gbProbeNum(gdb, ['getHideStorageCapacity'], [hideLvl]);
      }
    } catch (_) {}
    if (unlimited) hideCap = null;
    return { town: t, hideLvl, iron, cap, hideCap, stored, unlimited };
  }

  function caveDiag(townId) {
    const uw = uwCached();
    const id = townId != null ? townId : (caveListTownIds()[0]);
    let t = null;
    try {
      t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(id) : uw.ITowns.towns[id]);
    } catch (_) {}
    if (!t) { gbLog('cave diag: no town model'); return null; }
    const keys = new Set();
    for (let o = t; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
      Object.getOwnPropertyNames(o).forEach(k => keys.add(k));
    }
    const hits = [...keys].filter(k => /hide|espio|storage|capacit/i.test(k)).sort();
    const attrs = Object.keys(t.attributes || {}).filter(k => /hide|espio|storage|capacit|iron/i.test(k)).sort();
    const info = caveTownInfo(id);
    gbLog(`cave diag town ${id}: methods/props [${hits.join(', ')}]`);
    gbLog(`cave diag town ${id}: attrs [${attrs.join(', ')}]`);
    gbLog(`cave diag town ${id}: hide${info && info.hideLvl} iron=${info && info.iron} cap=${info && info.cap} hideCap=${info && info.hideCap} stored=${info && info.stored} unlimited=${info && info.unlimited}`);
    return { keys: hits, attrs, info };
  }

  function caveExcessAmount(info) {
    if (!info || !(info.cap > 0) || info.iron == null) return 0;
    if (!(info.hideLvl > 0)) return 0;
    const pct = Math.min(99, Math.max(50, +state.caveThreshPct || 90));
    const keep = Math.floor(info.cap * (pct / 100));
    if (info.iron < keep) return 0;
    let excess = Math.floor(info.iron - keep);
    if (excess < CAVE_MIN_STORE) return 0;

    if (!info.unlimited) {
      if (!(info.hideCap > 0) || info.stored == null) return 0;
      const free = Math.floor(info.hideCap - info.stored);
      if (free <= 0) return 0;
      excess = Math.min(excess, free);
    }
    return excess >= CAVE_MIN_STORE ? excess : 0;
  }

  function caveStoreIron(townId, amount, onDone) {
    bridgePost('cave', {
      model_url: 'BuildingHide',
      action_name: 'storeIron',
      arguments: { iron_to_store: +amount },
      town_id: +townId,
    }, onDone);
  }

  function caveListTownIds() {
    const ids = [];
    const seen = new Set();
    try {
      const fromGame = townsFromGame();
      if (fromGame) {
        fromGame.forEach(t => {
          const id = String(t.id);
          if (!seen.has(id)) { seen.add(id); ids.push(id); }
        });
      }
    } catch (_) {}
    try {
      const uw = uwCached();
      const towns = uw.ITowns && uw.ITowns.towns;
      if (towns) {
        Object.keys(towns).forEach(id => {
          if (!seen.has(String(id))) { seen.add(String(id)); ids.push(String(id)); }
        });
      }
    } catch (_) {}
    return ids;
  }

  function caveScan(reason) {
    if (!hostEnabled() || !state.autoCave || captchaPaused('cave')) return;
    if (gbLocked('cave')) { gbLogT('cave-inflight', 30000, 'cave: skipped (in flight)'); return; }
    if (!gameBridgeReady()) { gbLogT('cave-nobridge', 60000, 'cave: bridge not ready'); return; }
    const ids = caveListTownIds();
    if (!ids.length) { gbLogT('cave-notowns', 120000, 'cave: no towns'); return; }
    const jobs = [];
    for (const id of ids) {
      if (!caveTownEnabled(id)) continue;
      const info = caveTownInfo(id);
      if (!info) continue;
      if (!(info.hideLvl > 0)) {
        gbLogT('cave-nohide-' + id, 300000, `cave: town ${id} has no hide building`);
        continue;
      }
      if (!info.unlimited && info.hideCap > 0 && info.stored != null && info.stored >= info.hideCap) {
        gbLogT('cave-full-' + id, 120000, `cave: town ${id} hide full (${info.stored}/${info.hideCap})`);
        continue;
      }
      if (!info.unlimited && (!(info.hideCap > 0) || info.stored == null)) {
        gbLogT('cave-unknown-' + id, 300000,
          `cave: town ${id} skip stash (hideCap=${info.hideCap} stored=${info.stored}) - open cave once or run caveDiag()`);
        continue;
      }
      const amt = caveExcessAmount(info);
      if (!amt) continue;
      jobs.push({ id, amt, iron: info.iron, cap: info.cap });
    }
    if (!jobs.length) {
      gbLogT('cave-idle', 120000, `cave: nothing to stash (${reason || 'scan'})`);
      return;
    }
    gbLock('cave');
    let i = 0, done = 0, captcha = false;
    (function next() {
      if (i >= jobs.length || captcha) {
        gbUnlock('cave');
        if (done) gbLog(`cave: stashed ${done}/${jobs.length} town(s)${captcha ? ' (captcha abort)' : ''}`);
        renderCaveTowns();
        return;
      }
      const job = jobs[i++];
      caveStoreIron(job.id, job.amt, (err) => {
        if (err === 'captcha' || err === 'captcha-pause') {
          captcha = true;
          i = jobs.length;
        } else if (!err) {
          done++;
          gbLogT('cave-ok-' + job.id, 30000, `cave: town ${job.id} stored ${job.amt} iron (was ${job.iron}/${job.cap})`);
        } else {
          gbLogT('cave-err-' + job.id, 60000, `cave: town ${job.id} err ${err}`);
        }
        gbTimeout(next, 500 + Math.random() * 400);
      });
    })();
  }

  function renderCaveTowns() {
    const box = panel && panel.querySelector('.cave-towns');
    if (!box) return;
    const ids = caveListTownIds();
    box.replaceChildren();
    if (!ids.length) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#888;font-size:10px';
      e.textContent = 'no towns loaded yet';
      box.appendChild(e);
      return;
    }
    const uw = uwCached();
    const nameById = Object.create(null);
    try {
      (townsFromGame() || []).forEach(t => { if (t.id != null && t.name) nameById[String(t.id)] = t.name; });
    } catch (_) {}
    ids.forEach(id => {
      let name = nameById[String(id)] || id;
      if (name === id) {
        try {
          const t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(id) : uw.ITowns.towns[id]);
          if (t && t.getName) name = t.getName();
          else if (t && t.name) name = t.name;
        } catch (_) {}
      }
      const info = caveTownInfo(id);
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:10px;margin-left:12px';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = caveTownEnabled(id);
      chk.addEventListener('change', () => {
        setCaveTownEnabled(id, chk.checked);
        gbLog(`cave town ${id}`, chk.checked ? 'ON' : 'OFF');
      });
      const span = document.createElement('span');
      let extra = '';
      if (info) {
        const pct = info.cap > 0 && info.iron != null ? Math.round(100 * info.iron / info.cap) : '?';
        const cave = info.unlimited ? 'inf'
          : (info.stored != null && info.hideCap != null ? `${info.stored}/${info.hideCap}`
            : (info.hideCap != null ? `?/${info.hideCap}` : 'n/a'));
        extra = ` - hide${info.hideLvl} iron ${pct}% cave ${cave}`;
        if (pct === '?' || (!info.unlimited && info.hideCap == null)) {
          gbLogT('cave-unknown-' + id, 300000,
            `cave: town ${id} unread fields (iron=${info.iron} cap=${info.cap} hideCap=${info.hideCap} stored=${info.stored}) - run caveDiag()`);
        }
      }
      span.textContent = `${name} (#${id})${extra}`;
      label.appendChild(chk);
      label.appendChild(span);
      box.appendChild(label);
    });
  }

  const CULTURE_CHECK_MS = 90000;
  const CULTURE_COSTS = {
    party: { wood: 15000, stone: 18000, iron: 15000, academy: 30 },
    triumph: { killpoints: 300 },
    theater: { wood: 10000, stone: 12000, iron: 10000, theater: 1, academy: 30 },
    olympic: { gold: 50, academy: 30 },
  };
  const OLYMPIC_GOLD = 50;
  let cultureLast = null;

  function cultureServerDay() {
    try {
      const now = gameNow();
      const d = new Date(now * 1000);
      return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
    } catch (_) {
      return new Date().toISOString().slice(0, 10);
    }
  }
  function cultureGoldSpentLoad() {
    const day = cultureServerDay();
    const saved = load(wkey(STORE.CULTURE_GOLD_SPENT), null) || load(STORE.CULTURE_GOLD_SPENT, null);
    if (saved && saved.day === day) return { day, amount: +saved.amount || 0 };
    return { day, amount: 0 };
  }
  function cultureGoldSpentSave(spent) {
    save(wkey(STORE.CULTURE_GOLD_SPENT), { day: spent.day, amount: spent.amount });
  }

  function culturePlayerGold() { return gbPlayerGold(); }
  function cultureBusyTowns(type) {
    const uw = gameUw();
    const out = new Set();
    try {
      const models = uw.MM && uw.MM.getModels && uw.MM.getModels().Celebration;
      if (!models) return out;
      Object.values(models).forEach(c => {
        const a = (c && c.attributes) || {};
        if (a.celebration_type === type && a.town_id != null) out.add(+a.town_id);
      });
    } catch (_) {}
    return out;
  }
  function cultureKillpointsAvailable() {
    try {
      const uw = gameUw();
      const kp = uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('PlayerKillpoints');
      if (!kp || !kp.attributes) return 0;
      const a = kp.attributes;
      return (+a.att || 0) + (+a.def || 0) - (+a.used || 0);
    } catch (_) { return 0; }
  }
  function cultureCanAfford(townId, type, ledger) {
    const cost = CULTURE_COSTS[type];
    if (!cost) return false;
    if (type === 'olympic') {

      if (!state.allowPremiumCulture) return false;
      const spent = ledger && ledger.goldSpent != null ? ledger.goldSpent : cultureGoldSpentLoad().amount;
      const budget = +state.cultureGoldBudget || 0;
      if (!(budget >= OLYMPIC_GOLD) || spent + OLYMPIC_GOLD > budget) return false;
      const gold = ledger && ledger.playerGold != null ? ledger.playerGold : culturePlayerGold();
      if (gold == null || gold < OLYMPIC_GOLD) return false;
    }
    if (cost.killpoints) {
      const kp = ledger && ledger.killpoints != null ? ledger.killpoints : cultureKillpointsAvailable();
      return kp >= cost.killpoints;
    }
    const uw = gameUw();
    let t = null;
    try { t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]); } catch (_) {}
    if (!t) return false;
    try {
      if (cost.academy) {
        const acad = t.getBuildings ? +t.getBuildings().get('academy') : +(t.buildings().attributes || {}).academy;
        if (!(acad >= cost.academy)) return false;
      }
      if (cost.theater) {
        const th = t.getBuildings ? +t.getBuildings().get('theater') : +(t.buildings().attributes || {}).theater;
        if (!(th >= cost.theater)) return false;
      }
      if (cost.gold) return true;
      const r = (ledger && ledger.res && ledger.res[townId]) || (t.resources && t.resources());
      if (!r) return false;
      if (cost.wood && r.wood < cost.wood) return false;
      if (cost.stone && r.stone < cost.stone) return false;
      if (cost.iron && r.iron < cost.iron) return false;
      return true;
    } catch (_) { return false; }
  }
  function cultureStart(type, townId, onDone) {

    const map = { festival: 'party', procession: 'triumph', theater: 'theater', olympic: 'olympic' };
    const ctype = map[type] || type;
    if (ctype === 'olympic' && !state.allowPremiumCulture) {
      return onDone && onDone('premium-blocked');
    }
    gameAjaxPost('culture', 'building_place', 'start_celebration', {
      celebration_type: ctype,
      town_id: +townId,
    }, onDone);
  }
  function cultureScan(reason) {
    if (!hostEnabled() || !state.autoCulture || captchaPaused('culture')) return;
    if (automationPaused({})) return;
    if (gbLocked('culture')) return;
    const types = state.cultureTypes || {};

    const enabled = Object.keys(types).filter(k => {
      if (!types[k]) return false;
      if (k === 'olympic' && !state.allowPremiumCulture) {
        gbLogT('culture-olympic-block', 300000, 'culture: olympic ignored (allowPremiumCulture OFF)');
        return false;
      }
      return true;
    });
    if (!enabled.length) return;
    const ids = (typeof caveListTownIds === 'function') ? caveListTownIds() : [];
    if (!ids.length) {
      try {
        const uw = gameUw();
        Object.keys((uw.ITowns && uw.ITowns.towns) || {}).forEach(id => ids.push(String(id)));
      } catch (_) {}
    }

    const spentState = cultureGoldSpentLoad();
    const ledger = {
      killpoints: cultureKillpointsAvailable(),
      goldSpent: spentState.amount,
      playerGold: culturePlayerGold(),
      res: {},
    };
    try {
      const uw = gameUw();
      ids.forEach(id => {
        const t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(id) : uw.ITowns.towns[id]);
        if (t && t.resources) ledger.res[id] = Object.assign({}, t.resources());
      });
    } catch (_) {}
    const jobs = [];
    const townHasJob = new Set();
    for (const type of enabled) {
      const ctype = ({ festival: 'party', procession: 'triumph', theater: 'theater', olympic: 'olympic' })[type] || type;
      const busy = cultureBusyTowns(ctype);
      for (const id of ids) {
        if (busy.has(+id)) continue;
        if (townHasJob.has(String(id))) continue;
        if (cultureShouldDeferForCave(id)) continue;
        if (!cultureCanAfford(id, ctype, ledger)) continue;
        jobs.push({ type, ctype, id });
        townHasJob.add(String(id));

        const cost = CULTURE_COSTS[ctype];
        if (cost) {
          if (cost.killpoints) ledger.killpoints -= cost.killpoints;
          if (cost.gold) {
            ledger.goldSpent += cost.gold;
            if (ledger.playerGold != null) ledger.playerGold -= cost.gold;
          }
          if (ledger.res[id] && (cost.wood || cost.stone || cost.iron)) {
            ledger.res[id].wood -= cost.wood || 0;
            ledger.res[id].stone -= cost.stone || 0;
            ledger.res[id].iron -= cost.iron || 0;
          }
        }
        if (jobs.length >= 8) break;
      }
      if (jobs.length >= 8) break;
    }
    if (!jobs.length) {
      gbLogT('culture-idle', 180000, `culture: nothing to start (${reason || 'scan'})`);
      return;
    }
    gbLock('culture');
    let i = 0, done = 0;
    (function next() {
      if (i >= jobs.length) {
        gbUnlock('culture');
        if (done) gbLog(`culture: started ${done}/${jobs.length}`);
        return;
      }
      const job = jobs[i++];

      if (!cultureCanAfford(job.id, job.ctype)) {
        gbTimeout(next, 200);
        return;
      }
      cultureStart(job.type, job.id, (err) => {
        if (err === 'captcha' || err === 'captcha-pause') { gbUnlock('culture'); return; }
        if (err === 'timeout') {
          gbLogT('culture-timeout', 60000, `culture: ${job.type} ${job.id} timeout_unknown - stopping batch`);
          gbUnlock('culture');
          return;
        }
        if (!err) {
          done++;
          cultureLast = { type: job.type, townId: job.id, ts: Date.now() };
          gbLog(`culture: ${job.type} town ${job.id}`);
          if (job.ctype === 'olympic') {
            const s = cultureGoldSpentLoad();
            s.amount += OLYMPIC_GOLD;
            cultureGoldSpentSave(s);
          }
          try { if (typeof alertWebhook === 'function') alertWebhook('culture', cultureLast); } catch (_) {}
          gbTimeout(next, 600 + Math.random() * 400);
        } else {
          gbLogT('culture-err-' + job.id, 60000, `culture: ${job.type} ${job.id} err ${err}`);

          gbUnlock('culture');
        }
      });
    })();
  }

  function tradeTownRes(townId) {
    const uw = gameUw();
    try {
      const t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]);
      if (!t) return null;
      const r = t.resources && t.resources();
      let cap = null, tradeCap = null, pop = null, small = false;
      let island = null, ix = null, iy = null;
      try { if (t.getStorageCapacity) cap = +t.getStorageCapacity(); } catch (_) {}
      if (!(cap > 0)) { const shared = townResState(townId); if (shared) cap = shared.cap; }
      try { if (t.getAvailableTradeCapacity) tradeCap = +t.getAvailableTradeCapacity(); } catch (_) {}
      try { if (t.getAvailablePopulation) pop = +t.getAvailablePopulation(); } catch (_) {}
      try {
        const a = t.attributes || (t.get && t.get('on_small_island') != null ? { on_small_island: t.get('on_small_island') } : {});
        small = !!(a.on_small_island || (t.isOnSmallIsland && t.isOnSmallIsland()));
        if (a.island_id != null) island = a.island_id;
        else if (typeof t.getIslandId === 'function') island = t.getIslandId();
        if (a.island_x != null) ix = +a.island_x;
        if (a.island_y != null) iy = +a.island_y;
      } catch (_) {}
      if (island == null || ix == null || iy == null) {
        try {
          const list = state.towns || [];
          const st = list.find(x => String(x.id) === String(townId));
          if (st) {
            if (island == null && st.island != null) island = st.island;
            if (ix == null && st.x != null) ix = +st.x;
            if (iy == null && st.y != null) iy = +st.y;
          }
        } catch (_) {}
      }
      return {
        id: +townId,
        wood: r && +r.wood || 0, stone: r && +r.stone || 0, iron: r && +r.iron || 0,
        cap: cap || 0, tradeCap: tradeCap || 0, pop: pop || 0, small,
        island: island != null ? island : null,
        x: ix, y: iy,
      };
    } catch (_) { return null; }
  }
  function tradeListTowns() {
    const ids = [];
    try {
      const from = townsFromGame && townsFromGame();
      if (from) from.forEach(t => ids.push(String(t.id)));
    } catch (_) {}
    if (!ids.length) {
      try {
        const uw = gameUw();
        Object.keys((uw.ITowns && uw.ITowns.towns) || {}).forEach(id => ids.push(String(id)));
      } catch (_) {}
    }
    return ids.map(tradeTownRes).filter(Boolean);
  }
  function tradeSend(fromId, toId, wood, stone, iron, onDone) {
    gameAjaxPost('trade', 'town_info', 'trade', {
      id: +toId,
      wood: Math.max(0, Math.floor(wood)),
      stone: Math.max(0, Math.floor(stone)),
      iron: Math.max(0, Math.floor(iron)),
      town_id: +fromId,
      nl_init: true,
    }, onDone);
  }

  function tradeLedger(towns) {
    const L = Object.create(null);
    for (const t of towns) {
      L[t.id] = {
        wood: t.wood, stone: t.stone, iron: t.iron,
        cap: t.cap, tradeCap: t.tradeCap, small: t.small,
        island: t.island, x: t.x, y: t.y,
      };
    }
    return L;
  }
  function tradeApplyJob(L, job) {
    const src = L[job.from], tgt = L[job.to];
    if (!src || !tgt) return;
    src.wood -= job.wood; src.stone -= job.stone; src.iron -= job.iron;
    src.tradeCap = Math.max(0, src.tradeCap - (job.wood + job.stone + job.iron));
    tgt.wood += job.wood; tgt.stone += job.stone; tgt.iron += job.iron;
  }

  function tradeIslandDist(a, b) {
    if (!a || !b) return null;
    if (a.island != null && b.island != null) {
      if (String(a.island) === String(b.island)) return 0;
    }
    if (a.x == null || a.y == null || b.x == null || b.y == null) return null;
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function tradeFillStorageJobs(towns, L, opts) {
    const ledger = L || tradeLedger(towns);
    const reserve = Math.min(80, Math.max(0, gbCfgNum(state.tradeReservePct, 20))) / 100;
    const minBatch = Math.max(100, +state.tradeMinBatch || 1000);
    const maxHops = Math.max(0, gbCfgNum(state.tradeMaxHops, 15));
    const urgent = !!(opts && opts.deadlock);
    const byId = Object.create(null);
    towns.forEach(t => { byId[t.id] = t; });
    const jobs = [];
    const ids = towns.map(t => t.id);
    for (const tgtId of ids) {
      const tgt = ledger[tgtId];
      if (!tgt || !(tgt.cap > 0)) continue;
      const empty = Math.min(tgt.wood, tgt.stone, tgt.iron) / tgt.cap;
      if (!urgent && empty >= 0.25) continue;
      const candidates = [];
      for (const srcId of ids) {
        if (srcId === tgtId) continue;
        const src = ledger[srcId];
        if (!src || !(src.cap > 0)) continue;
        const fill = Math.max(src.wood, src.stone, src.iron) / src.cap;
        if (fill <= 0.85 || src.tradeCap < minBatch) continue;
        const srcTown = byId[srcId], tgtTown = byId[tgtId];
        const dist = tradeIslandDist(srcTown || src, tgtTown || tgt);
        if (dist == null) {
          gbLogT('trade-island-blind', 300000, 'trade: island unreadable - allowing hop (blind ≠ refuse)');
        } else if (!urgent && dist > maxHops) {
          gbLogT('trade-hop-' + srcId + '-' + tgtId, 300000,
            `trade: refuse ${srcId}->${tgtId} hops ${dist.toFixed(1)} > max ${maxHops}`);
          continue;
        }
        const keep = Math.floor(src.cap * reserve);
        const send = {
          wood: Math.max(0, Math.min(src.tradeCap, src.wood - keep, tgt.cap - tgt.wood)),
          stone: Math.max(0, Math.min(src.tradeCap, src.stone - keep, tgt.cap - tgt.stone)),
          iron: Math.max(0, Math.min(src.tradeCap, src.iron - keep, tgt.cap - tgt.iron)),
        };
        const total = send.wood + send.stone + send.iron;
        if (total < minBatch) continue;
        let scale = 1;
        if (total > src.tradeCap) scale = src.tradeCap / total;
        const surplus = Math.max(src.wood, src.stone, src.iron) - keep;
        candidates.push({
          from: srcId, to: tgtId,
          wood: Math.floor(send.wood * scale),
          stone: Math.floor(send.stone * scale),
          iron: Math.floor(send.iron * scale),
          dist: dist == null ? 9999 : dist,
          surplus,
        });
      }
      candidates.sort((a, b) => {
        if (a.dist !== b.dist) return a.dist - b.dist;
        return b.surplus - a.surplus;
      });
      for (const c of candidates) {
        if (c.wood + c.stone + c.iron < minBatch) continue;
        const job = { from: c.from, to: c.to, wood: c.wood, stone: c.stone, iron: c.iron };
        jobs.push(job);
        tradeApplyJob(ledger, job);
        if (jobs.length >= 6) return jobs;
        break;
      }
    }
    return jobs;
  }
  function tradeGoalDeficit(townId, preset) {

    if (preset === 'party') {
      if (typeof ironReservedForCave === 'function') {
        const r = ironReservedForCave(townId);
        if (r && r.reserved) {
          gbLogT('trade-party-cave-' + townId, 120000, `trade party: skip town ${townId} - iron reserved for cave`);
          return { wood: 0, stone: 0, iron: 0 };
        }
      }
      const types = state.cultureTypes || {};
      const order = ['festival', 'theater', 'procession'];
      let ctype = null;
      for (const ui of order) {
        if (!types[ui]) continue;
        ctype = ({ festival: 'party', procession: 'triumph', theater: 'theater' })[ui] || ui;
        if (ctype === 'triumph') continue;
        break;
      }
      if (!ctype || !CULTURE_COSTS[ctype]) return { wood: 0, stone: 0, iron: 0 };
      const cost = CULTURE_COSTS[ctype];
      return {
        wood: +cost.wood || 0,
        stone: +cost.stone || 0,
        iron: +cost.iron || 0,
      };
    }
    if (preset === 'unit') {
      const want = (state.recruitTargets || {})[townId] || (state.recruitTargets || {})[String(townId)];
      if (!want || typeof want !== 'object') return { wood: 0, stone: 0, iron: 0 };
      let wood = 0, stone = 0, iron = 0;
      for (const unit of Object.keys(want)) {
        const count = +want[unit] || 0;
        if (!(count > 0)) continue;
        let def = null;
        try { def = typeof recruitUnitDef === 'function' ? recruitUnitDef(unit) : null; } catch (_) {}
        if (!def || !def.resources) {
          gbLogT('trade-unit-nocost-' + unit, 120000, `trade unit: unknown cost for ${unit} - town ${townId} blind`);
          return null;
        }
        wood += (+def.resources.wood || 0) * count;
        stone += (+def.resources.stone || 0) * count;
        iron += (+def.resources.iron || 0) * count;
      }
      return { wood, stone, iron };
    }
    return null;
  }
  function tradeGoalJobs(towns, L, preset) {
    const ledger = L || tradeLedger(towns);
    const reserve = Math.min(80, Math.max(0, gbCfgNum(state.tradeReservePct, 20))) / 100;
    const minBatch = Math.max(100, +state.tradeMinBatch || 1000);
    const byId = Object.create(null);
    towns.forEach(t => { byId[t.id] = t; });
    const jobs = [];
    for (const tgt of towns) {
      const goal = tradeGoalDeficit(tgt.id, preset);
      if (goal == null) continue;
      const cur = ledger[tgt.id];
      if (!cur) continue;
      const deficit = {
        wood: Math.max(0, goal.wood - cur.wood),
        stone: Math.max(0, goal.stone - cur.stone),
        iron: Math.max(0, goal.iron - cur.iron),
      };
      const needTotal = deficit.wood + deficit.stone + deficit.iron;
      if (needTotal < minBatch) continue;

      const needKey = ['wood', 'stone', 'iron'].sort((a, b) => deficit[b] - deficit[a])[0];
      const donors = towns.filter(s => s.id !== tgt.id).map(s => {
        const src = ledger[s.id];
        if (!src || !(src.cap > 0) || src.tradeCap < minBatch) return null;
        const keep = Math.floor(src.cap * reserve);
        const surplus = Math.max(0, (src[needKey] || 0) - keep);
        if (surplus < minBatch / 3) return null;
        return { s, src, surplus, keep };
      }).filter(Boolean);
      donors.sort((a, b) => b.surplus - a.surplus);
      for (const d of donors) {
        if (jobs.length >= 6) return jobs;
        const src = d.src;
        const send = {
          wood: Math.min(deficit.wood, Math.max(0, src.wood - d.keep), src.tradeCap),
          stone: Math.min(deficit.stone, Math.max(0, src.stone - d.keep), src.tradeCap),
          iron: Math.min(deficit.iron, Math.max(0, src.iron - d.keep), src.tradeCap),
        };
        let total = send.wood + send.stone + send.iron;
        if (total < minBatch) continue;
        if (total > src.tradeCap) {
          const scale = src.tradeCap / total;
          send.wood = Math.floor(send.wood * scale);
          send.stone = Math.floor(send.stone * scale);
          send.iron = Math.floor(send.iron * scale);
          total = send.wood + send.stone + send.iron;
        }
        if (total < minBatch) continue;
        if (needTotal > src.tradeCap * 4) {
          gbLogT('trade-goal-far-' + tgt.id, 300000,
            `trade ${preset}: deficit ${needTotal} >> tradeCap - skip unreachable goal this session`);
          break;
        }
        const job = { from: d.s.id, to: tgt.id, wood: send.wood, stone: send.stone, iron: send.iron };
        jobs.push(job);
        tradeApplyJob(ledger, job);
        deficit.wood = Math.max(0, deficit.wood - job.wood);
        deficit.stone = Math.max(0, deficit.stone - job.stone);
        deficit.iron = Math.max(0, deficit.iron - job.iron);
        if (deficit.wood + deficit.stone + deficit.iron < minBatch) break;
      }
    }
    return jobs;
  }
  function tradeIslandShipJobs(towns, L) {
    if (!state.islandShip) return [];
    const ledger = L || tradeLedger(towns);
    const jobs = [];
    const minBatch = Math.max(100, +state.tradeMinBatch || 1000);
    const reservePct = gbCfgNum(state.tradeReservePct, 20) / 100;
    const ids = towns.map(t => t.id);
    for (const tgtId of ids) {
      const tgt = ledger[tgtId];
      if (!tgt || !tgt.small) continue;
      for (const srcId of ids) {
        const src = ledger[srcId];
        if (!src || src.small || src.tradeCap < 1000) continue;
        const keep = Math.floor((src.cap || 0) * reservePct);
        let wood = Math.max(0, Math.min(src.tradeCap / 3, src.wood - keep));
        let stone = Math.max(0, Math.min(src.tradeCap / 3, src.stone - keep));
        let iron = Math.max(0, Math.min(src.tradeCap / 3, src.iron - keep));
        const total = wood + stone + iron;
        if (total < minBatch) continue;
        if (total > src.tradeCap) {
          const scale = src.tradeCap / total;
          wood = Math.floor(wood * scale);
          stone = Math.floor(stone * scale);
          iron = Math.floor(iron * scale);
        }
        const job = { from: srcId, to: tgtId, wood: Math.floor(wood), stone: Math.floor(stone), iron: Math.floor(iron) };
        if (job.wood + job.stone + job.iron < minBatch) continue;
        jobs.push(job);
        tradeApplyJob(ledger, job);
        if (jobs.length >= 4) return jobs;
      }
    }
    return jobs;
  }
  function tradeScan(reason) {
    if (!hostEnabled() || (!state.autoTrade && !state.islandShip) || captchaPaused('trade')) return;
    if (automationPaused({})) return;
    if (gbLocked('trade')) return;
    const towns = tradeListTowns();
    if (towns.length < 2) { gbLogT('trade-towns', 180000, 'trade: need >=2 towns'); return; }
    const ledger = tradeLedger(towns);
    let jobs = [];
    const preset = state.tradePreset || 'storage';
    const dl = (typeof econDeadlock === 'function') ? econDeadlock() : null;

    if (state.autoTrade && preset === 'storage') {
      jobs = jobs.concat(tradeFillStorageJobs(towns, ledger, { deadlock: !!(dl && dl.open) }));
    } else if (state.autoTrade && (preset === 'party' || preset === 'unit')) {
      jobs = jobs.concat(tradeGoalJobs(towns, ledger, preset));
    }
    if (state.islandShip) jobs = jobs.concat(tradeIslandShipJobs(towns, ledger));
    if (!jobs.length) {
      gbLogT('trade-idle', 180000, `trade: nothing to send (${reason || 'scan'})`);
      return;
    }
    gbLock('trade');
    let i = 0, done = 0;
    (function next() {
      if (i >= jobs.length) {
        gbUnlock('trade');
        if (done) gbLog(`trade: sent ${done}/${jobs.length}`);
        return;
      }
      const j = jobs[i++];
      tradeSend(j.from, j.to, j.wood, j.stone, j.iron, (err) => {
        if (err === 'captcha' || err === 'captcha-pause') { gbUnlock('trade'); return; }
        if (!err) {
          done++;
          gbLog(`trade: ${j.from}->${j.to} w${j.wood}/s${j.stone}/i${j.iron}`);
        } else gbLogT('trade-err', 60000, `trade err ${err}`);
        gbTimeout(next, 800 + Math.random() * 600);
      });
    })();
  }

  const RURAL_TRADE_MS = 90000;
  const RURAL_LEVEL_MS = 120000;

  function ruralRelModels() {
    try {
      const uw = gameUw();
      const col = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('FarmTownPlayerRelation');
      return (col && col.models) || [];
    } catch (_) { return []; }
  }
  function ruralFarmModels() {
    try {
      const uw = gameUw();
      const col = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('FarmTown');
      return (col && col.models) || [];
    } catch (_) { return []; }
  }
  function ruralTownIslandXY(townId) {
    const uw = gameUw();
    try {
      const t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]);
      if (!t) return null;
      return { x: t.getIslandCoordinateX && t.getIslandCoordinateX(), y: t.getIslandCoordinateY && t.getIslandCoordinateY(), t };
    } catch (_) { return null; }
  }
  function ruralTradePost(relationId, farmTownId, amount, townId, onDone) {
    bridgePost('ruraltrade', {
      model_url: `FarmTownPlayerRelation/${relationId}`,
      action_name: 'trade',
      arguments: { farm_town_id: +farmTownId, amount: Math.min(3000, Math.max(100, +amount)) },
      town_id: +townId,
    }, onDone);
  }
  function ruralUnlock(relationId, farmTownId, townId, onDone) {
    bridgePost('rurallevel', {
      model_url: `FarmTownPlayerRelation/${relationId}`,
      action_name: 'unlock',
      arguments: { farm_town_id: +farmTownId },
      town_id: +townId,
    }, onDone);
  }
  function ruralUpgrade(relationId, farmTownId, townId, onDone) {
    bridgePost('rurallevel', {
      model_url: `FarmTownPlayerRelation/${relationId}`,
      action_name: 'upgrade',
      arguments: { farm_town_id: +farmTownId },
      town_id: +townId,
    }, onDone);
  }

  function ruralTradeReadyAt(a) {
    const v = gbProbeAttr(a, ['trade_at', 'tradeable_at', 'next_trade_at', 'lootable_at']);
    return v != null && v > 0 ? v : null;
  }
  function ruralTradeScan(reason) {
    if (!hostEnabled() || !state.autoRuralTrade || captchaPaused('ruraltrade')) return;
    if (automationPaused({})) return;
    if (gbLocked('rural-trade')) return;

    const wantRes = state.ruralTradeRes || 'iron';
    const minRatio = +state.ruralTradeRatio || 1.0;
    const relations = ruralRelModels();
    const farms = ruralFarmModels();
    const farmById = {};
    farms.forEach(f => { const a = f.attributes || {}; if (a.id != null) farmById[a.id] = a; });
    const jobs = [];
    const capLeft = Object.create(null);
    let townIds = [];
    try {
      const uw = gameUw();
      townIds = Object.keys((uw.ITowns && uw.ITowns.towns) || {});
    } catch (_) {}
    for (const tid of townIds) {
      const xy = ruralTownIslandXY(tid);
      if (!xy || xy.x == null) continue;
      let tradeCap = 0;
      try { tradeCap = +xy.t.getAvailableTradeCapacity(); } catch (_) {}
      if (tradeCap < 500) continue;
      capLeft[tid] = tradeCap;

      const st = townResState(tid);
      if (st && st.full && st.full[wantRes]) {
        gbLogT('ruraltrade-full-' + tid, 120000,
          `rural-trade: town ${tid} ${wantRes} already at capacity - skip`);
        continue;
      }
      const now = gameNow();
      for (const rel of relations) {
        if ((capLeft[tid] || 0) < 500) break;
        const a = rel.attributes || {};
        if (+a.relation_status !== 1) continue;
        const readyAt = ruralTradeReadyAt(a);
        if (readyAt != null && readyAt > now) continue;
        const ft = farmById[a.farm_town_id];
        if (!ft) continue;
        if (ft.island_x !== xy.x || ft.island_y !== xy.y) continue;
        if (ft.resource_offer && ft.resource_offer !== wantRes) continue;
        const ratio = +a.current_trade_ratio;
        if (!(ratio >= minRatio)) continue;
        const amount = Math.min(3000, capLeft[tid]);
        jobs.push({ relId: a.id || rel.id, farmId: a.farm_town_id, townId: tid, amount });
        capLeft[tid] -= amount;
        if (jobs.length >= 6) break;
      }
      if (jobs.length >= 6) break;
    }
    if (!jobs.length) {
      gbLogT('ruraltrade-idle', 180000, `rural-trade: idle (${reason || 'scan'})`);
      return;
    }
    gbLock('rural-trade');
    let i = 0, done = 0;
    (function next() {
      if (i >= jobs.length) {
        gbUnlock('rural-trade');
        if (done) gbLog(`rural-trade: ${done}/${jobs.length}`);
        return;
      }
      const j = jobs[i++];
      ruralTradePost(j.relId, j.farmId, j.amount, j.townId, (err) => {
        if (err === 'captcha' || err === 'captcha-pause') { gbUnlock('rural-trade'); return; }
        if (!err) {
          done++;
          gbLog(`rural-trade: town ${j.townId} farm ${j.farmId} amt ${j.amount} (>=${minRatio})`);
        }
        gbTimeout(next, 700 + Math.random() * 400);
      });
    })();
  }
  function ruralKillpoints() {
    try {
      const uw = gameUw();
      const kp = uw.MM.getModelByNameAndPlayerId('PlayerKillpoints');
      const a = kp && kp.attributes;
      return a ? (+a.att || 0) + (+a.def || 0) - (+a.used || 0) : 0;
    } catch (_) { return 0; }
  }
  function ruralLevelScan(reason) {
    if (!hostEnabled() || !state.autoRuralLevel || captchaPaused('rurallevel')) return;
    if (automationPaused({})) return;
    if (gbLocked('rural-level')) return;
    const maxLvl = Math.min(6, Math.max(1, +state.ruralLevelMax || 3));
    const relations = ruralRelModels();
    const farms = ruralFarmModels();
    const farmById = {};
    farms.forEach(f => { const a = f.attributes || {}; if (a.id != null) farmById[a.id] = a; });
    let available = ruralKillpoints();
    const unlockCosts = [2, 8, 10, 30, 50, 100];
    const levelCosts = [1, 5, 25, 50, 100];
    let townIds = [];
    try {
      const uw = gameUw();
      const seenIslands = new Set();
      for (const id of Object.keys((uw.ITowns && uw.ITowns.towns) || {})) {
        const t = uw.ITowns.towns[id];
        try {
          if (t.attributes && t.attributes.on_small_island) continue;
          const iid = t.getIslandId ? t.getIslandId() : (t.attributes && t.attributes.island_id);
          if (iid != null && seenIslands.has(iid)) continue;
          if (iid != null) seenIslands.add(iid);
          townIds.push(id);
        } catch (_) { townIds.push(id); }
      }
    } catch (_) {}
    const locked = relations.filter(r => +((r.attributes || {}).relation_status) === 0);

    const candidates = [];
    if (locked.length) {
      const unlocked = relations.length - locked.length;
      const need = unlocked < unlockCosts.length ? unlockCosts[unlocked] : 100;
      if (available >= need) {
        for (const tid of townIds) {
          const xy = ruralTownIslandXY(tid);
          if (!xy) continue;
          for (const rel of locked) {
            const a = rel.attributes || {};
            const ft = farmById[a.farm_town_id];
            if (!ft || ft.island_x !== xy.x || ft.island_y !== xy.y) continue;
            candidates.push({ kind: 'unlock', relId: a.id || rel.id, farmId: a.farm_town_id, townId: tid, cost: need });
            break;
          }
          if (candidates.length) break;
        }
      }
    }
    for (let level = 1; level < maxLvl; level++) {
      const cost = levelCosts[level - 1] || 100;
      if (available < cost) break;
      for (const tid of townIds) {
        const xy = ruralTownIslandXY(tid);
        if (!xy) continue;
        for (const rel of relations) {
          const a = rel.attributes || {};
          if (+a.relation_status !== 1) continue;
          if (a.expansion_at) continue;
          const stage = +a.expansion_stage || 0;
          if (stage > level) continue;
          if (stage >= maxLvl) continue;
          const ft = farmById[a.farm_town_id];
          if (!ft || ft.island_x !== xy.x || ft.island_y !== xy.y) continue;
          candidates.push({ kind: 'upgrade', relId: a.id || rel.id, farmId: a.farm_town_id, townId: tid, stage, cost });
          break;
        }
        if (candidates.some(c => c.kind === 'upgrade')) break;
      }
      if (candidates.some(c => c.kind === 'upgrade')) break;
    }

    const job = candidates.find(c => c.kind === 'unlock') || candidates[0] || null;
    if (!job) {
      gbLogT('rurallevel-idle', 180000, `rural-level: idle (${reason || 'scan'})`);
      return;
    }
    gbLock('rural-level');
    const done = (err) => {
      gbUnlock('rural-level');
      if (!err) gbLog(`rural-level: ${job.kind} farm ${job.farmId} town ${job.townId}`);
      else gbLogT('rurallevel-err', 60000, `rural-level err ${err}`);
    };
    if (job.kind === 'unlock') ruralUnlock(job.relId, job.farmId, job.townId, done);
    else ruralUpgrade(job.relId, job.farmId, job.townId, done);
  }

  const RESEARCH_CHECK_MS = 45000;
  const RESEARCH_CS_FAST = ['booty', 'ceramics', 'architecture', 'crane', 'shipwright', 'colonize_ship', 'mathematics'];

  function researchEnsureTargets() {
    if (state.researchTargets && typeof state.researchTargets === 'object') return state.researchTargets;
    const t = {};
    RESEARCH_CS_FAST.forEach((k, i) => { t[k] = { order: i, tgt: 1 }; });
    state.researchTargets = t;
    save(STORE.RESEARCH_TARGETS, t);
    return t;
  }
  function researchTownTechs(townId) {
    const uw = gameUw();
    try {
      const t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]);
      if (!t) return null;
      let res = {};
      try { res = (t.researches && t.researches().attributes) || {}; } catch (_) {}
      let acad = 0;
      try { acad = t.getBuildings ? +t.getBuildings().get('academy') : +(t.buildings().attributes || {}).academy; } catch (_) {}
      let orders = [];
      try {
        const col = t.getResearchOrdersCollection && t.getResearchOrdersCollection();
        if (col && col.models) orders = col.models;
        else {
          const mm = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('ResearchOrder');
          if (mm && mm.models) {
            orders = mm.models.filter(m => {
              const a = m.attributes || {};
              return +a.town_id === +townId;
            });
          }
        }
      } catch (_) {}
      return { town: t, techs: res, academy: acad, orders };
    } catch (_) { return null; }
  }

  function researchLabel(key) {
    try {
      const uw = gameUw();
      const r = (uw.GameData && uw.GameData.researches && uw.GameData.researches[key]) || null;
      if (r && (r.name || r.title)) return String(r.name || r.title);
    } catch (_) {}
    return '';
  }

  function researchDef(tech) {
    try {
      const uw = gameUw();
      return (uw.GameData && uw.GameData.researches && uw.GameData.researches[tech]) || null;
    } catch (_) { return null; }
  }

  function researchCost(tech) {
    const d = researchDef(tech);
    if (!d) return null;
    const src = d.resources || d.costs || d.cost || d;
    const cost = {
      wood: +src.wood || 0,
      stone: +src.stone || 0,
      iron: +src.iron || 0,
    };
    if (!(cost.wood || cost.stone || cost.iron)) return null;
    return cost;
  }
  function researchPointCost(tech) {
    const d = researchDef(tech);
    if (!d) return null;
    const v = gbProbeAttr(d, ['research_points', 'points', 'research_point_cost']);
    return v != null && v > 0 ? v : null;
  }
  function researchPointsAvailable(townId, info) {
    const t = (info && info.town) || gbTownModel(townId);
    if (!t) return null;
    const v = gbProbeNum(t, ['getAvailableResearchPoints', 'getFreeResearchPoints', 'getResearchPoints']);
    if (v != null) return v;
    try {
      const r = t.researches && t.researches();
      const a = (r && r.attributes) || {};
      const av = gbProbeAttr(a, ['available_research_points', 'research_points_available', 'points_available']);
      if (av != null) return av;
      const total = gbProbeAttr(a, ['research_points', 'points']);
      const used = gbProbeAttr(a, ['used_research_points', 'points_used']);
      if (total != null && used != null) return total - used;
    } catch (_) {}
    return null;
  }

  function researchCanAfford(townId, tech, info) {
    const needPts = researchPointCost(tech);
    if (needPts != null) {
      const have = researchPointsAvailable(townId, info);
      if (have != null && have < needPts) return { ok: false, why: `points ${have}/${needPts}` };
    }
    const cost = researchCost(tech);
    if (!cost) {
      gbLogT('research-nocost-' + tech, 900000,
        `research: no cost data for ${tech} - resource check skipped, server decides`);
      return { ok: true, why: null };
    }
    const aff = gbAfford(townId, cost);
    if (!aff.ok) return { ok: false, why: aff.detail };
    return { ok: true, why: null };
  }
  function researchPost(townId, techId, onDone) {
    gameAjaxPost('research', 'building_academy', 'research', {
      id: techId,
      town_id: +townId,
    }, onDone);
  }
  function researchOrderTechId(order) {
    try {
      const a = (order && order.attributes) || order || {};
      return a.research_id || a.research || a.type || a.id || null;
    } catch (_) { return null; }
  }
  function researchDepsOk(townId, info, tech) {
    try {
      const uw = gameUw();
      const def = uw.GameData && uw.GameData.researches && uw.GameData.researches[tech];
      if (!def) return true;
      const rdeps = def.research_dependencies || def.dependencies || [];
      for (const d of rdeps) {
        const id = typeof d === 'string' ? d : (d && (d.id || d.research_id));
        if (id && !info.techs[id]) return false;
      }
      const bdeps = def.building_dependencies || {};
      let buildings = null;
      try {
        buildings = info.town.getBuildings
          ? info.town.getBuildings().attributes || info.town.getBuildings()
          : (info.town.buildings && info.town.buildings().attributes) || {};
      } catch (_) { buildings = {}; }
      for (const b of Object.keys(bdeps)) {
        const need = +bdeps[b] || 0;
        const have = +((buildings && (buildings[b] || (buildings.attributes && buildings.attributes[b]))) || 0);
        if (have < need) return false;
      }

      const res = def.resources;
      if (res && typeof res === 'object') {
        if (res.wood == null || res.stone == null || res.iron == null) return false;
      }
      if (def.research_points == null && def.resources == null && Object.prototype.hasOwnProperty.call(def, 'resources')) {
        return false;
      }
      return true;
    } catch (_) { return true; }
  }
  function researchScan(reason) {
    if (!hostEnabled() || !state.autoResearch || captchaPaused('research')) return;
    if (automationPaused({})) return;
    if (gbLocked('research')) return;
    const targets = researchEnsureTargets();
    const ordered = Object.keys(targets).sort((a, b) => (+targets[a].order || 0) - (+targets[b].order || 0));
    let townIds = [];
    try {
      const uw = gameUw();
      townIds = Object.keys((uw.ITowns && uw.ITowns.towns) || {});
    } catch (_) {}
    let job = null;
    for (const tid of townIds) {
      const info = researchTownTechs(tid);
      if (!info || !(info.academy > 0)) continue;
      const queueMax = 2;
      if (info.orders.length >= queueMax) continue;
      const queued = new Set();
      info.orders.forEach(o => {
        const id = researchOrderTechId(o);
        if (id != null) queued.add(String(id));
      });
      for (const tech of ordered) {
        if (info.techs[tech]) continue;
        if (queued.has(String(tech))) continue;
        const tgt = targets[tech];
        if (!tgt || !tgt.tgt) continue;
        if (!researchDepsOk(tid, info, tech)) continue;
        const aff = researchCanAfford(tid, tech, info);
        if (!aff.ok) {
          gbLogT('research-cant-' + tid + '-' + tech, 300000,
            `research: town ${tid} cannot start ${tech} yet (${aff.why})`);
          continue;
        }
        job = { townId: tid, tech };
        break;
      }
      if (job) break;
    }
    if (!job) {
      gbLogT('research-idle', 180000, `research: idle (${reason || 'scan'})`);
      return;
    }
    gbLock('research');
    researchPost(job.townId, job.tech, (err) => {
      gbUnlock('research');
      if (!err) gbLog(`research: town ${job.townId} -> ${job.tech}`);
      else gbLogT('research-err', 60000, `research err ${err}`);
    });
  }
  function researchLoadCsFast() {
    const t = {};
    RESEARCH_CS_FAST.forEach((k, i) => { t[k] = { order: i, tgt: 1 }; });
    state.researchTargets = t;
    save(STORE.RESEARCH_TARGETS, t);
    gbLog('research: loaded CS-fast tech list');
  }

  const alertLastSent = {};
  function alertIsTelegram(url) {
    return /api\.telegram\.org\/bot/i.test(url) || /telegram/i.test(url);
  }
  function alertWebhookUrlOk(url) {
    if (/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+/i.test(url)) return true;
    if (/api\.telegram\.org\/bot[^/\s]+\/sendMessage/i.test(url)) return true;
    return false;
  }
  function alertTelegramChatId(url) {
    let chatId = (state.webhookEvents && state.webhookEvents.telegramChatId) || '';
    if (!chatId) {
      try {
        const m = /[?&]chat_id=([^&]+)/.exec(url);
        if (m) chatId = decodeURIComponent(m[1]);
      } catch (_) {}
    }
    return chatId ? String(chatId) : '';
  }
  function alertWebhook(event, payload) {
    const url = (state.webhookUrl || '').trim();
    if (!url) return;

    if (event !== 'captcha') {
      if (captchaPaused('alert') || (captchaGlobalUntil && Date.now() < captchaGlobalUntil)) return;
    }
    if (!alertWebhookUrlOk(url)) {
      gbLogT('webhook-url', 120000, 'webhook: invalid Discord/Telegram URL');
      return;
    }
    const ev = state.webhookEvents || {};
    if (ev[event] === false) return;
    const now = Date.now();
    if ((alertLastSent[event] || 0) + 5 * 60 * 1000 > now) return;
    const text = `GrepBot [${location.host}] ${event}\n` +
      '```json\n' + JSON.stringify(payload || {}, null, 2).slice(0, 1800) + '\n```';
    let body;
    if (alertIsTelegram(url)) {
      const chatId = alertTelegramChatId(url);
      if (!chatId) {
        gbLogT('webhook-chat', 120000, 'webhook: Telegram chat_id missing');
        return;
      }
      body = {
        chat_id: chatId,
        text: text.slice(0, 3900),
        disable_web_page_preview: true,
      };
    } else {
      body = {
        content: null,
        embeds: [{
          title: `GrepBot: ${event}`,
          description: '```json\n' + JSON.stringify(payload || {}, null, 2).slice(0, 1800) + '\n```',
          timestamp: new Date().toISOString(),
          footer: { text: location.host },
        }],
      };
    }
    try {

      alertLastSent[event] = Date.now();
      gbXhr({
        method: 'POST',
        url,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify(body),
        onload: (r) => {
          if (r.status < 200 || r.status >= 300) gbLogT('webhook-fail', 60000, 'webhook status ' + r.status);
        },
        onerror: (e) => {
          if (e && e.captcha) return;
          gbLogT('webhook-err', 60000, 'webhook transport error');
        },
      });
    } catch (e) {
      gbLogT('webhook-ex', 60000, 'webhook ' + String(e));
    }
  }

  const MERCHANT_CHECK_MS = 45000;

  function merchantExactMatch(wishName, offerId) {
    const w = String(wishName || '').toLowerCase().trim();
    const id = String(offerId || '').toLowerCase().trim();
    if (!w || !id) return false;
    return w === id;
  }
  function merchantScan(reason) {
    if (!hostEnabled() || !state.autoMerchant || captchaPaused('merchant')) return;
    if (automationPaused({})) return;
    if (gbLocked('merchant')) return;
    const wish = state.merchantWish || [];
    if (!wish.length) {
      gbLogT('merchant-empty', 300000, 'merchant: wishlist empty');
      return;
    }
    const uw = gameUw();
    let offers = [];
    try {
      const col = uw.MM && (uw.MM.getOnlyCollectionByName && (
        uw.MM.getOnlyCollectionByName('PhoenicianSalesmanOffer') ||
        uw.MM.getOnlyCollectionByName('MerchantOffer') ||
        uw.MM.getOnlyCollectionByName('PremiumExchangeOffer')
      ));
      if (col && col.models) offers = col.models;
    } catch (_) {}
    if (!offers.length) {
      gbLogT('merchant-none', 180000, `merchant: no offers (${reason || 'scan'})`);
      return;
    }

    const gold = gbPlayerGold();
    let job = null;
    for (const w of wish) {
      const name = (w.item || w.id || '').toLowerCase().trim();
      const maxPrice = +w.maxPrice;
      if (!name || !(maxPrice > 0)) continue;
      for (const o of offers) {
        const a = o.attributes || {};

        const id = String(a.item_id || a.offer_id || '').toLowerCase().trim();
        if (!id) continue;
        if (!merchantExactMatch(name, id) && !merchantExactMatch(name, String(a.type || '').toLowerCase())) continue;

        const priceRaw = a.price != null ? a.price : (a.gold != null ? a.gold : null);
        if (priceRaw == null || priceRaw === '') continue;
        const price = +priceRaw;
        if (!Number.isFinite(price) || price < 0) continue;
        if (price > maxPrice) continue;
        if (gold != null && gold < price) {
          gbLogT('merchant-gold', 300000, `merchant: ${id} costs ${price}, gold ${gold} - skip`);
          continue;
        }
        const townId = a.town_id || (uw.Game && uw.Game.townId);
        if (!townId) continue;
        job = { offer: o, wish: w, price, townId, itemId: id };
        break;
      }
      if (job) break;
    }
    if (!job) return;

    const oid = (job.offer.attributes && (job.offer.attributes.id || job.offer.id)) || job.offer.id;
    if (oid == null || oid === '') {
      gbLogT('merchant-noid', 60000, 'merchant: offer has no id - skip');
      try { gbRemember('merchant', 'buy', '-', 'no-offer-id'); } catch (_) {}
      return;
    }
    gbLock('merchant');
    bridgePost('merchant', {
      model_url: `PhoenicianSalesmanOffer/${oid}`,
      action_name: 'buy',
      arguments: {},
      town_id: +job.townId,
    }, (err) => {
      if (err === 'timeout') {
        gbLogT('merchant-timeout', 60000, `merchant: timeout_unknown for ${job.itemId} - no fallback`);
        gbUnlock('merchant');
        return;
      }
      if (!err) {
        gbLog(`merchant: bought ${job.wish.item || job.wish.id} @ ${job.price}`);
        gbUnlock('merchant');
        return;
      }

      if (!/unknown.?action|invalid.?action|not.?found|does.?not.?exist/i.test(String(err))) {
        gbLogT('merchant-err', 60000, `merchant err ${err}`);
        gbUnlock('merchant');
        return;
      }
      if (captchaPaused('merchant') || automationPaused({}) || !gbLocked('merchant')) {
        gbUnlock('merchant');
        return;
      }
      gameAjaxPost('merchant', 'phoenician_salesman', 'buy', {
        offer_id: oid,
        town_id: +job.townId,
      }, (e2) => {
        gbUnlock('merchant');
        if (!e2) gbLog(`merchant: bought via ajax ${job.wish.item || job.wish.id}`);
        else gbLogT('merchant-err', 60000, `merchant err ${err}/${e2}`);
      });
    });
  }

  const PT_VIEW_TTL_MS = 30000;
  const PT_RES = ['wood', 'stone', 'iron'];
  let ptViewCache = null;

  function ptCfg() {
    const c = state.ptCfg || {};
    return {
      targetRatio: +c.targetRatio > 0 ? +c.targetRatio : 1.0,
      pumpAmount: Math.max(1, Math.floor(+c.pumpAmount || 1)),
      maxPumps: Math.max(0, Math.floor(+c.maxPumps != null ? +c.maxPumps : 6)),
      reservePct: Math.min(90, Math.max(0, gbCfgNum(c.reservePct, 10))),
      wantRes: c.wantRes && typeof c.wantRes === 'object' ? c.wantRes : { wood: true, stone: true, iron: false },
    };
  }
  function ptCfgSave() { save(STORE.PT_CFG, state.ptCfg); }

  function ptSalesmanTown() {
    const uw = gameUw();
    let m = null;
    try {
      m = (uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('PhoenicianSalesman'))
        || (uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('PhoenicianSalesman'))
        || null;
    } catch (_) { m = null; }
    if (m && m.models && m.models.length) m = m.models[0];
    if (!m) return null;
    const a = m.attributes || m;
    const tid = gbProbeAttr(a, ['town_id', 'current_town_id', 'in_town_id']);
    if (tid != null && +tid > 0) return +tid;

    try {
      if (typeof m.isInCurrentTown === 'function' && m.isInCurrentTown()) {
        return +(uw.Game && uw.Game.townId) || null;
      }
    } catch (_) {}
    return null;
  }

  function ptResFromText(s) {
    const t = String(s || '').toLowerCase();
    for (const r of PT_RES) {
      if (t.indexOf(r) !== -1) return r;
    }
    if (/silver|plata|argent/.test(t)) return 'iron';
    if (/wood|madera|holz|bois/.test(t)) return 'wood';
    if (/stone|piedra|stein|pierre/.test(t)) return 'stone';
    return null;
  }
  function ptRatioFromText(s) {
    const t = String(s || '').replace(',', '.');
    let m = t.match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/);
    if (m) {
      const give = +m[1], get = +m[2];
      if (give > 0 && get >= 0) return get / give;
    }
    m = t.match(/(\d+\.\d+)/);
    if (m) return +m[1];
    return null;
  }

  function ptParseOffers(root) {
    if (!root) return null;
    let nodes = [];
    try {
      nodes = Array.from(root.querySelectorAll('[class*="offer"],[class*="trade_row"],[class*="exchange"]'));
    } catch (_) { return null; }
    const offers = [];
    nodes.forEach((el, i) => {
      const txt = (el.textContent || '').trim();
      if (!txt) return;
      const ratio = ptRatioFromText(txt);
      if (ratio == null) return;
      const html = el.innerHTML || '';

      const resHits = [];
      try {
        Array.from(el.querySelectorAll('[class*="wood"],[class*="stone"],[class*="iron"],[class*="resource"]')).forEach(r => {
          const hit = ptResFromText(r.className) || ptResFromText(r.getAttribute('data-resource') || '');
          if (hit) resHits.push(hit);
        });
      } catch (_) {}
      const give = resHits[0] || null;
      const get = resHits[1] || null;
      const stockM = txt.replace(/\./g, '').match(/(\d{2,7})/);
      const id = el.getAttribute('data-offer-id') || el.getAttribute('data-id')
        || el.getAttribute('data-offer_id') || String(i);
      offers.push({
        id: String(id),
        give, get, ratio,
        stock: stockM ? +stockM[1] : null,
        raw: html.slice(0, 200),
      });
    });
    if (!offers.length) return null;
    return offers;
  }
  function ptWindowRoot() {

    try {
      const sel = '[class*="phoenician"],[class*="salesman"]';
      const nodes = Array.from(document.querySelectorAll(sel));
      for (const n of nodes) {
        if (n.querySelector && n.querySelector('[class*="offer"],[class*="exchange"]')) return n;
      }
    } catch (_) {}
    return null;
  }

  function ptViewUrlFor(townId) {
    const learned = state.ptViewUrl;
    if (!learned) return null;
    try {
      return String(learned).replace(/([?&]town_id=)\d+/, '$1' + townId);
    } catch (_) { return null; }
  }
  function ptOffersNow(townId, cb) {
    const dom = ptParseOffers(ptWindowRoot());
    if (dom) { cb(dom, 'window'); return; }
    const url = ptViewUrlFor(townId);
    if (!url) {
      gbLogT('pt-noview', 600000,
        'phoenician: offers unreadable - open the merchant window once so the view URL is learned');
      cb(null, 'noview');
      return;
    }
    gbXhr({
      method: 'GET', url,
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      onload(res) {
        if (res.status && res.status >= 400) { cb(null, 'http' + res.status); return; }
        let html = res.responseText || '';
        try {
          const j = JSON.parse(html);
          html = (j && (j.html || (j.json && j.json.html))) || html;
        } catch (_) {}
        let doc = null;
        try { doc = new DOMParser().parseFromString(String(html), 'text/html'); } catch (_) {}
        const offers = ptParseOffers(doc && doc.body);
        if (!offers) {
          gbLogT('pt-parse', 600000,
            'phoenician: offer markup not understood - Log > Diag and paste the window HTML');
        }
        cb(offers, 'fetch');
      },
      onerror() { cb(null, 'err'); },
    });
  }
  function ptOffers(townId, cb, force) {
    const now = Date.now();
    if (!force && ptViewCache && ptViewCache.townId === townId && (now - ptViewCache.at) < PT_VIEW_TTL_MS) {
      cb(ptViewCache.offers, 'memo');
      return;
    }
    ptOffersNow(townId, (offers, src) => {
      if (offers) ptViewCache = { townId, at: Date.now(), offers };
      cb(offers, src);
    });
  }

  function ptParseParams(url, body) {
    const args = {};
    const take = (sp) => {
      sp.forEach((v, k) => {
        if (/^(h|action|controller|_|json)$/i.test(k)) return;
        args[k] = /^-?\d+$/.test(v) ? +v : v;
      });
      const j = sp.get && sp.get('json');
      if (j) {
        try {
          const obj = JSON.parse(j);
          if (obj && typeof obj === 'object') Object.keys(obj).forEach(k => { args[k] = obj[k]; });
        } catch (_) {}
      }
    };
    try {
      const q = String(url).split('?')[1];
      if (q) take(new URLSearchParams(q));
    } catch (_) {}
    if (typeof body === 'string' && body) {
      try { take(new URLSearchParams(body)); } catch (_) {}
      if (body.charAt(0) === '{') {
        try {
          const obj = JSON.parse(body);
          if (obj && typeof obj === 'object') Object.keys(obj).forEach(k => { args[k] = obj[k]; });
        } catch (_) {}
      }
    }
    return args;
  }
  function ptLearnFromXhr(u, body) {
    const url = String(u || '');
    if (!/phoenician_salesman/i.test(url)) return;
    const action = (url.match(/[?&]action=([A-Za-z_]+)/) || [])[1] || '';
    if (!action || /^(index|view|show|load)$/i.test(action)) {
      if (state.ptViewUrl !== url) {
        state.ptViewUrl = url;
        save(wkey(STORE.PT_VIEW_URL), url);
        gbLog('phoenician: learned view URL');
      }
      return;
    }
    if (!/trade|exchange|swap/i.test(action)) return;

    if (gbLocked('pt-trade')) return;
    const args = ptParseParams(url, body);
    const townId = args.town_id != null ? +args.town_id : null;
    delete args.town_id;
    const tpl = {
      controller: 'phoenician_salesman',
      action,
      arguments: args,
      town_id: townId,
      version: 1,
      learned_at: Date.now(),
    };
    tpl.amountKey = ptAmountKey(tpl);
    state.ptTradeTpl = tpl;
    save(wkey(STORE.PT_TRADE_TPL), tpl);
    gbLog('phoenician: learned trade payload: ' + JSON.stringify(tpl).slice(0, 200));
    try { tplHealthMarkLearned('ptTradeTpl'); } catch (_) {}
  }
  function ptAmountKey(tpl) {
    if (!tpl) return null;
    if (tpl.amountKey) return tpl.amountKey;
    const args = tpl.arguments || {};
    const named = Object.keys(args).find(k => /^(amount|count|quantity|menge|cantidad|trade_amount|res_amount)$/i.test(k));
    if (named) return named;
    let best = null, bestVal = -1;
    Object.keys(args).forEach(k => {
      const v = +args[k];
      if (Number.isFinite(v) && v > bestVal) { bestVal = v; best = k; }
    });
    return best;
  }
  function ptTradePost(townId, offer, amount, onDone) {
    const tpl = state.ptTradeTpl;
    if (!tpl || !tpl.action) {
      gbLogT('pt-notpl', 600000,
        'phoenician: no learned trade payload - do ONE trade by hand to teach it');
      onDone('no-template');
      return;
    }
    const key = ptAmountKey(tpl);
    if (!key) {
      gbLogT('pt-noamount', 600000, 'phoenician: learned payload has no amount field - refusing to post');
      onDone('no-amount');
      return;
    }
    const data = Object.assign({}, tpl.arguments || {});
    data[key] = Math.max(1, Math.floor(amount));
    if (townId != null) data.town_id = +townId;

    if (offer && offer.id != null) {
      Object.keys(data).forEach(k => {
        if (/offer(_id)?$/i.test(k)) data[k] = offer.id;
      });
    }
    gameAjaxPost('pttrade', tpl.controller || 'phoenician_salesman', tpl.action, data, onDone);
  }

  function ptTownCaps(townId) {
    const uw = gameUw();
    let t = null;
    try { t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]); } catch (_) {}
    let tradeCap = null;
    try { if (t && t.getAvailableTradeCapacity) tradeCap = +t.getAvailableTradeCapacity(); } catch (_) {}
    const st = townResState(townId);
    return { tradeCap: Number.isFinite(tradeCap) ? tradeCap : null, res: st };
  }

  function ptRoom(townId, give, get) {
    const caps = ptTownCaps(townId);
    const cfg = ptCfg();
    const st = caps.res;
    let out = null, room = null;
    if (st) {
      const cap = +st.cap || 0;
      const keep = Math.floor(cap * (cfg.reservePct / 100));
      const have = +st[give];
      if (Number.isFinite(have)) out = Math.max(0, have - keep);
      const cur = +st[get];
      if (cap > 0 && Number.isFinite(cur)) room = Math.max(0, cap - cur);
    }
    return { out, room, tradeCap: caps.tradeCap };
  }

  function ptTradeScan(reason) {
    if (!hostEnabled() || !state.autoPtTrade || captchaPaused('pttrade')) return;
    if (automationPaused({})) return;
    if (gbLocked('pt-trade')) return;
    const townId = ptSalesmanTown();
    if (townId == null) {
      gbLogT('pt-noship', 600000, `phoenician: no merchant ship readable (${reason || 'scan'})`);
      return;
    }
    if (!state.ptTradeTpl) {
      gbLogT('pt-notpl-scan', 600000,
        'phoenician: ship is here but no trade payload learned - trade once by hand');
      return;
    }
    const cfg = ptCfg();
    ptOffers(townId, (offers) => {
      if (!offers || !offers.length) return;
      const pick = offers.find(o => {
        if (!(o.ratio >= 0)) return false;
        if (o.get && !cfg.wantRes[o.get]) return false;
        if (o.stock != null && o.stock <= 0) return false;
        return true;
      });
      if (!pick) {
        gbLogT('pt-nooffer', 300000, 'phoenician: no offer matches the wanted resources');
        return;
      }
      const give = pick.give || 'iron';
      const get = pick.get || 'wood';
      const room = ptRoom(townId, give, get);
      if (room.tradeCap != null && room.tradeCap < cfg.pumpAmount) {
        gbLogT('pt-nocap', 300000, `phoenician: no free trade capacity in town ${townId}`);
        return;
      }
      if (room.room != null && room.room <= 0) {
        gbLogT('pt-full', 300000, `phoenician: town ${townId} ${get} already at capacity - skip`);
        return;
      }
      if (room.out != null && room.out < cfg.pumpAmount) {
        gbLogT('pt-nostock', 300000, `phoenician: town ${townId} ${give} below reserve - skip`);
        return;
      }
      gbLock('pt-trade');
      ptRunPump(townId, pick, give, get, cfg);
    });
  }
  function ptRunPump(townId, offer, give, get, cfg) {
    let pumps = 0;
    let lastRatio = offer.ratio;
    const finish = (why) => {
      gbUnlock('pt-trade');
      if (why) gbLog(`phoenician: ${why}`);
    };
    const bulk = () => {
      const room = ptRoom(townId, give, get);

      if (room.tradeCap == null && room.room == null && room.out == null) {
        finish('bulk skipped - trade capacity and warehouse unreadable');
        return;
      }
      const parts = [offer.stock, room.room, room.tradeCap, room.out].filter(v => v != null && Number.isFinite(v));
      if (!parts.length) {
        finish('bulk skipped - capacity/stock unreadable');
        return;
      }
      const amount = Math.floor(Math.min.apply(null, parts));
      if (!(amount > 0)) { finish('bulk skipped - nothing tradeable'); return; }
      ptTradePost(townId, offer, amount, (err) => {
        if (err === 'dryrun') {
          finish(`DRY-RUN bulk trade would send ${amount} ${give} -> ${get} at ratio ${lastRatio}`);
          return;
        }
        if (err) {
          gbLogT('pt-bulk-err', 60000, `phoenician: bulk trade ${err}`);
          finish(null);
          return;
        }
        ptViewCache = null;
        finish(`bulk trade ${amount} ${give} -> ${get} at ratio ${lastRatio}`);
      });
    };
    const step = () => {
      if (lastRatio >= cfg.targetRatio) { bulk(); return; }
      if (pumps >= cfg.maxPumps) {
        finish(`ratio stuck at ${lastRatio} after ${pumps} pumps - no bulk trade`);
        return;
      }
      pumps++;
      ptTradePost(townId, offer, cfg.pumpAmount, (err) => {

        if (err === 'dryrun' || (!err && state.dryRun)) {
          lastRatio = Math.round((lastRatio + 0.1) * 100) / 100;
          gbLog(`phoenician: DRY-RUN pump ${pumps}/${cfg.maxPumps}, assumed ratio ${lastRatio}`);
          gbTimeout(step, 900);
          return;
        }
        if (err) {
          gbLogT('pt-pump-err', 60000, `phoenician: pump ${pumps} ${err}`);
          finish(null);
          return;
        }
        gbTimeout(() => {
          ptOffers(townId, (offers) => {
            const again = (offers || []).find(o => String(o.id) === String(offer.id));
            const now = again && again.ratio != null ? again.ratio : null;
            if (now == null) { finish(`ratio unreadable after pump ${pumps}`); return; }
            if (now <= lastRatio) {
              finish(`ratio did not move (${lastRatio} -> ${now}) after pump ${pumps} - aborting`);
              return;
            }
            gbLog(`phoenician: pump ${pumps}/${cfg.maxPumps} ratio ${lastRatio} -> ${now}`);
            lastRatio = now;
            if (again.stock != null) offer.stock = again.stock;
            step();
          }, true);
        }, 900 + Math.floor(Math.random() * 600));
      });
    };
    step();
  }
  function ptStatusText() {
    const townId = ptSalesmanTown();
    const tpl = state.ptTradeTpl ? 'payload learned' : 'payload NOT learned';
    const view = state.ptViewUrl ? 'view learned' : 'view NOT learned';
    return (townId == null ? 'no ship' : `ship in town ${townId}`) + `  |  ${tpl}  |  ${view}`;
  }

  const FAVOR_CHECK_MS = 60000;
  const FAVOR_TEMPLE_PLUNDER = /temple_plunder|plunder_temple|templeplunder|saqueo.?templo|plunderung.?tempel/i;

  const favorOwnMoves = Object.create(null);

  function favorCurrent() {
    try {
      const uw = gameUw();
      const gods = (uw.Game && uw.Game.gods) || (uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('PlayerGods'));
      if (!gods) return {};
      const a = gods.attributes || gods;
      return a;
    } catch (_) { return {}; }
  }
  function favorHasTemplePlunder(townId) {
    try {
      const info = typeof researchTownTechs === 'function' ? researchTownTechs(townId) : null;
      if (!info || !info.techs) return false;
      const techs = info.techs;
      for (const k of Object.keys(techs)) {
        if (!techs[k]) continue;
        if (k === 'temple_plunder' || FAVOR_TEMPLE_PLUNDER.test(k)) return true;
      }

      try {
        const uw = gameUw();
        const res = uw.GameData && uw.GameData.researches;
        if (res) {
          for (const k of Object.keys(techs)) {
            if (!techs[k]) continue;
            const r = res[k];
            if (r && FAVOR_TEMPLE_PLUNDER.test(String(r.name || r.title || ''))) return true;
          }
        }
      } catch (_) {}
      return false;
    } catch (_) { return false; }
  }
  function favorUnitOk(unit, god) {
    try {
      const uw = gameUw();
      const def = uw.GameData && uw.GameData.units && uw.GameData.units[unit];
      if (!def) return false;
      if (!def.god && !def.mythical && !def.is_mythical) return false;
      if (def.god && god && String(def.god).toLowerCase() !== String(god).toLowerCase()) return false;
      return true;
    } catch (_) { return false; }
  }
  function favorScan(reason) {
    if (!hostEnabled() || !state.autoFavor || captchaPaused('favor')) return;
    if (automationPaused({})) return;

    gbLogT('favor-disabled', 300000,
      'favor: module disabled (needs enemy-town target + canonical temple_plunder payload)');
    return;
    if (gbLocked('favor')) return;
    const cfg = state.favorCfg || {};
    const thresh = +cfg.thresh || 200;
    const unit = cfg.unit || 'harpy';
    const maxC = Math.min(8, Math.max(1, +cfg.maxConcurrent || 2));
    const fav = favorCurrent();
    const god = cfg.god || 'athena';
    const cur = +(fav[god] || fav['favor_' + god] || fav.favor || 0);

    if (cur >= thresh && !cfg.force) {
      gbLogT('favor-ok', 180000, `favor: ${god}=${cur} >= ${thresh}`);
      return;
    }
    if (!favorUnitOk(unit, god)) {
      gbLogT('favor-unit', 300000, `favor: unit ${unit} incompatible with god ${god}`);
      return;
    }

    const targetId = cfg.targetId;
    const targetType = cfg.targetType || 'farm_town';
    if (!targetId) {
      gbLogT('favor-notarget', 300000, 'favor: set favorCfg.targetId (farm town)');
      return;
    }
    if (targetType !== 'farm_town' && targetType !== 'farm' && targetType !== 'village') {
      gbLogT('favor-badtarget', 300000, `favor: targetType=${targetType} not allowed (need farm_town)`);
      return;
    }
    const uw = gameUw();

    let enroute = 0;
    const now = Date.now();
    Object.keys(favorOwnMoves).forEach(k => {
      if (favorOwnMoves[k] + 3600000 < now) delete favorOwnMoves[k];
      else enroute++;
    });
    if (enroute >= maxC) {
      gbLogT('favor-enroute', 120000, `favor: ${enroute} own en-route (>=${maxC})`);
      return;
    }

    let townId = null, units = null;
    try {
      for (const id of Object.keys((uw.ITowns && uw.ITowns.towns) || {})) {
        if (!favorHasTemplePlunder(id)) continue;
        const t = uw.ITowns.towns[id];
        const u = Object.assign({}, t.units && t.units());
        const n = +u[unit] || 0;
        const floor = +state.dodgeFloor || 0;
        if (n <= floor) continue;
        const send = {};
        send[unit] = Math.min(n - floor, cfg.perSend || 5);
        if (!(send[unit] > 0)) continue;
        townId = id;
        units = send;
        break;
      }
    } catch (_) {}
    if (!townId || !units) {
      gbLogT('favor-nounits', 180000, `favor: no ${unit} with temple_plunder above floor`);
      return;
    }
    gbLock('favor');
    const tpl = state.attackTpl;
    const payload = {
      model_url: (tpl && tpl.model_url) || ('Town/' + townId),
      action_name: (tpl && tpl.action_name) || 'sendUnits',
      arguments: Object.assign({ id: +targetId, type: 'attack' }, units),
      town_id: +townId,
    };
    payload.model_url = String(payload.model_url).replace(/Town\/\d+/, 'Town/' + townId);
    bridgePost('favor', payload, (err, data) => {
      gbUnlock('favor');
      if (err === 'timeout') {
        gbLogT('favor-timeout', 60000, 'favor: timeout_unknown - not retrying');
        return;
      }
      if (!err) {
        const mid = (data && (data.command_id || data.id || data.movement_id)) || ('f' + Date.now());
        favorOwnMoves[String(mid)] = Date.now();
        gbLog(`favor: sent ${JSON.stringify(units)} from ${townId} -> ${targetId}`);
      } else gbLogT('favor-err', 60000, `favor err ${err}`);
    });
  }

  function wonderServerDay() {
    try {
      const now = gameNow();
      const d = new Date(now * 1000);
      return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
    } catch (_) {
      return new Date().toISOString().slice(0, 10);
    }
  }
  function wonderLoadSpent() {
    const day = wonderServerDay();
    const saved = load(STORE.WONDER_SPENT, null);
    if (saved && saved.day === day) return { day, amount: +saved.amount || 0 };
    return { day, amount: 0 };
  }
  function wonderSaveSpent(spent) {
    save(STORE.WONDER_SPENT, { day: spent.day, amount: spent.amount });
  }
  let wonderSpentToday = wonderLoadSpent();

  function wonderScan(reason) {
    if (!hostEnabled() || !state.autoWonder || captchaPaused('wonder')) return;
    if (automationPaused({})) return;
    if (gbLocked('wonder')) return;
    const cfg = state.wonderCfg || {};
    const wonderId = cfg.wonderId;
    if (!wonderId) {
      gbLogT('wonder-noid', 300000, 'wonder: set wonderCfg.wonderId');
      return;
    }
    const day = wonderServerDay();
    if (wonderSpentToday.day !== day) wonderSpentToday = { day, amount: 0 };
    const budget = gbCfgNum(cfg.budget, 50000);
    if (budget <= 0) {
      gbLogT('wonder-budget0', 300000, 'wonder: budget is 0 - no donations');
      return;
    }
    if (wonderSpentToday.amount >= budget) {
      gbLogT('wonder-budget', 300000, `wonder: daily budget ${budget} reached`);
      return;
    }
    const reserve = gbCfgNum(cfg.reserve, 5000);
    const want = {
      wood: gbCfgNum(cfg.wood, 0),
      stone: gbCfgNum(cfg.stone, 0),
      iron: gbCfgNum(cfg.iron, 0),
    };
    if (!(want.wood > 0 || want.stone > 0 || want.iron > 0)) {
      gbLogT('wonder-noconf', 300000, 'wonder: set wood/stone/iron > 0 in config (no default amounts)');
      return;
    }
    const towns = (typeof tradeListTowns === 'function') ? tradeListTowns() : [];
    let job = null;
    for (const t of towns) {

      const cap = +t.tradeCap || 0;
      if (cap <= 0) continue;
      let send = {
        wood: Math.max(0, Math.min(want.wood, t.wood - reserve)),
        stone: Math.max(0, Math.min(want.stone, t.stone - reserve)),
        iron: Math.max(0, Math.min(want.iron, t.iron - reserve)),
      };
      let total = send.wood + send.stone + send.iron;
      if (total < 500) continue;
      if (total > cap) {
        const scale = cap / total;
        send = {
          wood: Math.floor(send.wood * scale),
          stone: Math.floor(send.stone * scale),
          iron: Math.floor(send.iron * scale),
        };
        total = send.wood + send.stone + send.iron;
      }
      if (total < 500) continue;
      if (wonderSpentToday.amount + total > budget) {
        const scale = (budget - wonderSpentToday.amount) / total;
        if (scale <= 0) continue;
        send.wood = Math.floor(send.wood * scale);
        send.stone = Math.floor(send.stone * scale);
        send.iron = Math.floor(send.iron * scale);
        total = send.wood + send.stone + send.iron;
        if (total < 500) continue;
      }
      job = { townId: t.id, send };
      break;
    }
    if (!job) {
      gbLogT('wonder-idle', 180000, `wonder: no surplus (${reason || 'scan'})`);
      return;
    }
    gbLock('wonder');
    const tot = job.send.wood + job.send.stone + job.send.iron;
    gameAjaxPost('wonder', 'wonders', 'send_resources', {
      id: +wonderId,
      wood: job.send.wood,
      stone: job.send.stone,
      iron: job.send.iron,
      town_id: +job.townId,
    }, (err) => {
      if (err === 'timeout') {
        gbLogT('wonder-timeout', 60000, `wonder: timeout_unknown town ${job.townId} - no fallback/duplicate`);
        gbUnlock('wonder');
        return;
      }
      if (!err) {
        wonderSpentToday.amount += tot;
        wonderSaveSpent(wonderSpentToday);
        gbLog(`wonder: town ${job.townId} sent ${tot} to WW ${wonderId}`);
        gbUnlock('wonder');
        return;
      }

      if (!/unknown|not.?found|does.?not.?exist|invalid.?controller|invalid.?action/i.test(String(err))) {
        gbLogT('wonder-err', 60000, `wonder err ${err}`);
        gbUnlock('wonder');
        return;
      }
      if (captchaPaused('wonder') || automationPaused({}) || !gbLocked('wonder')) {
        gbUnlock('wonder');
        return;
      }
      gameAjaxPost('wonder', 'factions', 'send_resources', {
        wonder_id: +wonderId,
        wood: job.send.wood, stone: job.send.stone, iron: job.send.iron,
        town_id: +job.townId,
      }, (e2) => {
        gbUnlock('wonder');
        if (!e2) {
          wonderSpentToday.amount += tot;
          wonderSaveSpent(wonderSpentToday);
          gbLog(`wonder: sent via factions from ${job.townId}`);
        } else gbLogT('wonder-err', 60000, `wonder err ${err}/${e2}`);
      });
    });
  }

  function wonderFavorScan(reason) {
    if (!hostEnabled() || !state.autoWonderFavor || captchaPaused('wonder')) return;
    if (automationPaused({})) return;
    if (gbLocked('wonder-favor')) return;
    const tpl = state.wonderFavorTpl;
    if (!tpl || !tpl.action_name) {
      gbLogT('wonder-favor-tpl', 300000, 'wonder favor: hand-cast once to teach wonderFavorTpl');
      return;
    }
    const cfg = state.wonderCfg || {};
    if (!cfg.wonderId) {
      gbLogT('wonder-favor-id', 300000, 'wonder favor: set wonderCfg.wonderId');
      return;
    }
    gbLock('wonder-favor');
    const payload = Object.assign({}, tpl, {
      arguments: Object.assign({}, tpl.arguments || {}, {
        wonder_id: +cfg.wonderId,
      }),
      town_id: tpl.town_id,
    });
    bridgePost('wonder', payload, (err) => {
      gbUnlock('wonder-favor');
      if (!err) gbLog('wonder favor: cast OK (' + (reason || 'scan') + ')');
      else if (err !== 'captcha' && err !== 'captcha-pause' && err !== 'dryrun') {
        gbLogT('wonder-favor-err', 60000, 'wonder favor err ' + err);
      }
    });
  }

  const DODGE_CHECK_MS = 5000;
  const DODGE_RETRY_MS = 15000;
  const DODGE_FAIL_BACKOFF = [15000, 45000, 120000];
  const DODGE_QUEUE_TTL = 3600000;
  function dodgeQueueLoad() {
    const raw = load(STORE.DODGE_QUEUE, null) || {};
    const cut = Date.now() - DODGE_QUEUE_TTL;
    const out = Object.create(null);
    Object.keys(raw).forEach(k => {
      const e = raw[k];
      if (!e || !(e.ts >= cut)) return;

      const st = e.state === 'sending' ? 'pending' : e.state;
      out[k] = {
        state: st || 'pending', ts: +e.ts || Date.now(), notified: !!e.notified,
        tries: +e.tries || 0, nextAt: +e.nextAt || 0,
        dest: e.dest, type: e.type, hasCs: !!e.hasCs,
      };
    });
    return out;
  }
  function dodgeQueueSave() {
    try {
      const cut = Date.now() - DODGE_QUEUE_TTL;
      const out = {};
      Object.keys(dodgeQueue).forEach(k => {
        const e = dodgeQueue[k];
        if (!e || e.ts < cut) return;
        out[k] = {
          state: e.state === 'sending' ? 'pending' : e.state,
          ts: e.ts, notified: !!e.notified, tries: e.tries || 0, nextAt: e.nextAt || 0,
          dest: e.dest, type: e.type, hasCs: !!e.hasCs,
        };
      });
      save(STORE.DODGE_QUEUE, out);
    } catch (_) {}
  }

  const dodgeQueue = dodgeQueueLoad();

  const DODGE_HOSTILE_TYPES = /^(attack|attack_sea|siege|revolt|colonize|take_over|conquer|portal_attack)$/;
  const DODGE_FRIENDLY_TYPES = /^(support|support_sea|trade|return|spy|farm|reward)$/;
  function dodgeIsHostileMovement(a) {
    const type = String(a.command_name || a.type || a.movement_type || '').toLowerCase().trim();
    if (DODGE_FRIENDLY_TYPES.test(type)) return false;
    if (a.is_attack === true || a.is_attack === 1) return true;
    if (DODGE_HOSTILE_TYPES.test(type)) return true;

    if (a.command_type === 'attack' || a.movement_type === 'attack') return true;
    return false;
  }
  function dodgeIncomingMovements(opts) {
    const uw = gameUw();
    const out = [];
    const includeFriendly = !!(opts && opts.includeFriendly);
    try {
      const col = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('MovementsUnits');
      if (!col || !col.models) return out;
      const myTowns = new Set(Object.keys((uw.ITowns && uw.ITowns.towns) || {}).map(String));
      col.models.forEach(m => {
        const a = m.attributes || {};
        const dest = String(a.destination_town_id || a.target_town_id || '');
        if (!myTowns.has(dest)) return;
        const hostile = dodgeIsHostileMovement(a);
        if (!hostile) {
          if (!includeFriendly) return;
          const type0 = String(a.command_name || a.type || a.movement_type || '').toLowerCase().trim();
          if (!/^support/.test(type0) && !DODGE_FRIENDLY_TYPES.test(type0)) return;

          if (!/^support/.test(type0)) return;
        }

        const origin = String(a.origin_town_id || a.home_town_id || '');
        if (myTowns.has(origin) && a.is_attack !== true && a.is_attack !== 1) return;
        if (myTowns.has(origin) && !a.incoming) return;
        const type = String(a.command_name || a.type || a.movement_type || '').toLowerCase();
        const units = a.units || {};
        const hasCs = !!(units.colonize_ship || units.colony_ship);
        let arrival = a.arrived_at || a.arrival_at || a.finished_at;
        try {
          if (arrival == null && typeof m.getArrivalAt === 'function') arrival = m.getArrivalAt();
        } catch (_) {}
        out.push({
          id: a.id || m.id,
          dest, origin, type, hasCs,
          hostile,
          arrival,
          units,
          model: m,
        });
      });
    } catch (_) {}
    return out;
  }

  function dodgeSafeTown(excludeId, incoming) {
    try {
      const uw = gameUw();
      const threatened = new Set();
      (incoming || dodgeIncomingMovements() || []).forEach(m => threatened.add(String(m.dest)));
      const ids = Object.keys((uw.ITowns && uw.ITowns.towns) || {})
        .filter(id => String(id) !== String(excludeId));
      const clean = ids.filter(id => !threatened.has(String(id)));
      if (clean.length) return clean[0];
      if (ids.length) {
        gbLogT('dodge-nosafe', 120000,
          'dodge: every other town has incoming - no safe destination');
        return null;
      }
    } catch (_) {}
    return null;
  }

  function dodgeCanRaiseMilitia(townId) {
    const farm = gbBuildingLevel(townId, 'farm');
    if (farm != null && farm < 1) return { ok: false, why: 'no farm building' };
    try {
      const uw = gameUw();
      const t = uw.ITowns && uw.ITowns.towns && uw.ITowns.towns[townId];
      const u = (t && t.units && t.units()) || null;
      if (u && +u.militia > 0) return { ok: false, why: 'militia already standing' };
    } catch (_) {}
    return { ok: true, why: null };
  }
  function dodgeRaiseMilitia(townId, onDone) {
    const can = dodgeCanRaiseMilitia(townId);
    if (!can.ok) {
      gbLogT('militia-skip-' + townId, 120000, `militia: town ${townId} skipped (${can.why})`);
      return onDone && onDone('skip:' + can.why);
    }
    gameAjaxPost('militia', 'building_farm', 'request_militia', { town_id: +townId }, onDone);
  }
  function dodgeSendOut(townId, units, safeId, onDone) {
    const payload = {
      model_url: 'Town/' + townId,
      action_name: (state.attackTpl && state.attackTpl.action_name) || 'sendUnits',
      arguments: Object.assign({ id: +safeId, type: 'support' }, units),
      town_id: +townId,
    };
    bridgePost('dodge', payload, onDone);
  }
  function dodgeTownUnits(townId) {
    try {
      const uw = gameUw();
      const t = uw.ITowns.towns[townId];
      const u = Object.assign({}, t.units && t.units());
      delete u.militia;
      const floor = +state.dodgeFloor || 0;

      if (floor > 0) {
        ['sword', 'hoplite', 'archer'].forEach(k => {
          if (u[k] > floor) u[k] -= floor;
          else delete u[k];
        });
      }
      Object.keys(u).forEach(k => { if (!(+u[k] > 0)) delete u[k]; });
      return u;
    } catch (_) { return {}; }
  }
  function dodgeNotify(mov, entry) {
    if (entry.notified) return;
    entry.notified = true;
    const msg = `incoming ${mov.type || 'atk'} -> town ${mov.dest}` + (mov.hasCs ? ' [CS]' : '') +
      (mov.arrival ? ` ETA ${mov.arrival}` : '');
    gbLog('dodge: ' + msg);
    flash(msg);
    try { alertWebhook('attack', mov); } catch (_) {}
    if (mov.hasCs && state.csAlert !== false) {
      try { alertWebhook('attack', Object.assign({ cs: true }, mov)); } catch (_) {}
    }

    if (state.autoMilitia && !captchaPausedAny('militia', 'dodge')) {
      dodgeRaiseMilitia(mov.dest, (err) => {
        if (!err) gbLog(`militia: raised in ${mov.dest}`);
      });
    }
  }
  function dodgeTrySend(entry, mov) {
    if (entry.state === 'sent' || entry.state === 'sending') return;
    if (!state.autoDodge || (state.dodgeMode || 'notify') !== 'auto') {
      entry.state = 'notified';
      return;
    }
    if (captchaPaused('dodge')) return;
    if (gbLocked('dodge')) {
      entry.state = 'pending';
      entry.nextAt = Date.now() + 2000;
      return;
    }
    const safe = dodgeSafeTown(mov.dest);
    const units = dodgeTownUnits(mov.dest);
    if (!safe || !Object.keys(units).length) {
      entry.state = 'pending';
      entry.tries = (entry.tries || 0) + 1;
      const bo = DODGE_FAIL_BACKOFF[Math.min(entry.tries - 1, DODGE_FAIL_BACKOFF.length - 1)];
      entry.nextAt = Date.now() + bo;
      gbLogT('dodge-nousable', 30000, `dodge: no safe town/units for ${mov.dest} (retry)`);
      return;
    }
    entry.state = 'sending';
    gbLock('dodge');
    dodgeSendOut(mov.dest, units, safe, (err) => {
      gbUnlock('dodge');
      if (!err) {
        entry.state = 'sent';
        entry.ts = Date.now();
        gbLog(`dodge: sent units from ${mov.dest} -> ${safe}`);
      } else {
        entry.state = 'failed';
        entry.tries = (entry.tries || 0) + 1;
        const bo = DODGE_FAIL_BACKOFF[Math.min(entry.tries - 1, DODGE_FAIL_BACKOFF.length - 1)];
        entry.nextAt = Date.now() + bo;
        gbLog(`dodge: send failed ${err} (retry in ${Math.round(bo / 1000)}s)`);
      }
      dodgeQueueSave();
    });
  }
  function dodgeScan(reason) {
    if (!hostEnabled()) return;
    if (automationPaused({})) return;
    const wantDodge = state.autoDodge;
    const wantCs = state.csAlert !== false;
    const wantMilitia = state.autoMilitia;
    if (!wantDodge && !wantCs && !wantMilitia) return;

    const dodgeOk = wantDodge && !captchaPaused('dodge');
    const militiaOk = wantMilitia && !captchaPausedAny('militia', 'dodge');
    if (!dodgeOk && !militiaOk && !wantCs) return;
    const incoming = dodgeIncomingMovements();
    const live = new Set();
    const now = Date.now();
    for (const mov of incoming) {
      const key = String(mov.id);
      live.add(key);
      let entry = dodgeQueue[key];
      if (!entry) {
        entry = dodgeQueue[key] = {
          state: 'pending', ts: now, notified: false, tries: 0, nextAt: 0,
          dest: mov.dest, type: mov.type, hasCs: mov.hasCs,
        };
      }
      if (wantCs || militiaOk || dodgeOk) dodgeNotify(mov, entry);
      if (!dodgeOk) continue;
      if (entry.state === 'sent') continue;
      if (entry.state === 'sending') continue;
      if (entry.nextAt && entry.nextAt > now) continue;
      if (entry.state === 'failed' || entry.state === 'pending' || entry.state === 'notified') {
        dodgeTrySend(entry, mov);
      }
    }

    const cut = now - DODGE_QUEUE_TTL;
    Object.keys(dodgeQueue).forEach(k => {
      const e = dodgeQueue[k];
      if (!live.has(k) && e.ts < cut) delete dodgeQueue[k];
      else if (e.state === 'sent' && e.ts < cut) delete dodgeQueue[k];
    });
    dodgeQueueSave();
  }

  const RECRUIT_SPELLS = ['call_of_the_ocean', 'spartan_training', 'fertility_improvement'];

  function recruitUnitDef(unitId) {
    try {
      const uw = gameUw();
      return (uw.GameData && uw.GameData.units && uw.GameData.units[unitId]) || null;
    } catch (_) { return null; }
  }
  function recruitControllerFor(unitId) {
    const def = recruitUnitDef(unitId);
    if (!def) return null;
    if (def.is_naval || def.naval) return { controller: 'building_docks', feature: 'recruit' };
    if (def.god || def.mythical || def.is_mythical) return { controller: 'building_place', feature: 'recruit' };

    return { controller: 'building_barracks', feature: 'recruit' };
  }
  function recruitHasSpell(townId, powerId) {
    try {
      const uw = gameUw();
      const col = uw.MM && uw.MM.getFirstTownAgnosticCollectionByName &&
        uw.MM.getFirstTownAgnosticCollectionByName('CastedPowers');
      const frag = col && col.fragments && col.fragments[townId];
      const models = (frag && frag.models) || [];
      return models.some(m => {
        const pid = (m.attributes || {}).power_id;
        if (powerId) return pid === powerId;
        return RECRUIT_SPELLS.includes(pid);
      });
    } catch (_) { return false; }
  }
  function recruitCastSpell(townId, powerId, onDone) {
    if (!powerId || !RECRUIT_SPELLS.includes(powerId)) return onDone && onDone('bad-power');
    gameAjaxPost('spell', 'town_overviews', 'cast_power', {
      power_id: powerId,
      town_id: +townId,
    }, onDone);
  }
  function recruitBuild(townId, unitId, amount, onDone) {
    const ctrl = recruitControllerFor(unitId);
    if (!ctrl) return onDone && onDone('unknown-unit');
    gameAjaxPost('recruit', ctrl.controller, 'build', {
      unit_id: unitId,
      amount: +amount,
      town_id: +townId,
    }, onDone);
  }
  function recruitCanBuild(townId, unitId) {
    const def = recruitUnitDef(unitId);
    if (!def) return false;
    try {
      const uw = gameUw();
      const t = uw.ITowns.towns[townId];
      if (!t) return false;

      if (def.research_required || def.research_dependencies) {
        const info = typeof researchTownTechs === 'function' ? researchTownTechs(townId) : null;
        const need = def.research_required || def.research_dependencies;
        const list = Array.isArray(need) ? need : [need];
        for (const tech of list) {
          if (tech && info && info.techs && !info.techs[tech]) return false;
        }
      }
      if (def.god) {

        let temple = 0;
        try { temple = t.getBuildings ? +t.getBuildings().get('temple') : +(t.buildings().attributes || {}).temple; } catch (_) {}
        if (!(temple > 0)) return false;
      }
      if (def.is_naval || def.naval) {
        let docks = 0;
        try { docks = t.getBuildings ? +t.getBuildings().get('docks') : +(t.buildings().attributes || {}).docks; } catch (_) {}
        if (!(docks > 0)) return false;
      } else if (!def.god && !def.mythical) {
        let bar = 0;
        try { bar = t.getBuildings ? +t.getBuildings().get('barracks') : +(t.buildings().attributes || {}).barracks; } catch (_) {}
        if (!(bar > 0)) return false;
      }
      return true;
    } catch (_) { return false; }
  }
  function recruitScan(reason) {
    if (!hostEnabled() || !state.autoRecruit || captchaPaused('recruit')) return;
    if (automationPaused({})) return;
    if (gbLocked('recruit')) return;
    const targets = state.recruitTargets || {};
    const townIds = Object.keys(targets);
    if (!townIds.length) {
      gbLogT('recruit-empty', 300000, 'recruit: no town targets configured');
      return;
    }
    const uw = gameUw();
    let job = null;
    for (const tid of townIds) {
      const want = targets[tid];
      if (!want || typeof want !== 'object') continue;
      let t = null;
      try { t = uw.ITowns.towns[tid]; } catch (_) {}
      if (!t) continue;

      if (state.recruitSpells) {
        const wantPower = (state.favorCfg && state.favorCfg.recruitPower) || null;

        if (wantPower && RECRUIT_SPELLS.includes(wantPower) && !recruitHasSpell(tid, wantPower)
            && !captchaPausedAny('recruit', 'spell')) {
          job = { kind: 'spell', townId: tid, power: wantPower };
          break;
        }
      }
      let orders = 0;
      try {
        const col = t.getUnitOrdersCollection && t.getUnitOrdersCollection();
        orders = (col && col.models && col.models.length) || 0;
      } catch (_) {}
      if (orders >= 7) continue;
      const have = Object.assign({}, t.units && t.units());
      try {
        const outer = t.unitsOuter && t.unitsOuter();
        if (outer) Object.keys(outer).forEach(k => { have[k] = (have[k] || 0) + outer[k]; });
      } catch (_) {}
      for (const unit of Object.keys(want)) {
        const tgt = +want[unit] || 0;
        if (!(tgt > 0)) continue;
        if (!recruitCanBuild(tid, unit)) continue;
        if (!recruitControllerFor(unit)) continue;
        const cur = +have[unit] || 0;
        let queued = 0;
        try {
          const col = t.getUnitOrdersCollection && t.getUnitOrdersCollection();
          (col && col.models || []).forEach(m => {
            const a = m.attributes || {};
            if (a.unit_type === unit) queued += +a.count || 0;
          });
        } catch (_) {}
        const need = tgt - cur - queued;
        if (need <= 0) continue;
        let amount = need;
        try {
          const def = recruitUnitDef(unit);
          const r = t.resources();
          const pop = t.getAvailablePopulation();
          if (!def || !def.resources) {

            gbLogT('recruit-nocost', 120000, `recruit: unknown cost for ${unit}`);
            try { gbRemember('recruit', 'build/' + unit, tid, 'unknown-cost'); } catch (_) {}
            continue;
          }
          const rw = +def.resources.wood || 0;
          const rs = +def.resources.stone || 0;
          const ri = +def.resources.iron || 0;
          const rp = +def.population || 0;

          const byW = rw > 0 ? Math.floor(r.wood / rw) : amount;
          const byS = rs > 0 ? Math.floor(r.stone / rs) : amount;
          const byI = ri > 0 ? Math.floor(r.iron / ri) : amount;
          const byP = rp > 0 ? Math.floor(pop / rp) : amount;
          amount = Math.min(amount, byW, byS, byI, byP);
        } catch (_) { continue; }
        if (!(amount > 0)) continue;
        amount = Math.min(amount, 50);
        job = { kind: 'build', townId: tid, unit, amount };
        break;
      }
      if (job) break;
    }
    if (!job) {
      gbLogT('recruit-idle', 180000, `recruit: idle (${reason || 'scan'})`);
      return;
    }
    gbLock('recruit');
    if (job.kind === 'spell') {
      recruitCastSpell(job.townId, job.power, (err) => {
        gbUnlock('recruit');
        if (!err) gbLog(`spell: ${job.power} on ${job.townId}`);
        else gbLogT('spell-err', 60000, `spell err ${err}`);
      });
      return;
    }
    recruitBuild(job.townId, job.unit, job.amount, (err) => {
      gbUnlock('recruit');
      if (!err) gbLog(`recruit: town ${job.townId} ${job.amount}x ${job.unit}`);
      else gbLogT('recruit-err', 60000, `recruit err ${err}`);
    });
  }

  function qolBindActivityPause() {
    if (qolBindActivityPause._bound) return;
    qolBindActivityPause._bound = true;
    const bump = () => bumpUserActivity();
    ['mousemove', 'keydown', 'mousedown', 'touchstart'].forEach(ev => {
      gbListen(document, ev, bump, { passive: true });
    });
    gbListen(document, 'visibilitychange', () => {
      if (!document.hidden) bumpUserActivity();
    });
  }
  function qolSaveTemplate(name) {
    if (!name) return;
    if (!state.cityTemplates) state.cityTemplates = {};
    state.cityTemplates[name] = {
      abTargets: JSON.parse(JSON.stringify(state.abTargets || {})),
      researchTargets: JSON.parse(JSON.stringify(state.researchTargets || {})),
      recruitTargets: JSON.parse(JSON.stringify(state.recruitTargets || {})),
      savedAt: Date.now(),
    };
    save(STORE.CITY_TEMPLATES, state.cityTemplates);
    gbLog(`template: saved "${name}"`);
    flash('template saved: ' + name);
  }
  function qolApplyTemplate(name) {
    const t = state.cityTemplates && state.cityTemplates[name];
    if (!t) { flash('template missing'); return; }

    if (t.abTargets) {
      state.abTargets = JSON.parse(JSON.stringify(t.abTargets));
      save(STORE.AB_TARGETS, state.abTargets);
    }
    if (t.researchTargets) {
      state.researchTargets = JSON.parse(JSON.stringify(t.researchTargets));
      save(STORE.RESEARCH_TARGETS, state.researchTargets);
    }
    if (t.recruitTargets) {
      state.recruitTargets = JSON.parse(JSON.stringify(t.recruitTargets));
      save(STORE.RECRUIT_TARGETS, state.recruitTargets);
    }
    gbLog(`template: applied "${name}"`);
    flash('template applied: ' + name);
    try { renderAbQueue && renderAbQueue(); } catch (_) {}
  }
  function qolSetTownGroup(groupName, townIds) {
    if (!state.townGroups) state.townGroups = {};
    state.townGroups[groupName] = (townIds || []).map(String);
    save(STORE.TOWN_GROUPS, state.townGroups);
  }
  function qolApplyGroupTemplate(groupName, templateName) {
    const ids = (state.townGroups && state.townGroups[groupName]) || [];
    const t = state.cityTemplates && state.cityTemplates[templateName];
    if (!t || !ids.length) { flash('group/template missing'); return; }

    if (t.recruitTargets) {
      const sample = Object.values(t.recruitTargets)[0] || t.recruitTargets;
      if (!state.recruitTargets) state.recruitTargets = {};
      ids.forEach(id => { state.recruitTargets[id] = JSON.parse(JSON.stringify(sample)); });
      save(STORE.RECRUIT_TARGETS, state.recruitTargets);
    }
    if (t.abTargets) {
      state.abTargets = JSON.parse(JSON.stringify(t.abTargets));
      save(STORE.AB_TARGETS, state.abTargets);
    }
    if (t.researchTargets) {
      state.researchTargets = JSON.parse(JSON.stringify(t.researchTargets));
      save(STORE.RESEARCH_TARGETS, state.researchTargets);
    }
    gbLog(`group "${groupName}": applied template "${templateName}" -> ${ids.length} towns`);
  }
  function qolOverviewData() {
    const uw = gameUw();
    let townN = 0, farmReady = 0, farmTotal = 0, cultureBusy = 0;
    let buildQ = 0, researchQ = 0, caveFill = [];
    try { townN = Object.keys((uw.ITowns && uw.ITowns.towns) || {}).length; } catch (_) {}
    try {
      const rel = ruralRelModels && ruralRelModels();
      if (rel) {
        farmTotal = rel.length;
        const now = gameNow();
        rel.forEach(r => {
          const a = r.attributes || {};
          if (+a.relation_status === 1 && (!a.lootable_at || +a.lootable_at <= now)) farmReady++;
        });
      }
    } catch (_) {}
    try {
      const models = uw.MM && uw.MM.getModels && uw.MM.getModels().Celebration;
      if (models) cultureBusy = Object.keys(models).length;
    } catch (_) {}
    try {
      const bo = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('BuildingOrder');
      if (bo && bo.models) buildQ = bo.models.length;
    } catch (_) {}
    try {
      const ro = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('ResearchOrder');
      if (ro && ro.models) researchQ = ro.models.length;
    } catch (_) {}
    try {
      const ids = (typeof caveListTownIds === 'function') ? caveListTownIds() : [];
      ids.slice(0, 20).forEach(id => {
        const info = typeof caveTownInfo === 'function' ? caveTownInfo(id) : null;
        if (info && info.hideCap) caveFill.push({ id, pct: Math.round(100 * (info.stored || 0) / info.hideCap) });
      });
    } catch (_) {}
    const breakers = Object.keys(state.captchaBreakers || {}).filter(k => captchaPaused(k));
    const pause = {};
    automationPaused(pause);
    return {
      townN, farmReady, farmTotal, cultureBusy, buildQ, researchQ, caveFill,
      breakers, pause: pause.reason || null,
      health: Object.assign({}, moduleHealth),
      globalCaptcha: captchaGlobalUntil > Date.now() ? captchaGlobalUntil : 0,
      userPause: userPausedUntil > Date.now() ? userPausedUntil : 0,
    };
  }
  function renderOverview() {
    const box = panel && panel.querySelector('.overview-panel');
    if (!box) return;
    const sec = box.closest('section[data-tab]');
    if (sec && sec.hidden) return;
    const d = qolOverviewData();
    const lines = [
      `Towns: ${d.townN}`,
      `Farms ready: ${d.farmReady}/${d.farmTotal}`,
      `Culture busy: ${d.cultureBusy}`,
      `Build queue: ${d.buildQ} | Research queue: ${d.researchQ}`,
      d.pause ? `|| paused: ${d.pause}` : 'Automation: active',
      d.breakers.length ? `Captcha: ${d.breakers.join(',')}` : 'Captcha: clear',
      (() => {
        const parts = Object.keys(d.health).map(k => {
          const h = d.health[k];
          return `${k} ok${h.ok}/err${h.err}/cap${h.captcha}`;
        });
        return 'Health: ' + (parts.length ? parts.join('  |  ') : '(none yet)');
      })(),
    ];
    box.textContent = lines.join('\n');
  }

  function qolRedactConfigDump(dump) {
    if (state.exportRedact === false) {
      gbLogT('cfg-export-raw', 60000, 'export config: redaction OFF - dump contains player names');
      return dump;
    }
    const cut = (s) => (s ? String(s).slice(0, 1) + '...' : s);
    const redactNotes = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      const out = {};
      Object.keys(obj).forEach((k, i) => { out[cut(k) + i] = '<note>'; });
      return out;
    };
    dump.playerNotes = redactNotes(dump.playerNotes);
    dump.allianceNotes = redactNotes(dump.allianceNotes);
    dump.watchlist = (dump.watchlist || []).map((w) => {
      if (!w || typeof w !== 'object') return cut(w);
      const out = {};
      Object.keys(w).forEach((k) => { out[k] = typeof w[k] === 'string' ? cut(w[k]) : w[k]; });
      return out;
    });
    dump.redacted = true;
    return dump;
  }
  function qolExportConfig() {
    const dump = {
      ver: state.configVer || 1,
      host: location.host,
      abTargets: state.abTargets,
      researchTargets: state.researchTargets,
      recruitTargets: state.recruitTargets,
      cityTemplates: state.cityTemplates,
      townGroups: state.townGroups,
      cultureTypes: state.cultureTypes,
      favorCfg: state.favorCfg,
      wonderCfg: state.wonderCfg,
      merchantWish: state.merchantWish,
      priorityOrder: state.priorityOrder,
      playerNotes: state.playerNotes,
      allianceNotes: state.allianceNotes,
      watchlist: state.watchlist,
    };
    return qolRedactConfigDump(dump);
  }
  function qolImportConfig(obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (obj.redacted) {
      gbLog('config import refused: dump is redacted (re-export with redaction OFF)');
      return false;
    }
    const keys = ['abTargets', 'researchTargets', 'recruitTargets', 'cityTemplates', 'townGroups',
      'cultureTypes', 'favorCfg', 'wonderCfg', 'merchantWish', 'priorityOrder', 'playerNotes',
      'allianceNotes', 'watchlist'];
    keys.forEach(k => {
      if (obj[k] != null) {
        state[k] = obj[k];
        const storeKey = {
          abTargets: STORE.AB_TARGETS,
          researchTargets: STORE.RESEARCH_TARGETS,
          recruitTargets: STORE.RECRUIT_TARGETS,
          cityTemplates: STORE.CITY_TEMPLATES,
          townGroups: STORE.TOWN_GROUPS,
          cultureTypes: STORE.CULTURE_TYPES,
          favorCfg: STORE.FAVOR_CFG,
          wonderCfg: STORE.WONDER_CFG,
          merchantWish: STORE.MERCHANT_WISH,
          priorityOrder: STORE.PRIORITY_ORDER,
          playerNotes: STORE.PLAYER_NOTES,
          allianceNotes: STORE.ALLIANCE_NOTES,
          watchlist: STORE.WATCHLIST,
        }[k];
        if (storeKey) save(storeKey, state[k]);
      }
    });
    state.configVer = (obj.ver || 1);
    save(STORE.CONFIG_VER, state.configVer);
    gbLog('config imported');
    return true;
  }

  const ORCH_MS = 20000;
  const ORCH_MAX_PER_TICK = 3;
  const ORCH_SPACING_MS = 450;
  const ORCH_JITTER = 0.2;
  let orchTickGen = 0;
  function orchCancelQueued() { orchTickGen++; }
  const ORCH_CADENCE = {
    culture: 90000,
    cave: 30000,
    build: 30000,
    research: 45000,
    trade: 120000,
    farm: 60000,
    ruraltrade: 90000,
    rurallevel: 120000,
    recruit: 30000,
    merchant: 45000,
    pttrade: 120000,
    favor: 60000,
    wonder: 180000,
  };
  const ORCH_CAPTCHA = {
    culture: 'culture', cave: 'cave', build: 'build', research: 'research',
    trade: 'trade', farm: 'farm', ruraltrade: 'ruraltrade', rurallevel: 'rurallevel',
    recruit: 'recruit', merchant: 'merchant', pttrade: 'pttrade', favor: 'favor', wonder: 'wonder',
  };

  const ORCH_JRN = {
    culture: 'culture', cave: 'cave', build: 'build', research: 'research',
    trade: 'trade', farm: 'farm', ruraltrade: 'ruraltrade', rurallevel: 'rurallevel',
    recruit: 'recruit', merchant: 'merchant', pttrade: 'pttrade', favor: 'favor', wonder: 'wonder',
  };
  const ORCH_IDLE_TRIP = 4;
  const ORCH_IDLE_MAX = 8;
  const orchLastRun = {};
  const orchIdle = {};
  const orchJrnMark = {};
  const ORCH_HANDLERS = {
    culture: () => { try { cultureScan('orch'); } catch (_) {} },
    cave: () => { try { caveScan('orch'); } catch (_) {} },
    build: () => { try { abEnsureTargets(); abScan('orch'); } catch (_) {} },
    research: () => { try { researchScan('orch'); } catch (_) {} },
    trade: () => { try { tradeScan('orch'); } catch (_) {} },
    farm: () => { try { autoClaimFarms('orch'); } catch (_) {} },
    ruraltrade: () => { try { ruralTradeScan('orch'); } catch (_) {} },
    rurallevel: () => { try { ruralLevelScan('orch'); } catch (_) {} },
    recruit: () => { try { recruitScan('orch'); } catch (_) {} },
    merchant: () => { try { merchantScan('orch'); } catch (_) {} },
    pttrade: () => { try { ptTradeScan('orch'); } catch (_) {} },
      favor: () => { try { favorScan('orch'); } catch (_) {} },
      wonder: () => {
        try { wonderScan('orch'); } catch (_) {}
        try { wonderFavorScan('orch'); } catch (_) {}
      },
    };
  function orchFeatureEnabled(key) {
    return {
      culture: state.autoCulture,
      cave: state.autoCave,
      build: state.abAuto,
      research: state.autoResearch,
      trade: state.autoTrade || state.islandShip,
      farm: state.autoFarm,
      ruraltrade: state.autoRuralTrade,
      rurallevel: state.autoRuralLevel,
      recruit: state.autoRecruit,
      merchant: state.autoMerchant,
      favor: state.autoFavor,
      wonder: state.autoWonder,
    }[key];
  }
  function orchDefaultOrder() {
    return PRIORITY_ORDER_DEFAULT.slice();
  }

  function orchJrnCount(key) {
    const f = ORCH_JRN[key];
    if (!f) return 0;
    let n = 0;
    const list = state.decisions || [];
    for (let i = list.length - 1; i >= 0 && n < 100000; i--) {
      if (list[i].f === f) n++;
    }
    return n;
  }

  let _econDeadlock = { open: false, towns: [], at: 0 };
  function econDeadlock() {
    if (state.orchDeadlockResolve === false) {
      if (_econDeadlock.open) {
        _econDeadlock = { open: false, towns: [], at: Date.now() };
        gbLog('orch: deadlock resolve OFF - cleared');
      }
      return _econDeadlock;
    }
    const pinned = [];
    try {
      const towns = (typeof townsFromGame === 'function' ? townsFromGame() : null) || state.towns || [];
      towns.forEach(t => {
        const id = t && t.id != null ? t.id : t;
        if (id == null) return;
        if (townIsPinned(id)) pinned.push(String(id));
      });
    } catch (_) {}
    const farmOn = !!state.autoFarm;
    const farmIdle = (orchIdle.farm || 0) >= 2;
    const open = pinned.length > 0 && farmOn && farmIdle;
    if (open && !_econDeadlock.open) {
      gbLog('orch: warehouse deadlock OPEN towns=' + pinned.join(','));
    } else if (!open && _econDeadlock.open) {
      gbLog('orch: warehouse deadlock CLOSED');
    }
    _econDeadlock = { open, towns: pinned, at: Date.now() };
    return _econDeadlock;
  }
  function orchIdleFactor(key) {
    if (state.orchAdaptive === false) return 1;

    const dl = _econDeadlock;
    if (dl && dl.open && (key === 'cave' || key === 'trade' || key === 'ruraltrade')) return 1;
    const streak = orchIdle[key] || 0;
    if (streak < ORCH_IDLE_TRIP) return 1;
    return Math.min(ORCH_IDLE_MAX, 1 << Math.min(3, streak - ORCH_IDLE_TRIP + 1));
  }
  function orchCadence(key) {
    const base = (ORCH_CADENCE[key] || ORCH_MS) * orchIdleFactor(key);
    const jitter = 1 + (Math.random() * 2 - 1) * ORCH_JITTER;
    return Math.round(base * jitter);
  }
  function orchNoteResult(key) {
    const before = orchJrnMark[key];
    const after = orchJrnCount(key);
    orchJrnMark[key] = after;
    if (before == null) return;
    if (after > before) {
      if (orchIdle[key]) {
        gbLogT('orch-wake-' + key, 300000, `orch: ${key} acted, cadence back to normal`);
      }
      orchIdle[key] = 0;
      return;
    }
    orchIdle[key] = (orchIdle[key] || 0) + 1;
    if (orchIdle[key] === ORCH_IDLE_TRIP) {
      gbLog(`orch: ${key} idle ${ORCH_IDLE_TRIP}x - widening cadence (adaptive)`);
    }
  }

  function orchStatus() {
    const now = Date.now();
    return orchDefaultOrder().map(key => ({
      key,
      on: !!orchFeatureEnabled(key),
      cadenceMs: (ORCH_CADENCE[key] || ORCH_MS) * orchIdleFactor(key),
      idle: orchIdle[key] || 0,
      captcha: captchaPaused(ORCH_CAPTCHA[key] || key),
      dueInMs: Math.max(0, ((orchLastRun[key] || 0) + (ORCH_CADENCE[key] || ORCH_MS) * orchIdleFactor(key)) - now),
    }));
  }
  function orchTick() {
    if (!hostEnabled()) return;
    if (automationPaused({})) return;
    const dl = econDeadlock();
    const configured = (state.priorityOrder && state.priorityOrder.length)
      ? state.priorityOrder : orchDefaultOrder();

    const order = configured.concat(orchDefaultOrder().filter(k => configured.indexOf(k) === -1));
    const now = Date.now();
    const due = [];
    for (let i = 0; i < order.length; i++) {
      const key = order[i];
      if (!ORCH_HANDLERS[key]) continue;
      if (!orchFeatureEnabled(key)) continue;
      const cap = ORCH_CAPTCHA[key];
      if (cap && captchaPaused(cap)) continue;
      const cadence = orchCadence(key);
      const last = orchLastRun[key] || 0;
      const overdue = now - last - cadence;
      if (overdue < 0) continue;
      due.push({ key, rank: i, overdue });
    }
    if (!due.length) return;
    const DRAIN_RANK = { cave: 0, trade: 1, ruraltrade: 2, farm: 99 };
    due.sort((a, b) => {
      if (dl && dl.open) {
        const da = DRAIN_RANK[a.key], db = DRAIN_RANK[b.key];
        if (da != null && db != null && da !== db) return da - db;
        if (da != null && db == null) return -1;
        if (db != null && da == null) return 1;
      }
      const gap = b.overdue - a.overdue;
      if (Math.abs(gap) > ORCH_MS * 2) return gap;
      return a.rank - b.rank;
    });
    if (dl && dl.open && !due.some(d => d.key === 'cave' || d.key === 'trade' || d.key === 'ruraltrade')) {
      gbLogT('deadlock-stuck', 300000, 'orch: deadlock open but nothing can drain - spend resources manually');
    }
    const run = due.slice(0, ORCH_MAX_PER_TICK);
    const gen = orchTickGen;
    run.forEach((item, idx) => {
      const fire = () => {
        if (gen !== orchTickGen) return;

        if (automationPaused({})) return;
        if (ORCH_CAPTCHA[item.key] && captchaPaused(ORCH_CAPTCHA[item.key])) return;
        orchLastRun[item.key] = Date.now();
        orchJrnMark[item.key] = orchJrnCount(item.key);
        ORCH_HANDLERS[item.key]();

        gbTimeout(() => orchNoteResult(item.key), 4000);
      };
      if (idx === 0) fire();
      else gbTimeout(fire, idx * ORCH_SPACING_MS + Math.floor(Math.random() * 200));
    });
  }

  function intelPlayerKey(p) {
    if (p == null) return null;
    if (typeof p === 'string') return p.trim() || null;
    if (typeof p === 'object') {
      if (p.id != null) return 'id:' + p.id;
      if (p.name) return String(p.name);
      if (p.player_name) return String(p.player_name);
    }
    return null;
  }
  function intelPlayerLabel(p, key) {
    if (p && typeof p === 'object' && (p.name || p.player_name)) return p.name || p.player_name;
    if (typeof p === 'string') return p;
    if (key && key.indexOf('id:') === 0) return key.slice(3);
    return key || 'unknown';
  }
  function intelDossiers() {
    const byPlayer = {};
    for (const f of (state.findings || [])) {
      const raw = f.attacker || f.defender || f.player || null;
      const key = intelPlayerKey(raw) || 'unknown';
      if (!byPlayer[key]) {
        byPlayer[key] = {
          player: intelPlayerLabel(raw, key),
          key,
          reports: 0,
          units: [],
          towns: [],
          walls: [],
          last: 0,
        };
      }
      const d = byPlayer[key];
      d.reports++;
      if (f.units) d.units.push(f.units);
      if (f.town && (f.town.id != null || f.town.name)) d.towns.push(f.town);
      if (f.wall != null) d.walls.push(f.wall);
      if (f.ts && f.ts > d.last) d.last = f.ts;
      const noteKey = (raw && typeof raw === 'object' && raw.name) ? raw.name : d.player;
      if (state.playerNotes && state.playerNotes[noteKey]) d.note = state.playerNotes[noteKey];
      if (state.allianceNotes && f.alliance && state.allianceNotes[f.alliance]) {
        d.allianceNote = state.allianceNotes[f.alliance];
      }
    }
    return Object.values(byPlayer).sort((a, b) => b.last - a.last);
  }
  function intelFmtLandsIn(secLeft) {
    if (secLeft == null || !isFinite(secLeft)) return null;
    const s = Math.max(0, Math.floor(secLeft));
    if (s < 600) {
      const m = Math.floor(s / 60), r = s % 60;
      return m + 'm ' + String(r).padStart(2, '0') + 's';
    }
    if (s < 3600) return Math.floor(s / 60) + 'm';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h + 'h ' + m + 'm';
  }
  function intelThreatBoard() {
    const raw = (typeof dodgeIncomingMovements === 'function')
      ? dodgeIncomingMovements({ includeFriendly: true })
      : [];
    const now = gameNow();
    const rows = raw.map(t => {
      const arrival = t.arrival != null ? +t.arrival : null;
      let etaSec = null, landsIn = 'eta unknown', abs = '';
      if (arrival != null && isFinite(arrival) && arrival > 0) {

        const arrMs = arrival > 1e12 ? arrival : arrival * 1000;
        const nowMs = now > 1e12 ? now : now * 1000;
        etaSec = Math.max(0, Math.round((arrMs - nowMs) / 1000));
        landsIn = intelFmtLandsIn(etaSec) || 'eta unknown';
        try { abs = new Date(arrMs).toLocaleTimeString(); } catch (_) { abs = ''; }
      }
      const kind = t.hostile === false || /^support/.test(String(t.type || ''))
        ? 'support'
        : (t.hasCs ? 'CS' : 'attack');
      return Object.assign({}, t, {
        kind,
        etaSec,
        landsIn,
        absTime: abs,
        urgent: etaSec != null && etaSec < 1800,
      });
    });
    rows.sort((a, b) => {
      const ae = a.etaSec == null ? 1e15 : a.etaSec;
      const be = b.etaSec == null ? 1e15 : b.etaSec;
      return ae - be;
    });
    return rows;
  }
  function renderIntel() {
    const box = panel && panel.querySelector('.intel-panel');
    if (!box) return;
    const sec = box.closest('section[data-tab]');
    if (sec && sec.hidden) return;
    const threats = intelThreatBoard();
    const dossiers = intelDossiers().slice(0, 30);
    let html = '';
    html += '=== Incoming ===\n';
    if (!threats.length) html += '(none)\n';
    else {
      threats.forEach(t => {
        const tag = t.hasCs ? '[CS] ' : (t.kind === 'support' ? '[sup] ' : '');
        const urgent = t.urgent ? '!' : ' ';
        html += `${urgent}${tag}${t.kind || t.type || 'atk'} -> ${t.dest} from ${t.origin || '?'}` +
          `  lands in ${t.landsIn}` +
          (t.absTime ? ` (${t.absTime})` : '') + '\n';
      });
    }
    html += '\n=== Dossiers ===\n';
    dossiers.forEach(d => {
      html += `${d.player}: ${d.reports} reports` +
        (d.note ? ` - ${d.note}` : '') +
        (d.allianceNote ? ` [ally: ${d.allianceNote}]` : '') + '\n';
    });
    if (state.watchlist && state.watchlist.length) {
      html += '\n=== Watchlist ===\n';
      state.watchlist.forEach(w => {
        const rule = typeof w === 'object'
          ? String(w.id || w.townId || w.name || w.player || w.alliance || '')
          : String(w);
        const last = state.watchHits && state.watchHits[rule];
        const lastTxt = last ? new Date(last).toLocaleString() : 'never';
        html += (typeof w === 'object' ? `${rule} ${w.name || ''}` : rule) +
          `  (last hit: ${lastTxt})\n`;
      });
    }
    if (state.allianceNotes && Object.keys(state.allianceNotes).length) {
      html += '\n=== Alliance notes ===\n';
      Object.keys(state.allianceNotes).forEach(k => {
        html += `${k}: ${state.allianceNotes[k]}\n`;
      });
    }
    if (state.attackPatternNote) {
      html += '\n=== Attack patterns ===\n' + state.attackPatternNote + '\n';
    }
    box.textContent = html;
    try { intelPatternScan(); } catch (_) {}
  }
  function intelSetNote(player, note) {
    if (!state.playerNotes) state.playerNotes = {};
    if (!note) delete state.playerNotes[player];
    else state.playerNotes[player] = String(note).slice(0, 200);
    save(STORE.PLAYER_NOTES, state.playerNotes);
  }
  function intelSetAllianceNote(alliance, note) {
    if (!state.allianceNotes) state.allianceNotes = {};
    if (!note) delete state.allianceNotes[alliance];
    else state.allianceNotes[alliance] = String(note).slice(0, 200);
    save(STORE.ALLIANCE_NOTES, state.allianceNotes);
  }
  function intelGrepodataAssist() {
    if (!state.grepodataIndex) return;
    try {
      const btn = document.querySelector('.grepodata_index, a.index_report, [data-action="index"], .btn_index');
      if (btn && !btn.dataset.grepbotIndexed) {
        btn.dataset.grepbotIndexed = '1';
        if (gbDomClick(btn, 'grepodata')) {
          gbLogT('grepodata', 10000, 'intel: Grepodata Index+ clicked');
        }
      }
    } catch (_) {}
  }
  function intelPatternScan() {
    const now = Date.now();
    const windowMs = 24 * 3600000;
    const cut = now - windowMs;
    const by = {};
    (state.findings || []).forEach(f => {
      if (!f || !(f.ts >= cut)) return;
      const key = intelPlayerKey(f.attacker || f.player) || null;
      if (!key || key === 'unknown') return;
      if (!by[key]) by[key] = { key, name: intelPlayerLabel(f.attacker || f.player, key), n: 0, towns: [], first: f.ts, last: f.ts };
      const b = by[key];
      b.n++;
      b.last = Math.max(b.last, f.ts);
      b.first = Math.min(b.first, f.ts);
      const tid = f.town && (f.town.id || f.town.name);
      if (tid != null && b.towns.indexOf(String(tid)) < 0) b.towns.push(String(tid));
    });
    const hits = Object.values(by).filter(b => b.n >= 3);
    state.attackPatternNote = hits.length
      ? hits.map(h => `${h.name}×${h.n}/24h`).join(', ')
      : '';
    hits.forEach(h => {
      const bucket = Math.floor(now / windowMs);
      const ak = 'pattern:' + h.key + ':' + bucket;
      if (state.alerted && state.alerted[ak]) return;
      if (!state.alerted) state.alerted = {};
      state.alerted[ak] = now;
      save(STORE.ALERTED, state.alerted);
      const payload = {
        attacker: state.exportRedact !== false ? String(h.name).slice(0, 2) + '***' : h.name,
        hits: h.n,
        window: '24h',
        towns: (h.towns || []).slice(0, 8).map(t => state.exportRedact !== false ? String(t).slice(0, 2) + '***' : t),
        first: h.first, last: h.last,
      };
      gbLog(`pattern: ${h.name} hit ${h.n}× in 24h`);
      try { alertWebhook('pattern', payload); } catch (_) {}
    });
    return hits;
  }
  function watchMatch(finding) {
    if (!finding || !state.watchlist || !state.watchlist.length) return null;
    const hits = [];
    for (const w of state.watchlist) {
      const entry = typeof w === 'object' ? w : { id: w };
      const rule = String(entry.id || entry.townId || entry.name || entry.player || entry.alliance || entry.coords || w);
      const tid = finding.town && finding.town.id;
      const vid = finding.vill_id != null ? finding.vill_id : (finding.vill && finding.vill.id);
      if (entry.id != null || entry.townId != null) {
        const id = String(entry.id || entry.townId);
        if (String(tid) === id || String(vid) === id || String(finding.town_id) === id) {
          hits.push({ kind: 'town', rule, specificity: 4 });
        }
      }
      if (entry.coords || (entry.x != null && entry.y != null)) {
        const c = entry.coords || (entry.x + ' ' + entry.y);
        const fx = finding.town && finding.town.x;
        const fy = finding.town && finding.town.y;
        if (fx != null && fy != null && String(c).indexOf(String(fx)) >= 0 && String(c).indexOf(String(fy)) >= 0) {
          hits.push({ kind: 'coords', rule: String(c), specificity: 3 });
        }
      }
      const pname = finding.attacker && (finding.attacker.name || finding.attacker.player_name);
      if ((entry.player || entry.name) && pname && String(pname).toLowerCase() === String(entry.player || entry.name).toLowerCase()) {
        hits.push({ kind: 'player', rule: String(entry.player || entry.name), specificity: 2 });
      }
      if (entry.alliance && finding.alliance && String(finding.alliance).toLowerCase() === String(entry.alliance).toLowerCase()) {
        hits.push({ kind: 'alliance', rule: String(entry.alliance), specificity: 1 });
      }

      if (typeof w !== 'object') {
        const id = String(w);
        if (String(tid) === id || String(vid) === id || String(finding.town_id) === id) {
          hits.push({ kind: 'town', rule: id, specificity: 4 });
        }
      }
    }
    if (!hits.length) return null;
    hits.sort((a, b) => b.specificity - a.specificity);
    return { hit: true, kind: hits[0].kind, rule: hits[0].rule, extra: hits.length - 1 };
  }
  function intelWatchlistScan() {
    if (!state.watchlist || !state.watchlist.length) return;
    for (const f of (state.findings || []).slice(0, 80)) {
      const m = watchMatch(f);
      if (!m) continue;
      const id = String((f.town && f.town.id) || f.vill_id || f.town_id || m.rule);
      let onVac = null;
      try {
        if (f.vacation === true || f.on_vacation === true) onVac = true;
        else if (f.attacker && (f.attacker.vacation === true || f.attacker.on_vacation === true)) onVac = true;
      } catch (_) {}
      if (onVac === true) continue;
      if (!state.watchHits) state.watchHits = {};
      state.watchHits[m.rule] = Date.now();
      save(STORE.WATCH_HITS, state.watchHits);
      gbLog(`watchlist: ${id} matched (${m.kind}: ${m.rule}${m.extra ? ' +' + m.extra + ' more' : ''})`);
      try { alertWebhook('attack', { watchlist: id, why: m, finding: { type: f.type, ts: f.ts } }); } catch (_) {}
      break;
    }
  }

  const QUEST_SCAN_MS = 12000;
  const QUEST_RESCAN_MS = 6 * 60 * 60 * 1000;
  const QUEST_HISTORY_MAX = 100;
  let questCursor = 0;
  let questMo = null;

  function questClaimFailLoad() {
    const raw = load(STORE.QUEST_CLAIM_FAIL, null) || {};
    const now = Date.now();
    const out = Object.create(null);
    Object.keys(raw).forEach(id => {
      const f = raw[id];
      if (f && +f.until > now) out[id] = { n: +f.n || 0, until: +f.until };
    });
    return out;
  }
  function questClaimFailSave() {
    try {
      const now = Date.now();
      const out = {};
      Object.keys(questClaimFail).forEach(id => {
        const f = questClaimFail[id];
        if (f && f.until > now) out[id] = { n: f.n, until: f.until };
      });
      save(STORE.QUEST_CLAIM_FAIL, out);
    } catch (_) {}
  }
  const questClaimFail = questClaimFailLoad();
  const QUEST_FAIL_BACKOFF_MS = [5 * 60000, 30 * 60000, 6 * 3600000];
  function questClaimBlocked(id) {
    const f = questClaimFail[id];
    return !!(f && f.until > Date.now());
  }
  function questClaimFailed(id, err) {
    const f = questClaimFail[id] || (questClaimFail[id] = { n: 0, until: 0 });
    f.n++;
    const wait = QUEST_FAIL_BACKOFF_MS[Math.min(f.n - 1, QUEST_FAIL_BACKOFF_MS.length - 1)];
    f.until = Date.now() + wait;
    questClaimFailSave();
    gbLog('quest: claim backoff', id, 'fail #' + f.n, Math.round(wait / 60000) + 'min', String(err || ''));
  }
  function questClaimOk(id) { delete questClaimFail[id]; questClaimFailSave(); }

  const QUEST_SAFE_BUILD = /build_cost_reduction|construction_cost_reduction|buildcostreduction|building_cost_reduction/;
  const QUEST_SAFE_RES = /^(resources|favor)$/i;

  function questRows() {
    return Array.from(document.querySelectorAll('.quests .quest, #questlog .quest, .questlog .quest'))
      .filter(el => el && el.dataset && el.dataset.questId);
  }
  function questSelectedRow(rows) {
    return (rows || questRows()).find(r => r.classList.contains('selected')) || null;
  }
  function questRewardRoot() {
    return document.querySelector('#quest_inspector, .quest.quest_progress, .quest_progress');
  }
  function questActionButton(root) {
    const btn = (root || questRewardRoot())?.querySelector('.btn_action');
    return btn && !btn.classList.contains('disabled') ? btn : null;
  }
  function questKey(row) {
    return row?.dataset?.questId || '';
  }
  function questProgress(row) {
    const txt = row?.querySelector('.curr')?.textContent || row?.querySelector('.value_container')?.textContent || '';
    const m = txt.match(/(\d+(?:[.,]\d+)?)\s*%/);
    return m ? parseFloat(m[1].replace(',', '.')) : null;
  }
  function classifyRewardObj(r) {
    if (!r || typeof r !== 'object') return 'other';
    const type = String(r.type || '').toLowerCase();
    const pid = String(r.power_id || r.id || r.subtype || '').toLowerCase();
    const raw = [type, pid, r.title, r.name, JSON.stringify(r.configuration || {})].filter(Boolean).join(' ').toLowerCase();
    if (QUEST_SAFE_RES.test(type) || type === 'resource' || /favor/.test(type) && !/instant/.test(pid)) {
      if (type === 'favor' || /favor/.test(type)) return 'favor';
      if (type === 'resources' || type === 'resource' || r.wood != null || r.stone != null || r.iron != null) return 'resources';
    }
    if (QUEST_SAFE_BUILD.test(pid) || QUEST_SAFE_BUILD.test(raw)) return 'build-cost-reduction';
    if (/(build|construction|construct|edific|constru).{0,24}(cost|price|gold|reduction|discount|rebaja)/.test(raw)) return 'build-cost-reduction';
    if (type === 'unit' || /unit_/.test(pid)) return 'units';
    if (/hero/.test(type) || /hero/.test(pid)) return 'hero';
    if (r.stashable) return 'stashable';
    return 'other';
  }
  function normalizeReward(r, src) {
    const kind = classifyRewardObj(r);
    return {
      id: r.power_id || r.id || r.subtype || '',
      type: r.type || '',
      power_id: r.power_id || '',
      kind,
      stashable: !!r.stashable,
      configuration: r.configuration || null,
      raw: typeof r === 'object' ? JSON.stringify(r).slice(0, 240) : String(r),
      src: src || 'model',
    };
  }
  function questRewardKindFromNode(node) {
    const bits = [];
    ['title', 'aria-label', 'data-power_id', 'data-power-id', 'data-type', 'data-id'].forEach(name => {
      const v = node.getAttribute(name); if (v) bits.push(v);
    });
    bits.push((node.textContent || '').trim());
    bits.push(Array.from(node.classList || []).join(' '));
    if (node.firstElementChild && node.firstElementChild.className) bits.push(String(node.firstElementChild.className));
    const s = bits.join(' ').toLowerCase();
    if (QUEST_SAFE_BUILD.test(s)) return 'build-cost-reduction';
    if (/\bfavor\b/.test(s)) return 'favor';
    if (/\bresource|wood|stone|iron|madera|piedra|plata\b/.test(s)) return 'resources';
    if (/(build|construction|construct|edific|constru).{0,24}(cost|price|gold|reduction|discount|rebaja)/.test(s)) return 'build-cost-reduction';
    return 'other';
  }
  function questRewardsFromDom(root) {
    const scope = root || questRewardRoot();
    if (!scope) return [];
    const seen = new Set();
    const rewards = [];
    scope.querySelectorAll('.reward_icon, li.reward_icon, .rewards [class*="reward_icon"]').forEach(node => {
      const classes = Array.from(node.classList || []);
      const childClasses = node.firstElementChild ? Array.from(node.firstElementChild.classList || []) : [];
      const id = (classes.concat(childClasses).find(c => /reduction|reward|power|build|construct|cost|favor|resource/i.test(c)) || '').trim();
      const kind = questRewardKindFromNode(node);
      const key = [id, kind, (node.textContent || '').trim()].join('|').slice(0, 200);
      if (!key || seen.has(key)) return;
      seen.add(key);
      rewards.push({
        id, type: '', power_id: id, kind,
        title: node.getAttribute('title') || '',
        text: (node.textContent || '').trim(),
        classes: classes.concat(childClasses),
        src: 'dom',
      });
    });
    return rewards;
  }
  function mmCollection(name) {
    const uw = gameUw();
    try {
      const col = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName(name);
      if (col && col.models) return col;
    } catch (_) {}
    try {
      const cols = uw.MM && uw.MM.getCollections && uw.MM.getCollections();
      if (cols && cols[name]) {
        const c = Array.isArray(cols[name]) ? cols[name][0] : cols[name];
        if (c && c.models) return c;
      }
    } catch (_) {}
    return null;
  }
  function rewardsFromModel(model) {
    const out = [];
    try {
      if (model && typeof model.getRewards === 'function') {
        const list = model.getRewards() || [];
        (Array.isArray(list) ? list : []).forEach(r => out.push(normalizeReward(r, 'getRewards')));
        return out;
      }
    } catch (_) {}
    try {
      const a = model.attributes || model;
      const cfg = a.configuration || {};
      const staticR = (a.static && a.static.rewards) || a.rewards || cfg.rewards || [];
      (Array.isArray(staticR) ? staticR : []).forEach(r => out.push(normalizeReward(r, 'attrs')));
    } catch (_) {}
    return out;
  }
  function questsFromGame() {
    const out = [];
    const seen = new Set();
    ['IslandQuest', 'Progressable'].forEach(name => {
      const col = mmCollection(name);
      if (!col) return;
      (col.models || []).forEach(m => {
        const a = m.attributes || {};
        const id = String(a.id || m.id || '');
        if (!id || seen.has(id)) return;
        seen.add(id);
        let progress = null;
        try {
          if (typeof m.getProgress === 'function') progress = m.getProgress();
          else if (a.progress != null) progress = +a.progress;
          else if (a.progress_percent != null) progress = +a.progress_percent;
        } catch (_) {}
        let canClaim = false;
        try {
          if (typeof m.isClaimable === 'function') canClaim = !!m.isClaimable();
          else if (typeof m.isFinished === 'function') canClaim = !!m.isFinished();
          else if (typeof m.getReward === 'function') canClaim = !!m.getReward();
          else if (typeof m.hasReward === 'function') canClaim = !!m.hasReward();
          else if (progress != null && progress >= 100) canClaim = true;
          else if (a.state === 'satisfied' || a.status === 'satisfied') canClaim = true;
        } catch (_) {}
        const rewards = rewardsFromModel(m);

        const pid = a.progressable_id != null ? a.progressable_id : id;
        out.push({
          questId: id,
          progressableId: String(pid),
          name: a.questname || a.quest_name || a.name || '',
          title: a.name || a.summary || a.questname || id,
          progress,
          canClaim,
          rewards,
          state: a.state || a.status || '',
          fromGame: true,
          modelName: name,
        });
      });
    });
    return out;
  }
  function questRewardsSig(arr) {
    if (!arr || !arr.length) return '';
    return arr.map(r => {
      if (!r) return '';
      return String(r.power_id || r.id || '') + ':' + String(r.kind || r.type || '');
    }).join('|');
  }
  function mergeQuestEntry(entry) {
    if (!entry || !entry.questId) return;
    const prev = state.questRewards[entry.questId] || {};
    const rewards = (entry.rewards && entry.rewards.length) ? entry.rewards : (prev.rewards || []);
    const autoBuildReward = rewards.some(r => r.kind === 'build-cost-reduction');
    const autoResReward = rewards.some(r => r.kind === 'resources' || r.kind === 'favor');
    const safeAuto = rewards.length > 0 && rewards.every(r => isSafeQuestReward(r));
    const nextProgress = entry.progress != null ? entry.progress : prev.progress;
    const nextCanClaim = entry.canClaim != null ? !!entry.canClaim : !!prev.canClaim;
    const nextTitle = entry.title != null ? entry.title : prev.title;
    const nextName = entry.name != null ? entry.name : prev.name;
    const nextSig = questRewardsSig(rewards);

    const unchanged = prev.questId != null
      && prev.progress === nextProgress
      && !!prev.canClaim === nextCanClaim
      && !!prev.safeAuto === !!safeAuto
      && (prev.title || '') === (nextTitle || '')
      && (prev.name || '') === (nextName || '')
      && questRewardsSig(prev.rewards) === nextSig;
    if (unchanged) return prev;
    const merged = Object.assign({}, prev, entry, {
      rewards,
      updatedAt: Date.now(),
      autoBuildReward,
      autoResReward,
      safeAuto,
    });
    state.questRewards[entry.questId] = merged;
    save(STORE.QUEST_REWARDS, state.questRewards);
    if (nextSig && nextSig !== questRewardsSig(prev.rewards)) {
      gbLog('quest reward learned:', merged.title || merged.name || merged.questId, nextSig.slice(0, 180));
    }
    return merged;
  }
  function isSafeQuestReward(r) {
    if (!r) return false;
    if (r.kind === 'build-cost-reduction') return !!state.questAutoBuild;
    if (r.kind === 'resources' || r.kind === 'favor') return !!state.questAutoRes;
    return false;
  }
  function pushQuestHistory(entry) {
    state.questHistory.unshift(entry);
    if (state.questHistory.length > QUEST_HISTORY_MAX) state.questHistory.length = QUEST_HISTORY_MAX;
    save(STORE.QUEST_HISTORY, state.questHistory);
  }
  function learnQuestRewardsFromPayload(data, hint) {
    if (!data || typeof data !== 'object') return;
    const walk = (obj, depth) => {
      if (!obj || depth > 6) return;
      if (Array.isArray(obj)) { obj.forEach(x => walk(x, depth + 1)); return; }
      if (typeof obj !== 'object') return;

      if (obj.power_id || obj.type === 'resources' || obj.type === 'favor' || (obj.rewards && Array.isArray(obj.rewards))) {
        const qid = String(obj.progressable_id || obj.quest_id || obj.id || hint || '');
        if (obj.rewards && Array.isArray(obj.rewards)) {
          mergeQuestEntry({
            questId: qid || ('xhr-' + Date.now()),
            rewards: obj.rewards.map(r => normalizeReward(r, 'xhr')),
            title: obj.name || obj.summary || '',
            fromXhr: true,
          });
        } else if (obj.power_id || QUEST_SAFE_RES.test(String(obj.type || ''))) {
          if (qid) {
            const prev = state.questRewards[qid] || { questId: qid, rewards: [] };
            const rewards = (prev.rewards || []).slice();
            rewards.push(normalizeReward(obj, 'xhr'));
            mergeQuestEntry(Object.assign({}, prev, { rewards }));
          }
        }
      }
      Object.keys(obj).forEach(k => {
        if (k === 'json' || k === 'r' || k === 'data' || k === 'quests' || k === 'island_quests' || k === 'progressable' || k === 'rewards') walk(obj[k], depth + 1);
      });
    };
    walk(data.json || data, 0);
  }
  function claimQuestViaBridge(entry, onDone) {
    const uw = gameUw();
    const pid = entry.progressableId || entry.questId;
    if (!pid || !(uw.gpAjax && uw.gpAjax.ajaxPost)) return onDone && onDone('noajax');

    const mid = /^\d+$/.test(String(entry.questId)) ? String(entry.questId) : String(pid);
    if (!/^\d+$/.test(mid)) return onDone && onDone('no-numeric-id');
    const payload = {
      model_url: 'IslandQuest/' + mid,
      action_name: 'claimReward',
      arguments: { progressable_id: +pid || pid },
      town_id: uw.Game && uw.Game.townId,
    };
    gbLog('quest bridge claim:', JSON.stringify(payload).slice(0, 200));
    bridgePost('quest', payload, (err, data) => {
      if (err) return onDone && onDone(err);
      if (data && data.error) return onDone && onDone(String(data.error));
      onDone && onDone(null, data);
    });
  }
  function questNeedsRescan(info) {
    if (!info) return true;
    if (!Array.isArray(info.rewards) || !info.rewards.length) return true;
    return ((info.updatedAt || 0) + QUEST_RESCAN_MS) < Date.now();
  }
  function clickQuestRow(row) {
    const target = row?.querySelector('.headline') || row;
    if (!target) return false;
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  }
  function chooseQuestRow(rows) {
    if (!rows.length) return null;

    const scored = rows.map(r => {
      const id = questKey(r);
      const info = state.questRewards[id];
      const prog = questProgress(r);
      let score = 0;
      if (prog != null && prog >= 100) score += 100;
      if (info && info.safeAuto) score += 40;
      if (questNeedsRescan(info)) score += 20;
      if (r.classList.contains('selected')) score += 5;
      return { r, score, id };
    });
    scored.sort((a, b) => b.score - a.score);
    if (scored[0].score >= 20) return scored[0].r;
    questCursor = questCursor % rows.length;
    return rows[questCursor++];
  }
  function questAutoClaim(root, entry) {
    if (gbLocked('quest-claim') || !entry?.canClaim) return;
    const rewards = entry.rewards || [];

    if (!rewards.length || !rewards.every(isSafeQuestReward)) return;
    if (!state.questAutoBuild && !state.questAutoRes) return;
    if (questClaimBlocked(entry.questId)) {
      gbLogT('quest-block-' + entry.questId, 60000, 'quest: claim backoff active', entry.title || entry.questId);
      return;
    }
    if (!gbLock('quest-claim')) return;
    const kinds = rewards.map(r => r.kind).join(',');
    const finish = (method, ok, err) => {
      if (ok) questClaimOk(entry.questId);
      else questClaimFailed(entry.questId, err);
      pushQuestHistory({
        ts: Date.now(),
        questId: entry.questId,
        title: entry.title || entry.name || entry.questId,
        rewards,
        autoClaimed: !!ok,
        method,
        kinds,
      });
      gbLog(`quest: auto-claim ${ok ? 'OK' : 'fail'} via ${method}`, entry.title || entry.questId, kinds);
      if (ok) flash('quest claim: ' + kinds);
      gbTimeout(() => { gbUnlock('quest-claim'); questScanTick('post-claim'); renderQuests(); }, 2500);
    };
    const questStillClaimable = () => {
      const cur = state.questRewards[entry.questId];
      if (cur && cur.canClaim === false) return false;
      try {
        const live = questsFromGame().find(q => String(q.questId) === String(entry.questId));
        if (live && live.canClaim === false) return false;
      } catch (_) {}
      return true;
    };
    try {
      claimQuestViaBridge(entry, (err) => {

        if (err === 'timeout') {
          if (!questStillClaimable()) return finish('bridge-reconcile', true);
          return finish('bridge', false, 'timeout_unknown');
        }
        if (err) return finish('bridge', false, err);
        if (!questStillClaimable()) return finish('bridge', true);

        return finish('bridge', false, 'unconfirmed');
      });
    } catch (e) {
      gbUnlock('quest-claim');
      gbLog('quest: claim threw', String(e).slice(0, 120));
    }
  }
  function questSnapshot(row, rewards, canClaim) {
    const questId = questKey(row);
    const headline = row?.querySelector('.headline');
    const progress = questProgress(row);
    const entry = {
      questId,
      progressableId: headline?.dataset?.questProgressableId || row?.dataset?.questProgressableId || '',
      name: row?.dataset?.questName || '',
      title: (headline?.textContent || '').trim(),
      progress,
      updatedAt: Date.now(),
      selected: !!row?.classList.contains('selected'),
      canClaim: !!canClaim && progress != null && progress >= 100,
      rewards: rewards || [],
    };
    entry.autoBuildReward = entry.rewards.some(r => r.kind === 'build-cost-reduction');
    entry.autoResReward = entry.rewards.some(r => r.kind === 'resources' || r.kind === 'favor');
    entry.safeAuto = entry.rewards.length > 0 && entry.rewards.every(isSafeQuestReward);
    return entry;
  }
  function questCaptureCurrent(row) {
    const root = questRewardRoot();
    let rewards = questRewardsFromDom(root);
    const id = questKey(row);

    const fromGame = questsFromGame().find(q => q.questId === id || String(q.progressableId).includes(id));
    if (fromGame && fromGame.rewards && fromGame.rewards.length) {
      rewards = fromGame.rewards;
    }
    const entry = questSnapshot(row, rewards, !!questActionButton(root) || !!(fromGame && fromGame.canClaim));
    if (fromGame && fromGame.progress != null && entry.progress == null) entry.progress = fromGame.progress;
    if (fromGame && fromGame.canClaim) entry.canClaim = entry.canClaim || (entry.progress != null && entry.progress >= 100) || fromGame.canClaim;
    mergeQuestEntry(entry);
    questAutoClaim(root, state.questRewards[entry.questId]);
  }
  function ingestGameQuests() {
    questsFromGame().forEach(q => mergeQuestEntry(q));
  }
  function questScanTick(reason) {
    if (!hostEnabled() || gbLocked('quest-scan')) return;
    bindQuestObserver();
    ingestGameQuests();

    if (!gbLocked('quest-claim')) {
      const claimable = Object.values(state.questRewards).filter(e => {
        if (!(e.canClaim && e.safeAuto)) return false;
        try {
          const last = gbRecall('quest', null, e.questId);
          if (last && last.r && last.r !== 'ok' && (Date.now() - last.ts) < 120000) return false;
        } catch (_) {}
        return true;
      });
      if (claimable.length) {
        questAutoClaim(questRewardRoot(), claimable[0]);
      }
    }
    const rows = questRows();
    if (!rows.length) { renderQuests(); return; }
    const row = chooseQuestRow(rows);
    if (!row) { renderQuests(); return; }
    if (!gbLock('quest-scan')) return;
    const finish = () => { gbUnlock('quest-scan'); renderQuests(); };
    if (!row.classList.contains('selected')) {
      clickQuestRow(row);
      gbTimeout(() => {
        try { questCaptureCurrent(questSelectedRow(questRows()) || row); }
        finally { finish(); }
      }, 450);
      return;
    }
    try { questCaptureCurrent(row); }
    finally { finish(); }
  }
  function bindQuestObserver() {
    const container = document.querySelector('.quests, #questlog');
    if (!container) { questMo = null; return; }
    if (questMo) return;
    questMo = new MutationObserver(() => {
      clearTimeout(bindQuestObserver._t);
      bindQuestObserver._t = gbTimeout(() => questScanTick('mutation'), 400);
    });
    questMo.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
  }
  function questDispose() {
    if (questMo) {
      try { questMo.disconnect(); } catch (_) {}
      questMo = null;
    }
    clearTimeout(bindQuestObserver._t);
  }
  try {
    const _uw = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
    _uw.__grepbotQuestDispose = questDispose;
  } catch (_) {}
  function renderQuests() {
    const sec = panel && panel.querySelector('section[data-tab=quests]');
    if (!sec || sec.hidden) return;
    const list = sec.querySelector('.quest-list');
    const hist = sec.querySelector('.quest-hist');
    if (!list) return;
    list.replaceChildren();
    const entries = Object.values(state.questRewards || {}).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (!entries.length) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#888;padding:6px 0';
      e.textContent = 'no quests learned yet - open quest log or wait for scan';
      list.appendChild(e);
    } else {
      const hdr = document.createElement('div');
      hdr.className = 'quest-row';
      hdr.style.color = '#888';
      ['quest', '%', 'rewards', 'auto'].forEach(t => {
        const s = document.createElement('span');
        s.textContent = t;
        hdr.appendChild(s);
      });
      list.appendChild(hdr);
      entries.slice(0, 40).forEach(q => {
        const row = document.createElement('div');
        row.className = 'quest-row';
        const kinds = (q.rewards || []).map(r => r.kind).filter(Boolean);
        const uniq = Array.from(new Set(kinds)).join(',') || '-';
        const auto = q.safeAuto ? (q.canClaim ? 'CLAIM' : 'yes') : 'no';
        const autoColor = auto === 'CLAIM' ? '#6dda7e' : (auto === 'yes' ? '#fc6' : '#888');
        const title = (q.title || q.name || q.questId || '').slice(0, 28);
        const c1 = document.createElement('span');
        c1.title = String(q.questId || '');
        c1.textContent = title;
        const c2 = document.createElement('span');
        c2.textContent = q.progress != null ? String(Math.round(q.progress)) : '-';
        const c3 = document.createElement('span');
        c3.title = uniq;
        c3.textContent = uniq.slice(0, 22);
        const c4 = document.createElement('span');
        c4.style.color = autoColor;
        c4.textContent = auto;
        row.append(c1, c2, c3, c4);
        list.appendChild(row);
      });
    }
    if (hist) {
      const lines = (state.questHistory || []).slice(0, 30).map(h => {
        const when = new Date(h.ts).toLocaleTimeString();
        const kinds = h.kinds || (h.rewards || []).map(r => r.kind).join(',');
        return `${when} ${h.autoClaimed ? 'OK' : 'NO'} ${h.method || '?'} ${(h.title || h.questId || '').slice(0, 24)} [${kinds}]`;
      });
      hist.textContent = lines.join('\n') || '(empty)';
    }
  }

  const ATTACK_HISTORY_MAX = 50;
  const ATTACK_ROLE_OFFENSE = 'offense';
  const ATTACK_ROLE_DEFENSE = 'defense';
  let attackArmed = null;
  let attackPreviewRows = [];

  function serverNow() {
    const uw = gameUw();
    try {
      if (uw.Timestamp && typeof uw.Timestamp.now === 'function') return uw.Timestamp.now();
      if (uw.Timestamp && typeof uw.Timestamp.server === 'function') return uw.Timestamp.server();
    } catch (_) {}
    return Math.floor(Date.now() / 1000);
  }
  function clientServerSkewMs() {
    const uw = gameUw();
    try {
      if (typeof uw.Timestamp.clientServerDiff === 'function') return uw.Timestamp.clientServerDiff() * 1000;
      if (uw.Timestamp.clientServerDiff != null) return Number(uw.Timestamp.clientServerDiff) * 1000;
    } catch (_) {}
    try {
      const srv = serverNow();
      return Date.now() - srv * 1000;
    } catch (_) { return 0; }
  }
  function runtimeSetupTime() {
    const uw = gameUw();
    try {
      const t = uw.Game && uw.Game.constants && uw.Game.constants.units && uw.Game.constants.units.runtime_setup_time;
      if (t != null) return +t;
    } catch (_) {}
    try {
      const gs = (uw.Game && uw.Game.game_speed) || 1;
      return Math.max(60, Math.floor(900 / gs));
    } catch (_) { return 225; }
  }
  function unitMeta(id) {
    const uw = gameUw();
    try { return (uw.GameData && uw.GameData.units && uw.GameData.units[id]) || null; } catch (_) { return null; }
  }
  function townLiveUnits(townId) {
    const uw = gameUw();
    try {
      const t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]);
      if (!t || !t.units) return {};
      return Object.assign({}, t.units());
    } catch (_) { return {}; }
  }
  function townCoords(townId) {
    const list = state.towns || [];
    const t = list.find(x => String(x.id) === String(townId));
    if (t && t.x != null && t.y != null) return { x: +t.x, y: +t.y, island: t.island };
    try {
      const game = townsFromGame() || [];
      const g = game.find(x => String(x.id) === String(townId));
      if (g) return { x: +g.x, y: +g.y, island: g.island };
    } catch (_) {}
    return { x: null, y: null, island: null };
  }
  function islandDistance(ax, ay, bx, by) {
    if (ax == null || ay == null || bx == null || by == null) return null;
    const dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function slowestLandSpeed(units) {
    let min = Infinity;
    Object.keys(units || {}).forEach(id => {
      if (!units[id]) return;
      const m = unitMeta(id);
      if (!m || m.is_naval) return;
      if (id === 'militia') return;
      const sp = m.speed;
      if (sp != null && sp > 0 && sp < min) min = sp;
    });
    return min === Infinity ? null : min;
  }
  function computeTravelSeconds(srcTownId, target, units) {
    const uw = gameUw();

    try {
      if (uw.UnitTimeToArrival && typeof uw.UnitTimeToArrival.calculateTimeToArrival === 'function') {
        const t = uw.UnitTimeToArrival.calculateTimeToArrival(units, srcTownId, +target.vill_id || target.id);
        if (t && t > 0) return Math.floor(t);
      }
    } catch (_) {}
    try {
      if (uw.GameDataUnits && typeof uw.GameDataUnits.getUnitRuntimes === 'function') {
        const src = townCoords(srcTownId);
        const dist = islandDistance(src.x, src.y, target.x, target.y);
        if (dist != null) {
          const rt = uw.GameDataUnits.getUnitRuntimes(units, dist);
          if (rt && rt > 0) return Math.floor(rt);
        }
      }
    } catch (_) {}
    const src = townCoords(srcTownId);
    const dist = islandDistance(src.x, src.y, target.x, target.y);
    if (dist == null) return null;
    const speed = slowestLandSpeed(units);
    if (!speed) return null;
    return Math.max(1, Math.floor(dist * 50 / speed) + runtimeSetupTime());
  }
  function isSameIsland(srcTownId, target) {
    const src = townCoords(srcTownId);
    if (src.island != null && target.island != null) return String(src.island) === String(target.island);
    if (src.x != null && target.x != null && src.y != null && target.y != null) {
      return +src.x === +target.x && +src.y === +target.y;
    }
    return false;
  }
  function boatCapacityCheck(units, sameIsland) {
    const uw = gameUw();
    const land = {};
    const boats = {};
    let needPop = 0;
    let cap = 0;
    Object.keys(units || {}).forEach(id => {
      const n = +units[id] || 0;
      if (!n) return;
      const m = unitMeta(id);
      if (!m) return;
      if (m.is_naval || (m.capacity != null && m.capacity > 0 && !m.population)) {
        boats[id] = n;
        const c = (m.capacity || 0) + (m.berth || 0);
        cap += c * n;
      } else if (!m.is_naval && id !== 'militia') {
        land[id] = n;
        needPop += (m.population || 1) * n;
      }
    });
    if (!Object.keys(land).length) return { ok: true, need: 0, cap, sameIsland: !!sameIsland, reason: 'naval-only' };
    if (sameIsland && !Object.keys(boats).length) return { ok: true, need: needPop, cap: 0, sameIsland: true, reason: 'same-island' };
    try {
      if (uw.GameDataUnits && typeof uw.GameDataUnits.calculateCapacity === 'function') {
        const r = uw.GameDataUnits.calculateCapacity(units);
        if (r && typeof r === 'object') {
          const need = r.needed_capacity != null ? r.needed_capacity : needPop;
          const have = r.total_capacity != null ? r.total_capacity : cap;
          return { ok: have >= need, need, cap: have, sameIsland: !!sameIsland, reason: have >= need ? 'ok' : 'under-boated' };
        }
      }
    } catch (_) {}
    if (!Object.keys(boats).length && !sameIsland) return { ok: false, need: needPop, cap: 0, sameIsland: false, reason: 'no-boats' };
    return { ok: cap >= needPop, need: needPop, cap, sameIsland: !!sameIsland, reason: cap >= needPop ? 'ok' : 'under-boated' };
  }
  function classifyUnitFn(id) {
    const m = unitMeta(id);
    if (!m) return 'unknown';
    const f = m.unit_function;
    if (f === 'function_off' || f === 'off') return 'offense';
    if (f === 'function_def' || f === 'def') return 'defense';
    if (f === 'function_both' || f === 'both') return 'both';
    if (m.is_naval) return 'naval';
    if (id === 'militia') return 'militia';
    if (/^(slinger|rider|chariot|catapult|minotaur|manticore|cyclops?|zyklop|harpy|erinys|giant)$/.test(id)) return 'offense';
    if (/^(sword|archer|hoplite|centaur|pegasus|cerberus|calydonian|medusa)$/.test(id)) return 'defense';
    return 'both';
  }
  function selectUnitsForTown(townId, troopMode, unitType, perTownMap, harassPreset) {
    const live = townLiveUnits(townId);
    const out = {};
    if (troopMode === 'harass') {
      return selectHarassmentUnits(townId, harassPreset || 'light');
    }
    if (troopMode === 'per_town') {
      const custom = (perTownMap && perTownMap[townId]) || {};
      Object.keys(custom).forEach(k => {
        const want = +custom[k] || 0;
        const have = +live[k] || 0;
        if (want > 0 && have > 0) out[k] = Math.min(want, have);
      });
      return out;
    }
    if (troopMode === 'all_of_type' && unitType) {
      const have = +live[unitType] || 0;
      if (have > 0) out[unitType] = have;

      const m = unitMeta(unitType);
      if (m && !m.is_naval) {
        Object.keys(live).forEach(id => {
          const um = unitMeta(id);
          if (um && um.capacity > 0 && live[id] > 0) out[id] = live[id];
        });
      }
      return out;
    }
    Object.keys(live).forEach(id => {
      const n = +live[id] || 0;
      if (!n) return;
      if (id === 'militia') return;
      const m = unitMeta(id);
      if (!m) return;
      if (troopMode === 'all') {
        out[id] = n;
        return;
      }
      if (m.is_naval && (troopMode === 'offense' || troopMode === 'defense')) {

        if (m.capacity > 0) out[id] = n;
        return;
      }
      const fn = classifyUnitFn(id);
      if (troopMode === 'offense' && (fn === 'offense' || fn === 'both')) out[id] = n;
      if (troopMode === 'defense' && (fn === 'defense' || fn === 'both')) out[id] = n;
    });
    return out;
  }
  function defaultAttackPlan() {
    return {
      targetId: '',
      targetX: null,
      targetY: null,
      mission: 'attack',
      timingMode: 'send_now',
      arrivalUnix: null,
      latencyPadMs: 200,
      staggerMs: 25,
      troopMode: 'offense',
      harassPreset: 'light',
      unitType: 'sword',
      sourceTownIds: null,
      perTownUnits: {},
    };
  }
  function ensureAttackPlan() {
    if (!state.attackPlan) state.attackPlan = defaultAttackPlan();
    return state.attackPlan;
  }
  function saveAttackPlan() {
    save(STORE.ATTACK_PLAN, state.attackPlan);
  }
  function attackRememberTarget(id, meta) {
    if (id == null || id === '') return;
    const sid = String(id);
    if (!state.attackRecent) state.attackRecent = [];
    state.attackRecent = state.attackRecent.filter(t => String(t.id) !== sid);
    state.attackRecent.unshift(Object.assign({ id: sid, ts: Date.now(), src: 'learned' }, meta || {}));
    if (state.attackRecent.length > 40) state.attackRecent.length = 40;
    save(STORE.ATTACK_RECENT, state.attackRecent);
  }
  function attackKnownTargets() {
    const map = new Map();
    const add = (t, src) => {
      if (!t || t.id == null || t.id === '') return;
      const id = String(t.id);
      const prev = map.get(id);
      const entry = {
        id,
        name: t.name || prev?.name || null,
        x: t.x ?? prev?.x ?? null,
        y: t.y ?? prev?.y ?? null,
        src: prev?.src || src,
        ts: t.ts || prev?.ts || 0,
      };
      if (!prev || (t.ts || 0) >= (prev.ts || 0)) map.set(id, entry);
    };
    for (const f of (state.findings || [])) {
      if (f.town && f.town.id != null) add(Object.assign({}, f.town, { ts: f.ts }), 'report');
    }
    for (const t of (state.attackRecent || [])) add(t, t.src || 'recent');
    for (const h of (state.attackHistory || [])) {
      if (h.targetId) add({ id: h.targetId, ts: h.ts }, 'history');
    }
    for (const w of (state.watchlist || [])) {
      const id = w && (w.id || w.townId);
      if (id != null) add({ id, name: w.name, ts: 0 }, 'watch');
    }
    const tpl = state.attackTpl;
    const learnedId = tpl && tpl.arguments && tpl.arguments.id;
    if (learnedId != null) add({ id: learnedId, ts: tpl.learned_at || 0 }, 'learned');
    return Array.from(map.values()).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }
  function attackCurrentTownId() {
    const uw = gameUw();
    try {
      const id = uw.Game && uw.Game.townId;
      if (id == null) return null;
      const sid = String(id);
      const own = (state.towns || []).find(t => String(t.id) === sid);
      if (own) return { id: sid, name: own.name || 'own town', x: own.x, y: own.y, own: true };
      const hit = (state.findings || []).find(f => f.town && String(f.town.id) === sid);
      if (hit && hit.town) {
        return { id: sid, name: hit.town.name, x: hit.town.x, y: hit.town.y, own: false };
      }
      const recent = (state.attackRecent || []).find(t => String(t.id) === sid);
      if (recent) return Object.assign({ own: false }, recent);
      if (uw.ITowns && uw.ITowns.towns && uw.ITowns.towns[id]) {
        const t = uw.ITowns.towns[id];
        const name = (typeof t.getName === 'function' ? t.getName() : t.name) || sid;
        return { id: sid, name, x: t.x, y: t.y, own: true };
      }
      return { id: sid, name: null, x: null, y: null, own: false };
    } catch (_) { return null; }
  }
  function applyAttackTarget(t) {
    const plan = ensureAttackPlan();
    plan.targetId = String(t.id);
    plan.targetType = 'town';
    if (t.x != null) plan.targetX = +t.x;
    if (t.y != null) plan.targetY = +t.y;
    saveAttackPlan();
    renderAttack();
    const label = t.name ? `${t.name} (#${t.id})` : String(t.id);
    flash('target -> ' + label);
  }
  function attackTownGroup(name) {
    return ((state.townGroups && state.townGroups[name]) || []).map(String);
  }
  function attackSetTownRole(name, townId, on) {
    if (!state.townGroups) state.townGroups = {};
    const sid = String(townId);
    const ids = new Set(attackTownGroup(name));
    if (on) ids.add(sid);
    else ids.delete(sid);
    state.townGroups[name] = Array.from(ids);
    save(STORE.TOWN_GROUPS, state.townGroups);
  }
  function attackSelectSources(ids) {
    const plan = ensureAttackPlan();
    plan.sourceTownIds = (ids || []).map(String);
    saveAttackPlan();
    renderAttack();
  }
  function attackSetAllSources(checked) {
    const ids = checked ? (state.towns || []).map(t => String(t.id)) : [];
    attackSelectSources(ids);
    flash(checked ? 'all towns selected' : 'sources cleared');
  }
  function attackSelectRoleSources(role) {
    const ids = attackTownGroup(role);
    if (!ids.length) {
      flash(`no ${role} cities tagged - check boxes below first`);
      return;
    }
    attackSelectSources(ids);
    flash(`${role} cities selected (${ids.length})`);
  }
  function attackPad2(n) { return String(n).padStart(2, '0'); }
  function attackLocalFromUnix(unix) {
    if (unix == null) return null;
    const d = new Date(unix * 1000 + clientServerSkewMs());
    return {
      date: `${d.getFullYear()}-${attackPad2(d.getMonth() + 1)}-${attackPad2(d.getDate())}`,
      time: `${attackPad2(d.getHours())}:${attackPad2(d.getMinutes())}:${attackPad2(d.getSeconds())}`,
    };
  }
  function attackUnixFromLocal(dateStr, timeStr) {
    if (!dateStr) return null;
    const t = timeStr && /^\d{1,2}:\d{2}/.test(timeStr) ? timeStr : '00:00:00';
    const ms = Date.parse(`${dateStr}T${t}`);
    if (isNaN(ms)) return null;
    return Math.floor((ms - clientServerSkewMs()) / 1000);
  }
  function attackDefaultArrivalUnix() {
    return Math.floor((Date.now() + 3600000 - clientServerSkewMs()) / 1000);
  }
  function attackSyncArrivalFields(sec, plan) {
    const arrDate = sec.querySelector('[data-atk=arrival-date]');
    const arrTime = sec.querySelector('[data-atk=arrival-time]');
    const arrivalRow = sec.querySelector('.atk-arrival-row');
    const arriveMode = plan.timingMode === 'arrive_at';
    if (arrivalRow) {
      arrivalRow.style.opacity = arriveMode ? '1' : '0.5';
      arrivalRow.title = arriveMode ? '' : 'switch timing to "arrive at" to set CS landing time';
    }
    if (!arrDate || !arrTime) return;
    arrDate.disabled = !arriveMode;
    arrTime.disabled = !arriveMode;
    if (document.activeElement === arrDate || document.activeElement === arrTime) return;
    let unix = plan.arrivalUnix;
    if (arriveMode && unix == null) unix = attackDefaultArrivalUnix();
    if (unix != null) {
      const loc = attackLocalFromUnix(unix);
      if (loc) {
        arrDate.value = loc.date;
        arrTime.value = loc.time;
      }
    }
  }
  function renderAttackRoles(sec) {
    const box = sec.querySelector('.atk-roles');
    if (!box) return;
    const towns = state.towns || [];
    const off = new Set(attackTownGroup(ATTACK_ROLE_OFFENSE));
    const def = new Set(attackTownGroup(ATTACK_ROLE_DEFENSE));
    const sig = towns.map(t => t.id + ':' + (t.name || '')).join('|') +
      '|O:' + Array.from(off).sort().join(',') + '|D:' + Array.from(def).sort().join(',');
    if (box.dataset.sig === sig) {
      box.querySelectorAll('input[data-role]').forEach(cb => {
        const role = cb.dataset.role;
        const id = cb.dataset.id;
        const want = role === ATTACK_ROLE_OFFENSE ? off.has(id) : def.has(id);
        if (cb.checked !== want) cb.checked = want;
      });
      return;
    }
    box.dataset.sig = sig;
    box.replaceChildren();
    if (!towns.length) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#666;font-size:10px';
      e.textContent = 'load towns first (World tab -> refresh)';
      box.appendChild(e);
      return;
    }
    const mkCol = (title, role, color) => {
      const col = document.createElement('div');
      const head = document.createElement('div');
      head.style.cssText = `font-size:9px;color:${color};margin-bottom:2px;font-weight:bold`;
      head.textContent = title;
      col.appendChild(head);
      towns.forEach(t => {
        const lab = document.createElement('label');
        lab.style.cssText = 'display:flex;align-items:center;gap:3px;font-size:10px;cursor:pointer';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.role = role;
        cb.dataset.id = String(t.id);
        cb.checked = role === ATTACK_ROLE_OFFENSE ? off.has(String(t.id)) : def.has(String(t.id));
        cb.addEventListener('change', () => {
          attackSetTownRole(role, t.id, cb.checked);
          renderAttackRoles(sec);
          renderAttack();
        });
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode((t.name || t.id).slice(0, 18)));
        col.appendChild(lab);
      });
      return col;
    };
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px';
    grid.appendChild(mkCol('Offensive cities', ATTACK_ROLE_OFFENSE, '#f96'));
    grid.appendChild(mkCol('Defensive cities', ATTACK_ROLE_DEFENSE, '#6cf'));
    box.appendChild(grid);
  }
  function parseUnitsArea(text) {
    const units = {};
    String(text || '').split('\n').forEach(l => {
      const m = l.trim().match(/^(\w+)\s*:\s*(\d+)/);
      if (m) units[m[1]] = +m[2];
    });
    return units;
  }
  function unitsToArea(units) {
    return Object.entries(units || {}).map(([k, v]) => `${k}:${v}`).join('\n');
  }
  function resolveTarget(plan) {
    const id = String(plan.targetId || '').trim();
    if (!id) return null;
    const explicitType = String(plan.targetType || '').toLowerCase().trim();
    let x = plan.targetX, y = plan.targetY, island = null;
    let kind = explicitType || null;

    const ownTown = (state.towns || []).find(t => String(t.id) === id);
    if (ownTown) {
      kind = kind || 'town';
      x = x ?? ownTown.x; y = y ?? ownTown.y; island = ownTown.island;
      return { id, vill_id: null, town_id: id, kind: 'town', x: x != null ? +x : null, y: y != null ? +y : null, island };
    }
    try {
      const uw = gameUw();
      if (uw.ITowns && uw.ITowns.towns && uw.ITowns.towns[id]) {
        kind = kind || 'town';
        return { id, vill_id: null, town_id: id, kind: 'town', x: x != null ? +x : null, y: y != null ? +y : null, island };
      }
    } catch (_) {}

    const farm = (state.farmsParsed || []).find(f => String(f.vill_id) === id || String(f.id) === id);
    if (farm) {
      kind = kind || 'farm_town';
      x = x ?? farm.x; y = y ?? farm.y;
      return { id, vill_id: id, town_id: null, kind: 'farm_town', x: x != null ? +x : null, y: y != null ? +y : null, island };
    }

    const finding = (state.findings || []).find(f => f.town && String(f.town.id) === id);
    if (finding && finding.town) {
      kind = kind || 'town';
      x = x ?? finding.town.x; y = y ?? finding.town.y;
      return { id, vill_id: null, town_id: id, kind: 'town', x: x != null ? +x : null, y: y != null ? +y : null, island };
    }
    const recent = (state.attackRecent || []).find(t => String(t.id) === id);
    if (recent) {
      kind = kind || 'town';
      x = x ?? recent.x; y = y ?? recent.y;
      return { id, vill_id: null, town_id: id, kind: 'town', x: x != null ? +x : null, y: y != null ? +y : null, island };
    }

    try {
      const uw = gameUw();
      const m = uw.MM && uw.MM.getModel && uw.MM.getModel('Town', id);
      if (m) {
        const a = m.attributes || {};
        return {
          id, vill_id: null, town_id: id, kind: 'town',
          x: x != null ? +x : (a.x != null ? +a.x : null),
          y: y != null ? +y : (a.y != null ? +a.y : null),
          island: a.island_id || a.island || island,
        };
      }
    } catch (_) {}

    if (/^\d+$/.test(id) && explicitType !== 'farm_town' && explicitType !== 'farm' && explicitType !== 'village') {
      return { id, vill_id: null, town_id: id, kind: 'town', x: x != null ? +x : null, y: y != null ? +y : null, island };
    }

    if (!kind) {
      gbLogT('atk-target', 30000, `attack: id ${id} has no canonical type - blocked`);
      return null;
    }
    if (kind === 'farm_town' || kind === 'farm' || kind === 'village') {
      return { id, vill_id: id, town_id: null, kind: 'farm_town', x: x != null ? +x : null, y: y != null ? +y : null, island };
    }
    if (kind === 'town' || kind === 'player_town') {
      return { id, vill_id: null, town_id: id, kind: 'town', x: x != null ? +x : null, y: y != null ? +y : null, island };
    }
    gbLogT('atk-target', 30000, `attack: unsupported targetType=${kind}`);
    return null;
  }
  function attackSendAllowed(target) {
    if (!target || !target.kind) return false;

    if (target.kind === 'farm_town') return false;
    return target.kind === 'town' && target.town_id;
  }
  function buildAttackSchedule(plan) {
    const target = resolveTarget(plan);
    if (!target) return { error: 'no target', rows: [] };
    let sources;
    if (plan.sourceTownIds == null) {
      sources = (state.towns || []).map(t => String(t.id));
    } else {
      sources = (plan.sourceTownIds || []).map(String);
    }
    if (!sources.length) return { error: 'no source towns', rows: [] };
    const now = serverNow();
    const skew = clientServerSkewMs();
    const rows = sources.map((townId, idx) => {
      const town = (state.towns || []).find(t => String(t.id) === townId) || { id: townId, name: townId };
      const units = selectUnitsForTown(townId, plan.troopMode, plan.unitType, plan.perTownUnits, plan.harassPreset);
      const travel = computeTravelSeconds(townId, target, units);
      const same = isSameIsland(townId, target);
      const boats = boatCapacityCheck(units, same);
      let sendAt = null;
      if (plan.timingMode === 'arrive_at' && plan.arrivalUnix && travel != null) {
        sendAt = plan.arrivalUnix - travel - (plan.latencyPadMs || 0) / 1000;
      } else if (plan.timingMode === 'send_now') {
        sendAt = now + (idx * (plan.staggerMs || 0)) / 1000;
      }
      const unitCount = Object.values(units).reduce((a, b) => a + (+b || 0), 0);
      let status = 'ok';
      if (!unitCount) status = 'no-units';
      else if (!boats.ok) status = boats.reason;
      else if (travel == null && plan.timingMode === 'arrive_at') status = 'no-travel';
      else if (sendAt != null && sendAt < now - 1) status = 'past';
      return {
        townId, townName: town.name || townId, units, travel, sendAt, boats, status, unitCount, sameIsland: same,
      };
    });
    return { target, rows, now, skew };
  }
  function sendAttackViaBridge(target, srcTownId, units, mission, onDone) {
    if (!hostEnabled()) { flash('bot disabled on this host'); return onDone && onDone('disabled'); }
    if (captchaPaused('attack')) { flash('attack paused (captcha)'); return onDone && onDone('captcha'); }
    if (!attackSendAllowed(target)) {
      flash('attack blocked: target not a town (or unresolved)');
      gbLog('attack: refuse Town/sendUnits for kind=' + (target && target.kind));
      return onDone && onDone('bad-target');
    }

    const live = townLiveUnits(srcTownId);
    const sendUnits = {};
    Object.keys(units || {}).forEach(k => {
      const want = +units[k] || 0;
      const have = +live[k] || 0;
      if (want > 0 && have > 0) sendUnits[k] = Math.min(want, have);
    });
    if (!Object.keys(sendUnits).length) return onDone && onDone('no-units');
    const destId = +target.town_id;
    const tpl = state.attackTpl;
    const tplArgs = (tpl && tpl.arguments) || {};
    const args = {};
    for (const k of Object.keys(tplArgs)) {
      if (k === 'id' || k === 'town_id') continue;
      const v = tplArgs[k];
      if (typeof v === 'string' || typeof v === 'boolean') args[k] = v;
    }
    if (mission) args.type = mission;
    else if (!args.type && tplArgs.type) args.type = tplArgs.type;
    args.id = destId;
    Object.assign(args, sendUnits);
    let modelUrl = (tpl && tpl.model_url) || ('Town/' + srcTownId);
    modelUrl = String(modelUrl).replace(/Town\/\d+/, 'Town/' + srcTownId);
    const payload = {
      model_url: modelUrl,
      action_name: (tpl && tpl.action_name) || 'sendUnits',
      arguments: args,
      town_id: +srcTownId,
    };
    gbLog('attack bridge:', JSON.stringify(payload));
    bridgePost('attack', payload, (err, data) => {
      if (err) { flash('attack failed: ' + err); return onDone && onDone(err); }
      flash('attack sent #' + srcTownId);
      gbLog('attack response:', JSON.stringify(data).slice(0, 200));
      if (onDone) onDone(null, data);
    });
  }
  function pushAttackHistory(entry) {
    state.attackHistory.unshift(entry);
    if (state.attackHistory.length > ATTACK_HISTORY_MAX) state.attackHistory.length = ATTACK_HISTORY_MAX;
    save(STORE.ATTACK_HISTORY, state.attackHistory);
  }
  function cancelArmedAttack() {
    if (!attackArmed) return;
    (attackArmed.timers || []).forEach(id => clearTimeout(id));
    if (attackArmed.raf) cancelAnimationFrame(attackArmed.raf);
    gbLog('attack: cancelled armed wave');
    flash('attack cancelled');
    attackArmed = null;
    renderAttack();
  }

  function patchAttackFireStatus() {
    const sec = panel && panel.querySelector('section[data-tab=attack]');
    if (!sec || sec.hidden) return;
    const table = sec.querySelector('.atk-sched');
    if (!table || !table.querySelector('[data-town]')) {
      renderAttack();
      return;
    }
    const rows = attackPreviewRows.length ? attackPreviewRows : [];
    rows.forEach(r => {
      const cell = table.querySelector('[data-town="' + r.townId + '"] .atk-st');
      if (cell) cell.textContent = r.fireStatus || r.status || '';
    });
    const armed = sec.querySelector('#gb-atk-armed');
    if (armed) armed.textContent = attackArmed ? `ARMED (${attackArmed.rows.length})` : '';
  }

  const ATTACK_ARM_MAX_MS = 90000;
  function armAttackWave(plan, rows) {
    cancelArmedAttack();
    const target = resolveTarget(plan);
    if (!target || !attackSendAllowed(target)) {
      flash('cannot arm: target unresolved or not a town');
      gbLog('attack: arm blocked - need canonical town target (villages unsupported)');
      return;
    }
    const timers = [];
    const delays = [];
    const armedAt = Date.now();
    attackArmed = { timers, rows, plan, cancel: cancelArmedAttack, armedAt };
    const skew0 = clientServerSkewMs();
    gbLog(`attack: armed ${rows.length} towns mode=${plan.timingMode} skew=${Math.round(skew0)}ms (max window ${ATTACK_ARM_MAX_MS}ms)`);
    flash('Browser timers are not military-precise - long waits will not auto-fire');
    rows.forEach((row, idx) => {
      if (!row.unitCount || !row.boats.ok) {
        gbLog(`attack: skip ${row.townId} status=${row.status}`);
        return;
      }
      if (row.status === 'past' || row.status === 'no-travel') {
        gbLog(`attack: skip ${row.townId} status=${row.status}`);
        return;
      }
      let delayMs;
      if (plan.timingMode === 'arrive_at' && row.sendAt != null) {
        const skew = clientServerSkewMs();
        const clientSendMs = row.sendAt * 1000 + skew;
        delayMs = clientSendMs - Date.now();
      } else {
        delayMs = idx * (plan.staggerMs || 0);
      }
      if (delayMs < 0) {
        gbLog(`attack: past send window for ${row.townId} (${Math.round(delayMs)}ms)`);
        row.fireStatus = 'past';
        return;
      }
      if (delayMs > ATTACK_ARM_MAX_MS) {
        gbLog(`attack: ${row.townId} delay ${Math.round(delayMs)}ms > ${ATTACK_ARM_MAX_MS}ms - not arming (re-arm closer to send)`);
        row.fireStatus = 'too-far';
        return;
      }
      delays.push(delayMs);
      const expectedFire = Date.now() + delayMs;
      const tid = gbTimeout(() => {

        const late = Date.now() - expectedFire;
        if (late > 5000) {
          gbLog(`attack: refuse overdue fire for ${row.townId} (late ${Math.round(late)}ms)`);
          row.fireStatus = 'overdue';
          patchAttackFireStatus();
          return;
        }

        const liveTarget = resolveTarget(plan);
        if (!liveTarget || !attackSendAllowed(liveTarget)) {
          row.fireStatus = 'bad-target';
          patchAttackFireStatus();
          return;
        }
        const freshUnits = selectUnitsForTown(row.townId, plan.troopMode, plan.unitType, plan.perTownUnits, plan.harassPreset);
        row.fireStatus = 'firing';
        patchAttackFireStatus();
        sendAttackViaBridge(liveTarget, row.townId, freshUnits, plan.mission, (err) => {
          row.fireStatus = err ? 'err:' + err : 'sent';
          patchAttackFireStatus();
        });
      }, delayMs);
      timers.push(tid);
      row.fireStatus = 'armed+' + Math.round(delayMs) + 'ms';
    });
    pushAttackHistory({
      ts: armedAt, mode: plan.timingMode, targetId: plan.targetId,
      towns: rows.map(r => ({ id: r.townId, sendAt: r.sendAt, travel: r.travel, status: r.status })),
    });
    const maxDelay = delays.length ? Math.max(0, ...delays) : 0;
    timers.push(gbTimeout(() => {
      if (attackArmed && attackArmed.timers === timers) attackArmed = null;
      patchAttackFireStatus();
    }, maxDelay + 5000));
    renderAttack();
  }
  function fireAttackNow(plan, rows) {
    const target = resolveTarget(plan);
    if (!target || !attackSendAllowed(target)) {
      flash('cannot send: target unresolved or not a town');
      return;
    }
    if (!confirm(`Send ${rows.filter(r => r.boats.ok && r.unitCount).length} attack(s) now?`)) return;
    let i = 0;
    const okRows = rows.filter(r => r.boats.ok && r.unitCount);
    (function next() {
      if (i >= okRows.length) {
        pushAttackHistory({ ts: Date.now(), mode: 'send_now_immediate', targetId: plan.targetId, towns: okRows.map(r => r.townId) });
        flash(`attacks x${okRows.length}`);
        return;
      }
      const row = okRows[i++];
      const freshUnits = selectUnitsForTown(row.townId, plan.troopMode, plan.unitType, plan.perTownUnits, plan.harassPreset);
      sendAttackViaBridge(target, row.townId, freshUnits, plan.mission, () => {
        gbTimeout(next, (plan.staggerMs || 25) + Math.random() * 20);
      });
    })();
  }
  function prepareAttack(target) {
    const plan = ensureAttackPlan();
    const isFarm = target.vill_id != null && target.town_id == null && target.kind !== 'town';
    if (isFarm && !target.town_id) {
      plan.targetId = String(target.vill_id || target.id || '');
      plan.targetType = 'farm_town';
    } else {
      plan.targetId = String(target.town_id || target.id || target.vill_id || '');
      plan.targetType = 'town';
    }
    plan.targetX = target.x ?? plan.targetX;
    plan.targetY = target.y ?? plan.targetY;
    if (plan.sourceTownIds == null) plan.sourceTownIds = (state.towns || []).map(t => String(t.id));
    saveAttackPlan();

    if (typeof showTab === 'function') showTab('attack');
    else renderAttack();
    flash('attack planner <- ' + plan.targetId);
  }
  function editThreshold(target) {
    const cur = state.thresholds[target.vill_id] || {};
    const def = Object.entries(cur).map(([k, v]) => `${k}:${v}`).join(',');
    const v = prompt(`Threshold for ${target.vill_id}\nFormat: wood:5000,iron:8000,pop:100\nEmpty = clear`, def);
    if (v == null) return;
    if (v.trim() === '') { delete state.thresholds[target.vill_id]; }
    else {
      const o = {};
      v.split(',').forEach(p => { const m = p.trim().match(/^(\w+)\s*:\s*(\d+)/); if (m) o[m[1]] = +m[2]; });
      state.thresholds[target.vill_id] = o;
    }
    save(STORE.THRESH, state.thresholds);
    renderFarms();
  }
  function knownUnitIds() {
    const uw = gameUw();
    const ids = new Set();
    try {
      if (uw.GameData && uw.GameData.units) Object.keys(uw.GameData.units).forEach(k => ids.add(k));
    } catch (_) {}
    (state.towns || []).forEach(t => Object.keys(townLiveUnits(t.id)).forEach(k => ids.add(k)));
    ['sword', 'slinger', 'archer', 'hoplite', 'rider', 'chariot', 'catapult',
      'big_transporter', 'small_transporter', 'bireme', 'trireme', 'colonize_ship'].forEach(k => ids.add(k));
    return Array.from(ids).sort();
  }
  function fmtUnixLocal(unix) {
    if (unix == null) return '-';
    try { return new Date(unix * 1000 + clientServerSkewMs()).toLocaleTimeString(); } catch (_) { return String(unix); }
  }
  function renderAttack() {
    const sec = panel && panel.querySelector('section[data-tab=attack]');
    if (!sec || sec.hidden) return;
    const plan = ensureAttackPlan();
    const skewEl = sec.querySelector('#gb-atk-skew');
    if (skewEl) skewEl.textContent = `skew ${Math.round(clientServerSkewMs())}ms | srv ${serverNow()}`;
    const table = sec.querySelector('.atk-sched');
    if (!table) return;
    const rows = attackPreviewRows.length ? attackPreviewRows : [];

    if (!rows.length) {
      if (!table.dataset.empty) {
        table.replaceChildren();
        table.dataset.empty = '1';
        const e = document.createElement('div');
        e.style.cssText = 'color:#888;padding:6px 0;font-size:11px';
        e.textContent = 'Preview to compute travel / sendAt / boats';
        table.appendChild(e);
      }
    } else {
      const wanted = rows.map(r => String(r.townId));
      const have = Array.from(table.querySelectorAll('div[data-town]')).map(d => d.dataset.town);
      const sameSet = !table.dataset.empty && have.length === wanted.length && have.every((k, i) => k === wanted[i]);
      if (!sameSet) {
        table.replaceChildren();
        delete table.dataset.empty;
        const hdr = document.createElement('div');
        hdr.style.cssText = 'display:grid;grid-template-columns:1.2fr .7fr .9fr .7fr .8fr;gap:4px;color:#888;font-size:9px;margin-bottom:2px';
        hdr.innerHTML = '<span>town</span><span>travel</span><span>sendAt</span><span>boats</span><span>status</span>';
        table.appendChild(hdr);
      }
      rows.forEach(r => {
        let row = sameSet ? table.querySelector(`div[data-town="${r.townId}"]`) : null;
        if (!row) {
          row = document.createElement('div');
          row.dataset.town = String(r.townId);
          row.style.cssText = 'display:grid;grid-template-columns:1.2fr .7fr .9fr .7fr .8fr;gap:4px;font-size:10px;border-bottom:1px solid #2a2a2a;padding:2px 0';
          for (let i = 0; i < 5; i++) row.appendChild(document.createElement('span'));
          row.children[4].className = 'atk-st';
          row.children[0].title = String(r.townId);
          table.appendChild(row);
        }
        const boatTxt = r.boats.ok ? `OK ${r.boats.cap}/${r.boats.need}` : `NO ${r.boats.cap}/${r.boats.need}`;
        const vals = [
          (r.townName || '').slice(0, 14),
          r.travel != null ? fmtHMS(r.travel) : '-',
          fmtUnixLocal(r.sendAt),
          boatTxt,
          String(r.fireStatus || r.status),
        ];
        for (let i = 0; i < 5; i++) {
          if (row.children[i].textContent !== vals[i]) row.children[i].textContent = vals[i];
        }
        const boatColor = r.boats.ok ? '#6dda7e' : '#f55';
        if (row.children[3].style.color !== boatColor) row.children[3].style.color = boatColor;
      });
    }
    const armed = sec.querySelector('#gb-atk-armed');
    if (armed) armed.textContent = attackArmed ? `ARMED (${attackArmed.rows.length})` : '';

    const tid = sec.querySelector('[data-atk=target]');
    if (tid && document.activeElement !== tid) tid.value = plan.targetId || '';
    const pick = sec.querySelector('[data-atk=pick]');
    if (pick && document.activeElement !== pick) {
      const targets = attackKnownTargets();
      const sig = targets.map(t => t.id + ':' + (t.name || '')).join('|');
      if (pick.dataset.sig !== sig) {
        pick.dataset.sig = sig;
        pick.replaceChildren();
        const o0 = document.createElement('option');
        o0.value = '';
        o0.textContent = targets.length ? `pick town (${targets.length})...` : 'no known towns yet';
        pick.appendChild(o0);
        targets.forEach(t => {
          const o = document.createElement('option');
          o.value = t.id;
          const coord = (t.x != null && t.y != null) ? ` ${t.x}|${t.y}` : '';
          o.textContent = `${(t.name || '?').slice(0, 16)} #${t.id}${coord}`;
          pick.appendChild(o);
        });
      }
      const match = targets.some(t => String(t.id) === String(plan.targetId));
      pick.value = match ? String(plan.targetId) : '';
    }
    const hint = sec.querySelector('#gb-atk-target-hint');
    if (hint) {
      const known = attackKnownTargets().find(t => String(t.id) === String(plan.targetId));
      const resolved = plan.targetId ? resolveTarget(plan) : null;
      if (resolved && resolved.kind === 'town') {
        const nm = known?.name || '';
        const coord = (resolved.x != null && resolved.y != null) ? ` (${resolved.x}|${resolved.y})` : '';
        hint.textContent = `town #${plan.targetId}${nm ? '  |  ' + nm : ''}${coord}`;
        hint.style.color = '#6dda7e';
      } else if (plan.targetId) {
        hint.textContent = resolved
          ? `${resolved.kind} #${plan.targetId} - city attacks need kind=town`
          : 'unresolved - pick from list, click Current in-game, or add x/y';
        hint.style.color = '#f96';
      } else {
        hint.textContent = 'pick a town from spy reports, or click a city in-game then Current';
        hint.style.color = '#888';
      }
    }
    const ax = sec.querySelector('[data-atk=x]');
    if (ax && document.activeElement !== ax) ax.value = plan.targetX ?? '';
    const ay = sec.querySelector('[data-atk=y]');
    if (ay && document.activeElement !== ay) ay.value = plan.targetY ?? '';
    const mis = sec.querySelector('[data-atk=mission]');
    if (mis) mis.value = plan.mission || 'attack';
    const tm = sec.querySelector('[data-atk=timing]');
    if (tm) tm.value = plan.timingMode || 'send_now';
    const pad = sec.querySelector('[data-atk=pad]');
    if (pad && document.activeElement !== pad) pad.value = plan.latencyPadMs ?? 200;
    const troop = sec.querySelector('[data-atk=troop]');
    if (troop) troop.value = plan.troopMode || 'offense';
    const ut = sec.querySelector('[data-atk=unit-type]');
    if (ut) {
      if (!ut.options.length) {
        knownUnitIds().forEach(id => {
          const o = document.createElement('option'); o.value = id; o.textContent = id; ut.appendChild(o);
        });
      }
      ut.value = plan.unitType || 'sword';
      ut.disabled = plan.troopMode !== 'all_of_type';
      ut.style.opacity = ut.disabled ? '0.4' : '1';
      ut.title = ut.disabled
        ? "unit picker only applies when troop mode is 'all of type'"
        : 'unit sent from every source town';
      const utLab = ut.closest('label');
      if (utLab) utLab.style.color = ut.disabled ? '#666' : '#ccc';
    }
    renderMilitaryHelpers(sec, plan);
    attackSyncArrivalFields(sec, plan);
    renderAttackRoles(sec);
    const srcBox = sec.querySelector('.atk-sources');
    if (srcBox && !srcBox.dataset.bound) {
      srcBox.dataset.bound = '1';

    }
    if (srcBox) {
      const selected = plan.sourceTownIds == null
        ? new Set((state.towns || []).map(t => String(t.id)))
        : new Set((plan.sourceTownIds || []).map(String));

      const sig = (state.towns || []).map(t => t.id + ':' + (t.name || '')).join('|') +
        '|O:' + attackTownGroup(ATTACK_ROLE_OFFENSE).join(',') +
        '|D:' + attackTownGroup(ATTACK_ROLE_DEFENSE).join(',');
      if (srcBox.dataset.sig === sig) {
        srcBox.querySelectorAll('input[data-id]').forEach(cb => {
          const want = selected.has(String(cb.dataset.id));
          if (cb.checked !== want) cb.checked = want;
        });
      } else {
        srcBox.dataset.sig = sig;
        srcBox.replaceChildren();
        const off = new Set(attackTownGroup(ATTACK_ROLE_OFFENSE));
        const def = new Set(attackTownGroup(ATTACK_ROLE_DEFENSE));
        (state.towns || []).forEach(t => {
          const lab = document.createElement('label');
          lab.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:10px;cursor:pointer';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = selected.has(String(t.id));
          cb.addEventListener('change', () => {
            const ids = Array.from(srcBox.querySelectorAll('input:checked')).map(c => c.dataset.id);
            plan.sourceTownIds = ids;
            saveAttackPlan();
          });
          cb.dataset.id = String(t.id);
          lab.appendChild(cb);
          const tag = document.createElement('span');
          const tid = String(t.id);
          let badge = '';
          if (off.has(tid) && def.has(tid)) badge = ' O+D';
          else if (off.has(tid)) badge = ' O';
          else if (def.has(tid)) badge = ' D';
          tag.textContent = `${t.name || t.id}${badge}`;
          if (badge) tag.style.color = off.has(tid) ? '#f96' : '#6cf';
          lab.appendChild(tag);
          srcBox.appendChild(lab);
        });
      }
    }
    const per = sec.querySelector('.atk-pertown');
    if (per) {
      per.hidden = plan.troopMode !== 'per_town';
      if (plan.troopMode === 'per_town') {
        per.replaceChildren();
        const ids = plan.sourceTownIds == null
          ? (state.towns || []).map(t => String(t.id))
          : (plan.sourceTownIds || []).map(String);
        ids.forEach(tid2 => {
          const town = (state.towns || []).find(t => String(t.id) === String(tid2)) || { id: tid2, name: tid2 };
          const wrap = document.createElement('div');
          wrap.style.cssText = 'margin-bottom:4px';
          const lab = document.createElement('div');
          lab.style.cssText = 'color:#888;font-size:9px';
          lab.textContent = town.name || tid2;
          const ta = document.createElement('textarea');
          ta.style.cssText = 'width:100%;height:40px;background:#111;color:#cfc;border:1px solid #333;font:10px monospace';
          const live = selectUnitsForTown(tid2, 'offense', plan.unitType, null);
          ta.value = unitsToArea(plan.perTownUnits[tid2] || live);
          ta.addEventListener('change', () => {
            plan.perTownUnits[tid2] = parseUnitsArea(ta.value);
            saveAttackPlan();
          });
          wrap.appendChild(lab); wrap.appendChild(ta);
          per.appendChild(wrap);
        });
      }
    }
  }
  function readAttackForm() {
    const sec = panel && panel.querySelector('section[data-tab=attack]');
    const plan = ensureAttackPlan();
    if (!sec) return plan;
    plan.targetId = sec.querySelector('[data-atk=target]')?.value?.trim() || '';
    const xv = sec.querySelector('[data-atk=x]')?.value;
    const yv = sec.querySelector('[data-atk=y]')?.value;
    plan.targetX = xv === '' || xv == null ? null : +xv;
    plan.targetY = yv === '' || yv == null ? null : +yv;
    plan.mission = sec.querySelector('[data-atk=mission]')?.value || 'attack';
    plan.timingMode = sec.querySelector('[data-atk=timing]')?.value || 'send_now';
    plan.latencyPadMs = +(sec.querySelector('[data-atk=pad]')?.value || 200);
    plan.troopMode = sec.querySelector('[data-atk=troop]')?.value || 'offense';
    plan.unitType = sec.querySelector('[data-atk=unit-type]')?.value || 'sword';
    if (plan.troopMode === 'harass' && !plan.harassPreset) plan.harassPreset = 'light';
    const d = sec.querySelector('[data-atk=arrival-date]')?.value;
    const tm = sec.querySelector('[data-atk=arrival-time]')?.value;
    if (plan.timingMode === 'arrive_at') {
      const unix = attackUnixFromLocal(d, tm);
      if (unix != null) plan.arrivalUnix = unix;
    }
    const srcBox = sec.querySelector('.atk-sources');
    if (srcBox) {
      plan.sourceTownIds = Array.from(srcBox.querySelectorAll('input:checked')).map(c => c.dataset.id);
    }
    saveAttackPlan();
    return plan;
  }
  function townNameById(id) {
    const t = (state.towns || []).find(x => String(x.id) === String(id));
    return (t && t.name) || String(id || '-');
  }
  function renderMilitaryHelpers(sec, plan) {
    if (!sec) return;

    const har = sec.querySelector('.atk-harass');
    if (har) {
      har.querySelectorAll('[data-harass]').forEach(btn => {
        const on = plan.troopMode === 'harass' && plan.harassPreset === btn.dataset.harass;
        btn.style.outline = on ? '1px solid #6cf' : '';
        btn.style.color = on ? '#6cf' : '';
      });
    }

    const box = sec.querySelector('.atk-cmds');
    if (box) {
      const rows = militaryOutgoingMovements();
      box.replaceChildren();
      if (!rows.length) {
        const e = document.createElement('div');
        e.style.cssText = 'color:#666;font-size:10px';
        e.textContent = 'No cancelable outgoing movements';
        box.appendChild(e);
      } else {
        rows.forEach(r => {
          const row = document.createElement('div');
          row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr .7fr auto;gap:4px;font-size:10px;border-bottom:1px solid #2a2a2a;padding:2px 0;align-items:center';
          const c1 = document.createElement('span');
          c1.textContent = `${townNameById(r.home)} -> ${r.target}`;
          c1.title = `cmd ${r.commandId}`;
          const c2 = document.createElement('span');
          c2.textContent = r.type || 'move';
          const c3 = document.createElement('span');
          c3.style.color = '#888';
          c3.textContent = r.cancelLeft != null ? (`${Math.round(r.cancelLeft)}s`) : 'ok';
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = 'Cancel';
          btn.style.cssText = 'background:#333;border:1px solid #555;color:#f96;padding:1px 6px;cursor:pointer;font-size:10px';
          btn.addEventListener('click', () => {
            if (!confirm(`Cancel outgoing ${r.type || 'command'} ${r.commandId}?\n${townNameById(r.home)} -> ${r.target}`)) return;
            militaryCancelCommand(r.commandId, { confirmed: true, townId: r.home }, (err) => {
              flash(err ? ('cancel failed: ' + err) : 'command cancelled');
              renderAttack();
            });
          });
          row.appendChild(c1); row.appendChild(c2); row.appendChild(c3); row.appendChild(btn);
          box.appendChild(row);
        });
      }
    }

    const hbox = sec.querySelector('.atk-heroes');
    if (!hbox) return;
    hbox.replaceChildren();
    if (!heroesEnabled()) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#666;font-size:10px';
      e.textContent = 'Heroes disabled on this world';
      hbox.appendChild(e);
      return;
    }
    const heroes = playerHeroesList();
    if (!heroes.length) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#666;font-size:10px';
      e.textContent = 'No PlayerHero models (open Council once, or world has none)';
      hbox.appendChild(e);
      return;
    }
    const townSel = document.createElement('select');
    townSel.style.cssText = 'background:#111;color:#cfc;border:1px solid #333;font-size:10px;margin-bottom:4px;max-width:100%';
    (state.towns || []).forEach(t => {
      const o = document.createElement('option');
      o.value = String(t.id);
      o.textContent = t.name || t.id;
      townSel.appendChild(o);
    });
    hbox.appendChild(townSel);
    heroes.forEach(h => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-size:10px;border-bottom:1px solid #2a2a2a;padding:3px 0';
      const lab = document.createElement('span');
      lab.style.flex = '1';
      lab.textContent = `${h.name} Lv${h.level}  |  ${h.status}` +
        (h.home ? ` @${townNameById(h.home)}` : '');
      row.appendChild(lab);
      if (h.traveling) {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = 'Cancel travel';
        b.style.cssText = 'background:#333;border:1px solid #555;color:#fc6;padding:1px 6px;cursor:pointer;font-size:10px';
        b.addEventListener('click', () => {
          if (!confirm(`Cancel transfer of ${h.name}?`)) return;
          heroCancelTravel(h.type, { confirmed: true }, (err) => {
            flash(err ? ('hero cancel failed: ' + err) : 'hero travel cancelled');
            renderAttack();
          });
        });
        row.appendChild(b);
      } else if (h.assigned || h.attacking) {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = 'Unassign';
        b.style.cssText = 'background:#333;border:1px solid #555;color:#f96;padding:1px 6px;cursor:pointer;font-size:10px';
        b.addEventListener('click', () => {
          if (!confirm(`Unassign ${h.name} from ${townNameById(h.home || h.origin)}?`)) return;
          heroUnassign(h.type, { confirmed: true }, (err) => {
            flash(err ? ('hero unassign failed: ' + err) : 'hero unassigned');
            renderAttack();
          });
        });
        row.appendChild(b);
      }
      if (!h.injured && !h.attacking && !h.traveling) {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = 'Assign';
        b.style.cssText = 'background:#333;border:1px solid #555;color:#6cf;padding:1px 6px;cursor:pointer;font-size:10px';
        b.addEventListener('click', () => {
          const tid = townSel.value;
          if (!tid) { flash('pick a town'); return; }
          if (!confirm(`Assign ${h.name} -> ${townNameById(tid)}?\n(travel time applies)`)) return;
          heroAssignToTown(h.type, tid, { confirmed: true }, (err) => {
            flash(err ? ('hero assign failed: ' + err) : 'hero transfer started');
            renderAttack();
          });
        });
        row.appendChild(b);
      }
      hbox.appendChild(row);
    });
  }
  function bindAttackTab() {
    const sec = panel && panel.querySelector('section[data-tab=attack]');
    if (!sec || sec.dataset.bound) return;
    sec.dataset.bound = '1';
    sec.querySelector('#gb-atk-preview')?.addEventListener('click', () => {
      const plan = readAttackForm();
      const sched = buildAttackSchedule(plan);
      if (sched.error) { flash(sched.error); return; }
      attackPreviewRows = sched.rows;
      gbLog(`attack preview: ${sched.rows.length} towns, skew=${Math.round(sched.skew)}ms`);
      renderAttack();
    });
    sec.querySelector('#gb-atk-arm')?.addEventListener('click', () => {
      const plan = readAttackForm();
      const sched = buildAttackSchedule(plan);
      if (sched.error) { flash(sched.error); return; }
      attackPreviewRows = sched.rows;
      const ok = sched.rows.filter(r => r.boats.ok && r.unitCount && r.status !== 'past' && r.status !== 'no-travel');
      if (!ok.length) { flash('no towns ready'); renderAttack(); return; }
      if (!confirm(`Arm ${ok.length} attack(s) (${plan.timingMode})?`)) return;
      armAttackWave(plan, ok);
    });
    sec.querySelector('#gb-atk-cancel')?.addEventListener('click', () => cancelArmedAttack());
    sec.querySelector('#gb-atk-now')?.addEventListener('click', () => {
      const plan = readAttackForm();
      const sched = buildAttackSchedule(plan);
      if (sched.error) { flash(sched.error); return; }
      attackPreviewRows = sched.rows;
      renderAttack();
      fireAttackNow(plan, sched.rows);
    });
    sec.querySelector('[data-atk=troop]')?.addEventListener('change', () => {
      readAttackForm();
      renderAttack();
    });
    sec.querySelector('[data-atk=timing]')?.addEventListener('change', () => {
      readAttackForm();
      renderAttack();
    });
    sec.querySelector('[data-atk=arrival-date]')?.addEventListener('change', () => readAttackForm());
    sec.querySelector('[data-atk=arrival-time]')?.addEventListener('change', () => readAttackForm());
    sec.querySelector('#gb-atk-src-all')?.addEventListener('click', () => attackSetAllSources(true));
    sec.querySelector('#gb-atk-src-none')?.addEventListener('click', () => attackSetAllSources(false));
    sec.querySelector('#gb-atk-src-off')?.addEventListener('click', () => attackSelectRoleSources(ATTACK_ROLE_OFFENSE));
    sec.querySelector('#gb-atk-src-def')?.addEventListener('click', () => attackSelectRoleSources(ATTACK_ROLE_DEFENSE));
    sec.querySelector('[data-atk=pick]')?.addEventListener('change', (e) => {
      const id = e.target.value;
      if (!id) return;
      const t = attackKnownTargets().find(x => String(x.id) === String(id));
      if (t) applyAttackTarget(t);
      else applyAttackTarget({ id, name: null, x: null, y: null });
    });
    sec.querySelector('#gb-atk-current')?.addEventListener('click', () => {
      const cur = attackCurrentTownId();
      if (!cur) { flash('no town selected in game'); return; }
      if (cur.own) {
        flash('current town is yours - open an enemy city on the map first');
        return;
      }
      applyAttackTarget(cur);
    });
    sec.querySelector('[data-atk=target]')?.addEventListener('change', () => {
      readAttackForm();
      renderAttack();
    });
    sec.querySelectorAll('[data-harass]').forEach(btn => {
      btn.addEventListener('click', () => {
        applyHarassPreset(btn.dataset.harass);
        const troop = sec.querySelector('[data-atk=troop]');
        if (troop) troop.value = 'harass';
        renderAttack();
      });
    });
    sec.querySelector('#gb-atk-cmds-refresh')?.addEventListener('click', () => renderAttack());
    sec.querySelector('#gb-atk-heroes-refresh')?.addEventListener('click', () => renderAttack());
  }

  const HARASS_CAPS = { '1sling': 1, '5sling': 5, light: 8 };
  const HARASS_PREF = ['slinger', 'rider', 'archer', 'hoplite', 'sword'];

  function militaryDefensePull(targetTownId, onDone) {
    if (!hostEnabled() || captchaPaused('attack') || automationPaused({})) return onDone && onDone('paused');
    if (gbLocked('defense-pull')) return onDone && onDone('busy');
    const uw = gameUw();
    const targetCoords = townCoords(targetTownId);
    const target = {
      town_id: +targetTownId,
      x: targetCoords.x,
      y: targetCoords.y,
      island: targetCoords.island,
    };
    const jobs = [];
    try {
      for (const id of Object.keys((uw.ITowns && uw.ITowns.towns) || {})) {
        if (String(id) === String(targetTownId)) continue;
        const t = uw.ITowns.towns[id];
        const u = Object.assign({}, t.units && t.units());
        delete u.militia;

        const send = {};
        ['sword', 'archer', 'hoplite', 'rider', 'chariot'].forEach(k => {
          if (+u[k] > 0) send[k] = +u[k];
        });
        if (!Object.keys(send).length) continue;
        const same = isSameIsland(id, target);
        if (!same) {

          Object.keys(u).forEach(uid => {
            const m = unitMeta(uid);
            if (m && (m.capacity > 0 || m.berth > 0) && +u[uid] > 0) send[uid] = +u[uid];
          });
          const boats = boatCapacityCheck(send, false);
          if (!boats.ok) {
            gbLogT('def-pull-boats-' + id, 60000,
              `defense-pull: skip town ${id} -> ${targetTownId} (${boats.reason || 'no transport'})`);
            continue;
          }
        }
        jobs.push({ from: id, units: send });
        if (jobs.length >= 5) break;
      }
    } catch (_) {}
    if (!jobs.length) return onDone && onDone('no-units');
    gbLock('defense-pull');
    let i = 0, done = 0;
    (function next() {
      if (i >= jobs.length) {
        gbUnlock('defense-pull');
        gbLog(`defense-pull: ${done}/${jobs.length} -> ${targetTownId}`);
        return onDone && onDone(null, done);
      }
      const j = jobs[i++];
      sendAttackViaBridge({ town_id: +targetTownId, kind: 'town' }, j.from, j.units, 'support', (err) => {
        if (!err) done++;
        gbTimeout(next, 700 + Math.random() * 400);
      });
    })();
  }

  function selectHarassmentUnits(townId, preset) {
    const live = townLiveUnits(townId);
    const out = {};
    const key = String(preset || 'light');
    const cap = HARASS_CAPS[key] != null ? HARASS_CAPS[key] : (+preset || 5);
    if (key === '1sling' || key === '5sling') {
      const have = +live.slinger || 0;
      if (have > 0) out.slinger = Math.min(have, cap);
    } else {
      let left = Math.max(1, cap);
      for (const id of HARASS_PREF) {
        if (left <= 0) break;
        const have = +live[id] || 0;
        if (!have) continue;
        const n = Math.min(have, left);
        out[id] = n;
        left -= n;
      }
    }
    if (!Object.keys(out).length) return out;

    let needBoat = false;
    Object.keys(out).forEach(id => {
      const m = unitMeta(id);
      if (m && !m.is_naval) needBoat = true;
    });
    if (needBoat) {
      Object.keys(live).forEach(id => {
        const m = unitMeta(id);
        if (m && m.capacity > 0 && +live[id] > 0) out[id] = +live[id];
      });
    }
    return out;
  }

  function applyHarassPreset(preset) {
    const plan = ensureAttackPlan();
    plan.troopMode = 'harass';
    plan.harassPreset = String(preset || 'light');
    plan.mission = plan.mission || 'attack';
    saveAttackPlan();
    flash('harass preset: ' + plan.harassPreset + ' (confirm Send now)');
    gbLog('attack: harass preset ' + plan.harassPreset);
    return plan;
  }

  function militaryMovementsUnitsModels() {
    const uw = gameUw();
    const models = [];
    const seen = new Set();
    const push = (m) => {
      if (!m) return;
      const id = m.id != null ? m.id : (m.attributes && m.attributes.id);
      const k = String(id != null ? id : '');
      if (k && seen.has(k)) return;
      if (k) seen.add(k);
      models.push(m);
    };
    try {
      const col = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('MovementsUnits');
      if (col && col.models) col.models.forEach(push);
    } catch (_) {}
    try {
      const cols = uw.MM && uw.MM.getCollections && uw.MM.getCollections().MovementsUnits;
      if (cols) {
        const list = Array.isArray(cols) ? cols : [cols];
        list.forEach(c => { if (c && c.models) c.models.forEach(push); });
      }
    } catch (_) {}
    try {
      const map = uw.MM && uw.MM.getModels && uw.MM.getModels().MovementsUnits;
      if (map) Object.keys(map).forEach(k => push(map[k]));
    } catch (_) {}
    return models;
  }

  function militaryOutgoingMovements() {
    const uw = gameUw();
    const out = [];
    const myTowns = new Set(Object.keys((uw.ITowns && uw.ITowns.towns) || {}).map(String));
    const now = gameNow();
    militaryMovementsUnitsModels().forEach(m => {
      try {
        const a = (m.attributes) || {};
        const home = String(
          (typeof m.getHomeTownId === 'function' && m.getHomeTownId()) ||
          a.home_town_id || a.origin_town_id || ''
        );
        if (!myTowns.has(home)) return;
        const target = String(
          (typeof m.getTargetTownId === 'function' && m.getTargetTownId()) ||
          a.target_town_id || a.destination_town_id || ''
        );
        const incoming = typeof m.isIncomingMovement === 'function'
          ? !!m.isIncomingMovement()
          : (myTowns.has(target) && home !== target);
        if (incoming) return;
        let cancelable = typeof m.isCancelable === 'function'
          ? !!m.isCancelable()
          : (a.cancelable === true || a.cancelable === 1);
        const until = +(typeof m.getCancelableUntil === 'function'
          ? m.getCancelableUntil()
          : a.cancelable_until) || 0;
        if (until > 0 && until <= now) cancelable = false;
        if (!cancelable) return;
        const cmdId = (typeof m.getCommandId === 'function' && m.getCommandId()) ||
          a.command_id || a.id || m.id;
        if (cmdId == null) return;
        const type = String(
          (typeof m.getType === 'function' && m.getType()) ||
          a.type || a.command_name || a.movement_type || ''
        ).toLowerCase();
        const arrival = +(typeof m.getArrivalAt === 'function' && m.getArrivalAt()) ||
          +a.arrival_at || +a.arrived_at || 0;
        out.push({
          id: a.id || m.id,
          commandId: cmdId,
          home, target, type, arrival, until,
          cancelLeft: until > 0 ? Math.max(0, until - now) : null,
        });
      } catch (_) {}
    });
    out.sort((a, b) => (a.arrival || 0) - (b.arrival || 0));
    return out;
  }

  function militaryCancelCommand(commandId, opts, onDone) {
    if (!opts || !opts.confirmed) {
      gbLog('cancel: refused without confirm');
      return onDone && onDone('need-confirm');
    }
    if (!hostEnabled()) return onDone && onDone('disabled');
    if (captchaPaused('cancel') || captchaPaused('attack')) return onDone && onDone('captcha');
    if (automationPaused({})) return onDone && onDone('paused');
    if (gbLocked('cancel')) return onDone && onDone('busy');
    const cmdId = commandId;
    if (cmdId == null || cmdId === '') return onDone && onDone('no-id');

    const live = militaryOutgoingMovements().find(m => String(m.commandId) === String(cmdId));
    if (!live) {
      gbLog('cancel: command ' + cmdId + ' not cancelable / not found');
      return onDone && onDone('not-cancelable');
    }
    gbLock('cancel');
    const tpl = state.cancelTpl;
    const townId = +(live.home) || +(opts.townId) || undefined;
    const payload = {
      model_url: (tpl && tpl.model_url) || 'Command',
      action_name: (tpl && tpl.action_name) || 'cancelCommand',
      arguments: { id: cmdId },
      town_id: townId,
    };
    const finish = (err, data) => {
      gbUnlock('cancel');
      if (!err) gbLog(`cancel: command ${cmdId} OK`);
      else gbLog(`cancel: command ${cmdId} err ${err}`);
      if (onDone) onDone(err, data);
    };
    bridgePost('cancel', payload, (err, data) => {
      if (!err) return finish(null, data);
      if (err === 'captcha' || err === 'captcha-pause' || err === 'paused' ||
          err === 'budget' || err === 'remembered' || err === 'disabled' || err === 'dryrun') {
        return finish(err);
      }

      if (captchaPaused('cancel') || captchaPaused('attack') || automationPaused({}) || !gbLocked('cancel')) {
        return finish('captcha-pause');
      }
      gameAjaxPost('cancel', 'town_overviews', 'cancel_command', { id: cmdId }, (err2, res) => {
        if (!err2) return finish(null, res);
        if (err2 === 'captcha' || err2 === 'captcha-pause' || err2 === 'dryrun') return finish(err2);
        if (captchaPaused('cancel') || captchaPaused('attack') || automationPaused({}) || !gbLocked('cancel')) {
          return finish('captcha-pause');
        }
        gameAjaxPost('cancel', 'command_info', 'cancel_command', { id: cmdId }, finish);
      });
    });
  }

  function heroesEnabled() {
    try {
      const uw = gameUw();
      if (uw.GameDataHeroes && typeof uw.GameDataHeroes.areHeroesEnabled === 'function') {
        return !!uw.GameDataHeroes.areHeroesEnabled();
      }
      return !!(uw.Game && uw.Game.features && uw.Game.features.heroes_enabled);
    } catch (_) { return false; }
  }

  function playerHeroModels() {
    const out = [];
    const seen = new Set();
    const push = (m) => {
      if (!m) return;
      const id = (typeof m.getId === 'function' && m.getId()) ||
        (m.attributes && (m.attributes.type || m.attributes.id)) || m.id;
      const k = String(id || '');
      if (!k || seen.has(k)) return;
      seen.add(k);
      out.push(m);
    };
    try {
      const col = mmCol('PlayerHero') || mmCol('PlayerHeroes');
      if (col && col.models) col.models.forEach(push);
      if (col && typeof col.getHero === 'function') {

      }
    } catch (_) {}
    try {
      const uw = gameUw();
      const map = uw.MM && uw.MM.getModels && uw.MM.getModels().PlayerHero;
      if (map) Object.keys(map).forEach(k => push(map[k]));
    } catch (_) {}
    return out;
  }

  function playerHeroesList() {
    if (!heroesEnabled()) return [];
    const now = gameNow();
    return playerHeroModels().map(m => {
      const a = m.attributes || {};
      const type = (typeof m.getId === 'function' && m.getId()) || a.type || '';
      const name = (typeof m.getName === 'function' && m.getName()) ||
        (a.name) || type;
      const home = +(typeof m.getHomeTownId === 'function' && m.getHomeTownId()) ||
        +a.home_town_id || null;
      const origin = +(typeof m.getOriginTownId === 'function' && m.getOriginTownId()) ||
        +a.origin_town_id || home;
      const arrival = +(typeof m.getArrivalAt === 'function' && m.getArrivalAt()) ||
        +a.town_arrival_at || 0;
      const traveling = typeof m.isTravelingToTown === 'function'
        ? !!m.isTravelingToTown()
        : (arrival > now);
      const injured = typeof m.isInjured === 'function'
        ? !!m.isInjured()
        : (+a.cured_at > now);
      const attacking = typeof m.attacksTown === 'function'
        ? !!m.attacksTown()
        : (a.assignment_type === 'command');
      const assigned = typeof m.isAssignedToTown === 'function'
        ? !!m.isAssignedToTown()
        : (home != null && a.assignment_type === 'town');
      let status = 'free';
      if (injured) status = 'injured';
      else if (attacking) status = 'attacking';
      else if (traveling) status = 'transferring';
      else if (assigned) status = 'assigned';
      return {
        type: String(type),
        name: String(name),
        home, origin, arrival, traveling, injured, attacking, assigned, status,
        level: +(typeof m.getLevel === 'function' && m.getLevel()) || +a.level || 0,
      };
    }).filter(h => h.type);
  }

  function heroTownOccupied(townId, exceptType) {
    const tid = +townId;
    return playerHeroesList().some(h =>
      h.type !== exceptType &&
      ((h.assigned && +h.home === tid) || (h.traveling && +h.home === tid))
    );
  }

  function heroBridgePost(action, heroType, targetTownId, onDone) {
    if (!heroesEnabled()) return onDone && onDone('heroes-off');
    if (!hostEnabled()) return onDone && onDone('disabled');
    if (captchaPaused('hero') || captchaPaused('attack')) return onDone && onDone('captcha');
    if (automationPaused({})) return onDone && onDone('paused');
    if (gbLocked('hero')) return onDone && onDone('busy');
    const type = String(heroType || '');
    if (!type) return onDone && onDone('no-hero');
    const tplMap = state.heroTpl || {};
    const tpl = tplMap[action] || null;
    const args = { type };
    if (targetTownId != null) args.target_town_id = +targetTownId;
    gbLock('hero');
    const payload = {
      model_url: (tpl && tpl.model_url) || 'PlayerHero',
      action_name: (tpl && tpl.action_name) || action,
      arguments: args,
      town_id: targetTownId != null ? +targetTownId : undefined,
    };
    bridgePost('hero', payload, (err, data) => {
      gbUnlock('hero');
      if (!err) gbLog(`hero: ${action} ${type} -> ${targetTownId || '-'} OK`);
      else gbLog(`hero: ${action} ${type} err ${err}`);
      if (onDone) onDone(err, data);
    });
  }

  function heroAssignToTown(heroType, targetTownId, opts, onDone) {
    if (!opts || !opts.confirmed) return onDone && onDone('need-confirm');
    const tid = +targetTownId;
    if (!tid) return onDone && onDone('no-town');
    const hero = playerHeroesList().find(h => h.type === String(heroType));
    if (!hero) return onDone && onDone('missing');
    if (hero.injured) return onDone && onDone('injured');
    if (hero.attacking) return onDone && onDone('attacking');
    if (hero.traveling) return onDone && onDone('transferring');
    if (hero.assigned && +hero.home === tid) return onDone && onDone('already');
    if (heroTownOccupied(tid, hero.type)) {
      gbLog(`hero: town ${tid} already has a hero`);
      return onDone && onDone('town-occupied');
    }
    return heroBridgePost('assignToTown', heroType, tid, onDone);
  }

  function heroUnassign(heroType, opts, onDone) {
    if (!opts || !opts.confirmed) return onDone && onDone('need-confirm');
    const hero = playerHeroesList().find(h => h.type === String(heroType));
    if (!hero) return onDone && onDone('missing');
    if (!hero.assigned && !hero.attacking) return onDone && onDone('not-assigned');
    const townId = hero.origin || hero.home;
    return heroBridgePost('unassignFromTown', heroType, townId, onDone);
  }

  function heroCancelTravel(heroType, opts, onDone) {
    if (!opts || !opts.confirmed) return onDone && onDone('need-confirm');
    const hero = playerHeroesList().find(h => h.type === String(heroType));
    if (!hero) return onDone && onDone('missing');
    if (!hero.traveling) return onDone && onDone('not-traveling');
    const townId = hero.origin || hero.home;
    return heroBridgePost('cancelTownTravel', heroType, townId, onDone);
  }

  const STATS_WINDOWS = { '1h': 3600000, '24h': 86400000, '7d': 604800000 };
  let statsWindow = '24h';

  function statsPct(n, d) { return d ? Math.round(n / d * 100) + '%' : '-'; }

  function preflightProbe(name, fn) {
    try {
      const r = fn();
      if (!r) return { name, ok: false, detail: 'no result' };
      return { name, ok: r.ok !== false, detail: r.detail || '', warn: !!r.warn };
    } catch (e) {
      return { name, ok: false, detail: String(e).slice(0, 80) };
    }
  }
  function preflightRun() {
    const out = [];
    const uw = gameUw();
    const bs = gameBridgeStatus();
    out.push(preflightProbe('bridge', () => ({
      ok: bs.MM && bs.gpAjax && bs.ITowns,
      detail: Object.keys(bs).filter(k => bs[k]).join(' ') || 'nothing readable',
    })));
    out.push(preflightProbe('csrf', () => ({
      ok: !!state.csrf,
      detail: state.csrf ? state.csrf.slice(0, 6) + '...' : 'not found (GM_xmlhttpRequest report fetch needs it)',
    })));
    out.push(preflightProbe('towns', () => {
      const t = (townsFromGame() || []);
      return { ok: t.length > 0, detail: t.length + ' towns readable' };
    }));
    out.push(preflightProbe('farm claims', () => {
      const farms = farmsFromGame() || [];
      const ready = farms.filter(f => f.lootable_at == null || gameNow() >= f.lootable_at).length;
      const tpl = state.claimTpl ? 'template learned' : 'template NOT learned (claim once by hand)';
      return {
        ok: farms.length > 0,
        warn: !state.claimTpl,
        detail: `${farms.length} villages, ${ready} claimable, ${tpl}, options ${farmOptionMapText()}`,
      };
    }));
    out.push(preflightProbe('sleep claim', () => {
      const sec = farmSleepDuration();
      const opt = farmOptionFor(sec);
      return {
        ok: opt != null,
        warn: opt == null,
        detail: opt != null ? `${farmDurLabel(sec)} = option ${opt}` : `${farmDurLabel(sec)} not learned - claim that timer once by hand`,
      };
    }));
    out.push(preflightProbe('instant build', () => {
      const orders = ibOrders() || [];
      const free = orders.filter(o => o.isFree).length;
      const cov = typeof ibTownCoverage === 'function' ? ibTownCoverage() : null;
      const armed = typeof ibArmedAt === 'function' ? ibArmedAt() : 0;
      const armTxt = armed ? `next arm in ${fmtSec((armed - Date.now()) / 1000)}` : 'no order counting down';
      return {
        ok: true,
        warn: !!(cov && cov.total && cov.readable < cov.total),
        detail: `${orders.length} orders, ${free} free now, action ${state.ibAction}`
          + (cov ? `, order queues readable ${cov.readable}/${cov.total} towns` : '')
          + `, ${armTxt}`,
      };
    }));
    out.push(preflightProbe('instant research', () => {
      const r = (typeof ibResearchOrders === 'function' ? (ibResearchOrders({}) || []) : []);
      return {
        ok: state.ibResearch !== false,
        detail: `${r.length} research orders, action ${state.ibActionR}${state.ibResearch === false ? ' (OFF)' : ''}`,
      };
    }));
    out.push(preflightProbe('cave', () => {
      const ids = caveListTownIds() || [];
      let withHide = 0, readable = 0;
      ids.forEach(id => {
        const info = caveTownInfo(id);
        if (!info) return;
        readable++;
        if (info.hideLvl > 0) withHide++;
      });
      return {
        ok: readable > 0,
        warn: withHide === 0,
        detail: `${readable}/${ids.length} towns readable, ${withHide} with a hide`,
      };
    }));
    out.push(preflightProbe('trade', () => {
      const t = tradeListTowns() || [];
      const cap = t.filter(x => x.cap > 0).length;
      return { ok: t.length >= 2, detail: `${t.length} towns, ${cap} with readable capacity` };
    }));
    out.push(preflightProbe('research', () => {
      const ids = (townsFromGame() || []).map(t => t.id);
      const info = ids.length ? researchTownTechs(ids[0]) : null;
      const techMap = info && info.techs ? info.techs : null;
      const n = techMap ? Object.keys(techMap).length : 0;
      return { ok: n > 0, detail: n ? n + ' techs readable in first town' : 'academy techs unreadable' };
    }));

    out.push(preflightProbe('cost reads', () => {
      const ids = (townsFromGame() || []).map(t => t.id);
      const tid = ids[0];
      const parts = [];
      let blind = 0;
      const cap = tid != null ? townResState(tid) : null;
      if (cap) parts.push('stock+capacity ok');
      else { parts.push('stock UNREADABLE'); blind++; }
      const pop = tid != null ? gbTownPop(tid) : null;
      if (pop != null) parts.push('population ok');
      else { parts.push('population UNREADABLE'); blind++; }
      const gold = gbPlayerGold();
      if (gold != null) parts.push('gold ok');
      else { parts.push('gold UNREADABLE'); blind++; }
      const rc = typeof researchCost === 'function' ? researchCost(RESEARCH_CS_FAST[0]) : null;
      if (rc) parts.push('research costs ok');
      else { parts.push('research costs UNREADABLE'); blind++; }
      const bc = (tid != null && typeof abBuildingCost === 'function') ? abBuildingCost(tid, 'main') : null;
      if (bc) parts.push('building costs ok');
      else { parts.push('building costs unreadable (open a build window once)'); blind++; }
      return { ok: blind < 5, warn: blind > 0, detail: parts.join(', ') };
    }));
    out.push(preflightProbe('merchant ship', () => {
      const town = typeof ptSalesmanTown === 'function' ? ptSalesmanTown() : null;
      const tpl = !!state.ptTradeTpl;
      const view = !!state.ptViewUrl;
      return {
        ok: true,
        warn: !tpl || !view,
        detail: (town == null ? 'no ship readable' : 'ship in town ' + town)
          + (tpl ? ', trade payload learned' : ', trade payload NOT learned (trade once by hand)')
          + (view ? ', view URL learned' : ', view URL NOT learned (open the window once)'),
      };
    }));
    out.push(preflightProbe('attack', () => ({
      ok: !!state.attackTpl,
      warn: !state.attackTpl,
      detail: state.attackTpl ? 'template learned' : 'template NOT learned (send one attack by hand)',
    })));
    out.push(preflightProbe('cancel', () => {
      let n = 0;
      try { n = militaryOutgoingMovements().length; } catch (_) {}
      return {
        ok: true,
        warn: !state.cancelTpl && n === 0,
        detail: state.cancelTpl
          ? `template learned; ${n} cancelable outgoing`
          : (n ? `${n} cancelable outgoing (hand-cancel once to learn tpl)` : 'no cancelable outgoing; tpl not learned'),
      };
    }));
    out.push(preflightProbe('heroes', () => {
      if (!heroesEnabled()) return { ok: true, warn: true, detail: 'heroes disabled on this world' };
      const list = playerHeroesList();
      const acts = state.heroTpl && typeof state.heroTpl === 'object' ? Object.keys(state.heroTpl) : [];
      return {
        ok: list.length > 0 || acts.length > 0,
        warn: list.length === 0,
        detail: list.length
          ? `${list.length} hero(es); tpl=${acts.join(',') || 'none'}`
          : 'PlayerHero collection empty (open Council once)',
      };
    }));
    out.push(preflightProbe('incoming', () => {
      const mv = (typeof dodgeIncomingMovements === 'function' ? (dodgeIncomingMovements() || []) : []);
      return { ok: true, detail: `${mv.length} incoming movements visible` };
    }));
    out.push(preflightProbe('quests', () => {
      const col = mmCol('Progressable') || mmCol('IslandQuest');
      const n = col && col.models ? col.models.length : 0;
      return { ok: n >= 0, detail: n ? n + ' quest models' : 'no quest collection (open a quest once)' };
    }));
    out.push(preflightProbe('bandit camp', () => {
      let spot = null;
      try { spot = uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('PlayerAttackSpot'); } catch (_) {}
      return { ok: !!spot, warn: !spot, detail: spot ? 'attack spot model present' : 'no attack spot on this world' };
    }));
    out.push(preflightProbe('scheduler', () => {
      const on = orchStatus().filter(s => s.on);
      const idle = on.filter(s => s.idle >= 4).map(s => s.key);
      return {
        ok: true,
        detail: `${on.length} econ features ON${idle.length ? ', idle-backed-off: ' + idle.join(',') : ''}`,
      };
    }));
    out.push(preflightProbe('guards', () => {
      const locks = gbLockList();
      const paused = Object.keys(state.captchaBreakers || {}).filter(k => captchaPaused(k));
      const parts = [];
      if (state.dryRun) parts.push('DRY-RUN ON (bridge/AJAX + DOM clicks blocked)');
      if (locks.length) parts.push('locks held: ' + locks.join(','));
      if (paused.length) parts.push('captcha: ' + paused.join(','));
      if (gbServerPaused()) parts.push('server cooldown ' + fmtSec(Math.round(gbServerCooldownLeftMs() / 1000)));
      const skips = jrnActiveSkips();
      if (skips.length) parts.push(skips.length + ' memory skip windows');
      try {
        const last = gbRecall();
        if (last) parts.push('last decision: ' + last.f + '/' + (last.r || '?'));
        const recentFails = gbRecallAll().filter(r => r && r.r && r.r !== 'ok' && (Date.now() - r.ts) < 3600000);
        if (recentFails.length) parts.push(recentFails.length + ' hard fails (1h)');
      } catch (_) {}
      return { ok: true, warn: parts.length > 0, detail: parts.length ? parts.join(' | ') : 'clear' };
    }));
    return out;
  }

  let preflightLast = null;
  function preflightRunAndRender() {
    preflightLast = { at: Date.now(), rows: preflightRun() };
    const bad = preflightLast.rows.filter(r => !r.ok).length;
    gbLog(`preflight: ${preflightLast.rows.length - bad}/${preflightLast.rows.length} checks pass`);
    preflightLast.rows.forEach(r => gbLog(`  ${r.ok ? (r.warn ? 'WARN' : 'ok  ') : 'FAIL'} ${r.name}: ${r.detail}`));
    renderStats();
    flash(bad ? `preflight: ${bad} failing` : 'preflight: all pass');
  }

  function renderStats() {
    const sec = panel && panel.querySelector('section[data-tab=stats]');
    if (!sec || sec.hidden) return;
    const box = sec.querySelector('.stats-body');
    if (!box) return;
    const st = jrnStats(STATS_WINDOWS[statsWindow] || 86400000);
    const lines = [];
    lines.push(`window ${statsWindow} | ${st.total} decisions | ${st.attempts} attempts | success ${st.successPct == null ? '-' : st.successPct + '%'}`);
    lines.push(`ok ${st.ok}  err ${st.err}  captcha ${st.captcha}  timeout ${st.timeout}  skipped ${st.skip}${st.dry ? ` (dry-run ${st.dry})` : ''}`);
    const claims = jrnCountOk('farm', /claim/i, STATS_WINDOWS[statsWindow] || 86400000);
    const builds = jrnCountOk('build', /Instant|instant/i, STATS_WINDOWS[statsWindow] || 86400000);
    lines.push(`farm claims ${claims} | instant completions ${builds}`);
    lines.push('');
    lines.push('feature      ok   err  cap  skip   rate');
    const feats = Object.keys(st.byFeature).sort();
    if (!feats.length) lines.push('  (no decisions recorded in this window)');
    feats.forEach(f => {
      const v = st.byFeature[f];
      const att = v.ok + v.err + v.captcha + v.timeout;
      lines.push(
        f.padEnd(12).slice(0, 12) +
        String(v.ok).padStart(4) +
        String(v.err).padStart(6) +
        String(v.captcha).padStart(5) +
        String(v.skip).padStart(6) +
        statsPct(v.ok, att).padStart(7));
    });
    if (st.topErrors.length) {
      lines.push('');
      lines.push('top errors');
      st.topErrors.forEach(([k, n]) => lines.push(`  ${n}x ${k}`));
    }
    if (st.topSkips.length) {
      lines.push('');
      lines.push('top skip reasons');
      st.topSkips.forEach(([k, n]) => lines.push(`  ${n}x ${k}`));
    }
    lines.push('');
    lines.push('scheduler (cadence includes adaptive idle backoff)');
    orchStatus().filter(s => s.on).forEach(s => {
      lines.push(`  ${s.key.padEnd(11)} every ${fmtSec(Math.round(s.cadenceMs / 1000)).padEnd(6)} next ${fmtSec(Math.round(s.dueInMs / 1000)).padEnd(6)}${s.idle ? ' idle x' + s.idle : ''}${s.captcha ? ' CAPTCHA' : ''}`);
    });
    const locks = gbLockList();
    lines.push('');
    lines.push(`requests last min ${reqBudgetUsed()}/${state.reqBudgetPerMin || 40}` +
      (gbServerPaused() ? ` | server cooldown ${fmtSec(Math.round(gbServerCooldownLeftMs() / 1000))}` : '') +
      (locks.length ? ` | locks ${locks.join(',')}` : '') +
      (state.dryRun ? ' | DRY-RUN' : ''));
    if (preflightLast) {
      lines.push('');
      lines.push(`preflight (${new Date(preflightLast.at).toLocaleTimeString()})`);
      preflightLast.rows.forEach(r => {
        lines.push(`  ${r.ok ? (r.warn ? '!' : '+') : 'x'} ${r.name}: ${r.detail}`);
      });
    }
    box.textContent = lines.join('\n');
  }

  function evidenceTplShape(v) {
    if (v == null) return { present: false };
    const t = Array.isArray(v) ? 'array' : typeof v;
    if (t === 'object') return { present: true, type: 'object', keys: Object.keys(v).sort() };
    if (t === 'array') return { present: true, type: 'array', length: v.length };
    return { present: true, type: t };
  }
  function evidenceMask(id) {
    if (state.exportRedact === false) return id;
    if (id == null || id === '') return id;
    const s = String(id);
    if (/^\d+$/.test(s)) return s.length <= 2 ? '**' : s.slice(0, 2) + '***';
    if (s.length <= 3) return '***';
    return s.slice(0, 2) + '***';
  }
  function evidenceLastByFeature(maxPer) {
    const lim = maxPer || 20;
    const by = {};
    const list = state.decisions || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const r = list[i];
      if (!r || !r.f) continue;
      if (!by[r.f]) by[r.f] = [];
      if (by[r.f].length >= lim) continue;
      by[r.f].push({
        ts: r.ts, a: r.a, k: evidenceMask(r.k), r: r.r, n: r.n,
        d: r.d ? String(r.d).slice(0, 80) : undefined,
      });
    }
    return by;
  }
  function gbEvidence() {
    const now = Date.now();
    const csrf = state.csrf ? String(state.csrf) : '';
    const tplKeys = [
      'claimTpl', 'ibAction', 'ibActionR', 'attackTpl', 'cancelTpl',
      'heroTpl', 'collectTpl', 'farmAction', 'farmOptionMap',
    ];
    const templates = {};
    tplKeys.forEach(k => { templates[k] = evidenceTplShape(state[k]); });
    const breakers = {};
    Object.keys(state.captchaBreakers || {}).forEach(f => {
      const b = state.captchaBreakers[f];
      if (!b) return;
      breakers[f] = {
        trips: b.trips || 0,
        until: b.until || 0,
        leftMs: Math.max(0, (b.until || 0) - now),
        detail: b.detail ? String(b.detail).slice(0, 60) : null,
      };
    });
    const locks = (gbLockList() || []).map(name => ({
      name,
      ageMs: typeof gbLockAge === 'function' ? gbLockAge(name) : null,
      ttlMs: (GB_LOCK_TTL && GB_LOCK_TTL[name]) || 120000,
    }));
    const toggles = {};
    Object.keys(state).forEach(k => {
      if (/^auto[A-Z]/.test(k) || k === 'dryRun' || k === 'ibAuto' || k === 'ibResearch' ||
          k === 'collectAll' || k === 'decisionMemory' || k === 'captchaGlobalKill' ||
          k === 'orchAdaptive' || k === 'farmLongClaims' || k === 'farmSleepAuto') {
        toggles[k] = !!state[k];
      }
    });
    toggles.hostEnabled = !!hostEnabled();
    const last = evidenceLastByFeature(20);
    const lastOk = {};
    const lastSkip = {};
    Object.keys(last).forEach(f => {
      const ok = last[f].find(r => r.r === 'ok');
      const sk = last[f].find(r => String(r.r || '').indexOf('skip:') === 0);
      if (ok) lastOk[f] = ok;
      if (sk) lastSkip[f] = sk;
    });
    return {
      at: new Date(now).toISOString(),
      build: {
        version: runningVersion(),
        host: location.host,
        worldKey: wkey(''),
        configVer: state.configVer,
        exportRedact: state.exportRedact !== false,
      },
      csrf: { present: !!csrf, prefix: csrf ? csrf.slice(0, 6) : null },
      toggles,
      scheduler: typeof orchStatus === 'function' ? orchStatus() : [],
      templates,
      captcha: {
        globalKill: state.captchaGlobalKill !== false,
        globalUntil: captchaGlobalUntil || 0,
        globalLeftMs: Math.max(0, (captchaGlobalUntil || 0) - now),
        breakers,
      },
      server: {
        paused: typeof gbServerPaused === 'function' ? gbServerPaused() : false,
        leftMs: typeof gbServerCooldownLeftMs === 'function' ? gbServerCooldownLeftMs() : 0,
      },
      locks,
      budget: {
        perMin: state.reqBudgetPerMin || 40,
        usedLastMin: typeof reqBudgetUsed === 'function' ? reqBudgetUsed() : 0,
      },
      lastOk,
      lastSkip,
      recentByFeature: last,
      decisionSkips: (typeof jrnActiveSkips === 'function' ? jrnActiveSkips() : []).map(s => ({
        key: evidenceMask(s.key),
        until: s.until,
        leftMs: Math.max(0, s.until - now),
        trips: s.trips,
        r: s.r,
      })),
      scrapes: {
        nextFarmScrape: state.nextFarmScrape || 0,
        farmDueInMs: state.nextFarmScrape ? Math.max(0, state.nextFarmScrape - now) : null,
        nextTownsScrape: state.nextTownsScrape || 0,
        townsDueInMs: state.nextTownsScrape ? Math.max(0, state.nextTownsScrape - now) : null,
      },
      counts: {
        findings: (state.findings || []).length,
        seen: Object.keys(state.seen || {}).length,
        farms: (state.farmsParsed || []).length,
        towns: (state.towns || []).length,
        decisions: (state.decisions || []).length,
      },
      deadlock: (typeof econDeadlock === 'function') ? (() => {
        const d = econDeadlock();
        return { open: !!d.open, towns: (d.towns || []).map(evidenceMask) };
      })() : null,
      wake: {
        depth: typeof gbWakeDepth === 'function' ? gbWakeDepth() : 0,
        burst: typeof gbInWakeBurst === 'function' ? gbInWakeBurst() : false,
      },
      tplHealth: (() => {
        const h = state.tplHealth || {};
        const out = {};
        Object.keys(h).forEach(k => {
          const v = h[k] || {};
          out[k] = {
            learnedAt: v.learnedAt || 0,
            lastOkAt: v.lastOkAt || 0,
            hardFails: v.hardFails || 0,
            invalidated: !!v.invalidated,
            ageMs: v.learnedAt ? now - v.learnedAt : null,
          };
        });
        return out;
      })(),
    };
  }
  function gbEvidenceText() {
    try { return JSON.stringify(gbEvidence(), null, 2); }
    catch (e) { return '{"error":' + JSON.stringify(String(e).slice(0, 120)) + '}'; }
  }
  function evidenceCopy() {
    const text = gbEvidenceText();
    const ok = () => {
      flash('evidence copied');
      gbLog('evidence: copied ' + text.length + ' chars');
    };
    const fail = () => {
      console.groupCollapsed('[grepbot] evidence');
      console.log(text);
      console.groupEnd();
      flash('evidence in console');
      gbLog('evidence: clipboard fail - expand [grepbot] evidence in console');
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok, fail);
        return;
      }
    } catch (_) {}
    fail();
  }

  function makeSortable(table, rowDataFn) {
    const thead = table.querySelector('thead');
    if (!thead) return;
    thead.querySelectorAll('th').forEach((th, col) => {
      if (th.dataset.nosort) return;
      th.style.cursor = 'pointer';
      th.title = 'sort';
      th.addEventListener('click', () => {
        const tbody = table.querySelector('tbody') || table;
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const asc = th.dataset.sort !== 'asc';
        thead.querySelectorAll('th').forEach(h => delete h.dataset.sort);
        th.dataset.sort = asc ? 'asc' : 'desc';
        rows.sort((a, b) => {
          const av = rowDataFn(a, col), bv = rowDataFn(b, col);
          const an = parseFloat(av), bn = parseFloat(bv);
          const cmp = (!isNaN(an) && !isNaN(bn)) ? an - bn : String(av).localeCompare(String(bv));
          return asc ? cmp : -cmp;
        });
        rows.forEach(r => tbody.appendChild(r));
      });
    });
  }

  function renderSleepStatus() {
    const el = panel && panel.querySelector('#gb-sleep-status');
    if (!el) return;
    const sec = farmSleepDuration();
    const known = farmOptionFor(sec) != null;
    el.textContent = `${farmDurLabel(sec)} | ${known ? 'option ' + farmOptionFor(sec) : 'not learned - click that timer once in game'}` +
      ` | auto ${state.farmSleepAuto ? 'ON' : 'OFF'}${state.farmSleepDay ? ' | last ' + state.farmSleepDay : ''}`;
    el.style.color = known ? '#888' : '#fc6';
    try { renderFarmTeachBanner(); } catch (_) {}
  }

  function tableShell(list, headers) {
    let table = list.querySelector('table');
    if (!table) {
      list.replaceChildren();
      table = document.createElement('table');
      const thead = document.createElement('thead');
      const trh = document.createElement('tr');
      headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        trh.appendChild(th);
      });
      thead.appendChild(trh);
      table.appendChild(thead);
      table.appendChild(document.createElement('tbody'));
      list.appendChild(table);
      makeSortable(table, (tr, col) => (tr.dataset.sort || '').split('\t')[col] || '');
    }
    return table;
  }
  function patchCells(tr, cells) {
    const tds = tr.children;
    for (let i = 0; i < cells.length; i++) {
      const td = tds[i];
      if (!td) continue;
      const c = cells[i];
      if (td.textContent !== c.text) td.textContent = c.text;
      const cls = c.cls || '';
      if (td.className !== cls) td.className = cls;
    }
  }
  function placeholder(list, text) {
    const e = document.createElement('div');
    e.style.cssText = 'color:#888;padding:6px 0;font-size:11px';
    e.textContent = text;
    list.replaceChildren(e);
  }
  function farmCells(f) {
    const r = state.farmResources[f.vill_id];
    return [
      { cls: 'id', text: String(f.vill_id) },
      { cls: '', text: r?.name || (f.notes || '').slice(0, 20) || '-' },
      { cls: '', text: r?.ok ? fmt(r.wood) : '-' },
      { cls: '', text: r?.ok ? fmt(r.stone) : '-' },
      { cls: '', text: r?.ok ? fmt(r.iron) : '-' },
      { cls: '', text: r?.ok && r.pop != null ? `${fmt(r.pop)}/${fmt(r.cap)}` : '-' },
      { cls: r ? (r.ok ? 'stale' : 'err') : 'stale',
        text: r ? (r.ok ? `${Math.round((Date.now() - r.ts) / 1000)}s` : (r.err || 'err')) : '-' },
    ];
  }
  function renderFarms() {
    renderSleepStatus();
    const list = panel.querySelector('.farms-list');
    if (!list) return;
    if (!state.farmsParsed.length) {
      if (!list.querySelector('div')) placeholder(list, 'no farms parsed yet - add vill_id lines below');
      return;
    }
    const table = tableShell(list, ['id', 'name', 'W', 'S', 'I', 'pop', 'seen', '']);
    const tbody = table.querySelector('tbody');

    const wanted = state.farmsParsed.map(f => String(f.vill_id));
    const have = new Set(Array.from(tbody.children).map(tr => tr.dataset.key));
    const sameSet = have.size === wanted.length && wanted.every(k => have.has(k));
    if (!sameSet) tbody.replaceChildren();
    for (const f of state.farmsParsed) {
      const key = String(f.vill_id);
      const r = state.farmResources[f.vill_id];
      const t = state.thresholds[f.vill_id] || {};
      const cells = farmCells(f);
      let tr = sameSet ? tbody.querySelector(`tr[data-key="${key}"]`) : null;
      if (!tr) {
        tr = document.createElement('tr');
        tr.dataset.key = key;
        cells.forEach(() => tr.appendChild(document.createElement('td')));
        const actions = document.createElement('td');
        const thrBtn = document.createElement('button');
        thrBtn.textContent = 'THR'; thrBtn.title = 'Set threshold';
        thrBtn.style.cssText = 'background:none;border:1px solid #555;color:#fc6;padding:1px 5px;cursor:pointer;font-size:11px';
        thrBtn.addEventListener('click', () => editThreshold(f));
        actions.appendChild(thrBtn);
        tr.appendChild(actions);
        tbody.appendChild(tr);
      }
      let alert = false;
      if (r && r.ok) {
        const over = (k) => t[k] != null && r[k] != null && r[k] >= t[k];
        alert = over('wood') || over('stone') || over('iron') || over('pop');
      }
      const cls = alert ? 'alert' : '';
      if (tr.className !== cls) tr.className = cls;
      const sort = [f.vill_id, r?.name || '', r?.wood ?? '', r?.stone ?? '', r?.iron ?? '', r?.pop ?? '', r?.ts ?? ''].join('\t');
      if (tr.dataset.sort !== sort) tr.dataset.sort = sort;
      patchCells(tr, cells);
    }
  }
  let _worldTotalsLast = '';
  function renderWorld() {
    const totals = panel.querySelector('.world-totals');
    const list = panel.querySelector('.world-list');
    if (!totals || !list) return;
    let w = 0, s = 0, i = 0, p = 0, okN = 0;
    for (const r of Object.values(state.townResources)) {
      if (!r || !r.ok) continue;
      okN++;
      if (r.wood != null) w += r.wood;
      if (r.stone != null) s += r.stone;
      if (r.iron != null) i += r.iron;
      if (r.pop != null) p += r.pop;
    }
    const head = `${state.towns.length} towns | ${okN} ok`;
    const res = `Wood ${fmt(w)} | Stone ${fmt(s)} | Iron ${fmt(i)} | Pop ${fmt(p)}`;
    if (head + res !== _worldTotalsLast) {
      _worldTotalsLast = head + res;
      totals.replaceChildren();
      const totalsH = document.createElement('div');
      totalsH.style.cssText = 'font-weight:bold;color:#f5a623';
      totalsH.textContent = head;
      totals.appendChild(totalsH);
      const totalsR = document.createElement('div');
      totalsR.style.cssText = 'color:#cfc;margin-top:3px';
      totalsR.textContent = res;
      totals.appendChild(totalsR);
    }
    if (!state.towns.length) {
      if (!list.querySelector('div')) placeholder(list, 'no towns loaded yet - click Refresh towns');
      return;
    }
    const table = tableShell(list, ['id', 'name', 'W', 'S', 'I', 'pop', 'seen']);
    const tbody = table.querySelector('tbody');
    const wanted = state.towns.map(t => String(t.id));
    const have = new Set(Array.from(tbody.children).map(tr => tr.dataset.key));
    const sameSet = have.size === wanted.length && wanted.every(k => have.has(k));
    if (!sameSet) tbody.replaceChildren();
    for (const t of state.towns) {
      const key = String(t.id);
      const r = state.townResources[t.id];
      const cells = [
        { cls: 'id', text: String(t.id) },
        { cls: '', text: t.name || '-' },
        { cls: '', text: r?.ok ? fmt(r.wood) : '-' },
        { cls: '', text: r?.ok ? fmt(r.stone) : '-' },
        { cls: '', text: r?.ok ? fmt(r.iron) : '-' },
        { cls: '', text: r?.ok && r.pop != null ? `${fmt(r.pop)}/${fmt(r.cap)}` : '-' },
        { cls: r ? (r.ok ? 'stale' : 'err') : 'stale',
          text: r ? (r.ok ? `${Math.round((Date.now() - r.ts) / 1000)}s` : (r.err || 'err')) : '-' },
      ];
      let tr = sameSet ? tbody.querySelector(`tr[data-key="${key}"]`) : null;
      if (!tr) {
        tr = document.createElement('tr');
        tr.dataset.key = key;
        cells.forEach(() => tr.appendChild(document.createElement('td')));
        tbody.appendChild(tr);
      }
      const sort = [t.id, t.name || '', r?.wood ?? '', r?.stone ?? '', r?.iron ?? '', r?.pop ?? '', r?.ts ?? ''].join('\t');
      if (tr.dataset.sort !== sort) tr.dataset.sort = sort;
      patchCells(tr, cells);
    }
  }
  function fmt(n) {
    if (n == null) return '-';
    if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
    if (n >= 1000) return Math.round(n/1000) + 'k';
    return String(n);
  }

  const PANEL_MIN_W = 360, PANEL_MIN_H = 200, PANEL_SQ = 40;
  const TAB_GROUPS = [
    { id: 'scout', label: 'Scout', tabs: [
      { id: 'findings', label: 'Findings' },
      { id: 'farms', label: 'Farms' },
      { id: 'world', label: 'World' },
    ]},
    { id: 'action', label: 'Action', tabs: [
      { id: 'attack', label: 'Attack' },
      { id: 'quests', label: 'Quests' },
      { id: 'build', label: 'Build' },
    ]},
    { id: 'account', label: 'Account', tabs: [
      { id: 'overview', label: 'Overview' },
      { id: 'intel', label: 'Intel' },
    ]},
    { id: 'system', label: 'System', tabs: [
      { id: 'config', label: 'Config' },
      { id: 'stats', label: 'Stats' },
      { id: 'log', label: 'Log' },
    ]},
  ];
  const TAB_IDS = TAB_GROUPS.reduce((a, g) => { g.tabs.forEach(t => a.push(t.id)); return a; }, []);
  const _lastTabInGroup = {};
  let configBound = false;
  let findingsFilterEl = null;

  function tabGroupOf(tabId) {
    for (const g of TAB_GROUPS) {
      if (g.tabs.some(t => t.id === tabId)) return g;
    }
    return TAB_GROUPS[0];
  }

  function savePanelGeom() {
    if (!panel) return;
    const g = {
      left: panel.style.left || null,
      top: panel.style.top || null,
      right: panel.style.right || null,
      width: panel.classList.contains('collapsed') ? (state.panelGeom && state.panelGeom.width) || null : (panel.style.width || null),
      height: panel.classList.contains('collapsed') ? (state.panelGeom && state.panelGeom.height) || null : (panel.style.height || null),
      collapsed: panel.classList.contains('collapsed'),
    };
    state.panelGeom = g;
    save(STORE.PANEL_GEOM, g);
  }

  function applyPanelGeom(g) {
    if (!panel || !g) return;
    if (g.left != null) { panel.style.left = g.left; panel.style.right = 'auto'; }
    else if (g.right != null) { panel.style.right = g.right; panel.style.left = ''; }
    if (g.top != null) panel.style.top = g.top;
    if (g.width) panel.style.width = g.width;
    if (g.height) { panel.style.height = g.height; panel.style.maxHeight = 'none'; }
    if (g.collapsed) {
      panel.classList.add('collapsed');
      const btn = panel.querySelector('header button[data-act=toggle]');
      if (btn) btn.textContent = '[]';
    }
  }

  function resetPanelGeom() {
    panel.classList.remove('collapsed');
    panel.style.left = '';
    panel.style.top = '8px';
    panel.style.right = '8px';
    panel.style.width = '';
    panel.style.height = '';
    panel.style.maxHeight = '';
    const btn = panel.querySelector('header button[data-act=toggle]');
    if (btn) btn.textContent = '_';
    state.panelGeom = null;
    save(STORE.PANEL_GEOM, null);
    flash('panel reset');
  }

  function paintNav(activeTab) {
    if (!panel) return;
    const group = tabGroupOf(activeTab);
    const nav = panel.querySelector('.gb-nav');
    const sub = panel.querySelector('.gb-subtabs');
    if (!nav || !sub) return;
    nav.replaceChildren();
    TAB_GROUPS.forEach(g => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.group = g.id;
      b.textContent = g.label;
      if (g.id === group.id) b.classList.add('on');
      b.addEventListener('click', () => {
        if (g.id === group.id) return;
        const prefer = _lastTabInGroup[g.id] || g.tabs[0].id;
        showTab(prefer);
      });
      nav.appendChild(b);
    });
    sub.replaceChildren();
    group.tabs.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.tab = t.id;
      b.textContent = t.label;
      if (t.id === activeTab) b.classList.add('on');
      b.addEventListener('click', () => showTab(t.id));
      sub.appendChild(b);
    });
  }

  function showTab(tabId, opts) {
    if (!panel) return;
    if (!TAB_IDS.includes(tabId)) tabId = 'findings';
    const force = !!(opts && opts.force);
    const same = state.activeTab === tabId && !force;
    const group = tabGroupOf(tabId);
    _lastTabInGroup[group.id] = tabId;
    state.activeTab = tabId;
    save(STORE.ACTIVE_TAB, tabId);
    paintNav(tabId);
    panel.querySelectorAll('section[data-tab]').forEach(s => {
      s.hidden = s.dataset.tab !== tabId;
    });
    if (same) {
      if (tabId === 'findings') renderFindings();
      else if (tabId === 'world') renderWorld();
      else if (tabId === 'build') renderBuild();
      else if (tabId === 'attack') renderAttack();
      else if (tabId === 'quests') renderQuests();
      else if (tabId === 'log') { renderLog(); renderJournal(); }
      else if (tabId === 'stats') renderStats();
      else if (tabId === 'overview') renderOverview();
      else if (tabId === 'intel') renderIntel();
      else if (tabId === 'farms') renderFarms();
      else if (tabId === 'config') { bindConfig(); renderCaveTowns(); }
      return;
    }
    if (tabId === 'findings') renderFindings();
    if (tabId === 'farms') renderFarms();
    if (tabId === 'world') renderWorld();
    if (tabId === 'build') {
      const el = panel.querySelector('#gb-ab-auto');
      if (el) el.checked = !!state.abAuto;
      renderBuild();
    }
    if (tabId === 'attack') { bindAttackTab(); renderAttack(); }
    if (tabId === 'quests') renderQuests();
    if (tabId === 'config') { bindConfig(); renderCaveTowns(); }
    if (tabId === 'overview') renderOverview();
    if (tabId === 'intel') renderIntel();
    if (tabId === 'log') { renderLog(); renderJournal(); }
    if (tabId === 'stats') renderStats();
  }

  GM_addStyle(`
    #grepbot-panel{position:fixed;top:8px;right:8px;width:420px;min-width:360px;max-height:70vh;z-index:2147483647;
      background:#1f1f1f;color:#eee;font:12px/1.4 monospace;border:1px solid #555;border-radius:6px;
      box-shadow:0 4px 16px rgba(0,0,0,.5);display:flex;flex-direction:column;visibility:visible !important;opacity:1 !important;
      box-sizing:border-box;}
    #grepbot-panel header{padding:6px 10px;background:#2a2a2a;cursor:move;display:flex;justify-content:space-between;align-items:center;flex-shrink:0}
    #grepbot-panel header b{color:#f5a623;font-weight:600}
    #grepbot-panel header button{background:none;border:1px solid #555;color:#eee;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:11px}
    #grepbot-panel .gb-nav{display:flex;gap:2px;padding:4px 6px 0;background:#262626;flex-shrink:0;border-bottom:1px solid #333}
    #grepbot-panel .gb-nav button{flex:0 0 auto;padding:5px 10px;background:transparent;border:0;border-bottom:2px solid transparent;color:#888;cursor:pointer;font:11px monospace}
    #grepbot-panel .gb-nav button:hover{color:#ccc}
    #grepbot-panel .gb-nav button.on{color:#f5a623;border-bottom-color:#f5a623}
    #grepbot-panel .gb-subtabs{display:flex;gap:2px;padding:4px 6px;background:#1a1a1a;border-bottom:1px solid #444;flex-shrink:0;overflow-x:auto}
    #grepbot-panel .gb-subtabs button{flex:0 0 auto;padding:4px 10px;background:#262626;border:1px solid #333;border-radius:3px;color:#aaa;cursor:pointer;font:11px monospace;white-space:nowrap}
    #grepbot-panel .gb-subtabs button:hover{color:#eee;border-color:#555}
    #grepbot-panel .gb-subtabs button.on{background:#333;color:#fff;border-color:#f5a623}
    #grepbot-panel section{padding:8px 10px;overflow:auto;flex:1;min-height:0}
    #grepbot-panel footer{padding:6px 10px;border-top:1px solid #444;display:flex;gap:8px;align-items:center;flex-shrink:0;position:relative}
    #grepbot-panel footer .gb-status-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;flex:1;min-width:0;font-size:10px}
    #grepbot-panel footer .gb-actions{position:relative;flex-shrink:0}
    #grepbot-panel footer .gb-actions > summary{list-style:none;cursor:pointer;background:#333;border:1px solid #555;color:#eee;padding:3px 8px;border-radius:3px;font-size:11px;user-select:none}
    #grepbot-panel footer .gb-actions > summary::-webkit-details-marker{display:none}
    #grepbot-panel footer .gb-actions-menu{position:absolute;right:0;bottom:calc(100% + 4px);min-width:140px;background:#262626;border:1px solid #555;border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,.5);display:flex;flex-direction:column;padding:4px;z-index:5}
    #grepbot-panel footer .gb-actions-menu button{background:transparent;border:0;color:#eee;padding:5px 8px;text-align:left;cursor:pointer;font:11px monospace;border-radius:2px}
    #grepbot-panel footer .gb-actions-menu button:hover{background:#333;color:#f5a623}
    #grepbot-panel textarea{width:100%;height:100%;min-height:180px;background:#111;color:#cfc;border:1px solid #333;font:11px/1.4 monospace;resize:vertical}
    #grepbot-panel .gb-resize{position:absolute;z-index:2;background:transparent;user-select:none}
    #grepbot-panel .gb-resize-n{top:-2px;left:8px;right:8px;height:8px;cursor:n-resize}
    #grepbot-panel .gb-resize-s{bottom:-2px;left:8px;right:8px;height:8px;cursor:s-resize}
    #grepbot-panel .gb-resize-e{right:-2px;top:8px;bottom:8px;width:8px;cursor:e-resize}
    #grepbot-panel .gb-resize-w{left:-2px;top:8px;bottom:8px;width:8px;cursor:w-resize}
    #grepbot-panel .gb-resize-ne,#grepbot-panel .gb-resize-nw,#grepbot-panel .gb-resize-se,#grepbot-panel .gb-resize-sw{width:12px;height:12px;z-index:3}
    #grepbot-panel .gb-resize-ne{top:-2px;right:-2px;cursor:ne-resize}
    #grepbot-panel .gb-resize-nw{top:-2px;left:-2px;cursor:nw-resize}
    #grepbot-panel .gb-resize-se{right:0;bottom:0;cursor:se-resize;
      background:linear-gradient(135deg,transparent 50%,#666 50%,#666 60%,transparent 60%,transparent 70%,#666 70%,#666 80%,transparent 80%)}
    #grepbot-panel .gb-resize-sw{bottom:-2px;left:-2px;cursor:sw-resize}
    #grepbot-panel.collapsed{width:${PANEL_SQ}px !important;height:${PANEL_SQ}px !important;max-height:none !important;min-width:0;min-height:0;
      overflow:hidden;padding:0;border-radius:6px;cursor:move}
    #grepbot-panel.collapsed header{padding:0;width:100%;height:100%;justify-content:center;align-items:center;border:0}
    #grepbot-panel.collapsed header b{display:none}
    #grepbot-panel.collapsed header button{border:0;padding:0;width:100%;height:100%;font-size:0;font-weight:700;color:#f5a623;border-radius:6px}
    #grepbot-panel.collapsed header button::before{content:"GB";display:block;font-size:11px;line-height:${PANEL_SQ}px}
    #grepbot-panel.collapsed .gb-nav,#grepbot-panel.collapsed .gb-subtabs,#grepbot-panel.collapsed section,#grepbot-panel.collapsed footer,#grepbot-panel.collapsed .gb-resize{display:none !important}
    #grepbot-panel .farms-list{margin-bottom:6px;max-height:200px;overflow:auto}
    #grepbot-panel .farms-list table{width:100%;border-collapse:collapse;font-size:10px}
    #grepbot-panel .farms-list th,#grepbot-panel .farms-list td{padding:2px 4px;border-bottom:1px solid #2a2a2a;text-align:right}
    #grepbot-panel .farms-list th{background:#262626;color:#aaa;text-align:left;font-weight:normal;position:sticky;top:0}
    #grepbot-panel .farms-list td.id{text-align:left;color:#6cf;font-family:monospace}
    #grepbot-panel .farms-list td.stale{color:#888}
    #grepbot-panel .farms-list td.err{color:#f55}
    #grepbot-panel .farms-list tr.alert td{background:rgba(255,80,80,.18);color:#faa}
    #grepbot-panel .farms-list tr.alert td.id{color:#f55;font-weight:bold}
    #grepbot-panel .world-list table{width:100%;border-collapse:collapse;font-size:10px}
    #grepbot-panel .world-list th,#grepbot-panel .world-list td{padding:2px 4px;border-bottom:1px solid #2a2a2a;text-align:right}
    #grepbot-panel .world-list th{background:#262626;color:#aaa;text-align:left;font-weight:normal;position:sticky;top:0}
    #grepbot-panel .world-list td.id{text-align:left;color:#6cf;font-family:monospace}
    #grepbot-panel .finding{padding:6px;border-bottom:1px solid #2a2a2a;font-size:11px}
    #grepbot-panel .finding .meta{color:#888;margin-bottom:3px}
    #grepbot-panel .finding .units{color:#6cf}
    #grepbot-panel .finding .res{color:#f96}
    #grepbot-panel .log-list{height:100%;min-height:180px;max-height:280px;overflow:auto;font-size:10px;white-space:pre-wrap;word-break:break-word;color:#9d9;background:#111;padding:4px;border:1px solid #333}
    #grepbot-panel .gb-logsub{display:flex;gap:4px;align-items:center;margin-bottom:4px}
    #grepbot-panel .gb-logsub button{background:#262626;border:1px solid #333;color:#aaa;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px}
    #grepbot-panel .gb-logsub button.on{background:#333;color:#fff;border-color:#555}
    #grepbot-panel .gb-logsub input{flex:1;min-width:0;background:#111;color:#cfc;border:1px solid #333;font:10px monospace;padding:2px 4px}
    #grepbot-panel .jrn-head{font-size:10px;color:#888;margin-bottom:3px}
    #grepbot-panel .jrn-head b{color:#f96}
    #grepbot-panel .jrn-list{min-height:160px;max-height:250px;overflow:auto;font-size:10px;background:#111;border:1px solid #333;padding:2px}
    #grepbot-panel .jrn-list table{width:100%;border-collapse:collapse}
    #grepbot-panel .jrn-list td{padding:1px 3px;border-bottom:1px solid #2a2a2a;vertical-align:top}
    #grepbot-panel .jrn-list td.t{color:#666;white-space:nowrap}
    #grepbot-panel .jrn-list td.f{color:#6cf}
    #grepbot-panel .jrn-list td.a{color:#aaa;word-break:break-all}
    #grepbot-panel .jrn-list td.k{color:#888;text-align:right}
    #grepbot-panel .jrn-list td.r{text-align:right;white-space:nowrap}
    #grepbot-panel .jrn-list tr.ok td.r{color:#6dda7e}
    #grepbot-panel .jrn-list tr.skip td.r{color:#777}
    #grepbot-panel .jrn-list tr.err td.r{color:#f55}
    #grepbot-panel .jrn-btns{display:flex;gap:4px;margin-top:4px}
    #grepbot-panel .jrn-btns button{background:#333;border:1px solid #555;color:#eee;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px}
    #grepbot-panel .ib-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#555;transition:background .4s}
    #grepbot-panel .ib-dot.free{background:#4caf50}
    #grepbot-panel .ib-dot.paid{background:#f0c060}
    #grepbot-panel .ib-rows{max-height:240px;overflow:auto;font-size:10px}
    #grepbot-panel .ib-town{color:#888;font-size:9px;margin-top:4px;margin-bottom:1px}
    #grepbot-panel .ib-row{display:flex;justify-content:space-between;gap:12px;padding:2px 0;border-bottom:1px solid #2a2a2a}
    #grepbot-panel .ib-type{color:#aaa;flex:1}
    #grepbot-panel .ib-time{color:#888}
    #grepbot-panel .ib-cost{color:#f0c060;min-width:36px;text-align:right}
    #grepbot-panel .ib-free{color:#6dda7e;font-weight:bold;min-width:36px;text-align:right}
    #grepbot-panel #gb-ib-btn{background:#333;border:1px solid #555;color:#80e090;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:11px}
    #grepbot-panel #gb-ib-btn:disabled{opacity:.4;cursor:default}
    #grepbot-panel .ab-queue{max-height:220px;overflow:auto;margin-top:2px}
    #grepbot-panel .ab-plan{max-height:120px;overflow:auto;margin:2px 0 6px}
    #grepbot-panel .ab-plan-row{display:grid;grid-template-columns:1.2fr .4fr .8fr .6fr auto;gap:4px;align-items:center;padding:2px 0;border-bottom:1px solid #2a2a2a;font-size:10px}
    #grepbot-panel .ab-plan-row.pinned{background:#1a1a10}
    #grepbot-panel .ab-plan-row.custom{background:#101a1a}
    #grepbot-panel .cq-rows{max-height:140px;overflow:auto}
    #grepbot-panel .cq-row{display:grid;grid-template-columns:24px 1.2fr .5fr .6fr auto;gap:4px;align-items:center;padding:1px 0;border-bottom:1px solid #2a2a2a;font-size:10px}
    #grepbot-panel .atk-sched{max-height:160px;overflow:auto;margin-top:6px}
    #grepbot-panel .atk-sources{max-height:80px;overflow:auto;display:flex;flex-wrap:wrap;gap:4px 8px;margin:4px 0}
    #grepbot-panel .atk-roles{max-height:110px;overflow:auto;margin:4px 0}
    #grepbot-panel [data-atk="arrival-date"]{min-width:118px}
    #grepbot-panel [data-atk="arrival-time"]{min-width:96px}
    #grepbot-panel .atk-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:4px}
    #grepbot-panel .atk-row input,#grepbot-panel .atk-row select{background:#111;color:#cfc;border:1px solid #333;padding:2px 4px;font:11px monospace}
    #grepbot-panel .atk-btns button{background:#333;border:1px solid #555;color:#eee;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:11px;margin-right:4px}
    #grepbot-panel .atk-btns #gb-atk-now{color:#f96}
    #grepbot-panel .atk-btns #gb-atk-arm{color:#6cf}
    #grepbot-panel .quest-list{max-height:200px;overflow:auto;font-size:10px}
    #grepbot-panel .quest-row{display:grid;grid-template-columns:1.4fr .5fr 1fr .6fr;gap:4px;border-bottom:1px solid #2a2a2a;padding:3px 0}
    #grepbot-panel .quest-hist{max-height:100px;overflow:auto;font-size:9px;color:#9d9;margin-top:6px;background:#111;padding:4px;border:1px solid #333;white-space:pre-wrap}
  `);

  panel = document.createElement('div');
  panel.id = 'grepbot-panel';

  document.querySelectorAll('#grepbot-panel').forEach(p => { try { p.remove(); } catch (_) {} });
  panel.style.zIndex = '2147483647';
  panel.innerHTML = `
    <header><b>GrepBot v${runningVersion()}</b><button data-act="toggle" title="Minimize">_</button></header>
    <div class="gb-nav" role="tablist" aria-label="GrepBot groups"></div>
    <div class="gb-subtabs" role="tablist" aria-label="GrepBot tabs"></div>
    <section data-tab="findings"></section>
    <section data-tab="farms" hidden>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
        <button id="gb-sleep-claim" style="background:#333;border:1px solid #555;color:#8cf;padding:2px 8px;cursor:pointer;font-size:11px">Sleep claim (4h/8h)</button>
        <span id="gb-sleep-status" style="font-size:10px;color:#888"></span>
      </div>
      <div id="gb-farm-teach-banner" hidden style="font-size:10px;color:#fc6;background:#2a2211;border:1px solid #664;padding:4px 6px;margin-bottom:4px;border-radius:3px"></div>
      <div class="farms-list"></div>
      <textarea placeholder="vill_id | x y | ETA | notes&#10;12345 | 500 600 | 2h | safe"></textarea>
    </section>
    <section data-tab="world" hidden>
      <div class="world-totals" style="padding:6px;background:#262626;border-radius:3px;margin-bottom:6px;font-size:11px"></div>
      <div class="world-list"></div>
    </section>
    <section data-tab="attack" hidden>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <b style="font-size:11px;color:#f5a623">Attack sync</b>
        <span id="gb-atk-skew" style="font-size:9px;color:#888"></span>
        <span id="gb-atk-armed" style="font-size:10px;color:#f96;font-weight:bold;margin-left:auto"></span>
      </div>
      <div class="atk-row">
        <label>target <input data-atk="target" style="width:70px" placeholder="id"/></label>
        <select data-atk="pick" title="towns from spy reports / recent attacks" style="max-width:130px;background:#111;color:#cfc;border:1px solid #333;font-size:10px"></select>
        <button type="button" id="gb-atk-current" title="Use city selected in game (map / attack window)" style="background:#333;border:1px solid #555;color:#6cf;padding:1px 6px;cursor:pointer;font-size:10px">Current</button>
        <label>x <input data-atk="x" style="width:40px"/></label>
        <label>y <input data-atk="y" style="width:40px"/></label>
        <select data-atk="mission"><option>attack</option><option>support</option><option>raid</option><option>siege</option><option>scout</option><option>revolt</option><option value="portal">olympus portal</option></select>
      </div>
      <div id="gb-atk-target-hint" style="font-size:9px;color:#888;margin:-2px 0 4px"></div>
      <div class="atk-row atk-arrival-row">
        <select data-atk="timing"><option value="send_now">send now</option><option value="arrive_at">arrive at</option></select>
        <label>date <input data-atk="arrival-date" type="date" title="arrival date (local)"/></label>
        <label>time <input data-atk="arrival-time" type="time" step="1" title="arrival time (local, seconds)"/></label>
        <label>pad ms <input data-atk="pad" type="number" style="width:50px" value="200"/></label>
      </div>
      <div class="atk-row">
        <select data-atk="troop">
          <option value="offense">offense</option>
          <option value="defense">defense</option>
          <option value="all">all troops</option>
          <option value="all_of_type">all of type</option>
          <option value="harass">harass</option>
          <option value="per_town">per town edit</option>
        </select>
        <label style="display:flex;align-items:center;gap:3px">unit
          <select data-atk="unit-type" title="only used when troop mode is 'all of type'"></select>
        </label>
      </div>
      <div class="atk-harass" style="display:flex;gap:4px;flex-wrap:wrap;margin:4px 0">
        <span style="font-size:9px;color:#888;align-self:center">harass</span>
        <button type="button" data-harass="1sling" style="background:#333;border:1px solid #555;color:#eee;padding:1px 6px;cursor:pointer;font-size:10px">1 sling</button>
        <button type="button" data-harass="5sling" style="background:#333;border:1px solid #555;color:#eee;padding:1px 6px;cursor:pointer;font-size:10px">5 sling</button>
        <button type="button" data-harass="light" style="background:#333;border:1px solid #555;color:#eee;padding:1px 6px;cursor:pointer;font-size:10px">light (<=8)</button>
      </div>
      <div style="font-size:9px;color:#888;margin-top:2px">offensive / defensive cities (saved per world)</div>
      <div class="atk-roles"></div>
      <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-top:4px">
        <span style="font-size:9px;color:#888">attack from</span>
        <button type="button" id="gb-atk-src-all" style="background:#333;border:1px solid #555;color:#eee;padding:1px 6px;cursor:pointer;font-size:10px">All</button>
        <button type="button" id="gb-atk-src-none" style="background:#333;border:1px solid #555;color:#888;padding:1px 6px;cursor:pointer;font-size:10px">None</button>
        <button type="button" id="gb-atk-src-off" style="background:#333;border:1px solid #555;color:#f96;padding:1px 6px;cursor:pointer;font-size:10px">Offense</button>
        <button type="button" id="gb-atk-src-def" style="background:#333;border:1px solid #555;color:#6cf;padding:1px 6px;cursor:pointer;font-size:10px">Defense</button>
      </div>
      <div class="atk-sources"></div>
      <div class="atk-pertown" hidden></div>
      <div class="atk-btns" style="margin-top:6px">
        <button id="gb-atk-preview">Preview</button>
        <button id="gb-atk-arm">Arm</button>
        <button id="gb-atk-cancel">Cancel</button>
        <button id="gb-atk-now">Send now</button>
      </div>
      <div class="atk-sched"></div>
      <div style="border-top:1px solid #333;margin:8px 0 4px;padding-top:6px;display:flex;align-items:center;gap:6px">
        <b style="font-size:11px;color:#f5a623">Outgoing (cancel)</b>
        <button type="button" id="gb-atk-cmds-refresh" style="background:#333;border:1px solid #555;color:#eee;padding:1px 6px;cursor:pointer;font-size:10px;margin-left:auto">Refresh</button>
      </div>
      <div class="atk-cmds" style="max-height:120px;overflow:auto"></div>
      <div style="border-top:1px solid #333;margin:8px 0 4px;padding-top:6px;display:flex;align-items:center;gap:6px">
        <b style="font-size:11px;color:#f5a623">Heroes</b>
        <button type="button" id="gb-atk-heroes-refresh" style="background:#333;border:1px solid #555;color:#eee;padding:1px 6px;cursor:pointer;font-size:10px;margin-left:auto">Refresh</button>
      </div>
      <div class="atk-heroes" style="max-height:160px;overflow:auto"></div>
    </section>
    <section data-tab="quests" hidden>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <b style="font-size:11px;color:#f5a623">Quests</b>
        <button id="gb-quest-scan" style="background:#333;border:1px solid #555;color:#eee;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:11px;margin-left:auto">Scan now</button>
      </div>
      <div class="quest-list"></div>
      <div style="font-size:9px;color:#888;margin-top:6px">history</div>
      <div class="quest-hist"></div>
    </section>
    <section data-tab="build" hidden>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span id="gb-ib-dot" class="ib-dot"></span><b style="font-size:11px;color:#f5a623">Instant build</b>
        <span style="flex:1"></span>
        <button id="gb-ib-btn">Complete all free</button>
      </div>
      <div class="ib-rows"></div>
      <div id="gb-ib-status" style="font-size:10px;color:#888;margin-top:4px"></div>
      <div style="border-top:1px solid #333;margin:8px 0 6px;padding-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <b style="font-size:11px;color:#f5a623">Auto-queue</b>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:10px"><input type="checkbox" id="gb-ab-auto"/> ON</label>
        <button id="gb-ab-csfast" style="background:#333;border:1px solid #555;color:#6cf;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px">Load CS-fast</button>
        <button id="gb-ab-now" style="background:#333;border:1px solid #555;color:#80e090;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px">Queue now</button>
      </div>
      <div style="font-size:9px;color:#888;margin-bottom:4px">Auto only fills when <=1 order left: adds up to 6 (or queue max). Next fill waits half(build time)+5min+rand - not right when a build finishes. Targets = cur/tgt/max.</div>
      <div style="font-size:10px;color:#f5a623;margin:4px 0 2px">Next 3 <span style="color:#666;font-weight:normal">(custom queue first, then heuristic)</span></div>
      <div class="ab-plan"></div>
      <div style="border-top:1px solid #333;margin:8px 0 4px;padding-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <b style="font-size:11px;color:#f5a623">Custom queue</b>
        <span id="gb-cq-town" style="font-size:10px;color:#888"></span>
        <span style="flex:1"></span>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:10px" title="Strict: wait for the head entry instead of building past it"><input type="checkbox" id="gb-cq-strict"/> strict</label>
        <button id="gb-cq-copy" style="background:#333;border:1px solid #555;color:#6cf;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px">Copy to all</button>
        <button id="gb-cq-clear" style="background:#333;border:1px solid #555;color:#f08080;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px">Clear</button>
      </div>
      <div class="cq-rows"></div>
      <div style="display:flex;align-items:center;gap:4px;margin:4px 0">
        <select id="gb-cq-b" style="background:#111;color:#cfc;border:1px solid #333;font:10px monospace"></select>
        <input id="gb-cq-lvl" type="number" min="1" style="width:48px;background:#111;color:#cfc;border:1px solid #333;font:10px monospace"/>
        <button id="gb-cq-add" style="background:#333;border:1px solid #555;color:#80e090;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px">Add</button>
        <span style="font-size:9px;color:#888">ordered - built top-down, then heuristic</span>
      </div>
      <div class="ab-queue"></div>
      <div id="gb-ab-status" style="font-size:10px;color:#888;margin-top:4px"></div>
    </section>
    <section data-tab="overview" hidden>
      <div style="font-size:11px;color:#f5a623;margin-bottom:4px">Account overview</div>
      <pre class="overview-panel" style="font-size:10px;white-space:pre-wrap;background:#111;padding:6px;border:1px solid #333;max-height:280px;overflow:auto;color:#cfc"></pre>
      <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
        <input id="gb-tpl-name" placeholder="template name" style="width:100px;background:#111;color:#cfc;border:1px solid #333;font-size:11px"/>
        <button id="gb-tpl-save" style="background:#333;border:1px solid #555;color:#eee;padding:2px 6px;cursor:pointer;font-size:10px">Save template</button>
        <button id="gb-tpl-apply" style="background:#333;border:1px solid #555;color:#6cf;padding:2px 6px;cursor:pointer;font-size:10px">Apply template</button>
        <button id="gb-cfg-export" style="background:#333;border:1px solid #555;color:#9d9;padding:2px 6px;cursor:pointer;font-size:10px">Export config</button>
        <button id="gb-cfg-import" style="background:#333;border:1px solid #555;color:#fc6;padding:2px 6px;cursor:pointer;font-size:10px">Import config</button>
      </div>
    </section>
    <section data-tab="intel" hidden>
      <div style="font-size:11px;color:#f5a623;margin-bottom:4px">Intel / threats</div>
      <pre class="intel-panel" style="font-size:10px;white-space:pre-wrap;background:#111;padding:6px;border:1px solid #333;max-height:280px;overflow:auto;color:#cfc"></pre>
      <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <input id="gb-note-player" placeholder="player" style="width:80px;background:#111;color:#cfc;border:1px solid #333;font-size:11px"/>
        <input id="gb-note-text" placeholder="note" maxlength="200" style="flex:1;background:#111;color:#cfc;border:1px solid #333;font-size:11px"/>
        <button id="gb-note-save" style="background:#333;border:1px solid #555;color:#eee;padding:2px 6px;cursor:pointer;font-size:10px">Save note</button>
      </div>
      <div style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <input id="gb-ally-name" placeholder="alliance" style="width:80px;background:#111;color:#cfc;border:1px solid #333;font-size:11px"/>
        <input id="gb-ally-note" placeholder="alliance note" maxlength="200" style="flex:1;background:#111;color:#cfc;border:1px solid #333;font-size:11px"/>
        <button id="gb-ally-save" style="background:#333;border:1px solid #555;color:#eee;padding:2px 6px;cursor:pointer;font-size:10px">Save ally note</button>
      </div>
    </section>
    <section data-tab="config" hidden>
      <div class="config-panel" style="font-size:11px;display:flex;flex-direction:column;gap:8px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="enabled-host"/> Enable on <span class="cfg-host"></span></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-collect"/> Auto-collect Recoger (DOM)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="collect-all"/> Recolect all (ignore timer cap)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-bandit"/> Auto-bandit</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-farm"/> Auto-farm</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px"><input type="checkbox" data-cfg="farm-skip-full"/> Skip farm/bandit if warehouse full</label>
        <label style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-wrap:wrap">Warehouse full mode
          <select data-cfg="farm-full-mode" style="background:#111;color:#cfc;border:1px solid #333;margin-left:6px">
            <option value="any">any 1 resource full</option>
            <option value="all">all 3 resources full</option>
          </select>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px"><input type="checkbox" data-cfg="farm-long-claims"/> 10min claims where villager loyalty researched</label>
        <label style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-wrap:wrap">Loyalty tech key
          <input data-cfg="farm-loyalty-tech" placeholder="auto-detect (server id or label)" title="Server research id (e.g. rural_loyalty) or the localized academy name. Log tab dumps id(label) pairs when auto-detect misses." style="width:190px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/>
        </label>
        <label style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-wrap:wrap">Sleep claim length
          <select data-cfg="farm-sleep-dur" style="background:#111;color:#cfc;border:1px solid #333;margin-left:6px">
            <option value="auto">auto (8h if known, else 4h)</option>
            <option value="14400">4 h</option>
            <option value="28800">8 h</option>
          </select>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px"><input type="checkbox" data-cfg="farm-sleep-auto"/> Auto sleep claim (once/day, must end before 24:00)</label>
        <label style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-wrap:wrap">Sleep claim max warehouse fill %
          <input type="number" data-cfg="farm-sleep-fill" min="10" max="95" style="width:60px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/>
        </label>
        <div id="gb-farm-optmap" style="margin-left:12px;font-size:10px;color:#888"></div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-build"/> Instant free builds</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="instant-research"/> Instant free research (academy)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-queue"/> Auto-queue builds</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-quest-build"/> Auto-claim quest build discount</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-quest-res"/> Auto-claim quest resources/favor</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-cave"/> Auto-cave (stash excess iron)</label>
        <label style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-wrap:wrap">Cave when iron >= % of warehouse
          <input type="number" data-cfg="cave-thresh" min="50" max="99" style="width:50px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/>
        </label>
        <div style="margin-left:12px;font-size:10px;color:#888">Per-town (unchecked = skip that town):</div>
        <div class="cave-towns" style="display:flex;flex-direction:column;gap:2px;max-height:120px;overflow:auto"></div>
        <div style="border-top:1px solid #333;padding-top:6px;color:#f5a623;font-size:10px">Phase 8+ economy</div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-culture"/> Auto-culture</label>
        <label style="margin-left:12px;display:flex;gap:8px;flex-wrap:wrap;font-size:10px">
          <label><input type="checkbox" data-cfg="cult-festival"/> festival</label>
          <label><input type="checkbox" data-cfg="cult-procession"/> procession</label>
          <label><input type="checkbox" data-cfg="cult-theater"/> theater</label>
          <label><input type="checkbox" data-cfg="cult-olympic"/> olympic</label>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px;color:#f96"><input type="checkbox" data-cfg="allow-premium-culture"/> Allow premium culture (olympic = 50 gold)</label>
        <label style="margin-left:12px;flex-wrap:wrap;font-size:10px">Olympic daily gold budget
          <input type="number" data-cfg="culture-gold-budget" min="0" max="500" step="50" style="width:60px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-trade"/> Inter-city trade (Fill Storage)</label>
        <label style="margin-left:12px;flex-wrap:wrap">Preset
          <select data-cfg="trade-preset" style="background:#111;color:#cfc;border:1px solid #333;margin-left:4px">
            <option value="storage">storage</option>
            <option value="party">party (fund culture)</option>
            <option value="unit">unit (fund recruit)</option>
          </select>
          Reserve % <input type="number" data-cfg="trade-reserve" min="0" max="80" style="width:45px;background:#111;color:#cfc;border:1px solid #333"/>
          Min batch <input type="number" data-cfg="trade-min" min="100" max="50000" step="100" style="width:60px;background:#111;color:#cfc;border:1px solid #333"/>
          Max island hops <input type="number" data-cfg="trade-max-hops" min="0" max="200" step="1" title="Refuse fill-storage across islands farther than this (0 = same-island only). Unreadable island never blocks." style="width:45px;background:#111;color:#cfc;border:1px solid #333"/>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="island-ship"/> Mainland->island res ship</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-rural-trade"/> Rural village trade</label>
        <label style="margin-left:12px;flex-wrap:wrap">Min ratio <input type="number" data-cfg="rural-ratio" step="0.25" min="0.25" max="2" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/>
          Res <select data-cfg="rural-res" style="background:#111;color:#cfc;border:1px solid #333"><option>iron</option><option>stone</option><option>wood</option></select>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-rural-level"/> Farm village upgrade</label>
        <label style="margin-left:12px">Max level <input type="number" data-cfg="rural-level-max" min="1" max="6" style="width:40px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-research"/> Auto-research</label>
        <button data-cfg="research-csfast" style="align-self:flex-start;margin-left:12px;background:#333;border:1px solid #555;color:#6cf;padding:2px 6px;cursor:pointer;font-size:10px">Load CS-fast research</button>
        <div style="border-top:1px solid #333;padding-top:6px;color:#f5a623;font-size:10px">QoL / survival</div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="pause-activity"/> Pause when I am active</label>
        <label style="margin-left:12px">Pause min <input type="number" data-cfg="pause-ms" min="1" max="60" style="width:40px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="night-pause"/> Night pause</label>
        <label style="margin-left:12px">Hours <input type="number" data-cfg="night-start" min="0" max="23" style="width:40px;background:#111;color:#cfc;border:1px solid #333"/>-<input type="number" data-cfg="night-end" min="0" max="23" style="width:40px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Log every payload the bot would send and send nothing. Use it to compare bot payloads against a hand-clicked action before enabling a risky feature."><input type="checkbox" data-cfg="dry-run"/> <b style="color:#6cf">Dry run (log payloads, send nothing)</b></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="A feature that keeps finding nothing to do doubles its own interval (up to 8x) until it acts again."><input type="checkbox" data-cfg="orch-adaptive"/> Adaptive cadence (back off idle features)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="When a warehouse is pinned full, promote cave→trade→rural ahead of farm and suppress idle backoff on the drain path."><input type="checkbox" data-cfg="orch-deadlock"/> Warehouse deadlock resolve</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Copy/Export replace player names and ids with short hashes. Turn OFF only for local debugging."><input type="checkbox" data-cfg="export-redact"/> Redact names/ids in Copy + Export</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="captcha-global"/> Global captcha kill-switch</label>
        <label>Captcha backoff (min) <input type="text" data-cfg="captcha-ladder" placeholder="5,15,60" title="Comma-separated minutes; min 1 each. Floor prevents disabling the breaker." style="width:100px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/></label>
        <button type="button" data-cfg="captcha-clear" style="align-self:flex-start;background:#333;border:1px solid #555;color:#fc6;padding:2px 6px;cursor:pointer;font-size:10px">Clear captcha pauses</button>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Skip an action that failed the same way 3x in a row (5/15/60min backoff). Journal keeps recording either way."><input type="checkbox" data-cfg="decision-memory"/> Decision memory (skip repeat failures)</label>
        <label>Req budget / min <input type="number" data-cfg="req-budget" min="5" max="120" style="width:50px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/>
          Soft % <input type="number" data-cfg="posts-soft" min="20" max="95" title="Delay (not reject) when trailing-minute posts exceed this % of the hard budget" style="width:45px;background:#111;color:#cfc;border:1px solid #333;margin-left:4px"/></label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:10px">
          Presets
          <button type="button" data-preset="afk" style="background:#333;border:1px solid #555;color:#8cf;padding:2px 6px;cursor:pointer">AFK overnight</button>
          <button type="button" data-preset="farm" style="background:#333;border:1px solid #555;color:#8cf;padding:2px 6px;cursor:pointer">Active farming</button>
          <button type="button" data-preset="war" style="background:#333;border:1px solid #555;color:#fc6;padding:2px 6px;cursor:pointer">War</button>
          <button type="button" data-preset="undo" style="background:#333;border:1px solid #555;color:#aaa;padding:2px 6px;cursor:pointer">Undo preset</button>
        </div>
        <button type="button" data-cfg="storage-prune" style="align-self:flex-start;background:#333;border:1px solid #555;color:#fc6;padding:2px 6px;cursor:pointer;font-size:10px">Prune seen/alerted (storage)</button>
        <label>Webhook URL <input type="text" data-cfg="webhook-url" placeholder="Discord webhook or https://api.telegram.org/bot.../sendMessage" style="width:100%;background:#111;color:#cfc;border:1px solid #333;margin-top:2px;font-size:10px"/></label>
        <label style="margin-left:0;display:flex;gap:8px;flex-wrap:wrap;font-size:10px">Events
          <label><input type="checkbox" data-cfg="wh-captcha"/> captcha</label>
          <label><input type="checkbox" data-cfg="wh-attack"/> attack</label>
          <label><input type="checkbox" data-cfg="wh-pattern"/> pattern (3×/24h)</label>
          <label><input type="checkbox" data-cfg="wh-warehouse"/> warehouse</label>
          <label><input type="checkbox" data-cfg="wh-culture"/> culture</label>
        </label>
        <label>Telegram chat_id <input type="text" data-cfg="wh-tg-chat" placeholder="optional if not in URL" style="width:140px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px;font-size:10px"/></label>
        <div style="border-top:1px solid #333;padding-top:6px;color:#f96;font-size:10px">HIGH RISK (default OFF)</div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-merchant"/> Merchant sniper</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Merchant ship resource offers open at 0.5:1 and gain +0.1 per trade. Pump with 1-unit trades, then send the bulk trade at 1:1."><input type="checkbox" data-cfg="auto-pt-trade"/> Merchant ship ratio pump</label>
        <label style="margin-left:12px;font-size:10px">target ratio <input type="number" step="0.1" min="0.5" max="2" data-cfg="pt-ratio" style="width:52px;background:#111;color:#cfc;border:1px solid #333"/>
          pump amt <input type="number" min="1" max="100" data-cfg="pt-pump" style="width:52px;background:#111;color:#cfc;border:1px solid #333"/>
          max pumps <input type="number" min="0" max="20" data-cfg="pt-maxpumps" style="width:52px;background:#111;color:#cfc;border:1px solid #333"/>
          reserve % <input type="number" min="0" max="90" data-cfg="pt-reserve" style="width:52px;background:#111;color:#cfc;border:1px solid #333"/>
        </label>
        <label style="margin-left:12px;display:flex;gap:8px;flex-wrap:wrap;font-size:10px">receive
          <label><input type="checkbox" data-cfg="pt-want-wood"/> wood</label>
          <label><input type="checkbox" data-cfg="pt-want-stone"/> stone</label>
          <label><input type="checkbox" data-cfg="pt-want-iron"/> silver</label>
        </label>
        <div style="margin-left:12px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span id="gb-pt-status" style="font-size:10px;color:#888"></span>
          <button data-cfg="pt-now" style="background:#333;border:1px solid #555;color:#80e090;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px">Pump + trade now</button>
          <button data-cfg="pt-copy" title="Copy the open merchant window markup - needed once to confirm the offer parser" style="background:#333;border:1px solid #555;color:#6cf;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px">Copy offer HTML</button>
        </div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-favor"/> Favor farm (godsent)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-wonder"/> WW donations</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Spend favor on alliance wonder. Requires sniffed wonderFavorTpl. Default OFF."><input type="checkbox" data-cfg="auto-wonder-favor"/> WW favor cast (sniff power first)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="cs-alert"/> CS / incoming alerts</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-militia"/> Auto-militia on incoming</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-dodge"/> Auto-dodge</label>
        <label style="margin-left:12px">Mode <select data-cfg="dodge-mode" style="background:#111;color:#cfc;border:1px solid #333"><option value="notify">notify only</option><option value="auto">auto send</option></select>
          Floor <input type="number" data-cfg="dodge-floor" min="0" max="500" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-recruit"/> Auto-recruit</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px"><input type="checkbox" data-cfg="recruit-spells"/> Cast recruit spells first</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="grepodata"/> Grepodata Index+ assist</label>
        <label>IB free threshold (sec) <input type="number" data-cfg="ib-free-thresh" min="60" max="600" style="width:70px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/></label>
        <label>Collect max min <input type="number" data-cfg="collect-max-min" min="1" max="120" style="width:70px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/></label>
        <label>Farm cadence min-max (min) <input type="number" data-cfg="farm-min" min="1" max="60" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/> - <input type="number" data-cfg="farm-max" min="1" max="60" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label>Town cadence min-max (min) <input type="number" data-cfg="town-min" min="1" max="60" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/> - <input type="number" data-cfg="town-max" min="1" max="60" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <button data-cfg="clear-captcha" style="align-self:flex-start;background:#333;border:1px solid #555;color:#f96;padding:3px 8px;cursor:pointer;font-size:11px">Clear captcha breakers</button>
      </div>
    </section>
    <section data-tab="stats" hidden>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
        <b style="font-size:11px;color:#f5a623">Stats</b>
        <button data-stats="1h" style="background:#262626;border:1px solid #333;color:#aaa;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">1h</button>
        <button data-stats="24h" class="on" style="background:#333;border:1px solid #555;color:#fff;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">24h</button>
        <button data-stats="7d" style="background:#262626;border:1px solid #333;color:#aaa;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">7d</button>
        <span style="flex:1"></span>
        <button id="gb-preflight" title="Read-only probe of every module: collections, learned action keys, would-be payloads. Sends nothing." style="background:#333;border:1px solid #555;color:#6cf;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">Preflight</button>
      </div>
      <pre class="stats-body" style="font-size:10px;white-space:pre-wrap;background:#111;padding:6px;border:1px solid #333;max-height:320px;overflow:auto;color:#cfc"></pre>
    </section>
    <section data-tab="log" hidden>
      <div class="gb-logsub">
        <button data-logsub="live" class="on">Live log</button>
        <button data-logsub="mem">Decisions</button>
        <button type="button" data-act="evidence" title="Read-only redacted snapshot for TASKS gates. Copies JSON. Posts nothing.">Evidence</button>
        <input class="jrn-filter" placeholder="filter feature/action/target"/>
      </div>
      <div class="log-list"></div>
      <div class="jrn-pane" hidden>
        <div class="jrn-head"></div>
        <div class="jrn-list"></div>
        <div class="jrn-btns">
          <button data-jrn="copy">Copy JSON</button>
          <button data-jrn="clear-skips">Clear skips</button>
          <button data-jrn="clear">Clear journal</button>
        </div>
      </div>
    </section>
    <footer>
      <div class="gb-status-row">
        <span id="gb-next-farms" style="color:#6cf"></span>
        <span id="gb-next-towns" style="color:#fc6"></span>
        <span id="gb-last-action" style="color:#8c8"></span>
        <span id="gb-collect-state" style="color:#f96;font-weight:bold"></span>
        <span id="gb-status" style="color:#888"></span>
      </div>
      <details class="gb-actions">
        <summary>Actions</summary>
        <div class="gb-actions-menu">
          <button type="button" data-act="copy">Copy JSON</button>
          <button type="button" data-act="export">Export</button>
          <button type="button" data-act="refresh">Refresh towns</button>
          <button type="button" data-act="scrape-farms">Farms now</button>
          <button type="button" data-act="scrape-towns">Towns now</button>
          <button type="button" data-act="diag">Diag</button>
          <button type="button" data-act="evidence" title="Read-only redacted snapshot for TASKS gates">Evidence</button>
          <button type="button" data-act="preflight">Preflight</button>
          <button type="button" data-act="clear">Clear findings</button>
          <button type="button" data-act="reset-pos" title="Reset panel position">Reset position</button>
        </div>
      </details>
    </footer>
  `;
  document.body.appendChild(panel);
  ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach(dir => {
    const h = document.createElement('div');
    h.className = 'gb-resize gb-resize-' + dir;
    h.dataset.dir = dir;
    h.title = 'Resize';
    panel.appendChild(h);
  });
  applyPanelGeom(state.panelGeom);

  {
    const start = TAB_IDS.includes(state.activeTab) ? state.activeTab : 'findings';
    const g0 = tabGroupOf(start);
    _lastTabInGroup[g0.id] = start;
    paintNav(start);
    panel.querySelectorAll('section[data-tab]').forEach(s => {
      s.hidden = s.dataset.tab !== start;
    });
  }

  panel.querySelector('.gb-actions')?.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('button[data-act]');
    if (!btn) return;
    const det = panel.querySelector('.gb-actions');
    if (det) det.open = false;
  });

  panel.querySelectorAll('.gb-logsub button').forEach(btn => {
    btn.addEventListener('click', () => {
      const mem = btn.dataset.logsub === 'mem';
      panel.querySelectorAll('.gb-logsub button').forEach(b => b.classList.toggle('on', b === btn));
      const live = panel.querySelector('.log-list');
      const pane = panel.querySelector('.jrn-pane');
      if (live) live.hidden = mem;
      if (pane) pane.hidden = !mem;
      if (mem) renderJournal(); else renderLog();
    });
  });
  panel.querySelectorAll('[data-stats]').forEach(btn => {
    btn.addEventListener('click', () => {
      statsWindow = btn.dataset.stats;
      panel.querySelectorAll('[data-stats]').forEach(b => {
        const on = b === btn;
        b.classList.toggle('on', on);
        b.style.background = on ? '#333' : '#262626';
        b.style.color = on ? '#fff' : '#aaa';
        b.style.borderColor = on ? '#555' : '#333';
      });
      renderStats();
    });
  });
  panel.querySelector('#gb-preflight')?.addEventListener('click', () => preflightRunAndRender());
  panel.querySelector('.jrn-filter')?.addEventListener('input', () => journalFilterDebounced());
  panel.querySelector('[data-jrn=copy]')?.addEventListener('click', () => {
    const text = JSON.stringify({ decisions: state.decisions, skips: state.decisionSkips }, null, 2);
    navigator.clipboard.writeText(text).then(() => flash('journal copied')).catch(() => flash('copy failed'));
  });
  panel.querySelector('[data-jrn=clear-skips]')?.addEventListener('click', () => {
    jrnClearSkips();
    renderJournal();
  });
  panel.querySelector('[data-jrn=clear]')?.addEventListener('click', () => {
    if (!confirm('Clear the decision journal for ' + location.host + '?')) return;
    jrnClear();
    renderJournal();
  });

  panel.querySelector('#gb-tpl-save')?.addEventListener('click', () => {
    const n = panel.querySelector('#gb-tpl-name')?.value?.trim();
    if (n) qolSaveTemplate(n);
  });
  panel.querySelector('#gb-tpl-apply')?.addEventListener('click', () => {
    const n = panel.querySelector('#gb-tpl-name')?.value?.trim();
    if (n) qolApplyTemplate(n);
  });
  panel.querySelector('#gb-cfg-export')?.addEventListener('click', () => {
    const text = JSON.stringify(qolExportConfig(), null, 2);
    navigator.clipboard.writeText(text).then(() => flash('config copied')).catch(() => flash('copy failed'));
  });
  panel.querySelector('#gb-cfg-import')?.addEventListener('click', () => {
    const raw = prompt('Paste GrepBot config JSON');
    if (!raw) return;
    try {
      if (qolImportConfig(JSON.parse(raw))) flash('config imported');
      else flash('import failed');
    } catch (e) { flash('bad JSON'); }
  });
  panel.querySelector('#gb-note-save')?.addEventListener('click', () => {
    const p = panel.querySelector('#gb-note-player')?.value?.trim();
    const n = panel.querySelector('#gb-note-text')?.value?.trim();
    if (p) { intelSetNote(p, n); renderIntel(); flash('note saved'); }
  });
  panel.querySelector('#gb-ally-save')?.addEventListener('click', () => {
    const a = panel.querySelector('#gb-ally-name')?.value?.trim();
    const n = panel.querySelector('#gb-ally-note')?.value?.trim();
    if (a) { intelSetAllianceNote(a, n); renderIntel(); flash('alliance note saved'); }
  });
  panel.querySelector('#gb-quest-scan')?.addEventListener('click', () => {
    questScanTick('manual');
    gbTimeout(renderQuests, 600);
  });
  panel.querySelector('footer button[data-act=refresh]').addEventListener('click', () => {
    fetchOwnedTowns();
    state.towns.forEach((t, i) => gbTimeout(() => fetchTownResources(t), i * 600));
  });
  panel.querySelector('header button[data-act=toggle]').addEventListener('click', (e) => {
    e.stopPropagation();
    const collapsing = !panel.classList.contains('collapsed');
    if (collapsing) {

      const w = panel.style.width || (panel.offsetWidth + 'px');
      const h = panel.style.height || (panel.offsetHeight + 'px');
      if (!state.panelGeom) state.panelGeom = {};
      state.panelGeom.width = w;
      state.panelGeom.height = h;
      panel.classList.add('collapsed');
    } else {
      panel.classList.remove('collapsed');
      if (state.panelGeom && state.panelGeom.width) panel.style.width = state.panelGeom.width;
      if (state.panelGeom && state.panelGeom.height) {
        panel.style.height = state.panelGeom.height;
        panel.style.maxHeight = 'none';
      }
    }
    const btn = panel.querySelector('header button[data-act=toggle]');
    btn.textContent = panel.classList.contains('collapsed') ? '[]' : '_';
    btn.title = panel.classList.contains('collapsed') ? 'Restore' : 'Minimize';
    savePanelGeom();
  });
  panel.querySelector('#gb-ib-btn').addEventListener('click', () => {
    if (gbLocked('ib')) return;
    ibCompleteAll(ibOrders());
  });
  panel.querySelector('#gb-ab-auto')?.addEventListener('change', e => {
    state.abAuto = e.target.checked; save(STORE.AB_AUTO, state.abAuto);
    gbLog('auto-queue', state.abAuto ? 'ON' : 'OFF');
    const cfg = panel.querySelector('[data-cfg=auto-queue]'); if (cfg) cfg.checked = state.abAuto;
    if (state.abAuto) abScan('toggle');
    renderAbQueue();
  });
  panel.querySelector('#gb-ab-csfast')?.addEventListener('click', () => { abLoadCsFast(); flash('CS-fast targets'); });
  panel.querySelector('#gb-cq-b')?.addEventListener('change', () => renderCqRows());
  panel.querySelector('#gb-cq-strict')?.addEventListener('change', e => {
    state.abQueueStrict = e.target.checked;
    save(STORE.AB_QUEUE_STRICT, state.abQueueStrict);
    gbLog('auto-queue: strict order', state.abQueueStrict ? 'ON' : 'OFF');
  });
  panel.querySelector('#gb-cq-add')?.addEventListener('click', () => {
    const townId = abCurrentTownId() || abTownIds()[0];
    if (!townId) { flash('no town'); return; }
    const b = panel.querySelector('#gb-cq-b')?.value;
    const lvlEl = panel.querySelector('#gb-cq-lvl');
    const lvl = lvlEl && lvlEl.value !== '' ? +lvlEl.value : null;
    abCqAdd(townId, b, lvl);
    renderCqRows();
    renderAbPlan();
  });
  panel.querySelector('#gb-cq-clear')?.addEventListener('click', () => {
    const townId = abCurrentTownId() || abTownIds()[0];
    if (!townId) return;
    abCqSet(townId, []);
    renderCqRows();
    renderAbPlan();
  });
  panel.querySelector('#gb-cq-copy')?.addEventListener('click', () => {
    const townId = abCurrentTownId() || abTownIds()[0];
    if (!townId) return;
    const list = abCqGet(townId);
    if (!list.length) { flash('queue empty'); return; }
    if (!confirm(`Copy this ${list.length}-entry queue to ALL towns? Existing custom queues are replaced.`)) return;
    abTownIds().forEach(id => { if (String(id) !== String(townId)) abCqSet(id, list.map(e => ({ b: e.b, lvl: e.lvl }))); });
    gbLog(`auto-queue: custom queue copied to ${abTownIds().length} town(s)`);
    flash('queue copied');
  });
  panel.querySelector('#gb-ab-now')?.addEventListener('click', () => {
    const was = state.abAuto;
    if (!was) { state.abAuto = true; save(STORE.AB_AUTO, true); }
    const el = panel.querySelector('#gb-ab-auto'); if (el) el.checked = true;
    const cfg = panel.querySelector('[data-cfg=auto-queue]'); if (cfg) cfg.checked = true;
    abScan('manual');
    if (!was) {  }
  });
  panel.querySelector('footer button[data-act=copy]').addEventListener('click', () => {
    const dump = redactFindingsExport({ findings: state.findings, farms: state.farms });
    const text = JSON.stringify(dump, null, 2);
    navigator.clipboard.writeText(text)
      .then(() => flash('copied'))
      .catch(() => {
        try {
          const ta = document.createElement('textarea');
          ta.value = text; document.body.appendChild(ta); ta.select();
          const ok = document.execCommand('copy');
          ta.remove();
          flash(ok ? 'copied' : 'copy failed');
        } catch (_) { flash('copy failed'); }
      });
  });
  panel.querySelector('footer button[data-act=export]').addEventListener('click', () => {
    const dump = redactFindingsExport({ findings: state.findings, farms: state.farms });
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `grepbot-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  });
  panel.querySelector('footer button[data-act=clear]').addEventListener('click', () => {
    if (!confirm('Clear all findings?')) return;
    state.findings = []; state.seen = {}; seenThisRun.clear();
    save(STORE.FINDINGS, state.findings); save(STORE.SEEN, state.seen);
    renderFindings();
  });
  panel.querySelector('footer button[data-act=diag]').addEventListener('click', () => {
    diagRun();
  });
  panel.querySelectorAll('button[data-act=evidence]').forEach(btn => {
    btn.addEventListener('click', () => { evidenceCopy(); });
  });
  panel.querySelector('footer button[data-act=preflight]')?.addEventListener('click', () => {
    showTab('stats');
    preflightRunAndRender();
  });
  panel.querySelector('footer button[data-act=scrape-farms]').addEventListener('click', () => {
    flash('farm scrape...');
    gbLog('manual: Farms now pressed');
    state.nextFarmScrape = 0;
    save(STORE.NEXT_FARM, 0);
    autoClaimFarms('manual');
    farmTick();
  });
  panel.querySelector('#gb-sleep-claim')?.addEventListener('click', () => {
    farmSleepClaimNow('manual');
    renderSleepStatus();
  });
  panel.querySelector('footer button[data-act=scrape-towns]').addEventListener('click', () => {
    flash('towns scrape...');
    state.nextTownsScrape = 0;
    save(STORE.NEXT_TOWNS, 0);
    farmTick();
  });

  function syncFarmTimingCfg(sec) {
    if (!sec) return;
    const lc = sec.querySelector('[data-cfg=farm-long-claims]'); if (lc) lc.checked = !!state.farmLongClaims;
    const lt = sec.querySelector('[data-cfg=farm-loyalty-tech]'); if (lt) lt.value = state.farmLoyaltyTech || '';
    const sd = sec.querySelector('[data-cfg=farm-sleep-dur]'); if (sd) sd.value = String(state.farmSleepDur || 'auto');
    const sa = sec.querySelector('[data-cfg=farm-sleep-auto]'); if (sa) sa.checked = !!state.farmSleepAuto;
    const sf = sec.querySelector('[data-cfg=farm-sleep-fill]'); if (sf) sf.value = state.farmSleepFillPct;
    const om = sec.querySelector('#gb-farm-optmap');
    if (om) {
      om.textContent = 'learned claim options: ' + farmOptionMapText() +
        ' (claim a timer by hand in game to teach the rest)';
    }
  }
  function bindConfig() {
    const sec = panel.querySelector('section[data-tab=config]');
    if (!sec) return;
    if (configBound) {
      sec.querySelector('[data-cfg=enabled-host]').checked = state.enabledHosts[location.host] === true;
      sec.querySelector('[data-cfg=collect-all]').checked = state.collectAll;
      const acol = sec.querySelector('[data-cfg=auto-collect]'); if (acol) acol.checked = state.autoCollect;
      sec.querySelector('[data-cfg=auto-bandit]').checked = state.autoBandit;
      sec.querySelector('[data-cfg=auto-farm]').checked = state.autoFarm;
      sec.querySelector('[data-cfg=farm-skip-full]').checked = state.farmSkipFull;
      const fm = sec.querySelector('[data-cfg=farm-full-mode]'); if (fm) fm.value = state.farmFullMode || 'any';
      syncFarmTimingCfg(sec);
      sec.querySelector('[data-cfg=auto-build]').checked = state.ibAuto;
      const ir = sec.querySelector('[data-cfg=instant-research]'); if (ir) ir.checked = state.ibResearch;
      sec.querySelector('[data-cfg=auto-queue]').checked = state.abAuto;
      sec.querySelector('[data-cfg=auto-quest-build]').checked = state.questAutoBuild;
      sec.querySelector('[data-cfg=auto-quest-res]').checked = state.questAutoRes;
      const ac = sec.querySelector('[data-cfg=auto-cave]'); if (ac) ac.checked = state.autoCave;
      const ct = sec.querySelector('[data-cfg=cave-thresh]'); if (ct) ct.value = state.caveThreshPct;
      const dr = sec.querySelector('[data-cfg=dry-run]'); if (dr) dr.checked = !!state.dryRun;
      const oa = sec.querySelector('[data-cfg=orch-adaptive]'); if (oa) oa.checked = state.orchAdaptive !== false;
      const od = sec.querySelector('[data-cfg=orch-deadlock]'); if (od) od.checked = state.orchDeadlockResolve !== false;
      const er = sec.querySelector('[data-cfg=export-redact]'); if (er) er.checked = state.exportRedact !== false;
      renderCaveTowns();
      return;
    }
    configBound = true;
    const hostEl = sec.querySelector('.cfg-host');
    if (hostEl) hostEl.textContent = location.host;
    const setChk = (sel, val) => { const el = sec.querySelector(sel); if (el) el.checked = !!val; };
    setChk('[data-cfg=enabled-host]', state.enabledHosts[location.host] === true);
    setChk('[data-cfg=collect-all]', state.collectAll);
    setChk('[data-cfg=auto-collect]', state.autoCollect);
    setChk('[data-cfg=auto-bandit]', state.autoBandit);
    setChk('[data-cfg=auto-farm]', state.autoFarm);
    setChk('[data-cfg=farm-skip-full]', state.farmSkipFull);
    const fm0 = sec.querySelector('[data-cfg=farm-full-mode]'); if (fm0) fm0.value = state.farmFullMode || 'any';
    syncFarmTimingCfg(sec);
    setChk('[data-cfg=auto-build]', state.ibAuto);
    setChk('[data-cfg=instant-research]', state.ibResearch);
    setChk('[data-cfg=auto-queue]', state.abAuto);
    setChk('[data-cfg=auto-quest-build]', state.questAutoBuild);
    setChk('[data-cfg=auto-quest-res]', state.questAutoRes);
    setChk('[data-cfg=auto-cave]', state.autoCave);
    const setNum = (sel, val) => { const el = sec.querySelector(sel); if (el) el.value = val; };
    setNum('[data-cfg=cave-thresh]', state.caveThreshPct);
    setNum('[data-cfg=ib-free-thresh]', state.ibFreeThresh);
    setNum('[data-cfg=collect-max-min]', state.collectMaxMin);
    setNum('[data-cfg=farm-min]', Math.round(state.farmMinMs / 60000));
    setNum('[data-cfg=farm-max]', Math.round(state.farmMaxMs / 60000));
    setNum('[data-cfg=town-min]', Math.round(state.townMinMs / 60000));
    setNum('[data-cfg=town-max]', Math.round(state.townMaxMs / 60000));
    sec.querySelector('[data-cfg=enabled-host]')?.addEventListener('change', e => {
      state.enabledHosts[location.host] = e.target.checked;
      save(STORE.ENABLED_HOSTS, state.enabledHosts);
      flash(e.target.checked ? 'enabled on ' + location.host : 'disabled on ' + location.host);
    });
    sec.querySelector('[data-cfg=auto-collect]')?.addEventListener('change', e => {
      state.autoCollect = e.target.checked; save(STORE.AUTO_COLLECT, state.autoCollect);
      flash(state.autoCollect ? 'auto-collect ON' : 'auto-collect OFF');
    });
    sec.querySelector('[data-cfg=collect-all]')?.addEventListener('change', e => {
      state.collectAll = e.target.checked; save(STORE.COLLECT_ALL, state.collectAll);
      flash(state.collectAll ? 'collect-all ON' : 'collect-all OFF');
      if (state.collectAll) collectAllBackground();
    });
    sec.querySelector('[data-cfg=auto-bandit]')?.addEventListener('change', e => {
      state.autoBandit = e.target.checked; save(STORE.AUTO_BANDIT, state.autoBandit);
      gbLog('auto-bandit', state.autoBandit ? 'ON' : 'OFF');
      if (state.autoBandit) {
        try { banditClearLoop(); } catch (_) {}
        banditIdleUntil = 0;
        banditScan();
      }
    });
    sec.querySelector('[data-cfg=auto-farm]')?.addEventListener('change', e => {
      state.autoFarm = e.target.checked; save(STORE.AUTO_FARM, state.autoFarm);
      gbLog('auto-farm', state.autoFarm ? 'ON' : 'OFF');
      if (state.autoFarm) autoClaimFarms('toggle');
    });
    sec.querySelector('[data-cfg=farm-skip-full]')?.addEventListener('change', e => {
      state.farmSkipFull = e.target.checked; save(STORE.FARM_SKIP_FULL, state.farmSkipFull);
      gbLog('farm-skip-full', state.farmSkipFull ? 'ON' : 'OFF');
    });
    sec.querySelector('[data-cfg=farm-full-mode]')?.addEventListener('change', e => {
      state.farmFullMode = e.target.value === 'all' ? 'all' : 'any';
      save(STORE.FARM_FULL_MODE, state.farmFullMode);
      gbLog('farm-full-mode', state.farmFullMode);
    });
    sec.querySelector('[data-cfg=auto-build]')?.addEventListener('change', e => {
      state.ibAuto = e.target.checked; save(STORE.IB_AUTO, state.ibAuto);
      gbLog('instant-build', state.ibAuto ? 'ON' : 'OFF');
      if (state.ibAuto) ibScan();
    });
    sec.querySelector('[data-cfg=farm-long-claims]')?.addEventListener('change', e => {
      state.farmLongClaims = e.target.checked; save(STORE.FARM_LONG_CLAIMS, state.farmLongClaims);
      gbLog('farm 10min claims', state.farmLongClaims ? 'ON' : 'OFF');
    });
    sec.querySelector('[data-cfg=farm-loyalty-tech]')?.addEventListener('change', e => {
      state.farmLoyaltyTech = String(e.target.value || '').trim();
      save(wkey(STORE.FARM_LOYALTY_TECH), state.farmLoyaltyTech);
      farmLoyaltyReset();
      gbLog('farm loyalty tech: ' + (state.farmLoyaltyTech || 'auto-detect'));
    });
    sec.querySelector('[data-cfg=farm-sleep-dur]')?.addEventListener('change', e => {
      state.farmSleepDur = e.target.value; save(STORE.FARM_SLEEP_DUR, state.farmSleepDur);
      syncFarmTimingCfg(sec);
    });
    sec.querySelector('[data-cfg=farm-sleep-auto]')?.addEventListener('change', e => {
      state.farmSleepAuto = e.target.checked; save(STORE.FARM_SLEEP_AUTO, state.farmSleepAuto);
      gbLog('auto sleep claim', state.farmSleepAuto ? 'ON' : 'OFF');
    });
    sec.querySelector('[data-cfg=instant-research]')?.addEventListener('change', e => {
      state.ibResearch = e.target.checked; save(STORE.IB_RESEARCH, state.ibResearch);
      gbLog('instant-research', state.ibResearch ? 'ON' : 'OFF');
      if (state.ibResearch && state.ibAuto) ibScan();
      else renderBuild();
    });
    sec.querySelector('[data-cfg=auto-queue]')?.addEventListener('change', e => {
      state.abAuto = e.target.checked; save(STORE.AB_AUTO, state.abAuto);
      gbLog('auto-queue', state.abAuto ? 'ON' : 'OFF');
      const el = panel.querySelector('#gb-ab-auto'); if (el) el.checked = state.abAuto;
      if (state.abAuto) abScan('toggle');
      renderAbQueue();
    });
    sec.querySelector('[data-cfg=auto-quest-build]')?.addEventListener('change', e => {
      state.questAutoBuild = e.target.checked; save(STORE.QUEST_AUTO_BUILD, state.questAutoBuild);
      gbLog('auto-quest-build', state.questAutoBuild ? 'ON' : 'OFF');
      if (state.questAutoBuild) questScanTick('toggle');
    });
    sec.querySelector('[data-cfg=auto-quest-res]')?.addEventListener('change', e => {
      state.questAutoRes = e.target.checked; save(STORE.QUEST_AUTO_RES, state.questAutoRes);
      gbLog('auto-quest-res', state.questAutoRes ? 'ON' : 'OFF');
      if (state.questAutoRes) questScanTick('toggle');
    });
    sec.querySelector('[data-cfg=auto-cave]')?.addEventListener('change', e => {
      state.autoCave = e.target.checked; save(STORE.AUTO_CAVE, state.autoCave);
      gbLog('auto-cave', state.autoCave ? 'ON' : 'OFF');
      if (state.autoCave) caveScan('toggle');
      renderCaveTowns();
    });

    const saveNum = (sel, fn) => sec.querySelector(sel)?.addEventListener('change', e => { fn(+e.target.value); });
    const ct = state.cultureTypes || {};
    setChk('[data-cfg=auto-culture]', state.autoCulture);
    setChk('[data-cfg=cult-festival]', ct.festival !== false);
    setChk('[data-cfg=cult-procession]', !!ct.procession);
    setChk('[data-cfg=cult-theater]', !!ct.theater);
    setChk('[data-cfg=cult-olympic]', !!ct.olympic);
    setChk('[data-cfg=allow-premium-culture]', !!state.allowPremiumCulture);
    setNum('[data-cfg=culture-gold-budget]', state.cultureGoldBudget || 0);
    setChk('[data-cfg=auto-trade]', state.autoTrade);
    setChk('[data-cfg=island-ship]', state.islandShip);
    setChk('[data-cfg=auto-rural-trade]', state.autoRuralTrade);
    setChk('[data-cfg=auto-rural-level]', state.autoRuralLevel);
    setChk('[data-cfg=auto-research]', state.autoResearch);
    setChk('[data-cfg=pause-activity]', state.pauseOnActivity);
    setChk('[data-cfg=night-pause]', state.nightPause);
    setChk('[data-cfg=captcha-global]', state.captchaGlobalKill !== false);
    setChk('[data-cfg=decision-memory]', state.decisionMemory !== false);
    setChk('[data-cfg=dry-run]', !!state.dryRun);
    setChk('[data-cfg=orch-adaptive]', state.orchAdaptive !== false);
    setChk('[data-cfg=orch-deadlock]', state.orchDeadlockResolve !== false);
    setChk('[data-cfg=export-redact]', state.exportRedact !== false);
    setChk('[data-cfg=auto-merchant]', state.autoMerchant);
    setChk('[data-cfg=auto-pt-trade]', state.autoPtTrade);
    {
      const c = state.ptCfg || {};
      const want = c.wantRes || {};
      setNum('[data-cfg=pt-ratio]', c.targetRatio != null ? c.targetRatio : 1);
      setNum('[data-cfg=pt-pump]', c.pumpAmount != null ? c.pumpAmount : 1);
      setNum('[data-cfg=pt-maxpumps]', c.maxPumps != null ? c.maxPumps : 6);
      setNum('[data-cfg=pt-reserve]', c.reservePct != null ? c.reservePct : 10);
      setChk('[data-cfg=pt-want-wood]', want.wood !== false);
      setChk('[data-cfg=pt-want-stone]', want.stone !== false);
      setChk('[data-cfg=pt-want-iron]', !!want.iron);
      const st = sec.querySelector('#gb-pt-status');
      if (st) st.textContent = typeof ptStatusText === 'function' ? ptStatusText() : '';
    }
    setChk('[data-cfg=auto-favor]', state.autoFavor);
    setChk('[data-cfg=auto-wonder]', state.autoWonder);
    setChk('[data-cfg=cs-alert]', state.csAlert !== false);
    setChk('[data-cfg=auto-militia]', state.autoMilitia);
    setChk('[data-cfg=auto-dodge]', state.autoDodge);
    setChk('[data-cfg=auto-recruit]', state.autoRecruit);
    setChk('[data-cfg=recruit-spells]', state.recruitSpells);
    setChk('[data-cfg=grepodata]', state.grepodataIndex);
    setNum('[data-cfg=rural-ratio]', state.ruralTradeRatio);
    setNum('[data-cfg=rural-level-max]', state.ruralLevelMax);
    setNum('[data-cfg=pause-ms]', Math.round((state.pauseActivityMs || 180000) / 60000));
    setNum('[data-cfg=night-start]', state.nightStart);
    setNum('[data-cfg=night-end]', state.nightEnd);
    setNum('[data-cfg=req-budget]', state.reqBudgetPerMin);
    setNum('[data-cfg=posts-soft]', state.postsPerMinSoftPct != null ? state.postsPerMinSoftPct : 60);
    const cl = sec.querySelector('[data-cfg=captcha-ladder]');
    if (cl) cl.value = (state.captchaLadder || [5, 15, 60]).join(',');
    setChk('[data-cfg=auto-wonder-favor]', !!state.autoWonderFavor);
    setNum('[data-cfg=dodge-floor]', state.dodgeFloor);
    const rr = sec.querySelector('[data-cfg=rural-res]'); if (rr) rr.value = state.ruralTradeRes || 'iron';
    const dm = sec.querySelector('[data-cfg=dodge-mode]'); if (dm) dm.value = state.dodgeMode || 'notify';
    const wh = sec.querySelector('[data-cfg=webhook-url]'); if (wh) wh.value = state.webhookUrl || '';
    const we = state.webhookEvents || {};
    setChk('[data-cfg=wh-captcha]', we.captcha !== false);
    setChk('[data-cfg=wh-attack]', we.attack !== false);
    setChk('[data-cfg=wh-pattern]', we.pattern !== false);
    setChk('[data-cfg=wh-warehouse]', !!we.warehouse);
    setChk('[data-cfg=wh-culture]', !!we.culture);
    const tg = sec.querySelector('[data-cfg=wh-tg-chat]'); if (tg) tg.value = we.telegramChatId || '';
    const tp = sec.querySelector('[data-cfg=trade-preset]'); if (tp) tp.value = state.tradePreset || 'storage';
    setNum('[data-cfg=trade-reserve]', state.tradeReservePct);
    setNum('[data-cfg=trade-min]', state.tradeMinBatch);
    setNum('[data-cfg=trade-max-hops]', state.tradeMaxHops);
    const bindToggle = (sel, key, store, onOn) => {
      sec.querySelector(sel)?.addEventListener('change', e => {
        state[key] = e.target.checked; save(store, state[key]);
        gbLog(key, state[key] ? 'ON' : 'OFF');
        if (state[key] && onOn) onOn();
      });
    };
    bindToggle('[data-cfg=auto-culture]', 'autoCulture', STORE.AUTO_CULTURE, () => cultureScan('toggle'));
    bindToggle('[data-cfg=auto-trade]', 'autoTrade', STORE.AUTO_TRADE, () => tradeScan('toggle'));
    bindToggle('[data-cfg=island-ship]', 'islandShip', STORE.ISLAND_SHIP, () => tradeScan('toggle'));
    bindToggle('[data-cfg=auto-rural-trade]', 'autoRuralTrade', STORE.AUTO_RURAL_TRADE, () => ruralTradeScan('toggle'));
    bindToggle('[data-cfg=auto-rural-level]', 'autoRuralLevel', STORE.AUTO_RURAL_LEVEL, () => ruralLevelScan('toggle'));
    bindToggle('[data-cfg=auto-research]', 'autoResearch', STORE.AUTO_RESEARCH, () => researchScan('toggle'));
    bindToggle('[data-cfg=pause-activity]', 'pauseOnActivity', STORE.PAUSE_ON_ACTIVITY);
    bindToggle('[data-cfg=night-pause]', 'nightPause', STORE.NIGHT_PAUSE);
    bindToggle('[data-cfg=captcha-global]', 'captchaGlobalKill', STORE.CAPTCHA_GLOBAL);
    bindToggle('[data-cfg=decision-memory]', 'decisionMemory', STORE.DECISION_MEM);
    bindToggle('[data-cfg=orch-adaptive]', 'orchAdaptive', STORE.ORCH_ADAPTIVE);
    bindToggle('[data-cfg=orch-deadlock]', 'orchDeadlockResolve', STORE.ORCH_DEADLOCK);
    bindToggle('[data-cfg=export-redact]', 'exportRedact', STORE.EXPORT_REDACT);
    sec.querySelector('[data-cfg=dry-run]')?.addEventListener('change', e => {
      state.dryRun = e.target.checked; save(STORE.DRY_RUN, state.dryRun);
      gbLog('DRY RUN ' + (state.dryRun ? 'ON - payloads logged, DOM clicks blocked' : 'OFF - posts go to the server'));
      flash(state.dryRun ? 'dry run ON' : 'dry run OFF');
      updateStatus();
    });
    bindToggle('[data-cfg=auto-merchant]', 'autoMerchant', STORE.AUTO_MERCHANT, () => merchantScan('toggle'));
    bindToggle('[data-cfg=auto-pt-trade]', 'autoPtTrade', STORE.AUTO_PT_TRADE, () => ptTradeScan('toggle'));
    const savePt = (key, val) => {
      if (!state.ptCfg || typeof state.ptCfg !== 'object') state.ptCfg = {};
      state.ptCfg[key] = val;
      save(STORE.PT_CFG, state.ptCfg);
    };
    saveNum('[data-cfg=pt-ratio]', v => savePt('targetRatio', Math.min(2, Math.max(0.5, v || 1))));
    saveNum('[data-cfg=pt-pump]', v => savePt('pumpAmount', Math.max(1, Math.floor(v || 1))));
    saveNum('[data-cfg=pt-maxpumps]', v => savePt('maxPumps', Math.min(20, Math.max(0, Math.floor(v || 0)))));
    saveNum('[data-cfg=pt-reserve]', v => savePt('reservePct', Math.min(90, Math.max(0, Math.floor(v || 0)))));
    const savePtWant = () => {
      savePt('wantRes', {
        wood: !!sec.querySelector('[data-cfg=pt-want-wood]')?.checked,
        stone: !!sec.querySelector('[data-cfg=pt-want-stone]')?.checked,
        iron: !!sec.querySelector('[data-cfg=pt-want-iron]')?.checked,
      });
    };
    ['pt-want-wood', 'pt-want-stone', 'pt-want-iron'].forEach(k => {
      sec.querySelector('[data-cfg=' + k + ']')?.addEventListener('change', savePtWant);
    });
    sec.querySelector('[data-cfg=pt-now]')?.addEventListener('click', () => {
      if (!state.ptTradeTpl) { flash('trade once by hand first'); return; }
      if (!confirm('Pump the merchant ship ratio and send the bulk trade now?')) return;
      const was = state.autoPtTrade;
      if (!was) { state.autoPtTrade = true; save(STORE.AUTO_PT_TRADE, true); }
      ptTradeScan('manual');
    });
    sec.querySelector('[data-cfg=pt-copy]')?.addEventListener('click', () => {
      const root = typeof ptWindowRoot === 'function' ? ptWindowRoot() : null;
      if (!root) { flash('open the merchant window first'); return; }
      navigator.clipboard.writeText(root.innerHTML.slice(0, 20000))
        .then(() => flash('offer HTML copied'))
        .catch(() => flash('copy failed'));
    });
    bindToggle('[data-cfg=auto-favor]', 'autoFavor', STORE.AUTO_FAVOR, () => favorScan('toggle'));
    bindToggle('[data-cfg=auto-wonder]', 'autoWonder', STORE.AUTO_WONDER, () => wonderScan('toggle'));
    bindToggle('[data-cfg=cs-alert]', 'csAlert', STORE.CS_ALERT);
    bindToggle('[data-cfg=auto-militia]', 'autoMilitia', STORE.AUTO_MILITIA);
    bindToggle('[data-cfg=auto-dodge]', 'autoDodge', STORE.AUTO_DODGE);
    bindToggle('[data-cfg=auto-recruit]', 'autoRecruit', STORE.AUTO_RECRUIT, () => recruitScan('toggle'));
    bindToggle('[data-cfg=recruit-spells]', 'recruitSpells', STORE.RECRUIT_SPELLS);
    bindToggle('[data-cfg=grepodata]', 'grepodataIndex', STORE.GREPODATA_INDEX);
    const saveCult = () => {
      state.cultureTypes = {
        festival: !!sec.querySelector('[data-cfg=cult-festival]')?.checked,
        procession: !!sec.querySelector('[data-cfg=cult-procession]')?.checked,
        theater: !!sec.querySelector('[data-cfg=cult-theater]')?.checked,
        olympic: !!sec.querySelector('[data-cfg=cult-olympic]')?.checked,
      };
      save(STORE.CULTURE_TYPES, state.cultureTypes);
    };
    ['cult-festival', 'cult-procession', 'cult-theater', 'cult-olympic'].forEach(k => {
      sec.querySelector('[data-cfg=' + k + ']')?.addEventListener('change', saveCult);
    });
    bindToggle('[data-cfg=allow-premium-culture]', 'allowPremiumCulture', STORE.ALLOW_PREMIUM_CULTURE);
    saveNum('[data-cfg=culture-gold-budget]', v => {
      state.cultureGoldBudget = Math.max(0, v);
      save(STORE.CULTURE_GOLD_BUDGET, state.cultureGoldBudget);
    });
    saveNum('[data-cfg=rural-ratio]', v => { state.ruralTradeRatio = v; save(STORE.RURAL_TRADE_RATIO, v); });
    saveNum('[data-cfg=rural-level-max]', v => { state.ruralLevelMax = v; save(STORE.RURAL_LEVEL_MAX, v); });
    saveNum('[data-cfg=pause-ms]', v => { state.pauseActivityMs = Math.max(1, v) * 60000; save(STORE.PAUSE_ACTIVITY_MS, state.pauseActivityMs); });
    saveNum('[data-cfg=night-start]', v => { state.nightStart = v; save(STORE.NIGHT_START, v); });
    saveNum('[data-cfg=night-end]', v => { state.nightEnd = v; save(STORE.NIGHT_END, v); });
    saveNum('[data-cfg=req-budget]', v => { state.reqBudgetPerMin = v; save(STORE.REQ_BUDGET, v); });
    saveNum('[data-cfg=posts-soft]', v => {
      state.postsPerMinSoftPct = Math.min(95, Math.max(20, v || 60));
      save(STORE.POSTS_SOFT_PCT, state.postsPerMinSoftPct);
    });
    sec.querySelector('[data-cfg=captcha-ladder]')?.addEventListener('change', e => {
      const parts = String(e.target.value || '').split(/[,;\s]+/).map(x => Math.max(1, Math.min(24 * 60, +x || 0))).filter(n => n >= 1);
      if (parts.length < 1) { flash('ladder needs ≥1 value'); return; }
      if (parts.some(n => n < 2)) gbLog('captcha ladder: values <2min are aggressive');
      state.captchaLadder = parts;
      save(STORE.CAPTCHA_LADDER, parts);
      flash('captcha ladder ' + parts.join(','));
    });
    sec.querySelector('[data-cfg=captcha-clear]')?.addEventListener('click', () => {
      captchaClear();
      flash('captcha pauses cleared');
      updateStatus();
    });
    sec.querySelector('[data-cfg=storage-prune]')?.addEventListener('click', () => {
      const before = JSON.stringify(state.seen || {}).length + JSON.stringify(state.alerted || {}).length;
      const ids = Object.keys(state.seen || {});
      if (ids.length > 500) {
        ids.slice(0, ids.length - 500).forEach(k => { delete state.seen[k]; });
        save(STORE.SEEN, state.seen);
      }
      const aks = Object.keys(state.alerted || {});
      const cut = Date.now() - 7 * 86400000;
      aks.forEach(k => { if ((state.alerted[k] || 0) < cut) delete state.alerted[k]; });
      save(STORE.ALERTED, state.alerted);
      const after = JSON.stringify(state.seen || {}).length + JSON.stringify(state.alerted || {}).length;
      flash('pruned ~' + Math.max(0, before - after) + 'B');
      gbLog('storage prune: seen=' + Object.keys(state.seen).length + ' alerted=' + Object.keys(state.alerted).length);
    });
    bindToggle('[data-cfg=auto-wonder-favor]', 'autoWonderFavor', STORE.AUTO_WONDER_FAVOR);
    let _presetUndo = null;
    sec.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.preset;
        if (kind === 'undo') {
          if (!_presetUndo) { flash('nothing to undo'); return; }
          Object.keys(_presetUndo).forEach(k => { state[k] = _presetUndo[k]; });
          _presetUndo = null;
          bindConfig();
          flash('preset undone');
          return;
        }
        const presets = {
          afk: {
            autoFarm: true, farmSleepAuto: true, farmLongClaims: true,
            autoCave: true, autoTrade: true, islandShip: true, autoCulture: true,
            autoResearch: true, abAuto: true, ibAuto: false, autoCollect: false,
            nightPause: true, dodgeMode: 'notify', autoDodge: false,
            autoRecruit: false, autoFavor: false,
          },
          farm: {
            autoFarm: true, farmSleepAuto: false, farmLongClaims: true,
            autoCave: true, autoTrade: true, islandShip: true, autoCulture: true,
            autoResearch: true, abAuto: true, ibAuto: true, autoCollect: true,
            nightPause: false, dodgeMode: 'notify', autoDodge: false,
            autoRecruit: false, autoFavor: false,
          },
          war: {
            autoFarm: true, autoCave: true, autoTrade: true, islandShip: true,
            autoCulture: false, autoResearch: false, abAuto: false, ibAuto: false,
            autoCollect: true, nightPause: false, dodgeMode: 'notify', autoDodge: false,
            autoRecruit: false, autoFavor: false,
          },
        };
        const patch = presets[kind];
        if (!patch) return;
        const keys = Object.keys(patch);
        const diff = keys.map(k => `${k}: ${state[k]}→${patch[k]}`).join(', ');
        if (!confirm('Apply ' + kind + ' preset?\n' + diff + '\n\nHIGH-RISK stays OFF. dryRun/hosts untouched.')) return;
        _presetUndo = {};
        keys.forEach(k => { _presetUndo[k] = state[k]; state[k] = patch[k]; });

        try {
          save(STORE.AUTO_FARM, state.autoFarm);
          save(STORE.AUTO_CAVE, state.autoCave);
          save(STORE.AUTO_TRADE, state.autoTrade);
          save(STORE.ISLAND_SHIP, state.islandShip);
          save(STORE.AUTO_CULTURE, state.autoCulture);
          save(STORE.AUTO_RESEARCH, state.autoResearch);
          save(STORE.AB_AUTO, state.abAuto);
          save(STORE.IB_AUTO, state.ibAuto);
          save(STORE.AUTO_COLLECT, state.autoCollect);
          save(STORE.NIGHT_PAUSE, state.nightPause);
          save(STORE.DODGE_MODE, state.dodgeMode);
          save(STORE.AUTO_DODGE, false);
          save(STORE.AUTO_RECRUIT, false);
          save(STORE.AUTO_FAVOR, false);
          save(STORE.FARM_SLEEP_AUTO, state.farmSleepAuto);
          save(STORE.FARM_LONG_CLAIMS, state.farmLongClaims);
        } catch (_) {}
        bindConfig();
        flash('preset ' + kind + ' applied');
        gbLog('preset: ' + kind + ' (' + keys.length + ' keys)');
      });
    });
    saveNum('[data-cfg=dodge-floor]', v => { state.dodgeFloor = v; save(STORE.DODGE_FLOOR, v); });
    sec.querySelector('[data-cfg=rural-res]')?.addEventListener('change', e => {
      state.ruralTradeRes = e.target.value; save(STORE.RURAL_TRADE_RES, state.ruralTradeRes);
    });
    sec.querySelector('[data-cfg=dodge-mode]')?.addEventListener('change', e => {
      state.dodgeMode = e.target.value; save(STORE.DODGE_MODE, state.dodgeMode);
    });
    sec.querySelector('[data-cfg=webhook-url]')?.addEventListener('change', e => {
      state.webhookUrl = e.target.value.trim(); save(STORE.WEBHOOK_URL, state.webhookUrl);
      gbLog('webhook url', state.webhookUrl ? 'set' : 'cleared');
    });
    const saveWebhookEvents = () => {
      state.webhookEvents = {
        captcha: !!sec.querySelector('[data-cfg=wh-captcha]')?.checked,
        attack: !!sec.querySelector('[data-cfg=wh-attack]')?.checked,
        pattern: !!sec.querySelector('[data-cfg=wh-pattern]')?.checked,
        warehouse: !!sec.querySelector('[data-cfg=wh-warehouse]')?.checked,
        culture: !!sec.querySelector('[data-cfg=wh-culture]')?.checked,
        telegramChatId: (sec.querySelector('[data-cfg=wh-tg-chat]')?.value || '').trim() || undefined,
      };
      save(STORE.WEBHOOK_EVENTS, state.webhookEvents);
    };
    ['wh-captcha', 'wh-attack', 'wh-pattern', 'wh-warehouse', 'wh-culture'].forEach(k => {
      sec.querySelector('[data-cfg=' + k + ']')?.addEventListener('change', saveWebhookEvents);
    });
    sec.querySelector('[data-cfg=wh-tg-chat]')?.addEventListener('change', saveWebhookEvents);
    sec.querySelector('[data-cfg=trade-preset]')?.addEventListener('change', e => {
      state.tradePreset = e.target.value; save(STORE.TRADE_PRESET, state.tradePreset);
      gbLog('tradePreset', state.tradePreset);
    });
    saveNum('[data-cfg=trade-reserve]', v => {
      state.tradeReservePct = Math.min(80, Math.max(0, v)); save(STORE.TRADE_RESERVE, state.tradeReservePct);
    });
    saveNum('[data-cfg=trade-min]', v => {
      state.tradeMinBatch = Math.max(100, v); save(STORE.TRADE_MIN, state.tradeMinBatch);
    });
    saveNum('[data-cfg=trade-max-hops]', v => {
      state.tradeMaxHops = Math.max(0, Math.min(200, v)); save(STORE.TRADE_MAX_HOPS, state.tradeMaxHops);
    });
    sec.querySelector('[data-cfg=research-csfast]')?.addEventListener('click', () => {
      researchLoadCsFast(); flash('CS-fast research');
    });
    saveNum('[data-cfg=cave-thresh]', v => {
      state.caveThreshPct = Math.min(99, Math.max(50, v || 90));
      save(STORE.CAVE_THRESH, state.caveThreshPct);
      gbLog('cave-thresh', state.caveThreshPct + '%');
    });
    saveNum('[data-cfg=farm-sleep-fill]', v => {
      state.farmSleepFillPct = Math.min(95, Math.max(10, v || 60));
      save(STORE.FARM_SLEEP_FILL, state.farmSleepFillPct);
    });
    saveNum('[data-cfg=ib-free-thresh]', v => { state.ibFreeThresh = v; save(STORE.IB_FREE_THRESH, v); });
    saveNum('[data-cfg=collect-max-min]', v => { state.collectMaxMin = v; save(STORE.COLLECT_MAX_MIN, v); });
    saveNum('[data-cfg=farm-min]', v => { state.farmMinMs = v * 60000; save(STORE.FARM_MIN, state.farmMinMs); });
    saveNum('[data-cfg=farm-max]', v => { state.farmMaxMs = v * 60000; save(STORE.FARM_MAX, state.farmMaxMs); });
    saveNum('[data-cfg=town-min]', v => { state.townMinMs = v * 60000; save(STORE.TOWN_MIN, state.townMinMs); });
    saveNum('[data-cfg=town-max]', v => { state.townMaxMs = v * 60000; save(STORE.TOWN_MAX, state.townMaxMs); });
    sec.querySelector('[data-cfg=clear-captcha]')?.addEventListener('click', () => {
      captchaClear();
      gbLog('captcha breakers cleared by user');
      flash('captcha breakers cleared');
    });
    renderCaveTowns();
  }
  bindConfig();
  {
    const start = TAB_IDS.includes(state.activeTab) ? state.activeTab : 'findings';
    showTab(start, { force: true });
  }

  const ta = panel.querySelector('textarea');
  ta.value = state.farms;
  let farmsInputTimer = null;
  ta.addEventListener('input', () => {
    state.farms = ta.value;
    clearTimeout(farmsInputTimer);
    farmsInputTimer = gbTimeout(() => {
      save(STORE.FARMS, state.farms);
      refreshFarmsParsed();
      renderFarms();
    }, 400);
  });

  (function drag(el, handle) {
    let sx, sy, dx, dy, dragging = false, moved = false;
    gbListen(handle, 'mousedown', e => {
      if (e.target.closest && e.target.closest('.gb-resize')) return;
      dragging = true; moved = false;
      sx = e.clientX; sy = e.clientY; dx = el.offsetLeft; dy = el.offsetTop;
      e.preventDefault();
    });
    gbListen(document, 'mousemove', e => {
      if (!dragging) return;
      moved = true;
      el.style.left = (e.clientX - sx + dx) + 'px';
      el.style.top = (e.clientY - sy + dy) + 'px';
      el.style.right = 'auto';
    });
    gbListen(document, 'mouseup', () => {
      if (!dragging) return;
      dragging = false;
      if (moved) savePanelGeom();
    });
  })(panel, panel.querySelector('header'));

  (function resize(el) {
    const DIRS = {
      n: { t: 1 }, s: { b: 1 }, e: { r: 1 }, w: { l: 1 },
      ne: { t: 1, r: 1 }, nw: { t: 1, l: 1 },
      se: { b: 1, r: 1 }, sw: { b: 1, l: 1 },
    };
    let sx, sy, sw, sh, sl, st, flags, resizing = false;
    el.querySelectorAll('.gb-resize').forEach(handle => {
      gbListen(handle, 'mousedown', e => {
        if (el.classList.contains('collapsed')) return;
        resizing = true;
        flags = DIRS[handle.dataset.dir] || DIRS.se;
        sx = e.clientX; sy = e.clientY;
        const rect = el.getBoundingClientRect();
        sw = rect.width; sh = rect.height;
        sl = rect.left; st = rect.top;

        el.style.left = sl + 'px';
        el.style.top = st + 'px';
        el.style.right = 'auto';
        e.preventDefault();
        e.stopPropagation();
      });
    });
    gbListen(document, 'mousemove', e => {
      if (!resizing) return;
      const maxW = Math.floor(window.innerWidth * 0.9);
      const maxH = Math.floor(window.innerHeight * 0.9);
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      let w = sw, h = sh;
      if (flags.r) w = sw + dx;
      if (flags.b) h = sh + dy;
      if (flags.l) w = sw - dx;
      if (flags.t) h = sh - dy;
      w = Math.min(maxW, Math.max(PANEL_MIN_W, w));
      h = Math.min(maxH, Math.max(PANEL_MIN_H, h));
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      el.style.maxHeight = 'none';
      if (flags.l) el.style.left = (sl + (sw - w)) + 'px';
      if (flags.t) el.style.top = (st + (sh - h)) + 'px';
    });
    gbListen(document, 'mouseup', () => {
      if (!resizing) return;
      resizing = false;
      savePanelGeom();
    });
  })(panel);

  panel.querySelector('footer button[data-act=reset-pos]').addEventListener('click', resetPanelGeom);

  function gbDebounce(fn, ms) {
    let t = null;
    return function () {
      if (t) clearTimeout(t);
      t = setTimeout(() => { t = null; fn(); }, ms);
    };
  }
  const findingsFilterDebounced = gbDebounce(() => {
    save(STORE.FINDINGS_FILTER, state.findingsFilter);
    renderFindings();
  }, 150);
  const journalFilterDebounced = gbDebounce(() => renderJournal(), 150);
  function ensureFindingsFilter(sec) {
    if (findingsFilterEl && findingsFilterEl.isConnected) return findingsFilterEl;
    const filt = document.createElement('div');
    filt.className = 'findings-filter';
    filt.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap';
    filt.innerHTML = '<input data-f="type" placeholder="type filter" style="flex:1;min-width:60px;background:#111;color:#cfc;border:1px solid #333;padding:2px 4px;font:11px monospace"/><input data-f="attacker" placeholder="attacker filter" style="flex:1;min-width:60px;background:#111;color:#cfc;border:1px solid #333;padding:2px 4px;font:11px monospace"/>';
    filt.querySelectorAll('input').forEach(inp => {
      inp.value = state.findingsFilter[inp.dataset.f] || '';
      inp.addEventListener('input', () => {
        state.findingsFilter[inp.dataset.f] = inp.value;

        findingsFilterDebounced();
      });
    });
    findingsFilterEl = filt;
    return filt;
  }
  function renderFindings() {
    const sec = panel.querySelector('section[data-tab=findings]');
    if (!sec) return;
    const filt = ensureFindingsFilter(sec);
    let list = sec.querySelector('.findings-list');
    if (!list) {

      if (!filt.parentNode) sec.appendChild(filt);
      list = document.createElement('div');
      list.className = 'findings-list';
      sec.appendChild(list);
    } else if (!filt.parentNode) {
      sec.insertBefore(filt, list);
    }
    list.replaceChildren();
    const typeF = (state.findingsFilter.type || '').toLowerCase();
    const atkF = (state.findingsFilter.attacker || '').toLowerCase();
    const slice = state.findings.filter(f => {
      if (typeF && !(f.type || '').toLowerCase().includes(typeF)) return false;
      if (atkF && !(f.attacker?.name || '').toLowerCase().includes(atkF)) return false;
      return true;
    }).slice(0, 80);
    if (!slice.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:#888;padding:10px';
      empty.textContent = state.findings.length ? 'no matches' : 'no findings yet - visit inbox';
      list.appendChild(empty);
      return;
    }
    for (const f of slice) {
      const row = document.createElement('div');
      row.className = 'finding';

      const meta = document.createElement('div');
      meta.className = 'meta';
      const when = new Date(f.ts).toLocaleTimeString();
      const target = f.town?.id != null
        ? `${f.town.name || 'town'} #${f.town.id}`
        : `t#${f.town?.id || '?'}`;
      const coord = (f.town?.x != null) ? ` (${f.town.x}|${f.town.y})` : '';
      meta.textContent = `#${f.id} | ${when} | ${f.type} | ${target}${coord}`;
      row.appendChild(meta);

      const units = document.createElement('div');
      units.className = 'units';
      units.textContent = f.units
        ? Object.entries(f.units).map(([k,v]) => `${k}:${v}`).join(' ')
        : '-';
      row.appendChild(units);

      if (f.resources && (f.resources.wood != null || f.resources.stone != null || f.resources.iron != null)) {
        const res = document.createElement('div');
        res.className = 'res';
        res.textContent = `W${f.resources.wood ?? '?'} S${f.resources.stone ?? '?'} I${f.resources.iron ?? '?'}`;
        row.appendChild(res);
      }

      if (f.town && f.town.id != null) {
        const actions = document.createElement('div');
        actions.style.cssText = 'margin-top:3px';
        const atkBtn = document.createElement('button');
        atkBtn.type = 'button';
        atkBtn.textContent = '-> Attack';
        atkBtn.title = `Use town #${f.town.id} as attack target`;
        atkBtn.style.cssText = 'background:#333;border:1px solid #555;color:#f96;padding:1px 6px;cursor:pointer;font-size:10px';
        atkBtn.addEventListener('click', () => prepareAttack(Object.assign({ kind: 'town' }, f.town)));
        actions.appendChild(atkBtn);
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.textContent = 'Copy id';
        copyBtn.title = 'Copy town id to clipboard';
        copyBtn.style.cssText = 'background:#333;border:1px solid #555;color:#9cf;padding:1px 6px;cursor:pointer;font-size:10px;margin-left:4px';
        copyBtn.addEventListener('click', () => {
          const id = String(f.town.id);
          try {
            navigator.clipboard.writeText(id);
            flash('copied ' + id);
          } catch (_) {
            flash('id: ' + id);
          }
        });
        actions.appendChild(copyBtn);
        row.appendChild(actions);
      }

      list.appendChild(row);
    }
  }

  function renderJournal() {
    const pane = panel && panel.querySelector('.jrn-pane');
    const list = pane && pane.querySelector('.jrn-list');
    if (!list || pane.hidden) return;
    const q = (panel.querySelector('.jrn-filter')?.value || '').trim().toLowerCase();
    const skips = jrnActiveSkips();
    const head = pane.querySelector('.jrn-head');
    if (head) {
      head.textContent = '';
      head.appendChild(document.createTextNode(
        `${state.decisions.length} decisions  |  memory ${state.decisionMemory === false ? 'OFF' : 'ON'}  |  `));
      const b = document.createElement('b');
      b.textContent = `${skips.length} skipping`;
      head.appendChild(b);
      if (skips.length) {
        const soonest = skips.slice().sort((a, b2) => a.until - b2.until)[0];
        head.appendChild(document.createTextNode(
          ` (${soonest.key} ${fmtSec(Math.round((soonest.until - Date.now()) / 1000))})`));
      }
    }
    const rows = state.decisions.filter(r => !q ||
      (r.f + ' ' + r.a + ' ' + r.k + ' ' + r.r).toLowerCase().includes(q)).slice(-120).reverse();
    list.textContent = '';
    if (!rows.length) {
      list.textContent = q ? '(no match)' : '(nothing recorded yet)';
      return;
    }
    const table = document.createElement('table');
    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.className = r.r === 'ok' ? 'ok' : (r.r.slice(0, 5) === 'skip:' ? 'skip' : 'err');
      const cell = (cls, text, title) => {
        const td = document.createElement('td');
        td.className = cls;
        td.textContent = text;
        if (title) td.title = title;
        tr.appendChild(td);
      };
      cell('t', new Date(r.ts).toLocaleTimeString());
      cell('f', r.f);
      cell('a', r.a);
      cell('k', r.k === '-' ? '' : r.k);
      cell('r', (r.r.slice(0, 5) === 'skip:' ? r.r.slice(5) : r.r) + ((r.n || 1) > 1 ? ' x' + r.n : ''), r.d || '');
      table.appendChild(tr);
    }
    list.appendChild(table);
  }
  function flash(msg) {
    const f = document.createElement('div');
    f.textContent = msg; f.style.cssText = 'position:fixed;top:60px;right:8px;background:#f5a623;color:#000;padding:6px 10px;border-radius:4px;z-index:100000';
    document.body.appendChild(f); gbTimeout(() => f.remove(), 1500);
  }

  function redactFindingsExport(dump) {
    if (state.exportRedact === false) {
      gbLogT('export-raw', 60000, 'export: redaction OFF - dump contains player names/ids');
      return dump;
    }
    const redactPlayer = (p) => {
      if (!p || typeof p !== 'object') return p;
      return { id: p.id != null ? 'p' + String(p.id).slice(-4) : null, name: p.name ? String(p.name).slice(0, 1) + '...' : null };
    };
    const findings = (dump.findings || []).map(f => {
      if (!f || typeof f !== 'object') return f;
      const out = Object.assign({}, f);
      out.attacker = redactPlayer(f.attacker);
      out.defender = redactPlayer(f.defender);
      if (out.town && typeof out.town === 'object') {
        out.town = { id: out.town.id, name: out.town.name ? String(out.town.name).slice(0, 1) + '...' : null, x: out.town.x, y: out.town.y };
      }
      delete out.raw;
      return out;
    });
    return { findings, farms: dump.farms };
  }

  let _statusLast = '';
  let _statusCsLast = '';
  let _statusLastAction = '';
  function updateStatus() {
    if (!panel) return;
    const el = panel.querySelector('#gb-status');
    if (!el) return;
    const csrfShort = state.csrf ? state.csrf.slice(0, 6) + '...' : 'NONE';
    const farms = state.farmsParsed.length;
    const okFarms = Object.values(state.farmResources).filter(r => r && r.ok).length;
    const lastErr = Object.values(state.farmResources).filter(r => r && !r.ok).slice(-1)[0];
    const errTxt = lastErr ? ` err:${(lastErr.err || '').slice(0, 20)}` : '';
    const paused = Object.keys(state.captchaBreakers || {}).filter(k => captchaPaused(k));
    const pauseInfo = {};
    automationPaused(pauseInfo);
    let pauseTxt = paused.length ? ` ||${paused.join(',')}` : '';
    if (pauseInfo.reason) pauseTxt += ` ||${pauseInfo.reason}`;
    if (captchaGlobalUntil > Date.now()) pauseTxt += ' ||ALL';
    const memSkips = jrnActiveSkips();
    if (memSkips.length) pauseTxt += ` mem:${memSkips.length}`;
    if (gbServerPaused()) pauseTxt += ` ||srv:${fmtSec(Math.round(gbServerCooldownLeftMs() / 1000))}`;
    if (storageWarnUntil > Date.now()) pauseTxt += ` ⚠${storageWarnMsg || 'quota'}`;
    try {
      const dl = typeof econDeadlock === 'function' ? econDeadlock() : null;
      if (dl && dl.open) pauseTxt += ' WH';
    } catch (_) {}
    try {
      const tb = typeof tplHealthBannerText === 'function' ? tplHealthBannerText() : '';
      if (tb) pauseTxt += ' tpl!';
    } catch (_) {}
    const dryTxt = state.dryRun ? ' DRY' : '';
    const txt = `csrf:${csrfShort} farms:${okFarms}/${farms}${errTxt}${dryTxt}${pauseTxt}`;
    if (txt !== _statusLast) {
      _statusLast = txt;
      el.textContent = txt;
      let titleExtra = '';
      try { titleExtra = tplHealthBannerText() || ''; } catch (_) {}
      el.title = (titleExtra ? titleExtra + ' | ' : '') + JSON.stringify({ csrf: !!state.csrf, captcha: state.captchaBreakers, pause: pauseInfo.reason, memory: memSkips.map(s => s.key) });
    }
    const la = panel.querySelector('#gb-last-action');
    if (la) {
      let chip = '';
      try {
        const list = state.decisions || [];
        for (let i = list.length - 1; i >= 0; i--) {
          const r = list[i];
          if (!r || r.r !== 'ok') continue;
          const ago = Math.max(0, Math.round((Date.now() - r.ts) / 1000));
          const agoTxt = ago < 60 ? ago + 's' : (ago < 3600 ? Math.round(ago / 60) + 'm' : Math.round(ago / 3600) + 'h');
          const act = String(r.a || '').slice(0, 18);
          chip = `${r.f}: ${act} OK ${agoTxt} ago`;
          la.style.color = ago > 900 && hostEnabled() && !pauseInfo.reason ? '#fc6' : '#8c8';
          break;
        }
        if (!chip && state.dryRun) chip = 'DRY (no live OK)';
      } catch (_) {}
      if (chip !== (_statusLastAction || '')) {
        _statusLastAction = chip;
        la.textContent = chip;
      }
    }
    const cs = panel.querySelector('#gb-collect-state');
    if (cs) {
      const csTxt = pauseInfo.reason ? `paused:${pauseInfo.reason}` : '';
      if (csTxt !== _statusCsLast) {
        _statusCsLast = csTxt;
        cs.textContent = csTxt;
      }
    }
  }
  let _timerFarmLast = '', _timerTownLast = '';
  function renderTimers() {
    if (!panel) return;
    const fe = panel.querySelector('#gb-next-farms');
    const te = panel.querySelector('#gb-next-towns');
    if (fe) {
      const t = state.nextFarmScrape
        ? `~ farms: ${fmtSec(Math.max(0, Math.round((state.nextFarmScrape - Date.now()) / 1000)))}`
        : '~ farms: -';
      if (t !== _timerFarmLast) { _timerFarmLast = t; fe.textContent = t; }
    }
    if (te) {
      const t = state.nextTownsScrape
        ? `~ towns: ${fmtSec(Math.max(0, Math.round((state.nextTownsScrape - Date.now()) / 1000)))}`
        : '~ towns: -';
      if (t !== _timerTownLast) { _timerTownLast = t; te.textContent = t; }
    }
  }
  function diagRun() {
    refreshFarmsParsed();
    updateStatus();
    const lines = [];
    lines.push('GrepBot diag ' + new Date().toISOString());
    lines.push('host: ' + location.host);
    lines.push('csrf: ' + (state.csrf ? 'yes' : 'NO'));
    const bridge = gameBridgeStatus();
    lines.push('bridge: uw=' + !!bridge.uw + ' Game=' + !!bridge.Game + ' MM=' + !!bridge.MM +
      ' gpAjax=' + !!bridge.gpAjax + ' ITowns=' + !!bridge.ITowns + ' GameData=' + !!bridge.GameData +
      ' farmRel=' + !!bridge.farmRel + ' farmTown=' + !!bridge.farmTown +
      ' townCol=' + !!bridge.townCol + ' attackSpot=' + !!bridge.attackSpot);
    lines.push('farmAction: ' + (state.farmAction || 'none'));
    const farms = state.farmsParsed || [];
    const gameN = farms.filter(f => f.fromGame).length;
    lines.push('farms: ' + farms.length + ' (game=' + gameN + ' manual=' + (farms.length - gameN) + ')');
    for (const f of farms) {
      const src = f._attrs || (f._rel && f._rel.attributes) || f._rel || {};
      const loot = f.lootable_at != null ? f.lootable_at : src.lootable_at;
      const last = src.last_looted_at;
      let delta = '?';
      if (loot != null && last != null && isFinite(+loot) && isFinite(+last)) delta = (+loot - +last) + 's';
      lines.push('  id=' + f.vill_id +
        ' name=' + (f.name || src.name || '?') +
        ' rel=' + (f.relation_id != null ? f.relation_id : (src.id != null ? src.id : '?')) +
        ' status=' + (src.relation_status != null ? src.relation_status : '?') +
        ' lootable=' + (loot != null ? loot : '?') +
        ' last=' + (last != null ? last : '?') +
        ' stage=' + (src.expansion_stage != null ? src.expansion_stage : '?') +
        ' delta=' + delta);
    }
    const townIds = (state.towns || []).map(t => t.id != null ? t.id : t);
    lines.push('towns: ' + townIds.length + ' ids=[' + townIds.join(',') + ']');
    try {
      const cd = caveDiag();
      if (cd && cd.info) {
        const info = cd.info;
        const tid = (caveListTownIds()[0]) || '?';
        let tname = '?';
        try {
          const t = info.town;
          if (t) tname = (typeof t.getName === 'function' ? t.getName() : null) || t.name || '?';
        } catch (_) {}
        const iron = info.iron, cap = info.cap;
        const pct = (iron != null && cap > 0) ? Math.round((iron / cap) * 100) : '?';
        lines.push('cave town ' + tid + ' ' + tname +
          ': hide=' + (info.hideLvl != null ? info.hideLvl : '?') +
          ' iron=' + (iron != null ? iron : '?') + '/' + (cap != null ? cap : '?') +
          ' (' + pct + '%) hideCap=' + (info.hideCap != null ? info.hideCap : '?') +
          ' stored=' + (info.stored != null ? info.stored : '?') +
          ' unlimited=' + !!info.unlimited);
        lines.push('  methods: ' + ((cd.keys && cd.keys.length) ? cd.keys.join(',') : '(none)'));
        lines.push('  attrs: ' + ((cd.attrs && cd.attrs.length) ? cd.attrs.join(',') : '(none)'));
      } else {
        lines.push('cave town ?: (no model)');
      }
    } catch (e) {
      lines.push('cave town ?: FAIL ' + String(e).slice(0, 80));
    }
    function finishDiag(extraLine) {
      if (extraLine) lines.push(extraLine);
      const report = lines.join('\n');
      console.groupCollapsed('[grepbot] diag');
      console.log(report);
      console.groupEnd();
      const okFlash = () => {
        flash('diag copied');
        gbLog('diag: copied ' + farms.length + ' farms, csrf=' + (state.csrf ? 'yes' : 'NO'));
      };
      const failFlash = () => {
        flash('diag ready - paste from console');
        gbLog('diag: clipboard fail - expand [grepbot] diag in console');
      };
      const tryExecCopy = () => {
        try {
          const ta = document.createElement('textarea');
          ta.value = report;
          document.body.appendChild(ta);
          ta.select();
          const ok = document.execCommand('copy');
          ta.remove();
          if (ok) okFlash(); else failFlash();
        } catch (_) { failFlash(); }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(report).then(okFlash).catch(tryExecCopy);
      } else {
        tryExecCopy();
      }
    }
    const first = farms[0];
    if (!first) {
      finishDiag();
      return;
    }
    fetchFarmResources(first, () => {
      const r = state.farmResources[first.vill_id] || {};
      finishDiag('test fetch vill=' + first.vill_id +
        ': ' + (r.ok ? 'ok' : 'FAIL') +
        ' action=' + (r.action || state.farmAction || '?') +
        ' wood=' + (r.wood != null ? r.wood : '?') +
        ' stone=' + (r.stone != null ? r.stone : '?') +
        ' iron=' + (r.iron != null ? r.iron : '?') +
        ' pop=' + (r.pop != null ? r.pop : '?') +
        ' err=' + (r.err || ''));
    });
  }

  ensureHostDefault();
  migrateConfig();
  state.csrf = huntCsrf() || state.csrf;
  if (state.csrf) save(wkey(STORE.CSRF), state.csrf);
  hookFetch();
  hookXhr();
  renderFindings();
  renderWorld();

  gbMenu('GrepBot: copy findings', () => {

    const dump = redactFindingsExport({ findings: state.findings, farms: state.farms });
    navigator.clipboard.writeText(JSON.stringify(dump, null, 2));
  });
  gbMenu('GrepBot: diag', () => { diagRun(); });
  gbMenu('GrepBot: rescan inbox', () => {
    seenThisRun.clear(); Object.keys(state.seen).forEach(k => delete state.seen[k]);
    seenCount = 0;
    save(STORE.SEEN, state.seen); scrapeInboxDom();
  });
  gbMenu('GrepBot: clear captcha', () => { captchaClear(); flash('captcha cleared'); });

  function ensurePanelMounted() {
    if (!panel) return;
    if (!document.body.contains(panel)) {
      document.body.appendChild(panel);
      gbLogT('panel-remount', 10000, 'panel remounted after SPA nav');
    }
    try { ensureDomObserver(); } catch (_) {}
  }
  function hookSpaNav() {
    const wrap = (name, origKey) => {
      if (!gbHookOrig[origKey]) gbHookOrig[origKey] = history[name].bind(history);
      const orig = gbHookOrig[origKey];
      const wrapped = function () {
        const r = orig.apply(history, arguments);
        gbTimeout(ensurePanelMounted, 50);
        return r;
      };
      wrapped._grepbot = true;
      history[name] = wrapped;
    };
    wrap('pushState', 'pushState');
    wrap('replaceState', 'replaceState');
    gbListen(window, 'popstate', () => gbTimeout(ensurePanelMounted, 50));
    gbListen(window, 'hashchange', () => gbTimeout(ensurePanelMounted, 50));
  }
  hookSpaNav();

  gbInterval(scrapeInboxDom, 30000);
  refreshFarmsParsed();
  renderFarms();
  renderTimers();
  updateStatus();

  if (!state.nextFarmScrape) { state.nextFarmScrape = Date.now() + 20000; save(STORE.NEXT_FARM, state.nextFarmScrape); }
  if (!state.nextTownsScrape) { state.nextTownsScrape = Date.now() + 30000; save(STORE.NEXT_TOWNS, state.nextTownsScrape); }
  gbInterval(farmTick, 15000);
  gbListen(document, 'visibilitychange', () => {
    if (!document.hidden) {
      try { gbWakeMarkResume('visible'); } catch (_) {}
      farmTick();
      try { reportCatchUpEnqueue(); } catch (_) {}

      try { gbWake('ibScan', () => ibScan(), { priority: 10 }); } catch (_) {}
    }
  });
  gbListen(window, 'pageshow', (e) => {
    if (e && e.persisted) {
      try { gbWakeMarkResume('bfcache'); } catch (_) {}
      farmTick();
      try { reportCatchUpEnqueue(); } catch (_) {}
      try { bindQuestObserver(); } catch (_) {}
      try { banditScheduleNext(); } catch (_) {}
      try { gbWake('ibScan', () => ibScan(), { priority: 10 }); } catch (_) {}
    }
  });
  gbInterval(checkThresholds, 30000);
  gbInterval(renderTimers, 1000);
  gbInterval(updateStatus, 5000);

  gbInterval(() => {
    if (!state.autoCollect) return;
    if (!hostEnabled() || automationPaused({}) || captchaPaused('collect')) return;
    autoCollectResources();
  }, 5000);
  if (state.collectAll) collectAllBackground();
  bindQuestObserver();
  gbTimeout(() => { if (hostEnabled()) questScanTick('boot'); }, 5000);
  gbInterval(() => { if (hostEnabled()) questScanTick('loop'); }, QUEST_SCAN_MS);

  gbListen(document, 'click', (e) => {
    let t = e.target;
    for (let i = 0; i < 5 && t; i++) {
      if (String(t.className || '').indexOf('button_build') !== -1) { gbTimeout(ibScan, 2000); break; }
      t = t.parentElement;
    }
  }, true);
  gbTimeout(() => {
    const scan = () => {
      if (gbInWakeBurst && gbInWakeBurst()) gbWake('ibScan', () => ibScan(), { priority: 10 });
      else ibScan();
    };
    scan();
    gbInterval(scan, IB_CHECK_MS);
  }, 8000);
  gbTimeout(() => { abEnsureTargets(); }, 12000);
  gbInterval(() => dodgeScan('loop'), DODGE_CHECK_MS);

  gbTimeout(() => { if (hostEnabled()) orchTick(); }, 15000);
  gbInterval(() => {
    if (gbInWakeBurst && gbInWakeBurst()) gbWake('orchTick', () => orchTick(), { priority: 30 });
    else orchTick();
  }, ORCH_MS);
  gbInterval(() => {

    renderOverview();
    renderIntel();
    renderStats();
    intelGrepodataAssist();
    intelWatchlistScan();
  }, 15000);
  qolBindActivityPause();

  gbInterval(gbLockSweep, 10000);
  const releaseLocks = () => {
    try { cancelArmedAttack(); } catch (_) {}
    try { gbUnlockAll(); } catch (_) {}
    try { banditAttackSentAt = 0; } catch (_) {}
    try { banditIdleUntil = 0; } catch (_) {}
    try {
      if (banditTimer) { clearTimeout(banditTimer); banditTimer = null; }
    } catch (_) {}
    try { banditClearLoop(); } catch (_) {}
    try { if (typeof questDispose === 'function') questDispose(); } catch (_) {}
    try { if (typeof orchCancelQueued === 'function') orchCancelQueued(); } catch (_) {}
    try { if (typeof dodgeQueueSave === 'function') dodgeQueueSave(); } catch (_) {}
    try { if (typeof questClaimFailSave === 'function') questClaimFailSave(); } catch (_) {}
    try { if (typeof persistServerCooldown === 'function') persistServerCooldown(); } catch (_) {}
  };
  gbListen(window, 'beforeunload', releaseLocks);
  gbListen(window, 'pagehide', releaseLocks);
})();
