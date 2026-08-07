  // ---------- incoming dodge + militia + CS detect (Phase 8.12 / 10.2 / 10.6) ----------
  // HIGH RISK - default OFF. Mode: notify | auto
  // C4: queue with states - never mark terminal before send cb; retry failed.
  const DODGE_CHECK_MS = 5000;
  const DODGE_RETRY_MS = 15000;
  const DODGE_FAIL_BACKOFF = [15000, 45000, 120000];
  const DODGE_QUEUE_TTL = 3600000;
  function dodgeQueueLoad() {
    const raw = load(STORE.DODGE_QUEUE, null) || {};
    const cut = Date.now() - DODGE_QUEUE_TTL;
    const out = Object.create(null);
    Object.keys(raw).forEach(k => {
      const e = raw[k];
      if (!e || !(e.ts >= cut)) return;
      // Never restore mid-flight as terminal
      const st = e.state === 'sending' ? 'pending' : e.state;
      out[k] = {
        state: st || 'pending', ts: +e.ts || Date.now(), notified: !!e.notified,
        tries: +e.tries || 0, nextAt: +e.nextAt || 0,
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
          dest: e.dest, type: e.type, hasCs: !!e.hasCs,
        };
      });
      save(STORE.DODGE_QUEUE, out);
    } catch (_) {}
  }
  // movement id -> { state, ts, notified, tries, nextAt, dest, ... }
  const dodgeQueue = dodgeQueueLoad();

  // Canonical hostile command names - never treat incoming/started_at alone as attack
  const DODGE_HOSTILE_TYPES = /^(attack|attack_sea|siege|revolt|colonize|take_over|conquer|portal_attack)$/;
  const DODGE_FRIENDLY_TYPES = /^(support|support_sea|trade|return|spy|farm|reward)$/;
  function dodgeIsHostileMovement(a) {
    const type = String(a.command_name || a.type || a.movement_type || '').toLowerCase().trim();
    if (DODGE_FRIENDLY_TYPES.test(type)) return false;
    if (a.is_attack === true || a.is_attack === 1) return true;
    if (DODGE_HOSTILE_TYPES.test(type)) return true;
    // Explicit attack flag fields used by some client builds
    if (a.command_type === 'attack' || a.movement_type === 'attack') return true;
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
        // skip our own outgoing
        const origin = String(a.origin_town_id || a.home_town_id || '');
        if (myTowns.has(origin) && a.is_attack !== true && a.is_attack !== 1) return;
        if (myTowns.has(origin) && !a.incoming) return;
        const type = String(a.command_name || a.type || a.movement_type || '').toLowerCase();
        const units = a.units || {};
        const hasCs = !!(units.colonize_ship || units.colony_ship);
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
  // Never dodge into a town that is itself under attack - that is how a dodge
  // turns one lost town into two. Falls back to any other town only when every
  // town has something incoming (better out than sitting in the target).
  function dodgeSafeTown(excludeId, incoming) {
    try {
      const uw = gameUw();
      const threatened = new Set();
      (incoming || dodgeIncomingMovements() || []).forEach(m => threatened.add(String(m.dest)));
      const ids = Object.keys((uw.ITowns && uw.ITowns.towns) || {})
        .filter(id => String(id) !== String(excludeId));
      const clean = ids.filter(id => !threatened.has(String(id)));
      if (clean.length) return clean[0];
      if (ids.length) {
        gbLogT('dodge-nosafe', 120000,
          'dodge: every other town has incoming - no safe destination');
        return null;
      }
    } catch (_) {}
    return null;
  }
  // Militia: needs a farm, spare population, and no militia already standing.
  // Any of those missing makes `request_militia` a guaranteed rejection.
  // -> { ok, why } - unreadable field = no block.
  function dodgeCanRaiseMilitia(townId) {
    const farm = gbBuildingLevel(townId, 'farm');
    if (farm != null && farm < 1) return { ok: false, why: 'no farm building' };
    try {
      const uw = gameUw();
      const t = uw.ITowns && uw.ITowns.towns && uw.ITowns.towns[townId];
      const u = (t && t.units && t.units()) || null;
      if (u && +u.militia > 0) return { ok: false, why: 'militia already standing' };
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
      // leave floor of sword/hoplite if configured
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
  function dodgeNotify(mov, entry) {
    if (entry.notified) return;
    entry.notified = true;
    const msg = `incoming ${mov.type || 'atk'} -> town ${mov.dest}` + (mov.hasCs ? ' [CS]' : '') +
      (mov.arrival ? ` ETA ${mov.arrival}` : '');
    gbLog('dodge: ' + msg);
    flash(msg);
    try { alertWebhook('attack', mov); } catch (_) {}
    if (mov.hasCs && state.csAlert !== false) {
      try { alertWebhook('attack', Object.assign({ cs: true }, mov)); } catch (_) {}
    }
    // Militia requires its own toggle + parent/child captcha gate
    if (state.autoMilitia && !captchaPausedAny('militia', 'dodge')) {
      dodgeRaiseMilitia(mov.dest, (err) => {
        if (!err) gbLog(`militia: raised in ${mov.dest}`);
      });
    }
  }
  function dodgeTrySend(entry, mov) {
    if (entry.state === 'sent' || entry.state === 'sending') return;
    if (!state.autoDodge || (state.dodgeMode || 'notify') !== 'auto') {
      entry.state = 'notified';
      return;
    }
    if (captchaPaused('dodge')) return;
    if (gbLocked('dodge')) {
      entry.state = 'pending';
      entry.nextAt = Date.now() + 2000;
      return;
    }
    const safe = dodgeSafeTown(mov.dest);
    const units = dodgeTownUnits(mov.dest);
    if (!safe || !Object.keys(units).length) {
      entry.state = 'pending';
      entry.tries = (entry.tries || 0) + 1;
      const bo = DODGE_FAIL_BACKOFF[Math.min(entry.tries - 1, DODGE_FAIL_BACKOFF.length - 1)];
      entry.nextAt = Date.now() + bo;
      gbLogT('dodge-nousable', 30000, `dodge: no safe town/units for ${mov.dest} (retry)`);
      return;
    }
    entry.state = 'sending';
    gbLock('dodge');
    dodgeSendOut(mov.dest, units, safe, (err) => {
      gbUnlock('dodge');
      if (!err) {
        entry.state = 'sent';
        entry.ts = Date.now();
        gbLog(`dodge: sent units from ${mov.dest} -> ${safe}`);
      } else {
        entry.state = 'failed';
        entry.tries = (entry.tries || 0) + 1;
        const bo = DODGE_FAIL_BACKOFF[Math.min(entry.tries - 1, DODGE_FAIL_BACKOFF.length - 1)];
        entry.nextAt = Date.now() + bo;
        gbLog(`dodge: send failed ${err} (retry in ${Math.round(bo / 1000)}s)`);
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
    // Parent/child: dodge pause alone must not kill militia/CS notify
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
          dest: mov.dest, type: mov.type, hasCs: mov.hasCs,
        };
      }
      if (wantCs || militiaOk || dodgeOk) dodgeNotify(mov, entry);
      if (!dodgeOk) continue;
      if (entry.state === 'sent') continue;
      if (entry.state === 'sending') continue;
      if (entry.nextAt && entry.nextAt > now) continue;
      if (entry.state === 'failed' || entry.state === 'pending' || entry.state === 'notified') {
        dodgeTrySend(entry, mov);
      }
    }
    // prune: gone from map + older than 1h, or terminal sent > 1h
    const cut = now - DODGE_QUEUE_TTL;
    Object.keys(dodgeQueue).forEach(k => {
      const e = dodgeQueue[k];
      if (!live.has(k) && e.ts < cut) delete dodgeQueue[k];
      else if (e.state === 'sent' && e.ts < cut) delete dodgeQueue[k];
    });
    dodgeQueueSave();
  }
