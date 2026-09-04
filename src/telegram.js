  function telegramApiUrl(method) {
    const token = String(telegramBotToken || '').trim();
    if (!telegramTokenLooksValid(token) || !/^[A-Za-z][A-Za-z0-9_]*$/.test(String(method || ''))) return null;
    return 'https://api.telegram.org/bot' + token + '/' + method;
  }
  function telegramWorldLabel() {
    const host = String(location && location.hostname || '');
    return host ? host.split('.')[0] : 'Grepolis';
  }
  function telegramCurrentTownLabel() {
    try {
      const uw = gameUw();
      const id = (uw.Game && (uw.Game.townId ?? uw.Game.town_id)) ?? null;
      if (id == null) return '';
      const t = gbTownModel(id);
      const name = t && (typeof t.getName === 'function' ? t.getName() : (t.name || (t.attributes && t.attributes.name)));
      return name ? String(name) + ' (#' + String(id) + ')' : '#' + String(id);
    } catch (_) { return ''; }
  }
  function telegramRequest(method, payload, onDone, opts) {
    const o = opts || {};
    const url = telegramApiUrl(method);
    if (!url) { if (onDone) onDone(false, { reason:'token-invalid' }); return false; }
    const maxRetries = Math.max(0, Math.min(2, Number.isFinite(+o.maxRetries) ? +o.maxRetries : 2));
    let attempt = 0;
    const run = () => {
      attempt++;
      gbXhr({
        scope:'external',
        method:'POST',
        url,
        headers:{ 'Content-Type':'application/json' },
        data:JSON.stringify(payload || {}),
        timeout:15000,
        onload:r => {
          let data = null;
          try { data = JSON.parse((r && r.responseText) || '{}'); } catch (_) {}
          if (r && r.status >= 200 && r.status < 300 && data && data.ok === true) {
            if (onDone) onDone(true, data);
            return;
          }
          let retryMs = 0;
          if (data && data.parameters && Number.isFinite(+data.parameters.retry_after)) retryMs = Math.max(1000, Math.min(30000, +data.parameters.retry_after * 1000));
          const retryable = !!(r && (r.status === 429 || r.status >= 500));
          if (retryable && attempt <= maxRetries) {
            gbTimeout(run, retryMs || Math.min(5000, 750 * attempt));
            return;
          }
          if (onDone) onDone(false, { reason:'http', status:r && r.status, description:data && data.description ? String(data.description).slice(0,120) : '' });
        },
        onerror:() => {
          if (attempt <= maxRetries) { gbTimeout(run, Math.min(5000, 750 * attempt)); return; }
          if (onDone) onDone(false, { reason:'transport' });
        },
        ontimeout:() => {
          if (attempt <= maxRetries) { gbTimeout(run, Math.min(5000, 750 * attempt)); return; }
          if (onDone) onDone(false, { reason:'timeout' });
        },
      });
    };
    run();
    return true;
  }
  function telegramSendText(text, onDone, opts) {
    const o = opts || {};
    if (!o.force && !state.telegramEnabled) { if (onDone) onDone(false, { reason:'disabled' }); return false; }
    const chatId = String(state.telegramChatId || '').trim();
    if (!telegramChatIdLooksValid(chatId)) { if (onDone) onDone(false, { reason:'chat-id-missing' }); return false; }
    return telegramRequest('sendMessage', {
      chat_id:chatId,
      text:String(text || '').slice(0,3900),
      disable_web_page_preview:true,
    }, onDone, { maxRetries:2 });
  }
  function telegramDetectChatId(onDone) {
    if (!telegramTokenLooksValid(telegramBotToken)) { if (onDone) onDone(false, { reason:'token-invalid' }); return false; }
    return telegramRequest('getUpdates', {
      limit:50,
      timeout:0,
      allowed_updates:['message'],
    }, (ok, data) => {
      if (!ok) { if (onDone) onDone(false, data); return; }
      const updates = Array.isArray(data && data.result) ? data.result : [];
      const chats = [];
      for (const u of updates) {
        const msg = u && u.message;
        const c = msg && msg.chat;
        if (!c || c.id == null) continue;
        chats.push({ id:String(c.id), type:String(c.type || ''), updateId:+u.update_id || 0 });
      }
      const priv = chats.filter(c => c.type === 'private');
      const pool = priv.length ? priv : chats;
      const unique = [...new Set(pool.map(c => c.id))];
      if (!unique.length) { if (onDone) onDone(false, { reason:'no-updates' }); return; }
      if (unique.length > 1) { if (onDone) onDone(false, { reason:'ambiguous-chats', ids:unique.slice(0,5) }); return; }
      const id = unique[0];
      state.telegramChatId = id;
      save(STORE.TELEGRAM_CHAT_ID, id);
      if (onDone) onDone(true, { chatId:id });
    }, { maxRetries:1 });
  }
  function telegramCaptchaStateRoot() {
    if (!state.telegramCaptchaState || typeof state.telegramCaptchaState !== 'object' || Array.isArray(state.telegramCaptchaState)) state.telegramCaptchaState = {};
    return state.telegramCaptchaState;
  }
  function telegramCaptchaStillPaused() {
    const now = Date.now();
    if (captchaGlobalUntil && captchaGlobalUntil > now) return true;
    for (const b of Object.values(state.captchaBreakers || {})) if (b && +b.until > now) return true;
    return false;
  }
  function telegramCaptchaPersist() {
    save(STORE.TELEGRAM_CAPTCHA_STATE, telegramCaptchaStateRoot());
  }
  function telegramCaptchaMessage(kind, feature, mins) {
    const town = telegramCurrentTownLabel();
    const where = town ? '\nCiudad activa: ' + town : '';
    if (kind === 'detected') {
      return '🚨 GrepBot — CAPTCHA detectado\n' +
        'Mundo: ' + telegramWorldLabel() + where + '\n' +
        'Modulo: ' + String(feature || 'desconocido') + '\n' +
        (mins ? 'Pausa: ' + String(mins) + ' min\n' : '') +
        'Automatizacion pausada.';
    }
    return '✅ GrepBot — CAPTCHA resuelto\n' +
      'Mundo: ' + telegramWorldLabel() + where + '\n' +
      'Grepolis ha vuelto a responder sin CAPTCHA; automatizacion rearmada.';
  }
  function telegramCaptchaTripNotify(feature, mins) {
    const st = telegramCaptchaStateRoot();
    const now = Date.now();
    if (st.active) {
      st.lastTripAt = now;
      st.lastFeature = String(feature || '');
      telegramCaptchaPersist();
      return false;
    }
    st.active = true;
    st.episodeId = String(now) + ':' + String(feature || 'captcha');
    st.startedAt = now;
    st.lastTripAt = now;
    st.lastFeature = String(feature || '');
    st.detectedSent = false;
    telegramCaptchaPersist();
    if (!state.telegramEnabled || state.telegramCaptcha === false) return true;
    telegramSendText(telegramCaptchaMessage('detected', feature, mins), (ok, info) => {
      const cur = telegramCaptchaStateRoot();
      if (cur.episodeId !== st.episodeId) return;
      cur.detectedSent = !!ok;
      cur.detectedSendAt = ok ? Date.now() : 0;
      cur.lastSendError = ok ? '' : String(info && info.reason || 'send-failed');
      telegramCaptchaPersist();
    });
    return true;
  }
  function telegramCaptchaMaybeResolved(proofFeature) {
    const st = telegramCaptchaStateRoot();
    if (!st.active || !proofFeature || telegramCaptchaStillPaused()) return false;
    const oldEpisode = st.episodeId || '';
    st.active = false;
    st.resolvedAt = Date.now();
    st.resolvedBy = String(proofFeature);
    telegramCaptchaPersist();
    if (!state.telegramEnabled || state.telegramCaptchaResolved === false) return true;
    telegramSendText(telegramCaptchaMessage('resolved', proofFeature, 0), (ok, info) => {
      const cur = telegramCaptchaStateRoot();
      cur.resolvedSent = !!ok;
      cur.resolvedSendAt = ok ? Date.now() : 0;
      cur.lastResolvedEpisode = oldEpisode;
      cur.lastSendError = ok ? '' : String(info && info.reason || 'send-failed');
      telegramCaptchaPersist();
    });
    return true;
  }

  function telegramEventsRoot() {
    const base = { attack:true, hourly:true, critical:true, warehouse:true, diagnostic:true };
    if (!state.telegramEvents || typeof state.telegramEvents !== 'object' || Array.isArray(state.telegramEvents)) state.telegramEvents = {};
    state.telegramEvents = Object.assign(base, state.telegramEvents);
    return state.telegramEvents;
  }
  function telegramEventEnabled(event) {
    const e = telegramEventsRoot();
    return e[String(event)] !== false;
  }
  function telegramMonitorStateRoot() {
    if (!state.telegramMonitorState || typeof state.telegramMonitorState !== 'object' || Array.isArray(state.telegramMonitorState)) state.telegramMonitorState = {};
    const r = state.telegramMonitorState;
    if (!r.attacks || typeof r.attacks !== 'object' || Array.isArray(r.attacks)) r.attacks = {};
    if (!r.warehouses || typeof r.warehouses !== 'object' || Array.isArray(r.warehouses)) r.warehouses = {};
    if (!r.critical || typeof r.critical !== 'object' || Array.isArray(r.critical)) r.critical = {};
    if (!r.sent || typeof r.sent !== 'object' || Array.isArray(r.sent)) r.sent = {};
    return r;
  }
  function telegramMonitorPersist() {
    save(STORE.TELEGRAM_MONITOR_STATE, telegramMonitorStateRoot());
  }
  function telegramTownLabelById(townId) {
    try {
      const t = gbTownModel(townId);
      const name = t && (typeof t.getName === 'function' ? t.getName() : (t.name || (t.attributes && t.attributes.name)));
      return name ? String(name) + ' (#' + String(townId) + ')' : '#' + String(townId);
    } catch (_) { return '#' + String(townId); }
  }
  function telegramCompactNumber(n) {
    if (!Number.isFinite(+n)) return '?';
    const v = +n;
    if (Math.abs(v) >= 1000000) return (v / 1000000).toFixed(v >= 10000000 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (Math.abs(v) >= 1000) return (v / 1000).toFixed(v >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'k';
    return String(Math.round(v));
  }

  // --- Diagnostics / support channel -------------------------------------------------
  // Always-on error history is deliberately bounded and credential-free. "Support mode"
  // only records extra decision context for a short time; it never changes automation.
  function telegramDiagSanitizeText(value, maxLen) {
    let x = String(value == null ? '' : value);
    x = x.replace(/\b\d{5,}:[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_TELEGRAM_TOKEN]');
    x = x.replace(/https?:\/\/api\.telegram\.org\/bot[^/\s]+\//gi, 'https://api.telegram.org/bot[REDACTED]/');
    x = x.replace(/https?:\/\/(?:discord(?:app)?\.com)\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/gi, '[REDACTED_DISCORD_WEBHOOK]');
    x = x.replace(/\b(csrf|authorization|cookie|bot[_ -]?token|access[_ -]?token)\b\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]');
    const lim = Math.max(20, Math.min(24000, Number.isFinite(+maxLen) ? +maxLen : 400));
    return x.slice(0, lim);
  }
  function telegramDiagHash(text) {
    let h = 0x811c9dc5;
    const x = String(text || '');
    for (let i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0').toUpperCase();
  }
  function telegramDiagErrorId(feature, kind, error) {
    const normalized = telegramDiagSanitizeText(error || kind || 'error', 220)
      .replace(/\b\d{4,}\b/g, '#').replace(/\s+/g, ' ').trim().toLowerCase();
    return telegramDiagHash(telegramWorldLabel() + '|' + String(feature || '?') + '|' + String(kind || 'err') + '|' + normalized).slice(0, 8);
  }
  function telegramDiagStateRoot() {
    if (!state.telegramDiagState || typeof state.telegramDiagState !== 'object' || Array.isArray(state.telegramDiagState)) state.telegramDiagState = {};
    const r = state.telegramDiagState;
    if (!Array.isArray(r.events)) r.events = [];
    if (!Array.isArray(r.supportEvents)) r.supportEvents = [];
    if (!r.signatures || typeof r.signatures !== 'object' || Array.isArray(r.signatures)) r.signatures = {};
    if (!r.support || typeof r.support !== 'object' || Array.isArray(r.support)) r.support = {};
    const cut = Date.now() - 48 * 3600000;
    r.events = r.events.filter(e => e && +e.ts >= cut).slice(0, 160);
    r.supportEvents = r.supportEvents.filter(e => e && +e.ts >= cut).slice(0, 240);
    for (const [id, rec] of Object.entries(r.signatures)) if (!rec || (+rec.lastAt || 0) < cut) delete r.signatures[id];
    return r;
  }
  let telegramDiagSaveTimer = 0;
  function telegramDiagPersistSoon() {
    if (telegramDiagSaveTimer) return;
    telegramDiagSaveTimer = gbTimeout(() => { telegramDiagSaveTimer = 0; save(STORE.TELEGRAM_DIAG_STATE, telegramDiagStateRoot()); }, 800);
  }
  function telegramSupportModeActive() {
    const r = telegramDiagStateRoot(), until = +(r.support && r.support.activeUntil) || 0;
    if (until > Date.now()) return true;
    if (until) { r.support.activeUntil = 0; telegramDiagPersistSoon(); }
    return false;
  }
  function telegramSupportModeStart(minutes) {
    const r = telegramDiagStateRoot(), now = Date.now(), mins = Math.max(5, Math.min(120, +minutes || 30));
    r.support = { startedAt:now, activeUntil:now + mins * 60000, minutes:mins };
    r.supportEvents = [];
    telegramDiagPersistSoon();
    return r.support;
  }
  function telegramSupportModeStop() {
    const r = telegramDiagStateRoot();
    if (!r.support || typeof r.support !== 'object') r.support = {};
    r.support.activeUntil = 0; r.support.stoppedAt = Date.now(); telegramDiagPersistSoon();
  }
  function telegramSupportCaptureWhy(feature, action, status, why) {
    if (!telegramSupportModeActive()) return false;
    const r = telegramDiagStateRoot();
    const rec = { ts:Date.now(), type:'decision', feature:String(feature || ''), action:telegramDiagSanitizeText(action,120), status:String(status || ''), why:telegramDiagSanitizeText(why,220) };
    r.supportEvents.unshift(rec); if (r.supportEvents.length > 240) r.supportEvents.length = 240; telegramDiagPersistSoon(); return true;
  }
  function telegramDiagCurrentTownId() {
    try { const uw=gameUw(); const id=(uw.Game && (uw.Game.townId ?? uw.Game.town_id)); return id == null ? null : String(id); } catch (_) { return null; }
  }
  function telegramDiagRecordHealth(feature, kind, meta) {
    if (kind === 'ok') return null;
    const r = telegramDiagStateRoot(), m = meta || {}, now = Date.now();
    const error = telegramDiagSanitizeText(m.error || kind || 'error', 240);
    const id = telegramDiagErrorId(feature, kind, error);
    const rec = { ts:now, type:'health', id, feature:String(feature || '?'), kind:String(kind || 'err'), error };
    if (m.townId != null) rec.townId = String(m.townId); else { const t=telegramDiagCurrentTownId(); if (t) rec.townId=t; }
    if (m.action != null) rec.action = telegramDiagSanitizeText(m.action,120);
    if (m.intent != null) rec.intent = telegramDiagSanitizeText(m.intent,160);
    if (Number.isFinite(+m.latencyMs)) rec.latencyMs = Math.max(0, Math.round(+m.latencyMs));
    try {
      const w = (state.whyLog || []).find(x => x && x.feature === rec.feature && now - (+x.ts || 0) < 10 * 60000);
      if (w) { rec.lastAction = telegramDiagSanitizeText(w.action,120); rec.lastWhy = telegramDiagSanitizeText(w.why,180); rec.lastStatus = String(w.status || ''); }
    } catch (_) {}
    r.events.unshift(rec); if (r.events.length > 160) r.events.length = 160;
    const sig = r.signatures[id] || { firstAt:now, count:0, feature:rec.feature, kind:rec.kind, error:rec.error };
    sig.count = (+sig.count || 0) + 1; sig.lastAt = now; sig.feature = rec.feature; sig.kind = rec.kind; sig.error = rec.error; r.signatures[id] = sig;
    if (telegramSupportModeActive()) { r.supportEvents.unshift(Object.assign({type:'health-context'}, rec)); if (r.supportEvents.length > 240) r.supportEvents.length=240; }
    telegramDiagPersistSoon();
    return { id, count:sig.count, rec };
  }
  function telegramRecentErrorGroups(windowMs) {
    const r = telegramDiagStateRoot(), cut = Date.now() - Math.max(60000, +windowMs || 3600000), groups = {};
    for (const e of r.events) {
      if (!e || +e.ts < cut || !['err','timeout'].includes(String(e.kind))) continue;
      const f = String(e.feature || '?');
      const g = groups[f] || (groups[f] = { feature:f, count:0, lastAt:0, lastId:'', lastError:'' });
      g.count++; if (+e.ts >= g.lastAt) { g.lastAt=+e.ts; g.lastId=String(e.id || ''); g.lastError=String(e.error || ''); }
    }
    return Object.values(groups).sort((a,b)=>b.count-a.count || b.lastAt-a.lastAt);
  }
  // 6.0.9 migration: 6.0.8 could leave normal scheduler waits in persisted
  // recruit/farm health as real errors. Purge those historical false positives so
  // upgrading does not immediately resend a stale critical diagnostic.
  (function telegramExpectedWaitHealthMigration609() {
    const key = wkey('grepbot:mig:6.0.9:expected-waits-health');
    if (load(key, false)) return;
    let changedHealth=false, changedDiag=false;
    try {
      for (const [feature,h] of Object.entries(moduleHealth || {})) {
        if (!h || !h.lastError) continue;
        const wait=gbExpectedServerReject(feature,h.lastError);
        if (!wait) continue;
        h.consecutiveErr=0;
        h.lastSkip=Date.now(); h.lastSkipKind=wait; h.lastSkipReason=String(h.lastError).slice(0,160);
        h.lastErrorKind=''; h.lastError=''; h.lastErrorId=''; h.lastErr=0;
        changedHealth=true;
      }
      if (changedHealth) { state.health=moduleHealth; save(STORE.HEALTH,moduleHealth); }
    } catch (_) {}
    try {
      const r=telegramDiagStateRoot();
      const keep=e => !(e && gbExpectedServerReject(e.feature,e.error));
      const before=r.events.length;
      r.events=r.events.filter(keep);
      r.supportEvents=r.supportEvents.filter(e => !(e && (e.type==='health'||e.type==='health-context') && gbExpectedServerReject(e.feature,e.error)));
      if (r.events.length !== before) changedDiag=true;
      if (changedDiag) {
        const sig={};
        for (const e of r.events) {
          if (!e || !e.id) continue;
          const rec=sig[e.id] || { firstAt:+e.ts||Date.now(), count:0, feature:e.feature, kind:e.kind, error:e.error };
          rec.count++; rec.firstAt=Math.min(+rec.firstAt||+e.ts,+e.ts||Date.now()); rec.lastAt=Math.max(+rec.lastAt||0,+e.ts||0);
          rec.feature=e.feature; rec.kind=e.kind; rec.error=e.error; sig[e.id]=rec;
        }
        r.signatures=sig; save(STORE.TELEGRAM_DIAG_STATE,r);
      }
      const mon=telegramMonitorStateRoot();
      for (const k of Object.keys(mon.critical||{})) if (/module:(recruit|farm):/i.test(k)) delete mon.critical[k];
      telegramMonitorPersist();
    } catch (_) {}
    save(key,true);
  })();

  function telegramFmtClock(ts) {
    if (!(+ts > 0)) return '?';
    try { return new Date(+ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'}); } catch (_) { return new Date(+ts).toISOString(); }
  }
  function telegramCriticalDetailedMessage(pending) {
    const lines = ['🛠️ GrepBot · diagnostico', 'Version: ' + GB_RELEASE, 'Mundo: ' + telegramWorldLabel(), 'Hora: ' + telegramFmtClock(Date.now())];
    const root = telegramDiagStateRoot();
    for (const x of (pending || []).slice(0,6)) {
      const row = x.row || x;
      lines.push('');
      if (row.type === 'module') {
        const h = moduleHealth[row.feature] || {};
        const id = row.errorId || h.lastErrorId || telegramDiagErrorId(row.feature,'err',h.lastError || 'error');
        const sig = root.signatures[id] || {};
        lines.push('❌ ' + row.feature + ' · ID ' + id + (sig.count ? ' · x' + sig.count : ''));
        lines.push('Errores consecutivos: ' + (+h.consecutiveErr || 0));
        lines.push('Ultimo error: ' + telegramFmtClock(h.lastErr) + ' · ' + telegramDiagSanitizeText(h.lastError || 'sin detalle',180));
        lines.push('Ultimo OK: ' + telegramFmtClock(h.lastOk));
        const ev = root.events.find(e => e && e.id === id);
        if (ev && ev.townId) lines.push('Ciudad: ' + telegramTownLabelById(ev.townId));
        if (ev && (ev.action || ev.lastAction)) lines.push('Accion: ' + telegramDiagSanitizeText(ev.action || ev.lastAction,120));
        if (ev && ev.lastWhy) lines.push('Contexto: ' + telegramDiagSanitizeText(ev.lastWhy,160));
      } else if (row.type === 'tx') {
        const tx = row.tx || {};
        lines.push('⚠️ tx ' + String(tx.state || '?') + ' · ID ' + row.errorId);
        lines.push('Modulo: ' + String(tx.feature || '?') + ' · accion: ' + telegramDiagSanitizeText(tx.endpoint || row.intent || '?',120));
        if (tx.meta && tx.meta.townId != null) lines.push('Ciudad: ' + telegramTownLabelById(tx.meta.townId));
        lines.push('Motivo: ' + telegramDiagSanitizeText(tx.detail || 'resultado desconocido',180));
      } else if (row.type === 'circuit') {
        const c = row.circuit || {};
        lines.push('🚨 circuit breaker ' + row.feature + ' · ID ' + row.errorId);
        lines.push('Motivo: ' + telegramDiagSanitizeText(c.lastError || 'sin detalle',180));
      } else lines.push('• ' + telegramDiagSanitizeText(row.label || 'incidencia',240));
    }
    if ((pending || []).length > 6) lines.push('', '+' + ((pending || []).length - 6) + ' incidencia(s) mas');
    lines.push('', 'Puedes copiar este mensaje y mandarselo a ChatGPT.');
    return lines.join('\n');
  }
  function telegramBuildSupportReport() {
    const now = Date.now(), r = telegramDiagStateRoot(), recent = telegramRecentErrorGroups(3600000);
    const lines = ['GREPBOT SUPPORT REPORT', 'Version: ' + GB_RELEASE, 'World: ' + telegramWorldLabel(), 'Generated: ' + new Date(now).toISOString(), 'Current town: ' + (telegramCurrentTownLabel() || '?')];
    const support = r.support || {};
    lines.push('Support mode: ' + (telegramSupportModeActive() ? 'ACTIVE until ' + new Date(+support.activeUntil).toISOString() : 'OFF'));
    lines.push('', 'RECENT ERRORS (60m)');
    if (!recent.length) lines.push('- none');
    for (const g of recent.slice(0,12)) {
      const h=moduleHealth[g.feature]||{};
      lines.push('- ' + g.feature + ': x' + g.count + ' · ID ' + (g.lastId || '?') + ' · consecutive=' + (+h.consecutiveErr||0) + ' · last=' + telegramFmtClock(g.lastAt) + ' · ' + telegramDiagSanitizeText(g.lastError,220));
    }
    lines.push('', 'TELEGRAM MONITOR');
    try {
      const tm = telegramMonitorStateRoot();
      lines.push('- hourly enabled=' + (telegramEventEnabled('hourly') ? 'yes' : 'no') + ' · last success=' + (tm.lastDigestSentAt ? new Date(+tm.lastDigestSentAt).toISOString() : 'never') + ' · last error=' + telegramDiagSanitizeText(tm.lastDigestError || 'none',120));
      lines.push('- attack enabled=' + (telegramEventEnabled('attack') ? 'yes' : 'no') + ' · scanner=' + (tm.attackScanKnown === true ? 'readable' : (tm.attackScanKnown === false ? 'UNREADABLE' : 'unknown')) + (tm.attackScanWhy ? ' · ' + telegramDiagSanitizeText(tm.attackScanWhy,120) : '') + (tm.attackScanAt ? ' · checked=' + new Date(+tm.attackScanAt).toISOString() : ''));
    } catch (_) { lines.push('- unreadable'); }
    lines.push('', 'TRANSACTIONS REQUIRING REVIEW');
    const txs = Object.entries(state.txState || {}).filter(([,t]) => t && /^(unknown|manual-review)$/.test(String(t.state || ''))).slice(0,20);
    if (!txs.length) lines.push('- none');
    for (const [intent,t] of txs) lines.push('- ' + String(t.feature||'?') + ' · ' + String(t.state||'?') + ' · town=' + String(t.meta&&t.meta.townId!=null?t.meta.townId:'?') + ' · action=' + telegramDiagSanitizeText(t.endpoint||intent,120) + ' · ' + telegramDiagSanitizeText(t.detail||'',180));
    lines.push('', 'RECENT ERROR EVENTS');
    if (!r.events.length) lines.push('- none');
    for (const e of r.events.slice(0,30)) lines.push('- ' + new Date(+e.ts||0).toISOString() + ' · ' + String(e.feature||'?') + '/' + String(e.kind||'?') + ' · ID ' + String(e.id||'?') + (e.townId?' · town='+e.townId:'') + (e.action?' · action='+telegramDiagSanitizeText(e.action,90):'') + ' · ' + telegramDiagSanitizeText(e.error||e.lastWhy||'',200));
    lines.push('', 'SUPPORT TRACE');
    const trace = r.supportEvents || [];
    if (!trace.length) lines.push('- no support trace (activate Support mode for extra context)');
    for (const e of trace.slice(0,60)) lines.push('- ' + new Date(+e.ts||0).toISOString() + ' · ' + String(e.feature||'?') + ' · ' + String(e.status||e.kind||e.type||'?') + (e.action?' · '+telegramDiagSanitizeText(e.action,100):'') + (e.why?' · '+telegramDiagSanitizeText(e.why,180):'') + (e.error?' · '+telegramDiagSanitizeText(e.error,180):''));
    lines.push('', 'CURRENT WAREHOUSE PRESSURE');
    try {
      const threshold=telegramWarehouseThresholdPct()/100, rows=[];
      for(const t of tradeListTowns()) for(const k of GB_RES_KEYS) if(t&&t.cap>0&&t[k]!=null&&+t[k]/+t.cap>=threshold) rows.push({t,k,fill:+t[k]/+t.cap});
      if(!rows.length) lines.push('- none');
      for(const x of rows.slice(0,12)){const d=telegramWarehouseDiagnostic(x.t,x.k);lines.push('- '+telegramTownLabelById(x.t.id)+' · '+x.k+' '+(x.fill*100).toFixed(1)+'% · merchants='+(d.tradeCap==null?'?':Math.round(d.tradeCap))+' · '+telegramDiagSanitizeText(d.reason,180));}
    } catch (_) { lines.push('- unreadable'); }
    lines.push('', 'LATEST DECISION CONTEXT');
    const recentFeatures=new Set(recent.map(g=>g.feature));
    const whyRows=(state.whyLog||[]).filter(x=>x&&(!recentFeatures.size||recentFeatures.has(String(x.feature||'')))).slice(0,30);
    if(!whyRows.length) lines.push('- none');
    for(const x of whyRows) lines.push('- '+new Date(+x.ts||0).toISOString()+' · '+String(x.feature||'?')+' · '+String(x.status||'?')+' · '+telegramDiagSanitizeText(x.action||'',100)+(x.why?' · '+telegramDiagSanitizeText(x.why,180):''));
    lines.push('', 'NOTE: credentials/tokens are intentionally excluded and sanitized.');
    return telegramDiagSanitizeText(lines.join('\n'), 24000);
  }
  function telegramCopySupportReport(onDone) {
    const text = telegramBuildSupportReport();
    const fallback = () => {
      try { const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.focus(); ta.select(); const ok=document.execCommand('copy'); ta.remove(); if(onDone)onDone(!!ok); return !!ok; } catch (_) { if(onDone)onDone(false); return false; }
    };
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).then(()=>{if(onDone)onDone(true)}).catch(fallback); return true;
      }
    } catch (_) {}
    return fallback();
  }
  function telegramNotify(event, text, opts) {
    const o = opts || {};
    if (!state.telegramEnabled || (!o.force && !telegramEventEnabled(event))) {
      if (o.onDone) o.onDone(false, { reason:'disabled' });
      return false;
    }
    const key = o.key ? String(event) + '|' + String(o.key) : '';
    const now = Date.now();
    const root = telegramMonitorStateRoot();
    if (key && !o.force) {
      const prev = +root.sent[key] || 0;
      const cooldown = Math.max(0, Number.isFinite(+o.cooldownMs) ? +o.cooldownMs : 0);
      if (prev && (!cooldown || now - prev < cooldown)) {
        if (o.onDone) o.onDone(false, { reason:'dedup' });
        return false;
      }
    }
    return telegramSendText(text, (ok, info) => {
      if (ok && key) {
        root.sent[key] = Date.now();
        // Bounded dedup memory. Old event keys do not need to live forever.
        const cut = Date.now() - 14 * 86400000;
        for (const [k, ts] of Object.entries(root.sent)) if (+ts < cut) delete root.sent[k];
        telegramMonitorPersist();
      }
      if (o.onDone) o.onDone(ok, info);
    }, { force:true });
  }
  function telegramMovementKey(m) {
    if (m && m.id != null && String(m.id) !== '') return 'id:' + String(m.id);
    return ['mv', m && m.dest, m && m.origin, m && m.arrival, m && m.type].map(x => String(x == null ? '' : x)).join('|');
  }
  function telegramMovementOriginLabel(m) {
    const a = m && m.model && (m.model.attributes || m.model) || {};
    const town = a.origin_town_name || a.origin_name || a.source_town_name || '';
    const player = a.origin_player_name || a.attacker_name || a.player_name || a.source_player_name || '';
    if (town && player) return String(town) + ' · ' + String(player);
    if (town) return String(town);
    if (player) return String(player);
    return m && m.origin ? '#' + String(m.origin) : 'origen desconocido';
  }
  function telegramMovementEtaText(m) {
    let eta = null;
    try { eta = dodgeEtaSec(m); } catch (_) {}
    if (eta == null || !Number.isFinite(+eta)) return 'ETA ?';
    eta = Math.max(0, +eta);
    if (eta < 60) return 'ETA ' + Math.ceil(eta) + 's';
    if (eta < 3600) return 'ETA ' + Math.ceil(eta / 60) + 'm';
    return 'ETA ' + Math.floor(eta / 3600) + 'h ' + Math.ceil((eta % 3600) / 60) + 'm';
  }
  function telegramAttackMessage(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const csN = list.filter(m => m && m.hasCs).length;
    const title = (csN ? '🛑' : '🚨') + ' GrepBot — ' + list.length + ' ataque' + (list.length === 1 ? '' : 's') + ' entrante' + (list.length === 1 ? '' : 's');
    const lines = [title, 'Mundo: ' + telegramWorldLabel()];
    for (const m of list.slice(0, 12)) {
      const type = String(m.type || 'ataque').replace(/_/g, ' ');
      lines.push('• ' + telegramTownLabelById(m.dest) + ' · ' + telegramMovementEtaText(m) + ' · ' + telegramMovementOriginLabel(m) + ' · ' + type + (m.hasCs ? ' · ⚠️ CS/conquista' : ''));
    }
    if (list.length > 12) lines.push('• +' + (list.length - 12) + ' ataque(s) mas');
    return lines.join('\n');
  }
  function telegramAttackMonitor(incomingOverride) {
    const root = telegramMonitorStateRoot(), now = Date.now();
    let snap;
    try {
      if (Array.isArray(incomingOverride)) snap = { known:true, moves:incomingOverride, why:'override', rawCount:incomingOverride.length };
      else snap = dodgeIncomingSnapshot();
    } catch (_) { snap = { known:false, moves:[], why:'scan-exception', rawCount:0 }; }
    if (!snap || snap.known !== true) {
      root.attackScanKnown = false;
      root.attackScanWhy = String(snap && snap.why || 'unreadable').slice(0,80);
      root.attackScanAt = now;
      // Crucial: an unreadable movement model is NOT the same thing as zero
      // incoming attacks. Keep the existing dedup entries intact and retry later.
      telegramMonitorPersist();
      return false;
    }
    root.attackScanKnown = true;
    root.attackScanWhy = '';
    root.attackScanAt = now;
    root.attackScanRawCount = +snap.rawCount || 0;
    const incoming = Array.isArray(snap.moves) ? snap.moves : [];
    const live = new Map();
    for (const m of incoming) live.set(telegramMovementKey(m), m);
    let changed = false;
    const pending = [];
    for (const [key, m] of live.entries()) {
      let rec = root.attacks[key];
      if (!rec || typeof rec !== 'object') {
        rec = root.attacks[key] = { firstSeen:now, lastSeen:now, sent:false, lastAttemptAt:0 };
        changed = true;
      } else rec.lastSeen = now;
      if (!rec.sent && (!rec.lastAttemptAt || now - +rec.lastAttemptAt >= 2 * 60000)) pending.push({ key, m, rec });
    }
    for (const [key, rec] of Object.entries(root.attacks)) {
      if (live.has(key)) continue;
      if (!rec || now - (+rec.lastSeen || +rec.firstSeen || 0) > 6 * 3600000) { delete root.attacks[key]; changed = true; }
    }
    if (changed) telegramMonitorPersist();
    if (!pending.length || !state.telegramEnabled || !telegramEventEnabled('attack')) { telegramMonitorPersist(); return pending.length > 0; }
    const rows = pending.map(x => x.m);
    for (const x of pending) x.rec.lastAttemptAt = now;
    telegramMonitorPersist();
    telegramNotify('attack', telegramAttackMessage(rows), { force:true, onDone:(ok, info) => {
      const r = telegramMonitorStateRoot();
      for (const x of pending) {
        const rec = r.attacks[x.key];
        if (!rec) continue;
        if (ok) { rec.sent = true; rec.sentAt = Date.now(); rec.lastError = ''; }
        else rec.lastError = String(info && info.reason || 'send-failed');
      }
      telegramMonitorPersist();
    }});
    return true;
  }
  function telegramWarehouseThresholdPct() {
    const n = Number(state.telegramWarehousePct);
    return Math.max(90, Math.min(100, Number.isFinite(n) ? n : 95));
  }
  function telegramWarehouseDelayMs() {
    const n = Number(state.telegramWarehouseMin);
    return Math.max(1, Math.min(180, Number.isFinite(n) ? n : 15)) * 60000;
  }
  function telegramWarehouseDiagnostic(town, resource) {
    const d = { reason:'sin salida automatica ejecutable', townId:town&&String(town.id), resource:String(resource||''), amount:null, cap:null, fill:null, tradeCap:null, rural:{known:false,count:0,best:null}, intercity:{known:false,checked:0,eligible:0,best:null} };
    if (!town || !GB_RES_KEYS.includes(resource)) { d.reason='estado de ciudad ilegible'; return d; }
    d.amount = town[resource] != null && Number.isFinite(+town[resource]) ? +town[resource] : null; d.cap=town.cap!=null&&Number.isFinite(+town.cap)?+town.cap:null; d.fill=d.amount!=null&&d.cap>0?d.amount/d.cap:null; d.tradeCap=town.tradeCap!=null&&Number.isFinite(+town.tradeCap)?+town.tradeCap:null;
    if (d.fill == null) { d.reason='nivel de almacen ilegible'; return d; }
    if (town.tradeCap == null) { d.reason='capacidad mercante ilegible'; return d; }
    if (!(town.tradeCap > 0)) { d.reason='sin capacidad mercante libre'; return d; }
    if (!tradeTownEnabled(town.id)) { d.reason='ciudad excluida del comercio automatico'; return d; }
    if (!state.autoTrade && !state.autoRuralTrade) { d.reason='comercio automatico desactivado'; return d; }
    try {
      if (state.autoRuralTrade) {
        const auto = tradeAutoTowns(tradeListTowns());
        const candidates = ruralExecutableOverflowCandidates(auto).filter(c => String(c.townId) === String(town.id) && c.give === resource);
        d.rural.known=true; d.rural.count=candidates.length;
        if (candidates.length) { const best=ruralTradeDecision(candidates)||candidates[0]; d.rural.best={ farmId:best.farmId||best.village, receive:best.receive, ratio:best.ratio, amount:best.amount }; d.reason='hay comercio rural ejecutable pero el recurso sigue alto'; }
      }
    } catch (_) { d.rural.known=false; }
    if (state.autoTrade) {
      const overflowAt = tradeOverflowPct();
      if (d.fill != null && d.fill < overflowAt && !d.rural.best) {
        const pct = Math.round(overflowAt * 10000) / 100;
        d.reason = 'esperando umbral autoTrade ' + pct + '%';
        return d;
      }
      const incoming = tradeIncomingByTown();
      if (!incoming.known) { d.reason='comercios entrantes ilegibles'; return d; }
      const attacks = tradeTownsUnderAttack();
      if (!attacks.known) { d.reason='ataques entrantes ilegibles'; return d; }
      d.intercity.known=true; d.intercity.underAttack=0;
      const rows = tradeAutoTowns(tradeListTowns()).filter(t => String(t.id) !== String(town.id));
      const ranked=[];
      for (const t of rows) {
        d.intercity.checked++;
        const id=String(t.id);
        if (attacks.value && attacks.value.has(id)) { d.intercity.underAttack++; continue; }
        const mov = incoming.byTown[id] || {};
        let pending={};
        try { pending=plannerPendingForTown(id).incoming||{}; } catch (_) { d.reason='reservas entrantes del planificador ilegibles'; d.intercity.known=false; return d; }
        if (t[resource] == null || !(t.cap > 0)) continue;
        const resVal = gbNum(t[resource]);
        const capVal = gbNum(t.cap);
        const movVal = gbNum(mov[resource]);
        const pendVal = gbNum(pending[resource]);
        if (resVal == null || capVal == null || !(capVal > 0)) continue;
        const projected = resVal + (movVal != null ? movVal : 0) + (pendVal != null ? pendVal : 0);
        const fill = projected / capVal;
        const free = Math.max(0, capVal - projected);
        ranked.push({ id, fill, free, projected, cap: capVal });
        if (fill <= tradeReceiverPct()) d.intercity.eligible++;
      }
      ranked.sort((a,b)=>a.fill-b.fill || b.free-a.free || a.id.localeCompare(b.id,undefined,{numeric:true}));
      if (ranked.length) d.intercity.best=ranked[0];
      if (!d.intercity.eligible) d.reason='sin ciudad receptora <= ' + Math.round(tradeReceiverPct()*100) + '%';
      else if (!d.rural.best) d.reason='hay receptor disponible pero el overflow persiste';
    }
    return d;
  }
  function telegramWarehouseReason(town, resource) { return telegramWarehouseDiagnostic(town, resource).reason; }
  function telegramWarehouseDiagnosticLines(a) {
    const d=a.diag||telegramWarehouseDiagnostic(a.town,a.resource), lines=[];
    const id=telegramDiagErrorId('warehouse', a.resource, String(a.town&&a.town.id)+'|'+d.reason);
    const amt=d.amount==null?'?':Math.round(d.amount), cap=d.cap==null?'?':Math.round(d.cap), pct=d.fill==null?'?':(d.fill*100).toFixed(1)+'%';
    lines.push('• ' + telegramTownLabelById(a.town.id) + ' · ' + a.resource + ' ' + amt + '/' + cap + ' (' + pct + ') · ID ' + id);
    lines.push('  Mercantes: ' + (d.tradeCap==null?'?':Math.round(d.tradeCap)) + ' · Rural: ' + (d.rural.known ? (d.rural.count + ' ejecutable(s)' + (d.rural.best?' · mejor ratio '+d.rural.best.ratio+' amt '+d.rural.best.amount:'')) : '?'));
    if (d.intercity.known) {
      const best=d.intercity.best;
      lines.push('  Ciudad→ciudad: ' + d.intercity.checked + ' analizada(s) · ' + d.intercity.eligible + ' elegible(s)' + (d.intercity.underAttack ? ' · ' + d.intercity.underAttack + ' bajo ataque' : '') + (best ? ' · mejor ' + telegramTownLabelById(best.id) + ' ' + (best.fill*100).toFixed(1) + '%' : ''));
    } else lines.push('  Ciudad→ciudad: ?');
    lines.push('  Motivo final: ' + d.reason);
    return lines;
  }
  function telegramWarehouseMonitor() {
    const root = telegramMonitorStateRoot(), now = Date.now(), threshold = telegramWarehouseThresholdPct() / 100, delay = telegramWarehouseDelayMs();
    let towns = [];
    try { towns = tradeListTowns(); } catch (_) { return false; }
    const liveKeys = new Set();
    const alerts = [];
    for (const t of towns) {
      if (!t || !(t.cap > 0)) continue;
      for (const resource of GB_RES_KEYS) {
        if (t[resource] == null) continue;
        const stock = gbNum(t[resource]), cap = gbNum(t.cap);
        if (stock == null || cap == null || !(cap > 0)) continue;
        const fill = stock / cap;
        const key = String(t.id) + '|' + resource;
        if (fill < threshold) { if (root.warehouses[key]) { delete root.warehouses[key]; } continue; }
        liveKeys.add(key);
        let rec = root.warehouses[key];
        if (!rec || typeof rec !== 'object') rec = root.warehouses[key] = { since:now, sent:false, lastAmount:+t[resource], lastFill:fill };
        rec.lastSeen = now; rec.lastAmount = +t[resource]; rec.lastFill = fill;
        if (!rec.sent && now - (+rec.since || now) >= delay && (!rec.lastAttemptAt || now - +rec.lastAttemptAt >= 10 * 60000)) {
          const diag=telegramWarehouseDiagnostic(t,resource); alerts.push({ key, town:t, resource, fill, rec, reason:diag.reason, diag });
        }
      }
    }
    for (const key of Object.keys(root.warehouses)) if (!liveKeys.has(key)) delete root.warehouses[key];
    telegramMonitorPersist();
    if (!alerts.length || !state.telegramEnabled || !telegramEventEnabled('warehouse')) return alerts.length > 0;
    const lines = ['⚠️ GrepBot — almacen atascado', 'Mundo: ' + telegramWorldLabel()];
    for (const a of alerts.slice(0, 4)) { lines.push(...telegramWarehouseDiagnosticLines(a)); a.rec.lastAttemptAt = now; }
    if (alerts.length > 4) lines.push('• +' + (alerts.length - 4) + ' recurso(s) mas');
    telegramMonitorPersist();
    telegramNotify('warehouse', lines.join('\n'), { force:true, onDone:(ok, info) => {
      const r = telegramMonitorStateRoot();
      for (const a of alerts) {
        const rec = r.warehouses[a.key]; if (!rec) continue;
        if (ok) { rec.sent = true; rec.sentAt = Date.now(); rec.lastError = ''; }
        else rec.lastError = String(info && info.reason || 'send-failed');
      }
      telegramMonitorPersist();
    }});
    return true;
  }
  function telegramCriticalCandidates() {
    const now = Date.now(), out = [], diag=telegramDiagStateRoot();
    for (const [name, h] of Object.entries(moduleHealth || {})) {
      if (!h || h.lastErrorKind === 'captcha' || !(+h.consecutiveErr >= 3) || !h.lastError || !(+h.lastErr > 0) || now - +h.lastErr > 30 * 60000) continue;
      const errorId=h.lastErrorId||telegramDiagErrorId(name,'err',h.lastError||'error');
      const sig=diag.signatures[errorId]||{};
      out.push({ key:'module:' + name + ':' + errorId, type:'module', feature:name, errorId, health:h, label:'Modulo ' + name + ': ' + (+h.consecutiveErr) + ' errores consecutivos · ID ' + errorId + (sig.count?' · x'+sig.count:'') + ' · ' + String(h.lastError).slice(0,100) });
    }
    for (const [name, c] of Object.entries(state.circuits || {})) {
      if (c && c.open) { const errorId=telegramDiagErrorId(name,'circuit',c.lastError||'open'); out.push({ key:'circuit:' + name + ':' + errorId, type:'circuit', feature:name, errorId, circuit:c, label:'Circuit breaker abierto: ' + name + ' · ID ' + errorId + (c.lastError ? ' · ' + String(c.lastError).slice(0,100) : '') }); }
    }
    for (const [intent, tx] of Object.entries(state.txState || {})) {
      if (!tx || !/^(unknown|manual-review)$/.test(String(tx.state || ''))) continue;
      const at = +tx.updatedAt || +tx.unknownAt || +tx.createdAt || 0;
      if (!at || now - at > 30 * 60000) continue;
      const errorId=telegramDiagErrorId(tx.feature||'tx',tx.state,tx.detail||intent);
      out.push({ key:'tx:' + errorId + ':' + String(intent).slice(0,80), type:'tx', feature:String(tx.feature||'tx'), intent, tx, errorId, label:'Transaccion ' + tx.state + ': ' + String(tx.feature || intent).slice(0,80) + ' · ID ' + errorId + (tx.detail ? ' · ' + String(tx.detail).slice(0,100) : '') });
    }
    return out;
  }
  function telegramCriticalMonitor() {
    const root = telegramMonitorStateRoot(), now = Date.now(), rows = telegramCriticalCandidates();
    const active = new Set(rows.map(x => x.key));
    for (const key of Object.keys(root.critical)) if (!active.has(key)) delete root.critical[key];
    const pending = [];
    for (const row of rows) {
      let rec = root.critical[row.key];
      if (!rec || typeof rec !== 'object') rec = root.critical[row.key] = { firstSeen:now, sent:false, lastAttemptAt:0 };
      rec.lastSeen = now;
      if (!rec.sent && (!rec.lastAttemptAt || now - +rec.lastAttemptAt >= 15 * 60000)) pending.push({ row, rec });
    }
    telegramMonitorPersist();
    if (!pending.length || !state.telegramEnabled || !telegramEventEnabled('critical')) return pending.length > 0;
    let text;
    if (telegramEventEnabled('diagnostic')) text=telegramCriticalDetailedMessage(pending);
    else {
      const lines = ['🚨 GrepBot — necesita atencion', 'Mundo: ' + telegramWorldLabel()];
      for (const x of pending.slice(0, 8)) lines.push('• ' + x.row.label);
      if (pending.length > 8) lines.push('• +' + (pending.length - 8) + ' incidencia(s) mas');
      text=lines.join('\n');
    }
    for (const x of pending) x.rec.lastAttemptAt = now;
    telegramMonitorPersist();
    telegramNotify('critical', text, { force:true, onDone:(ok, info) => {
      const r = telegramMonitorStateRoot();
      for (const x of pending) {
        const rec = r.critical[x.row.key]; if (!rec) continue;
        if (ok) { rec.sent = true; rec.sentAt = Date.now(); rec.lastError = ''; }
        else rec.lastError = String(info && info.reason || 'send-failed');
      }
      telegramMonitorPersist();
    }});
    return true;
  }
  function telegramHourKey(d) {
    const x = d || new Date();
    const z = n => String(n).padStart(2, '0');
    return x.getFullYear() + '-' + z(x.getMonth() + 1) + '-' + z(x.getDate()) + 'T' + z(x.getHours());
  }
  function telegramSummaryTownIds() {
    const out = [], seen = new Set();
    const add = id => { const s=String(id==null?'':id); if (s && !seen.has(s)) { seen.add(s); out.push(s); } };
    try { (caveListTownIds() || []).forEach(add); } catch (_) {}
    try { (state.towns || []).forEach(t => t && t.id != null && add(t.id)); } catch (_) {}
    try { Object.keys((gameUw().ITowns && gameUw().ITowns.towns) || {}).forEach(add); } catch (_) {}
    try { Object.keys((nativeQueueRoot().towns) || {}).forEach(add); } catch (_) {}
    try { const uw=gameUw(); add(uw.Game && (uw.Game.townId ?? uw.Game.town_id)); } catch (_) {}
    return out;
  }
  function telegramSummaryTownRes(townId) {
    try { const live=tradeTownRes(townId); if (live) return live; } catch (_) {}
    try {
      const live=townResState(townId);
      if (live) return { id:+townId, wood:live.wood, stone:live.stone, iron:live.iron, cap:live.cap };
    } catch (_) {}
    try {
      const r=(state.townResources||{})[townId] || (state.townResources||{})[String(townId)];
      if (r && r.ok !== false) return {
        id:+townId,
        wood:Number.isFinite(+r.wood)?+r.wood:null,
        stone:Number.isFinite(+r.stone)?+r.stone:null,
        iron:Number.isFinite(+r.iron)?+r.iron:null,
        cap:Number.isFinite(+r.cap)&&+r.cap>0?+r.cap:null,
      };
    } catch (_) {}
    return { id:+townId, wood:null, stone:null, iron:null, cap:null };
  }
  function telegramBuildHourlyDigest() {
    const townIds = telegramSummaryTownIds();
    const towns = townIds.map(telegramSummaryTownRes);
    const totals = { wood:0, stone:0, iron:0 }, unreadable = { wood:0, stone:0, iron:0 }, readable = { wood:0, stone:0, iron:0 };
    const hot = [];
    let buildActive = 0, researchActive = 0, recruitActive = 0;
    for (const t of towns) {
      for (const k of GB_RES_KEYS) {
        if (t[k] == null || !Number.isFinite(+t[k])) unreadable[k]++;
        else { totals[k] += +t[k]; readable[k]++; }
      }
      if (t.cap > 0) {
        const maxFill = Math.max(...GB_RES_KEYS.map(k => t[k] == null ? -1 : +t[k] / +t.cap));
        if (maxFill >= .95) hot.push(telegramTownLabelById(t.id));
      }
      try { const q = abQueueInfo(t.id); if (q && q.known && q.len > 0) buildActive++; } catch (_) {}
      try { const r = researchTownTechs(t.id); if (r && r.ordersKnown && r.orders && r.orders.length) researchActive++; } catch (_) {}
      try { const q = recruitQueueInfo(t.id); if (q && q.known && q.len > 0) recruitActive++; } catch (_) {}
    }
    let farmReady = null, farmTotal = null;
    try { const o = qolOverviewData(); farmReady = o.farmReady; farmTotal = o.farmTotal; } catch (_) {}
    let attacks = null;
    try { const snap = dodgeIncomingSnapshot(); attacks = snap && snap.known === true ? (snap.moves || []).length : null; } catch (_) {}
    let caveStored = 0, caveKnown = 0;
    try {
      for (const id of caveListTownIds()) {
        const info = caveTownInfo(id);
        if (info && Number.isFinite(+info.stored)) { caveStored += +info.stored; caveKnown++; }
      }
    } catch (_) {}
    const recentErrors = telegramRecentErrorGroups(3600000);
    const unknownTx = Object.values(state.txState || {}).filter(t => t && /^(unknown|manual-review)$/.test(String(t.state || ''))).length;
    const allResourcesUnreadable = townIds.length > 0 && GB_RES_KEYS.every(k => readable[k] === 0);
    const resourcesLine = allResourcesUnreadable
      ? 'Recursos: ? (sin lectura actual)'
      : 'Recursos: 🪵 ' + telegramCompactNumber(totals.wood) + ' · 🪨 ' + telegramCompactNumber(totals.stone) + ' · 🪙 ' + telegramCompactNumber(totals.iron);
    const lines = ['📊 GrepBot · resumen horario', 'Mundo: ' + telegramWorldLabel(),
      'Ciudades: ' + townIds.length,
      resourcesLine,
      'Colas activas: 🏗️ ' + buildActive + ' · 📚 ' + researchActive + ' · ⚔️ ' + recruitActive,
      'Aldeas listas: ' + (farmReady == null ? '?' : String(farmReady)) + '/' + (farmTotal == null ? '?' : String(farmTotal)),
      'Ataques entrantes: ' + (attacks == null ? '?' : String(attacks)),
      'Almacenes ≥95%: ' + (hot.length ? hot.slice(0,6).join(', ') + (hot.length > 6 ? ' +' + (hot.length - 6) : '') : 'ninguno'),
      'Cueva: ' + (caveKnown ? telegramCompactNumber(caveStored) + ' plata guardada' : '?'),
      'Salud: ' + (recentErrors.length ? '⚠️ ' + recentErrors.slice(0,6).map(g => g.feature + '×' + g.count + (g.lastId ? ' [' + g.lastId + ']' : '')).join(' · ') : 'sin errores recientes') + (unknownTx ? ' · ' + unknownTx + ' tx por revisar' : '')
    ];
    const townsWithAnyUnreadable = towns.filter(t => GB_RES_KEYS.some(k => t[k] == null || !Number.isFinite(+t[k]))).length;
    if (townsWithAnyUnreadable) lines.push('Recursos sin lectura completa: ' + townsWithAnyUnreadable + '/' + townIds.length + ' ciudad(es)');
    return lines.join('\n');
  }
  function telegramHourlyDigestTick(forceNow) {
    const root = telegramMonitorStateRoot(), now = Date.now(), hourKey = telegramHourKey(new Date());
    if (forceNow) {
      return telegramSendText(telegramBuildHourlyDigest(), null, { force:true });
    }
    // Cadence is based only on a SUCCESSFUL delivery. Sanitize impossible future
    // timestamps because a stale/corrupt value must never silence summaries forever.
    if (!state.telegramEnabled || !telegramEventEnabled('hourly')) return false;
    let lastSentAt = +root.lastDigestSentAt || 0;
    if (lastSentAt > now + 5 * 60000) {
      lastSentAt = 0;
      root.lastDigestSentAt = 0;
      root.lastDigestError = 'future-timestamp-reset';
      telegramMonitorPersist();
    }
    if (!(lastSentAt > 0)) {
      lastSentAt = now - 3600000;
      root.lastDigestSentAt = lastSentAt;
      telegramMonitorPersist();
    }
    if (now - lastSentAt < 3600000) return false;
    // v6.0.13: retry a failed or interrupted Telegram delivery after 2 minutes,
    // rather than going quiet for ten minutes during a transport/leader incident.
    if (now - (+root.digestAttemptAt || 0) < 2 * 60000) return false;
    root.digestAttemptAt = now; root.digestAttemptHour = hourKey; telegramMonitorPersist();
    telegramNotify('hourly', telegramBuildHourlyDigest(), { force:true, onDone:(ok, info) => {
      const r = telegramMonitorStateRoot();
      if (ok) {
        r.lastDigestSentAt = Date.now();
        r.lastDigestHour = telegramHourKey(new Date());
        r.digestAttemptHour = ''; r.digestAttemptAt = 0; r.lastDigestError = '';
      } else {
        r.lastDigestError = String(info && info.reason || 'send-failed');
        // Do not consume the hour. The dedicated Telegram heartbeat retries later.
      }
      telegramMonitorPersist();
    }});
    return true;
  }

  // Telegram is read-only/out-of-band and must not depend on the automation Web
  // Lock staying healthy. A short-lived, host-wide monitor lock lets any open tab
  // keep alerts alive without duplicate sends. Each pass reloads persisted monitor
  // state before deciding what is due, so a follower cannot act on stale dedup data.
  const TELEGRAM_MONITOR_POLL_MS = 15000;
  const telegramMonitorLockName = 'grepbot-telegram-monitor:' + location.hostname;
  // Re-entrancy guard only: navigator.locks.request is async; block duplicate
  // in-flight requests from the same tick. Cross-tab serialization is handled
  // by the Web Lock itself — this is NOT a substitute for gbLock.
  let telegramMonitorAsyncLockPending = false;
  function telegramReloadSharedMonitorState() {
    try {
      const mon = load(STORE.TELEGRAM_MONITOR_STATE, null);
      if (mon && typeof mon === 'object' && !Array.isArray(mon)) state.telegramMonitorState = mon;
    } catch (_) {}
    try {
      const diag = load(STORE.TELEGRAM_DIAG_STATE, null);
      if (diag && typeof diag === 'object' && !Array.isArray(diag)) state.telegramDiagState = diag;
    } catch (_) {}
    try {
      const h = load(STORE.HEALTH, null);
      if (h && typeof h === 'object' && !Array.isArray(h)) {
        for (const k of Object.keys(moduleHealth)) delete moduleHealth[k];
        Object.assign(moduleHealth, h); state.health = moduleHealth;
      }
    } catch (_) {}
    try { const tx = load(STORE.TX_STATE, null); if (tx && typeof tx === 'object' && !Array.isArray(tx)) state.txState = tx; } catch (_) {}
    try { const c = load(STORE.CIRCUITS, null); if (c && typeof c === 'object' && !Array.isArray(c)) state.circuits = c; } catch (_) {}
    try { const q = load(STORE.NATIVE_QUEUE, null); if (q && typeof q === 'object' && !Array.isArray(q)) state.nativeQueue = q; } catch (_) {}
  }
  function telegramMonitorTickCore() {
    try { telegramAttackMonitor(); } catch (e) { gbLogT('telegram-attack-monitor', 60000, 'telegram attack monitor: ' + String(e && e.message || e).slice(0,100)); }
    try { telegramWarehouseMonitor(); } catch (e) { gbLogT('telegram-wh-monitor', 60000, 'telegram warehouse monitor: ' + String(e && e.message || e).slice(0,100)); }
    try { telegramCriticalMonitor(); } catch (e) { gbLogT('telegram-critical-monitor', 60000, 'telegram critical monitor: ' + String(e && e.message || e).slice(0,100)); }
    try { telegramHourlyDigestTick(false); } catch (e) { gbLogT('telegram-digest-monitor', 60000, 'telegram digest: ' + String(e && e.message || e).slice(0,100)); }
  }
  function telegramMonitorTick() {
    if (state.enabledHosts[location.host] !== true || !state.telegramEnabled || !gbInstanceAlive()) return false;
    const run = () => { telegramReloadSharedMonitorState(); telegramMonitorTickCore(); };
    if (!gbTabCoordSupported) {
      if (!gbTabLeader) return false;
      run(); return true;
    }
    if (telegramMonitorAsyncLockPending) return false;
    telegramMonitorAsyncLockPending = true;
    try {
      navigator.locks.request(telegramMonitorLockName, { mode:'exclusive', ifAvailable:true }, lock => {
        telegramMonitorAsyncLockPending = false;
        if (!gbInstanceAlive() || !lock) return;
        run();
      }).catch(() => { telegramMonitorAsyncLockPending = false; });
      return true;
    } catch (_) {
      telegramMonitorAsyncLockPending = false;
      if (gbTabLeader) { run(); return true; }
      return false;
    }
  }
  (function telegramLivenessMigration613() {
    const key = wkey('grepbot:mig:6.0.13:telegram-liveness');
    if (load(key, false)) return;
    try {
      const root = telegramMonitorStateRoot();
      // Force one positive hourly proof after upgrade and re-evaluate any attack
      // that may have been missed while 6.0.12 treated an unreadable scan as empty.
      root.lastDigestSentAt = 0;
      root.digestAttemptAt = 0;
      root.digestAttemptHour = '';
      root.lastDigestError = '';
      root.attacks = {};
      root.attackScanKnown = null;
      root.attackScanWhy = '';
      telegramMonitorPersist();
      save(key, true);
    } catch (_) {}
  })();

  state.webhookRatelimit || (state.webhookRatelimit = {});
  state.webhookPending || (state.webhookPending = {});
