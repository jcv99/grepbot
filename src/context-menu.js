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

      if (n.closest('#grepbot-panel, #grepbot-queue-center, .gb-widget, .gb-ctx-menu')) continue;
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
    head.textContent = `GrepBot \u00b7 ciudad ${townId}`;
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

      if (document.hidden) return;
      const found = ctxFindPopup();
      if (!found) { ctxDispose(); return; }
      if (ctxMenuEl && ctxMenuTown === found.id && ctxMenuEl.isConnected) {

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

      if (!ctxTimer && gbInstanceAlive()) ctxTimer = gbTimeout(contextMenuScan, CTX_SCAN_MS);
    }
  }
  function contextMenuStart() {
    if (ctxTimer) return;
    ctxTimer = gbTimeout(contextMenuScan, CTX_SCAN_MS);
  }

  const HUD_TICK_MS = 1000;
