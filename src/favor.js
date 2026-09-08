  const FAVOR_GODS = ['zeus', 'poseidon', 'hera', 'athena', 'hades', 'ares', 'artemis', 'aphrodite'];
  function favorForGod(fav, god) {
    if (!fav || !god) return null;
    const g = String(god).toLowerCase();
    let v = gbNum(fav[g + '_favor']);
    if (v != null) return v;
    const ov = fav.production_overview;
    if (ov && ov[g]) { v = gbNum(ov[g].current); if (v != null) return v; }
    v = gbNum(fav[g]);
    if (v != null) return v;
    return gbNum(fav['favor_' + g]);
  }
  function favorGodsList(fav) {
    const seen = new Set();
    const ov = fav && fav.production_overview;
    if (ov && typeof ov === 'object') {
      Object.keys(ov).forEach(k => { const g = String(k).toLowerCase(); if (FAVOR_GODS.includes(g)) seen.add(g); });
    }
    for (const k of Object.keys(fav || {})) {
      const m = String(k).match(/^([a-z]+)_favor$/i);
      if (m && FAVOR_GODS.includes(m[1].toLowerCase())) seen.add(m[1].toLowerCase());
    }
    return seen.size ? Array.from(seen) : FAVOR_GODS.slice();
  }
  function favorMaxPool(fav) {
    if (!fav) return null;
    const v = gbNum(fav.max_favor);
    return v != null && v > 0 ? v : null;
  }
  function favorProdPerHour(fav, god) {
    if (!fav || !god) return null;
    const ov = fav.production_overview;
    const row = ov && ov[String(god).toLowerCase()];
    return row ? gbNum(row.production) : null;
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
    const threshN = gbNum(cfg.thresh);
    const thresh = threshN != null ? threshN : 200;
    const unit = cfg.unit;
    const maxC = Math.min(8, Math.max(1, +cfg.maxConcurrent || 2));
    const fav = favorCurrent();
    const god = cfg.god;
    if (!unit || !god) {
      gbLogT('favor-config', 300000, 'favor: set explicit favorCfg.unit and favorCfg.god');
      return;
    }

    const cur = favorForGod(fav, god);
    if (cur == null) {
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
    const targetType = cfg.targetType;
    if (!targetId || !targetType) {
      gbLogT('favor-notarget', 300000, 'favor: set explicit favorCfg.targetId and favorCfg.targetType');
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
        const n = gbNum(u[unit]);
        if (n == null) {
          gbLogT('favor-unit-unreadable', 180000, `favor: ${unit} count unreadable in town ${id}`);
          continue;
        }
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
    const destId = gbNum(targetId);
    if (destId == null) {
      gbLogT('favor-target-id', 60000, 'favor: target id unreadable - no post');
      return;
    }
    const favorLock = gbLock('favor', 180000);
    if (!favorLock) return;
    // Canonical Town/sendUnits only — never borrow attackTpl (per-feature templates).
    const srcId = gbNum(townId);
    if (srcId == null) {
      gbUnlock('favor', favorLock);
      gbLogT('favor-town-id', 60000, 'favor: townId unreadable — no post');
      return;
    }
    const payload = {
      model_url: 'Town/' + srcId,
      action_name: 'sendUnits',
      arguments: Object.assign({ id: destId, type: 'attack' }, units),
      town_id: srcId,
    };
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
