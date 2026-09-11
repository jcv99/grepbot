  let preflightLast = null;
  const PF_ES = {
    'bridge': 'Puente con el juego',
    'csrf': 'Token de sesión',
    'towns': 'Ciudades',
    'farm claims': 'Cobro de aldeas',
    'farm unit claims': 'Cobro de unidades en aldeas',
    'farm resource scrape': 'Lectura de recursos de aldeas',
    'instant build': 'Terminar construcción gratis',
    'instant research': 'Terminar investigación gratis',
    'cave': 'Cueva',
    'trade': 'Comercio',
    'research': 'Investigación',
    'academy read path': 'Academia',
    'village recruit': 'Reclutar en aldeas',
    'tx registry': 'Registro de transacciones',
    'phoenician': 'Comercio fenicio',
    'gold': 'Intercambio GOLD',
    'native queue': 'Colas del juego',
    'snapshots': 'Instantáneas',
    'profiler': 'Perfilador',
    'memory probe': 'Memoria',
  };
  function renderPreflightBoard(sec) {
    const when = sec.querySelector('#gb-pf-when');
    const list = sec.querySelector('.gb-pf-list');
    if (!list) return;
    if (!preflightLast) {
      if (when) when.textContent = 'Lee todos los módulos sin enviar nada al juego. Todavía no se ha ejecutado.';
      list.replaceChildren();
      return;
    }
    const rows = preflightLast.rows || [];
    const bad = rows.filter(r => !r.ok);
    const warn = rows.filter(r => r.ok && r.warn);
    const okN = rows.length - bad.length - warn.length;
    if (when) {
      when.textContent = `${new Date(preflightLast.at).toLocaleTimeString()} · ${okN} bien`
        + (warn.length ? ` · ${warn.length} aviso(s)` : '')
        + (bad.length ? ` · ${bad.length} fallo(s)` : '');
    }
    const show = bad.concat(warn);
    gbPaint(list, stage => {
      show.forEach(r => {
        const row = document.createElement('div');
        row.className = 'gb-pf-row';
        const ico = typeof gbIcon === 'function' ? gbIcon(r.ok ? 'info' : 'alert', 14, r.ok ? '#ffd27a' : '#ff9aa3') : null;
        if (ico) { ico.style.flex = '0 0 auto'; ico.style.marginTop = '1px'; row.appendChild(ico); }
        const mid = document.createElement('div');
        mid.style.cssText = 'flex:1;min-width:0';
        const t = document.createElement('div');
        t.className = 'gb-pf-t ' + (r.ok ? 'warn' : 'bad');
        t.textContent = PF_ES[r.name] || r.name;
        const d = document.createElement('div');
        d.className = 'gb-pf-s';
        d.textContent = r.detail;
        mid.append(t, d);
        row.appendChild(mid);
        stage.appendChild(row);
      });
      if (!okN) return;
      const sum = document.createElement('div');
      sum.className = 'gb-pf-row';
      const ico = typeof gbIcon === 'function' ? gbIcon('check', 14, '#6dda7e') : null;
      if (ico) { ico.style.flex = '0 0 auto'; ico.style.marginTop = '1px'; sum.appendChild(ico); }
      const st = document.createElement('div');
      st.className = 'gb-pf-t';
      st.textContent = !show.length
        ? (okN === 1 ? 'El único módulo probado lee bien' : `Los ${okN} módulos leen bien`)
        : (okN === 1 ? 'Otro módulo lee bien' : `Otros ${okN} módulos leen bien`);
      sum.appendChild(st);
      stage.appendChild(sum);
    }, { key: show.map(r => r.name + (r.ok ? 'w' : 'x')).join('|') + '#' + okN });
  }
  function preflightRunAndRender() {
    preflightLast = { at: Date.now(), rows: preflightRun() };
    const bad = preflightLast.rows.filter(r => !r.ok).length;
    gbLog(`preflight: ${preflightLast.rows.length - bad}/${preflightLast.rows.length} checks pass`);
    preflightLast.rows.forEach(r => gbLog(`  ${r.ok ? (r.warn ? 'WARN' : 'ok  ') : 'FAIL'} ${r.name}: ${r.detail}`));
    renderStats();
    flash(bad ? `verificación previa: ${bad} fallo(s)` : 'verificación previa: todas las comprobaciones superadas');
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
    const builds = jrnCountOk('build', /Instant|instant/i, STATS_WINDOWS[statsWindow] || 86400000);
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
    try { const g = growthBlock(); if (g.length) { lines.push(...g); lines.push(''); } } catch (_) {}
    try { const p0 = profTopLines(8); if (p0.length) { lines.push(...p0); lines.push(''); } } catch (_) {}
    try { const m0 = memLines(); if (m0.length) { lines.push(...m0); lines.push(''); } } catch (_) {}
    try { lines.push(...favorHudBlock()); } catch (_) {}
    try {
      const bh = (typeof banditAttackHistory !== 'undefined' ? banditAttackHistory : []).slice(-3).reverse();
      if (bh.length) {
        lines.push('');
        lines.push('bandido (ultimos 3 envios)');
        bh.forEach(h => lines.push(`  ${new Date(h.ts).toLocaleTimeString()} ${Object.entries(h.units).map(([u, n]) => u + ':' + n).join(' ') || '-'}`));
      }
    } catch (_) {}
    lines.push('');
    lines.push('planificador (cadencias fijas independientes)');
    orchStatus().filter(s => s.on).forEach(s => {
      lines.push(`  ${s.key.padEnd(11)} cada ${fmtSec(Math.round(s.cadenceMs / 1000)).padEnd(6)} proxima ${fmtSec(Math.round(s.dueInMs / 1000)).padEnd(6)}${s.idle ? ' inact. x' + s.idle : ''}${s.captcha ? ' CAPTCHA' : ''}`);

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
      (byScope ? ` (accion ${byScope.action}/${reqBudgetCap('action')} \u00b7 lectura ${byScope.read}/${reqBudgetCap('read')} \u00b7 escaneo ${byScope.scrape}/${reqBudgetCap('scrape')})` : '') +
      (softMs ? ` | freno suave ${softMs}ms` : '') +
      (gbServerPaused() ? ` | server cooldown ${fmtSec(Math.round(gbServerCooldownLeftMs() / 1000))}` : '') +
      (locks.length ? ` | locks ${locks.join(',')}` : '') +
      (state.dryRun ? ' | DRY-RUN' : ''));
    const budgetSkips = st.topSkips ? (st.topSkips.find(([k]) => /budget/.test(k)) || [null, 0])[1] : 0;
    if (budgetSkips) lines.push(`  ${budgetSkips} accion(es) saltadas por presupuesto en la ventana`);
    if (preflightLast) {
      lines.push('');
      lines.push(`verificación previa (${new Date(preflightLast.at).toLocaleTimeString()})`);
      preflightLast.rows.forEach(r => {
        lines.push(`  ${r.ok ? (r.warn ? '!' : '+') : 'x'} ${r.name}: ${r.detail}`);
      });
    }
    box.textContent = lines.join('\n');
    try { renderPreflightBoard(sec); } catch (_) {}
  }

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
          k === 'farmLongClaims') {
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
    return gbRedact({
      at: new Date(now).toISOString(),
      build: {
        version: runningVersion(),
        host: location.host,
        worldKey: wkey(''),
        configVer: state.configVer,
        exportRedact: state.exportRedact !== false,
      },
      csrf: { present: !!csrf },
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
    }, { maxDepth: 7, maxEntries: 360, maxString: 240 });
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

  const BUNDLE_SECTION_MAX = 60000;
  function bundleClip(text, max) {
    const s = String(text == null ? '' : text);
    const lim = max || BUNDLE_SECTION_MAX;
    if (s.length <= lim) return s;
    return s.slice(0, lim) + '\n... [truncated ' + (s.length - lim) + ' chars]';
  }
  function bundleSection(title, fn, max) {
    let body;
    try {
      const v = fn();
      body = typeof v === 'string' ? v : JSON.stringify(v, null, 2);
    } catch (e) {
      body = '(unavailable: ' + String(e).slice(0, 160) + ')';
    }
    if (body == null || body === '') body = '(empty)';
    return '===== ' + title + ' =====\n' + bundleClip(body, max) + '\n';
  }
  function gbBundleText() {
    const redact = state.exportRedact !== false;
    const head = [
      '===== grepbot bundle =====',
      'at:      ' + new Date().toISOString(),
      'version: ' + runningVersion(),
      'host:    ' + location.host,
      'world:   ' + wkey(''),
      'redact:  ' + (redact ? 'ON (names/ids masked in evidence, config, findings)' : 'OFF'),
      'note:    diagnostics and logs are redacted before export',
      'dryRun:  ' + !!state.dryRun,
      '',
    ].join('\n');
    const parts = [
      head,
      bundleSection('evidence', () => gbEvidence()),
      bundleSection('config', () => (typeof qolExportConfigForUi === 'function' ? qolExportConfigForUi() : '(no export path)')),
      bundleSection('decisions', () => gbRedact({ decisions: state.decisions || [], skips: state.decisionSkips || {} })),
      bundleSection('log', () => gbRedact(gbLogDumpText(0))),
      bundleSection('findings', () => (typeof redactFindingsExport === 'function'
        ? redactFindingsExport({ findings: state.findings, farms: state.farms })
        : '(no redaction path - refusing raw findings)')),
      bundleSection('bridge', () => gameBridgeStatus()),
      bundleSection('preflight', () => (typeof preflightRun === 'function' ? preflightRun() : '(not run)')),
    ];
    return parts.join('\n');
  }
  function bundleCopy() {
    const text = gbBundleText();
    const ok = () => {
      flash('todo copiado (' + Math.round(text.length / 1024) + ' KB)');
      gbLog('bundle: copied ' + text.length + ' chars');
    };
    const fail = () => {
      console.groupCollapsed('[grepbot] bundle');
      console.log(text);
      console.groupEnd();
      flash('paquete en la consola');
      gbLog('bundle: clipboard fail - expand [grepbot] bundle in console');
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok, fail);
        return;
      }
    } catch (_) {}
    fail();
  }

  function bundleDownload() {
    const text = gbBundleText();
    try {
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'grepbot-bundle-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.txt';
      a.click();
      gbTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) {} }, 0);
      flash('paquete descargado');
      gbLog('bundle: downloaded ' + text.length + ' chars');
    } catch (e) {
      gbLog('bundle: download failed ' + String(e).slice(0, 120));
      flash('fallo la descarga');
    }
  }

  const CTX_SCAN_MS = 750;
