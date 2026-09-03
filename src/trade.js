  function setTradeTownEnabled(townId, on) {
    const id = String(townId);
    if (!state.tradeTowns || typeof state.tradeTowns !== 'object' || Array.isArray(state.tradeTowns)) state.tradeTowns = {};
    state.tradeTowns[id] = !!on;
    save(STORE.TRADE_TOWNS, state.tradeTowns);
  }
  function tradeListTowns() {
    const ids = [];
    try {
      const from = townsFromGame && townsFromGame();
      if (from) from.forEach(t => ids.push(String(t.id)));
    } catch (_) {}
    if (!ids.length) {
      try {
        const uw = gameUw();
        Object.keys((uw.ITowns && uw.ITowns.towns) || {}).forEach(id => ids.push(String(id)));
      } catch (_) {}
    }
    return ids.map(tradeTownRes).filter(Boolean);
  }
  function tradeAutoTowns(towns) {
    return (Array.isArray(towns) ? towns : tradeListTowns()).filter(t => t && tradeTownEnabled(t.id));
  }
  function renderTradeTowns() {
    const box = panel && panel.querySelector('.trade-towns');
    if (!box) return;
    const ids = caveListTownIds();
    box.replaceChildren();
    if (!ids.length) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#888;font-size:10px';
      e.textContent = 'sin ciudades cargadas';
      box.appendChild(e);
      return;
    }
    const tools = document.createElement('div');
    tools.className = 'trade-towns-tools';
    tools.style.cssText = 'display:flex;align-items:center;gap:5px;margin:0 0 2px 12px;font-size:9px;color:#888';
    const mk = (txt, on) => {
      return gbButton(txt, {
        style: 'font-size:9px;padding:1px 6px',
        onClick: () => {
          ids.forEach(id => setTradeTownEnabled(id, on));
          renderTradeTowns();
          gbLog('trade towns', on ? 'ALL' : 'NONE');
          if (state.autoTrade || state.autoTransport || state.autoDump || state.islandShip) tradeScan('town-filter');
        },
      });
    };
    tools.appendChild(mk('Todas', true));
    tools.appendChild(mk('Ninguna', false));
    const count = document.createElement('span');
    count.textContent = `${ids.filter(tradeTownEnabled).length}/${ids.length} activas`;
    tools.appendChild(count);
    box.appendChild(tools);

    const names = Object.create(null);
    try { (townsFromGame() || []).forEach(t => { if (t.id != null && t.name) names[String(t.id)] = t.name; }); } catch (_) {}
    ids.forEach(id => {
      const label = document.createElement('label');
      label.dataset.tradeTown = String(id);
      label.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:10px;margin-left:12px';
      gbTip(label, 'Permite que esta ciudad participe en el comercio automatico calculado por el bot');
      const chk = document.createElement('input');
      chk.type = 'checkbox'; chk.checked = tradeTownEnabled(id);
      chk.addEventListener('change', () => {
        setTradeTownEnabled(id, chk.checked);
        gbLog(`trade town ${id}`, chk.checked ? 'ON' : 'OFF');
        renderTradeTowns();
        if (state.autoTrade || state.autoTransport || state.autoDump || state.islandShip) tradeScan('town-filter');
      });
      const span = document.createElement('span');
      span.textContent = `${names[String(id)] || id} (#${id})`;
      label.appendChild(chk); label.appendChild(span); box.appendChild(label);
    });
  }
  function tradeSend(fromId, toId, wood, stone, iron, onDone) {
    gameAjaxPost('trade', 'town_info', 'trade', {
      id: +toId,
      wood: Math.max(0, Math.floor(wood)),
      stone: Math.max(0, Math.floor(stone)),
      iron: Math.max(0, Math.floor(iron)),
      town_id: +fromId,
      nl_init: true,
    }, onDone);
  }
  let tradeIncomingCache={at:0,known:false,value:Object.create(null)};
  function tradeIncomingByTown() {
    if(Date.now()-tradeIncomingCache.at<1000)return {known:tradeIncomingCache.known,byTown:tradeIncomingCache.value};
    const out=Object.create(null),models=[],seenModels=new Set(),uw=gameUw();let known=false;
    const addModel=m=>{if(m&&!seenModels.has(m)){seenModels.add(m);models.push(m)}};
    const addCollection=c=>{if(Array.isArray(c))c.forEach(addCollection);else if(c&&Array.isArray(c.models))c.models.forEach(addModel)};
    try{const maps=uw.MM&&uw.MM.getModels&&uw.MM.getModels();if(maps&&Object.prototype.hasOwnProperty.call(maps,'Trade')){known=true;const m=maps.Trade;if(Array.isArray(m))m.forEach(addModel);else if(m&&typeof m==='object')Object.values(m).forEach(addModel)}}catch(_){}
    try{
      const c=uw.MM&&uw.MM.getOnlyCollectionByName&&uw.MM.getOnlyCollectionByName('Trade');if(c){known=true;addCollection(c)}
      for(const name of ['Trades','TradeMovement','TradeMovements','TownTrade','TownTrades','Transport','Transports']){
        const alt=uw.MM&&uw.MM.getOnlyCollectionByName&&uw.MM.getOnlyCollectionByName(name);
        if(alt){if(/trade/i.test(name))known=true;addCollection(alt)}
      }
    }catch(_){}
    try{
      const all=uw.MM&&uw.MM.getCollections&&uw.MM.getCollections()||{};
      if(Object.prototype.hasOwnProperty.call(all,'Trade'))known=true;
      for(const [name,c] of Object.entries(all))if(/trade|transport/i.test(name)){if(/trade/i.test(name))known=true;addCollection(c)}
    }catch(_){}
    const own=new Set(Object.keys(uw.ITowns&&uw.ITowns.towns||{}).map(String)),seenRows=new Set(),now=gameNow();
    for(const m of models){try{
      const a=m.attributes||m,status=String(a.status||a.state||'').toLowerCase();if(/cancel|complete|arrived|finished|deleted/.test(status))continue;
      let dest=null;for(const fn of ['getDestinationTownId','getTargetTownId','getReceivingTownId']){try{if(dest==null&&typeof m[fn]==='function')dest=m[fn]()}catch(_){}}
      dest=dest??a.destination_town_id??a.target_town_id??a.receiving_town_id??a.receiver_town_id??a.to_town_id??null;if(dest==null||!/^\d+$/.test(String(dest))||!own.has(String(dest)))continue;
      const eta=a.arrival_at??a.arrival_time??a.arrives_at??a.to_be_completed_at??a.end_at??null;if(eta!=null&&Number.isFinite(+eta)){const t=+eta>1e12?+eta/1000:+eta;if(t<=0||(t>1e9&&t<=now))continue}
      let res=a.resources||a.resource||a.payload||null;try{if(!res&&typeof m.getResources==='function')res=m.getResources()}catch(_){}res=res&&res.attributes||res||{};
      const wood=Math.max(0,+(a.wood??res.wood)||0),stone=Math.max(0,+(a.stone??res.stone)||0),iron=Math.max(0,+(a.iron??res.iron??res.silver)||0);if(!(wood+stone+iron>0))continue;
      const rawId=a.id??m.id??'',rid=rawId===''?'':String(rawId)+'|'+String(dest);if(rid&&seenRows.has(rid))continue;if(rid)seenRows.add(rid);
      const row=out[String(dest)]||(out[String(dest)]={wood:0,stone:0,iron:0});row.wood+=wood;row.stone+=stone;row.iron+=iron;
    }catch(_){}}
    tradeIncomingCache={at:Date.now(),known,value:out};return {known,byTown:out};
  }
  function tradeLedger(towns) {
    const incomingState=tradeIncomingByTown();if(!incomingState.known)return null;const L = Object.create(null),incoming=incomingState.byTown;
    for (const t of towns) {
      const mov=incoming[String(t.id)]||{};
      let pending;
      try { pending=plannerPendingForTown(t.id).incoming||{}; } catch (_) { return null; }
      L[t.id] = {

        wood: t.wood+(+mov.wood||0)+(+pending.wood||0), stone: t.stone+(+mov.stone||0)+(+pending.stone||0), iron: t.iron+(+mov.iron||0)+(+pending.iron||0),
        cap: t.cap, tradeCap: t.tradeCap, small: t.small,
      };
    }
    return L;
  }
  function tradeApplyJob(L, job) {
    const src = L[job.from], tgt = L[job.to];
    if (!src || !tgt) return;
    src.wood -= job.wood; src.stone -= job.stone; src.iron -= job.iron;
    src.tradeCap = Math.max(0, src.tradeCap - (job.wood + job.stone + job.iron));
    tgt.wood += job.wood; tgt.stone += job.stone; tgt.iron += job.iron;
  }
  function tradeOverflowPct() { return Math.max(95, Math.min(100, gbCfgNum(state.tradeOverflowPct, 100))) / 100; }
  function tradeTransferPct() { return Math.max(1, Math.min(100, gbCfgNum(state.tradeTransferPct, 10))) / 100; }
  function tradeReceiverPct() { return Math.max(0, Math.min(80, gbCfgNum(state.tradeReceiverPct, 80))) / 100; }
  const tradeDecisionDiagnostics = Object.create(null);
  function tradeDiagnosticPut(townId, resource, patch) {
    const key = String(townId) + '|' + String(resource);
    tradeDecisionDiagnostics[key] = Object.assign({}, tradeDecisionDiagnostics[key] || {}, patch, { ts:Date.now() });
    const keys = Object.keys(tradeDecisionDiagnostics);
    if (keys.length > 100) delete tradeDecisionDiagnostics[keys[0]];
  }
  function tradeDiagnosticsSnapshot() {
    return JSON.parse(JSON.stringify(tradeDecisionDiagnostics));
  }
  function tradeOverflowDecision(towns, resource, trigger, transfer, receiver) {
    const rows = Array.isArray(towns) ? towns : [];
    const source = rows[0];
    const threshold = Number.isFinite(+trigger) ? +trigger : 1;
    const transferPct = Number.isFinite(+transfer) ? +transfer : .1;
    const receiverPct = Number.isFinite(+receiver) ? +receiver : .8;
    if (!source || !GB_RES_KEYS.includes(resource)) return { ok:false, reason:'town-state-unreadable' };
    const amount = source[resource], cap = +source.cap, tradeCap = +source.tradeCap;
    const live = { amount, cap, fill:amount == null || !(cap > 0) ? null : amount / cap, tradeCap };
    if (amount == null || !(cap > 0)) { tradeDiagnosticPut(source.id, resource, { live, overflowThreshold:threshold, action:'none', reason:'source-state-unreadable' }); return { ok:false, reason:'source-state-unreadable' }; }
    if (amount / cap < threshold) { tradeDiagnosticPut(source.id, resource, { live, overflowThreshold:threshold, action:'none', reason:'not-overflowing' }); return { ok:false, reason:'not-overflowing' }; }
    if (tradeCap == null) { tradeDiagnosticPut(source.id, resource, { live, overflowThreshold:threshold, action:'none', reason:'trade-capacity-unreadable' }); return { ok:false, reason:'trade-capacity-unreadable' }; }
    const candidates = rows.slice(1).map(t => {
      const value = t[resource], targetCap = +t.cap;
      if (value == null || !(targetCap > 0)) return null;
      const fill = value / targetCap;
      const free = Number.isFinite(+t.free) ? +t.free : targetCap-value;
      return fill <= receiverPct ? { id:String(t.id), fill, free, t } : null;
    }).filter(Boolean).sort((a,b) => a.fill-b.fill || b.free-a.free || a.id.localeCompare(b.id, undefined, {numeric:true}));
    const target = candidates[0];
    if (!target) { tradeDiagnosticPut(source.id, resource, { live, overflowThreshold:threshold, intercity:null, action:'none', reason:'no-intercity-destination-under-80' }); return { ok:false, reason:'no-intercity-destination-under-80' }; }
    const executable = Math.floor(Math.min(cap * transferPct, amount, tradeCap, target.free));
    if (!(executable > 0)) { const reason = tradeCap <= 0 ? 'trade-capacity-zero' : 'destination-space-zero'; tradeDiagnosticPut(source.id, resource, { live, overflowThreshold:threshold, intercity:{ destination:target.id, fill:target.fill, free:target.free, executable:0 }, action:'none', reason }); return { ok:false, reason, target }; }
    tradeDiagnosticPut(source.id, resource, { live, overflowThreshold:threshold, intercity:{ destination:target.id, fill:target.fill, free:target.free, executable }, action:'intercity', reason:'ready-intercity' });
    return { ok:true, source:String(source.id), target:target.id, resource, amount:executable, destinationFill:target.fill, destinationFree:target.free };
  }
  function tradeOverflowJobs(towns, L, blockedPairs) {
    const rawRows = Array.isArray(towns) ? towns : [];
    const rawById = Object.create(null);
    rawRows.forEach(t => { if (t && t.id != null) rawById[String(t.id)] = t; });
    const ledger = L || tradeLedger(rawRows);
    if (!ledger) return [];
    const attackState = tradeTownsUnderAttack();
    if (!attackState.known) return [];
    const blocked = blockedPairs instanceof Set ? blockedPairs : new Set();
    const jobs = [], ids = rawRows.map(t => String(t.id)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    for (const sourceId of ids) {
      const rawSource = rawById[sourceId], projectedSource = ledger[sourceId];
      if (!rawSource || !projectedSource || !(rawSource.cap > 0)) continue;
      for (const resource of GB_RES_KEYS) {
        if (blocked.has(sourceId + '|' + resource)) continue;
        // Source overflow is based only on resources already in the city. Future
        // incoming trades may constrain receivers but can never create a source overflow.
        const source = Object.assign({}, rawSource, { tradeCap:projectedSource.tradeCap });
        const destRows = ids.filter(id => id !== sourceId && !(attackState.value && attackState.value.has(id))).map(id => {
          const raw = rawById[id], projected = ledger[id];
          if (!raw || !projected || !(raw.cap > 0) || projected[resource] == null) return null;
          return Object.assign({}, raw, {
            [resource]:projected[resource],
            free:Math.max(0, raw.cap - projected[resource]),
          });
        }).filter(Boolean);
        const decision = tradeOverflowDecision([source].concat(destRows), resource, tradeOverflowPct(), tradeTransferPct(), tradeReceiverPct());
        if (!decision.ok) { gbLogT(`trade-overflow-${sourceId}-${resource}`, 180000, `trade: ${decision.reason}`); continue; }
        const job = { from: sourceId, to: decision.target, wood: 0, stone: 0, iron: 0, overflow: true, overflowResource: resource, destinationFill: decision.destinationFill, destinationFree: decision.destinationFree };
        job[resource] = decision.amount; jobs.push(job); tradeApplyJob(ledger, job);
        if (jobs.length >= 6) return jobs;
      }
    }
    return jobs;
  }

  function tradeFillStorageJobs(towns, L) {
    const ledger = L || tradeLedger(towns);
    if(!ledger)return [];
    const reserveN = Number(state.tradeReservePct);
    const reserve = Math.min(80, Math.max(0, Number.isFinite(reserveN) ? reserveN : 20)) / 100;
    const minBatch = gbCfgClamp(state.tradeMinBatch, 100, Infinity, 1000);
    const jobs = [];
    const ids = towns.map(t => t.id);
    for (const tgtId of ids) {
      const tgt = ledger[tgtId];
      if (!tgt || !(tgt.cap > 0)) continue;
      const empty = Math.min(tgt.wood, tgt.stone, tgt.iron) / tgt.cap;
      if (empty >= 0.25) continue;
      for (const srcId of ids) {
        if (srcId === tgtId) continue;
        const src = ledger[srcId];
        if (!src || !(src.cap > 0)) continue;
        const fill = Math.max(src.wood, src.stone, src.iron) / src.cap;
        if (fill <= 0.85 || src.tradeCap < minBatch) continue;
        const keep = Math.floor(src.cap * reserve);
        const send = {
          wood: Math.max(0, Math.min(src.tradeCap, src.wood - keep, tgt.cap - tgt.wood)),
          stone: Math.max(0, Math.min(src.tradeCap, src.stone - keep, tgt.cap - tgt.stone)),
          iron: Math.max(0, Math.min(src.tradeCap, src.iron - keep, tgt.cap - tgt.iron)),
        };
        const total = send.wood + send.stone + send.iron;
        if (total < minBatch) continue;
        let scale = 1;
        if (total > src.tradeCap) scale = src.tradeCap / total;
        const job = {
          from: srcId, to: tgtId,
          wood: Math.floor(send.wood * scale),
          stone: Math.floor(send.stone * scale),
          iron: Math.floor(send.iron * scale),
        };
        if (job.wood + job.stone + job.iron < minBatch) continue;
        jobs.push(job);
        tradeApplyJob(ledger, job);
        if (jobs.length >= 6) return jobs;
      }
    }
    return jobs;
  }
  function tradeIslandShipJobs(towns, L) {
    if (!state.islandShip) return [];
    const ledger = L || tradeLedger(towns);
    if(!ledger)return [];
    const jobs = [];
    const minBatch = gbCfgClamp(state.tradeMinBatch, 100, Infinity, 1000);
    const reserveN = Number(state.tradeReservePct);
    const reservePct = Math.min(80, Math.max(0, Number.isFinite(reserveN) ? reserveN : 20)) / 100;
    const ids = towns.map(t => t.id);
    for (const tgtId of ids) {
      const tgt = ledger[tgtId];
      if (!tgt || !tgt.small) continue;
      for (const srcId of ids) {
        const src = ledger[srcId];
        if (!src || src.small || src.tradeCap < 1000) continue;
        const keep = Math.floor((src.cap || 0) * reservePct);
        let wood = Math.max(0, Math.min(src.tradeCap / 3, src.wood - keep, Math.max(0, tgt.cap - tgt.wood)));
        let stone = Math.max(0, Math.min(src.tradeCap / 3, src.stone - keep, Math.max(0, tgt.cap - tgt.stone)));
        let iron = Math.max(0, Math.min(src.tradeCap / 3, src.iron - keep, Math.max(0, tgt.cap - tgt.iron)));
        const total = wood + stone + iron;
        if (total < minBatch) continue;
        if (total > src.tradeCap) {
          const scale = src.tradeCap / total;
          wood = Math.floor(wood * scale);
          stone = Math.floor(stone * scale);
          iron = Math.floor(iron * scale);
        }
        const job = { from: srcId, to: tgtId, wood: Math.floor(wood), stone: Math.floor(stone), iron: Math.floor(iron) };
        if (job.wood + job.stone + job.iron < minBatch) continue;
        jobs.push(job);
        tradeApplyJob(ledger, job);
        if (jobs.length >= 4) return jobs;
      }
    }
    return jobs;
  }

  function tradeFreeSpace(tgt, res) {
    if (!tgt || !(tgt.cap > 0)) return null;
    return Math.max(0, tgt.cap - (+tgt[res] || 0));
  }
  function tradeGoalDeficit(townId, preset) {

    if (preset === 'party') {
      // Independent mode: do not reserve iron for a future cave action.
      const order = ['festival', 'theater', 'procession'];
      let ctype = null;
      for (const ui of order) {
        if (!cultureTypeEnabled(ui)) continue;
        ctype = ({ festival: 'party', procession: 'triumph', theater: 'theater' })[ui] || ui;
        if (ctype === 'triumph') continue;
        break;
      }

      if (!ctype || !CULTURE_COSTS[ctype]) {
        gbLogT('trade-party-notype', 300000, 'trade party: no resource-priced culture type enabled - skipping preset');
        return null;
      }
      const cost = CULTURE_COSTS[ctype];
      return {
        wood: +cost.wood || 0,
        stone: +cost.stone || 0,
        iron: +cost.iron || 0,
      };
    }
    if (preset === 'unit') {
      const want = (state.recruitTargets || {})[townId] || (state.recruitTargets || {})[String(townId)];

      if (!want || typeof want !== 'object') {
        gbLogT('trade-unit-notarget-' + townId, 300000, `trade unit: town ${townId} has no recruit target - skipping preset`);
        return null;
      }
      let wood = 0, stone = 0, iron = 0;
      for (const unit of Object.keys(want)) {
        const count = +want[unit] || 0;
        if (!(count > 0)) continue;
        let ec = null;
        try { ec = recruitEffectiveUnitCost(townId, unit); } catch (_) {}
        if (!ec || !['wood','stone','iron'].every(k => recruitCostFieldKnown(ec,k))) {
          gbLogT('trade-unit-nocost-' + unit, 120000, `trade unit: authoritative effective cost unreadable for ${unit} - town ${townId} blind`);
          return null;
        }
        wood += +ec.wood * count;
        stone += +ec.stone * count;
        iron += +ec.iron * count;
      }
      return { wood, stone, iron };
    }
    return null;
  }
  function tradeGoalJobs(towns, L, preset) {
    const ledger = L || tradeLedger(towns);
    const reserve = Math.min(80, Math.max(0, gbCfgNum(state.tradeReservePct, 20))) / 100;
    const minBatch = gbCfgClamp(state.tradeMinBatch, 100, Infinity, 1000);
    const byId = Object.create(null);
    towns.forEach(t => { byId[t.id] = t; });
    const jobs = [];
    for (const tgt of towns) {
      const goal = tradeGoalDeficit(tgt.id, preset);
      if (goal == null) continue;
      const cur = ledger[tgt.id];
      if (!cur) continue;
      const deficit = {
        wood: Math.max(0, goal.wood - cur.wood),
        stone: Math.max(0, goal.stone - cur.stone),
        iron: Math.max(0, goal.iron - cur.iron),
      };
      const needTotal = deficit.wood + deficit.stone + deficit.iron;
      if (needTotal < minBatch) continue;

      const needKey = ['wood', 'stone', 'iron'].sort((a, b) => deficit[b] - deficit[a])[0];
      const donors = towns.filter(s => s.id !== tgt.id).map(s => {
        const src = ledger[s.id];
        if (!src || !(src.cap > 0) || src.tradeCap < minBatch) return null;
        const keep = Math.floor(src.cap * reserve);
        const surplus = Math.max(0, (src[needKey] || 0) - keep);
        if (surplus < minBatch / 3) return null;
        return { s, src, surplus, keep };
      }).filter(Boolean);
      donors.sort((a, b) => b.surplus - a.surplus);
      for (const d of donors) {
        if (jobs.length >= 6) return jobs;
        const src = d.src;

        const room = {
          wood: tradeFreeSpace(cur, 'wood'), stone: tradeFreeSpace(cur, 'stone'), iron: tradeFreeSpace(cur, 'iron'),
        };
        const send = {
          wood: Math.min(deficit.wood, Math.max(0, src.wood - d.keep), src.tradeCap, room.wood == null ? Infinity : room.wood),
          stone: Math.min(deficit.stone, Math.max(0, src.stone - d.keep), src.tradeCap, room.stone == null ? Infinity : room.stone),
          iron: Math.min(deficit.iron, Math.max(0, src.iron - d.keep), src.tradeCap, room.iron == null ? Infinity : room.iron),
        };
        let total = send.wood + send.stone + send.iron;
        if (total < minBatch) continue;
        if (total > src.tradeCap) {
          const scale = src.tradeCap / total;
          send.wood = Math.floor(send.wood * scale);
          send.stone = Math.floor(send.stone * scale);
          send.iron = Math.floor(send.iron * scale);
          total = send.wood + send.stone + send.iron;
        }
        if (total < minBatch) continue;
        if (needTotal > src.tradeCap * 4) {
          gbLogT('trade-goal-far-' + tgt.id, 300000,
            `trade ${preset}: deficit ${needTotal} >> tradeCap - skip unreachable goal this session`);
          break;
        }
        const job = { from: d.s.id, to: tgt.id, wood: send.wood, stone: send.stone, iron: send.iron };
        jobs.push(job);
        tradeApplyJob(ledger, job);
        deficit.wood = Math.max(0, deficit.wood - job.wood);
        deficit.stone = Math.max(0, deficit.stone - job.stone);
        deficit.iron = Math.max(0, deficit.iron - job.iron);
        if (deficit.wood + deficit.stone + deficit.iron < minBatch) break;
      }
    }
    return jobs;
  }

  const TRADE_ROUTE_THROTTLE_MS = 60000;
  const TRADE_ROUTE_MAX_JOBS = 4;
  const TRADE_ROUTE_TRIGGERS = ['always', 'belowPct', 'abovePct'];

  const tradeRouteRuntime = Object.create(null);

  function tradeRouteClean(raw, idx) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const from = String(raw.from == null ? '' : raw.from);
    const to = String(raw.to == null ? '' : raw.to);
    if (!from || !to || from === to) return null;
    const amt = k => {
      const n = +raw[k];
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    };
    const wood = amt('wood'), stone = amt('stone'), iron = amt('iron');
    if (!(wood + stone + iron > 0)) return null;
    const t = (raw.trigger && typeof raw.trigger === 'object') ? raw.trigger : {};
    const mode = TRADE_ROUTE_TRIGGERS.includes(t.mode) ? t.mode : 'always';
    const resource = GB_RES_KEYS.includes(t.resource) ? t.resource : 'wood';
    const value = Math.max(0, Math.min(100, Number.isFinite(+t.value) ? +t.value : 0));

    const id = /^[A-Za-z0-9_:-]{1,32}$/.test(String(raw.id || '')) ? String(raw.id)
      : ('r_' + from + '_' + to + (idx == null ? '' : '_' + idx));
    return {
      id, from, to, wood, stone, iron,
      minBatch: Math.max(1, Number.isFinite(+raw.minBatch) ? Math.floor(+raw.minBatch) : 100),
      maxPerCycle: Math.max(0, Number.isFinite(+raw.maxPerCycle) ? Math.floor(+raw.maxPerCycle) : 0),
      trigger: { mode, resource, value },
      enabled: raw.enabled !== false,
    };
  }
  function tradeRoutesSave(list) {
    const out = {};
    (Array.isArray(list) ? list : []).forEach((r, i) => {
      const c = tradeRouteClean(r, i);
      if (c && !out[c.id]) out[c.id] = c;
    });
    state.tradeRoutes = out;
    save(STORE.TRADE_ROUTES, out);
    return out;
  }

  function tradeRouteTriggerOk(route, tgtLive) {
    const mode = route.trigger && route.trigger.mode;
    if (mode === 'always' || !mode) return true;
    if (!tgtLive || !(tgtLive.cap > 0)) return null;
    const res = route.trigger.resource;
    const have = +tgtLive[res];
    if (!Number.isFinite(have)) return null;
    const pct = have / tgtLive.cap * 100;
    return mode === 'belowPct' ? pct < route.trigger.value : pct > route.trigger.value;
  }
  function tradeRouteJobs(towns, L) {
    if (!state.autoTradeRoutes) return [];
    const ledger = L || tradeLedger(towns);
    if (!ledger) return [];
    const jobs = [];
    const now = Date.now();
    const reserve = Math.min(80, Math.max(0, gbCfgNum(state.tradeReservePct, 20))) / 100;
    const stored = (state.tradeRoutes && typeof state.tradeRoutes === 'object' && !Array.isArray(state.tradeRoutes)) ? state.tradeRoutes : {};
    const liveIds = new Set(Object.keys(stored));

    for (const k of Object.keys(tradeRouteRuntime)) if (!liveIds.has(k)) delete tradeRouteRuntime[k];
    for (const [key, raw] of Object.entries(stored)) {
      const route = tradeRouteClean(raw, null);
      if (!route || !route.enabled) continue;

      route.id = key;
      const rt = tradeRouteRuntime[key] || (tradeRouteRuntime[key] = { lastFiredAt: 0, lastSent: null });
      if (now - rt.lastFiredAt < TRADE_ROUTE_THROTTLE_MS) continue;
      const src = ledger[route.from], tgt = ledger[route.to];
      if (!src || !tgt || !(src.cap > 0) || !(tgt.cap > 0)) {
        gbLogT('trade-route-blind-' + route.id, 600000, `trade route ${route.id}: ${route.from}->${route.to} town state unreadable - idling`);
        continue;
      }

      const fire = tradeRouteTriggerOk(route, tgt);
      if (fire === null) {
        gbLogT('trade-route-blind-' + route.id, 600000, `trade route ${route.id}: trigger resource unreadable on ${route.to} - idling`);
        continue;
      }
      if (!fire) continue;
      const keep = Math.floor(src.cap * reserve);
      let ironKeep = keep;
      if (route.iron > 0) {
        try {
          const r = ironReservedForCave(route.from);
          if (r && r.reserved) {
            const thresh = gbCfgClamp(state.caveThreshPct, 50, 99, 90) / 100;
            ironKeep = Math.max(keep, Math.ceil(src.cap * thresh));
            gbLogT('trade-route-iron-reserved-' + route.id, 600000,
              `trade route ${route.id}: iron held for cave on ${route.from}`);
          }
        } catch (_) {}
      }
      const send = {};
      for (const k of GB_RES_KEYS) {
        const want = +route[k] || 0;
        if (!(want > 0)) { send[k] = 0; continue; }
        const k2 = k === 'iron' ? ironKeep : keep;
        send[k] = Math.max(0, Math.min(want, src[k] - k2, src.tradeCap, tgt.cap - tgt[k]));
      }
      let total = send.wood + send.stone + send.iron;
      if (route.maxPerCycle > 0 && total > route.maxPerCycle) {
        const scale = route.maxPerCycle / total;
        for (const k of GB_RES_KEYS) send[k] = Math.floor(send[k] * scale);
        total = send.wood + send.stone + send.iron;
      }
      if (total > src.tradeCap) {
        const scale = src.tradeCap / total;
        for (const k of GB_RES_KEYS) send[k] = Math.floor(send[k] * scale);
        total = send.wood + send.stone + send.iron;
      }
      if (total < route.minBatch) continue;
      const job = { from: route.from, to: route.to, wood: send.wood, stone: send.stone, iron: send.iron, route: route.id };
      jobs.push(job);
      tradeApplyJob(ledger, job);
      rt.lastFiredAt = now;
      rt.lastSent = { wood: send.wood, stone: send.stone, iron: send.iron, ts: now };
      if (jobs.length >= TRADE_ROUTE_MAX_JOBS) break;
    }
    return jobs;
  }
  function tradeValidateOverflowJob(job, src, tgt) {
    const resource = job.overflowResource;
    if (!resource || !GB_RES_KEYS.includes(resource)) return { ok:true };
    const incomingState = tradeIncomingByTown();
    if (!incomingState.known) return { ok:false, why:'incoming-trades-unreadable' };
    const attackState = tradeTownsUnderAttack();
    if (!attackState.known) return { ok:false, why:'incoming-attacks-unreadable' };
    const liveDestinations = tradeAutoTowns(tradeListTowns()).filter(t => String(t.id) !== String(src.id));
    const projected = [];
    for (const t of liveDestinations) {
      const id = String(t.id);
      if (attackState.value && attackState.value.has(id)) continue;
      if (!(t.cap > 0) || t[resource] == null) continue;
      const mov = incomingState.byTown[id] || {};
      let pending;
      try { pending = plannerPendingForTown(id).incoming || {}; } catch (_) { return { ok:false, why:'planner-incoming-unreadable' }; }
      const value = +t[resource] + (+mov[resource] || 0) + (+pending[resource] || 0);
      if (!Number.isFinite(value)) continue;
      projected.push(Object.assign({}, t, {
        [resource]:value,
        free:Math.max(0, +t.cap - value),
      }));
    }
    if (!projected.length) return { ok:false, why:'no-intercity-destination-under-80' };
    const decision = tradeOverflowDecision([src].concat(projected), resource, tradeOverflowPct(), tradeTransferPct(), tradeReceiverPct());
    if (!decision.ok) return { ok:false, why:decision.reason };
    if (String(decision.target) !== String(job.to)) {
      job.to = decision.target;
      job.wood = 0; job.stone = 0; job.iron = 0;
    }
    job[resource] = decision.amount;
    job.destinationFill = decision.destinationFill;
    job.destinationFree = decision.destinationFree;
    return { ok:true };
  }
  function tradeDeadlockJobs(towns, L) {
    const ledger = L || tradeLedger(towns);
    if (!ledger) return [];
    const minBatch = gbCfgClamp(state.tradeMinBatch, 100, Infinity, 1000);
    const RES = ['wood', 'stone', 'iron'];
    const jobs = [];
    const ids = towns.map(t => t.id);
    for (const srcId of ids) {
      const src = ledger[srcId];
      if (!src || !(src.cap > 0) || src.tradeCap < minBatch) continue;
      for (const res of RES) {
        if (src[res] / src.cap < 0.97) continue;
        let best = null;
        for (const tgtId of ids) {
          if (tgtId === srcId) continue;
          const tgt = ledger[tgtId];
          if (!tgt || !(tgt.cap > 0)) continue;
          const headroom = tgt.cap - tgt[res];
          if (headroom < minBatch) continue;
          const amount = Math.floor(Math.min(headroom, src.tradeCap, src[res] * 0.5));
          if (amount < minBatch) continue;
          if (!best || headroom > best.headroom) {
            best = { tgtId, amount, headroom };
          }
        }
        if (best) {
          const job = { from: srcId, to: best.tgtId, wood: 0, stone: 0, iron: 0, deadlock: true };
          job[res] = best.amount;
          jobs.push(job);
          tradeApplyJob(ledger, job);
          if (jobs.length >= 4) return jobs;
        }
      }
    }
    if (!jobs.length && typeof orchDeadlockNoteStuck === 'function') {
      orchDeadlockNoteStuck('no town has headroom in the pinned resource');
    }
    return jobs;
  }
  function tradeValidateJob(job) {
    const src = tradeTownRes(job.from);
    let tgt = tradeTownRes(job.to);
    if (!src || !tgt || !(src.cap > 0) || !(tgt.cap > 0)) return { ok: false, why: 'town-state-unreadable' };
    const overflowCheck = tradeValidateOverflowJob(job, src, tgt);
    if (!overflowCheck.ok) return overflowCheck;
    if (job.overflowResource) {
      tgt = tradeTownRes(job.to);
      if (!tgt || !(tgt.cap > 0)) return { ok:false, why:'town-state-unreadable' };
    }
    const reserveN = Number(state.tradeReservePct);
    const reservePct = Math.min(80, Math.max(0, Number.isFinite(reserveN) ? reserveN : 20)) / 100;
    const keep = Math.floor(src.cap * reservePct);
    const total = (+job.wood || 0) + (+job.stone || 0) + (+job.iron || 0);
    const pav = plannerAvailable(job.from, {allowSoft:false});
    const incomingState=tradeIncomingByTown();if(!incomingState.known)return {ok:false,why:'incoming-trades-unreadable'};const mov=incomingState.byTown[String(job.to)]||{};let pending={};try{pending=plannerPendingForTown(job.to).incoming||{}}catch(_){}
    if (!pav) return { ok:false, why:'planner-unreadable' };

    const num = (v) => (Number.isFinite(+v) ? +v : null);
    const srcCap = num(src.tradeCap), pavCap = num(pav.tradeCap);
    if (!(total > 0) || srcCap == null || srcCap < total || pav.tradeCap == null || pavCap == null || pavCap < total) return { ok: false, why: 'merchant-capacity' };
    for (const k of ['wood','stone','iron']) {
      const n = +job[k] || 0;
      const have = num(src[k]), avail = num(pav[k]), dest = num(tgt[k]), destCap = num(tgt.cap);
      if (have == null || avail == null || dest == null || destCap == null) return { ok: false, why: `unreadable-${k}` };
      if (n < 0 || have - n < keep || avail < n) return { ok: false, why: `source-${k}` };
      if (dest + (+mov[k]||0) + (+pending[k]||0) + n > destCap) return { ok: false, why: `target-${k}-capacity` };
    }
    return { ok: true };
  }

  let tradeUnderAttackCache = { at: 0, known: false, value: null };
  function tradeTownsUnderAttack() {
    if (Date.now() - tradeUnderAttackCache.at < 1000) return { known: tradeUnderAttackCache.known, value: tradeUnderAttackCache.value };
    let value = null, known = false;
    try {
      if (typeof dodgeIncomingSnapshot === 'function') {
        const snap = dodgeIncomingSnapshot();
        if (snap && snap.known === true && Array.isArray(snap.moves)) {
          const set = new Set();
          for (const m of snap.moves) { if (m && m.dest != null) set.add(String(m.dest)); }
          value = set; known = true;
        }
      } else if (typeof dodgeIncomingMovements === 'function') {
        const moves = dodgeIncomingMovements();
        if (Array.isArray(moves)) {
          const set = new Set();
          for (const m of moves) { if (m && m.dest != null) set.add(String(m.dest)); }
          value = set; known = true;
        }
      }
    } catch (_) {}
    tradeUnderAttackCache = { at: Date.now(), known, value };
    return { known, value };
  }
  function tradeTownUnderAttack(townId) {
    const u = tradeTownsUnderAttack();
    if (!u.known || !u.value) return false;
    return u.value.has(String(townId));
  }
  function tradeScan(reason, opts) {
    const o = opts || {};
    if (!hostEnabled() || (!state.autoTrade && !state.islandShip && !state.autoTransport && !state.autoTradeRoutes && !state.autoDump) || captchaPaused('trade')) return;
    if (automationPaused({})) return;
    const towns = tradeListTowns();
    if (towns.length < 2) { gbLogT('trade-towns', 180000, 'trade: need ≥2 towns'); return; }
    const autoTowns = tradeAutoTowns(towns);
    const autoPairOk = autoTowns.length >= 2;
    const ledger = tradeLedger(towns);
    if(!ledger){gbLogT('trade-incoming-unreadable',180000,'trade: incoming movements unavailable — fail closed');return}
    let jobs = [];

    if (!o.overflowOnly) {
      // Saved routes are explicit from/to rules, so they intentionally ignore the
      // automatic-town selector. All calculated inter-city movement respects it.
      if (state.autoTradeRoutes) jobs = jobs.concat(tradeRouteJobs(towns, ledger));
      if (!autoPairOk && (state.autoTrade || state.autoTransport || state.autoDump || state.islandShip)) {
        gbLogT('trade-town-filter', 180000, `trade: only ${autoTowns.length} automatic town(s) enabled - need ≥2`);
      }
      if (state.autoTransport && autoPairOk) jobs = jobs.concat(transportBalanceJobs(autoTowns, ledger));
      if (state.autoDump && autoPairOk) jobs = jobs.concat(dumpJobs(autoTowns, ledger));
    }

    if (state.autoTrade && autoPairOk) {
      let ruralPairs = new Set();
      if (!o.skipRural && state.autoRuralTrade) {
        ruralPairs = ruralExecutableOverflowPairSet(autoTowns);
        if (ruralPairs.size) {
          const rr = ruralTradeScan('trade-coordinator') || {};
          gbLogT('trade-rural-first', 60000, `trade: ${ruralPairs.size} town/resource rural-first pair(s); unrelated intercity remains eligible`);
          if (rr.reason === 'locked') ruralCoordinatorScheduleRetry();
        }
      }
      jobs = jobs.concat(tradeOverflowJobs(autoTowns, ledger, ruralPairs));
      if (typeof orchDeadlockOpen === 'function' && orchDeadlockOpen()) {
        const dead = jobs.length > 0 && !jobs.some(j => tradeValidateJob(j).ok);
        if (!jobs.length || dead) {
          const dl = tradeDeadlockJobs(autoTowns, dead ? tradeLedger(autoTowns) : ledger);
          if (dl.length) {
            gbLog(`trade: deadlock drain - ${dl.length} job(s) on the pinned resource${dead ? ` (replaced ${jobs.length} job(s) the validator rejects)` : ''}`);
            if (dead) jobs = [];
            jobs = jobs.concat(dl);
          }
        }
      }
    }
    if (!o.overflowOnly && state.islandShip && autoPairOk) jobs = jobs.concat(tradeIslandShipJobs(autoTowns, ledger));

    const underAttack = tradeTownsUnderAttack();
    if (!underAttack.known) {
      gbLogT('trade-incoming-unreadable', 180000, 'trade: incoming attacks unreadable — fail closed');
      return;
    }
    if (underAttack.value && underAttack.value.size) {
      const before = jobs.length;
      jobs = jobs.filter(j => !underAttack.value.has(String(j.to)));
      const dropped = before - jobs.length;
      if (dropped) gbLog(`trade: ${dropped} job(s) dropped — target under attack`);
    }
    if (!jobs.length) {
      gbLogT('trade-idle', 180000, `trade: nothing to send (${scanReason(reason)})`);
      return;
    }
    let i = 0, done = 0, stopped = false;
    (function next() {
      if(stopped)return;
      if (i >= jobs.length) {
        if (done) gbLog(`trade: sent ${done}/${jobs.length}`);
        return;
      }
      const j=jobs[i++];
      const lockName=`trade:${String(j.from)}`;
      const lockToken=gbLock(lockName,120000);
      if(!lockToken){gbTimeout(next,100);return}
      const valid=tradeValidateJob(j);
      if(!valid.ok){
        gbUnlock(lockName,lockToken);
        gbLogT('trade-stale-'+j.from+'-'+j.to,60000,`trade: stale job ${j.from}→${j.to} skipped (${valid.why})`);
        gbTimeout(next,100);return;
      }
      tradeSend(j.from,j.to,j.wood,j.stone,j.iron,(err)=>{
        gbUnlock(lockName,lockToken);
        if(err==='captcha'||err==='captcha-pause'){stopped=true;return}
        if(!err){done++;gbLog(`trade: ${j.from}→${j.to} w${j.wood}/s${j.stone}/i${j.iron}`)}
        else gbLogT('trade-err',60000,`trade err ${err}`);
        gbTimeout(next,800+Math.random()*600);
      });
    })();
  }

  const TRANSPORT_MAX_JOBS = 4;
  const TRANSPORT_SRC_FILL = 0.85;
  const TRANSPORT_TGT_FILL = 0.25;
  const TRANSPORT_ETA_MAX_MS = 24 * 3600 * 1000;
