  // gpAjax settle watchers (v1.6.1). gpAjax skips its success branch whole when
  // the response carries no json/_srvtime, so the caller would hang on a
  // server-side rejection. The XHR spy claims the matching watcher on loadend
  // and settles the post from the raw response.
  const GB_AJAX_WATCH_MS = 8000;
  const gbAjaxPending = [];
  function gbAjaxWatch(sig, settle) {
    gbAjaxPending.push({ sig, at: Date.now(), settle });
    while (gbAjaxPending.length > 24) gbAjaxPending.shift();
  }
  function gbAjaxSigs(url, body) {
    const u = String(url || '');
    const out = [];
    if (/frontend_bridge/.test(u) && typeof body === 'string') {
      let j = null;
      try { j = parseBodyLoose(body); } catch (_) {}
      if (j && j.model_url) out.push('bridge:' + j.model_url + '|' + String(j.action_name || ''));
      return out;
    }
    const ctrl = (u.match(/[?&]controller=([a-z_0-9]+)/i) || u.match(/\/game\/([a-z_0-9]+)/i) || [])[1] || '';
    const act = (u.match(/[?&]action=([a-z_0-9]+)/i) || [])[1] || '';
    if (ctrl && act) out.push('ajax:' + ctrl + '/' + act);
    return out;
  }
  function gbAjaxClaim(url, body) {
    if (!gbAjaxPending.length) return null;
    const now = Date.now();
    for (let i = gbAjaxPending.length - 1; i >= 0; i--) {
      if (now - gbAjaxPending[i].at > GB_AJAX_WATCH_MS) gbAjaxPending.splice(i, 1);
    }
    if (!gbAjaxPending.length) return null;
    const sigs = gbAjaxSigs(url, body);
    if (!sigs.length) return null;
    for (let i = 0; i < gbAjaxPending.length; i++) {
      if (sigs.indexOf(gbAjaxPending[i].sig) >= 0) return gbAjaxPending.splice(i, 1)[0].settle;
    }
    return null;
  }
  function gbAjaxUnwrap(raw) {
    if (!raw || typeof raw !== 'object') return null;
    let d = Object.prototype.hasOwnProperty.call(raw, 'json') ? raw.json : raw;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) {} }
    if (d == null) d = {};
    else if (typeof d !== 'object') d = { data: d };
    if (raw.plain && typeof raw.plain === 'object') d = Object.assign({}, d, raw.plain);
    return d;
  }
  function isSelfBridge(j) {
    if (!j || !lastSelfBridge.sig || lastSelfBridge.owner !== GB_INSTANCE_ID) return false;
    if (Date.now() - lastSelfBridge.at > 10000) return false;
    const sig = String(j.model_url || '') + '|' + String(j.action_name || '');
    if (sig !== lastSelfBridge.sig) return false;
    try {
      const fp = JSON.stringify({ model_url: j.model_url || '', action_name: j.action_name || '', arguments: j.arguments || {}, town_id: j.town_id ?? null });
      return fp === lastSelfBridge.fingerprint;
    } catch (_) { return false; }
  }
  function responseServerError(data) {
    const queue=[data],seen=new Set();let steps=0;
    while(queue.length&&steps++<12){let d=queue.shift();if(typeof d==='string'){try{d=JSON.parse(d)}catch(_){continue}}if(!d||typeof d!=='object'||seen.has(d))continue;seen.add(d);
      if(d.error||d.exception)return d.error||d.exception;if(d.success===false)return d.message||d.msg||'success:false';
      for(const k of ['json','data','result','response'])if(d[k]!=null)queue.push(d[k]);
    }return null;
  }
  function bridgeRaw(feature, payload, done) {
    const uw = gameUw();
    if (!(uw.gpAjax && uw.gpAjax.ajaxPost)) return done('noajax');
    let settled = false;
    const finish = (err, data) => {
      if (settled || !gbInstanceAlive()) return;
      settled = true;
      gbClearTimeout(timer);
      done(err, data);
    };
    const timer = gbTimeout(() => {
      gbLogT('bridge-timeout-' + feature, 30000, feature + ': bridge timeout ' + BRIDGE_TIMEOUT_MS + 'ms');
      finish('timeout');
    }, BRIDGE_TIMEOUT_MS);
    lastSelfBridge.sig = String(payload && payload.model_url || '') + '|' + String(payload && payload.action_name || '');
    try { lastSelfBridge.fingerprint = JSON.stringify({ model_url: payload.model_url || '', action_name: payload.action_name || '', arguments: payload.arguments || {}, town_id: payload.town_id ?? null }); }
    catch (_) { lastSelfBridge.fingerprint = ''; }
    lastSelfBridge.at = Date.now();
    lastSelfBridge.owner = GB_INSTANCE_ID;
    lastSelfBridge.nonce = Math.random().toString(36).slice(2);
    const classify = (data) => {
      if (!gbInstanceAlive()) return;
      try {
        if (responseIsCaptcha(data)) {
          captchaTrip(feature, JSON.stringify(data).slice(0, 120));
          return finish('captcha');
        }
        const e=responseServerError(data);
        if (e) {
          const msg = typeof e === 'string' ? e : (e.message || e.msg || 'error');
          if (/csrf|token|unauthorized|login|session/i.test(String(msg))) { try { csrfForceHunt(); } catch (_) {} }
          noteServerPressure(msg);
          return finish(msg, data);
        }
        captchaClear(feature);
        finish(null, data);
      } catch (e) { finish(String(e)); }
    };
    // gpAjax only calls back on a non-empty success envelope, so a server-side
    // rejection would otherwise hang until BRIDGE_TIMEOUT_MS. The XHR spy
    // settles this post from the raw response; whichever fires first wins.
    gbAjaxWatch(
      'bridge:' + String(payload && payload.model_url || '') + '|' + String(payload && payload.action_name || ''),
      (status, raw) => {
        if (settled) return;
        if (!status) return finish('neterr');
        if (status < 200 || status >= 300) {
          noteServerPressure('http ' + status);
          return finish('http_' + status);
        }
        classify(gbAjaxUnwrap(raw));
      }
    );
    try {
      // gpAjax hands a bare-function callback (data, t_token) - NOT (wnd, data);
      // the window handle is only passed to the {success,error} object form.
      uw.gpAjax.ajaxPost('frontend_bridge', 'execute', payload, false, (data) => classify(data));
    } catch (e) { finish(String(e)); }
  }
  function gameAjaxRaw(feature, controller, action, data, done) {
    const uw = gameUw();
    if (!(uw.gpAjax && uw.gpAjax.ajaxPost)) return done('noajax');
    let settled = false;
    const finish = (err, res) => {
      if (settled || !gbInstanceAlive()) return;
      settled = true;
      gbClearTimeout(timer);
      done(err, res);
    };
    const timer = gbTimeout(() => finish('timeout'), BRIDGE_TIMEOUT_MS);
    const classify = (res) => {
      if (!gbInstanceAlive()) return;
      try {
        if (responseIsCaptcha(res)) { captchaTrip(feature, JSON.stringify(res).slice(0, 120)); return finish('captcha'); }
        const e=responseServerError(res);
        if (e) {
          const msg = typeof e === 'string' ? e : (e.message || e.msg || 'error');
          noteServerPressure(msg);
          return finish(msg, res);
        }
        captchaClear(feature);
        finish(null, res);
      } catch (e) { finish(String(e)); }
    };
    gbAjaxWatch('ajax:' + controller + '/' + action, (status, raw) => {
      if (settled) return;
      if (!status) return finish('neterr');
      if (status < 200 || status >= 300) {
        noteServerPressure('http ' + status);
        return finish('http_' + status);
      }
      classify(gbAjaxUnwrap(raw));
    });
    try {
      // Bare-function callback signature is (data, t_token) - see bridgeRaw.
      uw.gpAjax.ajaxPost(controller, action, data, false, (res) => classify(res));
    } catch (e) { finish(String(e)); }
  }
  function bridgePost(feature, payload, onDone) {
    const endpoint = String(payload && payload.model_url || '') + '/' + String(payload && payload.action_name || '');
    return txRun(feature, 'bridge', endpoint, payload, (done) => bridgeRaw(feature, payload, done), onDone);
  }
  function gameAjaxPost(feature, controller, action, data, onDone) {
    const endpoint = String(controller) + '/' + String(action);
    return txRun(feature, 'ajax', endpoint, data, (done) => gameAjaxRaw(feature, controller, action, data, done), onDone);
  }
  function txDomWrite(feature, endpoint, data, actionFn, verifyFn, onDone) {
    return txRun(feature, 'dom', endpoint, data || {}, (done) => {
      if (!gbInstanceAlive()) return done('disposed');
      try { actionFn(); } catch (e) { return done(String(e)); }
      let tries = 0;
      const verify = () => {
        if (!gbInstanceAlive()) return;
        let ok = false;
        try { ok = verifyFn ? verifyFn() === true : false; } catch (_) {}
        if (ok) return done(null, { dom: true, reconciled: true });
        if (++tries >= 4) return done('timeout');
        gbTimeout(verify, 600 + tries * 500);
      };
      gbTimeout(verify, 500);
    }, onDone);
  }

  function dryRunFmt(payload) {
    try {
      const s = JSON.stringify(payload);
      return s.length > 220 ? s.slice(0, 220) + '…' : s;
    } catch (_) { return String(payload); }
  }

  function httpRetryAfterMs(res) {
    const st = res && res.status;
    if (!(st === 429 || st === 503 || st === 502 || st === 504)) return 0;
    const hdrs = String((res && res.responseHeaders) || '');
    const m = /retry-after:\s*(\d+)/i.exec(hdrs);
    const ms = m ? Math.min(120000, parseInt(m[1], 10) * 1000)
                 : 5000 + Math.floor(Math.random() * 5000);
    gbServerCooldown(ms, 'http ' + st);
    return ms;
  }

  const _townResCache = Object.create(null);
  const TOWN_RES_CACHE_MS = 3000;
  function townResState(townId) {
    if (townId == null || townId === '') return null;
    const key = String(townId);
    const now = Date.now();
    const hit = _townResCache[key];
    if (hit && now - hit.at < TOWN_RES_CACHE_MS) return hit.v;
    const uw = gameUw();
    let t = null;
    try {
      t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]);
    } catch (_) {}
    let out = null;
    if (t) {
      let wood, stone, iron, resStorage = null;
      try {
        const r = t.resources && t.resources();
        if (r && r.wood != null) {
          wood = +r.wood; stone = +r.stone; iron = +r.iron;
          if (r.storage != null) resStorage = +r.storage;
        }
      } catch (_) {}
      if (wood != null) {

        let cap = null;
        try { if (t.getStorageCapacity) cap = +t.getStorageCapacity(); } catch (_) {}
        try { if (!(cap > 0) && t.storage && t.storage.getCapacity) cap = +t.storage.getCapacity(); } catch (_) {}
        if (!(cap > 0) && resStorage > 100) cap = resStorage;
        if (cap > 0) {
          const isFull = (v) => v >= cap || v / cap >= 0.99;
          const full = { wood: isFull(wood), stone: isFull(stone), iron: isFull(iron) };
          const n = (full.wood ? 1 : 0) + (full.stone ? 1 : 0) + (full.iron ? 1 : 0);
          const fillPct = Math.round(Math.max(wood, stone, iron) / cap * 100);
          out = { cap, wood, stone, iron, full, n, fillPct };
        }
      }
    }
    _townResCache[key] = { at: now, v: out };
    return out;
  }
  function gbProbeNum(obj, names, args) {
    if (!obj) return null;
    for (const n of names) {
      try {
        if (typeof obj[n] !== 'function') continue;
        const v = +obj[n].apply(obj, args || []);
        if (isFinite(v)) return v;
      } catch (_) {}
    }
    return null;
  }
  function gbProbeAttr(obj, names) {
    if (!obj) return null;
    const a = obj.attributes || obj;
    for (const n of names) {
      try {
        const v = +a[n];
        if (a[n] != null && isFinite(v)) return v;
      } catch (_) {}
    }
    return null;
  }
  function gbTownModel(townId) {
    try {
      const uw = gameUw();
      return (uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId])) || null;
    } catch (_) { return null; }
  }
  function gbTownPop(townId) {
    const t = gbTownModel(townId);
    if (!t) return null;
    const v = gbProbeNum(t, ['getAvailablePopulation', 'getFreePopulation', 'getPopulation']);
    if (v != null) return v;
    try {
      const r = t.resources && t.resources();
      if (r && r.population != null) return +r.population;
    } catch (_) {}
    return null;
  }
  function gbPlayerGold() {
    try {
      const uw = gameUw();
      const p = uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('Player');
      const v = gbProbeAttr(p, ['gold', 'premium_gold']);
      if (v != null) return v;
      if (uw.Game && uw.Game.player_gold != null) return +uw.Game.player_gold;
    } catch (_) {}
    return null;
  }
  const GB_RES_KEYS = ['wood', 'stone', 'iron'];

  function gbAfford(townId, cost, opts) {
    const o = opts || {};
    const margin = o.margin != null ? +o.margin : 0;
    if (!cost || typeof cost !== 'object') return { ok: false, blind: true, short: ['cost unreadable'], detail: 'no cost data' };
    const normalized = plannerNormCost(cost);
    if (!normalized) return { ok: false, blind: true, short: ['cost unreadable'], detail: 'invalid cost data' };
    const av = o.ignorePlanner ? null : plannerAvailable(townId, {allowSoft:!!o.allowSoft, excludeIntent:o.excludeIntent});
    const st = o.ignorePlanner ? townResState(townId) : null;
    const short = [];
    let blind = false;
    for (const k of GB_RES_KEYS) {
      const need = +normalized[k] || 0;
      if (need <= 0) continue;
      const have = av ? av[k] : (st && st[k]);
      if (have == null) { blind = true; short.push(`${k} unreadable`); continue; }
      if (have < need + margin) short.push(`${k} ${Math.floor(have)}/${Math.ceil(need + margin)}`);
    }
    const needPop = +normalized.population || 0;
    if (needPop > 0) {
      const pop = av ? av.population : gbTownPop(townId);
      if (pop == null) { blind = true; short.push('population unreadable'); }
      else if (pop < needPop) short.push(`pop ${Math.floor(pop)}/${Math.ceil(needPop)}`);
    }
    return { ok: !blind && short.length === 0, blind, short, detail: short.join(', ') };
  }

  function gbBuildingLevel(townId, building) {
    const t = gbTownModel(townId);
    if (!t) return null;
    try {
      if (t.getBuildings) {
        const v = +t.getBuildings().get(building);
        if (isFinite(v)) return v;
      }
    } catch (_) {}
    try {
      const a = (t.buildings && t.buildings().attributes) || {};
      if (a[building] != null) return +a[building] || 0;
    } catch (_) {}
    return null;
  }

  function hostEnabled() {

    return state.enabledHosts[location.host] === true && gbTabLeader;
  }
  function ensureHostDefault() {
    const h = location.host;
    if (state.enabledHosts[h] === undefined) {
      state.enabledHosts[h] = false;
      save(STORE.ENABLED_HOSTS, state.enabledHosts);
      gbLog('host ' + h + ' disabled by default — enable in Config');
    }
  }

  const CSRF_TOK16 = /^[a-f0-9]{16,64}$/i;
  const CSRF_TOK32 = /^[a-f0-9]{32,64}$/i;
  const CSRF_COOKIE_H = /(?:^|;\s*)h=([a-f0-9]{32,64})(?:;|$)/i;
  const CSRF_COOKIE_C = /(?:^|;\s*)csrf=([a-f0-9]{32,64})(?:;|$)/i;
  function csrfIsTok(v, min) {
    if (!v) return false;
    return (min >= 32 ? CSRF_TOK32 : CSRF_TOK16).test(String(v));
  }

  const CSRF_PROBES = [
    [w => w.csrfToken, 16],
    [w => w.csrf_token, 16],
    [w => w.h, 16],
    [w => w.Game && w.Game.csrfToken, 16],
    [w => w.Game && w.Game.h, 16],
    [() => document.querySelector('meta[name="csrf-token"]')?.content, 16],
    [() => document.querySelector('meta[name="h"]')?.content, 16],
    [() => document.querySelector('input[name="h"]')?.value, 16],
    [() => document.querySelector('input[name="csrfToken"]')?.value, 16],

    [() => {
      const m = document.cookie.match(CSRF_COOKIE_H) || document.cookie.match(CSRF_COOKIE_C);
      return m ? m[1] : null;
    }, 32],

    [() => {
      for (const el of document.querySelectorAll('[data-h]')) {
        const v = el.getAttribute('data-h');
        if (csrfIsTok(v, 32)) return v;
      }
      return null;
    }, 32],
  ];
  function huntCsrf() {
    const w = gameUw();
    for (const [fn, min] of CSRF_PROBES) {
      try {
        const v = fn(w);
        if (csrfIsTok(v, min)) return String(v);
      } catch (_) {}
    }
    return null;
  }

  function csrfForceHunt() {
    const fresh = huntCsrf();
    if (fresh && fresh !== state.csrf) {
      state.csrf = fresh;
      save(wkey(STORE.CSRF), state.csrf);
      gbLog('csrf refreshed', fresh.slice(0, 6) + '...');
      return fresh;
    }
    return fresh || null;
  }
  (function csrfLoop() {
    const fresh = huntCsrf();
    if (fresh && fresh !== state.csrf) {
      state.csrf = fresh;
      save(wkey(STORE.CSRF), state.csrf);
      gbLog('csrf found', fresh.slice(0,6)+'...');
    }
    else if (!fresh && !state.csrf) gbLogT('csrf-miss', 60000, 'csrf not found yet - retrying');

    gbTimeout(csrfLoop, state.csrf ? 120000 : 5000);
  })();

  const JRN_MAX = 400;
  const JRN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const JRN_DEDUP_MS = 10 * 60 * 1000;
  const JRN_SAVE_MS = 5000;
  const JRN_FAIL_TRIP = 3;
  const JRN_BACKOFF = [5, 15, 60];

  const JRN_SKIP_ERRS = { disabled: 1, paused: 1, 'captcha-pause': 1, budget: 1, noajax: 1, remembered: 1, dryrun: 1 };

  if (!Array.isArray(state.decisions)) state.decisions = [];
  if (!state.decisionSkips || typeof state.decisionSkips !== 'object') state.decisionSkips = {};
