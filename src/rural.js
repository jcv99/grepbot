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
  const KP_UNLOCK_MIN = 100; // stop unlocking when KP ≤ this; upgrades resume only when no locked villages remain
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

    // Phase gate: while any village world-wide is still locked, only unlock.
    // Upgrades resume once locked.length === 0 (user policy: unlock everything first).
    const jobQueue = [];
    if (locked.length > 0) {
      // KP gate: hold off unlocks when KP has dropped to ≤ KP_UNLOCK_MIN.
      // 6th+ unlock costs 100 KP, so this is the natural threshold below which no new unlock fires.
      if (available > KP_UNLOCK_MIN) {
        const startUnlocked = relations.length - locked.length;
        // Queue every locked village across every own-town island. Per-fire KP re-check
        // (below) stops the batch if KP drains mid-queue or another post fails.
        for (const tid of townIds) {
          const xy = ruralTownIslandXY(tid);
          if (!xy) continue;
          for (const rel of locked) {
            const a = rel.attributes || {};
            const ft = farmById[a.farm_town_id];
            if (!ft || ft.island_x !== xy.x || ft.island_y !== xy.y) continue;
            jobQueue.push({ kind: 'unlock', relId: a.id || rel.id, farmId: a.farm_town_id, townId: tid });
          }
        }
        if (!jobQueue.length) {
          gbLogT('rurallevel-no-island-match', 180000, 'rural-level: locked villages exist but none match own-town islands');
          return;
        }
        // Locked-attached metadata: cost steps up per successful unlock in this pass.
        jobQueue._startUnlocked = startUnlocked;
      } else {
        gbLogT('rurallevel-kp-low', 180000, `rural-level: ${locked.length} locked village(s) waiting; KP ${available} ≤ ${KP_UNLOCK_MIN} — upgrades only after unlock phase drains`);
        return;
      }
    } else {
      // UPGRADE PHASE: world-wide locked.length === 0, so upgrades are safe to fire.
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
            jobQueue.push({ kind: 'upgrade', relId: a.id || rel.id, farmId: a.farm_town_id, townId: tid, stage, cost });
            available -= cost;
          }
        }
      }
    }

    if (!jobQueue.length) {
      gbLogT('rurallevel-idle', 180000, `rural-level: idle (${reason || 'scan'})`);
      return;
    }
    // Batch dispatch: a single lock guards the whole queue so the orch tick can't
    // double-fire. Lock TTL scales with queue length (≈1s/job, cap 10min).
    const lockTtl = Math.min(600000, Math.max(180000, jobQueue.length * 1500));
    const ruralLevelLock = gbLock('rural-level', lockTtl);
    if (!ruralLevelLock) return;
    let i = 0, done = 0, stopped = '';
    const startUnlocked = jobQueue._startUnlocked || 0;
    (function next() {
      if (i >= jobQueue.length || stopped) {
        gbUnlock('rural-level', ruralLevelLock);
        if (done) gbLog(`rural-level: ${done}/${jobQueue.length}${stopped ? ' (stopped: ' + stopped + ')' : ''} — phase: ${locked.length ? 'unlock' : 'upgrade'}`);
        return;
      }
      const j = jobQueue[i++];
      // Pre-fire KP gate: only matters for unlock; stops the batch mid-queue.
      if (j.kind === 'unlock') {
        const cur = ruralKillpoints();
        if (cur <= KP_UNLOCK_MIN) { stopped = 'kp-low'; return next(); }
        const idx = startUnlocked + done; // how many unlock slots already taken this pass
        const need = idx < unlockCosts.length ? unlockCosts[idx] : 100;
        if (cur < need) { stopped = 'kp-short(need ' + need + ')'; return next(); }
      }
      gbLockTouch('rural-level', ruralLevelLock);
      const fire = j.kind === 'unlock' ? ruralUnlock : ruralUpgrade;
      fire(j.relId, j.farmId, j.townId, (err) => {
        if (err === 'captcha' || err === 'captcha-pause') {
          stopped = err;
          gbUnlock('rural-level', ruralLevelLock);
          gbLogT('rurallevel-pause', 60000, `rural-level paused: ${err}`);
          return;
        }
        if (!err) {
          done++;
        } else if (j.kind === 'unlock') {
          // One bad unlock stops the batch — server already charged KP; firing the next one
          // would compound the loss. Upgrades resume next pass.
          stopped = 'unlock-err:' + err;
        }
        gbTimeout(next, 700 + Math.random() * 400);
      });
    })();
  }

  const RESEARCH_CHECK_MS = 45000;
  const RESEARCH_CS_FAST = ['booty', 'ceramics', 'architecture', 'crane', 'shipwright', 'colonize_ship', 'mathematics'];
