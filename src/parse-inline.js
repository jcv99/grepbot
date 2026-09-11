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
  const REPORT_RETRY_TTL_MS = 6 * 60 * 60 * 1000;
  const REPORT_RETRY_MAX_ENTRIES = 1000;
  let reportRetryPrunedAt = 0;
  function reportRetryPrune(now) {
    now = now || Date.now();
    if (now - reportRetryPrunedAt < 60000 && Object.keys(reportRetry).length <= REPORT_RETRY_MAX_ENTRIES) return;
    reportRetryPrunedAt = now;
    const rows = [];
    for (const [id, rec] of Object.entries(reportRetry)) {
      if (!rec || !(rec.at > now - REPORT_RETRY_TTL_MS)) {
        delete reportRetry[id];
        seenThisRun.delete(seenKey(id));
        continue;
      }
      rows.push([id, rec]);
    }
    if (rows.length <= REPORT_RETRY_MAX_ENTRIES) return;
    rows.sort((a, b) => a[1].at - b[1].at);
    for (let i = 0; i < rows.length - REPORT_RETRY_MAX_ENTRIES; i++) {
      delete reportRetry[rows[i][0]];
      seenThisRun.delete(seenKey(rows[i][0]));
    }
  }
  function scrapeInboxDom() {
    document.querySelectorAll('a[href*="action=report"][href*="id="]').forEach(a => {

      const m = a.href.match(/[?&]id=(\d+)/);
      if (m) queueReport(m[1], a.href);
    });
  }
  function queueReport(id, hintUrl) {
    if (!id) return;
    if (!hostEnabled() || automationPaused({}) || captchaPaused('report')) return;
    reportRetryPrune();
    const k = seenKey(id);
    const retry = reportRetry[id];
    if (seenThisRun.has(k) || state.seen[k] || (retry && retry.n >= REPORT_RETRY_MAX)) return;
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
    try { intelDigestEnqueue(parsed); } catch (_) {}
    renderFindings();
    return true;
  }
  function reportFetchFail(id, why) {
    gbLogT('report-fail-' + id, 30000, 'report fetch fail', id, why || '');
    const n = ((reportRetry[id] && reportRetry[id].n) || 0) + 1;
    reportRetry[id] = { n, at: Date.now() };
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

      const lastRead = gbNum(last[id]);
      const lastAt = lastRead != null ? lastRead : now - SPY_STALE_MS;
      const age = now - lastAt;
      if (age < cfg.minGapMs) continue;
      const watch = spyIsWatched(id);
      const r24 = reports[id] || 0;
      out.push({
        id,
        score: age + (watch ? SPY_WATCH_BONUS : 0) + SPY_REPORT_BONUS * Math.max(0, r24 - 1),
        lastSpyAt: lastRead,
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
      gbLockTouch('spy', lockToken);
      if (i >= picks.length) { gbUnlock('spy', lockToken); return; }
      const t = picks[i++];
      const payload = {
        model_url: tpl.model_url,
        action_name: tpl.action_name,
        arguments: Object.assign({}, tpl.arguments || {}, { id: /^\d+$/.test(t.id) ? +t.id : t.id }),
        town_id: tpl.town_id,
      };

      bridgePost('spy', payload, (err) => {
        if (err === 'captcha' || err === 'captcha-pause') { gbUnlock('spy', lockToken); return; }
        if (err === 'dryrun') {
          gbTimeout(next, 400);
          return;
        }
        if (!err) {
          spyLastSpy()[t.id] = Date.now();
          spyHistorySave();
          gbLog(`spy: sent to ${t.id}`);
        } else gbLogT('spy-err', 60000, `spy err ${err}`);
        gbTimeout(next, 900 + Math.random() * 600);
      });
    })();
  }

  // Shared bridge-template learn: sniffer sites differ only in arg
  // stripping, key scoping and log/health detail. Templates stay
  // per-feature — never share one storeKey between features.
  function learnTemplate(stateKey, storeKey, j, opts) {
    opts = opts || {};
    if (!j || !j.action_name) return false;
    if (!opts.modelUrlFallback && !j.model_url) return false;
    if (typeof isSelfBridge === 'function' && isSelfBridge(j)) return false;
    const args = opts.fixedArgs
      ? Object.assign({}, opts.fixedArgs)
      : Object.assign({}, j.arguments || {});
    (opts.stripArgs || []).forEach(k => { delete args[k]; });
    const tpl = {
      model_url: j.model_url || opts.modelUrlFallback, action_name: j.action_name,
      arguments: args, town_id: j.town_id, version: 1, learned_at: Date.now(),
    };
    if (opts.mapByAction) {
      if (!state[stateKey] || typeof state[stateKey] !== 'object') state[stateKey] = {};
      state[stateKey][j.action_name] = tpl;
    } else state[stateKey] = tpl;
    save(opts.wscoped === false ? storeKey : wkey(storeKey), state[stateKey]);
    gbLog(`learned ${opts.label || stateKey} template:`,
      opts.logJson ? JSON.stringify(opts.mapByAction ? state[stateKey][j.action_name] : tpl).slice(0, opts.logJson) : j.action_name);
    if (opts.health !== false) { try { tplHealthMarkLearned(opts.healthKey || stateKey); } catch (_) {} }
    return true;
  }

  function spyLearnTemplate(j) {
    learnTemplate('spyTpl', STORE.SPY_TPL, j, { stripArgs: ['id'], label: 'spy' });
  }

  function nameOf(p) {
    if (p == null) return null;
    if (typeof p === 'string') {
      const s = p.trim();
      return s ? { id: null, name: s } : null;
    }
    if (typeof p !== 'object') return null;
    return {
      id: p.id ?? p.player_id ?? null,
      name: p.name || p.player_name || null,
      town_id: p.town_id ?? p.origin_town_id ?? null,
      town_name: p.town_name || p.origin_town_name || null,
      alliance: p.alliance_name || p.alliance || null,
      vacation: p.vacation ?? p.on_vacation ?? null,
    };
  }
  function cleanUnitBag(src) {
    if (!src || typeof src !== 'object' || Array.isArray(src)) return null;
    const u = {};
    Object.keys(src).forEach(k => { const v = gbNum(src[k]); if (v != null && v > 0) u[k] = Math.floor(v); });
    return Object.keys(u).length ? u : null;
  }

  function extractSplitUnits(r) {
    const attacker = cleanUnitBag(r.attacker_units);
    const defender = cleanUnitBag(r.defender_units);
    if (!attacker && !defender) return { attacker: null, defender: null };
    return { attacker: attacker || {}, defender: defender || {} };
  }

  function extractUnits(r) {

    const split = extractSplitUnits(r);
    if (!split.attacker && !split.defender) return cleanUnitBag(r.units);
    const u = {};
    for (const bag of [split.attacker, split.defender]) {
      for (const [k, v] of Object.entries(bag || {})) u[k] = (u[k] || 0) + v;
    }
    return Object.keys(u).length ? u : null;
  }
  function extractResources(r) {
    const src = r.resources || r.loot || r.resource_pillage || r.haul || {};
    return {
      wood: src.wood ?? null, stone: src.stone ?? null, iron: src.iron ?? null,
      gold: src.gold ?? null, supply: src.supply ?? null,
    };
  }

  function parseBuildings(r) {
    const src = r.buildings || r.building_levels || r.buildings_levels;
    if (!src || typeof src !== 'object' || Array.isArray(src)) return {};
    const out = {};
    for (const [k, raw] of Object.entries(src)) {
      const n = gbNum(raw && typeof raw === 'object' ? (raw.level ?? raw.value) : raw);
      if (n == null || n <= 0) continue;
      out[String(k).toLowerCase()] = Math.floor(n);
    }
    return out;
  }

  function parseOutcome(r) {
    const o = r.outcome;
    if (typeof o === 'string') {
      const s = o.trim().toLowerCase();
      if (/^(win|won|victory|success)$/.test(s)) return 'win';
      if (/^(lose|lost|loss|defeat|failure|failed)$/.test(s)) return 'lose';
      if (/^(draw|tie)$/.test(s)) return 'draw';
    }
    if (o === true) return 'win';
    if (o === false) return 'lose';
    if (o === 1) return 'win';
    if (o === 0) return 'lose';
    if (r.draw === true) return 'draw';
    if (r.win === true) return 'win';
    if (r.win === false) return 'lose';
    if (r.win === 1) return 'win';
    if (r.win === 0) return 'lose';
    return null;
  }

  function parseHero(r) {
    const src = r.hero || r.hero_info || r.defender_hero;
    if (!src || typeof src !== 'object' || Array.isArray(src)) return null;
    const lvl = gbNum(src.level ?? src.hero_level);
    const out = {
      id: src.id ?? src.hero_id ?? null,
      name: (typeof src.name === 'string' && src.name.trim()) ? src.name.trim()
        : (typeof src.hero_name === 'string' && src.hero_name.trim()) ? src.hero_name.trim() : null,
      level: lvl != null && lvl > 0 ? Math.floor(lvl) : null,
      cls: (typeof src.class === 'string' && src.class.trim()) ? src.class.trim()
        : (typeof src.hero_class === 'string' && src.hero_class.trim()) ? src.hero_class.trim() : null,
    };
    return (out.id != null || out.name || out.level != null || out.cls) ? out : null;
  }
  function parseReport(id, data) {
    if (data == null) return null;
    let root = data;

    for (let depth = 0; depth < 3 && root && typeof root === 'object' && root.json != null; depth++) {
      let inner = root.json;
      if (typeof inner === 'string') {
        try { inner = JSON.parse(inner); } catch (_) { break; }
      }
      if (!inner || typeof inner !== 'object') break;
      root = inner;
    }
    if (typeof root === 'string') {
      try { root = JSON.parse(root); } catch (_) { return null; }
    }
    if (!root || typeof root !== 'object') return null;
    const r = root.report || root;
    if (!r || typeof r !== 'object') return null;
    const type = r.type || r.report_type || null;

    if (!type && r.attacker == null && r.defender == null && !r.units && !r.attacker_units && r.outcome == null && r.win == null) {
      return null;
    }
    const now = Date.now();
    const serverTs = (() => {
      const keys = ['time', 'timestamp', 'created_at', 'reported_at', 'date', 'started_at', 'ended_at'];
      for (const k of keys) {
        const c = r[k];
        if (c == null || c === '') continue;
        if (typeof c === 'number' || (/^\d+(\.\d+)?$/.test(String(c)))) {
          let n = gbNum(c);
          if (n == null || n <= 0) continue;
          if (n < 1e12) n *= 1000;
          return Math.floor(n);
        }
        const parsed = Date.parse(c);
        if (!Number.isNaN(parsed)) return parsed;
      }
      return null;
    })();
    const buildings = parseBuildings(r);
    const split = extractSplitUnits(r);
    return {
      id, ts: serverTs != null ? serverTs : now,
      type: type || 'unknown',
      attacker: nameOf(r.attacker),
      defender: nameOf(r.defender),
      town: {
        id: r.defender?.town_id || r.town_id || null,
        name: r.defender?.town_name || r.town_name || null,
        x: r.defender?.x ?? r.x ?? null,
        y: r.defender?.y ?? r.y ?? null,
      },
      units: extractUnits(r),
      units_attacker: split.attacker,
      units_defender: split.defender,
      buildings,
      hero: parseHero(r),
      resources: extractResources(r),
      loot: r.resources || r.loot || null,
      outcome: parseOutcome(r),

      wall: buildings.wall ?? ((r.wall != null ? r.wall : (r.Wall != null ? r.Wall : undefined))) ?? r.wall_level ?? r.defender_wall ?? (r.defender && (r.defender.wall ?? r.defender.wall_level)) ?? null,
      alliance: r.alliance ?? r.attacker_alliance ?? (r.attacker && (r.attacker.alliance_name || r.attacker.alliance)) ?? null,
      vill_id: r.vill_id ?? r.farm_town_id ?? null,
      vacation: r.vacation ?? r.on_vacation ?? null,
    };
  }
  function parseFarms(text) {
    return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const parts = line.split('|').map(s => s.trim());
      let id = parts[0] && /^\d+$/.test(parts[0]) ? parts[0] : null;
      if (!id) {

        const m = line.match(/^(\d{4,})\s+/);
        if (m) id = m[1];
      }
      if (!id) return null;
      const out = { vill_id: id, x: null, y: null, eta: null, notes: null };

      const afterId = (line.startsWith(id) ? line.slice(id.length) : line).trimStart();
      const coordMatch = afterId.match(/^\|?\s*(-?\d{1,4})[,\s]+(-?\d{1,4})/);
      if (coordMatch) { out.x = +coordMatch[1]; out.y = +coordMatch[2]; }
      for (const p of parts) {
        if (/^\d+\s*(?:min|h|m)$/i.test(p) || /^\d{1,2}:\d{2}$/.test(p)) { out.eta = p; break; }
      }

      const coordSpace = out.x != null && out.y != null ? `${out.x} ${out.y}` : null;
      const coordComma = out.x != null && out.y != null ? `${out.x},${out.y}` : null;
      const skip = new Set([out.eta, coordSpace, coordComma, id].filter(Boolean));
      out.notes = parts.slice(1).filter(p => p && !skip.has(p)).join(' | ') || null;
      return out;
    }).filter(Boolean);
  }
  function parseBodyLoose(s) {
    let j = null;
    try { j = JSON.parse(s); } catch (_) {}
    if (!j) {
      try {
        const p = new URLSearchParams(s);
        j = {};
        for (const [k, v] of p) { try { j[k] = JSON.parse(v); } catch (_) { j[k] = v; } }
      } catch (_) { return null; }
    }

    let cur = j;
    for (let depth = 0; depth < 3 && cur && cur.json; depth++) {
      let inner = cur.json;
      if (typeof inner === 'string') {
        try { inner = JSON.parse(inner); } catch (_) { break; }
      }
      if (!inner || typeof inner !== 'object') break;
      if (inner.model_url || inner.action_name || inner.arguments) return inner;
      cur = inner;
    }
    return j;
  }
  function parseResourceJson(data) {
    const json = (data && data.json) ? (typeof data.json === 'string' ? (() => { try { return JSON.parse(data.json); } catch (_) { return data; } })() : data.json) : data;

    const r = (json && (json.town || json.town_info || json)) || {};
    let res_ = r.resources || r.resource || (json && json.resources) || {};
    if (res_ && typeof res_ === 'object' && res_.resources && typeof res_.resources === 'object') {
      res_ = res_.resources;
    }
    const popRaw = r.population ?? r.pop;

    const popNum = gbNum(popRaw);
    const pop = (popRaw && typeof popRaw === 'object') ? popRaw : {};
    const wood = pickNum(res_.wood, r.wood, json && json.wood);
    const stone = pickNum(res_.stone, r.stone, json && json.stone);
    const iron = pickNum(res_.iron, r.iron, json && json.iron);
    return {
      wood, stone, iron,
      pop: pop.current ?? pop.pop ?? popNum ?? null,
      cap: pop.max ?? pop.cap ?? gbNum(r.population_max),
      name: r.name || r.town_name || null,
      got: wood != null || stone != null || iron != null || !!(r.name || r.town_name),
    };
  }
  function sniffBridgeBody(u, body) {
    try {
      if (!body || typeof body !== 'string' || !/frontend_bridge/.test(String(u))) return;
      const parsedSelfCheck = parseBodyLoose(body);
      if (parsedSelfCheck && isSelfBridge(parsedSelfCheck)) return;
      if (/PremiumExchange/.test(body)) {
        const j = parsedSelfCheck;
        if (j && typeof goldLearnPayload === 'function') goldLearnPayload(j);
      } else if (/FarmTownPlayerRelation/.test(body)) {
        gbLog('sniffed farm bridge call:', body.slice(0, 300));
        const j = parseBodyLoose(body);
        if (j && j.model_url && /claim/i.test(j.action_name || '')) {
          if (learnTemplate('claimTpl', STORE.CLAIM_TPL, j, { label: 'claim', logJson: 200 })) {
            farmLearnFromClaim(j);
          }
        } else if (j && j.model_url && !/claim|trade|unlock|upgrade/i.test(j.action_name || '')
                   && /sword|archer|hoplite|slinger/i.test(body)) {

          learnTemplate('acceptUnitsTpl', STORE.ACCEPT_UNITS_TPL, j, { label: 'accept-units', logJson: 220 });
        }
      } else if (/PlayerAttackSpot/.test(body)) {
        gbLog('sniffed bandit bridge call:', body.slice(0, 300));
      } else if (/BuildingOrder/.test(body) && /Instant|instant/i.test(body)) {
        const j = parseBodyLoose(body);
        if (j && j.action_name && /instant/i.test(j.action_name)) {
          if (typeof ibLearnAction === 'function') {
            ibLearnAction('build', j.action_name);
            gbLog('learned instant-build action:', j.action_name);
          } else {
            state.ibAction = j.action_name;
            save(wkey(STORE.IB_ACTION), state.ibAction);
            gbLog('learned instant-build action:', state.ibAction);
          }
        }
      } else if (/ResearchOrder/.test(body) && /Instant|instant/i.test(body)) {
        const j = parseBodyLoose(body);
        if (j && j.action_name && /instant/i.test(j.action_name)) {
          if (typeof ibLearnAction === 'function') {
            ibLearnAction('research', j.action_name);
            gbLog('learned instant-research action:', j.action_name);
          } else {
            state.ibActionR = j.action_name;
            save(wkey(STORE.IB_ACTION_R), state.ibActionR);
            gbLog('learned instant-research action:', state.ibActionR);
          }
        }
      } else if (/Town/.test(body) && /"type"\s*:\s*"support"/.test(body)) {

        const j = parseBodyLoose(body);
        if (j) supportLearnTemplate(j);
      } else if (/model_url.*Town\//i.test(body) || (/Town/.test(body) && /attack|sendUnits/i.test(body))) {
        const j = parseBodyLoose(body);

        if (j && j.arguments && String(j.arguments.type || '') === 'support') { supportLearnTemplate(j); return; }
        if (j && j.model_url && /attack|sendUnits/i.test(j.action_name || '')) {
          if (learnTemplate('attackTpl', STORE.ATTACK_TPL, j, { label: 'attack', logJson: 200 })) {
            const destId = j.arguments && j.arguments.id;
            if (destId != null && typeof attackRememberTarget === 'function') {
              attackRememberTarget(destId, { src: 'manual-attack' });
            }
          }
        }
      } else if (/spy|espionage|espia/i.test(body) && /model_url/.test(body)) {

        const j = parseBodyLoose(body);
        if (j && j.action_name && /spy|espionage/i.test(String(j.action_name))) spyLearnTemplate(j);
      } else if (/Command/.test(body) && /cancelCommand|cancel_command/i.test(body)) {
        const j = parseBodyLoose(body);
        if (j && j.action_name && /cancelCommand|cancel_command/i.test(j.action_name)) {
          learnTemplate('cancelTpl', STORE.CANCEL_TPL, j, { modelUrlFallback: 'Command', wscoped: false, health: false, label: 'cancel', logJson: 200 });
        }
      } else if (/Wonder|wonder/i.test(body) && /cast|devote|contribute|favor/i.test(body) && /power|cast/i.test(body)) {
        const j = parseBodyLoose(body);
        if (j && j.action_name) {
          learnTemplate('wonderFavorTpl', STORE.WONDER_FAVOR_TPL, j, { label: 'wonder favor' });
        }
      } else if (/PlayerHero/.test(body) && /assignToTown|unassignFromTown|cancelTownTravel/i.test(body)) {
        const j = parseBodyLoose(body);
        if (j && j.action_name) {
          learnTemplate('heroTpl', STORE.HERO_TPL, j, { mapByAction: true, modelUrlFallback: 'PlayerHero', wscoped: false, health: false, label: 'hero', logJson: 160 });
        }
      } else if (/IslandQuest|Progressable|claimReward|island_quest/i.test(body)) {
        const j = parseBodyLoose(body);
        if (j && !isSelfBridge(j)) {
          gbLogT('quest-sniff', 30000, 'sniffed quest bridge:', body.slice(0, 200));
          learnQuestRewardsFromPayload(j, j.progressable_id || (j.arguments && j.arguments.progressable_id));
        }
      }
    } catch (_) {}
  }
