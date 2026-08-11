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
        b.addEventListener('click', () => { if (!confirm(`Cancelar ${r.type || 'comando'} ${r.commandId}?`)) return; militaryCancelCommand(r.commandId, { confirmed: true }, err => { flash(err ? 'cancel failed: ' + err : 'command cancelled'); renderAttack(); }); });
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
      if (h.traveling) addBtn('Cancel travel','cancelTownTravel','#fc6',()=>{ if(confirm(`Cancelar traslado de ${h.name}?`)) heroCancelTravel(h.type,{confirmed:true},err=>{flash(err?'hero cancel failed: '+err:'hero travel cancelled');renderAttack();}); });
      else if (h.assigned || h.attacking) addBtn('Unassign','unassignFromTown','#f96',()=>{ if(confirm(`Desasignar ${h.name}?`)) heroUnassign(h.type,{confirmed:true},err=>{flash(err?'hero unassign failed: '+err:'hero unassigned');renderAttack();}); });
      if (!h.injured && !h.attacking && !h.traveling) addBtn('Assign','assignToTown','#6cf',()=>{ const tid=townSel.value; if(tid&&confirm(`Asignar ${h.name} -> ${townNameById(tid)}?`)) heroAssignToTown(h.type,tid,{confirmed:true},err=>{flash(err?'hero assign failed: '+err:'hero transfer started');renderAttack();}); });
      hbox.appendChild(row);
    });
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
