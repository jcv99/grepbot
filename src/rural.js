  function ruralRelModels() {
    try {
      const uw = gameUw();
      const col = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('FarmTownPlayerRelation');
      return (col && col.models) || [];
    } catch (_) { return []; }
  }
  function ruralFarmModels() {
    try {
      const uw = gameUw();
      const col = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('FarmTown');
      return (col && col.models) || [];
    } catch (_) { return []; }
  }
  function ruralTownIslandXY(townId) {
    const uw = gameUw();
    try {
      const t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]);
      if (!t) return null;
      return { x: t.getIslandCoordinateX && t.getIslandCoordinateX(), y: t.getIslandCoordinateY && t.getIslandCoordinateY(), t };
    } catch (_) { return null; }
  }
  function ruralTradePost(relationId, farmTownId, amount, townId, onDone) {
    bridgePost('ruraltrade', {
      model_url: `FarmTownPlayerRelation/${relationId}`,
      action_name: 'trade',
      arguments: { farm_town_id: +farmTownId, amount: Math.min(3000, Math.max(100, +amount)) },
      town_id: +townId,
    }, onDone);
  }
  function ruralUnlock(relationId, farmTownId, townId, onDone) {
    bridgePost('rurallevel', {
      model_url: `FarmTownPlayerRelation/${relationId}`,
      action_name: 'unlock',
      arguments: { farm_town_id: +farmTownId },
      town_id: +townId,
    }, onDone);
  }
  function ruralUpgrade(relationId, farmTownId, townId, onDone) {
    bridgePost('rurallevel', {
      model_url: `FarmTownPlayerRelation/${relationId}`,
      action_name: 'upgrade',
      arguments: { farm_town_id: +farmTownId },
      town_id: +townId,
    }, onDone);
  }

  function ruralTradeReadyAt(a) {
    const v = gbProbeAttr(a, ['trade_at', 'tradeable_at', 'next_trade_at', 'lootable_at']);
    return v != null && v > 0 ? v : null;
  }
  function ruralTradeScan(reason) {
    if (!hostEnabled() || !state.autoRuralTrade || captchaPaused('ruraltrade')) return;
    if (automationPaused({})) return;
    if (gbLocked('rural-trade')) return;

    const wantRes = state.ruralTradeRes || 'iron';
    const minRatio = +state.ruralTradeRatio || 1.0;
    const relations = ruralRelModels();
    const farms = ruralFarmModels();
    const farmById = {};
    farms.forEach(f => { const a = f.attributes || {}; if (a.id != null) farmById[a.id] = a; });
    const jobs = [];
    const capLeft = Object.create(null);
    let townIds = [];
    try {
      const uw = gameUw();
      townIds = Object.keys((uw.ITowns && uw.ITowns.towns) || {});
    } catch (_) {}
    for (const tid of townIds) {
      const xy = ruralTownIslandXY(tid);
      if (!xy || xy.x == null) continue;
      let tradeCap = 0;
      try { tradeCap = +xy.t.getAvailableTradeCapacity(); } catch (_) {}
      if (tradeCap < 500) continue;
      capLeft[tid] = tradeCap;

      const st = townResState(tid);
      if (st && st.full && st.full[wantRes]) {
        gbLogT('ruraltrade-full-' + tid, 120000,
          `rural-trade: town ${tid} ${wantRes} already at capacity — skip`);
        continue;
      }
      const now = gameNow();
      for (const rel of relations) {
        if ((capLeft[tid] || 0) < 500) break;
        const a = rel.attributes || {};
        if (+a.relation_status !== 1) continue;
        const readyAt = ruralTradeReadyAt(a);
        if (readyAt != null && readyAt > now) continue;
        const ft = farmById[a.farm_town_id];
        if (!ft) continue;
        if (ft.island_x !== xy.x || ft.island_y !== xy.y) continue;
        if (ft.resource_offer && ft.resource_offer !== wantRes) continue;
        const ratio = +a.current_trade_ratio;
        if (!(ratio >= minRatio)) continue;
        const amount = Math.min(3000, capLeft[tid]);
        jobs.push({ relId: a.id || rel.id, farmId: a.farm_town_id, townId: tid, amount });
        capLeft[tid] -= amount;
        if (jobs.length >= 6) break;
      }
      if (jobs.length >= 6) break;
    }
    if (!jobs.length) {
      gbLogT('ruraltrade-idle', 180000, `rural-trade: idle (${reason || 'scan'})`);
      return;
    }
    const ruralTradeLock = gbLock('rural-trade', Math.max(180000, jobs.length * 30000));
    if (!ruralTradeLock) return;
    let i = 0, done = 0;
    (function next() {
      if (i >= jobs.length) {
        gbUnlock('rural-trade', ruralTradeLock);
        if (done) gbLog(`rural-trade: ${done}/${jobs.length}`);
        return;
      }
      const j = jobs[i++];
      gbLockTouch('rural-trade', ruralTradeLock);
      ruralTradePost(j.relId, j.farmId, j.amount, j.townId, (err) => {
        if (err === 'captcha' || err === 'captcha-pause') { gbUnlock('rural-trade', ruralTradeLock); return; }
        if (!err) {
          done++;
          gbLog(`rural-trade: town ${j.townId} farm ${j.farmId} amt ${j.amount} (≥${minRatio})`);
        }
        gbTimeout(next, 700 + Math.random() * 400);
      });
    })();
  }
  function ruralKillpoints() {
    try {
      const uw = gameUw();
      const kp = uw.MM.getModelByNameAndPlayerId('PlayerKillpoints');
      const a = kp && kp.attributes;
      return a ? (+a.att || 0) + (+a.def || 0) - (+a.used || 0) : 0;
    } catch (_) { return 0; }
  }
  function ruralLevelScan(reason) {
    if (!hostEnabled() || !state.autoRuralLevel || captchaPaused('rurallevel')) return;
    if (automationPaused({})) return;
    if (gbLocked('rural-level')) return;
    const maxLvl = Math.min(6, Math.max(1, +state.ruralLevelMax || 3));
    const relations = ruralRelModels();
    const farms = ruralFarmModels();
    const farmById = {};
    farms.forEach(f => { const a = f.attributes || {}; if (a.id != null) farmById[a.id] = a; });
    let available = ruralKillpoints();
    const unlockCosts = [2, 8, 10, 30, 50, 100];
    const levelCosts = [1, 5, 25, 50, 100];
    let townIds = [];
    try {
      const uw = gameUw();
      const seenIslands = new Set();
      for (const id of Object.keys((uw.ITowns && uw.ITowns.towns) || {})) {
        const t = uw.ITowns.towns[id];
        try {
          if (t.attributes && t.attributes.on_small_island) continue;
          const iid = t.getIslandId ? t.getIslandId() : (t.attributes && t.attributes.island_id);
          if (iid != null && seenIslands.has(iid)) continue;
          if (iid != null) seenIslands.add(iid);
          townIds.push(id);
        } catch (_) { townIds.push(id); }
      }
    } catch (_) {}
    const locked = relations.filter(r => +((r.attributes || {}).relation_status) === 0);

    const candidates = [];
    if (locked.length) {
      const unlocked = relations.length - locked.length;
      const need = unlocked < unlockCosts.length ? unlockCosts[unlocked] : 100;
      if (available >= need) {
        for (const tid of townIds) {
          const xy = ruralTownIslandXY(tid);
          if (!xy) continue;
          for (const rel of locked) {
            const a = rel.attributes || {};
            const ft = farmById[a.farm_town_id];
            if (!ft || ft.island_x !== xy.x || ft.island_y !== xy.y) continue;
            candidates.push({ kind: 'unlock', relId: a.id || rel.id, farmId: a.farm_town_id, townId: tid, cost: need });
            break;
          }
          if (candidates.length) break;
        }
      }
    }
    for (let level = 1; level < maxLvl; level++) {
      const cost = levelCosts[level - 1] || 100;
      if (available < cost) break;
      for (const tid of townIds) {
        const xy = ruralTownIslandXY(tid);
        if (!xy) continue;
        for (const rel of relations) {
          const a = rel.attributes || {};
          if (+a.relation_status !== 1) continue;
          if (a.expansion_at) continue;
          const stage = +a.expansion_stage || 0;
          if (stage > level) continue;
          if (stage >= maxLvl) continue;
          const ft = farmById[a.farm_town_id];
          if (!ft || ft.island_x !== xy.x || ft.island_y !== xy.y) continue;
          candidates.push({ kind: 'upgrade', relId: a.id || rel.id, farmId: a.farm_town_id, townId: tid, stage, cost });
          break;
        }
        if (candidates.some(c => c.kind === 'upgrade')) break;
      }
      if (candidates.some(c => c.kind === 'upgrade')) break;
    }

    const job = candidates.find(c => c.kind === 'unlock') || candidates[0] || null;
    if (!job) {
      gbLogT('rurallevel-idle', 180000, `rural-level: idle (${reason || 'scan'})`);
      return;
    }
    const ruralLevelLock = gbLock('rural-level', 180000);
    if (!ruralLevelLock) return;
    const done = (err) => {
      gbUnlock('rural-level', ruralLevelLock);
      if (!err) gbLog(`rural-level: ${job.kind} farm ${job.farmId} town ${job.townId}`);
      else gbLogT('rurallevel-err', 60000, `rural-level err ${err}`);
    };
    if (job.kind === 'unlock') ruralUnlock(job.relId, job.farmId, job.townId, done);
    else ruralUpgrade(job.relId, job.farmId, job.townId, done);
  }

  const RESEARCH_CHECK_MS = 45000;
  const RESEARCH_CS_FAST = ['booty', 'ceramics', 'architecture', 'crane', 'shipwright', 'colonize_ship', 'mathematics'];
