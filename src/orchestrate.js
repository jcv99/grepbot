  // ---------- priority manager (Phase 9.1 / v1.1.0, rebuilt v1.4.0) ----------
  // Cadence-aware sole scheduler for econ features. No parallel per-feature
  // intervals (those thrash the request budget).
  //
  // v1.4.0 fixes three scheduling bugs:
  //   1. one feature per 20s tick = 3 actions/min ceiling, while cave+build+
  //      recruit alone want 6/min -> the tail of the priority order starved.
  //      A tick now runs up to ORCH_MAX_PER_TICK due features, spaced out.
  //   2. features were picked strictly by list order, so a permanently-due
  //      high-priority feature could hold the front forever. Overdue-ness
  //      (now - due) now breaks ties, so waiting climbs.
  //   3. exact constant cadences put every feature back in lockstep after the
  //      first alignment, producing periodic bursts. Cadences carry +/-20% jitter.
  const ORCH_MS = 20000;
  const ORCH_MAX_PER_TICK = 3;
  const ORCH_SPACING_MS = 450;
  const ORCH_JITTER = 0.2;
  let orchTickGen = 0;
  function orchCancelQueued() { orchTickGen++; }
  const ORCH_CADENCE = {
    culture: 90000,
    cave: 30000,
    build: 30000, // abScan only; ibScan keeps its own 10s loop
    research: 45000,
    trade: 120000,
    farm: 60000,
    ruraltrade: 90000,
    rurallevel: 120000,
    recruit: 30000,
    merchant: 45000,
    favor: 60000,
    wonder: 180000,
  };
  const ORCH_CAPTCHA = {
    culture: 'culture', cave: 'cave', build: 'build', research: 'research',
    trade: 'trade', farm: 'farm', ruraltrade: 'ruraltrade', rurallevel: 'rurallevel',
    recruit: 'recruit', merchant: 'merchant', favor: 'favor', wonder: 'wonder',
  };
  // Journal feature key each handler posts under - used to tell "ran and acted"
  // from "ran and found nothing to do".
  const ORCH_JRN = {
    culture: 'culture', cave: 'cave', build: 'build', research: 'research',
    trade: 'trade', farm: 'farm', ruraltrade: 'ruraltrade', rurallevel: 'rurallevel',
    recruit: 'recruit', merchant: 'merchant', favor: 'favor', wonder: 'wonder',
  };
  const ORCH_IDLE_TRIP = 4; // consecutive no-op runs before widening
  const ORCH_IDLE_MAX = 8; // cadence multiplier ceiling
  const orchLastRun = {};
  const orchIdle = {}; // key -> consecutive runs that posted nothing
  const orchJrnMark = {}; // key -> journal entry count seen at last run
  const ORCH_HANDLERS = {
    culture: () => { try { cultureScan('orch'); } catch (_) {} },
    cave: () => { try { caveScan('orch'); } catch (_) {} },
    build: () => { try { abEnsureTargets(); abScan('orch'); } catch (_) {} },
    research: () => { try { researchScan('orch'); } catch (_) {} },
    trade: () => { try { tradeScan('orch'); } catch (_) {} },
    farm: () => { try { autoClaimFarms('orch'); } catch (_) {} },
    ruraltrade: () => { try { ruralTradeScan('orch'); } catch (_) {} },
    rurallevel: () => { try { ruralLevelScan('orch'); } catch (_) {} },
    recruit: () => { try { recruitScan('orch'); } catch (_) {} },
    merchant: () => { try { merchantScan('orch'); } catch (_) {} },
      favor: () => { try { favorScan('orch'); } catch (_) {} },
      wonder: () => {
        try { wonderScan('orch'); } catch (_) {}
        try { wonderFavorScan('orch'); } catch (_) {}
      },
    };
  function orchFeatureEnabled(key) {
    return {
      culture: state.autoCulture,
      cave: state.autoCave,
      build: state.abAuto,
      research: state.autoResearch,
      trade: state.autoTrade || state.islandShip,
      farm: state.autoFarm,
      ruraltrade: state.autoRuralTrade,
      rurallevel: state.autoRuralLevel,
      recruit: state.autoRecruit,
      merchant: state.autoMerchant,
      favor: state.autoFavor,
      wonder: state.autoWonder,
    }[key];
  }
  function orchDefaultOrder() {
    return PRIORITY_ORDER_DEFAULT.slice();
  }
  // How many journal records this feature owns right now. A run that adds none
  // sent nothing: no claimable village, no free order, warehouse not full yet.
  function orchJrnCount(key) {
    const f = ORCH_JRN[key];
    if (!f) return 0;
    let n = 0;
    const list = state.decisions || [];
    for (let i = list.length - 1; i >= 0 && n < 100000; i--) {
      if (list[i].f === f) n++;
    }
    return n;
  }
  // Adaptive cadence: a feature that keeps finding nothing (cave on a world
  // with no spare iron, wonder outside a WW world) doubles its own interval up
  // to ORCH_IDLE_MAX, freeing budget for features that do act. One post resets it.
  // Snapshot of scheduler state for the Stats tab / preflight.
  let _econDeadlock = { open: false, towns: [], at: 0 };
  function econDeadlock() {
    if (state.orchDeadlockResolve === false) {
      if (_econDeadlock.open) {
        _econDeadlock = { open: false, towns: [], at: Date.now() };
        gbLog('orch: deadlock resolve OFF - cleared');
      }
      return _econDeadlock;
    }
    const pinned = [];
    try {
      const towns = (typeof townsFromGame === 'function' ? townsFromGame() : null) || state.towns || [];
      towns.forEach(t => {
        const id = t && t.id != null ? t.id : t;
        if (id == null) return;
        if (townIsPinned(id)) pinned.push(String(id));
      });
    } catch (_) {}
    const farmOn = !!state.autoFarm;
    const farmIdle = (orchIdle.farm || 0) >= 2;
    const open = pinned.length > 0 && farmOn && farmIdle;
    if (open && !_econDeadlock.open) {
      gbLog('orch: warehouse deadlock OPEN towns=' + pinned.join(','));
    } else if (!open && _econDeadlock.open) {
      gbLog('orch: warehouse deadlock CLOSED');
    }
    _econDeadlock = { open, towns: pinned, at: Date.now() };
    return _econDeadlock;
  }
  function orchIdleFactor(key) {
    if (state.orchAdaptive === false) return 1;
    // Deadlock drain path must not widen - that is the trap the resolver exists to break.
    const dl = _econDeadlock;
    if (dl && dl.open && (key === 'cave' || key === 'trade' || key === 'ruraltrade')) return 1;
    const streak = orchIdle[key] || 0;
    if (streak < ORCH_IDLE_TRIP) return 1;
    return Math.min(ORCH_IDLE_MAX, 1 << Math.min(3, streak - ORCH_IDLE_TRIP + 1));
  }
  function orchCadence(key) {
    const base = (ORCH_CADENCE[key] || ORCH_MS) * orchIdleFactor(key);
    const jitter = 1 + (Math.random() * 2 - 1) * ORCH_JITTER;
    return Math.round(base * jitter);
  }
  function orchNoteResult(key) {
    const before = orchJrnMark[key];
    const after = orchJrnCount(key);
    orchJrnMark[key] = after;
    if (before == null) return;
    if (after > before) {
      if (orchIdle[key]) {
        gbLogT('orch-wake-' + key, 300000, `orch: ${key} acted, cadence back to normal`);
      }
      orchIdle[key] = 0;
      return;
    }
    orchIdle[key] = (orchIdle[key] || 0) + 1;
    if (orchIdle[key] === ORCH_IDLE_TRIP) {
      gbLog(`orch: ${key} idle ${ORCH_IDLE_TRIP}x - widening cadence (adaptive)`);
    }
  }
  // Snapshot of scheduler state for the Stats tab / preflight.
  function orchStatus() {
    const now = Date.now();
    return orchDefaultOrder().map(key => ({
      key,
      on: !!orchFeatureEnabled(key),
      cadenceMs: (ORCH_CADENCE[key] || ORCH_MS) * orchIdleFactor(key),
      idle: orchIdle[key] || 0,
      captcha: captchaPaused(ORCH_CAPTCHA[key] || key),
      dueInMs: Math.max(0, ((orchLastRun[key] || 0) + (ORCH_CADENCE[key] || ORCH_MS) * orchIdleFactor(key)) - now),
    }));
  }
  function orchTick() {
    if (!hostEnabled()) return;
    if (automationPaused({})) return;
    const dl = econDeadlock();
    const configured = (state.priorityOrder && state.priorityOrder.length)
      ? state.priorityOrder : orchDefaultOrder();
    // Anything the user did not rank still runs, just after the ranked ones.
    const order = configured.concat(orchDefaultOrder().filter(k => configured.indexOf(k) === -1));
    const now = Date.now();
    const due = [];
    for (let i = 0; i < order.length; i++) {
      const key = order[i];
      if (!ORCH_HANDLERS[key]) continue;
      if (!orchFeatureEnabled(key)) continue;
      const cap = ORCH_CAPTCHA[key];
      if (cap && captchaPaused(cap)) continue;
      const cadence = orchCadence(key);
      const last = orchLastRun[key] || 0;
      const overdue = now - last - cadence;
      if (overdue < 0) continue;
      due.push({ key, rank: i, overdue });
    }
    if (!due.length) return;
    const DRAIN_RANK = { cave: 0, trade: 1, ruraltrade: 2, farm: 99 };
    due.sort((a, b) => {
      if (dl && dl.open) {
        const da = DRAIN_RANK[a.key], db = DRAIN_RANK[b.key];
        if (da != null && db != null && da !== db) return da - db;
        if (da != null && db == null) return -1;
        if (db != null && da == null) return 1;
      }
      const gap = b.overdue - a.overdue;
      if (Math.abs(gap) > ORCH_MS * 2) return gap;
      return a.rank - b.rank;
    });
    if (dl && dl.open && !due.some(d => d.key === 'cave' || d.key === 'trade' || d.key === 'ruraltrade')) {
      gbLogT('deadlock-stuck', 300000, 'orch: deadlock open but nothing can drain - spend resources manually');
    }
    const run = due.slice(0, ORCH_MAX_PER_TICK);
    const gen = orchTickGen;
    run.forEach((item, idx) => {
      const fire = () => {
        if (gen !== orchTickGen) return;
        // Re-check: the earlier feature in this same tick may have tripped a
        // captcha breaker or a server cooldown between the sort and now.
        if (automationPaused({})) return;
        if (ORCH_CAPTCHA[item.key] && captchaPaused(ORCH_CAPTCHA[item.key])) return;
        orchLastRun[item.key] = Date.now();
        orchJrnMark[item.key] = orchJrnCount(item.key);
        ORCH_HANDLERS[item.key]();
        // Journal writes happen inside the post callbacks, so sample late.
        gbTimeout(() => orchNoteResult(item.key), 4000);
      };
      if (idx === 0) fire();
      else gbTimeout(fire, idx * ORCH_SPACING_MS + Math.floor(Math.random() * 200));
    });
  }
