  const TX_TERMINAL_TTL = 30 * 60 * 1000;
  const TX_INSTANT_TOMBSTONE_TTL = 24 * 60 * 60 * 1000;
  const TX_PRE_SEND_STALE_MS = 60 * 1000;
  const TX_UNKNOWN_RECHECK_MS = 30 * 1000;
  const TX_UNKNOWN_MAX_MS = 10 * 60 * 1000;
  const TX_MANUAL_REVIEW_TTL_MS = 30 * 60 * 1000;
  const TX_PERSISTENT_MANUAL_REVIEW_FEATURES = new Set([
    'attack', 'support', 'spy', 'cancel',
    // Already classified as high-impact by safeModeBlock().
    'favor', 'wonder', 'rurallevel', 'merchant', 'spell', 'airaw',
    // A duplicate dodge can send another troop movement.
    'dodge',
  ]);
  let txSeq = 0;
  if (!state.txState || typeof state.txState !== 'object' || Array.isArray(state.txState)) state.txState = {};
  function txManualReviewPermanent(tx) {
    if (!tx) return false;
    const feature = String(tx.feature || '');
    if (TX_PERSISTENT_MANUAL_REVIEW_FEATURES.has(feature)) return true;
    // Olympic culture spends premium currency; other celebrations retain TTL.
    return feature === 'culture' && /olympic/i.test(String((tx.snapshot && tx.snapshot.type) || tx.endpoint || ''));
  }
  function txLoadNormalize(reason) {
    const now = Date.now();
    let changed = false;
    const justUnknown = new Set();
    for (const key of Object.keys(state.txState)) {
      const t = state.txState[key];
      if (!t || typeof t !== 'object') { delete state.txState[key]; changed = true; continue; }
      // planned/precheck are pre-send states. rawSend is only invoked after the
      // state has synchronously been persisted as sending, so they are safe to
      // abort after a reload/leader handover.
      if (t.state === 'planned' || t.state === 'precheck') {
        t.state = 'aborted';
        t.detail = `stale pre-send transaction cleared (${reason || 'normalize'})`;
        t.updatedAt = now;
        plannerRelease(t, 'stale-pre-send');
        changed = true;
        continue;
      }
      if (t.state === 'sending' || t.state === 'confirming' || t.state === 'reconciling') {
        t.state = 'unknown';
        t.unknownAt = now;
        t.detail = `reloaded while in-flight (${reason || 'normalize'})`;
        t.updatedAt = now;
        // Unknown is a diagnostic/dedupe state, not a future resource reserve.
        plannerRelease(t, 'unknown-after-reload');
        justUnknown.add(key);
        changed = true;
      }
    }
    for (const key of Object.keys(state.txState)) {
      const t = state.txState[key];
      if (!t) continue;
      const terminal = /^(committed|failed|aborted|dryrun)$/.test(t.state || '');
      const terminalTtl=t.state==='committed'&&t.snapshot&&t.snapshot.kind==='instant'?TX_INSTANT_TOMBSTONE_TTL:TX_TERMINAL_TTL;
      if (terminal && now - (+t.updatedAt || +t.createdAt || 0) > terminalTtl) { delete state.txState[key]; changed = true; continue; }
      if (justUnknown.has(key)) continue;
      if (t.state === 'unknown' && now - (+t.unknownAt || +t.updatedAt || 0) > TX_UNKNOWN_MAX_MS) {
        t.state = 'manual-review';
        t.detail = 'unknown outcome expired; bounded manual-review tombstone';
        t.updatedAt = now;
        plannerRelease(t, 'manual-review');
        changed = true;
        continue;
      }
      // Only ambiguous high-impact/non-idempotent features retain a permanent
      // per-intent tombstone. Low-risk reviews keep the bounded legacy policy.
      if (t.state === 'manual-review' && !txManualReviewPermanent(t) && now - (+t.updatedAt || +t.unknownAt || +t.createdAt || 0) > TX_MANUAL_REVIEW_TTL_MS) {
        t.state = 'failed';
        t.detail = 'manual-review tombstone expired; retry allowed';
        t.updatedAt = now;
        plannerRelease(t, 'manual-review-expired');
        changed = true;
      }
    }
    if (changed && gbTabLeader) save(STORE.TX_STATE, state.txState);
    return changed;
  }
  txLoadNormalize('boot');
  function txSave() {
    // Operational TX state is leader-owned. Followers may inspect it, but never
    // persist their stale in-memory snapshot over the active leader.
    if (!gbTabLeader) return false;
    return save(STORE.TX_STATE, state.txState);
  }
  function txRecentlyCommitted(intent, maxAgeMs) {
    const t = state.txState && state.txState[intent];
    return !!(t && t.state === 'committed' && Date.now() - (+t.updatedAt || +t.createdAt || 0) < Math.max(1000, +maxAgeMs || 60000));
  }
  function txPrune() {
    const now = Date.now();
    let changed = false;
    for (const key of Object.keys(state.txState)) {
      const t = state.txState[key];
      if (!t) { delete state.txState[key]; changed = true; continue; }
      if (/^(planned|precheck)$/.test(t.state || '') && now - (+t.updatedAt || +t.createdAt || 0) > TX_PRE_SEND_STALE_MS) {
        t.state='aborted';t.detail='stale pre-send transaction cleared';t.updatedAt=now;plannerRelease(t,'stale-pre-send');changed=true;continue;
      }
      if (t.state==='unknown' && now-(+t.unknownAt||+t.updatedAt||0)>TX_UNKNOWN_MAX_MS) {
        t.state='manual-review';t.detail='unknown outcome expired; bounded manual-review tombstone';t.updatedAt=now;plannerRelease(t,'manual-review');changed=true;continue;
      }
      if (t.state==='manual-review' && !txManualReviewPermanent(t) && now-(+t.updatedAt||+t.unknownAt||+t.createdAt||0)>TX_MANUAL_REVIEW_TTL_MS) {
        t.state='failed';t.detail='manual-review tombstone expired; retry allowed';t.updatedAt=now;plannerRelease(t,'manual-review-expired');changed=true;continue;
      }
      const terminalTtl=t.state==='committed'&&t.snapshot&&t.snapshot.kind==='instant'?TX_INSTANT_TOMBSTONE_TTL:TX_TERMINAL_TTL;
      if (/^(committed|failed|aborted|dryrun)$/.test(t.state || '') && now - (+t.updatedAt || +t.createdAt || 0) > terminalTtl) { delete state.txState[key]; changed = true; }
    }
    if (changed) txSave();
    return changed;
  }
  function txDispose() {
    const now = Date.now();
    for (const key of Object.keys(state.txState || {})) {
      const t = state.txState[key];
      if (!t) continue;
      if (t.owner === GB_INSTANCE_ID && /^(sending|confirming|reconciling)$/.test(t.state || '')) {
        t.state = 'unknown';
        t.unknownAt = now;
        t.updatedAt = now;
        t.detail = 'instance disposed while in-flight';
        plannerRelease(t, 'unknown-dispose');
      }
    }
    txSave();
  }
  function txClearUnknown() {
    for (const key of Object.keys(state.txState || {})) {
      if (state.txState[key] && /^(unknown|manual-review)$/.test(state.txState[key].state || '')) {
        try{if(state.txState[key].snapshot&&state.txState[key].snapshot.kind==='quest')questClearReviewForTx(state.txState[key])}catch(_){}
        state.txState[key].state = 'aborted';
        state.txState[key].updatedAt = Date.now();
        state.txState[key].detail = 'manually cleared';
        plannerRelease(state.txState[key], 'manual-clear');
      }
    }
    txSave();
  }
  function txClearOne(intent) {
    const t = state.txState && state.txState[intent];
    if (!t) return false;
    if (!/^(unknown|manual-review)$/.test(t.state || '')) return false;
    try{if(t.snapshot&&t.snapshot.kind==='quest')questClearReviewForTx(t)}catch(_){}
    t.state = 'aborted';
    t.updatedAt = Date.now();
    t.detail = 'manually cleared';
    plannerRelease(t, 'manual-clear');
    txSave();
    return true;
  }
  function txStableObj(obj) {
    const out = {};
    Object.keys(obj || {}).sort().forEach(k => {
      const v = obj[k];
      if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') out[k] = v;
    });
    return out;
  }
  function txUnitSignature(args) {
    const skip = new Set(['id', 'town_id', 'type', 'nl_init', 'order_id', 'farm_town_id', 'option', 'celebration_type', 'unit_id', 'amount', 'power_id', 'progressable_id']);
    const o = {};
    for (const k of Object.keys(args || {}).sort()) {
      if (skip.has(k)) continue;
      const n = +(args[k]);
      if (Number.isFinite(n) && n > 0) o[k] = n;
    }
    return JSON.stringify(o);
  }
  function txTownResourceSnap(townId) {
    const st = townResState(townId);
    let tradeCap = null;
    try {
      const t = gbTownModel(townId);
      if (t && t.getAvailableTradeCapacity) tradeCap = +t.getAvailableTradeCapacity();
    } catch (_) {}
    return st ? { wood: st.wood, stone: st.stone, iron: st.iron, cap: st.cap, tradeCap } : null;
  }
  function txUnitStatus(townId, unit) {
    const t = gbTownModel(townId);
    if (!t) return null;
    let have = null, queued = 0;
    try { const u=t.units&&t.units(),o=t.unitsOuter&&t.unitsOuter();if(u)have=(+u[unit]||0)+(o?(+o[unit]||0):0); } catch (_) {}
    try {
      const col = t.getUnitOrdersCollection && t.getUnitOrdersCollection();
      for (const m of ((col && col.models) || [])) {
        const a = m.attributes || {};
        const uid = a.unit_type || a.unit_id || a.type;
        if (String(uid) === String(unit)) queued += +(a.count != null ? a.count : (a.amount != null ? a.amount : a.units)) || 0;
      }
    } catch (_) {}
    return have == null ? null : { have, queued, total: have + queued };
  }
  function txResearchStatus(townId, tech) {
    try {
      const info = researchTownTechs(townId);
      if (!info) return null;

      if (!info.ordersKnown) return null;
      let queued = false;
      for (const o of info.orders || []) {
        const id = researchOrderTechId(o);
        if (String(id) === String(tech)) { queued = true; break; }
      }
      return { done: !!(info.techs && info.techs[tech]), queued };
    } catch (_) { return null; }
  }
  function txBuildStatus(townId, building) {
    try {
      const levels = abCurrentLevels(townId);
      const q = abQueueInfo(townId);
      if (!levels || !q) return null;
      return { projectedLevel: +(levels[building] || 0), queueLen: q.len };
    } catch (_) { return null; }
  }
  function txFarmStatus(farmId) {
    try {
      const f = (farmsFromGame() || []).find(x => String(x.vill_id) === String(farmId));
      if (!f) return null;
      const at = f.lootable_at == null ? null : +f.lootable_at;
      // The game omits lootable_at on a claimable village, so a bare timestamp
      // read is blind exactly when the village is farmable. farmIsLootable
      // carries the null-means-lootable convention for relation models.
      let lootableNow = null;
      if (f._rel) { try { lootableNow = !!farmIsLootable(f._rel, f._attrs || {}); } catch (_) {} }
      else if (at != null) lootableNow = gameNow() >= at;
      return { lootableAt: at, lootableNow };
    } catch (_) { return null; }
  }
  function txMovementCount(origin, dest, mission) {
    try {

      const models = mmModelsAll('MovementsUnits');

      if (!models.length && !mmCol('MovementsUnits')) return null;
      let n = 0;
      for (const m of models) {
        const a = m.attributes || {};
        const o = String(a.origin_town_id || a.home_town_id || a.town_id || '');
        const d = String(a.destination_town_id || a.target_town_id || a.target_id || '');

        const typ = gbMovementType(a);
        if (origin != null && o !== String(origin)) continue;
        if (dest != null && d !== String(dest)) continue;
        if (mission && typ && !typ.includes(String(mission).toLowerCase())) continue;
        n++;
      }
      return n;
    } catch (_) { return null; }
  }
  function txCommandStatus(commandId) {
    try {
      const id = String(commandId == null ? '' : commandId);
      if (!id) return null;
      const uw = gameUw();
      const models = [];
      const seen = new Set();
      const push = (m) => {
        if (!m) return;
        const a = m.attributes || {};
        const mid = (typeof m.getCommandId === 'function' && m.getCommandId()) || a.command_id || a.id || m.id;
        const key = String(mid == null ? '' : mid);
        if (!key || seen.has(key)) return;
        seen.add(key); models.push(m);
      };
      try { mmModelsAll('MovementsUnits').forEach(push); } catch (_) {}
      try {
        const col = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('MovementsUnits');
        if (col && col.models) col.models.forEach(push);
      } catch (_) {}
      try {
        const cols = uw.MM && uw.MM.getCollections && uw.MM.getCollections().MovementsUnits;
        (Array.isArray(cols) ? cols : (cols ? [cols] : [])).forEach(c => { if (c && c.models) c.models.forEach(push); });
      } catch (_) {}
      const hit = models.find(m => {
        const a = m.attributes || {};
        const mid = (typeof m.getCommandId === 'function' && m.getCommandId()) || a.command_id || a.id || m.id;
        return String(mid) === id;
      });
      if (!hit) return { exists: false };
      const a = hit.attributes || {};
      let cancelable = null;
      try { if (typeof hit.isCancelable === 'function') cancelable = !!hit.isCancelable(); } catch (_) {}
      if (cancelable == null && a.cancelable != null) cancelable = a.cancelable === true || a.cancelable === 1;
      return { exists: true, cancelable };
    } catch (_) { return null; }
  }
  function txHeroStatus(heroType) {
    try {
      if (typeof playerHeroesList !== 'function') return null;
      const h = playerHeroesList().find(x => String(x.type) === String(heroType));
      if (!h) return { exists: false };
      return {
        exists: true, type: h.type, home: h.home == null ? null : +h.home, origin: h.origin == null ? null : +h.origin,
        traveling: !!h.traveling, assigned: !!h.assigned, attacking: !!h.attacking, injured: !!h.injured, status: h.status || '',
      };
    } catch (_) { return null; }
  }
  function txMilitiaCount(townId) {
    try { const t = gbTownModel(townId); const u = t && t.units && t.units(); return u ? (+u.militia || 0) : null; } catch (_) { return null; }
  }
  function txSpellPresent(townId, powerId) {
    try { return recruitHasSpell(townId, powerId); } catch (_) { return null; }
  }
  function txQuestClaimable(qid) {
    try {
      const q = questsFromGame().find(x => String(x.questId) === String(qid) || String(x.progressableId) === String(qid));
      if (q) return q.claimStateKnown ? !!q.canClaim : null;
      const c = state.questRewards && (state.questRewards[qid] || Object.values(state.questRewards).find(x=>x&&(String(x.questId)===String(qid)||String(x.progressableId)===String(qid))));
      return c && c.claimStateKnown ? !!c.canClaim : null;
    } catch (_) { return null; }
  }
  function txCaveStatus(townId) {
    try { const i = caveTownInfo(townId); return i ? { iron: i.iron, stored: i.stored, hideCap: i.hideCap, unlimited: i.unlimited } : null; } catch (_) { return null; }
  }
  function txBanditStatus() {
    try {
      const uw = gameUw();
      const m = uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('PlayerAttackSpot');
      const a = m && (m.attributes || m);
      if (!a) return null;
      return {
        stage: a.stage != null ? a.stage : a.current_stage,
        cooldown: a.cooldown != null ? a.cooldown : (a.next_attack_at != null ? a.next_attack_at : a.attack_at),
        reward: a.reward_available != null ? !!a.reward_available : (a.can_collect != null ? !!a.can_collect : null),
      };
    } catch (_) { return null; }
  }
  function txCultureStatus(townId, type) {
    try {
      const uw = gameUw();
      const models = uw.MM && uw.MM.getModels && uw.MM.getModels().Celebration;
      if (!models) return null;
      let count = 0;
      for (const c of Object.values(models)) {
        const a = (c && c.attributes) || {};
        if (String(a.town_id) === String(townId) && (!type || String(a.celebration_type) === String(type))) count++;
      }
      return { count, gold: gbPlayerGold(), res: txTownResourceSnap(townId) };
    } catch (_) { return null; }
  }
  function txMerchantStatus(offerId) {
    try {
      const uw = gameUw();
      let model = null;
      for (const name of ['PhoenicianSalesmanOffer', 'MerchantOffer', 'PremiumExchangeOffer']) {
        const col = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName(name);
        if (!col || !col.models) continue;
        model = col.models.find(m => String((m.attributes || {}).id ?? m.id) === String(offerId));
        if (model) break;
      }
      if (!model) return { exists: false, gold: gbPlayerGold(), price: null };
      const a = model.attributes || model;
      const price = Number(a.price != null ? a.price : a.gold);
      return { exists: true, gold: gbPlayerGold(), price: Number.isFinite(price) ? price : null };
    } catch (_) { return null; }
  }
  function txPtTradeStatus(townId, offerId) {
    try {
      const uw = gameUw();
      let model = null;
      const tryCols = ['PhoenicianSalesmanOffer', 'MerchantOffer', 'PremiumExchangeOffer'];
      for (const name of tryCols) {
        const col = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName(name);
        if (!col || !col.models) continue;
        model = col.models.find(m => {
          const a = m.attributes || m;
          if (offerId != null && String(a.id ?? m.id) !== String(offerId)) return false;
          if (townId != null && a.town_id != null && String(a.town_id) !== String(townId)) return false;
          return true;
        });
        if (model) break;
      }
      const before = txTownResourceSnap(townId);
      const tradeCap = (function () {
        try { const t = gbTownModel(townId); return t && t.getAvailableTradeCapacity ? +t.getAvailableTradeCapacity() : null; } catch (_) { return null; }
      })();
      if (!model) return { exists: false, tradeCap, res: before };
      const a = model.attributes || model;
      const amount = Number(a.amount != null ? a.amount : a.trade_amount != null ? a.trade_amount : a.current_amount);
      return { exists: true, tradeCap, res: before, amount: Number.isFinite(amount) ? amount : null };
    } catch (_) { return null; }
  }
  function txCapture(feature, transport, endpoint, data) {
    const d = data || {};
    const a = transport === 'bridge' ? (d.arguments || {}) : d;
    const townId = d.town_id != null ? d.town_id : a.town_id;
    try {
      if (feature === 'build' || feature === 'instant-build' || feature === 'instant-research') {
        if (a.order_id != null) {
          const orderKind=feature==='instant-research'?'research':'build';
          return { kind:'instant', orderKind, orderId:String(a.order_id), present:ibOrderStillPresent(a.order_id,orderKind) };
        }
        if (a.building_id) {
          const st = txBuildStatus(townId, a.building_id);
          const action=String((d&&d.action_name)||endpoint||'').toLowerCase();
          const direction=/tear|down|demol/.test(action)?-1:1;
          return { kind: 'build', building: a.building_id, status: st, direction, targetLevel: st ? Math.max(0,st.projectedLevel + direction) : null };
        }
      }
      if (feature === 'research') return { kind: 'research', tech: a.id || a.research_id || a.research || a.research_type, status: txResearchStatus(townId, a.id || a.research_id || a.research || a.research_type) };
      if (feature === 'recruit') return { kind: 'recruit', unit: a.unit_id || a.unit_type, amount: +a.amount || 0, status: txUnitStatus(townId, a.unit_id || a.unit_type) };
      if (feature === 'villrecruit') {
        const unit = a.unit_id || a.unit_type;
        const farmId = a.farm_town_id;
        const counts = villageUnitCounts(farmId);
        const beforeCount = counts && counts.known && counts.units && Number.isFinite(+counts.units[unit]) ? +counts.units[unit] : null;
        return { kind:'villrecruit', farmId, unit, amount:+a.amount||0, beforeCount };
      }
      if (feature === 'farm') return { kind: 'farm', farmId: a.farm_town_id, status: txFarmStatus(a.farm_town_id) };
      if (feature === 'trade') return { kind: 'trade', source: txTownResourceSnap(townId), target: txTownResourceSnap(a.id), total: (+a.wood || 0) + (+a.stone || 0) + (+a.iron || 0) };
      if (feature === 'collect') return { kind: 'collect', before: txTownResourceSnap(townId) };
      if (feature === 'cave') return { kind: 'cave', before: txCaveStatus(townId), amount: +a.iron_to_store || 0 };
      if (feature === 'militia') return { kind: 'militia', before: txMilitiaCount(townId) };
      if (feature === 'spell') return { kind: 'spell', powerId: a.power_id, before: txSpellPresent(townId, a.power_id) };
      if (feature === 'quest') return { kind: 'quest', qid: a.progressable_id || String(d.model_url || '').split('/').pop(), before: txQuestClaimable(a.progressable_id || String(d.model_url || '').split('/').pop()) };
      if (feature === 'attack' || feature === 'dodge' || feature === 'favor' || feature === 'support') return { kind: 'movement', before: txMovementCount(townId, a.id, a.type), dest: a.id, mission: a.type };

      if (feature === 'spy') return { kind: 'spy', before: txCaveStatus(townId), amount: +a.espionage_iron || 0, dest: a.id };
      if (feature === 'cancel') {
        const commandId = a.id != null ? a.id : a.command_id;
        return { kind: 'cancel', commandId: String(commandId == null ? '' : commandId), before: txCommandStatus(commandId) };
      }
      if (feature === 'hero') {
        const heroType = a.type || a.hero_type || a.hero;
        return { kind: 'hero', action: String(endpoint || '').split('/').pop(), heroType: String(heroType || ''), targetTownId: a.target_town_id != null ? +a.target_town_id : (a.town_id != null ? +a.town_id : null), before: txHeroStatus(heroType) };
      }
      if (feature === 'wonder') return { kind: 'wonder', before: txTownResourceSnap(townId) };
      if (feature === 'bandit') {
        const action = String(endpoint || '').split('/').pop();
        const before = txBanditStatus();
        if (action === 'attack') {
          const movement = banditMovementEvidence(gameUw(), townId);
          return {
            kind: 'bandit-attack', action, before,
            beforeMovementCount: movement.known ? movement.count : null,
            beforeTownMovementCount: movement.known ? movement.townCount : null,
          };
        }
        return { kind: 'bandit', action, before };
      }
      if (feature === 'culture') {
        const typ = a.celebration_type || endpoint;
        return { kind: 'culture', type: typ, before: txCultureStatus(townId, typ) };
      }
      if (feature === 'merchant') {
        const offerId = a.offer_id || a.offer || String(d.model_url || '').split('/').pop();
        return { kind: 'merchant', offerId, before: txMerchantStatus(offerId) };
      }
      if (feature === 'pttrade') {
        const offerId = a.offer_id || a.offer || (d.model_url && String(d.model_url).split('/').pop());
        return { kind: 'pttrade', offerId, townId, before: txPtTradeStatus(townId, offerId) };
      }
      if (feature === 'rurallevel') {
        const relId = String(d.model_url || '').split('/').pop();
        let status = null;
        try {
          const rel = ruralRelModels().find(r => String((r.attributes || {}).id || r.id) === relId);
          const x = rel && (rel.attributes || {});
          if (x) status = { relation: +x.relation_status || 0, stage: +x.expansion_stage || 0, expansionAt: x.expansion_at || null };
        } catch (_) {}
        return { kind: 'rurallevel', relId, status };
      }
      if (feature === 'ruraltrade') return { kind: 'ruraltrade', before: txTownResourceSnap(townId), farmId: a.farm_town_id };
    } catch (_) {}
    return { kind: 'generic' };
  }
  function txIntent(feature, transport, endpoint, data, snap) {
    const d = data || {};
    const a = transport === 'bridge' ? (d.arguments || {}) : d;
    const townId = d.town_id != null ? d.town_id : a.town_id;
    if (feature === 'build' || feature === 'instant-build' || feature === 'instant-research') {
      if (a.order_id != null) return `instant:${townId}:${feature==='instant-research'?'research':'build'}:${a.order_id}`;
      return `build:${townId}:${a.building_id || '?'}:${snap && snap.targetLevel != null ? snap.targetLevel : '?'}`;
    }
    if (feature === 'research') return `research:${townId}:${a.id || a.research_id || a.research || a.research_type || '?'}`;
    if (feature === 'recruit') {
      const u = a.unit_id || a.unit_type || '?';
      const before = snap && snap.status ? snap.status.total : '?';
      return `recruit:${townId}:${u}:${before}+${+a.amount || 0}`;
    }
    if (feature === 'villrecruit') {
      const u = a.unit_id || a.unit_type || '?';
      const farmId = a.farm_town_id || '?';
      const before = snap && snap.beforeCount != null ? snap.beforeCount : '?';
      return `villrecruit:${townId}:${farmId}:${u}:${before}+${+a.amount || 0}`;
    }
    if (feature === 'trade') return `trade:${townId}:${a.id}:${+a.wood || 0}:${+a.stone || 0}:${+a.iron || 0}`;

    if (feature === 'farm') return `farm:${townId}:${a.farm_town_id}:${a.type || 'resources'}:${a.option}`;
    if (feature === 'collect') return `collect:${townId}:${endpoint}`;
    if (feature === 'cave') return `cave:${townId}:${+a.iron_to_store || 0}`;
    if (feature === 'militia') return `militia:${townId}`;
    if (feature === 'spell') return `spell:${townId}:${a.power_id || '?'}`;
    if (feature === 'quest') return `quest:${a.progressable_id || String(d.model_url || '').split('/').pop() || '?'}`;
    if (feature === 'attack' || feature === 'dodge' || feature === 'favor' || feature === 'support') return `${feature}:${townId}:${a.id || '?'}:${a.type || '?'}:${txUnitSignature(a)}`;

    // Stable item identity: mutable cave silver must not let an unresolved spy
    // intent evade its manual-review tombstone on the next scan.
    if (feature === 'spy') return `spy:${townId}:${a.id || '?'}:${+a.espionage_iron || 0}`;
    if (feature === 'cancel') return `cancel:${a.id != null ? a.id : (a.command_id != null ? a.command_id : '?')}`;
    if (feature === 'hero') return `hero:${String(endpoint || '?').split('/').pop()}:${a.type || a.hero_type || a.hero || '?'}:${a.target_town_id != null ? a.target_town_id : (a.town_id != null ? a.town_id : '-')}`;
    if (feature === 'wonder') return `wonder:${townId}:${a.id || a.wonder_id || '?'}:${+a.wood || 0}:${+a.stone || 0}:${+a.iron || 0}`;
    if (feature === 'bandit') {
      const before = snap && snap.before || {};
      const stage = before.stage != null ? before.stage : '?';
      const cooldown = before.cooldown != null ? before.cooldown : '?';
      return `bandit:${townId}:${endpoint}:stage=${stage}:cd=${cooldown}:${txUnitSignature(a)}`;
    }
    if (feature === 'rurallevel' || feature === 'ruraltrade') return `${feature}:${townId}:${a.farm_town_id || String(d.model_url || '').split('/').pop()}:${endpoint}`;
    if (feature === 'culture') return `culture:${townId}:${a.celebration_type || endpoint}`;
    if (feature === 'merchant') return `merchant:${townId}:${a.offer_id || a.offer || a.id || endpoint}`;
    if (feature === 'pttrade') return `pttrade:${townId || '-'}:${a.offer_id || a.offer || (d.model_url ? String(d.model_url).split('/').pop() : '') || endpoint}`;
    return `${feature}:${townId || '-'}:${endpoint}:${JSON.stringify(txStableObj(a)).slice(0, 100)}`;
  }
  function txNum(v) { return gbNum(v); }
  function txLt(a, b) { const x = txNum(a), y = txNum(b); return x != null && y != null && x < y; }
  function txGt(a, b) { const x = txNum(a), y = txNum(b); return x != null && y != null && x > y; }
  function txNe(a, b) { const x = txNum(a), y = txNum(b); return x != null && y != null && x !== y; }
  function txResTriadReadable(o) {
    return !!o && txNum(o.wood) != null && txNum(o.stone) != null && txNum(o.iron) != null;
  }
  function txReconcileNow(tx) {
    const s = tx.snapshot || {};
    const meta = tx.meta || {};
    try {
      if (s.kind === 'instant') return ibOrderStillPresent(s.orderId,s.orderKind) ? 'unknown' : 'applied';
      if (s.kind === 'build') {
        const cur = txBuildStatus(meta.townId, s.building);
        if (!cur || s.targetLevel == null) return 'unknown';
        const dir=+s.direction||1;
        if (dir<0) return cur.projectedLevel<=s.targetLevel?'applied':'unchanged';
        if (cur.projectedLevel >= s.targetLevel) return 'applied';
        return 'unchanged';
      }
      if (s.kind === 'research') {
        const cur = txResearchStatus(meta.townId, s.tech);
        if (!cur || !s.status) return 'unknown';
        if (cur.done || (!s.status.queued && cur.queued)) return 'applied';
        return 'unchanged';
      }
      if (s.kind === 'recruit') {
        const cur = txUnitStatus(meta.townId, s.unit);
        if (!cur || !s.status) return 'unknown';

        if (txNum(cur.total) == null || txNum(s.status.total) == null) return 'unknown';
        if (cur.total >= s.status.total + Math.max(1, s.amount || 0)) return 'applied';
        return 'unchanged';
      }
      if (s.kind === 'villrecruit') {
        const counts = villageUnitCounts(s.farmId);
        if (!counts || !counts.known || !counts.units || s.beforeCount == null || !Number.isFinite(+counts.units[s.unit])) return 'unknown';
        const cur = +counts.units[s.unit];
        if (cur >= +s.beforeCount + Math.max(1, +s.amount || 0)) return 'applied';
        return cur === +s.beforeCount ? 'unchanged' : 'unknown';
      }
      if (s.kind === 'farm') {
        const cur = txFarmStatus(s.farmId);
        if (!cur) return 'unknown';
        // Verdict off CURRENT claimability, not the old lootableAt-vs-
        // lootableAt compare: both sides are null for a claimable village,
        // which made every farm reconcile permanently 'unknown'. On cooldown
        // = a claim landed; claimable = this tx did not apply (a dup-path
        // reconcile 10min+ after a landed 10min claim seeing the village
        // claimable again is still correct: claiming again IS farming).
        if (cur.lootableNow === false) return 'applied';
        if (cur.lootableNow === true) return 'unchanged';
        return 'unknown';
      }
      if (s.kind === 'trade' || s.kind === 'collect' || s.kind === 'wonder' || s.kind === 'ruraltrade') {
        const before = s.kind === 'trade' ? s.source : s.before;
        const cur = txTownResourceSnap(meta.townId);
        if (!before || !cur) return 'unknown';
        if (!txResTriadReadable(before) || !txResTriadReadable(cur)) return 'unknown';
        const resChanged = txNe(cur.wood, before.wood) || txNe(cur.stone, before.stone) || txNe(cur.iron, before.iron);
        const capChanged = txNum(cur.tradeCap) != null && txNum(before.tradeCap) != null && txNe(cur.tradeCap, before.tradeCap);
        // These snapshots have no unique server-side action id. Any resource or
        // capacity delta may belong to a concurrent module/manual action.
        return resChanged || capChanged ? 'unknown' : 'unchanged';
      }
      if (s.kind === 'cave') {
        const cur = txCaveStatus(meta.townId);
        if (!cur || !s.before) return 'unknown';
        const stored = txNum(cur.stored), beforeStored = txNum(s.before.stored);
        if (stored == null || beforeStored == null) return 'unknown';
        const need = Math.max(1, +s.amount || 0);
        if (stored >= beforeStored + need) return 'applied';
        if (stored === beforeStored && txNum(cur.iron) != null && txNum(s.before.iron) != null
          && !txNe(cur.iron, s.before.iron)) return 'unchanged';
        return 'unknown';
      }
      if (s.kind === 'spy') {
        const cur = txCaveStatus(meta.townId);
        if (!cur || !s.before || txNum(cur.stored) == null || txNum(s.before.stored) == null) return 'unknown';
        // Cave silver is shared by every spy action and does not identify the
        // destination. A decrease alone can never confirm this intent.
        return txNum(cur.stored) === txNum(s.before.stored) ? 'unchanged' : 'unknown';
      }
      if (s.kind === 'militia') {
        const cur = txMilitiaCount(meta.townId);
        if (cur == null || s.before == null) return 'unknown';
        return cur > s.before ? 'applied' : 'unchanged';
      }
      if (s.kind === 'spell') {
        const cur = txSpellPresent(meta.townId, s.powerId);
        if (cur === true && s.before !== true) return 'applied';
        return cur == null ? 'unknown' : 'unchanged';
      }
      if (s.kind === 'quest') {
        const cur = txQuestClaimable(s.qid);
        if (cur === false && s.before !== false) return 'applied';
        return cur == null ? 'unknown' : 'unchanged';
      }
      if (s.kind === 'movement') {
        // A count at destination/mission granularity cannot distinguish this
        // command from a concurrent manual or module movement.
        return 'unknown';
      }
      if (s.kind === 'cancel') {
        const cur = txCommandStatus(s.commandId);
        if (!cur || !s.before) return 'unknown';
        if (s.before.exists === true && cur.exists === false) return 'applied';
        return cur.exists === true ? 'unchanged' : 'unknown';
      }
      if (s.kind === 'hero') {
        const cur = txHeroStatus(s.heroType);
        if (!cur || !s.before || cur.exists === false) return 'unknown';
        const action = String(s.action || '').toLowerCase();
        if (/assigntotown/.test(action) && !/unassign/.test(action)) {
          if (s.targetTownId != null && +cur.home === +s.targetTownId && (cur.assigned || cur.traveling)) return 'applied';
        } else if (/unassignfromtown/.test(action)) {
          if (s.before.assigned && !cur.assigned && !cur.attacking) return 'applied';
        } else if (/canceltowntravel/.test(action)) {
          if (s.before.traveling && !cur.traveling) return 'applied';
        }
        return JSON.stringify(cur) !== JSON.stringify(s.before) ? 'unknown' : 'unchanged';
      }
      if (s.kind === 'culture') {
        const cur = txCultureStatus(meta.townId, s.type);
        if (!cur || !s.before) return 'unknown';
        if (cur.count > s.before.count) return 'applied';
        const goldChanged = txNum(cur.gold) != null && txNum(s.before.gold) != null && txNe(cur.gold, s.before.gold);
        const resChanged = txResTriadReadable(cur.res) && txResTriadReadable(s.before.res)
          && (txNe(cur.res.wood, s.before.res.wood) || txNe(cur.res.stone, s.before.res.stone) || txNe(cur.res.iron, s.before.res.iron));
        return cur.count === s.before.count && !goldChanged && !resChanged ? 'unchanged' : 'unknown';
      }
      if (s.kind === 'merchant') {
        const cur = txMerchantStatus(s.offerId);
        if (!cur || !s.before) return 'unknown';
        if (s.before.exists && !cur.exists) return 'applied';
        if (cur.exists === s.before.exists && txNum(cur.gold) != null && txNum(s.before.gold) != null
          && !txNe(cur.gold, s.before.gold)) return 'unchanged';
        return 'unknown';
      }
      if (s.kind === 'pttrade') {
        const cur = txPtTradeStatus(meta.townId, s.offerId);
        if (!cur || !s.before) return 'unknown';
        if (s.before.exists && !cur.exists) return 'applied';
        if (cur.exists !== s.before.exists) return 'unknown';
        if (txNum(cur.amount) == null || txNum(s.before.amount) == null) return 'unknown';
        if (txNum(cur.tradeCap) == null || txNum(s.before.tradeCap) == null) return 'unknown';
        if (!txResTriadReadable(cur.res) || !txResTriadReadable(s.before.res)) return 'unknown';
        const changed = txNe(cur.amount, s.before.amount) || txNe(cur.tradeCap, s.before.tradeCap)
          || txNe(cur.res.wood, s.before.res.wood) || txNe(cur.res.stone, s.before.res.stone) || txNe(cur.res.iron, s.before.res.iron);
        return changed ? 'unknown' : 'unchanged';
      }
      if (s.kind === 'bandit-attack' || (s.kind === 'bandit' && /\/attack$/i.test(String(tx.endpoint || '')))) {
        return banditMovementReconcileResult(tx, banditMovementEvidence(gameUw(), meta.townId));
      }
      if (s.kind === 'bandit') {
        const cur = txBanditStatus();
        if (!cur || !s.before) return 'unknown';
        return JSON.stringify(cur) !== JSON.stringify(s.before) ? 'applied' : 'unchanged';
      }
      if (s.kind === 'rurallevel') {
        let cur = null;
        try {
          const rel = ruralRelModels().find(r => String((r.attributes || {}).id || r.id) === String(s.relId));
          const x = rel && (rel.attributes || {});
          if (x) cur = { relation: +x.relation_status || 0, stage: +x.expansion_stage || 0, expansionAt: x.expansion_at || null };
        } catch (_) {}
        if (!cur || !s.status) return 'unknown';
        return JSON.stringify(cur) !== JSON.stringify(s.status) ? 'applied' : 'unchanged';
      }
    } catch (_) {}
    return 'unknown';
  }
  function txReconcile(tx, onDone) {
    if (!gbInstanceAlive()) return onDone && onDone('unknown');
    tx.state = 'reconciling';
    tx.updatedAt = Date.now();
    txSave();
    const s = tx.snapshot || {};

    const checks = (s.kind === 'bandit-attack' || (s.kind === 'bandit' && /\/attack$/i.test(String(tx.endpoint || ''))))
      ? [700, 1800, 3500, 5000, 8000]
      : [700, 1800, 3500];
    let i = 0;
    const step = () => {
      if (!gbInstanceAlive()) return;
      const r = txReconcileNow(tx);
      if (r === 'applied') return onDone && onDone('applied');
      if (r === 'unknown' && i >= checks.length) return onDone && onDone('unknown');
      if (i >= checks.length) return onDone && onDone('unchanged');
      gbTimeout(step, checks[i++]);
    };
    step();
  }
  function txReconcileUnknownOnLeader(reason) {
    if (!gbInstanceAlive() || !gbTabLeader) return 0;
    const list = Object.values(state.txState || {}).filter(t => t && t.state === 'unknown');
    let n = 0;
    list.slice(0, 24).forEach((tx, idx) => {
      gbTimeout(() => {
        if (!gbInstanceAlive() || !gbTabLeader || !tx || tx.state !== 'unknown') return;
        txReconcile(tx, r => {
          if (!gbInstanceAlive() || !gbTabLeader) return;
          if (r === 'applied') { tx.state='committed'; tx.detail=`reconciled after leader acquire (${reason||'leader'})`; plannerRelease(tx,'leader-reconciled-applied'); }
          else if (r === 'unchanged') { tx.state='failed'; tx.detail=`confirmed unchanged after leader acquire (${reason||'leader'}); retry allowed`; plannerRelease(tx,'leader-reconcile-unchanged'); }
          else { tx.state='unknown'; tx.unknownAt=tx.unknownAt||Date.now(); tx.detail=`still unresolved after leader acquire (${reason||'leader'})`; plannerRelease(tx,'leader-reconcile-unknown'); }
          tx.updatedAt=Date.now(); txSave();
        });
      }, 2500 + idx * 120);
      n++;
    });
    return n;
  }
  function txActionGate(feature, write, jtag) {
    if (!gbInstanceAlive()) return 'disposed';
    if (!hostEnabled()) return 'disabled';
    const pauseInfo = {};
    if (automationPaused(pauseInfo)) return 'paused:' + pauseInfo.reason;
    if (captchaPaused(feature) || (captchaGlobalUntil && Date.now() < captchaGlobalUntil)) return 'captcha-pause';
    if (write && circuitOpen(feature)) return 'circuit-open';
    if (jtag && jrnSkipped(jtag)) return 'remembered';
    if (write && state.dryRun) return 'dryrun';

    if (!reqBudgetOk(write ? 'action' : 'read')) return 'budget';
    return null;
  }
  function txFindExistingIntent(intent, feature, snapshot, townId) {
    const exact = state.txState && state.txState[intent];
    if (exact) return exact;
    if (feature !== 'spy' || !snapshot) return null;
    // Compatibility with 6.0.14 spy keys, which included mutable cave silver.
    // Match only the same spy item; unrelated towns/targets keep running.
    for (const tx of Object.values(state.txState || {})) {
      if (!tx || tx.feature !== 'spy' || !/^(planned|precheck|sending|confirming|reconciling|unknown|manual-review)$/.test(tx.state || '')) continue;
      const old = tx.snapshot || {};
      const oldTown = tx.meta && tx.meta.townId;
      if (String(oldTown) !== String(townId)) continue;
      if (String(old.dest) !== String(snapshot.dest)) continue;
      if ((+old.amount || 0) !== (+snapshot.amount || 0)) continue;
      return tx;
    }
    return null;
  }
  function txRun(feature, transport, endpoint, data, rawSend, onDone) {
    const write = TX_WRITE_FEATURES.has(feature);
    const snapshot = write ? txCapture(feature, transport, endpoint, data) : null;
    const intent = write ? txIntent(feature, transport, endpoint, data, snapshot) : null;
    const metaTown = data && (data.town_id != null ? data.town_id : (data.arguments && data.arguments.town_id));
    const jtag = write
      ? { f: feature, a: String(endpoint).slice(0, 48), k: String(intent).slice(0, 120) }
      : jrnTag(feature, transport === 'bridge' ? data : { action_name: endpoint, arguments: data, town_id: metaTown });
    let journalTxId = null;
    const bail = (err, why) => {
      const journalResult = jrnResult(why || err);

      if (!jrnPendingResult(journalResult)) jrnPush(jtag, journalResult, why || err, journalTxId);
      if (onDone && gbInstanceAlive()) onDone(err);
    };
    let gate = txActionGate(feature, write, jtag);
    if (!gate && write) gate = safeModeBlock(feature, transport, endpoint, data);
    if (gate) {
      if (gate === 'dryrun') {
        gbLog(`DRY-RUN ${feature}: ${endpoint} ${dryRunFmt(data)}`);
        if (write) {
          state.txState[intent] = { id: `${GB_INSTANCE_ID}:${++txSeq}`, intent, feature, state: 'dryrun', createdAt: Date.now(), updatedAt: Date.now(), owner: GB_INSTANCE_ID, snapshot, meta: { townId: metaTown } };
          journalTxId = state.txState[intent].id;
          txSave();
        }
        return bail('dryrun');
      }
      if (gate === 'circuit-open') gbLogT('circuit-' + feature, 60000, `${feature}: circuit breaker open`);
      whyNote(feature, endpoint, 'blocked', gate);
      return bail(gate.split(':')[0], gate);
    }
    if (write) {

      const tplName = tplNameFor(feature, transport === 'bridge' ? data : null);
      if (tplName && !tplHealthOk(tplName)) {
        gbLogT('tpl-stale-' + tplName, 120000, `${feature}: template ${tplName} invalidated - re-learn by hand`);
        whyNote(feature, endpoint, 'blocked', 'tpl-stale');
        return bail('tpl-stale');
      }

      const softMs = reqBudgetSoftDelayMs();
      if (softMs > 0) {
        gbLogT('req-soft-' + feature, 30000, `${feature}: soft ceiling - delaying ${softMs}ms`);
        gbTimeout(() => txRun(feature, transport, endpoint, data, rawSend, onDone), softMs);
        return;
      }
    }
    if (!write) {
      reqBudgetMark('read');
      return rawSend((err, result) => {
        if (!gbInstanceAlive()) return;
        if (!err) { markModuleHealth(feature, 'ok'); circuitSuccess(feature); }
        else if (err === 'captcha') markModuleHealth(feature, 'captcha', {error:'captcha',townId:metaTown,action:endpoint});
        else { markModuleHealth(feature, 'err', {error:err,townId:metaTown,action:endpoint}); circuitNote(feature, err); }
        jrnPush(jtag, jrnResult(err), err);
        if (onDone) onDone(err, result);
      });
    }

    txPrune();

    if (state.txState[intent] && state.txState[intent].state === 'dryrun' && !state.dryRun) {
      delete state.txState[intent];
      txSave();
    }
    const existing = txFindExistingIntent(intent, feature, snapshot, metaTown);

    if (existing && /^(planned|precheck|sending|confirming|reconciling|unknown|manual-review|dryrun)$/.test(existing.state || '')) {
      journalTxId = existing.id;
      const age = Date.now() - (+existing.unknownAt || +existing.updatedAt || +existing.createdAt || Date.now());
      if (existing.state !== 'unknown' || age < TX_UNKNOWN_RECHECK_MS) {
        gbLogT('tx-dup-' + intent, 30000, `tx: duplicate blocked ${intent} state=${existing.state}`);
        return bail('pending', 'pending:' + existing.state);
      }
      existing.meta = Object.assign({}, existing.meta || {}, { townId: metaTown });
      return txReconcile(existing, (r) => {
        if (!gbInstanceAlive()) return;
        if (r === 'applied') {
          existing.state = 'committed'; existing.updatedAt = Date.now(); existing.detail = 'reconciled before retry'; plannerRelease(existing,'pre-retry-reconciled-applied'); txSave();
          jrnPush(jtag, 'ok', 'reconciled', existing.id);
          markModuleHealth(feature, 'ok');
          if (onDone) onDone(null, { reconciled: true, duplicate: true });
          return;
        }
        if (r === 'unchanged' && feature === 'farm') {
          // Farm reconcile 'unchanged' is PROOF the earlier claim did not
          // land (the village is claimable right now) — the retry the hard
          // rule forbids is the blind one, and this one carries evidence.
          // Drop the tombstone and re-enter as a fresh attempt. Without this
          // fall-through a farm intent could never post again: every cadence
          // re-reconciled the same tombstone to 'unchanged' and re-armed the
          // recheck window (es146 2026-08-26: 35/66 villages starved).
          delete state.txState[intent]; plannerRelease(existing, 'reconciled-unchanged'); txSave();
          jrnPush(jtag, 'unknown', 'reconcile-not-applied-retry', existing.id);
          return txRun(feature, transport, endpoint, data, rawSend, onDone);
        }
        if (r === 'unchanged') {
          // CLAUDE.md hard rule: "Timeout ≠ retry for an irreversible action.
          // Reconcile instead." A reconcile=unchanged verdict on an irreversible
          // write (recruit / attack / support / trade / cave / spell) is the
          // exact case the rule covers: the previous post MAY have landed but
          // the model read was stale, and re-entering txRun 250ms later would
          // double-spend a unit / attack / trade slot. Set state to 'unknown'
          // and let the next cadence re-evaluate.
          existing.state = 'unknown'; existing.unknownAt = Date.now(); existing.updatedAt = Date.now(); existing.detail = 'reconciled not applied; next cadence re-evaluates'; plannerRelease(existing, 'reconciled-unchanged'); txSave();
          jrnPush(jtag, 'unknown', 'reconciled-unchanged', existing.id);
          markModuleHealth(feature, 'err');
          if (onDone) onDone('unknown', null);
          return;
        }
        // r === 'unknown' (blind model read): the entry MUST NOT stay
        // 'reconciling' — nothing moves it out of that state at runtime, every
        // later attempt dup-blocks on it forever, and skipping onDone here
        // killed the caller's chain mid-sweep (es146 2026-08-26: a farm claim
        // batch died on the first poisoned village, the claim lock leaked
        // until TTL, and island 64883 went unfarmed all day). Re-stamp
        // 'unknown' so the recheck window re-arms and the next cadence tick
        // re-evaluates. unknownAt keeps its ORIGINAL stamp: re-arming it
        // every inconclusive reconcile would keep the entry forever young and
        // it would never age into manual-review.
        existing.state = 'unknown'; existing.unknownAt = existing.unknownAt || Date.now(); existing.updatedAt = Date.now(); existing.detail = 'reconcile inconclusive; next cadence re-evaluates'; plannerRelease(existing, 'unknown-unresolved'); txSave();
        jrnPush(jtag, 'unknown', 'reconcile-inconclusive', existing.id);
        markModuleHealth(feature, 'err');
        if (onDone) onDone('unknown', null);
      });
    }

    const tx = state.txState[intent] = {
      id: `${GB_INSTANCE_ID}:${++txSeq}`,
      intent, feature, transport, endpoint, state: 'planned', owner: GB_INSTANCE_ID,
      createdAt: Date.now(), updatedAt: Date.now(), snapshot, meta: { townId: metaTown },
    };
    journalTxId = tx.id;
    txSave();
    tx.state = 'precheck'; tx.updatedAt = Date.now(); txSave();
    const plannerEffects = plannerEffect(feature, transport, endpoint, data, snapshot);
    if (plannerEffects === null) {
      tx.state = 'aborted'; tx.detail = 'planner effect/cost unreadable'; tx.updatedAt = Date.now(); txSave();
      whyNote(feature, endpoint, 'blocked', 'planner-cost-unknown');
      return bail('precheck', 'planner-cost-unknown');
    }
    if (plannerEffects.length) {
      const held = plannerHold(tx, plannerEffects);
      if (!held.ok) {
        tx.state = 'aborted'; tx.detail = held.why; tx.updatedAt = Date.now(); plannerRelease(tx, held.why); txSave();
        whyNote(feature, endpoint, 'blocked', held.why);
        return bail('precheck', held.why);
      }
    }

    if (!reqBudgetOk('action')) { tx.state = 'aborted'; tx.detail = 'budget'; tx.updatedAt = Date.now(); plannerRelease(tx, 'budget'); txSave(); return bail('budget'); }
    reqBudgetMark('action');
    tx.state = 'sending'; tx.sentAt = Date.now(); tx.updatedAt = Date.now(); txSave();
    rawSend((err, result) => {
      if (!gbInstanceAlive() || tx.owner !== GB_INSTANCE_ID) return;

      if (state.txState[intent] !== tx || !/^(sending|confirming)$/.test(tx.state)) return;
      if (err === 'timeout') {
        tx.state = 'reconciling'; tx.unknownAt = Date.now(); tx.updatedAt = Date.now(); tx.detail = 'transport timeout; reconciling'; txSave();
        markModuleHealth(feature, 'timeout', {latencyMs:Date.now()-tx.sentAt,error:'timeout',townId:metaTown,action:endpoint,intent});
        return txReconcile(tx, (r) => {
          if (!gbInstanceAlive() || state.txState[intent] !== tx) return;
          if (r === 'applied') {
            tx.state = 'committed'; tx.updatedAt = Date.now(); tx.detail = 'confirmed by reconciliation after timeout'; plannerRelease(tx, 'timeout-reconciled-applied'); txSave();
            jrnPush(jtag, 'ok', 'timeout reconciled', tx.id);
            markModuleHealth(feature, 'ok', {latencyMs:Date.now()-tx.sentAt}); circuitSuccess(feature);
            if (onDone) onDone(null, Object.assign({ reconciled: true }, result || {}));
          } else if (r === 'unchanged') {
            tx.state = 'failed'; tx.updatedAt = Date.now(); tx.detail = 'timeout; state remained unchanged after reconciliation; retry allowed'; plannerRelease(tx, 'timeout-unchanged'); txSave();
            jrnPush(jtag, 'timeout', tx.detail, tx.id);
            if (onDone) onDone('timeout', result);
          } else {
            tx.state = 'unknown'; tx.unknownAt = tx.unknownAt || Date.now(); tx.updatedAt = Date.now(); tx.detail = 'timeout; unable to reconcile'; plannerRelease(tx, 'timeout-unknown'); txSave();
            jrnPush(jtag, 'timeout', tx.detail, tx.id);
            if (onDone) onDone('timeout_unknown', result);
          }
        });
      }
      if (err) {
        const expectedReject = gbExpectedServerReject(feature, err);
        tx.state = 'failed'; tx.updatedAt = Date.now(); tx.detail = String(err).slice(0, 160); plannerRelease(tx, expectedReject || 'server-error'); txSave();
        if (err === 'captcha' || err === 'captcha-pause') {
          markModuleHealth(feature, 'captcha', {latencyMs:Date.now()-tx.sentAt,error:err,townId:metaTown,action:endpoint,intent});
        } else if (expectedReject) {
          markModuleHealth(feature, 'skip', {latencyMs:Date.now()-tx.sentAt,error:err,townId:metaTown,action:endpoint,intent});
          whyNote(feature, endpoint, 'blocked', expectedReject);
        } else {
          markModuleHealth(feature, 'err', {latencyMs:Date.now()-tx.sentAt,error:err,townId:metaTown,action:endpoint,intent});
        }
        if (!expectedReject) circuitNote(feature, err);
        const jr = expectedReject ? ('skip:' + expectedReject) : jrnResult(err);
        jrnPush(jtag, jr, err, tx.id);
        try { tplHealthNote(feature, jr, transport === 'bridge' ? data : null); } catch (_) {}
        if (onDone) onDone(err, result);
        return;
      }
      tx.state = 'confirming'; tx.updatedAt = Date.now(); txSave();

      const r = txReconcileNow(tx);
      if (r === 'applied' || r === 'unknown' || r === 'unchanged') {
        tx.state = 'committed'; tx.updatedAt = Date.now(); tx.detail = r === 'applied' ? 'server+model confirmed' : 'server callback confirmed'; plannerCommit(tx); txSave();
        markModuleHealth(feature, 'ok', {latencyMs:Date.now()-tx.sentAt}); circuitSuccess(feature);
        jrnPush(jtag, 'ok', tx.detail, tx.id);
        try { tplHealthNote(feature, 'ok', transport === 'bridge' ? data : null); } catch (_) {}
        if (onDone) onDone(null, result);
      }
    });
  }

  function txRunAsync(feature, transport, endpoint, data, rawSend, opts) {
    const sig = opts && opts.signal;
    return new Promise((resolve, reject) => {
      if (sig && sig.aborted) return reject(new DOMException('aborted', 'AbortError'));
      const onAbort = () => reject(new DOMException('aborted', 'AbortError'));
      if (sig) sig.addEventListener('abort', onAbort, { once: true });
      try {
        txRun(feature, transport, endpoint, data, rawSend, (err, result) => {
          if (sig) sig.removeEventListener('abort', onAbort);
          if (err) reject(err instanceof Error ? err : new Error(String(err)));
          else resolve(result);
        });
      } catch (e) {
        if (sig) sig.removeEventListener('abort', onAbort);
        reject(e);
      }
    });
  }
  const SELF_BRIDGE_MAX = 12;
  const SELF_BRIDGE_TTL_MS = 10000;
