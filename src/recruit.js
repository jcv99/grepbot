  // ---------- auto-recruit + spell cast (Phase 8.13 / 11.1) ----------
  // HIGH RISK — default OFF. Controller from unit metadata: barracks / harbor / temple.
  // Spells are a separate policy (recruitSpells) and never auto-picked blindly.
  const RECRUIT_SPELLS = ['call_of_the_ocean', 'spartan_training', 'fertility_improvement'];

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
    if (def.god || def.mythical || def.is_mythical) return { controller: 'building_place', feature: 'recruit' };
    // Some clients use building_barracks for land; harbor = building_docks
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
  function recruitCastSpell(townId, powerId, onDone) {
    if (!powerId || !RECRUIT_SPELLS.includes(powerId)) return onDone && onDone('bad-power');
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
  function recruitCanBuild(townId, unitId) {
    const def = recruitUnitDef(unitId);
    if (!def) return false;
    try {
      const uw = gameUw();
      const t = uw.ITowns.towns[townId];
      if (!t) return false;
      // Research / building requirements when present
      if (def.research_required || def.research_dependencies) {
        const info = typeof researchTownTechs === 'function' ? researchTownTechs(townId) : null;
        const need = def.research_required || def.research_dependencies;
        const list = Array.isArray(need) ? need : [need];
        for (const tech of list) {
          if (tech && info && info.techs && !info.techs[tech]) return false;
        }
      }
      if (def.god) {
        // Temple + matching god
        let temple = 0;
        try { temple = t.getBuildings ? +t.getBuildings().get('temple') : +(t.buildings().attributes || {}).temple; } catch (_) {}
        if (!(temple > 0)) return false;
      }
      if (def.is_naval || def.naval) {
        let docks = 0;
        try { docks = t.getBuildings ? +t.getBuildings().get('docks') : +(t.buildings().attributes || {}).docks; } catch (_) {}
        if (!(docks > 0)) return false;
      } else if (!def.god && !def.mythical) {
        let bar = 0;
        try { bar = t.getBuildings ? +t.getBuildings().get('barracks') : +(t.buildings().attributes || {}).barracks; } catch (_) {}
        if (!(bar > 0)) return false;
      }
      return true;
    } catch (_) { return false; }
  }
  function recruitScan(reason) {
    if (!hostEnabled() || !state.autoRecruit || captchaPaused('recruit')) return;
    if (automationPaused({})) return;
    if (gbLocked('recruit')) return;
    const targets = state.recruitTargets || {};
    const townIds = Object.keys(targets);
    if (!townIds.length) {
      gbLogT('recruit-empty', 300000, 'recruit: no town targets configured');
      return;
    }
    const uw = gameUw();
    let job = null;
    for (const tid of townIds) {
      const want = targets[tid];
      if (!want || typeof want !== 'object') continue;
      let t = null;
      try { t = uw.ITowns.towns[tid]; } catch (_) {}
      if (!t) continue;
      // Spells: only if explicitly configured power matches and not already cast
      if (state.recruitSpells) {
        const wantPower = (state.favorCfg && state.favorCfg.recruitPower) || null;
        // Without an explicit power id, do not cast — never default to ocean
        if (wantPower && RECRUIT_SPELLS.includes(wantPower) && !recruitHasSpell(tid, wantPower)
            && !captchaPausedAny('recruit', 'spell')) {
          job = { kind: 'spell', townId: tid, power: wantPower };
          break;
        }
      }
      let orders = 0;
      try {
        const col = t.getUnitOrdersCollection && t.getUnitOrdersCollection();
        orders = (col && col.models && col.models.length) || 0;
      } catch (_) {}
      if (orders >= 7) continue;
      const have = Object.assign({}, t.units && t.units());
      try {
        const outer = t.unitsOuter && t.unitsOuter();
        if (outer) Object.keys(outer).forEach(k => { have[k] = (have[k] || 0) + outer[k]; });
      } catch (_) {}
      for (const unit of Object.keys(want)) {
        const tgt = +want[unit] || 0;
        if (!(tgt > 0)) continue;
        if (!recruitCanBuild(tid, unit)) continue;
        if (!recruitControllerFor(unit)) continue;
        const cur = +have[unit] || 0;
        let queued = 0;
        try {
          const col = t.getUnitOrdersCollection && t.getUnitOrdersCollection();
          (col && col.models || []).forEach(m => {
            const a = m.attributes || {};
            if (a.unit_type === unit) queued += +a.count || 0;
          });
        } catch (_) {}
        const need = tgt - cur - queued;
        if (need <= 0) continue;
        let amount = need;
        try {
          const def = recruitUnitDef(unit);
          const r = t.resources();
          const pop = t.getAvailablePopulation();
          if (!def || !def.resources) {
            // Unknown cost must block — never resourceCost||1
            gbLogT('recruit-nocost', 120000, `recruit: unknown cost for ${unit}`);
            continue;
          }
          const rw = +def.resources.wood || 0;
          const rs = +def.resources.stone || 0;
          const ri = +def.resources.iron || 0;
          const rp = +def.population || 0;
          // Zero cost is valid; missing fields already defaulted to 0
          const byW = rw > 0 ? Math.floor(r.wood / rw) : amount;
          const byS = rs > 0 ? Math.floor(r.stone / rs) : amount;
          const byI = ri > 0 ? Math.floor(r.iron / ri) : amount;
          const byP = rp > 0 ? Math.floor(pop / rp) : amount;
          amount = Math.min(amount, byW, byS, byI, byP);
        } catch (_) { continue; }
        if (!(amount > 0)) continue;
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
    gbLock('recruit');
    if (job.kind === 'spell') {
      recruitCastSpell(job.townId, job.power, (err) => {
        gbUnlock('recruit');
        if (!err) gbLog(`spell: ${job.power} on ${job.townId}`);
        else gbLogT('spell-err', 60000, `spell err ${err}`);
      });
      return;
    }
    recruitBuild(job.townId, job.unit, job.amount, (err) => {
      gbUnlock('recruit');
      if (!err) gbLog(`recruit: town ${job.townId} ${job.amount}× ${job.unit}`);
      else gbLogT('recruit-err', 60000, `recruit err ${err}`);
    });
  }
