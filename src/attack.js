  function serverNow() {
    const uw = gameUw();
    try {
      if (uw.Timestamp && typeof uw.Timestamp.now === 'function') return uw.Timestamp.now();
      if (uw.Timestamp && typeof uw.Timestamp.server === 'function') return uw.Timestamp.server();
    } catch (_) {}
    return Math.floor(Date.now() / 1000);
  }
  function clientServerSkewMs() {
    const uw = gameUw();
    try {
      if (typeof uw.Timestamp.clientServerDiff === 'function') return uw.Timestamp.clientServerDiff() * 1000;
      if (uw.Timestamp.clientServerDiff != null) return Number(uw.Timestamp.clientServerDiff) * 1000;
    } catch (_) {}
    try {
      const srv = serverNow();
      return Date.now() - srv * 1000;
    } catch (_) { return 0; }
  }
  function runtimeSetupTime() {
    const uw = gameUw();
    try {
      const t = uw.Game && uw.Game.constants && uw.Game.constants.units && uw.Game.constants.units.runtime_setup_time;
      if (t != null) return +t;
    } catch (_) {}
    try {
      const gs = (uw.Game && uw.Game.game_speed) || 1;
      return Math.max(60, Math.floor(900 / gs));
    } catch (_) { return 225; }
  }
  function unitMeta(id) {
    const uw = gameUw();
    try { return (uw.GameData && uw.GameData.units && uw.GameData.units[id]) || null; } catch (_) { return null; }
  }
  function townLiveUnits(townId) {
    const uw = gameUw();
    try {
      const t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]);
      if (!t || !t.units) return {};
      return Object.assign({}, t.units());
    } catch (_) { return {}; }
  }
  function townCoords(townId) {
    const list = state.towns || [];
    const t = list.find(x => String(x.id) === String(townId));
    if (t && t.x != null && t.y != null) return { x: +t.x, y: +t.y, island: t.island };
    try {
      const game = townsFromGame() || [];
      const g = game.find(x => String(x.id) === String(townId));
      if (g) return { x: +g.x, y: +g.y, island: g.island };
    } catch (_) {}
    return { x: null, y: null, island: null };
  }
  function islandDistance(ax, ay, bx, by) {
    if (ax == null || ay == null || bx == null || by == null) return null;
    const dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function slowestLandSpeed(units) {
    let min = Infinity;
    Object.keys(units || {}).forEach(id => {
      if (!units[id]) return;
      const m = unitMeta(id);
      if (!m || m.is_naval) return;
      if (id === 'militia') return;
      const sp = m.speed;
      if (sp != null && sp > 0 && sp < min) min = sp;
    });
    return min === Infinity ? null : min;
  }
  function computeTravelSeconds(srcTownId, target, units, requireCanonical) {
    const uw = gameUw();

    try {
      if (uw.UnitTimeToArrival && typeof uw.UnitTimeToArrival.calculateTimeToArrival === 'function') {
        const t = uw.UnitTimeToArrival.calculateTimeToArrival(units, srcTownId, +target.vill_id || target.id);
        if (t && t > 0) return Math.floor(t);
      }
    } catch (_) {}
    try {
      if (uw.GameDataUnits && typeof uw.GameDataUnits.getUnitRuntimes === 'function') {
        const src = townCoords(srcTownId);
        const dist = islandDistance(src.x, src.y, target.x, target.y);
        if (dist != null) {
          const rt = uw.GameDataUnits.getUnitRuntimes(units, dist);
          if (rt && rt > 0) return Math.floor(rt);
        }
      }
    } catch (_) {}
    if (requireCanonical) return null; // heuristic runtime is preview-only; never arm arrive-at from it
    const src = townCoords(srcTownId);
    const dist = islandDistance(src.x, src.y, target.x, target.y);
    if (dist == null) return null;
    const speed = slowestLandSpeed(units);
    if (!speed) return null;
    return Math.max(1, Math.floor(dist * 50 / speed) + runtimeSetupTime());
  }
  function isSameIsland(srcTownId, target) {
    const src = townCoords(srcTownId);
    if (src.island != null && target.island != null) return String(src.island) === String(target.island);
    if (src.x != null && target.x != null && src.y != null && target.y != null) {
      return +src.x === +target.x && +src.y === +target.y;
    }
    return false;
  }
  function boatCapacityCheck(units, sameIsland) {
    const uw = gameUw();
    const land = {};
    const boats = {};
    let needPop = 0;
    let cap = 0;
    Object.keys(units || {}).forEach(id => {
      const n = +units[id] || 0;
      if (!n) return;
      const m = unitMeta(id);
      if (!m) return;
      if (m.is_naval || (m.capacity != null && m.capacity > 0 && !m.population)) {
        boats[id] = n;
        const c = (m.capacity || 0) + (m.berth || 0);
        cap += c * n;
      } else if (!m.is_naval && id !== 'militia') {
        land[id] = n;
        needPop += (m.population || 1) * n;
      }
    });
    if (!Object.keys(land).length) return { ok: true, need: 0, cap, sameIsland: !!sameIsland, reason: 'naval-only' };
    if (sameIsland && !Object.keys(boats).length) return { ok: true, need: needPop, cap: 0, sameIsland: true, reason: 'same-island' };
    try {
      if (uw.GameDataUnits && typeof uw.GameDataUnits.calculateCapacity === 'function') {
        const r = uw.GameDataUnits.calculateCapacity(units);
        if (r && typeof r === 'object') {
          const need = r.needed_capacity != null ? r.needed_capacity : needPop;
          const have = r.total_capacity != null ? r.total_capacity : cap;
          return { ok: have >= need, need, cap: have, sameIsland: !!sameIsland, reason: have >= need ? 'ok' : 'under-boated' };
        }
      }
    } catch (_) {}
    if (!Object.keys(boats).length && !sameIsland) return { ok: false, need: needPop, cap: 0, sameIsland: false, reason: 'no-boats' };
    return { ok: cap >= needPop, need: needPop, cap, sameIsland: !!sameIsland, reason: cap >= needPop ? 'ok' : 'under-boated' };
  }
  // Thin cross-feature wrapper (v4 plan 2.12). Existing callers of
  // boatCapacityCheck read the raw shape and are deliberately untouched.
  function attackBoatViaCalc(units, sameIsland) {
    return gbLootEstimate({ kind: 'attack-boat', units, sameIsland });
  }
  function classifyUnitFn(id) {
    const m = unitMeta(id);
    if (!m) return 'unknown';
    // A hoplite remains available to defensive plans, but it must not disappear
    // from an offensive composition merely because a world labels it defensive.
    if (id === 'hoplite') return 'both';
    const f = m.unit_function;
    if (f === 'function_off' || f === 'off') return 'offense';
    if (f === 'function_def' || f === 'def') return 'defense';
    if (f === 'function_both' || f === 'both') return 'both';
    if (m.is_naval) return 'naval';
    if (id === 'militia') return 'militia';
    if (/^(slinger|rider|chariot|catapult|minotaur|manticore|cyclops?|zyklop|harpy|erinys|giant)$/.test(id)) return 'offense';
    if (/^(sword|archer|hoplite|centaur|pegasus|cerberus|calydonian|medusa)$/.test(id)) return 'defense';
    return 'both';
  }
  function selectUnitsForTown(townId, troopMode, unitType, perTownMap, harassPreset) {
    const live = townLiveUnits(townId);
    const out = {};
    if (troopMode === 'harass') return selectHarassmentUnits(townId, harassPreset || 'light');
    if (troopMode === 'per_town') {
      const custom = (perTownMap && perTownMap[townId]) || {};
      Object.keys(custom).forEach(k => {
        const want = +custom[k] || 0;
        const have = +live[k] || 0;
        if (want > 0 && have > 0) out[k] = Math.min(want, have);
      });
      return out;
    }
    if (troopMode === 'all_of_type' && unitType) {
      const have = +live[unitType] || 0;
      if (have > 0) out[unitType] = have;

      const m = unitMeta(unitType);
      if (m && !m.is_naval) {
        Object.keys(live).forEach(id => {
          const um = unitMeta(id);
          if (um && um.capacity > 0 && live[id] > 0) out[id] = live[id];
        });
      }
      return out;
    }
    Object.keys(live).forEach(id => {
      const n = +live[id] || 0;
      if (!n) return;
      if (id === 'militia') return;
      const m = unitMeta(id);
      if (!m) return;
      if (troopMode === 'all') {
        out[id] = n;
        return;
      }
      if (m.is_naval && (troopMode === 'offense' || troopMode === 'defense')) {

        if (m.capacity > 0) out[id] = n;
        return;
      }
      const fn = classifyUnitFn(id);
      if (troopMode === 'offense' && (fn === 'offense' || fn === 'both')) out[id] = n;
      if (troopMode === 'defense' && (fn === 'defense' || fn === 'both')) out[id] = n;
    });
    return out;
  }
  function defaultAttackPlan() {
    // v4 plan 7.1: staged shared-plan candidates. Never auto-armed.

    return {
      targetId: '',
      targetType: 'town',
      targetX: null,
      targetY: null,
      mission: 'attack',
      timingMode: 'send_now',
      arrivalUnix: null,
      latencyPadMs: 200,
      staggerMs: 25,
      troopMode: 'offense',
      harassPreset: 'light',
      unitType: 'sword',
      sourceTownIds: null,
      perTownUnits: {},
    };
  }
  function ensureAttackPlan() {
    const d = defaultAttackPlan();
    if (!state.attackPlan || typeof state.attackPlan !== 'object' || Array.isArray(state.attackPlan)) state.attackPlan = d;
    else {
      for (const [k, v] of Object.entries(d)) if (state.attackPlan[k] === undefined) state.attackPlan[k] = Array.isArray(v) ? v.slice() : (v && typeof v === 'object' ? Object.assign({}, v) : v);
    }
    return state.attackPlan;
  }
  function saveAttackPlan() {
    save(STORE.ATTACK_PLAN, state.attackPlan);
  }
  function attackRememberTarget(id, meta) {
    if (id == null || id === '') return;
    const sid = String(id);
    if (!/^\d+$/.test(sid)) return;
    if (!Array.isArray(state.attackRecent)) state.attackRecent = [];
    state.attackRecent = state.attackRecent.filter(t => String(t.id) !== sid);
    state.attackRecent.unshift(Object.assign({ id: sid, ts: Date.now(), src: 'learned' }, meta || {}));
    if (state.attackRecent.length > 40) state.attackRecent.length = 40;
    save(STORE.ATTACK_RECENT, state.attackRecent);
  }
  function attackKnownTargets() {
    const map = new Map();
    const add = (t, src) => {
      if (!t || t.id == null || t.id === '') return;
      const id = String(t.id);
      if (!/^\d+$/.test(id)) return;
      const prev = map.get(id);
      const entry = {
        id, name: t.name || (prev && prev.name) || null,
        x: t.x != null ? t.x : (prev && prev.x != null ? prev.x : null),
        y: t.y != null ? t.y : (prev && prev.y != null ? prev.y : null),
        src: (prev && prev.src) || src, ts: +t.ts || (prev && +prev.ts) || 0,
      };
      if (!prev || (+t.ts || 0) >= (+prev.ts || 0)) map.set(id, entry);
    };
    for (const f of (state.findings || [])) {
      if (f.town && f.town.id != null) add(Object.assign({}, f.town, { ts: f.ts }), 'report');
    }
    for (const t of (state.attackRecent || [])) add(t, t.src || 'recent');
    for (const h of (state.attackHistory || [])) if (h.targetId) add({ id: h.targetId, ts: h.ts }, 'history');
    for (const w of (state.watchlist || [])) {
      const id = w && (w.id || w.townId || w);
      if (id != null) add({ id, name: w && w.name, ts: 0 }, 'watch');
    }
    const tpl = state.attackTpl;
    const learnedId = tpl && tpl.arguments && tpl.arguments.id;
    if (learnedId != null) add({ id: learnedId, ts: tpl.learned_at || 0 }, 'template');
    return Array.from(map.values()).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }
  function ensureAttackPlanTargets() {
    const p = ensureAttackPlan();
    if (!Array.isArray(p.targets)) p.targets = [];
    return p.targets;
  }
  function applyAttackTarget(t) {
    if (!t || t.id == null || !/^\d+$/.test(String(t.id))) return false;
    const plan = ensureAttackPlan();
    plan.targetId = String(t.id);
    plan.targetType = 'town';
    if (t.x != null && Number.isFinite(+t.x)) plan.targetX = +t.x;
    if (t.y != null && Number.isFinite(+t.y)) plan.targetY = +t.y;
    attackRememberTarget(t.id, { name: t.name || null, x: t.x, y: t.y, src: t.src || 'picker' });
    saveAttackPlan();
    renderAttack();
    flash('target -> ' + (t.name ? `${t.name} (#${t.id})` : String(t.id)));
    return true;
  }
  function attackTownGroup(name) { return ((state.townGroups && state.townGroups[name]) || []).map(String); }
  function attackSetTownRole(name, townId, on) {
    if (!state.townGroups) state.townGroups = {};
    const sid = String(townId);
    const ids = new Set(attackTownGroup(name));
    if (on) ids.add(sid); else ids.delete(sid);
    state.townGroups[name] = Array.from(ids);
    save(STORE.TOWN_GROUPS, state.townGroups);
  }
  function attackSelectSources(ids) {
    const plan = ensureAttackPlan();
    plan.sourceTownIds = (ids || []).map(String);
    saveAttackPlan(); renderAttack();
  }
  function attackSetAllSources(checked) {
    attackSelectSources(checked ? (state.towns || []).map(t => String(t.id)) : []);
    flash(checked ? 'all towns selected' : 'sources cleared');
  }
  function attackSelectRoleSources(role) {
    const ids = attackTownGroup(role);
    if (!ids.length) { flash('sin ciudades con este rol'); return; }
    attackSelectSources(ids);
    flash(`${role === ATTACK_ROLE_OFFENSE ? 'ofensiva' : 'defensa'} ciudades seleccionadas (${ids.length})`);
  }
  function renderAttackRoles(sec) {
    const box = sec && sec.querySelector('.atk-roles');
    if (!box) return;
    const towns = state.towns || [];
    const off = new Set(attackTownGroup(ATTACK_ROLE_OFFENSE));
    const def = new Set(attackTownGroup(ATTACK_ROLE_DEFENSE));
    const sig = towns.map(t => t.id + ':' + (t.name || '')).join('|') + '|O:' + [...off].sort().join(',') + '|D:' + [...def].sort().join(',');
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig; box.replaceChildren();
    if (!towns.length) { const e = document.createElement('div'); e.textContent = 'load towns first'; e.style.cssText = 'color:#666;font-size:10px'; box.appendChild(e); return; }
    const mk = (title, role, color, set) => {
      const col = document.createElement('div');
      const h = document.createElement('div'); h.textContent = title; h.style.cssText = `font-size:9px;color:${color};font-weight:bold`; col.appendChild(h);
      towns.forEach(t => {
        const lab = document.createElement('label'); lab.style.cssText = 'display:flex;align-items:center;gap:3px;font-size:10px;cursor:pointer';
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = set.has(String(t.id));
        cb.addEventListener('change', () => { attackSetTownRole(role, t.id, cb.checked); renderAttackRoles(sec); });
        lab.appendChild(cb); lab.appendChild(document.createTextNode((t.name || t.id).slice(0, 18))); col.appendChild(lab);
      });
      return col;
    };
    const grid = document.createElement('div'); grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px';
    grid.appendChild(mk('Offensive cities', ATTACK_ROLE_OFFENSE, '#f96', off));
    grid.appendChild(mk('Defensive cities', ATTACK_ROLE_DEFENSE, '#6cf', def));
    box.appendChild(grid);
  }
  function parseUnitsArea(text) {
    const units = {};
    String(text || '').split('\n').forEach(l => {
      const m = l.trim().match(/^(\w+)\s*:\s*(\d+)/);
      if (m) units[m[1]] = +m[2];
    });
    return units;
  }
  function unitsToArea(units) {
    return Object.entries(units || {}).map(([k, v]) => `${k}:${v}`).join('\n');
  }
  function resolveTarget(plan) {
    const id = String(plan.targetId || '').trim();
    if (!id) return null;
    const explicitType = String(plan.targetType || '').toLowerCase().trim();
    if ((explicitType === 'town' || explicitType === 'player_town') && !/^\d+$/.test(id)) {
      gbLogT('atk-target-id', 30000, `attack: town target id must be numeric (${id.slice(0, 40)}) — blocked`);
      return null;
    }
    let x = plan.targetX, y = plan.targetY, island = null;
    let kind = explicitType || null;

    const ownTown = (state.towns || []).find(t => String(t.id) === id);
    if (ownTown) {
      if (!/^\d+$/.test(id)) return null;
      kind = kind || 'town';
      x = x ?? ownTown.x; y = y ?? ownTown.y; island = ownTown.island;
      return { id, vill_id: null, town_id: id, kind: 'town', x: x != null ? +x : null, y: y != null ? +y : null, island };
    }
    try {
      const uw = gameUw();
      if (uw.ITowns && uw.ITowns.towns && uw.ITowns.towns[id]) {
        if (!/^\d+$/.test(id)) return null;
        kind = kind || 'town';
        return { id, vill_id: null, town_id: id, kind: 'town', x: x != null ? +x : null, y: y != null ? +y : null, island };
      }
    } catch (_) {}

    const farm = (state.farmsParsed || []).find(f => String(f.vill_id) === id || String(f.id) === id);
    if (farm) {
      kind = kind || 'farm_town';
      x = x ?? farm.x; y = y ?? farm.y;
      return { id, vill_id: id, town_id: null, kind: 'farm_town', x: x != null ? +x : null, y: y != null ? +y : null, island };
    }

    if (!kind) {
      gbLogT('atk-target', 30000, `attack: id ${id} has no canonical type — blocked`);
      return null;
    }
    if (kind === 'farm_town' || kind === 'farm' || kind === 'village') {
      return { id, vill_id: id, town_id: null, kind: 'farm_town', x: x != null ? +x : null, y: y != null ? +y : null, island };
    }
    if (kind === 'town' || kind === 'player_town') {
      return { id, vill_id: null, town_id: id, kind: 'town', x: x != null ? +x : null, y: y != null ? +y : null, island };
    }
    gbLogT('atk-target', 30000, `attack: unsupported targetType=${kind}`);
    return null;
  }
  function attackSendAllowed(target) {
    if (!target || !target.kind) return false;

    if (target.kind === 'farm_town') return false;
    return target.kind === 'town' && target.town_id;
  }
  function attackIsOwnTown(townId) {
    const id = String(townId == null ? '' : townId);
    if (!id) return false;
    if ((state.towns || []).some(t => String(t.id) === id)) return true;
    try {
      const uw = gameUw();
      if (uw.ITowns && uw.ITowns.towns && uw.ITowns.towns[id]) return true;
    } catch (_) {}
    return false;
  }
  function selectHarassmentUnits(townId, preset) {
    const live = townLiveUnits(townId);
    const out = {};
    const key = String(preset || 'light');
    const cap = HARASS_CAPS[key] != null ? HARASS_CAPS[key] : Math.max(1, Math.floor(+preset || 5));
    if (key === '1sling' || key === '5sling') {
      const have = +live.slinger || 0;
      if (have > 0) out.slinger = Math.min(have, cap);
      return out;
    }
    let left = cap;
    for (const id of HARASS_PREF) {
      if (left <= 0) break;
      const have = +live[id] || 0;
      if (!(have > 0)) continue;
      const n = Math.min(have, left); out[id] = n; left -= n;
    }
    return out;
  }
  function attackAddMinimumTransports(townId, units) {
    const out = Object.assign({}, units || {});
    let need = 0;
    for (const [id, raw] of Object.entries(out)) {
      const n = +raw || 0;
      const m = unitMeta(id);
      if (!n || !m || m.is_naval || id === 'militia') continue;
      need += (+m.population || 1) * n;
    }
    if (!(need > 0)) return out;
    const live = townLiveUnits(townId);
    const choices = Object.keys(live).map(id => ({ id, n: +live[id] || 0, m: unitMeta(id) }))
      .filter(x => x.n > 0 && x.m && +x.m.capacity > 0)
      .sort((a, b) => (+b.m.capacity || 0) - (+a.m.capacity || 0));
    let cap = 0;
    for (const x of choices) {
      if (cap >= need) break;
      const per = +x.m.capacity || 0;
      if (!(per > 0)) continue;
      const take = Math.min(x.n, Math.max(1, Math.ceil((need - cap) / per)));
      out[x.id] = (out[x.id] || 0) + take;
      cap += take * per;
    }
    return out;
  }
  function attackUnitsForTarget(townId, target, plan) {
    let units = selectUnitsForTown(townId, plan.troopMode, plan.unitType, plan.perTownUnits, plan.harassPreset);
    if (plan.troopMode === 'harass' && !isSameIsland(townId, target)) units = attackAddMinimumTransports(townId, units);
    return units;
  }
  function applyHarassPreset(preset) {
    const plan = ensureAttackPlan();
    plan.troopMode = 'harass';
    plan.harassPreset = String(preset || 'light');
    if (!ATTACK_GENERIC_MISSIONS.has(String(plan.mission || 'attack').toLowerCase())) plan.mission = 'attack';
    saveAttackPlan();
    gbLog('attack: harass preset ' + plan.harassPreset);
    flash('preset de acoso: ' + plan.harassPreset + ' (manual confirmation still required)');
    return plan;
  }
  function buildAttackSchedule(plan) {
    const target = resolveTarget(plan);
    if (!target) return { error: 'no target', rows: [] };
    let sources = Array.isArray(plan.sourceTownIds)
      ? plan.sourceTownIds.map(String)
      : (state.towns || []).map(t => String(t.id));
    if (!sources.length) return { error: 'no source towns selected', rows: [] };
    const now = serverNow();
    const skew = clientServerSkewMs();
    const rows = sources.map((townId, idx) => {
      const town = (state.towns || []).find(t => String(t.id) === townId) || { id: townId, name: townId };
      const units = attackUnitsForTarget(townId, target, plan);
      const travel = computeTravelSeconds(townId, target, units, plan.timingMode === 'arrive_at');
      const same = isSameIsland(townId, target);
      const boats = boatCapacityCheck(units, same);
      let sendAt = null;
      if (plan.timingMode === 'arrive_at' && plan.arrivalUnix && travel != null) {
        sendAt = plan.arrivalUnix - travel - (plan.latencyPadMs || 0) / 1000;
      } else if (plan.timingMode === 'send_now') {
        sendAt = now + (idx * (plan.staggerMs || 0)) / 1000;
      }
      const unitCount = Object.values(units).reduce((a, b) => a + (+b || 0), 0);
      let status = 'ok';
      if (!unitCount) status = 'no-units';
      else if (!boats.ok) status = boats.reason;
      else if (travel == null && plan.timingMode === 'arrive_at') status = 'no-travel';
      else if (sendAt != null && sendAt < now - 1) status = 'past';
      return {
        townId, townName: town.name || townId, units, travel, sendAt, boats, status, unitCount, sameIsland: same,
      };
    });
    return { target, rows, now, skew };
  }
  const ATTACK_GENERIC_MISSIONS = new Set(['attack', 'support', 'revolt']);
  function sendAttackViaBridge(target, srcTownId, units, mission, onDone) {
    if (!hostEnabled()) { flash('bot desactivado en este servidor'); return onDone && onDone('disabled'); }
    const safeMission = String(mission || 'attack').toLowerCase();
    if (!ATTACK_GENERIC_MISSIONS.has(safeMission)) {
      gbLog(`attack: mission ${safeMission} requires a dedicated canonical handler — blocked`);
      return onDone && onDone('unsupported-mission');
    }
    if (captchaPaused('attack')) { flash('ataque pausado (captcha)'); return onDone && onDone('captcha'); }
    if (!attackSendAllowed(target)) {
      flash('ataque bloqueado: objetivo no es una ciudad (o no resuelto)');
      gbLog('attack: refuse Town/sendUnits for kind=' + (target && target.kind));
      return onDone && onDone('bad-target');
    }
    // resolveTarget() resolves OWN towns to kind 'town' (that is how a support
    // run addresses them), so nothing downstream stopped an attack/revolt on a
    // town we already hold: a guaranteed server rejection that still costs a
    // request budget slot and a decision-memory strike. Sending to yourself is
    // refused outright for every mission.
    if (String(target.town_id) === String(srcTownId)) {
      flash('ataque bloqueado: origen y destino son la misma ciudad');
      gbLog('attack: refuse self-target town ' + srcTownId);
      return onDone && onDone('bad-target');
    }
    if (safeMission !== 'support' && attackIsOwnTown(target.town_id)) {
      flash('ataque bloqueado: el objetivo es una ciudad propia');
      gbLog(`attack: refuse ${safeMission} on own town ${target.town_id}`);
      return onDone && onDone('bad-target');
    }

    const live = townLiveUnits(srcTownId);
    const sendUnits = {};
    Object.keys(units || {}).forEach(k => {
      const want = +units[k] || 0;
      const have = +live[k] || 0;
      if (want > 0 && have > 0) sendUnits[k] = Math.min(want, have);
    });
    if (!Object.keys(sendUnits).length) return onDone && onDone('no-units');
    const destId = +target.town_id;
    const tpl = state.attackTpl;
    const tplArgs = (tpl && tpl.arguments) || {};
    const args = {};
    for (const k of Object.keys(tplArgs)) {
      if (k === 'id' || k === 'town_id') continue;
      // A learned request may contain old unit counts as strings. Never carry
      // those into a new composition; only send the freshly selected units.
      if (k === 'militia' || unitMeta(k)) continue;
      const v = tplArgs[k];
      if (typeof v === 'string' || typeof v === 'boolean') args[k] = v;
    }
    if (mission) args.type = mission;
    else if (!args.type && tplArgs.type) args.type = tplArgs.type;
    args.id = destId;
    Object.assign(args, sendUnits);
    let modelUrl = (tpl && tpl.model_url) || ('Town/' + srcTownId);
    modelUrl = String(modelUrl).replace(/Town\/\d+/, 'Town/' + srcTownId);
    const payload = {
      model_url: modelUrl,
      action_name: (tpl && tpl.action_name) || 'sendUnits',
      arguments: args,
      town_id: +srcTownId,
    };
    // Summary by default. The full payload carries the learned template verbatim
    // (target ids, unit composition) and the Log tab is what users copy into
    // issues; the raw dump is available with the same redaction switch that
    // guards Copy/Export.
    const unitCount = Object.values(sendUnits).reduce((a, b) => a + (+b || 0), 0);
    if (state.exportRedact === false) gbLog('attack bridge:', JSON.stringify(payload));
    else gbLog(`attack bridge: ${payload.action_name} town ${srcTownId} → ${destId} (${args.type || '?'}, ${Object.keys(sendUnits).length} tipos / ${unitCount} unidades)`);
    bridgePost('attack', payload, (err, data) => {
      if (err) { flash('ataque fallido: ' + err); return onDone && onDone(err); }
      flash('ataque enviado #' + srcTownId);
      attackRememberTarget(target.town_id, { x: target.x, y: target.y, src: 'sent' });
      if (state.exportRedact === false) gbLog('attack response:', JSON.stringify(data).slice(0, 200));
      else gbLog('attack response: ok');
      if (onDone) onDone(null, data);
    });
  }
  function pushAttackHistory(entry) {
    state.attackHistory.unshift(entry);
    if (state.attackHistory.length > ATTACK_HISTORY_MAX) state.attackHistory.length = ATTACK_HISTORY_MAX;
    save(STORE.ATTACK_HISTORY, state.attackHistory);
  }
  function cancelArmedAttack() {
    if (!attackArmed) return;
    (attackArmed.timers || []).forEach(id => gbClearTimeout(id));
    if (attackArmed.raf) cancelAnimationFrame(attackArmed.raf);
    gbLog('attack: cancelled armed wave');
    flash('ataque cancelado');
    attackArmed = null;
    renderAttack();
  }

  function patchAttackFireStatus() {
    const sec = panel && panel.querySelector('section[data-tab=attack]');
    if (!sec || sec.hidden) return;
    const table = sec.querySelector('.atk-sched');
    if (!table || !table.querySelector('[data-town]')) {
      renderAttack();
      return;
    }
    const rows = attackPreviewRows.length ? attackPreviewRows : [];
    rows.forEach(r => {
      const cell = table.querySelector('[data-town="' + r.townId + '"] .atk-st');
      if (cell) cell.textContent = r.fireStatus || r.status || '';
    });
    const armed = sec.querySelector('#gb-atk-armed');
    if (armed) armed.textContent = attackArmed ? `ARMED (${attackArmed.rows.length})` : '';
  }

  const ATTACK_ARM_MAX_MS = 90000;
  function armAttackWave(plan, rows) {
    cancelArmedAttack();
    const target = resolveTarget(plan);
    if (!target || !attackSendAllowed(target)) {
      flash('no se puede armar: objetivo no resuelto o no es una ciudad');
      gbLog('attack: arm blocked — need canonical town target (villages unsupported)');
      return;
    }
    const timers = [];
    const delays = [];
    const armedAt = Date.now();
    attackArmed = { timers, rows, plan, cancel: cancelArmedAttack, armedAt };
    const skew0 = clientServerSkewMs();
    gbLog(`attack: armed ${rows.length} towns mode=${plan.timingMode} skew=${Math.round(skew0)}ms (max window ${ATTACK_ARM_MAX_MS}ms)`);
    flash('Los timers del navegador no son precisos para uso militar - esperas largas no se dispararan solas');
    rows.forEach((row, idx) => {
      if (!row.unitCount || !row.boats.ok) {
        gbLog(`attack: skip ${row.townId} status=${row.status}`);
        return;
      }
      if (row.status === 'past' || row.status === 'no-travel') {
        gbLog(`attack: skip ${row.townId} status=${row.status}`);
        return;
      }
      let delayMs;
      if (plan.timingMode === 'arrive_at' && row.sendAt != null) {
        const skew = clientServerSkewMs();
        const clientSendMs = row.sendAt * 1000 + skew;
        delayMs = clientSendMs - Date.now();
      } else {
        delayMs = idx * (plan.staggerMs || 0);
      }
      if (delayMs < 0) {
        gbLog(`attack: past send window for ${row.townId} (${Math.round(delayMs)}ms)`);
        row.fireStatus = 'past';
        return;
      }
      if (delayMs > ATTACK_ARM_MAX_MS) {
        gbLog(`attack: ${row.townId} delay ${Math.round(delayMs)}ms > ${ATTACK_ARM_MAX_MS}ms — not arming (re-arm closer to send)`);
        row.fireStatus = 'too-far';
        return;
      }
      delays.push(delayMs);
      const expectedFire = Date.now() + delayMs;
      const tid = gbTimeout(() => {

        const late = Date.now() - expectedFire;
        if (late > 5000) {
          gbLog(`attack: refuse overdue fire for ${row.townId} (late ${Math.round(late)}ms)`);
          row.fireStatus = 'overdue';
          patchAttackFireStatus();
          return;
        }

        const liveTarget = resolveTarget(plan);
        if (!liveTarget || !attackSendAllowed(liveTarget)) {
          row.fireStatus = 'bad-target';
          patchAttackFireStatus();
          return;
        }
        const freshUnits = attackUnitsForTarget(row.townId, liveTarget, plan);
        const freshCount = Object.values(freshUnits).reduce((a, b) => a + (+b || 0), 0);
        const freshSame = isSameIsland(row.townId, liveTarget);
        const freshBoats = boatCapacityCheck(freshUnits, freshSame);
        if (!freshCount || !freshBoats.ok) {
          row.fireStatus = !freshCount ? 'no-units' : 'boats-changed';
          patchAttackFireStatus();
          return;
        }
        if (plan.timingMode === 'arrive_at') {
          const freshTravel = computeTravelSeconds(row.townId, liveTarget, freshUnits, true);
          if (freshTravel == null || row.travel == null || Math.abs(freshTravel - row.travel) > 1) {
            row.fireStatus = 'travel-changed';
            gbLog(`attack: abort ${row.townId}; canonical travel changed ${row.travel}→${freshTravel}`);
            patchAttackFireStatus();
            return;
          }
        }
        row.fireStatus = 'firing';
        patchAttackFireStatus();
        sendAttackViaBridge(liveTarget, row.townId, freshUnits, plan.mission, (err) => {
          row.fireStatus = err ? 'err:' + err : 'sent';
          patchAttackFireStatus();
        });
      }, delayMs);
      timers.push(tid);
      row.fireStatus = 'armed+' + Math.round(delayMs) + 'ms';
    });
    pushAttackHistory({
      ts: armedAt, mode: plan.timingMode, targetId: plan.targetId,
      towns: rows.map(r => ({ id: r.townId, sendAt: r.sendAt, travel: r.travel, status: r.status })),
    });
    const maxDelay = delays.length ? Math.max(0, ...delays) : 0;
    timers.push(gbTimeout(() => {
      if (attackArmed && attackArmed.timers === timers) attackArmed = null;
      patchAttackFireStatus();
    }, maxDelay + 5000));
    renderAttack();
  }
  function fireAttackNow(plan, rows) {
    const target = resolveTarget(plan);
    if (!target || !attackSendAllowed(target)) {
      flash('no se puede enviar: objetivo no resuelto o no es una ciudad');
      return;
    }
    if (!confirm(`Enviar ${rows.filter(r => r.boats.ok && r.unitCount).length} ataque(s) ahora?`)) return;
    let i = 0;
    const okRows = rows.filter(r => r.boats.ok && r.unitCount);
    (function next() {
      if (i >= okRows.length) {
        pushAttackHistory({ ts: Date.now(), mode: 'send_now_immediate', targetId: plan.targetId, towns: okRows.map(r => r.townId) });
        flash(`ataques x${okRows.length}`);
        return;
      }
      const row = okRows[i++];
      const freshUnits = attackUnitsForTarget(row.townId, target, plan);
      const freshCount = Object.values(freshUnits).reduce((a, b) => a + (+b || 0), 0);
      const freshBoats = boatCapacityCheck(freshUnits, isSameIsland(row.townId, target));
      if (!freshCount || !freshBoats.ok) {
        gbLog(`attack: skip ${row.townId} at fire time (${!freshCount ? 'no-units' : freshBoats.reason})`);
        gbTimeout(next, (plan.staggerMs || 25) + Math.random() * 20);
        return;
      }
      sendAttackViaBridge(target, row.townId, freshUnits, plan.mission, () => {
        gbTimeout(next, (plan.staggerMs || 25) + Math.random() * 20);
      });
    })();
  }
  function editThreshold(target) {
    const cur = state.thresholds[target.vill_id] || {};
    const def = Object.entries(cur).map(([k, v]) => `${k}:${v}`).join(',');
    const v = prompt(`Threshold for ${target.vill_id}\nFormat: wood:5000,iron:8000,pop:100\nEmpty = clear`, def);
    if (v == null) return;
    if (v.trim() === '') { delete state.thresholds[target.vill_id]; }
    else {
      const o = {};
      v.split(',').forEach(p => { const m = p.trim().match(/^(\w+)\s*:\s*(\d+)/); if (m) o[m[1]] = +m[2]; });
      state.thresholds[target.vill_id] = o;
    }
    save(STORE.THRESH, state.thresholds);
    renderFarms();
  }
  function knownUnitIds() {
    const uw = gameUw();
    const ids = new Set();
    try {
      if (uw.GameData && uw.GameData.units) Object.keys(uw.GameData.units).forEach(k => ids.add(k));
    } catch (_) {}
    (state.towns || []).forEach(t => Object.keys(townLiveUnits(t.id)).forEach(k => ids.add(k)));
    ['sword', 'slinger', 'archer', 'hoplite', 'rider', 'chariot', 'catapult',
      'big_transporter', 'small_transporter', 'bireme', 'trireme', 'colonize_ship'].forEach(k => ids.add(k));
    return Array.from(ids).sort();
  }
  function fmtUnixLocal(unix) {
    if (unix == null) return '-';
    try { return new Date(unix * 1000 + clientServerSkewMs()).toLocaleTimeString(); } catch (_) { return String(unix); }
  }
  function renderAttack() {
    const sec = panel && panel.querySelector('section[data-tab=attack]');
    if (!sec || sec.hidden) return;
    const plan = ensureAttackPlan();
    const skewEl = sec.querySelector('#gb-atk-skew');
    if (skewEl) skewEl.textContent = `skew ${Math.round(clientServerSkewMs())}ms | srv ${serverNow()}`;
    const table = sec.querySelector('.atk-sched');
    if (!table) return;
    const rows = attackPreviewRows.length ? attackPreviewRows : [];

    if (!rows.length) {
      if (!table.dataset.empty) {
        table.replaceChildren();
        table.dataset.empty = '1';
        const e = document.createElement('div');
        e.style.cssText = 'color:#888;padding:6px 0;font-size:11px';
        e.textContent = 'Preview to compute travel / sendAt / boats';
        table.appendChild(e);
      }
    } else {
      const wanted = rows.map(r => String(r.townId));
      const have = Array.from(table.querySelectorAll('div[data-town]')).map(d => d.dataset.town);
      const sameSet = !table.dataset.empty && have.length === wanted.length && have.every((k, i) => k === wanted[i]);
      if (!sameSet) {
        table.replaceChildren();
        delete table.dataset.empty;
        const hdr = document.createElement('div');
        hdr.style.cssText = 'display:grid;grid-template-columns:1.2fr .7fr .9fr .7fr .8fr;gap:4px;color:#888;font-size:9px;margin-bottom:2px';
        hdr.innerHTML = '<span>town</span><span>travel</span><span>sendAt</span><span>boats</span><span>status</span>';
        table.appendChild(hdr);
      }
      rows.forEach(r => {
        let row = sameSet ? table.querySelector(`div[data-town="${r.townId}"]`) : null;
        if (!row) {
          row = document.createElement('div');
          row.dataset.town = String(r.townId);
          row.style.cssText = 'display:grid;grid-template-columns:1.2fr .7fr .9fr .7fr .8fr;gap:4px;font-size:10px;border-bottom:1px solid #2a2a2a;padding:2px 0';
          for (let i = 0; i < 5; i++) row.appendChild(document.createElement('span'));
          row.children[4].className = 'atk-st';
          row.children[0].title = String(r.townId);
          table.appendChild(row);
        }
        const boatTxt = r.boats.ok ? `OK ${r.boats.cap}/${r.boats.need}` : `NO ${r.boats.cap}/${r.boats.need}`;
        const vals = [
          (r.townName || '').slice(0, 14),
          r.travel != null ? fmtHMS(r.travel) : '-',
          fmtUnixLocal(r.sendAt),
          boatTxt,
          String(r.fireStatus || r.status),
        ];
        for (let i = 0; i < 5; i++) {
          if (row.children[i].textContent !== vals[i]) row.children[i].textContent = vals[i];
        }
        const boatColor = r.boats.ok ? '#6dda7e' : '#f55';
        if (row.children[3].style.color !== boatColor) row.children[3].style.color = boatColor;
      });
    }
    const armed = sec.querySelector('#gb-atk-armed');
    if (armed) armed.textContent = attackArmed ? `ARMED (${attackArmed.rows.length})` : '';

    const tid = sec.querySelector('[data-atk=target]');
    if (tid && document.activeElement !== tid) tid.value = plan.targetId || '';
    const tt = sec.querySelector('[data-atk=target-type]');
    if (tt) tt.value = plan.targetType || 'town';
    const pick = sec.querySelector('[data-atk=pick]');
    if (pick && document.activeElement !== pick) {
      const targets = attackKnownTargets();
      const sig = targets.map(t => t.id + ':' + (t.name || '') + ':' + (t.x ?? '') + ':' + (t.y ?? '')).join('|');
      if (pick.dataset.sig !== sig) {
        pick.dataset.sig = sig; pick.replaceChildren();
        const first = document.createElement('option'); first.value = ''; first.textContent = targets.length ? `known targets (${targets.length})...` : 'no known targets'; pick.appendChild(first);
        targets.forEach(t => {
          const o = document.createElement('option'); o.value = t.id;
          const coord = t.x != null && t.y != null ? ` ${t.x}|${t.y}` : '';
          o.textContent = `${(t.name || '?').slice(0, 16)} #${t.id}${coord}`; pick.appendChild(o);
        });
      }
      pick.value = targets.some(t => String(t.id) === String(plan.targetId)) ? String(plan.targetId) : '';
    }
    const hint = sec.querySelector('#gb-atk-target-hint');
    if (hint) {
      const known = attackKnownTargets().find(t => String(t.id) === String(plan.targetId));
      const resolved = plan.targetId ? resolveTarget(plan) : null;
      if (resolved && resolved.kind === 'town') {
        const coord = resolved.x != null && resolved.y != null ? ` (${resolved.x}|${resolved.y})` : '';
        hint.textContent = `town #${plan.targetId}${known && known.name ? ' | ' + known.name : ''}${coord}`; hint.style.color = '#6dda7e';
      } else if (plan.targetId) { hint.textContent = 'target unresolved / unsupported'; hint.style.color = '#f96'; }
      else { hint.textContent = 'direct town id or a target learned from reports/previous attacks'; hint.style.color = '#888'; }
    }
    const ax = sec.querySelector('[data-atk=x]');
    if (ax && document.activeElement !== ax) ax.value = plan.targetX ?? '';
    const ay = sec.querySelector('[data-atk=y]');
    if (ay && document.activeElement !== ay) ay.value = plan.targetY ?? '';
    const mis = sec.querySelector('[data-atk=mission]');
    if (mis) mis.value = plan.mission || 'attack';
    const tm = sec.querySelector('[data-atk=timing]');
    if (tm) tm.value = plan.timingMode || 'send_now';
    const pad = sec.querySelector('[data-atk=pad]');
    if (pad && document.activeElement !== pad) pad.value = plan.latencyPadMs ?? 200;
    const troop = sec.querySelector('[data-atk=troop]');
    if (troop) troop.value = plan.troopMode || 'offense';
    const ut = sec.querySelector('[data-atk=unit-type]');
    if (ut) {
      if (!ut.options.length) {
        knownUnitIds().forEach(id => {
          const o = document.createElement('option'); o.value = id; o.textContent = id; ut.appendChild(o);
        });
      }
      ut.value = plan.unitType || 'sword';
      ut.disabled = plan.troopMode !== 'all_of_type';
      ut.style.opacity = ut.disabled ? '0.4' : '1';
      ut.title = ut.disabled
        ? "unit picker only applies when troop mode is 'all of type'"
        : 'unit sent from every source town';
      const utLab = ut.closest('label');
      if (utLab) utLab.style.color = ut.disabled ? '#666' : '#ccc';
    }
    const arr = sec.querySelector('[data-atk=arrival]');
    if (arr && document.activeElement !== arr && plan.arrivalUnix) {
      try {
        const d = new Date(plan.arrivalUnix * 1000 + clientServerSkewMs());
        const pad2 = n => String(n).padStart(2, '0');
        arr.value = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
      } catch (_) {}
    }
    const srcBox = sec.querySelector('.atk-sources');
    if (srcBox && !srcBox.dataset.bound) {
      srcBox.dataset.bound = '1';

    }
    if (srcBox) {
      const selected = new Set(Array.isArray(plan.sourceTownIds) ? plan.sourceTownIds.map(String) : (state.towns || []).map(t => String(t.id)));

      const sig = (state.towns || []).map(t => t.id + ':' + (t.name || '')).join('|');
      if (srcBox.dataset.sig === sig) {
        srcBox.querySelectorAll('input[data-id]').forEach(cb => {
          const want = selected.has(String(cb.dataset.id));
          if (cb.checked !== want) cb.checked = want;
        });
      } else {
        srcBox.dataset.sig = sig;
        srcBox.replaceChildren();
        (state.towns || []).forEach(t => {
          const lab = document.createElement('label');
          lab.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:10px;cursor:pointer';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = selected.has(String(t.id));
          cb.addEventListener('change', () => {
            const ids = Array.from(srcBox.querySelectorAll('input:checked')).map(c => c.dataset.id);
            plan.sourceTownIds = ids;
            saveAttackPlan();
          });
          cb.dataset.id = String(t.id);
          lab.appendChild(cb);
          lab.appendChild(document.createTextNode(`${t.name || t.id}`));
          srcBox.appendChild(lab);
        });
      }
    }
    const per = sec.querySelector('.atk-pertown');
    if (per) {
      per.hidden = plan.troopMode !== 'per_town';
      if (plan.troopMode === 'per_town') {
        per.replaceChildren();
        const ids = Array.isArray(plan.sourceTownIds)
          ? plan.sourceTownIds : (state.towns || []).map(t => String(t.id));
        ids.forEach(tid2 => {
          const town = (state.towns || []).find(t => String(t.id) === String(tid2)) || { id: tid2, name: tid2 };
          const wrap = document.createElement('div');
          wrap.style.cssText = 'margin-bottom:4px';
          const lab = document.createElement('div');
          lab.style.cssText = 'color:#888;font-size:9px';
          lab.textContent = town.name || tid2;
          const ta = document.createElement('textarea');
          ta.style.cssText = 'width:100%;height:40px;background:#111;color:#cfc;border:1px solid #333;font:10px monospace';
          const live = selectUnitsForTown(tid2, 'offense', plan.unitType, null);
          ta.value = unitsToArea(plan.perTownUnits[tid2] || live);
          ta.addEventListener('change', () => {
            plan.perTownUnits[tid2] = parseUnitsArea(ta.value);
            saveAttackPlan();
          });
          wrap.appendChild(lab); wrap.appendChild(ta);
          per.appendChild(wrap);
        });
      }
    }
    renderAttackRoles(sec);
    renderMilitaryHelpers(sec, plan);
    renderCompositionAdvisor(sec);
    renderColonyThreats(sec);
    renderSharedPlan(sec);
  }
  function readAttackForm() {
    const sec = panel && panel.querySelector('section[data-tab=attack]');
    const plan = ensureAttackPlan();
    if (!sec) return plan;
    plan.targetId = sec.querySelector('[data-atk=target]')?.value?.trim() || '';
    plan.targetType = sec.querySelector('[data-atk=target-type]')?.value || 'town';
    const xv = sec.querySelector('[data-atk=x]')?.value;
    const yv = sec.querySelector('[data-atk=y]')?.value;
    plan.targetX = xv === '' || xv == null ? null : +xv;
    plan.targetY = yv === '' || yv == null ? null : +yv;
    plan.mission = sec.querySelector('[data-atk=mission]')?.value || 'attack';
    plan.timingMode = sec.querySelector('[data-atk=timing]')?.value || 'send_now';
    plan.latencyPadMs = +(sec.querySelector('[data-atk=pad]')?.value || 200);
    plan.troopMode = sec.querySelector('[data-atk=troop]')?.value || 'offense';
    if (plan.troopMode === 'harass' && !plan.harassPreset) plan.harassPreset = 'light';
    plan.unitType = sec.querySelector('[data-atk=unit-type]')?.value || 'sword';
    const arr = sec.querySelector('[data-atk=arrival]')?.value;
    if (arr) {
      const ms = Date.parse(arr);
      if (!isNaN(ms)) plan.arrivalUnix = Math.floor((ms - clientServerSkewMs()) / 1000);
    }
    const srcBox = sec.querySelector('.atk-sources');
    if (srcBox) {
      plan.sourceTownIds = Array.from(srcBox.querySelectorAll('input:checked')).map(c => c.dataset.id);
    }
    saveAttackPlan();
    return plan;
  }
  function townNameById(id) {
    const t = (state.towns || []).find(x => String(x.id) === String(id));
    return (t && t.name) || String(id || '-');
  }
