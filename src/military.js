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

    try { mmModelsAll('MovementsUnits').forEach(push); } catch (_) {}
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
        if (cancelable !== true) return;
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
  // ===== Hero manager (v4 plan 4.3) ==========================================
  // Stamina / mana / equipment attribute names are NOT known for this client.
  // These are probe candidates, not assumptions: every one missing is the
  // expected outcome and the reader returns null, which renders '?' and makes
  // the equipment heuristic propose nothing. Never substitute a guess.
  //
  // Checked against the captured client bundle (archive/captures/grepo-dump):
  // GameModels.PlayerHero declares level / experience_points / home_town_id /
  // origin_town_* / target_town_* / cured_at / assignment_type /
  // is_attacking_attack_spot / type - no stamina, no mana, no equipment. So on
  // THIS client every probe below is expected to miss; the names stay in case a
  // world ships a build that has them.
  const HERO_STAMINA_FNS = ['getStamina', 'getCurrentStamina', 'getEnergy'];
  const HERO_STAMINA_ATTRS = ['stamina', 'current_stamina', 'energy'];
  const HERO_STAMINA_MAX_FNS = ['getMaxStamina', 'getStaminaMax', 'getMaxEnergy'];
  const HERO_STAMINA_MAX_ATTRS = ['max_stamina', 'stamina_max', 'max_energy'];
  const HERO_MANA_FNS = ['getMana', 'getCurrentMana', 'getPower'];
  const HERO_MANA_ATTRS = ['mana', 'current_mana', 'power'];
  const HERO_MANA_MAX_FNS = ['getMaxMana', 'getManaMax'];
  const HERO_MANA_MAX_ATTRS = ['max_mana', 'mana_max'];
  const HERO_EQUIP_ATTRS = ['equipment', 'items', 'inventory', 'gear'];
  function heroPair(m, fns, attrs, maxFns, maxAttrs) {
    const cur = gbProbeNum(m, fns);
    const curA = cur == null ? gbProbeAttr(m, attrs) : cur;
    const max = gbProbeNum(m, maxFns);
    const maxA = max == null ? gbProbeAttr(m, maxAttrs) : max;
    if (curA == null && maxA == null) return null;
    return { current: curA, max: maxA };
  }
  function heroEquipSnapshot(m) {
    const a = (m && m.attributes) || m || {};
    for (const k of HERO_EQUIP_ATTRS) {
      const v = a[k];
      if (v && typeof v === 'object') {
        // Slot map vs flat bag: keep whichever shape the client actually uses,
        // verbatim. Nothing here interprets item ids.
        // Slot map vs flat bag: keep whichever shape the client actually uses,
        // verbatim. Nothing here interprets item ids.
        if (Array.isArray(v)) return { slots: null, items: v.slice(0, 40) };
        return { slots: Object.assign({}, v), items: null };
      }
    }
    return null;
  }
  function heroPct(pair) {
    if (!pair || !(pair.max > 0) || pair.current == null) return null;
    return Math.round(pair.current / pair.max * 100);
  }
  let _heroListMemo = { at: 0, v: null };
  // Any hero post changes assignment/status, so the 60s memo must not outlive
  // it or the panel reports the old state for up to a minute.
  function heroListInvalidate() { _heroListMemo = { at: 0, v: null }; }
  const HERO_LIST_MEMO_MS = 60000;
  function playerHeroesListCached() {
    if (_heroListMemo.v && Date.now() - _heroListMemo.at < HERO_LIST_MEMO_MS) return _heroListMemo.v;
    const base = playerHeroesList();
    const models = playerHeroModels();
    const byType = new Map();
    for (const m of models) {
      const a = m.attributes || {};
      const type = (typeof m.getId === 'function' && m.getId()) || a.type || a.id || m.id;
      if (type != null) byType.set(String(type), m);
    }
    const out = base.map(h => {
      const m = byType.get(String(h.type));
      return Object.assign({}, h, {
        stamina: m ? heroPair(m, HERO_STAMINA_FNS, HERO_STAMINA_ATTRS, HERO_STAMINA_MAX_FNS, HERO_STAMINA_MAX_ATTRS) : null,
        mana: m ? heroPair(m, HERO_MANA_FNS, HERO_MANA_ATTRS, HERO_MANA_MAX_FNS, HERO_MANA_MAX_ATTRS) : null,
        equipment: m ? heroEquipSnapshot(m) : null,
      });
    });
    _heroListMemo = { at: Date.now(), v: out };
    return out;
  }
  function heroLowStaminaPct() {
    // null must NOT count as 0 (which would be a tight throttle). Treat only
    // null/undefined as "unset" and fall through to the default 20, matching
    // every other knob's `== null` semantics.
    // null must NOT count as 0 (which would be a tight throttle). Treat only
    // null/undefined as "unset" and fall through to the default 20, matching
    // every other knob's `== null` semantics.
    const raw = state.heroLowStaminaPct;
    if (raw == null) return 20;
    const n = +raw;
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 20;
  }
  function heroNotify(event, hero, extra) {
    const key = `hero:${event}:${hero.type}`;
    gbLogT(key, 1800000, `hero ${event}: ${hero.name} (${hero.type})` + (extra ? ' ' + extra : ''));
    try { alertWebhook('hero', Object.assign({ id: hero.type, event, name: hero.name, level: hero.level }, extra || {})); } catch (_) {}
  }
  // Proposals only. It never moves an item, never posts, and never proposes a
  // destination it cannot name - there is no known equip endpoint in this tree.
  function heroEquipmentSuggest() {
    const heroes = playerHeroesListCached();
    const out = [];
    for (const h of heroes) {
      if (!h.equipment) continue;
      const free = heroes.filter(o => o.type !== h.type && o.status === 'free' && o.equipment && o.equipment.slots);
      if (!h.equipment.slots) continue;
      for (const [slot, val] of Object.entries(h.equipment.slots)) {
        // Only compare values that are both readable NUMBERS. An item id that
        // is a string tells us nothing about tier and must not be ranked.
        // Only compare values that are both readable NUMBERS. An item id that
        // is a string tells us nothing about tier and must not be ranked.
        const mine = +val;
        if (!Number.isFinite(mine)) continue;
        for (const o of free) {
          const theirs = +o.equipment.slots[slot];
          if (!Number.isFinite(theirs) || theirs <= mine) continue;
          out.push({ slot, to: h.type, from: o.type, fromValue: theirs, toValue: mine });
          break;
        }
      }
    }
    // Persist: the panel would otherwise show nothing after a reload until the
    // next 5-minute scan. Signature-compared so a steady state costs no write.
    // Persist: the panel would otherwise show nothing after a reload until the
    // next 5-minute scan. Signature-compared so a steady state costs no write.
    const sig = JSON.stringify(out);
    if (JSON.stringify(state.heroEquipSuggest || []) !== sig) {
      state.heroEquipSuggest = out;
      save(STORE.HERO_EQUIP_SUGGEST, out);
    } else state.heroEquipSuggest = out;
    return out;
  }
  function heroScan(reason) {
    const heroes = playerHeroesListCached();
    if (!heroes.length) return;
    const lowPct = heroLowStaminaPct();
    for (const h of heroes) {
      const pct = heroPct(h.stamina);
      // null means the attribute was not readable on this client - that is
      // not "stamina is zero" and must never fire an alert.
      // null means the attribute was not readable on this client - that is
      // not "stamina is zero" and must never fire an alert.
      if (pct != null && pct <= lowPct) heroNotify('low-stamina', h, { staminaPct: pct });
      if (h.injured) heroNotify('injured', h, null);
    }
    try { heroEquipmentSuggest(); } catch (_) {}
    if (!state.autoHero) return;
    if (!hostEnabled() || automationPaused({})) return;
    if (captchaPausedAny('hero', 'attack')) return;
    if (!state.heroTpl || !state.heroTpl.assignToTown) {
      gbLogT('hero-no-tpl', 600000, 'hero: assign template not learned - assign one hero by hand once');
      return;
    }
    const idle = heroes.filter(h => h.status === 'free');
    if (!idle.length) return;
    // Propose only. The post itself still needs {confirmed:true}, which only
    // the panel button supplies - auto-assign never fires unattended.
    // Propose only. The post itself still needs {confirmed:true}, which only
    // the panel button supplies - auto-assign never fires unattended.
    const towns = (state.towns || []).map(t => String(t.id)).filter(id => !heroTownOccupied(id, null));
    if (!towns.length) return;
    heroNotify('auto-assign-proposed', idle[0], { town: towns[0] });
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
      // Any hero post changes assignment/status; the 60s list memo must not
      // outlive it or the panel reports the old state for up to a minute.
      // Any hero post changes assignment/status; the 60s list memo must not
      // outlive it or the panel reports the old state for up to a minute.
      try { heroListInvalidate(); } catch (_) {}
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
        gbTip(row, `Movimiento saliente #${r.commandId}`);
        const c1 = document.createElement('span'); c1.textContent = `${townNameById(r.home)} -> ${r.target}`; c1.title = `command ${r.commandId}`; gbTip(c1, 'Origen -> destino del movimiento');
        const c2 = document.createElement('span'); c2.textContent = r.type || 'move'; gbTip(c2, 'Tipo de movimiento (ataque / apoyo / colonizacion...)');
        const c3 = document.createElement('span'); c3.textContent = r.cancelLeft != null ? `${Math.round(r.cancelLeft)}s` : 'ok'; c3.style.color = '#888'; gbTip(c3, 'Tiempo restante en el que se puede cancelar');
        const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Cancel'; b.disabled = !state.cancelTpl; b.title = state.cancelTpl ? 'Cancel this movement' : 'Cancel one movement manually once to learn the canonical action';
        b.addEventListener('click', () => { if (!confirm(`Cancelar ${r.type || 'comando'} ${r.commandId}?`)) return; militaryCancelCommand(r.commandId, { confirmed: true }, err => { flash(err ? 'cancel failed: ' + err : 'command cancelled'); renderAttack(); }); });
        row.append(c1,c2,c3,b); box.appendChild(row);
      });
    }
    const hbox = sec && sec.querySelector('.atk-heroes');
    if (!hbox) return;
    hbox.replaceChildren();
    if (!heroesEnabled()) { const e = document.createElement('div'); e.textContent = 'Heroes disabled on this world'; e.style.cssText = 'color:#666;font-size:10px'; hbox.appendChild(e); return; }
    const heroes = playerHeroesListCached();
    if (!heroes.length) { const e = document.createElement('div'); e.textContent = 'No readable PlayerHero models'; e.style.cssText = 'color:#666;font-size:10px'; hbox.appendChild(e); return; }
    const townSel = document.createElement('select'); townSel.style.cssText = 'background:#111;color:#cfc;border:1px solid #333;font-size:10px;margin-bottom:4px';
    gbTip(townSel, 'Ciudad de destino al pulsar Assign');
    (state.towns || []).forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name || t.id; townSel.appendChild(o); }); hbox.appendChild(townSel);
    heroes.forEach(h => {
      const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-size:10px;border-bottom:1px solid #2a2a2a;padding:3px 0';
      const lab = document.createElement('span'); lab.style.flex = '1';
      const st = heroPct(h.stamina), mn = heroPct(h.mana);

      // '?' means the attribute is not readable on this client build, which is
      // the expected result until someone captures the real names.
      lab.textContent = `${h.name} Lv${h.level} | ${h.status}${h.home ? ' @' + townNameById(h.home) : ''}` +
        ` | vigor ${st == null ? '?' : st + '%'} | mana ${mn == null ? '?' : mn + '%'}`;
      gbTip(lab, 'Estado del heroe: nombre · nivel · estado · ciudad · vigor · mana');
      if (st != null && st <= heroLowStaminaPct()) lab.style.color = '#f66';
      row.appendChild(lab);
      const addBtn = (text, action, color, fn, hint) => { const b=document.createElement('button'); b.type='button'; b.textContent=text; b.style.color=color; b.disabled=!(state.heroTpl && state.heroTpl[action]); b.title=b.disabled?`Perform ${action} manually once to learn template`:(hint||''); b.addEventListener('click',fn); row.appendChild(b); };
      if (h.traveling) addBtn('Cancel travel','cancelTownTravel','#fc6',()=>{ if(confirm(`Cancelar traslado de ${h.name}?`)) heroCancelTravel(h.type,{confirmed:true},err=>{flash(err?'hero cancel failed: '+err:'hero travel cancelled');renderAttack();}); }, 'Cancelar el traslado en curso del heroe');
      else if (h.assigned || h.attacking) addBtn('Unassign','unassignFromTown','#f96',()=>{ if(confirm(`Desasignar ${h.name}?`)) heroUnassign(h.type,{confirmed:true},err=>{flash(err?'hero unassign failed: '+err:'hero unassigned');renderAttack();}); }, 'Quitar al heroe de su ciudad actual');
      if (!h.injured && !h.attacking && !h.traveling) addBtn('Assign','assignToTown','#6cf',()=>{ const tid=townSel.value; if(tid&&confirm(`Asignar ${h.name} -> ${townNameById(tid)}?`)) heroAssignToTown(h.type,tid,{confirmed:true},err=>{flash(err?'hero assign failed: '+err:'hero transfer started');renderAttack();}); }, 'Asignar el heroe a la ciudad seleccionada');
      hbox.appendChild(row);
    });

    // Equipment proposals: read-only. There is no known equip endpoint in this
    // tree, so this names a better item another free hero is holding and stops
    // there - it never moves anything.
    const sug = (state.heroEquipSuggest || []);
    if (sug.length) {
      const s0 = document.createElement('div');
      s0.style.cssText = 'font-size:9px;color:#8ac;border-top:1px solid #2a2a2a;margin-top:3px;padding-top:3px';
      s0.textContent = 'equipo (solo consejo): ' + sug.slice(0, 4)
        .map(x => `${x.slot}: ${x.from} tiene ${x.fromValue} > ${x.to} ${x.toValue}`).join(' | ');
      hbox.appendChild(s0);
    }
    const ctl = document.createElement('div');
    ctl.style.cssText = 'display:flex;gap:8px;align-items:center;font-size:10px;margin-top:4px;flex-wrap:wrap';
    const auto = document.createElement('label');
    auto.style.cssText = 'display:flex;gap:4px;align-items:center;cursor:pointer';
    gbTip(auto, 'Sugerir asignaciones automaticas de heroes (no envia nada, solo propone)');
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!state.autoHero;
    cb.title = 'Solo propone: el envio sigue necesitando el boton Assign.';
    cb.addEventListener('change', () => { state.autoHero = cb.checked; save(STORE.AUTO_HERO, state.autoHero); gbLog('auto-hero ' + (state.autoHero ? 'ON (solo propone)' : 'OFF')); });
    auto.append(cb, document.createTextNode('Auto-asignar (propone)'));
    const lowLab = document.createElement('label');
    lowLab.style.cssText = 'display:flex;gap:4px;align-items:center';
    gbTip(lowLab, 'Umbral (%) de vigor por debajo del cual el heroe se marca en rojo');
    const low = document.createElement('input'); low.type = 'number'; low.min = '0'; low.max = '100';
    low.value = String(heroLowStaminaPct());
    low.style.cssText = 'width:45px;background:#111;color:#cfc;border:1px solid #333';
    gbTip(low, 'Porcentaje de vigor umbral (0-100)');
    low.addEventListener('change', () => {
      state.heroLowStaminaPct = Math.max(0, Math.min(100, +low.value || 0));
      save(STORE.HERO_LOW_STAMINA_PCT, state.heroLowStaminaPct);
    });
    lowLab.append(document.createTextNode('Aviso vigor <='), low, document.createTextNode('%'));
    ctl.append(auto, lowLab);
    hbox.appendChild(ctl);
  }
  // ===== Colony / revolt tracker (v4 plan 3.3) ===============================
  // Read + UI glue only. The recall CTA posts through the SAME
  // militaryCancelCommand the Attack tab's Cancel button already uses, with the
  // same confirmed gate - this plan adds no post surface of its own.
  const COLONY_KINDS = {
    revolt: 'revuelta',
    colonize: 'colonizacion',
    take_over: 'toma',
    conquer: 'conquista',
    portal_attack: 'portal',
    'cs-sighted': 'nave colonizadora',
  };
  function militaryColonyKind(mov) {
    const t = String((mov && mov.type) || '');
    if (Object.prototype.hasOwnProperty.call(COLONY_KINDS, t) && t !== 'cs-sighted') return t;
    // Fallback to the unit breakdown, the same signal dodge derives hasCs from.
    // Whether the server exposes the attacker's units on an INCOMING movement
    // is not verifiable from this tree, so this is a bonus path, never the
    // primary one: an unfamiliar type simply does not classify.
    // Fallback to the unit breakdown, the same signal dodge derives hasCs from.
    // Whether the server exposes the attacker's units on an INCOMING movement
    // is not verifiable from this tree, so this is a bonus path, never the
    // primary one: an unfamiliar type simply does not classify.
    const u = (mov && mov.units) || {};
    if (u.colonize_ship || u.colony_ship) return 'cs-sighted';
    return null;
  }
  function militaryColonyLabel(kind) { return COLONY_KINDS[kind] || kind || '?'; }
  function militaryColonyThreats() {
    let incoming = [];
    try { incoming = (typeof dodgeIncomingMovements === 'function') ? dodgeIncomingMovements() : []; } catch (_) { return []; }
    let outs = [];
    try { outs = militaryOutgoingMovements() || []; } catch (_) { outs = []; }
    const out = [];
    for (const mov of incoming) {
      const kind = militaryColonyKind(mov);
      if (!kind) continue;
      const eta = (typeof dodgeEtaSec === 'function') ? dodgeEtaSec(mov) : null;
      // Only REINFORCEMENT is recallable here. Matching every outgoing command
      // to that town would offer to cancel an attack the player launched
      // against it, which is a different decision entirely. A command this bot
      // sent (present in state.dodgeReturns) also qualifies even if its type
      // string is unfamiliar on this world.
      // Only REINFORCEMENT is recallable here. Matching every outgoing command
      // to that town would offer to cancel an attack the player launched
      // against it, which is a different decision entirely. A command this bot
      // sent (present in state.dodgeReturns) also qualifies even if its type
      // string is unfamiliar on this world.
      const returns = state.dodgeReturns || {};
      const recallCandidates = outs
        .filter(r => String(r.target) === String(mov.dest))
        .filter(r => /^(support|support_sea)$/.test(String(r.type || '')) || returns[String(r.commandId)])
        .map(r => ({ commandId: r.commandId, type: r.type, until: r.until, cancelLeft: r.cancelLeft }));
      out.push({ mov, kind, eta, etaKnown: eta != null, recallCandidates });
    }
    return out.sort((a, b) => (a.eta == null ? Infinity : a.eta) - (b.eta == null ? Infinity : b.eta));
  }
  function renderColonyThreats(sec) {
    const box = sec && sec.querySelector('.atk-colony');
    if (!box || sec.hidden) return;
    box.replaceChildren();
    const rows = militaryColonyThreats();
    if (!rows.length) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#666;font-size:10px';
      e.textContent = 'Sin colonizaciones ni revueltas entrantes';
      box.appendChild(e);
      return;
    }
    for (const r of rows) {
      const row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:1fr .8fr .6fr auto;gap:4px;font-size:10px;border-bottom:1px solid #2a2a2a;padding:2px 0;align-items:center';
      gbTip(row, `Amenaza: ${militaryColonyLabel(r.kind)} hacia ${townNameById(r.mov.dest)}`);
      const c1 = document.createElement('b'); c1.style.color = '#f5a623';
      c1.textContent = militaryColonyLabel(r.kind);
      gbTip(c1, 'Tipo de incidente: revuelta, colonizacion, nave colonizadora, etc.');
      const c2 = document.createElement('span');
      c2.textContent = `${townNameById(r.mov.dest)} (#${r.mov.dest})`;
      c2.title = `desde ${r.mov.origin || '?'}`;
      gbTip(c2, 'Ciudad destino del incidente + origen');
      const c3 = document.createElement('span');
      // ETA unknown renders '?', never 0 - a movement whose arrival could not
      // be read is not an imminent one.
      // ETA unknown renders '?', never 0 - a movement whose arrival could not
      // be read is not an imminent one.
      c3.textContent = r.etaKnown ? fmtSec(r.eta) : '?';
      c3.style.color = r.etaKnown ? '#fc6' : '#888';
      gbTip(c3, 'ETA hasta la llegada (? = no legible)');
      const acts = document.createElement('span');
      acts.style.cssText = 'display:flex;gap:2px;flex-wrap:wrap';
      r.recallCandidates.forEach(cand => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = 'Retirar';
        b.disabled = !state.cancelTpl;
        b.title = state.cancelTpl
          ? `Retirar el comando ${cand.commandId} (${cand.type || 'move'}) enviado a esta ciudad`
          : 'Cancela un comando a mano una vez para aprender la accion canonica';
        b.addEventListener('click', () => {
          if (!confirm(`Retirar ${cand.type || 'comando'} ${cand.commandId} de ${townNameById(r.mov.dest)}?`)) return;
          militaryCancelCommand(cand.commandId, { confirmed: true }, err => {
            flash(err ? 'retirada fallida: ' + err : 'refuerzo retirado');
            renderAttack();
          });
        });
        acts.appendChild(b);
      });
      if (!r.recallCandidates.length) {
        const none = document.createElement('span');
        none.style.color = '#666';
        none.textContent = 'sin refuerzo propio';
        acts.appendChild(none);
      }
      row.append(c1, c2, c3, acts);
      box.appendChild(row);
    }
  }
  // ===== Unit composition advisor (v4 plan 2.11) =============================
  // Pure read. Never changes recruitScan and never posts: auto-recruit stays
  // HIGH-RISK default OFF. Every verdict below is the one the recruit scan's
  // own helpers returned - this view reports them, it does not re-derive them.
  const COMP_MAX_SHORTAGE = 8;
  const COMP_CACHE_MS = 10000;
  let compCache = Object.create(null);
  function militaryCompositionInvalidate() { compCache = Object.create(null); }
  // "No units" and "cannot read the units" are different answers and the whole
  // shortage column is untrustworthy in the second case, so probe the model
  // rather than inferring readability from an empty bag.
  function militaryUnitsReadable(townId) {
    try {
      const t = gbTownModel(townId);
      if (!t || typeof t.units !== 'function') return false;
      return t.units() != null;
    } catch (_) { return false; }
  }
  function militaryCompositionRow(townId, allTargets) {
    const id = String(townId);
    const have = (typeof goalUnitCounts === 'function') ? goalUnitCounts(townId) : {};
    const haveKnown = militaryUnitsReadable(townId);
    let tgt = {};
    try {
      const all = allTargets || goalEffectiveRecruitTargets() || {};
      tgt = all[id] || all[townId] || {};
    } catch (_) { tgt = {}; }
    const byFunction = { offense: 0, defense: 0, both: 0, naval: 0, mythical: 0, militia: 0, unknown: 0 };
    for (const [u, n0] of Object.entries(have)) {
      const n = +n0 || 0;
      if (!(n > 0)) continue;
      const m = unitMeta(u);
      if (!m) { gbLogT('comp-meta-unknown-' + u, 600000, `composition: unit ${u} has no GameData entry - excluded`); continue; }
      const pop = n * Math.max(1, +m.population || 1);
      // `mythical` is an OVERLAY, not a sibling bucket: a mythical hoplite-class
      // unit still belongs to its offense/defense split. The renderer labels it
      // as a subset so the four splits still add up.
      // `mythical` is an OVERLAY, not a sibling bucket: a mythical hoplite-class
      // unit still belongs to its offense/defense split. The renderer labels it
      // as a subset so the four splits still add up.
      if (m.god || m.mythical || m.is_mythical) byFunction.mythical += pop;
      const fn = (typeof classifyUnitFn === 'function') ? classifyUnitFn(u) : 'unknown';
      if (byFunction[fn] == null) byFunction.unknown += pop; else byFunction[fn] += pop;
    }
    const shortage = [];
    const buildableToday = [];
    let blind = 0;
    let qinfo = { known: false, models: [] };
    try { qinfo = recruitQueueInfo(townId); } catch (_) {}
    for (const [u, want0] of Object.entries(tgt)) {
      const want = +want0 || 0;
      if (!(want > 0)) continue;
      if (!unitMeta(u)) { gbLogT('comp-meta-unknown-' + u, 600000, `composition: unit ${u} has no GameData entry - excluded`); continue; }
      const h = +have[u] || 0;
      // One queue read for the whole town, not two per unit.
      // One queue read for the whole town, not two per unit.
      let queued = 0;
      for (const m of (qinfo.models || [])) {
        const a = m.attributes || {};
        const uid = a.unit_type || a.unit_id || a.type;
        if (String(uid) === String(u)) queued += +(a.count != null ? a.count : (a.amount != null ? a.amount : a.units)) || 0;
      }
      const queueKnown = qinfo.known;
      const gap = want - h - queued;
      if (gap <= 0) continue;
      let status, why;
      // An unreadable garrison is BLIND, not "you have zero" - the whole gap
      // number is untrustworthy in that case and must say so.
      // An unreadable garrison is BLIND, not "you have zero" - the whole gap
      // number is untrustworthy in that case and must say so.
      if (!haveKnown || !queueKnown) { status = 'blind'; why = !haveKnown ? 'guarnicion no legible' : 'cola no legible'; blind++; }
      else if (!recruitCanBuild(townId, u)) { status = 'requirements'; why = 'requisitos'; }
      else if (!recruitQueueHasSpace(townId, u)) { status = 'queue-full'; why = 'cola llena'; }
      else {
        const max = recruitAffordableAmount(townId, u, gap);
        buildableToday.push({ id: u, maxAmount: max, blind: false });
        if (max > 0) { status = 'ready'; why = max < gap ? `solo ${max} ahora` : ''; }
        else { status = 'short'; why = 'recursos/poblacion/favor'; }
      }
      shortage.push({ id: u, want, have: h, queued, gap, status, why });
    }
    shortage.sort((a, b) => b.gap - a.gap);
    return {
      townId: id,
      haveKnown,
      byFunction,
      shortage: shortage.slice(0, COMP_MAX_SHORTAGE),
      shortageTotal: shortage.length,
      buildableToday,
      blind,
      progress: (typeof goalProgress === 'function') ? goalProgress(townId) : null,
    };
  }
  function militaryCompositionAll() {
    // Hoisted: goalEffectiveRecruitTargets() walks every town, so calling it
    // once per town made the advisor O(towns^2).
    // Hoisted: goalEffectiveRecruitTargets() walks every town, so calling it
    // once per town made the advisor O(towns^2).
    let all = {};
    try { all = goalEffectiveRecruitTargets() || {}; } catch (_) {}
    const ids = new Set((state.towns || []).map(t => String(t.id)));
    Object.keys(all).forEach(k => ids.add(String(k)));
    const now = Date.now();
    return Array.from(ids).map(id => {
      const hit = compCache[id];
      if (hit && now - hit.at < COMP_CACHE_MS) return hit.v;
      const v = militaryCompositionRow(id, all);
      compCache[id] = { at: now, v };
      return v;
    });
  }
  function renderCompositionAdvisor(sec) {
    const box = sec && sec.querySelector('.atk-comp');
    if (!box) return;
    if (sec.hidden) return;
    box.replaceChildren();
    const rows = militaryCompositionAll();
    if (!rows.length) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#666;font-size:10px';
      e.textContent = 'Sin ciudades legibles';
      box.appendChild(e);
      return;
    }
    const COLOR = { ready: '#6c6', short: '#f96', 'queue-full': '#fc6', requirements: '#f66', blind: '#a8f' };
    for (const r of rows) {
      const d = document.createElement('details');
      d.style.cssText = 'border-bottom:1px solid #2a2a2a;padding:2px 0';
      const sum = document.createElement('summary');
      sum.style.cssText = 'font-size:10px;cursor:pointer';
      const pct = r.progress;
      const pctColor = pct == null ? '#888' : (pct >= 75 ? '#6c6' : (pct >= 40 ? '#fc6' : '#f66'));
      sum.textContent = `${townNameById(r.townId)} · ${pct == null ? '?' : pct}%` +
        ` · def ${Math.round(r.byFunction.defense)} / ofe ${Math.round(r.byFunction.offense)}` +
        ` / amb ${Math.round(r.byFunction.both)} / nav ${Math.round(r.byFunction.naval)}` +
        (r.byFunction.mythical ? ` (de ellas ${Math.round(r.byFunction.mythical)} miticas)` : '') +
        (r.shortageTotal ? ` · ${r.shortageTotal} faltan` : ' · objetivos cubiertos') +
        (r.blind ? ' · ciego' : '');
      sum.style.color = pctColor;
      d.appendChild(sum);
      if (!r.haveKnown) {
        const e = document.createElement('div');
        e.style.cssText = 'color:#a8f;font-size:10px;padding:2px 0 2px 12px';
        e.textContent = '(ciego - abre esa ciudad una vez)';
        gbTip(e, 'Composicion no leida: abre la ciudad una vez para que el bot pueda leer las unidades');
        d.appendChild(e);
      }
      if (r.shortage.length) {
        const ol = document.createElement('ol');
        ol.style.cssText = 'margin:2px 0 2px 20px;padding:0;font-size:10px';
        for (const s of r.shortage) {
          const li = document.createElement('li');
          li.style.color = COLOR[s.status] || '#ccc';
          li.textContent = `${s.id}: faltan ${s.gap} (obj ${s.want}, tienes ${s.have}, en cola ${s.queued}) · ${s.status}${s.why ? ' · ' + s.why : ''}`;
          ol.appendChild(li);
        }
        d.appendChild(ol);
      }
      if (r.buildableToday.length) {
        const b = document.createElement('div');
        b.style.cssText = 'font-size:9px;color:#8ac;padding-left:20px';
        b.textContent = 'hoy: ' + r.buildableToday.map(x => `${x.id} x${x.maxAmount}`).join(', ');
        d.appendChild(b);
      }
      box.appendChild(d);
    }
  }
  function bindAttackTab() {
    const sec = panel && panel.querySelector('section[data-tab=attack]');
    if (!sec || sec.dataset.bound) return;
    sec.dataset.bound = '1';
    sec.querySelector('#gb-atk-colony-refresh')?.addEventListener('click', () => renderColonyThreats(sec));
    sec.querySelector('#gb-atk-comp-refresh')?.addEventListener('click', () => {
      militaryCompositionInvalidate();
      renderCompositionAdvisor(sec);
    });
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
      if (!ok.length) { flash('sin ciudades listas'); renderAttack(); return; }
      if (!confirm(`Armar ${ok.length} ataque(s) (${plan.timingMode})?`)) return;
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
  const STATS_WINDOWS = { '1h': 3600000, '24h': 86400000, '7d': 604800000 };
  let statsWindow = '24h';
