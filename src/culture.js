  // ---------- auto-culture (Phase 8.2) ----------
  // ModernBot autoParty: building_place/start_celebration { celebration_type, town_id }
  // Types: party (festival), triumph (procession), theater; olympic = 50 gold + Academy 30.
  const CULTURE_CHECK_MS = 90000;
  const CULTURE_COSTS = {
    party: { wood: 15000, stone: 18000, iron: 15000, academy: 30 },
    triumph: { killpoints: 300 },
    theater: { wood: 10000, stone: 12000, iron: 10000, theater: 1, academy: 30 },
    olympic: { gold: 50, academy: 30 }, // premium - never resource-based
  };
  const OLYMPIC_GOLD = 50;
  let cultureLast = null;

  function cultureServerDay() {
    try {
      const now = gameNow();
      const d = new Date(now * 1000);
      return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
    } catch (_) {
      return new Date().toISOString().slice(0, 10);
    }
  }
  function cultureGoldSpentLoad() {
    const day = cultureServerDay();
    const saved = load(wkey(STORE.CULTURE_GOLD_SPENT), null) || load(STORE.CULTURE_GOLD_SPENT, null);
    if (saved && saved.day === day) return { day, amount: +saved.amount || 0 };
    return { day, amount: 0 };
  }
  function cultureGoldSpentSave(spent) {
    save(wkey(STORE.CULTURE_GOLD_SPENT), { day: spent.day, amount: spent.amount });
  }
  // One gold reader for the whole bot (core `gbPlayerGold`) - culture and the
  // merchant sniper must not disagree about how much gold is actually there.
  function culturePlayerGold() { return gbPlayerGold(); }
  function cultureBusyTowns(type) {
    const uw = gameUw();
    const out = new Set();
    try {
      const models = uw.MM && uw.MM.getModels && uw.MM.getModels().Celebration;
      if (!models) return out;
      Object.values(models).forEach(c => {
        const a = (c && c.attributes) || {};
        if (a.celebration_type === type && a.town_id != null) out.add(+a.town_id);
      });
    } catch (_) {}
    return out;
  }
  function cultureKillpointsAvailable() {
    try {
      const uw = gameUw();
      const kp = uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('PlayerKillpoints');
      if (!kp || !kp.attributes) return 0;
      const a = kp.attributes;
      return (+a.att || 0) + (+a.def || 0) - (+a.used || 0);
    } catch (_) { return 0; }
  }
  function cultureCanAfford(townId, type, ledger) {
    const cost = CULTURE_COSTS[type];
    if (!cost) return false;
    if (type === 'olympic') {
      // Premium path: explicit consent + daily budget + Academy 30 + live gold
      if (!state.allowPremiumCulture) return false;
      const spent = ledger && ledger.goldSpent != null ? ledger.goldSpent : cultureGoldSpentLoad().amount;
      const budget = +state.cultureGoldBudget || 0;
      if (!(budget >= OLYMPIC_GOLD) || spent + OLYMPIC_GOLD > budget) return false;
      const gold = ledger && ledger.playerGold != null ? ledger.playerGold : culturePlayerGold();
      if (gold == null || gold < OLYMPIC_GOLD) return false;
    }
    if (cost.killpoints) {
      const kp = ledger && ledger.killpoints != null ? ledger.killpoints : cultureKillpointsAvailable();
      return kp >= cost.killpoints;
    }
    const uw = gameUw();
    let t = null;
    try { t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]); } catch (_) {}
    if (!t) return false;
    try {
      if (cost.academy) {
        const acad = t.getBuildings ? +t.getBuildings().get('academy') : +(t.buildings().attributes || {}).academy;
        if (!(acad >= cost.academy)) return false;
      }
      if (cost.theater) {
        const th = t.getBuildings ? +t.getBuildings().get('theater') : +(t.buildings().attributes || {}).theater;
        if (!(th >= cost.theater)) return false;
      }
      if (cost.gold) return true; // gold already checked above
      const r = (ledger && ledger.res && ledger.res[townId]) || (t.resources && t.resources());
      if (!r) return false;
      if (cost.wood && r.wood < cost.wood) return false;
      if (cost.stone && r.stone < cost.stone) return false;
      if (cost.iron && r.iron < cost.iron) return false;
      return true;
    } catch (_) { return false; }
  }
  function cultureStart(type, townId, onDone) {
    // Map UI names -> game celebration_type
    const map = { festival: 'party', procession: 'triumph', theater: 'theater', olympic: 'olympic' };
    const ctype = map[type] || type;
    if (ctype === 'olympic' && !state.allowPremiumCulture) {
      return onDone && onDone('premium-blocked');
    }
    gameAjaxPost('culture', 'building_place', 'start_celebration', {
      celebration_type: ctype,
      town_id: +townId,
    }, onDone);
  }
  function cultureScan(reason) {
    if (!hostEnabled() || !state.autoCulture || captchaPaused('culture')) return;
    if (automationPaused({})) return;
    if (gbLocked('culture')) return;
    const types = state.cultureTypes || {};
    // Olympic without premium consent is silently skipped (legacy configs)
    const enabled = Object.keys(types).filter(k => {
      if (!types[k]) return false;
      if (k === 'olympic' && !state.allowPremiumCulture) {
        gbLogT('culture-olympic-block', 300000, 'culture: olympic ignored (allowPremiumCulture OFF)');
        return false;
      }
      return true;
    });
    if (!enabled.length) return;
    const ids = (typeof caveListTownIds === 'function') ? caveListTownIds() : [];
    if (!ids.length) {
      try {
        const uw = gameUw();
        Object.keys((uw.ITowns && uw.ITowns.towns) || {}).forEach(id => ids.push(String(id)));
      } catch (_) {}
    }
    // Projected ledgers so multi-job sweeps don't overcommit
    const spentState = cultureGoldSpentLoad();
    const ledger = {
      killpoints: cultureKillpointsAvailable(),
      goldSpent: spentState.amount,
      playerGold: culturePlayerGold(),
      res: {},
    };
    try {
      const uw = gameUw();
      ids.forEach(id => {
        const t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(id) : uw.ITowns.towns[id]);
        if (t && t.resources) ledger.res[id] = Object.assign({}, t.resources());
      });
    } catch (_) {}
    const jobs = [];
    const townHasJob = new Set(); // one celebration policy per city per sweep
    for (const type of enabled) {
      const ctype = ({ festival: 'party', procession: 'triumph', theater: 'theater', olympic: 'olympic' })[type] || type;
      const busy = cultureBusyTowns(ctype);
      for (const id of ids) {
        if (busy.has(+id)) continue;
        if (townHasJob.has(String(id))) continue;
        if (cultureShouldDeferForCave(id)) continue;
        if (!cultureCanAfford(id, ctype, ledger)) continue;
        jobs.push({ type, ctype, id });
        townHasJob.add(String(id));
        // Discount projected costs
        const cost = CULTURE_COSTS[ctype];
        if (cost) {
          if (cost.killpoints) ledger.killpoints -= cost.killpoints;
          if (cost.gold) {
            ledger.goldSpent += cost.gold;
            if (ledger.playerGold != null) ledger.playerGold -= cost.gold;
          }
          if (ledger.res[id] && (cost.wood || cost.stone || cost.iron)) {
            ledger.res[id].wood -= cost.wood || 0;
            ledger.res[id].stone -= cost.stone || 0;
            ledger.res[id].iron -= cost.iron || 0;
          }
        }
        if (jobs.length >= 8) break;
      }
      if (jobs.length >= 8) break;
    }
    if (!jobs.length) {
      gbLogT('culture-idle', 180000, `culture: nothing to start (${reason || 'scan'})`);
      return;
    }
    gbLock('culture');
    let i = 0, done = 0;
    (function next() {
      if (i >= jobs.length) {
        gbUnlock('culture');
        if (done) gbLog(`culture: started ${done}/${jobs.length}`);
        return;
      }
      const job = jobs[i++];
      // Re-validate immediately before each post
      if (!cultureCanAfford(job.id, job.ctype)) {
        gbTimeout(next, 200);
        return;
      }
      cultureStart(job.type, job.id, (err) => {
        if (err === 'captcha' || err === 'captcha-pause') { gbUnlock('culture'); return; }
        if (err === 'timeout') {
          gbLogT('culture-timeout', 60000, `culture: ${job.type} ${job.id} timeout_unknown - stopping batch`);
          gbUnlock('culture');
          return;
        }
        if (!err) {
          done++;
          cultureLast = { type: job.type, townId: job.id, ts: Date.now() };
          gbLog(`culture: ${job.type} town ${job.id}`);
          if (job.ctype === 'olympic') {
            const s = cultureGoldSpentLoad();
            s.amount += OLYMPIC_GOLD;
            cultureGoldSpentSave(s);
          }
          try { if (typeof alertWebhook === 'function') alertWebhook('culture', cultureLast); } catch (_) {}
          gbTimeout(next, 600 + Math.random() * 400);
        } else {
          gbLogT('culture-err-' + job.id, 60000, `culture: ${job.type} ${job.id} err ${err}`);
          // Non-deterministic -> stop batch
          gbUnlock('culture');
        }
      });
    })();
  }
