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
    return 2; // conservative base-game queue only
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
      if (!aff.ok) continue; // try next priority target so a free slot is not wasted unnecessarily
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
      gbLockTouch('ab', lockToken);
      const id = ids[townIndex];
      // Reconcile accepted/unknown work against the real model before deciding
      // that the head must remain frozen for manual review.
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
