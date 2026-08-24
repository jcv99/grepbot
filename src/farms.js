  function sniffBridgeBody(u, body) {
    try {
      if (!body || typeof body !== 'string' || !/frontend_bridge/.test(String(u))) return;
      const parsedSelfCheck = parseBodyLoose(body);
      if (parsedSelfCheck && isSelfBridge(parsedSelfCheck)) return;
      if (/FarmTownPlayerRelation/.test(body)) {
        gbLog('sniffed farm bridge call:', body.slice(0, 300));
        const j = parseBodyLoose(body);
        if (j && j.model_url && /claim/i.test(j.action_name || '')) {
          state.claimTpl = {
            model_url: j.model_url, action_name: j.action_name,
            arguments: j.arguments || {}, town_id: j.town_id,
            version: 1, learned_at: Date.now(),
          };
          save(wkey(STORE.CLAIM_TPL), state.claimTpl);
          gbLog('learned claim template:', JSON.stringify(state.claimTpl).slice(0, 200));
          try { tplHealthMarkLearned('claimTpl'); } catch (_) {}

          if (!isSelfBridge(j)) farmLearnFromClaim(j);
        } else if (j && j.model_url && !/claim|trade|unlock|upgrade/i.test(j.action_name || '')
                   && /sword|archer|hoplite|slinger/i.test(body)) {

          // Anything on FarmTownPlayerRelation that isn't claim/trade/unlock/upgrade
          // and carries one of the 4 unit ids is treated as the village
          // accept-units template. The action_name (and any extra arguments the
          // server demands) is captured verbatim; villageAcceptUnits() replays it
          // with the village id / amount overlaid at post time.
          if (isSelfBridge(j)) return;
          state.acceptUnitsTpl = {
            model_url: j.model_url, action_name: j.action_name,
            arguments: j.arguments || {}, town_id: j.town_id,
            version: 1, learned_at: Date.now(),
          };
          save(wkey(STORE.ACCEPT_UNITS_TPL), state.acceptUnitsTpl);
          gbLog('learned accept-units template:', JSON.stringify(state.acceptUnitsTpl).slice(0, 220));
          try { tplHealthMarkLearned('acceptUnitsTpl'); } catch (_) {}
        }
      } else if (/PlayerAttackSpot/.test(body)) {
        gbLog('sniffed bandit bridge call:', body.slice(0, 300));
      } else if (/BuildingOrder/.test(body) && /Instant|instant/i.test(body)) {
        const j = parseBodyLoose(body);
        if (j && j.action_name && /instant/i.test(j.action_name)) {
          if (typeof ibLearnAction === 'function') {
            ibLearnAction('build', j.action_name);
            gbLog('learned instant-build action:', j.action_name);
          } else {
            state.ibAction = j.action_name;
            save(wkey(STORE.IB_ACTION), state.ibAction);
            gbLog('learned instant-build action:', state.ibAction);
          }
        }
      } else if (/ResearchOrder/.test(body) && /Instant|instant/i.test(body)) {
        const j = parseBodyLoose(body);
        if (j && j.action_name && /instant/i.test(j.action_name)) {
          if (typeof ibLearnAction === 'function') {
            ibLearnAction('research', j.action_name);
            gbLog('learned instant-research action:', j.action_name);
          } else {
            state.ibActionR = j.action_name;
            save(wkey(STORE.IB_ACTION_R), state.ibActionR);
            gbLog('learned instant-research action:', state.ibActionR);
          }
        }
      } else if (/Town/.test(body) && /"type"\s*:\s*"support"/.test(body)) {

        // v4 plan 3.2. This branch MUST come before the attack branch below: a
        // support payload is also Town/<id> + sendUnits, so the attack branch
        // would otherwise learn it as attackTpl - exactly the cross-feature
        // template poisoning the separate supportTpl exists to prevent.
        const j = parseBodyLoose(body);
        if (j) supportLearnTemplate(j);
      } else if (/model_url.*Town\//i.test(body) || (/Town/.test(body) && /attack|sendUnits/i.test(body))) {
        const j = parseBodyLoose(body);

        // Belt and braces: never store a support payload as the attack template.
        if (j && j.arguments && String(j.arguments.type || '') === 'support') { supportLearnTemplate(j); return; }
        if (j && j.model_url && /attack|sendUnits/i.test(j.action_name || '')) {
          state.attackTpl = {
            model_url: j.model_url, action_name: j.action_name,
            arguments: j.arguments || {}, town_id: j.town_id,
            version: 1, learned_at: Date.now(),
          };
          save(wkey(STORE.ATTACK_TPL), state.attackTpl);
          gbLog('learned attack template:', JSON.stringify(state.attackTpl).slice(0, 200));
          try { tplHealthMarkLearned('attackTpl'); } catch (_) {}
          const destId = j.arguments && j.arguments.id;
          if (destId != null && typeof attackRememberTarget === 'function') {
            attackRememberTarget(destId, { src: 'manual-attack' });
          }
        }
      } else if (/spy|espionage|espia/i.test(body) && /model_url/.test(body)) {

        // v4 plan 4.1: the spy route is unknown to this tree, so it is learned
        // from the player's own hand-sent spy and never guessed.
        const j = parseBodyLoose(body);
        if (j && j.action_name && /spy|espionage/i.test(String(j.action_name))) spyLearnTemplate(j);
      } else if (/Command/.test(body) && /cancelCommand|cancel_command/i.test(body)) {
        const j = parseBodyLoose(body);
        if (j && j.action_name && /cancelCommand|cancel_command/i.test(j.action_name) && !isSelfBridge(j)) {
          state.cancelTpl = {
            model_url: j.model_url || 'Command', action_name: j.action_name,
            arguments: j.arguments || {}, town_id: j.town_id, version: 1, learned_at: Date.now(),
          };
          save(STORE.CANCEL_TPL, state.cancelTpl);
          gbLog('learned cancel template:', JSON.stringify(state.cancelTpl).slice(0, 200));
        }
      } else if (/Wonder|wonder/i.test(body) && /cast|devote|contribute|favor/i.test(body) && /power|cast/i.test(body)) {
        const j = parseBodyLoose(body);
        if (j && j.action_name && !isSelfBridge(j)) {
          state.wonderFavorTpl = {
            model_url: j.model_url, action_name: j.action_name,
            arguments: j.arguments || {}, town_id: j.town_id,
            version: 1, learned_at: Date.now(),
          };
          save(wkey(STORE.WONDER_FAVOR_TPL), state.wonderFavorTpl);
          gbLog('learned wonder favor template:', j.action_name);
          try { tplHealthMarkLearned('wonderFavorTpl'); } catch (_) {}
        }
      } else if (/PlayerHero/.test(body) && /assignToTown|unassignFromTown|cancelTownTravel/i.test(body)) {
        const j = parseBodyLoose(body);
        if (j && j.action_name && !isSelfBridge(j)) {
          if (!state.heroTpl || typeof state.heroTpl !== 'object') state.heroTpl = {};
          state.heroTpl[j.action_name] = {
            model_url: j.model_url || 'PlayerHero', action_name: j.action_name,
            arguments: j.arguments || {}, town_id: j.town_id, version: 1, learned_at: Date.now(),
          };
          save(STORE.HERO_TPL, state.heroTpl);
          gbLog('learned hero template:', j.action_name, JSON.stringify(state.heroTpl[j.action_name]).slice(0, 160));
        }
      } else if (/IslandQuest|Progressable|claimReward|island_quest/i.test(body)) {
        const j = parseBodyLoose(body);
        if (j && !isSelfBridge(j)) {
          gbLogT('quest-sniff', 30000, 'sniffed quest bridge:', body.slice(0, 200));
          learnQuestRewardsFromPayload(j, j.progressable_id || (j.arguments && j.arguments.progressable_id));
        }
      }
    } catch (_) {}
  }
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
  // Farm claims are deadline-driven: adaptive orchestrator backoff must never sleep
  // past a known lootable_at. The dedicated wake timer only triggers the existing
  // transactional claim path; it does not bypass any claim/captcha/warehouse guard.
  const FARM_CLAIM_WAKE_GRACE_MS = 1500;
  const FARM_CLAIM_READY_WAKE_MS = 750;
  const FARM_CLAIM_READY_RETRY_MS = 5000;
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
    // v2.2.4: if villages are already claimable (for example after reload, tab focus,
    // or while the adaptive scheduler is backed off), do not wait for the next
    // orchestrator cadence. Wake the existing transactional claim path immediately.
    if (allowExpiredRetry && t.ready > 0) {
      const delay = gbLocked('claim') || reason === 'post-claim' ? FARM_CLAIM_READY_RETRY_MS : FARM_CLAIM_READY_WAKE_MS;
      targetMs = Date.now() + delay;
    } else if (Number.isFinite(t.nextAt)) {
      targetMs = Date.now() + Math.max(0, (t.nextAt - t.now) * 1000) + FARM_CLAIM_WAKE_GRACE_MS;
    } else if (allowExpiredRetry && t.expiredModelWait > 0) {
      targetMs = Date.now() + FARM_CLAIM_READY_RETRY_MS;
    }
    if (!targetMs) return null;
    // Keep an already scheduled wake if it is at least as early as the new target.
    if (farmClaimWakeTimer && farmClaimWakeAt && farmClaimWakeAt <= targetMs + 1000) return farmClaimWakeAt;
    farmCancelClaimWake();
    farmClaimWakeAt = targetMs;
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
      ((farmCol && farmCol.models) || []).forEach(m => { const a = m.attributes || {}; farmById[a.id] = a; });
      const out = [];
      const statusCount = {};
      let noRelId = 0;
      relCol.models.forEach(r => {
        const a = r.attributes || {};
        statusCount[a.relation_status] = (statusCount[a.relation_status] || 0) + 1;
        if (!farmBelongsToPlayer(r, a)) return;
        const relId = r.id ?? a.id;
        if (relId == null) { noRelId++; return; }
        const f = farmById[a.farm_town_id] || {};
        out.push({
          vill_id: String(a.farm_town_id),
          relation_id: relId,
          x: f.island_x ?? null,
          y: f.island_y ?? null,
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
    const game = farmsFromGame() || [];
    const manual = parseFarms(state.farms);
    const seen = new Set(game.map(f => f.vill_id));
    return game.concat(manual.filter(f => !seen.has(f.vill_id)));
  }
  let farmsParsedSig = null;
  function refreshFarmsParsed() {
    state.farmsParsed = mergedFarms();

    const sig = JSON.stringify(state.farmsParsed);
    if (sig === farmsParsedSig) return;
    farmsParsedSig = sig;
    save(STORE.FARMS_PARSED, state.farmsParsed);

    const ids = state.farmsParsed.map(f => f.vill_id);
    if (pruneMapsToIds(state.farmResources, ids)) save(STORE.FARM_RES, state.farmResources);
    if (pruneMapsToIds(state.alerted, ids)) save(STORE.ALERTED, state.alerted);
    if (pruneMapsToIds(state.thresholds, ids)) save(STORE.THRESH, state.thresholds);
    if (pruneMapsToIds(state.farmProfit, ids)) save(STORE.FARM_PROFIT, state.farmProfit);
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
        const key = x + ',' + y;
        if (!Array.isArray(map[key])) map[key] = [];
        map[key].push(String(tid));
      }
    } catch (_) {}
    return map;
  }
  function townIdForFarm(farm, islandMap) {

    if (farm.x == null || farm.y == null) return null;
    const map = islandMap || islandTownMap();
    const hit = map[farm.x + ',' + farm.y];
    const ids=Array.isArray(hit)?hit:(hit!=null?[hit]:[]);if(!ids.length)return null;
    ids.sort((a,b)=>{const A=townWarehouseState(a),B=townWarehouseState(b);const af=A&&A.cap>0?A.cap-Math.max(+A.wood||0,+A.stone||0,+A.iron||0):-1;const bf=B&&B.cap>0?B.cap-Math.max(+B.wood||0,+B.stone||0,+B.iron||0):-1;return bf-af});
    return ids.find(id=>!townWarehouseBlocks(id))||ids[0];
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
  const FARM_DURATIONS = [300, 600, 1200, 2400, 5400, 10800, 14400, 28800];
  function farmDurLabel(sec) {
    if (sec >= 3600) return (sec / 3600) + 'h';
    return Math.round(sec / 60) + 'min';
  }
  function farmOptionFor(sec) {
    const m = state.farmOptionMap || {};
    const v = m[String(sec)];
    return v == null ? null : +v;
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
  // A hand claim teaches one of two maps: the duration->option map (resource
  // half) or the unit card index (unit half). They are separate learned keys on
  // purpose - sharing one would map a unit index onto a claim duration.
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

        // The 4s re-read races the server: on a slow update the lootable_at is
        // still the OLD value, and snapping the new option to the OLD duration
        // mis-maps every future claim for that duration. Require a finite,
        // positive remaining window bounded by the longest known duration so
        // we only accept a freshly-landed server reply.
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
  // sleep-claim (one big overnight auto-claim of all ready villages) removed
  // in v5.10.8. The shared `autoClaimFarms` path still claims on the adaptive
  // cadence; the night-only toggle, fill gate and learn-once-a-day wiring are
  // gone with it. Duration probe (28800/14400) lives in no caller now.
  // Adaptive claim duration: among the durations that are actually learnable
  // here (state.farmOptionMap), pick the longest one whose expected haul still
  // fits the town warehouse headroom. The 20min / 40min / 90min / 3h options
  // were reachable and unused - claiming less often means fewer captcha slots
  // and more loot per request.
  const FARM_PICK_MAX = 14400;
  const FARM_PICK_LADDER = [600, 1200, 2400, 5400, 10800, FARM_PICK_MAX];
  function farmDurationPick(townId) {
    if (!state.farmLongClaims) return 300;
    const learned = FARM_PICK_LADDER.filter(sec => farmOptionFor(sec) != null);
    if (!learned.length) return 300;
    // If loyalty isn't researched, the longer options are not necessarily free
    // of the loyalty multiplier, so prefer them only when headroom allows.
    const rs = (typeof townResState === 'function') ? townResState(townId) : null;
    const headroom = rs && rs.cap > 0 ? Math.max(0, rs.cap - Math.max(rs.wood, rs.stone, rs.iron)) : null;
    // loyalty is deliberately 1.0, NOT farmLoyaltyResearched(townId) ? 1 : 0.5.
    // Plan 2.12 suggested the 0.5 factor but cites no evidence for it, and
    // getting it wrong in that direction is asymmetric: a halved estimate lets
    // the picker choose a claim roughly twice as long as the warehouse can
    // absorb, and the overflow is loot thrown away. 1.0 reproduces the numerics
    // this picker has always used. The parameter stays in the API so a verified
    // multiplier can be dropped in later.
    let best = 300;
    for (const sec of learned) {
      // The haul estimate now lives in gbLootEstimate (v4 plan 2.12) so the
      // rate constant has one home. Skip a duration only when fits === false;
      // fits === null means headroom was unreadable and must not block the
      // longer claim.
      const est = gbLootEstimate({ kind: 'farm-claim', durationSec: sec, loyalty: 1.0, headroom });
      if (est.meta.fits === false) continue;
      if (sec > best) best = sec;
    }
    return best;
  }
  function farmDesiredDuration(townId) { return farmDurationPick(townId); }
  // ===== Farm profitability ranking (v4 plan 2.6) ============================
  // An ESTIMATE, and deliberately so: per-village stock is not in the bridge
  // model (plan 26 A1 proved the HTTP scrape dead) and the claim callback
  // carries no haul amount, so real yield per village is unknowable here. What
  // IS readable - island coordinates, the durations the player hand-taught,
  // loyalty research, and the owning town's warehouse headroom - is enough to
  // rank villages against each other. The haul math itself comes from
  // gbLootEstimate (v4 plan 2.12) so the rate constant has one home.
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
    // A blind verdict gets a much shorter TTL: a town whose capacity becomes
    // readable a second later must not stay unranked for five minutes.
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
    // Distance is in island-coordinate units. The in-game march formula is not
    // in the bridge model, so seconds-per-unit is a user-pinned number and
    // defaults to 0 - the rank is distance-agnostic until the player pins one.
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
  // renderFarms fires on tab activation, every resource fetch, every attack
  // send and every threshold save. Rebuilding islandTownMap on each of those
  // is pure waste; the per-village memo already bounds the expensive part.
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
  // ===== Village unit half ==================================================
  // Resources are ALWAYS the better claim: they cost no population and feed
  // every other feature. Units are only ever asked for when the resource half
  // is provably unavailable (mode 'fallback'), or when the operator pins
  // 'always'. Nothing here may guess: an unreadable table is UNKNOWN and the
  // unit claim is skipped, never posted on a guessed option index.
  const FARM_UNIT_ORDER = ['sword', 'slinger', 'archer', 'hoplite'];
  function farmUnitIdFor(option) { return FARM_UNIT_ORDER[(+option || 0) - 1] || null; }
  function farmVillageLevel(farm) {
    const rel = farm && farm._rel;
    const a = (farm && farm._attrs) || {};
    let level = null;
    try { if (rel && typeof rel.getLevel === 'function') level = +rel.getLevel(); } catch (_) {}
    if (Number.isFinite(level)) return level;
    const status = +a.relation_status;
    if (status === 0) return 0;
    return Number.isFinite(+a.expansion_stage) ? +a.expansion_stage : null;
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
      if (tid == null) { try { tid = uwCached().Game && uwCached().Game.townId; } catch (_) { tid = null; } }
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
      const amount = +table[unit];
      if (!Number.isFinite(amount) || amount <= 0) continue;
      if (townId != null && farmUnitsClaimBlocked(farm, townId, opt)) continue;
      const def = gbGameDataLookup('units', unit);
      const res = (def && def.resources) || null;
      // Resource value of the card, not unit count: 3 swords are not 3 biremes.
      const cost = res ? (+res.wood || 0) + (+res.stone || 0) + (+res.iron || 0) : 0;
      const score = amount * (cost > 0 ? cost : 1);
      if (!best || score > best.score) best = { opt, score };
    }
    return best ? best.opt : null;
  }
  // Remaining resource allowance for today, or null when any input is blind.
  function farmDailyLeft(farm) {
    const rel = farm && farm._rel;
    const a = (farm && farm._attrs) || {};
    const level = farmVillageLevel(farm);
    if (!Number.isFinite(level)) return null;
    const table = gbGameDataLookup('farm_town', 'max_resources_per_day');
    const perDay = table ? +table[level] : NaN;
    if (!Number.isFinite(perDay) || perDay <= 0) return null;
    let speed = null;
    try { speed = +(uwCached().Game && uwCached().Game.game_speed); } catch (_) {}
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
    // GameData.farm_town.claim_units[level] is the only proof the card exists
    // and how many units it hands over. Unreadable = post nothing: a pinned
    // unit is an operator preference, never evidence the village offers it.
    if (!table) return 'unit-table-unreadable';
    if (table[unit] == null) return 'unit-not-offered';
    let amount = null;
    const n = +table[unit];
    if (Number.isFinite(n)) {
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
  // true only when the village itself reports every resource card at zero.
  // Unreadable values are null (UNKNOWN) - never treated as "empty".
  //
  // The client getter may NOT be trusted blind. Its own source is:
  //   getClaimResourceValues: function(){ var e = this.get('claim_resource_values');
  //     if (e && e.length) return e; else return {0:0,1:0,2:0,3:0,4:0}; }
  // With the attribute not yet loaded it hands back a zero-filled SENTINEL,
  // which read as data says "every card is empty" for a village nobody has
  // touched - that is what flipped villages onto the unit half while the
  // resource half was untouched. The sentinel is a plain object with no
  // .length; the real value is the array the cards index as [option-1]. So the
  // raw attribute is preferred, the getter is accepted only when it comes back
  // array-shaped, and anything else is UNKNOWN.
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
  // A hard error on a resource claim is NOT proof the village is out of
  // resources - a stale template, a warehouse race or one server hiccup all
  // land here, and the resource half is the strictly better claim. So the bot
  // keeps re-probing resources: three CONSECUTIVE hard errors inside the
  // window mark the village, and the mark itself expires, so no village is
  // ever stuck on units for the rest of the day.
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
    // Strikes must be consecutive in time, not merely counted across a day.
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
  // The one place that decides which half of a village is claimed.
  function farmClaimTypeFor(farm) {
    const mode = String(state.farmUnitsMode || 'off');
    if (mode === 'always') return 'units';
    if (mode !== 'fallback') return 'resources';
    const left = farmDailyLeft(farm);
    if (left != null && left <= 0) {
      gbLogT('farm-daily-cap-' + farm.vill_id, 600000,
        `farm: village ${farm.vill_id} daily resource allowance spent - claiming units`);
      return 'units';
    }
    const exhausted = farmResExhausted(farm);
    if (exhausted === true) return 'units';

    // Readable, non-empty cards outrank the error ledger. A strike streak only
    // proves the POST failed - a stale claimTpl, a warehouse race or a server
    // hiccup all land there - and the village itself is saying the resource
    // half still has something to give, so keep re-probing resources.
    if (exhausted === false) return 'resources';
    return farmResDryMarked(farm.vill_id) ? 'units' : 'resources';
  }
  function farmClaimDiag(limit) {
    const farms = farmsFromGame();
    if (!farms) { gbLog('farm diag: game collections not ready'); return; }
    const islandMap = islandTownMap();
    const speed = (() => { try { return +(uwCached().Game && uwCached().Game.game_speed); } catch (_) { return null; } })();
    const perDayTable = gbGameDataLookup('farm_town', 'max_resources_per_day');
    const unitTable = farmClaimUnitsTable(farms[0]);
    gbLog(`farm diag: mode=${state.farmUnitsMode || 'off'} pick=${state.farmUnitsPref || 'auto'} learnedUnitOpt=${state.farmUnitsOption == null ? '-' : state.farmUnitsOption}` +
      ` game_speed=${Number.isFinite(speed) ? speed : 'UNREADABLE'}` +
      ` max_resources_per_day=${perDayTable ? 'ok' : 'UNREADABLE'}` +
      ` claim_units=${unitTable ? JSON.stringify(unitTable).slice(0, 120) : 'UNREADABLE'}` +
      ` optionMap=${farmOptionMapText()}`);
    const n = Math.max(1, Math.min(+limit || 8, farms.length));
    for (const f of farms.slice(0, n)) {
      const tid = townIdForFarm(f, islandMap);
      const left = farmDailyLeft(f);
      const type = farmClaimTypeFor(f);
      const opt = type === 'units' ? farmUnitOption(f, tid) : null;
      const blocked = (type === 'units' && opt != null && tid != null) ? farmUnitsClaimBlocked(f, tid, opt) : null;
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
    if (farms.length > n) gbLog(`  … ${farms.length - n} more village(s) not shown`);
  }
  function claimFarm(farm, islandMap, whCache, durOverride, onDone) {
    const done = (err) => { if (onDone) onDone(err); };
    if (captchaPaused('farm')) return done('captcha');
    const tid = +townIdForFarm(farm, islandMap);
    if (!tid) {
      gbLogT('claim-no-town', 60000, `farm claim skip ${farm.vill_id}: no same-island town`);
      return done('skip');
    }
    const claimType = farmClaimTypeFor(farm);

    // Warehouse capacity only gates the resource half - a unit card stores no
    // loot, so a full warehouse must not block it.
    if (claimType === 'resources') {
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
    const wantSec = durOverride || farmDesiredDuration(tid);
    let option = farmOptionFor(wantSec);
    if (option == null) {

      const fallback = farmOptionFor(300);
      if (fallback == null) {
        gbLogT('farm-opt-' + wantSec, 900000,
          `farm claim: option index for ${farmDurLabel(wantSec)} unknown and no learned 5min index - claim once by hand in game to teach it`);
        return done('skip');
      }
      gbLogT('farm-opt-' + wantSec, 900000,
        `farm claim: option index for ${farmDurLabel(wantSec)} unknown - claim that timer once by hand in game to teach it (using learned 5min)`);
      option = fallback;
    }

    const args = Object.assign({}, tplArgs, { type: 'resources', option, farm_town_id: +farm.vill_id });
    bridgePost('farm', {
      model_url: `FarmTownPlayerRelation/${farm.relation_id}`,
      action_name: (state.claimTpl && state.claimTpl.action_name) || 'claim',
      arguments: args,
      town_id: tid,
    }, (err) => {
      if (!err && whCache) delete whCache[tid];

      // 'remembered' is the bot's own skip window, not the server saying the
      // village is empty - it must never flip a village to unit claims.
      const hard = err && err !== 'remembered' && !JRN_SKIP_ERRS[String(err).split(':')[0]] && err !== 'captcha' && !jrnPendingResult(err);
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
  // Farm-first (hard rule): unit production never takes a dispatch slot while a
  // farming-village claim is still possible. Mirrors the eligibility filter in
  // autoClaimFarms exactly - lootable AND an owning town whose warehouse can
  // still store the loot - so a warehouse-full town reports NO pending work,
  // which is the one case where spending resources unblocks farming again.
  // Unreadable collections are UNKNOWN, never "pending", so a blind read cannot
  // deadlock recruitment; a farm captcha pause is likewise not pending.
  // ===== Farm precedence (hard rule) ========================================
  // Unit production never posts while a farming-village claim is still
  // possible. A claim is free income on a village timer; spending a
  // request-budget slot (and a captcha risk) on recruitment while a village
  // sits ready is always the worse trade. The predicate is read-only and
  // mirrors the eligibility filter in autoClaimFarms exactly - lootable AND an
  // owning town whose warehouse can still store the loot - so a warehouse-full
  // town reports NO pending work: that is precisely the case where recruiting
  // is what unblocks farming again.
  //
  // Unreadable collections are UNKNOWN, never "pending": a blind read may not
  // deadlock recruitment forever. A farm captcha pause is likewise "not
  // pending" - farm cannot post, so holding units behind it buys nothing.
  const FARM_PENDING_MEMO_MS = 3000;
  let farmPendingMemo = { at: 0, val: false, locked: 0 };
  function farmClaimPending() {
    if (!state.autoFarm || !hostEnabled()) return false;
    if (captchaPaused('farm')) return false;
    // A claim batch in flight IS farm work - hold units without re-walking the
    // collections (the lock is cheap, the walk is not).
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
          const tid = townIdForFarm(f, islandMap);
          if (!tid) continue;
          if (!(tid in whCache)) whCache[tid] = townWarehouseBlocks(tid);
          if (whCache[tid]) continue;
          val = true;
          break;
        }
      }
    } catch (_) { val = false; }
    farmPendingMemo = { at: stamp, val, locked: 0 };
    return val;
  }
  // One log line per 5min per holder, not per skipped scan.
  function farmFirstHold(who) {
    if (!farmClaimPending()) return false;
    gbLogT('farm-first-' + who, 300000, `${who}: held - farming village claim pending (farm-first)`);
    return true;
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
      const tid = townIdForFarm(f, islandMap);
      if (!tid) return false;

      if (farmClaimTypeFor(f) === 'units') return true;
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

      // The adaptive scheduler may be at x8, but a known village deadline takes priority.
      // If lootable_at has expired while isLootable() is briefly stale, retry after 5s.
      farmScheduleClaimWake(farms, 'next-lootable', skippedFull === 0);
      if (onBatchDone) onBatchDone({ done: 0, attempted: 0, captcha: false });
      return;
    }

    // v4 plan 5.2: trim the SET under pressure rather than widening the cadence,
    // and claim the highest-yield villages first. `before` below still keys off
    // every farm, so a partial drop does not affect reconciliation.
    const work = farmApplyDropPolicies(ready);
    if (!work.length) {
      gbLogT('claim-adaptive-empty', 300000, 'farm claim: adaptive policy dropped every candidate this pass');

      // Arm the precise next-lootable wake exactly like the no-candidates path
      // above: without it the retry falls back to the 15s farmTick sweep.
      farmScheduleClaimWake(farms, 'adaptive-empty', true);
      if (onBatchDone) onBatchDone({ done: 0, attempted: 0, captcha: false });
      return;
    }
    const claimLockToken = gbLock('claim', Math.max(180000, work.length * 20000));
    if (!claimLockToken) return;
    const unitCount = work.filter(f => farmClaimTypeFor(f) === 'units').length;
    gbLog(`farm claim${reason ? ' (' + reason + ')' : ''}: ${work.length}/${farms.length} ready${work.length !== ready.length ? ` (${ready.length - work.length} adaptivo)` : ''}${skippedFull ? ` (${skippedFull} warehouse-full)` : ''}${unitCount ? ` (${unitCount} as units)` : ''}`);
    const before = {};
    farms.forEach(f => { before[f.vill_id] = f.lootable_at; });
    flash(`farm claim x${work.length}`);

    const outcome = Object.create(null);
    let i = 0, done = 0, captcha = false;
    const claimSpacingMs=Math.max(700,Math.ceil(60000/Math.max(5,(+state.reqBudgetPerMin||40)-4)));
    (function next() {
      if (!gbLockTouch('claim', claimLockToken)) return;
      if (i >= work.length || captcha || captchaPaused('farm')) {
        const tally = Object.keys(outcome).map(k => `${k}x${outcome[k]}`).join(' ');
        if (tally) gbLog(`  claim outcomes: ${tally}`);
        gbTimeout(() => {
          try {
            const flipped = verifyClaims(before, work);

            // Re-read model deadlines after the batch and arm the next exact claim wake.
            farmScheduleClaimWake(null, 'post-claim', true);

            if (onBatchDone) onBatchDone({
              done: flipped,
              attempted: work.length,
              captcha,
              bridgeOk: done,
            });
          } finally { gbUnlock('claim', claimLockToken); }
        }, 10000);
        return;
      }
      const f = work[i++];
      try {
        claimFarm(f, islandMap, whCache, durOverride, (err) => {
          const key = String(err || 'ok').slice(0, 24);
          outcome[key] = (outcome[key] || 0) + 1;
          if (err === 'captcha' || err === 'captcha-pause') { captcha = true; farmPressureNote('captcha'); }
          else if (!err) {
            done++;

            // Counted only on a confirmed bridge ok, so a failed post cannot
            // consume the village's daily allowance.
            try { farmClaimCount(f.vill_id); } catch (_) {}
            gbLog(`  claimed ${f.name || f.vill_id} (rel ${f.relation_id})`);
          }

          gbTimeout(next, claimSpacingMs);
        });
      } catch (e) {
        gbLog('  claim FAIL', f.vill_id, String(e));
        gbTimeout(next, claimSpacingMs);
      }
    })();
  }
  // ===== Adaptive farming (v4 plan 5.2) ======================================
  // Under pressure - captcha, server cooldown, or a soft request-budget delay -
  // the claim set is TRIMMED rather than the cadence widened. These are drop
  // policies on the existing loop: no new post, no new template, no new captcha
  // key, no new lock. The claim lock and spacing already serialise everything.
  const FARM_PRESSURE_TTL_MS = 1800000;
  const FARM_PRESSURE_WINDOW_MS = 300000;
  const FARM_PRESSURE_MAX = 8;
  const farmPressure = [];
  function farmPressureNote(kind) {
    const now = Date.now();
    // Coalesce: one burst of the same kind is one signal, not eight.
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
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }
  function farmClaimsToday() {
    const day = farmDayKey();
    if (state.farmClaimsDay !== day) {
      // Day rollover. The two sync save() calls in the previous shape opened
      // an order-of-write window where a parallel caller could observe
      // state.farmClaimsDay = new but state.farmClaimsToday still being the
      // previous day's stale object (or vice versa). Coalesce both writes
      // through saveSoon so the storage snapshot always lands as a pair, and
      // let the first increment in the new day pin the day key. OPEN-PLAN
      // 1.2 / 8/23 audit #13.
      state.farmClaimsDay = day;
      state.farmClaimsToday = {};
    }
    if (!state.farmClaimsToday || typeof state.farmClaimsToday !== 'object') state.farmClaimsToday = {};
    saveSoon(STORE.FARM_CLAIMS_DAY, state.farmClaimsDay);
    saveSoon(STORE.FARM_CLAIMS_TODAY, state.farmClaimsToday);
    return state.farmClaimsToday;
  }
  function farmClaimCount(villId) {
    const c = farmClaimsToday();
    c[String(villId)] = (+c[String(villId)] || 0) + 1;

    saveSoon(STORE.FARM_CLAIMS_TODAY, c);
    farmCaptchaClaimNote(villId);
  }
  function farmProfitScoreOf(villId) {
    const p = (state.farmProfit || {})[String(villId)];
    return p && p.score != null ? +p.score : null;
  }
  // Returns a NEW array; never mutates the caller's list.
  function farmApplyDropPolicies(ready) {
    if (!state.adaptiveFarm) return ready.slice();
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
  function verifyClaims(before, attempted) {
    const farms = farmsFromGame();
    if (!farms) return 0;
    const now = gameNow();
    const only = attempted ? new Set(attempted.map(f => String(f && f.vill_id))) : null;
    let updated = 0;
    farms.forEach(f => {
      // A village absent from the baseline was never observed before the batch,
      // so its deadline appearing now is the model filling in lazily, not proof
      // a claim landed. Same for a village we never posted a claim for.
      if (!Object.prototype.hasOwnProperty.call(before, f.vill_id)) return;
      if (only && !only.has(String(f.vill_id))) return;
      if (f.lootable_at != null && f.lootable_at > now && before[f.vill_id] !== f.lootable_at) updated++;
    });
    gbLog(`farm claim verify: ${updated} village(s) now gathering${updated ? '' : ' - claims did NOT land (open Senado once, click Recoger manually, then paste me the Log tab)'}`);
    return updated;
  }
  // ---------- village resource scrape: circuit breaker ----------
  // The ladder below only resolves on worlds whose client still answers a
  // farm_town_* action. Where it does not, it is a pure budget sink: N villages
  // x 3 guesses per sweep, every sweep, forever, out of the same request budget
  // that gates farm claims and the armed free-instant post. Two dead sweeps and
  // the scrape switches itself off until an endpoint is actually learned.
  const FARM_SCRAPE_DEAD_SWEEPS = 2;
  function farmScrapeState() {
    if (!state.farmScrapeState || typeof state.farmScrapeState !== 'object') {
      state.farmScrapeState = { dead: false, misses: 0 };
    }
    return state.farmScrapeState;
  }
  function farmScrapeSaveState() { save(STORE.FARM_SCRAPE_STATE, farmScrapeState()); }
  function farmScrapeEnabled() { return !!state.farmScrape && !farmScrapeState().dead; }
  // Drop the rows the dead ladder wrote, otherwise the Farms tab and the footer
  // keep showing `no endpoint matched` for up to 24h after the feature is off.
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
    // re-trip dead AFTER the new sweep just cleared it. OPEN-PLAN 1.3 /
    // 8/23 audit #14.
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
  function farmGuesses() {
    return xhrLadder(ACTION_GUESSES, { learned: state.farmAction });
  }
  function learnFarmAction(u) {
    const m = String(u || '').match(/[?&]action=([a-z0-9_]+)/i);
    if (!m) return;
    const a = m[1].toLowerCase();
    if (FARM_ACTION_BAD.test(a)) return;
    if (!FARM_ACTION_OK.test(a) && !(/^farm/.test(a) && /town|info|overview/.test(a))) return;
    // A real action from the player's own traffic is the only evidence that the
    // endpoint exists on this world - it is what the breaker was waiting for.
    // The revive used to sit behind the `already learned` early return, so a
    // world whose action was learned in an earlier session could never come
    // back: the breaker tripped, Preflight said "teach it by opening a
    // village", the player opened one, the same action came back over the
    // wire, and this function returned before touching the breaker. Evidence
    // is evidence whether or not the string changed.
    if (state.farmAction !== a) {
      state.farmAction = a;
      save(wkey(STORE.FARM_ACTION), a);
      gbLog('learned farm action', a);
    }
    farmScrapeRevive('observed action ' + a);
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
        feature: 'farm-scrape',
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
          // gbXhr rejects before the wire on budget / host-disabled / disposed.
          // Walking the rest of the ladder there would burn the remaining
          // guesses instantly, with no spacing, against an exhausted budget.
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
  // `force` = a manual button. The Diag test fetch calls fetchFarmResources
  // directly and stays outside the breaker on purpose: it is the probe that can
  // prove the endpoint is alive again.
  function scrapeAllFarms(force) {
    if (!hostEnabled() || automationPaused({})) return;
    if (force) farmScrapeRevive('manual sweep');
    if (!force && !farmScrapeEnabled()) {
      gbLogT('farm-scrape-off', 600000, 'farm scrape: off (' +
        (farmScrapeState().dead ? 'endpoint dead' : 'disabled in Config') + ')');
      // Keep the cadence stamped so farmTick does not re-enter every 15s — but
      // never SHORTEN a deadline a real sweep already set (min < the 5-6min
      // window a live sweep stamps, so this used to pull the next one forward).
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
    // A village that walked the whole ladder and matched nothing is endpoint
    // evidence; a budget/network stop is not. Counting only whole sweeps meant a
    // sweep that always ran out of budget on its last village never reached
    // farmScrapeNoteSweep, so the breaker could never trip and the dead ladder
    // burned the scrape budget forever.
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
        gbUnlock('farm-scrape', farmScrapeLock);
        gbLog(`farm scrape done: ${ok}/${done} ok, next in ${fmtSec(Math.round(wait / 1000))}`);
        flash(`farms ${ok}/${done} ok`);
        if (done) farmScrapeNoteSweep(farmScrapeLock, ok);
        return;
      }
      fetchFarmResources(f, (good, why) => {
        done++; if (good) ok++;
        const err = (state.farmResources[f.vill_id] || {}).err || '?';
        if (!good) gbLog(`  farm ${f.vill_id}: no data (${err})`);
        if (!good && err === 'no endpoint matched') hard++;
        // Out of budget mid-sweep: stop the sweep, but still charge the breaker
        // with whatever endpoint evidence this sweep already produced.
        if (why === 'budget' || why === 'disabled' || why === 'disposed') {
          gbUnlock('farm-scrape', farmScrapeLock);
          gbLog(`farm scrape stopped (${why}): ${ok}/${done} ok`);
          if (ok || hard) farmScrapeNoteSweep(farmScrapeLock, ok);
          return;
        }
        // Nothing on this world answers the ladder: stop burning the rest of the
        // budget on the remaining villages, the verdict is already in.
        if (!ok && hard >= FARM_SCRAPE_HARD_ABORT && list.length) {
          gbUnlock('farm-scrape', farmScrapeLock);
          gbLog(`farm scrape stopped (no endpoint after ${hard} villages): 0/${done} ok`);
          farmScrapeNoteSweep(farmScrapeLock, 0);
          return;
        }
        gbTimeout(step, 700 + Math.random() * 300);
      });
    })();
  }
  // Path A: derive the 600s option index from GameData when readable.
  // Never invent an index - a wrong index silently halves farm income.
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
          // pickNum, not `||`: a present-but-0 duration short-circuits to the
          // next candidate, and a 0 here should fail the `sec > 0` gate below
          // rather than silently borrow another field's value.
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
  // Fire once when loyalty flips false->true (or first load with loyalty and no 600 map).
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

      // Tentative write - the next hand/bot claim confirms via farmLearnOptionFromClaim.
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
