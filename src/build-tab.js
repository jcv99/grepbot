  function ibFreeThresh() { return Math.max(1,Math.min(300,+state.ibFreeThresh||300)); }
  function ibSafeFreeThresh(){return Math.min(300-IB_FREE_SERVER_MARGIN_SEC,ibFreeThresh());}

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
  function ibIsFreeOrder(timeLeft, gold) {
    return Number.isFinite(+timeLeft) && +timeLeft > 0 && +timeLeft <= ibSafeFreeThresh() && gold === 0;
  }
  function ibOrderStillPresent(orderId,kind) {
    return ibOrders(true).some(o => String(o.id) === String(orderId) && (kind==null||o.kind===kind));
  }
  function ibFindLiveOrder(orderId, kind) {
    return ibOrders(true).find(o => String(o.id) === String(orderId) && (kind == null || o.kind === kind)) || null;
  }
  function ibUnknownActionErr(err) {
    return /unknown.?action|invalid.?action|action.?not.?found|does.?not.?exist|no.?such.?action/i.test(String(err || ''));
  }
  // A rejected learned action must be dropped, or every later scan re-posts the
  // same dead action_name and burns a budget slot per cadence.
  function ibResetLearnedAction(kind, err) {
    if (!ibUnknownActionErr(err)) return;
    const cur = kind === 'research' ? state.ibActionR : state.ibAction;
    if (!cur) return;
    if (kind === 'research') { state.ibActionR = null; save(wkey(STORE.IB_ACTION_R), null); }
    else { state.ibAction = null; save(wkey(STORE.IB_ACTION), null); }
    gbLogT('ib-relearn', 60000,
      'instant: learned action ' + cur + ' rejected - reset to default, hand-click one free complete to re-learn');
  }
  function ibJrnPayload(order) {
    const kind = order.kind || 'build';
    return {
      model_url: order.modelUrl || ((kind === 'research' ? 'ResearchOrder/' : 'BuildingOrder/') + order.id),
      action_name: ibActionFor(kind),
      arguments: { order_id: order.id },
      town_id: order.town_id,
    };
  }
  function ibFeatureFor(kind) { return kind === 'research' ? 'instant-research' : 'instant-build'; }
  // Must mirror bridgePost/txRun exactly: feature key + `model_url/action_name`
  // endpoint + txIntent. Asking gbSkipActive('build', payload) instead looked up
  // `t<town>:-` under feature `build`, a key the trip path never writes — so the
  // pre-filter was dead and every scan re-announced an order txRun then refused.
  function ibSkipWhy(order) {
    const payload = ibJrnPayload(order);
    const endpoint = String(payload.model_url) + '/' + String(payload.action_name);
    return gbSkipActiveWrite(ibFeatureFor(order.kind || 'build'), 'bridge', endpoint, payload);
  }
  // The 10s scan is the safety net; this armed timer is the accelerator that
  // lands the free post at ~4:58 instead of up to 10s late. Never drop either -
  // a background tab clamps timers and only the interval recovers that.
  // One timer PER TOWN: a single global timer always tracked the earliest town
  // and every other town's free window was left to the 10s interval, up to ~10s
  // late — exactly the miss this accelerator exists to prevent.
  const ibFreeTimers = Object.create(null);
  function ibClearArmed(townKey) {
    if (townKey == null) {
      for (const k of Object.keys(ibFreeTimers)) ibClearArmed(k);
      return;
    }
    const e = ibFreeTimers[townKey];
    if (!e) return;
    gbClearTimeout(e.timer);
    delete ibFreeTimers[townKey];
  }
  function ibArmNext(orders) {
    const now = Date.now();
    const thresh = ibFreeThresh() * 1000;
    const best = Object.create(null);
    (orders || []).forEach(o => {
      // Only the head order of each town is counting down; a queued order
      // reports its full build time and its clock has not started yet.
      if (o.isFree || !o.isHead || !(o.display > 0)) return;
      const armIn = (o.display * 1000) - thresh;
      if (armIn <= 0) return;
      const key = String(o.town_id) + ':' + (o.kind || 'build');
      const at = now + armIn;
      if (!best[key] || at < best[key]) best[key] = at;
    });
    for (const key of Object.keys(ibFreeTimers)) if (!best[key]) ibClearArmed(key);
    for (const key of Object.keys(best)) {
      // +1.2s so the server clock is past the boundary, plus jitter.
      const fireAt = best[key] + 1200 + Math.floor(Math.random() * 1500);
      const cur = ibFreeTimers[key];
      if (cur && Math.abs(cur.at - fireAt) < 3000) continue;
      ibClearArmed(key);
      ibFreeTimers[key] = {
        at: fireAt,
        timer: gbTimeout(() => { delete ibFreeTimers[key]; ibScan(); }, Math.max(500, fireAt - now)),
      };
      gbLogT('ib-arm-' + key, 60000, `instant: ${key} armed in ${fmtSec((fireAt - now) / 1000)} (free window at <=${ibFreeThresh()}s)`);
    }
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

  function ibHeadIds(cols) {
    const groups=new Map(),seen=new Set();let seq=0;
    for(const col of cols||[])for(const model of ((col&&col.models)||[])){
      const r=model.attributes||model,id=String(r.id==null?'':r.id),town=String(r.town_id==null?'':r.town_id);
      if(!id||!town||seen.has(id))continue;seen.add(id);
      if(!groups.has(town))groups.set(town,[]);groups.get(town).push({r,id,seq:seq++});
    }
    const heads=new Map();
    const finite=(v,positive)=>{const n=+v;return Number.isFinite(n)&&(!positive||n>0)?n:null};
    const uniqueMin=(rows,get)=>{const vals=rows.map(x=>get(x.r));if(vals.some(v=>v==null))return null;const min=Math.min(...vals),hits=vals.reduce((n,v)=>n+(v===min?1:0),0);return hits===1?rows[vals.indexOf(min)]:null};
    for(const [town,rows] of groups){if(rows.length===1){heads.set(town,rows[0].id);continue}
      const byPos=uniqueMin(rows,r=>finite(r.queue_position??r.position??r.queue_index??r.sort_index,false));
      const byDone=byPos||uniqueMin(rows,r=>finite(r.to_be_completed_at??r.toBeCompletedAt??r.completed_at,true));
      const byCreated=byDone||uniqueMin(rows,r=>finite(r.created_at??r.createdAt,true));
      // If no field proves a unique head, do not offer an automatic instant action.
      if(byCreated)heads.set(town,byCreated.id)}
    return heads;
  }

  function ibResearchOrders(names) {
    const now = gameNow();
    const out = [];
    const uw = uwCached();
    const cols = [],colRefs=new Set();
    const addCol=col=>{if(col&&Array.isArray(col.models)&&col.models.length&&!colRefs.has(col)){colRefs.add(col);cols.push(col)}};
    // Town-owned collections FIRST. `seenIds` keeps the first model it sees for
    // an id, and the town's own queue is the one the client keeps current — the
    // global MM collection can still hold a completed/stale copy of the same
    // order, and pricing an instant complete off stale remaining time is how a
    // "free" post turns into a paid one.
    try {
      const towns=uw.ITowns&&uw.ITowns.towns||{};
      for(const town of Object.values(towns)){
        for(const fn of ['getResearchOrdersCollection','researchOrders','getResearchOrders']){
          try{if(town&&typeof town[fn]==='function')addCol(town[fn]())}catch(_){}
        }
      }
    } catch (_) {}
    try {
      const col = mmCol('ResearchOrder');
      addCol(col);
    } catch (_) {}
    let gpCols = null;
    try { gpCols = uw.GPWindowMgr && uw.GPWindowMgr._collections; } catch (_) {}
    if (gpCols) Object.keys(gpCols).forEach(k => { if (k.indexOf('research_orders') === 0) addCol(gpCols[k]); });
    if (!cols.length) return out;
    const headIds=ibHeadIds(cols);
    const seenIds = new Set();
    cols.forEach(col => {
      (col.models || []).forEach(model => {
        const r = model.attributes || model;
        const rid=String(r.id==null?'':r.id);if (!rid || !r.town_id || seenIds.has(rid)) return;
        seenIds.add(rid);
        const doneAt = r.to_be_completed_at || r.toBeCompletedAt || r.completed_at || 0;
        const timeLeft = doneAt ? Math.max(0, doneAt - now) : (r.research_time || 0);
        const isFirst = headIds.get(String(r.town_id)) === String(r.id);
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
          timeLeft,
          isHead: isFirst,
          isFree: isFirst && ibIsFreeOrder(timeLeft, gold),
          gold,
        });
      });
    });
    return out;
  }
  function ibOrders(includeAllResearch) {
    const now = gameNow();
    const out = [];
    const uw = uwCached();
    const names = ibTownNames(uw);
    const research = (includeAllResearch||state.ibResearch) ? ibResearchOrders(names) : [];
    let candidates = [], src = null;
    // Town-owned queues FIRST, then the global MM collection. Some worlds only
    // keep the active town in the global collection, and `seenIds` below keeps
    // the FIRST model per id — with MM in front, a stale global copy of an
    // order won over the town's live one and the instant price was computed
    // from the wrong remaining time.
    try {
      const townModels=uw.ITowns&&uw.ITowns.towns||{};
      for(const town of Object.values(townModels)){
        const col=town&&town.buildingOrders&&town.buildingOrders();
        if(col&&col.models&&col.models.length)candidates.push(col);
      }
      if(candidates.length)src='ITowns';
    } catch (_) {}
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
    const headIds=ibHeadIds(candidates);
    const seenIds = new Set();
    candidates.forEach(col => {
      (col.models || []).forEach(model => {
        const r = model.attributes || model;
        const rid=String(r.id==null?'':r.id);if (!rid || !r.town_id || seenIds.has(rid)) return;
        seenIds.add(rid);

        const doneAt = r.to_be_completed_at || r.toBeCompletedAt || r.completed_at || 0;
        const timeLeft = doneAt ? Math.max(0, doneAt - now) : (r.building_time || 0);
        const isFirst = headIds.get(String(r.town_id)) === String(r.id);
        // Grepolis can offer free completion for a later queued building based on
        // that order's own remaining/build duration, even while an earlier order
        // is still running. Keep the absolute queue ETA for display/debugging, but
        // price the instant action from the duration Grepolis exposes for this order.
        const display = isFirst ? timeLeft : (r.building_time || 0);
        const instantLeft = display;
        const gold = ibGoldCost('build', instantLeft);
        // A queued (non-head) order prices its own duration, but the server
        // charges from when it can actually start. Requiring the queue ETA to
        // be free as well keeps the "free" claim honest: `buyInstant` SPENDS
        // GOLD when the server disagrees, and that is not recoverable.
        const queueGold = isFirst ? gold : ibGoldCost('build', timeLeft);
        const queueFree = isFirst || ibIsFreeOrder(timeLeft, queueGold);
        out.push({
          id: r.id,
          kind: 'build',
          modelUrl: 'BuildingOrder/' + r.id,
          town_id: r.town_id,
          townName: names[r.town_id] || ('Town ' + r.town_id),
          type: r.building_type || '?',
          display,
          timeLeft,
          instantLeft,
          isHead: isFirst,
          // Unlike research, building buyInstant is allowed on any queue position
          // when Grepolis' live price function says the individual order costs 0
          // gold AND the queue ETA is inside the free window too.
          isFree: queueFree && ibIsFreeOrder(instantLeft, gold),
          gold,
        });
      });
    });
    return out.concat(research);
  }
  function ibActionFor(kind) {
    const raw = kind === 'research'
      ? (state.ibActionR || 'buyInstant')
      : (state.ibAction || 'buyInstant');
    return IB_FREE_ACTIONS.has(String(raw))?String(raw):'buyInstant';
  }
  function ibLearnAction(kind, action) {
    if (!IB_FREE_ACTIONS.has(String(action))) {
      gbLogT('ib-learn-refuse', 60000, 'instant: unsupported action ' + action + ' — only buyInstant is allowed behind a verified zero-gold guard');
      return;
    }
    if (kind === 'research') { state.ibActionR = action; save(wkey(STORE.IB_ACTION_R), action); }
    else { state.ibAction = action; save(wkey(STORE.IB_ACTION), action); }
  }
  function ibComplete(order) {
    return new Promise(resolve => {
      const kind = order.kind || 'build';
      const tag = kind === 'research' ? 'instant-research' : 'instant-build';
      if (!hostEnabled() || captchaPaused(tag)) { resolve('pause'); return; }

      const live = ibFindLiveOrder(order.id, kind);
      const instantLeft = live && Number.isFinite(+live.instantLeft) ? +live.instantLeft : +(live && live.timeLeft);
      // Building orders may be free in later queue positions. Research remains
      // head-only until its non-head contract is observed in the live client.
      const positionAllowed = kind === 'build' || (live && live.isHead === true);
      if (!live || !positionAllowed || !live.isFree || live.gold !== 0 || !(instantLeft > 0) || instantLeft > ibSafeFreeThresh()) {
        gbLogT('ib-stale', 30000, `${tag}: #${order.id} no longer safely free (instantLeft=${instantLeft}, queueLeft=${live&&live.timeLeft}, head=${live&&live.isHead}, gold=${live&&live.gold})`);
        resolve('skip');
        return;
      }
      const modelUrl = live.modelUrl || order.modelUrl || ('BuildingOrder/' + order.id);
      const action = ibActionFor(kind);
      const intent=`instant:${live.town_id}:${kind}:${order.id}`;
      if(state.txState&&state.txState[intent]&&state.txState[intent].state==='committed'){
        gbLogT('ib-recent-'+kind+'-'+order.id,30000,`${tag}: #${order.id} already accepted; waiting for model update`);
        resolve('accepted');return;
      }
      const finishOk = () => {
        const waits=[0,150,500,1200,2500];let i=0;
        const check=()=>{
          if(!ibOrderStillPresent(order.id,kind)){gbLog(`${tag}: ${live.type} #${order.id} OK`);resolve('ok');return}
          if(i>=waits.length){gbLog(`${tag}: ${live.type} #${order.id} accepted; model update pending`);resolve('accepted');return}
          gbTimeout(check,waits[i++]);
        };check();
      };
      const postFree = () => {
        bridgePost(tag, {
          model_url: modelUrl,
          action_name: action,
          captcha: null,
          arguments: { order_id: order.id },
          town_id: live.town_id,
          nl_init: true,
        }, (err, data) => {
          if (err === 'captcha' || err === 'captcha-pause') { resolve('captcha'); return; }
          if (err === 'timeout' || err === 'timeout_unknown' || err === 'pending') {
            if (!ibOrderStillPresent(order.id,kind)) {
              gbLog(`${tag}: #${order.id} timeout but order gone — treating as OK`);
              resolve('ok');
            } else {
              gbLog(`${tag}: #${order.id} timeout_unknown — no retry`);
              resolve('unknown');
            }
            return;
          }
          // Local gates: nothing was posted, so this is not evidence about the
          // payload. Throttle them and never charge them to the learned action.
          if (err === 'tpl-stale' || err === 'budget' || err === 'disabled' || err === 'dryrun'
              || err === 'remembered' || err === 'circuit-open') {
            gbLogT('ib-gate-' + err, 60000, `${tag}: #${order.id} not sent (${err})`);
            resolve('skip');
            return;
          }
          if (err) {
            ibResetLearnedAction(kind, err);
            gbLog(tag + ' complete error: ' + err);
            resolve('err');
            return;
          }
          const e = data && data.error;
          if (e) {
            gbLog(`${tag}: ${live.type} #${order.id} ERR ` + JSON.stringify(data).slice(0, 120));
            resolve('err');
            return;
          }
          finishOk();
        });
      };
      postFree();
    });
  }
  function ibCompleteAll(orders) {
    if (gbLocked('ib')) return;
    const free = (orders || ibOrders()).filter(o => o.isFree);
    if (!free.length) return;
    const ibLockToken = gbLock('ib', Math.max(300000, free.length * (BRIDGE_TIMEOUT_MS + 5000)));
    if (!ibLockToken) return;
    renderBuild();
    let i = 0, done = 0, captcha = false;
    const unlock = () => { gbUnlock('ib', ibLockToken); };

    const watchdog = gbTimeout(unlock, Math.max(30000, free.length * (BRIDGE_TIMEOUT_MS + 5000)));
    (function next() {
      gbLockTouch('ib', ibLockToken);
      if (i >= free.length || captcha) {
        try { gbClearTimeout(watchdog); } catch (_) {}
        unlock();
        gbLog(`instant: completed ${done}/${free.length}${captcha ? ' (captcha abort)' : ''}`);
        if (done) flash(`instant x${done}`);
        gbTimeout(ibScan, 3000);
        return;
      }
      ibComplete(free[i]).then(res => {
        if (res === 'ok' || res === 'accepted') done++;
        if (res === 'captcha') captcha = true;
        i++;
        gbTimeout(next, 400 + Math.random() * 200);
      });
    })();
  }
  function ibScan() {
    const orders = ibOrders();
    renderBuild(orders);
    ibArmNext(orders);
    if (!state.ibAuto || gbLocked('ib')) return;
    const free = orders.filter(o => o.isFree);
    if (!free.length) return;
    // Drop orders already inside a decisionSkips window BEFORE announcing the
    // batch. The scan re-fires every 1-3s (interval + armed timer +
    // visibilitychange), and the order stays free until the countdown really
    // ends, so without this every window produced a wall of
    // "free order(s), auto-completing" / "completed 0/N" with zero progress.
    const live = free.filter(o => {
      const why = ibSkipWhy(o);
      if (!why) return true;
      gbLogT('ib-mem-' + o.town_id + '-' + o.id, 60000, `instant: #${o.id} skipped from memory (${why})`);
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
    const mk = (cls, txt, tip) => { const s = document.createElement('span'); s.className = cls; s.textContent = txt; if (tip) gbTip(s, tip); return s; };
    for (const [town, ords] of byTown) {
      const t = document.createElement('div');
      t.className = 'ib-town';
      t.textContent = town;
      gbTip(t, 'Ciudad a la que pertenecen las ordenes de abajo');
      rows.appendChild(t);
      ords.forEach(o => {
        const r = document.createElement('div');
        r.className = 'ib-row';
        r.appendChild(mk('ib-type', o.type, 'Tipo: construccion o investigacion'));
        r.appendChild(mk('ib-time', fmtHMS(o.display), 'Tiempo restante para acabar la orden'));
        r.appendChild(mk(o.isFree ? 'ib-free' : 'ib-cost',
          o.isFree ? 'FREE' : (o.gold != null ? o.gold + ' gold' : '? gold'),
          o.isFree ? 'Gratis - completable sin gastar oro (umbral)' : 'Coste en oro para completar al instante'));
        rows.appendChild(r);
      });
    }
    status.textContent = (gbLocked('ib') ? 'completing... ' : '') + 'last scan: ' + new Date().toLocaleTimeString();
    gbTip(status, 'Hora del ultimo escaneo de ordenes activas');
    renderAbQueue();
  }


  // ===== Goal Planner / Dependency Graph / Virtual Queue (v1.8) ===============
  // `defensive` (0..1, 0.5 neutral) is the wall/dodge weight; `resource`
  // (-1..+1 per resource) is the transport/planner direction bias. Both are
  // read-only in v4 plan 1.2 - they exist so 1.3 (transport) and 5.1 (resource
  // balancing) read a real contract instead of inventing one later.
  const GOAL_PROFILE_DEFAULTS = {
    custom: { label:'Personalizado', build:{}, research:{}, units:{}, reserve:{}, defensive:0.5, resource:{wood:0,stone:0,iron:0} },
    economy: { label:'Economía', build:{main:15,storage:20,farm:20,market:10,lumber:20,stoner:20,ironer:20}, research:{}, units:{}, reserve:{soft:{wood:5000,stone:5000,iron:5000,population:100}}, defensive:0.3, resource:{wood:1,stone:1,iron:1} },
    balanced: { label:'Equilibrado', build:{main:15,storage:20,farm:25,market:10,lumber:15,stoner:15,ironer:15,barracks:10,docks:10,academy:15,temple:5,wall:10}, research:{}, units:{}, reserve:{soft:{wood:5000,stone:5000,iron:5000,population:120}}, defensive:0.5, resource:{wood:0,stone:0,iron:0} },
    offense_land: { label:'Ofensiva terrestre', build:{main:15,storage:20,farm:25,barracks:20,academy:20}, research:{}, units:{}, reserve:{soft:{wood:5000,stone:5000,iron:5000,population:150}}, defensive:0.2, resource:{wood:0,stone:0,iron:0} },
    defense_land: { label:'Defensiva terrestre', build:{main:15,storage:20,farm:25,barracks:20,wall:20,academy:15}, research:{}, units:{}, reserve:{soft:{wood:5000,stone:5000,iron:5000,population:150}}, defensive:0.6, resource:{wood:0,stone:0,iron:0} },
    offense_naval: { label:'Ofensiva naval', build:{main:15,storage:20,farm:25,docks:20,academy:20}, research:{}, units:{}, reserve:{soft:{wood:7000,stone:5000,iron:7000,population:150}}, defensive:0.2, resource:{wood:0,stone:0,iron:0} },
    defense_naval: { label:'Defensiva naval', build:{main:15,storage:20,farm:25,docks:20,wall:15,academy:15}, research:{}, units:{}, reserve:{soft:{wood:7000,stone:5000,iron:7000,population:150}}, defensive:0.6, resource:{wood:0,stone:0,iron:0} },
    conquest: { label:'Conquista / CS', build:{main:25,storage:25,farm:30,academy:30,docks:20,market:15}, research:{colonize_ship:1}, units:{colonize_ship:1}, reserve:{hard:{wood:10000,stone:10000,iron:10000,population:170}}, defensive:0.4, resource:{wood:0,stone:0,iron:0} },
    favor: { label:'Favor / míticas', build:{main:15,storage:20,farm:25,temple:20,academy:20}, research:{}, units:{}, reserve:{soft:{wood:5000,stone:5000,iron:5000,population:100}}, defensive:0.4, resource:{wood:0,stone:0,iron:0} },
  };
