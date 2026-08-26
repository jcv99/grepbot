  // Declared with their only consumer. These used to sit at the tail of
  // dodge.js, so recruit.js silently depended on dodge.js being concatenated
  // first — a build-order footgun with no compile-time signal.
  const RECRUIT_SPELLS = ['call_of_the_ocean', 'spartan_training', 'fertility_improvement'];
  // Every recruit spell belongs to exactly one god. Casting one on a town that
  // worships another god is a guaranteed server rejection: it costs a request
  // budget slot and a decision-memory strike every cadence.
  const RECRUIT_SPELL_GODS = {
    call_of_the_ocean: 'poseidon',
    spartan_training: 'ares',
    fertility_improvement: 'hera',
  };
  function recruitControllerFor(unitId) {
    const def = gbGameDataLookup("units", unitId);
    if (!def) return null;
    // Two valid recruit controllers only: barracks (land) and docks (naval).
    // Mythical/god gating belongs in recruitCanBuild (temple_level + god +
    // favor preconditions), never in the controller — there is no recruit
    // endpoint at building_temple, and posting there costs a request-budget
    // slot and a decision-memory strike every cadence.
    if (recruitIsNaval(unitId)) return { controller: 'building_docks', feature: 'recruit' };
    return { controller: 'building_barracks', feature: 'recruit' };
  }
  function recruitHasSpell(townId, powerId) {
    try {
      const uw = gameUw();
      const col = uw.MM && uw.MM.getFirstTownAgnosticCollectionByName &&
        uw.MM.getFirstTownAgnosticCollectionByName('CastedPowers');
      const frag = col && col.fragments && col.fragments[townId];
      const models = (frag && frag.models) || [];
      return models.some(m => {
        const pid = (m.attributes || {}).power_id;
        if (powerId) return pid === powerId;
        return RECRUIT_SPELLS.includes(pid);
      });
    } catch (_) { return false; }
  }
  // Cooldown persisted via STORE.SPELL_COOLDOWN so the 30-min favor-spell
  // safety window survives page reload — without persistence a reload wipes
  // the guard and the bot can re-spend favor on a town whose previous outcome
  // was unknown (the irreversible double-spend the v2.4.1 guard prevents).
  function recruitSpellCooldown(townId, powerId) {
    const map = state.spellCooldown || (state.spellCooldown = {});
    const t = map[String(townId)] || (map[String(townId)] = {});
    const until = +t[powerId] || 0;
    return until > Date.now() ? until - Date.now() : 0;
  }
  function recruitSpellCooldownStamp(townId, powerId, ms) {
    if (!state.spellCooldown) state.spellCooldown = {};
    const t = state.spellCooldown[String(townId)] || (state.spellCooldown[String(townId)] = {});
    t[powerId] = Date.now() + (ms || 30 * 60 * 1000);
    try { save(STORE.SPELL_COOLDOWN, state.spellCooldown); } catch (_) {}
  }
  function recruitSpellGateOk(townId, powerId) {
    if (!powerId || !RECRUIT_SPELLS.includes(powerId)) return { ok: false, why: 'bad-power' };
    const academy = gbBuildingLevel(townId, 'academy');
    if (academy != null && academy < 1) return { ok: false, why: 'no-academy' };
    // Unreadable god = unknown = blind verdict, let the server be the authority.
    // Use the scan-tick memo when present so we don't re-hit unsafeWindow for
    // every candidate in the inner loop.
    const god = recruitScanGodCache ? recruitScanGod(townId) : recruitTownGod(townId);
    if (god == null) return { ok: true, blind: true, why: null };
    // A READ god is authoritative: only the spell's own god may cast it.
    const need = RECRUIT_SPELL_GODS[powerId];
    if (need && god !== need) return { ok: false, why: `god-mismatch:${god}!=${need}` };
    return { ok: true, blind: false, why: null };
  }
  function spellCastPost(townId, powerId, onDone) {
    return bridgePost('spell', {
      model_url: 'CastedPowers',
      action_name: 'cast',
      arguments: { power_id: powerId, target_id: +townId },
      town_id: +townId,
    }, onDone);
  }
  function recruitCastSpell(townId, powerId, onDone) {
    if (!powerId || !RECRUIT_SPELLS.includes(powerId)) return onDone && onDone('bad-power');
    const pre = recruitSpellGateOk(townId, powerId);
    if (!pre.ok) { gbLogT('spell-precond-' + townId, 300000, `spell: blocked precheck (${pre.why})`); return onDone && onDone('skip:' + pre.why); }
    if (pre.blind) gbLogT('spell-precond-blind-' + townId, 300000, 'spell: god unreadable; blind precheck, server is the authority');
    const left = recruitSpellCooldown(townId, powerId);
    if (left > 0) { gbLogT('spell-cooldown-' + townId, 60000, `spell: cooldown ${Math.ceil(left/1000)}s left`); return onDone && onDone('skip:cooldown'); }
    spellCastPost(townId, powerId, onDone);
  }
  function recruitBuild(townId, unitId, amount, onDone) {
    const ctrl = recruitControllerFor(unitId);
    if (!ctrl) return onDone && onDone('unknown-unit');
    gameAjaxPost('recruit', ctrl.controller, 'build', {
      unit_id: unitId,
      amount: +amount,
      town_id: +townId,
    }, onDone);
  }
  function recruitRequiredBuildings(def) {
    const out = {};
    const absorb = (x) => {
      if (!x) return;
      if (Array.isArray(x)) {
        x.forEach(v => {
          if (!v || typeof v !== 'object') return;
          const id = v.building_id || v.building || v.id || v.type;
          const lvl = +(v.level ?? v.min_level ?? v.value);
          if (id && Number.isFinite(lvl)) out[id] = Math.max(out[id] || 0, lvl);
        });
      } else if (typeof x === 'object') {
        Object.entries(x).forEach(([id, raw]) => {
          const lvl = +(raw && typeof raw === 'object' ? (raw.level ?? raw.min_level ?? raw.value) : raw);
          if (Number.isFinite(lvl)) out[id] = Math.max(out[id] || 0, lvl);
        });
      }
    };
    absorb(def.building_dependencies); absorb(def.required_buildings); absorb(def.requirements && def.requirements.buildings);
    if (def.required_building) {
      const id = typeof def.required_building === 'string' ? def.required_building : (def.required_building.id || def.required_building.building_id);
      const lvl = typeof def.required_building === 'object' ? +(def.required_building.level ?? def.required_building.min_level ?? 1) : 1;
      if (id) out[id] = Math.max(out[id] || 0, Number.isFinite(lvl) ? lvl : 1);
    }
    return out;
  }
  function recruitTownGod(townId) {
    try {
      const t = gbTownModel(townId);
      if (!t) return null;
      if (typeof t.getGod === 'function') { const g = t.getGod(); if (g) return String(g).toLowerCase(); }
      const a = t.attributes || {};
      const g = a.god || a.god_id || a.deity;
      return g ? String(g).toLowerCase() : null;
    } catch (_) { return null; }
  }
  function recruitResearchDeps(def) {
    const need = def.research_required || def.research_dependencies || def.required_researches;
    if (!need) return [];
    if (Array.isArray(need)) return need.map(x => typeof x === 'string' ? x : (x && (x.id || x.research_id || x.research_type))).filter(Boolean);
    if (typeof need === 'string') return [need];
    if (typeof need === 'object') return Object.keys(need).filter(k => need[k]);
    return [];
  }
  const _recruitBlindLog = new Set();
  function recruitCanBuild(townId, unitId) {
    const def = gbGameDataLookup("units", unitId);
    if (!def) return false;
    try {
      const t = gbTownModel(townId);
      if (!t) return false;
      const rdeps = recruitResearchDeps(def);
      if (rdeps.length) {
        const info = typeof researchTownTechs === 'function' ? researchTownTechs(townId) : null;
        if (!info || !info.techs) {
          // Unreadable techs = unknown, not "missing". Blind precheck: let the
          // server be the authority. Log once per (townId,unitId) so the player
          // sees which gate silently went blind instead of a hard block.
          const k = townId + '|' + unitId + '|tech';
          if (!_recruitBlindLog.has(k)) { _recruitBlindLog.add(k); gbLogT('recruit-blind-' + townId + '-' + unitId, 300000, 'recruit: ' + unitId + ' techs unreadable in town ' + townId + ' - blind precheck, server judges'); }
          return true;
        }
        for (const tech of rdeps) if (!info.techs[tech]) return false;
      }
      let buildings = null;
      try { const b = t.getBuildings ? t.getBuildings() : (t.buildings && t.buildings()); buildings = b && (b.attributes || b); } catch (_) {}
      if (!buildings) {
        // Same blind-on-unknown contract as above: a renamed getter must not
        // strand a feature. Log once and return true so the server judges.
        const k = townId + '|' + unitId + '|bld';
        if (!_recruitBlindLog.has(k)) { _recruitBlindLog.add(k); gbLogT('recruit-blind-' + townId + '-' + unitId, 300000, 'recruit: ' + unitId + ' buildings unreadable in town ' + townId + ' - blind precheck, server judges'); }
        return true;
      }
      const bdeps = recruitRequiredBuildings(def);
      for (const [bid, lvl] of Object.entries(bdeps)) if (+(buildings[bid] || 0) < +lvl) return false;
      if (recruitIsNaval(unitId)) {
        const docksNeed = +(def.docks_level ?? def.harbor_level ?? def.required_docks_level ?? 1);
        if (+(buildings.docks || 0) < (Number.isFinite(docksNeed) ? docksNeed : 1)) return false;
      } else {
        const barracksNeed = +(def.barracks_level ?? def.required_barracks_level ?? 1);
        if (+(buildings.barracks || 0) < (Number.isFinite(barracksNeed) ? barracksNeed : 1)) return false;
      }
      // Live client keys mythical units off `god_id` (see GameData.units +
      // unit card isMythical); some worlds also omit `god`/`is_mythical` while
      // still charging favor. Treat any of those as mythical.
      if (def.god || def.god_id || def.mythical || def.is_mythical) {
        // GameData.units.hydra often ships without `god` even though
        // is_mythical:true and a non-zero favor cost are present; the map in
        // core.js (MYTHICAL_UNIT_GOD) fills the gap so the favor gate can clamp
        // against the canonical god. def.god / def.god_id stay primary — the
        // map is only a fallback for naval mythicals the client build forgot.
        let requiredGod = (def.god || def.god_id) ? String(def.god || def.god_id).toLowerCase() : null;
        if (!requiredGod && typeof mythicalUnitGod === 'function') {
          requiredGod = mythicalUnitGod(unitId);
        }
        const townGod = recruitScanGodCache ? recruitScanGod(townId) : recruitTownGod(townId);
        // Unreadable god is UNKNOWN, not "wrong god": client builds rename
        // getGod()/god attributes, and blocking on the miss silently killed
        // every mythical unit in every town. A read god still decides.
        if (requiredGod && townGod && townGod !== requiredGod) return false;
        if (requiredGod && !townGod) {
          gbLogT('recruit-god-blind-' + townId, 300000,
            `recruit: town ${townId} god unreadable; ${unitId} left to the server to judge`);
        }
        const templeNeed = +(def.temple_level ?? def.required_temple_level ?? 1);
        if (+(buildings.temple || 0) < (Number.isFinite(templeNeed) ? templeNeed : 1)) return false;
        const favorCost = +(def.favor ?? (def.resources && def.resources.favor) ?? 0);
        if (favorCost > 0) {
          if (!requiredGod) return false;
          const fav = favorCurrent();
          const haveFavor = favorForGod(fav, requiredGod);
          if (haveFavor == null || haveFavor < favorCost) return false;
        }
      }
      return true;
    } catch (_) { return false; }
  }
  // Per-lane unit queue length. Captured client
  // (GameDataConstructionQueue.getUnitOrdersQueueLength) hardcodes
  // type_unit_queue → 7; full check is getAllOrders().length === 2*that
  // (barracks + docks). Never probe getMaxQueueLength / max_queue_length —
  // those match nothing in the live bundle.
  function recruitQueueMax() {
    try {
      const uw = gameUw();
      const q = uw.GameDataConstructionQueue;
      if (q && typeof q.getUnitOrdersQueueLength === 'function') {
        const n = +q.getUnitOrdersQueueLength();
        if (Number.isFinite(n) && n > 0) return n;
      }
    } catch (_) {}
    return 7;
  }
  function recruitQueueBuilding(unitId) {
    return recruitIsNaval(unitId) ? 'docks' : 'barracks';
  }
  function recruitQueueInfo(townId, unitId) {
    const t = gbTownModel(townId);
    const max = recruitQueueMax();
    if (!t) return { known: false, len: 0, max, models: [] };
    let col = null;
    try { col = t.getUnitOrdersCollection && t.getUnitOrdersCollection(); } catch (_) {}
    if (!col) return { known: false, len: 0, max, models: [] };
    const naval = unitId ? recruitIsNaval(unitId) : null;
    const building = naval == null ? null : (naval ? 'docks' : 'barracks');

    // Exact counters the docks/barracks UI animation uses (CityOverview binds
    // isDocksBuildingAnimated → getNavalUnitOrdersCount). Match the "0/7"
    // header before any other probe.
    try {
      if (naval === true && typeof col.getNavalUnitOrdersCount === 'function') {
        const c = +col.getNavalUnitOrdersCount();
        if (Number.isFinite(c) && c >= 0) {
          let models = [];
          try {
            if (typeof col.getNavalUnitOrders === 'function') {
              const o = col.getNavalUnitOrders();
              if (o && typeof o.length === 'number')
                models = Array.isArray(o) ? o.slice() : Array.prototype.slice.call(o);
            }
          } catch (_) {}
          return { known: true, len: c, max, models };
        }
      }
      if (naval === false && typeof col.getGroundUnitOrdersCount === 'function') {
        const c = +col.getGroundUnitOrdersCount();
        if (Number.isFinite(c) && c >= 0) {
          let models = [];
          try {
            if (typeof col.getGroundUnitOrders === 'function') {
              const o = col.getGroundUnitOrders();
              if (o && typeof o.length === 'number')
                models = Array.isArray(o) ? o.slice() : Array.prototype.slice.call(o);
            }
          } catch (_) {}
          return { known: true, len: c, max, models };
        }
      }
    } catch (_) {}

    // getCount/getOrders — same filter as the named helpers above.
    if (building && typeof col.getCount === 'function') {
      try {
        const c = +col.getCount(building);
        if (Number.isFinite(c) && c >= 0) {
          let models = [];
          try {
            if (typeof col.getOrders === 'function') {
              const o = col.getOrders(building);
              if (Array.isArray(o)) models = o.slice();
              else if (o && typeof o.length === 'number') models = Array.prototype.slice.call(o);
            }
          } catch (_) {}
          return { known: true, len: c, max, models };
        }
      } catch (_) {}
    }
    if (building && typeof col.getOrders === 'function') {
      try {
        const o = col.getOrders(building);
        if (Array.isArray(o)) return { known: true, len: o.length, max, models: o.slice() };
        if (o && typeof o.length === 'number') {
          const models = Array.prototype.slice.call(o);
          return { known: true, len: models.length, max, models };
        }
      } catch (_) {}
    }
    if (typeof col.getAllOrders === 'function') {
      try {
        let all = col.getAllOrders();
        if (all && typeof all.length === 'number') {
          all = Array.isArray(all) ? all.slice() : Array.prototype.slice.call(all);
          if (building) {
            all = all.filter(m => {
              try {
                return typeof m.getProductionBuildingType === 'function'
                  && m.getProductionBuildingType() === building;
              } catch (_) { return false; }
            });
          }
          return { known: true, len: all.length, max, models: all };
        }
      } catch (_) {}
    }
    // Raw models fallback. Drop id-less rows — keeping them inflated len
    // against an empty docks UI and stranded hydra at waiting-slot.
    try {
      if (!Array.isArray(col.models)) return { known: false, len: 0, max, models: [] };
      let models = col.models.slice();
      if (unitId) {
        const wantNaval = recruitIsNaval(unitId);
        models = models.filter(m => {
          const a = m.attributes || m;
          let pbt = null;
          try { if (typeof m.getProductionBuildingType === 'function') pbt = m.getProductionBuildingType(); } catch (_) {}
          if (pbt === 'docks' || pbt === 'barracks') return (pbt === 'docks') === wantNaval;
          const id = a.unit_type || a.unit_id || a.type;
          if (!id) return false;
          return recruitIsNaval(id) === wantNaval;
        });
      }
      return { known: true, len: models.length, max, models };
    } catch (_) { return { known: false, len: 0, max, models: [] }; }
  }
  function recruitQueuedAmount(townId, unit) {
    const q = recruitQueueInfo(townId);
    let queued = 0;
    for (const m of q.models || []) {
      const a = m.attributes || {};
      const uid = a.unit_type || a.unit_id || a.type;
      // Same contract as txUnitStatus: gbNum keeps unreadable null, the sweep
      // skips that order, and an unknown shape never reads as "0 queued".
      if (String(uid) === String(unit)) { const q = gbNum(a.count != null ? a.count : (a.amount != null ? a.amount : a.units)); if (q != null) queued += q; }
    }
    return queued;
  }
  function recruitQueueHasSpace(townId, unitId) {
    const q = recruitQueueInfo(townId, unitId);
    // Unreadable ≠ full. Returning false here printed "cola real llena" while
    // the docks header showed 0/7 (hard-rule: unread → blind → server judges).
    if (!q.known) return true;
    const max = q.max != null ? q.max : recruitQueueMax();
    return q.len < max;
  }
  function recruitAffordableAmount(townId, unit, want) {
    const def = gbGameDataLookup("units", unit), t = gbTownModel(townId);
    if (!def || !t || !def.resources) return 0;
    try {
      const r = t.resources && t.resources();
      // gbNum rejects null / '' / [] / false instead of coercing them to 0;
      // the legacy `+t.getAvailablePopulation()` collapsed +null onto 0 and
      // let recruitAffordableAmount return a positive amount against a town
      // whose population read was unreadable.
      const pop = t.getAvailablePopulation && gbNum(t.getAvailablePopulation());
      if (!r || pop == null) return 0;
      const rw = gbNum(def.resources.wood) || 0, rs = gbNum(def.resources.stone) || 0, ri = gbNum(def.resources.iron) || 0, rp = gbNum(def.population) || 0;
      let amount = Math.max(0, gbNum(want) || 0);
      const rWood = gbNum(r.wood), rStone = gbNum(r.stone), rIron = gbNum(r.iron);
      if (rw > 0 && rWood != null) amount = Math.min(amount, Math.floor(rWood / rw));
      if (rs > 0 && rStone != null) amount = Math.min(amount, Math.floor(rStone / rs));
      if (ri > 0 && rIron != null) amount = Math.min(amount, Math.floor(rIron / ri));
      if (rp > 0) amount = Math.min(amount, Math.floor(pop / rp));
      const favorCost = gbNum(def.favor ?? def.resources.favor) || 0;
      if (favorCost > 0) {
        // Same naval-mythical fallback as recruitCanBuild: GameData may omit
        // `def.god` (and only set `god_id`) for hydra, so fall back to
        // MYTHICAL_UNIT_GOD before the pool clamp. Favor is irreversible, so an
        // unknown god still hard-stops the amount at 0 — never spend against a guess.
        let god = (def.god || def.god_id) && String(def.god || def.god_id).toLowerCase();
        if (!god && typeof mythicalUnitGod === 'function') god = mythicalUnitGod(unit);
        const fav = favorCurrent();
        const have = god ? favorForGod(fav, god) : null;
        if (have == null) return 0;
        amount = Math.min(amount, Math.floor(have / favorCost));
      }
      return Math.max(0, Math.floor(amount));
    } catch (_) { return 0; }
  }
  function recruitValidateJob(job) {
    if (!recruitCanBuild(job.townId, job.unit)) return { ok: false, why: 'requirements' };
    if (!recruitQueueHasSpace(job.townId,job.unit)) return { ok: false, why: 'queue' };
    const amount = recruitAffordableAmount(job.townId, job.unit, job.amount);
    if (!(amount > 0)) return { ok: false, why: 'resources/pop/favor' };
    return { ok: true, amount: Math.min(amount, job.amount) };
  }
  let recruitNativeCursor=0,recruitLegacyCursor=0;
  function recruitRotate(ids,cursor){if(!ids.length)return ids;const at=Math.max(0,cursor%ids.length);return ids.slice(at).concat(ids.slice(0,at))}
  // Per-scan tick memo on the back-model + god read. gbTownModel is not
  // memoized in bridge.js, so a 20-town × 5-unit scan was burning 100+
  // unsafeWindow ITowns lookups per tick; the god read repeats inside
  // recruitCanBuild AND recruitSpellGateOk for the same town.
  let recruitScanGodCache = null;
  function recruitScanResetMemo() {
    recruitScanGodCache = new Map();
  }
  function recruitScanGod(tid) {
    if (!recruitScanGodCache) recruitScanResetMemo();
    if (recruitScanGodCache.has(tid)) return recruitScanGodCache.get(tid);
    const g = recruitTownGod(tid);
    recruitScanGodCache.set(tid, g);
    return g;
  }
  function recruitScan(reason) {
    const nativePending = nativeRecruitPending();
    if (!hostEnabled() || (!state.autoRecruit && !nativePending) || captchaPaused('recruit')) return;
    if (automationPaused({})) return;
    if (gbLocked('recruit')) return;
    // Farm precedence: no unit post while a village claim is still possible.
    // Farm precedence: no unit post while a village claim is still possible.
    // Enforced here as well as in orchTick so a wake/toggle path cannot route
    // around it. See farmClaimPending() in farms.js.
    if (farmFirstHold('recruit')) return;
    recruitScanResetMemo();
    const targets = goalEffectiveRecruitTargets();

    // Barracks and harbour are separate lanes, so a town can be FIFO for one
    // hull type and still run the goal planner for the other. Both id lists can
    // therefore name the same town — dedupe, the per-lane checks below decide
    // what that town is actually allowed to post.
    const explicitIds=Object.keys(nativeQueueRoot().towns).filter(id=>NATIVE_RECRUIT_LANES.some(l=>nativeQueueIsFifo(id,l)&&nativeQueueList(id,l,false).length));
    const legacyIds=Object.keys(targets).filter(id=>!NATIVE_RECRUIT_LANES.every(l=>nativeQueueIsFifo(id,l)));
    const townIds=recruitRotate(explicitIds,recruitNativeCursor++).concat(recruitRotate(legacyIds,recruitLegacyCursor++)).filter((id,i,a)=>a.indexOf(id)===i);
    if (!townIds.length) {
      gbLogT('recruit-empty', 300000, 'recruit: no town targets configured');
      return;
    }
    const uw = gameUw();
    let job = null;
    for (const tid of townIds) {
      for (const lane of NATIVE_RECRUIT_LANES) {
        if (!nativeQueueIsFifo(tid, lane)) continue;
        const explicit = nativeQueueRecruitHead(tid, lane);
        if (!explicit) continue;
        const qInfo = recruitQueueInfo(tid, explicit.unit);
        // Use >= with a coerced max — `len < null` is always false in JS, which
        // used to mark an empty/readable queue as full.
        const qMax = (qInfo.max != null && qInfo.max > 0) ? qInfo.max : recruitQueueMax();
        if (qInfo.known && qInfo.len >= qMax) {
          const laneLabel = recruitIsNaval(explicit.unit) ? 'puerto' : 'cuartel';
          nativeQueueSetJobState(explicit, 'waiting-slot', `${laneLabel} ${qInfo.len}/${qMax}`);
          gbLogT('recruit-slot-' + tid, 60000,
            `recruit: ${explicit.unit} waiting-slot ${qInfo.len}/${qMax} @${tid}`);
          continue;
        }
        if (!qInfo.known) {
          gbLogT('recruit-queue-blind-' + tid, 300000,
            `recruit: unit queue unreadable in town ${tid}; ${explicit.unit} left to the server to judge`);
        }
        if (!recruitCanBuild(tid, explicit.unit) || !recruitControllerFor(explicit.unit)) {
          nativeQueueSetJobState(explicit, 'blocked', 'requisitos/controlador'); continue;
        }
        const totalAmt = +explicit.amount || 0;

        const cs = +explicit.chunkSize || 0;
        const postAmt = cs > 0 && cs < totalAmt ? cs : totalAmt;

        const affordable = recruitAffordableAmount(tid, explicit.unit, postAmt);
        if (affordable < postAmt) { nativeQueueSetJobState(explicit, 'waiting-resources', 'recursos/población/favor'); continue; }
        nativeQueueSetJobState(explicit, 'ready', 'listo');
        job = { kind:'build', townId:tid, unit:explicit.unit, amount:postAmt, nativeJobId:explicit.id, nativeLane:lane, nativeChunkSize: cs };
        break;
      }
      if (job) break;
      const want = targets[tid];
      if (!want || typeof want !== 'object') continue;
      let t = null;
      try { t = uw.ITowns.towns[tid]; } catch (_) {}
      if (!t) continue;
      const have = goalUnitCounts(tid);
      for (const unit of Object.keys(want)) {
        const tgt = +want[unit] || 0;
        if (!(tgt > 0)) continue;

        // A lane the player drives by hand (FIFO) is never topped up by the
        // goal planner, even when the other hull type still is.
        if (nativeQueueIsFifo(tid, nativeRecruitLane(unit))) continue;
        if (!recruitCanBuild(tid, unit)) continue;
        if (!recruitControllerFor(unit)) continue;
        if (!recruitQueueHasSpace(tid,unit)) continue;
        const cur = +have[unit] || 0;
        const queued = recruitQueuedAmount(tid, unit);
        const need = tgt - cur - queued;
        if (need <= 0) continue;
        let amount = recruitAffordableAmount(tid, unit, need);
        if (!(amount > 0)) continue;

        // A spell is an optional accelerator, never a reason to spend favor when
        // no affordable recruitment can immediately follow it, or to block
        // normal recruiting in SAFE MODE.
        if (state.recruitSpells && !state.safeMode) {

          // Power ids are compared case-sensitively against RECRUIT_SPELLS, and
          // an imported config can carry mixed case - without the normalise the
          // spell scan idles forever with no trace.
          const rawPower = (state.favorCfg && state.favorCfg.recruitPower) || null;
          const wantPower = rawPower ? String(rawPower).trim().toLowerCase() : null;
          if (wantPower && !RECRUIT_SPELLS.includes(wantPower)) {
            gbLogT('recruit-badpower', 600000, `recruit: unknown spell power id "${rawPower}" - spells idle`);
          }
          if (wantPower && RECRUIT_SPELLS.includes(wantPower) && !recruitHasSpell(tid, wantPower)
              && !captchaPausedAny('recruit', 'spell') && recruitSpellGateOk(tid, wantPower).ok
              && !recruitSpellCooldown(tid, wantPower)) {
            job = { kind:'spell', townId:tid, power:wantPower };
            break;
          }
        }
        amount = Math.min(amount, 50);
        job = { kind: 'build', townId: tid, unit, amount };
        break;
      }
      if (job) break;
    }
    if (!job) {
      gbLogT('recruit-idle', 180000, `recruit: idle (${scanReason(reason)})`);
      return;
    }
    const lockToken = gbLock('recruit');
    if (!lockToken) return;
    if (job.kind === 'spell') {
      recruitCastSpell(job.townId, job.power, (err) => {
        gbUnlock('recruit', lockToken);
        if (!err) gbLog(`spell: ${job.power} on ${job.townId}`);
        else if (err === 'timeout_unknown' || err === 'pending') {
          recruitSpellCooldownStamp(job.townId, job.power);
          gbLog(`spell: outcome unknown (${err}); cooldown 30min — favor is irreversible, manual review required`);
        } else gbLogT('spell-err', 60000, `spell err ${err}`);
      });
      return;
    }
    const valid = recruitValidateJob(job);
    if (!valid.ok) { gbUnlock('recruit', lockToken); gbLogT('recruit-stale-' + job.townId, 60000, `recruit: final precheck blocked (${valid.why})`); return; }
    if (job.nativeJobId && valid.amount < job.amount) {
      const head = nativeQueueList(job.townId, job.nativeLane, false)[0];
      nativeQueueSetJobState(head, 'waiting-resources', 'cantidad completa no asequible');
      gbUnlock('recruit', lockToken); return;
    }
    job.amount = valid.amount;
    if (job.nativeJobId) {
      const head = nativeQueueList(job.townId, job.nativeLane, false)[0];
      if (!head || head.id !== job.nativeJobId) { gbUnlock('recruit', lockToken); return; }
      head.manualReview=false;

      // queuedBefore is the baseline nativeQueueReconcileRecruit compares the
      // live unit queue against; token makes the apply idempotent across the
      // callback and the reconciler.
      job.nativeToken = nativeQueueId('f');
      head.inflight = { amount:job.amount, at:Date.now(), unit:job.unit, queuedBefore:recruitQueuedAmount(job.townId, job.unit), token:job.nativeToken };
      nativeQueueSave();
    }
    recruitBuild(job.townId, job.unit, job.amount, (err) => {
      gbUnlock('recruit', lockToken);
      if (!err) {
        gbLog(`recruit: town ${job.townId} ${job.amount}× ${job.unit}`);
        if (job.nativeJobId) nativeQueueRecruitApplied(job.townId, job.nativeLane, job.nativeJobId, job.amount, job.nativeToken);
      } else {
        if (job.nativeJobId) {
          const head = nativeQueueList(job.townId, job.nativeLane, false)[0];
          if (head && head.id === job.nativeJobId) {
            head.inflight = null;
            const ambiguous=err === 'pending' || err === 'timeout_unknown';head.manualReview=ambiguous;
            nativeQueueSetJobState(head, ambiguous ? 'unknown' : 'blocked', ambiguous?'resultado desconocido; comprobar la cola real':String(err));
          }
        }
        gbLogT('recruit-err', 60000, `recruit err ${err}`);
      }
    });
  }
  // ---------- village recruit (HIGH-RISK, default OFF) ----------
  // The "Aceptar unidades de los aldeanos" button on each farming village's
  // info panel converts idle villagers into military when the village cannot
  // accept more resources (warehouse saturated). The bot learns the bridge
  // payload once via sniffBridgeBody() when the player hand-clicks Aceptar;
  // until then this scan stays a no-op (state.acceptUnitsTpl is null).
  //
  // Pair heuristic (villagePairPick below): sword+archer vs hoplite+slinger,
  // pick the higher-sum pair, then the lower-count unit inside it. Cheap,
  // deterministic, no per-village config required.
  const VILLAGE_RECRUIT_UNITS = ['sword', 'archer', 'hoplite', 'slinger'];
  const VILLAGE_PAIR_LOW = ['sword', 'archer'];
  const VILLAGE_PAIR_HIGH = ['hoplite', 'slinger'];
  const VILLAGE_RECRUIT_STREAK_TRIP = 2;
  function villagePairPick(unitCounts) {
    // unitCounts shape: {sword:N, archer:N, hoplite:N, slinger:N} — any missing
    // entry is treated as 0, which can NEVER mis-route to a wrong unit because
    // the lower-of-pair comparator needs a finite number on both sides.
    if (!unitCounts || typeof unitCounts !== 'object') return null;
    const a = (Number.isFinite(+unitCounts.sword) ? +unitCounts.sword : 0)
            + (Number.isFinite(+unitCounts.archer) ? +unitCounts.archer : 0);
    const b = (Number.isFinite(+unitCounts.hoplite) ? +unitCounts.hoplite : 0)
            + (Number.isFinite(+unitCounts.slinger) ? +unitCounts.slinger : 0);
    // Tie-break to the cheaper pair (sword/archer) — overspending on hoplites
    // is the irreversible mistake we want to make least often.
    const pair = a >= b ? VILLAGE_PAIR_LOW : VILLAGE_PAIR_HIGH;
    const lo = Number.isFinite(+unitCounts[pair[0]]) ? +unitCounts[pair[0]] : 0;
    const hi = Number.isFinite(+unitCounts[pair[1]]) ? +unitCounts[pair[1]] : 0;
    return lo <= hi ? pair[0] : pair[1];
  }
  // Read village unit counts defensively. Farm villages DO carry a small
  // garrison (the screenshot shows 12-16 of each unit at farm lvl 5), but the
  // attribute name is not in the captures — probe a few likely names and a
  // method-style fallback, then return {known:false} if nothing reads.
  function villageUnitCounts(villId) {
    if (villId == null || villId === '') return { known: false };
    try {
      const uw = gameUw();
      if (!uw || !uw.MM || typeof uw.MM.getCollections !== 'function') return { known: false };
      const cols = uw.MM.getCollections();
      const candidates = [];
      for (const col of cols || []) {
        if (!col || !Array.isArray(col.models)) continue;
        const relModels = [];
        for (const m of col.models) {
          const a = (m && m.attributes) || {};
          if (String(a.farm_town_id) === String(villId)) relModels.push({ m, a, attrs: a });
        }
        if (!relModels.length) continue;
        for (const { m, a } of relModels) {
          const bag = a.units || a.unit_count || a.garrison || a.unitCount;
          if (bag && typeof bag === 'object') {
            // Direct object map: {sword:N, archer:N, hoplite:N, slinger:N}
            const units = {};
            for (const u of VILLAGE_RECRUIT_UNITS) units[u] = +bag[u];
            const known = VILLAGE_RECRUIT_UNITS.some(u => Number.isFinite(units[u]) && units[u] >= 0);
            if (known) return { known: true, units, relId: (m && m.id) != null ? m.id : (a && a.id) };
          }
          if (typeof bag === 'number' || Array.isArray(bag)) {
            // Array form (positional, 4 slots) — order is the VILLAGE_RECRUIT_UNITS order
            const arr = Array.isArray(bag) ? bag : [bag];
            const units = {};
            VILLAGE_RECRUIT_UNITS.forEach((u, i) => { units[u] = +arr[i] || 0; });
            return { known: true, units, relId: (m && m.id) != null ? m.id : (a && a.id) };
          }
          if (typeof m.getUnitCount === 'function') {
            const units = {};
            for (const u of VILLAGE_RECRUIT_UNITS) {
              const n = +m.getUnitCount(u);
              if (Number.isFinite(n) && n >= 0) units[u] = n;
            }
            if (Object.keys(units).length) return { known: true, units, relId: m.id };
          }
        }
      }
      return { known: false };
    } catch (_) { return { known: false }; }
  }
  // Track consecutive saturated scrapes per village. Trigger fires when
  // streak >= VILLAGE_RECRUIT_STREAK_TRIP — one stale reading can't trigger
  // a post. Reset on any reading below threshold.
  function villageSaturationStreak(villId) {
    if (!state.farmResources || !state.farmResources[villId]) return 0;
    const r = state.farmResources[villId];
    if (!r.ok || !(r.cap > 0)) return 0;
    const sum = (Number.isFinite(+r.wood) ? +r.wood : 0)
               + (Number.isFinite(+r.stone) ? +r.stone : 0)
               + (Number.isFinite(+r.iron) ? +r.iron : 0)
               + (Number.isFinite(+r.pop) ? +r.pop : 0);
    const fill = sum / r.cap;
    const thresh = Math.max(0.5, Math.min(1, (+state.villageRecruitFillPct || 90) / 100));
    const streaks = state.villageRecruitStreaks || (state.villageRecruitStreaks = {});
    const prev = +streaks[villId] || 0;
    const next = fill >= thresh ? prev + 1 : 0;
    streaks[villId] = next;
    return next;
  }
  // Post a single accept-units bridge call. Payload reuses the learned
  // template's action_name + base arguments; we overlay farm_town_id, unit_id
  // and amount at post time so the same template serves every village and
  // every unit.
  function villageAcceptUnits(farm, unitId, amount, onDone) {
    const tpl = state.acceptUnitsTpl || null;
    const actionName = (tpl && tpl.action_name) || 'accept_units';
    const baseArgs = (tpl && tpl.arguments) || {};
    const args = Object.assign({}, baseArgs, {
      farm_town_id: +farm.vill_id,
      unit_id: String(unitId),
      amount: +amount,
    });
    const modelUrl = (tpl && tpl.model_url) || ('FarmTownPlayerRelation/' + (farm.relation_id || ''));
    bridgePost('villrecruit', {
      model_url: modelUrl,
      action_name: actionName,
      arguments: args,
      town_id: +farm.owning_town_id || 0,
    }, onDone);
  }
  function villageRecruitScan(reason) {
    if (!hostEnabled() || !state.autoVillageRecruit) return;
    if (automationPaused({})) return;
    if (captchaPaused('villrecruit')) return;
    if (gbLocked('village-recruit')) return;
    // Same hard rule: accepting units from a village never outranks claiming
    // its resources, even though this loop only fires on a saturated village.
    if (farmFirstHold('villrecruit')) return;

    // Template must be learned from a hand-click before any post. Log once
    // per world per 10min so the player knows what to do.
    if (!state.acceptUnitsTpl || !state.acceptUnitsTpl.action_name) {
      gbLogT('villrecruit-tpl', 600000, 'village recruit: abre una aldea, pulsa Aceptar una vez a mano para ensenar al bot el payload del puente');
      return;
    }

    const list = state.farmsParsed || [];
    if (!list.length) return;

    for (const farm of list) {
      if (!farm || !farm.vill_id) continue;

      // Skip if this village belongs to a farm relation the player doesn't own
      // (manual textarea entries can sneak in relations of other players).
      if (farm._rel && typeof farmBelongsToPlayer === 'function') {
        const a = farm._attrs || {};
        if (!farmBelongsToPlayer(farm._rel, a)) continue;
      }

      const streak = villageSaturationStreak(farm.vill_id);
      if (streak < VILLAGE_RECRUIT_STREAK_TRIP) continue;

      const counts = villageUnitCounts(farm.vill_id);
      if (!counts || !counts.known) continue;

      const unit = villagePairPick(counts.units);
      if (!unit) continue;

      const owning = typeof townIdForFarm === 'function' ? townIdForFarm(farm) : null;
      if (!owning) continue;
      farm.owning_town_id = owning;

      const amount = Math.max(1, Math.min(20, +state.villageRecruitAmount || 1));
      const lockToken = gbLock('village-recruit', 60000);
      if (!lockToken) return;

      gbLog(`village recruit: vill ${farm.vill_id} -> ${amount}x ${unit} (streak ${streak}, town ${owning})`);
      villageAcceptUnits(farm, unit, amount, (err) => {
        gbUnlock('village-recruit', lockToken);
        if (!err) {
          gbLog(`village recruit: vill ${farm.vill_id} +${amount} ${unit}`);
          flash(`aldea ${farm.name || farm.vill_id}: +${amount} ${unit}`);
        } else {
          gbLogT('villrecruit-err-' + farm.vill_id, 60000, `village recruit err ${farm.vill_id}: ${err}`);
        }
      });

      // one village per tick; the orch will pick this up again next due window
      return;
    }
  }
  function batchRecruitNormLists() {
    let root = state.batchRecruitLists;
    if (!root || typeof root !== 'object' || Array.isArray(root)) root = state.batchRecruitLists = { towns: {} };
    if (!root.towns || typeof root.towns !== 'object' || Array.isArray(root.towns)) root.towns = {};

    try {
      const known = new Set();
      try { Object.keys((gameUw().ITowns && gameUw().ITowns.towns) || {}).forEach(id => known.add(String(id))); } catch (_) {}
      try { (state.towns || []).forEach(t => t && t.id != null && known.add(String(t.id))); } catch (_) {}
      let pruned = 0;
      for (const id of Object.keys(root.towns)) {
        if (!known.has(String(id))) { delete root.towns[id]; pruned++; }
      }
      if (pruned) gbLog(`batch recruit: ${pruned} lista(s) huérfana(s) eliminada(s)`);
    } catch (_) {}
    return root;
  }
  function batchRecruitTownList(townId) {
    const id = String(townId == null ? '' : townId);
    if (!id) return [];
    const root = batchRecruitNormLists();
    let arr = root.towns[id];
    if (!Array.isArray(arr)) arr = root.towns[id] = [];

    for (let i = arr.length - 1; i >= 0; i--) {
      const r = arr[i];
      const u = r && r.unit;
      const a = r && Number(r.amount);
      if (!u || typeof u !== 'string' || !gbGameDataLookup('units', u) || !(a > 0)) arr.splice(i, 1);
    }
    return arr;
  }
  function batchRecruitListSave() {

    try { saveSoon(STORE.BATCH_RECRUIT_LISTS, state.batchRecruitLists); } catch (_) {}
  }
  function batchRecruitAddRow(townId, unit, amount) {
    const id = String(townId == null ? '' : townId);
    if (!id || !unit || !gbGameDataLookup('units', unit)) return false;
    const a = Math.max(1, Math.floor(+amount || 0));
    if (!(a > 0)) return false;
    const list = batchRecruitTownList(id);
    list.push({ unit: String(unit), amount: a });
    batchRecruitListSave();
    return true;
  }
  function batchRecruitRemoveRow(townId, idx) {
    const id = String(townId == null ? '' : townId);
    if (!id) return false;
    const list = batchRecruitTownList(id);
    if (idx < 0 || idx >= list.length) return false;
    list.splice(idx, 1);
    batchRecruitListSave();
    return true;
  }
  function batchRecruitClearTown(townId) {
    const id = String(townId == null ? '' : townId);
    if (!id) return;
    const root = batchRecruitNormLists();
    if (root.towns[id] && root.towns[id].length) {
      delete root.towns[id];
      batchRecruitListSave();
    }
  }
  function batchRecruitCostPreview(townId, rows) {
    const t = (typeof gbTownModel === 'function') ? gbTownModel(townId) : null;
    const list = Array.isArray(rows) ? rows : batchRecruitTownList(townId);
    let wood = 0, stone = 0, iron = 0, pop = 0, favor = 0;
    const missing = [];
    for (const r of list) {
      const def = gbGameDataLookup('units', r.unit);
      if (!def) { missing.push(r.unit); continue; }
      const a = +r.amount || 0;
      const res = def.resources || {};
      wood += (+res.wood || 0) * a;
      stone += (+res.stone || 0) * a;
      iron += (+res.iron || 0) * a;
      pop += (+def.population || 0) * a;
      const fv = +(def.favor ?? res.favor) || 0;
      if (fv > 0) favor += fv * a;
    }
    const rs = t && t.resources && t.resources();
    const haveWood = rs ? +rs.wood : null;
    const haveStone = rs ? +rs.stone : null;
    const haveIron = rs ? +rs.iron : null;
    const havePop = (t && typeof t.getAvailablePopulation === 'function') ? +t.getAvailablePopulation() : null;
    const fits = !(missing.length) && wood <= (haveWood == null ? Infinity : haveWood)
      && stone <= (haveStone == null ? Infinity : haveStone)
      && iron <= (haveIron == null ? Infinity : haveIron)
      && pop <= (havePop == null ? Infinity : havePop);
    return { wood, stone, iron, pop, favor, haveWood, haveStone, haveIron, havePop, fits, missing };
  }
  const _batchRecruitBlind = new Set();
  function batchRecruitAtomicAfford(townId) {
    const list = batchRecruitTownList(townId);
    if (!list.length) return { ok: false, why: 'empty' };
    const t = gbTownModel(townId);
    if (!t) {
      const k = String(townId) + '|town';
      if (!_batchRecruitBlind.has(k)) { _batchRecruitBlind.add(k); gbLogT('batch-recruit-blind-' + townId, 300000, `batch recruit: town ${townId} model unreadable - blind precheck, server judges`); }
      return { ok: false, why: 'blind-town' };
    }
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      const unit = r && r.unit;
      const amount = +r.amount || 0;
      if (!unit || !(amount > 0)) continue;
      if (!recruitControllerFor(unit)) return { ok: false, why: 'no-controller', rowIdx: i, unit };
      if (!recruitCanBuild(townId, unit)) return { ok: false, why: 'requirements', rowIdx: i, unit };
      if (!recruitQueueHasSpace(townId, unit)) return { ok: false, why: 'queue', rowIdx: i, unit };
      const afford = recruitAffordableAmount(townId, unit, amount);
      if (afford < amount) return { ok: false, why: 'resources/pop/favor', rowIdx: i, unit };
    }
    return { ok: true };
  }
  function batchRecruitFire(townId) {
    const list = batchRecruitTownList(townId);
    if (!list.length) return;
    const lockToken = gbLock('recruit', 120000);
    if (!lockToken) return;
    let idx = 0;
    let stopped = false;
    const fireOne = () => {
      if (stopped || idx >= list.length) {
        gbUnlock('recruit', lockToken);
        return;
      }

      const r = list[idx++];
      const unit = r.unit, amount = +r.amount || 0;

      const validated = recruitValidateJob({ townId, unit, amount });
      if (!validated.ok) {
        stopped = true;
        gbLogT(`batch-recruit-pre-${townId}`, 60000, `batch recruit: ${validated.why} @ ${unit} (row ${idx}/${list.length})`);
        gbUnlock('recruit', lockToken);
        return;
      }
      recruitBuild(townId, unit, validated.amount, (err) => {
        if (err) {
          stopped = true;
          gbLogT(`batch-recruit-partial-${townId}`, 60000, `batch recruit: stopped at row ${idx}/${list.length} (${err})`);
          gbUnlock('recruit', lockToken);
          return;
        }
        gbLog(`batch recruit: town ${townId} ${validated.amount}× ${unit} (row ${idx}/${list.length})`);

        gbTimeout(fireOne, 450);
      });
    };
    fireOne();
  }
  function batchRecruitHasAnyTown() {
    try {
      const root = batchRecruitNormLists();
      for (const townId of Object.keys(root.towns || {})) {
        if (batchRecruitTownList(townId).length) return true;
      }
    } catch (_) {}
    return false;
  }
  function batchRecruitUiAllUnits() {
    const out = [];
    try {
      const uw = gameUw();
      const gd = (uw && (uw.GameData || {}).units) || null;
      if (gd && typeof gd === 'object') {
        for (const k of Object.keys(gd)) {
          const d = gd[k];
          if (!d) continue;

          if (d.is_research || d.not_unit) continue;

          const r = d.resources || {};
          if (!(+r.wood || +r.stone || +r.iron)) continue;
          out.push(String(k));
        }
      }
    } catch (_) {}
    out.sort();
    return out;
  }
  function batchRecruitUiTownIds() {
    const out = [];
    try {
      const uw = gameUw();
      const ts = (uw && uw.ITowns && uw.ITowns.towns) || {};
      Object.keys(ts).forEach(id => out.push(String(id)));
    } catch (_) {}
    if (!out.length) {
      try { (state.towns || []).forEach(t => t && t.id != null && out.push(String(t.id))); } catch (_) {}
    }

    try {
      const root = batchRecruitNormLists();
      for (const id of Object.keys(root.towns || {})) {
        if (!out.includes(String(id))) { delete root.towns[id]; batchRecruitListSave(); }
      }
    } catch (_) {}
    return out;
  }
  function batchRecruitUiTownName(id) {
    const sid = String(id);
    try {
      const t = gbTownModel(sid);
      const a = t && (t.attributes || t);
      if (a && a.name) return String(a.name);
    } catch (_) {}
    try {
      const t = (state.towns || []).find(x => String(x.id) === sid);
      if (t && t.name) return String(t.name);
    } catch (_) {}
    return sid;
  }
  function batchRecruitUiGetSelectedTown() {
    try {
      const sec = trainSection();
      const sel = sec && sec.querySelector('[data-cfg=batch-recruit-town]');
      if (sel && sel.value) return String(sel.value);
    } catch (_) {}
    const ids = batchRecruitUiTownIds();
    if (!ids.length) return '';

    const withLists = ids.filter(id => batchRecruitTownList(id).length);
    return withLists[0] || ids[0] || '';
  }
  function batchRecruitUiPaint() {
    const sec = trainSection();
    if (!sec) return;
    const townSel = sec.querySelector('[data-cfg=batch-recruit-town]');
    const rowsHost = sec.querySelector('#gb-batch-recruit-rows');
    const sumHost = sec.querySelector('#gb-batch-recruit-summary');
    if (!townSel || !rowsHost || !sumHost) return;
    const ids = batchRecruitUiTownIds();

    townSel.replaceChildren();
    if (!ids.length) {
      const opt = document.createElement('option');
      opt.value = ''; opt.textContent = '— sin ciudades —';
      townSel.appendChild(opt); townSel.disabled = true;
    } else {
      townSel.disabled = false;
      ids.forEach(id => {
        const opt = document.createElement('option');
        opt.value = id;
        const count = batchRecruitTownList(id).length;
        opt.textContent = `${batchRecruitUiTownName(id)}${count ? `  (${count})` : ''}`;
        townSel.appendChild(opt);
      });
      const cur = String(townSel.value || '') || batchRecruitUiGetSelectedTown();
      townSel.value = ids.includes(cur) ? cur : ids[0];
    }

    const townId = townSel.value;
    const list = townId ? batchRecruitTownList(townId) : [];
    rowsHost.replaceChildren();
    if (!townId) { sumHost.textContent = ''; return; }
    if (!list.length) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#888;font-size:10px;padding:4px 0';
      e.textContent = 'lista vacía — añade una línea y elige unidad + cantidad';
      rowsHost.appendChild(e);
    } else {
      const units = batchRecruitUiAllUnits();
      list.forEach((row, idx) => {
        const line = document.createElement('div');
        line.style.cssText = 'display:flex;gap:4px;align-items:center;padding:2px 0;font-size:11px';
        const uSel = document.createElement('select');
        uSel.style.cssText = 'background:#11141a;color:var(--gb-fg);border:1px solid #4b5260;border-radius:4px;padding:2px 4px;min-width:120px';
        units.forEach(u => {
          const opt = document.createElement('option');
          opt.value = u; opt.textContent = u;
          if (u === row.unit) opt.selected = true;
          uSel.appendChild(opt);
        });
        const qty = document.createElement('input');
        qty.type = 'number'; qty.min = '1'; qty.max = '10000'; qty.step = '1';
        qty.value = String(row.amount);
        qty.style.cssText = 'width:62px;background:#11141a;color:var(--gb-fg);border:1px solid #4b5260;border-radius:4px;padding:2px 4px';
        const cost = batchRecruitUiRowCost(row);
        const costSpan = document.createElement('span');
        costSpan.style.cssText = 'color:#aab2bd;flex:1;font-size:10px';
        costSpan.textContent = cost;
        const trash = document.createElement('button');
        trash.textContent = '🗑'; trash.title = 'quitar línea';
        trash.className = 'gb-cfg-btn danger';
        trash.style.cssText = 'padding:2px 6px';
        trash.addEventListener('click', () => {
          batchRecruitRemoveRow(townId, idx);
          batchRecruitUiPaint();
        });
        uSel.addEventListener('change', () => {
          row.unit = uSel.value;
          batchRecruitListSave();
          batchRecruitUiPaint();
        });
        qty.addEventListener('input', () => {
          const v = Math.max(1, Math.floor(+qty.value || 1));
          row.amount = v;
          batchRecruitListSave();
          batchRecruitUiPaint();
        });
        line.appendChild(uSel); line.appendChild(qty);
        line.appendChild(costSpan); line.appendChild(trash);
        rowsHost.appendChild(line);
      });
    }

    const preview = batchRecruitCostPreview(townId, list);
    if (!list.length) {
      sumHost.textContent = '';
    } else {
      const parts = [];
      if (preview.wood) parts.push(`mad ${preview.wood}`);
      if (preview.stone) parts.push(`pie ${preview.stone}`);
      if (preview.iron) parts.push(`pla ${preview.iron}`);
      if (preview.pop) parts.push(`pop ${preview.pop}`);
      if (preview.favor) parts.push(`favor ${preview.favor}`);
      const totals = parts.join(' / ');
      const have = [];
      if (preview.haveWood != null) have.push(`mad ${preview.haveWood}`);
      if (preview.haveStone != null) have.push(`pie ${preview.haveStone}`);
      if (preview.haveIron != null) have.push(`pla ${preview.haveIron}`);
      if (preview.havePop != null) have.push(`pop libre ${preview.havePop}`);
      const tag = preview.missing && preview.missing.length
        ? ` (falta información de: ${preview.missing.join(', ')})`
        : (preview.fits ? ' → cabe ✓' : ' → falta');
      const color = preview.fits ? '#7ddd96' : '#e5bf70';
      sumHost.innerHTML = '';
      const a = document.createElement('div');
      a.style.cssText = `color:${color};font-size:10px`;
      a.textContent = `total: ${totals || '0'} · ciudad ahora: ${have.join(' / ') || '—'}${tag}`;
      sumHost.appendChild(a);
    }
  }
  function batchRecruitUiRowCost(row) {
    const def = gbGameDataLookup('units', row && row.unit);
    if (!def) return '— desconocida —';
    const r = def.resources || {};
    const parts = [];
    const a = +row.amount || 0;
    if (+r.wood) parts.push(`mad ${(+r.wood) * a}`);
    if (+r.stone) parts.push(`pie ${(+r.stone) * a}`);
    if (+r.iron) parts.push(`pla ${(+r.iron) * a}`);
    if (+def.population) parts.push(`pop ${(+def.population) * a}`);
    const fav = +(def.favor || (r && r.favor) || 0);
    if (fav) parts.push(`favor ${fav * a}`);
    return parts.join(' / ') || 'gratis';
  }
  function batchRecruitUiAdd() {
    const sec = trainSection();
    if (!sec) return;
    const townSel = sec.querySelector('[data-cfg=batch-recruit-town]');
    const townId = townSel && townSel.value;
    if (!townId) { flash('elige una ciudad antes de añadir línea'); return; }
    const units = batchRecruitUiAllUnits();
    const pick = units.includes('sword') ? 'sword' : (units[0] || 'sword');
    batchRecruitAddRow(townId, pick, 10);
    batchRecruitUiPaint();
  }
  function batchRecruitUiClear() {
    const sec = trainSection();
    if (!sec) return;
    const townId = batchRecruitUiGetSelectedTown();
    if (!townId) return;
    if (!(batchRecruitTownList(townId).length)) return;
    batchRecruitClearTown(townId);
    batchRecruitUiPaint();
    flash(`lote de la ciudad ${townId} vaciado`);
  }
  function batchRecruitUiArm() {
    if (captchaPaused('recruit')) { flash('captcha activa — espera'); return; }
    if (!batchRecruitHasAnyTown()) { flash('no hay listas armadas'); return; }
    batchRecruitScan('manual');
  }
  const RECRUIT_PACK_NAME_MAX = 40;
  function recruitPacksRoot() {
    if (!state.recruitPacks || typeof state.recruitPacks !== 'object' || Array.isArray(state.recruitPacks)) {
      state.recruitPacks = {};
    }
    return state.recruitPacks;
  }
  function recruitPacksSave() {
    try { save(STORE.RECRUIT_PACKS, recruitPacksRoot()); } catch (_) {}
  }
  function recruitPackNames() {
    return Object.keys(recruitPacksRoot()).sort((a, b) => a.localeCompare(b));
  }
  function recruitPackRows(name) {
    const key = String(name == null ? '' : name);
    if (!key) return [];
    const root = recruitPacksRoot();
    let arr = root[key];
    if (!Array.isArray(arr)) arr = root[key] = [];
    for (let i = arr.length - 1; i >= 0; i--) {
      const r = arr[i];
      const u = r && r.unit;
      const a = r && Number(r.amount);
      if (!u || typeof u !== 'string' || !gbGameDataLookup('units', u) || !(a > 0)) arr.splice(i, 1);
    }
    return arr;
  }
  function recruitPackCreate(name) {
    const key = String(name == null ? '' : name).trim().slice(0, RECRUIT_PACK_NAME_MAX);
    if (!key) return '';
    const root = recruitPacksRoot();
    if (!Array.isArray(root[key])) root[key] = [];
    recruitPacksSave();
    return key;
  }
  function recruitPackDelete(name) {
    const key = String(name == null ? '' : name);
    const root = recruitPacksRoot();
    if (!key || !root[key]) return false;
    delete root[key];
    recruitPacksSave();
    return true;
  }
  function recruitPackAddRow(name, unit, amount) {
    const key = String(name == null ? '' : name);
    if (!key || !unit || !gbGameDataLookup('units', unit)) return false;
    const a = Math.max(1, Math.floor(+amount || 0));
    if (!(a > 0)) return false;
    const rows = recruitPackRows(key);
    const hit = rows.find(r => r.unit === String(unit));
    if (hit) hit.amount = a; else rows.push({ unit: String(unit), amount: a });
    recruitPacksSave();
    return true;
  }
  function recruitPackRemoveRow(name, idx) {
    const rows = recruitPackRows(name);
    if (idx < 0 || idx >= rows.length) return false;
    rows.splice(idx, 1);
    recruitPacksSave();
    return true;
  }
  function recruitPackFromTown(name, townId) {
    const key = recruitPackCreate(name);
    if (!key) return false;
    const src = batchRecruitTownList(townId);
    if (!src.length) return false;
    recruitPacksRoot()[key] = src.map(r => ({ unit: r.unit, amount: +r.amount || 0 }));
    recruitPacksSave();
    return true;
  }
  function recruitPackApply(name, townId, mode) {
    const rows = recruitPackRows(name);
    const id = String(townId == null ? '' : townId);
    if (!id || !rows.length) return -1;
    if (mode === 'replace') batchRecruitClearTown(id);
    const list = batchRecruitTownList(id);
    for (const r of rows) {
      const amt = Math.max(1, Math.floor(+r.amount || 0));
      const hit = list.find(x => x.unit === r.unit);
      if (!hit) { list.push({ unit: r.unit, amount: amt }); continue; }
      hit.amount = mode === 'replace' ? amt : Math.max(1, Math.floor((+hit.amount || 0) + amt));
    }
    batchRecruitListSave();
    return list.length;
  }
  function recruitPackApplyAll(name, mode) {
    const ids = batchRecruitUiTownIds();
    let towns = 0;
    for (const id of ids) { if (recruitPackApply(name, id, mode) > 0) towns++; }
    return towns;
  }
  function trainSection() {
    return panel && panel.querySelector('section[data-tab=train]');
  }
  function recruitTargetsRoot() {
    if (!state.recruitTargets || typeof state.recruitTargets !== 'object' || Array.isArray(state.recruitTargets)) {
      state.recruitTargets = {};
    }
    return state.recruitTargets;
  }
  function recruitTargetsSave() {
    try { save(STORE.RECRUIT_TARGETS, recruitTargetsRoot()); } catch (_) {}
  }
  function recruitTargetTownMap(townId, create) {
    const root = recruitTargetsRoot();
    const id = String(townId == null ? '' : townId);
    if (!id) return {};
    const cur = root[id];
    const ok = cur && typeof cur === 'object' && !Array.isArray(cur);
    if (ok) return cur;
    if (!create) return {};
    root[id] = {};
    return root[id];
  }
  function recruitTargetTownCount() {
    const root = recruitTargetsRoot();
    return Object.keys(root).filter(id => {
      const m = root[id];
      return m && typeof m === 'object' && !Array.isArray(m) && Object.keys(m).length;
    }).length;
  }
  function recruitTargetSet(townId, unit, amount) {
    const id = String(townId == null ? '' : townId);
    if (!id || !unit || !gbGameDataLookup('units', unit)) return false;
    const n = Math.max(0, Math.floor(+amount || 0));
    const map = recruitTargetTownMap(id, n > 0);
    if (n > 0) map[String(unit)] = n; else delete map[String(unit)];
    if (!Object.keys(map).length) delete recruitTargetsRoot()[id];
    recruitTargetsSave();
    return true;
  }
  function recruitTargetClearTown(townId) {
    const id = String(townId == null ? '' : townId);
    const root = recruitTargetsRoot();
    if (!id || !root[id]) return false;
    delete root[id];
    recruitTargetsSave();
    return true;
  }
  function trainSelectedTown() {
    const sec = trainSection();
    const sel = sec && sec.querySelector('[data-tr=tgt-town]');
    if (sel && sel.value) return String(sel.value);
    const ids = batchRecruitUiTownIds();
    const withTargets = ids.filter(id => Object.keys(recruitTargetTownMap(id)).length);
    return withTargets[0] || ids[0] || '';
  }
  function trainToggleButtons(sec) {
    const auto = sec.querySelector('[data-tr=auto]');
    if (auto) {
      auto.textContent = `Reposicion automatica: ${state.autoRecruit ? 'ON' : 'OFF'}`;
      auto.classList.toggle('on', !!state.autoRecruit);
    }
    const batch = sec.querySelector('[data-tr=batch]');
    if (batch) {
      batch.textContent = `Lote recurrente: ${state.batchRecruit ? 'ON' : 'OFF'}`;
      batch.classList.toggle('on', !!state.batchRecruit);
    }
    const st = sec.querySelector('#gb-tr-state');
    if (st) {
      const towns = recruitTargetTownCount();
      st.textContent = towns
        ? `${towns} ciudad(es) con objetivos`
        : 'sin objetivos — el reclutamiento automatico no tiene nada que reponer';
    }
  }
  function trainTargetRowText(townId, unit, tgt) {
    let have = null, queued = null;
    try { const counts = goalUnitCounts(townId); have = counts && Object.prototype.hasOwnProperty.call(counts, unit) ? +counts[unit] || 0 : (counts ? 0 : null); } catch (_) {}
    try { const q = recruitQueuedAmount(townId, unit); queued = Number.isFinite(+q) ? +q : null; } catch (_) {}
    const haveTxt = have == null ? '—' : String(have);
    const qTxt = queued == null ? '—' : String(queued);
    const missing = (have == null || queued == null) ? null : Math.max(0, tgt - have - queued);
    const missTxt = missing == null ? 'falta —' : (missing > 0 ? `faltan ${missing}` : 'completo ✓');
    return { text: `tiene ${haveTxt} · en cola ${qTxt} · ${missTxt}`, done: missing === 0 };
  }
  function renderTrain() {
    const sec = trainSection();
    if (!sec) return;
    trainToggleButtons(sec);
    const townSel = sec.querySelector('[data-tr=tgt-town]');
    const unitSel = sec.querySelector('[data-tr=tgt-unit]');
    const rowsHost = sec.querySelector('#gb-tr-targets');
    const note = sec.querySelector('#gb-tr-note');
    if (!townSel || !unitSel || !rowsHost) return;
    const ids = batchRecruitUiTownIds();
    const keepTown = String(townSel.value || '') || trainSelectedTown();
    townSel.replaceChildren();
    if (!ids.length) {
      const opt = document.createElement('option');
      opt.value = ''; opt.textContent = '— sin ciudades —';
      townSel.appendChild(opt); townSel.disabled = true;
    } else {
      townSel.disabled = false;
      ids.forEach(id => {
        const opt = document.createElement('option');
        opt.value = id;
        const n = Object.keys(recruitTargetTownMap(id)).length;
        opt.textContent = `${batchRecruitUiTownName(id)}${n ? `  (${n})` : ''}`;
        townSel.appendChild(opt);
      });
      townSel.value = ids.includes(keepTown) ? keepTown : ids[0];
    }
    const units = batchRecruitUiAllUnits();
    const keepUnit = String(unitSel.value || '');
    unitSel.replaceChildren();
    if (!units.length) {
      const opt = document.createElement('option');
      opt.value = ''; opt.textContent = '— GameData no legible —';
      unitSel.appendChild(opt); unitSel.disabled = true;
    } else {
      unitSel.disabled = false;
      units.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u; opt.textContent = u;
        unitSel.appendChild(opt);
      });
      unitSel.value = units.includes(keepUnit) ? keepUnit : (units.includes('sword') ? 'sword' : units[0]);
    }
    const townId = townSel.value;
    const map = townId ? recruitTargetTownMap(townId) : {};
    const keys = Object.keys(map);
    rowsHost.replaceChildren();
    if (!townId || !keys.length) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#888;font-size:10px;padding:4px 0';
      e.textContent = 'sin objetivos en esta ciudad — elige unidad, cantidad y pulsa Fijar';
      rowsHost.appendChild(e);
    } else {
      keys.sort().forEach(unit => {
        const tgt = +map[unit] || 0;
        const line = document.createElement('div');
        line.style.cssText = 'display:flex;gap:6px;align-items:center;padding:2px 0;font-size:11px;border-bottom:1px solid var(--gb-rule)';
        const name = document.createElement('span');
        name.style.cssText = 'min-width:110px';
        name.textContent = unit;
        const qty = document.createElement('input');
        qty.type = 'number'; qty.min = '0'; qty.max = '100000'; qty.step = '1';
        qty.value = String(tgt);
        qty.style.cssText = 'width:70px';

        qty.addEventListener('change', () => {
          recruitTargetSet(townId, unit, qty.value);
          renderTrain();
        });
        const info = trainTargetRowText(townId, unit, tgt);
        const st = document.createElement('span');
        st.style.cssText = `flex:1;font-size:10px;color:${info.done ? '#7ddd96' : 'var(--gb-fg-soft2)'}`;
        st.textContent = info.text;
        const del = document.createElement('button');
        del.type = 'button';
        del.textContent = '🗑'; del.title = 'quitar objetivo';
        del.addEventListener('click', () => { recruitTargetSet(townId, unit, 0); renderTrain(); });
        line.appendChild(name); line.appendChild(qty); line.appendChild(st); line.appendChild(del);
        rowsHost.appendChild(line);
      });
    }
    renderTrainPacks(sec);
    if (note) {
      note.textContent = state.autoRecruit
        ? 'La reposicion corre en el ciclo del orquestador; una ciudad cuya cola manual (FIFO) este activa no se repone en ese muelle.'
        : 'Reposicion automatica OFF: los objetivos quedan guardados pero no se recluta nada.';
    }
    try { batchRecruitUiPaint(); } catch (_) {}
  }
  function trainSelectedPack(sec) {
    const sel = sec && sec.querySelector('[data-tr=pack]');
    const cur = sel && sel.value ? String(sel.value) : '';
    if (cur && recruitPacksRoot()[cur]) return cur;
    return recruitPackNames()[0] || '';
  }
  function renderTrainPacks(sec) {
    const packSel = sec.querySelector('[data-tr=pack]');
    const unitSel = sec.querySelector('[data-tr=pack-unit]');
    const townSel = sec.querySelector('[data-tr=pack-town]');
    const rowsHost = sec.querySelector('#gb-tr-pack-rows');
    const note = sec.querySelector('#gb-tr-pack-note');
    if (!packSel || !unitSel || !townSel || !rowsHost) return;
    const names = recruitPackNames();
    const keep = trainSelectedPack(sec);
    packSel.replaceChildren();
    if (!names.length) {
      const opt = document.createElement('option');
      opt.value = ''; opt.textContent = '— sin packs —';
      packSel.appendChild(opt); packSel.disabled = true;
    } else {
      packSel.disabled = false;
      names.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n;
        opt.textContent = `${n}  (${recruitPackRows(n).length})`;
        packSel.appendChild(opt);
      });
      packSel.value = names.includes(keep) ? keep : names[0];
    }
    const units = batchRecruitUiAllUnits();
    const keepUnit = String(unitSel.value || '');
    unitSel.replaceChildren();
    if (!units.length) {
      const opt = document.createElement('option');
      opt.value = ''; opt.textContent = '— GameData no legible —';
      unitSel.appendChild(opt); unitSel.disabled = true;
    } else {
      unitSel.disabled = false;
      units.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u; opt.textContent = u;
        unitSel.appendChild(opt);
      });
      unitSel.value = units.includes(keepUnit) ? keepUnit : (units.includes('sword') ? 'sword' : units[0]);
    }
    const ids = batchRecruitUiTownIds();
    const keepTown = String(townSel.value || '');
    townSel.replaceChildren();
    {
      const all = document.createElement('option');
      all.value = '__all__'; all.textContent = 'todas las ciudades';
      townSel.appendChild(all);
      ids.forEach(id => {
        const opt = document.createElement('option');
        opt.value = id; opt.textContent = batchRecruitUiTownName(id);
        townSel.appendChild(opt);
      });
      const valid = ['__all__'].concat(ids);
      townSel.value = valid.includes(keepTown) ? keepTown : (ids[0] || '__all__');
    }
    const name = packSel.value;
    const rows = name ? recruitPackRows(name) : [];
    rowsHost.replaceChildren();
    if (!name) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#888;font-size:10px;padding:4px 0';
      e.textContent = 'escribe un nombre y pulsa Nuevo — luego añade espada, arquero, birreme… al pack';
      rowsHost.appendChild(e);
    } else if (!rows.length) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#888;font-size:10px;padding:4px 0';
      e.textContent = 'pack vacío — elige unidad + cantidad y pulsa "+ unidad"';
      rowsHost.appendChild(e);
    } else {
      rows.forEach((row, idx) => {
        const line = document.createElement('div');
        line.style.cssText = 'display:flex;gap:6px;align-items:center;padding:2px 0;font-size:11px;border-bottom:1px solid var(--gb-rule)';
        const nm = document.createElement('span');
        nm.style.cssText = 'min-width:110px';
        nm.textContent = row.unit;
        const qty = document.createElement('input');
        qty.type = 'number'; qty.min = '1'; qty.max = '10000'; qty.step = '1';
        qty.value = String(row.amount);
        qty.style.cssText = 'width:70px';

        qty.addEventListener('change', () => {
          recruitPackAddRow(name, row.unit, qty.value);
          renderTrain();
        });
        const cost = document.createElement('span');
        cost.style.cssText = 'flex:1;font-size:10px;color:var(--gb-fg-soft2)';
        cost.textContent = batchRecruitUiRowCost(row);
        const del = document.createElement('button');
        del.type = 'button';
        del.textContent = '🗑'; del.title = 'quitar del pack';
        del.addEventListener('click', () => { recruitPackRemoveRow(name, idx); renderTrain(); });
        line.appendChild(nm); line.appendChild(qty); line.appendChild(cost); line.appendChild(del);
        rowsHost.appendChild(line);
      });
    }
    if (note) {
      if (!name || !rows.length) { note.textContent = ''; return; }
      const target = townSel.value;

      const preview = batchRecruitCostPreview(target === '__all__' ? null : target, rows);
      const parts = [];
      if (preview.wood) parts.push(`mad ${preview.wood}`);
      if (preview.stone) parts.push(`pie ${preview.stone}`);
      if (preview.iron) parts.push(`pla ${preview.iron}`);
      if (preview.pop) parts.push(`pop ${preview.pop}`);
      if (preview.favor) parts.push(`favor ${preview.favor}`);
      let txt = `pack "${name}": ${rows.length} unidad(es) · ${parts.join(' / ') || 'gratis'}`;
      if (preview.missing && preview.missing.length) txt += ` (falta información de: ${preview.missing.join(', ')})`;
      else if (target !== '__all__') txt += preview.fits ? ' → cabe ahora ✓' : ' → no cabe todavía';
      note.textContent = txt;
      note.style.color = (target !== '__all__' && !(preview.missing || []).length)
        ? (preview.fits ? '#7ddd96' : '#e5bf70') : '#888';
    }
  }
  let trainBound = false;
  function bindTrainTab() {
    const sec = trainSection();
    if (!sec || trainBound) return;
    trainBound = true;
    const on = (sel, type, fn) => { const el = sec.querySelector(sel); if (el) el.addEventListener(type, fn); };
    on('[data-tr=auto]', 'click', e => {
      e.preventDefault();
      state.autoRecruit = !state.autoRecruit;
      save(STORE.AUTO_RECRUIT, state.autoRecruit);
      gbLog('auto-recruit', state.autoRecruit ? 'ON' : 'OFF');
      try { updateStatus(); } catch (_) {}
      renderTrain();
      if (state.autoRecruit) recruitScan('toggle');
    });
    on('[data-tr=batch]', 'click', e => {
      e.preventDefault();
      state.batchRecruit = !state.batchRecruit;
      save(STORE.BATCH_RECRUIT, state.batchRecruit);
      gbLog('batch-recruit', state.batchRecruit ? 'ON' : 'OFF');
      try { updateStatus(); } catch (_) {}
      renderTrain();
    });
    on('[data-tr=tgt-town]', 'change', () => renderTrain());
    on('[data-tr=tgt-add]', 'click', e => {
      e.preventDefault();
      const townId = sec.querySelector('[data-tr=tgt-town]')?.value || '';
      const unit = sec.querySelector('[data-tr=tgt-unit]')?.value || '';
      const amtEl = sec.querySelector('[data-tr=tgt-amount]');
      const amount = Math.max(0, Math.floor(+(amtEl && amtEl.value) || 0));
      if (!townId) { flash('elige una ciudad'); return; }
      if (!unit) { flash('elige una unidad'); return; }
      if (!recruitTargetSet(townId, unit, amount)) { flash('unidad desconocida'); return; }
      flash(amount > 0 ? `objetivo ${unit} = ${amount}` : `objetivo ${unit} quitado`);
      renderTrain();
    });
    on('[data-tr=tgt-clear]', 'click', e => {
      e.preventDefault();
      const townId = sec.querySelector('[data-tr=tgt-town]')?.value || '';
      if (!townId) return;
      if (!recruitTargetClearTown(townId)) return;
      flash(`objetivos de la ciudad ${townId} borrados`);
      renderTrain();
    });
    const packVal = sel => (sec.querySelector(sel)?.value || '').trim();
    on('[data-tr=pack]', 'change', () => renderTrain());
    on('[data-tr=pack-town]', 'change', () => renderTrain());
    on('[data-tr=pack-new]', 'click', e => {
      e.preventDefault();
      const raw = packVal('[data-tr=pack-name]');
      if (!raw) { flash('escribe un nombre para el pack'); return; }
      const name = recruitPackCreate(raw);
      if (!name) { flash('nombre no válido'); return; }
      const nameEl = sec.querySelector('[data-tr=pack-name]');
      if (nameEl) nameEl.value = '';
      renderTrain();
      const sel = sec.querySelector('[data-tr=pack]');
      if (sel) { sel.value = name; renderTrain(); }
      flash(`pack "${name}" creado`);
    });
    on('[data-tr=pack-from-town]', 'click', e => {
      e.preventDefault();
      const raw = packVal('[data-tr=pack-name]') || trainSelectedPack(sec);
      if (!raw) { flash('escribe un nombre para el pack'); return; }
      const townId = sec.querySelector('[data-cfg=batch-recruit-town]')?.value || '';
      if (!townId) { flash('elige una ciudad en el lote'); return; }
      if (!recruitPackFromTown(raw, townId)) { flash('el lote de esa ciudad está vacío'); return; }
      const nameEl = sec.querySelector('[data-tr=pack-name]');
      if (nameEl) nameEl.value = '';
      renderTrain();
      const sel = sec.querySelector('[data-tr=pack]');
      if (sel) { sel.value = String(raw).trim().slice(0, RECRUIT_PACK_NAME_MAX); renderTrain(); }
      flash(`pack "${raw}" guardado desde el lote`);
    });
    on('[data-tr=pack-del]', 'click', e => {
      e.preventDefault();
      const name = trainSelectedPack(sec);
      if (!name) return;
      if (!confirm(`¿Borrar el pack "${name}"? Los lotes ya aplicados a las ciudades no se tocan.`)) return;
      recruitPackDelete(name);
      renderTrain();
      flash(`pack "${name}" borrado`);
    });
    on('[data-tr=pack-add]', 'click', e => {
      e.preventDefault();
      const name = trainSelectedPack(sec);
      if (!name) { flash('crea un pack primero'); return; }
      const unit = packVal('[data-tr=pack-unit]');
      const amount = Math.max(1, Math.floor(+packVal('[data-tr=pack-amount]') || 0));
      if (!unit) { flash('elige una unidad'); return; }
      if (!recruitPackAddRow(name, unit, amount)) { flash('unidad desconocida'); return; }
      renderTrain();
    });
    on('[data-tr=pack-apply]', 'click', e => {
      e.preventDefault();
      const name = trainSelectedPack(sec);
      if (!name) { flash('no hay pack seleccionado'); return; }
      if (!recruitPackRows(name).length) { flash('el pack está vacío'); return; }
      const mode = packVal('[data-tr=pack-mode]') === 'append' ? 'append' : 'replace';
      const target = sec.querySelector('[data-tr=pack-town]')?.value || '';
      if (target === '__all__') {
        const towns = recruitPackApplyAll(name, mode);
        if (!towns) { flash('no hay ciudades legibles'); return; }
        gbLog(`recruit pack: "${name}" -> ${towns} town(s) (${mode})`);
        flash(`pack "${name}" aplicado a ${towns} ciudad(es)`);
      } else {
        const n = recruitPackApply(name, target, mode);
        if (n < 0) { flash('elige una ciudad'); return; }
        gbLog(`recruit pack: "${name}" -> town ${target} (${mode}, ${n} row(s))`);
        flash(`pack "${name}" aplicado (${n} línea(s))`);
      }
      renderTrain();
      if (!state.batchRecruit) flash('activa "Lote recurrente" para que se entrene solo');
    });
    on('[data-cfg=batch-recruit-town]', 'change', () => { try { batchRecruitUiPaint(); } catch (_) {} });
    on('[data-cfg=batch-recruit-add]', 'click', e => { e.preventDefault(); try { batchRecruitUiAdd(); } catch (err) { gbLog(`batch-recruit add err: ${err}`); } });
    on('[data-cfg=batch-recruit-arm]', 'click', e => { e.preventDefault(); try { batchRecruitUiArm(); } catch (err) { gbLog(`batch-recruit arm err: ${err}`); } });
    on('[data-cfg=batch-recruit-clear]', 'click', e => { e.preventDefault(); try { batchRecruitUiClear(); } catch (err) { gbLog(`batch-recruit clear err: ${err}`); } });
  }
  function batchRecruitScan(reason) {
    if (!hostEnabled() || !state.batchRecruit) return;
    if (automationPaused({})) return;
    if (captchaPaused('recruit')) return;
    if (gbLocked('recruit')) return;
    let anyTown = false;
    try {
      const tlists = batchRecruitNormLists().towns || {};
      for (const townId of Object.keys(tlists)) {
        if (batchRecruitTownList(townId).length) { anyTown = true; break; }
      }
    } catch (e) { gbLogT('batch-recruit-probe-err', 60000, 'batch recruit probe failed: ' + String(e).slice(0, 120)); }
    if (!anyTown) {
      gbLogT('batch-recruit-empty', 180000, `batch recruit: idle (${scanReason(reason)})`);
      return;
    }
    let count = 0;
    try {
      const tlists = batchRecruitNormLists().towns || {};
      for (const townId of Object.keys(tlists)) {
        if (!batchRecruitTownList(townId).length) continue;
        const verdict = batchRecruitAtomicAfford(townId);
        if (!verdict.ok) {
          if (verdict.why === 'resources/pop/favor') {

            gbLogT(`batch-recruit-wait-${townId}`, 60000, `batch recruit: ${townId} waiting (row ${verdict.rowIdx + 1} ${verdict.unit})`);
          }
          continue;
        }
        batchRecruitFire(townId);
        count++;
      }
    } catch (e) { gbLogT('batch-recruit-fire-err', 60000, 'batch recruit fire loop threw: ' + String(e).slice(0, 120)); }
    if (!count) gbLogT('batch-recruit-idle', 180000, `batch recruit: idle (${scanReason(reason)})`);
  }
