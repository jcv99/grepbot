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
  function recruitUnitDef(unitId) {
    try {
      const uw = gameUw();
      return (uw.GameData && uw.GameData.units && uw.GameData.units[unitId]) || null;
    } catch (_) { return null; }
  }
  function recruitControllerFor(unitId) {
    const def = recruitUnitDef(unitId);
    if (!def) return null;
    if (def.is_naval || def.naval) return { controller: 'building_docks', feature: 'recruit' };
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
  function recruitCastSpell(townId, powerId, onDone) {
    if (!powerId || !RECRUIT_SPELLS.includes(powerId)) return onDone && onDone('bad-power');
    const pre = recruitSpellGateOk(townId, powerId);
    if (!pre.ok) { gbLogT('spell-precond-' + townId, 300000, `spell: blocked precheck (${pre.why})`); return onDone && onDone('skip:' + pre.why); }
    if (pre.blind) gbLogT('spell-precond-blind-' + townId, 300000, 'spell: god unreadable; blind precheck, server is the authority');
    const left = recruitSpellCooldown(townId, powerId);
    if (left > 0) { gbLogT('spell-cooldown-' + townId, 60000, `spell: cooldown ${Math.ceil(left/1000)}s left`); return onDone && onDone('skip:cooldown'); }
    gameAjaxPost('spell', 'town_overviews', 'cast_power', {
      power_id: powerId,
      town_id: +townId,
    }, onDone);
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
  function recruitCanBuild(townId, unitId) {
    const def = recruitUnitDef(unitId);
    if (!def) return false;
    try {
      const t = gbTownModel(townId);
      if (!t) return false;
      const rdeps = recruitResearchDeps(def);
      if (rdeps.length) {
        const info = typeof researchTownTechs === 'function' ? researchTownTechs(townId) : null;
        if (!info || !info.techs) return false;
        for (const tech of rdeps) if (!info.techs[tech]) return false;
      }
      let buildings = null;
      try { const b = t.getBuildings ? t.getBuildings() : (t.buildings && t.buildings()); buildings = b && (b.attributes || b); } catch (_) {}
      if (!buildings) return false;
      const bdeps = recruitRequiredBuildings(def);
      for (const [bid, lvl] of Object.entries(bdeps)) if (+(buildings[bid] || 0) < +lvl) return false;
      if (def.is_naval || def.naval) {
        const docksNeed = +(def.docks_level ?? def.harbor_level ?? def.required_docks_level ?? 1);
        if (+(buildings.docks || 0) < (Number.isFinite(docksNeed) ? docksNeed : 1)) return false;
      } else {
        const barracksNeed = +(def.barracks_level ?? def.required_barracks_level ?? 1);
        if (+(buildings.barracks || 0) < (Number.isFinite(barracksNeed) ? barracksNeed : 1)) return false;
      }
      if (def.god || def.mythical || def.is_mythical) {
        const requiredGod = def.god ? String(def.god).toLowerCase() : null;
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
          const haveFavor = +(fav[requiredGod] ?? fav['favor_' + requiredGod]);
          if (!Number.isFinite(haveFavor) || haveFavor < favorCost) return false;
        }
      }
      return true;
    } catch (_) { return false; }
  }
  function recruitQueueInfo(townId,unitId) {
    const t = gbTownModel(townId);
    if (!t) return { known: false, len: 0, max: null, models: [] };
    let col = null, models = [];
    try { col = t.getUnitOrdersCollection && t.getUnitOrdersCollection();if(!col||!Array.isArray(col.models))return {known:false,len:0,max:null,models:[]};models=col.models.slice(); } catch (_) {return {known:false,len:0,max:null,models:[]}}
    if(unitId){const want=recruitUnitDef(unitId),wantNaval=!!(want&&(want.is_naval||want.naval));models=models.filter(m=>{const a=m.attributes||m,id=a.unit_type||a.unit_id||a.type,d=recruitUnitDef(id);return !d||!!(d.is_naval||d.naval)===wantNaval})}
    let max = null;
    try { if (col && typeof col.getMaxQueueLength === 'function') max = +col.getMaxQueueLength(); } catch (_) {}
    try { if (!(max > 0) && col && col.max_queue_length != null) max = +col.max_queue_length; } catch (_) {}
    try {
      const uw = gameUw();
      const q = uw.GameDataUnitQueue || uw.GameDataUnits;
      if (!(max > 0) && q && typeof q.getQueueMax === 'function') max = +q.getQueueMax(townId);
    } catch (_) {}
    return { known: true, len: models.length, max: max > 0 ? max : null, models };
  }
  function recruitQueuedAmount(townId, unit) {
    const q = recruitQueueInfo(townId);
    let queued = 0;
    for (const m of q.models || []) {
      const a = m.attributes || {};
      const uid = a.unit_type || a.unit_id || a.type;
      if (String(uid) === String(unit)) queued += +(a.count != null ? a.count : (a.amount != null ? a.amount : a.units)) || 0;
    }
    return queued;
  }
  function recruitQueueHasSpace(townId,unitId) {
    const q = recruitQueueInfo(townId,unitId);
    if (!q.known) return false;
    if (q.max != null) return q.len < q.max;
    // If max cannot be read, fail conservatively: only start when queue is empty.
    return q.len === 0;
  }
  function recruitAffordableAmount(townId, unit, want) {
    const def = recruitUnitDef(unit), t = gbTownModel(townId);
    if (!def || !t || !def.resources) return 0;
    try {
      const r = t.resources && t.resources();
      const pop = t.getAvailablePopulation && +t.getAvailablePopulation();
      if (!r || pop == null) return 0;
      const rw = +def.resources.wood || 0, rs = +def.resources.stone || 0, ri = +def.resources.iron || 0, rp = +def.population || 0;
      let amount = Math.max(0, +want || 0);
      if (rw > 0) amount = Math.min(amount, Math.floor(+r.wood / rw));
      if (rs > 0) amount = Math.min(amount, Math.floor(+r.stone / rs));
      if (ri > 0) amount = Math.min(amount, Math.floor(+r.iron / ri));
      if (rp > 0) amount = Math.min(amount, Math.floor(pop / rp));
      const favorCost = +(def.favor ?? def.resources.favor ?? 0);
      if (favorCost > 0) {
        const god = def.god && String(def.god).toLowerCase();
        const fav = favorCurrent();
        const have = god ? +(fav[god] ?? fav['favor_' + god]) : NaN;
        if (!Number.isFinite(have)) return 0;
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
        if (!recruitQueueHasSpace(tid,explicit.unit)) { nativeQueueSetJobState(explicit, 'waiting-slot', 'cola real llena'); continue; }
        if (!recruitCanBuild(tid, explicit.unit) || !recruitControllerFor(explicit.unit)) {
          nativeQueueSetJobState(explicit, 'blocked', 'requisitos/controlador'); continue;
        }
        const affordable = recruitAffordableAmount(tid, explicit.unit, explicit.amount);
        if (affordable < +explicit.amount) { nativeQueueSetJobState(explicit, 'waiting-resources', 'recursos/población/favor'); continue; }
        nativeQueueSetJobState(explicit, 'ready', 'listo');
        job = { kind:'build', townId:tid, unit:explicit.unit, amount:+explicit.amount, nativeJobId:explicit.id, nativeLane:lane };
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
      gbLogT('recruit-idle', 180000, `recruit: idle (${reason || 'scan'})`);
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
      head.inflight = { amount:job.amount, at:Date.now() };
      nativeQueueSave();
    }
    recruitBuild(job.townId, job.unit, job.amount, (err) => {
      gbUnlock('recruit', lockToken);
      if (!err) {
        gbLog(`recruit: town ${job.townId} ${job.amount}× ${job.unit}`);
        if (job.nativeJobId) nativeQueueRecruitApplied(job.townId, job.nativeLane, job.nativeJobId, job.amount);
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
  const VILLAGE_RECRUIT_STREAK_TRIP = 2; // consecutive saturated scrapes to trigger

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
    bridgePost('villageRecruit', {
      model_url: modelUrl,
      action_name: actionName,
      arguments: args,
      town_id: +farm.owning_town_id || 0,
    }, onDone);
  }

  function villageRecruitScan(reason) {
    if (!hostEnabled() || !state.autoVillageRecruit) return;
    if (automationPaused({})) return;
    if (captchaPaused('villageRecruit')) return;
    if (gbLocked('village-recruit')) return;

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
      farm.owning_town_id = owning; // cache for the post payload

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
