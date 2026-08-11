  function dodgeQueueLoad() {
    const raw = load(STORE.DODGE_QUEUE, null) || {};
    const cut = Date.now() - DODGE_QUEUE_TTL;
    const out = Object.create(null);
    Object.keys(raw).forEach(k => {
      const e = raw[k];
      if (!e || !(e.ts >= cut)) return;

      const st = e.state === 'sending' ? 'pending' : e.state;
      out[k] = {
        state: st || 'pending', ts: +e.ts || Date.now(), notified: !!e.notified,
        tries: +e.tries || 0, nextAt: +e.nextAt || 0,
        militiaState: e.militiaState === 'sending' ? 'pending' : (e.militiaState || 'pending'), militiaNextAt:+e.militiaNextAt||0,
        dest: e.dest, type: e.type, hasCs: !!e.hasCs,
      };
    });
    return out;
  }
  function dodgeQueueSave() {
    try {
      const cut = Date.now() - DODGE_QUEUE_TTL;
      const out = {};
      Object.keys(dodgeQueue).forEach(k => {
        const e = dodgeQueue[k];
        if (!e || e.ts < cut) return;
        out[k] = {
          state: e.state === 'sending' ? 'pending' : e.state,
          ts: e.ts, notified: !!e.notified, tries: e.tries || 0, nextAt: e.nextAt || 0,
          militiaState:e.militiaState==='sending'?'pending':(e.militiaState||'pending'),militiaNextAt:+e.militiaNextAt||0,
          dest: e.dest, type: e.type, hasCs: !!e.hasCs,
        };
      });
      save(STORE.DODGE_QUEUE, out);
    } catch (_) {}
  }

  const dodgeQueue = dodgeQueueLoad();

  const DODGE_HOSTILE_TYPES = /^(attack|attack_sea|raid|siege|revolt|colonize|take_over|conquer|portal_attack)$/;
  const DODGE_FRIENDLY_TYPES = /^(support|support_sea|trade|return|spy|farm|reward)$/;
  function dodgeIsHostileMovement(a) {
    const type = String(a.command_name || a.type || a.movement_type || '').toLowerCase().trim();
    if (DODGE_FRIENDLY_TYPES.test(type)) return false;
    if (a.is_attack === true || a.is_attack === 1) return true;
    if (DODGE_HOSTILE_TYPES.test(type)) return true;
    // command_type/movement_type carry their own vocabulary; matching only the
    // literal 'attack' missed raid/siege/revolt on clients that fill these
    // fields instead of command_name.
    const alt = [a.command_type, a.movement_type];
    for (const v of alt) if (DODGE_HOSTILE_TYPES.test(String(v || '').toLowerCase().trim())) return true;
    return false;
  }
  function dodgeIncomingMovements() {
    const uw = gameUw();
    const out = [];
    try {
      const col = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('MovementsUnits');
      if (!col || !col.models) return out;
      const myTowns = new Set(Object.keys((uw.ITowns && uw.ITowns.towns) || {}).map(String));
      col.models.forEach(m => {
        const a = m.attributes || {};
        const dest = String(a.destination_town_id || a.target_town_id || '');
        if (!myTowns.has(dest)) return;
        if (!dodgeIsHostileMovement(a)) return;

        const origin = String(a.origin_town_id || a.home_town_id || '');
        // Own-town origin is only kept when the movement is canonically hostile.
        // The old second test fell back to `a.incoming`, which the v1.5.3 audit
        // rule forbids as a hostility signal (it is set on friendly returns too).
        if (myTowns.has(origin) && a.is_attack !== true && a.is_attack !== 1) return;
        const type = String(a.command_name || a.type || a.movement_type || '').toLowerCase();
        const units = a.units || {};
        const hasCs = !!(units.colonize_ship || units.colony_ship || /^(revolt|colonize|take_over|conquer)$/.test(type));
        out.push({
          id: a.id || m.id,
          dest, origin, type, hasCs,
          arrival: a.arrived_at || a.arrival_at || a.finished_at,
          units,
          model: m,
        });
      });
    } catch (_) {}
    return out;
  }

  function dodgeSafeTown(excludeId, incoming) {
    try {
      const uw = gameUw();
      const threatened = new Set();
      (incoming || dodgeIncomingMovements() || []).forEach(m => threatened.add(String(m.dest)));
      const ids = Object.keys((uw.ITowns && uw.ITowns.towns) || {})
        .filter(id => String(id) !== String(excludeId));
      const clean = ids.filter(id => !threatened.has(String(id)));
      if (clean.length) {
        const src = townCoords(excludeId);
        clean.sort((a,b)=>{const A=townCoords(a),B=townCoords(b);const as=(src.island!=null&&A.island!=null&&String(src.island)===String(A.island))?0:1;const bs=(src.island!=null&&B.island!=null&&String(src.island)===String(B.island))?0:1;if(as!==bs)return as-bs;const da=islandDistance(src.x,src.y,A.x,A.y),db=islandDistance(src.x,src.y,B.x,B.y);return (da==null?1e9:da)-(db==null?1e9:db)});
        return clean[0];
      }
      if (ids.length) {
        gbLogT('dodge-nosafe', 120000, 'dodge: every other town has incoming — no safe destination, evacuation blocked');
        return null;
      }
    } catch (_) {}
    return null;
  }

  function dodgeCanRaiseMilitia(townId) {
    const farm = gbBuildingLevel(townId, 'farm');
    if (farm != null && farm < 1) return { ok: false, why: 'no farm building' };
    try {
      const uw = gameUw();
      const t = uw.ITowns && uw.ITowns.towns && uw.ITowns.towns[townId];
      const u = (t && t.units && t.units()) || null;
      if (u && +u.militia > 0) return { ok: false, why: 'militia already standing' };
      // Militia consumes population; only post when at least one slot is free.
      // Unreadable = unknown = do not block (the server is the authority).
      const avail = t && t.getAvailablePopulation && +t.getAvailablePopulation();
      if (avail != null && Number.isFinite(avail) && avail <= 0) return { ok: false, why: 'no free population' };
    } catch (_) {}
    return { ok: true, why: null };
  }
  function dodgeRaiseMilitia(townId, onDone) {
    const can = dodgeCanRaiseMilitia(townId);
    if (!can.ok) {
      gbLogT('militia-skip-' + townId, 120000, `militia: town ${townId} skipped (${can.why})`);
      return onDone && onDone('skip:' + can.why);
    }
    gameAjaxPost('militia', 'building_farm', 'request_militia', { town_id: +townId }, onDone);
  }
  function dodgeSendOut(townId, units, safeId, onDone) {
    const payload = {
      model_url: 'Town/' + townId,
      action_name: (state.attackTpl && state.attackTpl.action_name) || 'sendUnits',
      arguments: Object.assign({ id: +safeId, type: 'support' }, units),
      town_id: +townId,
    };
    bridgePost('dodge', payload, onDone);
  }
  function dodgeTownUnits(townId) {
    try {
      const uw = gameUw();
      const t = uw.ITowns.towns[townId];
      const u = Object.assign({}, t.units && t.units());
      delete u.militia;
      const floor = +state.dodgeFloor || 0;

      if (floor > 0) {
        ['sword', 'hoplite', 'archer'].forEach(k => {
          if (u[k] > floor) u[k] -= floor;
          else delete u[k];
        });
      }
      Object.keys(u).forEach(k => { if (!(+u[k] > 0)) delete u[k]; });
      return u;
    } catch (_) { return {}; }
  }
  function dodgeSupportValidate(fromTownId, safeTownId, units) {
    if (!safeTownId || !units || !Object.keys(units).length) return { ok: false, why: 'no-destination-or-units' };
    const live = dodgeTownUnits(fromTownId);
    for (const [u, n] of Object.entries(units)) if ((+live[u] || 0) < (+n || 0)) return { ok: false, why: `units-changed:${u}` };
    const same = isSameIsland(fromTownId, { town_id: +safeTownId, id: +safeTownId, kind: 'town', ...townCoords(safeTownId) });
    const boats = boatCapacityCheck(units, same);
    if (!boats.ok) return { ok: false, why: boats.reason || 'transport-capacity' };
    const destGod = recruitTownGod(safeTownId);
    for (const u of Object.keys(units)) {
      const d = unitMeta(u);
      if (!d) return { ok: false, why: `unit-meta:${u}` };
      if (d.god) {
        const need = String(d.god).toLowerCase();
        if (!destGod || destGod !== need) return { ok: false, why: `god-mismatch:${u}` };
      }
    }
    return { ok: true, boats };
  }
  // One definition of the ms-vs-seconds rule. null means UNREADABLE.
  function dodgeArrivalSec(mov) {
    let a = +(mov && mov.arrival);
    if (!Number.isFinite(a) || a <= 0) return null;
    return a > 1e12 ? Math.floor(a / 1000) : a;
  }
  function dodgeEtaSec(mov) {
    const a = dodgeArrivalSec(mov);
    return a == null ? null : Math.max(0, a - gameNow());
  }

  // ===== Counter-snipe detector (v4 plan 3.7 / 5.7) ==========================
  // Groups the incoming on one town into "trains" and reports whether the CS
  // has a snipe window: how long after the previous landing it arrives, and how
  // many friendly returns could land inside that window.
  //
  // Gap arithmetic is a difference of two SERVER arrival stamps, so it is
  // immune to local clock drift; only the ETA display uses gameNow().
  // Pure: it never touches the model, callers pass the list they already have.
  const CS_CLUSTER_GAP_DEFAULT = 900;
  const CS_COVER_DEFAULT = 180;
  const CS_TIGHT_DEFAULT = 5;
  function csCfg() {
    const c = (state.defenseCfg && typeof state.defenseCfg === 'object') ? state.defenseCfg : {};
    const num = (v, d, lo, hi) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
    return {
      on: c.snipeDetect !== false,
      clusterGapSec: num(c.csClusterGapSec, CS_CLUSTER_GAP_DEFAULT, 60, 21600),
      coverSec: num(c.csCoverSec, CS_COVER_DEFAULT, 5, 900),
      tightSec: num(c.csTightSec, CS_TIGHT_DEFAULT, 0, 120),
    };
  }
  function csWaveClusters(incoming) {
    const cfg = csCfg();
    const byTown = new Map();
    for (const mov of (incoming || [])) {
      if (!mov || mov.dest == null) continue;
      const k = String(mov.dest);
      if (!byTown.has(k)) byTown.set(k, []);
      byTown.get(k).push(mov);
    }
    const out = [];
    for (const [dest, list] of byTown) {
      const timed = [];
      let unknownArrival = 0;
      for (const m of list) {
        const at = dodgeArrivalSec(m);
        // An unreadable arrival is counted, never guessed into the ordering:
        // a fabricated stamp would produce a fabricated snipe window.
        if (at == null) { unknownArrival++; continue; }
        timed.push({ at, hasCs: !!m.hasCs, id: m.id });
      }
      timed.sort((a, b) => a.at - b.at);
      if (!timed.length) {
        out.push({ dest, n: list.length, unknownArrival, firstAt: null, lastAt: null, csAt: null, gapSec: null, cover: 0, tightestGapSec: null, verdict: 'unknown' });
        continue;
      }
      // Only the leading cluster matters: a landing more than clusterGapSec
      // after the previous one is a separate wave, not part of this train.
      const cluster = [timed[0]];
      for (let i = 1; i < timed.length; i++) {
        if (timed[i].at - cluster[cluster.length - 1].at > cfg.clusterGapSec) break;
        cluster.push(timed[i]);
      }
      let tightestGapSec = null;
      for (let i = 1; i < cluster.length; i++) {
        const g = cluster[i].at - cluster[i - 1].at;
        if (tightestGapSec == null || g < tightestGapSec) tightestGapSec = g;
      }
      const csIdx = cluster.findIndex(x => x.hasCs);
      const firstAt = cluster[0].at, lastAt = cluster[cluster.length - 1].at;
      if (csIdx < 0) {
        out.push({ dest, n: cluster.length, unknownArrival, firstAt, lastAt, csAt: null, gapSec: null, cover: 0, tightestGapSec, verdict: 'no-cs' });
        continue;
      }
      const csAt = cluster[csIdx].at;
      if (csIdx === 0) {
        // Nothing lands before the CS, so the snipe window cannot be derived
        // from the incoming list alone.
        out.push({ dest, n: cluster.length, unknownArrival, firstAt, lastAt, csAt, gapSec: null, cover: 0, tightestGapSec, verdict: 'cs-solo' });
        continue;
      }
      const gapSec = csAt - cluster[csIdx - 1].at;
      // How many other landings fall inside the coverSec window before the CS.
      let cover = 0;
      for (const x of cluster) if (x.at < csAt && csAt - x.at <= cfg.coverSec) cover++;
      let verdict;
      if (gapSec <= cfg.tightSec) verdict = 'tight';
      else if (cover >= 1) verdict = 'covered';
      else verdict = 'open';
      out.push({ dest, n: cluster.length, unknownArrival, firstAt, lastAt, csAt, gapSec, cover, tightestGapSec, verdict });
    }
    return out;
  }
  const CS_VERDICT_ES = { open: 'ventana abierta', covered: 'cubierta', tight: 'muy justa', 'cs-solo': 'CS sola', 'no-cs': 'sin CS', unknown: 'ilegible' };
  function csTrainLine(train) {
    if (!train) return '';
    const parts = [`tren ${train.n}`, CS_VERDICT_ES[train.verdict] || train.verdict];
    if (train.gapSec != null) parts.push(`ventana ${train.gapSec}s`);
    else if (train.tightestGapSec != null) parts.push(`hueco min ${train.tightestGapSec}s`);
    if (train.cover) parts.push(`cubierta ${train.cover}`);
    if (train.unknownArrival) parts.push(`${train.unknownArrival} sin hora`);
    return parts.join(' \u00b7 ');
  }
  const DODGE_MILITIA_WINDOW_SEC = 15 * 60;
  // ===== Militia smart activation (v4 plan 3.6) ==============================
  // Militia is irreversible: it eats a population slot that does not come back
  // during the wave. Raising it on every sub-15-minute incoming burns it on
  // noise and leaves the town weaker for the hit that actually matters. These
  // gates decide whether THIS incoming is worth it; every existing guard
  // (autoMilitia, captcha, ETA window, pop/farm precondition, the bounded
  // timeout retry) stays exactly as it was.
  const M_MILITIA_FORCE = 50;      // risk at or above this: raise regardless
  const M_MILITIA_SKIP = 10;       // risk below this: skip unless CS
  const M_MILITIA_LOCAL_OK = 400;  // local defense score that can absorb it alone
  const DODGE_MILITIA_GRACE_MS = 3 * 60 * 1000;
  function militiaCfg() {
    const c = (state.militiaCfg && typeof state.militiaCfg === 'object') ? state.militiaCfg : {};
    const num = (v, d, lo, hi) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
    return {
      forceRisk: num(c.forceRisk, M_MILITIA_FORCE, 0, 100),
      skipRisk: num(c.skipRisk, M_MILITIA_SKIP, 0, 100),
      localOk: num(c.localOk, M_MILITIA_LOCAL_OK, 0, 100000),
      graceMs: num(c.graceMs, DODGE_MILITIA_GRACE_MS, 0, 3600000),
    };
  }
  // Reuse the assessment the dodge side of this same loop already computed:
  // defenseSupportOptions inside it is the expensive call and must not be paid
  // twice per movement per tick.
  // Memo lives OUTSIDE the queue entry: the assessment holds live backbone town
  // models, and hanging it on a persisted entry invites a circular-ref throw
  // the first time anything JSON-stringifies that entry.
  const dodgeAssessMemo = Object.create(null);
  function dodgeAssessmentCached(mov, entry) {
    const now = Date.now();
    const key = String(mov && mov.id);
    const hit = dodgeAssessMemo[key];
    if (hit && now - hit.at < 5000) return hit.v;
    let a = null;
    try { a = defenseAssessment(mov); } catch (_) { a = null; }
    if (a) dodgeAssessMemo[key] = { at: now, v: a };
    for (const k of Object.keys(dodgeAssessMemo)) if (now - dodgeAssessMemo[k].at > 60000) delete dodgeAssessMemo[k];
    return a;
  }
  // {yes, why, group} with group in {force, skip, grace}.
  function dodgeShouldMilitia(mov, a, entry) {
    const cfg = militiaCfg();
    // An unreadable assessment is UNKNOWN, not "safe": fall back to the old
    // unconditional behaviour rather than silently withholding the only
    // reinforcement that arrives in time.
    if (!a) return { yes: true, why: 'assessment unreadable - raising', group: 'force' };
    if (mov.hasCs) return { yes: true, why: 'CS incoming', group: 'force' };
    if (a.risk >= cfg.forceRisk) return { yes: true, why: `risk ${a.risk} >= ${cfg.forceRisk}`, group: 'force' };
    // Plan 3.6 contradicts itself here: section 3 lists simultaneous >= 2 under
    // "always raise", section 4 item 4 lists it under "skip". Section 3 wins -
    // several hostiles converging on one town is an escalation, and
    // defenseAssessment already scores it as added risk for exactly that
    // reason. Withholding militia there would be backwards.
    if (a.simultaneous >= 2) return { yes: true, why: `${a.simultaneous} simultaneas`, group: 'force' };
    const local = (a.local && +a.local.score) || 0;
    if (a.risk < cfg.skipRisk && local >= cfg.localOk) {
      return { yes: false, why: `riesgo ${a.risk} < ${cfg.skipRisk} y defensa local ${local} >= ${cfg.localOk}`, group: 'skip' };
    }
    // Gray zone: give the town's own defenders (and any support in flight) a
    // grace window before spending the population slot - but NEVER wait so long
    // that the militia can no longer be raised. The window is clamped to the
    // time actually left, so a movement first seen with 90s to go waits at most
    // a fraction of that instead of finding its grace already exhausted.
    const first = entry && +entry.ts;
    const etaMs = a.eta != null ? a.eta * 1000 : null;
    const wait = etaMs != null ? Math.min(cfg.graceMs, Math.floor(etaMs / 2)) : cfg.graceMs;
    if (first && wait > 0 && Date.now() - first < wait) {
      return { yes: false, why: `zona gris, esperando ${fmtSec(Math.round((wait - (Date.now() - first)) / 1000))}`, group: 'grace' };
    }
    return { yes: true, why: `zona gris agotada (riesgo ${a.risk})`, group: 'grace' };
  }

  function dodgeNotify(mov, entry, train) {
    if (entry.notified) return;
    entry.notified = true;
    const trainTxt = (train && train.verdict !== 'no-cs') ? ' | ' + csTrainLine(train) : '';
    const msg = `incoming ${mov.type || 'atk'} → town ${mov.dest}` + (mov.hasCs ? ' [CS]' : '') +
      (mov.arrival ? ` ETA ${mov.arrival}` : '') + trainTxt;
    gbLog('dodge: ' + msg);
    flash(msg);
    try {
      const payload = Object.assign({}, mov, { cs: !!mov.hasCs });
      if (train && train.verdict !== 'no-cs') payload.snipe = { verdict: train.verdict, gapSec: train.gapSec, cover: train.cover, n: train.n };
      if (!mov.hasCs || state.csAlert !== false) alertWebhook('attack', payload);
    } catch (_) {}

  }
  function dodgeTryMilitia(mov,entry) {
    if(!state.autoMilitia||captchaPausedAny('militia','dodge')||entry.militiaState==='raised'||entry.militiaState==='sending')return;
    const eta=dodgeEtaSec(mov),now=Date.now();if(eta==null||eta>DODGE_MILITIA_WINDOW_SEC||eta<=0){gbLogT('militia-eta-'+mov.dest,60000,`militia: waiting; hostile ETA ${eta==null?'unknown':fmtSec(eta)}`);return}
    if(entry.militiaNextAt&&entry.militiaNextAt>now)return;
    // v4 plan 3.6: decide whether this incoming is worth the population slot.
    // 'skipped' is NOT terminal - the gray-zone branch re-evaluates on the next
    // pass, so a threat that escalates still gets militia.
    const dec = dodgeShouldMilitia(mov, dodgeAssessmentCached(mov, entry), entry);
    if (!dec.yes) {
      entry.militiaState = 'skipped';
      entry.militiaNextAt = now + 20000;
      dodgeQueueSave();
      gbLogT('militia-skip-reason-' + mov.dest, 60000, `militia: ${mov.dest} skipped (${dec.why})`);
      try { whyNote('militia', mov.dest, 'skipped', dec.why); } catch (_) {}
      return;
    }
    const can=dodgeCanRaiseMilitia(mov.dest);
    if(!can.ok){if(/already standing/.test(can.why||'')){entry.militiaState='raised';dodgeQueueSave()}else{entry.militiaState='pending';entry.militiaNextAt=now+30000}return}
    const token=gbLock('militia',30000);if(!token){entry.militiaNextAt=now+2000;return}entry.militiaState='sending';dodgeQueueSave();
    dodgeRaiseMilitia(mov.dest,err=>{gbUnlock('militia',token);if(!err){entry.militiaState='raised';entry.militiaNextAt=0;gbLog(`militia: raised in ${mov.dest} (ETA ${fmtSec(eta)})`)}else if(err==='timeout_unknown'||err==='pending'){entry.militiaState='unknown';entry.militiaNextAt=Date.now() + 5 * 60 * 1000;gbLog(`militia: outcome unknown (${err}); retry bounded to 5min — militia consumes population and re-firing without resolution is unsafe`)}else{entry.militiaState='pending';entry.militiaNextAt=Date.now()+30000;gbLogT('militia-retry-'+mov.dest,30000,`militia: retry scheduled (${err})`)}dodgeQueueSave()});
  }
  // Read-only decision trail (v4 plan 5.4). No post surface; it exists so the
  // operator can see WHY a wave was or was not dodged after the fact.
  const DEFENSE_HISTORY_MAX = 200;
  const DEFENSE_HISTORY_TTL_MS = 3600000;
  function defenseHistoryNote(mov, decision) {
    if (!Array.isArray(state.defenseHistory)) state.defenseHistory = [];
    const a = decision && decision.assessment;
    const row = {
      ts: Date.now(),
      movId: String(mov.id),
      attackType: (a && a.attackType) || String(mov.type || ''),
      risk: a ? a.risk : null,
      band: a ? a.band : null,
      decision: decision && decision.yes ? 'dodge' : 'hold',
      why: (decision && decision.why) || '',
    };
    const last = state.defenseHistory[state.defenseHistory.length - 1];
    // One row per (movement, decision): the 5s loop re-evaluates constantly and
    // an unfiltered append would bury the actual transitions.
    if (last && last.movId === row.movId && last.decision === row.decision && last.band === row.band) return;
    state.defenseHistory.push(row);
    const cut = Date.now() - DEFENSE_HISTORY_TTL_MS;
    while (state.defenseHistory.length && (state.defenseHistory.length > DEFENSE_HISTORY_MAX || state.defenseHistory[0].ts < cut)) {
      state.defenseHistory.shift();
    }
    save(STORE.DEFENSE_HISTORY, state.defenseHistory);
  }
  function dodgeTrySend(entry, mov) {
    if (entry.state === 'sent' || entry.state === 'sending') return;
    if (!state.autoDodge) { entry.state='notified'; return; }
    const incomingNow = dodgeIncomingMovements();
    const decision = defenseShouldDodge(mov, incomingNow);
    try { defenseHistoryNote(mov, decision); } catch (_) {}
    if (!decision.yes) { entry.state='notified'; whyNote('defense',mov.dest,'no-dodge',`${decision.why}; risk=${decision.assessment.risk}`); gbLogT('defense-decide-'+mov.id,60000,`defense: ${mov.dest} no dodge (${decision.why}, risk=${decision.assessment.risk})`); return; }
    if (captchaPaused('dodge')) return;
    if (gbLocked('dodge')) {
      entry.state = 'pending';
      entry.nextAt = Date.now() + 2000;
      return;
    }
    const safe = dodgeSafeTown(mov.dest);
    const units = dodgeTownUnits(mov.dest);
    const valid = dodgeSupportValidate(mov.dest, safe, units);
    if (!valid.ok) {
      entry.state = 'pending';
      entry.tries = (entry.tries || 0) + 1;
      const bo = DODGE_FAIL_BACKOFF[Math.min(entry.tries - 1, DODGE_FAIL_BACKOFF.length - 1)];
      entry.nextAt = Date.now() + bo;
      gbLogT('dodge-nousable', 30000, `dodge: cannot evacuate ${mov.dest} (${valid.why}); retry later`);
      return;
    }
    entry.state = 'sending';
    const lockToken = gbLock('dodge');
    if (!lockToken) { entry.state = 'pending'; entry.nextAt = Date.now() + 2000; return; }
    dodgeSendOut(mov.dest, units, safe, (err, data) => {
      gbUnlock('dodge', lockToken);
      if (!err) {
        entry.state = 'sent';
        entry.ts = Date.now();
        gbLog(`dodge: sent units from ${mov.dest} → ${safe}`);
        try { dodgeReturnRecord(mov, mov.dest, safe, data); } catch (_) {}
      } else {
        entry.tries = (entry.tries || 0) + 1;
        if (err === 'timeout_unknown' || err === 'pending') {
          entry.state = 'unknown';
          entry.nextAt = Date.now() + TX_UNKNOWN_RECHECK_MS;
          gbLog(`dodge: outcome unknown (${err}); bounded recheck in ${Math.round(TX_UNKNOWN_RECHECK_MS/1000)}s — units may have already left`);
        } else {
          entry.state = 'failed';
          const bo = DODGE_FAIL_BACKOFF[Math.min(entry.tries - 1, DODGE_FAIL_BACKOFF.length - 1)];
          entry.nextAt = Date.now() + bo;
          gbLog(`dodge: send failed ${err} (retry in ${Math.round(bo / 1000)}s)`);
        }
      }
      dodgeQueueSave();
    });
  }
  function dodgeScan(reason) {
    if (!hostEnabled()) return;
    if (automationPaused({})) return;
    const wantDodge = state.autoDodge;
    const wantCs = state.csAlert !== false;
    const wantMilitia = state.autoMilitia;
    if (!wantDodge && !wantCs && !wantMilitia) return;

    const dodgeOk = wantDodge && !captchaPaused('dodge');
    const militiaOk = wantMilitia && !captchaPausedAny('militia', 'dodge');
    if (!dodgeOk && !militiaOk && !wantCs) return;
    const incoming = dodgeIncomingMovements();
    // Computed ONCE per pass and shared by every movement in it.
    const trains = (wantCs && csCfg().on) ? csWaveClusters(incoming) : [];
    const trainFor = dest => trains.find(t => String(t.dest) === String(dest)) || null;
    const live = new Set();
    const now = Date.now();
    for (const mov of incoming) {
      const key = String(mov.id);
      live.add(key);
      let entry = dodgeQueue[key];
      if (!entry) {
        entry = dodgeQueue[key] = {
          state: 'pending', ts: now, notified: false, tries: 0, nextAt: 0,
          militiaState:'pending',militiaNextAt:0,
          dest: mov.dest, type: mov.type, hasCs: mov.hasCs,
        };
      }
      entry.hasCs=!!(entry.hasCs||mov.hasCs);entry.type=mov.type||entry.type;entry.dest=mov.dest||entry.dest;
      if (wantCs || militiaOk || dodgeOk) dodgeNotify(mov, entry, trainFor(mov.dest));
      if(militiaOk)dodgeTryMilitia(mov,entry);
      if (!dodgeOk) continue;
      if (entry.state === 'sent') continue;
      if (entry.state === 'sending') continue;
      if (entry.nextAt && entry.nextAt > now) continue;
      if (entry.state === 'failed' || entry.state === 'pending' || entry.state === 'notified' || entry.state === 'unknown') {
        dodgeTrySend(entry, mov);
      }
      // v4 plan 3.2: support only arms for movements dodge did NOT act on, and
      // rides this same 5s loop rather than adding a second timer.
      if (!entry || entry.state !== 'sent') { try { supportTryBurst(mov); } catch (_) {} }
    }
    // dodgeNotify fires once per movement, so a wave added AFTER the first
    // notification would otherwise be invisible. The throttle key carries the
    // verdict and cover count, so a changed picture defeats it while a stable
    // one stays quiet - no extra state needed.
    for (const t of trains) {
      if (t.verdict === 'no-cs') continue;
      gbLogT(`cs-${t.dest}-${t.verdict}-${t.cover}`, 60000,
        `cs: town ${t.dest} ${t.verdict} n=${t.n} gap=${t.gapSec == null ? '?' : t.gapSec}s cover=${t.cover}` +
        (t.unknownArrival ? ` unreadable=${t.unknownArrival}` : ''));
    }
    try { supportScan('dodge'); } catch (_) {}
    try { emergencyScan('dodge'); } catch (_) {}

    const cut = now - DODGE_QUEUE_TTL;
    Object.keys(dodgeQueue).forEach(k => {
      const e = dodgeQueue[k];
      if (!live.has(k) && e.ts < cut) delete dodgeQueue[k];
      else if (e.state === 'sent' && e.ts < cut) delete dodgeQueue[k];
    });
    dodgeQueueSave();
  }
