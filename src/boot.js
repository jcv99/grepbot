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
      // Never bind over another instance's wrapper: after a hot reload gbHookOrig
      // is a fresh object, so the guard passes and the old wrapper becomes the
      // "original" - N reloads then schedule N ensurePanelMounted per nav.
      const cur = history[name];
      if (!gbHookOrig[origKey]) {
        const pristine = (cur && cur._grepbot && cur.__grepbotOrig) ? cur.__grepbotOrig : cur.bind(history);
        gbHookOrig[origKey] = pristine;
      }
      const orig = gbHookOrig[origKey];
      const wrapped = function () {
        const r = orig.apply(history, arguments);
        if (gbInstanceAlive()) gbTimeout(ensurePanelMounted, 50);
        return r;
      };
      wrapped._grepbot = true;
      wrapped.__grepbotOrig = orig;
      wrapped.__grepbotOwner = GB_INSTANCE_ID;
      history[name] = wrapped;
    };
    wrap('pushState', 'pushState');
    wrap('replaceState', 'replaceState');
    gbListen(window, 'popstate', () => gbTimeout(ensurePanelMounted, 50));
    gbListen(window, 'hashchange', () => gbTimeout(ensurePanelMounted, 50));
  }
  hookSpaNav();

  gbInterval(scrapeInboxDom, 30000);
  refreshFarmsParsed();
  renderFarms();
  renderTimers();
  updateStatus();

  if (!state.nextFarmScrape) { state.nextFarmScrape = Date.now() + 20000; save(STORE.NEXT_FARM, state.nextFarmScrape); }
  if (!state.nextTownsScrape) { state.nextTownsScrape = Date.now() + 30000; save(STORE.NEXT_TOWNS, state.nextTownsScrape); }
  gbInterval(farmTick, 15000);
  gbTimeout(() => { if (state.autoFarm) farmScheduleClaimWake(null, 'boot', true); }, 2500);
  // Hidden tabs clamp timers, so every clamped loop fires at once on wake and
  // the armed instant-build timer can be minutes late. Mark the burst so the
  // catch-up is serialized, then re-read orders.
  gbListen(document, 'visibilitychange', () => {
    if (document.hidden) return;
    try { gbWakeMarkResume('visible'); } catch (_) {}
    farmTick();
    try { reportCatchUpEnqueue(); } catch (_) {}
    try { gbWake('ibScan', () => ibScan(), { priority: 10 }); } catch (_) {}
  });
  gbListen(window, 'pageshow', (e) => {
    if (!(e && e.persisted)) return;
    try { gbWakeMarkResume('bfcache'); } catch (_) {}
    farmTick();
    try { reportCatchUpEnqueue(); } catch (_) {}
    try { bindQuestObserver(); } catch (_) {}
    try { gbWake('ibScan', () => ibScan(), { priority: 10 }); } catch (_) {}
  });
  gbInterval(checkThresholds, 30000);
  gbInterval(renderTimers, 1000);
  gbInterval(updateStatus, 5000);
  gbInterval(() => { try { renderTownSwitch(); } catch (_) {} }, 5000);

  bindQuestObserver();
  gbTimeout(() => { if (hostEnabled()) questScanTick('boot'); }, 5000);
  gbInterval(() => { if (hostEnabled()) questScanTick('loop'); }, QUEST_SCAN_MS);

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
  gbTimeout(scheduleNativeUiScan, 1200);
  gbInterval(() => {
    if (nativeQueueHasPending('build')) abScan('native-watch');
    if (nativeRecruitPending()) recruitScan('native-watch');
    if (nativeQueueHasPending('research')) researchScan('native-watch');
    // Ungated: this used to fire only while a lane already had work, which is a
    // chicken-and-egg lock on a fresh install — no scan means no [+] control,
    // no [+] means the lane stays empty, and the empty lane suppresses the scan.
    // nativeUiScan is a no-op when no game window is open.
    scheduleNativeUiScan();
  }, 5000);
  gbInterval(() => dodgeScan('loop'), DODGE_CHECK_MS);
  gbInterval(dodgeReturnTick, 15000);

  gbTimeout(() => { if (hostEnabled()) orchTick(); }, 15000);
  gbInterval(() => {
    if (gbInWakeBurst && gbInWakeBurst()) gbWake('orchTick', () => orchTick(), { priority: 30 });
    else orchTick();
  }, ORCH_MS);
  gbInterval(() => {

    renderOverview();
    renderIntel();
    renderStats();
    intelGrepodataAssist();
    intelWatchlistScan();
  }, 15000);
  qolBindActivityPause();
  gbKeyBind();
  contextMenuStart();

  gbInterval(gbLockSweep, 10000);
  const releaseLocks = () => {
    try { cancelArmedAttack(); } catch (_) {}
    // An armed instant-complete timer that survives the page exit fires against
    // a disposed instance on bfcache restore and posts from a stale order list.
    try { ibClearArmed(); } catch (_) {}
    try { gbUnlockAll(); } catch (_) {}
    try { banditAttackSentAt = 0; } catch (_) {}
    try { if (typeof dodgeQueueSave === 'function') dodgeQueueSave(); } catch (_) {}
    try { if (typeof questClaimFailSave === 'function') questClaimFailSave(); } catch (_) {}
    try { if (typeof persistServerCooldown === 'function') persistServerCooldown(); } catch (_) {}
  };
  gbListen(window, 'beforeunload', releaseLocks);
  gbListen(window, 'pagehide', releaseLocks);

  // Test hooks are never exposed in normal Tampermonkey execution.
  if (GB_ROOT.__grepbotTestMode === true) {
    GB_ROOT.__grepbotTest = {
      instanceId: GB_INSTANCE_ID,
      state,
      bridgePost,
      gameAjaxPost,
      txDomWrite,
      txRun,
      txReconcileNow,
      txIntent,
      txCapture,
      txClearUnknown,
      circuitOpen,
      circuitClear,
      gbLock,
      gbUnlock,
      gbLocked,
      gbLockTouch,
      planner,
      plannerSnapshot,
      plannerAvailable,
      plannerEffect,
      plannerCanReserve,
      plannerHold,
      plannerRelease,
      plannerCommit,
      goalProfiles,
      goalEffective,
      // Canonical name promised to downstream plans 1.3/5.1/5.5/5.6; the
      // implementation stays goalEffective so existing callers are untouched.
      gbCityProfile: goalEffective,
      // Capacity/ETA contract consumed by plans 3.2, 3.4 and 5.1.
      townPopState,
      transportTownRes,
      transportProjectHeadroom,
      transportTownETA,
      transportBalanceJobs,
      transportAiJobs,
      dumpJobs,
      pickDumpDestination,
      goalPlanTown,
      goalPlanAll,
      goalSetProfile,
      goalSetTownOverrides,
      goalProgress,
      goalQueueMove,
      goalQueueToggleBlock,
      goalQueueToggleMandatory,
      goalQueueHide,
      goalQueueReset,
      goalMandatoryModules,
      goalResearchDependencies,
      goalUnitDependencies,
      economyProductionRate,
      economyForecast,
      tradePredictiveJobs,
      tradeRouteJobs,
      tradeRoutesSave,
      defenseAssessment,
      defenseThreatWeights,
      defenseThreatBand,
      defenseFactorText,
      defenseShouldDodge,
      emergencyStoreNow,
      emergencyScan,
      supportTryBurst,
      supportScan,
      dodgeReturnRecord,
      dodgeReturnTick,
      clientFingerprintNow,
      clientFingerprintCompatible,
      clientFingerprintCheck,
      safeModeBlock,
      simulateTown,
      simulateAccount,
      renderDashboard,
      renderHealth,
      whyNote,
      qolExportConfig,
      qolImportConfig,
      preflightRun,
      autoCollectResources,
      abScan,
      abPickNext,
      abQueueInfo,
      abEnsureOrder,
      nativeQueueRoot,
      nativeQueueTown,
      nativeQueueList,
      nativeQueueAddBuild,
      nativeQueueRemoveLastBuild,
      nativeQueueAddRecruit,
      nativeQueueRemoveLastRecruit,
      nativeQueueAddResearch,
      nativeQueueRemoveResearch,
      nativeQueueResearchApplied,
      nativeQueueMove,
      nativeQueueBuildPlan,
      nativeQueueBuildApplied,
      nativeQueueRecruitApplied,
      nativeUiScan,
      ibSafeFreeThresh,
      ibIsFreeOrder,
      ibOrders,
      ibComplete,
      researchScan,
      recruitScan,
      tradeScan,
      dodgeScan,
      orchTick,
      alertWebhook,
      attackKnownTargets,
      applyAttackTarget,
      applyHarassPreset,
      buildAttackSchedule,
      sendAttackViaBridge,
      militaryOutgoingMovements,
      militaryCancelCommand,
      playerHeroesList,
      heroAssignToTown,
      heroUnassign,
      heroCancelTravel,
      txCommandStatus,
      txHeroStatus,
      renderAttack,
      openQueueCenter,
      renderQueueCenter,
      dispose: GB_ROOT.__grepbotDispose,
    };
  }
