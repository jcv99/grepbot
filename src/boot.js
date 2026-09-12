  const BOOT_TIMING = Object.freeze({

    FIRST_FARM_DEADLINE_MS: 20000,
    FIRST_TOWNS_DEADLINE_MS: 30000,

    INBOX_SCRAPE_MS: 30000,
    FARM_TICK_MS: 15000,
    THRESHOLD_CHECK_MS: 30000,
    TIMERS_RENDER_MS: 1000,
    STATUS_UPDATE_MS: 5000,
    TOWN_SWITCH_MS: 5000,
    CAVE_TICK_MS: 10000,
    LOCK_SWEEP_MS: 10000,
    DODGE_RETURN_MS: 15000,
    NATIVE_QUEUE_LOOP_MS: 60000,
    HOUSEKEEPING_MS: 60000,
    QUEUE_CENTER_PAINT_MS: 5000,
    OVERVIEW_RENDER_MS: 15000,

    HUD_RESTORE_MS: 1500,
    FARM_WAKE_MS: 2500,
    TELEGRAM_BOOT_MS: 3000,
    QUEST_SCAN_BOOT_MS: 5000,
    IB_SCAN_BOOT_MS: 8000,
    AB_TARGETS_MS: 12000,
    NATIVE_UI_SCAN_MS: 1200,
    NATIVE_QUEUE_BOOT_MS: 14000,
    ORCH_FIRST_TICK_MS: 15000,
    IB_CLICK_HOOK_MS: 2000,
  });

  // Loop registry (REDESIGN §4.5 / §6 R6). Boot-time intervals listed once;
  // bootStartLoops() walks the array, wraps each fn with try/catch + the
  // standard 'boot-<name>' gbLogT error key, and starts the gbInterval.
  // Complex loops (compositions, conditions, boot delays) stay inline -
  // the registry is for the simple, repeated pattern. Complex migrations
  // follow once the pattern is proven.
  const BOOT_LOOPS = [
    { name: 'scrapeInboxDom',  fn: scrapeInboxDom,  ms: BOOT_TIMING.INBOX_SCRAPE_MS },
    { name: 'farmTick',        fn: farmTick,        ms: BOOT_TIMING.FARM_TICK_MS },
    { name: 'checkThresholds', fn: checkThresholds, ms: BOOT_TIMING.THRESHOLD_CHECK_MS },
    { name: 'renderTimers',    fn: renderTimers,    ms: BOOT_TIMING.TIMERS_RENDER_MS },
    { name: 'updateStatus',    fn: updateStatus,    ms: BOOT_TIMING.STATUS_UPDATE_MS },
    { name: 'dodgeReturnTick', fn: dodgeReturnTick, ms: BOOT_TIMING.DODGE_RETURN_MS },
  ];
  function bootLoop(entry) {
    const fn = entry.enabledIf ? () => { if (entry.enabledIf()) entry.fn(); } : entry.fn;
    gbInterval(() => {
      try { fn(); }
      catch (e) { gbLogT('boot-' + entry.name, 60000, entry.name + ': ' + String(e?.message || e).slice(0, 80)); }
    }, entry.ms);
  }
  function bootStartLoops() {
    for (const L of BOOT_LOOPS) bootLoop(L);
  }
  function ensurePanelMounted() {
    if (!panel) return;
    if (!document.body.contains(panel)) {
      document.body.appendChild(panel);
      gbLogT('panel-remount', 10000, 'panel remounted after SPA nav');
    }
    try { ensureDomObserver(); } catch (_) {}
  }
  function runningVersion() {
    try { return (GM_info && GM_info.script && GM_info.script.version) || '0.0.0'; }
    catch (_) { return '0.0.0'; }
  }
  function hookSpaNav() {
    const wrap = (name, origKey) => {

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
  try { qolBindActivityPause(); } catch (_) {}

  bootStartLoops();
  refreshFarmsParsed();
  renderFarms();
  renderTimers();
  updateStatus();

  if (!state.nextFarmScrape) { state.nextFarmScrape = Date.now() + BOOT_TIMING.FIRST_FARM_DEADLINE_MS; save(STORE.NEXT_FARM, state.nextFarmScrape); }
  if (!state.nextTownsScrape) { state.nextTownsScrape = Date.now() + BOOT_TIMING.FIRST_TOWNS_DEADLINE_MS; save(STORE.NEXT_TOWNS, state.nextTownsScrape); }
  gbTimeout(() => { if (state.autoFarm) farmScheduleClaimWake(null, 'boot', true); }, BOOT_TIMING.FARM_WAKE_MS);

  // Dedicated out-of-band Telegram heartbeat. This is intentionally independent
  // from the automation/server pause scheduler; the ephemeral monitor Web Lock
  // prevents duplicate sends across tabs.
  gbTimeout(() => { gbTry(() => telegramMonitorTick()); }, BOOT_TIMING.TELEGRAM_BOOT_MS);
  gbInterval(() => { gbTry(() => telegramMonitorTick()); }, TELEGRAM_MONITOR_POLL_MS);
  gbListen(window, 'focus', () => { gbTry(() => telegramMonitorTick()); });
  gbListen(window, 'online', () => { gbTry(() => telegramMonitorTick()); });

  gbListen(document, 'visibilitychange', () => {
    if (document.hidden) return;
    try { gbWakeMarkResume('visible'); } catch (e) { gbLogT('boot-wake-visible', 60000, 'wake visible: ' + String(e?.message || e).slice(0, 80)); }
    gbTry(() => { gbTryAcquireTabLeader(); orchStartIndependentTimers(); });
    gbTry(() => telegramMonitorTick());
    farmTick();
    try { reportCatchUpEnqueue(); } catch (e) { gbLogT('boot-catchup', 60000, 'catchup: ' + String(e?.message || e).slice(0, 80)); }
    try { gbWake('ibScan', () => ibScan(), { priority: 10 }); } catch (e) { gbLogT('boot-wake-ib', 60000, 'wake ibScan: ' + String(e?.message || e).slice(0, 80)); }
    try { orchStartIndependentTimers(); gbWake('orchTick', () => orchTick(), { priority: 30 }); } catch (e) { gbLogT('boot-wake-orch', 60000, 'wake orchTick: ' + String(e?.message || e).slice(0, 80)); }
    try { nativeQueueSweep('visible'); } catch (e) { gbLogT('boot-nqs-visible', 60000, 'nqs visible: ' + String(e?.message || e).slice(0, 80)); }

    try { renderTimers(); renderFarms(); renderWorld(); updateStatus(); } catch (e) { gbLogT('boot-repaint-visible', 60000, 'repaint visible: ' + String(e?.message || e).slice(0, 80)); }
  });
  gbListen(window, 'pageshow', (e) => {
    if (!(e && e.persisted)) return;

    releaseLocksAt = 0;
    try { gbWakeMarkResume('bfcache'); } catch (e) { gbLogT('boot-wake-bfcache', 60000, 'wake bfcache: ' + String(e?.message || e).slice(0, 80)); }
    gbTry(() => { gbTryAcquireTabLeader(); orchStartIndependentTimers(); });
    gbTry(() => telegramMonitorTick());
    farmTick();
    try { reportCatchUpEnqueue(); } catch (e) { gbLogT('boot-catchup', 60000, 'catchup: ' + String(e?.message || e).slice(0, 80)); }
    try { bindQuestObserver(); } catch (e) { gbLogT('boot-quest-obs', 60000, 'quest observer: ' + String(e?.message || e).slice(0, 80)); }
    try { gbWake('ibScan', () => ibScan(), { priority: 10 }); } catch (e) { gbLogT('boot-wake-ib', 60000, 'wake ibScan: ' + String(e?.message || e).slice(0, 80)); }
    try { orchStartIndependentTimers(); gbWake('orchTick', () => orchTick(), { priority: 30 }); } catch (e) { gbLogT('boot-wake-orch', 60000, 'wake orchTick: ' + String(e?.message || e).slice(0, 80)); }
    try { nativeQueueSweep('bfcache'); } catch (e) { gbLogT('boot-nqs-bfcache', 60000, 'nqs bfcache: ' + String(e?.message || e).slice(0, 80)); }
    try { renderTimers(); renderFarms(); renderWorld(); updateStatus(); } catch (e) { gbLogT('boot-repaint-bfcache', 60000, 'repaint bfcache: ' + String(e?.message || e).slice(0, 80)); }
  });
  gbInterval(() => { try { renderTownSwitch(); } catch (e) { gbLogT('boot-town-switch', 60000, 'town switch: ' + String(e?.message || e).slice(0, 80)); } }, BOOT_TIMING.TOWN_SWITCH_MS);
  gbInterval(() => { try { caveTownsTick(); } catch (e) { gbLogT('boot-cave-tick', 60000, 'cave tick: ' + String(e?.message || e).slice(0, 80)); } }, BOOT_TIMING.CAVE_TICK_MS);

  bindQuestObserver();
  gbTimeout(() => { if (hostEnabled()) questScanTick('boot'); }, BOOT_TIMING.QUEST_SCAN_BOOT_MS);
  gbInterval(() => { if (hostEnabled()) questScanTick('loop'); }, QUEST_SCAN_MS);

  gbListen(document, 'click', (e) => {
    let t = e.target;
    for (let i = 0; i < 5 && t; i++) {
      if (String(t.className || '').indexOf('button_build') !== -1) { gbTimeout(ibScan, BOOT_TIMING.IB_CLICK_HOOK_MS); break; }
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
  }, BOOT_TIMING.IB_SCAN_BOOT_MS);
  gbTimeout(() => { abEnsureTargets(); }, BOOT_TIMING.AB_TARGETS_MS);
  gbTimeout(scheduleNativeUiScan, BOOT_TIMING.NATIVE_UI_SCAN_MS);
  gbInterval(() => {

    if (queueCenterVisible() || nativeQueueHasPending('build') || nativeRecruitPending() || nativeQueueHasPending('research')) {
      try { renderQueueCenter(); } catch (e) { gbLogT('boot-qc-paint', 60000, 'queue center paint: ' + String(e?.message || e).slice(0, 80)); }
    }

    scheduleNativeUiScan();
  }, BOOT_TIMING.QUEUE_CENTER_PAINT_MS);

  gbTimeout(() => { try { nativeQueueSweep('boot'); } catch (e) { gbLogT('boot-nqs-boot', 60000, 'native queue boot: ' + String(e?.message || e).slice(0, 80)); } }, BOOT_TIMING.NATIVE_QUEUE_BOOT_MS);
  gbInterval(() => { try { nativeQueueSweep('loop'); } catch (e) { gbLogT('boot-nqs-loop', 60000, 'native queue loop: ' + String(e?.message || e).slice(0, 80)); } }, BOOT_TIMING.NATIVE_QUEUE_LOOP_MS);
  gbInterval(() => dodgeScan('loop'), DODGE_CHECK_MS);

  // Create module timers unconditionally; each tick gates on hostEnabled().
  // This makes scheduler installation independent of the exact leader state at boot.
  orchStartIndependentTimers();
  gbTimeout(() => { orchStartIndependentTimers(); if(hostEnabled())orchTick(); }, BOOT_TIMING.ORCH_FIRST_TICK_MS);
  gbInterval(() => { orchStartIndependentTimers(); orchHousekeepingTick(); }, BOOT_TIMING.HOUSEKEEPING_MS);
  gbInterval(() => {

    renderOverview();
    renderIntel();
    renderStats();
    intelGrepodataAssist();
    intelWatchlistScan();
  }, BOOT_TIMING.OVERVIEW_RENDER_MS);
  gbKeyBind();
  contextMenuStart();
  gbTimeout(() => { try { hudRestore(); } catch (e) { gbLogT('boot-hud-restore', 60000, 'hud restore: ' + String(e?.message || e).slice(0, 80)); } }, BOOT_TIMING.HUD_RESTORE_MS);

  gbInterval(() => { gbLockSweep(); try { diagnosticsTick(); } catch (e) { gbLogT('boot-diag-tick', 60000, 'diag tick: ' + String(e?.message || e).slice(0, 80)); } }, BOOT_TIMING.LOCK_SWEEP_MS);
  let releaseLocksAt = 0;
  const RELEASE_DEDUP_MS = 3000;
  const releaseLocks = () => {
    const now = Date.now();
    if (now - releaseLocksAt < RELEASE_DEDUP_MS) return;
    releaseLocksAt = now;
    try { cancelArmedAttack(); } catch (e) { gbLogT('boot-release-armed', 60000, 'cancel armed: ' + String(e?.message || e).slice(0, 80)); }

    try { ibClearArmed(); } catch (e) { gbLogT('boot-release-ib', 60000, 'ib clear armed: ' + String(e?.message || e).slice(0, 80)); }
    try { gbUnlockAll(); } catch (e) { gbLogT('boot-release-locks', 60000, 'unlock all: ' + String(e?.message || e).slice(0, 80)); }
    try { banditAttackSentAt = 0; } catch (e) { gbLogT('boot-release-bandit', 60000, 'bandit stamp: ' + String(e?.message || e).slice(0, 80)); }
    try { if (typeof dodgeQueueSave === 'function') dodgeQueueSave(); } catch (e) { gbLogT('boot-release-dodge', 60000, 'dodge save: ' + String(e?.message || e).slice(0, 80)); }
    try { if (typeof questClaimFailSave === 'function') questClaimFailSave(); } catch (e) { gbLogT('boot-release-quest', 60000, 'quest save: ' + String(e?.message || e).slice(0, 80)); }
    try { if (typeof persistServerCooldown === 'function') persistServerCooldown(); } catch (e) { gbLogT('boot-release-cooldown', 60000, 'cooldown save: ' + String(e?.message || e).slice(0, 80)); }
    try { if (typeof nativeQueueSaveFlush === 'function') nativeQueueSaveFlush(); } catch (e) { gbLogT('boot-release-nqs', 60000, 'nqs flush: ' + String(e?.message || e).slice(0, 80)); }
    try { if(gbTabLeader)snapshotBuild('exit'); } catch (e) { gbLogT('boot-release-snap', 60000, 'snapshot: ' + String(e?.message || e).slice(0, 80)); }

    try { if (typeof saveFlush === 'function') saveFlush(); } catch (e) { gbLogT('boot-release-save', 60000, 'save flush: ' + String(e?.message || e).slice(0, 80)); }
  };
  gbListen(window, 'beforeunload', releaseLocks);
  gbListen(window, 'pagehide', releaseLocks);

  if (GB_ROOT.__grepbotTestMode === true) {
    GB_ROOT.__grepbotTest = {
      instanceId: GB_INSTANCE_ID,
      state,
      STORE,
      TX_WRITE_FEATURES,
      load,
      save,
      gbRedact,
      saveFlush,
      migrateConfig,
      migrateGlobalConfig,
      ensureHostDefault,
      gbStorageReadFailed,
      gbLegacyWorldGate,
      gbLegacyWorldHostProof,
      gbLegacyWorldOneShotEligible,
      gbLegacyWorldMigrationFinalize,
      gbExpectedServerReject,
      farmScheduleNotReadyWake,
      gbAjaxWatch,
      gbAjaxClaim,
      gbAjaxPendingCount: () => gbAjaxPending.length,
      gbAjaxPendingSnapshot: () => gbAjaxPending.map(p => ({ sig:p.sig, fp:p.fp, claimed:!!p.claimed })),
      txLoadNormalize,
      txPrune,
      txFindExistingIntent,
      plannerReservePolicy,
      farmDayKey,
      gbServerDay,
      markModuleHealth,
      moduleHealth,
      recruitAutoSpellDecision,
      batchRecruitAtomicAfford,
      batchRecruitFire,
      gbLeaderHandoverFlush,
      lifecycle: () => ({ disposed:gbDisposed, leader:gbTabLeader, lockHeld:!!gbTabLockRelease }),
      bridgePost,
      bridgeGet,
      gameAjaxPost,
      txRun,
      txReconcileNow,
      txIntent,
      txCapture,
      txEnsureIdentity,
      txDiagnosticSnapshot,
      txProbeEvidence,
      txClearUnknown,
      txClearOne,
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
      goldLearnPayload,
      goldActionsReady,
      goldScan,
      goldConsumerGate,
      goldTransportGuard,
      goldOfferTxSnapshot,
      goldTxSnapshot,
      goldTxProbeEvidence,
      goldDiagnosticSnapshot,
      goldReviewResolve,
      goldRecoverLeaderPending,
      goalProfiles,
      goalEffective,
      goalEffectiveBuildTargets,
      goalEffectiveResearchTargets,
      goalEffectiveRecruitTargets,
      cdCanonicalProfile,
      cdIsProfile,
      cdSyncTownGoal,
      cdPersistTownGoal,
      cdTownState,
      cdSetOption,
      cdProfileRevision,
      cdEffective,
      cdBuildTargets,
      cdBaseBuild,
      cdActualLevels,
      abActualLevels,
      cdResearchTargets,
      cdRecruitTargets,
      roleAdvisorCfg,
      roleAdvisorReassess,
      roleAdvisorApply,
      roleAdvisorSetLock,
      cdPhase,
      cdBuildDone,
      cdResearchDone,
      cdResearchExecutable,
      cdResearchCapacityState,
      cdCompositionResearchReady,
      cdAuxDone,
      cdArmyDone,
      cdCanStartStrip,
      cdAcademyDemolitionSafe,
      cdNextDemolition,
      cdThreatState,
      cityDesignerHasExecutableWork,
      cdSolveLandBudget,
      cdSolveDefenseBudget,
      goalUnitCountsState,

      gbCityProfile: goalEffective,

      townPopState,
      transportTownRes,
      transportProjectHeadroom,
      transportTownETA,
      transportBalanceJobs,
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
      tradeRouteJobs,
      tradeRoutesSave,
      resourceOptimizerCfg,
      resourceOptimizerPlan,
      resourceOptimizerJobs,
      resourceOptimizerSetCfg,
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
      abPickNextFromLevels,
      abFinalValidate,
      abBuildUp,
      abQueueInfo,
      abEnsureOrder,
      nativeQueueRoot,
      nativeQueueTown,
      nativeQueueList,
      nativeQueueAddBuild,
      nativeQueueRemoveLastBuild,
      nativeQueueAddRecruit,
      nativeQueueAddRecruitBatch,
      nativeQueueAddRecruitInfinite,
      nativeQueueCompactRecruit,
      nativeQueueRemoveLastRecruit,
      nativeQueueAddResearch,
      nativeQueueRemoveResearch,
      nativeQueueResearchApplied,
      nativeQueueMove,
      nativeQueueBuildPlan,
      nativeQueueBuildApplied,
      nativeQueueRecruitApplied,
      nativeUiScan,

      nativeWindowTownId,
      nativeUnitId,
      ibSafeFreeThresh,
      ibIsFreeOrder,
      ibOrders,
      ibComplete,
      researchScan,
      recruitScan,
      villageRecruitScan,
      farmClaimTypeFor,
      farmResExhausted,
      farmDailyLeft,
      farmUnitOption,
      farmUnitsClaimBlocked,
      farmClaimUnitsTable,
      farmVillageLevel,
      farmClaimDiag,
      tradeTownRes,
      tradeOverflowDecision,
      tradeOverflowJobs,
      tradeValidateOverflowJob,
      tradeDiagnosticsSnapshot,
      tradeIncomingByTown,
      ruralTradeDecision,
      ruralExecutableOverflowCandidates,
      ruralExecutableOverflowPairSet,
      ruralValidateJob,
      ruralTradeCooldownState,
      ruralOfferData,
      ruralSameIslandTowns,
      ruralCandidateRowsForTown,
      ruralReconcileTrade,
      recruitQueueHasSpace,
      recruitQueueSpace,
      recruitRuntimeEffectiveCost,
      recruitRuntimeMaxAmount,
      recruitEffectiveUnitCost,
      recruitCostFieldKnown,
      ruralKillpoints,
      ruralLevelCostInfo,
      ruralTradeScan,
      ruralTradePost,
      resolveIslandResourceBeneficiary,
      resolveIslandUnitBeneficiary,
      farmIslandContext,
      townCanonicalIslandId,
      townIslandKey,
      townIdForFarm,
      townIdForFarmUnits,
      tradeScan,
      dodgeScan,
      orchTick,
      orchFeatureEnabled,
      farmTick,
      firstPostLiveOk,
      firstPostLiveAuthorize,
      firstPostLiveAuthorizeAll,
      firstPostLivePendingFeatures,
      dodgeIncomingSnapshot,
      alertWebhook,
      telegramTokenLooksValid,
      telegramChatIdLooksValid,
      telegramSendText,
      telegramDetectChatId,
      telegramCaptchaTripNotify,
      telegramCaptchaMaybeResolved,
      telegramCaptchaStillPaused,
      telegramNotify,
      telegramAttackMessage,
      telegramAttackMonitor,
      telegramWarehouseMonitor,
      telegramCriticalCandidates,
      telegramCriticalMonitor,
      telegramBuildHourlyDigest,
      telegramDiagErrorId,
      telegramDiagSanitizeText,
      telegramRecentErrorGroups,
      telegramBuildSupportReport,
      telegramWarehouseDiagnostic,
      telegramSupportModeStart,
      telegramSupportModeStop,
      telegramHourlyDigestTick,
      telegramMonitorTick,
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
      rfBuildSchedule,
      rfSend,
      renderReinforce,
      spsPlan,
      spsRun,
      spsStop,
      renderSpySend,
      openQueueCenter,
      renderQueueCenter,
      dispose: GB_ROOT.__grepbotDispose,
    };
  }
