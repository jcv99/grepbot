  function abDefaultTargets() { return Object.assign({}, AB_CS_FAST); }
  function abDefaultOrder() { return AB_BUILDINGS.slice(); }
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
    const n = Math.max(lo, Math.floor(Number.isFinite(+lvl) ? +lvl : 0));
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
