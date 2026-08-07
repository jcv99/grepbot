  function sniffBridgeBody(u, body) {
    try {
      if (!body || typeof body !== 'string' || !/frontend_bridge/.test(String(u))) return;
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
          // A hand-clicked claim is the only reliable teacher of option→duration
          if (!isSelfBridge(j)) farmLearnOptionFromClaim(j);
        }
      } else if (/PlayerAttackSpot/.test(body)) {
        gbLog('sniffed bandit bridge call:', body.slice(0, 300));
      } else if (/BuildingOrder/.test(body) && /Instant|instant/i.test(body)) {
        const j = parseBodyLoose(body);
        if (j && j.action_name && /instant/i.test(j.action_name)) {
          if (/buyInstant|buy_instant/i.test(j.action_name)) {
            gbLogT('ib-sniff-refuse', 60000, 'instant: sniffed buyInstant — not saved as free-complete action');
          } else if (typeof ibLearnAction === 'function') {
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
          if (/buyInstant|buy_instant/i.test(j.action_name)) {
            gbLogT('ib-sniff-refuse', 60000, 'instant-research: sniffed buyInstant — not saved');
          } else if (typeof ibLearnAction === 'function') {
            ibLearnAction('research', j.action_name);
            gbLog('learned instant-research action:', j.action_name);
          } else {
            state.ibActionR = j.action_name;
            save(wkey(STORE.IB_ACTION_R), state.ibActionR);
            gbLog('learned instant-research action:', state.ibActionR);
          }
        }
      } else if (/model_url.*Town\//i.test(body) || (/Town/.test(body) && /attack|sendUnits/i.test(body))) {
        const j = parseBodyLoose(body);
        if (j && j.model_url && /attack|sendUnits/i.test(j.action_name || '')) {
          state.attackTpl = {
            model_url: j.model_url, action_name: j.action_name,
            arguments: j.arguments || {}, town_id: j.town_id,
            version: 1, learned_at: Date.now(),
          };
          save(wkey(STORE.ATTACK_TPL), state.attackTpl);
          gbLog('learned attack template:', JSON.stringify(state.attackTpl).slice(0, 200));
        }
      } else if (/Command/.test(body) && /cancelCommand/i.test(body)) {
        const j = parseBodyLoose(body);
        if (j && j.action_name && /cancelCommand/i.test(j.action_name) && !isSelfBridge(j)) {
          state.cancelTpl = {
            model_url: j.model_url || 'Command',
            action_name: j.action_name,
            arguments: j.arguments || {},
            town_id: j.town_id,
            version: 1, learned_at: Date.now(),
          };
          save(wkey(STORE.CANCEL_TPL), state.cancelTpl);
          gbLog('learned cancel template:', JSON.stringify(state.cancelTpl).slice(0, 200));
        }
      } else if (/PlayerHero/.test(body) && /assignToTown|unassignFromTown|cancelTownTravel/i.test(body)) {
        const j = parseBodyLoose(body);
        if (j && j.action_name && !isSelfBridge(j)) {
          if (!state.heroTpl || typeof state.heroTpl !== 'object') state.heroTpl = {};
          state.heroTpl[j.action_name] = {
            model_url: j.model_url || 'PlayerHero',
            action_name: j.action_name,
            arguments: j.arguments || {},
            town_id: j.town_id,
            version: 1, learned_at: Date.now(),
          };
          save(wkey(STORE.HERO_TPL), state.heroTpl);
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

  // ---------- farms via game data (ModernBot style) ----------
  // FarmTownPlayerRelation: per-player claim state (lootable_at, relation_status)
  // FarmTown: village identity + island coords. No HTTP, always fresh.
  let farmRelLogged = false;
  function farmRelationCol() {
    return mmCol('FarmTownPlayerRelation');
  }
  function farmRelationModel(farmOrRelId) {
    const relCol = farmRelationCol();
    if (!relCol) return null;
    const id = (farmOrRelId && typeof farmOrRelId === 'object') ? farmOrRelId.relation_id : farmOrRelId;
    if (id == null) return null;
    try {
      if (relCol.get) {
        const m = relCol.get(id);
        if (m) return m;
      }
    } catch (_) {}
    return relCol.models.find(r => (r.id ?? (r.attributes || {}).id) == id) || null;
  }
  // Client: belongsToPlayer → relation_status > 0; status 1=owned, 2=revolt (still ours).
  function farmBelongsToPlayer(r, attrs) {
    try {
      if (typeof r.belongsToPlayer === 'function') return !!r.belongsToPlayer();
    } catch (_) {}
    const s = attrs.relation_status;
    return s != null && s > 0;
  }
  // Client isLootable: Timestamp.now() >= getLootableAt(). Fall back to attrs + gameNow().
  function farmIsLootable(r, attrs) {
    try {
      if (typeof r.isLootable === 'function') return !!r.isLootable();
    } catch (_) {}
    const at = attrs && attrs.lootable_at;
    if (at == null) return true;
    return gameNow() >= at;
  }
  function farmsFromGame() {
    try {
      const uw = uwCached();
      if (!uw.MM) return null;
      const relCol = farmRelationCol();
      const farmCol = mmCol('FarmTown');
      if (!relCol) return null;
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
      if (!farmRelLogged) {
        farmRelLogged = true;
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
    // Runs on every farm/town scrape (5-6 min) plus every textarea edit, but
    // the village set almost never changes. Skip the serialize+write and the
    // three prune passes when the merged list is byte-identical.
    const sig = JSON.stringify(state.farmsParsed);
    if (sig === farmsParsedSig) return;
    farmsParsedSig = sig;
    save(STORE.FARMS_PARSED, state.farmsParsed);
    // prune resource/alert maps to currently known villages
    const ids = state.farmsParsed.map(f => f.vill_id);
    if (pruneMapsToIds(state.farmResources, ids)) save(STORE.FARM_RES, state.farmResources);
    if (pruneMapsToIds(state.alerted, ids)) save(STORE.ALERTED, state.alerted);
    if (pruneMapsToIds(state.thresholds, ids)) save(STORE.THRESH, state.thresholds);
  }
  // a town of ours on the same island as the farm - needed as claim town_id
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
        if (map[key] == null) map[key] = tid;
      }
    } catch (_) {}
    return map;
  }
  function townIdForFarm(farm, islandMap) {
    // Same-island town only — never fall back to Game.townId (wrong island → captcha).
    if (farm.x == null || farm.y == null) return null;
    const map = islandMap || islandTownMap();
    const hit = map[farm.x + ',' + farm.y];
    return hit != null ? hit : null;
  }
  // Warehouse full gate: skip claims when the owning town can't store loot.
  // mode 'any' = block if ≥1 resource at capacity; 'all' = block only if wood+stone+iron all full.
  // The reader itself lives in core (`townResState`) — cave/trade/sleep-claim
  // share it instead of each deriving capacity their own way.
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

  // ---------- claim durations (5min / 10min / long "sleep" claims) ----------
  // Grepolis encodes the wanted booty timer as an opaque `option` index in the
  // claim payload. The index→duration mapping is world/client specific, so it is
  // LEARNED from the player's own in-game clicks (sniffBridgeBody below) instead
  // of guessed: a wrong index would claim the wrong timer. option 1 = 5 min is
  // the payload this bot has always sent, so it seeds the map.
  const FARM_DURATIONS = [300, 600, 1200, 2400, 5400, 14400, 28800];
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
  function farmSnapDuration(sec) {
    let best = null, bestDiff = Infinity;
    FARM_DURATIONS.forEach(d => {
      const diff = Math.abs(d - sec);
      if (diff < bestDiff) { best = d; bestDiff = diff; }
    });
    // reject anything not within 20% of a known timer (mood/bonus can shift it slightly)
    return best != null && bestDiff <= best * 0.2 ? best : null;
  }
  // A manual claim teaches option→duration: read the village's new lootable_at
  // a few seconds after the click and snap the delta to the nearest known timer.
  function farmLearnOptionFromClaim(j) {
    try {
      const a = (j && j.arguments) || {};
      const opt = +a.option;
      const vid = a.farm_town_id;
      if (!(opt > 0) || vid == null) return;
      gbTimeout(() => {
        const farms = farmsFromGame() || [];
        const f = farms.find(x => String(x.vill_id) === String(vid));
        if (!f || f.lootable_at == null) return;
        const sec = farmSnapDuration(f.lootable_at - gameNow());
        if (sec == null) return;
        const map = Object.assign({}, state.farmOptionMap || {});
        if (+map[String(sec)] === opt) return;
        map[String(sec)] = opt;
        state.farmOptionMap = map;
        save(wkey(STORE.FARM_OPTION_MAP), map);
        gbLog(`farm: learned claim option ${opt} = ${farmDurLabel(sec)} (map: ${farmOptionMapText()})`);
      }, 4000);
    } catch (_) {}
  }
  // "Lealtad de los aldeanos" unlocks the longer booty timers. `researches()`
  // attribute keys are the canonical server ids and stay English on every
  // market (es146 included), so match ids first; the loose regex runs against
  // BOTH the id and the GameData label so a translated name can still hit.
  const FARM_LOYALTY_IDS = ['rural_loyalty', 'diplomacy', 'conscription', 'loyalty'];
  const FARM_LOYALTY_RE = /loyal|lealtad|leal(?:tad)?|diplom|conscript|treue|fidel|aldean|villager/i;
  const farmLoyaltyCache = Object.create(null);
  function farmLoyaltyReset() {
    Object.keys(farmLoyaltyCache).forEach(k => { delete farmLoyaltyCache[k]; });
  }
  // pin may be an exact id, a differently-cased id, or the localized label the
  // user copied out of the academy — resolve all three to a researched id.
  function farmLoyaltyPinHit(techs, pin) {
    const want = pin.toLowerCase();
    const keys = Object.keys(techs).filter(k => techs[k]);
    return keys.some(k => k.toLowerCase() === want || researchLabel(k).toLowerCase() === want);
  }
  function farmLoyaltyResearched(townId) {
    const now = Date.now();
    const c = farmLoyaltyCache[townId];
    if (c && now - c.ts < 60000) return c.val;
    let val = false;
    try {
      const info = researchTownTechs(townId);
      const techs = (info && info.techs) || null;
      if (techs) {
        const pin = String(state.farmLoyaltyTech || '').trim();
        if (pin) val = farmLoyaltyPinHit(techs, pin);
        else {
          const done = Object.keys(techs).filter(k => techs[k]);
          const hit = FARM_LOYALTY_IDS.find(id => done.indexOf(id) >= 0) ||
            done.find(k => FARM_LOYALTY_RE.test(k) || FARM_LOYALTY_RE.test(researchLabel(k)));
          if (hit) {
            state.farmLoyaltyTech = hit;
            save(wkey(STORE.FARM_LOYALTY_TECH), hit);
            gbLog(`farm: loyalty tech detected: ${hit}${researchLabel(hit) ? ' (' + researchLabel(hit) + ')' : ''}`);
            val = true;
          } else {
            // dump id(label) pairs — the id is what the pin field wants.
            gbLogT('farm-loyalty-miss', 900000, 'farm: loyalty tech not found; researched = ' +
              done.map(k => k + (researchLabel(k) ? '(' + researchLabel(k) + ')' : '')).join(',').slice(0, 600));
          }
        }
      }
    } catch (_) {}
    farmLoyaltyCache[townId] = { ts: now, val };
    return val;
  }
  function farmSleepDuration() {
    const want = state.farmSleepDur;
    if (!want || want === 'auto') return farmOptionFor(28800) != null ? 28800 : 14400;
    return +want;
  }
  // 10min timer only where the loyalty research is done; 5min everywhere else.
  function farmDesiredDuration(townId) {
    if (!state.farmLongClaims) return 300;
    return farmLoyaltyResearched(townId) ? 600 : 300;
  }

  // collect ready loot + start next gather, straight through the game's bridge.
  // arguments shape copied from the sniffed real claim when available.
  // Success only via bridgePost callback (never count budget/skip as claimed).
  function claimFarm(farm, islandMap, whCache, durOverride, onDone) {
    const done = (err) => { if (onDone) onDone(err); };
    if (captchaPaused('farm')) return done('captcha');
    const tid = +townIdForFarm(farm, islandMap);
    if (!tid) {
      gbLogT('claim-no-town', 60000, `farm claim skip ${farm.vill_id}: no same-island town`);
      return done('skip');
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
    const tplArgs = (state.claimTpl && state.claimTpl.arguments) || {};
    const wantSec = durOverride || farmDesiredDuration(tid);
    let option = farmOptionFor(wantSec);
    if (option == null) {
      gbLogT('farm-opt-' + wantSec, 900000,
        `farm claim: option index for ${farmDurLabel(wantSec)} unknown - claim that timer once by hand in game to teach it (using 5min)`);
      option = farmOptionFor(300) != null ? farmOptionFor(300) : 1;
    }
    // Defaults win over sniffed type/option so a partial sniff can't clobber them.
    const args = Object.assign({}, tplArgs, { type: 'resources', option, farm_town_id: +farm.vill_id });
    bridgePost('farm', {
      model_url: `FarmTownPlayerRelation/${farm.relation_id}`,
      action_name: (state.claimTpl && state.claimTpl.action_name) || 'claim',
      arguments: args,
      town_id: tid,
    }, (err) => done(err || null));
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
      if (!tid) return false; // island unknown / no same-island town
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
      if (onBatchDone) onBatchDone({ done: 0, attempted: 0, captcha: false });
      return;
    }
    gbLock('claim');
    gbLog(`farm claim${reason ? ' (' + reason + ')' : ''}: ${ready.length}/${farms.length} ready${skippedFull ? ` (${skippedFull} warehouse-full)` : ''}`);
    const before = {};
    farms.forEach(f => { before[f.vill_id] = f.lootable_at; });
    flash(`farm claim x${ready.length}`);
    let i = 0, done = 0, captcha = false;
    (function next() {
      if (i >= ready.length || captcha || captchaPaused('farm')) {
        gbTimeout(() => {
          try {
            const flipped = verifyClaims(before);
            // Prefer lootable_at flips; bridge OK alone does not prove the claim landed.
            if (onBatchDone) onBatchDone({
              done: flipped,
              attempted: ready.length,
              captcha,
              bridgeOk: done,
            });
          } finally { gbUnlock('claim'); }
        }, 10000);
        return;
      }
      const f = ready[i++];
      try {
        claimFarm(f, islandMap, whCache, durOverride, (err) => {
          if (err === 'captcha' || err === 'captcha-pause') captcha = true;
          else if (!err) {
            done++;
            gbLog(`  claimed ${f.name || f.vill_id} (rel ${f.relation_id})`);
          }
          // budget/skip/disabled/paused: do not log claimed
          gbTimeout(next, 700);
        });
      } catch (e) {
        gbLog('  claim FAIL', f.vill_id, String(e));
        gbTimeout(next, 700);
      }
    })();
  }
  // ---------- long "sleep" claims (4h / 8h) ----------
  // Same claim path, only the duration option changes. Auto mode fires at most
  // once per local day: the haul must still land before 24:00 and the owning
  // towns must have room for it, otherwise the long timer is wasted overflow.
  function farmSleepDayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }
  function farmSleepClaimNow(reason, onDone) {
    const sec = farmSleepDuration();
    if (farmOptionFor(sec) == null) {
      gbLog(`sleep claim: ${farmDurLabel(sec)} option not learned yet - open a farming village, click that timer once by hand, then retry`);
      flash('sleep claim: teach ' + farmDurLabel(sec));
      if (onDone) onDone(null);
      return false;
    }
    if (!state.autoFarm) {
      gbLog('sleep claim: auto-farm is OFF - enable it in Config, the claim path is shared');
      flash('sleep claim: auto-farm OFF');
      if (onDone) onDone(null);
      return false;
    }
    gbLog(`sleep claim ${farmDurLabel(sec)}${reason ? ' (' + reason + ')' : ''}`);
    autoClaimFarms('sleep ' + farmDurLabel(sec), sec, onDone);
    return true;
  }
  function farmSleepAutoTick() {
    if (!state.farmSleepAuto || !state.autoFarm) return;
    if (!hostEnabled() || captchaPaused('farm') || gbLocked('claim')) return;
    const sec = farmSleepDuration();
    if (farmOptionFor(sec) == null) return;
    const day = farmSleepDayKey();
    if (state.farmSleepDay === day) return;
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    if (Date.now() + sec * 1000 >= midnight.getTime()) return; // would run past 24:00
    const farms = farmsFromGame();
    if (!farms || !farms.length) return;
    const now = gameNow();
    const ready = farms.filter(f => (f._rel ? farmIsLootable(f._rel, f._attrs || {}) : !(f.lootable_at > now)));
    // most of the set must be claimable, else the long timer only covers a few villages
    if (ready.length < Math.ceil(farms.length * 0.8)) return;
    const islandMap = islandTownMap();
    const towns = new Set();
    ready.forEach(f => { const tid = townIdForFarm(f, islandMap); if (tid) towns.add(tid); });
    if (!towns.size) return;
    const limit = state.farmSleepFillPct || 60;
    for (const tid of towns) {
      const st = townWarehouseState(tid);
      if (!st || !(st.cap > 0)) return;
      const fill = Math.max(st.wood, st.stone, st.iron) / st.cap * 100;
      if (fill > limit) {
        gbLogT('sleep-fill', 600000, `sleep claim held: town ${tid} at ${Math.round(fill)}% full (limit ${limit}%)`);
        return;
      }
    }
    // Mark day only after verified success (or intentional zero claimable after gates).
    farmSleepClaimNow('auto', (stats) => {
      if (!stats) return;
      if (stats.done > 0 || stats.attempted === 0) {
        state.farmSleepDay = day;
        save(wkey(STORE.FARM_SLEEP_DAY), day);
      } else {
        gbLogT('sleep-day-hold', 60000, `sleep claim: day not marked (${stats.done}/${stats.attempted} ok)`);
      }
    });
  }
  function verifyClaims(before) {
    const farms = farmsFromGame();
    if (!farms) return 0;
    const now = gameNow();
    let updated = 0;
    farms.forEach(f => {
      if (f.lootable_at != null && f.lootable_at > now && before[f.vill_id] !== f.lootable_at) updated++;
    });
    gbLog(`farm claim verify: ${updated} village(s) now gathering${updated ? '' : ' - claims did NOT land (open Senado once, click Recoger manually, then paste me the Log tab)'}`);
    return updated;
  }

  // farm_town_* actions are the real farming-village endpoints; town-shaped
  // fallbacks stay separate so learnFarmAction can't poison town scrapes.
  const ACTION_GUESSES = ['farm_town_info', 'get_farm_towns', 'farm_town_overview'];
  const FARM_ACTION_OK = /^(farm_town_|get_farm|farm_info|island_farm)/;
  const FARM_ACTION_BAD = /farm_remove|village_attack|attack_log|farm_town_lock/;
  function farmGuesses() {
    const g = ACTION_GUESSES.slice();
    const a = state.farmAction;
    if (a) {
      const i = g.indexOf(a);
      if (i >= 0) g.splice(i, 1);
      g.unshift(a);
    }
    return g;
  }
  // The game's own requests reveal the correct endpoint name for this world.
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
  }
  function fetchFarmResources(entry, onDone) {
    const guesses = farmGuesses();
    tryGuess(entry, 0);
    function tryGuess(entry, i) {
      if (i >= guesses.length) {
        state.farmResources[entry.vill_id] = { ts: Date.now(), ok: false, err: 'no endpoint matched' };
        save(STORE.FARM_RES, state.farmResources);
        renderFarms();
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
        anonymous: false,
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json, text/plain, */*' },
        onload(res) {
          const retryMs = httpRetryAfterMs(res);
          if (retryMs) {
            state.farmResources[entry.vill_id] = { ts: Date.now(), ok: false, err: 'HTTP ' + res.status };
            save(STORE.FARM_RES, state.farmResources);
            gbLogT('farm-http-' + res.status, 30000, `farm ${entry.vill_id}: HTTP ${res.status}, retry in ${retryMs}ms`);
            gbTimeout(() => tryGuess(entry, i), retryMs);
            return;
          }
          if (res.status && res.status >= 400) {
            return tryGuess(entry, i + 1);
          }
          const body = (res.responseText || '').slice(0, 500);
          // look for any resource-like key
          const looksLikeJson = res.responseText && (res.responseText[0] === '{' || res.responseText[0] === '[');
          if (!looksLikeJson || /<html/i.test(body)) {
            // try next action
            return tryGuess(entry, i + 1);
          }
          try {
            const p = parseResourceJson(JSON.parse(res.responseText));
            // Grepolis overview often returns everything together; success if we got numbers or a name
            if (!p.got && i + 1 < guesses.length) return tryGuess(entry, i + 1);
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
            if (i + 1 < guesses.length) return tryGuess(entry, i + 1);
            state.farmResources[entry.vill_id] = { ts: Date.now(), ok: false, err: String(e).slice(0, 100) };
          }
          save(STORE.FARM_RES, state.farmResources);
          // paste-only mode: no server sync
          renderFarms();
          checkThresholds();
          if (onDone) onDone(!!state.farmResources[entry.vill_id].ok);
        },
        onerror() {
          if (i + 1 < guesses.length) return tryGuess(entry, i + 1);
          state.farmResources[entry.vill_id] = { ts: Date.now(), ok: false, err: 'network' };
          save(STORE.FARM_RES, state.farmResources);
          renderFarms();
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

  // Deadline-based scheduling: a chained setTimeout gets throttled arbitrarily
  // (observed ~20min) in background tabs, so we persist a deadline and let a
  // short ticker fire the scrape. Overshoot is bounded by the tick interval.
  function scrapeAllFarms() {
    if (!hostEnabled() || automationPaused({})) return;
    if (gbLocked('farm-scrape')) { gbLogT('farm-scrape-inflight', 30000, 'farm scrape: skipped (in flight)'); return; }
    gbLock('farm-scrape');
    refreshFarmsParsed();
    const wait = SYNC.FARM_MIN_MS + Math.random() * (SYNC.FARM_MAX_MS - SYNC.FARM_MIN_MS);
    state.nextFarmScrape = Date.now() + wait;
    save(STORE.NEXT_FARM, state.nextFarmScrape);
    renderTimers();
    const list = state.farmsParsed.slice();
    const gameFarms = list.filter(f => f.fromGame).length;
    if (!list.length) {
      gbUnlock('farm-scrape');
      gbLog('farm scrape: 0 farms known (no game data, textarea empty)');
      return;
    }
    gbLog(`farm scrape: ${list.length} farms (${gameFarms} auto-discovered, ${list.length - gameFarms} from textarea)`);
    let done = 0, ok = 0;
    // strictly sequential: parallel bursts of N farms x endpoint guesses get
    // throttled by the game server, which is why only the first farm updated
    (function step() {
      if (!hostEnabled() || automationPaused({})) {
        gbUnlock('farm-scrape');
        gbLog(`farm scrape aborted (host/pause): ${ok}/${done} ok`);
        return;
      }
      const f = list.shift();
      if (!f) {
        gbUnlock('farm-scrape');
        gbLog(`farm scrape done: ${ok}/${done} ok, next in ${fmtSec(Math.round(wait / 1000))}`);
        flash(`farms ${ok}/${done} ok`);
        return;
      }
      fetchFarmResources(f, (good) => {
        done++; if (good) ok++;
        if (!good) gbLog(`  farm ${f.vill_id}: no data (${(state.farmResources[f.vill_id] || {}).err || '?'})`);
        gbTimeout(step, 700 + Math.random() * 300);
      });
    })();
  }

  function farmTick() {
    const now = Date.now();
    if (hostEnabled() && !automationPaused({})) {
      if (now >= state.nextFarmScrape) scrapeAllFarms();
      if (now >= state.nextTownsScrape) scrapeAllTowns();
    }
    try { farmSleepAutoTick(); } catch (_) {}
  }

