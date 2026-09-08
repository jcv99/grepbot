  const NATIVE_QUEUE_LANES=['build','recruit','recruitNaval','research'];
  const NATIVE_RECRUIT_LANES=['recruit','recruitNaval'];
  // Delegates to recruitIsNaval: NAVAL_MYTHICAL_UNITS (hydra) is naval even
  // when GameData lacks is_naval, or the docks lane never gets its FIFO head.
  function nativeUnitIsNaval(unit){return recruitIsNaval(unit)}
  function nativeRecruitLane(unit){return nativeUnitIsNaval(unit)?'recruitNaval':'recruit'}

  function nativeRecruitLaneOf(townId,unit) {
    for(const lane of NATIVE_RECRUIT_LANES)if(nativeQueueList(townId,lane,false).some(j=>j&&j.unit===unit))return lane;
    return nativeRecruitLane(unit);
  }
  function nativeQueueRoot() {
    let q=state.nativeQueue;
    if(!q||typeof q!=='object'||Array.isArray(q))q=state.nativeQueue={version:1,seq:0,towns:{}};
    if(!q.towns||typeof q.towns!=='object'||Array.isArray(q.towns))q.towns={};
    q.version=1;q.seq=Math.max(0,+q.seq||0);
    if(!nativeQueueInflightRestored){nativeQueueInflightRestored=true;let changed=false;for(const town of Object.values(q.towns))for(const lane of NATIVE_QUEUE_LANES)for(const job of ((town&&Array.isArray(town[lane]))?town[lane]:[])){if(job&&job.inflight){if(lane==='build')job.reconcile=Object.assign({},job.inflight);job.inflight=null;job.manualReview=true;job.status='unknown';job.reason='acci\u00f3n en curso al recargar; comprobando la cola real';job.updatedAt=Date.now();changed=true}}if(changed&&gbTabLeader)save(STORE.NATIVE_QUEUE,q)}
    return q;
  }
  function nativeQueueTown(townId,create) {
    const q=nativeQueueRoot(),id=String(townId==null?'':townId);if(!id)return null;
    let t=q.towns[id];
    if((!t||typeof t!=='object'||Array.isArray(t))&&create!==false)t=q.towns[id]={build:[],recruit:[],recruitNaval:[],research:[],paused:{build:false,recruit:false,recruitNaval:false,research:false},mode:{build:'legacy',recruit:'legacy',recruitNaval:'legacy',research:'legacy'}};
    if(!t)return null;
    for(const lane of NATIVE_QUEUE_LANES)if(!Array.isArray(t[lane]))t[lane]=[];
    if(!t.paused||typeof t.paused!=='object'||Array.isArray(t.paused))t.paused={};
    if(!t.mode||typeof t.mode!=='object'||Array.isArray(t.mode))t.mode={};
    for(const lane of NATIVE_QUEUE_LANES){t.paused[lane]=!!t.paused[lane];if(!['legacy','fifo'].includes(t.mode[lane]))t.mode[lane]='legacy'}
    nativeRecruitSplitTown(t,id);
    return t;
  }

  const nativeRecruitSplitDone=new Set();
  function nativeRecruitSplitTown(t,id) {
    if(nativeRecruitSplitDone.has(id))return;
    const land=t.recruit,naval=t.recruitNaval;let moved=0,blind=false;

    const navalWasEmpty=naval.length===0;
    for(let i=land.length-1;i>=0;i--){
      const j=land[i];if(!j)continue;
      const d=gbGameDataLookup("units", j.unit);
      if(!d){blind=true;continue}
      if(d.is_naval||d.naval){land.splice(i,1);naval.unshift(j);moved++}
    }
    if(!blind)nativeRecruitSplitDone.add(id);
    if(moved){

      if (navalWasEmpty) { t.mode.recruitNaval = t.mode.recruit; t.paused.recruitNaval = !!t.paused.recruit; }

      try{if(gbTabLeader)save(STORE.NATIVE_QUEUE,nativeQueueRoot())}catch(_){}
      gbLog(`cola nativa: ${moved} orden(es) naval(es) movida(s) a la cola del puerto @${id}`);
    }
  }
  function nativeQueueList(townId,lane,create){const t=nativeQueueTown(townId,create);return t&&Array.isArray(t[lane])?t[lane]:[];}
  function nativeQueueLaneMeta(townId, lane) {
    const list = nativeQueueList(townId, lane, false);
    return { list, fifo: nativeQueueIsFifo(townId, lane), paused: nativeQueuePaused(townId, lane), frozen: list.some(j => j && j.inflight) };
  }

  // Any non-custom goal profile is planner-owned. Manual FIFO is deliberately
  // available only in Personalizado. Switching to a planner profile discards
  // unsent FIFO work so stale manual orders cannot override the planner.
  // Ambiguous/in-flight tombstones are retained only for reconciliation safety.
  function nativeQueuePlannerOwnsTown(townId){return String((goalTownCfg(townId)||{}).profile||'custom')!=='custom'}
  function nativeQueueManualAllowed(townId){return !nativeQueuePlannerOwnsTown(townId)}
  function nativeQueuePlannerTombstone(job){return !!(job&&(job.inflight||job.reconcile||job.manualReview||['unknown','sending','accepted'].includes(String(job.status||''))))}
  function nativeQueuePlannerLaneBlocked(townId,lane){return nativeQueueList(townId,lane,false).some(nativeQueuePlannerTombstone)}
  function nativeQueueClearForPlanner(townId,reason,silent){
    if(!nativeQueuePlannerOwnsTown(townId))return false;const t=nativeQueueTown(townId,true);let changed=false,removed=0,kept=0;
    for(const lane of NATIVE_QUEUE_LANES){const before=t[lane].length,keep=t[lane].filter(nativeQueuePlannerTombstone);removed+=before-keep.length;kept+=keep.length;if(keep.length!==before){t[lane]=keep;changed=true}if(t.mode[lane]!=='legacy'){t.mode[lane]='legacy';changed=true}if(t.paused[lane]){t.paused[lane]=false;changed=true}}
    if(changed){nativeQueueSave();if(!silent)gbLog(`City Planner @${townId}: FIFO limpiada (${removed} orden(es) descartadas${kept?`, ${kept} resultado(s) ambiguo(s) conservado(s) para reconciliar`:''})${reason?' · '+reason:''}`)}
    return changed;
  }
  function nativeQueueRejectManualWhenPlanner(townId){if(nativeQueueManualAllowed(townId))return false;flash('La cola FIFO solo está disponible en Personalizado');gbLogT('native-fifo-planner-'+townId,60000,`cola FIFO @${townId}: ignorada porque el planificador de objetivos está activo; cambia a Personalizado para usar FIFO`);return true}

  let nativeQueueSaveTimer=0;
  function nativeQueueSaveNow() {
    if(nativeQueueSaveTimer){try{gbClearTimeout(nativeQueueSaveTimer)}catch(_){}nativeQueueSaveTimer=0}
    if(!gbTabLeader){gbLogT('native-queue-follower-save',60000,'native queue: follower save skipped');return false}
    return save(STORE.NATIVE_QUEUE,nativeQueueRoot());
  }
  function nativeQueueSaveSoon() {
    if(!gbTabLeader)return;
    if(nativeQueueSaveTimer)return;
    nativeQueueSaveTimer=gbTimeout(()=>{nativeQueueSaveTimer=0;try{nativeQueueSaveNow()}catch(_){}},250);
  }
  function nativeQueueSaveFlush(){if(nativeQueueSaveTimer)nativeQueueSaveNow()}
  function nativeQueueSave() {
    nativeQueueSaveNow();
    try{scheduleNativeUiScan()}catch(_){}
    try{renderAbQueue()}catch(_){}
    try{renderQueueCenter()}catch(_){}
  }
  function nativeQueueId(prefix){const q=nativeQueueRoot();q.seq++;return `${prefix}:${Date.now().toString(36)}:${q.seq.toString(36)}`;}
  function nativeQueueHasPending(lane,townId) {
    if(townId!=null)return nativeQueueList(townId,lane,false).length>0;
    const towns=nativeQueueRoot().towns;return Object.keys(towns).some(id=>nativeQueueList(id,lane,false).length>0);
  }

  function nativeRecruitPending(townId){return NATIVE_RECRUIT_LANES.some(l=>nativeQueueHasPending(l,townId));}
  function nativeQueuePaused(townId,lane){const t=nativeQueueTown(townId,false);return !!(t&&t.paused&&t.paused[lane]);}
  function nativeQueueIsFifo(townId,lane){const t=nativeQueueTown(townId,false);return !!(t&&t.mode&&t.mode[lane]==='fifo');}
  function nativeQueueUseLegacy(townId,lane){const t=nativeQueueTown(townId,true);if(t[lane].length)return false;t.mode[lane]='legacy';t.paused[lane]=false;nativeQueueSave();return true;}
  function nativeQueueTogglePaused(townId,lane){const t=nativeQueueTown(townId,true);t.paused[lane]=!t.paused[lane];nativeQueueSave();return t.paused[lane];}

  function nativeQueueReconcile(townId,lane) {
    if(lane==='build')return nativeQueueReconcileBuild(townId);
    if(lane==='research')return nativeQueueReconcileResearch(townId);
    return nativeQueueReconcileRecruit(townId,lane);
  }

  function nativeQueueReconcileTown(townId) {
    let changed=false;
    try{if(nativeQueueList(townId,'build',false).length&&nativeQueueReconcileBuild(townId))changed=true}catch(_){}
    try{if(nativeQueueList(townId,'research',false).length&&nativeQueueReconcileResearch(townId))changed=true}catch(_){}
    try{if(nativeRecruitPending(townId)&&nativeQueueReconcileRecruit(townId,null))changed=true}catch(_){}
    return changed;
  }
  let nativeQueueSweepAt=0;
  function nativeQueueSweep(reason) {
    if(!gbTabLeader)return 0;
    if(reason!=='manual'&&nativeQueueSweepAt&&Date.now()-nativeQueueSweepAt<5000)return 0;
    const towns=nativeQueueRoot().towns;let n=0;
    for(const id of Object.keys(towns))if(nativeQueueReconcileTown(id))n++;
    nativeQueueSweepAt=Date.now();
    if(n)gbLog(`native queue sweep (${reason||'loop'}): ${n} town(s) reconciled against the real queue`);
    return n;
  }
  function nativeQueueMove(townId,lane,jobId,delta) {
    nativeQueueReconcile(townId,lane);
    const list=nativeQueueList(townId,lane,false);if(list.some(j=>j&&j.inflight))return false;const i=list.findIndex(j=>j&&j.id===jobId);if(i<0)return false;
    const j=Math.max(0,Math.min(list.length-1,i+(+delta||0)));if(i===j)return false;
    const item=list.splice(i,1)[0];list.splice(j,0,item);if(lane==='build')nativeQueueRebaseBuild(townId);nativeQueueSave();return true;
  }
  function nativeQueueRemove(townId,lane,jobId,opts) {
    nativeQueueReconcile(townId,lane);
    const list=nativeQueueList(townId,lane,false),i=list.findIndex(j=>j&&j.id===jobId);if(i<0)return false;
    const target=list[i];const force=!(!opts||!opts.force);

    if(target.inflight)return false;
    if(!force&&list.some(j=>j&&j.inflight))return false;

    if(lane==='build'){
      const impact=nativeQueueRemovalImpact(townId,jobId);
      if(!impact.ok){
        const head=impact.blockers.slice(0,3).map(b=>`${nativeBuildLabel(b.building)} (necesita ${impact.target.building} ${b.requires}, sin esta entrada solo ${b.has})`).join('; ');
        const more=impact.blockers.length>3?` y ${impact.blockers.length-3} m\u00e1s`:'';
        flash(`Bloqueado: ${nativeBuildLabel(impact.target.building)} ${impact.target.toLevel} a\u00fan hace falta para ${head}${more}`);
        gbLog(`cola nativa: borrado bloqueado \u2014 ${impact.blockers.length} edificio(s) dependen de ${impact.target.building} ${impact.target.toLevel}: `+impact.blockers.map(b=>`${b.building}>=${b.requires}`).join(', '));
        return false;
      }
    }

    if(lane==='research'){
      const impact=nativeQueueResearchRemovalImpact(townId,jobId);
      if(!impact.ok){
        const head=impact.blockers.slice(0,3).map(t=>nativeResearchLabel(t)).join(', ');
        const more=impact.blockers.length>3?` y ${impact.blockers.length-3} m\u00e1s`:'';
        flash(`Bloqueado: ${nativeResearchLabel(impact.target)} es requisito de ${head}${more}`);
        gbLog(`cola nativa: borrado bloqueado \u2014 ${impact.blockers.length} investigaci\u00f3n(es) dependen de ${impact.target}: `+impact.blockers.join(', '));
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
    try{const d=gbGameDataLookup("units", unit);const n=d&&(d.name||d.name_plural||d.label);if(n)return String(n)}catch(_){}
    return String(unit||'?');
  }
  function nativeQueueProjectedBuildLevel(townId,building) {
    const levels=abCurrentLevels(townId);if(!levels||levels[building]==null)return null;
    let level=gbNum(levels[building]);
    if(level==null)return null;
    for(const j of nativeQueueList(townId,'build',false))if(j&&j.building===building){const tl=gbNum(j.toLevel);if(tl!=null)level=Math.max(level,tl)}
    return level;
  }
  function nativeSpecialConflict(townId,building) {
    const group=NATIVE_SPECIAL_GROUPS.find(g=>g.includes(building));if(!group)return null;const levels=abCurrentLevels(townId);if(!levels)return 'especiales ilegibles';{const lv=gbNum(levels[building]);if(lv!=null&&lv>0)return null}
    const other=group.find(id=>id!==building&&((()=>{const lv=gbNum(levels[id]);return lv!=null&&lv>0})()||nativeQueueList(townId,'build',false).some(j=>j&&j.building===id)));return other||null;
  }
  function nativeQueueRebaseBuild(townId) {
    const levels=abCurrentLevels(townId);if(!levels)return false;const next=Object.assign({},levels);
    for(const j of nativeQueueList(townId,'build',false)){if(!j||!AB_BUILDINGS.includes(j.building))continue;if(j.inflight){const cur=gbNum(next[j.building]);const tl=gbNum(j.toLevel);next[j.building]=Math.max(cur??0,tl??cur??0);continue}if(j.manualReview)continue;const from=gbNum(next[j.building]);if(from==null)return false;j.fromLevel=from;j.toLevel=from+1;next[j.building]=from+1}return true;
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
    const T = gbNum(target.toLevel);
    if (T == null) return { ok: true };
    const fold = (skipIdx) => {

      const sim = Object.assign({}, levels);
      for (let i = 0; i < list.length; i++) {
        if (i === skipIdx) continue;
        const j = list[i];
        if (!j || !AB_BUILDINGS.includes(j.building)) continue;
        if (j.inflight || j.manualReview) {
          const cur = gbNum(sim[j.building]);
          const tl = gbNum(j.toLevel);
          sim[j.building] = Math.max(cur ?? 0, tl ?? cur ?? 0);
          continue;
        }
        const cur = gbNum(sim[j.building]);
        if (cur == null) return { ok: true };
        sim[j.building] = cur + 1;
      }
      return sim;
    };
    const simWith = fold(-1);
    const simWithout = fold(idx);
    const withLvl = gbNum(simWith[B]);
    if (withLvl == null || withLvl < T) return { ok: true };

    const blockers = [], seenDep = new Set();
    for (let i = idx + 1; i < list.length; i++) {
      const j = list[i];
      if (!j || !AB_BUILDINGS.includes(j.building) || seenDep.has(j.building)) continue;
      const req = abRequirementMap(townId, j.building);
      if (!req) continue;
      const need = gbNum(req[B]);
      if (need == null || !need) continue;
      const withoutLvl = gbNum(simWithout[B]);
      if (withoutLvl == null) continue;
      if (need <= withoutLvl) continue;
      if (need > withLvl) continue;
      seenDep.add(j.building);
      blockers.push({ building: j.building, requires: need, has: withoutLvl });
    }
    if (!blockers.length) return { ok: true };
    return { ok: false, blockers, target: { building: B, toLevel: T, withLvl, withoutLvl: gbNum(simWithout[B]) ?? 0 } };
  }
  function nativeQueuePrereqWalk(townId, building) {

    const levels = abCurrentLevels(townId);
    if (!levels) return { chain: [], error: 'levels-unreadable' };
    const sim = Object.assign({}, levels);
    for (const j of nativeQueueList(townId, 'build', false)) {
      if (!j || j.toLevel == null) continue;
      const cur = gbNum(sim[j.building]);
      const tl = gbNum(j.toLevel);
      if (cur == null || tl == null) continue;
      sim[j.building] = Math.max(cur, tl);
    }
    const chain = [];
    let target = building;
    for (let safety = 0; safety < 50; safety++) {
      const resolved = abResolvePrerequisite(townId, target, sim);
      if (!resolved || !resolved.building) return { chain, error: resolved ? resolved.error : 'prereq-unknown' };
      if (resolved.building === target) return { chain };
      chain.push(resolved.building);
      sim[resolved.building] = (() => { const cur = gbNum(sim[resolved.building]); return cur != null ? cur + 1 : cur; })();
      if (sim[resolved.building] == null) return { chain, error: 'levels-unreadable' };
    }
    return { chain, error: 'chain-too-long' };
  }
  function nativeQueueAddBuild(townId,building) {
    if(nativeQueueRejectManualWhenPlanner(townId))return false;
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
      const cur = gbNum(sim[j.building]);
      const tl = gbNum(j.toLevel);
      if (cur == null || tl == null) continue;
      sim[j.building] = Math.max(cur, tl);
    }
    const max = abMaxLevel(building);
    if (max == null) { flash('No se puede leer el nivel m\u00e1ximo'); return false; }
    const from = gbNum(sim[building]);
    if (from == null) { flash('No se puede leer el nivel actual'); return false; }
    if (from >= max) { flash(`${nativeBuildLabel(building)} ya est\u00e1 al m\u00e1ximo`); return false; }
    const town = nativeQueueTown(townId, true); town.mode.build = 'fifo';

    let addedPrereqs = 0;
    for (const dep of walk.chain) {
      const dMax = abMaxLevel(dep);
      const dFrom = gbNum(sim[dep]);
      if (dMax == null || dFrom == null) continue;
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
      flash(`${addedPrereqs} requisito(s) a\u00f1adidos; el objetivo final no se puede resolver: ${abReasonText(walk.error)}`);
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
      ? `${nativeBuildLabel(building)} ${from}\u2192${from + 1} + ${addedPrereqs} requisito(s) [${walk.chain.map(b => nativeBuildLabel(b)).join(', ')}] @${townId}`
      : `${nativeBuildLabel(building)} ${from}\u2192${from + 1} @${townId}`;
    gbLog(`cola nativa: ${summary}`);
    gbTimeout(() => abScan('native'), 80); return true;
  }
  function nativeQueueFillToMax(townId, building) {
    if (!AB_BUILDINGS.includes(building)) return 0;
    const max = abMaxLevel(building);
    if (max == null) { flash('No se puede leer el nivel máximo'); return 0; }
    let projected = nativeQueueProjectedBuildLevel(townId, building);
    if (projected == null) { flash('No se puede leer el nivel actual'); return 0; }
    if (projected >= max) { flash(`${nativeBuildLabel(building)} ya está al máximo (${max})`); return 0; }
    let added = 0;
    while (projected < max) {
      const ok = nativeQueueAddBuild(townId, building);
      if (!ok) break;
      added++;
      const next = nativeQueueProjectedBuildLevel(townId, building);
      if (next == null || next <= projected) break;
      projected = next;
    }
    if (added) flash(`Encoladas ${added} mejoras de ${nativeBuildLabel(building)} hasta nivel ${projected}`);
    return added;
  }

  const POP_RESCUE_FARM_LEVELS = 2;
  function nativeFarmPendingLevels(townId) {
    const q = abQueueInfo(townId);
    if (!q || !q.known) return null;
    let n = 0;
    for (const o of (q.orders || [])) if (o && o.building_type === 'farm' && !o.tear_down) n++;
    for (const j of nativeQueueList(townId, 'build', false)) if (j && j.building === 'farm') n++;
    return n;
  }

  function nativePopRescueRoom(townId, levels) {
    if (!state.popRescueFarm) return 0;
    if (!levels) return 0;
    if (goalQueueSuppressed(townId, 'build', 'farm')) return 0;
    const max = abMaxLevel('farm');
    if (max == null) { gbLogT('pop-rescue-max', 300000, 'pop rescue: farm max level unreadable - no farm queued'); return 0; }
    const pending = nativeFarmPendingLevels(townId);
    if (pending == null) { gbLogT('pop-rescue-blind-' + townId, 300000, `pop rescue: real build queue unreadable @${townId} - not queueing farm blind`); return 0; }
    if (pending >= POP_RESCUE_FARM_LEVELS) return 0;

    const projected = gbNum(levels.farm);
    if (projected == null) {
      gbLogT('pop-rescue-blind-' + townId, 300000, `pop rescue: farm level unreadable @${townId} - not queueing farm blind`);
      return 0;
    }
    if (projected >= max) {
      gbLogT('pop-rescue-maxed-' + townId, 600000, `pop rescue: farm already at max (${max}) @${townId} - population cannot be raised by building`);
      return 0;
    }
    return Math.max(0, Math.min(POP_RESCUE_FARM_LEVELS - pending, max - projected));
  }

  function nativePopRescueFifo(townId, levels, aff) {
    const room = nativePopRescueRoom(townId, levels);
    if (!room) return 0;
    const list = nativeQueueList(townId, 'build', false);

    if (list.some(j => j && (j.inflight || (j.manualReview && j.building==='farm')))) return 0;
    const town = nativeQueueTown(townId, true);

    const short = aff && aff.need && aff.have
      ? `poblaci\u00f3n ${(() => { const h = gbNum(aff.have.population), n = gbNum(aff.need.pop); return h != null && n != null ? `${Math.floor(h)}/${Math.ceil(n)}` : '?/?'; })()}`
      : 'poblaci\u00f3n insuficiente';
    const jobs = [];
    for (let i = 0; i < room; i++) jobs.push({
      id: nativeQueueId('b'), kind: 'build', townId: String(townId),
      building: 'farm', fromLevel: 0, toLevel: 0,
      status: 'pending', reason: `${short}; granja antes de continuar`,
      createdAt: Date.now(),
    });
    town.build.unshift(...jobs);

    nativeQueueRebaseBuild(townId);
    nativeQueueSave();
    gbLog(`cola nativa: ${short} @${townId} \u2014 ${room} nivel(es) de granja al principio de la cola`);

    gbTimeout(() => abScan('pop-rescue'), 1500);
    return room;
  }
  function nativeQueueRemoveLastBuild(townId,building) {

    nativeQueueReconcileBuild(townId);
    const list=nativeQueueList(townId,'build',false);for(let i=list.length-1;i>=0;i--){const j=list[i];if(j&&j.building===building&&!j.inflight&&!j.manualReview){
      const impact=nativeQueueRemovalImpact(townId,j.id);
      if(!impact.ok){
        const head=impact.blockers.slice(0,3).map(b=>`${nativeBuildLabel(b.building)} (necesita ${impact.target.building} ${b.requires}, sin esta entrada solo ${b.has})`).join('; ');
        const more=impact.blockers.length>3?` y ${impact.blockers.length-3} m\u00e1s`:'';
        flash(`Bloqueado: ${nativeBuildLabel(impact.target.building)} ${impact.target.toLevel} a\u00fan hace falta para ${head}${more}`);
        gbLog(`cola nativa: borrado bloqueado \u2014 ${impact.blockers.length} edificio(s) dependen de ${impact.target.building} ${impact.target.toLevel}: `+impact.blockers.map(b=>`${b.building}>=${b.requires}`).join(', '));
        return false;
      }
      list.splice(i,1);nativeQueueRebaseBuild(townId);nativeQueueSave();return true}}
    return false;
  }
  const NATIVE_UNIT_STEPS = { sword:50, slinger:50, archer:50, hoplite:50, rider:30, chariot:30 };
  // Jobs above this amount become infinite chunk loops (storage + UI stay small).
  const NATIVE_RECRUIT_INF_THRESH = 1000;
  function nativeUnitStep(unit) {
    const stepped = NATIVE_UNIT_STEPS[String(unit || '')];
    if (stepped) return stepped;
    try{const d=gbGameDataLookup("units", unit);if(!d)return 1;const pop=gbNum(d.population),freight=gbNum(d.favor??(d.resources&&d.resources.favor));if(d.is_naval||d.naval||d.mythical||d.is_mythical||d.god||(pop!=null&&pop>=8)||(freight!=null&&freight>0)||pop==null&&freight==null)return 1}catch(_){}
    return 10;
  }

  function nativeQueueRecruitIsInfinite(job) {
    return !!(job && (job.infinite || +job.amount === -1));
  }
  function nativeQueueRecruitChunkOf(job, unit) {
    const cs = Math.max(0, Math.floor(+(job && job.chunkSize) || 0));
    if (cs > 0) return cs;
    return nativeUnitStep(unit || (job && job.unit));
  }
  function nativeQueueRecruitAmountText(job) {
    if (!job) return '\u2014';
    if (nativeQueueRecruitIsInfinite(job)) {
      return `\u221e\u00d7 ${nativeUnitLabel(job.unit)} (lotes de ${nativeQueueRecruitChunkOf(job)})`;
    }
    return `${Math.max(0, +job.amount || 0)}\u00d7 ${nativeUnitLabel(job.unit)}`;
  }
  // amount === -1 means "infinite pending" for tile/panel badges (JSON-safe).
  function nativeQueueRecruitAmount(townId,unit){
    let sum=0,inf=false;
    for(const lane of NATIVE_RECRUIT_LANES){
      for(const j of nativeQueueList(townId,lane,false)){
        if(!j||j.unit!==unit)continue;
        if(nativeQueueRecruitIsInfinite(j)){inf=true;continue}
        sum+=Math.max(0,+j.amount||0);
      }
    }
    return inf?-1:sum;
  }
  function nativeQueueRecruitPromoteInfinite(job, chunk) {
    if (!job) return false;
    const C = Math.max(1, Math.floor(+chunk || nativeQueueRecruitChunkOf(job) || 1));
    if (nativeQueueRecruitIsInfinite(job)) {
      if (!(+job.chunkSize > 0) || job.amount !== -1 || !job.infinite) {
        job.infinite = true;
        job.amount = -1;
        job.chunkSize = C;
        job.reason = `\u221e \u00b7 lotes de ${C}`;
        job.updatedAt = Date.now();
        return true;
      }
      return false;
    }
    const n = Math.floor(+job.amount || 0);
    if (!(n > NATIVE_RECRUIT_INF_THRESH)) return false;
    job.infinite = true;
    job.amount = -1;
    job.chunkSize = C;
    job.reason = `\u221e \u00b7 lotes de ${C}`;
    job.updatedAt = Date.now();
    return true;
  }
  function nativeQueueNormalizeRecruitLane(townId, lane) {
    const list = nativeQueueList(townId, lane || 'recruit', false);
    let changed = 0;
    for (const j of list) if (j && nativeQueueRecruitPromoteInfinite(j)) changed++;
    if (changed) {
      nativeQueueSave();
      try { scheduleNativeUiScan(); } catch (_) {}
      try { renderQueueCenter(); } catch (_) {}
      gbLog(`cola nativa: ${changed} entrada(s) >${NATIVE_RECRUIT_INF_THRESH} convertida(s) a \u221e en lotes @${townId}`);
    }
    return changed;
  }
  function nativeQueueAddRecruitInfinite(townId, unit, chunk) {
    if (nativeQueueRejectManualWhenPlanner(townId)) return { ok: false, why: 'FIFO solo disponible en Personalizado' };
    if (!unit || !gbGameDataLookup('units', unit)) return { ok: false, why: 'unidad desconocida' };
    const C = Math.max(1, Math.floor(+chunk || nativeUnitStep(unit) || 1));
    if (!(C > 0)) return { ok: false, why: 'lote debe ser > 0' };
    const lane = nativeRecruitLane(unit);
    const town = nativeQueueTown(townId, true);
    town.mode[lane] = 'fifo';
    const job = {
      id: nativeQueueId('u'), kind: 'recruit', townId: String(townId), unit: String(unit),
      amount: -1, infinite: true, chunkSize: C, status: 'pending',
      reason: `\u221e \u00b7 lotes de ${C}`, createdAt: Date.now(),
    };
    town[lane].push(job);
    nativeQueueSave();
    gbLog(`cola nativa (${lane === 'recruitNaval' ? 'puerto' : 'cuartel'}): \u221e\u00d7 ${nativeUnitLabel(unit)} en lotes de ${C} @${townId}`);
    gbTimeout(() => recruitScan('native'), 80);
    return { ok: true, lane, jobId: job.id, chunk: C, infinite: true };
  }
  function nativeQueueAddRecruit(townId,unit,amount,chunkSize) {
    if(nativeQueueRejectManualWhenPlanner(townId))return false;
    if(!unit||!gbGameDataLookup("units", unit))return false;
    // Explicit infinite: amount -1 / Infinity, or any total above the promote threshold.
    if (+amount === -1 || amount === Infinity || Math.floor(+amount || 0) > NATIVE_RECRUIT_INF_THRESH) {
      const r = nativeQueueAddRecruitInfinite(townId, unit, chunkSize || nativeUnitStep(unit));
      return !!(r && r.ok);
    }
    const n=Math.max(1,Math.floor(+amount||0));if(!(n>0))return false;

    const lane=nativeRecruitLane(unit);
    const town=nativeQueueTown(townId,true);

    town.mode[lane] = 'fifo';
    const job={id:nativeQueueId('u'),kind:'recruit',townId:String(townId),unit:String(unit),amount:n,status:'pending',reason:'',createdAt:Date.now()};

    const cs=Math.max(0,Math.floor(+chunkSize||0));
    if(cs>0&&cs<n)job.chunkSize=cs;
    town[lane].push(job);
    nativeQueueSave();
    const label=`cola nativa (${lane==='recruitNaval'?'puerto':'cuartel'}): ${n}\u00d7 ${nativeUnitLabel(unit)} @${townId}`;
    gbLog(job.chunkSize?`${label} en lotes de ${job.chunkSize}`:label);
    gbTimeout(()=>recruitScan('native'),80);return true;
  }
  function nativeQueueCompactRecruit(townId,lane) {
    lane=lane||'recruit';
    const list=nativeQueueList(townId,lane,false);
    if(list.length<2)return 0;
    let merged=0;
    for(let i=list.length-1;i>=1;i--){
      const cur=list[i-1],next=list[i];
      if(!cur||!next)continue;
      if(cur.unit!==next.unit)continue;
      if(cur.status!==next.status)continue;
      if(cur.inflight||next.inflight||cur.manualReview||next.manualReview)continue;
      const curInf=nativeQueueRecruitIsInfinite(cur),nextInf=nativeQueueRecruitIsInfinite(next);
      if(curInf||nextInf){
        const C=Math.max(nativeQueueRecruitChunkOf(cur),nativeQueueRecruitChunkOf(next));
        cur.infinite=true;cur.amount=-1;cur.chunkSize=C;
        cur.reason=`\u221e \u00b7 lotes de ${C}`;
      }else{
        cur.amount=Math.max(0,(+cur.amount||0))+(+next.amount||0);
        if(+cur.chunkSize>0||+next.chunkSize>0){
          const a=+cur.chunkSize||0,b=+next.chunkSize||0;
          cur.chunkSize=a&&b?Math.min(a,b):(a||b);
        }
        nativeQueueRecruitPromoteInfinite(cur);
      }
      cur.updatedAt=Date.now();
      list.splice(i,1);merged++;
    }
    if(merged){
      nativeQueueSave();
      try{scheduleNativeUiScan()}catch(_){}
      try{renderQueueCenter()}catch(_){}
      gbLog(`cola nativa (${lane==='recruitNaval'?'puerto':'cuartel'}): compactadas ${merged} entrada(s) adyacente(s) en @${townId}`);
    }
    return merged;
  }
  function nativeQueueAddRecruitBatch(townId,unit,total,chunk) {
    if(nativeQueueRejectManualWhenPlanner(townId))return {ok:false,why:'FIFO solo disponible en Personalizado'};
    const T=Math.floor(+total||0),C=Math.floor(+chunk||0);
    if(!unit||!gbGameDataLookup("units", unit))return {ok:false,why:'unidad desconocida'};
    if(!(C>0))return {ok:false,why:'lote debe ser > 0'};
    // total < 0 (UI sends -1) or over the threshold → infinite chunk loop.
    if(T<0||T>NATIVE_RECRUIT_INF_THRESH)return nativeQueueAddRecruitInfinite(townId,unit,C);
    if(!(T>0))return {ok:false,why:'total debe ser > 0'};
    if(C>T)return {ok:false,why:'lote no puede ser mayor que el total'};
    const lane=nativeRecruitLane(unit);
    const town=nativeQueueTown(townId,true);
    town.mode[lane]='fifo';
    const job={id:nativeQueueId('u'),kind:'recruit',townId:String(townId),unit:String(unit),amount:T,chunkSize:C,status:'pending',reason:`${Math.ceil(T/C)} \u00d7 ${C}`,createdAt:Date.now()};
    town[lane].push(job);
    nativeQueueSave();
    gbLog(`cola nativa (${lane==='recruitNaval'?'puerto':'cuartel'}): lote ${T}\u00d7 ${nativeUnitLabel(unit)} en ${Math.ceil(T/C)} env\u00edo(s) de ${C} @${townId}`);
    gbTimeout(()=>recruitScan('native'),80);
    return {ok:true,lane,jobId:job.id,total:T,lotes:Math.ceil(T/C),chunk:C};
  }
  function nativeQueueRemoveLastRecruit(townId,unit,amount) {
    const lane=nativeRecruitLaneOf(townId,unit);
    nativeQueueReconcileRecruit(townId,lane);
    const list=nativeQueueList(townId,lane,false);const step=Math.max(1,Math.floor(+amount||nativeUnitStep(unit)));for(let i=list.length-1;i>=0;i--){const job=list[i];if(job&&job.unit===unit&&!job.inflight&&!job.manualReview){if(nativeQueueRecruitIsInfinite(job)){list.splice(i,1);nativeQueueSave();return true}job.amount=Math.max(0,(+job.amount||0)-step);if(!job.amount)list.splice(i,1);else{job.status='pending';job.reason='';job.updatedAt=Date.now()}nativeQueueSave();return true}}
    return false;
  }
  function nativeQueueSetJobState(job,status,reason) {
    if(!job)return;const r=String(reason||''),now=Date.now();
    if(job.status===status&&job.reason===r)return;
    if(job.status===status&&/^waiting-(?:resources|population)$/.test(status||'')){
      const stable=x=>String(x||'').replace(/\d+(?:[.,]\d+)?/g,'#');
      if(stable(job.reason)===stable(r)&&now-(+job.reasonUpdatedAt||+job.updatedAt||0)<300000)return;
    }
    job.status=status;job.reason=r;job.reasonUpdatedAt=now;job.updatedAt=now;nativeQueueSaveSoon();try{scheduleNativeUiScan()}catch(_){}try{renderQueueCenter()}catch(_){}
  }

  const BUILD_SWAP_DEFAULT_MIN = 5;
  const BUILD_SWAP_IGNORE_MS = 600000;
  function buildSwapThresholdMs() {
    const n = gbNum(state.buildSwapThresholdMin);
    if (n === 0) return 0;
    return (n != null ? Math.max(1, Math.min(120, n)) : BUILD_SWAP_DEFAULT_MIN) * 60000;
  }

  function nativeQueueHeadBlockedFor(townId) {
    const list = nativeQueueList(townId, 'build', false);
    const head = list[0];
    if (!head) return null;
    if (head.inflight || head.manualReview) return null;
    if (!/^waiting-(?:resources|population)$/.test(String(head.status || ''))) return null;
    const since = +head.reasonUpdatedAt || +head.updatedAt || 0;
    if (!since) return null;

    return { townId: String(townId), jobId: head.id, building: head.building, why: head.reason || head.status, forMinutes: Math.floor((Date.now() - since) / 60000) };
  }
  function buildSwapIgnored(townId, headId) {
    const m = state.buildSwapIgnore;
    if (!m || typeof m !== 'object') return false;
    return +m[String(townId) + '|' + String(headId)] > Date.now();
  }
  function buildSwapIgnore(townId, headId) {
    if (!state.buildSwapIgnore || typeof state.buildSwapIgnore !== 'object') state.buildSwapIgnore = {};
    const now = Date.now();
    for (const [k, v] of Object.entries(state.buildSwapIgnore)) if (+v < now) delete state.buildSwapIgnore[k];
    state.buildSwapIgnore[String(townId) + '|' + String(headId)] = now + BUILD_SWAP_IGNORE_MS;
    save(STORE.BUILD_SWAP_IGNORE, state.buildSwapIgnore);
  }
  function nativeQueueSuggestSwap(townId) {
    const thresh = buildSwapThresholdMs();
    if (!thresh) return null;
    const blocked = nativeQueueHeadBlockedFor(townId);
    if (!blocked || blocked.forMinutes * 60000 < thresh) return null;
    if (buildSwapIgnored(townId, blocked.jobId)) return null;
    const list = nativeQueueList(townId, 'build', false);

    if (list.some(j => j && j.inflight)) return null;
    const levels = abCurrentLevels(townId);
    if (!levels) return null;
    for (let i = 1; i < list.length; i++) {
      const j = list[i];
      if (!j || !j.building) continue;
      const dep = abResolvePrerequisite(townId, j.building, levels);

      if (!dep || !dep.building || dep.building !== j.building) continue;
      const aff = abCanAfford(townId, j.building);
      if (!aff || !aff.ok) continue;
      return {
        successorIndex: i,
        successor: j,
        head: blocked,
        swap: { headId: blocked.jobId, successorId: j.id, from: i, to: 0 },
      };
    }
    return null;
  }
  function nativeQueueMarkBuild(townId,jobId,opts) {
    const list=nativeQueueList(townId,'build',false);
    const job=list.find(j=>j&&j.id===jobId);
    if(!job)return false;
    const o=opts||{};
    if(Object.prototype.hasOwnProperty.call(o,'inflight')){job.inflight=o.inflight;if(o.inflight)job.reconcile=null}
    if(Object.prototype.hasOwnProperty.call(o,'reconcile'))job.reconcile=o.reconcile;
    if(Object.prototype.hasOwnProperty.call(o,'manualReview'))job.manualReview=!!o.manualReview;
    if(o.status)job.status=o.status;
    if(Object.prototype.hasOwnProperty.call(o,'reason'))job.reason=String(o.reason||'');
    job.updatedAt=Date.now();nativeQueueSave();return true;
  }
  function nativeQueueReconcileBuild(townId) {

    try {
      const sug = nativeQueueSuggestSwap(townId);
      if (sug) gbLogT('build-swap-' + townId, 600000,
        `build queue: town ${townId} head stalled ${sug.head.forMinutes}min (${sug.head.why}) - ${sug.successor.building} is affordable`);
    } catch (_) {}
    const list=nativeQueueList(townId,'build',false);if(!list.length)return false;
    const levels=abCurrentLevels(townId);if(!levels)return false;let changed=false;
    for(const j of list){if(!j)continue;const flight=j.inflight||j.reconcile;if(flight&&flight.building&&flight.targetLevel!=null&&+(levels[flight.building]||0)>=+flight.targetLevel){j.inflight=null;j.reconcile=null;j.manualReview=false;j.status=flight.building===j.building?'pending':'waiting-requirement';j.reason=flight.building===j.building?'confirmado en la cola real':`requisito ${nativeBuildLabel(flight.building)} confirmado`;j.updatedAt=Date.now();changed=true;continue}

      // A timeout_unknown/pending head whose order IS in the real queue (timer
      // running, model not yet bumped) must not sit at manualReview: match the
      // reconcile snapshot against a non-tear-down slot by building_type and
      // stamp accepted:true so the 120s re-trip below leaves it alone until the
      // level-reached branch fires.
      if(j.manualReview && j.reconcile && j.reconcile.building && j.reconcile.targetLevel!=null){
        const fr=j.reconcile;
        if(+(levels[fr.building]||0)<+fr.targetLevel){
          const q=abQueueInfo(townId);
          if(q.known && q.orders.some(o=>o.building_type===fr.building && !o.tear_down)){
            j.inflight={building:fr.building,targetLevel:+fr.targetLevel,at:Date.now(),accepted:true};
            j.reconcile=null;
            j.manualReview=false;
            j.status='accepted';
            j.reason='en cola real; esperando actualización del juego';
            j.updatedAt=Date.now();changed=true;
            continue;
          }
        }
      }

      if(j.inflight&&!j.inflight.accepted&&Date.now()-(+j.inflight.at||0)>120000){j.reconcile=Object.assign({},j.inflight);j.inflight=null;j.manualReview=true;j.status='unknown';j.reason='la cola real no se actualiz\u00f3; comprobar antes de continuar';j.updatedAt=Date.now();changed=true}}
    for(let i=list.length-1;i>=0;i--){const j=list[i];if(!j||!AB_BUILDINGS.includes(j.building)||+(levels[j.building]||0)>=+j.toLevel){list.splice(i,1);changed=true}}
    if(changed){nativeQueueRebaseBuild(townId);nativeQueueSave()}return changed;
  }
  function nativeQueueBuildPlan(townId,levels) {
    nativeQueueReconcileBuild(townId);
    nativeQueueRebaseBuild(townId);
    const list=nativeQueueList(townId,'build',false);
    // 5.10.64: a live FIFO is the job list. Do not discard it because a
    // City Designer profile is assigned — that left the senate queue idle.
    if(!list.length){
      if(nativeQueuePlannerOwnsTown(townId)){
        const blocked=nativeQueuePlannerLaneBlocked(townId,'build');
        return {hasJob:blocked,plan:null,why:blocked?'planner-awaiting-reconcile':null};
      }
      return {hasJob:nativeQueueIsFifo(townId,'build'),plan:null};
    }
    if(nativeQueuePaused(townId,'build')){
      const first=list.find(Boolean);if(first)nativeQueueSetJobState(first,'paused','cola pausada');
      return {hasJob:true,plan:null,why:'paused'};
    }
    // A real request in flight owns the real building queue briefly. A tombstone
    // in manual review does not own the lane and must not starve unrelated jobs.
    const active=list.find(j=>j&&j.inflight);
    if(active){nativeQueueSetJobState(active,'sending',active.reason||'enviando a la cola real');return {hasJob:true,plan:null,why:'inflight'}}

    const reviewBuildings=new Set();
    for(const j of list){
      if(!j||!j.manualReview)continue;
      if(j.building)reviewBuildings.add(String(j.building));
      if(j.reconcile&&j.reconcile.building)reviewBuildings.add(String(j.reconcile.building));
      nativeQueueSetJobState(j,'unknown',j.reason||'resultado pendiente de revisión; otros edificios independientes pueden continuar');
    }

    let lastWhy='manual-review-only';
    for(const job of list){
      if(!job||job.manualReview||job.inflight)continue;
      if(reviewBuildings.has(String(job.building))){
        nativeQueueSetJobState(job,'waiting-review','misma construcción pendiente de revisión');
        lastWhy='same-building-review';continue;
      }
      const special=nativeSpecialConflict(townId,job.building);
      if(special){nativeQueueSetJobState(job,'blocked',`conflicto con ${nativeBuildLabel(special)}`);lastWhy='special-conflict';continue}
      const max=abMaxLevel(job.building);
      if(max==null){nativeQueueSetJobState(job,'blocked','nivel máximo desconocido');lastWhy='max-unreadable';continue}
      const toLevel = gbNum(job.toLevel);
      if (toLevel == null) { nativeQueueSetJobState(job,'blocked','nivel objetivo ilegible'); lastWhy='toLevel-unreadable'; continue; }
      if (toLevel > max) { nativeQueueSetJobState(job,'blocked','nivel máximo alcanzado'); lastWhy='max-level'; continue; }
      const resolved=abResolvePrerequisite(townId,job.building,levels);
      if(!resolved||!resolved.building){
        const why=resolved&&resolved.error||'requisito desconocido';
        nativeQueueSetJobState(job,'blocked',abReasonText(why));lastWhy=why;continue;
      }
      if(reviewBuildings.has(String(resolved.building))){
        nativeQueueSetJobState(job,'waiting-review',`requisito ${nativeBuildLabel(resolved.building)} pendiente de revisión`);
        lastWhy='requirement-review';continue;
      }
      const aff=abCanAfford(townId,resolved.building);
      if(!aff.ok){
        const why=aff.why||'recursos',detail=abAffordReason(aff),status=why==='resources'?'waiting-resources':(why==='population'?'waiting-population':'blocked');
        nativeQueueSetJobState(job,status,detail);
        if(aff.popShort&&resolved.building!=='farm')nativePopRescueFifo(townId,levels,aff);
        lastWhy=why;continue;
      }
      const isRequirement=resolved.building!==job.building;
      nativeQueueSetJobState(job,'ready',isRequirement?`antes: ${nativeBuildLabel(resolved.building)}`:'listo');
      return {hasJob:true,plan:{building:resolved.building,forTarget:job.building,reason:isRequirement?`requisito para ${job.building}`:'cola ejecutable',cost:aff.need,nativeJobId:job.id,nativeRequestedBuilding:job.building,nativeRequirement:isRequirement}};
    }
    return {hasJob:true,plan:null,why:lastWhy};
  }
  function nativeQueueBuildApplied(townId,plan) {
    if(!plan||!plan.nativeJobId)return;
    const list=nativeQueueList(townId,'build',false);
    const i=list.findIndex(j=>j&&j.id===plan.nativeJobId);if(i<0)return;
    const job=list[i];
    if(!plan.nativeRequirement&&plan.building===job.building){list.splice(i,1);nativeQueueRebaseBuild(townId)}
    else{job.inflight=null;job.reconcile=null;job.manualReview=false;nativeQueueSetJobState(job,'waiting-requirement',`construyendo ${nativeBuildLabel(plan.building)} primero`)}
    nativeQueueSave();
  }

  function nativeQueueReconcileRecruit(townId,lane) {
    const lanes=lane?[lane]:NATIVE_RECRUIT_LANES;let changed=false;
    let queueKnown=false;
    try{queueKnown=!!(recruitQueueInfo(townId)||{}).known}catch(_){}
    for(const ln of lanes){
      const list=nativeQueueList(townId,ln,false);if(!list.length)continue;
      for(const j of list){
        if(!j)continue;
        const fl=j.inflight||j.reconcile;
        if(fl&&queueKnown&&fl.queuedBefore!=null&&j.unit){
          let now=null;
          try{now=recruitQueuedAmount(townId,j.unit)}catch(_){now=null}
          if(now!=null&&now>=(+fl.queuedBefore||0)+(+fl.amount||0)){
            const amount=+fl.amount||0;
            // Apply by stable job id. Manual-review jobs have no inflight token.
            nativeQueueRecruitApplied(townId,ln,j.id,amount,j.inflight&&j.inflight.token||null);
            changed=true;continue;
          }
        }
        if(j.inflight&&Date.now()-(+j.inflight.at||0)>120000){
          j.reconcile=Object.assign({},j.inflight);
          j.inflight=null;j.manualReview=true;j.status='unknown';
          j.reason='la cola real no se actualizó; este trabajo queda en revisión sin bloquear otras unidades';
          j.updatedAt=Date.now();changed=true;
        }
      }
    }
    if(changed)nativeQueueSave();return changed;
  }
  function nativeQueueRecruitCandidates(townId,lane) {
    lane=lane||'recruit';
    nativeQueueReconcileRecruit(townId,lane);
    // Walk jobs one-by-one: any finite amount >1000 becomes ∞ · lotes de X.
    nativeQueueNormalizeRecruitLane(townId,lane);
    const list=nativeQueueList(townId,lane,false);if(!list.length)return [];
    if(nativeQueuePaused(townId,lane)){
      const first=list.find(Boolean);if(first)nativeQueueSetJobState(first,'paused','cola pausada');return [];
    }
    // Only a request already in flight owns the real training lane.  A job that
    // merely lacks resources must NEVER reserve them or block later affordable jobs.
    const active=list.find(j=>j&&j.inflight);
    if(active){nativeQueueSetJobState(active,'sending',active.reason||'enviando a la cola real');return []}
    const reviewUnits=new Set(list.filter(j=>j&&j.manualReview&&j.unit).map(j=>String(j.unit)));
    for(const j of list)if(j&&j.manualReview)nativeQueueSetJobState(j,'unknown',j.reason||'resultado pendiente de revisión; otras unidades pueden continuar');
    const out=[];
    for(const job of list){
      if(!job||job.manualReview||job.inflight)continue;
      if(job.slotRetryAt&&+job.slotRetryAt>Date.now()){
        nativeQueueSetJobState(job,'waiting-slot','cola llena según el servidor; reintento en ' + Math.ceil((+job.slotRetryAt-Date.now())/60000) + 'min');continue;
      }
      if(job.slotRetryAt)job.slotRetryAt=0;
      if(reviewUnits.has(String(job.unit))){
        nativeQueueSetJobState(job,'waiting-review','misma unidad pendiente de revisión');continue;
      }
      out.push(job);
    }
    return out;
  }
  function nativeQueueRecruitHead(townId,lane) {
    return nativeQueueRecruitCandidates(townId,lane)[0]||null;
  }
  function nativeQueueRecruitApplied(townId,lane,jobId,amount,token) {
    const list=nativeQueueList(townId,lane||'recruit',false);
    const i=list.findIndex(j=>j&&j.id===jobId);if(i<0)return;
    const job=list[i];
    if(token&&!(job.inflight&&job.inflight.token===token))return;
    const drained=Math.max(0,+amount||0);
    job.inflight=null;job.reconcile=null;job.manualReview=false;
    if (nativeQueueRecruitIsInfinite(job)) {
      const C = nativeQueueRecruitChunkOf(job);
      job.infinite = true;
      job.amount = -1;
      job.chunkSize = C;
      job.status = 'pending';
      job.reason = `\u221e \u00b7 lotes de ${C}`;
      job.updatedAt = Date.now();
      nativeQueueSave();
      try { jrnPush({ f:'recruit', a:'chunk-drain', k:String(townId)+'|'+String(job.unit||'')+'|'+jobId }, 'ok', 'rest \u221e'); } catch (_) {}
      return;
    }
    job.amount=Math.max(0,(+job.amount||0)-drained);
    const removed=job.amount<=0;
    if(removed)list.splice(i,1);else{job.status='pending';job.reason='resto del lote';job.updatedAt=Date.now()}
    nativeQueueSave();
    try { jrnPush({ f:'recruit', a:'chunk-drain', k:String(townId)+'|'+String(job.unit||'')+'|'+jobId }, 'ok', removed ? 'drained' : ('rest '+job.amount)); } catch (_) {}
  }

  function nativeResearchLabel(tech) {
    try{const n=researchLabel(tech);if(n)return String(n)}catch(_){}
    return String(tech||'?');
  }

  function nativeResearchDeps(tech) {
    try{
      const def=gameUw().GameData&&gameUw().GameData.researches&&gameUw().GameData.researches[tech];
      if(!def)return null;
      const raw=def.research_dependencies||def.dependencies||[];
      const list=Array.isArray(raw)?raw:Object.keys(raw||{}).filter(k=>raw[k]);
      return list.map(d=>typeof d==='string'?d:(d&&(d.id||d.research_id||d.research_type))).filter(Boolean).map(String);
    }catch(_){return null}
  }
  function nativeResearchDepClosure(tech) {
    const out=new Set();
    const walk=(id,depth)=>{
      if(depth>20)return;
      const deps=nativeResearchDeps(id);
      if(!deps)return;
      for(const d of deps){if(out.has(d))continue;out.add(d);walk(d,depth+1)}
    };
    walk(String(tech),0);
    return out;
  }

  function nativeResearchPrereqChain(townId,tech) {
    const info=researchTownTechs(townId);
    if(!info)return {chain:[],error:'estado de la Academia ilegible'};
    const done=new Set();
    for(const k of Object.keys(info.techs||{}))if(info.techs[k])done.add(String(k));
    (info.orders||[]).forEach(o=>{const id=researchOrderTechId(o);if(id!=null)done.add(String(id))});
    nativeQueueList(townId,'research',false).forEach(j=>{if(j&&j.tech)done.add(String(j.tech))});
    const chain=[],seen=new Set();
    let error=null;
    const walk=(id,depth)=>{
      id=String(id);
      if(done.has(id)||seen.has(id))return;
      if(depth>20){error='cadena de requisitos demasiado larga';return}
      const deps=nativeResearchDeps(id);
      if(deps==null){error=`requisitos de ${id} ilegibles`;return}
      for(const d of deps)walk(d,depth+1);
      seen.add(id);chain.push(id);
    };
    const deps=nativeResearchDeps(tech);
    if(deps==null)return {chain:[],error:'requisitos ilegibles'};
    for(const d of deps)walk(d,1);
    return {chain,error};
  }
  function nativeQueueResearchRemovalImpact(townId,jobId) {
    const list=nativeQueueList(townId,'research',false);
    const idx=list.findIndex(j=>j&&j.id===jobId);
    if(idx<0)return {ok:true};
    const target=String(list[idx].tech||'');
    if(!target)return {ok:true};
    const info=researchTownTechs(townId);
    if(info&&info.techs&&info.techs[target])return {ok:true};
    const blockers=[];
    for(let i=idx+1;i<list.length;i++){
      const j=list[i];if(!j||!j.tech)continue;
      if(nativeResearchDepClosure(j.tech).has(target))blockers.push(String(j.tech));
    }
    if(!blockers.length)return {ok:true};
    return {ok:false,blockers,target};
  }
  function nativeQueueResearchPending(townId,tech) {
    return nativeQueueList(townId,'research',false).some(j=>j&&String(j.tech)===String(tech));
  }
  function nativeQueueAddResearch(townId,tech) {
    if(nativeQueueRejectManualWhenPlanner(townId))return false;
    tech=String(tech||'');
    if(!tech||!gbGameDataLookup("researches", tech)){flash('Investigaci\u00f3n desconocida');return false}
    nativeQueueReconcileResearch(townId);
    const info=researchTownTechs(townId);
    if(!info){flash('No se puede leer la Academia');return false}
    if(info.techs&&info.techs[tech]){flash(`${nativeResearchLabel(tech)} ya est\u00e1 investigada`);return false}
    if((info.orders||[]).some(o=>String(researchOrderTechId(o))===tech)){flash(`${nativeResearchLabel(tech)} ya est\u00e1 en la cola real`);return false}
    if(nativeQueueResearchPending(townId,tech)){flash(`${nativeResearchLabel(tech)} ya est\u00e1 en la cola virtual`);return false}
    const walk=nativeResearchPrereqChain(townId,tech);

    if(walk.error&&!walk.chain.length){flash(`Requisitos no resolubles: ${walk.error}`);return false}
    const town=nativeQueueTown(townId,true);town.mode.research='fifo';
    const push=(id,reason)=>town.research.push({id:nativeQueueId('r'),kind:'research',townId:String(townId),tech:String(id),status:'pending',reason:reason||'',createdAt:Date.now()});
    let added=0;
    for(const dep of walk.chain){if(!gbGameDataLookup("researches", dep))continue;push(dep,`requisito para ${nativeResearchLabel(tech)}`);added++}
    if(!walk.error)push(tech,'');
    nativeQueueSave();
    if(walk.error){
      gbLogT('native-research-walk-'+tech,300000,`native queue: research prereq walk for ${tech} incomplete (${walk.error})`);
      flash(`${added} requisito(s) a\u00f1adidos; el objetivo final no se puede resolver: ${walk.error}`);
    }
    else if(added)flash(`+${added} requisito(s) antes de ${nativeResearchLabel(tech)}`);
    gbLog(`cola nativa: investigaci\u00f3n ${walk.error?`(solo requisitos, ${walk.error}) `:''}${tech}${added?` + ${added} requisito(s) [${walk.chain.join(', ')}]`:''} @${townId}`);
    gbTimeout(()=>researchScan('native'),80);return true;
  }
  function nativeQueueRemoveResearch(townId,tech) {
    nativeQueueReconcileResearch(townId);
    const list=nativeQueueList(townId,'research',false);
    for(let i=list.length-1;i>=0;i--){
      const j=list[i];
      if(!j||String(j.tech)!==String(tech)||j.inflight||j.manualReview)continue;
      return nativeQueueRemove(townId,'research',j.id,{force:false});
    }
    return false;
  }
  function nativeQueueReconcileResearch(townId) {
    const list=nativeQueueList(townId,'research',false);if(!list.length)return false;
    const info=researchTownTechs(townId);let changed=false;

    const ordersUsable=!!(info&&info.ordersKnown);
    const landed=j=>!!(info&&((info.techs&&info.techs[j.tech])||(ordersUsable&&(info.orders||[]).some(o=>String(researchOrderTechId(o))===String(j.tech)))));
    for(const j of list){
      if(!j||!j.inflight)continue;
      if(landed(j)){j.inflight=null;j.manualReview=false;j.status='pending';j.reason='confirmado en la cola real';j.updatedAt=Date.now();changed=true;continue}

      if(Date.now()-(+j.inflight.at||0)>120000){j.inflight=null;j.manualReview=true;j.status='unknown';j.reason='la cola real no se actualiz\u00f3; comprobar antes de continuar';j.updatedAt=Date.now();changed=true}
    }

    if(info){
      for(let i=list.length-1;i>=0;i--){
        const j=list[i];
        if(!j){list.splice(i,1);changed=true;continue}
        if(j.inflight)continue;
        if(landed(j)){list.splice(i,1);changed=true}
      }
    }
    if(changed)nativeQueueSave();return changed;
  }
  function nativeQueueResearchCandidates(townId) {
    nativeQueueReconcileResearch(townId);
    const list=nativeQueueList(townId,'research',false);if(!list.length)return [];
    if(nativeQueuePaused(townId,'research')){
      const first=list.find(Boolean);if(first)nativeQueueSetJobState(first,'paused','cola pausada');return [];
    }
    const active=list.find(j=>j&&j.inflight);
    if(active){nativeQueueSetJobState(active,'sending',active.reason||'enviando a la cola real');return []}
    const reviewTechs=new Set(list.filter(j=>j&&j.manualReview&&j.tech).map(j=>String(j.tech)));
    for(const j of list)if(j&&j.manualReview)nativeQueueSetJobState(j,'unknown',j.reason||'resultado pendiente de revisión; otras investigaciones pueden continuar');
    const out=[];
    for(const job of list){
      if(!job||job.manualReview||job.inflight)continue;
      if(reviewTechs.has(String(job.tech))){nativeQueueSetJobState(job,'waiting-review','misma investigación pendiente de revisión');continue}
      const deps=nativeResearchDepClosure(job.tech);
      let blocked=false;
      for(const t of reviewTechs)if(deps.has(t)){blocked=true;break}
      if(blocked){nativeQueueSetJobState(job,'waiting-review','requisito pendiente de revisión');continue}
      out.push(job);
    }
    return out;
  }
  function nativeQueueResearchHead(townId) {
    return nativeQueueResearchCandidates(townId)[0]||null;
  }
  function nativeQueueResearchApplied(townId,jobId) {
    const list=nativeQueueList(townId,'research',false);
    const i=list.findIndex(j=>j&&j.id===jobId);if(i<0)return;
    list.splice(i,1);nativeQueueSave();
  }

  gbAddStyle('native-ui', `
    /* The senate tile stacks absolutely-positioned overlays (building caption,
       level badge, hover hitbox) on top of its content. A statically-positioned
       control paints UNDER all of them, so the caption text swallowed the click
       even though the button looked reachable. position+z-index puts it on top
       of its stacking context and makes hit-testing land on the button. */
    .gb-native-qctl{position:relative;z-index:2147482000;pointer-events:auto;display:inline-flex;align-items:center;gap:2px;margin:0 0 0 2px;padding:1px 3px;border:1px solid #8a6725;border-radius:4px;background:rgba(31,25,16,.94);color:#f6e3b0;font:10px/1.2 Arial,sans-serif,"Segoe UI Symbol","Noto Sans Symbols 2","DejaVu Sans";box-shadow:0 1px 3px rgba(0,0,0,.45);vertical-align:middle}
    /* Shared style for the batched-input fields used by both the Queue Center
       +Lote row and the in-window native recruit tile (native-ui.js +
       queue-center.js used to keep the literal inline and out of sync). */
    .gb-native-qinp{width:55px;background:#111;color:#cfc;border:1px solid #444;border-radius:3px;padding:1px 3px}
    .gb-native-qbtn{position:relative;z-index:1;pointer-events:auto;min-width:22px;height:20px;padding:0 4px;border:1px solid #9b7938;border-radius:4px;background:linear-gradient(#5b4828,#342814);color:#fff3c7;font:bold 11px Arial,sans-serif,"Segoe UI Symbol","Noto Sans Symbols 2","DejaVu Sans";cursor:pointer}
    .gb-native-qbtn:hover{border-color:#e5b94f;color:#fff}.gb-native-qbtn:disabled{opacity:.42;cursor:default}
    .gb-native-qcount{min-width:58px;text-align:center;white-space:nowrap}.gb-native-qcount.ready{color:#91e5a8}.gb-native-qcount.blocked{color:#ffb0a8}.gb-native-qcount.waiting{color:#ffd27a}
    /* Recruit tile overlay. The game hard-codes #unit_order #units height:95px
       and every .unit_tab is a 58x95 float inside it, so ANY node appended
       into the tile grows the float, wraps the row and pushes the rest of the
       unit list plus the window's own navigation strip out of the clipped box.
       The in-tile control is therefore absolutely positioned (zero layout
       footprint) and only carries [+step], the pending count and the [...]
       opener; everything that cannot fit in 58px lives in the popover. */
    .gb-native-qctl[data-unit]{position:absolute;left:1px;right:1px;bottom:1px;flex-direction:column;align-items:stretch;gap:1px;margin:0;padding:1px;font-size:9px}
    .gb-native-qctl[data-unit] .gb-native-qrow{display:flex;gap:1px;justify-content:center}
    .gb-native-qctl[data-unit] .gb-native-qbtn{min-width:0;flex:1 1 auto;height:14px;padding:0 1px;font:bold 9px/12px Arial,sans-serif,"Segoe UI Symbol","Noto Sans Symbols 2","DejaVu Sans"}
    .gb-native-qctl[data-unit] .gb-native-qcount{min-width:0;font-size:9px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    /* Popover for the recruit tile extras: mounted on document.body so it is not
       clipped by the 95px unit box and cannot shift the game's layout. */
    .gb-native-qpop{position:fixed;z-index:2147483100;width:250px;max-width:92vw;padding:6px;border:1px solid #8a6725;border-radius:6px;background:rgba(34,27,17,.98);color:#f2dfb2;font:11px/1.3 Arial,sans-serif,"Segoe UI Symbol","Noto Sans Symbols 2","DejaVu Sans";box-shadow:0 4px 14px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:4px}
    .gb-native-qpop-head{display:flex;align-items:center;gap:4px;font-weight:bold}.gb-native-qpop-head span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .gb-native-qpop-row{display:flex;align-items:center;gap:3px;flex-wrap:wrap}
    .gb-native-qpop-row .gb-native-qcount{min-width:58px}
    /* The panel is a column: head (never scrolls) + two independently scrolling
       sections. A single overflow:auto on the box made the unit grid push the
       job list out of the 48vh clip, which is exactly the "I cannot see it all"
       complaint. right/bottom are set by nativeLayoutPanels - the old
       hard-coded recruitNaval offset only de-collided two of the four lanes. */
    .gb-native-panel{position:fixed;bottom:10px;right:10px;z-index:2147483000;width:300px;max-width:44vw;max-height:64vh;padding:5px;border:1px solid #8a6725;border-radius:6px;background:rgba(34,27,17,.97);color:#f2dfb2;font:11px/1.25 Arial,sans-serif,"Segoe UI Symbol","Noto Sans Symbols 2","DejaVu Sans";box-shadow:0 4px 14px rgba(0,0,0,.55);display:flex;flex-direction:column;overflow:hidden}
    .gb-native-panel-head{display:flex;align-items:center;gap:4px;margin-bottom:3px;font-weight:bold;flex:0 0 auto}.gb-native-panel-head span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .gb-native-panel-sum{color:#c7ad78;padding:1px 2px}
    /* Every recruitable unit of this lane, whether or not its 58x95 tile is
       inside the game's clipped 95px strip. */
    .gb-native-units{flex:1 1 auto;min-height:0;overflow:auto;margin-bottom:3px;border-bottom:1px solid rgba(190,150,75,.3);padding-bottom:2px}
    .gb-native-unit{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:3px;align-items:center;padding:1px 1px;border-top:1px solid rgba(190,150,75,.14)}
    .gb-native-unit:first-child{border-top:0}
    .gb-native-unit>b{font-weight:normal;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .gb-native-unit .gb-native-qbtn{min-width:18px;height:16px;padding:0 3px;font:bold 9px/14px Arial,sans-serif,"Segoe UI Symbol","Noto Sans Symbols 2","DejaVu Sans"}
    .gb-native-unit .gb-native-qcount{min-width:46px;font-size:10px}
    .gb-native-unit-actions{display:flex;gap:2px}
    .gb-native-jobs{flex:1 1 auto;min-height:0;overflow:auto}
    .gb-native-job{display:grid;grid-template-columns:20px minmax(100px,1fr) auto;gap:4px;align-items:center;padding:2px 1px;border-top:1px solid rgba(190,150,75,.22)}
    .gb-native-job:first-child{border-top:0}.gb-native-job small{display:block;color:#c7ad78;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gb-native-job-actions{display:flex;gap:2px}
    .gb-native-job .gb-native-qbtn{min-width:18px;height:17px;padding:0 3px}
    .gb-native-empty{color:#b9a983;font-style:italic;padding:2px}
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

    if(ids.size>1){
      const cur=abCurrentTownId();
      const curId=cur==null?null:String(cur);
      let focused=false;
      try{const mgr=gameUw().GPWindowMgr,w=mgr&&mgr.getFocusedWindow&&mgr.getFocusedWindow(),jq=w&&w.getJQElement&&w.getJQElement(),el=jq&&(jq[0]||jq.get&&jq.get(0));focused=!!(el&&(el===root||el.contains(root)||root.contains(el)))}catch(_){focused=false}
      if(focused&&curId&&ids.has(curId)&&abGetTown(curId))return curId;
      gbLogT('native-townid-ambiguous',600000,`native ui: window carries ${ids.size} town ids (${[...ids].join(',')}) - controls skipped`);
      return null;
    }
    if(ids.size===1){const id=[...ids][0];return abGetTown(id)?id:null}
    const isRelevant=r=>!!(r&&r.matches&&r.matches('#unit_order,.window_content,.gpwindow_content'))&&!!(r.matches('#unit_order')||nativeAcademyRoot(r)||r.querySelector(`#unit_order,#building_main,.building_main,[id^="building_main_"],[id^="special_building_"],${NATIVE_RESEARCH_SEL}`));
    const relevant=isRelevant(root);
    if(!relevant)return null;

    let focusProven=false;
    try{const mgr=gameUw().GPWindowMgr,w=mgr&&mgr.getFocusedWindow&&mgr.getFocusedWindow(),jq=w&&w.getJQElement&&w.getJQElement(),el=jq&&(jq[0]||jq.get&&jq.get(0));if(el){focusProven=true;if(!(el===root||el.contains(root)||root.contains(el)))return null}}catch(_){}
    if(!focusProven){try{const candidates=[...document.querySelectorAll('.window_content,.gpwindow_content,#unit_order')].filter((x,i,a)=>a.indexOf(x)===i&&!x.closest('#grepbot-panel')&&!x.closest('[hidden]')&&(x.getClientRects?x.getClientRects().length>0:true)),visibleRoots=candidates.filter(x=>!candidates.some(y=>y!==x&&y.contains(x))).filter(isRelevant);if(visibleRoots.length!==1||visibleRoots[0]!==root){if(visibleRoots.length>=2){const focused=document.activeElement;let pick=null;for(const r of visibleRoots){if(r===focused||(focused&&r.contains(focused)))pick=r;if(pick)break}if(!pick)pick=visibleRoots[0];if(pick!==root)return null}else return null}}catch(_){return null}}
    const current=abCurrentTownId(),id=current==null?null:String(current);return id&&abGetTown(id)?id:null;
  }
  function nativeTownAction(root,townId,onClick) {
    return e=>{if(!gbTabLeader){flash('GrepBot est\u00e1 activo en otra pesta\u00f1a');return false}const live=nativeWindowTownId(root);if(String(live||'')!==String(townId||'')){flash('La ciudad de esta ventana ha cambiado; vuelve a intentarlo');scheduleNativeUiScan();return false}return onClick&&onClick(e)};
  }

  function nativePanelAction(townId,onClick) {
    return e=>{if(!gbTabLeader){flash('GrepBot est\u00e1 activo en otra pesta\u00f1a');return false}return onClick&&onClick(e)};
  }
  function nativeTileAction(root,townId,tile,kind,id,onClick) {
    return nativeTownAction(root,townId,e=>{const live=kind==='build'?nativeBuildingId(tile):(kind==='research'?nativeResearchId(tile):nativeUnitId(tile));if(String(live||'')!==String(id||'')){flash('Este elemento de la ventana ha cambiado; vuelve a intentarlo');scheduleNativeUiScan();return false}return onClick&&onClick(e)});
  }
  function nativeGuardEvent(e){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation()}
  function nativeRecruitRememberedQty(fallback) {
    const fb=Math.max(1,Math.floor(+fallback||1));
    const n=Math.floor(+load(STORE.NATIVE_RECRUIT_LAST_QTY,fb)||fb);
    return Math.max(1,n);
  }
  function nativeRecruitRememberQty(value,fallback) {
    const fb=Math.max(1,Math.floor(+fallback||1));
    const n=Math.max(1,Math.floor(+value||fb));
    save(STORE.NATIVE_RECRUIT_LAST_QTY,n);
    return n;
  }
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
    const ids=new Set();for(const id of vals)if(gbGameDataLookup("units", id))ids.add(id);const matchers=nativeUnitMatchers();for(const raw of vals)for(const m of matchers)if(m.re.test(raw))ids.add(m.id);return ids.size===1?[...ids][0]:null;
  }

  const NATIVE_RESEARCH_SEL='[data-research_id],[data-research-id],[data-research_type],[data-research-type]';

  const NATIVE_RESEARCH_SEL_CLASS='.btn_upgrade,.button_upgrade,.research_icon';
  const NATIVE_RESEARCH_SEL_ALL=NATIVE_RESEARCH_SEL+','+NATIVE_RESEARCH_SEL_CLASS;

  function nativeAcademyRoot(root) {
    if(!root)return false;
    try{
      if(root.querySelector('.tech_tree_box'))return true;
      if(root.closest&&root.closest('.tech_tree_box'))return true;
      if(root.matches&&root.matches('#building_academy,.building_academy'))return true;
      if(root.querySelector('#building_academy,.building_academy'))return true;
      const win=root.closest&&root.closest('.js-window-main-container,.gpwindow,.ui-dialog');
      if(win&&win.classList&&win.classList.contains('academy'))return true;
    }catch(_){}
    return false;
  }
  function nativeResearchTileSel(root) {
    return nativeAcademyRoot(root)?NATIVE_RESEARCH_SEL_ALL:NATIVE_RESEARCH_SEL;
  }

  let nativeResearchKeyCache=null;
  function nativeResearchKey(raw) {
    const v=String(raw==null?'':raw).trim();
    if(!v)return null;
    if(gbGameDataLookup("researches", v))return v;
    let all=null;try{all=gameUw().GameData&&gameUw().GameData.researches}catch(_){}
    if(!all||typeof all!=='object')return null;
    const keys=Object.keys(all),sig=keys.length+':'+keys.join(',');
    if(!nativeResearchKeyCache||nativeResearchKeyCache.sig!==sig){
      const map=Object.create(null);
      for(const k of keys){
        const d=all[k]||{};
        for(const alt of [d.id,d.research_id,d.research_type,d.name]){
          if(alt==null)continue;const s=String(alt).trim();
          if(s&&!(s in map))map[s]=k;
        }
      }
      nativeResearchKeyCache={sig,map};
    }
    return nativeResearchKeyCache.map[v]||null;
  }

  function nativeResearchFromClass(node) {
    try{
      const raw=node&&node.className;
      const cls=String(raw&&raw.baseVal!=null?raw.baseVal:(raw||'')).split(/\s+/);
      const ids=new Set();
      for(const c of cls){
        if(!c||c==='research_icon'||c==='btn_upgrade'||c==='button_upgrade'||c==='btn_downgrade')continue;
        const k=nativeResearchKey(c)||nativeResearchKey(c.replace(/_(?:old|bpv)$/,''));
        if(k)ids.add(k);
      }
      return ids.size===1?[...ids][0]:null;
    }catch(_){return null}
  }
  function nativeResearchId(node) {
    if(!node)return null;
    const vals=[];
    for(const k of ['data-research_id','data-research-id','data-research_type','data-research-type']){
      try{const v=node.getAttribute&&node.getAttribute(k);if(v)vals.push(String(v))}catch(_){}
    }
    if(!vals.length){
      try{
        const jq=gameUw().jQuery||gameUw().$;
        if(jq)for(const k of ['research_id','research-id','research_type','research-type']){
          const v=jq(node).data(k);if(v!=null&&v!=='')vals.push(String(v));
        }
      }catch(_){}
    }
    const ids=new Set();for(const v of vals){const k=nativeResearchKey(v);if(k)ids.add(k)}
    if(ids.size===1)return [...ids][0];
    if(!ids.size){
      const byClass=nativeResearchFromClass(node);
      if(byClass)return byClass;
      try{const child=node.querySelector&&node.querySelector(NATIVE_RESEARCH_SEL);if(child)return nativeResearchId(child)}catch(_){}
    }
    return null;
  }

  function nativeBuildPlusBlock(building,projected,max,special) {
    if(special)return `Conflicto con ${nativeBuildLabel(special)}`;
    if(projected==null)return 'No se puede leer el nivel actual de este edificio';
    if(max==null)return 'No se puede leer el nivel m\u00e1ximo de este edificio';
    if(projected>=max)return `${nativeBuildLabel(building)} ya est\u00e1 al m\u00e1ximo (${max}) contando la cola`;
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
        gbLogT('native-qctl-covered-'+label,300000,`native queue: [+] for ${label} is covered by ${desc} \u2014 click will not reach it`);
      }catch(_){}
    },250);
  }
  function nativeMountBuildControl(root,tile,townId,building) {
    const list=nativeQueueList(townId,'build',false),frozen=list.some(j=>j&&j.inflight),jobs=list.filter(j=>j&&j.building===building);
    const projected=nativeQueueProjectedBuildLevel(townId,building),pos=nativeQueuePosition(townId,'build',j=>j&&j.building===building);
    const head=pos===1&&list[0],max=abMaxLevel(building),special=nativeSpecialConflict(townId,building),sig=JSON.stringify([townId,building,projected,pos,frozen,max,special,jobs.map(j=>[j.id,j.toLevel,j.status,j.reason,!!j.inflight,!!j.manualReview])]);

    const existing=[...tile.querySelectorAll('.gb-native-qctl[data-building]')];
    const keep=existing.find(c=>c.dataset.building===building&&c.dataset.sig===sig);
    for(const c of existing)if(c!==keep)c.remove();
    if(keep)return;
    const ctl=document.createElement('div');ctl.className='gb-native-qctl';ctl.dataset.building=building;ctl.dataset.sig=sig;
    const anchor=tile.querySelector('.level,.building_level,.level_wrapper');(anchor&&anchor.parentElement||tile).appendChild(ctl);
    if(!jobs.length){

      const plus=nativeQButton('+',`A\u00f1adir ${nativeBuildLabel(building)} +1 al final de la cola virtual`,nativeTileAction(root,townId,tile,'build',building,()=>nativeQueueAddBuild(townId,building)));
      const fill=nativeQButton('++',`Encolar ${nativeBuildLabel(building)} desde el nivel ${projected} hasta el m\u00e1ximo (${max})`,nativeTileAction(root,townId,tile,'build',building,()=>nativeQueueFillToMax(townId,building)));
      nativeApplyPlusBlock(plus,nativeBuildPlusBlock(building,projected,max,special));
      nativeApplyPlusBlock(fill,nativeBuildPlusBlock(building,projected,max,special));
      ctl.append(plus,fill);nativeQctlHitCheck(ctl,building);return;
    }

    const minus=nativeQButton('-','Quitar la \u00faltima mejora virtual',nativeTileAction(root,townId,tile,'build',building,()=>{if(!nativeQueueRemoveLastBuild(townId,building))flash('No hay mejora virtual que quitar')}));minus.disabled=!jobs.some(j=>j&&!j.inflight&&!j.manualReview);
    const count=document.createElement('span');count.className='gb-native-qcount';
    count.textContent=`Plan ${projected}${pos?' \u00b7 #'+pos:''}`;
    if(head&&head.reason)count.title=head.reason;
    if(head){if(head.status==='ready')count.classList.add('ready');else if(/blocked|unknown/.test(head.status||''))count.classList.add('blocked');else count.classList.add('waiting')}
    const plus=nativeQButton('+',`A\u00f1adir ${nativeBuildLabel(building)} +1 al final de la cola`,nativeTileAction(root,townId,tile,'build',building,()=>nativeQueueAddBuild(townId,building)));
    const fill=nativeQButton('++',`Encolar ${nativeBuildLabel(building)} desde el nivel ${projected} hasta el m\u00e1ximo (${max})`,nativeTileAction(root,townId,tile,'build',building,()=>nativeQueueFillToMax(townId,building)));
    nativeApplyPlusBlock(plus,nativeBuildPlusBlock(building,projected,max,special));
    nativeApplyPlusBlock(fill,nativeBuildPlusBlock(building,projected,max,special));
    ctl.append(minus,count,plus,fill);nativeQctlHitCheck(ctl,building);
  }
  function nativeMountRecruitControl(root,tile,townId,unit) {

    const lane=nativeRecruitLaneOf(townId,unit);
    const list=nativeQueueList(townId,lane,false),frozen=list.some(j=>j&&j.inflight),step=nativeUnitStep(unit),pending=nativeQueueRecruitAmount(townId,unit);
    const pos=nativeQueuePosition(townId,lane,j=>j&&j.unit===unit),head=pos===1&&list[0];

    const sig=JSON.stringify([townId,unit,lane,step,pending,pos,frozen,head&&head.status,head&&head.reason,list.length]);

    const existing=[...tile.querySelectorAll(':scope > .gb-native-qctl[data-unit]')];
    const keep=existing.find(c=>c.dataset.unit===unit&&c.dataset.sig===sig);
    for(const c of existing)if(c!==keep)c.remove();
    if(keep)return;
    const ctl=document.createElement('div');ctl.className='gb-native-qctl';ctl.dataset.unit=unit;ctl.dataset.sig=sig;

    try{if(getComputedStyle(tile).position==='static')tile.style.position='relative'}catch(_){}
    tile.appendChild(ctl);
    if(pending>0||pending<0){
      const count=document.createElement('span');count.className='gb-native-qcount';
      count.textContent=(pending<0?'\u221e':('+'+pending))+(pos?' \u00b7 #'+pos:'');
      count.title=head&&head.reason?head.reason:(pending<0?'cola infinita':`${pending} pendiente(s)`);
      if(head){if(head.status==='ready')count.classList.add('ready');else if(/blocked|unknown/.test(head.status||''))count.classList.add('blocked');else count.classList.add('waiting')}
      ctl.append(count);
    }
    const row=document.createElement('div');row.className='gb-native-qrow';
    const plus=nativeQButton(`+${step}`,`A\u00f1adir ${step} ${nativeUnitLabel(unit)} a la cola virtual (Ctrl: \u00d75)`,nativeTileAction(root,townId,tile,'unit',unit,e=>nativeQueueAddRecruit(townId,unit,(e.ctrlKey||e.metaKey)?step*5:step)));

    const more=nativeQButton('...',`M\u00e1s opciones de cola para ${nativeUnitLabel(unit)}: restar, cantidad libre, lote y compactar`,nativeTileAction(root,townId,tile,'unit',unit,()=>nativeRecruitPopover(root,tile,townId,unit)));
    row.append(plus,more);ctl.append(row);
    nativeQctlHitCheck(ctl,unit);
  }
  let nativeQPopCleanup=null;
  function nativeQPopClose() {
    try{if(nativeQPopCleanup)nativeQPopCleanup()}catch(_){}
    nativeQPopCleanup=null;
    try{document.querySelectorAll('.gb-native-qpop').forEach(n=>n.remove())}catch(_){}
  }
  function nativeRecruitPopover(root,tile,townId,unit,anchor) {
    nativeQPopClose();
    const at=anchor||tile;
    if(!at||!at.isConnected)return;
    const lane=nativeRecruitLaneOf(townId,unit);
    const list=nativeQueueList(townId,lane,false),step=nativeUnitStep(unit),pending=nativeQueueRecruitAmount(townId,unit);
    const pos=nativeQueuePosition(townId,lane,j=>j&&j.unit===unit),head=pos===1&&list[0];
    const pop=document.createElement('div');pop.className='gb-native-qpop';pop.dataset.unit=unit;pop.dataset.town=String(townId);
    pop.addEventListener('mousedown',e=>e.stopPropagation());pop.addEventListener('click',e=>e.stopPropagation());

    const act=fn=>{
      const run=e=>{const r=fn(e);gbTimeout(()=>{if(at.isConnected)nativeRecruitPopover(root,tile,townId,unit,anchor)},90);return r};
      return tile?nativeTileAction(root,townId,tile,'unit',unit,run):nativePanelAction(townId,run);
    };
    const head1=document.createElement('div');head1.className='gb-native-qpop-head';
    const title=document.createElement('span');title.textContent=`${nativeUnitLabel(unit)} \u00b7 ${lane==='recruitNaval'?'Puerto':'Cuartel'}`;
    head1.append(title,nativeQButton('x','Cerrar',()=>nativeQPopClose()));pop.appendChild(head1);
    const rowA=document.createElement('div');rowA.className='gb-native-qpop-row';
    const minus=nativeQButton(`-${step}`,`Restar ${step} de la cola virtual de esta unidad`,act(()=>{if(!nativeQueueRemoveLastRecruit(townId,unit,step))flash('No hay unidades virtuales que quitar')}));
    minus.disabled=!list.some(j=>j&&j.unit===unit&&!j.inflight&&!j.manualReview);
    const count=document.createElement('span');count.className='gb-native-qcount';
    count.textContent=pending<0?(`\u221e${pos?' \u00b7 #'+pos:''}`):(pending>0?`+${pending}${pos?' \u00b7 #'+pos:''}`:'sin cola');
    count.title=head&&head.reason?head.reason:(pending<0?'cola infinita':`${pending||0} pendiente(s)`);
    if(head){if(head.status==='ready')count.classList.add('ready');else if(/blocked|unknown/.test(head.status||''))count.classList.add('blocked');else count.classList.add('waiting')}
    const plus=nativeQButton(`+${step}`,`A\u00f1adir ${step} ${nativeUnitLabel(unit)} a la cola virtual`,act(e=>nativeQueueAddRecruit(townId,unit,(e.ctrlKey||e.metaKey)?step*5:step)));
    rowA.append(minus,count,plus);pop.appendChild(rowA);
    const rowB=document.createElement('div');rowB.className='gb-native-qpop-row';
    const qtyInp=document.createElement('input');qtyInp.type='number';qtyInp.min='1';qtyInp.step=String(step);qtyInp.value=String(nativeRecruitRememberedQty(step));qtyInp.title=`Cantidad a a\u00f1adir (paso ${step}) · recuerda el ultimo valor usado`;qtyInp.className='gb-native-qinp';
    // The popover is rebuilt after every queue action. Persist the custom amount
    // globally so +N keeps the last value instead of snapping back to 1/10.
    qtyInp.addEventListener('change',()=>{qtyInp.value=String(nativeRecruitRememberQty(qtyInp.value,step))});
    const qtyBtn=nativeQButton('+N',`A\u00f1adir N ${nativeUnitLabel(unit)} a la cola virtual (paso ${step})`,act(()=>{const n=nativeRecruitRememberQty(qtyInp.value,step);nativeQueueAddRecruit(townId,unit,n)}));
    rowB.append(qtyInp,qtyBtn);pop.appendChild(rowB);
    const rowC=document.createElement('div');rowC.className='gb-native-qpop-row';
    const totalInp=document.createElement('input');totalInp.type='number';totalInp.min='1';totalInp.step=String(step);totalInp.value=String(step*10);totalInp.title=`Total de unidades a encolar (>${NATIVE_RECRUIT_INF_THRESH} se convierte en \u221e)`;totalInp.className='gb-native-qinp';
    const sep2=document.createElement('span');sep2.textContent='/';sep2.style.color='#666';
    const chunkInp=document.createElement('input');chunkInp.type='number';chunkInp.min='1';chunkInp.step=String(step);chunkInp.value=String(step);chunkInp.title='Tama\u00f1o de cada lote al servidor';chunkInp.className='gb-native-qinp';
    const lotBtn=nativeQButton('+Lote','Encolar el total en lotes del tama\u00f1o indicado; cada env\u00edo se confirma antes de pasar al siguiente, y la fila se quita al agotarse',act(()=>{const r=nativeQueueAddRecruitBatch(townId,unit,+totalInp.value||0,+chunkInp.value||0);if(r&&r.ok)flash(r.infinite?`Cola \u221e encolada: lotes de ${r.chunk}`:`Lote encolado: ${r.total} en ${r.lotes} env\u00edo(s) de ${r.chunk}`);else flash((r&&r.why)||'no se pudo encolar el lote')}));
    const infBtn=nativeQButton('+\u221e',`Encolar \u221e ${nativeUnitLabel(unit)} en lotes del tama\u00f1o indicado; no se agota hasta borrar la fila`,act(()=>{const r=nativeQueueAddRecruitInfinite(townId,unit,+chunkInp.value||step);if(r&&r.ok)flash(`Cola \u221e encolada: lotes de ${r.chunk}`);else flash((r&&r.why)||'no se pudo encolar \u221e')}));
    rowC.append(totalInp,sep2,chunkInp,lotBtn,infBtn);pop.appendChild(rowC);
    if(list.length>=2){
      const rowD=document.createElement('div');rowD.className='gb-native-qpop-row';
      rowD.appendChild(nativeQButton('Compactar','Fusionar entradas adyacentes del mismo tipo en la cola virtual',act(()=>{const n=nativeQueueCompactRecruit(townId,lane);flash(n?`Compactadas ${n} entradas en la cola`:'No hay entradas adyacentes iguales para fusionar')})));
      pop.appendChild(rowD);
    }
    document.body.appendChild(pop);

    try{
      const r=at.getBoundingClientRect(),pr=pop.getBoundingClientRect();
      const vw=gameUw().innerWidth||document.documentElement.clientWidth||1024;
      const vh=gameUw().innerHeight||document.documentElement.clientHeight||768;
      let left=Math.max(4,Math.min(r.left,vw-pr.width-6));
      let top=r.bottom+4;if(top+pr.height>vh-4)top=Math.max(4,r.top-pr.height-4);
      pop.style.left=left+'px';pop.style.top=top+'px';
    }catch(_){pop.style.left='40px';pop.style.top='40px'}
    const ac=new AbortController();
    document.addEventListener('pointerdown',e=>{if(!pop.isConnected||!pop.contains(e.target))nativeQPopClose()},{capture:true,signal:ac.signal});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')nativeQPopClose()},{signal:ac.signal});
    nativeQPopCleanup=()=>ac.abort();
  }
  function nativeMountResearchControl(root,tile,townId,tech) {
    const list=nativeQueueList(townId,'research',false);
    const info=researchTownTechs(townId);
    const done=!!(info&&info.techs&&info.techs[tech]);
    const inReal=!!(info&&(info.orders||[]).some(o=>String(researchOrderTechId(o))===String(tech)));
    const pos=nativeQueuePosition(townId,'research',j=>j&&String(j.tech)===String(tech)),head=pos===1&&list[0];
    const sig=JSON.stringify([townId,tech,pos,done,inReal,head&&head.status,head&&head.reason,list.length]);

    const existing=[...root.querySelectorAll('.gb-native-qctl[data-research]')].filter(c=>c.dataset.research===tech);
    const keep=existing.find(c=>c.dataset.sig===sig);
    for(const c of existing)if(c!==keep)c.remove();
    if(keep)return;
    const ctl=document.createElement('div');ctl.className='gb-native-qctl';ctl.dataset.research=tech;ctl.dataset.sig=sig;

    const anchor=tile.querySelector('.research_name,.research_level,.level');
    ((anchor&&anchor.parentElement)||tile).appendChild(ctl);
    const blockWhy=done?`${nativeResearchLabel(tech)} ya est\u00e1 investigada`:(inReal?`${nativeResearchLabel(tech)} ya est\u00e1 en la cola real`:'');
    if(!pos){
      const plus=nativeQButton('+',`A\u00f1adir ${nativeResearchLabel(tech)} a la cola virtual`,nativeTileAction(root,townId,tile,'research',tech,()=>nativeQueueAddResearch(townId,tech)));
      nativeApplyPlusBlock(plus,blockWhy);
      ctl.append(plus);nativeQctlHitCheck(ctl,tech);return;
    }
    const minus=nativeQButton('-','Quitar esta investigaci\u00f3n de la cola virtual',nativeTileAction(root,townId,tile,'research',tech,()=>{if(!nativeQueueRemoveResearch(townId,tech))flash('No se puede quitar esta investigaci\u00f3n de la cola')}));
    minus.disabled=!list.some(j=>j&&String(j.tech)===String(tech)&&!j.inflight&&!j.manualReview);
    const count=document.createElement('span');count.className='gb-native-qcount';count.textContent=`Cola \u00b7 #${pos}`;
    if(head&&head.reason)count.title=head.reason;
    if(head){if(head.status==='ready')count.classList.add('ready');else if(/blocked|unknown/.test(head.status||''))count.classList.add('blocked');else count.classList.add('waiting')}
    ctl.append(minus,count);nativeQctlHitCheck(ctl,tech);
  }
  const nativeQPanelCollapsed=Object.create(null);
  function nativeLayoutPanels() {
    try{
      const order={build:0,research:1,recruit:2,recruitNaval:3};
      const panels=[...document.querySelectorAll('.gb-native-panel')]
        .sort((a,b)=>(order[a.dataset.lane]==null?9:order[a.dataset.lane])-(order[b.dataset.lane]==null?9:order[b.dataset.lane]));
      if(!panels.length)return;
      const vw=gameUw().innerWidth||document.documentElement.clientWidth||1024;
      const vh=gameUw().innerHeight||document.documentElement.clientHeight||768;
      const gap=8,w=panels[0].offsetWidth||300;

      let base=10;
      const main=document.getElementById('grepbot-panel');
      if(main&&main.getClientRects().length){
        const r=main.getBoundingClientRect();
        if(r.bottom>vh-140&&r.right>vw-(w+20))base=Math.max(10,vw-r.left+8);
      }
      const fit=Math.max(1,Math.floor((vw-base-10+gap)/(w+gap)));
      panels.forEach((p,i)=>{
        if(i<fit){p.style.right=(base+i*(w+gap))+'px';p.style.bottom='10px'}
        else{const k=i-fit+1;p.style.right=(base+k*18)+'px';p.style.bottom=(10+k*18)+'px'}
      });
    }catch(_){}
  }
  function nativeRenderQueuePanel(root,townId,lane,units) {

    let box=document.querySelector(`.gb-native-panel[data-lane="${lane}"][data-town="${townId}"]`);
    if(!box){box=document.createElement('div');box.className='gb-native-panel';box.dataset.lane=lane;box.dataset.town=String(townId);document.body.appendChild(box);box.addEventListener('mousedown',e=>e.stopPropagation());box.addEventListener('click',e=>e.stopPropagation())}

    const list=nativeQueueList(townId,lane,false),frozen=list.some(j=>j&&j.inflight);
    const roster=NATIVE_RECRUIT_LANES.includes(lane)?[...new Set((units||[]).filter(Boolean))]:[];
    const ckey=`${lane}|${townId}`,collapsed=!!nativeQPanelCollapsed[ckey];

    const key=`${lane}|${townId}|${frozen?'F':'-'}|${collapsed?'C':'-'}|`
      +list.map(j=>`${j.id}:${j.inflight?1:0}${j.manualReview?'m':''}`).join(',')
      +'|'+roster.map(u=>`${u}:${nativeQueueRecruitAmount(townId,u)}:${nativeQueuePosition(townId,lane,j=>j&&j.unit===u)||0}`).join(',');
    gbPaint(box,stage=>{
      const head=document.createElement('div');head.className='gb-native-panel-head';const title=document.createElement('span');title.textContent=lane==='build'?'Cola GrepBot \u00b7 Construcci\u00f3n':(lane==='research'?'Cola GrepBot \u00b7 Investigaci\u00f3n':(lane==='recruitNaval'?'Cola GrepBot \u00b7 Puerto':'Cola GrepBot \u00b7 Cuartel'));gbTip(title, 'Cola virtual de GrepBot para esta ciudad y tipo de edificio/unidad');head.appendChild(title);
      const paused=nativeQueuePaused(townId,lane),pause=nativeQButton(paused?'>':'||',paused?'Reanudar esta cola':'Pausar esta cola',nativeTownAction(root,townId,()=>nativeQueueTogglePaused(townId,lane)));head.appendChild(pause);
      if(!list.length&&nativeQueueIsFifo(townId,lane)){const legacy=nativeQButton('Objetivos','Volver al planificador de objetivos',nativeTownAction(root,townId,()=>nativeQueueUseLegacy(townId,lane)));head.appendChild(legacy)}
      if (lane === 'build') {
        const scriptActive = abScriptActive();
        const phase = scriptActive ? abScriptCurrentPhase(townId) : null;
        const scriptLbl = scriptActive ? (phase ? `CS: ${phase.label}` : 'CS: calculando\u2026') : 'Plan CS';
        const scriptBtn = nativeQButton(scriptActive ? '\u23f9' : '\u25b6', scriptActive ? `Detener ${scriptLbl}` : 'Activar plan CS (Senado 24 \u2192 Academia 7 \u2192 Teatro \u2192 Academia 30 \u2192 M\u00e1x)', nativeTownAction(root,townId,() => {
          if (abScriptActive() && !confirm('\u00bfDetener el plan CS y volver a los objetivos compartidos?')) return;
          abScriptToggle();
          try { abScan('manual'); } catch (_) {}
        }));
        scriptBtn.style.color = scriptActive ? '#ffb060' : '#9bd';
        head.appendChild(scriptBtn);
      }
      head.appendChild(nativeQButton(collapsed?'\u25b8':'\u25be',collapsed?'Desplegar este panel':'Plegar este panel',nativePanelAction(townId,()=>{nativeQPanelCollapsed[ckey]=!collapsed;scheduleNativeUiScan()})));
      stage.appendChild(head);
      if(collapsed){
        const sum=document.createElement('div');sum.className='gb-native-panel-sum';
        const pend=list.reduce((n,j)=>{
          if(!j)return n;
          if(nativeQueueRecruitIsInfinite(j))return -1;
          if(n<0)return n;
          return n+(lane==='build'||lane==='research'?1:Math.max(0,+j.amount||0));
        },0);
        sum.textContent=list.length?`${list.length} en cola${pend<0?' \u00b7 \u221e':(pend?` \u00b7 ${pend} unidad(es)`:'')}`:'Cola vac\u00eda';
        stage.appendChild(sum);return;
      }

      if(roster.length){
        const grid=document.createElement('div');grid.className='gb-native-units';
        for(const unit of roster){
          const step=nativeUnitStep(unit),pending=nativeQueueRecruitAmount(townId,unit);
          const pos=nativeQueuePosition(townId,lane,j=>j&&j.unit===unit),uhead=pos===1&&list[0];
          const row=document.createElement('div');row.className='gb-native-unit';row.dataset.unit=unit;
          const name=document.createElement('b');name.textContent=nativeUnitLabel(unit);name.title=nativeUnitLabel(unit);
          const count=document.createElement('span');count.className='gb-native-qcount';
          count.textContent=pending<0?(`\u221e${pos?' \u00b7 #'+pos:''}`):(pending>0?`+${pending}${pos?' \u00b7 #'+pos:''}`:'\u2014');
          count.title=uhead&&uhead.reason?uhead.reason:(pending<0?'cola infinita':`${pending||0} pendiente(s) en la cola virtual`);
          if((pending>0||pending<0)&&uhead){if(uhead.status==='ready')count.classList.add('ready');else if(/blocked|unknown/.test(uhead.status||''))count.classList.add('blocked');else count.classList.add('waiting')}
          const acts=document.createElement('div');acts.className='gb-native-unit-actions';
          const minus=nativeQButton(`-${step}`,`Restar ${step} ${nativeUnitLabel(unit)} de la cola virtual`,nativePanelAction(townId,()=>{if(!nativeQueueRemoveLastRecruit(townId,unit,step))flash('No hay unidades virtuales que quitar')}));
          minus.disabled=!list.some(j=>j&&j.unit===unit&&!j.inflight&&!j.manualReview);
          const plus=nativeQButton(`+${step}`,`A\u00f1adir ${step} ${nativeUnitLabel(unit)} a la cola virtual (Ctrl: \u00d75)`,nativePanelAction(townId,e=>nativeQueueAddRecruit(townId,unit,(e.ctrlKey||e.metaKey)?step*5:step)));

          const more=nativeQButton('\u2026',`M\u00e1s opciones para ${nativeUnitLabel(unit)}: cantidad libre, lote y compactar`,nativePanelAction(townId,()=>nativeRecruitPopover(root,null,townId,unit,row)));
          acts.append(minus,plus,more);
          row.append(name,count,acts);grid.appendChild(row);
        }
        stage.appendChild(grid);
      }
      if(!list.length){const empty=document.createElement('div');empty.className='gb-native-empty';empty.textContent=nativeQueueIsFifo(townId,lane)?'Cola vac\u00eda. Usa los botones + de arriba.':'Usa + para crear una cola FIFO en esta ciudad.';stage.appendChild(empty);return}
      const jobs=document.createElement('div');jobs.className='gb-native-jobs';stage.appendChild(jobs);
      list.forEach((j,i)=>{const row=document.createElement('div');row.className='gb-native-job';const num=document.createElement('b');num.textContent='#'+(i+1);const desc=document.createElement('div');const main=document.createElement('div');main.textContent=lane==='build'?`${nativeBuildLabel(j.building)} ${j.fromLevel}\u2192${j.toLevel}`:(lane==='research'?nativeResearchLabel(j.tech):nativeQueueRecruitAmountText(j));const sub=document.createElement('small');sub.textContent=`${j.status||'pending'}${j.reason?' \u00b7 '+j.reason:''}`;gbTip(sub, 'Estado de la orden virtual + motivo si esta bloqueada');desc.append(main,sub);const acts=document.createElement('div');acts.className='gb-native-job-actions';const top=nativeQButton('\u2191\u2191','Saltar al inicio de la cola',nativePanelAction(townId,()=>nativeQueueMove(townId,lane,j.id,-i)));top.disabled=frozen||i===0;const up=nativeQButton('\u2191','Mover antes',nativePanelAction(townId,()=>nativeQueueMove(townId,lane,j.id,-1)));up.disabled=frozen||i===0;const down=nativeQButton('\u2193','Mover despu\u00e9s',nativePanelAction(townId,()=>nativeQueueMove(townId,lane,j.id,1)));down.disabled=frozen||i===list.length-1;const bot=nativeQButton('\u2193\u2193','Saltar al final de la cola',nativePanelAction(townId,()=>nativeQueueMove(townId,lane,j.id,list.length-1-i)));bot.disabled=frozen||i===list.length-1;const del=nativeQButton('\u00d7','Quitar de la cola virtual',nativePanelAction(townId,()=>{if(j.inflight){flash('Esta orden se est\u00e1 enviando; espera a que termine');return false}if(j.manualReview){let ok=false;try{ok=gameUw().confirm('Comprueba primero la cola real. Borrar este elemento confirma que asumes si la acci\u00f3n se envi\u00f3 o no.')}catch(_){ok=false}if(!ok)return false}else if(frozen){let ok=false;try{ok=gameUw().confirm('Hay otra acci\u00f3n pendiente en esta cola. \u00bfBorrar este elemento de todos modos?')}catch(_){ok=false}if(!ok)return false}return nativeQueueRemove(townId,lane,j.id,{force:true})}));del.disabled=!!j.inflight;acts.append(top,up,down,bot,del);row.append(num,desc,acts);jobs.appendChild(row)});
    },{key});
  }
  function nativeUiScan() {
    if(!gbInstanceAlive()||!document.body)return;nativeEnsureBuildingIds();
    const candidates=[...document.querySelectorAll('.window_content,.gpwindow_content,#unit_order')].filter((x,i,a)=>a.indexOf(x)===i&&!x.closest('#grepbot-panel'));
    const roots=candidates.filter(x=>!candidates.some(y=>y!==x&&y.contains(x)));
    const mountedTowns=new Set();
    for(const root of roots){const townId=nativeWindowTownId(root);if(!townId){
        if(nativeAcademyRoot(root)||root.querySelector(NATIVE_RESEARCH_SEL))gbLogT('native-research-notown',300000,'native ui: academy window open but its town id is unreadable - controls skipped');
        root.querySelectorAll(':scope > .gb-native-panel,.gb-native-qctl').forEach(n=>n.remove());continue}let buildN=0,researchN=0;const mountedBuildIds=new Set(),mountedUnitIds=new Set(),mountedResearchIds=new Set(),mountedUnitLanes=new Set();
      mountedTowns.add(String(townId));
      const senateContext=!!(root.matches('#building_main,.building_main,.senate')||root.querySelector('#building_main,.building_main,[id^="building_main_"],[id^="special_building_"]'));

      const buildTiles=senateContext?[...root.querySelectorAll('[id^="building_main_"],[id^="special_building_"]')]:[];
      for(const tile of buildTiles){if(tile.classList.contains('gb-native-qctl')||tile.closest('.gb-native-qctl,.gb-native-panel'))continue;const id=nativeBuildingId(tile);if(!id||mountedBuildIds.has(id))continue;mountedBuildIds.add(id);nativeMountBuildControl(root,tile,townId,id);buildN++}
      const unitContext=root.matches('#unit_order')?root:root.querySelector('#unit_order');const unitTiles=unitContext?[...unitContext.querySelectorAll('#units .unit_tab,.unit_tab')]:[];

      const unitsByLane={recruit:[],recruitNaval:[]};
      for(const tile of unitTiles){const id=nativeUnitId(tile);if(!id||mountedUnitIds.has(id))continue;mountedUnitIds.add(id);const ulane=nativeRecruitLaneOf(townId,id);mountedUnitLanes.add(ulane);(unitsByLane[ulane]||(unitsByLane[ulane]=[])).push(id);nativeMountRecruitControl(root,tile,townId,id)}

      const researchTiles=[...root.querySelectorAll(nativeResearchTileSel(root))].filter(n=>!n.closest('.gb-native-qctl,.gb-native-panel'));
      const researchOuter=researchTiles.filter(n=>{const id=nativeResearchId(n);return id&&!researchTiles.some(o=>o!==n&&o.contains(n)&&nativeResearchId(o)===id)});
      for(const node of researchOuter){const id=nativeResearchId(node);if(!id||mountedResearchIds.has(id))continue;
        const tile=/^(?:button|a)$/i.test(node.tagName)?(node.parentElement||node):node;
        if(tile.closest('.gb-native-qctl,.gb-native-panel'))continue;
        mountedResearchIds.add(id);nativeMountResearchControl(root,tile,townId,id);researchN++}

      if(!researchN&&nativeAcademyRoot(root)&&(root.querySelector('.tech_tree_box')||researchTiles.length)){
        gbLogT('native-research-zero',300000,
          `native ui: academy root matched ${researchTiles.length} research node(s) but resolved 0 techs `
          +`(attr ${root.querySelectorAll(NATIVE_RESEARCH_SEL).length}, class ${root.querySelectorAll(NATIVE_RESEARCH_SEL_CLASS).length}, `
          +`tech_tree_box ${root.querySelectorAll('.tech_tree_box').length})`);
      }
      root.querySelectorAll('.gb-native-qctl[data-building]').forEach(c=>{if(!mountedBuildIds.has(c.dataset.building))c.remove()});root.querySelectorAll('.gb-native-qctl[data-unit]').forEach(c=>{if(!mountedUnitIds.has(c.dataset.unit))c.remove()});root.querySelectorAll('.gb-native-qctl[data-research]').forEach(c=>{if(!mountedResearchIds.has(c.dataset.research))c.remove()});
      if(buildN)nativeRenderQueuePanel(root,townId,'build');else document.querySelector(`.gb-native-panel[data-lane="build"][data-town="${townId}"]`)?.remove();for(const lane of NATIVE_RECRUIT_LANES){if(mountedUnitLanes.has(lane))nativeRenderQueuePanel(root,townId,lane,unitsByLane[lane]);else document.querySelector(`.gb-native-panel[data-lane="${lane}"][data-town="${townId}"]`)?.remove()}if(researchN)nativeRenderQueuePanel(root,townId,'research');else document.querySelector(`.gb-native-panel[data-lane="research"][data-town="${townId}"]`)?.remove();
    }

    document.querySelectorAll('.gb-native-panel[data-town]').forEach(p => { if (!mountedTowns.has(p.dataset.town)) p.remove(); });

    document.querySelectorAll('.gb-native-qpop[data-town]').forEach(p => { if (!mountedTowns.has(p.dataset.town)) nativeQPopClose(); });

    nativeLayoutPanels();
  }
  function abLoadCsFast() {
    state.abTargets = abDefaultTargets();
    state.abOrder = abDefaultOrder();
    save(STORE.AB_TARGETS, state.abTargets);
    save(STORE.AB_ORDER, state.abOrder);
    gbLog('auto-queue: loaded CS-fast targets + default priority');
    renderAbQueue();
  }
