  const EMERGENCY_MIN_RISK = 35;
  const EMERGENCY_LEDGER_GRACE_MS = 600000;
  const EMERGENCY_LEDGER_PRUNE_MS = 3600000;
  function emergencyMinIron() {
    const n = +state.emergencyCaveMinIron;
    return Number.isFinite(n) ? Math.max(1, Math.min(100000, n)) : 50;
  }
  function emergencyConfirmAt() {
    const n = +state.emergencyCaveConfirm;
    return Number.isFinite(n) ? Math.max(0, Math.min(1000000, n)) : 1000;
  }
  function emergencyLedger() {
    if (!state.emergencyLastStash || typeof state.emergencyLastStash !== 'object' || Array.isArray(state.emergencyLastStash)) {
      state.emergencyLastStash = {};
    }
    return state.emergencyLastStash;
  }
  function emergencyLedgerSave() { save(STORE.EMERGENCY_LAST, emergencyLedger()); }
  function emergencyLastStashPrune() {
    const L = emergencyLedger();
    const cut = Date.now() - EMERGENCY_LEDGER_PRUNE_MS;
    let changed = false;
    for (const [k, e] of Object.entries(L)) {
      if (!e || +(e.expires || 0) < cut) { delete L[k]; changed = true; }
    }
    if (changed) emergencyLedgerSave();
  }

  function emergencyStashAmount(info) {
    if (!info || info.iron == null) return 0;
    if (!(info.hideLvl > 0)) return 0;
    let amount = Math.floor(info.iron);

    try {
      const tid = info.town && (info.town.id || (info.town.attributes && info.town.attributes.id));
      const av = tid != null ? plannerAvailable(tid) : null;
      if (av && Number.isFinite(av.iron)) amount = Math.min(amount, Math.floor(av.iron));
    } catch (_) {}
    if (!info.unlimited) {

      if (info.hideCap == null || info.stored == null) return 0;
      const free = Math.floor(info.hideCap - info.stored);
      if (free <= 0) return 0;
      amount = Math.min(amount, free);
    }
    return amount > 0 ? amount : 0;
  }
  function emergencyPlan(townId) {
    if (!caveTownEnabled(townId)) return { ok: false, why: 'town-disabled', amount: 0 };
    let info = null;
    try { info = caveTownInfo(townId); } catch (_) {}
    if (!info) return { ok: false, why: 'town-unreadable', amount: 0 };
    if (!(info.hideLvl > 0)) return { ok: false, why: 'no-hide', amount: 0 };
    const amount = emergencyStashAmount(info);
    if (amount < emergencyMinIron()) return { ok: false, why: 'below-min', amount };
    return { ok: true, why: '', amount, info };
  }

  function emergencyStoreNow(townId, opts, onDone) {
    const done = (err, data) => { if (onDone) onDone(err, data); return err; };
    if (!hostEnabled()) return done('host-disabled');
    if (automationPaused({})) return done('paused');
    if (captchaPausedAny('cave', 'cave-emergency', 'dodge')) return done('captcha');
    const plan = emergencyPlan(townId);
    if (!plan.ok) {
      gbLogT('cave-emergency-skip-' + townId, 300000, `cave-emergency: town ${townId} skipped (${plan.why})`);
      return done('skip:' + plan.why);
    }
    if (plan.amount > emergencyConfirmAt() && !(opts && opts.confirmed)) return done('need-confirm');
    const lockName = `cave-emergency:${String(townId)}`;
    const lockToken = gbLock(lockName, 120000);
    if (!lockToken) return done('busy');
    caveStoreIron(townId, plan.amount, (err, data) => {
      gbUnlock(lockName, lockToken);
      if (!err) gbLog(`cave-emergency: town ${townId} stashed ${plan.amount} iron`);
      else gbLogT('cave-emergency-err', 60000, `cave-emergency: town ${townId} err ${err}`);
      done(err, data);
    }, 'cave-emergency');
  }

  function emergencyScan(reason) {
    emergencyLastStashPrune();
    if (!state.emergencyCaveAuto) return;
    if (!hostEnabled() || automationPaused({})) return;
    if (captchaPausedAny('cave', 'cave-emergency', 'dodge')) return;
    let incoming = [];
    try { incoming = dodgeIncomingMovements() || []; } catch (_) {
      gbLogT('cave-emergency-nobridge', 60000, 'cave-emergency: incoming movements unreadable - no stash');
      return;
    }
    if (!incoming.length) return;
    const L = emergencyLedger();
    const now = Date.now();
    for (const mov of incoming) {
      if (!mov || mov.id == null) continue;
      const key = String(mov.id);
      if (L[key] && +(L[key].expires || 0) > now) continue;
      const eta = dodgeEtaSec(mov);

      if (eta == null) continue;
      if (eta > DODGE_MILITIA_WINDOW_SEC) continue;
      let assess = null;
      try { assess = defenseAssessment(mov); } catch (_) { continue; }
      if (!assess || !(assess.risk >= EMERGENCY_MIN_RISK)) continue;
      const plan = emergencyPlan(mov.dest);
      if (!plan.ok) continue;
      if (gbLocked(`cave-emergency:${String(mov.dest)}`)) continue;

      gbLog(`cave-emergency: ${mov.dest} incoming ${mov.type || 'atk'} in ${fmtSec(eta)} (risk ${assess.risk}) - stashing ${plan.amount}`);
      emergencyStoreNow(mov.dest, { confirmed: true }, (err) => {
        if (!err) {
          const at=Date.now();
          L[key] = { townId: String(mov.dest), ts: at, expires: at + Math.max(0, eta) * 1000 + EMERGENCY_LEDGER_GRACE_MS };
          emergencyLedgerSave();
        } else {
          gbLogT('cave-emergency-retry-'+key,30000,`cave-emergency: ${mov.dest} not committed (${err}); next scan may retry`);
        }
      });
      return;
    }
  }

  function emergencyStashAllNow() {
    const ids = (typeof caveListTownIds === 'function') ? caveListTownIds() : [];
    const plans = ids.map(id => ({ id, plan: emergencyPlan(id) })).filter(x => x.plan.ok);
    if (!plans.length) { flash('nada que guardar en la cueva ahora'); return 0; }
    const total = plans.reduce((a, x) => a + x.plan.amount, 0);
    if (total > emergencyConfirmAt()) {
      let ok = false;
      try { ok = gameUw().confirm(`Guardar ${total} de plata en la cueva de ${plans.length} ciudad(es) ahora?`); } catch (_) { ok = false; }
      if (!ok) { gbLog('cave-emergency: manual stash declined'); return 0; }
    }
    plans.forEach((x, i) => gbTimeout(() => emergencyStoreNow(x.id, { confirmed: true }, () => {}), i * 900));
    flash(`guardando ${total} de plata en ${plans.length} ciudad(es)`);
    return plans.length;
  }
  function tradeTownRes(townId) {
    const uw = gameUw();
    try {
      const t = gbTownModel(townId);
      if (!t) return null;
      const r = t.resources && t.resources();
      let cap = null, tradeCap = null, pop = null, small = false;
      try { if (t.getStorageCapacity) cap = gbNum(t.getStorageCapacity()); } catch (_) {}
      if (!(cap > 0)) { const shared = townResState(townId); if (shared) cap = shared.cap; }
      try { if (t.getAvailableTradeCapacity) tradeCap = gbNum(t.getAvailableTradeCapacity()); } catch (_) {}
      try { if (t.getAvailablePopulation) pop = gbNum(t.getAvailablePopulation()); } catch (_) {}
      try {
        const a = t.attributes || (t.get && t.get('on_small_island') != null ? { on_small_island: t.get('on_small_island') } : {});
        small = !!(a.on_small_island || (t.isOnSmallIsland && t.isOnSmallIsland()));
      } catch (_) {}
      const finiteOrNull = value => gbNum(value);
      return {
        id: +townId,
        wood: finiteOrNull(r && r.wood), stone: finiteOrNull(r && r.stone), iron: finiteOrNull(r && r.iron),
        cap: finiteOrNull(cap), tradeCap: finiteOrNull(tradeCap), pop: finiteOrNull(pop), small,
        known: !!r && finiteOrNull(cap) != null && finiteOrNull(tradeCap) != null,
      };
    } catch (_) { return null; }
  }
  function tradeTownEnabled(townId) {
    const id = String(townId);
    const map = state.tradeTowns || {};
    // Backwards compatible: towns not present in the map participate by default.
    return map[id] !== false;
  }
