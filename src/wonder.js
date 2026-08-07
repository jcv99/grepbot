  // ---------- World Wonder donations (Phase 8.11 / 12.1) ----------
  // Daily spend persisted world-scoped (I10). Day key from server clock.
  function wonderServerDay() {
    try {
      const now = gameNow();
      const d = new Date(now * 1000);
      return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
    } catch (_) {
      return new Date().toISOString().slice(0, 10);
    }
  }
  function wonderLoadSpent() {
    const day = wonderServerDay();
    const saved = load(STORE.WONDER_SPENT, null);
    if (saved && saved.day === day) return { day, amount: +saved.amount || 0 };
    return { day, amount: 0 };
  }
  function wonderSaveSpent(spent) {
    save(STORE.WONDER_SPENT, { day: spent.day, amount: spent.amount });
  }
  let wonderSpentToday = wonderLoadSpent();

  function wonderScan(reason) {
    if (!hostEnabled() || !state.autoWonder || captchaPaused('wonder')) return;
    if (automationPaused({})) return;
    if (gbLocked('wonder')) return;
    const cfg = state.wonderCfg || {};
    const wonderId = cfg.wonderId;
    if (!wonderId) {
      gbLogT('wonder-noid', 300000, 'wonder: set wonderCfg.wonderId');
      return;
    }
    const day = wonderServerDay();
    if (wonderSpentToday.day !== day) wonderSpentToday = { day, amount: 0 };
    const budget = +cfg.budget || 50000;
    if (wonderSpentToday.amount >= budget) {
      gbLogT('wonder-budget', 300000, `wonder: daily budget ${budget} reached`);
      return;
    }
    const reserve = +cfg.reserve || 5000;
    const want = {
      wood: +cfg.wood || 0,
      stone: +cfg.stone || 0,
      iron: +cfg.iron || 0,
    };
    if (!(want.wood || want.stone || want.iron)) {
      // default: balanced surplus
      want.wood = want.stone = want.iron = 2000;
    }
    const towns = (typeof tradeListTowns === 'function') ? tradeListTowns() : [];
    let job = null;
    for (const t of towns) {
      // tradeCap is TOTAL freighter capacity — wood+stone+iron must fit (I10).
      // tradeCap===0 → no capacity, skip (don't fall through to want.*).
      const cap = +t.tradeCap || 0;
      if (cap <= 0) continue;
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
      gbLogT('wonder-idle', 180000, `wonder: no surplus (${reason || 'scan'})`);
      return;
    }
    gbLock('wonder');
    const tot = job.send.wood + job.send.stone + job.send.iron;
    gameAjaxPost('wonder', 'wonders', 'send_resources', {
      id: +wonderId,
      wood: job.send.wood,
      stone: job.send.stone,
      iron: job.send.iron,
      town_id: +job.townId,
    }, (err) => {
      if (err === 'timeout') {
        gbLogT('wonder-timeout', 60000, `wonder: timeout_unknown town ${job.townId} — no fallback/duplicate`);
        gbUnlock('wonder');
        return;
      }
      if (!err) {
        wonderSpentToday.amount += tot;
        wonderSaveSpent(wonderSpentToday);
        gbLog(`wonder: town ${job.townId} sent ${tot} to WW ${wonderId}`);
        gbUnlock('wonder');
        return;
      }
      // Only alternate controller when the first endpoint deterministically does not exist
      if (!/unknown|not.?found|does.?not.?exist|invalid.?controller|invalid.?action/i.test(String(err))) {
        gbLogT('wonder-err', 60000, `wonder err ${err}`);
        gbUnlock('wonder');
        return;
      }
      gameAjaxPost('wonder', 'factions', 'send_resources', {
        wonder_id: +wonderId,
        wood: job.send.wood, stone: job.send.stone, iron: job.send.iron,
        town_id: +job.townId,
      }, (e2) => {
        gbUnlock('wonder');
        if (!e2) {
          wonderSpentToday.amount += tot;
          wonderSaveSpent(wonderSpentToday);
          gbLog(`wonder: sent via factions from ${job.townId}`);
        } else gbLogT('wonder-err', 60000, `wonder err ${err}/${e2}`);
      });
    });
  }
