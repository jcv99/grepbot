  // ---------- stats + preflight (v1.4.0) ----------
  // Two read-only views over data the bot already produces:
  //   * Stats  - journal rollups (per-feature reliability, skip/error reasons,
  //              scheduler state, budget, locks). Nothing here posts.
  //   * Preflight - probes every module's *read* path and reports whether it
  //              could act at all: is the collection there, is the learned
  //              action key present, would a payload be buildable. This is the
  //              in-game validation checklist (docs/TASKS.md) as one button.
  const STATS_WINDOWS = { '1h': 3600000, '24h': 86400000, '7d': 604800000 };
  let statsWindow = '24h';

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
      detail: state.csrf ? state.csrf.slice(0, 6) + '...' : 'not found (GM_xmlhttpRequest report fetch needs it)',
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
      const cov = typeof ibTownCoverage === 'function' ? ibTownCoverage() : null;
      const armed = typeof ibArmedAt === 'function' ? ibArmedAt() : 0;
      const armTxt = armed ? `next arm in ${fmtSec((armed - Date.now()) / 1000)}` : 'no order counting down';
      return {
        ok: true,
        warn: !!(cov && cov.total && cov.readable < cov.total),
        detail: `${orders.length} orders, ${free} free now, action ${state.ibAction}`
          + (cov ? `, order queues readable ${cov.readable}/${cov.total} towns` : '')
          + `, ${armTxt}`,
      };
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
      const techMap = info && info.techs ? info.techs : null;
      const n = techMap ? Object.keys(techMap).length : 0;
      return { ok: n > 0, detail: n ? n + ' techs readable in first town' : 'academy techs unreadable' };
    }));
    // Affordability guards are only as good as the fields they can read. A
    // blind guard does not block - it lets the server decide - so surfacing
    // which cost tables are readable is the difference between "nothing to do"
    // and "posting things the town cannot pay for".
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
    out.push(preflightProbe('merchant ship', () => {
      const town = typeof ptSalesmanTown === 'function' ? ptSalesmanTown() : null;
      const tpl = !!state.ptTradeTpl;
      const view = !!state.ptViewUrl;
      return {
        ok: true,
        warn: !tpl || !view,
        detail: (town == null ? 'no ship readable' : 'ship in town ' + town)
          + (tpl ? ', trade payload learned' : ', trade payload NOT learned (trade once by hand)')
          + (view ? ', view URL learned' : ', view URL NOT learned (open the window once)'),
      };
    }));
    out.push(preflightProbe('attack', () => ({
      ok: !!state.attackTpl,
      warn: !state.attackTpl,
      detail: state.attackTpl ? 'template learned' : 'template NOT learned (send one attack by hand)',
    })));
    out.push(preflightProbe('cancel', () => {
      let n = 0;
      try { n = militaryOutgoingMovements().length; } catch (_) {}
      return {
        ok: true,
        warn: !state.cancelTpl && n === 0,
        detail: state.cancelTpl
          ? `template learned; ${n} cancelable outgoing`
          : (n ? `${n} cancelable outgoing (hand-cancel once to learn tpl)` : 'no cancelable outgoing; tpl not learned'),
      };
    }));
    out.push(preflightProbe('heroes', () => {
      if (!heroesEnabled()) return { ok: true, warn: true, detail: 'heroes disabled on this world' };
      const list = playerHeroesList();
      const acts = state.heroTpl && typeof state.heroTpl === 'object' ? Object.keys(state.heroTpl) : [];
      return {
        ok: list.length > 0 || acts.length > 0,
        warn: list.length === 0,
        detail: list.length
          ? `${list.length} hero(es); tpl=${acts.join(',') || 'none'}`
          : 'PlayerHero collection empty (open Council once)',
      };
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
    out.push(preflightProbe('guards', () => {
      const locks = gbLockList();
      const paused = Object.keys(state.captchaBreakers || {}).filter(k => captchaPaused(k));
      const parts = [];
      if (state.dryRun) parts.push('DRY-RUN ON (bridge/AJAX + DOM clicks blocked)');
      if (locks.length) parts.push('locks held: ' + locks.join(','));
      if (paused.length) parts.push('captcha: ' + paused.join(','));
      if (gbServerPaused()) parts.push('server cooldown ' + fmtSec(Math.round(gbServerCooldownLeftMs() / 1000)));
      const skips = jrnActiveSkips();
      if (skips.length) parts.push(skips.length + ' memory skip windows');
      try {
        const last = gbRecall();
        if (last) parts.push('last decision: ' + last.f + '/' + (last.r || '?'));
        const recentFails = gbRecallAll().filter(r => r && r.r && r.r !== 'ok' && (Date.now() - r.ts) < 3600000);
        if (recentFails.length) parts.push(recentFails.length + ' hard fails (1h)');
      } catch (_) {}
      return { ok: true, warn: parts.length > 0, detail: parts.length ? parts.join(' | ') : 'clear' };
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
    lines.push(`window ${statsWindow} | ${st.total} decisions | ${st.attempts} attempts | success ${st.successPct == null ? '-' : st.successPct + '%'}`);
    lines.push(`ok ${st.ok}  err ${st.err}  captcha ${st.captcha}  timeout ${st.timeout}  skipped ${st.skip}${st.dry ? ` (dry-run ${st.dry})` : ''}`);
    const claims = jrnCountOk('farm', /claim/i, STATS_WINDOWS[statsWindow] || 86400000);
    const builds = jrnCountOk('build', /Instant|instant/i, STATS_WINDOWS[statsWindow] || 86400000);
    lines.push(`farm claims ${claims} | instant completions ${builds}`);
    lines.push('');
    lines.push('feature      ok   err  cap  skip   rate');
    const feats = Object.keys(st.byFeature).sort();
    if (!feats.length) lines.push('  (no decisions recorded in this window)');
    feats.forEach(f => {
      const v = st.byFeature[f];
      const att = v.ok + v.err + v.captcha + v.timeout;
      lines.push(
        f.padEnd(12).slice(0, 12) +
        String(v.ok).padStart(4) +
        String(v.err).padStart(6) +
        String(v.captcha).padStart(5) +
        String(v.skip).padStart(6) +
        statsPct(v.ok, att).padStart(7));
    });
    if (st.topErrors.length) {
      lines.push('');
      lines.push('top errors');
      st.topErrors.forEach(([k, n]) => lines.push(`  ${n}x ${k}`));
    }
    if (st.topSkips.length) {
      lines.push('');
      lines.push('top skip reasons');
      st.topSkips.forEach(([k, n]) => lines.push(`  ${n}x ${k}`));
    }
    lines.push('');
    lines.push('scheduler (cadence includes adaptive idle backoff)');
    orchStatus().filter(s => s.on).forEach(s => {
      lines.push(`  ${s.key.padEnd(11)} every ${fmtSec(Math.round(s.cadenceMs / 1000)).padEnd(6)} next ${fmtSec(Math.round(s.dueInMs / 1000)).padEnd(6)}${s.idle ? ' idle x' + s.idle : ''}${s.captcha ? ' CAPTCHA' : ''}`);
    });
    const locks = gbLockList();
    lines.push('');
    lines.push(`requests last min ${reqBudgetUsed()}/${state.reqBudgetPerMin || 40}` +
      (gbServerPaused() ? ` | server cooldown ${fmtSec(Math.round(gbServerCooldownLeftMs() / 1000))}` : '') +
      (locks.length ? ` | locks ${locks.join(',')}` : '') +
      (state.dryRun ? ' | DRY-RUN' : ''));
    if (preflightLast) {
      lines.push('');
      lines.push(`preflight (${new Date(preflightLast.at).toLocaleTimeString()})`);
      preflightLast.rows.forEach(r => {
        lines.push(`  ${r.ok ? (r.warn ? '!' : '+') : 'x'} ${r.name}: ${r.detail}`);
      });
    }
    box.textContent = lines.join('\n');
  }

  // ---------- Evidence dump (plan 04) ----------
  // Read-only snapshot for TASKS gates. Never posts. Redacts secrets/ids.
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
      server: {
        paused: typeof gbServerPaused === 'function' ? gbServerPaused() : false,
        leftMs: typeof gbServerCooldownLeftMs === 'function' ? gbServerCooldownLeftMs() : 0,
      },
      locks,
      budget: {
        perMin: state.reqBudgetPerMin || 40,
        usedLastMin: typeof reqBudgetUsed === 'function' ? reqBudgetUsed() : 0,
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
      deadlock: (typeof econDeadlock === 'function') ? (() => {
        const d = econDeadlock();
        return { open: !!d.open, towns: (d.towns || []).map(evidenceMask) };
      })() : null,
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
      flash('evidence copied');
      gbLog('evidence: copied ' + text.length + ' chars');
    };
    const fail = () => {
      console.groupCollapsed('[grepbot] evidence');
      console.log(text);
      console.groupEnd();
      flash('evidence in console');
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
