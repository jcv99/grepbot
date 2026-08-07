  // ---------- auto-collect short gathers (Senado / Reunir recursos) ----------
  // Grepolis DOM: button is <div class="btn_claim_resources ..."> with sibling <span>Recoger</span>.
  // Time lives in sibling .action_card > .action_time_wrapper > .action_time (formats: "5min", "1h 30min", "4h").
  // The button always has CSS classes "disabled active" - that's state styling, not actual disable.
  // We auto-click only short timers (<= COLLECT_MAX_MIN) unless "Collect all" is on.
  function collectMaxMin() { return state.collectMaxMin || 10; }
  const COLLECT_ACTIONS = [
    'collect', 'collect_resources', 'collectresources', 'collect_resource',
    'claim', 'claim_resources', 'claimreward', 'claimrewardresource',
    'gather', 'recoger', 'pickup', 'pick_up',
  ];
  const COLLECT_BTN_SEL = '.btn_claim_resources, button[data-action*="claim"], a[data-action*="claim"]';
  function parseTimerMinutes(txt) {
    const t = String(txt || '').replace(/\u00a0/g, ' ').trim().toLowerCase();
    if (!t) return null;
    let m = t.match(/^(\d{1,2})\s*min$/);
    if (m) return parseInt(m[1], 10);
    m = t.match(/^(\d+)\s*h(?:\s*(\d+)\s*min)?$/);
    if (m) return parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
    return null;
  }
  function learnCollectAction(u) {
    if (!u || state.collectTpl) return;
    const m = u.match(/[?&]action=([a-z0-9_]+)/i);
    if (!m) return;
    const a = m[1].toLowerCase();
    if (!COLLECT_ACTIONS.includes(a)) return;
    state.collectTpl = u;
    save(wkey(STORE.COLLECT_TPL), u);
    gbLog('learned collect action', a);
  }
  function buildCollectUrl(template, townId) {
    try {
      const u = new URL(template, location.origin);
      u.searchParams.set('town_id', String(townId));
      u.searchParams.set('h', state.csrf || u.searchParams.get('h') || '');
      return u.pathname + '?' + u.searchParams.toString();
    } catch (e) {
      return template.replace(/town_id=\d+/, `town_id=${townId}`);
    }
  }
  function autoCollectResources() {
    if (!state.autoCollect) return;
    if (!hostEnabled()) return;
    if (document.hidden) return;
    // Opening a farm village shows Recoger - that DOM path used to ignore warehouse.
    if (currentTownWarehouseBlocks()) {
      gbLogT('collect-wh-full', 60000, `auto-collect: skipped Recoger (warehouse full, mode=${state.farmFullMode})`);
      return;
    }
    const btns = Array.from(document.querySelectorAll(COLLECT_BTN_SEL));
    let clicked = 0, scanned = btns.length;
    const skipped = [];
    for (const btn of btns) {
      if (btn.dataset.grepbotClicked) { skipped.push('already-clicked'); continue; }
      const card = btn.closest('.action_card') || btn.closest('[class*="action_card"]') || btn.parentElement;
      if (!card) { skipped.push('no-card'); continue; }
      const timeEl = card.querySelector('.action_time');
      if (!timeEl) { skipped.push('no-time'); continue; }
      const min = parseTimerMinutes(timeEl.textContent);
      if (min == null || min === 0) { skipped.push('no-parse:' + (timeEl.textContent||'').trim()); continue; }
      if (!state.collectAll && min > collectMaxMin()) { skipped.push(`too-long:${min}min`); continue; }
      const collectTxt = i18n('collect');
      const label = btn.querySelector('span') || btn;
      const labelTxt = (label.textContent || '').replace(/\u00a0/g, ' ');
      if (collectTxt && labelTxt && !labelTxt.includes(collectTxt) &&
          !/Recoger|Collect|Sammeln|Collecter|Raccogli|Recolher/i.test(labelTxt)) {
        skipped.push('i18n:' + labelTxt.trim().slice(0, 12));
        continue;
      }
      btn.dataset.grepbotClicked = String(Date.now());
      if (gbDomClick(btn, 'collect')) clicked++;
    }
    updateCollectStateBadge(scanned, clicked);
    if (clicked) { gbLog(`auto-collect: clicked ${clicked}/${scanned} Recoger buttons`); flash(`auto-collect x${clicked}`); }
    else if (scanned > 0) gbLogT('collect-skip', 120000, `auto-collect: 0/${scanned} clickable`, skipped.slice(0, 4).join(', '));
  }
  function updateCollectStateBadge(scanned, clicked) {
    const e = panel?.querySelector('#gb-collect-state');
    if (!e) return;
    if (state.collectAll) {
      e.textContent = `* ALL ON (${scanned}/${clicked})`;
      e.style.color = '#f96';
    } else if (scanned > 0) {
      e.textContent = `auto: ${clicked}/${scanned}`;
      e.style.color = clicked ? '#6c6' : '#888';
    } else {
      const a = state.collectTpl && state.collectTpl.match(/action=([^&]+)/);
      e.textContent = state.collectTpl ? '* learn:' + (a ? a[1] : '?') : 'no btn';
      e.style.color = '#888';
    }
  }
  // background collect: fire the learned action URL for each owned town, no DOM/visibility needed
  let collectBgBackoff = 90_000;
  let collectBgTimer = null;
  function scheduleCollectBg(ms) {
    if (collectBgTimer) return;
    collectBgTimer = gbTimeout(() => {
      collectBgTimer = null;
      collectAllBackground();
    }, ms);
  }
  function collectAllBackground() {
    if (!state.collectAll) return;
    if (!hostEnabled() || automationPaused({}) || captchaPaused('collect')) return;
    if (gbLocked('collect-bg') || collectBgTimer) return;
    if (!state.csrf) { scheduleCollectBg(30_000); return; }
    if (!state.collectTpl) { scheduleAutoCollect(); scheduleCollectBg(60_000); return; }
    if (!state.towns.length) fetchOwnedTowns();
    const n = state.towns.length;
    if (!n) { scheduleCollectBg(60_000); return; }
    // Refuse blind GET on opaque learned URL - prefer gpAjax controller/action from URL.
    let collectCtrl = null, collectAction = null;
    try {
      const u = new URL(state.collectTpl, location.origin);
      collectAction = u.searchParams.get('action');
      const parts = u.pathname.split('/').filter(Boolean);
      // /game/<controller> or /game/<controller>?...
      collectCtrl = parts.length >= 2 && parts[0] === 'game' ? parts[1] : parts[parts.length - 1];
    } catch (_) {}
    if (!collectCtrl || !collectAction) {
      gbLogT('collect-bg-nomethod', 120000, 'bg-collect: skip (learned URL method/controller unknown - no blind GET)');
      scheduleCollectBg(collectBgBackoff + Math.random() * 30_000);
      return;
    }
    gbLock('collect-bg');
    let pending = n;
    let errors = 0;
    const finish = () => {
      if (--pending > 0) return;
      gbUnlock('collect-bg');
      if (errors) collectBgBackoff = Math.min(collectBgBackoff * 2, 600_000);
      else collectBgBackoff = 90_000;
      scheduleCollectBg(collectBgBackoff + Math.random() * 30_000);
    };
    state.towns.forEach((t, i) => {
      gbTimeout(() => {
        if (!hostEnabled() || automationPaused({}) || captchaPaused('collect')) { finish(); return; }
        if (townWarehouseBlocks(t.id)) {
          gbLogT('bg-collect-wh-' + t.id, 120000, `bg-collect: skip town ${t.id} (warehouse full)`);
          finish();
          return;
        }
        gameAjaxPost('collect', collectCtrl, collectAction, { town_id: +t.id }, (err, res) => {
          if (err && err !== 'dryrun' && err !== 'disabled' && err !== 'paused' && err !== 'budget' && err !== 'remembered') {
            errors++;
            if (err !== 'captcha' && err !== 'captcha-pause') {
              flash(`collect ${t.name || t.id}: ${err}`);
            }
          } else if (!err && res && (res.error || res.err)) {
            errors++;
            flash(`collect ${t.name || t.id}: ${res.error || res.err}`);
          }
          finish();
        });
      }, i * 400);
    });
    flash(`bg-collect x${n}`);
  }
  let collectTimer = null;
  function scheduleAutoCollect() {
    if (collectTimer) return;
    collectTimer = gbTimeout(() => { collectTimer = null; autoCollectResources(); }, 800);
  }
  // Prefer known game containers over document.body - chat/map ticks flood body MO.
  // One observer can watch multiple roots; SPA remount rebinds via ensureDomObserver.
  let gbDomObserverSig = '';
  function ensureDomObserver() {
    if (!gbDomObserver) {
      gbDomObserver = new MutationObserver(() => {
        if (document.hidden) return;
        if (state.autoCollect) scheduleAutoCollect();
        if (state.autoBandit) scheduleBanditScan();
      });
    }
    const targets = [];
    const ui = document.querySelector('#ui_box');
    if (ui) targets.push(ui);
    document.querySelectorAll('.window_content, .quests, #questlog').forEach(el => {
      if (el && targets.indexOf(el) < 0) targets.push(el);
    });
    if (!targets.length && document.body) targets.push(document.body);
    const sig = targets.map(t => (t.id || '') + '.' + (t.className || '')).join('|');
    if (sig === gbDomObserverSig) return;
    try { gbDomObserver.disconnect(); } catch (_) {}
    gbDomObserverSig = sig;
    for (const t of targets) {
      try { gbDomObserver.observe(t, { childList: true, subtree: true }); } catch (_) {}
    }
  }
  ensureDomObserver();

