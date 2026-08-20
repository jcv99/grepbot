  // Declared with their only consumer (they used to sit at the tail of
  // merchant.js, which never mentions favor).
  const FAVOR_TEMPLE_PLUNDER = /temple_plunder|plunder_temple|templeplunder|saqueo.?templo|plunderung.?tempel/i;
  const favorOwnMoves = Object.create(null);
  // Automation stays off until a canonical safe target/action contract exists
  // (see v1.6.0). A flag instead of an early `return` keeps the implementation
  // reachable code that the build gates and reviewers actually check.
  const FAVOR_AUTOMATION_ENABLED = false;
  function favorCurrent() {
    try {
      const uw = gameUw();
      const gods = (uw.Game && uw.Game.gods) || (uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('PlayerGods'));
      if (!gods) return {};
      const a = gods.attributes || gods;
      return a;
    } catch (_) { return {}; }
  }
  // PlayerGods attribute names, read out of the live client bundle
  // (GameModels.PlayerGods): the per-god pool is `<god>_favor` (the model fires
  // `change:<god>_favor`), the cap is a single `max_favor` shared by every god,
  // and `production_overview` is `{ <god>: { current, production } }` with
  // production in favor/hour. The old `fav[god]` / `fav['favor_' + god]` pair
  // matched NONE of them, so every pool read came back unreadable: the HUD
  // printed `favor (dioses) no legible`, Preflight reported `0/8 pozos
  // legibles`, and recruit refused every mythical unit it was asked to build.
  // Unreadable still returns null - a fabricated pool would spend favor the
  // player never asked to spend.
  const FAVOR_GODS = ['zeus', 'poseidon', 'hera', 'athena', 'hades', 'ares', 'artemis', 'aphrodite'];
  function favorNum(v) { const n = +v; return Number.isFinite(n) ? n : null; }
  function favorForGod(fav, god) {
    if (!fav || !god) return null;
    const g = String(god).toLowerCase();
    let v = favorNum(fav[g + '_favor']);
    if (v != null) return v;
    const ov = fav.production_overview;
    if (ov && ov[g]) { v = favorNum(ov[g].current); if (v != null) return v; }
    // Legacy shapes kept as probes, never as the primary: some older builds
    // exposed the pool flat. A miss here is UNKNOWN, not zero.
    v = favorNum(fav[g]);
    if (v != null) return v;
    return favorNum(fav['favor_' + g]);
  }
  function favorMaxPool(fav) {
    if (!fav) return null;
    const v = favorNum(fav.max_favor);
    return v != null && v > 0 ? v : null;
  }
  // favor/hour straight off the model. The HUD only ever MEASURED a rate from
  // paired samples, which needs two observations and 10 minutes; this is the
  // client's own number and is exact the first time it is read.
  function favorProdPerHour(fav, god) {
    if (!fav || !god) return null;
    const ov = fav.production_overview;
    const row = ov && ov[String(god).toLowerCase()];
    return row ? favorNum(row.production) : null;
  }
  // Gods the model actually names. Falls back to the known roster only to look
  // them up - never to invent a pool the account does not have.
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
      gbLogT('favor-disabled-v160', 300000, 'favor: automation disabled in 1.6.0 — no canonical safe target/action contract available');
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

    // `fav.favor` is whichever god the client happens to expose as "current" —
    // reading it as this god's pool compared the wrong number against the
    // threshold and either farmed favor that was already full or refused to.
    // Unreadable pool is UNKNOWN: do not spend units on a guess.
    const cur = favorForGod(fav, god);
    if (cur == null) {
      gbLogT('favor-unreadable', 300000, `favor: ${god} pool unreadable — no send`);
      return;
    }

    if (cur >= thresh && !cfg.force) {
      gbLogT('favor-ok', 180000, `favor: ${god}=${cur} ≥ ${thresh}`);
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
      gbLogT('favor-enroute', 120000, `favor: ${enroute} own en-route (≥${maxC})`);
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
        gbLogT('favor-timeout', 60000, 'favor: timeout_unknown — not retrying');
        return;
      }
      if (!err) {
        const mid = (data && (data.command_id || data.id || data.movement_id)) || ('f' + Date.now());
        favorOwnMoves[String(mid)] = Date.now();
        gbLog(`favor: sent ${JSON.stringify(units)} from ${townId} → ${targetId}`);
      } else gbLogT('favor-err', 60000, `favor err ${err}`);
    });
  }
