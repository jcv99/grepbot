  // gpAjax settle watchers (v1.6.1). gpAjax skips its success branch whole when
  // the response carries no json/_srvtime, so the caller would hang on a
  // server-side rejection. The XHR spy claims the matching watcher on loadend
  // and settles the post from the raw response.
  const GB_AJAX_WATCH_MS = 8000;
  const GB_AJAX_PENDING_MAX = 24;
  const gbAjaxPending = [];
  // Stable, order-independent stringify. The watcher side has the outgoing
  // payload OBJECT and the claim side has the serialized request BODY; both must
  // hash to the same string, so key order is normalized and every scalar is
  // compared as text (form encoding loses the number/string distinction).
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
  function gbAjaxWatch(sig, fp, settle) {
    const entry = { sig, fp: fp || '', at: Date.now(), settle };
    gbAjaxPending.push(entry);
    // Expire before evicting: a burst of 25 posts inside 8s used to drop the
    // OLDEST live watchers silently, and those posts then had no raw-response
    // settle left and hung the full BRIDGE_TIMEOUT_MS on any rejection.
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
  // A watcher whose post already settled (gpAjax callback won the race) MUST be
  // dropped. gbAjaxClaim matches the OLDEST entry for a signature, so a dead
  // watcher left behind for its 8s TTL swallowed the claim of the next post with
  // the same model_url|action_name - that post then had no raw-response settle
  // left and hung the full BRIDGE_TIMEOUT_MS on any server-side rejection.
  function gbAjaxDrop(entry) {
    if (!entry) return;
    const i = gbAjaxPending.indexOf(entry);
    if (i >= 0) gbAjaxPending.splice(i, 1);
  }
  // Called from __grepbotDispose. bridgePost's finish() already refuses to act
  // for a dead instance, so a leftover watcher cannot post - but it keeps its
  // settle closure alive and occupies a GB_AJAX_PENDING_MAX slot that the NEXT
  // instance's spy can still claim, which would settle a fresh post from a stale
  // instance's response.
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
      // parseBodyLoose only unwraps `json` for bridge-shaped payloads, so peel
      // it here to line the body up with the `data` object the watcher holds.
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
  // Two concurrent posts can share a signature (same model_url|action_name for
  // two towns), and a signature-only match pairs the response with whichever
  // watcher happens to be first — settling post A from post B's response. The
  // request FINGERPRINT is the only 1:1 key, so it wins; signature order is the
  // fallback for a body we could not parse.
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
    for (let i = 0; i < gbAjaxPending.length; i++) {
      if (sigs.indexOf(gbAjaxPending[i].sig) >= 0) return gbAjaxPending.splice(i, 1)[0].settle;
    }
    return null;
  }
  const GB_CAPTCHA_FLAGS = ['captcha', 'captcha_required'];
  // 256 KB cap on the unwrap path's JSON.parse. A hostile mirror can't burn
  // CPU on every probe; large real responses still pass because the bridge
  // paths run on game grepolis.com. Bump this only after auditing the real
  // payload sizes (largest is the all-towns scrape at ~32 KB today).
  const GB_AJSON_PARSE_MAX = 256 * 1024;
  function gbAjaxUnwrap(raw) {
    if (!raw || typeof raw !== 'object') return null;
    let d = Object.prototype.hasOwnProperty.call(raw, 'json') ? raw.json : raw;
    if (typeof d === 'string') {
      // Cap the parse input. The noteCaptchaBody substring sniff (4 KB) is
      // upstream of this; this guard is the second line against an oversized
      // hostile body.
      const src = d.length > GB_AJSON_PARSE_MAX ? d.slice(0, GB_AJSON_PARSE_MAX) : d;
      try { d = JSON.parse(src); } catch (_) {}
    }
    if (d == null) d = {};
    else if (typeof d !== 'object') d = { data: d };
    if (raw.plain && typeof raw.plain === 'object') {
      const merged = Object.assign({}, d, raw.plain);
      // Last-wins merge could overwrite a true captcha flag from `json` with a
      // falsy/absent one from `plain`, and the post would then be classified as
      // success while the bot keeps posting into the captcha wall. A captcha
      // flag set on EITHER side wins.
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
  function bridgeRaw(feature, payload, done) {
    const uw = gameUw();
    if (!(uw.gpAjax && uw.gpAjax.ajaxPost)) return done('noajax');
    let settled = false;
    let watchEntry = null;
    const finish = (err, data) => {
      if (settled || !gbInstanceAlive()) return;
      settled = true;
      gbClearTimeout(timer);
      gbAjaxDrop(watchEntry);
      done(err, data);
    };
    const timer = gbTimeout(() => {
      gbLogT('bridge-timeout-' + feature, 30000, feature + ': bridge timeout ' + BRIDGE_TIMEOUT_MS + 'ms');
      finish('timeout');
    }, BRIDGE_TIMEOUT_MS);
    selfBridgeNote(payload);
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
    watchEntry = gbAjaxWatch(
      'bridge:' + String(payload && payload.model_url || '') + '|' + String(payload && payload.action_name || ''),
      gbAjaxBridgeFp(payload),
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
    let watchEntry = null;
    const finish = (err, res) => {
      if (settled || !gbInstanceAlive()) return;
      settled = true;
      gbClearTimeout(timer);
      gbAjaxDrop(watchEntry);
      done(err, res);
    };
    // Same log as bridgeRaw: an ajax timeout used to be completely silent, so a
    // dead controller/action looked like "nothing happened" in the Log tab.
    const timer = gbTimeout(() => {
      gbLogT('ajax-timeout-' + feature, 30000, `${feature}: ajax timeout ${BRIDGE_TIMEOUT_MS}ms (${controller}/${action})`);
      finish('timeout');
    }, BRIDGE_TIMEOUT_MS);
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
    watchEntry = gbAjaxWatch('ajax:' + controller + '/' + action, gbAjaxFp(data), (status, raw) => {
      if (settled) return;
      // Status-first classification per RFC 6585 + MDN HTTP 429/503 guidance:
      // 429 and 503 mean back off with Retry-After (the server-pressure bus
      // parses it). A 200 with an empty body is a soft-empty (skip, not
      // failure, so three in a row do not open a JRN_BACKOFF skip window for
      // nothing). Impossible-early (status 0 before 250ms) is a neterr not a
      // timeout - it is almost always a proxy or extension tamper, not a
      // slow server.
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
      // Soft-empty 200: empty / whitespace body, JSON-shaped. Short-circuits
      // to 'soft-empty' (a skip class) so the journal doesn't open a hard-error
      // skip window for what is actually a benign transient.
      try {
        const txt = raw && (raw.responseText != null ? raw.responseText : (raw.json != null ? (typeof raw.json === 'string' ? raw.json : '') : ''));
        if (!txt || !String(txt).trim()) return finish('soft-empty');
      } catch (_) {}
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
          // `n` stays a RESOURCE count: a town is not blocked from looting just
          // because its population is capped, and every existing caller of `n`
          // (cave stash, deadlock resolver, trade) means "warehouses full".
          const n = (full.wood ? 1 : 0) + (full.stone ? 1 : 0) + (full.iron ? 1 : 0);
          try { const ps = townPopState(townId); full.pop = !!(ps && ps.warn); } catch (_) { full.pop = false; }
          const fillPct = Math.round(Math.max(wood, stone, iron) / cap * 100);
          out = { cap, wood, stone, iron, full, n, fillPct };
        }
      }
    }
    _townResCache[key] = { at: now, v: out };
    return out;
  }
  // ===== Loot estimate (v4 plan 2.12) ========================================
  // ONE home for "how much can this action bring back / can the town absorb it".
  // Three modules carried their own copy of this math; a research multiplier or
  // a world-specific rate now lands in one place.
  //
  // Every branch returns the same shape so a caller can compose checks without
  // branching by domain:
  //   {wood, stone, iron, total, blind, blindReason, meta}
  // `blind:true` means UNKNOWN, and a renderer must print "desconocido", never
  // "0" - that distinction is the whole point of the helper.
  const LOOT_RATE_PER_HOUR = 8000;
  const LOOT_SAFE_FILL_PCT = 0.6;
  // Per-unit loot carry is NOT named anywhere in src/ and this repo has never
  // seen a client that exposes it. These names are UNVERIFIED probe candidates,
  // not an assumption about the field: every one of them missing is the
  // expected outcome, gbUnitCarry returns null, and the caller stays blind.
  // Never substitute a guessed number for a missing probe.
  const LOOT_CARRY_ATTRS = ['booty', 'carry', 'loot', 'haul_capacity', 'carrying_capacity', 'cargo'];
  function gbUnitCarry(unitId) {
    let m = null;
    try { m = unitMeta(unitId); } catch (_) {}
    if (!m) return null;
    const v = gbProbeAttr(m, LOOT_CARRY_ATTRS);
    return Number.isFinite(v) && v > 0 ? v : null;
  }
  // Even thirds that actually sum to `total`: rounding each share
  // independently drifts by up to 2, and a caller rendering the per-resource
  // numbers next to the total would be reading a contradiction.
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
      const dur = Math.max(0, +(ctx.durationSec) || 0);
      const loyalty = ctx.loyalty != null ? +ctx.loyalty : 1.0;
      const headroom = ctx.headroom != null ? +ctx.headroom : null;
      const total = Math.round((dur / 3600) * LOOT_RATE_PER_HOUR * (Number.isFinite(loyalty) ? loyalty : 1));
      // fits === null means "headroom unreadable", not "does not fit": the
      // caller must not skip the duration on an unread value.
      const fits = (headroom != null && Number.isFinite(headroom)) ? total <= headroom * LOOT_SAFE_FILL_PCT : null;
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
      // Transport capacity is not loot; it rides in meta so callers that want
      // the discriminator get it without a second call.
      return { wood: 0, stone: 0, iron: 0, total: 0, blind: false, blindReason: null, meta: { boats } };
    }
    if (kind === 'attack-loot') {
      const units = ctx.units || {};
      let total = 0, unknown = 0;
      for (const [u, n0] of Object.entries(units)) {
        const n = +n0 || 0;
        if (!(n > 0)) continue;
        const carry = gbUnitCarry(u);
        if (carry == null) { unknown += n; continue; }
        total += carry * n;
      }
      // Any unreadable unit poisons the whole number: a partial sum would read
      // as a full answer and understate the haul.
      if (unknown > 0 || total <= 0) return gbLootBlind('unit-carry-unknown', { units, unknownUnits: unknown });
      const split = gbLootSplit(total);
      return { wood: split.wood, stone: split.stone, iron: split.iron, total, blind: false, blindReason: null, meta: { units } };
    }
    gbLogT('loot-calc-bad-kind', 300000, 'loot estimate: unknown kind ' + String(kind));
    return gbLootBlind('unknown-kind', { kind });
  }
  // ===== Population state (v4 plan 2.7) ======================================
  // Own cache keyspace so a pop invalidation never trashes the resource memo.
  const _townPopCache = Object.create(null);
  const POP_WARN_PCT = 90;
  const POP_NEAR_PCT = 75;
  // NOTE: gbTownPop probes getAvailablePopulation FIRST, so it returns FREE
  // population, not used. Plan 2.7 calls its field `current` and derives
  // `freePct = current/cap`, which would light the warn colour on an EMPTY
  // town. This helper keeps `free` and `used` as separate named fields and
  // warns on usedPct, which is the number the user cares about.
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
    if (scraped && Number.isFinite(+scraped.cap) && +scraped.cap > 0) cap = +scraped.cap;
    if (!(cap > 0)) cap = gbProbeNum(t, ['getPopulationCapacity', 'getMaxPopulation', 'getPopulationMax']);
    if (!(cap > 0)) {
      try {
        const r = t && t.resources && t.resources();
        const v = r && (r.population_max ?? r.populationMax);
        if (Number.isFinite(+v) && +v > 0) cap = +v;
      } catch (_) {}
    }
    let used = null;
    if (free != null && cap > 0) used = Math.max(0, cap - free);
    else if (scraped && Number.isFinite(+scraped.pop)) used = +scraped.pop;
    const usedPct = (used != null && cap > 0) ? Math.round(used / cap * 100) : null;
    const out = (free == null && used == null && !(cap > 0)) ? null : {
      free, used, cap: cap > 0 ? cap : null, usedPct,
      freePct: (free != null && cap > 0) ? Math.round(free / cap * 100) : null,
      near: usedPct != null && usedPct >= POP_NEAR_PCT,
      warn: usedPct != null && usedPct >= POP_WARN_PCT,
      // Population growth is not exposed as a rate on stock client builds; a
      // guard may only block on a value it actually read, so ETA stays null
      // and the cell renders a dash rather than a fabricated number.
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

      if (a[building] != null) {
        const v = +a[building];
        if (Number.isFinite(v)) return v;
      }
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
  // Local gates only: nothing was ever posted, so none of these is evidence
  // about the endpoint. Anything missing here is charged as a hard error and
  // three of them in a row open a 5/15/60min skip window — a permanent lockout
  // built entirely out of our own refusals to send.
  const JRN_SKIP_ERRS = {
    disabled: 1, paused: 1, 'captcha-pause': 1, budget: 1, noajax: 1, remembered: 1, dryrun: 1,
    disposed: 1, 'tpl-stale': 1, 'circuit-open': 1,
    'safe-mode-high-impact': 1, 'safe-mode-premium': 1,
  };

  if (!Array.isArray(state.decisions)) state.decisions = [];
  if (!state.decisionSkips || typeof state.decisionSkips !== 'object') state.decisionSkips = {};
