  function plannerZero() { return { wood:0, stone:0, iron:0, population:0, tradeCap:0 }; }
  function plannerNormCost(v) {
    if (!v || typeof v !== 'object') return null;
    const out = plannerZero();
    let known = false;
    // gbNum rejects null / '' / [] / false instead of coercing to 0; a
    // malformed cost shape can no longer satisfy the `known` flag with all
    // zeros and slip through the dry-run gate as "affordable".
    for (const k of PLANNER_KEYS) {
      const n = gbNum(v[k]);
      if (n != null && n >= 0) { out[k] = n; known = true; }
    }
    const tc = gbNum(v.tradeCap);
    if (tc != null && tc >= 0) { out.tradeCap = tc; known = true; }
    return known ? out : null;
  }
  function plannerCfgRoot() {
    if (!state.plannerCfg || typeof state.plannerCfg !== 'object' || Array.isArray(state.plannerCfg)) state.plannerCfg = {};
    if (!state.plannerCfg.global || typeof state.plannerCfg.global !== 'object') state.plannerCfg.global = {};
    for (const mode of ['hard','soft']) {
      if (!state.plannerCfg.global[mode] || typeof state.plannerCfg.global[mode] !== 'object') state.plannerCfg.global[mode] = {};
      for (const k of PLANNER_KEYS) state.plannerCfg.global[mode][k] = Math.max(0, +(state.plannerCfg.global[mode][k] || 0));
    }
    if (!state.plannerCfg.towns || typeof state.plannerCfg.towns !== 'object' || Array.isArray(state.plannerCfg.towns)) state.plannerCfg.towns = {};
    return state.plannerCfg;
  }
  function plannerSaveCfg() { plannerCfgRoot(); save(STORE.PLANNER_CFG, state.plannerCfg); }
  function plannerReservePolicy(townId) {
    const cfg = plannerCfgRoot();
    const tc = cfg.towns[String(townId)] || {};
    const out = { hard: plannerZero(), soft: plannerZero() };
    for (const mode of ['hard','soft']) {
      const g = cfg.global[mode] || {}, t = tc[mode] || {};
      for (const k of PLANNER_KEYS) out[mode][k] = Math.max(0, +(g[k] || 0), +(t[k] || 0));
    }
    try {
      const gr = goalReservePolicy(townId);
      if (gr) for (const mode of ['hard','soft']) for (const k of PLANNER_KEYS) out[mode][k] = Math.max(out[mode][k], +(gr[mode] && gr[mode][k] || 0));
    } catch (_) {}
    return out;
  }
  function plannerLive(townId) {
    const st = townResState(townId);
    const pop = gbTownPop(townId);
    let tradeCap = null;
    try { const t = gbTownModel(townId); if (t && t.getAvailableTradeCapacity) tradeCap = +t.getAvailableTradeCapacity(); } catch (_) {}
    if (!st || st.wood == null || st.stone == null || st.iron == null || pop == null) return null;
    return { wood:+st.wood, stone:+st.stone, iron:+st.iron, population:+pop, cap:+st.cap || 0,
      tradeCap:Number.isFinite(tradeCap) ? tradeCap : null };
  }
  function plannerReservationActive(tx) {
    if (!tx || !tx.reservation || tx.reservation.state === 'released') return false;
    if (/^(planned|precheck|sending|confirming|reconciling|unknown)$/.test(tx.state || '')) return true;
    if (tx.state === 'committed' && +(tx.reservation.holdUntil || 0) > Date.now()) return true;
    return false;
  }
  function plannerPendingForTown(townId, excludeIntent) {
    const id = String(townId), out = { outgoing:plannerZero(), incoming:plannerZero(), intents:[] };
    for (const [intent, tx] of Object.entries(state.txState || {})) {
      if (excludeIntent && intent === excludeIntent) continue;
      if (!plannerReservationActive(tx)) continue;
      const r = tx.reservation || {};
      for (const eff of (r.effects || [])) {
        if (!eff || String(eff.townId) !== id) continue;
        const bucket = eff.direction === 'in' ? out.incoming : out.outgoing;
        const c = plannerNormCost(eff.cost) || plannerZero();
        for (const k of [...PLANNER_KEYS,'tradeCap']) bucket[k] += +(c[k] || 0);
        out.intents.push(intent);
      }
    }
    return out;
  }
  function plannerSnapshot(townId, opts) {
    const live = plannerLive(townId);
    if (!live) return null;
    const policy = plannerReservePolicy(townId);
    const pending = plannerPendingForTown(townId, opts && opts.excludeIntent);
    const hard = {}, soft = {};
    for (const k of PLANNER_KEYS) {
      hard[k] = Math.max(0, live[k] - pending.outgoing[k] - policy.hard[k]);
      soft[k] = Math.max(0, hard[k] - policy.soft[k]);
    }
    const tradeAvail = live.tradeCap == null ? null : Math.max(0, live.tradeCap - pending.outgoing.tradeCap);
    return { townId:String(townId), live, reserve:policy, committed:pending.outgoing, incoming:pending.incoming,
      availableHard:Object.assign({}, hard, {tradeCap:tradeAvail}), availableSoft:Object.assign({}, soft, {tradeCap:tradeAvail}), intents:pending.intents };
  }
  function plannerAvailable(townId, opts) {
    const s = plannerSnapshot(townId, opts);
    if (!s) return null;
    return (opts && opts.allowSoft) ? s.availableHard : s.availableSoft;
  }
  function plannerCanReserve(intent, effects, opts) {
    const list = Array.isArray(effects) ? effects : [];
    if (!list.length) return { ok:true };
    const grouped = {};
    for (const eff of list) {
      if (!eff || eff.direction === 'in') continue;
      const tid = String(eff.townId == null ? '' : eff.townId);
      if (!tid) return { ok:false, why:'planner-town-missing' };
      const c = plannerNormCost(eff.cost);
      if (!c) return { ok:false, why:'planner-cost-unknown' };
      if (!grouped[tid]) grouped[tid] = plannerZero();
      for (const k of [...PLANNER_KEYS,'tradeCap']) grouped[tid][k] += +(c[k] || 0);
    }
    for (const [tid, need] of Object.entries(grouped)) {
      const av = plannerAvailable(tid, { allowSoft:!!(opts && opts.allowSoft), excludeIntent:intent });
      if (!av) return { ok:false, why:`planner-live-unreadable:${tid}` };
      for (const k of PLANNER_KEYS) if ((+need[k] || 0) > (+av[k] || 0)) return { ok:false, why:`planner-${k}:${Math.floor(av[k]||0)}/${Math.ceil(need[k]||0)}` };
      if ((+need.tradeCap || 0) > 0 && (av.tradeCap == null || +need.tradeCap > +av.tradeCap)) return { ok:false, why:`planner-tradeCap:${av.tradeCap}/${need.tradeCap}` };
    }
    return { ok:true };
  }
  function plannerEffect(feature, transport, endpoint, data, snapshot) {
    const d = data || {}, a = transport === 'bridge' ? (d.arguments || {}) : d;
    const townId = d.town_id != null ? d.town_id : a.town_id;
    const effects = [];
    const out = (tid,c) => { const n=plannerNormCost(c); if(n) effects.push({townId:String(tid),direction:'out',cost:n}); };
    const inc = (tid,c) => { const n=plannerNormCost(c); if(n) effects.push({townId:String(tid),direction:'in',cost:n}); };
    try {
      if (feature === 'build' && a.building_id && a.order_id == null) {
        const c = abBuildingCost(townId, a.building_id); if (!c) return null; out(townId,c);
      } else if (feature === 'research') {
        const tech=a.id||a.research_id||a.research||a.research_type, c=researchCost(tech,townId); if(!c) return null; out(townId,c);
      } else if (feature === 'recruit') {
        const unit=a.unit_id||a.unit_type, n=+a.amount||0, def=gbGameDataLookup("units", unit); if(!def||!def.resources||!(n>0)) return null;
        out(townId,{wood:(+def.resources.wood||0)*n,stone:(+def.resources.stone||0)*n,iron:(+def.resources.iron||0)*n,population:(+def.population||0)*n});
      } else if (feature === 'trade') {
        const c={wood:+a.wood||0,stone:+a.stone||0,iron:+a.iron||0,tradeCap:(+a.wood||0)+(+a.stone||0)+(+a.iron||0)};
        out(townId,c); if(a.id!=null) inc(a.id,c);
      } else if (feature === 'wonder') {
        out(townId,{wood:+a.wood||0,stone:+a.stone||0,iron:+a.iron||0,tradeCap:(+a.wood||0)+(+a.stone||0)+(+a.iron||0)});
      } else if (feature === 'cave') {
        out(townId,{iron:+a.iron_to_store||0});
      } else return [];
    } catch (_) { return null; }
    return effects;
  }
  function plannerHold(tx, effects) {
    if (!tx) return {ok:false,why:'no-tx'};
    const chk=plannerCanReserve(tx.intent,effects,{allowSoft:false});
    if(!chk.ok) return chk;
    tx.reservation={state:'held',effects:effects||[],createdAt:Date.now(),holdUntil:0};
    txSave(); return {ok:true};
  }
  function plannerRelease(tx, why) {
    if(!tx||!tx.reservation) return;
    tx.reservation.state='released'; tx.reservation.releasedAt=Date.now(); tx.reservation.releaseWhy=why||''; txSave();
  }
  function plannerCommit(tx) {
    if(!tx||!tx.reservation) return;
    tx.reservation.state='committed'; tx.reservation.committedAt=Date.now(); tx.reservation.holdUntil=Date.now()+PLANNER_COMMIT_HOLD_MS; txSave();
  }
  const planner = {
    snapshot: plannerSnapshot,
    available: plannerAvailable,
    reserve(intent, effects, opts){ const fake={intent}; const c=plannerCanReserve(intent,effects,opts); return c.ok?{ok:true,effects}:c; },
    release(intent){ const tx=state.txState&&state.txState[intent]; if(tx) plannerRelease(tx,'api'); },
    commit(intent){ const tx=state.txState&&state.txState[intent]; if(tx) plannerCommit(tx); },
    setReserve(townId, mode, values){ const cfg=plannerCfgRoot(); const root=townId==null?cfg.global:(cfg.towns[String(townId)]||(cfg.towns[String(townId)]={})); root[mode==='soft'?'soft':'hard']=Object.assign({},root[mode==='soft'?'soft':'hard']||{},values||{}); plannerSaveCfg(); },
  };
  try { GB_ROOT.__grepbotPlanner = planner; } catch (_) {}
  // ===== Client fingerprint + Safe Mode (v2.0) ================================
  function clientFingerprintNow() {
    const uw=gameUw(), bs=gameBridgeStatus(); let cols=[];
    try{const c=uw.MM&&uw.MM.getCollections&&uw.MM.getCollections();if(c)cols=Object.keys(c).sort().filter(k=>/Town|Order|Movement|Research|Quest|Hero|Farm/i.test(k)).slice(0,80)}catch(_){}
    const unitN=uw.GameData&&uw.GameData.units?Object.keys(uw.GameData.units).length:0, buildN=uw.GameData&&uw.GameData.buildings?Object.keys(uw.GameData.buildings).length:0, researchN=uw.GameData&&uw.GameData.researches?Object.keys(uw.GameData.researches).length:0;
    return {required:{MM:!!bs.MM,gpAjax:!!bs.gpAjax,ITowns:!!bs.ITowns,GameData:!!bs.GameData},counts:{units:unitN,buildings:buildN,researches:researchN},collections:cols};
  }
  function clientFingerprintCompatible(prev,cur){if(!cur)return{ok:false,why:'fingerprint-unreadable'};for(const k of ['MM','gpAjax','ITowns','GameData'])if(!cur.required[k])return{ok:false,why:`missing-${k}`};if(!prev)return{ok:true,first:true};for(const k of ['MM','gpAjax','ITowns','GameData'])if(prev.required&&prev.required[k]&&!cur.required[k])return{ok:false,why:`lost-${k}`};for(const k of ['units','buildings']){const a=+(prev.counts&&prev.counts[k]||0),b=+(cur.counts&&cur.counts[k]||0);if(a>0&&b>0&&Math.abs(b-a)/a>0.45)return{ok:false,why:`${k}-shape-changed:${a}->${b}`}}return{ok:true}}
  function clientFingerprintCheck() {const cur=clientFingerprintNow(),cmp=clientFingerprintCompatible(state.clientFingerprint,cur);if(!cmp.ok){state.safeMode=true;save(STORE.SAFE_MODE,true);gbLog(`SAFE MODE: Grepolis client compatibility check failed (${cmp.why})`);whyNote('system','client fingerprint','blocked',cmp.why);}else if(!state.clientFingerprint){state.clientFingerprint=cur;save(STORE.CLIENT_FP,cur);}else{state.clientFingerprint=cur;save(STORE.CLIENT_FP,cur);}return{current:cur,check:cmp}}
  function safeModeBlock(feature,transport,endpoint,data){if(gbNeverStop())return null;if(!state.safeMode)return null;const f=String(feature||'');if(['attack','support','spy','favor','wonder','rurallevel','merchant','spell','airaw'].includes(f))return 'safe-mode-high-impact';if(f==='culture'){const a=transport==='bridge'?(data&&data.arguments||{}):(data||{});if(/olympic/i.test(String(a.celebration_type||endpoint||'')))return 'safe-mode-premium';}return null}
  const CIRCUIT_TRIP = 3;
  const CIRCUIT_STRUCTURAL_RE = /unknown.?action|invalid.?action|unknown.?model|model.?not.?found|unknown.?controller|controller.?not.?found|no.?such.?action|does.?not.?exist|unsupported.?action|invalid.?model|endpoint.?not.?found/i;
  function circuitSave() { save(STORE.CIRCUITS, state.circuits || {}); }
  function circuitState(feature) {
    if (!state.circuits || typeof state.circuits !== 'object') state.circuits = {};
    return state.circuits[feature] || null;
  }
  // ===== Circuit half-open recovery (v4 plan 8.1) ============================
  // The breaker used to open permanently until a hand-clear. It now cools down
  // and HALF-OPENS: the next attempt becomes a probe, a success closes it, and
  // a failure re-opens with a doubled cooldown up to an hour. That is the whole
  // difference between "a dead endpoint stops the bot forever" and "a transient
  // outage costs one cooldown".
  const CIRCUIT_COOLDOWN_BASE_MS = 15 * 60 * 1000;
  const CIRCUIT_COOLDOWN_MAX_MS = 60 * 60 * 1000;
  function circuitCooldownMs(c) {
    const n = +((c && c.cooldownMs) || CIRCUIT_COOLDOWN_BASE_MS);
    return Math.max(60000, Math.min(CIRCUIT_COOLDOWN_MAX_MS, n));
  }
  function circuitOpen(feature) {
    if (gbNeverStop()) return false;
    const c = circuitState(feature);
    if (!c || !c.open) return false;
    if (state.circuitAutoClear === false) return true;
    // Elapsed cooldown does not CLOSE the breaker - it lets exactly one probe
    // through. Closing on a timer alone would forget that the endpoint was
    // broken without ever testing it.
    if (c.halfOpen) return false;
    if (+c.openedAt && Date.now() - +c.openedAt >= circuitCooldownMs(c)) {
      c.halfOpen = true;
      circuitSave();
      gbLog(`CIRCUIT HALF-OPEN: ${feature} - next attempt is a probe`);
      return false;
    }
    return true;
  }
  function circuitNote(feature, err) {
    if (!feature || !err || err === 'timeout' || err === 'timeout_unknown' || err === 'captcha' || err === 'captcha-pause') return;
    const msg = String(err);
    if (!CIRCUIT_STRUCTURAL_RE.test(msg)) return;
    const c = circuitState(feature) || { strikes: 0, open: false };
    c.strikes = (c.strikes || 0) + 1;
    c.lastError = msg.slice(0, 160);
    c.lastAt = Date.now();
    if (c.halfOpen) {
      // The probe failed: re-open and back off, so a genuinely dead endpoint is
      // retried ever less often instead of every cooldown.
      c.halfOpen = false;
      c.cooldownMs = Math.min(CIRCUIT_COOLDOWN_MAX_MS, circuitCooldownMs(c) * 2);
      c.open = true;
      c.openedAt = Date.now();
      state.circuits[feature] = c;
      circuitSave();
      gbLog(`CIRCUIT RE-OPEN: ${feature} probe failed, next retry in ${Math.round(c.cooldownMs / 60000)}min`);
      return;
    }
    if (c.strikes >= CIRCUIT_TRIP) {
      c.open = true;
      c.openedAt = Date.now();
      c.cooldownMs = c.cooldownMs || CIRCUIT_COOLDOWN_BASE_MS;
      gbLog(`CIRCUIT OPEN: ${feature} disabled after ${c.strikes} structural errors: ${c.lastError}`);
      try { flash(`circuit: ${feature} disabled`); } catch (_) {}
    }
    state.circuits[feature] = c;
    circuitSave();
  }
  function circuitSuccess(feature) {
    const c = circuitState(feature);
    if (!c) return;
    // A HALF-OPEN breaker whose probe succeeded must close. The old guard bailed
    // on `c.open`, so once tripped the breaker could only ever be cleared by
    // hand - the recovery half of the state machine never ran.
    if (c.halfOpen || c.open) {
      delete state.circuits[feature];
      circuitSave();
      gbLog(`CIRCUIT CLOSED: ${feature} recovered`);
      return;
    }
    if (!c.strikes) return;
    c.strikes = 0;
    c.lastError = '';
    state.circuits[feature] = c;
    circuitSave();
  }
  function circuitClear(feature) {
    if (feature) delete state.circuits[feature];
    else state.circuits = {};
    circuitSave();
  }
  const TX_WRITE_FEATURES = new Set([
    'farm', 'collect', 'bandit', 'build', 'instant-build', 'instant-research', 'cave', 'culture', 'trade', 'ruraltrade', 'rurallevel',
    'research', 'merchant', 'favor', 'wonder', 'militia', 'dodge', 'spell', 'recruit', 'villrecruit', 'quest', 'attack',
    'cancel', 'hero', 'pttrade',

    'support', 'spy',

    // emergency.js posts caveStoreIron under its OWN feature key so its captcha
    // ladder and circuit are separate from routine cave stashing. Unlisted, it
    // took the READ path and skipped dry run, the breaker, safe mode, dedup,
    // the planner and the budget on an irreversible resource move.
    'cave-emergency',

    // Raw passthrough. Its producer (relay.js) was removed; the entry stays
    // because it MUST be in the write set: txRun only applies dry-run, the
    // circuit breaker, safe mode, template health, tx dedup and the planner to
    // features listed here. An unlisted feature silently takes the READ path
    // and skips all of it -- which for an arbitrary raw payload is the whole
    // guard.
    'airaw'
  ]);
  const TX_TERMINAL_TTL = 30 * 60 * 1000;
  const TX_INSTANT_TOMBSTONE_TTL = 24 * 60 * 60 * 1000;
  const TX_UNKNOWN_RECHECK_MS = 60 * 1000;
  const TX_UNKNOWN_MAX_MS = 6 * 60 * 60 * 1000;
  // manual-review is the only state nothing ever prunes - by design, it is a
  // blocking tombstone waiting on a human. Left completely unbounded it also
  // grew without limit (a live account reached 213 of them, each still carrying
  // its full reconciliation snapshot, and every Preflight shouted about all of
  // them). So: strip the payload the moment reconciliation is abandoned, and
  // cap how many whole tombstones are kept - dropping only ones older than
  // TX_REVIEW_MIN_AGE_MS, oldest first, with a log line. Nothing here is
  // silent, and nothing younger than a week can be dropped.
  const TX_REVIEW_MAX = 100;
  const TX_REVIEW_MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  let txSeq = 0;
  if (!state.txState || typeof state.txState !== 'object' || Array.isArray(state.txState)) state.txState = {};
  (function txLoadNormalize() {
    const now = Date.now();
    // Two passes on purpose. One pass could take an entry sending -> unknown ->
    // manual-review in a single go (an entry carrying an old unknownAt from an
    // earlier episode skips the whole 6h ambiguity window), which turns a plain
    // reload into a tombstone nobody can clear except by hand.
    const justUnknown = new Set();
    for (const key of Object.keys(state.txState)) {
      const t = state.txState[key];
      if (!t || typeof t !== 'object') { delete state.txState[key]; continue; }
      if (t.state === 'sending' || t.state === 'confirming' || t.state === 'reconciling') {
        t.state = 'unknown';
        t.unknownAt = now;
        t.detail = 'reloaded while in-flight';
        justUnknown.add(key);
      }
    }
    for (const key of Object.keys(state.txState)) {
      const t = state.txState[key];
      if (!t) continue;
      const terminal = /^(committed|failed|aborted|dryrun)$/.test(t.state || '');
      const terminalTtl=t.state==='committed'&&t.snapshot&&t.snapshot.kind==='instant'?TX_INSTANT_TOMBSTONE_TTL:TX_TERMINAL_TTL;
      if (terminal && now - (+t.updatedAt || +t.createdAt || 0) > terminalTtl) { delete state.txState[key]; continue; }
      if (justUnknown.has(key)) continue;
      if (t.state === 'unknown' && now - (+t.unknownAt || +t.updatedAt || 0) > TX_UNKNOWN_MAX_MS) {
        // Never silently retry an ancient ambiguous write. Keep a blocking
        // tombstone until the user explicitly clears it — but DO drop the
        // planner reservation: plannerReservationActive() already reports
        // manual-review as inactive, so leaving reservation.state held made the
        // budget and the reservation ledger disagree for as long as the
        // tombstone lived.
        t.state = 'manual-review';
        t.detail = 'unknown outcome expired; manual review required';
        t.updatedAt = now;
        plannerRelease(t, 'manual-review');
      }
    }
    save(STORE.TX_STATE, state.txState);
  })();
