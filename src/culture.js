  function cultureGoldSpentLoad() {
    const day = gbServerDay();
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
  // A missing model is UNKNOWN, not "zero killpoints". Returning 0 made the
  // `kp >= cost.killpoints` gate block a celebration on a value never read,
  // which is exactly what the precondition invariant forbids.
  function cultureKillpointsAvailable() {
    try {
      const uw = gameUw();
      const kp = uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('PlayerKillpoints');
      if (!kp || !kp.attributes) return null;
      const a = kp.attributes;
      if (a.att == null && a.def == null) return null;
      return (+a.att || 0) + (+a.def || 0) - (+a.used || 0);
    } catch (_) { return null; }
  }
  // Same contract as gbAfford: a check may only BLOCK on a value it actually
  // read. Unreadable is `blind` - log once, let the server be the authority -
  // never a silent skip, because a renamed client getter would otherwise turn
  // the whole culture feature off with no trace.
  function cultureBlind(what, townId, type) {
    gbLogT('culture-blind-' + type + '-' + what, 300000,
      `culture: ${type} @${townId} ${what} unreadable - letting the server decide`);
    return true;
  }
  function cultureCanAfford(townId, type, ledger) {
    const cost = CULTURE_COSTS[type];
    if (!cost) return false;
    if (type === 'olympic') {

      if (!state.allowPremiumCulture) return false;
      const spent = ledger && ledger.goldSpent != null ? ledger.goldSpent : cultureGoldSpentLoad().amount;
      const budget = +state.cultureGoldBudget || 0;
      // Local ledger, always readable — this is the real bound on gold spend,
      // so a blind balance below still cannot overrun the daily budget.
      if (!(budget >= OLYMPIC_GOLD) || spent + OLYMPIC_GOLD > budget) return false;
      const gold = ledger && ledger.playerGold != null ? ledger.playerGold : culturePlayerGold();
      if (gold == null) return cultureBlind('gold', townId, type);
      if (gold < OLYMPIC_GOLD) return false;
    }
    if (cost.killpoints) {
      const kp = ledger && ledger.killpoints != null ? ledger.killpoints : cultureKillpointsAvailable();
      if (kp == null) return cultureBlind('killpoints', townId, type);
      return kp >= cost.killpoints;
    }
    const t = gbTownModel(townId);
    if (!t) return cultureBlind('town-model', townId, type);
    try {
      if (cost.academy) {
        const acad = gbBuildingLevel(townId, 'academy');
        if (acad == null) return cultureBlind('academy', townId, type);
        if (acad < cost.academy) return false;
      }
      if (cost.theater) {
        const th = gbBuildingLevel(townId, 'theater');
        if (th == null) return cultureBlind('theater', townId, type);
        if (th < cost.theater) return false;
      }
      if (cost.gold) return true;
      const r = (ledger && ledger.res && ledger.res[townId]) || (t.resources && t.resources());
      if (!r) return cultureBlind('resources', townId, type);
      for (const k of GB_RES_KEYS) {
        const need = +cost[k] || 0;
        if (need <= 0) continue;
        // null/undefined coerced through `<` reads as 0 — i.e. as a shortage.
        // Unreadable stock must not masquerade as an empty warehouse.
        const have = gbNum(r[k]);
        if (have == null) return cultureBlind(k, townId, type);
        if (have < need) return false;
      }
      return true;
    } catch (_) { return cultureBlind('read-error', townId, type); }
  }
  function cultureStart(type, townId, onDone) {

    const map = { festival: 'party', procession: 'triumph', theater: 'theater', olympic: 'olympic' };
    const ctype = map[type] || type;
    if (ctype === 'olympic' && !state.allowPremiumCulture) {
      return onDone && onDone('premium-blocked');
    }

    let curTown = null;
    try { const g = gameUw().Game; curTown = g && g.townId != null ? String(g.townId) : null; } catch (_) {}
    if (curTown != null && String(townId) === curTown) {
      gameAjaxPost('culture', 'building_place', 'start_celebration', {
        celebration_type: ctype,
        town_id: +townId,
      }, onDone);
      return;
    }
    gameAjaxPost('culture', 'town_overviews', 'start_celebration', {
      town_id: +townId,
      celebration_type: ctype,
      no_bar: 1,
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
    const priority = ['theater', 'festival', 'procession', 'olympic'];
    const ordered = priority.filter(t => enabled.includes(t));
    for (const type of ordered) {
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

          // null means "unreadable"; decrementing it would produce a negative
          // number that then reads as a hard shortage for every later town.
          if (cost.killpoints && ledger.killpoints != null) ledger.killpoints -= cost.killpoints;
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
      gbLogT('culture-idle', 180000, `culture: nothing to start (${scanReason(reason)})`);
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

          // The err branch must also advance the batch: skipping next() on a
          // non-captcha/non-timeout rejection strands every queued job behind
          // this one for a full cadence. Captcha/timeout take their own
          // breaker so the loop should keep draining here.
          gbTimeout(next, 600 + Math.random() * 400);
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

    // etaMinutes (v4 plan 2.8): wall-clock minutes until this resource reaches
    // cap at the CURRENT production rate, clamped to the horizon. null unless
    // the projection actually crosses the cap AND production was readable -
    // an unreadable rate is unknown, never "never fills".
    // NOT gated on overflow[k]: overflow is "does it cap inside the horizon",
    // and gating on it would hide every town that caps just outside the window
    // - exactly the towns a T-10min warning is for. Not clamped to the horizon
    // either, or a 40min ETA would report as the horizon length. null only when
    // the production rate or the capacity was genuinely unreadable.
    const etaMinutes={};
    for(const k of ['wood','stone','iron']){
      const rate=prod?+prod[k]:null;
      if(!(s.live.cap>0)||!(rate>0)){etaMinutes[k]=null;continue}
      const nowLevel=Math.max(0,s.live[k]-s.committed[k]+s.incoming[k]-demand[k]);
      const room=s.live.cap-nowLevel;
      if(room<=0){etaMinutes[k]=0;continue}
      etaMinutes[k]=(room/(rate/3600))/60;
    }
    return {townId:String(townId),horizonSec:sec,snapshot:s,production:prod,demand,projected,overflow,deficit,etaMinutes,productionKnown:!!prod};
  }
  // ===== Resource capping pre-warn (v4 plan 2.8) =============================
  const PREWARN_MIN_MIN = 10;
  const PREWARN_HORIZON_HOURS = 2;
  const PREWARN_TTL_MS = 30 * 60 * 1000;
  const _cappingAlerted = Object.create(null);
  // Spanish client wording: iron renders as plata.
  const CAPPING_RES_ES = { wood: 'madera', stone: 'piedra', iron: 'plata' };
  function cappingForecast(townId) {
    try { return economyForecast(townId, PREWARN_HORIZON_HOURS * 3600); } catch (_) { return null; }
  }
  // Every town whose warehouse is within PREWARN_MIN_MIN of capping.
  // Shared by the watcher and the World totals row - one computation, one truth.
  let _cappingMemo = { at: 0, v: [] };
  const CAPPING_MEMO_MS = 5000;
  function cappingPending() {
    // Memoised: renderWorld calls this on every 15s repaint and the watcher on
    // every orch tick; economyForecast per town is not free.
    if (Date.now() - _cappingMemo.at < CAPPING_MEMO_MS) return _cappingMemo.v;
    const out = [];
    for (const t of (state.towns || [])) {
      const f = cappingForecast(t.id);
      if (!f) continue;
      if (!f.productionKnown) {
        gbLogT('capping-prod-blind', 600000, 'capping: production rate unreadable - pre-warn silent for that town');
        continue;
      }
      for (const k of ['wood', 'stone', 'iron']) {
        const eta = f.etaMinutes[k];
        if (eta == null || !(eta <= PREWARN_MIN_MIN)) continue;
        const cap = f.snapshot.live.cap;
        out.push({
          townId: String(t.id), name: t.name || String(t.id), resource: k,
          etaMin: Math.max(0, Math.round(eta)),
          fillPct: cap > 0 ? Math.round(f.snapshot.live[k] / cap * 100) : null,
        });
      }
    }
    _cappingMemo = { at: Date.now(), v: out };
    return out;
  }
  // DELIBERATE DEVIATION from plan 2.8 work item 2, which puts this pass inside
  // cultureScan: cultureScan returns early unless state.autoCulture is ON, and
  // that toggle defaults OFF - the pre-warn would never fire for most users.
  // orchTick is the existing 20s cadence that always runs, so this rides it
  // instead. Still no new gbInterval, no new setTimeout.
  function townCapWatcher() {
    const now = Date.now();
    // Sweep FIRST: if the forecast walk throws, orchTick swallows it and an
    // unswept map would grow for the life of the page.
    for (const k of Object.keys(_cappingAlerted)) if (_cappingAlerted[k] <= now) delete _cappingAlerted[k];
    const rows = cappingPending();
    for (const r of rows) {
      const key = r.townId + '|' + r.resource;
      if (_cappingAlerted[key]) continue;
      _cappingAlerted[key] = now + PREWARN_TTL_MS;
      const res = CAPPING_RES_ES[r.resource] || r.resource;
      // The in-panel flash is unconditional; only the webhook is opt-in.
      try { flash(`AVISO: ${r.name} ${res} en ~${r.etaMin}min (almacen al limite)`); } catch (_) {}
      gbLog(`capping: ${r.name} ${r.resource} ~${r.etaMin}min to cap (${r.fillPct == null ? '?' : r.fillPct}%)`);
      try { alertWebhook('cappingPreWarn', r); } catch (_) {}
    }
  }
