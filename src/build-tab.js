  // ---------- instant build: auto-complete free building + research orders ----------
  // BuildingOrder / ResearchOrder models live in the page context, so all access
  // goes through gameUw() (MM collection first, GPWindowMgr._collections
  // fallback). FREE path only: model price must be exactly 0 and remaining time
  // below threshold (server clock). Never auto-fallback to buyInstant (gold).
  const IB_CHECK_MS = 10000;
  const IB_FREE_ACTIONS = new Set(['completeInstant', 'finishInstantly']);
  function ibFreeThresh() { return state.ibFreeThresh || 300; } // seconds - Grepolis free-complete threshold (~5min)
  // Instant-buy gold from GameDataInstantBuy price table (same as queue buttons).
  // kind: 'build'|'research'; seconds = timeLeft (active) or full duration (queued).
  // null = unknown - never treat as free.
  function ibGoldCost(kind, seconds) {
    try {
      const uw = uwCached();
      const gdi = uw.GameDataInstantBuy;
      if (!gdi || typeof gdi.getPriceForType !== 'function') return null;
      const type = kind === 'research' ? 'research' : 'building';
      const price = gdi.getPriceForType(type, Math.max(0, +seconds || 0));
      return Number.isFinite(+price) ? +price : null;
    } catch (_) { return null; }
  }
  function ibIsFreeOrder(doneAt, timeLeft, gold) {
    return !!doneAt && timeLeft <= ibFreeThresh() && gold === 0;
  }
  function ibOrderStillPresent(orderId) {
    return ibOrders().some(o => String(o.id) === String(orderId));
  }
  function ibFindLiveOrder(orderId, kind) {
    return ibOrders().find(o => String(o.id) === String(orderId) && (kind == null || o.kind === kind)) || null;
  }
  function ibUnknownActionErr(err) {
    return /unknown.?action|invalid.?action|action.?not.?found|does.?not.?exist|no.?such.?action/i.test(String(err || ''));
  }
  function ibTownNames(uw) {
    const names = {};
    try { (townsFromGame() || []).forEach(t => { names[t.id] = t.name; }); } catch (_) {}
    try {
      const gpCols = uw.GPWindowMgr && uw.GPWindowMgr._collections;
      if (gpCols && gpCols.towns && gpCols.towns.models) {
        gpCols.towns.models.forEach(tm => {
          const a = tm.attributes || tm;
          if (a.id != null && !names[a.id] && a.name) names[a.id] = a.name;
        });
      }
    } catch (_) {}
    return names;
  }
  // Academy research orders: MM collection first, GPWindowMgr research_orders* fallback.
  function ibResearchOrders(names) {
    const now = gameNow();
    const out = [];
    const uw = uwCached();
    const cols = ibTownCollections('research');
    try {
      const col = mmCol('ResearchOrder');
      if (col && col.models && col.models.length) cols.push(col);
    } catch (_) {}
    if (!cols.length) {
      let gpCols = null;
      try { gpCols = uw.GPWindowMgr && uw.GPWindowMgr._collections; } catch (_) {}
      if (gpCols) {
        Object.keys(gpCols).forEach(k => {
          if (k.indexOf('research_orders') === 0 && gpCols[k] && gpCols[k].models) cols.push(gpCols[k]);
        });
      }
    }
    if (!cols.length) return out;
    const firstSeen = new Set();
    const seenIds = new Set();
    cols.forEach(col => {
      (col.models || []).forEach(model => {
        const r = model.attributes || model;
        if (!r.id || !r.town_id || seenIds.has(r.id)) return;
        seenIds.add(r.id);
        const doneAt = r.to_be_completed_at || r.toBeCompletedAt || r.completed_at || 0;
        const timeLeft = doneAt ? Math.max(0, doneAt - now) : (r.research_time || 0);
        const isFirst = !firstSeen.has(r.town_id);
        firstSeen.add(r.town_id);
        const display = isFirst ? timeLeft : (r.research_time || 0);
        const gold = ibGoldCost('research', display);
        out.push({
          id: r.id,
          kind: 'research',
          modelUrl: 'ResearchOrder/' + r.id,
          town_id: r.town_id,
          townName: names[r.town_id] || ('Town ' + r.town_id),
          type: 'res:' + (r.research_type || r.research_id || '?'),
          display,
          active: isFirst,
          isFree: ibIsFreeOrder(doneAt, timeLeft, gold),
          gold,
        });
      });
    });
    return out;
  }
  // Per-town building order collections. The MM `BuildingOrder` collection only
  // carries loaded towns, so free orders in the other towns were never seen;
  // ITowns holds every town and `buildingOrders()` is the same path abQueueInfo
  // already uses successfully town-by-town.
  function ibTownCollections(kind) {
    const out = [];
    let ids = [];
    try { ids = abTownIds() || []; } catch (_) {}
    ids.forEach(id => {
      let t = null;
      try { t = abGetTown(id); } catch (_) {}
      if (!t) return;
      let col = null;
      try {
        if (kind === 'research') col = t.researchOrders ? t.researchOrders() : null;
        else col = t.buildingOrders ? t.buildingOrders() : null;
      } catch (_) { col = null; }
      if (col && col.models && col.models.length) out.push(col);
    });
    return out;
  }
  function ibTownCoverage() {
    let ids = [];
    try { ids = abTownIds() || []; } catch (_) {}
    let readable = 0;
    ids.forEach(id => {
      try {
        const t = abGetTown(id);
        if (t && typeof t.buildingOrders === 'function' && t.buildingOrders()) readable++;
      } catch (_) {}
    });
    return { readable, total: ids.length };
  }
  function ibOrders() {
    const now = gameNow();
    const out = [];
    const uw = uwCached();
    const names = ibTownNames(uw);
    const research = state.ibResearch ? ibResearchOrders(names) : [];
    let candidates = [], src = null;
    const perTown = ibTownCollections('build');
    if (perTown.length) { candidates = candidates.concat(perTown); src = 'ITowns'; }
    try {
      const col = mmCol('BuildingOrder');
      if (col && col.models && col.models.length) { candidates.push(col); src = src ? src + '+MM' : 'MM'; }
    } catch (_) {}
    let gpCols = null;
    try { gpCols = uw.GPWindowMgr && uw.GPWindowMgr._collections; } catch (_) {}
    if (!candidates.length && gpCols) {
      if (gpCols.building_orders && gpCols.building_orders.models) candidates.push(gpCols.building_orders);
      Object.keys(gpCols).forEach(k => {
        if (k.indexOf('building_orders_') === 0 && gpCols[k] && gpCols[k].models) candidates.push(gpCols[k]);
      });
      if (candidates.length) src = 'GPWindowMgr';
    }
    if (!candidates.length) return out.concat(research);
    gbLogT('ib-src', 300000, 'build orders source: ' + src);
    const firstSeen = new Set();
    const seenIds = new Set();
    candidates.forEach(col => {
      (col.models || []).forEach(model => {
        const r = model.attributes || model;
        if (!r.id || !r.town_id || seenIds.has(r.id)) return;
        seenIds.add(r.id);
        // Prefer named completion fields; never treat missing as "free"
        const doneAt = r.to_be_completed_at || r.toBeCompletedAt || r.completed_at || 0;
        const timeLeft = doneAt ? Math.max(0, doneAt - now) : (r.building_time || 0);
        const isFirst = !firstSeen.has(r.town_id);
        firstSeen.add(r.town_id);
        const display = isFirst ? timeLeft : (r.building_time || 0);
        const gold = ibGoldCost('build', display);
        out.push({
          id: r.id,
          kind: 'build',
          modelUrl: 'BuildingOrder/' + r.id,
          town_id: r.town_id,
          townName: names[r.town_id] || ('Town ' + r.town_id),
          type: r.building_type || '?',
          display,
          active: isFirst,
          isFree: ibIsFreeOrder(doneAt, timeLeft, gold),
          gold,
        });
      });
    });
    return out.concat(research);
  }
  function ibActionFor(kind) {
    const raw = kind === 'research'
      ? (state.ibActionR || 'completeInstant')
      : (state.ibAction || 'completeInstant');
    // Never use a premium action for the free-complete path
    if (/buyInstant|buy_instant/i.test(String(raw))) return 'completeInstant';
    return raw;
  }
  function ibLearnAction(kind, action) {
    // Refuse to persist premium actions as the free-complete default
    if (/buyInstant|buy_instant/i.test(String(action || ''))) {
      gbLogT('ib-learn-refuse', 60000, 'instant: refusing to learn premium action ' + action);
      return;
    }
    if (!IB_FREE_ACTIONS.has(String(action))) {
      gbLogT('ib-learn-refuse', 60000, 'instant: unknown free action ' + action + ' - learn manually via free click');
      return;
    }
    if (kind === 'research') { state.ibActionR = action; save(wkey(STORE.IB_ACTION_R), action); }
    else { state.ibAction = action; save(wkey(STORE.IB_ACTION), action); }
  }
  // Payload shape that jrnTag() keys on, without posting anything. The journal
  // target for this payload is the TOWN (arguments.order_id is not one of the
  // ids jrnTag prefers), so one hard failure silences every free order of that
  // town - which is exactly what the pre-check has to see.
  function ibJrnPayload(order) {
    const kind = order.kind || 'build';
    return {
      model_url: order.modelUrl || ((kind === 'research' ? 'ResearchOrder/' : 'BuildingOrder/') + order.id),
      action_name: ibActionFor(kind),
      arguments: { order_id: order.id },
      town_id: order.town_id,
    };
  }
  // Both free actions rejected as unknown: the learned name is the only variable
  // left, so drop it and let ibActionFor fall back to the constant next scan.
  // Otherwise every free order for the rest of the session burns budget on a
  // payload this client already refused.
  function ibResetLearnedAction(kind, err) {
    if (!ibUnknownActionErr(err)) return;
    const cur = kind === 'research' ? state.ibActionR : state.ibAction;
    if (!cur) return;
    if (kind === 'research') { state.ibActionR = null; save(wkey(STORE.IB_ACTION_R), null); }
    else { state.ibAction = null; save(wkey(STORE.IB_ACTION), null); }
    gbLogT('ib-relearn', 60000,
      'instant: learned action ' + cur + ' rejected - reset to default, hand-click one free complete to re-learn');
  }
  function ibComplete(order) {
    return new Promise(resolve => {
      if (!hostEnabled() || captchaPaused('build')) { resolve('pause'); return; }
      const kind = order.kind || 'build';
      const tag = kind === 'research' ? 'instant-research' : 'instant-build';
      // Re-read live model immediately before post - snapshot may be stale
      const live = ibFindLiveOrder(order.id, kind);
      if (!live || !live.isFree) {
        gbLogT('ib-stale', 30000, `${tag}: #${order.id} no longer free (gold=${live && live.gold})`);
        resolve('skip');
        return;
      }
      const modelUrl = live.modelUrl || order.modelUrl || ('BuildingOrder/' + order.id);
      const action = ibActionFor(kind);
      const finishOk = () => {
        // Reconcile: order must disappear (or no longer be free) before success
        if (ibOrderStillPresent(order.id)) {
          gbLog(`${tag}: ${live.type} #${order.id} response OK but order still present - unknown_outcome`);
          resolve('unknown');
          return;
        }
        gbLog(`${tag}: ${live.type} #${order.id} OK`);
        resolve('ok');
      };
      const goneOk = (why) => {
        if (ibOrderStillPresent(order.id)) return false;
        gbLogT('ib-stale', 30000, `${tag}: #${order.id} ${why} but order gone - OK`);
        resolve('ok');
        return true;
      };
      const postFree = (actionName, isFallback) => {
        bridgePost('build', {
          model_url: modelUrl,
          action_name: actionName,
          captcha: null,
          arguments: { order_id: order.id },
          town_id: live.town_id,
        }, (err, data) => {
          // Soft outcomes: reconcile first — never retry / buyInstant on these
          if (err === 'captcha' || err === 'captcha-pause') {
            if (!goneOk(err)) resolve('captcha');
            return;
          }
          if (err === 'timeout' || err === 'remembered' || err === 'paused') {
            if (goneOk(err)) return;
            if (err === 'timeout') {
              gbLog(`${tag}: #${order.id} timeout_unknown - no fallback`);
              resolve('unknown');
            } else if (err === 'remembered') {
              gbLogT('ib-remembered-' + order.id, 60000,
                `${tag}: #${order.id} skipped from memory`);
              resolve('err');
            } else {
              resolve('err');
            }
            return;
          }
          // Deterministic "unknown action" only: try finishInstantly once, never buyInstant
          if (err && !isFallback && actionName === 'completeInstant' && ibUnknownActionErr(err)) {
            const again = ibFindLiveOrder(order.id, kind);
            if (!again || !again.isFree || again.gold !== 0) {
              gbLog(`${tag}: completeInstant unknown, order no longer free - inactive`);
              resolve('err');
              return;
            }
            gbLog(`${tag}: completeInstant unknown - trying finishInstantly (gold=0 only)`);
            postFree('finishInstantly', true);
            return;
          }
          // Local gates: nothing was posted, so this is not evidence about the
          // payload. Throttle them and never charge them to the fallback logic.
          if (err === 'tpl-stale' || err === 'budget' || err === 'disabled' || err === 'dryrun') {
            gbLogT('ib-gate-' + err, 60000, `${tag}: #${order.id} not sent (${err})`);
            resolve('skip');
            return;
          }
          if (err) {
            if (isFallback) ibResetLearnedAction(kind, err);
            gbLog(tag + ' complete error: ' + err);
            resolve('err');
            return;
          }
          if (data && data.error) {
            gbLog(`${tag}: ${live.type} #${order.id} ERR ` + JSON.stringify(data).slice(0, 120));
            resolve('err');
            return;
          }
          finishOk();
        });
      };
      postFree(action, false);
    });
  }
  function ibCompleteAll(orders) {
    if (gbLocked('ib')) return;
    const free = (orders || ibOrders()).filter(o => o.isFree);
    if (!free.length) return;
    gbLock('ib');
    renderBuild();
    let i = 0, done = 0, captcha = false;
    const unlock = () => { gbUnlock('ib'); };
    // Hard unlock if chain stalls (bridge timeout x N + slack)
    const watchdog = gbTimeout(unlock, Math.max(30000, free.length * (BRIDGE_TIMEOUT_MS + 1000)));
    (function next() {
      if (i >= free.length || captcha) {
        try { clearTimeout(watchdog); } catch (_) {}
        unlock();
        gbLogT('ib-batch-done', 60000,
          `instant: completed ${done}/${free.length}${captcha ? ' (captcha abort)' : ''}`);
        if (done) { flash(`instantánea x${done}`); gbTimeout(ibScan, 3000); }
        return;
      }
      ibComplete(free[i]).then(res => {
        if (res === 'ok') done++;
        if (res === 'captcha') captcha = true;
        i++;
        gbTimeout(next, 400 + Math.random() * 200);
      });
    })();
  }
  // ---------- precise arming ----------
  // A 10s poll catches the free window anywhere in the first 10s (worse in a
  // background tab, where the interval is clamped to ~60s). So schedule one
  // timer on the nearest order still counting down to its free point: it lands
  // the post at ~4:58 remaining. The interval stays as the safety net - this
  // timer only ever *accelerates* a scan, it never gates one.
  let ibFreeTimer = null;
  let ibFreeArmedAt = 0;
  function ibArmedAt() { return ibFreeArmedAt; }
  function ibArmNext(orders) {
    const now = Date.now();
    const thresh = ibFreeThresh() * 1000;
    let best = 0;
    (orders || []).forEach(o => {
      // Only the active order of each town is counting down; a queued order
      // reports its full build time and its clock has not started yet.
      if (o.isFree || !o.active || !(o.display > 0)) return;
      const armIn = (o.display * 1000) - thresh;
      if (armIn <= 0) return;
      const at = now + armIn;
      if (!best || at < best) best = at;
    });
    if (!best) {
      if (ibFreeTimer) { try { clearTimeout(ibFreeTimer); } catch (_) {} }
      ibFreeTimer = null;
      ibFreeArmedAt = 0;
      return;
    }
    // +1.2s so the server clock is past the boundary, plus jitter.
    const fireAt = best + 1200 + Math.floor(Math.random() * 1500);
    if (ibFreeTimer && ibFreeArmedAt && Math.abs(ibFreeArmedAt - fireAt) < 3000) return;
    if (ibFreeTimer) { try { clearTimeout(ibFreeTimer); } catch (_) {} }
    ibFreeArmedAt = fireAt;
    ibFreeTimer = gbTimeout(() => {
      ibFreeTimer = null;
      ibFreeArmedAt = 0;
      ibScan();
    }, Math.max(500, fireAt - now));
    gbLogT('ib-arm', 60000, `instant: armed in ${fmtSec((fireAt - now) / 1000)} (free window at <=${ibFreeThresh()}s)`);
  }
  function ibScan() {
    const orders = ibOrders();
    renderBuild(orders);
    ibArmNext(orders);
    if (!state.ibAuto || gbLocked('ib')) return;
    const free = orders.filter(o => o.isFree);
    if (!free.length) return;
    // Drop orders whose post is already inside a decisionSkips window BEFORE
    // announcing the batch. The scan re-fires every 1-3s (10s interval + armed
    // timer + visibilitychange + click hook) and the order stays free until the
    // real countdown ends, so without this every window produced a wall of
    // "free order(s), auto-completing" / "completed 0/N" with zero progress.
    const live = free.filter(o => {
      const why = gbSkipActive('build', ibJrnPayload(o));
      if (!why) return true;
      gbLogT('ib-mem-' + o.town_id, 60000, `instant: #${o.id} skipped from memory (${why})`);
      return false;
    });
    if (!live.length) return;
    gbLog(`instant: ${live.length} free order(s), auto-completing`);
    ibCompleteAll(live);
  }
  function renderBuild(cached) {
    const sec = panel && panel.querySelector('section[data-tab=build]');
    if (!sec || sec.hidden) return;
    const rows = sec.querySelector('.ib-rows');
    const btn = sec.querySelector('#gb-ib-btn');
    const status = sec.querySelector('#gb-ib-status');
    const dot = sec.querySelector('#gb-ib-dot');
    const orders = cached || ibOrders();
    rows.replaceChildren();
    if (!orders.length) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#888;padding:6px 0;font-size:11px';
      e.textContent = 'sin órdenes activas de construcción/investigación';
      rows.appendChild(e);
      dot.className = 'ib-dot';
      btn.disabled = true;
      status.textContent = gbLocked('ib') ? 'completando...' : '';
      renderAbQueue();
      return;
    }
    const byTown = new Map();
    let hasFree = false;
    orders.forEach(o => {
      if (o.isFree) hasFree = true;
      if (!byTown.has(o.townName)) byTown.set(o.townName, []);
      byTown.get(o.townName).push(o);
    });
    dot.className = 'ib-dot ' + (hasFree ? 'free' : 'paid');
    btn.disabled = !hasFree || gbLocked('ib');
    const mk = (cls, txt) => { const s = document.createElement('span'); s.className = cls; s.textContent = txt; return s; };
    for (const [town, ords] of byTown) {
      const t = document.createElement('div');
      t.className = 'ib-town';
      t.textContent = town;
      rows.appendChild(t);
      ords.forEach(o => {
        const r = document.createElement('div');
        r.className = 'ib-row';
        r.appendChild(mk('ib-type', o.type));
        r.appendChild(mk('ib-time', fmtHMS(o.display)));
        r.appendChild(mk(o.isFree ? 'ib-free' : 'ib-cost',
          o.isFree ? 'GRATIS' : (o.gold != null ? o.gold + ' oro' : '? oro')));
        rows.appendChild(r);
      });
    }
    status.textContent = (gbLocked('ib') ? 'completando... ' : '') + 'último escaneo: ' + new Date().toLocaleTimeString();
    renderAbQueue();
  }

  // ---------- auto-queue builds (buildUp via bridge) ----------
  // CS-fast targets from wiki CS-ready guides: academy 28, docks 20, farm 22,
  // storage 20, main 15; mines capped ~15-20 (income mainly from farms).
  const AB_BUILDINGS = ['main', 'storage', 'farm', 'academy', 'temple', 'barracks', 'docks', 'market', 'hide', 'lumber', 'stoner', 'ironer', 'wall'];
  const AB_LABELS = {
    main: 'Senado', storage: 'Almacén', farm: 'Granja', academy: 'Academia',
    temple: 'Templo', barracks: 'Cuartel', docks: 'Puerto', market: 'Mercado',
    hide: 'Cueva', lumber: 'Aserradero', stoner: 'Cantera', ironer: 'Mina de plata', wall: 'Muralla',
  };
  const AB_CS_FAST = {
    main: 15, storage: 20, farm: 22, academy: 28, docks: 20,
    barracks: 10, temple: 5, market: 10, hide: 10,
    lumber: 15, stoner: 15, ironer: 15, wall: 10,
  };
  // Phased priority: within a phase, first building still below phase/target wins.
  const AB_PHASES = [
    { lumber: 3, stoner: 3, ironer: 3, farm: 4, storage: 4 },
    { main: 5, barracks: 5, temple: 3, storage: 5 },
    { farm: 8, main: 8, market: 6, storage: 8, academy: 7 },
    { farm: 15, storage: 15, main: 15, hide: 10 },
    { barracks: 10, docks: 10, academy: 13 },
    { academy: 28, docks: 20, farm: 22, storage: 20 },
    { lumber: 15, stoner: 15, ironer: 15, market: 10, temple: 5, wall: 10 },
  ];
  const AB_CHECK_MS = 30000;
  const AB_FILL_BATCH = 6; // how many to add when 1 left (capped by queue max)
  const AB_EXTRA_MS = 5 * 60 * 1000; // +5min after half construction
  function abRandMs() { return Math.floor(Math.random() * 3 * 60 * 1000); } // 0-3min jitter

  // ---------- build-phase planner v2 (heuristic — not game truth) ----------
  // One explicit weight table; resist per-world tuning sprawl.
  const AB_PHASE_WEIGHT = {
    lumber: 1.25, stoner: 1.25, ironer: 1.25,
    storage: 1.35, farm: 1.45,
    main: 1.05, market: 0.95, hide: 0.85, temple: 0.75, wall: 0.65,
    academy: 1.15, docks: 1.1,
    barracks: 0.9,
  };
  const AB_ETA_UNKNOWN_MS = 24 * 3600 * 1000;
  const AB_ETA_POP_BLOCK_MS = 7 * 86400000;
  function phaseWeight(building, levels) {
    let w = AB_PHASE_WEIGHT[building] || 1;
    const lv = levels && levels[building] != null ? levels[building] : 0;
    // Early game nudge: mines + warehouse before military.
    if (lv < 8 && (building === 'lumber' || building === 'stoner' || building === 'ironer' || building === 'storage')) w *= 1.15;
    // Mid game nudge: academy/harbour once core infra is up.
    const core = ((levels && levels.main) || 0) + ((levels && levels.storage) || 0);
    if (core >= 12 && (building === 'academy' || building === 'docks')) w *= 1.12;
    // Late game nudge: barracks/docks when academy is mature.
    if (((levels && levels.academy) || 0) >= 20 && (building === 'barracks' || building === 'docks')) w *= 1.08;
    return w;
  }
  function abGetPin(townId) {
    if (!state.abBuildPin || typeof state.abBuildPin !== 'object') return null;
    const p = state.abBuildPin[String(townId)];
    return p || null;
  }
  function abSetPin(townId, building) {
    if (!state.abBuildPin || typeof state.abBuildPin !== 'object') state.abBuildPin = {};
    if (!building) {
      delete state.abBuildPin[String(townId)];
    } else {
      state.abBuildPin[String(townId)] = building;
    }
    save(STORE.BUILD_PIN, state.abBuildPin);
  }
  // ---------- custom per-town build queue ----------
  // An explicit ordered list beats the weight/ETA heuristic: entries are consumed
  // top-down and only the tail of the plan falls back to abPlanCandidates scoring.
  // World-scoped (STORE.AB_CUSTOM_Q is in WORLD_SCOPED_BASES) - a town id means
  // nothing on another world.
  function abCqSave() { save(STORE.AB_CUSTOM_Q, state.abCustomQueue || {}); }
  function abCqGet(townId) {
    if (!state.abCustomQueue || typeof state.abCustomQueue !== 'object') state.abCustomQueue = {};
    const list = state.abCustomQueue[String(townId)];
    return Array.isArray(list) ? list : [];
  }
  function abCqSet(townId, list) {
    if (!state.abCustomQueue || typeof state.abCustomQueue !== 'object') state.abCustomQueue = {};
    const clean = (list || []).filter(e => e && AB_BUILDINGS.indexOf(e.b) !== -1);
    if (clean.length) state.abCustomQueue[String(townId)] = clean;
    else delete state.abCustomQueue[String(townId)];
    abCqSave();
  }
  function abCqAdd(townId, building, lvl) {
    if (AB_BUILDINGS.indexOf(building) === -1) return;
    const list = abCqGet(townId).slice();
    list.push({ b: building, lvl: lvl == null ? null : abClampTarget(building, lvl) });
    abCqSet(townId, list);
  }
  function abCqRemove(townId, idx) {
    const list = abCqGet(townId).slice();
    if (idx < 0 || idx >= list.length) return;
    list.splice(idx, 1);
    abCqSet(townId, list);
  }
  function abCqMove(townId, idx, dir) {
    const list = abCqGet(townId).slice();
    const to = idx + dir;
    if (idx < 0 || idx >= list.length || to < 0 || to >= list.length) return;
    const tmp = list[idx];
    list[idx] = list[to];
    list[to] = tmp;
    abCqSet(townId, list);
  }
  // An entry without an explicit level means "+1 from where the town is now";
  // resolve against the *simulated* levels so repeated entries stack.
  function abCqWantLevel(entry, levels) {
    const cur = +((levels && levels[entry.b]) || 0);
    const want = entry.lvl == null ? cur + 1 : +entry.lvl;
    return Math.min(want, abMaxLevel(entry.b));
  }
  // Satisfied entries (level reached - abCurrentLevels already counts queued
  // orders) drop off the list, so the queue needs no manual pruning.
  function abCqPrune(townId, levels) {
    if (!levels) return;
    const list = abCqGet(townId);
    if (!list.length) return;
    const keep = [];
    let dropped = 0;
    const sim = Object.assign({}, levels);
    list.forEach(e => {
      const want = abCqWantLevel(e, sim);
      if ((sim[e.b] || 0) >= want) { dropped++; return; }
      sim[e.b] = want;
      keep.push(e);
    });
    if (!dropped) return;
    abCqSet(townId, keep);
    gbLog(`auto-queue: town ${townId} custom queue - ${dropped} done, ${keep.length} left`);
  }
  function abTownProduction(townId) {
    const t = abGetTown(townId);
    if (!t) return null;
    try {
      const fn = t.getResourcesPerHour || t.getResourceProduction;
      if (typeof fn === 'function') {
        const r = fn.call(t);
        if (r && (r.wood != null || r.stone != null || r.iron != null)) {
          return { wood: +r.wood || 0, stone: +r.stone || 0, iron: +r.iron || 0 };
        }
      }
    } catch (_) {}
    try {
      const r = t.resources && t.resources();
      if (r) {
        const wood = +(r.wood_production || r.woodProduction || 0);
        const stone = +(r.stone_production || r.stoneProduction || 0);
        const iron = +(r.iron_production || r.ironProduction || 0);
        if (wood || stone || iron) return { wood, stone, iron };
      }
    } catch (_) {}
    const wood = gbProbeNum(t, ['getWoodProduction', 'getWoodPerHour', 'getProductionWood']);
    const stone = gbProbeNum(t, ['getStoneProduction', 'getStonePerHour', 'getProductionStone']);
    const iron = gbProbeNum(t, ['getIronProduction', 'getIronPerHour', 'getProductionIron']);
    if (wood != null || stone != null || iron != null) {
      return { wood: wood || 0, stone: stone || 0, iron: iron || 0 };
    }
    return null;
  }
  function abScratchStart(townId) {
    const st = townResState(townId);
    return {
      wood: st ? st.wood : null,
      stone: st ? st.stone : null,
      iron: st ? st.iron : null,
      pop: gbTownPop(townId),
      production: abTownProduction(townId),
    };
  }
  function abAffordScratch(scratch, cost, margin) {
    const m = margin != null ? +margin : 0;
    if (!cost) return { ok: true, blind: true, short: [], detail: 'no cost data' };
    const short = [];
    let blind = false;
    ['wood', 'stone', 'iron'].forEach(k => {
      const need = +cost[k] || 0;
      if (need <= 0) return;
      const have = scratch[k];
      if (have == null) { blind = true; return; }
      if (have < need + m) short.push(`${k} ${Math.floor(have)}/${need}`);
    });
    const needPop = +cost.pop || 0;
    if (needPop > 0) {
      if (scratch.pop == null) blind = true;
      else if (scratch.pop < needPop) short.push(`pop ${scratch.pop}/${needPop}`);
    }
    return { ok: short.length === 0, blind, short, detail: short.join(', ') };
  }
  function abEtaMs(scratch, afford) {
    if (afford.ok || afford.blind) return 0;
    const prod = scratch.production;
    let maxMs = 60000;
    (afford.short || []).forEach(s => {
      if (s.startsWith('pop ')) {
        maxMs = Math.max(maxMs, AB_ETA_POP_BLOCK_MS);
        return;
      }
      const m = s.match(/^(wood|stone|iron)\s+(\d+)\/(\d+)/);
      if (!m) return;
      const res = m[1];
      const have = +m[2];
      const need = +m[3];
      const deficit = need - have + 10;
      if (deficit <= 0) return;
      const rate = prod && prod[res];
      if (!(rate > 0)) {
        maxMs = Math.max(maxMs, AB_ETA_UNKNOWN_MS);
        return;
      }
      maxMs = Math.max(maxMs, (deficit / rate) * 3600000);
    });
    return maxMs;
  }
  function abQueueWaitMs(townId) {
    const q = abQueueInfo(townId);
    const now = gameNow();
    let wait = 0;
    q.orders.forEach(o => {
      const done = o.to_be_completed_at;
      if (done > now) wait += (done - now) * 1000;
      else wait += Math.max(0, o.building_time || 0) * 1000;
    });
    return wait;
  }
  function abPlanCandidates(levels) {
    const targets = abEnsureTargets();
    const out = [];
    AB_BUILDINGS.forEach(building => {
      const want = Math.min(targets[building] != null ? targets[building] : 0, abMaxLevel(building));
      if (want <= 0) return;
      if (levels[building] < want) out.push({ building, level: levels[building] + 1 });
    });
    return out;
  }
  function abScratchApply(scratch, cost) {
    if (!cost) return;
    if (scratch.wood != null) scratch.wood -= +cost.wood || 0;
    if (scratch.stone != null) scratch.stone -= +cost.stone || 0;
    if (scratch.iron != null) scratch.iron -= +cost.iron || 0;
    if (scratch.pop != null) scratch.pop -= +cost.pop || 0;
  }
  function abPlanEntryAfford(townId, building, scratch) {
    const raw = abBuildingCost(townId, building);
    const cost = raw ? {
      wood: raw.wood, stone: raw.stone, iron: raw.iron, pop: raw.pop || 0,
      buildTime: raw.buildTime,
    } : null;
    const afford = scratch
      ? abAffordScratch(scratch, cost, 10)
      : gbAfford(townId, cost ? { wood: cost.wood, stone: cost.stone, iron: cost.iron, population: cost.pop } : null, { margin: 10 });
    if (afford.blind) {
      gbLogT('ab-plan-blind', 300000, 'build plan: blind cost read - scoring as affordable');
    }
    return { cost, afford };
  }
  function buildPlanNext(townId, n) {
    n = n || 3;
    const levels = abCurrentLevels(townId);
    if (!levels) return [];
    const simLevels = Object.assign({}, levels);
    const scratch = abScratchStart(townId);
    let queueWait = abQueueWaitMs(townId);
    const plan = [];
    const pin = abGetPin(townId);
    // Custom queue owns the head of the plan; the heuristic fills what is left.
    const custom = abCqGet(townId).slice();
    if (custom.length && pin) {
      gbLogT('ab-cq-pin-' + townId, 300000,
        `auto-queue: town ${townId} has a custom queue - pin ${pin} ignored`);
    }
    let ci = 0;
    for (let slot = 0; slot < n; slot++) {
      // Walk past entries the simulation already satisfied (queued or built).
      while (ci < custom.length && (simLevels[custom[ci].b] || 0) >= abCqWantLevel(custom[ci], simLevels)) ci++;
      if (ci < custom.length) {
        const entry = custom[ci];
        const want = abCqWantLevel(entry, simLevels);
        const { cost, afford } = abPlanEntryAfford(townId, entry.b, scratch);
        const etaMs = abEtaMs(scratch, afford);
        plan.push({
          building: entry.b, level: (simLevels[entry.b] || 0) + 1,
          cost, afford, etaMs, score: Infinity, custom: true, cqTarget: want,
        });
        abScratchApply(scratch, cost);
        simLevels[entry.b] = (simLevels[entry.b] || 0) + 1;
        queueWait += cost && cost.buildTime ? Math.max(0, cost.buildTime) * 1000 : 0;
        continue;
      }
      const candidates = abPlanCandidates(simLevels);
      if (!candidates.length) break;
      const popBlockedExists = candidates.some(c => {
        const { afford } = abPlanEntryAfford(townId, c.building, scratch);
        return !afford.ok && !afford.blind && (afford.short || []).some(s => s.startsWith('pop '));
      });
      let pick = null;
      if (slot === 0 && pin) {
        const pinned = candidates.find(c => c.building === pin);
        if (pinned) {
          const { cost, afford } = abPlanEntryAfford(townId, pinned.building, scratch);
          const etaMs = abEtaMs(scratch, afford);
          pick = Object.assign({}, pinned, { cost, afford, etaMs, score: Infinity, pinned: true });
        }
      }
      if (!pick) {
        let bestScore = -1;
        candidates.forEach(cand => {
          const { cost, afford } = abPlanEntryAfford(townId, cand.building, scratch);
          let etaMs = abEtaMs(scratch, afford);
          let weight = phaseWeight(cand.building, simLevels);
          if (popBlockedExists) {
            if (cand.building === 'farm') weight *= 3;
            else if (!afford.ok && !afford.blind && (afford.short || []).some(s => s.startsWith('pop '))) {
              etaMs += AB_ETA_POP_BLOCK_MS;
            }
          }
          const score = weight / (etaMs + queueWait + 60000);
          if (score > bestScore) {
            bestScore = score;
            pick = Object.assign({}, cand, { cost, afford, etaMs, score });
          }
        });
      }
      if (!pick) break;
      plan.push(pick);
      abScratchApply(scratch, pick.cost);
      simLevels[pick.building] = (simLevels[pick.building] || 0) + 1;
      const btMs = pick.cost && pick.cost.buildTime ? Math.max(0, pick.cost.buildTime) * 1000 : 0;
      queueWait += btMs;
    }
    return plan;
  }
  const AB_RES_ES = { wood: 'madera', stone: 'piedra', iron: 'plata', pop: 'pob' };
  function abPlanVerdictLabel(afford) {
    if (!afford) return '?';
    if (afford.ok) return 'ok';
    if (afford.blind) return 'a ciegas';
    // detail keys stay in the parser's language (abEtaMs matches wood|stone|iron|pop)
    if (afford.detail) return 'falta ' + afford.detail.replace(/\b(wood|stone|iron|pop)\b/g, m => AB_RES_ES[m]);
    return 'falta';
  }
  function abPlanCostLabel(cost) {
    if (!cost) return '?';
    const parts = [];
    if (cost.wood) parts.push('w' + cost.wood);
    if (cost.stone) parts.push('s' + cost.stone);
    if (cost.iron) parts.push('i' + cost.iron);
    if (cost.pop) parts.push('pop' + cost.pop);
    return parts.length ? parts.join('/') : '0';
  }
  function renderAbPlan() {
    const sec = panel && panel.querySelector('section[data-tab=build]');
    if (!sec || sec.hidden) return;
    const box = sec.querySelector('.ab-plan');
    if (!box) return;
    const townId = abCurrentTownId() || (abTownIds()[0]);
    if (!townId) {
      box.replaceChildren();
      const e = document.createElement('div');
      e.style.cssText = 'color:#888;font-size:10px;padding:2px 0';
      e.textContent = 'sin ciudad';
      box.appendChild(e);
      return;
    }
    const plan = buildPlanNext(townId, 3);
    const pin = abGetPin(townId);
    const wantKeys = plan.map((p, i) => `ab-plan-${townId}-${i}`);
    const sameSet = box.querySelectorAll('.ab-plan-row[data-key]').length === wantKeys.length
      && wantKeys.every(k => box.querySelector(`.ab-plan-row[data-key="${k}"]`));
    if (!sameSet) box.replaceChildren();
    if (!plan.length) {
      if (!sameSet) {
        const e = document.createElement('div');
        e.style.cssText = 'color:#888;font-size:10px;padding:2px 0';
        e.textContent = 'todos los objetivos cumplidos';
        box.appendChild(e);
      }
      return;
    }
    const mk = (cls, txt, color) => {
      const s = document.createElement('span');
      if (cls) s.className = cls;
      s.textContent = txt;
      if (color) s.style.color = color;
      return s;
    };
    plan.forEach((p, i) => {
      const key = wantKeys[i];
      let row = sameSet ? box.querySelector(`.ab-plan-row[data-key="${key}"]`) : null;
      if (!row) {
        row = document.createElement('div');
        row.className = 'ab-plan-row' + (p.custom ? ' custom' : (p.pinned ? ' pinned' : ''));
        row.dataset.key = key;
        row.appendChild(mk('ab-plan-name', '', null));
        row.appendChild(mk('ab-plan-lvl', '', '#888'));
        row.appendChild(mk('ab-plan-cost', '', '#aaa'));
        row.appendChild(mk('ab-plan-verdict', '', null));
        row.appendChild(mk('ab-plan-eta', '', '#888'));
        const pinBtn = document.createElement('button');
        pinBtn.type = 'button';
        pinBtn.style.cssText = 'background:#333;border:1px solid #555;color:#fc6;padding:0 4px;cursor:pointer;font-size:9px';
        pinBtn.addEventListener('click', () => {
          abSetPin(townId, abGetPin(townId) === p.building ? null : p.building);
          renderAbPlan();
          renderAbQueue();
        });
        row.appendChild(pinBtn);
        box.appendChild(row);
      } else {
        row.className = 'ab-plan-row' + (p.custom ? ' custom' : (p.pinned || pin === p.building ? ' pinned' : ''));
      }
      row.querySelector('.ab-plan-name').textContent = AB_LABELS[p.building] || p.building;
      row.querySelector('.ab-plan-lvl').textContent = '->' + p.level;
      row.querySelector('.ab-plan-cost').textContent = abPlanCostLabel(p.cost);
      const verdictEl = row.querySelector('.ab-plan-verdict');
      const verdict = abPlanVerdictLabel(p.afford);
      verdictEl.textContent = verdict;
      verdictEl.style.color = p.afford && p.afford.ok ? '#6dda7e' : (p.afford && p.afford.blind ? '#fc6' : '#f08080');
      row.querySelector('.ab-plan-eta').textContent = p.etaMs ? fmtSec(Math.ceil(p.etaMs / 1000)) : 'ya';
      const pinBtn = row.querySelector('button');
      if (pinBtn) {
        pinBtn.textContent = (pin === p.building) ? 'soltar' : 'fijar';
        pinBtn.title = 'Fijar en la ranura 1 (por mundo y por ciudad)';
      }
    });
  }

  // Ordered rows for the Build tab custom queue. Rebuilt whole on change - the
  // list is short (user-authored) and every row carries mutable controls.
  function renderCqRows() {
    const sec = panel && panel.querySelector('section[data-tab=build]');
    if (!sec || sec.hidden) return;
    const box = sec.querySelector('.cq-rows');
    if (!box) return;
    const townId = abCurrentTownId() || abTownIds()[0];
    const label = sec.querySelector('#gb-cq-town');
    if (label) label.textContent = townId ? `ciudad ${townId}` : 'sin ciudad';
    const strict = sec.querySelector('#gb-cq-strict');
    if (strict) strict.checked = state.abQueueStrict !== false;
    const pick = sec.querySelector('#gb-cq-b');
    const levels = townId ? abCurrentLevels(townId) : null;
    if (pick && !pick.options.length) {
      AB_BUILDINGS.forEach(b => {
        const o = document.createElement('option');
        o.value = b;
        o.textContent = AB_LABELS[b] || b;
        pick.appendChild(o);
      });
    }
    const lvlEl = sec.querySelector('#gb-cq-lvl');
    if (lvlEl && pick && document.activeElement !== lvlEl) {
      const cur = levels ? (levels[pick.value] || 0) : 0;
      lvlEl.value = String(Math.min(abMaxLevel(pick.value), cur + 1));
    }
    box.replaceChildren();
    const list = townId ? abCqGet(townId) : [];
    if (!list.length) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#888;font-size:10px;padding:2px 0';
      e.textContent = 'sin cola personalizada - se usa el plan heurístico';
      box.appendChild(e);
      return;
    }
    const sim = Object.assign({}, levels || {});
    list.forEach((entry, i) => {
      const want = abCqWantLevel(entry, sim);
      sim[entry.b] = want;
      const row = document.createElement('div');
      row.className = 'cq-row';
      row.dataset.key = `cq-${townId}-${i}`;
      const idx = document.createElement('span');
      idx.textContent = String(i + 1) + '.';
      idx.style.color = '#666';
      const name = document.createElement('span');
      name.textContent = AB_LABELS[entry.b] || entry.b;
      name.style.color = '#aaa';
      const lvl = document.createElement('span');
      lvl.textContent = '->' + want;
      lvl.style.color = '#cfc';
      const cur = document.createElement('span');
      cur.textContent = levels ? String(levels[entry.b] != null ? levels[entry.b] : '?') : '?';
      cur.style.color = '#888';
      const btns = document.createElement('span');
      btns.style.cssText = 'display:flex;gap:2px';
      const mk = (txt, title, fn) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = txt;
        b.title = title;
        b.style.cssText = 'background:#333;border:1px solid #555;color:#eee;padding:0 4px;cursor:pointer;font-size:10px';
        b.addEventListener('click', () => { fn(); renderCqRows(); renderAbPlan(); });
        return b;
      };
      btns.appendChild(mk('^', 'subir', () => abCqMove(townId, i, -1)));
      btns.appendChild(mk('v', 'bajar', () => abCqMove(townId, i, 1)));
      btns.appendChild(mk('x', 'quitar', () => abCqRemove(townId, i)));
      row.appendChild(idx);
      row.appendChild(name);
      row.appendChild(cur);
      row.appendChild(lvl);
      row.appendChild(btns);
      box.appendChild(row);
    });
  }

  function abDefaultTargets() {
    return Object.assign({}, AB_CS_FAST);
  }
  function abEnsureTargets() {
    if (!state.abTargets || typeof state.abTargets !== 'object') {
      state.abTargets = abDefaultTargets();
      save(STORE.AB_TARGETS, state.abTargets);
    }
    AB_BUILDINGS.forEach(b => {
      if (state.abTargets[b] == null) state.abTargets[b] = AB_CS_FAST[b] || 0;
    });
    return state.abTargets;
  }
  function abMaxLevel(building) {
    try {
      const uw = gameUw();
      const d = uw.GameData && uw.GameData.buildings && uw.GameData.buildings[building];
      return d && d.max_level != null ? +d.max_level : 40;
    } catch (_) { return 40; }
  }
  function abMinLevel(building) {
    try {
      const uw = gameUw();
      const d = uw.GameData && uw.GameData.buildings && uw.GameData.buildings[building];
      return d && d.min_level != null ? +d.min_level : 0;
    } catch (_) { return 0; }
  }
  function abClampTarget(building, lvl) {
    const lo = abMinLevel(building);
    const hi = abMaxLevel(building);
    return Math.min(hi, Math.max(lo, Math.floor(+lvl || 0)));
  }
  function abSetTarget(building, lvl) {
    abEnsureTargets();
    state.abTargets[building] = abClampTarget(building, lvl);
    save(STORE.AB_TARGETS, state.abTargets);
  }
  function abLoadCsFast() {
    state.abTargets = abDefaultTargets();
    save(STORE.AB_TARGETS, state.abTargets);
    gbLog('auto-queue: loaded CS-fast targets');
    renderAbQueue();
  }
  function abGetTown(townId) {
    const uw = gameUw();
    try {
      return uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]);
    } catch (_) { return null; }
  }
  function abCurrentLevels(townId) {
    const t = abGetTown(townId);
    if (!t) return null;
    let attrs = null;
    try {
      const b = t.getBuildings ? t.getBuildings() : (t.buildings && t.buildings());
      attrs = b && (b.attributes || b);
    } catch (_) {}
    if (!attrs) return null;
    const levels = {};
    AB_BUILDINGS.forEach(id => { levels[id] = +(attrs[id] || 0); });
    // Include queued upgrades so we don't double-queue the same level
    try {
      const orders = t.buildingOrders ? t.buildingOrders() : null;
      const models = (orders && orders.models) || [];
      models.forEach(m => {
        const a = m.attributes || m;
        const type = a.building_type;
        if (!type || levels[type] == null) return;
        if (a.tear_down) levels[type] -= 1;
        else levels[type] += 1;
      });
    } catch (_) {}
    return levels;
  }
  function abQueueMax() {
    try {
      const uw = gameUw();
      if (uw.GameDataPremium && uw.GameDataPremium.isAdvisorActivated && uw.GameDataPremium.isAdvisorActivated('curator')) return 7;
      if (uw.GameDataConstructionQueue && uw.GameDataConstructionQueue.getBuildingOrdersQueueLength) {
        return uw.GameDataConstructionQueue.getBuildingOrdersQueueLength() || 2;
      }
    } catch (_) {}
    return 2;
  }
  function abQueueInfo(townId) {
    const t = abGetTown(townId);
    const max = abQueueMax();
    if (!t) return { len: 0, max, orders: [] };
    let models = [];
    try {
      const orders = t.buildingOrders ? t.buildingOrders() : null;
      models = (orders && orders.models) || [];
    } catch (_) {}
    const list = models.map(m => {
      const a = m.attributes || m;
      return {
        id: a.id,
        building_type: a.building_type,
        building_time: +(a.building_time || 0),
        to_be_completed_at: +(a.to_be_completed_at || 0),
        tear_down: !!a.tear_down,
      };
    });
    return { len: list.length, max, orders: list };
  }
  function abQueueFull(townId) {
    const q = abQueueInfo(townId);
    return q.len >= q.max;
  }
  function abDelayFromOrder(order) {
    // half of that construction's duration + 5min + rand - not "right when it finishes"
    const btSec = Math.max(0, +(order && order.building_time) || 0);
    return Math.floor(btSec / 2) * 1000 + AB_EXTRA_MS + abRandMs();
  }
  function abArmDeadline(townId, order, why) {
    const wait = abDelayFromOrder(order);
    state.abNextAt[townId] = Date.now() + wait;
    save(STORE.AB_NEXT, state.abNextAt);
    gbLog(`auto-queue: town ${townId} next fill in ${fmtSec(wait / 1000)} (${why || 'armed'}, half-build+5m+rand)`);
  }
  function abClearDeadline(townId) {
    if (state.abNextAt[townId] == null) return;
    delete state.abNextAt[townId];
    save(STORE.AB_NEXT, state.abNextAt);
  }
  function abBuildingCost(townId, building) {
    try {
      const uw = gameUw();
      let bbd = uw.MM && uw.MM.getModels && uw.MM.getModels().BuildingBuildData;
      if (!bbd) bbd = uw.MM && uw.MM.getModels && (uw.MM.getModels().BuildData || uw.MM.getModels().BuildingBuilder);
      const data = bbd && (bbd[townId] || bbd[String(townId)]);
      const bd = data && data.attributes && data.attributes.building_data && data.attributes.building_data[building];
      if (!bd) return null;
      const need = bd.resources_for;
      if (!need || need.wood == null || need.stone == null || need.iron == null) return null;
      return {
        wood: +need.wood || 0,
        stone: +need.stone || 0,
        iron: +need.iron || 0,
        pop: bd.population_for != null ? +bd.population_for : 0,
        buildTime: bd.building_time != null ? +bd.building_time : null,
      };
    } catch (_) { return null; }
  }
  function abCanAfford(townId, building, ledger) {
    const t = abGetTown(townId);
    if (!t) return false;
    let res = ledger;
    if (!res) {
      try { res = t.resources(); } catch (_) { return false; }
    }
    if (!res) return false;
    const need = abBuildingCost(townId, building);
    if (!need) return false; // unknown cost blocks - never guess affordability
    if (need.pop > 0) {
      const pop = ledger && ledger.pop != null
        ? ledger.pop
        : (t.getAvailablePopulation ? t.getAvailablePopulation() : (res.population || 0));
      if (pop < need.pop) return false;
    }
    const margin = 10;
    return res.wood >= need.wood + margin && res.stone >= need.stone + margin && res.iron >= need.iron + margin;
  }
  function abPickNextFromLevels(townId, levels, ledger) {
    const plan = buildPlanNext(townId, 1);
    const first = plan[0];
    if (!first) return null;
    const scratch = ledger ? {
      wood: ledger.wood, stone: ledger.stone, iron: ledger.iron, pop: ledger.pop,
      production: abTownProduction(townId),
    } : null;
    const { afford } = scratch
      ? abPlanEntryAfford(townId, first.building, scratch)
      : abPlanEntryAfford(townId, first.building, null);
    if (!afford.ok && !afford.blind) return null;
    return first.building;
  }
  function abPickNext(townId) {
    const plan = buildPlanNext(townId, 1);
    return plan[0] ? plan[0].building : null;
  }
  function abPickBatch(townId, n) {
    if (n <= 0) return [];
    const plan = buildPlanNext(townId, n);
    const out = [];
    for (const entry of plan) {
      if (!entry.afford.ok && !entry.afford.blind) {
        // Strict (default): a custom queue is an order, so wait for the head
        // entry instead of building past it. Loose: skip it and keep going.
        if (state.abQueueStrict !== false) {
          if (entry.custom) {
            gbLogT('ab-cq-wait-' + townId + '-' + entry.building, 120000,
              `auto-queue: town ${townId} waiting for ${AB_LABELS[entry.building] || entry.building} (${abPlanVerdictLabel(entry.afford)})`);
          }
          break;
        }
        gbLogT('ab-cq-skip-' + townId + '-' + entry.building, 120000,
          `auto-queue: town ${townId} skipping ${AB_LABELS[entry.building] || entry.building} (${abPlanVerdictLabel(entry.afford)}, strict off)`);
        continue;
      }
      out.push(entry.building);
    }
    return out;
  }
  function abBuildUp(townId, building) {
    return new Promise(resolve => {
      if (!hostEnabled() || captchaPaused('build')) { resolve('pause'); return; }
      bridgePost('build', {
        model_url: 'BuildingOrder',
        action_name: 'buildUp',
        arguments: { building_id: building },
        town_id: +townId,
      }, (err, data) => {
        if (err === 'captcha' || err === 'captcha-pause') { resolve('captcha'); return; }
        if (err) { gbLog(`auto-queue: ${building} @${townId} fail: ${err}`); resolve('err'); return; }
        gbLog(`auto-queue: ${AB_LABELS[building] || building} +1 in town ${townId}`);
        resolve('ok');
      });
    });
  }
  function abTownIds() {
    const fromGame = townsFromGame();
    if (fromGame && fromGame.length) return fromGame.map(t => t.id);
    return (state.towns || []).map(t => t.id);
  }
  // Auto: only when <=1 order left; then add up to 6 (or queue max).
  // Timing: when 1 left, arm deadline = half(building_time)+5min+rand - do NOT
  // refill the instant a construction finishes.
  // Manual (force): ignore deadline, still batch-fill available slots.
  function abScan(reason) {
    if (!hostEnabled() || !state.abAuto || captchaPaused('build') || gbLocked('ab')) return;
    const force = reason === 'manual';
    const ids = abTownIds();
    if (!ids.length) { gbLogT('ab-notowns', 120000, 'auto-queue: no towns'); return; }
    const jobs = [];
    const now = Date.now();
    ids.forEach(id => {
      if (abCqGet(id).length) abCqPrune(id, abCurrentLevels(id));
      const q = abQueueInfo(id);
      if (q.len > 1 && !force) {
        // still buffered - clear any stale arm so we re-arm when we hit 1 again
        if (state.abNextAt[id] != null) abClearDeadline(id);
        return;
      }
      if (!force && q.len === 1) {
        const due = state.abNextAt[id];
        if (due == null) {
          abArmDeadline(id, q.orders[0], '1 left');
          return;
        }
        if (now < due) {
          gbLogT('ab-wait-' + id, 60000, `auto-queue: town ${id} waiting ${fmtSec((due - now) / 1000)} (1 left)`);
          return;
        }
      }
      // empty queue (bootstrap) or deadline reached or manual force
      const slots = Math.min(AB_FILL_BATCH, Math.max(0, q.max - q.len));
      if (slots <= 0) return;
      const batch = abPickBatch(id, slots);
      batch.forEach(building => jobs.push({ id, building }));
      if (batch.length) abClearDeadline(id);
    });
    if (!jobs.length) {
      gbLogT('ab-idle', 120000, `auto-queue: nothing to build${reason ? ' (' + reason + ')' : ''}`);
      renderAbQueue();
      return;
    }
    gbLock('ab');
    gbLog(`auto-queue${reason ? ' (' + reason + ')' : ''}: ${jobs.length} job(s) (batch<=${AB_FILL_BATCH})`);
    let i = 0, done = 0, captcha = false;
    const unlock = () => { gbUnlock('ab'); };
    const watchdog = gbTimeout(unlock, Math.max(30000, jobs.length * (BRIDGE_TIMEOUT_MS + 1000)));
    (function next() {
      if (i >= jobs.length || captcha) {
        try { clearTimeout(watchdog); } catch (_) {}
        unlock();
        if (done) flash(`cola auto. x${done}`);
        // After a fill, if a town is back to a single active order, arm the
        // half-build+5m wait so we don't top up the moment that one finishes.
        abTownIds().forEach(tid => {
          const q = abQueueInfo(tid);
          if (q.len === 1 && state.abNextAt[tid] == null) {
            abArmDeadline(tid, q.orders[0], 'post-fill');
          }
        });
        renderAbQueue();
        gbTimeout(ibScan, 2000);
        return;
      }
      const job = jobs[i++];
      abBuildUp(job.id, job.building).then(res => {
        if (res === 'ok') done++;
        if (res === 'captcha') captcha = true;
        gbTimeout(next, 1100 + Math.random() * 400);
      });
    })();
  }
  function abCurrentTownId() {
    try {
      const uw = gameUw();
      return uw.Game && uw.Game.townId;
    } catch (_) { return null; }
  }
  function renderAbQueue() {
    const sec = panel && panel.querySelector('section[data-tab=build]');
    if (!sec || sec.hidden) return;
    const box = sec.querySelector('.ab-queue');
    const status = sec.querySelector('#gb-ab-status');
    if (!box) return;
    abEnsureTargets();
    const townId = abCurrentTownId() || (abTownIds()[0]);
    const levels = townId ? abCurrentLevels(townId) : null;
    if (townId) abCqPrune(townId, levels);
    renderCqRows();
    box.replaceChildren();
    const head = document.createElement('div');
    head.style.cssText = 'display:grid;grid-template-columns:1.2fr .5fr .5fr .5fr auto;gap:4px;font-size:9px;color:#888;margin-bottom:2px';
    ['edificio', 'act', 'obj', 'máx', ''].forEach(t => {
      const s = document.createElement('span'); s.textContent = t; head.appendChild(s);
    });
    box.appendChild(head);
    AB_BUILDINGS.forEach(b => {
      const row = document.createElement('div');
      row.className = 'ab-row';
      row.style.cssText = 'display:grid;grid-template-columns:1.2fr .5fr .5fr .5fr auto;gap:4px;align-items:center;padding:1px 0;border-bottom:1px solid #2a2a2a;font-size:10px';
      const name = document.createElement('span');
      name.textContent = AB_LABELS[b] || b;
      name.style.color = '#aaa';
      const cur = document.createElement('span');
      const curLvl = levels ? levels[b] : '?';
      cur.textContent = String(curLvl);
      const tgt = state.abTargets[b] || 0;
      const max = abMaxLevel(b);
      if (levels && curLvl >= tgt) cur.style.color = '#6dda7e';
      else if (levels && curLvl < tgt) cur.style.color = '#f0c060';
      const tgtEl = document.createElement('input');
      tgtEl.type = 'number';
      tgtEl.min = String(abMinLevel(b));
      tgtEl.max = String(max);
      tgtEl.value = String(tgt);
      tgtEl.style.cssText = 'width:42px;background:#111;color:#cfc;border:1px solid #333;font:10px monospace';
      tgtEl.addEventListener('change', () => {
        abSetTarget(b, +tgtEl.value);
        renderAbQueue();
      });
      const maxEl = document.createElement('span');
      maxEl.textContent = String(max);
      maxEl.style.color = '#666';
      const btns = document.createElement('span');
      btns.style.cssText = 'display:flex;gap:2px';
      const mkBtn = (txt, fn) => {
        const b2 = document.createElement('button');
        b2.textContent = txt;
        b2.style.cssText = 'background:#333;border:1px solid #555;color:#eee;padding:0 4px;cursor:pointer;font-size:10px';
        b2.addEventListener('click', fn);
        return b2;
      };
      btns.appendChild(mkBtn('-', () => { abSetTarget(b, (state.abTargets[b] || 0) - 1); renderAbQueue(); }));
      btns.appendChild(mkBtn('+', () => { abSetTarget(b, (state.abTargets[b] || 0) + 1); renderAbQueue(); }));
      btns.appendChild(mkBtn('máx', () => { abSetTarget(b, max); renderAbQueue(); }));
      row.appendChild(name);
      row.appendChild(cur);
      row.appendChild(tgtEl);
      row.appendChild(maxEl);
      row.appendChild(btns);
      box.appendChild(row);
    });
    if (status) {
      const q = townId ? abQueueInfo(townId) : null;
      const due = townId && state.abNextAt[townId];
      const next = townId && q && q.len <= 1 ? abPickNext(townId) : null;
      let waitTxt = '';
      if (due && Date.now() < due) waitTxt = `  |  recarga en ${fmtSec((due - Date.now()) / 1000)}`;
      else if (q && q.len > 1) waitTxt = `  |  esperando a que quede 1 (${q.len}/${q.max})`;
      status.textContent = (gbLocked('ab') ? 'encolando... ' : '')
        + (townId ? `ciudad ${townId}` : 'sin ciudad')
        + (q ? `  |  cola ${q.len}/${q.max}` : '')
        + (next ? `  |  siguiente: ${AB_LABELS[next] || next}` : '  |  inactivo')
        + waitTxt
        + (state.abAuto ? '  |  AUTO' : '  |  off');
    }
  }

  // ---------- thresholds + alerts ----------
  function checkThresholds() {
    let changed = false;
    for (const f of state.farmsParsed) {
      const r = state.farmResources[f.vill_id];
      const t = state.thresholds[f.vill_id];
      if (!r || !r.ok || !t) continue;
      const fields = ['wood','stone','iron','pop'];
      const hits = fields.filter(k => t[k] != null && r[k] != null && r[k] >= t[k]);
      const key = hits.sort().join(',') || 'none';
      const prev = state.alerted[f.vill_id];
      if (!prev || prev.key !== key) {
        if (hits.length) flash(`AVISO granja ${f.vill_id} ${hits.join('+')} >= umbral`);
        state.alerted[f.vill_id] = { key, ts: Date.now() };
        changed = true;
      }
    }
    if (changed) { save(STORE.ALERTED, state.alerted); renderFarms(); }
  }

