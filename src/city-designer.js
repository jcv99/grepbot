  const CD_PROFILE_DEFAULTS = Object.freeze({
    cd_slinger_50ls:{label:'CD · Honderos + 50 mechas',cd:true},
    cd_bireme:{label:'CD · Full birremes',cd:true},
    cd_lightship:{label:'CD · Full mechas',cd:true},
    cd_trireme:{label:'CD · Full trirremes',cd:true},
    cd_defense:{label:'CD · Defensa terrestre móvil',cd:true},
  });
  function cdCanonicalProfile(profile){const p=String(profile||'');return CD_PROFILE_ALIASES[p]||p}
  function cdIsProfile(profile){return !!CD_PROFILE_DEFAULTS[cdCanonicalProfile(profile)]}
  function cdGoalClone(v){try{return JSON.parse(JSON.stringify(v))}catch(_){return null}}
  function cdGoalStamp(g){const c=g&&g.cd&&typeof g.cd==='object'?g.cd:{},revision=gbNum(c.revision);return {revision:revision!=null?revision:0,at:Math.max(gbNum(c.lastRevisionAt)||0,gbNum(c.changedAt)||0,gbNum(c.stripStartedAt)||0)}}
  const CD_OPTION_FIELDS=Object.freeze(['stripEnabled','safeBackline','breakthrough','wallMax']);
  const CD_OPTION_MISSING=Object.freeze({});
  function cdOptionStorageKey(townId,key){return `grepbot:cd-option-v1@${String(location.hostname||location.host||'')}:${String(townId)}:${String(key)}`}
  function cdOptionRead(townId,key){if(!CD_OPTION_FIELDS.includes(String(key)))return null;try{const v=GM_getValue(cdOptionStorageKey(townId,key),CD_OPTION_MISSING);return v===CD_OPTION_MISSING?null:(typeof v==='boolean'?v:null)}catch(_){return null}}
  function cdOptionWrite(townId,key,value){if(!CD_OPTION_FIELDS.includes(String(key)))return false;try{GM_setValue(cdOptionStorageKey(townId,key),!!value);return true}catch(_){return false}}
  function cdApplyStoredOptions(townId,c){if(!c||typeof c!=='object')return c;for(const key of CD_OPTION_FIELDS){const v=cdOptionRead(townId,key);if(v!==null)c[key]=v}return c}
  let cdAliasCacheOwner=null,cdAliasCacheWorld='',cdAliasCache=new Map();
  function cdSyncTownGoal(townId){
    const id=String(townId),latestAll=load(STORE.TOWN_GOALS,{});if(!latestAll||typeof latestAll!=='object'||Array.isArray(latestAll))return false;
    const latest=latestAll[id],local=state.townGoals&&state.townGoals[id];if(!latest||typeof latest!=='object'||Array.isArray(latest))return false;
    const A=cdGoalStamp(latest),B=cdGoalStamp(local);if(!local||A.revision>B.revision||(A.revision===B.revision&&A.at>B.at)){const copy=cdGoalClone(latest);if(copy){if(!copy.cd||typeof copy.cd!=='object')copy.cd={};cdApplyStoredOptions(id,copy.cd);if(!state.townGoals||typeof state.townGoals!=='object'||Array.isArray(state.townGoals))state.townGoals={};state.townGoals[id]=copy;return true}}
    if(local&&local.cd)cdApplyStoredOptions(id,local.cd);
    return false;
  }
  function cdPersistTownGoal(townId){
    const id=String(townId),mine=state.townGoals&&state.townGoals[id];if(!mine)return false;const latest=load(STORE.TOWN_GOALS,{}),merged=latest&&typeof latest==='object'&&!Array.isArray(latest)?cdGoalClone(latest):{};if(!merged)return false;const copy=cdGoalClone(mine)||mine;if(!copy.cd||typeof copy.cd!=='object')copy.cd={};cdApplyStoredOptions(id,copy.cd);merged[id]=copy;const ok=save(STORE.TOWN_GOALS,merged);if(ok)state.townGoals=merged;return ok;
  }
  function cdTownState(townId){
    const g=goalTownCfg(townId); if(!g.cd||typeof g.cd!=='object'||Array.isArray(g.cd))g.cd={};
    const c=g.cd;
    const revision=gbNum(c.revision);if(revision==null||revision<1)c.revision=1;else c.revision=Math.floor(revision);
    if(typeof c.stripEnabled!=='boolean')c.stripEnabled=false;
    if(typeof c.safeBackline!=='boolean')c.safeBackline=false;
    if(typeof c.breakthrough!=='boolean')c.breakthrough=false;
    // Preserve historical profile semantics on first migration: defense cities
    // default to a max wall, other City Designer profiles default to no wall.
    if(typeof c.wallMax!=='boolean')c.wallMax=cdCanonicalProfile(g.profile)==='cd_defense';
    if(typeof c.stripStarted!=='boolean')c.stripStarted=false;
    if(typeof c.stripFinalized!=='boolean')c.stripFinalized=false;
    if(typeof c.landDocksFinalized!=='boolean')c.landDocksFinalized=false;
    cdApplyStoredOptions(townId,c);
    return c;
  }
  function cdProfileRevision(townId){return +cdTownState(townId).revision||1}
  function cdBumpRevision(townId,why){const c=cdTownState(townId);c.revision=(+c.revision||0)+1;c.landDocksFinalized=false;c.lastRevisionWhy=String(why||'change');c.lastRevisionAt=Date.now();cdPersistTownGoal(townId);return c.revision}
  function cdSetOption(townId,key,value){cdSyncTownGoal(townId);const c=cdTownState(townId);if(!CD_OPTION_FIELDS.includes(String(key)))return false;const v=!!value;if(c[key]===v)return true;if(!cdOptionWrite(townId,key,v))return false;c[key]=v;
    // Authorization can pause a strip, but once final-mode was entered we keep
    // final building targets so toggling a safety/tactical option never rebuilds
    // temporary Senate/wall levels only to demolish them again later.
    if((key==='stripEnabled'||key==='safeBackline')&&!v)c.stripStarted=false;
    cdBumpRevision(townId,'option:'+key);goalPlanTown(townId);return true}
  function cdGameDataMap(kind){try{const gd=gameUw().GameData||{};return gd[kind]||{}}catch(_){return {}}}
  function cdFindId(kind,candidates){
    let gd=null;try{gd=gameUw().GameData||null}catch(_){}const world=String(location.hostname||location.host||'');
    if(gd!==cdAliasCacheOwner||world!==cdAliasCacheWorld){cdAliasCacheOwner=gd;cdAliasCacheWorld=world;cdAliasCache=new Map()}
    const list=candidates||[],key=String(kind)+'|'+list.join(',');if(cdAliasCache.has(key))return cdAliasCache.get(key);
    const map=(gd&&gd[kind])||cdGameDataMap(kind);for(const id of list)if(Object.prototype.hasOwnProperty.call(map,id)){cdAliasCache.set(key,id);return id}
    return null;
  }
  function cdUnitId(role){
    const c={slinger:['slinger'],lightship:['attack_ship','light_ship'],bireme:['bireme'],trireme:['trireme'],fast:['small_transporter','fast_transport_ship','small_transport'],sword:['sword'],archer:['archer'],hoplite:['hoplite']};
    return cdFindId('units',c[role]||[role])
  }
  function cdResearchId(role){
    const c={architecture:['architecture'],crane:['crane'],slinger:['slinger'],meteorology:['meteorology'],trainer:['trainer','instructor'],shipwright:['shipwright'],lightship:['attack_ship','light_ship'],conscription:['conscription','mandatory_military_service'],fast:['small_transporter','fast_transport_ship','small_transport'],plow:['plow'],bunks:['bunks','berth','berths'],phalanx:['phalanx'],mathematics:['mathematics'],ram:['ram'],cartography:['cartography'],bireme:['bireme'],trireme:['trireme'],archer:['archer'],hoplite:['hoplite'],breakthrough:['breakthrough','penetration']};
    return cdFindId('researches',c[role]||[role])
  }
  function cdUnitPop(unit){const d=unit&&gbGameDataLookup('units',unit),n=gbNum(d&&(d.population??d.pop));return n!=null&&n>0?n:null}
  function cdResearchNeedAcademy(tech){const d=tech&&gbGameDataLookup('researches',tech);if(!d)return null;const n=gbNum(d.academy_level??d.required_academy_level??d.building_level??d.level);return n!=null&&n>=0?n:0}
  function cdResearchRoles(profile,townId){
    const canon=cdCanonicalProfile(profile), c=cdTownState(townId);let roles=['architecture','crane'];
    if(canon==='cd_slinger_50ls')roles=roles.concat(['slinger','meteorology','trainer','shipwright','lightship','conscription','fast','plow','bunks','phalanx','mathematics','ram','cartography']);
    else if(canon==='cd_bireme')roles=roles.concat(['bireme','shipwright','plow','mathematics','ram','cartography']);
    else if(canon==='cd_lightship')roles=roles.concat(['lightship','shipwright','plow','mathematics','ram','cartography']);
    else if(canon==='cd_trireme')roles=roles.concat(['trireme','shipwright','plow','mathematics','ram','cartography']);
    else if(canon==='cd_defense')roles=roles.concat(['archer','hoplite','trainer','conscription','fast','plow','bunks','phalanx','cartography']);
    if(c.breakthrough&&canon==='cd_slinger_50ls')roles.push('breakthrough');
    return [...new Set(roles)];
  }
  function cdResearchTargets(townId){
    const g=goalTownCfg(townId),canon=cdCanonicalProfile(g.profile);if(!cdIsProfile(canon))return {};
    const out={},unresolved=[];let order=0;
    for(const role of cdResearchRoles(canon,townId)){const id=cdResearchId(role);if(id)out[id]={order:order++,tgt:1,cdRole:role};else unresolved.push(role)}
    out.__cdUnresolved=unresolved;return out;
  }
  function cdQueuedResearchIds(info){
    const out=new Set();if(!info||!Array.isArray(info.orders))return out;
    for(const o of info.orders){const id=researchOrderTechId(o);if(id!=null)out.add(String(id))}
    return out;
  }
  function cdResearchCapacityState(townId,targets){
    const t=targets||cdResearchTargets(townId),info=researchTownTechs(townId);if(!info||!info.techs||!info.ordersKnown)return {known:false,feasible:false,why:'research-state-unreadable'};
    const max=abMaxLevel('academy'),per=researchConstant('points_per_academy_level');if(max==null||per==null||!(per>0))return {known:false,feasible:false,why:'academy-capacity-unreadable'};
    if(info.library==null)return {known:false,feasible:false,why:'library-unreadable'};
    let lib=0;if(info.library===1){lib=researchConstant('points_per_library_level');if(lib==null)return {known:false,feasible:false,why:'library-capacity-unreadable'}}
    const spent=researchPointsSpent(info);if(spent==null)return {known:false,feasible:false,why:'research-points-unreadable'};
    const queued=cdQueuedResearchIds(info);let missing=0;
    for(const [tech,v] of Object.entries(t||{})){
      if(tech==='__cdUnresolved'||!v||!v.tgt||info.techs[tech]||queued.has(String(tech)))continue;
      const pts=researchPointCost(tech);if(pts==null)return {known:false,feasible:false,why:'target-points-unreadable'};missing+=pts;
    }
    const maxN = gbNum(max);
    const required=spent+missing,maxCapacity=Math.max(0,maxN!=null?maxN:0)*per+lib;
    return {known:true,feasible:required<=maxCapacity,required,maxCapacity,spent,missing,queued:queued.size,why:required<=maxCapacity?'ok':`research-points:${required}/${maxCapacity}`};
  }
  function cdAcademyTarget(townId,targets){
    const info=researchTownTechs(townId), max=abMaxLevel('academy');let need=30;
    for(const [tech,t] of Object.entries(targets||{})){if(tech==='__cdUnresolved'||!t||!t.tgt)continue;const n=cdResearchNeedAcademy(tech);if(n!=null)need=Math.max(need,n)}
    if(info){
      const spent=researchPointsSpent(info),queued=cdQueuedResearchIds(info);let missing=0;
      if(spent!=null&&info.techs){for(const [tech,t] of Object.entries(targets||{})){if(tech==='__cdUnresolved'||!t||!t.tgt||info.techs[tech]||queued.has(String(tech)))continue;const pts=researchPointCost(tech);if(pts==null){missing=null;break}missing+=pts}}
      const per=researchConstant('points_per_academy_level');const lib=info.library===1?researchConstant('points_per_library_level'):0;
      if(spent!=null&&missing!=null&&per!=null&&per>0&&lib!=null){need=Math.max(need,Math.ceil(Math.max(0,spent+missing-lib)/per))}
    }
    return max==null?need:Math.min(max,need)
  }
  function cdBaseBuild(profile,townId){
    const canon=cdCanonicalProfile(profile),cap=(id,fallback)=>{const n=abMaxLevel(id);return n==null?fallback:Math.max(0,+n||0)},rt=cdResearchTargets(townId),acad=cdAcademyTarget(townId,rt);
    const base={main:Math.min(24,cap('main',24)),storage:cap('storage',35),farm:cap('farm',45),academy:Math.min(acad,cap('academy',acad)),market:Math.min(20,cap('market',20)),hide:Math.min(10,cap('hide',10)),temple:Math.min(15,cap('temple',15))};
    if(canon==='cd_slinger_50ls')Object.assign(base,{barracks:cap('barracks',30),docks:cap('docks',30),lumber:Math.min(40,cap('lumber',40)),stoner:Math.min(40,cap('stoner',40)),ironer:Math.min(40,cap('ironer',40)),thermal:Math.min(1,cap('thermal',1))});
    if(canon==='cd_bireme')Object.assign(base,{barracks:Math.min(5,cap('barracks',5)),docks:cap('docks',30),lumber:Math.min(40,cap('lumber',40)),stoner:Math.min(40,cap('stoner',40)),ironer:Math.min(30,cap('ironer',30)),thermal:Math.min(1,cap('thermal',1))});
    if(canon==='cd_lightship')Object.assign(base,{barracks:Math.min(5,cap('barracks',5)),docks:cap('docks',30),lumber:Math.min(40,cap('lumber',40)),stoner:Math.min(25,cap('stoner',25)),ironer:Math.min(40,cap('ironer',40)),thermal:Math.min(1,cap('thermal',1))});
    if(canon==='cd_trireme')Object.assign(base,{barracks:Math.min(5,cap('barracks',5)),docks:cap('docks',30),lumber:Math.min(40,cap('lumber',40)),stoner:Math.min(40,cap('stoner',40)),ironer:Math.min(40,cap('ironer',40)),thermal:Math.min(1,cap('thermal',1))});
    if(canon==='cd_defense')Object.assign(base,{barracks:cap('barracks',30),docks:Math.min(20,cap('docks',20)),lumber:Math.min(40,cap('lumber',40)),stoner:Math.min(35,cap('stoner',35)),ironer:Math.min(40,cap('ironer',40)),wall:cap('wall',25),thermal:Math.min(1,cap('thermal',1)),tower:Math.min(1,cap('tower',1))});
    const c=cdTownState(townId);
    if(c.wallMax)base.wall=cap('wall',25);else delete base.wall;
    const lv=abCurrentLevels(townId);if(lv){const left=['thermal','library','lighthouse','theater'].find(id=>+(lv[id]||0)>0);if(left&&left!=='thermal')delete base.thermal;const right=['tower','statue','oracle','trade_office'].find(id=>+(lv[id]||0)>0);if(right&&right!=='tower')delete base.tower}
    return base;
  }
  function cdStripBuild(profile,townId){const out=Object.assign({},cdBaseBuild(profile,townId)),c=cdTownState(townId);out.main=Math.min(15,out.main||15);const wallMax=abMaxLevel('wall');out.wall=c.wallMax?(wallMax==null?25:Math.max(0,+wallMax||0)):0;return out}
  function cdFinalBuild(profile,townId){const c=cdTownState(townId);return (c.stripStarted||c.stripFinalized)?cdStripBuild(profile,townId):cdBaseBuild(profile,townId)}
  function cdBuildTargets(townId){const g=goalTownCfg(townId);return cdFinalBuild(g.profile,townId)}
  function cdBuildOrder(townId){const canon=cdCanonicalProfile(goalTownCfg(townId).profile),wall=!!cdTownState(townId).wallMax;const common=['farm','storage','main','lumber','stoner','ironer','market','hide','academy','temple'];let out;if(canon==='cd_slinger_50ls')out=['farm','storage','main','lumber','stoner','ironer','barracks','academy','docks','market','hide','temple','thermal'];else if(canon==='cd_defense')out=['farm','storage','main','lumber','ironer','stoner','barracks','academy','docks','market','hide','temple','thermal','tower'];else out=['farm','storage','main','lumber','stoner','ironer','docks','academy','market','hide','temple','thermal','lighthouse'].filter(x=>common.includes(x)||['docks','thermal','lighthouse'].includes(x));if(wall&&!out.includes('wall'))out.unshift('wall');return out}
  function cdQueuedUnitAmount(townId,unit){try{return +recruitQueuedAmount(townId,unit)||0}catch(_){return 0}}
  function cdAvailablePopulation(townId){try{const t=gbTownModel(townId),n=t&&t.getAvailablePopulation?gbNum(t.getAvailablePopulation()):null;return n!=null?Math.max(0,n):null}catch(_){return null}}
  function cdCountsWithQueued(townId,units){const st=goalUnitCountsState(townId);if(!st.known)return null;const current=st.counts,out={};for(const u of units.filter(Boolean))out[u]=Math.max(0,+current[u]||0)+cdQueuedUnitAmount(townId,u);return out}
  function cdSolveLandBudget(budget,fixedShipCount,shipPop,mainPop,transportPop,capacity,minTransport){
    if(![budget,fixedShipCount,shipPop,mainPop,transportPop,capacity].every(Number.isFinite)||budget<0||mainPop<=0||transportPop<=0||capacity<=0)return {feasible:false};
    const fixed=fixedShipCount*shipPop;if(fixed>budget)return {feasible:false};const mt=minTransport||0,maxMain=Math.floor((budget-fixed)/mainPop);
    const fit=main=>fixed+main*mainPop+Math.max(mt,Math.ceil(main*mainPop/capacity))*transportPop<=budget;if(!fit(0))return {feasible:false};
    let lo=0,hi=maxMain;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(fit(mid))lo=mid;else hi=mid-1}
    const main=lo,landPopulation=main*mainPop,transport=Math.max(mt,Math.ceil(landPopulation/capacity)),used=fixed+landPopulation+transport*transportPop;
    return {feasible:true,main,transport,fixed:fixedShipCount,used,free:budget-used,landPopulation};
  }
  function cdSolveDefenseBudget(budget,pops,transportPop,capacity,mins){
    const budgetN=gbNum(budget),swordPop=gbNum(pops&&pops.sword),archerPop=gbNum(pops&&pops.archer),hoplitePop=gbNum(pops&&pops.hoplite),transportPopN=gbNum(transportPop),capacityN=gbNum(capacity);
    if(budgetN==null||budgetN<0||swordPop==null||archerPop==null||hoplitePop==null)return {feasible:false};const den=swordPop+archerPop+2*hoplitePop;
    if(!(den>0)||transportPopN==null||transportPopN<0||capacityN==null||!(capacityN>0))return {feasible:false};budget=budgetN;transportPop=transportPopN;capacity=capacityN;pops={sword:swordPop,archer:archerPop,hoplite:hoplitePop};
    const m=mins||{},evalBlocks=blocks=>{const sword=Math.max(m.sword||0,blocks),archer=Math.max(m.archer||0,blocks),hoplite=Math.max(m.hoplite||0,2*blocks),landPopulation=sword*pops.sword+archer*pops.archer+hoplite*pops.hoplite,transport=Math.max(m.transport||0,Math.ceil(landPopulation/capacity)),used=landPopulation+transport*transportPop;return{sword,archer,hoplite,transport,landPopulation,used}};
    const zero=evalBlocks(0);if(zero.used>budget)return {feasible:false};let lo=0,hi=Math.floor(budget/den);while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(evalBlocks(mid).used<=budget)lo=mid;else hi=mid-1}
    const e=evalBlocks(lo);return {feasible:true,sword:e.sword,archer:e.archer,hoplite:e.hoplite,transport:e.transport,landPopulation:e.landPopulation,used:e.used,free:budget-e.used};
  }
  function cdRecruitTargets(townId){
    const g=goalTownCfg(townId),canon=cdCanonicalProfile(g.profile);if(!cdIsProfile(canon))return {};
    const free=cdAvailablePopulation(townId);if(free==null)return {__cdFeasible:false,__cdUnreadable:true,__cdReason:'population-unreadable'};
    const roles=canon==='cd_slinger_50ls'?['slinger','lightship','fast']:canon==='cd_bireme'?['bireme']:canon==='cd_lightship'?['lightship']:canon==='cd_trireme'?['trireme']:['sword','archer','hoplite','fast'];
    const ids={};for(const r of roles)ids[r]=cdUnitId(r);if(Object.values(ids).some(x=>!x))return {__cdFeasible:false,__cdUnreadable:true,__cdReason:'unit-model-unreadable'};
    const vals=Object.values(ids),counts=cdCountsWithQueued(townId,vals);if(!counts)return {__cdFeasible:false,__cdUnreadable:true,__cdReason:'unit-inventory-unreadable'};let budget=free;for(const u of vals){const p=cdUnitPop(u);if(p==null)return {__cdFeasible:false,__cdUnreadable:true,__cdReason:'unit-population-unreadable'};budget+=(counts[u]||0)*p}
    const out={};
    if(canon==='cd_slinger_50ls'){
      const pMain=cdUnitPop(ids.slinger),pShip=cdUnitPop(ids.lightship),pTr=cdUnitPop(ids.fast);if([pMain,pShip,pTr].some(x=>x==null))return {__cdFeasible:false,__cdUnreadable:true,__cdReason:'unit-population-unreadable'};
      const fixed=Math.max(50,counts[ids.lightship]||0),minTr=counts[ids.fast]||0;const bunks=cdResearchId('bunks');let cap=10;try{const info=researchTownTechs(townId);if(bunks&&info&&info.techs&&info.techs[bunks])cap=16}catch(_){}
      const sol=cdSolveLandBudget(budget,fixed,pShip,pMain,pTr,cap,minTr);if(!sol.feasible)return {__cdFeasible:false};out[ids.fast]=sol.transport;out[ids.lightship]=sol.fixed;out[ids.slinger]=sol.main;
    }else if(canon==='cd_defense'){
      const ps={sword:cdUnitPop(ids.sword),archer:cdUnitPop(ids.archer),hoplite:cdUnitPop(ids.hoplite)},pTr=cdUnitPop(ids.fast);if(Object.values(ps).concat([pTr]).some(x=>x==null))return {__cdFeasible:false,__cdUnreadable:true,__cdReason:'unit-population-unreadable'};
      const bunks=cdResearchId('bunks');let cap=10;try{const info=researchTownTechs(townId);if(bunks&&info&&info.techs&&info.techs[bunks])cap=16}catch(_){}
      const sol=cdSolveDefenseBudget(budget,ps,pTr,cap,{sword:counts[ids.sword]||0,archer:counts[ids.archer]||0,hoplite:counts[ids.hoplite]||0,transport:counts[ids.fast]||0});if(!sol.feasible)return {__cdFeasible:false};out[ids.fast]=sol.transport;out[ids.sword]=sol.sword;out[ids.archer]=sol.archer;out[ids.hoplite]=sol.hoplite;
    }else{const u=ids[canon==='cd_bireme'?'bireme':canon==='cd_trireme'?'trireme':'lightship'],pop=cdUnitPop(u);if(pop==null)return {__cdFeasible:false,__cdUnreadable:true,__cdReason:'unit-population-unreadable'};out[u]=Math.floor(budget/pop)}
    return out;
  }
  function cdResearchDone(townId){const t=cdResearchTargets(townId),info=researchTownTechs(townId);if(!info||!info.techs)return false;if((t.__cdUnresolved||[]).length)return false;for(const [id,v] of Object.entries(t))if(id!=='__cdUnresolved'&&v&&v.tgt&&!info.techs[id])return false;return true}
  function cdResearchExecutable(townId){const t=cdResearchTargets(townId),info=researchTownTechs(townId);if(!info||!info.techs)return false;const cap=cdResearchCapacityState(townId,t);if(cap.known&&!cap.feasible)return false;const queued=cdQueuedResearchIds(info);for(const [id,v] of Object.entries(t))if(id!=='__cdUnresolved'&&v&&v.tgt&&!info.techs[id]&&!queued.has(String(id)))return true;return false}
  function cdCompositionResearchReady(townId){
    const canon=cdCanonicalProfile(goalTownCfg(townId).profile);if(!cdIsProfile(canon))return false;
    const info=researchTownTechs(townId);if(!info||!info.techs)return false;
    let roles=[];
    if(canon==='cd_slinger_50ls')roles=['slinger','lightship','fast','bunks'];
    else if(canon==='cd_bireme')roles=['bireme'];
    else if(canon==='cd_lightship')roles=['lightship'];
    else if(canon==='cd_trireme')roles=['trireme'];
    else if(canon==='cd_defense')roles=['archer','hoplite','fast','bunks'];
    for(const role of roles){const id=cdResearchId(role);if(!id||!info.techs[id])return false}
    return true;
  }
  const CD_CORE_BUILDINGS=Object.freeze(['main','storage','farm','academy','temple','barracks','docks','market','hide','lumber','stoner','ironer','wall']);
  // Authoritative building levels for auto-build + CD. Missing specials
  // (theater/thermal/…) are normal — GameData attrs often omit unbuilt specials —
  // so only CD_CORE_BUILDINGS fail closed. The old `(max>0) → null` path made
  // abCurrentLevels return null for every town that lacked one special key, which
  // silently killed automatic construction after the 6.x merge.
  function abActualLevels(townId){
    try{
      const t=abGetTown(townId);if(!t)return null;
      const b=t&&(t.getBuildings?t.getBuildings():(t.buildings&&t.buildings()));
      const a=b&&(b.attributes||b);if(!a||typeof a!=='object')return null;
      const out={};
      for(const id of AB_BUILDINGS){
        let n=null;
        if(Object.prototype.hasOwnProperty.call(a,id)) n=gbNum(a[id]);
        if(n==null&&b&&typeof b.get==='function'){
          try{n=gbNum(b.get(id))}catch(_){}
        }
        if(n!=null&&n>=0){out[id]=n;continue}
        if(CD_CORE_BUILDINGS.includes(id))return null;
        out[id]=0;
      }
      return out;
    }catch(_){return null}
  }
  function cdActualLevels(townId){return abActualLevels(townId)}
  function cdBuildDone(townId){const levels=cdActualLevels(townId),targets=cdBuildTargets(townId);if(!levels)return false;for(const [id,n] of Object.entries(targets))if(+n>0&&+(levels[id]||0)<+n)return false;return true}
  function cdAuxDone(townId){const canon=cdCanonicalProfile(goalTownCfg(townId).profile),tar=cdRecruitTargets(townId),st=goalUnitCountsState(townId);if(!st.known||!tar||tar.__cdFeasible===false)return false;const cur=st.counts;if(canon==='cd_slinger_50ls'){const tr=cdUnitId('fast'),ls=cdUnitId('lightship');return !!tr&&!!ls&&(+cur[tr]||0)>=+tar[tr]&&(+cur[ls]||0)>=+tar[ls]}if(canon==='cd_defense'){const tr=cdUnitId('fast');return !!tr&&(+cur[tr]||0)>=+tar[tr]}return true}
  function cdArmyDone(townId){const tar=cdRecruitTargets(townId),st=goalUnitCountsState(townId);if(!st.known||!tar||tar.__cdFeasible===false)return false;const cur=st.counts;for(const [u,n] of Object.entries(tar)){if(u.startsWith('__'))continue;if((+cur[u]||0)<+n)return false}return true}
  function cdThreatState(townId){try{const snap=dodgeIncomingSnapshot();if(!snap||snap.known!==true||!Array.isArray(snap.moves))return {known:false,threatened:false};return {known:true,threatened:snap.moves.some(m=>m&&String(m.dest)===String(townId))}}catch(_){return {known:false,threatened:false}}}
  function cdCanStartStrip(townId){const g=goalTownCfg(townId),c=cdTownState(townId);if(!cdIsProfile(g.profile)||!c.stripEnabled||!c.safeBackline)return {ok:false,why:'strip-not-authorized'};const th=cdThreatState(townId);if(!th.known)return {ok:false,why:'threat-unreadable'};if(th.threatened)return {ok:false,why:'under-attack'};if(!cdBuildDone(townId))return {ok:false,why:'development-incomplete'};if(!cdResearchDone(townId))return {ok:false,why:'research-incomplete'};if(!cdAuxDone(townId))return {ok:false,why:'aux-incomplete'};if(!cdArmyDone(townId))return {ok:false,why:'army-incomplete'};return {ok:true}}
  function cdMaybeLatchStrip(townId,persistNow=true){cdSyncTownGoal(townId);const c=cdTownState(townId);if(c.stripStarted)return true;const v=cdCanStartStrip(townId);if(!v.ok)return false;c.stripStarted=true;c.stripFinalized=true;c.stripStartedAt=Date.now();if(persistNow)cdPersistTownGoal(townId);return true}
  function cdRollbackProvisionalStrip(townId,ref){const clear=c=>{if(!c)return;c.stripStarted=false;c.stripFinalized=false;delete c.stripStartedAt};clear(ref);try{clear(cdTownState(townId))}catch(_){}cdPersistTownGoal(townId)}
  function cdAcademyDemolitionSafe(townId,targetLevel){
    const info=researchTownTechs(townId);if(!info||info.academy==null||!info.techs||!info.ordersKnown)return {ok:false,why:'research-points-unreadable'};
    const per=researchConstant('points_per_academy_level'),spent=researchPointsSpent(info);if(per==null||!(per>0)||spent==null)return {ok:false,why:'research-points-unreadable'};
    const tl=gbNum(targetLevel);if(tl==null)return {ok:false,why:'target-level-unreadable'};let cap=Math.max(0,tl)*per;if(info.library==null)return {ok:false,why:'library-unreadable'};if(info.library===1){const lib=researchConstant('points_per_library_level');if(lib==null)return {ok:false,why:'library-points-unreadable'};cap+=lib}
    return spent<=cap?{ok:true,freeAfter:cap-spent}:{ok:false,why:`research-points:${spent}/${cap}`};
  }
  function cdDemolitionCandidate(townId,levelsIgnored){
    const g=goalTownCfg(townId);if(!cdIsProfile(g.profile))return null;
    // Destructive work is authorized only from an empty, readable real queue
    // and from authoritative building attributes. Projected queued levels are
    // never allowed to drive another teardown/counter-teardown.
    const q=abQueueInfo(townId);if(!q.known||q.len!==0)return null;const levels=abActualLevels(townId);if(!levels)return null;
    const gate=cdCanStartStrip(townId);if(!gate.ok)return null;const final=cdStripBuild(g.profile,townId);
    for(const id of ['main','wall','barracks','docks','academy','market','temple','lumber','stoner','ironer']){
      const want=gbNum(final[id]),have=gbNum(levels[id]);if(want==null||have==null)continue;if(have<=want)continue;const targetLevel=have-1;
      if(id==='academy'&&!cdAcademyDemolitionSafe(townId,targetLevel).ok)continue;
      return {mode:'teardown',building:id,forTarget:id,targetLevel,cdRevision:cdProfileRevision(townId),reason:'city-designer strip'};
    }
    return null;
  }
  function cdNextDemolition(townId,levels){return cdDemolitionCandidate(townId,levels)}
  function cdPhase(townId){
    const g=goalTownCfg(townId);if(!cdIsProfile(g.profile))return 'OFF';const c=cdTownState(townId);
    if(c.stripStarted||c.stripFinalized){const d=cdDemolitionCandidate(townId,abCurrentLevels(townId));if(d)return 'STRIP';if(!c.stripEnabled||!c.safeBackline)return 'STRIP_PAUSED';return 'MAINTAIN'}
    if(!cdBuildDone(townId))return 'DEVELOP';const rt=cdResearchTargets(townId),cap=cdResearchCapacityState(townId,rt);
    if((rt.__cdUnresolved||[]).length&&!cdResearchExecutable(townId))return 'BLOCKED_SCHEMA';if(cap.known&&!cap.feasible)return 'BLOCKED_POINTS';if(!cdResearchDone(townId))return 'RESEARCH';if(!cdAuxDone(townId))return 'AUXILIARIES';if(!cdArmyDone(townId))return 'ARMY';return 'READY'
  }
  function cdHasAnyTown(){let ids=[];try{ids=Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{})}catch(_){}return ids.some(id=>cdIsProfile(goalTownCfg(id).profile))}
  function cityDesignerHasExecutableWork(kind){if(!cdHasAnyTown())return false;let ids=[];try{ids=Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{})}catch(_){};for(const id of ids){if(!cdIsProfile(goalTownCfg(id).profile))continue;if(kind==='build'){const levels=abCurrentLevels(id);if(!levels)return true;const tar=cdBuildTargets(id);if(Object.entries(tar).some(([b,n])=>+n>0&&+(levels[b]||0)<+n))return true;if(cdDemolitionCandidate(id,levels))return true}else if(kind==='research'){if(cdResearchExecutable(id))return true}else if(kind==='recruit'){
        if(!cdBuildDone(id)||!cdCompositionResearchReady(id))continue;if(!cdArmyDone(id))return true}}return false}
  function cdEffective(townId){const g=goalTownCfg(townId),canon=cdCanonicalProfile(g.profile),p=CD_PROFILE_DEFAULTS[canon]||{label:canon};const rt=cdResearchTargets(townId),research={};for(const [id,v] of Object.entries(rt))if(id!=='__cdUnresolved'&&v&&v.tgt)research[id]=1;const units=cdRecruitTargets(townId),clean={};for(const [u,n] of Object.entries(units||{})){const value=gbNum(n);if(!u.startsWith('__')&&value!=null&&value>=0)clean[u]=value}return {profile:canon,label:p.label||canon,build:cdBuildTargets(townId),research,units:clean,reserve:{hard:{},soft:{}},defensive:canon==='cd_defense'?0.8:0.2,resource:{wood:0,stone:0,iron:0},cd:{revision:cdProfileRevision(townId),phase:cdPhase(townId),feasible:units&&units.__cdFeasible!==false,unresolvedResearch:rt.__cdUnresolved||[]}}}
