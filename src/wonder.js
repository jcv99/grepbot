  let wonderSpentToday = wonderLoadSpent();
  function wonderCoords() {
    const cfg = state.wonderCfg || {};
    const x = Number(cfg.islandX != null ? cfg.islandX : cfg.island_x);
    const y = Number(cfg.islandY != null ? cfg.islandY : cfg.island_y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: Math.trunc(x), y: Math.trunc(y) };
  }
  function wonderCoordLabel(c) { return c ? `${c.x}/${c.y}` : '\u2014'; }
  function wonderScan(reason) {
    if (!hostEnabled() || !state.autoWonder || captchaPaused('wonder')) return;
    if (automationPaused({})) return;
    if (gbLocked('wonder')) return;
    const cfg = state.wonderCfg || {};
    const coords = wonderCoords();
    if (!coords) {
      gbLogT('wonder-noid', 300000,
        'wonder: set wonderCfg.islandX / wonderCfg.islandY (island coords of the wonder \u2014 wonderId is not what the server reads)');
      return;
    }
    const day = gbServerDay();
    if (wonderSpentToday.day !== day) wonderSpentToday = { day, amount: 0 };
    const budgetN = Number(cfg.budget);
    const budget = Number.isFinite(budgetN) ? Math.max(0, budgetN) : 50000;
    if (budget <= 0) { gbLogT('wonder-off-budget', 300000, 'wonder: budget is 0 \u2014 no donations'); return; }
    if (wonderSpentToday.amount >= budget) {
      gbLogT('wonder-budget', 300000, `wonder: daily budget ${budget} reached`);
      return;
    }
    const reserveN = Number(cfg.reserve);
    const reserve = Number.isFinite(reserveN) ? Math.max(0, reserveN) : 5000;
    const want = {
      wood: +cfg.wood || 0,
      stone: +cfg.stone || 0,
      iron: +cfg.iron || 0,
    };
    if (!(want.wood || want.stone || want.iron)) {
      gbLogT('wonder-noamount', 300000, 'wonder: donation amounts are all 0 \u2014 no implicit donation');
      return;
    }
    const towns = (typeof tradeListTowns === 'function') ? tradeListTowns() : [];
    let job = null;
    for (const t of towns) {

      const cap = gbNum(t.tradeCap);
      if (cap == null || cap <= 0) continue;
      let send = {
        wood: Math.max(0, Math.min(want.wood, t.wood - reserve)),
        stone: Math.max(0, Math.min(want.stone, t.stone - reserve)),
        iron: Math.max(0, Math.min(want.iron, t.iron - reserve)),
      };
      let total = send.wood + send.stone + send.iron;
      if (total < 500) continue;
      if (total > cap) {
        const scale = cap / total;
        send = {
          wood: Math.floor(send.wood * scale),
          stone: Math.floor(send.stone * scale),
          iron: Math.floor(send.iron * scale),
        };
        total = send.wood + send.stone + send.iron;
      }
      if (total < 500) continue;
      if (wonderSpentToday.amount + total > budget) {
        const scale = (budget - wonderSpentToday.amount) / total;
        if (scale <= 0) continue;
        send.wood = Math.floor(send.wood * scale);
        send.stone = Math.floor(send.stone * scale);
        send.iron = Math.floor(send.iron * scale);
        total = send.wood + send.stone + send.iron;
        if (total < 500) continue;
      }
      job = { townId: t.id, send };
      break;
    }
    if (!job) {
      gbLogT('wonder-idle', 180000, `wonder: no surplus (${scanReason(reason)})`);
      return;
    }
    const fresh = tradeTownRes(job.townId);
    const tot = job.send.wood + job.send.stone + job.send.iron;
    const pav = plannerAvailable(job.townId, {allowSoft:false});

    const pvW = gbNum(pav && pav.wood), pvS = gbNum(pav && pav.stone), pvI = gbNum(pav && pav.iron);
    const frW = gbNum(fresh && fresh.wood), frS = gbNum(fresh && fresh.stone), frI = gbNum(fresh && fresh.iron);
    const freshCap = gbNum(fresh && fresh.tradeCap), plannerCap = gbNum(pav && pav.tradeCap);
    const readableBlock = (freshCap != null && freshCap < tot) || (plannerCap != null && plannerCap < tot)
      || (pvW != null && pvW < job.send.wood) || (pvS != null && pvS < job.send.stone) || (pvI != null && pvI < job.send.iron)
      || (frW != null && frW - job.send.wood < reserve) || (frS != null && frS - job.send.stone < reserve) || (frI != null && frI - job.send.iron < reserve)
      || wonderSpentToday.amount + tot > budget;
    if (readableBlock) {
      gbLogT('wonder-stale-' + job.townId, 60000, 'wonder: final stock/capacity/budget precheck failed');
      return;
    }
    if (!fresh || !pav || [pvW,pvS,pvI,frW,frS,frI,freshCap,plannerCap].some(v => v == null)) {
      gbLogT('wonder-final-blind-' + job.townId, 60000,
        'wonder: final stock or capacity unreadable; server will validate');
    }
    const lockToken = gbLock('wonder');
    if (!lockToken) return;
    const tid = gbNum(job.townId);
    if (tid == null) {
      gbUnlock('wonder', lockToken);
      gbLogT('wonder-town-id', 60000, `wonder: townId unreadable — no post`);
      return;
    }
    gameAjaxPost('wonder', 'wonders', 'send_resources', {
      wood: job.send.wood,
      stone: job.send.stone,
      iron: job.send.iron,
      island_x: coords.x,
      island_y: coords.y,
      town_id: tid,
    }, (err) => {
      gbUnlock('wonder', lockToken);
      if (err === 'timeout' || err === 'timeout_unknown' || err === 'pending') {
        gbLogT('wonder-timeout', 60000, `wonder: timeout_unknown town ${job.townId} \u2014 no fallback/duplicate`);
        return;
      }
      if (!err) {
        wonderSpentToday.amount += tot;
        wonderSaveSpent(wonderSpentToday);
        gbLog(`wonder: town ${job.townId} sent ${tot} to WW ${wonderCoordLabel(coords)}`);
        return;
      }

      gbLogT('wonder-err', 60000, `wonder err ${err}`);
    });
  }

  function defenseMode(){const m=String((state.defenseCfg&&state.defenseCfg.mode)||'notify');return ['notify','safe'].includes(m)?m:'notify'}
