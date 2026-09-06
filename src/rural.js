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
      const t = gbTownModel(townId);
      if (!t) return null;
      const islandId = typeof t.getIslandId === 'function' ? t.getIslandId() : (t.attributes && t.attributes.island_id);
      return { id: islandId != null ? String(islandId) : null, x: t.getIslandCoordinateX && t.getIslandCoordinateX(), y: t.getIslandCoordinateY && t.getIslandCoordinateY(), t };
    } catch (_) { return null; }
  }
  function ruralTradePost(relationId, farmTownId, amount, townId, onDone) {
    const fid = gbNum(farmTownId);
    const amt = gbNum(amount);
    const tid = gbNum(townId);
    if (fid == null || tid == null || amt == null || !(amt > 0)) {
      if (typeof onDone === 'function') onDone('invalid-args');
      return;
    }
    bridgePost('ruraltrade', {
      model_url: `FarmTownPlayerRelation/${relationId}`,
      action_name: 'trade',
      arguments: { farm_town_id: fid, amount: Math.floor(amt) },
      town_id: tid,
    }, onDone);
  }
  function ruralUnlock(relationId, farmTownId, townId, onDone) {
    const fid = gbNum(farmTownId);
    const tid = gbNum(townId);
    if (fid == null || tid == null) {
      gbLogT('rural-unlock-id', 60000, 'rural unlock: farm/town id unreadable — no post');
      return onDone && onDone('id-unreadable');
    }
    bridgePost('rurallevel', {
      model_url: `FarmTownPlayerRelation/${relationId}`,
      action_name: 'unlock',
      arguments: { farm_town_id: fid },
      town_id: tid,
    }, onDone);
  }
  function ruralUpgrade(relationId, farmTownId, townId, onDone) {
    const fid = gbNum(farmTownId);
    const tid = gbNum(townId);
    if (fid == null || tid == null) {
      gbLogT('rural-upgrade-id', 60000, 'rural upgrade: farm/town id unreadable — no post');
      return onDone && onDone('id-unreadable');
    }
    bridgePost('rurallevel', {
      model_url: `FarmTownPlayerRelation/${relationId}`,
      action_name: 'upgrade',
      arguments: { farm_town_id: fid },
      town_id: tid,
    }, onDone);
  }

  const RURAL_MS_EPOCH_FLOOR = 1e12;
  function ruralTradeCooldownState(rel) {
    const a = rel && (rel.attributes || rel);
    if (!a) return { known:false, ready:null, readyAt:null, source:'rural-cooldown-unreadable' };
    for (const key of ['can_trade','tradeable','is_tradeable','trade_ready']) {
      if (!Object.prototype.hasOwnProperty.call(a, key)) continue;
      const raw = a[key];
      if (typeof raw === 'boolean') return { known:true, ready:raw, readyAt:raw ? gameNow() : null, source:key };
      if (raw === 0 || raw === 1 || raw === '0' || raw === '1') return { known:true, ready:+raw === 1, readyAt:+raw === 1 ? gameNow() : null, source:key };
    }
    for (const key of ['trade_at','tradeable_at','next_trade_at','trade_cooldown_until','trade_available_at']) {
      if (!Object.prototype.hasOwnProperty.call(a, key)) continue;
      let v = gbNum(a[key]);
      if (v == null) return { known:false, ready:null, readyAt:null, source:key + ':invalid' };
      if (v >= RURAL_MS_EPOCH_FLOOR) v = Math.floor(v / 1000);
      return { known:true, ready:v <= 0 || v <= gameNow(), readyAt:v, source:key };
    }
    return { known:false, ready:null, readyAt:null, source:'rural-cooldown-unreadable' };
  }
  function ruralTradeReadyAt(rel) {
    const st = ruralTradeCooldownState(rel);
    return st.known ? st.readyAt : null;
  }
  function ruralBeneficiaryTown(islandKey, towns) {
    const r = resolveIslandResourceBeneficiary(islandKey, (towns || []).map(t => String(t.id)));
    return r.known ? r.townId : null;
  }
  function ruralTradeDecision(candidates) {
    return (Array.isArray(candidates) ? candidates : []).filter(c => c && c.ratio != null && +c.ratio >= 1 && c.returnedFill != null && +c.returnedFill <= tradeReceiverPct() && +c.amount > 0)
      .sort((a,b) => +a.returnedFill - +b.returnedFill || +b.ratio - +a.ratio || +b.amount - +a.amount || String(a.village).localeCompare(String(b.village), undefined, {numeric:true}))[0] || null;
  }
  function ruralOfferData(rel, farm) {
    const rm = rel || null, fm = farm || null;
    const a = rm && (rm.attributes || rm) || {};
    const f = fm && (fm.attributes || fm) || {};
    const firstString = (obj, keys) => {
      for (const key of keys) {
        const v = obj && obj[key];
        if (v != null && String(v) !== '') return String(v);
      }
      return null;
    };
    const firstNumber = (obj, keys) => {
      for (const key of keys) {
        if (!obj || !Object.prototype.hasOwnProperty.call(obj, key)) continue;
        const n = gbNum(obj[key]);
        if (n != null) return { value:n, source:key };
      }
      return null;
    };
    const callNumber = (obj, names) => {
      for (const name of names) {
        try {
          if (!obj || typeof obj[name] !== 'function') continue;
          const n = gbNum(obj[name]());
          if (n != null) return { value:n, source:name + '()' };
        } catch (_) {}
      }
      return null;
    };
    const give = firstString(a, ['resource_offer','resource_give','give_resource']) || firstString(f, ['resource_offer','resource_give','give_resource']);
    const receive = firstString(a, ['resource_receive','resource_demand','receive_resource']) || firstString(f, ['resource_receive','resource_demand','receive_resource']);
    const ratioHit = callNumber(rm, ['getCurrentTradeRatio','getTradeRatio']) || firstNumber(a, ['current_trade_ratio','trade_ratio','ratio']) || firstNumber(f, ['current_trade_ratio','trade_ratio']);
    const limitHit = callNumber(rm, ['getAvailableTradeCapacity','getTradeCapacity','getMaxTradeAmount','getTradeAmountLimit'])
      || firstNumber(a, ['available_trade_capacity','trade_capacity','max_trade_amount','amount_limit','trade_amount_limit'])
      || callNumber(fm, ['getAvailableTradeCapacity','getTradeCapacity','getMaxTradeAmount'])
      || firstNumber(f, ['available_trade_capacity','trade_capacity','max_trade_amount','amount_limit','trade_amount_limit']);
    const multiplierHit = callNumber(rm, ['getReceiveMultiplier','getOutputPerInput'])
      || firstNumber(a, ['receive_multiplier','return_multiplier','output_per_input','amount_received_per_input'])
      || firstNumber(f, ['receive_multiplier','return_multiplier','output_per_input','amount_received_per_input']);
    const ratio = ratioHit && ratioHit.value > 0 ? ratioHit.value : null;
    const limit = limitHit && limitHit.value >= 0 ? limitHit.value : null;
    // Grepolis' named trade ratio is the exchange output/input ratio. Prefer an
    // explicit output multiplier when exposed, otherwise use that authoritative ratio.
    const returnedMultiplier = multiplierHit && multiplierHit.value > 0 ? multiplierHit.value : ratio;
    return {
      give:GB_RES_KEYS.includes(String(give)) ? String(give) : null,
      receive:GB_RES_KEYS.includes(String(receive)) ? String(receive) : null,
      ratio, limit, returnedMultiplier,
      source:{ ratio:ratioHit && ratioHit.source || null, limit:limitHit && limitHit.source || null, multiplier:multiplierHit && multiplierHit.source || (ratio != null ? 'trade-ratio' : null) },
    };
  }
  function ruralSameIslandTowns(townId, liveTowns) {
    const src = ruralTownIslandXY(townId);
    if (!src) return { known:false, key:null, towns:[], ids:[], reason:'town-island-unreadable' };
    const key = src.id || resolveIslandIdByCoords(src.x, src.y);
    const rows = (liveTowns || []).filter(t => {
      const p = ruralTownIslandXY(t.id);
      if (!p) return false;
      if (key && p.id) return String(p.id) === String(key);
      return String(p.x) === String(src.x) && String(p.y) === String(src.y);
    });
    const ids = rows.map(t => String(t.id));
    if (!ids.length) return { known:false, key:key || null, towns:[], ids:[], reason:'same-island-towns-unreadable' };
    if (!key && Object.keys(state.islandBeneficiaries || {}).length) return { known:false, key:null, towns:rows, ids, reason:'canonical-island-unreadable' };
    return { known:true, key:key || null, towns:rows, ids, reason:'' };
  }
  function ruralCandidateRowsForTown(townId, liveTowns, relations, farmById) {
    const live = tradeTownRes(townId);
    if (!live || !(live.cap > 0) || live.tradeCap == null) return [];
    const island = ruralSameIslandTowns(townId, liveTowns);
    if (!island.known) return [];
    const beneficiary = resolveIslandResourceBeneficiary(island.key, island.ids);
    if (!beneficiary.known || String(beneficiary.townId) !== String(townId)) return [];
    const xy = ruralTownIslandXY(townId);
    if (!xy) return [];
    const now = gameNow();
    const candidates = [];
    for (const resource of GB_RES_KEYS) {
      if (live[resource] == null || live[resource] / live.cap < tradeOverflowPct()) continue;
      for (const rel of relations || []) {
        const a = rel.attributes || rel || {};
        const farm = farmById[String(a.farm_town_id)];
        const f = farm && (farm.attributes || farm) || {};
        if (gbNum(a.relation_status) !== 1 || !farm || String(f.island_x) !== String(xy.x) || String(f.island_y) !== String(xy.y)) continue;
        const cooldown = ruralTradeCooldownState(rel);
        if (!cooldown.known) {
          gbLogT('rural-cooldown-unreadable-' + String(a.farm_town_id), 180000, `rural-trade: village ${a.farm_town_id} cooldown unreadable`);
          continue;
        }
        if (!cooldown.ready) continue;
        const offer = ruralOfferData(rel, farm);
        if (offer.give !== resource || !offer.receive || offer.receive === resource || offer.ratio == null || offer.ratio < 1) continue;
        if (offer.limit == null) {
          gbLogT('rural-limit-unreadable-' + String(a.farm_town_id), 180000, `rural-trade: village ${a.farm_town_id} trade limit unreadable`);
          continue;
        }
        if (!(offer.limit > 0) || !(offer.returnedMultiplier > 0)) continue;
        if (live[offer.receive] == null) continue;
        const returnedFill = live[offer.receive] / live.cap;
        if (returnedFill > tradeReceiverPct()) continue;
        const headroom = Math.max(0, live.cap - live[offer.receive]);
        const amount = Math.floor(Math.min(live.cap * tradeTransferPct(), live[resource], live.tradeCap, offer.limit, headroom / offer.returnedMultiplier));
        if (!(amount > 0)) continue;
        candidates.push({
          village:String(a.farm_town_id), relId:String(a.id ?? rel.id), farmId:String(a.farm_town_id), townId:String(townId),
          amount, give:resource, receive:offer.receive, ratio:offer.ratio, returnedFill, returnedMultiplier:offer.returnedMultiplier,
          islandKey:island.key, cooldownSource:cooldown.source, limitSource:offer.source && offer.source.limit,
        });
      }
    }
    return candidates;
  }
  function ruralExecutableOverflowCandidates(towns) {
    const relations = ruralRelModels(), farms = ruralFarmModels(), farmById = Object.create(null);
    farms.forEach(f => { const a=f.attributes||{}; if (a.id != null) farmById[String(a.id)] = f; });
    // The passed set limits which towns may donate inter-city overflow, but AUTO
    // island-beneficiary resolution must see the full own-island town set. This
    // keeps the coordinator and rural executor on exactly the same resolver input.
    const eligible = new Set((towns || []).map(t => String(t.id)));
    const liveTowns = tradeListTowns().map(t => tradeTownRes(t.id)).filter(Boolean);
    const out = [];
    for (const town of liveTowns) {
      if (!eligible.has(String(town.id))) continue;
      const chosen = ruralTradeDecision(ruralCandidateRowsForTown(town.id, liveTowns, relations, farmById));
      if (chosen) out.push(chosen);
    }
    return out;
  }
  function ruralExecutableOverflowPairSet(towns) {
    const relations = ruralRelModels(), farms = ruralFarmModels(), farmById = Object.create(null);
    farms.forEach(f => { const a=f.attributes||{}; if (a.id != null) farmById[String(a.id)] = f; });
    const eligible = new Set((towns || []).map(t => String(t.id)));
    const liveTowns = tradeListTowns().map(t => tradeTownRes(t.id)).filter(Boolean);
    const out = new Set();
    for (const town of liveTowns) {
      if (!eligible.has(String(town.id))) continue;
      for (const c of ruralCandidateRowsForTown(town.id, liveTowns, relations, farmById)) {
        if (c && c.townId != null && GB_RES_KEYS.includes(c.give)) out.add(String(c.townId) + '|' + String(c.give));
      }
    }
    return out;
  }
  function ruralValidateJob(j) {
    const rel = ruralRelModels().find(r => String(r.id ?? (r.attributes || {}).id) === String(j.relId));
    const farm = ruralFarmModels().find(f => String(f.id ?? (f.attributes || {}).id) === String(j.farmId));
    const town = tradeTownRes(j.townId);
    if (!rel || !farm || !town) { tradeDiagnosticPut(j.townId, j.give, { rural:null, action:'none', reason:'rural-state-unreadable' }); return { ok:false, why:'rural-state-unreadable' }; }
    const a = rel.attributes || {}, f = farm.attributes || farm;
    if (gbNum(a.relation_status) !== 1) return { ok:false, why:'rural-state-changed' };
    const allTowns = tradeListTowns().map(t => tradeTownRes(t.id)).filter(Boolean);
    const island = ruralSameIslandTowns(j.townId, allTowns);
    if (!island.known) return { ok:false, why:island.reason || 'island-unreadable' };
    const beneficiary = resolveIslandResourceBeneficiary(island.key, island.ids);
    if (!beneficiary.known || String(beneficiary.townId) !== String(j.townId)) return { ok:false, why:'beneficiary-invalid' };
    const xy = ruralTownIslandXY(j.townId);
    if (!xy || String(f.island_x) !== String(xy.x) || String(f.island_y) !== String(xy.y)) return { ok:false, why:'rural-island-changed' };
    const offer = ruralOfferData(rel, farm);
    if (offer.give !== j.give || offer.receive !== j.receive) return { ok:false, why:'rural-offer-changed' };
    if (offer.ratio == null || offer.ratio < 1) return { ok:false, why:offer.ratio != null ? 'rural-ratio-below-1' : 'rural-ratio-unreadable' };
    if (offer.limit == null) return { ok:false, why:'rural-limit-unreadable' };
    if (!(offer.limit > 0) || !(offer.returnedMultiplier > 0)) return { ok:false, why:'rural-capacity-zero' };
    const cooldown = ruralTradeCooldownState(rel);
    if (!cooldown.known) return { ok:false, why:'rural-cooldown-unreadable' };
    if (!cooldown.ready) return { ok:false, why:'rural-cooldown' };
    if (town[j.give] == null || town[j.receive] == null || !(town.cap > 0)) return { ok:false, why:'live-state-unreadable' };
    if (town[j.give] / town.cap < tradeOverflowPct() || town[j.receive] / town.cap > tradeReceiverPct()) return { ok:false, why:'live-state-changed' };
    if (town.tradeCap == null || !(town.tradeCap > 0)) return { ok:false, why:'rural-trade-capacity-unreadable' };
    const headroom = Math.max(0, town.cap - town[j.receive]);
    const amount = Math.floor(Math.min(town.cap * tradeTransferPct(), town[j.give], town.tradeCap, offer.limit, headroom / offer.returnedMultiplier));
    if (!(amount > 0)) return { ok:false, why:'rural-headroom-zero' };
    j.amount = amount; j.ratio = offer.ratio; j.returnedMultiplier = offer.returnedMultiplier; j.islandKey = island.key;
    tradeDiagnosticPut(j.townId, j.give, { rural:{ give:j.give, receive:j.receive, ratio:j.ratio, limit:offer.limit, executable:amount }, finalValidation:'ok', action:'rural', reason:'ready-rural' });
    return { ok:true, cooldown, offer };
  }
  function ruralReconcileTrade(j, before, onDone) {
    const giveBefore = before ? gbNum(before[j.give]) : null;
    const receiveBefore = before ? gbNum(before[j.receive]) : null;
    const jobAmt = gbNum(j.amount);
    if (giveBefore == null || receiveBefore == null || jobAmt == null || !(jobAmt > 0)) return onDone(false, 'rural-reconcile-pre-unreadable');
    let attempt = 0;
    const check = () => {
      const cur = tradeTownRes(j.townId);
      let resourcesProve = false;
      const curGive = cur ? gbNum(cur[j.give]) : null;
      const curReceive = cur ? gbNum(cur[j.receive]) : null;
      if (curGive != null && curReceive != null) {
        const giveDelta = giveBefore - curGive;
        const receiveDelta = curReceive - receiveBefore;
        resourcesProve = giveDelta >= jobAmt && receiveDelta > 0;
      }
      let cooldownProves = false;
      try {
        const rel = ruralRelModels().find(r => String(r.id ?? (r.attributes || {}).id) === String(j.relId));
        const cd = rel ? ruralTradeCooldownState(rel) : { known:false };
        cooldownProves = !!(cd.known && cd.ready === false);
      } catch (_) {}
      // Require the source deduction plus either the corresponding received-resource
      // increase or the relation entering its authoritative post-trade cooldown.
      const sourceDeducted = curGive != null && (giveBefore - curGive >= jobAmt);
      if (resourcesProve || (sourceDeducted && cooldownProves)) return onDone(true, resourcesProve ? 'resources-updated' : 'source-and-cooldown-updated');
      if (++attempt >= 7) return onDone(false, 'rural-reconcile-timeout');
      gbTimeout(check, 200 + attempt * 250);
    };
    gbTimeout(check, 150);
  }
  let ruralCoordinatorRetryTimer = 0;
  const ruralTradeActivePairs = new Set();
  function ruralCoordinatorScheduleRetry() {
    if (ruralCoordinatorRetryTimer) return;
    ruralCoordinatorRetryTimer = gbTimeout(() => {
      ruralCoordinatorRetryTimer = 0;
      try { tradeScan('rural-lock-retry'); } catch (_) {}
    }, 1500);
  }
  function ruralTradeScan(reason, onSettled) {
    const settle = (info) => { try { if (onSettled) onSettled(info || {}); } catch (_) {} };
    if (!hostEnabled() || !state.autoRuralTrade || captchaPaused('ruraltrade') || automationPaused({})) {
      const info = {ran:false, started:false, reason:'disabled-or-paused'};
      settle(info); return info;
    }
    if (gbLocked('rural-trade')) {
      const info = {ran:false, started:false, reason:'locked', activePairs:[...ruralTradeActivePairs]};
      settle(info); return info;
    }
    const relations = ruralRelModels();
    const farms = ruralFarmModels();
    const farmById = Object.create(null);
    farms.forEach(f => { const a = f.attributes || {}; if (a.id != null) farmById[String(a.id)] = f; });
    // "Ciudades para comercio automatico" applies to rural trade as well. The
    // beneficiary resolver still receives the full own-island set internally.
    const allLiveTowns = tradeListTowns();
    const enabledLiveTowns = tradeAutoTowns(allLiveTowns);
    const townIds = enabledLiveTowns.map(t => String(t.id));
    const jobs = [];
    for (const tid of townIds) {
      const chosen = ruralTradeDecision(ruralCandidateRowsForTown(tid, allLiveTowns, relations, farmById));
      if (chosen) jobs.push(chosen);
      if (jobs.length >= 6) break;
    }
    if (!jobs.length) {
      gbLogT('ruraltrade-idle', 180000, `rural-trade: idle (${scanReason(reason)})`);
      const info = {ran:true, started:false, jobs:0, done:0, reason:'no-executable-rural'};
      settle(info);
      if (String(reason || '').includes('trade-coordinator')) gbTimeout(() => { try { tradeScan('rural-fallback-empty', { skipRural:true, overflowOnly:true }); } catch (_) {} }, 0);
      return info;
    }
    const ruralTradeLock = gbLock('rural-trade', Math.max(180000, jobs.length * 30000));
    if (!ruralTradeLock) {
      const info = {ran:false, started:false, reason:'lock-race', activePairs:[...ruralTradeActivePairs]};
      settle(info); return info;
    }
    ruralTradeActivePairs.clear();
    jobs.forEach(j => ruralTradeActivePairs.add(String(j.townId) + '|' + String(j.give)));
    let i = 0, done = 0, validationFailed = 0, postFailed = 0, ambiguousPost = 0, reconcileFailed = 0;
    const finish = () => {
      gbUnlock('rural-trade', ruralTradeLock);
      ruralTradeActivePairs.clear();
      if (done) gbLog(`rural-trade: ${done}/${jobs.length} reconciled`);
      const info = { ran:true, started:true, jobs:jobs.length, done, validationFailed, postFailed, ambiguousPost, reconcileFailed };
      settle(info);
      if (reconcileFailed || ambiguousPost) return;
      if (done > 0) gbTimeout(() => { try { tradeScan('rural-reconciled'); } catch (_) {} }, 0);
      else if (String(reason || '').includes('trade-coordinator') && (validationFailed || postFailed)) {
        gbTimeout(() => { try { tradeScan('rural-fallback', { skipRural:true, overflowOnly:true }); } catch (_) {} }, 0);
      }
    };
    (function next() {
      if (i >= jobs.length) return finish();
      const j = jobs[i++];
      gbLockTouch('rural-trade', ruralTradeLock);
      // Share the same per-source transactional lock as city->city trade. Rural
      // and intercity may run independently for unrelated towns/resources, but two
      // posts from the same source cannot both validate the same merchant capacity.
      const townTradeLockName = `trade:${String(j.townId)}`;
      const townTradeToken = gbLock(townTradeLockName, 30000);
      if (!townTradeToken) { i--; return gbTimeout(next, 100); }
      const validation = ruralValidateJob(j);
      if (!validation.ok) {
        gbUnlock(townTradeLockName, townTradeToken);
        validationFailed++;
        gbLogT('ruraltrade-live-change', 60000, `rural-trade: ${validation.why}`);
        return gbTimeout(next, 100);
      }
      const before = tradeTownRes(j.townId);
      if (!before || before[j.give] == null) { gbUnlock(townTradeLockName, townTradeToken); validationFailed++; return gbTimeout(next, 100); }
      ruralTradePost(j.relId, j.farmId, j.amount, j.townId, (err) => {
        if (err === 'captcha' || err === 'captcha-pause') {
          gbUnlock(townTradeLockName, townTradeToken);
          gbUnlock('rural-trade', ruralTradeLock);
          ruralTradeActivePairs.clear();
          settle({ran:true, started:true, captcha:true, done});
          return;
        }
        if (err === 'pending' || err === 'timeout_unknown') {
          // Ambiguous outcome: never fall through to city->city. Try a rural-specific
          // reconciliation once more; if it still cannot be proven, leave the TX
          // unknown and skip intercity for this pair/cycle.
          return ruralReconcileTrade(j, before, (ok, why) => {
            gbUnlock(townTradeLockName, townTradeToken);
            if (ok) {
              done++;
              gbLog(`rural-trade: ambiguous ${err} reconciled for town ${j.townId} farm ${j.farmId}`);
            } else {
              ambiguousPost++;
              gbLogT('ruraltrade-ambiguous-' + j.farmId, 60000, `rural-trade: ${err} + ${why}; intercity blocked this cycle`);
            }
            gbTimeout(next, 250);
          });
        }
        if (err) {
          gbUnlock(townTradeLockName, townTradeToken);
          postFailed++; gbLogT('ruraltrade-post-' + j.farmId, 60000, `rural-trade: post failed ${err}`);
          return gbTimeout(next, 150);
        }
        ruralReconcileTrade(j, before, (ok, why) => {
          gbUnlock(townTradeLockName, townTradeToken);
          if (!ok) {
            reconcileFailed++;
            gbLogT('ruraltrade-reconcile-' + j.farmId, 60000, `rural-trade: ${why}; intercity skipped this cycle`);
          } else {
            done++;
            gbLog(`rural-trade: town ${j.townId} farm ${j.farmId} amt ${j.amount} (ratio ${j.ratio}) reconciled`);
          }
          gbTimeout(next, 250);
        });
      });
    })();
    return { ran:true, started:true, jobs:jobs.length, activePairs:[...ruralTradeActivePairs] };
  }
  const KP_UNLOCK_MIN = 100;
  function ruralKillpoints() {
    try {
      const uw = gameUw();
      const kp = uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('PlayerKillpoints');
      if (!kp) return null;
      for (const name of ['getAvailableKillpoints','getAvailablePoints','getSpendablePoints','getUnusedPoints']) {
        try {
          if (typeof kp[name] !== 'function') continue;
          const n = gbNum(kp[name]());
          if (n != null && n >= 0) return n;
        } catch (_) {}
      }
      const a = kp.attributes || kp;
      for (const key of ['available_killpoints','available_points','spendable_points','unused_points','available']) {
        if (!Object.prototype.hasOwnProperty.call(a, key)) continue;
        const n = gbNum(a[key]);
        if (n != null && n >= 0) return n;
      }
    } catch (_) {}
    return null;
  }
  function ruralLevelCostInfo(rel, farm, kind) {
    const rm = rel || null, fm = farm || null;
    const a = rm && (rm.attributes || rm) || {};
    const f = fm && (fm.attributes || fm) || {};
    const methodNames = kind === 'unlock'
      ? ['getUnlockCost','getNextUnlockCost','getUnlockPrice','getCostToUnlock']
      : ['getUpgradeCost','getNextUpgradeCost','getExpansionCost','getNextExpansionCost','getCostToUpgrade'];
    const attrNames = kind === 'unlock'
      ? ['next_unlock_cost','unlock_cost','unlock_price','cost_to_unlock']
      : ['next_upgrade_cost','upgrade_cost','next_expansion_cost','expansion_cost','upgrade_price','cost_to_upgrade'];
    for (const obj of [rm, fm]) {
      for (const name of methodNames) {
        try {
          if (!obj || typeof obj[name] !== 'function') continue;
          let raw;
          try { raw = obj[name](); } catch (_) { raw = obj[name](a.farm_town_id); }
          const n = Number(raw && typeof raw === 'object' ? (raw.amount ?? raw.cost ?? raw.value) : raw);
          if (Number.isFinite(n) && n >= 0) return { known:true, cost:n, source:name + '()' };
        } catch (_) {}
      }
    }
    for (const [obj, prefix] of [[a,'relation'],[f,'farm']]) {
      for (const key of attrNames) {
        if (!obj || !Object.prototype.hasOwnProperty.call(obj, key)) continue;
        const raw = obj[key];
        const n = Number(raw && typeof raw === 'object' ? (raw.amount ?? raw.cost ?? raw.value) : raw);
        if (Number.isFinite(n) && n >= 0) return { known:true, cost:n, source:prefix + '.' + key };
      }
    }
    return { known:false, cost:null, source:'cost-unreadable' };
  }
  function ruralLevelTownForFarm(farm, townIds) {
    const f = farm && (farm.attributes || farm) || {};
    const matches = (townIds || []).filter(tid => {
      const p = ruralTownIslandXY(tid);
      return p && String(p.x) === String(f.island_x) && String(p.y) === String(f.island_y);
    }).map(String);
    if (!matches.length) return null;
    const key = resolveIslandIdByCoords(f.island_x, f.island_y);
    const r = resolveIslandResourceBeneficiary(key, matches);
    return r.known && r.townId ? r.townId : matches[0];
  }
  function ruralLevelScan(reason) {
    if (!hostEnabled() || !state.autoRuralLevel || captchaPaused('rurallevel')) return;
    if (automationPaused({}) || gbLocked('rural-level')) return;
    const available = ruralKillpoints();
    if (available == null) {
      gbLogT('rurallevel-kp-unreadable', 180000, 'rural-level: killpoints-unreadable; no POST');
      return;
    }
    const maxLvl = Math.min(6, Math.max(1, +state.ruralLevelMax || 3));
    const relations = ruralRelModels();
    const farms = ruralFarmModels();
    const farmById = Object.create(null);
    farms.forEach(f => { const a=f.attributes||{}; if (a.id != null) farmById[String(a.id)] = f; });
    let townIds = [];
    try { townIds = Object.keys((gameUw().ITowns && gameUw().ITowns.towns) || {}); } catch (_) {}
    let job = null, sawUnreadableCost = false;

    // Unlock phase: Grepolis' current relation cost is authoritative. Execute at
    // most one action per scan because the next cost may change after a POST.
    // Prefer unlocks while KP remains above KP_UNLOCK_MIN so locked villages drain first.
    let lockedWaiting = 0;
    for (const rel of relations) {
      const a = rel.attributes || {};
      if (gbNum(a.relation_status) !== 0) continue;
      lockedWaiting++;
      if (available <= KP_UNLOCK_MIN) continue;
      const farm = farmById[String(a.farm_town_id)];
      if (!farm) continue;
      const tid = ruralLevelTownForFarm(farm, townIds);
      if (!tid) continue;
      const cost = ruralLevelCostInfo(rel, farm, 'unlock');
      if (!cost.known) { sawUnreadableCost = true; gbLogT('rurallevel-unlock-cost-' + String(a.farm_town_id), 180000, `rural-level: unlock cost-unreadable village=${a.farm_town_id}`); continue; }
      if (available < cost.cost) continue;
      const unlockStage = gbNum(a.expansion_stage);
      if (unlockStage == null) continue;
      job = { kind:'unlock', relId:String(a.id ?? rel.id), farmId:String(a.farm_town_id), townId:String(tid), cost:cost.cost, costSource:cost.source, stage:unlockStage };
      break;
    }
    if (!job && lockedWaiting && available <= KP_UNLOCK_MIN) {
      gbLogT('rurallevel-kp-low', 180000, `rural-level: ${lockedWaiting} locked village(s) waiting; KP ${available} \u2264 ${KP_UNLOCK_MIN} \u2014 upgrades only after unlock phase drains`);
    }

    if (!job) {
      for (const rel of relations) {
        const a = rel.attributes || {};
        if (gbNum(a.relation_status) !== 1 || a.expansion_at) continue;
        const stage = gbNum(a.expansion_stage);
        if (stage == null || stage >= maxLvl) continue;
        const farm = farmById[String(a.farm_town_id)];
        if (!farm) continue;
        const tid = ruralLevelTownForFarm(farm, townIds);
        if (!tid) continue;
        const cost = ruralLevelCostInfo(rel, farm, 'upgrade');
        if (!cost.known) { sawUnreadableCost = true; gbLogT('rurallevel-upgrade-cost-' + String(a.farm_town_id), 180000, `rural-level: upgrade cost-unreadable village=${a.farm_town_id} stage=${stage}`); continue; }
        if (available < cost.cost) continue;
        job = { kind:'upgrade', relId:String(a.id ?? rel.id), farmId:String(a.farm_town_id), townId:String(tid), cost:cost.cost, costSource:cost.source, stage };
        break;
      }
    }
    if (!job) {
      gbLogT('rurallevel-idle', 180000, `rural-level: idle (${scanReason(reason)})${sawUnreadableCost ? ' · cost-unreadable candidates skipped' : ''}`);
      return;
    }

    const lockToken = gbLock('rural-level', 180000);
    if (!lockToken) return;
    const relNow = ruralRelModels().find(r => String((r.attributes || {}).id ?? r.id) === String(job.relId));
    const farmNow = ruralFarmModels().find(f => String((f.attributes || {}).id ?? f.id) === String(job.farmId));
    const kpNow = ruralKillpoints();
    if (!relNow || !farmNow || kpNow == null) {
      gbUnlock('rural-level', lockToken);
      gbLogT('rurallevel-live-unreadable', 60000, 'rural-level: final state unreadable; no POST');
      return;
    }
    const aNow = relNow.attributes || {};
    const relStatusNow = gbNum(aNow.relation_status);
    const stageNow = gbNum(aNow.expansion_stage);
    if ((job.kind === 'unlock' && relStatusNow !== 0) || (job.kind === 'upgrade' && (relStatusNow !== 1 || aNow.expansion_at || stageNow !== job.stage))) {
      gbUnlock('rural-level', lockToken); return;
    }
    const costNow = ruralLevelCostInfo(relNow, farmNow, job.kind);
    if (!costNow.known) {
      gbUnlock('rural-level', lockToken);
      gbLogT('rurallevel-cost-final', 60000, `rural-level: ${job.kind} cost-unreadable at final check; no POST`);
      return;
    }
    if (kpNow < costNow.cost) {
      gbUnlock('rural-level', lockToken);
      gbLogT('rurallevel-kp-short', 60000, `rural-level: ${kpNow}/${costNow.cost} killpoints; waiting`);
      return;
    }
    job.cost = costNow.cost; job.costSource = costNow.source;
    gbLockTouch('rural-level', lockToken);
    const fire = job.kind === 'unlock' ? ruralUnlock : ruralUpgrade;
    fire(job.relId, job.farmId, job.townId, (err) => {
      gbUnlock('rural-level', lockToken);
      if (err === 'captcha' || err === 'captcha-pause') return;
      if (!err) gbLog(`rural-level: ${job.kind} village ${job.farmId} cost=${job.cost} source=${job.costSource}`);
      else gbLogT('rurallevel-err-' + job.farmId, 60000, `rural-level ${job.kind} error: ${err}`);
    });
  }
