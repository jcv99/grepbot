  function wkey(base) { return base + '@' + location.hostname; }

  const GB_ROOT = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
  if (typeof GB_ROOT.__grepbotDispose === 'function') {
    try { GB_ROOT.__grepbotDispose(); } catch (_) {}
  }
  const GB_INSTANCE_ID = 'gb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  GB_ROOT.__grepbotInstanceId = GB_INSTANCE_ID;
  let gbDisposed = false;
  const gbTabCoordSupported=!!(navigator.locks&&typeof navigator.locks.request==='function');
  const gbTabLockName='grepbot-leader:'+location.hostname;let gbTabLeader=!gbTabCoordSupported,gbTabLockPending=false,gbTabLockRelease=null;
  function gbInstanceAlive() {
    return !gbDisposed && GB_ROOT.__grepbotInstanceId === GB_INSTANCE_ID;
  }

  const gbTimerBag = [];
  const gbListenerBag = [];
  const gbXhrBag = [];
  const gbMenuCmds = [];
  const gbHookOrig = { fetch: null, xhrOpen: null, xhrSend: null, pushState: null, replaceState: null };
  let gbDomObserver = null;

  function gbInterval(fn, ms) {
    if (!gbInstanceAlive()) return 0;
    const entry = { kind: 'i', id: 0 };
    entry.id = setInterval(() => {
      if (!gbInstanceAlive()) return;
      try { fn(); } catch (e) { try { gbLog('interval error', String(e)); } catch (_) {} }
    }, ms);
    gbTimerBag.push(entry);
    return entry.id;
  }
  function gbTimeout(fn, ms) {
    if (!gbInstanceAlive()) return 0;
    const entry = { kind: 't', id: 0 };
    entry.id = setTimeout(() => {
      const i = gbTimerBag.indexOf(entry);
      if (i >= 0) gbTimerBag.splice(i, 1);
      if (!gbInstanceAlive()) return;
      try { fn(); } catch (e) { try { gbLog('timeout error', String(e)); } catch (_) {} }
    }, Math.max(0, +ms || 0));
    gbTimerBag.push(entry);
    return entry.id;
  }
  function gbClearTimeout(id) {
    if (!id) return;
    try { clearTimeout(id); } catch (_) {}
    const i = gbTimerBag.findIndex(t => t.kind === 't' && t.id === id);
    if (i >= 0) gbTimerBag.splice(i, 1);
  }
  // Sibling of gbClearTimeout: a widget that owns an interval (v4 plan 6.2)
  // must be able to stop it without waiting for instance teardown.
  function gbClearInterval(id) {
    if (!id) return;
    try { clearInterval(id); } catch (_) {}
    const i = gbTimerBag.findIndex(t => t.kind === 'i' && t.id === id);
    if (i >= 0) gbTimerBag.splice(i, 1);
  }
  function gbTryAcquireTabLeader() {
    if(!gbTabCoordSupported||gbDisposed||gbTabLeader||gbTabLockPending)return;gbTabLockPending=true;
    navigator.locks.request(gbTabLockName,{mode:'exclusive',ifAvailable:true},lock=>{gbTabLockPending=false;if(!gbInstanceAlive())return;if(!lock){gbTabLeader=false;gbTimeout(gbTryAcquireTabLeader,5000);try{updateStatus()}catch(_){}return}gbTabLeader=true;try{updateStatus()}catch(_){}return new Promise(resolve=>{gbTabLockRelease=resolve})}).catch(()=>{gbTabLockPending=false;gbTabLeader=false;if(gbInstanceAlive())gbTimeout(gbTryAcquireTabLeader,10000)});
  }
  gbTryAcquireTabLeader();
  function gbListen(target, type, fn, opts) {
    if (!target || !target.addEventListener) return null;
    const wrapped = function () {
      if (!gbInstanceAlive()) return;
      return fn.apply(this, arguments);
    };
    target.addEventListener(type, wrapped, opts);
    gbListenerBag.push({ target, type, fn: wrapped, opts });
    return wrapped;
  }
  function gbClearTimers() {
    for (const t of gbTimerBag.slice()) {
      try { if (t.kind === 'i') clearInterval(t.id); else clearTimeout(t.id); } catch (_) {}
    }
    gbTimerBag.length = 0;
  }
  function gbAbortXhrs() {
    for (const h of gbXhrBag.slice()) {
      try { if (h && typeof h.abort === 'function') h.abort(); } catch (_) {}
    }
    gbXhrBag.length = 0;
  }
  function gbRestoreHooks() {
    try {
      const uw = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
      if (gbHookOrig.fetch && uw.fetch && uw.fetch.__grepbotOwner === GB_INSTANCE_ID) {
        uw.fetch = gbHookOrig.fetch;
      }
      gbHookOrig.fetch = null;
      if (uw.XMLHttpRequest && uw.XMLHttpRequest.prototype) {
        const P = uw.XMLHttpRequest.prototype;
        if (gbHookOrig.xhrOpen && P.open && P.open.__grepbotOwner === GB_INSTANCE_ID) P.open = gbHookOrig.xhrOpen;
        if (gbHookOrig.xhrSend && P.send && P.send.__grepbotOwner === GB_INSTANCE_ID) P.send = gbHookOrig.xhrSend;
        gbHookOrig.xhrOpen = null;
        gbHookOrig.xhrSend = null;
        try { if (P._grepbot_open === GB_INSTANCE_ID) delete P._grepbot_open; } catch (_) {}
      }
      if (gbHookOrig.pushState && history.pushState && history.pushState.__grepbotOwner === GB_INSTANCE_ID) history.pushState = gbHookOrig.pushState;
      if (gbHookOrig.replaceState && history.replaceState && history.replaceState.__grepbotOwner === GB_INSTANCE_ID) history.replaceState = gbHookOrig.replaceState;
      gbHookOrig.pushState = null;
      gbHookOrig.replaceState = null;
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
      const id = GM_registerMenuCommand(label, () => { if (gbInstanceAlive()) fn(); });
      if (id != null) gbMenuCmds.push(id);
    } catch (_) {
      try { GM_registerMenuCommand(label, () => { if (gbInstanceAlive()) fn(); }); } catch (__) {}
    }
  }

  GB_ROOT.__grepbotDispose = function grepbotDispose() {
    if (gbDisposed) return;
    gbDisposed = true;
    if(gbTabLockRelease){try{gbTabLockRelease()}catch(_){}gbTabLockRelease=null}gbTabLeader=false;
    try { if (typeof txDispose === 'function') txDispose(); } catch (_) {}
    try { if (typeof jrnFlush === 'function') jrnFlush(); } catch (_) {}
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
    const qc = document.getElementById('grepbot-queue-center');
    if (qc) try { qc.remove(); } catch (_) {}
    // Widgets (v4 plan 6.2) own their own interval, so disposing the handles is
    // not the same as removing the elements - do both, and sweep any host a
    // previous instance left behind.
    try { gbWidgetDisposeAll(); } catch (_) {}
    try { contextMenuStop(); } catch (_) {}
    try { document.querySelectorAll('.gb-widget').forEach(el => el.remove()); } catch (_) {}
    try { document.querySelectorAll('.gb-native-qctl,.gb-native-panel').forEach(el=>el.remove()); } catch (_) {}
    if (GB_ROOT.__grepbotInstanceId === GB_INSTANCE_ID) {
      try { delete GB_ROOT.__grepbotInstanceId; } catch (_) { GB_ROOT.__grepbotInstanceId = null; }
    }
  };

  const GB_LOCK_TTL = {
    claim: 180000,
    'farm-scrape': 300000,
    'town-scrape': 300000,
    ib: 300000,
    ab: 300000,
    cave: 180000,
    'cave-emergency': 60000,
    culture: 180000,
    trade: 180000,
    'rural-trade': 180000,
    'rural-level': 180000,
    research: 180000,
    merchant: 180000,
    favor: 180000,
    godspell: 180000,
    wonder: 180000,
    'wonder-favor': 180000,
    dodge: 180000,
    spy: 180000,
    support: 180000,
    recruit: 180000,
    'defense-pull': 180000,
    cancel: 120000,
    hero: 180000,
    'collect-bg': 300000,
    'bandit-reward': 120000,
    militia: 60000,
    'pt-trade': 180000,
    'report-catchup': 300000,
    'quest-scan': 180000,
    'quest-auto': 180000,
  };
  const GB_LOCK_DEFAULT_TTL = 180000;
  const gbLocks = Object.create(null);
  let gbLockSeq = 0;
  function gbLockTtl(name) { return GB_LOCK_TTL[name] || GB_LOCK_DEFAULT_TTL; }
  function gbLockLease(name) {
    const L = gbLocks[name];
    if (!L) return null;
    if (Date.now() - L.at >= (L.ttl || gbLockTtl(name))) {
      delete gbLocks[name];
      gbLog(`lock: ${name} lease ${L.token} expired after ${Math.round((Date.now() - L.at) / 1000)}s`);
      return null;
    }
    return L;
  }
  function gbLocked(name) { return !!gbLockLease(name); }
  function gbLock(name, ttl) {
    if (!gbInstanceAlive() || gbLockLease(name)) return null;
    const token = `${GB_INSTANCE_ID}:${name}:${++gbLockSeq}:${Date.now().toString(36)}`;
    gbLocks[name] = { token, at: Date.now(), ttl: Math.max(1000, +ttl || gbLockTtl(name)) };
    return token;
  }
  function gbLockTouch(name, token, ttl) {
    const L = gbLockLease(name);
    if (!L || L.token !== token) return false;
    L.at = Date.now();
    if (ttl != null) L.ttl = Math.max(1000, +ttl || L.ttl);
    return true;
  }
  function gbUnlock(name, token) {
    const L = gbLocks[name];
    if (!L) return false;
    if (!token || L.token !== token) {
      gbLogT('lock-owner-' + name, 30000, `lock: refused foreign unlock ${name}`);
      return false;
    }
    delete gbLocks[name];
    return true;
  }
  function gbLockAge(name) { const L = gbLockLease(name); return L ? Date.now() - L.at : 0; }
  function gbUnlockAll() { for (const k of Object.keys(gbLocks)) delete gbLocks[k]; }
  function gbLockList() { return Object.keys(gbLocks).filter(k => !!gbLockLease(k)); }
  function gbLockSweep() { for (const k of Object.keys(gbLocks)) gbLockLease(k); }

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
    csrf:     load(STORE.CSRF, null),
    nextFarmScrape: load(STORE.NEXT_FARM, 0),
    nextTownsScrape: load(STORE.NEXT_TOWNS, 0),
    farmAction: load(STORE.FARM_ACTION, null),
    // The HTTP village-resource scrape only exists on worlds whose client still
    // answers a farm_town_* action. It defaults OFF: on a world where it does
    // not, every sweep burned N villages x 3 guesses of the shared request
    // budget and starved the bridge posts that actually matter.
    farmScrape: load(STORE.FARM_SCRAPE, false),
    // Winning HTTP action per ladder, so a sweep stops re-guessing what already
    // worked (6-deep and 5-deep ladders x N towns, every sweep, out of budget).
    townAction: load(STORE.TOWN_ACTION, null),
    townListAction: load(STORE.TOWN_LIST_ACTION, null),
    farmScrapeState: load(STORE.FARM_SCRAPE_STATE, null) || { dead: false, misses: 0 },
    collectAll: load(STORE.COLLECT_ALL, false),
    autoCollect: load(STORE.AUTO_COLLECT, false),
    collectTpl: load(STORE.COLLECT_TPL, null),
    autoBandit: load(STORE.AUTO_BANDIT, false),
    // v4 plan 5.8: empty = ship everything, exactly as before.
    banditCfg: load(STORE.BANDIT_CFG, {}) || {},
    banditLog:  load(STORE.BANDIT_LOG, []),
    autoFarm:   load(STORE.AUTO_FARM, false),
    claimTpl:   load(STORE.CLAIM_TPL, null),
    ibAuto:     load(STORE.IB_AUTO, false),
    ibFreeThresh: load(STORE.IB_FREE_THRESH, 300),
    ibAction:   load(STORE.IB_ACTION, null) || 'buyInstant',
    ibResearch: load(STORE.IB_RESEARCH, false),
    farmOptionMap: load(STORE.FARM_OPTION_MAP, null) || { 300: 1 },
    farmLongClaims: load(STORE.FARM_LONG_CLAIMS, true),
    farmLoyaltyTech: load(STORE.FARM_LOYALTY_TECH, '') || '',
    farmSleepDur: load(STORE.FARM_SLEEP_DUR, 'auto'),
    farmSleepAuto: load(STORE.FARM_SLEEP_AUTO, false),
    farmSleepFillPct: load(STORE.FARM_SLEEP_FILL, 60),
    farmSleepDay: load(STORE.FARM_SLEEP_DAY, '') || '',
    farmProfit: load(STORE.FARM_PROFIT, {}),
    // v4 plan 5.2: target-rotation policy, default OFF.
    adaptiveFarm: load(STORE.ADAPTIVE_FARM, false),
    farmDropPressurePct: load(STORE.FARM_DROP_PCT, 25),
    farmClaimsToday: load(STORE.FARM_CLAIMS_TODAY, {}) || {},
    farmClaimsDay: load(STORE.FARM_CLAIMS_DAY, '') || '',
    farmTravelSecPerUnit: load(STORE.FARM_TRAVEL, 0),
    ibActionR:  load(STORE.IB_ACTION_R, null) || 'buyInstant',
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
    attackTpl: load(STORE.ATTACK_TPL, null),
    cancelTpl: load(STORE.CANCEL_TPL, null),
    heroTpl: load(STORE.HERO_TPL, null) || {},
    attackPlan: load(STORE.ATTACK_PLAN, null),
    attackHistory: load(STORE.ATTACK_HISTORY, []),
    attackRecent: load(STORE.ATTACK_RECENT, []),
    captchaBreakers: load(STORE.CAPTCHA, null) || {},
    findingsFilter: load(STORE.FINDINGS_FILTER, { type: '', attacker: '' }),
    theme: load(STORE.THEME, 'dark'),
    contextMenu: load(STORE.CONTEXT_MENU, true),
    keyboardShortcuts: load(STORE.KEYBOARD_SHORTCUTS, true),
    keybindings: load(STORE.KEYBINDINGS, {}) || {},
    widgetGeom: load(STORE.WIDGET_GEOM, {}) || {},
    panelGeom: load(STORE.PANEL_GEOM, null),
    activeTab: load(STORE.ACTIVE_TAB, 'overview'),
    farmSkipFull: load(STORE.FARM_SKIP_FULL, true),
    farmFullMode: load(STORE.FARM_FULL_MODE, 'any'),
    abAuto: load(STORE.AB_AUTO, false),
    abTargets: load(STORE.AB_TARGETS, null),
    autoCave: load(STORE.AUTO_CAVE, false),
    caveThreshPct: load(STORE.CAVE_THRESH, 90),
    // v4 plan 3.5: HIGH-RISK auto path, default OFF.
    emergencyCaveAuto: load(STORE.EMERGENCY_CAVE_AUTO, false),
    emergencyCaveConfirm: load(STORE.EMERGENCY_CAVE_CONFIRM, 1000),
    emergencyCaveMinIron: load(STORE.EMERGENCY_CAVE_MIN, 50),
    emergencyLastStash: load(STORE.EMERGENCY_LAST, {}) || {},
    caveTowns: load(STORE.CAVE_TOWNS, {}),
    autoCulture: load(STORE.AUTO_CULTURE, false),
    cultureTypes: load(STORE.CULTURE_TYPES, { festival: true, procession: false, theater: false, olympic: false }),
    allowPremiumCulture: load(STORE.ALLOW_PREMIUM_CULTURE, false),
    cultureGoldBudget: load(STORE.CULTURE_GOLD_BUDGET, 0),
    autoTrade: load(STORE.AUTO_TRADE, false),
    tradePreset: load(STORE.TRADE_PRESET, 'storage'),
    tradeReservePct: load(STORE.TRADE_RESERVE, 20),
    tradeMinBatch: load(STORE.TRADE_MIN, 1000),
    // HIGH-RISK: tradeSend has no rollback path, so this defaults OFF.
    tradeRoutes: load(STORE.TRADE_ROUTES, {}) || {},
    // HIGH-RISK: a recurring irreversible POST loop, so default OFF.
    autoTradeRoutes: load(STORE.AUTO_TRADE_ROUTES, false),
    autoTransport: load(STORE.AUTO_TRANSPORT, false),
    // v4 plan 5.1: HIGH-RISK, same irreversible trade post. Default OFF.
    autoTransportAi: load(STORE.AUTO_TRANSPORT_AI, false),
    // v4 plan 3.4: HIGH-RISK. A trade post is irreversible, so default OFF.
    autoDump: load(STORE.AUTO_DUMP, false),
    dumpThreshold: load(STORE.DUMP_THRESHOLD, { wood: 95, stone: 95, iron: 90 }),
    dumpKeep: load(STORE.DUMP_KEEP, { wood: 50, stone: 50, iron: 50 }),
    dumpSinks: load(STORE.DUMP_SINKS, []),
    transportReserve: load(STORE.TRANSPORT_RESERVE, 20),
    transportMin: load(STORE.TRANSPORT_MIN, 1000),
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
    notifyEnabled: load(STORE.NOTIFY_ENABLED, false),
    notifyEvents: load(STORE.NOTIFY_EVENTS, {}) || {},
    notifyVolume: load(STORE.NOTIFY_VOLUME, 0.4),
    notifyMuted: load(STORE.NOTIFY_MUTED, false),
    webhookEvents: load(STORE.WEBHOOK_EVENTS, { captcha: true, attack: true, warehouse: false, culture: false, cappingPreWarn: false, 'counter-intel': true, hero: false }),
    autoMerchant: load(STORE.AUTO_MERCHANT, false),
    merchantWish: load(STORE.MERCHANT_WISH, []),
    autoFavor: load(STORE.AUTO_FAVOR, false),
    favorCfg: load(STORE.FAVOR_CFG, { god: 'athena', unit: 'harpy', thresh: 200, maxConcurrent: 2 }),
    spellCooldown: load(STORE.SPELL_COOLDOWN, {}),
    autoWonder: load(STORE.AUTO_WONDER, false),
    wonderCfg: load(STORE.WONDER_CFG, { wonderId: null, wood: 0, stone: 0, iron: 0, reserve: 5000, budget: 50000 }),
    autoDodge: load(STORE.AUTO_DODGE, false),
    // migration source only: the live control writes DEFENSE_CFG (ui.js)
    dodgeMode: load(STORE.DODGE_MODE, 'notify'),
    dodgeFloor: load(STORE.DODGE_FLOOR, 0),
    autoRecruit: load(STORE.AUTO_RECRUIT, false),
    recruitTargets: load(STORE.RECRUIT_TARGETS, {}),
    recruitSpells: load(STORE.RECRUIT_SPELLS, false),
    autoVillageRecruit: load(STORE.AUTO_VILLAGE_RECRUIT, false),
    villageRecruitFillPct: load(STORE.VILLAGE_RECRUIT_FILL, 90),
    villageRecruitAmount: load(STORE.VILLAGE_RECRUIT_AMOUNT, 1),
    villageRecruitStreaks: load(STORE.VILLAGE_RECRUIT_STREAKS, {}),
    priorityOrder: load(STORE.PRIORITY_ORDER, PRIORITY_ORDER_DEFAULT.slice()),
    islandShip: load(STORE.ISLAND_SHIP, false),
    autoMilitia: load(STORE.AUTO_MILITIA, false),
    csAlert: load(STORE.CS_ALERT, true),
    playerNotes: load(STORE.PLAYER_NOTES, {}),
    watchlist: load(STORE.WATCHLIST, []),
    // v4 plan 4.1: scout-class. Default OFF, and its own dryRun defaults ON.
    spyEnabled: load(STORE.AUTO_SPY, false),
    spyCfg: load(STORE.SPY_CFG, { targets: [], autoWatchlist: true, autoTopReported: 5, perCycle: 1, minGapMs: 1200000, dryRun: true, confirmOncePerCycle: true, maxConcurrent: 3 }),
    spyLastSpy: load(STORE.SPY_HISTORY, {}) || {},
    spyTpl: load(STORE.SPY_TPL, null),
    grepodataIndex: load(STORE.GREPODATA_INDEX, false),
    captchaGlobalKill: load(STORE.CAPTCHA_GLOBAL, true),
    reqBudgetPerMin: load(STORE.REQ_BUDGET, 40),
    allianceNotes: load(STORE.ALLIANCE_NOTES, {}),
    configVer: load(STORE.CONFIG_VER, 1),
    decisions: load(STORE.DECISIONS, []),
    decisionSkips: load(STORE.DECISION_SKIPS, {}),
    decisionMemory: load(STORE.DECISION_MEM, true),
    dryRun: load(STORE.DRY_RUN, false),
    intelBattleStats: load(STORE.INTEL_BATTLE_STATS, true),
    exportRedact: load(STORE.EXPORT_REDACT, true),
    orchAdaptive: load(STORE.ORCH_ADAPTIVE, true),
    txState: load(STORE.TX_STATE, {}),
    circuits: load(STORE.CIRCUITS, {}),
    abOrder: load(STORE.AB_ORDER, null),
    // v4 plan 4.5: repairs cost resources without user action, so default OFF.
    autoWallRepair: load(STORE.AUTO_WALL_REPAIR, false),
    abOptimalOrder: load(STORE.AB_OPTIMAL_ORDER, {}),
    abOptimalOrderOn: load(STORE.AB_OPTIMAL_ORDER_ON, true),
    plannerCfg: load(STORE.PLANNER_CFG, { global: { hard: { wood:0, stone:0, iron:0, population:0 }, soft: { wood:0, stone:0, iron:0, population:0 } }, towns: {} }),
    goalProfiles: load(STORE.GOAL_PROFILES, {}),
    townGoals: load(STORE.TOWN_GOALS, {}),
    virtualQueue: load(STORE.VIRTUAL_QUEUE, {}),
    virtualQueueOverrides: load(STORE.VIRTUAL_QUEUE_OVERRIDES, {}),
    buildSwapThresholdMin: load(STORE.BUILD_SWAP_MIN, 5),
    buildSwapIgnore: load(STORE.BUILD_SWAP_IGNORE, {}) || {},
    nativeQueue: load(STORE.NATIVE_QUEUE, { version: 1, seq: 0, towns: {} }),
    predictCfg: load(STORE.PREDICT_CFG, { horizonHours: 6 }),
    defenseCfg: load(STORE.DEFENSE_CFG, { mode: 'notify', returnMarginSec: 120, smartAuto: false }),
    // v4 plan 3.2: HIGH-RISK. auto defaults OFF in code AND in shipped config -
    // no user may get a send-support-without-clicking path on first install.
    defenseHistory: load(STORE.DEFENSE_HISTORY, []) || [],
    militiaCfg: load(STORE.MILITIA_CFG, { forceRisk: 50, skipRisk: 10, localOk: 400, graceMs: 180000 }),
    supportCfg: load(STORE.SUPPORT_CFG, { auto: false, confirmThreshold: 100, homeFloor: 0, shareDodgeFloor: true, minEtaSec: 120, noArmSec: 60, overlapSec: 30 }),
    supportLastSend: load(STORE.SUPPORT_LAST_SEND, {}) || {},
    supportTpl: load(STORE.SUPPORT_TEMPLATE, null),
    dodgeReturns: load(STORE.DODGE_RETURNS, {}),
    health: load(STORE.HEALTH, {}),
    clientFingerprint: load(STORE.CLIENT_FP, null),
    safeMode: load(STORE.SAFE_MODE, true),
    simCfg: load(STORE.SIM_CFG, { horizonHours: 24 }),
    whyLog: load(STORE.WHY_LOG, []),
    tplHealth: load(STORE.TPL_HEALTH, {}) || {},
    captchaLadder: load(STORE.CAPTCHA_LADDER, [5, 15, 60]),
    postsPerMinSoftPct: load(STORE.POSTS_SOFT_PCT, 60),
    tabFilters: load(STORE.TAB_FILTERS, {}) || {},
    orchDeadlockResolve: load(STORE.ORCH_DEADLOCK, true),
    farmLoyaltySeen: load(STORE.FARM_LOYALTY_SEEN, false),
    farmTeachBanner: load(STORE.FARM_TEACH_BANNER, ''),
    lastSeenTs: load(STORE.LAST_SEEN_TS, 0),
    watchHits: load(STORE.WATCH_HITS, {}) || {},
    wonderFavorTpl: load(STORE.WONDER_FAVOR_TPL, null),
    autoWonderFavor: load(STORE.AUTO_WONDER_FAVOR, false),
    autoPtTrade: load(STORE.AUTO_PT_TRADE, false),
    ptCfg: load(STORE.PT_CFG, null) || {
      targetRatio: 1.0, pumpAmount: 1, maxPumps: 6, reservePct: 10,
      wantRes: { wood: true, stone: true, iron: false },
    },
    ptTradeTpl: load(wkey(STORE.PT_TRADE_TPL), null),
    ptViewUrl: load(wkey(STORE.PT_VIEW_URL), null),
  };

  let panel = null;
  let userPausedUntil = 0;
  // Panic latch (v4 plan 1.1). Deliberately transient: a reload disposes the
  // instance and clears timers/locks anyway, and a persisted deadline would
  // need a world-scoped migration while risking a stale reload that strands
  // automation. `dryRun` is the only piece that persists, through STORE.DRY_RUN.
  const GB_PANIC_GRACE_MS = 30000;
  let panicUntil = 0;          // hard-stop deadline; automationPaused -> 'panic'
  let panicNeedsClear = false; // survives the deadline -> 'panic-grace' until recovery
  let captchaGlobalUntil = +load(STORE.CAPTCHA_GLOBAL_UNTIL, 0) || 0;
  const moduleHealth = (state.health && typeof state.health === 'object') ? state.health : {};
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
          if (base === STORE.CONFIG_VER) continue;
          const v = load(base, null);
          if (v != null) save(base, v);
        } catch (_) {}
      }
      ver = 2;
    }
    if (ver < 3) {
      // v3 makes world migration explicit and introduces transactional safety state.
      if (!state.txState || typeof state.txState !== 'object' || Array.isArray(state.txState)) state.txState = {};
      if (!state.circuits || typeof state.circuits !== 'object' || Array.isArray(state.circuits)) state.circuits = {};
      if (!Array.isArray(state.abOrder)) state.abOrder = null;
      // 1.5.x used [] to mean "all towns" in the attack planner. 1.6.0 reserves []
      // for an explicit "no sources" selection, so migrate the legacy ambiguous value.
      if (state.attackPlan && Array.isArray(state.attackPlan.sourceTownIds) && state.attackPlan.sourceTownIds.length === 0) {
        state.attackPlan.sourceTownIds = null;
        save(STORE.ATTACK_PLAN, state.attackPlan);
      }
      // Auto collect is a write-capable automation in 1.6.0 and is opt-in independently.
      if (typeof state.autoCollect !== 'boolean') { state.autoCollect = false; save(STORE.AUTO_COLLECT, false); }
      // 1.5.x favor automation used a farm-town id through Town/sendUnits. Disable persisted
      // enablement until a canonical city-target implementation exists.
      if (state.autoFavor) { state.autoFavor = false; save(STORE.AUTO_FAVOR, false); }
      save(STORE.TX_STATE, state.txState);
      save(STORE.CIRCUITS, state.circuits);
      if (state.abOrder) save(STORE.AB_ORDER, state.abOrder);
      ver = 3;
    }
    if (ver < 4) {
      // v4 keeps military UX state world-scoped and extends the transactional write layer
      // to movement cancellation and hero assignment operations.
      if (!Array.isArray(state.attackRecent)) state.attackRecent = [];
      if (!state.heroTpl || typeof state.heroTpl !== 'object' || Array.isArray(state.heroTpl)) state.heroTpl = {};
      if (state.cancelTpl && typeof state.cancelTpl !== 'object') state.cancelTpl = null;
      if (state.attackPlan && typeof state.attackPlan === 'object') {
        if (!state.attackPlan.harassPreset) state.attackPlan.harassPreset = 'light';
        save(STORE.ATTACK_PLAN, state.attackPlan);
      }
      save(STORE.ATTACK_RECENT, state.attackRecent);
      if (state.cancelTpl) save(STORE.CANCEL_TPL, state.cancelTpl);
      save(STORE.HERO_TPL, state.heroTpl);
      ver = 4;
    }
    if (ver < 5) {
      // v5 introduces the shared Resource Planner. Strategic reserves are opt-in and
      // transaction reservations are stored inside TX_STATE so ambiguous writes keep
      // their resources reserved across reloads.
      if (!state.plannerCfg || typeof state.plannerCfg !== 'object' || Array.isArray(state.plannerCfg)) {
        state.plannerCfg = { global: { hard: { wood:0, stone:0, iron:0, population:0 }, soft: { wood:0, stone:0, iron:0, population:0 } }, towns: {} };
      }
      save(STORE.PLANNER_CFG, state.plannerCfg);
      ver = 5;
    }
    if (ver < 6) {
      if (!state.goalProfiles || typeof state.goalProfiles !== 'object' || Array.isArray(state.goalProfiles)) state.goalProfiles = {};
      if (!state.townGoals || typeof state.townGoals !== 'object' || Array.isArray(state.townGoals)) state.townGoals = {};
      if (!state.virtualQueue || typeof state.virtualQueue !== 'object' || Array.isArray(state.virtualQueue)) state.virtualQueue = {};
      save(STORE.GOAL_PROFILES, state.goalProfiles); save(STORE.TOWN_GOALS, state.townGoals); save(STORE.VIRTUAL_QUEUE, state.virtualQueue);
      ver = 6;
    }
    if (ver < 7) {
      if (!state.predictCfg || typeof state.predictCfg !== 'object') state.predictCfg = { horizonHours: 6 };
      if (!state.defenseCfg || typeof state.defenseCfg !== 'object') state.defenseCfg = { mode:'notify', returnMarginSec:120, smartAuto:false };
      if (!state.dodgeReturns || typeof state.dodgeReturns !== 'object' || Array.isArray(state.dodgeReturns)) state.dodgeReturns = {};
      save(STORE.PREDICT_CFG,state.predictCfg); save(STORE.DEFENSE_CFG,state.defenseCfg); save(STORE.DODGE_RETURNS,state.dodgeReturns);
      ver = 7;
    }
    if (ver < 8) {
      if (!state.health || typeof state.health !== 'object' || Array.isArray(state.health)) state.health = {};
      if (typeof state.safeMode !== 'boolean') state.safeMode = true;
      if (!state.simCfg || typeof state.simCfg !== 'object') state.simCfg = {horizonHours:24};
      if (!Array.isArray(state.whyLog)) state.whyLog = [];
      save(STORE.HEALTH,state.health); save(STORE.SAFE_MODE,state.safeMode); save(STORE.SIM_CFG,state.simCfg); save(STORE.WHY_LOG,state.whyLog);
      ver = 8;
    }
    if (ver < 9) {
      if (!state.virtualQueueOverrides || typeof state.virtualQueueOverrides !== 'object' || Array.isArray(state.virtualQueueOverrides)) state.virtualQueueOverrides = {};
      save(STORE.VIRTUAL_QUEUE_OVERRIDES, state.virtualQueueOverrides);
      ver = 9;
    }
    if (ver < 10) {
      if (!state.nativeQueue || typeof state.nativeQueue !== 'object' || Array.isArray(state.nativeQueue)) {
        state.nativeQueue = { version: 1, seq: 0, towns: {} };
      }
      if (!state.nativeQueue.towns || typeof state.nativeQueue.towns !== 'object' || Array.isArray(state.nativeQueue.towns)) state.nativeQueue.towns = {};
      state.nativeQueue.version = 1;
      state.nativeQueue.seq = Math.max(0, +state.nativeQueue.seq || 0);
      save(STORE.NATIVE_QUEUE, state.nativeQueue);
      // v2.1 rejected Grepolis' real free-completion action and could open the
      // shared build circuit with its two invalid aliases. Reset only that
      // legacy state; all other circuit breakers remain untouched.
      if (!/^buyInstant$/i.test(String(state.ibAction || ''))) state.ibAction = 'buyInstant';
      if (!/^buyInstant$/i.test(String(state.ibActionR || ''))) state.ibActionR = 'buyInstant';
      save(STORE.IB_ACTION, state.ibAction); save(STORE.IB_ACTION_R, state.ibActionR);
      const buildCircuit=state.circuits&&state.circuits.build;
      if(buildCircuit&&/completeInstant|finishInstantly/i.test(String(buildCircuit.lastError||'')))delete state.circuits.build;
      save(STORE.CIRCUITS,state.circuits||{});
      for(const key of Object.keys(state.decisionSkips||{})){const rec=state.decisionSkips[key]||{};if(/completeInstant|finishInstantly/i.test(key)||/^(?:pending|timeout_unknown|unknown outcome)/i.test(String(rec.r||'')))delete state.decisionSkips[key]}
      save(STORE.DECISION_SKIPS,state.decisionSkips||{});
      if(!state.defenseCfg||typeof state.defenseCfg!=='object')state.defenseCfg={mode:'notify',returnMarginSec:120,smartAuto:false};
      if(state.dodgeMode==='auto'&&(!state.defenseCfg.mode||state.defenseCfg.mode==='notify'))state.defenseCfg.mode='safe';
      state.defenseCfg.returnMarginSec=Math.max(0,Math.min(3600,+state.defenseCfg.returnMarginSec||120));
      state.defenseCfg.smartAuto=!!state.defenseCfg.smartAuto;save(STORE.DEFENSE_CFG,state.defenseCfg);
      ver = 10;
    }
    if (ver < 11) {
      // v4 plan 3.1: guarantee the route table is an object and the loop flag
      // a boolean, so a hand-edited storage value cannot reach the planner.
      if (!state.tradeRoutes || typeof state.tradeRoutes !== 'object' || Array.isArray(state.tradeRoutes)) {
        state.tradeRoutes = {}; save(STORE.TRADE_ROUTES, state.tradeRoutes);
      }
      if (typeof state.autoTradeRoutes !== 'boolean') {
        state.autoTradeRoutes = false; save(STORE.AUTO_TRADE_ROUTES, state.autoTradeRoutes);
      }
      // v4 plan 3.2: force the HIGH-RISK auto flag to a real boolean and the
      // ledger to an object, so a hand-edited storage value cannot arm a send.
      if (!state.supportCfg || typeof state.supportCfg !== 'object' || Array.isArray(state.supportCfg)) state.supportCfg = {};
      state.supportCfg.auto = state.supportCfg.auto === true;
      save(STORE.SUPPORT_CFG, state.supportCfg);
      if (!state.supportLastSend || typeof state.supportLastSend !== 'object' || Array.isArray(state.supportLastSend)) {
        state.supportLastSend = {}; save(STORE.SUPPORT_LAST_SEND, state.supportLastSend);
      }
      // v4 plan 2.7: population state is derived, not stored. The only thing to
      // drop is the memo of a render that predates townPopState, and there is
      // none - so this step exists purely to stamp the version siblings 2.11
      // and 3.7 gate their own migrations on.
      ver = 11;
    }
    if (ver < 12) {
      // v4 plan 3.4: seed the dump policy so an upgrade reads real defaults
      // rather than undefined, and force the HIGH-RISK flag to a boolean.
      if (typeof state.autoDump !== 'boolean') { state.autoDump = false; save(STORE.AUTO_DUMP, state.autoDump); }
      const seedMap = (key, store, def) => {
        const cur = state[key];
        if (!cur || typeof cur !== 'object' || Array.isArray(cur)) { state[key] = def; save(store, def); }
      };
      seedMap('dumpThreshold', STORE.DUMP_THRESHOLD, { wood: 95, stone: 95, iron: 90 });
      seedMap('dumpKeep', STORE.DUMP_KEEP, { wood: 50, stone: 50, iron: 50 });
      if (!Array.isArray(state.dumpSinks)) { state.dumpSinks = []; save(STORE.DUMP_SINKS, state.dumpSinks); }
      // v4 plan 3.7: clamp the snipe-detector tunables inside the existing
      // defenseCfg object so a hand-edited value cannot produce a nonsense
      // cluster window.
      if (!state.defenseCfg || typeof state.defenseCfg !== 'object') state.defenseCfg = { mode: 'notify', returnMarginSec: 120, smartAuto: false };
      state.defenseCfg.snipeDetect = state.defenseCfg.snipeDetect !== false;
      const clampD = (k, d, lo, hi) => { const n = +state.defenseCfg[k]; state.defenseCfg[k] = Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
      clampD('csClusterGapSec', 900, 60, 21600);
      clampD('csCoverSec', 180, 5, 900);
      clampD('csTightSec', 5, 0, 120);
      save(STORE.DEFENSE_CFG, state.defenseCfg);
      ver = 12;
    }
    if (ver !== state.configVer) {
      state.configVer = ver;
      save(STORE.CONFIG_VER, ver);
      gbLog('config migrated → v' + ver);
    }
  }

  let healthSaveTimer = 0;
  function healthSaveSoon() {
    state.health = moduleHealth;
    if (healthSaveTimer) return;
    healthSaveTimer = gbTimeout(() => { healthSaveTimer = 0; save(STORE.HEALTH, moduleHealth); }, 1500);
  }
  function markModuleHealth(feature, kind, meta) {
    const h = moduleHealth[feature] || { ok:0, err:0, captcha:0, timeout:0, last:0, consecutiveErr:0, avgLatency:null, samples:0 };
    const now=Date.now(), m=meta||{};
    if (kind === 'ok') { h.ok++; h.lastOk=now; h.consecutiveErr=0; }
    else if (kind === 'captcha') { h.captcha++; h.lastErr=now; h.consecutiveErr=(h.consecutiveErr||0)+1; }
    else if (kind === 'timeout') { h.timeout=(h.timeout||0)+1; h.err++; h.lastErr=now; h.consecutiveErr=(h.consecutiveErr||0)+1; }
    else { h.err++; h.lastErr=now; h.consecutiveErr=(h.consecutiveErr||0)+1; }
    if (m.error) h.lastError=String(m.error).slice(0,160);
    if (Number.isFinite(+m.latencyMs) && +m.latencyMs>=0) { h.samples=(h.samples||0)+1; h.lastLatency=+m.latencyMs; h.avgLatency=h.avgLatency==null?+m.latencyMs:(h.avgLatency*0.85+(+m.latencyMs)*0.15); }
    h.last=now; moduleHealth[feature]=h; healthSaveSoon();
  }
  function whyNote(feature, action, status, why) {
    if (!Array.isArray(state.whyLog)) state.whyLog=[];
    const last=state.whyLog[0]; const key=`${feature}|${action}|${status}|${why||''}`;
    if (last && last.key===key && Date.now()-last.ts<15000) return;
    state.whyLog.unshift({ts:Date.now(),feature:String(feature||''),action:String(action||'').slice(0,120),status:String(status||''),why:String(why||'').slice(0,180),key});
    if(state.whyLog.length>200)state.whyLog.length=200; save(STORE.WHY_LOG,state.whyLog);
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
  function gbPanicActive() { return panicUntil > Date.now(); }
  function gbPanicPending() { return panicNeedsClear; }
  function gbPanicLeftMs() { return Math.max(0, panicUntil - Date.now()); }
  // Emergency stop. No post surface, no lock, no new scheduler: it only sets a
  // latch the shared automationPaused() predicate already gates every loop on.
  function gbPanicActivate() {
    if (gbPanicActive()) { gbLogT('panic-dup', 5000, 'panic: already active'); return false; }
    panicUntil = Date.now() + GB_PANIC_GRACE_MS;
    panicNeedsClear = true;
    if (!state.dryRun) { state.dryRun = true; save(STORE.DRY_RUN, true); }
    gbUnlockAll();
    gbLog('panic: activated');
    try { updateStatus(); } catch (_) {}
    return true;
  }
  // Recovery never turns dry-run back OFF: the operator may have enabled it
  // before panic, and this feature has no authority to override that choice.
  function gbPanicRecover() {
    if (!panicNeedsClear) return { ok: false, why: 'inactive' };
    if (gbPanicActive()) return { ok: false, why: 'grace' };
    // Clearing skips IS the recovery contract. If it throws, keep the latch:
    // resuming with the skip windows still persisted would be a false recovery.
    try { jrnClearSkips(); } catch (e) {
      gbLog('panic: clear skips failed - ' + String(e).slice(0, 60));
      return { ok: false, why: 'clear-failed' };
    }
    gbUnlockAll();
    panicNeedsClear = false;
    panicUntil = 0;
    const info = {};
    const stillPaused = automationPaused(info);
    if (stillPaused) gbLog('panic: cleared, still paused (' + (info.reason || '?') + ')');
    else { gbLog('panic: resumed'); try { gbWakeDrain(); } catch (_) {} }
    try { updateStatus(); } catch (_) {}
    return { ok: true, reason: stillPaused ? (info.reason || '?') : '' };
  }
  function automationPaused(reasonOut) {
    if (panicUntil && Date.now() < panicUntil) {
      if (reasonOut) reasonOut.reason = 'panic';
      return true;
    }
    if (panicNeedsClear) {
      if (reasonOut) reasonOut.reason = 'panic-grace';
      return true;
    }
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
      const inNight = a === b ? false : (a < b ? (h >= a && h < b) : (h >= a || h < b));
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
  // One pool, three admission caps. A background scraper and a timed bridge post
  // are not worth the same slot: before this, a farm sweep could eat the whole
  // minute and the free-instant post that had to land inside a ~10s window came
  // back `budget`. Actions keep the full pool, reads sit just under it, scrapes
  // are capped well below so they can never starve the other two.
  const REQ_SCOPE_FRACTION = { scrape: 0.6, read: 0.85, action: 1 };
  function reqBudgetPool() { return state.reqBudgetPerMin || 40; }
  function reqBudgetCap(scope) {
    const f = REQ_SCOPE_FRACTION[scope] != null ? REQ_SCOPE_FRACTION[scope] : 1;
    return Math.max(1, Math.floor(reqBudgetPool() * f));
  }
  function reqBudgetOk(scope) {
    const now = Date.now();
    const cutoff = now - 60000;
    while (reqBudgetHead < reqBudgetWindow.length && reqBudgetWindow[reqBudgetHead].t < cutoff) reqBudgetHead++;
    if (reqBudgetHead > 64) {
      reqBudgetWindow.splice(0, reqBudgetHead);
      reqBudgetHead = 0;
    }
    return (reqBudgetWindow.length - reqBudgetHead) < reqBudgetCap(scope);
  }
  // Tab wake / bfcache resume fires every clamped timer at once. Serialize that
  // catch-up burst instead of letting it stampede the server.
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
      if (!gbInstanceAlive()) { gbWakeDraining = false; return; }
      if (!gbWakeQueue.length) { gbWakeDraining = false; return; }
      if (automationPaused({})) {
        gbLogT('wake-paused', 60000, 'wake: paused - draining later');
        gbWakeDraining = false;
        return;
      }
      // Scope-neutral on purpose: wake entries are heterogeneous (ibScan,
      // orchTick, farmTick, report catch-up) and carry no scope, so the real
      // admission decision belongs to the gbXhr / txRun call inside item.fn.
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
  // A long gap between ticks means the tab was frozen, not idle.
  function gbWakeGapTick() {
    const now = Date.now();
    const gap = now - gbWakeLastTickAt;
    gbWakeLastTickAt = now;
    if (gap > 45000) gbWakeMarkResume('timer-gap ' + Math.round(gap / 1000) + 's');
  }
  // ---------- cave iron reserve (culture must not drain the cave stash) ----------
  const CAVE_SOON_MS = 15 * 60 * 1000;
  const cultureCaveDeferCount = Object.create(null); // townId -> consecutive defers
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
        if (p && p.iron != null && p.iron > 100) ironPerSec = +p.iron / 3600; // per-hour
        else if (p && p.iron != null) ironPerSec = +p.iron; // already per-sec
      }
    } catch (_) {}
    // Unreadable production is "unknown", not "no": let culture proceed.
    if (!(ironPerSec > 0)) return { reserved: false, etaMs: null, blind: true };
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
  function reqBudgetMark(scope) {
    reqBudgetWindow.push({ t: Date.now(), s: REQ_SCOPE_FRACTION[scope] != null ? scope : 'action' });
  }
  function reqBudgetUsed(scope) {
    const cutoff = Date.now() - 60000;
    let n = 0;
    for (let i = reqBudgetHead; i < reqBudgetWindow.length; i++) {
      const e = reqBudgetWindow[i];
      if (e.t < cutoff) continue;
      if (scope && e.s !== scope) continue;
      n++;
    }
    return n;
  }
  function reqBudgetByScope() {
    const out = { scrape: 0, read: 0, action: 0 };
    Object.keys(out).forEach(k => { out[k] = reqBudgetUsed(k); });
    return out;
  }
  // Soft ceiling below the hard budget: delay instead of dropping the post.
  function reqBudgetSoftDelayMs() {
    // Delay the write path when its own scope (action) approaches the hard pool.
    // Using un-scoped reqBudgetUsed would let scrape / read noise trigger a write
    // throttle even while the action scope still has room.
    const soft = Math.max(5, Math.floor((state.reqBudgetPerMin || 40) *
      ((state.postsPerMinSoftPct != null ? state.postsPerMinSoftPct : 60) / 100)));
    const used = reqBudgetUsed('action');
    if (used < soft) return 0;
    return Math.min(8000, 400 * (used - soft + 1) + Math.floor(Math.random() * 300));
  }

  // ---------- learned-payload health ----------
  // An invalidated template is a hard block, so it may only ever be charged to
  // the post that actually USES that learned payload. Feature keys are buckets
  // (captcha breaker, config), not payload identities.
  const TPL_HEALTH_FAILS = 5;
  const TPL_HEALTH_STALE_MS = 1800000; // retry a stale template after 30min
  const TPL_FEATURE_MAP = {
    farm: 'claimTpl',
    build: 'ibAction', 'instant-build': 'ibAction', 'instant-research': 'ibActionR',
    attack: 'attackTpl', cancel: 'cancelTpl', hero: 'heroTpl',
    // Separate from attackTpl on purpose: identical payload signature, but a
    // support rejection must never invalidate the attack template (v2.5.7
    // favor precedent, see the comment below).
    support: 'supportTpl',
    spy: 'spyTpl',
    collect: 'collectTpl',
    pttrade: 'ptTradeTpl',
    wonder: 'wonderFavorTpl',
    // favor used attackTpl here, but that meant a favor rejection would
    // invalidate the attack template (identical payload). Favor is currently
    // disabled in src/favor.js; leave it unmapped so re-enable does not
    // poison attackTpl health. When favor gets its own learned payload, add
    // a dedicated `favorTpl` here.
  };
  // Feature `build` carries two different posts: auto-queue `buildUp` (payload is
  // hardcoded - no learned template can be stale) and instant complete (which is
  // the only user of the learned ibAction/ibActionR). Charging buildUp's server
  // rejections to ibAction invalidated it and killed instant build too.
  function tplNameFor(feature, payload) {
    const name = TPL_FEATURE_MAP[feature];
    if (name !== 'ibAction') return name;
    const action = String((payload && payload.action_name) || '');
    if (!action || action === 'buildUp') return null;
    return /^ResearchOrder/.test(String((payload && payload.model_url) || '')) ? 'ibActionR' : 'ibAction';
  }
  // A template is only "learned" when it differs from the constant the caller
  // falls back to, otherwise "hand-click to re-learn" could only ever re-store
  // that same constant.
  // Must match the constant ibActionFor() falls back to, or an unlearned value
  // counts as "learned": hard fails then accrue against the built-in action and
  // tplHealthOk's unlearned-is-healthy branch goes dead.
  const TPL_DEFAULTS = { ibAction: 'buyInstant', ibActionR: 'buyInstant' };
  function tplLearned(name) {
    if (!name) return false;
    if (name === 'farmAction') return true;
    const v = state[name];
    if (!v) return false;
    const def = TPL_DEFAULTS[name];
    return !def || String(v) !== def;
  }
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
  function tplHealthNote(feature, result, payload) {
    tplHealthNoteName(tplNameFor(feature, payload), result);
  }
  function tplHealthNoteName(name, result) {
    if (!name) return;
    if (!tplLearned(name)) return;
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
      h.invalidAt = Date.now();
      gbLog('tpl: ' + name + ' invalidated after ' + h.hardFails + ' hard fails - hand-click to re-learn');
    }
    tplHealthSave();
  }
  function tplHealthOk(name) {
    if (!name) return true;
    const h = state.tplHealth && state.tplHealth[name];
    if (!h || !h.invalidated) return true;
    // Nothing learned means there is no stale payload - the caller falls back to
    // its own constant, so a permanent block here is a dead feature for no gain.
    if (!tplLearned(name)) {
      h.invalidated = false;
      h.hardFails = 0;
      gbLog('tpl: ' + name + ' is the built-in default, not a learned payload - unblocking');
      tplHealthSave();
      return true;
    }
    // Self-heal: without this, the gate blocks the only post that could ever
    // record an 'ok', so a single bad streak killed the feature until a
    // hand-click. Expiry lets it spend one more streak proving it is really dead.
    if (!h.invalidAt || Date.now() - h.invalidAt > TPL_HEALTH_STALE_MS) {
      h.invalidated = false;
      h.hardFails = 0;
      gbLog('tpl: ' + name + ' stale window expired - retrying');
      tplHealthSave();
      return true;
    }
    return false;
  }
  function tplHealthBannerText() {
    const h = state.tplHealth || {};
    const bad = Object.keys(h).filter(k => h[k] && h[k].invalidated);
    if (!bad.length) return '';
    return 'Plantilla obsoleta: ' + bad.join(', ') + ' — haz un clic manual para reaprenderla';
  }
  // Finite numeric config - preserves 0 (unlike `+v || default`).
  function gbCfgNum(v, fallback) {
    const n = +v;
    return Number.isFinite(n) ? n : fallback;
  }
  function captchaLadder() {
    const raw = state.captchaLadder;
    if (Array.isArray(raw) && raw.length >= 1) {
      const nums = raw.map(n => Math.max(1, Math.min(24 * 60, +n || 0))).filter(n => n >= 1);
      if (nums.length) return nums;
    }
    return [5, 15, 60];
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

  // Dry-run aware DOM click. Any feature that clicks the game's own UI must go
  // through this, or state.dryRun silently stops covering that path.
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

  function load(key, fallback) {
    try {
      const scopedCall = String(key).indexOf('@') !== -1;
      if (!scopedCall && WORLD_SCOPED_BASES.has(key)) {
        const wk = wkey(key);
        const v = GM_getValue(wk, null);
        if (v !== null && v !== undefined) return loadValueOk(v, key) ? v : fallback;
        // Legacy global fallback is migration-only. Once this world reaches config v3,
        // never inherit world-specific IDs/plans from another world.
        const migrated = +GM_getValue(wkey(STORE.CONFIG_VER), 0) >= 3;
        if (!migrated) {
          const legacy = GM_getValue(key, null);
          if (legacy !== null && legacy !== undefined) return loadValueOk(legacy, key) ? legacy : fallback;
        }
        return fallback;
      }
      const v = GM_getValue(key, null);
      if (v === null || v === undefined) return fallback;
      return loadValueOk(v, key) ? v : fallback;
    } catch (e) { return fallback; }
  }
  const LOAD_MAX_CHARS = 2 * 1024 * 1024; // refuse corrupt/huge values (~2MB)
  let storageWarnUntil = 0;
  let storageWarnMsg = '';
  let storagePruneBusy = false;
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
  function storageRawSet(k, val) {
    try { GM_setValue(k, val); return true; } catch (_) { return false; }
  }
  // Quota is a write-loss event, not a warning: prune the ring buffers that can
  // afford it and retry the write once.
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
      // checkThresholds stores {key, ts} objects, so a bare `entry < cut` compared
      // an object against a number and was always false - this prune did nothing.
      Object.keys(state.alerted || {}).forEach(k => {
        const e = state.alerted[k];
        const ts = (e && typeof e === 'object') ? +e.ts || 0 : +e || 0;
        if (ts < cut) { delete state.alerted[k]; n++; }
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
    const scope = opts.scope === 'external' ? 'external' : 'game';
    // `scope` decides host gating; `budget` decides which admission cap applies.
    // Default `read`, not `scrape`: report catch-up is time-sensitive intel and
    // must not be throttled alongside a background village sweep.
    const budgetScope = REQ_SCOPE_FRACTION[opts.budget] != null ? opts.budget : 'read';
    const timeout = opts.timeout != null ? opts.timeout : GM_XHR_DEFAULT_TIMEOUT;
    const userOnload = opts.onload;
    const userOnerror = opts.onerror;
    const userOntimeout = opts.ontimeout;
    let handle = null;
    let done = false;
    const failEarly = (err) => {
      if (userOnerror && gbInstanceAlive()) gbTimeout(() => userOnerror({ error: err }), 0);
      return null;
    };
    if (!gbInstanceAlive()) return failEarly('disposed');
    if (scope === 'game') {
      if (!hostEnabled()) return failEarly('disabled');
      if (!reqBudgetOk(budgetScope)) return failEarly('budget');
      reqBudgetMark(budgetScope); // exactly once per real game request
    }
    const drop = () => {
      if (done) return false;
      done = true;
      const i = gbXhrBag.indexOf(handle);
      if (i >= 0) gbXhrBag.splice(i, 1);
      return true;
    };
    const noteCaptchaBody = (txt) => {
      if (scope !== 'game' || !txt || typeof txt !== 'string') return false;
      const snip = txt.slice(0, 4000);
      if (!/captcha/i.test(snip)) return false;
      let data = null;
      try { if (snip[0] === '{' || snip[0] === '[') data = JSON.parse(txt); } catch (_) {}
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
      const clean = Object.assign({}, opts);
      delete clean.scope;
      handle = GM_xmlhttpRequest(Object.assign(clean, {
        timeout,
        onload(res) {
          if (!drop() || !gbInstanceAlive()) return;
          let captcha = false;
          try { captcha = noteCaptchaBody(res && res.responseText); } catch (_) {}
          if (captcha) {
            if (userOnerror) userOnerror({ error: 'captcha', captcha: true, status: res && res.status });
            return;
          }
          if (userOnload) userOnload(res);
        },
        onerror(e) {
          if (!drop() || !gbInstanceAlive()) return;
          if (userOnerror) userOnerror(e);
        },
        ontimeout(e) {
          if (!drop() || !gbInstanceAlive()) return;
          if (userOntimeout) userOntimeout(e);
          else if (userOnerror) userOnerror(e || { error: 'timeout' });
        },
        onabort(e) {
          if (!drop() || !gbInstanceAlive()) return;
          if (typeof opts.onabort === 'function') opts.onabort(e);
        },
      }));
      if (handle) gbXhrBag.push(handle);
      return handle;
    } catch (e) {
      drop();
      if (userOnerror && gbInstanceAlive()) userOnerror({ error: String(e) });
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
    const prev = state.captchaBreakers[feature] || { trips: 0 };
    const ladder = captchaLadder();
    const trips = Math.min((prev.trips || 0) + 1, ladder.length);
    const mins = ladder[trips - 1];
    state.captchaBreakers[feature] = { trips, until: Date.now() + mins * 60000, detail: detail || null };
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
  // "captcha_required":true / captcha_required=1 / "captcha":"<token>" — the
  // key/value shapes, never the bare word.
  const CAPTCHA_TEXT_RE = /["']?captcha(?:_required)?["']?\s*[:=]\s*(?:true\b|1\b|["'][^"']+["'])/i;
  function responseIsCaptcha(data) {
    if (!data) return false;

    let d = data;
    if (typeof d === 'string') {
      // A bare substring match fired on any body that merely mentions the word
      // ("no captcha required here"), pausing a healthy feature for 5/15/60min.
      // Require the flag SHAPE the game itself sets.
      try { d = JSON.parse(d); } catch (_) { return CAPTCHA_TEXT_RE.test(d); }
    }
    if (!d || typeof d !== 'object') return false;
    if (typeof d.json === 'string') {
      try { d = Object.assign({}, d, JSON.parse(d.json)); } catch (_) {}
    } else if (d.json && typeof d.json === 'object') {
      d = Object.assign({}, d, d.json);
    }
    if (d.captcha === true || d.captcha === 1) return true;
    if (typeof d.captcha === 'string' && d.captcha.length) return true;
    // The game itself keys on this exact boolean - GPAjax getWrappedCallback:
    //   success:function(e,i){if(!0===i.captcha_required)CaptchaWindowFactory.openCaptchaWindow(...)
    // A captcha envelope carries no `error`, so responseServerError() sees none
    // either: without this test the post is classified as SUCCESS, the tx commits
    // and the breaker never trips while the bot posts into the captcha wall.
    if (d.captcha_required === true || d.captcha_required === 1) return true;
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


  // ===== Resource Planner (v1.7) ==============================================
  // One economic truth for all write-capable modules. Reservations are persisted
  // on transactions, therefore a timeout/reload cannot make the same resources look
  // available to a second module while the first outcome is still ambiguous.
  const PLANNER_KEYS = ['wood', 'stone', 'iron', 'population'];
  const PLANNER_COMMIT_HOLD_MS = 15000;
