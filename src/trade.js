  // ---------- inter-city trade (Phase 8.3) + island ship (Phase 9.3) ----------
  // ModernBot: town_info/trade { id: target, wood, stone, iron, town_id: source, nl_init: true }

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
  // Mutable ledger so multi-job plans don't overbook src stock / tradeCap / tgt deficit (I9).
  function tradeLedger(towns) {
    const L = Object.create(null);
    for (const t of towns) {
      L[t.id] = {
        wood: t.wood, stone: t.stone, iron: t.iron,
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
    const reserve = Math.min(80, Math.max(0, gbCfgNum(state.tradeReservePct, 20))) / 100;
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
    const jobs = [];
    const minBatch = Math.max(100, +state.tradeMinBatch || 1000);
    const reservePct = gbCfgNum(state.tradeReservePct, 20) / 100;
    const ids = towns.map(t => t.id);
    for (const tgtId of ids) {
      const tgt = ledger[tgtId];
      if (!tgt || !tgt.small) continue;
      for (const srcId of ids) {
        const src = ledger[srcId];
        if (!src || src.small || src.tradeCap < 1000) continue;
        const keep = Math.floor((src.cap || 0) * reservePct);
        let wood = Math.max(0, Math.min(src.tradeCap / 3, src.wood - keep));
        let stone = Math.max(0, Math.min(src.tradeCap / 3, src.stone - keep));
        let iron = Math.max(0, Math.min(src.tradeCap / 3, src.iron - keep));
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
  function tradeScan(reason) {
    if (!hostEnabled() || (!state.autoTrade && !state.islandShip) || captchaPaused('trade')) return;
    if (automationPaused({})) return;
    if (gbLocked('trade')) return;
    const towns = tradeListTowns();
    if (towns.length < 2) { gbLogT('trade-towns', 180000, 'trade: need >=2 towns'); return; }
    const ledger = tradeLedger(towns);
    let jobs = [];
    const preset = state.tradePreset || 'storage';
    // storage = fill WH; party/unit are unimplemented planners (do not silently run storage)
    if (state.autoTrade && preset === 'storage') {
      jobs = jobs.concat(tradeFillStorageJobs(towns, ledger));
    } else if (state.autoTrade && (preset === 'party' || preset === 'unit')) {
      gbLogT('trade-preset-' + preset, 300000, `trade: preset=${preset} - unimplemented, fill-storage skipped`);
    }
    if (state.islandShip) jobs = jobs.concat(tradeIslandShipJobs(towns, ledger));
    if (!jobs.length) {
      gbLogT('trade-idle', 180000, `trade: nothing to send (${reason || 'scan'})`);
      return;
    }
    gbLock('trade');
    let i = 0, done = 0;
    (function next() {
      if (i >= jobs.length) {
        gbUnlock('trade');
        if (done) gbLog(`trade: sent ${done}/${jobs.length}`);
        return;
      }
      const j = jobs[i++];
      tradeSend(j.from, j.to, j.wood, j.stone, j.iron, (err) => {
        if (err === 'captcha' || err === 'captcha-pause') { gbUnlock('trade'); return; }
        if (!err) {
          done++;
          gbLog(`trade: ${j.from}->${j.to} w${j.wood}/s${j.stone}/i${j.iron}`);
        } else gbLogT('trade-err', 60000, `trade err ${err}`);
        gbTimeout(next, 800 + Math.random() * 600);
      });
    })();
  }
