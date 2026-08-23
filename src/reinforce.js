  // ===== Refuerzos: manual reinforcement planner (Militar > Refuerzos) =======
  // Same shape as the Ataques tab (target -> sources -> preview -> arm/send),
  // but the mission is fixed to 'support' and the composition question is
  // "naval, terrestre o ambas" instead of offense/defense.
  //
  // Why a separate module instead of a mission dropdown on the attack tab:
  //  - the attack plan is one persisted object; sharing it means a reinforce
  //    run silently rewrites the target/composition an attack wave was staged
  //    with, and vice versa. Two plans, two storage keys, two armed waves.
  //  - a reinforcement legitimately targets OWN towns, which attackSendAllowed
  //    only tolerates for mission 'support'. Making that the module's only
  //    mission removes the "did I remember to switch the dropdown" failure.
  //  - the transport question is the opposite one: an attack picks offense
  //    units and adds boats, a reinforcement picks defense units OR warships,
  //    and a naval-only reinforcement needs no transports at all.
  //
  // Template discipline: state.supportTpl (support.js) is preferred when the
  // player has hand-sent one support, exactly like the auto-support path. When
  // it is unlearned this module falls back to the CANONICAL client route
  //   gpAjax.ajaxPost('town_info','send_units',{<unit>:n,…,id,type:'support'})
  // which is the same call attack.js documents from
  // archive/captures/grepo-dump/js/game.min.js - a read route, not a guess.
  // The feature key is 'support', never 'attack', so a rejection here cannot
  // open a decision-memory window on live attacks.
  const RF_ARM_MAX_MS = 90000;
  const RF_HISTORY_MAX = 50;
  const RF_HELP_MODES = new Set(['land', 'naval', 'both', 'all_of_type', 'per_town']);
  const RF_MODE_ES = { land: 'terrestre', naval: 'naval', both: 'ambas', all_of_type: 'todo el tipo', per_town: 'por ciudad' };
  let rfArmed = null;
  let rfPreviewRows = [];
  function rfDefaultPlan() {
    return {
      targetId: '',
      targetX: null,
      targetY: null,
      helpMode: 'both',
      unitType: 'hoplite',
      timingMode: 'send_now',
      arrivalUnix: null,
      latencyPadMs: 200,
      staggerMs: 25,
      homeFloor: 0,
      sourceTownIds: null,
      perTownUnits: {},
    };
  }
  function rfPlan() {
    const d = rfDefaultPlan();
    if (!state.reinforcePlan || typeof state.reinforcePlan !== 'object' || Array.isArray(state.reinforcePlan)) state.reinforcePlan = d;
    else {
      for (const [k, v] of Object.entries(d)) {
        if (state.reinforcePlan[k] === undefined) {
          state.reinforcePlan[k] = Array.isArray(v) ? v.slice() : (v && typeof v === 'object' ? Object.assign({}, v) : v);
        }
      }
    }
    if (!RF_HELP_MODES.has(String(state.reinforcePlan.helpMode))) state.reinforcePlan.helpMode = 'both';
    return state.reinforcePlan;
  }
  function rfSavePlan() { save(STORE.REINFORCE_PLAN, state.reinforcePlan); }
  // A warship is naval WITHOUT transport capacity. A transporter is naval too,
  // but it is cargo, not help: sending one as "naval support" parks an empty
  // boat in the destination and defends nothing.
  function rfIsWarship(id) {
    const m = unitMeta(id);
    if (!m || !m.is_naval) return false;
    return !(+m.capacity > 0);
  }
  function rfIsLandDefender(id) {
    if (id === 'militia') return false;
    const m = unitMeta(id);
    if (!m || m.is_naval) return false;
    const fn = classifyUnitFn(id);
    return fn === 'defense' || fn === 'both';
  }
  // Every composition path runs through here so the home floor is applied once.
  function rfTake(live, id, floor, want) {
    const have = +live[id] || 0;
    const spare = Math.max(0, have - Math.max(0, floor));
    const n = want == null ? spare : Math.min(spare, Math.max(0, want));
    return n > 0 ? n : 0;
  }
  function rfSelectUnits(townId, plan) {
    const live = townLiveUnits(townId);
    const floor = Math.max(0, Math.floor(+plan.homeFloor || 0));
    const out = {};
    if (plan.helpMode === 'per_town') {
      const custom = (plan.perTownUnits && plan.perTownUnits[townId]) || {};
      for (const [k, v] of Object.entries(custom)) {
        if (k === 'militia') continue;
        const n = rfTake(live, k, floor, +v || 0);
        if (n > 0) out[k] = n;
      }
      return out;
    }
    if (plan.helpMode === 'all_of_type') {
      const id = plan.unitType;
      const n = id ? rfTake(live, id, floor) : 0;
      if (n > 0) out[id] = n;
      return out;
    }
    const wantLand = plan.helpMode === 'land' || plan.helpMode === 'both';
    const wantNaval = plan.helpMode === 'naval' || plan.helpMode === 'both';
    for (const id of Object.keys(live)) {
      if (wantLand && rfIsLandDefender(id)) {
        const n = rfTake(live, id, floor);
        if (n > 0) out[id] = n;
      } else if (wantNaval && rfIsWarship(id)) {
        const n = rfTake(live, id, floor);
        if (n > 0) out[id] = n;
      }
    }
    return out;
  }
  // Land units crossing water need boats; a naval-only reinforcement does not.
  // attackAddMinimumTransports picks the smallest transport set that covers the
  // population, so it is reused verbatim rather than re-derived here.
  function rfUnitsForTarget(townId, target, plan) {
    const units = rfSelectUnits(townId, plan);
    const hasLand = Object.keys(units).some(id => {
      const m = unitMeta(id);
      return m && !m.is_naval && id !== 'militia';
    });
    if (!hasLand) return units;
    if (isSameIsland(townId, target)) return units;
    return attackAddMinimumTransports(townId, units);
  }
  function rfResolveTarget(plan) {
    const id = String(plan.targetId || '').trim();
    if (!id) return null;
    if (!/^\d+$/.test(id)) {
      gbLogT('rf-target-id', 30000, `refuerzo: town target id must be numeric (${id.slice(0, 40)}) - blocked`);
      return null;
    }
    let x = plan.targetX, y = plan.targetY, island = null;
    const ownTown = (state.towns || []).find(t => String(t.id) === id);
    if (ownTown) {
      x = x ?? ownTown.x; y = y ?? ownTown.y; island = ownTown.island;
    } else {
      // A village is farm_town, not a town: it cannot hold a garrison and the
      // server rejects support for it. Refuse before the post.
      const farm = (state.farmsParsed || []).find(f => String(f.vill_id) === id || String(f.id) === id);
      if (farm) {
        gbLogT('rf-target-farm', 30000, `refuerzo: ${id} is a village - support unsupported`);
        return null;
      }
    }
    return { id, vill_id: null, town_id: id, kind: 'town', x: x != null ? +x : null, y: y != null ? +y : null, island };
  }
  // Own towns first (the common reinforcement destination), then everything the
  // attack tab already learned from reports / history / watchlist.
  function rfKnownTargets() {
    const map = new Map();
    for (const t of (state.towns || [])) {
      if (t && t.id != null) map.set(String(t.id), { id: String(t.id), name: t.name || null, x: t.x ?? null, y: t.y ?? null, own: true, ts: Number.MAX_SAFE_INTEGER });
    }
    let known = [];
    try { known = attackKnownTargets() || []; } catch (_) { known = []; }
    for (const t of known) {
      if (!map.has(String(t.id))) map.set(String(t.id), Object.assign({ own: false }, t));
    }
    return Array.from(map.values()).sort((a, b) => (b.own ? 1 : 0) - (a.own ? 1 : 0) || (b.ts || 0) - (a.ts || 0));
  }
  function rfApplyTarget(t) {
    if (!t || t.id == null || !/^\d+$/.test(String(t.id))) return false;
    const plan = rfPlan();
    plan.targetId = String(t.id);
    if (t.x != null && Number.isFinite(+t.x)) plan.targetX = +t.x;
    if (t.y != null && Number.isFinite(+t.y)) plan.targetY = +t.y;
    rfSavePlan();
    renderReinforce();
    flash('destino -> ' + (t.name ? `${t.name} (#${t.id})` : String(t.id)));
    return true;
  }
  function rfBuildSchedule(planArg) {
    const plan = planArg || rfPlan();
    const target = rfResolveTarget(plan);
    if (!target) return { error: 'destino no resuelto (id de ciudad numerico)', rows: [] };
    let sources = Array.isArray(plan.sourceTownIds)
      ? plan.sourceTownIds.map(String)
      : (state.towns || []).map(t => String(t.id));
    sources = sources.filter(id => String(id) !== String(target.town_id));
    if (!sources.length) return { error: 'sin ciudades de origen', rows: [] };
    const now = serverNow();
    const skew = clientServerSkewMs();
    const rows = sources.map((townId, idx) => {
      const town = (state.towns || []).find(t => String(t.id) === townId) || { id: townId, name: townId };
      const units = rfUnitsForTarget(townId, target, plan);
      const travel = computeTravelSeconds(townId, target, units, plan.timingMode === 'arrive_at');
      const same = isSameIsland(townId, target);
      const boats = boatCapacityCheck(units, same);
      let sendAt = null;
      if (plan.timingMode === 'arrive_at' && plan.arrivalUnix && travel != null) {
        sendAt = plan.arrivalUnix - travel - (plan.latencyPadMs || 0) / 1000;
      } else if (plan.timingMode === 'send_now') {
        sendAt = now + (idx * (plan.staggerMs || 0)) / 1000;
      }
      const unitCount = Object.values(units).reduce((a, b) => a + (+b || 0), 0);
      let status = 'ok';
      if (!unitCount) status = 'no-units';
      else if (!boats.ok) status = boats.reason;
      else if (travel == null && plan.timingMode === 'arrive_at') status = 'no-travel';
      else if (sendAt != null && sendAt < now - 1) status = 'past';
      return { townId, townName: town.name || townId, units, travel, sendAt, boats, status, unitCount, sameIsland: same };
    });
    return { target, rows, now, skew };
  }
  function rfSend(target, srcTownId, units, onDone) {
    if (!hostEnabled()) { flash('bot desactivado en este servidor'); return onDone && onDone('disabled'); }
    if (captchaPaused('support')) { flash('refuerzos pausados (captcha)'); return onDone && onDone('captcha'); }
    if (!target || target.kind !== 'town' || !target.town_id) {
      flash('refuerzo bloqueado: destino no es una ciudad');
      return onDone && onDone('bad-target');
    }
    if (String(target.town_id) === String(srcTownId)) {
      gbLog('refuerzo: refuse self-target town ' + srcTownId);
      return onDone && onDone('bad-target');
    }
    const live = townLiveUnits(srcTownId);
    const sendUnits = {};
    for (const k of Object.keys(units || {})) {
      const want = +units[k] || 0;
      const have = +live[k] || 0;
      if (want > 0 && have > 0) sendUnits[k] = Math.min(want, have);
    }
    delete sendUnits.militia;
    if (!Object.keys(sendUnits).length) return onDone && onDone('no-units');
    const destId = +target.town_id;
    const count = Object.values(sendUnits).reduce((a, b) => a + (+b || 0), 0);
    const settle = (err, data) => {
      if (err) { flash('refuerzo fallido: ' + err); return onDone && onDone(err); }
      flash('refuerzo enviado #' + srcTownId);
      if (state.exportRedact === false) gbLog('support response:', JSON.stringify(data).slice(0, 200));
      else gbLog('support response: ok');
      if (onDone) onDone(null, data);
    };
    const tpl = state.supportTpl;
    // The mission is pinned to 'support' by this tab's contract, so a learned
    // template that carries a different type is a template shape we do not
    // understand - say so once instead of silently overwriting it.
    if (tpl && tpl.arguments && tpl.arguments.type && String(tpl.arguments.type) !== 'support') {
      gbLogT('rf-tpl-type', 120000, `refuerzo: supportTpl type=${tpl.arguments.type} (se envia support) - revisa la plantilla`);
    }
    // String.replace with NO match returns the original string, which would
    // post the LEARNED town's model_url out of every other source town - a
    // wrong-garrison send with no error. Retarget only a real /Town/<id>
    // segment; anything else falls through to the canonical route below.
    const tplModelUrl = (tpl && /Town\/\d+/.test(String(tpl.model_url || '')))
      ? String(tpl.model_url).replace(/Town\/\d+/, 'Town/' + srcTownId)
      : null;
    if (tpl && tpl.model_url && tpl.action_name && !tplModelUrl) {
      gbLogT('rf-tpl-model-url', 120000, `refuerzo: supportTpl model_url sin segmento Town/<id> (${String(tpl.model_url).slice(0, 40)}) - ruta canonica`);
    }
    if (tpl && tplModelUrl && tpl.action_name) {
      const payload = {
        model_url: tplModelUrl,
        action_name: tpl.action_name,
        arguments: Object.assign({ id: destId, type: 'support' }, sendUnits),
        town_id: +srcTownId,
      };
      if (state.exportRedact === false) gbLog('support bridge:', JSON.stringify(payload));
      else gbLog(`support bridge: ${payload.action_name} town ${srcTownId} -> ${destId} (support, ${Object.keys(sendUnits).length} tipos / ${count} unidades)`);
      return bridgePost('support', payload, settle);
    }
    const params = Object.assign({}, sendUnits, { id: destId, type: 'support', town_id: +srcTownId });
    if (state.exportRedact === false) gbLog('support ajax:', JSON.stringify(params));
    else gbLog(`support ajax: town_info/send_units town ${srcTownId} -> ${destId} (support, ${Object.keys(sendUnits).length} tipos / ${count} unidades)`);
    gameAjaxPost('support', 'town_info', 'send_units', params, settle);
  }
  function rfPushHistory(entry) {
    if (!Array.isArray(state.reinforceHistory)) state.reinforceHistory = [];
    state.reinforceHistory.unshift(entry);
    if (state.reinforceHistory.length > RF_HISTORY_MAX) state.reinforceHistory.length = RF_HISTORY_MAX;
    save(STORE.REINFORCE_HISTORY, state.reinforceHistory);
  }
  // The armed wave HOLDS the 'support' lock for its whole window instead of
  // taking one per fire. support.js posts under the same feature key out of the
  // same garrisons, so the lock is mandatory; but a per-fire lock would drop
  // every town after the first whenever a send callback outlives the ~25ms
  // stagger. One lease for the wave, touched on every fire, released by cancel
  // or by the wave's own cleanup timer.
  // Idempotent on purpose: cancel and the cleanup timer both run, and gbUnlock
  // logs a 'refused foreign unlock' every time it is handed a stale token.
  function rfReleaseLock(tok) {
    if (!tok) return;
    const held = gbLockHeld('support');
    if (held && held.token === tok) gbUnlock('support', tok);
  }
  function rfCancelArmed() {
    if (!rfArmed) return;
    (rfArmed.timers || []).forEach(id => gbClearTimeout(id));
    rfReleaseLock(rfArmed.token);
    rfArmed.token = null;
    gbLog('refuerzo: cancelled armed wave');
    flash('refuerzo cancelado');
    rfArmed = null;
    renderReinforce();
  }
  function rfPatchFireStatus() {
    const sec = panel && panel.querySelector('section[data-tab=reinforce]');
    if (!sec || sec.hidden) return;
    const table = sec.querySelector('.rf-sched');
    if (!table || !table.querySelector('[data-town]')) { renderReinforce(); return; }
    for (const r of rfPreviewRows) {
      const cell = table.querySelector('[data-town="' + r.townId + '"] .rf-st');
      if (cell) cell.textContent = r.fireStatus || r.status || '';
    }
    const armed = sec.querySelector('#gb-rf-armed');
    if (armed) armed.textContent = rfArmed ? `ARMADO (${rfArmed.rows.length})` : '';
  }
  function rfArmWave(plan, rows) {
    rfCancelArmed();
    const target = rfResolveTarget(plan);
    if (!target) { flash('no se puede armar: destino no resuelto'); return; }
    const token = gbLock('support');
    if (!token) {
      gbLogT('rf-arm-busy', 60000, 'refuerzo: support lock held (apoyo automatico) - not arming');
      flash('refuerzos ocupados: hay un apoyo en curso');
      return;
    }
    const timers = [];
    const delays = [];
    const armedAt = Date.now();
    rfArmed = { timers, rows, plan, cancel: rfCancelArmed, armedAt, token };
    gbLog(`refuerzo: armed ${rows.length} towns mode=${plan.timingMode} skew=${Math.round(clientServerSkewMs())}ms (max window ${RF_ARM_MAX_MS}ms)`);
    flash('Los timers del navegador no son precisos para uso militar - esperas largas no se dispararan solas');
    rows.forEach((row, idx) => {
      if (!row.unitCount || !row.boats.ok || row.status === 'past' || row.status === 'no-travel') {
        gbLog(`refuerzo: skip ${row.townId} status=${row.status}`);
        return;
      }
      let delayMs;
      if (plan.timingMode === 'arrive_at' && row.sendAt != null) {
        delayMs = row.sendAt * 1000 + clientServerSkewMs() - Date.now();
      } else {
        delayMs = idx * (plan.staggerMs || 0);
      }
      if (delayMs < 0) { row.fireStatus = 'past'; gbLog(`refuerzo: past send window for ${row.townId}`); return; }
      if (delayMs > RF_ARM_MAX_MS) {
        gbLog(`refuerzo: ${row.townId} delay ${Math.round(delayMs)}ms > ${RF_ARM_MAX_MS}ms - not arming (re-arm closer to send)`);
        row.fireStatus = 'too-far';
        return;
      }
      delays.push(delayMs);
      const expectedFire = Date.now() + delayMs;
      const tid = gbTimeout(() => {
        if (!gbLockTouch('support', token)) return;
        const late = Date.now() - expectedFire;
        if (late > 5000) {
          gbLog(`refuerzo: refuse overdue fire for ${row.townId} (late ${Math.round(late)}ms)`);
          row.fireStatus = 'overdue';
          rfPatchFireStatus();
          return;
        }
        const liveTarget = rfResolveTarget(plan);
        if (!liveTarget) { row.fireStatus = 'bad-target'; rfPatchFireStatus(); return; }
        const freshUnits = rfUnitsForTarget(row.townId, liveTarget, plan);
        const freshCount = Object.values(freshUnits).reduce((a, b) => a + (+b || 0), 0);
        const freshBoats = boatCapacityCheck(freshUnits, isSameIsland(row.townId, liveTarget));
        if (!freshCount || !freshBoats.ok) {
          row.fireStatus = !freshCount ? 'no-units' : 'boats-changed';
          rfPatchFireStatus();
          return;
        }
        if (plan.timingMode === 'arrive_at') {
          const freshTravel = computeTravelSeconds(row.townId, liveTarget, freshUnits, true);
          if (freshTravel == null || row.travel == null || Math.abs(freshTravel - row.travel) > 1) {
            row.fireStatus = 'travel-changed';
            gbLog(`refuerzo: abort ${row.townId}; canonical travel changed ${row.travel} -> ${freshTravel}`);
            rfPatchFireStatus();
            return;
          }
        }
        row.fireStatus = 'firing';
        rfPatchFireStatus();
        rfSend(liveTarget, row.townId, freshUnits, (err) => {
          row.fireStatus = err ? 'err:' + err : 'sent';
          rfPatchFireStatus();
        });
      }, delayMs);
      timers.push(tid);
      row.fireStatus = 'armed+' + Math.round(delayMs) + 'ms';
    });
    rfPushHistory({
      ts: armedAt, mode: plan.timingMode, helpMode: plan.helpMode, targetId: plan.targetId,
      towns: rows.map(r => ({ id: r.townId, sendAt: r.sendAt, travel: r.travel, status: r.status })),
    });
    const maxDelay = delays.length ? Math.max(0, ...delays) : 0;
    timers.push(gbTimeout(() => {
      rfReleaseLock(token);
      if (rfArmed && rfArmed.timers === timers) rfArmed = null;
      rfPatchFireStatus();
    }, maxDelay + 5000));
    renderReinforce();
  }
  function rfFireNow(plan, rows) {
    const target = rfResolveTarget(plan);
    if (!target) { flash('no se puede enviar: destino no resuelto'); return; }
    const okRows = rows.filter(r => r.boats.ok && r.unitCount);
    if (!okRows.length) { flash('sin ciudades listas'); return; }
    const total = okRows.reduce((a, r) => a + r.unitCount, 0);
    const label = RF_MODE_ES[plan.helpMode] || plan.helpMode;
    if (!confirm(`${state.dryRun ? '[SIMULACION] ' : ''}Enviar refuerzo (${label}) a #${plan.targetId}?\n${okRows.length} ciudad(es) / ${total} unidades`)) return;
    // Same feature key as the auto-support burst, same garrisons: take the lock
    // for the whole run so the two can never interleave out of one town.
    const token = gbLock('support');
    if (!token) {
      gbLogT('rf-now-busy', 60000, 'refuerzo: support lock held (apoyo automatico) - manual send refused');
      flash('refuerzos ocupados: hay un apoyo en curso');
      return;
    }
    let i = 0;
    (function rfNext() {
      if (!gbLockTouch('support', token)) return;
      if (i >= okRows.length) {
        rfReleaseLock(token);
        rfPushHistory({ ts: Date.now(), mode: 'send_now_immediate', helpMode: plan.helpMode, targetId: plan.targetId, towns: okRows.map(r => r.townId) });
        flash(`refuerzos x${okRows.length}`);
        return;
      }
      const row = okRows[i++];
      const freshUnits = rfUnitsForTarget(row.townId, target, plan);
      const freshCount = Object.values(freshUnits).reduce((a, b) => a + (+b || 0), 0);
      const freshBoats = boatCapacityCheck(freshUnits, isSameIsland(row.townId, target));
      if (!freshCount || !freshBoats.ok) {
        gbLog(`refuerzo: skip ${row.townId} at fire time (${!freshCount ? 'no-units' : freshBoats.reason})`);
        row.fireStatus = !freshCount ? 'no-units' : freshBoats.reason;
        rfPatchFireStatus();
        gbTimeout(rfNext, (plan.staggerMs || 25) + Math.random() * 20);
        return;
      }
      row.fireStatus = 'firing';
      rfPatchFireStatus();
      rfSend(target, row.townId, freshUnits, (err) => {
        row.fireStatus = err ? 'err:' + err : 'sent';
        rfPatchFireStatus();
        gbTimeout(rfNext, (plan.staggerMs || 25) + Math.random() * 20);
      });
    })();
  }
  function rfReadForm() {
    const sec = panel && panel.querySelector('section[data-tab=reinforce]');
    const plan = rfPlan();
    if (!sec) return plan;
    plan.targetId = sec.querySelector('[data-rf=target]')?.value?.trim() || '';
    const xv = sec.querySelector('[data-rf=x]')?.value;
    const yv = sec.querySelector('[data-rf=y]')?.value;
    plan.targetX = xv === '' || xv == null ? null : +xv;
    plan.targetY = yv === '' || yv == null ? null : +yv;
    const mode = sec.querySelector('[data-rf=help]')?.value || 'both';
    plan.helpMode = RF_HELP_MODES.has(mode) ? mode : 'both';
    plan.timingMode = sec.querySelector('[data-rf=timing]')?.value || 'send_now';
    plan.latencyPadMs = +(sec.querySelector('[data-rf=pad]')?.value || 200);
    plan.homeFloor = gbCfgClamp(sec.querySelector('[data-rf=floor]')?.value, 0, 100000, 0);
    plan.unitType = sec.querySelector('[data-rf=unit-type]')?.value || 'hoplite';
    const arr = sec.querySelector('[data-rf=arrival]')?.value;
    if (arr) {
      const ms = Date.parse(arr);
      if (!isNaN(ms)) plan.arrivalUnix = Math.floor((ms - clientServerSkewMs()) / 1000);
    }
    const srcBox = sec.querySelector('.rf-sources');
    if (srcBox) plan.sourceTownIds = Array.from(srcBox.querySelectorAll('input:checked')).map(c => c.dataset.id);
    rfSavePlan();
    return plan;
  }
  function rfSelectSources(ids) {
    const plan = rfPlan();
    plan.sourceTownIds = (ids || []).map(String);
    rfSavePlan();
    renderReinforce();
  }
  function rfSetAllSources(checked) {
    rfSelectSources(checked ? (state.towns || []).map(t => String(t.id)) : []);
    flash(checked ? 'todas las ciudades seleccionadas' : 'origenes vaciados');
  }
  function rfSelectRoleSources(role) {
    const ids = attackTownGroup(role);
    if (!ids.length) { flash('sin ciudades con este rol'); return; }
    rfSelectSources(ids);
    flash(`${role === ATTACK_ROLE_DEFENSE ? 'defensa' : 'ofensiva'} ciudades seleccionadas (${ids.length})`);
  }
  function rfRenderSources(sec, plan) {
    const srcBox = sec.querySelector('.rf-sources');
    if (!srcBox) return;
    const selected = new Set(Array.isArray(plan.sourceTownIds) ? plan.sourceTownIds.map(String) : (state.towns || []).map(t => String(t.id)));
    const sig = (state.towns || []).map(t => t.id + ':' + (t.name || '')).join('|');
    if (srcBox.dataset.sig === sig) {
      srcBox.querySelectorAll('input[data-id]').forEach(cb => {
        const want = selected.has(String(cb.dataset.id));
        if (cb.checked !== want) cb.checked = want;
      });
      return;
    }
    srcBox.dataset.sig = sig;
    srcBox.replaceChildren();
    for (const t of (state.towns || [])) {
      const lab = document.createElement('label');
      lab.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:10px;cursor:pointer';
      gbTip(lab, 'Incluye/excluye esta ciudad como origen del refuerzo');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = selected.has(String(t.id));
      cb.dataset.id = String(t.id);
      cb.addEventListener('change', () => {
        plan.sourceTownIds = Array.from(srcBox.querySelectorAll('input:checked')).map(c => c.dataset.id);
        rfSavePlan();
      });
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(`${t.name || t.id}`));
      srcBox.appendChild(lab);
    }
  }
  function rfRenderPerTown(sec, plan) {
    const per = sec.querySelector('.rf-pertown');
    if (!per) return;
    per.hidden = plan.helpMode !== 'per_town';
    if (plan.helpMode !== 'per_town') return;
    per.replaceChildren();
    const ids = Array.isArray(plan.sourceTownIds) ? plan.sourceTownIds : (state.towns || []).map(t => String(t.id));
    for (const tid of ids) {
      const town = (state.towns || []).find(t => String(t.id) === String(tid)) || { id: tid, name: tid };
      const wrap = document.createElement('div');
      wrap.style.cssText = 'margin-bottom:4px';
      const lab = document.createElement('div');
      lab.style.cssText = 'color:#888;font-size:9px';
      lab.textContent = town.name || tid;
      const ta = document.createElement('textarea');
      ta.style.cssText = 'width:100%;height:40px;background:#111;color:#cfc;border:1px solid #333;font:10px monospace';
      gbTip(ta, 'Unidades exactas que envia esta ciudad. Formato: unidad:cantidad por linea');
      ta.value = unitsToArea(plan.perTownUnits[tid] || rfSelectUnits(tid, Object.assign({}, plan, { helpMode: 'both' })));
      ta.addEventListener('change', () => {
        plan.perTownUnits[tid] = parseUnitsArea(ta.value);
        rfSavePlan();
      });
      wrap.appendChild(lab);
      wrap.appendChild(ta);
      per.appendChild(wrap);
    }
  }
  function rfRenderSchedule(sec) {
    const table = sec.querySelector('.rf-sched');
    if (!table) return;
    const rows = rfPreviewRows.length ? rfPreviewRows : [];
    if (!rows.length) {
      if (!table.dataset.empty) {
        table.replaceChildren();
        table.dataset.empty = '1';
        const e = document.createElement('div');
        e.style.cssText = 'color:#888;padding:6px 0;font-size:11px';
        e.textContent = 'Previsualiza para calcular marcha / hora de envio / transporte';
        table.appendChild(e);
      }
      return;
    }
    const wanted = rows.map(r => String(r.townId));
    const have = Array.from(table.querySelectorAll('div[data-town]')).map(d => d.dataset.town);
    const wantedSet = new Set(wanted);
    const sameSet = !table.dataset.empty && have.length === wanted.length && have.every(k => wantedSet.has(k));
    if (!sameSet) {
      table.replaceChildren();
      delete table.dataset.empty;
      const hdr = document.createElement('div');
      hdr.style.cssText = 'display:grid;grid-template-columns:1.1fr .8fr .7fr .9fr .7fr .8fr;gap:4px;color:#888;font-size:9px;margin-bottom:2px';
      // LITERAL ONLY - town names reach the rows through textContent.
      hdr.innerHTML = gbLit('<span>ciudad</span><span>tropas</span><span>marcha</span><span>envio</span><span>barcos</span><span>estado</span>');
      table.appendChild(hdr);
    }
    for (const r of rows) {
      let row = sameSet ? table.querySelector(`div[data-town="${r.townId}"]`) : null;
      if (!row) {
        row = document.createElement('div');
        row.dataset.town = String(r.townId);
        row.style.cssText = 'display:grid;grid-template-columns:1.1fr .8fr .7fr .9fr .7fr .8fr;gap:4px;font-size:10px;border-bottom:1px solid #2a2a2a;padding:2px 0';
        for (let i = 0; i < 6; i++) row.appendChild(document.createElement('span'));
        row.children[5].className = 'rf-st';
        row.children[0].title = String(r.townId);
        gbTip(row.children[1], 'Unidades que salen de esta ciudad');
        gbTip(row.children[2], 'Tiempo de marcha hasta el destino');
        gbTip(row.children[3], 'Hora local a la que sale el refuerzo');
        gbTip(row.children[4], 'Capacidad de transporte disponible vs necesaria');
        gbTip(row.children[5], 'Estado del envio');
        table.appendChild(row);
      }
      const mix = Object.entries(r.units).map(([u, n]) => `${u}:${n}`).join(' ');
      row.children[1].title = mix || '-';
      const vals = [
        (r.townName || '').slice(0, 14),
        String(r.unitCount || 0),
        r.travel != null ? fmtHMS(r.travel) : '-',
        fmtUnixLocal(r.sendAt),
        r.boats.ok ? `OK ${r.boats.cap}/${r.boats.need}` : `NO ${r.boats.cap}/${r.boats.need}`,
        String(r.fireStatus || r.status),
      ];
      for (let i = 0; i < 6; i++) {
        if (row.children[i].textContent !== vals[i]) row.children[i].textContent = vals[i];
      }
      const boatColor = r.boats.ok ? '#6dda7e' : '#f55';
      if (row.children[4].style.color !== boatColor) row.children[4].style.color = boatColor;
    }
  }
  function renderReinforce() {
    const sec = panel && panel.querySelector('section[data-tab=reinforce]');
    if (!sec || sec.hidden) return;
    const plan = rfPlan();
    const skewEl = sec.querySelector('#gb-rf-skew');
    if (skewEl) skewEl.textContent = `skew ${Math.round(clientServerSkewMs())}ms | srv ${serverNow()}`;
    const armed = sec.querySelector('#gb-rf-armed');
    if (armed) armed.textContent = rfArmed ? `ARMADO (${rfArmed.rows.length})` : '';

    const tid = sec.querySelector('[data-rf=target]');
    if (tid && document.activeElement !== tid) tid.value = plan.targetId || '';
    const pick = sec.querySelector('[data-rf=pick]');
    if (pick && document.activeElement !== pick) {
      const targets = rfKnownTargets();
      const sig = targets.map(t => t.id + ':' + (t.name || '') + ':' + (t.own ? 'o' : '')).join('|');
      if (pick.dataset.sig !== sig) {
        pick.dataset.sig = sig;
        pick.replaceChildren();
        const first = document.createElement('option');
        first.value = '';
        first.textContent = targets.length ? `destinos conocidos (${targets.length})...` : 'sin destinos conocidos';
        pick.appendChild(first);
        for (const t of targets) {
          const o = document.createElement('option');
          o.value = t.id;
          const coord = t.x != null && t.y != null ? ` ${t.x}|${t.y}` : '';
          o.textContent = `${t.own ? '[propia] ' : ''}${(t.name || '?').slice(0, 16)} #${t.id}${coord}`;
          pick.appendChild(o);
        }
      }
      pick.value = targets.some(t => String(t.id) === String(plan.targetId)) ? String(plan.targetId) : '';
    }
    const hint = sec.querySelector('#gb-rf-target-hint');
    if (hint) {
      const resolved = plan.targetId ? rfResolveTarget(plan) : null;
      if (resolved) {
        const own = (state.towns || []).some(t => String(t.id) === String(resolved.town_id));
        const coord = resolved.x != null && resolved.y != null ? ` (${resolved.x}|${resolved.y})` : '';
        hint.textContent = `ciudad #${resolved.town_id}${own ? ' | propia' : ' | aliada / externa'}${coord}`;
        hint.style.color = '#6dda7e';
      } else if (plan.targetId) { hint.textContent = 'destino no resuelto (solo ciudades, id numerico)'; hint.style.color = '#f96'; }
      else { hint.textContent = 'id de ciudad propia o aliada; las aldeas no admiten refuerzo'; hint.style.color = '#888'; }
    }
    const rx = sec.querySelector('[data-rf=x]');
    if (rx && document.activeElement !== rx) rx.value = plan.targetX ?? '';
    const ry = sec.querySelector('[data-rf=y]');
    if (ry && document.activeElement !== ry) ry.value = plan.targetY ?? '';
    const help = sec.querySelector('[data-rf=help]');
    if (help) help.value = plan.helpMode;
    const tm = sec.querySelector('[data-rf=timing]');
    if (tm) tm.value = plan.timingMode || 'send_now';
    const pad = sec.querySelector('[data-rf=pad]');
    if (pad && document.activeElement !== pad) pad.value = plan.latencyPadMs ?? 200;
    const floor = sec.querySelector('[data-rf=floor]');
    if (floor && document.activeElement !== floor) floor.value = plan.homeFloor ?? 0;
    const ut = sec.querySelector('[data-rf=unit-type]');
    if (ut) {
      if (!ut.options.length) {
        for (const id of knownUnitIds()) {
          const o = document.createElement('option');
          o.value = id;
          o.textContent = id;
          ut.appendChild(o);
        }
      }
      ut.value = plan.unitType || 'hoplite';
      ut.disabled = plan.helpMode !== 'all_of_type';
      ut.style.opacity = ut.disabled ? '0.4' : '1';
      ut.title = ut.disabled ? "solo se usa con el modo 'todo el tipo'" : 'unidad enviada desde cada ciudad de origen';
    }
    const arr = sec.querySelector('[data-rf=arrival]');
    if (arr && document.activeElement !== arr && plan.arrivalUnix) {
      try {
        const d = new Date(plan.arrivalUnix * 1000 + clientServerSkewMs());
        const p2 = n => String(n).padStart(2, '0');
        arr.value = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
      } catch (_) {}
    }
    const tplNote = sec.querySelector('#gb-rf-tpl');
    if (tplNote) {
      const learned = !!(state.supportTpl && state.supportTpl.action_name);
      tplNote.textContent = learned ? `plantilla de apoyo aprendida (${state.supportTpl.action_name})` : 'sin plantilla aprendida - se usa la ruta canonica town_info/send_units';
      tplNote.style.color = learned ? '#6dda7e' : '#888';
    }
    rfRenderSources(sec, plan);
    rfRenderPerTown(sec, plan);
    rfRenderSchedule(sec);
  }
  function bindReinforceTab() {
    const sec = panel && panel.querySelector('section[data-tab=reinforce]');
    if (!sec || sec.dataset.bound) return;
    sec.dataset.bound = '1';
    sec.querySelector('#gb-rf-preview')?.addEventListener('click', () => {
      const plan = rfReadForm();
      const sched = rfBuildSchedule(plan);
      if (sched.error) { flash(sched.error); return; }
      rfPreviewRows = sched.rows;
      gbLog(`support preview: ${sched.rows.length} towns, mode=${plan.helpMode}, skew=${Math.round(sched.skew)}ms`);
      renderReinforce();
    });
    sec.querySelector('#gb-rf-arm')?.addEventListener('click', () => {
      const plan = rfReadForm();
      const sched = rfBuildSchedule(plan);
      if (sched.error) { flash(sched.error); return; }
      rfPreviewRows = sched.rows;
      const ok = sched.rows.filter(r => r.boats.ok && r.unitCount && r.status !== 'past' && r.status !== 'no-travel');
      if (!ok.length) { flash('sin ciudades listas'); renderReinforce(); return; }
      if (!confirm(`Armar ${ok.length} refuerzo(s) (${plan.timingMode})?`)) return;
      rfArmWave(plan, ok);
    });
    sec.querySelector('#gb-rf-cancel')?.addEventListener('click', () => rfCancelArmed());
    sec.querySelector('#gb-rf-now')?.addEventListener('click', () => {
      const plan = rfReadForm();
      const sched = rfBuildSchedule(plan);
      if (sched.error) { flash(sched.error); return; }
      rfPreviewRows = sched.rows;
      renderReinforce();
      rfFireNow(plan, sched.rows);
    });
    // Every control except the picker feeds the plan on change. Binding only
    // help/target left timing + unit-type (which renderReinforce writes
    // unconditionally) and x/y/pad/floor/arrival (written back on blur) to be
    // reverted to the stored plan by the next repaint, so a value typed before
    // pressing Previsualizar was silently lost. [data-rf=pick] is excluded: it
    // is not a form field but a "copy this known destination into targetId"
    // control, and rfReadForm would re-read the not-yet-written target input.
    sec.querySelectorAll('[data-rf]:not([data-rf=pick])').forEach(el => {
      el.addEventListener('change', () => { rfReadForm(); renderReinforce(); });
    });
    sec.querySelector('[data-rf=pick]')?.addEventListener('change', e => {
      const id = e.target.value;
      if (!id) return;
      const t = rfKnownTargets().find(x => String(x.id) === String(id));
      if (t) rfApplyTarget(t);
    });
    sec.querySelector('#gb-rf-src-all')?.addEventListener('click', () => rfSetAllSources(true));
    sec.querySelector('#gb-rf-src-none')?.addEventListener('click', () => rfSetAllSources(false));
    sec.querySelector('#gb-rf-src-def')?.addEventListener('click', () => rfSelectRoleSources(ATTACK_ROLE_DEFENSE));
    sec.querySelector('#gb-rf-src-off')?.addEventListener('click', () => rfSelectRoleSources(ATTACK_ROLE_OFFENSE));
  }
