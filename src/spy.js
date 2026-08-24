  // Report-dedup state lives with its only writer. It used to be declared at the
  // tail of journal.js, so the module that owns it could not be reordered
  // without a TDZ failure in a file that never mentions reports.
  const seenThisRun = new Set();
  // state.seen is persisted under a world-scoped storage key already (wkey
  // appends '@<hostname>'), so the old `<hostname>:<id>` in-memory prefix scoped
  // it a second time — and made every `state.seen[id]` fallback dead code. The
  // key is the bare report id; core.js strips legacy prefixes once on load.
  function seenKey(id) { return String(id); }
  // Gate for the XHR `load` reader (see patchedSend). A URL that matches none of
  // these cannot carry a report id or a quest reward, so there is nothing to
  // read out of its body. Deliberately generous - a false positive costs one
  // JSON.parse, a false negative silently loses a report:
  //  - report / tombstone / attack_planner: the report paths themselves
  //  - quest / progressable / island_quest: the quest-reward learner
  //  - frontend_bridge: the bridge envelope, where the >100KB "report_id buried
  //    in a big payload" fallback finds ids the URL never named
  // NOT gated in: a bare `/index.php?...`. It is the game's generic endpoint and
  // matches nearly every SPA request, which is exactly the cost this gate
  // exists to remove. The consequence is that the big-payload scavenger no
  // longer runs on an unnamed /index.php response; the named report URLs are
  // still caught on the send path by queueReport / queueReportList above.
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
          else if (m || reportCtrl) queueReportList();
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
          else if (actionReport || /[?&]action=(reports|combat_reports|tombstone)(?:&|$)/.test(u) || reportCtrl) queueReportList();
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
        // Pre-filter on the URL BEFORE attaching. Attaching unconditionally made
        // every single game XHR materialize responseText and run a full
        // JSON.parse plus a recursive report walk - the SPA issues these
        // constantly. Only a URL that could plausibly carry a report or a quest
        // reward is worth reading.
        // The `>100KB` branch below is the fallback for a report id buried in a
        // response whose URL says nothing, so the gate must let big-payload
        // *bundle* URLs through too; `frontend_bridge` is where those arrive.
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
  // Offline report catch-up - bounded, serial, via the wake queue. The shared
  // lock registry is the single in-flight signal; gbLocked()/gbUnlock() already
  // handle foreign-token rejection, so a local token is redundant.
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
    // Inbox links carry no timestamp, so the only age signal is lastSeenTs. On a
    // fresh install it is 0 and nothing bounded the batch: the first run spent 25
    // requests on reports that could be weeks old. Sample a few instead — the
    // first one that parses sets lastSeenTs and the full cap applies from then on.
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
            // walk(r) already queues r.report_id; queueing it here too meant
            // every nested report was enqueued twice and only seenThisRun kept
            // the second one from becoming a second request.
            if (r.report_id == null && numericId(r.id) && looksReport(r)) queueReport(String(r.id), srcUrl);
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
      // Anchored like reportCatchUpRun's matcher: a bare /id=(\d+)/ also matches
      // town_id= / view_id= / player_id= and queued those as report ids.
      const m = a.href.match(/[?&]id=(\d+)/);
      if (m) queueReport(m[1], a.href);
    });
  }
  function queueReport(id, hintUrl) {
    if (!id) return;
    if (!hostEnabled() || automationPaused({}) || captchaPaused('report')) return;
    const k = seenKey(id);
    if (seenThisRun.has(k) || state.seen[k]) return;
    if (seenThisRun.size > 5000) seenThisRun.clear();
    seenThisRun.add(k);
    gbTimeout(() => fetchReport(id, hintUrl), 200 + Math.random() * 800);
  }
  // No parameter on purpose: a report LIST url identifies no single report, so
  // there is no hint to carry. Both call sites used to pass the url and it was
  // silently dropped, which read like a lost argument.
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
    try { intelDigestEnqueue(parsed); } catch (_) {}
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
    if (state.seen[seenKey(id)]) return;
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
      feature: 'spy-report',
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
  // ===== Auto-spy scheduler (v4 plan 4.1) ====================================
  // Scout-class: it spends silver and can return a captcha, so it is default
  // OFF, dry-run ON out of the box, and confirm-gated once per session.
  //
  // THE SPY ROUTE IS AN EXPLICIT UNKNOWN. No action name or payload for
  // sending a spy exists anywhere in this tree, so nothing is guessed: the
  // cycle refuses to post until spyTpl has been learned from the player's own
  // hand-sent spy. A guessed endpoint would burn silver on a guaranteed
  // rejection every cadence.
  const SPY_STALE_MS = 7 * 86400000;
  const SPY_WATCH_BONUS = 1000;
  const SPY_REPORT_BONUS = 100;
  function spyCfg() {
    const c = (state.spyCfg && typeof state.spyCfg === 'object') ? state.spyCfg : {};
    return {
      targets: Array.isArray(c.targets) ? c.targets.map(String).filter(Boolean) : [],
      autoWatchlist: c.autoWatchlist !== false,
      autoTopReported: gbCfgClamp(c.autoTopReported, 0, 50, 5),
      perCycle: gbCfgClamp(c.perCycle, 1, 5, 1),
      minGapMs: gbCfgClamp(c.minGapMs, 60000, 86400000, 1200000),
      // Dry-run defaults ON for this feature specifically: the route is
      // unlearned on a fresh install and the operator should see the payload
      // before any silver is spent.
      dryRun: c.dryRun !== false,
      confirmOncePerCycle: c.confirmOncePerCycle !== false,
      maxConcurrent: gbCfgClamp(c.maxConcurrent, 1, 20, 3),
    };
  }
  function spyCfgSave() { save(STORE.SPY_CFG, state.spyCfg || {}); }
  function spyLastSpy() {
    if (!state.spyLastSpy || typeof state.spyLastSpy !== 'object' || Array.isArray(state.spyLastSpy)) state.spyLastSpy = {};
    return state.spyLastSpy;
  }
  function spyHistorySave() { save(STORE.SPY_HISTORY, spyLastSpy()); }
  // NOT a module-local *InFlight boolean, and deliberately not gbLock: the lock
  // registry is binary per lock NAME, and what this needs is a per-target
  // CONCURRENCY COUNT (maxConcurrent spy waves against one town at once), which
  // one lock name cannot express. The two properties the lock rule actually
  // protects are kept: entries expire on their own (TTL below, no lease that
  // outlives a lost callback) and nothing here can wedge another feature.
  // In-flight is a TIMESTAMP list per target, not a bare counter: a callback
  // that never fires (mobile background, bfcache) would leave a counter stuck
  // above maxConcurrent and park that target forever. Entries age out on the
  // bridge timeout budget, so the worst case is one wasted slot for one window.
  const SPY_INFLIGHT_TTL_MS = 120000;
  const spyInFlightAt = Object.create(null);
  function spyInFlightCount(id) {
    const k = String(id), now = Date.now();
    const list = (spyInFlightAt[k] || []).filter(t => now - t < SPY_INFLIGHT_TTL_MS);
    if (list.length) spyInFlightAt[k] = list; else delete spyInFlightAt[k];
    return list.length;
  }
  function spyInFlightAdd(id) {
    const k = String(id);
    if (!spyInFlightAt[k]) spyInFlightAt[k] = [];
    spyInFlightAt[k].push(Date.now());
  }
  function spyInFlightDone(id) {
    const k = String(id);
    if (spyInFlightAt[k] && spyInFlightAt[k].length) spyInFlightAt[k].shift();
    if (spyInFlightAt[k] && !spyInFlightAt[k].length) delete spyInFlightAt[k];
  }
  function spyReports24h() {
    const since = Date.now() - 86400000;
    const byTown = Object.create(null);
    for (const f of (state.findings || [])) {
      if (!f || +f.ts < since) continue;
      const id = f.town && f.town.id;
      if (id == null || id === '') continue;
      byTown[String(id)] = (byTown[String(id)] || 0) + 1;
    }
    return byTown;
  }
  function spyIsWatched(townId) {
    const list = state.watchlist || [];
    return list.some(w => {
      const id = (w && typeof w === 'object') ? (w.id != null ? w.id : w.townId) : w;
      return id != null && String(id) === String(townId);
    });
  }
  function spyRankTargets() {
    const cfg = spyCfg();
    const now = Date.now();
    const last = spyLastSpy();
    const reports = spyReports24h();
    const pool = new Set(cfg.targets);
    if (cfg.autoWatchlist) {
      for (const w of (state.watchlist || [])) {
        const id = (w && typeof w === 'object') ? (w.id != null ? w.id : w.townId) : w;
        if (id != null && id !== '') pool.add(String(id));
      }
    }
    if (cfg.autoTopReported > 0) {
      Object.entries(reports)
        .sort((a, b) => b[1] - a[1])
        .slice(0, cfg.autoTopReported)
        .forEach(([id]) => pool.add(id));
    }
    const out = [];
    for (const id of pool) {
      // An unreadable / absent lastSpyAt means "never spied", which is the
      // STALEST case, not the freshest - a missing stamp must not park a
      // target at the bottom of the queue forever.
      const lastAt = Number.isFinite(+last[id]) ? +last[id] : now - SPY_STALE_MS;
      const age = now - lastAt;
      if (age < cfg.minGapMs) continue;
      if (spyInFlightCount(id) >= cfg.maxConcurrent) continue;
      const watch = spyIsWatched(id);
      const r24 = reports[id] || 0;
      out.push({
        id,
        score: age + (watch ? SPY_WATCH_BONUS : 0) + SPY_REPORT_BONUS * Math.max(0, r24 - 1),
        lastSpyAt: Number.isFinite(+last[id]) ? +last[id] : null,
        watch,
        reports24h: r24,
      });
    }
    return out.sort((a, b) => b.score - a.score);
  }
  let spyConfirmedThisSession = false;
  function spyCycle(reason) {
    if (!state.spyEnabled) return;
    if (!hostEnabled() || automationPaused({})) return;
    if (captchaPaused('spy')) return;
    if (gbLocked('spy')) return;
    const tpl = state.spyTpl;
    if (!tpl || !tpl.model_url || !tpl.action_name) {
      gbLogT('spy-no-tpl', 300000, 'spy: no template learned - hand-spy one town once to capture the route');
      return;
    }
    const cfg = spyCfg();
    const ranked = spyRankTargets();
    if (!ranked.length) { gbLogT('spy-idle', 300000, `spy: no target due (${scanReason(reason)})`); return; }
    const picks = ranked.slice(0, cfg.perCycle);
    if (cfg.confirmOncePerCycle && !spyConfirmedThisSession) {
      const top = ranked.slice(0, 3).map(t => `#${t.id} (score ${Math.round(t.score / 1000)}k${t.watch ? ', vigilada' : ''})`).join('\n  ');
      let ok = false;
      try { ok = gameUw().confirm(`${cfg.dryRun ? '[SIMULACION] ' : ''}Espiar automaticamente?\n  ${top}\n\nAceptar habilita el resto de la sesion.`); } catch (_) { ok = false; }
      if (!ok) { gbLog('spy: confirm declined - cycle skipped'); return; }
      spyConfirmedThisSession = true;
    }
    const lockToken = gbLock('spy');
    if (!lockToken) return;
    let i = 0;
    (function next() {
      if (!gbLockTouch('spy', lockToken)) return;
      if (i >= picks.length) { gbUnlock('spy', lockToken); return; }
      const t = picks[i++];
      const payload = {
        model_url: tpl.model_url,
        action_name: tpl.action_name,
        arguments: Object.assign({}, tpl.arguments || {}, { id: /^\d+$/.test(t.id) ? +t.id : t.id }),
        town_id: tpl.town_id,
      };
      // Feature-local dry run, on top of the global one: this feature ships
      // with it ON so the operator sees a real payload before spending silver.
      if (cfg.dryRun) {
        gbLog(`DRY-RUN spy: ${JSON.stringify(payload).slice(0, 200)}`);
        spyLastSpy()[t.id] = Date.now();
        spyHistorySave();
        gbTimeout(next, 400);
        return;
      }
      spyInFlightAdd(t.id);
      bridgePost('spy', payload, (err) => {
        spyInFlightDone(t.id);
        if (err === 'captcha' || err === 'captcha-pause') { gbUnlock('spy', lockToken); return; }
        if (!err) {
          spyLastSpy()[t.id] = Date.now();
          spyHistorySave();
          gbLog(`spy: sent to ${t.id}`);
        } else gbLogT('spy-err', 60000, `spy err ${err}`);
        gbTimeout(next, 900 + Math.random() * 600);
      });
    })();
  }
  // Learned from the player's own hand-sent spy, never guessed.
  function spyLearnTemplate(j) {
    if (!j || !j.model_url || !j.action_name) return;
    if (typeof isSelfBridge === 'function' && isSelfBridge(j)) return;
    learnTemplate('spyTpl', STORE.SPY_TPL, j, { stripArgs: ['id'], label: 'spy' });
  }
