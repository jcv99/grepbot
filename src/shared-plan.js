  // ===== Shared attack planner v2 (v4 plan 7.1) ==============================
  // IMPORT ONLY, and paste only. It parses a plan another player exported and
  // stages it as candidate targets; it never sends anything and never arms an
  // attack by itself.
  //
  // NO NETWORK FETCH. Plan 7.1 sketches an opt-in URL mode, but the userscript
  // sandbox only permits the hosts already in @connect, and pulling a plan from
  // a Discord channel would need a token this script must never hold. Fetching
  // an attack plan from a URL also means a third party can change what your bot
  // targets after you approved it. Paste is the honest surface: the operator
  // sees exactly the bytes they are admitting.
  //
  // A target is only STAGED. Firing still goes through the existing attack
  // planner, its confirm gate and its arm window - this module adds no post.

  const SHARED_PLAN_MAX_TARGETS = 40;
  const SHARED_PLAN_VERSION = 1;

  // {ok, targets, rejected, errors}. Rejects rather than repairs: a malformed
  // target in a plan from a stranger is exactly the thing not to coerce.
  function sharedPlanValidate(plan) {
    const errors = [], targets = [], rejected = [];
    if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return { ok: false, targets, rejected, errors: ['no es un plan'] };
    if (+plan.v !== SHARED_PLAN_VERSION) errors.push(`version ${plan.v} no soportada (esperada ${SHARED_PLAN_VERSION})`);
    const host = plan.author && plan.author.host;
    // A plan for another world names town ids that mean nothing here.
    if (host && String(host) !== String(location.host)) errors.push(`mundo distinto: ${host} != ${location.host}`);
    const list = Array.isArray(plan.targets) ? plan.targets : [];
    if (!list.length) errors.push('sin objetivos');
    for (const t of list.slice(0, SHARED_PLAN_MAX_TARGETS)) {
      if (!t || typeof t !== 'object') { rejected.push('entrada no valida'); continue; }
      const id = String(t.id == null ? '' : t.id).trim();
      if (!/^\d{1,12}$/.test(id)) { rejected.push(`id no numerico: ${String(t.id).slice(0, 12)}`); continue; }
      const intent = (t.intent === 'support') ? 'support' : 'attack';
      const num = v => (Number.isFinite(+v) ? +v : null);
      const arriveAt = t.window && Number.isFinite(+t.window.arriveAt) ? +t.window.arriveAt : null;
      // An arrival already in the past is not a plan, it is a stale file.
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
  // Stages the targets on the existing attack plan. It does NOT set targetId:
  // the operator still picks which one to arm, so an imported plan can never
  // silently become the live target.
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
  // Export the CURRENT single target as a shareable plan. Deliberately minimal:
  // it carries no player name, no alliance and no note, so sharing a plan does
  // not leak the sender's own intel.
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
      const use = document.createElement('button');
      use.type = 'button'; use.textContent = 'Usar';
      use.title = 'Fija este objetivo en el planificador. Sigue necesitando confirmacion para enviar.';
      use.addEventListener('click', () => { applyAttackTarget({ id: t.id, name: t.name, x: t.x, y: t.y, src: 'shared-plan' }); });
      row.append(lab, use);
      box.appendChild(row);
    }
  }
