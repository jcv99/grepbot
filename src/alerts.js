  function alertIsTelegram(url) {
    return /api\.telegram\.org\/bot/i.test(url) || /telegram/i.test(url);
  }
  function alertWebhookUrlOk(url) {
    if (/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+/i.test(url)) return true;
    if (/api\.telegram\.org\/bot[^/\s]+\/sendMessage/i.test(url)) return true;
    return false;
  }
  function alertTelegramChatId(url) {
    let chatId = (state.webhookEvents && state.webhookEvents.telegramChatId) || '';
    if (!chatId) {
      try {
        const m = /[?&]chat_id=([^&]+)/.exec(url);
        if (m) chatId = decodeURIComponent(m[1]);
      } catch (_) {}
    }
    return chatId ? String(chatId) : '';
  }
  function alertWebhookKey(event, payload) {
    const p = payload || {};
    let id = p.id ?? p.movement_id ?? p.command_id ?? p.report_id ?? p.questId ?? '';
    if (!id && p.finding) id = p.finding.id ?? p.finding.report_id ?? p.finding.ts ?? '';
    if (!id && p.watchlist != null) id = 'watch:' + p.watchlist;
    if (!id) id = p.dest ?? p.townId ?? p.town_id ?? p.feature ?? '';
    // `resource` discriminates the capping pre-warn: two resources capping in
    // the same town are two distinct events, not one rate-limited duplicate.
    const subtype = p.cs ? 'cs' : (p.resource ? String(p.resource) : '');
    return `${event}:${subtype}:${String(id || '-').slice(0, 96)}`;
  }
  // ===== Desktop notification + chime (v4 plan 6.4) ==========================
  // Sound is SYNTHESISED, not shipped. Embedding base64 WAVs would add
  // kilobytes to the artifact that nobody in this repo can listen to and
  // verify; a two-oscillator blip is deterministic, weighs nothing and needs no
  // network - which matters because the CSP and the "no phone-home" rule both
  // forbid fetching an asset.
  const CHIME_TONES = {
    captcha: [880, 660], attack: [740, 440], pattern: [620, 620],
    culture: [520, 780], hero: [700, 700], 'counter-intel': [500, 600],
    _default: [660, 520],
  };
  function alertPlayChime(event) {
    if (state.notifyMuted) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const tones = CHIME_TONES[event] || CHIME_TONES._default;
      const vol = Math.max(0, Math.min(1, Number.isFinite(+state.notifyVolume) ? +state.notifyVolume : 0.4));
      tones.forEach((hz, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = hz;
        g.gain.value = vol * 0.25;
        o.connect(g); g.connect(ctx.destination);
        const t0 = ctx.currentTime + i * 0.14;
        o.start(t0); o.stop(t0 + 0.12);
      });
      // Free the context once the blip is done; leaking one per alert would
      // eventually hit the browser's context limit.
      setTimeout(() => { try { ctx.close(); } catch (_) {} }, 800);
    } catch (e) { gbLogT('chime-' + event, 60000, 'chime: ' + String(e).slice(0, 60)); }
  }
  function alertNotifyText(event, payload) {
    const p = payload || {};
    const bits = [];
    if (p.dest != null) bits.push('ciudad ' + p.dest);
    if (p.townId != null) bits.push('ciudad ' + p.townId);
    if (p.resource) bits.push(p.resource);
    if (p.etaMin != null) bits.push('~' + p.etaMin + ' min');
    if (p.cs) bits.push('CS');
    if (p.watcher) bits.push(p.watcher);
    if (p.n != null) bits.push(p.n + 'x');
    return { title: 'GrepBot: ' + event, body: bits.join(' \u00b7 ') || location.host };
  }
  function alertDesktop(event, payload, key) {
    if (!state.notifyEnabled) return false;
    const ev = state.notifyEvents || {};
    if (ev[event] === false) return false;
    try {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
      const n = alertNotifyText(event, payload);
      new Notification(n.title, { body: n.body, tag: key });
    } catch (e) {
      gbLogT('notify-' + event, 60000, 'notify: ' + String(e).slice(0, 60));
      return false;
    }
    alertPlayChime(event);
    return true;
  }
  // The desktop channel is INDEPENDENT of the webhook URL: alertWebhook returns
  // early when no URL is configured, so calling the notifier from inside it
  // would mean desktop alerts only worked for users who also set up Discord.
  // Its OWN dedup table, not alertLastSent. Sharing that one meant a desktop
  // alert stamped the key and the webhook block - which runs immediately after
  // in the same call - then saw a fresh timestamp and short-circuited, so
  // enabling notifications silently disabled Discord entirely.
  const alertNotifiedAt = Object.create(null);
  function alertNotify(event, payload) {
    const now = Date.now();
    const key = alertWebhookKey(event, payload);
    if ((alertNotifiedAt[key] || 0) + 5 * 60 * 1000 > now) return;
    if (alertDesktop(event, payload, key)) {
      alertNotifiedAt[key] = now;
      // Bounded: one entry per distinct event key, swept on the same window.
      const cut = now - 30 * 60 * 1000;
      for (const k of Object.keys(alertNotifiedAt)) if (alertNotifiedAt[k] < cut) delete alertNotifiedAt[k];
    }
  }
  function alertWebhook(event, payload) {
    // Desktop first, and outside the URL guard below.
    try {
      const ev = state.webhookEvents || {};
      if (ev[event] !== false) alertNotify(event, payload);
    } catch (_) {}
    const url = (state.webhookUrl || '').trim();
    if (!url) return;
    if (state.dryRun) {
      gbLogT('webhook-dry-' + event, 60000, `DRY-RUN webhook ${event}: ${dryRunFmt(payload)}`);
      return;
    }
    if (!alertWebhookUrlOk(url)) {
      gbLogT('webhook-url', 120000, 'webhook: invalid Discord/Telegram URL');
      return;
    }
    const ev = state.webhookEvents || {};
    if (ev[event] === false) return;
    const now = Date.now();
    const key = alertWebhookKey(event, payload);
    if (alertPending[key]) return;
    if ((alertLastSent[key] || 0) + 5 * 60 * 1000 > now) return;
    const text = `GrepBot [${location.host}] ${event}\n` +
      '```json\n' + JSON.stringify(payload || {}, null, 2).slice(0, 1800) + '\n```';
    let body;
    if (alertIsTelegram(url)) {
      const chatId = alertTelegramChatId(url);
      if (!chatId) {
        gbLogT('webhook-chat', 120000, 'webhook: Telegram chat_id missing');
        return;
      }
      body = { chat_id: chatId, text: text.slice(0, 3900), disable_web_page_preview: true };
    } else {
      body = {
        content: null,
        embeds: [{
          title: `GrepBot: ${event}${payload && payload.cs ? ' [CS]' : ''}`,
          description: '```json\n' + JSON.stringify(payload || {}, null, 2).slice(0, 1800) + '\n```',
          timestamp: new Date().toISOString(),
          footer: { text: location.host },
        }],
      };
    }
    alertPending[key] = now;
    try {
      gbXhr({
        scope: 'external',
        method: 'POST',
        url,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify(body),
        onload: (r) => {
          delete alertPending[key];
          if (r.status >= 200 && r.status < 300) alertLastSent[key] = Date.now();
          else gbLogT('webhook-fail-' + key, 60000, 'webhook status ' + r.status);
        },
        onerror: () => {
          delete alertPending[key];
          gbLogT('webhook-err-' + key, 60000, 'webhook transport error');
        },
      });
    } catch (e) {
      delete alertPending[key];
      gbLogT('webhook-ex-' + key, 60000, 'webhook ' + String(e));
    }
  }

