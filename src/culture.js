  function cultureServerDay() {
    try {
      const now = gameNow();
      const d = new Date(now * 1000);
      return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
    } catch (_) {
      return new Date().toISOString().slice(0, 10);
    }
  }
  function cultureGoldSpentLoad() {
    const day = cultureServerDay();
    const saved = load(STORE.CULTURE_GOLD_SPENT, null);
    if (saved && saved.day === day) return { day, amount: +saved.amount || 0 };
    return { day, amount: 0 };
  }
  function cultureGoldSpentSave(spent) {
    save(wkey(STORE.CULTURE_GOLD_SPENT), { day: spent.day, amount: spent.amount });
  }

  function culturePlayerGold() { return gbPlayerGold(); }
  function cultureBusyTowns(type) {
    const uw = gameUw();
    const out = new Set();
    try {
      const models = uw.MM && uw.MM.getModels && uw.MM.getModels().Celebration;
      if (!models) return out;
      Object.values(models).forEach(c => {
        const a = (c && c.attributes) || {};
        if (a.celebration_type === type && a.town_id != null) out.add(+a.town_id);
      });
    } catch (_) {}
    return out;
  }
  function cultureKillpointsAvailable() {
    try {
      const uw = gameUw();
      const kp = uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('PlayerKillpoints');
      if (!kp || !kp.attributes) return 0;
      const a = kp.attributes;
      return (+a.att || 0) + (+a.def || 0) - (+a.used || 0);
    } catch (_) { return 0; }
  }
  function cultureCanAfford(townId, type, ledger) {
    const cost = CULTURE_COSTS[type];
    if (!cost) return false;
    if (type === 'olympic') {

      if (!state.allowPremiumCulture) return false;
      const spent = ledger && ledger.goldSpent != null ? ledger.goldSpent : cultureGoldSpentLoad().amount;
      const budget = +state.cultureGoldBudget || 0;
      if (!(budget >= OLYMPIC_GOLD) || spent + OLYMPIC_GOLD > budget) return false;
      const gold = ledger && ledger.playerGold != null ? ledger.playerGold : culturePlayerGold();
      if (gold == null || gold < OLYMPIC_GOLD) return false;
    }
    if (cost.killpoints) {
      const kp = ledger && ledger.killpoints != null ? ledger.killpoints : cultureKillpointsAvailable();
      return kp >= cost.killpoints;
    }
    const uw = gameUw();
    let t = null;
    try { t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]); } catch (_) {}
    if (!t) return false;
    try {
      if (cost.academy) {
        const acad = t.getBuildings ? +t.getBuildings().get('academy') : +(t.buildings().attributes || {}).academy;
        if (!(acad >= cost.academy)) return false;
      }
      if (cost.theater) {
        const th = t.getBuildings ? +t.getBuildings().get('theater') : +(t.buildings().attributes || {}).theater;
        if (!(th >= cost.theater)) return false;
      }
      if (cost.gold) return true;
      const r = (ledger && ledger.res && ledger.res[townId]) || (t.resources && t.resources());
      if (!r) return false;
      if (cost.wood && r.wood < cost.wood) return false;
      if (cost.stone && r.stone < cost.stone) return false;
      if (cost.iron && r.iron < cost.iron) return false;
      return true;
    } catch (_) { return false; }
  }
  function cultureStart(type, townId, onDone) {

    const map = { festival: 'party', procession: 'triumph', theater: 'theater', olympic: 'olympic' };
    const ctype = map[type] || type;
    if (ctype === 'olympic' && !state.allowPremiumCulture) {
      return onDone && onDone('premium-blocked');
    }
    gameAjaxPost('culture', 'building_place', 'start_celebration', {
      celebration_type: ctype,
      town_id: +townId,
    }, onDone);
  }
  function cultureScan(reason) {
    if (!hostEnabled() || !state.autoCulture || captchaPaused('culture')) return;
    if (automationPaused({})) return;
    if (gbLocked('culture')) return;
    const types = state.cultureTypes || {};

    const enabled = Object.keys(types).filter(k => {
      if (!types[k]) return false;
      if (k === 'olympic' && !state.allowPremiumCulture) {
        gbLogT('culture-olympic-block', 300000, 'culture: olympic ignored (allowPremiumCulture OFF)');
        return false;
      }
      return true;
    });
    if (!enabled.length) return;
    const ids = (typeof caveListTownIds === 'function') ? caveListTownIds() : [];
    if (!ids.length) {
      try {
        const uw = gameUw();
        Object.keys((uw.ITowns && uw.ITowns.towns) || {}).forEach(id => ids.push(String(id)));
      } catch (_) {}
    }

    const spentState = cultureGoldSpentLoad();
    const ledger = {
      killpoints: cultureKillpointsAvailable(),
      goldSpent: spentState.amount,
      playerGold: culturePlayerGold(),
      res: {},
    };
    try {
      const uw = gameUw();
      ids.forEach(id => {
        const t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(id) : uw.ITowns.towns[id]);
        if (t && t.resources) ledger.res[id] = Object.assign({}, t.resources());
      });
    } catch (_) {}
    const jobs = [];
    const townHasJob = new Set();
    for (const type of enabled) {
      const ctype = ({ festival: 'party', procession: 'triumph', theater: 'theater', olympic: 'olympic' })[type] || type;
      const busy = cultureBusyTowns(ctype);
      for (const id of ids) {
        if (busy.has(+id)) continue;
        if (townHasJob.has(String(id))) continue;
        if (cultureShouldDeferForCave(id)) continue;
        if (!cultureCanAfford(id, ctype, ledger)) continue;
        jobs.push({ type, ctype, id });
        townHasJob.add(String(id));

        const cost = CULTURE_COSTS[ctype];
        if (cost) {
          if (cost.killpoints) ledger.killpoints -= cost.killpoints;
          if (cost.gold) {
            ledger.goldSpent += cost.gold;
            if (ledger.playerGold != null) ledger.playerGold -= cost.gold;
          }
          if (ledger.res[id] && (cost.wood || cost.stone || cost.iron)) {
            ledger.res[id].wood -= cost.wood || 0;
            ledger.res[id].stone -= cost.stone || 0;
            ledger.res[id].iron -= cost.iron || 0;
          }
        }
        if (jobs.length >= 8) break;
      }
      if (jobs.length >= 8) break;
    }
    if (!jobs.length) {
      gbLogT('culture-idle', 180000, `culture: nothing to start (${reason || 'scan'})`);
      return;
    }
    const cultureLock = gbLock('culture');
    if (!cultureLock) return;
    let i = 0, done = 0;
    (function next() {
      gbLockTouch('culture', cultureLock);
      if (i >= jobs.length) {
        gbUnlock('culture', cultureLock);
        if (done) gbLog(`culture: started ${done}/${jobs.length}`);
        return;
      }
      const job = jobs[i++];

      if (!cultureCanAfford(job.id, job.ctype)) {
        gbTimeout(next, 200);
        return;
      }
      cultureStart(job.type, job.id, (err) => {
        if (err === 'captcha' || err === 'captcha-pause') { gbUnlock('culture', cultureLock); return; }
        if (err === 'timeout' || err === 'timeout_unknown' || err === 'pending') {
          gbLogT('culture-timeout', 60000, `culture: ${job.type} ${job.id} timeout_unknown — stopping batch`);
          gbUnlock('culture', cultureLock);
          return;
        }
        if (!err) {
          done++;
          cultureLast = { type: job.type, townId: job.id, ts: Date.now() };
          gbLog(`culture: ${job.type} town ${job.id}`);
          if (job.ctype === 'olympic') {
            const s = cultureGoldSpentLoad();
            s.amount += OLYMPIC_GOLD;
            cultureGoldSpentSave(s);
          }
          try { if (typeof alertWebhook === 'function') alertWebhook('culture', cultureLast); } catch (_) {}
          gbTimeout(next, 600 + Math.random() * 400);
        } else {
          gbLogT('culture-err-' + job.id, 60000, `culture: ${job.type} ${job.id} err ${err}`);

          gbUnlock('culture', cultureLock);
        }
      });
    })();
  }


  // ===== Predictive Economy (v1.9) ===========================================
  function economyProductionRate(townId) {
    const t=gbTownModel(townId); if(!t)return null; let p=null;
    try { if(typeof t.getProduction==='function') p=t.getProduction(); } catch(_){}
    try { if(!p && typeof t.getResourceProduction==='function') p=t.getResourceProduction(); } catch(_){}
    try { if(!p){const r=t.resources&&t.resources(); if(r) p={wood:r.wood_production??r.production_wood,stone:r.stone_production??r.production_stone,iron:r.iron_production??r.production_iron};} } catch(_){}
    if(!p||[p.wood,p.stone,p.iron].some(v=>v==null||!Number.isFinite(+v))) return null;
    // Client models normally expose per-hour production. Do not invent a rate if unreadable.
    return {wood:+p.wood,stone:+p.stone,iron:+p.iron};
  }
  function economyPlannedCost(townId, maxActions) {
    let plan=state.virtualQueue&&state.virtualQueue[String(townId)]; if(!plan||Date.now()-(+plan.generatedAt||0)>60000)try{plan=goalPlanTown(townId)}catch(_){}
    const out=plannerZero(); let n=0;
    for(const a of ((plan&&plan.actions)||[])){if(n++>=Math.max(1,+maxActions||5))break;const c=plannerNormCost(a.cost);if(!c)continue;for(const k of PLANNER_KEYS)out[k]+=+c[k]||0;}
    return out;
  }
  function economyForecast(townId,horizonSec) {
    const s=plannerSnapshot(townId); if(!s)return null; const sec=Math.max(0,+horizonSec||(+state.predictCfg.horizonHours||6)*3600); const prod=economyProductionRate(townId); const demand=economyPlannedCost(townId,5);
    const projected={}; for(const k of ['wood','stone','iron']) projected[k]=Math.max(0,s.live[k]-s.committed[k]+s.incoming[k]+(prod?prod[k]*sec/3600:0)-demand[k]);
    const overflow={}; for(const k of ['wood','stone','iron']) overflow[k]=s.live.cap>0?projected[k]>=s.live.cap:false;
    const deficit={}; for(const k of ['wood','stone','iron']) deficit[k]=Math.max(0,demand[k]-(s.availableSoft[k]+s.incoming[k]+(prod?prod[k]*sec/3600:0)));
    return {townId:String(townId),horizonSec:sec,snapshot:s,production:prod,demand,projected,overflow,deficit,productionKnown:!!prod};
  }
  function tradePredictiveJobs(towns,L) {
    const ledger=L||tradeLedger(towns), jobs=[], minBatch=Math.max(100,+state.tradeMinBatch||1000);if(!ledger)return jobs;
    const forecasts={}; for(const t of towns) forecasts[t.id]=economyForecast(t.id);
    const targets=towns.map(t=>({t,f:forecasts[t.id]})).filter(x=>x.f).sort((a,b)=>Object.values(b.f.deficit).reduce((x,y)=>x+y,0)-Object.values(a.f.deficit).reduce((x,y)=>x+y,0));
    for(const {t:tgtTown,f:tgtF} of targets){const tgt=ledger[tgtTown.id]; if(!tgt)continue;
      for(const res of ['wood','stone','iron']){let need=Math.floor(tgtF.deficit[res]||0); if(need<minBatch)continue;
        const sources=towns.filter(s=>s.id!==tgtTown.id).map(s=>({s,f:forecasts[s.id],l:ledger[s.id]})).filter(x=>x.f&&x.l).sort((a,b)=>(b.f.overflow[res]?1:0)-(a.f.overflow[res]?1:0));
        for(const {s,f,l} of sources){const av=plannerAvailable(s.id,{allowSoft:false}); if(!av||av.tradeCap==null)continue; const surplus=Math.max(0,Math.min(av[res], l[res]-Math.max(0,plannerReservePolicy(s.id).hard[res]+plannerReservePolicy(s.id).soft[res]))); const send=Math.floor(Math.min(need,surplus,av.tradeCap,l.tradeCap,tgt.cap-tgt[res])); if(send<minBatch)continue;
          const job={from:s.id,to:tgtTown.id,wood:0,stone:0,iron:0};job[res]=send;jobs.push(job);tradeApplyJob(ledger,job);need-=send;if(need<minBatch||jobs.length>=8)break;
        } if(jobs.length>=8)break;
      } if(jobs.length>=8)break;
    }
    return jobs;
  }
