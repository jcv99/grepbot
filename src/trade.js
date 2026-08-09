  function tradeTownRes(townId) {
    const uw = gameUw();
    try {
      const t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]);
      if (!t) return null;
      const r = t.resources && t.resources();
      let cap = null, tradeCap = null, pop = null, small = false;
      try { if (t.getStorageCapacity) cap = +t.getStorageCapacity(); } catch (_) {}
      if (!(cap > 0)) { const shared = townResState(townId); if (shared) cap = shared.cap; }
      try { if (t.getAvailableTradeCapacity) tradeCap = +t.getAvailableTradeCapacity(); } catch (_) {}
      try { if (t.getAvailablePopulation) pop = +t.getAvailablePopulation(); } catch (_) {}
      try {
        const a = t.attributes || (t.get && t.get('on_small_island') != null ? { on_small_island: t.get('on_small_island') } : {});
        small = !!(a.on_small_island || (t.isOnSmallIsland && t.isOnSmallIsland()));
      } catch (_) {}
      return {
        id: +townId,
        wood: r && +r.wood || 0, stone: r && +r.stone || 0, iron: r && +r.iron || 0,
        cap: cap || 0, tradeCap: tradeCap || 0, pop: pop || 0, small,
      };
    } catch (_) { return null; }
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
    try{const c=uw.MM&&uw.MM.getOnlyCollectionByName&&uw.MM.getOnlyCollectionByName('Trade');if(c){known=true;addCollection(c)}for(const name of ['Trades','TradeMovement','TradeMovements','TownTrade','TownTrades','Transport','Transports'])addCollection(uw.MM&&uw.MM.getOnlyCollectionByName&&uw.MM.getOnlyCollectionByName(name))}catch(_){}
    try{const all=uw.MM&&uw.MM.getCollections&&uw.MM.getCollections()||{};if(Object.prototype.hasOwnProperty.call(all,'Trade'))known=true;for(const [name,c] of Object.entries(all))if(/trade|transport/i.test(name))addCollection(c)}catch(_){}
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
      const mov=incoming[String(t.id)]||{},pending=plannerSnapshot(t.id)?.incoming||{};
      L[t.id] = {
        // Counting both visible movements and short-lived transaction holds can
        // temporarily double count, which is intentionally safer than overfill.
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
  function tradeFillStorageJobs(towns, L) {
    const ledger = L || tradeLedger(towns);
    if(!ledger)return [];
    const reserveN = Number(state.tradeReservePct);
    const reserve = Math.min(80, Math.max(0, Number.isFinite(reserveN) ? reserveN : 20)) / 100;
    const minBatch = Math.max(100, +state.tradeMinBatch || 1000);
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
    const minBatch = Math.max(100, +state.tradeMinBatch || 1000);
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
  // Free warehouse space for one resource. null = capacity unreadable (blind, NOT "full").
  function tradeFreeSpace(tgt, res) {
    if (!tgt || !(tgt.cap > 0)) return null;
    return Math.max(0, tgt.cap - (+tgt[res] || 0));
  }
  function tradeGoalDeficit(townId, preset) {
    // → {wood,stone,iron} | null (blind / nothing)
    if (preset === 'party') {
      if (typeof ironReservedForCave === 'function') {
        const r = ironReservedForCave(townId);
        if (r && r.reserved) {
          gbLogT('trade-party-cave-' + townId, 120000, `trade party: skip town ${townId} - iron reserved for cave`);
          return { wood: 0, stone: 0, iron: 0 };
        }
      }
      const types = state.cultureTypes || {};
      const order = ['festival', 'theater', 'procession']; // olympic excluded (gold)
      let ctype = null;
      for (const ui of order) {
        if (!types[ui]) continue;
        ctype = ({ festival: 'party', procession: 'triumph', theater: 'theater' })[ui] || ui;
        if (ctype === 'triumph') continue; // killpoints, not resources
        break;
      }
      if (!ctype || !CULTURE_COSTS[ctype]) return { wood: 0, stone: 0, iron: 0 };
      const cost = CULTURE_COSTS[ctype];
      return {
        wood: +cost.wood || 0,
        stone: +cost.stone || 0,
        iron: +cost.iron || 0,
      };
    }
    if (preset === 'unit') {
      const want = (state.recruitTargets || {})[townId] || (state.recruitTargets || {})[String(townId)];
      if (!want || typeof want !== 'object') return { wood: 0, stone: 0, iron: 0 };
      let wood = 0, stone = 0, iron = 0;
      for (const unit of Object.keys(want)) {
        const count = +want[unit] || 0;
        if (!(count > 0)) continue;
        let def = null;
        try { def = typeof recruitUnitDef === 'function' ? recruitUnitDef(unit) : null; } catch (_) {}
        if (!def || !def.resources) {
          gbLogT('trade-unit-nocost-' + unit, 120000, `trade unit: unknown cost for ${unit} - town ${townId} blind`);
          return null;
        }
        wood += (+def.resources.wood || 0) * count;
        stone += (+def.resources.stone || 0) * count;
        iron += (+def.resources.iron || 0) * count;
      }
      return { wood, stone, iron };
    }
    return null;
  }
  function tradeGoalJobs(towns, L, preset) {
    const ledger = L || tradeLedger(towns);
    const reserve = Math.min(80, Math.max(0, gbCfgNum(state.tradeReservePct, 20))) / 100;
    const minBatch = Math.max(100, +state.tradeMinBatch || 1000);
    const byId = Object.create(null);
    towns.forEach(t => { byId[t.id] = t; });
    const jobs = [];
    for (const tgt of towns) {
      const goal = tradeGoalDeficit(tgt.id, preset);
      if (goal == null) continue; // blind
      const cur = ledger[tgt.id];
      if (!cur) continue;
      const deficit = {
        wood: Math.max(0, goal.wood - cur.wood),
        stone: Math.max(0, goal.stone - cur.stone),
        iron: Math.max(0, goal.iron - cur.iron),
      };
      const needTotal = deficit.wood + deficit.stone + deficit.iron;
      if (needTotal < minBatch) continue;
      // Prefer donor with largest surplus of the scarcest needed resource
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
        // Goal presets are deficit-driven, so the half-gap rule does not apply, but the
        // free-space cap does: a haul over the target warehouse is lost on arrival.
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
  function tradeValidateJob(job) {
    const src = tradeTownRes(job.from), tgt = tradeTownRes(job.to);
    if (!src || !tgt || !(src.cap > 0) || !(tgt.cap > 0)) return { ok: false, why: 'town-state-unreadable' };
    const reserveN = Number(state.tradeReservePct);
    const reservePct = Math.min(80, Math.max(0, Number.isFinite(reserveN) ? reserveN : 20)) / 100;
    const keep = Math.floor(src.cap * reservePct);
    const total = (+job.wood || 0) + (+job.stone || 0) + (+job.iron || 0);
    const pav = plannerAvailable(job.from, {allowSoft:false});
    const incomingState=tradeIncomingByTown();if(!incomingState.known)return {ok:false,why:'incoming-trades-unreadable'};const mov=incomingState.byTown[String(job.to)]||{},pending=plannerSnapshot(job.to)?.incoming||{};
    if (!pav) return { ok:false, why:'planner-unreadable' };
    if (!(total > 0) || src.tradeCap < total || pav.tradeCap == null || pav.tradeCap < total) return { ok: false, why: 'merchant-capacity' };
    for (const k of ['wood','stone','iron']) {
      const n = +job[k] || 0;
      if (n < 0 || src[k] - n < keep || pav[k] < n) return { ok: false, why: `source-${k}` };
      if (tgt[k] + (+mov[k]||0) + (+pending[k]||0) + n > tgt.cap) return { ok: false, why: `target-${k}-capacity` };
    }
    return { ok: true };
  }

  function tradeScan(reason) {
    if (!hostEnabled() || (!state.autoTrade && !state.islandShip) || captchaPaused('trade')) return;
    if (automationPaused({})) return;
    if (gbLocked('trade')) return;
    const towns = tradeListTowns();
    if (towns.length < 2) { gbLogT('trade-towns', 180000, 'trade: need ≥2 towns'); return; }
    const ledger = tradeLedger(towns);
    if(!ledger){gbLogT('trade-incoming-unreadable',180000,'trade: incoming movements unavailable — fail closed');return}
    let jobs = [];
    const preset = state.tradePreset || 'storage';

    if (state.autoTrade && preset === 'smart') {
      jobs = jobs.concat(tradePredictiveJobs(towns, ledger));
    } else if (state.autoTrade && preset === 'storage') {
      jobs = jobs.concat(tradeFillStorageJobs(towns, ledger));
    } else if (state.autoTrade && (preset === 'party' || preset === 'unit')) {
      jobs = jobs.concat(tradeGoalJobs(towns, ledger, preset));
    }
    if (state.islandShip) jobs = jobs.concat(tradeIslandShipJobs(towns, ledger));
    if (!jobs.length) {
      gbLogT('trade-idle', 180000, `trade: nothing to send (${reason || 'scan'})`);
      return;
    }
    const lockToken = gbLock('trade');
    if (!lockToken) return;
    let i = 0, done = 0;
    (function next() {
      gbLockTouch('trade', lockToken);
      if (i >= jobs.length) {
        gbUnlock('trade', lockToken);
        if (done) gbLog(`trade: sent ${done}/${jobs.length}`);
        return;
      }
      const j = jobs[i++];
      const valid = tradeValidateJob(j);
      if (!valid.ok) {
        gbLogT('trade-stale-' + j.from + '-' + j.to, 60000, `trade: stale job ${j.from}→${j.to} skipped (${valid.why})`);
        gbTimeout(next, 100);
        return;
      }
      tradeSend(j.from, j.to, j.wood, j.stone, j.iron, (err) => {
        if (err === 'captcha' || err === 'captcha-pause') { gbUnlock('trade', lockToken); return; }
        if (!err) {
          done++;
          gbLog(`trade: ${j.from}→${j.to} w${j.wood}/s${j.stone}/i${j.iron}`);
        } else gbLogT('trade-err', 60000, `trade err ${err}`);
        gbTimeout(next, 800 + Math.random() * 600);
      });
    })();
  }

  const RURAL_TRADE_MS = 90000;
  const RURAL_LEVEL_MS = 120000;
