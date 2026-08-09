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
    if(lane==='build')nativeQueueReconcileBuild(townId);
    const list=nativeQueueList(townId,lane,false);if(list.some(j=>j&&(j.inflight||j.manualReview)))return false;const i=list.findIndex(j=>j&&j.id===jobId);if(i<0)return false;
    const j=Math.max(0,Math.min(list.length-1,i+(+delta||0)));if(i===j)return false;
    const item=list.splice(i,1)[0];list.splice(j,0,item);if(lane==='build')nativeQueueRebaseBuild(townId);nativeQueueSave();return true;
  }
  function nativeQueueRemove(townId,lane,jobId,opts) {
    if(lane==='build')nativeQueueReconcileBuild(townId);
    const list=nativeQueueList(townId,lane,false),i=list.findIndex(j=>j&&j.id===jobId);if(i<0)return false;
    const target=list[i];const force=!(!opts||!opts.force);
    // Target itself is always protected — a post that's actually flying cannot
    // be cancelled from here. The list-wide inflight gate is the lane's own
    // safety net for the *normal* path; the × button bypasses it after a
    // player confirm so a stuck head no longer strands the queued tail.
    if(target.inflight)return false;
    if(!force&&list.some(j=>j&&j.inflight))return false;
    // A lane under review stays frozen, but any individual UNKNOWN item can be
    // removed after the UI asks the player to verify the real game queue.
    if(!force&&list.some(j=>j&&j.manualReview)&&!target.manualReview)return false;
    // Prereq impact check — ALWAYS runs for the build lane. The force flag
    // only bypasses the lane-state gates above (stuck-head escape hatch);
    // it must not be a back door around a missing dependency.
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
  // Simulate the build queue with and without one specific job, then list the
  // jobs QUEUED AFTER it that flip from "prereq met" to "prereq broken" when
  // this job is removed. Buildings that are not queued behind the target are
  // never blockers: an existing building cannot be un-built, and an unqueued
  // one is not a plan.
  // Returns {ok:true} when removal is safe (or uncheckable); otherwise
  // {ok:false, blockers:[{building, requires, has}], target:{building,toLevel}}.
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
      // FIFO walk matching nativeQueueRebaseBuild: each pending entry for a
      // building contributes +1 from the current simulated level. Naive max()
      // over toLevels would skip the chain — e.g. [silver 30→31, silver 31→32]
      // with the first removed would still report silver=32 because the
      // second entry's stored toLevel (32) is taken as already-achieved.
      const sim = Object.assign({}, levels);
      for (let i = 0; i < list.length; i++) {
        if (i === skipIdx) continue;
        const j = list[i];
        if (!j || !AB_BUILDINGS.includes(j.building)) continue;
        if (j.inflight || j.manualReview) {
          // Reconciled/head entries are treated as already at their toLevel —
          // the live queue reflects them regardless of FIFO position.
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
    if (withLvl < T) return { ok: true }; // target was already moot (rebase caught it)
    // Only entries QUEUED BEHIND the target can be broken by this removal.
    // Scanning every AB_BUILDINGS id was wrong twice over: a building already
    // standing in town cannot be un-built by dropping a queued prereq, and a
    // building nobody queued is not a plan at all — so deleting a queue entry
    // and then trying to delete the one in front of it was refused because the
    // just-deleted building "still needs" it.
    const blockers = [], seenDep = new Set();
    for (let i = idx + 1; i < list.length; i++) {
      const j = list[i];
      if (!j || !AB_BUILDINGS.includes(j.building) || seenDep.has(j.building)) continue;
      const req = abRequirementMap(townId, j.building);
      if (!req) continue;
      const need = +req[B] || 0;
      if (!need) continue;
      if (need <= +simWithout[B]) continue; // still satisfied without target
      if (need > withLvl) continue;          // wasn't satisfied even with target
      seenDep.add(j.building);
      blockers.push({ building: j.building, requires: need, has: +simWithout[B] || 0 });
    }
    if (!blockers.length) return { ok: true };
    return { ok: false, blockers, target: { building: B, toLevel: T, withLvl, withoutLvl: +simWithout[B] || 0 } };
  }
  function nativeQueuePrereqWalk(townId, building) {
    // Walk the prerequisite chain for `building`, returning an ordered list of
    // building ids that must be queued in front (deepest dep first). The walk
    // reuses the project's own recursive resolver: each iteration asks for the
    // next unmet dependency of the current target, bumps simulated levels by
    // one, and continues until the target itself is buildable or an error
    // surfaces. Existing queue jobs are folded into the simulated levels so a
    // prereq already covered by the queue is skipped (no duplicates).
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
    // Appending to the TAIL never touches the head, so neither an in-flight
    // send (`gbLocked('ab')`) nor a head awaiting manual review may block it:
    // both gates froze every [+] in the town after the first order went out,
    // and a head stuck in `unknown` froze them until the player cleaned it up.
    // Only the head is ever posted; `nativeQueueRebaseBuild` already treats
    // inflight/manualReview entries as achieved when rebasing the tail.
    nativeQueueReconcileBuild(townId);
    const special=nativeSpecialConflict(townId,building);if(special){flash(`Conflicto con ${nativeBuildLabel(special)}`);return false}
    const baseLevels = abCurrentLevels(townId);
    if (!baseLevels) { flash('No se puede leer el nivel actual'); return false; }
    // Compute the prerequisite chain BEFORE the max check: a building that is
    // not yet buildable (missing deps) is exactly the case the player wants
    // resolved by inserting those deps in front. Only reject on max when the
    // projected level (current + already-queued) is already at the cap.
    const walk = nativeQueuePrereqWalk(townId, building);
    if (walk.error && walk.error !== 'levels-unreadable') {
      // Partial chain is still a valid set of builds (the walk only errors on
      // the LAST unresolved hop). Add what we found, then surface the reason
      // so the player can decide whether to keep or scrub the head.
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
    // Insert prerequisite jobs in front (deepest first). Each push bumps the
    // simulated level so the next chain entry and the requested building
    // reflect the right from/to levels.
    let addedPrereqs = 0;
    for (const dep of walk.chain) {
      const dMax = abMaxLevel(dep);
      const dFrom = +sim[dep] || 0;
      if (dMax == null) continue; // unreadable max; skip rather than block
      if (dFrom >= dMax) continue; // already covered (current or queued)
      town.build.push({
        id: nativeQueueId('b'), kind: 'build', townId: String(townId),
        building: dep, fromLevel: dFrom, toLevel: dFrom + 1,
        status: 'pending', reason: `requisito para ${nativeBuildLabel(building)}`,
        createdAt: Date.now(),
      });
      sim[dep] = dFrom + 1;
      addedPrereqs++;
    }
    // Only queue the requested building if the walk did not end on a hard
    // error; partial prereqs are still pushed above.
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
    // Only the target item itself blocks removal; a stuck head must not freeze
    // the entire queued tail. Items flagged manualReview still need a player
    // decision, so they stay unremovable from this shortcut (use the × button).
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
    // Same as the build lane: only the head is ever posted, so a tail append is
    // safe while an order is in flight or awaiting review.
    const town=nativeQueueTown(townId,true);town.mode.recruit='fifo';town.recruit.push({id:nativeQueueId('u'),kind:'recruit',townId:String(townId),unit:String(unit),amount:n,status:'pending',reason:'',createdAt:Date.now()});
    nativeQueueSave();gbLog(`cola nativa: ${n}× ${nativeUnitLabel(unit)} @${townId}`);gbTimeout(()=>recruitScan('native'),80);return true;
  }
  function nativeQueueRemoveLastRecruit(townId,unit,amount) {
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
    job.status=status;job.reason=r;job.reasonUpdatedAt=now;job.updatedAt=now;save(STORE.NATIVE_QUEUE,nativeQueueRoot());try{scheduleNativeUiScan()}catch(_){}
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
      // Any inflight older than 120s is assumed stuck (bridge timeout, partial
      // apply, server weirdness) — drop the flag so the head stops blocking the
      // queued tail. Drop the `accepted` requirement: posts that error out before
      // the accepted stamp never get a second chance otherwise.
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
  function nativeQueueRecruitHead(townId) {
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
    .gb-native-qctl{position:relative;z-index:2147482000;pointer-events:auto;display:inline-flex;align-items:center;gap:2px;margin:0 0 0 2px;padding:1px 3px;border:1px solid #8a6725;border-radius:4px;background:rgba(31,25,16,.94);color:#f6e3b0;font:10px/1.2 Arial,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.45);vertical-align:middle}
    .gb-native-qbtn{position:relative;z-index:1;pointer-events:auto;min-width:22px;height:20px;padding:0 4px;border:1px solid #9b7938;border-radius:4px;background:linear-gradient(#5b4828,#342814);color:#fff3c7;font:bold 11px Arial,sans-serif;cursor:pointer}
    .gb-native-qbtn:hover{border-color:#e5b94f;color:#fff}.gb-native-qbtn:disabled{opacity:.42;cursor:default}
    .gb-native-qcount{min-width:58px;text-align:center;white-space:nowrap}.gb-native-qcount.ready{color:#91e5a8}.gb-native-qcount.blocked{color:#ffb0a8}.gb-native-qcount.waiting{color:#ffd27a}
    .gb-native-panel{position:fixed;bottom:10px;right:10px;z-index:2147483000;width:320px;max-width:40vw;max-height:48vh;padding:6px;border:1px solid #8a6725;border-radius:6px;background:rgba(34,27,17,.97);color:#f2dfb2;font:11px/1.3 Arial,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.55);overflow:auto}
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
    // With several open windows, only the focused one may inherit Game.townId.
    let focusProven=false;
    try{const mgr=gameUw().GPWindowMgr,w=mgr&&mgr.getFocusedWindow&&mgr.getFocusedWindow(),jq=w&&w.getJQElement&&w.getJQElement(),el=jq&&(jq[0]||jq.get&&jq.get(0));if(el){focusProven=true;if(!(el===root||el.contains(root)||root.contains(el)))return null}}catch(_){}
    if(!focusProven){try{const candidates=[...document.querySelectorAll('.window_content,.gpwindow_content,#unit_order')].filter((x,i,a)=>a.indexOf(x)===i&&!x.closest('#grepbot-panel')&&!x.closest('[hidden]')&&(x.getClientRects?x.getClientRects().length>0:true)),visibleRoots=candidates.filter(x=>!candidates.some(y=>y!==x&&y.contains(x))).filter(isRelevant);if(visibleRoots.length!==1||visibleRoots[0]!==root)return null}catch(_){return null}}
    const current=abCurrentTownId(),id=current==null?null:String(current);return id&&abGetTown(id)?id:null;
  }
  function nativeTownAction(root,townId,onClick) {
    return e=>{if(!gbTabLeader){flash('GrepBot está activo en otra pestaña');return false}const live=nativeWindowTownId(root);if(String(live||'')!==String(townId||'')){flash('La ciudad de esta ventana ha cambiado; vuelve a intentarlo');scheduleNativeUiScan();return false}return onClick&&onClick(e)};
  }
  // The panel lives on document.body, so re-running nativeWindowTownId against
  // the in-window root can return null (focus moved, window rerendered) and
  // swallow every click. Town validity is enforced by nativeUiScan — the panel
  // itself is destroyed when its town is no longer mounted.
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
  // Suffix matchers for every known unit id, longest first so `slinger` cannot
  // win over `attack_slinger`. Built once per GameData.units shape: nativeUiScan
  // runs on an 80ms DOM debounce and calls nativeUnitId per unit tile, so
  // compiling ~35 regexes per tile per scan was the hottest thing in the file.
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
  // Why a [+] must stay disabled. Returns '' when the append is allowed. A
  // silent disabled button is unreadable in-game, so every caller also puts
  // this text on the tooltip.
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
  // z-index only wins inside the nearest stacking context; a game ancestor that
  // creates its own can still bury the control. Detect it instead of guessing:
  // hit-test the button centre and name whatever intercepts the click.
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
    // Strip any stale controls left over by earlier scans before mounting.
    tile.querySelectorAll('.gb-native-qctl[data-building]').forEach(c=>c.remove());
    const list=nativeQueueList(townId,'build',false),frozen=list.some(j=>j&&(j.inflight||j.manualReview)),jobs=list.filter(j=>j&&j.building===building);
    const ctl=document.createElement('div');ctl.className='gb-native-qctl';ctl.dataset.building=building;
    const anchor=tile.querySelector('.level,.building_level,.level_wrapper');(anchor&&anchor.parentElement||tile).appendChild(ctl);
    const projected=nativeQueueProjectedBuildLevel(townId,building),pos=nativeQueuePosition(townId,'build',j=>j&&j.building===building);
    const head=pos===1&&list[0],max=abMaxLevel(building),special=nativeSpecialConflict(townId,building),sig=JSON.stringify([townId,building,projected,pos,frozen,max,special,jobs.map(j=>[j.id,j.toLevel,j.status,j.reason,!!j.inflight,!!j.manualReview])]);if(ctl.dataset.sig===sig)return;ctl.dataset.sig=sig;
    ctl.replaceChildren();
    if(!jobs.length){
      // No virtual job yet - mount only the [+] so the player can start one.
      // No [-] and no label, so the in-game [-][+] stays visible underneath.
      const plus=nativeQButton('+',`Añadir ${nativeBuildLabel(building)} +1 al final de la cola virtual`,nativeTileAction(root,townId,tile,'build',building,()=>nativeQueueAddBuild(townId,building)));
      nativeApplyPlusBlock(plus,nativeBuildPlusBlock(building,projected,max,special));
      ctl.append(plus);nativeQctlHitCheck(ctl,building);return;
    }
    // An inflight/manualReview entry cannot be pulled, but the rest of the tail
    // still can — `nativeQueueRemoveLastBuild` skips the protected ones.
    const minus=nativeQButton('−','Quitar la última mejora virtual',nativeTileAction(root,townId,tile,'build',building,()=>{if(!nativeQueueRemoveLastBuild(townId,building))flash('No hay mejora virtual que quitar')}));minus.disabled=!jobs.some(j=>j&&!j.inflight&&!j.manualReview);
    const count=document.createElement('span');count.className='gb-native-qcount';
    count.textContent=`Plan ${projected}${pos?' · #'+pos:''}`;
    if(head&&head.reason)count.title=head.reason;
    if(head){if(head.status==='ready')count.classList.add('ready');else if(/blocked|unknown/.test(head.status||''))count.classList.add('blocked');else count.classList.add('waiting')}
    const plus=nativeQButton('+',`Añadir ${nativeBuildLabel(building)} +1 al final de la cola`,nativeTileAction(root,townId,tile,'build',building,()=>nativeQueueAddBuild(townId,building)));
    nativeApplyPlusBlock(plus,nativeBuildPlusBlock(building,projected,max,special));
    ctl.append(minus,count,plus);nativeQctlHitCheck(ctl,building);
  }
  function nativeMountRecruitControl(root,tile,townId,unit) {
    tile.querySelectorAll(':scope > .gb-native-qctl[data-unit]').forEach(c=>c.remove());
    const list=nativeQueueList(townId,'recruit',false),frozen=list.some(j=>j&&(j.inflight||j.manualReview)),step=nativeUnitStep(unit),pending=nativeQueueRecruitAmount(townId,unit);
    const ctl=document.createElement('div');ctl.className='gb-native-qctl';ctl.dataset.unit=unit;tile.appendChild(ctl);
    const pos=nativeQueuePosition(townId,'recruit',j=>j&&j.unit===unit),head=pos===1&&list[0];
    const sig=JSON.stringify([townId,unit,step,pending,pos,frozen,head&&head.status,head&&head.reason]);if(ctl.dataset.sig===sig)return;ctl.dataset.sig=sig;
    ctl.replaceChildren();
    if(!(pending>0)){
      // No virtual recruit queued yet - mount only the [+] so the player
      // can start one without obscuring the in-game unit UI underneath.
      const plus=nativeQButton(`+${step}`,`Añadir ${step} ${nativeUnitLabel(unit)} a la cola virtual`,nativeTileAction(root,townId,tile,'unit',unit,e=>nativeQueueAddRecruit(townId,unit,(e.ctrlKey||e.metaKey)?step*5:step)));
      ctl.append(plus);nativeQctlHitCheck(ctl,unit);return;
    }
    const minus=nativeQButton(`−${step}`,`Restar ${step} de la cola virtual de esta unidad`,nativeTileAction(root,townId,tile,'unit',unit,()=>{if(!nativeQueueRemoveLastRecruit(townId,unit,step))flash('No hay unidades virtuales que quitar')}));minus.disabled=!list.some(j=>j&&j.unit===unit&&!j.inflight&&!j.manualReview);
    const count=document.createElement('span');count.className='gb-native-qcount';count.textContent=`+${pending}${pos?' · #'+pos:''}`;count.title=head&&head.reason?head.reason:`${pending} pendiente(s)`;
    if(head){if(head.status==='ready')count.classList.add('ready');else if(/blocked|unknown/.test(head.status||''))count.classList.add('blocked');else count.classList.add('waiting')}
    const plus=nativeQButton(`+${step}`,`Añadir ${step} ${nativeUnitLabel(unit)} a la cola`,nativeTileAction(root,townId,tile,'unit',unit,e=>nativeQueueAddRecruit(townId,unit,(e.ctrlKey||e.metaKey)?step*5:step)));ctl.append(minus,count,plus);nativeQctlHitCheck(ctl,unit);
  }
  function nativeRenderQueuePanel(root,townId,lane) {
    // The panel mounts on document.body (fixed position) so it never sits on top
    // of the in-game queue UI inside the window. Scoped per town window by id.
    let box=document.querySelector(`.gb-native-panel[data-lane="${lane}"][data-town="${townId}"]`);
    if(!box){box=document.createElement('div');box.className='gb-native-panel';box.dataset.lane=lane;box.dataset.town=String(townId);document.body.appendChild(box);box.addEventListener('mousedown',e=>e.stopPropagation());box.addEventListener('click',e=>e.stopPropagation())}
    const oldScroll=box.scrollTop;
    box.replaceChildren();const head=document.createElement('div');head.className='gb-native-panel-head';const title=document.createElement('span');title.textContent=lane==='build'?'Cola GrepBot · Construcción':'Cola GrepBot · Unidades';head.appendChild(title);
    const paused=nativeQueuePaused(townId,lane),pause=nativeQButton(paused?'▶':'⏸',paused?'Reanudar esta cola':'Pausar esta cola',nativeTownAction(root,townId,()=>nativeQueueTogglePaused(townId,lane)));head.appendChild(pause);
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
      // Iterate the unique per-building wrapper only. The Senate renders
      // multiple descendant tiles inside each wrapper that all carry
      // data-building_type=X; iterating them duplicates the control stack.
      const buildTiles=senateContext?[...root.querySelectorAll('[id^="building_main_"],[id^="special_building_"]')]:[];
      for(const tile of buildTiles){if(tile.classList.contains('gb-native-qctl')||tile.closest('.gb-native-qctl,.gb-native-panel'))continue;const id=nativeBuildingId(tile);if(!id||mountedBuildIds.has(id))continue;mountedBuildIds.add(id);nativeMountBuildControl(root,tile,townId,id);buildN++}
      const unitContext=root.matches('#unit_order')?root:root.querySelector('#unit_order');const unitTiles=unitContext?[...unitContext.querySelectorAll('#units .unit_tab,.unit_tab')]:[];
      for(const tile of unitTiles){const id=nativeUnitId(tile);if(!id||mountedUnitIds.has(id))continue;mountedUnitIds.add(id);nativeMountRecruitControl(root,tile,townId,id);unitN++}
      root.querySelectorAll('.gb-native-qctl[data-building]').forEach(c=>{if(!mountedBuildIds.has(c.dataset.building))c.remove()});root.querySelectorAll('.gb-native-qctl[data-unit]').forEach(c=>{if(!mountedUnitIds.has(c.dataset.unit))c.remove()});
      if(buildN)nativeRenderQueuePanel(root,townId,'build');else document.querySelector(`.gb-native-panel[data-lane="build"][data-town="${townId}"]`)?.remove();if(unitN)nativeRenderQueuePanel(root,townId,'recruit');else document.querySelector(`.gb-native-panel[data-lane="recruit"][data-town="${townId}"]`)?.remove();
    }
    // Drop panels whose town window is gone.
    document.querySelectorAll('.gb-native-panel[data-town]').forEach(p => { if (!mountedTowns.has(p.dataset.town)) p.remove(); });
  }
