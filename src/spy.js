  // ---------- ajax spy ----------
  // Grepolis uses jQuery + fetch. Hook both, watch for report ids.
  // World-scoped so report ids don't collide across host switches in same TM storage.
  const seenThisRun = new Set();
  const seenHost = location.hostname;
  function seenKey(id) { return seenHost + ':' + id; }

  function hookFetch() {
    const uw = unsafeWindow;
    if (!uw.fetch) return;
    if (!gbHookOrig.fetch) gbHookOrig.fetch = uw.fetch.bind(uw);
    const orig = gbHookOrig.fetch;
    if (uw.fetch._grepbot) {
      // Re-bind after reinject: replace wrapper so it closes over this instance.
    }
    uw.fetch = function patched(...args) {
      const [url, opts] = args;
      const u = String(url || '');
      const reportCtrl = /\/game\/report(?:\?|$)/.test(u) || /[?&]controller=report(?:&|$)/.test(u);
      const m = u.match(/[?&]action=(report|reports|combat_reports|tombstone|attack_planner)(?:&|$)/)
        || (reportCtrl && u.match(/[?&]action=(view|index|delete)(?:&|$)/));
      const idMatch = u.match(/[?&](?:id|report_id)=(\d+)/);
      if ((m || reportCtrl) && idMatch) queueReport(idMatch[1], u);
      else if (m || reportCtrl) queueReportList(u);
      learnCollectAction(u);
      learnFarmAction(u);
      return orig.apply(uw, args);
    };
    uw.fetch._grepbot = true;
  }

  function hookXhr() {
    const uw = unsafeWindow;
    if (!uw.XMLHttpRequest) return;
    const P = uw.XMLHttpRequest.prototype;
    if (!gbHookOrig.xhrOpen) gbHookOrig.xhrOpen = P.open;
    if (!gbHookOrig.xhrSend) gbHookOrig.xhrSend = P.send;
    const origOpen = gbHookOrig.xhrOpen;
    const origSend = gbHookOrig.xhrSend;
    P.open = function (method, url) {
      this._grepbot_url = url;
      return origOpen.apply(this, arguments);
    };
    P.send = function () {
      const u = String(this._grepbot_url || '');
      const reportCtrl = /\/game\/report(?:\?|$)/.test(u) || /[?&]controller=report(?:&|$)/.test(u);
      const idMatch = u.match(/[?&](?:id|report_id)=(\d+)/);
      const actionReport = /[?&]action=(report|reports|combat_reports|tombstone|attack_planner)(?:&|$)/.test(u);
      if ((actionReport || reportCtrl) && idMatch) {
        queueReport(idMatch[1], u);
      } else if (actionReport || /[?&]action=(reports|combat_reports|tombstone)(?:&|$)/.test(u) || reportCtrl) {
        queueReportList(u);
      }
      learnCollectAction(u);
      learnFarmAction(u);
      sniffBridgeBody(u, arguments[0]);
      this.addEventListener('load', () => {
        try {
          const txt = this.responseText || '';
          const reportish = /(?:^|\/)report(?:s)?(?:\?|$)|[?&](?:controller|action)=(report|reports|combat_reports|tombstone|attack_planner)/.test(u)
            || /\/game\/report/.test(u);
          if (txt.length > 100000 && !reportish) {
            // cheap harvest - only report_id (bare "id" matches towns/farms -> 404 spam)
            const re = /"report_id"\s*:\s*(\d+)/g;
            let m; let n = 0;
            while ((m = re.exec(txt)) && n < 50) { queueReport(m[1], u); n++; }
            return;
          }
          const data = tryParseJson(txt);
          if (!data) return;
          scanResponseForReports(data, u, reportish);
          if (/island_quest|progressable|quest/i.test(u) || /IslandQuest|Progressable|claimReward/i.test(String(this._grepbot_url || '') + txt.slice(0, 500))) {
            learnQuestRewardsFromPayload(data);
          }
        } catch (_) {}
      });
      return origSend.apply(this, arguments);
    };
    P._grepbot_open = true;
  }

  function tryParseJson(txt) {
    if (!txt || typeof txt !== 'string') return null;
    const s = txt.replace(/^\uFEFF/, '').trim();
    if (!s || (s[0] !== '{' && s[0] !== '[' && s[0] !== '"')) return null;
    try { return JSON.parse(s); } catch (_) { return null; }
  }
  function scanResponseForReports(data, srcUrl, reportish) {
    if (!data || typeof data !== 'object') return;
    // Grepolis wraps in {json: {...}, ...} or returns arrays directly
    const collect = (obj, underReports) => {
      if (!obj) return;
      if (Array.isArray(obj)) { obj.forEach(x => collect(x, underReports)); return; }
      if (typeof obj !== 'object') return;
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (k === 'report_id' && (typeof v === 'number' || /^\d+$/.test(v))) {
          queueReport(String(v), srcUrl);
        } else if (k === 'id' && (typeof v === 'number' || /^\d+$/.test(v)) && (underReports || reportish)) {
          queueReport(String(v), srcUrl);
        } else if (k === 'reports' && Array.isArray(v)) {
          v.forEach(r => r && (r.id != null || r.report_id != null) && queueReport(String(r.report_id || r.id), srcUrl));
        } else {
          collect(v, underReports || k === 'reports' || k === 'report');
        }
      }
    };
    collect(data, false);
  }

  // ---------- report fetching ----------
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
    // best-effort: scrape current inbox DOM if present
    gbTimeout(scrapeInboxDom, 1500);
  }

  function ingestReport(id, data) {
    const parsed = parseReport(id, data);
    if (!parsed) {
      seenThisRun.delete(seenKey(id)); // unparsed shape - allow a later retry
      return false;
    }
    rememberSeen(id);
    delete reportRetry[id];
    save(STORE.SEEN, state.seen);
    state.findings.unshift(parsed);
    if (state.findings.length > 500) {
      // Trim visible findings only - keep seen so inbox doesn't re-fetch (I14).
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
  // Prefer gameAjaxPost (host/pause/budget/captcha). HTTP only when gpAjax missing.
  // Old GET /index.php?action=report returned "404 Not Found" -> JSON.parse column-5 noise.
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
    if (!reqBudgetOk()) {
      seenThisRun.delete(seenKey(id));
      gbLogT('report-budget', 30000, 'report: request budget exceeded');
      return;
    }
    reqBudgetMark();
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
    // Matches game buildLink: /game/{controller}?action=...&town_id=...&h=...
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

