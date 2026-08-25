  function abDefaultTargets() { return Object.assign({}, AB_CS_FAST); }
  function abDefaultOrder() { return AB_BUILDINGS.slice(); }
  // ===== Scripted CS build plan (v5.10.42) ===================================
  // Five phases gated on live town levels. The picker reads the same
  // goalEffectiveBuildTargets map regardless of whether the script is active;
  // when it is, its per-town targets replace the shared abTargets for that
  // town. The plan never posts itself - it only writes state.
  // Phases run strictly in order: each gate references a level the previous
  // phase already produced, so the picker never sees two competing targets.
  // `maxall` is the terminal phase (gate returns false forever).
  const AB_SCRIPT_PHASES = [
    { id:'tube', label:'Tubo (Senado 24 + Almacén 30)',
      gate:(l)=>(+l.main||0) < 24,
      targets:(l)=>({ main:24, storage:Math.max(30, +l.storage||0) }) },
    { id:'academy7', label:'Academia 7',
      gate:(l)=>(+l.main||0) >= 24 && (+l.academy||0) < 7,
      targets:(l)=>({ main:24, storage:Math.max(30, +l.storage||0), academy:Math.max(7, +l.academy||0) }) },
    { id:'theater', label:'Requisitos para Teatro',
      gate:(l)=>(+l.academy||0) >= 7 && (+l.theater||0) < 1,
      targets:(l)=>({ main:24, storage:Math.max(30, +l.storage||0), academy:Math.max(7, +l.academy||0), theater:1 }) },
    { id:'academy30', label:'Academia 30',
      gate:(l)=>(+l.theater||0) >= 1 && (+l.academy||0) < 30,
      targets:(l)=>({ main:24, storage:Math.max(30, +l.storage||0), academy:30, theater:1 }) },
    { id:'maxall', label:'Todo al máximo',
      gate:()=>false,
      targets:(l)=>abScriptMaxTargets(l) },
  ];
  function abScriptMaxTargets(levels) {
    const out = {};
    for (const b of AB_BUILDINGS) {
      const max = abMaxLevel(b);
      if (max == null) continue;
      const cur = +(levels && levels[b]) || 0;
      if (cur >= max) continue;
      out[b] = max;
    }
    return out;
  }
  function abScriptEnsure() {
    if (!state.abScript || typeof state.abScript !== 'object') state.abScript = { active:false, startedAt:0, perTown:{} };
    if (!state.abScript.perTown || typeof state.abScript.perTown !== 'object' || Array.isArray(state.abScript.perTown)) state.abScript.perTown = {};
    if (!state.abScript.active) state.abScript.perTown = {};
    return state.abScript;
  }
  function abScriptActive() { return !!(state.abScript && state.abScript.active); }
  function abScriptEffectiveTargets(townId) {
    if (!abScriptActive()) return null;
    const p = state.abScript.perTown && state.abScript.perTown[String(townId)];
    return p && p.targets ? Object.assign({}, p.targets) : null;
  }
  function abScriptCurrentPhase(townId) {
    if (!abScriptActive()) return null;
    const id = String(townId);
    const p = state.abScript.perTown && state.abScript.perTown[id];
    if (!p) return null;
    const def = AB_SCRIPT_PHASES.find(x => x.id === p.phase);
    return def || null;
  }
  function abScriptToggle() {
    if (abScriptActive()) {
      state.abScript = { active:false, startedAt:0, perTown:{} };
      save(STORE.AB_SCRIPT, state.abScript);
      gbLog('script CS: desactivado - objetivos vuelven a los valores compartidos');
      try { renderAbQueue(); } catch (_) {}
      return false;
    }
    state.abScript = { active:true, startedAt:Date.now(), perTown:{} };
    save(STORE.AB_SCRIPT, state.abScript);
    // El script no funciona sin auto-cola: lo activa para que el picker arranque.
    if (!state.abAuto) { state.abAuto = true; save(STORE.AB_AUTO, true); }
    gbLog('script CS: activado - Senado 24 → Academia 7 → Teatro → Academia 30 → Máx');
    try { renderAbQueue(); } catch (_) {}
    return true;
  }
  function abScriptTick(townId) {
    if (!abScriptActive()) return null;
    const id = String(townId);
    const levels = abCurrentLevels(townId);
    if (!levels) return null;
    let chosen = null;
    for (const p of AB_SCRIPT_PHASES) { if (p.gate(levels)) { chosen = p; break; } }
    if (!chosen) return null;
    const cur = state.abScript.perTown[id];
    const fresh = chosen.targets(levels);
    // Solo escribe cuando la fase cambia - las metas dentro de la fase pueden
    // moverse (storage floor sube con main) sin disparar un save por scan.
    if (!cur || cur.phase !== chosen.id) {
      state.abScript.perTown[id] = { phase:chosen.id, targets:fresh };
      save(STORE.AB_SCRIPT, state.abScript);
      gbLog(`script CS: ciudad ${townNameById(id) || id} entra en fase "${chosen.label}"`);
    } else {
      state.abScript.perTown[id].targets = fresh;
    }
    return state.abScript.perTown[id];
  }
  function abEnsureOrder() {
    const cur = Array.isArray(state.abOrder) ? state.abOrder.filter(x => AB_BUILDINGS.includes(x)) : [];
    state.abOrder = cur.concat(AB_BUILDINGS.filter(x => !cur.includes(x)));
    save(STORE.AB_ORDER, state.abOrder);
    return state.abOrder;
  }
  function abMoveOrder(building, delta) {
    const order = abEnsureOrder().slice();
    const i = order.indexOf(building);
    if (i < 0) return;
    const j = Math.max(0, Math.min(order.length - 1, i + delta));
    if (i === j) return;
    order.splice(i, 1); order.splice(j, 0, building);
    state.abOrder = order;
    save(STORE.AB_ORDER, order);
  }
  function abEnsureTargets() {
    if (!state.abTargets || typeof state.abTargets !== 'object' || Array.isArray(state.abTargets)) {
      state.abTargets = abDefaultTargets();
      save(STORE.AB_TARGETS, state.abTargets);
    }
    AB_BUILDINGS.forEach(b => { if (state.abTargets[b] == null) state.abTargets[b] = AB_CS_FAST[b] || 0; });
    abEnsureOrder();
    return state.abTargets;
  }
  function abBuildingDef(building) {
    try { const uw = gameUw(); return uw.GameData && uw.GameData.buildings && uw.GameData.buildings[building] || null; }
    catch (_) { return null; }
  }
  function abMaxLevel(building) {
    const d = abBuildingDef(building);
    const n = d && d.max_level != null ? +d.max_level : null;
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  function abMinLevel(building) {
    const d = abBuildingDef(building);
    const n = d && d.min_level != null ? +d.min_level : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  function abClampTarget(building, lvl) {
    const lo = abMinLevel(building);
    const hi = abMaxLevel(building);
    const n = Math.max(lo, Math.floor(gbNum(lvl) || 0));
    return hi == null ? n : Math.min(hi, n);
  }
  function abSetTarget(building, lvl) {
    abEnsureTargets();
    state.abTargets[building] = abClampTarget(building, lvl);
    save(STORE.AB_TARGETS, state.abTargets);
  }
  // ===== Native, explicit queues (v2.2) =====================================
  // These queues are user-authored from the game's own windows. Unlike the
  // legacy target planner, every click creates one stable FIFO job.
  const NATIVE_BUILD_LABELS = {
    main:'Senado',storage:'Almacén',farm:'Granja',academy:'Academia',temple:'Templo',
    barracks:'Cuartel',docks:'Puerto',market:'Mercado',hide:'Cueva',lumber:'Aserradero',
    stoner:'Cantera',ironer:'Mina de plata',wall:'Muralla',theater:'Teatro',thermal:'Termas',
    library:'Biblioteca',lighthouse:'Faro',tower:'Torre',statue:'Estatua divina',oracle:'Oráculo',trade_office:'Oficina comercial',
  };
  const NATIVE_SPECIAL_GROUPS=[['theater','thermal','library','lighthouse'],['tower','statue','oracle','trade_office']];
  let nativeQueueInflightRestored=false;
