  // ===== Support / reinforcement auto-send (v4 plan 3.2) =====================
  // This module spends real troops irreversibly, so it runs full HIGH-RISK
  // discipline even at Med risk class: default OFF, its own learned template,
  // a confirm gate per destination window, its own lock and captcha key, and
  // the dry-run gate every write feature already inherits from txActionGate.
  //
  // It adds NO scheduler. The driver is the existing 5s dodgeScan loop, and it
  // only arms for movements dodge did not already act on.
  //
  // supportTpl is DELIBERATELY separate from attackTpl even though the payload
  // signature is the same Town/<id>|sendUnits. Sharing it would recreate the
  // v2.5.7 favor-vs-attack poisoning: one server rejection on type:'support'
  // would invalidate attackTpl and block live attacks too.
  const SUPPORT_LEDGER_GRACE_MS = 600000;
  const SUPPORT_LEDGER_PRUNE_MS = 3600000;
  const SUPPORT_BANDS = ['high', 'cs'];
  function supportCfg() {
    const c = (state.supportCfg && typeof state.supportCfg === 'object') ? state.supportCfg : {};
    return {
      auto: c.auto === true,
      confirmThreshold: gbCfgClamp(c.confirmThreshold, 0, 10000, 100),
      homeFloor: gbCfgClamp(c.homeFloor, 0, 50, 0),
      shareDodgeFloor: c.shareDodgeFloor !== false,
      minEtaSec: gbCfgClamp(c.minEtaSec, 30, 3600, 120),
      noArmSec: gbCfgClamp(c.noArmSec, 10, 600, 60),
      overlapSec: gbCfgClamp(c.overlapSec, 0, 3600, 30),
    };
  }
  function supportLedger() {
    if (!state.supportLastSend || typeof state.supportLastSend !== 'object' || Array.isArray(state.supportLastSend)) {
      state.supportLastSend = {};
    }
    return state.supportLastSend;
  }
  function supportLedgerSave() { save(STORE.SUPPORT_LAST_SEND, supportLedger()); }
  function supportLedgerPrune() {
    const L = supportLedger();
    const cut = Date.now() - SUPPORT_LEDGER_PRUNE_MS;
    let changed = false;
    for (const [k, e] of Object.entries(L)) {
      if (!e || +(e.expires || 0) < cut) { delete L[k]; changed = true; }
    }
    if (changed) supportLedgerSave();
  }
  // The learned Town/<id>|sendUnits payload for type:'support'. Learned from
  // the player's own hand-sent support, never guessed.
  function supportLearnTemplate(j) {
    if (!j || !j.model_url || !j.action_name) return;
    const args = j.arguments || {};
    if (String(args.type || '') !== 'support') return;
    if (typeof isSelfBridge === 'function' && isSelfBridge(j)) return;
    state.supportTpl = {
      model_url: j.model_url, action_name: j.action_name,
      arguments: { type: 'support' }, version: 1, learned_at: Date.now(),
    };
    save(wkey(STORE.SUPPORT_TEMPLATE), state.supportTpl);
    gbLog('learned support template: ' + j.action_name);
    try { tplHealthMarkLearned('supportTpl'); } catch (_) {}
  }
  // No fallback to attackTpl and no hardcoded action name: an unlearned
  // template refuses the post rather than guessing the action the world uses.
  function supportBridgePost(fromTownId, destTownId, units, onDone) {
    const tpl = state.supportTpl;
    if (!tpl || !tpl.model_url || !tpl.action_name) {
      gbLogT('support-template', 60000, 'support: no learned template - send one support by hand once');
      return onDone && onDone('template-required');
    }
    const payload = {
      model_url: 'Town/' + fromTownId,
      action_name: tpl.action_name,
      arguments: Object.assign({ id: +destTownId, type: 'support' }, units),
      town_id: +fromTownId,
    };
    bridgePost('support', payload, onDone);
  }
  // Defense-class units this donor can spare, after the home floor.
  function supportSelectUnits(fromTownId) {
    const cfg = supportCfg();
    const floor = cfg.shareDodgeFloor ? Math.max(0, +state.dodgeFloor || 0) : cfg.homeFloor;
    const out = {};
    let live = {};
    try { live = townLiveUnits(fromTownId) || {}; } catch (_) { live = {}; }
    for (const [u, n0] of Object.entries(live)) {
      const n = +n0 || 0;
      if (!(n > 0) || u === 'militia') continue;
      const m = unitMeta(u);
      if (!m || m.is_naval) continue;
      const fn = classifyUnitFn(u);
      if (fn !== 'defense' && fn !== 'both') continue;
      const send = n - floor;
      if (send > 0) out[u] = send;
    }
    return out;
  }
  // Is a friendly support already going to land in time?
  function supportAlreadyCovered(destId, arrivalSec) {
    let outs = [];
    try { outs = militaryOutgoingMovements() || []; } catch (_) { return false; }
    const cfg = supportCfg();
    for (const m of outs) {
      if (String(m.target) !== String(destId)) continue;
      if (!/^(support|support_sea)$/.test(String(m.type || ''))) continue;
      const arr = +m.arrival || 0;
      if (!arr) continue;
      const a = arr > 1e12 ? Math.floor(arr / 1000) : arr;
      if (a <= arrivalSec - cfg.overlapSec) return true;
    }
    return false;
  }
  function supportDonorLabel(id) {
    try { return townNameById(id); } catch (_) { return String(id); }
  }
  function supportComposeBurst(mov, assess) {
    const eta = assess.eta;
    const donors = [];
    for (const d of (assess.supports || [])) {
      const units = supportSelectUnits(d.from);
      if (!Object.keys(units).length) continue;
      const valid = dodgeSupportValidate(d.from, mov.dest, units);
      if (!valid.ok) {
        gbLogT('support-donor-' + d.from + '-' + mov.dest, 600000,
          `support: donor ${d.from} rejected (${valid.why})`);
        continue;
      }
      // Re-probe travel with the ACTUAL composition: defenseSupportOptions
      // measured a different unit mix, and a slower unit changes the answer.
      let travel = null;
      try {
        travel = computeTravelSeconds(d.from, { town_id: +mov.dest, id: +mov.dest, kind: 'town', ...townCoords(mov.dest) }, units, true);
      } catch (_) {}
      if (travel == null) {
        gbLogT('support-travel-' + d.from, 600000, `support: travel time unreadable from ${d.from} - donor skipped`);
        continue;
      }
      if (eta != null && travel >= eta) continue;
      donors.push({ from: d.from, units, travel, count: Object.values(units).reduce((a, b) => a + b, 0) });
    }
    donors.sort((a, b) => a.travel - b.travel);
    return donors;
  }
  function supportConfirmText(mov, assess, donors, total) {
    const cfg = supportCfg();
    const lines = [];
    lines.push((state.dryRun ? '[DRY-RUN] ' : '') + `Apoyo a ${supportDonorLabel(mov.dest)} (#${mov.dest})`);
    lines.push(`Ataque hostil: ${mov.type || 'atk'}${mov.hasCs ? ' [CS]' : ''} desde ${mov.origin || '?'} en ${assess.eta == null ? '?' : fmtSec(assess.eta)}`);
    lines.push(`Riesgo ${assess.band} (${defenseFactorText(assess.factors)})`);
    lines.push('Donantes propuestos:');
    donors.forEach(d => {
      const mix = Object.entries(d.units).map(([u, n]) => `${u}:${n}`).join(' ');
      lines.push(`  - ${supportDonorLabel(d.from)} (#${d.from}): ${mix} - llega en ${fmtSec(Math.round(d.travel))}`);
    });
    lines.push(`Total: ${total} unidades / ${donors.length} ciudades`);
    lines.push(`Umbral de confirmacion: ${cfg.confirmThreshold}; envio actual: ${total}`);
    lines.push('Enviar? (Cancelar = saltar esta ventana)');
    return lines.join('\n');
  }
  function supportRecordSend(movId, donors, arrivalMs) {
    const L = supportLedger();
    L[String(movId)] = {
      ts: Date.now(),
      expires: arrivalMs + SUPPORT_LEDGER_GRACE_MS,
      donorIds: donors.map(d => String(d.from)),
      state: 'sent',
    };
    supportLedgerSave();
  }
  // Best effort: the server may already have absorbed the support, in which
  // case militaryCancelCommand answers 'not-cancelable' and we stop.
  function supportRecallWindow(movId) {
    const L = supportLedger();
    const e = L[String(movId)];
    if (!e || e.state !== 'sent') return;
    if (!state.cancelTpl) {
      gbLogT('support-recall-tpl', 600000, 'support: recall needs the cancel template - cancel one command by hand once');
      return;
    }
    let outs = [];
    try { outs = militaryOutgoingMovements() || []; } catch (_) { return; }
    const mine = outs.filter(m => /^(support|support_sea)$/.test(String(m.type || '')) && e.donorIds.includes(String(m.home)));
    if (!mine.length) { e.state = 'done'; supportLedgerSave(); return; }
    e.state = 'recalling'; supportLedgerSave();
    for (const m of mine) {
      militaryCancelCommand(m.commandId, { confirmed: true, automation: true }, (err) => {
        if (!err) gbLog(`support: recalled ${m.commandId} from ${m.home}`);
        else if (err === 'not-cancelable') gbLog(`support: recall ${m.commandId} - arrived already`);
        else gbLogT('support-recall-err', 60000, `support: recall ${m.commandId} err ${err}`);
      });
    }
  }
  function supportTryBurst(mov) {
    const cfg = supportCfg();
    if (!cfg.auto) return;
    if (!hostEnabled() || automationPaused({})) return;
    if (captchaPausedAny('support', 'dodge')) return;
    if (!mov || mov.id == null) return;
    const movId = String(mov.id);
    const L = supportLedger();
    const prev = L[movId];
    if (prev && +(prev.expires || 0) > Date.now()) {
      gbLogT('support-flap-' + movId, 300000, `support: already-sent for ${movId}`);
      return;
    }
    const eta = dodgeEtaSec(mov);
    if (eta == null) { gbLogT('support-eta-null', 60000, `support: ETA unreadable for ${movId} - no arm`); return; }
    if (eta <= cfg.noArmSec) { gbLogT('support-closed-' + movId, 300000, `support: window closed for ${movId} at ${eta}s`); return; }
    if (eta < cfg.minEtaSec) return;
    let assess = null;
    try { assess = defenseAssessment(mov); } catch (_) { return; }
    if (!assess) return;
    // The ONE threshold this module reads. A 'med' band is advisory only; the
    // score itself is plan 5.3's, never re-derived here.
    if (!SUPPORT_BANDS.includes(assess.band)) {
      if (assess.band === 'med') gbLogT('support-advice-' + movId, 600000, `support: ${mov.dest} band med - advisory only, no arm`);
      return;
    }
    const arrivalSec = gameNow() + eta;
    if (supportAlreadyCovered(mov.dest, arrivalSec)) {
      gbLogT('support-covered-' + movId, 300000, `support: ${mov.dest} already covered by a friendly in flight`);
      return;
    }
    const donors = supportComposeBurst(mov, assess);
    if (!donors.length) { gbLogT('support-nodonor-' + movId, 300000, `support: no donor for ${mov.dest}`); return; }
    const total = donors.reduce((a, d) => a + d.count, 0);
    if (total > cfg.confirmThreshold) {
      let ok = false;
      try { ok = gameUw().confirm(supportConfirmText(mov, assess, donors, total)); } catch (_) { ok = false; }
      if (!ok) {
        gbLog(`support: confirm declined for window ${mov.dest}`);
        // No post means no flap risk, so the anti-flap ledger is NOT stamped.
        return;
      }
    }
    const lockToken = gbLock('support');
    // No self-retry timer: the 5s dodgeScan loop is already the retry driver,
    // and adding one here would double-drive the same movement.
    if (!lockToken) { gbLogT('support-busy', 60000, 'support: another burst in flight - will retry on the next pass'); return; }
    let i = 0, sent = 0;
    const slowest = donors.reduce((m, d) => Math.max(m, d.travel), 0);
    // Function declaration, NOT a named IIFE — the IIFE form bound `next` only
    // inside the function body, so supportStep's `gbTimeout(next, ...)` calls
    // threw ReferenceError on every stale donor / callback and the outer
    // try/catch then aborted the whole burst.
    function next() {
      try { supportStep(); } catch (e) {
        gbUnlock('support', lockToken);
        gbLogT('support-throw', 60000, 'support: burst aborted - ' + String(e).slice(0, 60));
      }
    }
    next();
    function supportStep() {
      if (!gbLockTouch('support', lockToken)) return;
      if (i >= donors.length) {
        gbUnlock('support', lockToken);
        if (sent) {
          supportRecordSend(movId, donors, Date.now() + slowest * 1000);
          gbLog(`support: sent ${sent}/${donors.length} donor(s) to ${mov.dest}`);
        }
        return;
      }
      const d = donors[i++];
      // Re-validate immediately before the post: the garrison may have moved
      // while an earlier donor in this same burst was in flight.
      const valid = dodgeSupportValidate(d.from, mov.dest, d.units);
      if (!valid.ok) {
        gbLogT('support-stale-' + d.from, 60000, `support: donor ${d.from} stale (${valid.why})`);
        gbTimeout(next, 200);
        return;
      }
      supportBridgePost(d.from, mov.dest, d.units, (err) => {
        if (err === 'captcha' || err === 'captcha-pause') { gbUnlock('support', lockToken); return; }
        if (!err) { sent++; gbLog(`support bridge: sendUnits town ${d.from} -> ${mov.dest} (support, ${Object.keys(d.units).length} tipos / ${d.count} unidades)`); }
        else gbLogT('support-err', 60000, `support err ${err}`);
        gbTimeout(next, 700 + Math.random() * 500);
      });
    }
  }
  function supportScan(reason) {
    supportLedgerPrune();
    if (!supportCfg().auto) return;
    if (!hostEnabled() || automationPaused({})) return;
    // Recall pass: a burst whose target movement is gone (attack cancelled or
    // already landed) should not keep troops walking into an empty window.
    let live = new Set();
    try { live = new Set((dodgeIncomingMovements() || []).map(m => String(m.id))); } catch (_) { return; }
    for (const [movId, e] of Object.entries(supportLedger())) {
      if (!e || e.state !== 'sent') continue;
      if (live.has(movId)) continue;
      supportRecallWindow(movId);
    }
  }
