  // City-role advisor is advisory first: it scores only live, readable town
  // state and changes execution through goalSetProfile(), never by adding jobs
  // or authorizing City Designer strip/demolition work on its own.
  const ROLE_ADVISOR_DEFAULTS = Object.freeze({
    enabled: true,
    autoApply: false,
    lockExisting: true,
    minScoreGap: 8,
    reassessmentHours: 24,
    weights: Object.freeze({ naval: 24, defense: 24, army: 18, research: 12, production: 10, conversion: 1, balance: 12 }),
  });
  const ROLE_ADVISOR_SCAN_MIN_MS = 60000;
  let roleAdvisorLast = { at: 0, signature: 'none', ids: '', rows: [], assignments: {} };

  function roleAdvisorClamp(raw, fallback, lo, hi) {
    const n = gbNum(raw);
    return n == null ? fallback : Math.max(lo, Math.min(hi, n));
  }
  function roleAdvisorCfg() {
    const raw = state.roleAdvisorCfg && typeof state.roleAdvisorCfg === 'object' && !Array.isArray(state.roleAdvisorCfg) ? state.roleAdvisorCfg : {};
    const weights = raw.weights && typeof raw.weights === 'object' && !Array.isArray(raw.weights) ? raw.weights : {};
    const out = {
      enabled: raw.enabled !== false,
      autoApply: raw.autoApply === true,
      lockExisting: raw.lockExisting !== false,
      minScoreGap: roleAdvisorClamp(raw.minScoreGap, ROLE_ADVISOR_DEFAULTS.minScoreGap, 1, 50),
      reassessmentHours: roleAdvisorClamp(raw.reassessmentHours, ROLE_ADVISOR_DEFAULTS.reassessmentHours, 1, 168),
      weights: {},
    };
    for (const key of Object.keys(ROLE_ADVISOR_DEFAULTS.weights)) out.weights[key] = roleAdvisorClamp(weights[key], ROLE_ADVISOR_DEFAULTS.weights[key], 0, 100);
    state.roleAdvisorCfg = out;
    return out;
  }
  function roleAdvisorSetCfg(patch) {
    const prev = roleAdvisorCfg(), next = Object.assign({}, prev, patch || {});
    next.weights = Object.assign({}, prev.weights, patch && patch.weights || {});
    state.roleAdvisorCfg = next;
    const clean = roleAdvisorCfg();
    save(STORE.ROLE_ADVISOR_CFG, clean);
    roleAdvisorInvalidate();
    return clean;
  }
  function roleAdvisorInvalidate() {
    roleAdvisorLast.at = 0;
    roleAdvisorLast.signature = 'none';
  }
  function roleAdvisorAssignments() {
    if (!state.roleAssignments || typeof state.roleAssignments !== 'object' || Array.isArray(state.roleAssignments)) state.roleAssignments = {};
    return state.roleAssignments;
  }
  function roleAdvisorTownIds() {
    const ids = [];
    let readable = false;
    try {
      const towns = townsFromGame();
      if (Array.isArray(towns)) {
        readable = true;
        towns.forEach(t => { if (t && t.id != null) ids.push(String(t.id)); });
      }
    } catch (_) {}
    try {
      const towns = gameUw().ITowns && gameUw().ITowns.towns;
      if (towns && typeof towns === 'object' && Object.keys(towns).length) {
        readable = true;
        Object.keys(towns).forEach(id => ids.push(String(id)));
      }
    } catch (_) {}
    return readable ? [...new Set(ids)].sort() : null;
  }
  function roleAdvisorTownTags(townId) {
    const id = String(townId), tags = [];
    const hasTown = value => Array.isArray(value) ? value.map(String).includes(id) : !!(value && typeof value === 'object' && (value[id] === true || value[id] === 1 || value[id] === 'true'));
    for (const [name, raw] of Object.entries(state.townGroups || {})) {
      if (hasTown(raw) || (raw && typeof raw === 'object' && (hasTown(raw.towns) || hasTown(raw.members) || hasTown(raw.ids)))) tags.push(String(name));
    }
    return tags.sort();
  }
  function roleAdvisorCoast(town) {
    let a = town && town.attributes;
    if (!a && town && typeof town.toJSON === 'function') try { a = town.toJSON(); } catch (_) {}
    if (!a || typeof a !== 'object') return null;
    for (const key of ['coastal', 'is_coastal', 'on_small_island', 'is_on_small_island']) {
      if (!Object.prototype.hasOwnProperty.call(a, key)) continue;
      const v = a[key];
      if (typeof v === 'boolean') return v;
      const n = gbNum(v);
      if (n != null) return n !== 0;
    }
    return null;
  }
  function roleAdvisorGod(town) {
    const a = town && town.attributes;
    if (!a || typeof a !== 'object') return null;
    for (const key of ['god', 'god_id', 'current_god']) {
      const v = a[key];
      if (typeof v === 'string' && v.trim()) return v.trim().toLowerCase();
    }
    return null;
  }
  function roleAdvisorFeature(townId) {
    const id = String(townId);
    let town = null, levels = null, research = null, units = null, production = null;
    try { town = gbTownModel(id); } catch (_) {}
    try { levels = abActualLevels(id); } catch (_) {}
    try { research = researchTownTechs(id); } catch (_) {}
    try { units = goalUnitCountsState(id); } catch (_) {}
    try { production = economyProductionRate(id); } catch (_) {}
    let threat = { known: false, threatened: false };
    try { threat = cdThreatState(id); } catch (_) {}
    const currentRole = cdCanonicalProfile(goalTownCfg(id).profile);
    const unitCounts = units && units.known && units.counts && typeof units.counts === 'object' ? units.counts : null;
    const techs = research && research.techs && typeof research.techs === 'object' ? research.techs : null;
    const productionRead = production && typeof production === 'object' && GB_RES_KEYS.every(key => { const n = gbNum(production[key]); return n != null && n >= 0; }) ? Object.fromEntries(GB_RES_KEYS.map(key => [key, gbNum(production[key])])) : null;
    const f = {
      id,
      currentRole,
      levels: levels && typeof levels === 'object' ? levels : null,
      techs,
      units: unitCounts,
      coast: roleAdvisorCoast(town),
      production: productionRead,
      threatened: threat && threat.known === true ? !!threat.threatened : null,
      god: roleAdvisorGod(town),
      tags: roleAdvisorTownTags(id),
    };
    f.readable = {
      buildings: !!f.levels,
      research: !!f.techs,
      units: !!f.units,
      coast: typeof f.coast === 'boolean',
      production: !!f.production,
      threat: f.threatened != null,
    };
    f.fingerprint = JSON.stringify({ currentRole:f.currentRole, levels:f.levels, techs:f.techs, units:f.units, coast:f.coast, production:f.production, threatened:f.threatened, god:f.god, tags:f.tags });
    return f;
  }
  function roleAdvisorProfileKind(profile) {
    const p = cdCanonicalProfile(profile);
    if (p === 'cd_defense') return 'defense';
    if (p === 'cd_slinger_50ls') return 'mixed';
    return 'naval';
  }
  function roleAdvisorTargetCompletion(feature, profile) {
    let targets = null, done = 0, total = 0;
    try { targets = cdResearchTargets(feature.id, profile); } catch (_) {}
    if (!feature.techs || !targets) return { known: false, value: 0 };
    for (const [tech, row] of Object.entries(targets)) {
      if (tech === '__cdUnresolved' || !row || !row.tgt) continue;
      total++;
      if (feature.techs[tech]) done++;
    }
    return { known: true, value: total ? done / total : 0 };
  }
  function roleAdvisorUnitCompletion(feature, profile) {
    let targets = null;
    try { targets = cdRecruitTargets(feature.id, profile); } catch (_) {}
    if (!targets || targets.__cdFeasible === false || !feature.units) return { known: false, value: 0 };
    let done = 0, total = 0;
    for (const [unit, raw] of Object.entries(targets)) {
      if (unit.startsWith('__')) continue;
      const want = gbNum(raw), have = gbNum(feature.units[unit]);
      if (want == null || want <= 0 || have == null) continue;
      total++;
      done += Math.min(1, have / want);
    }
    return { known: total > 0, value: total ? done / total : 0 };
  }
  function roleAdvisorConversion(feature, profile) {
    const result = { known: true, buildingLevels: 0, researches: 0, units: 0, unresolved: [] };
    let build = null, research = null, recruits = null;
    try { build = cdBaseBuild(profile, feature.id); } catch (_) { result.known = false; result.unresolved.push('build'); }
    try { research = cdResearchTargets(feature.id, profile); } catch (_) { result.known = false; result.unresolved.push('research'); }
    try { recruits = cdRecruitTargets(feature.id, profile); } catch (_) { result.known = false; result.unresolved.push('units'); }
    if (!feature.levels) { result.known = false; result.unresolved.push('levels'); }
    else for (const [building, raw] of Object.entries(build || {})) {
      const want = gbNum(raw), have = gbNum(feature.levels[building]);
      if (want == null || have == null) { result.known = false; continue; }
      result.buildingLevels += Math.max(0, Math.floor(want - have));
    }
    if (!feature.techs) { result.known = false; result.unresolved.push('techs'); }
    else for (const [tech, row] of Object.entries(research || {})) if (tech !== '__cdUnresolved' && row && row.tgt && !feature.techs[tech]) result.researches++;
    if (!recruits || recruits.__cdFeasible === false || !feature.units) { result.known = false; result.unresolved.push('army'); }
    else for (const [unit, raw] of Object.entries(recruits)) {
      if (unit.startsWith('__')) continue;
      const want = gbNum(raw), have = gbNum(feature.units[unit]);
      if (want == null || have == null) { result.known = false; continue; }
      result.units += Math.max(0, Math.floor(want - have));
    }
    result.points = result.buildingLevels + result.researches * 8 + Math.min(100, result.units / 100);
    return result;
  }
  function roleAdvisorCandidate(feature, profile, profileCounts, totalTowns, cfg) {
    const kind = roleAdvisorProfileKind(profile), reasons = [], components = {};
    let fit = 18;
    if (kind === 'naval') {
      if (feature.coast === true) { fit += cfg.weights.naval; components.coast = cfg.weights.naval; reasons.push('capacidad naval leible'); }
      else if (feature.coast === false) { fit -= cfg.weights.naval / 3; components.coast = -cfg.weights.naval / 3; reasons.push('sin indicador costero'); }
      else reasons.push('costa no leible');
      const docks = gbNum(feature.levels && feature.levels.docks);
      if (docks != null) { const v = Math.min(12, docks / 30 * 12); fit += v; components.docks = v; }
    } else if (kind === 'defense') {
      if (feature.threatened === true) { fit += cfg.weights.defense; components.threat = cfg.weights.defense; reasons.push('amenaza entrante'); }
      else if (feature.threatened === false) { fit += cfg.weights.defense * 0.25; components.threat = cfg.weights.defense * 0.25; reasons.push('sin amenaza entrante'); }
      else reasons.push('amenazas no legibles');
      const wall = gbNum(feature.levels && feature.levels.wall);
      if (wall != null) { const v = Math.min(10, wall / 25 * 10); fit += v; components.wall = v; }
    } else {
      const slinger = gbNum(feature.units && feature.units.slinger);
      if (slinger != null && slinger > 0) { const v = Math.min(12, slinger / 1000 * 12); fit += v; components.slinger = v; }
      if (feature.coast === true) { fit += cfg.weights.naval * 0.45; components.coast = cfg.weights.naval * 0.45; reasons.push('mezcla terrestre/naval posible'); }
    }
    const research = roleAdvisorTargetCompletion(feature, profile);
    if (research.known) { const v = research.value * cfg.weights.research; fit += v; components.research = v; }
    else reasons.push('investigacion no legible');
    const army = roleAdvisorUnitCompletion(feature, profile);
    if (army.known) { const v = army.value * cfg.weights.army; fit += v; components.army = v; }
    else reasons.push('ejercito no legible');
    if (feature.production) {
      const p = feature.production;
      const raw = kind === 'defense' ? p.iron + p.stone : p.wood + p.iron;
      const v = Math.min(cfg.weights.production, Math.max(0, raw) / 2000 * cfg.weights.production);
      fit += v; components.production = v;
    } else reasons.push('produccion no legible');
    if (feature.tags.some(tag => /defen|naval|mar|fleet|flota/i.test(tag))) { fit += 6; components.group = 6; reasons.push('grupo de ciudad coincide'); }
    if (feature.god) reasons.push('dios: ' + feature.god);
    const conversion = roleAdvisorConversion(feature, profile);
    const conversionPenalty = conversion.known ? Math.min(55, conversion.points * cfg.weights.conversion) : 0;
    const balance = totalTowns ? ((profileCounts[profile] || 0) / totalTowns) * cfg.weights.balance : 0;
    const score = Math.round(Math.max(0, fit - conversionPenalty - balance));
    const readable = Object.values(feature.readable).filter(Boolean).length;
    return { profile, fit:Math.round(fit), conversion, balance:Math.round(balance * 10) / 10, score, confidence:readable >= 5 ? 'alta' : readable >= 3 ? 'media' : 'baja', reasons, components };
  }
  function roleAdvisorReassess(force) {
    const cfg = roleAdvisorCfg(), now = Date.now(), current = roleAdvisorAssignments();
    if (!cfg.enabled) return roleAdvisorLast = { enabled:false, at:now, signature:'disabled', ids:'', rows:[], assignments:current };
    const ids = roleAdvisorTownIds();
    if (!ids) return roleAdvisorLast = { enabled:true, at:now, signature:'unreadable', ids:roleAdvisorLast.ids || '', rows:[], assignments:current, unreadable:true };
    const idKey = ids.join('|');
    if (!force && !roleAdvisorLast.unreadable && roleAdvisorLast.at && idKey === roleAdvisorLast.ids && now - roleAdvisorLast.at < ROLE_ADVISOR_SCAN_MIN_MS) return roleAdvisorLast;
    const features = ids.map(roleAdvisorFeature);
    const dueMs = cfg.reassessmentHours * 3600000;
    const stale = !!force || roleAdvisorLast.unreadable || idKey !== roleAdvisorLast.ids || features.some(f => {
      const prev = current[f.id];
      return !prev || prev.fingerprint !== f.fingerprint || now - (+prev.assessedAt || 0) >= dueMs;
    });
    if (!stale && roleAdvisorLast.at) return roleAdvisorLast;
    const profiles = Object.keys(CD_PROFILE_DEFAULTS || {}).filter(cdIsProfile).sort();
    const initialCounts = Object.create(null);
    for (const f of features) if (profiles.includes(f.currentRole)) initialCounts[f.currentRole] = (initialCounts[f.currentRole] || 0) + 1;
    const firstPicks = features.map(f => {
      const candidates = profiles.map(p => roleAdvisorCandidate(f, p, initialCounts, features.length, cfg));
      candidates.sort((a, b) => b.score - a.score || a.profile.localeCompare(b.profile));
      return candidates[0] && candidates[0].profile;
    });
    const proposalCounts = Object.create(null);
    firstPicks.forEach(p => { if (p) proposalCounts[p] = (proposalCounts[p] || 0) + 1; });
    const next = {}, rows = [];
    for (const f of features) {
      const candidates = profiles.map(p => roleAdvisorCandidate(f, p, proposalCounts, features.length, cfg));
      candidates.sort((a, b) => b.score - a.score || a.profile.localeCompare(b.profile));
      const prev = current[f.id] && typeof current[f.id] === 'object' ? current[f.id] : {};
      let selected = candidates[0] || null;
      const previousCandidate = candidates.find(c => c.profile === prev.proposedRole);
      if (previousCandidate && selected && selected.profile !== previousCandidate.profile && selected.score - previousCandidate.score < cfg.minScoreGap) selected = previousCandidate;
      if (prev.userLock === true) selected = candidates.find(c => c.profile === f.currentRole) || selected;
      if (!selected) continue;
      const changed = prev.proposedRole !== selected.profile;
      const rec = {
        currentRole:f.currentRole, proposedRole:selected.profile, score:selected.score, fit:selected.fit,
        conversion:selected.conversion, balance:selected.balance, confidence:selected.confidence,
        reasons:selected.reasons, components:selected.components,
        priorRole:prev.currentRole || f.currentRole, userLock:prev.userLock === true,
        fingerprint:f.fingerprint, assessedAt:now, proposedAt:changed ? now : (+prev.proposedAt || now), appliedAt:+prev.appliedAt || 0,
      };
      next[f.id] = rec;
      rows.push(Object.assign({ id:f.id }, rec));
    }
    const changed = JSON.stringify(current) !== JSON.stringify(next);
    state.roleAssignments = next;
    if (changed) save(STORE.ROLE_ASSIGNMENTS, next);
    if (cfg.autoApply && !automationPaused({})) for (const row of rows) roleAdvisorApply(row.id, { auto:true, silent:true });
    const signature = JSON.stringify(rows.map(r => [r.id,r.currentRole,r.proposedRole,r.score,r.userLock,r.fingerprint]));
    roleAdvisorLast = { enabled:true, at:now, signature, ids:idKey, rows, assignments:next };
    return roleAdvisorLast;
  }
  function roleAdvisorSetLock(townId, locked) {
    const id = String(townId), all = roleAdvisorAssignments(), rec = all[id];
    if (!rec) return false;
    rec.userLock = !!locked;
    rec.lockedAt = locked ? Date.now() : 0;
    save(STORE.ROLE_ASSIGNMENTS, all);
    roleAdvisorLast.at = 0;
    return rec.userLock;
  }
  function roleAdvisorApply(townId, opts) {
    const o = opts || {}, id = String(townId), rec = roleAdvisorAssignments()[id], cfg = roleAdvisorCfg();
    if (!rec || rec.userLock || !cdIsProfile(rec.proposedRole)) return false;
    const currentRole = cdCanonicalProfile(goalTownCfg(id).profile);
    if (currentRole === rec.proposedRole) return true;
    if (o.auto && cfg.lockExisting && currentRole !== 'custom') return false;
    if (!goalSetProfile(id, rec.proposedRole)) return false;
    rec.priorRole = currentRole;
    rec.currentRole = rec.proposedRole;
    rec.appliedAt = Date.now();
    save(STORE.ROLE_ASSIGNMENTS, roleAdvisorAssignments());
    if (!o.silent) flash('perfil aplicado: ' + rec.proposedRole + ' en ' + id);
    return true;
  }
  function roleAdvisorTick() {
    const cfg = roleAdvisorCfg();
    if (!cfg.enabled) return false;
    roleAdvisorReassess(false);
    return true;
  }
  function roleAdvisorMembership(snapshot) {
    if (!snapshot) return 'none';
    const ids = [...new Set((snapshot.rows || []).map(row => String(row.id)))].sort();
    return (snapshot.enabled ? 'on' : 'off') + ':' + ids.join('|');
  }
  function roleAdvisorName(townId) {
    try { const t = gbTownModel(townId); return (t && t.getName && t.getName()) || String(townId); } catch (_) { return String(townId); }
  }
  function roleAdvisorRender(host, snapshot, rerender) {
    const wrap = document.createElement('details');
    wrap.className = 'gb-section'; wrap.open = false;
    const summary = document.createElement('summary');
    summary.textContent = 'Asesor de roles de ciudades'; wrap.appendChild(summary);
    const body = document.createElement('div'); body.className = 'gb-section-body'; body.style.cssText = 'font-size:9px;overflow:auto'; wrap.appendChild(body);
    const controls = document.createElement('div'); controls.style.cssText = 'display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-bottom:5px';
    const recalc = gbButton('Recalcular', { title:'Relee edificios, investigacion, ejercito, produccion y amenazas sin cambiar perfiles', style:'font-size:9px', onClick:() => { roleAdvisorReassess(true); rerender(); } });
    controls.appendChild(recalc);
    const apply = gbButton('Aplicar seleccionadas', { title:'Aplica perfiles solo a las filas marcadas. No encola acciones ni autoriza strip.', style:'font-size:9px', onClick:() => {
      let n = 0;
      body.querySelectorAll('input[data-role-apply]').forEach(input => { if (input.checked && roleAdvisorApply(input.dataset.roleApply, { auto:false })) n++; });
      if (n) roleAdvisorReassess(true); else flash('ninguna propuesta aplicable seleccionada');
      rerender();
    } });
    controls.appendChild(apply);
    const note = document.createElement('span');
    note.style.color = '#999';
    note.textContent = snapshot.enabled ? 'Solo propone; strip/demolicion siguen bloqueados por sus propios gates.' : 'Asesor desactivado en Ajustes.';
    controls.appendChild(note); body.appendChild(controls);
    if (!snapshot.enabled) { host.appendChild(wrap); return; }
    const header = document.createElement('div'); header.style.cssText = 'display:grid;grid-template-columns:18px 1.2fr 1fr 1fr .45fr 1fr 1.6fr 28px;gap:3px;color:#888;border-bottom:1px solid #333;padding:2px';
    ['','ciudad','actual','propuesta','score','conversion','motivos','lock'].forEach(text => { const el = document.createElement('span'); el.textContent = text; header.appendChild(el); });
    body.appendChild(header);
    for (const row of snapshot.rows || []) {
      const line = document.createElement('div'); line.style.cssText = 'display:grid;grid-template-columns:18px 1.2fr 1fr 1fr .45fr 1fr 1.6fr 28px;gap:3px;border-bottom:1px solid #222;padding:2px;align-items:center';
      const select = document.createElement('input'); select.type = 'checkbox'; select.dataset.roleApply = row.id; select.disabled = !!row.userLock || row.currentRole === row.proposedRole; line.appendChild(select);
      const cells = [roleAdvisorName(row.id), row.currentRole, row.proposedRole, String(row.score), row.conversion && row.conversion.known ? `B${row.conversion.buildingLevels}/I${row.conversion.researches}/U${Math.floor(row.conversion.units)}` : '\u2014', (row.reasons || []).concat('confianza ' + row.confidence).join('; ')];
      cells.forEach(value => { const el = document.createElement('span'); el.textContent = value; line.appendChild(el); });
      const lock = document.createElement('input'); lock.type = 'checkbox'; lock.checked = !!row.userLock; lock.title = 'Bloqueo persistente: el asesor no cambiara esta ciudad hasta quitarlo';
      lock.addEventListener('change', () => { roleAdvisorSetLock(row.id, lock.checked); rerender(); }); line.appendChild(lock);
      body.appendChild(line);
    }
    host.appendChild(wrap);
  }
