// ==UserScript==
// @name         GrepBot
// @namespace    grepbot
// @version      2.7.1
// @description  Automatizacion de Grepolis: explorar/granjas/construir/comerciar/cultura/reclutar. Los ToS prohiben la automatizacion; riesgo = ban.
// @author       j
// @match        https://*.grepolis.com/*
// @run-at       document-idle
// @noframes
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
    AUTO_CAVE: 'grepbot:auto-cave',
    CAVE_THRESH: 'grepbot:cave-thresh',
    CAVE_TOWNS: 'grepbot:cave-towns',
    IB_ACTION: 'grepbot:ib-action',
    IB_RESEARCH: 'grepbot:ib-research',
    FARM_OPTION_MAP: 'grepbot:farm-option-map',
    FARM_LONG_CLAIMS: 'grepbot:farm-long-claims',
    FARM_LOYALTY_TECH: 'grepbot:farm-loyalty-tech',
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
    CONFIG_VER: 'grepbot:config-ver',
    WONDER_SPENT: 'grepbot:wonder-spent',

    DECISIONS: 'grepbot:decisions',
    DECISION_SKIPS: 'grepbot:decision-skips',
    DECISION_MEM: 'grepbot:decision-memory',
    DRY_RUN: 'grepbot:dry-run',
    EXPORT_REDACT: 'grepbot:export-redact',
    ORCH_ADAPTIVE: 'grepbot:orch-adaptive',
    SERVER_COOLDOWN: 'grepbot:server-cooldown',
    QUEST_CLAIM_FAIL: 'grepbot:quest-claim-fail',
    DODGE_QUEUE: 'grepbot:dodge-queue',
    AUTO_COLLECT: 'grepbot:auto-collect',
    TX_STATE: 'grepbot:tx-state',
    CIRCUITS: 'grepbot:circuits',
    AB_ORDER: 'grepbot:ab-order',
    PLANNER_CFG: 'grepbot:planner-cfg',
    GOAL_PROFILES: 'grepbot:goal-profiles',
    TOWN_GOALS: 'grepbot:town-goals',
    VIRTUAL_QUEUE: 'grepbot:virtual-queue',
    VIRTUAL_QUEUE_OVERRIDES: 'grepbot:virtual-queue-overrides',
    NATIVE_QUEUE: 'grepbot:native-action-queue',
    PREDICT_CFG: 'grepbot:predict-cfg',
    DEFENSE_CFG: 'grepbot:defense-cfg',
    DODGE_RETURNS: 'grepbot:dodge-returns',
    HEALTH: 'grepbot:health',
    CLIENT_FP: 'grepbot:client-fingerprint',
    SAFE_MODE: 'grepbot:safe-mode',
    SIM_CFG: 'grepbot:sim-cfg',
    WHY_LOG: 'grepbot:why-log',
    TPL_HEALTH: 'grepbot:tpl-health',
    CAPTCHA_LADDER: 'grepbot:captcha-ladder',
    POSTS_SOFT_PCT: 'grepbot:posts-soft-pct',
    TAB_FILTERS: 'grepbot:tab-filters',
    ORCH_DEADLOCK: 'grepbot:orch-deadlock',
    TRADE_MAX_HOPS: 'grepbot:trade-max-hops',
    FARM_LOYALTY_SEEN: 'grepbot:farm-loyalty-seen',
    FARM_TEACH_BANNER: 'grepbot:farm-teach-banner',
    LAST_SEEN_TS: 'grepbot:last-seen-ts',
    WATCH_HITS: 'grepbot:watch-hits',
    WONDER_FAVOR_TPL: 'grepbot:wonder-favor-tpl',
    AUTO_WONDER_FAVOR: 'grepbot:auto-wonder-favor',
    AUTO_PT_TRADE: 'grepbot:auto-pt-trade',
    PT_CFG: 'grepbot:pt-cfg',
    PT_TRADE_TPL: 'grepbot:pt-trade-tpl',
    PT_VIEW_URL: 'grepbot:pt-view-url',
    SPELL_COOLDOWN: 'grepbot:spell-cooldown',
  };

  const PRIORITY_ORDER_DEFAULT = ['culture', 'cave', 'build', 'research', 'trade', 'farm',
    'ruraltrade', 'rurallevel', 'recruit', 'merchant', 'pttrade', 'favor', 'wonder'];
  const CONFIG_VER_CURRENT = 10;

  const WORLD_SCOPED_BASES = new Set([
    STORE.FINDINGS, STORE.FARMS, STORE.FARMS_PARSED, STORE.FARM_RES, STORE.SEEN,
    STORE.TOWNS, STORE.TOWN_RES, STORE.THRESH, STORE.ALERTED,
    STORE.NEXT_FARM, STORE.NEXT_TOWNS, STORE.BANDIT_LOG,
    STORE.CSRF, STORE.FARM_ACTION, STORE.COLLECT_TPL, STORE.CLAIM_TPL,
    STORE.IB_ACTION, STORE.IB_ACTION_R, STORE.FARM_OPTION_MAP, STORE.FARM_LOYALTY_TECH, STORE.FARM_SLEEP_DAY,
    STORE.QUEST_REWARDS, STORE.QUEST_HISTORY,
    STORE.ATTACK_TPL, STORE.CANCEL_TPL, STORE.HERO_TPL, STORE.ATTACK_PLAN, STORE.ATTACK_HISTORY, STORE.ATTACK_RECENT, STORE.CAPTCHA,
    STORE.AB_TARGETS, STORE.AB_NEXT, STORE.CAVE_TOWNS,
    STORE.RESEARCH_TARGETS, STORE.CITY_TEMPLATES, STORE.TOWN_GROUPS,
    STORE.MERCHANT_WISH, STORE.FAVOR_CFG, STORE.WONDER_CFG, STORE.WONDER_SPENT,
    STORE.CULTURE_GOLD_SPENT,
    STORE.RECRUIT_TARGETS, STORE.PRIORITY_ORDER,
    STORE.PLAYER_NOTES, STORE.WATCHLIST, STORE.ALLIANCE_NOTES,
    STORE.CAPTCHA_GLOBAL_UNTIL,
    STORE.SERVER_COOLDOWN, STORE.QUEST_CLAIM_FAIL, STORE.DODGE_QUEUE,
    STORE.TX_STATE, STORE.CIRCUITS, STORE.AB_ORDER, STORE.PLANNER_CFG, STORE.GOAL_PROFILES, STORE.TOWN_GOALS, STORE.VIRTUAL_QUEUE, STORE.VIRTUAL_QUEUE_OVERRIDES, STORE.NATIVE_QUEUE, STORE.PREDICT_CFG, STORE.DEFENSE_CFG, STORE.DODGE_RETURNS, STORE.HEALTH, STORE.CLIENT_FP, STORE.SAFE_MODE, STORE.SIM_CFG, STORE.WHY_LOG, STORE.DECISIONS, STORE.DECISION_SKIPS, STORE.CONFIG_VER,
    STORE.FARM_LOYALTY_SEEN, STORE.FARM_TEACH_BANNER,
    STORE.TPL_HEALTH, STORE.LAST_SEEN_TS, STORE.WATCH_HITS, STORE.WONDER_FAVOR_TPL,
    STORE.SPELL_COOLDOWN,
  ]);
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
    culture: 180000,
    trade: 180000,
    'rural-trade': 180000,
    'rural-level': 180000,
    research: 180000,
    merchant: 180000,
    favor: 180000,
    wonder: 180000,
    'wonder-favor': 180000,
    dodge: 180000,
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
    collectAll: load(STORE.COLLECT_ALL, false),
    autoCollect: load(STORE.AUTO_COLLECT, false),
    collectTpl: load(STORE.COLLECT_TPL, null),
    autoBandit: load(STORE.AUTO_BANDIT, false),
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
    panelGeom: load(STORE.PANEL_GEOM, null),
    activeTab: load(STORE.ACTIVE_TAB, 'overview'),
    farmSkipFull: load(STORE.FARM_SKIP_FULL, true),
    farmFullMode: load(STORE.FARM_FULL_MODE, 'any'),
    abAuto: load(STORE.AB_AUTO, false),
    abTargets: load(STORE.AB_TARGETS, null),
    abNextAt: load(STORE.AB_NEXT, {}),
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
    webhookEvents: load(STORE.WEBHOOK_EVENTS, { captcha: true, attack: true, warehouse: false, culture: false }),
    autoMerchant: load(STORE.AUTO_MERCHANT, false),
    merchantWish: load(STORE.MERCHANT_WISH, []),
    autoFavor: load(STORE.AUTO_FAVOR, false),
    favorCfg: load(STORE.FAVOR_CFG, { god: 'athena', unit: 'harpy', thresh: 200, maxConcurrent: 2 }),
    spellCooldown: load(STORE.SPELL_COOLDOWN, {}),
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
    decisions: load(STORE.DECISIONS, []),
    decisionSkips: load(STORE.DECISION_SKIPS, {}),
    decisionMemory: load(STORE.DECISION_MEM, true),
    dryRun: load(STORE.DRY_RUN, false),
    exportRedact: load(STORE.EXPORT_REDACT, true),
    orchAdaptive: load(STORE.ORCH_ADAPTIVE, true),
    txState: load(STORE.TX_STATE, {}),
    circuits: load(STORE.CIRCUITS, {}),
    abOrder: load(STORE.AB_ORDER, null),
    plannerCfg: load(STORE.PLANNER_CFG, { global: { hard: { wood:0, stone:0, iron:0, population:0 }, soft: { wood:0, stone:0, iron:0, population:0 } }, towns: {} }),
    goalProfiles: load(STORE.GOAL_PROFILES, {}),
    townGoals: load(STORE.TOWN_GOALS, {}),
    virtualQueue: load(STORE.VIRTUAL_QUEUE, {}),
    virtualQueueOverrides: load(STORE.VIRTUAL_QUEUE_OVERRIDES, {}),
    nativeQueue: load(STORE.NATIVE_QUEUE, { version: 1, seq: 0, towns: {} }),
    predictCfg: load(STORE.PREDICT_CFG, { horizonHours: 6 }),
    defenseCfg: load(STORE.DEFENSE_CFG, { mode: 'notify', returnMarginSec: 120, smartAuto: false }),
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
    tradeMaxHops: load(STORE.TRADE_MAX_HOPS, 15),
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

      if (!state.txState || typeof state.txState !== 'object' || Array.isArray(state.txState)) state.txState = {};
      if (!state.circuits || typeof state.circuits !== 'object' || Array.isArray(state.circuits)) state.circuits = {};
      if (!Array.isArray(state.abOrder)) state.abOrder = null;

      if (state.attackPlan && Array.isArray(state.attackPlan.sourceTownIds) && state.attackPlan.sourceTownIds.length === 0) {
        state.attackPlan.sourceTownIds = null;
        save(STORE.ATTACK_PLAN, state.attackPlan);
      }

      if (typeof state.autoCollect !== 'boolean') { state.autoCollect = false; save(STORE.AUTO_COLLECT, false); }

      if (state.autoFavor) { state.autoFavor = false; save(STORE.AUTO_FAVOR, false); }
      save(STORE.TX_STATE, state.txState);
      save(STORE.CIRCUITS, state.circuits);
      if (state.abOrder) save(STORE.AB_ORDER, state.abOrder);
      ver = 3;
    }
    if (ver < 4) {

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

      if (!/^buyInstant$/i.test(String(state.ibAction || ''))) state.ibAction = 'buyInstant';
      if (!/^buyInstant$/i.test(String(state.ibActionR || ''))) state.ibActionR = 'buyInstant';
      save(STORE.IB_ACTION, state.ibAction); save(STORE.IB_ACTION_R, state.ibActionR);
      const buildCircuit=state.circuits&&state.circuits.build;
      if(buildCircuit&&/completeInstant|finishInstantly/i.test(String(buildCircuit.lastError||'')))delete state.circuits.build;
      save(STORE.CIRCUITS,state.circuits||{});
      for(const key of Object.keys(state.decisionSkips||{})){const rec=state.decisionSkips[key]||{};if(/completeInstant|finishInstantly/i.test(key)||/^(?:pending|timeout_unknown)|unknown outcome/i.test(String(rec.r||'')))delete state.decisionSkips[key]}
      save(STORE.DECISION_SKIPS,state.decisionSkips||{});
      if(!state.defenseCfg||typeof state.defenseCfg!=='object')state.defenseCfg={mode:'notify',returnMarginSec:120,smartAuto:false};
      if(state.dodgeMode==='auto'&&(!state.defenseCfg.mode||state.defenseCfg.mode==='notify'))state.defenseCfg.mode='safe';
      state.defenseCfg.returnMarginSec=Math.max(0,Math.min(3600,+state.defenseCfg.returnMarginSec||120));
      state.defenseCfg.smartAuto=!!state.defenseCfg.smartAuto;save(STORE.DEFENSE_CFG,state.defenseCfg);
      ver = 10;
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
      if (!gbInstanceAlive()) { gbWakeDraining = false; return; }
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
        if (p && p.iron != null && p.iron > 100) ironPerSec = +p.iron / 3600;
        else if (p && p.iron != null) ironPerSec = +p.iron;
      }
    } catch (_) {}

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
  function reqBudgetMark() { reqBudgetWindow.push(Date.now()); }
  function reqBudgetUsed() {
    const cutoff = Date.now() - 60000;
    let n = 0;
    for (let i = reqBudgetHead; i < reqBudgetWindow.length; i++) if (reqBudgetWindow[i] >= cutoff) n++;
    return n;
  }

  function reqBudgetSoftDelayMs() {
    const soft = Math.max(5, Math.floor((state.reqBudgetPerMin || 40) *
      ((state.postsPerMinSoftPct != null ? state.postsPerMinSoftPct : 60) / 100)));
    const used = reqBudgetUsed();
    if (used < soft) return 0;
    return Math.min(8000, 400 * (used - soft + 1) + Math.floor(Math.random() * 300));
  }

  const TPL_HEALTH_FAILS = 5;
  const TPL_HEALTH_STALE_MS = 1800000;
  const TPL_FEATURE_MAP = {
    farm: 'claimTpl', claim: 'claimTpl',
    build: 'ibAction', 'instant-build': 'ibAction', 'instant-research': 'ibActionR',
    attack: 'attackTpl', cancel: 'cancelTpl', hero: 'heroTpl',
    collect: 'collectTpl',
    pttrade: 'ptTradeTpl',
    wonder: 'wonderFavorTpl',

  };

  function tplNameFor(feature, payload) {
    const name = TPL_FEATURE_MAP[feature];
    if (name !== 'ibAction') return name;
    const action = String((payload && payload.action_name) || '');
    if (!action || action === 'buildUp') return null;
    return /^ResearchOrder/.test(String((payload && payload.model_url) || '')) ? 'ibActionR' : 'ibAction';
  }

  const TPL_DEFAULTS = { ibAction: 'completeInstant', ibActionR: 'completeInstant' };
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
    if (!jrnHard(result)) return;
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

    if (!tplLearned(name)) {
      h.invalidated = false;
      h.hardFails = 0;
      gbLog('tpl: ' + name + ' is the built-in default, not a learned payload - unblocking');
      tplHealthSave();
      return true;
    }

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
  const LOAD_MAX_CHARS = 2 * 1024 * 1024;
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
      if (!reqBudgetOk()) return failEarly('budget');
      reqBudgetMark();
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
    if (d.captcha === true || d.captcha === 1) return true;
    if (typeof d.captcha === 'string' && d.captcha.length) return true;

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

  const PLANNER_KEYS = ['wood', 'stone', 'iron', 'population'];
  const PLANNER_COMMIT_HOLD_MS = 15000;
  function plannerZero() { return { wood:0, stone:0, iron:0, population:0, tradeCap:0 }; }
  function plannerNormCost(v) {
    if (!v || typeof v !== 'object') return null;
    const out = plannerZero();
    let known = false;
    for (const k of PLANNER_KEYS) {
      if (v[k] != null && Number.isFinite(+v[k]) && +v[k] >= 0) { out[k] = +v[k]; known = true; }
    }
    if (v.tradeCap != null && Number.isFinite(+v.tradeCap) && +v.tradeCap >= 0) { out.tradeCap = +v.tradeCap; known = true; }
    return known ? out : null;
  }
  function plannerCfgRoot() {
    if (!state.plannerCfg || typeof state.plannerCfg !== 'object' || Array.isArray(state.plannerCfg)) state.plannerCfg = {};
    if (!state.plannerCfg.global || typeof state.plannerCfg.global !== 'object') state.plannerCfg.global = {};
    for (const mode of ['hard','soft']) {
      if (!state.plannerCfg.global[mode] || typeof state.plannerCfg.global[mode] !== 'object') state.plannerCfg.global[mode] = {};
      for (const k of PLANNER_KEYS) state.plannerCfg.global[mode][k] = Math.max(0, +(state.plannerCfg.global[mode][k] || 0));
    }
    if (!state.plannerCfg.towns || typeof state.plannerCfg.towns !== 'object' || Array.isArray(state.plannerCfg.towns)) state.plannerCfg.towns = {};
    return state.plannerCfg;
  }
  function plannerSaveCfg() { plannerCfgRoot(); save(STORE.PLANNER_CFG, state.plannerCfg); }
  function plannerReservePolicy(townId) {
    const cfg = plannerCfgRoot();
    const tc = cfg.towns[String(townId)] || {};
    const out = { hard: plannerZero(), soft: plannerZero() };
    for (const mode of ['hard','soft']) {
      const g = cfg.global[mode] || {}, t = tc[mode] || {};
      for (const k of PLANNER_KEYS) out[mode][k] = Math.max(0, +(g[k] || 0), +(t[k] || 0));
    }
    try {
      const gr = goalReservePolicy(townId);
      if (gr) for (const mode of ['hard','soft']) for (const k of PLANNER_KEYS) out[mode][k] = Math.max(out[mode][k], +(gr[mode] && gr[mode][k] || 0));
    } catch (_) {}
    return out;
  }
  function plannerLive(townId) {
    const st = townResState(townId);
    const pop = gbTownPop(townId);
    let tradeCap = null;
    try { const t = gbTownModel(townId); if (t && t.getAvailableTradeCapacity) tradeCap = +t.getAvailableTradeCapacity(); } catch (_) {}
    if (!st || st.wood == null || st.stone == null || st.iron == null || pop == null) return null;
    return { wood:+st.wood, stone:+st.stone, iron:+st.iron, population:+pop, cap:+st.cap || 0,
      tradeCap:Number.isFinite(tradeCap) ? tradeCap : null };
  }
  function plannerReservationActive(tx) {
    if (!tx || !tx.reservation || tx.reservation.state === 'released') return false;
    if (/^(planned|precheck|sending|confirming|reconciling|unknown)$/.test(tx.state || '')) return true;
    if (tx.state === 'committed' && +(tx.reservation.holdUntil || 0) > Date.now()) return true;
    return false;
  }
  function plannerPendingForTown(townId, excludeIntent) {
    const id = String(townId), out = { outgoing:plannerZero(), incoming:plannerZero(), intents:[] };
    for (const [intent, tx] of Object.entries(state.txState || {})) {
      if (excludeIntent && intent === excludeIntent) continue;
      if (!plannerReservationActive(tx)) continue;
      const r = tx.reservation || {};
      for (const eff of (r.effects || [])) {
        if (!eff || String(eff.townId) !== id) continue;
        const bucket = eff.direction === 'in' ? out.incoming : out.outgoing;
        const c = plannerNormCost(eff.cost) || plannerZero();
        for (const k of [...PLANNER_KEYS,'tradeCap']) bucket[k] += +(c[k] || 0);
        out.intents.push(intent);
      }
    }
    return out;
  }
  function plannerSnapshot(townId, opts) {
    const live = plannerLive(townId);
    if (!live) return null;
    const policy = plannerReservePolicy(townId);
    const pending = plannerPendingForTown(townId, opts && opts.excludeIntent);
    const hard = {}, soft = {};
    for (const k of PLANNER_KEYS) {
      hard[k] = Math.max(0, live[k] - pending.outgoing[k] - policy.hard[k]);
      soft[k] = Math.max(0, hard[k] - policy.soft[k]);
    }
    const tradeAvail = live.tradeCap == null ? null : Math.max(0, live.tradeCap - pending.outgoing.tradeCap);
    return { townId:String(townId), live, reserve:policy, committed:pending.outgoing, incoming:pending.incoming,
      availableHard:Object.assign({}, hard, {tradeCap:tradeAvail}), availableSoft:Object.assign({}, soft, {tradeCap:tradeAvail}), intents:pending.intents };
  }
  function plannerAvailable(townId, opts) {
    const s = plannerSnapshot(townId, opts);
    if (!s) return null;
    return (opts && opts.allowSoft) ? s.availableHard : s.availableSoft;
  }
  function plannerCanReserve(intent, effects, opts) {
    const list = Array.isArray(effects) ? effects : [];
    if (!list.length) return { ok:true };
    const grouped = {};
    for (const eff of list) {
      if (!eff || eff.direction === 'in') continue;
      const tid = String(eff.townId == null ? '' : eff.townId);
      if (!tid) return { ok:false, why:'planner-town-missing' };
      const c = plannerNormCost(eff.cost);
      if (!c) return { ok:false, why:'planner-cost-unknown' };
      if (!grouped[tid]) grouped[tid] = plannerZero();
      for (const k of [...PLANNER_KEYS,'tradeCap']) grouped[tid][k] += +(c[k] || 0);
    }
    for (const [tid, need] of Object.entries(grouped)) {
      const av = plannerAvailable(tid, { allowSoft:!!(opts && opts.allowSoft), excludeIntent:intent });
      if (!av) return { ok:false, why:`planner-live-unreadable:${tid}` };
      for (const k of PLANNER_KEYS) if ((+need[k] || 0) > (+av[k] || 0)) return { ok:false, why:`planner-${k}:${Math.floor(av[k]||0)}/${Math.ceil(need[k]||0)}` };
      if ((+need.tradeCap || 0) > 0 && (av.tradeCap == null || +need.tradeCap > +av.tradeCap)) return { ok:false, why:`planner-tradeCap:${av.tradeCap}/${need.tradeCap}` };
    }
    return { ok:true };
  }
  function plannerEffect(feature, transport, endpoint, data, snapshot) {
    const d = data || {}, a = transport === 'bridge' ? (d.arguments || {}) : d;
    const townId = d.town_id != null ? d.town_id : a.town_id;
    const effects = [];
    const out = (tid,c) => { const n=plannerNormCost(c); if(n) effects.push({townId:String(tid),direction:'out',cost:n}); };
    const inc = (tid,c) => { const n=plannerNormCost(c); if(n) effects.push({townId:String(tid),direction:'in',cost:n}); };
    try {
      if (feature === 'build' && a.building_id && a.order_id == null) {
        const c = abBuildingCost(townId, a.building_id); if (!c) return null; out(townId,c);
      } else if (feature === 'research') {
        const tech=a.id||a.research_id||a.research||a.research_type, c=researchCost(tech); if(!c) return null; out(townId,c);
      } else if (feature === 'recruit') {
        const unit=a.unit_id||a.unit_type, n=+a.amount||0, def=recruitUnitDef(unit); if(!def||!def.resources||!(n>0)) return null;
        out(townId,{wood:(+def.resources.wood||0)*n,stone:(+def.resources.stone||0)*n,iron:(+def.resources.iron||0)*n,population:(+def.population||0)*n});
      } else if (feature === 'trade') {
        const c={wood:+a.wood||0,stone:+a.stone||0,iron:+a.iron||0,tradeCap:(+a.wood||0)+(+a.stone||0)+(+a.iron||0)};
        out(townId,c); if(a.id!=null) inc(a.id,c);
      } else if (feature === 'wonder') {
        out(townId,{wood:+a.wood||0,stone:+a.stone||0,iron:+a.iron||0,tradeCap:(+a.wood||0)+(+a.stone||0)+(+a.iron||0)});
      } else if (feature === 'cave') {
        out(townId,{iron:+a.iron_to_store||0});
      } else return [];
    } catch (_) { return null; }
    return effects;
  }
  function plannerHold(tx, effects) {
    if (!tx) return {ok:false,why:'no-tx'};
    const chk=plannerCanReserve(tx.intent,effects,{allowSoft:false});
    if(!chk.ok) return chk;
    tx.reservation={state:'held',effects:effects||[],createdAt:Date.now(),holdUntil:0};
    txSave(); return {ok:true};
  }
  function plannerRelease(tx, why) {
    if(!tx||!tx.reservation) return;
    tx.reservation.state='released'; tx.reservation.releasedAt=Date.now(); tx.reservation.releaseWhy=why||''; txSave();
  }
  function plannerCommit(tx) {
    if(!tx||!tx.reservation) return;
    tx.reservation.state='committed'; tx.reservation.committedAt=Date.now(); tx.reservation.holdUntil=Date.now()+PLANNER_COMMIT_HOLD_MS; txSave();
  }
  const planner = {
    snapshot: plannerSnapshot,
    available: plannerAvailable,
    reserve(intent, effects, opts){ const fake={intent}; const c=plannerCanReserve(intent,effects,opts); return c.ok?{ok:true,effects}:c; },
    release(intent){ const tx=state.txState&&state.txState[intent]; if(tx) plannerRelease(tx,'api'); },
    commit(intent){ const tx=state.txState&&state.txState[intent]; if(tx) plannerCommit(tx); },
    setReserve(townId, mode, values){ const cfg=plannerCfgRoot(); const root=townId==null?cfg.global:(cfg.towns[String(townId)]||(cfg.towns[String(townId)]={})); root[mode==='soft'?'soft':'hard']=Object.assign({},root[mode==='soft'?'soft':'hard']||{},values||{}); plannerSaveCfg(); },
  };
  try { GB_ROOT.__grepbotPlanner = planner; } catch (_) {}

  function clientFingerprintNow() {
    const uw=gameUw(), bs=gameBridgeStatus(); let cols=[];
    try{const c=uw.MM&&uw.MM.getCollections&&uw.MM.getCollections();if(c)cols=Object.keys(c).sort().filter(k=>/Town|Order|Movement|Research|Quest|Hero|Farm/i.test(k)).slice(0,80)}catch(_){}
    const unitN=uw.GameData&&uw.GameData.units?Object.keys(uw.GameData.units).length:0, buildN=uw.GameData&&uw.GameData.buildings?Object.keys(uw.GameData.buildings).length:0, researchN=uw.GameData&&uw.GameData.researches?Object.keys(uw.GameData.researches).length:0;
    return {required:{MM:!!bs.MM,gpAjax:!!bs.gpAjax,ITowns:!!bs.ITowns,GameData:!!bs.GameData},counts:{units:unitN,buildings:buildN,researches:researchN},collections:cols};
  }
  function clientFingerprintCompatible(prev,cur){if(!cur)return{ok:false,why:'fingerprint-unreadable'};for(const k of ['MM','gpAjax','ITowns','GameData'])if(!cur.required[k])return{ok:false,why:`missing-${k}`};if(!prev)return{ok:true,first:true};for(const k of ['MM','gpAjax','ITowns','GameData'])if(prev.required&&prev.required[k]&&!cur.required[k])return{ok:false,why:`lost-${k}`};for(const k of ['units','buildings']){const a=+(prev.counts&&prev.counts[k]||0),b=+(cur.counts&&cur.counts[k]||0);if(a>0&&b>0&&Math.abs(b-a)/a>0.45)return{ok:false,why:`${k}-shape-changed:${a}->${b}`}}return{ok:true}}
  function clientFingerprintCheck() {const cur=clientFingerprintNow(),cmp=clientFingerprintCompatible(state.clientFingerprint,cur);if(!cmp.ok){state.safeMode=true;save(STORE.SAFE_MODE,true);gbLog(`SAFE MODE: Grepolis client compatibility check failed (${cmp.why})`);whyNote('system','client fingerprint','blocked',cmp.why);}else if(!state.clientFingerprint){state.clientFingerprint=cur;save(STORE.CLIENT_FP,cur);}else{state.clientFingerprint=cur;save(STORE.CLIENT_FP,cur);}return{current:cur,check:cmp}}
  function safeModeBlock(feature,transport,endpoint,data){if(!state.safeMode)return null;const f=String(feature||'');if(['attack','favor','wonder','rurallevel','merchant','spell'].includes(f))return 'safe-mode-high-impact';if(f==='culture'){const a=transport==='bridge'?(data&&data.arguments||{}):(data||{});if(/olympic/i.test(String(a.celebration_type||endpoint||'')))return 'safe-mode-premium';}return null}

  const CIRCUIT_TRIP = 3;
  const CIRCUIT_STRUCTURAL_RE = /unknown.?action|invalid.?action|unknown.?model|model.?not.?found|unknown.?controller|controller.?not.?found|no.?such.?action|does.?not.?exist|unsupported.?action|invalid.?model|endpoint.?not.?found/i;
  function circuitSave() { save(STORE.CIRCUITS, state.circuits || {}); }
  function circuitState(feature) {
    if (!state.circuits || typeof state.circuits !== 'object') state.circuits = {};
    return state.circuits[feature] || null;
  }
  function circuitOpen(feature) {
    const c = circuitState(feature);
    return !!(c && c.open);
  }
  function circuitNote(feature, err) {
    if (!feature || !err || err === 'timeout' || err === 'timeout_unknown' || err === 'captcha' || err === 'captcha-pause') return;
    const msg = String(err);
    if (!CIRCUIT_STRUCTURAL_RE.test(msg)) return;
    const c = circuitState(feature) || { strikes: 0, open: false };
    c.strikes = (c.strikes || 0) + 1;
    c.lastError = msg.slice(0, 160);
    c.lastAt = Date.now();
    if (c.strikes >= CIRCUIT_TRIP) {
      c.open = true;
      c.openedAt = Date.now();
      gbLog(`CIRCUIT OPEN: ${feature} disabled after ${c.strikes} structural errors: ${c.lastError}`);
      try { flash(`circuit: ${feature} disabled`); } catch (_) {}
    }
    state.circuits[feature] = c;
    circuitSave();
  }
  function circuitSuccess(feature) {
    const c = circuitState(feature);
    if (!c || c.open || !c.strikes) return;
    c.strikes = 0;
    c.lastError = '';
    state.circuits[feature] = c;
    circuitSave();
  }
  function circuitClear(feature) {
    if (feature) delete state.circuits[feature];
    else state.circuits = {};
    circuitSave();
  }

  const TX_WRITE_FEATURES = new Set([
    'farm', 'collect', 'bandit', 'build', 'instant-build', 'instant-research', 'cave', 'culture', 'trade', 'ruraltrade', 'rurallevel',
    'research', 'merchant', 'favor', 'wonder', 'militia', 'dodge', 'spell', 'recruit', 'quest', 'attack',
    'cancel', 'hero', 'pttrade'
  ]);
  const TX_TERMINAL_TTL = 30 * 60 * 1000;
  const TX_INSTANT_TOMBSTONE_TTL = 24 * 60 * 60 * 1000;
  const TX_UNKNOWN_RECHECK_MS = 60 * 1000;
  const TX_UNKNOWN_MAX_MS = 6 * 60 * 60 * 1000;
  let txSeq = 0;
  if (!state.txState || typeof state.txState !== 'object' || Array.isArray(state.txState)) state.txState = {};
  (function txLoadNormalize() {
    const now = Date.now();
    for (const key of Object.keys(state.txState)) {
      const t = state.txState[key];
      if (!t || typeof t !== 'object') { delete state.txState[key]; continue; }
      if (t.state === 'sending' || t.state === 'confirming' || t.state === 'reconciling') {
        t.state = 'unknown';
        t.unknownAt = t.unknownAt || now;
        t.detail = 'reloaded while in-flight';
      }
      const terminal = /^(committed|failed|aborted|dryrun)$/.test(t.state || '');
      const terminalTtl=t.state==='committed'&&t.snapshot&&t.snapshot.kind==='instant'?TX_INSTANT_TOMBSTONE_TTL:TX_TERMINAL_TTL;
      if (terminal && now - (+t.updatedAt || +t.createdAt || 0) > terminalTtl) delete state.txState[key];
      if (t.state === 'unknown' && now - (+t.unknownAt || +t.updatedAt || 0) > TX_UNKNOWN_MAX_MS) {

        t.state = 'manual-review';
        t.detail = 'unknown outcome expired; manual review required';
        t.updatedAt = now;
      }
    }
    save(STORE.TX_STATE, state.txState);
  })();
  function txSave() { save(STORE.TX_STATE, state.txState); }
  function txRecentlyCommitted(intent, maxAgeMs) {
    const t = state.txState && state.txState[intent];
    return !!(t && t.state === 'committed' && Date.now() - (+t.updatedAt || +t.createdAt || 0) < Math.max(1000, +maxAgeMs || 60000));
  }
  function txPrune() {
    const now = Date.now();
    let changed = false;
    for (const key of Object.keys(state.txState)) {
      const t = state.txState[key];
      if (!t) { delete state.txState[key]; changed = true; continue; }
      if(t.state==='unknown'&&now-(+t.unknownAt||+t.updatedAt||0)>TX_UNKNOWN_MAX_MS){t.state='manual-review';t.detail='unknown outcome expired; manual review required';t.updatedAt=now;changed=true;continue}
      const terminalTtl=t.state==='committed'&&t.snapshot&&t.snapshot.kind==='instant'?TX_INSTANT_TOMBSTONE_TTL:TX_TERMINAL_TTL;
      if (/^(committed|failed|aborted|dryrun)$/.test(t.state || '') && now - (+t.updatedAt || +t.createdAt || 0) > terminalTtl) { delete state.txState[key]; changed = true; }
    }
    return changed;
  }
  function txDispose() {
    const now = Date.now();
    for (const key of Object.keys(state.txState || {})) {
      const t = state.txState[key];
      if (!t) continue;
      if (t.owner === GB_INSTANCE_ID && /^(sending|confirming|reconciling)$/.test(t.state || '')) {
        t.state = 'unknown';
        t.unknownAt = now;
        t.updatedAt = now;
        t.detail = 'instance disposed while in-flight';
      }
    }
    txSave();
  }
  function txClearUnknown() {
    for (const key of Object.keys(state.txState || {})) {
      if (state.txState[key] && /^(unknown|manual-review)$/.test(state.txState[key].state || '')) {
        try{if(state.txState[key].snapshot&&state.txState[key].snapshot.kind==='quest')questClearReviewForTx(state.txState[key])}catch(_){}
        state.txState[key].state = 'aborted';
        state.txState[key].updatedAt = Date.now();
        state.txState[key].detail = 'manually cleared';
        plannerRelease(state.txState[key], 'manual-clear');
      }
    }
    txSave();
  }
  function txStableObj(obj) {
    const out = {};
    Object.keys(obj || {}).sort().forEach(k => {
      const v = obj[k];
      if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') out[k] = v;
    });
    return out;
  }
  function txUnitSignature(args) {
    const skip = new Set(['id', 'town_id', 'type', 'nl_init', 'order_id', 'farm_town_id', 'option', 'celebration_type', 'unit_id', 'amount', 'power_id', 'progressable_id']);
    const o = {};
    for (const k of Object.keys(args || {}).sort()) {
      if (skip.has(k)) continue;
      const n = +(args[k]);
      if (Number.isFinite(n) && n > 0) o[k] = n;
    }
    return JSON.stringify(o);
  }
  function txTownResourceSnap(townId) {
    const st = townResState(townId);
    let tradeCap = null;
    try {
      const t = gbTownModel(townId);
      if (t && t.getAvailableTradeCapacity) tradeCap = +t.getAvailableTradeCapacity();
    } catch (_) {}
    return st ? { wood: st.wood, stone: st.stone, iron: st.iron, cap: st.cap, tradeCap } : null;
  }
  function txUnitStatus(townId, unit) {
    const t = gbTownModel(townId);
    if (!t) return null;
    let have = null, queued = 0;
    try { const u=t.units&&t.units(),o=t.unitsOuter&&t.unitsOuter();if(u)have=(+u[unit]||0)+(o?(+o[unit]||0):0); } catch (_) {}
    try {
      const col = t.getUnitOrdersCollection && t.getUnitOrdersCollection();
      for (const m of ((col && col.models) || [])) {
        const a = m.attributes || {};
        const uid = a.unit_type || a.unit_id || a.type;
        if (String(uid) === String(unit)) queued += +(a.count != null ? a.count : (a.amount != null ? a.amount : a.units)) || 0;
      }
    } catch (_) {}
    return have == null ? null : { have, queued, total: have + queued };
  }
  function txResearchStatus(townId, tech) {
    try {
      const info = researchTownTechs(townId);
      if (!info) return null;
      let queued = false;
      for (const o of info.orders || []) {
        const id = researchOrderTechId(o);
        if (String(id) === String(tech)) { queued = true; break; }
      }
      return { done: !!(info.techs && info.techs[tech]), queued };
    } catch (_) { return null; }
  }
  function txBuildStatus(townId, building) {
    try {
      const levels = abCurrentLevels(townId);
      const q = abQueueInfo(townId);
      if (!levels || !q) return null;
      return { projectedLevel: +(levels[building] || 0), queueLen: q.len };
    } catch (_) { return null; }
  }
  function txFarmStatus(farmId) {
    try {
      const f = (farmsFromGame() || []).find(x => String(x.vill_id) === String(farmId));
      return f ? { lootableAt: f.lootable_at == null ? null : +f.lootable_at } : null;
    } catch (_) { return null; }
  }
  function txMovementCount(origin, dest, mission) {
    try {
      const uw = gameUw();
      const col = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('MovementsUnits');
      if (!col || !col.models) return null;
      let n = 0;
      for (const m of col.models) {
        const a = m.attributes || {};
        const o = String(a.origin_town_id || a.home_town_id || a.town_id || '');
        const d = String(a.destination_town_id || a.target_town_id || a.target_id || '');
        const typ = String(a.command_name || a.type || a.movement_type || '').toLowerCase();
        if (origin != null && o !== String(origin)) continue;
        if (dest != null && d !== String(dest)) continue;
        if (mission && typ && !typ.includes(String(mission).toLowerCase())) continue;
        n++;
      }
      return n;
    } catch (_) { return null; }
  }
  function txCommandStatus(commandId) {
    try {
      const id = String(commandId == null ? '' : commandId);
      if (!id) return null;
      const uw = gameUw();
      const models = [];
      const seen = new Set();
      const push = (m) => {
        if (!m) return;
        const a = m.attributes || {};
        const mid = (typeof m.getCommandId === 'function' && m.getCommandId()) || a.command_id || a.id || m.id;
        const key = String(mid == null ? '' : mid);
        if (!key || seen.has(key)) return;
        seen.add(key); models.push(m);
      };
      try {
        const col = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('MovementsUnits');
        if (col && col.models) col.models.forEach(push);
      } catch (_) {}
      try {
        const cols = uw.MM && uw.MM.getCollections && uw.MM.getCollections().MovementsUnits;
        (Array.isArray(cols) ? cols : (cols ? [cols] : [])).forEach(c => { if (c && c.models) c.models.forEach(push); });
      } catch (_) {}
      const hit = models.find(m => {
        const a = m.attributes || {};
        const mid = (typeof m.getCommandId === 'function' && m.getCommandId()) || a.command_id || a.id || m.id;
        return String(mid) === id;
      });
      if (!hit) return { exists: false };
      const a = hit.attributes || {};
      let cancelable = null;
      try { if (typeof hit.isCancelable === 'function') cancelable = !!hit.isCancelable(); } catch (_) {}
      if (cancelable == null && a.cancelable != null) cancelable = a.cancelable === true || a.cancelable === 1;
      return { exists: true, cancelable };
    } catch (_) { return null; }
  }
  function txHeroStatus(heroType) {
    try {
      if (typeof playerHeroesList !== 'function') return null;
      const h = playerHeroesList().find(x => String(x.type) === String(heroType));
      if (!h) return { exists: false };
      return {
        exists: true, type: h.type, home: h.home == null ? null : +h.home, origin: h.origin == null ? null : +h.origin,
        traveling: !!h.traveling, assigned: !!h.assigned, attacking: !!h.attacking, injured: !!h.injured, status: h.status || '',
      };
    } catch (_) { return null; }
  }
  function txMilitiaCount(townId) {
    try { const t = gbTownModel(townId); const u = t && t.units && t.units(); return u ? (+u.militia || 0) : null; } catch (_) { return null; }
  }
  function txSpellPresent(townId, powerId) {
    try { return recruitHasSpell(townId, powerId); } catch (_) { return null; }
  }
  function txQuestClaimable(qid) {
    try {
      const q = questsFromGame().find(x => String(x.questId) === String(qid) || String(x.progressableId) === String(qid));
      if (q) return q.claimStateKnown ? !!q.canClaim : null;
      const c = state.questRewards && (state.questRewards[qid] || Object.values(state.questRewards).find(x=>x&&(String(x.questId)===String(qid)||String(x.progressableId)===String(qid))));
      return c && c.claimStateKnown ? !!c.canClaim : null;
    } catch (_) { return null; }
  }
  function txCaveStatus(townId) {
    try { const i = caveTownInfo(townId); return i ? { iron: i.iron, stored: i.stored, hideCap: i.hideCap, unlimited: i.unlimited } : null; } catch (_) { return null; }
  }
  function txBanditStatus() {
    try {
      const uw = gameUw();
      const m = uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('PlayerAttackSpot');
      const a = m && (m.attributes || m);
      if (!a) return null;
      return {
        stage: a.stage != null ? a.stage : a.current_stage,
        cooldown: a.cooldown != null ? a.cooldown : (a.next_attack_at != null ? a.next_attack_at : a.attack_at),
        reward: a.reward_available != null ? !!a.reward_available : (a.can_collect != null ? !!a.can_collect : null),
      };
    } catch (_) { return null; }
  }
  function txCultureStatus(townId, type) {
    try {
      const uw = gameUw();
      const models = uw.MM && uw.MM.getModels && uw.MM.getModels().Celebration;
      if (!models) return null;
      let count = 0;
      for (const c of Object.values(models)) {
        const a = (c && c.attributes) || {};
        if (String(a.town_id) === String(townId) && (!type || String(a.celebration_type) === String(type))) count++;
      }
      return { count, gold: gbPlayerGold(), res: txTownResourceSnap(townId) };
    } catch (_) { return null; }
  }
  function txMerchantStatus(offerId) {
    try {
      const uw = gameUw();
      let model = null;
      for (const name of ['PhoenicianSalesmanOffer', 'MerchantOffer', 'PremiumExchangeOffer']) {
        const col = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName(name);
        if (!col || !col.models) continue;
        model = col.models.find(m => String((m.attributes || {}).id ?? m.id) === String(offerId));
        if (model) break;
      }
      if (!model) return { exists: false, gold: gbPlayerGold(), price: null };
      const a = model.attributes || model;
      const price = Number(a.price != null ? a.price : a.gold);
      return { exists: true, gold: gbPlayerGold(), price: Number.isFinite(price) ? price : null };
    } catch (_) { return null; }
  }
  function txPtTradeStatus(townId, offerId) {
    try {
      const uw = gameUw();
      let model = null;
      const tryCols = ['PhoenicianSalesmanOffer', 'MerchantOffer', 'PremiumExchangeOffer'];
      for (const name of tryCols) {
        const col = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName(name);
        if (!col || !col.models) continue;
        model = col.models.find(m => {
          const a = m.attributes || m;
          if (offerId != null && String(a.id ?? m.id) !== String(offerId)) return false;
          if (townId != null && a.town_id != null && String(a.town_id) !== String(townId)) return false;
          return true;
        });
        if (model) break;
      }
      const before = txTownResourceSnap(townId);
      const tradeCap = (function () {
        try { const t = gbTownModel(townId); return t && t.getAvailableTradeCapacity ? +t.getAvailableTradeCapacity() : null; } catch (_) { return null; }
      })();
      if (!model) return { exists: false, tradeCap, res: before };
      const a = model.attributes || model;
      const amount = Number(a.amount != null ? a.amount : a.trade_amount != null ? a.trade_amount : a.current_amount);
      return { exists: true, tradeCap, res: before, amount: Number.isFinite(amount) ? amount : null };
    } catch (_) { return null; }
  }
  function txCapture(feature, transport, endpoint, data) {
    const d = data || {};
    const a = transport === 'bridge' ? (d.arguments || {}) : d;
    const townId = d.town_id != null ? d.town_id : a.town_id;
    try {
      if (feature === 'build' || feature === 'instant-build' || feature === 'instant-research') {
        if (a.order_id != null) {
          const orderKind=feature==='instant-research'?'research':'build';
          return { kind:'instant', orderKind, orderId:String(a.order_id), present:ibOrderStillPresent(a.order_id,orderKind) };
        }
        if (a.building_id) {
          const st = txBuildStatus(townId, a.building_id);
          return { kind: 'build', building: a.building_id, status: st, targetLevel: st ? st.projectedLevel + 1 : null };
        }
      }
      if (feature === 'research') return { kind: 'research', tech: a.id || a.research_id || a.research || a.research_type, status: txResearchStatus(townId, a.id || a.research_id || a.research || a.research_type) };
      if (feature === 'recruit') return { kind: 'recruit', unit: a.unit_id || a.unit_type, amount: +a.amount || 0, status: txUnitStatus(townId, a.unit_id || a.unit_type) };
      if (feature === 'farm') return { kind: 'farm', farmId: a.farm_town_id, status: txFarmStatus(a.farm_town_id) };
      if (feature === 'trade') return { kind: 'trade', source: txTownResourceSnap(townId), target: txTownResourceSnap(a.id), total: (+a.wood || 0) + (+a.stone || 0) + (+a.iron || 0) };
      if (feature === 'collect') return { kind: 'collect', before: txTownResourceSnap(townId) };
      if (feature === 'cave') return { kind: 'cave', before: txCaveStatus(townId), amount: +a.iron_to_store || 0 };
      if (feature === 'militia') return { kind: 'militia', before: txMilitiaCount(townId) };
      if (feature === 'spell') return { kind: 'spell', powerId: a.power_id, before: txSpellPresent(townId, a.power_id) };
      if (feature === 'quest') return { kind: 'quest', qid: a.progressable_id || String(d.model_url || '').split('/').pop(), before: txQuestClaimable(a.progressable_id || String(d.model_url || '').split('/').pop()) };
      if (feature === 'attack' || feature === 'dodge' || feature === 'favor') return { kind: 'movement', before: txMovementCount(townId, a.id, a.type), dest: a.id, mission: a.type };
      if (feature === 'cancel') {
        const commandId = a.id != null ? a.id : a.command_id;
        return { kind: 'cancel', commandId: String(commandId == null ? '' : commandId), before: txCommandStatus(commandId) };
      }
      if (feature === 'hero') {
        const heroType = a.type || a.hero_type || a.hero;
        return { kind: 'hero', action: String(endpoint || '').split('/').pop(), heroType: String(heroType || ''), targetTownId: a.target_town_id != null ? +a.target_town_id : (a.town_id != null ? +a.town_id : null), before: txHeroStatus(heroType) };
      }
      if (feature === 'wonder') return { kind: 'wonder', before: txTownResourceSnap(townId) };
      if (feature === 'bandit') {
        const action = String(endpoint || '').split('/').pop();
        const before = txBanditStatus();
        if (action === 'attack') {
          const movement = banditMovementEvidence(gameUw(), townId);
          return {
            kind: 'bandit-attack', action, before,
            beforeMovementCount: movement.known ? movement.count : null,
            beforeTownMovementCount: movement.known ? movement.townCount : null,
          };
        }
        return { kind: 'bandit', action, before };
      }
      if (feature === 'culture') {
        const typ = a.celebration_type || endpoint;
        return { kind: 'culture', type: typ, before: txCultureStatus(townId, typ) };
      }
      if (feature === 'merchant') {
        const offerId = a.offer_id || a.offer || String(d.model_url || '').split('/').pop();
        return { kind: 'merchant', offerId, before: txMerchantStatus(offerId) };
      }
      if (feature === 'pttrade') {
        const offerId = a.offer_id || a.offer || (d.model_url && String(d.model_url).split('/').pop());
        return { kind: 'pttrade', offerId, townId, before: txPtTradeStatus(townId, offerId) };
      }
      if (feature === 'rurallevel') {
        const relId = String(d.model_url || '').split('/').pop();
        let status = null;
        try {
          const rel = ruralRelModels().find(r => String((r.attributes || {}).id || r.id) === relId);
          const x = rel && (rel.attributes || {});
          if (x) status = { relation: +x.relation_status || 0, stage: +x.expansion_stage || 0, expansionAt: x.expansion_at || null };
        } catch (_) {}
        return { kind: 'rurallevel', relId, status };
      }
      if (feature === 'ruraltrade') return { kind: 'ruraltrade', before: txTownResourceSnap(townId), farmId: a.farm_town_id };
    } catch (_) {}
    return { kind: 'generic' };
  }
  function txIntent(feature, transport, endpoint, data, snap) {
    const d = data || {};
    const a = transport === 'bridge' ? (d.arguments || {}) : d;
    const townId = d.town_id != null ? d.town_id : a.town_id;
    if (feature === 'build' || feature === 'instant-build' || feature === 'instant-research') {
      if (a.order_id != null) return `instant:${townId}:${feature==='instant-research'?'research':'build'}:${a.order_id}`;
      return `build:${townId}:${a.building_id || '?'}:${snap && snap.targetLevel != null ? snap.targetLevel : '?'}`;
    }
    if (feature === 'research') return `research:${townId}:${a.id || a.research_id || a.research || a.research_type || '?'}`;
    if (feature === 'recruit') {
      const u = a.unit_id || a.unit_type || '?';
      const before = snap && snap.status ? snap.status.total : '?';
      return `recruit:${townId}:${u}:${before}+${+a.amount || 0}`;
    }
    if (feature === 'trade') return `trade:${townId}:${a.id}:${+a.wood || 0}:${+a.stone || 0}:${+a.iron || 0}`;
    if (feature === 'farm') return `farm:${townId}:${a.farm_town_id}:${a.option}`;
    if (feature === 'collect') return `collect:${townId}:${endpoint}`;
    if (feature === 'cave') return `cave:${townId}:${+a.iron_to_store || 0}`;
    if (feature === 'militia') return `militia:${townId}`;
    if (feature === 'spell') return `spell:${townId}:${a.power_id || '?'}`;
    if (feature === 'quest') return `quest:${a.progressable_id || String(d.model_url || '').split('/').pop() || '?'}`;
    if (feature === 'attack' || feature === 'dodge' || feature === 'favor') return `${feature}:${townId}:${a.id || '?'}:${a.type || '?'}:${txUnitSignature(a)}`;
    if (feature === 'cancel') return `cancel:${a.id != null ? a.id : (a.command_id != null ? a.command_id : '?')}`;
    if (feature === 'hero') return `hero:${String(endpoint || '?').split('/').pop()}:${a.type || a.hero_type || a.hero || '?'}:${a.target_town_id != null ? a.target_town_id : (a.town_id != null ? a.town_id : '-')}`;
    if (feature === 'wonder') return `wonder:${townId}:${a.id || a.wonder_id || '?'}:${+a.wood || 0}:${+a.stone || 0}:${+a.iron || 0}`;
    if (feature === 'bandit') return `bandit:${townId}:${endpoint}`;
    if (feature === 'rurallevel' || feature === 'ruraltrade') return `${feature}:${townId}:${a.farm_town_id || String(d.model_url || '').split('/').pop()}:${endpoint}`;
    if (feature === 'culture') return `culture:${townId}:${a.celebration_type || endpoint}`;
    if (feature === 'merchant') return `merchant:${townId}:${a.offer_id || a.offer || a.id || endpoint}`;
    if (feature === 'pttrade') return `pttrade:${townId || '-'}:${a.offer_id || a.offer || (d.model_url ? String(d.model_url).split('/').pop() : '') || endpoint}`;
    return `${feature}:${townId || '-'}:${endpoint}:${JSON.stringify(txStableObj(a)).slice(0, 100)}`;
  }
  function txReconcileNow(tx) {
    const s = tx.snapshot || {};
    const meta = tx.meta || {};
    try {
      if (s.kind === 'instant') return ibOrderStillPresent(s.orderId,s.orderKind) ? 'unknown' : 'applied';
      if (s.kind === 'build') {
        const cur = txBuildStatus(meta.townId, s.building);
        if (!cur || s.targetLevel == null) return 'unknown';
        if (cur.projectedLevel >= s.targetLevel) return 'applied';
        return 'unchanged';
      }
      if (s.kind === 'research') {
        const cur = txResearchStatus(meta.townId, s.tech);
        if (!cur || !s.status) return 'unknown';
        if (cur.done || (!s.status.queued && cur.queued)) return 'applied';
        return 'unchanged';
      }
      if (s.kind === 'recruit') {
        const cur = txUnitStatus(meta.townId, s.unit);
        if (!cur || !s.status) return 'unknown';
        if (cur.total >= s.status.total + Math.max(1, s.amount || 0)) return 'applied';
        return 'unchanged';
      }
      if (s.kind === 'farm') {
        const cur = txFarmStatus(s.farmId);
        if (!cur || !s.status || cur.lootableAt == null || s.status.lootableAt == null) return 'unknown';
        return cur.lootableAt > s.status.lootableAt ? 'applied' : 'unchanged';
      }
      if (s.kind === 'trade' || s.kind === 'collect' || s.kind === 'wonder' || s.kind === 'ruraltrade') {
        const before = s.kind === 'trade' ? s.source : s.before;
        const cur = txTownResourceSnap(meta.townId);
        if (!before || !cur) return 'unknown';
        if (s.kind === 'collect') {
          if (cur.wood > before.wood || cur.stone > before.stone || cur.iron > before.iron) return 'applied';
        } else if (cur.wood < before.wood || cur.stone < before.stone || cur.iron < before.iron || (cur.tradeCap != null && before.tradeCap != null && cur.tradeCap < before.tradeCap)) return 'applied';
        return 'unchanged';
      }
      if (s.kind === 'cave') {
        const cur = txCaveStatus(meta.townId);
        if (!cur || !s.before) return 'unknown';
        if ((cur.stored != null && s.before.stored != null && cur.stored > s.before.stored) || (cur.iron != null && s.before.iron != null && cur.iron < s.before.iron)) return 'applied';
        return 'unchanged';
      }
      if (s.kind === 'militia') {
        const cur = txMilitiaCount(meta.townId);
        if (cur == null || s.before == null) return 'unknown';
        return cur > s.before ? 'applied' : 'unchanged';
      }
      if (s.kind === 'spell') {
        const cur = txSpellPresent(meta.townId, s.powerId);
        if (cur === true && s.before !== true) return 'applied';
        return cur == null ? 'unknown' : 'unchanged';
      }
      if (s.kind === 'quest') {
        const cur = txQuestClaimable(s.qid);
        if (cur === false && s.before !== false) return 'applied';
        return cur == null ? 'unknown' : 'unchanged';
      }
      if (s.kind === 'movement') {
        const cur = txMovementCount(meta.townId, s.dest, s.mission);
        if (cur == null || s.before == null) return 'unknown';
        return cur > s.before ? 'applied' : 'unchanged';
      }
      if (s.kind === 'cancel') {
        const cur = txCommandStatus(s.commandId);
        if (!cur || !s.before) return 'unknown';
        if (s.before.exists === true && cur.exists === false) return 'applied';
        return cur.exists === true ? 'unchanged' : 'unknown';
      }
      if (s.kind === 'hero') {
        const cur = txHeroStatus(s.heroType);
        if (!cur || !s.before || cur.exists === false) return 'unknown';
        const action = String(s.action || '').toLowerCase();
        if (/assigntotown/.test(action) && !/unassign/.test(action)) {
          if (s.targetTownId != null && +cur.home === +s.targetTownId && (cur.assigned || cur.traveling)) return 'applied';
        } else if (/unassignfromtown/.test(action)) {
          if (s.before.assigned && !cur.assigned && !cur.attacking) return 'applied';
        } else if (/canceltowntravel/.test(action)) {
          if (s.before.traveling && !cur.traveling) return 'applied';
        }
        return JSON.stringify(cur) !== JSON.stringify(s.before) ? 'unknown' : 'unchanged';
      }
      if (s.kind === 'culture') {
        const cur = txCultureStatus(meta.townId, s.type);
        if (!cur || !s.before) return 'unknown';
        if (cur.count > s.before.count) return 'applied';
        if (cur.gold != null && s.before.gold != null && cur.gold < s.before.gold) return 'applied';
        if (cur.res && s.before.res && (cur.res.wood < s.before.res.wood || cur.res.stone < s.before.res.stone || cur.res.iron < s.before.res.iron)) return 'applied';
        return 'unchanged';
      }
      if (s.kind === 'merchant') {
        const cur = txMerchantStatus(s.offerId);
        if (!cur || !s.before) return 'unknown';
        if (s.before.exists && !cur.exists) return 'applied';
        if (cur.gold != null && s.before.gold != null && cur.gold < s.before.gold) return 'applied';
        return cur.exists === s.before.exists ? 'unchanged' : 'unknown';
      }
      if (s.kind === 'pttrade') {
        const cur = txPtTradeStatus(meta.townId, s.offerId);
        if (!cur || !s.before) return 'unknown';
        if (s.before.exists && !cur.exists) return 'applied';
        if (cur.tradeCap != null && s.before.tradeCap != null && cur.tradeCap < s.before.tradeCap) return 'applied';
        if (cur.res && s.before.res && (cur.res.wood != null && s.before.res.wood != null && cur.res.wood !== s.before.res.wood || cur.res.stone != null && s.before.res.stone != null && cur.res.stone !== s.before.res.stone || cur.res.iron != null && s.before.res.iron != null && cur.res.iron !== s.before.res.iron)) return 'applied';
        if (cur.amount != null && s.before.amount != null && cur.amount < s.before.amount) return 'applied';
        return cur.exists === s.before.exists ? 'unchanged' : 'unknown';
      }
      if (s.kind === 'bandit-attack' || (s.kind === 'bandit' && /\/attack$/i.test(String(tx.endpoint || '')))) {
        return banditMovementReconcileResult(tx, banditMovementEvidence(gameUw(), meta.townId));
      }
      if (s.kind === 'bandit') {
        const cur = txBanditStatus();
        if (!cur || !s.before) return 'unknown';
        return JSON.stringify(cur) !== JSON.stringify(s.before) ? 'applied' : 'unchanged';
      }
      if (s.kind === 'rurallevel') {
        let cur = null;
        try {
          const rel = ruralRelModels().find(r => String((r.attributes || {}).id || r.id) === String(s.relId));
          const x = rel && (rel.attributes || {});
          if (x) cur = { relation: +x.relation_status || 0, stage: +x.expansion_stage || 0, expansionAt: x.expansion_at || null };
        } catch (_) {}
        if (!cur || !s.status) return 'unknown';
        return JSON.stringify(cur) !== JSON.stringify(s.status) ? 'applied' : 'unchanged';
      }
    } catch (_) {}
    return 'unknown';
  }
  function txReconcile(tx, onDone) {
    if (!gbInstanceAlive()) return onDone && onDone('unknown');
    tx.state = 'reconciling';
    tx.updatedAt = Date.now();
    txSave();
    const s = tx.snapshot || {};

    const checks = (s.kind === 'bandit-attack' || (s.kind === 'bandit' && /\/attack$/i.test(String(tx.endpoint || ''))))
      ? [700, 1800, 3500, 5000, 8000]
      : [700, 1800, 3500];
    let i = 0;
    const step = () => {
      if (!gbInstanceAlive()) return;
      const r = txReconcileNow(tx);
      if (r === 'applied') return onDone && onDone('applied');
      if (r === 'unknown' && i >= checks.length) return onDone && onDone('unknown');
      if (i >= checks.length) return onDone && onDone('unchanged');
      gbTimeout(step, checks[i++]);
    };
    step();
  }
  function txActionGate(feature, write, jtag) {
    if (!gbInstanceAlive()) return 'disposed';
    if (!hostEnabled()) return 'disabled';
    const pauseInfo = {};
    if (automationPaused(pauseInfo)) return 'paused:' + pauseInfo.reason;
    if (captchaPaused(feature) || (captchaGlobalUntil && Date.now() < captchaGlobalUntil)) return 'captcha-pause';
    if (write && circuitOpen(feature)) return 'circuit-open';
    if (write) { const sm=safeModeBlock(feature, null, null, null); if (sm) return sm; }
    if (jtag && jrnSkipped(jtag)) return 'remembered';
    if (write && state.dryRun) return 'dryrun';
    if (!reqBudgetOk()) return 'budget';
    return null;
  }
  function txRun(feature, transport, endpoint, data, rawSend, onDone) {
    const write = TX_WRITE_FEATURES.has(feature);
    const snapshot = write ? txCapture(feature, transport, endpoint, data) : null;
    const intent = write ? txIntent(feature, transport, endpoint, data, snapshot) : null;
    const metaTown = data && (data.town_id != null ? data.town_id : (data.arguments && data.arguments.town_id));
    const jtag = write
      ? { f: feature, a: String(endpoint).slice(0, 48), k: String(intent).slice(0, 120) }
      : jrnTag(feature, transport === 'bridge' ? data : { action_name: endpoint, arguments: data, town_id: metaTown });
    let journalTxId = null;
    const bail = (err, why) => {
      const journalResult = jrnResult(why || err);

      if (!jrnPendingResult(journalResult)) jrnPush(jtag, journalResult, why || err, journalTxId);
      if (onDone && gbInstanceAlive()) onDone(err);
    };
    let gate = txActionGate(feature, write, jtag);
    if (!gate && write) gate = safeModeBlock(feature, transport, endpoint, data);
    if (gate) {
      if (gate === 'dryrun') {
        gbLog(`DRY-RUN ${feature}: ${endpoint} ${dryRunFmt(data)}`);
        if (write) {
          state.txState[intent] = { id: `${GB_INSTANCE_ID}:${++txSeq}`, intent, feature, state: 'dryrun', createdAt: Date.now(), updatedAt: Date.now(), owner: GB_INSTANCE_ID, snapshot, meta: { townId: metaTown } };
          journalTxId = state.txState[intent].id;
          txSave();
        }
        return bail('dryrun');
      }
      if (gate === 'circuit-open') gbLogT('circuit-' + feature, 60000, `${feature}: circuit breaker open`);
      whyNote(feature, endpoint, 'blocked', gate);
      return bail(gate.split(':')[0], gate);
    }
    if (write) {

      const tplName = tplNameFor(feature, transport === 'bridge' ? data : null);
      if (tplName && !tplHealthOk(tplName)) {
        gbLogT('tpl-stale-' + tplName, 120000, `${feature}: template ${tplName} invalidated - re-learn by hand`);
        whyNote(feature, endpoint, 'blocked', 'tpl-stale');
        return bail('tpl-stale');
      }

      const softMs = reqBudgetSoftDelayMs();
      if (softMs > 0) {
        gbLogT('req-soft-' + feature, 30000, `${feature}: soft ceiling - delaying ${softMs}ms`);
        gbTimeout(() => txRun(feature, transport, endpoint, data, rawSend, onDone), softMs);
        return;
      }
    }
    if (!write) {
      reqBudgetMark();
      return rawSend((err, result) => {
        if (!gbInstanceAlive()) return;
        if (!err) { markModuleHealth(feature, 'ok'); circuitSuccess(feature); }
        else if (err === 'captcha') markModuleHealth(feature, 'captcha');
        else { markModuleHealth(feature, 'err'); circuitNote(feature, err); }
        jrnPush(jtag, jrnResult(err), err);
        if (onDone) onDone(err, result);
      });
    }

    txPrune();
    const existing = state.txState[intent];
    if (existing && /^(planned|precheck|sending|confirming|reconciling|unknown|manual-review)$/.test(existing.state || '')) {
      journalTxId = existing.id;
      const age = Date.now() - (+existing.unknownAt || +existing.updatedAt || +existing.createdAt || Date.now());
      if (existing.state !== 'unknown' || age < TX_UNKNOWN_RECHECK_MS) {
        gbLogT('tx-dup-' + intent, 30000, `tx: duplicate blocked ${intent} state=${existing.state}`);
        return bail('pending', 'pending:' + existing.state);
      }
      existing.meta = Object.assign({}, existing.meta || {}, { townId: metaTown });
      return txReconcile(existing, (r) => {
        if (!gbInstanceAlive()) return;
        if (r === 'applied') {
          existing.state = 'committed'; existing.updatedAt = Date.now(); existing.detail = 'reconciled before retry'; plannerCommit(existing); txSave();
          jrnPush(jtag, 'ok', 'reconciled', existing.id);
          markModuleHealth(feature, 'ok');
          if (onDone) onDone(null, { reconciled: true, duplicate: true });
          return;
        }
        if (r === 'unchanged') {
          existing.state = 'failed'; existing.updatedAt = Date.now(); existing.detail = 'reconciled not applied; retry allowed'; plannerRelease(existing, 'reconciled-unchanged'); txSave();
          return txRun(feature, transport, endpoint, data, rawSend, onDone);
        }
        existing.state = 'unknown'; existing.unknownAt = existing.unknownAt || Date.now(); existing.updatedAt = Date.now(); txSave();
        return bail('timeout_unknown', 'unknown outcome still unresolved');
      });
    }

    const tx = state.txState[intent] = {
      id: `${GB_INSTANCE_ID}:${++txSeq}`,
      intent, feature, transport, endpoint, state: 'planned', owner: GB_INSTANCE_ID,
      createdAt: Date.now(), updatedAt: Date.now(), snapshot, meta: { townId: metaTown },
    };
    journalTxId = tx.id;
    txSave();
    tx.state = 'precheck'; tx.updatedAt = Date.now(); txSave();
    const plannerEffects = plannerEffect(feature, transport, endpoint, data, snapshot);
    if (plannerEffects === null) {
      tx.state = 'aborted'; tx.detail = 'planner effect/cost unreadable'; tx.updatedAt = Date.now(); txSave();
      whyNote(feature, endpoint, 'blocked', 'planner-cost-unknown');
      return bail('precheck', 'planner-cost-unknown');
    }
    if (plannerEffects.length) {
      const held = plannerHold(tx, plannerEffects);
      if (!held.ok) {
        tx.state = 'aborted'; tx.detail = held.why; tx.updatedAt = Date.now(); plannerRelease(tx, held.why); txSave();
        whyNote(feature, endpoint, 'blocked', held.why);
        return bail('precheck', held.why);
      }
    }

    if (!reqBudgetOk()) { tx.state = 'aborted'; tx.detail = 'budget'; tx.updatedAt = Date.now(); plannerRelease(tx, 'budget'); txSave(); return bail('budget'); }
    reqBudgetMark();
    tx.state = 'sending'; tx.sentAt = Date.now(); tx.updatedAt = Date.now(); txSave();
    rawSend((err, result) => {
      if (!gbInstanceAlive() || tx.owner !== GB_INSTANCE_ID) return;

      if (state.txState[intent] !== tx || !/^(sending|confirming)$/.test(tx.state)) return;
      if (err === 'timeout') {
        tx.state = 'unknown'; tx.unknownAt = Date.now(); tx.updatedAt = Date.now(); tx.detail = 'transport timeout'; txSave();
        markModuleHealth(feature, 'timeout', {latencyMs:Date.now()-tx.sentAt,error:'timeout'});
        return txReconcile(tx, (r) => {
          if (!gbInstanceAlive() || state.txState[intent] !== tx) return;
          if (r === 'applied') {
            tx.state = 'committed'; tx.updatedAt = Date.now(); tx.detail = 'confirmed by reconciliation after timeout'; plannerCommit(tx); txSave();
            jrnPush(jtag, 'ok', 'timeout reconciled', tx.id);
            markModuleHealth(feature, 'ok', {latencyMs:Date.now()-tx.sentAt}); circuitSuccess(feature);
            if (onDone) onDone(null, Object.assign({ reconciled: true }, result || {}));
          } else {
            tx.state = 'unknown'; tx.unknownAt = tx.unknownAt || Date.now(); tx.updatedAt = Date.now(); tx.detail = r === 'unchanged' ? 'timeout; state unchanged (retry blocked until next reconciliation)' : 'timeout; unable to reconcile'; txSave();
            jrnPush(jtag, 'timeout', tx.detail, tx.id);
            if (onDone) onDone('timeout_unknown', result);
          }
        });
      }
      if (err) {
        tx.state = 'failed'; tx.updatedAt = Date.now(); tx.detail = String(err).slice(0, 160); plannerRelease(tx, 'server-error'); txSave();
        if (err === 'captcha' || err === 'captcha-pause') markModuleHealth(feature, 'captcha', {latencyMs:Date.now()-tx.sentAt,error:err});
        else markModuleHealth(feature, 'err', {latencyMs:Date.now()-tx.sentAt,error:err});
        circuitNote(feature, err);
        jrnPush(jtag, jrnResult(err), err, tx.id);
        try { tplHealthNote(feature, jrnResult(err), transport === 'bridge' ? data : null); } catch (_) {}
        if (onDone) onDone(err, result);
        return;
      }
      tx.state = 'confirming'; tx.updatedAt = Date.now(); txSave();

      const r = txReconcileNow(tx);
      if (r === 'applied' || r === 'unknown' || r === 'unchanged') {
        tx.state = 'committed'; tx.updatedAt = Date.now(); tx.detail = r === 'applied' ? 'server+model confirmed' : 'server callback confirmed'; plannerCommit(tx); txSave();
        markModuleHealth(feature, 'ok', {latencyMs:Date.now()-tx.sentAt}); circuitSuccess(feature);
        jrnPush(jtag, 'ok', tx.detail, tx.id);
        try { tplHealthNote(feature, 'ok', transport === 'bridge' ? data : null); } catch (_) {}
        if (onDone) onDone(null, result);
      }
    });
  }

  const lastSelfBridge = { sig: '', fingerprint: '', at: 0, nonce: '', owner: '' };

  const GB_AJAX_WATCH_MS = 8000;
  const gbAjaxPending = [];
  function gbAjaxWatch(sig, settle) {
    const entry = { sig, at: Date.now(), settle };
    gbAjaxPending.push(entry);
    while (gbAjaxPending.length > 24) gbAjaxPending.shift();
    return entry;
  }

  function gbAjaxDrop(entry) {
    if (!entry) return;
    entry.done = true;
    const i = gbAjaxPending.indexOf(entry);
    if (i >= 0) gbAjaxPending.splice(i, 1);
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
      if (gbAjaxPending[i].done) continue;
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
  function isSelfBridge(j) {
    if (!j || !lastSelfBridge.sig || lastSelfBridge.owner !== GB_INSTANCE_ID) return false;
    if (Date.now() - lastSelfBridge.at > 10000) return false;
    const sig = String(j.model_url || '') + '|' + String(j.action_name || '');
    if (sig !== lastSelfBridge.sig) return false;
    try {
      const fp = JSON.stringify({ model_url: j.model_url || '', action_name: j.action_name || '', arguments: j.arguments || {}, town_id: j.town_id ?? null });
      return fp === lastSelfBridge.fingerprint;
    } catch (_) { return false; }
  }
  function responseServerError(data) {
    const queue=[data],seen=new Set();let steps=0;
    while(queue.length&&steps++<12){let d=queue.shift();if(typeof d==='string'){try{d=JSON.parse(d)}catch(_){continue}}if(!d||typeof d!=='object'||seen.has(d))continue;seen.add(d);
      if(d.error||d.exception)return d.error||d.exception;if(d.success===false)return d.message||d.msg||'success:false';
      for(const k of ['json','data','result','response'])if(d[k]!=null)queue.push(d[k]);
    }return null;
  }
  function bridgeRaw(feature, payload, done) {
    const uw = gameUw();
    if (!(uw.gpAjax && uw.gpAjax.ajaxPost)) return done('noajax');
    let settled = false;
    let watchEntry = null;
    const finish = (err, data) => {
      if (settled || !gbInstanceAlive()) return;
      settled = true;
      gbClearTimeout(timer);
      gbAjaxDrop(watchEntry);
      done(err, data);
    };
    const timer = gbTimeout(() => {
      gbLogT('bridge-timeout-' + feature, 30000, feature + ': bridge timeout ' + BRIDGE_TIMEOUT_MS + 'ms');
      finish('timeout');
    }, BRIDGE_TIMEOUT_MS);
    lastSelfBridge.sig = String(payload && payload.model_url || '') + '|' + String(payload && payload.action_name || '');
    try { lastSelfBridge.fingerprint = JSON.stringify({ model_url: payload.model_url || '', action_name: payload.action_name || '', arguments: payload.arguments || {}, town_id: payload.town_id ?? null }); }
    catch (_) { lastSelfBridge.fingerprint = ''; }
    lastSelfBridge.at = Date.now();
    lastSelfBridge.owner = GB_INSTANCE_ID;
    lastSelfBridge.nonce = Math.random().toString(36).slice(2);
    const classify = (data) => {
      if (!gbInstanceAlive()) return;
      try {
        if (responseIsCaptcha(data)) {
          captchaTrip(feature, JSON.stringify(data).slice(0, 120));
          return finish('captcha');
        }
        const e=responseServerError(data);
        if (e) {
          const msg = typeof e === 'string' ? e : (e.message || e.msg || 'error');
          if (/csrf|token|unauthorized|login|session/i.test(String(msg))) { try { csrfForceHunt(); } catch (_) {} }
          noteServerPressure(msg);
          return finish(msg, data);
        }
        captchaClear(feature);
        finish(null, data);
      } catch (e) { finish(String(e)); }
    };

    watchEntry = gbAjaxWatch(
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
    } catch (e) { finish(String(e)); }
  }
  function gameAjaxRaw(feature, controller, action, data, done) {
    const uw = gameUw();
    if (!(uw.gpAjax && uw.gpAjax.ajaxPost)) return done('noajax');
    let settled = false;
    let watchEntry = null;
    const finish = (err, res) => {
      if (settled || !gbInstanceAlive()) return;
      settled = true;
      gbClearTimeout(timer);
      gbAjaxDrop(watchEntry);
      done(err, res);
    };
    const timer = gbTimeout(() => finish('timeout'), BRIDGE_TIMEOUT_MS);
    const classify = (res) => {
      if (!gbInstanceAlive()) return;
      try {
        if (responseIsCaptcha(res)) { captchaTrip(feature, JSON.stringify(res).slice(0, 120)); return finish('captcha'); }
        const e=responseServerError(res);
        if (e) {
          const msg = typeof e === 'string' ? e : (e.message || e.msg || 'error');
          noteServerPressure(msg);
          return finish(msg, res);
        }
        captchaClear(feature);
        finish(null, res);
      } catch (e) { finish(String(e)); }
    };
    watchEntry = gbAjaxWatch('ajax:' + controller + '/' + action, (status, raw) => {
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
  function bridgePost(feature, payload, onDone) {
    const endpoint = String(payload && payload.model_url || '') + '/' + String(payload && payload.action_name || '');
    return txRun(feature, 'bridge', endpoint, payload, (done) => bridgeRaw(feature, payload, done), onDone);
  }
  function gameAjaxPost(feature, controller, action, data, onDone) {
    const endpoint = String(controller) + '/' + String(action);
    return txRun(feature, 'ajax', endpoint, data, (done) => gameAjaxRaw(feature, controller, action, data, done), onDone);
  }
  function txDomWrite(feature, endpoint, data, actionFn, verifyFn, onDone) {
    return txRun(feature, 'dom', endpoint, data || {}, (done) => {
      if (!gbInstanceAlive()) return done('disposed');
      try { actionFn(); } catch (e) { return done(String(e)); }
      let tries = 0;
      const verify = () => {
        if (!gbInstanceAlive()) return;
        let ok = false;
        try { ok = verifyFn ? verifyFn() === true : false; } catch (_) {}
        if (ok) return done(null, { dom: true, reconciled: true });
        if (++tries >= 4) return done('timeout');
        gbTimeout(verify, 600 + tries * 500);
      };
      gbTimeout(verify, 500);
    }, onDone);
  }

  function dryRunFmt(payload) {
    try {
      const s = JSON.stringify(payload);
      return s.length > 220 ? s.slice(0, 220) + '…' : s;
    } catch (_) { return String(payload); }
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
    if (!cost || typeof cost !== 'object') return { ok: false, blind: true, short: ['cost unreadable'], detail: 'no cost data' };
    const normalized = plannerNormCost(cost);
    if (!normalized) return { ok: false, blind: true, short: ['cost unreadable'], detail: 'invalid cost data' };
    const av = o.ignorePlanner ? null : plannerAvailable(townId, {allowSoft:!!o.allowSoft, excludeIntent:o.excludeIntent});
    const st = o.ignorePlanner ? townResState(townId) : null;
    const short = [];
    let blind = false;
    for (const k of GB_RES_KEYS) {
      const need = +normalized[k] || 0;
      if (need <= 0) continue;
      const have = av ? av[k] : (st && st[k]);
      if (have == null) { blind = true; short.push(`${k} unreadable`); continue; }
      if (have < need + margin) short.push(`${k} ${Math.floor(have)}/${Math.ceil(need + margin)}`);
    }
    const needPop = +normalized.population || 0;
    if (needPop > 0) {
      const pop = av ? av.population : gbTownPop(townId);
      if (pop == null) { blind = true; short.push('population unreadable'); }
      else if (pop < needPop) short.push(`pop ${Math.floor(pop)}/${Math.ceil(needPop)}`);
    }
    return { ok: !blind && short.length === 0, blind, short, detail: short.join(', ') };
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

    return state.enabledHosts[location.host] === true && gbTabLeader;
  }
  function ensureHostDefault() {
    const h = location.host;
    if (state.enabledHosts[h] === undefined) {
      state.enabledHosts[h] = false;
      save(STORE.ENABLED_HOSTS, state.enabledHosts);
      gbLog('host ' + h + ' disabled by default — enable in Config');
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

  function jrnTransientDynamicResult(r) {
    const s = String(r || '');
    return /^planner-(?:wood|stone|iron|population|tradeCap):/i.test(s);
  }
  function jrnResult(err) {
    if (!err) return 'ok';
    const s = String(err);
    if (JRN_SKIP_ERRS[s.split(':')[0]] || jrnTransientDynamicResult(s)) return 'skip:' + s.slice(0, 40);
    return s.slice(0, 60);
  }

  function jrnPendingResult(r) {
    const s = String(r || '');
    return s === 'timeout_unknown' || /^pending(?::|$)/i.test(s) || /^unknown outcome/i.test(s);
  }
  function jrnHard(r) {
    const s = String(r || '');
    return !!s && s !== 'ok' && s !== 'timeout' && s !== 'captcha'
      && !jrnPendingResult(s) && s.slice(0, 5) !== 'skip:';
  }
  function jrnId(tag) { return tag.f + '|' + tag.a + '|' + tag.k; }

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
  function gbSkipActive(feature, payload) {
    const tag = jrnTag(feature, payload);
    return jrnSkipped(tag) ? (jrnWhy(tag) || 'remembered') : '';
  }

  function jrnTag(feature, payload) {
    let action = '', target = '', town = '';
    try {
      const p = payload || {};
      action = p.action_name || p.action || '';
      const mu = String(p.model_url || p.model || '');
      if (mu) {
        const model = mu.split('/')[0] || mu;
        action = action ? model + '/' + action : model;
      }
      const args = p.arguments || {};
      town = p.town_id ?? args.town_id ?? '';
      target = args.building_id || args.research_id || args.research || args.farm_town_id
        || args.offer_id || args.offer || args.power_id
        || (args.id != null && String(args.id) !== String(town) ? args.id : '')
        || '';
    } catch (_) {}
    const key = `${town !== '' ? 't' + town : 't-'}:${target !== '' ? target : '-'}`;
    return { f: feature, a: String(action || 'post').slice(0, 48), k: key.slice(0, 72) };
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

  function jrnPush(tag, result, detail, txId) {
    jrnCheckHost();
    const list = state.decisions;
    const now = Date.now();

    if (txId != null && txId !== '') {
      const id = String(txId).slice(0, 120);
      const provisional = result === 'timeout' || jrnPendingResult(result);
      for (let i = list.length - 1; i >= 0; i--) {
        const r = list[i];
        if (r.x !== id || r.f !== tag.f || r.a !== tag.a || r.k !== tag.k) continue;
        if (provisional) {
          r.ts = now; r.r = result; r.n = 1;
          if (detail && jrnHard(result)) r.d = String(detail).slice(0, 80); else delete r.d;
          list.splice(i, 1); list.push(r);
          jrnNote(tag, result); jrnSave();
          return r;
        }

        list.splice(i, 1);
        break;
      }
      if (provisional) {
        const rec = { ts: now, f: tag.f, a: tag.a, k: tag.k, r: result, n: 1, x: id };
        if (detail && jrnHard(result)) rec.d = String(detail).slice(0, 80);
        list.push(rec); jrnPrune(); jrnNote(tag, result); jrnSave();
        return rec;
      }
    }
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
    const key = jrnId(tag);
    const s = state.decisionSkips[key];
    if (!s || !s.until) return false;

    if (jrnTransientDynamicResult(s.r)) {
      delete state.decisionSkips[key];
      jrnSave();
      gbLogT('memory-transient-clear-' + key, 30000, `memory: cleared transient ${s.r}; live precheck will decide`);
      return false;
    }
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
    const byPending = Object.create(null);
    let ok = 0, err = 0, captcha = 0, skip = 0, timeout = 0, pending = 0, dry = 0, total = 0;
    for (const r of (state.decisions || [])) {
      if (r.ts < since) continue;
      const n = r.n || 1;
      total += n;
      const f = byFeature[r.f] || (byFeature[r.f] = { ok: 0, err: 0, captcha: 0, skip: 0, timeout: 0, pending: 0, n: 0, last: 0 });
      f.n += n;
      f.last = Math.max(f.last, r.ts);
      const res = String(r.r || '');
      if (res === 'ok') { ok += n; f.ok += n; }
      else if (res === 'captcha') { captcha += n; f.captcha += n; }
      else if (res === 'timeout') { timeout += n; f.timeout += n; }
      else if (jrnPendingResult(res)) {
        pending += n; f.pending += n;
        const key = r.f + ' ' + r.a + ' ' + (r.k || '-') + ': ' + res.slice(0, 40);
        byPending[key] = (byPending[key] || 0) + n;
      }
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
    const topPending = Object.entries(byPending).sort((a, b) => b[1] - a[1]).slice(0, 6);
    return {
      windowMs: windowMs || 86400000,
      total, ok, err, captcha, skip, timeout, pending, dry, attempts,
      successPct: attempts ? Math.round(ok / attempts * 100) : null,
      byFeature, topSkips, topErrors, topPending,
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
    const uw = gameUw();
    if (!uw.fetch) return;
    if (uw.fetch.__grepbotOwner === GB_INSTANCE_ID) return;
    if (!gbHookOrig.fetch) gbHookOrig.fetch = uw.fetch;
    const orig = gbHookOrig.fetch;
    const patched = function (...args) {
      if (gbInstanceAlive()) {
        try {
          const [url] = args;
          const u = String(url || '');
          const reportCtrl = /\/game\/report(?:\?|$)/.test(u) || /[?&]controller=report(?:&|$)/.test(u);
          const m = u.match(/[?&]action=(report|reports|combat_reports|tombstone|attack_planner)(?:&|$)/)
            || (reportCtrl && u.match(/[?&]action=(view|index|delete)(?:&|$)/));
          const idMatch = u.match(/[?&](?:id|report_id)=(\d+)/);
          if ((m || reportCtrl) && idMatch) queueReport(idMatch[1], u);
          else if (m || reportCtrl) queueReportList(u);
          learnCollectAction(u);
          learnFarmAction(u);
          try { ptLearnFromXhr(u, args[1] && args[1].body); } catch (_) {}
        } catch (_) {}
      }
      return orig.apply(this, args);
    };
    patched._grepbot = true;
    patched.__grepbotOwner = GB_INSTANCE_ID;
    uw.fetch = patched;
  }

  function hookXhr() {
    const uw = gameUw();
    if (!uw.XMLHttpRequest) return;
    const P = uw.XMLHttpRequest.prototype;
    if (P.open && P.open.__grepbotOwner === GB_INSTANCE_ID) return;
    if (!gbHookOrig.xhrOpen) gbHookOrig.xhrOpen = P.open;
    if (!gbHookOrig.xhrSend) gbHookOrig.xhrSend = P.send;
    const origOpen = gbHookOrig.xhrOpen;
    const origSend = gbHookOrig.xhrSend;

    const patchedOpen = function (method, url) {
      this._grepbot_url = url;
      return origOpen.apply(this, arguments);
    };
    patchedOpen._grepbot = true;
    patchedOpen.__grepbotOwner = GB_INSTANCE_ID;

    const patchedSend = function () {
      const body = arguments[0];
      const u = String(this._grepbot_url || '');
      if (gbInstanceAlive()) {
        try {
          const reportCtrl = /\/game\/report(?:\?|$)/.test(u) || /[?&]controller=report(?:&|$)/.test(u);
          const idMatch = u.match(/[?&](?:id|report_id)=(\d+)/);
          const actionReport = /[?&]action=(report|reports|combat_reports|tombstone|attack_planner)(?:&|$)/.test(u);
          if ((actionReport || reportCtrl) && idMatch) queueReport(idMatch[1], u);
          else if (actionReport || /[?&]action=(reports|combat_reports|tombstone)(?:&|$)/.test(u) || reportCtrl) queueReportList(u);
          learnCollectAction(u);
          learnFarmAction(u);
          try { ptLearnFromXhr(u, body); } catch (_) {}
          sniffBridgeBody(u, body);
        } catch (_) {}
      }

      try {
        const settle = gbAjaxClaim(u, body);
        if (settle) {
          this.addEventListener('loadend', () => {
            let raw = null;
            try { raw = tryParseJson(this.responseText || ''); } catch (_) {}
            try { settle(this.status, raw); } catch (_) {}
          });
        }
      } catch (_) {}
      try {
        this.addEventListener('load', () => {
          if (!gbInstanceAlive()) return;
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
            if (/island_quest|progressable|quest/i.test(u) || /IslandQuest|Progressable|claimReward/i.test(u + txt.slice(0, 500))) {
              learnQuestRewardsFromPayload(data);
            }
          } catch (_) {}
        }, { once: true });
      } catch (_) {}
      return origSend.apply(this, arguments);
    };
    patchedSend._grepbot = true;
    patchedSend.__grepbotOwner = GB_INSTANCE_ID;
    P.open = patchedOpen;
    P.send = patchedSend;
    P._grepbot_open = GB_INSTANCE_ID;
  }

  function reportCatchUpEnqueue() {
    if (!hostEnabled() || gbLocked('report-catchup')) return;
    if (typeof gbWake === 'function') {
      gbWake('reportCatchUp', () => reportCatchUpRun(), { priority: 80 });
    } else {
      reportCatchUpRun();
    }
  }
  function reportCatchUpRun() {
    if (!hostEnabled() || gbLocked('report-catchup') || automationPaused({}) || captchaPaused('report')) return;
    const token = gbLock('report-catchup', 300000);
    if (!token) return;
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
    const release = () => { gbUnlock('report-catchup', token); };
    if (!batch.length) {
      release();
      gbLogT('catchup-empty', 120000, 'report catch-up: nothing new in inbox DOM');
      return;
    }
    gbLog(`report catch-up: fetching up to ${batch.length} (cap ${maxN}, age≤72h, lastSeen=${state.lastSeenTs || 0})`);
    let i = 0, fetched = 0;
    (function step() {
      let done = false;
      try {
        if (i >= batch.length) {
          gbLog(`report catch-up done: ${fetched}/${batch.length}`);
          done = true;
        } else if (!hostEnabled() || automationPaused({}) || captchaPaused('report') || !reqBudgetOk()) {
          gbLog(`report catch-up paused mid-run at ${i}/${batch.length}`);
          done = true;
        } else {
          const id = batch[i++];

          if (state.lastSeenTs && state.lastSeenTs < cut) {

          }
          fetchReport(id);
          fetched++;
        }
      } catch (e) {
        gbLog('report catch-up: step error', String(e && e.message || e));
        gbLog(`report catch-up aborted on error at ${i}/${batch.length}`);
        done = true;
      } finally {
        if (done) release();
        else gbTimeout(step, 700 + Math.random() * 300);
      }
    })();
  }
  function tryParseJson(txt) {
    if (!txt || typeof txt !== 'string') return null;
    const s = txt.replace(/^\uFEFF/, '').trim();
    if (!s || (s[0] !== '{' && s[0] !== '[' && s[0] !== '"')) return null;
    try { return JSON.parse(s); } catch (_) { return null; }
  }
  function scanResponseForReports(data, srcUrl, reportish) {
    if (!data || typeof data !== 'object') return;
    const numericId = (v) => typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v));
    const looksReport = (o) => !!o && typeof o === 'object' && (
      o.report_type != null || o.type != null || o.subject != null || o.attacker != null || o.defender != null ||
      o.timestamp != null || o.created_at != null || o.outcome != null || o.win != null
    );
    const walk = (obj) => {
      if (!obj) return;
      if (Array.isArray(obj)) { obj.forEach(walk); return; }
      if (typeof obj !== 'object') return;
      if (numericId(obj.report_id)) queueReport(String(obj.report_id), srcUrl);
      for (const [k, v] of Object.entries(obj)) {
        if (k === 'reports' && Array.isArray(v)) {
          for (const r of v) {
            if (!r || typeof r !== 'object') continue;
            const rid = r.report_id != null ? r.report_id : r.id;
            if (numericId(rid) && (r.report_id != null || looksReport(r))) queueReport(String(rid), srcUrl);
            walk(r);
          }
        } else if (v && typeof v === 'object') {
          walk(v);
        }
      }
    };
    walk(data);
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
  function nameOf(p) {
    if (p == null) return null;
    if (typeof p === 'string') {
      const s = p.trim();
      return s ? { id: null, name: s } : null;
    }
    if (typeof p !== 'object') return null;
    return {
      id: p.id ?? p.player_id ?? null,
      name: p.name || p.player_name || null,
      town_id: p.town_id ?? p.origin_town_id ?? null,
      town_name: p.town_name || p.origin_town_name || null,
      alliance: p.alliance_name || p.alliance || null,
      vacation: p.vacation ?? p.on_vacation ?? null,
    };
  }

  function extractUnits(r) {
    const u = {};
    const src = r.units || r.attacker_units || {};
    Object.keys(src).forEach(k => { const v = Number(src[k]); if (Number.isFinite(v) && v > 0) u[k] = Math.floor(v); });
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
      loot: r.resources || r.loot || null,
      outcome: r.outcome ?? r.win ?? null,
      wall: r.wall ?? r.wall_level ?? r.defender_wall ?? (r.defender && (r.defender.wall ?? r.defender.wall_level)) ?? null,
      alliance: r.alliance ?? r.attacker_alliance ?? (r.attacker && (r.attacker.alliance_name || r.attacker.alliance)) ?? null,
      vill_id: r.vill_id ?? r.farm_town_id ?? null,
      vacation: r.vacation ?? r.on_vacation ?? null,
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
      const parsedSelfCheck = parseBodyLoose(body);
      if (parsedSelfCheck && isSelfBridge(parsedSelfCheck)) return;
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
        if (j && j.action_name && /instant/i.test(j.action_name)) {
          if (typeof ibLearnAction === 'function') {
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
        if (j && j.action_name && /instant/i.test(j.action_name)) {
          if (typeof ibLearnAction === 'function') {
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
            attackRememberTarget(destId, { src: 'manual-attack' });
          }
        }
      } else if (/Command/.test(body) && /cancelCommand|cancel_command/i.test(body)) {
        const j = parseBodyLoose(body);
        if (j && j.action_name && /cancelCommand|cancel_command/i.test(j.action_name) && !isSelfBridge(j)) {
          state.cancelTpl = {
            model_url: j.model_url || 'Command', action_name: j.action_name,
            arguments: j.arguments || {}, town_id: j.town_id, version: 1, learned_at: Date.now(),
          };
          save(STORE.CANCEL_TPL, state.cancelTpl);
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
          try { tplHealthMarkLearned('wonderFavorTpl'); } catch (_) {}
        }
      } else if (/PlayerHero/.test(body) && /assignToTown|unassignFromTown|cancelTownTravel/i.test(body)) {
        const j = parseBodyLoose(body);
        if (j && j.action_name && !isSelfBridge(j)) {
          if (!state.heroTpl || typeof state.heroTpl !== 'object') state.heroTpl = {};
          state.heroTpl[j.action_name] = {
            model_url: j.model_url || 'PlayerHero', action_name: j.action_name,
            arguments: j.arguments || {}, town_id: j.town_id, version: 1, learned_at: Date.now(),
          };
          save(STORE.HERO_TPL, state.heroTpl);
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

  let farmRelLogSig = '';
  function farmRelationCol() {
    return mmCol('FarmTownPlayerRelation');
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

  const FARM_CLAIM_WAKE_GRACE_MS = 1500;
  const FARM_CLAIM_READY_WAKE_MS = 750;
  const FARM_CLAIM_READY_RETRY_MS = 5000;
  let farmClaimWakeTimer = 0, farmClaimWakeAt = 0;
  function farmClaimTiming(farmsArg) {
    const farms = Array.isArray(farmsArg) ? farmsArg : (farmsFromGame() || []);
    const now = gameNow();
    let ready = 0, nextAt = Infinity, expiredModelWait = 0;
    for (const f of farms) {
      if (!f) continue;
      const at = f.lootable_at == null ? null : +f.lootable_at;
      let modelReady = null;
      if (f._rel) {
        try { if (typeof f._rel.isLootable === 'function') modelReady = !!f._rel.isLootable(); } catch (_) {}
      }
      if (modelReady === true || (modelReady == null && (at == null || at <= now))) ready++;
      if (Number.isFinite(at) && at > now) nextAt = Math.min(nextAt, at);
      else if (Number.isFinite(at) && at <= now && modelReady === false) expiredModelWait++;
    }
    return { now, ready, nextAt, expiredModelWait, total: farms.length };
  }
  function farmCancelClaimWake() {
    if (farmClaimWakeTimer) gbClearTimeout(farmClaimWakeTimer);
    farmClaimWakeTimer = 0; farmClaimWakeAt = 0;
  }
  function farmScheduleClaimWake(farmsArg, reason, allowExpiredRetry) {
    if (!state.autoFarm || !hostEnabled()) { farmCancelClaimWake(); return null; }
    const t = farmClaimTiming(farmsArg);
    let targetMs = 0;

    if (allowExpiredRetry && t.ready > 0) {
      const delay = gbLocked('claim') || reason === 'post-claim' ? FARM_CLAIM_READY_RETRY_MS : FARM_CLAIM_READY_WAKE_MS;
      targetMs = Date.now() + delay;
    } else if (Number.isFinite(t.nextAt)) {
      targetMs = Date.now() + Math.max(0, (t.nextAt - t.now) * 1000) + FARM_CLAIM_WAKE_GRACE_MS;
    } else if (allowExpiredRetry && t.expiredModelWait > 0) {
      targetMs = Date.now() + FARM_CLAIM_READY_RETRY_MS;
    }
    if (!targetMs) return null;

    if (farmClaimWakeTimer && farmClaimWakeAt && farmClaimWakeAt <= targetMs + 1000) return farmClaimWakeAt;
    farmCancelClaimWake();
    farmClaimWakeAt = targetMs;
    const delay = Math.max(250, targetMs - Date.now());
    farmClaimWakeTimer = gbTimeout(() => {
      farmClaimWakeTimer = 0; farmClaimWakeAt = 0;
      if (!gbInstanceAlive() || !state.autoFarm || !hostEnabled()) return;
      if (automationPaused({}) || captchaPaused('farm')) { farmScheduleClaimWake(null, 'paused-retry', true); return; }
      if (gbLocked('claim')) { farmScheduleClaimWake(null, 'claim-inflight-retry', true); return; }
      const liveTiming = farmClaimTiming();
      const wakeKind = liveTiming.ready > 0 ? 'ready wake' : 'deadline wake';
      gbLogT('farm-deadline-wake', 5000, `farm claim: ${wakeKind}${reason ? ' (' + reason + ')' : ''}`);
      autoClaimFarms('deadline');
    }, delay);
    return targetMs;
  }
  function farmsFromGame() {
    try {
      const uw = uwCached();
      if (!uw.MM) return null;
      const relCol = farmRelationCol();
      const farmCol = mmCol('FarmTown');
      if (!relCol) return null;
      if (!Array.isArray(relCol.models) || !relCol.models.length) {
        gbLogT('farm-rel-loading', 120000, 'farm relations: waiting for game collection');
        return null;
      }
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
      const relSig = [relCol.models.length, out.length, noRelId,
        Object.keys(statusCount).sort().map(k => `${k}:${statusCount[k]}`).join(',')].join('|');
      if (relSig !== farmRelLogSig) {
        farmRelLogSig = relSig;
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
        if (!Array.isArray(map[key])) map[key] = [];
        map[key].push(String(tid));
      }
    } catch (_) {}
    return map;
  }
  function townIdForFarm(farm, islandMap) {

    if (farm.x == null || farm.y == null) return null;
    const map = islandMap || islandTownMap();
    const hit = map[farm.x + ',' + farm.y];
    const ids=Array.isArray(hit)?hit:(hit!=null?[hit]:[]);if(!ids.length)return null;
    ids.sort((a,b)=>{const A=townWarehouseState(a),B=townWarehouseState(b);const af=A&&A.cap>0?A.cap-Math.max(+A.wood||0,+A.stone||0,+A.iron||0):-1;const bf=B&&B.cap>0?B.cap-Math.max(+B.wood||0,+B.stone||0,+B.iron||0):-1;return bf-af});
    return ids.find(id=>!townWarehouseBlocks(id))||ids[0];
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
      }, 4000);
    } catch (_) {}
  }

  const FARM_LOYALTY_IDS = ['rural_loyalty', 'loyalty', 'villagers_loyalty', 'villager_loyalty'];
  const FARM_LOYALTY_RE = /loyal(?:ty)?|lealtad|treue|fidel(?:ity|idad)|villager.{0,12}loyal|aldean.{0,12}leal/i;
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
    }, (err) => {
      if (!err && whCache) delete whCache[tid];
      done(err || null);
    });
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

      farmScheduleClaimWake(farms, 'next-lootable', skippedFull === 0);
      if (onBatchDone) onBatchDone({ done: 0, attempted: 0, captcha: false });
      return;
    }
    const claimLockToken = gbLock('claim', Math.max(180000, ready.length * 20000));
    if (!claimLockToken) return;
    gbLog(`farm claim${reason ? ' (' + reason + ')' : ''}: ${ready.length}/${farms.length} ready${skippedFull ? ` (${skippedFull} warehouse-full)` : ''}`);
    const before = {};
    farms.forEach(f => { before[f.vill_id] = f.lootable_at; });
    flash(`farm claim x${ready.length}`);
    let i = 0, done = 0, captcha = false;
    const claimSpacingMs=Math.max(700,Math.ceil(60000/Math.max(5,(+state.reqBudgetPerMin||40)-4)));
    (function next() {
      gbLockTouch('claim', claimLockToken);
      if (i >= ready.length || captcha || captchaPaused('farm')) {
        gbTimeout(() => {
          try {
            const flipped = verifyClaims(before);

            farmScheduleClaimWake(null, 'post-claim', true);

            if (onBatchDone) onBatchDone({
              done: flipped,
              attempted: ready.length,
              captcha,
              bridgeOk: done,
            });
          } finally { gbUnlock('claim', claimLockToken); }
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

          gbTimeout(next, claimSpacingMs);
        });
      } catch (e) {
        gbLog('  claim FAIL', f.vill_id, String(e));
        gbTimeout(next, claimSpacingMs);
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
      flash('recoleccion nocturna: ensenale ' + farmDurLabel(sec));
      if (onDone) onDone(null);
      return false;
    }
    if (!state.autoFarm) {
      gbLog('sleep claim: auto-farm is OFF - enable it in Config, the claim path is shared');
      flash('recoleccion nocturna: auto-granjas APAGADO');
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
      if (!stats.captcha && stats.attempted > 0 && stats.done >= stats.attempted) {
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
    const guesses = farmGuesses();
    tryGuess(entry, 0, 0);
    function tryGuess(entry, i, pressureRetries) {
      if (!gbInstanceAlive() || !hostEnabled() || automationPaused({})) { if (onDone) onDone(false); return; }
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
            const n = pressureRetries || 0;
            if (n >= 3) {
              state.farmResources[entry.vill_id] = { ts: Date.now(), ok: false, err: 'HTTP ' + res.status + ' retry limit' };
              save(STORE.FARM_RES, state.farmResources);
              if (onDone) onDone(false);
              return;
            }
            gbLogT('farm-http-' + res.status, 30000, `farm ${entry.vill_id}: HTTP ${res.status}, retry ${n + 1}/3 in ${retryMs}ms`);
            gbTimeout(() => tryGuess(entry, i, n + 1), retryMs);
            return;
          }
          if (res.status && res.status >= 400) {
            return tryGuess(entry, i + 1, 0);
          }
          const body = (res.responseText || '').slice(0, 500);

          const looksLikeJson = res.responseText && (res.responseText[0] === '{' || res.responseText[0] === '[');
          if (!looksLikeJson || /<html/i.test(body)) {

            return tryGuess(entry, i + 1, 0);
          }
          try {
            const p = parseResourceJson(JSON.parse(res.responseText));

            if (!p.got && i + 1 < guesses.length) return tryGuess(entry, i + 1, 0);
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
            if (i + 1 < guesses.length) return tryGuess(entry, i + 1, 0);
            state.farmResources[entry.vill_id] = { ts: Date.now(), ok: false, err: String(e).slice(0, 100) };
          }
          save(STORE.FARM_RES, state.farmResources);

          renderFarms();
          checkThresholds();
          if (onDone) onDone(!!state.farmResources[entry.vill_id].ok);
        },
        onerror() {
          if (i + 1 < guesses.length) return tryGuess(entry, i + 1, 0);
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
    if (!hostEnabled() || automationPaused({})) return;
    if (gbLocked('farm-scrape')) { gbLogT('farm-scrape-inflight', 30000, 'farm scrape: skipped (in flight)'); return; }
    const farmScrapeLock = gbLock('farm-scrape', 300000);
    if (!farmScrapeLock) return;
    refreshFarmsParsed();
    const wait = SYNC.FARM_MIN_MS + Math.random() * (SYNC.FARM_MAX_MS - SYNC.FARM_MIN_MS);
    state.nextFarmScrape = Date.now() + wait;
    save(STORE.NEXT_FARM, state.nextFarmScrape);
    renderTimers();
    const list = state.farmsParsed.slice();
    const gameFarms = list.filter(f => f.fromGame).length;
    if (!list.length) {
      gbUnlock('farm-scrape', farmScrapeLock);
      gbLog('farm scrape: 0 farms known (no game data, textarea empty)');
      return;
    }
    gbLog(`farm scrape: ${list.length} farms (${gameFarms} auto-discovered, ${list.length - gameFarms} from textarea)`);
    let done = 0, ok = 0;

    (function step() {
      gbLockTouch('farm-scrape', farmScrapeLock);
      if (!hostEnabled() || automationPaused({})) {
        gbUnlock('farm-scrape', farmScrapeLock);
        gbLog(`farm scrape aborted (host/pause): ${ok}/${done} ok`);
        return;
      }
      const f = list.shift();
      if (!f) {
        gbUnlock('farm-scrape', farmScrapeLock);
        gbLog(`farm scrape done: ${ok}/${done} ok, next in ${fmtSec(Math.round(wait / 1000))}`);
        flash(`farms ${ok}/${done} ok`);
        return;
      }
      fetchFarmResources(f, (good) => {
        done++; if (good) ok++;
        if (!good) gbLog(`  farm ${f.vill_id}: no data (${(state.farmResources[f.vill_id] || {}).err || '?'})`);
        gbTimeout(step, 700 + Math.random() * 300);
      });
    })();
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
    farmSetTeachBanner('Investigacion de lealtad completada. Haz una recogida de 10 minutos a mano para ensenarselo al bot.');
    gbLog('farm: loyalty researched - 10min option unknown; hand-claim once to teach');
  }
  function farmTick() {
    try { gbWakeGapTick(); } catch (_) {}
    const run = () => {
      const now = Date.now();
      if (hostEnabled() && !automationPaused({})) {
        if (now >= state.nextFarmScrape) scrapeAllFarms();
        if (now >= state.nextTownsScrape) scrapeAllTowns();
        if (state.autoFarm) farmScheduleClaimWake(null, 'farm-tick', true);
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
  function fetchOwnedTowns(i = 0, pressureRetries = 0) {
    if (!gbInstanceAlive() || !hostEnabled() || automationPaused({})) return;
    if (!state.csrf) return;
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
          if (pressureRetries >= 3) {
            gbLogT('towns-http-limit', 60000, `towns list HTTP ${res.status}, retry limit reached`);
            return;
          }
          gbLogT('towns-http', 30000, `towns list HTTP ${res.status}, retry ${pressureRetries + 1}/3 in ${retryMs}ms`);
          gbTimeout(() => fetchOwnedTowns(i, pressureRetries + 1), retryMs);
          return;
        }
        if (res.status && res.status >= 400) return fetchOwnedTowns(i + 1, 0);
        const body = (res.responseText || '').slice(0, 2000);
        if (!body || body[0] !== '{') return fetchOwnedTowns(i + 1, 0);
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
        fetchOwnedTowns(i + 1, 0);
      },
      onerror() { fetchOwnedTowns(i + 1, 0); },
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
  function fetchTownResources(town, onDone) {
    const TOWN_ACTION_GUESSES = ['town_info', 'get_town_info', 'town_overview', 'overview_towns', 'get_resources', 'resource_header'];
    let pressureRetries = 0;
    let finished = false;
    const finish = (ok) => { if (finished) return; finished = true; if (onDone) onDone(!!ok); };
    tryGuess(town, 0);
    function tryGuess(town, i) {
      if (!hostEnabled() || automationPaused({}) || !gbInstanceAlive()) return finish(false);
      if (i >= TOWN_ACTION_GUESSES.length) {
        state.townResources[town.id] = { ts: Date.now(), ok: false, err: 'no endpoint' };
        save(STORE.TOWN_RES, state.townResources); renderWorld(); finish(false); return;
      }
      const action = TOWN_ACTION_GUESSES[i];
      const params = new URLSearchParams();
      params.set('action', action); params.set('town_id', town.id); params.set('h', state.csrf || '');
      gbXhr({
        method: 'GET', url: '/index.php?' + params.toString(),
        headers: { 'X-Requested-With': 'XMLHttpRequest' }, anonymous: false,
        onload(res) {
          const retryMs = httpRetryAfterMs(res);
          if (retryMs) {
            if (++pressureRetries > 3) {
              state.townResources[town.id] = { ts: Date.now(), ok: false, err: 'HTTP retry cap ' + res.status };
              save(STORE.TOWN_RES, state.townResources); renderWorld(); finish(false); return;
            }
            gbLogT('town-res-http', 30000, `town ${town.id} HTTP ${res.status}, retry ${retryMs}ms`);
            gbTimeout(() => tryGuess(town, i), retryMs); return;
          }
          pressureRetries = 0;
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
            save(STORE.TOWN_RES, state.townResources); renderWorld(); finish(true);
          } catch (_) { tryGuess(town, i + 1); }
        },
        onerror(e) {
          if (e && (e.error === 'disabled' || e.error === 'budget')) return finish(false);
          tryGuess(town, i + 1);
        },
      });
    }
  }

  function scrapeAllTowns() {
    if (!hostEnabled() || automationPaused({})) return;
    if (gbLocked('town-scrape')) { gbLogT('town-scrape-inflight', 30000, 'town scrape: skipped (in flight)'); return; }
    const townScrapeLock = gbLock('town-scrape', 300000);
    if (!townScrapeLock) return;
    const delay = SYNC.TOWN_MIN_MS + Math.random() * (SYNC.TOWN_MAX_MS - SYNC.TOWN_MIN_MS);
    state.nextTownsScrape = Date.now() + delay; save(STORE.NEXT_TOWNS, state.nextTownsScrape); renderTimers();
    const finish = (fromGame, fromHttp) => {
      gbUnlock('town-scrape', townScrapeLock);
      const ids = state.towns.map(t => t.id);
      pruneMapsToIds(state.townResources, ids); save(STORE.TOWN_RES, state.townResources); renderWorld();
      gbLog(`towns scrape: ${state.towns.length} towns (${fromGame} via game data, ${fromHttp} via HTTP)`);
    };
    const gameTowns = townsFromGame();
    if (gameTowns && gameTowns.length) {
      if (gameTowns.length !== state.towns.length) gbLog(`towns: ${gameTowns.length} from game data`);
      state.towns = gameTowns; save(STORE.TOWNS, state.towns);
    } else if (!state.towns.length) {
      gbLogT('towns-fallback', 300000, 'towns: game data unavailable, HTTP fallback');
      fetchOwnedTowns();
      finish(0, 0);
      return;
    }
    let fromGame = 0;
    const http = [];
    for (const t of state.towns) {
      const r = townResourcesFromGame(t.id);
      if (r) {
        fromGame++;
        state.townResources[t.id] = {
          ts: Date.now(), wood: r.wood ?? null, stone: r.stone ?? null, iron: r.iron ?? null,
          pop: r.population ?? null, cap: r.storage ?? null, ok: true, action: 'game-data',
        };
      } else http.push(t);
    }
    if (!http.length) { finish(fromGame, 0); return; }
    let pending = http.length, completed = 0;
    http.forEach((t, i) => {
      gbTimeout(() => {
        if (!gbLockTouch('town-scrape', townScrapeLock, 300000)) return;
        fetchTownResources(t, () => {
          completed++; pending--;
          gbLockTouch('town-scrape', townScrapeLock, 300000);
          if (pending <= 0) finish(fromGame, completed);
        });
      }, i * 650);
    });
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
  function autoCollectResources() {
    if (!state.autoCollect) return;
    if (!hostEnabled() || automationPaused({}) || captchaPaused('collect') || circuitOpen('collect')) return;
    if (document.hidden) return;
    if (currentTownWarehouseBlocks()) {
      gbLogT('collect-wh-full', 60000, `auto-collect: skipped Recoger (warehouse full, mode=${state.farmFullMode})`);
      return;
    }
    const btns = Array.from(document.querySelectorAll(COLLECT_BTN_SEL));
    let attempted = 0, scanned = btns.length;
    const skipped = [];
    let currentTownId = null;
    try { currentTownId = gameUw().Game && gameUw().Game.townId; } catch (_) {}
    for (let bi = 0; bi < btns.length; bi++) {
      const btn = btns[bi];
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
      const beforeTime = (timeEl.textContent || '').trim();
      attempted++;
      txDomWrite('collect', `dom-collect:${currentTownId || '-'}:${min}:${bi}`,
        { town_id: currentTownId, minutes: min, dom_index: bi },
        () => {
          btn.dataset.grepbotClicked = String(Date.now());
          btn.click();
        },
        () => {
          if (!btn.isConnected || btn.disabled || btn.getAttribute('aria-disabled') === 'true') return true;
          const nowTime = (card.querySelector('.action_time')?.textContent || '').trim();
          return !!nowTime && nowTime !== beforeTime;
        },
        (err) => {
          if (err && err !== 'dryrun' && btn.isConnected) delete btn.dataset.grepbotClicked;
        });
    }
    updateCollectStateBadge(scanned, attempted);
    if (attempted) { gbLog(`auto-collect: attempted ${attempted}/${scanned} Recoger buttons`); flash(`auto-collect x${attempted}`); }
    else if (scanned > 0) gbLogT('collect-skip', 120000, `auto-collect: 0/${scanned} eligible`, skipped.slice(0, 4).join(', '));
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
    if (!state.autoCollect || !state.collectAll) return;
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
      gbLogT('collect-bg-nomethod', 120000, 'bg-collect: skip (learned URL method/controller unknown — no blind GET)');
      scheduleCollectBg(collectBgBackoff + Math.random() * 30_000);
      return;
    }
    const collectBgLock = gbLock('collect-bg', 300000);
    if (!collectBgLock) return;
    let pending = n;
    let errors = 0;
    const finish = () => {
      gbLockTouch('collect-bg', collectBgLock);
      if (--pending > 0) return;
      gbUnlock('collect-bg', collectBgLock);
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
      gbDomObserver = new MutationObserver((records) => {
        if (document.hidden) return;
        const nativeOnly=(records||[]).length&&(records||[]).every(r=>{const el=r.target&&r.target.nodeType===1?r.target:r.target&&r.target.parentElement;return !!(el&&el.closest&&el.closest('.gb-native-qctl,.gb-native-panel'))});
        if(nativeOnly)return;
        scheduleAutoCollect();
        if (state.autoBandit) scheduleBanditScan();
        scheduleNativeUiScan();
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
      try { gbDomObserver.observe(t, { childList:true,subtree:true,attributes:true,attributeFilter:['id','data-unit_id','data-unit-id','data-unit_type','data-unit-type','data-building_type','data-building-type','data-building','data-town-id','data-town_id','data-townid'] }); } catch (_) {}
    }
  }
  ensureDomObserver();
  let banditTimer = null;
  let banditAttackSentAt = 0;
  let banditIdleUntil = 0;
  function banditIdle(ms, cap) { banditIdleUntil = Date.now() + Math.min(ms, cap || 30000); }

  const BANDIT_ILLEGAL_IDS = /^(catapult|militia)$/i;
  const BANDIT_OFFENSE_IDS = /^(slinger|hoplite|rider|chariot|minotaur|manticore|cyclops?|zyklop|harpy|erinys|fury|centaur|griffin|satyr|giant|godsent)$/i;
  function banditIsOffenseUnit(uw, id) {

    if (BANDIT_ILLEGAL_IDS.test(id)) return false;
    if (/^(godsent|hoplite)$/i.test(id)) return true;
    try {
      const def = uw.GameData && uw.GameData.units && uw.GameData.units[id];
      const f = def && def.unit_function;
      if (f === 'function_off' || f === 'off') return true;
      if (f === 'function_def' || f === 'def') return false;
      if (f === 'function_both' || f === 'both' || f === 'function_none' || f === 'none') return false;
    } catch (_) {}
    return BANDIT_OFFENSE_IDS.test(id);
  }
  function banditAttackUnits(uw, rawUnits) {
    const units = Object.assign({}, rawUnits || {});
    delete units.militia;
    Object.keys(units).forEach(u => {
      if (BANDIT_ILLEGAL_IDS.test(u)) { delete units[u]; return; }
      try {
        const def = uw.GameData && uw.GameData.units && uw.GameData.units[u];
        if (!def || def.is_naval || def.naval) delete units[u];
      } catch (_) { delete units[u]; }
      if (units[u] != null && !banditIsOffenseUnit(uw, u)) delete units[u];
      if (!units[u]) delete units[u];
    });
    return units;
  }
  const BANDIT_TX_EVIDENCE_MAX_MS = 10 * 60 * 1000;
  function banditFlag(v) {
    if (v === true || v === 1) return true;
    const s = String(v == null ? '' : v).toLowerCase();
    return s === '1' || s === 'true';
  }
  function banditMovementTown(mov, a, outgoing) {
    const keys = outgoing
      ? ['origin_town_id','originTownId','home_town_id','homeTownId','town_id','townId','source_town_id','sourceTownId']
      : ['destination_town_id','destinationTownId','target_town_id','targetTownId','home_town_id','homeTownId','town_id','townId'];
    for (const k of keys) if (a[k] != null && a[k] !== '') return a[k];
    const methods = outgoing
      ? ['getOriginTownId','getHomeTownId','getTownId','getSourceTownId']
      : ['getDestinationTownId','getTargetTownId','getHomeTownId','getTownId'];
    for (const name of methods) {
      try {
        if (!mov || typeof mov[name] !== 'function') continue;
        const raw = mov[name]();
        const value = raw && typeof raw === 'object' ? (raw.id ?? (typeof raw.getId === 'function' ? raw.getId() : null)) : raw;
        if (value != null && value !== '') return value;
      } catch (_) {}
    }
    return null;
  }
  function banditMovementId(mov, a) {
    const attrId = a.command_id ?? a.movement_id ?? a.id ?? mov.id;
    if (attrId != null && attrId !== '') return attrId;
    for (const name of ['getCommandId','getMovementId','getId']) {
      try { if (mov && typeof mov[name] === 'function') { const value=mov[name](); if(value!=null&&value!=='')return value; } } catch (_) {}
    }
    return null;
  }
  function banditMovementEvidence(uw, townId) {
    const models = [], refs = new Set();
    let known = false;
    const push = mov => {
      if (!mov || typeof mov !== 'object') return;
      if (refs.has(mov)) return;
      refs.add(mov);
      models.push(mov);
    };
    const addCollection = col => {
      if (!col) return;
      if (Array.isArray(col)) { known = true; col.forEach(push); return; }
      if (Array.isArray(col.models)) { known = true; col.models.forEach(push); }
    };
    try { addCollection(uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('MovementsUnits')); } catch (_) {}
    try {
      const cols = uw.MM && uw.MM.getCollections && uw.MM.getCollections().MovementsUnits;
      (Array.isArray(cols) ? cols : (cols ? [cols] : [])).forEach(addCollection);
    } catch (_) {}
    try {
      const map = uw.MM && uw.MM.getModels && uw.MM.getModels().MovementsUnits;
      if (Array.isArray(map)) addCollection(map);
      else if (map && typeof map === 'object') { known = true; Object.keys(map).forEach(k => push(map[k])); }
    } catch (_) {}
    const facts = new Map();
    models.forEach((mov, index) => {
      const a = (mov && mov.attributes) || {};
      const outgoing = banditFlag(a.destination_is_attack_spot) || banditFlag(a.destinationIsAttackSpot);
      const returning = banditFlag(a.origin_is_attack_spot) || banditFlag(a.originIsAttackSpot);
      const rawId = banditMovementId(mov, a);
      const key = rawId != null && rawId !== '' ? `id:${rawId}` : `ref:${index}`;
      const fact = facts.get(key) || { outgoing:false, returning:false, towns:new Set() };
      fact.outgoing = fact.outgoing || outgoing;
      fact.returning = fact.returning || returning;
      if (outgoing || returning) {
        const movementTown = banditMovementTown(mov, a, outgoing);
        if (movementTown != null) fact.towns.add(String(movementTown));
      }
      facts.set(key, fact);
    });
    let count = 0, townCount = 0, townKnown = false, unscopedCount = 0;
    for (const fact of facts.values()) {
      if (!fact.outgoing && !fact.returning) continue;
      count++;
      if (fact.towns.size) {
        townKnown = true;
        if (townId == null || fact.towns.has(String(townId))) townCount++;
      } else unscopedCount++;
    }
    return { known, count, townKnown, townCount, unscopedCount };
  }
  function banditMovementReconcileResult(tx, evidence) {
    if (!evidence || !evidence.known) return 'unknown';
    const at = +(tx && (tx.sentAt || tx.createdAt || tx.updatedAt)) || 0;
    if (!at || Date.now() - at > BANDIT_TX_EVIDENCE_MAX_MS) return 'unknown';
    const s = (tx && tx.snapshot) || {};
    const scopedTx = tx && tx.meta && tx.meta.townId != null && Object.prototype.hasOwnProperty.call(s,'beforeTownMovementCount');
    const unscoped = evidence.unscopedCount != null ? +evidence.unscopedCount || 0 : (!evidence.townKnown ? +evidence.count || 0 : 0);
    if (scopedTx && unscoped > 0) return 'unknown';
    const useTown = !!evidence.townKnown;
    const current = useTown ? +evidence.townCount || 0 : +evidence.count || 0;
    let before = useTown ? s.beforeTownMovementCount : s.beforeMovementCount;

    if (before == null && useTown && +s.beforeMovementCount === 0) before = 0;
    if (before != null && Number.isFinite(+before)) return current > +before ? 'applied' : 'unchanged';

    return current > 0 ? 'applied' : 'unknown';
  }
  function banditCommitUnknownFromMovement(townId, evidence) {
    if (!evidence || !evidence.known || !(evidence.count > 0)) return 0;
    let committed = 0;
    for (const tx of Object.values(state.txState || {})) {
      if (!tx || tx.feature !== 'bandit' || tx.state !== 'unknown' || !/\/attack$/i.test(String(tx.endpoint || ''))) continue;
      if (townId != null && tx.meta && tx.meta.townId != null && String(tx.meta.townId) !== String(townId)) continue;
      if (banditMovementReconcileResult(tx, evidence) !== 'applied') continue;
      tx.state = 'committed'; tx.updatedAt = Date.now(); tx.detail = 'movement model confirmed';
      plannerCommit(tx); committed++;
      jrnPush({ f:'bandit', a:String(tx.endpoint || '').slice(0,48), k:String(tx.intent || '-').slice(0,120) }, 'ok', tx.detail, tx.id);
      markModuleHealth('bandit', 'ok'); circuitSuccess('bandit');
    }
    if (committed) { banditAttackSentAt = Date.now(); banditIdle(60000); txSave(); }
    return committed;
  }
  function banditRecentlyCommitted(townId, withinMs) {
    const cut = Date.now() - Math.max(1000, +withinMs || 60000);
    return Object.values(state.txState || {}).some(tx => tx && tx.feature === 'bandit' && tx.state === 'committed'
      && /\/attack$/i.test(String(tx.endpoint || '')) && (+tx.updatedAt || 0) >= cut
      && (townId == null || !tx.meta || tx.meta.townId == null || String(tx.meta.townId) === String(townId)));
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
      const townId = uw.Game && uw.Game.townId;
      const movement = banditMovementEvidence(uw, townId);

      const earlyReconciled = movement.known && movement.count > 0 ? banditCommitUnknownFromMovement(townId, movement) : 0;
      if (m.hasReward && m.hasReward()) {
        if (gbLocked('bandit-reward')) {
          gbLogT('bandit-reward-inflight', 10000, 'bandit: reward claim in flight');
          return true;
        }
        const r = (m.getReward && m.getReward()) || {};
        const pid = r.power_id || '';
        const action = (pid.includes('instant') && !pid.includes('favor')) ? 'useReward'
          : (r.stashable ? 'stashReward' : 'useReward');
        const rewardLock = gbLock('bandit-reward');
        if (!rewardLock) return true;
        banditIdleUntil = 0;
        gbLog('bandit: reward claim posted via', action, pid || '(no power_id)');
        post(action, {}, (err) => {
          gbUnlock('bandit-reward', rewardLock);
          if (err) { gbLog('bandit: reward claim failed', err); return; }
          gbLog('bandit: reward claimed via', action, pid || '(no power_id)');
          flash('bandido: recompensa reclamada');
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
      if (!movement.known) {
        gbLogT('bandit-movement-loading', 60000, 'bandit: waiting for movement collection');
        banditIdle(15000);
        return true;
      }
      if (movement.count > 0) {
        const reconciled = earlyReconciled || banditCommitUnknownFromMovement(townId, movement);
        gbLogT('bandit-enroute', 60000, `bandit: attack already en route${reconciled ? ' (transaction reconciled)' : ''}`);
        banditIdle(15000);
        return true;
      }
      if (Date.now() - banditAttackSentAt < 8000) {
        gbLogT('bandit-sent-guard', 10000, 'bandit: waiting for movement model after attack');
        banditIdle(8000);
        return true;
      }
      if (banditRecentlyCommitted(townId, 60000)) {
        gbLogT('bandit-committed-guard', 30000, 'bandit: recent attack confirmed; waiting for game state refresh');
        banditIdle(30000);
        return true;
      }
      if (townId != null && townWarehouseBlocks(townId)) {
        gbLogT('bandit-wh-full', 60000, `bandit: skip attack (warehouse full, mode=${state.farmFullMode})`);
        banditIdle(30000);
        return true;
      }
      if (banditWrongIsland(uw, m)) {
        gbLogT('bandit-island', 60000, 'bandit: camp on other island — switch town or skip');
        banditIdle(30000);
        return true;
      }
      const t = uw.ITowns && uw.ITowns.towns && uw.ITowns.towns[uw.Game.townId];
      if (!t || !t.units) { gbLogT('bandit-notown', 60000, 'bandit: current town units unavailable'); return true; }
      const units = banditAttackUnits(uw, t.units());
      if (!Object.keys(units).length) { gbLogT('bandit-nounits', 60000, 'bandit: no offense units in current town'); banditIdle(30000); return true; }
      post('attack', units, (err) => {
        if (err) {
          if (err === 'timeout_unknown' || err === 'pending') {
            banditAttackSentAt = Date.now();
            banditIdle(60000);
            gbLog('bandit: attack outcome unknown; transaction reconciliation required before retry');
          } else {
            banditAttackSentAt = 0;
            banditIdleUntil = 0;
            gbLog('bandit: attack failed', err);
          }
          return;
        }
        banditAttackSentAt = Date.now();
        gbLog('bandit: ATTACK confirmed', JSON.stringify(units));
        flash('bandido: ataque enviado');
        logBandit('attack');
      });
      banditAttackSentAt = Date.now();
      banditIdle(30000);
      gbLog('bandit: ATTACK posted (await confirm)', JSON.stringify(units));
    } catch (e) { gbLog('bandit game-path fail', String(e)); }
    return true;
  }
  function banditScan() {
    if (txPrune()) txSave();
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

      gbLogT('bandit-dom-disabled', 120000, 'bandit: game bridge unavailable — DOM write fallback disabled (read-only fail closed)');
      banditIdle(30000);
      return;
    } finally {
      banditScheduleNext();
    }
  }
  let banditLoopTimer = null;
  function banditClearLoop() {
    if (banditLoopTimer) {
      try { gbClearTimeout(banditLoopTimer); } catch (_) {}
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
  gbInterval(autoCollectResources, 5000);
  if (state.autoCollect && state.collectAll) collectAllBackground();

  const IB_CHECK_MS = 10000;
  const IB_FREE_ACTIONS = new Set(['buyInstant']);
  const IB_FREE_SERVER_MARGIN_SEC = 10;
  function ibFreeThresh() { return Math.max(1,Math.min(300,+state.ibFreeThresh||300)); }
  function ibSafeFreeThresh(){return Math.min(300-IB_FREE_SERVER_MARGIN_SEC,ibFreeThresh());}

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
    return Number.isFinite(+timeLeft) && +timeLeft > 0 && +timeLeft <= ibSafeFreeThresh() && gold === 0;
  }
  function ibOrderStillPresent(orderId,kind) {
    return ibOrders(true).some(o => String(o.id) === String(orderId) && (kind==null||o.kind===kind));
  }
  function ibFindLiveOrder(orderId, kind) {
    return ibOrders(true).find(o => String(o.id) === String(orderId) && (kind == null || o.kind === kind)) || null;
  }
  function ibUnknownActionErr(err) {
    return /unknown.?action|invalid.?action|action.?not.?found|does.?not.?exist|no.?such.?action/i.test(String(err || ''));
  }

  function ibResetLearnedAction(kind, err) {
    if (!ibUnknownActionErr(err)) return;
    const cur = kind === 'research' ? state.ibActionR : state.ibAction;
    if (!cur) return;
    if (kind === 'research') { state.ibActionR = null; save(wkey(STORE.IB_ACTION_R), null); }
    else { state.ibAction = null; save(wkey(STORE.IB_ACTION), null); }
    gbLogT('ib-relearn', 60000,
      'instant: learned action ' + cur + ' rejected - reset to default, hand-click one free complete to re-learn');
  }
  function ibJrnPayload(order) {
    const kind = order.kind || 'build';
    return {
      model_url: order.modelUrl || ((kind === 'research' ? 'ResearchOrder/' : 'BuildingOrder/') + order.id),
      action_name: ibActionFor(kind),
      arguments: { order_id: order.id },
      town_id: order.town_id,
    };
  }

  let ibFreeTimer = null;
  let ibFreeArmedAt = 0;
  function ibArmNext(orders) {
    const now = Date.now();
    const thresh = ibFreeThresh() * 1000;
    let best = 0;
    (orders || []).forEach(o => {

      if (o.isFree || !o.isHead || !(o.display > 0)) return;
      const armIn = (o.display * 1000) - thresh;
      if (armIn <= 0) return;
      const at = now + armIn;
      if (!best || at < best) best = at;
    });
    if (!best) {
      if (ibFreeTimer) gbClearTimeout(ibFreeTimer);
      ibFreeTimer = null;
      ibFreeArmedAt = 0;
      return;
    }

    const fireAt = best + 1200 + Math.floor(Math.random() * 1500);
    if (ibFreeTimer && ibFreeArmedAt && Math.abs(ibFreeArmedAt - fireAt) < 3000) return;
    if (ibFreeTimer) gbClearTimeout(ibFreeTimer);
    ibFreeArmedAt = fireAt;
    ibFreeTimer = gbTimeout(() => {
      ibFreeTimer = null;
      ibFreeArmedAt = 0;
      ibScan();
    }, Math.max(500, fireAt - now));
    gbLogT('ib-arm', 60000, `instant: armed in ${fmtSec((fireAt - now) / 1000)} (free window at <=${ibFreeThresh()}s)`);
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

  function ibHeadIds(cols) {
    const groups=new Map(),seen=new Set();let seq=0;
    for(const col of cols||[])for(const model of ((col&&col.models)||[])){
      const r=model.attributes||model,id=String(r.id==null?'':r.id),town=String(r.town_id==null?'':r.town_id);
      if(!id||!town||seen.has(id))continue;seen.add(id);
      if(!groups.has(town))groups.set(town,[]);groups.get(town).push({r,id,seq:seq++});
    }
    const heads=new Map();
    const finite=(v,positive)=>{const n=+v;return Number.isFinite(n)&&(!positive||n>0)?n:null};
    const uniqueMin=(rows,get)=>{const vals=rows.map(x=>get(x.r));if(vals.some(v=>v==null))return null;const min=Math.min(...vals),hits=vals.reduce((n,v)=>n+(v===min?1:0),0);return hits===1?rows[vals.indexOf(min)]:null};
    for(const [town,rows] of groups){if(rows.length===1){heads.set(town,rows[0].id);continue}
      const byPos=uniqueMin(rows,r=>finite(r.queue_position??r.position??r.queue_index??r.sort_index,false));
      const byDone=byPos||uniqueMin(rows,r=>finite(r.to_be_completed_at??r.toBeCompletedAt??r.completed_at,true));
      const byCreated=byDone||uniqueMin(rows,r=>finite(r.created_at??r.createdAt,true));

      if(byCreated)heads.set(town,byCreated.id)}
    return heads;
  }

  function ibResearchOrders(names) {
    const now = gameNow();
    const out = [];
    const uw = uwCached();
    const cols = [],colRefs=new Set();
    const addCol=col=>{if(col&&Array.isArray(col.models)&&col.models.length&&!colRefs.has(col)){colRefs.add(col);cols.push(col)}};
    try {
      const col = mmCol('ResearchOrder');
      addCol(col);
    } catch (_) {}
    try {
      const towns=uw.ITowns&&uw.ITowns.towns||{};
      for(const town of Object.values(towns)){
        for(const fn of ['getResearchOrdersCollection','researchOrders','getResearchOrders']){
          try{if(town&&typeof town[fn]==='function')addCol(town[fn]())}catch(_){}
        }
      }
    } catch (_) {}
    let gpCols = null;
    try { gpCols = uw.GPWindowMgr && uw.GPWindowMgr._collections; } catch (_) {}
    if (gpCols) Object.keys(gpCols).forEach(k => { if (k.indexOf('research_orders') === 0) addCol(gpCols[k]); });
    if (!cols.length) return out;
    const headIds=ibHeadIds(cols);
    const seenIds = new Set();
    cols.forEach(col => {
      (col.models || []).forEach(model => {
        const r = model.attributes || model;
        const rid=String(r.id==null?'':r.id);if (!rid || !r.town_id || seenIds.has(rid)) return;
        seenIds.add(rid);
        const doneAt = r.to_be_completed_at || r.toBeCompletedAt || r.completed_at || 0;
        const timeLeft = doneAt ? Math.max(0, doneAt - now) : (r.research_time || 0);
        const isFirst = headIds.get(String(r.town_id)) === String(r.id);
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
          timeLeft,
          isHead: isFirst,
          isFree: isFirst && ibIsFreeOrder(doneAt, timeLeft, gold),
          gold,
        });
      });
    });
    return out;
  }
  function ibOrders(includeAllResearch) {
    const now = gameNow();
    const out = [];
    const uw = uwCached();
    const names = ibTownNames(uw);
    const research = (includeAllResearch||state.ibResearch) ? ibResearchOrders(names) : [];
    let candidates = [], src = null;
    try {
      const col = mmCol('BuildingOrder');
      if (col && col.models && col.models.length) { candidates.push(col); src = 'MM'; }
    } catch (_) {}

    try {
      const townModels=uw.ITowns&&uw.ITowns.towns||{};
      for(const town of Object.values(townModels)){
        const col=town&&town.buildingOrders&&town.buildingOrders();
        if(col&&col.models&&col.models.length)candidates.push(col);
      }
      if(candidates.length&&!src)src='ITowns';else if(candidates.length>1&&src)src+='+ITowns';
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
    const headIds=ibHeadIds(candidates);
    const seenIds = new Set();
    candidates.forEach(col => {
      (col.models || []).forEach(model => {
        const r = model.attributes || model;
        const rid=String(r.id==null?'':r.id);if (!rid || !r.town_id || seenIds.has(rid)) return;
        seenIds.add(rid);

        const doneAt = r.to_be_completed_at || r.toBeCompletedAt || r.completed_at || 0;
        const timeLeft = doneAt ? Math.max(0, doneAt - now) : (r.building_time || 0);
        const isFirst = headIds.get(String(r.town_id)) === String(r.id);

        const display = isFirst ? timeLeft : (r.building_time || 0);
        const instantLeft = display;
        const gold = ibGoldCost('build', instantLeft);
        out.push({
          id: r.id,
          kind: 'build',
          modelUrl: 'BuildingOrder/' + r.id,
          town_id: r.town_id,
          townName: names[r.town_id] || ('Town ' + r.town_id),
          type: r.building_type || '?',
          display,
          timeLeft,
          instantLeft,
          isHead: isFirst,

          isFree: ibIsFreeOrder(doneAt, instantLeft, gold),
          gold,
        });
      });
    });
    return out.concat(research);
  }
  function ibActionFor(kind) {
    const raw = kind === 'research'
      ? (state.ibActionR || 'buyInstant')
      : (state.ibAction || 'buyInstant');
    return IB_FREE_ACTIONS.has(String(raw))?String(raw):'buyInstant';
  }
  function ibLearnAction(kind, action) {
    if (!IB_FREE_ACTIONS.has(String(action))) {
      gbLogT('ib-learn-refuse', 60000, 'instant: unsupported action ' + action + ' — only buyInstant is allowed behind a verified zero-gold guard');
      return;
    }
    if (kind === 'research') { state.ibActionR = action; save(wkey(STORE.IB_ACTION_R), action); }
    else { state.ibAction = action; save(wkey(STORE.IB_ACTION), action); }
  }
  function ibComplete(order) {
    return new Promise(resolve => {
      const kind = order.kind || 'build';
      const tag = kind === 'research' ? 'instant-research' : 'instant-build';
      if (!hostEnabled() || captchaPaused(tag)) { resolve('pause'); return; }

      const live = ibFindLiveOrder(order.id, kind);
      const instantLeft = live && Number.isFinite(+live.instantLeft) ? +live.instantLeft : +(live && live.timeLeft);

      const positionAllowed = kind === 'build' || (live && live.isHead === true);
      if (!live || !positionAllowed || !live.isFree || live.gold !== 0 || !(instantLeft > 0) || instantLeft > ibSafeFreeThresh()) {
        gbLogT('ib-stale', 30000, `${tag}: #${order.id} no longer safely free (instantLeft=${instantLeft}, queueLeft=${live&&live.timeLeft}, head=${live&&live.isHead}, gold=${live&&live.gold})`);
        resolve('skip');
        return;
      }
      const modelUrl = live.modelUrl || order.modelUrl || ('BuildingOrder/' + order.id);
      const action = ibActionFor(kind);
      const intent=`instant:${live.town_id}:${kind}:${order.id}`;
      if(state.txState&&state.txState[intent]&&state.txState[intent].state==='committed'){
        gbLogT('ib-recent-'+kind+'-'+order.id,30000,`${tag}: #${order.id} already accepted; waiting for model update`);
        resolve('accepted');return;
      }
      const finishOk = () => {
        const waits=[0,150,500,1200,2500];let i=0;
        const check=()=>{
          if(!ibOrderStillPresent(order.id,kind)){gbLog(`${tag}: ${live.type} #${order.id} OK`);resolve('ok');return}
          if(i>=waits.length){gbLog(`${tag}: ${live.type} #${order.id} accepted; model update pending`);resolve('accepted');return}
          gbTimeout(check,waits[i++]);
        };check();
      };
      const postFree = () => {
        bridgePost(tag, {
          model_url: modelUrl,
          action_name: action,
          captcha: null,
          arguments: { order_id: order.id },
          town_id: live.town_id,
          nl_init: true,
        }, (err, data) => {
          if (err === 'captcha' || err === 'captcha-pause') { resolve('captcha'); return; }
          if (err === 'timeout' || err === 'timeout_unknown' || err === 'pending') {
            if (!ibOrderStillPresent(order.id,kind)) {
              gbLog(`${tag}: #${order.id} timeout but order gone — treating as OK`);
              resolve('ok');
            } else {
              gbLog(`${tag}: #${order.id} timeout_unknown — no retry`);
              resolve('unknown');
            }
            return;
          }

          if (err === 'tpl-stale' || err === 'budget' || err === 'disabled' || err === 'dryrun'
              || err === 'remembered' || err === 'circuit-open') {
            gbLogT('ib-gate-' + err, 60000, `${tag}: #${order.id} not sent (${err})`);
            resolve('skip');
            return;
          }
          if (err) {
            ibResetLearnedAction(kind, err);
            gbLog(tag + ' complete error: ' + err);
            resolve('err');
            return;
          }
          const e = data && data.error;
          if (e) {
            gbLog(`${tag}: ${live.type} #${order.id} ERR ` + JSON.stringify(data).slice(0, 120));
            resolve('err');
            return;
          }
          finishOk();
        });
      };
      postFree();
    });
  }
  function ibCompleteAll(orders) {
    if (gbLocked('ib')) return;
    const free = (orders || ibOrders()).filter(o => o.isFree);
    if (!free.length) return;
    const ibLockToken = gbLock('ib', Math.max(300000, free.length * (BRIDGE_TIMEOUT_MS + 5000)));
    if (!ibLockToken) return;
    renderBuild();
    let i = 0, done = 0, captcha = false;
    const unlock = () => { gbUnlock('ib', ibLockToken); };

    const watchdog = gbTimeout(unlock, Math.max(30000, free.length * (BRIDGE_TIMEOUT_MS + 5000)));
    (function next() {
      gbLockTouch('ib', ibLockToken);
      if (i >= free.length || captcha) {
        try { gbClearTimeout(watchdog); } catch (_) {}
        unlock();
        gbLog(`instant: completed ${done}/${free.length}${captcha ? ' (captcha abort)' : ''}`);
        if (done) flash(`instant x${done}`);
        gbTimeout(ibScan, 3000);
        return;
      }
      ibComplete(free[i]).then(res => {
        if (res === 'ok' || res === 'accepted') done++;
        if (res === 'captcha') captcha = true;
        i++;
        gbTimeout(next, 400 + Math.random() * 200);
      });
    })();
  }
  function ibScan() {
    const orders = ibOrders();
    renderBuild(orders);
    ibArmNext(orders);
    if (!state.ibAuto || gbLocked('ib')) return;
    const free = orders.filter(o => o.isFree);
    if (!free.length) return;

    const live = free.filter(o => {
      const why = gbSkipActive('build', ibJrnPayload(o));
      if (!why) return true;
      gbLogT('ib-mem-' + o.town_id, 60000, `instant: #${o.id} skipped from memory (${why})`);
      return false;
    });
    if (!live.length) return;
    gbLog(`instant: ${live.length} free order(s), auto-completing`);
    ibCompleteAll(live);
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

  const GOAL_PROFILE_DEFAULTS = {
    custom: { label:'Personalizado', build:{}, research:{}, units:{}, reserve:{} },
    economy: { label:'Economía', build:{main:15,storage:20,farm:20,market:10,lumber:20,stoner:20,ironer:20}, research:{}, units:{}, reserve:{soft:{wood:5000,stone:5000,iron:5000,population:100}} },
    offense_land: { label:'Ofensiva terrestre', build:{main:15,storage:20,farm:25,barracks:20,academy:20}, research:{}, units:{}, reserve:{soft:{wood:5000,stone:5000,iron:5000,population:150}} },
    defense_land: { label:'Defensiva terrestre', build:{main:15,storage:20,farm:25,barracks:20,wall:20,academy:15}, research:{}, units:{}, reserve:{soft:{wood:5000,stone:5000,iron:5000,population:150}} },
    offense_naval: { label:'Ofensiva naval', build:{main:15,storage:20,farm:25,docks:20,academy:20}, research:{}, units:{}, reserve:{soft:{wood:7000,stone:5000,iron:7000,population:150}} },
    defense_naval: { label:'Defensiva naval', build:{main:15,storage:20,farm:25,docks:20,wall:15,academy:15}, research:{}, units:{}, reserve:{soft:{wood:7000,stone:5000,iron:7000,population:150}} },
    conquest: { label:'Conquista / CS', build:{main:25,storage:25,farm:30,academy:30,docks:20,market:15}, research:{colonize_ship:1}, units:{colonize_ship:1}, reserve:{hard:{wood:10000,stone:10000,iron:10000,population:170}} },
    favor: { label:'Favor / míticas', build:{main:15,storage:20,farm:25,temple:20,academy:20}, research:{}, units:{}, reserve:{soft:{wood:5000,stone:5000,iron:5000,population:100}} },
  };
  function goalProfiles() {
    if (!state.goalProfiles || typeof state.goalProfiles !== 'object') state.goalProfiles={};
    return Object.assign({}, GOAL_PROFILE_DEFAULTS, state.goalProfiles);
  }
  function goalTownCfg(townId) {
    if (!state.townGoals || typeof state.townGoals !== 'object') state.townGoals={};
    const id=String(townId); let g=state.townGoals[id];
    if (!g || typeof g !== 'object') g=state.townGoals[id]={profile:'custom',build:{},research:{},units:{},reserve:{}};
    if (!g.profile) g.profile='custom';
    for (const k of ['build','research','units','reserve']) if (!g[k] || typeof g[k] !== 'object') g[k]={};
    return g;
  }
  function goalMergeMap(base, over) { const o=Object.assign({},base||{}); for(const [k,v] of Object.entries(over||{})) o[k]=v; return o; }
  function goalEffective(townId) {
    const cfg=goalTownCfg(townId), p=goalProfiles()[cfg.profile]||GOAL_PROFILE_DEFAULTS.custom;
    return { profile:cfg.profile, label:p.label||cfg.profile,
      build:goalMergeMap(p.build,cfg.build), research:goalMergeMap(p.research,cfg.research), units:goalMergeMap(p.units,cfg.units),
      reserve:{ hard:goalMergeMap((p.reserve||{}).hard,(cfg.reserve||{}).hard), soft:goalMergeMap((p.reserve||{}).soft,(cfg.reserve||{}).soft) } };
  }
  function goalReservePolicy(townId) { const e=goalEffective(townId); return e && e.reserve; }
  function goalEffectiveBuildTargets(townId) {
    const cfg=goalTownCfg(townId), e=goalEffective(townId), base=abEnsureTargets();
    const out=(cfg.profile && cfg.profile!=='custom')?Object.assign({},e.build||{}):goalMergeMap(base,cfg.build||{});
    for(const id of Object.keys(out))if(goalQueueSuppressed(townId,'build',id))delete out[id];
    return out;
  }
  function goalEffectiveResearchTargets(townId, globalTargets) {
    const cfg=goalTownCfg(townId), e=goalEffective(townId); const base=(cfg.profile&&cfg.profile!=='custom')?{}:Object.assign({},globalTargets||researchEnsureTargets());
    let maxOrder=Object.values(base).reduce((m,x)=>Math.max(m,+((x&&x.order)||0)),0)+1;
    for(const [tech,v] of Object.entries(e.research||{})) {
      if(!+v){ if(base[tech]) base[tech]=Object.assign({},base[tech],{tgt:0}); continue; }
      base[tech]=Object.assign({order:maxOrder++,tgt:1},base[tech]||{},{tgt:1});
    }
    for(const tech of Object.keys(base))if(goalQueueSuppressed(townId,'research',tech))delete base[tech];
    const ordered=goalOrderIds(townId,'research',Object.keys(base).sort((a,b)=>(+base[a].order||0)-(+base[b].order||0)));
    ordered.forEach((tech,i)=>{base[tech].order=i});
    return base;
  }
  function goalEffectiveRecruitTargets() {
    const raw=JSON.parse(JSON.stringify(state.recruitTargets||{})),out={};
    let ids=[]; try{ids=Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{})}catch(_){}
    for(const tid of ids){ const e=goalEffective(tid),cfg=goalTownCfg(tid),m=Object.assign({},raw[tid]||{}); for(const [u,n] of Object.entries(e.units||{})) if(+n>0)m[u]=Math.max(+m[u]||0,+n);for(const[u,n]of Object.entries(cfg.units||{})){if(+n>0)m[u]=+n;else delete m[u]} const ordered=goalOrderIds(tid,'recruit',Object.keys(m));out[tid]={};for(const u of ordered)if(!goalQueueSuppressed(tid,'recruit',u))out[tid][u]=m[u]; }
    return out;
  }
  function goalResearchDependencies(townId, tech) {
    const def=researchDef(tech); if(!def) return {ok:false,why:'research-definition-unreadable',build:[],research:[]};
    const b=[],r=[]; const bd=def.building_dependencies||def.required_buildings||{};
    for(const [id,raw] of Object.entries(bd)){ const level=+(raw&&typeof raw==='object'?(raw.level??raw.min_level??raw.value):raw)||0; if(level>0)b.push({id,level}); }
    const ad=+(def.academy_level??def.required_academy_level??def.building_level??def.level??0); if(ad>0)b.push({id:'academy',level:ad});
    const rd=def.research_dependencies||def.dependencies||[]; const list=Array.isArray(rd)?rd:Object.keys(rd||{}).filter(k=>rd[k]);
    for(const x of list){const id=typeof x==='string'?x:(x&&(x.id||x.research_id||x.research_type));if(id)r.push(id)}
    return {ok:true,build:b,research:r};
  }
  function goalUnitDependencies(unit) {
    const d=recruitUnitDef(unit); if(!d) return {ok:false,why:'unit-definition-unreadable',build:[],research:[]};
    const build=[]; if(d.god||d.mythical||d.is_mythical) build.push({id:'temple',level:1}); else if(d.is_naval||d.naval) build.push({id:'docks',level:1}); else build.push({id:'barracks',level:1});
    const need=d.research_required||d.research_dependencies||[]; const list=Array.isArray(need)?need:[need]; const research=list.filter(Boolean).map(x=>typeof x==='string'?x:(x.id||x.research_id||x.research_type)).filter(Boolean);
    return {ok:true,build,research};
  }
  function goalUnitCounts(townId) {
    const out={};try{const t=gbTownModel(townId);const local=t&&t.units&&t.units();for(const[k,n]of Object.entries(local||{}))out[k]=(+out[k]||0)+(+n||0);const outer=t&&t.unitsOuter&&t.unitsOuter();for(const[k,n]of Object.entries(outer||{}))out[k]=(+out[k]||0)+(+n||0)}catch(_){}return out;
  }
  function goalPlanTown(townId) {
    const e=goalEffective(townId), levels=abCurrentLevels(townId); if(!levels)return {townId:String(townId),profile:e.profile,error:'levels-unreadable',actions:[]};
    const sim=Object.assign({},levels), actions=[], maxActions=40; const av=plannerAvailable(townId,{allowSoft:false});
    const ledger=av?Object.assign({},av):null;
    const buildTargets=e.build||{};

    const base=abEnsureOrder();
    const order=base.concat(Object.keys(buildTargets).filter(k=>!base.includes(k)));
    let guard=0;
    while(actions.length<maxActions && guard++<100){ let added=false;
      for(const target of order){const want=+buildTargets[target]||0;if(!want||+(sim[target]||0)>=want)continue;
        const dep=abResolvePrerequisite(townId,target,sim); if(!dep||!dep.building){actions.push({kind:'build',id:target,status:'blocked',why:dep&&dep.error||'dependency'});sim[target]=want;added=true;break}
        const b=dep.building,c=abBuildingCost(townId,b);if(!c){actions.push({kind:'build',id:b,status:'blocked',why:'cost-unreadable'});sim[b]=Math.max(sim[b]||0,want);added=true;break}
        const next=+(sim[b]||0)+1; const costExact=next===(+(levels[b]||0)+1); let status=costExact?'planned':'planned-recalc',why=dep.reason||'';
        if(!costExact) why=why?why+'; future level cost recalculated after prior build':'future level cost recalculated after prior build';
        if(ledger&&costExact){for(const k of PLANNER_KEYS){const n=+c[k]||0;if(n>+(ledger[k]||0)){status='waiting-resources';why=`${k} ${Math.floor(ledger[k]||0)}/${n}`;break}} if(status==='planned')for(const k of PLANNER_KEYS)ledger[k]-=+c[k]||0;}
        actions.push({kind:'build',id:b,level:next,forTarget:target,cost:c,costExact,status,why});sim[b]=next;added=true;break;
      }
      if(!added)break;
    }
    let info=null; try{info=researchTownTechs(townId)}catch(_){}
    for(const [tech,on] of Object.entries(e.research||{})){if(!+on)continue;if(info&&info.techs&&info.techs[tech])continue;if(info&&(info.orders||[]).some(o=>String(researchOrderTechId(o))===String(tech)))continue;
      const dep=goalResearchDependencies(townId,tech);let status=dep.ok?'planned':'blocked',why=dep.why||'';
      if(dep.ok){for(const b of dep.build)if(+(sim[b.id]||0)<b.level){status='waiting-dependency';why=`${b.id} ${sim[b.id]||0}/${b.level}`;break} for(const r of dep.research)if(!(info&&info.techs&&info.techs[r])){status='waiting-dependency';why=`research:${r}`;break}}
      const cost=researchCost(tech);if(!cost){status='blocked';why='cost-unreadable'}
      actions.push({kind:'research',id:tech,cost,status,why});
    }
    let t=null;try{t=gbTownModel(townId)}catch(_){}; const have=goalUnitCounts(townId);
    for(const [unit,target] of Object.entries(e.units||{})){const tgt=+target||0;if(!(tgt>0))continue;let queued=0;try{const c=t.getUnitOrdersCollection&&t.getUnitOrdersCollection();for(const m of((c&&c.models)||[])){const a=m.attributes||{};if(String(a.unit_type||a.unit_id||a.type)===unit)queued+=+(a.count||a.amount||0)}}catch(_){}
      const need=tgt-(+have[unit]||0)-queued;if(need<=0)continue;const dep=goalUnitDependencies(unit);let status=dep.ok?'planned':'blocked',why=dep.why||'';if(dep.ok){for(const b of dep.build)if(+(sim[b.id]||0)<b.level){status='waiting-dependency';why=`${b.id}`;break}}
      const d=recruitUnitDef(unit),cost=d&&d.resources?{wood:(+d.resources.wood||0)*need,stone:(+d.resources.stone||0)*need,iron:(+d.resources.iron||0)*need,population:(+d.population||0)*need}:null;if(!cost){status='blocked';why='cost-unreadable'}
      actions.push({kind:'recruit',id:unit,amount:need,cost,status,why});
    }
    const decorated=goalQueueDecorate(townId,actions.slice(0,maxActions));
    const plan={townId:String(townId),profile:e.profile,label:e.label,progress:goalProgress(townId),generatedAt:Date.now(),actions:decorated};
    const prev=state.virtualQueue[String(townId)], sig=JSON.stringify({profile:plan.profile,actions:plan.actions}); const prevSig=prev&&JSON.stringify({profile:prev.profile,actions:prev.actions});
    state.virtualQueue[String(townId)]=plan; if(sig!==prevSig) save(STORE.VIRTUAL_QUEUE,state.virtualQueue); return plan;
  }
  function goalPlanAll(){let ids=[];try{ids=Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{})}catch(_){};return ids.map(goalPlanTown)}
  function goalSetProfile(townId,profile){const g=goalTownCfg(townId);if(!goalProfiles()[profile])return false;g.profile=profile;save(STORE.TOWN_GOALS,state.townGoals);goalPlanTown(townId);return true}
  function goalQueueCfg(townId) {
    if (!state.virtualQueueOverrides || typeof state.virtualQueueOverrides !== 'object' || Array.isArray(state.virtualQueueOverrides)) state.virtualQueueOverrides = {};
    const id=String(townId); let q=state.virtualQueueOverrides[id];
    if(!q||typeof q!=='object'||Array.isArray(q)) q=state.virtualQueueOverrides[id]={order:[],blocked:{},mandatory:{},hidden:{}};
    if(!Array.isArray(q.order))q.order=[]; for(const k of ['blocked','mandatory','hidden'])if(!q[k]||typeof q[k]!=='object'||Array.isArray(q[k]))q[k]={};
    return q;
  }
  function goalActionKey(aOrKind,id){ if(typeof aOrKind==='object'&&aOrKind)return `${aOrKind.kind}:${aOrKind.id}`; return `${aOrKind}:${id}`; }
  function goalQueueSave(){ save(STORE.VIRTUAL_QUEUE_OVERRIDES,state.virtualQueueOverrides); }
  function goalQueueSuppressed(townId,kind,id){const q=goalQueueCfg(townId),k=goalActionKey(kind,id);return !!(q.blocked[k]||q.hidden[k]);}
  function goalQueueRank(townId,kind,id){const q=goalQueueCfg(townId),k=goalActionKey(kind,id),i=q.order.indexOf(k);return {mandatory:!!q.mandatory[k],index:i<0?9999:i,key:k};}
  function goalOrderIds(townId,kind,ids){const seen=new Set(),base=(ids||[]).map(String).filter(x=>x&&!seen.has(x)&&seen.add(x));return base.filter(id=>!goalQueueSuppressed(townId,kind,id)).sort((a,b)=>{const A=goalQueueRank(townId,kind,a),B=goalQueueRank(townId,kind,b);return (B.mandatory-A.mandatory)||(A.index-B.index)||(base.indexOf(a)-base.indexOf(b));});}
  function goalBuildOrder(townId,extra){const base=abEnsureOrder();return goalOrderIds(townId,'build',base.concat((extra||[]).filter(k=>!base.includes(k))));}
  function goalQueueDecorate(townId,actions){const q=goalQueueCfg(townId);const arr=(actions||[]).filter(a=>!q.hidden[goalActionKey(a)]).map(a=>{const key=goalActionKey(a),blocked=!!q.blocked[key];return Object.assign({},a,{queueKey:key,mandatory:!!q.mandatory[key],status:blocked?'user-blocked':a.status,why:blocked?'blocked by user':a.why});});return arr.sort((a,b)=>{const A=goalQueueRank(townId,a.kind,a.id),B=goalQueueRank(townId,b.kind,b.id);return (B.mandatory-A.mandatory)||(A.index-B.index);});}
  function goalQueueMove(townId,key,delta){const q=goalQueueCfg(townId);const clean=q.order.filter(x=>x!==key);let idx=q.order.indexOf(key);if(idx<0)idx=clean.length;idx=Math.max(0,Math.min(clean.length,idx+(+delta||0)));clean.splice(idx,0,key);q.order=clean;goalQueueSave();goalPlanTown(townId);return true;}
  function goalQueueToggleBlock(townId,key){const q=goalQueueCfg(townId);if(q.blocked[key])delete q.blocked[key];else q.blocked[key]=true;delete q.hidden[key];goalQueueSave();goalPlanTown(townId);return !!q.blocked[key];}
  function goalQueueToggleMandatory(townId,key){const q=goalQueueCfg(townId);if(q.mandatory[key])delete q.mandatory[key];else q.mandatory[key]=true;goalQueueSave();goalPlanTown(townId);return !!q.mandatory[key];}
  function goalQueueHide(townId,key){const q=goalQueueCfg(townId);q.hidden[key]=true;q.blocked[key]=true;goalQueueSave();goalPlanTown(townId);return true;}
  function goalQueueReset(townId){delete state.virtualQueueOverrides[String(townId)];goalQueueSave();goalPlanTown(townId);return true;}
  function goalSetTownOverrides(townId,obj){if(!obj||typeof obj!=='object'||Array.isArray(obj))return false;const g=goalTownCfg(townId),cleanMap=v=>{const o={};if(v&&typeof v==='object'&&!Array.isArray(v))for(const[k,n]of Object.entries(v))if(Number.isFinite(+n)&&+n>=0)o[k]=+n;return o;};if(obj.build!=null)g.build=cleanMap(obj.build);if(obj.research!=null)g.research=cleanMap(obj.research);if(obj.units!=null)g.units=cleanMap(obj.units);if(obj.reserve&&typeof obj.reserve==='object'){g.reserve={hard:cleanMap(obj.reserve.hard),soft:cleanMap(obj.reserve.soft)}}save(STORE.TOWN_GOALS,state.townGoals);goalPlanTown(townId);return true;}
  function goalProgress(townId){const e=goalEffective(townId),parts=[];const levels=abCurrentLevels(townId)||{};for(const[id,t]of Object.entries(e.build||{})){const tgt=+t||0;if(tgt>0)parts.push(Math.min(1,(+(levels[id]||0))/tgt))}let info=null;try{info=researchTownTechs(townId)}catch(_){};for(const[id,on]of Object.entries(e.research||{}))if(+on)parts.push(info&&info.techs&&info.techs[id]?1:0);const units=goalUnitCounts(townId);for(const[id,t]of Object.entries(e.units||{})){const tgt=+t||0;if(tgt>0)parts.push(Math.min(1,(+(units[id]||0))/tgt))}return parts.length?Math.round(parts.reduce((a,b)=>a+b,0)/parts.length*100):100;}
  function goalMandatoryModules(){const out=[];for(const [tid,q] of Object.entries(state.virtualQueueOverrides||{})){if(!q||!q.mandatory)continue;for(const key of Object.keys(q.mandatory)){if(!q.mandatory[key]||q.blocked&&q.blocked[key]||q.hidden&&q.hidden[key])continue;const kind=String(key).split(':')[0],mod=kind==='build'?'build':kind==='research'?'research':kind==='recruit'?'recruit':null;if(mod&&!out.includes(mod))out.push(mod)}}return out;}

  const AB_BUILDINGS = ['main', 'storage', 'farm', 'academy', 'temple', 'barracks', 'docks', 'market', 'hide', 'lumber', 'stoner', 'ironer', 'wall',
    'theater', 'thermal', 'library', 'lighthouse', 'tower', 'statue', 'oracle', 'trade_office'];
  const AB_LABELS = {
    main: 'Senate', storage: 'Warehouse', farm: 'Farm', academy: 'Academy',
    temple: 'Temple', barracks: 'Barracks', docks: 'Harbor', market: 'Market',
    hide: 'Cave', lumber: 'Timber', stoner: 'Quarry', ironer: 'Silver', wall: 'Wall',
    theater:'Theater',thermal:'Thermal baths',library:'Library',lighthouse:'Lighthouse',
    tower:'Tower',statue:'Divine statue',oracle:'Oracle',trade_office:'Trade office',
  };
  const AB_CS_FAST = {
    main: 15, storage: 20, farm: 22, academy: 28, docks: 20,
    barracks: 10, temple: 5, market: 10, hide: 10,
    lumber: 15, stoner: 15, ironer: 15, wall: 10,
  };

  const AB_SEND_SPACING_MS = 1100;
  function abDefaultTargets() { return Object.assign({}, AB_CS_FAST); }
  function abDefaultOrder() { return AB_BUILDINGS.slice(); }
  function abEnsureOrder() {
    const cur = Array.isArray(state.abOrder) ? state.abOrder.filter(x => AB_BUILDINGS.includes(x)) : [];
    state.abOrder = cur.concat(AB_BUILDINGS.filter(x => !cur.includes(x)));
    save(STORE.AB_ORDER, state.abOrder);
    return state.abOrder;
  }
  function abMoveOrder(building, delta) {
    const order = abEnsureOrder().slice();
    const i = order.indexOf(building);
    if (i < 0) return;
    const j = Math.max(0, Math.min(order.length - 1, i + delta));
    if (i === j) return;
    order.splice(i, 1); order.splice(j, 0, building);
    state.abOrder = order;
    save(STORE.AB_ORDER, order);
  }
  function abEnsureTargets() {
    if (!state.abTargets || typeof state.abTargets !== 'object' || Array.isArray(state.abTargets)) {
      state.abTargets = abDefaultTargets();
      save(STORE.AB_TARGETS, state.abTargets);
    }
    AB_BUILDINGS.forEach(b => { if (state.abTargets[b] == null) state.abTargets[b] = AB_CS_FAST[b] || 0; });
    abEnsureOrder();
    return state.abTargets;
  }
  function abBuildingDef(building) {
    try { const uw = gameUw(); return uw.GameData && uw.GameData.buildings && uw.GameData.buildings[building] || null; }
    catch (_) { return null; }
  }
  function abMaxLevel(building) {
    const d = abBuildingDef(building);
    const n = d && d.max_level != null ? +d.max_level : null;
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  function abMinLevel(building) {
    const d = abBuildingDef(building);
    const n = d && d.min_level != null ? +d.min_level : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  function abClampTarget(building, lvl) {
    const lo = abMinLevel(building);
    const hi = abMaxLevel(building);
    const n = Math.max(lo, Math.floor(Number.isFinite(+lvl) ? +lvl : 0));
    return hi == null ? n : Math.min(hi, n);
  }
  function abSetTarget(building, lvl) {
    abEnsureTargets();
    state.abTargets[building] = abClampTarget(building, lvl);
    save(STORE.AB_TARGETS, state.abTargets);
  }

  const NATIVE_BUILD_LABELS = {
    main:'Senado',storage:'Almacén',farm:'Granja',academy:'Academia',temple:'Templo',
    barracks:'Cuartel',docks:'Puerto',market:'Mercado',hide:'Cueva',lumber:'Aserradero',
    stoner:'Cantera',ironer:'Mina de plata',wall:'Muralla',theater:'Teatro',thermal:'Termas',
    library:'Biblioteca',lighthouse:'Faro',tower:'Torre',statue:'Estatua divina',oracle:'Oráculo',trade_office:'Oficina comercial',
  };
  const NATIVE_SPECIAL_GROUPS=[['theater','thermal','library','lighthouse'],['tower','statue','oracle','trade_office']];
  let nativeQueueInflightRestored=false;
  function nativeQueueRoot() {
    let q=state.nativeQueue;
    if(!q||typeof q!=='object'||Array.isArray(q))q=state.nativeQueue={version:1,seq:0,towns:{}};
    if(!q.towns||typeof q.towns!=='object'||Array.isArray(q.towns))q.towns={};
    q.version=1;q.seq=Math.max(0,+q.seq||0);
    if(!nativeQueueInflightRestored){nativeQueueInflightRestored=true;let changed=false;for(const town of Object.values(q.towns))for(const lane of ['build','recruit'])for(const job of ((town&&Array.isArray(town[lane]))?town[lane]:[])){if(job&&job.inflight){if(lane==='build')job.reconcile=Object.assign({},job.inflight);job.inflight=null;job.manualReview=true;job.status='unknown';job.reason='acción en curso al recargar; comprobando la cola real';job.updatedAt=Date.now();changed=true}}if(changed)save(STORE.NATIVE_QUEUE,q)}
    return q;
  }
  function nativeQueueTown(townId,create) {
    const q=nativeQueueRoot(),id=String(townId==null?'':townId);if(!id)return null;
    let t=q.towns[id];
    if((!t||typeof t!=='object'||Array.isArray(t))&&create!==false)t=q.towns[id]={build:[],recruit:[],paused:{build:false,recruit:false},mode:{build:'legacy',recruit:'legacy'}};
    if(!t)return null;
    if(!Array.isArray(t.build))t.build=[];if(!Array.isArray(t.recruit))t.recruit=[];
    if(!t.paused||typeof t.paused!=='object'||Array.isArray(t.paused))t.paused={build:false,recruit:false};
    if(!t.mode||typeof t.mode!=='object'||Array.isArray(t.mode))t.mode={build:'legacy',recruit:'legacy'};
    if(!['legacy','fifo'].includes(t.mode.build))t.mode.build='legacy';if(!['legacy','fifo'].includes(t.mode.recruit))t.mode.recruit='legacy';
    return t;
  }
  function nativeQueueList(townId,lane,create){const t=nativeQueueTown(townId,create);return t&&Array.isArray(t[lane])?t[lane]:[];}
  function nativeQueueSave() {
    save(STORE.NATIVE_QUEUE,nativeQueueRoot());
    try{scheduleNativeUiScan()}catch(_){}
    try{renderAbQueue()}catch(_){}
    try{renderQueueCenter()}catch(_){}
  }
  function nativeQueueId(prefix){const q=nativeQueueRoot();q.seq++;return `${prefix}:${Date.now().toString(36)}:${q.seq.toString(36)}`;}
  function nativeQueueHasPending(lane,townId) {
    if(townId!=null)return nativeQueueList(townId,lane,false).length>0;
    const towns=nativeQueueRoot().towns;return Object.keys(towns).some(id=>nativeQueueList(id,lane,false).length>0);
  }
  function nativeQueuePaused(townId,lane){const t=nativeQueueTown(townId,false);return !!(t&&t.paused&&t.paused[lane]);}
  function nativeQueueIsFifo(townId,lane){const t=nativeQueueTown(townId,false);return !!(t&&t.mode&&t.mode[lane]==='fifo');}
  function nativeQueueUseLegacy(townId,lane){const t=nativeQueueTown(townId,true);if(t[lane].length)return false;t.mode[lane]='legacy';t.paused[lane]=false;nativeQueueSave();return true;}
  function nativeQueueTogglePaused(townId,lane){const t=nativeQueueTown(townId,true);t.paused[lane]=!t.paused[lane];nativeQueueSave();return t.paused[lane];}
  function nativeQueueMove(townId,lane,jobId,delta) {
    if(lane==='build')nativeQueueReconcileBuild(townId);else nativeQueueReconcileRecruit(townId);
    const list=nativeQueueList(townId,lane,false);if(list.some(j=>j&&(j.inflight||j.manualReview)))return false;const i=list.findIndex(j=>j&&j.id===jobId);if(i<0)return false;
    const j=Math.max(0,Math.min(list.length-1,i+(+delta||0)));if(i===j)return false;
    const item=list.splice(i,1)[0];list.splice(j,0,item);if(lane==='build')nativeQueueRebaseBuild(townId);nativeQueueSave();return true;
  }
  function nativeQueueRemove(townId,lane,jobId,opts) {
    if(lane==='build')nativeQueueReconcileBuild(townId);else nativeQueueReconcileRecruit(townId);
    const list=nativeQueueList(townId,lane,false),i=list.findIndex(j=>j&&j.id===jobId);if(i<0)return false;
    const target=list[i];const force=!(!opts||!opts.force);

    if(target.inflight)return false;
    if(!force&&list.some(j=>j&&j.inflight))return false;

    if(!force&&list.some(j=>j&&j.manualReview)&&!target.manualReview)return false;

    if(lane==='build'){
      const impact=nativeQueueRemovalImpact(townId,jobId);
      if(!impact.ok){
        const head=impact.blockers.slice(0,3).map(b=>`${nativeBuildLabel(b.building)} (necesita ${impact.target.building} ${b.requires}, sin esta entrada solo ${b.has})`).join('; ');
        const more=impact.blockers.length>3?` y ${impact.blockers.length-3} más`:'';
        flash(`Bloqueado: ${nativeBuildLabel(impact.target.building)} ${impact.target.toLevel} aún hace falta para ${head}${more}`);
        gbLog(`cola nativa: borrado bloqueado — ${impact.blockers.length} edificio(s) dependen de ${impact.target.building} ${impact.target.toLevel}: `+impact.blockers.map(b=>`${b.building}>=${b.requires}`).join(', '));
        return false;
      }
    }
    list.splice(i,1);if(lane==='build')nativeQueueRebaseBuild(townId);nativeQueueSave();return true;
  }
  function nativeQueuePosition(townId,lane,pred) {
    const list=nativeQueueList(townId,lane,false),i=list.findIndex(pred);return i<0?null:i+1;
  }
  function nativeBuildLabel(building) {
    try{const d=abBuildingDef(building);const n=d&&(d.name||d.name_plural||d.label);if(n)return String(n)}catch(_){}
    return NATIVE_BUILD_LABELS[building]||AB_LABELS[building]||building;
  }
  function nativeUnitLabel(unit) {
    try{const d=recruitUnitDef(unit);const n=d&&(d.name||d.name_plural||d.label);if(n)return String(n)}catch(_){}
    return String(unit||'?');
  }
  function nativeQueueProjectedBuildLevel(townId,building) {
    const levels=abCurrentLevels(townId);if(!levels||levels[building]==null)return null;
    let level=+levels[building]||0;
    for(const j of nativeQueueList(townId,'build',false))if(j&&j.building===building)level=Math.max(level,+j.toLevel||level+1);
    return level;
  }
  function nativeSpecialConflict(townId,building) {
    const group=NATIVE_SPECIAL_GROUPS.find(g=>g.includes(building));if(!group)return null;const levels=abCurrentLevels(townId);if(!levels)return 'especiales ilegibles';if(+(levels[building]||0)>0)return null;
    const other=group.find(id=>id!==building&&(+(levels[id]||0)>0||nativeQueueList(townId,'build',false).some(j=>j&&j.building===id)));return other||null;
  }
  function nativeQueueRebaseBuild(townId) {
    const levels=abCurrentLevels(townId);if(!levels)return false;const next=Object.assign({},levels);
    for(const j of nativeQueueList(townId,'build',false)){if(!j||!AB_BUILDINGS.includes(j.building))continue;if(j.inflight||j.manualReview){next[j.building]=Math.max(+next[j.building]||0,+j.toLevel||0);continue}const from=+next[j.building]||0;j.fromLevel=from;j.toLevel=from+1;next[j.building]=from+1}return true;
  }

  function nativeQueueRemovalImpact(townId, jobId) {
    const list = nativeQueueList(townId, 'build', false);
    const idx = list.findIndex(j => j && j.id === jobId);
    if (idx < 0) return { ok: true };
    const target = list[idx];
    if (!target || !AB_BUILDINGS.includes(target.building)) return { ok: true };
    const levels = abCurrentLevels(townId);
    if (!levels) return { ok: true };
    const B = String(target.building);
    const T = +target.toLevel || 0;
    const fold = (skipIdx) => {

      const sim = Object.assign({}, levels);
      for (let i = 0; i < list.length; i++) {
        if (i === skipIdx) continue;
        const j = list[i];
        if (!j || !AB_BUILDINGS.includes(j.building)) continue;
        if (j.inflight || j.manualReview) {

          sim[j.building] = Math.max(+sim[j.building] || 0, +j.toLevel || 0);
          continue;
        }
        sim[j.building] = (+sim[j.building] || 0) + 1;
      }
      return sim;
    };
    const simWith = fold(-1);
    const simWithout = fold(idx);
    const withLvl = +simWith[B] || 0;
    if (withLvl < T) return { ok: true };

    const blockers = [], seenDep = new Set();
    for (let i = idx + 1; i < list.length; i++) {
      const j = list[i];
      if (!j || !AB_BUILDINGS.includes(j.building) || seenDep.has(j.building)) continue;
      const req = abRequirementMap(townId, j.building);
      if (!req) continue;
      const need = +req[B] || 0;
      if (!need) continue;
      if (need <= +simWithout[B]) continue;
      if (need > withLvl) continue;
      seenDep.add(j.building);
      blockers.push({ building: j.building, requires: need, has: +simWithout[B] || 0 });
    }
    if (!blockers.length) return { ok: true };
    return { ok: false, blockers, target: { building: B, toLevel: T, withLvl, withoutLvl: +simWithout[B] || 0 } };
  }
  function nativeQueuePrereqWalk(townId, building) {

    const levels = abCurrentLevels(townId);
    if (!levels) return { chain: [], error: 'levels-unreadable' };
    const sim = Object.assign({}, levels);
    for (const j of nativeQueueList(townId, 'build', false)) {
      if (!j || j.toLevel == null) continue;
      sim[j.building] = Math.max(+sim[j.building] || 0, +j.toLevel || 0);
    }
    const chain = [];
    let target = building;
    for (let safety = 0; safety < 50; safety++) {
      const resolved = abResolvePrerequisite(townId, target, sim);
      if (!resolved || !resolved.building) return { chain, error: resolved ? resolved.error : 'prereq-unknown' };
      if (resolved.building === target) return { chain };
      chain.push(resolved.building);
      sim[resolved.building] = (+sim[resolved.building] || 0) + 1;
    }
    return { chain, error: 'chain-too-long' };
  }
  function nativeQueueAddBuild(townId,building) {
    if(!AB_BUILDINGS.includes(building))return false;

    nativeQueueReconcileBuild(townId);
    const special=nativeSpecialConflict(townId,building);if(special){flash(`Conflicto con ${nativeBuildLabel(special)}`);return false}
    const baseLevels = abCurrentLevels(townId);
    if (!baseLevels) { flash('No se puede leer el nivel actual'); return false; }

    const walk = nativeQueuePrereqWalk(townId, building);
    if (walk.error && walk.error !== 'levels-unreadable') {

      if (!walk.chain.length) { flash(`Requisitos no resolubles: ${abReasonText(walk.error)}`); return false; }
    }
    const sim = Object.assign({}, baseLevels);
    for (const j of nativeQueueList(townId, 'build', false)) {
      if (!j || j.toLevel == null) continue;
      sim[j.building] = Math.max(+sim[j.building] || 0, +j.toLevel || 0);
    }
    const max = abMaxLevel(building);
    if (max == null) { flash('No se puede leer el nivel máximo'); return false; }
    const from = +sim[building] || 0;
    if (from >= max) { flash(`${nativeBuildLabel(building)} ya está al máximo`); return false; }
    const town = nativeQueueTown(townId, true); town.mode.build = 'fifo';

    let addedPrereqs = 0;
    for (const dep of walk.chain) {
      const dMax = abMaxLevel(dep);
      const dFrom = +sim[dep] || 0;
      if (dMax == null) continue;
      if (dFrom >= dMax) continue;
      town.build.push({
        id: nativeQueueId('b'), kind: 'build', townId: String(townId),
        building: dep, fromLevel: dFrom, toLevel: dFrom + 1,
        status: 'pending', reason: `requisito para ${nativeBuildLabel(building)}`,
        createdAt: Date.now(),
      });
      sim[dep] = dFrom + 1;
      addedPrereqs++;
    }

    if (walk.error && walk.error !== 'levels-unreadable') {
      flash(`${addedPrereqs} requisito(s) añadidos; el objetivo final no se puede resolver: ${abReasonText(walk.error)}`);
    } else {
      town.build.push({
        id: nativeQueueId('b'), kind: 'build', townId: String(townId),
        building, fromLevel: from, toLevel: from + 1,
        status: 'pending', reason: '', createdAt: Date.now(),
      });
      if (addedPrereqs) flash(`+${addedPrereqs} requisito(s) antes de ${nativeBuildLabel(building)}`);
    }
    nativeQueueRebaseBuild(townId); nativeQueueSave();
    const summary = addedPrereqs
      ? `${nativeBuildLabel(building)} ${from}→${from + 1} + ${addedPrereqs} requisito(s) [${walk.chain.map(b => nativeBuildLabel(b)).join(', ')}] @${townId}`
      : `${nativeBuildLabel(building)} ${from}→${from + 1} @${townId}`;
    gbLog(`cola nativa: ${summary}`);
    gbTimeout(() => abScan('native'), 80); return true;
  }
  function nativeQueueRemoveLastBuild(townId,building) {

    nativeQueueReconcileBuild(townId);
    const list=nativeQueueList(townId,'build',false);for(let i=list.length-1;i>=0;i--){const j=list[i];if(j&&j.building===building&&!j.inflight&&!j.manualReview){
      const impact=nativeQueueRemovalImpact(townId,j.id);
      if(!impact.ok){
        const head=impact.blockers.slice(0,3).map(b=>`${nativeBuildLabel(b.building)} (necesita ${impact.target.building} ${b.requires}, sin esta entrada solo ${b.has})`).join('; ');
        const more=impact.blockers.length>3?` y ${impact.blockers.length-3} más`:'';
        flash(`Bloqueado: ${nativeBuildLabel(impact.target.building)} ${impact.target.toLevel} aún hace falta para ${head}${more}`);
        gbLog(`cola nativa: borrado bloqueado — ${impact.blockers.length} edificio(s) dependen de ${impact.target.building} ${impact.target.toLevel}: `+impact.blockers.map(b=>`${b.building}>=${b.requires}`).join(', '));
        return false;
      }
      list.splice(i,1);nativeQueueRebaseBuild(townId);nativeQueueSave();return true}}
    return false;
  }
  function nativeUnitStep(unit) {
    try{const d=recruitUnitDef(unit)||{};const pop=+d.population||0,freight=+(d.favor??(d.resources&&d.resources.favor))||0;if(d.is_naval||d.naval||d.mythical||d.is_mythical||d.god||pop>=8||freight>0)return 1}catch(_){}
    return 10;
  }
  function nativeQueueRecruitAmount(townId,unit){return nativeQueueList(townId,'recruit',false).reduce((n,j)=>n+(j&&j.unit===unit?(+j.amount||0):0),0);}
  function nativeQueueAddRecruit(townId,unit,amount) {
    const n=Math.max(1,Math.floor(+amount||0));if(!unit||!recruitUnitDef(unit)||!(n>0))return false;

    const town=nativeQueueTown(townId,true);town.mode.recruit='fifo';town.recruit.push({id:nativeQueueId('u'),kind:'recruit',townId:String(townId),unit:String(unit),amount:n,status:'pending',reason:'',createdAt:Date.now()});
    nativeQueueSave();gbLog(`cola nativa: ${n}× ${nativeUnitLabel(unit)} @${townId}`);gbTimeout(()=>recruitScan('native'),80);return true;
  }
  function nativeQueueRemoveLastRecruit(townId,unit,amount) {
    nativeQueueReconcileRecruit(townId);
    const list=nativeQueueList(townId,'recruit',false);const step=Math.max(1,Math.floor(+amount||nativeUnitStep(unit)));for(let i=list.length-1;i>=0;i--){const job=list[i];if(job&&job.unit===unit&&!job.inflight&&!job.manualReview){job.amount=Math.max(0,(+job.amount||0)-step);if(!job.amount)list.splice(i,1);else{job.status='pending';job.reason='';job.updatedAt=Date.now()}nativeQueueSave();return true}}
    return false;
  }
  function nativeQueueSetJobState(job,status,reason) {
    if(!job)return;const r=String(reason||''),now=Date.now();
    if(job.status===status&&job.reason===r)return;
    if(job.status===status&&/^waiting-(?:resources|population)$/.test(status||'')){
      const stable=x=>String(x||'').replace(/\d+(?:[.,]\d+)?/g,'#');
      if(stable(job.reason)===stable(r)&&now-(+job.reasonUpdatedAt||+job.updatedAt||0)<300000)return;
    }
    job.status=status;job.reason=r;job.reasonUpdatedAt=now;job.updatedAt=now;save(STORE.NATIVE_QUEUE,nativeQueueRoot());try{scheduleNativeUiScan()}catch(_){}try{renderQueueCenter()}catch(_){}
  }
  function nativeQueueMarkBuild(townId,jobId,opts) {
    const job=nativeQueueList(townId,'build',false)[0];if(!job||job.id!==jobId)return false;const o=opts||{};
    if(Object.prototype.hasOwnProperty.call(o,'inflight')){job.inflight=o.inflight;if(o.inflight)job.reconcile=null}
    if(Object.prototype.hasOwnProperty.call(o,'reconcile'))job.reconcile=o.reconcile;
    if(Object.prototype.hasOwnProperty.call(o,'manualReview'))job.manualReview=!!o.manualReview;
    if(o.status)job.status=o.status;if(Object.prototype.hasOwnProperty.call(o,'reason'))job.reason=String(o.reason||'');job.updatedAt=Date.now();nativeQueueSave();return true;
  }
  function nativeQueueReconcileBuild(townId) {
    const list=nativeQueueList(townId,'build',false);if(!list.length)return false;
    const levels=abCurrentLevels(townId);if(!levels)return false;let changed=false;
    for(const j of list){if(!j)continue;const flight=j.inflight||j.reconcile;if(flight&&flight.building&&flight.targetLevel!=null&&+(levels[flight.building]||0)>=+flight.targetLevel){j.inflight=null;j.reconcile=null;j.manualReview=false;j.status=flight.building===j.building?'pending':'waiting-requirement';j.reason=flight.building===j.building?'confirmado en la cola real':`requisito ${nativeBuildLabel(flight.building)} confirmado`;j.updatedAt=Date.now();changed=true;continue}

      if(j.inflight&&Date.now()-(+j.inflight.at||0)>120000){j.reconcile=Object.assign({},j.inflight);j.inflight=null;j.manualReview=true;j.status='unknown';j.reason='la cola real no se actualizó; comprobar antes de continuar';j.updatedAt=Date.now();changed=true}}
    for(let i=list.length-1;i>=0;i--){const j=list[i];if(!j||!AB_BUILDINGS.includes(j.building)||+(levels[j.building]||0)>=+j.toLevel){list.splice(i,1);changed=true}}
    if(changed){nativeQueueRebaseBuild(townId);nativeQueueSave()}return changed;
  }
  function nativeQueueBuildPlan(townId,levels) {
    nativeQueueReconcileBuild(townId);nativeQueueRebaseBuild(townId);const list=nativeQueueList(townId,'build',false),job=list[0];if(!job)return {hasJob:nativeQueueIsFifo(townId,'build'),plan:null};
    if(nativeQueuePaused(townId,'build')){nativeQueueSetJobState(job,'paused','cola pausada');return {hasJob:true,plan:null,why:'paused'}}
    if(list.some(j=>j&&j!==job&&(j.manualReview||j.inflight))){nativeQueueSetJobState(job,'blocked','hay otra acción pendiente de revisión');return {hasJob:true,plan:null,why:'lane-review'}}
    if(job.manualReview){nativeQueueSetJobState(job,'unknown',job.reason||'comprobar la cola real y quitar este trabajo si no se envió');return {hasJob:true,plan:null,why:'manual-review'}}
    if(job.inflight){nativeQueueSetJobState(job,'sending',job.reason||'enviando a la cola real');return {hasJob:true,plan:null,why:'inflight'}}
    const special=nativeSpecialConflict(townId,job.building);if(special){nativeQueueSetJobState(job,'blocked',`conflicto con ${nativeBuildLabel(special)}`);return {hasJob:true,plan:null,why:'special-conflict'}}
    const max=abMaxLevel(job.building);if(max==null){nativeQueueSetJobState(job,'blocked','nivel máximo desconocido');return {hasJob:true,plan:null,why:'max-unreadable'}}
    if(+job.toLevel>max){nativeQueueSetJobState(job,'blocked','nivel máximo alcanzado');return {hasJob:true,plan:null,why:'max-level'}}
    const resolved=abResolvePrerequisite(townId,job.building,levels);
    if(!resolved||!resolved.building){const why=resolved&&resolved.error||'requisito desconocido';nativeQueueSetJobState(job,'blocked',abReasonText(why));return {hasJob:true,plan:null,why}}
    const aff=abCanAfford(townId,resolved.building);
    if(!aff.ok){const why=aff.why||'recursos',detail=abAffordReason(aff),status=why==='resources'?'waiting-resources':(why==='population'?'waiting-population':'blocked');nativeQueueSetJobState(job,status,detail);return {hasJob:true,plan:null,why}}
    const isRequirement=resolved.building!==job.building;
    nativeQueueSetJobState(job,'ready',isRequirement?`antes: ${nativeBuildLabel(resolved.building)}`:'listo');
    return {hasJob:true,plan:{building:resolved.building,forTarget:job.building,reason:isRequirement?`requisito para ${job.building}`:'cola FIFO',cost:aff.need,nativeJobId:job.id,nativeRequestedBuilding:job.building,nativeRequirement:isRequirement}};
  }
  function nativeQueueBuildApplied(townId,plan) {
    if(!plan||!plan.nativeJobId)return;
    const list=nativeQueueList(townId,'build',false),job=list[0];if(!job||job.id!==plan.nativeJobId)return;
    if(!plan.nativeRequirement&&plan.building===job.building){list.shift();nativeQueueRebaseBuild(townId)}
    else{job.inflight=null;job.reconcile=null;job.manualReview=false;nativeQueueSetJobState(job,'waiting-requirement',`construyendo ${nativeBuildLabel(plan.building)} primero`)}
    nativeQueueSave();
  }

  function nativeQueueReconcileRecruit(townId) {
    const list=nativeQueueList(townId,'recruit',false);if(!list.length)return false;let changed=false;
    for(const j of list){if(!j||!j.inflight)continue;if(Date.now()-(+j.inflight.at||0)>120000){j.inflight=null;j.manualReview=true;j.status='unknown';j.reason='la cola real no se actualizó; comprobar antes de continuar';j.updatedAt=Date.now();changed=true}}
    if(changed)nativeQueueSave();return changed;
  }
  function nativeQueueRecruitHead(townId) {
    nativeQueueReconcileRecruit(townId);
    const list=nativeQueueList(townId,'recruit',false),job=list[0];if(!job)return null;
    if(nativeQueuePaused(townId,'recruit')){nativeQueueSetJobState(job,'paused','cola pausada');return null}
    if(list.some(j=>j&&j!==job&&(j.manualReview||j.inflight))){nativeQueueSetJobState(job,'blocked','hay otra acción pendiente de revisión');return null}
    if(job.manualReview){nativeQueueSetJobState(job,'unknown',job.reason||'comprobar la cola real y quitar este trabajo si no se envió');return null}
    if(job.inflight){nativeQueueSetJobState(job,'sending',job.reason||'enviando a la cola real');return null}
    return job;
  }
  function nativeQueueRecruitApplied(townId,jobId,amount) {
    const list=nativeQueueList(townId,'recruit',false),job=list[0];if(!job||job.id!==jobId)return;
    job.inflight=null;job.amount=Math.max(0,(+job.amount||0)-Math.max(0,+amount||0));
    if(job.amount<=0)list.shift();else{job.status='pending';job.reason='resto del lote';job.updatedAt=Date.now()}
    nativeQueueSave();
  }

  GM_addStyle(`
    /* The senate tile stacks absolutely-positioned overlays (building caption,
       level badge, hover hitbox) on top of its content. A statically-positioned
       control paints UNDER all of them, so the caption text swallowed the click
       even though the button looked reachable. position+z-index puts it on top
       of its stacking context and makes hit-testing land on the button. */
    .gb-native-qctl{position:relative;z-index:2147482000;pointer-events:auto;display:inline-flex;align-items:center;gap:2px;margin:0 0 0 2px;padding:1px 3px;border:1px solid #8a6725;border-radius:4px;background:rgba(31,25,16,.94);color:#f6e3b0;font:10px/1.2 Arial,sans-serif,"Segoe UI Symbol","Noto Sans Symbols 2","DejaVu Sans";box-shadow:0 1px 3px rgba(0,0,0,.45);vertical-align:middle}
    .gb-native-qbtn{position:relative;z-index:1;pointer-events:auto;min-width:22px;height:20px;padding:0 4px;border:1px solid #9b7938;border-radius:4px;background:linear-gradient(#5b4828,#342814);color:#fff3c7;font:bold 11px Arial,sans-serif,"Segoe UI Symbol","Noto Sans Symbols 2","DejaVu Sans";cursor:pointer}
    .gb-native-qbtn:hover{border-color:#e5b94f;color:#fff}.gb-native-qbtn:disabled{opacity:.42;cursor:default}
    .gb-native-qcount{min-width:58px;text-align:center;white-space:nowrap}.gb-native-qcount.ready{color:#91e5a8}.gb-native-qcount.blocked{color:#ffb0a8}.gb-native-qcount.waiting{color:#ffd27a}
    .gb-native-panel{position:fixed;bottom:10px;right:10px;z-index:2147483000;width:320px;max-width:40vw;max-height:48vh;padding:6px;border:1px solid #8a6725;border-radius:6px;background:rgba(34,27,17,.97);color:#f2dfb2;font:11px/1.3 Arial,sans-serif,"Segoe UI Symbol","Noto Sans Symbols 2","DejaVu Sans";box-shadow:0 4px 14px rgba(0,0,0,.55);overflow:auto}
    .gb-native-panel-head{display:flex;align-items:center;gap:5px;margin-bottom:4px;font-weight:bold}.gb-native-panel-head span{flex:1}
    .gb-native-job{display:grid;grid-template-columns:24px minmax(120px,1fr) auto;gap:5px;align-items:center;padding:3px 1px;border-top:1px solid rgba(190,150,75,.22)}
    .gb-native-job:first-of-type{border-top:0}.gb-native-job small{display:block;color:#c7ad78;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gb-native-job-actions{display:flex;gap:2px}
    .gb-native-empty{color:#b9a983;font-style:italic;padding:2px}.gb-native-disabled{opacity:.55}
  `);
  let nativeUiTimer=0;
  function scheduleNativeUiScan() {
    if(nativeUiTimer)return;nativeUiTimer=gbTimeout(()=>{nativeUiTimer=0;nativeUiScan()},80);
  }
  function nativeEnsureBuildingIds() {
    try{const all=gameUw().GameData&&gameUw().GameData.buildings||{};for(const [id,d] of Object.entries(all)){if(id==='place'||id==='main_place')continue;const max=+(d&&d.max_level);if(max>0&&!AB_BUILDINGS.includes(id))AB_BUILDINGS.push(id)}}catch(_){}
  }
  function nativeWindowTownId(root) {
    if(!root)return null;const ids=new Set(),add=raw=>{if(raw!=null&&/^\d+$/.test(String(raw)))ids.add(String(raw))};
    try{for(let n=root;n&&n!==document.body;n=n.parentElement){add(n.getAttribute&&n.getAttribute('data-town-id'));add(n.getAttribute&&n.getAttribute('data-town_id'));add(n.getAttribute&&n.getAttribute('data-townid'))}}
    catch(_){}
    try{root.querySelectorAll('input[name="town_id"],input[data-town-id],input[data-town_id]').forEach(n=>{add(n.value);add(n.getAttribute('data-town-id'));add(n.getAttribute('data-town_id'))})}catch(_){}
    if(ids.size>1)return null;
    if(ids.size===1){const id=[...ids][0];return abGetTown(id)?id:null}
    const isRelevant=r=>!!(r&&r.matches&&r.matches('#unit_order,.window_content,.gpwindow_content'))&&!!(r.matches('#unit_order')||r.querySelector('#unit_order,#building_main,.building_main,[id^="building_main_"],[id^="special_building_"]'));
    const relevant=isRelevant(root);
    if(!relevant)return null;

    let focusProven=false;
    try{const mgr=gameUw().GPWindowMgr,w=mgr&&mgr.getFocusedWindow&&mgr.getFocusedWindow(),jq=w&&w.getJQElement&&w.getJQElement(),el=jq&&(jq[0]||jq.get&&jq.get(0));if(el){focusProven=true;if(!(el===root||el.contains(root)||root.contains(el)))return null}}catch(_){}
    if(!focusProven){try{const candidates=[...document.querySelectorAll('.window_content,.gpwindow_content,#unit_order')].filter((x,i,a)=>a.indexOf(x)===i&&!x.closest('#grepbot-panel')&&!x.closest('[hidden]')&&(x.getClientRects?x.getClientRects().length>0:true)),visibleRoots=candidates.filter(x=>!candidates.some(y=>y!==x&&y.contains(x))).filter(isRelevant);if(visibleRoots.length!==1||visibleRoots[0]!==root)return null}catch(_){return null}}
    const current=abCurrentTownId(),id=current==null?null:String(current);return id&&abGetTown(id)?id:null;
  }
  function nativeTownAction(root,townId,onClick) {
    return e=>{if(!gbTabLeader){flash('GrepBot está activo en otra pestaña');return false}const live=nativeWindowTownId(root);if(String(live||'')!==String(townId||'')){flash('La ciudad de esta ventana ha cambiado; vuelve a intentarlo');scheduleNativeUiScan();return false}return onClick&&onClick(e)};
  }

  function nativePanelAction(townId,onClick) {
    return e=>{if(!gbTabLeader){flash('GrepBot está activo en otra pestaña');return false}return onClick&&onClick(e)};
  }
  function nativeTileAction(root,townId,tile,kind,id,onClick) {
    return nativeTownAction(root,townId,e=>{const live=kind==='build'?nativeBuildingId(tile):nativeUnitId(tile);if(String(live||'')!==String(id||'')){flash('Este elemento de la ventana ha cambiado; vuelve a intentarlo');scheduleNativeUiScan();return false}return onClick&&onClick(e)});
  }
  function nativeGuardEvent(e){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation()}
  function nativeQButton(text,title,onClick) {
    const b=document.createElement('button');b.type='button';b.className='gb-native-qbtn';b.textContent=text;b.title=title;b.setAttribute('aria-label',title);
    b.addEventListener('pointerdown',e=>{e.stopPropagation()});b.addEventListener('mousedown',e=>{e.stopPropagation()});
    b.addEventListener('click',e=>{nativeGuardEvent(e);if(!gbInstanceAlive())return;onClick&&onClick(e)});return b;
  }
  function nativeBuildingId(node) {
    if(!node)return null;const ids=new Set(),add=v=>{v=String(v||'');if(AB_BUILDINGS.includes(v))ids.add(v)};for(const k of ['data-building_type','data-building-type','data-building'])add(node.getAttribute(k));
    try{const child=node.querySelector('[data-building_type],[data-building-type],[data-building]');if(child)for(const k of ['data-building_type','data-building-type','data-building'])add(child.getAttribute(k))}catch(_){}const m=String(node.id||'').match(/^(?:building_main|special_building)_([a-z0-9_]+)$/i);if(m)add(m[1]);return ids.size===1?[...ids][0]:null;
  }

  let nativeUnitMatcherCache = null;
  function nativeUnitMatchers() {
    let keys=[];try{keys=Object.keys((gameUw().GameData&&gameUw().GameData.units)||{})}catch(_){}
    const sig=keys.length+':'+keys.join(',');
    if(nativeUnitMatcherCache&&nativeUnitMatcherCache.sig===sig)return nativeUnitMatcherCache.list;
    const list=keys.slice().sort((a,b)=>b.length-a.length)
      .map(id=>({id,re:new RegExp(`(?:^|[_:-])${id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`,'i')}));
    nativeUnitMatcherCache={sig,list};
    return list;
  }
  function nativeUnitId(node) {
    if(!node)return null;const child=node.querySelector&&node.querySelector('[data-unit_id],[data-unit-id],[data-unit_type],[data-unit-type]');const vals=[node.getAttribute('data-unit_id'),node.getAttribute('data-unit-id'),node.getAttribute('data-unit_type'),node.getAttribute('data-unit-type'),child&&(child.getAttribute('data-unit_id')||child.getAttribute('data-unit-id')||child.getAttribute('data-unit_type')||child.getAttribute('data-unit-type')),node.id].filter(Boolean).map(String);
    const ids=new Set();for(const id of vals)if(recruitUnitDef(id))ids.add(id);const matchers=nativeUnitMatchers();for(const raw of vals)for(const m of matchers)if(m.re.test(raw))ids.add(m.id);return ids.size===1?[...ids][0]:null;
  }

  function nativeBuildPlusBlock(building,projected,max,special) {
    if(special)return `Conflicto con ${nativeBuildLabel(special)}`;
    if(projected==null)return 'No se puede leer el nivel actual de este edificio';
    if(max==null)return 'No se puede leer el nivel máximo de este edificio';
    if(projected>=max)return `${nativeBuildLabel(building)} ya está al máximo (${max}) contando la cola`;
    return '';
  }
  function nativeApplyPlusBlock(btn,why) {
    if(!btn||!why)return;btn.disabled=true;btn.title=why;btn.setAttribute('aria-label',why);
  }

  function nativeQctlHitCheck(ctl,label) {
    gbTimeout(()=>{
      try{
        if(!ctl.isConnected)return;const btn=ctl.querySelector('.gb-native-qbtn');if(!btn)return;
        const r=btn.getBoundingClientRect();if(!r.width||!r.height)return;
        const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
        if(hit&&(hit===btn||btn.contains(hit)||ctl.contains(hit)))return;
        const desc=hit?`${hit.tagName.toLowerCase()}${hit.id?'#'+hit.id:''}${hit.className&&typeof hit.className==='string'?'.'+hit.className.trim().split(/\s+/).join('.'):''}`:'nada';
        gbLogT('native-qctl-covered-'+label,300000,`native queue: [+] for ${label} is covered by ${desc} — click will not reach it`);
      }catch(_){}
    },250);
  }
  function nativeMountBuildControl(root,tile,townId,building) {
    const list=nativeQueueList(townId,'build',false),frozen=list.some(j=>j&&(j.inflight||j.manualReview)),jobs=list.filter(j=>j&&j.building===building);
    const projected=nativeQueueProjectedBuildLevel(townId,building),pos=nativeQueuePosition(townId,'build',j=>j&&j.building===building);
    const head=pos===1&&list[0],max=abMaxLevel(building),special=nativeSpecialConflict(townId,building),sig=JSON.stringify([townId,building,projected,pos,frozen,max,special,jobs.map(j=>[j.id,j.toLevel,j.status,j.reason,!!j.inflight,!!j.manualReview])]);

    const existing=[...tile.querySelectorAll('.gb-native-qctl[data-building]')];
    const keep=existing.find(c=>c.dataset.building===building&&c.dataset.sig===sig);
    for(const c of existing)if(c!==keep)c.remove();
    if(keep)return;
    const ctl=document.createElement('div');ctl.className='gb-native-qctl';ctl.dataset.building=building;ctl.dataset.sig=sig;
    const anchor=tile.querySelector('.level,.building_level,.level_wrapper');(anchor&&anchor.parentElement||tile).appendChild(ctl);
    if(!jobs.length){

      const plus=nativeQButton('+',`Añadir ${nativeBuildLabel(building)} +1 al final de la cola virtual`,nativeTileAction(root,townId,tile,'build',building,()=>nativeQueueAddBuild(townId,building)));
      nativeApplyPlusBlock(plus,nativeBuildPlusBlock(building,projected,max,special));
      ctl.append(plus);nativeQctlHitCheck(ctl,building);return;
    }

    const minus=nativeQButton('-','Quitar la última mejora virtual',nativeTileAction(root,townId,tile,'build',building,()=>{if(!nativeQueueRemoveLastBuild(townId,building))flash('No hay mejora virtual que quitar')}));minus.disabled=!jobs.some(j=>j&&!j.inflight&&!j.manualReview);
    const count=document.createElement('span');count.className='gb-native-qcount';
    count.textContent=`Plan ${projected}${pos?' · #'+pos:''}`;
    if(head&&head.reason)count.title=head.reason;
    if(head){if(head.status==='ready')count.classList.add('ready');else if(/blocked|unknown/.test(head.status||''))count.classList.add('blocked');else count.classList.add('waiting')}
    const plus=nativeQButton('+',`Añadir ${nativeBuildLabel(building)} +1 al final de la cola`,nativeTileAction(root,townId,tile,'build',building,()=>nativeQueueAddBuild(townId,building)));
    nativeApplyPlusBlock(plus,nativeBuildPlusBlock(building,projected,max,special));
    ctl.append(minus,count,plus);nativeQctlHitCheck(ctl,building);
  }
  function nativeMountRecruitControl(root,tile,townId,unit) {
    const list=nativeQueueList(townId,'recruit',false),frozen=list.some(j=>j&&(j.inflight||j.manualReview)),step=nativeUnitStep(unit),pending=nativeQueueRecruitAmount(townId,unit);
    const pos=nativeQueuePosition(townId,'recruit',j=>j&&j.unit===unit),head=pos===1&&list[0];
    const sig=JSON.stringify([townId,unit,step,pending,pos,frozen,head&&head.status,head&&head.reason]);

    const existing=[...tile.querySelectorAll(':scope > .gb-native-qctl[data-unit]')];
    const keep=existing.find(c=>c.dataset.unit===unit&&c.dataset.sig===sig);
    for(const c of existing)if(c!==keep)c.remove();
    if(keep)return;
    const ctl=document.createElement('div');ctl.className='gb-native-qctl';ctl.dataset.unit=unit;ctl.dataset.sig=sig;tile.appendChild(ctl);
    if(!(pending>0)){

      const plus=nativeQButton(`+${step}`,`Añadir ${step} ${nativeUnitLabel(unit)} a la cola virtual`,nativeTileAction(root,townId,tile,'unit',unit,e=>nativeQueueAddRecruit(townId,unit,(e.ctrlKey||e.metaKey)?step*5:step)));
      ctl.append(plus);nativeQctlHitCheck(ctl,unit);return;
    }
    const minus=nativeQButton(`-${step}`,`Restar ${step} de la cola virtual de esta unidad`,nativeTileAction(root,townId,tile,'unit',unit,()=>{if(!nativeQueueRemoveLastRecruit(townId,unit,step))flash('No hay unidades virtuales que quitar')}));minus.disabled=!list.some(j=>j&&j.unit===unit&&!j.inflight&&!j.manualReview);
    const count=document.createElement('span');count.className='gb-native-qcount';count.textContent=`+${pending}${pos?' · #'+pos:''}`;count.title=head&&head.reason?head.reason:`${pending} pendiente(s)`;
    if(head){if(head.status==='ready')count.classList.add('ready');else if(/blocked|unknown/.test(head.status||''))count.classList.add('blocked');else count.classList.add('waiting')}
    const plus=nativeQButton(`+${step}`,`Añadir ${step} ${nativeUnitLabel(unit)} a la cola`,nativeTileAction(root,townId,tile,'unit',unit,e=>nativeQueueAddRecruit(townId,unit,(e.ctrlKey||e.metaKey)?step*5:step)));ctl.append(minus,count,plus);nativeQctlHitCheck(ctl,unit);
  }
  function nativeRenderQueuePanel(root,townId,lane) {

    let box=document.querySelector(`.gb-native-panel[data-lane="${lane}"][data-town="${townId}"]`);
    if(!box){box=document.createElement('div');box.className='gb-native-panel';box.dataset.lane=lane;box.dataset.town=String(townId);document.body.appendChild(box);box.addEventListener('mousedown',e=>e.stopPropagation());box.addEventListener('click',e=>e.stopPropagation())}
    const oldScroll=box.scrollTop;
    box.replaceChildren();const head=document.createElement('div');head.className='gb-native-panel-head';const title=document.createElement('span');title.textContent=lane==='build'?'Cola GrepBot · Construcción':'Cola GrepBot · Unidades';head.appendChild(title);
    const paused=nativeQueuePaused(townId,lane),pause=nativeQButton(paused?'>':'||',paused?'Reanudar esta cola':'Pausar esta cola',nativeTownAction(root,townId,()=>nativeQueueTogglePaused(townId,lane)));head.appendChild(pause);
    const list=nativeQueueList(townId,lane,false),frozen=list.some(j=>j&&(j.inflight||j.manualReview));if(!list.length&&nativeQueueIsFifo(townId,lane)){const legacy=nativeQButton('Objetivos','Volver al planificador de objetivos',nativeTownAction(root,townId,()=>nativeQueueUseLegacy(townId,lane)));head.appendChild(legacy)}box.appendChild(head);
    if(!list.length){const empty=document.createElement('div');empty.className='gb-native-empty';empty.textContent=nativeQueueIsFifo(townId,lane)?'Cola vacía. Usa los botones + de arriba.':'Usa + para crear una cola FIFO en esta ciudad.';box.appendChild(empty);box.scrollTop=oldScroll;return}
    list.forEach((j,i)=>{const row=document.createElement('div');row.className='gb-native-job';const num=document.createElement('b');num.textContent='#'+(i+1);const desc=document.createElement('div');const main=document.createElement('div');main.textContent=lane==='build'?`${nativeBuildLabel(j.building)} ${j.fromLevel}→${j.toLevel}`:`${j.amount}× ${nativeUnitLabel(j.unit)}`;const sub=document.createElement('small');sub.textContent=`${j.status||'pending'}${j.reason?' · '+j.reason:''}`;desc.append(main,sub);const acts=document.createElement('div');acts.className='gb-native-job-actions';const up=nativeQButton('↑','Mover antes',nativePanelAction(townId,()=>nativeQueueMove(townId,lane,j.id,-1)));up.disabled=frozen||i===0;const down=nativeQButton('↓','Mover después',nativePanelAction(townId,()=>nativeQueueMove(townId,lane,j.id,1)));down.disabled=frozen||i===list.length-1;const del=nativeQButton('×','Quitar de la cola virtual',nativePanelAction(townId,()=>{if(j.inflight){flash('Esta orden se está enviando; espera a que termine');return false}if(j.manualReview){let ok=false;try{ok=gameUw().confirm('Comprueba primero la cola real. Borrar este elemento confirma que asumes si la acción se envió o no.')}catch(_){ok=false}if(!ok)return false}else if(frozen){let ok=false;try{ok=gameUw().confirm('Hay otra acción pendiente en esta cola. ¿Borrar este elemento de todos modos?')}catch(_){ok=false}if(!ok)return false}return nativeQueueRemove(townId,lane,j.id,{force:true})}));del.disabled=!!j.inflight;acts.append(up,down,del);row.append(num,desc,acts);box.appendChild(row)});box.scrollTop=oldScroll;
  }
  function nativeUiScan() {
    if(!gbInstanceAlive()||!document.body)return;nativeEnsureBuildingIds();
    const candidates=[...document.querySelectorAll('.window_content,.gpwindow_content,#unit_order')].filter((x,i,a)=>a.indexOf(x)===i&&!x.closest('#grepbot-panel'));
    const roots=candidates.filter(x=>!candidates.some(y=>y!==x&&y.contains(x)));
    const mountedTowns=new Set();
    for(const root of roots){const townId=nativeWindowTownId(root);if(!townId){root.querySelectorAll(':scope > .gb-native-panel,.gb-native-qctl').forEach(n=>n.remove());continue}let buildN=0,unitN=0;const mountedBuildIds=new Set(),mountedUnitIds=new Set();
      mountedTowns.add(String(townId));
      const senateContext=!!(root.matches('#building_main,.building_main,.senate')||root.querySelector('#building_main,.building_main,[id^="building_main_"],[id^="special_building_"]'));

      const buildTiles=senateContext?[...root.querySelectorAll('[id^="building_main_"],[id^="special_building_"]')]:[];
      for(const tile of buildTiles){if(tile.classList.contains('gb-native-qctl')||tile.closest('.gb-native-qctl,.gb-native-panel'))continue;const id=nativeBuildingId(tile);if(!id||mountedBuildIds.has(id))continue;mountedBuildIds.add(id);nativeMountBuildControl(root,tile,townId,id);buildN++}
      const unitContext=root.matches('#unit_order')?root:root.querySelector('#unit_order');const unitTiles=unitContext?[...unitContext.querySelectorAll('#units .unit_tab,.unit_tab')]:[];
      for(const tile of unitTiles){const id=nativeUnitId(tile);if(!id||mountedUnitIds.has(id))continue;mountedUnitIds.add(id);nativeMountRecruitControl(root,tile,townId,id);unitN++}
      root.querySelectorAll('.gb-native-qctl[data-building]').forEach(c=>{if(!mountedBuildIds.has(c.dataset.building))c.remove()});root.querySelectorAll('.gb-native-qctl[data-unit]').forEach(c=>{if(!mountedUnitIds.has(c.dataset.unit))c.remove()});
      if(buildN)nativeRenderQueuePanel(root,townId,'build');else document.querySelector(`.gb-native-panel[data-lane="build"][data-town="${townId}"]`)?.remove();if(unitN)nativeRenderQueuePanel(root,townId,'recruit');else document.querySelector(`.gb-native-panel[data-lane="recruit"][data-town="${townId}"]`)?.remove();
    }

    document.querySelectorAll('.gb-native-panel[data-town]').forEach(p => { if (!mountedTowns.has(p.dataset.town)) p.remove(); });
  }
  function abLoadCsFast() {
    state.abTargets = abDefaultTargets();
    state.abOrder = abDefaultOrder();
    save(STORE.AB_TARGETS, state.abTargets);
    save(STORE.AB_ORDER, state.abOrder);
    gbLog('auto-queue: loaded CS-fast targets + default priority');
    renderAbQueue();
  }
  function abGetTown(townId) {
    const uw = gameUw();
    try { return uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]); }
    catch (_) { return null; }
  }
  function abCurrentLevels(townId) {
    const t = abGetTown(townId);
    if (!t) return null;
    let attrs = null;
    try { const b = t.getBuildings ? t.getBuildings() : (t.buildings && t.buildings()); attrs = b && (b.attributes || b); } catch (_) {}
    if (!attrs) return null;
    const levels = {};
    AB_BUILDINGS.forEach(id => { levels[id] = +(attrs[id] || 0); });
    try {
      const orders = t.buildingOrders ? t.buildingOrders() : null;
      for (const m of ((orders && orders.models) || [])) {
        const a = m.attributes || m;
        const type = a.building_type;
        if (!type || levels[type] == null) continue;
        if (a.tear_down) levels[type] = Math.max(0, levels[type] - 1);
        else levels[type] += 1;
      }
    } catch (_) {}
    return levels;
  }
  function abQueueMax() {
    try {
      const uw = gameUw();
      if (uw.GameDataPremium && uw.GameDataPremium.isAdvisorActivated && uw.GameDataPremium.isAdvisorActivated('curator')) return 7;
      if (uw.GameDataConstructionQueue && uw.GameDataConstructionQueue.getBuildingOrdersQueueLength) {
        const n = +uw.GameDataConstructionQueue.getBuildingOrdersQueueLength();
        if (Number.isFinite(n) && n > 0) return n;
      }
    } catch (_) {}
    return 2;
  }
  function abQueueInfo(townId) {
    const t = abGetTown(townId);
    const max = abQueueMax();
    if (!t) return { len: 0, max, orders: [], known: false };
    let models = [];
    try { const orders = t.buildingOrders ? t.buildingOrders() : null;if(!orders||!Array.isArray(orders.models))return {len:0,max,orders:[],known:false};models=orders.models; }
    catch (_) { return { len: 0, max, orders: [], known: false }; }
    const list = models.map(m => {
      const a = m.attributes || m;
      return { id: a.id, building_type: a.building_type, building_time: +(a.building_time || 0), to_be_completed_at: +(a.to_be_completed_at || 0), tear_down: !!a.tear_down };
    });
    return { len: list.length, max, orders: list, known: true };
  }
  function abBuildDataEntry(townId, building) {
    try {
      const uw = gameUw();
      const models = uw.MM && uw.MM.getModels && uw.MM.getModels();
      let bbd = models && (models.BuildingBuildData || models.BuildData || models.BuildingBuilder);
      const data = bbd && (bbd[townId] || bbd[String(townId)]);
      return data && data.attributes && data.attributes.building_data && data.attributes.building_data[building] || null;
    } catch (_) { return null; }
  }
  function abBuildingCost(townId, building) {
    const bd = abBuildDataEntry(townId, building);
    if (!bd) return null;
    const need = bd.resources_for || bd.resources || bd.costs;
    if (!need || need.wood == null || need.stone == null || need.iron == null) return null;
    const pop = bd.population_for != null ? +bd.population_for : (bd.population != null ? +bd.population : 0);
    return { wood: +need.wood || 0, stone: +need.stone || 0, iron: +need.iron || 0, pop: Number.isFinite(pop) ? pop : 0, population: Number.isFinite(pop) ? pop : 0 };
  }
  function abRequirementMap(townId, building) {
    const def = abBuildingDef(building);
    if (!def) return null;
    const bd = abBuildDataEntry(townId, building);
    const map = {};
    const absorb = (x) => {
      if (!x) return;
      if (Array.isArray(x)) {
        x.forEach(v => {
          if (typeof v === 'string' && AB_BUILDINGS.includes(v)) map[v] = Math.max(map[v] || 0, 1);
          else if (v && typeof v === 'object') {
            const id = v.building_id || v.building || v.id || v.type;
            const lvl = +(v.level != null ? v.level : (v.min_level != null ? v.min_level : v.value));
            if (AB_BUILDINGS.includes(id) && Number.isFinite(lvl)) map[id] = Math.max(map[id] || 0, lvl);
          }
        });
        return;
      }
      if (typeof x !== 'object') return;
      for (const [k, v] of Object.entries(x)) {
        if (AB_BUILDINGS.includes(k)) {
          const lvl = +(v && typeof v === 'object' ? (v.level ?? v.min_level ?? v.value) : v);
          if (Number.isFinite(lvl)) map[k] = Math.max(map[k] || 0, lvl);
        }
      }
    };
    absorb(def.building_dependencies); absorb(def.dependencies); absorb(def.required_buildings); absorb(def.requirements && def.requirements.buildings);
    if (bd) { absorb(bd.building_dependencies); absorb(bd.dependencies); absorb(bd.required_buildings); absorb(bd.requirements && bd.requirements.buildings); }
    return map;
  }
  function abCanAfford(townId, building) {
    const t = abGetTown(townId);
    if (!t) return { ok: false, why: 'town unreadable' };
    const need = abBuildingCost(townId, building);
    if (!need) return { ok: false, why: 'cost unreadable' };
    let res = null, pop = null;
    try { res = t.resources && t.resources(); } catch (_) {}
    try { pop = t.getAvailablePopulation ? +t.getAvailablePopulation() : (res && res.population != null ? +res.population : null); } catch (_) {}
    if (!res || res.wood == null || res.stone == null || res.iron == null || pop == null) return { ok: false, why: 'resources/pop unreadable' };
    const margin = 10;
    const have = { wood:+res.wood, stone:+res.stone, iron:+res.iron, population:pop };
    if (have.wood < need.wood + margin || have.stone < need.stone + margin || have.iron < need.iron + margin) return { ok: false, why: 'resources', need, have, margin };
    if (need.pop > 0 && pop < need.pop) return { ok: false, why: 'population', need, have, margin };
    return { ok: true, need };
  }
  function abAffordReason(aff) {
    if (!aff) return 'datos de coste ilegibles';
    if (aff.why === 'resources' && aff.need && aff.have) {
      const miss = [['madera','wood'],['piedra','stone'],['plata','iron']]
        .filter(([,k]) => +aff.have[k] < (+aff.need[k] || 0) + (+aff.margin || 0))
        .map(([label,k]) => `${label} ${Math.floor(+aff.have[k]||0)} (coste ${Math.ceil(+aff.need[k]||0)}${+aff.margin ? ` + reserva ${+aff.margin}` : ''})`);
      return `esperando recursos${miss.length ? ': '+miss.join(', ') : ''}`;
    }
    if (aff.why === 'population' && aff.need && aff.have) return `esperando población ${Math.floor(+aff.have.population||0)}/${Math.ceil(+aff.need.pop||0)}`;
    const labels = {'town unreadable':'ciudad ilegible','cost unreadable':'coste ilegible','resources/pop unreadable':'recursos o población ilegibles'};
    return labels[aff.why] || String(aff.why || 'bloqueado');
  }
  function abReasonText(why) {
    const s = String(why || 'sin acción ejecutable');
    const simple = {
      'requirements-unreadable':'requisitos del edificio ilegibles',
      'dependency-cycle':'ciclo en los requisitos del edificio',
      'queue-full-or-unreadable':'cola real llena o ilegible',
      'queue-unreadable':'cola real ilegible',
      'queue-full':'cola real llena',
      'levels-unreadable':'niveles de edificios ilegibles',
      'no-valid-build':'ninguna construcción ejecutable ahora',
      'native-head-changed':'la primera orden cambió; se volverá a comprobar',
      'recently-accepted-waiting-model':'orden aceptada; esperando actualización del juego',
      'max-level':'nivel máximo alcanzado',
      'resources':'esperando recursos',
      'population':'esperando población',
      'paused':'cola pausada',
      'manual-review':'comprobar la cola real antes de continuar',
      'inflight':'envío en curso',
    };
    if (simple[s]) return simple[s];
    let m = s.match(/^dependency-blocked:(.+)$/);
    if (m) return `requisito bloqueado: ${nativeBuildLabel(m[1])}`;
    m = s.match(/^missing:([^:]+):(\d+)\/(\d+)$/);
    if (m) return `falta ${nativeBuildLabel(m[1])}: nivel ${m[2]} de ${m[3]}`;
    m = s.match(/^plan-changed:([^>]+)->(.+)$/);
    if (m) return `el plan cambió de ${nativeBuildLabel(m[1])} a ${nativeBuildLabel(m[2])}`;
    return s;
  }
  function abResolvePrerequisite(townId, building, levels, seen) {
    const visited = seen || new Set();
    if (visited.has(building)) return { error: 'dependency-cycle' };
    visited.add(building);
    const req = abRequirementMap(townId, building);
    if (req == null) return { error: 'requirements-unreadable' };
    for (const dep of AB_BUILDINGS) {
      const need = +req[dep] || 0;
      if (!need || +(levels[dep] || 0) >= need) continue;
      const max = abMaxLevel(dep);
      if (max == null || levels[dep] >= max) return { error: `dependency-blocked:${dep}` };
      const nested = abResolvePrerequisite(townId, dep, levels, new Set(visited));
      if (nested && nested.building) return nested;
      if (nested && nested.error) return nested;
      return { building: dep, reason: `prerequisite for ${building}` };
    }
    return { building, reason: 'priority target' };
  }
  function abPickNextFromLevels(townId, levels) {
    if (!levels) return null;
    const explicit=nativeQueueBuildPlan(townId,levels);
    if(explicit.hasJob)return explicit.plan;
    const targets = goalEffectiveBuildTargets(townId);
    for (const target of goalBuildOrder(townId,Object.keys(targets))) {
      const max = abMaxLevel(target);
      if (max == null) { gbLogT('ab-max-' + target, 300000, `auto-queue: max level unreadable for ${target} — fail closed`); continue; }
      const want = Math.min(+targets[target] || 0, max);
      if (want <= 0 || +(levels[target] || 0) >= want) continue;
      const resolved = abResolvePrerequisite(townId, target, levels);
      if (resolved && resolved.building && goalQueueSuppressed(townId,'build',resolved.building)) {
        gbLogT('ab-user-block-' + townId + '-' + resolved.building, 60000, `auto-queue: ${resolved.building} blocked by virtual queue`);
        continue;
      }
      if (!resolved || !resolved.building) {
        gbLogT('ab-deps-' + townId + '-' + target, 300000, `auto-queue: ${target} blocked (${resolved && resolved.error || 'dependency unknown'})`);
        continue;
      }
      const aff = abCanAfford(townId, resolved.building);
      if (!aff.ok) continue;
      return { building: resolved.building, forTarget: target, reason: resolved.reason, cost: aff.need };
    }
    return null;
  }
  function abPickNext(townId) { return abPickNextFromLevels(townId, abCurrentLevels(townId)); }
  function abFinalValidate(townId, plan) {
    const q = abQueueInfo(townId);
    if (!q.known) return { ok: false, why: 'queue-unreadable' };
    if (q.len >= q.max) return { ok: false, why: 'queue-full', detail:`cola real llena (${q.len}/${q.max})` };
    const levels = abCurrentLevels(townId);
    if (!levels) return { ok: false, why: 'levels-unreadable' };
    const fresh = abPickNextFromLevels(townId, levels);
    if (!fresh) return { ok: false, why: 'no-valid-build' };
    if(plan&&plan.nativeJobId&&fresh.nativeJobId!==plan.nativeJobId)return {ok:false,why:'native-head-changed'};
    if (plan && fresh.building !== plan.building) return { ok: false, why: `plan-changed:${plan.building}->${fresh.building}`, replan: fresh };
    const targetLevel=+(levels[fresh.building]||0)+1;
    if(txRecentlyCommitted(`build:${townId}:${fresh.building}:${targetLevel}`,60000))return {ok:false,why:'recently-accepted-waiting-model'};
    const max = abMaxLevel(fresh.building);
    if (max == null || +(levels[fresh.building] || 0) >= max) return { ok: false, why: 'max-level' };
    const req = abRequirementMap(townId, fresh.building);
    if (req == null) return { ok: false, why: 'requirements-unreadable' };
    for (const [dep, need] of Object.entries(req)) if (+(levels[dep] || 0) < +need) return { ok: false, why: `missing:${dep}:${levels[dep] || 0}/${need}` };
    const aff = abCanAfford(townId, fresh.building);
    if (!aff.ok) return { ok: false, why: aff.why, detail:abAffordReason(aff) };
    return { ok: true, plan: Object.assign({},fresh,{targetLevel}) };
  }
  function abBuildUp(townId, plan) {
    return new Promise(resolve => {
      const pauseInfo = {};
      const pauseReason = !hostEnabled() ? 'automatización desactivada'
        : (captchaPaused('build') ? 'pausado por captcha'
          : (automationPaused(pauseInfo) ? `pausado: ${pauseInfo.reason || 'actividad del jugador'}`
            : (circuitOpen('build') ? 'construcción pausada por protección ante errores' : '')));
      if (pauseReason) {
        if(plan&&plan.nativeJobId)nativeQueueMarkBuild(townId,plan.nativeJobId,{status:'waiting',reason:pauseReason});
        resolve('pause'); return;
      }
      const check = abFinalValidate(townId, plan);
      if (!check.ok) {
        const detail=check.detail||abReasonText(check.why);
        if(plan&&plan.nativeJobId){const status=/^queue-/.test(check.why)?'waiting-queue':(check.why==='resources'?'waiting-resources':(check.why==='population'?'waiting-population':'blocked'));nativeQueueMarkBuild(townId,plan.nativeJobId,{status,reason:detail})}
        gbLogT('ab-precheck-' + townId, 30000, `auto-queue: final precheck blocked @${townId}: ${detail}`); resolve('replan'); return;
      }
      const building = check.plan.building;
      const nativeId=check.plan.nativeJobId||null;
      if(nativeId&&!nativeQueueMarkBuild(townId,nativeId,{inflight:{building,targetLevel:check.plan.targetLevel,at:Date.now()},manualReview:false,status:'sending',reason:`enviando ${nativeBuildLabel(building)}`})){resolve('replan');return}
      const nativeFail=(status,reason,manualReview)=>{if(!nativeId)return;const head=nativeQueueList(townId,'build',false)[0],reconcile=manualReview&&head&&head.id===nativeId&&head.inflight?Object.assign({},head.inflight):null;nativeQueueMarkBuild(townId,nativeId,{inflight:null,reconcile,manualReview:!!manualReview,status,reason})};
      bridgePost('build', {
        model_url: 'BuildingOrder', action_name: 'buildUp', arguments: { building_id: building }, town_id: +townId,
      }, (err) => {
        if (err === 'captcha' || err === 'captcha-pause') { nativeFail('waiting','pausado por captcha',false);resolve('captcha'); return; }
        if (err === 'timeout_unknown' || err === 'pending') { nativeFail('unknown','resultado desconocido; comprobar la cola real',true);gbLog(`auto-queue: ${building} @${townId} outcome unknown/pending — no retry`); resolve('unknown'); return; }
        if (err) { nativeFail('blocked',String(err),false);gbLog(`auto-queue: ${building} @${townId} fail: ${err}`); resolve('err'); return; }
        const waits=[0,200,600,1400,2800];let i=0;
        const confirmModel=()=>{const levels=abCurrentLevels(townId);if(levels&&+(levels[building]||0)>=+check.plan.targetLevel){gbLog(`auto-queue: ${AB_LABELS[building] || building} +1 in town ${townId}${check.plan.forTarget !== building ? ` (prereq for ${check.plan.forTarget})` : ''}`);resolve('ok');return}
          if(i>=waits.length){if(nativeId)nativeQueueMarkBuild(townId,nativeId,{inflight:{building,targetLevel:check.plan.targetLevel,at:Date.now(),accepted:true},manualReview:false,status:'accepted',reason:'aceptado; esperando actualización del juego'});gbLog(`auto-queue: ${building} @${townId} accepted; waiting for model update`);resolve('accepted');return}gbTimeout(confirmModel,waits[i++])};confirmModel();
      });
    });
  }
  function abTownIds() {
    const fromGame = townsFromGame();
    const ids=(fromGame&&fromGame.length?fromGame.map(t=>t.id):(state.towns||[]).map(t=>t.id)).map(String);
    for(const id of Object.keys(nativeQueueRoot().towns))if(!ids.includes(String(id)))ids.push(String(id));
    return ids;
  }
  let abBlockedLogSig = '';
  let abBlockedLogAt = 0;
  function abScan(reason) {
    const nativePending=nativeQueueHasPending('build');
    if (!hostEnabled() || (!state.abAuto && !nativePending && reason !== 'manual') || captchaPaused('build') || circuitOpen('build') || gbLocked('ab')) return;
    if (automationPaused({})) return;
    const ids = abTownIds();
    if (!ids.length) { gbLogT('ab-notowns', 120000, 'auto-queue: no towns'); return; }
    const lockToken = gbLock('ab', Math.max(300000, ids.length * 90000));
    if (!lockToken) return;
    let townIndex = 0, done = 0, captcha = false, operations = 0;
    const blocked = [];
    const noteBlocked = (townId, why) => {
      const head = nativeQueueList(townId, 'build', false)[0];
      if (!head || blocked.some(x => x.townId === String(townId))) return;
      const detail = String(why || head.reason || head.status || 'sin acción ejecutable');

      const stableDetail = /^waiting-(?:resources|population)$/.test(head.status || '')
        ? detail.replace(/\d+(?:[.,]\d+)?/g, '#') : detail;
      const townName = townNameById(townId), townLabel = townName === String(townId) ? String(townId) : `${townName} [${townId}]`;
      blocked.push({
        townId:String(townId),
        sig:[townId,head.id,head.status,stableDetail].join('|'),
        text:`ciudad ${townLabel} · #1 ${nativeBuildLabel(head.building)} ${head.fromLevel}→${head.toLevel} · ${detail}`,
      });
    };
    const maxOps = Math.max(1, ids.length * 7);
    const finish = () => {
      gbUnlock('ab', lockToken);
      if (done) flash(`auto-queue x${done}`);
      const prefix = `auto-queue${reason ? ' (' + reason + ')' : ''}: ${done} queued`;
      if (done) {
        abBlockedLogSig = ''; abBlockedLogAt = 0;
        gbLogT('ab-finish-ok', 30000, prefix);
      } else if (blocked.length) {
        const sig = blocked.map(x => x.sig).join('||');
        const now = Date.now();
        const quietRepeat = reason === 'native-watch' || reason === 'orch';
        if (!quietRepeat || sig !== abBlockedLogSig || now - abBlockedLogAt >= 300000) {
          abBlockedLogSig = sig; abBlockedLogAt = now;
          const shown = blocked.slice(0,3).map(x => x.text).join('; ');
          gbLog(`${prefix} — ${shown}${blocked.length>3 ? `; +${blocked.length-3} más` : ''}`);
        }
      } else gbLogT('ab-finish', 30000, prefix);
      renderAbQueue();
      gbTimeout(ibScan, 1500);
    };
    const nextTown = () => { townIndex++; gbTimeout(step, 150); };
    const step = () => {
      if (!gbInstanceAlive() || captcha || operations >= maxOps || townIndex >= ids.length) return finish();
      gbLockTouch('ab', lockToken);
      const id = ids[townIndex];

      nativeQueueReconcileBuild(id);
      const earlyHead = nativeQueueList(id,'build',false)[0];
      if (earlyHead && nativeQueuePaused(id,'build')) {
        nativeQueueSetJobState(earlyHead,'paused','cola pausada'); noteBlocked(id,'cola pausada'); return nextTown();
      }
      if (earlyHead && earlyHead.manualReview) {
        noteBlocked(id,earlyHead.reason||'comprobar la cola real antes de continuar'); return nextTown();
      }
      if (earlyHead && earlyHead.inflight) {
        noteBlocked(id,earlyHead.reason||'envío en curso'); return nextTown();
      }
      const q = abQueueInfo(id);
      if (!q.known) {
        const head=nativeQueueList(id,'build',false)[0];if(head)nativeQueueSetJobState(head,'blocked','cola real ilegible');
        noteBlocked(id,'cola real ilegible'); return nextTown();
      }
      if (q.len >= q.max) {
        const why=`cola real llena (${q.len}/${q.max})`,head=nativeQueueList(id,'build',false)[0];if(head)nativeQueueSetJobState(head,'waiting-queue',why);
        noteBlocked(id,why); return nextTown();
      }
      const levels = abCurrentLevels(id);
      if (!levels) {
        const head=nativeQueueList(id,'build',false)[0];if(head)nativeQueueSetJobState(head,'blocked','niveles ilegibles');
        noteBlocked(id,'niveles ilegibles'); return nextTown();
      }
      const plan = abPickNextFromLevels(id,levels);
      if (!plan) { noteBlocked(id); return nextTown(); }
      operations++;
      let opSettled=false;
      const markOperationUnknown=why=>{if(!plan.nativeJobId)return;const head=nativeQueueList(id,'build',false)[0];if(head&&head.id===plan.nativeJobId&&head.inflight)nativeQueueMarkBuild(id,plan.nativeJobId,{inflight:null,reconcile:Object.assign({},head.inflight),manualReview:true,status:'unknown',reason:why})};
      const watchdog=gbTimeout(()=>{if(opSettled||!gbInstanceAlive())return;opSettled=true;const why='operación sin respuesta; comprobar la cola real';markOperationUnknown(why);noteBlocked(id,why);gbLogT('ab-operation-watchdog-'+id,60000,`auto-queue: watchdog @${id}; moving on without retry`);nextTown()},90000);
      const handleResult=res=>{
        if(opSettled||!gbInstanceAlive())return;opSettled=true;gbClearTimeout(watchdog);
        if (res === 'ok') {
          done++;
          nativeQueueBuildApplied(id,plan);

          gbTimeout(step, AB_SEND_SPACING_MS + Math.random() * 350);
          return;
        }
        if(res==='accepted'){done++;return nextTown()}
        if (res === 'captcha') { noteBlocked(id,'pausado por captcha'); captcha = true; return finish(); }

        noteBlocked(id, nativeQueueList(id,'build',false)[0]?.reason || res);
        nextTown();
      };
      const handleError=err=>{if(opSettled||!gbInstanceAlive())return;opSettled=true;gbClearTimeout(watchdog);const why='error inesperado; comprobar la cola real';markOperationUnknown(why);noteBlocked(id,why);gbLogT('ab-operation-error-'+id,60000,`auto-queue: unexpected error @${id}: ${String(err)}`);nextTown()};
      try{Promise.resolve(abBuildUp(id,plan)).then(handleResult,handleError)}catch(err){handleError(err)}
    };
    step();
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
    box.replaceChildren();
    const head = document.createElement('div');
    head.style.cssText = 'display:grid;grid-template-columns:1.2fr .5fr .5fr .5fr auto;gap:4px;font-size:9px;color:#888;margin-bottom:2px';
    ['building', 'cur', 'tgt', 'max', ''].forEach(t => {
      const s = document.createElement('span'); s.textContent = t; head.appendChild(s);
    });
    box.appendChild(head);
    abEnsureOrder().forEach(b => {
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
      if (max != null) tgtEl.max = String(max);
      tgtEl.value = String(tgt);
      tgtEl.style.cssText = 'width:42px;background:#111;color:#cfc;border:1px solid #333;font:10px monospace';
      tgtEl.addEventListener('change', () => {
        abSetTarget(b, +tgtEl.value);
        renderAbQueue();
      });
      const maxEl = document.createElement('span');
      maxEl.textContent = max == null ? '?' : String(max);
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
      btns.appendChild(mkBtn('↑', () => { abMoveOrder(b, -1); renderAbQueue(); }));
      btns.appendChild(mkBtn('↓', () => { abMoveOrder(b, +1); renderAbQueue(); }));
      btns.appendChild(mkBtn('-', () => { abSetTarget(b, (state.abTargets[b] || 0) - 1); renderAbQueue(); }));
      btns.appendChild(mkBtn('+', () => { abSetTarget(b, (state.abTargets[b] || 0) + 1); renderAbQueue(); }));
      if (max != null) btns.appendChild(mkBtn('max', () => { abSetTarget(b, max); renderAbQueue(); }));
      row.appendChild(name);
      row.appendChild(cur);
      row.appendChild(tgtEl);
      row.appendChild(maxEl);
      row.appendChild(btns);
      box.appendChild(row);
    });
    if (status) {
      const q = townId ? abQueueInfo(townId) : null;
      const next = townId && q && q.len < q.max ? abPickNext(townId) : null;
      status.textContent = (gbLocked('ab') ? 'queueing... ' : '')
        + (townId ? `town ${townId}` : 'no town')
        + (q ? ` · queue ${q.len}/${q.max}` : '')
        + (next ? ` · next: ${AB_LABELS[next.building] || next.building}${next.forTarget !== next.building ? '→' + (AB_LABELS[next.forTarget] || next.forTarget) : ''}` : ' · idle')
        + (state.abAuto ? ' · AUTO' : ' · off');
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

  function caveCapacityFromLevel(level) {

    const n = Math.max(0, Math.floor(+level || 0));
    if (n === 10) return { capacity: null, unlimited: true };
    return { capacity: n > 0 && n < 10 ? n * 1000 : null, unlimited: false };
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
      if (hideCap == null && gdb) hideCap = gbProbeNum(gdb, ['getHideStorageCapacity', 'getEspionageStorage'], [hideLvl]);
      const gd = uw.GameData && uw.GameData.buildings && uw.GameData.buildings.hide;
      if (hideCap == null && gd && gd.storage != null) {
        const s = gd.storage;
        const v = +(Array.isArray(s) || typeof s === 'object' ? s[hideLvl] : s);
        if (isFinite(v) && v > 0) hideCap = v;
      }
      const maxHide = gd && gd.max_level;
      if (maxHide != null && +maxHide > 0 && hideLvl === +maxHide) unlimited = true;
      const unlimFn = gdb && gdb.getHideStorageLevelUnlimited;
      if (typeof unlimFn === 'function') {
        const unlimitedLevel = +unlimFn.call(gdb);
        if (Number.isFinite(unlimitedLevel) && unlimitedLevel > 0 && hideLvl === unlimitedLevel) unlimited = true;
      }
    } catch (_) {}
    const levelCapacity = caveCapacityFromLevel(hideLvl);
    if (levelCapacity.unlimited) unlimited = true;
    else if (hideCap == null) hideCap = levelCapacity.capacity;
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
    try { const av = plannerAvailable(info.town && (info.town.id || (info.town.attributes && info.town.attributes.id))); if (av && Number.isFinite(av.iron)) excess = Math.min(excess, Math.floor(av.iron)); } catch (_) {}
    if (excess < CAVE_MIN_STORE) return 0;

    if (!info.unlimited && (info.hideCap == null || info.stored == null)) return 0;
    if (!info.unlimited && info.hideCap != null && info.hideCap > 0 && info.stored != null) {
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
      if (!info.unlimited && info.hideCap != null && info.stored != null && info.stored >= info.hideCap) {
        gbLogT('cave-full-' + id, 120000, `cave: town ${id} hide full (${info.stored}/${info.hideCap})`);
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
    const lockToken = gbLock('cave');
    if (!lockToken) return;
    let i = 0, done = 0, captcha = false;
    (function next() {
      gbLockTouch('cave', lockToken);
      if (i >= jobs.length || captcha) {
        gbUnlock('cave', lockToken);
        if (done) gbLog(`cave: stashed ${done}/${jobs.length} town(s)${captcha ? ' (captcha abort)' : ''}`);
        renderCaveTowns();
        return;
      }
      const job = jobs[i++];
      const fresh = caveTownInfo(job.id);
      const freshAmt = caveExcessAmount(fresh);
      if (!fresh || freshAmt < CAVE_MIN_STORE) {
        gbLogT('cave-stale-' + job.id, 60000, `cave: town ${job.id} changed before send — skipped`);
        gbTimeout(next, 150);
        return;
      }
      caveStoreIron(job.id, Math.min(job.amt, freshAmt), (err) => {
        if (err === 'captcha' || err === 'captcha-pause') {
          captcha = true;
          i = jobs.length;
        } else if (!err) {
          done++;
          gbLog(`cave: town ${job.id} stored ${job.amt} iron (was ${job.iron}/${job.cap})`);
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
        extra = ` — hide${info.hideLvl} iron ${pct}% cave ${cave}`;
        if (pct === '?' || (!info.unlimited && info.hideCap == null)) {
          gbLogT('cave-unknown-' + id, 300000,
            `cave: town ${id} unread fields (iron=${info.iron} cap=${info.cap} hideCap=${info.hideCap} stored=${info.stored}) — run caveDiag()`);
        }
      }
      span.textContent = `${name} (#${id})${extra}`;
      label.appendChild(chk);
      label.appendChild(span);
      box.appendChild(label);
    });
  }

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
    const saved = load(STORE.CULTURE_GOLD_SPENT, null);
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
    const priority = ['theater', 'festival', 'procession', 'olympic'];
    const ordered = priority.filter(t => enabled.includes(t));
    for (const type of ordered) {
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
    const cultureLock = gbLock('culture');
    if (!cultureLock) return;
    let i = 0, done = 0;
    (function next() {
      gbLockTouch('culture', cultureLock);
      if (i >= jobs.length) {
        gbUnlock('culture', cultureLock);
        if (done) gbLog(`culture: started ${done}/${jobs.length}`);
        return;
      }
      const job = jobs[i++];

      if (!cultureCanAfford(job.id, job.ctype)) {
        gbTimeout(next, 200);
        return;
      }
      cultureStart(job.type, job.id, (err) => {
        if (err === 'captcha' || err === 'captcha-pause') { gbUnlock('culture', cultureLock); return; }
        if (err === 'timeout' || err === 'timeout_unknown' || err === 'pending') {
          gbLogT('culture-timeout', 60000, `culture: ${job.type} ${job.id} timeout_unknown — stopping batch`);
          gbUnlock('culture', cultureLock);
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

          gbUnlock('culture', cultureLock);
        }
      });
    })();
  }

  function economyProductionRate(townId) {
    const t=gbTownModel(townId); if(!t)return null; let p=null;
    try { if(typeof t.getProduction==='function') p=t.getProduction(); } catch(_){}
    try { if(!p && typeof t.getResourceProduction==='function') p=t.getResourceProduction(); } catch(_){}
    try { if(!p){const r=t.resources&&t.resources(); if(r) p={wood:r.wood_production??r.production_wood,stone:r.stone_production??r.production_stone,iron:r.iron_production??r.production_iron};} } catch(_){}
    if(!p||[p.wood,p.stone,p.iron].some(v=>v==null||!Number.isFinite(+v))) return null;

    return {wood:+p.wood,stone:+p.stone,iron:+p.iron};
  }
  function economyPlannedCost(townId, maxActions) {
    let plan=state.virtualQueue&&state.virtualQueue[String(townId)]; if(!plan||Date.now()-(+plan.generatedAt||0)>60000)try{plan=goalPlanTown(townId)}catch(_){}
    const out=plannerZero(); let n=0;
    for(const a of ((plan&&plan.actions)||[])){if(n++>=Math.max(1,+maxActions||5))break;const c=plannerNormCost(a.cost);if(!c)continue;for(const k of PLANNER_KEYS)out[k]+=+c[k]||0;}
    return out;
  }
  function economyForecast(townId,horizonSec) {
    const s=plannerSnapshot(townId); if(!s)return null; const sec=Math.max(0,+horizonSec||(+state.predictCfg.horizonHours||6)*3600); const prod=economyProductionRate(townId); const demand=economyPlannedCost(townId,5);
    const projected={}; for(const k of ['wood','stone','iron']) projected[k]=Math.max(0,s.live[k]-s.committed[k]+s.incoming[k]+(prod?prod[k]*sec/3600:0)-demand[k]);
    const overflow={}; for(const k of ['wood','stone','iron']) overflow[k]=s.live.cap>0?projected[k]>=s.live.cap:false;
    const deficit={}; for(const k of ['wood','stone','iron']) deficit[k]=Math.max(0,demand[k]-(s.availableSoft[k]+s.incoming[k]+(prod?prod[k]*sec/3600:0)));
    return {townId:String(townId),horizonSec:sec,snapshot:s,production:prod,demand,projected,overflow,deficit,productionKnown:!!prod};
  }
  function tradePredictiveJobs(towns,L) {
    const ledger=L||tradeLedger(towns), jobs=[], minBatch=Math.max(100,+state.tradeMinBatch||1000);if(!ledger)return jobs;
    const forecasts={}; for(const t of towns) forecasts[t.id]=economyForecast(t.id);
    const targets=towns.map(t=>({t,f:forecasts[t.id]})).filter(x=>x.f).sort((a,b)=>Object.values(b.f.deficit).reduce((x,y)=>x+y,0)-Object.values(a.f.deficit).reduce((x,y)=>x+y,0));
    for(const {t:tgtTown,f:tgtF} of targets){const tgt=ledger[tgtTown.id]; if(!tgt)continue;
      for(const res of ['wood','stone','iron']){let need=Math.floor(tgtF.deficit[res]||0); if(need<minBatch)continue;
        const sources=towns.filter(s=>s.id!==tgtTown.id).map(s=>({s,f:forecasts[s.id],l:ledger[s.id]})).filter(x=>x.f&&x.l).sort((a,b)=>(b.f.overflow[res]?1:0)-(a.f.overflow[res]?1:0));
        for(const {s,f,l} of sources){const av=plannerAvailable(s.id,{allowSoft:false}); if(!av||av.tradeCap==null)continue; const surplus=Math.max(0,Math.min(av[res], l[res]-Math.max(0,plannerReservePolicy(s.id).hard[res]+plannerReservePolicy(s.id).soft[res]))); const send=Math.floor(Math.min(need,surplus,av.tradeCap,l.tradeCap,tgt.cap-tgt[res])); if(send<minBatch)continue;
          const job={from:s.id,to:tgtTown.id,wood:0,stone:0,iron:0};job[res]=send;jobs.push(job);tradeApplyJob(ledger,job);need-=send;if(need<minBatch||jobs.length>=8)break;
        } if(jobs.length>=8)break;
      } if(jobs.length>=8)break;
    }
    return jobs;
  }
  function tradeTownRes(townId) {
    const uw = gameUw();
    try {
      const t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]);
      if (!t) return null;
      const r = t.resources && t.resources();
      let cap = null, tradeCap = null, pop = null, small = false;
      try { if (t.getStorageCapacity) cap = +t.getStorageCapacity(); } catch (_) {}
      if (!(cap > 0)) { const shared = townResState(townId); if (shared) cap = shared.cap; }
      try { if (t.getAvailableTradeCapacity) tradeCap = +t.getAvailableTradeCapacity(); } catch (_) {}
      try { if (t.getAvailablePopulation) pop = +t.getAvailablePopulation(); } catch (_) {}
      try {
        const a = t.attributes || (t.get && t.get('on_small_island') != null ? { on_small_island: t.get('on_small_island') } : {});
        small = !!(a.on_small_island || (t.isOnSmallIsland && t.isOnSmallIsland()));
      } catch (_) {}
      return {
        id: +townId,
        wood: r && +r.wood || 0, stone: r && +r.stone || 0, iron: r && +r.iron || 0,
        cap: cap || 0, tradeCap: tradeCap || 0, pop: pop || 0, small,
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

  let tradeIncomingCache={at:0,known:false,value:Object.create(null)};
  function tradeIncomingByTown() {
    if(Date.now()-tradeIncomingCache.at<1000)return {known:tradeIncomingCache.known,byTown:tradeIncomingCache.value};
    const out=Object.create(null),models=[],seenModels=new Set(),uw=gameUw();let known=false;
    const addModel=m=>{if(m&&!seenModels.has(m)){seenModels.add(m);models.push(m)}};
    const addCollection=c=>{if(Array.isArray(c))c.forEach(addCollection);else if(c&&Array.isArray(c.models))c.models.forEach(addModel)};
    try{const maps=uw.MM&&uw.MM.getModels&&uw.MM.getModels();if(maps&&Object.prototype.hasOwnProperty.call(maps,'Trade')){known=true;const m=maps.Trade;if(Array.isArray(m))m.forEach(addModel);else if(m&&typeof m==='object')Object.values(m).forEach(addModel)}}catch(_){}
    try{const c=uw.MM&&uw.MM.getOnlyCollectionByName&&uw.MM.getOnlyCollectionByName('Trade');if(c){known=true;addCollection(c)}for(const name of ['Trades','TradeMovement','TradeMovements','TownTrade','TownTrades','Transport','Transports'])addCollection(uw.MM&&uw.MM.getOnlyCollectionByName&&uw.MM.getOnlyCollectionByName(name))}catch(_){}
    try{const all=uw.MM&&uw.MM.getCollections&&uw.MM.getCollections()||{};if(Object.prototype.hasOwnProperty.call(all,'Trade'))known=true;for(const [name,c] of Object.entries(all))if(/trade|transport/i.test(name))addCollection(c)}catch(_){}
    const own=new Set(Object.keys(uw.ITowns&&uw.ITowns.towns||{}).map(String)),seenRows=new Set(),now=gameNow();
    for(const m of models){try{
      const a=m.attributes||m,status=String(a.status||a.state||'').toLowerCase();if(/cancel|complete|arrived|finished|deleted/.test(status))continue;
      let dest=null;for(const fn of ['getDestinationTownId','getTargetTownId','getReceivingTownId']){try{if(dest==null&&typeof m[fn]==='function')dest=m[fn]()}catch(_){}}
      dest=dest??a.destination_town_id??a.target_town_id??a.receiving_town_id??a.receiver_town_id??a.to_town_id??null;if(dest==null||!/^\d+$/.test(String(dest))||!own.has(String(dest)))continue;
      const eta=a.arrival_at??a.arrival_time??a.arrives_at??a.to_be_completed_at??a.end_at??null;if(eta!=null&&Number.isFinite(+eta)){const t=+eta>1e12?+eta/1000:+eta;if(t<=0||(t>1e9&&t<=now))continue}
      let res=a.resources||a.resource||a.payload||null;try{if(!res&&typeof m.getResources==='function')res=m.getResources()}catch(_){}res=res&&res.attributes||res||{};
      const wood=Math.max(0,+(a.wood??res.wood)||0),stone=Math.max(0,+(a.stone??res.stone)||0),iron=Math.max(0,+(a.iron??res.iron??res.silver)||0);if(!(wood+stone+iron>0))continue;
      const rawId=a.id??m.id??'',rid=rawId===''?'':String(rawId)+'|'+String(dest);if(rid&&seenRows.has(rid))continue;if(rid)seenRows.add(rid);
      const row=out[String(dest)]||(out[String(dest)]={wood:0,stone:0,iron:0});row.wood+=wood;row.stone+=stone;row.iron+=iron;
    }catch(_){}}
    tradeIncomingCache={at:Date.now(),known,value:out};return {known,byTown:out};
  }

  function tradeLedger(towns) {
    const incomingState=tradeIncomingByTown();if(!incomingState.known)return null;const L = Object.create(null),incoming=incomingState.byTown;
    for (const t of towns) {
      const mov=incoming[String(t.id)]||{},pending=plannerSnapshot(t.id)?.incoming||{};
      L[t.id] = {

        wood: t.wood+(+mov.wood||0)+(+pending.wood||0), stone: t.stone+(+mov.stone||0)+(+pending.stone||0), iron: t.iron+(+mov.iron||0)+(+pending.iron||0),
        cap: t.cap, tradeCap: t.tradeCap, small: t.small,
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
  function tradeFillStorageJobs(towns, L) {
    const ledger = L || tradeLedger(towns);
    if(!ledger)return [];
    const reserveN = Number(state.tradeReservePct);
    const reserve = Math.min(80, Math.max(0, Number.isFinite(reserveN) ? reserveN : 20)) / 100;
    const minBatch = Math.max(100, +state.tradeMinBatch || 1000);
    const jobs = [];
    const ids = towns.map(t => t.id);
    for (const tgtId of ids) {
      const tgt = ledger[tgtId];
      if (!tgt || !(tgt.cap > 0)) continue;
      const empty = Math.min(tgt.wood, tgt.stone, tgt.iron) / tgt.cap;
      if (empty >= 0.25) continue;
      for (const srcId of ids) {
        if (srcId === tgtId) continue;
        const src = ledger[srcId];
        if (!src || !(src.cap > 0)) continue;
        const fill = Math.max(src.wood, src.stone, src.iron) / src.cap;
        if (fill <= 0.85 || src.tradeCap < minBatch) continue;
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
        const job = {
          from: srcId, to: tgtId,
          wood: Math.floor(send.wood * scale),
          stone: Math.floor(send.stone * scale),
          iron: Math.floor(send.iron * scale),
        };
        if (job.wood + job.stone + job.iron < minBatch) continue;
        jobs.push(job);
        tradeApplyJob(ledger, job);
        if (jobs.length >= 6) return jobs;
      }
    }
    return jobs;
  }
  function tradeIslandShipJobs(towns, L) {
    if (!state.islandShip) return [];
    const ledger = L || tradeLedger(towns);
    if(!ledger)return [];
    const jobs = [];
    const minBatch = Math.max(100, +state.tradeMinBatch || 1000);
    const reserveN = Number(state.tradeReservePct);
    const reservePct = Math.min(80, Math.max(0, Number.isFinite(reserveN) ? reserveN : 20)) / 100;
    const ids = towns.map(t => t.id);
    for (const tgtId of ids) {
      const tgt = ledger[tgtId];
      if (!tgt || !tgt.small) continue;
      for (const srcId of ids) {
        const src = ledger[srcId];
        if (!src || src.small || src.tradeCap < 1000) continue;
        const keep = Math.floor((src.cap || 0) * reservePct);
        let wood = Math.max(0, Math.min(src.tradeCap / 3, src.wood - keep, Math.max(0, tgt.cap - tgt.wood)));
        let stone = Math.max(0, Math.min(src.tradeCap / 3, src.stone - keep, Math.max(0, tgt.cap - tgt.stone)));
        let iron = Math.max(0, Math.min(src.tradeCap / 3, src.iron - keep, Math.max(0, tgt.cap - tgt.iron)));
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

  function tradeFreeSpace(tgt, res) {
    if (!tgt || !(tgt.cap > 0)) return null;
    return Math.max(0, tgt.cap - (+tgt[res] || 0));
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

        const room = {
          wood: tradeFreeSpace(cur, 'wood'), stone: tradeFreeSpace(cur, 'stone'), iron: tradeFreeSpace(cur, 'iron'),
        };
        const send = {
          wood: Math.min(deficit.wood, Math.max(0, src.wood - d.keep), src.tradeCap, room.wood == null ? Infinity : room.wood),
          stone: Math.min(deficit.stone, Math.max(0, src.stone - d.keep), src.tradeCap, room.stone == null ? Infinity : room.stone),
          iron: Math.min(deficit.iron, Math.max(0, src.iron - d.keep), src.tradeCap, room.iron == null ? Infinity : room.iron),
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
  function tradeValidateJob(job) {
    const src = tradeTownRes(job.from), tgt = tradeTownRes(job.to);
    if (!src || !tgt || !(src.cap > 0) || !(tgt.cap > 0)) return { ok: false, why: 'town-state-unreadable' };
    const reserveN = Number(state.tradeReservePct);
    const reservePct = Math.min(80, Math.max(0, Number.isFinite(reserveN) ? reserveN : 20)) / 100;
    const keep = Math.floor(src.cap * reservePct);
    const total = (+job.wood || 0) + (+job.stone || 0) + (+job.iron || 0);
    const pav = plannerAvailable(job.from, {allowSoft:false});
    const incomingState=tradeIncomingByTown();if(!incomingState.known)return {ok:false,why:'incoming-trades-unreadable'};const mov=incomingState.byTown[String(job.to)]||{},pending=plannerSnapshot(job.to)?.incoming||{};
    if (!pav) return { ok:false, why:'planner-unreadable' };
    if (!(total > 0) || src.tradeCap < total || pav.tradeCap == null || pav.tradeCap < total) return { ok: false, why: 'merchant-capacity' };
    for (const k of ['wood','stone','iron']) {
      const n = +job[k] || 0;
      if (n < 0 || src[k] - n < keep || pav[k] < n) return { ok: false, why: `source-${k}` };
      if (tgt[k] + (+mov[k]||0) + (+pending[k]||0) + n > tgt.cap) return { ok: false, why: `target-${k}-capacity` };
    }
    return { ok: true };
  }

  function tradeScan(reason) {
    if (!hostEnabled() || (!state.autoTrade && !state.islandShip) || captchaPaused('trade')) return;
    if (automationPaused({})) return;
    if (gbLocked('trade')) return;
    const towns = tradeListTowns();
    if (towns.length < 2) { gbLogT('trade-towns', 180000, 'trade: need ≥2 towns'); return; }
    const ledger = tradeLedger(towns);
    if(!ledger){gbLogT('trade-incoming-unreadable',180000,'trade: incoming movements unavailable — fail closed');return}
    let jobs = [];
    const preset = state.tradePreset || 'storage';

    if (state.autoTrade && preset === 'smart') {
      jobs = jobs.concat(tradePredictiveJobs(towns, ledger));
    } else if (state.autoTrade && preset === 'storage') {
      jobs = jobs.concat(tradeFillStorageJobs(towns, ledger));
    } else if (state.autoTrade && (preset === 'party' || preset === 'unit')) {
      jobs = jobs.concat(tradeGoalJobs(towns, ledger, preset));
    }
    if (state.islandShip) jobs = jobs.concat(tradeIslandShipJobs(towns, ledger));
    if (!jobs.length) {
      gbLogT('trade-idle', 180000, `trade: nothing to send (${reason || 'scan'})`);
      return;
    }
    const lockToken = gbLock('trade');
    if (!lockToken) return;
    let i = 0, done = 0;
    (function next() {
      gbLockTouch('trade', lockToken);
      if (i >= jobs.length) {
        gbUnlock('trade', lockToken);
        if (done) gbLog(`trade: sent ${done}/${jobs.length}`);
        return;
      }
      const j = jobs[i++];
      const valid = tradeValidateJob(j);
      if (!valid.ok) {
        gbLogT('trade-stale-' + j.from + '-' + j.to, 60000, `trade: stale job ${j.from}→${j.to} skipped (${valid.why})`);
        gbTimeout(next, 100);
        return;
      }
      tradeSend(j.from, j.to, j.wood, j.stone, j.iron, (err) => {
        if (err === 'captcha' || err === 'captcha-pause') { gbUnlock('trade', lockToken); return; }
        if (!err) {
          done++;
          gbLog(`trade: ${j.from}→${j.to} w${j.wood}/s${j.stone}/i${j.iron}`);
        } else gbLogT('trade-err', 60000, `trade err ${err}`);
        gbTimeout(next, 800 + Math.random() * 600);
      });
    })();
  }
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
          `rural-trade: town ${tid} ${wantRes} already at capacity — skip`);
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
    const ruralTradeLock = gbLock('rural-trade', Math.max(180000, jobs.length * 30000));
    if (!ruralTradeLock) return;
    let i = 0, done = 0;
    (function next() {
      if (i >= jobs.length) {
        gbUnlock('rural-trade', ruralTradeLock);
        if (done) gbLog(`rural-trade: ${done}/${jobs.length}`);
        return;
      }
      const j = jobs[i++];
      gbLockTouch('rural-trade', ruralTradeLock);
      ruralTradePost(j.relId, j.farmId, j.amount, j.townId, (err) => {
        if (err === 'captcha' || err === 'captcha-pause') { gbUnlock('rural-trade', ruralTradeLock); return; }
        if (!err) {
          done++;
          gbLog(`rural-trade: town ${j.townId} farm ${j.farmId} amt ${j.amount} (≥${minRatio})`);
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
  const KP_UNLOCK_MIN = 100;
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

    const jobQueue = [];
    if (locked.length > 0) {

      if (available > KP_UNLOCK_MIN) {
        const startUnlocked = relations.length - locked.length;

        for (const tid of townIds) {
          const xy = ruralTownIslandXY(tid);
          if (!xy) continue;
          for (const rel of locked) {
            const a = rel.attributes || {};
            const ft = farmById[a.farm_town_id];
            if (!ft || ft.island_x !== xy.x || ft.island_y !== xy.y) continue;
            jobQueue.push({ kind: 'unlock', relId: a.id || rel.id, farmId: a.farm_town_id, townId: tid });
          }
        }
        if (!jobQueue.length) {
          gbLogT('rurallevel-no-island-match', 180000, 'rural-level: locked villages exist but none match own-town islands');
          return;
        }

        jobQueue._startUnlocked = startUnlocked;
      } else {
        gbLogT('rurallevel-kp-low', 180000, `rural-level: ${locked.length} locked village(s) waiting; KP ${available} ≤ ${KP_UNLOCK_MIN} — upgrades only after unlock phase drains`);
        return;
      }
    } else {

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
            jobQueue.push({ kind: 'upgrade', relId: a.id || rel.id, farmId: a.farm_town_id, townId: tid, stage, cost });
            available -= cost;
          }
        }
      }
    }

    if (!jobQueue.length) {
      gbLogT('rurallevel-idle', 180000, `rural-level: idle (${reason || 'scan'})`);
      return;
    }

    const lockTtl = Math.min(600000, Math.max(180000, jobQueue.length * 1500));
    const ruralLevelLock = gbLock('rural-level', lockTtl);
    if (!ruralLevelLock) return;
    let i = 0, done = 0, stopped = '';
    const startUnlocked = jobQueue._startUnlocked || 0;
    (function next() {
      if (i >= jobQueue.length || stopped) {
        gbUnlock('rural-level', ruralLevelLock);
        if (done) gbLog(`rural-level: ${done}/${jobQueue.length}${stopped ? ' (stopped: ' + stopped + ')' : ''} — phase: ${locked.length ? 'unlock' : 'upgrade'}`);
        return;
      }
      const j = jobQueue[i++];

      if (j.kind === 'unlock') {
        const cur = ruralKillpoints();
        if (cur <= KP_UNLOCK_MIN) { stopped = 'kp-low'; return next(); }
        const idx = startUnlocked + done;
        const need = idx < unlockCosts.length ? unlockCosts[idx] : 100;
        if (cur < need) { stopped = 'kp-short(need ' + need + ')'; return next(); }
      }
      gbLockTouch('rural-level', ruralLevelLock);
      const fire = j.kind === 'unlock' ? ruralUnlock : ruralUpgrade;
      fire(j.relId, j.farmId, j.townId, (err) => {
        if (err === 'captcha' || err === 'captcha-pause') {
          stopped = err;
          gbUnlock('rural-level', ruralLevelLock);
          gbLogT('rurallevel-pause', 60000, `rural-level paused: ${err}`);
          return;
        }
        if (!err) {
          done++;
        } else if (j.kind === 'unlock') {

          stopped = 'unlock-err:' + err;
        }
        gbTimeout(next, 700 + Math.random() * 400);
      });
    })();
  }

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
    const v = gbProbeAttr(d, ['research_points', 'research_points_cost', 'points', 'research_point_cost']);
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
    if (needPts == null) return { ok: false, why: 'research point cost unreadable' };
    const have = researchPointsAvailable(townId, info);
    if (have == null) return { ok: false, why: 'available research points unreadable' };
    if (have < needPts) return { ok: false, why: `points ${have}/${needPts}` };
    const cost = researchCost(tech);
    if (!cost) return { ok: false, why: 'resource cost unreadable' };
    const aff = gbAfford(townId, cost);
    if (!aff.ok) return { ok: false, why: aff.detail || 'resources unreadable/insufficient' };
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
      return a.research_type || a.research_id || a.research || a.type || a.id || null;
    } catch (_) { return null; }
  }
  function researchDepsOk(townId, info, tech) {
    try {
      const uw = gameUw();
      const def = uw.GameData && uw.GameData.researches && uw.GameData.researches[tech];
      if (!def || !info || !info.techs || !info.town) return false;
      const rdeps = def.research_dependencies || def.dependencies || [];
      const depList = Array.isArray(rdeps) ? rdeps : Object.keys(rdeps || {}).filter(k => rdeps[k]);
      for (const d of depList) {
        const id = typeof d === 'string' ? d : (d && (d.id || d.research_id || d.research_type));
        if (id && !info.techs[id]) return false;
      }
      const bdeps = def.building_dependencies || def.required_buildings || {};
      let buildings = null;
      try {
        const b = info.town.getBuildings ? info.town.getBuildings() : (info.town.buildings && info.town.buildings());
        buildings = b && (b.attributes || b);
      } catch (_) { buildings = null; }
      if (!buildings) return false;
      for (const b of Object.keys(bdeps || {})) {
        const raw = bdeps[b];
        const need = +(raw && typeof raw === 'object' ? (raw.level ?? raw.min_level ?? raw.value) : raw) || 0;
        const have = +(buildings[b] || 0);
        if (have < need) return false;
      }
      const academyNeed = +(def.academy_level ?? def.required_academy_level ?? def.building_level ?? def.level ?? 0);
      if (academyNeed > 0 && +info.academy < academyNeed) return false;
      const res = def.resources || def.costs || def.cost;
      if (!res || res.wood == null || res.stone == null || res.iron == null) return false;
      if (researchPointCost(tech) == null) return false;
      return true;
    } catch (_) { return false; }
  }
  function researchValidateJob(job) {
    const info = researchTownTechs(job.townId);
    if (!info || !(info.academy > 0)) return { ok: false, why: 'research state unreadable' };
    if (info.techs && info.techs[job.tech]) return { ok: false, why: 'already researched' };
    if ((info.orders || []).some(o => String(researchOrderTechId(o)) === String(job.tech))) return { ok: false, why: 'already queued' };
    if ((info.orders || []).length >= 2) return { ok: false, why: 'queue full' };
    if (!researchDepsOk(job.townId, info, job.tech)) return { ok: false, why: 'dependencies unavailable/unmet' };
    return researchCanAfford(job.townId, job.tech, info);
  }

  function researchScan(reason) {
    if (!hostEnabled() || !state.autoResearch || captchaPaused('research')) return;
    if (automationPaused({})) return;
    if (gbLocked('research')) return;
    const globalTargets = researchEnsureTargets();
    let townIds = [];
    try {
      const uw = gameUw();
      townIds = Object.keys((uw.ITowns && uw.ITowns.towns) || {});
    } catch (_) {}
    let job = null;
    for (const tid of townIds) {
      const targets = goalEffectiveResearchTargets(tid, globalTargets);
      const ordered = Object.keys(targets).sort((a, b) => (+targets[a].order || 0) - (+targets[b].order || 0));
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
    const valid = researchValidateJob(job);
    if (!valid.ok) { gbLogT('research-stale-' + job.townId + '-' + job.tech, 60000, `research: final precheck blocked (${valid.why})`); return; }
    const lockToken = gbLock('research');
    if (!lockToken) return;
    researchPost(job.townId, job.tech, (err) => {
      gbUnlock('research', lockToken);
      if (!err) gbLog(`research: town ${job.townId} → ${job.tech}`);
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

  const alertLastSent = Object.create(null);
  const alertPending = Object.create(null);
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
  function alertWebhookKey(event, payload) {
    const p = payload || {};
    let id = p.id ?? p.movement_id ?? p.command_id ?? p.report_id ?? p.questId ?? '';
    if (!id && p.finding) id = p.finding.id ?? p.finding.report_id ?? p.finding.ts ?? '';
    if (!id && p.watchlist != null) id = 'watch:' + p.watchlist;
    if (!id) id = p.dest ?? p.townId ?? p.town_id ?? p.feature ?? '';
    const subtype = p.cs ? 'cs' : '';
    return `${event}:${subtype}:${String(id || '-').slice(0, 96)}`;
  }
  function alertWebhook(event, payload) {
    const url = (state.webhookUrl || '').trim();
    if (!url) return;
    if (state.dryRun) {
      gbLogT('webhook-dry-' + event, 60000, `DRY-RUN webhook ${event}: ${dryRunFmt(payload)}`);
      return;
    }
    if (!alertWebhookUrlOk(url)) {
      gbLogT('webhook-url', 120000, 'webhook: invalid Discord/Telegram URL');
      return;
    }
    const ev = state.webhookEvents || {};
    if (ev[event] === false) return;
    const now = Date.now();
    const key = alertWebhookKey(event, payload);
    if (alertPending[key]) return;
    if ((alertLastSent[key] || 0) + 5 * 60 * 1000 > now) return;
    const text = `GrepBot [${location.host}] ${event}\n` +
      '```json\n' + JSON.stringify(payload || {}, null, 2).slice(0, 1800) + '\n```';
    let body;
    if (alertIsTelegram(url)) {
      const chatId = alertTelegramChatId(url);
      if (!chatId) {
        gbLogT('webhook-chat', 120000, 'webhook: Telegram chat_id missing');
        return;
      }
      body = { chat_id: chatId, text: text.slice(0, 3900), disable_web_page_preview: true };
    } else {
      body = {
        content: null,
        embeds: [{
          title: `GrepBot: ${event}${payload && payload.cs ? ' [CS]' : ''}`,
          description: '```json\n' + JSON.stringify(payload || {}, null, 2).slice(0, 1800) + '\n```',
          timestamp: new Date().toISOString(),
          footer: { text: location.host },
        }],
      };
    }
    alertPending[key] = now;
    try {
      gbXhr({
        scope: 'external',
        method: 'POST',
        url,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify(body),
        onload: (r) => {
          delete alertPending[key];
          if (r.status >= 200 && r.status < 300) alertLastSent[key] = Date.now();
          else gbLogT('webhook-fail-' + key, 60000, 'webhook status ' + r.status);
        },
        onerror: () => {
          delete alertPending[key];
          gbLogT('webhook-err-' + key, 60000, 'webhook transport error');
        },
      });
    } catch (e) {
      delete alertPending[key];
      gbLogT('webhook-ex-' + key, 60000, 'webhook ' + String(e));
    }
  }
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
          gbLogT('merchant-gold', 300000, `merchant: ${id} costs ${price}, gold ${gold} — skip`);
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
      gbLogT('merchant-noid', 60000, 'merchant: offer has no id — skip');
      return;
    }
    const merchantLock = gbLock('merchant', 180000);
    if (!merchantLock) return;

    const liveAttrs = job.offer && (job.offer.attributes || job.offer);
    const livePrice = liveAttrs && Number(liveAttrs.price != null ? liveAttrs.price : liveAttrs.gold);
    const liveId = liveAttrs && String(liveAttrs.item_id || liveAttrs.offer_id || '').toLowerCase().trim();
    const freshGold = gbPlayerGold();
    if (!liveAttrs || !merchantExactMatch(job.itemId, liveId) || !Number.isFinite(livePrice)
        || livePrice > +job.wish.maxPrice || (freshGold != null && freshGold < livePrice)) {
      gbUnlock('merchant', merchantLock);
      gbLogT('merchant-stale', 60000, 'merchant: final precheck failed; offer changed');
      return;
    }
    bridgePost('merchant', {
      model_url: `PhoenicianSalesmanOffer/${oid}`,
      action_name: 'buy',
      arguments: {},
      town_id: +job.townId,
    }, (err) => {
      if (err === 'timeout' || err === 'timeout_unknown' || err === 'pending') {
        gbLogT('merchant-timeout', 60000, `merchant: timeout_unknown for ${job.itemId} — no fallback`);
        gbUnlock('merchant', merchantLock);
        return;
      }
      if (!err) {
        gbLog(`merchant: bought ${job.wish.item || job.wish.id} @ ${job.price}`);
        gbUnlock('merchant', merchantLock);
        return;
      }

      if (!/unknown.?action|invalid.?action|not.?found|does.?not.?exist/i.test(String(err))) {
        gbLogT('merchant-err', 60000, `merchant err ${err}`);
        gbUnlock('merchant', merchantLock);
        return;
      }
      gameAjaxPost('merchant', 'phoenician_salesman', 'buy', {
        offer_id: oid,
        town_id: +job.townId,
      }, (e2) => {
        gbUnlock('merchant', merchantLock);
        if (!e2) gbLog(`merchant: bought via ajax ${job.wish.item || job.wish.id}`);
        else gbLogT('merchant-err', 60000, `merchant err ${err}/${e2}`);
      });
    });
  }

  const FAVOR_TEMPLE_PLUNDER = /temple_plunder|plunder_temple|templeplunder|saqueo.?templo|plunderung.?tempel/i;

  const favorOwnMoves = Object.create(null);

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
    const tpl = state.ptTradeTpl ? 'payload aprendido' : 'payload SIN aprender';
    const view = state.ptViewUrl ? 'vista aprendida' : 'vista SIN aprender';
    return (townId == null ? 'sin barco' : `barco en la ciudad ${townId}`) + `  |  ${tpl}  |  ${view}`;
  }
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
    if (!state.autoFavor) return;
    gbLogT('favor-disabled-v160', 300000, 'favor: automation disabled in 1.6.0 — no canonical safe target/action contract available');
    return;
    if (!hostEnabled() || !state.autoFavor || captchaPaused('favor')) return;
    if (automationPaused({})) return;
    if (gbLocked('favor')) return;
    const cfg = state.favorCfg || {};
    const thresh = +cfg.thresh || 200;
    const unit = cfg.unit || 'harpy';
    const maxC = Math.min(8, Math.max(1, +cfg.maxConcurrent || 2));
    const fav = favorCurrent();
    const god = cfg.god || 'athena';
    const cur = +(fav[god] || fav['favor_' + god] || fav.favor || 0);

    if (cur >= thresh && !cfg.force) {
      gbLogT('favor-ok', 180000, `favor: ${god}=${cur} ≥ ${thresh}`);
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
      gbLogT('favor-enroute', 120000, `favor: ${enroute} own en-route (≥${maxC})`);
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
    const favorLock = gbLock('favor', 180000);
    if (!favorLock) return;
    const tpl = state.attackTpl;
    const payload = {
      model_url: (tpl && tpl.model_url) || ('Town/' + townId),
      action_name: (tpl && tpl.action_name) || 'sendUnits',
      arguments: Object.assign({ id: +targetId, type: 'attack' }, units),
      town_id: +townId,
    };
    payload.model_url = String(payload.model_url).replace(/Town\/\d+/, 'Town/' + townId);
    bridgePost('favor', payload, (err, data) => {
      gbUnlock('favor', favorLock);
      if (err === 'timeout' || err === 'timeout_unknown' || err === 'pending') {
        gbLogT('favor-timeout', 60000, 'favor: timeout_unknown — not retrying');
        return;
      }
      if (!err) {
        const mid = (data && (data.command_id || data.id || data.movement_id)) || ('f' + Date.now());
        favorOwnMoves[String(mid)] = Date.now();
        gbLog(`favor: sent ${JSON.stringify(units)} from ${townId} → ${targetId}`);
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
    const budgetN = Number(cfg.budget);
    const budget = Number.isFinite(budgetN) ? Math.max(0, budgetN) : 50000;
    if (budget <= 0) { gbLogT('wonder-off-budget', 300000, 'wonder: budget is 0 — no donations'); return; }
    if (wonderSpentToday.amount >= budget) {
      gbLogT('wonder-budget', 300000, `wonder: daily budget ${budget} reached`);
      return;
    }
    const reserveN = Number(cfg.reserve);
    const reserve = Number.isFinite(reserveN) ? Math.max(0, reserveN) : 5000;
    const want = {
      wood: +cfg.wood || 0,
      stone: +cfg.stone || 0,
      iron: +cfg.iron || 0,
    };
    if (!(want.wood || want.stone || want.iron)) {
      gbLogT('wonder-noamount', 300000, 'wonder: donation amounts are all 0 — no implicit donation');
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
    const fresh = tradeTownRes(job.townId);
    const tot = job.send.wood + job.send.stone + job.send.iron;
    const pav = plannerAvailable(job.townId, {allowSoft:false});
    if (!fresh || !pav || fresh.tradeCap < tot || pav.tradeCap == null || pav.tradeCap < tot || pav.wood < job.send.wood || pav.stone < job.send.stone || pav.iron < job.send.iron || fresh.wood - job.send.wood < reserve || fresh.stone - job.send.stone < reserve || fresh.iron - job.send.iron < reserve || wonderSpentToday.amount + tot > budget) {
      gbLogT('wonder-stale-' + job.townId, 60000, 'wonder: final stock/capacity/budget precheck failed');
      return;
    }
    const lockToken = gbLock('wonder');
    if (!lockToken) return;
    gameAjaxPost('wonder', 'wonders', 'send_resources', {
      id: +wonderId,
      wood: job.send.wood,
      stone: job.send.stone,
      iron: job.send.iron,
      town_id: +job.townId,
    }, (err) => {
      if (err === 'timeout' || err === 'timeout_unknown' || err === 'pending') {
        gbLogT('wonder-timeout', 60000, `wonder: timeout_unknown town ${job.townId} — no fallback/duplicate`);
        gbUnlock('wonder', lockToken);
        return;
      }
      if (!err) {
        wonderSpentToday.amount += tot;
        wonderSaveSpent(wonderSpentToday);
        gbLog(`wonder: town ${job.townId} sent ${tot} to WW ${wonderId}`);
        gbUnlock('wonder', lockToken);
        return;
      }

      if (!/unknown|not.?found|does.?not.?exist|invalid.?controller|invalid.?action/i.test(String(err))) {
        gbLogT('wonder-err', 60000, `wonder err ${err}`);
        gbUnlock('wonder', lockToken);
        return;
      }
      gameAjaxPost('wonder', 'factions', 'send_resources', {
        wonder_id: +wonderId,
        wood: job.send.wood, stone: job.send.stone, iron: job.send.iron,
        town_id: +job.townId,
      }, (e2) => {
        gbUnlock('wonder', lockToken);
        if (!e2) {
          wonderSpentToday.amount += tot;
          wonderSaveSpent(wonderSpentToday);
          gbLog(`wonder: sent via factions from ${job.townId}`);
        } else gbLogT('wonder-err', 60000, `wonder err ${err}/${e2}`);
      });
    });
  }

  function defenseMode(){const m=String((state.defenseCfg&&state.defenseCfg.mode)||'notify');return ['notify','safe','smart'].includes(m)?m:'notify'}
  function defenseLocalStrength(townId){const u=dodgeTownUnits(townId);let score=0,count=0;for(const[id,n0]of Object.entries(u)){const n=+n0||0,m=unitMeta(id);if(!m||m.is_naval)continue;const fn=classifyUnitFn(id);if(fn==='defense'||fn==='both'){score+=n*Math.max(1,+m.population||1);count+=n}}return{score,count}}
  function defenseSupportOptions(dest,eta){const out=[];let ids=[];try{ids=Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{})}catch(_){};const target={town_id:+dest,id:+dest,kind:'town',...townCoords(dest)};for(const id of ids){if(String(id)===String(dest))continue;const units={};const live=townLiveUnits(id);for(const[k,n]of Object.entries(live)){const fn=classifyUnitFn(k),m=unitMeta(k);if(m&&!m.is_naval&&(fn==='defense'||fn==='both')&&+n>0)units[k]=+n}if(!Object.keys(units).length)continue;const same=isSameIsland(id,target),boats=boatCapacityCheck(units,same);if(!boats.ok)continue;const travel=computeTravelSeconds(id,target,units,true);if(travel!=null&&(eta==null||travel<eta))out.push({from:id,travel,units})}return out.sort((a,b)=>a.travel-b.travel)}
  function defenseAssessment(mov,incoming){const eta=dodgeEtaSec(mov);const all=incoming||dodgeIncomingMovements();const simultaneous=all.filter(x=>String(x.dest)===String(mov.dest)).length;const local=defenseLocalStrength(mov.dest);const supports=defenseSupportOptions(mov.dest,eta);const safe=dodgeSafeTown(mov.dest,all);const evacUnits=dodgeTownUnits(mov.dest);const evac=safe?dodgeSupportValidate(mov.dest,safe,evacUnits):{ok:false,why:'no-safe-town'};const militia=dodgeCanRaiseMilitia(mov.dest);let risk=0;if(mov.hasCs)risk+=60;if(eta!=null&&eta<15*60)risk+=25;if(simultaneous>1)risk+=Math.min(25,(simultaneous-1)*8);if(local.score<200)risk+=10;if(supports.length)risk-=Math.min(20,supports.length*5);return{eta,simultaneous,local,supports,safeTown:safe,evac,militia,risk,hasCs:!!mov.hasCs}}
  function defenseShouldDodge(mov,incoming){const mode=defenseMode(),a=defenseAssessment(mov,incoming);if(mode==='notify')return{yes:false,assessment:a,why:'notify'};if(mode==='safe')return{yes:true,assessment:a,why:'safe'};if(!state.defenseCfg.smartAuto)return{yes:false,assessment:a,why:'smart-auto-off'};if(!a.evac.ok)return{yes:false,assessment:a,why:'cannot-evacuate'};if(a.hasCs||a.risk>=35)return{yes:true,assessment:a,why:'risk'};return{yes:false,assessment:a,why:'defend/observe'}}
  function dodgeReturnSave(){save(STORE.DODGE_RETURNS,state.dodgeReturns||{})}
  function dodgeReturnRecord(mov,from,dest,data){const id=String((data&&(data.command_id||data.commandId||data.movement_id||data.id))||'');if(!id)return;const arrival=+(mov&&mov.arrival)||0,margin=Math.max(0,+((state.defenseCfg&&state.defenseCfg.returnMarginSec)||120));const due=(arrival>1e12?arrival:arrival*1000)+margin*1000;state.dodgeReturns[id]={commandId:id,attackId:String(mov.id||''),from:String(from),dest:String(dest),attackArrival:arrival,dueAt:due||Date.now()+margin*1000,state:'waiting',createdAt:Date.now()};dodgeReturnSave()}
  function dodgeReturnTick(){if(!hostEnabled()||automationPaused({}))return;const now=Date.now();for(const[id,r]of Object.entries(state.dodgeReturns||{})){if(!r||r.state==='done'||r.state==='manual')continue;if(+r.dueAt>now)continue;const live=militaryOutgoingMovements().find(x=>String(x.commandId)===String(r.commandId));if(live&&state.cancelTpl){r.state='returning';dodgeReturnSave();militaryCancelCommand(r.commandId,{confirmed:true,automation:true},err=>{if(!err){r.state='done';r.doneAt=Date.now()}else if(err==='not-cancelable'){r.state='manual';r.why='support already arrived; withdraw manually'}else{r.state='waiting';r.lastError=String(err)}dodgeReturnSave()});}else{r.state='manual';r.why=live?'cancel template missing':'movement no longer cancelable/visible';dodgeReturnSave();gbLogT('dodge-return-'+id,60000,`dodge return ${id}: ${r.why}`)}}}

  const DODGE_CHECK_MS = 5000;
  const DODGE_FAIL_BACKOFF = [15000, 45000, 120000];
  const DODGE_QUEUE_TTL = 3600000;

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
    const wfLock = gbLock('wonder-favor');
    if (!wfLock) return;
    const payload = Object.assign({}, tpl, {
      arguments: Object.assign({}, tpl.arguments || {}, {
        wonder_id: +cfg.wonderId,
      }),
      town_id: tpl.town_id,
    });
    bridgePost('wonder', payload, (err) => {
      gbUnlock('wonder-favor', wfLock);
      if (!err) gbLog('wonder favor: cast OK (' + (reason || 'scan') + ')');
      else if (err !== 'captcha' && err !== 'captcha-pause' && err !== 'dryrun') {
        gbLogT('wonder-favor-err', 60000, 'wonder favor err ' + err);
      }
    });
  }
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
        militiaState: e.militiaState === 'sending' ? 'pending' : (e.militiaState || 'pending'), militiaNextAt:+e.militiaNextAt||0,
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
          militiaState:e.militiaState==='sending'?'pending':(e.militiaState||'pending'),militiaNextAt:+e.militiaNextAt||0,
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
  function dodgeIncomingMovements() {
    const uw = gameUw();
    const out = [];
    try {
      const col = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('MovementsUnits');
      if (!col || !col.models) return out;
      const myTowns = new Set(Object.keys((uw.ITowns && uw.ITowns.towns) || {}).map(String));
      col.models.forEach(m => {
        const a = m.attributes || {};
        const dest = String(a.destination_town_id || a.target_town_id || '');
        if (!myTowns.has(dest)) return;
        if (!dodgeIsHostileMovement(a)) return;

        const origin = String(a.origin_town_id || a.home_town_id || '');
        if (myTowns.has(origin) && a.is_attack !== true && a.is_attack !== 1) return;
        if (myTowns.has(origin) && !a.incoming) return;
        const type = String(a.command_name || a.type || a.movement_type || '').toLowerCase();
        const units = a.units || {};
        const hasCs = !!(units.colonize_ship || units.colony_ship || /^(revolt|colonize|take_over|conquer)$/.test(type));
        out.push({
          id: a.id || m.id,
          dest, origin, type, hasCs,
          arrival: a.arrived_at || a.arrival_at || a.finished_at,
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
      if (clean.length) {
        const src = townCoords(excludeId);
        clean.sort((a,b)=>{const A=townCoords(a),B=townCoords(b);const as=(src.island!=null&&A.island!=null&&String(src.island)===String(A.island))?0:1;const bs=(src.island!=null&&B.island!=null&&String(src.island)===String(B.island))?0:1;if(as!==bs)return as-bs;const da=islandDistance(src.x,src.y,A.x,A.y),db=islandDistance(src.x,src.y,B.x,B.y);return (da==null?1e9:da)-(db==null?1e9:db)});
        return clean[0];
      }
      if (ids.length) {
        gbLogT('dodge-nosafe', 120000, 'dodge: every other town has incoming — no safe destination, evacuation blocked');
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

      const avail = t && t.getAvailablePopulation && +t.getAvailablePopulation();
      if (avail != null && Number.isFinite(avail) && avail <= 0) return { ok: false, why: 'no free population' };
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
  function dodgeSupportValidate(fromTownId, safeTownId, units) {
    if (!safeTownId || !units || !Object.keys(units).length) return { ok: false, why: 'no-destination-or-units' };
    const live = dodgeTownUnits(fromTownId);
    for (const [u, n] of Object.entries(units)) if ((+live[u] || 0) < (+n || 0)) return { ok: false, why: `units-changed:${u}` };
    const same = isSameIsland(fromTownId, { town_id: +safeTownId, id: +safeTownId, kind: 'town', ...townCoords(safeTownId) });
    const boats = boatCapacityCheck(units, same);
    if (!boats.ok) return { ok: false, why: boats.reason || 'transport-capacity' };
    const destGod = recruitTownGod(safeTownId);
    for (const u of Object.keys(units)) {
      const d = unitMeta(u);
      if (!d) return { ok: false, why: `unit-meta:${u}` };
      if (d.god) {
        const need = String(d.god).toLowerCase();
        if (!destGod || destGod !== need) return { ok: false, why: `god-mismatch:${u}` };
      }
    }
    return { ok: true, boats };
  }
  function dodgeEtaSec(mov) {
    let a = +(mov && mov.arrival);
    if (!Number.isFinite(a) || a <= 0) return null;
    if (a > 1e12) a = Math.floor(a / 1000);
    return Math.max(0, a - gameNow());
  }
  const DODGE_MILITIA_WINDOW_SEC = 15 * 60;

  function dodgeNotify(mov, entry) {
    if (entry.notified) return;
    entry.notified = true;
    const msg = `incoming ${mov.type || 'atk'} → town ${mov.dest}` + (mov.hasCs ? ' [CS]' : '') +
      (mov.arrival ? ` ETA ${mov.arrival}` : '');
    gbLog('dodge: ' + msg);
    flash(msg);
    try {
      if (!mov.hasCs || state.csAlert !== false) alertWebhook('attack', Object.assign({}, mov, { cs: !!mov.hasCs }));
    } catch (_) {}

  }
  function dodgeTryMilitia(mov,entry) {
    if(!state.autoMilitia||captchaPausedAny('militia','dodge')||entry.militiaState==='raised'||entry.militiaState==='sending')return;
    const eta=dodgeEtaSec(mov),now=Date.now();if(eta==null||eta>DODGE_MILITIA_WINDOW_SEC||eta<=0){gbLogT('militia-eta-'+mov.dest,60000,`militia: waiting; hostile ETA ${eta==null?'unknown':fmtSec(eta)}`);return}
    if(entry.militiaNextAt&&entry.militiaNextAt>now)return;const can=dodgeCanRaiseMilitia(mov.dest);
    if(!can.ok){if(/already standing/.test(can.why||'')){entry.militiaState='raised';dodgeQueueSave()}else{entry.militiaState='pending';entry.militiaNextAt=now+30000}return}
    const token=gbLock('militia',30000);if(!token){entry.militiaNextAt=now+2000;return}entry.militiaState='sending';dodgeQueueSave();
    dodgeRaiseMilitia(mov.dest,err=>{gbUnlock('militia',token);if(!err){entry.militiaState='raised';entry.militiaNextAt=0;gbLog(`militia: raised in ${mov.dest} (ETA ${fmtSec(eta)})`)}else if(err==='timeout_unknown'||err==='pending'){entry.militiaState='unknown';entry.militiaNextAt=Date.now() + 5 * 60 * 1000;gbLog(`militia: outcome unknown (${err}); retry bounded to 5min — militia consumes population and re-firing without resolution is unsafe`)}else{entry.militiaState='pending';entry.militiaNextAt=Date.now()+30000;gbLogT('militia-retry-'+mov.dest,30000,`militia: retry scheduled (${err})`)}dodgeQueueSave()});
  }
  function dodgeTrySend(entry, mov) {
    if (entry.state === 'sent' || entry.state === 'sending') return;
    if (!state.autoDodge) { entry.state='notified'; return; }
    const incomingNow = dodgeIncomingMovements();
    const decision = defenseShouldDodge(mov, incomingNow);
    if (!decision.yes) { entry.state='notified'; whyNote('defense',mov.dest,'no-dodge',`${decision.why}; risk=${decision.assessment.risk}`); gbLogT('defense-decide-'+mov.id,60000,`defense: ${mov.dest} no dodge (${decision.why}, risk=${decision.assessment.risk})`); return; }
    if (captchaPaused('dodge')) return;
    if (gbLocked('dodge')) {
      entry.state = 'pending';
      entry.nextAt = Date.now() + 2000;
      return;
    }
    const safe = dodgeSafeTown(mov.dest);
    const units = dodgeTownUnits(mov.dest);
    const valid = dodgeSupportValidate(mov.dest, safe, units);
    if (!valid.ok) {
      entry.state = 'pending';
      entry.tries = (entry.tries || 0) + 1;
      const bo = DODGE_FAIL_BACKOFF[Math.min(entry.tries - 1, DODGE_FAIL_BACKOFF.length - 1)];
      entry.nextAt = Date.now() + bo;
      gbLogT('dodge-nousable', 30000, `dodge: cannot evacuate ${mov.dest} (${valid.why}); retry later`);
      return;
    }
    entry.state = 'sending';
    const lockToken = gbLock('dodge');
    if (!lockToken) { entry.state = 'pending'; entry.nextAt = Date.now() + 2000; return; }
    dodgeSendOut(mov.dest, units, safe, (err, data) => {
      gbUnlock('dodge', lockToken);
      if (!err) {
        entry.state = 'sent';
        entry.ts = Date.now();
        gbLog(`dodge: sent units from ${mov.dest} → ${safe}`);
        try { dodgeReturnRecord(mov, mov.dest, safe, data); } catch (_) {}
      } else {
        entry.tries = (entry.tries || 0) + 1;
        if (err === 'timeout_unknown' || err === 'pending') {
          entry.state = 'unknown';
          entry.nextAt = Date.now() + TX_UNKNOWN_RECHECK_MS;
          gbLog(`dodge: outcome unknown (${err}); bounded recheck in ${Math.round(TX_UNKNOWN_RECHECK_MS/1000)}s — units may have already left`);
        } else {
          entry.state = 'failed';
          const bo = DODGE_FAIL_BACKOFF[Math.min(entry.tries - 1, DODGE_FAIL_BACKOFF.length - 1)];
          entry.nextAt = Date.now() + bo;
          gbLog(`dodge: send failed ${err} (retry in ${Math.round(bo / 1000)}s)`);
        }
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
          militiaState:'pending',militiaNextAt:0,
          dest: mov.dest, type: mov.type, hasCs: mov.hasCs,
        };
      }
      entry.hasCs=!!(entry.hasCs||mov.hasCs);entry.type=mov.type||entry.type;entry.dest=mov.dest||entry.dest;
      if (wantCs || militiaOk || dodgeOk) dodgeNotify(mov, entry);
      if(militiaOk)dodgeTryMilitia(mov,entry);
      if (!dodgeOk) continue;
      if (entry.state === 'sent') continue;
      if (entry.state === 'sending') continue;
      if (entry.nextAt && entry.nextAt > now) continue;
      if (entry.state === 'failed' || entry.state === 'pending' || entry.state === 'notified' || entry.state === 'unknown') {
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

  function recruitSpellCooldown(townId, powerId) {
    const map = state.spellCooldown || (state.spellCooldown = {});
    const t = map[String(townId)] || (map[String(townId)] = {});
    const until = +t[powerId] || 0;
    return until > Date.now() ? until - Date.now() : 0;
  }
  function recruitSpellCooldownStamp(townId, powerId, ms) {
    if (!state.spellCooldown) state.spellCooldown = {};
    const t = state.spellCooldown[String(townId)] || (state.spellCooldown[String(townId)] = {});
    t[powerId] = Date.now() + (ms || 30 * 60 * 1000);
    try { save(STORE.SPELL_COOLDOWN, state.spellCooldown); } catch (_) {}
  }
  function recruitSpellGateOk(townId, powerId) {
    if (!powerId || !RECRUIT_SPELLS.includes(powerId)) return { ok: false, why: 'bad-power' };
    const academy = gbBuildingLevel(townId, 'academy');
    if (academy != null && academy < 1) return { ok: false, why: 'no-academy' };

    const god = recruitScanGodCache ? recruitScanGod(townId) : recruitTownGod(townId);
    if (god == null) return { ok: true, blind: true, why: null };
    return { ok: true, blind: false, why: null };
  }
  function recruitCastSpell(townId, powerId, onDone) {
    if (!powerId || !RECRUIT_SPELLS.includes(powerId)) return onDone && onDone('bad-power');
    const pre = recruitSpellGateOk(townId, powerId);
    if (!pre.ok) { gbLogT('spell-precond-' + townId, 300000, `spell: blocked precheck (${pre.why})`); return onDone && onDone('skip:' + pre.why); }
    if (pre.blind) gbLogT('spell-precond-blind-' + townId, 300000, 'spell: god unreadable; blind precheck, server is the authority');
    const left = recruitSpellCooldown(townId, powerId);
    if (left > 0) { gbLogT('spell-cooldown-' + townId, 60000, `spell: cooldown ${Math.ceil(left/1000)}s left`); return onDone && onDone('skip:cooldown'); }
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
  function recruitRequiredBuildings(def) {
    const out = {};
    const absorb = (x) => {
      if (!x) return;
      if (Array.isArray(x)) {
        x.forEach(v => {
          if (!v || typeof v !== 'object') return;
          const id = v.building_id || v.building || v.id || v.type;
          const lvl = +(v.level ?? v.min_level ?? v.value);
          if (id && Number.isFinite(lvl)) out[id] = Math.max(out[id] || 0, lvl);
        });
      } else if (typeof x === 'object') {
        Object.entries(x).forEach(([id, raw]) => {
          const lvl = +(raw && typeof raw === 'object' ? (raw.level ?? raw.min_level ?? raw.value) : raw);
          if (Number.isFinite(lvl)) out[id] = Math.max(out[id] || 0, lvl);
        });
      }
    };
    absorb(def.building_dependencies); absorb(def.required_buildings); absorb(def.requirements && def.requirements.buildings);
    if (def.required_building) {
      const id = typeof def.required_building === 'string' ? def.required_building : (def.required_building.id || def.required_building.building_id);
      const lvl = typeof def.required_building === 'object' ? +(def.required_building.level ?? def.required_building.min_level ?? 1) : 1;
      if (id) out[id] = Math.max(out[id] || 0, Number.isFinite(lvl) ? lvl : 1);
    }
    return out;
  }
  function recruitTownGod(townId) {
    try {
      const t = gbTownModel(townId);
      if (!t) return null;
      if (typeof t.getGod === 'function') { const g = t.getGod(); if (g) return String(g).toLowerCase(); }
      const a = t.attributes || {};
      const g = a.god || a.god_id || a.deity;
      return g ? String(g).toLowerCase() : null;
    } catch (_) { return null; }
  }
  function recruitResearchDeps(def) {
    const need = def.research_required || def.research_dependencies || def.required_researches;
    if (!need) return [];
    if (Array.isArray(need)) return need.map(x => typeof x === 'string' ? x : (x && (x.id || x.research_id || x.research_type))).filter(Boolean);
    if (typeof need === 'string') return [need];
    if (typeof need === 'object') return Object.keys(need).filter(k => need[k]);
    return [];
  }
  function recruitCanBuild(townId, unitId) {
    const def = recruitUnitDef(unitId);
    if (!def) return false;
    try {
      const t = gbTownModel(townId);
      if (!t) return false;
      const rdeps = recruitResearchDeps(def);
      if (rdeps.length) {
        const info = typeof researchTownTechs === 'function' ? researchTownTechs(townId) : null;
        if (!info || !info.techs) return false;
        for (const tech of rdeps) if (!info.techs[tech]) return false;
      }
      let buildings = null;
      try { const b = t.getBuildings ? t.getBuildings() : (t.buildings && t.buildings()); buildings = b && (b.attributes || b); } catch (_) {}
      if (!buildings) return false;
      const bdeps = recruitRequiredBuildings(def);
      for (const [bid, lvl] of Object.entries(bdeps)) if (+(buildings[bid] || 0) < +lvl) return false;
      if (def.is_naval || def.naval) {
        const docksNeed = +(def.docks_level ?? def.harbor_level ?? def.required_docks_level ?? 1);
        if (+(buildings.docks || 0) < (Number.isFinite(docksNeed) ? docksNeed : 1)) return false;
      } else {
        const barracksNeed = +(def.barracks_level ?? def.required_barracks_level ?? 1);
        if (+(buildings.barracks || 0) < (Number.isFinite(barracksNeed) ? barracksNeed : 1)) return false;
      }
      if (def.god || def.mythical || def.is_mythical) {
        const requiredGod = def.god ? String(def.god).toLowerCase() : null;
        const townGod = recruitTownGod(townId);
        if (requiredGod && (!townGod || townGod !== requiredGod)) return false;
        const templeNeed = +(def.temple_level ?? def.required_temple_level ?? 1);
        if (+(buildings.temple || 0) < (Number.isFinite(templeNeed) ? templeNeed : 1)) return false;
        const favorCost = +(def.favor ?? (def.resources && def.resources.favor) ?? 0);
        if (favorCost > 0) {
          if (!requiredGod) return false;
          const fav = favorCurrent();
          const haveFavor = +(fav[requiredGod] ?? fav['favor_' + requiredGod]);
          if (!Number.isFinite(haveFavor) || haveFavor < favorCost) return false;
        }
      }
      return true;
    } catch (_) { return false; }
  }
  function recruitQueueInfo(townId,unitId) {
    const t = gbTownModel(townId);
    if (!t) return { known: false, len: 0, max: null, models: [] };
    let col = null, models = [];
    try { col = t.getUnitOrdersCollection && t.getUnitOrdersCollection();if(!col||!Array.isArray(col.models))return {known:false,len:0,max:null,models:[]};models=col.models.slice(); } catch (_) {return {known:false,len:0,max:null,models:[]}}
    if(unitId){const want=recruitUnitDef(unitId),wantNaval=!!(want&&(want.is_naval||want.naval));models=models.filter(m=>{const a=m.attributes||m,id=a.unit_type||a.unit_id||a.type,d=recruitUnitDef(id);return !d||!!(d.is_naval||d.naval)===wantNaval})}
    let max = null;
    try { if (col && typeof col.getMaxQueueLength === 'function') max = +col.getMaxQueueLength(); } catch (_) {}
    try { if (!(max > 0) && col && col.max_queue_length != null) max = +col.max_queue_length; } catch (_) {}
    try {
      const uw = gameUw();
      const q = uw.GameDataUnitQueue || uw.GameDataUnits;
      if (!(max > 0) && q && typeof q.getQueueMax === 'function') max = +q.getQueueMax(townId);
    } catch (_) {}
    return { known: true, len: models.length, max: max > 0 ? max : null, models };
  }
  function recruitQueuedAmount(townId, unit) {
    const q = recruitQueueInfo(townId);
    let queued = 0;
    for (const m of q.models || []) {
      const a = m.attributes || {};
      const uid = a.unit_type || a.unit_id || a.type;
      if (String(uid) === String(unit)) queued += +(a.count != null ? a.count : (a.amount != null ? a.amount : a.units)) || 0;
    }
    return queued;
  }
  function recruitQueueHasSpace(townId,unitId) {
    const q = recruitQueueInfo(townId,unitId);
    if (!q.known) return false;
    if (q.max != null) return q.len < q.max;

    return q.len === 0;
  }
  function recruitAffordableAmount(townId, unit, want) {
    const def = recruitUnitDef(unit), t = gbTownModel(townId);
    if (!def || !t || !def.resources) return 0;
    try {
      const r = t.resources && t.resources();
      const pop = t.getAvailablePopulation && +t.getAvailablePopulation();
      if (!r || pop == null) return 0;
      const rw = +def.resources.wood || 0, rs = +def.resources.stone || 0, ri = +def.resources.iron || 0, rp = +def.population || 0;
      let amount = Math.max(0, +want || 0);
      if (rw > 0) amount = Math.min(amount, Math.floor(+r.wood / rw));
      if (rs > 0) amount = Math.min(amount, Math.floor(+r.stone / rs));
      if (ri > 0) amount = Math.min(amount, Math.floor(+r.iron / ri));
      if (rp > 0) amount = Math.min(amount, Math.floor(pop / rp));
      const favorCost = +(def.favor ?? def.resources.favor ?? 0);
      if (favorCost > 0) {
        const god = def.god && String(def.god).toLowerCase();
        const fav = favorCurrent();
        const have = god ? +(fav[god] ?? fav['favor_' + god]) : NaN;
        if (!Number.isFinite(have)) return 0;
        amount = Math.min(amount, Math.floor(have / favorCost));
      }
      return Math.max(0, Math.floor(amount));
    } catch (_) { return 0; }
  }
  function recruitValidateJob(job) {
    if (!recruitCanBuild(job.townId, job.unit)) return { ok: false, why: 'requirements' };
    if (!recruitQueueHasSpace(job.townId,job.unit)) return { ok: false, why: 'queue' };
    const amount = recruitAffordableAmount(job.townId, job.unit, job.amount);
    if (!(amount > 0)) return { ok: false, why: 'resources/pop/favor' };
    return { ok: true, amount: Math.min(amount, job.amount) };
  }

  let recruitNativeCursor=0,recruitLegacyCursor=0;
  function recruitRotate(ids,cursor){if(!ids.length)return ids;const at=Math.max(0,cursor%ids.length);return ids.slice(at).concat(ids.slice(0,at))}

  let recruitScanGodCache = null;
  function recruitScanResetMemo() {
    recruitScanGodCache = new Map();
  }
  function recruitScanGod(tid) {
    if (!recruitScanGodCache) recruitScanResetMemo();
    if (recruitScanGodCache.has(tid)) return recruitScanGodCache.get(tid);
    const g = recruitTownGod(tid);
    recruitScanGodCache.set(tid, g);
    return g;
  }
  function recruitScan(reason) {
    const nativePending = nativeQueueHasPending('recruit');
    if (!hostEnabled() || (!state.autoRecruit && !nativePending) || captchaPaused('recruit')) return;
    if (automationPaused({})) return;
    if (gbLocked('recruit')) return;
    recruitScanResetMemo();
    const targets = goalEffectiveRecruitTargets();
    const explicitIds=Object.keys(nativeQueueRoot().towns).filter(id=>nativeQueueIsFifo(id,'recruit')&&nativeQueueList(id,'recruit',false).length);
    const legacyIds=Object.keys(targets).filter(id=>!nativeQueueIsFifo(id,'recruit'));
    const townIds=recruitRotate(explicitIds,recruitNativeCursor++).concat(recruitRotate(legacyIds,recruitLegacyCursor++));
    if (!townIds.length) {
      gbLogT('recruit-empty', 300000, 'recruit: no town targets configured');
      return;
    }
    const uw = gameUw();
    let job = null;
    for (const tid of townIds) {
      if (nativeQueueIsFifo(tid, 'recruit')) {
        const explicit = nativeQueueRecruitHead(tid);
        if (!explicit) continue;
        if (!recruitQueueHasSpace(tid,explicit.unit)) { nativeQueueSetJobState(explicit, 'waiting-slot', 'cola real llena'); continue; }
        if (!recruitCanBuild(tid, explicit.unit) || !recruitControllerFor(explicit.unit)) {
          nativeQueueSetJobState(explicit, 'blocked', 'requisitos/controlador'); continue;
        }
        const affordable = recruitAffordableAmount(tid, explicit.unit, explicit.amount);
        if (affordable < +explicit.amount) { nativeQueueSetJobState(explicit, 'waiting-resources', 'recursos/población/favor'); continue; }
        nativeQueueSetJobState(explicit, 'ready', 'listo');
        job = { kind:'build', townId:tid, unit:explicit.unit, amount:+explicit.amount, nativeJobId:explicit.id };
        break;
      }
      const want = targets[tid];
      if (!want || typeof want !== 'object') continue;
      let t = null;
      try { t = uw.ITowns.towns[tid]; } catch (_) {}
      if (!t) continue;
      const have = goalUnitCounts(tid);
      for (const unit of Object.keys(want)) {
        const tgt = +want[unit] || 0;
        if (!(tgt > 0)) continue;
        if (!recruitCanBuild(tid, unit)) continue;
        if (!recruitControllerFor(unit)) continue;
        if (!recruitQueueHasSpace(tid,unit)) continue;
        const cur = +have[unit] || 0;
        const queued = recruitQueuedAmount(tid, unit);
        const need = tgt - cur - queued;
        if (need <= 0) continue;
        let amount = recruitAffordableAmount(tid, unit, need);
        if (!(amount > 0)) continue;

        if (state.recruitSpells && !state.safeMode) {
          const wantPower = (state.favorCfg && state.favorCfg.recruitPower) || null;
          if (wantPower && RECRUIT_SPELLS.includes(wantPower) && !recruitHasSpell(tid, wantPower)
              && !captchaPausedAny('recruit', 'spell') && recruitSpellGateOk(tid, wantPower).ok
              && !recruitSpellCooldown(tid, wantPower)) {
            job = { kind:'spell', townId:tid, power:wantPower };
            break;
          }
        }
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
    const lockToken = gbLock('recruit');
    if (!lockToken) return;
    if (job.kind === 'spell') {
      recruitCastSpell(job.townId, job.power, (err) => {
        gbUnlock('recruit', lockToken);
        if (!err) gbLog(`spell: ${job.power} on ${job.townId}`);
        else if (err === 'timeout_unknown' || err === 'pending') {
          recruitSpellCooldownStamp(job.townId, job.power);
          gbLog(`spell: outcome unknown (${err}); cooldown 30min — favor is irreversible, manual review required`);
        } else gbLogT('spell-err', 60000, `spell err ${err}`);
      });
      return;
    }
    const valid = recruitValidateJob(job);
    if (!valid.ok) { gbUnlock('recruit', lockToken); gbLogT('recruit-stale-' + job.townId, 60000, `recruit: final precheck blocked (${valid.why})`); return; }
    if (job.nativeJobId && valid.amount < job.amount) {
      const head = nativeQueueList(job.townId, 'recruit', false)[0];
      nativeQueueSetJobState(head, 'waiting-resources', 'cantidad completa no asequible');
      gbUnlock('recruit', lockToken); return;
    }
    job.amount = valid.amount;
    if (job.nativeJobId) {
      const head = nativeQueueList(job.townId, 'recruit', false)[0];
      if (!head || head.id !== job.nativeJobId) { gbUnlock('recruit', lockToken); return; }
      head.manualReview=false;
      head.inflight = { amount:job.amount, at:Date.now() };
      nativeQueueSave();
    }
    recruitBuild(job.townId, job.unit, job.amount, (err) => {
      gbUnlock('recruit', lockToken);
      if (!err) {
        gbLog(`recruit: town ${job.townId} ${job.amount}× ${job.unit}`);
        if (job.nativeJobId) nativeQueueRecruitApplied(job.townId, job.nativeJobId, job.amount);
      } else {
        if (job.nativeJobId) {
          const head = nativeQueueList(job.townId, 'recruit', false)[0];
          if (head && head.id === job.nativeJobId) {
            head.inflight = null;
            const ambiguous=err === 'pending' || err === 'timeout_unknown';head.manualReview=ambiguous;
            nativeQueueSetJobState(head, ambiguous ? 'unknown' : 'blocked', ambiguous?'resultado desconocido; comprobar la cola real':String(err));
          }
        }
        gbLogT('recruit-err', 60000, `recruit err ${err}`);
      }
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
    flash('plantilla guardada: ' + name);
  }
  function qolApplyTemplate(name) {
    const t = state.cityTemplates && state.cityTemplates[name];
    if (!t) { flash('falta plantilla'); return; }

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
    flash('plantilla aplicada: ' + name);
    try { renderAbQueue && renderAbQueue(); } catch (_) {}
  }

  function renderGoals() {
    const sec=panel&&panel.querySelector('section[data-tab=overview]');if(!sec||sec.hidden)return;const box=sec.querySelector('.goals-panel');if(!box)return;box.replaceChildren();
    let ids=[];try{ids=Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{})}catch(_){};const profiles=goalProfiles();
    const rerender=()=>{renderGoals();renderPlanner();renderDashboard();};
    for(const tid of ids){let name=tid;try{const t=gbTownModel(tid);name=(t&&t.getName&&t.getName())||name}catch(_){} const plan=goalPlanTown(tid);
      const head=document.createElement('div');head.style.cssText='display:flex;gap:4px;align-items:center;padding:4px;border-bottom:1px solid #333';const b=document.createElement('b');b.textContent=`${name} · ${plan.progress}%`;head.appendChild(b);
      const edit=document.createElement('button');edit.textContent='Edit';edit.title='Edit per-town goal overrides/reserves as JSON';edit.style.cssText='font-size:8px;padding:1px 4px';edit.addEventListener('click',()=>{const cur=goalTownCfg(tid),raw=prompt('Overrides de objetivos por ciudad JSON\nClaves: build, research, units, reserve:{hard,soft}',JSON.stringify({build:cur.build,research:cur.research,units:cur.units,reserve:cur.reserve},null,2));if(raw==null)return;try{if(!goalSetTownOverrides(tid,JSON.parse(raw)))throw new Error('invalid object');rerender()}catch(e){flash('JSON de objetivos invalido')}});head.appendChild(edit);
      const rec=document.createElement('button');rec.textContent='Recalc';rec.style.cssText='font-size:8px;padding:1px 4px';rec.addEventListener('click',()=>{goalPlanTown(tid);rerender()});head.appendChild(rec);
      const reset=document.createElement('button');reset.textContent='Reset Q';reset.title='Clear virtual-queue order/block/mandatory overrides';reset.style.cssText='font-size:8px;padding:1px 4px';reset.addEventListener('click',()=>{goalQueueReset(tid);rerender()});head.appendChild(reset);
      const sel=document.createElement('select');sel.style.cssText='background:#111;color:#cfc;border:1px solid #333;font-size:9px;margin-left:auto';for(const [id,p] of Object.entries(profiles)){const o=document.createElement('option');o.value=id;o.textContent=p.label||id;sel.appendChild(o)}sel.value=plan.profile;sel.addEventListener('change',()=>{goalSetProfile(tid,sel.value);rerender()});head.appendChild(sel);box.appendChild(head);
      const lines=(plan.actions||[]).slice(0,12);if(!lines.length){const e=document.createElement('div');e.textContent='  objetivo cumplido / sin acciones';e.style.cssText='padding:2px 6px;color:#777';box.appendChild(e)}else for(const a of lines){const row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:1fr auto;gap:3px;padding:2px 4px;border-bottom:1px solid #1e1e1e;align-items:center';const text=document.createElement('span');const c=a.cost||{},cost=[c.wood||0,c.stone||0,c.iron||0].join('/');text.textContent=`${a.mandatory?'! ':''}${a.kind} ${a.id}${a.level?' → '+a.level:''}${a.amount?' ×'+a.amount:''} · ${a.status} · ${cost}${a.why?' · '+a.why:''}`;row.appendChild(text);const acts=document.createElement('span');acts.style.cssText='display:flex;gap:2px';const mk=(label,title,fn)=>{const x=document.createElement('button');x.textContent=label;x.title=title;x.style.cssText='font-size:8px;padding:0 3px';x.addEventListener('click',()=>{fn();rerender()});acts.appendChild(x)};mk('↑','move earlier',()=>goalQueueMove(tid,a.queueKey,-1));mk('↓','move later',()=>goalQueueMove(tid,a.queueKey,1));mk(a.status==='user-blocked'?'ON':'B','block/unblock',()=>goalQueueToggleBlock(tid,a.queueKey));mk(a.mandatory?'*':'!','mandatory priority',()=>goalQueueToggleMandatory(tid,a.queueKey));mk('×','suppress until Reset Q',()=>goalQueueHide(tid,a.queueKey));row.appendChild(acts);box.appendChild(row)}
    }
  }

  function plannerFmt(n) { return n == null || !Number.isFinite(+n) ? '?' : Math.floor(+n).toLocaleString(); }
  function renderPlanner() {
    const sec = panel && panel.querySelector('section[data-tab=overview]');
    if (!sec || sec.hidden) return;
    const controls = sec.querySelector('.planner-controls'), box = sec.querySelector('.planner-panel');
    if (!controls || !box) return;
    const cfg=plannerCfgRoot(), g=cfg.global;
    if (!controls.dataset.bound) {
      controls.dataset.bound='1'; controls.replaceChildren();
      for (const mode of ['hard','soft']) for (const k of PLANNER_KEYS) {
        const lab=document.createElement('label'); lab.textContent=`${mode[0].toUpperCase()} ${k.slice(0,3)} `;
        const inp=document.createElement('input'); inp.type='number'; inp.min='0'; inp.style.cssText='width:55px;background:#111;color:#cfc;border:1px solid #333;font-size:9px';
        inp.dataset.mode=mode; inp.dataset.key=k; inp.value=g[mode][k]||0;
        inp.addEventListener('change',()=>{ g[mode][k]=Math.max(0,+inp.value||0); plannerSaveCfg(); renderPlanner(); });
        lab.appendChild(inp); controls.appendChild(lab);
      }
    }
    box.replaceChildren();
    const hdr=document.createElement('div'); hdr.style.cssText='display:grid;grid-template-columns:1.3fr repeat(3,.8fr) .7fr .7fr;gap:3px;padding:3px;color:#888;border-bottom:1px solid #333';
    hdr.textContent=''; ['town','real W/S/I','reserved W/S/I','available W/S/I','pop','merchants'].forEach(x=>{const s=document.createElement('span');s.textContent=x;hdr.appendChild(s)}); box.appendChild(hdr);
    const ids=[]; try{ Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{}).forEach(x=>ids.push(x)); }catch(_){}
    for(const tid of ids){ const s=plannerSnapshot(tid); if(!s) continue; let name=tid; try{const t=gbTownModel(tid); name=(t&&t.getName&&t.getName())||name}catch(_){}
      const row=document.createElement('div'); row.style.cssText='display:grid;grid-template-columns:1.3fr repeat(3,.8fr) .7fr .7fr;gap:3px;padding:3px;border-bottom:1px solid #222';
      const vals=[name,`${plannerFmt(s.live.wood)}/${plannerFmt(s.live.stone)}/${plannerFmt(s.live.iron)}`,`${plannerFmt(s.committed.wood)}/${plannerFmt(s.committed.stone)}/${plannerFmt(s.committed.iron)}`,`${plannerFmt(s.availableSoft.wood)}/${plannerFmt(s.availableSoft.stone)}/${plannerFmt(s.availableSoft.iron)}`,`${plannerFmt(s.availableSoft.population)}`,`${plannerFmt(s.availableSoft.tradeCap)}`];
      vals.forEach(v=>{const e=document.createElement('span');e.textContent=v;row.appendChild(e)}); row.title=`hard reserve ${JSON.stringify(s.reserve.hard)} | soft ${JSON.stringify(s.reserve.soft)} | incoming ${JSON.stringify(s.incoming)}`; box.appendChild(row);
    }
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

  function renderHealth() {
    const sec=panel&&panel.querySelector('section[data-tab=overview]');if(!sec||sec.hidden)return;const box=sec.querySelector('.health-panel');if(!box)return;box.replaceChildren();
    const names=new Set([...Object.keys(moduleHealth||{}),...Object.keys(state.circuits||{})]);
    if(!names.size){box.textContent='(no module activity yet)';return}
    const hdr=document.createElement('div');hdr.style.cssText='display:grid;grid-template-columns:1fr repeat(5,.7fr);gap:3px;color:#888;border-bottom:1px solid #333;padding:2px';['module','ok/err','timeout','lat ms','last','circuit'].forEach(v=>{const x=document.createElement('span');x.textContent=v;hdr.appendChild(x)});box.appendChild(hdr);
    [...names].sort().forEach(name=>{const h=moduleHealth[name]||{},c=state.circuits&&state.circuits[name];const row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:1fr repeat(5,.7fr);gap:3px;border-bottom:1px solid #222;padding:2px';const age=h.last?fmtSec((Date.now()-h.last)/1000):'-';const vals=[name,`${h.ok||0}/${h.err||0}`,String(h.timeout||0),h.avgLatency==null?'-':String(Math.round(h.avgLatency)),age,c&&c.open?'OPEN':(c&&c.strikes?`strike ${c.strikes}`:'ok')];vals.forEach(v=>{const x=document.createElement('span');x.textContent=v;row.appendChild(x)});box.appendChild(row)})
  }

  function simulateTown(townId,horizonHours){const h=Math.max(1,+horizonHours||24),snap=plannerSnapshot(townId),forecast=economyForecast(townId,h*3600),plan=goalPlanTown(townId);if(!snap)return{townId:String(townId),error:'state-unreadable',actions:[]};const stock={wood:snap.availableSoft.wood,stone:snap.availableSoft.stone,iron:snap.availableSoft.iron,population:snap.availableSoft.population};if(forecast&&forecast.production){for(const k of ['wood','stone','iron'])stock[k]+=forecast.production[k]*h}const actions=[];let bottleneck='';for(const a of(plan.actions||[])){if(a.kind==='build'&&a.costExact===false){const why='future build cost requires live recalculation after previous level';actions.push({...a,sim:'waiting',simWhy:why});if(!bottleneck)bottleneck=why;break}const c=plannerNormCost(a.cost);if(!c){actions.push({...a,sim:'blocked:cost'});continue}let ok=true,why='';for(const k of PLANNER_KEYS){if((+c[k]||0)>+(stock[k]||0)){ok=false;why=`${k} ${Math.floor(stock[k]||0)}/${Math.ceil(c[k]||0)}`;break}}if(!ok){actions.push({...a,sim:'waiting',simWhy:why});if(!bottleneck)bottleneck=why;break}for(const k of PLANNER_KEYS)stock[k]-=+c[k]||0;actions.push({...a,sim:'would-run'})}return{townId:String(townId),horizonHours:h,actions,final:stock,bottleneck,productionKnown:!!(forecast&&forecast.productionKnown)}}
  function simulateAccount(horizonHours){let ids=[];try{ids=Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{})}catch(_){};const towns=ids.map(id=>simulateTown(id,horizonHours));return{at:Date.now(),horizonHours:+horizonHours||24,towns,totalActions:towns.reduce((n,t)=>n+t.actions.filter(a=>a.sim==='would-run').length,0),blocked:towns.filter(t=>t.bottleneck).length}}
  let dashboardSimulation=null;
  function renderDashboard() {
    const sec=panel&&panel.querySelector('section[data-tab=overview]');
    if(!sec||sec.hidden)return;
    const sum=sec.querySelector('.dashboard-summary'),time=sec.querySelector('.timeline-panel'),sim=sec.querySelector('.sim-panel'),cards=sec.querySelector('.gb-dashboard-cards');
    if(!sum||!time||!sim)return;
    let ids=[];try{ids=Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{})}catch(_){}
    const threats=dodgeIncomingMovements();
    const unknown=Object.values(state.txState||{}).filter(t=>t&&/^(unknown|manual-review)$/.test(t.state||'')).length;
    const circuits=Object.keys(state.circuits||{}).filter(k=>state.circuits[k]&&state.circuits[k].open);
    const fps=clientFingerprintNow();
    const compatible=Object.values(fps.required).every(Boolean);
    const activeGoals=ids.filter(id=>(goalPlanTown(id).actions||[]).length).length;
    const avgProgress=ids.length?Math.round(ids.reduce((n,id)=>n+goalProgress(id),0)/ids.length):100;
    const pauseInfo={}; const paused=automationPaused(pauseInfo);
    sum.textContent=`towns ${ids.length} · progress ${avgProgress}% · ${activeGoals} objetivo(s) activos · ${unknown} transacción(es) pendientes de revisar · ${circuits.length} circuit breaker abierto(s)`;
    if(cards){
      cards.replaceChildren();
      const data=[
        ['Ciudades',ids.length,activeGoals?`${activeGoals} con trabajo pendiente`:'sin objetivos pendientes'],
        ['Progreso',`${avgProgress}%`,avgProgress>=100?'objetivos completados':'media de objetivos'],
        ['Amenazas',threats.length,threats.length?'requieren revisión':'sin entradas hostiles detectadas'],
        ['Sistema',compatible&&!unknown&&!circuits.length?'OK':'Revisar',paused?`pausado: ${pauseInfo.reason}`:(state.safeMode?'SAFE MODE':'automatización disponible')],
      ];
      for(const [k,v,sub] of data){const c=document.createElement('div');c.className='gb-card';const a=document.createElement('div');a.className='k';a.textContent=k;const b=document.createElement('div');b.className='v';b.textContent=String(v);const d=document.createElement('div');d.className='s';d.textContent=sub;c.append(a,b,d);cards.appendChild(c)}
    }
    const mode=panel.querySelector('#gb-head-mode');if(mode){mode.textContent=state.safeMode?'SAFE':'NORMAL';mode.className='gb-pill '+(state.safeMode?'warn':'ok')}
    const health=panel.querySelector('#gb-head-health');if(health){const bad=!compatible||unknown||circuits.length;health.textContent=bad?'REVISAR':'SISTEMA OK';health.className='gb-pill '+(bad?'bad':'ok')}
    const quickSafe=sec.querySelector('#gb-quick-safe');if(quickSafe)quickSafe.textContent=state.safeMode?'SAFE MODE: ON':'SAFE MODE: OFF';
    const rows=[];
    for(const id of ids){let name=id;try{name=gbTownModel(id).getName()||id}catch(_){}const p=goalPlanTown(id),f=economyForecast(id);const a=(p.actions||[])[0];if(a)rows.push(`${name}: ${a.kind} ${a.id}${a.level?' → '+a.level:''} · ${a.status}${a.why?' · '+a.why:''}`);if(f&&Object.values(f.overflow).some(Boolean))rows.push(`${name}: AVISO · almacén previsto al límite en ${Object.entries(f.overflow).filter(([,v])=>v).map(([k])=>k).join(', ')}`)}
    time.textContent=rows.slice(0,30).join('\n')||'No hay acciones planificadas.';
    if(dashboardSimulation){const lines=[`Simulación ${dashboardSimulation.horizonHours} h · ${dashboardSimulation.totalActions} acciones · ${dashboardSimulation.blocked} ciudad(es) con cuello de botella`];for(const t of dashboardSimulation.towns)lines.push(`Ciudad ${t.townId}: ${t.actions.filter(a=>a.sim==='would-run').length} acciones · final ${Math.floor(t.final.wood)}/${Math.floor(t.final.stone)}/${Math.floor(t.final.iron)} · ${t.bottleneck||'sin bloqueo'}${t.productionKnown?'':' · producción desconocida'}`);sim.textContent=lines.join('\n')}else sim.textContent='Todavía no se ha ejecutado una simulación.';
    const why=sec.querySelector('.why-panel');if(why)why.textContent=(state.whyLog||[]).slice(0,12).map(x=>`${new Date(x.ts).toLocaleTimeString()} · ${x.feature} · ${x.status}${x.why?' · '+x.why:''}`).join('\n')||'Todavía no hay decisiones registradas.';
    renderHealth();
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
        return 'Health: ' + (parts.length ? parts.join(' · ') : '(none yet)');
      })(),
    ];
    box.textContent = lines.join('\n');
    if (sec && !sec.dataset.uxBound) {
      sec.dataset.uxBound = '1';
      sec.querySelector('#gb-quick-safe')?.addEventListener('click', () => { state.safeMode = !state.safeMode; save(STORE.SAFE_MODE, state.safeMode); renderOverview(); flash(state.safeMode ? 'SAFE MODE activado' : 'SAFE MODE desactivado'); });
      sec.querySelector('#gb-quick-preflight')?.addEventListener('click', () => { preflightRunAndRender(); showTab('stats'); });
      sec.querySelector('#gb-quick-sim')?.addEventListener('click', () => { dashboardSimulation = simulateAccount(24); const h=sec.querySelector('#gb-sim-hours'); if(h)h.value='24'; renderDashboard(); });
      sec.querySelector('#gb-quick-config')?.addEventListener('click', () => showTab('config'));
    }
    try { renderGoals(); renderPlanner(); renderDashboard(); } catch (_) {}
  }
  const CONFIG_EXPORT_SCHEMA = 3;

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
    return { schema:CONFIG_EXPORT_SCHEMA, ver:state.configVer||1, host:location.host,
      abTargets:state.abTargets,abOrder:state.abOrder,researchTargets:state.researchTargets,recruitTargets:state.recruitTargets,
      plannerCfg:state.plannerCfg,goalProfiles:state.goalProfiles,townGoals:state.townGoals,virtualQueueOverrides:state.virtualQueueOverrides,nativeQueue:state.nativeQueue,predictCfg:state.predictCfg,defenseCfg:state.defenseCfg,safeMode:!!state.safeMode,
      cityTemplates:state.cityTemplates,townGroups:state.townGroups,cultureTypes:state.cultureTypes,favorCfg:state.favorCfg,wonderCfg:state.wonderCfg,merchantWish:state.merchantWish,priorityOrder:state.priorityOrder,playerNotes:state.playerNotes,watchlist:state.watchlist };
  }
  function qolImportConfig(obj) {
    if(!obj||typeof obj!=='object'||Array.isArray(obj))return false;if(obj.host&&String(obj.host)!==String(location.host)){gbLog(`config import refused: file host ${obj.host} != ${location.host}`);return false}if(obj.schema!=null&&+obj.schema>CONFIG_EXPORT_SCHEMA){gbLog(`config import refused: schema ${obj.schema} newer than supported ${CONFIG_EXPORT_SCHEMA}`);return false}
    const clone=v=>JSON.parse(JSON.stringify(v)),isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);const validators={abTargets:isObj,abOrder:Array.isArray,researchTargets:isObj,recruitTargets:isObj,plannerCfg:isObj,goalProfiles:isObj,townGoals:isObj,virtualQueueOverrides:isObj,nativeQueue:isObj,predictCfg:isObj,defenseCfg:isObj,safeMode:v=>typeof v==='boolean',cityTemplates:isObj,townGroups:isObj,cultureTypes:isObj,favorCfg:isObj,wonderCfg:isObj,merchantWish:Array.isArray,priorityOrder:Array.isArray,playerNotes:isObj,watchlist:Array.isArray};const storeFor={abTargets:STORE.AB_TARGETS,abOrder:STORE.AB_ORDER,researchTargets:STORE.RESEARCH_TARGETS,recruitTargets:STORE.RECRUIT_TARGETS,plannerCfg:STORE.PLANNER_CFG,goalProfiles:STORE.GOAL_PROFILES,townGoals:STORE.TOWN_GOALS,virtualQueueOverrides:STORE.VIRTUAL_QUEUE_OVERRIDES,nativeQueue:STORE.NATIVE_QUEUE,predictCfg:STORE.PREDICT_CFG,defenseCfg:STORE.DEFENSE_CFG,safeMode:STORE.SAFE_MODE,cityTemplates:STORE.CITY_TEMPLATES,townGroups:STORE.TOWN_GROUPS,cultureTypes:STORE.CULTURE_TYPES,favorCfg:STORE.FAVOR_CFG,wonderCfg:STORE.WONDER_CFG,merchantWish:STORE.MERCHANT_WISH,priorityOrder:STORE.PRIORITY_ORDER,playerNotes:STORE.PLAYER_NOTES,watchlist:STORE.WATCHLIST};let applied=0;
    for(const k of Object.keys(validators)){if(obj[k]==null)continue;if(!validators[k](obj[k])){gbLog(`config import: ignored invalid ${k}`);continue}let v=clone(obj[k]);if(k==='priorityOrder'){const allowed=new Set(PRIORITY_ORDER_DEFAULT);v=v.map(String).filter((x,i,a)=>allowed.has(x)&&a.indexOf(x)===i);v=v.concat(PRIORITY_ORDER_DEFAULT.filter(x=>!v.includes(x)))}else if(k==='abOrder'){v=v.map(String).filter((x,i,a)=>AB_BUILDINGS.includes(x)&&a.indexOf(x)===i);v=v.concat(AB_BUILDINGS.filter(x=>!v.includes(x)))}else if(k==='abTargets'){const c={};for(const[b,n]of Object.entries(v))if(AB_BUILDINGS.includes(b))c[b]=abClampTarget(b,n);v=c}else if(k==='nativeQueue'){
      const clean={version:1,seq:Math.max(0,+v.seq||0),towns:{}},seen=new Set();
      const jobId=(raw,prefix)=>{let id=/^[A-Za-z0-9:._-]{1,160}$/.test(String(raw||''))?String(raw):'';if(!id||seen.has(id)){clean.seq++;id=`${prefix}:import:${clean.seq.toString(36)}`}seen.add(id);return id};
      for(const[tid,t]of Object.entries(v.towns||{}).slice(0,500)){if(!/^\d+$/.test(String(tid))||!isObj(t))continue;const townId=String(tid),build=[],recruit=[];
        for(const j of (Array.isArray(t.build)?t.build:[]).slice(0,300)){if(!isObj(j)||!AB_BUILDINGS.includes(String(j.building))||!Number.isFinite(+j.toLevel)||+j.toLevel<=0)continue;const uncertain=!!(j.inflight||j.manualReview||j.reconcile),flight=j.reconcile||j.inflight||null,flightBuilding=flight&&AB_BUILDINGS.includes(String(flight.building))?String(flight.building):String(j.building);build.push({id:jobId(j.id,'b'),kind:'build',townId,building:String(j.building),fromLevel:Math.max(0,Math.floor(+j.fromLevel||(+j.toLevel-1))),toLevel:Math.max(1,Math.floor(+j.toLevel)),status:uncertain?'unknown':'pending',reason:uncertain?'acción importada pendiente de revisión':'',createdAt:Number.isFinite(+j.createdAt)?+j.createdAt:Date.now(),inflight:null,manualReview:uncertain,reconcile:flight&&isObj(flight)?{building:flightBuilding,targetLevel:Math.max(1,Math.floor(+flight.targetLevel||+j.toLevel)),at:+flight.at||Date.now(),accepted:!!flight.accepted}:null})}
        for(const j of (Array.isArray(t.recruit)?t.recruit:[]).slice(0,300)){if(!isObj(j)||!/^[a-z0-9_:-]+$/i.test(String(j.unit||''))||!recruitUnitDef(String(j.unit))||!Number.isFinite(+j.amount)||+j.amount<=0)continue;const uncertain=!!(j.inflight||j.manualReview);recruit.push({id:jobId(j.id,'u'),kind:'recruit',townId,unit:String(j.unit),amount:Math.max(1,Math.floor(+j.amount)),status:uncertain?'unknown':'pending',reason:uncertain?'acción importada pendiente de revisión':'',createdAt:Number.isFinite(+j.createdAt)?+j.createdAt:Date.now(),inflight:null,manualReview:uncertain})}
        clean.towns[townId]={build,recruit,paused:{build:!!(t.paused&&t.paused.build),recruit:!!(t.paused&&t.paused.recruit)},mode:{build:build.length||t.mode&&t.mode.build==='fifo'?'fifo':'legacy',recruit:recruit.length||t.mode&&t.mode.recruit==='fifo'?'fifo':'legacy'}}
      }v=clean
    }else if(k==='watchlist')v=v.slice(0,500);else if(k==='merchantWish')v=v.slice(0,100).filter(x=>isObj(x)&&(x.item||x.id)&&Number.isFinite(+x.maxPrice)&&+x.maxPrice>0);state[k]=v;save(storeFor[k],v);applied++}
    state.configVer=CONFIG_VER_CURRENT;save(STORE.CONFIG_VER,CONFIG_VER_CURRENT);if(state.autoFavor){state.autoFavor=false;save(STORE.AUTO_FAVOR,false)}goalPlanAll();gbLog(`config imported: ${applied} validated section(s)`);return applied>0;
  }

  const ORCH_MS = 20000;
  const ORCH_MAX_PER_TICK = 3;
  const ORCH_SPACING_MS = 450;
  const ORCH_JITTER = 0.2;
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
  function orchSafe(key,fn){try{return fn()}catch(e){const msg=String(e&&e.stack||e).slice(0,220);gbLog(`orch ${key} exception: ${msg}`);markModuleHealth(key,'err',{error:msg});whyNote(key,'orchestrator','error',msg);orchIdle[key]=0;return null}}
  const ORCH_HANDLERS = {
    culture:()=>orchSafe('culture',()=>cultureScan('orch')),
    cave:()=>orchSafe('cave',()=>caveScan('orch')),
    build:()=>orchSafe('build',()=>{abEnsureTargets();abScan('orch')}),
    research:()=>orchSafe('research',()=>researchScan('orch')),
    trade:()=>orchSafe('trade',()=>tradeScan('orch')),
    farm:()=>orchSafe('farm',()=>autoClaimFarms('orch')),
    ruraltrade:()=>orchSafe('ruraltrade',()=>ruralTradeScan('orch')),
    rurallevel:()=>orchSafe('rurallevel',()=>ruralLevelScan('orch')),
    recruit:()=>orchSafe('recruit',()=>recruitScan('orch')),
    merchant:()=>orchSafe('merchant',()=>merchantScan('orch')),
    pttrade:()=>orchSafe('pttrade',()=>ptTradeScan('orch')),
    favor:()=>orchSafe('favor',()=>favorScan('orch')),
    wonder:()=>orchSafe('wonder',()=>{wonderScan('orch');wonderFavorScan('orch')}),
  };
  function orchFeatureEnabled(key) {
    return {
      culture: state.autoCulture,
      cave: state.autoCave,
      build: state.abAuto || nativeQueueHasPending('build'),
      research: state.autoResearch,
      trade: state.autoTrade || state.islandShip,
      farm: state.autoFarm,
      ruraltrade: state.autoRuralTrade,
      rurallevel: state.autoRuralLevel,
      recruit: state.autoRecruit || nativeQueueHasPending('recruit'),
      merchant: state.autoMerchant,
      pttrade: state.autoPtTrade,
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
      const r = list[i];
      if (r.f === f && r.r === 'ok') n += r.n || 1;
    }
    return n;
  }

  function orchIdleFactor(key) {
    if (state.orchAdaptive === false) return 1;
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
    const configured = (state.priorityOrder && state.priorityOrder.length)
      ? state.priorityOrder : orchDefaultOrder();

    const mandatory = goalMandatoryModules();
    const order = mandatory.concat(configured.filter(k => !mandatory.includes(k))).concat(orchDefaultOrder().filter(k => !mandatory.includes(k) && configured.indexOf(k) === -1));
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

    due.sort((a, b) => {
      const gap = b.overdue - a.overdue;
      if (Math.abs(gap) > ORCH_MS * 2) return gap;
      return a.rank - b.rank;
    });
    const run = due.slice(0, ORCH_MAX_PER_TICK);
    run.forEach((item, idx) => {
      const fire = () => {

        if (automationPaused({})) return;
        if (ORCH_CAPTCHA[item.key] && captchaPaused(ORCH_CAPTCHA[item.key])) return;

        if (orchJrnMark[item.key] != null) orchNoteResult(item.key);
        orchLastRun[item.key] = Date.now();
        orchJrnMark[item.key] = orchJrnCount(item.key);
        ORCH_HANDLERS[item.key]();
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
  function intelMyIdentity() {
    try {
      const uw = gameUw();
      const p = uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('Player');
      const a = (p && p.attributes) || {};
      return {
        id: a.id ?? a.player_id ?? (uw.Game && (uw.Game.player_id ?? uw.Game.playerId)) ?? null,
        name: a.name || a.player_name || (uw.Game && (uw.Game.player_name || uw.Game.playerName)) || null,
      };
    } catch (_) { return { id: null, name: null }; }
  }
  function intelActorIsMe(actor, me) {
    if (!actor || !me) return false;
    if (actor.id != null && me.id != null && String(actor.id) === String(me.id)) return true;
    if (actor.name && me.name && String(actor.name).toLowerCase() === String(me.name).toLowerCase()) return true;
    return false;
  }
  function intelDossiers() {
    const byPlayer = {};
    const me = intelMyIdentity();
    for (const f of (state.findings || [])) {
      let raw = f.player || null;
      if (!raw) {
        const a = f.attacker || null, d = f.defender || null;
        if (intelActorIsMe(a, me)) raw = d;
        else if (intelActorIsMe(d, me)) raw = a;
        else raw = a || d;
      }
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
      if (raw && typeof raw === 'object' && (raw.town_id != null || raw.town_name)) d.towns.push({ id: raw.town_id, name: raw.town_name });
      else if (f.town && (f.town.id != null || f.town.name)) d.towns.push(f.town);
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
  function intelThreatBoard() {
    return (typeof dodgeIncomingMovements === 'function') ? dodgeIncomingMovements() : [];
  }
  function renderIntel() {
    const box = panel && panel.querySelector('.intel-panel');
    if (!box) return;
    const sec = box.closest('section[data-tab]');
    if (sec && sec.hidden) return;
    const threats = intelThreatBoard();
    const dossiers = intelDossiers().slice(0, 30);
    let html = '';
    html += '=== Entrantes ===\n';
    if (!threats.length) html += '(none)\n';
    else {
      threats.forEach(t => {
        const da = defenseAssessment(t, threats);
        html += `${t.hasCs ? '[CS] ' : ''}${t.type || 'atk'} → ${t.dest} from ${t.origin || '?'}` +
          (t.arrival ? ` @${t.arrival}` : '') + ` | riesgo ${da.risk} | ETA ${da.eta==null?'?':fmtSec(da.eta)} | apoyo ${da.supports.length} | esquivar ${da.evac.ok?'si':'no'}` + '\n';
      });
    }
    html += '\n=== Fichas ===\n';
    dossiers.forEach(d => {
      html += `${d.player}: ${d.reports} informes` +
        (d.note ? ` — ${d.note}` : '') +
        (d.allianceNote ? ` [aliado: ${d.allianceNote}]` : '') + '\n';
    });
    if (state.watchlist && state.watchlist.length) {
      html += '\n=== Lista de vigilancia ===\n' + state.watchlist.map(w =>
        typeof w === 'object' ? `${w.id || w.townId} ${w.name || ''}` : String(w)
      ).join('\n') + '\n';
    }
    if (state.allianceNotes && Object.keys(state.allianceNotes).length) {
      html += '\n=== Notas de alianza ===\n';
      Object.keys(state.allianceNotes).forEach(k => {
        html += `${k}: ${state.allianceNotes[k]}\n`;
      });
    }
    if (state.attackPatternNote) {
      html += '\n=== Patrones de ataque ===\n' + state.attackPatternNote + '\n';
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
  function intelGrepodataAssist() {
    if (!state.grepodataIndex || state.dryRun) return;
    try {
      const btn = document.querySelector('.grepodata_index, a.index_report, [data-action="index"], .btn_index');
      if (btn && !btn.dataset.grepbotIndexed) {
        if (gbDomClick(btn, 'grepodata')) {
          btn.dataset.grepbotIndexed = '1';
          gbLogT('grepodata', 10000, 'intel: Grepodata Index+ clicked');
        }
      }
    } catch (_) {}
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

  const QUEST_SCAN_MS = 12000;
  const QUEST_HISTORY_MAX = 100;
  let questMo = null;
  let questMoContainer = null;
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
        let canClaim = null,claimStateKnown=false;
        try {
          if (typeof m.isClaimable === 'function') {canClaim=!!m.isClaimable();claimStateKnown=true}
          else if (typeof m.isFinished === 'function') {canClaim=!!m.isFinished();claimStateKnown=true}
          else if (typeof m.getReward === 'function') {canClaim=!!m.getReward();claimStateKnown=true}
          else if (typeof m.hasReward === 'function') {canClaim=!!m.hasReward();claimStateKnown=true}
          else if (progress != null && progress >= 100) {canClaim=true;claimStateKnown=true}
          else if (a.state === 'satisfied' || a.status === 'satisfied') {canClaim=true;claimStateKnown=true}
          else if (/^(?:closed|claimed|completed|rewarded)$/i.test(String(a.state||a.status||''))) {canClaim=false;claimStateKnown=true}
          else if (progress != null && progress < 100) {canClaim=false;claimStateKnown=true}
        } catch (_) {}
        const rewards = rewardsFromModel(m);

        const pid = a.progressable_id != null ? a.progressable_id : id;
        const cfg=a.configuration||{},islandX=cfg.island_x??a.island_x??null,islandY=cfg.island_y??a.island_y??null;
        out.push({
          questId: id,
          progressableId: String(pid),
          name: a.questname || a.quest_name || a.name || '',
          title: a.name || a.summary || a.questname || id,
          progress,
          canClaim,
          claimStateKnown,
          rewards,
          state: a.state || a.status || '',
          fromGame: true,
          modelName: name,
          islandX:islandX==null?null:+islandX,
          islandY:islandY==null?null:+islandY,
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
    const incomingKnown=entry.claimStateKnown===true,nextClaimStateKnown=incomingKnown?true:!!prev.claimStateKnown;
    const incomingCanClaim = incomingKnown ? !!entry.canClaim : !!prev.canClaim;
    const reviewReconciled = !!prev.claimReview && incomingKnown && entry.canClaim === false;
    const nextClaimReview = reviewReconciled ? false : !!prev.claimReview;
    const nextClaimedAt = +prev.claimedAt || (reviewReconciled ? Date.now() : 0);
    const nextCanClaim = (nextClaimReview || nextClaimedAt) ? false : incomingCanClaim;
    const nextTitle = entry.title != null ? entry.title : prev.title;
    const nextName = entry.name != null ? entry.name : prev.name;
    const nextTownId = entry.townId ? String(entry.townId) : String(prev.townId||'');
    const nextModelName=entry.modelName||prev.modelName||'',nextIslandX=entry.islandX!=null?+entry.islandX:(prev.islandX??null),nextIslandY=entry.islandY!=null?+entry.islandY:(prev.islandY??null);
    const nextSig = questRewardsSig(rewards);

    const unchanged = prev.questId != null
      && prev.progress === nextProgress
      && !!prev.canClaim === nextCanClaim
      && !!prev.claimStateKnown === nextClaimStateKnown
      && !!prev.safeAuto === !!safeAuto
      && (prev.title || '') === (nextTitle || '')
      && (prev.name || '') === (nextName || '')
      && String(prev.townId||'') === nextTownId
      && String(prev.modelName||'')===String(nextModelName)
      && (prev.islandX??null)===nextIslandX && (prev.islandY??null)===nextIslandY
      && !!prev.claimReview === nextClaimReview
      && (+prev.claimedAt||0) === nextClaimedAt
      && questRewardsSig(prev.rewards) === nextSig;
    if (unchanged) return prev;
    const merged = Object.assign({}, prev, entry, {
      rewards,
      updatedAt: Date.now(),
      autoBuildReward,
      autoResReward,
      safeAuto,
      canClaim: nextCanClaim,
      claimStateKnown: nextClaimStateKnown,
      claimReview: nextClaimReview,
      claimedAt: nextClaimedAt,
      townId: nextTownId,
      modelName:nextModelName,
      islandX:nextIslandX,
      islandY:nextIslandY,
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
  function questResolveTownId(entry) {
    const ix=Number(entry&&entry.islandX),iy=Number(entry&&entry.islandY);
    if(Number.isFinite(ix)&&Number.isFinite(iy)){try{const towns=gameUw().ITowns&&gameUw().ITowns.towns||{};for(const id of Object.keys(towns)){const p=ruralTownIslandXY(id);if(p&&Number(p.x)===ix&&Number(p.y)===iy)return String(id)}}catch(_){}}
    const fallback=entry&&entry.townId;if(fallback&&/^\d+$/.test(String(fallback))&&abGetTown(String(fallback)))return String(fallback);return null;
  }
  function questClearReviewForTx(tx) {
    const qid=tx&&tx.snapshot&&tx.snapshot.qid;if(qid==null)return false;let live=null;
    try{live=questsFromGame().find(q=>String(q.questId)===String(qid)||String(q.progressableId)===String(qid))||null}catch(_){}if(!live||!live.claimStateKnown)return false;
    let changed=false;for(const q of Object.values(state.questRewards||{})){if(!q||(String(q.questId)!==String(qid)&&String(q.progressableId)!==String(qid)))continue;q.claimReview=false;q.claimError='';q.claimStateKnown=true;q.canClaim=!!live.canClaim;q.claimedAt=live.canClaim?0:(q.claimedAt||Date.now());q.updatedAt=Date.now();changed=true}if(changed)save(STORE.QUEST_REWARDS,state.questRewards);return changed;
  }
  function claimQuestViaBridge(entry, onDone) {
    const uw = gameUw();
    const pid = entry.progressableId || entry.questId;
    if (!pid || !(uw.gpAjax && uw.gpAjax.ajaxPost)) return onDone && onDone('noajax');
    if(!/^\d+$/.test(String(pid)))return onDone&&onDone('no-numeric-id');
    const townId=questResolveTownId(entry);if(!townId)return onDone&&onDone('town-unknown');
    const payload = {
      model_url: 'IslandQuests',
      action_name: 'claimReward',
      arguments: { reward_action:'stash',state:'closed',progressable_id:+pid },
      town_id: +townId,
      nl_init:true,
    };
    gbLog('quest bridge claim:', JSON.stringify(payload).slice(0, 200));
    bridgePost('quest', payload, (err, data) => {
      if (err) return onDone && onDone(err);
      if (data && data.error) return onDone && onDone(String(data.error));
      onDone && onDone(null, data);
    });
  }
  function questAutoClaim(root, entry) {
    if (gbLocked('quest-auto') || !entry?.canClaim || entry.claimReview || entry.claimedAt) return;
    const rewards = entry.rewards || [];

    if (!rewards.length || !rewards.every(isSafeQuestReward)) return;
    if(entry.modelName!=='IslandQuest'){gbLogT('quest-contract-'+entry.questId,300000,'quest: generic/unknown progressable skipped');return}
    if(!questResolveTownId(entry)){gbLogT('quest-town-'+entry.questId,300000,'quest: island town unresolved — fail closed');return}
    if (!state.questAutoBuild && !state.questAutoRes) return;
    if (questClaimBlocked(entry.questId)) {
      gbLogT('quest-block-' + entry.questId, 60000, 'quest: claim backoff active', entry.title || entry.questId);
      return;
    }
    const autoToken = gbLock('quest-auto');
    if (!autoToken) return;
    const kinds = rewards.map(r => r.kind).join(',');
    const setClaimState=(review,err)=>{const cur=state.questRewards[entry.questId]||entry;cur.canClaim=false;cur.claimStateKnown=true;cur.claimReview=!!review;cur.claimedAt=review?0:Date.now();cur.claimError=review?String(err||'resultado desconocido'):'';cur.updatedAt=Date.now();state.questRewards[entry.questId]=cur;save(STORE.QUEST_REWARDS,state.questRewards)};
    const finish = (method, ok, err) => {
      if (ok) questClaimOk(entry.questId);
      else if(!/^(?:timeout|timeout_unknown|pending)(?::|$)/.test(String(err||''))) questClaimFailed(entry.questId, err);
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
      if (ok) flash('reclamo de mision: ' + kinds);
      gbTimeout(() => { gbUnlock('quest-auto', autoToken); questScanTick('post-claim'); renderQuests(); }, 2500);
    };
    const questStillClaimable = () => {
      try {
        const live = questsFromGame().find(q => String(q.questId) === String(entry.questId)||String(q.progressableId)===String(entry.progressableId));
        if (live && live.claimStateKnown) return !!live.canClaim;
      } catch (_) {}
      const cur = state.questRewards[entry.questId];return cur&&cur.claimStateKnown?!!cur.canClaim:null;
    };
    claimQuestViaBridge(entry, (err) => {
      if (/^(?:timeout|timeout_unknown|pending)(?::|$)/.test(String(err||''))) {
        if (questStillClaimable()===false) {setClaimState(false);return finish('bridge-reconcile', true)}
        setClaimState(true,err);return finish('bridge-review', false, err||'timeout_unknown');
      }
      if (err) return finish('bridge', false, err);

      setClaimState(false);return finish('bridge', true);
    });
  }
  function questSnapshot(row, rewards, canClaim) {
    const questId = questKey(row);
    const headline = row?.querySelector('.headline');
    const progress = questProgress(row);
    const claimStateKnown=!!canClaim||(progress!=null&&progress<100);const entry = {
      questId,
      progressableId: headline?.dataset?.questProgressableId || row?.dataset?.questProgressableId || '',
      name: row?.dataset?.questName || '',
      title: (headline?.textContent || '').trim(),
      progress,
      updatedAt: Date.now(),
      selected: !!row?.classList.contains('selected'),
      canClaim: claimStateKnown?!!canClaim:null,
      claimStateKnown,
      rewards: rewards || [],
      townId: String(abCurrentTownId()||''),
      townEvidence:'dom-current',
      fromDom:true,
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

    const idStr=String(id),idRe=new RegExp(`(?:^|[^A-Za-z0-9])${idStr.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:$|[^A-Za-z0-9])`);
    const idMatch=v=>{const a=String(v==null?'':v);return a===idStr||idRe.test(a)};
    const fromGame = questsFromGame().find(q => idMatch(q.questId) || idMatch(q.progressableId));
    if (fromGame && fromGame.rewards && fromGame.rewards.length) {
      rewards = fromGame.rewards;
    }
    const entry = questSnapshot(row, rewards, !!questActionButton(root) || !!(fromGame && fromGame.canClaim));
    if (fromGame) {
      if(fromGame.progress != null && entry.progress == null)entry.progress=fromGame.progress;
      if(fromGame.claimStateKnown){entry.claimStateKnown=true;entry.canClaim=!!fromGame.canClaim}
      entry.modelName=fromGame.modelName;entry.islandX=fromGame.islandX;entry.islandY=fromGame.islandY;entry.progressableId=fromGame.progressableId||entry.progressableId;
    }
    mergeQuestEntry(entry);
    questAutoClaim(root, state.questRewards[entry.questId]);
  }
  function ingestGameQuests() {
    questsFromGame().forEach(q => mergeQuestEntry(q));
  }
  function questScanTick(reason) {
    if (!hostEnabled()) return;

    const scanToken = gbLock('quest-scan');
    if (!scanToken) return;
    try {
      bindQuestObserver();
      ingestGameQuests();

      if (!gbLocked('quest-auto')) {
        const claimable = Object.values(state.questRewards).filter(e => e.canClaim && e.safeAuto);
        if (claimable.length) {
          questAutoClaim(questRewardRoot(), claimable[0]);
        }
      }
      const rows = questRows();
      if (!rows.length) return;

      const row = questSelectedRow(rows);
      if (!row) return;
      try { questCaptureCurrent(row); }
      catch (_) {  }
    } finally {
      gbUnlock('quest-scan', scanToken);
      renderQuests();
    }
  }
  function bindQuestObserver() {
    const container = document.querySelector('.quests, #questlog');
    if (!container) {
      if (questMo) { try { questMo.disconnect(); } catch (_) {} }
      questMo = null;
      questMoContainer = null;
      return;
    }
    if (questMo && questMoContainer === container && container.isConnected) return;
    if (questMo) { try { questMo.disconnect(); } catch (_) {} }
    questMoContainer = container;
    questMo = new MutationObserver(() => {
      if (!gbInstanceAlive()) return;
      gbClearTimeout(bindQuestObserver._t);
      bindQuestObserver._t = gbTimeout(() => questScanTick('mutation'), 400);
    });
    questMo.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
  }
  function questDispose() {
    if (questMo) {
      try { questMo.disconnect(); } catch (_) {}
      questMo = null;
    }
    questMoContainer = null;
    gbClearTimeout(bindQuestObserver._t);
    bindQuestObserver._t = null;
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
        const auto = q.claimReview?'REVIEW':(q.safeAuto ? (q.canClaim ? 'CLAIM' : 'yes') : 'no');
        const autoColor = auto === 'CLAIM' ? '#6dda7e' : (auto === 'REVIEW'?'#ff9d62':(auto === 'yes' ? '#fc6' : '#888'));
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
  const ATTACK_ROLE_OFFENSE = '__attack_offense';
  const ATTACK_ROLE_DEFENSE = '__attack_defense';
  const HARASS_CAPS = { '1sling': 1, '5sling': 5, light: 8 };
  const HARASS_PREF = ['slinger', 'rider', 'archer', 'hoplite', 'sword'];
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
  function computeTravelSeconds(srcTownId, target, units, requireCanonical) {
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
    if (requireCanonical) return null;
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

    if (id === 'hoplite') return 'both';
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
    if (troopMode === 'harass') return selectHarassmentUnits(townId, harassPreset || 'light');
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
      targetType: 'town',
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
    const d = defaultAttackPlan();
    if (!state.attackPlan || typeof state.attackPlan !== 'object' || Array.isArray(state.attackPlan)) state.attackPlan = d;
    else {
      for (const [k, v] of Object.entries(d)) if (state.attackPlan[k] === undefined) state.attackPlan[k] = Array.isArray(v) ? v.slice() : (v && typeof v === 'object' ? Object.assign({}, v) : v);
    }
    return state.attackPlan;
  }
  function saveAttackPlan() {
    save(STORE.ATTACK_PLAN, state.attackPlan);
  }
  function attackRememberTarget(id, meta) {
    if (id == null || id === '') return;
    const sid = String(id);
    if (!/^\d+$/.test(sid)) return;
    if (!Array.isArray(state.attackRecent)) state.attackRecent = [];
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
      if (!/^\d+$/.test(id)) return;
      const prev = map.get(id);
      const entry = {
        id, name: t.name || (prev && prev.name) || null,
        x: t.x != null ? t.x : (prev && prev.x != null ? prev.x : null),
        y: t.y != null ? t.y : (prev && prev.y != null ? prev.y : null),
        src: (prev && prev.src) || src, ts: +t.ts || (prev && +prev.ts) || 0,
      };
      if (!prev || (+t.ts || 0) >= (+prev.ts || 0)) map.set(id, entry);
    };
    for (const f of (state.findings || [])) {
      if (f.town && f.town.id != null) add(Object.assign({}, f.town, { ts: f.ts }), 'report');
    }
    for (const t of (state.attackRecent || [])) add(t, t.src || 'recent');
    for (const h of (state.attackHistory || [])) if (h.targetId) add({ id: h.targetId, ts: h.ts }, 'history');
    for (const w of (state.watchlist || [])) {
      const id = w && (w.id || w.townId || w);
      if (id != null) add({ id, name: w && w.name, ts: 0 }, 'watch');
    }
    const tpl = state.attackTpl;
    const learnedId = tpl && tpl.arguments && tpl.arguments.id;
    if (learnedId != null) add({ id: learnedId, ts: tpl.learned_at || 0 }, 'template');
    return Array.from(map.values()).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }
  function applyAttackTarget(t) {
    if (!t || t.id == null || !/^\d+$/.test(String(t.id))) return false;
    const plan = ensureAttackPlan();
    plan.targetId = String(t.id);
    plan.targetType = 'town';
    if (t.x != null && Number.isFinite(+t.x)) plan.targetX = +t.x;
    if (t.y != null && Number.isFinite(+t.y)) plan.targetY = +t.y;
    attackRememberTarget(t.id, { name: t.name || null, x: t.x, y: t.y, src: t.src || 'picker' });
    saveAttackPlan();
    renderAttack();
    flash('target -> ' + (t.name ? `${t.name} (#${t.id})` : String(t.id)));
    return true;
  }
  function attackTownGroup(name) { return ((state.townGroups && state.townGroups[name]) || []).map(String); }
  function attackSetTownRole(name, townId, on) {
    if (!state.townGroups) state.townGroups = {};
    const sid = String(townId);
    const ids = new Set(attackTownGroup(name));
    if (on) ids.add(sid); else ids.delete(sid);
    state.townGroups[name] = Array.from(ids);
    save(STORE.TOWN_GROUPS, state.townGroups);
  }
  function attackSelectSources(ids) {
    const plan = ensureAttackPlan();
    plan.sourceTownIds = (ids || []).map(String);
    saveAttackPlan(); renderAttack();
  }
  function attackSetAllSources(checked) {
    attackSelectSources(checked ? (state.towns || []).map(t => String(t.id)) : []);
    flash(checked ? 'all towns selected' : 'sources cleared');
  }
  function attackSelectRoleSources(role) {
    const ids = attackTownGroup(role);
    if (!ids.length) { flash('sin ciudades con este rol'); return; }
    attackSelectSources(ids);
    flash(`${role === ATTACK_ROLE_OFFENSE ? 'ofensiva' : 'defensa'} ciudades seleccionadas (${ids.length})`);
  }
  function renderAttackRoles(sec) {
    const box = sec && sec.querySelector('.atk-roles');
    if (!box) return;
    const towns = state.towns || [];
    const off = new Set(attackTownGroup(ATTACK_ROLE_OFFENSE));
    const def = new Set(attackTownGroup(ATTACK_ROLE_DEFENSE));
    const sig = towns.map(t => t.id + ':' + (t.name || '')).join('|') + '|O:' + [...off].sort().join(',') + '|D:' + [...def].sort().join(',');
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig; box.replaceChildren();
    if (!towns.length) { const e = document.createElement('div'); e.textContent = 'load towns first'; e.style.cssText = 'color:#666;font-size:10px'; box.appendChild(e); return; }
    const mk = (title, role, color, set) => {
      const col = document.createElement('div');
      const h = document.createElement('div'); h.textContent = title; h.style.cssText = `font-size:9px;color:${color};font-weight:bold`; col.appendChild(h);
      towns.forEach(t => {
        const lab = document.createElement('label'); lab.style.cssText = 'display:flex;align-items:center;gap:3px;font-size:10px;cursor:pointer';
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = set.has(String(t.id));
        cb.addEventListener('change', () => { attackSetTownRole(role, t.id, cb.checked); renderAttackRoles(sec); });
        lab.appendChild(cb); lab.appendChild(document.createTextNode((t.name || t.id).slice(0, 18))); col.appendChild(lab);
      });
      return col;
    };
    const grid = document.createElement('div'); grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px';
    grid.appendChild(mk('Offensive cities', ATTACK_ROLE_OFFENSE, '#f96', off));
    grid.appendChild(mk('Defensive cities', ATTACK_ROLE_DEFENSE, '#6cf', def));
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
    if ((explicitType === 'town' || explicitType === 'player_town') && !/^\d+$/.test(id)) {
      gbLogT('atk-target-id', 30000, `attack: town target id must be numeric (${id.slice(0, 40)}) — blocked`);
      return null;
    }
    let x = plan.targetX, y = plan.targetY, island = null;
    let kind = explicitType || null;

    const ownTown = (state.towns || []).find(t => String(t.id) === id);
    if (ownTown) {
      if (!/^\d+$/.test(id)) return null;
      kind = kind || 'town';
      x = x ?? ownTown.x; y = y ?? ownTown.y; island = ownTown.island;
      return { id, vill_id: null, town_id: id, kind: 'town', x: x != null ? +x : null, y: y != null ? +y : null, island };
    }
    try {
      const uw = gameUw();
      if (uw.ITowns && uw.ITowns.towns && uw.ITowns.towns[id]) {
        if (!/^\d+$/.test(id)) return null;
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

    if (!kind) {
      gbLogT('atk-target', 30000, `attack: id ${id} has no canonical type — blocked`);
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
  function selectHarassmentUnits(townId, preset) {
    const live = townLiveUnits(townId);
    const out = {};
    const key = String(preset || 'light');
    const cap = HARASS_CAPS[key] != null ? HARASS_CAPS[key] : Math.max(1, Math.floor(+preset || 5));
    if (key === '1sling' || key === '5sling') {
      const have = +live.slinger || 0;
      if (have > 0) out.slinger = Math.min(have, cap);
      return out;
    }
    let left = cap;
    for (const id of HARASS_PREF) {
      if (left <= 0) break;
      const have = +live[id] || 0;
      if (!(have > 0)) continue;
      const n = Math.min(have, left); out[id] = n; left -= n;
    }
    return out;
  }
  function attackAddMinimumTransports(townId, units) {
    const out = Object.assign({}, units || {});
    let need = 0;
    for (const [id, raw] of Object.entries(out)) {
      const n = +raw || 0;
      const m = unitMeta(id);
      if (!n || !m || m.is_naval || id === 'militia') continue;
      need += (+m.population || 1) * n;
    }
    if (!(need > 0)) return out;
    const live = townLiveUnits(townId);
    const choices = Object.keys(live).map(id => ({ id, n: +live[id] || 0, m: unitMeta(id) }))
      .filter(x => x.n > 0 && x.m && +x.m.capacity > 0)
      .sort((a, b) => (+b.m.capacity || 0) - (+a.m.capacity || 0));
    let cap = 0;
    for (const x of choices) {
      if (cap >= need) break;
      const per = +x.m.capacity || 0;
      if (!(per > 0)) continue;
      const take = Math.min(x.n, Math.max(1, Math.ceil((need - cap) / per)));
      out[x.id] = (out[x.id] || 0) + take;
      cap += take * per;
    }
    return out;
  }
  function attackUnitsForTarget(townId, target, plan) {
    let units = selectUnitsForTown(townId, plan.troopMode, plan.unitType, plan.perTownUnits, plan.harassPreset);
    if (plan.troopMode === 'harass' && !isSameIsland(townId, target)) units = attackAddMinimumTransports(townId, units);
    return units;
  }
  function applyHarassPreset(preset) {
    const plan = ensureAttackPlan();
    plan.troopMode = 'harass';
    plan.harassPreset = String(preset || 'light');
    if (!ATTACK_GENERIC_MISSIONS.has(String(plan.mission || 'attack').toLowerCase())) plan.mission = 'attack';
    saveAttackPlan();
    gbLog('attack: harass preset ' + plan.harassPreset);
    flash('preset de acoso: ' + plan.harassPreset + ' (manual confirmation still required)');
    return plan;
  }
  function buildAttackSchedule(plan) {
    const target = resolveTarget(plan);
    if (!target) return { error: 'no target', rows: [] };
    let sources = Array.isArray(plan.sourceTownIds)
      ? plan.sourceTownIds.map(String)
      : (state.towns || []).map(t => String(t.id));
    if (!sources.length) return { error: 'no source towns selected', rows: [] };
    const now = serverNow();
    const skew = clientServerSkewMs();
    const rows = sources.map((townId, idx) => {
      const town = (state.towns || []).find(t => String(t.id) === townId) || { id: townId, name: townId };
      const units = attackUnitsForTarget(townId, target, plan);
      const travel = computeTravelSeconds(townId, target, units, plan.timingMode === 'arrive_at');
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
  const ATTACK_GENERIC_MISSIONS = new Set(['attack', 'support', 'revolt']);
  function sendAttackViaBridge(target, srcTownId, units, mission, onDone) {
    if (!hostEnabled()) { flash('bot desactivado en este servidor'); return onDone && onDone('disabled'); }
    const safeMission = String(mission || 'attack').toLowerCase();
    if (!ATTACK_GENERIC_MISSIONS.has(safeMission)) {
      gbLog(`attack: mission ${safeMission} requires a dedicated canonical handler — blocked`);
      return onDone && onDone('unsupported-mission');
    }
    if (captchaPaused('attack')) { flash('ataque pausado (captcha)'); return onDone && onDone('captcha'); }
    if (!attackSendAllowed(target)) {
      flash('ataque bloqueado: objetivo no es una ciudad (o no resuelto)');
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

      if (k === 'militia' || unitMeta(k)) continue;
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
      if (err) { flash('ataque fallido: ' + err); return onDone && onDone(err); }
      flash('ataque enviado #' + srcTownId);
      attackRememberTarget(target.town_id, { x: target.x, y: target.y, src: 'sent' });
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
    (attackArmed.timers || []).forEach(id => gbClearTimeout(id));
    if (attackArmed.raf) cancelAnimationFrame(attackArmed.raf);
    gbLog('attack: cancelled armed wave');
    flash('ataque cancelado');
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
      flash('no se puede armar: objetivo no resuelto o no es una ciudad');
      gbLog('attack: arm blocked — need canonical town target (villages unsupported)');
      return;
    }
    const timers = [];
    const delays = [];
    const armedAt = Date.now();
    attackArmed = { timers, rows, plan, cancel: cancelArmedAttack, armedAt };
    const skew0 = clientServerSkewMs();
    gbLog(`attack: armed ${rows.length} towns mode=${plan.timingMode} skew=${Math.round(skew0)}ms (max window ${ATTACK_ARM_MAX_MS}ms)`);
    flash('Los timers del navegador no son precisos para uso militar - esperas largas no se dispararan solas');
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
        gbLog(`attack: ${row.townId} delay ${Math.round(delayMs)}ms > ${ATTACK_ARM_MAX_MS}ms — not arming (re-arm closer to send)`);
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
        const freshUnits = attackUnitsForTarget(row.townId, liveTarget, plan);
        const freshCount = Object.values(freshUnits).reduce((a, b) => a + (+b || 0), 0);
        const freshSame = isSameIsland(row.townId, liveTarget);
        const freshBoats = boatCapacityCheck(freshUnits, freshSame);
        if (!freshCount || !freshBoats.ok) {
          row.fireStatus = !freshCount ? 'no-units' : 'boats-changed';
          patchAttackFireStatus();
          return;
        }
        if (plan.timingMode === 'arrive_at') {
          const freshTravel = computeTravelSeconds(row.townId, liveTarget, freshUnits, true);
          if (freshTravel == null || row.travel == null || Math.abs(freshTravel - row.travel) > 1) {
            row.fireStatus = 'travel-changed';
            gbLog(`attack: abort ${row.townId}; canonical travel changed ${row.travel}→${freshTravel}`);
            patchAttackFireStatus();
            return;
          }
        }
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
      flash('no se puede enviar: objetivo no resuelto o no es una ciudad');
      return;
    }
    if (!confirm(`Enviar ${rows.filter(r => r.boats.ok && r.unitCount).length} ataque(s) ahora?`)) return;
    let i = 0;
    const okRows = rows.filter(r => r.boats.ok && r.unitCount);
    (function next() {
      if (i >= okRows.length) {
        pushAttackHistory({ ts: Date.now(), mode: 'send_now_immediate', targetId: plan.targetId, towns: okRows.map(r => r.townId) });
        flash(`ataques x${okRows.length}`);
        return;
      }
      const row = okRows[i++];
      const freshUnits = attackUnitsForTarget(row.townId, target, plan);
      const freshCount = Object.values(freshUnits).reduce((a, b) => a + (+b || 0), 0);
      const freshBoats = boatCapacityCheck(freshUnits, isSameIsland(row.townId, target));
      if (!freshCount || !freshBoats.ok) {
        gbLog(`attack: skip ${row.townId} at fire time (${!freshCount ? 'no-units' : freshBoats.reason})`);
        gbTimeout(next, (plan.staggerMs || 25) + Math.random() * 20);
        return;
      }
      sendAttackViaBridge(target, row.townId, freshUnits, plan.mission, () => {
        gbTimeout(next, (plan.staggerMs || 25) + Math.random() * 20);
      });
    })();
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
    const tt = sec.querySelector('[data-atk=target-type]');
    if (tt) tt.value = plan.targetType || 'town';
    const pick = sec.querySelector('[data-atk=pick]');
    if (pick && document.activeElement !== pick) {
      const targets = attackKnownTargets();
      const sig = targets.map(t => t.id + ':' + (t.name || '') + ':' + (t.x ?? '') + ':' + (t.y ?? '')).join('|');
      if (pick.dataset.sig !== sig) {
        pick.dataset.sig = sig; pick.replaceChildren();
        const first = document.createElement('option'); first.value = ''; first.textContent = targets.length ? `known targets (${targets.length})...` : 'no known targets'; pick.appendChild(first);
        targets.forEach(t => {
          const o = document.createElement('option'); o.value = t.id;
          const coord = t.x != null && t.y != null ? ` ${t.x}|${t.y}` : '';
          o.textContent = `${(t.name || '?').slice(0, 16)} #${t.id}${coord}`; pick.appendChild(o);
        });
      }
      pick.value = targets.some(t => String(t.id) === String(plan.targetId)) ? String(plan.targetId) : '';
    }
    const hint = sec.querySelector('#gb-atk-target-hint');
    if (hint) {
      const known = attackKnownTargets().find(t => String(t.id) === String(plan.targetId));
      const resolved = plan.targetId ? resolveTarget(plan) : null;
      if (resolved && resolved.kind === 'town') {
        const coord = resolved.x != null && resolved.y != null ? ` (${resolved.x}|${resolved.y})` : '';
        hint.textContent = `town #${plan.targetId}${known && known.name ? ' | ' + known.name : ''}${coord}`; hint.style.color = '#6dda7e';
      } else if (plan.targetId) { hint.textContent = 'target unresolved / unsupported'; hint.style.color = '#f96'; }
      else { hint.textContent = 'direct town id or a target learned from reports/previous attacks'; hint.style.color = '#888'; }
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
    const arr = sec.querySelector('[data-atk=arrival]');
    if (arr && document.activeElement !== arr && plan.arrivalUnix) {
      try {
        const d = new Date(plan.arrivalUnix * 1000 + clientServerSkewMs());
        const pad2 = n => String(n).padStart(2, '0');
        arr.value = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
      } catch (_) {}
    }
    const srcBox = sec.querySelector('.atk-sources');
    if (srcBox && !srcBox.dataset.bound) {
      srcBox.dataset.bound = '1';

    }
    if (srcBox) {
      const selected = new Set(Array.isArray(plan.sourceTownIds) ? plan.sourceTownIds.map(String) : (state.towns || []).map(t => String(t.id)));

      const sig = (state.towns || []).map(t => t.id + ':' + (t.name || '')).join('|');
      if (srcBox.dataset.sig === sig) {
        srcBox.querySelectorAll('input[data-id]').forEach(cb => {
          const want = selected.has(String(cb.dataset.id));
          if (cb.checked !== want) cb.checked = want;
        });
      } else {
        srcBox.dataset.sig = sig;
        srcBox.replaceChildren();
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
          lab.appendChild(document.createTextNode(`${t.name || t.id}`));
          srcBox.appendChild(lab);
        });
      }
    }
    const per = sec.querySelector('.atk-pertown');
    if (per) {
      per.hidden = plan.troopMode !== 'per_town';
      if (plan.troopMode === 'per_town') {
        per.replaceChildren();
        const ids = Array.isArray(plan.sourceTownIds)
          ? plan.sourceTownIds : (state.towns || []).map(t => String(t.id));
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
    renderAttackRoles(sec);
    renderMilitaryHelpers(sec, plan);
  }
  function readAttackForm() {
    const sec = panel && panel.querySelector('section[data-tab=attack]');
    const plan = ensureAttackPlan();
    if (!sec) return plan;
    plan.targetId = sec.querySelector('[data-atk=target]')?.value?.trim() || '';
    plan.targetType = sec.querySelector('[data-atk=target-type]')?.value || 'town';
    const xv = sec.querySelector('[data-atk=x]')?.value;
    const yv = sec.querySelector('[data-atk=y]')?.value;
    plan.targetX = xv === '' || xv == null ? null : +xv;
    plan.targetY = yv === '' || yv == null ? null : +yv;
    plan.mission = sec.querySelector('[data-atk=mission]')?.value || 'attack';
    plan.timingMode = sec.querySelector('[data-atk=timing]')?.value || 'send_now';
    plan.latencyPadMs = +(sec.querySelector('[data-atk=pad]')?.value || 200);
    plan.troopMode = sec.querySelector('[data-atk=troop]')?.value || 'offense';
    if (plan.troopMode === 'harass' && !plan.harassPreset) plan.harassPreset = 'light';
    plan.unitType = sec.querySelector('[data-atk=unit-type]')?.value || 'sword';
    const arr = sec.querySelector('[data-atk=arrival]')?.value;
    if (arr) {
      const ms = Date.parse(arr);
      if (!isNaN(ms)) plan.arrivalUnix = Math.floor((ms - clientServerSkewMs()) / 1000);
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
  function militaryMovementsUnitsModels() {
    const uw = gameUw();
    const models = [], seen = new Set();
    const push = (m) => {
      if (!m) return;
      const a = m.attributes || {};
      const id = (typeof m.getCommandId === 'function' && m.getCommandId()) || a.command_id || a.id || m.id;
      const k = String(id == null ? '' : id);
      if (k && seen.has(k)) return;
      if (k) seen.add(k);
      models.push(m);
    };
    try { const c = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('MovementsUnits'); if (c && c.models) c.models.forEach(push); } catch (_) {}
    try { const cs = uw.MM && uw.MM.getCollections && uw.MM.getCollections().MovementsUnits; (Array.isArray(cs) ? cs : (cs ? [cs] : [])).forEach(c => { if (c && c.models) c.models.forEach(push); }); } catch (_) {}
    return models;
  }
  function militaryOutgoingMovements() {
    const uw = gameUw();
    const out = [];
    const myTowns = new Set(Object.keys((uw.ITowns && uw.ITowns.towns) || {}).map(String));
    const now = gameNow();
    militaryMovementsUnitsModels().forEach(m => {
      try {
        const a = m.attributes || {};
        const home = String((typeof m.getHomeTownId === 'function' && m.getHomeTownId()) || a.home_town_id || a.origin_town_id || '');
        if (!myTowns.has(home)) return;
        const target = String((typeof m.getTargetTownId === 'function' && m.getTargetTownId()) || a.target_town_id || a.destination_town_id || '');
        const incoming = typeof m.isIncomingMovement === 'function' ? !!m.isIncomingMovement() : (myTowns.has(target) && home !== target);
        if (incoming) return;
        let cancelable = null;
        try { if (typeof m.isCancelable === 'function') cancelable = !!m.isCancelable(); } catch (_) {}
        if (cancelable == null && a.cancelable != null) cancelable = a.cancelable === true || a.cancelable === 1;
        const until = +(typeof m.getCancelableUntil === 'function' ? m.getCancelableUntil() : a.cancelable_until) || 0;
        if (until > 0 && until <= now) cancelable = false;
        if (cancelable !== true) return;
        const commandId = (typeof m.getCommandId === 'function' && m.getCommandId()) || a.command_id || a.id || m.id;
        if (commandId == null) return;
        const type = String((typeof m.getType === 'function' && m.getType()) || a.type || a.command_name || a.movement_type || '').toLowerCase();
        const arrival = +(typeof m.getArrivalAt === 'function' && m.getArrivalAt()) || +a.arrival_at || +a.arrived_at || 0;
        out.push({ commandId, home, target, type, arrival, until, cancelLeft: until > 0 ? Math.max(0, until - now) : null });
      } catch (_) {}
    });
    return out.sort((a, b) => (a.arrival || 0) - (b.arrival || 0));
  }
  function militaryCancelCommand(commandId, opts, onDone) {
    if (!opts || !opts.confirmed) return onDone && onDone('need-confirm');
    if (!hostEnabled() || automationPaused({})) return onDone && onDone('paused');
    if (captchaPausedAny('cancel', 'attack')) return onDone && onDone('captcha');
    const cmdId = commandId == null ? '' : String(commandId);
    if (!cmdId) return onDone && onDone('no-id');
    const live = militaryOutgoingMovements().find(m => String(m.commandId) === cmdId);
    if (!live) return onDone && onDone('not-cancelable');
    const tpl = state.cancelTpl;
    if (!tpl || !tpl.model_url || !tpl.action_name || !/cancel/i.test(String(tpl.action_name))) {
      gbLogT('cancel-template', 60000, 'cancel: no learned canonical template; cancel one command manually first');
      return onDone && onDone('template-required');
    }
    if (txRecentlyCommitted('cancel:' + cmdId, 120000)) return onDone && onDone('already-committed');
    const lockToken = gbLock('cancel');
    if (!lockToken) return onDone && onDone('busy');
    const args = {};
    for (const [k, v] of Object.entries(tpl.arguments || {})) if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') args[k] = v;
    args.id = /^\d+$/.test(cmdId) ? +cmdId : cmdId;
    const payload = { model_url: tpl.model_url, action_name: tpl.action_name, arguments: args, town_id: +live.home || undefined };
    bridgePost('cancel', payload, (err, data) => {
      gbUnlock('cancel', lockToken);
      if (!err) gbLog(`cancel: command ${cmdId} OK`); else gbLog(`cancel: command ${cmdId} err ${err}`);
      if (onDone) onDone(err, data);
    });
  }
  function heroesEnabled() {
    try {
      const uw = gameUw();
      if (uw.GameDataHeroes && typeof uw.GameDataHeroes.areHeroesEnabled === 'function') return !!uw.GameDataHeroes.areHeroesEnabled();
      return !!(uw.Game && uw.Game.features && uw.Game.features.heroes_enabled);
    } catch (_) { return false; }
  }
  function playerHeroModels() {
    const out = [], seen = new Set();
    const push = (m) => {
      if (!m) return;
      const a = m.attributes || {};
      const id = (typeof m.getId === 'function' && m.getId()) || a.type || a.id || m.id;
      const k = String(id || ''); if (!k || seen.has(k)) return; seen.add(k); out.push(m);
    };
    try { const c = mmCol('PlayerHero') || mmCol('PlayerHeroes'); if (c && c.models) c.models.forEach(push); } catch (_) {}
    try { const uw = gameUw(); const map = uw.MM && uw.MM.getModels && uw.MM.getModels().PlayerHero; if (map) Object.values(map).forEach(push); } catch (_) {}
    return out;
  }
  function playerHeroesList() {
    if (!heroesEnabled()) return [];
    const now = gameNow();
    return playerHeroModels().map(m => {
      const a = m.attributes || {};
      const type = (typeof m.getId === 'function' && m.getId()) || a.type || '';
      const name = (typeof m.getName === 'function' && m.getName()) || a.name || type;
      const home = +(typeof m.getHomeTownId === 'function' && m.getHomeTownId()) || +a.home_town_id || null;
      const origin = +(typeof m.getOriginTownId === 'function' && m.getOriginTownId()) || +a.origin_town_id || home;
      const arrival = +(typeof m.getArrivalAt === 'function' && m.getArrivalAt()) || +a.town_arrival_at || 0;
      const traveling = typeof m.isTravelingToTown === 'function' ? !!m.isTravelingToTown() : arrival > now;
      const injured = typeof m.isInjured === 'function' ? !!m.isInjured() : (+a.cured_at > now);
      const attacking = typeof m.attacksTown === 'function' ? !!m.attacksTown() : a.assignment_type === 'command';
      const assigned = typeof m.isAssignedToTown === 'function' ? !!m.isAssignedToTown() : (home != null && a.assignment_type === 'town');
      let status = 'free'; if (injured) status = 'injured'; else if (attacking) status = 'attacking'; else if (traveling) status = 'transferring'; else if (assigned) status = 'assigned';
      return { type: String(type), name: String(name), home, origin, arrival, traveling, injured, attacking, assigned, status, level: +(typeof m.getLevel === 'function' && m.getLevel()) || +a.level || 0 };
    }).filter(h => h.type);
  }
  function heroTownOccupied(townId, exceptType) {
    const tid = +townId;
    return playerHeroesList().some(h => h.type !== exceptType && ((h.assigned && +h.home === tid) || (h.traveling && +h.home === tid)));
  }
  function heroBridgePost(action, heroType, targetTownId, onDone) {
    if (!heroesEnabled()) return onDone && onDone('heroes-off');
    if (!hostEnabled() || automationPaused({})) return onDone && onDone('paused');
    if (captchaPausedAny('hero', 'attack')) return onDone && onDone('captcha');
    const type = String(heroType || ''); if (!type) return onDone && onDone('no-hero');
    const tpl = state.heroTpl && state.heroTpl[action];
    const targetKey = targetTownId != null ? +targetTownId : '-';
    if (!tpl || !tpl.model_url || !tpl.action_name || String(tpl.action_name) !== String(action)) {
      gbLogT('hero-template-' + action, 60000, `hero: ${action} template missing; perform that action manually once first`);
      return onDone && onDone('template-required');
    }
    if (txRecentlyCommitted(`hero:${action}:${type}:${targetKey}`, 120000)) return onDone && onDone('already-committed');
    const src = tpl.arguments || {}, args = {};
    for (const [k, v] of Object.entries(src)) if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') args[k] = v;
    const heroKey = Object.prototype.hasOwnProperty.call(src, 'type') ? 'type' : (Object.prototype.hasOwnProperty.call(src, 'hero_type') ? 'hero_type' : null);
    if (!heroKey) return onDone && onDone('template-shape');
    args[heroKey] = type;
    if (targetTownId != null) {
      const townKey = Object.prototype.hasOwnProperty.call(src, 'target_town_id') ? 'target_town_id' : (Object.prototype.hasOwnProperty.call(src, 'town_id') ? 'town_id' : null);
      if (action === 'assignToTown' && !townKey) return onDone && onDone('template-shape');
      if (townKey) args[townKey] = +targetTownId;
    }
    const lockToken = gbLock('hero'); if (!lockToken) return onDone && onDone('busy');
    const payload = { model_url: tpl.model_url, action_name: tpl.action_name, arguments: args, town_id: targetTownId != null ? +targetTownId : tpl.town_id };
    bridgePost('hero', payload, (err, data) => {
      gbUnlock('hero', lockToken);
      if (!err) gbLog(`hero: ${action} ${type} -> ${targetTownId || '-'} OK`); else gbLog(`hero: ${action} ${type} err ${err}`);
      if (onDone) onDone(err, data);
    });
  }
  function heroAssignToTown(heroType, targetTownId, opts, onDone) {
    if (!opts || !opts.confirmed) return onDone && onDone('need-confirm');
    const tid = +targetTownId; if (!tid) return onDone && onDone('no-town');
    const hero = playerHeroesList().find(h => h.type === String(heroType));
    if (!hero) return onDone && onDone('missing');
    if (hero.injured || hero.attacking || hero.traveling) return onDone && onDone(hero.injured ? 'injured' : (hero.attacking ? 'attacking' : 'transferring'));
    if (hero.assigned && +hero.home === tid) return onDone && onDone('already');
    if (heroTownOccupied(tid, hero.type)) return onDone && onDone('town-occupied');
    return heroBridgePost('assignToTown', heroType, tid, onDone);
  }
  function heroUnassign(heroType, opts, onDone) {
    if (!opts || !opts.confirmed) return onDone && onDone('need-confirm');
    const hero = playerHeroesList().find(h => h.type === String(heroType));
    if (!hero) return onDone && onDone('missing');
    if (!hero.assigned && !hero.attacking) return onDone && onDone('not-assigned');
    return heroBridgePost('unassignFromTown', heroType, hero.origin || hero.home, onDone);
  }
  function heroCancelTravel(heroType, opts, onDone) {
    if (!opts || !opts.confirmed) return onDone && onDone('need-confirm');
    const hero = playerHeroesList().find(h => h.type === String(heroType));
    if (!hero) return onDone && onDone('missing');
    if (!hero.traveling) return onDone && onDone('not-traveling');
    return heroBridgePost('cancelTownTravel', heroType, hero.origin || hero.home, onDone);
  }
  function renderMilitaryHelpers(sec, plan) {
    const har = sec && sec.querySelector('.atk-harass');
    if (har) har.querySelectorAll('[data-harass]').forEach(btn => { const on = plan.troopMode === 'harass' && plan.harassPreset === btn.dataset.harass; btn.style.outline = on ? '1px solid #6cf' : ''; });
    const box = sec && sec.querySelector('.atk-cmds');
    if (box) {
      box.replaceChildren();
      const rows = militaryOutgoingMovements();
      if (!rows.length) { const e = document.createElement('div'); e.textContent = 'No explicitly cancelable outgoing movements'; e.style.cssText = 'color:#666;font-size:10px'; box.appendChild(e); }
      else rows.forEach(r => {
        const row = document.createElement('div'); row.style.cssText = 'display:grid;grid-template-columns:1fr .7fr .6fr auto;gap:4px;font-size:10px;border-bottom:1px solid #2a2a2a;padding:2px 0;align-items:center';
        const c1 = document.createElement('span'); c1.textContent = `${townNameById(r.home)} -> ${r.target}`; c1.title = `command ${r.commandId}`;
        const c2 = document.createElement('span'); c2.textContent = r.type || 'move';
        const c3 = document.createElement('span'); c3.textContent = r.cancelLeft != null ? `${Math.round(r.cancelLeft)}s` : 'ok'; c3.style.color = '#888';
        const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Cancel'; b.disabled = !state.cancelTpl; b.title = state.cancelTpl ? 'Cancel this movement' : 'Cancel one movement manually once to learn the canonical action';
        b.addEventListener('click', () => { if (!confirm(`Cancelar ${r.type || 'comando'} ${r.commandId}?`)) return; militaryCancelCommand(r.commandId, { confirmed: true }, err => { flash(err ? 'cancel failed: ' + err : 'command cancelled'); renderAttack(); }); });
        row.append(c1,c2,c3,b); box.appendChild(row);
      });
    }
    const hbox = sec && sec.querySelector('.atk-heroes');
    if (!hbox) return;
    hbox.replaceChildren();
    if (!heroesEnabled()) { const e = document.createElement('div'); e.textContent = 'Heroes disabled on this world'; e.style.cssText = 'color:#666;font-size:10px'; hbox.appendChild(e); return; }
    const heroes = playerHeroesList();
    if (!heroes.length) { const e = document.createElement('div'); e.textContent = 'No readable PlayerHero models'; e.style.cssText = 'color:#666;font-size:10px'; hbox.appendChild(e); return; }
    const townSel = document.createElement('select'); townSel.style.cssText = 'background:#111;color:#cfc;border:1px solid #333;font-size:10px;margin-bottom:4px';
    (state.towns || []).forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name || t.id; townSel.appendChild(o); }); hbox.appendChild(townSel);
    heroes.forEach(h => {
      const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-size:10px;border-bottom:1px solid #2a2a2a;padding:3px 0';
      const lab = document.createElement('span'); lab.style.flex = '1'; lab.textContent = `${h.name} Lv${h.level} | ${h.status}${h.home ? ' @' + townNameById(h.home) : ''}`; row.appendChild(lab);
      const addBtn = (text, action, color, fn) => { const b=document.createElement('button'); b.type='button'; b.textContent=text; b.style.color=color; b.disabled=!(state.heroTpl && state.heroTpl[action]); b.title=b.disabled?`Perform ${action} manually once to learn template`:''; b.addEventListener('click',fn); row.appendChild(b); };
      if (h.traveling) addBtn('Cancel travel','cancelTownTravel','#fc6',()=>{ if(confirm(`Cancelar traslado de ${h.name}?`)) heroCancelTravel(h.type,{confirmed:true},err=>{flash(err?'hero cancel failed: '+err:'hero travel cancelled');renderAttack();}); });
      else if (h.assigned || h.attacking) addBtn('Unassign','unassignFromTown','#f96',()=>{ if(confirm(`Desasignar ${h.name}?`)) heroUnassign(h.type,{confirmed:true},err=>{flash(err?'hero unassign failed: '+err:'hero unassigned');renderAttack();}); });
      if (!h.injured && !h.attacking && !h.traveling) addBtn('Assign','assignToTown','#6cf',()=>{ const tid=townSel.value; if(tid&&confirm(`Asignar ${h.name} -> ${townNameById(tid)}?`)) heroAssignToTown(h.type,tid,{confirmed:true},err=>{flash(err?'hero assign failed: '+err:'hero transfer started');renderAttack();}); });
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
      if (!ok.length) { flash('sin ciudades listas'); renderAttack(); return; }
      if (!confirm(`Armar ${ok.length} ataque(s) (${plan.timingMode})?`)) return;
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
    sec.querySelector('#gb-atk-src-all')?.addEventListener('click', () => attackSetAllSources(true));
    sec.querySelector('#gb-atk-src-none')?.addEventListener('click', () => attackSetAllSources(false));
    sec.querySelector('#gb-atk-src-off')?.addEventListener('click', () => attackSelectRoleSources(ATTACK_ROLE_OFFENSE));
    sec.querySelector('#gb-atk-src-def')?.addEventListener('click', () => attackSelectRoleSources(ATTACK_ROLE_DEFENSE));
    sec.querySelector('[data-atk=pick]')?.addEventListener('change', e => {
      const id = e.target.value; if (!id) return;
      const t = attackKnownTargets().find(x => String(x.id) === String(id));
      if (t) applyAttackTarget(t);
    });
    sec.querySelector('[data-atk=target]')?.addEventListener('change', () => {
      const plan = readAttackForm();
      if (/^\d+$/.test(plan.targetId)) attackRememberTarget(plan.targetId, { x: plan.targetX, y: plan.targetY, src: 'manual-id' });
      renderAttack();
    });
    sec.querySelectorAll('[data-harass]').forEach(btn => btn.addEventListener('click', () => { applyHarassPreset(btn.dataset.harass); renderAttack(); }));
    sec.querySelector('#gb-atk-cmds-refresh')?.addEventListener('click', () => renderAttack());
    sec.querySelector('#gb-atk-heroes-refresh')?.addEventListener('click', () => renderAttack());
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
      detail: state.csrf ? state.csrf.slice(0, 6) + '…' : 'not found (GM_xmlhttpRequest report fetch needs it)',
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
      return { ok: true, detail: `${orders.length} orders, ${free} free now, action ${state.ibAction}` };
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
      const n = info && info.techs ? Object.keys(info.techs).length : 0;
      return { ok: !!info && info.academy >= 0 && n >= 0, warn: !n, detail: info ? `${n} researched-tech flags, academy ${info.academy}` : 'academy techs unreadable' };
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
    out.push(preflightProbe('attack', () => ({
      ok: !!state.attackTpl,
      warn: !state.attackTpl,
      detail: state.attackTpl ? 'template learned' : 'template NOT learned (send one attack by hand)',
    })));
    out.push(preflightProbe('cancel', () => {
      const n = typeof militaryOutgoingMovements === 'function' ? militaryOutgoingMovements().length : 0;
      return { ok: true, warn: !state.cancelTpl, detail: state.cancelTpl ? `template learned; ${n} cancelable` : `template not learned; ${n} cancelable (cancel once manually)` };
    }));
    out.push(preflightProbe('heroes', () => {
      if (!heroesEnabled()) return { ok: true, warn: true, detail: 'heroes disabled on this world' };
      const list = playerHeroesList();
      const acts = state.heroTpl && typeof state.heroTpl === 'object' ? Object.keys(state.heroTpl) : [];
      return { ok: list.length > 0, warn: !list.length || !acts.length, detail: `${list.length} hero(es); learned actions: ${acts.join(',') || 'none'}` };
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
    out.push(preflightProbe('client fingerprint',()=>{const r=clientFingerprintCompatible(state.clientFingerprint,clientFingerprintNow());return{ok:r.ok,detail:r.ok?'compatible':r.why}}));
    out.push(preflightProbe('resource planner',()=>{let ids=[];try{ids=Object.keys((uw.ITowns&&uw.ITowns.towns)||{})}catch(_){};const bad=ids.filter(id=>!plannerSnapshot(id));return{ok:bad.length===0,detail:bad.length?`unreadable towns: ${bad.join(',')}`:`${ids.length} town snapshots`}}));
    out.push(preflightProbe('goal planner',()=>{const plans=goalPlanAll();const bad=plans.filter(p=>p.error);return{ok:bad.length===0,warn:bad.length>0,detail:`${plans.length} plans, ${bad.length} unreadable`}}));
    out.push(preflightProbe('safe mode',()=>({ok:true,warn:!!state.safeMode,detail:state.safeMode?'ON: high-impact writes blocked':'off'})));
    out.push(preflightProbe('guards', () => {
      const locks = gbLockList();
      const paused = Object.keys(state.captchaBreakers || {}).filter(k => captchaPaused(k));
      const parts = [];
      if (state.dryRun) parts.push('DRY-RUN ON (nothing will be sent)');
      if (locks.length) parts.push('locks held: ' + locks.join(','));
      if (paused.length) parts.push('captcha: ' + paused.join(','));
      if (gbServerPaused()) parts.push('server cooldown ' + fmtSec(Math.round(gbServerCooldownLeftMs() / 1000)));
      const skips = jrnActiveSkips();
      if (skips.length) parts.push(skips.length + ' memory skip windows');
      const openCircuits = Object.keys(state.circuits || {}).filter(k => state.circuits[k] && state.circuits[k].open);
      const unknownTx = Object.values(state.txState || {}).filter(t => t && /^(unknown|manual-review)$/.test(t.state || '')).length;
      if (openCircuits.length) parts.push('OPEN circuits: ' + openCircuits.join(','));
      if (unknownTx) parts.push(unknownTx + ' UNKNOWN transaction(s) require reconciliation/review');
      return { ok: openCircuits.length === 0 && unknownTx === 0, warn: parts.length > 0, detail: parts.length ? parts.join(' | ') : 'clear' };
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
    lines.push(`ventana ${statsWindow} | ${st.total} decisiones | ${st.attempts} intentos | exito ${st.successPct == null ? '-' : st.successPct + '%'}`);
    lines.push(`ok ${st.ok}  err ${st.err}  captcha ${st.captcha}  timeout ${st.timeout}  pendiente ${st.pending}  saltadas ${st.skip}${st.dry ? ` (simulacion ${st.dry})` : ''}`);
    const claims = jrnCountOk('farm', /claim/i, STATS_WINDOWS[statsWindow] || 86400000);
    const builds = jrnCountOk('build', /Instant|instant/i, STATS_WINDOWS[statsWindow] || 86400000)
      + jrnCountOk('instant-build', null, STATS_WINDOWS[statsWindow] || 86400000);
    lines.push(`reclamos de granjas ${claims} | completados inst. ${builds}`);
    lines.push('');
    lines.push('feature      ok   err  tout  pend  cap  skip   rate');
    const feats = Object.keys(st.byFeature).sort();
    if (!feats.length) lines.push('  (sin decisiones en esta ventana)');
    feats.forEach(f => {
      const v = st.byFeature[f];
      const att = v.ok + v.err + v.captcha + v.timeout;
      lines.push(
        f.padEnd(12).slice(0, 12) +
        String(v.ok).padStart(4) +
        String(v.err).padStart(6) +
        String(v.timeout).padStart(6) +
        String(v.pending).padStart(6) +
        String(v.captcha).padStart(5) +
        String(v.skip).padStart(6) +
        statsPct(v.ok, att).padStart(7));
    });
    if (st.topErrors.length) {
      lines.push('');
      lines.push('errores principales');
      st.topErrors.forEach(([k, n]) => lines.push(`  ${n}x ${k}`));
    }
    if (st.topPending.length) {
      lines.push('');
      lines.push('estados de tx pendientes (no son errores)');
      st.topPending.forEach(([k, n]) => lines.push(`  ${n}x ${k}`));
    }
    if (st.topSkips.length) {
      lines.push('');
      lines.push('razones principales de salto');
      st.topSkips.forEach(([k, n]) => lines.push(`  ${n}x ${k}`));
    }
    lines.push('');
    lines.push('planificador (cadencia con adaptativa por inactividad)');
    orchStatus().filter(s => s.on).forEach(s => {
      lines.push(`  ${s.key.padEnd(11)} cada ${fmtSec(Math.round(s.cadenceMs / 1000)).padEnd(6)} proxima ${fmtSec(Math.round(s.dueInMs / 1000)).padEnd(6)}${s.idle ? ' inact. x' + s.idle : ''}${s.captcha ? ' CAPTCHA' : ''}`);
    });
    const locks = gbLockList();
    lines.push('');
    lines.push(`peticiones ultimo min ${reqBudgetUsed()}/${state.reqBudgetPerMin || 40}` +
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
      flash('evidencia copiada');
      gbLog('evidence: copied ' + text.length + ' chars');
    };
    const fail = () => {
      console.groupCollapsed('[grepbot] evidence');
      console.log(text);
      console.groupEnd();
      flash('evidencia en la consola');
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

  let gbQueueCenter = null;
  let gbQueueCenterTab = 'build';
  let gbQueueCenterTown = null;
  let gbQueueCenterDrag = null;

  function queueCenterTownIds() {
    let ids = [];
    try { ids = Object.keys((gameUw().ITowns && gameUw().ITowns.towns) || {}); } catch (_) {}
    if (!ids.length) ids = (state.towns || []).map(t => String(t.id));
    return ids.map(String);
  }
  function queueCenterTownName(id) {
    try {
      const t = (state.towns || []).find(x => String(x.id) === String(id));
      if (t && t.name) return t.name;
      const gt = gbTownModel(id);
      const a = gt && (gt.attributes || gt);
      if (a && a.name) return String(a.name);
    } catch (_) {}
    return String(id || '?');
  }
  function queueCenterUnitIsNaval(unit) {
    try { const d = recruitUnitDef(unit) || {}; return !!(d.is_naval || d.naval); } catch (_) { return false; }
  }
  function queueCenterUnitId(model) {
    const a = (model && model.attributes) || model || {};
    return String(a.unit_type || a.unit_id || a.type || '?');
  }
  function queueCenterUnitAmount(model) {
    const a = (model && model.attributes) || model || {};
    return +(a.count != null ? a.count : (a.amount != null ? a.amount : a.units)) || 0;
  }
  function queueCenterTimeLeft(model) {
    const a = (model && model.attributes) || model || {};
    const now = gameNow();
    const done = +(a.to_be_completed_at || a.completed_at || a.done_at || a.time_finished || 0);
    if (done > 0) return Math.max(0, done - now);
    const left = +(a.time_left || a.remaining_time || a.recruitment_time || a.research_time || a.building_time || 0);
    return left > 0 ? left : null;
  }
  function queueCenterFmt(sec) {
    if (sec == null || !Number.isFinite(+sec)) return '';
    sec = Math.max(0, Math.floor(+sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), ss = sec % 60;
    return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(ss).padStart(2, '0')}s`;
  }

  function queueCenterButton(txt, title, fn, cls) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.title = title || ''; b.className = 'gb-qc-btn' + (cls ? ' ' + cls : '');
    b.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      if (!gbInstanceAlive()) return;
      if (!gbTabLeader) { flash('GrepBot está activo en otra pestaña'); return; }
      const r = fn && fn(e);
      if (r !== false) renderQueueCenter();
    });
    return b;
  }
  function queueCenterStatusBadge(status, reason) {
    const s = document.createElement('span'); s.className = 'gb-qc-status ' + String(status || 'pending').replace(/[^a-z-]/gi, '');
    const map = { pending: 'pendiente', ready: 'listo', sending: 'enviando', paused: 'pausada', blocked: 'bloqueada', unknown: 'revisar', 'waiting-resources': 'recursos', 'waiting-population': 'población', 'waiting-queue': 'cola llena', 'waiting-requirement': 'requisito' };
    s.textContent = map[status] || status || 'pendiente'; if (reason) s.title = reason; return s;
  }
  function queueCenterCard(title, subtitle) {
    const box = document.createElement('div'); box.className = 'gb-qc-card';
    const h = document.createElement('div'); h.className = 'gb-qc-card-head';
    const left = document.createElement('div'); const b = document.createElement('b'); b.textContent = title; left.appendChild(b);
    if (subtitle) { const sm = document.createElement('small'); sm.textContent = subtitle; left.appendChild(sm); }
    h.appendChild(left); box.appendChild(h); return { box, head: h };
  }
  function queueCenterEmpty(text) { const d = document.createElement('div'); d.className = 'gb-qc-empty'; d.textContent = text; return d; }
  function queueCenterSequence(title, entries) {
    const wrap = document.createElement('div'); wrap.className = 'gb-qc-sequence';
    const lab = document.createElement('b'); lab.className = 'gb-qc-sequence-title'; lab.textContent = title; wrap.appendChild(lab);
    const line = document.createElement('div'); line.className = 'gb-qc-sequence-line';
    (entries || []).forEach((e, i) => {
      if (i) { const arrow = document.createElement('span'); arrow.className = 'gb-qc-sequence-arrow'; arrow.textContent = '>'; line.appendChild(arrow); }
      const chip = document.createElement('span'); chip.className = 'gb-qc-sequence-chip'; chip.textContent = String(e && e.text != null ? e.text : e || '');
      if (e && e.title) chip.title = e.title; line.appendChild(chip);
    });
    wrap.appendChild(line); return wrap;
  }

  function queueCenterRemove(townId, lane, job, frozen) {
    if (job.inflight) { flash('Esta orden se está enviando; espera a que termine'); return false; }
    if (job.manualReview) {
      let ok = false;
      try { ok = gameUw().confirm('Comprueba primero la cola real. Borrar este elemento confirma que asumes si la acción se envió o no.'); } catch (_) { ok = false; }
      if (!ok) return false;
    } else if (frozen) {
      let ok = false;
      try { ok = gameUw().confirm('Hay otra acción pendiente en esta cola. ¿Borrar este elemento de todos modos?'); } catch (_) { ok = false; }
      if (!ok) return false;
    }
    return nativeQueueRemove(townId, lane, job.id, { force: true });
  }

  function renderQueueCenterBuild(body, townId) {
    const q = abQueueInfo(townId);
    const live = queueCenterCard('Cola real de construcción', q.known ? `${q.len}/${q.max}` : 'estado no legible');
    body.appendChild(live.box);
    if (q.known && q.orders.length) {
      q.orders.forEach((o, i) => {
        const r = document.createElement('div'); r.className = 'gb-qc-live-row';
        const n = document.createElement('span'); n.textContent = `#${i + 1}`;
        const nm = document.createElement('b'); nm.textContent = nativeBuildLabel(o.building_type);
        const t = document.createElement('span');
        const left = o.to_be_completed_at ? Math.max(0, +o.to_be_completed_at - gameNow()) : o.building_time;
        t.textContent = queueCenterFmt(left);
        r.append(n, nm, t); live.box.appendChild(r);
      });
    } else live.box.appendChild(queueCenterEmpty(q.known ? 'Sin construcciones reales' : 'No se puede leer la cola real'));

    const list = nativeQueueList(townId, 'build', false), fifo = nativeQueueIsFifo(townId, 'build'), paused = nativeQueuePaused(townId, 'build');
    const plan = queueCenterCard('Plan GrepBot · Construcción', fifo ? (paused ? 'FIFO pausada' : 'FIFO activa') : 'Objetivos automáticos');
    body.appendChild(plan.box);
    plan.head.appendChild(queueCenterButton(paused ? '> Reanudar' : '|| Pausar', paused ? 'Reanudar cola' : 'Pausar cola', () => nativeQueueTogglePaused(townId, 'build')));
    if (!list.length && fifo) plan.head.appendChild(queueCenterButton('Objetivos', 'Volver al planificador automático', () => nativeQueueUseLegacy(townId, 'build')));
    if (!list.length) { plan.box.appendChild(queueCenterEmpty(fifo ? 'Cola FIFO vacía. Añade edificios con + desde el Senado.' : 'Esta ciudad usa el planificador de objetivos.')); return; }
    plan.box.appendChild(queueCenterSequence('Orden FIFO', list.map((j, i) => ({
      text: `#${i + 1} ${nativeBuildLabel(j.building)}`,
      title: `${nativeBuildLabel(j.building)} ${j.fromLevel}→${j.toLevel}${j.reason ? ' · ' + j.reason : ''}`,
    }))));
    const frozen = list.some(j => j && (j.inflight || j.manualReview));
    list.forEach((j, i) => {
      const r = document.createElement('div'); r.className = 'gb-qc-job';
      const num = document.createElement('b'); num.textContent = `#${i + 1}`;
      const desc = document.createElement('div'); desc.className = 'gb-qc-job-desc';
      const main = document.createElement('span'); main.textContent = `${nativeBuildLabel(j.building)} ${j.fromLevel}→${j.toLevel}`;
      desc.append(main, queueCenterStatusBadge(j.status, j.reason));
      const acts = document.createElement('div'); acts.className = 'gb-qc-acts';
      const up = queueCenterButton('↑', 'Subir', () => nativeQueueMove(townId, 'build', j.id, -1));
      const dn = queueCenterButton('↓', 'Bajar', () => nativeQueueMove(townId, 'build', j.id, 1));
      const del = queueCenterButton('×', 'Eliminar', () => queueCenterRemove(townId, 'build', j, frozen), 'danger');
      up.disabled = frozen || i === 0;
      dn.disabled = frozen || i === list.length - 1;
      del.disabled = !!j.inflight;
      acts.append(up, dn, del); r.append(num, desc, acts); plan.box.appendChild(r);
    });
  }

  function renderQueueCenterResearch(body, townId) {
    const info = researchTownTechs(townId); const orders = (info && info.orders) || [];
    const live = queueCenterCard('Cola real de investigación', info ? `${orders.length}/2 · Academia ${info.academy || 0}` : 'estado no legible');
    body.appendChild(live.box);
    if (orders.length) {
      orders.forEach((o, i) => {
        const id = researchOrderTechId(o);
        const r = document.createElement('div'); r.className = 'gb-qc-live-row';
        const n = document.createElement('span'); n.textContent = `#${i + 1}`;
        const nm = document.createElement('b'); nm.textContent = researchLabel(id) || String(id || '?');
        const t = document.createElement('span'); t.textContent = queueCenterFmt(queueCenterTimeLeft(o));
        r.append(n, nm, t); live.box.appendChild(r);
      });
    } else live.box.appendChild(queueCenterEmpty(info ? 'Sin investigaciones en curso' : 'No se puede leer la Academia'));

    const targets = goalEffectiveResearchTargets(townId, researchEnsureTargets());
    const planned = queueCenterCard('Próximas investigaciones', 'orden del planificador');
    body.appendChild(planned.box);
    let shown = 0;
    Object.keys(targets).sort((a, b) => (+targets[a].order || 0) - (+targets[b].order || 0)).forEach(id => {
      const t = targets[id];
      if (!t || !t.tgt) return;
      if (info && info.techs && info.techs[id]) return;
      if (orders.some(o => String(researchOrderTechId(o)) === String(id))) return;
      shown++;
      const r = document.createElement('div'); r.className = 'gb-qc-plan-row';
      const n = document.createElement('span'); n.textContent = `#${shown}`;
      const nm = document.createElement('b'); nm.textContent = researchLabel(id) || id;
      let st = 'pendiente';
      try {
        const dep = researchDepsOk(townId, info, id), aff = dep && researchCanAfford(townId, id, info);
        st = !dep ? 'requisito' : (aff && aff.ok ? 'listo' : (aff && aff.why) || 'esperando');
      } catch (_) {}
      const badge = document.createElement('span'); badge.className = 'gb-qc-muted'; badge.textContent = st;
      r.append(n, nm, badge); planned.box.appendChild(r);
    });
    if (!shown) planned.box.appendChild(queueCenterEmpty('No hay investigaciones pendientes en el plan.'));
  }

  function renderQueueCenterRecruit(body, townId, wantNaval) {
    const label = wantNaval ? 'Puerto' : 'Cuartel';
    const q = recruitQueueInfo(townId);
    const liveModels = (q.models || []).filter(m => queueCenterUnitIsNaval(queueCenterUnitId(m)) === wantNaval);
    const live = queueCenterCard(`Cola real · ${label}`, q.known ? `${liveModels.length}${q.max != null ? ' / ' + q.max : ''}` : 'estado no legible');
    body.appendChild(live.box);
    if (liveModels.length) {
      liveModels.forEach((m, i) => {
        const id = queueCenterUnitId(m);
        const r = document.createElement('div'); r.className = 'gb-qc-live-row';
        const n = document.createElement('span'); n.textContent = `#${i + 1}`;
        const nm = document.createElement('b'); nm.textContent = `${queueCenterUnitAmount(m)}× ${nativeUnitLabel(id)}`;
        const t = document.createElement('span'); t.textContent = queueCenterFmt(queueCenterTimeLeft(m));
        r.append(n, nm, t); live.box.appendChild(r);
      });
    } else live.box.appendChild(queueCenterEmpty(q.known ? `Sin órdenes en ${label.toLowerCase()}` : 'No se puede leer la cola real'));

    const all = nativeQueueList(townId, 'recruit', false);
    const list = all.filter(j => j && queueCenterUnitIsNaval(j.unit) === wantNaval);
    const fifo = nativeQueueIsFifo(townId, 'recruit'), paused = nativeQueuePaused(townId, 'recruit');
    const plan = queueCenterCard(`Plan GrepBot · ${label}`, fifo ? (paused ? 'FIFO pausada · prioridad global Cuartel/Puerto' : 'FIFO activa · prioridad global Cuartel/Puerto') : 'Objetivos automáticos');
    body.appendChild(plan.box);
    plan.head.appendChild(queueCenterButton(paused ? '> Reanudar' : '|| Pausar', paused ? 'Reanudar unidades' : 'Pausar unidades', () => nativeQueueTogglePaused(townId, 'recruit')));
    if (!all.length && fifo) plan.head.appendChild(queueCenterButton('Objetivos', 'Volver al planificador automático', () => nativeQueueUseLegacy(townId, 'recruit')));
    if (!list.length) { plan.box.appendChild(queueCenterEmpty(fifo ? `No hay órdenes ${wantNaval ? 'navales' : 'terrestres'} pendientes. Añádelas con + desde ${label}.` : 'Esta ciudad usa objetivos automáticos.')); return; }
    plan.box.appendChild(queueCenterSequence('Orden FIFO global', all.map((j, i) => ({
      text: `#${i + 1} ${j.amount}× ${nativeUnitLabel(j.unit)}`,
      title: queueCenterUnitIsNaval(j.unit) ? 'Puerto' : 'Cuartel',
    }))));
    const frozen = all.some(j => j && (j.inflight || j.manualReview));
    list.forEach(j => {
      const gi = all.indexOf(j);
      const r = document.createElement('div'); r.className = 'gb-qc-job';
      const num = document.createElement('b'); num.textContent = `#${gi + 1}`; num.title = 'posición en la cola global de unidades';
      const desc = document.createElement('div'); desc.className = 'gb-qc-job-desc';
      const main = document.createElement('span'); main.textContent = `${j.amount}× ${nativeUnitLabel(j.unit)}`;
      desc.append(main, queueCenterStatusBadge(j.status, j.reason));
      const acts = document.createElement('div'); acts.className = 'gb-qc-acts';
      const up = queueCenterButton('↑', 'Subir en la cola global', () => nativeQueueMove(townId, 'recruit', j.id, -1));
      const dn = queueCenterButton('↓', 'Bajar en la cola global', () => nativeQueueMove(townId, 'recruit', j.id, 1));
      const del = queueCenterButton('×', 'Eliminar', () => queueCenterRemove(townId, 'recruit', j, frozen), 'danger');
      up.disabled = frozen || gi === 0;
      dn.disabled = frozen || gi === all.length - 1;
      del.disabled = !!j.inflight;
      acts.append(up, dn, del); r.append(num, desc, acts); plan.box.appendChild(r);
    });
  }

  function renderQueueCenter() {
    const w = gbQueueCenter;
    if (!w || !document.body.contains(w)) return;
    if (w.style.display === 'none') return;
    const ids = queueCenterTownIds();
    if (!ids.length) return;
    if (!gbQueueCenterTown || !ids.includes(String(gbQueueCenterTown))) {
      let cur = null;
      try { cur = gameUw().Game && gameUw().Game.townId; } catch (_) {}
      gbQueueCenterTown = String(cur || ids[0]);
    }
    const sel = w.querySelector('.gb-qc-town'); sel.replaceChildren();
    ids.forEach(id => {
      const o = document.createElement('option'); o.value = id; o.textContent = queueCenterTownName(id);
      if (id === String(gbQueueCenterTown)) o.selected = true;
      sel.appendChild(o);
    });
    w.querySelectorAll('.gb-qc-tab').forEach(b => b.classList.toggle('on', b.dataset.qtab === gbQueueCenterTab));
    const body = w.querySelector('.gb-qc-body'); body.replaceChildren();
    if (gbQueueCenterTab === 'build') renderQueueCenterBuild(body, gbQueueCenterTown);
    else if (gbQueueCenterTab === 'research') renderQueueCenterResearch(body, gbQueueCenterTown);
    else if (gbQueueCenterTab === 'barracks') renderQueueCenterRecruit(body, gbQueueCenterTown, false);
    else renderQueueCenterRecruit(body, gbQueueCenterTown, true);
  }

  function openQueueCenter(tab, townId) {
    if (tab) gbQueueCenterTab = tab;
    if (townId != null) gbQueueCenterTown = String(townId);
    if (!gbQueueCenter) {
      const w = document.createElement('div');
      w.id = 'grepbot-queue-center';
      w.innerHTML = `<header><b>Colas GrepBot</b><select class="gb-qc-town" title="Ciudad que estás gestionando"></select><span class="gb-qc-spacer"></span><button class="gb-qc-refresh" title="Actualizar">↻</button><button class="gb-qc-close" title="Cerrar">×</button></header><nav><button class="gb-qc-tab" data-qtab="build">Construcción</button><button class="gb-qc-tab" data-qtab="research">Investigación</button><button class="gb-qc-tab" data-qtab="barracks">Cuartel</button><button class="gb-qc-tab" data-qtab="docks">Puerto</button></nav><div class="gb-qc-body"></div>`;
      document.body.appendChild(w);
      gbQueueCenter = w;
      w.querySelector('.gb-qc-close').addEventListener('click', () => { w.style.display = 'none'; });
      w.querySelector('.gb-qc-refresh').addEventListener('click', renderQueueCenter);
      w.querySelector('.gb-qc-town').addEventListener('change', e => { gbQueueCenterTown = e.target.value; renderQueueCenter(); });
      w.querySelectorAll('.gb-qc-tab').forEach(b => b.addEventListener('click', () => { gbQueueCenterTab = b.dataset.qtab; renderQueueCenter(); }));

      const h = w.querySelector('header');
      h.addEventListener('mousedown', e => {
        if (e.target.closest('button,select')) return;
        const r = w.getBoundingClientRect();
        gbQueueCenterDrag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
        e.preventDefault();
      });
      const move = e => {
        if (!gbQueueCenterDrag) return;
        w.style.left = Math.max(0, Math.min(innerWidth - w.offsetWidth, e.clientX - gbQueueCenterDrag.dx)) + 'px';
        w.style.top = Math.max(0, Math.min(innerHeight - w.offsetHeight, e.clientY - gbQueueCenterDrag.dy)) + 'px';
        w.style.right = 'auto';
      };
      const up = () => { gbQueueCenterDrag = null; };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
      gbListenerBag.push({ target: document, type: 'mousemove', fn: move, opts: undefined }, { target: document, type: 'mouseup', fn: up, opts: undefined });
    }
    gbQueueCenter.style.display = 'flex';
    renderQueueCenter();
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
    { id: 'home', label: 'Inicio', tabs: [
      { id: 'overview', label: 'Resumen' },
    ]},
    { id: 'economy', label: 'Economía', tabs: [
      { id: 'world', label: 'Ciudades' },
      { id: 'farms', label: 'Aldeas' },
      { id: 'build', label: 'Construcción' },
      { id: 'quests', label: 'Misiones' },
    ]},
    { id: 'military', label: 'Militar', tabs: [
      { id: 'attack', label: 'Ataques' },
      { id: 'intel', label: 'Inteligencia' },
    ]},
    { id: 'data', label: 'Datos', tabs: [
      { id: 'findings', label: 'Hallazgos' },
    ]},
    { id: 'system', label: 'Sistema', tabs: [
      { id: 'config', label: 'Ajustes' },
      { id: 'stats', label: 'Diagnóstico' },
      { id: 'log', label: 'Registro' },
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
    flash('panel restablecido');
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
    if (!TAB_IDS.includes(tabId)) tabId = 'overview';
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
    #grepbot-panel{position:fixed;top:10px;right:10px;width:560px;min-width:430px;max-width:92vw;max-height:82vh;z-index:2147483647;
      background:#181a1f;color:#eef1f5;font:12px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif,"Segoe UI Symbol","Noto Sans Symbols 2","DejaVu Sans";border:1px solid #414650;border-radius:10px;
      box-shadow:0 4px 16px rgba(0,0,0,.5);display:flex;flex-direction:column;visibility:visible !important;opacity:1 !important;
      box-sizing:border-box;}
    #grepbot-panel header{padding:8px 10px;background:#22252b;cursor:move;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-shrink:0;border-radius:10px 10px 0 0}
    #grepbot-panel header b{color:#f5a623;font-weight:600}
    #grepbot-panel header button{background:none;border:1px solid #555;color:#eee;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:11px}
    #grepbot-panel .gb-nav{display:flex;gap:4px;padding:7px 8px 5px;background:#202329;flex-shrink:0;border-bottom:1px solid #353a44;overflow-x:auto}
    #grepbot-panel .gb-nav button{flex:0 0 auto;padding:5px 10px;background:#292d35;border:1px solid transparent;border-radius:7px;color:#aeb5c0;cursor:pointer;font:600 11px system-ui,-apple-system,Segoe UI,sans-serif}
    #grepbot-panel .gb-nav button:hover{color:#ccc}
    #grepbot-panel .gb-nav button.on{color:#fff;background:#3a321f;border-color:#c98b22}
    #grepbot-panel .gb-subtabs{display:flex;gap:4px;padding:5px 8px;background:#17191e;border-bottom:1px solid #353a44;flex-shrink:0;overflow-x:auto}
    #grepbot-panel .gb-subtabs button{flex:0 0 auto;padding:4px 9px;background:transparent;border:1px solid transparent;border-radius:6px;color:#9fa7b3;cursor:pointer;font:11px system-ui,-apple-system,Segoe UI,sans-serif;white-space:nowrap}
    #grepbot-panel .gb-subtabs button:hover{color:#eee;border-color:#555}
    #grepbot-panel .gb-subtabs button.on{background:#2b3038;color:#fff;border-color:#59616f}
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
    #grepbot-panel .atk-sched{max-height:160px;overflow:auto;margin-top:6px}
    #grepbot-panel .atk-sources{max-height:80px;overflow:auto;display:flex;flex-wrap:wrap;gap:4px 8px;margin:4px 0}
    #grepbot-panel .atk-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:4px}
    #grepbot-panel .atk-row input,#grepbot-panel .atk-row select{background:#111;color:#cfc;border:1px solid #333;padding:2px 4px;font:11px monospace}
    #grepbot-panel .atk-btns button{background:#333;border:1px solid #555;color:#eee;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:11px;margin-right:4px}
    #grepbot-panel .atk-btns #gb-atk-now{color:#f96}
    #grepbot-panel .atk-btns #gb-atk-arm{color:#6cf}
    #grepbot-panel .atk-harass button,#grepbot-panel .atk-roles button,#grepbot-panel #gb-atk-src-all,#grepbot-panel #gb-atk-src-none,#grepbot-panel #gb-atk-src-off,#grepbot-panel #gb-atk-src-def,#grepbot-panel #gb-atk-cmds-refresh,#grepbot-panel #gb-atk-heroes-refresh,#grepbot-panel .atk-cmds button,#grepbot-panel .atk-heroes button{background:#333;border:1px solid #555;color:#eee;padding:1px 6px;cursor:pointer;font-size:10px}
    #grepbot-panel .atk-cmds button:disabled,#grepbot-panel .atk-heroes button:disabled{opacity:.45;cursor:not-allowed}
    #grepbot-panel .quest-list{max-height:200px;overflow:auto;font-size:10px}
    #grepbot-panel .quest-row{display:grid;grid-template-columns:1.4fr .5fr 1fr .6fr;gap:4px;border-bottom:1px solid #2a2a2a;padding:3px 0}
    #grepbot-panel .quest-hist{max-height:100px;overflow:auto;font-size:9px;color:#9d9;margin-top:6px;background:#111;padding:4px;border:1px solid #333;white-space:pre-wrap}
    #grepbot-panel .gb-head-main{display:flex;align-items:center;gap:8px;min-width:0}
    #grepbot-panel .gb-head-status{display:flex;gap:4px;align-items:center;flex-wrap:wrap}
    #grepbot-panel .gb-pill{padding:2px 6px;border-radius:999px;font-size:9px;font-weight:700;border:1px solid #444;background:#2b3038;color:#cbd1da}
    #grepbot-panel .gb-pill.ok{border-color:#3c7350;color:#8fe0a8;background:#1c3023}
    #grepbot-panel .gb-pill.warn{border-color:#8a6725;color:#ffd27a;background:#382e1c}
    #grepbot-panel .gb-pill.bad{border-color:#8a3b42;color:#ff9aa3;background:#381f23}
    #grepbot-panel .gb-dashboard-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:6px 0 8px}
    #grepbot-panel .gb-card{background:#22262d;border:1px solid #353b45;border-radius:8px;padding:7px;min-width:0}
    #grepbot-panel .gb-card .k{font-size:9px;color:#8f98a5;text-transform:uppercase;letter-spacing:.04em}
    #grepbot-panel .gb-card .v{font-size:17px;font-weight:700;color:#f5f7fa;line-height:1.2;margin-top:2px}
    #grepbot-panel .gb-card .s{font-size:9px;color:#9ca5b2;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #grepbot-panel .gb-quick{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0 8px}
    #grepbot-panel .gb-quick button,#grepbot-panel .gb-action{background:#2b3038;border:1px solid #4a515d;color:#eef1f5;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:10px}
    #grepbot-panel .gb-quick button:hover,#grepbot-panel .gb-action:hover{border-color:#c98b22}
    #grepbot-panel .gb-section{margin:7px 0;border:1px solid #343943;border-radius:8px;background:#1c1f25;overflow:hidden}
    #grepbot-panel .gb-section>summary{cursor:pointer;list-style:none;padding:7px 9px;font-size:11px;font-weight:700;color:#e8ebef;background:#22262d;display:flex;align-items:center;justify-content:space-between}
    #grepbot-panel .gb-section>summary::-webkit-details-marker{display:none}
    #grepbot-panel .gb-section>summary::after{content:'+';color:#8f98a5;font-size:14px}
    #grepbot-panel .gb-section[open]>summary::after{content:'-'}
    #grepbot-panel .gb-section-body{padding:7px}
    #grepbot-panel pre{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
    @media (max-width:700px){#grepbot-panel{width:94vw;min-width:320px;right:3vw}.gb-dashboard-cards{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
    #grepbot-queue-center{position:fixed;top:90px;left:90px;width:760px;height:560px;min-width:520px;min-height:320px;max-width:94vw;max-height:88vh;z-index:2147483646;background:#17191e;color:#eef1f5;border:1px solid #4a505b;border-radius:10px;box-shadow:0 10px 32px rgba(0,0,0,.6);display:flex;flex-direction:column;resize:both;overflow:hidden;font:12px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
    #grepbot-queue-center header{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#24272e;border-bottom:1px solid #3d424c;cursor:move;flex-shrink:0}
    #grepbot-queue-center header b{color:#f5a623;font-size:13px}#grepbot-queue-center .gb-qc-spacer{flex:1}
    #grepbot-queue-center header select{max-width:210px;background:#11141a;color:#eef1f5;border:1px solid #4b5260;border-radius:5px;padding:4px 7px}
    #grepbot-queue-center header button,#grepbot-queue-center .gb-qc-btn{background:#2d323b;color:#e9edf2;border:1px solid #4f5764;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:11px}
    #grepbot-queue-center header button:hover,#grepbot-queue-center .gb-qc-btn:hover{background:#39404b;border-color:#707a89}#grepbot-queue-center button:disabled{opacity:.35;cursor:default}
    #grepbot-queue-center nav{display:flex;gap:5px;padding:7px 9px;background:#1d2026;border-bottom:1px solid #353a44;flex-shrink:0}
    #grepbot-queue-center .gb-qc-tab{padding:6px 12px;background:#272b33;color:#aeb5c0;border:1px solid transparent;border-radius:7px;cursor:pointer;font-weight:600}
    #grepbot-queue-center .gb-qc-tab.on{background:#3a321f;color:#fff;border-color:#c98b22}
    #grepbot-queue-center .gb-qc-body{padding:10px;flex:1 1 0;min-height:0;height:0;overflow-y:scroll;overflow-x:hidden;scrollbar-gutter:stable;scrollbar-width:auto;scrollbar-color:#5f6978 #17191e;overscroll-behavior:contain;display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:max-content;gap:10px;align-content:start}
    #grepbot-queue-center .gb-qc-body::-webkit-scrollbar{width:10px}
    #grepbot-queue-center .gb-qc-body::-webkit-scrollbar-track{background:#17191e;border-left:1px solid #2e333c}
    #grepbot-queue-center .gb-qc-body::-webkit-scrollbar-thumb{background:#4f5764;border:2px solid #17191e;border-radius:8px}
    #grepbot-queue-center .gb-qc-body::-webkit-scrollbar-thumb:hover{background:#6a7484}
    #grepbot-queue-center .gb-qc-card{background:#20232a;border:1px solid #383e48;border-radius:8px;overflow:hidden;min-width:0;align-self:start;height:max-content}
    #grepbot-queue-center .gb-qc-card-head{display:flex;gap:8px;align-items:center;padding:8px 9px;background:#272b33;border-bottom:1px solid #383e48}#grepbot-queue-center .gb-qc-card-head>div:first-child{display:flex;flex-direction:column;flex:1;min-width:0}#grepbot-queue-center .gb-qc-card-head small{color:#89919d;font-size:10px}
    #grepbot-queue-center .gb-qc-live-row,#grepbot-queue-center .gb-qc-plan-row,#grepbot-queue-center .gb-qc-job{display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px 9px;border-top:1px solid rgba(255,255,255,.05)}
    #grepbot-queue-center .gb-qc-job-desc{display:flex;flex-direction:column;min-width:0}.gb-qc-job-desc>span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #grepbot-queue-center .gb-qc-acts{display:flex;gap:3px}.gb-qc-btn.danger{color:#ffb0a8}.gb-qc-empty{padding:16px 10px;color:#828a95;text-align:center}
    #grepbot-queue-center .gb-qc-sequence{padding:8px 9px 9px;border-top:1px solid rgba(255,255,255,.05);background:#1b1e24}
    #grepbot-queue-center .gb-qc-sequence-title{display:block;margin-bottom:6px;color:#f5c36a;font-size:10px;text-transform:uppercase;letter-spacing:.35px}
    #grepbot-queue-center .gb-qc-sequence-line{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
    #grepbot-queue-center .gb-qc-sequence-chip{padding:3px 6px;border-radius:5px;background:#2b3038;border:1px solid #454c58;color:#eef1f5;font-size:10px;white-space:nowrap}
    #grepbot-queue-center .gb-qc-sequence-arrow{color:#757f8c;font-weight:bold}
    #grepbot-queue-center .gb-qc-status{font-size:9px;color:#aab2bd}.gb-qc-status.ready{color:#7ddd96}.gb-qc-status.blocked,.gb-qc-status.unknown{color:#ff9e94}.gb-qc-status.paused{color:#ffd27a}.gb-qc-status.waiting-resources,.gb-qc-status.waiting-population,.gb-qc-status.waiting-queue,.gb-qc-status.waiting-requirement{color:#e5bf70}.gb-qc-muted{color:#929aa5;font-size:10px}
    @media(max-width:760px){#grepbot-queue-center{left:2vw!important;top:4vh!important;width:96vw!important;height:80vh!important}#grepbot-queue-center .gb-qc-body{grid-template-columns:1fr}}
  `);

  panel = document.createElement('div');
  panel.id = 'grepbot-panel';

  document.querySelectorAll('#grepbot-panel').forEach(p => { try { p.remove(); } catch (_) {} });
  panel.style.zIndex = '2147483647';
  panel.innerHTML = `
    <header><div class="gb-head-main"><b>GrepBot v${runningVersion()}</b><div class="gb-head-status"><span id="gb-head-mode" class="gb-pill">...</span><span id="gb-head-health" class="gb-pill">...</span></div></div><div style="display:flex;gap:4px"><button data-act="queues" title="Abrir centro de colas">Colas</button><button data-act="toggle" title="Minimizar">_</button></div></header>
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
        <label>target <input data-atk="target" style="width:70px" placeholder="town id"/></label>
        <select data-atk="target-type" title="Generic sender only supports canonical town targets"><option value="town">ciudad</option></select>
        <select data-atk="pick" title="Known town targets from reports/history" style="max-width:150px"></select>
        <label>x <input data-atk="x" style="width:40px"/></label>
        <label>y <input data-atk="y" style="width:40px"/></label>
        <select data-atk="mission"><option value="attack">ataque</option><option value="support">apoyo</option><option value="revolt">revolt</option></select>
      </div>
      <div id="gb-atk-target-hint" style="font-size:9px;color:#888;margin:-2px 0 4px"></div>
      <div class="atk-row">
        <select data-atk="timing"><option value="send_now">enviar ya</option><option value="arrive_at">llegar a las</option></select>
        <input data-atk="arrival" type="datetime-local" step="1" title="arrival (local)"/>
        <label>pad ms <input data-atk="pad" type="number" style="width:50px" value="200"/></label>
      </div>
      <div class="atk-row">
        <select data-atk="troop">
          <option value="offense">ofensiva</option>
          <option value="defense">defensa</option>
          <option value="all">todas las tropas</option>
          <option value="all_of_type">todo el tipo</option>
          <option value="harass">acosar</option>
          <option value="per_town">editar por ciudad</option>
        </select>
        <label style="display:flex;align-items:center;gap:3px">unit
          <select data-atk="unit-type" title="only used when troop mode is 'all of type'"></select>
        </label>
      </div>
      <div class="atk-harass" style="display:flex;gap:4px;flex-wrap:wrap;margin:4px 0">
        <span style="font-size:9px;color:#888;align-self:center">acosar</span>
        <button type="button" data-harass="1sling">1 honda</button>
        <button type="button" data-harass="5sling">5 hondas</button>
        <button type="button" data-harass="light">&le;8 ligeras</button>
      </div>
      <div style="font-size:9px;color:#888;margin-top:2px">roles de ciudad (guardado por mundo)</div>
      <div class="atk-roles"></div>
      <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-top:4px">
        <span style="font-size:9px;color:#888">atacar desde</span>
        <button type="button" id="gb-atk-src-all">Todo</button>
        <button type="button" id="gb-atk-src-none">Ninguno</button>
        <button type="button" id="gb-atk-src-off">Ofensiva</button>
        <button type="button" id="gb-atk-src-def">Defense</button>
      </div>
      <div class="atk-sources"></div>
      <div class="atk-pertown" hidden></div>
      <div class="atk-btns" style="margin-top:6px">
        <button id="gb-atk-preview">Previsualizar</button>
        <button id="gb-atk-arm">Armar</button>
        <button id="gb-atk-cancel">Cancelar</button>
        <button id="gb-atk-now">Enviar ya</button>
      </div>
      <div class="atk-sched"></div>
      <div style="border-top:1px solid #333;margin:8px 0 4px;padding-top:6px;display:flex;align-items:center;gap:6px">
        <b style="font-size:11px;color:#f5a623">Enviados / cancelar</b>
        <button type="button" id="gb-atk-cmds-refresh" style="margin-left:auto">Refrescar</button>
      </div>
      <div class="atk-cmds" style="max-height:120px;overflow:auto"></div>
      <div style="border-top:1px solid #333;margin:8px 0 4px;padding-top:6px;display:flex;align-items:center;gap:6px">
        <b style="font-size:11px;color:#f5a623">Heroes</b>
        <button type="button" id="gb-atk-heroes-refresh" style="margin-left:auto">Refrescar</button>
      </div>
      <div class="atk-heroes" style="max-height:160px;overflow:auto"></div>
    </section>
    <section data-tab="quests" hidden>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <b style="font-size:11px;color:#f5a623">Misiones</b>
        <button id="gb-quest-scan" style="background:#333;border:1px solid #555;color:#eee;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:11px;margin-left:auto">Escanear ya</button>
      </div>
      <div class="quest-list"></div>
      <div style="font-size:9px;color:#888;margin-top:6px">historial</div>
      <div class="quest-hist"></div>
    </section>
    <section data-tab="build" hidden>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span id="gb-ib-dot" class="ib-dot"></span><b style="font-size:11px;color:#f5a623">Construccion instantanea</b>
        <span style="flex:1"></span>
        <button id="gb-ib-btn">Complete all free</button>
      </div>
      <div class="ib-rows"></div>
      <div id="gb-ib-status" style="font-size:10px;color:#888;margin-top:4px"></div>
      <div style="border-top:1px solid #333;margin:8px 0 6px;padding-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <b style="font-size:11px;color:#f5a623">Auto-cola</b>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:10px"><input type="checkbox" id="gb-ab-auto"/> ON</label>
        <button id="gb-ab-csfast" style="background:#333;border:1px solid #555;color:#6cf;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px">Cargar CS-fast</button>
        <button id="gb-ab-now" style="background:#333;border:1px solid #555;color:#80e090;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px">Enviar cola ya</button>
      </div>
      <div style="font-size:9px;color:#888;margin-bottom:4px">Las colas creadas con + en el Senado son FIFO estrictas por ciudad. Se rellena cada hueco real libre, nivel a nivel, revalidando coste y requisitos. Las ciudades sin cola FIFO siguen usando cur/tgt/max.</div>
      <div class="ab-queue"></div>
      <div id="gb-ab-status" style="font-size:10px;color:#888;margin-top:4px"></div>
    </section>
    <section data-tab="overview" hidden>
      <div style="font-size:15px;font-weight:750;margin-bottom:2px">Resumen de la cuenta</div>
      <div style="font-size:10px;color:#939ba7;margin-bottom:4px">Estado, próximas acciones y bloqueos importantes sin entrar en configuración avanzada.</div>
      <div class="gb-dashboard-cards"></div>
      <div class="gb-quick">
        <button id="gb-quick-safe">MODO SEGURO</button>
        <button id="gb-quick-preflight">Comprobar sistema</button>
        <button id="gb-quick-sim">Simular 24 h</button>
        <button id="gb-quick-config">Ajustes</button>
      </div>
      <div class="dashboard-summary" style="font-size:10px;color:#aab2bd;margin-bottom:4px"></div>
      <details class="gb-section" open><summary>Próximas acciones</summary><div class="gb-section-body"><pre class="timeline-panel" style="font-size:10px;white-space:pre-wrap;margin:0;max-height:150px;overflow:auto"></pre></div></details>
      <details class="gb-section"><summary>Estado operativo</summary><div class="gb-section-body"><pre class="overview-panel" style="font-size:10px;white-space:pre-wrap;margin:0;max-height:180px;overflow:auto;color:#cfd6df"></pre></div></details>
      <details class="gb-section" open><summary>Objetivos y cola por ciudad</summary><div class="gb-section-body"><div class="goals-panel" style="font-size:10px;max-height:300px;overflow:auto"></div></div></details>
      <details class="gb-section"><summary>Recursos y reservas</summary><div class="gb-section-body"><div class="planner-controls" style="font-size:10px;display:flex;gap:5px;flex-wrap:wrap;align-items:center"></div><div class="planner-panel" style="font-size:10px;max-height:240px;overflow:auto;margin-top:6px"></div></div></details>
      <details class="gb-section"><summary>Simulación y motivos</summary><div class="gb-section-body"><div style="display:flex;gap:5px;align-items:center;margin-bottom:5px"><label>Horizonte <input id="gb-sim-hours" type="number" min="1" max="168" value="24" style="width:55px;background:#111;color:#cfc;border:1px solid #444;border-radius:4px;padding:3px"/> h</label><button id="gb-sim-run" class="gb-action">Simular</button></div><pre class="sim-panel" style="font-size:10px;white-space:pre-wrap;margin:0 0 6px;max-height:160px;overflow:auto"></pre><pre class="why-panel" style="font-size:10px;white-space:pre-wrap;margin:0;max-height:130px;overflow:auto;color:#bbb"></pre></div></details>
      <details class="gb-section"><summary>Salud del sistema</summary><div class="gb-section-body"><div class="health-panel" style="font-size:10px;max-height:220px;overflow:auto"></div></div></details>
      <details class="gb-section"><summary>Plantillas y copia de seguridad</summary><div class="gb-section-body"><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><input id="gb-tpl-name" placeholder="nombre de plantilla" style="width:130px;background:#111;color:#cfc;border:1px solid #444;border-radius:4px;padding:4px;font-size:11px"/><button id="gb-tpl-save" class="gb-action">Guardar plantilla</button><button id="gb-tpl-apply" class="gb-action">Aplicar plantilla</button><button id="gb-cfg-export" class="gb-action">Exportar configuración</button><button id="gb-cfg-import" class="gb-action">Importar configuración</button></div></div></details>
    </section>
    <section data-tab="intel" hidden>
      <div style="font-size:11px;color:#f5a623;margin-bottom:4px">Intel / amenazas</div>
      <pre class="intel-panel" style="font-size:10px;white-space:pre-wrap;background:#111;padding:6px;border:1px solid #333;max-height:280px;overflow:auto;color:#cfc"></pre>
      <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <input id="gb-note-player" placeholder="player" style="width:80px;background:#111;color:#cfc;border:1px solid #333;font-size:11px"/>
        <input id="gb-note-text" placeholder="note" style="flex:1;background:#111;color:#cfc;border:1px solid #333;font-size:11px"/>
        <button id="gb-note-save" style="background:#333;border:1px solid #555;color:#eee;padding:2px 6px;cursor:pointer;font-size:10px">Guardar nota</button>
      </div>
    </section>
    <section data-tab="config" hidden>
      <div class="config-panel" style="font-size:11px;display:flex;flex-direction:column;gap:8px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="enabled-host"/> Enable on <span class="cfg-host"></span></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#fc6"><input type="checkbox" data-cfg="safe-mode"/> SAFE MODE (block premium/attacks/favor/killpoints/donations)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-collect"/> Auto-collect visible resource rewards</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px"><input type="checkbox" data-cfg="collect-all"/> Recolect all (ignore timer cap)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-bandit"/> Auto-bandit</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-farm"/> Auto-farm</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px"><input type="checkbox" data-cfg="farm-skip-full"/> Skip farm/bandit if warehouse full</label>
        <label style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-wrap:wrap">Warehouse full mode
          <select data-cfg="farm-full-mode" style="background:#111;color:#cfc;border:1px solid #333;margin-left:6px">
            <option value="any">cualquier recurso lleno</option>
            <option value="all">los 3 recursos llenos</option>
          </select>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px"><input type="checkbox" data-cfg="farm-long-claims"/> 10min claims where villager loyalty researched</label>
        <label style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-wrap:wrap">Loyalty tech key
          <input data-cfg="farm-loyalty-tech" placeholder="auto-detect (server id or label)" title="Server research id (e.g. rural_loyalty) or the localized academy name. Log tab dumps id(label) pairs when auto-detect misses." style="width:190px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/>
        </label>
        <label style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-wrap:wrap">Sleep claim length
          <select data-cfg="farm-sleep-dur" style="background:#111;color:#cfc;border:1px solid #333;margin-left:6px">
            <option value="auto">auto (8h si se sabe, si no 4h)</option>
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
        <label style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-wrap:wrap">Cave when iron ≥ % of warehouse
          <input type="number" data-cfg="cave-thresh" min="50" max="99" style="width:50px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/>
        </label>
        <div style="margin-left:12px;font-size:10px;color:#888">Per-town (unchecked = skip that town):</div>
        <div class="cave-towns" style="display:flex;flex-direction:column;gap:2px;max-height:120px;overflow:auto"></div>
        <div style="border-top:1px solid #333;padding-top:6px;color:#f5a623;font-size:10px">Fase 8+ economia</div>
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
            <option value="smart">predictivo inteligente</option>
            <option value="storage">almacen</option>
            <option value="party">fiesta (sin implementar)</option>
            <option value="unit">unidades (sin implementar)</option>
          </select>
          Reserve % <input type="number" data-cfg="trade-reserve" min="0" max="80" style="width:45px;background:#111;color:#cfc;border:1px solid #333"/>
          Min batch <input type="number" data-cfg="trade-min" min="100" max="50000" step="100" style="width:60px;background:#111;color:#cfc;border:1px solid #333"/>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="island-ship"/> Mainland→island res ship</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-rural-trade"/> Rural village trade</label>
        <label style="margin-left:12px;flex-wrap:wrap">Min ratio <input type="number" data-cfg="rural-ratio" step="0.25" min="0.25" max="2" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/>
          Res <select data-cfg="rural-res" style="background:#111;color:#cfc;border:1px solid #333"><option>plata</option><option>stone</option><option>wood</option></select>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-rural-level"/> Farm village upgrade</label>
        <label style="margin-left:12px">Max level <input type="number" data-cfg="rural-level-max" min="1" max="6" style="width:40px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-research"/> Auto-research</label>
        <button data-cfg="research-csfast" style="align-self:flex-start;margin-left:12px;background:#333;border:1px solid #555;color:#6cf;padding:2px 6px;cursor:pointer;font-size:10px">Cargar CS-fast de investigacion</button>
        <div style="border-top:1px solid #333;padding-top:6px;color:#f5a623;font-size:10px">QoL / survival</div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="pause-activity"/> Pause when I am active</label>
        <label style="margin-left:12px">Pause min <input type="number" data-cfg="pause-ms" min="1" max="60" style="width:40px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="night-pause"/> Night pause</label>
        <label style="margin-left:12px">Hours <input type="number" data-cfg="night-start" min="0" max="23" style="width:40px;background:#111;color:#cfc;border:1px solid #333"/>–<input type="number" data-cfg="night-end" min="0" max="23" style="width:40px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Log every payload the bot would send and send nothing. Use it to compare bot payloads against a hand-clicked action before enabling a risky feature."><input type="checkbox" data-cfg="dry-run"/> <b style="color:#6cf">Simulacion (registra payloads, no envia nada)</b></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="A feature that keeps finding nothing to do doubles its own interval (up to 8x) until it acts again."><input type="checkbox" data-cfg="orch-adaptive"/> Adaptive cadence (back off idle features)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Copy/Export replace player names and ids with short hashes. Turn OFF only for local debugging."><input type="checkbox" data-cfg="export-redact"/> Redact names/ids in Copy + Export</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="captcha-global"/> Global captcha kill-switch</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Skip an action that failed the same way 3x in a row (5/15/60min backoff). Journal keeps recording either way."><input type="checkbox" data-cfg="decision-memory"/> Decision memory (skip repeat failures)</label>
        <label>Req budget / min <input type="number" data-cfg="req-budget" min="5" max="120" style="width:50px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/></label>
        <label>Webhook URL <input type="text" data-cfg="webhook-url" placeholder="Discord webhook or https://api.telegram.org/bot…/sendMessage" style="width:100%;background:#111;color:#cfc;border:1px solid #333;margin-top:2px;font-size:10px"/></label>
        <label style="margin-left:0;display:flex;gap:8px;flex-wrap:wrap;font-size:10px">Events
          <label><input type="checkbox" data-cfg="wh-captcha"/> captcha</label>
          <label><input type="checkbox" data-cfg="wh-attack"/> attack</label>
          <label><input type="checkbox" data-cfg="wh-warehouse"/> warehouse</label>
          <label><input type="checkbox" data-cfg="wh-culture"/> culture</label>
        </label>
        <label>Telegram chat_id <input type="text" data-cfg="wh-tg-chat" placeholder="optional if not in URL" style="width:140px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px;font-size:10px"/></label>
        <div style="border-top:1px solid #333;padding-top:6px;color:#f96;font-size:10px">ALTO RIESGO (por defecto OFF)</div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-merchant"/> Merchant sniper</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Las ofertas de recursos del barco mercante empiezan en 0.5:1 y suben +0.1 por trato. Bombea con tratos de 1 unidad y luego envia el trato grande a 1:1."><input type="checkbox" data-cfg="auto-pt-trade"/> Bombeo del ratio del barco mercante</label>
        <label style="margin-left:12px;font-size:10px">ratio objetivo <input type="number" step="0.1" min="0.5" max="2" data-cfg="pt-ratio" style="width:52px;background:#111;color:#cfc;border:1px solid #333"/>
          cantidad de bombeo <input type="number" min="1" max="100" data-cfg="pt-pump" style="width:52px;background:#111;color:#cfc;border:1px solid #333"/>
          bombeos max. <input type="number" min="0" max="20" data-cfg="pt-maxpumps" style="width:52px;background:#111;color:#cfc;border:1px solid #333"/>
          reserva % <input type="number" min="0" max="90" data-cfg="pt-reserve" style="width:52px;background:#111;color:#cfc;border:1px solid #333"/>
        </label>
        <label style="margin-left:12px;display:flex;gap:8px;flex-wrap:wrap;font-size:10px">recibir
          <label><input type="checkbox" data-cfg="pt-want-wood"/> madera</label>
          <label><input type="checkbox" data-cfg="pt-want-stone"/> piedra</label>
          <label><input type="checkbox" data-cfg="pt-want-iron"/> plata</label>
        </label>
        <div style="margin-left:12px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span id="gb-pt-status" style="font-size:10px;color:#888"></span>
          <button data-cfg="pt-now" style="background:#333;border:1px solid #555;color:#80e090;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px">Bombear + comerciar ya</button>
          <button data-cfg="pt-copy" title="Copia el HTML de la ventana del mercader abierta - hace falta una vez para confirmar el analizador de ofertas" style="background:#333;border:1px solid #555;color:#6cf;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px">Copiar HTML de la oferta</button>
        </div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-favor" disabled/> Favor farm (disabled: unsafe target path)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-wonder"/> WW donations</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Gasta favor en la maravilla de la alianza. Requiere haber capturado wonderFavorTpl. Por defecto OFF."><input type="checkbox" data-cfg="auto-wonder-favor"/> Lanzar favor en la Maravilla (captura el poder antes)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="cs-alert"/> CS / incoming alerts</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-militia"/> Auto-militia on incoming</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-dodge"/> Auto-dodge</label>
        <label style="margin-left:12px">Defense mode <select data-cfg="defense-mode" style="background:#111;color:#cfc;border:1px solid #333"><option value="notify">avisar</option><option value="safe">esquiva segura</option><option value="smart">smart</option></select> <label><input type="checkbox" data-cfg="defense-smart-auto"/> smart auto</label> check return +<input type="number" data-cfg="defense-return-margin" min="0" max="3600" style="width:55px;background:#111;color:#cfc;border:1px solid #333"/>s (manual if support arrived) · leave <input type="number" data-cfg="dodge-floor" min="0" max="500" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-recruit"/> Auto-recruit</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px"><input type="checkbox" data-cfg="recruit-spells"/> Cast recruit spells first</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="grepodata"/> Grepodata Index+ assist</label>
        <label>IB free threshold (sec, safety cap 290) <input type="number" data-cfg="ib-free-thresh" min="60" max="300" style="width:70px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/></label>
        <label>Collect max min <input type="number" data-cfg="collect-max-min" min="1" max="120" style="width:70px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/></label>
        <label>Farm cadence min-max (min) <input type="number" data-cfg="farm-min" min="1" max="60" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/> - <input type="number" data-cfg="farm-max" min="1" max="60" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label>Town cadence min-max (min) <input type="number" data-cfg="town-min" min="1" max="60" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/> - <input type="number" data-cfg="town-max" min="1" max="60" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <button data-cfg="clear-captcha" style="align-self:flex-start;background:#333;border:1px solid #555;color:#f96;padding:3px 8px;cursor:pointer;font-size:11px">Limpiar cortacircuitos de captcha</button>
      </div>
    </section>
    <section data-tab="stats" hidden>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
        <b style="font-size:11px;color:#f5a623">Estadisticas</b>
        <button data-stats="1h" style="background:#262626;border:1px solid #333;color:#aaa;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">1h</button>
        <button data-stats="24h" class="on" style="background:#333;border:1px solid #555;color:#fff;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">24h</button>
        <button data-stats="7d" style="background:#262626;border:1px solid #333;color:#aaa;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">7d</button>
        <span style="flex:1"></span>
        <button id="gb-preflight" title="Read-only probe of every module: collections, learned action keys, would-be payloads. Sends nothing." style="background:#333;border:1px solid #555;color:#6cf;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">Comprobar sistema</button>
      </div>
      <pre class="stats-body" style="font-size:10px;white-space:pre-wrap;background:#111;padding:6px;border:1px solid #333;max-height:320px;overflow:auto;color:#cfc"></pre>
    </section>
    <section data-tab="log" hidden>
      <div class="gb-logsub">
        <button data-logsub="live" class="on">Registro en vivo</button>
        <button data-logsub="mem">Decisiones</button>
        <input class="jrn-filter" placeholder="filter feature/action/target"/>
      </div>
      <div class="log-list"></div>
      <div class="jrn-pane" hidden>
        <div class="jrn-head"></div>
        <div class="jrn-list"></div>
        <div class="jrn-btns">
          <button data-jrn="copy">Copiar JSON</button>
          <button data-jrn="clear-skips">Limpiar saltos</button>
          <button data-jrn="clear">Limpiar bitacora</button>
        </div>
      </div>
    </section>
    <footer>
      <div class="gb-status-row">
        <span id="gb-next-farms" style="color:#6cf"></span>
        <span id="gb-next-towns" style="color:#fc6"></span>
        <span id="gb-collect-state" style="color:#f96;font-weight:bold"></span>
        <span id="gb-status" style="color:#888"></span>
      </div>
      <details class="gb-actions">
        <summary>Acciones</summary>
        <div class="gb-actions-menu">
          <button type="button" data-act="copy">Copiar JSON</button>
          <button type="button" data-act="export">Exportar</button>
          <button type="button" data-act="refresh">Refrescar ciudades</button>
          <button type="button" data-act="scrape-farms">Granjas ahora</button>
          <button type="button" data-act="scrape-towns">Ciudades ahora</button>
          <button type="button" data-act="diag">Diagnostico</button>
          <button type="button" data-act="preflight">Comprobar sistema</button>
          <button type="button" data-act="evidence" title="Instantanea de solo lectura y anonimizada para las validaciones de TASKS. Copia JSON. No envia nada.">Evidencia</button>
          <button type="button" data-act="clear">Limpiar hallazgos</button>
          <button type="button" data-act="reset-pos" title="Reset panel position">Restablecer posicion</button>
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
    navigator.clipboard.writeText(text).then(() => flash('bitacora copiada')).catch(() => flash('fallo al copiar'));
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
  panel.querySelector('#gb-sim-run')?.addEventListener('click',()=>{const h=Math.max(1,+panel.querySelector('#gb-sim-hours')?.value||24);dashboardSimulation=simulateAccount(h);state.simCfg.horizonHours=h;save(STORE.SIM_CFG,state.simCfg);renderDashboard();});
  panel.querySelector('#gb-cfg-export')?.addEventListener('click', () => {
    const text = JSON.stringify(qolRedactConfigDump(qolExportConfig()), null, 2);
    navigator.clipboard.writeText(text).then(() => flash('configuracion copiada')).catch(() => flash('fallo al copiar'));
  });
  panel.querySelector('#gb-cfg-import')?.addEventListener('click', () => {
    const raw = prompt('Pegar JSON de la config de GrepBot');
    if (!raw) return;
    try {
      if (qolImportConfig(JSON.parse(raw))) flash('configuracion importada');
      else flash('importacion fallida');
    } catch (e) { flash('JSON invalido'); }
  });
  panel.querySelector('#gb-note-save')?.addEventListener('click', () => {
    const p = panel.querySelector('#gb-note-player')?.value?.trim();
    const n = panel.querySelector('#gb-note-text')?.value?.trim();
    if (p) { intelSetNote(p, n); renderIntel(); flash('nota guardada'); }
  });
  panel.querySelector('#gb-quest-scan')?.addEventListener('click', () => {
    questScanTick('manual');
    gbTimeout(renderQuests, 600);
  });
  panel.querySelector('footer button[data-act=refresh]').addEventListener('click', () => {
    fetchOwnedTowns();
    state.towns.forEach((t, i) => gbTimeout(() => fetchTownResources(t), i * 600));
  });
  panel.querySelector('header button[data-act=queues]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openQueueCenter();
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
  panel.querySelector('#gb-ab-now')?.addEventListener('click', () => {

    abScan('manual');
  });
  panel.querySelector('footer button[data-act=copy]').addEventListener('click', () => {
    const dump = redactFindingsExport({ findings: state.findings, farms: state.farms });
    const text = JSON.stringify(dump, null, 2);
    navigator.clipboard.writeText(text)
      .then(() => flash('copiado'))
      .catch(() => {
        try {
          const ta = document.createElement('textarea');
          ta.value = text; document.body.appendChild(ta); ta.select();
          const ok = document.execCommand('copy');
          ta.remove();
          flash(ok ? 'copied' : 'copy failed');
        } catch (_) { flash('fallo al copiar'); }
      });
  });
  panel.querySelector('footer button[data-act=export]').addEventListener('click', () => {
    const dump = redactFindingsExport({ findings: state.findings, farms: state.farms });
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;
    a.download = `grepbot-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    gbTimeout(() => { try { URL.revokeObjectURL(objectUrl); } catch (_) {} }, 0);
  });
  panel.querySelector('footer button[data-act=clear]').addEventListener('click', () => {
    if (!confirm('Limpiar todos los hallazgos?')) return;
    state.findings = []; state.seen = {}; seenThisRun.clear();
    save(STORE.FINDINGS, state.findings); save(STORE.SEEN, state.seen);
    renderFindings();
  });
  panel.querySelectorAll('button[data-act=evidence]').forEach(btn => {
    btn.addEventListener('click', () => { evidenceCopy(); });
  });
  panel.querySelector('footer button[data-act=diag]').addEventListener('click', () => {
    diagRun();
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
      const acoll = sec.querySelector('[data-cfg=auto-collect]'); if (acoll) acoll.checked = !!state.autoCollect;
      sec.querySelector('[data-cfg=collect-all]').checked = state.collectAll;
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
      const er = sec.querySelector('[data-cfg=export-redact]'); if (er) er.checked = state.exportRedact !== false;
      renderCaveTowns();
      return;
    }
    configBound = true;
    const hostEl = sec.querySelector('.cfg-host');
    if (hostEl) hostEl.textContent = location.host;
    const setChk = (sel, val) => { const el = sec.querySelector(sel); if (el) el.checked = !!val; };
    setChk('[data-cfg=enabled-host]', state.enabledHosts[location.host] === true);
    setChk('[data-cfg=auto-collect]', state.autoCollect);
    setChk('[data-cfg=collect-all]', state.collectAll);
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
    sec.querySelector('[data-cfg=safe-mode]')?.addEventListener('change',e=>{state.safeMode=!!e.target.checked;save(STORE.SAFE_MODE,state.safeMode);gbLog('safeMode',state.safeMode);updateStatus();});
    sec.querySelector('[data-cfg=enabled-host]')?.addEventListener('change', e => {
      state.enabledHosts[location.host] = e.target.checked;
      save(STORE.ENABLED_HOSTS, state.enabledHosts);
      flash(e.target.checked ? 'enabled on ' + location.host : 'disabled on ' + location.host);
    });
    sec.querySelector('[data-cfg=auto-collect]')?.addEventListener('change', e => {
      state.autoCollect = e.target.checked; save(STORE.AUTO_COLLECT, state.autoCollect);
      gbLog('auto-collect', state.autoCollect ? 'ON' : 'OFF');
      if (state.autoCollect) autoCollectResources();
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
      if (state.autoFarm) { autoClaimFarms('toggle'); farmScheduleClaimWake(null, 'toggle', true); }
      else farmCancelClaimWake();
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
    setChk('[data-cfg=auto-wonder-favor]', !!state.autoWonderFavor);
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
    setNum('[data-cfg=dodge-floor]', state.dodgeFloor);
    const rr = sec.querySelector('[data-cfg=rural-res]'); if (rr) rr.value = state.ruralTradeRes || 'iron';
    const defense=state.defenseCfg||{mode:'notify',smartAuto:false,returnMarginSec:120};
    const dm=sec.querySelector('[data-cfg=defense-mode]');if(dm)dm.value=defenseMode();
    setChk('[data-cfg=defense-smart-auto]',!!defense.smartAuto);
    setNum('[data-cfg=defense-return-margin]',Math.max(0,+defense.returnMarginSec||120));
    const wh = sec.querySelector('[data-cfg=webhook-url]'); if (wh) wh.value = state.webhookUrl || '';
    const we = state.webhookEvents || {};
    setChk('[data-cfg=wh-captcha]', we.captcha !== false);
    setChk('[data-cfg=wh-attack]', we.attack !== false);
    setChk('[data-cfg=wh-warehouse]', !!we.warehouse);
    setChk('[data-cfg=wh-culture]', !!we.culture);
    const tg = sec.querySelector('[data-cfg=wh-tg-chat]'); if (tg) tg.value = we.telegramChatId || '';
    const tp = sec.querySelector('[data-cfg=trade-preset]'); if (tp) tp.value = state.tradePreset || 'storage';
    setNum('[data-cfg=trade-reserve]', state.tradeReservePct);
    setNum('[data-cfg=trade-min]', state.tradeMinBatch);
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
    bindToggle('[data-cfg=export-redact]', 'exportRedact', STORE.EXPORT_REDACT);
    sec.querySelector('[data-cfg=dry-run]')?.addEventListener('change', e => {
      state.dryRun = e.target.checked; save(STORE.DRY_RUN, state.dryRun);
      gbLog('DRY RUN ' + (state.dryRun ? 'ON - payloads logged, nothing sent' : 'OFF - posts go to the server'));
      flash(state.dryRun ? 'dry run ON' : 'dry run OFF');
      updateStatus();
    });
    bindToggle('[data-cfg=auto-merchant]', 'autoMerchant', STORE.AUTO_MERCHANT, () => merchantScan('toggle'));
    bindToggle('[data-cfg=auto-pt-trade]', 'autoPtTrade', STORE.AUTO_PT_TRADE, () => ptTradeScan('toggle'));
    bindToggle('[data-cfg=auto-wonder-favor]', 'autoWonderFavor', STORE.AUTO_WONDER_FAVOR);
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
      if (!state.ptTradeTpl) { flash('comercia una vez a mano primero'); return; }
      if (!confirm('Bombear el ratio del barco mercante y enviar ahora el trato grande?')) return;
      const was = state.autoPtTrade;
      if (!was) { state.autoPtTrade = true; save(STORE.AUTO_PT_TRADE, true); }
      ptTradeScan('manual');
    });
    sec.querySelector('[data-cfg=pt-copy]')?.addEventListener('click', () => {
      const root = typeof ptWindowRoot === 'function' ? ptWindowRoot() : null;
      if (!root) { flash('abre primero la ventana del mercader'); return; }
      navigator.clipboard.writeText(root.innerHTML.slice(0, 20000))
        .then(() => flash('HTML de la oferta copiado'))
        .catch(() => flash('fallo al copiar'));
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
    saveNum('[data-cfg=dodge-floor]', v => { state.dodgeFloor = v; save(STORE.DODGE_FLOOR, v); });
    sec.querySelector('[data-cfg=rural-res]')?.addEventListener('change', e => {
      state.ruralTradeRes = e.target.value; save(STORE.RURAL_TRADE_RES, state.ruralTradeRes);
    });
    sec.querySelector('[data-cfg=defense-mode]')?.addEventListener('change',e=>{state.defenseCfg=Object.assign({},state.defenseCfg,{mode:['notify','safe','smart'].includes(e.target.value)?e.target.value:'notify'});save(STORE.DEFENSE_CFG,state.defenseCfg)});
    sec.querySelector('[data-cfg=defense-smart-auto]')?.addEventListener('change',e=>{state.defenseCfg=Object.assign({},state.defenseCfg,{smartAuto:!!e.target.checked});save(STORE.DEFENSE_CFG,state.defenseCfg)});
    saveNum('[data-cfg=defense-return-margin]',v=>{state.defenseCfg=Object.assign({},state.defenseCfg,{returnMarginSec:Math.max(0,Math.min(3600,+v||0))});save(STORE.DEFENSE_CFG,state.defenseCfg)});
    sec.querySelector('[data-cfg=webhook-url]')?.addEventListener('change', e => {
      state.webhookUrl = e.target.value.trim(); save(STORE.WEBHOOK_URL, state.webhookUrl);
      gbLog('webhook url', state.webhookUrl ? 'set' : 'cleared');
    });
    const saveWebhookEvents = () => {
      state.webhookEvents = {
        captcha: !!sec.querySelector('[data-cfg=wh-captcha]')?.checked,
        attack: !!sec.querySelector('[data-cfg=wh-attack]')?.checked,
        warehouse: !!sec.querySelector('[data-cfg=wh-warehouse]')?.checked,
        culture: !!sec.querySelector('[data-cfg=wh-culture]')?.checked,
        telegramChatId: (sec.querySelector('[data-cfg=wh-tg-chat]')?.value || '').trim() || undefined,
      };
      save(STORE.WEBHOOK_EVENTS, state.webhookEvents);
    };
    ['wh-captcha', 'wh-attack', 'wh-warehouse', 'wh-culture'].forEach(k => {
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
    saveNum('[data-cfg=ib-free-thresh]', v => { state.ibFreeThresh = Math.max(60,Math.min(300,+v||300)); save(STORE.IB_FREE_THRESH, state.ibFreeThresh); });
    saveNum('[data-cfg=collect-max-min]', v => { state.collectMaxMin = v; save(STORE.COLLECT_MAX_MIN, v); });
    saveNum('[data-cfg=farm-min]', v => { state.farmMinMs = v * 60000; save(STORE.FARM_MIN, state.farmMinMs); });
    saveNum('[data-cfg=farm-max]', v => { state.farmMaxMs = v * 60000; save(STORE.FARM_MAX, state.farmMaxMs); });
    saveNum('[data-cfg=town-min]', v => { state.townMinMs = v * 60000; save(STORE.TOWN_MIN, state.townMinMs); });
    saveNum('[data-cfg=town-max]', v => { state.townMaxMs = v * 60000; save(STORE.TOWN_MAX, state.townMaxMs); });
    sec.querySelector('[data-cfg=clear-captcha]')?.addEventListener('click', () => {
      captchaClear();
      gbLog('captcha breakers cleared by user');
      flash('cortacircuitos de captcha limpiados');
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
    gbClearTimeout(farmsInputTimer);
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
      if (t) gbClearTimeout(t);
      t = gbTimeout(() => { t = null; fn(); }, ms);
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
      const target = f.town?.name || `t#${f.town?.id || '?'}`;
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
        `${state.decisions.length} decisions · memory ${state.decisionMemory === false ? 'OFF' : 'ON'} · `));
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
      tr.className = r.r === 'ok' ? 'ok' : ((r.r.slice(0, 5) === 'skip:' || jrnPendingResult(r.r)) ? 'skip' : 'err');
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
      return { id: p.id != null ? 'p' + String(p.id).slice(-4) : null, name: p.name ? String(p.name).slice(0, 1) + '…' : null };
    };
    const findings = (dump.findings || []).map(f => {
      if (!f || typeof f !== 'object') return f;
      const out = Object.assign({}, f);
      out.attacker = redactPlayer(f.attacker);
      out.defender = redactPlayer(f.defender);
      if (out.town && typeof out.town === 'object') {
        out.town = { id: out.town.id, name: out.town.name ? String(out.town.name).slice(0, 1) + '…' : null, x: out.town.x, y: out.town.y };
      }
      delete out.raw;
      return out;
    });
    return { findings, farms: dump.farms };
  }

  let _statusLast = '';
  let _statusCsLast = '';
  function updateStatus() {
    if (!panel) return;
    const el = panel.querySelector('#gb-status');
    if (!el) return;
    const csrfShort = state.csrf ? state.csrf.slice(0, 6) + '…' : 'NONE';
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
    const openCircuits = Object.keys(state.circuits || {}).filter(k => state.circuits[k] && state.circuits[k].open);
    const unknownTx = Object.values(state.txState || {}).filter(t => t && /^(unknown|manual-review)$/.test(t.state || '')).length;
    if (openCircuits.length) pauseTxt += ` circuit:${openCircuits.length}`;
    if (unknownTx) pauseTxt += ` tx?:${unknownTx}`;
    if (gbServerPaused()) pauseTxt += ` ||srv:${fmtSec(Math.round(gbServerCooldownLeftMs() / 1000))}`;
    if(gbTabCoordSupported&&!gbTabLeader)pauseTxt+=' ||other-tab';
    if (storageWarnUntil > Date.now()) pauseTxt += ` !${storageWarnMsg || 'quota'}`;
    let tplBanner = '';
    try { tplBanner = tplHealthBannerText() || ''; } catch (_) {}
    if (tplBanner) pauseTxt += ' tpl!';
    const dryTxt = state.dryRun ? ' [DRY]' : ''; const safeTxt=state.safeMode?' SAFE':'';
    const txt = `csrf:${csrfShort} farms:${okFarms}/${farms}${errTxt}${dryTxt}${safeTxt}${pauseTxt}`;
    if (txt !== _statusLast) {
      _statusLast = txt;
      el.textContent = txt;
      el.title = (tplBanner ? tplBanner + ' | ' : '') + JSON.stringify({ csrf: !!state.csrf, captcha: state.captchaBreakers, pause: pauseInfo.reason, memory: memSkips.map(s => s.key), circuits: openCircuits, unknownTransactions: unknownTx });
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
      const timing = state.autoFarm ? farmClaimTiming() : null;
      const claimTxt = !state.autoFarm ? 'claim: off'
        : (timing && timing.ready > 0 ? `claim: ${timing.ready} ready`
          : (timing && Number.isFinite(timing.nextAt) ? `claim: ${fmtSec(Math.max(0, timing.nextAt - timing.now))}`
            : (timing && timing.expiredModelWait ? 'claim: model sync' : 'claim: -')));
      const scrapeTxt = state.nextFarmScrape
        ? `scrape: ${fmtSec(Math.max(0, Math.round((state.nextFarmScrape - Date.now()) / 1000)))}`
        : 'scrape: -';
      const t = `${claimTxt} · ${scrapeTxt}`;
      if (t !== _timerFarmLast) { _timerFarmLast = t; fe.textContent = t; }
    }
    if (te) {
      const t = state.nextTownsScrape
        ? `towns: ${fmtSec(Math.max(0, Math.round((state.nextTownsScrape - Date.now()) / 1000)))}`
        : 'towns: -';
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
        lines.push('  methods: ' + ((cd.keys && cd.keys.length) ? cd.keys.join(',') : '(ninguno)'));
        lines.push('  attrs: ' + ((cd.attrs && cd.attrs.length) ? cd.attrs.join(',') : '(ninguno)'));
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
        flash('diagnostico copiado');
        gbLog('diag: copied ' + farms.length + ' farms, csrf=' + (state.csrf ? 'yes' : 'NO'));
      };
      const failFlash = () => {
        flash('diagnostico listo — pegalo desde la consola');
        gbLog('diag: clipboard fail — expand [grepbot] diag in console');
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
  gbTimeout(clientFingerprintCheck, 10000);
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
  gbMenu('GrepBot: colas', () => { openQueueCenter(); });
  gbMenu('GrepBot: diag', () => { diagRun(); });
  gbMenu('GrepBot: reset panel position', () => { resetPanelGeom(); });
  gbMenu('GrepBot: rescan inbox', () => {
    seenThisRun.clear(); Object.keys(state.seen).forEach(k => delete state.seen[k]);
    seenCount = 0;
    save(STORE.SEEN, state.seen); scrapeInboxDom();
  });
  gbMenu('GrepBot: clear captcha', () => { captchaClear(); flash('captcha limpiado'); });
  gbMenu('GrepBot: clear circuit breakers', () => {
    if (!confirm('Limpiar todos los cortacircuitos de GrepBot? Solo despues de revisar los errores estructurales.')) return;
    circuitClear();
    gbLog('circuit breakers manually cleared');
    flash('cortacircuitos limpiados');
    updateStatus();
  });
  gbMenu('GrepBot: review unknown transactions', () => {
    const unknown = Object.entries(state.txState || {}).filter(([, t]) => t && /^(unknown|manual-review)$/.test(t.state || ''));
    if (!unknown.length) { flash('sin transacciones desconocidas'); return; }
    const sample = unknown.slice(0, 4).map(([k]) => k).join('\n');
    if (!confirm(`Marcar ${unknown.length} transaccion(es) DESCONOCIDA(S) como revisadas manualmente/canceladas?\n\nEsto puede afectarlow the same intent to be attempted again. First verify the game state.\n\n${sample}`)) return;
    txClearUnknown();
    gbLog(`transactions: manually reviewed/aborted ${unknown.length} unknown outcome(s)`);
    flash(`revisadas ${unknown.length} tx desconocidas`);
    updateStatus();
  });
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
        if (gbInstanceAlive()) gbTimeout(ensurePanelMounted, 50);
        return r;
      };
      wrapped._grepbot = true;
      wrapped.__grepbotOwner = GB_INSTANCE_ID;
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
  gbTimeout(() => { if (state.autoFarm) farmScheduleClaimWake(null, 'boot', true); }, 2500);

  gbListen(document, 'visibilitychange', () => {
    if (document.hidden) return;
    try { gbWakeMarkResume('visible'); } catch (_) {}
    farmTick();
    try { reportCatchUpEnqueue(); } catch (_) {}
    try { gbWake('ibScan', () => ibScan(), { priority: 10 }); } catch (_) {}
  });
  gbListen(window, 'pageshow', (e) => {
    if (!(e && e.persisted)) return;
    try { gbWakeMarkResume('bfcache'); } catch (_) {}
    farmTick();
    try { reportCatchUpEnqueue(); } catch (_) {}
    try { bindQuestObserver(); } catch (_) {}
    try { gbWake('ibScan', () => ibScan(), { priority: 10 }); } catch (_) {}
  });
  gbInterval(checkThresholds, 30000);
  gbInterval(renderTimers, 1000);
  gbInterval(updateStatus, 5000);

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
  gbTimeout(scheduleNativeUiScan, 1200);
  gbInterval(() => {
    if (nativeQueueHasPending('build')) abScan('native-watch');
    if (nativeQueueHasPending('recruit')) recruitScan('native-watch');
    if (nativeQueueHasPending('build') || nativeQueueHasPending('recruit')) scheduleNativeUiScan();
  }, 5000);
  gbInterval(() => dodgeScan('loop'), DODGE_CHECK_MS);
  gbInterval(dodgeReturnTick, 15000);

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
    try { if (typeof dodgeQueueSave === 'function') dodgeQueueSave(); } catch (_) {}
    try { if (typeof questClaimFailSave === 'function') questClaimFailSave(); } catch (_) {}
    try { if (typeof persistServerCooldown === 'function') persistServerCooldown(); } catch (_) {}
  };
  gbListen(window, 'beforeunload', releaseLocks);
  gbListen(window, 'pagehide', releaseLocks);

  if (GB_ROOT.__grepbotTestMode === true) {
    GB_ROOT.__grepbotTest = {
      instanceId: GB_INSTANCE_ID,
      state,
      bridgePost,
      gameAjaxPost,
      txDomWrite,
      txRun,
      txReconcileNow,
      txIntent,
      txCapture,
      txClearUnknown,
      circuitOpen,
      circuitClear,
      gbLock,
      gbUnlock,
      gbLocked,
      gbLockTouch,
      planner,
      plannerSnapshot,
      plannerAvailable,
      plannerEffect,
      plannerCanReserve,
      plannerHold,
      plannerRelease,
      plannerCommit,
      goalProfiles,
      goalEffective,
      goalPlanTown,
      goalPlanAll,
      goalSetProfile,
      goalSetTownOverrides,
      goalProgress,
      goalQueueMove,
      goalQueueToggleBlock,
      goalQueueToggleMandatory,
      goalQueueHide,
      goalQueueReset,
      goalMandatoryModules,
      goalResearchDependencies,
      goalUnitDependencies,
      economyProductionRate,
      economyForecast,
      tradePredictiveJobs,
      defenseAssessment,
      defenseShouldDodge,
      dodgeReturnRecord,
      dodgeReturnTick,
      clientFingerprintNow,
      clientFingerprintCompatible,
      clientFingerprintCheck,
      safeModeBlock,
      simulateTown,
      simulateAccount,
      renderDashboard,
      renderHealth,
      whyNote,
      qolExportConfig,
      qolImportConfig,
      preflightRun,
      autoCollectResources,
      abScan,
      abPickNext,
      abQueueInfo,
      abEnsureOrder,
      nativeQueueRoot,
      nativeQueueTown,
      nativeQueueList,
      nativeQueueAddBuild,
      nativeQueueRemoveLastBuild,
      nativeQueueAddRecruit,
      nativeQueueRemoveLastRecruit,
      nativeQueueMove,
      nativeQueueBuildPlan,
      nativeQueueBuildApplied,
      nativeQueueRecruitApplied,
      nativeUiScan,
      ibSafeFreeThresh,
      ibIsFreeOrder,
      ibOrders,
      ibComplete,
      researchScan,
      recruitScan,
      tradeScan,
      dodgeScan,
      orchTick,
      alertWebhook,
      attackKnownTargets,
      applyAttackTarget,
      applyHarassPreset,
      buildAttackSchedule,
      sendAttackViaBridge,
      militaryOutgoingMovements,
      militaryCancelCommand,
      playerHeroesList,
      heroAssignToTown,
      heroUnassign,
      heroCancelTravel,
      txCommandStatus,
      txHeroStatus,
      renderAttack,
      openQueueCenter,
      renderQueueCenter,
      dispose: GB_ROOT.__grepbotDispose,
    };
  }
})();
