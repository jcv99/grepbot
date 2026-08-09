  function qolBindActivityPause() {
    if (qolBindActivityPause._bound) return;
    qolBindActivityPause._bound = true;
    const bump = () => bumpUserActivity();
    ['mousemove', 'keydown', 'mousedown', 'touchstart'].forEach(ev => {
      gbListen(document, ev, bump, { passive: true });
    });
    gbListen(document, 'visibilitychange', () => {
      if (!document.hidden) bumpUserActivity();
    });
  }
  function qolSaveTemplate(name) {
    if (!name) return;
    if (!state.cityTemplates) state.cityTemplates = {};
    state.cityTemplates[name] = {
      abTargets: JSON.parse(JSON.stringify(state.abTargets || {})),
      researchTargets: JSON.parse(JSON.stringify(state.researchTargets || {})),
      recruitTargets: JSON.parse(JSON.stringify(state.recruitTargets || {})),
      savedAt: Date.now(),
    };
    save(STORE.CITY_TEMPLATES, state.cityTemplates);
    gbLog(`template: saved "${name}"`);
    flash('template saved: ' + name);
  }
  function qolApplyTemplate(name) {
    const t = state.cityTemplates && state.cityTemplates[name];
    if (!t) { flash('template missing'); return; }

    if (t.abTargets) {
      state.abTargets = JSON.parse(JSON.stringify(t.abTargets));
      save(STORE.AB_TARGETS, state.abTargets);
    }
    if (t.researchTargets) {
      state.researchTargets = JSON.parse(JSON.stringify(t.researchTargets));
      save(STORE.RESEARCH_TARGETS, state.researchTargets);
    }
    if (t.recruitTargets) {
      state.recruitTargets = JSON.parse(JSON.stringify(t.recruitTargets));
      save(STORE.RECRUIT_TARGETS, state.recruitTargets);
    }
    gbLog(`template: applied "${name}"`);
    flash('template applied: ' + name);
    try { renderAbQueue && renderAbQueue(); } catch (_) {}
  }
  function qolSetTownGroup(groupName, townIds) {
    if (!state.townGroups) state.townGroups = {};
    state.townGroups[groupName] = (townIds || []).map(String);
    save(STORE.TOWN_GROUPS, state.townGroups);
  }
  function qolApplyGroupTemplate(groupName, templateName) {
    const ids = (state.townGroups && state.townGroups[groupName]) || [];
    const t = state.cityTemplates && state.cityTemplates[templateName];
    if (!t || !ids.length) { flash('group/template missing'); return; }

    if (t.recruitTargets) {
      const sample = Object.values(t.recruitTargets)[0] || t.recruitTargets;
      if (!state.recruitTargets) state.recruitTargets = {};
      ids.forEach(id => { state.recruitTargets[id] = JSON.parse(JSON.stringify(sample)); });
      save(STORE.RECRUIT_TARGETS, state.recruitTargets);
    }
    if (t.abTargets) {
      state.abTargets = JSON.parse(JSON.stringify(t.abTargets));
      save(STORE.AB_TARGETS, state.abTargets);
    }
    if (t.researchTargets) {
      state.researchTargets = JSON.parse(JSON.stringify(t.researchTargets));
      save(STORE.RESEARCH_TARGETS, state.researchTargets);
    }
    gbLog(`group "${groupName}": applied template "${templateName}" → ${ids.length} towns`);
  }


  function renderGoals() {
    const sec=panel&&panel.querySelector('section[data-tab=overview]');if(!sec||sec.hidden)return;const box=sec.querySelector('.goals-panel');if(!box)return;box.replaceChildren();
    let ids=[];try{ids=Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{})}catch(_){};const profiles=goalProfiles();
    const rerender=()=>{renderGoals();renderPlanner();renderDashboard();};
    for(const tid of ids){let name=tid;try{const t=gbTownModel(tid);name=(t&&t.getName&&t.getName())||name}catch(_){} const plan=goalPlanTown(tid);
      const head=document.createElement('div');head.style.cssText='display:flex;gap:4px;align-items:center;padding:4px;border-bottom:1px solid #333';const b=document.createElement('b');b.textContent=`${name} · ${plan.progress}%`;head.appendChild(b);
      const edit=document.createElement('button');edit.textContent='Edit';edit.title='Edit per-town goal overrides/reserves as JSON';edit.style.cssText='font-size:8px;padding:1px 4px';edit.addEventListener('click',()=>{const cur=goalTownCfg(tid),raw=prompt('Town goal overrides JSON\nKeys: build, research, units, reserve:{hard,soft}',JSON.stringify({build:cur.build,research:cur.research,units:cur.units,reserve:cur.reserve},null,2));if(raw==null)return;try{if(!goalSetTownOverrides(tid,JSON.parse(raw)))throw new Error('invalid object');rerender()}catch(e){flash('invalid goal JSON')}});head.appendChild(edit);
      const rec=document.createElement('button');rec.textContent='Recalc';rec.style.cssText='font-size:8px;padding:1px 4px';rec.addEventListener('click',()=>{goalPlanTown(tid);rerender()});head.appendChild(rec);
      const reset=document.createElement('button');reset.textContent='Reset Q';reset.title='Clear virtual-queue order/block/mandatory overrides';reset.style.cssText='font-size:8px;padding:1px 4px';reset.addEventListener('click',()=>{goalQueueReset(tid);rerender()});head.appendChild(reset);
      const sel=document.createElement('select');sel.style.cssText='background:#111;color:#cfc;border:1px solid #333;font-size:9px;margin-left:auto';for(const [id,p] of Object.entries(profiles)){const o=document.createElement('option');o.value=id;o.textContent=p.label||id;sel.appendChild(o)}sel.value=plan.profile;sel.addEventListener('change',()=>{goalSetProfile(tid,sel.value);rerender()});head.appendChild(sel);box.appendChild(head);
      const lines=(plan.actions||[]).slice(0,12);if(!lines.length){const e=document.createElement('div');e.textContent='  objetivo cumplido / sin acciones';e.style.cssText='padding:2px 6px;color:#777';box.appendChild(e)}else for(const a of lines){const row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:1fr auto;gap:3px;padding:2px 4px;border-bottom:1px solid #1e1e1e;align-items:center';const text=document.createElement('span');const c=a.cost||{},cost=[c.wood||0,c.stone||0,c.iron||0].join('/');text.textContent=`${a.mandatory?'! ':''}${a.kind} ${a.id}${a.level?' → '+a.level:''}${a.amount?' ×'+a.amount:''} · ${a.status} · ${cost}${a.why?' · '+a.why:''}`;row.appendChild(text);const acts=document.createElement('span');acts.style.cssText='display:flex;gap:2px';const mk=(label,title,fn)=>{const x=document.createElement('button');x.textContent=label;x.title=title;x.style.cssText='font-size:8px;padding:0 3px';x.addEventListener('click',()=>{fn();rerender()});acts.appendChild(x)};mk('↑','move earlier',()=>goalQueueMove(tid,a.queueKey,-1));mk('↓','move later',()=>goalQueueMove(tid,a.queueKey,1));mk(a.status==='user-blocked'?'ON':'B','block/unblock',()=>goalQueueToggleBlock(tid,a.queueKey));mk(a.mandatory?'☆':'!','mandatory priority',()=>goalQueueToggleMandatory(tid,a.queueKey));mk('×','suppress until Reset Q',()=>goalQueueHide(tid,a.queueKey));row.appendChild(acts);box.appendChild(row)}
    }
  }


  function plannerFmt(n) { return n == null || !Number.isFinite(+n) ? '?' : Math.floor(+n).toLocaleString(); }
  function renderPlanner() {
    const sec = panel && panel.querySelector('section[data-tab=overview]');
    if (!sec || sec.hidden) return;
    const controls = sec.querySelector('.planner-controls'), box = sec.querySelector('.planner-panel');
    if (!controls || !box) return;
    const cfg=plannerCfgRoot(), g=cfg.global;
    if (!controls.dataset.bound) {
      controls.dataset.bound='1'; controls.replaceChildren();
      for (const mode of ['hard','soft']) for (const k of PLANNER_KEYS) {
        const lab=document.createElement('label'); lab.textContent=`${mode[0].toUpperCase()} ${k.slice(0,3)} `;
        const inp=document.createElement('input'); inp.type='number'; inp.min='0'; inp.style.cssText='width:55px;background:#111;color:#cfc;border:1px solid #333;font-size:9px';
        inp.dataset.mode=mode; inp.dataset.key=k; inp.value=g[mode][k]||0;
        inp.addEventListener('change',()=>{ g[mode][k]=Math.max(0,+inp.value||0); plannerSaveCfg(); renderPlanner(); });
        lab.appendChild(inp); controls.appendChild(lab);
      }
    }
    box.replaceChildren();
    const hdr=document.createElement('div'); hdr.style.cssText='display:grid;grid-template-columns:1.3fr repeat(3,.8fr) .7fr .7fr;gap:3px;padding:3px;color:#888;border-bottom:1px solid #333';
    hdr.textContent=''; ['town','real W/S/I','reserved W/S/I','available W/S/I','pop','merchants'].forEach(x=>{const s=document.createElement('span');s.textContent=x;hdr.appendChild(s)}); box.appendChild(hdr);
    const ids=[]; try{ Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{}).forEach(x=>ids.push(x)); }catch(_){}
    for(const tid of ids){ const s=plannerSnapshot(tid); if(!s) continue; let name=tid; try{const t=gbTownModel(tid); name=(t&&t.getName&&t.getName())||name}catch(_){}
      const row=document.createElement('div'); row.style.cssText='display:grid;grid-template-columns:1.3fr repeat(3,.8fr) .7fr .7fr;gap:3px;padding:3px;border-bottom:1px solid #222';
      const vals=[name,`${plannerFmt(s.live.wood)}/${plannerFmt(s.live.stone)}/${plannerFmt(s.live.iron)}`,`${plannerFmt(s.committed.wood)}/${plannerFmt(s.committed.stone)}/${plannerFmt(s.committed.iron)}`,`${plannerFmt(s.availableSoft.wood)}/${plannerFmt(s.availableSoft.stone)}/${plannerFmt(s.availableSoft.iron)}`,`${plannerFmt(s.availableSoft.population)}`,`${plannerFmt(s.availableSoft.tradeCap)}`];
      vals.forEach(v=>{const e=document.createElement('span');e.textContent=v;row.appendChild(e)}); row.title=`hard reserve ${JSON.stringify(s.reserve.hard)} | soft ${JSON.stringify(s.reserve.soft)} | incoming ${JSON.stringify(s.incoming)}`; box.appendChild(row);
    }
  }

  function qolOverviewData() {
    const uw = gameUw();
    let townN = 0, farmReady = 0, farmTotal = 0, cultureBusy = 0;
    let buildQ = 0, researchQ = 0, caveFill = [];
    try { townN = Object.keys((uw.ITowns && uw.ITowns.towns) || {}).length; } catch (_) {}
    try {
      const rel = ruralRelModels && ruralRelModels();
      if (rel) {
        farmTotal = rel.length;
        const now = gameNow();
        rel.forEach(r => {
          const a = r.attributes || {};
          if (+a.relation_status === 1 && (!a.lootable_at || +a.lootable_at <= now)) farmReady++;
        });
      }
    } catch (_) {}
    try {
      const models = uw.MM && uw.MM.getModels && uw.MM.getModels().Celebration;
      if (models) cultureBusy = Object.keys(models).length;
    } catch (_) {}
    try {
      const bo = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('BuildingOrder');
      if (bo && bo.models) buildQ = bo.models.length;
    } catch (_) {}
    try {
      const ro = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('ResearchOrder');
      if (ro && ro.models) researchQ = ro.models.length;
    } catch (_) {}
    try {
      const ids = (typeof caveListTownIds === 'function') ? caveListTownIds() : [];
      ids.slice(0, 20).forEach(id => {
        const info = typeof caveTownInfo === 'function' ? caveTownInfo(id) : null;
        if (info && info.hideCap) caveFill.push({ id, pct: Math.round(100 * (info.stored || 0) / info.hideCap) });
      });
    } catch (_) {}
    const breakers = Object.keys(state.captchaBreakers || {}).filter(k => captchaPaused(k));
    const pause = {};
    automationPaused(pause);
    return {
      townN, farmReady, farmTotal, cultureBusy, buildQ, researchQ, caveFill,
      breakers, pause: pause.reason || null,
      health: Object.assign({}, moduleHealth),
      globalCaptcha: captchaGlobalUntil > Date.now() ? captchaGlobalUntil : 0,
      userPause: userPausedUntil > Date.now() ? userPausedUntil : 0,
    };
  }

  function renderHealth() {
    const sec=panel&&panel.querySelector('section[data-tab=overview]');if(!sec||sec.hidden)return;const box=sec.querySelector('.health-panel');if(!box)return;box.replaceChildren();
    const names=new Set([...Object.keys(moduleHealth||{}),...Object.keys(state.circuits||{})]);
    if(!names.size){box.textContent='(no module activity yet)';return}
    const hdr=document.createElement('div');hdr.style.cssText='display:grid;grid-template-columns:1fr repeat(5,.7fr);gap:3px;color:#888;border-bottom:1px solid #333;padding:2px';['module','ok/err','timeout','lat ms','last','circuit'].forEach(v=>{const x=document.createElement('span');x.textContent=v;hdr.appendChild(x)});box.appendChild(hdr);
    [...names].sort().forEach(name=>{const h=moduleHealth[name]||{},c=state.circuits&&state.circuits[name];const row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:1fr repeat(5,.7fr);gap:3px;border-bottom:1px solid #222;padding:2px';const age=h.last?fmtSec((Date.now()-h.last)/1000):'-';const vals=[name,`${h.ok||0}/${h.err||0}`,String(h.timeout||0),h.avgLatency==null?'-':String(Math.round(h.avgLatency)),age,c&&c.open?'OPEN':(c&&c.strikes?`strike ${c.strikes}`:'ok')];vals.forEach(v=>{const x=document.createElement('span');x.textContent=v;row.appendChild(x)});box.appendChild(row)})
  }

  // ===== Dashboard + Simulator (v2.0) ========================================
  function simulateTown(townId,horizonHours){const h=Math.max(1,+horizonHours||24),snap=plannerSnapshot(townId),forecast=economyForecast(townId,h*3600),plan=goalPlanTown(townId);if(!snap)return{townId:String(townId),error:'state-unreadable',actions:[]};const stock={wood:snap.availableSoft.wood,stone:snap.availableSoft.stone,iron:snap.availableSoft.iron,population:snap.availableSoft.population};if(forecast&&forecast.production){for(const k of ['wood','stone','iron'])stock[k]+=forecast.production[k]*h}const actions=[];let bottleneck='';for(const a of(plan.actions||[])){if(a.kind==='build'&&a.costExact===false){const why='future build cost requires live recalculation after previous level';actions.push({...a,sim:'waiting',simWhy:why});if(!bottleneck)bottleneck=why;break}const c=plannerNormCost(a.cost);if(!c){actions.push({...a,sim:'blocked:cost'});continue}let ok=true,why='';for(const k of PLANNER_KEYS){if((+c[k]||0)>+(stock[k]||0)){ok=false;why=`${k} ${Math.floor(stock[k]||0)}/${Math.ceil(c[k]||0)}`;break}}if(!ok){actions.push({...a,sim:'waiting',simWhy:why});if(!bottleneck)bottleneck=why;break}for(const k of PLANNER_KEYS)stock[k]-=+c[k]||0;actions.push({...a,sim:'would-run'})}return{townId:String(townId),horizonHours:h,actions,final:stock,bottleneck,productionKnown:!!(forecast&&forecast.productionKnown)}}
  function simulateAccount(horizonHours){let ids=[];try{ids=Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{})}catch(_){};const towns=ids.map(id=>simulateTown(id,horizonHours));return{at:Date.now(),horizonHours:+horizonHours||24,towns,totalActions:towns.reduce((n,t)=>n+t.actions.filter(a=>a.sim==='would-run').length,0),blocked:towns.filter(t=>t.bottleneck).length}}
  let dashboardSimulation=null;
  function renderDashboard() {
    const sec=panel&&panel.querySelector('section[data-tab=overview]');
    if(!sec||sec.hidden)return;
    const sum=sec.querySelector('.dashboard-summary'),time=sec.querySelector('.timeline-panel'),sim=sec.querySelector('.sim-panel'),cards=sec.querySelector('.gb-dashboard-cards');
    if(!sum||!time||!sim)return;
    let ids=[];try{ids=Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{})}catch(_){}
    const threats=dodgeIncomingMovements();
    const unknown=Object.values(state.txState||{}).filter(t=>t&&/^(unknown|manual-review)$/.test(t.state||'')).length;
    const circuits=Object.keys(state.circuits||{}).filter(k=>state.circuits[k]&&state.circuits[k].open);
    const fps=clientFingerprintNow();
    const compatible=Object.values(fps.required).every(Boolean);
    const activeGoals=ids.filter(id=>(goalPlanTown(id).actions||[]).length).length;
    const avgProgress=ids.length?Math.round(ids.reduce((n,id)=>n+goalProgress(id),0)/ids.length):100;
    const pauseInfo={}; const paused=automationPaused(pauseInfo);
    sum.textContent=`towns ${ids.length} · progress ${avgProgress}% · ${activeGoals} objetivo(s) activos · ${unknown} transacción(es) pendientes de revisar · ${circuits.length} circuit breaker abierto(s)`;
    if(cards){
      cards.replaceChildren();
      const data=[
        ['Ciudades',ids.length,activeGoals?`${activeGoals} con trabajo pendiente`:'sin objetivos pendientes'],
        ['Progreso',`${avgProgress}%`,avgProgress>=100?'objetivos completados':'media de objetivos'],
        ['Amenazas',threats.length,threats.length?'requieren revisión':'sin entradas hostiles detectadas'],
        ['Sistema',compatible&&!unknown&&!circuits.length?'OK':'Revisar',paused?`pausado: ${pauseInfo.reason}`:(state.safeMode?'SAFE MODE':'automatización disponible')],
      ];
      for(const [k,v,sub] of data){const c=document.createElement('div');c.className='gb-card';const a=document.createElement('div');a.className='k';a.textContent=k;const b=document.createElement('div');b.className='v';b.textContent=String(v);const d=document.createElement('div');d.className='s';d.textContent=sub;c.append(a,b,d);cards.appendChild(c)}
    }
    const mode=panel.querySelector('#gb-head-mode');if(mode){mode.textContent=state.safeMode?'SAFE':'NORMAL';mode.className='gb-pill '+(state.safeMode?'warn':'ok')}
    const health=panel.querySelector('#gb-head-health');if(health){const bad=!compatible||unknown||circuits.length;health.textContent=bad?'REVISAR':'SISTEMA OK';health.className='gb-pill '+(bad?'bad':'ok')}
    const quickSafe=sec.querySelector('#gb-quick-safe');if(quickSafe)quickSafe.textContent=state.safeMode?'SAFE MODE: ON':'SAFE MODE: OFF';
    const rows=[];
    for(const id of ids){let name=id;try{name=gbTownModel(id).getName()||id}catch(_){}const p=goalPlanTown(id),f=economyForecast(id);const a=(p.actions||[])[0];if(a)rows.push(`${name}: ${a.kind} ${a.id}${a.level?' → '+a.level:''} · ${a.status}${a.why?' · '+a.why:''}`);if(f&&Object.values(f.overflow).some(Boolean))rows.push(`${name}: AVISO · almacén previsto al límite en ${Object.entries(f.overflow).filter(([,v])=>v).map(([k])=>k).join(', ')}`)}
    time.textContent=rows.slice(0,30).join('\n')||'No hay acciones planificadas.';
    if(dashboardSimulation){const lines=[`Simulación ${dashboardSimulation.horizonHours} h · ${dashboardSimulation.totalActions} acciones · ${dashboardSimulation.blocked} ciudad(es) con cuello de botella`];for(const t of dashboardSimulation.towns)lines.push(`Ciudad ${t.townId}: ${t.actions.filter(a=>a.sim==='would-run').length} acciones · final ${Math.floor(t.final.wood)}/${Math.floor(t.final.stone)}/${Math.floor(t.final.iron)} · ${t.bottleneck||'sin bloqueo'}${t.productionKnown?'':' · producción desconocida'}`);sim.textContent=lines.join('\n')}else sim.textContent='Todavía no se ha ejecutado una simulación.';
    const why=sec.querySelector('.why-panel');if(why)why.textContent=(state.whyLog||[]).slice(0,12).map(x=>`${new Date(x.ts).toLocaleTimeString()} · ${x.feature} · ${x.status}${x.why?' · '+x.why:''}`).join('\n')||'Todavía no hay decisiones registradas.';
    renderHealth();
  }

  function renderOverview() {
    const box = panel && panel.querySelector('.overview-panel');
    if (!box) return;
    const sec = box.closest('section[data-tab]');
    if (sec && sec.hidden) return;
    const d = qolOverviewData();
    const lines = [
      `Towns: ${d.townN}`,
      `Farms ready: ${d.farmReady}/${d.farmTotal}`,
      `Culture busy: ${d.cultureBusy}`,
      `Build queue: ${d.buildQ} | Research queue: ${d.researchQ}`,
      d.pause ? `⏸ paused: ${d.pause}` : 'Automation: active',
      d.breakers.length ? `Captcha: ${d.breakers.join(',')}` : 'Captcha: clear',
      (() => {
        const parts = Object.keys(d.health).map(k => {
          const h = d.health[k];
          return `${k} ok${h.ok}/err${h.err}/cap${h.captcha}`;
        });
        return 'Health: ' + (parts.length ? parts.join(' · ') : '(none yet)');
      })(),
    ];
    box.textContent = lines.join('\n');
    if (sec && !sec.dataset.uxBound) {
      sec.dataset.uxBound = '1';
      sec.querySelector('#gb-quick-safe')?.addEventListener('click', () => { state.safeMode = !state.safeMode; save(STORE.SAFE_MODE, state.safeMode); renderOverview(); flash(state.safeMode ? 'SAFE MODE activado' : 'SAFE MODE desactivado'); });
      sec.querySelector('#gb-quick-preflight')?.addEventListener('click', () => { preflightRunAndRender(); showTab('stats'); });
      sec.querySelector('#gb-quick-sim')?.addEventListener('click', () => { dashboardSimulation = simulateAccount(24); const h=sec.querySelector('#gb-sim-hours'); if(h)h.value='24'; renderDashboard(); });
      sec.querySelector('#gb-quick-config')?.addEventListener('click', () => showTab('config'));
    }
    try { renderGoals(); renderPlanner(); renderDashboard(); } catch (_) {}
  }
  const CONFIG_EXPORT_SCHEMA = 3;
  function qolExportConfig() {
    return { schema:CONFIG_EXPORT_SCHEMA, ver:state.configVer||1, host:location.host,
      abTargets:state.abTargets,abOrder:state.abOrder,researchTargets:state.researchTargets,recruitTargets:state.recruitTargets,
      plannerCfg:state.plannerCfg,goalProfiles:state.goalProfiles,townGoals:state.townGoals,virtualQueueOverrides:state.virtualQueueOverrides,nativeQueue:state.nativeQueue,predictCfg:state.predictCfg,defenseCfg:state.defenseCfg,safeMode:!!state.safeMode,
      cityTemplates:state.cityTemplates,townGroups:state.townGroups,cultureTypes:state.cultureTypes,favorCfg:state.favorCfg,wonderCfg:state.wonderCfg,merchantWish:state.merchantWish,priorityOrder:state.priorityOrder,playerNotes:state.playerNotes,watchlist:state.watchlist };
  }
  function qolImportConfig(obj) {
    if(!obj||typeof obj!=='object'||Array.isArray(obj))return false;if(obj.host&&String(obj.host)!==String(location.host)){gbLog(`config import refused: file host ${obj.host} != ${location.host}`);return false}if(obj.schema!=null&&+obj.schema>CONFIG_EXPORT_SCHEMA){gbLog(`config import refused: schema ${obj.schema} newer than supported ${CONFIG_EXPORT_SCHEMA}`);return false}
    const clone=v=>JSON.parse(JSON.stringify(v)),isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);const validators={abTargets:isObj,abOrder:Array.isArray,researchTargets:isObj,recruitTargets:isObj,plannerCfg:isObj,goalProfiles:isObj,townGoals:isObj,virtualQueueOverrides:isObj,nativeQueue:isObj,predictCfg:isObj,defenseCfg:isObj,safeMode:v=>typeof v==='boolean',cityTemplates:isObj,townGroups:isObj,cultureTypes:isObj,favorCfg:isObj,wonderCfg:isObj,merchantWish:Array.isArray,priorityOrder:Array.isArray,playerNotes:isObj,watchlist:Array.isArray};const storeFor={abTargets:STORE.AB_TARGETS,abOrder:STORE.AB_ORDER,researchTargets:STORE.RESEARCH_TARGETS,recruitTargets:STORE.RECRUIT_TARGETS,plannerCfg:STORE.PLANNER_CFG,goalProfiles:STORE.GOAL_PROFILES,townGoals:STORE.TOWN_GOALS,virtualQueueOverrides:STORE.VIRTUAL_QUEUE_OVERRIDES,nativeQueue:STORE.NATIVE_QUEUE,predictCfg:STORE.PREDICT_CFG,defenseCfg:STORE.DEFENSE_CFG,safeMode:STORE.SAFE_MODE,cityTemplates:STORE.CITY_TEMPLATES,townGroups:STORE.TOWN_GROUPS,cultureTypes:STORE.CULTURE_TYPES,favorCfg:STORE.FAVOR_CFG,wonderCfg:STORE.WONDER_CFG,merchantWish:STORE.MERCHANT_WISH,priorityOrder:STORE.PRIORITY_ORDER,playerNotes:STORE.PLAYER_NOTES,watchlist:STORE.WATCHLIST};let applied=0;
    for(const k of Object.keys(validators)){if(obj[k]==null)continue;if(!validators[k](obj[k])){gbLog(`config import: ignored invalid ${k}`);continue}let v=clone(obj[k]);if(k==='priorityOrder'){const allowed=new Set(PRIORITY_ORDER_DEFAULT);v=v.map(String).filter((x,i,a)=>allowed.has(x)&&a.indexOf(x)===i);v=v.concat(PRIORITY_ORDER_DEFAULT.filter(x=>!v.includes(x)))}else if(k==='abOrder'){v=v.map(String).filter((x,i,a)=>AB_BUILDINGS.includes(x)&&a.indexOf(x)===i);v=v.concat(AB_BUILDINGS.filter(x=>!v.includes(x)))}else if(k==='abTargets'){const c={};for(const[b,n]of Object.entries(v))if(AB_BUILDINGS.includes(b))c[b]=abClampTarget(b,n);v=c}else if(k==='nativeQueue'){
      const clean={version:1,seq:Math.max(0,+v.seq||0),towns:{}},seen=new Set();
      const jobId=(raw,prefix)=>{let id=/^[A-Za-z0-9:._-]{1,160}$/.test(String(raw||''))?String(raw):'';if(!id||seen.has(id)){clean.seq++;id=`${prefix}:import:${clean.seq.toString(36)}`}seen.add(id);return id};
      for(const[tid,t]of Object.entries(v.towns||{}).slice(0,500)){if(!/^\d+$/.test(String(tid))||!isObj(t))continue;const townId=String(tid),build=[],recruit=[];
        for(const j of (Array.isArray(t.build)?t.build:[]).slice(0,300)){if(!isObj(j)||!AB_BUILDINGS.includes(String(j.building))||!Number.isFinite(+j.toLevel)||+j.toLevel<=0)continue;const uncertain=!!(j.inflight||j.manualReview||j.reconcile),flight=j.reconcile||j.inflight||null,flightBuilding=flight&&AB_BUILDINGS.includes(String(flight.building))?String(flight.building):String(j.building);build.push({id:jobId(j.id,'b'),kind:'build',townId,building:String(j.building),fromLevel:Math.max(0,Math.floor(+j.fromLevel||(+j.toLevel-1))),toLevel:Math.max(1,Math.floor(+j.toLevel)),status:uncertain?'unknown':'pending',reason:uncertain?'acción importada pendiente de revisión':'',createdAt:Number.isFinite(+j.createdAt)?+j.createdAt:Date.now(),inflight:null,manualReview:uncertain,reconcile:flight&&isObj(flight)?{building:flightBuilding,targetLevel:Math.max(1,Math.floor(+flight.targetLevel||+j.toLevel)),at:+flight.at||Date.now(),accepted:!!flight.accepted}:null})}
        for(const j of (Array.isArray(t.recruit)?t.recruit:[]).slice(0,300)){if(!isObj(j)||!/^[a-z0-9_:-]+$/i.test(String(j.unit||''))||!recruitUnitDef(String(j.unit))||!Number.isFinite(+j.amount)||+j.amount<=0)continue;const uncertain=!!(j.inflight||j.manualReview);recruit.push({id:jobId(j.id,'u'),kind:'recruit',townId,unit:String(j.unit),amount:Math.max(1,Math.floor(+j.amount)),status:uncertain?'unknown':'pending',reason:uncertain?'acción importada pendiente de revisión':'',createdAt:Number.isFinite(+j.createdAt)?+j.createdAt:Date.now(),inflight:null,manualReview:uncertain})}
        clean.towns[townId]={build,recruit,paused:{build:!!(t.paused&&t.paused.build),recruit:!!(t.paused&&t.paused.recruit)},mode:{build:build.length||t.mode&&t.mode.build==='fifo'?'fifo':'legacy',recruit:recruit.length||t.mode&&t.mode.recruit==='fifo'?'fifo':'legacy'}}
      }v=clean
    }else if(k==='watchlist')v=v.slice(0,500);else if(k==='merchantWish')v=v.slice(0,100).filter(x=>isObj(x)&&(x.item||x.id)&&Number.isFinite(+x.maxPrice)&&+x.maxPrice>0);state[k]=v;save(storeFor[k],v);applied++}
    state.configVer=CONFIG_VER_CURRENT;save(STORE.CONFIG_VER,CONFIG_VER_CURRENT);if(state.autoFavor){state.autoFavor=false;save(STORE.AUTO_FAVOR,false)}goalPlanAll();gbLog(`config imported: ${applied} validated section(s)`);return applied>0;
  }



  const ORCH_MS = 20000;
  const ORCH_MAX_PER_TICK = 3;
  const ORCH_SPACING_MS = 450;
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
    merchant: 45000,
    favor: 60000,
    wonder: 180000,
  };
  const ORCH_CAPTCHA = {
    culture: 'culture', cave: 'cave', build: 'build', research: 'research',
    trade: 'trade', farm: 'farm', ruraltrade: 'ruraltrade', rurallevel: 'rurallevel',
    recruit: 'recruit', merchant: 'merchant', favor: 'favor', wonder: 'wonder',
  };

  const ORCH_JRN = {
    culture: 'culture', cave: 'cave', build: 'build', research: 'research',
    trade: 'trade', farm: 'farm', ruraltrade: 'ruraltrade', rurallevel: 'rurallevel',
    recruit: 'recruit', merchant: 'merchant', favor: 'favor', wonder: 'wonder',
  };
  const ORCH_IDLE_TRIP = 4;
  const ORCH_IDLE_MAX = 8;
  const orchLastRun = {};
  const orchIdle = {};
  const orchJrnMark = {};
  function orchSafe(key,fn){try{return fn()}catch(e){const msg=String(e&&e.stack||e).slice(0,220);gbLog(`orch ${key} exception: ${msg}`);markModuleHealth(key,'err',{error:msg});whyNote(key,'orchestrator','error',msg);orchIdle[key]=0;return null}}
  const ORCH_HANDLERS = {
    culture:()=>orchSafe('culture',()=>cultureScan('orch')),
    cave:()=>orchSafe('cave',()=>caveScan('orch')),
    build:()=>orchSafe('build',()=>{abEnsureTargets();abScan('orch')}),
    research:()=>orchSafe('research',()=>researchScan('orch')),
    trade:()=>orchSafe('trade',()=>tradeScan('orch')),
    farm:()=>orchSafe('farm',()=>autoClaimFarms('orch')),
    ruraltrade:()=>orchSafe('ruraltrade',()=>ruralTradeScan('orch')),
    rurallevel:()=>orchSafe('rurallevel',()=>ruralLevelScan('orch')),
    recruit:()=>orchSafe('recruit',()=>recruitScan('orch')),
    merchant:()=>orchSafe('merchant',()=>merchantScan('orch')),
    favor:()=>orchSafe('favor',()=>favorScan('orch')),
    wonder:()=>orchSafe('wonder',()=>wonderScan('orch')),
  };
