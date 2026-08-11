  function researchEnsureTargets() {
    if (state.researchTargets && typeof state.researchTargets === 'object') return state.researchTargets;
    const t = {};
    RESEARCH_CS_FAST.forEach((k, i) => { t[k] = { order: i, tgt: 1 }; });
    state.researchTargets = t;
    save(STORE.RESEARCH_TARGETS, t);
    return t;
  }
  // ITowns.addToTowns builds each Town with building-order, unit-order, unit,
  // supporting-unit, god and casted-power fragments — there is NO research-order
  // fragment, so there is no per-town equivalent of `buildingOrders()`. The MM
  // working copy registered under `ResearchOrder` is a TownAgnosticCollection
  // fragment that is reset() to the open town on every town switch, so reading
  // it for another town used to silently yield `[]` — and an empty list reads as
  // "nothing queued, slot free" to every caller. The queue-full and
  // already-queued gates then passed for every town but the open one.
  //
  // Returns { orders, known }. `known:false` means "unreadable", never "empty".
  function researchOrdersFor(townId) {
    const uw = gameUw();
    const want = String(townId);
    let current = null;
    try { if (uw.Game && uw.Game.townId != null) current = String(uw.Game.townId); } catch (_) {}
    const isCurrent = current != null && want === current;
    // Per-town fragment. getFragment() CREATES an empty fragment on miss, so a
    // zero-length result is only trustworthy for the open town.
    try {
      const col = uw.MM && uw.MM.getFirstTownAgnosticCollectionByName
        && uw.MM.getFirstTownAgnosticCollectionByName('ResearchOrder');
      const frag = col && col.getFragment && col.getFragment(want);
      const models = frag && frag.models;
      if (models && models.length) return { orders: models.slice(), known: true };
      if (models && isCurrent) return { orders: [], known: true };
    } catch (_) {}
    // Flat model sweep. If the client holds a ResearchOrder for some town OTHER
    // than the open one, the server pushes them world-wide — so "no models for
    // this town" is then a real empty queue, not a missing fragment.
    try {
      const raw = uw.MM && uw.MM.getModels && uw.MM.getModels().ResearchOrder;
      const list = raw ? (Array.isArray(raw) ? raw : Object.keys(raw).map(k => raw[k])) : null;
      if (list) {
        const townOf = m => String(((m && m.attributes) || {}).town_id);
        const mine = list.filter(m => townOf(m) === want);
        if (mine.length) return { orders: mine, known: true };
        if (isCurrent) return { orders: [], known: true };
        if (current != null && list.some(m => townOf(m) !== current)) return { orders: [], known: true };
      }
    } catch (_) {}
    // Working copy — authoritative for the open town only.
    try {
      const mm = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('ResearchOrder');
      if (mm && mm.models && isCurrent) return { orders: mm.models.slice(), known: true };
    } catch (_) {}
    return { orders: [], known: false };
  }
  function researchTownTechs(townId) {
    const uw = gameUw();
    try {
      const t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]);
      if (!t) return null;
      let res = {};
      try { res = (t.researches && t.researches().attributes) || {}; } catch (_) {}
      let buildings = null;
      try {
        const b = t.getBuildings ? t.getBuildings() : (t.buildings && t.buildings());
        buildings = (b && (b.attributes || b)) || null;
      } catch (_) {}
      let acad = 0;
      try { acad = t.getBuildings ? +t.getBuildings().get('academy') : +(buildings || {}).academy; } catch (_) {}
      // getAdditionalResearchPoints() keys off hasLibrary() === (level === 1),
      // so the level itself has to be readable, not just its truthiness.
      let library = null;
      try {
        if (t.getBuildings) { const v = +t.getBuildings().get('library'); if (isFinite(v)) library = v; }
        if (library == null && buildings && buildings.library != null) library = +buildings.library || 0;
      } catch (_) {}
      // `requires_farming_villages` techs are rejected outright on a small
      // island — the game's own can_be_bought includes `!(requires && small)`.
      // The flag lives on the town MODEL (`getTownModelReference().get(...)` in
      // the academy controller); which of these reaches it depends on the build,
      // so probe them all. Unreadable stays null and the gate simply does not
      // fire — it must never guess `false` into a guaranteed rejection.
      let smallIsland = null;
      try {
        const probes = [
          () => (t.get ? t.get('on_small_island') : undefined),
          () => ((t.attributes || {}).on_small_island),
          () => (t.getTownModelReference && t.getTownModelReference().get('on_small_island')),
          () => (t.isOnSmallIsland && t.isOnSmallIsland()),
        ];
        for (const p of probes) {
          let raw;
          try { raw = p(); } catch (_) { continue; }
          if (raw != null) { smallIsland = !!raw; break; }
        }
      } catch (_) {}
      const q = researchOrdersFor(townId);
      return {
        town: t,
        techs: res,
        academy: acad,
        library,
        smallIsland,
        orders: q.orders,
        ordersKnown: q.known,
      };
    } catch (_) { return null; }
  }
  // GameDataConstructionQueue.getResearchOrdersQueueLength() -> hasCurator()?7:2.
  // The old hardcoded 2 capped Curator accounts at a third of their real queue.
  function researchQueueMax() {
    try {
      const uw = gameUw();
      const q = uw.GameDataConstructionQueue;
      if (q && q.getResearchOrdersQueueLength) {
        const n = +q.getResearchOrdersQueueLength();
        if (Number.isFinite(n) && n > 0) return n;
      }
      const p = uw.GameDataPremium;
      if (p && p.hasCurator && p.hasCurator()) return 7;
      if (p && p.isAdvisorActivated && p.isAdvisorActivated('curator')) return 7;
    } catch (_) {}
    return 2; // conservative base-game queue only
  }

  // ===== Research path advisor (v4 plan 2.10) ================================
  // Read-only. Feeds verified definitions + live town state into the pure graph
  // helpers and returns a REORDERING of the caller's own target list.
  function researchHaveSet(info, queuedIds) {
    const have = new Set();
    for (const k of Object.keys((info && info.techs) || {})) if (info.techs[k]) have.add(String(k));
    for (const q of (queuedIds || [])) have.add(String(q));
    return have;
  }
  // ===== Academy slot optimizer (v4 plan 5.5) ================================
  // Ranks the eligible candidates the existing loop already validated. It never
  // invents a research id, never starts a prerequisite, and never overrides
  // researchValidateJob - which still runs after the pick, because the queue
  // can change between ranking and posting.
  //
  // Every factor is a value that was actually READ. An unreadable one simply
  // does not contribute, and the configured order remains the tie-break, so a
  // blind world behaves exactly like it does today.
  const RESEARCH_CANDIDATE_MAX = 24;
  function researchCandidate(townId, tech, targets, info) {
    const tgt = (targets || {})[tech] || {};
    let missing = null;
    try {
      const p = researchPathFor(townId, tech);
      if (p && p.known) missing = p.missing.length;
    } catch (_) {}
    // A tech named in this town's own profile is an explicit user preference,
    // which outranks the global order.
    let profiled = false;
    try {
      const e = goalEffective(townId);
      profiled = !!(e && e.research && +e.research[tech] > 0);
    } catch (_) {}
    let points = null;
    try { const n = researchPointsAvailable(townId, info); if (Number.isFinite(n)) points = n; } catch (_) {}
    // researchCost returns wood/stone/iron only, so the research-POINT cost has
    // to come off the definition. Probe candidates; a miss leaves cost null and
    // the slack factor simply does not contribute.
    let cost = null;
    try {
      const d = gbGameDataLookup("researches", tech);
      if (d) {
        for (const k of ['research_points', 'researchPoints', 'points', 'cost_points']) {
          const n = +d[k];
          if (Number.isFinite(n) && n > 0) { cost = n; break; }
        }
      }
    } catch (_) {}
    return {
      townId: String(townId), tech,
      order: +tgt.order || 0,
      missing, profiled, points, cost,
      // Slack is only meaningful when BOTH numbers were readable.
      slack: (points != null && cost != null) ? points - cost : null,
    };
  }
  function researchCandidateCmp(a, b) {
    // 1. explicit per-town profile preference
    if (a.profiled !== b.profiled) return a.profiled ? -1 : 1;
    // 2. fewer missing prerequisites, when the graph could read them at all
    const am = a.missing == null ? Infinity : a.missing;
    const bm = b.missing == null ? Infinity : b.missing;
    if (am !== bm) return am - bm;
    // 3. more research-point slack left after starting it
    const as = a.slack == null ? -Infinity : a.slack;
    const bs = b.slack == null ? -Infinity : b.slack;
    if (as !== bs) return bs - as;
    // 4. configured order, then town id - fully deterministic.
    if (a.order !== b.order) return a.order - b.order;
    return String(a.townId).localeCompare(String(b.townId));
  }
  function researchCandidateWhy(c) {
    const parts = [];
    if (c.profiled) parts.push('perfil');
    parts.push(c.missing == null ? 'prerreq ?' : `prerreq ${c.missing}`);
    if (c.slack != null) parts.push(`holgura ${c.slack}`);
    parts.push(`orden ${c.order}`);
    return parts.join(', ');
  }
  function researchAdviseOrder(townId, ordered, targets, info) {
    try {
      const graph = researchGraphBuild();
      if (!graph.known) {
        gbLogT('research-graph-blind', 600000, `research graph blind: ${graph.why}`);
        return ordered;
      }
      // Only trust the queue when it was actually read: treating an unread
      // queue as empty is fine (nothing is claimed), treating it as authoritative
      // would mark techs as satisfied that may not be queued at all.
      const queued = (info && info.ordersKnown ? info.orders : []).map(researchOrderTechId).filter(x => x != null);
      const have = researchHaveSet(info, queued);
      const idx = t => (+((targets || {})[t] || {}).order || 0);
      const ranked = researchGraphRank(graph, ordered, have, idx);
      if (graph.blind) gbLogT('research-graph-partial', 600000, `research graph partial: ${graph.why}`);
      return ranked.map(r => r.tech);
    } catch (e) {
      gbLogT('research-graph-err', 600000, 'research graph: ' + String(e).slice(0, 60));
      return ordered;
    }
  }
  // {known, blind, target, missing:[{id,label}], why} for the panel. Never
  // returns an empty path to mean "unreadable" - `known:false` says so.
  function researchPathFor(townId, target) {
    const graph = researchGraphBuild();
    if (!graph.known) return { known: false, blind: true, target, missing: [], why: graph.why };
    const info = researchTownTechs(townId);
    if (!info) return { known: false, blind: true, target, missing: [], why: 'town unreadable' };
    if (!info.techs) return { known: false, blind: true, target, missing: [], why: 'researched flags unreadable' };
    const queued = (info.ordersKnown ? info.orders : []).map(researchOrderTechId).filter(x => x != null);
    const c = researchGraphClosure(graph, target, researchHaveSet(info, queued));
    return {
      known: !c.blind,
      blind: c.blind,
      target,
      ordersKnown: !!info.ordersKnown,
      missing: c.missing.map(id => ({ id, label: researchLabel(id) || id })),
      why: c.why || (c.blind ? 'camino no legible' : ''),
    };
  }
  // The next target the advisor would rank first for this town, or null.
  function researchNextTargetFor(townId) {
    try {
      const info = researchTownTechs(townId);
      if (!info) return null;
      // Read state directly: researchEnsureTargets() SAVES, and this is called
      // from a render path that must not write storage.
      const targets = goalEffectiveResearchTargets(townId, state.researchTargets || {});
      const ordered = Object.keys(targets)
        .filter(t => targets[t] && targets[t].tgt && !(info.techs || {})[t])
        .sort((a, b) => (+targets[a].order || 0) - (+targets[b].order || 0));
      if (!ordered.length) return null;
      return researchAdviseOrder(townId, ordered, targets, info)[0] || null;
    } catch (_) { return null; }
  }

  function researchLabel(key) {
    try {
      const uw = gameUw();
      const r = (uw.GameData && uw.GameData.researches && uw.GameData.researches[key]) || null;
      if (r && (r.name || r.title)) return String(r.name || r.title);
    } catch (_) {}
    return '';
  }

  // GameDataResearches.getResearchCosts = resources x
  // GeneralModifications.getResearchResourcesModification(townId) (the Apheledes
  // hero discount). Reading the raw `resources` over-estimated the cost.
  function researchResMod(townId) {
    try {
      const uw = gameUw();
      const g = uw.GeneralModifications;
      if (!(g && g.getResearchResourcesModification)) return null;
      const v = +g.getResearchResourcesModification(townId != null ? townId : (uw.Game && uw.Game.townId));
      return isFinite(v) && v > 0 ? v : null;
    } catch (_) { return null; }
  }
  function researchCost(tech, townId) {
    const d = gbGameDataLookup("researches", tech);
    if (!d) return null;
    const src = d.resources || d.costs || d.cost || d;
    const cost = {
      wood: +src.wood || 0,
      stone: +src.stone || 0,
      iron: +src.iron || 0,
    };
    if (!(cost.wood || cost.stone || cost.iron)) return null;
    // An unreadable modifier keeps the raw (higher) cost — conservative.
    const mod = researchResMod(townId);
    if (mod != null && mod !== 1) {
      cost.wood = Math.ceil(cost.wood * mod);
      cost.stone = Math.ceil(cost.stone * mod);
      cost.iron = Math.ceil(cost.iron * mod);
    }
    return cost;
  }
  function researchPointCost(tech) {
    const d = gbGameDataLookup("researches", tech);
    if (!d) return null;
    const v = gbProbeAttr(d, ['research_points', 'research_points_cost', 'points', 'research_point_cost']);
    return v != null && v > 0 ? v : null;
  }
  function researchConstant(name) {
    try {
      const c = gameUw().Game && gameUw().Game.constants && gameUw().Game.constants.academy;
      const v = c ? +c[name] : NaN;
      return isFinite(v) ? v : null;
    } catch (_) { return null; }
  }
  // getCurrentResearchPoints() drops one academy level while the academy is
  // being torn down. Unreadable order collection -> null; the caller treats that
  // as "not tearing down", which is the overwhelmingly common case.
  function researchAcademyTearingDown(townId) {
    try {
      const t = gbTownModel(townId);
      const col = t && ((t.buildingOrders && t.buildingOrders())
        || (t.getCollection && t.getCollection('building_orders')));
      if (!col) return null;
      if (col.isBuildingTearingDown) return !!col.isBuildingTearingDown('academy');
      const models = col.models || [];
      for (const m of models) {
        const a = (m && m.attributes) || {};
        const bid = (m && m.getBuildingId && m.getBuildingId()) || a.building_id;
        if (String(bid) !== 'academy') continue;
        if (m.isBeingTearingDown) { if (m.isBeingTearingDown()) return true; continue; }
        if (a.level_to != null && a.level_from != null && +a.level_to < +a.level_from) return true;
      }
      return false;
    } catch (_) { return null; }
  }
  // Sum of research_points over every tech that is researched OR sitting in the
  // real queue — mirrors AcademyBaseController.getSpentResearchPoints().
  function researchPointsSpent(info) {
    if (!info || !info.techs) return null;
    // A queued tech counts as spent, so an unreadable queue makes the whole sum
    // unknown. Guessing low here posts research the player cannot pay for.
    if (!info.ordersKnown) return null;
    let all = null;
    try { all = gameUw().GameData && gameUw().GameData.researches; } catch (_) {}
    if (!all || typeof all !== 'object') return null;
    const queued = new Set();
    (info.orders || []).forEach(o => { const id = researchOrderTechId(o); if (id != null) queued.add(String(id)); });
    let sum = 0;
    for (const k of Object.keys(all)) {
      if (!info.techs[k] && !queued.has(String(k))) continue;
      const pts = gbProbeAttr(all[k], ['research_points', 'research_points_cost', 'points', 'research_point_cost']);
      if (pts == null) return null;
      sum += pts;
    }
    return sum;
  }
  // H1 root cause: getAvailableResearchPoints / getFreeResearchPoints /
  // getResearchPoints do not exist on the ITowns town proxy — the first lives on
  // GameControllers.AcademyBaseController and the other two do not exist at all.
  // The `researches()` fallback could never help either: that model's attributes
  // are {<tech>: bool}. So this returned null for every tech in every town and
  // researchCanAfford never returned ok. Port the controller's own formula.
  function researchPointsAvailable(townId, info) {
    const t = (info && info.town) || gbTownModel(townId);
    // Probe anyway: a client build may still expose it on the proxy.
    const direct = gbProbeNum(t, ['getAvailableResearchPoints', 'getFreeResearchPoints', 'getResearchPoints']);
    if (direct != null) return direct;
    if (!info) return null;
    const perAcademy = researchConstant('points_per_academy_level');
    if (perAcademy == null) return null;
    const acad = +info.academy;
    if (!isFinite(acad) || acad < 0) return null;
    const level = researchAcademyTearingDown(townId) === true ? Math.max(0, acad - 1) : acad;
    let current = level * perAcademy;
    if (info.library == null) return null;
    if (info.library === 1) {
      const perLibrary = researchConstant('points_per_library_level');
      if (perLibrary == null) return null;
      current += perLibrary;
    }
    const spent = researchPointsSpent(info);
    if (spent == null) return null;
    return current - spent;
  }

  // Every verdict carries `blind`. A value we could not read must never block a
  // post (CLAUDE.md precondition invariant) — it logs once and the server is the
  // authority. Only a value we actually read may return ok:false.
  function researchCanAfford(townId, tech, info) {
    let blind = false;
    let blindWhy = null;
    // A tech absent from GameData is not blind — there is no id to post and the
    // server would reject it. researchCost() also returns null here, so without
    // this guard an unknown tech would fall through as a blind pass.
    if (!gbGameDataLookup("researches", tech)) return { ok: false, blind: false, why: 'tech unknown' };
    const needPts = researchPointCost(tech);
    const have = researchPointsAvailable(townId, info);
    if (needPts == null || have == null) {
      blind = true;
      blindWhy = needPts == null ? 'research point cost unreadable' : 'available research points unreadable';
      gbLogT('research-blind-pts-' + townId, 600000,
        `research: ${blindWhy} @${townId} - letting the server decide`);
    } else if (have < needPts) {
      return { ok: false, blind: false, why: `points ${have}/${needPts}` };
    }
    const cost = researchCost(tech, townId);
    if (!cost) {
      gbLogT('research-blind-cost-' + tech, 600000, `research: resource cost for ${tech} unreadable - letting the server decide`);
      return { ok: true, blind: true, why: 'resource cost unreadable' };
    }
    const aff = gbAfford(townId, cost);
    const readShort = (aff.short || []).filter(s => !/unreadable/.test(s));
    if (readShort.length) return { ok: false, blind: false, why: readShort.join(', ') };
    if (aff.blind) {
      gbLogT('research-blind-res-' + townId, 600000, `research: ${aff.detail || 'resources unreadable'} @${townId} - letting the server decide`);
      return { ok: true, blind: true, why: aff.detail || 'resources unreadable' };
    }
    return { ok: true, blind, why: blindWhy };
  }
  // gpAjax._ajax does `if(!o)o={town_id:Game.townId};else if(!o.town_id)o.town_id=Game.townId`,
  // so town_id MUST sit at the top level of the post. Nested inside `arguments`
  // it is invisible to that default and every research retargets whichever town
  // is currently open.
  function researchPayload(townId, techId) {
    return {
      model_url: 'ResearchOrder',
      action_name: 'research',
      arguments: { id: String(techId) },
      town_id: +townId,
    };
  }
  // H3: `building_academy` has zero hits in the client. The only start path is
  // GameModels.ResearchOrder.research() -> GrepoApiHelper.execute -> frontend_bridge.
  const RESEARCH_ENDPOINT = 'ResearchOrder/research';
  // Decision memory is only consulted inside txRun, i.e. AFTER the scan has
  // picked a job, logged it and spent the work. Without this pre-filter the
  // three-strike window was wired blind: the same dead tech was re-selected
  // every cadence, journaled as `remembered`, and no other tech in the town was
  // ever considered because the scan stops at the first candidate.
  function researchSkipWhy(townId, tech) {
    return gbSkipActiveWrite('research', 'bridge', RESEARCH_ENDPOINT, researchPayload(townId, tech));
  }
  function researchPost(townId, techId, onDone) {
    bridgePost('research', researchPayload(townId, techId), onDone);
  }
  function researchOrderTechId(order) {
    try {
      const a = (order && order.attributes) || order || {};
      return a.research_type || a.research_id || a.research || a.type || a.id || null;
    } catch (_) { return null; }
  }
  // Same invariant as researchCanAfford: only a value that was actually read may
  // return ok:false. Anything unreadable comes back blind, and researchDepsOk
  // lets it through so the server decides.
  function researchDepsVerdict(townId, info, tech) {
    try {
      const uw = gameUw();
      const def = uw.GameData && uw.GameData.researches && uw.GameData.researches[tech];
      // An unknown tech id is not blind: there is nothing to post.
      if (!def) return { ok: false, blind: false, why: 'tech unknown' };
      if (!info || !info.town) return { ok: false, blind: true, why: 'town unreadable' };
      if (!info.techs) return { ok: false, blind: true, why: 'researched flags unreadable' };
      const rdeps = def.research_dependencies || def.dependencies || [];
      const depList = Array.isArray(rdeps) ? rdeps : Object.keys(rdeps || {}).filter(k => rdeps[k]);
      for (const d of depList) {
        const id = typeof d === 'string' ? d : (d && (d.id || d.research_id || d.research_type));
        if (id && !info.techs[id]) return { ok: false, blind: false, why: `requiere ${id}` };
      }
      const bdeps = def.building_dependencies || def.required_buildings || {};
      let buildings = null;
      try {
        const b = info.town.getBuildings ? info.town.getBuildings() : (info.town.buildings && info.town.buildings());
        buildings = b && (b.attributes || b);
      } catch (_) { buildings = null; }
      if (!buildings) return { ok: false, blind: true, why: 'building levels unreadable' };
      for (const b of Object.keys(bdeps || {})) {
        const raw = bdeps[b];
        const need = +(raw && typeof raw === 'object' ? (raw.level ?? raw.min_level ?? raw.value) : raw) || 0;
        const have = +(buildings[b] || 0);
        if (have < need) return { ok: false, blind: false, why: `${b} ${have}/${need}` };
      }
      const academyNeed = +(def.academy_level ?? def.required_academy_level ?? def.building_level ?? def.level ?? 0);
      if (academyNeed > 0 && +info.academy < academyNeed) return { ok: false, blind: false, why: `academia ${info.academy}/${academyNeed}` };
      // A2: the game's own can_be_bought carries !(requires_farming_villages &&
      // on_small_island). Posting one of these on a small island is a guaranteed
      // server rejection - one request-budget slot and one decision-memory strike
      // every cadence. Blocks only on a small-island flag we actually read.
      if (def.requires_farming_villages && info.smallIsland === true) {
        return { ok: false, blind: false, why: 'isla pequeña: sin aldeas rurales' };
      }
      const res = def.resources || def.costs || def.cost;
      if (!res || res.wood == null || res.stone == null || res.iron == null) {
        return { ok: false, blind: true, why: 'GameData cost missing' };
      }
      if (researchPointCost(tech) == null) return { ok: false, blind: true, why: 'GameData research_points missing' };
      return { ok: true, blind: false, why: null };
    } catch (e) { return { ok: false, blind: true, why: String(e).slice(0, 60) }; }
  }
  function researchDepsOk(townId, info, tech) {
    const v = researchDepsVerdict(townId, info, tech);
    if (!v.ok && v.blind) {
      gbLogT('research-dep-blind-' + tech, 600000,
        `research: dependency read incomplete for ${tech} (${v.why}) - letting the server decide`);
    }
    return v.ok || v.blind;
  }
  function researchValidateJob(job) {
    const info = researchTownTechs(job.townId);
    if (!info || !(info.academy > 0)) return { ok: false, why: 'research state unreadable' };
    if (info.techs && info.techs[job.tech]) return { ok: false, why: 'already researched' };
    // H4: an unreadable real queue must not be read as "empty, slot free". Both
    // gates below need it, so without it the post is a coin flip against the
    // server - block, and say how to make it readable.
    if (!info.ordersKnown) {
      gbLogT('research-orders-unknown-' + job.townId, 600000,
        `research: real research queue for town ${job.townId} unreadable (open that town once)`);
      return { ok: false, why: 'cola real ilegible; abre esa ciudad una vez' };
    }
    if ((info.orders || []).some(o => String(researchOrderTechId(o)) === String(job.tech))) return { ok: false, why: 'already queued' };
    if ((info.orders || []).length >= researchQueueMax()) return { ok: false, why: 'queue full' };
    if (!researchDepsOk(job.townId, info, job.tech)) return { ok: false, why: 'dependencies unavailable/unmet' };
    const aff = researchCanAfford(job.townId, job.tech, info);
    return { ok: aff.ok, why: aff.why };
  }

  // Map researchValidateJob's `why` onto the queue-job status vocabulary the
  // Queue Center and the academy tile controls render.
  function researchNativeStatus(why) {
    const w = String(why || '');
    if (/queue full/.test(w)) return 'waiting-queue';
    if (/^points /.test(w) || /resource|wood|stone|iron/i.test(w)) return 'waiting-resources';
    if (/dependenc/i.test(w)) return 'waiting-requirement';
    return 'blocked';
  }
  // boot.js re-runs this every 5s for as long as anything sits in the virtual
  // research lane. A head that is merely waiting (resources, queue full, memory)
  // does not change in 5s, so an idle sweep re-walks every town, every tech and
  // every GameData lookup 12x/min for nothing. The orchestrator's own cadence is
  // unaffected — only the native watcher backs off.
  const RESEARCH_IDLE_BACKOFF_MS = 20000;
  let researchIdleUntil = 0;
  function researchScan(reason) {
    if (reason === 'native-watch' && Date.now() < researchIdleUntil) return;
    const nativePending = nativeQueueHasPending('research');
    if (!hostEnabled() || (!state.autoResearch && !nativePending) || captchaPaused('research')) return;
    if (automationPaused({})) return;
    if (gbLocked('research')) return;
    const globalTargets = researchEnsureTargets();
    let townIds = [];
    try {
      const uw = gameUw();
      townIds = Object.keys((uw.ITowns && uw.ITowns.towns) || {});
    } catch (_) {}
    let job = null;
    // Explicit FIFO towns first: a town the player queued by hand outranks the
    // target-list planner, and a FIFO town never falls back to it.
    const explicitIds = Object.keys(nativeQueueRoot().towns)
      .filter(id => nativeQueueIsFifo(id, 'research') && nativeQueueList(id, 'research', false).length);
    for (const tid of explicitIds) {
      const head = nativeQueueResearchHead(tid);
      if (!head) continue;
      const valid = researchValidateJob({ townId: tid, tech: head.tech });
      if (!valid.ok) { nativeQueueSetJobState(head, researchNativeStatus(valid.why), String(valid.why || '')); continue; }
      const memWhy = researchSkipWhy(tid, head.tech);
      if (memWhy) {
        nativeQueueSetJobState(head, 'blocked', `memoria: ${memWhy}`);
        gbLogT('research-mem-' + tid + '-' + head.tech, 60000, `research: ${head.tech} @${tid} skipped from memory (${memWhy})`);
        continue;
      }
      nativeQueueSetJobState(head, 'ready', 'listo');
      job = { townId: tid, tech: head.tech, nativeJobId: head.id };
      break;
    }
    // A FIFO job supersedes the planner for this tick. A blocked FIFO head does
    // NOT: the target-list towns are independent and must still be scanned.
    if (job || !state.autoResearch) townIds = [];
    const candidates = [];
    for (const tid of townIds) {
      if (nativeQueueIsFifo(tid, 'research')) continue;
      const targets = goalEffectiveResearchTargets(tid, globalTargets);
      let ordered = Object.keys(targets).sort((a, b) => (+targets[a].order || 0) - (+targets[b].order || 0));
      const info = researchTownTechs(tid);
      if (!info || !(info.academy > 0)) continue;
      // Unknown real queue: every "already queued" / "queue full" gate below
      // would silently pass. Skip the town instead of posting blind.
      if (!info.ordersKnown) {
        gbLogT('research-orders-unknown-' + tid, 600000,
          `research: town ${tid} real research queue unreadable - skipping (open that town once)`);
        continue;
      }
      const queueMax = researchQueueMax();
      if (info.orders.length >= queueMax) continue;
      const queued = new Set();
      info.orders.forEach(o => {
        const id = researchOrderTechId(o);
        if (id != null) queued.add(String(id));
      });
      // v4 plan 2.10: the graph only RE-RANKS the targets the user already
      // configured. It never adds a tech, never enqueues a prerequisite, and a
      // blind path sorts last so an unreadable graph can only ever cost this
      // tick its ordering preference - not correctness.
      ordered = researchAdviseOrder(tid, ordered, targets, info);
      for (const tech of ordered) {
        if (info.techs[tech]) continue;
        if (queued.has(String(tech))) continue;
        const tgt = targets[tech];
        if (!tgt || !tgt.tgt) continue;
        if (!researchDepsOk(tid, info, tech)) continue;
        const aff = researchCanAfford(tid, tech, info);
        if (!aff.ok) {
          gbLogT('research-cant-' + tid + '-' + tech, 300000,
            `research: town ${tid} cannot start ${tech} yet (${aff.why})`);
          continue;
        }
        const memWhy = researchSkipWhy(tid, tech);
        if (memWhy) {
          gbLogT('research-mem-' + tid + '-' + tech, 300000,
            `research: ${tech} @${tid} skipped from memory (${memWhy}) — trying next tech`);
          continue;
        }
        // v4 plan 5.5: collect instead of taking the first eligible, so the
        // pick is the best candidate across ALL towns rather than whichever
        // town happened to be walked first.
        // Collect EVERY eligible tech for this town, not just the first in
        // advised order: otherwise a town's second-best can never be compared
        // against another town's, and the cross-town ranking is decided before
        // the comparator ever sees it. Bounded so a wide target list cannot
        // make the scan quadratic.
        candidates.push(researchCandidate(tid, tech, targets, info));
        if (candidates.length >= RESEARCH_CANDIDATE_MAX) break;
      }
      if (candidates.length >= RESEARCH_CANDIDATE_MAX) break;
    }
    if (!job && candidates.length) {
      candidates.sort(researchCandidateCmp);
      const pick = candidates[0];
      // researchValidateJob re-runs below and stays the final authority: the
      // queue can change between ranking and posting.
      job = { townId: pick.townId, tech: pick.tech };
      if (candidates.length > 1) {
        gbLogT('research-rank', 300000,
          `research: picked ${pick.tech} @${pick.townId} (${researchCandidateWhy(pick)}) from ${candidates.length} candidates`);
      }
    }
    if (!job) {
      researchIdleUntil = Date.now() + RESEARCH_IDLE_BACKOFF_MS;
      gbLogT('research-idle', 180000, `research: idle (${scanReason(reason)})`);
      return;
    }
    researchIdleUntil = 0;
    const valid = researchValidateJob(job);
    if (!valid.ok) {
      if (job.nativeJobId) {
        const head = nativeQueueList(job.townId, 'research', false)[0];
        if (head && head.id === job.nativeJobId) nativeQueueSetJobState(head, researchNativeStatus(valid.why), String(valid.why || ''));
      }
      researchIdleUntil = Date.now() + RESEARCH_IDLE_BACKOFF_MS;
      gbLogT('research-stale-' + job.townId + '-' + job.tech, 60000, `research: final precheck blocked (${valid.why})`); return;
    }
    const lockToken = gbLock('research');
    if (!lockToken) return;
    if (job.nativeJobId) {
      const head = nativeQueueList(job.townId, 'research', false)[0];
      if (!head || head.id !== job.nativeJobId) { gbUnlock('research', lockToken); return; }
      head.manualReview = false;
      head.inflight = { tech: job.tech, at: Date.now() };
      nativeQueueSetJobState(head, 'sending', 'enviando a la cola real');
      nativeQueueSave();
    }
    researchPost(job.townId, job.tech, (err) => {
      gbUnlock('research', lockToken);
      if (!err) {
        gbLog(`research: town ${job.townId} → ${job.tech}`);
        if (job.nativeJobId) nativeQueueResearchApplied(job.townId, job.nativeJobId);
      } else {
        if (job.nativeJobId) {
          const head = nativeQueueList(job.townId, 'research', false)[0];
          if (head && head.id === job.nativeJobId) {
            head.inflight = null;
            // timeout/pending is NOT a failure: the post may have landed, so the
            // head goes to manual review instead of being retried blindly.
            const ambiguous = err === 'pending' || err === 'timeout_unknown';
            head.manualReview = ambiguous;
            nativeQueueSetJobState(head, ambiguous ? 'unknown' : 'blocked', ambiguous ? 'resultado desconocido; comprobar la cola real' : String(err));
          }
        }
        gbLogT('research-err', 60000, `research err ${err}`);
      }
    });
  }
  function researchLoadCsFast() {
    const t = {};
    RESEARCH_CS_FAST.forEach((k, i) => { t[k] = { order: i, tgt: 1 }; });
    state.researchTargets = t;
    save(STORE.RESEARCH_TARGETS, t);
    gbLog('research: loaded CS-fast tech list');
  }

  // alertLastSent / alertPending live on `state.webhookRatelimit` and
  // `state.webhookPending` (declared in core.js, persisted via STORE.WEBHOOK_*).
  // Module-level maps were wiped by reload/SPA-nav, so the 5-minute dedup
  // window reset and the next captcha/attack/culture event re-posted immediately.
  state.webhookRatelimit || (state.webhookRatelimit = {});
  state.webhookPending || (state.webhookPending = {});
