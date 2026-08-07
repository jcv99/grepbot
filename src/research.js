  // ---------- academy research queue (Phase 8.6) ----------
  // Prefer sniffed bridge; fallback building_academy/research { id: tech, town_id }
  const RESEARCH_CHECK_MS = 45000;
  const RESEARCH_CS_FAST = ['booty', 'ceramics', 'architecture', 'crane', 'shipwright', 'colonize_ship', 'mathematics'];

  function researchEnsureTargets() {
    if (state.researchTargets && typeof state.researchTargets === 'object') return state.researchTargets;
    const t = {};
    RESEARCH_CS_FAST.forEach((k, i) => { t[k] = { order: i, tgt: 1 }; });
    state.researchTargets = t;
    save(STORE.RESEARCH_TARGETS, t);
    return t;
  }
  function researchTownTechs(townId) {
    const uw = gameUw();
    try {
      const t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]);
      if (!t) return null;
      let res = {};
      try { res = (t.researches && t.researches().attributes) || {}; } catch (_) {}
      let acad = 0;
      try { acad = t.getBuildings ? +t.getBuildings().get('academy') : +(t.buildings().attributes || {}).academy; } catch (_) {}
      let orders = [];
      try {
        const col = t.getResearchOrdersCollection && t.getResearchOrdersCollection();
        if (col && col.models) orders = col.models;
        else {
          const mm = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('ResearchOrder');
          if (mm && mm.models) {
            orders = mm.models.filter(m => {
              const a = m.attributes || {};
              return +a.town_id === +townId;
            });
          }
        }
      } catch (_) {}
      return { town: t, techs: res, academy: acad, orders };
    } catch (_) { return null; }
  }
  // Localized display label for a research id. Server tech ids stay English on
  // the wire (`rural_loyalty`, `conscription`, …) whatever the client locale, so
  // the only place a translated string exists is GameData.
  function researchLabel(key) {
    try {
      const uw = gameUw();
      const r = (uw.GameData && uw.GameData.researches && uw.GameData.researches[key]) || null;
      if (r && (r.name || r.title)) return String(r.name || r.title);
    } catch (_) {}
    return '';
  }
  // ---------- affordability preconditions ----------
  // `researchDepsOk` below covers building/research dependencies. What it never
  // checked is whether the town can actually pay: research points and the three
  // resources. Posting a tech the town cannot afford is a guaranteed server
  // rejection that still burns a request-budget slot on every scan.
  // Every read is a probe list; an unreadable field means "unknown", so the
  // check steps aside and lets the server be the authority (see core `gbAfford`).
  function researchDef(tech) {
    try {
      const uw = gameUw();
      return (uw.GameData && uw.GameData.researches && uw.GameData.researches[tech]) || null;
    } catch (_) { return null; }
  }
  // → { wood, stone, iron } or null when the client exposes no cost table.
  function researchCost(tech) {
    const d = researchDef(tech);
    if (!d) return null;
    const src = d.resources || d.costs || d.cost || d;
    const cost = {
      wood: +src.wood || 0,
      stone: +src.stone || 0,
      iron: +src.iron || 0,
    };
    if (!(cost.wood || cost.stone || cost.iron)) return null;
    return cost;
  }
  function researchPointCost(tech) {
    const d = researchDef(tech);
    if (!d) return null;
    const v = gbProbeAttr(d, ['research_points', 'points', 'research_point_cost']);
    return v != null && v > 0 ? v : null;
  }
  function researchPointsAvailable(townId, info) {
    const t = (info && info.town) || gbTownModel(townId);
    if (!t) return null;
    const v = gbProbeNum(t, ['getAvailableResearchPoints', 'getFreeResearchPoints', 'getResearchPoints']);
    if (v != null) return v;
    try {
      const r = t.researches && t.researches();
      const a = (r && r.attributes) || {};
      const av = gbProbeAttr(a, ['available_research_points', 'research_points_available', 'points_available']);
      if (av != null) return av;
      const total = gbProbeAttr(a, ['research_points', 'points']);
      const used = gbProbeAttr(a, ['used_research_points', 'points_used']);
      if (total != null && used != null) return total - used;
    } catch (_) {}
    return null;
  }
  // Can this town pay for this tech right now?
  // → { ok, why } — `why` is null on ok, else a short reason for the log.
  function researchCanAfford(townId, tech, info) {
    const needPts = researchPointCost(tech);
    if (needPts != null) {
      const have = researchPointsAvailable(townId, info);
      if (have != null && have < needPts) return { ok: false, why: `points ${have}/${needPts}` };
    }
    const cost = researchCost(tech);
    if (!cost) {
      gbLogT('research-nocost-' + tech, 900000,
        `research: no cost data for ${tech} — resource check skipped, server decides`);
      return { ok: true, why: null };
    }
    const aff = gbAfford(townId, cost);
    if (!aff.ok) return { ok: false, why: aff.detail };
    return { ok: true, why: null };
  }
  function researchPost(townId, techId, onDone) {
    gameAjaxPost('research', 'building_academy', 'research', {
      id: techId,
      town_id: +townId,
    }, onDone);
  }
  function researchOrderTechId(order) {
    try {
      const a = (order && order.attributes) || order || {};
      return a.research_id || a.research || a.type || a.id || null;
    } catch (_) { return null; }
  }
  function researchDepsOk(townId, info, tech) {
    try {
      const uw = gameUw();
      const def = uw.GameData && uw.GameData.researches && uw.GameData.researches[tech];
      if (!def) return true; // no metadata — don't invent blocks
      const rdeps = def.research_dependencies || def.dependencies || [];
      for (const d of rdeps) {
        const id = typeof d === 'string' ? d : (d && (d.id || d.research_id));
        if (id && !info.techs[id]) return false;
      }
      const bdeps = def.building_dependencies || {};
      let buildings = null;
      try {
        buildings = info.town.getBuildings
          ? info.town.getBuildings().attributes || info.town.getBuildings()
          : (info.town.buildings && info.town.buildings().attributes) || {};
      } catch (_) { buildings = {}; }
      for (const b of Object.keys(bdeps)) {
        const need = +bdeps[b] || 0;
        const have = +((buildings && (buildings[b] || (buildings.attributes && buildings.attributes[b]))) || 0);
        if (have < need) return false;
      }
      // Block when cost fields exist but are null/unknown
      const res = def.resources;
      if (res && typeof res === 'object') {
        if (res.wood == null || res.stone == null || res.iron == null) return false;
      }
      if (def.research_points == null && def.resources == null && Object.prototype.hasOwnProperty.call(def, 'resources')) {
        return false;
      }
      return true;
    } catch (_) { return true; }
  }
  function researchScan(reason) {
    if (!hostEnabled() || !state.autoResearch || captchaPaused('research')) return;
    if (automationPaused({})) return;
    if (gbLocked('research')) return;
    const targets = researchEnsureTargets();
    const ordered = Object.keys(targets).sort((a, b) => (+targets[a].order || 0) - (+targets[b].order || 0));
    let townIds = [];
    try {
      const uw = gameUw();
      townIds = Object.keys((uw.ITowns && uw.ITowns.towns) || {});
    } catch (_) {}
    let job = null;
    for (const tid of townIds) {
      const info = researchTownTechs(tid);
      if (!info || !(info.academy > 0)) continue;
      const queueMax = 2; // free slot; curator may allow more — keep conservative
      if (info.orders.length >= queueMax) continue;
      const queued = new Set();
      info.orders.forEach(o => {
        const id = researchOrderTechId(o);
        if (id != null) queued.add(String(id));
      });
      for (const tech of ordered) {
        if (info.techs[tech]) continue; // already researched
        if (queued.has(String(tech))) continue; // already in academy queue
        const tgt = targets[tech];
        if (!tgt || !tgt.tgt) continue;
        if (!researchDepsOk(tid, info, tech)) continue;
        const aff = researchCanAfford(tid, tech, info);
        if (!aff.ok) {
          gbLogT('research-cant-' + tid + '-' + tech, 300000,
            `research: town ${tid} cannot start ${tech} yet (${aff.why})`);
          continue;
        }
        job = { townId: tid, tech };
        break;
      }
      if (job) break;
    }
    if (!job) {
      gbLogT('research-idle', 180000, `research: idle (${reason || 'scan'})`);
      return;
    }
    gbLock('research');
    researchPost(job.townId, job.tech, (err) => {
      gbUnlock('research');
      if (!err) gbLog(`research: town ${job.townId} → ${job.tech}`);
      else gbLogT('research-err', 60000, `research err ${err}`);
    });
  }
  function researchLoadCsFast() {
    const t = {};
    RESEARCH_CS_FAST.forEach((k, i) => { t[k] = { order: i, tgt: 1 }; });
    state.researchTargets = t;
    save(STORE.RESEARCH_TARGETS, t);
    gbLog('research: loaded CS-fast tech list');
  }
