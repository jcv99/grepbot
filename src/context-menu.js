  // ===== Map context menu (v4 plan 6.7) ======================================
  // It does NOT intercept a single game DOM event. No capture listener, no
  // preventDefault, no synthetic click: the game's own popup keeps every one of
  // its own interactions, and GrepBot mounts a SIBLING menu beside it.
  //
  // The map itself is canvas (plan 27 section 0 forbids canvas work), so the
  // only readable anchor is the game's own town-info popup, which does render
  // a town id into the DOM. When that popup is absent or unreadable, nothing
  // is shown - no coordinate is inferred and no id is guessed.
  //
  // Polling is a self-rescheduling gbTimeout chain, not a gbInterval: the
  // README hard rule reserves interval registration for the existing cadences,
  // and a chain that only re-arms after the previous scan settled cannot pile
  // up behind a slow elementFromPoint.
  const CTX_SCAN_MS = 750;
  const CTX_POPUP_SEL = '.ui-dialog-content, .gpwindow_content, .town_info, .context_menu';
  const CTX_ID_ATTRS = ['data-townid', 'data-town-id', 'data-id'];
  let ctxMenuEl = null;
  let ctxMenuTown = null;
  let ctxTimer = 0;
  function ctxReadTownId(popup) {
    for (const a of CTX_ID_ATTRS) {
      const holder = popup.matches && popup.matches('[' + a + ']') ? popup : popup.querySelector('[' + a + ']');
      const v = holder && holder.getAttribute(a);
      if (v && /^\d+$/.test(String(v).trim())) return String(v).trim();
    }
    // Fall back to a link that names the town id explicitly. A bare number
    // scraped from popup TEXT is deliberately not accepted: it would happily
    // match a resource count and mount a menu for a town that does not exist.
    try {
      const a = popup.querySelector('a[href*="town_id="], a[href*="&town="], a[href*="?town="]');
      const m = a && String(a.getAttribute('href') || '').match(/(?:town_id|town)=(\d+)/);
      if (m) return m[1];
    } catch (_) {}
    return null;
  }
  function ctxFindPopup() {
    let nodes = [];
    try { nodes = Array.from(document.querySelectorAll(CTX_POPUP_SEL)); } catch (_) { return null; }
    for (const n of nodes) {
      // Never mount on our own UI - the same ownership test nativeUiScan uses.
      if (n.closest('#grepbot-panel, .gb-widget, .gb-ctx-menu')) continue;
      const r = n.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const id = ctxReadTownId(n);
      if (!id) continue;
      return { el: n, id, rect: r };
    }
    return null;
  }
  function ctxDispose() {
    if (ctxMenuEl) { try { ctxMenuEl.remove(); } catch (_) {} }
    ctxMenuEl = null;
    ctxMenuTown = null;
  }
  // Full stop, including the pending chain link. ctxDispose alone leaves one
  // more scan armed; grepbotDispose calls this so teardown is immediate.
  function contextMenuStop() {
    if (ctxTimer) { try { gbClearTimeout(ctxTimer); } catch (_) {} ctxTimer = 0; }
    ctxDispose();
  }
  function ctxItem(label, title, fn) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.title = title || '';
    b.style.cssText = 'display:block;width:100%;text-align:left;background:none;border:0;color:var(--gb-fg-2);' +
      'padding:3px 8px;cursor:pointer;font-size:11px;white-space:nowrap';
    b.addEventListener('mouseenter', () => { b.style.background = 'var(--gb-bg-raise)'; });
    b.addEventListener('mouseleave', () => { b.style.background = 'none'; });
    b.addEventListener('click', e => {
      e.stopPropagation();
      try { fn(); } catch (err) { flash('fallo: ' + String(err).slice(0, 40)); }
    });
    return b;
  }
  function ctxBuild(townId, rect) {
    const m = document.createElement('div');
    m.className = 'gb-ctx-menu gb-widget';
    m.style.cssText = `position:fixed;left:${Math.round(rect.right + 12)}px;top:${Math.round(rect.top)}px;` +
      'z-index:2147483645;min-width:170px;padding:3px 0;border-radius:6px;' +
      'background:var(--gb-bg-alt);color:var(--gb-fg);border:1px solid var(--gb-border);box-shadow:0 4px 14px rgba(0,0,0,.45)';
    const head = document.createElement('div');
    head.style.cssText = 'font-size:10px;color:var(--gb-accent);padding:2px 8px 4px;border-bottom:1px solid var(--gb-border-soft)';
    head.textContent = `GrepBot · ciudad ${townId}`;
    m.appendChild(head);
    m.appendChild(ctxItem('Atacar', 'Fija esta ciudad como objetivo del planificador de ataque', () => {
      applyAttackTarget({ id: +townId, town_id: +townId, kind: 'town' });
      showTab('attack');
      flash('objetivo fijado: ' + townId);
    }));
    m.appendChild(ctxItem('A la lista de vigilancia', 'Anade esta ciudad a la lista de vigilancia', () => {
      if (!Array.isArray(state.watchlist)) state.watchlist = [];
      if (state.watchlist.some(w => String((w && w.id) != null ? w.id : w) === String(townId))) { flash('ya estaba en la lista'); return; }
      state.watchlist.push({ id: String(townId) });
      save(STORE.WATCHLIST, state.watchlist);
      flash('anadida a vigilancia');
    }));
    m.appendChild(ctxItem('Nota de jugador...', 'Guarda una nota sobre el jugador de esta ciudad', () => {
      const who = prompt('Nombre del jugador para la nota:');
      if (!who) return;
      const note = prompt('Nota (vacio = borrar):', (state.playerNotes || {})[who] || '');
      if (note == null) return;
      intelSetNote(who, note);
      flash('nota guardada');
    }));
    m.appendChild(ctxItem('Nota de alianza...', 'Guarda una nota sobre la alianza', () => {
      const ally = prompt('Alianza para la nota:');
      if (!ally) return;
      const note = prompt('Nota (vacio = borrar):', (state.allianceNotes || {})[ally] || '');
      if (note == null) return;
      intelSetAllianceNote(ally, note);
      flash('nota de alianza guardada');
    }));
    m.appendChild(ctxItem('Abrir pestana Ataque', 'Abre el panel en la pestana de ataque', () => showTab('attack')));
    document.body.appendChild(m);
    try { applyTheme(); } catch (_) {}
    return m;
  }
  // Same trap nativeQctlHitCheck exists for: a stacking context can bury the
  // menu so clicks never reach it. Say so once rather than leaving dead buttons.
  function ctxHitCheck() {
    if (!ctxMenuEl || !ctxMenuEl.isConnected) return;
    try {
      const r = ctxMenuEl.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const hit = document.elementFromPoint(r.left + 4, r.top + 4);
      if (hit && (hit === ctxMenuEl || ctxMenuEl.contains(hit))) return;
      gbLogT('ctx-covered', 300000, 'context menu: covered by another element - clicks will not reach it');
    } catch (_) {}
  }
  function contextMenuScan() {
    ctxTimer = 0;
    try {
      if (state.contextMenu === false || !hostEnabled()) { ctxDispose(); return; }
      // Each pass costs a querySelectorAll plus getBoundingClientRect and
      // elementFromPoint - three forced layout flushes, 80x/min. The game popup
      // this menu anchors to cannot appear while the tab is hidden (it needs a
      // click), so there is nothing to find. Keep the existing menu mounted
      // rather than disposing: a hidden tab is not a closed popup, and the
      // re-arm in `finally` keeps the poll alive for the return to visible.
      if (document.hidden) return;
      const found = ctxFindPopup();
      if (!found) { ctxDispose(); return; }
      if (ctxMenuEl && ctxMenuTown === found.id && ctxMenuEl.isConnected) {
        // The game popup is draggable, so follow it rather than leaving the
        // menu stranded where the popup used to be.
        const left = Math.round(found.rect.right + 12) + 'px';
        const top = Math.round(found.rect.top) + 'px';
        if (ctxMenuEl.style.left !== left) ctxMenuEl.style.left = left;
        if (ctxMenuEl.style.top !== top) ctxMenuEl.style.top = top;
        ctxHitCheck();
        return;
      }
      ctxDispose();
      ctxMenuTown = found.id;
      ctxMenuEl = ctxBuild(found.id, found.rect);
      ctxHitCheck();
    } catch (e) {
      gbLogT('ctx-scan-err', 300000, 'context menu: ' + String(e).slice(0, 60));
    } finally {
      // Re-arm only after this scan settled, so a slow elementFromPoint cannot
      // stack scans on top of each other.
      if (!ctxTimer && gbInstanceAlive()) ctxTimer = gbTimeout(contextMenuScan, CTX_SCAN_MS);
    }
  }
  function contextMenuStart() {
    if (ctxTimer) return;
    ctxTimer = gbTimeout(contextMenuScan, CTX_SCAN_MS);
  }
