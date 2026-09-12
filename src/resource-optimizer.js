  // Cross-town optimizer is a bounded advisory solver. It never invents a
  // merchant ETA: a live transfer is eligible only when a matching duration was
  // observed in the player's own Trade models, and every eventual post remains
  // the existing `trade` feature with its locks and transaction guards.
  const RESOURCE_OPTIMIZER_DEFAULTS = Object.freeze({
    enabled: false,
    dryRun: true,
    horizonHours: 6,
    minGainMinutes: 10,
    maxTransfersPerCycle: 4,
    reservePct: 20,
    allowRouteLearning: false,
    excludedTowns: Object.freeze({}),
  });
  const RESOURCE_OPTIMIZER_PLAN_TTL_MS = 15000;
  const RESOURCE_OPTIMIZER_TOKEN_TTL_MS = 180000;
  const RESOURCE_OPTIMIZER_BLOCKED_MAX = 48;
  let resourceOptimizerLast = { at: 0, signature: 'none', jobs: [], blocked: [], demands: [] };
  let resourceOptimizerDryRunSignature = '';
  const resourceOptimizerTokens = Object.create(null);

  function resourceOptimizerClamp(raw, fallback, lo, hi) {
    const n = gbNum(raw);
    return n == null ? fallback : Math.max(lo, Math.min(hi, n));
  }
  function resourceOptimizerCfg() {
    const raw = state.resourceOptimizerCfg && typeof state.resourceOptimizerCfg === 'object' && !Array.isArray(state.resourceOptimizerCfg) ? state.resourceOptimizerCfg : {};
    const excluded = raw.excludedTowns && typeof raw.excludedTowns === 'object' && !Array.isArray(raw.excludedTowns) ? raw.excludedTowns : {};
    const cleanExcluded = {};
    for (const [id, on] of Object.entries(excluded)) if (/^\d+$/.test(String(id)) && on === true) cleanExcluded[String(id)] = true;
    const out = {
      enabled: raw.enabled === true,
      dryRun: raw.dryRun !== false,
      horizonHours: resourceOptimizerClamp(raw.horizonHours, RESOURCE_OPTIMIZER_DEFAULTS.horizonHours, 1, 48),
      minGainMinutes: resourceOptimizerClamp(raw.minGainMinutes, RESOURCE_OPTIMIZER_DEFAULTS.minGainMinutes, 1, 240),
      maxTransfersPerCycle: Math.floor(resourceOptimizerClamp(raw.maxTransfersPerCycle, RESOURCE_OPTIMIZER_DEFAULTS.maxTransfersPerCycle, 1, 8)),
      reservePct: resourceOptimizerClamp(raw.reservePct, RESOURCE_OPTIMIZER_DEFAULTS.reservePct, 0, 80),
      allowRouteLearning: raw.allowRouteLearning === true,
      excludedTowns: cleanExcluded,
    };
    state.resourceOptimizerCfg = out;
    return out;
  }
  function resourceOptimizerSetCfg(patch) {
    const next = Object.assign({}, resourceOptimizerCfg(), patch || {});
    state.resourceOptimizerCfg = next;
    const clean = resourceOptimizerCfg();
    save(STORE.RESOURCE_OPTIMIZER_CFG, clean);
    resourceOptimizerInvalidate();
    return clean;
  }
  function resourceOptimizerInvalidate() {
    resourceOptimizerLast.at = 0;
    resourceOptimizerDryRunSignature = '';
  }
  function resourceOptimizerMinBatch() {
    return Math.max(100, Math.floor(resourceOptimizerClamp(state.transportMin, 1000, 100, 10000)));
  }
  function resourceOptimizerCost(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const out = {};
    for (const key of GB_RES_KEYS) {
      const n = gbNum(raw[key]);
      if (n == null || n < 0) return null;
      out[key] = Math.ceil(n);
    }
    return out;
  }
  function resourceOptimizerSnapshot(townId) {
    let snap = null;
    try { snap = plannerSnapshot(townId); } catch (_) {}
    if (!snap || !snap.live || !snap.availableHard || !snap.availableSoft) return { ok:false, why:'planner-unreadable' };
    const cap = gbNum(snap.live.cap), tradeCap = gbNum(snap.availableHard.tradeCap);
    if (!(cap > 0) || tradeCap == null || tradeCap < 0) return { ok:false, why:'merchant-or-capacity-unreadable' };
    for (const key of GB_RES_KEYS) {
      const live = gbNum(snap.live[key]), hard = gbNum(snap.availableHard[key]), soft = gbNum(snap.availableSoft[key]), incoming = gbNum(snap.incoming && snap.incoming[key]);
      if (live == null || hard == null || soft == null || incoming == null) return { ok:false, why:'resource-unreadable:' + key };
    }
    return { ok:true, snapshot:snap, cap, tradeCap };
  }
  function resourceOptimizerNativeHead(townId) {
    const lanes = ['build', 'research', 'recruit', 'recruitNaval'];
    for (const lane of lanes) {
      let job = null;
      try { job = nativeQueueList(townId, lane, false).find(x => x && !x.inflight && !x.manualReview); } catch (_) {}
      if (!job) continue;
      if (lane === 'build') {
        const levels = abCurrentLevels(townId), now = levels && gbNum(levels[job.building]), to = gbNum(job.toLevel);
        if (now == null || to == null || to !== now + 1) return { blocked:'native-build-cost-unreadable' };
        const cost = resourceOptimizerCost(abBuildingCost(townId, job.building));
        return cost ? { kind:'build', id:job.building, cost, source:'native-fifo' } : { blocked:'native-build-cost-unreadable' };
      }
      if (lane === 'research') {
        const cost = resourceOptimizerCost(researchCost(job.tech, townId));
        return cost ? { kind:'research', id:job.tech, cost, source:'native-fifo' } : { blocked:'native-research-cost-unreadable' };
      }
      const amount = gbNum(job.amount);
      if (amount == null || !(amount > 0) || job.infinite) return { blocked:'native-recruit-cost-unbounded' };
      const unit = String(job.unit || ''), per = recruitEffectiveUnitCost(townId, unit);
      if (!per || !GB_RES_KEYS.every(key => recruitCostFieldKnown(per, key))) return { blocked:'native-recruit-cost-unreadable' };
      const cost = {};
      for (const key of GB_RES_KEYS) cost[key] = Math.ceil((gbNum(per[key]) || 0) * amount);
      return { kind:'recruit', id:unit, cost, source:'native-fifo' };
    }
    return null;
  }
  function resourceOptimizerDemandForTown(townId, horizonHours) {
    const id = String(townId), stateRead = resourceOptimizerSnapshot(id);
    if (!stateRead.ok) return { id, blocked:stateRead.why };
    let action = resourceOptimizerNativeHead(id);
    if (action && action.blocked) return { id, blocked:action.blocked };
    if (!action) {
      let plan = null;
      try { plan = goalPlanTown(id); } catch (_) {}
      const eligible = (plan && plan.actions || []).find(a => a && /^(planned|planned-recalc|planned-cost-advisory|waiting-resources)$/.test(String(a.status || '')) && resourceOptimizerCost(a.cost));
      if (!eligible) return { id, blocked:'no-executable-cost' };
      action = { kind:eligible.kind, id:eligible.id, cost:resourceOptimizerCost(eligible.cost), source:'goal-plan' };
    }
    let production = null;
    try { production = economyProductionRate(id); } catch (_) {}
    if (!production || GB_RES_KEYS.some(key => { const n = gbNum(production[key]); return n == null || n < 0; })) return { id, blocked:'production-unreadable', action };
    const available = {}, live = {};
    for (const key of GB_RES_KEYS) { available[key] = gbNum(stateRead.snapshot.availableHard[key]); live[key] = gbNum(stateRead.snapshot.live[key]); }
    const delay = resourceOptimizerDelay(action.cost, available, production);
    if (delay == null) return { id, blocked:'start-time-unreadable', action };
    return {
      id, action, cost:action.cost, source:action.source, snapshot:stateRead.snapshot, cap:stateRead.cap,
      tradeCap:stateRead.tradeCap, available, live, production, delayMinutes:delay,
      earliestStartAt:Date.now() + delay * 60000,
      hardReserve:Object.assign({}, stateRead.snapshot.reserve && stateRead.snapshot.reserve.hard || {}),
      softReserve:Object.assign({}, stateRead.snapshot.reserve && stateRead.snapshot.reserve.soft || {}), confidence:'alta', horizonHours,
    };
  }
  function resourceOptimizerDelay(cost, available, production) {
    let minutes = 0;
    for (const key of GB_RES_KEYS) {
      const need = Math.max(0, (gbNum(cost && cost[key]) || 0) - (gbNum(available && available[key]) || 0));
      if (!need) continue;
      const rate = gbNum(production && production[key]);
      if (!(rate > 0)) return null;
      minutes = Math.max(minutes, need / rate * 60);
    }
    return minutes;
  }
  function resourceOptimizerSupplyForTown(townId, demand, cfg) {
    const stateRead = resourceOptimizerSnapshot(townId);
    if (!stateRead.ok) return { id:String(townId), blocked:stateRead.why };
    const available = {}, floor = {}, projected = {};
    for (const key of GB_RES_KEYS) {
      const hard = gbNum(stateRead.snapshot.availableHard[key]);
      const protectedAction = demand && demand.cost ? Math.min(hard, gbNum(demand.cost[key]) || 0) : 0;
      floor[key] = Math.max(Math.ceil(stateRead.cap * cfg.reservePct / 100), protectedAction);
      available[key] = Math.max(0, hard - floor[key]);
      projected[key] = (gbNum(stateRead.snapshot.live[key]) || 0) + (gbNum(stateRead.snapshot.incoming[key]) || 0);
    }
    return { id:String(townId), snapshot:stateRead.snapshot, cap:stateRead.cap, tradeCap:stateRead.tradeCap, available, floor, projected, demand };
  }
  function resourceOptimizerTradeModels() {
    const out = [], seen = new Set(), uw = gameUw();
    const add = model => { if (model && !seen.has(model)) { seen.add(model); out.push(model); } };
    const addCollection = value => {
      if (Array.isArray(value)) value.forEach(addCollection);
      else if (value && Array.isArray(value.models)) value.models.forEach(add);
      else if (value && typeof value === 'object' && !value.attributes) Object.values(value).forEach(addCollection);
    };
    try { const maps = uw.MM && uw.MM.getModels && uw.MM.getModels(); if (maps && maps.Trade) addCollection(maps.Trade); } catch (_) {}
    try { const all = uw.MM && uw.MM.getCollections && uw.MM.getCollections() || {}; for (const [name, value] of Object.entries(all)) if (/trade/i.test(name)) addCollection(value); } catch (_) {}
    return out;
  }
  function resourceOptimizerMillis(raw) {
    const n = gbNum(raw);
    if (n == null || n <= 0) return null;
    return n > 100000000000 ? n : n * 1000;
  }
  function resourceOptimizerRouteKey(from, to) { return String(from) + '>' + String(to); }
  function resourceOptimizerLearnRoutes(cfg) {
    const learned = Object.create(null);
    if (!cfg.allowRouteLearning) return learned;
    for (const model of resourceOptimizerTradeModels()) {
      try {
        const a = model.attributes || model;
        const from = a.origin_town_id ?? a.source_town_id ?? a.sender_town_id ?? a.from_town_id ?? null;
        const to = a.destination_town_id ?? a.target_town_id ?? a.receiving_town_id ?? a.receiver_town_id ?? a.to_town_id ?? null;
        const start = resourceOptimizerMillis(a.started_at ?? a.started_time ?? a.departure_at ?? a.created_at);
        const end = resourceOptimizerMillis(a.arrival_at ?? a.arrival_time ?? a.arrives_at ?? a.to_be_completed_at ?? a.end_at);
        if (!/^\d+$/.test(String(from)) || !/^\d+$/.test(String(to)) || !(end > start)) continue;
        const duration = end - start;
        if (duration < 1000 || duration > 7 * 86400000) continue;
        const key = resourceOptimizerRouteKey(from, to), prev = learned[key];
        learned[key] = prev == null ? duration : Math.round((prev + duration) / 2);
      } catch (_) {}
    }
    return learned;
  }
  function resourceOptimizerCandidate(demand, supply, resource, routeMs, cfg) {
    const shortage = Math.max(0, demand.cost[resource] - demand.available[resource]);
    if (!(shortage > 0) || !(supply.available[resource] > 0) || !(supply.tradeCap > 0)) return null;
    if (!(routeMs > 0)) return { blocked:'route-time-unreadable' };
    const receiverProjected = demand.live[resource] + (gbNum(demand.snapshot.incoming[resource]) || 0);
    const room = Math.max(0, demand.cap - receiverProjected);
    const amount = Math.floor(Math.min(shortage, supply.available[resource], supply.tradeCap, room));
    if (!(amount > 0)) return null;
    if (amount < resourceOptimizerMinBatch()) return { blocked:'minimum-batch' };
    const beforeDelay = demand.delayMinutes;
    const afterAvailable = Object.assign({}, demand.available, { [resource]: demand.available[resource] + amount });
    const startAfterArrival = resourceOptimizerDelay(demand.cost, afterAvailable, demand.production);
    if (startAfterArrival == null) return { blocked:'start-time-unreadable' };
    const afterDelay = Math.max(routeMs / 60000, startAfterArrival);
    const gain = Math.max(0, beforeDelay - afterDelay);
    const donorBefore = supply.demand ? supply.demand.delayMinutes : 0;
    const donorAfterAvailable = Object.assign({}, supply.demand && supply.demand.available || {}, { [resource]: Math.max(0, (supply.demand && supply.demand.available[resource] || 0) - amount) });
    const donorAfter = supply.demand ? resourceOptimizerDelay(supply.demand.cost, donorAfterAvailable, supply.demand.production) : 0;
    if (supply.demand && (donorAfter == null || donorAfter > donorBefore)) return { blocked:'donor-priority-delay' };
    const produced = supply.demand && supply.demand.production ? (gbNum(supply.demand.production[resource]) || 0) * cfg.horizonHours : 0;
    const overflowPrevented = Math.max(0, Math.min(amount, supply.projected[resource] + produced - supply.cap));
    if (gain < cfg.minGainMinutes && !(overflowPrevented > 0)) return { blocked:'gain-below-minimum' };
    return { amount, gainMinutes:gain, overflowPrevented, score:gain * 100 + overflowPrevented / Math.max(1, supply.cap) * 20, routeMs };
  }
  function resourceOptimizerPlan(force) {
    const cfg = resourceOptimizerCfg(), now = Date.now();
    if (!force && resourceOptimizerLast.at && now - resourceOptimizerLast.at < RESOURCE_OPTIMIZER_PLAN_TTL_MS) return resourceOptimizerLast;
    const towns = tradeAutoTowns(tradeListTowns()).filter(t => !cfg.excludedTowns[String(t.id)]);
    if (!cfg.enabled) return resourceOptimizerLast = { at:now, enabled:false, signature:'disabled', jobs:[], blocked:[], demands:[], cfg };
    if (towns.length < 2) return resourceOptimizerLast = { at:now, enabled:true, signature:'towns', jobs:[], blocked:[{ why:'need-two-enabled-towns' }], demands:[], cfg };
    const demands = towns.map(t => resourceOptimizerDemandForTown(t.id, cfg.horizonHours));
    const supplyById = Object.create(null), blocked = [], blockedSeen = new Set();
    const noteBlocked = row => {
      const key = [row.townId || '', row.from || '', row.resource || '', row.why || ''].join('|');
      if (blocked.length >= RESOURCE_OPTIMIZER_BLOCKED_MAX || blockedSeen.has(key)) return;
      blockedSeen.add(key);
      blocked.push(row);
    };
    for (const demand of demands) {
      if (demand.blocked) { noteBlocked({ townId:demand.id, why:demand.blocked }); continue; }
      supplyById[demand.id] = resourceOptimizerSupplyForTown(demand.id, demand, cfg);
    }
    const routes = resourceOptimizerLearnRoutes(cfg), jobs = [], tokenBase = 'ro:' + now.toString(36);
    while (jobs.length < cfg.maxTransfersPerCycle) {
      let best = null;
      for (const demand of demands) {
        if (demand.blocked) continue;
        for (const supply of Object.values(supplyById)) {
          if (!supply || supply.blocked || supply.id === demand.id) continue;
          for (const resource of GB_RES_KEYS) {
            const candidate = resourceOptimizerCandidate(demand, supply, resource, routes[resourceOptimizerRouteKey(supply.id, demand.id)], cfg);
            if (candidate && candidate.blocked) { noteBlocked({ townId:demand.id, from:supply.id, resource, why:candidate.blocked }); continue; }
            if (!candidate) continue;
            const row = { demand, supply, resource, candidate };
            if (!best || candidate.score > best.candidate.score || (candidate.score === best.candidate.score && String(supply.id).localeCompare(String(best.supply.id)) < 0)) best = row;
          }
        }
      }
      if (!best) break;
      const { demand, supply, resource, candidate } = best;
      const job = { from:supply.id, to:demand.id, wood:0, stone:0, iron:0, resourceOptimizer:true, optimizerToken:tokenBase + ':' + jobs.length, optimizerResource:resource, reason:'queue-delay', timeSavedMinutes:Math.round(candidate.gainMinutes * 10) / 10, overflowPrevented:Math.floor(candidate.overflowPrevented), travelMs:candidate.routeMs, confidence:'learned-route' };
      job[resource] = candidate.amount;
      jobs.push(job);
      supply.available[resource] -= candidate.amount;
      supply.tradeCap -= candidate.amount;
      supply.projected[resource] -= candidate.amount;
      demand.available[resource] += candidate.amount;
      demand.live[resource] += candidate.amount;
      demand.delayMinutes = resourceOptimizerDelay(demand.cost, demand.available, demand.production);
    }
    const signature = JSON.stringify({ cfg, jobs:jobs.map(j => [j.from,j.to,j.optimizerResource,j[j.optimizerResource],j.timeSavedMinutes]), blocked:blocked.map(b => [b.townId,b.from,b.resource,b.why]), demands:demands.map(d => [d.id,d.blocked,d.action && d.action.id]) });
    return resourceOptimizerLast = { at:now, enabled:true, cfg, jobs, blocked, demands, routeCount:Object.keys(routes).length, signature };
  }
  function resourceOptimizerTokenKey(job) { return String(job.from) + '>' + String(job.to) + '>' + String(job.optimizerResource || ''); }
  function resourceOptimizerPruneTokens() {
    const now = Date.now();
    for (const [key, rec] of Object.entries(resourceOptimizerTokens)) if (!rec || rec.until <= now) delete resourceOptimizerTokens[key];
  }
  function resourceOptimizerClaimJob(job) {
    resourceOptimizerPruneTokens();
    const key = resourceOptimizerTokenKey(job);
    if (resourceOptimizerTokens[key]) return false;
    resourceOptimizerTokens[key] = { token:job.optimizerToken, until:Date.now() + RESOURCE_OPTIMIZER_TOKEN_TTL_MS };
    return true;
  }
  function resourceOptimizerSettleJob(job, err) {
    const key = resourceOptimizerTokenKey(job), rec = resourceOptimizerTokens[key];
    if (!rec || rec.token !== job.optimizerToken) return;
    if (err) delete resourceOptimizerTokens[key];
  }
  function resourceOptimizerJobs(towns, ledger) {
    const plan = resourceOptimizerPlan(true), cfg = resourceOptimizerCfg();
    if (!cfg.enabled || !plan.jobs.length) return [];
    if (cfg.dryRun || state.dryRun || !state.autoTransport) {
      if (resourceOptimizerDryRunSignature !== plan.signature) {
        resourceOptimizerDryRunSignature = plan.signature;
        for (const job of plan.jobs) {
          try { jrnPush({ f:'resource-optimizer', a:'trade', k:job.optimizerToken }, 'skip:dryrun'); } catch (_) {}
          whyNote('resource-optimizer', job.from + '>' + job.to, 'skip:dryrun', job.optimizerResource + ' ' + job[job.optimizerResource]);
        }
      }
      return [];
    }
    const out = [];
    for (const job of plan.jobs) {
      if (out.length >= cfg.maxTransfersPerCycle) break;
      if (ledger) tradeApplyJob(ledger, job);
      out.push(job);
    }
    return out;
  }
  function resourceOptimizerMembership(plan) {
    if (!plan) return 'none';
    const jobs = [...new Set((plan.jobs || []).map(job => [job.from, job.to, job.optimizerResource].join('>')))].sort();
    const blocked = [...new Set((plan.blocked || []).slice(0, 12).map(row => [row.townId || '', row.from || '', row.resource || ''].join('>')))].sort();
    return (plan.enabled ? 'on' : 'off') + '|jobs:' + jobs.join('|') + '|blocked:' + blocked.join('|');
  }
  function resourceOptimizerRender(host, plan, rerender) {
    const wrap = document.createElement('details'); wrap.className = 'gb-section';
    const summary = document.createElement('summary'); summary.textContent = 'Plan de recursos'; wrap.appendChild(summary);
    const body = document.createElement('div'); body.className = 'gb-section-body'; body.style.cssText = 'font-size:9px;overflow:auto'; wrap.appendChild(body);
    const controls = document.createElement('div'); controls.style.cssText = 'display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-bottom:5px';
    controls.appendChild(gbButton('Recalcular', { title:'Recalcula demanda, reserva, mercantes y rutas aprendidas; no envia nada', style:'font-size:9px', onClick:() => { resourceOptimizerPlan(true); rerender(); } }));
    const mode = document.createElement('span'); mode.style.color = '#999';
    mode.textContent = !plan.enabled ? 'Desactivado en Ajustes.' : (plan.cfg.dryRun ? 'Simulacion local: cero escrituras.' : 'Vivo solo con Auto transporte activo.') + ' Rutas aprendidas: ' + (plan.routeCount || 0);
    controls.appendChild(mode); body.appendChild(controls);
    const header = document.createElement('div'); header.style.cssText = 'display:grid;grid-template-columns:1fr 1fr .8fr 1.4fr .7fr 1fr;gap:3px;color:#888;border-bottom:1px solid #333;padding:2px';
    ['origen','destino','cantidad','motivo','ahorro','confianza/bloqueo'].forEach(text => { const el = document.createElement('span'); el.textContent = text; header.appendChild(el); }); body.appendChild(header);
    for (const job of plan.jobs || []) {
      const row = document.createElement('div'); row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr .8fr 1.4fr .7fr 1fr;gap:3px;border-bottom:1px solid #222;padding:2px';
      const values = [String(job.from), String(job.to), job.optimizerResource + ' ' + Math.floor(job[job.optimizerResource]), job.reason + (job.overflowPrevented ? ' + evita overflow' : ''), job.timeSavedMinutes + ' min', job.confidence];
      values.forEach(value => { const el = document.createElement('span'); el.textContent = value; row.appendChild(el); }); body.appendChild(row);
    }
    for (const block of (plan.blocked || []).slice(0, 12)) {
      const row = document.createElement('div'); row.style.cssText = 'color:#b98;padding:2px;border-bottom:1px solid #222';
      row.textContent = 'bloqueado ' + (block.from ? block.from + ' -> ' : '') + (block.townId || '') + (block.resource ? ' ' + block.resource : '') + ': ' + block.why; body.appendChild(row);
    }
    if (!(plan.jobs || []).length && !(plan.blocked || []).length) { const empty = document.createElement('div'); empty.style.color = '#888'; empty.textContent = 'Sin transferencias necesarias.'; body.appendChild(empty); }
    host.appendChild(wrap);
  }
