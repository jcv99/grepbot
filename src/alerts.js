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
  function alertWebhook(event, payload) {
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

