  // ---------- decision journal (persistent decision memory) ----------
  // gbLog's ring buffer lives in memory and dies on reload; the per-feature
  // histories (bandit / quest / attack) only cover their own module. Every
  // automated decision lands here instead: which feature acted, on what target,
  // and how it ended. Records are world-scoped, survive reload, and feed the
  // repeat-failure backoff so the bot stops re-posting an action that has
  // already failed the same way three times.
  const JRN_MAX = 400;
  const JRN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const JRN_DEDUP_MS = 10 * 60 * 1000; // same decision+result inside window bumps n
  const JRN_SAVE_MS = 5000; // batch writes: bridge posts fire in waves
  const JRN_FAIL_TRIP = 3; // consecutive identical hard errors before backoff
  const JRN_BACKOFF = [5, 15, 60]; // minutes, same ladder as the captcha breaker
  // Outcomes that mean "never attempted" - they must not count toward a fail
  // streak, or a night pause would look like a broken endpoint.
  const JRN_SKIP_ERRS = { disabled: 1, paused: 1, 'captcha-pause': 1, budget: 1, noajax: 1, remembered: 1, dryrun: 1 };

  // Storage can come back as anything after a bad write / hand edit.
  if (!Array.isArray(state.decisions)) state.decisions = [];
  if (!state.decisionSkips || typeof state.decisionSkips !== 'object') state.decisionSkips = {};

  function jrnResult(err) {
    if (!err) return 'ok';
    const s = String(err);
    if (JRN_SKIP_ERRS[s.split(':')[0]]) return 'skip:' + s.slice(0, 40);
    return s.slice(0, 60);
  }
  // captcha/timeout are handled by their own breaker + retry paths, so they are
  // recorded but never trip the memory backoff.
  function jrnHard(r) {
    return !!r && r !== 'ok' && r !== 'timeout' && r !== 'captcha' && r.slice(0, 5) !== 'skip:';
  }
  function jrnId(tag) { return tag.f + '|' + tag.a + '|' + tag.k; }

  // Derive a stable (feature, action, target) tag from a frontend_bridge payload.
  function jrnTag(feature, payload) {
    let action = '', target = '';
    try {
      const p = payload || {};
      action = p.action_name || p.action || '';
      const mu = String(p.model_url || p.model || '');
      if (mu) {
        const model = mu.split('/')[0] || mu;
        action = action ? model + '/' + action : model;
      }
      const args = p.arguments || {};
      // Prefer specific entity ids over bare town_id (avoids collapsing all town actions).
      target = args.building_id || args.research_id || args.research || args.farm_town_id
        || args.offer_id || args.offer || args.power_id
        || (args.id != null && String(args.id) !== String(p.town_id) ? args.id : '')
        || p.town_id || args.town_id || '';
    } catch (_) {}
    return { f: feature, a: String(action || 'post').slice(0, 48), k: String(target || '-').slice(0, 24) };
  }

  function jrnPrune() {
    const cut = Date.now() - JRN_TTL_MS;
    const list = state.decisions;
    let i = 0;
    while (i < list.length && list[i].ts < cut) i++;
    if (i) list.splice(0, i);
    while (list.length > JRN_MAX) list.shift();
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

  // Record one decision. Identical decision+result inside JRN_DEDUP_MS bumps the
  // repeat counter instead of burning a slot (a night pause would otherwise
  // flush the whole journal in one night).
  function jrnPush(tag, result, detail) {
    const list = state.decisions;
    const now = Date.now();
    for (let i = list.length - 1, seen = 0; i >= 0 && seen < 40; i--, seen++) {
      const r = list[i];
      if (r.f !== tag.f || r.a !== tag.a || r.k !== tag.k) continue;
      if (r.r === result && now - r.ts < JRN_DEDUP_MS) {
        r.n = (r.n || 1) + 1;
        r.ts = now;
        // Move to end so array order tracks recency (I13 - prune/streak/UI).
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

  // Consecutive hard failures for this exact (feature, action, target), newest
  // first, stopping at the last success. Repeats count individually.
  function gbFailStreak(feature, action, target) {
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
  // Most recent decision for a target. action/target may be omitted to widen.
  function gbRecall(feature, action, target) {
    const list = state.decisions;
    for (let i = list.length - 1; i >= 0; i--) {
      const r = list[i];
      if (feature && r.f !== feature) continue;
      if (action && r.a !== action) continue;
      if (target != null && String(r.k) !== String(target)) continue;
      return r;
    }
    return null;
  }
  function gbRecallAll(feature, action, target) {
    return state.decisions.filter(r =>
      (!feature || r.f === feature) &&
      (!action || r.a === action) &&
      (target == null || String(r.k) === String(target)));
  }
  // Feature-facing writer for decisions that never reach bridgePost (a scan that
  // chose to do nothing, a plan that was rejected locally).
  function gbRemember(feature, action, target, result, detail) {
    return jrnPush({ f: feature, a: String(action || 'decide').slice(0, 48), k: String(target == null ? '-' : target).slice(0, 24) },
      jrnResult(result === 'ok' || result == null ? null : result), detail);
  }

  // After every recorded outcome: open, extend, or clear the skip window.
  function jrnNote(tag, result) {
    const key = jrnId(tag);
    if (result === 'ok') {
      if (state.decisionSkips[key]) { delete state.decisionSkips[key]; jrnSave(); }
      return;
    }
    if (!jrnHard(result)) return;
    if (gbFailStreak(tag.f, tag.a, tag.k) < JRN_FAIL_TRIP) return;
    const prev = state.decisionSkips[key] || { trips: 0 };
    if (prev.until && Date.now() < prev.until) return; // window already open
    const trips = Math.min((prev.trips || 0) + 1, JRN_BACKOFF.length);
    const mins = JRN_BACKOFF[trips - 1];
    state.decisionSkips[key] = { trips, until: Date.now() + mins * 60000, r: result };
    gbLog(`memory: ${tag.f} ${tag.a} ${tag.k} failed ${JRN_FAIL_TRIP}x (${result}) - skipping ${mins}m`);
    jrnSave(true);
  }
  // True when this exact decision is inside its backoff window. Trips decay on
  // expiry so a fixed endpoint does not stay stuck at 60m forever.
  function jrnSkipped(tag) {
    if (state.decisionMemory === false) return false;
    const s = state.decisionSkips[jrnId(tag)];
    if (!s || !s.until) return false;
    if (Date.now() >= s.until) {
      s.trips = Math.max(0, (s.trips || 1) - 1);
      delete s.until;
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

  // ---------- rollups (v1.4.0) ----------
  // The journal already holds every outcome; nothing reads it in aggregate.
  // These feed the Stats tab: per-feature reliability, what is failing, and
  // which skip reason is actually eating the schedule.
  function jrnStats(windowMs) {
    const since = Date.now() - (windowMs || 24 * 60 * 60 * 1000);
    const byFeature = Object.create(null);
    const bySkip = Object.create(null);
    const byError = Object.create(null);
    let ok = 0, err = 0, captcha = 0, skip = 0, timeout = 0, dry = 0, total = 0;
    for (const r of (state.decisions || [])) {
      if (r.ts < since) continue;
      const n = r.n || 1;
      total += n;
      const f = byFeature[r.f] || (byFeature[r.f] = { ok: 0, err: 0, captcha: 0, skip: 0, timeout: 0, n: 0, last: 0 });
      f.n += n;
      f.last = Math.max(f.last, r.ts);
      const res = String(r.r || '');
      if (res === 'ok') { ok += n; f.ok += n; }
      else if (res === 'captcha') { captcha += n; f.captcha += n; }
      else if (res === 'timeout') { timeout += n; f.timeout += n; }
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
    return {
      windowMs: windowMs || 86400000,
      total, ok, err, captcha, skip, timeout, dry, attempts,
      successPct: attempts ? Math.round(ok / attempts * 100) : null,
      byFeature, topSkips, topErrors,
    };
  }
  // Count of a specific successful action (e.g. farm claims) inside a window.
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

  // Pending batched write must not die with the tab or with a re-inject dispose.
  gbListen(window, 'pagehide', jrnFlush);
  gbListen(document, 'visibilitychange', () => { if (document.hidden) jrnFlush(); });
