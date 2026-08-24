  function collectMaxMin() { return state.collectMaxMin || 10; }
  const COLLECT_ACTIONS = [
    'collect', 'collect_resources', 'collectresources', 'collect_resource',
    'claim', 'claim_resources', 'claimreward', 'claimrewardresource',
    'gather', 'recoger', 'pickup', 'pick_up',
  ];
  const COLLECT_BTN_SEL = '.btn_claim_resources, button[data-action*="claim"], a[data-action*="claim"]';
  function parseTimerMinutes(txt) {
    const t = String(txt || '').replace(/ /g, ' ').trim().toLowerCase();
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
  function autoCollectResources() {
    if (!state.autoCollect) return;
    if (!hostEnabled() || automationPaused({}) || captchaPaused('collect') || circuitOpen('collect')) return;
    if (document.hidden) return;
    if (currentTownWarehouseBlocks()) {
      gbLogT('collect-wh-full', 60000, `auto-collect: skipped Recoger (warehouse full, mode=${state.farmFullMode})`);
      return;
    }
    const btns = Array.from(document.querySelectorAll(COLLECT_BTN_SEL));
    let attempted = 0, scanned = btns.length;
    const skipped = [];
    let currentTownId = null;
    try { currentTownId = gameUw().Game && gameUw().Game.townId; } catch (_) {}
    for (let bi = 0; bi < btns.length; bi++) {
      const btn = btns[bi];
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
      const labelTxt = (label.textContent || '').replace(/ /g, ' ');
      if (collectTxt && labelTxt && !labelTxt.includes(collectTxt) &&
          !/Recoger|Collect|Sammeln|Collecter|Raccogli|Recolher/i.test(labelTxt)) {
        skipped.push('i18n:' + labelTxt.trim().slice(0, 12));
        continue;
      }
      const beforeTime = (timeEl.textContent || '').trim();
      attempted++;
      // Stamp dataset on every successful bail (including dry-run) so the
      // MutationObserver stops re-trying the same button. In dry-run no click
      // ever lands — without this stamp the next MO tick finds the button
      // "fresh" and re-arms auto-collect every ~1s.
      txDomWrite('collect', `dom-collect:${currentTownId || '-'}:${min}:${bi}`,
        { town_id: currentTownId, minutes: min, dom_index: bi },
        () => {
          btn.dataset.grepbotClicked = String(Date.now());
          btn.click();
        },
        () => {
          if (!btn.isConnected || btn.disabled || btn.getAttribute('aria-disabled') === 'true') return true;
          const nowTime = (card.querySelector('.action_time')?.textContent || '').trim();
          return !!nowTime && nowTime !== beforeTime;
        },
        (err) => {
          if (!err || err === 'dryrun') {
            btn.dataset.grepbotClicked = String(Date.now());
          } else if (btn.isConnected) {
            delete btn.dataset.grepbotClicked;
          }
        });
    }
    updateCollectStateBadge(scanned, attempted);
    if (attempted) { gbLog(`auto-collect: attempted ${attempted}/${scanned} Recoger buttons`); flash(`auto-collect x${attempted}`); }
    else if (scanned > 0) gbLogT('collect-skip', 120000, `auto-collect: 0/${scanned} eligible`, skipped.slice(0, 4).join(', '));
  }
  function updateCollectStateBadge(scanned, clicked) {
    const e = panel?.querySelector('#gb-collect-state');
    if (!e) return;
    if (state.collectAll) {
      e.textContent = `Recogida: todo (${clicked}/${scanned})`;
      e.style.color = '#f96';
    } else if (scanned > 0) {
      e.textContent = `Recogida: ${clicked}/${scanned}`;
      e.style.color = clicked ? '#6c6' : '#888';
    } else {
      e.textContent = state.collectTpl ? 'Recogida: botón aprendido' : 'Recogida: sin botón a la vista';
      e.style.color = '#888';
    }
  }
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
    if (!state.autoCollect || !state.collectAll) return;
    if (!hostEnabled() || automationPaused({}) || captchaPaused('collect') || circuitOpen('collect')) return;
    if (gbLocked('collect-bg') || collectBgTimer) return;
    if (!state.csrf) { scheduleCollectBg(30_000); return; }
    if (!state.collectTpl) { scheduleAutoCollect(); scheduleCollectBg(60_000); return; }
    if (!state.towns.length) fetchOwnedTowns();
    const n = state.towns.length;
    if (!n) { scheduleCollectBg(60_000); return; }

    let collectCtrl = null, collectAction = null;
    try {
      const u = new URL(state.collectTpl, location.origin);
      collectAction = u.searchParams.get('action');
      const parts = u.pathname.split('/').filter(Boolean);

      collectCtrl = parts.length >= 2 && parts[0] === 'game' ? parts[1] : parts[parts.length - 1];

      // gpAjax builds /game/<controller>, so a script-file path segment would
      // POST to /game/index.php and be rejected. Unknown beats blind.
      if (collectCtrl && /\.php$/i.test(collectCtrl)) collectCtrl = null;
    } catch (_) {}
    if (!collectCtrl || !collectAction) {
      gbLogT('collect-bg-nomethod', 120000, 'bg-collect: skip (learned URL method/controller unknown — no blind GET)');
      scheduleCollectBg(collectBgBackoff + Math.random() * 30_000);
      return;
    }
    const collectBgLock = gbLock('collect-bg', 300000);
    if (!collectBgLock) return;
    let pending = n;
    let errors = 0;
    const finish = () => {
      if (!gbLockTouch('collect-bg', collectBgLock)) return;
      if (--pending > 0) return;
      gbUnlock('collect-bg', collectBgLock);
      if (errors) collectBgBackoff = Math.min(collectBgBackoff * 2, 600_000);
      else collectBgBackoff = 90_000;
      // Defer the reschedule until AFTER the unlock has fully settled, so the
      // window between unlock and timer-set cannot leak a second
      // collectAllBackground entry. OPEN-PLAN 1.9 / 8/23 audit #26.
      gbTimeout(() => scheduleCollectBg(collectBgBackoff + Math.random() * 30_000), 0);
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

          // JRN_SKIP_ERRS = local gates; nothing was posted, so none of them is
          // evidence about the endpoint. `captcha` is excluded for the same
          // reason the journal excludes it: the captcha breaker owns that
          // backoff, and counting it here doubled bg-collect's own on top.
          if (err && !JRN_SKIP_ERRS[err] && err !== 'captcha') {
            errors++;
            flash(`collect ${t.name || t.id}: ${err}`);
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
  // Cadence of the idle safety-net interval armed in bandit.js: the observer is
  // the primary driver, this is the floor under it.
  const COLLECT_SAFETY_MS = 5000;
  let collectTimer = null;
  let collectRafPending = false;
  function scheduleAutoCollect() {
    if (collectTimer || collectRafPending) return;
    // rAF when the tab is visible paints inside the next frame so a burst of
    // MO records collapses to one auto-collect; the 800ms timer stays for
    // hidden tabs (rAF is paused) and for engines without rAF.
    if (!document.hidden && typeof requestAnimationFrame === 'function') {
      collectRafPending = true;
      requestAnimationFrame(() => { collectRafPending = false; autoCollectResources(); });
    } else {
      collectTimer = gbTimeout(() => { collectTimer = null; autoCollectResources(); }, 800);
    }
  }
  let gbDomObserverSig = '';
  function ensureDomObserver() {
    if (!gbDomObserver) {
      gbDomObserver = new MutationObserver((records) => {
        if (document.hidden) return;
        // Observing <body> puts GrepBot's own DOM in scope, and the Log tab
        // repaints constantly — without this it would re-arm a collect/bandit/
        // native scan on every line, which can then flash again and re-arm it.
        // A body-level append reports `target === body`, so the added/removed
        // nodes have to be inspected too, not just the target's ancestors.
        // Text-only records are deliberately NOT filtered: autoCollect keys off
        // the game's own "N min" leaf text.
        const GB_OWN_SEL = '.gb-native-qctl,.gb-native-qpop,.gb-flash,#grepbot-panel';
        const ownEl = n => !!(n && n.nodeType === 1 && n.closest && n.closest(GB_OWN_SEL));
        const ownRecord = (r) => {
          const t = r.target && r.target.nodeType === 1 ? r.target : r.target && r.target.parentElement;
          if (ownEl(t)) return true;
          const els = [...(r.addedNodes || []), ...(r.removedNodes || [])].filter(n => n && n.nodeType === 1);
          return els.length > 0 && els.every(ownEl);
        };
        const ownOnly = (records || []).length && (records || []).every(ownRecord);
        if (ownOnly) return;
        scheduleAutoCollect();
        if (state.autoBandit) scheduleBanditScan();
        scheduleNativeUiScan();
      });
    }
    // Grepolis windows are NOT inside #ui_box: WindowsView is `el:"body"` and
    // renderWindow mounts with `$parent:this.$el`, so an open window is a
    // SIBLING of #ui_box under <body>. A subtree observer on #ui_box therefore
    // never sees a window open, and nothing scheduled a native-UI scan for it.
    // Observing body costs one extra filter pass and is the only target that
    // covers both. No #ui_box/.window_content fallback: those nodes cannot exist
    // before <body> either, so the old fallback branch was unreachable — wait
    // for the document instead.
    if (!document.body) {
      gbListen(document, 'DOMContentLoaded', () => ensureDomObserver(), { once: true });
      return;
    }
    const targets = [document.body];
    const sig = targets.map(t => (t === document.body ? 'BODY' : (t.id || '') + '.' + (t.className || ''))).join('|');
    if (sig === gbDomObserverSig) return;
    try { gbDomObserver.disconnect(); } catch (_) {}
    gbDomObserverSig = sig;
    for (const t of targets) {
      try { gbDomObserver.observe(t, { childList:true,subtree:true,attributes:true,attributeFilter:['id','data-unit_id','data-unit-id','data-unit_type','data-unit-type','data-building_type','data-building-type','data-building','data-town-id','data-town_id','data-townid'] }); } catch (_) {}
    }
  }
  ensureDomObserver();
  let banditAttackSentAt = 0;
  let banditIdleUntil = 0;
