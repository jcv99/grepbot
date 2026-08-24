  // A resource shortage is live state, not a structural failure: it clears as soon
  // as production ticks, a trade lands or a planner reservation is released. If it
  // journals as a hard error, three shortages in a row open a decision-memory skip
  // window and the action stays frozen long after it became affordable.
  // Every planner verdict is live state, never a structural failure:
  // `planner-<res>:have/need` is a shortage, `planner-cost-unknown` /
  // `planner-live-unreadable` / `planner-town-missing` are read failures. Same
  // for `safe-mode-*`, which is our own switch and not the server's answer.
  function jrnTransientDynamicResult(r) {
    const s = String(r || '');
    return /^planner-/i.test(s) || /^safe-mode-/i.test(s);
  }
  function jrnResult(err) {
    if (!err) return 'ok';
    const s = String(err);
    if (JRN_SKIP_ERRS[s.split(':')[0]] || jrnTransientDynamicResult(s)) return 'skip:' + s.slice(0, 40);
    return s.slice(0, 60);
  }
  function jrnPendingResult(r) {
    const s = String(r || '');
    return s === 'timeout_unknown' || /^pending(?::|$)/i.test(s) || /^unknown outcome/i.test(s);
  }
  function jrnHard(r) {
    const s = String(r || '');
    return !!s && s !== 'ok' && s !== 'timeout' && s !== 'captcha'
      && !jrnPendingResult(s) && s.slice(0, 5) !== 'skip:';
  }
  function jrnId(tag) { return tag.f + '|' + tag.a + '|' + tag.k; }
  // Journal keys are world-scoped: a town/village id means nothing on another
  // world, so an unscoped journal would skip valid targets after a world switch.
  let jrnHost = location.hostname;
  function jrnSaveForHost(host) {
    jrnPrune();
    save(STORE.DECISIONS + '@' + host, state.decisions);
    save(STORE.DECISION_SKIPS + '@' + host, state.decisionSkips);
  }
  function jrnCheckHost() {
    if (location.hostname === jrnHost) return;
    // Flush what is still in memory under the world it belongs to. jrnFlush()
    // saves through wkey(), which already reads the NEW hostname — the pending
    // batch would have been written to the new world's key, importing another
    // world's skip windows and town ids wholesale.
    jrnSaveQueued = false;
    try { jrnSaveForHost(jrnHost); } catch (e) { gbLog('journal save-for-host failed (previous world decisions may be lost): ' + String(e).slice(0, 120)); }
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
  // Pre-filter for WRITE features. txRun keys the journal (and therefore the
  // skip window) by {feature, endpoint, txIntent} — jrnTag builds a different
  // key entirely (t<town>:<target>), so a module that pre-filtered with
  // gbSkipActive() was reading a key the trip path never writes: the filter was
  // dead and the loop kept re-announcing an action that txRun then refused.
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
  function jrnPush(tag, result, detail, txId) {
    jrnCheckHost();
    const list = state.decisions;
    const now = Date.now();
    // A transaction has one journal row whose provisional result can later be
    // reconciled. Replacing timeout -> ok avoids counting one SEND twice.
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
        // Remove the provisional row; the terminal result continues through the
        // normal compacting path so repeated successful transactions still use n.
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
      if (r.f !== tag.f || r.a !== tag.a || r.k !== tag.k) continue;
      // Non-provisional rows are keyed by their txId (r.x): two distinct
      // transactions for the same (f,a,k) with the same result must not
      // coalesce, or the counter gets shared across unrelated tx ids. Also
      // walk the full list (capped by JRN_MAX storage below) instead of an
      // arbitrary 40-row window: a burst tick (bandit+spy+send same second)
      // can push the same tag past 40 entries and produce a second counter
      // that should have been one.
      if (r.x != null && id != null && r.x !== id) break;
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
    const mins = backoffFor(trips, JRN_BACKOFF);
    state.decisionSkips[key] = { trips, until: Date.now() + mins * 60000, r: result };
    gbLog(`memory: ${tag.f} ${tag.a} ${tag.k} failed ${JRN_FAIL_TRIP}x (${result}) - skipping ${mins}m`);
    jrnSave(true);
  }
  function jrnSkipped(tag) {
    jrnCheckHost();
    // Recording always runs; only the SKIPPING stands down.
    if (gbNeverStop()) return false;
    if (state.decisionMemory === false) return false;
    const key = jrnId(tag);
    const s = state.decisionSkips[key];
    if (!s || !s.until) return false;
    // Repair windows persisted before jrnTransientDynamicResult existed — a live
    // resource shortage must be re-decided by the precheck, never remembered.
    if (jrnTransientDynamicResult(s.r)) {
      delete state.decisionSkips[key];
      jrnSave();
      gbLogT('memory-transient-clear-' + key, 30000, `memory: cleared transient ${s.r}; live precheck will decide`);
      return false;
    }
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
  // ===== Replay (v4 plan 8.5) ================================================
  // Read-only slice of the decision ring, oldest first - the opposite order to
  // the live log - so a wave can be walked forward in the order it happened.
  function jrnSlice(opts) {
    const o = opts || {};
    const since = Number.isFinite(+o.since) ? +o.since : 0;
    const until = Number.isFinite(+o.until) ? +o.until : Infinity;
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
  // The skip window a row belongs to, if one is open. Pure lookup, no I/O.
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
