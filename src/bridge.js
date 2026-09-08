  const selfBridgeLog = [];

  const GB_AJAX_WATCH_MS = 8000;
  const GB_AJAX_PENDING_MAX = 24;
  const gbAjaxPending = [];

  function gbAjaxFpNorm(v, depth) {
    if (v == null) return 'null';
    if (typeof v !== 'object') return JSON.stringify(String(v));
    if (depth > 4) return '"..."';
    if (Array.isArray(v)) return '[' + v.map(x => gbAjaxFpNorm(x, depth + 1)).join(',') + ']';
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + gbAjaxFpNorm(v[k], depth + 1)).join(',') + '}';
  }
  function gbAjaxFp(payload) {
    try { return gbAjaxFpNorm(payload, 0); } catch (_) { return ''; }
  }
  function gbAjaxBridgeFp(p) {
    return gbAjaxFp({
      model_url: (p && p.model_url) || '',
      action_name: (p && p.action_name) || '',
      arguments: (p && p.arguments) || {},
      town_id: (p && p.town_id) != null ? p.town_id : null,
    });
  }
  function gbAjaxWatch(sig, fp, settle, feature) {
    const entry = { sig, fp: fp || '', at: Date.now(), settle, feature: (typeof feature === 'string' && feature) ? feature : null };
    gbAjaxPending.push(entry);

    const now = Date.now();
    for (let i = gbAjaxPending.length - 2; i >= 0; i--) {
      if (now - gbAjaxPending[i].at > GB_AJAX_WATCH_MS) gbAjaxPending.splice(i, 1);
    }
    while (gbAjaxPending.length > GB_AJAX_PENDING_MAX) {
      const lost = gbAjaxPending.shift();
      gbLogT('ajax-watch-overflow', 60000,
        `ajax watch: pending list full (${GB_AJAX_PENDING_MAX}) - dropped watcher ${lost && lost.sig}; that post can only settle on timeout`);
    }
    return entry;
  }

  function gbAjaxDrop(entry) {
    if (!entry) return;
    const i = gbAjaxPending.indexOf(entry);
    if (i >= 0) gbAjaxPending.splice(i, 1);
  }

  function gbAjaxDispose() {
    gbAjaxPending.length = 0;
  }
  function gbAjaxSigs(url, body) {
    const u = String(url || '');
    const out = { sigs: [], fp: '' };
    let j = null;
    if (typeof body === 'string') { try { j = parseBodyLoose(body); } catch (_) {} }
    if (/frontend_bridge/.test(u)) {
      if (j && j.model_url) {
        out.sigs.push('bridge:' + j.model_url + '|' + String(j.action_name || ''));
        out.fp = gbAjaxBridgeFp(j);
      }
      return out;
    }
    const ctrl = (u.match(/[?&]controller=([a-z_0-9]+)/i) || u.match(/\/game\/([a-z_0-9]+)/i) || [])[1] || '';
    const act = (u.match(/[?&]action=([a-z_0-9]+)/i) || [])[1] || '';
    if (ctrl && act) {
      out.sigs.push('ajax:' + ctrl + '/' + act);

      let payload = j;
      if (payload && payload.json != null) {
        let inner = payload.json;
        if (typeof inner === 'string') { try { inner = JSON.parse(inner); } catch (_) { inner = null; } }
        if (inner && typeof inner === 'object') payload = inner;
      }
      if (payload) out.fp = gbAjaxFp(payload);
    }
    return out;
  }

  function gbAjaxClaim(url, body) {
    if (!gbAjaxPending.length) return null;
    const now = Date.now();
    for (let i = gbAjaxPending.length - 1; i >= 0; i--) {
      if (now - gbAjaxPending[i].at > GB_AJAX_WATCH_MS) gbAjaxPending.splice(i, 1);
    }
    if (!gbAjaxPending.length) return null;
    const { sigs, fp } = gbAjaxSigs(url, body);
    if (!sigs.length) return null;
    if (fp) {
      for (let i = 0; i < gbAjaxPending.length; i++) {
        const e = gbAjaxPending[i];
        if (e.fp === fp && sigs.indexOf(e.sig) >= 0) return gbAjaxPending.splice(i, 1)[0].settle;
      }
    }
    const candidates = [];
    for (let i = 0; i < gbAjaxPending.length; i++) {
      if (sigs.indexOf(gbAjaxPending[i].sig) >= 0) candidates.push(i);
    }
    if (candidates.length === 1) return gbAjaxPending.splice(candidates[0], 1)[0].settle;
    return null;
  }
  const GB_CAPTCHA_FLAGS = ['captcha', 'captcha_required'];

  const GB_AJSON_PARSE_MAX = 256 * 1024;
  function gbAjaxUnwrap(raw) {
    if (!raw || typeof raw !== 'object') return null;
    let d = Object.prototype.hasOwnProperty.call(raw, 'json') ? raw.json : raw;
    if (typeof d === 'string') {

      const src = d.length > GB_AJSON_PARSE_MAX ? d.slice(0, GB_AJSON_PARSE_MAX) : d;
      try { d = JSON.parse(src); } catch (_) {}
    }
    if (d == null) d = {};
    else if (typeof d !== 'object') d = { data: d };
    if (raw.plain && typeof raw.plain === 'object') {
      const merged = Object.assign({}, d, raw.plain);

      for (const k of GB_CAPTCHA_FLAGS) {
        const a = d[k], b = raw.plain[k];
        if (a === true || a === 1 || b === true || b === 1) merged[k] = true;
      }
      d = merged;
    }
    return d;
  }
  function selfBridgeFingerprint(j) {
    try {
      return JSON.stringify({ model_url: j.model_url || '', action_name: j.action_name || '', arguments: j.arguments || {}, town_id: j.town_id ?? null });
    } catch (_) { return ''; }
  }
  function selfBridgeNote(payload) {
    const p = payload || {};
    const now = Date.now();

    for (let i = selfBridgeLog.length - 1; i >= 0; i--) {
      if (now - selfBridgeLog[i].at > SELF_BRIDGE_TTL_MS) selfBridgeLog.splice(i, 1);
    }
    selfBridgeLog.push({
      sig: String(p.model_url || '') + '|' + String(p.action_name || ''),
      fingerprint: selfBridgeFingerprint(p),
      at: now,
      owner: GB_INSTANCE_ID,
    });
    while (selfBridgeLog.length > SELF_BRIDGE_MAX) selfBridgeLog.shift();
  }
  function isSelfBridge(j) {
    if (!j || !selfBridgeLog.length) return false;
    const now = Date.now();
    const sig = String(j.model_url || '') + '|' + String(j.action_name || '');
    const fp = selfBridgeFingerprint(j);
    if (!fp) return false;
    for (let i = 0; i < selfBridgeLog.length; i++) {
      const e = selfBridgeLog[i];
      if (e.owner !== GB_INSTANCE_ID) continue;
      if (now - e.at > SELF_BRIDGE_TTL_MS) continue;
      if (e.sig !== sig) continue;
      if (e.fingerprint === fp) return true;
    }
    return false;
  }
  function responseServerError(data) {
    const queue=[data],seen=new Set();let steps=0;
    while(queue.length&&steps++<12){let d=queue.shift();if(typeof d==='string'){try{d=JSON.parse(d)}catch(_){continue}}if(!d||typeof d!=='object'||seen.has(d))continue;seen.add(d);
      if(d.error||d.exception)return d.error||d.exception;if(d.success===false)return d.message||d.msg||'success:false';
      for(const k of ['json','data','result','response'])if(d[k]!=null)queue.push(d[k]);
    }return null;
  }
  function ajaxTransportRaw(feature, opts, done) {
    const uw = gameUw();
    if (!(uw.gpAjax && uw.gpAjax.ajaxPost)) return done('noajax');
    let settled = false;
    let watchEntry = null;
    const finish = (err, res) => {
      if (settled || !gbInstanceAlive()) return;
      settled = true;
      gbClearTimeout(timer);
      gbAjaxDrop(watchEntry);
      done(err, res);
    };
    const timer = gbTimeout(() => {
      gbLogT(opts.timeoutKey || ('transport-timeout-' + feature), 30000, opts.timeoutMsg || (feature + ': timeout ' + BRIDGE_TIMEOUT_MS + 'ms'));
      noteTransportTimeout(feature);
      finish('timeout');
    }, BRIDGE_TIMEOUT_MS);
    const classify = (res) => {
      if (settled || !gbInstanceAlive()) return;
      try {
        noteTransportSuccess();
        if (responseIsCaptcha(res)) {
          captchaTrip(feature, JSON.stringify(res).slice(0, 120));
          return finish('captcha');
        }
        const e = responseServerError(res);
        if (e) {
          const msg = typeof e === 'string' ? e : (e.message || e.msg || 'error');
          if (opts.authCsrf && /csrf|token|unauthorized|login|session/i.test(String(msg))) { try { csrfForceHunt(); } catch (_) {} }
          noteServerPressure(msg);
          return finish(msg, res);
        }
        captchaClear(feature);
        finish(null, res);
      } catch (e) { finish(String(e)); }
    };
    const cancel = () => {
      if (settled) return;
      gbLogT('ajax-cancel-' + feature, 30000, feature + ': post cancelled (feature toggle / abort)');
      finish('cancelled');
    };
    watchEntry = gbAjaxWatch(opts.watchKey, opts.watchFp, (status, raw) => {
      if (settled) return;
      if (!status) return finish('neterr');
      if (status === 429 || status === 503) {
        try {
          const retryAfter = (raw && raw.responseHeaders && /retry-after:\s*(\d+)/i.test(raw.responseHeaders)) ? parseInt(RegExp.$1, 10) : 0;
          if (retryAfter > 0) noteServerPressure('http ' + status + ' retry-after ' + retryAfter + 's');
          else noteServerPressure('http ' + status);
        } catch (_) { noteServerPressure('http ' + status); }
        return finish('http_' + status);
      }
      if (status < 200 || status >= 300) {
        noteServerPressure('http ' + status);
        return finish('http_' + status);
      }
      noteTransportSuccess();
      if (raw == null) {
        if (opts.emptyBodyWait) {
          gbLogT(opts.emptyBodyLogKey || ('empty-watch-' + feature), 60000,
            opts.emptyBodyLogMsg || (`${feature}: HTTP ${status} watcher without parseable body; waiting for gpAjax callback`));
          return;
        }
        return finish('empty');
      }
      classify(gbAjaxUnwrap(raw));
    }, feature);
    watchEntry.cancel = cancel;
    try { opts.send(uw, classify); } catch (e) { finish(String(e)); }
  }
  // Shared key builders used by both bridgeRaw and gameAjaxRaw. The bridge
  // skeleton itself (ajaxTransportRaw) is already shared; these helpers
  // collapse the duplicated timeout/watch-key formatting (REDESIGN §6 R7).
  function gbAjaxTimeoutKey(kind, feature) { return kind + '-timeout-' + feature; }
  function bridgeRaw(feature, payload, done) {
    selfBridgeNote(payload);
    ajaxTransportRaw(feature, {
      timeoutKey: gbAjaxTimeoutKey('bridge', feature),
      timeoutMsg: feature + ': bridge timeout ' + BRIDGE_TIMEOUT_MS + 'ms',
      watchKey: 'bridge:' + String(payload && payload.model_url || '') + '|' + String(payload && payload.action_name || ''),
      watchFp: gbAjaxBridgeFp(payload),
      authCsrf: true,
      send: (uw, classify) => uw.gpAjax.ajaxPost('frontend_bridge', 'execute', payload, false, classify),
    }, done);
  }
  function gameAjaxRaw(feature, controller, action, data, done) {
    ajaxTransportRaw(feature, {
      timeoutKey: gbAjaxTimeoutKey('ajax', feature),
      timeoutMsg: `${feature}: ajax timeout ${BRIDGE_TIMEOUT_MS}ms (${controller}/${action})`,
      watchKey: 'ajax:' + controller + '/' + action,
      watchFp: gbAjaxFp(data),
      emptyBodyWait: true,
      emptyBodyLogKey: 'ajax-empty-watch-' + feature,
      send: (uw, classify) => uw.gpAjax.ajaxPost(controller, action, data, false, classify),
    }, done);
  }
  function bridgePost(feature, payload, onDone) {
    const endpoint = String(payload && payload.model_url || '') + '/' + String(payload && payload.action_name || '');
    return txRun(feature, 'bridge', endpoint, payload, (done) => bridgeRaw(feature, payload, done), onDone);
  }
  function gameAjaxPost(feature, controller, action, data, onDone) {
    const endpoint = String(controller) + '/' + String(action);
    return txRun(feature, 'ajax', endpoint, data, (done) => gameAjaxRaw(feature, controller, action, data, done), onDone);
  }
  function dryRunFmt(payload) {
    try {
      const s = JSON.stringify(payload);
      return s.length > 220 ? s.slice(0, 220) + '\u2026' : s;
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
      t = gbTownModel(townId);
    } catch (_) {}
    let out = null;
    if (t) {
      let wood = null, stone = null, iron = null, resStorage = null;
      try {
        const r = t.resources && t.resources();
        if (r) {
          if (r.wood != null) wood = gbNum(r.wood);
          if (r.stone != null) stone = gbNum(r.stone);
          if (r.iron != null) iron = gbNum(r.iron);
          if (r.storage != null) resStorage = gbNum(r.storage);
        }
      } catch (_) {}
      if (wood != null && stone != null && iron != null) {
        let cap = null;
        try { if (t.getStorageCapacity) cap = gbNum(t.getStorageCapacity()); } catch (_) {}
        try { if (!(cap > 0) && t.storage && t.storage.getCapacity) cap = gbNum(t.storage.getCapacity()); } catch (_) {}
        if (!(cap > 0) && resStorage != null && resStorage > 100) cap = resStorage;
        if (cap != null && cap > 0) {
          const isFull = (v) => v >= cap || v / cap >= 0.99;
          const full = { wood: isFull(wood), stone: isFull(stone), iron: isFull(iron) };

          const n = (full.wood ? 1 : 0) + (full.stone ? 1 : 0) + (full.iron ? 1 : 0);
          try { const ps = townPopState(townId); full.pop = !!(ps && ps.warn); } catch (_) { full.pop = false; }
          const fillPct = Math.round(Math.max(wood, stone, iron) / cap * 100);
          out = { cap, wood, stone, iron, full, n, fillPct };
        }
      } else {
        try {
          const r = t.resources && t.resources();
          if (r && (r.wood != null || r.stone != null || r.iron != null)) {
            gbLogT('town-res-blind-' + key, 300000, `townResState: town ${key} wood/stone/iron incomplete or unreadable`);
          }
        } catch (_) {}
      }
    }
    _townResCache[key] = { at: now, v: out };
    return out;
  }

  const LOOT_RATE_PER_HOUR = 8000;
  const LOOT_SAFE_FILL_PCT = 0.6;

  const LOOT_CARRY_ATTRS = ['booty', 'carry', 'loot', 'haul_capacity', 'carrying_capacity', 'cargo'];
  function gbUnitCarry(unitId) {
    let m = null;
    try { m = unitMeta(unitId); } catch (_) {}
    if (!m) return null;
    const v = gbNum(gbProbeAttr(m, LOOT_CARRY_ATTRS));
    return v != null && v > 0 ? v : null;
  }

  function gbLootSplit(total) {
    const t = Math.max(0, Math.floor(+total || 0));
    const base = Math.floor(t / 3), rem = t - base * 3;
    return { wood: base + (rem > 0 ? 1 : 0), stone: base + (rem > 1 ? 1 : 0), iron: base };
  }
  function gbLootBlind(reason, meta) {
    return { wood: 0, stone: 0, iron: 0, total: 0, blind: true, blindReason: reason, meta: meta || {} };
  }
  function gbLootEstimate(ctx) {
    const kind = ctx && ctx.kind;
    if (kind === 'farm-claim') {
      const durationRead = gbNum(ctx.durationSec);
      const loyaltyRead = gbNum(ctx.loyalty);
      const headroom = gbNum(ctx.headroom);
      const dur = Math.max(0, durationRead != null ? durationRead : 0);
      const loyalty = loyaltyRead != null ? loyaltyRead : 1.0;
      const total = Math.round((dur / 3600) * LOOT_RATE_PER_HOUR * loyalty);

      const fits = headroom != null ? total <= headroom * LOOT_SAFE_FILL_PCT : null;
      const split = gbLootSplit(total);
      return {
        wood: split.wood, stone: split.stone, iron: split.iron, total,
        blind: false, blindReason: null,
        meta: { durationSec: dur, loyalty, headroom, fits, ratePerHour: LOOT_RATE_PER_HOUR, safeFillPct: LOOT_SAFE_FILL_PCT },
      };
    }
    if (kind === 'attack-boat') {
      let boats = null;
      try { boats = boatCapacityCheck(ctx.units, ctx.sameIsland); } catch (_) {}
      if (!boats) return gbLootBlind('boat-capacity-unreadable', { units: ctx.units });

      return { wood: 0, stone: 0, iron: 0, total: 0, blind: false, blindReason: null, meta: { boats } };
    }
    if (kind === 'attack-loot') {
      const units = ctx.units || {};
      let total = 0, unknown = 0;
      for (const [u, n0] of Object.entries(units)) {
        const n = gbNum(n0);
        if (n == null) { unknown += 1; continue; }
        if (!(n > 0)) continue;
        const carry = gbUnitCarry(u);
        if (carry == null) { unknown += n; continue; }
        total += carry * n;
      }

      if (unknown > 0 || total <= 0) return gbLootBlind('unit-carry-unknown', { units, unknownUnits: unknown });
      const split = gbLootSplit(total);
      return { wood: split.wood, stone: split.stone, iron: split.iron, total, blind: false, blindReason: null, meta: { units } };
    }
    gbLogT('loot-calc-bad-kind', 300000, 'loot estimate: unknown kind ' + String(kind));
    return gbLootBlind('unknown-kind', { kind });
  }

  const _townPopCache = Object.create(null);
  const POP_WARN_PCT = 90;
  const POP_NEAR_PCT = 75;

  function townPopState(townId) {
    if (townId == null || townId === '') return null;
    const key = 'pop:' + townId;
    const now = Date.now();
    const hit = _townPopCache[key];
    if (hit && now - hit.at < TOWN_RES_CACHE_MS) return hit.v;
    const t = gbTownModel(townId);
    const free = gbTownPop(townId);
    let cap = null;
    const scraped = (state.townResources || {})[townId] || (state.townResources || {})[String(townId)] || null;
    const scrapedCap = scraped ? gbNum(scraped.cap) : null;
    if (scrapedCap != null && scrapedCap > 0) cap = scrapedCap;
    if (!(cap > 0)) cap = gbProbeNum(t, ['getPopulationCapacity', 'getMaxPopulation', 'getPopulationMax']);
    if (!(cap > 0)) {
      try {
        const r = t && t.resources && t.resources();
        const v = r && (r.population_max ?? r.populationMax);
        const n = gbNum(v);
        if (n != null && n > 0) cap = n;
      } catch (_) {}
    }
    let used = null;
    if (free != null && cap > 0) used = Math.max(0, cap - free);
    else if (scraped) used = gbNum(scraped.pop);
    const usedPct = (used != null && cap > 0) ? Math.round(used / cap * 100) : null;
    const out = (free == null && used == null && !(cap > 0)) ? null : {
      free, used, cap: cap > 0 ? cap : null, usedPct,
      freePct: (free != null && cap > 0) ? Math.round(free / cap * 100) : null,
      near: usedPct != null && usedPct >= POP_NEAR_PCT,
      warn: usedPct != null && usedPct >= POP_WARN_PCT,

      etaMs: null,
    };
    _townPopCache[key] = { at: now, v: out };
    return out;
  }
  function gbProbeNum(obj, names, args) {
    if (!obj) return null;
    for (const n of names) {
      try {
        if (typeof obj[n] !== 'function') continue;
        const v = gbNum(obj[n].apply(obj, args || []));
        if (v != null) return v;
      } catch (_) {}
    }
    return null;
  }
  function gbProbeAttr(obj, names) {
    if (!obj) return null;
    const a = obj.attributes || obj;
    for (const n of names) {
      try {
        const v = gbNum(a[n]);
        if (v != null) return v;
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
      if (r && r.population != null) return gbNum(r.population);
    } catch (_) {}
    return null;
  }
  function gbPlayerGold() {
    try {
      const uw = gameUw();
      const p = uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('Player');
      const v = gbProbeAttr(p, ['gold', 'premium_gold']);
      if (v != null) return v;
      if (uw.Game && uw.Game.player_gold != null) return gbNum(uw.Game.player_gold);
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
      const need = gbNum(normalized[k]);
      if (need == null) { blind = true; short.push(`${k} cost unreadable`); continue; }
      if (need <= 0) continue;
      const have = av ? av[k] : (st && st[k]);
      if (have == null) { blind = true; short.push(`${k} unreadable`); continue; }
      if (have < need + margin) short.push(`${k} ${Math.floor(have)}/${Math.ceil(need + margin)}`);
    }
    const needPop = gbNum(normalized.population);
    if (needPop == null && normalized.population != null) { blind = true; short.push('population cost unreadable'); }
    else if (needPop != null && needPop > 0) {
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
        const v = gbNum(t.getBuildings().get(building));
        if (v != null) return v;
      }
    } catch (_) {}
    try {
      const a = (t.buildings && t.buildings().attributes) || {};

      if (a[building] != null) {
        const v = gbNum(a[building]);
        if (v != null) return v;
      }
    } catch (_) {}
    return null;
  }
  function hostEnabled() {
    return state.enabledHosts[location.host] === true && gbTabLeader;
  }
  function gbSpanishWorldNumber(host) {
    const m=/^es(\d+)\.grepolis\.com$/i.exec(String(host||''));
    return m ? (+m[1]||0) : 0;
  }
  function gbFindEnabledSpanishSibling(host) {
    const h=String(host||'');
    const n=gbSpanishWorldNumber(h);
    if(!n)return null;
    // Prefer the immediately preceding Spanish worlds. Modern GrepBot stores
    // the host switch in a dedicated key, so do not rely only on the legacy map.
    for(let d=1;d<=8;d++){
      const k=n-d;if(k<=0)break;
      const sibling='es'+k+'.grepolis.com';
      const sk=STORE.ENABLED_HOSTS+'@host:'+sibling;
      const v=load(sk,null);
      if(v===true)return sibling;
      if(gbStorageReadFailed(sk))break;
    }
    // Compatibility with old installations that still have the shared map.
    for(const [candidate,on] of Object.entries(state.enabledHosts||{})){
      if(candidate!==h && on===true && gbSpanishWorldNumber(candidate))return candidate;
    }
    return null;
  }
  function ensureHostDefault() {
    const h=location.host;
    const directKey=STORE.ENABLED_HOSTS+'@host:'+h;
    const direct=load(directKey,null);
    if(typeof direct==='boolean'){
      // Checkbox used to write only the shared map. @host:false then won on
      // every reload and froze ibAuto / auto-queue as "host-disabled".
      if(direct===false && state.enabledHosts[h]===true){
        save(directKey,true);
        gbLog('host '+h+' enable key repaired from shared map');
        return true;
      }
      state.enabledHosts[h]=direct;return direct;
    }
    // New Spanish worlds inherit ONLY the user's decision to enable GrepBot
    // from an already-enabled Spanish world. All queues, towns, templates, TX,
    // farm state, health and other runtime data remain hostname-scoped and clean.
    const spanishSibling=gbFindEnabledSpanishSibling(h);
    if(spanishSibling){
      state.enabledHosts[h]=true;
      save(directKey,true);
      gbLog('new Spanish world '+h+' enabled from '+spanishSibling+'; world-specific state starts clean');
      return true;
    }
    // Migrate the old shared map lazily, one host at a time. Never persist a
    // fallback when reading that map failed.
    if(gbStorageReadFailed(STORE.ENABLED_HOSTS)){
      gbLogT('enabled-hosts-read',60000,'host enable state unreadable; leaving automation disabled without overwriting storage');
      state.enabledHosts[h]=false;return false;
    }
    if(typeof state.enabledHosts[h]==='boolean'){
      save(directKey,!!state.enabledHosts[h]);return !!state.enabledHosts[h];
    }
    state.enabledHosts[h]=false;
    save(directKey,false);
    gbLog('host '+h+' disabled by default — enable in Config');
    return false;
  }
  function setHostEnabled(host,on) {
    const h=String(host||location.host),v=!!on;
    state.enabledHosts[h]=v;
    save(STORE.ENABLED_HOSTS,state.enabledHosts);
    return save(STORE.ENABLED_HOSTS+'@host:'+h,v);
  }
  function gbReloadSharedRuntimeState(reason) {
    if(!gbTabLeader)return false;
    const loadObj=(store,fallback)=>{
      const v=load(store,fallback);
      if(gbStorageReadFailed(store)||!v||typeof v!=='object'||Array.isArray(v))return null;
      return v;
    };
    const tx=loadObj(STORE.TX_STATE,{});
    if(tx){state.txState=tx;txLoadNormalize('leader:'+String(reason||'acquired'))}
    const nq=loadObj(STORE.NATIVE_QUEUE,{version:1,seq:0,towns:{}});
    if(nq){
      state.nativeQueue=nq;nativeQueueInflightRestored=false;
      try{nativeRecruitSplitDone.clear()}catch(_){}
      try{nativeQueueRoot()}catch(e){gbLogT('leader-reload-nq',60000,'leader reload native queue: '+String(e))}
    }
    const circuits=loadObj(STORE.CIRCUITS,{});
    if(circuits)state.circuits=circuits;
    const decisions=load(STORE.DECISIONS,[]);
    if(!gbStorageReadFailed(STORE.DECISIONS)&&Array.isArray(decisions))state.decisions=decisions;
    const skips=loadObj(STORE.DECISION_SKIPS,{});
    if(skips)state.decisionSkips=skips;

    // A follower can remain open for hours. On promotion, refresh the config
    // that controls server writes before any scheduler is poked. Storage is the
    // source of truth; current in-memory values are only fallbacks if a key is
    // missing, never replacements after a read error.
    const reloadFields = [
      ['configVer',STORE.CONFIG_VER],['dryRun',STORE.DRY_RUN],['firstPostConfirm',STORE.FIRST_POST_CONFIRM],['safeMode',STORE.SAFE_MODE],
      ['autoCollect',STORE.AUTO_COLLECT],['collectAll',STORE.COLLECT_ALL],['autoBandit',STORE.AUTO_BANDIT],['banditCfg',STORE.BANDIT_CFG],
      ['autoFarm',STORE.AUTO_FARM],['farmScrape',STORE.FARM_SCRAPE],['farmOptionMap',STORE.FARM_OPTION_MAP],['farmLongClaims',STORE.FARM_LONG_CLAIMS],
      ['ibAuto',STORE.IB_AUTO],['ibResearch',STORE.IB_RESEARCH],['questAutoBuild',STORE.QUEST_AUTO_BUILD],['questAutoRes',STORE.QUEST_AUTO_RES],
      ['abAuto',STORE.AB_AUTO],['abRandom',STORE.AB_RANDOM],['abTargets',STORE.AB_TARGETS],['abOrder',STORE.AB_ORDER],['autoWallRepair',STORE.AUTO_WALL_REPAIR],['popRescueFarm',STORE.POP_RESCUE_FARM],['buildSwapThresholdMin',STORE.BUILD_SWAP_MIN],['buildSwapIgnore',STORE.BUILD_SWAP_IGNORE],
      ['autoResearch',STORE.AUTO_RESEARCH],['researchTargets',STORE.RESEARCH_TARGETS],
      ['autoRecruit',STORE.AUTO_RECRUIT],['recruitTargets',STORE.RECRUIT_TARGETS],['recruitSpells',STORE.RECRUIT_SPELLS],['batchRecruit',STORE.BATCH_RECRUIT],['batchRecruitLists',STORE.BATCH_RECRUIT_LISTS],['recruitPacks',STORE.RECRUIT_PACKS],['autoVillageRecruit',STORE.AUTO_VILLAGE_RECRUIT],['villageRecruitFillPct',STORE.VILLAGE_RECRUIT_FILL],['villageRecruitAmount',STORE.VILLAGE_RECRUIT_AMOUNT],
      ['autoCave',STORE.AUTO_CAVE],['caveThreshPct',STORE.CAVE_THRESH],['caveTowns',STORE.CAVE_TOWNS],['emergencyCaveAuto',STORE.EMERGENCY_CAVE_AUTO],['emergencyCaveConfirm',STORE.EMERGENCY_CAVE_CONFIRM],['emergencyCaveMinIron',STORE.EMERGENCY_CAVE_MIN],
      ['autoCulture',STORE.AUTO_CULTURE],['cultureTypes',STORE.CULTURE_TYPES],['allowPremiumCulture',STORE.ALLOW_PREMIUM_CULTURE],['cultureGoldBudget',STORE.CULTURE_GOLD_BUDGET],
      ['autoTrade',STORE.AUTO_TRADE],['tradePreset',STORE.TRADE_PRESET],['tradeReservePct',STORE.TRADE_RESERVE],['tradeMinBatch',STORE.TRADE_MIN],['tradeTowns',STORE.TRADE_TOWNS],['tradeRoutes',STORE.TRADE_ROUTES],['autoTradeRoutes',STORE.AUTO_TRADE_ROUTES],['autoTransport',STORE.AUTO_TRANSPORT],['transportReserve',STORE.TRANSPORT_RESERVE],['transportMin',STORE.TRANSPORT_MIN],['autoDump',STORE.AUTO_DUMP],['dumpThreshold',STORE.DUMP_THRESHOLD],['dumpKeep',STORE.DUMP_KEEP],['dumpSinks',STORE.DUMP_SINKS],['islandShip',STORE.ISLAND_SHIP],
      ['autoRuralTrade',STORE.AUTO_RURAL_TRADE],['autoRuralLevel',STORE.AUTO_RURAL_LEVEL],['ruralLevelMax',STORE.RURAL_LEVEL_MAX],
      ['autoMerchant',STORE.AUTO_MERCHANT],['merchantWish',STORE.MERCHANT_WISH],['autoPtTrade',STORE.AUTO_PT_TRADE],['ptCfg',STORE.PT_CFG],
      ['autoFavor',STORE.AUTO_FAVOR],['favorCfg',STORE.FAVOR_CFG],['autoWonder',STORE.AUTO_WONDER],['wonderCfg',STORE.WONDER_CFG],['autoWonderFavor',STORE.AUTO_WONDER_FAVOR],
      ['autoDodge',STORE.AUTO_DODGE],['dodgeMode',STORE.DODGE_MODE],['dodgeFloor',STORE.DODGE_FLOOR],['defenseCfg',STORE.DEFENSE_CFG],['supportCfg',STORE.SUPPORT_CFG],['autoMilitia',STORE.AUTO_MILITIA],
      ['spyEnabled',STORE.AUTO_SPY],['spyCfg',STORE.SPY_CFG],
      ['plannerCfg',STORE.PLANNER_CFG],['goalProfiles',STORE.GOAL_PROFILES],['townGoals',STORE.TOWN_GOALS],['virtualQueue',STORE.VIRTUAL_QUEUE],['virtualQueueOverrides',STORE.VIRTUAL_QUEUE_OVERRIDES]
    ];
    for(const [field,store] of reloadFields){
      const v=load(store,state[field]);
      if(!gbStorageReadFailed(store))state[field]=v;
    }

    const dodgeReturns=loadObj(STORE.DODGE_RETURNS,{});
    if(dodgeReturns)state.dodgeReturns=dodgeReturns;
    try {
      const dq=dodgeQueueLoad();
      for(const k of Object.keys(dodgeQueue))delete dodgeQueue[k];
      Object.assign(dodgeQueue,dq||{});
    } catch(e) { gbLogT('leader-reload-dodge',60000,'leader reload dodge queue: '+String(e)); }
    try {
      const qf=questClaimFailLoad();
      for(const k of Object.keys(questClaimFail))delete questClaimFail[k];
      Object.assign(questClaimFail,qf||{});
    } catch(e) { gbLogT('leader-reload-quest',60000,'leader reload quest fail state: '+String(e)); }
    gbLogT('leader-state-reload',30000,`leader: shared runtime state reloaded (${reason||'acquired'})`);
    return true;
  }
  function gbHandleLeadershipAcquired(reason) {
    if(!gbInstanceAlive()||!gbTabLeader)return false;
    try{gbReloadSharedRuntimeState(reason)}catch(e){gbLogT('leader-reload',60000,'leader state reload: '+String(e))}
    try{migrateConfig()}catch(e){gbLogT('leader-migrate',60000,'leader migration: '+String(e))}
    try{orchStartIndependentTimers()}catch(e){gbLogT('leader-orch-ensure',60000,'leader scheduler ensure: '+String(e))}
    try{orchTick()}catch(e){gbLogT('leader-orch-poke',60000,'leader scheduler poke: '+String(e))}
    try{farmTick()}catch(e){gbLogT('leader-farm-poke',60000,'leader farm poke: '+String(e))}
    try{nativeQueueSweep('leader')}catch(e){gbLogT('leader-nq-poke',60000,'leader native queue poke: '+String(e))}
    try{txReconcileUnknownOnLeader(reason)}catch(e){gbLogT('leader-tx-reconcile',60000,'leader tx reconcile: '+String(e))}
    try{updateStatus()}catch(_){}
    return true;
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
