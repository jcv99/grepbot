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
  // ===== Wall auto-repair (v4 plan 4.5) ======================================
  // A damaged wall keeps its LEVEL - only a separate damage attribute moves -
  // so the build picker sees want === current and does nothing while the wall
  // sits at 0% integrity. The fix is to hand the picker an EFFECTIVE level.
  //
  // The damage attribute name is NOT known for this client. These are probe
  // candidates, not assumptions: every one missing is the expected outcome,
  // the reader returns null, and no offset is applied. A fabricated damage
  // number would queue wall levels the town does not owe.
  //
  // Checked against the captured client bundle (archive/captures/grepo-dump):
  // the only `*damage*` identifiers in it are battle-report unit counts
  // (amount_damaged, units_damaged, world_wonder_damaged) - no wall damage
  // attribute exists there at all, which is why Preflight now says so instead
  // of implying a capture is pending.
  const WALL_DAMAGE_FNS = ['getWallDamage', 'getDamagePercentForBuilding', 'getDamagePercentage', 'getWallDamagePercent'];
  const WALL_DAMAGE_ATTRS = ['wall_damage', 'wallDamage', 'damage_percent', 'wall_damage_percent'];
  function abWallDamage(townId) {
    // Wrapped like every other read in this file: abCurrentLevels feeds the
    // planner, the renderer and tx state, and a throwing model proxy must not
    // take all three down.
    try {
      const t = gbTownModel(townId);
      if (!t) return null;
      let v = gbProbeNum(t, WALL_DAMAGE_FNS, ['wall']);
      if (v == null) v = gbProbeNum(t, WALL_DAMAGE_FNS);
      if (v == null) v = gbProbeAttr(t, WALL_DAMAGE_ATTRS);
      // Only a percentage in range is believable. Anything else is unreadable.
      return (Number.isFinite(v) && v >= 0 && v <= 100) ? v : null;
    } catch (_) { return null; }
  }
  // Whole levels only: the picker compares integers and emits one buildUp per
  // missing level, so a fractional offset would either round away real damage
  // or queue a level that does not exist.
  //
  // DELIBERATELY NOT applied inside abCurrentLevels. Damage is not level, and
  // that map feeds the planner, the queue renderer, goalProgress, the optimal
  // order and tx state - deflating wall there made every one of them report a
  // level the town does not actually have. The offset lives in the ONE
  // comparison that needs it, in abPickNextFromLevels and abFinalValidate.
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
      // Use != null not || : an MM collection is a model dict, but a `0` or
      // `''` town key (renamed client, corrupt snapshot) would otherwise
      // silently fall through to a stale entry indexed by the string form.
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

    if (need.popBlind) {
      gbLogT('ab-pop-blind-' + building, 900000, `build: population cost for ${building} unreadable - population check is blind, server decides`);
    }
    // Population is compared against THIS building's own population cost, not
    // against zero: a level that needs 22 free population is blocked at 21 just
    // as hard as at 0. `popShort` rides along on EVERY negative verdict because
    // the resources branch returns first — a town short on both would otherwise
    // hide the population shortfall from the pop rescue until the wood arrives.
    const popShort = need.pop > 0 && pop < need.pop;
    if (have.wood < need.wood + margin || have.stone < need.stone + margin || have.iron < need.iron + margin) return { ok: false, why: 'resources', need, have, margin, popShort };
    if (popShort) return { ok: false, why: 'population', need, have, margin, popShort };
    return { ok: true, need, popShort: false };
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

      // Wall only: a damaged wall keeps its level, so compare the effective one
      // or the gap is invisible. Every other building compares raw.
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

        // Resources: try the next priority target so a free slot is not wasted.
        // Population: there is no useful next target — free population is town
        // wide, so a cost the town cannot cover here will not be covered by the
        // next building either. Put farm levels at the head of the lane instead
        // and let the follow-up scan take them.
        if (aff.popShort && resolved.building !== 'farm' && nativePopRescueFifo(townId, levels, aff)) return null;
        continue;
      }
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
    // The random fallback only ever runs when abPickNextFromLevels returned
    // null, so re-picking here would ALWAYS answer 'no-valid-build' and the
    // feature could never post. An explicit pick is re-validated below instead
    // -- max level, prerequisites, affordability, dedup and the queue gates all
    // still run against the live model; only the goal re-pick is skipped.
    const fresh = (plan && plan.randomFallback) ? plan : abPickNextFromLevels(townId, levels);
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
    if (!aff.ok) {
      // Last gate before the post, so this catches the population that a
      // recruit order ate between the pick and here. Idempotent: the rescue
      // re-counts what is already queued and adds nothing when the farm levels
      // are already in front. Nothing is posted on this path either way.
      if (aff.popShort && fresh.building !== 'farm') nativePopRescueFifo(townId, levels, aff);
      return { ok: false, why: aff.why, detail:abAffordReason(aff) };
    }
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
  // ===== Random fallback (v5.9.8) ============================================
  // Fires when the real build queue is empty AND the native virtual queue is
  // empty AND the goal planner picked nothing. Picks ONE building from the
  // pool (AB_BUILDINGS minus NATIVE_SPECIAL_GROUPS — specials stay user-driven)
  // that is buildable now (deps met, not maxed) AND affordable now
  // (resources + population pass). One per scan — the next orchestrator tick
  // can re-pick so the queue stays empty until the user acts.
  // One operation gets this long to settle before the scan gives up on the town
  // and moves on. Never a retry: the post may have landed.
  const AB_OP_WATCHDOG_MS = 90000;
  const AB_RANDOM_DENY = new Set(NATIVE_SPECIAL_GROUPS.reduce((a, g) => a.concat(g), []));
  function abRandomPool() {
    return AB_BUILDINGS.filter(b => !AB_RANDOM_DENY.has(b));
  }
  function abRandomShuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }
  function abRandomPick(townId, levels) {
    if (!levels) return null;
    const pool = abRandomShuffle(abRandomPool());
    for (const candidate of pool) {
      const max = abMaxLevel(candidate);
      if (max == null) { gbLogT('ab-rmax-' + candidate, 300000, `random-fallback: max level unreadable for ${candidate} — skip`); continue; }
      const have = +(levels[candidate] || 0);
      if (have >= max) continue;
      if (goalQueueSuppressed(townId, 'build', candidate)) continue;
      const resolved = abResolvePrerequisite(townId, candidate, levels);
      if (!resolved || !resolved.building) continue;
      const aff = abCanAfford(townId, resolved.building);
      if (!aff.ok) continue;
      return { building: resolved.building, forTarget: candidate, reason: 'random-fallback', cost: aff.need, randomFallback: true };
    }
    return null;
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

      // Live resource totals change constantly; keep them in the visible text but
      // remove the digits from the deduplication key.
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
      if (!gbLockTouch('ab', lockToken)) return;
      const id = ids[townIndex];

      // Reconcile accepted/unknown work against the real model before deciding
      // that the head must remain frozen for manual review.
      nativeQueueReconcileBuild(id);
      // Script CS: refresca las metas por ciudad antes del pick. Idempotente:
      // solo escribe cuando la fase cambia.
      abScriptTick(id);
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
      if (!plan) {
        // Random fallback: when the planner has no goal target AND the real
        // queue is empty AND the native virtual queue is empty, pick ONE
        // random buildable + affordable building. Mirrors the lifecycle of
        // a planner-driven post so the journal / lock / reconcile flow stays
        // identical. The post itself goes through the same bridgePost('build')
        // path as a normal upgrade.
        const nativeEmpty = nativeQueueList(id, 'build', false).length === 0;
        if (state.abRandomFallback && q.len === 0 && nativeEmpty) {
          const picked = abRandomPick(id, levels);
          if (picked) {
            operations++;
            let opSettled = false;
            // No nativeJobId on a random pick, so there is no lane head to mark
            // and nothing for the reconciler to pick up: the outcome is logged
            // and journaled instead. noteBlocked is deliberately NOT used on
            // this path -- it early-returns when the lane is empty, which it
            // always is here, so every failure would have been silent.
            const randomBlocked = why => { gbLogT('ab-random-' + id, 60000, `auto-queue: random-fallback ${picked.building} @${id}: ${why}`); };
            const watchdog = gbTimeout(() => {
              if (opSettled || !gbInstanceAlive()) return; opSettled = true;
              randomBlocked('sin respuesta; comprobar la cola real'); nextTown();
            }, AB_OP_WATCHDOG_MS);
            const handleResult = res => {
              if (opSettled || !gbInstanceAlive()) return; opSettled = true; gbClearTimeout(watchdog);
              if (res === 'ok') { done++; gbLog(`auto-queue: random-fallback ${AB_LABELS[picked.building] || picked.building} +1 @${townNameById(id) || id}`); return nextTown(); }
              if (res === 'accepted') { done++; return nextTown(); }
              if (res === 'captcha') { randomBlocked('pausado por captcha'); captcha = true; return finish(); }
              randomBlocked(String(res || 'sin exito'));
              nextTown();
            };
            const handleError = err => { if (opSettled || !gbInstanceAlive()) return; opSettled = true; gbClearTimeout(watchdog); randomBlocked('error inesperado: ' + String(err)); nextTown(); };
            try { Promise.resolve(abBuildUp(id, picked)).then(handleResult, handleError); } catch (err) { handleError(err); }
            return;
          }
        }
        noteBlocked(id); return nextTown();
      }
      operations++;
      let opSettled=false;
      const markOperationUnknown=why=>{if(!plan.nativeJobId)return;const head=nativeQueueList(id,'build',false)[0];if(head&&head.id===plan.nativeJobId&&head.inflight)nativeQueueMarkBuild(id,plan.nativeJobId,{inflight:null,reconcile:Object.assign({},head.inflight),manualReview:true,status:'unknown',reason:why})};
      const watchdog=gbTimeout(()=>{if(opSettled||!gbInstanceAlive())return;opSettled=true;const why='operación sin respuesta; comprobar la cola real';markOperationUnknown(why);noteBlocked(id,why);gbLogT('ab-operation-watchdog-'+id,60000,`auto-queue: watchdog @${id}; moving on without retry`);nextTown()},AB_OP_WATCHDOG_MS);
      const handleResult=res=>{
        if(opSettled||!gbInstanceAlive())return;opSettled=true;gbClearTimeout(watchdog);
        if (res === 'ok') {
          done++;
          nativeQueueBuildApplied(id,plan);

          // Re-read the real queue before every next order; no multi-level cost projection.
          gbTimeout(step, AB_SEND_SPACING_MS + Math.random() * 350);
          return;
        }
        if(res==='accepted'){done++;return nextTown()}
        if (res === 'captcha') { noteBlocked(id,'pausado por captcha'); captcha = true; return finish(); }

        // unknown/pending/replan/error: do not hammer the same town; move on and let next scan reconcile.
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

    // Painted, not rebuilt: nativeQueueSave() calls this on every queue
    // mutation, and a wholesale rebuild threw away whatever target the player
    // was typing into one of these number inputs. gbPaint leaves the focused
    // control alone and the row order is the key, so ↑/↓ still rebuilds.
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
      stage.appendChild(row);
    });
    }, { key: String(townId || '') + '|' + order.join(',') });
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
    if (changed) { saveSoon(STORE.ALERTED, state.alerted); renderFarmsSoon(); }
  }
  // The village sweep called checkThresholds() once per village: a full walk of
  // farmsParsed per village, i.e. O(N^2) flashes' worth of work per cycle for a
  // result that only depends on the finished state. One pass at the end is the
  // same answer. Kept separate from the bare form, which the 12s boot interval
  // and manual paths still use.
  const CHECK_THRESHOLDS_SOON_MS = 200;
  let _checkThreshT = 0;
  function checkThresholdsSoon() {
    if (_checkThreshT) return;
    _checkThreshT = gbTimeout(() => { _checkThreshT = 0; try { checkThresholds(); } catch (_) {} }, CHECK_THRESHOLDS_SOON_MS);
  }
  const CAVE_MIN_STORE = 100;
