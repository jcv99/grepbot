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
    villrecruit: 300000,

    batchrecruit: 30000,
    merchant: 45000,
    pttrade: 120000,
    favor: 60000,
    wonder: 180000,
    spy: 1800000,
    hero: 300000,
    godspell: 180000,
  };
  const ORCH_CAPTCHA = {
    culture: 'culture', cave: 'cave', build: 'build', research: 'research',
    trade: 'trade', farm: 'farm', ruraltrade: 'ruraltrade', rurallevel: 'rurallevel',
    recruit: 'recruit', villrecruit: 'villageRecruit', batchrecruit: 'recruit', merchant: 'merchant', pttrade: 'pttrade', favor: 'favor', wonder: 'wonder', spy: 'spy', hero: 'hero', godspell: 'godspell',
  };
  const ORCH_JRN = {
    culture: 'culture', cave: 'cave', build: 'build', research: 'research',
    trade: 'trade', farm: 'farm', ruraltrade: 'ruraltrade', rurallevel: 'rurallevel',
    recruit: 'recruit', villrecruit: 'villageRecruit', batchrecruit: 'recruit', merchant: 'merchant', pttrade: 'pttrade', favor: 'favor', wonder: 'wonder', spy: 'spy', hero: 'hero', godspell: 'godspell',
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
    favor:()=>orchSafe('favor',()=>profTime('orch:favor',()=>favorScan('orch'))),
    wonder:()=>orchSafe('wonder',()=>profTime('orch:wonder',()=>{wonderScan('orch');wonderFavorScan('orch')})),
    spy:()=>orchSafe('spy',()=>profTime('orch:spy',()=>spyCycle('orch'))),
    hero:()=>orchSafe('hero',()=>profTime('orch:hero',()=>heroScan('orch'))),
    godspell:()=>orchSafe('godspell',()=>profTime('orch:godspell',()=>godSpellScan('orch'))),
  };
  function orchFeatureEnabled(key) {
    return {
      culture: state.autoCulture,
      cave: state.autoCave,
      build: state.abAuto || nativeQueueHasPending('build') || cityDesignerHasExecutableWork('build'),
      research: state.autoResearch || nativeQueueHasPending('research') || cityDesignerHasExecutableWork('research'),
      trade: state.autoTrade || state.islandShip || state.autoTransport || state.autoTradeRoutes || state.autoDump,
      farm: state.autoFarm,
      ruraltrade: state.autoRuralTrade,
      rurallevel: state.autoRuralLevel,
      recruit: state.autoRecruit || nativeRecruitPending() || cityDesignerHasExecutableWork('recruit'),
      villrecruit: state.autoVillageRecruit,

      batchrecruit: state.batchRecruit && batchRecruitHasAnyTown(),
      merchant: state.autoMerchant,
      pttrade: state.autoPtTrade,
      favor: state.autoFavor,

      godspell: state.autoFavor,
      wonder: state.autoWonder,
      spy: state.spyEnabled,

      hero: (typeof heroesEnabled === 'function') ? heroesEnabled() : false,
    }[key];
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
    const f = ORCH_JRN[key];
    if (!f || !(since > 0)) return 0;
    let n = 0;
    const list = state.decisions || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const r = list[i];
      if (r.ts < since) break;
      if (r.f === f && r.r === 'ok') n += r.n || 1;
    }
    return n;
  }

  function orchIdleFactor(key) {
    // v5.9: fixed independent cadences. An idle module never slows another one
    // and never puts itself to sleep for 2x/4x/8x intervals.
    return 1;
  }
  // v6.0.22: user-tunable orch cadence multiplier. Excludes trade/recruit/build
  // families because their cost is request-budget or capacity bound and a
  // tighter cadence burns the captcha ladder. Floor prevents a 0-scale slider
  // from collapsing every module into a single tick.
  const ORCH_CADENCE_FLOOR_MS = 5000;
  const ORCH_SCALE_EXCLUDE = new Set([
    'trade', 'pttrade', 'ruraltrade', 'rurallevel',
    'recruit', 'batchrecruit', 'villrecruit',
    'build',
  ]);
  function orchCadence(key) {
    const base = ORCH_CADENCE[key] || ORCH_MS;
    if (ORCH_SCALE_EXCLUDE.has(key)) return base;
    const scale = (state && state.orchCadenceScale > 0) ? state.orchCadenceScale : 1;
    return Math.max(ORCH_CADENCE_FLOOR_MS, Math.round(base * scale));
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
      captcha: captchaPaused(ORCH_CAPTCHA[key] || key),
      dueInMs: Math.max(0, ((orchLastRun[key] || 0) + orchCadence(key)) - now),
    }));
  }
  function orchHousekeepingTick() {
    if (!hostEnabled()) return;
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
    const cap = ORCH_CAPTCHA[key];
    if (cap && captchaPaused(cap)) return;

    // Each handler owns its own gbLock and final affordability checks. No module
    // can suppress another module here. The tx planner only protects an action
    // already in flight; it does not reserve resources for future actions.
    orchNoteResult(key);
    orchLastRun[key] = Date.now();
    orchJrnMark[key] = Date.now();
    ORCH_HANDLERS[key]();
  }
  function orchTick() {
    // Wake/manual poke: launch every enabled module independently. Staggering is
    // only to avoid a burst of HTTP requests; it is not a priority mechanism.
    orchHousekeepingTick();
    if (automationPaused({})) return;
    let idx = 0;
    for (const key of orchDefaultOrder()) {
      if (!ORCH_HANDLERS[key] || !orchFeatureEnabled(key)) continue;
      const delay = idx++ * 120;
      gbTimeout(() => orchModuleTick(key, 'poke'), delay);
    }
  }
  const orchTimerIds=Object.create(null),orchBootTimerIds=Object.create(null);
  function orchStartIndependentTimers() {
    let idx=0,created=0;
    for(const key of orchDefaultOrder()){
      if(!ORCH_HANDLERS[key])continue;
      const cadence=orchCadence(key);
      if(!orchBootTimerIds[key]){
        orchBootTimerIds[key]=gbTimeout(()=>{orchBootTimerIds[key]=0;orchModuleTick(key,'boot')},500+(idx*120));
      }
      if(!orchTimerIds[key]){
        orchTimerIds[key]=gbInterval(()=>orchModuleTick(key,'timer'),cadence);
        created++;
      }
      idx++;
    }
    return created;
  }
  // v6.0.22: re-register every interval after a scale change. gbInterval cadence
  // is fixed at creation time, so a slider tweak has to clear + recreate.
  function orchRestartTimers() {
    for (const key of Object.keys(orchTimerIds)) {
      const id = orchTimerIds[key];
      if (id) { try { gbClearInterval(id); } catch (_) {} }
      orchTimerIds[key] = 0;
    }
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
