  // ---------- boot ----------
  ensureHostDefault();
  migrateConfig();
  state.csrf = huntCsrf() || state.csrf;
  if (state.csrf) save(wkey(STORE.CSRF), state.csrf);
  hookFetch();
  hookXhr();
  renderFindings();
  renderWorld();

  gbMenu('GrepBot: copy findings', () => {
    // Same redaction path as the panel's Copy/Export - this dump used to go out raw.
    const dump = redactFindingsExport({ findings: state.findings, farms: state.farms });
    navigator.clipboard.writeText(JSON.stringify(dump, null, 2));
  });
  gbMenu('GrepBot: diag', () => { diagRun(); });
  gbMenu('GrepBot: rescan inbox', () => {
    seenThisRun.clear(); Object.keys(state.seen).forEach(k => delete state.seen[k]);
    seenCount = 0;
    save(STORE.SEEN, state.seen); scrapeInboxDom();
  });
  gbMenu('GrepBot: clear captcha', () => { captchaClear(); flash('captcha cleared'); });

  // SPA nav: Grepolis swaps body content - remount panel if detached
  function ensurePanelMounted() {
    if (!panel) return;
    if (!document.body.contains(panel)) {
      document.body.appendChild(panel);
      gbLogT('panel-remount', 10000, 'panel remounted after SPA nav');
    }
    try { ensureDomObserver(); } catch (_) {}
  }
  function hookSpaNav() {
    const wrap = (name, origKey) => {
      if (!gbHookOrig[origKey]) gbHookOrig[origKey] = history[name].bind(history);
      const orig = gbHookOrig[origKey];
      const wrapped = function () {
        const r = orig.apply(history, arguments);
        gbTimeout(ensurePanelMounted, 50);
        return r;
      };
      wrapped._grepbot = true;
      history[name] = wrapped;
    };
    wrap('pushState', 'pushState');
    wrap('replaceState', 'replaceState');
    gbListen(window, 'popstate', () => gbTimeout(ensurePanelMounted, 50));
    gbListen(window, 'hashchange', () => gbTimeout(ensurePanelMounted, 50));
  }
  hookSpaNav();

  // periodic inbox re-scan (fallback when ajax hook misses)
  gbInterval(scrapeInboxDom, 30000);
  refreshFarmsParsed();
  renderFarms();
  renderTimers();
  updateStatus();
  // first farm scrape 20s after boot, towns 30s; after that the persisted
  // deadlines drive cadence (survive reloads, immune to timer throttling)
  if (!state.nextFarmScrape) { state.nextFarmScrape = Date.now() + 20000; save(STORE.NEXT_FARM, state.nextFarmScrape); }
  if (!state.nextTownsScrape) { state.nextTownsScrape = Date.now() + 30000; save(STORE.NEXT_TOWNS, state.nextTownsScrape); }
  gbInterval(farmTick, 15000);
  gbListen(document, 'visibilitychange', () => {
    if (!document.hidden) {
      try { gbWakeMarkResume('visible'); } catch (_) {}
      farmTick();
      try { reportCatchUpEnqueue(); } catch (_) {}
    }
  });
  gbListen(window, 'pageshow', (e) => {
    if (e && e.persisted) {
      try { gbWakeMarkResume('bfcache'); } catch (_) {}
      farmTick();
      try { reportCatchUpEnqueue(); } catch (_) {}
      try { bindQuestObserver(); } catch (_) {}
      try { banditScheduleNext(); } catch (_) {}
    }
  });
  gbInterval(checkThresholds, 30000);
  gbInterval(renderTimers, 1000);
  gbInterval(updateStatus, 5000);
  // Econ features (farm/cave/culture/trade/ab/...) owned by cadence-aware orchTick.
  // Time-critical loops stay independent: ibScan, dodge, quest, farmTick scrapes.
  // DOM auto-collect is also boot-owned (not bandit) so night/captcha pause gates apply.
  gbInterval(() => {
    if (!state.autoCollect) return;
    if (!hostEnabled() || automationPaused({}) || captchaPaused('collect')) return;
    autoCollectResources();
  }, 5000);
  if (state.collectAll) collectAllBackground();
  bindQuestObserver();
  gbTimeout(() => { if (hostEnabled()) questScanTick('boot'); }, 5000);
  gbInterval(() => { if (hostEnabled()) questScanTick('loop'); }, QUEST_SCAN_MS);

  // instant build: rescan 2s after any build-button click; 10s scan loop
  gbListen(document, 'click', (e) => {
    let t = e.target;
    for (let i = 0; i < 5 && t; i++) {
      if (String(t.className || '').indexOf('button_build') !== -1) { gbTimeout(ibScan, 2000); break; }
      t = t.parentElement;
    }
  }, true);
  gbTimeout(() => {
    const scan = () => {
      if (gbInWakeBurst && gbInWakeBurst()) gbWake('ibScan', () => ibScan(), { priority: 10 });
      else ibScan();
    };
    scan();
    gbInterval(scan, IB_CHECK_MS);
  }, 8000);
  gbTimeout(() => { abEnsureTargets(); }, 12000);
  gbInterval(() => dodgeScan('loop'), DODGE_CHECK_MS);
  // First orch probe ~15s after boot so farm/cave don't wait a full cadence
  gbTimeout(() => { if (hostEnabled()) orchTick(); }, 15000);
  gbInterval(() => {
    if (gbInWakeBurst && gbInWakeBurst()) gbWake('orchTick', () => orchTick(), { priority: 30 });
    else orchTick();
  }, ORCH_MS);
  gbInterval(() => {
    // Heavy DOM refreshes only when their tabs are visible; watchlist/grepodata stay light
    renderOverview();
    renderIntel();
    renderStats();
    intelGrepodataAssist();
    intelWatchlistScan();
  }, 15000);
  qolBindActivityPause();
  // Stale-lock sweeper: TTL release is what actually unsticks a feature whose
  // callback never fired. The unload handlers below are best-effort only -
  // `beforeunload` does not fire on bfcache/mobile exits.
  gbInterval(gbLockSweep, 10000);
  const releaseLocks = () => {
    try { cancelArmedAttack(); } catch (_) {}
    try { gbUnlockAll(); } catch (_) {}
    try { banditAttackSentAt = 0; } catch (_) {}
    try { banditIdleUntil = 0; } catch (_) {}
    try {
      if (banditTimer) { clearTimeout(banditTimer); banditTimer = null; }
    } catch (_) {}
    try { banditClearLoop(); } catch (_) {}
    try { if (typeof questDispose === 'function') questDispose(); } catch (_) {}
    try { if (typeof orchCancelQueued === 'function') orchCancelQueued(); } catch (_) {}
    try { if (typeof dodgeQueueSave === 'function') dodgeQueueSave(); } catch (_) {}
    try { if (typeof questClaimFailSave === 'function') questClaimFailSave(); } catch (_) {}
    try { if (typeof persistServerCooldown === 'function') persistServerCooldown(); } catch (_) {}
  };
  gbListen(window, 'beforeunload', releaseLocks);
  gbListen(window, 'pagehide', releaseLocks);
