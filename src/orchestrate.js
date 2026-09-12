  const ORCH_JITTER = 0.2;
  const ORCH_DEADLOCK_FARM_IDLE = 2;
  const ORCH_DRAIN_KEYS = ['cave', 'trade', 'ruraltrade'];
  const ORCH_PIN_RATIO = 0.97;
  const ORCH_UNIT_KEYS = ['recruit', 'villrecruit'];
  const orchCadenceJitter = Object.create(null);
  let orchDeadlock = { open: false, towns: [], at: 0, stuckLoggedAt: 0 };
  function orchTownIds() {
    const ids = [];
    try {
      const from = (typeof townsFromGame === 'function') ? townsFromGame() : null;
      if (from) from.forEach(t => ids.push(String(t.id)));
    } catch (_) {}
    if (!ids.length) {
      try { Object.keys((uwCached().ITowns && uwCached().ITowns.towns) || {}).forEach(id => ids.push(String(id))); } catch (_) {}
    }
    return ids;
  }
  function orchPinnedTowns() {
    const pinned = [];
    let blind = 0;
    for (const id of orchTownIds()) {
      const rs = (typeof townResState === 'function') ? townResState(id) : null;
      if (!rs || !(rs.cap > 0)) { blind++; continue; }
      if (Math.max(rs.wood, rs.stone, rs.iron) / rs.cap >= ORCH_PIN_RATIO) pinned.push(id);
    }
    if (blind && !pinned.length) {
      gbLogT('orch-deadlock-blind', 600000, `orch: ${blind} town(s) with unreadable capacity - deadlock check skipped for them`);
    }
    return pinned;
  }
  function orchDeadlockOpen() { return !!orchDeadlock.open; }
  function orchDeadlockState() { return { open: !!orchDeadlock.open, towns: (orchDeadlock.towns || []).slice(), since: orchDeadlock.at || 0 }; }
  function orchDeadlockNoteStuck(why) {
    if (!orchDeadlock.open) return;
    const now = Date.now();
    if (now - (orchDeadlock.stuckLoggedAt || 0) < 3600000) return;
    orchDeadlock.stuckLoggedAt = now;
    gbLog(`orch: deadlock cannot drain (${why}) - spend resources by hand (build/recruit/culture)`);
  }
  function orchDeadlockEval() {
    const off = state.orchDeadlockResolve === false;
    const pinned = off ? [] : orchPinnedTowns();
    const farmStuck = !!state.autoFarm && (orchIdle.farm || 0) >= ORCH_DEADLOCK_FARM_IDLE;
    const open = !off && pinned.length > 0 && farmStuck;
    if (open !== orchDeadlock.open) {
      orchDeadlock = { open, towns: pinned, at: Date.now(), stuckLoggedAt: 0 };
      gbLog(open
        ? `orch: warehouse deadlock in town(s) ${pinned.join(',')} - forcing ${ORCH_DRAIN_KEYS.join('/')} ahead of farm`
        : 'orch: warehouse deadlock cleared - normal priority order restored');
      try { updateStatus(); } catch (_) {}
    } else if (open) {
      orchDeadlock.towns = pinned;
    }
    return orchDeadlock.open;
  }
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
    villrecruit: 300000,

    batchrecruit: 30000,
    merchant: 45000,
    pttrade: 120000,
    gold: 120000,
    favor: 60000,
    wonder: 180000,
    spy: 1800000,
    hero: 300000,
    godspell: 180000,
  };
  const ORCH_CAPTCHA = {
    culture: 'culture', cave: 'cave', build: 'build', research: 'research',
    trade: 'trade', farm: 'farm', ruraltrade: 'ruraltrade', rurallevel: 'rurallevel',
    recruit: 'recruit', villrecruit: 'villrecruit', batchrecruit: 'recruit', merchant: 'merchant', pttrade: 'pttrade', gold: ['gold', 'goldoffer'], favor: 'favor', wonder: 'wonder', spy: 'spy', hero: 'hero', godspell: 'spell',
  };
  const ORCH_JRN = {
    culture: 'culture', cave: 'cave', build: 'build', research: 'research',
    trade: 'trade', farm: 'farm', ruraltrade: 'ruraltrade', rurallevel: 'rurallevel',
    recruit: 'recruit', villrecruit: 'villrecruit', batchrecruit: 'recruit', merchant: 'merchant', pttrade: 'pttrade', gold: ['gold', 'goldoffer'], favor: 'favor', wonder: 'wonder', spy: 'spy', hero: 'hero', godspell: 'spell',
  };
  const ORCH_IDLE_TRIP = 4;
  const ORCH_IDLE_MAX = 8;
  const orchLastRun = {};
  const orchIdle = {};
  const orchJrnMark = {};
  function orchSafe(key,fn){try{return fn()}catch(e){const msg=String(e&&e.stack||e).slice(0,220);gbLog(`orch ${key} exception: ${msg}`);markModuleHealth(key,'err',{error:msg});whyNote(key,'orchestrator','error',msg);orchIdle[key]=0;return null}}
  const ORCH_HANDLERS = {
    culture:()=>orchSafe('culture',()=>profTime('orch:culture',()=>cultureScan('orch'))),
    cave:()=>orchSafe('cave',()=>profTime('orch:cave',()=>caveScan('orch'))),
    build:()=>orchSafe('build',()=>profTime('orch:build',()=>{abEnsureTargets();abScan('orch')})),
    research:()=>orchSafe('research',()=>profTime('orch:research',()=>researchScan('orch'))),
    trade:()=>orchSafe('trade',()=>profTime('orch:trade',()=>tradeScan('orch'))),
    farm:()=>orchSafe('farm',()=>profTime('orch:farm',()=>autoClaimFarms('orch'))),
    ruraltrade:()=>orchSafe('ruraltrade',()=>profTime('orch:ruraltrade',()=>ruralTradeScan('orch'))),
    rurallevel:()=>orchSafe('rurallevel',()=>profTime('orch:rurallevel',()=>ruralLevelScan('orch'))),
    recruit:()=>orchSafe('recruit',()=>profTime('orch:recruit',()=>recruitScan('orch'))),
    villrecruit:()=>orchSafe('villrecruit',()=>profTime('orch:villrecruit',()=>villageRecruitScan('orch'))),
    batchrecruit:()=>orchSafe('batchrecruit',()=>profTime('orch:batchrecruit',()=>batchRecruitScan('orch'))),
    merchant:()=>orchSafe('merchant',()=>profTime('orch:merchant',()=>merchantScan('orch'))),
    pttrade:()=>orchSafe('pttrade',()=>profTime('orch:pttrade',()=>ptTradeScan('orch'))),
    gold:()=>orchSafe('gold',()=>profTime('orch:gold',()=>goldScan('orch'))),
    favor:()=>orchSafe('favor',()=>profTime('orch:favor',()=>favorScan('orch'))),
    wonder:()=>orchSafe('wonder',()=>profTime('orch:wonder',()=>{wonderScan('orch');wonderFavorScan('orch')})),
    spy:()=>orchSafe('spy',()=>profTime('orch:spy',()=>spyCycle('orch'))),
    hero:()=>orchSafe('hero',()=>profTime('orch:hero',()=>heroScan('orch'))),
    godspell:()=>orchSafe('godspell',()=>profTime('orch:godspell',()=>godSpellScan('orch'))),
  };
  function orchFeatureEnabled(key) {
    switch (key) {
      case 'culture': return state.autoCulture;
      case 'cave': return state.autoCave;
      case 'build': return state.abAuto || nativeQueueHasPending('build') || cityDesignerHasExecutableWork('build');
      case 'research': return state.autoResearch || nativeQueueHasPending('research') || cityDesignerHasExecutableWork('research');
      case 'trade': return state.autoTrade || state.islandShip || state.autoTransport || state.autoTradeRoutes || state.autoDump || (typeof resourceOptimizerCfg === 'function' && resourceOptimizerCfg().enabled);
      case 'farm': return state.autoFarm;
      case 'ruraltrade': return state.autoRuralTrade;
      case 'rurallevel': return state.autoRuralLevel;
      case 'recruit': return state.autoRecruit || nativeRecruitPending() || cityDesignerHasExecutableWork('recruit');
      case 'villrecruit': return state.autoVillageRecruit;
      case 'batchrecruit': return state.batchRecruit && batchRecruitHasAnyTown();
      case 'merchant': return state.autoMerchant;
      case 'pttrade': return state.autoPtTrade;
      case 'gold': return state.goldEnabled === true;
      case 'favor': return state.autoFavor;
      case 'godspell': return state.autoFavor;
      case 'wonder': return state.autoWonder;
      case 'spy': return state.spyEnabled;
      case 'hero': return (typeof heroesEnabled === 'function') ? heroesEnabled() : false;
      default: return false;
    }
  }
  function orchDefaultOrder() {
    const out=[];
    for(const k of ORCH_ORDER_DEFAULT)if(ORCH_HANDLERS[k]&&!out.includes(k))out.push(k);
    // Registry is the source of truth. New handlers cannot silently miss a
    // timer merely because a second static list was not updated.
    for(const k of Object.keys(ORCH_HANDLERS))if(!out.includes(k))out.push(k);
    return out;
  }

  function orchJrnOkSince(key, since) {
    const raw = ORCH_JRN[key];
    const features = Array.isArray(raw) ? raw : [raw];
    if (!features[0] || !(since > 0)) return 0;
    let n = 0;
    const list = state.decisions || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const r = list[i];
      if (r.ts < since) break;
      if (features.includes(r.f) && r.r === 'ok') n += r.n || 1;
    }
    return n;
  }

  function orchIdleFactor(key) {
    if (gbNeverStop() || state.orchAdaptive === false) return 1;
    if (orchDeadlock.open && ORCH_DRAIN_KEYS.includes(key)) return 1;
    const streak = orchIdle[key] || 0;
    if (streak < ORCH_IDLE_TRIP) return 1;
    return Math.min(ORCH_IDLE_MAX, 1 << Math.min(3, streak - ORCH_IDLE_TRIP + 1));
  }
  // v6.0.22: user-tunable orch cadence multiplier. Excludes trade/recruit/build
  // families because their cost is request-budget or capacity bound and a
  // tighter cadence burns the captcha ladder. Floor prevents a 0-scale slider
  // from collapsing every module into a single tick.
  const ORCH_CADENCE_FLOOR_MS = 5000;
  const ORCH_SCALE_EXCLUDE = new Set([
    'trade', 'pttrade', 'ruraltrade', 'rurallevel',
    'gold',
    'recruit', 'batchrecruit', 'villrecruit',
    'build',
  ]);
  function orchCadence(key) {
    const base = (ORCH_CADENCE[key] || ORCH_MS) * orchIdleFactor(key);
    if (ORCH_SCALE_EXCLUDE.has(key)) return Math.round(base * (orchCadenceJitter[key] || 1));
    const scale = (state && state.orchCadenceScale > 0) ? state.orchCadenceScale : 1;
    return Math.max(ORCH_CADENCE_FLOOR_MS, Math.round(base * scale * (orchCadenceJitter[key] || 1)));
  }
  function orchNoteResult(key) {
    const since = orchJrnMark[key];
    if (!(since > 0)) return;
    if (orchJrnOkSince(key, since) > 0) orchIdle[key] = 0;
    else orchIdle[key] = (orchIdle[key] || 0) + 1;
  }
  function orchStatus() {
    const now = Date.now();
    return orchDefaultOrder().map(key => ({
      key,
      on: !!orchFeatureEnabled(key),
      cadenceMs: orchCadence(key),
      idle: orchIdle[key] || 0,
      captcha: orchCaptchaPaused(key),
      dueInMs: Math.max(0, ((orchLastRun[key] || 0) + orchCadence(key)) - now),
    }));
  }
  function orchCaptchaPaused(key) {
    const raw = ORCH_CAPTCHA[key] || key;
    return (Array.isArray(raw) ? raw : [raw]).some(feature => captchaPaused(feature));
  }
  function orchHousekeepingTick() {
    if (!hostEnabled()) return;
    try { orchDeadlockEval(); } catch (_) {}
    try { roleAdvisorTick(); } catch (_) {}
    try { intelDigestTick(); } catch (_) {}
    try { townCapWatcher(); } catch (_) {}
    // Telegram monitoring is read-only and intentionally keeps running even when
    // automation writes are paused by CAPTCHA/server cooldown.
    try { telegramMonitorTick(); } catch (_) {}
  }
  function orchModuleTick(key, reason) {
    if (!hostEnabled()) return;
    if (automationPaused({})) return;
    if (!ORCH_HANDLERS[key] || !orchFeatureEnabled(key)) return;
    if (orchCaptchaPaused(key)) return;

    // Each handler owns its own gbLock and final affordability checks. No module
    // can suppress another module here. The tx planner only protects an action
    // already in flight; it does not reserve resources for future actions.
    orchNoteResult(key);
    orchLastRun[key] = Date.now();
    orchCadenceJitter[key] = 1 - ORCH_JITTER + Math.random() * ORCH_JITTER * 2;
    orchJrnMark[key] = Date.now();
    ORCH_HANDLERS[key]();
  }
  function orchTick() {
    orchHousekeepingTick();
    if (automationPaused({})) return;
    const configured = state.priorityOrder && state.priorityOrder.length ? state.priorityOrder : orchDefaultOrder();
    let order = [...new Set(goalMandatoryModules().concat(configured, orchDefaultOrder()))];
    if (orchDeadlockEval()) {
      const drain = ORCH_DRAIN_KEYS.filter(k => order.includes(k));
      order = drain.concat(order.filter(k => !drain.includes(k)));
    }
    const now = Date.now();
    const due = [];
    for (let rank = 0; rank < order.length; rank++) {
      const key = order[rank];
      if (!ORCH_HANDLERS[key] || !orchFeatureEnabled(key)) continue;
      if (orchCaptchaPaused(key)) continue;
      const cadence = orchCadence(key);
      const overdue = now - (orchLastRun[key] || 0) - cadence;
      if (overdue >= 0) due.push({ key, rank, overdue, cadence });
    }
    due.sort((a, b) => {
      const gap = b.overdue - a.overdue;
      const band = Math.max(a.cadence, b.cadence, ORCH_MS) * 2;
      return Math.abs(gap) > band ? gap : a.rank - b.rank;
    });
    due.slice(0, ORCH_MAX_PER_TICK).forEach((item, idx) => {
      const fire = () => orchModuleTick(item.key, 'orch');
      if (idx === 0) fire();
      else gbTimeout(fire, idx * ORCH_SPACING_MS + Math.floor(Math.random() * 200));
    });
  }
  let orchTimerId = 0, orchBootTimerId = 0;
  function orchStartIndependentTimers() {
    if (!orchBootTimerId) orchBootTimerId = gbTimeout(() => { orchBootTimerId = 0; orchTick(); }, 500);
    if (!orchTimerId) orchTimerId = gbInterval(orchTick, ORCH_MS);
    return orchTimerId ? 1 : 0;
  }
  // v6.0.22: re-register every interval after a scale change. gbInterval cadence
  // is fixed at creation time, so a slider tweak has to clear + recreate.
  function orchRestartTimers() {
    if (orchTimerId) { try { gbClearInterval(orchTimerId); } catch (_) {} orchTimerId = 0; }
    orchStartIndependentTimers();
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
