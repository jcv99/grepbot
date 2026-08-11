  function statsPct(n, d) { return d ? Math.round(n / d * 100) + '%' : '-'; }

  function preflightProbe(name, fn) {
    try {
      const r = fn();
      if (!r) return { name, ok: false, detail: 'no result' };
      return { name, ok: r.ok !== false, detail: r.detail || '', warn: !!r.warn };
    } catch (e) {
      return { name, ok: false, detail: String(e).slice(0, 80) };
    }
  }
  function preflightRun() {
    const out = [];
    const uw = gameUw();
    const bs = gameBridgeStatus();
    out.push(preflightProbe('bridge', () => ({
      ok: bs.MM && bs.gpAjax && bs.ITowns,
      detail: Object.keys(bs).filter(k => bs[k]).join(' ') || 'nothing readable',
    })));
    out.push(preflightProbe('csrf', () => ({
      ok: !!state.csrf,
      detail: state.csrf ? state.csrf.slice(0, 6) + '…' : 'not found (GM_xmlhttpRequest report fetch needs it)',
    })));
    out.push(preflightProbe('towns', () => {
      const t = (townsFromGame() || []);
      return { ok: t.length > 0, detail: t.length + ' towns readable' };
    }));
    out.push(preflightProbe('farm claims', () => {
      const farms = farmsFromGame() || [];
      const ready = farms.filter(f => f.lootable_at == null || gameNow() >= f.lootable_at).length;
      const tpl = state.claimTpl ? 'template learned' : 'template NOT learned (claim once by hand)';
      return {
        ok: farms.length > 0,
        warn: !state.claimTpl,
        detail: `${farms.length} villages, ${ready} claimable, ${tpl}, options ${farmOptionMapText()}`,
      };
    }));
    out.push(preflightProbe('farm resource scrape', () => {
      const st = (typeof farmScrapeState === 'function') ? farmScrapeState() : { dead: false, misses: 0 };
      const on = !!state.farmScrape;
      const learned = !!state.farmAction;
      if (!on) return { ok: true, warn: true, detail: 'disabled in Config (reads no village stock)' };
      if (st.dead) return { ok: false, detail: `endpoint dead after ${st.misses} empty sweeps - teach it by opening a village, then re-enable` };
      const okRows = Object.values(state.farmResources || {}).filter(r => r && r.ok).length;
      return {
        ok: okRows > 0 || !learned,
        warn: !learned,
        detail: `${okRows} villages with data, action ${state.farmAction || 'not learned'}, misses ${st.misses || 0}`,
      };
    }));
    out.push(preflightProbe('sleep claim', () => {
      const sec = farmSleepDuration();
      const opt = farmOptionFor(sec);
      return {
        ok: opt != null,
        warn: opt == null,
        detail: opt != null ? `${farmDurLabel(sec)} = option ${opt}` : `${farmDurLabel(sec)} not learned - claim that timer once by hand`,
      };
    }));
    out.push(preflightProbe('instant build', () => {
      const orders = ibOrders() || [];
      const free = orders.filter(o => o.isFree).length;
      return { ok: true, detail: `${orders.length} orders, ${free} free now, action ${state.ibAction}` };
    }));
    out.push(preflightProbe('instant research', () => {
      const r = (typeof ibResearchOrders === 'function' ? (ibResearchOrders({}) || []) : []);
      return {
        ok: state.ibResearch !== false,
        detail: `${r.length} research orders, action ${state.ibActionR}${state.ibResearch === false ? ' (OFF)' : ''}`,
      };
    }));
    out.push(preflightProbe('cave', () => {
      const ids = caveListTownIds() || [];
      let withHide = 0, readable = 0;
      ids.forEach(id => {
        const info = caveTownInfo(id);
        if (!info) return;
        readable++;
        if (info.hideLvl > 0) withHide++;
      });
      return {
        ok: readable > 0,
        warn: withHide === 0,
        detail: `${readable}/${ids.length} towns readable, ${withHide} with a hide`,
      };
    }));
    out.push(preflightProbe('trade', () => {
      const t = tradeListTowns() || [];
      const cap = t.filter(x => x.cap > 0).length;
      return { ok: t.length >= 2, detail: `${t.length} towns, ${cap} with readable capacity` };
    }));
    out.push(preflightProbe('research', () => {
      const ids = (townsFromGame() || []).map(t => t.id);
      const info = ids.length ? researchTownTechs(ids[0]) : null;
      const n = info && info.techs ? Object.keys(info.techs).length : 0;
      return { ok: !!info && info.academy >= 0 && n >= 0, warn: !n, detail: info ? `${n} researched-tech flags, academy ${info.academy}` : 'academy techs unreadable' };
    }));
    // The academy read path is the one that silently produced "nothing ever
    // posts": every gate was blocked on a value that could not be read. Name the
    // unreadable one instead of making the next person diff the client again.
    out.push(preflightProbe('academy read path', () => {
      const ids = (townsFromGame() || []).map(t => t.id);
      const tid = ids[0];
      const info = tid != null ? researchTownTechs(tid) : null;
      if (!info) return { ok: false, detail: 'no readable town' };
      const parts = [];
      let bad = 0;
      let defs = 0;
      try { defs = Object.keys((gameUw().GameData && gameUw().GameData.researches) || {}).length; } catch (_) {}
      if (defs) parts.push(`GameData.researches ${defs}`);
      else { parts.push('GameData.researches UNREADABLE'); bad++; }
      parts.push(`academy ${info.academy}`);
      parts.push(info.library == null ? 'library UNREADABLE' : `library ${info.library}`);
      if (info.library == null) bad++;
      parts.push(info.ordersKnown ? `real queue ${info.orders.length}/${researchQueueMax()}` : 'real queue UNREADABLE (open that town once)');
      if (!info.ordersKnown) bad++;
      const pts = researchPointsAvailable(tid, info);
      if (pts == null) { parts.push('research points UNREADABLE'); bad++; }
      else parts.push(`research points ${pts}`);
      parts.push(info.smallIsland == null ? 'small-island flag unreadable' : `small island ${info.smallIsland}`);
      return { ok: bad === 0, warn: bad > 0, detail: parts.join(', ') };
    }));

    // Village recruit: HIGH-RISK, default OFF. Probes that the four preconditions
    // are reachable without forcing a post: learned bridge template, unit-count
    // read path, and farm-resources fill read. Anything unreadable becomes a
    // warn, not a fail - the feature is opt-in, so "nothing to do" is fine.
    out.push(preflightProbe('village recruit', () => {
      const parts = [];
      let bad = 0, warn = 0;
      const tpl = state.acceptUnitsTpl;
      if (tpl && tpl.action_name) parts.push(`tpl ${tpl.action_name}`);
      else { parts.push('tpl UNLEARNED (open a village, click Aceptar once)'); warn++; }
      const farms = (state.farmsParsed || []);
      const sample = farms.find(f => f && f.vill_id);
      if (!sample) { parts.push('no farms known'); warn++; return { ok: true, warn: true, detail: parts.join(', ') }; }
      const counts = villageUnitCounts(sample.vill_id);
      if (counts && counts.known) {
        const u = counts.units;
        parts.push(`units ${u.sword}/${u.archer}/${u.hoplite}/${u.slinger}`);
      } else { parts.push('unit counts UNREADABLE (attribute shape unknown)'); bad++; }
      const fr = state.farmResources && state.farmResources[sample.vill_id];
      if (fr && fr.ok && fr.cap > 0) parts.push(`fill read OK (cap ${fr.cap})`);
      else { parts.push('fill read pending (next farm scrape)'); warn++; }
      return { ok: bad === 0, warn: warn > 0 || bad > 0, detail: parts.join(', ') };
    }));

    out.push(preflightProbe('tx registry', () => {
      const tx = state.txState || {};
      // Match tx.js lifecycle states (planned/precheck/sending/confirming/reconciling/
      // committed/dryrun) and the terminal flags (failed/aborted/unknown/manual-review).
      // Dodge queue states (pending/sent) belong to dodge.js and are not in txState.
      const inflight = Object.values(tx).filter(t => t && /^(planned|precheck|sending|confirming|reconciling|sent|dryrun|aborted|failed|unknown|manual-review)$/.test(t.state || '')).length;
      const unknown = Object.values(tx).filter(t => t && /^(unknown|manual-review)$/.test(t.state || '')).length;
      const stale = Object.values(tx).filter(t => t && t.state === 'aborted' && (Date.now() - (+t.updatedAt || 0)) > 600000).length;
      return {
        ok: true,
        warn: unknown > 0 || stale > 0,
        detail: `${Object.keys(tx).length} transactions, ${inflight} live, ${unknown} unknown, ${stale} stale-aborted`,
      };
    }));
    out.push(preflightProbe('phoenician', () => {
      const view = !!state.ptViewUrl;
      const tpl = !!state.ptTradeTpl;
      const on = !!state.autoPtTrade;
      const parser = (typeof ptParseOffers === 'function') ? 'parser defined' : 'parser MISSING';
      return {
        ok: view || tpl || !on,
        warn: on && !(view && tpl),
        detail: `view ${view ? 'aprendida' : 'SIN aprender'}, tpl ${tpl ? 'aprendido' : 'SIN aprender'}, auto ${on ? 'ON' : 'OFF'}, ${parser}`,
      };
    }));
    out.push(preflightProbe('native queue', () => {
      const nq = state.nativeQueue || {};
      const towns = Object.keys(nq.towns || {}).length;
      const build = Object.values(nq.towns || {}).reduce((n, t) => n + (Array.isArray(t.build) ? t.build.length : 0), 0);
      const recruit = Object.values(nq.towns || {}).reduce((n, t) => n + (Array.isArray(t.recruit) ? t.recruit.length : 0), 0);
      const research = Object.values(nq.towns || {}).reduce((n, t) => n + (Array.isArray(t.research) ? t.research.length : 0), 0);
      return { ok: towns === 0 || (build + recruit + research) > 0, detail: `${towns} town(s) in native queue, ${build} build / ${recruit} recruit / ${research} research jobs` };
    }));
    out.push(preflightProbe('intel: battle stats', () => {
      const n = (state.findings || []).length;
      const withVerdict = (state.findings || []).filter(f => f && f.outcome).length;
      return {
        ok: true,
        // A small sample is not a failure, it is just not meaningful yet.
        warn: n < 5,
        detail: state.intelBattleStats === false
          ? 'desactivado en Config'
          : `${n} informes, ${withVerdict} con resultado` + (n < 5 ? ' - muestra pequena' : ''),
      };
    }));
    out.push(preflightProbe('support: auto-send', () => {
      const cfg = supportCfg();
      const tpl = !!(state.supportTpl && state.supportTpl.action_name);
      const paused = captchaPaused('support');
      const ledger = Object.keys(state.supportLastSend || {}).length;
      return {
        // Auto ON with no learned template is the one state worth flagging:
        // the feature will refuse every post until a hand-sent support is seen.
        ok: true,
        warn: (cfg.auto && !tpl) || (cfg.auto && paused),
        detail: `auto ${cfg.auto ? 'ON' : 'OFF'}, tpl ${tpl ? state.supportTpl.action_name : 'SIN aprender (envia un apoyo a mano)'}` +
          `, confirmar>${cfg.confirmThreshold}, ${ledger} ventana(s) en registro` + (paused ? ', CAPTCHA' : ''),
      };
    }));
    out.push(preflightProbe('trade routes', () => {
      const all = Object.values(state.tradeRoutes || {});
      const enabled = all.filter(r => r && r.enabled !== false).length;
      const towns = new Set((townsFromGame() || []).map(t => String(t.id)));
      // A route pointing at a town this world does not have is dead weight and
      // the planner will skip it forever - surface it instead of hiding it.
      const orphan = all.filter(r => r && (!towns.has(String(r.from)) || !towns.has(String(r.to)))).length;
      return {
        ok: true,
        warn: orphan > 0 || (state.autoTradeRoutes && !enabled),
        detail: `${all.length} rutas, ${enabled} activas, bucle ${state.autoTradeRoutes ? 'ON' : 'OFF'}` +
          (orphan ? `, ${orphan} con ciudades desconocidas en este mundo` : ''),
      };
    }));
    out.push(preflightProbe('intel: threat engine weights', () => {
      const raw = (state.predictCfg && state.predictCfg.threatWeights) || null;
      const w = defenseThreatWeights();
      // A hand-edited out-of-range value is clamped, not honoured - say so
      // rather than silently scoring with a number the user did not set.
      const drift = raw ? Object.keys(w).filter(k => raw[k] != null && +raw[k] !== w[k]) : [];
      return {
        ok: true,
        warn: drift.length > 0,
        detail: `cs ${w.cs} eta15 ${w.eta15} sim ${w.simPer}/${w.simCap} weak ${w.weak} apoyo -${w.supportPer}/${w.supportCap} umbral ${w.smartThreshold}` +
          (raw ? '' : ' (por defecto)') + (drift.length ? ` - fuera de rango y ajustado: ${drift.join(',')}` : '') +
          ` \u00b7 banda ${defenseThreatBand(w.smartThreshold, false)} al umbral`,
      };
    }));
    out.push(preflightProbe('farm profit', () => {
      const farms = state.farmsParsed || [];
      const rows = Object.values(state.farmProfit || {});
      const scored = rows.filter(r => r && r.score != null).length;
      const blind = rows.length - scored;
      return {
        ok: true,
        warn: farms.length > 0 && scored === 0,
        detail: `${farms.length} aldeas, ${scored} puntuadas, ${blind} ciegas, marcha ${state.farmTravelSecPerUnit || 0}s/u`,
      };
    }));
    out.push(preflightProbe('loot calculator', () => {
      const e = gbLootEstimate({ kind: 'farm-claim', durationSec: 3600, loyalty: 1, headroom: 100000 });
      const carry = gbLootEstimate({ kind: 'attack-loot', units: { sword: 1 } });
      return {
        ok: true,
        // farm-claim is non-blind by design; attack-loot blind is EXPECTED
        // until a client is found that names the per-unit carry field.
        warn: !!e.blind,
        detail: `farm-claim ${e.total}/h` + (e.blind ? ` BLIND (${e.blindReason})` : '') +
          ` \u00b7 attack-loot ${carry.blind ? 'ciego (' + carry.blindReason + ')' : carry.total}`,
      };
    }));
    out.push(preflightProbe('composition advisor', () => {
      const rows = militaryCompositionAll();
      const withShort = rows.filter(r => r.shortageTotal > 0).length;
      const blind = rows.reduce((n, r) => n + (r.blind || 0), 0);
      return {
        ok: true,
        warn: blind > 0,
        detail: `${rows.length} ciudades, ${withShort} con faltantes, ${blind} ciegas`,
      };
    }));
    out.push(preflightProbe('research graph', () => {
      const g = researchGraphBuild();
      if (!g.known) return { ok: false, detail: g.why };
      return { ok: true, warn: !!g.blind, detail: `${g.ids.length} tecnologias leidas` + (g.blind ? ' - ' + g.why : '') };
    }));
    out.push(preflightProbe('optimal build order', () => {
      if (state.abOptimalOrderOn === false) return { ok: true, detail: 'desactivado en Config' };
      const ids = (townsFromGame() || []).map(t => t.id);
      const tid = ids.find(id => Object.keys(goalEffectiveBuildTargets(id) || {}).length);
      if (tid == null) return { ok: true, warn: true, detail: 'ninguna ciudad con objetivos de construccion' };
      const opt = abOptimalOrderCached(tid);
      if (opt.error) return { ok: false, detail: `ciudad ${tid}: ${opt.error}` };
      const blocked = (opt.actions || []).filter(a => a.status === 'blocked' || a.status === 'waiting-resources').length;
      const ledgerBlind = (opt.actions || []).some(a => a.why === 'planner-unreadable');
      return {
        ok: true,
        warn: ledgerBlind,
        detail: `${(opt.actions || []).length} entradas \u00b7 ${blocked} bloqueadas` + (ledgerBlind ? ' - contable del planificador no legible' : ''),
      };
    }));
    out.push(preflightProbe('goal profile', () => {
      const known = goalProfiles();
      const goals = state.townGoals || {};
      const ids = Object.keys(goals);
      const bad = ids.filter(id => !known[(goals[id] || {}).profile || 'custom']);
      return {
        ok: bad.length === 0,
        detail: ids.length
          ? `${ids.length} town(s) assigned, ${Object.keys(known).length} profiles known` + (bad.length ? `, UNKNOWN profile on ${bad.join(',')}` : '')
          : `no per-town profile assigned yet, ${Object.keys(known).length} profiles known`,
      };
    }));
    out.push(preflightProbe('queue center', () => {
      const towns = (typeof townsFromGame === 'function' ? townsFromGame() : null) || [];
      return {
        ok: typeof nativeQueueHasPending === 'function',
        detail: `open the Queue Center window: ${towns.length} town(s) resolvable`,
      };
    }));
    out.push(preflightProbe('cost reads', () => {
      const ids = (townsFromGame() || []).map(t => t.id);
      const tid = ids[0];
      const parts = [];
      let blind = 0;
      const cap = tid != null ? townResState(tid) : null;
      if (cap) parts.push('stock+capacity ok');
      else { parts.push('stock UNREADABLE'); blind++; }
      const pop = tid != null ? gbTownPop(tid) : null;
      if (pop != null) parts.push('population ok');
      else { parts.push('population UNREADABLE'); blind++; }
      const gold = gbPlayerGold();
      if (gold != null) parts.push('gold ok');
      else { parts.push('gold UNREADABLE'); blind++; }
      const rc = typeof researchCost === 'function' ? researchCost(RESEARCH_CS_FAST[0]) : null;
      if (rc) parts.push('research costs ok');
      else { parts.push('research costs UNREADABLE'); blind++; }
      const bc = (tid != null && typeof abBuildingCost === 'function') ? abBuildingCost(tid, 'main') : null;
      if (bc) parts.push('building costs ok');
      else { parts.push('building costs unreadable (open a build window once)'); blind++; }
      return { ok: blind < 5, warn: blind > 0, detail: parts.join(', ') };
    }));
    out.push(preflightProbe('attack', () => ({
      ok: !!state.attackTpl,
      warn: !state.attackTpl,
      detail: state.attackTpl ? 'template learned' : 'template NOT learned (send one attack by hand)',
    })));
    out.push(preflightProbe('cancel', () => {
      const n = typeof militaryOutgoingMovements === 'function' ? militaryOutgoingMovements().length : 0;
      return { ok: true, warn: !state.cancelTpl, detail: state.cancelTpl ? `template learned; ${n} cancelable` : `template not learned; ${n} cancelable (cancel once manually)` };
    }));
    out.push(preflightProbe('heroes', () => {
      if (!heroesEnabled()) return { ok: true, warn: true, detail: 'heroes disabled on this world' };
      const list = playerHeroesList();
      const acts = state.heroTpl && typeof state.heroTpl === 'object' ? Object.keys(state.heroTpl) : [];
      return { ok: list.length > 0, warn: !list.length || !acts.length, detail: `${list.length} hero(es); learned actions: ${acts.join(',') || 'none'}` };
    }));
    out.push(preflightProbe('incoming', () => {
      const mv = (typeof dodgeIncomingMovements === 'function' ? (dodgeIncomingMovements() || []) : []);
      return { ok: true, detail: `${mv.length} incoming movements visible` };
    }));
    out.push(preflightProbe('quests', () => {
      const col = mmCol('Progressable') || mmCol('IslandQuest');
      const n = col && col.models ? col.models.length : 0;
      return { ok: n >= 0, detail: n ? n + ' quest models' : 'no quest collection (open a quest once)' };
    }));
    out.push(preflightProbe('bandit camp', () => {
      let spot = null;
      try { spot = uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('PlayerAttackSpot'); } catch (_) {}
      return { ok: !!spot, warn: !spot, detail: spot ? 'attack spot model present' : 'no attack spot on this world' };
    }));
    out.push(preflightProbe('scheduler', () => {
      const on = orchStatus().filter(s => s.on);
      const idle = on.filter(s => s.idle >= 4).map(s => s.key);
      return {
        ok: true,
        detail: `${on.length} econ features ON${idle.length ? ', idle-backed-off: ' + idle.join(',') : ''}`,
      };
    }));
    out.push(preflightProbe('client fingerprint',()=>{const r=clientFingerprintCompatible(state.clientFingerprint,clientFingerprintNow());return{ok:r.ok,detail:r.ok?'compatible':r.why}}));
    out.push(preflightProbe('resource planner',()=>{let ids=[];try{ids=Object.keys((uw.ITowns&&uw.ITowns.towns)||{})}catch(_){};const bad=ids.filter(id=>!plannerSnapshot(id));return{ok:bad.length===0,detail:bad.length?`unreadable towns: ${bad.join(',')}`:`${ids.length} town snapshots`}}));
    out.push(preflightProbe('goal planner',()=>{const plans=goalPlanAll();const bad=plans.filter(p=>p.error);return{ok:bad.length===0,warn:bad.length>0,detail:`${plans.length} plans, ${bad.length} unreadable`}}));
    out.push(preflightProbe('safe mode',()=>({ok:true,warn:!!state.safeMode,detail:state.safeMode?'ON: high-impact writes blocked':'off'})));
    out.push(preflightProbe('guards', () => {
      const locks = gbLockList();
      const paused = Object.keys(state.captchaBreakers || {}).filter(k => captchaPaused(k));
      const parts = [];
      if (state.dryRun) parts.push('DRY-RUN ON (nothing will be sent)');
      if (locks.length) parts.push('locks held: ' + locks.join(','));
      if (paused.length) parts.push('captcha: ' + paused.join(','));
      if (gbServerPaused()) parts.push('server cooldown ' + fmtSec(Math.round(gbServerCooldownLeftMs() / 1000)));
      const skips = jrnActiveSkips();
      if (skips.length) parts.push(skips.length + ' memory skip windows');
      const openCircuits = Object.keys(state.circuits || {}).filter(k => state.circuits[k] && state.circuits[k].open);
      const unknownTx = Object.values(state.txState || {}).filter(t => t && /^(unknown|manual-review)$/.test(t.state || '')).length;
      if (openCircuits.length) parts.push('OPEN circuits: ' + openCircuits.join(','));
      if (unknownTx) parts.push(unknownTx + ' UNKNOWN transaction(s) require reconciliation/review');
      return { ok: openCircuits.length === 0 && unknownTx === 0, warn: parts.length > 0, detail: parts.length ? parts.join(' | ') : 'clear' };
    }));
    return out;
  }

  let preflightLast = null;
  function preflightRunAndRender() {
    preflightLast = { at: Date.now(), rows: preflightRun() };
    const bad = preflightLast.rows.filter(r => !r.ok).length;
    gbLog(`preflight: ${preflightLast.rows.length - bad}/${preflightLast.rows.length} checks pass`);
    preflightLast.rows.forEach(r => gbLog(`  ${r.ok ? (r.warn ? 'WARN' : 'ok  ') : 'FAIL'} ${r.name}: ${r.detail}`));
    renderStats();
    flash(bad ? `preflight: ${bad} failing` : 'preflight: all pass');
  }

  function renderStats() {
    const sec = panel && panel.querySelector('section[data-tab=stats]');
    if (!sec || sec.hidden) return;
    const box = sec.querySelector('.stats-body');
    if (!box) return;
    const st = jrnStats(STATS_WINDOWS[statsWindow] || 86400000);
    const lines = [];
    lines.push(`ventana ${statsWindow} | ${st.total} decisiones | ${st.attempts} intentos | exito ${st.successPct == null ? '-' : st.successPct + '%'}`);
    lines.push(`ok ${st.ok}  err ${st.err}  captcha ${st.captcha}  timeout ${st.timeout}  pendiente ${st.pending}  saltadas ${st.skip}${st.dry ? ` (simulacion ${st.dry})` : ''}`);
    const claims = jrnCountOk('farm', /claim/i, STATS_WINDOWS[statsWindow] || 86400000);
    const builds = jrnCountOk('build', /Instant|instant/i, STATS_WINDOWS[statsWindow] || 86400000)
      + jrnCountOk('instant-build', null, STATS_WINDOWS[statsWindow] || 86400000);
    lines.push(`reclamos de granjas ${claims} | completados inst. ${builds}`);
    lines.push('');
    lines.push('feature      ok   err  tout  pend  cap  skip   rate');
    const feats = Object.keys(st.byFeature).sort();
    if (!feats.length) lines.push('  (sin decisiones en esta ventana)');
    feats.forEach(f => {
      const v = st.byFeature[f];
      const att = v.ok + v.err + v.captcha + v.timeout;
      lines.push(
        f.padEnd(12).slice(0, 12) +
        String(v.ok).padStart(4) +
        String(v.err).padStart(6) +
        String(v.timeout).padStart(6) +
        String(v.pending).padStart(6) +
        String(v.captcha).padStart(5) +
        String(v.skip).padStart(6) +
        statsPct(v.ok, att).padStart(7));
    });
    if (st.topErrors.length) {
      lines.push('');
      lines.push('errores principales');
      st.topErrors.forEach(([k, n]) => lines.push(`  ${n}x ${k}`));
    }
    if (st.topPending.length) {
      lines.push('');
      lines.push('estados de tx pendientes (no son errores)');
      st.topPending.forEach(([k, n]) => lines.push(`  ${n}x ${k}`));
    }
    if (st.topSkips.length) {
      lines.push('');
      lines.push('razones principales de salto');
      st.topSkips.forEach(([k, n]) => lines.push(`  ${n}x ${k}`));
    }
    lines.push('');
    const dl = (typeof orchDeadlockState === 'function') ? orchDeadlockState() : null;
    if (dl && dl.open) {
      lines.push(`ATASCO DE ALMACEN abierto en ${dl.towns.join(',') || '?'} - cueva/comercio/aldeas van antes que recoleccion`);
      lines.push('');
    }
    lines.push('planificador (cadencia con adaptativa por inactividad)');
    orchStatus().filter(s => s.on).forEach(s => {
      lines.push(`  ${s.key.padEnd(11)} cada ${fmtSec(Math.round(s.cadenceMs / 1000)).padEnd(6)} proxima ${fmtSec(Math.round(s.dueInMs / 1000)).padEnd(6)}${s.idle ? ' inact. x' + s.idle : ''}${s.captcha ? ' CAPTCHA' : ''}`);
      // Transport has no orch key of its own - it is a tradeScan sub-planner,
      // so its counter hangs off the trade row it actually runs on.
      if (s.key === 'trade' && state.autoTransport) {
        const since = Date.now() - 3600000;
        const rows = (state.decisions || []).filter(d => d && d.f === 'trade' && (+d.ts || 0) >= since);
        const ok = rows.filter(d => d.r === 'ok').reduce((n, d) => n + (+d.n || 1), 0);
        const skip = rows.filter(d => /^skip/.test(String(d.r || ''))).reduce((n, d) => n + (+d.n || 1), 0);
        lines.push(`    transporte ON - ultima hora en la cola de comercio: ${ok} ok / ${skip} skip`);
      }
    });
    const locks = gbLockList();
    lines.push('');
    const byScope = typeof reqBudgetByScope === 'function' ? reqBudgetByScope() : null;
    const softMs = typeof reqBudgetSoftDelayMs === 'function' ? reqBudgetSoftDelayMs() : 0;
    lines.push(`peticiones ultimo min ${reqBudgetUsed()}/${state.reqBudgetPerMin || 40}` +
      (byScope ? ` (accion ${byScope.action}/${reqBudgetCap('action')} · lectura ${byScope.read}/${reqBudgetCap('read')} · escaneo ${byScope.scrape}/${reqBudgetCap('scrape')})` : '') +
      (softMs ? ` | freno suave ${softMs}ms` : '') +
      (gbServerPaused() ? ` | server cooldown ${fmtSec(Math.round(gbServerCooldownLeftMs() / 1000))}` : '') +
      (locks.length ? ` | locks ${locks.join(',')}` : '') +
      (state.dryRun ? ' | DRY-RUN' : ''));
    const budgetSkips = st.topSkips ? (st.topSkips.find(([k]) => /budget/.test(k)) || [null, 0])[1] : 0;
    if (budgetSkips) lines.push(`  ${budgetSkips} accion(es) saltadas por presupuesto en la ventana`);
    if (preflightLast) {
      lines.push('');
      lines.push(`preflight (${new Date(preflightLast.at).toLocaleTimeString()})`);
      preflightLast.rows.forEach(r => {
        lines.push(`  ${r.ok ? (r.warn ? '!' : '+') : 'x'} ${r.name}: ${r.detail}`);
      });
    }
    box.textContent = lines.join('\n');
  }

  // ---------- evidence snapshot (diagnostics export) ----------
  function evidenceTplShape(v) {
    if (v == null) return { present: false };
    const t = Array.isArray(v) ? 'array' : typeof v;
    if (t === 'object') return { present: true, type: 'object', keys: Object.keys(v).sort() };
    if (t === 'array') return { present: true, type: 'array', length: v.length };
    return { present: true, type: t };
  }
  function evidenceMask(id) {
    if (state.exportRedact === false) return id;
    if (id == null || id === '') return id;
    const s = String(id);
    if (/^\d+$/.test(s)) return s.length <= 2 ? '**' : s.slice(0, 2) + '***';
    if (s.length <= 3) return '***';
    return s.slice(0, 2) + '***';
  }
  function evidenceLastByFeature(maxPer) {
    const lim = maxPer || 20;
    const by = {};
    const list = state.decisions || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const r = list[i];
      if (!r || !r.f) continue;
      if (!by[r.f]) by[r.f] = [];
      if (by[r.f].length >= lim) continue;
      by[r.f].push({
        ts: r.ts, a: r.a, k: evidenceMask(r.k), r: r.r, n: r.n,
        d: r.d ? String(r.d).slice(0, 80) : undefined,
      });
    }
    return by;
  }
  function gbEvidence() {
    const now = Date.now();
    const csrf = state.csrf ? String(state.csrf) : '';
    const tplKeys = [
      'claimTpl', 'ibAction', 'ibActionR', 'attackTpl', 'cancelTpl',
      'heroTpl', 'collectTpl', 'farmAction', 'farmOptionMap',
    ];
    const templates = {};
    tplKeys.forEach(k => { templates[k] = evidenceTplShape(state[k]); });
    const breakers = {};
    Object.keys(state.captchaBreakers || {}).forEach(f => {
      const b = state.captchaBreakers[f];
      if (!b) return;
      breakers[f] = {
        trips: b.trips || 0,
        until: b.until || 0,
        leftMs: Math.max(0, (b.until || 0) - now),
        detail: b.detail ? String(b.detail).slice(0, 60) : null,
      };
    });
    const locks = (gbLockList() || []).map(name => ({
      name,
      ageMs: typeof gbLockAge === 'function' ? gbLockAge(name) : null,
      ttlMs: (GB_LOCK_TTL && GB_LOCK_TTL[name]) || 120000,
    }));
    const toggles = {};
    Object.keys(state).forEach(k => {
      if (/^auto[A-Z]/.test(k) || k === 'dryRun' || k === 'ibAuto' || k === 'ibResearch' ||
          k === 'collectAll' || k === 'decisionMemory' || k === 'captchaGlobalKill' ||
          k === 'orchAdaptive' || k === 'farmLongClaims' || k === 'farmSleepAuto') {
        toggles[k] = !!state[k];
      }
    });
    toggles.hostEnabled = !!hostEnabled();
    const last = evidenceLastByFeature(20);
    const lastOk = {};
    const lastSkip = {};
    Object.keys(last).forEach(f => {
      const ok = last[f].find(r => r.r === 'ok');
      const sk = last[f].find(r => String(r.r || '').indexOf('skip:') === 0);
      if (ok) lastOk[f] = ok;
      if (sk) lastSkip[f] = sk;
    });
    return {
      at: new Date(now).toISOString(),
      build: {
        version: runningVersion(),
        host: location.host,
        worldKey: wkey(''),
        configVer: state.configVer,
        exportRedact: state.exportRedact !== false,
      },
      csrf: { present: !!csrf, prefix: csrf ? csrf.slice(0, 6) : null },
      toggles,
      scheduler: typeof orchStatus === 'function' ? orchStatus() : [],
      templates,
      captcha: {
        globalKill: state.captchaGlobalKill !== false,
        globalUntil: captchaGlobalUntil || 0,
        globalLeftMs: Math.max(0, (captchaGlobalUntil || 0) - now),
        breakers,
      },
      deadlock: typeof orchDeadlockState === 'function' ? orchDeadlockState() : null,
      server: {
        paused: typeof gbServerPaused === 'function' ? gbServerPaused() : false,
        leftMs: typeof gbServerCooldownLeftMs === 'function' ? gbServerCooldownLeftMs() : 0,
      },
      locks,
      budget: {
        perMin: state.reqBudgetPerMin || 40,
        usedLastMin: typeof reqBudgetUsed === 'function' ? reqBudgetUsed() : 0,
        byScope: typeof reqBudgetByScope === 'function' ? reqBudgetByScope() : null,
        softDelayMs: typeof reqBudgetSoftDelayMs === 'function' ? reqBudgetSoftDelayMs() : 0,
      },
      lastOk,
      lastSkip,
      recentByFeature: last,
      decisionSkips: (typeof jrnActiveSkips === 'function' ? jrnActiveSkips() : []).map(s => ({
        key: evidenceMask(s.key),
        until: s.until,
        leftMs: Math.max(0, s.until - now),
        trips: s.trips,
        r: s.r,
      })),
      scrapes: {
        nextFarmScrape: state.nextFarmScrape || 0,
        farmDueInMs: state.nextFarmScrape ? Math.max(0, state.nextFarmScrape - now) : null,
        nextTownsScrape: state.nextTownsScrape || 0,
        townsDueInMs: state.nextTownsScrape ? Math.max(0, state.nextTownsScrape - now) : null,
      },
      counts: {
        findings: (state.findings || []).length,
        seen: Object.keys(state.seen || {}).length,
        farms: (state.farmsParsed || []).length,
        towns: (state.towns || []).length,
        decisions: (state.decisions || []).length,
      },
      wake: {
        depth: typeof gbWakeDepth === 'function' ? gbWakeDepth() : 0,
        burst: typeof gbInWakeBurst === 'function' ? gbInWakeBurst() : false,
      },
      tplHealth: (() => {
        const h = state.tplHealth || {};
        const out = {};
        Object.keys(h).forEach(k => {
          const v = h[k] || {};
          out[k] = {
            learnedAt: v.learnedAt || 0,
            lastOkAt: v.lastOkAt || 0,
            hardFails: v.hardFails || 0,
            invalidated: !!v.invalidated,
            ageMs: v.learnedAt ? now - v.learnedAt : null,
          };
        });
        return out;
      })(),
    };
  }
  function gbEvidenceText() {
    try { return JSON.stringify(gbEvidence(), null, 2); }
    catch (e) { return '{"error":' + JSON.stringify(String(e).slice(0, 120)) + '}'; }
  }
  function evidenceCopy() {
    const text = gbEvidenceText();
    const ok = () => {
      flash('evidencia copiada');
      gbLog('evidence: copied ' + text.length + ' chars');
    };
    const fail = () => {
      console.groupCollapsed('[grepbot] evidence');
      console.log(text);
      console.groupEnd();
      flash('evidencia en la consola');
      gbLog('evidence: clipboard fail - expand [grepbot] evidence in console');
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok, fail);
        return;
      }
    } catch (_) {}
    fail();
  }
