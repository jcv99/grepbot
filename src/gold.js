  // GOLD - PremiumExchange resource sale automation.
  // Contract: disabled by default; action names are learned from the player's
  // own PremiumExchange traffic; reads share bridge lifecycle guards; offer and
  // confirm use bridgePost -> txRun. A callback loss is UNKNOWN, never replayed.
  const GOLD_READ_FRESH_MS = 45000;
  const GOLD_OFFER_TTL_MS = 120000;
  const GOLD_CONSUMER_HOLD_MS = 5000;
  const GOLD_CONFIRM_RETRY_COOLDOWN_MS = 60000;
  const GOLD_MIN_BATCH = 100;
  const GOLD_MAX_MAC_CHARS = 4096;
  const GOLD_STATES = new Set(['REQUESTING_OFFER', 'OFFER_RECEIVED', 'CONFIRMING', 'CAPTCHA_PENDING', 'UNKNOWN', 'MANUAL_REVIEW', 'REVIEWED']);
  const goldMarkets = new Map();
  const goldReadFlights = new Map();
  const goldQuoteSecrets = new Map();
  const goldLocks = new Map();
  let goldScanCursor = 0;

  function goldPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  }
  function goldReadNumber(value) {
    const n = gbNum(value);
    return n != null && n >= 0 ? n : null;
  }
  function goldPositiveInt(value) {
    const n = gbNum(value);
    return n != null && n > 0 && Number.isSafeInteger(n) ? n : null;
  }
  function goldText(value, max) {
    const s = String(value == null ? '' : value).trim();
    return s ? s.slice(0, max || 160) : '';
  }
  function goldStableId(value) {
    const s = goldText(value, 120);
    return /^[a-z0-9_.:-]+$/i.test(s) ? s : '';
  }
  function goldOwner() {
    try {
      const uw = gameUw();
      const player = uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('Player');
      const a = player && (player.attributes || player);
      for (const value of [a && (a.player_id != null ? a.player_id : a.id), uw.Game && uw.Game.player_id]) {
        const id = goldStableId(value);
        if (id) return id;
      }
    } catch (_) {}
    return '';
  }
  function goldOwnership() {
    const testWorld = GB_ROOT.__grepbotTestMode === true ? GB_ROOT.__grepbotTestWorld : '';
    const world = goldText(location.hostname || testWorld, 120);
    const player = goldOwner();
    return world && player ? { world, player } : null;
  }
  function goldEnabled() { return state.goldEnabled === true; }
  function goldTownEnabled(townId) {
    return !!(state.goldTowns && state.goldTowns[String(townId)] === true);
  }
  function goldBatch() {
    const n = goldPositiveInt(state.goldBatch);
    return Math.max(GOLD_MIN_BATCH, Math.min(1000000, n == null ? 10000 : n));
  }
  function goldStatsRoot() {
    const base = { reads:0, readErrors:0, offers:0, confirms:0, confirmed:0, captcha:0, unknown:0, rejected:0, lastAt:0, lastWhy:'' };
    state.goldStats = Object.assign(base, goldPlainObject(state.goldStats) || {});
    return state.goldStats;
  }
  function goldStatsSave() { return gbTabLeader && save(STORE.GOLD_STATS, goldStatsRoot()); }
  function goldStat(field, why) {
    const stats = goldStatsRoot();
    stats[field] = (goldReadNumber(stats[field]) || 0) + 1;
    stats.lastAt = Date.now();
    stats.lastWhy = goldText(why, 120);
    goldStatsSave();
  }
  function goldActionRoot() {
    const raw = goldPlainObject(state.goldActions);
    state.goldActions = raw || {};
    return state.goldActions;
  }
  function goldAction(kind) {
    const root = goldActionRoot();
    const row = goldPlainObject(root[kind]);
    if (!row || goldText(row.modelUrl, 80) !== 'PremiumExchange') return null;
    const action = goldText(row.action, 120);
    return action ? { modelUrl:'PremiumExchange', action } : null;
  }
  function goldActionsReady(writes) {
    if (!goldAction('read')) return false;
    return !writes || (!!goldAction('offer') && !!goldAction('confirm'));
  }
  // Called only by the XHR sniffer for a human-originated bridge request. It
  // deliberately stores action shape only: quote MACs/tokens never enter state.
  function goldLearnPayload(payload) {
    if (!gbTabLeader) return false;
    const p = goldPlainObject(payload);
    if (!p || goldText(p.model_url, 80) !== 'PremiumExchange') return false;
    const action = goldText(p.action_name, 120);
    if (!action) return false;
    const lower = action.toLowerCase();
    const kind = lower === 'read' ? 'read' : (/request.*offer/.test(lower) ? 'offer' : (/confirm.*offer/.test(lower) ? 'confirm' : ''));
    if (!kind) return false;
    const next = Object.assign({}, goldActionRoot(), { [kind]: { modelUrl:'PremiumExchange', action, learnedAt:Date.now() } });
    if (!save(STORE.GOLD_ACTIONS, next)) return false;
    state.goldActions = next;
    try { tplHealthMarkLearned('goldActions'); } catch (_) {}
    gbLog(`gold: learned PremiumExchange ${kind} action from manual traffic`);
    return true;
  }
  function goldTownIds() {
    const ids = [];
    try {
      const rows = typeof townsFromGame === 'function' ? townsFromGame() : null;
      for (const row of rows || []) {
        const id = goldStableId(row && row.id);
        if (id && !ids.includes(id)) ids.push(id);
      }
    } catch (_) {}
    if (!ids.length) {
      try {
        for (const id of Object.keys((gameUw().ITowns && gameUw().ITowns.towns) || {})) {
          const safe = goldStableId(id);
          if (safe && !ids.includes(safe)) ids.push(safe);
        }
      } catch (_) {}
    }
    return ids;
  }
  function goldSeaId(townId, payload) {
    const direct = payload && goldStableId(payload.sea_id);
    if (direct) return direct;
    try {
      const town = gbTownModel(townId);
      const a = town && (town.attributes || town);
      const modelSea = goldStableId(a && a.sea_id);
      if (modelSea) return modelSea;
    } catch (_) {}
    return '';
  }
  function goldMarketKey(townId, payload) {
    const sea = goldSeaId(townId, payload);
    return sea ? 'sea:' + sea : 'town:' + String(townId);
  }
  function goldFindResultEnvelope(value, depth, seen) {
    if (value == null || (depth || 0) > 7) return null;
    let node = value;
    if (typeof node === 'string') {
      if (node.length > 262144) return null;
      try { node = JSON.parse(node); } catch (_) { return null; }
    }
    if (!goldPlainObject(node)) return null;
    const visited = seen || new Set();
    if (visited.has(node)) return null;
    visited.add(node);
    if (typeof node.result === 'string') return node;
    for (const key of ['json', 'data', 'response', 'plain']) {
      const found = goldFindResultEnvelope(node[key], (depth || 0) + 1, visited);
      if (found) return found;
    }
    return null;
  }
  function goldResultSuccess(value) {
    const envelope = goldFindResultEnvelope(value, 0, new Set());
    return envelope && String(envelope.result).toLowerCase() === 'success' ? envelope : null;
  }
  function goldFindMarket(value, depth, seen) {
    if (value == null || (depth || 0) > 8 || !goldPlainObject(value)) return null;
    const visited = seen || new Set();
    if (visited.has(value)) return null;
    visited.add(value);
    const item = key => goldPlainObject(value[key]);
    if (GB_RES_KEYS.every(key => {
      const row = item(key);
      return row && goldReadNumber(row.stock) != null && goldReadNumber(row.capacity) != null;
    })) return value;
    for (const child of Object.values(value)) {
      const found = goldFindMarket(child, (depth || 0) + 1, visited);
      if (found) return found;
    }
    return null;
  }
  function goldReadExchange(townId, onDone) {
    const action = goldAction('read');
    if (!action) return onDone && onDone('gold-read-action-unlearned');
    const key = goldMarketKey(townId);
    const hit = goldMarkets.get(key);
    if (hit && Date.now() - hit.at < GOLD_READ_FRESH_MS) return onDone && onDone(null, hit.payload, { cached:true });
    if (goldReadFlights.has(key)) { goldReadFlights.get(key).push(onDone); return; }
    goldReadFlights.set(key, [onDone]);
    const payload = { model_url:action.modelUrl, action_name:action.action, town_id:goldPositiveInt(townId), nl_init:true };
    if (payload.town_id == null) {
      goldReadFlights.delete(key);
      return onDone && onDone('gold-town-unreadable');
    }
    bridgeGet('goldread', payload, (err, response) => {
      let result = err || null;
      const market = !result ? goldFindMarket(response, 0, new Set()) : null;
      if (!result && !market) result = 'gold-market-unreadable';
      if (!result) {
        const actualKey = goldMarketKey(townId, market);
        const entry = { at:Date.now(), key:actualKey, payload:market };
        goldMarkets.set(key, entry);
        goldMarkets.set(actualKey, entry);
        const sea = goldSeaId(townId, market);
        if (gbTabLeader && sea && state.goldSeaByTown[String(townId)] !== sea) {
          const next = Object.assign({}, state.goldSeaByTown || {}, { [String(townId)]:sea });
          if (save(STORE.GOLD_SEAS, next)) state.goldSeaByTown = next;
        }
        goldStat('reads', 'market-read');
      } else goldStat('readErrors', result);
      const waiters = goldReadFlights.get(key) || [];
      goldReadFlights.delete(key);
      for (const fn of waiters) if (typeof fn === 'function') fn(result, market || null, { cached:false });
    });
  }
  function goldLiveResources(townId) {
    const stateNow = townResState(townId);
    if (!stateNow) return null;
    const out = {};
    for (const resource of GB_RES_KEYS) {
      const n = goldReadNumber(stateNow[resource]);
      if (n == null) return null;
      out[resource] = n;
    }
    return out;
  }
  function goldResourceLabel(resource) {
    return ({ wood:'madera', stone:'piedra', iron:'plata' })[resource] || resource;
  }
  function goldCandidate(townId, market) {
    if (!goldTownEnabled(townId)) return null;
    const resources = goldLiveResources(townId);
    if (!resources) return null;
    const candidates = [];
    for (const resource of GB_RES_KEYS) {
      const item = goldPlainObject(market && market[resource]);
      const stock = item && goldReadNumber(item.stock);
      const capacity = item && goldReadNumber(item.capacity);
      if (stock == null || capacity == null || capacity < stock) continue;
      const amount = Math.min(resources[resource], capacity - stock, goldBatch());
      if (amount >= GOLD_MIN_BATCH) candidates.push({ townId:String(townId), resource, amount:Math.floor(amount) });
    }
    candidates.sort((a, b) => b.amount - a.amount || a.resource.localeCompare(b.resource));
    return candidates[0] || null;
  }
  function goldSaleNormalize(raw) {
    const sale = goldPlainObject(raw);
    if (!sale) return null;
    const ownership = goldOwnership();
    const stateName = goldText(sale.state, 40);
    const id = goldStableId(sale.id);
    const townId = goldStableId(sale.townId);
    const resource = goldText(sale.resource, 12);
    const amount = goldPositiveInt(sale.offeredAmount);
    const gold = goldPositiveInt(sale.offeredGold);
    if (!id || !townId || !GB_RES_KEYS.includes(resource) || !amount || !gold || !GOLD_STATES.has(stateName)) return null;
    if (!ownership || goldText(sale.world, 120) !== ownership.world || goldText(sale.owner, 120) !== ownership.player) return null;
    return {
      v:1, id, state:stateName, world:ownership.world, owner:ownership.player, townId, resource,
      offeredAmount:amount, offeredGold:gold, requestedAmount:goldPositiveInt(sale.requestedAmount) || amount,
      expiresAt:goldReadNumber(sale.expiresAt) || 0, createdAt:goldReadNumber(sale.createdAt) || 0,
      updatedAt:goldReadNumber(sale.updatedAt) || 0, serverAckAt:goldReadNumber(sale.serverAckAt) || 0,
      unknownAt:goldReadNumber(sale.unknownAt) || 0, reason:goldText(sale.reason, 160),
    };
  }
  function goldSaleCurrent() {
    const sale = goldSaleNormalize(state.goldSale);
    if (sale) return sale;
    if (state.goldSale) {
      gbLogT('gold-sale-owner', 60000, 'gold: pending sale is unreadable or belongs to another world/player; blocked');
    }
    return null;
  }
  function goldPersistSale(raw) {
    if (!gbTabLeader) return false;
    const sale = raw == null ? null : goldSaleNormalize(raw);
    if (raw != null && !sale) return false;
    if (!save(STORE.GOLD_SALE, sale)) return false;
    state.goldSale = sale;
    return true;
  }
  function goldNewSale(candidate, offer) {
    const ownership = goldOwnership();
    if (!ownership) return null;
    const now = Date.now();
    const offeredAt = goldReadNumber(offer.offeredAt) || now;
    const expiresAt = Math.min(now + GOLD_OFFER_TTL_MS, Math.max(now + 1000, offeredAt + GOLD_OFFER_TTL_MS));
    return {
      v:1, id:'gold-' + now.toString(36) + '-' + Math.random().toString(36).slice(2, 8), state:'OFFER_RECEIVED',
      world:ownership.world, owner:ownership.player, townId:String(candidate.townId), resource:candidate.resource,
      offeredAmount:offer.amount, offeredGold:offer.gold, requestedAmount:candidate.amount,
      expiresAt, createdAt:now, updatedAt:now, serverAckAt:0, unknownAt:0, reason:'quote-received',
    };
  }
  function goldUpdateSale(sale, patch) {
    const next = Object.assign({}, sale, patch || {}, { updatedAt:Date.now() });
    return goldPersistSale(next) ? goldSaleCurrent() : null;
  }
  function goldLockSale(sale) {
    const name = `gold:${sale.townId}:${sale.resource}`;
    const token = gbLock(name);
    if (token) goldLocks.set(sale.id, { name, token });
    return token;
  }
  function goldUnlockSale(sale) {
    const held = sale && goldLocks.get(sale.id);
    if (!held) return;
    gbUnlock(held.name, held.token);
    goldLocks.delete(sale.id);
  }
  function goldOfferValidate(response, candidate) {
    const envelope = goldResultSuccess(response);
    const offer = envelope && goldPlainObject(envelope.offer);
    if (!offer || goldText(offer.type, 20) !== 'sell') return { ok:false, why:'gold-offer-envelope-invalid' };
    if (offer.town_id != null && String(offer.town_id) !== String(candidate.townId)) return { ok:false, why:'gold-offer-town-mismatch' };
    const resource = goldText(offer.resource_type, 12);
    const amount = goldPositiveInt(offer.resource_amount);
    const gold = goldPositiveInt(offer.gold);
    const mac = goldText(offer.mac != null ? offer.mac : envelope.mac, GOLD_MAX_MAC_CHARS);
    const explicitChallenge = offer.captcha_required;
    if (resource !== candidate.resource || !amount || amount > candidate.amount || !gold) return { ok:false, why:'gold-offer-amount-mismatch' };
    if (typeof explicitChallenge !== 'boolean') return { ok:false, why:'gold-offer-captcha-unreadable' };
    if (!mac || mac.length > GOLD_MAX_MAC_CHARS || (offer.mac && envelope.mac && offer.mac !== envelope.mac)) return { ok:false, why:'gold-offer-token-invalid' };
    let offeredAt = Date.now();
    const rawTime = goldReadNumber(offer.offered_at);
    if (rawTime != null) offeredAt = rawTime < 1000000000000 ? rawTime * 1000 : rawTime;
    if (Math.abs(Date.now() - offeredAt) > GOLD_OFFER_TTL_MS) return { ok:false, why:'gold-offer-expired' };
    return { ok:true, amount, gold, mac, offeredAt, captcha:explicitChallenge };
  }
  function goldArchiveReview(sale, reason) {
    const current = sale || goldSaleCurrent();
    if (!current) return false;
    const review = Object.assign({}, current, { state:'MANUAL_REVIEW', unknownAt:Date.now(), updatedAt:Date.now(), reason:goldText(reason, 160) });
    const reviews = Object.assign({}, goldPlainObject(state.goldReviews) || {}, { [review.id]:review });
    if (!save(STORE.GOLD_REVIEWS, reviews)) return false;
    state.goldReviews = reviews;
    goldQuoteSecrets.delete(review.id);
    goldUnlockSale(review);
    return goldPersistSale(review);
  }
  function goldClearSale(sale) {
    if (sale) { goldQuoteSecrets.delete(sale.id); goldUnlockSale(sale); }
    return goldPersistSale(null);
  }
  function goldTxSnapshot(townId, args) {
    const sale = goldSaleCurrent();
    const resource = GB_RES_KEYS.find(key => goldPositiveInt(args && args[key])) || null;
    if (!sale || String(sale.townId) !== String(townId) || resource !== sale.resource) return { kind:'gold', saleId:null };
    return { kind:'gold', saleId:sale.id, resource, amount:goldPositiveInt(args[resource]), offerGold:goldPositiveInt(args.gold), owner:sale.owner, world:sale.world };
  }
  function goldOfferTxSnapshot(townId, args) {
    const sale = goldSaleCurrent();
    const resource = GB_RES_KEYS.find(key => goldPositiveInt(args && args[key])) || null;
    const amount = resource ? goldPositiveInt(args[resource]) : null;
    if (!sale || sale.state !== 'REQUESTING_OFFER' || String(sale.townId) !== String(townId)
      || resource !== sale.resource || amount !== sale.requestedAmount) return { kind:'goldoffer', saleId:null, resource, amount, gold:goldPositiveInt(args && args.gold) };
    return { kind:'goldoffer', saleId:sale.id, resource, amount, gold:goldPositiveInt(args && args.gold), owner:sale.owner, world:sale.world };
  }
  function goldTxProbeEvidence(tx) {
    const snapshot = tx && tx.snapshot;
    const sale = goldSaleCurrent();
    if (!snapshot || !sale || !snapshot.saleId || snapshot.saleId !== sale.id) return 'unknown';
    // A specific server acknowledgement is the only success evidence. Resource
    // deltas and exchange stock are shared/inconclusive and never prove a sale.
    return sale.serverAckAt > 0 ? 'applied' : 'unknown';
  }
  // A fresh, in-page quote gets a tiny fairness window before another feature
  // consumes its exact town/resource. It is not persisted as a reservation:
  // reload, CAPTCHA, UNKNOWN and a missing quote secret release it immediately.
  function goldConsumerGate(intent, townId, need) {
    if (/^gold(?:offer)?[:]/.test(String(intent || ''))) return null;
    const sale = goldSaleCurrent();
    if (!sale || sale.state !== 'OFFER_RECEIVED' || !goldQuoteSecrets.has(sale.id)) return null;
    if (String(sale.townId) !== String(townId) || Date.now() >= sale.expiresAt) return null;
    const amount = goldReadNumber(need && need[sale.resource]);
    if (!(amount > 0)) return null;
    const until = Math.min(sale.expiresAt, (sale.updatedAt || Date.now()) + GOLD_CONSUMER_HOLD_MS);
    return until > Date.now() ? { why:`gold-hold:${sale.resource}`, until } : null;
  }
  function goldArgsResource(args) {
    const a = goldPlainObject(args);
    if (!a) return null;
    let found = null;
    for (const resource of GB_RES_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(a, resource)) continue;
      const amount = goldPositiveInt(a[resource]);
      if (amount == null || found) return null;
      found = { resource, amount };
    }
    return found;
  }
  // Narrow live-write validation for this subsystem only. It supplements the
  // shared tx guards without changing the established premium feature policy.
  function goldTransportGuard(feature, transport, data) {
    if (feature !== 'gold' && feature !== 'goldoffer') return null;
    // Dry run is intentionally permitted through txRun so its harmless log and
    // journal path stays covered by the shared write harness.
    if (state.dryRun) return null;
    if (!gbTabLeader || !goldEnabled() || transport !== 'bridge') return 'gold-disabled-or-follower';
    const p = goldPlainObject(data);
    const args = p && goldPlainObject(p.arguments);
    const row = goldArgsResource(args);
    const sale = goldSaleCurrent();
    const action = goldAction(feature === 'gold' ? 'confirm' : 'offer');
    if (!p || !args || !row || !sale || !action || goldText(p.model_url, 80) !== action.modelUrl
      || goldText(p.action_name, 120) !== action.action || goldPositiveInt(p.town_id) == null
      || String(p.town_id) !== String(sale.townId) || !goldTownEnabled(sale.townId)
      || args.type !== 'sell' || Date.now() >= sale.expiresAt) return 'gold-payload-invalid';
    const live = goldLiveResources(sale.townId);
    if (!live || live[row.resource] < row.amount) return 'gold-resource-unreadable';
    if (feature === 'goldoffer') {
      return sale.state === 'REQUESTING_OFFER' && row.resource === sale.resource
        && row.amount === sale.requestedAmount && goldPositiveInt(args.gold) === 1
        && !Object.prototype.hasOwnProperty.call(args, 'mac') ? null : 'gold-offer-state-invalid';
    }
    const quote = goldQuoteSecrets.get(sale.id);
    return sale.state === 'CONFIRMING' && quote && row.resource === sale.resource
      && row.amount === sale.offeredAmount && goldPositiveInt(args.gold) === sale.offeredGold
      && args.mac === quote.mac && args.offer_source === 'main' ? null : 'gold-confirm-state-invalid';
  }
  function goldConfirmOffer(sale) {
    const current = goldSaleCurrent();
    const quote = sale && goldQuoteSecrets.get(sale.id);
    if (!current || !sale || current.id !== sale.id || !quote) return goldArchiveReview(sale, 'quote-secret-lost');
    if (!goldEnabled() || !gbTabLeader || !goldAction('confirm') || !goldTownEnabled(sale.townId)) return goldClearSale(sale);
    if (Date.now() >= sale.expiresAt) { goldClearSale(sale); return false; }
    const live = goldLiveResources(sale.townId);
    if (!live || live[sale.resource] < sale.offeredAmount) return goldArchiveReview(sale, 'resource-changed-before-confirm');
    const action = goldAction('confirm');
    const args = { type:'sell', gold:sale.offeredGold, mac:quote.mac, offer_source:'main', [sale.resource]:sale.offeredAmount };
    const payload = { model_url:action.modelUrl, action_name:action.action, arguments:args, town_id:goldPositiveInt(sale.townId), nl_init:true };
    if (payload.town_id == null || !goldUpdateSale(sale, { state:'CONFIRMING', reason:'confirm-dispatched' })) return false;
    goldStat('confirms', 'confirm');
    bridgePost('gold', payload, (err, response) => {
      if (!gbTabLeader) return;
      const nowSale = goldSaleCurrent();
      if (!nowSale || nowSale.id !== sale.id) return;
      if (!err && goldResultSuccess(response)) {
        const acknowledged = goldUpdateSale(nowSale, { state:'CONFIRMING', serverAckAt:Date.now(), reason:'server-confirmed' });
        if (!acknowledged) return;
        goldStat('confirmed', 'server-confirmed');
        goldClearSale(acknowledged);
        whyNote('gold', 'PremiumExchange/confirmOffer', 'ok', 'server-acknowledged');
        return;
      }
      if (err === 'dryrun') return goldClearSale(nowSale);
      if (err === 'captcha' || err === 'captcha-pause') {
        goldStat('captcha', 'confirm-captcha');
        return goldArchiveReview(nowSale, 'confirm-captcha');
      }
      if (err === 'timeout' || err === 'neterr' || err === 'cancelled' || err === 'unknown') {
        goldStat('unknown', 'confirm-uncertain');
        return goldArchiveReview(nowSale, 'confirm-uncertain');
      }
      // A guard may reject before dispatch. Drop the quote instead of leaving
      // an auto-retry path: a reload can never reuse its session-only secret.
      if (/^(disabled|paused|budget|circuit-open|first-post-confirm|safe-mode)/.test(String(err)) && Date.now() < nowSale.expiresAt) {
        return goldClearSale(nowSale);
      }
      goldArchiveReview(nowSale, 'confirm-error:' + goldText(err, 80));
    });
    return true;
  }
  function goldBeginOffer(candidate) {
    if (!candidate || !goldEnabled() || !gbTabLeader || !goldActionsReady(true)) return false;
    const ownership = goldOwnership();
    const action = goldAction('offer');
    if (!ownership || !action || goldSaleCurrent()) return false;
    const draft = {
      v:1, id:'gold-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8), state:'REQUESTING_OFFER',
      world:ownership.world, owner:ownership.player, townId:String(candidate.townId), resource:candidate.resource,
      offeredAmount:candidate.amount, offeredGold:1, requestedAmount:candidate.amount,
      expiresAt:Date.now() + GOLD_OFFER_TTL_MS, createdAt:Date.now(), updatedAt:Date.now(), serverAckAt:0, unknownAt:0, reason:'offer-requested',
    };
    if (!goldPersistSale(draft) || !goldLockSale(draft)) { goldClearSale(draft); return false; }
    const args = { type:'sell', gold:1, [candidate.resource]:candidate.amount };
    const payload = { model_url:action.modelUrl, action_name:action.action, arguments:args, town_id:goldPositiveInt(candidate.townId), nl_init:true };
    if (payload.town_id == null) { goldClearSale(draft); return false; }
    goldStat('offers', 'request-offer');
    bridgePost('goldoffer', payload, (err, response) => {
      if (!gbTabLeader) return;
      const sale = goldSaleCurrent();
      if (!sale || sale.id !== draft.id) return;
      if (err === 'dryrun') return goldClearSale(sale);
      if (err) {
        if (err === 'captcha' || err === 'captcha-pause') { goldStat('captcha', 'offer-captcha'); return goldArchiveReview(sale, 'offer-captcha'); }
        if (err === 'timeout' || err === 'neterr' || err === 'cancelled' || err === 'unknown') { goldStat('unknown', 'offer-uncertain'); return goldArchiveReview(sale, 'offer-uncertain'); }
        goldStat('rejected', err); goldClearSale(sale); return;
      }
      const checked = goldOfferValidate(response, candidate);
      if (!checked.ok) { goldStat('rejected', checked.why); goldClearSale(sale); return; }
      const next = goldNewSale(candidate, checked);
      if (!next || !goldPersistSale(next)) { goldClearSale(sale); return; }
      goldQuoteSecrets.set(next.id, { mac:checked.mac });
      goldUnlockSale(sale);
      goldLockSale(next);
      if (checked.captcha) { goldStat('captcha', 'offer-captcha-flag'); return goldUpdateSale(next, { state:'CAPTCHA_PENDING', reason:'offer-captcha' }); }
      goldConfirmOffer(next);
    });
    return true;
  }
  function goldReviewResolve(id) {
    const key = goldStableId(id);
    const review = key && goldPlainObject(state.goldReviews) && state.goldReviews[key];
    if (!review || !gbTabLeader) return false;
    const normalized = goldSaleNormalize(review);
    if (!normalized || !/^(UNKNOWN|MANUAL_REVIEW|CAPTCHA_PENDING)$/.test(normalized.state)) return false;
    const next = Object.assign({}, state.goldReviews, { [key]:Object.assign({}, normalized, { state:'REVIEWED', updatedAt:Date.now(), reason:'explicit-user-review' }) });
    if (!save(STORE.GOLD_REVIEWS, next)) return false;
    state.goldReviews = next;
    const live = goldSaleCurrent();
    if (live && live.id === key) goldClearSale(live);
    // Never replay a reviewed sale. Give later discovery a bounded cooldown.
    state.goldLast = Object.assign({}, goldPlainObject(state.goldLast) || {}, { nextAt:Date.now() + GOLD_CONFIRM_RETRY_COOLDOWN_MS });
    save(STORE.GOLD_LAST, state.goldLast);
    return true;
  }
  function goldPendingBlocked() {
    const sale = goldSaleCurrent();
    if (!sale) return false;
    if (sale.state === 'OFFER_RECEIVED' && Date.now() >= sale.expiresAt) {
      goldClearSale(sale);
      return false;
    }
    if (sale.state === 'OFFER_RECEIVED' && !goldQuoteSecrets.has(sale.id)) {
      goldArchiveReview(sale, 'quote-secret-lost-after-reload');
      return true;
    }
    if (/^(REQUESTING_OFFER|CONFIRMING|CAPTCHA_PENDING|UNKNOWN)$/.test(sale.state) && !goldLocks.has(sale.id)) {
      goldArchiveReview(sale, 'pending-sale-without-live-owner');
      return true;
    }
    return sale.state !== 'REVIEWED';
  }
  // A promoted tab has no in-memory quote secret or lock token from its
  // predecessor. Classify any such active sale for explicit review before the
  // scheduler can consider another candidate; it can never replay the send.
  function goldRecoverLeaderPending(reason) {
    if (!gbTabLeader) return false;
    const sale = goldSaleCurrent();
    if (!sale) return false;
    if (sale.state === 'OFFER_RECEIVED' && goldQuoteSecrets.has(sale.id)) return false;
    if (sale.state === 'MANUAL_REVIEW' || sale.state === 'REVIEWED') return false;
    return goldArchiveReview(sale, 'leader-recovery:' + goldText(reason, 80));
  }
  function goldScan(reason) {
    if (!goldEnabled() || !gbTabLeader) return false;
    if (goldPendingBlocked()) return false;
    const last = goldPlainObject(state.goldLast) || {};
    const nextAt = goldReadNumber(last.nextAt) || 0;
    if (nextAt > Date.now()) return false;
    if (!goldActionsReady(false)) {
      markModuleHealth('gold', 'skip', { error:'PremiumExchange action not learned from manual traffic' });
      return false;
    }
    const towns = goldTownIds();
    if (!towns.length) return false;
    const townId = towns[goldScanCursor++ % towns.length];
    goldReadExchange(townId, (err, market) => {
      if (err || !market || !goldEnabled() || goldPendingBlocked()) return;
      const candidate = goldCandidate(townId, market);
      if (!candidate || !goldActionsReady(true)) return;
      goldBeginOffer(candidate);
    });
    return true;
  }
  function goldDiagnosticSnapshot() {
    const sale = goldSaleCurrent();
    const reviews = goldPlainObject(state.goldReviews) || {};
    const actions = goldActionRoot();
    return gbRedact({
      enabled:goldEnabled(), learned:{ read:!!actions.read, offer:!!actions.offer, confirm:!!actions.confirm },
      permittedTowns:Object.keys(state.goldTowns || {}).filter(id => state.goldTowns[id] === true).length,
      sale:sale, reviews:Object.values(reviews).map(row => ({ id:row.id, state:row.state, townId:row.townId, resource:row.resource, updatedAt:row.updatedAt })),
      markets:Array.from(goldMarkets.values()).map(row => ({ key:row.key, at:row.at })), stats:goldStatsRoot(),
    }, { maxDepth:5, maxEntries:100, maxString:160 });
  }
  function goldRenderConfig(sec) {
    if (!sec) return;
    const status = sec.querySelector('#gb-gold-status');
    if (status) {
      const sale = goldSaleCurrent();
      const learned = goldActionsReady(true) ? 'acciones aprendidas' : 'pulsa leer/solicitar/confirmar a mano para aprender las acciones';
      status.textContent = sale ? `Venta ${sale.state}: ${sale.offeredAmount} ${goldResourceLabel(sale.resource)} -> ${sale.offeredGold} oro` : learned;
    }
    const host = sec.querySelector('.gold-towns');
    if (!host) return;
    const ids = goldTownIds();
    const key = ids.join(',');
    if (host.dataset.goldTownsKey === key) return;
    host.replaceChildren();
    host.dataset.goldTownsKey = key;
    if (!ids.length) { host.textContent = 'No se pueden leer ciudades propias.'; return; }
    for (const id of ids) {
      const label = document.createElement('label');
      label.className = 'gb-cfg-row gb-cfg-sub';
      const input = document.createElement('input');
      input.type = 'checkbox'; input.checked = goldTownEnabled(id); input.dataset.goldTown = id;
      input.addEventListener('change', () => {
        const next = Object.assign({}, state.goldTowns || {}, { [id]:input.checked === true });
        if (save(STORE.GOLD_TOWNS, next)) state.goldTowns = next;
        else input.checked = goldTownEnabled(id);
        goldRenderConfig(sec);
      });
      label.appendChild(input);
      label.appendChild(document.createTextNode(' Permitir venta GOLD en ciudad ' + id));
      host.appendChild(label);
    }
  }
  function goldBindConfig(sec, bindNow) {
    if (!sec) return;
    const enabled = sec.querySelector('[data-cfg=gold-enabled]');
    if (enabled) enabled.checked = goldEnabled();
    const batch = sec.querySelector('[data-cfg=gold-batch]');
    if (batch) batch.value = goldBatch();
    if (bindNow && enabled) enabled.addEventListener('change', () => {
      const next = enabled.checked === true;
      if (save(STORE.GOLD_ENABLED, next)) state.goldEnabled = next;
      else enabled.checked = goldEnabled();
      goldRenderConfig(sec);
    });
    if (bindNow && batch) batch.addEventListener('change', () => {
      const n = goldPositiveInt(batch.value);
      const next = n == null ? 10000 : Math.max(GOLD_MIN_BATCH, Math.min(1000000, n));
      if (save(STORE.GOLD_BATCH, next)) state.goldBatch = next;
      batch.value = goldBatch();
    });
    if (bindNow) sec.querySelector('[data-cfg=gold-review]')?.addEventListener('click', () => {
      const rows = Object.values(goldPlainObject(state.goldReviews) || {}).filter(r => r && /^(UNKNOWN|MANUAL_REVIEW|CAPTCHA_PENDING)$/.test(String(r.state || '')));
      if (!rows.length) { flash('No hay ventas GOLD para revisar'); return; }
      const id = prompt('ID de venta GOLD revisada:\n' + rows.map(r => `${r.id} (${r.state})`).join('\n'), rows[0].id);
      if (!id) return;
      if (!confirm('Cerrar esta venta como revisada sin repetir la confirmacion?')) return;
      flash(goldReviewResolve(id) ? 'Venta GOLD marcada como revisada' : 'No se pudo cerrar la venta GOLD');
      goldRenderConfig(sec);
    });
    goldRenderConfig(sec);
  }
