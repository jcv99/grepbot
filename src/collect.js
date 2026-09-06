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
  function collectPendingBlock(intent) {
    const tx = state.txState && state.txState[intent];
    if (!tx || !/^(planned|precheck|sending|confirming|reconciling|unknown|manual-review|dryrun)$/.test(tx.state || '')) return null;
    const age = Date.now() - (+tx.unknownAt || +tx.updatedAt || +tx.createdAt || Date.now());
    // Let txRun perform its own bounded reconciliation/expiry when eligible.
    if (tx.state === 'unknown' && age >= TX_UNKNOWN_RECHECK_MS) return null;
    if (tx.state === 'manual-review' && !txManualReviewPermanent(tx) && age > TX_MANUAL_REVIEW_TTL_MS) return null;
    return tx.state || 'pending';
  }
  function autoCollectResources() {
    if (!state.autoCollect) return;
    if (!hostEnabled() || automationPaused({}) || captchaPaused('collect') || circuitOpen('collect')) return;
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
      const labelTxt = (label.textContent || '').replace(/\u00a0/g, ' ');
      if (collectTxt && labelTxt && !labelTxt.includes(collectTxt) &&
          !/Recoger|Collect|Sammeln|Collecter|Raccogli|Recolher/i.test(labelTxt)) {
        skipped.push('i18n:' + labelTxt.trim().slice(0, 12));
        continue;
      }
      const beforeTime = (timeEl.textContent || '').trim();
      const endpoint = `dom-collect:${currentTownId || '-'}:${min}:${bi}`;
      const intent = txIntent('collect', 'dom', endpoint, { town_id: currentTownId, minutes: min, dom_index: bi }, null);
      const pendingState = collectPendingBlock(intent);
      if (pendingState) {
        skipped.push('pending:' + pendingState);
        gbLogT('collect-pending-' + intent, 30000, `auto-collect: ${min}min blocked by pending TX (${pendingState})`);
        continue;
      }
      attempted++;

      txDomWrite('collect', endpoint,
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

      if (collectCtrl && /\.php$/i.test(collectCtrl)) collectCtrl = null;
    } catch (_) {}
    if (!collectCtrl || !collectAction) {
      gbLogT('collect-bg-nomethod', 120000, 'bg-collect: skip (learned URL method/controller unknown \u2014 no blind GET)');
      scheduleCollectBg(collectBgBackoff + Math.random() * 30_000);
      return;
    }
    const collectBgLock = gbLock('collect-bg', 300000);
    if (!collectBgLock) return;
    let pending = n;
    let errors = 0;
    const finish = () => {
      gbLockTouch('collect-bg', collectBgLock);
      if (--pending > 0) return;
      gbUnlock('collect-bg', collectBgLock);
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
        const tid = gbNum(t.id);
        if (tid == null) {
          gbLogT('bg-collect-id-' + t.id, 120000, `bg-collect: skip town ${t.id} (id unreadable)`);
          finish();
          return;
        }
        gameAjaxPost('collect', collectCtrl, collectAction, { town_id: tid }, (err, res) => {

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
  let collectTimer = null;
  let collectRafPending = false;
  function scheduleAutoCollect() {
    if (collectTimer || collectRafPending) return;

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

        const GB_OWN_SEL = '.gb-native-qctl,.gb-native-panel,.gb-flash,#grepbot-panel,#grepbot-queue-center';
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
