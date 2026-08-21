  function orchFeatureEnabled(key) {
    return {
      culture: state.autoCulture,
      cave: state.autoCave,
      build: state.abAuto || nativeQueueHasPending('build'),
      research: state.autoResearch || nativeQueueHasPending('research'),
      trade: state.autoTrade || state.islandShip || state.autoTransport || state.autoTradeRoutes || state.autoDump,
      farm: state.autoFarm,
      ruraltrade: state.autoRuralTrade,
      rurallevel: state.autoRuralLevel,
      recruit: state.autoRecruit || nativeRecruitPending(),
      villrecruit: state.autoVillageRecruit,

      batchrecruit: state.batchRecruit && batchRecruitHasAnyTown(),
      merchant: state.autoMerchant,
      pttrade: state.autoPtTrade,
      favor: state.autoFavor,

      // Same toggle as favor: the user's mental model is one 'spend my favor'
      // switch. The spell loop still refuses without an explicit power id.
      godspell: state.autoFavor,
      wonder: state.autoWonder,
      spy: state.spyEnabled,

      // Dispatch only where the world actually has heroes. The pass itself is
      // read-only (stamina alerts + equipment proposals); auto-assign is gated
      // separately inside heroScan and still needs a confirmed post to fire.
      hero: (typeof heroesEnabled === 'function') ? heroesEnabled() : false,
    }[key];
  }
  function orchDefaultOrder() {
    return PRIORITY_ORDER_DEFAULT.slice();
  }
  // "Did this feature act since we dispatched it" must be answered from a TIME
  // window, not from a running total. state.decisions is a pruned ring (400
  // rows / 7 days), so an absolute count can shrink between two samples: a
  // feature that acted once while three old rows aged out looked idle and got
  // its cadence doubled. Rows are ordered oldest-first, so the scan stops at
  // the first row older than the mark.
  function orchJrnOkSince(key, since) {
    const f = ORCH_JRN[key];
    if (!f || !(since > 0)) return 0;
    let n = 0;
    const list = state.decisions || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const r = list[i];
      if (r.ts < since) break;
      if (r.f === f && r.r === 'ok') n += r.n || 1;
    }
    return n;
  }
  // ---------- warehouse deadlock ----------
  // A pinned warehouse looks exactly like "nothing to do" from the journal:
  // farm claims land nowhere, cave only drains iron, trade finds no target below
  // its 25%-empty rule, so all three go idle and the adaptive backoff widens
  // their cadence up to 8x. The bot goes quietest precisely when it must act.
  // The resolver only changes ORDER and suppresses that widening; it never adds
  // a scheduler, a post class, or budget.
  const ORCH_PIN_RATIO = 0.97;
  const ORCH_DRAIN_KEYS = ['cave', 'trade', 'ruraltrade'];
  // Farm-first (hard rule): unit production never takes a dispatch slot while a
  // farming-village claim is still possible. Order override + eligibility gate
  // only - no new scheduler, no new post class. recruitScan and
  // villageRecruitScan enforce the same rule at the post site.
  const ORCH_UNIT_KEYS = ['recruit', 'villrecruit'];
  function orchFarmFirst() {
    try { return typeof farmClaimPending === 'function' && farmClaimPending(); }
    catch (_) { return false; }
  }
  const ORCH_DEADLOCK_FARM_IDLE = 2;
  let orchDeadlock = { open: false, towns: [], at: 0, stuckLoggedAt: 0 };
  function orchTownIds() {
    const ids = [];
    try {
      const from = (typeof townsFromGame === 'function') ? townsFromGame() : null;
      if (from) from.forEach(t => ids.push(String(t.id)));
    } catch (_) {}
    if (!ids.length) {
      try { Object.keys((gameUw().ITowns && gameUw().ITowns.towns) || {}).forEach(id => ids.push(String(id))); } catch (_) {}
    }
    return ids;
  }
  function orchPinnedTowns() {
    const pinned = [];
    let blind = 0;
    for (const id of orchTownIds()) {
      const rs = (typeof townResState === 'function') ? townResState(id) : null;
      // Unreadable capacity is unknown, never "full" - a blind read may not
      // fabricate a deadlock and reorder the whole economy behind it.
      if (!rs || !(rs.cap > 0)) { blind++; continue; }
      if (Math.max(rs.wood, rs.stone, rs.iron) / rs.cap >= ORCH_PIN_RATIO) pinned.push(id);
    }
    if (blind && !pinned.length) {
      gbLogT('orch-deadlock-blind', 600000, `orch: ${blind} town(s) with unreadable capacity - deadlock check skipped for them`);
    }
    return pinned;
  }
  function orchDeadlockEval() {
    const off = state.orchDeadlockResolve === false;
    const pinned = off ? [] : orchPinnedTowns();
    const farmStuck = !!state.autoFarm && (orchIdle.farm || 0) >= ORCH_DEADLOCK_FARM_IDLE;
    const open = !off && pinned.length > 0 && farmStuck;
    if (open !== orchDeadlock.open) {
      orchDeadlock = { open, towns: pinned, at: Date.now(), stuckLoggedAt: 0 };
      gbLog(open
        ? `orch: warehouse deadlock in town(s) ${pinned.join(',')} - forcing ${ORCH_DRAIN_KEYS.join('/')} ahead of farm`
        : 'orch: warehouse deadlock cleared - normal priority order restored');
      try { updateStatus(); } catch (_) {}
    } else if (open) {
      orchDeadlock.towns = pinned;
    }
    return orchDeadlock.open;
  }
  function orchDeadlockOpen() { return !!orchDeadlock.open; }
  function orchDeadlockState() { return { open: !!orchDeadlock.open, towns: (orchDeadlock.towns || []).slice(), since: orchDeadlock.at || 0 }; }
  // Nothing left to drain: one line, then silence. This is a "go spend
  // resources" signal for the human, not something to spin on.
  function orchDeadlockNoteStuck(why) {
    if (!orchDeadlock.open) return;
    const now = Date.now();
    if (now - (orchDeadlock.stuckLoggedAt || 0) < 3600000) return;
    orchDeadlock.stuckLoggedAt = now;
    gbLog(`orch: deadlock cannot drain (${why}) - spend resources by hand (build/recruit/culture)`);
  }
  function orchIdleFactor(key) {
    if (gbNeverStop()) return 1;
    if (state.orchAdaptive === false) return 1;
    // The drain path must not be slowed by the very idleness the deadlock causes.
    if (orchDeadlock.open && ORCH_DRAIN_KEYS.includes(key)) return 1;
    // A ready village is known work, not idleness. Widening farm's cadence to
    // 8x while units are held behind it would stall both.
    if (key === 'farm' && orchFarmFirst()) return 1;
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
    const since = orchJrnMark[key];
    if (!(since > 0)) return;
    if (orchJrnOkSince(key, since) > 0) {
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
    // v4 plan 7.4: cadence flush rides this tick; no scheduler of its own.
    try { intelDigestTick(); } catch (_) {}
    // Read-only pre-warn pass, ABOVE the pause gate on purpose: a warehouse
    // still fills during night pause, and silencing the warning is exactly when
    // the user most needs it. It posts nothing to the game.
    // It lives here rather than in cultureScan (plan 2.8 work item 2) because
    // cultureScan returns early unless autoCulture is ON, and that defaults OFF.
    try { townCapWatcher(); } catch (_) {}
    if (automationPaused({})) return;
    const configured = (state.priorityOrder && state.priorityOrder.length)
      ? state.priorityOrder : orchDefaultOrder();

    const mandatory = goalMandatoryModules();
    let order = mandatory.concat(configured.filter(k => !mandatory.includes(k))).concat(orchDefaultOrder().filter(k => !mandatory.includes(k) && configured.indexOf(k) === -1));
    // Sort override, not a second scheduler: while a warehouse is pinned the
    // drain features jump the user's priorityOrder (visibly - see the log line
    // and the footer badge) so farm is not fed a town that cannot store loot.
    if (orchDeadlockEval()) {
      const drain = ORCH_DRAIN_KEYS.filter(k => order.includes(k));
      order = drain.concat(order.filter(k => !drain.includes(k)));
    }
    const farmFirst = orchFarmFirst();
    if (farmFirst && order.includes('farm')) order = ['farm'].concat(order.filter(k => k !== 'farm'));
    const now = Date.now();
    const due = [];
    for (let i = 0; i < order.length; i++) {
      const key = order[i];
      if (!ORCH_HANDLERS[key]) continue;
      if (!orchFeatureEnabled(key)) continue;
      if (farmFirst && ORCH_UNIT_KEYS.includes(key)) continue;
      const cap = ORCH_CAPTCHA[key];
      if (cap && captchaPaused(cap)) continue;
      const cadence = orchCadence(key);
      const last = orchLastRun[key] || 0;
      const overdue = now - last - cadence;
      if (overdue < 0) continue;
      due.push({ key, rank: i, overdue, cadence });
    }
    if (!due.length) return;

    due.sort((a, b) => {
      const gap = b.overdue - a.overdue;
      // Tie-break band scales with the slower of the two features' cadences
      // (capped at 2x base) so a 300s feature and a 20s feature can never
      // tie-break off a single overdue tick, but a 20s vs 60s run still
      // breaks cleanly within one base band.
      const band = Math.max(a.cadence, b.cadence, ORCH_MS) * 2;
      if (Math.abs(gap) > band) return gap;
      return a.rank - b.rank;
    });
    const run = due.slice(0, ORCH_MAX_PER_TICK);
    run.forEach((item, idx) => {
      const fire = () => {

        if (automationPaused({})) return;
        if (ORCH_CAPTCHA[item.key] && captchaPaused(ORCH_CAPTCHA[item.key])) return;
        // Judge the previous run only when this feature is about to run again. That gives
        // the entire cadence window to asynchronous/batched transactions instead of sampling
        // a few seconds after dispatch and misclassifying slow success as idle.
        orchNoteResult(item.key);
        orchLastRun[item.key] = Date.now();
        orchJrnMark[item.key] = Date.now();
        ORCH_HANDLERS[item.key]();
      };
      if (idx === 0) fire();
      else gbTimeout(fire, idx * ORCH_SPACING_MS + Math.floor(Math.random() * 200));
    });
  }
