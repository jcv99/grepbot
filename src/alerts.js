  // ---------- Discord/Telegram webhooks (Phase 8.8) ----------
  const alertLastSent = {}; // event → ts
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
  function alertWebhook(event, payload) {
    const url = (state.webhookUrl || '').trim();
    if (!url) return;
    if (!alertWebhookUrlOk(url)) {
      gbLogT('webhook-url', 120000, 'webhook: invalid Discord/Telegram URL');
      return;
    }
    const ev = state.webhookEvents || {};
    if (ev[event] === false) return;
    const now = Date.now();
    if ((alertLastSent[event] || 0) + 5 * 60 * 1000 > now) return; // rate limit identical events
    const text = `GrepBot [${location.host}] ${event}\n` +
      '```json\n' + JSON.stringify(payload || {}, null, 2).slice(0, 1800) + '\n```';
    let body;
    if (alertIsTelegram(url)) {
      const chatId = alertTelegramChatId(url);
      if (!chatId) {
        gbLogT('webhook-chat', 120000, 'webhook: Telegram chat_id missing');
        return;
      }
      body = {
        chat_id: chatId,
        text: text.slice(0, 3900),
        disable_web_page_preview: true,
      };
    } else {
      body = {
        content: null,
        embeds: [{
          title: `GrepBot: ${event}`,
          description: '```json\n' + JSON.stringify(payload || {}, null, 2).slice(0, 1800) + '\n```',
          timestamp: new Date().toISOString(),
          footer: { text: location.host },
        }],
      };
    }
    try {
      gbXhr({
        method: 'POST',
        url,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify(body),
        onload: (r) => {
          if (r.status >= 200 && r.status < 300) alertLastSent[event] = Date.now();
          else gbLogT('webhook-fail', 60000, 'webhook status ' + r.status);
        },
        onerror: (e) => {
          if (e && e.captcha) return; // captcha trip already logged
          gbLogT('webhook-err', 60000, 'webhook transport error');
        },
      });
    } catch (e) {
      gbLogT('webhook-ex', 60000, 'webhook ' + String(e));
    }
  }
