  const RESEARCH_CS_FAST = ['booty', 'ceramics', 'architecture', 'crane', 'shipwright', 'colonize_ship', 'mathematics'];

  const RG_MAX_DEPTH = 60;

  function researchGraphDeps(def) {
    if (!def || typeof def !== 'object') return null;
    const raw = def.research_dependencies !== undefined ? def.research_dependencies
      : (def.dependencies !== undefined ? def.dependencies : undefined);
    if (raw === undefined) return [];
    if (raw === null) return null;
    let list;
    if (Array.isArray(raw)) list = raw;
    else if (typeof raw === 'object') list = Object.keys(raw).filter(k => raw[k]);
    else return null;
    const out = [];
    for (const d of list) {
      const id = typeof d === 'string' ? d : (d && (d.id || d.research_id || d.research_type));
      if (!id) return null;
      out.push(String(id));
    }
    return out;
  }

  let _rgMemo = { at: 0, v: null };
  const RG_MEMO_MS = 60000;
  function researchGraphBuild() {
    if (_rgMemo.v && Date.now() - _rgMemo.at < RG_MEMO_MS) return _rgMemo.v;
    const built = researchGraphBuildRaw();

    if (built.known) _rgMemo = { at: Date.now(), v: built };
    return built;
  }
  function researchGraphBuildRaw() {
    let defs = null;
    try { defs = gameUw().GameData && gameUw().GameData.researches; } catch (_) {}
    if (!defs || typeof defs !== 'object') {
      return { known: false, blind: true, ids: [], edges: {}, why: 'GameData.researches unreadable' };
    }
    const ids = Object.keys(defs);
    if (!ids.length) return { known: false, blind: true, ids: [], edges: {}, why: 'GameData.researches empty' };
    const edges = Object.create(null);
    let partial = 0;
    for (const id of ids) {
      const deps = researchGraphDeps(defs[id]);
      if (deps === null) { edges[id] = null; partial++; continue; }

      edges[id] = deps;
      if (deps.some(d => !Object.prototype.hasOwnProperty.call(defs, d))) partial++;
    }
    return {
      known: true,
      blind: partial > 0,
      ids,
      edges,
      why: partial ? `${partial} definition(s) with unreadable dependencies` : '',
    };
  }

  function researchGraphClosure(graph, target, have) {
    if (!graph || !graph.known) return { ok: false, blind: true, order: [], missing: [], why: (graph && graph.why) || 'graph unreadable' };
    if (!Object.prototype.hasOwnProperty.call(graph.edges, target)) {
      return { ok: false, blind: false, order: [], missing: [], why: `tech unknown: ${target}` };
    }
    const done = have instanceof Set ? have : new Set(Object.keys(have || {}).filter(k => (have || {})[k]));
    const order = [];
    const seen = new Set();
    const stack = new Set();
    let blind = false, why = '';
    const visit = (id, depth) => {
      if (depth > RG_MAX_DEPTH) { blind = true; why = why || 'chain-too-long'; return false; }
      if (done.has(id) || seen.has(id)) return true;
      if (stack.has(id)) { blind = true; why = why || `dependency-cycle at ${id}`; return false; }
      const deps = graph.edges[id];
      if (deps === null || deps === undefined) { blind = true; why = why || `dependencies unreadable for ${id}`; return false; }
      for (const d of deps) {
        if (!Object.prototype.hasOwnProperty.call(graph.edges, d)) { blind = true; why = why || `unresolvable prerequisite ${d} of ${id}`; return false; }
      }
      stack.add(id);
      for (const d of deps) if (!visit(d, depth + 1)) { stack.delete(id); return false; }
      stack.delete(id);
      seen.add(id);
      order.push(id);
      return true;
    };
    const ok = visit(String(target), 0);

    const missing = order.slice(0, Math.max(0, order.length - 1));
    return { ok: ok && !blind, blind, order, missing, why };
  }

  function researchGraphRank(graph, targets, have, orderOf) {
    const idx = typeof orderOf === 'function' ? orderOf : (() => 0);
    return (targets || []).map(t => {
      const c = researchGraphClosure(graph, t, have);
      return { tech: t, missing: c.missing.length, blind: c.blind || !c.ok, order: +idx(t) || 0, closure: c };
    }).sort((a, b) =>
      (a.blind - b.blind) ||
      (a.missing - b.missing) ||
      (a.order - b.order) ||
      String(a.tech).localeCompare(String(b.tech)));
  }
  function researchEnsureTargets() {
    if (state.researchTargets && typeof state.researchTargets === 'object') return state.researchTargets;
    const t = {};
    RESEARCH_CS_FAST.forEach((k, i) => { t[k] = { order: i, tgt: 1 }; });
    state.researchTargets = t;
    save(STORE.RESEARCH_TARGETS, t);
    return t;
  }

  function researchOrdersFor(townId) {
    const uw = gameUw();
    const want = String(townId);
    let current = null;
    try { if (uw.Game && uw.Game.townId != null) current = String(uw.Game.townId); } catch (_) {}
    const isCurrent = current != null && want === current;

    try {
      const col = uw.MM && uw.MM.getFirstTownAgnosticCollectionByName
        && uw.MM.getFirstTownAgnosticCollectionByName('ResearchOrder');
      const frag = col && col.getFragment && col.getFragment(want);
      const models = frag && frag.models;
      if (models && models.length) return { orders: models.slice(), known: true };
      if (models && isCurrent) return { orders: [], known: true };
    } catch (_) {}

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

    try {
      const mm = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('ResearchOrder');
      if (mm && mm.models && isCurrent) return { orders: mm.models.slice(), known: true };
    } catch (_) {}
    return { orders: [], known: false };
  }
  function researchTownTechs(townId) {
    const uw = gameUw();
    try {
      const t = gbTownModel(townId);
      if (!t) return null;
      let res = null, techsKnown = false;
      try { const rm=t.researches&&t.researches();const attrs=rm&&(rm.attributes||rm);if(attrs&&typeof attrs==='object'){res=attrs;techsKnown=true} } catch (_) {}
      let buildings = null;
      try {
        const b = t.getBuildings ? t.getBuildings() : (t.buildings && t.buildings());
        buildings = (b && (b.attributes || b)) || null;
      } catch (_) {}

      let acad = null;
      try {
        acad = gbBuildingLevel(townId, 'academy');
        if (acad == null && buildings && buildings.academy != null) acad = gbNum(buildings.academy);
      } catch (_) {}

      let library = null;
      try {
        library = gbBuildingLevel(townId, 'library');
        if (library == null && buildings && buildings.library != null) library = gbNum(buildings.library);
      } catch (_) {}

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
        techsKnown,
        academy: acad,
        library,
        smallIsland,
        orders: q.orders,
        ordersKnown: q.known,
      };
    } catch (_) { return null; }
  }

  function researchQueueMax() {
    try {
      const uw = gameUw();
      const q = uw.GameDataConstructionQueue;
      if (q && q.getResearchOrdersQueueLength) {
        const n = gbNum(q.getResearchOrdersQueueLength());
        if (n != null && n > 0) return n;
      }
      const p = uw.GameDataPremium;
      if (p && p.hasCurator && p.hasCurator()) return 7;
      if (p && p.isAdvisorActivated && p.isAdvisorActivated('curator')) return 7;
    } catch (_) {}
    return 2;
  }

  function researchHaveSet(info, queuedIds) {
    const have = new Set();
    for (const k of Object.keys((info && info.techs) || {})) if (info.techs[k]) have.add(String(k));
    for (const q of (queuedIds || [])) have.add(String(q));
    return have;
  }

  const RESEARCH_CANDIDATE_MAX = 24;
