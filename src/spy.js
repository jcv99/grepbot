  const SPY_LOAD_GATE_RE = /report|tombstone|attack_planner|quest|progressable|frontend_bridge/i;
  function hookFetch() {
    const uw = gameUw();
    if (!uw.fetch) return;
    if (uw.fetch.__grepbotOwner === GB_INSTANCE_ID) return;
    if (!gbHookOrig.fetch) gbHookOrig.fetch = uw.fetch;
    const orig = gbHookOrig.fetch;
    const patched = function (...args) {
      if (gbInstanceAlive()) {
        try {
          const [url] = args;
          const u = String(url || '');
          const reportCtrl = /\/game\/report(?:\?|$)/.test(u) || /[?&]controller=report(?:&|$)/.test(u);
          const m = u.match(/[?&]action=(report|reports|combat_reports|tombstone|attack_planner)(?:&|$)/)
            || (reportCtrl && u.match(/[?&]action=(view|index|delete)(?:&|$)/));
          const idMatch = u.match(/[?&](?:id|report_id)=(\d+)/);
          if ((m || reportCtrl) && idMatch) queueReport(idMatch[1], u);
          else if (m || reportCtrl) queueReportList(u);
          learnCollectAction(u);
          learnFarmAction(u);
          try { ptLearnFromXhr(u, args[1] && args[1].body); } catch (_) {}
        } catch (_) {}
      }
      return orig.apply(this, args);
    };
    patched._grepbot = true;
    patched.__grepbotOwner = GB_INSTANCE_ID;
    uw.fetch = patched;
  }
  function hookXhr() {
    const uw = gameUw();
    if (!uw.XMLHttpRequest) return;
    const P = uw.XMLHttpRequest.prototype;
    if (P.open && P.open.__grepbotOwner === GB_INSTANCE_ID) return;
    if (!gbHookOrig.xhrOpen) gbHookOrig.xhrOpen = P.open;
    if (!gbHookOrig.xhrSend) gbHookOrig.xhrSend = P.send;
    const origOpen = gbHookOrig.xhrOpen;
    const origSend = gbHookOrig.xhrSend;

    const patchedOpen = function (method, url) {
      this._grepbot_url = url;
      return origOpen.apply(this, arguments);
    };
    patchedOpen._grepbot = true;
    patchedOpen.__grepbotOwner = GB_INSTANCE_ID;

    const patchedSend = function () {
      const body = arguments[0];
      const u = String(this._grepbot_url || '');
      if (gbInstanceAlive()) {
        try {
          const reportCtrl = /\/game\/report(?:\?|$)/.test(u) || /[?&]controller=report(?:&|$)/.test(u);
          const idMatch = u.match(/[?&](?:id|report_id)=(\d+)/);
          const actionReport = /[?&]action=(report|reports|combat_reports|tombstone|attack_planner)(?:&|$)/.test(u);
          if ((actionReport || reportCtrl) && idMatch) queueReport(idMatch[1], u);
          else if (actionReport || /[?&]action=(reports|combat_reports|tombstone)(?:&|$)/.test(u) || reportCtrl) queueReportList(u);
          learnCollectAction(u);
          learnFarmAction(u);
          try { ptLearnFromXhr(u, body); } catch (_) {}
          sniffBridgeBody(u, body);
        } catch (_) {}
      }

      try {
        const settle = gbAjaxClaim(u, body);
        if (settle) {
          this.addEventListener('loadend', () => {
            let raw = null;
            try { raw = tryParseJson(this.responseText || ''); } catch (_) {}
            try { settle(this.status, raw); } catch (_) {}
          });
        }
      } catch (_) {}
      try {

        const urlInteresting = SPY_LOAD_GATE_RE.test(u);
        if (urlInteresting) this.addEventListener('load', () => {
          if (!gbInstanceAlive()) return;
          try {
            const txt = this.responseText || '';
            const reportish = /(?:^|\/)report(?:s)?(?:\?|$)|[?&](?:controller|action)=(report|reports|combat_reports|tombstone|attack_planner)/.test(u)
              || /\/game\/report/.test(u);
            if (txt.length > 100000 && !reportish) {
              const re = /"report_id"\s*:\s*(\d+)/g;
              let m; let n = 0;
              while ((m = re.exec(txt)) && n < 50) { queueReport(m[1], u); n++; }
              return;
            }
            const data = tryParseJson(txt);
            if (!data) return;
            scanResponseForReports(data, u, reportish);
            if (/island_quest|progressable|quest/i.test(u) || /IslandQuest|Progressable|claimReward/i.test(u + txt.slice(0, 500))) {
              learnQuestRewardsFromPayload(data);
            }
          } catch (_) {}
        }, { once: true });
      } catch (_) {}
      return origSend.apply(this, arguments);
    };
    patchedSend._grepbot = true;
    patchedSend.__grepbotOwner = GB_INSTANCE_ID;
    P.open = patchedOpen;
    P.send = patchedSend;
    P._grepbot_open = GB_INSTANCE_ID;
  }

  function reportCatchUpEnqueue() {
    if (!hostEnabled() || gbLocked('report-catchup')) return;
    if (typeof gbWake === 'function') {
      gbWake('reportCatchUp', () => reportCatchUpRun(), { priority: 80 });
    } else {
      reportCatchUpRun();
    }
  }
  function reportCatchUpRun() {
    if (!hostEnabled() || gbLocked('report-catchup') || automationPaused({}) || captchaPaused('report')) return;
    const token = gbLock('report-catchup', 300000);
    if (!token) return;
    const maxN = 25;
    const maxAgeMs = 72 * 3600000;
    const cut = Date.now() - maxAgeMs;
    const ids = [];
    try {
      document.querySelectorAll('a[href*="report"], a[href*="Report"]').forEach(a => {
        const m = /[?&]id=(\d+)/.exec(a.href || '') || /report\/(\d+)/.exec(a.href || '');
        if (!m) return;
        const id = m[1];
        if (state.seen[seenKey(id)] || seenThisRun.has(seenKey(id))) return;
        ids.push(id);
      });
    } catch (_) {}

    const firstRun = !state.lastSeenTs;
    const staleFloor = !!(state.lastSeenTs && state.lastSeenTs < cut);
    const cap = (firstRun || staleFloor) ? 5 : maxN;
    const batch = ids.slice(0, cap);
    const release = () => { gbUnlock('report-catchup', token); };
    if (!batch.length) {
      release();
      gbLogT('catchup-empty', 120000, 'report catch-up: nothing new in inbox DOM');
      return;
    }
    gbLog(`report catch-up: fetching up to ${batch.length} (cap ${cap}${firstRun ? ' first-run sample' : staleFloor ? ` lastSeen older than ${Math.round(maxAgeMs / 3600000)}h` : ''}, lastSeen=${state.lastSeenTs || 0})`);
    let i = 0, fetched = 0;
    (function step() {
      let done = false;
      try {
        if (i >= batch.length) {
          gbLog(`report catch-up done: ${fetched}/${batch.length}`);
          done = true;
        } else if (!hostEnabled() || automationPaused({}) || captchaPaused('report') || !reqBudgetOk('read')) {
          gbLog(`report catch-up paused mid-run at ${i}/${batch.length}`);
          done = true;
        } else {
          const id = batch[i++];
          fetchReport(id);
          fetched++;
        }
      } catch (e) {
        gbLog('report catch-up: step error', String(e && e.message || e));
        gbLog(`report catch-up aborted on error at ${i}/${batch.length}`);
        done = true;
      } finally {
        if (done) release();
        else gbTimeout(step, 700 + Math.random() * 300);
      }
    })();
  }
