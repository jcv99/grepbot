  function goalProfiles() {
    if (!state.goalProfiles || typeof state.goalProfiles !== 'object') state.goalProfiles={};
    return Object.assign({}, GOAL_PROFILE_DEFAULTS, CD_PROFILE_DEFAULTS, state.goalProfiles);
  }
  function goalTownCfg(townId) {
    if (!state.townGoals || typeof state.townGoals !== 'object') state.townGoals={};
    const id=String(townId); let g=state.townGoals[id];
    if (!g || typeof g !== 'object') g=state.townGoals[id]={profile:'custom',build:{},research:{},units:{},reserve:{},resource:{}};
    if (!g.profile) g.profile='custom';
    for (const k of ['build','research','units','reserve','resource']) if (!g[k] || typeof g[k] !== 'object') g[k]={};
    if (!g.cd || typeof g.cd !== 'object' || Array.isArray(g.cd)) g.cd={};

    if (g.defensive != null && !Number.isFinite(+g.defensive)) delete g.defensive;
    return g;
  }
  function goalMergeMap(base, over) { const o=Object.assign({},base||{}); for(const [k,v] of Object.entries(over||{})) o[k]=v; return o; }
  function goalEffective(townId) {
    const cfg=goalTownCfg(townId); if(cdIsProfile(cfg.profile)) return cdEffective(townId); const p=goalProfiles()[cfg.profile]||GOAL_PROFILE_DEFAULTS.custom;
    return { profile:cfg.profile, label:p.label||cfg.profile,
      build:goalMergeMap(p.build,cfg.build), research:goalMergeMap(p.research,cfg.research), units:goalMergeMap(p.units,cfg.units),
      reserve:{ hard:goalMergeMap((p.reserve||{}).hard,(cfg.reserve||{}).hard), soft:goalMergeMap((p.reserve||{}).soft,(cfg.reserve||{}).soft) },
      defensive:goalDefensive(cfg,p), resource:goalResourceBias(cfg,p) };
  }

  function goalDefensive(cfg,p) {
    const v=Number.isFinite(+(cfg&&cfg.defensive))?+cfg.defensive:(Number.isFinite(+(p&&p.defensive))?+p.defensive:0.5);
    return Math.max(0,Math.min(1,v));
  }
  function goalResourceBias(cfg,p) {
    const merged=goalMergeMap((p&&p.resource)||{},(cfg&&cfg.resource)||{}),out={};
    for(const k of GB_RES_KEYS){const n=+merged[k];out[k]=Number.isFinite(n)?Math.max(-1,Math.min(1,n)):0}
    return out;
  }
  function goalReservePolicy(townId) { const e=goalEffective(townId); return e && e.reserve; }
  function goalEffectiveBuildTargets(townId) {
    const cfg=goalTownCfg(townId), e=goalEffective(townId), base=abEnsureTargets();
    const out=cdIsProfile(cfg.profile)?Object.assign({},cdBuildTargets(townId)):(cfg.profile && cfg.profile!=='custom')?Object.assign({},e.build||{}):goalMergeMap(base,cfg.build||{});
    const scripted = typeof abScriptEffectiveTargets === 'function' ? abScriptEffectiveTargets(townId) : null;
    if (scripted) for (const k of Object.keys(scripted)) out[k] = scripted[k];
    for(const id of Object.keys(out))if(goalQueueSuppressed(townId,'build',id))delete out[id];
    return out;
  }
  function goalEffectiveResearchTargets(townId, globalTargets) {
    const cfg=goalTownCfg(townId);if(cdIsProfile(cfg.profile)){const t=cdResearchTargets(townId),base={};for(const [tech,v] of Object.entries(t))if(tech!=='__cdUnresolved')base[tech]=Object.assign({},v);for(const tech of Object.keys(base))if(goalQueueSuppressed(townId,'research',tech))delete base[tech];return base}
    const e=goalEffective(townId); const base=(cfg.profile&&cfg.profile!=='custom')?{}:Object.assign({},globalTargets||researchEnsureTargets());
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
    const raw=Object.assign({},state.recruitTargets||{}),out={};
    let ids=[]; try{ids=Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{})}catch(_){}
    for(const tid of ids){const cfg=goalTownCfg(tid);let m;if(cdIsProfile(cfg.profile)){m=cdRecruitTargets(tid);if(m&&m.__cdFeasible===false)m={}}else{const e=goalEffective(tid);m=Object.assign({},raw[tid]||{});for(const [u,n] of Object.entries(e.units||{}))if(+n>0)m[u]=Math.max(+m[u]||0,+n);for(const[u,n]of Object.entries(cfg.units||{})){if(+n>0)m[u]=+n;else delete m[u]}}
      const clean=Object.keys(m||{}).filter(u=>!String(u).startsWith('__'));const ordered=cdIsProfile(cfg.profile)?clean:goalOrderIds(tid,'recruit',clean);out[tid]={};for(const u of ordered)if(!goalQueueSuppressed(tid,'recruit',u))out[tid][u]=+m[u]||0;
    }
    return out;
  }
  function goalResearchDependencies(townId, tech) {
    const def=gbGameDataLookup("researches", tech); if(!def) return {ok:false,why:'research-definition-unreadable',build:[],research:[]};
    const b=[],r=[]; const bd=def.building_dependencies||def.required_buildings||{};
    for(const [id,raw] of Object.entries(bd)){ const level=+(raw&&typeof raw==='object'?(raw.level??raw.min_level??raw.value):raw)||0; if(level>0)b.push({id,level}); }
    const ad=+(def.academy_level??def.required_academy_level??def.building_level??def.level??0); if(ad>0)b.push({id:'academy',level:ad});
    const rd=def.research_dependencies||def.dependencies||[]; const list=Array.isArray(rd)?rd:Object.keys(rd||{}).filter(k=>rd[k]);
    for(const x of list){const id=typeof x==='string'?x:(x&&(x.id||x.research_id||x.research_type));if(id)r.push(id)}
    return {ok:true,build:b,research:r};
  }
  function goalUnitDependencies(unit) {
    const d=gbGameDataLookup("units", unit); if(!d) return {ok:false,why:'unit-definition-unreadable',build:[],research:[]};
    const build=[]; if(d.god||d.mythical||d.is_mythical) build.push({id:'temple',level:1}); else if(d.is_naval||d.naval) build.push({id:'docks',level:1}); else build.push({id:'barracks',level:1});
    const need=d.research_required||d.research_dependencies||[]; const list=Array.isArray(need)?need:[need]; const research=list.filter(Boolean).map(x=>typeof x==='string'?x:(x.id||x.research_id||x.research_type)).filter(Boolean);
    return {ok:true,build,research};
  }
  function goalUnitCountsState(townId) {
    const out={};let t=null;try{t=gbTownModel(townId)}catch(_){return {known:false,counts:{},why:'town-unreadable'}}if(!t||typeof t.units!=='function'||typeof t.unitsOuter!=='function')return {known:false,counts:{},why:'unit-model-unreadable'};
    let local,outer;try{local=t.units();outer=t.unitsOuter()}catch(_){return {known:false,counts:{},why:'unit-read-failed'}}if(!local||typeof local!=='object'||!outer||typeof outer!=='object')return {known:false,counts:{},why:'unit-state-unreadable'};
    for(const[k,n]of Object.entries(local))out[k]=(+out[k]||0)+(+n||0);for(const[k,n]of Object.entries(outer))out[k]=(+out[k]||0)+(+n||0);return {known:true,counts:out,why:'ok'};
  }
  function goalUnitCounts(townId) {const st=goalUnitCountsState(townId);return st.known?st.counts:{}}
  function goalPlanTown(townId) {
    const e=goalEffective(townId), levels=abCurrentLevels(townId); if(!levels)return {townId:String(townId),profile:e.profile,error:'levels-unreadable',actions:[]};
    const sim=Object.assign({},levels), actions=[], maxActions=40; const av=plannerAvailable(townId,{allowSoft:false});
    const ledger=av?Object.assign({},av):null;
    const buildTargets=e.build||{};

    const base=goalBuildOrder(townId,Object.keys(buildTargets));
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
    if(cdIsProfile(e.profile)){const realBuild=abPickNext(townId);if(realBuild&&realBuild.mode==='teardown'){actions.push({kind:'demolish',id:realBuild.building,building:realBuild.building,mode:'teardown',level:realBuild.targetLevel,status:'planned',why:realBuild.reason||'city-designer strip',cdRevision:realBuild.cdRevision})}}
    let info=null; try{info=researchTownTechs(townId)}catch(_){}
    for(const [tech,on] of Object.entries(e.research||{})){if(!+on)continue;if(info&&info.techs&&info.techs[tech])continue;if(info&&(info.orders||[]).some(o=>String(researchOrderTechId(o))===String(tech)))continue;
      const dep=goalResearchDependencies(townId,tech);let status=dep.ok?'planned':'blocked',why=dep.why||'';
      if(dep.ok){for(const b of dep.build)if(+(sim[b.id]||0)<b.level){status='waiting-dependency';why=`${b.id} ${sim[b.id]||0}/${b.level}`;break} for(const r of dep.research)if(!(info&&info.techs&&info.techs[r])){status='waiting-dependency';why=`research:${r}`;break}}
      const cost=researchCost(tech,townId);if(!cost){status='blocked';why='cost-unreadable'}
      actions.push({kind:'research',id:tech,cost,status,why});
    }
    let t=null;try{t=gbTownModel(townId)}catch(_){}; const have=goalUnitCounts(townId);
    for(const [unit,target] of Object.entries(e.units||{})){const tgt=+target||0;if(!(tgt>0))continue;let queued=0;try{const c=t.getUnitOrdersCollection&&t.getUnitOrdersCollection();for(const m of((c&&c.models)||[])){const a=m.attributes||{};if(String(a.unit_type||a.unit_id||a.type)===unit)queued+=+(a.count||a.amount||0)}}catch(_){}
      const need=tgt-(+have[unit]||0)-queued;if(need<=0)continue;const dep=goalUnitDependencies(unit);let status=dep.ok?'planned':'blocked',why=dep.why||'';if(dep.ok){for(const b of dep.build)if(+(sim[b.id]||0)<b.level){status='waiting-dependency';why=`${b.id}`;break}}
      const ec=recruitEffectiveUnitCost(townId, unit);let cost=null;if(ec){cost={};for(const k of ['wood','stone','iron','population']){const v=recruitDisplayCost(ec,k);cost[k]=v==null?null:v*need}if(ec.authoritative!==true){status=status==='planned'?'planned-cost-advisory':status;why=why||'effective-cost-unreadable; GameData shown for reference'}}else{status='blocked';why='cost-unreadable'}
      actions.push({kind:'recruit',id:unit,amount:need,cost,status,why});
    }
    const decorated=goalQueueDecorate(townId,actions.slice(0,maxActions));
    const plan={townId:String(townId),profile:e.profile,label:e.label,progress:goalProgress(townId),generatedAt:Date.now(),actions:decorated};
    const prev=state.virtualQueue[String(townId)], sig=JSON.stringify({profile:plan.profile,actions:plan.actions}); const prevSig=prev&&JSON.stringify({profile:prev.profile,actions:prev.actions});
    state.virtualQueue[String(townId)]=plan; if(sig!==prevSig) save(STORE.VIRTUAL_QUEUE,state.virtualQueue);

    if (state.abOptimalOrderOn !== false) { try { abOptimalOrderSave(townId, abOptimalOrderFor(townId)); } catch (_) {} }

    try { militaryCompositionInvalidate(); } catch (_) {}
    return plan;
  }

  const AB_OPT_MAX = 40;
  const AB_OPT_TTL_MS = 7 * 86400000;
  function abOptDepth(townId, building, levels, depth) {

    const d = +depth || 0;
    if (d > 50) return { depth: d, error: 'chain-too-long' };
    const r = abResolvePrerequisite(townId, building, levels);
    if (!r || r.error) return { depth: d, error: (r && r.error) || 'dependency' };
    if (r.building === building) return { depth: d };
    return abOptDepth(townId, r.building, levels, d + 1);
  }
  function abOptBuildTimeMs(townId, building) {
    const bd = abBuildDataEntry(townId, building);
    const sec = bd && +(bd.building_time ?? bd.build_time ?? bd.time);
    return Number.isFinite(sec) && sec > 0 ? sec * 1000 : null;
  }
  function abOptimalOrderFor(townId) {
    const id = String(townId);
    const levels = abCurrentLevels(townId);
    if (!levels) return { townId: id, error: 'levels-unreadable', actions: [] };
    const targets = goalEffectiveBuildTargets(townId);
    const avail = plannerAvailable(townId, { allowSoft: true });

    const ledger = avail ? Object.assign({}, avail) : null;
    const ranked = Object.keys(targets)
      .filter(b => {
        const max = abMaxLevel(b);
        const want = Math.min(+targets[b] || 0, max == null ? +targets[b] || 0 : max);
        return want > 0 && +(levels[b] || 0) < want;
      })
      .map(b => {
        const dep = abOptDepth(townId, b, levels, 0);
        const cost = abBuildingCost(townId, b);
        let gap = 0;
        if (cost && ledger) for (const k of PLANNER_KEYS) gap += Math.max(0, (+cost[k] || 0) - (+ledger[k] || 0));
        const rank = goalQueueRank(townId, 'build', b);
        return { b, depth: dep.depth, err: dep.error || '', gap, eta: abOptBuildTimeMs(townId, b) || 0, rank };
      })
      .sort((x, y) =>
        (y.rank.mandatory - x.rank.mandatory) ||
        (x.depth - y.depth) ||
        (x.gap - y.gap) ||
        (x.eta - y.eta) ||
        (x.rank.index - y.rank.index));
    const sim = Object.assign({}, levels), actions = [];
    let guard = 0;
    while (actions.length < AB_OPT_MAX && guard++ < 200) {
      let added = false;
      for (const t of ranked) {
        const max = abMaxLevel(t.b);
        const want = Math.min(+targets[t.b] || 0, max == null ? +targets[t.b] || 0 : max);
        if (!(want > 0) || +(sim[t.b] || 0) >= want) continue;
        const dep = abResolvePrerequisite(townId, t.b, sim);
        if (!dep || !dep.building) {
          actions.push({ building: t.b, forTarget: t.b, level: null, cost: null, etaMs: null, status: 'blocked', why: (dep && dep.error) || 'dependency' });
          sim[t.b] = want; added = true; break;
        }
        if (goalQueueSuppressed(townId, 'build', dep.building)) { sim[dep.building] = Math.max(sim[dep.building] || 0, want); added = true; break; }
        const b = dep.building, cost = abBuildingCost(townId, b);
        const next = +(sim[b] || 0) + 1;
        const costExact = next === (+(levels[b] || 0) + 1);
        let status = 'planned', why = dep.reason || '';
        if (!cost) { status = 'blocked'; why = 'cost-unreadable'; }
        else if (!ledger) { status = 'waiting-resources'; why = 'planner-unreadable'; }
        else if (costExact) {
          for (const k of PLANNER_KEYS) {
            const n = +cost[k] || 0;
            if (n > +(ledger[k] || 0)) { status = 'waiting-resources'; why = `${k} ${Math.floor(ledger[k] || 0)}/${n}`; break; }
          }
          if (status === 'planned') for (const k of PLANNER_KEYS) ledger[k] -= +cost[k] || 0;
        } else { status = 'planned-recalc'; why = why || 'future level cost recalculated after prior build'; }
        actions.push({ building: b, forTarget: t.b, level: next, cost, etaMs: abOptBuildTimeMs(townId, b), status, why });
        sim[b] = next; added = true; break;
      }
      if (!added) break;
    }
    return { townId: id, generatedAt: Date.now(), actions };
  }

  function abOptimalOrderSave(townId, plan) {
    if (!state.abOptimalOrder || typeof state.abOptimalOrder !== 'object') state.abOptimalOrder = {};
    const id = String(townId);
    const prev = state.abOptimalOrder[id];
    const sig = JSON.stringify((plan && plan.actions) || []);
    const prevSig = prev ? JSON.stringify(prev.actions || []) : null;
    state.abOptimalOrder[id] = plan;
    if (sig === prevSig) return;
    abOptimalOrderPrune();
    save(STORE.AB_OPTIMAL_ORDER, state.abOptimalOrder);
  }

  const AB_OPT_FRESH_MS = 60000;
  function abOptimalOrderCached(townId) {
    const id = String(townId);
    const hit = (state.abOptimalOrder || {})[id];
    if (hit && Date.now() - (+hit.generatedAt || 0) < AB_OPT_FRESH_MS) return hit;
    const plan = abOptimalOrderFor(townId);
    abOptimalOrderSave(id, plan);
    return plan;
  }
  function abOptimalOrderPrune() {
    const cutoff = Date.now() - AB_OPT_TTL_MS;
    for (const [k, v] of Object.entries(state.abOptimalOrder || {})) {
      if (!v || +(v.generatedAt || 0) < cutoff) delete state.abOptimalOrder[k];
    }
  }
  function abOptimalOrderClear() {
    state.abOptimalOrder = {};
    save(STORE.AB_OPTIMAL_ORDER, state.abOptimalOrder);
    gbLog('optimal order: cache cleared');
  }
  function goalPlanAll(){let ids=[];try{ids=Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{})}catch(_){};return ids.map(goalPlanTown)}
  function goalSetProfile(townId,profile){cdSyncTownGoal(townId);const g=goalTownCfg(townId);if(!goalProfiles()[profile]&&!cdIsProfile(profile))return false;const prev=cdCanonicalProfile(g.profile),next=cdCanonicalProfile(profile);g.profile=next;if(prev!==next){const c=cdTownState(townId);c.revision=(+c.revision||0)+1;c.stripStarted=false;c.stripFinalized=false;c.landDocksFinalized=false;c.changedAt=Date.now();c.lastRevisionAt=c.changedAt;c.changedFrom=prev}cdPersistTownGoal(townId);if(next!=='custom')nativeQueueClearForPlanner(townId,'profile:'+next);goalPlanTown(townId);return true}
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
  function goalBuildOrder(townId,extra){if(cdIsProfile(goalTownCfg(townId).profile)){const base=cdBuildOrder(townId);return goalOrderIds(townId,'build',base.concat((extra||[]).filter(k=>!base.includes(k))))}const base=abEnsureOrder();return goalOrderIds(townId,'build',base.concat((extra||[]).filter(k=>!base.includes(k))));}
  function goalQueueDecorate(townId,actions){const q=goalQueueCfg(townId);const arr=(actions||[]).filter(a=>!q.hidden[goalActionKey(a)]).map(a=>{const key=goalActionKey(a),blocked=!!q.blocked[key];return Object.assign({},a,{queueKey:key,mandatory:!!q.mandatory[key],status:blocked?'user-blocked':a.status,why:blocked?'blocked by user':a.why});});return arr.sort((a,b)=>{const A=goalQueueRank(townId,a.kind,a.id),B=goalQueueRank(townId,b.kind,b.id);return (B.mandatory-A.mandatory)||(A.index-B.index);});}
  function goalQueueMove(townId,key,delta){
    const q=goalQueueCfg(townId);

    if (q.order.indexOf(key) < 0) {
      q.order = q.order.concat([key]);
      goalQueueSave();
      goalPlanTown(townId);
      return true;
    }

    const at=q.order.indexOf(key);
    const clean=q.order.filter(x=>x!==key);
    const idx=Math.max(0,Math.min(clean.length,at+(+delta||0)));
    clean.splice(idx,0,key);
    q.order=clean;
    goalQueueSave();
    goalPlanTown(townId);
    return true;
  }
  function goalQueueToggleBlock(townId,key){const q=goalQueueCfg(townId);if(q.blocked[key])delete q.blocked[key];else q.blocked[key]=true;delete q.hidden[key];goalQueueSave();goalPlanTown(townId);return !!q.blocked[key];}
  function goalQueueToggleMandatory(townId,key){const q=goalQueueCfg(townId);if(q.mandatory[key])delete q.mandatory[key];else q.mandatory[key]=true;goalQueueSave();goalPlanTown(townId);return !!q.mandatory[key];}
  function goalQueueHide(townId,key){const q=goalQueueCfg(townId);q.hidden[key]=true;q.blocked[key]=true;goalQueueSave();goalPlanTown(townId);return true;}
  function goalQueueReset(townId){delete state.virtualQueueOverrides[String(townId)];goalQueueSave();goalPlanTown(townId);return true;}
  function goalSetTownOverrides(townId,obj){if(!obj||typeof obj!=='object'||Array.isArray(obj))return false;cdSyncTownGoal(townId);const g=goalTownCfg(townId),cleanMap=v=>{const o={};if(v&&typeof v==='object'&&!Array.isArray(v))for(const[k,n]of Object.entries(v))if(Number.isFinite(+n)&&+n>=0)o[k]=+n;return o;};if(obj.build!=null)g.build=cleanMap(obj.build);if(obj.research!=null)g.research=cleanMap(obj.research);if(obj.units!=null)g.units=cleanMap(obj.units);if(obj.reserve&&typeof obj.reserve==='object'){g.reserve={hard:cleanMap(obj.reserve.hard),soft:cleanMap(obj.reserve.soft)}}

    if(obj.defensive!==undefined){if(obj.defensive===null||obj.defensive==='')delete g.defensive;else if(Number.isFinite(+obj.defensive))g.defensive=Math.max(0,Math.min(1,+obj.defensive));}

    if(obj.resource!==undefined){const r={};if(obj.resource&&typeof obj.resource==='object'&&!Array.isArray(obj.resource))for(const k of GB_RES_KEYS){const n=+obj.resource[k];if(Number.isFinite(n))r[k]=Math.max(-1,Math.min(1,n))}g.resource=r;}
    cdPersistTownGoal(townId);goalPlanTown(townId);return true;}
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
    main:'Senado',storage:'Almac\u00e9n',farm:'Granja',academy:'Academia',temple:'Templo',
    barracks:'Cuartel',docks:'Puerto',market:'Mercado',hide:'Cueva',lumber:'Aserradero',
    stoner:'Cantera',ironer:'Mina de plata',wall:'Muralla',theater:'Teatro',thermal:'Termas',
    library:'Biblioteca',lighthouse:'Faro',tower:'Torre',statue:'Estatua divina',oracle:'Or\u00e1culo',trade_office:'Oficina comercial',
  };
  const NATIVE_SPECIAL_GROUPS=[['theater','thermal','library','lighthouse'],['tower','statue','oracle','trade_office']];
  let nativeQueueInflightRestored=false;

