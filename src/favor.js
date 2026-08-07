  // ---------- favor plunder (Phase 8.10 + 11.3) ----------
  // HIGH RISK - default OFF. Mythical units can plunder favor only with
  // Temple Plunder research. Requires god/unit/target and tracks own sends.
  const FAVOR_CHECK_MS = 60000;
  const FAVOR_TEMPLE_PLUNDER = /temple_plunder|plunder_temple|templeplunder|saqueo.?templo|plunderung.?tempel/i;
  // movement ids we created - only these count as "en route"
  const favorOwnMoves = Object.create(null);

  function favorCurrent() {
    try {
      const uw = gameUw();
      const gods = (uw.Game && uw.Game.gods) || (uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('PlayerGods'));
      if (!gods) return {};
      const a = gods.attributes || gods;
      return a;
    } catch (_) { return {}; }
  }
  function favorHasTemplePlunder(townId) {
    try {
      const info = typeof researchTownTechs === 'function' ? researchTownTechs(townId) : null;
      if (!info || !info.techs) return false;
      const techs = info.techs;
      for (const k of Object.keys(techs)) {
        if (!techs[k]) continue;
        if (k === 'temple_plunder' || FAVOR_TEMPLE_PLUNDER.test(k)) return true;
      }
      // Also accept GameData research id lookup by name
      try {
        const uw = gameUw();
        const res = uw.GameData && uw.GameData.researches;
        if (res) {
          for (const k of Object.keys(techs)) {
            if (!techs[k]) continue;
            const r = res[k];
            if (r && FAVOR_TEMPLE_PLUNDER.test(String(r.name || r.title || ''))) return true;
          }
        }
      } catch (_) {}
      return false;
    } catch (_) { return false; }
  }
  function favorUnitOk(unit, god) {
    try {
      const uw = gameUw();
      const def = uw.GameData && uw.GameData.units && uw.GameData.units[unit];
      if (!def) return false;
      if (!def.god && !def.mythical && !def.is_mythical) return false;
      if (def.god && god && String(def.god).toLowerCase() !== String(god).toLowerCase()) return false;
      return true;
    } catch (_) { return false; }
  }
  function favorScan(reason) {
    if (!hostEnabled() || !state.autoFavor || captchaPaused('favor')) return;
    if (automationPaused({})) return;
    // farm_town + Town/sendUnits is not valid for temple plunder - module disabled until rewritten
    gbLogT('favor-disabled', 300000,
      'favor: module disabled (needs enemy-town target + canonical temple_plunder payload)');
    return;
    if (gbLocked('favor')) return;
    const cfg = state.favorCfg || {};
    const thresh = +cfg.thresh || 200;
    const unit = cfg.unit || 'harpy';
    const maxC = Math.min(8, Math.max(1, +cfg.maxConcurrent || 2));
    const fav = favorCurrent();
    const god = cfg.god || 'athena';
    const cur = +(fav[god] || fav['favor_' + god] || fav.favor || 0);
    // If we already have enough favor, idle
    if (cur >= thresh && !cfg.force) {
      gbLogT('favor-ok', 180000, `favor: ${god}=${cur} >= ${thresh}`);
      return;
    }
    if (!favorUnitOk(unit, god)) {
      gbLogT('favor-unit', 300000, `favor: unit ${unit} incompatible with god ${god}`);
      return;
    }
    // Target: configured farm-town / BP village id only - never a bare player town guess
    const targetId = cfg.targetId;
    const targetType = cfg.targetType || 'farm_town';
    if (!targetId) {
      gbLogT('favor-notarget', 300000, 'favor: set favorCfg.targetId (farm town)');
      return;
    }
    if (targetType !== 'farm_town' && targetType !== 'farm' && targetType !== 'village') {
      gbLogT('favor-badtarget', 300000, `favor: targetType=${targetType} not allowed (need farm_town)`);
      return;
    }
    const uw = gameUw();
    // Count only movements we registered
    let enroute = 0;
    const now = Date.now();
    Object.keys(favorOwnMoves).forEach(k => {
      if (favorOwnMoves[k] + 3600000 < now) delete favorOwnMoves[k];
      else enroute++;
    });
    if (enroute >= maxC) {
      gbLogT('favor-enroute', 120000, `favor: ${enroute} own en-route (>=${maxC})`);
      return;
    }
    // Pick a town with myth units + Temple Plunder + spare above defense floor
    let townId = null, units = null;
    try {
      for (const id of Object.keys((uw.ITowns && uw.ITowns.towns) || {})) {
        if (!favorHasTemplePlunder(id)) continue;
        const t = uw.ITowns.towns[id];
        const u = Object.assign({}, t.units && t.units());
        const n = +u[unit] || 0;
        const floor = +state.dodgeFloor || 0;
        if (n <= floor) continue;
        const send = {};
        send[unit] = Math.min(n - floor, cfg.perSend || 5);
        if (!(send[unit] > 0)) continue;
        townId = id;
        units = send;
        break;
      }
    } catch (_) {}
    if (!townId || !units) {
      gbLogT('favor-nounits', 180000, `favor: no ${unit} with temple_plunder above floor`);
      return;
    }
    gbLock('favor');
    const tpl = state.attackTpl;
    const payload = {
      model_url: (tpl && tpl.model_url) || ('Town/' + townId),
      action_name: (tpl && tpl.action_name) || 'sendUnits',
      arguments: Object.assign({ id: +targetId, type: 'attack' }, units),
      town_id: +townId,
    };
    payload.model_url = String(payload.model_url).replace(/Town\/\d+/, 'Town/' + townId);
    bridgePost('favor', payload, (err, data) => {
      gbUnlock('favor');
      if (err === 'timeout') {
        gbLogT('favor-timeout', 60000, 'favor: timeout_unknown - not retrying');
        return;
      }
      if (!err) {
        const mid = (data && (data.command_id || data.id || data.movement_id)) || ('f' + Date.now());
        favorOwnMoves[String(mid)] = Date.now();
        gbLog(`favor: sent ${JSON.stringify(units)} from ${townId} -> ${targetId}`);
      } else gbLogT('favor-err', 60000, `favor err ${err}`);
    });
  }
