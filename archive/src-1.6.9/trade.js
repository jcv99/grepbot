  // ---------- inter-city trade (Phase 8.3) + island ship (Phase 9.3) ----------
  // ModernBot: town_info/trade { id: target, wood, stone, iron, town_id: source, nl_init: true }

  function tradeTownRes(townId) {
    const uw = gameUw();
    try {
      const t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]);
      if (!t) return null;
      const r = t.resources && t.resources();
      let cap = null, tradeCap = null, pop = null, small = false;
      let island = null, ix = null, iy = null;
      try { if (t.getStorageCapacity) cap = +t.getStorageCapacity(); } catch (_) {}
      if (!(cap > 0)) { const shared = townResState(townId); if (shared) cap = shared.cap; }
      try { if (t.getAvailableTradeCapacity) tradeCap = +t.getAvailableTradeCapacity(); } catch (_) {}
      try { if (t.getAvailablePopulation) pop = +t.getAvailablePopulation(); } catch (_) {}
      try {
        const a = t.attributes || (t.get && t.get('on_small_island') != null ? { on_small_island: t.get('on_small_island') } : {});
        small = !!(a.on_small_island || (t.isOnSmallIsland && t.isOnSmallIsland()));
        if (a.island_id != null) island = a.island_id;
        else if (typeof t.getIslandId === 'function') island = t.getIslandId();
        if (a.island_x != null) ix = +a.island_x;
        if (a.island_y != null) iy = +a.island_y;
      } catch (_) {}
      if (island == null || ix == null || iy == null) {
        try {
          const list = state.towns || [];
          const st = list.find(x => String(x.id) === String(townId));
          if (st) {
            if (island == null && st.island != null) island = st.island;
            if (ix == null && st.x != null) ix = +st.x;
            if (iy == null && st.y != null) iy = +st.y;
          }
        } catch (_) {}
      }
      return {
        id: +townId,
        wood: r && +r.wood || 0, stone: r && +r.stone || 0, iron: r && +r.iron || 0,
        cap: cap || 0, tradeCap: tradeCap || 0, pop: pop || 0, small,
        island: island != null ? island : null,
        x: ix, y: iy,
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
        id: t.id,
        wood: t.wood, stone: t.stone, iron: t.iron,
        cap: t.cap, tradeCap: t.tradeCap, small: t.small,
        island: t.island, x: t.x, y: t.y,
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
  // Free warehouse space for one resource. null = capacity unreadable (blind, NOT "full").
  function tradeFreeSpace(tgt, res) {
    if (!tgt || !(tgt.cap > 0)) return null;
    return Math.max(0, tgt.cap - (+tgt[res] || 0));
  }
  // Per-resource balancing rule. Two towns can never both be the donor of the same
  // resource: only the town holding MORE of it may ship it, and never more than half
  // the gap, so the pair lands on the same nominal amount instead of swapping roles
  // and shipping it back next pass. Hard-capped by the target's free warehouse space
  // (an overflowing haul is not refused by the server, it evaporates on arrival).
  function tradeShareFor(src, tgt, res, keep) {
    if (!src || !tgt) return 0;
    const have = +src[res] || 0, has = +tgt[res] || 0;
    const gap = have - has;
    if (!(gap > 0)) return 0;                       // target already >= source: never ship
    let amt = Math.min(Math.floor(gap / 2), Math.max(0, have - keep));
    const free = tradeFreeSpace(tgt, res);
    if (free == null) {
      gbLogT('trade-cap-blind-' + tgt.id, 300000,
        `trade: warehouse capacity unreadable for town ${tgt.id} - balancing on stock gap only`);
    } else {
      amt = Math.min(amt, free);
    }
    return Math.max(0, Math.floor(amt));
  }
  // Local island distance (attack.js comes later in concat; do not rely on it at parse time).
  function tradeIslandDist(a, b) {
    if (!a || !b) return null;
    if (a.island != null && b.island != null) {
      if (String(a.island) === String(b.island)) return 0;
    }
    if (a.x == null || a.y == null || b.x == null || b.y == null) return null;
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function tradeFillStorageJobs(towns, L, opts) {
    const ledger = L || tradeLedger(towns);
    const reserve = Math.min(80, Math.max(0, gbCfgNum(state.tradeReservePct, 20))) / 100;
    const minBatch = Math.max(100, +state.tradeMinBatch || 1000);
    const maxHops = Math.max(0, gbCfgNum(state.tradeMaxHops, 15));
    const urgent = !!(opts && opts.deadlock);
    const byId = Object.create(null);
    towns.forEach(t => { byId[t.id] = t; });
    const jobs = [];
    const ids = towns.map(t => t.id);
    for (const tgtId of ids) {
      const tgt = ledger[tgtId];
      if (!tgt || !(tgt.cap > 0)) continue;
      const empty = Math.min(tgt.wood, tgt.stone, tgt.iron) / tgt.cap;
      if (!urgent && empty >= 0.25) continue;
      const candidates = [];
      for (const srcId of ids) {
        if (srcId === tgtId) continue;
        const src = ledger[srcId];
        if (!src || !(src.cap > 0)) continue;
        const fill = Math.max(src.wood, src.stone, src.iron) / src.cap;
        if (fill <= 0.85 || src.tradeCap < minBatch) continue;
        const srcTown = byId[srcId], tgtTown = byId[tgtId];
        const dist = tradeIslandDist(srcTown || src, tgtTown || tgt);
        if (dist == null) {
          gbLogT('trade-island-blind', 300000, 'trade: island unreadable - allowing hop (blind ≠ refuse)');
        } else if (!urgent && dist > maxHops) {
          gbLogT('trade-hop-' + srcId + '-' + tgtId, 300000,
            `trade: refuse ${srcId}->${tgtId} hops ${dist.toFixed(1)} > max ${maxHops}`);
          continue;
        }
        const keep = Math.floor(src.cap * reserve);
        const send = {
          wood: Math.min(src.tradeCap, tradeShareFor(src, tgt, 'wood', keep)),
          stone: Math.min(src.tradeCap, tradeShareFor(src, tgt, 'stone', keep)),
          iron: Math.min(src.tradeCap, tradeShareFor(src, tgt, 'iron', keep)),
        };
        const total = send.wood + send.stone + send.iron;
        if (total < minBatch) continue;
        let scale = 1;
        if (total > src.tradeCap) scale = src.tradeCap / total;
        const surplus = Math.max(src.wood, src.stone, src.iron) - keep;
        candidates.push({
          from: srcId, to: tgtId,
          wood: Math.floor(send.wood * scale),
          stone: Math.floor(send.stone * scale),
          iron: Math.floor(send.iron * scale),
          dist: dist == null ? 9999 : dist,
          surplus,
        });
      }
      candidates.sort((a, b) => {
        if (a.dist !== b.dist) return a.dist - b.dist;
        return b.surplus - a.surplus;
      });
      for (const c of candidates) {
        if (c.wood + c.stone + c.iron < minBatch) continue;
        const job = { from: c.from, to: c.to, wood: c.wood, stone: c.stone, iron: c.iron };
        jobs.push(job);
        tradeApplyJob(ledger, job);
        if (jobs.length >= 6) return jobs;
        break; // one donor per target per pass
      }
    }
    return jobs;
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
        const share = src.tradeCap / 3;
        let wood = Math.min(share, tradeShareFor(src, tgt, 'wood', keep));
        let stone = Math.min(share, tradeShareFor(src, tgt, 'stone', keep));
        let iron = Math.min(share, tradeShareFor(src, tgt, 'iron', keep));
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
    const dl = (typeof econDeadlock === 'function') ? econDeadlock() : null;
    // storage = fill WH; party/unit are unimplemented planners (do not silently run storage)
    if (state.autoTrade && preset === 'storage') {
      jobs = jobs.concat(tradeFillStorageJobs(towns, ledger, { deadlock: !!(dl && dl.open) }));
    } else if (state.autoTrade && (preset === 'party' || preset === 'unit')) {
      jobs = jobs.concat(tradeGoalJobs(towns, ledger, preset));
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
