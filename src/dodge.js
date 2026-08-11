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
  function dodgeEtaSec(mov) {
    let a = +(mov && mov.arrival);
    if (!Number.isFinite(a) || a <= 0) return null;
    if (a > 1e12) a = Math.floor(a / 1000);
    return Math.max(0, a - gameNow());
  }
  const DODGE_MILITIA_WINDOW_SEC = 15 * 60;

  function dodgeNotify(mov, entry) {
    if (entry.notified) return;
    entry.notified = true;
    const msg = `incoming ${mov.type || 'atk'} → town ${mov.dest}` + (mov.hasCs ? ' [CS]' : '') +
      (mov.arrival ? ` ETA ${mov.arrival}` : '');
    gbLog('dodge: ' + msg);
    flash(msg);
    try {
      if (!mov.hasCs || state.csAlert !== false) alertWebhook('attack', Object.assign({}, mov, { cs: !!mov.hasCs }));
    } catch (_) {}

  }
  function dodgeTryMilitia(mov,entry) {
    if(!state.autoMilitia||captchaPausedAny('militia','dodge')||entry.militiaState==='raised'||entry.militiaState==='sending')return;
    const eta=dodgeEtaSec(mov),now=Date.now();if(eta==null||eta>DODGE_MILITIA_WINDOW_SEC||eta<=0){gbLogT('militia-eta-'+mov.dest,60000,`militia: waiting; hostile ETA ${eta==null?'unknown':fmtSec(eta)}`);return}
    if(entry.militiaNextAt&&entry.militiaNextAt>now)return;const can=dodgeCanRaiseMilitia(mov.dest);
    if(!can.ok){if(/already standing/.test(can.why||'')){entry.militiaState='raised';dodgeQueueSave()}else{entry.militiaState='pending';entry.militiaNextAt=now+30000}return}
    const token=gbLock('militia',30000);if(!token){entry.militiaNextAt=now+2000;return}entry.militiaState='sending';dodgeQueueSave();
    dodgeRaiseMilitia(mov.dest,err=>{gbUnlock('militia',token);if(!err){entry.militiaState='raised';entry.militiaNextAt=0;gbLog(`militia: raised in ${mov.dest} (ETA ${fmtSec(eta)})`)}else if(err==='timeout_unknown'||err==='pending'){entry.militiaState='unknown';entry.militiaNextAt=Date.now() + 5 * 60 * 1000;gbLog(`militia: outcome unknown (${err}); retry bounded to 5min — militia consumes population and re-firing without resolution is unsafe`)}else{entry.militiaState='pending';entry.militiaNextAt=Date.now()+30000;gbLogT('militia-retry-'+mov.dest,30000,`militia: retry scheduled (${err})`)}dodgeQueueSave()});
  }
  function dodgeTrySend(entry, mov) {
    if (entry.state === 'sent' || entry.state === 'sending') return;
    if (!state.autoDodge) { entry.state='notified'; return; }
    const incomingNow = dodgeIncomingMovements();
    const decision = defenseShouldDodge(mov, incomingNow);
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
      if (wantCs || militiaOk || dodgeOk) dodgeNotify(mov, entry);
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
    try { supportScan('dodge'); } catch (_) {}

    const cut = now - DODGE_QUEUE_TTL;
    Object.keys(dodgeQueue).forEach(k => {
      const e = dodgeQueue[k];
      if (!live.has(k) && e.ts < cut) delete dodgeQueue[k];
      else if (e.state === 'sent' && e.ts < cut) delete dodgeQueue[k];
    });
    dodgeQueueSave();
  }
