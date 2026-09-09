  const JRN_DEDUP_MS = 10 * 60 * 1000;
  const JRN_SAVE_MS = 5000;
  const JRN_FAIL_TRIP = 3;
  const JRN_BACKOFF = [5, 15, 60];
  const JRN_SKIP_MAX = 400;
  const JRN_SKIP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  const JRN_SKIP_ERRS = {
    disabled: 1, paused: 1, 'captcha-pause': 1, budget: 1, noajax: 1, remembered: 1, dryrun: 1,
    'first-post-confirm': 1,
    disposed: 1, 'tpl-stale': 1, 'circuit-open': 1,
    'safe-mode-high-impact': 1, 'safe-mode-premium': 1,
  };

  if (!Array.isArray(state.decisions)) state.decisions = [];
  if (!state.decisionSkips || typeof state.decisionSkips !== 'object') state.decisionSkips = {};

  function jrnTransientDynamicResult(r) {
    const s = String(r || '');
    return /^planner-/i.test(s) || /^safe-mode-/i.test(s);
  }

  // Expected server-side capacity/resource rejections are normal scheduling
  // outcomes, not module failures.  They must not poison diagnostics, trip
  // template health, or turn an otherwise valid FIFO job into a permanent block.
  function gbExpectedServerReject(feature, err) {
    if (!err) return null;
    let s = String(err).toLowerCase();
    try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) {}
    const f = String(feature || '').toLowerCase();
    if (f === 'recruit') {
      if (/no hay suficientes recursos|no hay suficiente(?:s)? recursos|not enough resources|insufficient resources/.test(s)) return 'waiting-resources';
      if (/no hay suficiente favor|not enough favor|insufficient favor/.test(s)) return 'waiting-favor';
      if (/no hay suficiente poblacion|poblacion libre|not enough population|insufficient population|free population/.test(s)) return 'waiting-population';
      if (/no puedes (?:reclutar|construir) mas de\s+\d+|cannot (?:recruit|build) more than\s+\d+|can(?:not|'t) (?:recruit|build) more than\s+\d+/.test(s)) return 'waiting-runtime-max';
      if (/^(?:la cola de construccion esta llena|the (?:building|construction) queue is full)[.!]?\s*$/.test(s)) return 'waiting-queue-full';
    }
    if (f === 'farm') {
      if (/cantidad diaria maxima de recursos|daily maximum (?:amount )?of resources|maximum daily (?:amount )?of resources|daily resource (?:limit|cap)/.test(s)) return 'farm-daily-cap';
      if (/^(?:tu peticion no esta lista aun|(?:your )?(?:request|claim) is not ready yet)[.!]?\s*$/.test(s)) return 'waiting-not-ready';
    }
    if (f === 'culture') {
      if (/^(?:no se ha podido organizar ningun festival|no festival could be organized)[.!]?\s*$/.test(s)) return 'waiting-culture-capacity';
    }
    if (f === 'bandit') {
      // A full reward inventory is a normal capacity wait, not a technical failure.
      if (/^(?:tu inventario esta lleno|your inventory is full)\b/.test(s)) return 'waiting-inventory-full';
    }
    return null;
  }
  function jrnResult(err) {
    if (!err) return 'ok';
    const s = String(err);
    if (JRN_SKIP_ERRS[s.split(':')[0]] || jrnTransientDynamicResult(s)) return 'skip:' + s.slice(0, 40);
    return s.slice(0, 60);
  }
  function jrnPendingResult(r) {
    const s = String(r || '');
    return s === 'unknown' || s === 'timeout_unknown' || /^pending(?::|$)/i.test(s) || /^unknown outcome/i.test(s);
  }
  function jrnHard(r) {
    const s = String(r || '');
    return !!s && s !== 'ok' && s !== 'timeout' && s !== 'captcha'
      && !jrnPendingResult(s) && s.slice(0, 5) !== 'skip:';
  }
  function jrnId(tag) { return tag.f + '|' + tag.a + '|' + tag.k; }

  let jrnHost = location.hostname;
  function jrnSaveForHost(host) {
    jrnPrune();
    save(STORE.DECISIONS + '@' + host, state.decisions);
    save(STORE.DECISION_SKIPS + '@' + host, state.decisionSkips);
  }
  function jrnCheckHost() {
    if (location.hostname === jrnHost) return;

    jrnSaveQueued = false;
    try { jrnSaveForHost(jrnHost); } catch (_) {}
    jrnHost = location.hostname;
    const next = load(wkey(STORE.DECISIONS), []);
    state.decisions = Array.isArray(next) ? next : [];
    const skips = load(wkey(STORE.DECISION_SKIPS), {});
    state.decisionSkips = (skips && typeof skips === 'object') ? skips : {};
    gbLog('memory: reloaded for host ' + jrnHost);
  }
  function gbSkipActive(feature, payload) {
    const tag = jrnTag(feature, payload);
    return jrnSkipped(tag) ? (jrnWhy(tag) || 'remembered') : '';
  }

  function gbSkipActiveWrite(feature, transport, endpoint, data, snap) {
    if (!TX_WRITE_FEATURES.has(feature)) return gbSkipActive(feature, data);
    const tag = {
      f: feature,
      a: String(endpoint).slice(0, 48),
      k: String(txIntent(feature, transport, endpoint, data, snap || null)).slice(0, 120),
    };
    return jrnSkipped(tag) ? (jrnWhy(tag) || 'remembered') : '';
  }
  function jrnTag(feature, payload) {
    let action = '', target = '', town = '';
    try {
      const p = payload || {};
      action = p.action_name || p.action || '';
      const mu = String(p.model_url || p.model || '');
      if (mu) {
        const model = mu.split('/')[0] || mu;
        action = action ? model + '/' + action : model;
      }
      const args = p.arguments || {};
      town = p.town_id ?? args.town_id ?? '';
      target = args.building_id || args.research_id || args.research || args.farm_town_id
        || args.offer_id || args.offer || args.power_id
        || (args.id != null && String(args.id) !== String(town) ? args.id : '')
        || '';
    } catch (_) {}
    const key = `${town !== '' ? 't' + town : 't-'}:${target !== '' ? target : '-'}`;
    return { f: feature, a: String(action || 'post').slice(0, 48), k: key.slice(0, 72) };
  }
  function jrnPrune() {
    const now = Date.now();
    const cut = now - JRN_TTL_MS;
    const list = state.decisions;
    let i = 0;
    while (i < list.length && list[i].ts < cut) i++;
    if (i) list.splice(0, i);
    while (list.length > JRN_MAX) list.shift();
    const skips = state.decisionSkips || {};
    for (const [key, rec] of Object.entries(skips)) {
      if (!rec || typeof rec !== 'object') { delete skips[key]; continue; }
      const at = gbNum(rec.at);
      const until = gbNum(rec.until);
      if (at == null && until != null) rec.at = Math.min(now, until);
      if (!(until > now) && (at == null || at < now - JRN_SKIP_TTL_MS)) delete skips[key];
    }
    const entries = Object.entries(skips);
    if (entries.length > JRN_SKIP_MAX) {
      entries.sort((a, b) => {
        const aa = a[1] || {}, bb = b[1] || {};
        const aActive = gbNum(aa.until) > now ? 1 : 0;
        const bActive = gbNum(bb.until) > now ? 1 : 0;
        return aActive - bActive || (gbNum(aa.at) || 0) - (gbNum(bb.at) || 0);
      });
      for (let n = 0; n < entries.length - JRN_SKIP_MAX; n++) delete skips[entries[n][0]];
    }
  }
  let jrnSaveQueued = false;
  function jrnSave(immediate) {
    if (!immediate) {
      if (jrnSaveQueued) return;
      jrnSaveQueued = true;
      gbTimeout(() => { jrnSaveQueued = false; jrnSave(true); }, JRN_SAVE_MS);
      return;
    }
    jrnPrune();
    save(wkey(STORE.DECISIONS), state.decisions);
    save(wkey(STORE.DECISION_SKIPS), state.decisionSkips);
  }
  function jrnFlush() { if (jrnSaveQueued) { jrnSaveQueued = false; jrnSave(true); } }
  function jrnPush(tag, result, detail, txId) {
    jrnCheckHost();
    const list = state.decisions;
    const now = Date.now();

    if (txId != null && txId !== '') {
      const id = String(txId).slice(0, 120);
      const provisional = result === 'timeout' || jrnPendingResult(result);
      for (let i = list.length - 1; i >= 0; i--) {
        const r = list[i];
        if (r.x !== id || r.f !== tag.f || r.a !== tag.a || r.k !== tag.k) continue;
        if (provisional) {
          r.ts = now; r.r = result; r.n = 1;
          if (detail && jrnHard(result)) r.d = String(detail).slice(0, 80); else delete r.d;
          list.splice(i, 1); list.push(r);
          jrnNote(tag, result); jrnSave();
          return r;
        }

        list.splice(i, 1);
        break;
      }
      if (provisional) {
        const rec = { ts: now, f: tag.f, a: tag.a, k: tag.k, r: result, n: 1, x: id };
        if (detail && jrnHard(result)) rec.d = String(detail).slice(0, 80);
        list.push(rec); jrnPrune(); jrnNote(tag, result); jrnSave();
        return rec;
      }
    }
    for (let i = list.length - 1; i >= 0; i--) {
      const r = list[i];
      if (now - r.ts >= JRN_DEDUP_MS) break;
      if (r.f !== tag.f || r.a !== tag.a || r.k !== tag.k) continue;
      if (r.r === result && now - r.ts < JRN_DEDUP_MS) {
        r.n = (r.n || 1) + 1;
        r.ts = now;

        list.splice(i, 1);
        list.push(r);
        jrnNote(tag, result);
        jrnSave();
        return r;
      }
      break;
    }
    const rec = { ts: now, f: tag.f, a: tag.a, k: tag.k, r: result, n: 1 };
    if (detail && jrnHard(result)) rec.d = String(detail).slice(0, 80);
    list.push(rec);
    jrnPrune();
    jrnNote(tag, result);
    jrnSave();
    return rec;
  }
  function jrnFailStreak(feature, action, target) {
    const list = state.decisions;
    let n = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const r = list[i];
      if (r.f !== feature || r.a !== action || String(r.k) !== String(target)) continue;
      if (r.r === 'ok') break;
      if (!jrnHard(r.r)) continue;
      n += r.n || 1;
    }
    return n;
  }
  function jrnNote(tag, result) {
    const key = jrnId(tag);
    if (result === 'ok') {
      if (state.decisionSkips[key]) { delete state.decisionSkips[key]; jrnSave(); }
      return;
    }
    if (!jrnHard(result)) return;
    if (jrnFailStreak(tag.f, tag.a, tag.k) < JRN_FAIL_TRIP) return;
    const prev = state.decisionSkips[key] || { trips: 0 };
    if (prev.until && Date.now() < prev.until) return;
    const trips = Math.min((prev.trips || 0) + 1, JRN_BACKOFF.length);
    const mins = JRN_BACKOFF[trips - 1];
    state.decisionSkips[key] = { trips, until: Date.now() + mins * 60000, at: Date.now(), r: result };
    gbLog(`memory: ${tag.f} ${tag.a} ${tag.k} failed ${JRN_FAIL_TRIP}x (${result}) - skipping ${mins}m`);
    jrnSave(true);
  }
  function jrnSkipped(tag) {
    jrnCheckHost();
    if (state.decisionMemory === false) return false;
    const key = jrnId(tag);
    const s = state.decisionSkips[key];
    if (!s || !s.until) return false;

    if (jrnTransientDynamicResult(s.r)) {
      delete state.decisionSkips[key];
      jrnSave();
      gbLogT('memory-transient-clear-' + key, 30000, `memory: cleared transient ${s.r}; live precheck will decide`);
      return false;
    }
    if (Date.now() >= s.until) {
      delete s.until;
      s.at = Date.now();
      jrnSave();
      return false;
    }
    return true;
  }
  function jrnWhy(tag) {
    const s = state.decisionSkips[jrnId(tag)];
    if (!s) return '';
    return (s.r || 'error') + ', ' + fmtSec(Math.round(((s.until || 0) - Date.now()) / 1000)) + ' left';
  }
  function jrnActiveSkips() {
    const now = Date.now();
    return Object.entries(state.decisionSkips)
      .filter(([, s]) => s && s.until && s.until > now)
      .map(([k, s]) => ({ key: k, until: s.until, trips: s.trips, r: s.r }));
  }

  function jrnSlice(opts) {
    const o = opts || {};
    const sinceRead = gbNum(o.since), untilRead = gbNum(o.until);
    const since = sinceRead != null ? sinceRead : 0;
    const until = untilRead != null ? untilRead : Infinity;
    const feature = o.feature ? String(o.feature) : null;
    const result = o.result ? String(o.result) : null;
    const out = [];
    for (const r of (state.decisions || [])) {
      if (!r || r.ts < since || r.ts > until) continue;
      if (feature && r.f !== feature) continue;
      if (result && r.r !== result) continue;
      out.push(r);
    }
    return out.sort((a, b) => a.ts - b.ts);
  }

  function jrnWindowOf(row) {
    if (!row) return null;
    const key = jrnId({ f: row.f, a: row.a, k: row.k });
    const w = (state.decisionSkips || {})[key];
    return w ? Object.assign({ key }, w) : null;
  }
  function jrnClearSkips() {
    state.decisionSkips = {};
    jrnSave(true);
    gbLog('memory: skip windows cleared');
  }
  function jrnClear() {
    state.decisions = [];
    state.decisionSkips = {};
    jrnSave(true);
    gbLog('memory: journal cleared');
  }
  function jrnStats(windowMs) {
    const since = Date.now() - (windowMs || 24 * 60 * 60 * 1000);
    const byFeature = Object.create(null);
    const bySkip = Object.create(null);
    const byError = Object.create(null);
    const byPending = Object.create(null);
    let ok = 0, err = 0, captcha = 0, skip = 0, timeout = 0, pending = 0, dry = 0, total = 0;
    for (const r of (state.decisions || [])) {
      if (r.ts < since) continue;
      const n = r.n || 1;
      total += n;
      const f = byFeature[r.f] || (byFeature[r.f] = { ok: 0, err: 0, captcha: 0, skip: 0, timeout: 0, pending: 0, n: 0, last: 0 });
      f.n += n;
      f.last = Math.max(f.last, r.ts);
      const res = String(r.r || '');
      if (res === 'ok') { ok += n; f.ok += n; }
      else if (res === 'captcha') { captcha += n; f.captcha += n; }
      else if (res === 'timeout') { timeout += n; f.timeout += n; }
      else if (jrnPendingResult(res)) {
        pending += n; f.pending += n;
        const key = r.f + ' ' + r.a + ' ' + (r.k || '-') + ': ' + res.slice(0, 40);
        byPending[key] = (byPending[key] || 0) + n;
      }
      else if (res.slice(0, 5) === 'skip:') {
        skip += n; f.skip += n;
        const why = res.slice(5);
        if (why.slice(0, 6) === 'dryrun') dry += n;
        bySkip[why] = (bySkip[why] || 0) + n;
      } else {
        err += n; f.err += n;
        const key = r.f + ' ' + r.a + ' ' + (r.k || '-') + ': ' + res.slice(0, 40);
        byError[key] = (byError[key] || 0) + n;
      }
    }
    const attempts = ok + err + captcha + timeout;
    const topSkips = Object.entries(bySkip).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const topErrors = Object.entries(byError).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const topPending = Object.entries(byPending).sort((a, b) => b[1] - a[1]).slice(0, 6);
    return {
      windowMs: windowMs || 86400000,
      total, ok, err, captcha, skip, timeout, pending, dry, attempts,
      successPct: attempts ? Math.round(ok / attempts * 100) : null,
      byFeature, topSkips, topErrors, topPending,
    };
  }
  function jrnCountOk(feature, actionRe, windowMs) {
    const since = Date.now() - (windowMs || 86400000);
    let n = 0;
    for (const r of (state.decisions || [])) {
      if (r.ts < since || r.f !== feature || r.r !== 'ok') continue;
      if (actionRe && !actionRe.test(r.a || '')) continue;
      n += r.n || 1;
    }
    return n;
  }

  gbListen(window, 'pagehide', jrnFlush);
  gbListen(document, 'visibilitychange', () => { if (document.hidden) jrnFlush(); });

  const seenThisRun = new Set();

  function seenKey(id) { return String(id); }
