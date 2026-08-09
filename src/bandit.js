  function banditIdle(ms, cap) { banditIdleUntil = Date.now() + Math.min(ms, cap || 30000); }
  const BANDIT_OFFENSE_IDS = /^(slinger|hoplite|rider|chariot|catapult|minotaur|manticore|cyclops?|zyklop|harpy|erinys|giant|godsent)$/i;
  function banditIsOffenseUnit(uw, id) {
    // Hoplites are balanced troops but are valid attackers. Keep this exception
    // narrow instead of sending every unit marked function_both by the game.
    if (/^(godsent|hoplite)$/i.test(id)) return true;
    try {
      const def = uw.GameData && uw.GameData.units && uw.GameData.units[id];
      const f = def && def.unit_function;
      if (f === 'function_off' || f === 'off') return true;
      if (f === 'function_def' || f === 'def') return false;
      if (f === 'function_both' || f === 'both' || f === 'function_none' || f === 'none') return false;
    } catch (_) {}
    return BANDIT_OFFENSE_IDS.test(id);
  }
  function banditAttackUnits(uw, rawUnits) {
    const units = Object.assign({}, rawUnits || {});
    delete units.militia;
    Object.keys(units).forEach(u => {
      try {
        const def = uw.GameData && uw.GameData.units && uw.GameData.units[u];
        if (!def || def.is_naval || def.naval) delete units[u];
      } catch (_) { delete units[u]; }
      if (units[u] != null && !banditIsOffenseUnit(uw, u)) delete units[u];
      if (!units[u]) delete units[u];
    });
    return units;
  }
  function movementsUnitsModels(uw) {
    try {
      const col = uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('MovementsUnits');
      if (col && col.models) return col.models;
    } catch (_) {}
    try {
      const cols = uw.MM.getCollections && uw.MM.getCollections().MovementsUnits;
      if (cols && cols[0] && cols[0].models) return cols[0].models;
    } catch (_) {}
    try {
      const map = uw.MM.getModels && uw.MM.getModels().MovementsUnits;
      if (map) return Object.keys(map).map(k => map[k]);
    } catch (_) {}
    return [];
  }
  const BANDIT_TX_EVIDENCE_MAX_MS = 10 * 60 * 1000;
  function banditFlag(v) {
    if (v === true || v === 1) return true;
    const s = String(v == null ? '' : v).toLowerCase();
    return s === '1' || s === 'true';
  }
  function banditMovementTown(mov, a, outgoing) {
    const keys = outgoing
      ? ['origin_town_id','originTownId','home_town_id','homeTownId','town_id','townId','source_town_id','sourceTownId']
      : ['destination_town_id','destinationTownId','target_town_id','targetTownId','home_town_id','homeTownId','town_id','townId'];
    for (const k of keys) if (a[k] != null && a[k] !== '') return a[k];
    const methods = outgoing
      ? ['getOriginTownId','getHomeTownId','getTownId','getSourceTownId']
      : ['getDestinationTownId','getTargetTownId','getHomeTownId','getTownId'];
    for (const name of methods) {
      try {
        if (!mov || typeof mov[name] !== 'function') continue;
        const raw = mov[name]();
        const value = raw && typeof raw === 'object' ? (raw.id ?? (typeof raw.getId === 'function' ? raw.getId() : null)) : raw;
        if (value != null && value !== '') return value;
      } catch (_) {}
    }
    return null;
  }
  function banditMovementId(mov, a) {
    const attrId = a.command_id ?? a.movement_id ?? a.id ?? mov.id;
    if (attrId != null && attrId !== '') return attrId;
    for (const name of ['getCommandId','getMovementId','getId']) {
      try { if (mov && typeof mov[name] === 'function') { const value=mov[name](); if(value!=null&&value!=='')return value; } } catch (_) {}
    }
    return null;
  }
  function banditMovementEvidence(uw, townId) {
    const models = [], refs = new Set();
    let known = false;
    const push = mov => {
      if (!mov || typeof mov !== 'object') return;
      if (refs.has(mov)) return;
      refs.add(mov);
      models.push(mov);
    };
    const addCollection = col => {
      if (!col) return;
      if (Array.isArray(col)) { known = true; col.forEach(push); return; }
      if (Array.isArray(col.models)) { known = true; col.models.forEach(push); }
    };
    try { addCollection(uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('MovementsUnits')); } catch (_) {}
    try {
      const cols = uw.MM && uw.MM.getCollections && uw.MM.getCollections().MovementsUnits;
      (Array.isArray(cols) ? cols : (cols ? [cols] : [])).forEach(addCollection);
    } catch (_) {}
    try {
      const map = uw.MM && uw.MM.getModels && uw.MM.getModels().MovementsUnits;
      if (Array.isArray(map)) addCollection(map);
      else if (map && typeof map === 'object') { known = true; Object.keys(map).forEach(k => push(map[k])); }
    } catch (_) {}
    const facts = new Map();
    models.forEach((mov, index) => {
      const a = (mov && mov.attributes) || {};
      const outgoing = banditFlag(a.destination_is_attack_spot) || banditFlag(a.destinationIsAttackSpot);
      const returning = banditFlag(a.origin_is_attack_spot) || banditFlag(a.originIsAttackSpot);
      const rawId = banditMovementId(mov, a);
      const key = rawId != null && rawId !== '' ? `id:${rawId}` : `ref:${index}`;
      const fact = facts.get(key) || { outgoing:false, returning:false, towns:new Set() };
      fact.outgoing = fact.outgoing || outgoing;
      fact.returning = fact.returning || returning;
      if (outgoing || returning) {
        const movementTown = banditMovementTown(mov, a, outgoing);
        if (movementTown != null) fact.towns.add(String(movementTown));
      }
      facts.set(key, fact);
    });
    let count = 0, townCount = 0, townKnown = false, unscopedCount = 0;
    for (const fact of facts.values()) {
      if (!fact.outgoing && !fact.returning) continue;
      count++;
      if (fact.towns.size) {
        townKnown = true;
        if (townId == null || fact.towns.has(String(townId))) townCount++;
      } else unscopedCount++;
    }
    return { known, count, townKnown, townCount, unscopedCount };
  }
  function banditMovementReconcileResult(tx, evidence) {
    if (!evidence || !evidence.known) return 'unknown';
    const at = +(tx && (tx.sentAt || tx.createdAt || tx.updatedAt)) || 0;
    if (!at || Date.now() - at > BANDIT_TX_EVIDENCE_MAX_MS) return 'unknown';
    const s = (tx && tx.snapshot) || {};
    const scopedTx = tx && tx.meta && tx.meta.townId != null && Object.prototype.hasOwnProperty.call(s,'beforeTownMovementCount');
    const unscoped = evidence.unscopedCount != null ? +evidence.unscopedCount || 0 : (!evidence.townKnown ? +evidence.count || 0 : 0);
    if (scopedTx && unscoped > 0) return 'unknown';
    const useTown = !!evidence.townKnown;
    const current = useTown ? +evidence.townCount || 0 : +evidence.count || 0;
    let before = useTown ? s.beforeTownMovementCount : s.beforeMovementCount;
    // A globally empty readable collection also proves the per-town baseline was zero.
    if (before == null && useTown && +s.beforeMovementCount === 0) before = 0;
    if (before != null && Number.isFinite(+before)) return current > +before ? 'applied' : 'unchanged';
    // Conservative compatibility for an in-flight transaction created by an older
    // version, which did not persist a movement baseline.
    return current > 0 ? 'applied' : 'unknown';
  }
  function banditCommitUnknownFromMovement(townId, evidence) {
    if (!evidence || !evidence.known || !(evidence.count > 0)) return 0;
    let committed = 0;
    for (const tx of Object.values(state.txState || {})) {
      if (!tx || tx.feature !== 'bandit' || tx.state !== 'unknown' || !/\/attack$/i.test(String(tx.endpoint || ''))) continue;
      if (townId != null && tx.meta && tx.meta.townId != null && String(tx.meta.townId) !== String(townId)) continue;
      if (banditMovementReconcileResult(tx, evidence) !== 'applied') continue;
      tx.state = 'committed'; tx.updatedAt = Date.now(); tx.detail = 'movement model confirmed';
      plannerCommit(tx); committed++;
      jrnPush({ f:'bandit', a:String(tx.endpoint || '').slice(0,48), k:String(tx.intent || '-').slice(0,120) }, 'ok', tx.detail, tx.id);
      markModuleHealth('bandit', 'ok'); circuitSuccess('bandit');
    }
    if (committed) { banditAttackSentAt = Date.now(); banditIdle(60000); txSave(); }
    return committed;
  }
  function banditRecentlyCommitted(townId, withinMs) {
    const cut = Date.now() - Math.max(1000, +withinMs || 60000);
    return Object.values(state.txState || {}).some(tx => tx && tx.feature === 'bandit' && tx.state === 'committed'
      && /\/attack$/i.test(String(tx.endpoint || '')) && (+tx.updatedAt || 0) >= cut
      && (townId == null || !tx.meta || tx.meta.townId == null || String(tx.meta.townId) === String(townId)));
  }
  function banditWrongIsland(uw, m) {
    try {
      if (m.hasReward && m.hasReward()) return false;
      if (typeof m.getIslandId !== 'function') return false;
      const campIsland = m.getIslandId();
      if (campIsland == null) return false;
      let townIsland = null;
      try {
        const towns = uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('Town');
        const cur = towns && towns.getCurrentTown && towns.getCurrentTown();
        if (cur && cur.getIslandId) townIsland = cur.getIslandId();
      } catch (_) {}
      if (townIsland == null) {
        try {
          const t = uw.ITowns && uw.ITowns.towns && uw.ITowns.towns[uw.Game.townId];
          if (t && t.getIslandId) townIsland = t.getIslandId();
        } catch (_) {}
      }
      if (townIsland == null) return false;
      return townIsland !== campIsland;
    } catch (_) { return false; }
  }
  function banditViaGame() {
    if (!hostEnabled() || captchaPaused('bandit')) return true;
    const uw = gameUw();
    let m = null;
    try { m = uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('PlayerAttackSpot'); } catch (_) {}
    if (!m || !(uw.gpAjax && uw.gpAjax.ajaxPost)) return false;
    const playerId = uw.Game && uw.Game.player_id;
    if (playerId == null) { gbLogT('bandit-nopid', 60000, 'bandit: Game.player_id missing'); return true; }
    const post = (action_name, args, onDone) => bridgePost('bandit', {
      model_url: `PlayerAttackSpot/${playerId}`, action_name, arguments: args,
      town_id: uw.Game && uw.Game.townId,
    }, onDone);
    try {
      if (typeof m.getLevel === 'function' && m.getLevel() == null) { gbLogT('bandit-none', 300000, 'bandit: no camp on this world'); banditIdle(300000, 300000); return true; }
      const townId = uw.Game && uw.Game.townId;
      const movement = banditMovementEvidence(uw, townId);
      // Reconcile before reward/cooldown branches so a reloaded UNKNOWN write is
      // finalized while its outbound or return movement is still observable.
      const earlyReconciled = movement.known && movement.count > 0 ? banditCommitUnknownFromMovement(townId, movement) : 0;
      if (m.hasReward && m.hasReward()) {
        if (gbLocked('bandit-reward')) {
          gbLogT('bandit-reward-inflight', 10000, 'bandit: reward claim in flight');
          return true;
        }
        const r = (m.getReward && m.getReward()) || {};
        const pid = r.power_id || '';
        const action = (pid.includes('instant') && !pid.includes('favor')) ? 'useReward'
          : (r.stashable ? 'stashReward' : 'useReward');
        const rewardLock = gbLock('bandit-reward');
        if (!rewardLock) return true;
        banditIdleUntil = 0;
        gbLog('bandit: reward claim posted via', action, pid || '(no power_id)');
        post(action, {}, (err) => {
          gbUnlock('bandit-reward', rewardLock);
          if (err) { gbLog('bandit: reward claim failed', err); return; }
          gbLog('bandit: reward claimed via', action, pid || '(no power_id)');
          flash('bandit: reward claimed');
          logBandit('collected');
        });
        return true;
      }
      const cd = m.getCooldownDuration ? m.getCooldownDuration() : 0;
      if (cd > 0) {
        gbLogT('bandit-cd', 60000, `bandit: cooldown ${Math.floor(cd / 60)}m${cd % 60}s left`);
        banditIdle(cd * 1000);
        return true;
      }
      if (!movement.known) {
        gbLogT('bandit-movement-loading', 60000, 'bandit: waiting for movement collection');
        banditIdle(15000);
        return true;
      }
      if (movement.count > 0) {
        const reconciled = earlyReconciled || banditCommitUnknownFromMovement(townId, movement);
        gbLogT('bandit-enroute', 60000, `bandit: attack already en route${reconciled ? ' (transaction reconciled)' : ''}`);
        banditIdle(15000);
        return true;
      }
      if (Date.now() - banditAttackSentAt < 8000) {
        gbLogT('bandit-sent-guard', 10000, 'bandit: waiting for movement model after attack');
        banditIdle(8000);
        return true;
      }
      if (banditRecentlyCommitted(townId, 60000)) {
        gbLogT('bandit-committed-guard', 30000, 'bandit: recent attack confirmed; waiting for game state refresh');
        banditIdle(30000);
        return true;
      }
      if (townId != null && townWarehouseBlocks(townId)) {
        gbLogT('bandit-wh-full', 60000, `bandit: skip attack (warehouse full, mode=${state.farmFullMode})`);
        banditIdle(30000);
        return true;
      }
      if (banditWrongIsland(uw, m)) {
        gbLogT('bandit-island', 60000, 'bandit: camp on other island — switch town or skip');
        banditIdle(30000);
        return true;
      }
      const t = uw.ITowns && uw.ITowns.towns && uw.ITowns.towns[uw.Game.townId];
      if (!t || !t.units) { gbLogT('bandit-notown', 60000, 'bandit: current town units unavailable'); return true; }
      const units = banditAttackUnits(uw, t.units());
      if (!Object.keys(units).length) { gbLogT('bandit-nounits', 60000, 'bandit: no offense units in current town'); banditIdle(30000); return true; }
      post('attack', units, (err) => {
        if (err) {
          if (err === 'timeout_unknown' || err === 'pending') {
            banditAttackSentAt = Date.now();
            banditIdle(60000);
            gbLog('bandit: attack outcome unknown; transaction reconciliation required before retry');
          } else {
            banditAttackSentAt = 0;
            banditIdleUntil = 0;
            gbLog('bandit: attack failed', err);
          }
          return;
        }
        banditAttackSentAt = Date.now();
        gbLog('bandit: ATTACK confirmed', JSON.stringify(units));
        flash('bandit: attack sent');
        logBandit('attack');
      });
      banditAttackSentAt = Date.now();
      banditIdle(30000);
      gbLog('bandit: ATTACK posted (await confirm)', JSON.stringify(units));
    } catch (e) { gbLog('bandit game-path fail', String(e)); }
    return true;
  }
  function banditScan() {
    if (txPrune()) txSave();
    if (!state.autoBandit) return;
    if (!hostEnabled() || automationPaused({}) || captchaPaused('bandit')) {
      banditScheduleNext();
      return;
    }
    if (Date.now() < banditIdleUntil) {
      banditScheduleNext();
      return;
    }
    try {
      if (banditViaGame()) return;
      // Safety: automatic DOM mutation is not a reliable transaction boundary. If the canonical
      // model/bridge path is unavailable, fail closed instead of filling inputs/clicking buttons.
      gbLogT('bandit-dom-disabled', 120000, 'bandit: game bridge unavailable — DOM write fallback disabled (read-only fail closed)');
      banditIdle(30000);
      return;
    } finally {
      banditScheduleNext();
    }
  }
  let banditLoopTimer = null;
  function banditClearLoop() {
    if (banditLoopTimer) {
      try { gbClearTimeout(banditLoopTimer); } catch (_) {}
      banditLoopTimer = null;
    }
  }
  function banditScheduleNext() {
    if (banditLoopTimer) return;
    if (!state.autoBandit) return;
    const now = Date.now();
    let delay = 1500;
    if (banditIdleUntil > now) delay = Math.min(30000, Math.max(1500, banditIdleUntil - now));
    banditLoopTimer = gbTimeout(() => {
      banditLoopTimer = null;
      banditScan();
    }, delay);
  }
  function scheduleBanditScan() {
    if (banditTimer) return;
    banditTimer = gbTimeout(() => {
      banditTimer = null;
      banditClearLoop();
      banditScan();
    }, 600);
  }
  function logBandit(ev) {
    state.banditLog.push({ ts: Date.now(), ev });
    if (state.banditLog.length > 50) state.banditLog = state.banditLog.slice(-50);
    save(STORE.BANDIT_LOG, state.banditLog);
  }
  banditScheduleNext();
  gbInterval(autoCollectResources, 5000);
  if (state.autoCollect && state.collectAll) collectAllBackground();

  const IB_CHECK_MS = 10000;
  const IB_FREE_ACTIONS = new Set(['buyInstant']);
  const IB_FREE_SERVER_MARGIN_SEC = 10;
