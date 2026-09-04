  let farmRelLogSig = '';
  function farmRelationCol() {
    return mmCol('FarmTownPlayerRelation');
  }
  function farmBelongsToPlayer(r, attrs) {
    try {
      if (typeof r.belongsToPlayer === 'function') return !!r.belongsToPlayer();
    } catch (_) {}
    const s = attrs.relation_status;
    return s != null && s > 0;
  }
  function farmIsLootable(r, attrs) {
    try {
      if (typeof r.isLootable === 'function') return !!r.isLootable();
    } catch (_) {}
    const at = attrs && attrs.lootable_at;
    if (at == null) return true;
    return gameNow() >= at;
  }

  const FARM_CLAIM_WAKE_GRACE_MS = 1500;
  const FARM_CLAIM_READY_WAKE_MS = 750;
  const FARM_CLAIM_READY_RETRY_MS = 5000;
  const FARM_NOT_READY_RETRY_MS = 30000;
  // Fixed inter-village spacing for a ready sweep. Budget-derived spacing used
  // to stretch past 1.5s and the hard req budget aborted mid-batch → large
  // accounts only claimed ~half the ready set each 10–13 min cycle.
  const FARM_CLAIM_SPACING_MS = 1500;
  const FARM_CLAIM_CAPTCHA_WAIT_MS = 2000;
  const FARM_CLAIM_VERIFY_MS = 3000;
  let farmClaimWakeTimer = 0, farmClaimWakeAt = 0;
  function farmClaimTiming(farmsArg) {
    const farms = Array.isArray(farmsArg) ? farmsArg : (farmsFromGame() || []);
    const now = gameNow();
    let ready = 0, nextAt = Infinity, expiredModelWait = 0;
    for (const f of farms) {
      if (!f) continue;
      const at = f.lootable_at == null ? null : +f.lootable_at;
      let modelReady = null;
      if (f._rel) {
        try { if (typeof f._rel.isLootable === 'function') modelReady = !!f._rel.isLootable(); } catch (_) {}
      }
      if (modelReady === true || (modelReady == null && (at == null || at <= now))) ready++;
      if (Number.isFinite(at) && at > now) nextAt = Math.min(nextAt, at);
      else if (Number.isFinite(at) && at <= now && modelReady === false) expiredModelWait++;
    }
    return { now, ready, nextAt, expiredModelWait, total: farms.length };
  }
  function farmCancelClaimWake() {
    if (farmClaimWakeTimer) gbClearTimeout(farmClaimWakeTimer);
    farmClaimWakeTimer = 0; farmClaimWakeAt = 0;
  }
  function farmScheduleClaimWake(farmsArg, reason, allowExpiredRetry) {
    if (!state.autoFarm || !hostEnabled()) { farmCancelClaimWake(); return null; }
    const t = farmClaimTiming(farmsArg);
    let targetMs = 0;

    if (allowExpiredRetry && t.ready > 0) {
      const delay = gbLocked('claim') || reason === 'post-claim' ? FARM_CLAIM_READY_RETRY_MS : FARM_CLAIM_READY_WAKE_MS;
      targetMs = Date.now() + delay;
    } else if (Number.isFinite(t.nextAt)) {
      targetMs = Date.now() + Math.max(0, (t.nextAt - t.now) * 1000) + FARM_CLAIM_WAKE_GRACE_MS;
    } else if (allowExpiredRetry && t.expiredModelWait > 0) {
      targetMs = Date.now() + FARM_CLAIM_READY_RETRY_MS;
    }
    if (!targetMs) return null;

    if (farmClaimWakeTimer && farmClaimWakeAt && farmClaimWakeAt <= targetMs + 1000) return farmClaimWakeAt;
    farmCancelClaimWake();
    farmClaimWakeAt = targetMs;
    state.nextFarmClaim = targetMs;
    try { save(STORE.NEXT_FARM_CLAIM, state.nextFarmClaim); } catch (_) {}
    const delay = Math.max(250, targetMs - Date.now());
    farmClaimWakeTimer = gbTimeout(() => {
      farmClaimWakeTimer = 0; farmClaimWakeAt = 0;
      if (!gbInstanceAlive() || !state.autoFarm || !hostEnabled()) return;
      if (automationPaused({}) || captchaPaused('farm')) { farmScheduleClaimWake(null, 'paused-retry', true); return; }
      if (gbLocked('claim')) { farmScheduleClaimWake(null, 'claim-inflight-retry', true); return; }
      const liveTiming = farmClaimTiming();
      const wakeKind = liveTiming.ready > 0 ? 'ready wake' : 'deadline wake';
      gbLogT('farm-deadline-wake', 5000, `farm claim: ${wakeKind}${reason ? ' (' + reason + ')' : ''}`);
      autoClaimFarms('deadline');
    }, delay);
    return targetMs;
  }
  function farmScheduleNotReadyWake(farm) {
    const now = gameNow();
    const candidates = [];
    const add = value => { const n=gbNum(value); if(n!=null&&n>now)candidates.push(n); };
    try { add(farm && farm.lootable_at); } catch (_) {}
    try { add(farm && farm._rel && farm._rel.attributes && farm._rel.attributes.lootable_at); } catch (_) {}
    try { const live=txFarmStatus(farm && farm.vill_id); add(live && live.lootableAt); } catch (_) {}
    const nextAt = candidates.length ? Math.min.apply(Math, candidates) : now + FARM_NOT_READY_RETRY_MS / 1000;
    // A synthetic timing row avoids trusting a stale isLootable() flag after
    // the server has authoritatively rejected the claim.
    return farmScheduleClaimWake([{ lootable_at:nextAt }], 'server-not-ready', false);
  }
  function farmsFromGame() {
    try {
      const uw = uwCached();
      if (!uw.MM) return null;
      const relCol = farmRelationCol();
      const farmCol = mmCol('FarmTown');
      if (!relCol) return null;
      if (!Array.isArray(relCol.models) || !relCol.models.length) {
        gbLogT('farm-rel-loading', 120000, 'farm relations: waiting for game collection');
        return null;
      }
      const farmById = {};
      ((farmCol && farmCol.models) || []).forEach(m => { const a = m.attributes || {}; farmById[a.id] = { attrs:a, model:m }; });
      const out = [];
      const statusCount = {};
      let noRelId = 0;
      relCol.models.forEach(r => {
        const a = r.attributes || {};
        statusCount[a.relation_status] = (statusCount[a.relation_status] || 0) + 1;
        if (!farmBelongsToPlayer(r, a)) return;
        const relId = r.id ?? a.id;
        if (relId == null) { noRelId++; return; }
        const frow = farmById[a.farm_town_id] || {};
        const f = frow.attrs || {};
        const farmModel = frow.model || null;
        const islandId = farmModelIslandId(farmModel, f) || resolveIslandIdByCoords(f.island_x, f.island_y);
        out.push({
          vill_id: String(a.farm_town_id),
          relation_id: relId,
          x: f.island_x ?? null,
          y: f.island_y ?? null,
          island_id: islandId,
          lootable_at: a.lootable_at ?? null,
          name: f.name || null,
          fromGame: true,
          _rel: r,
          _attrs: a,
        });
      });
      const relSig = [relCol.models.length, out.length, noRelId,
        Object.keys(statusCount).sort().map(k => `${k}:${statusCount[k]}`).join(',')].join('|');
      if (relSig !== farmRelLogSig) {
        farmRelLogSig = relSig;
        gbLog(`farm relations: ${relCol.models.length} total, statuses ${JSON.stringify(statusCount)}, controlled ${out.length}${noRelId ? `, ${noRelId} missing relation id` : ''}`);
      }
      return out;
    } catch (e) { gbLogT('farmsFromGame', 60000, 'farmsFromGame fail', String(e)); return null; }
  }
  function mergedFarms() {
    const game=farmsFromGame();
    const manual=parseFarms(state.farms);
    if(game==null){
      // Collection not loaded/unreadable is NOT proof that the player has zero
      // farms. Preserve the last known list and never prune persisted maps.
      const prior=Array.isArray(state.farmsParsed)?state.farmsParsed:[];
      const seen=new Set(prior.map(f=>f&&f.vill_id).filter(Boolean));
      return {known:false,list:prior.concat(manual.filter(f=>!seen.has(f.vill_id)))};
    }
    const seen=new Set(game.map(f=>f.vill_id));
    return {known:true,list:game.concat(manual.filter(f=>!seen.has(f.vill_id)))};
  }
  let farmsParsedSig = null;
  function refreshFarmsParsed() {
    const merged=mergedFarms();
    if(!merged||!merged.known){
      if(merged&&Array.isArray(merged.list)&&merged.list.length)state.farmsParsed=merged.list;
      gbLogT('farm-discovery-unreadable',60000,'farm discovery: game collection not ready; preserving persisted farm state');
      return false;
    }
    state.farmsParsed=merged.list;
    const sig=JSON.stringify(state.farmsParsed);
    if(sig===farmsParsedSig)return true;
    farmsParsedSig=sig;
    // Only the leader persists authoritative discovery state.
    if(gbTabLeader){
      save(STORE.FARMS_PARSED,state.farmsParsed);
      const ids=state.farmsParsed.map(f=>f.vill_id);
      if(pruneMapsToIds(state.farmResources,ids))save(STORE.FARM_RES,state.farmResources);
      if(pruneMapsToIds(state.alerted,ids))save(STORE.ALERTED,state.alerted);
      if(pruneMapsToIds(state.thresholds,ids))save(STORE.THRESH,state.thresholds);
      if(pruneMapsToIds(state.farmProfit,ids))save(STORE.FARM_PROFIT,state.farmProfit);
    }
    return true;
  }
  function islandTownMap() {
    const map = Object.create(null);
    const uw = uwCached();
    try {
      const towns = uw.ITowns && uw.ITowns.towns;
      if (!towns) return map;
      for (const tid of Object.keys(towns)) {
        const t = towns[tid];
        let x = null, y = null;
        try {
          if (t.getIslandCoordinateX) x = t.getIslandCoordinateX();
          if (t.getIslandCoordinateY) y = t.getIslandCoordinateY();
        } catch (_) {}
        if (x == null || y == null) continue;
        const keys = [x + ',' + y];
        try {
          const islandId = typeof t.getIslandId === 'function' ? t.getIslandId() : (t.attributes && t.attributes.island_id);
          if (islandId != null) keys.push(String(islandId));
        } catch (_) {}
        keys.forEach(key => {
          if (!Array.isArray(map[key])) map[key] = [];
          if (!map[key].includes(String(tid))) map[key].push(String(tid));
        });
      }
    } catch (_) {}
    return map;
  }
  function townCanonicalIslandId(townId) {
    try {
      const t = gbTownModel(townId);
      const id = t && (typeof t.getIslandId === 'function' ? t.getIslandId() : t.attributes && t.attributes.island_id);
      return id != null && String(id) !== '' ? String(id) : null;
    } catch (_) { return null; }
  }
  function townIslandKey(townId) {
    const canonical = townCanonicalIslandId(townId);
    if (canonical != null) return canonical;
    const p = ruralTownIslandXY(townId);
    return p && p.x != null && p.y != null ? String(p.x) + ',' + String(p.y) : null;
  }
  function farmModelIslandId(model, attrs) {
    try {
      for (const fn of ['getIslandId', 'getIslandID']) {
        if (model && typeof model[fn] === 'function') {
          const v = model[fn]();
          if (v != null && String(v) !== '') return String(v);
        }
      }
    } catch (_) {}
    const a = (model && model.attributes) || attrs || {};
    for (const key of ['island_id', 'islandId', 'island']) {
      if (a[key] != null && String(a[key]) !== '') return String(a[key]);
    }
    return null;
  }
  function resolveIslandIdByCoords(x, y) {
    if (x == null || y == null) return null;
    try {
      const towns = gameUw().ITowns && gameUw().ITowns.towns || {};
      const ids = new Set();
      for (const tid of Object.keys(towns)) {
        const t = towns[tid];
        let tx = null, ty = null;
        try { tx = typeof t.getIslandCoordinateX === 'function' ? t.getIslandCoordinateX() : (t.attributes && t.attributes.island_x); } catch (_) {}
        try { ty = typeof t.getIslandCoordinateY === 'function' ? t.getIslandCoordinateY() : (t.attributes && t.attributes.island_y); } catch (_) {}
        if (String(tx) !== String(x) || String(ty) !== String(y)) continue;
        const id = townCanonicalIslandId(tid);
        if (id != null) ids.add(String(id));
      }
      return ids.size === 1 ? [...ids][0] : null;
    } catch (_) { return null; }
  }
  function farmIslandContext(farm, islandMap) {
    if (!farm) return { known:false, key:null, ids:[], coordsKey:null, reason:'farm-unreadable' };
    const map = islandMap || islandTownMap();
    const coordsKey = farm.x != null && farm.y != null ? String(farm.x) + ',' + String(farm.y) : null;
    const directKey = farm.island_id != null && String(farm.island_id) !== '' ? String(farm.island_id) : null;
    let ids = [];
    const add = raw => {
      const list = Array.isArray(raw) ? raw : (raw != null ? [raw] : []);
      for (const id of list.map(String)) if (!ids.includes(id)) ids.push(id);
    };
    if (directKey) add(map[directKey]);
    if (coordsKey) add(map[coordsKey]);
    const derived = new Set(ids.map(townCanonicalIslandId).filter(Boolean).map(String));
    let key = directKey;
    if (derived.size > 1) return { known:false, key:null, ids, coordsKey, reason:'island-id-ambiguous' };
    if (derived.size === 1) {
      const only = [...derived][0];
      if (key && key !== only) return { known:false, key:null, ids, coordsKey, reason:'island-id-conflict' };
      key = only;
      add(map[key]);
    }
    if (!key && coordsKey) key = resolveIslandIdByCoords(farm.x, farm.y);
    if (key) add(map[key]);
    if (!ids.length && coordsKey) add(map[coordsKey]);
    const anyConfigured = !!Object.keys(state.islandBeneficiaries || {}).length;
    if (!key && anyConfigured) return { known:false, key:null, ids, coordsKey, reason:'canonical-island-unreadable' };
    return { known:ids.length > 0, key:key || null, ids, coordsKey, reason:ids.length ? '' : 'same-island-towns-unreadable' };
  }
  function farmIslandKey(farm) {
    const ctx = farmIslandContext(farm, islandTownMap());
    return ctx && ctx.key ? String(ctx.key) : null;
  }
  function resolveIslandResourceBeneficiary(islandKey, sameIslandTownIds) {
    const ids = [...new Set((sameIslandTownIds || []).map(String).filter(Boolean))];
    if (!ids.length) return { known:false, townId:null, reason:'same-island-towns-unreadable' };
    const cfg = islandKey && state.islandBeneficiaries && state.islandBeneficiaries[String(islandKey)];
    const selected = cfg && cfg.resource;
    if (selected != null && selected !== 'auto') {
      return ids.includes(String(selected))
        ? { known:true, townId:String(selected), explicit:true, reason:'configured' }
        : { known:false, townId:null, explicit:true, reason:'configured-resource-beneficiary-invalid' };
    }
    if (!islandKey && Object.keys(state.islandBeneficiaries || {}).length) {
      return { known:false, townId:null, reason:'canonical-island-unreadable' };
    }
    const readable = ids.map(id => {
      const st = townWarehouseState(id);
      if (!st || !(st.cap > 0) || st.wood == null || st.stone == null || st.iron == null) return null;
      const tightestFree = st.cap - Math.max(+st.wood, +st.stone, +st.iron);
      return { id, st, tightestFree, blocked:townWarehouseBlocks(id) };
    }).filter(Boolean).sort((a,b) => (+a.blocked - +b.blocked) || b.tightestFree - a.tightestFree || a.id.localeCompare(b.id, undefined, {numeric:true}));
    if (readable.length) return { known:true, townId:readable[0].id, explicit:false, reason:'auto-live-emptiest' };
    if (ids.length === 1) return { known:true, townId:ids[0], explicit:false, reason:'auto-single-town' };
    return { known:false, townId:null, explicit:false, reason:'auto-town-state-unreadable' };
  }
  function resolveIslandUnitBeneficiary(islandKey, sameIslandTownIds) {
    const ids = [...new Set((sameIslandTownIds || []).map(String).filter(Boolean))];
    if (!ids.length) return { known:false, enabled:false, townId:null, reason:'same-island-towns-unreadable' };
    if (!islandKey) return { known:true, enabled:false, townId:null, reason:'resources-only-no-canonical-island' };
    const cfg = state.islandBeneficiaries && state.islandBeneficiaries[String(islandKey)];
    if (!cfg || cfg.unit == null || cfg.unit === 'none' || cfg.unit === 'auto') {
      return { known:true, enabled:false, townId:null, reason:'resources-only' };
    }
    const selected = String(cfg.unit);
    if (!ids.includes(selected)) return { known:false, enabled:false, townId:null, reason:'configured-unit-beneficiary-invalid' };
    return { known:true, enabled:true, townId:selected, reason:'configured' };
  }
  function configuredIslandBeneficiary(farm, ids, kind) {
    const ctx = farmIslandContext(farm, islandTownMap());
    const useIds = ids && ids.length ? ids : ctx.ids;
    if (!ctx.known) return 'UNKNOWN';
    if (kind === 'unit') {
      const r = resolveIslandUnitBeneficiary(ctx.key, useIds);
      if (!r.known) return 'UNKNOWN';
      return r.enabled ? r.townId : 'none';
    }
    const r = resolveIslandResourceBeneficiary(ctx.key, useIds);
    return r.known ? r.townId : 'UNKNOWN';
  }
  function townIdForFarmUnits(farm, islandMap) {
    const ctx = farmIslandContext(farm, islandMap || islandTownMap());
    if (!ctx.known) return null;
    const selected = resolveIslandUnitBeneficiary(ctx.key, ctx.ids);
    return selected.known && selected.enabled ? selected.townId : null;
  }
  function townIdForFarm(farm, islandMap) {
    const ctx = farmIslandContext(farm, islandMap || islandTownMap());
    if (!ctx.known) return null;
    const selected = resolveIslandResourceBeneficiary(ctx.key, ctx.ids);
    return selected.known ? selected.townId : null;
  }
  function townWarehouseState(townId) { return townResState(townId); }
  function townWarehouseBlocks(townId) {
    if (!state.farmSkipFull) return false;
    if (townId == null || townId === '') return false;
    const st = townWarehouseState(townId);
    if (!st) {
      gbLogT('wh-unknown-' + townId, 120000, `warehouse: could not read cap for town ${townId} (gate skipped)`);
      return false;
    }
    return state.farmFullMode === 'all' ? st.n >= 3 : st.n >= 1;
  }
  function currentTownWarehouseBlocks() {
    try {
      const uw = gameUw();
      const tid = uw.Game && uw.Game.townId;
      return tid != null && townWarehouseBlocks(tid);
    } catch (_) { return false; }
  }
  // Snap targets: union of both documented offer sets (wiki Farming: base
  // 5/20/120/300min, Booty/Botin doubles to 10/40/240/600min) plus legacy
  // 90m/3h/8h entries older hand-taught maps may still carry. The two sets
  // are disjoint, so one confirmed (option, duration) observation identifies
  // the active set.
  const FARM_DURATIONS = [300, 600, 1200, 2400, 5400, 7200, 10800, 14400, 18000, 28800, 36000];
  const FARM_CLAIM_BASE_MS = 10 * 60 * 1000;
  const FARM_CLAIM_JITTER_MIN_MS = 1 * 60 * 1000;
  const FARM_CLAIM_JITTER_MAX_MS = 3 * 60 * 1000;
  const FARM_CLAIM_DURATION_SEC = 600;
  const FARM_SET_BASE = [300, 1200, 7200, 18000];
  const FARM_SET_BOOTY = [600, 2400, 14400, 36000];
  // Posted option per village for the in-flight batch; verifyClaims reads it
  // back to learn the server's real gather duration per option.
  let farmPostedOpts = Object.create(null);
  function farmDurLabel(sec) {
    if (sec >= 3600) return (sec / 3600) + 'h';
    return Math.round(sec / 60) + 'min';
  }
  function farmOptionFor(sec) {
    const m = state.farmOptionMap || {};
    const v = m[String(sec)];
    return v == null ? null : +v;
  }
  function farmOptionMapEnsure() {
    let m = state.farmOptionMap;
    if (!m || typeof m !== 'object' || Array.isArray(m)) m = {};
    const has = Object.keys(m).some(k => m[k] != null && Number.isFinite(+m[k]));
    if (has) {
      state.farmOptionMap = m;
      return m;
    }
    m = { 600: 1 };
    state.farmOptionMap = m;
    save(wkey(STORE.FARM_OPTION_MAP), m);
    gbLogT('farm-opt-default', 600000, 'farm: empty option map \u2014 restored default 10min=2');
    return m;
  }
  function farmOptionResolve(wantSec) {
    const want = gbNum(wantSec);
    const exact = want != null ? farmOptionFor(want) : null;
    if (exact != null) return { option: exact, sec: want, how: 'exact' };
    const m = farmOptionMapEnsure();
    let floorOpt = null, floorSec = -1;
    let shortOpt = null, shortSec = Infinity;
    for (const sec of FARM_DURATIONS) {
      const v = m[String(sec)];
      const opt = gbNum(v);
      if (v == null || opt == null || !(opt >= 1 && opt <= 4)) continue;
      if (want != null && sec <= want && sec > floorSec) { floorSec = sec; floorOpt = opt; }
      if (sec < shortSec) { shortSec = sec; shortOpt = opt; }
    }
    if (floorOpt != null) return { option: floorOpt, sec: floorSec, how: 'floor' };
    if (shortOpt != null) return { option: shortOpt, sec: shortSec, how: 'shortest' };
    return null;
  }
  function farmClaimIntervalMs() {
    return FARM_CLAIM_BASE_MS + FARM_CLAIM_JITTER_MIN_MS
      + Math.random() * (FARM_CLAIM_JITTER_MAX_MS - FARM_CLAIM_JITTER_MIN_MS);
  }
  function farmStampNextClaim(reason) {
    const wait = farmClaimIntervalMs();
    state.nextFarmClaim = Date.now() + wait;
    save(STORE.NEXT_FARM_CLAIM, state.nextFarmClaim);
    try { renderTimers(); } catch (_) {}
    gbLogT('farm-claim-cadence', 60000,
      `farm claim: next in ${fmtSec(Math.round(wait / 1000))}${reason ? ' (' + reason + ')' : ''}`);
    return state.nextFarmClaim;
  }
  function farmClaimDue() {
    return Date.now() >= (gbNum(state.nextFarmClaim) || 0);
  }
  function farmOptionMapText() {
    const m = state.farmOptionMap || {};
    const parts = FARM_DURATIONS.filter(s => m[String(s)] != null).map(s => `${farmDurLabel(s)}=${m[String(s)]}`);
    return parts.length ? parts.join(' ') : 'none';
  }
  function farmOptionMapConflicts() {
    const m = state.farmOptionMap || {};
    const byOpt = Object.create(null);
    Object.keys(m).forEach(sec => {
      const o = String(m[sec]);
      (byOpt[o] = byOpt[o] || []).push(+sec);
    });
    const bad = Object.keys(byOpt).filter(o => byOpt[o].length > 1)
      .map(o => byOpt[o].sort((a, b) => a - b).map(s => farmDurLabel(s)).join('/') + '=' + o);
    return bad.length ? bad.join(' ') : '';
  }
  function farmSnapDuration(sec) {
    let best = null, bestDiff = Infinity;
    FARM_DURATIONS.forEach(d => {
      const diff = Math.abs(d - sec);
      if (diff < bestDiff) { best = d; bestDiff = diff; }
    });

    return best != null && bestDiff <= best * 0.2 ? best : null;
  }

  function farmLearnFromClaim(j) {
    const type = String(((j && j.arguments) || {}).type || '');
    if (type === 'units') return farmLearnUnitsOptionFromClaim(j);
    if (type && type !== 'resources') return;
    farmLearnOptionFromClaim(j);
  }
  function farmLearnUnitsOptionFromClaim(j) {
    try {
      const opt = +((j && j.arguments) || {}).option;
      if (!(opt >= 1 && opt <= FARM_UNIT_ORDER.length)) return;
      if (+state.farmUnitsOption === opt) return;
      state.farmUnitsOption = opt;
      save(wkey(STORE.FARM_UNITS_OPTION), opt);
      gbLog(`farm: learned units claim option ${opt} (${farmUnitIdFor(opt) || '?'})`);
    } catch (_) {}
  }
  function farmLearnOptionFromClaim(j) {
    try {
      const a = (j && j.arguments) || {};
      const opt = +a.option;
      const vid = a.farm_town_id;

      if (!(opt >= 1 && opt <= 4) || vid == null) return;
      gbTimeout(() => {
        const farms = farmsFromGame() || [];
        const f = farms.find(x => String(x.vill_id) === String(vid));
        if (!f || f.lootable_at == null) return;

        const remaining = +f.lootable_at - gameNow();
        const maxKnown = Math.max.apply(null, FARM_DURATIONS || [14400]);
        if (!(remaining > 30) || remaining > maxKnown + 5) {
          gbLogT('farm-learn-stale-' + vid, 60000, 'farm: option learner read stale lootable_at, retry next claim');
          return;
        }
        const sec = farmSnapDuration(remaining);
        if (sec == null) return;
        const map = Object.assign({}, state.farmOptionMap || {});
        if (+map[String(sec)] === opt) return;

        Object.keys(map).forEach(k => { if (k !== String(sec) && +map[k] === opt) delete map[k]; });
        map[String(sec)] = opt;
        state.farmOptionMap = map;
        save(wkey(STORE.FARM_OPTION_MAP), map);
        gbLog(`farm: learned claim option ${opt} = ${farmDurLabel(sec)} (map: ${farmOptionMapText()})`);
      }, 4000);
    } catch (_) {}
  }
  // Shared map write used by both the claim sniffer and the post-batch verify:
  // one option indexes one duration, so relearning evicts the stale duration.
  function farmOptionMapLearn(sec, opt, src) {
    if (!(opt >= 1 && opt <= 4) || !(sec > 0)) return false;
    const map = Object.assign({}, state.farmOptionMap || {});
    if (+map[String(sec)] === opt) return false;
    Object.keys(map).forEach(k => { if (k !== String(sec) && +map[k] === opt) delete map[k]; });
    map[String(sec)] = opt;
    state.farmOptionMap = map;
    save(wkey(STORE.FARM_OPTION_MAP), map);
    gbLog(`farm: learned claim option ${opt} = ${farmDurLabel(sec)} (${src}; map: ${farmOptionMapText()})`);
    return true;
  }
  // One confirmed observation pins the whole offer set when it matches exactly
  // one documented set at that position (the sets are disjoint). Derived
  // entries confirm through the same verify path on their next claim, so a
  // wrong derive dies on first use instead of looping.
  function farmOptionSetDerive(sec, opt) {
    const sets = { base: FARM_SET_BASE, booty: FARM_SET_BOOTY };
    let hit = null;
    Object.keys(sets).forEach(name => {
      if (sets[name][opt - 1] === sec) hit = hit ? 'ambiguous' : name;
    });
    if (!hit || hit === 'ambiguous') return false;
    const map = {};
    sets[hit].forEach((s, i) => { map[String(s)] = i + 1; });
    const cur = state.farmOptionMap || {};
    const same = Object.keys(map).length === Object.keys(cur).length
      && Object.keys(map).every(k => +cur[k] === map[k]);
    if (same) return false;
    state.farmOptionMap = map;
    save(wkey(STORE.FARM_OPTION_MAP), map);
    gbLog(`farm: offer set identified (${hit}) from ${farmDurLabel(sec)}=opt${opt} — derived map: ${farmOptionMapText()}`);
    return true;
  }
  const FARM_LOYALTY_IDS = ['rural_loyalty', 'loyalty', 'villagers_loyalty', 'villager_loyalty'];
  const FARM_LOYALTY_RE = /loyal(?:ty)?|lealtad|treue|fidel(?:ity|idad)|villager.{0,12}loyal|aldean.{0,12}leal/i;
  const farmLoyaltyCache = Object.create(null);
  function farmLoyaltyReset() {
    Object.keys(farmLoyaltyCache).forEach(k => { delete farmLoyaltyCache[k]; });
  }
  function farmLoyaltyPinHit(techs, pin) {
    const want = pin.toLowerCase();
    const keys = Object.keys(techs).filter(k => techs[k]);
    return keys.some(k => k.toLowerCase() === want || researchLabel(k).toLowerCase() === want);
  }
  function farmLoyaltyProbe(townId) {
    let val = false;
    let hit = null;
    try {
      const info = researchTownTechs(townId);
      const techs = (info && info.techs) || null;
      if (techs) {
        const pin = String(state.farmLoyaltyTech || '').trim();
        if (pin) val = farmLoyaltyPinHit(techs, pin);
        else {
          const done = Object.keys(techs).filter(k => techs[k]);
          hit = FARM_LOYALTY_IDS.find(id => done.indexOf(id) >= 0) ||
            done.find(k => FARM_LOYALTY_RE.test(k) || FARM_LOYALTY_RE.test(researchLabel(k)));
          if (hit) val = true;
          else {

            gbLogT('farm-loyalty-miss', 900000, 'farm: loyalty tech not found; researched = ' +
              done.map(k => k + (researchLabel(k) ? '(' + researchLabel(k) + ')' : '')).join(',').slice(0, 600));
          }
        }
      }
    } catch (_) {}
    return { val, hit };
  }
  function farmLoyaltyLearnTech(hit) {
    if (!hit) return;
    if (state.farmLoyaltyTech === hit) return;
    state.farmLoyaltyTech = hit;
    save(wkey(STORE.FARM_LOYALTY_TECH), hit);
    gbLog(`farm: loyalty tech detected: ${hit}${researchLabel(hit) ? ' (' + researchLabel(hit) + ')' : ''}`);
  }
  function farmLoyaltyResearched(townId) {
    const now = Date.now();
    const c = farmLoyaltyCache[townId];
    if (c && now - c.ts < 60000) return c.val;
    const r = farmLoyaltyProbe(townId);
    farmLoyaltyCache[townId] = { ts: now, val: r.val, hit: r.hit };
    return r.val;
  }
  function farmLongClaimDuration() {
    return farmOptionFor(28800) != null ? 28800 : 14400;
  }

  const FARM_PICK_MAX = 14400;
  const FARM_PICK_LADDER = [600, 1200, 2400, 5400, 10800, FARM_PICK_MAX];
  function farmShortestClaimDuration(townId) {
    // With village loyalty/Booty researched Grepolis replaces the 5 min card with 10 min.
    // Prefer direct learned-card evidence too, so a temporarily unreadable research model cannot
    // make us fall back to a non-existent 5 min option after 10 min has already been learned.
    if (farmOptionFor(600) != null && farmOptionFor(300) == null) return 600;
    if (state.farmLoyaltySeen && farmOptionFor(600) != null) return 600;
    try { if (farmLoyaltyResearched(townId)) return 600; } catch (_) {}
    return 300;
  }
  function farmDurationPick(townId) {
    const shortest = farmShortestClaimDuration(townId);
    if (!state.farmLongClaims) return shortest;
    const learned = FARM_PICK_LADDER.filter(sec => sec >= shortest && farmOptionFor(sec) != null);
    if (!learned.length) return shortest;

    const rs = (typeof townResState === 'function') ? townResState(townId) : null;
    const headroom = rs && rs.cap > 0 ? Math.max(0, rs.cap - Math.max(rs.wood, rs.stone, rs.iron)) : null;

    let best = null;
    for (const sec of learned) {

      const est = gbLootEstimate({ kind: 'farm-claim', durationSec: sec, loyalty: 1.0, headroom });
      if (est.meta.fits === false) continue;
      if (best == null || sec > best) best = sec;
    }
    // If loyalty is researched and even the shortest learned 10 min claim would not fit,
    // wait instead of falling back to a non-existent 5 min card.
    return best != null ? best : (shortest === 600 ? null : 300);
  }
  function farmDesiredDuration(townId) { return farmDurationPick(townId); }

  const FARM_PROFIT_TTL_MS = 300000;
  const FARM_PROFIT_BLIND_TTL_MS = 20000;
  const farmProfitCache = Object.create(null);
  function farmTravelSecPerUnit() {
    const n = +state.farmTravelSecPerUnit;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  function farmProfitScore(farm, islandMap) {
    const id = farm && farm.vill_id != null ? String(farm.vill_id) : null;
    if (!id) return { score: null, why: 'no-id' };
    const hit = farmProfitCache[id];

    if (hit && Date.now() - hit.at < (hit.v.score == null ? FARM_PROFIT_BLIND_TTL_MS : FARM_PROFIT_TTL_MS)) return hit.v;
    const out = (v) => { farmProfitCache[id] = { at: Date.now(), v }; return v; };
    const tid = townIdForFarm(farm, islandMap);
    if (tid == null) {
      gbLogT('farm-profit-blind-' + id, 600000, `farm profit: village ${id} has no same-island town - not ranked`);
      return out({ score: null, why: 'no-town' });
    }
    const rs = (typeof townResState === 'function') ? townResState(tid) : null;
    const headroom = rs && rs.cap > 0 ? Math.max(0, rs.cap - Math.max(rs.wood, rs.stone, rs.iron)) : null;
    if (headroom == null) {
      gbLogT('farm-profit-blind-' + id, 600000, `farm profit: town ${tid} capacity unreadable - village ${id} not ranked`);
      return out({ score: null, why: 'headroom-blind', townId: String(tid) });
    }
    const duration = farmDurationPick(tid);
    // loyalty is deliberately 1.0, matching farmDurationPick above. A
    // discount here diverges from the picker: the ranker would under-rank
    // loyalty-less villages while the picker still chose a duration sized
    // for the full 1.0 estimate. Aligned in v5.10.12 per OPEN-PLAN 1.5.
    const est = gbLootEstimate({ kind: 'farm-claim', durationSec: duration, loyalty: 1.0, headroom });

    let distance = null;
    try {
      const t = uwCached().ITowns && uwCached().ITowns.towns[tid];
      const tx = t && t.getIslandCoordinateX ? +t.getIslandCoordinateX() : null;
      const ty = t && t.getIslandCoordinateY ? +t.getIslandCoordinateY() : null;
      if (Number.isFinite(tx) && Number.isFinite(ty) && Number.isFinite(+farm.x) && Number.isFinite(+farm.y)) {
        distance = Math.sqrt(Math.pow(tx - +farm.x, 2) + Math.pow(ty - +farm.y, 2));
      }
    } catch (_) {}
    const travel = distance != null ? distance * farmTravelSecPerUnit() : 0;
    const cycleSec = Math.max(1, duration + travel);
    return out({
      score: est.total / cycleSec,
      duration, distance, loyalty, headroom,
      townId: String(tid),
      travelSec: travel,
      why: '',
    });
  }
  let farmProfitRefreshAt = 0;
  const FARM_PROFIT_REFRESH_MS = 20000;

  function farmProfitRefresh(force) {
    if (!Array.isArray(state.farmsParsed)) return;
    const now = Date.now();
    if (!force && now - farmProfitRefreshAt < FARM_PROFIT_REFRESH_MS) return;
    farmProfitRefreshAt = now;
    if (!state.farmProfit || typeof state.farmProfit !== 'object') state.farmProfit = {};
    const map = islandTownMap();
    let changed = false;
    for (const f of state.farmsParsed) {
      const id = String(f.vill_id);
      const r = farmProfitScore(f, map);
      const row = { score: r.score, duration: r.duration ?? null, distance: r.distance ?? null, loyalty: r.loyalty ?? null, ts: Date.now() };
      const prev = state.farmProfit[id];
      if (!prev || prev.score !== row.score || prev.duration !== row.duration || prev.distance !== row.distance) changed = true;
      state.farmProfit[id] = row;
    }
    if (pruneMapsToIds(state.farmProfit, state.farmsParsed.map(f => f.vill_id))) changed = true;
    if (changed) save(STORE.FARM_PROFIT, state.farmProfit);
  }
  function farmProfitInvalidate() { for (const k of Object.keys(farmProfitCache)) delete farmProfitCache[k]; farmProfitRefreshAt = 0; }

  const FARM_UNIT_ORDER = ['sword', 'slinger', 'archer', 'hoplite'];
  function farmUnitIdFor(option) {
    const o = gbNum(option);
    return o != null ? (FARM_UNIT_ORDER[o - 1] || null) : null;
  }
  function farmVillageLevel(farm) {
    const rel = farm && farm._rel;
    const a = (farm && farm._attrs) || {};
    let level = null;
    try { if (rel && typeof rel.getLevel === 'function') level = gbNum(rel.getLevel()); } catch (_) {}
    if (Number.isFinite(level)) return level;
    const status = gbNum(a.relation_status);
    if (status === 0) return 0;
    return gbNum(a.expansion_stage);
  }
  function farmClaimUnitsTable(farm) {
    const t = gbGameDataLookup('farm_town', 'claim_units');
    if (!t || typeof t !== 'object') return null;
    const lvl = farmVillageLevel(farm);
    if (lvl != null) {
      const byLevel = t[lvl] != null ? t[lvl] : t[String(lvl)];
      if (byLevel && typeof byLevel === 'object') return byLevel;
    }
    if (FARM_UNIT_ORDER.some(u => t[u] != null)) return t;
    return null;
  }
  function farmUnitOption(farm, townId) {
    const pref = String(state.farmUnitsPref || 'auto');
    if (pref !== 'auto' && pref !== 'learned') {
      const i = FARM_UNIT_ORDER.indexOf(pref);
      return i >= 0 ? i + 1 : null;
    }
    if (pref === 'auto') {
      let tid = townId;
      if (tid == null) { try { tid = gameUw().Game && gameUw().Game.townId; } catch (_) { tid = null; } }
      const auto = farmUnitAutoOption(farm, tid);
      if (auto != null) return auto;
    }
    const o = +state.farmUnitsOption;
    return o >= 1 && o <= FARM_UNIT_ORDER.length ? o : null;
  }
  function farmUnitAutoOption(farm, townId) {
    const table = farmClaimUnitsTable(farm);
    if (!table) return null;
    let best = null;
    for (let opt = 1; opt <= FARM_UNIT_ORDER.length; opt++) {
      const unit = FARM_UNIT_ORDER[opt - 1];
      const amount = gbNum(table[unit]);
      if (amount == null || amount <= 0) continue;
      if (townId != null && farmUnitsClaimBlocked(farm, townId, opt)) continue;
      const def = gbGameDataLookup('units', unit);
      const res = (def && def.resources) || null;

      const cost = res ? (() => {
        const w = gbNum(res.wood), s = gbNum(res.stone), i = gbNum(res.iron);
        return (w != null && s != null && i != null) ? w + s + i : null;
      })() : null;
      const score = amount * (cost != null && cost > 0 ? cost : 1);
      if (!best || score > best.score) best = { opt, score };
    }
    return best ? best.opt : null;
  }

  function farmDailyLeft(farm) {
    const rel = farm && farm._rel;
    const a = (farm && farm._attrs) || {};
    const level = farmVillageLevel(farm);
    if (!Number.isFinite(level)) return null;
    const table = gbGameDataLookup('farm_town', 'max_resources_per_day');
    const perDay = table ? +table[level] : NaN;
    if (!Number.isFinite(perDay) || perDay <= 0) return null;
    let speed = null;
    try { speed = +(gameUw().Game && gameUw().Game.game_speed); } catch (_) {}
    if (!Number.isFinite(speed) || speed <= 0) return null;
    let loot = null;
    try { if (rel && typeof rel.getLoot === 'function') loot = +rel.getLoot(); } catch (_) {}
    if (!Number.isFinite(loot)) loot = +a.loot;
    if (!Number.isFinite(loot)) return null;
    return Math.max(0, perDay * speed - loot);
  }
  function farmUnitsClaimBlocked(farm, townId, option) {
    const unit = farmUnitIdFor(option);
    if (!unit) return 'unit-unknown';
    const table = farmClaimUnitsTable(farm);

    if (!table) return 'unit-table-unreadable';
    if (table[unit] == null) return 'unit-not-offered';
    let amount = null;
    const n = gbNum(table[unit]);
    if (n != null) {
      if (!(n > 0)) return 'unit-amount-0';
      amount = n;
    }
    const def = gbGameDataLookup('units', unit);
    const popEach = def && def.population != null ? +def.population : null;
    const free = gbTownPop(townId);
    if (amount != null && Number.isFinite(popEach) && popEach > 0 && free != null && free < amount * popEach) {
      return `pop ${free}/${amount * popEach}`;
    }
    try {
      const req = ((gbGameDataLookup('farm_town', 'building_requirements') || {}).units || {})[option];
      if (req && req.building) {
        const lvl = gbBuildingLevel(townId, req.building);
        if (lvl != null && lvl < +req.level) return `${req.building} ${lvl}/${req.level}`;
      }
    } catch (_) {}
    return null;
  }

  function farmResExhausted(farm) {
    const rel = farm && farm._rel;
    let vals = (farm && farm._attrs && farm._attrs.claim_resource_values) || null;
    if (vals == null) {
      try {
        if (rel && typeof rel.getClaimResourceValues === 'function') vals = rel.getClaimResourceValues();
      } catch (_) { vals = null; }
    }
    if (vals == null || typeof vals !== 'object') return null;
    const len = +vals.length;
    if (!Number.isFinite(len) || len <= 0) return null;
    const nums = [];
    for (let i = 0; i < len; i++) {
      const n = +vals[i];
      if (!Number.isFinite(n)) return null;
      nums.push(n);
    }
    return nums.every(n => n <= 0);
  }
  function farmResDryMap() {
    const day = farmDayKey();
    if (state.farmResDryDay !== day) {
      state.farmResDryDay = day;
      state.farmResDry = {};
      save(wkey(STORE.FARM_RES_DRY_DAY), day);
      save(wkey(STORE.FARM_RES_DRY), state.farmResDry);
    }
    if (!state.farmResDry || typeof state.farmResDry !== 'object') state.farmResDry = {};
    return state.farmResDry;
  }

  const FARM_RES_DRY_STRIKES = 3;
  const FARM_RES_DRY_TTL_MS = 5400000;
  function farmResDryMarked(villId) {
    const r = farmResDryMap()[String(villId)];
    if (!r || (+r.n || 0) < FARM_RES_DRY_STRIKES) return false;
    return Date.now() - (+r.at || 0) < FARM_RES_DRY_TTL_MS;
  }
  function farmMarkResDry(villId, why) {
    const m = farmResDryMap();
    const key = String(villId);
    const row = m[key] && typeof m[key] === 'object' ? m[key] : { n: 0 };

    if (row.at && Date.now() - (+row.at || 0) > FARM_RES_DRY_TTL_MS) row.n = 0;
    if (row.n >= FARM_RES_DRY_STRIKES) { row.at = Date.now(); m[key] = row; saveSoon(wkey(STORE.FARM_RES_DRY), m); return; }
    row.n = (+row.n || 0) + 1;
    row.why = why || 'hard error';
    row.at = Date.now();
    m[key] = row;
    saveSoon(wkey(STORE.FARM_RES_DRY), m);
    if (row.n >= FARM_RES_DRY_STRIKES) {
      gbLog(`farm: village ${villId} resource claim dry today (${row.why}) - claiming units instead`);
    } else {
      gbLogT('farm-dry-strike-' + villId, 60000, `farm: village ${villId} resource claim error ${row.n}/${FARM_RES_DRY_STRIKES} (${row.why})`);
    }
  }
  function farmResDryClear(villId) {
    const m = farmResDryMap();
    if (!m[String(villId)]) return;
    delete m[String(villId)];
    saveSoon(wkey(STORE.FARM_RES_DRY), m);
  }

  function farmMarkDailyCap(villId) {
    const m = farmResDryMap(), key = String(villId);
    m[key] = { n:FARM_RES_DRY_STRIKES, why:'daily-cap', at:Date.now(), dailyCap:true };
    saveSoon(wkey(STORE.FARM_RES_DRY), m);
    gbLogT('farm-daily-cap-server-' + key, 600000,
      `farm: village ${key} daily resource cap confirmed by server - suppressing resource claims until next farm day`);
  }
  function farmDailyCapMarked(villId) {
    const r = farmResDryMap()[String(villId)];
    return !!(r && r.dailyCap === true);
  }

  function farmClaimTypeFor(farm, islandMap) {
    const ctx = farmIslandContext(farm, islandMap || islandTownMap());
    if (!ctx.known) return 'resources';
    const unitBeneficiary = resolveIslandUnitBeneficiary(ctx.key, ctx.ids);
    if (!unitBeneficiary.known || !unitBeneficiary.enabled) return 'resources';
    const mode = String(state.farmUnitsMode || 'off');
    if (mode === 'always') return 'units';
    if (mode !== 'fallback') return 'resources';
    const left = farmDailyLeft(farm);
    if (left != null && left <= 0) {
      gbLogT('farm-daily-cap-' + farm.vill_id, 600000,
        `farm: village ${farm.vill_id} daily resource allowance spent - claiming units for configured town ${unitBeneficiary.townId}`);
      return 'units';
    }
    const exhausted = farmResExhausted(farm);
    if (exhausted === true) return 'units';
    if (exhausted === false) return 'resources';
    return farmResDryMarked(farm.vill_id) ? 'units' : 'resources';
  }
  function farmClaimDiag(limit) {
    const farms = farmsFromGame();
    if (!farms) { gbLog('farm diag: game collections not ready'); return; }
    const islandMap = islandTownMap();
    const speed = (() => { try { return +(gameUw().Game && gameUw().Game.game_speed); } catch (_) { return null; } })();
    const perDayTable = gbGameDataLookup('farm_town', 'max_resources_per_day');
    const unitTable = farmClaimUnitsTable(farms[0]);
    gbLog(`farm diag: mode=${state.farmUnitsMode || 'off'} pick=${state.farmUnitsPref || 'auto'} learnedUnitOpt=${state.farmUnitsOption == null ? '-' : state.farmUnitsOption}` +
      ` game_speed=${Number.isFinite(speed) ? speed : 'UNREADABLE'}` +
      ` max_resources_per_day=${perDayTable ? 'ok' : 'UNREADABLE'}` +
      ` claim_units=${unitTable ? JSON.stringify(unitTable).slice(0, 120) : 'UNREADABLE'}` +
      ` optionMap=${farmOptionMapText()}`);
    const n = Math.max(1, Math.min(+limit || 8, farms.length));
    for (const f of farms.slice(0, n)) {
      const resourceTid = townIdForFarm(f, islandMap);
      const unitTid = townIdForFarmUnits(f, islandMap);
      const tid = unitTid || resourceTid;
      const left = farmDailyLeft(f);
      const type = farmClaimTypeFor(f, islandMap);
      const targetTid = type === 'units' ? unitTid : resourceTid;
      const opt = type === 'units' ? farmUnitOption(f, targetTid) : null;
      const blocked = (type === 'units' && opt != null && targetTid != null) ? farmUnitsClaimBlocked(f, targetTid, opt) : null;
      const dry = farmResDryMap()[String(f.vill_id)];
      gbLog(`  vill ${f.vill_id} town=${tid == null ? '-' : tid}` +
        ` lootable=${f.lootable_at == null ? '-' : Math.max(0, f.lootable_at - gameNow()) + 's'}` +
        ` loot=${(f._attrs && f._attrs.loot) != null ? f._attrs.loot : '-'}` +
        ` level=${(f._attrs && f._attrs.expansion_stage) != null ? f._attrs.expansion_stage : '-'}` +
        ` dailyLeft=${left == null ? 'BLIND' : left}` +
        ` resValues=${farmResExhausted(f) === null ? 'blind' : (farmResExhausted(f) ? 'all-zero' : 'has-value')}` +
        ` dry=${dry ? dry.n + 'x ' + (dry.why || '') : '-'}` +
        ` -> type=${type}${type === 'units' ? ' opt=' + (opt == null ? 'NONE' : opt + '(' + (farmUnitIdFor(opt) || '?') + ')') + (blocked ? ' BLOCKED:' + blocked : '') : ''}`);
    }
    if (farms.length > n) gbLog(`  \u2026 ${farms.length - n} more village(s) not shown`);
  }
  function claimFarm(farm, islandMap, whCache, durOverride, onDone) {
    const done = (err) => { if (onDone) onDone(err); };
    if (captchaPaused('farm')) return done('captcha');
    const claimType = farmClaimTypeFor(farm, islandMap);
    const target = claimType === 'units' ? townIdForFarmUnits(farm, islandMap) : townIdForFarm(farm, islandMap);
    const tid = gbNum(target);
    if (tid == null) {
      gbLogT('claim-no-town', 60000, `farm claim skip ${farm.vill_id}: ${claimType === 'units' ? 'no configured unit beneficiary' : 'no readable resource beneficiary'}`);
      return done('skip');
    }

    if (claimType === 'resources') {
      if (farmDailyCapMarked(farm.vill_id)) return done('skip:daily-cap');
      // Local daily-cap precheck: loot vs max_resources_per_day is readable, so
      // the cap can be learned without spending one server reject per village.
      const dailyLeft = farmDailyLeft(farm);
      if (dailyLeft != null && dailyLeft <= 0) {
        farmMarkDailyCap(farm.vill_id);
        return done('skip:daily-cap');
      }
      let blocked = false;
      if (whCache) {
        if (!(tid in whCache)) whCache[tid] = townWarehouseBlocks(tid);
        blocked = whCache[tid];
      } else {
        blocked = townWarehouseBlocks(tid);
      }
      if (blocked) {
        gbLogT('claim-wh-block', 30000, `farm claim blocked (warehouse full) town ${tid} vill ${farm.vill_id}`);
        return done('skip');
      }
    }
    const tplArgs = (state.claimTpl && state.claimTpl.arguments) || {};
    if (claimType === 'units') return claimFarmUnits(farm, tid, tplArgs, done);
    const wantSec = durOverride != null ? durOverride : farmDesiredDuration(tid);
    const shortest = farmShortestClaimDuration(tid);
    if (wantSec == null) {
      gbLogT('farm-no-fit-' + tid, 60000,
        `farm claim: shortest available ${farmDurLabel(shortest)} would not fit current warehouse headroom - waiting`);
      return done('skip');
    }
    let option = farmOptionFor(wantSec);
    if (option == null) {
      const resolved = farmOptionResolve(wantSec);
      if (resolved && resolved.option != null) {
        option = resolved.option;
        gbLogT('farm-opt-' + wantSec, 900000,
          `farm claim: option index for ${farmDurLabel(wantSec)} unknown - using ${resolved.how} ${farmDurLabel(resolved.sec)} option`);
      } else {
        const fallback = farmOptionFor(shortest);
        if (fallback == null) {
          gbLogT('farm-opt-' + wantSec, 900000,
            `farm claim: option index for ${farmDurLabel(wantSec)} unknown and no learned ${farmDurLabel(shortest)} index - claim ${farmDurLabel(shortest)} once by hand in game to teach it`);
          return done('skip');
        }
        gbLogT('farm-opt-' + wantSec, 900000,
          `farm claim: option index for ${farmDurLabel(wantSec)} unknown - using learned ${farmDurLabel(shortest)} option`);
        option = fallback;
      }
    }
    farmPostedOpts[String(farm.vill_id)] = { opt: option, want: wantSec != null && Number.isFinite(+wantSec) ? +wantSec : null };

    const args = Object.assign({}, tplArgs, { type: 'resources', option, farm_town_id: +farm.vill_id });
    bridgePost('farm', {
      model_url: `FarmTownPlayerRelation/${farm.relation_id}`,
      action_name: (state.claimTpl && state.claimTpl.action_name) || 'claim',
      arguments: args,
      town_id: tid,
    }, (err) => {
      if (!err && whCache) delete whCache[tid];

      const expectedReject = gbExpectedServerReject('farm', err);
      if (expectedReject === 'farm-daily-cap') {
        farmMarkDailyCap(farm.vill_id);
      } else if (expectedReject === 'waiting-not-ready') {
        farmScheduleNotReadyWake(farm);
      }
      const hard = err && !expectedReject && err !== 'remembered' && !JRN_SKIP_ERRS[String(err).split(':')[0]] && err !== 'captcha' && !jrnPendingResult(err);
      if (hard) {
        if (String(state.farmUnitsMode || 'off') === 'fallback') farmMarkResDry(farm.vill_id, String(err).slice(0, 40));
      } else if (!err) {
        farmResDryClear(farm.vill_id);
      }
      done(err || null);
    });
  }
  function claimFarmUnits(farm, tid, tplArgs, done) {
    const option = farmUnitOption(farm, tid);
    if (option == null) {
      gbLogT('farm-units-opt', 120000,
        'farm claim: no unit card available (pick=' + (state.farmUnitsPref || 'auto') +
        ', claim_units=' + (farmClaimUnitsTable(farm) ? 'readable' : 'UNREADABLE for village level ' + farmVillageLevel(farm)) +
        ', learned=' + (state.farmUnitsOption == null ? 'none' : state.farmUnitsOption) +
        ') - pin a unit in Ajustes or claim units once by hand; Acciones > Diagnostico de aldeas dumps the reads');
      return done('skip');
    }
    const why = farmUnitsClaimBlocked(farm, tid, option);
    if (why) {
      gbLogT('farm-units-block-' + tid, 300000,
        `farm units claim skip town ${tid} vill ${farm.vill_id}: ${why}`);
      return done('skip');
    }
    const args = Object.assign({}, tplArgs, { type: 'units', option, farm_town_id: +farm.vill_id });
    bridgePost('farm', {
      model_url: `FarmTownPlayerRelation/${farm.relation_id}`,
      action_name: (state.claimTpl && state.claimTpl.action_name) || 'claim',
      arguments: args,
      town_id: tid,
    }, (err) => done(err || null));
  }

  const FARM_PENDING_MEMO_MS = 3000;
  let farmPendingMemo = { at: 0, val: false, locked: 0 };
  function farmClaimPending() {
    if (!state.autoFarm || !hostEnabled()) return false;
    if (captchaPaused('farm')) return false;

    if (gbLocked('claim')) return true;
    const stamp = Date.now();
    // The memo's lock state must match the current lock state, otherwise the
    // cached val survives a lock-release and post-batch callers (orchFarmFirst)
    // see stale "true" for up to 3s past the actual unlock. OPEN-PLAN 1.6.
    if (stamp - farmPendingMemo.at < FARM_PENDING_MEMO_MS && !farmPendingMemo.locked) return farmPendingMemo.val;
    let val = false;
    try {
      const farms = farmsFromGame();
      if (farms && farms.length) {
        const now = gameNow();
        const islandMap = islandTownMap();
        const whCache = Object.create(null);
        for (const f of farms) {
          if (!f) continue;
          if (f._rel) {
            if (!farmIsLootable(f._rel, f._attrs || {})) continue;
          } else if (f.lootable_at != null && f.lootable_at > now) {
            continue;
          }
          const claimType = farmClaimTypeFor(f, islandMap);
          const tid = claimType === 'units' ? townIdForFarmUnits(f, islandMap) : townIdForFarm(f, islandMap);
          if (!tid) continue;
          if (claimType !== 'units') {
            if (farmDailyCapMarked(f.vill_id)) continue;
            if (!(tid in whCache)) whCache[tid] = townWarehouseBlocks(tid);
            if (whCache[tid]) continue;
          }
          val = true;
          break;
        }
      }
    } catch (_) { val = false; }
    farmPendingMemo = { at: stamp, val, locked: 0 };
    return val;
  }

  function autoClaimFarms(reason, durOverride, onBatchDone) {
    if (!hostEnabled() || !state.autoFarm || captchaPaused('farm') || automationPaused({})) {
      if (onBatchDone) onBatchDone({ done: 0, attempted: 0, captcha: false });
      return;
    }
    if (gbLocked('claim')) { gbLogT('claim-inflight', 30000, 'farm claim: skipped (in flight)'); return; }
    const uw = uwCached();
    if (!(uw.gpAjax && uw.gpAjax.ajaxPost)) { gbLogT('claim-noajax', 60000, 'farm claim: gpAjax not ready yet'); return; }
    const farms = farmsFromGame();
    if (!farms) { gbLogT('claim-nofarms', 60000, 'farm claim: game collections not ready'); return; }
    const now = gameNow();
    const islandMap = islandTownMap();
    const whCache = Object.create(null);
    let skippedFull = 0;
    const ready = farms.filter(f => {
      if (f._rel) {
        if (!farmIsLootable(f._rel, f._attrs || {})) return false;
      } else if (f.lootable_at != null && f.lootable_at > now) {
        return false;
      }
      const claimType = farmClaimTypeFor(f, islandMap);
      const tid = claimType === 'units' ? townIdForFarmUnits(f, islandMap) : townIdForFarm(f, islandMap);
      if (!tid) return false;
      if (claimType === 'units') return true;
      if (farmDailyCapMarked(f.vill_id)) return false;
      if (!(tid in whCache)) whCache[tid] = townWarehouseBlocks(tid);
      if (whCache[tid]) { skippedFull++; return false; }
      return true;
    });
    if (skippedFull) {
      gbLogT('claim-wh-full', 60000, `farm claim: skipped ${skippedFull} (warehouse full, mode=${state.farmFullMode})`);
    }
    if (!ready.length) {
      const next = Math.min(...farms.map(f => f.lootable_at || Infinity));
      gbLogT('claim-none', 60000, `farm claim: 0/${farms.length} ready${skippedFull ? ` (${skippedFull} warehouse-full)` : ''}, next in ${next === Infinity ? '?' : Math.max(0, next - now) + 's'}`);

      farmScheduleClaimWake(farms, 'next-lootable', skippedFull === 0);
      if (onBatchDone) onBatchDone({ done: 0, attempted: 0, captcha: false });
      return;
    }

    const work = farmApplyDropPolicies(ready);
    if (!work.length) {
      gbLogT('claim-policy-empty', 300000, 'farm claim: current claim policy dropped every candidate this pass');

      farmScheduleClaimWake(farms, 'policy-empty', true);
      if (onBatchDone) onBatchDone({ done: 0, attempted: 0, captcha: false });
      return;
    }
    // Lock covers the full sweep at fixed spacing + captcha waits + verify.
    const claimLockToken = gbLock('claim', Math.max(180000, work.length * (FARM_CLAIM_SPACING_MS + 500) + 120000));
    if (!claimLockToken) return;
    farmPostedOpts = Object.create(null);
    const unitCount = work.filter(f => farmClaimTypeFor(f, islandMap) === 'units').length;
    gbLog(`farm claim${reason ? ' (' + reason + ')' : ''}: ${work.length}/${farms.length} ready${work.length !== ready.length ? ` (${ready.length - work.length} filtered)` : ''}${skippedFull ? ` (${skippedFull} warehouse-full)` : ''}${unitCount ? ` (${unitCount} as units)` : ''} @${FARM_CLAIM_SPACING_MS}ms`);
    const before = {};
    farms.forEach(f => { before[f.vill_id] = f.lootable_at; });
    flash(`farm claim x${work.length}`);

    const outcome = Object.create(null);
    let i = 0, done = 0, captchaHits = 0;
    function farmClaimFinishBatch(captcha) {
      const tally = Object.keys(outcome).map(k => `${k}x${outcome[k]}`).join(' ');
      if (tally) gbLog(`  claim outcomes: ${tally}`);
      gbTimeout(() => {
        try {
          const flipped = verifyClaims(before, work);
          farmScheduleClaimWake(null, 'post-claim', true);
          if (onBatchDone) onBatchDone({
            done: flipped,
            attempted: work.length,
            captcha,
            bridgeOk: done,
          });
        } finally { gbUnlock('claim', claimLockToken); }
      }, FARM_CLAIM_VERIFY_MS);
    }
    (function next() {
      gbLockTouch('claim', claimLockToken);
      if (i >= work.length) {
        farmClaimFinishBatch(captchaHits > 0);
        return;
      }
      // Wait out captcha/server pressure instead of dropping the rest of the
      // ready set (old abort left large accounts at ~50% coverage per cycle).
      // Still do NOT post into an active captcha — that only burns the ladder.
      const pauseInfo = {};
      const capPaused = captchaPaused('farm');
      const autoPaused = automationPaused(pauseInfo);
      if (capPaused || autoPaused) {
        const why = capPaused ? 'captcha' : (pauseInfo.reason || 'pause');
        if (why === 'captcha' || why === 'captcha-global' || why === 'server') {
          gbLogT('claim-wait-pause', 10000,
            `farm claim: waiting (${why}) — ${work.length - i}/${work.length} villages left in this sweep`);
          gbTimeout(next, FARM_CLAIM_CAPTCHA_WAIT_MS);
          return;
        }
        gbLog(`farm claim: aborting remaining ${work.length - i} (${why})`);
        farmClaimFinishBatch(captchaHits > 0);
        return;
      }
      const f = work[i];
      try {
        claimFarm(f, islandMap, whCache, durOverride, (err) => {
          const key = String(err || 'ok').slice(0, 24);
          outcome[key] = (outcome[key] || 0) + 1;
          if (err === 'captcha' || err === 'captcha-pause') {
            captchaHits++;
            farmPressureNote('captcha');
            // Retry same village once captcha clears — do not advance.
            gbTimeout(next, FARM_CLAIM_CAPTCHA_WAIT_MS);
            return;
          }
          if (err === 'budget') {
            // Should be rare now (burst bypass); back off briefly and retry.
            gbLogT('claim-budget-retry', 15000, `farm claim: budget hit on ${f.vill_id} — retrying`);
            gbTimeout(next, FARM_CLAIM_SPACING_MS);
            return;
          }
          i++;
          if (!err) {
            done++;
            try { farmClaimCount(f.vill_id); } catch (_) {}
            gbLog(`  claimed ${f.name || f.vill_id} (rel ${f.relation_id})`);
          }
          gbTimeout(next, FARM_CLAIM_SPACING_MS);
        });
      } catch (e) {
        gbLog('  claim FAIL', f.vill_id, String(e));
        i++;
        gbTimeout(next, FARM_CLAIM_SPACING_MS);
      }
    })();
  }

  const FARM_PRESSURE_TTL_MS = 1800000;
  const FARM_PRESSURE_WINDOW_MS = 300000;
  const FARM_PRESSURE_MAX = 8;
  const farmPressure = [];
  function farmPressureNote(kind) {
    const now = Date.now();

    const last = farmPressure[farmPressure.length - 1];
    if (last && last.kind === kind && now - last.at < 60000) { last.at = now; return; }
    farmPressure.push({ at: now, kind });
    while (farmPressure.length > FARM_PRESSURE_MAX) farmPressure.shift();
  }
  function farmPressureTick() {
    try { if (captchaPaused('farm')) farmPressureNote('captcha'); } catch (_) {}
    try { if (typeof gbServerPaused === 'function' && gbServerPaused()) farmPressureNote('server'); } catch (_) {}
    try { if (typeof reqBudgetSoftDelayMs === 'function' && reqBudgetSoftDelayMs() > 0) farmPressureNote('budget'); } catch (_) {}
    const cut = Date.now() - FARM_PRESSURE_TTL_MS;
    while (farmPressure.length && farmPressure[0].at < cut) farmPressure.shift();
  }
  function farmPressureOn() {
    const cut = Date.now() - FARM_PRESSURE_WINDOW_MS;
    return farmPressure.some(p => p.at >= cut);
  }
  function farmCaptchaHot() {
    const cut = Date.now() - 3600000;
    return farmPressure.some(p => p.kind === 'captcha' && p.at >= cut);
  }
  // Captcha-scoped claim ring. farmClaimsToday counts every claim for the
  // calendar day; the captcha-hot filter at farmApplyDropPolicies only wants
  // the ones that landed during a captcha-hot streak so that villages whose
  // 5h/8h timer expired mid-day are not skipped for the rest of the day
  // after the captcha ladder cools. OPEN-PLAN 1.1 / 8/23 audit #12.
  const FARM_CAPTCHA_CLAIMS_TTL_MS = 3600000;
  const FARM_CAPTCHA_CLAIMS_MAX = 200;
  const farmCaptchaClaims = [];
  function farmCaptchaClaimsPrune() {
    const cut = Date.now() - FARM_CAPTCHA_CLAIMS_TTL_MS;
    while (farmCaptchaClaims.length && farmCaptchaClaims[0].at < cut) farmCaptchaClaims.shift();
    while (farmCaptchaClaims.length > FARM_CAPTCHA_CLAIMS_MAX) farmCaptchaClaims.shift();
  }
  function farmCaptchaClaimNote(villId) {
    farmCaptchaClaimsPrune();
    farmCaptchaClaims.push({ villId: String(villId), at: Date.now() });
  }
  function farmCaptchaClaimsRecent(villId) {
    farmCaptchaClaimsPrune();
    const id = String(villId);
    return farmCaptchaClaims.some(e => e.villId === id);
  }
  function farmDayKey() {
    const serverDay = String(gbServerDay() || '');
    const parts = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(serverDay);
    return parts ? `${parts[1]}-${Number(parts[2])}-${Number(parts[3])}` : serverDay;
  }
  function farmClaimsToday() {
    // Pure read. Rollover lives in farmClaimCount so the day boundary is
    // crossed only under the 'claim' lock — a read from any other path can
    // no longer wipe the counts mid-batch.
    if (!state.farmClaimsToday || typeof state.farmClaimsToday !== 'object') state.farmClaimsToday = {};
    return state.farmClaimsToday;
  }
  function farmClaimCount(villId) {
    const day = farmDayKey();
    if (state.farmClaimsDay !== day) {
      state.farmClaimsDay = day;
      state.farmClaimsToday = {};
      saveSoon(STORE.FARM_CLAIMS_DAY, day);
    }
    const c = farmClaimsToday();
    c[String(villId)] = (+c[String(villId)] || 0) + 1;

    saveSoon(STORE.FARM_CLAIMS_TODAY, c);
    farmCaptchaClaimNote(villId);
  }
  function farmProfitScoreOf(villId) {
    const p = (state.farmProfit || {})[String(villId)];
    return p && p.score != null ? +p.score : null;
  }

  function farmApplyDropPolicies(ready) {
    if (!state.adaptiveFarm) return Array.isArray(ready) ? ready.slice() : [];
    farmPressureTick();
    const pressure = farmPressureOn();
    let work = ready.slice();
    if (pressure) {
      // An unranked village is UNKNOWN, not worthless - it is only dropped
      // while under pressure, and the log says how many so the operator can
      // tell "trimmed" from "broken".
      const known = work.filter(f => farmProfitScoreOf(f.vill_id) != null);
      const dropped = work.length - known.length;
      if (known.length) {
        work = known;
        if (dropped) gbLogT('farm-adaptive-unranked', 300000, `adaptive farm: pressure - dropped ${dropped} unranked village(s)`);
      }
    }
    if (pressure && work.length >= 4) {
      const pct = Math.max(0, Math.min(90, gbCfgNum(state.farmDropPressurePct, 25)));
      work.sort((a, b) => (farmProfitScoreOf(b.vill_id) ?? -Infinity) - (farmProfitScoreOf(a.vill_id) ?? -Infinity));
      const keep = Math.max(1, Math.ceil(work.length * (100 - pct) / 100));
      if (keep < work.length) {
        gbLogT('farm-adaptive-trim', 300000, `adaptive farm: pressure - claiming top ${keep}/${work.length} by yield`);
        work = work.slice(0, keep);
      }
    }
    if (farmCaptchaHot()) {
      const before = work.length;
      work = work.filter(f => !farmCaptchaClaimsRecent(f.vill_id));
      if (work.length < before) {
        gbLogT('farm-adaptive-daily', 300000, `adaptive farm: captcha hot - skipped ${before - work.length} village(s) claimed in this captcha window`);
      }
    }
    // Highest yield first even without pressure: same set, better order.
    work.sort((a, b) => (farmProfitScoreOf(b.vill_id) ?? -Infinity) - (farmProfitScoreOf(a.vill_id) ?? -Infinity));
    return work;
  }
  function farmLongClaimNow(reason, onDone) {
    const sec = farmLongClaimDuration();
    if (farmOptionFor(sec) == null) {
      gbLog(`long farm claim: ${farmDurLabel(sec)} option not learned yet - teach this Grepolis claim duration once by hand`);
      flash('claim largo: ensenale ' + farmDurLabel(sec));
      if (onDone) onDone(null);
      return false;
    }
    if (!state.autoFarm) {
      gbLog('long farm claim: auto-farm is OFF');
      flash('claim largo: auto-granjas APAGADO');
      if (onDone) onDone(null);
      return false;
    }
    gbLog(`long farm claim ${farmDurLabel(sec)}${reason ? ' (' + reason + ')' : ''}`);
    autoClaimFarms('long claim ' + farmDurLabel(sec), sec, onDone);
    return true;
  }
  // A village whose deadline moved proves the claim landed; the new
  // lootable_at is the server's own gather duration for the option posted.
  // Learn it, and when it contradicts what the map promised, say so once —
  // that mismatch is how the shipped 10min=2 default was caught gathering
  // 40min on a Booty world (v5.10.64).
  function farmVerifyLearnMap(f, now) {
    const posted = farmPostedOpts[String(f.vill_id)];
    if (!posted) return;
    const remaining = +f.lootable_at - now;
    if (!(remaining > 30)) return;
    const sec = farmSnapDuration(remaining);
    if (sec == null) return;
    const changed = farmOptionMapLearn(sec, posted.opt, 'verify');
    farmOptionSetDerive(sec, posted.opt);
    if (changed && posted.want && sec !== posted.want) {
      gbLog(`farm: wanted ${farmDurLabel(posted.want)} but option ${posted.opt} gathered ${farmDurLabel(sec)} — map corrected`);
    }
  }
  function verifyClaims(before, attempted) {
    const farms = farmsFromGame();
    if (!farms) return 0;
    const now = gameNow();
    const only = attempted ? new Set(attempted.map(f => String(f && f.vill_id))) : null;
    let updated = 0;
    farms.forEach(f => {

      if (!Object.prototype.hasOwnProperty.call(before, f.vill_id)) return;
      if (only && !only.has(String(f.vill_id))) return;
      if (f.lootable_at != null && f.lootable_at > now && before[f.vill_id] !== f.lootable_at) {
        updated++;
        farmVerifyLearnMap(f, now);
      }
    });
    gbLog(`farm claim verify: ${updated} village(s) now gathering${updated ? '' : ' - claims did NOT land (open Senado once, click Recoger manually, then paste me the Log tab)'}`);
    return updated;
  }

  const FARM_SCRAPE_DEAD_SWEEPS = 2;
  function farmScrapeState() {
    if (!state.farmScrapeState || typeof state.farmScrapeState !== 'object') {
      state.farmScrapeState = { dead: false, misses: 0 };
    }
    return state.farmScrapeState;
  }
  function farmScrapeSaveState() { save(STORE.FARM_SCRAPE_STATE, farmScrapeState()); }
  function farmScrapeEnabled() { return !!state.farmScrape && !farmScrapeState().dead; }

  function farmScrapeClearErrors() {
    const res = state.farmResources || {};
    let n = 0;
    Object.keys(res).forEach(k => { if (res[k] && !res[k].ok) { delete res[k]; n++; } });
    if (n) { save(STORE.FARM_RES, state.farmResources); renderFarms(); }
    return n;
  }
  function farmScrapeNoteSweep(token, okCount) {
    // Reject breaker updates from a callback whose lock has expired or been
    // re-acquired by a newer sweep - otherwise a stale 5min+ callback can
    // re-trip dead AFTER the new sweep just cleared it. Call BEFORE gbUnlock:
    // the token must still validate. OPEN-PLAN 1.3 / 8/23 audit #14.
    if (!token || !gbLockTouch('farm-scrape', token)) return;
    const st = farmScrapeState();
    if (okCount > 0) {
      if (st.misses || st.dead) { st.misses = 0; st.dead = false; farmScrapeSaveState(); }
      return;
    }
    st.misses = (st.misses || 0) + 1;
    if (st.misses >= FARM_SCRAPE_DEAD_SWEEPS && !st.dead) {
      st.dead = true;
      gbLog(`farm scrape: endpoint dead after ${st.misses} sweeps - disabling ` +
        '(hand-open a farming village once to teach the action, then re-enable in Config)');
      farmScrapeClearErrors();
    }
    farmScrapeSaveState();
  }
  function farmScrapeRevive(why) {
    const st = farmScrapeState();
    if (!st.dead && !st.misses) return false;
    st.dead = false;
    st.misses = 0;
    farmScrapeSaveState();
    gbLog('farm scrape: breaker cleared (' + (why || 'manual') + ')');
    return true;
  }
  const ACTION_GUESSES = ['farm_town_info', 'get_farm_towns', 'farm_town_overview'];
  const FARM_ACTION_OK = /^(farm_town_|get_farm|farm_info|island_farm)/;
  const FARM_ACTION_BAD = /farm_remove|village_attack|attack_log|farm_town_lock/;
  function farmGuesses() { return xhrGuessLadder(ACTION_GUESSES, state.farmAction); }
  function learnFarmAction(u) {
    const m = String(u || '').match(/[?&]action=([a-z0-9_]+)/i);
    if (!m) return;
    const a = m[1].toLowerCase();
    if (FARM_ACTION_BAD.test(a)) return;
    if (!FARM_ACTION_OK.test(a) && !(/^farm/.test(a) && /town|info|overview/.test(a))) return;
    if (state.farmAction === a) return;
    state.farmAction = a;
    save(wkey(STORE.FARM_ACTION), a);
    gbLog('learned farm action', a);

    farmScrapeRevive('learned action ' + a);
  }
  function fetchFarmResources(entry, onDone) {
    const guesses = farmGuesses();
    tryGuess(entry, 0, 0);
    function tryGuess(entry, i, pressureRetries) {
      if (!gbInstanceAlive() || !hostEnabled() || automationPaused({})) { if (onDone) onDone(false); return; }
      if (i >= guesses.length) {
        state.farmResources[entry.vill_id] = { ts: Date.now(), ok: false, err: 'no endpoint matched' };
        saveSoon(STORE.FARM_RES, state.farmResources);
        renderFarmsSoon();
        if (onDone) onDone(false);
        return;
      }
      const action = guesses[i];
      const params = new URLSearchParams();
      params.set('action', action);
      params.set('town_id', entry.vill_id);
      if (state.csrf) params.set('h', state.csrf);
      const u = '/index.php?' + params.toString();
      gbXhr({
        method: 'GET', url: u,
        anonymous: false, budget: 'scrape',
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json, text/plain, */*' },
        onload(res) {
          const retryMs = httpRetryAfterMs(res);
          if (retryMs) {
            state.farmResources[entry.vill_id] = { ts: Date.now(), ok: false, err: 'HTTP ' + res.status };
            saveSoon(STORE.FARM_RES, state.farmResources);
            const n = pressureRetries || 0;
            if (n >= 3) {
              state.farmResources[entry.vill_id] = { ts: Date.now(), ok: false, err: 'HTTP ' + res.status + ' retry limit' };
              saveSoon(STORE.FARM_RES, state.farmResources);
              if (onDone) onDone(false);
              return;
            }
            gbLogT('farm-http-' + res.status, 30000, `farm ${entry.vill_id}: HTTP ${res.status}, retry ${n + 1}/3 in ${retryMs}ms`);
            gbTimeout(() => tryGuess(entry, i, n + 1), retryMs);
            return;
          }
          if (res.status && res.status >= 400) {
            return tryGuess(entry, i + 1, 0);
          }
          const body = (res.responseText || '').slice(0, 500);

          const looksLikeJson = res.responseText && (res.responseText[0] === '{' || res.responseText[0] === '[');
          if (!looksLikeJson || /<html/i.test(body)) {

            return tryGuess(entry, i + 1, 0);
          }
          try {
            const p = parseResourceJson(JSON.parse(res.responseText));

            if (!p.got && i + 1 < guesses.length) return tryGuess(entry, i + 1, 0);
            if (state.farmAction !== action) {
              state.farmAction = action;
              save(wkey(STORE.FARM_ACTION), action);
              gbLog('farm endpoint =', action);
            }
            state.farmResources[entry.vill_id] = {
              ts: Date.now(),
              wood: p.wood, stone: p.stone, iron: p.iron,
              pop: p.pop, cap: p.cap, name: p.name,
              ok: true,
              action,
            };
          } catch (e) {
            if (i + 1 < guesses.length) return tryGuess(entry, i + 1, 0);
            state.farmResources[entry.vill_id] = { ts: Date.now(), ok: false, err: String(e).slice(0, 100) };
          }
          saveSoon(STORE.FARM_RES, state.farmResources);

          renderFarmsSoon();
          checkThresholdsSoon();
          if (onDone) onDone(!!state.farmResources[entry.vill_id].ok);
        },
        onerror(e) {

          const why = e && e.error ? String(e.error) : '';
          if (why === 'budget' || why === 'disabled' || why === 'disposed') {
            state.farmResources[entry.vill_id] = { ts: Date.now(), ok: false, err: why };
            saveSoon(STORE.FARM_RES, state.farmResources);
            if (onDone) onDone(false, why);
            return;
          }
          if (i + 1 < guesses.length) return tryGuess(entry, i + 1, 0);
          state.farmResources[entry.vill_id] = { ts: Date.now(), ok: false, err: 'network' };
          saveSoon(STORE.FARM_RES, state.farmResources);
          renderFarmsSoon();
          if (onDone) onDone(false);
        },
      });
    }
  }
  function pickNum(...candidates) {
    for (const c of candidates) {
      if (typeof c === 'number' && Number.isFinite(c)) return c;
      if (typeof c === 'string' && /^-?\d+(\.\d+)?$/.test(c)) return Number(c);
    }
    return null;
  }

  function scrapeAllFarms(force) {
    if (!hostEnabled() || automationPaused({})) return;
    if (force) farmScrapeRevive('manual sweep');
    if (!force && !farmScrapeEnabled()) {
      gbLogT('farm-scrape-off', 600000, 'farm scrape: off (' +
        (farmScrapeState().dead ? 'endpoint dead' : 'disabled in Config') + ')');

      const off = Date.now() + SYNC.FARM_MIN_MS;
      if (!(+state.nextFarmScrape > off)) {
        state.nextFarmScrape = off;
        save(STORE.NEXT_FARM, state.nextFarmScrape);
        renderTimers();
      }
      return;
    }
    if (gbLocked('farm-scrape')) { gbLogT('farm-scrape-inflight', 30000, 'farm scrape: skipped (in flight)'); return; }
    const farmScrapeLock = gbLock('farm-scrape', 300000);
    if (!farmScrapeLock) return;
    refreshFarmsParsed();
    const wait = SYNC.FARM_MIN_MS + Math.random() * (SYNC.FARM_MAX_MS - SYNC.FARM_MIN_MS);
    state.nextFarmScrape = Date.now() + wait;
    save(STORE.NEXT_FARM, state.nextFarmScrape);
    renderTimers();
    const list = state.farmsParsed.slice();
    const gameFarms = list.filter(f => f.fromGame).length;
    if (!list.length) {
      gbUnlock('farm-scrape', farmScrapeLock);
      gbLog('farm scrape: 0 farms known (no game data, textarea empty)');
      return;
    }
    gbLog(`farm scrape: ${list.length} farms (${gameFarms} auto-discovered, ${list.length - gameFarms} from textarea)`);
    let done = 0, ok = 0, hard = 0;

    const FARM_SCRAPE_HARD_ABORT = 3;

    (function step() {
      if (!gbLockTouch('farm-scrape', farmScrapeLock)) return;
      if (!hostEnabled() || automationPaused({})) {
        gbUnlock('farm-scrape', farmScrapeLock);
        gbLog(`farm scrape aborted (host/pause): ${ok}/${done} ok`);
        return;
      }
      const f = list.shift();
      if (!f) {
        if (done) farmScrapeNoteSweep(farmScrapeLock, ok);
        gbUnlock('farm-scrape', farmScrapeLock);
        gbLog(`farm scrape done: ${ok}/${done} ok, next in ${fmtSec(Math.round(wait / 1000))}`);
        flash(`farms ${ok}/${done} ok`);
        return;
      }
      fetchFarmResources(f, (good, why) => {
        done++; if (good) ok++;
        const err = (state.farmResources[f.vill_id] || {}).err || '?';
        if (!good) gbLog(`  farm ${f.vill_id}: no data (${err})`);
        if (!good && err === 'no endpoint matched') hard++;

        if (why === 'budget' || why === 'disabled' || why === 'disposed') {
          if (ok || hard) farmScrapeNoteSweep(farmScrapeLock, ok);
          gbUnlock('farm-scrape', farmScrapeLock);
          gbLog(`farm scrape stopped (${why}): ${ok}/${done} ok`);
          return;
        }

        if (!ok && hard >= FARM_SCRAPE_HARD_ABORT && list.length) {
          farmScrapeNoteSweep(farmScrapeLock, 0);
          gbUnlock('farm-scrape', farmScrapeLock);
          gbLog(`farm scrape stopped (no endpoint after ${hard} villages): 0/${done} ok`);
          return;
        }
        gbTimeout(step, 700 + Math.random() * 300);
      });
    })();
  }

  function farmTryDeriveOptionMap() {
    const out = {};
    try {
      const uw = gameUw();
      const gd = uw.GameData || {};
      const candidates = [
        gd.farm_town_offers, gd.FarmTownOffers, gd.farm_town_claim_options,
        gd.farm_towns && gd.farm_towns.offers,
      ];
      for (const c of candidates) {
        if (!c) continue;
        const list = Array.isArray(c) ? c : (typeof c === 'object' ? Object.keys(c).map(k => c[k]) : null);
        if (!list || !list.length) continue;
        list.forEach((opt, i) => {
          if (opt == null) return;
          const idx = opt.option != null ? +opt.option : (opt.id != null ? +opt.id : i + 1);

          const sec = pickNum(opt.duration, opt.time, opt.booty_duration, opt.collect_time);
          if (!(idx > 0) || !(sec > 0)) return;
          const snapped = farmSnapDuration(sec);
          if (snapped != null) out[String(snapped)] = idx;
        });
        if (out['600'] != null) break;
      }
    } catch (_) {}
    return out['600'] != null ? out : null;
  }
  function farmSetTeachBanner(msg) {
    state.farmTeachBanner = msg || '';
    save(STORE.FARM_TEACH_BANNER, state.farmTeachBanner);
    try { renderFarmTeachBanner(); } catch (_) {}
  }
  function renderFarmTeachBanner() {
    const el = panel && panel.querySelector('#gb-farm-teach-banner');
    if (!el) return;
    if (farmOptionFor(600) != null && state.farmTeachBanner) {
      state.farmTeachBanner = '';
      save(STORE.FARM_TEACH_BANNER, '');
    }
    const msg = state.farmTeachBanner || '';
    if (!msg) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = msg;
  }

  function farmLoyaltyAutoTeachTick() {
    if (!state.farmLongClaims) return;
    let anyLoyalty = false;
    try {
      const towns = townsFromGame() || state.towns || [];
      for (const t of towns) {
        const r = farmLoyaltyProbe(t.id);
        farmLoyaltyCache[t.id] = { ts: Date.now(), val: r.val, hit: r.hit };
        if (r.val) {
          anyLoyalty = true;
          if (!String(state.farmLoyaltyTech || '').trim() && r.hit) farmLoyaltyLearnTech(r.hit);
          break;
        }
      }
    } catch (_) {}
    const seen = !!state.farmLoyaltySeen;
    if (!anyLoyalty) {
      if (seen) {
        state.farmLoyaltySeen = false;
        save(STORE.FARM_LOYALTY_SEEN, false);
      }
      return;
    }
    if (farmOptionFor(600) != null) {
      if (!seen) { state.farmLoyaltySeen = true; save(STORE.FARM_LOYALTY_SEEN, true); }
      if (state.farmTeachBanner) farmSetTeachBanner('');
      return;
    }
    const flip = !seen;
    if (!flip && state.farmTeachBanner) return;
    state.farmLoyaltySeen = true;
    save(STORE.FARM_LOYALTY_SEEN, true);
    const derived = farmTryDeriveOptionMap();
    if (derived && derived['600'] != null) {

      const map = Object.assign({}, state.farmOptionMap || {}, derived);
      state.farmOptionMap = map;
      save(wkey(STORE.FARM_OPTION_MAP), map);
      gbLog(`farm: loyalty auto-teach provisional 10min option=${derived['600']} (confirm on next claim)`);
      farmSetTeachBanner('');
      return;
    }
    farmSetTeachBanner('Investigacion de lealtad completada. Haz una recogida de 10 minutos a mano para ensenarselo al bot.');
    gbLog('farm: loyalty researched - 10min option unknown; hand-claim once to teach');
  }
  function farmTick() {
    try { gbWakeGapTick(); } catch (_) {}
    const run = () => {
      const now = Date.now();
      if (hostEnabled() && !automationPaused({})) {
        if (now >= state.nextFarmScrape) scrapeAllFarms();
        if (now >= state.nextTownsScrape) scrapeAllTowns();
        if (state.autoFarm) farmScheduleClaimWake(null, 'farm-tick', true);
      }
      try { farmLoyaltyAutoTeachTick(); } catch (_) {}
      try { renderFarmTeachBanner(); } catch (_) {}
    };
    if (typeof gbInWakeBurst === 'function' && gbInWakeBurst()) {
      gbWake('farmTick', run, { priority: 20 });
      return;
    }
    run();
  }
