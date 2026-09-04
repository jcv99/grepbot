  function readAttackForm() {
    const sec = panel && panel.querySelector('section[data-tab=attack]');
    const plan = ensureAttackPlan();
    if (!sec) return plan;
    plan.targetId = sec.querySelector('[data-atk=target]')?.value?.trim() || '';
    plan.targetType = sec.querySelector('[data-atk=target-type]')?.value || 'town';
    const xv = sec.querySelector('[data-atk=x]')?.value;
    const yv = sec.querySelector('[data-atk=y]')?.value;
    plan.targetX = xv === '' || xv == null ? null : +xv;
    plan.targetY = yv === '' || yv == null ? null : +yv;
    plan.mission = sec.querySelector('[data-atk=mission]')?.value || 'attack';
    plan.timingMode = sec.querySelector('[data-atk=timing]')?.value || 'send_now';
    plan.latencyPadMs = +(sec.querySelector('[data-atk=pad]')?.value || 200);
    plan.troopMode = sec.querySelector('[data-atk=troop]')?.value || 'offense';
    if (plan.troopMode === 'harass' && !plan.harassPreset) plan.harassPreset = 'light';
    plan.unitType = sec.querySelector('[data-atk=unit-type]')?.value || 'sword';
    const arr = sec.querySelector('[data-atk=arrival]')?.value;
    if (arr) {
      const ms = Date.parse(arr);
      if (!isNaN(ms)) plan.arrivalUnix = Math.floor((ms - clientServerSkewMs()) / 1000);
    }
    const srcBox = sec.querySelector('.atk-sources');
    if (srcBox) {
      plan.sourceTownIds = Array.from(srcBox.querySelectorAll('input:checked')).map(c => c.dataset.id);
    }
    saveAttackPlan();
    return plan;
  }
  function townNameById(id) {
    const t = (state.towns || []).find(x => String(x.id) === String(id));
    return (t && t.name) || String(id || '-');
  }

  const SHARED_PLAN_MAX_TARGETS = 40;
  const SHARED_PLAN_VERSION = 1;

  function sharedPlanValidate(plan) {
    const errors = [], targets = [], rejected = [];
    if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return { ok: false, targets, rejected, errors: ['no es un plan'] };
    if (+plan.v !== SHARED_PLAN_VERSION) errors.push(`version ${plan.v} no soportada (esperada ${SHARED_PLAN_VERSION})`);
    const host = plan.author && plan.author.host;

    if (host && String(host) !== String(location.host)) errors.push(`mundo distinto: ${host} != ${location.host}`);
    const list = Array.isArray(plan.targets) ? plan.targets : [];
    if (!list.length) errors.push('sin objetivos');
    for (const t of list.slice(0, SHARED_PLAN_MAX_TARGETS)) {
      if (!t || typeof t !== 'object') { rejected.push('entrada no valida'); continue; }
      const id = String(t.id == null ? '' : t.id).trim();
      if (!/^\d{1,12}$/.test(id)) { rejected.push(`id no numerico: ${String(t.id).slice(0, 12)}`); continue; }
      const intent = (t.intent === 'support') ? 'support' : 'attack';
      const num = v => gbNum(v);
      const arriveAt = t.window && Number.isFinite(+t.window.arriveAt) ? +t.window.arriveAt : null;

      if (arriveAt != null && arriveAt * (arriveAt > 1e12 ? 0.001 : 1) < gameNow()) {
        rejected.push(`${id}: ventana ya pasada`);
        continue;
      }
      targets.push({
        id,
        name: typeof t.name === 'string' ? t.name.slice(0, 40) : null,
        x: num(t.x), y: num(t.y),
        arriveAt,
        staggerMs: Math.max(0, Math.min(3600000, num(t.window && t.window.staggerMs) || 0)),
        intent,
      });
    }
    if (list.length > SHARED_PLAN_MAX_TARGETS) rejected.push(`${list.length - SHARED_PLAN_MAX_TARGETS} objetivos por encima del limite`);
    return { ok: errors.length === 0 && targets.length > 0, targets, rejected, errors };
  }
  function sharedPlanImport(text) {
    let parsed = null;
    try { parsed = JSON.parse(String(text || '')); } catch (_) {
      return { ok: false, targets: [], rejected: [], errors: ['JSON invalido'] };
    }
    return sharedPlanValidate(parsed);
  }

  function sharedPlanApplyToAttackPlan(result) {
    if (!result || !result.ok) return 0;
    const plan = ensureAttackPlan();
    if (!Array.isArray(plan.targets)) plan.targets = [];
    let added = 0;
    for (const t of result.targets) {
      if (plan.targets.some(x => String(x.id) === String(t.id))) continue;
      plan.targets.push(t);
      added++;
      try { attackRememberTarget(t.id, { name: t.name, x: t.x, y: t.y, src: 'shared-plan' }); } catch (_) {}
    }
    while (plan.targets.length > SHARED_PLAN_MAX_TARGETS) plan.targets.shift();
    saveAttackPlan();
    return added;
  }
  function sharedPlanClear() {
    const plan = ensureAttackPlan();
    plan.targets = [];
    saveAttackPlan();
  }

  function sharedPlanExport() {
    const plan = ensureAttackPlan();
    const staged = Array.isArray(plan.targets) ? plan.targets.slice() : [];
    if (plan.targetId && !staged.some(t => String(t.id) === String(plan.targetId))) {
      staged.push({ id: String(plan.targetId), name: null, x: plan.targetX ?? null, y: plan.targetY ?? null, arriveAt: null, staggerMs: 0, intent: 'attack' });
    }
    return {
      v: SHARED_PLAN_VERSION,
      author: { host: location.host },
      targets: staged.map(t => ({
        id: String(t.id), name: t.name || null, x: t.x ?? null, y: t.y ?? null,
        window: { arriveAt: t.arriveAt ?? null, staggerMs: t.staggerMs || 0 },
        intent: t.intent || 'attack',
      })),
    };
  }
  function sharedPlanTargetIds() {
    const plan = ensureAttackPlan();
    return (Array.isArray(plan.targets) ? plan.targets : []).map(t => String(t.id));
  }
  function renderSharedPlan(sec) {
    const box = sec && sec.querySelector('.atk-shared');
    if (!box || sec.hidden) return;
    box.replaceChildren();
    const list = (ensureAttackPlan().targets) || [];
    if (!list.length) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#666;font-size:10px';
      e.textContent = 'Sin objetivos importados';
      box.appendChild(e);
      return;
    }
    for (const t of list) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;align-items:center;border-bottom:1px solid #2a2a2a;padding:1px 0';
      const lab = document.createElement('span');
      lab.style.flex = '1';
      lab.textContent = `${t.name || townNameById(t.id)} (#${t.id}) ${t.intent}` +
        (t.arriveAt ? ' llega ' + new Date(t.arriveAt > 1e12 ? t.arriveAt : t.arriveAt * 1000).toLocaleString() : '');
      const use = gbButton('Usar', {
        title: 'Fija este objetivo en el planificador. Sigue necesitando confirmacion para enviar.',
        onClick: () => { applyAttackTarget({ id: t.id, name: t.name, x: t.x, y: t.y, src: 'shared-plan' }); },
      });
      row.append(lab, use);
      box.appendChild(row);
    }
  }
  function militaryMovementsUnitsModels() { return movementModels(); }
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
