  // ===== Diagnostics (v4 plans 8.2, 8.3, 8.4) ================================
  // Snapshots, a call profiler and a heap/map probe. All read-only, all default
  // OFF except snapshots, and none of them adds a scheduler: they ride the
  // existing 10s lock sweep and the journal's debounced save.
  //
  // Nothing here ever serialises `state` wholesale. A snapshot is a WHITELIST of
  // slices, so its size is bounded by what it deliberately carries rather than
  // by whatever unrelated state the bot happens to accumulate.

  const SNAPSHOT_SLOTS = 6;
  const SNAPSHOT_INTERVAL_MS = 300000;
  const SNAPSHOT_BUDGET_BYTES = 200000;
  let snapshotLastAt = 0;

  function snapshotRing() {
    if (!Array.isArray(state.snapshots)) state.snapshots = [];
    return state.snapshots;
  }
  function snapshotPayload() {
    let jrn = null;
    try { jrn = (typeof jrnStats === 'function') ? jrnStats(24 * 3600000) : null; } catch (_) {}
    return {
      cV: state.configVer,
      cfg: {
        autoFarm: !!state.autoFarm, autoCave: !!state.autoCave, autoTrade: !!state.autoTrade,
        abAuto: !!state.abAuto, ibAuto: !!state.ibAuto, autoResearch: !!state.autoResearch,
        autoRecruit: !!state.autoRecruit, autoCulture: !!state.autoCulture,
        dryRun: !!state.dryRun, safeMode: !!state.safeMode,
      },
      plans: {
        abTargets: state.abTargets, researchTargets: state.researchTargets,
        recruitTargets: state.recruitTargets, merchantWish: state.merchantWish,
      },
      txState: state.txState,
      circuits: state.circuits,
      decisionSkips: state.decisionSkips,
      farmOptionMap: state.farmOptionMap,
      farmUnitsOption: state.farmUnitsOption,
      farmSleepDay: state.farmSleepDay,
      lastSeenTs: state.lastSeenTs,
      // The journal ring is SUMMARISED, never copied: it is the single heaviest
      // slice and a snapshot only needs its shape, not its rows.
      decisions: jrn ? { ok: jrn.ok, err: jrn.err, total: jrn.total } : null,
    };
  }
  function snapshotBuild(reason) {
    if (state.snapshotsOn === false) return false;
    let text = '';
    try { text = JSON.stringify(snapshotPayload()); } catch (_) { return false; }
    // Dropped, never truncated and never allowed to grow the ring: a snapshot
    // that does not fit the budget is not a smaller snapshot, it is a bad one.
    if (text.length > SNAPSHOT_BUDGET_BYTES) {
      gbLogT('snapshot-oversize', 60000, `snapshot: ${text.length}B over the ${SNAPSHOT_BUDGET_BYTES}B budget - dropped`);
      return false;
    }
    const ring = snapshotRing();
    ring.push({ at: Date.now(), sizeBytes: text.length, reason: reason || 'tick', payload: JSON.parse(text) });
    while (ring.length > SNAPSHOT_SLOTS) ring.shift();
    snapshotLastAt = Date.now();
    save(STORE.SNAPSHOTS, ring);
    return true;
  }
  function snapshotTick() {
    if (state.snapshotsOn === false) return;
    if (Date.now() - snapshotLastAt < SNAPSHOT_INTERVAL_MS) return;
    // A paused bot has nothing new worth saving.
    if (automationPaused({})) return;
    snapshotBuild('tick');
  }
  function snapshotList() {
    return snapshotRing().map((s, i) => ({ slot: i, at: s.at, sizeBytes: s.sizeBytes, reason: s.reason }));
  }
  function snapshotTotalBytes() { return snapshotRing().reduce((n, s) => n + (+s.sizeBytes || 0), 0); }
  // Restore writes through the SAME storage keys the normal loaders read, so
  // there is no in-place state surgery and no version gymnastics.
  function snapshotRestore(slot) {
    if (state.safeMode) { flash('modo seguro: restaurar esta desactivado'); return false; }
    const s = snapshotRing()[slot];
    if (!s || !s.payload) return false;
    const p = s.payload;
    const put = (key, store, v) => { if (v === undefined) return; state[key] = v; save(store, v); };
    put('abTargets', STORE.AB_TARGETS, p.plans && p.plans.abTargets);
    put('researchTargets', STORE.RESEARCH_TARGETS, p.plans && p.plans.researchTargets);
    put('recruitTargets', STORE.RECRUIT_TARGETS, p.plans && p.plans.recruitTargets);
    put('merchantWish', STORE.MERCHANT_WISH, p.plans && p.plans.merchantWish);
    put('txState', STORE.TX_STATE, p.txState);
    put('circuits', STORE.CIRCUITS, p.circuits);
    put('decisionSkips', STORE.DECISION_SKIPS, p.decisionSkips);
    put('farmOptionMap', STORE.FARM_OPTION_MAP, p.farmOptionMap);
    put('farmUnitsOption', STORE.FARM_UNITS_OPTION, p.farmUnitsOption);
    gbLog(`snapshot: restored slot ${slot} from ${new Date(s.at).toLocaleString()}`);
    return true;
  }

  // ===== Call profiler (v4 plan 8.3) =========================================
  // Fixed accumulator per key: no per-call allocation, no stack capture, no
  // serialisation in the hot path. Default OFF so the rings stay cold.
  function profRings() {
    if (!state.profileRings || typeof state.profileRings !== 'object') state.profileRings = {};
    return state.profileRings;
  }
  function profTime(key, fn) {
    if (!state.profilerOn) return fn();
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    try {
      return fn();
    } finally {
      // In `finally` so a throwing scan is still measured; orchSafe still sees
      // the exception.
      const dt = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0;
      const r = profRings();
      const e = r[key] || (r[key] = { count: 0, sumMs: 0, maxMs: 0, lastMs: 0, lastAt: 0 });
      e.count++; e.sumMs += dt; e.lastMs = dt; e.lastAt = Date.now();
      if (dt > e.maxMs) e.maxMs = dt;
    }
  }
  function profTopLines(n) {
    const r = profRings();
    const rows = Object.entries(r)
      .filter(([, e]) => e && e.count > 0)
      .map(([k, e]) => ({ k, avg: e.sumMs / e.count, max: e.maxMs, count: e.count }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, n || 8);
    if (!rows.length) return [];
    return ['perfilador (ms por llamada)'].concat(
      rows.map(x => `  ${x.k.padEnd(22)} ${x.avg.toFixed(1).padStart(7)} med  ${x.max.toFixed(1).padStart(7)} max  ${String(x.count).padStart(5)} llam.`));
  }

  // ===== Memory / map probe (v4 plan 8.4) ====================================
  const MEM_SAMPLE_MS = 300000;
  const MEM_RING = 24;
  const MEM_MAPS = ['dodgeReturns', 'txState', 'decisionSkips', 'farmResources', 'townResources', 'spellCooldown', 'buildSwapIgnore'];
  let memNextAt = 0;
  function memRing() {
    if (!Array.isArray(state.memSamples)) state.memSamples = [];
    return state.memSamples;
  }
  function memSample() {
    let used = null, total = null;
    try {
      const m = (typeof performance !== 'undefined') ? performance.memory : null;
      if (m && Number.isFinite(+m.usedJSHeapSize)) { used = +m.usedJSHeapSize; total = +m.totalJSHeapSize; }
    } catch (_) {}
    const maps = {};
    for (const k of MEM_MAPS) {
      const v = state[k];
      maps[k] = (v && typeof v === 'object') ? Object.keys(v).length : null;
    }
    // blind:true when the heap API is absent (Firefox, Safari, hardened
    // Chromium). The map tally still works, so the probe is not useless there.
    return { ts: Date.now(), used, total, maps, blind: used == null };
  }
  function memTick() {
    if (!state.memProbeOn) return;
    const now = Date.now();
    if (now < memNextAt) return;
    memNextAt = now + MEM_SAMPLE_MS;
    const ring = memRing();
    ring.push(memSample());
    while (ring.length > MEM_RING) ring.shift();
  }
  function memLines() {
    const ring = memRing();
    if (!ring.length) return [];
    const last = ring[ring.length - 1], first = ring[0];
    const mb = n => (n == null ? null : (n / 1048576).toFixed(1));
    const lines = [];
    if (last.blind) {
      gbLogT('mem-api', 3600000, 'memory probe: performance.memory no disponible (solo Chromium) - solo tamanos de mapas');
      lines.push('memoria: API no disponible (solo Chromium)');
    } else {
      const d = (last.used != null && first.used != null) ? last.used - first.used : null;
      lines.push(`memoria: ${mb(last.used)} Mb usados / ${mb(last.total)} Mb total` +
        (d != null ? ` (delta ${d >= 0 ? '+' : ''}${mb(d)} Mb en ${ring.length} muestras)` : ''));
    }
    lines.push('mapas: ' + MEM_MAPS.map(k => `${k}=${last.maps[k] == null ? '?' : last.maps[k]}`).join(' '));
    return lines;
  }
  // One entry point for the 10s sweep in boot.js: no feature here owns a timer.
  function diagnosticsTick() {
    try { snapshotTick(); } catch (_) {}
    try { memTick(); } catch (_) {}
  }
