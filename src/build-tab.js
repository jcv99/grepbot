  function ibSafeFreeThresh(){return Math.min(300-IB_FREE_SERVER_MARGIN_SEC,ibFreeThresh());}
  function ibGoldCost(kind, seconds) {
    try {
      const uw = uwCached();
      const gdi = uw.GameDataInstantBuy;
      if (!gdi || typeof gdi.getPriceForType !== 'function') return null;
      const type = kind === 'research' ? 'research' : 'building';
      const sec = gbNum(seconds);
      if (sec == null) return null;
      const price = gdi.getPriceForType(type, Math.max(0, sec));
      return gbNum(price);
    } catch (_) { return null; }
  }
  function ibIsFreeOrder(timeLeft, gold) {
    const left = gbNum(timeLeft);
    return left != null && left > 0 && left <= ibSafeFreeThresh() && gold === 0;
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

  function ibSkipWhy(order) {
    if (!ibActionFor(order.kind || 'build')) return 'action-unlearned';
    const payload = ibJrnPayload(order);
    const endpoint = String(payload.model_url) + '/' + String(payload.action_name);
    return gbSkipActiveWrite(ibFeatureFor(order.kind || 'build'), 'bridge', endpoint, payload);
  }

  const ibBackoff = Object.create(null);
  const IB_BACKOFF_MS = [300000, 900000, 3600000];
  function ibBackoffKey(order) { return (order.kind || 'build') + ':' + order.id; }
  function ibBackoffEntry(order) { return ibBackoff[ibBackoffKey(order)] || null; }
  function ibBackoffActive(order) {
    const e = ibBackoffEntry(order);
    return !!(e && Date.now() < e.until);
  }
  function ibBackoffNote(order, why) {
    const k = ibBackoffKey(order);
    const prev = ibBackoff[k] || { n: 0 };
    const n = Math.min(prev.n + 1, IB_BACKOFF_MS.length);
    ibBackoff[k] = { n, until: Date.now() + IB_BACKOFF_MS[n - 1], why: String(why || prev.why || 'retry') };
  }
  function ibBackoffClear(order) { delete ibBackoff[ibBackoffKey(order)]; }
  function ibInstantBlockedWhy(kind) {
    if (!hostEnabled()) return gbTabLeader ? 'host-disabled' : 'not-leader';
    const tag = ibFeatureFor(kind || 'build');
    if (captchaPaused(tag)) return 'captcha:' + tag;
    if (captchaPaused('build')) return 'captcha:build';
    if (state.firstPostConfirm && !state.dryRun && !firstPostLiveOk(tag)) return 'first-post-confirm:' + tag;
    const pauseInfo = {};
    if (automationPaused(pauseInfo)) return 'paused:' + (pauseInfo.reason || 'activity');
    return null;
  }
  function ibStaleWhy(live, kind, instantLeft) {
    const positionAllowed = kind === 'build' || (live && live.isHead === true);
    if (!live) return 'stale:missing';
    if (!positionAllowed) return 'stale:not-head';
    if (!live.isFree) return 'stale:not-free';
    if (live.gold !== 0) return 'stale:gold=' + (live.gold == null ? '?' : live.gold);
    if (!(instantLeft > 0)) return 'stale:expired';
    if (instantLeft > ibSafeFreeThresh()) return 'stale:over-thresh';
    return null;
  }

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

      if (o.isFree || !o.isHead || !(o.display > 0)) return;
      const armIn = (o.display * 1000) - thresh;
      if (armIn <= 0) return;
      const key = String(o.town_id) + ':' + (o.kind || 'build');
      const at = now + armIn;
      if (!best[key] || at < best[key]) best[key] = at;
    });
    for (const key of Object.keys(ibFreeTimers)) if (!best[key]) ibClearArmed(key);
    for (const key of Object.keys(best)) {

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
    const finite=(v,positive)=>{const n=gbNum(v);return n!=null&&(!positive||n>0)?n:null};
    const uniqueMin=(rows,get)=>{const vals=rows.map(x=>get(x.r));if(vals.some(v=>v==null))return null;const min=Math.min(...vals),hits=vals.reduce((n,v)=>n+(v===min?1:0),0);return hits===1?rows[vals.indexOf(min)]:null};
    for(const [town,rows] of groups){if(rows.length===1){heads.set(town,rows[0].id);continue}
      const byPos=uniqueMin(rows,r=>finite(r.queue_position??r.position??r.queue_index??r.sort_index,false));
      const byDone=byPos||uniqueMin(rows,r=>finite(r.to_be_completed_at??r.toBeCompletedAt??r.completed_at,true));
      const byCreated=byDone||uniqueMin(rows,r=>finite(r.created_at??r.createdAt,true));

      if(byCreated)heads.set(town,byCreated.id)}
    return heads;
  }
  function ibResearchOrders(names) {
    const now = gameNow();
    const out = [];
    const uw = uwCached();
    const cols = [],colRefs=new Set();
    const addCol=col=>{if(col&&Array.isArray(col.models)&&col.models.length&&!colRefs.has(col)){colRefs.add(col);cols.push(col)}};

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
        const doneAt = gbNum(r.to_be_completed_at ?? r.toBeCompletedAt ?? r.completed_at);
        const rawTime = gbNum(r.research_time);
        const timeLeft = doneAt != null ? Math.max(0, doneAt - now) : rawTime;
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

        const doneAt = gbNum(r.to_be_completed_at ?? r.toBeCompletedAt ?? r.completed_at);
        const rawTime = gbNum(r.building_time);
        const timeLeft = doneAt != null ? Math.max(0, doneAt - now) : rawTime;
        const isFirst = headIds.get(String(r.town_id)) === String(r.id);

        const display = isFirst ? timeLeft : (r.building_time || 0);
        const instantLeft = display;
        const gold = ibGoldCost('build', instantLeft);

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

          isFree: queueFree && ibIsFreeOrder(instantLeft, gold),
          gold,
        });
      });
    });
    return out.concat(research);
  }
  function ibActionFor(kind) {
    const raw = kind === 'research' ? state.ibActionR : state.ibAction;
    return IB_FREE_ACTIONS.has(String(raw)) ? String(raw) : null;
  }
  function ibLearnAction(kind, action) {
    if (!IB_FREE_ACTIONS.has(String(action))) {
      gbLogT('ib-learn-refuse', 60000, 'instant: unsupported action ' + action + ' \u2014 only buyInstant is allowed behind a verified zero-gold guard');
      return;
    }
    if (kind === 'research') { state.ibActionR = action; save(wkey(STORE.IB_ACTION_R), action); }
    else { state.ibAction = action; save(wkey(STORE.IB_ACTION), action); }
    try { tplHealthMarkLearned(kind === 'research' ? 'ibActionR' : 'ibAction'); } catch (_) {}
  }
  function ibComplete(order) {
    return new Promise(resolve => {
      const kind = order.kind || 'build';
      const tag = kind === 'research' ? 'instant-research' : 'instant-build';
      const blocked = ibInstantBlockedWhy(kind);
      if (blocked) { resolve({ res: 'pause', why: blocked }); return; }

      const live = ibFindLiveOrder(order.id, kind);
      const instantLeft = live ? (gbNum(live.instantLeft) ?? gbNum(live.timeLeft)) : null;

      const staleWhy = ibStaleWhy(live, kind, instantLeft);
      if (staleWhy) {
        gbLogT('ib-stale-' + kind + '-' + order.id, 30000,
          `${tag}: #${order.id} no longer safely free (${staleWhy}; instantLeft=${instantLeft}, queueLeft=${live && live.timeLeft}, head=${live && live.isHead}, gold=${live && live.gold})`);
        resolve({ res: 'skip', why: staleWhy });
        return;
      }
      const modelUrl = live.modelUrl || order.modelUrl || ('BuildingOrder/' + order.id);
      const action = ibActionFor(kind);
      if (!action) {
        gbLogT('ib-action-unlearned-' + kind, 60000,
          `${tag}: accion de finalizacion no aprendida - completa una gratis a mano para ensenarla`);
        resolve({ res: 'skip', why: 'action-unlearned' });
        return;
      }
      const intent=`instant:${live.town_id}:${kind}:${order.id}`;
      if(state.txState&&state.txState[intent]&&state.txState[intent].state==='committed'){
        gbLogT('ib-recent-'+kind+'-'+order.id,30000,`${tag}: #${order.id} already accepted; waiting for model update`);
        resolve({ res: 'accepted' });return;
      }
      const finishOk = () => {
        const waits=[0,150,500,1200,2500];let i=0;
        const check=()=>{
          if(!ibOrderStillPresent(order.id,kind)){gbLog(`${tag}: ${live.type} #${order.id} OK`);resolve({ res: 'ok' });return}
          if(i>=waits.length){gbLog(`${tag}: ${live.type} #${order.id} accepted; model update pending`);resolve({ res: 'accepted' });return}
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
          if (err === 'captcha' || err === 'captcha-pause') { resolve({ res: 'captcha', why: String(err) }); return; }
          if (err === 'timeout' || err === 'timeout_unknown' || err === 'pending') {
            if (!ibOrderStillPresent(order.id,kind)) {
              gbLog(`${tag}: #${order.id} timeout but order gone \u2014 treating as OK`);
              resolve({ res: 'ok' });
            } else {
              gbLog(`${tag}: #${order.id} timeout_unknown \u2014 no retry`);
              resolve({ res: 'unknown', why: String(err) });
            }
            return;
          }

          if (err === 'tpl-stale' || err === 'budget' || err === 'disabled' || err === 'dryrun'
              || err === 'remembered' || err === 'circuit-open' || err === 'first-post-confirm') {
            gbLogT('ib-gate-' + err, 60000, `${tag}: #${order.id} not sent (${err})`);
            resolve({ res: 'skip', why: String(err) });
            return;
          }
          if (err && String(err).indexOf('paused:') === 0) {
            resolve({ res: 'pause', why: String(err) });
            return;
          }
          if (err) {
            ibResetLearnedAction(kind, err);
            gbLog(tag + ' complete error: ' + err);
            resolve({ res: 'err', why: String(err) });
            return;
          }
          const e = data && data.error;
          if (e) {
            gbLog(`${tag}: ${live.type} #${order.id} ERR ` + JSON.stringify(data).slice(0, 120));
            resolve({ res: 'err', why: 'server-error' });
            return;
          }
          finishOk();
        });
      };
      postFree();
    });
  }
  function ibCompleteAll(orders, opts) {
    if (gbLocked('ib')) return;
    const auto = !!(opts && opts.auto);
    const free = (orders || ibOrders()).filter(o => o.isFree);
    if (!free.length) return;
    const ibLockToken = gbLock('ib', Math.max(300000, free.length * (BRIDGE_TIMEOUT_MS + 5000)));
    if (!ibLockToken) return;
    renderBuild();
    let i = 0, done = 0, captcha = false;
    const skips = Object.create(null);
    const unlock = () => { gbUnlock('ib', ibLockToken); };

    const watchdog = gbTimeout(unlock, Math.max(30000, free.length * (BRIDGE_TIMEOUT_MS + 5000)));
    (function next() {
      gbLockTouch('ib', ibLockToken);
      if (i >= free.length || captcha) {
        try { gbClearTimeout(watchdog); } catch (_) {}
        unlock();
        let suffix = '';
        if (done < free.length && Object.keys(skips).length) {
          suffix = ' \u2014 ' + Object.keys(skips).map(w => `${w} x${skips[w]}`).join(', ');
        }
        gbLog(`instant: completed ${done}/${free.length}${captcha ? ' (captcha abort)' : ''}${suffix}`);
        if (done) flash(`instant x${done}`);
        if (auto || state.ibAuto) {
          let delay = IB_RESCAN_AFTER_MS;
          if (auto && done === 0 && free.length) {
            const bo = ibBackoffEntry(free[0]);
            const n = bo && bo.n ? bo.n : 1;
            delay = Math.min(90000, IB_RESCAN_AFTER_MS * Math.pow(2, Math.min(5, n)));
          }
          gbTimeout(ibScan, delay);
        }
        return;
      }
      ibComplete(free[i]).then(result => {
        const res = result && result.res ? result.res : result;
        const why = result && result.why ? result.why : '';
        if (res === 'ok' || res === 'accepted') {
          done++;
          ibBackoffClear(free[i]);
        } else {
          if (why) skips[why] = (skips[why] || 0) + 1;
          if (auto && why && (res === 'skip' || res === 'pause' || res === 'err' || res === 'unknown')) ibBackoffNote(free[i], why);
        }
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

    const blockedWhy = ibInstantBlockedWhy(free[0].kind || 'build');
    if (blockedWhy === 'host-disabled' || blockedWhy === 'not-leader') return;
    if (blockedWhy) {
      gbLogT('ib-auto-pause', 60000, `instant: auto-complete blocked (${blockedWhy})`);
      return;
    }

    const live = free.filter(o => {
      if (ibBackoffActive(o)) {
        const e = ibBackoffEntry(o);
        gbLogT('ib-backoff-' + o.town_id + '-' + o.id, 60000,
          `instant: #${o.id} backoff ${fmtSec(Math.max(0, (e.until - Date.now()) / 1000))} (${e.why})`);
        return false;
      }
      const why = ibSkipWhy(o);
      if (!why) return true;
      const source = why === 'action-unlearned' ? 'blocked until a free manual completion teaches the action' : 'skipped from memory';
      gbLogT('ib-mem-' + o.town_id + '-' + o.id, 60000, `instant: #${o.id} ${source} (${why})`);
      return false;
    });
    if (!live.length) return;
    gbLog(`instant: ${live.length} free order(s), auto-completing`);
    ibCompleteAll(live, { auto: true });
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

  const GOAL_PROFILE_DEFAULTS = {
    custom: { label:'Personalizado', build:{}, research:{}, units:{}, reserve:{}, defensive:0.5, resource:{wood:0,stone:0,iron:0} },
    economy: { label:'Econom\u00eda', build:{main:15,storage:20,farm:20,market:10,lumber:20,stoner:20,ironer:20}, research:{}, units:{}, reserve:{soft:{wood:5000,stone:5000,iron:5000,population:100}}, defensive:0.3, resource:{wood:1,stone:1,iron:1} },
    balanced: { label:'Equilibrado', build:{main:15,storage:20,farm:25,market:10,lumber:15,stoner:15,ironer:15,barracks:10,docks:10,academy:15,temple:5,wall:10}, research:{}, units:{}, reserve:{soft:{wood:5000,stone:5000,iron:5000,population:120}}, defensive:0.5, resource:{wood:0,stone:0,iron:0} },
    offense_land: { label:'Ofensiva terrestre', build:{main:15,storage:20,farm:25,barracks:20,academy:20}, research:{}, units:{}, reserve:{soft:{wood:5000,stone:5000,iron:5000,population:150}}, defensive:0.2, resource:{wood:0,stone:0,iron:0} },
    defense_land: { label:'Defensiva terrestre', build:{main:15,storage:20,farm:25,barracks:20,wall:20,academy:15}, research:{}, units:{}, reserve:{soft:{wood:5000,stone:5000,iron:5000,population:150}}, defensive:0.6, resource:{wood:0,stone:0,iron:0} },
    offense_naval: { label:'Ofensiva naval', build:{main:15,storage:20,farm:25,docks:20,academy:20}, research:{}, units:{}, reserve:{soft:{wood:7000,stone:5000,iron:7000,population:150}}, defensive:0.2, resource:{wood:0,stone:0,iron:0} },
    defense_naval: { label:'Defensiva naval', build:{main:15,storage:20,farm:25,docks:20,wall:15,academy:15}, research:{}, units:{}, reserve:{soft:{wood:7000,stone:5000,iron:7000,population:150}}, defensive:0.6, resource:{wood:0,stone:0,iron:0} },
    conquest: { label:'Conquista / CS', build:{main:25,storage:25,farm:30,academy:30,docks:20,market:15}, research:{colonize_ship:1}, units:{colonize_ship:1}, reserve:{hard:{wood:10000,stone:10000,iron:10000,population:170}}, defensive:0.4, resource:{wood:0,stone:0,iron:0} },
    favor: { label:'Favor / m\u00edticas', build:{main:15,storage:20,farm:25,temple:20,academy:20}, research:{}, units:{}, reserve:{soft:{wood:5000,stone:5000,iron:5000,population:100}}, defensive:0.4, resource:{wood:0,stone:0,iron:0} },
  };
  const CD_PROFILE_ALIASES = Object.freeze({
    cd_slinger:'cd_slinger_50ls', cd_slinger_50ls:'cd_slinger_50ls', cd_honderos:'cd_slinger_50ls',
    cd_bireme:'cd_bireme', cd_birras:'cd_bireme',
    cd_lightship:'cd_lightship', cd_ls:'cd_lightship', cd_attack_ship:'cd_lightship', cd_catapult:'cd_lightship',
    cd_trireme:'cd_trireme', cd_trirreme:'cd_trireme',
    cd_defense:'cd_defense', cd_defense_land:'cd_defense'
  });
