  // ---------- military helpers (Phase 10.3-10.5 / 11.2) ----------
  // Defense pull, outgoing cancel/recall (confirm), harassment presets,
  // hero assign/unassign/cancel-travel (confirm). No auto loops.

  const HARASS_CAPS = { '1sling': 1, '5sling': 5, light: 8 };
  const HARASS_PREF = ['slinger', 'rider', 'archer', 'hoplite', 'sword'];

  function militaryDefensePull(targetTownId, onDone) {
    if (!hostEnabled() || captchaPaused('attack') || automationPaused({})) return onDone && onDone('paused');
    if (gbLocked('defense-pull')) return onDone && onDone('busy');
    const uw = gameUw();
    const targetCoords = townCoords(targetTownId);
    const target = {
      town_id: +targetTownId,
      x: targetCoords.x,
      y: targetCoords.y,
      island: targetCoords.island,
    };
    const jobs = [];
    try {
      for (const id of Object.keys((uw.ITowns && uw.ITowns.towns) || {})) {
        if (String(id) === String(targetTownId)) continue;
        const t = uw.ITowns.towns[id];
        const u = Object.assign({}, t.units && t.units());
        delete u.militia;
        // send defensive land stack
        const send = {};
        ['sword', 'archer', 'hoplite', 'rider', 'chariot'].forEach(k => {
          if (+u[k] > 0) send[k] = +u[k];
        });
        if (!Object.keys(send).length) continue;
        const same = isSameIsland(id, target);
        if (!same) {
          // Off-island land units need transporters - add boats or skip.
          Object.keys(u).forEach(uid => {
            const m = unitMeta(uid);
            if (m && (m.capacity > 0 || m.berth > 0) && +u[uid] > 0) send[uid] = +u[uid];
          });
          const boats = boatCapacityCheck(send, false);
          if (!boats.ok) {
            gbLogT('def-pull-boats-' + id, 60000,
              `defense-pull: skip town ${id} -> ${targetTownId} (${boats.reason || 'no transport'})`);
            continue;
          }
        }
        jobs.push({ from: id, units: send });
        if (jobs.length >= 5) break;
      }
    } catch (_) {}
    if (!jobs.length) return onDone && onDone('no-units');
    gbLock('defense-pull');
    let i = 0, done = 0;
    (function next() {
      if (i >= jobs.length) {
        gbUnlock('defense-pull');
        gbLog(`defense-pull: ${done}/${jobs.length} -> ${targetTownId}`);
        return onDone && onDone(null, done);
      }
      const j = jobs[i++];
      sendAttackViaBridge({ town_id: +targetTownId, kind: 'town' }, j.from, j.units, 'support', (err) => {
        if (!err) done++;
        gbTimeout(next, 700 + Math.random() * 400);
      });
    })();
  }

  // Light harassment stack - small offense only, never full town dump.
  function selectHarassmentUnits(townId, preset) {
    const live = townLiveUnits(townId);
    const out = {};
    const key = String(preset || 'light');
    const cap = HARASS_CAPS[key] != null ? HARASS_CAPS[key] : (+preset || 5);
    if (key === '1sling' || key === '5sling') {
      const have = +live.slinger || 0;
      if (have > 0) out.slinger = Math.min(have, cap);
    } else {
      let left = Math.max(1, cap);
      for (const id of HARASS_PREF) {
        if (left <= 0) break;
        const have = +live[id] || 0;
        if (!have) continue;
        const n = Math.min(have, left);
        out[id] = n;
        left -= n;
      }
    }
    if (!Object.keys(out).length) return out;
    // boats if any land units and transporters present
    let needBoat = false;
    Object.keys(out).forEach(id => {
      const m = unitMeta(id);
      if (m && !m.is_naval) needBoat = true;
    });
    if (needBoat) {
      Object.keys(live).forEach(id => {
        const m = unitMeta(id);
        if (m && m.capacity > 0 && +live[id] > 0) out[id] = +live[id];
      });
    }
    return out;
  }

  function applyHarassPreset(preset) {
    const plan = ensureAttackPlan();
    plan.troopMode = 'harass';
    plan.harassPreset = String(preset || 'light');
    plan.mission = plan.mission || 'attack';
    saveAttackPlan();
    flash('preajuste de hostigamiento: ' + plan.harassPreset + ' (confirma con Enviar ya)');
    gbLog('attack: harass preset ' + plan.harassPreset);
    return plan;
  }

  function militaryMovementsUnitsModels() {
    const uw = gameUw();
    const models = [];
    const seen = new Set();
    const push = (m) => {
      if (!m) return;
      const id = m.id != null ? m.id : (m.attributes && m.attributes.id);
      const k = String(id != null ? id : '');
      if (k && seen.has(k)) return;
      if (k) seen.add(k);
      models.push(m);
    };
    try {
      const col = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('MovementsUnits');
      if (col && col.models) col.models.forEach(push);
    } catch (_) {}
    try {
      const cols = uw.MM && uw.MM.getCollections && uw.MM.getCollections().MovementsUnits;
      if (cols) {
        const list = Array.isArray(cols) ? cols : [cols];
        list.forEach(c => { if (c && c.models) c.models.forEach(push); });
      }
    } catch (_) {}
    try {
      const map = uw.MM && uw.MM.getModels && uw.MM.getModels().MovementsUnits;
      if (map) Object.keys(map).forEach(k => push(map[k]));
    } catch (_) {}
    return models;
  }

  // Outgoing cancelable unit movements we own (not incoming hostiles).
  function militaryOutgoingMovements() {
    const uw = gameUw();
    const out = [];
    const myTowns = new Set(Object.keys((uw.ITowns && uw.ITowns.towns) || {}).map(String));
    const now = gameNow();
    militaryMovementsUnitsModels().forEach(m => {
      try {
        const a = (m.attributes) || {};
        const home = String(
          (typeof m.getHomeTownId === 'function' && m.getHomeTownId()) ||
          a.home_town_id || a.origin_town_id || ''
        );
        if (!myTowns.has(home)) return;
        const target = String(
          (typeof m.getTargetTownId === 'function' && m.getTargetTownId()) ||
          a.target_town_id || a.destination_town_id || ''
        );
        const incoming = typeof m.isIncomingMovement === 'function'
          ? !!m.isIncomingMovement()
          : (myTowns.has(target) && home !== target);
        if (incoming) return;
        let cancelable = typeof m.isCancelable === 'function'
          ? !!m.isCancelable()
          : (a.cancelable === true || a.cancelable === 1);
        const until = +(typeof m.getCancelableUntil === 'function'
          ? m.getCancelableUntil()
          : a.cancelable_until) || 0;
        if (until > 0 && until <= now) cancelable = false;
        if (!cancelable) return;
        const cmdId = (typeof m.getCommandId === 'function' && m.getCommandId()) ||
          a.command_id || a.id || m.id;
        if (cmdId == null) return;
        const type = String(
          (typeof m.getType === 'function' && m.getType()) ||
          a.type || a.command_name || a.movement_type || ''
        ).toLowerCase();
        const arrival = +(typeof m.getArrivalAt === 'function' && m.getArrivalAt()) ||
          +a.arrival_at || +a.arrived_at || 0;
        out.push({
          id: a.id || m.id,
          commandId: cmdId,
          home, target, type, arrival, until,
          cancelLeft: until > 0 ? Math.max(0, until - now) : null,
        });
      } catch (_) {}
    });
    out.sort((a, b) => (a.arrival || 0) - (b.arrival || 0));
    return out;
  }

  function militaryCancelCommand(commandId, opts, onDone) {
    if (!opts || !opts.confirmed) {
      gbLog('cancel: refused without confirm');
      return onDone && onDone('need-confirm');
    }
    if (!hostEnabled()) return onDone && onDone('disabled');
    if (captchaPaused('cancel') || captchaPaused('attack')) return onDone && onDone('captcha');
    if (automationPaused({})) return onDone && onDone('paused');
    if (gbLocked('cancel')) return onDone && onDone('busy');
    const cmdId = commandId;
    if (cmdId == null || cmdId === '') return onDone && onDone('no-id');
    // Only cancel if still listed as our cancelable outgoing
    const live = militaryOutgoingMovements().find(m => String(m.commandId) === String(cmdId));
    if (!live) {
      gbLog('cancel: command ' + cmdId + ' not cancelable / not found');
      return onDone && onDone('not-cancelable');
    }
    gbLock('cancel');
    const tpl = state.cancelTpl;
    const townId = +(live.home) || +(opts.townId) || undefined;
    const payload = {
      model_url: (tpl && tpl.model_url) || 'Command',
      action_name: (tpl && tpl.action_name) || 'cancelCommand',
      arguments: { id: cmdId },
      town_id: townId,
    };
    const finish = (err, data) => {
      gbUnlock('cancel');
      if (!err) gbLog(`cancel: command ${cmdId} OK`);
      else gbLog(`cancel: command ${cmdId} err ${err}`);
      if (onDone) onDone(err, data);
    };
    bridgePost('cancel', payload, (err, data) => {
      if (!err) return finish(null, data);
      if (err === 'captcha' || err === 'captcha-pause' || err === 'paused' ||
          err === 'budget' || err === 'remembered' || err === 'disabled' || err === 'dryrun') {
        return finish(err);
      }
      // Fallback paths used by command overview / command_info UI
      if (captchaPaused('cancel') || captchaPaused('attack') || automationPaused({}) || !gbLocked('cancel')) {
        return finish('captcha-pause');
      }
      gameAjaxPost('cancel', 'town_overviews', 'cancel_command', { id: cmdId }, (err2, res) => {
        if (!err2) return finish(null, res);
        if (err2 === 'captcha' || err2 === 'captcha-pause' || err2 === 'dryrun') return finish(err2);
        if (captchaPaused('cancel') || captchaPaused('attack') || automationPaused({}) || !gbLocked('cancel')) {
          return finish('captcha-pause');
        }
        gameAjaxPost('cancel', 'command_info', 'cancel_command', { id: cmdId }, finish);
      });
    });
  }

  // ---------- heroes (Phase 11.2) ----------
  function heroesEnabled() {
    try {
      const uw = gameUw();
      if (uw.GameDataHeroes && typeof uw.GameDataHeroes.areHeroesEnabled === 'function') {
        return !!uw.GameDataHeroes.areHeroesEnabled();
      }
      return !!(uw.Game && uw.Game.features && uw.Game.features.heroes_enabled);
    } catch (_) { return false; }
  }

  function playerHeroModels() {
    const out = [];
    const seen = new Set();
    const push = (m) => {
      if (!m) return;
      const id = (typeof m.getId === 'function' && m.getId()) ||
        (m.attributes && (m.attributes.type || m.attributes.id)) || m.id;
      const k = String(id || '');
      if (!k || seen.has(k)) return;
      seen.add(k);
      out.push(m);
    };
    try {
      const col = mmCol('PlayerHero') || mmCol('PlayerHeroes');
      if (col && col.models) col.models.forEach(push);
      if (col && typeof col.getHero === 'function') {
        // collection may expose heroes without models[] populated the same way
      }
    } catch (_) {}
    try {
      const uw = gameUw();
      const map = uw.MM && uw.MM.getModels && uw.MM.getModels().PlayerHero;
      if (map) Object.keys(map).forEach(k => push(map[k]));
    } catch (_) {}
    return out;
  }

  function playerHeroesList() {
    if (!heroesEnabled()) return [];
    const now = gameNow();
    return playerHeroModels().map(m => {
      const a = m.attributes || {};
      const type = (typeof m.getId === 'function' && m.getId()) || a.type || '';
      const name = (typeof m.getName === 'function' && m.getName()) ||
        (a.name) || type;
      const home = +(typeof m.getHomeTownId === 'function' && m.getHomeTownId()) ||
        +a.home_town_id || null;
      const origin = +(typeof m.getOriginTownId === 'function' && m.getOriginTownId()) ||
        +a.origin_town_id || home;
      const arrival = +(typeof m.getArrivalAt === 'function' && m.getArrivalAt()) ||
        +a.town_arrival_at || 0;
      const traveling = typeof m.isTravelingToTown === 'function'
        ? !!m.isTravelingToTown()
        : (arrival > now);
      const injured = typeof m.isInjured === 'function'
        ? !!m.isInjured()
        : (+a.cured_at > now);
      const attacking = typeof m.attacksTown === 'function'
        ? !!m.attacksTown()
        : (a.assignment_type === 'command');
      const assigned = typeof m.isAssignedToTown === 'function'
        ? !!m.isAssignedToTown()
        : (home != null && a.assignment_type === 'town');
      let status = 'free';
      if (injured) status = 'injured';
      else if (attacking) status = 'attacking';
      else if (traveling) status = 'transferring';
      else if (assigned) status = 'assigned';
      return {
        type: String(type),
        name: String(name),
        home, origin, arrival, traveling, injured, attacking, assigned, status,
        level: +(typeof m.getLevel === 'function' && m.getLevel()) || +a.level || 0,
      };
    }).filter(h => h.type);
  }

  function heroTownOccupied(townId, exceptType) {
    const tid = +townId;
    return playerHeroesList().some(h =>
      h.type !== exceptType &&
      ((h.assigned && +h.home === tid) || (h.traveling && +h.home === tid))
    );
  }

  function heroBridgePost(action, heroType, targetTownId, onDone) {
    if (!heroesEnabled()) return onDone && onDone('heroes-off');
    if (!hostEnabled()) return onDone && onDone('disabled');
    if (captchaPaused('hero') || captchaPaused('attack')) return onDone && onDone('captcha');
    if (automationPaused({})) return onDone && onDone('paused');
    if (gbLocked('hero')) return onDone && onDone('busy');
    const type = String(heroType || '');
    if (!type) return onDone && onDone('no-hero');
    const tplMap = state.heroTpl || {};
    const tpl = tplMap[action] || null;
    const args = { type };
    if (targetTownId != null) args.target_town_id = +targetTownId;
    gbLock('hero');
    const payload = {
      model_url: (tpl && tpl.model_url) || 'PlayerHero',
      action_name: (tpl && tpl.action_name) || action,
      arguments: args,
      town_id: targetTownId != null ? +targetTownId : undefined,
    };
    bridgePost('hero', payload, (err, data) => {
      gbUnlock('hero');
      if (!err) gbLog(`hero: ${action} ${type} -> ${targetTownId || '-'} OK`);
      else gbLog(`hero: ${action} ${type} err ${err}`);
      if (onDone) onDone(err, data);
    });
  }

  function heroAssignToTown(heroType, targetTownId, opts, onDone) {
    if (!opts || !opts.confirmed) return onDone && onDone('need-confirm');
    const tid = +targetTownId;
    if (!tid) return onDone && onDone('no-town');
    const hero = playerHeroesList().find(h => h.type === String(heroType));
    if (!hero) return onDone && onDone('missing');
    if (hero.injured) return onDone && onDone('injured');
    if (hero.attacking) return onDone && onDone('attacking');
    if (hero.traveling) return onDone && onDone('transferring');
    if (hero.assigned && +hero.home === tid) return onDone && onDone('already');
    if (heroTownOccupied(tid, hero.type)) {
      gbLog(`hero: town ${tid} already has a hero`);
      return onDone && onDone('town-occupied');
    }
    return heroBridgePost('assignToTown', heroType, tid, onDone);
  }

  function heroUnassign(heroType, opts, onDone) {
    if (!opts || !opts.confirmed) return onDone && onDone('need-confirm');
    const hero = playerHeroesList().find(h => h.type === String(heroType));
    if (!hero) return onDone && onDone('missing');
    if (!hero.assigned && !hero.attacking) return onDone && onDone('not-assigned');
    const townId = hero.origin || hero.home;
    return heroBridgePost('unassignFromTown', heroType, townId, onDone);
  }

  function heroCancelTravel(heroType, opts, onDone) {
    if (!opts || !opts.confirmed) return onDone && onDone('need-confirm');
    const hero = playerHeroesList().find(h => h.type === String(heroType));
    if (!hero) return onDone && onDone('missing');
    if (!hero.traveling) return onDone && onDone('not-traveling');
    const townId = hero.origin || hero.home;
    return heroBridgePost('cancelTownTravel', heroType, townId, onDone);
  }
