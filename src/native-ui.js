  // Barracks and docks are two INDEPENDENT queues in the game: a full harbour
  // never blocks a land recruit and vice versa. One shared FIFO lane therefore
  // stalled every land order behind a naval head (and the reverse), so the
  // recruit lane is split in two — `recruit` is the barracks, `recruitNaval`
  // the harbour. Each keeps its own order, its own pause flag and its own mode.
  const NATIVE_QUEUE_LANES=['build','recruit','recruitNaval','research'];
  const NATIVE_RECRUIT_LANES=['recruit','recruitNaval'];
  function nativeUnitIsNaval(unit){return recruitIsNaval(unit)}
  function nativeRecruitLane(unit){return nativeUnitIsNaval(unit)?'recruitNaval':'recruit'}
  // Lane of an ALREADY QUEUED unit. The array a job actually sits in wins over
  // GameData: the unit metadata can be unreadable at render time, and falling
  // back to the land lane there would make a queued trireme invisible.
  function nativeRecruitLaneOf(townId,unit) {
    for(const lane of NATIVE_RECRUIT_LANES)if(nativeQueueList(townId,lane,false).some(j=>j&&j.unit===unit))return lane;
    return nativeRecruitLane(unit);
  }
  function nativeQueueRoot() {
    let q=state.nativeQueue;
    if(!q||typeof q!=='object'||Array.isArray(q))q=state.nativeQueue={version:1,seq:0,towns:{}};
    if(!q.towns||typeof q.towns!=='object'||Array.isArray(q.towns))q.towns={};
    q.version=1;q.seq=Math.max(0,+q.seq||0);
    if(!nativeQueueInflightRestored){nativeQueueInflightRestored=true;let changed=false;for(const town of Object.values(q.towns))for(const lane of NATIVE_QUEUE_LANES)for(const job of ((town&&Array.isArray(town[lane]))?town[lane]:[])){if(job&&job.inflight){if(lane==='build')job.reconcile=Object.assign({},job.inflight);job.inflight=null;job.manualReview=true;job.status='unknown';job.reason='acción en curso al recargar; comprobando la cola real';job.updatedAt=Date.now();changed=true}}if(changed)save(STORE.NATIVE_QUEUE,q)}
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
  // Pre-split storage (and any import) keeps every unit in `recruit`. Move the
  // naval ones across once GameData can classify them — a town whose units do
  // not resolve yet is retried on the next access instead of being marked done,
  // because an unreadable def is "unknown", never "land".
  const nativeRecruitSplitDone=new Set();
  function nativeRecruitSplitTown(t,id) {
    if(nativeRecruitSplitDone.has(id))return;
    const land=t.recruit,naval=t.recruitNaval;let moved=0,blind=false;
    // nativeQueueTown normalizes mode/paused BEFORE calling this, so both fields
    // are always set by the time we get here — the old `== null` guards could
    // never fire and the migrated lane stayed 'legacy', which recruitScan skips.
    // "Only fills empty slots" now keys off the lane actually being empty.
    const navalWasEmpty=naval.length===0;
    for(let i=land.length-1;i>=0;i--){
      const j=land[i];if(!j)continue;
      // Must use recruitIsNaval (NAVAL_MYTHICAL_UNITS), not bare is_naval:
      // hydra often lacks is_naval in GameData and would stay stranded in the
      // barracks lane forever after an import / pre-split storage.
      const d=gbGameDataLookup("units", j.unit);
      if(!d){
        if(recruitIsNaval(j.unit)){land.splice(i,1);naval.unshift(j);moved++}
        else blind=true;
        continue;
      }
      if(recruitIsNaval(j.unit)){land.splice(i,1);naval.unshift(j);moved++}
    }
    if(!blind)nativeRecruitSplitDone.add(id);
    if(moved){
      // A lane split inherits the settings of the lane it split off from; a
      // recruitNaval lane that already held jobs is a deliberate configuration
      // and is left alone.
      if (navalWasEmpty) { t.mode.recruitNaval = t.mode.recruit; t.paused.recruitNaval = !!t.paused.recruit; }
      // Direct save: nativeQueueSave() re-renders, and this runs from inside
      // nativeQueueList, which the renderers themselves call.
      try{save(STORE.NATIVE_QUEUE,nativeQueueRoot())}catch(_){}
      gbLog(`cola nativa: ${moved} orden(es) naval(es) movida(s) a la cola del puerto @${id}`);
    }
  }
  function nativeQueueList(townId,lane,create){const t=nativeQueueTown(townId,create);return t&&Array.isArray(t[lane])?t[lane]:[];}
  // Status churn (a sweep re-labelling 20 jobs 'waiting-resources') used to fire
  // one GM_setValue per job while the render was already coalesced. Debounce the
  // write; anything structural still goes through nativeQueueSave().
  let nativeQueueSaveTimer=0;
  function nativeQueueSaveNow() {
    if(nativeQueueSaveTimer){try{gbClearTimeout(nativeQueueSaveTimer)}catch(_){}nativeQueueSaveTimer=0}
    save(STORE.NATIVE_QUEUE,nativeQueueRoot());
  }
  function nativeQueueSaveSoon() {
    if(nativeQueueSaveTimer)return;
    nativeQueueSaveTimer=gbTimeout(()=>{nativeQueueSaveTimer=0;try{save(STORE.NATIVE_QUEUE,nativeQueueRoot())}catch(_){}},250);
  }
  function nativeQueueSaveFlush(){if(nativeQueueSaveTimer)nativeQueueSaveNow()}
  function nativeQueueSave() {
    nativeQueueSaveNow();
    try{scheduleNativeUiScan()}catch(_){}
    try{renderAbQueue()}catch(_){}
  }
  function nativeQueueId(prefix){const q=nativeQueueRoot();q.seq++;return `${prefix}:${Date.now().toString(36)}:${q.seq.toString(36)}`;}
  function nativeQueueHasPending(lane,townId) {
    if(townId!=null)return nativeQueueList(townId,lane,false).length>0;
    const towns=nativeQueueRoot().towns;return Object.keys(towns).some(id=>nativeQueueList(id,lane,false).length>0);
  }
  // Both recruit lanes at once — every caller that used to ask "is there any
  // unit queued" means barracks OR harbour.
  function nativeRecruitPending(townId){return NATIVE_RECRUIT_LANES.some(l=>nativeQueueHasPending(l,townId));}
  function nativeQueuePaused(townId,lane){const t=nativeQueueTown(townId,false);return !!(t&&t.paused&&t.paused[lane]);}
  function nativeQueueIsFifo(townId,lane){const t=nativeQueueTown(townId,false);return !!(t&&t.mode&&t.mode[lane]==='fifo');}
  function nativeQueueUseLegacy(townId,lane){const t=nativeQueueTown(townId,true);if(t[lane].length)return false;t.mode[lane]='legacy';t.paused[lane]=false;nativeQueueSave();return true;}
  function nativeQueueTogglePaused(townId,lane){const t=nativeQueueTown(townId,true);t.paused[lane]=!t.paused[lane];nativeQueueSave();return t.paused[lane];}
  // One dispatcher instead of a build/else-recruit ternary: adding the research
  // lane to that ternary would have silently reconciled research jobs with the
  // recruit reconciler.
  function nativeQueueReconcile(townId,lane) {
    if(lane==='build')return nativeQueueReconcileBuild(townId);
    if(lane==='research')return nativeQueueReconcileResearch(townId);
    return nativeQueueReconcileRecruit(townId,lane);
  }
  // Periodic reality check across every town and lane. The reconcilers are
  // otherwise only reached when something already touches the lane (an
  // auto-queue sweep, a head post, a UI mutation), so a level the player raised
  // BY HAND in the game window stayed in the virtual plan for as long as those
  // paths stayed idle — with auto-build off, forever. Read-only: each
  // reconciler prunes against the live model and saves only when it changed
  // something, and an unreadable model still means "unknown", never "done".
  function nativeQueueReconcileTown(townId) {
    let changed=false;
    try{if(nativeQueueList(townId,'build',false).length&&nativeQueueReconcileBuild(townId))changed=true}catch(_){}
    try{if(nativeQueueList(townId,'research',false).length&&nativeQueueReconcileResearch(townId))changed=true}catch(_){}
    try{if(nativeRecruitPending(townId)&&nativeQueueReconcileRecruit(townId,null))changed=true}catch(_){}
    return changed;
  }
  let nativeQueueSweepAt=0;
  function nativeQueueSweep(reason) {
    // Wake events and the 60s loop can land in the same second; a manual click
    // is always honoured because it is the player asking for a re-read.
    if(reason!=='manual'&&nativeQueueSweepAt&&Date.now()-nativeQueueSweepAt<5000)return 0;
    const towns=nativeQueueRoot().towns;let n=0;
    for(const id of Object.keys(towns))if(nativeQueueReconcileTown(id))n++;
    nativeQueueSweepAt=Date.now();
    if(n)gbLog(`native queue sweep (${reason||'loop'}): ${n} town(s) reconciled against the real queue`);
    return n;
  }
  function nativeQueueMove(townId,lane,jobId,delta) {
    nativeQueueReconcile(townId,lane);
    const list=nativeQueueList(townId,lane,false);if(list.some(j=>j&&(j.inflight||j.manualReview)))return false;const i=list.findIndex(j=>j&&j.id===jobId);if(i<0)return false;
    const j=Math.max(0,Math.min(list.length-1,i+(+delta||0)));if(i===j)return false;
    const item=list.splice(i,1)[0];list.splice(j,0,item);if(lane==='build')nativeQueueRebaseBuild(townId);nativeQueueSave();return true;
  }
  function nativeQueueRemove(townId,lane,jobId,opts) {
    nativeQueueReconcile(townId,lane);
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

    // Same rule for research: a tech queued behind this one may depend on it.
    if(lane==='research'){
      const impact=nativeQueueResearchRemovalImpact(townId,jobId);
      if(!impact.ok){
        const head=impact.blockers.slice(0,3).map(t=>nativeResearchLabel(t)).join(', ');
        const more=impact.blockers.length>3?` y ${impact.blockers.length-3} más`:'';
        flash(`Bloqueado: ${nativeResearchLabel(impact.target)} es requisito de ${head}${more}`);
        gbLog(`cola nativa: borrado bloqueado — ${impact.blockers.length} investigación(es) dependen de ${impact.target}: `+impact.blockers.join(', '));
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
    if (withLvl < T) return { ok: true };

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
      if (need <= +simWithout[B]) continue;
      if (need > withLvl) continue;
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
  // Fill every remaining level up to the cap in one click. Each iteration
  // re-runs the prereq walk + the same +1 push as nativeQueueAddBuild, so
  // missing deps for the target are added ONCE in front (the walk only walks
  // what is still missing), and subsequent iters push straight +1s. The loop
  // terminates when projected hits max; the explicit max check above the call
  // prevents the per-call "ya está al máximo" flash from firing on the last
  // iteration. Returns the number of jobs added (0 = nothing to do).
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
      if (next == null || next <= projected) break; // safety: no progress
      projected = next;
    }
    if (added) flash(`Encoladas ${added} mejoras de ${nativeBuildLabel(building)} hasta nivel ${projected}`);
    return added;
  }
  // ===== Population rescue ===================================================
  // A build is population-blocked whenever its own population COST exceeds the
  // town's free population — 21 free against a cost of 22 stalls exactly like 0
  // free does, and it blocks every other build behind it too. The farm is the
  // only building that raises free population, so the rescue puts farm levels
  // at the HEAD of the lane and the stalled job resumes on its own instead of
  // sitting in `waiting-population` forever.
  //
  // "First check if farms are already being done" is the whole safety of this:
  // the count is read from the REAL game build queue *and* the virtual lane,
  // and an unreadable real queue is UNKNOWN, never "nothing queued" — queueing
  // a third farm on top of two that are already building is exactly the
  // failure this check exists to prevent.
  const POP_RESCUE_FARM_LEVELS = 2;
  function nativeFarmPendingLevels(townId) {
    const q = abQueueInfo(townId);
    if (!q || !q.known) return null;
    let n = 0;
    for (const o of (q.orders || [])) if (o && o.building_type === 'farm' && !o.tear_down) n++;
    for (const j of nativeQueueList(townId, 'build', false)) if (j && j.building === 'farm') n++;
    return n;
  }
  // How many farm levels the rescue may still add: 0 = nothing to do (already
  // building, suppressed, maxed, disabled), null-ish reads also collapse to 0
  // after logging, so a blind town never gets a blind post.
  function nativePopRescueRoom(townId, levels) {
    if (!state.popRescueFarm) return 0;
    if (!levels) return 0;
    if (goalQueueSuppressed(townId, 'build', 'farm')) return 0;
    const max = abMaxLevel('farm');
    if (max == null) { gbLogT('pop-rescue-max', 300000, 'pop rescue: farm max level unreadable - no farm queued'); return 0; }
    const pending = nativeFarmPendingLevels(townId);
    if (pending == null) { gbLogT('pop-rescue-blind-' + townId, 300000, `pop rescue: real build queue unreadable @${townId} - not queueing farm blind`); return 0; }
    if (pending >= POP_RESCUE_FARM_LEVELS) return 0;
    // abCurrentLevels already folds the real build queue in, so this is the
    // PROJECTED farm level, not the standing one.
    const projected = +(levels.farm || 0);
    if (projected >= max) {
      gbLogT('pop-rescue-maxed-' + townId, 600000, `pop rescue: farm already at max (${max}) @${townId} - population cannot be raised by building`);
      return 0;
    }
    return Math.max(0, Math.min(POP_RESCUE_FARM_LEVELS - pending, max - projected));
  }
  // Returns the number of farm jobs inserted (0 = nothing done). Works in both
  // lane modes: the jobs are pushed WITHOUT flipping `mode.build` to 'fifo',
  // because an empty fifo lane would then own the lane forever and the legacy
  // goal planner would never pick again.
  function nativePopRescueFifo(townId, levels, aff) {
    const room = nativePopRescueRoom(townId, levels);
    if (!room) return 0;
    const list = nativeQueueList(townId, 'build', false);

    // Same rule nativeQueueMove enforces: never reorder around a post that is
    // already flying or a head waiting on a manual decision.
    if (list.some(j => j && (j.inflight || j.manualReview))) return 0;
    const town = nativeQueueTown(townId, true);

    // Only shown, never used as a gate: an unreadable aff still queues the farm
    // (the caller already established the shortfall) with a plainer reason.
    const short = aff && aff.need && aff.have
      ? `población ${Math.floor(+aff.have.population || 0)}/${Math.ceil(+aff.need.pop || 0)}`
      : 'población insuficiente';
    const jobs = [];
    for (let i = 0; i < room; i++) jobs.push({
      id: nativeQueueId('b'), kind: 'build', townId: String(townId),
      building: 'farm', fromLevel: 0, toLevel: 0,
      status: 'pending', reason: `${short}; granja antes de continuar`,
      createdAt: Date.now(),
    });
    town.build.unshift(...jobs);

    // Levels are placeholders above on purpose: the rebase is the one place
    // that knows the projected level of every job in the lane.
    nativeQueueRebaseBuild(townId);
    nativeQueueSave();
    gbLog(`cola nativa: ${short} @${townId} — ${room} nivel(es) de granja al principio de la cola`);

    // Deliberately not 80ms like the manual [+]: this fires from inside an
    // abScan sweep that still holds the 'ab' lock, and a re-entry would no-op.
    gbTimeout(() => abScan('pop-rescue'), 1500);
    return room;
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
    try{const d=gbGameDataLookup("units", unit)||{};const pop=+d.population||0,freight=+(d.favor??(d.resources&&d.resources.favor))||0;if(d.is_naval||d.naval||d.mythical||d.is_mythical||d.god||pop>=8||freight>0)return 1}catch(_){}
    return 10;
  }
  // Summed over BOTH lanes on purpose: a unit id belongs to exactly one lane,
  // so the total is exact and stays right even when the def cannot be read.
  function nativeQueueRecruitAmount(townId,unit){return NATIVE_RECRUIT_LANES.reduce((n,lane)=>n+nativeQueueList(townId,lane,false).reduce((m,j)=>m+(j&&j.unit===unit?(+j.amount||0):0),0),0);}
  function nativeQueueAddRecruit(townId,unit,amount,chunkSize) {
    const n=Math.max(1,Math.floor(+amount||0));if(!unit||!gbGameDataLookup("units", unit)||!(n>0))return false;

    // Same as the build lane: only the head is ever posted, so a tail append is
    // safe while an order is in flight or awaiting review.
    const lane=nativeRecruitLane(unit);
    const town=nativeQueueTown(townId,true);

    // Same as the build (:mode.build) and research (:mode.research) lanes: a
    // manual [+] puts the lane in FIFO. The old `== null` guard could never fire
    // — nativeQueueTown normalizes every lane to 'legacy' first — so the job
    // landed in the virtual list while recruitScan, which only walks FIFO lanes,
    // skipped it forever. Use "Cola automática" to hand the lane back.
    town.mode[lane] = 'fifo';
    const job={id:nativeQueueId('u'),kind:'recruit',townId:String(townId),unit:String(unit),amount:n,status:'pending',reason:'',createdAt:Date.now()};

    const cs=Math.max(0,Math.floor(+chunkSize||0));
    if(cs>0&&cs<n)job.chunkSize=cs;
    town[lane].push(job);
    nativeQueueSave();
    const label=`cola nativa (${lane==='recruitNaval'?'puerto':'cuartel'}): ${n}× ${nativeUnitLabel(unit)} @${townId}`;
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
      cur.amount=Math.max(0,(+cur.amount||0))+(+next.amount||0);
      cur.updatedAt=Date.now();
      list.splice(i,1);merged++;
    }
    if(merged){
      nativeQueueSave();
      try{scheduleNativeUiScan()}catch(_){}
      gbLog(`cola nativa (${lane==='recruitNaval'?'puerto':'cuartel'}): compactadas ${merged} entrada(s) adyacente(s) en @${townId}`);
    }
    return merged;
  }
  function nativeQueueAddRecruitBatch(townId,unit,total,chunk) {
    const T=Math.floor(+total||0),C=Math.floor(+chunk||0);
    if(!unit||!gbGameDataLookup("units", unit))return {ok:false,why:'unidad desconocida'};
    if(!(T>0))return {ok:false,why:'total debe ser > 0'};
    if(!(C>0))return {ok:false,why:'lote debe ser > 0'};
    if(C>T)return {ok:false,why:'lote no puede ser mayor que el total'};
    const lane=nativeRecruitLane(unit);
    const town=nativeQueueTown(townId,true);
    town.mode[lane]='fifo';
    const job={id:nativeQueueId('u'),kind:'recruit',townId:String(townId),unit:String(unit),amount:T,chunkSize:C,status:'pending',reason:`${Math.ceil(T/C)} × ${C}`,createdAt:Date.now()};
    town[lane].push(job);
    nativeQueueSave();
    gbLog(`cola nativa (${lane==='recruitNaval'?'puerto':'cuartel'}): lote ${T}× ${nativeUnitLabel(unit)} en ${Math.ceil(T/C)} envío(s) de ${C} @${townId}`);
    gbTimeout(()=>recruitScan('native'),80);
    return {ok:true,lane,jobId:job.id,total:T,lotes:Math.ceil(T/C),chunk:C};
  }
  function nativeQueueRemoveLastRecruit(townId,unit,amount) {
    const lane=nativeRecruitLaneOf(townId,unit);
    nativeQueueReconcileRecruit(townId,lane);
    const list=nativeQueueList(townId,lane,false);const step=Math.max(1,Math.floor(+amount||nativeUnitStep(unit)));for(let i=list.length-1;i>=0;i--){const job=list[i];if(job&&job.unit===unit&&!job.inflight&&!job.manualReview){job.amount=Math.max(0,(+job.amount||0)-step);if(!job.amount)list.splice(i,1);else{job.status='pending';job.reason='';job.updatedAt=Date.now()}nativeQueueSave();return true}}
    return false;
  }
  function nativeQueueSetJobState(job,status,reason) {
    if(!job)return;const r=String(reason||''),now=Date.now();
    if(job.status===status&&job.reason===r)return;
    if(job.status===status&&/^waiting-(?:resources|population)$/.test(status||'')){
      const stable=x=>String(x||'').replace(/\d+(?:[.,]\d+)?/g,'#');
      if(stable(job.reason)===stable(r)&&now-(+job.reasonUpdatedAt||+job.updatedAt||0)<300000)return;
    }
    job.status=status;job.reason=r;job.reasonUpdatedAt=now;job.updatedAt=now;nativeQueueSaveSoon();try{scheduleNativeUiScan()}catch(_){}
  }
  // ===== Build queue optimizer (v4 plan 5.6) =================================
  // A FIFO head that cannot be paid for stalls every job behind it. This offers
  // to promote the first successor that IS affordable - as a suggestion the
  // user clicks, never an automatic reorder. The auto-queue is untouched: it
  // keeps taking the head, whichever head the user has left there.
  const BUILD_SWAP_DEFAULT_MIN = 5;
  const BUILD_SWAP_IGNORE_MS = 600000;
  function buildSwapThresholdMs() {
    const n = +state.buildSwapThresholdMin;
    if (n === 0) return 0;
    return (Number.isFinite(n) ? Math.max(1, Math.min(120, n)) : BUILD_SWAP_DEFAULT_MIN) * 60000;
  }
  // {townId, jobId, why, forMinutes} or null. Only a head that is BLOCKED on
  // something readable counts - a head that is merely pending is not stuck.
  function nativeQueueHeadBlockedFor(townId) {
    const list = nativeQueueList(townId, 'build', false);
    const head = list[0];
    if (!head) return null;
    if (head.inflight || head.manualReview) return null;
    if (!/^waiting-(?:resources|population)$/.test(String(head.status || ''))) return null;
    const since = +head.reasonUpdatedAt || +head.updatedAt || 0;
    if (!since) return null;
    // `building` is carried on the result so the renderer does not have to
    // re-read list[0] and hope nothing moved in between.
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
    // A frozen queue is not reorderable at all - nativeQueueMove would refuse
    // anyway, so do not offer a button that cannot work.
    if (list.some(j => j && (j.inflight || j.manualReview))) return null;
    const levels = abCurrentLevels(townId);
    if (!levels) return null;
    for (let i = 1; i < list.length; i++) {
      const j = list[i];
      if (!j || !j.building) continue;
      const dep = abResolvePrerequisite(townId, j.building, levels);
      // Only promote a job that is ITSELF the next step - promoting one whose
      // own prerequisite is missing just moves the stall up the queue.
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
    const job=nativeQueueList(townId,'build',false)[0];if(!job||job.id!==jobId)return false;const o=opts||{};
    if(Object.prototype.hasOwnProperty.call(o,'inflight')){job.inflight=o.inflight;if(o.inflight)job.reconcile=null}
    if(Object.prototype.hasOwnProperty.call(o,'reconcile'))job.reconcile=o.reconcile;
    if(Object.prototype.hasOwnProperty.call(o,'manualReview'))job.manualReview=!!o.manualReview;
    if(o.status)job.status=o.status;if(Object.prototype.hasOwnProperty.call(o,'reason'))job.reason=String(o.reason||'');job.updatedAt=Date.now();nativeQueueSave();return true;
  }
  function nativeQueueReconcileBuild(townId) {

    // Log-only: makes a long stall visible in the Log for someone who never
    // opens the in-game building windows.
    try {
      const sug = nativeQueueSuggestSwap(townId);
      if (sug) gbLogT('build-swap-' + townId, 600000,
        `build queue: town ${townId} head stalled ${sug.head.forMinutes}min (${sug.head.why}) - ${sug.successor.building} is affordable`);
    } catch (_) {}
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
    if(!aff.ok){const why=aff.why||'recursos',detail=abAffordReason(aff),status=why==='resources'?'waiting-resources':(why==='population'?'waiting-population':'blocked');nativeQueueSetJobState(job,status,detail);

      // Population is the one block the queue can clear by itself. Keyed off
      // aff.popShort, not `why`: when wood AND population are both short the
      // verdict reads 'resources', and waiting for the wood first would only
      // land on the same population wall a cadence later.
      if(aff.popShort&&resolved.building!=='farm')nativePopRescueFifo(townId,levels,aff);
      return {hasJob:true,plan:null,why}}
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
  // Recruit counterpart of nativeQueueReconcileBuild's stuck-inflight rule. The
  // recruit head's `inflight` was only ever cleared by its own bridge callback,
  // so a dropped callback (superseded tx, transport never settling) froze the
  // whole lane until a page reload. A boolean nobody can clear is exactly what
  // the v1.4.0 lock registry note warns about.
  function nativeQueueReconcileRecruit(townId,lane) {
    const lanes=lane?[lane]:NATIVE_RECRUIT_LANES;let changed=false;

    // Real-queue confirmation, the half the build (:491) and research (:680)
    // reconcilers already had. `queuedBefore` is the baseline this unit's queued
    // count had when the post left, so reaching baseline+amount proves OUR batch
    // landed — a dropped bridge callback no longer strands the head for 120s.
    // An unreadable queue (known:false) stays UNKNOWN and confirms nothing.
    let queueKnown=false;
    try{queueKnown=!!(recruitQueueInfo(townId)||{}).known}catch(_){}
    for(const ln of lanes){
      const list=nativeQueueList(townId,ln,false);if(!list.length)continue;
      const head=list[0];
      for(const j of list){
        if(!j||!j.inflight)continue;
        const fl=j.inflight;
        if(queueKnown&&j===head&&fl.token&&fl.queuedBefore!=null&&j.unit){
          let now=null;
          try{now=recruitQueuedAmount(townId,j.unit)}catch(_){now=null}
          if(now!=null&&now>=(+fl.queuedBefore||0)+(+fl.amount||0)){
            nativeQueueRecruitApplied(townId,ln,j.id,+fl.amount||0,fl.token);
            changed=true;continue;
          }
        }
        if(Date.now()-(+fl.at||0)>120000){j.inflight=null;j.manualReview=true;j.status='unknown';j.reason='la cola real no se actualizó; comprobar antes de continuar';j.updatedAt=Date.now();changed=true}
      }
    }
    if(changed)nativeQueueSave();return changed;
  }
  function nativeQueueRecruitHead(townId,lane) {
    lane=lane||'recruit';
    nativeQueueReconcileRecruit(townId,lane);
    const list=nativeQueueList(townId,lane,false),job=list[0];if(!job)return null;
    if(nativeQueuePaused(townId,lane)){nativeQueueSetJobState(job,'paused','cola pausada');return null}
    if(list.some(j=>j&&j!==job&&(j.manualReview||j.inflight))){nativeQueueSetJobState(job,'blocked','hay otra acción pendiente de revisión');return null}
    if(job.manualReview){nativeQueueSetJobState(job,'unknown',job.reason||'comprobar la cola real y quitar este trabajo si no se envió');return null}
    if(job.inflight){nativeQueueSetJobState(job,'sending',job.reason||'enviando a la cola real');return null}
    return job;
  }
  function nativeQueueRecruitApplied(townId,lane,jobId,amount,token) {
    const list=nativeQueueList(townId,lane||'recruit',false),job=list[0];if(!job||job.id!==jobId)return;

    // The inflight token is the idempotency key. Both the bridge callback and
    // nativeQueueReconcileRecruit can reach this for the same batch; applying it
    // twice would eat units the game never recruited.
    if(token&&!(job.inflight&&job.inflight.token===token))return;
    const drained=Math.max(0,+amount||0);
    job.inflight=null;job.amount=Math.max(0,(+job.amount||0)-drained);
    const removed=job.amount<=0;
    if(removed)list.shift();else{job.status='pending';job.reason='resto del lote';job.updatedAt=Date.now()}
    nativeQueueSave();

    try { jrnPush({ f:'recruit', a:'chunk-drain', k:String(townId)+'|'+String(job.unit||'')+'|'+jobId }, removed ? 'ok' : 'ok', removed ? 'drained' : ('rest '+job.amount)); } catch (_) {}
  }
  // ---------------------------------------------------------------------------
  // Research lane (academy). Same contract as build/recruit: only the head is
  // ever posted, appends are always safe, and the real queue is the authority —
  // a job leaves the virtual list once the game shows it researched or queued.
  // ---------------------------------------------------------------------------
  function nativeResearchLabel(tech) {
    try{const n=researchLabel(tech);if(n)return String(n)}catch(_){}
    return String(tech||'?');
  }
  // Returns null when GameData does not describe this tech: unreadable is NOT
  // "no dependencies", so callers must treat null as unknown and not silently
  // queue a tech whose prerequisites they never saw.
  function nativeResearchDeps(tech) {
    try{
      const def=uwCached().GameData&&uwCached().GameData.researches&&uwCached().GameData.researches[tech];
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
  // Ordered list of techs that must be researched before `tech` (deepest first),
  // skipping anything already researched, already in the real queue, or already
  // in the virtual list.
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
    tech=String(tech||'');
    if(!tech||!gbGameDataLookup("researches", tech)){flash('Investigación desconocida');return false}
    nativeQueueReconcileResearch(townId);
    const info=researchTownTechs(townId);
    if(!info){flash('No se puede leer la Academia');return false}
    if(info.techs&&info.techs[tech]){flash(`${nativeResearchLabel(tech)} ya está investigada`);return false}
    if((info.orders||[]).some(o=>String(researchOrderTechId(o))===tech)){flash(`${nativeResearchLabel(tech)} ya está en la cola real`);return false}
    if(nativeQueueResearchPending(townId,tech)){flash(`${nativeResearchLabel(tech)} ya está en la cola virtual`);return false}
    const walk=nativeResearchPrereqChain(townId,tech);

    // Same refusal as nativeQueueAddBuild (:330): an unresolved prerequisite
    // chain must not put the target at the lane head, where it would sit
    // 'blocked' forever behind a requirement nobody queued. Partial prereqs are
    // still pushed — they are valid research on their own.
    if(walk.error&&!walk.chain.length){flash(`Requisitos no resolubles: ${walk.error}`);return false}
    const town=nativeQueueTown(townId,true);town.mode.research='fifo';
    const push=(id,reason)=>town.research.push({id:nativeQueueId('r'),kind:'research',townId:String(townId),tech:String(id),status:'pending',reason:reason||'',createdAt:Date.now()});
    let added=0;
    for(const dep of walk.chain){if(!gbGameDataLookup("researches", dep))continue;push(dep,`requisito para ${nativeResearchLabel(tech)}`);added++}
    if(!walk.error)push(tech,'');
    nativeQueueSave();
    if(walk.error){
      gbLogT('native-research-walk-'+tech,300000,`native queue: research prereq walk for ${tech} incomplete (${walk.error})`);
      flash(`${added} requisito(s) añadidos; el objetivo final no se puede resolver: ${walk.error}`);
    }
    else if(added)flash(`+${added} requisito(s) antes de ${nativeResearchLabel(tech)}`);
    gbLog(`cola nativa: investigación ${walk.error?`(solo requisitos, ${walk.error}) `:''}${tech}${added?` + ${added} requisito(s) [${walk.chain.join(', ')}]`:''} @${townId}`);
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

    // The real-queue half of this check is only usable when the queue was
    // actually read (H4). For a town whose ResearchOrder fragment is missing,
    // `orders` is [] and every job would look "not landed" — or, on the prune
    // side, a landed job would never be dropped. Researched flags are readable
    // either way, so they still count.
    const ordersUsable=!!(info&&info.ordersKnown);
    const landed=j=>!!(info&&((info.techs&&info.techs[j.tech])||(ordersUsable&&(info.orders||[]).some(o=>String(researchOrderTechId(o))===String(j.tech)))));
    for(const j of list){
      if(!j||!j.inflight)continue;
      if(landed(j)){j.inflight=null;j.manualReview=false;j.status='pending';j.reason='confirmado en la cola real';j.updatedAt=Date.now();changed=true;continue}

      if(Date.now()-(+j.inflight.at||0)>120000){j.inflight=null;j.manualReview=true;j.status='unknown';j.reason='la cola real no se actualizó; comprobar antes de continuar';j.updatedAt=Date.now();changed=true}
    }

    // Only prune against a READ state — an unreadable academy means unknown, so
    // nothing is dropped.
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
  function nativeQueueResearchHead(townId) {
    nativeQueueReconcileResearch(townId);
    const list=nativeQueueList(townId,'research',false),job=list[0];if(!job)return null;
    if(nativeQueuePaused(townId,'research')){nativeQueueSetJobState(job,'paused','cola pausada');return null}
    if(list.some(j=>j&&j!==job&&(j.manualReview||j.inflight))){nativeQueueSetJobState(job,'blocked','hay otra acción pendiente de revisión');return null}
    if(job.manualReview){nativeQueueSetJobState(job,'unknown',job.reason||'comprobar la cola real y quitar este trabajo si no se envió');return null}
    if(job.inflight){nativeQueueSetJobState(job,'sending',job.reason||'enviando a la cola real');return null}
    return job;
  }
  function nativeQueueResearchApplied(townId,jobId) {
    const list=nativeQueueList(townId,'research',false),job=list[0];if(!job||job.id!==jobId)return;
    list.shift();nativeQueueSave();
  }

  gbAddStyle('native-ui', `
    /* The senate tile stacks absolutely-positioned overlays (building caption,
       level badge, hover hitbox) on top of its content. A statically-positioned
       control paints UNDER all of them, so the caption text swallowed the click
       even though the button looked reachable. position+z-index puts it on top
       of its stacking context and makes hit-testing land on the button. */
    .gb-native-qctl{position:relative;z-index:2147482000;pointer-events:auto;display:inline-flex;align-items:center;gap:2px;margin:0 0 0 2px;padding:1px 3px;border:1px solid #8a6725;border-radius:4px;background:rgba(31,25,16,.94);color:#f6e3b0;font:10px/1.2 Arial,sans-serif,"Segoe UI Symbol","Noto Sans Symbols 2","DejaVu Sans";box-shadow:0 1px 3px rgba(0,0,0,.45);vertical-align:middle}
    /* Shared style for the batched-input fields used by the recruit popover
       and the in-window native recruit tile (+Lote row, +N, etc.). */
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
    // C3: a window that carries several distinct town ids (a town selector, a
    // trade/support widget) used to abort the whole root, which removes every
    // control and the panel with it — "no panel at all". When the currently
    // open town is one of the candidates and this root is the focused window,
    // that is the town the window is acting on.
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
    // With several open windows, only the focused one may inherit Game.townId.
    let focusProven=false;
    try{const mgr=gameUw().GPWindowMgr,w=mgr&&mgr.getFocusedWindow&&mgr.getFocusedWindow(),jq=w&&w.getJQElement&&w.getJQElement(),el=jq&&(jq[0]||jq.get&&jq.get(0));if(el){focusProven=true;if(!(el===root||el.contains(root)||root.contains(el)))return null}}catch(_){}
    if(!focusProven){try{const candidates=[...document.querySelectorAll('.window_content,.gpwindow_content,#unit_order')].filter((x,i,a)=>a.indexOf(x)===i&&!x.closest('#grepbot-panel')&&!x.closest('[hidden]')&&(x.getClientRects?x.getClientRects().length>0:true)),visibleRoots=candidates.filter(x=>!candidates.some(y=>y!==x&&y.contains(x))).filter(isRelevant);if(visibleRoots.length!==1||visibleRoots[0]!==root){if(visibleRoots.length>=2){const focused=document.activeElement;let pick=null;for(const r of visibleRoots){if(r===focused||(focused&&r.contains(focused)))pick=r;if(pick)break}if(!pick)pick=visibleRoots[0];if(pick!==root)return null}else return null}}catch(_){return null}}
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
    return nativeTownAction(root,townId,e=>{const live=kind==='build'?nativeBuildingId(tile):(kind==='research'?nativeResearchId(tile):nativeUnitId(tile));if(String(live||'')!==String(id||'')){flash('Este elemento de la ventana ha cambiado; vuelve a intentarlo');scheduleNativeUiScan();return false}return onClick&&onClick(e)});
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
    const ids=new Set();for(const id of vals)if(gbGameDataLookup("units", id))ids.add(id);const matchers=nativeUnitMatchers();for(const raw of vals)for(const m of matchers)if(m.re.test(raw))ids.add(m.id);return ids.size===1?[...ids][0]:null;
  }
  // The academy tech tree keys every entry off data-research_id (the game's own
  // `.tech_tree_box .button_upgrade[data-research_id=…]` selector); the dashed
  // and _type spellings are accepted because client builds have used both.
  const NATIVE_RESEARCH_SEL='[data-research_id],[data-research-id],[data-research_type],[data-research-type]';
  // C1 fallback. The tech tree template is server-rendered and absent from every
  // capture, so the attribute's presence cannot be proven offline — and jQuery
  // `.data()` (which the game's click handler uses) reads its own store BEFORE
  // the attribute, so a template that sets the value in JS leaves no attribute
  // to match. These class hooks are what the game itself binds (`.btn_upgrade`)
  // and what its user guide targets (`.button_upgrade` / `.research_icon`).
  // A node only becomes a tile if nativeResearchId resolves a real GameData
  // tech from it — an unresolvable node is skipped, never guessed.
  const NATIVE_RESEARCH_SEL_CLASS='.btn_upgrade,.button_upgrade,.research_icon';
  const NATIVE_RESEARCH_SEL_ALL=NATIVE_RESEARCH_SEL+','+NATIVE_RESEARCH_SEL_CLASS;
  // C3: those class hooks are NOT academy-exclusive. The capture has
  // `.js-window-main-container classic_window farm_town` shipping
  // `.farm_town .btn_upgrade` (rural village upgrade), and the construction
  // queue's `getIconType()` returns `research_icon research40x40` for a running
  // research. Both matched NATIVE_RESEARCH_SEL_CLASS in windows with no academy
  // in them, resolved no tech, and fired the "academy root matched N research
  // node(s) but resolved 0 techs" warning. Only widen to the class fallback
  // inside a root that is provably the academy; the attribute selector stays
  // global because data-research_id is unambiguous on its own.
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
  // C2: the value on the tile need not be the GameData key — a numeric id or a
  // differing research_type spelling yields null for every tile and the whole
  // lane silently disappears. Map through GameData.researches' own id fields
  // instead of relaxing the gate to "anything string-shaped".
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
  // GameDataResearches.getResearchCssClass(e) returns the tech key, with `_old`
  // (take_over on old command worlds) or `_bpv` (booty) appended.
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
    const list=nativeQueueList(townId,'build',false),frozen=list.some(j=>j&&(j.inflight||j.manualReview)),jobs=list.filter(j=>j&&j.building===building);
    const projected=nativeQueueProjectedBuildLevel(townId,building),pos=nativeQueuePosition(townId,'build',j=>j&&j.building===building);
    const head=pos===1&&list[0],max=abMaxLevel(building),special=nativeSpecialConflict(townId,building),sig=JSON.stringify([townId,building,projected,pos,frozen,max,special,jobs.map(j=>[j.id,j.toLevel,j.status,j.reason,!!j.inflight,!!j.manualReview])]);

    // The signature has to be read off the control that is ALREADY mounted. The
    // old order removed every control first and then compared the signature of a
    // freshly created node, which can never match - so every 80ms scan rebuilt
    // the whole control stack. Keep the matching node, strip the rest.
    const existing=[...tile.querySelectorAll('.gb-native-qctl[data-building]')];
    const keep=existing.find(c=>c.dataset.building===building&&c.dataset.sig===sig);
    for(const c of existing)if(c!==keep)c.remove();
    if(keep)return;
    const ctl=document.createElement('div');ctl.className='gb-native-qctl';ctl.dataset.building=building;ctl.dataset.sig=sig;
    const anchor=tile.querySelector('.level,.building_level,.level_wrapper');(anchor&&anchor.parentElement||tile).appendChild(ctl);
    if(!jobs.length){

      const plus=nativeQButton('+',`Añadir ${nativeBuildLabel(building)} +1 al final de la cola virtual`,nativeTileAction(root,townId,tile,'build',building,()=>nativeQueueAddBuild(townId,building)));
      const fill=nativeQButton('++',`Encolar ${nativeBuildLabel(building)} desde el nivel ${projected} hasta el máximo (${max})`,nativeTileAction(root,townId,tile,'build',building,()=>nativeQueueFillToMax(townId,building)));
      nativeApplyPlusBlock(plus,nativeBuildPlusBlock(building,projected,max,special));
      nativeApplyPlusBlock(fill,nativeBuildPlusBlock(building,projected,max,special));
      ctl.append(plus,fill);nativeQctlHitCheck(ctl,building);return;
    }

    const minus=nativeQButton('-','Quitar la última mejora virtual',nativeTileAction(root,townId,tile,'build',building,()=>{if(!nativeQueueRemoveLastBuild(townId,building))flash('No hay mejora virtual que quitar')}));minus.disabled=!jobs.some(j=>j&&!j.inflight&&!j.manualReview);
    const count=document.createElement('span');count.className='gb-native-qcount';
    count.textContent=`Plan ${projected}${pos?' · #'+pos:''}`;
    if(head&&head.reason)count.title=head.reason;
    if(head){if(head.status==='ready')count.classList.add('ready');else if(/blocked|unknown/.test(head.status||''))count.classList.add('blocked');else count.classList.add('waiting')}
    const plus=nativeQButton('+',`Añadir ${nativeBuildLabel(building)} +1 al final de la cola`,nativeTileAction(root,townId,tile,'build',building,()=>nativeQueueAddBuild(townId,building)));
    const fill=nativeQButton('++',`Encolar ${nativeBuildLabel(building)} desde el nivel ${projected} hasta el máximo (${max})`,nativeTileAction(root,townId,tile,'build',building,()=>nativeQueueFillToMax(townId,building)));
    nativeApplyPlusBlock(plus,nativeBuildPlusBlock(building,projected,max,special));
    nativeApplyPlusBlock(fill,nativeBuildPlusBlock(building,projected,max,special));
    ctl.append(minus,count,plus,fill);nativeQctlHitCheck(ctl,building);
  }
  function nativeMountRecruitControl(root,tile,townId,unit) {

    // Position and freeze are read from THIS unit's own lane: a stuck trireme
    // must not grey out the barracks controls.
    const lane=nativeRecruitLaneOf(townId,unit);
    const list=nativeQueueList(townId,lane,false),frozen=list.some(j=>j&&(j.inflight||j.manualReview)),step=nativeUnitStep(unit),pending=nativeQueueRecruitAmount(townId,unit);
    const pos=nativeQueuePosition(townId,lane,j=>j&&j.unit===unit),head=pos===1&&list[0];

    const sig=JSON.stringify([townId,unit,lane,step,pending,pos,frozen,head&&head.status,head&&head.reason,list.length]);

    // Same as the build lane: compare against the mounted node, not a new one.
    const existing=[...tile.querySelectorAll(':scope > .gb-native-qctl[data-unit]')];
    const keep=existing.find(c=>c.dataset.unit===unit&&c.dataset.sig===sig);
    for(const c of existing)if(c!==keep)c.remove();
    if(keep)return;
    const ctl=document.createElement('div');ctl.className='gb-native-qctl';ctl.dataset.unit=unit;ctl.dataset.sig=sig;

    try{if(getComputedStyle(tile).position==='static')tile.style.position='relative'}catch(_){}
    tile.appendChild(ctl);
    if(pending>0){
      const count=document.createElement('span');count.className='gb-native-qcount';count.textContent=`+${pending}${pos?' · #'+pos:''}`;count.title=head&&head.reason?head.reason:`${pending} pendiente(s)`;
      if(head){if(head.status==='ready')count.classList.add('ready');else if(/blocked|unknown/.test(head.status||''))count.classList.add('blocked');else count.classList.add('waiting')}
      ctl.append(count);
    }
    const row=document.createElement('div');row.className='gb-native-qrow';
    const plus=nativeQButton(`+${step}`,`Añadir ${step} ${nativeUnitLabel(unit)} a la cola virtual (Ctrl: ×5)`,nativeTileAction(root,townId,tile,'unit',unit,e=>nativeQueueAddRecruit(townId,unit,(e.ctrlKey||e.metaKey)?step*5:step)));

    const more=nativeQButton('...',`Más opciones de cola para ${nativeUnitLabel(unit)}: restar, cantidad libre, lote y compactar`,nativeTileAction(root,townId,tile,'unit',unit,()=>nativeRecruitPopover(root,tile,townId,unit)));
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
    const title=document.createElement('span');title.textContent=`${nativeUnitLabel(unit)} · ${lane==='recruitNaval'?'Puerto':'Cuartel'}`;
    head1.append(title,nativeQButton('x','Cerrar',()=>nativeQPopClose()));pop.appendChild(head1);
    const rowA=document.createElement('div');rowA.className='gb-native-qpop-row';
    const minus=nativeQButton(`-${step}`,`Restar ${step} de la cola virtual de esta unidad`,act(()=>{if(!nativeQueueRemoveLastRecruit(townId,unit,step))flash('No hay unidades virtuales que quitar')}));
    minus.disabled=!list.some(j=>j&&j.unit===unit&&!j.inflight&&!j.manualReview);
    const count=document.createElement('span');count.className='gb-native-qcount';count.textContent=pending>0?`+${pending}${pos?' · #'+pos:''}`:'sin cola';
    count.title=head&&head.reason?head.reason:`${pending||0} pendiente(s)`;
    if(head){if(head.status==='ready')count.classList.add('ready');else if(/blocked|unknown/.test(head.status||''))count.classList.add('blocked');else count.classList.add('waiting')}
    const plus=nativeQButton(`+${step}`,`Añadir ${step} ${nativeUnitLabel(unit)} a la cola virtual`,act(e=>nativeQueueAddRecruit(townId,unit,(e.ctrlKey||e.metaKey)?step*5:step)));
    rowA.append(minus,count,plus);pop.appendChild(rowA);
    const rowB=document.createElement('div');rowB.className='gb-native-qpop-row';
    const qtyInp=document.createElement('input');qtyInp.type='number';qtyInp.min='1';qtyInp.step=String(step);qtyInp.value=String(step);qtyInp.title=`Cantidad a añadir (paso ${step})`;qtyInp.className='gb-native-qinp';
    const qtyBtn=nativeQButton('+N',`Añadir N ${nativeUnitLabel(unit)} a la cola virtual (paso ${step})`,act(()=>{const n=Math.max(1,Math.floor(+qtyInp.value||step));nativeQueueAddRecruit(townId,unit,n)}));
    rowB.append(qtyInp,qtyBtn);pop.appendChild(rowB);
    const rowC=document.createElement('div');rowC.className='gb-native-qpop-row';
    const totalInp=document.createElement('input');totalInp.type='number';totalInp.min='1';totalInp.step=String(step);totalInp.value=String(step*10);totalInp.title='Total de unidades a encolar';totalInp.className='gb-native-qinp';
    const sep2=document.createElement('span');sep2.textContent='/';sep2.style.color='#666';
    const chunkInp=document.createElement('input');chunkInp.type='number';chunkInp.min='1';chunkInp.step=String(step);chunkInp.value=String(step);chunkInp.title='Tamaño de cada lote al servidor';chunkInp.className='gb-native-qinp';
    const lotBtn=nativeQButton('+Lote','Encolar el total en lotes del tamaño indicado; cada envío se confirma antes de pasar al siguiente, y la fila se quita al agotarse',act(()=>{const r=nativeQueueAddRecruitBatch(townId,unit,+totalInp.value||0,+chunkInp.value||0);if(r&&r.ok)flash(`Lote encolado: ${r.total} en ${r.lotes} envío(s) de ${r.chunk}`);else flash((r&&r.why)||'no se pudo encolar el lote')}));
    rowC.append(totalInp,sep2,chunkInp,lotBtn);pop.appendChild(rowC);
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

    // Scoped to THIS tech across the whole root, not to `tile`. The control is
    // anchored next to the tech caption when there is one, so it is not always a
    // direct child of tile — and a tile-wide `[data-research]` sweep would let
    // one tech delete a sibling tech's control when several share a parent,
    // which churns forever. Matching on the tech makes both cases exact.
    const existing=[...root.querySelectorAll('.gb-native-qctl[data-research]')].filter(c=>c.dataset.research===tech);
    const keep=existing.find(c=>c.dataset.sig===sig);
    for(const c of existing)if(c!==keep)c.remove();
    if(keep)return;
    const ctl=document.createElement('div');ctl.className='gb-native-qctl';ctl.dataset.research=tech;ctl.dataset.sig=sig;

    // Match the build lane's anchor logic (H6). A tech-tree cell is a fixed-size
    // sprite box, so an inline-flex control appended to the cell itself can be
    // clipped; the caption/level wrapper next to it is laid out in flow.
    const anchor=tile.querySelector('.research_name,.research_level,.level');
    ((anchor&&anchor.parentElement)||tile).appendChild(ctl);
    const blockWhy=done?`${nativeResearchLabel(tech)} ya está investigada`:(inReal?`${nativeResearchLabel(tech)} ya está en la cola real`:'');
    if(!pos){
      const plus=nativeQButton('+',`Añadir ${nativeResearchLabel(tech)} a la cola virtual`,nativeTileAction(root,townId,tile,'research',tech,()=>nativeQueueAddResearch(townId,tech)));
      nativeApplyPlusBlock(plus,blockWhy);
      ctl.append(plus);nativeQctlHitCheck(ctl,tech);return;
    }
    const minus=nativeQButton('-','Quitar esta investigación de la cola virtual',nativeTileAction(root,townId,tile,'research',tech,()=>{if(!nativeQueueRemoveResearch(townId,tech))flash('No se puede quitar esta investigación de la cola')}));
    minus.disabled=!list.some(j=>j&&String(j.tech)===String(tech)&&!j.inflight&&!j.manualReview);
    const count=document.createElement('span');count.className='gb-native-qcount';count.textContent=`Cola · #${pos}`;
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

    // The panel mounts on document.body (fixed position) so it never sits on top
    // of the in-game queue UI inside the window. Scoped per town window by id.
    let box=document.querySelector(`.gb-native-panel[data-lane="${lane}"][data-town="${townId}"]`);
    if(!box){box=document.createElement('div');box.className='gb-native-panel';box.dataset.lane=lane;box.dataset.town=String(townId);document.body.appendChild(box);box.addEventListener('mousedown',e=>e.stopPropagation());box.addEventListener('click',e=>e.stopPropagation())}

    // nativeUiScan re-renders this on every game-DOM mutation and every 5s tick,
    // so it paints through gbPaint: unchanged lanes are patched, not rebuilt,
    // and the panel stops swallowing the click you were about to make on it.
    // The key carries the job ids AND the flags each row's handler closes over
    // (frozen/inflight), so a kept button can never act for a different job.
    const list=nativeQueueList(townId,lane,false),frozen=list.some(j=>j&&(j.inflight||j.manualReview));
    const roster=NATIVE_RECRUIT_LANES.includes(lane)?[...new Set((units||[]).filter(Boolean))]:[];
    const ckey=`${lane}|${townId}`,collapsed=!!nativeQPanelCollapsed[ckey];

    const key=`${lane}|${townId}|${frozen?'F':'-'}|${collapsed?'C':'-'}|`
      +list.map(j=>`${j.id}:${j.inflight?1:0}${j.manualReview?'m':''}`).join(',')
      +'|'+roster.map(u=>`${u}:${nativeQueueRecruitAmount(townId,u)}:${nativeQueuePosition(townId,lane,j=>j&&j.unit===u)||0}`).join(',');
    gbPaint(box,stage=>{
      const head=document.createElement('div');head.className='gb-native-panel-head';const title=document.createElement('span');title.textContent=lane==='build'?'Cola GrepBot · Construcción':(lane==='research'?'Cola GrepBot · Investigación':(lane==='recruitNaval'?'Cola GrepBot · Puerto':'Cola GrepBot · Cuartel'));gbTip(title, 'Cola virtual de GrepBot para esta ciudad y tipo de edificio/unidad');head.appendChild(title);
      const paused=nativeQueuePaused(townId,lane),pause=nativeQButton(paused?'>':'||',paused?'Reanudar esta cola':'Pausar esta cola',nativeTownAction(root,townId,()=>nativeQueueTogglePaused(townId,lane)));head.appendChild(pause);
      if(!list.length&&nativeQueueIsFifo(townId,lane)){const legacy=nativeQButton('Objetivos','Volver al planificador de objetivos',nativeTownAction(root,townId,()=>nativeQueueUseLegacy(townId,lane)));head.appendChild(legacy)}
      // Plan CS scripted: solo en la cola de construcción. Mientras esté activo,
      // el botón muestra la fase actual y al pulsarlo detiene el script.
      if (lane === 'build') {
        const scriptActive = abScriptActive();
        const phase = scriptActive ? abScriptCurrentPhase(townId) : null;
        const scriptLbl = scriptActive ? (phase ? `CS: ${phase.label}` : 'CS: calculando…') : 'Plan CS';
        const scriptBtn = nativeQButton(scriptActive ? '⏹' : '▶', scriptActive ? `Detener ${scriptLbl}` : 'Activar plan CS (Senado 24 → Academia 7 → Teatro → Academia 30 → Máx)', nativeTownAction(root,townId,() => {
          if (abScriptActive() && !confirm('¿Detener el plan CS y volver a los objetivos compartidos?')) return;
          abScriptToggle();
          try { abScan('manual'); } catch (_) {}
        }));
        scriptBtn.style.color = scriptActive ? '#ffb060' : '#9bd';
        head.appendChild(scriptBtn);
      }
      head.appendChild(nativeQButton(collapsed?'▸':'▾',collapsed?'Desplegar este panel':'Plegar este panel',nativePanelAction(townId,()=>{nativeQPanelCollapsed[ckey]=!collapsed;scheduleNativeUiScan()})));
      stage.appendChild(head);
      if(collapsed){
        const sum=document.createElement('div');sum.className='gb-native-panel-sum';
        const pend=list.reduce((n,j)=>n+(+j.amount||0),0);
        sum.textContent=list.length?`${list.length} en cola${pend?` · ${pend} unidad(es)`:''}`:'Cola vacía';
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
          count.textContent=pending>0?`+${pending}${pos?' · #'+pos:''}`:'—';
          count.title=uhead&&uhead.reason?uhead.reason:`${pending||0} pendiente(s) en la cola virtual`;
          if(pending>0&&uhead){if(uhead.status==='ready')count.classList.add('ready');else if(/blocked|unknown/.test(uhead.status||''))count.classList.add('blocked');else count.classList.add('waiting')}
          const acts=document.createElement('div');acts.className='gb-native-unit-actions';
          const minus=nativeQButton(`-${step}`,`Restar ${step} ${nativeUnitLabel(unit)} de la cola virtual`,nativePanelAction(townId,()=>{if(!nativeQueueRemoveLastRecruit(townId,unit,step))flash('No hay unidades virtuales que quitar')}));
          minus.disabled=!list.some(j=>j&&j.unit===unit&&!j.inflight&&!j.manualReview);
          const plus=nativeQButton(`+${step}`,`Añadir ${step} ${nativeUnitLabel(unit)} a la cola virtual (Ctrl: ×5)`,nativePanelAction(townId,e=>nativeQueueAddRecruit(townId,unit,(e.ctrlKey||e.metaKey)?step*5:step)));

          const more=nativeQButton('…',`Más opciones para ${nativeUnitLabel(unit)}: cantidad libre, lote y compactar`,nativePanelAction(townId,()=>nativeRecruitPopover(root,null,townId,unit,row)));
          acts.append(minus,plus,more);
          row.append(name,count,acts);grid.appendChild(row);
        }
        stage.appendChild(grid);
      }
      if(!list.length){const empty=document.createElement('div');empty.className='gb-native-empty';empty.textContent=nativeQueueIsFifo(townId,lane)?'Cola vacía. Usa los botones + de arriba.':'Usa + para crear una cola FIFO en esta ciudad.';stage.appendChild(empty);return}
      const jobs=document.createElement('div');jobs.className='gb-native-jobs';stage.appendChild(jobs);
      list.forEach((j,i)=>{const row=document.createElement('div');row.className='gb-native-job';const num=document.createElement('b');num.textContent='#'+(i+1);const desc=document.createElement('div');const main=document.createElement('div');main.textContent=lane==='build'?`${nativeBuildLabel(j.building)} ${j.fromLevel}→${j.toLevel}`:(lane==='research'?nativeResearchLabel(j.tech):`${j.amount}× ${nativeUnitLabel(j.unit)}`);const sub=document.createElement('small');sub.textContent=`${j.status||'pending'}${j.reason?' · '+j.reason:''}`;gbTip(sub, 'Estado de la orden virtual + motivo si esta bloqueada');desc.append(main,sub);const acts=document.createElement('div');acts.className='gb-native-job-actions';const top=nativeQButton('↑↑','Saltar al inicio de la cola',nativePanelAction(townId,()=>nativeQueueMove(townId,lane,j.id,-i)));top.disabled=frozen||i===0;const up=nativeQButton('↑','Mover antes',nativePanelAction(townId,()=>nativeQueueMove(townId,lane,j.id,-1)));up.disabled=frozen||i===0;const down=nativeQButton('↓','Mover después',nativePanelAction(townId,()=>nativeQueueMove(townId,lane,j.id,1)));down.disabled=frozen||i===list.length-1;const bot=nativeQButton('↓↓','Saltar al final de la cola',nativePanelAction(townId,()=>nativeQueueMove(townId,lane,j.id,list.length-1-i)));bot.disabled=frozen||i===list.length-1;const del=nativeQButton('×','Quitar de la cola virtual',nativePanelAction(townId,()=>{if(j.inflight){flash('Esta orden se está enviando; espera a que termine');return false}if(j.manualReview){let ok=false;try{ok=gameUw().confirm('Comprueba primero la cola real. Borrar este elemento confirma que asumes si la acción se envió o no.')}catch(_){ok=false}if(!ok)return false}else if(frozen){let ok=false;try{ok=gameUw().confirm('Hay otra acción pendiente en esta cola. ¿Borrar este elemento de todos modos?')}catch(_){ok=false}if(!ok)return false}return nativeQueueRemove(townId,lane,j.id,{force:true})}));del.disabled=!!j.inflight;acts.append(top,up,down,bot,del);row.append(num,desc,acts);jobs.appendChild(row)});
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

      // Iterate the unique per-building wrapper only. The Senate renders
      // multiple descendant tiles inside each wrapper that all carry
      // data-building_type=X; iterating them duplicates the control stack.
      const buildTiles=senateContext?[...root.querySelectorAll('[id^="building_main_"],[id^="special_building_"]')]:[];
      for(const tile of buildTiles){if(tile.classList.contains('gb-native-qctl')||tile.closest('.gb-native-qctl'))continue;const id=nativeBuildingId(tile);if(!id||mountedBuildIds.has(id))continue;mountedBuildIds.add(id);nativeMountBuildControl(root,tile,townId,id);buildN++}
      const unitContext=root.matches('#unit_order')?root:root.querySelector('#unit_order');const unitTiles=unitContext?[...unitContext.querySelectorAll('#units .unit_tab,.unit_tab')]:[];

      const unitsByLane={recruit:[],recruitNaval:[]};
      for(const tile of unitTiles){const id=nativeUnitId(tile);if(!id||mountedUnitIds.has(id))continue;mountedUnitIds.add(id);const ulane=nativeRecruitLaneOf(townId,id);mountedUnitLanes.add(ulane);(unitsByLane[ulane]||(unitsByLane[ulane]=[])).push(id);nativeMountRecruitControl(root,tile,townId,id)}

      // Academy: every tech entry carries data-research_id. The attribute can sit
      // on the upgrade button itself, so mount on the outermost node per id —
      // appending a control INSIDE a <button> would nest interactive elements.
      const researchTiles=[...root.querySelectorAll(nativeResearchTileSel(root))].filter(n=>!n.closest('.gb-native-qctl'));
      const researchOuter=researchTiles.filter(n=>{const id=nativeResearchId(n);return id&&!researchTiles.some(o=>o!==n&&o.contains(n)&&nativeResearchId(o)===id)});
      for(const node of researchOuter){const id=nativeResearchId(node);if(!id||mountedResearchIds.has(id))continue;
        const tile=/^(?:button|a)$/i.test(node.tagName)?(node.parentElement||node):node;
        if(tile.closest('.gb-native-qctl'))continue;
        mountedResearchIds.add(id);nativeMountResearchControl(root,tile,townId,id);researchN++}

      // Step 1 instrumentation. `researchN === 0` removes the whole Investigación
      // panel, which is indistinguishable in-game from "the scan never ran".
      // Say which of the two it was, and what the academy DOM actually offered.
      if(!researchN&&nativeAcademyRoot(root)&&(root.querySelector('.tech_tree_box')||researchTiles.length)){
        gbLogT('native-research-zero',300000,
          `native ui: academy root matched ${researchTiles.length} research node(s) but resolved 0 techs `
          +`(attr ${root.querySelectorAll(NATIVE_RESEARCH_SEL).length}, class ${root.querySelectorAll(NATIVE_RESEARCH_SEL_CLASS).length}, `
          +`tech_tree_box ${root.querySelectorAll('.tech_tree_box').length})`);
      }
      root.querySelectorAll('.gb-native-qctl[data-building]').forEach(c=>{if(!mountedBuildIds.has(c.dataset.building))c.remove()});root.querySelectorAll('.gb-native-qctl[data-unit]').forEach(c=>{if(!mountedUnitIds.has(c.dataset.unit))c.remove()});root.querySelectorAll('.gb-native-qctl[data-research]').forEach(c=>{if(!mountedResearchIds.has(c.dataset.research))c.remove()});
      if(buildN)nativeRenderQueuePanel(root,townId,'build');else document.querySelector(`.gb-native-panel[data-lane="build"][data-town="${townId}"]`)?.remove();for(const lane of NATIVE_RECRUIT_LANES){if(mountedUnitLanes.has(lane))nativeRenderQueuePanel(root,townId,lane,unitsByLane[lane]);else document.querySelector(`.gb-native-panel[data-lane="${lane}"][data-town="${townId}"]`)?.remove()}if(researchN)nativeRenderQueuePanel(root,townId,'research');else document.querySelector(`.gb-native-panel[data-lane="research"][data-town="${townId}"]`)?.remove();
    }

    // Drop panels whose town window is gone.
    document.querySelectorAll('.gb-native-panel[data-town]').forEach(p => { if (!mountedTowns.has(p.dataset.town)) p.remove(); });

    document.querySelectorAll('.gb-native-qpop[data-town]').forEach(p => { if (!mountedTowns.has(p.dataset.town)) nativeQPopClose(); });

    nativeLayoutPanels();
  }
