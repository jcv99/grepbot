  // Never default a divine power id. Recruit auto-cast needs an operator-typed
  // id in favorCfg.recruitSpellPower (same allowlist as god spells).
  function recruitControllerFor(unitId) {
    const def = gbGameDataLookup("units", unitId);
    if (!def) return null;
    // Mythical land units still train through the barracks; naval units through docks.
    if (recruitIsNaval(unitId)) return { controller: 'building_docks', feature: 'recruit' };
    return { controller: 'building_barracks', feature: 'recruit' };
  }
  function recruitSpellActiveState(townId, powerId) {
    try {
      const uw = gameUw();
      const col = uw.MM && uw.MM.getFirstTownAgnosticCollectionByName &&
        uw.MM.getFirstTownAgnosticCollectionByName('CastedPowers');
      if (!col) return { known:false, active:false, source:'collection-unreadable' };
      const tid = String(townId);
      const candidates = [];
      let townSurfaceKnown = false;
      const fragments = col.fragments || null;
      const frag = fragments && (fragments[townId] || fragments[tid]);
      // CastedPowers is a town-agnostic collection: an existing fragments map
      // with no fragment for this town means there is no active power here.
      if (fragments && typeof fragments === 'object') townSurfaceKnown = true;
      if (frag && Array.isArray(frag.models)) candidates.push(...frag.models);
      if (Array.isArray(col.models)) {
        for (const m of col.models) {
          const a = (m && m.attributes) || {};
          const mt = a.town_id ?? a.target_id ?? a.target_town_id ?? a.townId;
          if (mt != null && String(mt) === tid) {
            townSurfaceKnown = true;
            candidates.push(m);
          }
        }
      }
      if (!townSurfaceKnown) return { known:false, active:false, source:'town-powers-unreadable' };
      const active = candidates.some(m => String(((m && m.attributes) || {}).power_id || '') === String(powerId || ''));
      return { known:true, active, source:'CastedPowers' };
    } catch (_) { return { known:false, active:false, source:'exception' }; }
  }
  function recruitHasSpell(townId, powerId) {
    const st = recruitSpellActiveState(townId, powerId);
    return st.known && st.active;
  }
  function recruitSpellCooldown(townId, powerId) {
    const map = state.spellCooldown || {};
    const t = map[String(townId)];
    if (!t || !Object.prototype.hasOwnProperty.call(t, powerId)) return 0;
    const until = gbNum(t[powerId]);
    if (until == null) return Infinity;
    return until > Date.now() ? until - Date.now() : 0;
  }
  function recruitSpellCooldownStamp(townId, powerId, ms) {
    if (!state.spellCooldown) state.spellCooldown = {};
    const t = state.spellCooldown[String(townId)] || (state.spellCooldown[String(townId)] = {});
    t[powerId] = Date.now() + (ms || 30 * 60 * 1000);
    try { save(STORE.SPELL_COOLDOWN, state.spellCooldown); } catch (_) {}
  }
  function recruitSpellGateOk(townId, powerId) {
    if (!powerId || !RECRUIT_SPELLS.includes(powerId)) return { ok:false, blind:false, why:'bad-power' };
    const god = recruitScanGodCache ? recruitScanGod(townId) : recruitTownGod(townId);
    if (god == null) return { ok:false, blind:true, why:'god-unreadable' };
    const need = RECRUIT_SPELL_GODS[powerId];
    if (need && god !== need) return { ok:false, blind:false, why:`god-mismatch:${god}!=${need}` };
    return { ok:true, blind:false, why:null };
  }
  function recruitAutoSpellForUnit(_unitId) {
    const raw = (state.favorCfg && state.favorCfg.recruitSpellPower) || '';
    const power = String(raw || '').trim();
    if (!power) return null;
    if (!RECRUIT_SPELLS.includes(power)) {
      gbLogT('recruit-spell-badpower', 600000, `recruit: recruitSpellPower "${power.slice(0, 24)}" not allowlisted — no auto-cast`);
      return null;
    }
    return power;
  }
  // active => recruit now; absent+castable => cast first; unavailable => recruit now.
  function recruitAutoSpellDecision(townId, unitId) {
    const power = recruitAutoSpellForUnit(unitId);
    if (!power || !state.recruitSpells || state.safeMode) return { action:'proceed', power, why:'disabled' };
    const active = recruitSpellActiveState(townId, power);
    if (active.known && active.active) return { action:'proceed', power, why:'already-active' };
    // Avoid duplicate favor spend when active powers cannot be read reliably.
    if (!active.known) return { action:'proceed', power, why:'active-unreadable' };
    if (captchaPausedAny('recruit', 'spell')) return { action:'proceed', power, why:'spell-paused' };
    const gate = recruitSpellGateOk(townId, power);
    if (!gate.ok) return { action:'proceed', power, why:gate.why || 'spell-unavailable' };
    const left = recruitSpellCooldown(townId, power);
    if (left > 0) return { action:'proceed', power, why:'spell-cooldown', left };
    const god = RECRUIT_SPELL_GODS[power];
    const favor = recruitFavorRead(townId, god);
    const cost = gbNum(RECRUIT_SPELL_COSTS[power]);
    if (cost == null) return { action:'proceed', power, why:'spell-cost-unreadable' };
    if (favor.value == null) return { action:'proceed', power, why:'favor-unreadable', cost };
    if (favor.value < cost) return { action:'proceed', power, why:'insufficient-favor', favor:favor.value, cost };
    return { action:'cast', power, god, favor:favor.value, cost };
  }
  function spellCastPost(townId, powerId, onDone) {
    const tid = gbNum(townId);
    if (tid == null) {
      gbLogT('spell-town-id', 60000, 'spell: townId unreadable — no post');
      return onDone && onDone('town-unreadable');
    }
    return bridgePost('spell', {
      model_url: 'CastedPowers',
      action_name: 'cast',
      arguments: { power_id: powerId, target_id: tid },
      town_id: tid,
    }, onDone);
  }
  function recruitCastSpell(townId, powerId, onDone) {
    if (!powerId || !RECRUIT_SPELLS.includes(powerId)) return onDone && onDone('bad-power');
    const pre = recruitSpellGateOk(townId, powerId);
    if (!pre.ok) { gbLogT('spell-precond-' + townId, 300000, `spell: blocked precheck (${pre.why})`); return onDone && onDone('skip:' + pre.why); }
    if (pre.blind) gbLogT('spell-precond-blind-' + townId, 300000, 'spell: god unreadable; blind precheck, server is the authority');
    const left = recruitSpellCooldown(townId, powerId);
    if (left > 0) { gbLogT('spell-cooldown-' + townId, 60000, `spell: cooldown ${Math.ceil(left/1000)}s left`); return onDone && onDone('skip:cooldown'); }
    const spellCost = gbNum(RECRUIT_SPELL_COSTS[powerId]);
    if (spellCost == null) { gbLogT('spell-cost-blind-' + townId, 300000, `spell: ${powerId} favor cost unreadable — cast blocked`); return onDone && onDone('skip:spell-cost-unreadable'); }
    const spellGod = RECRUIT_SPELL_GODS[powerId];
    if (spellGod) {
      const fr = recruitFavorRead(townId, spellGod);
      if (fr.value != null && fr.value < spellCost) return onDone && onDone('skip:insufficient-favor');
    }
    spellCastPost(townId, powerId, onDone);
  }
  function recruitBuild(townId, unitId, amount, onDone) {
    const ctrl = recruitControllerFor(unitId);
    if (!ctrl) return onDone && onDone('unknown-unit');
    const tid = gbNum(townId);
    const amt = gbNum(amount);
    if (tid == null) {
      gbLogT('recruit-town-id', 60000, 'recruit: townId unreadable — no post');
      return onDone && onDone('town-unreadable');
    }
    if (amt == null || !(amt > 0)) {
      gbLogT('recruit-amount', 60000, 'recruit: amount unreadable — no post');
      return onDone && onDone('amount-unreadable');
    }
    gameAjaxPost('recruit', ctrl.controller, 'build', {
      unit_id: unitId,
      amount: amt,
      town_id: tid,
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
  function recruitFinite(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = +v;
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }
  function recruitNumericFrom(v) {
    const direct = recruitFinite(v);
    if (direct != null) return direct;
    if (!v || typeof v !== 'object') return null;
    const a = v.attributes || v;
    for (const k of ['favor','current','amount','value','points','available','free']) {
      const n = recruitFinite(a[k]);
      if (n != null) return n;
    }
    return null;
  }
  function recruitLiveResources(townId) {
    const t = gbTownModel(townId);
    const out = { wood:null, stone:null, iron:null, source:'unreadable' };
    if (!t) return out;
    const bags = [];
    try {
      const r = typeof t.resources === 'function' ? t.resources() : t.resources;
      if (r) bags.push(['town.resources', r.attributes || r]);
    } catch (_) {}
    try {
      const r = typeof t.getResources === 'function' ? t.getResources() : null;
      if (r) bags.push(['town.getResources', r.attributes || r]);
    } catch (_) {}
    try { if (t.attributes) bags.push(['town.attributes', t.attributes]); } catch (_) {}
    for (const [source, bag] of bags) {
      let hit = false;
      for (const k of ['wood','stone','iron']) {
        if (out[k] != null) continue;
        const n = recruitFinite(bag && bag[k]);
        if (n != null) { out[k] = n; hit = true; }
      }
      if (hit && out.source === 'unreadable') out.source = source;
      if (out.wood != null && out.stone != null && out.iron != null) break;
    }
    return out;
  }
  function recruitLivePopulation(townId) {
    const t = gbTownModel(townId);
    if (!t) return { value:null, source:'town-unreadable' };
    for (const name of ['getAvailablePopulation','getFreePopulation']) {
      try {
        if (typeof t[name] === 'function') {
          const n = recruitFinite(t[name]());
          if (n != null) return { value:n, source:'town.' + name };
        }
      } catch (_) {}
    }
    try {
      const r = typeof t.resources === 'function' ? t.resources() : t.resources;
      const a = r && (r.attributes || r);
      for (const k of ['population','available_population','population_available','free_population','population_free']) {
        const n = recruitFinite(a && a[k]);
        if (n != null) return { value:n, source:'town.resources.' + k };
      }
    } catch (_) {}
    try {
      const a = t.attributes || {};
      for (const k of ['available_population','population_available','free_population','population_free']) {
        const n = recruitFinite(a[k]);
        if (n != null) return { value:n, source:'town.attributes.' + k };
      }
    } catch (_) {}
    try {
      const n = gbTownPop(townId);
      if (n != null && Number.isFinite(+n)) return { value:+n, source:'gbTownPop' };
    } catch (_) {}
    return { value:null, source:'population-unreadable' };
  }
  function recruitFavorRead(townId, god) {
    const g = String(god || '').toLowerCase();
    if (!g) return { value:null, source:'god-unreadable' };
    const townGod = recruitScanGodCache ? recruitScanGod(townId) : recruitTownGod(townId);
    const readBag = (bag, source) => {
      if (!bag || typeof bag !== 'object') return null;
      const a = bag.attributes || bag;
      const keys = [g, 'favor_' + g, g + '_favor', 'current_' + g, 'current_favor_' + g];
      for (const k of keys) {
        const n = recruitNumericFrom(a[k]);
        if (n != null) return { value:n, source:source + '.' + k };
      }
      for (const ck of ['favor','favors','gods','god_favor','god_favors']) {
        const c = a[ck];
        if (!c || typeof c !== 'object') continue;
        const n = recruitNumericFrom(c[g] ?? c['favor_' + g]);
        if (n != null) return { value:n, source:source + '.' + ck + '.' + g };
      }
      if (townGod && townGod === g) {
        for (const k of ['favor','current_favor','currentFavor']) {
          const n = recruitFinite(a[k]);
          if (n != null) return { value:n, source:source + '.' + k };
        }
      }
      return null;
    };
    try {
      const hit = readBag(favorCurrent(), 'favorCurrent');
      if (hit) return hit;
    } catch (_) {}
    try {
      const uw = gameUw();
      const pg = uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('PlayerGods');
      const hit = readBag(pg, 'PlayerGods');
      if (hit) return hit;
      if (pg && typeof pg.get === 'function') {
        for (const k of [g, 'favor_' + g, g + '_favor']) {
          const n = recruitNumericFrom(pg.get(k));
          if (n != null) return { value:n, source:'PlayerGods.get.' + k };
        }
      }
    } catch (_) {}
    try {
      const uw = gameUw();
      const hit = readBag(uw.Game && uw.Game.gods, 'Game.gods');
      if (hit) return hit;
    } catch (_) {}
    return { value:null, source:'favor-unreadable' };
  }
  function recruitRuntimeEffectiveCost(townId, unitId, def) {
    const t = gbTownModel(townId);
    const normalize = (raw, source) => {
      if (!raw || typeof raw !== 'object') return null;
      const a = raw.attributes || raw.effective || raw.cost || raw;
      if (!a || typeof a !== 'object') return null;
      const out = { wood:null, stone:null, iron:null, favor:null, population:null, fieldKnown:{}, authoritative:true, effective:true, base:null, modifier:null, source };
      let any = false;
      for (const k of ['wood','stone','iron','favor','population']) {
        let present = false, value = null;
        for (const key of [k, k + '_cost', 'effective_' + k]) {
          if (!Object.prototype.hasOwnProperty.call(a, key)) continue;
          present = true;
          const n = gbNum(a[key]);
          if (n != null && n >= 0) value = n;
          break;
        }
        out.fieldKnown[k] = present && value != null;
        out[k] = out.fieldKnown[k] ? value : null;
        if (out.fieldKnown[k]) any = true;
      }
      // A direct effective-cost surface is useful even when it omits a field;
      // omitted fields remain UNKNOWN and are never coerced to zero.
      return any ? out : null;
    };
    try {
      for (const name of ['getEffectiveRecruitmentCost','getRecruitmentCost','getRecruitCost','getUnitCost']) {
        if (t && typeof t[name] === 'function') {
          const hit = normalize(t[name](unitId), name + '()');
          if (hit) return hit;
        }
      }
    } catch (_) {}
    try {
      const bag = t && (t.recruitment || t.recruit || t.attributes && (t.attributes.recruitment || t.attributes.recruit));
      const hit = normalize(bag && (bag[unitId] || bag), 'town.runtime.recruitment');
      if (hit) return hit;
    } catch (_) {}
    return null;
  }
  function recruitRuntimeMaxAmount(townId, unitId) {
    const t = gbTownModel(townId);
    for (const name of ['getMaxRecruitableUnits','getMaxRecruitable','getMaxUnitAmount','getMaxBuildableUnits']) {
      try {
        if (!t || typeof t[name] !== 'function') continue;
        const raw = t[name](unitId);
        const n = gbNum(raw && typeof raw === 'object' ? (raw.amount ?? raw.max ?? raw.value) : raw);
        if (n != null && n >= 0) return { known:true, amount:Math.floor(n), source:name + '()' };
      } catch (_) {}
    }
    return { known:false, amount:null, source:'max-recruitable-unreadable' };
  }
  function recruitEffectiveUnitCost(townId, unitId) {
    const def = gbGameDataLookup('units', unitId);
    if (!def || !def.resources) return null;
    const rr = def.resources || {};
    const factor = (typeof recruitResourceFactor === 'function')
      ? recruitResourceFactor(townId, Object.assign({ id: unitId }, def)) : 1;
    const scale = (v) => (v == null ? null : v * factor);
    const base = {
      wood: scale(gbNum(rr.wood)),
      stone: scale(gbNum(rr.stone)),
      iron: scale(gbNum(rr.iron)),
      population: gbNum(def.population),
      favor: gbNum(def.favor ?? rr.favor),
    };
    const runtime = recruitRuntimeEffectiveCost(townId, unitId, def);
    if (runtime) {
      runtime.base = base;
      runtime.modifier = factor;
      return runtime;
    }
    // GameData is retained as base/reference metadata only. It is not labelled
    // or enforced as the current effective cost when Grepolis runtime does not
    // expose that value.
    return {
      wood:base.wood, stone:base.stone, iron:base.iron, population:base.population, favor:base.favor,
      fieldKnown:{ wood:false, stone:false, iron:false, population:false, favor:false },
      authoritative:false, effective:false, base, modifier:factor, source:'gamedata-base-advisory',
    };
  }
  function recruitCostFieldKnown(cost, key) {
    const v = cost ? gbNum(cost[key]) : null;
    return !!(cost && cost.authoritative === true && cost.fieldKnown && cost.fieldKnown[key] === true && v != null && v >= 0);
  }
  function recruitDisplayCost(cost, key) {
    if (!cost) return null;
    const v = gbNum(cost[key]);
    if (v != null) return v;
    const b = cost.base ? gbNum(cost.base[key]) : null;
    return b;
  }
  // Mythical favor cost for local gates. Prefer runtime authoritative favor;
  // otherwise enforce GameData base. Wood/stone/iron stay advisory-only because
  // modifiers make GameData lie; favor is stable enough that "blind → post →
  // server ribbon" every cadence is worse than a slightly conservative block.
  // Favor *pool* still unreadable → do not block (server judges).
  function recruitFavorUnitCost(ec, def) {
    if (recruitCostFieldKnown(ec, 'favor')) {
      return { cost: +ec.favor, source: 'authoritative' };
    }
    const advisory = recruitDisplayCost(ec, 'favor')
      ?? gbNum(def && (def.favor ?? (def.resources && def.resources.favor)));
    if (advisory != null && advisory >= 0) return { cost: advisory, source: 'advisory' };
    return { cost: null, source: 'unreadable' };
  }
  try { GB_ROOT.__grepbotRecruitEffectiveCost = recruitEffectiveUnitCost; } catch (_) {}
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
          const k = townId + '|' + unitId + '|tech';
          if (!_recruitBlindLog.has(k)) { _recruitBlindLog.add(k); gbLogT('recruit-blind-' + townId + '-' + unitId, 300000, 'recruit: ' + unitId + ' techs unreadable in town ' + townId + ' - blind precheck, server judges'); }
          return true;
        }
        for (const tech of rdeps) if (!info.techs[tech]) return false;
      }
      let buildings = null;
      try { const b = t.getBuildings ? t.getBuildings() : (t.buildings && t.buildings()); buildings = b && (b.attributes || b); } catch (_) {}
      if (!buildings) {
        const k = townId + '|' + unitId + '|bld';
        if (!_recruitBlindLog.has(k)) { _recruitBlindLog.add(k); gbLogT('recruit-blind-' + townId + '-' + unitId, 300000, 'recruit: ' + unitId + ' buildings unreadable in town ' + townId + ' - blind precheck, server judges'); }
        return true;
      }
      const bdeps = recruitRequiredBuildings(def);
      for (const [bid, lvl] of Object.entries(bdeps)) {
        const need = gbNum(lvl);
        const have = gbNum(buildings[bid]);
        if (need == null || have == null || have < need) return false;
      }
      const isMythical = !!(def.god || def.mythical || def.is_mythical || mythicalUnitGod(unitId));
      if (recruitIsNaval(unitId)) {
        const docksNeed = gbNum(def.docks_level ?? def.harbor_level ?? def.required_docks_level) ?? 1;
        const docksHave = gbNum(buildings.docks);
        if (docksHave == null || docksHave < docksNeed) return false;
      } else {
        const barracksNeed = gbNum(def.barracks_level ?? def.required_barracks_level) ?? 1;
        const barracksHave = gbNum(buildings.barracks);
        if (barracksHave == null || barracksHave < barracksNeed) return false;
      }
      if (isMythical) {
        const requiredGod = (def.god ? String(def.god).toLowerCase() : null) || mythicalUnitGod(unitId);
        const townGod2 = recruitScanGodCache ? recruitScanGod(townId) : recruitTownGod(townId);
        if (requiredGod && townGod2 && townGod2 !== requiredGod) return false;
        if (requiredGod && !townGod2) {
          gbLogT('recruit-god-blind-' + townId, 300000, `recruit: town ${townId} god unreadable; ${unitId} left to the server to judge`);
        }
        const templeNeed = gbNum(def.temple_level ?? def.required_temple_level) ?? 1;
        const templeHave = gbNum(buildings.temple);
        if (templeHave == null || templeHave < templeNeed) return false;
        const ec = recruitEffectiveUnitCost(townId, unitId);
        const fc = recruitFavorUnitCost(ec, def);
        if (fc.cost != null && fc.cost > 0) {
          if (!requiredGod) return false;
          const fr = recruitFavorRead(townId, requiredGod);
          if (fr.value != null && fr.value < fc.cost) return false;
          if (fr.value == null) {
            gbLogT('recruit-favor-blind-' + townId + '-' + requiredGod, 120000,
              `recruit: ${requiredGod} favor balance unreadable for ${unitId}; server judges`);
          } else if (fc.source === 'advisory') {
            gbLogT('recruit-favor-cost-advisory-' + townId + '-' + unitId, 300000,
              `recruit: ${unitId} favor cost ${fc.cost} from GameData advisory (runtime effective unreadable)`);
          }
        }
      }
      return true;
    } catch (_) { return false; }
  }
  function recruitQueueClass(def, unitId) {
    if (!def) return 'unknown';
    // The real queue split is docks vs barracks. Mythical land units share the
    // barracks queue with other land units; temple remains only a prerequisite.
    // recruitIsNaval covers NAVAL_MYTHICAL_UNITS whose GameData lacks is_naval.
    if (recruitIsNaval(unitId || def.id)) return 'naval';
    return 'land';
  }
  function recruitQueueDomCapacity(townId, unitId) {
    try {
      const uw = gameUw();
      if (!uw.Game || String(uw.Game.townId) !== String(townId)) return null;
      const wantClass = recruitQueueClass(gbGameDataLookup('units', unitId), unitId);
      const windows = Array.from(document.querySelectorAll('.gpwindow, .ui-dialog, [class*="gpwindow"]'));
      const classRx = wantClass === 'naval'
        ? /(puerto|port|harbor|docks|hafen|porto)/i
        : /(cuartel|barracks|kaserne|caserne|caserma|quartel)/i;
      const countRx = /(?:entrenamiento|training|ausbildung|entrainement|entraînement|addestramento|treinamento)?\s*\(\s*(\d+)\s*\/\s*(\d+)\s*\)/i;
      for (const el of windows) {
        const text = String(el && el.textContent || '');
        if (!classRx.test(text)) continue;
        const m = countRx.exec(text);
        if (!m) continue;
        const len = +m[1], max = +m[2];
        if (Number.isFinite(len) && Number.isFinite(max) && max > 0 && len >= 0 && len <= max && max <= 50) {
          return { len, max, source:'dom-training-counter' };
        }
      }
    } catch (_) {}
    return null;
  }
  function recruitQueueMaxProbe(col, townId, unitId) {
    const methodNames = ['getMaxQueueLength','getMaxQueueSize','getQueueMax','getMaxOrders','getMaxOrderCount','getQueueLimit'];
    for (const name of methodNames) {
      try {
        if (col && typeof col[name] === 'function') {
          for (const args of [[], [townId], [townId, unitId]]) {
            const n = recruitFinite(col[name].apply(col, args));
            if (n != null && n > 0 && n <= 50) return { max:n, source:'collection.' + name };
          }
        }
      } catch (_) {}
    }
    const attrNames = ['max_queue_length','maxQueueLength','max_queue_size','maxQueueSize','queue_max','queueMax','max_orders','maxOrders','queue_limit','queueLimit'];
    for (const name of attrNames) {
      try {
        let raw = null;
        if (col && typeof col.get === 'function') raw = col.get(name);
        if (raw == null && col) raw = col[name];
        if (raw == null && col && col.attributes) raw = col.attributes[name];
        const n = recruitFinite(raw);
        if (n != null && n > 0 && n <= 50) return { max:n, source:'collection.' + name };
      } catch (_) {}
    }
    try {
      const uw = gameUw();
      const objs = [
        // Captured client: GameDataConstructionQueue.getUnitOrdersQueueLength()
        // is the live unit-queue API (7 per lane; full = 2x across barracks+docks).
        ['GameDataConstructionQueue', uw.GameDataConstructionQueue],
        ['GameDataUnitQueue', uw.GameDataUnitQueue],
        ['GameDataUnits', uw.GameDataUnits],
        ['GameData.unit_queue', uw.GameData && uw.GameData.unit_queue],
        ['GameData.unit_orders', uw.GameData && uw.GameData.unit_orders],
      ];
      for (const [label, obj] of objs) {
        if (!obj) continue;
        for (const name of ['getUnitOrdersQueueLength','getQueueMax','getMaxQueueLength','getMaxQueueSize','getMaxOrders','getQueueLimit']) {
          if (typeof obj[name] !== 'function') continue;
          for (const args of [[townId], [townId, unitId], []]) {
            try {
              const n = recruitFinite(obj[name].apply(obj, args));
              if (n != null && n > 0 && n <= 50) return { max:n, source:label + '.' + name };
            } catch (_) {}
          }
        }
      }
    } catch (_) {}
    const dom = recruitQueueDomCapacity(townId, unitId);
    if (dom) return { max:dom.max, source:dom.source, domLen:dom.len };
    const learned = recruitQueueCapLearned(townId, recruitQueueClass(gbGameDataLookup('units', unitId), unitId));
    if (learned != null) return { max:learned, source:'learned-reject' };
    return { max:null, source:'capacity-unreadable' };
  }
  // Queue capacity learned from an authoritative "queue full" server reject:
  // the lane held len orders when the server refused one more, so cap <= len.
  // Stamped only from the exact-match waiting-queue-full mapping, never guessed.
  function recruitQueueCapLearned(townId, queueClass) {
    const t = state.recruitQueueCap && state.recruitQueueCap[String(townId)];
    const n = t && +t[queueClass];
    return Number.isFinite(n) && n > 0 && n <= 50 ? n : null;
  }
  function recruitQueueCapStamp(townId, queueClass, len) {
    const n = Math.floor(+len);
    if (!queueClass || queueClass === 'unknown' || !Number.isFinite(n) || n < 1 || n > 50) return;
    if (!state.recruitQueueCap || typeof state.recruitQueueCap !== 'object') state.recruitQueueCap = {};
    const t = state.recruitQueueCap[String(townId)] || (state.recruitQueueCap[String(townId)] = {});
    const cap = Math.min(+t[queueClass] || Infinity, n);
    if (+t[queueClass] === cap) return;
    t[queueClass] = cap;
    try { save(wkey(STORE.RECRUIT_QCAP), state.recruitQueueCap); } catch (_) {}
    gbLog(`recruit: learned queue cap ${cap} for town ${townId} ${queueClass} lane (server full at ${n})`);
  }
  function recruitQueueMax() {
    try {
      const uw = gameUw();
      const q = uw.GameDataConstructionQueue;
      if (q && typeof q.getUnitOrdersQueueLength === 'function') {
        const n = gbNum(q.getUnitOrdersQueueLength());
        if (n != null && n > 0) return n;
        gbLogT('recruit-qmax-unreadable', 300000, 'recruit: unit queue max unreadable; fallback 7');
      }
    } catch (_) {}
    return 7;
  }
  function recruitQueueBuilding(unitId) {
    return recruitIsNaval(unitId) ? 'docks' : 'barracks';
  }
  function recruitResourceFactor(townId, def) {
    try {
      const uw = gameUw();
      const GM = uw.GeneralModifications;
      if (!GM || typeof GM.getUnitBuildResourcesModification !== 'function' || !def) return 1;
      let unitDef = def;
      if (def.id && recruitIsNaval(def.id) && !def.is_naval && !def.naval) {
        unitDef = Object.assign({}, def, { is_naval: true });
      }
      const f = gbNum(GM.getUnitBuildResourcesModification(+townId, unitDef));
      if (f != null && f > 0) return f;
    } catch (_) {}
    return 1;
  }
  function recruitRefreshWaitingSlotJobs() {
    const root = nativeQueueRoot();
    for (const tid of Object.keys(root.towns || {})) {
      for (const lane of NATIVE_RECRUIT_LANES) {
        const job = nativeQueueList(tid, lane, false)[0];
        if (!job || job.status !== 'waiting-slot' || !job.unit) continue;
        if (job.inflight || job.manualReview) continue;
        const q = recruitQueueInfo(tid, job.unit);
        const max = (q.max != null && q.max > 0) ? q.max : recruitQueueMax();
        if (!q.known || q.len < max) {
          delete job.slotRetryAt;
          nativeQueueSetJobState(job, 'pending', 'cola liberada / re-chequeo');
          continue;
        }
      }
    }
  }
  function recruitQueueInfo(townId,unitId) {
    const t = gbTownModel(townId);
    if (!t) return { known:false, len:0, max:null, models:[], queueClass:'unknown', capacitySource:'town-unreadable' };
    let col = null, models = [];
    try {
      col = t.getUnitOrdersCollection && t.getUnitOrdersCollection();
      if (!col || !Array.isArray(col.models)) return {known:false,len:0,max:null,models:[],queueClass:'unknown',capacitySource:'collection-unreadable'};
      models = col.models.slice();
    } catch (_) {
      return {known:false,len:0,max:null,models:[],queueClass:'unknown',capacitySource:'collection-unreadable'};
    }
    const want = unitId ? gbGameDataLookup('units', unitId) : null;
    const wantClass = unitId ? recruitQueueClass(want, unitId) : 'all';
    if (unitId) {
      models = models.filter(m => {
        const a = m.attributes || m, id = a.unit_type || a.unit_id || a.type, d = gbGameDataLookup('units', id);
        return !d || recruitQueueClass(d, id) === wantClass;
      });
    }
    const cap = recruitQueueMaxProbe(col, townId, unitId);
    const len = cap.domLen != null && Number.isFinite(+cap.domLen) ? +cap.domLen : models.length;
    if (cap.max == null) {
      const key = `recruit-qcap-${townId}-${wantClass}`;
      let hints = '';
      try {
        const keys = Object.keys((col && (col.attributes || col)) || {}).filter(k => /(queue|order|max|slot)/i.test(k)).slice(0,12);
        if (keys.length) hints = ` keys=${keys.join(',')}`;
      } catch (_) {}
      gbLogT(key, 120000, `recruit: queue capacity unreadable town=${townId} lane=${wantClass} len=${len}; proceeding blind (server authoritative).${hints}`);
    }
    return { known:true, len, max:cap.max, models, queueClass:wantClass, capacitySource:cap.source };
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
  function recruitQueueSpace(townId, unitId) {
    const q = recruitQueueInfo(townId, unitId);
    if (!q.known) return { ok:false, full:null, blind:true, why:'queue-unknown', q };
    if (q.max != null) {
      const full = q.len >= q.max;
      return { ok:!full, full, blind:false, why:full?'queue-full':'queue-space', q };
    }
    return { ok:true, full:null, blind:true, why:'queue-capacity-unreadable', q };
  }
  function recruitQueueHasSpace(townId,unitId) {
    return recruitQueueSpace(townId,unitId).ok;
  }
  function recruitAffordability(townId, unit, want) {
    const def = gbGameDataLookup('units', unit);
    const wantN = gbNum(want);
    const desired = wantN != null ? Math.max(0, Math.floor(wantN)) : 0;
    if (wantN == null) return { ok:false, why:'want-unreadable', limits:{}, blind:['want'] };
    if (!def || !def.resources || !(desired > 0)) return { amount:0, desired, why:'unit-cost-unreadable', blind:['unit-cost-unreadable'], limits:{} };
    const ec = recruitEffectiveUnitCost(townId, unit);
    const maxNow = recruitRuntimeMaxAmount(townId, unit);
    const res = recruitLiveResources(townId);
    const pop = recruitLivePopulation(townId);
    let amount = maxNow.known ? Math.min(desired, maxNow.amount) : desired;
    const blind = [], limits = {};
    if (!maxNow.known) blind.push('max-recruitable-unreadable');
    const apply = (name, have, cost, unreadableTag) => {
      if (!(cost > 0)) return;
      if (have == null || !Number.isFinite(+have)) { blind.push(unreadableTag); return; }
      const lim = Math.max(0, Math.floor(+have / cost));
      limits[name] = { have:+have, cost, max:lim };
      amount = Math.min(amount, lim);
    };
    for (const k of ['wood','stone','iron']) {
      if (recruitCostFieldKnown(ec, k)) apply(k, res[k], +ec[k], 'resources-unreadable:' + k);
      else blind.push('effective-cost-unreadable:' + k);
    }
    if (recruitCostFieldKnown(ec, 'population')) apply('population', pop.value, +ec.population, 'population-unreadable');
    else blind.push('effective-cost-unreadable:population');
    let favor = null;
    const baseFavor = gbNum(def.favor ?? (def.resources && def.resources.favor));
    if (baseFavor != null && baseFavor > 0) {
      const god = (def.god && String(def.god).toLowerCase()) || mythicalUnitGod(unit);
      const fc = recruitFavorUnitCost(ec, def);
      if (!god) blind.push('favor-unreadable:god');
      else if (fc.cost != null && fc.cost > 0) {
        favor = recruitFavorRead(townId, god);
        apply('favor', favor.value, fc.cost, 'favor-unreadable:' + god);
        if (fc.source === 'advisory') blind.push('favor-cost-advisory');
      } else blind.push('effective-cost-unreadable:favor');
    }
    amount = Math.max(0, Math.floor(amount));
    let limiting = null;
    if (amount < desired) {
      for (const k of ['wood','stone','iron','population','favor']) {
        if (limits[k] && limits[k].max === amount) { limiting = k; break; }
      }
      if (!limiting && maxNow.known && maxNow.amount === amount) limiting = 'runtime-max';
    }
    const why = limiting === 'population' ? 'waiting-population'
      : limiting === 'runtime-max' ? 'waiting-runtime-max'
      : limiting ? ('waiting-' + limiting)
      : (blind.length ? blind[0] : 'ready');
    return { amount, desired, why, limiting, blind:[...new Set(blind)], limits, resources:res, population:pop, favor, effectiveCost:ec, maxRecruitable:maxNow };
  }
  function recruitAffordableAmount(townId, unit, want) {
    return recruitAffordability(townId, unit, want).amount;
  }
  function recruitValidateJob(job) {
    if (!recruitCanBuild(job.townId, job.unit)) return { ok:false, why:'requirements' };
    const qs = recruitQueueSpace(job.townId, job.unit);
    if (!qs.ok) return { ok:false, why:qs.why, queue:qs.q, blind:qs.blind };
    const af = recruitAffordability(job.townId, job.unit, job.amount);
    if (!(af.amount > 0)) return { ok:false, why:af.why || 'resources-unavailable', affordability:af, queue:qs.q };
    return { ok:true, amount:Math.min(af.amount, job.amount), why:af.why, affordability:af, queue:qs.q, blind:qs.blind || af.blind.length > 0 };
  }
  let recruitNativeCursor=0,recruitLegacyCursor=0;
  function recruitRotate(ids,cursor){if(!ids.length)return ids;const at=Math.max(0,cursor%ids.length);return ids.slice(at).concat(ids.slice(0,at))}
  function recruitLockName(townId, unit) {
    const lane = nativeRecruitLane(unit);
    return `recruit:${String(townId)}:${lane === 'recruitNaval' ? 'docks' : 'barracks'}`;
  }

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
    const nativePending = nativeRecruitPending(), cdPending = cityDesignerHasExecutableWork('recruit');
    if (!hostEnabled() || (!state.autoRecruit && !nativePending && !cdPending) || captchaPaused('recruit')) return;
    try { recruitRefreshWaitingSlotJobs(); } catch (_) {}
    if (automationPaused({})) return;

    // Recruitment is independent from farming. The old farm-first hard gate could
    // starve recruitment indefinitely whenever any village claim remained pending.
    recruitScanResetMemo();
    const targets = goalEffectiveRecruitTargets();
    for(const tid of Object.keys(targets))if(nativeQueuePlannerOwnsTown(tid))nativeQueueClearForPlanner(tid,'recruit-scan',true);

    const explicitIds=Object.keys(nativeQueueRoot().towns).filter(id=>!nativeQueuePlannerOwnsTown(id)&&NATIVE_RECRUIT_LANES.some(l=>nativeQueueIsFifo(id,l)&&nativeQueueList(id,l,false).length));
    const legacyIds=Object.keys(targets).filter(id=>(state.autoRecruit||cdIsProfile(goalTownCfg(id).profile))&&(nativeQueuePlannerOwnsTown(id)||!NATIVE_RECRUIT_LANES.every(l=>nativeQueueIsFifo(id,l))));
    const townIds=recruitRotate(explicitIds,recruitNativeCursor++).concat(recruitRotate(legacyIds,recruitLegacyCursor++)).filter((id,i,a)=>a.indexOf(id)===i);
    if (!townIds.length) {
      gbLogT('recruit-empty', 300000, 'recruit: no town targets configured');
      return;
    }
    const uw = gameUw();
    let job = null;
    for (const tid of townIds) {
      for (const lane of NATIVE_RECRUIT_LANES) {
        if (nativeQueuePlannerOwnsTown(tid) || !nativeQueueIsFifo(tid, lane)) continue;
        const explicitJobs = nativeQueueRecruitCandidates(tid, lane);
        for (const explicit of explicitJobs) {
          const qspace = recruitQueueSpace(tid, explicit.unit);
          if (!qspace.ok) {
            nativeQueueSetJobState(explicit, qspace.full ? 'waiting-slot' : 'queue-unknown',
              qspace.full ? `cola real llena (${qspace.q.len}/${qspace.q.max})` : 'cola real no legible');
            // Queue capacity is shared by every job in this land/naval lane.
            if (qspace.full) break;
            continue;
          }
          if (!recruitCanBuild(tid, explicit.unit) || !recruitControllerFor(explicit.unit)) {
            nativeQueueSetJobState(explicit, 'blocked', 'requisitos/controlador'); continue;
          }
          const totalAmt = gbNum(explicit.amount);
          if (totalAmt == null) {
            nativeQueueSetJobState(explicit, 'amount-unreadable', 'cantidad no legible');
            continue;
          }
          const infinite = nativeQueueRecruitIsInfinite(explicit);
          const csRaw = gbNum(explicit.chunkSize);
          const cs = csRaw != null && csRaw > 0 ? csRaw : 0;
          let postAmt;
          if (infinite) {
            if (!(cs > 0)) { nativeQueueSetJobState(explicit, 'blocked', 'lote infinito inválido'); continue; }
            postAmt = cs;
          } else {
            if (!(totalAmt > 0)) { nativeQueueSetJobState(explicit, 'blocked', 'cantidad inválida'); continue; }
            postAmt = cs > 0 && cs < totalAmt ? cs : totalAmt;
          }

          const afford = recruitAffordability(tid, explicit.unit, postAmt);
          if (afford.amount < postAmt) {
            nativeQueueSetJobState(explicit, afford.why || 'waiting-resources',
              `${afford.why || 'waiting-resources'}: ${afford.amount}/${postAmt}`);
            // Work-conserving queue: this job reserves nothing.  Try the next
            // queued troop immediately; a cheaper/different unit may be payable.
            continue;
          }
          const blindBits = [];
          if (qspace.blind) blindBits.push(`queue ${qspace.q.len}/?`);
          if (afford.blind.length) blindBits.push(afford.blind.join(','));
          nativeQueueSetJobState(explicit, 'ready', blindBits.length ? ('listo; precheck ciego ' + blindBits.join(' | ')) : 'listo');
          job = { kind:'build', townId:tid, unit:explicit.unit, amount:postAmt, nativeJobId:explicit.id, nativeLane:lane, nativeChunkSize: cs, nativeInfinite: infinite };
          break;
        }
        if (job) break;
      }
      if (job) break;
      // City Designer owns composition for its towns. Until development
      // buildings are complete, suppress its dynamic recruit targets so units
      // cannot consume population required by future building levels. Explicit
      // native FIFO jobs above remain user-authoritative and are not removed.
      if(cdIsProfile(goalTownCfg(tid).profile)&&(!cdBuildDone(tid)||!cdCompositionResearchReady(tid)))continue;
      const want = targets[tid];
      if (!want || typeof want !== 'object') continue;
      let t = null;
      try { t = uw.ITowns.towns[tid]; } catch (_) {}
      if (!t) continue;
      const have = goalUnitCounts(tid);
      for (const unit of Object.keys(want)) {
        const tgt = gbNum(want[unit]);
        if (tgt == null || !(tgt > 0)) continue;

        const dynLane=nativeRecruitLane(unit);if(nativeQueuePlannerOwnsTown(tid)){if(nativeQueuePlannerLaneBlocked(tid,dynLane))continue}else if(nativeQueueIsFifo(tid,dynLane))continue;
        if (!recruitCanBuild(tid, unit)) continue;
        if (!recruitControllerFor(unit)) continue;
        if (!recruitQueueHasSpace(tid,unit)) continue;
        const cur = gbNum(have[unit]);
        if (cur == null) continue;
        const queued = recruitQueuedAmount(tid, unit);
        const need = tgt - cur - queued;
        if (need <= 0) continue;
        const affordGoal = recruitAffordability(tid, unit, need);
        let amount = affordGoal.amount;
        if (!(amount > 0)) {
          gbLogT(`recruit-wait-${tid}-${unit}`, 60000, `recruit: town ${tid} ${unit} ${affordGoal.why || 'resources-unavailable'}`);
          continue;
        }

        amount = Math.min(amount, 50);
        job = { kind: 'build', townId: tid, unit, amount, cdRevision:cdIsProfile(goalTownCfg(tid).profile)?cdProfileRevision(tid):null };
        break;
      }
      if (job) break;
    }
    if (!job) {
      gbLogT('recruit-idle', 180000, `recruit: idle (${scanReason(reason)})`);
      return;
    }
    if(job.cdRevision!=null&&+job.cdRevision!==cdProfileRevision(job.townId)){gbLogT('recruit-cd-stale-'+job.townId,60000,'recruit: city-designer revision changed; stale job dropped');return}
    // Universal spell preflight for native FIFO and legacy recruitment.
    // It never reserves resources: if the buff cannot be cast, recruitment proceeds.
    const spellDecision = recruitAutoSpellDecision(job.townId, job.unit);
    if (spellDecision.action === 'cast') {
      const spellLockName = `recruit:${String(job.townId)}:spell`;
      const spellLock = gbLock(spellLockName, 120000);
      if (!spellLock) return;
      recruitCastSpell(job.townId, spellDecision.power, (err) => {
        gbUnlock(spellLockName, spellLock);
        if (!err) {
          recruitSpellCooldownStamp(job.townId, spellDecision.power, 60000);
          gbLog(`recruit spell: ${spellDecision.power} on ${job.townId}; recruit on next scan`);
        } else if (err === 'timeout' || err === 'timeout_unknown' || err === 'pending') {
          recruitSpellCooldownStamp(job.townId, spellDecision.power);
          gbLog(`recruit spell: outcome unknown (${err}); next scan recruits without recasting`);
        } else {
          recruitSpellCooldownStamp(job.townId, spellDecision.power, 60000);
          gbLogT('spell-err', 60000, `recruit spell unavailable (${err}); next scan recruits normally`);
        }
        gbTimeout(() => { try { recruitScan('spell-fallback'); } catch (_) {} }, 900);
      });
      return;
    }
    const lockName = recruitLockName(job.townId, job.unit);
    const lockToken = gbLock(lockName, 120000);
    if (!lockToken) return;
    const valid = recruitValidateJob(job);
    if (!valid.ok) { gbUnlock(lockName, lockToken); gbLogT('recruit-stale-' + job.townId, 60000, `recruit: final precheck blocked (${valid.why})`); return; }
    if (job.nativeJobId && valid.amount < job.amount) {
      const head = nativeQueueList(job.townId, job.nativeLane, false).find(j=>j&&j.id===job.nativeJobId);
      const why = (valid.affordability && valid.affordability.why) || 'waiting-resources';
      nativeQueueSetJobState(head, why, `${why}: ${valid.amount}/${job.amount}`);
      gbUnlock(lockName, lockToken); return;
    }
    job.amount = valid.amount;
    if (job.nativeJobId) {
      const head = nativeQueueList(job.townId, job.nativeLane, false).find(j=>j&&j.id===job.nativeJobId);
      if (!head) { gbUnlock(lockName, lockToken); return; }
      head.manualReview=false;

      job.nativeToken = nativeQueueId('f');
      head.inflight = { amount:job.amount, at:Date.now(), unit:job.unit, queuedBefore:recruitQueuedAmount(job.townId, job.unit), token:job.nativeToken };
      nativeQueueSave();
    }
    recruitBuild(job.townId, job.unit, job.amount, (err) => {
      gbUnlock(lockName, lockToken);
      if (!err) {
        gbLog(`recruit: town ${job.townId} ${job.amount}\u00d7 ${job.unit}`);
        if (job.nativeJobId) nativeQueueRecruitApplied(job.townId, job.nativeLane, job.nativeJobId, job.amount, job.nativeToken);
      } else {
        const ambiguous=err === 'pending' || err === 'timeout_unknown';
        const expectedWait=gbExpectedServerReject('recruit', err);
        // Server says the lane is full while the client said it had room: the
        // observed length is an authoritative cap — learn it so later scans
        // block locally instead of re-posting into the same red popup.
        if (!ambiguous && expectedWait === 'waiting-queue-full' && valid && valid.queue) {
          recruitQueueCapStamp(job.townId, valid.queue.queueClass, valid.queue.len);
        }
        if (job.nativeJobId) {
          const head = nativeQueueList(job.townId, job.nativeLane, false).find(j=>j&&j.id===job.nativeJobId);
          if (head) {
            // Server says the lane is full while the client said it had room:
            // back the head off instead of burning a budget slot and stacking
            // decision-memory strikes every cadence.
            if (!ambiguous && expectedWait === 'waiting-queue-full') head.slotRetryAt = Date.now() + 300000;
            if(ambiguous&&head.inflight)head.reconcile=Object.assign({},head.inflight);
            head.inflight = null;head.manualReview=ambiguous;
            nativeQueueSetJobState(head,
              ambiguous ? 'unknown' : (expectedWait || 'blocked'),
              ambiguous ? 'resultado desconocido; se reconciliará sin bloquear otras unidades' : (expectedWait ? (expectedWait + ': ' + String(err)) : String(err)));
          }
        }
        gbLogT('recruit-err', 60000, `recruit err ${err}`);
      }
    });
  }

  const VILLAGE_RECRUIT_UNITS = ['sword', 'archer', 'hoplite', 'slinger'];
  const VILLAGE_PAIR_LOW = ['sword', 'archer'];
  const VILLAGE_PAIR_HIGH = ['hoplite', 'slinger'];
  const VILLAGE_RECRUIT_STREAK_TRIP = 2;
  function villagePairPick(unitCounts) {

    if (!unitCounts || typeof unitCounts !== 'object') return null;
    const g = (id) => gbNum(unitCounts[id]);
    const sword = g('sword'), archer = g('archer'), hoplite = g('hoplite'), slinger = g('slinger');
    // Any listed unit present-but-unreadable ⇒ blind; do not invent 0.
    for (const [id, n] of [['sword',sword],['archer',archer],['hoplite',hoplite],['slinger',slinger]]) {
      if (Object.prototype.hasOwnProperty.call(unitCounts, id) && n == null) return null;
    }
    const a = (sword || 0) + (archer || 0);
    const b = (hoplite || 0) + (slinger || 0);

    const pair = a >= b ? VILLAGE_PAIR_LOW : VILLAGE_PAIR_HIGH;
    const lo = g(pair[0]) || 0;
    const hi = g(pair[1]) || 0;
    return lo <= hi ? pair[0] : pair[1];
  }

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

            const units = {};
            for (const u of VILLAGE_RECRUIT_UNITS) {
              const n = gbNum(bag[u]);
              if (n != null && n >= 0) units[u] = n;
            }
            const known = VILLAGE_RECRUIT_UNITS.some(u => Object.prototype.hasOwnProperty.call(units, u));
            if (known) return { known: true, units, relId: (m && m.id) != null ? m.id : (a && a.id) };
          }
          if (typeof bag === 'number' || Array.isArray(bag)) {

            const arr = Array.isArray(bag) ? bag : [bag];
            const units = {};
            VILLAGE_RECRUIT_UNITS.forEach((u, i) => {
              const n = gbNum(arr[i]);
              if (n != null && n >= 0) units[u] = n;
            });
            if (Object.keys(units).length) return { known: true, units, relId: (m && m.id) != null ? m.id : (a && a.id) };
          }
          if (typeof m.getUnitCount === 'function') {
            const units = {};
            for (const u of VILLAGE_RECRUIT_UNITS) {
              const n = gbNum(m.getUnitCount(u));
              if (n != null && n >= 0) units[u] = n;
            }
            if (Object.keys(units).length) return { known: true, units, relId: m.id };
          }
        }
      }
      return { known: false };
    } catch (_) { return { known: false }; }
  }

  function villageSaturationStreak(villId) {
    if (!state.farmResources || !state.farmResources[villId]) return 0;
    const r = state.farmResources[villId];
    const cap = gbNum(r.cap);
    if (!r.ok || cap == null || !(cap > 0)) return 0;
    const wood = gbNum(r.wood), stone = gbNum(r.stone), iron = gbNum(r.iron), pop = gbNum(r.pop);
    // Unreadable stock → blind: do not invent fill=0 or bump/reset streak.
    if (wood == null || stone == null || iron == null || pop == null) return 0;
    const fill = (wood + stone + iron + pop) / cap;
    const threshPct = gbNum(state.villageRecruitFillPct);
    const thresh = Math.max(0.5, Math.min(1, (threshPct != null ? threshPct : 90) / 100));
    const streaks = state.villageRecruitStreaks || (state.villageRecruitStreaks = {});
    const prev = gbNum(streaks[villId]);
    const prevN = prev != null && prev >= 0 ? prev : 0;
    const next = fill >= thresh ? prevN + 1 : 0;
    streaks[villId] = next;
    return next;
  }

  function villageAcceptUnits(farm, unitId, amount, onDone) {
    const tpl = state.acceptUnitsTpl || null;
    const actionName = (tpl && tpl.action_name) || 'accept_units';
    const baseArgs = (tpl && tpl.arguments) || {};
    const farmId = gbNum(farm && farm.vill_id);
    const amt = gbNum(amount);
    const tid = gbNum(farm && farm.owning_town_id);
    if (farmId == null) {
      gbLogT('villrecruit-farm-id', 60000, 'village recruit: farm_town_id unreadable — no post');
      return onDone && onDone('farm-unreadable');
    }
    if (amt == null || !(amt > 0)) {
      gbLogT('villrecruit-amount', 60000, 'village recruit: amount unreadable — no post');
      return onDone && onDone('amount-unreadable');
    }
    if (tid == null) {
      gbLogT('villrecruit-town-id', 60000, 'village recruit: owning_town_id unreadable — no post');
      return onDone && onDone('town-unreadable');
    }
    const args = Object.assign({}, baseArgs, {
      farm_town_id: farmId,
      unit_id: String(unitId),
      amount: amt,
    });
    const modelUrl = (tpl && tpl.model_url) || ('FarmTownPlayerRelation/' + (farm.relation_id || ''));
    bridgePost('villrecruit', {
      model_url: modelUrl,
      action_name: actionName,
      arguments: args,
      town_id: tid,
    }, onDone);
  }
  let villageRecruitCursor = 0;
  function villageRecruitScan(reason) {
    if (!hostEnabled() || !state.autoVillageRecruit) return;
    if (automationPaused({})) return;
    if (captchaPaused('villrecruit')) return;

    // Independent mode: village-unit recruitment is not blocked by resource claims.

    if (!state.acceptUnitsTpl || !state.acceptUnitsTpl.action_name) {
      gbLogT('villrecruit-tpl', 600000, 'village recruit: abre una aldea, pulsa Aceptar una vez a mano para ensenar al bot el payload del puente');
      return;
    }

    const list = state.farmsParsed || [];
    if (!list.length) return;
    const start = Math.max(0, villageRecruitCursor % list.length);

    for (let step = 0; step < list.length; step++) {
      const idx = (start + step) % list.length;
      const farm = list[idx];
      if (!farm || !farm.vill_id) continue;

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

      const islandMap = islandTownMap();
      const ctx = farmIslandContext(farm, islandMap);
      if (!ctx.known) continue;
      const unitBeneficiary = resolveIslandUnitBeneficiary(ctx.key, ctx.ids);
      if (!unitBeneficiary.known || !unitBeneficiary.enabled || !unitBeneficiary.townId) continue;
      farm.owning_town_id = String(unitBeneficiary.townId);

      const amount = Math.max(1, Math.min(20, +state.villageRecruitAmount || 1));
      const lockName = `village-recruit:${farm.vill_id}`;
      const lockToken = gbLock(lockName, 60000);
      if (!lockToken) continue;
      // Always advance before dispatch. A pending/unknown TX for one village can
      // no longer keep every later village from getting a turn.
      villageRecruitCursor = (idx + 1) % list.length;

      gbLog(`village recruit: vill ${farm.vill_id} -> ${amount}x ${unit} (streak ${streak}, town ${farm.owning_town_id})`);
      villageAcceptUnits(farm, unit, amount, (err) => {
        gbUnlock(lockName, lockToken);
        if (!err) {
          gbLog(`village recruit: vill ${farm.vill_id} +${amount} ${unit}`);
          flash(`aldea ${farm.name || farm.vill_id}: +${amount} ${unit}`);
        } else {
          gbLogT('villrecruit-err-' + farm.vill_id, 60000, `village recruit err ${farm.vill_id}: ${err}`);
        }
      });

      return;
    }
  }
  function batchRecruitNormLists() {
    let root=state.batchRecruitLists;
    if(!root||typeof root!=='object'||Array.isArray(root))root=state.batchRecruitLists={towns:{}};
    if(!root.towns||typeof root.towns!=='object'||Array.isArray(root.towns))root.towns={};
    // Never delete a persisted town merely because ITowns/state.towns is still
    // loading. Unknown/partial discovery is not proof that a town is orphaned.
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
    const missing = [], advisory = [];
    for (const r of list) {
      const def = gbGameDataLookup('units', r.unit), ec = recruitEffectiveUnitCost(townId, r.unit);
      if (!def || !ec) { missing.push(r.unit); continue; }
      const a = gbNum(r.amount);
      if (a == null || !(a > 0)) continue;
      for (const [k, bucket] of [['wood','wood'],['stone','stone'],['iron','iron'],['population','pop'],['favor','favor']]) {
        const v = recruitDisplayCost(ec, k);
        if (v == null) { missing.push(r.unit + ':' + k); continue; }
        if (!recruitCostFieldKnown(ec, k)) advisory.push(r.unit + ':' + k);
        if (bucket === 'wood') wood += v*a;
        else if (bucket === 'stone') stone += v*a;
        else if (bucket === 'iron') iron += v*a;
        else if (bucket === 'pop') pop += v*a;
        else if (v > 0) favor += v*a;
      }
    }
    const rs = t && t.resources && t.resources();
    const haveWood = rs && Number.isFinite(+rs.wood) ? +rs.wood : null;
    const haveStone = rs && Number.isFinite(+rs.stone) ? +rs.stone : null;
    const haveIron = rs && Number.isFinite(+rs.iron) ? +rs.iron : null;
    const havePop = (t && typeof t.getAvailablePopulation === 'function' && Number.isFinite(+t.getAvailablePopulation())) ? +t.getAvailablePopulation() : null;
    const authoritative = !missing.length && !advisory.length;
    const fits = authoritative && haveWood != null && haveStone != null && haveIron != null && havePop != null
      ? wood <= haveWood && stone <= haveStone && iron <= haveIron && pop <= havePop : null;
    return { wood, stone, iron, pop, favor, haveWood, haveStone, haveIron, havePop, fits, missing, advisory:[...new Set(advisory)] };
  }
  const _batchRecruitBlind = new Set();
  function batchRecruitAtomicAfford(townId) {
    const list = batchRecruitTownList(townId);
    if (!list.length) return { ok:false, why:'empty' };
    const t = gbTownModel(townId);
    if (!t) return { ok:false, why:'blind-town' };
    const res = recruitLiveResources(townId), pop = recruitLivePopulation(townId);
    const need = { wood:0, stone:0, iron:0, pop:0 };
    const known = { wood:true, stone:true, iron:true, pop:true };
    const favorNeed = Object.create(null), laneRows = { land:[], naval:[] }, blind = [];
    for (let i = 0; i < list.length; i++) {
      const r = list[i], unit = r && r.unit, amount = +r.amount || 0;
      if (!unit || !(amount > 0)) continue;
      const def = gbGameDataLookup('units', unit);
      if (!def || !recruitControllerFor(unit)) return { ok:false, why:'no-controller', rowIdx:i, unit };
      if (!recruitCanBuild(townId, unit)) return { ok:false, why:'requirements', rowIdx:i, unit };
      const maxNow = recruitRuntimeMaxAmount(townId, unit);
      if (maxNow.known && maxNow.amount < amount) return { ok:false, why:'waiting-runtime-max', rowIdx:i, unit, have:maxNow.amount, need:amount };
      if (!maxNow.known) blind.push('max-recruitable-unreadable:' + unit);
      const ec = recruitEffectiveUnitCost(townId, unit);
      if (!ec) { blind.push('unit-cost-unreadable:' + unit); continue; }
      for (const k of ['wood','stone','iron']) {
        if (recruitCostFieldKnown(ec,k)) need[k] += +ec[k] * amount;
        else { known[k] = false; blind.push('effective-cost-unreadable:' + unit + ':' + k); }
      }
      if (recruitCostFieldKnown(ec,'population')) need.pop += +ec.population * amount;
      else { known.pop = false; blind.push('effective-cost-unreadable:' + unit + ':population'); }
      const baseFavor = gbNum(def.favor ?? (def.resources && def.resources.favor));
      if (baseFavor != null && baseFavor > 0) {
        const god = (def.god && String(def.god).toLowerCase()) || mythicalUnitGod(unit);
        const fc = recruitFavorUnitCost(ec, def);
        if (!god || fc.cost == null || !(fc.cost > 0)) blind.push('effective-cost-unreadable:' + unit + ':favor');
        else {
          favorNeed[god] = (favorNeed[god] || 0) + (fc.cost * amount);
          if (fc.source === 'advisory') blind.push('favor-cost-advisory:' + unit);
        }
      }
      laneRows[recruitIsNaval(unit)?'naval':'land'].push({i,unit});
    }
    for (const k of ['wood','stone','iron']) {
      if (!known[k]) continue;
      if (res[k] == null) { blind.push('resources-unreadable:' + k); continue; }
      const have = gbNum(res[k]);
      if (have == null) { blind.push('resources-unreadable:' + k); continue; }
      if (have < need[k]) return { ok:false, why:'waiting-' + k, aggregate:true, need, have };
    }
    if (known.pop && need.pop > 0) {
      if (pop.value == null) blind.push('population-unreadable');
      else if (pop.value < need.pop) return { ok:false, why:'waiting-population', aggregate:true, need, havePop:pop.value };
    }
    for (const [god, n] of Object.entries(favorNeed)) {
      const fr = recruitFavorRead(townId, god);
      if (fr.value == null) { blind.push('favor-unreadable:' + god); continue; }
      if (fr.value < n) return { ok:false, why:'waiting-favor', aggregate:true, god, needFavor:n, haveFavor:fr.value };
    }
    for (const kind of ['land','naval']) {
      const rows = laneRows[kind];
      if (!rows.length) continue;
      const qs = recruitQueueSpace(townId, rows[0].unit);
      if (!qs.ok) return { ok:false, why:qs.why, rowIdx:rows[0].i, unit:rows[0].unit };
      if (qs.q.max != null && qs.q.len + rows.length > qs.q.max) return { ok:false, why:'queue-full', rowIdx:rows[0].i, unit:rows[0].unit };
      if (qs.blind) blind.push(`queue-${kind}-capacity-unreadable`);
    }
    return { ok:true, aggregate:need, aggregateKnown:known, favorNeed, blind:[...new Set(blind)] };
  }
  function batchRecruitFire(townId) {
    const list = batchRecruitTownList(townId).map(r => ({ unit:String(r.unit), amount:+r.amount||0 }));
    if (!list.length) return;
    let idx = 0;
    let stopped = false;
    const fireOne = () => {
      if (stopped || idx >= list.length) return;
      const r = list[idx];
      const unit = r.unit, amount = +r.amount || 0;
      const spellDecision = recruitAutoSpellDecision(townId, unit);
      if (spellDecision.action === 'cast') {
        const spellLockName = `recruit:${String(townId)}:spell`;
        const spellLock = gbLock(spellLockName, 120000);
        if (!spellLock) { gbTimeout(fireOne, 500); return; }
        recruitCastSpell(townId, spellDecision.power, (err) => {
          gbUnlock(spellLockName, spellLock);
          recruitSpellCooldownStamp(townId, spellDecision.power,
            (err === 'timeout' || err === 'timeout_unknown' || err === 'pending') ? undefined : 60000);
          if (err) gbLogT(`batch-recruit-spell-${townId}`, 60000,
            `batch recruit: spell ${spellDecision.power} unavailable (${err}); recruiting normally`);
          else gbLog(`batch recruit: spell ${spellDecision.power} on ${townId}; row waits for next pass`);
          gbTimeout(fireOne, 900);
        });
        return;
      }
      const lockName = recruitLockName(townId, unit);
      const lockToken = gbLock(lockName, 120000);
      if (!lockToken) { gbTimeout(fireOne, 500); return; }
      idx++;

      // Re-read live resources/queue immediately before each POST. The aggregate
      // preflight only decides whether to start the batch; it is not a reserve.
      const validated = recruitValidateJob({ townId, unit, amount });
      if (!validated.ok || validated.amount < amount) {
        stopped = true;
        gbUnlock(lockName, lockToken);
        gbLogT(`batch-recruit-pre-${townId}`, 60000, `batch recruit: ${validated.why || 'partial-afford'} @ ${unit} (row ${idx}/${list.length})`);
        return;
      }
      recruitBuild(townId, unit, amount, (err) => {
        gbUnlock(lockName, lockToken);
        if (err) {
          stopped = true;
          if (err !== 'pending' && err !== 'timeout_unknown'
            && gbExpectedServerReject('recruit', err) === 'waiting-queue-full'
            && validated && validated.queue) {
            recruitQueueCapStamp(townId, validated.queue.queueClass, validated.queue.len);
          }
          gbLogT(`batch-recruit-partial-${townId}`, 60000, `batch recruit: stopped at row ${idx}/${list.length} (${err})`);
          return;
        }
        gbLog(`batch recruit: town ${townId} ${amount}× ${unit} (row ${idx}/${list.length})`);
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
    const out=[];
    const add=id=>{id=String(id==null?'':id);if(id&&!out.includes(id))out.push(id)};
    try{Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{}).forEach(add)}catch(_){}
    try{(state.towns||[]).forEach(t=>t&&t.id!=null&&add(t.id))}catch(_){}
    // Preserve configured lists even if live town discovery is temporarily
    // incomplete. They remain visible so the user can remove them explicitly.
    try{Object.keys((batchRecruitNormLists().towns)||{}).forEach(add)}catch(_){}
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
      opt.value = ''; opt.textContent = '\u2014 sin ciudades \u2014';
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
      e.textContent = 'lista vac\u00eda \u2014 a\u00f1ade una l\u00ednea y elige unidad + cantidad';
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
        trash.textContent = '\ud83d\uddd1'; trash.title = 'quitar l\u00ednea';
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
        ? ` (falta informaci\u00f3n de: ${preview.missing.join(', ')})`
        : (preview.fits ? ' \u2192 cabe \u2713' : ' \u2192 falta');
      const color = preview.fits ? '#7ddd96' : '#e5bf70';
      sumHost.innerHTML = '';
      const a = document.createElement('div');
      a.style.cssText = `color:${color};font-size:10px`;
      a.textContent = `total: ${totals || '0'} \u00b7 ciudad ahora: ${have.join(' / ') || '\u2014'}${tag}`;
      sumHost.appendChild(a);
    }
  }
  function batchRecruitUiRowCost(row) {
    const def = gbGameDataLookup('units', row && row.unit);
    if (!def) return '\u2014 desconocida \u2014';
    const r = def.resources || {};
    const parts = [];
    const a = gbNum(row && row.amount);
    if (a == null || !(a > 0)) return '\u2014';
    if (gbNum(r.wood)) parts.push(`mad ${gbNum(r.wood) * a}`);
    if (gbNum(r.stone)) parts.push(`pie ${gbNum(r.stone) * a}`);
    if (gbNum(r.iron)) parts.push(`pla ${gbNum(r.iron) * a}`);
    if (gbNum(def.population)) parts.push(`pop ${gbNum(def.population) * a}`);
    const fav = gbNum(def.favor != null ? def.favor : (r && r.favor));
    if (fav != null && fav > 0) parts.push(`favor ${fav * a}`);
    return parts.join(' / ') || 'gratis';
  }
  function batchRecruitUiAdd() {
    const sec = trainSection();
    if (!sec) return;
    const townSel = sec.querySelector('[data-cfg=batch-recruit-town]');
    const townId = townSel && townSel.value;
    if (!townId) { flash('elige una ciudad antes de a\u00f1adir l\u00ednea'); return; }
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
    if (captchaPaused('recruit')) { flash('captcha activa \u2014 espera'); return; }
    if (!batchRecruitHasAnyTown()) { flash('no hay listas armadas'); return; }
    batchRecruitScan('manual');
  }
  const RECRUIT_PACK_NAME_MAX = 40;
  const RECRUIT_PACKS_LEDGER = boundedLedger({
    stateKey: 'recruitPacks',
    storeKey: STORE.RECRUIT_PACKS,
    pruneMs: 0,
  });
  function recruitPackNames() {
    return Object.keys(RECRUIT_PACKS_LEDGER.ensure()).sort((a, b) => a.localeCompare(b));
  }
  function recruitPackRows(name) {
    const key = String(name == null ? '' : name);
    if (!key) return [];
    const root = RECRUIT_PACKS_LEDGER.ensure();
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
    const root = RECRUIT_PACKS_LEDGER.ensure();
    if (!Array.isArray(root[key])) root[key] = [];
    RECRUIT_PACKS_LEDGER.save();
    return key;
  }
  function recruitPackDelete(name) {
    const key = String(name == null ? '' : name);
    const root = RECRUIT_PACKS_LEDGER.ensure();
    if (!key || !root[key]) return false;
    delete root[key];
    RECRUIT_PACKS_LEDGER.save();
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
    RECRUIT_PACKS_LEDGER.save();
    return true;
  }
  function recruitPackRemoveRow(name, idx) {
    const rows = recruitPackRows(name);
    if (idx < 0 || idx >= rows.length) return false;
    rows.splice(idx, 1);
    RECRUIT_PACKS_LEDGER.save();
    return true;
  }
  function recruitPackFromTown(name, townId) {
    const key = recruitPackCreate(name);
    if (!key) return false;
    const src = batchRecruitTownList(townId);
    if (!src.length) return false;
    RECRUIT_PACKS_LEDGER.ensure()[key] = src.map(r => ({ unit: r.unit, amount: +r.amount || 0 }));
    RECRUIT_PACKS_LEDGER.save();
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
  const RECRUIT_TARGETS_LEDGER = boundedLedger({
    stateKey: 'recruitTargets',
    storeKey: STORE.RECRUIT_TARGETS,
    pruneMs: 0,
  });
  function recruitTargetTownMap(townId, create) {
    const root = RECRUIT_TARGETS_LEDGER.ensure();
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
    const root = RECRUIT_TARGETS_LEDGER.ensure();
    return Object.keys(root).filter(id => {
      const m = root[id];
      return m && typeof m === 'object' && !Array.isArray(m) && Object.keys(m).length;
    }).length;
  }
  function recruitTargetSet(townId, unit, amount) {
    const id = String(townId == null ? '' : townId);
    if (!id || !unit || !gbGameDataLookup('units', unit)) return false;
    const n0 = gbNum(amount);
    const n = n0 == null ? 0 : Math.max(0, Math.floor(n0));
    const map = recruitTargetTownMap(id, n > 0);
    if (n > 0) map[String(unit)] = n; else delete map[String(unit)];
    if (!Object.keys(map).length) delete RECRUIT_TARGETS_LEDGER.ensure()[id];
    RECRUIT_TARGETS_LEDGER.save();
    return true;
  }
  function recruitTargetClearTown(townId) {
    const id = String(townId == null ? '' : townId);
    const root = RECRUIT_TARGETS_LEDGER.ensure();
    if (!id || !root[id]) return false;
    delete root[id];
    RECRUIT_TARGETS_LEDGER.save();
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
        : 'sin objetivos \u2014 el reclutamiento automatico no tiene nada que reponer';
    }
  }
  function trainTargetRowText(townId, unit, tgt) {
    let have = null, queued = null;
    try { const counts = goalUnitCounts(townId); have = counts && Object.prototype.hasOwnProperty.call(counts, unit) ? +counts[unit] || 0 : (counts ? 0 : null); } catch (_) {}
    try { const q = recruitQueuedAmount(townId, unit); queued = Number.isFinite(+q) ? +q : null; } catch (_) {}
    const haveTxt = have == null ? '\u2014' : String(have);
    const qTxt = queued == null ? '\u2014' : String(queued);
    const missing = (have == null || queued == null) ? null : Math.max(0, tgt - have - queued);
    const missTxt = missing == null ? 'falta \u2014' : (missing > 0 ? `faltan ${missing}` : 'completo \u2713');
    return { text: `tiene ${haveTxt} \u00b7 en cola ${qTxt} \u00b7 ${missTxt}`, done: missing === 0 };
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
      opt.value = ''; opt.textContent = '\u2014 sin ciudades \u2014';
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
      opt.value = ''; opt.textContent = '\u2014 GameData no legible \u2014';
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
      e.textContent = 'sin objetivos en esta ciudad \u2014 elige unidad, cantidad y pulsa Fijar';
      rowsHost.appendChild(e);
    } else {
      keys.sort().forEach(unit => {
        const tgt = gbNum(map[unit]);
        if (tgt == null || !(tgt > 0)) return;
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
        del.textContent = '\ud83d\uddd1'; del.title = 'quitar objetivo';
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
    if (cur && RECRUIT_PACKS_LEDGER.ensure()[cur]) return cur;
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
      opt.value = ''; opt.textContent = '\u2014 sin packs \u2014';
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
      opt.value = ''; opt.textContent = '\u2014 GameData no legible \u2014';
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
      e.textContent = 'escribe un nombre y pulsa Nuevo \u2014 luego a\u00f1ade espada, arquero, birreme\u2026 al pack';
      rowsHost.appendChild(e);
    } else if (!rows.length) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#888;font-size:10px;padding:4px 0';
      e.textContent = 'pack vac\u00edo \u2014 elige unidad + cantidad y pulsa "+ unidad"';
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
        del.textContent = '\ud83d\uddd1'; del.title = 'quitar del pack';
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
      let txt = `pack "${name}": ${rows.length} unidad(es) \u00b7 ${parts.join(' / ') || 'gratis'}`;
      if (preview.missing && preview.missing.length) txt += ` (falta informaci\u00f3n de: ${preview.missing.join(', ')})`;
      else if (target !== '__all__') txt += preview.fits ? ' \u2192 cabe ahora \u2713' : ' \u2192 no cabe todav\u00eda';
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
      if (!name) { flash('nombre no v\u00e1lido'); return; }
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
      if (!recruitPackFromTown(raw, townId)) { flash('el lote de esa ciudad est\u00e1 vac\u00edo'); return; }
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
      if (!confirm(`\u00bfBorrar el pack "${name}"? Los lotes ya aplicados a las ciudades no se tocan.`)) return;
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
      if (!recruitPackRows(name).length) { flash('el pack est\u00e1 vac\u00edo'); return; }
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
        flash(`pack "${name}" aplicado (${n} l\u00ednea(s))`);
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
    let anyTown = false;
    try {
      const tlists = batchRecruitNormLists().towns || {};
      for (const townId of Object.keys(tlists)) {
        if (batchRecruitTownList(townId).length) { anyTown = true; break; }
      }
    } catch (_) {}
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
    } catch (_) {}
    if (!count) gbLogT('batch-recruit-idle', 180000, `batch recruit: idle (${scanReason(reason)})`);
  }
  const GB_WIDGET_DEFAULT_POS = { left: '8px', top: '60px' };
  const gbWidgets = Object.create(null);
  function gbWidgetGeom() {
    if (!state.widgetGeom || typeof state.widgetGeom !== 'object' || Array.isArray(state.widgetGeom)) state.widgetGeom = {};
    return state.widgetGeom;
  }
