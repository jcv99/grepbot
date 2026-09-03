  function abGetTown(townId) { return gbTownModel(townId); }

  const AB_OP_WATCHDOG_MS = 90000;
  const AB_SCRIPT_PHASES = [
    { id:'tube', label:'Tubo (Senado 24 + Almac\u00e9n 30)',
      gate:(l)=>(+l.main||0) < 24,
      targets:(l)=>({ main:24, storage:Math.max(30, +l.storage||0) }) },
    { id:'academy7', label:'Academia 7',
      gate:(l)=>(+l.main||0) >= 24 && (+l.academy||0) < 7,
      targets:(l)=>({ main:24, storage:Math.max(30, +l.storage||0), academy:Math.max(7, +l.academy||0) }) },
    { id:'theater', label:'Requisitos para Teatro',
      gate:(l)=>(+l.academy||0) >= 7 && (+l.theater||0) < 1,
      targets:(l)=>({ main:24, storage:Math.max(30, +l.storage||0), academy:Math.max(7, +l.academy||0), theater:1 }) },
    { id:'academy30', label:'Academia 30',
      gate:(l)=>(+l.theater||0) >= 1 && (+l.academy||0) < 30,
      targets:(l)=>({ main:24, storage:Math.max(30, +l.storage||0), academy:30, theater:1 }) },
    { id:'maxall', label:'Todo al m\u00e1ximo',
      gate:()=>false,
      targets:(l)=>abScriptMaxTargets(l) },
  ];
  function abScriptMaxTargets(levels) {
    const out = {};
    for (const b of AB_BUILDINGS) {
      const max = abMaxLevel(b);
      if (max == null) continue;
      const cur = +(levels && levels[b]) || 0;
      if (cur >= max) continue;
      out[b] = max;
    }
    return out;
  }
  function abScriptEnsure() {
    if (!state.abScript || typeof state.abScript !== 'object') state.abScript = { active:false, startedAt:0, perTown:{} };
    if (!state.abScript.perTown || typeof state.abScript.perTown !== 'object' || Array.isArray(state.abScript.perTown)) state.abScript.perTown = {};
    if (!state.abScript.active) state.abScript.perTown = {};
    return state.abScript;
  }
  function abScriptActive() { return !!(state.abScript && state.abScript.active); }
  function abScriptEffectiveTargets(townId) {
    if (!abScriptActive()) return null;
    const p = state.abScript.perTown && state.abScript.perTown[String(townId)];
    return p && p.targets ? Object.assign({}, p.targets) : null;
  }
  function abScriptCurrentPhase(townId) {
    if (!abScriptActive()) return null;
    const id = String(townId);
    const p = state.abScript.perTown && state.abScript.perTown[id];
    if (!p) return null;
    const def = AB_SCRIPT_PHASES.find(x => x.id === p.phase);
    return def || null;
  }
  function abScriptToggle() {
    if (abScriptActive()) {
      state.abScript = { active:false, startedAt:0, perTown:{} };
      save(STORE.AB_SCRIPT, state.abScript);
      gbLog('script CS: desactivado - objetivos vuelven a los valores compartidos');
      try { renderAbQueue(); } catch (_) {}
      return false;
    }
    state.abScript = { active:true, startedAt:Date.now(), perTown:{} };
    save(STORE.AB_SCRIPT, state.abScript);
    if (!state.abAuto) { state.abAuto = true; save(STORE.AB_AUTO, true); }
    gbLog('script CS: activado - Senado 24 \u2192 Academia 7 \u2192 Teatro \u2192 Academia 30 \u2192 M\u00e1x');
    try { renderAbQueue(); } catch (_) {}
    return true;
  }
  function abScriptTick(townId) {
    if (!abScriptActive()) return null;
    const id = String(townId);
    const levels = abCurrentLevels(townId);
    if (!levels) return null;
    let chosen = null;
    for (const p of AB_SCRIPT_PHASES) { if (p.gate(levels)) { chosen = p; break; } }
    if (!chosen) return null;
    const cur = state.abScript.perTown[id];
    const fresh = chosen.targets(levels);
    if (!cur || cur.phase !== chosen.id) {
      state.abScript.perTown[id] = { phase:chosen.id, targets:fresh };
      save(STORE.AB_SCRIPT, state.abScript);
      gbLog(`script CS: ciudad ${townNameById(id) || id} entra en fase "${chosen.label}"`);
    } else {
      state.abScript.perTown[id].targets = fresh;
    }
    return state.abScript.perTown[id];
  }

  const WALL_DAMAGE_FNS = ['getWallDamage', 'getDamagePercentForBuilding', 'getDamagePercentage', 'getWallDamagePercent'];
  const WALL_DAMAGE_ATTRS = ['wall_damage', 'wallDamage', 'damage_percent', 'wall_damage_percent'];
  function abWallDamage(townId) {

    try {
      const t = gbTownModel(townId);
      if (!t) return null;
      let v = gbProbeNum(t, WALL_DAMAGE_FNS, ['wall']);
      if (v == null) v = gbProbeNum(t, WALL_DAMAGE_FNS);
      if (v == null) v = gbProbeAttr(t, WALL_DAMAGE_ATTRS);

      return (Number.isFinite(v) && v >= 0 && v <= 100) ? v : null;
    } catch (_) { return null; }
  }

  function abWallEffectiveLevel(townId, wallLevel) {
    if (!state.autoWallRepair) return wallLevel;
    const dmg = abWallDamage(townId);
    if (dmg == null) {
      gbLogT('wall-damage-blind-' + townId, 600000,
        `wall repair: damage unreadable on town ${townId} - no offset applied`);
      return wallLevel;
    }
    if (!(dmg > 0)) return wallLevel;
    const lost = Math.floor(wallLevel * dmg / 100);
    if (lost <= 0) return wallLevel;
    gbLogT('wall-damage-' + townId, 300000,
      `wall repair: town ${townId} wall ${wallLevel} at ${dmg}% damage - treating as ${wallLevel - lost}`);
    return Math.max(0, wallLevel - lost);
  }
  function abCurrentLevels(townId) {
    const t=abGetTown(townId),actual=abActualLevels(townId);if(!t||!actual)return null;const levels=Object.assign({},actual);
    try {
      const orders=t.buildingOrders?t.buildingOrders():null;if(!orders||!Array.isArray(orders.models))return levels;
      for(const m of orders.models){const a=m.attributes||m,type=a.building_type;if(!type||levels[type]==null)continue;if(a.tear_down)levels[type]=Math.max(0,levels[type]-1);else levels[type]+=1}
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

      const data = bbd && (bbd[townId] != null ? bbd[townId] : (bbd[String(townId)] != null ? bbd[String(townId)] : null));
      return data && data.attributes && data.attributes.building_data && data.attributes.building_data[building] || null;
    } catch (_) { return null; }
  }
  function abBuildingCost(townId, building) {
    const bd = abBuildDataEntry(townId, building);
    if (!bd) return null;
    const need = bd.resources_for || bd.resources || bd.costs;
    if (!need || need.wood == null || need.stone == null || need.iron == null) return null;
    const popRaw = bd.population_for != null ? +bd.population_for : (bd.population != null ? +bd.population : NaN);

    const popBlind = !Number.isFinite(popRaw);
    const pop = popBlind ? 0 : popRaw;
    return { wood: +need.wood || 0, stone: +need.stone || 0, iron: +need.iron || 0, pop, population: pop, popBlind };
  }
  // Same flag the senate uses to enable the Ampliación button
  // (`toggleClass("disabled", !can_upgrade)`). true = clickable, false = grey,
  // null = flag absent/unreadable (do not invent a shortage).
  function abUpgradeClickable(townId, building) {
    const bd = abBuildDataEntry(townId, building);
    if (!bd || typeof bd !== 'object' || !Object.prototype.hasOwnProperty.call(bd, 'can_upgrade')) return null;
    const v = bd.can_upgrade;
    if (v === true || v === 1) return true;
    if (v === false || v === 0) return false;
    return null;
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
    const clickable = abUpgradeClickable(townId, building);
    const need = abBuildingCost(townId, building);
    let res = null, pop = null;
    try { res = t.resources && t.resources(); } catch (_) {}
    try { pop = t.getAvailablePopulation ? +t.getAvailablePopulation() : (res && res.population != null ? gbNum(res.population) : null); } catch (_) {}
    const wood = res ? gbNum(res.wood) : null, stone = res ? gbNum(res.stone) : null, iron = res ? gbNum(res.iron) : null;
    const have = (wood != null && stone != null && iron != null)
      ? { wood, stone, iron, population: pop }
      : null;
    const margin = 0;
    const popShort = !!(need && need.pop > 0 && pop != null && pop < need.pop);

    // Blue Ampliación button. Do not second-guess with resources_for.
    if (clickable === true) return { ok: true, need, have, margin, popShort: false };
    if (clickable === false) {
      if (popShort) return { ok: false, why: 'population', need, have, margin, popShort };
      return { ok: false, why: 'resources', need, have, margin, popShort };
    }
    // Flag missing (other towns / senate closed): same as 5.10.64 — live stock vs cost.
    if (!need) return { ok: false, why: 'cost unreadable' };
    if (!have || pop == null) return { ok: false, why: 'resources/pop unreadable' };
    if (need.popBlind) {
      gbLogT('ab-pop-blind-' + building, 900000, `build: population cost for ${building} unreadable - population check is blind, server decides`);
    }
    if (have.wood < need.wood + margin || have.stone < need.stone + margin || have.iron < need.iron + margin) {
      return { ok: false, why: 'resources', need, have, margin, popShort };
    }
    if (popShort) return { ok: false, why: 'population', need, have, margin, popShort };
    return { ok: true, need, have, margin, popShort: false };
  }
  function abAffordReason(aff) {
    if (!aff) return 'datos de coste ilegibles';
    if (aff.why === 'resources' && aff.need && aff.have) {
      const miss = [['madera','wood'],['piedra','stone'],['plata','iron']]
        .filter(([,k]) => +aff.have[k] < (+aff.need[k] || 0) + (+aff.margin || 0))
        .map(([label,k]) => `${label} ${Math.floor(+aff.have[k]||0)} (coste ${Math.ceil(+aff.need[k]||0)}${+aff.margin ? ` + reserva ${+aff.margin}` : ''})`);
      return `esperando recursos${miss.length ? ': '+miss.join(', ') : ''}`;
    }
    if (aff.why === 'population' && aff.need && aff.have) return `esperando poblaci\u00f3n ${Math.floor(+aff.have.population||0)}/${Math.ceil(+aff.need.pop||0)}`;
    const labels = {'town unreadable':'ciudad ilegible','cost unreadable':'coste ilegible','resources/pop unreadable':'recursos o poblaci\u00f3n ilegibles'};
    return labels[aff.why] || String(aff.why || 'bloqueado');
  }
  function abReasonText(why) {
    const s = String(why || 'sin acci\u00f3n ejecutable');
    const simple = {
      'requirements-unreadable':'requisitos del edificio ilegibles',
      'dependency-cycle':'ciclo en los requisitos del edificio',
      'queue-full-or-unreadable':'cola real llena o ilegible',
      'queue-unreadable':'cola real ilegible',
      'queue-full':'cola real llena',
      'levels-unreadable':'niveles de edificios ilegibles',
      'no-valid-build':'ninguna construcci\u00f3n ejecutable ahora',
      'native-head-changed':'la primera orden cambi\u00f3; se volver\u00e1 a comprobar',
      'recently-accepted-waiting-model':'orden aceptada; esperando actualizaci\u00f3n del juego',
      'max-level':'nivel m\u00e1ximo alcanzado',
      'resources':'esperando recursos',
      'population':'esperando poblaci\u00f3n',
      'paused':'cola pausada',
      'manual-review':'comprobar la cola real antes de continuar',
      'inflight':'env\u00edo en curso',
    };
    if (simple[s]) return simple[s];
    let m = s.match(/^dependency-blocked:(.+)$/);
    if (m) return `requisito bloqueado: ${nativeBuildLabel(m[1])}`;
    m = s.match(/^missing:([^:]+):(\d+)\/(\d+)$/);
    if (m) return `falta ${nativeBuildLabel(m[1])}: nivel ${m[2]} de ${m[3]}`;
    m = s.match(/^plan-changed:([^>]+)->(.+)$/);
    if (m) return `el plan cambi\u00f3 de ${nativeBuildLabel(m[1])} a ${nativeBuildLabel(m[2])}`;
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
  // Random fallback: plan exhausted, queue has room. Core 13 buildings only
  // (AB_CS_FAST keys) — special-group exclusivity is not modeled, so specials
  // stay out. Pick is persisted per town so abFinalValidate's recompute of
  // abPickNextFromLevels returns the same building instead of re-rolling.
  function abPickRandom(townId, levels) {
    if (!state.abRandom || !levels) return null;
    const candidates = AB_BUILDINGS.filter(b => AB_CS_FAST[b] != null).filter(b => {
      if (goalQueueSuppressed(townId, 'build', b)) return false;
      const max = abMaxLevel(b);
      if (max == null || +(levels[b] || 0) >= max) return false;
      const req = abRequirementMap(townId, b);
      if (req == null) return false;
      for (const [dep, need] of Object.entries(req)) if (+(levels[dep] || 0) < +need) return false;
      return abCanAfford(townId, b).ok;
    });
    if (!candidates.length) return null;
    const id = String(townId);
    if (!state.abRandomPick || typeof state.abRandomPick !== 'object') state.abRandomPick = {};
    const stored = state.abRandomPick[id];
    let pick = stored && candidates.includes(stored.building) ? stored.building : null;
    if (!pick) {
      pick = candidates[Math.floor(Math.random() * candidates.length)];
      state.abRandomPick[id] = { building: pick, at: Date.now() };
      save(STORE.AB_RANDOM_PICK, state.abRandomPick);
      gbLog(`auto-queue: random fallback picked ${AB_LABELS[pick] || pick} @${townId}`);
    }
    return { building: pick, forTarget: pick, reason: 'random fallback', cost: abBuildingCost(townId, pick) };
  }
  function abRandomPickClear(townId, plan) {
    if (!plan || plan.reason !== 'random fallback') return;
    const id = String(townId);
    if (state.abRandomPick && state.abRandomPick[id] && state.abRandomPick[id].building === plan.building) {
      delete state.abRandomPick[id];
      save(STORE.AB_RANDOM_PICK, state.abRandomPick);
    }
  }
  function abPickNextFromLevels(townId, levels) {
    if (!levels) return null;
    const explicit=nativeQueueBuildPlan(townId,levels);
    if(explicit.hasJob)return explicit.plan;
    const targets = goalEffectiveBuildTargets(townId);
    for (const target of goalBuildOrder(townId,Object.keys(targets))) {
      const max = abMaxLevel(target);
      if (max == null) { gbLogT('ab-max-' + target, 300000, `auto-queue: max level unreadable for ${target} \u2014 fail closed`); continue; }
      const want = Math.min(+targets[target] || 0, max);

      const have = target === 'wall' ? abWallEffectiveLevel(townId, +(levels.wall || 0)) : +(levels[target] || 0);
      if (want <= 0 || have >= want) continue;
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
      if (!aff.ok) {

        if (aff.popShort && resolved.building !== 'farm' && nativePopRescueFifo(townId, levels, aff)) return null;
        continue;
      }
      const out={ building: resolved.building, forTarget: target, reason: resolved.reason, cost: aff.need };if(cdIsProfile(goalTownCfg(townId).profile))out.cdRevision=cdProfileRevision(townId);return out;
    }
    const demo=cdNextDemolition(townId,levels);if(demo)return demo;
    return abPickRandom(townId, levels);
  }
  function abPickNext(townId) { return abPickNextFromLevels(townId, abCurrentLevels(townId)); }
  function abFinalValidate(townId, plan) {
    const q = abQueueInfo(townId);
    if (!q.known) return { ok: false, why: 'queue-unreadable' };
    if(plan&&plan.mode==='teardown'&&q.len!==0)return {ok:false,why:'teardown-queue-busy',detail:`demolición requiere cola real vacía (${q.len}/${q.max})`};
    if (q.len >= q.max) return { ok: false, why: 'queue-full', detail:`cola real llena (${q.len}/${q.max})` };
    const levels = abCurrentLevels(townId);
    if (!levels) return { ok: false, why: 'levels-unreadable' };
    // Reject stale City Designer plans before recomputing the current plan.
    // Replanning can latch a safe strip; an obsolete revision must not trigger
    // any current-profile planning side effect before it is discarded.
    if(plan&&plan.cdRevision!=null&&+plan.cdRevision!==cdProfileRevision(townId))return {ok:false,why:'cd-revision-changed'};
    const fresh = abPickNextFromLevels(townId, levels);
    if (!fresh) return { ok: false, why: 'no-valid-build' };
    if(plan&&plan.nativeJobId&&fresh.nativeJobId!==plan.nativeJobId)return {ok:false,why:'native-head-changed'};
    if (plan && fresh.building !== plan.building) return { ok: false, why: `plan-changed:${plan.building}->${fresh.building}`, replan: fresh };
    if(fresh.mode==='teardown'){const actual=abActualLevels(townId);if(!actual)return {ok:false,why:'levels-unreadable'};const targetLevel=+(actual[fresh.building]||0)-1;if(targetLevel<0)return {ok:false,why:'min-level'};if(targetLevel!==+fresh.targetLevel)return {ok:false,why:'teardown-level-changed'};const gate=cdCanStartStrip(townId);if(!gate.ok)return {ok:false,why:'strip-'+gate.why};if(txRecentlyCommitted(`build:${townId}:${fresh.building}:${targetLevel}`,60000))return {ok:false,why:'recently-accepted-waiting-model'};return {ok:true,plan:Object.assign({},fresh,{targetLevel,mode:'teardown',cdRevision:cdProfileRevision(townId)})}}
    const targetLevel=+(levels[fresh.building]||0)+1;
    if(txRecentlyCommitted(`build:${townId}:${fresh.building}:${targetLevel}`,60000))return {ok:false,why:'recently-accepted-waiting-model'};
    const max = abMaxLevel(fresh.building);
    if (max == null || +(levels[fresh.building] || 0) >= max) return { ok: false, why: 'max-level' };
    const req = abRequirementMap(townId, fresh.building);
    if (req == null) return { ok: false, why: 'requirements-unreadable' };
    for (const [dep, need] of Object.entries(req)) if (+(levels[dep] || 0) < +need) return { ok: false, why: `missing:${dep}:${levels[dep] || 0}/${need}` };
    const aff = abCanAfford(townId, fresh.building);
    if (!aff.ok) {

      if (aff.popShort && fresh.building !== 'farm') nativePopRescueFifo(townId, levels, aff);
      return { ok: false, why: aff.why, detail:abAffordReason(aff) };
    }
    return { ok: true, plan: Object.assign({},fresh,{targetLevel}) };
  }
  function abBuildUp(townId, plan) {
    return new Promise(resolve => {
      const pauseInfo = {};
      const pauseReason = !hostEnabled() ? 'automatizaci\u00f3n desactivada'
        : (captchaPaused('build') ? 'pausado por captcha'
          : (automationPaused(pauseInfo) ? `pausado: ${pauseInfo.reason || 'actividad del jugador'}`
            : (circuitOpen('build') ? 'construcci\u00f3n pausada por protecci\u00f3n ante errores' : '')));
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
      let provisionalStrip=false,stripStateRef=null;if(check.plan.mode==='teardown'){stripStateRef=cdTownState(townId);const already=!!(stripStateRef.stripStarted||stripStateRef.stripFinalized);if(!cdMaybeLatchStrip(townId,false)){resolve('replan');return}provisionalStrip=!already}
      const building = check.plan.building;
      const nativeId=check.plan.nativeJobId||null;
      if(nativeId&&!nativeQueueMarkBuild(townId,nativeId,{inflight:{building,targetLevel:check.plan.targetLevel,at:Date.now()},manualReview:false,status:'sending',reason:`enviando ${nativeBuildLabel(building)}`})){resolve('replan');return}
      const nativeFail=(status,reason,manualReview)=>{if(!nativeId)return;const cur=nativeQueueList(townId,'build',false).find(j=>j&&j.id===nativeId),reconcile=manualReview&&cur&&cur.inflight?Object.assign({},cur.inflight):null;nativeQueueMarkBuild(townId,nativeId,{inflight:null,reconcile,manualReview:!!manualReview,status,reason})};
      const buildAction=check.plan.mode==='teardown'?'tearDown':'buildUp';
      bridgePost('build', {
        model_url: 'BuildingOrder', action_name: buildAction, arguments: { building_id: building }, town_id: +townId,
      }, (err) => {
        if (err === 'captcha' || err === 'captcha-pause') { if(provisionalStrip)cdRollbackProvisionalStrip(townId,stripStateRef);nativeFail('waiting','pausado por captcha',false);resolve('captcha'); return; }
        if (err === 'timeout_unknown' || err === 'pending') { if(provisionalStrip)cdPersistTownGoal(townId);nativeFail('unknown','resultado desconocido; comprobar la cola real',true);gbLog(`auto-queue: ${building} @${townId} outcome unknown/pending \u2014 no retry`); resolve('unknown'); return; }
        if (err) { if(provisionalStrip)cdRollbackProvisionalStrip(townId,stripStateRef);nativeFail('blocked',String(err),false);gbLog(`auto-queue: ${building} @${townId} fail: ${err}`); resolve('err'); return; }
        if(provisionalStrip)cdPersistTownGoal(townId);
        const waits=[0,200,600,1400,2800];let i=0;
        const confirmModel=()=>{const levels=abCurrentLevels(townId);const reached=levels&&(check.plan.mode==='teardown'?+(levels[building]||0)<=+check.plan.targetLevel:+(levels[building]||0)>=+check.plan.targetLevel);if(reached){gbLog(`auto-queue: ${AB_LABELS[building] || building} ${check.plan.mode==='teardown'?'-1':'+1'} in town ${townId}${check.plan.forTarget !== building ? ` (prereq for ${check.plan.forTarget})` : ''}`);resolve('ok');return}
          if(i>=waits.length){if(nativeId)nativeQueueMarkBuild(townId,nativeId,{inflight:{building,targetLevel:check.plan.targetLevel,at:Date.now(),accepted:true},manualReview:false,status:'accepted',reason:'aceptado; esperando actualizaci\u00f3n del juego'});gbLog(`auto-queue: ${building} @${townId} accepted; waiting for model update`);resolve('accepted');return}gbTimeout(confirmModel,waits[i++])};confirmModel();
      });
    });
  }
  function abTownIds() {
    // Merge every authoritative/readable town source instead of choosing one.
    // MM Town can be temporarily unready while ITowns already contains the live
    // town models; City Designer must not wake the build lane and then report
    // "no towns" during that startup window.
    const ids=[];
    const add=id=>{const s=String(id==null?'':id);if(s&&!ids.includes(s))ids.push(s)};
    const fromGame=townsFromGame();
    if(fromGame&&fromGame.length)fromGame.forEach(t=>t&&t.id!=null&&add(t.id));
    try{Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{}).forEach(add)}catch(_){}
    try{(state.towns||[]).forEach(t=>t&&t.id!=null&&add(t.id))}catch(_){}
    for(const id of Object.keys(nativeQueueRoot().towns))add(id);
    return ids;
  }
  function abPlannerBlockedInfo(townId,levels){
    if(!levels)return null;const targets=goalEffectiveBuildTargets(townId);
    for(const target of goalBuildOrder(townId,Object.keys(targets||{}))){const max=abMaxLevel(target);if(max==null)continue;const want=Math.min(+targets[target]||0,max),have=target==='wall'?abWallEffectiveLevel(townId,+(levels.wall||0)):+(levels[target]||0);if(want<=0||have>=want)continue;const resolved=abResolvePrerequisite(townId,target,levels);if(!resolved||!resolved.building)return {building:target,fromLevel:have,toLevel:Math.min(max,have+1),detail:abReasonText(resolved&&resolved.error||'requisito desconocido')};const b=resolved.building,from=+(levels[b]||0),aff=abCanAfford(townId,b);if(!aff.ok)return {building:b,fromLevel:from,toLevel:from+1,detail:abAffordReason(aff)||abReasonText(aff.why)};return {building:b,fromLevel:from,toLevel:from+1,detail:'listo; esperando turno del scheduler'}}
    return null;
  }
  let abBlockedLogSig = '';
  let abBlockedLogAt = 0;
  function abScan(reason) {
    const nativePending=nativeQueueHasPending('build'), cdPending=cityDesignerHasExecutableWork('build');
    // Only the build captcha breaker gates auto-queue. Instant-build/research
    // have their own scan + breaker; coupling them (v6.0.30) stopped construction
    // whenever free-instant tripped captcha.
    if(!hostEnabled()||(!state.abAuto&&!nativePending&&!cdPending&&reason!=='manual')||captchaPaused('build')||circuitOpen('build'))return;
    if(automationPaused({}))return;
    const ids=abTownIds();
    if(!ids.length){gbLogT('ab-notowns',120000,'auto-queue: no towns');return}
    let townIndex=0,done=0,captcha=false,operations=0;
    const blocked=[];
    const noteBlocked=(townId,why)=>{
      const list=nativeQueueList(townId,'build',false);
      const head=list.find(j=>j&&!j.manualReview)||list.find(Boolean);
      const townName=townNameById(townId),townLabel=townName===String(townId)?String(townId):`${townName} [${townId}]`;
      if(head){if(blocked.some(x=>x.townId===String(townId)))return;const detail=String(why||head.reason||head.status||'sin acción ejecutable'),stableDetail=/^waiting-(?:resources|population)$/.test(head.status||'')?detail.replace(/\d+(?:[.,]\d+)?/g,'#'):detail;blocked.push({townId:String(townId),sig:[townId,head.id,head.status,stableDetail].join('|'),text:`ciudad ${townLabel} · ${nativeBuildLabel(head.building)} ${head.fromLevel}→${head.toLevel} · ${detail}`});return}
      if(blocked.some(x=>x.townId===String(townId))||!nativeQueuePlannerOwnsTown(townId))return;const info=abPlannerBlockedInfo(townId,abCurrentLevels(townId));if(!info)return;const detail=String(why||info.detail||'sin acción ejecutable'),stableDetail=detail.replace(/\d+(?:[.,]\d+)?/g,'#');blocked.push({townId:String(townId),sig:[townId,'planner',info.building,stableDetail].join('|'),text:`ciudad ${townLabel} · ${nativeBuildLabel(info.building)} ${info.fromLevel}→${info.toLevel} · ${detail}`});
    };
    const maxOps=Math.max(1,ids.length*7);
    const finish=()=>{
      if(done)flash(`auto-queue x${done}`);
      const prefix=`auto-queue${reason?' ('+reason+')':''}: ${done} queued`;
      if(done){abBlockedLogSig='';abBlockedLogAt=0;gbLogT('ab-finish-ok',30000,prefix)}
      else if(blocked.length){
        const sig=blocked.map(x=>x.sig).join('||'),now=Date.now(),quietRepeat=reason==='native-watch'||reason==='orch';
        if(!quietRepeat||sig!==abBlockedLogSig||now-abBlockedLogAt>=300000){
          abBlockedLogSig=sig;abBlockedLogAt=now;
          const shown=blocked.slice(0,3).map(x=>x.text).join('; ');
          gbLog(`${prefix} — ${shown}${blocked.length>3?`; +${blocked.length-3} más`:''}`);
        }
      }else gbLogT('ab-finish',30000,prefix);
      renderAbQueue();
      if (state.ibAuto) gbTimeout(ibScan, 1500);
    };
    const nextTown=()=>{townIndex++;gbTimeout(step,150)};
    const step=()=>{
      if(!gbInstanceAlive()||captcha||operations>=maxOps||townIndex>=ids.length)return finish();
      const id=ids[townIndex];
      try { abScriptTick(id); } catch (_) {}
      nativeQueueReconcileBuild(id);
      const list=nativeQueueList(id,'build',false);
      const first=list.find(Boolean);
      if(!first&&!state.abAuto&&!cdIsProfile(goalTownCfg(id).profile))return nextTown();
      if(first&&nativeQueuePaused(id,'build')){nativeQueueSetJobState(first,'paused','cola pausada');noteBlocked(id,'cola pausada');return nextTown()}
      const active=list.find(j=>j&&j.inflight);
      if(active){noteBlocked(id,active.reason||'envío en curso');return nextTown()}
      const q=abQueueInfo(id);
      if(!q.known){if(first)nativeQueueSetJobState(first,'blocked','cola real ilegible');noteBlocked(id,'cola real ilegible');return nextTown()}
      if(q.len>=q.max){const why=`cola real llena (${q.len}/${q.max})`;if(first)nativeQueueSetJobState(first,'waiting-queue',why);noteBlocked(id,why);return nextTown()}
      const levels=abCurrentLevels(id);
      if(!levels){if(first)nativeQueueSetJobState(first,'blocked','niveles ilegibles');noteBlocked(id,'niveles ilegibles');return nextTown()}
      const plan=abPickNextFromLevels(id,levels);
      if(!plan){noteBlocked(id);return nextTown()}
      const lockName=`build:${String(id)}`,lockToken=gbLock(lockName,120000);
      if(!lockToken)return nextTown();
      operations++;
      let opSettled=false;
      const release=()=>gbUnlock(lockName,lockToken);
      const markOperationUnknown=why=>{
        if(!plan.nativeJobId)return;
        const cur=nativeQueueList(id,'build',false).find(j=>j&&j.id===plan.nativeJobId);
        if(cur&&cur.inflight)nativeQueueMarkBuild(id,plan.nativeJobId,{inflight:null,reconcile:Object.assign({},cur.inflight),manualReview:true,status:'unknown',reason:why});
      };
      const watchdog=gbTimeout(()=>{
        if(opSettled||!gbInstanceAlive())return;
        opSettled=true;markOperationUnknown('operación sin respuesta; comprobar la cola real');release();
        noteBlocked(id,'operación sin respuesta; comprobar la cola real');
        gbLogT('ab-operation-watchdog-'+id,60000,`auto-queue: watchdog @${id}; moving on without retry`);nextTown();
      }, AB_OP_WATCHDOG_MS);
      const handleResult=res=>{
        if(opSettled||!gbInstanceAlive())return;
        opSettled=true;gbClearTimeout(watchdog);release();
        if(res==='ok'){done++;abRandomPickClear(id,plan);nativeQueueBuildApplied(id,plan);gbTimeout(step,AB_SEND_SPACING_MS+Math.random()*350);return}
        if(res==='accepted'){done++;return nextTown()}
        if(res==='captcha'){noteBlocked(id,'pausado por captcha');captcha=true;return finish()}
        const cur=plan.nativeJobId?nativeQueueList(id,'build',false).find(j=>j&&j.id===plan.nativeJobId):null;
        noteBlocked(id,cur&&cur.reason||res);nextTown();
      };
      const handleError=err=>{
        if(opSettled||!gbInstanceAlive())return;
        opSettled=true;gbClearTimeout(watchdog);markOperationUnknown('error inesperado; comprobar la cola real');release();
        noteBlocked(id,'error inesperado; comprobar la cola real');gbLogT('ab-operation-error-'+id,60000,`auto-queue: unexpected error @${id}: ${String(err)}`);nextTown();
      };
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

    const order = abEnsureOrder();
    gbPaint(box, stage => {
    const head = document.createElement('div');
    head.style.cssText = 'display:grid;grid-template-columns:1.2fr .5fr .5fr .5fr auto;gap:4px;font-size:9px;color:#888;margin-bottom:2px';
    ['building', 'cur', 'tgt', 'max', ''].forEach(t => {
      const s = document.createElement('span'); s.textContent = t; head.appendChild(s);
    });
    stage.appendChild(head);
    order.forEach(b => {
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
      const mkBtn = (txt, fn) => gbButton(txt, {
        style: 'background:#333;border:1px solid #555;color:#eee;padding:0 4px;cursor:pointer;font-size:10px',
        onClick: fn,
      });
      btns.appendChild(mkBtn('\u2191', () => { abMoveOrder(b, -1); renderAbQueue(); }));
      btns.appendChild(mkBtn('\u2193', () => { abMoveOrder(b, +1); renderAbQueue(); }));
      btns.appendChild(mkBtn('-', () => { abSetTarget(b, (state.abTargets[b] || 0) - 1); renderAbQueue(); }));
      btns.appendChild(mkBtn('+', () => { abSetTarget(b, (state.abTargets[b] || 0) + 1); renderAbQueue(); }));
      if (max != null) btns.appendChild(mkBtn('max', () => { abSetTarget(b, max); renderAbQueue(); }));
      row.appendChild(name);
      row.appendChild(cur);
      row.appendChild(tgtEl);
      row.appendChild(maxEl);
      row.appendChild(btns);
      stage.appendChild(row);
    });
    }, { key: String(townId || '') + '|' + order.join(',') });
    if (status) {
      const q = townId ? abQueueInfo(townId) : null;
      const next = townId && q && q.len < q.max ? abPickNext(townId) : null;
      status.textContent = (gbLockList().some(k=>String(k).startsWith('build:')) ? 'queueing... ' : '')
        + (townId ? `town ${townId}` : 'no town')
        + (q ? ` \u00b7 queue ${q.len}/${q.max}` : '')
        + (next ? ` \u00b7 next: ${AB_LABELS[next.building] || next.building}${next.forTarget !== next.building ? '\u2192' + (AB_LABELS[next.forTarget] || next.forTarget) : ''}` : ' \u00b7 idle')
        + (state.abAuto ? ' \u00b7 AUTO' : ' \u00b7 off');
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
    if (changed) { saveSoon(STORE.ALERTED, state.alerted); renderFarmsSoon(); }
  }

  const CHECK_THRESHOLDS_SOON_MS = 200;
  let _checkThreshT = 0;
  function checkThresholdsSoon() {
    if (_checkThreshT) return;
    _checkThreshT = gbTimeout(() => { _checkThreshT = 0; try { checkThresholds(); } catch (_) {} }, CHECK_THRESHOLDS_SOON_MS);
  }
