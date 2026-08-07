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
  // null = unknown — never treat as free.
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
    const cols = [];
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
          isFree: ibIsFreeOrder(doneAt, timeLeft, gold),
          gold,
        });
      });
    });
    return out;
  }
  function ibOrders() {
    const now = gameNow();
    const out = [];
    const uw = uwCached();
    const names = ibTownNames(uw);
    const research = state.ibResearch ? ibResearchOrders(names) : [];
    let candidates = [], src = null;
    try {
      const col = mmCol('BuildingOrder');
      if (col && col.models && col.models.length) { candidates.push(col); src = 'MM'; }
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
      gbLogT('ib-learn-refuse', 60000, 'instant: unknown free action ' + action + ' — learn manually via free click');
      return;
    }
    if (kind === 'research') { state.ibActionR = action; save(wkey(STORE.IB_ACTION_R), action); }
    else { state.ibAction = action; save(wkey(STORE.IB_ACTION), action); }
  }
  function ibComplete(order) {
    return new Promise(resolve => {
      if (!hostEnabled() || captchaPaused('build')) { resolve('pause'); return; }
      const kind = order.kind || 'build';
      const tag = kind === 'research' ? 'instant-research' : 'instant-build';
      // Re-read live model immediately before post — snapshot may be stale
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
          gbLog(`${tag}: ${live.type} #${order.id} response OK but order still present — unknown_outcome`);
          resolve('unknown');
          return;
        }
        gbLog(`${tag}: ${live.type} #${order.id} OK`);
        resolve('ok');
      };
      const postFree = (actionName, isFallback) => {
        bridgePost('build', {
          model_url: modelUrl,
          action_name: actionName,
          captcha: null,
          arguments: { order_id: order.id },
          town_id: live.town_id,
        }, (err, data) => {
          if (err === 'captcha' || err === 'captcha-pause') { resolve('captcha'); return; }
          if (err === 'timeout') {
            // Timeout = unknown_outcome — do NOT retry / fallback; reconcile only
            if (!ibOrderStillPresent(order.id)) {
              gbLog(`${tag}: #${order.id} timeout but order gone — treating as OK`);
              resolve('ok');
            } else {
              gbLog(`${tag}: #${order.id} timeout_unknown — no fallback`);
              resolve('unknown');
            }
            return;
          }
          // Deterministic "unknown action" only: try finishInstantly once, never buyInstant
          if (err && !isFallback && actionName === 'completeInstant' && ibUnknownActionErr(err)) {
            const again = ibFindLiveOrder(order.id, kind);
            if (!again || !again.isFree || again.gold !== 0) {
              gbLog(`${tag}: completeInstant unknown, order no longer free — inactive`);
              resolve('err');
              return;
            }
            gbLog(`${tag}: completeInstant unknown — trying finishInstantly (gold=0 only)`);
            postFree('finishInstantly', true);
            return;
          }
          if (err) { gbLog(tag + ' complete error: ' + err); resolve('err'); return; }
          const e = data && data.error;
          if (e) {
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
    // Hard unlock if chain stalls (bridge timeout × N + slack)
    const watchdog = gbTimeout(unlock, Math.max(30000, free.length * (BRIDGE_TIMEOUT_MS + 1000)));
    (function next() {
      if (i >= free.length || captcha) {
        try { clearTimeout(watchdog); } catch (_) {}
        unlock();
        gbLog(`instant: completed ${done}/${free.length}${captcha ? ' (captcha abort)' : ''}`);
        if (done) flash(`instant x${done}`);
        gbTimeout(ibScan, 3000);
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
  function ibScan() {
    const orders = ibOrders();
    renderBuild(orders);
    if (!state.ibAuto || gbLocked('ib')) return;
    const free = orders.filter(o => o.isFree);
    if (free.length) {
      gbLog(`instant: ${free.length} free order(s), auto-completing`);
      ibCompleteAll(free);
    }
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
      e.textContent = 'no active build/research orders';
      rows.appendChild(e);
      dot.className = 'ib-dot';
      btn.disabled = true;
      status.textContent = gbLocked('ib') ? 'completing...' : '';
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
          o.isFree ? 'FREE' : (o.gold != null ? o.gold + ' gold' : '? gold')));
        rows.appendChild(r);
      });
    }
    status.textContent = (gbLocked('ib') ? 'completing... ' : '') + 'last scan: ' + new Date().toLocaleTimeString();
    renderAbQueue();
  }

  // ---------- auto-queue builds (buildUp via bridge) ----------
  // CS-fast targets from wiki CS-ready guides: academy 28, docks 20, farm 22,
  // storage 20, main 15; mines capped ~15–20 (income mainly from farms).
  const AB_BUILDINGS = ['main', 'storage', 'farm', 'academy', 'temple', 'barracks', 'docks', 'market', 'hide', 'lumber', 'stoner', 'ironer', 'wall'];
  const AB_LABELS = {
    main: 'Senate', storage: 'Warehouse', farm: 'Farm', academy: 'Academy',
    temple: 'Temple', barracks: 'Barracks', docks: 'Harbor', market: 'Market',
    hide: 'Cave', lumber: 'Timber', stoner: 'Quarry', ironer: 'Silver', wall: 'Wall',
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
  function abRandMs() { return Math.floor(Math.random() * 3 * 60 * 1000); } // 0–3min jitter

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
    // half of that construction's duration + 5min + rand — not "right when it finishes"
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
    if (!need) return false; // unknown cost blocks — never guess affordability
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
    if (!levels) return null;
    const targets = abEnsureTargets();
    for (const phase of AB_PHASES) {
      for (const building of Object.keys(phase)) {
        const want = Math.min(phase[building], targets[building] != null ? targets[building] : 0, abMaxLevel(building));
        if (want <= 0) continue;
        if (levels[building] < want && levels[building] < abMaxLevel(building)) {
          if (!abCanAfford(townId, building, ledger)) continue;
          return building;
        }
      }
    }
    for (const building of AB_BUILDINGS) {
      const want = Math.min(targets[building] || 0, abMaxLevel(building));
      if (levels[building] < want) {
        if (!abCanAfford(townId, building, ledger)) continue;
        return building;
      }
    }
    return null;
  }
  function abPickNext(townId) {
    return abPickNextFromLevels(townId, abCurrentLevels(townId));
  }
  function abPickBatch(townId, n) {
    const levels = abCurrentLevels(townId);
    if (!levels || n <= 0) return [];
    const t = abGetTown(townId);
    let ledger = null;
    try {
      const res = t && t.resources && t.resources();
      if (res) {
        ledger = {
          wood: +res.wood || 0,
          stone: +res.stone || 0,
          iron: +res.iron || 0,
          pop: t.getAvailablePopulation ? +t.getAvailablePopulation() : (+res.population || 0),
        };
      }
    } catch (_) {}
    const out = [];
    for (let i = 0; i < n; i++) {
      const b = abPickNextFromLevels(townId, levels, ledger);
      if (!b) break;
      out.push(b);
      levels[b] = (levels[b] || 0) + 1; // simulate queued level
      if (ledger) {
        const cost = abBuildingCost(townId, b);
        if (cost) {
          ledger.wood -= cost.wood;
          ledger.stone -= cost.stone;
          ledger.iron -= cost.iron;
          ledger.pop -= cost.pop;
        }
      }
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
  // Auto: only when ≤1 order left; then add up to 6 (or queue max).
  // Timing: when 1 left, arm deadline = half(building_time)+5min+rand — do NOT
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
      const q = abQueueInfo(id);
      if (q.len > 1 && !force) {
        // still buffered — clear any stale arm so we re-arm when we hit 1 again
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
    gbLog(`auto-queue${reason ? ' (' + reason + ')' : ''}: ${jobs.length} job(s) (batch≤${AB_FILL_BATCH})`);
    let i = 0, done = 0, captcha = false;
    const unlock = () => { gbUnlock('ab'); };
    const watchdog = gbTimeout(unlock, Math.max(30000, jobs.length * (BRIDGE_TIMEOUT_MS + 1000)));
    (function next() {
      if (i >= jobs.length || captcha) {
        try { clearTimeout(watchdog); } catch (_) {}
        unlock();
        if (done) flash(`auto-queue x${done}`);
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
    box.replaceChildren();
    const head = document.createElement('div');
    head.style.cssText = 'display:grid;grid-template-columns:1.2fr .5fr .5fr .5fr auto;gap:4px;font-size:9px;color:#888;margin-bottom:2px';
    ['building', 'cur', 'tgt', 'max', ''].forEach(t => {
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
      btns.appendChild(mkBtn('−', () => { abSetTarget(b, (state.abTargets[b] || 0) - 1); renderAbQueue(); }));
      btns.appendChild(mkBtn('+', () => { abSetTarget(b, (state.abTargets[b] || 0) + 1); renderAbQueue(); }));
      btns.appendChild(mkBtn('max', () => { abSetTarget(b, max); renderAbQueue(); }));
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
      if (due && Date.now() < due) waitTxt = ` · refill in ${fmtSec((due - Date.now()) / 1000)}`;
      else if (q && q.len > 1) waitTxt = ` · wait until 1 left (${q.len}/${q.max})`;
      status.textContent = (gbLocked('ab') ? 'queueing... ' : '')
        + (townId ? `town ${townId}` : 'no town')
        + (q ? ` · queue ${q.len}/${q.max}` : '')
        + (next ? ` · next: ${AB_LABELS[next] || next}` : ' · idle')
        + waitTxt
        + (state.abAuto ? ' · AUTO' : ' · off');
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
        if (hits.length) flash(`WARN farm ${f.vill_id} ${hits.join('+')} >= threshold`);
        state.alerted[f.vill_id] = { key, ts: Date.now() };
        changed = true;
      }
    }
    if (changed) { save(STORE.ALERTED, state.alerted); renderFarms(); }
  }

