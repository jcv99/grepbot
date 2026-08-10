  function orchFeatureEnabled(key) {
    return {
      culture: state.autoCulture,
      cave: state.autoCave,
      build: state.abAuto || nativeQueueHasPending('build'),
      research: state.autoResearch || nativeQueueHasPending('research'),
      trade: state.autoTrade || state.islandShip,
      farm: state.autoFarm,
      ruraltrade: state.autoRuralTrade,
      rurallevel: state.autoRuralLevel,
      recruit: state.autoRecruit || nativeQueueHasPending('recruit'),
      merchant: state.autoMerchant,
      pttrade: state.autoPtTrade,
      favor: state.autoFavor,
      wonder: state.autoWonder,
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

  function orchIdleFactor(key) {
    if (state.orchAdaptive === false) return 1;
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
    if (automationPaused({})) return;
    const configured = (state.priorityOrder && state.priorityOrder.length)
      ? state.priorityOrder : orchDefaultOrder();

    const mandatory = goalMandatoryModules();
    const order = mandatory.concat(configured.filter(k => !mandatory.includes(k))).concat(orchDefaultOrder().filter(k => !mandatory.includes(k) && configured.indexOf(k) === -1));
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

    due.sort((a, b) => {
      const gap = b.overdue - a.overdue;
      if (Math.abs(gap) > ORCH_MS * 2) return gap;
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
