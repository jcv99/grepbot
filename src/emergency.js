  // ===== Emergency cave mode (v4 plan 3.5) ===================================
  // Two pieces, two toggles: a manual "stash iron now" one-shot that ignores
  // the normal cave threshold, and an auto path that pre-stashes when a
  // high-risk hostile is about to land.
  //
  // HIGH-RISK, auto default OFF. It posts through the SAME caveStoreIron
  // payload the threshold path uses - hardcoded, so there is no learned
  // template to go stale and no TPL_FEATURE_MAP slot - but under its own
  // feature key and its own lock, so an emergency stash is never blocked by a
  // routine one and vice versa.
  //
  // It adds NO scheduler: the auto path rides the existing 5s dodgeScan loop.
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
  // How much iron this town could stash RIGHT NOW, ignoring caveThreshPct.
  // NOTE: this deliberately offers ALL readable iron, not just the excess -
  // denying the raider is the whole point. There is no auto-unstash path, so a
  // town that stashes everything cannot pay an iron cost until it produces
  // more; that is the trade the operator accepts by enabling this.
  // Returns 0 when anything needed is unreadable - an emergency stash must not
  // guess an amount, and 0 simply means "nothing to do this pass".
  function emergencyStashAmount(info) {
    if (!info || info.iron == null) return 0;
    if (!(info.hideLvl > 0)) return 0;
    let amount = Math.floor(info.iron);
    // Never ship iron the planner has already committed elsewhere.
    try {
      const tid = info.town && (info.town.id || (info.town.attributes && info.town.attributes.id));
      const av = tid != null ? plannerAvailable(tid) : null;
      if (av && Number.isFinite(av.iron)) amount = Math.min(amount, Math.floor(av.iron));
    } catch (_) {}
    if (!info.unlimited) {
      // A finite hide whose capacity or fill cannot be read is UNKNOWN, and
      // posting into an unknown container is how the routine path used to
      // over-stash. Refuse rather than guess.
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
  // opts.confirmed is required for any amount over emergencyCaveConfirm.
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
    const lockToken = gbLock('cave-emergency');
    if (!lockToken) return done('busy');
    caveStoreIron(townId, plan.amount, (err, data) => {
      gbUnlock('cave-emergency', lockToken);
      if (!err) gbLog(`cave-emergency: town ${townId} stashed ${plan.amount} iron`);
      else gbLogT('cave-emergency-err', 60000, `cave-emergency: town ${townId} err ${err}`);
      done(err, data);
    }, 'cave-emergency');
  }
  // Auto path: one stash per incoming movement, only while it is imminent and
  // the threat engine agrees it is serious.
  function emergencyScan(reason) {
    emergencyLastStashPrune();
    if (!state.emergencyCaveAuto) return;
    if (!hostEnabled() || automationPaused({})) return;
    if (captchaPausedAny('cave', 'cave-emergency', 'dodge')) return;
    if (gbLocked('cave-emergency')) return;
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

      // A null ETA is UNREADABLE, not "landing now": an emergency stash fired
      // on an unknown clock would break the cave lock for nothing.
      if (eta == null) continue;
      if (eta > DODGE_MILITIA_WINDOW_SEC) continue;
      let assess = null;
      try { assess = defenseAssessment(mov); } catch (_) { continue; }
      if (!assess || !(assess.risk >= EMERGENCY_MIN_RISK)) continue;
      const plan = emergencyPlan(mov.dest);
      if (!plan.ok) continue;

      // Stamp BEFORE the post: a callback that never fires must not leave the
      // same movement free to re-stash on the next 5s pass.
      L[key] = { townId: String(mov.dest), ts: now, expires: now + eta * 1000 + EMERGENCY_LEDGER_GRACE_MS };
      emergencyLedgerSave();
      gbLog(`cave-emergency: ${mov.dest} incoming ${mov.type || 'atk'} in ${fmtSec(eta)} (risk ${assess.risk}) - stashing ${plan.amount}`);
      emergencyStoreNow(mov.dest, { confirmed: true }, () => {});
      return;
    }
  }
  // Manual one-shot across every cave-enabled town.
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
