  function seenKey(id) { return seenHost + ':' + id; }

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
      // Our own gpAjax posts: gpAjax only calls back on a non-empty success
      // envelope, so settle bridgeRaw/gameAjaxRaw from the raw response here.
      // `loadend` covers success, HTTP error, network failure and abort alike.
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
        this.addEventListener('load', () => {
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

  // Offline report catch-up - bounded, serial, via the wake queue. Uses the
  // shared lock registry so a synchronous throw inside step() cannot strand
  // the loop until reload: the outer try/finally always releases the lease.
  let catchupToken = null;
  function reportCatchUpEnqueue() {
    if (!hostEnabled() || catchupToken || gbLocked('report-catchup')) return;
    if (typeof gbWake === 'function') {
      gbWake('reportCatchUp', () => reportCatchUpRun(), { priority: 80 });
    } else {
      reportCatchUpRun();
    }
  }
  function reportCatchUpRun() {
    if (!hostEnabled() || catchupToken || gbLocked('report-catchup') || automationPaused({}) || captchaPaused('report')) return;
    catchupToken = gbLock('report-catchup', 300000);
    if (!catchupToken) return;
    const token = catchupToken;
    const maxN = 25;
    const maxAgeMs = 72 * 3600000;
    const cut = Date.now() - maxAgeMs;
    const ids = [];
    try {
      document.querySelectorAll('a[href*="report"], a[href*="Report"]').forEach(a => {
        const m = /[?&]id=(\d+)/.exec(a.href || '') || /report\/(\d+)/.exec(a.href || '');
        if (!m) return;
        const id = m[1];
        if (state.seen[seenKey(id)] || state.seen[id] || seenThisRun.has(seenKey(id))) return;
        ids.push(id);
      });
    } catch (_) {}
    const batch = ids.slice(0, maxN);
    const release = () => {
      gbUnlock('report-catchup', token);
      if (token === catchupToken) catchupToken = null;
    };
    if (!batch.length) {
      release();
      gbLogT('catchup-empty', 120000, 'report catch-up: nothing new in inbox DOM');
      return;
    }
    gbLog(`report catch-up: fetching up to ${batch.length} (cap ${maxN}, age≤72h, lastSeen=${state.lastSeenTs || 0})`);
    let i = 0, fetched = 0;
    (function step() {
      let done = false;
      try {
        if (i >= batch.length) {
          gbLog(`report catch-up done: ${fetched}/${batch.length}`);
          done = true;
        } else if (!hostEnabled() || automationPaused({}) || captchaPaused('report') || !reqBudgetOk()) {
          gbLog(`report catch-up paused mid-run at ${i}/${batch.length}`);
          done = true;
        } else {
          const id = batch[i++];
          // Age bound uses lastSeenTs floor when we have no per-id ts yet
          if (state.lastSeenTs && state.lastSeenTs < cut) {
            /* still try recent inbox ids; age bound is soft for DOM-discovered */
          }
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
  function tryParseJson(txt) {
    if (!txt || typeof txt !== 'string') return null;
    const s = txt.replace(/^\uFEFF/, '').trim();
    if (!s || (s[0] !== '{' && s[0] !== '[' && s[0] !== '"')) return null;
    try { return JSON.parse(s); } catch (_) { return null; }
  }
  function scanResponseForReports(data, srcUrl, reportish) {
    if (!data || typeof data !== 'object') return;
    const numericId = (v) => typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v));
    const looksReport = (o) => !!o && typeof o === 'object' && (
      o.report_type != null || o.type != null || o.subject != null || o.attacker != null || o.defender != null ||
      o.timestamp != null || o.created_at != null || o.outcome != null || o.win != null
    );
    const walk = (obj) => {
      if (!obj) return;
      if (Array.isArray(obj)) { obj.forEach(walk); return; }
      if (typeof obj !== 'object') return;
      if (numericId(obj.report_id)) queueReport(String(obj.report_id), srcUrl);
      for (const [k, v] of Object.entries(obj)) {
        if (k === 'reports' && Array.isArray(v)) {
          for (const r of v) {
            if (!r || typeof r !== 'object') continue;
            const rid = r.report_id != null ? r.report_id : r.id;
            if (numericId(rid) && (r.report_id != null || looksReport(r))) queueReport(String(rid), srcUrl);
            walk(r);
          }
        } else if (v && typeof v === 'object') {
          walk(v);
        }
      }
    };
    walk(data);
  }


  const reportRetry = Object.create(null);
  const REPORT_RETRY_MAX = 3;
  function scrapeInboxDom() {
    document.querySelectorAll('a[href*="action=report"][href*="id="]').forEach(a => {
      const m = a.href.match(/id=(\d+)/);
      if (m) queueReport(m[1], a.href);
    });
  }
  function queueReport(id, hintUrl) {
    if (!id) return;
    if (!hostEnabled() || automationPaused({}) || captchaPaused('report')) return;
    const k = seenKey(id);
    if (seenThisRun.has(k) || state.seen[k] || state.seen[id]) return;
    if (seenThisRun.size > 5000) seenThisRun.clear();
    seenThisRun.add(k);
    gbTimeout(() => fetchReport(id, hintUrl), 200 + Math.random() * 800);
  }
  function queueReportList() {

    gbTimeout(scrapeInboxDom, 1500);
  }

  function ingestReport(id, data) {
    const parsed = parseReport(id, data);
    if (!parsed) {
      seenThisRun.delete(seenKey(id));
      return false;
    }
    rememberSeen(id);
    delete reportRetry[id];
    save(STORE.SEEN, state.seen);
    if (parsed.ts && (!state.lastSeenTs || parsed.ts > state.lastSeenTs)) {
      state.lastSeenTs = parsed.ts;
      save(STORE.LAST_SEEN_TS, state.lastSeenTs);
    }
    state.findings.unshift(parsed);
    if (state.findings.length > 500) {

      state.findings.splice(500);
    }
    save(STORE.FINDINGS, state.findings);
    renderFindings();
    return true;
  }
  function reportFetchFail(id, why) {
    gbLogT('report-fail-' + id, 30000, 'report fetch fail', id, why || '');
    const n = (reportRetry[id] || 0) + 1;
    reportRetry[id] = n;
    if (n < REPORT_RETRY_MAX) seenThisRun.delete(seenKey(id));
    else gbLogT('report-retry-cap', 60000, 'report retry capped for', id);
  }

  function fetchReport(id, hintUrl) {
    if (state.seen[seenKey(id)] || state.seen[id]) return;
    if (!hostEnabled() || automationPaused({}) || captchaPaused('report')) {
      seenThisRun.delete(seenKey(id));
      return;
    }
    const params = { id: +id };
    if (hintUrl) {
      try {
        const hp = new URL(hintUrl, location.origin).searchParams;
        if (hp.has('town_id')) params.town_id = +hp.get('town_id');
      } catch (_) {}
    }
    const uw = gameUw();
    if (uw.gpAjax && uw.gpAjax.ajaxPost) {
      gameAjaxPost('report', 'report', 'view', params, (err, data) => {
        if (err === 'captcha' || err === 'captcha-pause') {
          reportFetchFail(id, 'captcha');
          return;
        }
        if (err === 'disabled' || err === 'paused' || err === 'budget' || err === 'dryrun' || err === 'remembered') {
          seenThisRun.delete(seenKey(id));
          return;
        }
        if (err) { reportFetchFail(id, err); return; }
        if (!data) { reportFetchFail(id, 'empty'); return; }
        if (!ingestReport(id, data)) reportFetchFail(id, 'unparsed');
      });
      return;
    }
    fetchReportHttp(id, hintUrl);
  }
  function fetchReportHttp(id, hintUrl) {
    if (!hostEnabled() || automationPaused({}) || captchaPaused('report')) {
      seenThisRun.delete(seenKey(id));
      return;
    }
    const u = buildReportUrl(id, hintUrl);
    const bodyObj = { id: +id };
    try {
      const hp = new URL(u, location.origin).searchParams;
      if (hp.has('town_id')) bodyObj.town_id = +hp.get('town_id');
    } catch (_) {}
    gbXhr({
      method: 'POST',
      url: u,
      data: 'json=' + encodeURIComponent(JSON.stringify(bodyObj)),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/plain, */*',
      },
      anonymous: false,
      onload(res) {
        try {
          if (res.status && res.status >= 400) {
            reportFetchFail(id, 'HTTP ' + res.status);
            return;
          }
          const data = tryParseJson(res.responseText);
          if (!data) {
            const snip = String(res.responseText || '').slice(0, 40).replace(/\s+/g, ' ');
            reportFetchFail(id, 'non-json: ' + snip);
            return;
          }
          if (responseIsCaptcha(data)) {
            captchaTrip('report', JSON.stringify(data).slice(0, 120));
            reportFetchFail(id, 'captcha');
            return;
          }
          if (!ingestReport(id, data)) reportFetchFail(id, 'unparsed');
        } catch (e) {
          reportFetchFail(id, String(e));
        }
      },
      onerror(e) {
        reportFetchFail(id, e && e.error || 'network');
      },
    });
  }

  function buildReportUrl(id, hintUrl) {

    const params = new URLSearchParams();
    params.set('action', 'view');
    params.set('id', id);
    const uw = gameUw();
    let townId = null;
    if (hintUrl) {
      try {
        const hp = new URL(hintUrl, location.origin).searchParams;
        ['town_id', 'attack_type', 'type'].forEach(k => { if (hp.has(k)) params.set(k, hp.get(k)); });
        if (hp.has('town_id')) townId = hp.get('town_id');
      } catch (_) {}
    }
    if (!params.has('town_id')) {
      try { townId = townId || (uw.Game && uw.Game.townId); } catch (_) {}
      if (townId != null) params.set('town_id', String(townId));
    }
    const csrf = state.csrf || (uw.Game && (uw.Game.csrfToken || uw.Game.h));
    if (csrf) params.set('h', csrf);
    return '/game/report?' + params.toString();
  }
