  function favorHasTemplePlunder(townId) {
    try {
      const info = typeof researchTownTechs === 'function' ? researchTownTechs(townId) : null;
      if (!info || !info.techs) return false;
      const techs = info.techs;
      for (const k of Object.keys(techs)) {
        if (!techs[k]) continue;
        if (k === 'temple_plunder' || FAVOR_TEMPLE_PLUNDER.test(k)) return true;
      }

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
    if (!state.autoFavor) return;
    if (!FAVOR_AUTOMATION_ENABLED) {
      gbLogT('favor-disabled-v160', 300000, 'favor: automation disabled in 1.6.0 \u2014 no canonical safe target/action contract available');
      return;
    }
    if (!hostEnabled() || captchaPaused('favor')) return;
    if (automationPaused({})) return;
    if (gbLocked('favor')) return;
    const cfg = state.favorCfg || {};
    const thresh = +cfg.thresh || 200;
    const unit = cfg.unit || 'harpy';
    const maxC = Math.min(8, Math.max(1, +cfg.maxConcurrent || 2));
    const fav = favorCurrent();
    const god = cfg.god || 'athena';

    const raw = fav[god] != null ? fav[god] : fav['favor_' + god];
    const cur = Number(raw);
    if (!Number.isFinite(cur)) {
      gbLogT('favor-unreadable', 300000, `favor: ${god} pool unreadable \u2014 no send`);
      return;
    }

    if (cur >= thresh && !cfg.force) {
      gbLogT('favor-ok', 180000, `favor: ${god}=${cur} \u2265 ${thresh}`);
      return;
    }
    if (!favorUnitOk(unit, god)) {
      gbLogT('favor-unit', 300000, `favor: unit ${unit} incompatible with god ${god}`);
      return;
    }

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

    let enroute = 0;
    const now = Date.now();
    Object.keys(favorOwnMoves).forEach(k => {
      if (favorOwnMoves[k] + 3600000 < now) delete favorOwnMoves[k];
      else enroute++;
    });
    if (enroute >= maxC) {
      gbLogT('favor-enroute', 120000, `favor: ${enroute} own en-route (\u2265${maxC})`);
      return;
    }

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
    const favorLock = gbLock('favor', 180000);
    if (!favorLock) return;
    const tpl = state.attackTpl;
    const payload = {
      model_url: (tpl && tpl.model_url) || ('Town/' + townId),
      action_name: (tpl && tpl.action_name) || 'sendUnits',
      arguments: Object.assign({ id: +targetId, type: 'attack' }, units),
      town_id: +townId,
    };
    payload.model_url = String(payload.model_url).replace(/Town\/\d+/, 'Town/' + townId);
    bridgePost('favor', payload, (err, data) => {
      gbUnlock('favor', favorLock);
      if (err === 'timeout' || err === 'timeout_unknown' || err === 'pending') {
        gbLogT('favor-timeout', 60000, 'favor: timeout_unknown \u2014 not retrying');
        return;
      }
      if (!err) {
        const mid = (data && (data.command_id || data.id || data.movement_id)) || ('f' + Date.now());
        favorOwnMoves[String(mid)] = Date.now();
        gbLog(`favor: sent ${JSON.stringify(units)} from ${townId} \u2192 ${targetId}`);
      } else gbLogT('favor-err', 60000, `favor err ${err}`);
    });
  }

  const GODSPELL_DEFAULT_COOLDOWN_MS = 30 * 60 * 1000;
  function godSpellCooldown(townId, powerId) {
    return recruitSpellCooldown(townId, powerId);
  }
