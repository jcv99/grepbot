  const GB_RELEASE = '6.0.80';
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
    BANDIT_CFG: 'grepbot:bandit-cfg',
    BANDIT_LOG:  'grepbot:bandit-log',
    NEXT_FARM:  'grepbot:next-farm',
    NEXT_FARM_CLAIM: 'grepbot:next-farm-claim',
    NEXT_TOWNS: 'grepbot:next-towns',
    AB_SCRIPT:  'grepbot:ab-script',
    PAUSE_ON_ACTIVITY: 'grepbot:pause-on-activity',
    PAUSE_ACTIVITY_MS: 'grepbot:pause-activity-ms',
    NIGHT_PAUSE: 'grepbot:night-pause',
    NIGHT_START: 'grepbot:night-start',
    NIGHT_END: 'grepbot:night-end',
    NEVER_STOP: 'grepbot:never-stop',
    ORCH_DEADLOCK: 'grepbot:orch-deadlock',
    FARM_ACTION: 'grepbot:farm-action',
    AUTO_FARM:  'grepbot:auto-farm',
    CLAIM_TPL:  'grepbot:claim-tpl',
    IB_AUTO:   'grepbot:ib-auto',
    IB_FREE_THRESH: 'grepbot:ib-free-thresh',
    ORCH_CADENCE_SCALE: 'grepbot:orch-cadence-scale',
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
    AUTO_HERO: 'grepbot:auto-hero',
    HERO_LOW_STAMINA_PCT: 'grepbot:hero-low-stamina-pct',
    HERO_EQUIP_SUGGEST: 'grepbot:hero-equip-suggest',
    ATTACK_PLAN: 'grepbot:attack-plan',
    ATTACK_HISTORY: 'grepbot:attack-history',
    ATTACK_RECENT: 'grepbot:attack-recent',
    CAPTCHA: 'grepbot:captcha-breakers',
    FINDINGS_FILTER: 'grepbot:findings-filter',
    PANEL_GEOM: 'grepbot:panel-geom',
    WIDGET_GEOM: 'grepbot:widget-geom',
    HUD_PRODUCTION: 'grepbot:hud-production',
    HUD_COUNTDOWN: 'grepbot:hud-countdown',
    TOWN_GROWTH_HIST: 'grepbot:town-growth-hist',
    THEME: 'grepbot:theme',
    CONTEXT_MENU: 'grepbot:context-menu',
    KEYBINDINGS: 'grepbot:keybindings',
    KEYBOARD_SHORTCUTS: 'grepbot:keyboard-shortcuts',
    ACTIVE_TAB: 'grepbot:active-tab',
    CSRF: 'grepbot:csrf',
    FARM_SKIP_FULL: 'grepbot:farm-skip-full',
    FARM_FULL_MODE: 'grepbot:farm-full-mode',
    AB_AUTO: 'grepbot:ab-auto',
    AUTO_WALL_REPAIR: 'grepbot:auto-wall-repair',
    POP_RESCUE_FARM: 'grepbot:pop-rescue-farm',
    AB_TARGETS: 'grepbot:ab-targets',
    AB_RANDOM: 'grepbot:ab-random',
    AB_RANDOM_PICK: 'grepbot:ab-random-pick',
    AUTO_CAVE: 'grepbot:auto-cave',
    CAVE_THRESH: 'grepbot:cave-thresh',
    CAVE_TOWNS: 'grepbot:cave-towns',
    EMERGENCY_CAVE_AUTO: 'grepbot:emergency-cave-auto',
    EMERGENCY_CAVE_CONFIRM: 'grepbot:emergency-cave-confirm',
    EMERGENCY_CAVE_MIN: 'grepbot:emergency-cave-min',
    EMERGENCY_LAST: 'grepbot:emergency-last-stash',
    IB_ACTION: 'grepbot:ib-action',
    IB_RESEARCH: 'grepbot:ib-research',
    FARM_OPTION_MAP: 'grepbot:farm-option-map',
    FARM_LONG_CLAIMS: 'grepbot:farm-long-claims',
    FARM_LOYALTY_TECH: 'grepbot:farm-loyalty-tech',
    FARM_PROFIT: 'grepbot:farm-profit',
    ADAPTIVE_FARM: 'grepbot:adaptive-farm',
    FARM_DROP_PCT: 'grepbot:farm-drop-pressure-pct',
    FARM_CLAIMS_TODAY: 'grepbot:farm-claims-today',
    FARM_CLAIMS_DAY: 'grepbot:farm-claims-day',
    FARM_UNITS_MODE: 'grepbot:farm-units-mode',
    FARM_UNITS_PREF: 'grepbot:farm-units-pref',
    FARM_UNITS_OPTION: 'grepbot:farm-units-option',
    FARM_RES_DRY: 'grepbot:farm-res-dry',
    FARM_RES_DRY_DAY: 'grepbot:farm-res-dry-day',
    FARM_TRAVEL: 'grepbot:farm-travel-sec-per-unit',
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
    TRADE_TOWNS: 'grepbot:trade-towns',
    TRADE_OVERFLOW: 'grepbot:trade-overflow',
    TRADE_TRANSFER_PCT: 'grepbot:trade-transfer-pct',
    TRADE_RECEIVER_PCT: 'grepbot:trade-receiver-pct',
    TRADE_ROUTES: 'grepbot:trade-routes',
    AUTO_TRADE_ROUTES: 'grepbot:auto-trade-routes',
    AUTO_TRANSPORT: 'grepbot:auto-transport',
    AUTO_DUMP: 'grepbot:auto-dump',
    DUMP_THRESHOLD: 'grepbot:dump-threshold',
    DUMP_KEEP: 'grepbot:dump-keep',
    DUMP_SINKS: 'grepbot:dump-sinks',
    TRANSPORT_RESERVE: 'grepbot:transport-reserve',
    TRANSPORT_MIN: 'grepbot:transport-min',
    RESOURCE_OPTIMIZER_CFG: 'grepbot:resource-optimizer-cfg',
    AUTO_RURAL_TRADE: 'grepbot:auto-rural-trade',
    ISLAND_BENEFICIARIES: 'grepbot:island-beneficiaries-v1',
    AUTO_RURAL_LEVEL: 'grepbot:auto-rural-level',
    RURAL_LEVEL_MAX: 'grepbot:rural-level-max',
    AUTO_RESEARCH: 'grepbot:auto-research',
    RESEARCH_TARGETS: 'grepbot:research-targets',
    CITY_TEMPLATES: 'grepbot:city-templates',
    TOWN_GROUPS: 'grepbot:town-groups',
    WEBHOOK_URL: 'grepbot:webhook-url',
    WEBHOOK_EVENTS: 'grepbot:webhook-events',
    TELEGRAM_ENABLED: 'grepbot:telegram-enabled',
    TELEGRAM_BOT_TOKEN: 'grepbot:telegram-bot-token',
    TELEGRAM_CHAT_ID: 'grepbot:telegram-chat-id',
    TELEGRAM_CAPTCHA: 'grepbot:telegram-captcha',
    TELEGRAM_CAPTCHA_RESOLVED: 'grepbot:telegram-captcha-resolved',
    TELEGRAM_CAPTCHA_STATE: 'grepbot:telegram-captcha-state',
    TELEGRAM_EVENTS: 'grepbot:telegram-events-v1',
    TELEGRAM_MONITOR_STATE: 'grepbot:telegram-monitor-state-v1',
    TELEGRAM_WAREHOUSE_PCT: 'grepbot:telegram-warehouse-pct',
    TELEGRAM_WAREHOUSE_MIN: 'grepbot:telegram-warehouse-min',
    TELEGRAM_DIAG_STATE: 'grepbot:telegram-diag-state-v1',
    NOTIFY_ENABLED: 'grepbot:notify-enabled',
    NOTIFY_EVENTS: 'grepbot:notify-events',
    NOTIFY_VOLUME: 'grepbot:notify-volume',
    NOTIFY_MUTED: 'grepbot:notify-muted',
    AUTO_MERCHANT: 'grepbot:auto-merchant',
    MERCHANT_WISH: 'grepbot:merchant-wish',
    GOLD_ENABLED: 'grepbot:gold-enabled',
    GOLD_BATCH: 'grepbot:gold-batch',
    GOLD_TOWNS: 'grepbot:gold-towns-v1',
    GOLD_ACTIONS: 'grepbot:gold-actions-v1',
    GOLD_SEAS: 'grepbot:gold-seas-v1',
    GOLD_REVIEWS: 'grepbot:gold-reviews-v1',
    GOLD_HUB: 'grepbot:gold-hub',
    GOLD_PENDING: 'grepbot:gold-pending',
    GOLD_STATS: 'grepbot:gold-stats',
    GOLD_LAST: 'grepbot:gold-last',
    GOLD_SALE: 'grepbot:gold-sale-v1',
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
    BATCH_RECRUIT: 'grepbot:batch-recruit',
    BATCH_RECRUIT_LISTS: 'grepbot:batch-recruit-lists',
    NATIVE_RECRUIT_LAST_QTY: 'grepbot:native-recruit-last-qty',

    RECRUIT_PACKS: 'grepbot:recruit-packs',
    PRIORITY_ORDER: 'grepbot:priority-order',
    ISLAND_SHIP: 'grepbot:island-ship',
    AUTO_MILITIA: 'grepbot:auto-militia',
    MILITIA_CFG: 'grepbot:militia-cfg',
    CS_ALERT: 'grepbot:cs-alert',
    PLAYER_NOTES: 'grepbot:player-notes',
    WATCHLIST: 'grepbot:watchlist',
    AUTO_SPY: 'grepbot:auto-spy',
    SPY_CFG: 'grepbot:spy-cfg',
    SPY_HISTORY: 'grepbot:spy-history',
    SPY_TPL: 'grepbot:spy-tpl',
    SPY_SEND_CFG: 'grepbot:spy-send-cfg',
    SPY_SEND_HISTORY: 'grepbot:spy-send-history',
    GREPODATA_INDEX: 'grepbot:grepodata-index',
    CAPTCHA_GLOBAL: 'grepbot:captcha-global',
    CAPTCHA_GLOBAL_UNTIL: 'grepbot:captcha-global-until',
    REQ_BUDGET: 'grepbot:req-budget',
    ALLIANCE_NOTES: 'grepbot:alliance-notes',
    NAP_STATUS: 'grepbot:nap-status',
    INTEL_DIGEST: 'grepbot:intel-digest',
    INTEL_ALLY_FILTER: 'grepbot:intel-alliance-filter',
    INTEL_BATTLE_STATS: 'grepbot:intel-battle-stats',
    CONFIG_VER: 'grepbot:config-ver',
    GLOBAL_CONFIG_VER: 'grepbot:global-config-ver',
    LEGACY_WORLD_MIGRATION: 'grepbot:legacy-world-migration-v1',
    CONFIG_UNDO: 'grepbot:config-undo',
    CONFIG_REDO: 'grepbot:config-redo',
    WONDER_SPENT: 'grepbot:wonder-spent',

    DECISIONS: 'grepbot:decisions',
    DECISION_SKIPS: 'grepbot:decision-skips',
    DECISION_MEM: 'grepbot:decision-memory',
    DRY_RUN: 'grepbot:dry-run',
    FIRST_POST_CONFIRM: 'grepbot:first-post-confirm',
    FIRST_POST_LIVE: 'grepbot:first-post-live',
    EXPORT_REDACT: 'grepbot:export-redact',
    SERVER_COOLDOWN: 'grepbot:server-cooldown',
    QUEST_CLAIM_FAIL: 'grepbot:quest-claim-fail',
    DODGE_QUEUE: 'grepbot:dodge-queue',
    AUTO_COLLECT: 'grepbot:auto-collect',
    TX_STATE: 'grepbot:tx-state',
    CIRCUITS: 'grepbot:circuits',
    CIRCUIT_AUTO_CLEAR: 'grepbot:circuit-auto-clear',
    AB_ORDER: 'grepbot:ab-order',
    AB_OPTIMAL_ORDER: 'grepbot:ab-optimal-order',
    AB_OPTIMAL_ORDER_ON: 'grepbot:ab-optimal-order-on',
    PLANNER_CFG: 'grepbot:planner-cfg',
    GOAL_PROFILES: 'grepbot:goal-profiles',
    TOWN_GOALS: 'grepbot:town-goals',
    ROLE_ADVISOR_CFG: 'grepbot:role-advisor-cfg',
    ROLE_ASSIGNMENTS: 'grepbot:role-assignments',
    VIRTUAL_QUEUE: 'grepbot:virtual-queue',
    VIRTUAL_QUEUE_OVERRIDES: 'grepbot:virtual-queue-overrides',
    NATIVE_QUEUE: 'grepbot:native-action-queue',
    BUILD_SWAP_MIN: 'grepbot:build-swap-threshold-min',
    BUILD_SWAP_IGNORE: 'grepbot:build-swap-ignore',
    PREDICT_CFG: 'grepbot:predict-cfg',
    DEFENSE_CFG: 'grepbot:defense-cfg',
    DEFENSE_HISTORY: 'grepbot:defense-history',
    SUPPORT_CFG: 'grepbot:support-cfg',
    SUPPORT_LAST_SEND: 'grepbot:support-last-send',
    SUPPORT_TEMPLATE: 'grepbot:support-tpl',
    REINFORCE_PLAN: 'grepbot:reinforce-plan',
    REINFORCE_HISTORY: 'grepbot:reinforce-history',
    DODGE_RETURNS: 'grepbot:dodge-returns',
    HEALTH: 'grepbot:health',
    SNAPSHOTS: 'grepbot:snapshots',
    SNAPSHOTS_ON: 'grepbot:snapshots-on',
    PROFILER_ON: 'grepbot:profiler-on',
    MEM_PROBE_ON: 'grepbot:mem-probe-on',
    CLIENT_FP: 'grepbot:client-fingerprint',
    SAFE_MODE: 'grepbot:safe-mode',
    SIM_CFG: 'grepbot:sim-cfg',
    WHY_LOG: 'grepbot:why-log',
    TPL_HEALTH: 'grepbot:tpl-health',
    CAPTCHA_LADDER: 'grepbot:captcha-ladder',
    POSTS_SOFT_PCT: 'grepbot:posts-soft-pct',
    TAB_FILTERS: 'grepbot:tab-filters',
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
    RECRUIT_QCAP: 'grepbot:recruit-qcap',
    FARM_SCRAPE: 'grepbot:farm-scrape',
    TOWN_ACTION: 'grepbot:town-action',
    TOWN_LIST_ACTION: 'grepbot:town-list-action',
    FARM_SCRAPE_STATE: 'grepbot:farm-scrape-state',
    AUTO_VILLAGE_RECRUIT: 'grepbot:auto-village-recruit',
    VILLAGE_RECRUIT_FILL: 'grepbot:village-recruit-fill',
    VILLAGE_RECRUIT_AMOUNT: 'grepbot:village-recruit-amount',
    ACCEPT_UNITS_TPL: 'grepbot:accept-units-tpl',
    VILLAGE_RECRUIT_STREAKS: 'grepbot:village-recruit-streaks',
    WEBHOOK_RATELIMIT: 'grepbot:webhook-ratelimit',
    WEBHOOK_PENDING: 'grepbot:webhook-pending',
  };
  // Technical iteration order only. It never reserves resources or gives a module economic priority.
  const ORCH_ORDER_DEFAULT = ['culture', 'cave', 'build', 'research', 'trade', 'farm',
    'ruraltrade', 'rurallevel', 'recruit', 'villrecruit', 'batchrecruit', 'merchant', 'pttrade', 'favor', 'wonder', 'hero', 'godspell', 'spy'];
  const CONFIG_VER_CURRENT = 18;
  const GLOBAL_CONFIG_VER_CURRENT = 1;
  const WORLD_SCOPED_BASES = new Set([
    STORE.FINDINGS, STORE.FARMS, STORE.FARMS_PARSED, STORE.FARM_RES, STORE.SEEN,
    STORE.TOWNS, STORE.TOWN_RES, STORE.TOWN_GROWTH_HIST, STORE.THRESH, STORE.ALERTED,
    STORE.NEXT_FARM, STORE.NEXT_FARM_CLAIM, STORE.NEXT_TOWNS, STORE.BANDIT_LOG,
    STORE.AB_SCRIPT,
    STORE.CSRF, STORE.FARM_ACTION, STORE.COLLECT_TPL, STORE.CLAIM_TPL, STORE.ACCEPT_UNITS_TPL,
    STORE.IB_ACTION, STORE.IB_ACTION_R, STORE.FARM_OPTION_MAP, STORE.FARM_LOYALTY_TECH, STORE.FARM_PROFIT, STORE.FARM_TRAVEL, STORE.FARM_CLAIMS_TODAY, STORE.FARM_CLAIMS_DAY,
    STORE.FARM_UNITS_OPTION, STORE.FARM_RES_DRY, STORE.FARM_RES_DRY_DAY,
    STORE.QUEST_REWARDS, STORE.QUEST_HISTORY,
    STORE.ATTACK_TPL, STORE.CANCEL_TPL, STORE.HERO_TPL, STORE.HERO_EQUIP_SUGGEST, STORE.ATTACK_PLAN, STORE.ATTACK_HISTORY, STORE.ATTACK_RECENT, STORE.CAPTCHA,
    STORE.AB_TARGETS, STORE.AB_RANDOM_PICK, STORE.CAVE_TOWNS, STORE.EMERGENCY_LAST,
    STORE.RESEARCH_TARGETS, STORE.CITY_TEMPLATES, STORE.TOWN_GROUPS, STORE.DUMP_SINKS,
    STORE.MERCHANT_WISH, STORE.FAVOR_CFG, STORE.WONDER_CFG, STORE.WONDER_SPENT,
    STORE.CULTURE_GOLD_SPENT,
    STORE.GOLD_TOWNS, STORE.GOLD_ACTIONS, STORE.GOLD_SEAS, STORE.GOLD_REVIEWS,
    STORE.GOLD_HUB, STORE.GOLD_PENDING, STORE.GOLD_STATS, STORE.GOLD_LAST, STORE.GOLD_SALE,

    STORE.RECRUIT_TARGETS, STORE.BATCH_RECRUIT_LISTS, STORE.PRIORITY_ORDER,
    STORE.PLAYER_NOTES, STORE.WATCHLIST, STORE.ALLIANCE_NOTES, STORE.NAP_STATUS, STORE.SPY_CFG, STORE.SPY_HISTORY, STORE.SPY_TPL, STORE.SPY_SEND_CFG, STORE.SPY_SEND_HISTORY,
    STORE.CAPTCHA_GLOBAL_UNTIL,
    STORE.SERVER_COOLDOWN, STORE.QUEST_CLAIM_FAIL, STORE.DODGE_QUEUE,
    STORE.TRADE_TOWNS, STORE.TRADE_ROUTES, STORE.AUTO_TRADE_ROUTES, STORE.ISLAND_BENEFICIARIES, STORE.RESOURCE_OPTIMIZER_CFG, STORE.TX_STATE, STORE.CIRCUITS, STORE.AB_ORDER, STORE.AB_OPTIMAL_ORDER, STORE.PLANNER_CFG, STORE.GOAL_PROFILES, STORE.TOWN_GOALS, STORE.ROLE_ADVISOR_CFG, STORE.ROLE_ASSIGNMENTS, STORE.VIRTUAL_QUEUE, STORE.VIRTUAL_QUEUE_OVERRIDES, STORE.NATIVE_QUEUE, STORE.BUILD_SWAP_IGNORE, STORE.PREDICT_CFG, STORE.DEFENSE_CFG, STORE.DEFENSE_HISTORY, STORE.MILITIA_CFG, STORE.SUPPORT_CFG, STORE.SUPPORT_LAST_SEND, STORE.SUPPORT_TEMPLATE, STORE.REINFORCE_PLAN, STORE.REINFORCE_HISTORY, STORE.DODGE_RETURNS, STORE.HEALTH, STORE.SNAPSHOTS, STORE.CLIENT_FP, STORE.SAFE_MODE, STORE.SIM_CFG, STORE.WHY_LOG, STORE.DECISIONS, STORE.DECISION_SKIPS, STORE.CONFIG_VER, STORE.CONFIG_UNDO, STORE.CONFIG_REDO,
    STORE.FARM_LOYALTY_SEEN, STORE.FARM_TEACH_BANNER,
    STORE.TPL_HEALTH, STORE.LAST_SEEN_TS, STORE.WATCH_HITS, STORE.WONDER_FAVOR_TPL,
    STORE.SPELL_COOLDOWN, STORE.RECRUIT_QCAP,

    STORE.FARM_SCRAPE, STORE.FARM_SCRAPE_STATE, STORE.TOWN_ACTION, STORE.TOWN_LIST_ACTION,
    STORE.PT_TRADE_TPL, STORE.PT_VIEW_URL,
    STORE.FIRST_POST_LIVE,
    STORE.WEBHOOK_RATELIMIT, STORE.WEBHOOK_PENDING, STORE.TELEGRAM_CAPTCHA_STATE, STORE.TELEGRAM_MONITOR_STATE, STORE.TELEGRAM_DIAG_STATE,
  ]);
  function wkey(base) { return base + '@' + location.hostname; }
  // The ONLY numeric read for client values. `+raw` maps null, '', ' ', [] and
  // false onto a finite 0, which turns an unreadable getter into a real reading
  // ("level 0", "queue empty") and makes a guard block on a value it never read.
  // A finite number or a non-blank numeric string is a reading; anything else
  // is null and the caller's unreadable branch takes over.
  function gbNum(raw) {
    if (raw == null || typeof raw === 'boolean') return null;
    if (typeof raw === 'string') { if (!raw.trim()) return null; }
    else if (typeof raw !== 'number') return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  }
  // Diagnostics and exports may contain arbitrary wire data. Keep redaction
  // bounded and separate from operational payloads: callers explicitly opt in
  // when producing human-visible data, never on a request that will be sent.
  const GB_REDACT_KEY_RE = /token|secret|password|authorization|cookie|csrf|captcha|\bmac\b|api[_-]?key|\bkey\b|telegram.*(?:token|chat)|bearer/i;
  function gbRedact(value, opts, depth, seen, budget) {
    const o = opts || {};
    const maxDepth = gbNum(o.maxDepth) != null ? Math.max(1, Math.floor(gbNum(o.maxDepth))) : 6;
    const maxEntries = gbNum(o.maxEntries) != null ? Math.max(1, Math.floor(gbNum(o.maxEntries))) : 240;
    const maxString = gbNum(o.maxString) != null ? Math.max(16, Math.floor(gbNum(o.maxString))) : 240;
    const d = depth || 0;
    const visited = seen || new Set();
    const left = budget || { n: maxEntries };
    const text = raw => {
      let s = String(raw == null ? '' : raw);
      // URLs often carry credentials in their query string. Do not preserve
      // either the parameter value or a potentially signed whole URL.
      s = s
        .replace(/([?&](?:token|secret|key|auth|authorization|csrf|captcha|mac)=)[^&#\s]*/ig, '$1[redacted]')
        .replace(/((?:["']?\b(?:token|secret|password|authorization|cookie|csrf|captcha|mac|api[_-]?key|key)\b["']?)\s*[:=]\s*["']?)[^\s,;&"'}\[\]]+/ig, '$1[redacted]')
        .replace(/(https?:\/\/api\.telegram\.org\/bot)[^/\s]+/ig, '$1[redacted]')
        .replace(/(https?:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/)[^\s/]+/ig, '$1[redacted]');
      return s.length > maxString ? s.slice(0, maxString) + '…' : s;
    };
    if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') return text(value);
    if (typeof value !== 'object') return text(value);
    if (d >= maxDepth) return '[truncated-depth]';
    if (visited.has(value)) return '[cycle]';
    visited.add(value);
    const out = Array.isArray(value) ? [] : Object.create(null);
    const entries = Array.isArray(value) ? value.entries() : Object.entries(value);
    for (const [key, item] of entries) {
      if (left.n-- <= 0) {
        if (Array.isArray(out)) out.push('[truncated]');
        else out['[truncated]'] = true;
        break;
      }
      const name = String(key);
      if (name === '__proto__' || name === 'constructor' || name === 'prototype') continue;
      out[key] = GB_REDACT_KEY_RE.test(name) ? '[redacted]' : gbRedact(item, o, d + 1, visited, left);
    }
    visited.delete(value);
    return out;
  }
  // Naval mythicals train at the harbor (building_docks), not the temple.
  // GameData.is_naval is unreliable for this set in some worlds, so the
  // heuristic needs an explicit fallback. Single shared helper so recruiters
  // and lane classifiers agree on what is naval.
  const NAVAL_MYTHICAL_UNITS = new Set(['hydra']);
  // Poseidon mythicals (hydra, sea monsters) often lack `def.god` in some
  // GameData builds while still carrying a non-zero favor cost — a favor gate
  // keyed only on def.god hard-blocks the unit even with plenty of Poseidon
  // favor. Fill the gap from this map. Add a new naval mythical here AND to
  // NAVAL_MYTHICAL_UNITS in the same patch.
  const MYTHICAL_UNIT_GOD = { hydra: 'poseidon' };
  function mythicalUnitGod(unitId) {
    const fid = unitId == null ? '' : String(unitId).toLowerCase();
    if (!fid) return null;
    try {
      const m = MYTHICAL_UNIT_GOD[fid];
      return m ? String(m).toLowerCase() : null;
    } catch (_) { return null; }
  }
  function recruitIsNaval(unitId) {
    const fid = unitId == null ? '' : String(unitId);
    try {
      const d = gbGameDataLookup("units", fid);
      if (!d) return NAVAL_MYTHICAL_UNITS.has(fid);
      if (d.is_naval || d.naval) return true;
      if (NAVAL_MYTHICAL_UNITS.has(fid)) return true;
      if (d.controller === 'building_docks') return true;
      return false;
    } catch (_) { return NAVAL_MYTHICAL_UNITS.has(fid); }
  }
  const LOAD_MAX_CHARS = 2 * 1024 * 1024;
  const GB_STORAGE_MISSING = Object.freeze({});
  // A read error is different from a missing key. Keep the distinction for the
  // whole lifetime of this instance so a fallback value can never overwrite a
  // valid persisted value after a transient GM_getValue failure.
  const gbStorageReadFailedKeys = new Set();
  function gbStorageReadKey(key) { return String(key); }
  function gbStorageReadFailed(key) { return gbStorageReadFailedKeys.has(gbStorageReadKey(key)); }
  function gbStorageProtectRead() {
    for (const key of arguments) if (key != null) gbStorageReadFailedKeys.add(gbStorageReadKey(key));
  }
  let gbLegacyWorldGateCache = null;
  let gbLegacyWorldProofCache = null;
  function gbStorageRawRead(key, logicalKey) {
    try {
      const value = GM_getValue(key, GB_STORAGE_MISSING);
      if (value === GB_STORAGE_MISSING) return { status:'missing', value:null };
      const status = loadValueStatus(value, key);
      if (status === 'invalid' || status === 'too-large') gbStorageProtectRead(logicalKey || key, key);
      return { status, value };
    } catch (error) {
      gbStorageProtectRead(logicalKey || key, key);
      return { status: 'read-error', value: null, error };
    }
  }
  function gbLegacyWorldHostProof() {
    if (gbLegacyWorldProofCache) return gbLegacyWorldProofCache;
    const enabled = gbStorageRawRead(STORE.ENABLED_HOSTS, STORE.ENABLED_HOSTS);
    if (enabled.status !== 'valid' || !enabled.value || typeof enabled.value !== 'object' || Array.isArray(enabled.value)) {
      return (gbLegacyWorldProofCache = { proven:false, reason:'legacy-enabled-hosts-unavailable' });
    }
    const hosts = Object.keys(enabled.value).filter(host =>
      /\.grepolis\.com$/i.test(String(host)) && enabled.value[host] === true);
    const current = String(location.host || location.hostname || '');
    const proven = hosts.length === 1 && hosts[0] === current;
    return (gbLegacyWorldProofCache = { proven, reason:proven?'unique-legacy-host':'legacy-host-ambiguous', hosts, current });
  }
  function gbLegacyWorldGate() {
    if (gbLegacyWorldGateCache) return gbLegacyWorldGateCache;
    const marker = gbStorageRawRead(STORE.LEGACY_WORLD_MIGRATION, STORE.LEGACY_WORLD_MIGRATION);
    if (marker.status !== 'missing') {
      return (gbLegacyWorldGateCache = { allowed:false, reason:marker.status === 'valid' ? 'legacy-consumed' : marker.status });
    }
    const scopedVersion = gbStorageRawRead(wkey(STORE.CONFIG_VER), STORE.CONFIG_VER);
    if (scopedVersion.status !== 'missing' && scopedVersion.status !== 'valid') {
      return (gbLegacyWorldGateCache = { allowed:false, reason:scopedVersion.status });
    }
    if (scopedVersion.status === 'valid' && +scopedVersion.value >= 3) {
      return (gbLegacyWorldGateCache = { allowed:false, reason:'world-scope-established' });
    }
    const proof = gbLegacyWorldHostProof();
    return (gbLegacyWorldGateCache = { allowed:proof.proven, reason:proof.reason, proof });
  }
  function gbLegacyWorldFallbackAllowed(key) {
    if (key === STORE.CONFIG_VER) return false;
    return gbLegacyWorldGate().allowed === true;
  }
  function gbLegacyWorldOneShotEligible() {
    const marker = gbStorageRawRead(STORE.LEGACY_WORLD_MIGRATION, STORE.LEGACY_WORLD_MIGRATION);
    if (marker.status !== 'missing') return false;
    return gbLegacyWorldHostProof().proven === true;
  }
  function gbLegacyWorldMigrationFinalize() {
    const marker = gbStorageRawRead(STORE.LEGACY_WORLD_MIGRATION, STORE.LEGACY_WORLD_MIGRATION);
    if (marker.status === 'valid') return true;
    if (marker.status !== 'missing') return false;
    const proof = gbLegacyWorldHostProof();
    if (!proof.proven) return true;
    const scopedVersion = gbStorageRawRead(wkey(STORE.CONFIG_VER), STORE.CONFIG_VER);
    if (scopedVersion.status !== 'valid' || !(+scopedVersion.value >= 3)) return false;
    const out = { consumed:true, version:1, host:String(location.hostname || location.host || ''), at:Date.now() };
    const ok = save(STORE.LEGACY_WORLD_MIGRATION, out);
    if (ok) gbLegacyWorldGateCache = { allowed:false, reason:'legacy-consumed', marker:out };
    return ok;
  }
  function migrateGlobalConfig() {
    if (!gbTabLeader) return false;
    const marker = gbStorageRawRead(STORE.GLOBAL_CONFIG_VER, STORE.GLOBAL_CONFIG_VER);
    const markerVer = marker.status === 'valid'
      ? +(marker.value && typeof marker.value === 'object' ? marker.value.version : marker.value)
      : 0;
    if (marker.status === 'valid' && markerVer >= GLOBAL_CONFIG_VER_CURRENT) return true;
    if (marker.status !== 'missing' && marker.status !== 'valid') return false;

    const legacyVersionRead = gbStorageRawRead(STORE.CONFIG_VER, STORE.GLOBAL_CONFIG_VER);
    if (legacyVersionRead.status !== 'missing' && legacyVersionRead.status !== 'valid') return false;
    const legacyVersion = legacyVersionRead.status === 'valid' && Number.isFinite(+legacyVersionRead.value)
      ? +legacyVersionRead.value : null;
    // Global preferences are user choices shared across worlds. Adopting a
    // separate schema records provenance only; it must never replay a world
    // migration over AUTO_FAVOR, RECRUIT_SPELLS, or any other manual choice.
    const globalMarker = { version:GLOBAL_CONFIG_VER_CURRENT, from:legacyVersion, host:String(location.hostname || ''), at:Date.now() };
    return save(STORE.GLOBAL_CONFIG_VER, globalMarker);
  }
  const GB_ROOT = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
  if (typeof GB_ROOT.__grepbotDispose === 'function') {
    try { GB_ROOT.__grepbotDispose(); } catch (_) {}
  }
  const GB_INSTANCE_ID = 'gb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  GB_ROOT.__grepbotInstanceId = GB_INSTANCE_ID;
  let gbDisposed = false;
  const gbTabCoordSupported=!!(navigator.locks&&typeof navigator.locks.request==='function');
  const gbTabLockName='grepbot-leader:'+location.hostname;
  // Fail closed when Web Locks are unavailable. Treating every tab as leader is
  // unsafe because feature locks and TX state are otherwise instance-local.
  let gbTabLeader=false,gbTabLockPending=false,gbTabLockRelease=null;
  function gbInstanceAlive() {
    return !gbDisposed && GB_ROOT.__grepbotInstanceId === GB_INSTANCE_ID;
  }
  const gbTimerBag = [];
  const gbListenerBag = [];
  const gbXhrBag = [];
  const gbMenuCmds = [];
  const gbStyleBag = [];
  const gbHookOrig = { fetch: null, xhrOpen: null, xhrSend: null, pushState: null, replaceState: null };

  let gbListenerAbort = null;
  let gbListenerSignal = null;
  gbListenerAbort = new AbortController();
  gbListenerSignal = gbListenerAbort.signal;
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

  function gbClearInterval(id) {
    if (!id) return;
    try { clearInterval(id); } catch (_) {}
    const i = gbTimerBag.findIndex(t => t.kind === 'i' && t.id === id);
    if (i >= 0) gbTimerBag.splice(i, 1);
  }
  function gbTryAcquireTabLeader() {
    if (gbDisposed || gbTabLeader || gbTabLockPending) return;
    if (!gbTabCoordSupported) {
      gbTabLeader = false;
      try { console.warn('[grepbot] Web Locks unavailable: automation disabled to avoid multi-tab split brain'); } catch (_) {}
      return;
    }
    gbTabLockPending = true;
    navigator.locks.request(gbTabLockName, { mode:'exclusive', ifAvailable:true }, lock => {
      gbTabLockPending = false;
      if (!gbInstanceAlive()) return;
      if (!lock) {
        gbTabLeader = false;
        gbTimeout(gbTryAcquireTabLeader, 5000);
        try { updateStatus(); } catch (_) {}
        return;
      }
      gbTabLeader = true;
      try { updateStatus(); } catch (_) {}
      // Run after the userscript's synchronous initialization is complete. The
      // hook reloads shared runtime state and idempotently ensures schedulers.
      gbTimeout(() => { try { gbHandleLeadershipAcquired('web-lock'); } catch (e) { try { gbLog('leader acquire hook failed', String(e)); } catch (_) {} } }, 0);
      return new Promise(resolve => { gbTabLockRelease = resolve; });
    }).catch(err => {
      gbTabLockPending = false;
      gbTabLeader = false;
      try { console.warn('[grepbot] Web Locks leader request failed', err); } catch (_) {}
      if (gbInstanceAlive()) gbTimeout(gbTryAcquireTabLeader, 10000);
    });
  }
  gbTryAcquireTabLeader();
  function gbListen(target, type, fn, opts) {
    if (!target || !target.addEventListener) return null;
    const wrapped = function () {
      if (!gbInstanceAlive()) return;
      return fn.apply(this, arguments);
    };
    const o = Object.assign({}, opts || {}, { signal: gbListenerSignal });
    target.addEventListener(type, wrapped, o);
    gbListenerBag.push({ target, type, fn: wrapped, opts });
    return wrapped;
  }

  function gbPaint(host, build, opts) {
    if (!host || typeof build !== 'function') return 'skip';
    const o = opts || {};
    const stage = document.createElement('div');

    const ae = document.activeElement;
    const selSnap = (ae && typeof ae.id === 'string' && ae.id && typeof ae.setSelectionRange === 'function' && ae.selectionStart != null)
      ? { id: ae.id, start: ae.selectionStart, end: ae.selectionEnd, dir: ae.selectionDirection || 'forward' }
      : null;
    build(stage);
    const key = String(o.key == null ? '' : o.key);
    const top = host.scrollTop;
    let out;
    if (host.dataset.gbPaintKey !== key) {
      host.replaceChildren.apply(host, Array.prototype.slice.call(stage.childNodes));
      host.dataset.gbPaintKey = key;
      out = 'replace';
    } else {
      const r = gbPaintPatch(host, stage);
      if (r === false) {
        host.replaceChildren.apply(host, Array.prototype.slice.call(stage.childNodes));
        out = 'replace';
      } else out = r ? 'patch' : 'same';
    }
    if (out === 'replace' && top && host.scrollHeight > host.clientHeight) {
      host.scrollTop = Math.min(top, host.scrollHeight - host.clientHeight);
    }
    if (out === 'replace' && selSnap) {
      const fresh = host.querySelector('#' + (window.CSS && CSS.escape ? CSS.escape(selSnap.id) : selSnap.id));
      if (fresh && fresh !== document.activeElement && typeof fresh.setSelectionRange === 'function') {
        try { fresh.focus(); fresh.setSelectionRange(selSnap.start, selSnap.end, selSnap.dir); } catch (_) {}
      }
    }
    return out;
  }

  function gbPaintPatch(cur, next) {
    if (cur.childNodes.length !== next.childNodes.length) return false;
    let wrote = 0;
    for (let i = 0; i < cur.childNodes.length; i++) {
      const a = cur.childNodes[i], b = next.childNodes[i];
      if (a.nodeType !== b.nodeType) return false;
      if (a.nodeType === 3 || a.nodeType === 8) {
        if (a.data !== b.data) { a.data = b.data; wrote = 1; }
        continue;
      }
      if (a.nodeType !== 1) return false;
      if (a.tagName !== b.tagName) return false;
      // Nested keyed regions repaint themselves after their parent. Their
      // staged placeholder deliberately has no children, so traversing it
      // here would force the parent to replace user-owned controls on every
      // dashboard refresh.
      if (a.hasAttribute('data-gb-paint-island') && b.hasAttribute('data-gb-paint-island')) continue;
      const an = a.attributes, bn = b.attributes;
      for (let k = an.length - 1; k >= 0; k--) {
        if (a.tagName === 'DETAILS' && an[k].name === 'open') continue;
        if (!b.hasAttribute(an[k].name)) { a.removeAttribute(an[k].name); wrote = 1; }
      }
      for (let k = 0; k < bn.length; k++) {
        if (a.tagName === 'DETAILS' && bn[k].name === 'open') continue;
        if (a.getAttribute(bn[k].name) !== bn[k].value) { a.setAttribute(bn[k].name, bn[k].value); wrote = 1; }
      }
      const r = gbPaintPatch(a, b);
      if (r === false) return false;
      if (r) wrote = 1;

      if (a === document.activeElement) continue;
      if (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') {
        if (a.type === 'checkbox' || a.type === 'radio') {
          if (!a.hasAttribute('data-gb-paint-preserve') && a.checked !== b.checked) { a.checked = b.checked; wrote = 1; }
        } else if (a.value !== b.value) { a.value = b.value; wrote = 1; }
      }
    }
    return wrote;
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
  function gbLeaderHandoverFlush() {
    if (!gbTabLeader) return false;
    // All callbacks are already blocked by gbDisposed, but the Web Lock and
    // leader flag are deliberately retained until every leader-owned write has
    // reached storage.
    try { if (typeof txDispose === 'function') txDispose(); } catch (_) {}
    try { if (typeof jrnFlush === 'function') jrnFlush(); } catch (_) {}
    try { if (typeof nativeQueueSaveFlush === 'function') nativeQueueSaveFlush(); } catch (_) {}
    try { if (typeof healthSaveFlush === 'function') healthSaveFlush(); } catch (_) {}
    try { if (typeof dodgeQueueSave === 'function') dodgeQueueSave(); } catch (_) {}
    try { if (typeof questClaimFailSave === 'function') questClaimFailSave(); } catch (_) {}
    try { if (typeof persistServerCooldown === 'function') persistServerCooldown(); } catch (_) {}
    try { if (typeof saveFlush === 'function') saveFlush(); } catch (_) {}
    return true;
  }

  GB_ROOT.__grepbotDispose = function grepbotDispose() {
    if (gbDisposed) return;
    gbDisposed = true;
    if (gbTabLeader) gbLeaderHandoverFlush();

    try { if (typeof gbAjaxDispose === 'function') gbAjaxDispose(); } catch (_) {}
    try { if (typeof banditClearLoop === 'function') banditClearLoop(); } catch (_) {}
    try { if (typeof banditClearScan === 'function') banditClearScan(); } catch (_) {}
    gbClearTimers();
    gbAbortXhrs();
    gbRestoreHooks();
    gbUnregisterMenus();

    try { gbListenerAbort.abort(); } catch (_) {}
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

    try { gbWidgetDisposeAll(); } catch (_) {}
    try { contextMenuStop(); } catch (_) {}
    try { document.querySelectorAll('.gb-widget').forEach(el => el.remove()); } catch (_) {}
    try { document.querySelectorAll('.gb-native-qctl,.gb-native-panel,.gb-native-qpop').forEach(el=>el.remove()); } catch (_) {}
    gbRemoveStyles();

    // Handover order is a safety boundary: persisted state -> flush -> finish
    // local cleanup -> release Web Lock -> follower flag.
    if(gbTabLockRelease){try{gbTabLockRelease()}catch(_){}gbTabLockRelease=null}
    gbTabLeader=false;

    if (GB_ROOT.__grepbotTest && GB_ROOT.__grepbotTest.instanceId === GB_INSTANCE_ID) {
      try { delete GB_ROOT.__grepbotTest; } catch (_) { GB_ROOT.__grepbotTest = null; }
    }
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
    build: 300000,
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
    attack: 180000,
    support: 180000,
    recruit: 180000,
    'village-recruit': 180000,
    'defense-pull': 180000,
    cancel: 120000,
    hero: 180000,
    'collect-bg': 300000,
    'bandit-reward': 120000,
    'telegram-monitor': 60000,
    militia: 60000,
    'pt-trade': 180000,
    gold: 180000,
    'report-catchup': 300000,
    'quest-scan': 180000,
    'quest-auto': 180000,
  };
  const GB_LOCK_DEFAULT_TTL = 180000;
  const gbLocks = Object.create(null);
  const gbLockExpired = Object.create(null);
  const GB_LOCK_EXPIRED_MEMORY_MS = 600000;
  let gbLockSeq = 0;
  function gbLockTtl(name) {
    const key = String(name || '');
    if (GB_LOCK_TTL[key]) return GB_LOCK_TTL[key];
    const base = key.includes(':') ? key.slice(0, key.indexOf(':')) : key;
    return GB_LOCK_TTL[base] || GB_LOCK_DEFAULT_TTL;
  }
  function gbLockLease(name) {
    const L = gbLocks[name];
    if (!L) return null;
    if (Date.now() - L.at >= (L.ttl || gbLockTtl(name))) {
      delete gbLocks[name];
      gbLockExpired[name] = { token: L.token, at: Date.now() };
      gbLog(`lock: ${name} lease ${L.token} expired after ${Math.round((Date.now() - L.at) / 1000)}s`);
      return null;
    }
    return L;
  }

  function gbLockHeld(name) {
    const L = gbLocks[name];
    if (!L) return null;
    return (Date.now() - L.at < (L.ttl || gbLockTtl(name))) ? L : null;
  }
  function gbLocked(name) { return !!gbLockHeld(name); }
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

    if (token && gbLockExpired[name] && gbLockExpired[name].token === token) {
      if (Date.now() - gbLockExpired[name].at > GB_LOCK_EXPIRED_MEMORY_MS) delete gbLockExpired[name];
      else {
        delete gbLockExpired[name];
        gbLogT('lock-expired-' + name, 30000, `lock: unlock after lease expiry ${name} - raise GB_LOCK_TTL if this repeats`);
        return false;
      }
    }
    if (!L) return false;
    if (!token || L.token !== token) {
      gbLogT('lock-owner-' + name, 30000, `lock: refused foreign unlock ${name}`);
      return false;
    }
    delete gbLocks[name];
    delete gbLockExpired[name];
    return true;
  }
  function gbLockAge(name) { const L = gbLockHeld(name); return L ? Date.now() - L.at : 0; }
  function gbUnlockAll() {
    for (const k of Object.keys(gbLocks)) delete gbLocks[k];
    for (const k of Object.keys(gbLockExpired)) delete gbLockExpired[k];
  }
  function gbLockList() { return Object.keys(gbLocks).filter(k => !!gbLockHeld(k)); }
  function gbLockSweep() {
    for (const k of Object.keys(gbLocks)) gbLockLease(k);
    const cut = Date.now() - GB_LOCK_EXPIRED_MEMORY_MS;
    for (const k of Object.keys(gbLockExpired)) if (gbLockExpired[k].at < cut) delete gbLockExpired[k];
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
    csrf:     load(STORE.CSRF, null),
    nextFarmScrape: load(STORE.NEXT_FARM, 0),
    nextFarmClaim: load(STORE.NEXT_FARM_CLAIM, 0),
    nextTownsScrape: load(STORE.NEXT_TOWNS, 0),
    abScript: load(STORE.AB_SCRIPT, null),
    pauseOnActivity: load(STORE.PAUSE_ON_ACTIVITY, false),
    pauseActivityMs: load(STORE.PAUSE_ACTIVITY_MS, 3 * 60 * 1000),
    nightPause: load(STORE.NIGHT_PAUSE, false),
    nightStart: load(STORE.NIGHT_START, 0),
    nightEnd: load(STORE.NIGHT_END, 7),
    neverStop: load(STORE.NEVER_STOP, true),
    orchDeadlockResolve: load(STORE.ORCH_DEADLOCK, true),
    farmAction: load(STORE.FARM_ACTION, null),

    farmScrape: load(STORE.FARM_SCRAPE, false),

    townAction: load(STORE.TOWN_ACTION, null),
    townListAction: load(STORE.TOWN_LIST_ACTION, null),
    farmScrapeState: load(STORE.FARM_SCRAPE_STATE, null) || { dead: false, misses: 0 },
    collectAll: load(STORE.COLLECT_ALL, false),
    autoCollect: load(STORE.AUTO_COLLECT, false),
    collectTpl: load(STORE.COLLECT_TPL, null),
    autoBandit: load(STORE.AUTO_BANDIT, false),

    banditCfg: load(STORE.BANDIT_CFG, {}) || {},
    banditLog:  load(STORE.BANDIT_LOG, []),
    autoFarm:   load(STORE.AUTO_FARM, false),
    claimTpl:   load(STORE.CLAIM_TPL, null),
    ibAuto:     load(STORE.IB_AUTO, false),
    ibFreeThresh: load(STORE.IB_FREE_THRESH, 300),
    ibAction:   load(STORE.IB_ACTION, null),
    ibResearch: load(STORE.IB_RESEARCH, false),
    farmOptionMap: (() => {
      const m = load(STORE.FARM_OPTION_MAP, null);
      const option = m && typeof m === 'object' && !Array.isArray(m) ? +m[600] : NaN;
      // Never guess or retain a legacy option: indices differ by world and can
      // select an hours-long card.  The only accepted mapping is hand-taught 10m.
      return Number.isFinite(option) && option >= 1 && option <= 4 ? { 600: option } : {};
    })(),
    farmLongClaims: load(STORE.FARM_LONG_CLAIMS, true),
    farmLoyaltyTech: load(STORE.FARM_LOYALTY_TECH, '') || '',
    farmProfit: load(STORE.FARM_PROFIT, {}),
    adaptiveFarm: load(STORE.ADAPTIVE_FARM, false),
    farmDropPressurePct: load(STORE.FARM_DROP_PCT, 25),
    orchCadenceScale: load(STORE.ORCH_CADENCE_SCALE, 1) || 1,

    farmClaimsToday: load(STORE.FARM_CLAIMS_TODAY, {}) || {},
    farmClaimsDay: load(STORE.FARM_CLAIMS_DAY, '') || '',

    farmUnitsMode: load(STORE.FARM_UNITS_MODE, 'fallback') || 'fallback',
    farmUnitsPref: load(STORE.FARM_UNITS_PREF, 'auto') || 'auto',
    farmUnitsOption: load(STORE.FARM_UNITS_OPTION, null),
    farmResDry: load(STORE.FARM_RES_DRY, {}) || {},
    farmResDryDay: load(STORE.FARM_RES_DRY_DAY, '') || '',
    farmTravelSecPerUnit: load(STORE.FARM_TRAVEL, 0),
    ibActionR:  load(STORE.IB_ACTION_R, null),
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
    reinforcePlan: load(STORE.REINFORCE_PLAN, null),
    reinforceHistory: load(STORE.REINFORCE_HISTORY, []),
    spySendCfg: load(STORE.SPY_SEND_CFG, null),
    spySendHistory: load(STORE.SPY_SEND_HISTORY, []),
    captchaBreakers: load(STORE.CAPTCHA, null) || {},
    findingsFilter: load(STORE.FINDINGS_FILTER, { type: '', attacker: '' }),
    theme: load(STORE.THEME, 'dark'),
    contextMenu: load(STORE.CONTEXT_MENU, true),
    keyboardShortcuts: load(STORE.KEYBOARD_SHORTCUTS, true),
    keybindings: load(STORE.KEYBINDINGS, {}) || {},
    widgetGeom: load(STORE.WIDGET_GEOM, {}) || {},
    hudProduction: load(STORE.HUD_PRODUCTION, false),
    hudCountdown: load(STORE.HUD_COUNTDOWN, false),
    townGrowthHist: load(STORE.TOWN_GROWTH_HIST, {}) || {},
    panelGeom: load(STORE.PANEL_GEOM, null),
    activeTab: load(STORE.ACTIVE_TAB, 'overview'),
    farmSkipFull: load(STORE.FARM_SKIP_FULL, true),
    farmFullMode: load(STORE.FARM_FULL_MODE, 'any'),
    abAuto: load(STORE.AB_AUTO, false),
    abTargets: load(STORE.AB_TARGETS, null),
    abRandom: load(STORE.AB_RANDOM, false),
    abRandomPick: load(STORE.AB_RANDOM_PICK, {}),
    autoCave: load(STORE.AUTO_CAVE, false),
    caveThreshPct: load(STORE.CAVE_THRESH, 90),

    emergencyCaveAuto: load(STORE.EMERGENCY_CAVE_AUTO, false),
    emergencyCaveConfirm: load(STORE.EMERGENCY_CAVE_CONFIRM, 1000),
    emergencyCaveMinIron: load(STORE.EMERGENCY_CAVE_MIN, 50),
    emergencyLastStash: load(STORE.EMERGENCY_LAST, {}) || {},
    caveTowns: load(STORE.CAVE_TOWNS, {}),
    autoCulture: load(STORE.AUTO_CULTURE, false),
    cultureTypes: (() => {
      const d = { festival: true, procession: false, theater: false, olympic: false };
      const raw = load(STORE.CULTURE_TYPES, d);
      if (!raw || typeof raw !== 'object') return d;
      // Match Config UI: festival defaults ON unless explicitly false.
      return {
        festival: raw.festival !== false,
        procession: !!raw.procession,
        theater: !!raw.theater,
        olympic: !!raw.olympic,
      };
    })(),
    allowPremiumCulture: load(STORE.ALLOW_PREMIUM_CULTURE, false),
    cultureGoldBudget: load(STORE.CULTURE_GOLD_BUDGET, 0),
    autoTrade: load(STORE.AUTO_TRADE, false),
    tradePreset: load(STORE.TRADE_PRESET, 'storage'),
    tradeReservePct: load(STORE.TRADE_RESERVE, 20),
    tradeMinBatch: load(STORE.TRADE_MIN, 1000),
    tradeTowns: load(STORE.TRADE_TOWNS, {}) || {},
    tradeOverflowPct: load(STORE.TRADE_OVERFLOW, 100),
    tradeTransferPct: load(STORE.TRADE_TRANSFER_PCT, 10),
    tradeReceiverPct: load(STORE.TRADE_RECEIVER_PCT, 80),
    islandBeneficiaries: load(STORE.ISLAND_BENEFICIARIES, {}) || {},

    tradeRoutes: load(STORE.TRADE_ROUTES, {}) || {},

    autoTradeRoutes: load(STORE.AUTO_TRADE_ROUTES, false),
    autoTransport: load(STORE.AUTO_TRANSPORT, false),

    autoDump: load(STORE.AUTO_DUMP, false),
    dumpThreshold: load(STORE.DUMP_THRESHOLD, { wood: 95, stone: 95, iron: 90 }),
    dumpKeep: load(STORE.DUMP_KEEP, { wood: 50, stone: 50, iron: 50 }),
    dumpSinks: load(STORE.DUMP_SINKS, []),
    transportReserve: load(STORE.TRANSPORT_RESERVE, 20),
    transportMin: load(STORE.TRANSPORT_MIN, 1000),
    resourceOptimizerCfg: load(STORE.RESOURCE_OPTIMIZER_CFG, {}) || {},
    autoRuralTrade: load(STORE.AUTO_RURAL_TRADE, false),
    autoRuralLevel: load(STORE.AUTO_RURAL_LEVEL, false),
    ruralLevelMax: load(STORE.RURAL_LEVEL_MAX, 3),
    autoResearch: load(STORE.AUTO_RESEARCH, false),
    researchTargets: load(STORE.RESEARCH_TARGETS, null),
    cityTemplates: load(STORE.CITY_TEMPLATES, {}),
    townGroups: load(STORE.TOWN_GROUPS, {}),
    webhookUrl: load(STORE.WEBHOOK_URL, ''),
    telegramEnabled: load(STORE.TELEGRAM_ENABLED, false),
    telegramChatId: load(STORE.TELEGRAM_CHAT_ID, '') || '',
    telegramCaptcha: load(STORE.TELEGRAM_CAPTCHA, true) !== false,
    telegramCaptchaResolved: load(STORE.TELEGRAM_CAPTCHA_RESOLVED, true) !== false,
    telegramCaptchaState: load(STORE.TELEGRAM_CAPTCHA_STATE, {}) || {},
    telegramEvents: Object.assign({ attack:true, hourly:true, critical:true, warehouse:true, diagnostic:true }, load(STORE.TELEGRAM_EVENTS, {}) || {}),
    telegramMonitorState: load(STORE.TELEGRAM_MONITOR_STATE, {}) || {},
    telegramDiagState: load(STORE.TELEGRAM_DIAG_STATE, {}) || {},
    telegramWarehousePct: load(STORE.TELEGRAM_WAREHOUSE_PCT, 95),
    telegramWarehouseMin: load(STORE.TELEGRAM_WAREHOUSE_MIN, 15),
    notifyEnabled: load(STORE.NOTIFY_ENABLED, false),
    notifyEvents: load(STORE.NOTIFY_EVENTS, {}) || {},
    notifyVolume: load(STORE.NOTIFY_VOLUME, 0.4),
    notifyMuted: load(STORE.NOTIFY_MUTED, false),
    webhookEvents: load(STORE.WEBHOOK_EVENTS, { captcha: true, attack: true, warehouse: false, culture: false, cappingPreWarn: false, 'counter-intel': true, hero: false, 'intel-digest': true }),
    autoMerchant: load(STORE.AUTO_MERCHANT, false),
    merchantWish: load(STORE.MERCHANT_WISH, []),
    // GOLD is deliberately opt-in. Operational records remain world-scoped
    // under the existing storage rules; no player-scoping migration is folded
    // into this feature.
    goldEnabled: load(STORE.GOLD_ENABLED, false) === true,
    goldBatch: load(STORE.GOLD_BATCH, 10000),
    goldTowns: load(STORE.GOLD_TOWNS, {}) || {},
    goldActions: load(STORE.GOLD_ACTIONS, {}) || {},
    goldSeaByTown: load(STORE.GOLD_SEAS, {}) || {},
    goldReviews: load(STORE.GOLD_REVIEWS, {}) || {},
    goldHub: load(STORE.GOLD_HUB, null),
    goldPending: load(STORE.GOLD_PENDING, null),
    goldStats: load(STORE.GOLD_STATS, {}) || {},
    goldLast: load(STORE.GOLD_LAST, {}) || {},
    goldSale: load(STORE.GOLD_SALE, null),
    autoFavor: load(STORE.AUTO_FAVOR, false),
    favorCfg: load(STORE.FAVOR_CFG, { god: 'athena', unit: 'harpy', thresh: 200, maxConcurrent: 2 }),
    spellCooldown: load(STORE.SPELL_COOLDOWN, {}),
    recruitQueueCap: load(wkey(STORE.RECRUIT_QCAP), {}),
    autoWonder: load(STORE.AUTO_WONDER, false),

    wonderCfg: load(STORE.WONDER_CFG, { wonderId: null, islandX: null, islandY: null, wood: 0, stone: 0, iron: 0, reserve: 5000, budget: 50000 }),
    autoDodge: load(STORE.AUTO_DODGE, false),

    dodgeMode: load(STORE.DODGE_MODE, 'notify'),
    dodgeFloor: load(STORE.DODGE_FLOOR, 0),
    autoRecruit: load(STORE.AUTO_RECRUIT, false),
    recruitTargets: load(STORE.RECRUIT_TARGETS, {}),
    recruitSpells: load(STORE.RECRUIT_SPELLS, false),
    batchRecruit: load(STORE.BATCH_RECRUIT, false),
    batchRecruitLists: load(STORE.BATCH_RECRUIT_LISTS, { towns: {} }),
    recruitPacks: load(STORE.RECRUIT_PACKS, {}),
    autoVillageRecruit: load(STORE.AUTO_VILLAGE_RECRUIT, false),
    villageRecruitFillPct: load(STORE.VILLAGE_RECRUIT_FILL, 90),
    villageRecruitAmount: load(STORE.VILLAGE_RECRUIT_AMOUNT, 1),
    villageRecruitStreaks: load(STORE.VILLAGE_RECRUIT_STREAKS, {}),
    priorityOrder: load(STORE.PRIORITY_ORDER, ORCH_ORDER_DEFAULT.slice()),
    islandShip: load(STORE.ISLAND_SHIP, false),
    autoMilitia: load(STORE.AUTO_MILITIA, false),
    csAlert: load(STORE.CS_ALERT, true),
    playerNotes: load(STORE.PLAYER_NOTES, {}),
    watchlist: load(STORE.WATCHLIST, []),

    spyEnabled: load(STORE.AUTO_SPY, false),
    spyCfg: load(STORE.SPY_CFG, { targets: [], autoWatchlist: true, autoTopReported: 5, perCycle: 1, minGapMs: 1200000, dryRun: true, confirmOncePerCycle: true, maxConcurrent: 3 }),
    spyLastSpy: load(STORE.SPY_HISTORY, {}) || {},
    spyTpl: load(STORE.SPY_TPL, null),
    grepodataIndex: load(STORE.GREPODATA_INDEX, false),
    captchaGlobalKill: load(STORE.CAPTCHA_GLOBAL, true),
    reqBudgetPerMin: load(STORE.REQ_BUDGET, 40),

    intelDigest: load(STORE.INTEL_DIGEST, false),
    napStatus: load(STORE.NAP_STATUS, { players: {}, alliances: {} }),
    intelAllianceFilter: load(STORE.INTEL_ALLY_FILTER, '') || '',
    allianceNotes: load(STORE.ALLIANCE_NOTES, {}),
    configVer: load(STORE.CONFIG_VER, gbLegacyWorldGate().allowed ? 1 : CONFIG_VER_CURRENT),
    configUndo: load(STORE.CONFIG_UNDO, []) || [],
    configRedo: load(STORE.CONFIG_REDO, []) || [],
    replayCursor: 0,
    decisions: load(STORE.DECISIONS, []),
    decisionSkips: load(STORE.DECISION_SKIPS, {}),
    decisionMemory: load(STORE.DECISION_MEM, true),
    dryRun: load(STORE.DRY_RUN, false),
    firstPostConfirm: load(STORE.FIRST_POST_CONFIRM, false),
    firstPostLive: load(wkey(STORE.FIRST_POST_LIVE), {}),
    intelBattleStats: load(STORE.INTEL_BATTLE_STATS, true),
    exportRedact: load(STORE.EXPORT_REDACT, true),
    txState: load(STORE.TX_STATE, {}),
    circuitAutoClear: load(STORE.CIRCUIT_AUTO_CLEAR, true),
    circuits: load(STORE.CIRCUITS, {}),
    abOrder: load(STORE.AB_ORDER, null),

    autoWallRepair: load(STORE.AUTO_WALL_REPAIR, false),
    popRescueFarm: load(STORE.POP_RESCUE_FARM, true),
    abOptimalOrder: load(STORE.AB_OPTIMAL_ORDER, {}),
    abOptimalOrderOn: load(STORE.AB_OPTIMAL_ORDER_ON, true),
    plannerCfg: load(STORE.PLANNER_CFG, { global: { hard: { wood:0, stone:0, iron:0, population:0 }, soft: { wood:0, stone:0, iron:0, population:0 } }, towns: {} }),
    goalProfiles: load(STORE.GOAL_PROFILES, {}),
    townGoals: load(STORE.TOWN_GOALS, {}),
    roleAdvisorCfg: load(STORE.ROLE_ADVISOR_CFG, {}) || {},
    roleAssignments: load(STORE.ROLE_ASSIGNMENTS, {}) || {},
    virtualQueue: load(STORE.VIRTUAL_QUEUE, {}),
    virtualQueueOverrides: load(STORE.VIRTUAL_QUEUE_OVERRIDES, {}),
    buildSwapThresholdMin: load(STORE.BUILD_SWAP_MIN, 5),
    buildSwapIgnore: load(STORE.BUILD_SWAP_IGNORE, {}) || {},
    nativeQueue: load(STORE.NATIVE_QUEUE, { version: 1, seq: 0, towns: {} }),
    predictCfg: load(STORE.PREDICT_CFG, { horizonHours: 6 }),
    defenseCfg: load(STORE.DEFENSE_CFG, { mode: 'notify', returnMarginSec: 120, smartAuto: false }),

    defenseHistory: load(STORE.DEFENSE_HISTORY, []) || [],
    militiaCfg: load(STORE.MILITIA_CFG, { forceRisk: 50, skipRisk: 10, localOk: 400, graceMs: 180000 }),
    supportCfg: load(STORE.SUPPORT_CFG, { auto: false, confirmThreshold: 100, homeFloor: 0, shareDodgeFloor: true, minEtaSec: 120, noArmSec: 60, overlapSec: 30 }),
    supportLastSend: load(STORE.SUPPORT_LAST_SEND, {}) || {},
    supportTpl: load(STORE.SUPPORT_TEMPLATE, null),
    dodgeReturns: load(STORE.DODGE_RETURNS, {}),
    snapshots: load(STORE.SNAPSHOTS, []) || [],
    snapshotsOn: load(STORE.SNAPSHOTS_ON, true),
    profilerOn: load(STORE.PROFILER_ON, false),
    memProbeOn: load(STORE.MEM_PROBE_ON, false),
    profileRings: {},
    memSamples: [],
    health: load(STORE.HEALTH, {}),
    clientFingerprint: load(STORE.CLIENT_FP, null),
    safeMode: load(STORE.SAFE_MODE, true),
    simCfg: load(STORE.SIM_CFG, { horizonHours: 24 }),
    whyLog: load(STORE.WHY_LOG, []),
    tplHealth: load(STORE.TPL_HEALTH, {}) || {},
    captchaLadder: load(STORE.CAPTCHA_LADDER, [5, 15, 60]),
    postsPerMinSoftPct: load(STORE.POSTS_SOFT_PCT, 60),
    tabFilters: load(STORE.TAB_FILTERS, {}) || {},
    farmLoyaltySeen: load(STORE.FARM_LOYALTY_SEEN, false),
    farmTeachBanner: load(STORE.FARM_TEACH_BANNER, ''),
    lastSeenTs: load(STORE.LAST_SEEN_TS, 0),
    watchHits: load(STORE.WATCH_HITS, {}) || {},
    wonderFavorTpl: load(STORE.WONDER_FAVOR_TPL, null),
    autoWonderFavor: load(STORE.AUTO_WONDER_FAVOR, false),
    autoPtTrade: load(STORE.AUTO_PT_TRADE, false),

    ptCfg: load(STORE.PT_CFG, null) || {
      targetRatio: 1.0, pumpAmount: 1, reservePct: 10,
      wantRes: { wood: true, stone: true, iron: false },
    },
    ptTradeTpl: load(STORE.PT_TRADE_TPL, null),
    ptViewUrl: load(STORE.PT_VIEW_URL, null),

    webhookRatelimit: load(STORE.WEBHOOK_RATELIMIT, {}) || {},
    webhookPending: load(STORE.WEBHOOK_PENDING, {}) || {},
  };
  if (state.firstPostConfirm && (!state.firstPostLive || typeof state.firstPostLive !== 'object' || !Object.keys(state.firstPostLive).length)) {
    state.firstPostConfirm = false;
    save(STORE.FIRST_POST_CONFIRM, false);
  }
  // Keep the Telegram bot credential outside the generic state object so it
  // cannot appear in state-oriented diagnostics/test bridges by accident.
  let telegramBotToken = load(STORE.TELEGRAM_BOT_TOKEN, '') || '';
  let panel = null;

  const GB_PANIC_GRACE_MS = 30000;
  let panicUntil = 0;
  let panicNeedsClear = false;
  let userPausedUntil = 0;
  let captchaGlobalUntil = +load(STORE.CAPTCHA_GLOBAL_UNTIL, 0) || 0;
  function gbNeverStop() { return state.neverStop !== false; }
  function gbSafeModeOn() { return !!state.safeMode && !gbNeverStop(); }
  function bumpUserActivity() {
    if (!state.pauseOnActivity) return;
    userPausedUntil = Date.now() + (state.pauseActivityMs || 180000);
  }
  const moduleHealth = (state.health && typeof state.health === 'object') ? state.health : {};
  const reqBudgetWindow = [];
  function saveCaptchaGlobalUntil() {
    save(STORE.CAPTCHA_GLOBAL_UNTIL, captchaGlobalUntil || 0);
  }
  function migrateConfig() {
    if (!gbTabLeader) return false;
    if (!migrateGlobalConfig()) {
      gbLogT('config-global-migrate', 60000, 'global config migration skipped: schema gate could not be persisted safely');
      return false;
    }
    const scopedConfigRead = gbStorageRawRead(wkey(STORE.CONFIG_VER), STORE.CONFIG_VER);
    const needsScopedVersionMarker = scopedConfigRead.status === 'missing';
    const startVer = +state.configVer || 1;
    if ((scopedConfigRead.status !== 'missing' && scopedConfigRead.status !== 'valid') || gbStorageReadFailed(STORE.CONFIG_VER)) {
      gbLogT('config-migrate-read', 60000, 'config migration skipped: CONFIG_VER could not be read safely');
      return false;
    }
    let ver = startVer;
    gbMigrationActive = true;
    gbMigrationWriteFailed = false;
    if (ver < 3 && gbLegacyWorldGate().allowed) {
      // Schema v1/v2 installations may already have some scoped keys while
      // the remaining runtime still lives in legacy globals. Copy every
      // missing value once; a valid scoped value always wins.
      for (const base of WORLD_SCOPED_BASES) {
        try {
          if (base === STORE.CONFIG_VER) continue;
          const scopedKey = wkey(base);
          const scoped = gbStorageRawRead(scopedKey, base);
          if (scoped.status === 'valid') continue;
          if (scoped.status !== 'missing') { gbMigrationWriteFailed = true; continue; }
          const legacy = gbStorageRawRead(base, base);
          if (legacy.status === 'valid') save(base, legacy.value);
          else if (legacy.status !== 'missing') {
            gbStorageProtectRead(scopedKey);
            gbMigrationWriteFailed = true;
          }
        } catch (_) { gbMigrationWriteFailed = true; }
      }
    }
    if (ver < 2) {
      const cur = Array.isArray(state.priorityOrder) ? state.priorityOrder.slice() : [];
      state.priorityOrder = cur.concat(ORCH_ORDER_DEFAULT.filter(k => cur.indexOf(k) === -1));
      save(STORE.PRIORITY_ORDER, state.priorityOrder);
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

      if (!/^buyInstant$/i.test(String(state.ibAction || ''))) state.ibAction = null;
      if (!/^buyInstant$/i.test(String(state.ibActionR || ''))) state.ibActionR = null;
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

      if (!state.tradeRoutes || typeof state.tradeRoutes !== 'object' || Array.isArray(state.tradeRoutes)) {
        state.tradeRoutes = {}; save(STORE.TRADE_ROUTES, state.tradeRoutes);
      }
      if (typeof state.autoTradeRoutes !== 'boolean') {
        state.autoTradeRoutes = false; save(STORE.AUTO_TRADE_ROUTES, state.autoTradeRoutes);
      }

      if (!state.supportCfg || typeof state.supportCfg !== 'object' || Array.isArray(state.supportCfg)) state.supportCfg = {};
      state.supportCfg.auto = state.supportCfg.auto === true;
      save(STORE.SUPPORT_CFG, state.supportCfg);
      if (!state.supportLastSend || typeof state.supportLastSend !== 'object' || Array.isArray(state.supportLastSend)) {
        state.supportLastSend = {}; save(STORE.SUPPORT_LAST_SEND, state.supportLastSend);
      }

      ver = 11;
    }
    if (ver < 12) {

      if (!Array.isArray(state.dumpSinks)) { state.dumpSinks = []; save(STORE.DUMP_SINKS, state.dumpSinks); }

      if (!state.defenseCfg || typeof state.defenseCfg !== 'object') state.defenseCfg = { mode: 'notify', returnMarginSec: 120, smartAuto: false };
      state.defenseCfg.snipeDetect = state.defenseCfg.snipeDetect !== false;
      const clampD = (k, d, lo, hi) => { const n = +state.defenseCfg[k]; state.defenseCfg[k] = Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
      clampD('csClusterGapSec', 900, 60, 21600);
      clampD('csCoverSec', 180, 5, 900);
      clampD('csTightSec', 5, 0, 120);
      save(STORE.DEFENSE_CFG, state.defenseCfg);
      ver = 12;
    }
    if (ver < 13) {

      try {
        const scoped = gbStorageRawRead(wkey(STORE.BATCH_RECRUIT_LISTS), STORE.BATCH_RECRUIT_LISTS);
        if (scoped.status !== 'missing' && scoped.status !== 'valid') gbMigrationWriteFailed = true;
        else if (scoped.status === 'missing' && gbLegacyWorldOneShotEligible()) {
          const legacy = gbStorageRawRead(STORE.BATCH_RECRUIT_LISTS, STORE.BATCH_RECRUIT_LISTS);
          if (legacy.status !== 'missing' && legacy.status !== 'valid') gbMigrationWriteFailed = true;
          else if (legacy.status === 'valid') {
            save(STORE.BATCH_RECRUIT_LISTS, legacy.value);
            if (legacy.value && typeof legacy.value === 'object') state.batchRecruitLists = legacy.value;
          }
        }
      } catch (_) { gbMigrationWriteFailed = true; }
      ver = 13;
    }
    if (ver < 14) {
      try {
        const scopedKey = wkey(STORE.ISLAND_BENEFICIARIES);
        const scopedRead = gbStorageRawRead(scopedKey, STORE.ISLAND_BENEFICIARIES);
        if (scopedRead.status !== 'missing' && scopedRead.status !== 'valid') gbMigrationWriteFailed = true;
        let legacyRead = { status:'missing', value:null };
        if (scopedRead.status === 'missing' && gbLegacyWorldOneShotEligible()) {
          legacyRead = gbStorageRawRead(STORE.ISLAND_BENEFICIARIES, STORE.ISLAND_BENEFICIARIES);
          if (legacyRead.status !== 'missing' && legacyRead.status !== 'valid') gbMigrationWriteFailed = true;
        }
        const scopedRaw = scopedRead.status === 'valid' ? scopedRead.value : null;
        const legacyRaw = legacyRead.status === 'valid' ? legacyRead.value : null;
        let normalized = null;
        if (scopedRaw != null) {
          normalized = normalizeIslandBeneficiaryConfig(scopedRaw);
          if (normalized == null) {
            gbLogT('island-beneficiary-migrate-scoped', 60000, 'island beneficiaries: scoped config invalid/unresolvable; preserving runtime empty config');
            state.islandBeneficiaries = {};
          }
        } else if (legacyRaw != null) {
          normalized = normalizeIslandBeneficiaryConfig(legacyRaw);
          if (normalized == null) {
            gbMigrationWriteFailed = true;
            gbLogT('island-beneficiary-migrate-legacy', 60000, 'island beneficiaries: legacy global config cannot yet be validated; preserving it for a later migration retry');
          }
        }
        if (normalized != null) {
          state.islandBeneficiaries = normalized;
          if (!save(STORE.ISLAND_BENEFICIARIES, normalized)) gbMigrationWriteFailed = true;
          else gbLog('island beneficiaries: migrated/normalized to world-scoped canonical island ids');
        } else if (scopedRead.status === 'missing' && legacyRead.status === 'valid' && legacyRaw === null && !gbMigrationWriteFailed) {
          state.islandBeneficiaries = {};
          if (!save(STORE.ISLAND_BENEFICIARIES, null)) gbMigrationWriteFailed = true;
        } else if (scopedRead.status === 'missing' && legacyRead.status === 'missing' && !gbMigrationWriteFailed) {
          state.islandBeneficiaries = {};
          if (!save(STORE.ISLAND_BENEFICIARIES, {})) gbMigrationWriteFailed = true;
        }
      } catch (_) { gbMigrationWriteFailed = true; }
      ver = 14;
    }
    if (ver < 15) {
      // 6.0.11: old transport storms inflated consecutive error counters.
      // Preserve cumulative statistics/history, but do not carry an active
      // timeout streak across the transport-watchdog upgrade.
      try {
        for (const h of Object.values(moduleHealth || {})) {
          if (!h || typeof h !== 'object') continue;
          if (String(h.lastErrorKind || '') === 'timeout' || String(h.lastError || '') === 'timeout') h.consecutiveErr = 0;
        }
        state.health = moduleHealth;
        save(STORE.HEALTH, moduleHealth);
      } catch (_) { gbMigrationWriteFailed = true; }
      ver = 15;
    }
    if (ver < 16) {
      // Recruitment-spell preference belongs to the global schema. A per-world
      // schema must never replay it over a manual choice.
      ver = 16;
    }
    if (ver < 17) {
      // Older migrations stored buyInstant as a guessed default, so persisted
      // data cannot prove that this action came from the player's own traffic.
      // Reset both once and require a fresh hand-click before another post.
      state.ibAction = null;
      state.ibActionR = null;
      save(STORE.IB_ACTION, null);
      save(STORE.IB_ACTION_R, null);
      ver = 17;
    }
    if (ver < 18) {
      if (!state.roleAdvisorCfg || typeof state.roleAdvisorCfg !== 'object' || Array.isArray(state.roleAdvisorCfg)) state.roleAdvisorCfg = {};
      if (!state.roleAssignments || typeof state.roleAssignments !== 'object' || Array.isArray(state.roleAssignments)) state.roleAssignments = {};
      if (!state.resourceOptimizerCfg || typeof state.resourceOptimizerCfg !== 'object' || Array.isArray(state.resourceOptimizerCfg)) state.resourceOptimizerCfg = {};
      save(STORE.ROLE_ADVISOR_CFG, state.roleAdvisorCfg);
      save(STORE.ROLE_ASSIGNMENTS, state.roleAssignments);
      save(STORE.RESOURCE_OPTIMIZER_CFG, state.resourceOptimizerCfg);
      ver = 18;
    }
    gbMigrationActive = false;
    if (gbMigrationWriteFailed) {
      state.configVer = startVer;
      gbLogT('config-migrate-write', 60000, `config migration v${startVer}->v${ver} incomplete; version NOT advanced and migration will retry after reload`);
      return false;
    }
    if (ver !== startVer || needsScopedVersionMarker) {
      const versionAdvanced = ver !== startVer;
      gbMigrationActive = true;
      gbMigrationWriteFailed = false;
      const ok = save(STORE.CONFIG_VER, ver);
      gbMigrationActive = false;
      if (!ok || gbMigrationWriteFailed) {
        state.configVer = startVer;
        gbLogT('config-migrate-version', 60000, `config migration data saved but CONFIG_VER write failed; staying at v${startVer}`);
        return false;
      }
      state.configVer = ver;
      if (versionAdvanced) gbLog('config migrated \u2192 v' + ver);
    }
    if (!gbLegacyWorldMigrationFinalize()) {
      gbLogT('legacy-world-finalize', 60000, 'legacy world migration completed but its global consumed marker could not be persisted');
      return false;
    }
    return true;
  }
  let healthSaveTimer = 0;
  function healthSaveSoon() {
    state.health = moduleHealth;
    if (healthSaveTimer) return;
    healthSaveTimer = gbTimeout(() => { healthSaveTimer = 0; save(STORE.HEALTH, moduleHealth); }, 1500);
  }
  function healthSaveFlush() {
    if (healthSaveTimer) { try { gbClearTimeout(healthSaveTimer); } catch (_) {} healthSaveTimer = 0; }
    state.health = moduleHealth;
    return save(STORE.HEALTH, moduleHealth);
  }
  function markModuleHealth(feature, kind, meta) {
    const h = moduleHealth[feature] || { ok:0, err:0, captcha:0, timeout:0, last:0, consecutiveErr:0, avgLatency:null, samples:0 };
    const now=Date.now(), m=meta||{};

    // 6.0.9 safety boundary: normal Grepolis scheduling rejections must never
    // become module errors, even if a caller reaches markModuleHealth('err')
    // without going through txRun's expected-rejection branch.
    let expectedWait = null;
    try { if (kind === 'err') expectedWait = gbExpectedServerReject(feature, m.error); } catch (_) {}
    if (expectedWait) kind = 'skip';

    if (kind === 'ok') { h.ok++; h.lastOk=now; h.consecutiveErr=0; }
    else if (kind === 'skip') {
      h.skip=(h.skip||0)+1; h.lastSkip=now;
      h.lastSkipReason=String(expectedWait || m.error || 'skip').slice(0,160);
      h.lastSkipKind=String(expectedWait || 'skip').slice(0,80);
    }
    else if (kind === 'captcha') { h.captcha++; h.lastErr=now; h.consecutiveErr=(h.consecutiveErr||0)+1; }
    else if (kind === 'timeout') { h.timeout=(h.timeout||0)+1; h.err++; h.lastErr=now; h.consecutiveErr=(h.consecutiveErr||0)+1; }
    else { h.err++; h.lastErr=now; h.consecutiveErr=(h.consecutiveErr||0)+1; }

    // Skips are scheduler state, not diagnostic incidents. Do not overwrite the
    // last real error and do not add them to Telegram's health history.
    if (kind !== 'ok' && kind !== 'skip') {
      h.lastErrorKind=String(kind||'err');
      h.lastError=String(m.error || kind || 'error').slice(0,160);
    }
    if (Number.isFinite(+m.latencyMs) && +m.latencyMs>=0) { h.samples=(h.samples||0)+1; h.lastLatency=+m.latencyMs; h.avgLatency=h.avgLatency==null?+m.latencyMs:(h.avgLatency*0.85+(+m.latencyMs)*0.15); }
    h.last=now; moduleHealth[feature]=h;
    if (kind !== 'ok' && kind !== 'skip') {
      try {
        const diag = telegramDiagRecordHealth(feature, kind, m);
        if (diag && diag.id) h.lastErrorId = diag.id;
      } catch (_) {}
    }
    healthSaveSoon();
  }
  function whyNote(feature, action, status, why) {
    if (!Array.isArray(state.whyLog)) state.whyLog=[];
    const last=state.whyLog[0]; const key=`${feature}|${action}|${status}|${why||''}`;
    if (last && last.key===key && Date.now()-last.ts<15000) return;
    state.whyLog.unshift({ts:Date.now(),feature:String(feature||''),action:String(action||'').slice(0,120),status:String(status||''),why:String(why||'').slice(0,180),key});

    if(state.whyLog.length>200)state.whyLog.length=200; saveSoon(STORE.WHY_LOG,state.whyLog);
    try { telegramSupportCaptureWhy(feature, action, status, why); } catch (_) {}
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
    if(!gbTabLeader)return false;
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
  // Transport watchdog: a timeout in one feature can be local, but correlated
  // timeouts across independent features mean the shared Grepolis transport
  // is unhealthy. Stop all writes briefly instead of hammering every queue.
  const GB_TRANSPORT_TIMEOUT_WINDOW_MS = 90000;
  const gbTransportTimeouts = [];
  let gbTransportBackoffLevel = 0;
  let gbTransportLastOkAt = 0;
  function gbTransportPrune(now) {
    const cut = now - GB_TRANSPORT_TIMEOUT_WINDOW_MS;
    while (gbTransportTimeouts.length && gbTransportTimeouts[0].ts < cut) gbTransportTimeouts.shift();
  }

  // boundedLedger (REDESIGN §4.2 / DEDUP_MAP item L): single helper for the
  // per-feature "ensure+save+prune-by-expiry" pattern that previously lived
  // as parallel implementations in emergency/recruit/support/culture/wonder.
  // - stateKey: state.<stateKey> holds the map (auto-initialised to {})
  // - storeKey: passed to save() when the map changes
  // - pruneField: entry[pruneField] is the cutoff ms; entries with value < now-pruneMs get dropped
  // - pruneMs: how long entries live past pruneField
  // Caller writes through ensure(); mutations need save() to persist.
  function boundedLedger(opts) {
    const stateKey = opts.stateKey;
    const storeKey = opts.storeKey;
    const pruneField = opts.pruneField || 'expires';
    const pruneMs = +opts.pruneMs || 0;
    function ensure() {
      if (!state[stateKey] || typeof state[stateKey] !== 'object' || Array.isArray(state[stateKey])) {
        state[stateKey] = {};
      }
      return state[stateKey];
    }
    function persist() { return save(storeKey, ensure()); }
    function prune(now) {
      if (!(pruneMs > 0)) return false;
      const L = ensure();
      const cut = (now || Date.now()) - pruneMs;
      let changed = false;
      for (const [k, e] of Object.entries(L)) {
        if (!e || +(e[pruneField] || 0) < cut) { delete L[k]; changed = true; }
      }
      if (changed) persist();
      return changed;
    }
    return { ensure, save: persist, prune };
  }
  function noteTransportSuccess() {
    const now = Date.now();
    gbTransportLastOkAt = now;
    gbTransportPrune(now);
    if (gbTransportTimeouts.length) gbTransportTimeouts.length = 0;
    if (gbTransportBackoffLevel && (!serverCooldownUntil || serverCooldownUntil <= now)) gbTransportBackoffLevel = 0;
  }
  function noteTransportTimeout(feature) {
    const now = Date.now();
    gbTransportPrune(now);
    gbTransportTimeouts.push({ ts: now, feature: String(feature || 'unknown') });
    const features = new Set(gbTransportTimeouts.map(e => e.feature));
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const correlated = gbTransportTimeouts.length >= 3 && features.size >= 2;
    const repeated = gbTransportTimeouts.length >= 5;
    if (!offline && !correlated && !repeated) return false;
    gbTransportBackoffLevel = Math.min(3, gbTransportBackoffLevel + 1);
    const delays = [60000, 120000, 300000];
    const ms = offline ? 120000 : delays[gbTransportBackoffLevel - 1];
    gbServerCooldown(ms, offline ? 'browser offline' : `transport timeout storm ${gbTransportTimeouts.length}/${features.size} modules`);
    whyNote('system', 'transport', 'blocked', offline ? 'offline' : 'timeout-storm');
    gbLogT('transport-timeout-storm', 30000, `transport: ${gbTransportTimeouts.length} timeout(s) across ${features.size} module(s); global backoff ${Math.round(ms/1000)}s`);
    return true;
  }
  function gbPanicActive() { return panicUntil > Date.now(); }
  function gbPanicPending() { return panicNeedsClear; }
  function gbPanicLeftMs() { return Math.max(0, panicUntil - Date.now()); }

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

  function gbPanicRecover() {
    if (!panicNeedsClear) return { ok: false, why: 'inactive' };
    if (gbPanicActive()) return { ok: false, why: 'grace' };

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
  function automationPaused(reasonOut, opts) {
    const never = gbNeverStop();
    if (!never && panicUntil && Date.now() < panicUntil) {
      if (reasonOut) reasonOut.reason = 'panic';
      return true;
    }
    if (!never && panicNeedsClear) {
      if (reasonOut) reasonOut.reason = 'panic-grace';
      return true;
    }
    if (!(opts && opts.ignoreCaptchaGlobal) && captchaGlobalUntil && Date.now() < captchaGlobalUntil) {
      if (reasonOut) reasonOut.reason = 'captcha-global';
      return true;
    }
    if (gbServerPaused()) {
      if (reasonOut) reasonOut.reason = 'server';
      return true;
    }
    if (!never && state.pauseOnActivity && Date.now() < userPausedUntil) {
      if (reasonOut) reasonOut.reason = 'user';
      return true;
    }
    if (!never && state.nightPause) {
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
  let reqBudgetHead = 0;

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
      try { profTime('wake:' + item.key, () => item.fn()); } catch (e) { gbLogT('wake-err', 30000, 'wake: ' + item.key + ' ' + String(e).slice(0, 60)); }
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
    if (gap > 45000) {
      gbWakeMarkResume('timer-gap ' + Math.round(gap / 1000) + 's');
      // A timer gap normally means the browser throttled/froze the tab. The old
      // code only marked the wake burst and waited for independent intervals.
      // Force one serialized catch-up pass immediately.
      if (hostEnabled() && !automationPaused({})) {
        try { gbWake('ibScan', () => ibScan(), { priority: 10 }); } catch (_) {}
        try { gbWake('nativeQueueSweep', () => nativeQueueSweep('timer-gap'), { priority: 20 }); } catch (_) {}
        try { orchStartIndependentTimers(); gbWake('orchTick', () => orchTick(), { priority: 30 }); } catch (_) {}
      }
    }
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
    let hideLvl = null, hideFull = false;
    try {
      if (typeof caveTownInfo === 'function') {
        const info = caveTownInfo(townId);
        if (info) {
          hideLvl = gbNum(info.hideLvl);
          if (info.unlimited) hideFull = false;
          else if (info.hideCap > 0 && info.stored != null && info.stored >= info.hideCap) hideFull = true;
        }
      }
    } catch (_) {}
    if (hideLvl == null || !(hideLvl > 0) || hideFull) return { reserved: false, etaMs: null, blind: false };
    const thresh = gbCfgClamp(state.caveThreshPct, 50, 99, 90) / 100;
    const need = Math.ceil(st.cap * thresh);
    if (st.iron >= need) return { reserved: true, etaMs: 0, blind: false };
    let ironPerSec = null;
    try {
      const uw = gameUw();
      const t = gbTownModel(townId);
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
    // Independent mode: culture never waits for a future cave action. If the
    // resources exist at send time, the first successful transaction wins.
    cultureCaveDeferCount[townId] = 0;
    return false;
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

  function reqBudgetSoftDelayMs() {

    const soft = Math.max(5, Math.floor((state.reqBudgetPerMin || 40) *
      ((state.postsPerMinSoftPct != null ? state.postsPerMinSoftPct : 60) / 100)));
    const used = reqBudgetUsed('action');
    if (used < soft) return 0;
    return Math.min(8000, 400 * (used - soft + 1) + Math.floor(Math.random() * 300));
  }

  const TPL_HEALTH_FAILS = 5;
  const TPL_HEALTH_STALE_MS = 1800000;
  const TPL_FEATURE_MAP = {
    farm: 'claimTpl',
    build: 'ibAction', 'instant-build': 'ibAction', 'instant-research': 'ibActionR',
    attack: 'attackTpl', cancel: 'cancelTpl', hero: 'heroTpl',

    support: 'supportTpl',
    dodge: 'supportTpl',
    spy: 'spyTpl',
    collect: 'collectTpl',
    pttrade: 'ptTradeTpl',
    wonder: 'wonderFavorTpl',
    gold: 'goldActions', goldoffer: 'goldActions',

  };

  function tplNameFor(feature, payload) {
    const name = TPL_FEATURE_MAP[feature];
    if (name !== 'ibAction') return name;
    const action = String((payload && payload.action_name) || '');
    if (!action || action === 'buildUp') return null;
    return /^ResearchOrder/.test(String((payload && payload.model_url) || '')) ? 'ibActionR' : 'ibAction';
  }

  function tplLearned(name) {
    if (!name) return false;
    const v = state[name];
    return !!v;
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
    h.stales = 0;
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
      h.stales = 0;
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
      gbLog('tpl: ' + name + ' has no learned payload - clearing stale health state');
      tplHealthSave();
      return true;
    }

    const stales = Math.max(0, +h.stales || 0);
    const staleWindow = TPL_HEALTH_STALE_MS * Math.min(8, Math.pow(2, stales));
    if (!h.invalidAt || Date.now() - h.invalidAt > staleWindow) {
      h.invalidated = false;
      h.hardFails = Math.max(0, TPL_HEALTH_FAILS - 1);
      h.stales = stales + 1;
      gbLog(`tpl: ${name} stale window (${Math.round(staleWindow / 60000)}min) expired - retrying, attempt ${h.stales}`);
      tplHealthSave();
      return true;
    }
    return false;
  }
  // 6.0.8 migration: older releases counted normal farm daily-cap replies as
  // hard template failures, which could invalidate claimTpl.  Clear that stale
  // invalidation once; future expected rejections no longer affect template health.
  (function tplClaimTransientRejectMigration() {
    const key = wkey('grepbot:mig:6.0.8:claimtpl-transient-reject');
    if (load(key, false)) return;
    try {
      const h = state.tplHealth && state.tplHealth.claimTpl;
      if (h && h.invalidated) {
        h.invalidated = false; h.hardFails = 0; h.stales = 0; h.invalidAt = 0;
        tplHealthSave();
        gbLog('tpl: claimTpl recovered by 6.0.8 transient-rejection migration');
      }
    } catch (_) {}
    save(key, true);
  })();

  function tplHealthBannerText() {
    const h = state.tplHealth || {};
    const bad = Object.keys(h).filter(k => h[k] && h[k].invalidated);
    if (!bad.length) return '';
    return 'Plantilla obsoleta: ' + bad.join(', ') + ' \u2014 haz un clic manual para reaprenderla';
  }

  function gbGameDataLookup(table, key) {
    try {
      const uw = gameUw();
      return (uw.GameData && uw.GameData[table] && uw.GameData[table][key]) || null;
    } catch (_) { return null; }
  }

  function scanReason(reason) { return reason || 'scan'; }
  function captchaLadder() {
    const raw = state.captchaLadder;
    if (Array.isArray(raw) && raw.length >= 1) {
      const nums = raw.map(n => Math.max(1, Math.min(24 * 60, +n || 0))).filter(n => n >= 1);
      if (nums.length) return nums;
    }
    return [5, 15, 60];
  }
  const logBuf = [];
  const logThrottle = new Map();
  // Retention is time-based: 24h exactly. Entries older than the cutoff are
  // dropped on every push, dump, and render. LOG_MAX stays as a safety cap so
  // a chatty session can't grow the buffer without bound before the next
  // tick trims it; the user-visible window is always <= 24h.
  const LOG_TTL_MS = 24 * 60 * 60 * 1000;
  const LOG_MAX = 5000;
  function logTrim(now) {
    const cut = (now || Date.now()) - LOG_TTL_MS;
    let i = 0;
    while (i < logBuf.length && logBuf[i].ts < cut) i++;
    if (i > 0) logBuf.splice(0, i);
    if (logBuf.length > LOG_MAX) logBuf.splice(0, logBuf.length - LOG_MAX);
  }
  function gbLog(...args) {
    const clean = args.map(a => gbRedact(a, { maxDepth: 5, maxEntries: 80, maxString: 320 }));
    console.info('[grepbot]', ...clean);
    const msg = clean.map(a => (typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch (_) { return String(a); } })())).join(' ');
    const now = Date.now();
    logBuf.push({ ts: now, msg });
    logTrim(now);
    renderLog();
  }

  function gbLogDump(n) {
    logTrim();
    const cap = n > 0 ? Math.min(n, logBuf.length) : logBuf.length;
    const start = Math.max(0, logBuf.length - cap);
    return logBuf.slice(start).map(l => ({ ts: l.ts, msg: l.msg }));
  }
  function gbLogDumpText(n) {
    return gbLogDump(n).map(l => new Date(l.ts).toISOString() + ' ' + l.msg).join('\n');
  }
  function gbLogT(key, ms, ...args) {
    const now = Date.now();
    const scopedKey = wkey('log-throttle:' + String(key));
    if ((logThrottle.get(scopedKey) || 0) + ms > now) return;
    logThrottle.set(scopedKey, now);
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

  (function seenUnscope() {
    const pre = location.hostname + ':';
    let n = 0;
    try {
      for (const k of Object.keys(state.seen || {})) {
        if (k.indexOf(pre) !== 0) continue;
        const id = k.slice(pre.length);
        if (state.seen[id] == null) state.seen[id] = state.seen[k];
        delete state.seen[k];
        n++;
      }
    } catch (_) { return; }
    if (!n) return;
    seenCount = Object.keys(state.seen).length;
    try { save(STORE.SEEN, state.seen); } catch (_) {}
  })();
  function rememberSeen(id) {
    const key = String(id);
    const isNew = state.seen[key] == null;
    state.seen[key] = Date.now();
    if (isNew) seenCount++;
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
  function gameUw() {

    try {
      if (typeof unsafeWindow !== 'undefined' && unsafeWindow) return unsafeWindow;
    } catch (_) {}
    try {
      if (window.wrappedJSObject) return window.wrappedJSObject;
    } catch (_) {}
    return Object.create(null);
  }

  function gbLit(html) { return html == null ? '' : String(html); }
  // No gbSafe/DOMPurify here on purpose: zero call sites, and a CDN @require
  // that falls back to raw pass-through when the load fails is worse than the
  // gbLit + textContent discipline. A feature that needs wire markup adds its
  // own sanitizer deliberately.
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
  const MM_MODELS_CACHE_MS = 250;
  const _mmModelsAllCache = Object.create(null);
  let _mmModelsAllCacheAt = 0;
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
  function gbMovementType(a) {
    if (!a) return '';
    for (const v of [a.type, a.movement_type, a.command_type]) {
      const t = String(v == null ? '' : v).toLowerCase().trim();
      if (t) return t;
    }
    return '';
  }
  function mmModelsAll(name) {
    const now = Date.now();
    if (now - _mmModelsAllCacheAt >= MM_MODELS_CACHE_MS) {
      for (const k of Object.keys(_mmModelsAllCache)) delete _mmModelsAllCache[k];
      _mmModelsAllCacheAt = now;
    }
    if (name in _mmModelsAllCache) return _mmModelsAllCache[name].slice();
    const uw = uwCached();
    const out = [], seen = new Set(), refs = new Set();
    const push = (m) => {
      if (!m || typeof m !== 'object') return;
      if (refs.has(m)) return;
      refs.add(m);
      const a = m.attributes || {};
      const id = (typeof m.getCommandId === 'function' && m.getCommandId()) || a.command_id || a.id || m.id;
      const k = id == null ? '' : String(id);
      if (k) { if (seen.has(k)) return; seen.add(k); }
      out.push(m);
    };
    const eat = (c) => {
      try {
        if (!c) return;
        if (Array.isArray(c)) { c.forEach(push); return; }
        if (Array.isArray(c.models)) c.models.forEach(push);
      } catch (_) {}
    };
    try { eat(uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName(name)); } catch (_) {}
    try { eat(uw.MM && uw.MM.getCollections && uw.MM.getCollections()[name]); } catch (_) {}
    try {
      const ag = uw.MM && uw.MM.getFirstTownAgnosticCollectionByName && uw.MM.getFirstTownAgnosticCollectionByName(name);
      if (ag) {
        eat(ag);
        if (typeof ag.getFragment === 'function') {
          for (const id of Object.keys((uw.ITowns && uw.ITowns.towns) || {})) {

            try { eat(ag.getFragment(id)); } catch (_) {}
            try { eat(ag.getFragment(+id)); } catch (_) {}
          }
        }
      }
    } catch (_) {}
    _mmModelsAllCache[name] = out;
    return out.slice();
  }
  function movementModels() { return mmModelsAll('MovementsUnits'); }
  function countUnits(units) {
    if (!units || typeof units !== 'object') return 0;
    return Object.values(units).reduce((n, v) => n + (gbNum(v) || 0), 0);
  }
  function backoffFor(streak, ladder) {
    const n = Math.max(0, Math.floor(+streak) || 0);
    if (!n || !ladder || !ladder.length) return 0;
    return ladder[Math.min(n - 1, ladder.length - 1)];
  }
  function xhrGuessLadder(guesses, learned) {
    const g = (guesses || []).slice();
    if (learned) {
      const i = g.indexOf(learned);
      if (i >= 0) g.splice(i, 1);
      g.unshift(learned);
    }
    return g;
  }
  function gbTry(fn, fallback, tag) {
    try { return fn(); } catch (e) {
      if (tag) gbLogT('gbtry-' + tag, 60000, tag + ': ' + String(e && e.message || e).slice(0, 80));
      return fallback;
    }
  }
  function gameBridgeStatus() {
    const uw = uwCached();
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
  function islandBeneficiaryWorldIndex() {
    const byCanonical = Object.create(null), coordToCanonical = Object.create(null);
    try {
      const towns = gameUw().ITowns && gameUw().ITowns.towns || {};
      for (const tid of Object.keys(towns)) {
        const t = towns[tid];
        let island = null, x = null, y = null;
        try { island = typeof t.getIslandId === 'function' ? t.getIslandId() : (t.attributes && t.attributes.island_id); } catch (_) {}
        try { x = typeof t.getIslandCoordinateX === 'function' ? t.getIslandCoordinateX() : (t.attributes && t.attributes.island_x); } catch (_) {}
        try { y = typeof t.getIslandCoordinateY === 'function' ? t.getIslandCoordinateY() : (t.attributes && t.attributes.island_y); } catch (_) {}
        if (island == null) continue;
        const key = String(island), id = String(tid);
        if (!byCanonical[key]) byCanonical[key] = [];
        if (!byCanonical[key].includes(id)) byCanonical[key].push(id);
        if (x != null && y != null) {
          const c = String(x) + ',' + String(y);
          if (coordToCanonical[c] == null) coordToCanonical[c] = key;
          else if (coordToCanonical[c] !== key) coordToCanonical[c] = 'AMBIGUOUS';
        }
      }
    } catch (_) { return null; }
    return { byCanonical, coordToCanonical };
  }
  function normalizeIslandBeneficiaryConfig(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const idx = islandBeneficiaryWorldIndex();
    if (!idx) return null;
    const out = {};
    for (const [rawKey, rawCfg] of Object.entries(value)) {
      if (!rawCfg || typeof rawCfg !== 'object' || Array.isArray(rawCfg)) return null;
      const k = String(rawKey);
      let canonical = idx.byCanonical[k] ? k : idx.coordToCanonical[k];
      if (!canonical || canonical === 'AMBIGUOUS' || !idx.byCanonical[canonical]) return null;
      const ids = idx.byCanonical[canonical].map(String);
      const resourceRaw = rawCfg.resource == null ? 'auto' : String(rawCfg.resource);
      const unitRaw = rawCfg.unit == null ? 'none' : String(rawCfg.unit);
      const resource = resourceRaw === 'auto' ? 'auto' : (ids.includes(resourceRaw) ? resourceRaw : null);
      const unit = (unitRaw === 'none' || unitRaw === 'auto') ? 'none' : (ids.includes(unitRaw) ? unitRaw : null);
      if (resource == null || unit == null) return null;
      out[canonical] = { resource, unit };
    }
    return out;
  }
  function islandBeneficiaryConfigValid(value) {
    return normalizeIslandBeneficiaryConfig(value) !== null;
  }
  function load(key, fallback) {
    const errKey = gbStorageReadKey(key);
    const scopedCall = String(key).indexOf('@') !== -1;
    if (!scopedCall && WORLD_SCOPED_BASES.has(key)) {
      const wk = wkey(key);
      const scoped = gbStorageRawRead(wk, errKey);
      if (scoped.status === 'valid') return scoped.value;
      if (scoped.status !== 'missing') return fallback;
      if (gbLegacyWorldFallbackAllowed(key)) {
        const legacy = gbStorageRawRead(key, errKey);
        if (legacy.status === 'valid') return legacy.value;
        if (legacy.status !== 'missing') gbStorageProtectRead(wk);
      }
      return fallback;
    }
    const direct = gbStorageRawRead(key, errKey);
    return direct.status === 'valid' ? direct.value : fallback;
  }
  let storageWarnUntil = 0;
  let storageWarnMsg = '';
  let storagePruneBusy = false;
  function loadValueStatus(v, key) {
    try {
      const json = typeof v === 'string' ? v : JSON.stringify(v);
      if (typeof json !== 'string') return 'invalid';
      const n = json.length;
      if (n > LOAD_MAX_CHARS) {
        try {
          if (typeof gbLogT === 'function') gbLogT('load-huge', 60000, 'storage: refusing huge key', key, n);
          else console.warn('[grepbot] storage: refusing huge key', key, n);
        } catch (_) {}
        return 'too-large';
      }
    } catch (_) { return 'invalid'; }
    return 'valid';
  }
  function loadValueOk(v, key) {
    if (v === null || v === undefined) return true;
    return loadValueStatus(v, key) === 'valid';
  }
  function storageRawSet(k, val) {
    if (gbStorageReadFailed(k)) return false;
    try { GM_setValue(k, val); return true; } catch (_) { return false; }
  }

  function pruneBytesOf(v) {
    try { return JSON.stringify(v).length; } catch (_) { return 0; }
  }

  function storagePruneForQuota() {
    if (storagePruneBusy) return 0;
    storagePruneBusy = true;
    let bytes = 0;
    try {
      const list = state.decisions;
      if (Array.isArray(list) && list.length > 50) {
        bytes += pruneBytesOf(list.splice(0, list.length - 50));
        storageRawSet(wkey(STORE.DECISIONS), list);
      }
    } catch (_) {}
    try {
      const ids = Object.keys(state.seen || {});
      if (ids.length > SEEN_MAX) {
        const dropped = {};
        ids.slice(0, ids.length - SEEN_MAX).forEach(k => { dropped[k] = state.seen[k]; delete state.seen[k]; });
        bytes += pruneBytesOf(dropped);
        storageRawSet(wkey(STORE.SEEN), state.seen);
      }
    } catch (_) {}
    try {
      const cut = Date.now() - 3 * 86400000;
      const dropped = {};
      let n = 0;

      Object.keys(state.alerted || {}).forEach(k => {
        const e = state.alerted[k];
        const ts = (e && typeof e === 'object') ? +e.ts || 0 : +e || 0;
        if (ts < cut) { dropped[k] = e; delete state.alerted[k]; n++; }
      });
      if (n) { bytes += pruneBytesOf(dropped); storageRawSet(wkey(STORE.ALERTED), state.alerted); }
    } catch (_) {}
    try {
      if (Array.isArray(state.findings) && state.findings.length > 100) {
        bytes += pruneBytesOf(state.findings.splice(0, state.findings.length - 100));
        storageRawSet(wkey(STORE.FINDINGS), state.findings);
      }
    } catch (_) {}
    try {
      const cut = Date.now() - 86400000;
      const dropped = {};
      let n = 0;
      Object.keys(state.farmResources || {}).forEach(k => {
        const r = state.farmResources[k];
        if (r && r.ts && r.ts < cut) { dropped[k] = r; delete state.farmResources[k]; n++; }
      });
      if (n) { bytes += pruneBytesOf(dropped); storageRawSet(wkey(STORE.FARM_RES), state.farmResources); }
    } catch (_) {}

    try {
      const ring = state.snapshots;
      if (Array.isArray(ring) && ring.length > 1) {

        for (const s of ring.splice(0, ring.length - 1)) bytes += (s && +s.sizeBytes) || 0;
        storageRawSet(wkey(STORE.SNAPSHOTS), ring);
      }
    } catch (_) {}
    try {
      const list = state.whyLog;
      if (Array.isArray(list) && list.length > 50) {
        const dropped = list.splice(50);
        bytes += pruneBytesOf(dropped);
        storageRawSet(wkey(STORE.WHY_LOG), list);
      }
    } catch (_) {}

    try {
      const cut = Date.now() - 3 * 86400000;
      const map = state.dodgeReturns || {};
      const dropped = [];
      Object.keys(map).forEach(k => {
        const e = map[k];
        const at = (e && (+e.dueAt || +e.createdAt)) || 0;
        const done = !!e && (e.state === 'done' || e.state === 'sent' || e.state === 'expired');
        if (!e || (at && at < cut) || (done && at && at < Date.now() - 86400000)) {
          dropped.push(e); delete map[k];
        }
      });
      if (dropped.length) { bytes += pruneBytesOf(dropped); storageRawSet(wkey(STORE.DODGE_RETURNS), map); }
    } catch (_) {}

    try {
      const cut = Date.now() - 7 * 86400000;
      const map = state.tplHealth || {};
      const dropped = [];
      Object.keys(map).forEach(k => {
        const h = map[k] || {};
        const last = Math.max(+h.lastOkAt || 0, +h.lastErrAt || 0, +h.learnedAt || 0);
        if (last && last < cut) { dropped.push(h); delete map[k]; }
      });
      if (dropped.length) { bytes += pruneBytesOf(dropped); storageRawSet(wkey(STORE.TPL_HEALTH), map); }
    } catch (_) {}
    storagePruneBusy = false;
    return bytes;
  }
  let gbMigrationActive = false;
  let gbMigrationWriteFailed = false;
  function save(key, val) {
    const scopedCall = String(key).indexOf('@') !== -1;
    const k = (!scopedCall && WORLD_SCOPED_BASES.has(key)) ? wkey(key) : key;
    // Never persist a fallback over a key that failed to load. A reload after
    // storage recovers is required before that key can be written again.
    if (gbStorageReadFailed(key) || gbStorageReadFailed(k)) {
      if (gbMigrationActive) gbMigrationWriteFailed = true;
      try {
        if (typeof gbLogT === 'function') gbLogT('storage-readonly-' + String(key), 60000, `storage: refusing write to ${key} after unsafe read`);
        else console.warn('[grepbot] refusing write after unsafe read', key);
      } catch (_) {}
      return false;
    }
    try {
      GM_setValue(k, val);
      return true;
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
          return true;
        } catch (e2) {
          if (gbMigrationActive) gbMigrationWriteFailed = true;
          storageWarnUntil = Date.now() + 30 * 60000;
          storageWarnMsg = 'quota FULL';
          console.warn('[grepbot] save fail (quota)', key, e2);
          gbLog('storage: QuotaExceeded on', key, '- write LOST after prune');
          try { updateStatus(); } catch (_) {}
          return false;
        }
      }
      if (gbMigrationActive) gbMigrationWriteFailed = true;
      console.warn('[grepbot] save fail', key, e);
      try { gbLog('storage: save fail', key, String(e).slice(0, 80)); } catch (_) {}
      return false;
    }
  }

  const SAVE_SOON_MS = 400;
  const saveSoonPending = new Map();
  let saveSoonTimer = 0;
  function saveFlush() {
    if (saveSoonTimer) { try { gbClearTimeout(saveSoonTimer); } catch (_) {} saveSoonTimer = 0; }
    if (!saveSoonPending.size) return;

    const entries = Array.from(saveSoonPending.entries());
    saveSoonPending.clear();
    for (const [k, v] of entries) {
      try { save(k, v); } catch (_) {}
    }
  }
  function saveSoon(key, val) {
    saveSoonPending.set(key, val);
    if (saveSoonTimer) return;
    saveSoonTimer = gbTimeout(() => { saveSoonTimer = 0; saveFlush(); }, SAVE_SOON_MS);
  }
  const GM_XHR_DEFAULT_TIMEOUT = 30000;
  function gbXhr(opts) {
    const scope = opts.scope === 'external' ? 'external' : 'game';

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
      reqBudgetMark(budgetScope);
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
      if (handle) {
        handle.feature = (typeof opts.feature === 'string' && opts.feature) ? opts.feature : null;
        gbXhrBag.push(handle);
      }
      return handle;
    } catch (e) {
      drop();
      if (userOnerror && gbInstanceAlive()) userOnerror({ error: String(e) });
      return null;
    }
  }
  function gbAjaxCancelFeature(feature) {
    if (!feature) return 0;
    let n = 0;
    const tag = String(feature);
    for (const e of gbAjaxPending.slice()) {
      if (e && e.feature === tag && typeof e.cancel === 'function') {
        try { e.cancel(); n++; } catch (_) {}
      }
    }
    return n;
  }
  function gbAbortFeature(feature) {
    if (!feature) return 0;
    let n = 0;
    for (const h of gbXhrBag.slice()) {
      if (h && h.feature === feature && typeof h.abort === 'function') {
        try { h.abort(); n++; } catch (_) {}
      }
    }
    try {
      const m = (typeof gbAjaxCancelFeature === 'function') ? gbAjaxCancelFeature(feature) : 0;
      n += m;
    } catch (_) {}
    return n;
  }
  function xhrLadder(guesses, opts) {
    return xhrGuessLadder(guesses, opts && opts.learned);
  }
  let _gbEvents = null;
  function gbEventsChannel() {
    // Lazy-init BroadcastChannel. (5.10 had inverted null check — dead code.)
    if (_gbEvents != null) return _gbEvents;
    try {
      _gbEvents = new BroadcastChannel('grepbot:events');
      _gbEvents.addEventListener('message', (e) => {
        if (!gbInstanceAlive()) return;
        const d = e && e.data;
        if (!d || d.from === GB_INSTANCE_ID) return;
        if (d.kind === 'captcha' && typeof captchaTrip === 'function') {
          const feat = d.payload && d.payload.feature;
          if (typeof feat !== 'string' || !feat) return;
          if (captchaPausedPure(feat)) return;
          captchaTrip(feat, d.payload && d.payload.detail);
        }
      });
    } catch (_) { _gbEvents = false; }
    return _gbEvents || null;
  }
  function gbEventsEmit(kind, payload) {
    try {
      const ch = gbEventsChannel();
      if (ch) ch.postMessage({ kind, payload: payload || null, ts: Date.now(), from: GB_INSTANCE_ID });
    } catch (_) {}
  }
  const BRIDGE_TIMEOUT_MS = 15000;
  function saveCaptcha() { save(wkey(STORE.CAPTCHA), state.captchaBreakers); }
  function captchaPausedPure(feature) {
    const b = state.captchaBreakers[feature];
    if (!b || !b.until) return false;
    return Date.now() < b.until;
  }
  function captchaExpireSweep(feature) {
    const b = state.captchaBreakers[feature];
    if (!b || !b.until) return;
    if (Date.now() < b.until) return;
    if ((b.trips || 0) > 0) {
      b.trips = Math.max(0, (b.trips || 1) - 1);
      delete b.until;
      saveSoon(wkey(STORE.CAPTCHA), state.captchaBreakers);
    }
  }
  function captchaPaused(feature) {
    const paused = captchaPausedPure(feature);
    if (!paused) captchaExpireSweep(feature);
    return captchaPausedPure(feature);
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
    flash(`captcha: ${feature} en pausa ${mins}m`);
    try { telegramCaptchaTripNotify(feature, mins); } catch (_) {}
    try { if (typeof alertWebhook === 'function') alertWebhook('captcha', { feature, mins, detail }); } catch (_) {}
    try { gbEventsEmit('captcha', { feature, mins, detail }); } catch (_) {}
    try { gbAbortFeature(feature); } catch (_) {}
    updateStatus();
  }
  function captchaClear(feature) {
    let changed = false;
    if (feature) {
      if (state.captchaBreakers[feature]) {
        delete state.captchaBreakers[feature];
        changed = true;
      }
    } else {
      if (Object.keys(state.captchaBreakers || {}).length || captchaGlobalUntil) changed = true;
      state.captchaBreakers = {};
      captchaGlobalUntil = 0;
      saveCaptchaGlobalUntil();
    }
    if (changed) saveCaptcha();
    // A feature-specific clear is only called after an authoritative successful
    // Grepolis response. Manual "clear all" is not proof that the CAPTCHA vanished.
    if (feature) {
      try { telegramCaptchaMaybeResolved('successful-request:' + String(feature)); } catch (_) {}
    }
    updateStatus();
  }

  const CAPTCHA_TEXT_RE = /["']?captcha(?:_required)?["']?\s*[:=]\s*(?:true\b|1\b|["'][^"']+["'])/i;
  function captchaSafeMerge(...sources) {
    const out = {};
    for (const source of sources) {
      if (!source || typeof source !== 'object') continue;
      for (const key of Object.keys(source)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        out[key] = source[key];
      }
    }
    return out;
  }
  function responseIsCaptcha(data) {
    if (!data) return false;

    let d = data;
    if (typeof d === 'string') {

      try { d = JSON.parse(d); } catch (_) { return CAPTCHA_TEXT_RE.test(d); }
    }
    if (!d || typeof d !== 'object') return false;
    if (typeof d.json === 'string') {
      try { d = captchaSafeMerge(d, JSON.parse(d.json)); } catch (_) {}
    } else if (d.json && typeof d.json === 'object') {
      d = captchaSafeMerge(d, d.json);
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
