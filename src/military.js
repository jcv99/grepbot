  function militaryMovementsUnitsModels() {
    const uw = gameUw();
    const models = [], seen = new Set();
    const push = (m) => {
      if (!m) return;
      const a = m.attributes || {};
      const id = (typeof m.getCommandId === 'function' && m.getCommandId()) || a.command_id || a.id || m.id;
      const k = String(id == null ? '' : id);
      if (k && seen.has(k)) return;
      if (k) seen.add(k);
      models.push(m);
    };
    try { const c = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('MovementsUnits'); if (c && c.models) c.models.forEach(push); } catch (_) {}
    try { const cs = uw.MM && uw.MM.getCollections && uw.MM.getCollections().MovementsUnits; (Array.isArray(cs) ? cs : (cs ? [cs] : [])).forEach(c => { if (c && c.models) c.models.forEach(push); }); } catch (_) {}
    return models;
  }
  function militaryOutgoingMovements() {
    const uw = gameUw();
    const out = [];
    const myTowns = new Set(Object.keys((uw.ITowns && uw.ITowns.towns) || {}).map(String));
    const now = gameNow();
    militaryMovementsUnitsModels().forEach(m => {
      try {
        const a = m.attributes || {};
        const home = String((typeof m.getHomeTownId === 'function' && m.getHomeTownId()) || a.home_town_id || a.origin_town_id || '');
        if (!myTowns.has(home)) return;
        const target = String((typeof m.getTargetTownId === 'function' && m.getTargetTownId()) || a.target_town_id || a.destination_town_id || '');
        const incoming = typeof m.isIncomingMovement === 'function' ? !!m.isIncomingMovement() : (myTowns.has(target) && home !== target);
        if (incoming) return;
        let cancelable = null;
        try { if (typeof m.isCancelable === 'function') cancelable = !!m.isCancelable(); } catch (_) {}
        if (cancelable == null && a.cancelable != null) cancelable = a.cancelable === true || a.cancelable === 1;
        const until = +(typeof m.getCancelableUntil === 'function' ? m.getCancelableUntil() : a.cancelable_until) || 0;
        if (until > 0 && until <= now) cancelable = false;
        if (cancelable !== true) return; // fail closed: only explicit cancelable movements
        const commandId = (typeof m.getCommandId === 'function' && m.getCommandId()) || a.command_id || a.id || m.id;
        if (commandId == null) return;
        const type = String((typeof m.getType === 'function' && m.getType()) || a.type || a.command_name || a.movement_type || '').toLowerCase();
        const arrival = +(typeof m.getArrivalAt === 'function' && m.getArrivalAt()) || +a.arrival_at || +a.arrived_at || 0;
        out.push({ commandId, home, target, type, arrival, until, cancelLeft: until > 0 ? Math.max(0, until - now) : null });
      } catch (_) {}
    });
    return out.sort((a, b) => (a.arrival || 0) - (b.arrival || 0));
  }
  function militaryCancelCommand(commandId, opts, onDone) {
    if (!opts || !opts.confirmed) return onDone && onDone('need-confirm');
    if (!hostEnabled() || automationPaused({})) return onDone && onDone('paused');
    if (captchaPausedAny('cancel', 'attack')) return onDone && onDone('captcha');
    const cmdId = commandId == null ? '' : String(commandId);
    if (!cmdId) return onDone && onDone('no-id');
    const live = militaryOutgoingMovements().find(m => String(m.commandId) === cmdId);
    if (!live) return onDone && onDone('not-cancelable');
    const tpl = state.cancelTpl;
    if (!tpl || !tpl.model_url || !tpl.action_name || !/cancel/i.test(String(tpl.action_name))) {
      gbLogT('cancel-template', 60000, 'cancel: no learned canonical template; cancel one command manually first');
      return onDone && onDone('template-required');
    }
    if (txRecentlyCommitted('cancel:' + cmdId, 120000)) return onDone && onDone('already-committed');
    const lockToken = gbLock('cancel');
    if (!lockToken) return onDone && onDone('busy');
    const args = {};
    for (const [k, v] of Object.entries(tpl.arguments || {})) if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') args[k] = v;
    args.id = /^\d+$/.test(cmdId) ? +cmdId : cmdId;
    const payload = { model_url: tpl.model_url, action_name: tpl.action_name, arguments: args, town_id: +live.home || undefined };
    bridgePost('cancel', payload, (err, data) => {
      gbUnlock('cancel', lockToken);
      if (!err) gbLog(`cancel: command ${cmdId} OK`); else gbLog(`cancel: command ${cmdId} err ${err}`);
      if (onDone) onDone(err, data);
    });
  }
  function heroesEnabled() {
    try {
      const uw = gameUw();
      if (uw.GameDataHeroes && typeof uw.GameDataHeroes.areHeroesEnabled === 'function') return !!uw.GameDataHeroes.areHeroesEnabled();
      return !!(uw.Game && uw.Game.features && uw.Game.features.heroes_enabled);
    } catch (_) { return false; }
  }
  function playerHeroModels() {
    const out = [], seen = new Set();
    const push = (m) => {
      if (!m) return;
      const a = m.attributes || {};
      const id = (typeof m.getId === 'function' && m.getId()) || a.type || a.id || m.id;
      const k = String(id || ''); if (!k || seen.has(k)) return; seen.add(k); out.push(m);
    };
    try { const c = mmCol('PlayerHero') || mmCol('PlayerHeroes'); if (c && c.models) c.models.forEach(push); } catch (_) {}
    try { const uw = gameUw(); const map = uw.MM && uw.MM.getModels && uw.MM.getModels().PlayerHero; if (map) Object.values(map).forEach(push); } catch (_) {}
    return out;
  }
  function playerHeroesList() {
    if (!heroesEnabled()) return [];
    const now = gameNow();
    return playerHeroModels().map(m => {
      const a = m.attributes || {};
      const type = (typeof m.getId === 'function' && m.getId()) || a.type || '';
      const name = (typeof m.getName === 'function' && m.getName()) || a.name || type;
      const home = +(typeof m.getHomeTownId === 'function' && m.getHomeTownId()) || +a.home_town_id || null;
      const origin = +(typeof m.getOriginTownId === 'function' && m.getOriginTownId()) || +a.origin_town_id || home;
      const arrival = +(typeof m.getArrivalAt === 'function' && m.getArrivalAt()) || +a.town_arrival_at || 0;
      const traveling = typeof m.isTravelingToTown === 'function' ? !!m.isTravelingToTown() : arrival > now;
      const injured = typeof m.isInjured === 'function' ? !!m.isInjured() : (+a.cured_at > now);
      const attacking = typeof m.attacksTown === 'function' ? !!m.attacksTown() : a.assignment_type === 'command';
      const assigned = typeof m.isAssignedToTown === 'function' ? !!m.isAssignedToTown() : (home != null && a.assignment_type === 'town');
      let status = 'free'; if (injured) status = 'injured'; else if (attacking) status = 'attacking'; else if (traveling) status = 'transferring'; else if (assigned) status = 'assigned';
      return { type: String(type), name: String(name), home, origin, arrival, traveling, injured, attacking, assigned, status, level: +(typeof m.getLevel === 'function' && m.getLevel()) || +a.level || 0 };
    }).filter(h => h.type);
  }
  function heroTownOccupied(townId, exceptType) {
    const tid = +townId;
    return playerHeroesList().some(h => h.type !== exceptType && ((h.assigned && +h.home === tid) || (h.traveling && +h.home === tid)));
  }
  function heroBridgePost(action, heroType, targetTownId, onDone) {
    if (!heroesEnabled()) return onDone && onDone('heroes-off');
    if (!hostEnabled() || automationPaused({})) return onDone && onDone('paused');
    if (captchaPausedAny('hero', 'attack')) return onDone && onDone('captcha');
    const type = String(heroType || ''); if (!type) return onDone && onDone('no-hero');
    const tpl = state.heroTpl && state.heroTpl[action];
    const targetKey = targetTownId != null ? +targetTownId : '-';
    if (!tpl || !tpl.model_url || !tpl.action_name || String(tpl.action_name) !== String(action)) {
      gbLogT('hero-template-' + action, 60000, `hero: ${action} template missing; perform that action manually once first`);
      return onDone && onDone('template-required');
    }
    if (txRecentlyCommitted(`hero:${action}:${type}:${targetKey}`, 120000)) return onDone && onDone('already-committed');
    const src = tpl.arguments || {}, args = {};
    for (const [k, v] of Object.entries(src)) if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') args[k] = v;
    const heroKey = Object.prototype.hasOwnProperty.call(src, 'type') ? 'type' : (Object.prototype.hasOwnProperty.call(src, 'hero_type') ? 'hero_type' : null);
    if (!heroKey) return onDone && onDone('template-shape');
    args[heroKey] = type;
    if (targetTownId != null) {
      const townKey = Object.prototype.hasOwnProperty.call(src, 'target_town_id') ? 'target_town_id' : (Object.prototype.hasOwnProperty.call(src, 'town_id') ? 'town_id' : null);
      if (action === 'assignToTown' && !townKey) return onDone && onDone('template-shape');
      if (townKey) args[townKey] = +targetTownId;
    }
    const lockToken = gbLock('hero'); if (!lockToken) return onDone && onDone('busy');
    const payload = { model_url: tpl.model_url, action_name: tpl.action_name, arguments: args, town_id: targetTownId != null ? +targetTownId : tpl.town_id };
    bridgePost('hero', payload, (err, data) => {
      gbUnlock('hero', lockToken);
      if (!err) gbLog(`hero: ${action} ${type} -> ${targetTownId || '-'} OK`); else gbLog(`hero: ${action} ${type} err ${err}`);
      if (onDone) onDone(err, data);
    });
  }
  function heroAssignToTown(heroType, targetTownId, opts, onDone) {
    if (!opts || !opts.confirmed) return onDone && onDone('need-confirm');
    const tid = +targetTownId; if (!tid) return onDone && onDone('no-town');
    const hero = playerHeroesList().find(h => h.type === String(heroType));
    if (!hero) return onDone && onDone('missing');
    if (hero.injured || hero.attacking || hero.traveling) return onDone && onDone(hero.injured ? 'injured' : (hero.attacking ? 'attacking' : 'transferring'));
    if (hero.assigned && +hero.home === tid) return onDone && onDone('already');
    if (heroTownOccupied(tid, hero.type)) return onDone && onDone('town-occupied');
    return heroBridgePost('assignToTown', heroType, tid, onDone);
  }
  function heroUnassign(heroType, opts, onDone) {
    if (!opts || !opts.confirmed) return onDone && onDone('need-confirm');
    const hero = playerHeroesList().find(h => h.type === String(heroType));
    if (!hero) return onDone && onDone('missing');
    if (!hero.assigned && !hero.attacking) return onDone && onDone('not-assigned');
    return heroBridgePost('unassignFromTown', heroType, hero.origin || hero.home, onDone);
  }
  function heroCancelTravel(heroType, opts, onDone) {
    if (!opts || !opts.confirmed) return onDone && onDone('need-confirm');
    const hero = playerHeroesList().find(h => h.type === String(heroType));
    if (!hero) return onDone && onDone('missing');
    if (!hero.traveling) return onDone && onDone('not-traveling');
    return heroBridgePost('cancelTownTravel', heroType, hero.origin || hero.home, onDone);
  }
  function renderMilitaryHelpers(sec, plan) {
    const har = sec && sec.querySelector('.atk-harass');
    if (har) har.querySelectorAll('[data-harass]').forEach(btn => { const on = plan.troopMode === 'harass' && plan.harassPreset === btn.dataset.harass; btn.style.outline = on ? '1px solid #6cf' : ''; });
    const box = sec && sec.querySelector('.atk-cmds');
    if (box) {
      box.replaceChildren();
      const rows = militaryOutgoingMovements();
      if (!rows.length) { const e = document.createElement('div'); e.textContent = 'No explicitly cancelable outgoing movements'; e.style.cssText = 'color:#666;font-size:10px'; box.appendChild(e); }
      else rows.forEach(r => {
        const row = document.createElement('div'); row.style.cssText = 'display:grid;grid-template-columns:1fr .7fr .6fr auto;gap:4px;font-size:10px;border-bottom:1px solid #2a2a2a;padding:2px 0;align-items:center';
        const c1 = document.createElement('span'); c1.textContent = `${townNameById(r.home)} -> ${r.target}`; c1.title = `command ${r.commandId}`;
        const c2 = document.createElement('span'); c2.textContent = r.type || 'move';
        const c3 = document.createElement('span'); c3.textContent = r.cancelLeft != null ? `${Math.round(r.cancelLeft)}s` : 'ok'; c3.style.color = '#888';
        const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Cancel'; b.disabled = !state.cancelTpl; b.title = state.cancelTpl ? 'Cancel this movement' : 'Cancel one movement manually once to learn the canonical action';
        b.addEventListener('click', () => { if (!confirm(`Cancel ${r.type || 'command'} ${r.commandId}?`)) return; militaryCancelCommand(r.commandId, { confirmed: true }, err => { flash(err ? 'cancel failed: ' + err : 'command cancelled'); renderAttack(); }); });
        row.append(c1,c2,c3,b); box.appendChild(row);
      });
    }
    const hbox = sec && sec.querySelector('.atk-heroes');
    if (!hbox) return;
    hbox.replaceChildren();
    if (!heroesEnabled()) { const e = document.createElement('div'); e.textContent = 'Heroes disabled on this world'; e.style.cssText = 'color:#666;font-size:10px'; hbox.appendChild(e); return; }
    const heroes = playerHeroesList();
    if (!heroes.length) { const e = document.createElement('div'); e.textContent = 'No readable PlayerHero models'; e.style.cssText = 'color:#666;font-size:10px'; hbox.appendChild(e); return; }
    const townSel = document.createElement('select'); townSel.style.cssText = 'background:#111;color:#cfc;border:1px solid #333;font-size:10px;margin-bottom:4px';
    (state.towns || []).forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name || t.id; townSel.appendChild(o); }); hbox.appendChild(townSel);
    heroes.forEach(h => {
      const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-size:10px;border-bottom:1px solid #2a2a2a;padding:3px 0';
      const lab = document.createElement('span'); lab.style.flex = '1'; lab.textContent = `${h.name} Lv${h.level} | ${h.status}${h.home ? ' @' + townNameById(h.home) : ''}`; row.appendChild(lab);
      const addBtn = (text, action, color, fn) => { const b=document.createElement('button'); b.type='button'; b.textContent=text; b.style.color=color; b.disabled=!(state.heroTpl && state.heroTpl[action]); b.title=b.disabled?`Perform ${action} manually once to learn template`:''; b.addEventListener('click',fn); row.appendChild(b); };
      if (h.traveling) addBtn('Cancel travel','cancelTownTravel','#fc6',()=>{ if(confirm(`Cancel transfer of ${h.name}?`)) heroCancelTravel(h.type,{confirmed:true},err=>{flash(err?'hero cancel failed: '+err:'hero travel cancelled');renderAttack();}); });
      else if (h.assigned || h.attacking) addBtn('Unassign','unassignFromTown','#f96',()=>{ if(confirm(`Unassign ${h.name}?`)) heroUnassign(h.type,{confirmed:true},err=>{flash(err?'hero unassign failed: '+err:'hero unassigned');renderAttack();}); });
      if (!h.injured && !h.attacking && !h.traveling) addBtn('Assign','assignToTown','#6cf',()=>{ const tid=townSel.value; if(tid&&confirm(`Assign ${h.name} -> ${townNameById(tid)}?`)) heroAssignToTown(h.type,tid,{confirmed:true},err=>{flash(err?'hero assign failed: '+err:'hero transfer started');renderAttack();}); });
      hbox.appendChild(row);
    });
  }
  function bindAttackTab() {
    const sec = panel && panel.querySelector('section[data-tab=attack]');
    if (!sec || sec.dataset.bound) return;
    sec.dataset.bound = '1';
    sec.querySelector('#gb-atk-preview')?.addEventListener('click', () => {
      const plan = readAttackForm();
      const sched = buildAttackSchedule(plan);
      if (sched.error) { flash(sched.error); return; }
      attackPreviewRows = sched.rows;
      gbLog(`attack preview: ${sched.rows.length} towns, skew=${Math.round(sched.skew)}ms`);
      renderAttack();
    });
    sec.querySelector('#gb-atk-arm')?.addEventListener('click', () => {
      const plan = readAttackForm();
      const sched = buildAttackSchedule(plan);
      if (sched.error) { flash(sched.error); return; }
      attackPreviewRows = sched.rows;
      const ok = sched.rows.filter(r => r.boats.ok && r.unitCount && r.status !== 'past' && r.status !== 'no-travel');
      if (!ok.length) { flash('no towns ready'); renderAttack(); return; }
      if (!confirm(`Arm ${ok.length} attack(s) (${plan.timingMode})?`)) return;
      armAttackWave(plan, ok);
    });
    sec.querySelector('#gb-atk-cancel')?.addEventListener('click', () => cancelArmedAttack());
    sec.querySelector('#gb-atk-now')?.addEventListener('click', () => {
      const plan = readAttackForm();
      const sched = buildAttackSchedule(plan);
      if (sched.error) { flash(sched.error); return; }
      attackPreviewRows = sched.rows;
      renderAttack();
      fireAttackNow(plan, sched.rows);
    });
    sec.querySelector('[data-atk=troop]')?.addEventListener('change', () => {
      readAttackForm();
      renderAttack();
    });
    sec.querySelector('#gb-atk-src-all')?.addEventListener('click', () => attackSetAllSources(true));
    sec.querySelector('#gb-atk-src-none')?.addEventListener('click', () => attackSetAllSources(false));
    sec.querySelector('#gb-atk-src-off')?.addEventListener('click', () => attackSelectRoleSources(ATTACK_ROLE_OFFENSE));
    sec.querySelector('#gb-atk-src-def')?.addEventListener('click', () => attackSelectRoleSources(ATTACK_ROLE_DEFENSE));
    sec.querySelector('[data-atk=pick]')?.addEventListener('change', e => {
      const id = e.target.value; if (!id) return;
      const t = attackKnownTargets().find(x => String(x.id) === String(id));
      if (t) applyAttackTarget(t);
    });
    sec.querySelector('[data-atk=target]')?.addEventListener('change', () => {
      const plan = readAttackForm();
      if (/^\d+$/.test(plan.targetId)) attackRememberTarget(plan.targetId, { x: plan.targetX, y: plan.targetY, src: 'manual-id' });
      renderAttack();
    });
    sec.querySelectorAll('[data-harass]').forEach(btn => btn.addEventListener('click', () => { applyHarassPreset(btn.dataset.harass); renderAttack(); }));
    sec.querySelector('#gb-atk-cmds-refresh')?.addEventListener('click', () => renderAttack());
    sec.querySelector('#gb-atk-heroes-refresh')?.addEventListener('click', () => renderAttack());
  }

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

        const send = {};
        ['sword', 'archer', 'hoplite', 'rider', 'chariot'].forEach(k => {
          if (+u[k] > 0) send[k] = +u[k];
        });
        if (!Object.keys(send).length) continue;
        const same = isSameIsland(id, target);
        if (!same) {

          Object.keys(u).forEach(uid => {
            const m = unitMeta(uid);
            if (m && (m.capacity > 0 || m.berth > 0) && +u[uid] > 0) send[uid] = +u[uid];
          });
          const boats = boatCapacityCheck(send, false);
          if (!boats.ok) {
            gbLogT('def-pull-boats-' + id, 60000,
              `defense-pull: skip town ${id} → ${targetTownId} (${boats.reason || 'no transport'})`);
            continue;
          }
        }
        jobs.push({ from: id, units: send });
        if (jobs.length >= 5) break;
      }
    } catch (_) {}
    if (!jobs.length) return onDone && onDone('no-units');
    const defenseLock = gbLock('defense-pull', Math.max(180000, jobs.length * 30000));
    if (!defenseLock) return onDone && onDone('busy');
    let i = 0, done = 0;
    (function next() {
      if (i >= jobs.length) {
        gbUnlock('defense-pull', defenseLock);
        gbLog(`defense-pull: ${done}/${jobs.length} → ${targetTownId}`);
        return onDone && onDone(null, done);
      }
      const j = jobs[i++];
      gbLockTouch('defense-pull', defenseLock);
      sendAttackViaBridge({ town_id: +targetTownId, kind: 'town' }, j.from, j.units, 'support', (err) => {
        if (!err) done++;
        gbTimeout(next, 700 + Math.random() * 400);
      });
    })();
  }

  const STATS_WINDOWS = { '1h': 3600000, '24h': 86400000, '7d': 604800000 };
  let statsWindow = '24h';
