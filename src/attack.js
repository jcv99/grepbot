  // ---------- attack sync planner ----------
  // Modes: send_now (all fire together) | arrive_at (CS: sendAt = arrival - travel - pad)
  // Troop modes: all | offense | defense | all_of_type | per_town
  const ATTACK_HISTORY_MAX = 50;
  const ATTACK_ROLE_OFFENSE = 'offense';
  const ATTACK_ROLE_DEFENSE = 'defense';
  let attackArmed = null; // { timers:[], rows:[], cancel() }
  let attackPreviewRows = [];

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
  function computeTravelSeconds(srcTownId, target, units) {
    const uw = gameUw();
    // Prefer game helper when available
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
  function classifyUnitFn(id) {
    const m = unitMeta(id);
    if (!m) return 'unknown';
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
    if (troopMode === 'harass') {
      return selectHarassmentUnits(townId, harassPreset || 'light');
    }
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
      // include transporters if land unit and boats present
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
        // keep transporters only for capacity; skip pure warships unless offense wants them - include capacity boats always
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
    return {
      targetId: '',
      targetX: null,
      targetY: null,
      mission: 'attack',
      timingMode: 'send_now', // send_now | arrive_at
      arrivalUnix: null,
      latencyPadMs: 200,
      staggerMs: 25,
      troopMode: 'offense', // all | offense | defense | all_of_type | per_town | harass
      harassPreset: 'light',
      unitType: 'sword',
      sourceTownIds: [],
      perTownUnits: {},
    };
  }
  function ensureAttackPlan() {
    if (!state.attackPlan) state.attackPlan = defaultAttackPlan();
    return state.attackPlan;
  }
  function saveAttackPlan() {
    save(STORE.ATTACK_PLAN, state.attackPlan);
  }
  function attackRememberTarget(id, meta) {
    if (id == null || id === '') return;
    const sid = String(id);
    if (!state.attackRecent) state.attackRecent = [];
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
      const prev = map.get(id);
      const entry = {
        id,
        name: t.name || prev?.name || null,
        x: t.x ?? prev?.x ?? null,
        y: t.y ?? prev?.y ?? null,
        src: prev?.src || src,
        ts: t.ts || prev?.ts || 0,
      };
      if (!prev || (t.ts || 0) >= (prev.ts || 0)) map.set(id, entry);
    };
    for (const f of (state.findings || [])) {
      if (f.town && f.town.id != null) add(Object.assign({}, f.town, { ts: f.ts }), 'report');
    }
    for (const t of (state.attackRecent || [])) add(t, t.src || 'recent');
    for (const h of (state.attackHistory || [])) {
      if (h.targetId) add({ id: h.targetId, ts: h.ts }, 'history');
    }
    for (const w of (state.watchlist || [])) {
      const id = w && (w.id || w.townId);
      if (id != null) add({ id, name: w.name, ts: 0 }, 'watch');
    }
    const tpl = state.attackTpl;
    const learnedId = tpl && tpl.arguments && tpl.arguments.id;
    if (learnedId != null) add({ id: learnedId, ts: tpl.learned_at || 0 }, 'learned');
    return Array.from(map.values()).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }
  function attackCurrentTownId() {
    const uw = gameUw();
    try {
      const id = uw.Game && uw.Game.townId;
      if (id == null) return null;
      const sid = String(id);
      const own = (state.towns || []).find(t => String(t.id) === sid);
      if (own) return { id: sid, name: own.name || 'own town', x: own.x, y: own.y, own: true };
      const hit = (state.findings || []).find(f => f.town && String(f.town.id) === sid);
      if (hit && hit.town) {
        return { id: sid, name: hit.town.name, x: hit.town.x, y: hit.town.y, own: false };
      }
      const recent = (state.attackRecent || []).find(t => String(t.id) === sid);
      if (recent) return Object.assign({ own: false }, recent);
      if (uw.ITowns && uw.ITowns.towns && uw.ITowns.towns[id]) {
        const t = uw.ITowns.towns[id];
        const name = (typeof t.getName === 'function' ? t.getName() : t.name) || sid;
        return { id: sid, name, x: t.x, y: t.y, own: true };
      }
      return { id: sid, name: null, x: null, y: null, own: false };
    } catch (_) { return null; }
  }
  function applyAttackTarget(t) {
    const plan = ensureAttackPlan();
    plan.targetId = String(t.id);
    plan.targetType = 'town';
    if (t.x != null) plan.targetX = +t.x;
    if (t.y != null) plan.targetY = +t.y;
    saveAttackPlan();
    renderAttack();
    const label = t.name ? `${t.name} (#${t.id})` : String(t.id);
    flash('target → ' + label);
  }
  function attackTownGroup(name) {
    return ((state.townGroups && state.townGroups[name]) || []).map(String);
  }
  function attackSetTownRole(name, townId, on) {
    if (!state.townGroups) state.townGroups = {};
    const sid = String(townId);
    const ids = new Set(attackTownGroup(name));
    if (on) ids.add(sid);
    else ids.delete(sid);
    state.townGroups[name] = Array.from(ids);
    save(STORE.TOWN_GROUPS, state.townGroups);
  }
  function attackSelectSources(ids) {
    const plan = ensureAttackPlan();
    plan.sourceTownIds = (ids || []).map(String);
    saveAttackPlan();
    renderAttack();
  }
  function attackSetAllSources(checked) {
    const ids = checked ? (state.towns || []).map(t => String(t.id)) : [];
    attackSelectSources(ids);
    flash(checked ? 'all towns selected' : 'sources cleared');
  }
  function attackSelectRoleSources(role) {
    const ids = attackTownGroup(role);
    if (!ids.length) {
      flash(`no ${role} cities tagged — check boxes below first`);
      return;
    }
    attackSelectSources(ids);
    flash(`${role} cities selected (${ids.length})`);
  }
  function attackPad2(n) { return String(n).padStart(2, '0'); }
  function attackLocalFromUnix(unix) {
    if (unix == null) return null;
    const d = new Date(unix * 1000 + clientServerSkewMs());
    return {
      date: `${d.getFullYear()}-${attackPad2(d.getMonth() + 1)}-${attackPad2(d.getDate())}`,
      time: `${attackPad2(d.getHours())}:${attackPad2(d.getMinutes())}:${attackPad2(d.getSeconds())}`,
    };
  }
  function attackUnixFromLocal(dateStr, timeStr) {
    if (!dateStr) return null;
    const t = timeStr && /^\d{1,2}:\d{2}/.test(timeStr) ? timeStr : '00:00:00';
    const ms = Date.parse(`${dateStr}T${t}`);
    if (isNaN(ms)) return null;
    return Math.floor((ms - clientServerSkewMs()) / 1000);
  }
  function attackDefaultArrivalUnix() {
    return Math.floor((Date.now() + 3600000 - clientServerSkewMs()) / 1000);
  }
  function attackSyncArrivalFields(sec, plan) {
    const arrDate = sec.querySelector('[data-atk=arrival-date]');
    const arrTime = sec.querySelector('[data-atk=arrival-time]');
    const arrivalRow = sec.querySelector('.atk-arrival-row');
    const arriveMode = plan.timingMode === 'arrive_at';
    if (arrivalRow) {
      arrivalRow.style.opacity = arriveMode ? '1' : '0.5';
      arrivalRow.title = arriveMode ? '' : 'switch timing to "arrive at" to set CS landing time';
    }
    if (!arrDate || !arrTime) return;
    arrDate.disabled = !arriveMode;
    arrTime.disabled = !arriveMode;
    if (document.activeElement === arrDate || document.activeElement === arrTime) return;
    let unix = plan.arrivalUnix;
    if (arriveMode && unix == null) unix = attackDefaultArrivalUnix();
    if (unix != null) {
      const loc = attackLocalFromUnix(unix);
      if (loc) {
        arrDate.value = loc.date;
        arrTime.value = loc.time;
      }
    }
  }
  function renderAttackRoles(sec) {
    const box = sec.querySelector('.atk-roles');
    if (!box) return;
    const towns = state.towns || [];
    const off = new Set(attackTownGroup(ATTACK_ROLE_OFFENSE));
    const def = new Set(attackTownGroup(ATTACK_ROLE_DEFENSE));
    const sig = towns.map(t => t.id + ':' + (t.name || '')).join('|') +
      '|O:' + Array.from(off).sort().join(',') + '|D:' + Array.from(def).sort().join(',');
    if (box.dataset.sig === sig) {
      box.querySelectorAll('input[data-role]').forEach(cb => {
        const role = cb.dataset.role;
        const id = cb.dataset.id;
        const want = role === ATTACK_ROLE_OFFENSE ? off.has(id) : def.has(id);
        if (cb.checked !== want) cb.checked = want;
      });
      return;
    }
    box.dataset.sig = sig;
    box.replaceChildren();
    if (!towns.length) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#666;font-size:10px';
      e.textContent = 'load towns first (World tab → refresh)';
      box.appendChild(e);
      return;
    }
    const mkCol = (title, role, color) => {
      const col = document.createElement('div');
      const head = document.createElement('div');
      head.style.cssText = `font-size:9px;color:${color};margin-bottom:2px;font-weight:bold`;
      head.textContent = title;
      col.appendChild(head);
      towns.forEach(t => {
        const lab = document.createElement('label');
        lab.style.cssText = 'display:flex;align-items:center;gap:3px;font-size:10px;cursor:pointer';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.role = role;
        cb.dataset.id = String(t.id);
        cb.checked = role === ATTACK_ROLE_OFFENSE ? off.has(String(t.id)) : def.has(String(t.id));
        cb.addEventListener('change', () => {
          attackSetTownRole(role, t.id, cb.checked);
          renderAttackRoles(sec);
          renderAttack();
        });
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode((t.name || t.id).slice(0, 18)));
        col.appendChild(lab);
      });
      return col;
    };
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px';
    grid.appendChild(mkCol('Offensive cities', ATTACK_ROLE_OFFENSE, '#f96'));
    grid.appendChild(mkCol('Defensive cities', ATTACK_ROLE_DEFENSE, '#6cf'));
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
    let x = plan.targetX, y = plan.targetY, island = null;
    let kind = explicitType || null;

    // Own town?
    const ownTown = (state.towns || []).find(t => String(t.id) === id);
    if (ownTown) {
      kind = kind || 'town';
      x = x ?? ownTown.x; y = y ?? ownTown.y; island = ownTown.island;
      return { id, vill_id: null, town_id: id, kind: 'town', x: x != null ? +x : null, y: y != null ? +y : null, island };
    }
    try {
      const uw = gameUw();
      if (uw.ITowns && uw.ITowns.towns && uw.ITowns.towns[id]) {
        kind = kind || 'town';
        return { id, vill_id: null, town_id: id, kind: 'town', x: x != null ? +x : null, y: y != null ? +y : null, island };
      }
    } catch (_) {}

    // Farm / BP village from parsed list
    const farm = (state.farmsParsed || []).find(f => String(f.vill_id) === id || String(f.id) === id);
    if (farm) {
      kind = kind || 'farm_town';
      x = x ?? farm.x; y = y ?? farm.y;
      return { id, vill_id: id, town_id: null, kind: 'farm_town', x: x != null ? +x : null, y: y != null ? +y : null, island };
    }

    // Town seen in spy reports / recent targets — player cities, not farm villages
    const finding = (state.findings || []).find(f => f.town && String(f.town.id) === id);
    if (finding && finding.town) {
      kind = kind || 'town';
      x = x ?? finding.town.x; y = y ?? finding.town.y;
      return { id, vill_id: null, town_id: id, kind: 'town', x: x != null ? +x : null, y: y != null ? +y : null, island };
    }
    const recent = (state.attackRecent || []).find(t => String(t.id) === id);
    if (recent) {
      kind = kind || 'town';
      x = x ?? recent.x; y = y ?? recent.y;
      return { id, vill_id: null, town_id: id, kind: 'town', x: x != null ? +x : null, y: y != null ? +y : null, island };
    }

    // Explicit type required when not resolvable from known models
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
    // Town/sendUnits path requires a town destination — villages must not use it
    if (target.kind === 'farm_town') return false;
    return target.kind === 'town' && target.town_id;
  }
  function buildAttackSchedule(plan) {
    const target = resolveTarget(plan);
    if (!target) return { error: 'no target', rows: [] };
    let sources = (plan.sourceTownIds && plan.sourceTownIds.length)
      ? plan.sourceTownIds.map(String)
      : (state.towns || []).map(t => String(t.id));
    if (!sources.length) return { error: 'no source towns', rows: [] };
    const now = serverNow();
    const skew = clientServerSkewMs();
    const rows = sources.map((townId, idx) => {
      const town = (state.towns || []).find(t => String(t.id) === townId) || { id: townId, name: townId };
      const units = selectUnitsForTown(townId, plan.troopMode, plan.unitType, plan.perTownUnits, plan.harassPreset);
      const travel = computeTravelSeconds(townId, target, units);
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
  function sendAttackViaBridge(target, srcTownId, units, mission, onDone) {
    if (!hostEnabled()) { flash('bot disabled on this host'); return onDone && onDone('disabled'); }
    if (captchaPaused('attack')) { flash('attack paused (captcha)'); return onDone && onDone('captcha'); }
    if (!attackSendAllowed(target)) {
      flash('attack blocked: target not a town (or unresolved)');
      gbLog('attack: refuse Town/sendUnits for kind=' + (target && target.kind));
      return onDone && onDone('bad-target');
    }
    // Re-read units immediately before send
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
    gbLog('attack bridge:', JSON.stringify(payload));
    bridgePost('attack', payload, (err, data) => {
      if (err) { flash('attack failed: ' + err); return onDone && onDone(err); }
      flash('attack sent #' + srcTownId);
      gbLog('attack response:', JSON.stringify(data).slice(0, 200));
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
    (attackArmed.timers || []).forEach(id => clearTimeout(id));
    if (attackArmed.raf) cancelAnimationFrame(attackArmed.raf);
    gbLog('attack: cancelled armed wave');
    flash('attack cancelled');
    attackArmed = null;
    renderAttack();
  }
  // Fire-wave status only — avoid rebuilding source checkboxes on every tick
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
  // Max arm-ahead window — long timers are not military-grade; overdue after
  // tab suspend must not auto-fire.
  const ATTACK_ARM_MAX_MS = 90000;
  function armAttackWave(plan, rows) {
    cancelArmedAttack();
    const target = resolveTarget(plan);
    if (!target || !attackSendAllowed(target)) {
      flash('cannot arm: target unresolved or not a town');
      gbLog('attack: arm blocked — need canonical town target (villages unsupported)');
      return;
    }
    const timers = [];
    const delays = [];
    const armedAt = Date.now();
    attackArmed = { timers, rows, plan, cancel: cancelArmedAttack, armedAt };
    const skew0 = clientServerSkewMs();
    gbLog(`attack: armed ${rows.length} towns mode=${plan.timingMode} skew=${Math.round(skew0)}ms (max window ${ATTACK_ARM_MAX_MS}ms)`);
    flash('Browser timers are not military-precise — long waits will not auto-fire');
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
        // Refuse overdue fire after tab suspend / clock jump
        const late = Date.now() - expectedFire;
        if (late > 5000) {
          gbLog(`attack: refuse overdue fire for ${row.townId} (late ${Math.round(late)}ms)`);
          row.fireStatus = 'overdue';
          patchAttackFireStatus();
          return;
        }
        // Re-resolve target + units at fire time
        const liveTarget = resolveTarget(plan);
        if (!liveTarget || !attackSendAllowed(liveTarget)) {
          row.fireStatus = 'bad-target';
          patchAttackFireStatus();
          return;
        }
        const freshUnits = selectUnitsForTown(row.townId, plan.troopMode, plan.unitType, plan.perTownUnits, plan.harassPreset);
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
      flash('cannot send: target unresolved or not a town');
      return;
    }
    if (!confirm(`Send ${rows.filter(r => r.boats.ok && r.unitCount).length} attack(s) now?`)) return;
    let i = 0;
    const okRows = rows.filter(r => r.boats.ok && r.unitCount);
    (function next() {
      if (i >= okRows.length) {
        pushAttackHistory({ ts: Date.now(), mode: 'send_now_immediate', targetId: plan.targetId, towns: okRows.map(r => r.townId) });
        flash(`attacks x${okRows.length}`);
        return;
      }
      const row = okRows[i++];
      const freshUnits = selectUnitsForTown(row.townId, plan.troopMode, plan.unitType, plan.perTownUnits, plan.harassPreset);
      sendAttackViaBridge(target, row.townId, freshUnits, plan.mission, () => {
        gbTimeout(next, (plan.staggerMs || 25) + Math.random() * 20);
      });
    })();
  }
  function prepareAttack(target) {
    const plan = ensureAttackPlan();
    const isFarm = target.vill_id != null && target.town_id == null && target.kind !== 'town';
    if (isFarm && !target.town_id) {
      plan.targetId = String(target.vill_id || target.id || '');
      plan.targetType = 'farm_town';
    } else {
      plan.targetId = String(target.town_id || target.id || target.vill_id || '');
      plan.targetType = 'town';
    }
    plan.targetX = target.x ?? plan.targetX;
    plan.targetY = target.y ?? plan.targetY;
    if (!plan.sourceTownIds.length) plan.sourceTownIds = (state.towns || []).map(t => String(t.id));
    saveAttackPlan();
    // switch to Attack tab
    if (typeof showTab === 'function') showTab('attack');
    else renderAttack();
    flash('attack planner <- ' + plan.targetId);
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
    // This runs on every fire-status tick while a wave is armed. Rebuilding the
    // whole schedule each time threw away rows that only needed their status
    // cell changed — patch by town id, rebuild only when the row set changes.
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
    // sync form fields from plan once
    const tid = sec.querySelector('[data-atk=target]');
    if (tid && document.activeElement !== tid) tid.value = plan.targetId || '';
    const pick = sec.querySelector('[data-atk=pick]');
    if (pick && document.activeElement !== pick) {
      const targets = attackKnownTargets();
      const sig = targets.map(t => t.id + ':' + (t.name || '')).join('|');
      if (pick.dataset.sig !== sig) {
        pick.dataset.sig = sig;
        pick.replaceChildren();
        const o0 = document.createElement('option');
        o0.value = '';
        o0.textContent = targets.length ? `pick town (${targets.length})…` : 'no known towns yet';
        pick.appendChild(o0);
        targets.forEach(t => {
          const o = document.createElement('option');
          o.value = t.id;
          const coord = (t.x != null && t.y != null) ? ` ${t.x}|${t.y}` : '';
          o.textContent = `${(t.name || '?').slice(0, 16)} #${t.id}${coord}`;
          pick.appendChild(o);
        });
      }
      const match = targets.some(t => String(t.id) === String(plan.targetId));
      pick.value = match ? String(plan.targetId) : '';
    }
    const hint = sec.querySelector('#gb-atk-target-hint');
    if (hint) {
      const known = attackKnownTargets().find(t => String(t.id) === String(plan.targetId));
      const resolved = plan.targetId ? resolveTarget(plan) : null;
      if (resolved && resolved.kind === 'town') {
        const nm = known?.name || '';
        const coord = (resolved.x != null && resolved.y != null) ? ` (${resolved.x}|${resolved.y})` : '';
        hint.textContent = `town #${plan.targetId}${nm ? ' · ' + nm : ''}${coord}`;
        hint.style.color = '#6dda7e';
      } else if (plan.targetId) {
        hint.textContent = resolved
          ? `${resolved.kind} #${plan.targetId} — city attacks need kind=town`
          : 'unresolved — pick from list, click Current in-game, or add x/y';
        hint.style.color = '#f96';
      } else {
        hint.textContent = 'pick a town from spy reports, or click a city in-game then Current';
        hint.style.color = '#888';
      }
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
    renderMilitaryHelpers(sec, plan);
    attackSyncArrivalFields(sec, plan);
    renderAttackRoles(sec);
    const srcBox = sec.querySelector('.atk-sources');
    if (srcBox && !srcBox.dataset.bound) {
      srcBox.dataset.bound = '1';
      // rebuilt below when needed
    }
    if (srcBox) {
      const selected = new Set((plan.sourceTownIds || []).map(String));
      if (!selected.size) (state.towns || []).forEach(t => selected.add(String(t.id)));
      // Checkbox list only needs rebuilding when the town list changes; otherwise
      // just re-sync checked state (a rebuild mid-click dropped the user's edit).
      const sig = (state.towns || []).map(t => t.id + ':' + (t.name || '')).join('|') +
        '|O:' + attackTownGroup(ATTACK_ROLE_OFFENSE).join(',') +
        '|D:' + attackTownGroup(ATTACK_ROLE_DEFENSE).join(',');
      if (srcBox.dataset.sig === sig) {
        srcBox.querySelectorAll('input[data-id]').forEach(cb => {
          const want = selected.has(String(cb.dataset.id));
          if (cb.checked !== want) cb.checked = want;
        });
      } else {
        srcBox.dataset.sig = sig;
        srcBox.replaceChildren();
        const off = new Set(attackTownGroup(ATTACK_ROLE_OFFENSE));
        const def = new Set(attackTownGroup(ATTACK_ROLE_DEFENSE));
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
          const tag = document.createElement('span');
          const tid = String(t.id);
          let badge = '';
          if (off.has(tid) && def.has(tid)) badge = ' O+D';
          else if (off.has(tid)) badge = ' O';
          else if (def.has(tid)) badge = ' D';
          tag.textContent = `${t.name || t.id}${badge}`;
          if (badge) tag.style.color = off.has(tid) ? '#f96' : '#6cf';
          lab.appendChild(tag);
          srcBox.appendChild(lab);
        });
      }
    }
    const per = sec.querySelector('.atk-pertown');
    if (per) {
      per.hidden = plan.troopMode !== 'per_town';
      if (plan.troopMode === 'per_town') {
        per.replaceChildren();
        const ids = (plan.sourceTownIds && plan.sourceTownIds.length)
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
  }
  function readAttackForm() {
    const sec = panel && panel.querySelector('section[data-tab=attack]');
    const plan = ensureAttackPlan();
    if (!sec) return plan;
    plan.targetId = sec.querySelector('[data-atk=target]')?.value?.trim() || '';
    const xv = sec.querySelector('[data-atk=x]')?.value;
    const yv = sec.querySelector('[data-atk=y]')?.value;
    plan.targetX = xv === '' || xv == null ? null : +xv;
    plan.targetY = yv === '' || yv == null ? null : +yv;
    plan.mission = sec.querySelector('[data-atk=mission]')?.value || 'attack';
    plan.timingMode = sec.querySelector('[data-atk=timing]')?.value || 'send_now';
    plan.latencyPadMs = +(sec.querySelector('[data-atk=pad]')?.value || 200);
    plan.troopMode = sec.querySelector('[data-atk=troop]')?.value || 'offense';
    plan.unitType = sec.querySelector('[data-atk=unit-type]')?.value || 'sword';
    if (plan.troopMode === 'harass' && !plan.harassPreset) plan.harassPreset = 'light';
    const d = sec.querySelector('[data-atk=arrival-date]')?.value;
    const tm = sec.querySelector('[data-atk=arrival-time]')?.value;
    if (plan.timingMode === 'arrive_at') {
      const unix = attackUnixFromLocal(d, tm);
      if (unix != null) plan.arrivalUnix = unix;
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
  function renderMilitaryHelpers(sec, plan) {
    if (!sec) return;
    // Harassment preset chips
    const har = sec.querySelector('.atk-harass');
    if (har) {
      har.querySelectorAll('[data-harass]').forEach(btn => {
        const on = plan.troopMode === 'harass' && plan.harassPreset === btn.dataset.harass;
        btn.style.outline = on ? '1px solid #6cf' : '';
        btn.style.color = on ? '#6cf' : '';
      });
    }
    // Outgoing cancelable commands
    const box = sec.querySelector('.atk-cmds');
    if (box) {
      const rows = militaryOutgoingMovements();
      box.replaceChildren();
      if (!rows.length) {
        const e = document.createElement('div');
        e.style.cssText = 'color:#666;font-size:10px';
        e.textContent = 'No cancelable outgoing movements';
        box.appendChild(e);
      } else {
        rows.forEach(r => {
          const row = document.createElement('div');
          row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr .7fr auto;gap:4px;font-size:10px;border-bottom:1px solid #2a2a2a;padding:2px 0;align-items:center';
          const c1 = document.createElement('span');
          c1.textContent = `${townNameById(r.home)} → ${r.target}`;
          c1.title = `cmd ${r.commandId}`;
          const c2 = document.createElement('span');
          c2.textContent = r.type || 'move';
          const c3 = document.createElement('span');
          c3.style.color = '#888';
          c3.textContent = r.cancelLeft != null ? (`${Math.round(r.cancelLeft)}s`) : 'ok';
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = 'Cancel';
          btn.style.cssText = 'background:#333;border:1px solid #555;color:#f96;padding:1px 6px;cursor:pointer;font-size:10px';
          btn.addEventListener('click', () => {
            if (!confirm(`Cancel outgoing ${r.type || 'command'} ${r.commandId}?\n${townNameById(r.home)} → ${r.target}`)) return;
            militaryCancelCommand(r.commandId, { confirmed: true, townId: r.home }, (err) => {
              flash(err ? ('cancel failed: ' + err) : 'command cancelled');
              renderAttack();
            });
          });
          row.appendChild(c1); row.appendChild(c2); row.appendChild(c3); row.appendChild(btn);
          box.appendChild(row);
        });
      }
    }
    // Heroes
    const hbox = sec.querySelector('.atk-heroes');
    if (!hbox) return;
    hbox.replaceChildren();
    if (!heroesEnabled()) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#666;font-size:10px';
      e.textContent = 'Heroes disabled on this world';
      hbox.appendChild(e);
      return;
    }
    const heroes = playerHeroesList();
    if (!heroes.length) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#666;font-size:10px';
      e.textContent = 'No PlayerHero models (open Council once, or world has none)';
      hbox.appendChild(e);
      return;
    }
    const townSel = document.createElement('select');
    townSel.style.cssText = 'background:#111;color:#cfc;border:1px solid #333;font-size:10px;margin-bottom:4px;max-width:100%';
    (state.towns || []).forEach(t => {
      const o = document.createElement('option');
      o.value = String(t.id);
      o.textContent = t.name || t.id;
      townSel.appendChild(o);
    });
    hbox.appendChild(townSel);
    heroes.forEach(h => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-size:10px;border-bottom:1px solid #2a2a2a;padding:3px 0';
      const lab = document.createElement('span');
      lab.style.flex = '1';
      lab.textContent = `${h.name} Lv${h.level} · ${h.status}` +
        (h.home ? ` @${townNameById(h.home)}` : '');
      row.appendChild(lab);
      if (h.traveling) {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = 'Cancel travel';
        b.style.cssText = 'background:#333;border:1px solid #555;color:#fc6;padding:1px 6px;cursor:pointer;font-size:10px';
        b.addEventListener('click', () => {
          if (!confirm(`Cancel transfer of ${h.name}?`)) return;
          heroCancelTravel(h.type, { confirmed: true }, (err) => {
            flash(err ? ('hero cancel failed: ' + err) : 'hero travel cancelled');
            renderAttack();
          });
        });
        row.appendChild(b);
      } else if (h.assigned || h.attacking) {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = 'Unassign';
        b.style.cssText = 'background:#333;border:1px solid #555;color:#f96;padding:1px 6px;cursor:pointer;font-size:10px';
        b.addEventListener('click', () => {
          if (!confirm(`Unassign ${h.name} from ${townNameById(h.home || h.origin)}?`)) return;
          heroUnassign(h.type, { confirmed: true }, (err) => {
            flash(err ? ('hero unassign failed: ' + err) : 'hero unassigned');
            renderAttack();
          });
        });
        row.appendChild(b);
      }
      if (!h.injured && !h.attacking && !h.traveling) {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = 'Assign';
        b.style.cssText = 'background:#333;border:1px solid #555;color:#6cf;padding:1px 6px;cursor:pointer;font-size:10px';
        b.addEventListener('click', () => {
          const tid = townSel.value;
          if (!tid) { flash('pick a town'); return; }
          if (!confirm(`Assign ${h.name} → ${townNameById(tid)}?\n(travel time applies)`)) return;
          heroAssignToTown(h.type, tid, { confirmed: true }, (err) => {
            flash(err ? ('hero assign failed: ' + err) : 'hero transfer started');
            renderAttack();
          });
        });
        row.appendChild(b);
      }
      hbox.appendChild(row);
    });
  }
  function bindAttackTab() {
    const sec = panel && panel.querySelector('section[data-tab=attack]');
    if (!sec || sec.dataset.bound) return;
    sec.dataset.bound = '1';
    sec.querySelector('#gb-atk-preview')?.addEventListener('click', () => {
      const plan = readAttackForm();
      const sched = buildAttackSchedule(plan);
      if (sched.error) { flash(sched.error); return; }
      attackPreviewRows = sched.rows;
      gbLog(`attack preview: ${sched.rows.length} towns, skew=${Math.round(sched.skew)}ms`);
      renderAttack();
    });
    sec.querySelector('#gb-atk-arm')?.addEventListener('click', () => {
      const plan = readAttackForm();
      const sched = buildAttackSchedule(plan);
      if (sched.error) { flash(sched.error); return; }
      attackPreviewRows = sched.rows;
      const ok = sched.rows.filter(r => r.boats.ok && r.unitCount && r.status !== 'past' && r.status !== 'no-travel');
      if (!ok.length) { flash('no towns ready'); renderAttack(); return; }
      if (!confirm(`Arm ${ok.length} attack(s) (${plan.timingMode})?`)) return;
      armAttackWave(plan, ok);
    });
    sec.querySelector('#gb-atk-cancel')?.addEventListener('click', () => cancelArmedAttack());
    sec.querySelector('#gb-atk-now')?.addEventListener('click', () => {
      const plan = readAttackForm();
      const sched = buildAttackSchedule(plan);
      if (sched.error) { flash(sched.error); return; }
      attackPreviewRows = sched.rows;
      renderAttack();
      fireAttackNow(plan, sched.rows);
    });
    sec.querySelector('[data-atk=troop]')?.addEventListener('change', () => {
      readAttackForm();
      renderAttack();
    });
    sec.querySelector('[data-atk=timing]')?.addEventListener('change', () => {
      readAttackForm();
      renderAttack();
    });
    sec.querySelector('[data-atk=arrival-date]')?.addEventListener('change', () => readAttackForm());
    sec.querySelector('[data-atk=arrival-time]')?.addEventListener('change', () => readAttackForm());
    sec.querySelector('#gb-atk-src-all')?.addEventListener('click', () => attackSetAllSources(true));
    sec.querySelector('#gb-atk-src-none')?.addEventListener('click', () => attackSetAllSources(false));
    sec.querySelector('#gb-atk-src-off')?.addEventListener('click', () => attackSelectRoleSources(ATTACK_ROLE_OFFENSE));
    sec.querySelector('#gb-atk-src-def')?.addEventListener('click', () => attackSelectRoleSources(ATTACK_ROLE_DEFENSE));
    sec.querySelector('[data-atk=pick]')?.addEventListener('change', (e) => {
      const id = e.target.value;
      if (!id) return;
      const t = attackKnownTargets().find(x => String(x.id) === String(id));
      if (t) applyAttackTarget(t);
      else applyAttackTarget({ id, name: null, x: null, y: null });
    });
    sec.querySelector('#gb-atk-current')?.addEventListener('click', () => {
      const cur = attackCurrentTownId();
      if (!cur) { flash('no town selected in game'); return; }
      if (cur.own) {
        flash('current town is yours — open an enemy city on the map first');
        return;
      }
      applyAttackTarget(cur);
    });
    sec.querySelector('[data-atk=target]')?.addEventListener('change', () => {
      readAttackForm();
      renderAttack();
    });
    sec.querySelectorAll('[data-harass]').forEach(btn => {
      btn.addEventListener('click', () => {
        applyHarassPreset(btn.dataset.harass);
        const troop = sec.querySelector('[data-atk=troop]');
        if (troop) troop.value = 'harass';
        renderAttack();
      });
    });
    sec.querySelector('#gb-atk-cmds-refresh')?.addEventListener('click', () => renderAttack());
    sec.querySelector('#gb-atk-heroes-refresh')?.addEventListener('click', () => renderAttack());
  }

