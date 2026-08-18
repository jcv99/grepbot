  // ===== Research dependency graph (v4 plan 2.10) ============================
  // READ-ONLY. Pure graph helpers over the LIVE GameData.researches definitions.
  // There is deliberately no static table of research ids here: a hardcoded
  // graph would be a guess about a client this repo cannot verify, and
  // CLAUDE.md forbids inventing game data. Every id in the output came out of
  // Object.keys(GameData.researches) on this world, this session.
  //
  // Absent or malformed data is reported as `blind`, never as "no
  // prerequisites" - the difference between "this tech needs nothing" and "we
  // could not read what it needs" is exactly what makes a planner post garbage.
  const RG_MAX_DEPTH = 60;
  // Normalise one definition's dependency list. Returns null (NOT []) when the
  // shape is unreadable, so the caller can tell "none" from "unknown".
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
  // {known, blind, ids, edges, why}
  // Memoised: the walk touches every definition and researchScan calls it once
  // per town, on a 5s native-watch cadence. GameData is static for a session.
  let _rgMemo = { at: 0, v: null };
  const RG_MEMO_MS = 60000;
  function researchGraphBuild() {
    if (_rgMemo.v && Date.now() - _rgMemo.at < RG_MEMO_MS) return _rgMemo.v;
    const built = researchGraphBuildRaw();
    // Only cache a graph we actually read; a blind one may be a transient
    // "GameData not loaded yet" and must be retried on the next call.
    // Only cache a graph we actually read; a blind one may be a transient
    // "GameData not loaded yet" and must be retried on the next call.
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
      // An edge pointing at an id this client does not define is UNRESOLVABLE,
      // not absent. Dropping it would make "we cannot resolve this prerequisite"
      // read as "this tech has no prerequisites" - the exact failure this
      // module exists to prevent. Keep it; the closure reports blind on it.
      // An edge pointing at an id this client does not define is UNRESOLVABLE,
      // not absent. Dropping it would make "we cannot resolve this prerequisite"
      // read as "this tech has no prerequisites" - the exact failure this
      // module exists to prevent. Keep it; the closure reports blind on it.
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
  // Missing prerequisite closure for `target`, topologically ordered so every
  // entry appears after everything it needs. `have` is the set of already
  // researched or already queued ids.
  // -> {ok, blind, order:[ids], missing:[ids], why}
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
    // `order` ends with the target itself; `missing` is everything before it.
    // `order` ends with the target itself; `missing` is everything before it.
    const missing = order.slice(0, Math.max(0, order.length - 1));
    return { ok: ok && !blind, blind, order, missing, why };
  }
  // Deterministic rank for a set of candidate targets: fewer missing
  // prerequisites first, then the caller's own order index. A blind target
  // sorts LAST - never first - because acting on an unreadable path is the one
  // outcome this module exists to prevent.
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
