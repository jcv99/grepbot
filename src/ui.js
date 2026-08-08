  // ---------- sortable tables (Phase 3) ----------
  function makeSortable(table, rowDataFn) {
    const thead = table.querySelector('thead');
    if (!thead) return;
    thead.querySelectorAll('th').forEach((th, col) => {
      if (th.dataset.nosort) return;
      th.style.cursor = 'pointer';
      th.title = 'ordenar';
      th.addEventListener('click', () => {
        const tbody = table.querySelector('tbody') || table;
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const asc = th.dataset.sort !== 'asc';
        thead.querySelectorAll('th').forEach(h => delete h.dataset.sort);
        th.dataset.sort = asc ? 'asc' : 'desc';
        rows.sort((a, b) => {
          const av = rowDataFn(a, col), bv = rowDataFn(b, col);
          const an = parseFloat(av), bn = parseFloat(bv);
          const cmp = (!isNaN(an) && !isNaN(bn)) ? an - bn : String(av).localeCompare(String(bv));
          return asc ? cmp : -cmp;
        });
        rows.forEach(r => tbody.appendChild(r));
      });
    });
  }

  function renderSleepStatus() {
    const el = panel && panel.querySelector('#gb-sleep-status');
    if (!el) return;
    const sec = farmSleepDuration();
    const known = farmOptionFor(sec) != null;
    el.textContent = `${farmDurLabel(sec)} | ${known ? 'opción ' + farmOptionFor(sec) : 'sin aprender - recoge una vez ese temporizador en el juego'}` +
      ` | auto ${state.farmSleepAuto ? 'ON' : 'OFF'}${state.farmSleepDay ? ' | última ' + state.farmSleepDay : ''}`;
    el.style.color = known ? '#888' : '#fc6';
    try { renderFarmTeachBanner(); } catch (_) {}
  }
  // ---------- keyed table rendering (v1.4.0) ----------
  // renderFarms/renderWorld ran `replaceChildren()` on every scrape callback and
  // every 15s repaint: full table teardown, new nodes, new listeners, lost sort
  // order and lost scroll position. Rows are now keyed by id - the table is only
  // rebuilt when the id set itself changes, otherwise cells are patched in place
  // and untouched cells are never written.
  function tableShell(list, headers) {
    let table = list.querySelector('table');
    if (!table) {
      list.replaceChildren();
      table = document.createElement('table');
      const thead = document.createElement('thead');
      const trh = document.createElement('tr');
      headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        trh.appendChild(th);
      });
      thead.appendChild(trh);
      table.appendChild(thead);
      table.appendChild(document.createElement('tbody'));
      list.appendChild(table);
      makeSortable(table, (tr, col) => (tr.dataset.sort || '').split('\t')[col] || '');
    }
    return table;
  }
  function patchCells(tr, cells) {
    const tds = tr.children;
    for (let i = 0; i < cells.length; i++) {
      const td = tds[i];
      if (!td) continue;
      const c = cells[i];
      if (td.textContent !== c.text) td.textContent = c.text;
      const cls = c.cls || '';
      if (td.className !== cls) td.className = cls;
    }
  }
  function placeholder(list, text) {
    const e = document.createElement('div');
    e.style.cssText = 'color:#888;padding:6px 0;font-size:11px';
    e.textContent = text;
    list.replaceChildren(e);
  }
  function farmCells(f) {
    const r = state.farmResources[f.vill_id];
    return [
      { cls: 'id', text: String(f.vill_id) },
      { cls: '', text: r?.name || (f.notes || '').slice(0, 20) || '-' },
      { cls: '', text: r?.ok ? fmt(r.wood) : '-' },
      { cls: '', text: r?.ok ? fmt(r.stone) : '-' },
      { cls: '', text: r?.ok ? fmt(r.iron) : '-' },
      { cls: '', text: r?.ok && r.pop != null ? `${fmt(r.pop)}/${fmt(r.cap)}` : '-' },
      { cls: r ? (r.ok ? 'stale' : 'err') : 'stale',
        text: r ? (r.ok ? `${Math.round((Date.now() - r.ts) / 1000)}s` : (r.err || 'err')) : '-' },
    ];
  }
  function renderFarms() {
    renderSleepStatus();
    const list = panel.querySelector('.farms-list');
    if (!list) return;
    if (!state.farmsParsed.length) {
      if (!list.querySelector('div')) placeholder(list, 'aún no hay granjas - añade líneas vill_id abajo');
      return;
    }
    const table = tableShell(list, ['id', 'nombre', 'Ma', 'Pi', 'Pl', 'pob', 'visto', '']);
    const tbody = table.querySelector('tbody');
    // Membership, not order: a user-clicked column sort reorders the DOM rows
    // and must survive the next repaint.
    const wanted = state.farmsParsed.map(f => String(f.vill_id));
    const have = new Set(Array.from(tbody.children).map(tr => tr.dataset.key));
    const sameSet = have.size === wanted.length && wanted.every(k => have.has(k));
    if (!sameSet) tbody.replaceChildren();
    for (const f of state.farmsParsed) {
      const key = String(f.vill_id);
      const r = state.farmResources[f.vill_id];
      const t = state.thresholds[f.vill_id] || {};
      const cells = farmCells(f);
      let tr = sameSet ? tbody.querySelector(`tr[data-key="${key}"]`) : null;
      if (!tr) {
        tr = document.createElement('tr');
        tr.dataset.key = key;
        cells.forEach(() => tr.appendChild(document.createElement('td')));
        const actions = document.createElement('td');
        const thrBtn = document.createElement('button');
        thrBtn.textContent = 'UMB'; thrBtn.title = 'Fijar umbral';
        thrBtn.style.cssText = 'background:none;border:1px solid #555;color:#fc6;padding:1px 5px;cursor:pointer;font-size:11px';
        thrBtn.addEventListener('click', () => editThreshold(f));
        actions.appendChild(thrBtn);
        tr.appendChild(actions);
        tbody.appendChild(tr);
      }
      let alert = false;
      if (r && r.ok) {
        const over = (k) => t[k] != null && r[k] != null && r[k] >= t[k];
        alert = over('wood') || over('stone') || over('iron') || over('pop');
      }
      const cls = alert ? 'alert' : '';
      if (tr.className !== cls) tr.className = cls;
      const sort = [f.vill_id, r?.name || '', r?.wood ?? '', r?.stone ?? '', r?.iron ?? '', r?.pop ?? '', r?.ts ?? ''].join('\t');
      if (tr.dataset.sort !== sort) tr.dataset.sort = sort;
      patchCells(tr, cells);
    }
  }
  let _worldTotalsLast = '';
  function renderWorld() {
    const totals = panel.querySelector('.world-totals');
    const list = panel.querySelector('.world-list');
    if (!totals || !list) return;
    let w = 0, s = 0, i = 0, p = 0, okN = 0;
    for (const r of Object.values(state.townResources)) {
      if (!r || !r.ok) continue;
      okN++;
      if (r.wood != null) w += r.wood;
      if (r.stone != null) s += r.stone;
      if (r.iron != null) i += r.iron;
      if (r.pop != null) p += r.pop;
    }
    const head = `${state.towns.length} ciudades | ${okN} ok`;
    const res = `Madera ${fmt(w)} | Piedra ${fmt(s)} | Plata ${fmt(i)} | Pob ${fmt(p)}`;
    if (head + res !== _worldTotalsLast) {
      _worldTotalsLast = head + res;
      totals.replaceChildren();
      const totalsH = document.createElement('div');
      totalsH.style.cssText = 'font-weight:bold;color:#f5a623';
      totalsH.textContent = head;
      totals.appendChild(totalsH);
      const totalsR = document.createElement('div');
      totalsR.style.cssText = 'color:#cfc;margin-top:3px';
      totalsR.textContent = res;
      totals.appendChild(totalsR);
    }
    if (!state.towns.length) {
      if (!list.querySelector('div')) placeholder(list, 'aún no hay ciudades - pulsa Actualizar ciudades');
      return;
    }
    const table = tableShell(list, ['id', 'nombre', 'Ma', 'Pi', 'Pl', 'pob', 'visto']);
    const tbody = table.querySelector('tbody');
    const wanted = state.towns.map(t => String(t.id));
    const have = new Set(Array.from(tbody.children).map(tr => tr.dataset.key));
    const sameSet = have.size === wanted.length && wanted.every(k => have.has(k));
    if (!sameSet) tbody.replaceChildren();
    for (const t of state.towns) {
      const key = String(t.id);
      const r = state.townResources[t.id];
      const cells = [
        { cls: 'id', text: String(t.id) },
        { cls: '', text: t.name || '-' },
        { cls: '', text: r?.ok ? fmt(r.wood) : '-' },
        { cls: '', text: r?.ok ? fmt(r.stone) : '-' },
        { cls: '', text: r?.ok ? fmt(r.iron) : '-' },
        { cls: '', text: r?.ok && r.pop != null ? `${fmt(r.pop)}/${fmt(r.cap)}` : '-' },
        { cls: r ? (r.ok ? 'stale' : 'err') : 'stale',
          text: r ? (r.ok ? `${Math.round((Date.now() - r.ts) / 1000)}s` : (r.err || 'err')) : '-' },
      ];
      let tr = sameSet ? tbody.querySelector(`tr[data-key="${key}"]`) : null;
      if (!tr) {
        tr = document.createElement('tr');
        tr.dataset.key = key;
        cells.forEach(() => tr.appendChild(document.createElement('td')));
        tbody.appendChild(tr);
      }
      const sort = [t.id, t.name || '', r?.wood ?? '', r?.stone ?? '', r?.iron ?? '', r?.pop ?? '', r?.ts ?? ''].join('\t');
      if (tr.dataset.sort !== sort) tr.dataset.sort = sort;
      patchCells(tr, cells);
    }
  }
  function fmt(n) {
    if (n == null) return '-';
    if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
    if (n >= 1000) return Math.round(n/1000) + 'k';
    return String(n);
  }

  // ---------- UI ----------
  const PANEL_MIN_W = 360, PANEL_MIN_H = 200, PANEL_SQ = 40;
  const TAB_GROUPS = [
    { id: 'scout', label: 'Explorar', tabs: [
      { id: 'findings', label: 'Hallazgos' },
      { id: 'farms', label: 'Granjas' },
      { id: 'world', label: 'Mundo' },
    ]},
    { id: 'action', label: 'Acción', tabs: [
      { id: 'attack', label: 'Ataque' },
      { id: 'quests', label: 'Misiones' },
      { id: 'build', label: 'Construir' },
    ]},
    { id: 'account', label: 'Cuenta', tabs: [
      { id: 'overview', label: 'Resumen' },
      { id: 'intel', label: 'Intel' },
    ]},
    { id: 'system', label: 'Sistema', tabs: [
      { id: 'config', label: 'Config' },
      { id: 'stats', label: 'Estadísticas' },
      { id: 'log', label: 'Registro' },
    ]},
  ];
  const TAB_IDS = TAB_GROUPS.reduce((a, g) => { g.tabs.forEach(t => a.push(t.id)); return a; }, []);
  const _lastTabInGroup = {};
  let configBound = false;
  let findingsFilterEl = null;

  function tabGroupOf(tabId) {
    for (const g of TAB_GROUPS) {
      if (g.tabs.some(t => t.id === tabId)) return g;
    }
    return TAB_GROUPS[0];
  }

  function savePanelGeom() {
    if (!panel) return;
    const g = {
      left: panel.style.left || null,
      top: panel.style.top || null,
      right: panel.style.right || null,
      width: panel.classList.contains('collapsed') ? (state.panelGeom && state.panelGeom.width) || null : (panel.style.width || null),
      height: panel.classList.contains('collapsed') ? (state.panelGeom && state.panelGeom.height) || null : (panel.style.height || null),
      collapsed: panel.classList.contains('collapsed'),
    };
    state.panelGeom = g;
    save(STORE.PANEL_GEOM, g);
  }

  function applyPanelGeom(g) {
    if (!panel || !g) return;
    if (g.left != null) { panel.style.left = g.left; panel.style.right = 'auto'; }
    else if (g.right != null) { panel.style.right = g.right; panel.style.left = ''; }
    if (g.top != null) panel.style.top = g.top;
    if (g.width) panel.style.width = g.width;
    if (g.height) { panel.style.height = g.height; panel.style.maxHeight = 'none'; }
    if (g.collapsed) {
      panel.classList.add('collapsed');
      const btn = panel.querySelector('header button[data-act=toggle]');
      if (btn) btn.textContent = '[]';
    }
  }

  function resetPanelGeom() {
    panel.classList.remove('collapsed');
    panel.style.left = '';
    panel.style.top = '8px';
    panel.style.right = '8px';
    panel.style.width = '';
    panel.style.height = '';
    panel.style.maxHeight = '';
    const btn = panel.querySelector('header button[data-act=toggle]');
    if (btn) btn.textContent = '_';
    state.panelGeom = null;
    save(STORE.PANEL_GEOM, null);
    flash('panel reiniciado');
  }

  function paintNav(activeTab) {
    if (!panel) return;
    const group = tabGroupOf(activeTab);
    const nav = panel.querySelector('.gb-nav');
    const sub = panel.querySelector('.gb-subtabs');
    if (!nav || !sub) return;
    nav.replaceChildren();
    TAB_GROUPS.forEach(g => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.group = g.id;
      b.textContent = g.label;
      if (g.id === group.id) b.classList.add('on');
      b.addEventListener('click', () => {
        if (g.id === group.id) return;
        const prefer = _lastTabInGroup[g.id] || g.tabs[0].id;
        showTab(prefer);
      });
      nav.appendChild(b);
    });
    sub.replaceChildren();
    group.tabs.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.tab = t.id;
      b.textContent = t.label;
      if (t.id === activeTab) b.classList.add('on');
      b.addEventListener('click', () => showTab(t.id));
      sub.appendChild(b);
    });
  }

  function showTab(tabId, opts) {
    if (!panel) return;
    if (!TAB_IDS.includes(tabId)) tabId = 'findings';
    const force = !!(opts && opts.force);
    const same = state.activeTab === tabId && !force;
    const group = tabGroupOf(tabId);
    _lastTabInGroup[group.id] = tabId;
    state.activeTab = tabId;
    save(STORE.ACTIVE_TAB, tabId);
    paintNav(tabId);
    panel.querySelectorAll('section[data-tab]').forEach(s => {
      s.hidden = s.dataset.tab !== tabId;
    });
    if (same) {
      if (tabId === 'findings') renderFindings();
      else if (tabId === 'world') renderWorld();
      else if (tabId === 'build') renderBuild();
      else if (tabId === 'attack') renderAttack();
      else if (tabId === 'quests') renderQuests();
      else if (tabId === 'log') { renderLog(); renderJournal(); }
      else if (tabId === 'stats') renderStats();
      else if (tabId === 'overview') renderOverview();
      else if (tabId === 'intel') renderIntel();
      else if (tabId === 'farms') renderFarms();
      else if (tabId === 'config') { bindConfig(); renderCaveTowns(); }
      return;
    }
    if (tabId === 'findings') renderFindings();
    if (tabId === 'farms') renderFarms();
    if (tabId === 'world') renderWorld();
    if (tabId === 'build') {
      const el = panel.querySelector('#gb-ab-auto');
      if (el) el.checked = !!state.abAuto;
      renderBuild();
    }
    if (tabId === 'attack') { bindAttackTab(); renderAttack(); }
    if (tabId === 'quests') renderQuests();
    if (tabId === 'config') { bindConfig(); renderCaveTowns(); }
    if (tabId === 'overview') renderOverview();
    if (tabId === 'intel') renderIntel();
    if (tabId === 'log') { renderLog(); renderJournal(); }
    if (tabId === 'stats') renderStats();
  }

  GM_addStyle(`
    #grepbot-panel{position:fixed;top:8px;right:8px;width:420px;min-width:360px;max-height:70vh;z-index:2147483647;
      background:#1f1f1f;color:#eee;font:12px/1.4 monospace;border:1px solid #555;border-radius:6px;
      box-shadow:0 4px 16px rgba(0,0,0,.5);display:flex;flex-direction:column;visibility:visible !important;opacity:1 !important;
      box-sizing:border-box;}
    #grepbot-panel header{padding:6px 10px;background:#2a2a2a;cursor:move;display:flex;justify-content:space-between;align-items:center;flex-shrink:0}
    #grepbot-panel header b{color:#f5a623;font-weight:600}
    #grepbot-panel header button{background:none;border:1px solid #555;color:#eee;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:11px}
    #grepbot-panel .gb-nav{display:flex;gap:2px;padding:4px 6px 0;background:#262626;flex-shrink:0;border-bottom:1px solid #333}
    #grepbot-panel .gb-nav button{flex:0 0 auto;padding:5px 10px;background:transparent;border:0;border-bottom:2px solid transparent;color:#888;cursor:pointer;font:11px monospace}
    #grepbot-panel .gb-nav button:hover{color:#ccc}
    #grepbot-panel .gb-nav button.on{color:#f5a623;border-bottom-color:#f5a623}
    #grepbot-panel .gb-subtabs{display:flex;gap:2px;padding:4px 6px;background:#1a1a1a;border-bottom:1px solid #444;flex-shrink:0;overflow-x:auto}
    #grepbot-panel .gb-subtabs button{flex:0 0 auto;padding:4px 10px;background:#262626;border:1px solid #333;border-radius:3px;color:#aaa;cursor:pointer;font:11px monospace;white-space:nowrap}
    #grepbot-panel .gb-subtabs button:hover{color:#eee;border-color:#555}
    #grepbot-panel .gb-subtabs button.on{background:#333;color:#fff;border-color:#f5a623}
    #grepbot-panel section{padding:8px 10px;overflow:auto;flex:1;min-height:0}
    #grepbot-panel footer{padding:6px 10px;border-top:1px solid #444;display:flex;gap:8px;align-items:center;flex-shrink:0;position:relative}
    #grepbot-panel footer .gb-status-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;flex:1;min-width:0;font-size:10px}
    #grepbot-panel footer .gb-actions{position:relative;flex-shrink:0}
    #grepbot-panel footer .gb-actions > summary{list-style:none;cursor:pointer;background:#333;border:1px solid #555;color:#eee;padding:3px 8px;border-radius:3px;font-size:11px;user-select:none}
    #grepbot-panel footer .gb-actions > summary::-webkit-details-marker{display:none}
    #grepbot-panel footer .gb-actions-menu{position:absolute;right:0;bottom:calc(100% + 4px);min-width:140px;background:#262626;border:1px solid #555;border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,.5);display:flex;flex-direction:column;padding:4px;z-index:5}
    #grepbot-panel footer .gb-actions-menu button{background:transparent;border:0;color:#eee;padding:5px 8px;text-align:left;cursor:pointer;font:11px monospace;border-radius:2px}
    #grepbot-panel footer .gb-actions-menu button:hover{background:#333;color:#f5a623}
    #grepbot-panel textarea{width:100%;height:100%;min-height:180px;background:#111;color:#cfc;border:1px solid #333;font:11px/1.4 monospace;resize:vertical}
    #grepbot-panel .gb-resize{position:absolute;z-index:2;background:transparent;user-select:none}
    #grepbot-panel .gb-resize-n{top:-2px;left:8px;right:8px;height:8px;cursor:n-resize}
    #grepbot-panel .gb-resize-s{bottom:-2px;left:8px;right:8px;height:8px;cursor:s-resize}
    #grepbot-panel .gb-resize-e{right:-2px;top:8px;bottom:8px;width:8px;cursor:e-resize}
    #grepbot-panel .gb-resize-w{left:-2px;top:8px;bottom:8px;width:8px;cursor:w-resize}
    #grepbot-panel .gb-resize-ne,#grepbot-panel .gb-resize-nw,#grepbot-panel .gb-resize-se,#grepbot-panel .gb-resize-sw{width:12px;height:12px;z-index:3}
    #grepbot-panel .gb-resize-ne{top:-2px;right:-2px;cursor:ne-resize}
    #grepbot-panel .gb-resize-nw{top:-2px;left:-2px;cursor:nw-resize}
    #grepbot-panel .gb-resize-se{right:0;bottom:0;cursor:se-resize;
      background:linear-gradient(135deg,transparent 50%,#666 50%,#666 60%,transparent 60%,transparent 70%,#666 70%,#666 80%,transparent 80%)}
    #grepbot-panel .gb-resize-sw{bottom:-2px;left:-2px;cursor:sw-resize}
    #grepbot-panel.collapsed{width:${PANEL_SQ}px !important;height:${PANEL_SQ}px !important;max-height:none !important;min-width:0;min-height:0;
      overflow:hidden;padding:0;border-radius:6px;cursor:move}
    #grepbot-panel.collapsed header{padding:0;width:100%;height:100%;justify-content:center;align-items:center;border:0}
    #grepbot-panel.collapsed header b{display:none}
    #grepbot-panel.collapsed header button{border:0;padding:0;width:100%;height:100%;font-size:0;font-weight:700;color:#f5a623;border-radius:6px}
    #grepbot-panel.collapsed header button::before{content:"GB";display:block;font-size:11px;line-height:${PANEL_SQ}px}
    #grepbot-panel.collapsed .gb-nav,#grepbot-panel.collapsed .gb-subtabs,#grepbot-panel.collapsed section,#grepbot-panel.collapsed footer,#grepbot-panel.collapsed .gb-resize{display:none !important}
    #grepbot-panel .farms-list{margin-bottom:6px;max-height:200px;overflow:auto}
    #grepbot-panel .farms-list table{width:100%;border-collapse:collapse;font-size:10px}
    #grepbot-panel .farms-list th,#grepbot-panel .farms-list td{padding:2px 4px;border-bottom:1px solid #2a2a2a;text-align:right}
    #grepbot-panel .farms-list th{background:#262626;color:#aaa;text-align:left;font-weight:normal;position:sticky;top:0}
    #grepbot-panel .farms-list td.id{text-align:left;color:#6cf;font-family:monospace}
    #grepbot-panel .farms-list td.stale{color:#888}
    #grepbot-panel .farms-list td.err{color:#f55}
    #grepbot-panel .farms-list tr.alert td{background:rgba(255,80,80,.18);color:#faa}
    #grepbot-panel .farms-list tr.alert td.id{color:#f55;font-weight:bold}
    #grepbot-panel .world-list table{width:100%;border-collapse:collapse;font-size:10px}
    #grepbot-panel .world-list th,#grepbot-panel .world-list td{padding:2px 4px;border-bottom:1px solid #2a2a2a;text-align:right}
    #grepbot-panel .world-list th{background:#262626;color:#aaa;text-align:left;font-weight:normal;position:sticky;top:0}
    #grepbot-panel .world-list td.id{text-align:left;color:#6cf;font-family:monospace}
    #grepbot-panel .finding{padding:6px;border-bottom:1px solid #2a2a2a;font-size:11px}
    #grepbot-panel .finding .meta{color:#888;margin-bottom:3px}
    #grepbot-panel .finding .units{color:#6cf}
    #grepbot-panel .finding .res{color:#f96}
    /* log tab fills the panel: section is the flex column, list/journal take the slack */
    #grepbot-panel section[data-tab=log]{display:flex;flex-direction:column;overflow:hidden}
    #grepbot-panel section[data-tab=log][hidden]{display:none}
    #grepbot-panel .log-list{flex:1 1 auto;min-height:120px;overflow:auto;font-size:10px;white-space:pre-wrap;word-break:break-word;color:#9d9;background:#111;padding:4px;border:1px solid #333}
    #grepbot-panel .gb-logsub{display:flex;gap:4px;align-items:center;margin-bottom:4px;flex-shrink:0}
    #grepbot-panel .gb-logsub button{background:#262626;border:1px solid #333;color:#aaa;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px}
    #grepbot-panel .gb-logsub button.on{background:#333;color:#fff;border-color:#555}
    #grepbot-panel .gb-logsub input{flex:1;min-width:0;background:#111;color:#cfc;border:1px solid #333;font:10px monospace;padding:2px 4px}
    #grepbot-panel .jrn-head{font-size:10px;color:#888;margin-bottom:3px}
    #grepbot-panel .jrn-head b{color:#f96}
    #grepbot-panel .jrn-list{min-height:160px;max-height:250px;overflow:auto;font-size:10px;background:#111;border:1px solid #333;padding:2px}
    #grepbot-panel .jrn-list table{width:100%;border-collapse:collapse}
    #grepbot-panel .jrn-list td{padding:1px 3px;border-bottom:1px solid #2a2a2a;vertical-align:top}
    #grepbot-panel .jrn-list td.t{color:#666;white-space:nowrap}
    #grepbot-panel .jrn-list td.f{color:#6cf}
    #grepbot-panel .jrn-list td.a{color:#aaa;word-break:break-all}
    #grepbot-panel .jrn-list td.k{color:#888;text-align:right}
    #grepbot-panel .jrn-list td.r{text-align:right;white-space:nowrap}
    #grepbot-panel .jrn-list tr.ok td.r{color:#6dda7e}
    #grepbot-panel .jrn-list tr.skip td.r{color:#777}
    #grepbot-panel .jrn-list tr.err td.r{color:#f55}
    #grepbot-panel .jrn-btns{display:flex;gap:4px;margin-top:4px}
    #grepbot-panel .jrn-btns button{background:#333;border:1px solid #555;color:#eee;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px}
    #grepbot-panel .ib-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#555;transition:background .4s}
    #grepbot-panel .ib-dot.free{background:#4caf50}
    #grepbot-panel .ib-dot.paid{background:#f0c060}
    #grepbot-panel .ib-rows{max-height:240px;overflow:auto;font-size:10px}
    #grepbot-panel .ib-town{color:#888;font-size:9px;margin-top:4px;margin-bottom:1px}
    #grepbot-panel .ib-row{display:flex;justify-content:space-between;gap:12px;padding:2px 0;border-bottom:1px solid #2a2a2a}
    #grepbot-panel .ib-type{color:#aaa;flex:1}
    #grepbot-panel .ib-time{color:#888}
    #grepbot-panel .ib-cost{color:#f0c060;min-width:36px;text-align:right}
    #grepbot-panel .ib-free{color:#6dda7e;font-weight:bold;min-width:36px;text-align:right}
    #grepbot-panel #gb-ib-btn{background:#333;border:1px solid #555;color:#80e090;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:11px}
    #grepbot-panel #gb-ib-btn:disabled{opacity:.4;cursor:default}
    #grepbot-panel .ab-queue{max-height:220px;overflow:auto;margin-top:2px}
    #grepbot-panel .ab-plan{max-height:120px;overflow:auto;margin:2px 0 6px}
    #grepbot-panel .ab-plan-row{display:grid;grid-template-columns:1.2fr .4fr .8fr .6fr auto;gap:4px;align-items:center;padding:2px 0;border-bottom:1px solid #2a2a2a;font-size:10px}
    #grepbot-panel .ab-plan-row.pinned{background:#1a1a10}
    #grepbot-panel .ab-plan-row.custom{background:#101a1a}
    #grepbot-panel .cq-rows{max-height:140px;overflow:auto}
    #grepbot-panel .cq-row{display:grid;grid-template-columns:24px 1.2fr .5fr .6fr auto;gap:4px;align-items:center;padding:1px 0;border-bottom:1px solid #2a2a2a;font-size:10px}
    #grepbot-panel .atk-sched{max-height:160px;overflow:auto;margin-top:6px}
    #grepbot-panel .atk-sources{max-height:80px;overflow:auto;display:flex;flex-wrap:wrap;gap:4px 8px;margin:4px 0}
    #grepbot-panel .atk-roles{max-height:110px;overflow:auto;margin:4px 0}
    #grepbot-panel [data-atk="arrival-date"]{min-width:118px}
    #grepbot-panel [data-atk="arrival-time"]{min-width:96px}
    #grepbot-panel .atk-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:4px}
    #grepbot-panel .atk-row input,#grepbot-panel .atk-row select{background:#111;color:#cfc;border:1px solid #333;padding:2px 4px;font:11px monospace}
    #grepbot-panel .atk-btns button{background:#333;border:1px solid #555;color:#eee;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:11px;margin-right:4px}
    #grepbot-panel .atk-btns #gb-atk-now{color:#f96}
    #grepbot-panel .atk-btns #gb-atk-arm{color:#6cf}
    #grepbot-panel .quest-list{max-height:200px;overflow:auto;font-size:10px}
    #grepbot-panel .quest-row{display:grid;grid-template-columns:1.4fr .5fr 1fr .6fr;gap:4px;border-bottom:1px solid #2a2a2a;padding:3px 0}
    #grepbot-panel .quest-hist{max-height:100px;overflow:auto;font-size:9px;color:#9d9;margin-top:6px;background:#111;padding:4px;border:1px solid #333;white-space:pre-wrap}
  `);

  panel = document.createElement('div');
  panel.id = 'grepbot-panel';
  // Idempotent: dispose already removed old panel; drop stray duplicates if any
  document.querySelectorAll('#grepbot-panel').forEach(p => { try { p.remove(); } catch (_) {} });
  panel.style.zIndex = '2147483647';
  panel.innerHTML = `
    <header><b>GrepBot v${runningVersion()}</b><button data-act="toggle" title="Minimizar">_</button></header>
    <div class="gb-nav" role="tablist" aria-label="grupos de GrepBot"></div>
    <div class="gb-subtabs" role="tablist" aria-label="pestañas de GrepBot"></div>
    <section data-tab="findings"></section>
    <section data-tab="farms" hidden>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
        <button id="gb-sleep-claim" style="background:#333;border:1px solid #555;color:#8cf;padding:2px 8px;cursor:pointer;font-size:11px">Recogida nocturna (4h/8h)</button>
        <span id="gb-sleep-status" style="font-size:10px;color:#888"></span>
      </div>
      <div id="gb-farm-teach-banner" hidden style="font-size:10px;color:#fc6;background:#2a2211;border:1px solid #664;padding:4px 6px;margin-bottom:4px;border-radius:3px"></div>
      <div class="farms-list"></div>
      <textarea placeholder="vill_id | x y | ETA | notas&#10;12345 | 500 600 | 2h | segura"></textarea>
    </section>
    <section data-tab="world" hidden>
      <div class="world-totals" style="padding:6px;background:#262626;border-radius:3px;margin-bottom:6px;font-size:11px"></div>
      <div class="world-list"></div>
    </section>
    <section data-tab="attack" hidden>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <b style="font-size:11px;color:#f5a623">Sincronización de ataque</b>
        <span id="gb-atk-skew" style="font-size:9px;color:#888"></span>
        <span id="gb-atk-armed" style="font-size:10px;color:#f96;font-weight:bold;margin-left:auto"></span>
      </div>
      <div class="atk-row">
        <label>objetivo <input data-atk="target" style="width:70px" placeholder="id"/></label>
        <select data-atk="pick" title="ciudades de informes de espionaje / ataques recientes" style="max-width:130px;background:#111;color:#cfc;border:1px solid #333;font-size:10px"></select>
        <button type="button" id="gb-atk-current" title="Usar la ciudad seleccionada en el juego (mapa / ventana de ataque)" style="background:#333;border:1px solid #555;color:#6cf;padding:1px 6px;cursor:pointer;font-size:10px">Actual</button>
        <label>x <input data-atk="x" style="width:40px"/></label>
        <label>y <input data-atk="y" style="width:40px"/></label>
        <select data-atk="mission"><option value="attack">ataque</option><option value="support">apoyo</option><option value="raid">saqueo</option><option value="siege">asedio</option><option value="scout">espionaje</option><option value="revolt">revuelta</option><option value="portal">portal del olimpo</option></select>
      </div>
      <div id="gb-atk-target-hint" style="font-size:9px;color:#888;margin:-2px 0 4px"></div>
      <div class="atk-row atk-arrival-row">
        <select data-atk="timing"><option value="send_now">enviar ya</option><option value="arrive_at">llegar a las</option></select>
        <label>fecha <input data-atk="arrival-date" type="date" title="fecha de llegada (local)"/></label>
        <label>hora <input data-atk="arrival-time" type="time" step="1" title="hora de llegada (local, segundos)"/></label>
        <label>margen ms <input data-atk="pad" type="number" style="width:50px" value="200"/></label>
      </div>
      <div class="atk-row">
        <select data-atk="troop">
          <option value="offense">ofensivas</option>
          <option value="defense">defensivas</option>
          <option value="all">todas las tropas</option>
          <option value="all_of_type">todas de un tipo</option>
          <option value="harass">hostigar</option>
          <option value="per_town">editar por ciudad</option>
        </select>
        <label style="display:flex;align-items:center;gap:3px">unidad
          <select data-atk="unit-type" title="solo se usa cuando el modo de tropas es 'todas de un tipo'"></select>
        </label>
      </div>
      <div class="atk-harass" style="display:flex;gap:4px;flex-wrap:wrap;margin:4px 0">
        <span style="font-size:9px;color:#888;align-self:center">hostigar</span>
        <button type="button" data-harass="1sling" style="background:#333;border:1px solid #555;color:#eee;padding:1px 6px;cursor:pointer;font-size:10px">1 hondero</button>
        <button type="button" data-harass="5sling" style="background:#333;border:1px solid #555;color:#eee;padding:1px 6px;cursor:pointer;font-size:10px">5 honderos</button>
        <button type="button" data-harass="light" style="background:#333;border:1px solid #555;color:#eee;padding:1px 6px;cursor:pointer;font-size:10px">ligero (<=8)</button>
      </div>
      <div style="font-size:9px;color:#888;margin-top:2px">ciudades ofensivas / defensivas (guardado por mundo)</div>
      <div class="atk-roles"></div>
      <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-top:4px">
        <span style="font-size:9px;color:#888">atacar desde</span>
        <button type="button" id="gb-atk-src-all" style="background:#333;border:1px solid #555;color:#eee;padding:1px 6px;cursor:pointer;font-size:10px">Todas</button>
        <button type="button" id="gb-atk-src-none" style="background:#333;border:1px solid #555;color:#888;padding:1px 6px;cursor:pointer;font-size:10px">Ninguna</button>
        <button type="button" id="gb-atk-src-off" style="background:#333;border:1px solid #555;color:#f96;padding:1px 6px;cursor:pointer;font-size:10px">Ofensivas</button>
        <button type="button" id="gb-atk-src-def" style="background:#333;border:1px solid #555;color:#6cf;padding:1px 6px;cursor:pointer;font-size:10px">Defensivas</button>
      </div>
      <div class="atk-sources"></div>
      <div class="atk-pertown" hidden></div>
      <div class="atk-btns" style="margin-top:6px">
        <button id="gb-atk-preview">Vista previa</button>
        <button id="gb-atk-arm">Armar</button>
        <button id="gb-atk-cancel">Cancelar</button>
        <button id="gb-atk-now">Enviar ya</button>
      </div>
      <div class="atk-sched"></div>
      <div style="border-top:1px solid #333;margin:8px 0 4px;padding-top:6px;display:flex;align-items:center;gap:6px">
        <b style="font-size:11px;color:#f5a623">Salientes (cancelar)</b>
        <button type="button" id="gb-atk-cmds-refresh" style="background:#333;border:1px solid #555;color:#eee;padding:1px 6px;cursor:pointer;font-size:10px;margin-left:auto">Actualizar</button>
      </div>
      <div class="atk-cmds" style="max-height:120px;overflow:auto"></div>
      <div style="border-top:1px solid #333;margin:8px 0 4px;padding-top:6px;display:flex;align-items:center;gap:6px">
        <b style="font-size:11px;color:#f5a623">Héroes</b>
        <button type="button" id="gb-atk-heroes-refresh" style="background:#333;border:1px solid #555;color:#eee;padding:1px 6px;cursor:pointer;font-size:10px;margin-left:auto">Actualizar</button>
      </div>
      <div class="atk-heroes" style="max-height:160px;overflow:auto"></div>
    </section>
    <section data-tab="quests" hidden>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <b style="font-size:11px;color:#f5a623">Misiones</b>
        <button id="gb-quest-scan" style="background:#333;border:1px solid #555;color:#eee;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:11px;margin-left:auto">Escanear ya</button>
      </div>
      <div class="quest-list"></div>
      <div style="font-size:9px;color:#888;margin-top:6px">historial</div>
      <div class="quest-hist"></div>
    </section>
    <section data-tab="build" hidden>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span id="gb-ib-dot" class="ib-dot"></span><b style="font-size:11px;color:#f5a623">Construcción instantánea</b>
        <span style="flex:1"></span>
        <button id="gb-ib-btn">Completar todo lo gratis</button>
      </div>
      <div class="ib-rows"></div>
      <div id="gb-ib-status" style="font-size:10px;color:#888;margin-top:4px"></div>
      <div style="border-top:1px solid #333;margin:8px 0 6px;padding-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <b style="font-size:11px;color:#f5a623">Cola automática</b>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:10px"><input type="checkbox" id="gb-ab-auto"/> ON</label>
        <button id="gb-ab-csfast" style="background:#333;border:1px solid #555;color:#6cf;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px">Cargar CS-rápido</button>
        <button id="gb-ab-now" style="background:#333;border:1px solid #555;color:#80e090;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px">Encolar ya</button>
      </div>
      <div style="font-size:9px;color:#888;margin-bottom:4px">El modo automático solo rellena cuando queda <=1 orden: añade hasta 6 (o el máximo de la cola). El siguiente relleno espera mitad(tiempo de construcción)+5min+azar, no justo al terminar una construcción. Objetivos = actual/objetivo/máximo.</div>
      <div style="font-size:10px;color:#f5a623;margin:4px 0 2px">Próximas 3 <span style="color:#666;font-weight:normal">(primero la cola personalizada, luego la heurística)</span></div>
      <div class="ab-plan"></div>
      <div style="border-top:1px solid #333;margin:8px 0 4px;padding-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <b style="font-size:11px;color:#f5a623">Cola personalizada</b>
        <span id="gb-cq-town" style="font-size:10px;color:#888"></span>
        <span style="flex:1"></span>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:10px" title="Estricto: espera a la primera entrada en vez de construir saltándola"><input type="checkbox" id="gb-cq-strict"/> estricto</label>
        <button id="gb-cq-copy" style="background:#333;border:1px solid #555;color:#6cf;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px">Copiar a todas</button>
        <button id="gb-cq-clear" style="background:#333;border:1px solid #555;color:#f08080;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px">Vaciar</button>
      </div>
      <div class="cq-rows"></div>
      <div style="display:flex;align-items:center;gap:4px;margin:4px 0">
        <select id="gb-cq-b" style="background:#111;color:#cfc;border:1px solid #333;font:10px monospace"></select>
        <input id="gb-cq-lvl" type="number" min="1" style="width:48px;background:#111;color:#cfc;border:1px solid #333;font:10px monospace"/>
        <button id="gb-cq-add" style="background:#333;border:1px solid #555;color:#80e090;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px">Añadir</button>
        <span style="font-size:9px;color:#888">ordenada - se construye de arriba abajo, luego la heurística</span>
      </div>
      <div class="ab-queue"></div>
      <div id="gb-ab-status" style="font-size:10px;color:#888;margin-top:4px"></div>
    </section>
    <section data-tab="overview" hidden>
      <div style="font-size:11px;color:#f5a623;margin-bottom:4px">Resumen de la cuenta</div>
      <pre class="overview-panel" style="font-size:10px;white-space:pre-wrap;background:#111;padding:6px;border:1px solid #333;max-height:280px;overflow:auto;color:#cfc"></pre>
      <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
        <input id="gb-tpl-name" placeholder="nombre de plantilla" style="width:100px;background:#111;color:#cfc;border:1px solid #333;font-size:11px"/>
        <button id="gb-tpl-save" style="background:#333;border:1px solid #555;color:#eee;padding:2px 6px;cursor:pointer;font-size:10px">Guardar plantilla</button>
        <button id="gb-tpl-apply" style="background:#333;border:1px solid #555;color:#6cf;padding:2px 6px;cursor:pointer;font-size:10px">Aplicar plantilla</button>
        <button id="gb-cfg-export" style="background:#333;border:1px solid #555;color:#9d9;padding:2px 6px;cursor:pointer;font-size:10px">Exportar config</button>
        <button id="gb-cfg-import" style="background:#333;border:1px solid #555;color:#fc6;padding:2px 6px;cursor:pointer;font-size:10px">Importar config</button>
      </div>
    </section>
    <section data-tab="intel" hidden>
      <div style="font-size:11px;color:#f5a623;margin-bottom:4px">Intel / amenazas</div>
      <pre class="intel-panel" style="font-size:10px;white-space:pre-wrap;background:#111;padding:6px;border:1px solid #333;max-height:280px;overflow:auto;color:#cfc"></pre>
      <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <input id="gb-note-player" placeholder="jugador" style="width:80px;background:#111;color:#cfc;border:1px solid #333;font-size:11px"/>
        <input id="gb-note-text" placeholder="nota" maxlength="200" style="flex:1;background:#111;color:#cfc;border:1px solid #333;font-size:11px"/>
        <button id="gb-note-save" style="background:#333;border:1px solid #555;color:#eee;padding:2px 6px;cursor:pointer;font-size:10px">Guardar nota</button>
      </div>
      <div style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <input id="gb-ally-name" placeholder="alianza" style="width:80px;background:#111;color:#cfc;border:1px solid #333;font-size:11px"/>
        <input id="gb-ally-note" placeholder="nota de alianza" maxlength="200" style="flex:1;background:#111;color:#cfc;border:1px solid #333;font-size:11px"/>
        <button id="gb-ally-save" style="background:#333;border:1px solid #555;color:#eee;padding:2px 6px;cursor:pointer;font-size:10px">Guardar nota de alianza</button>
      </div>
    </section>
    <section data-tab="config" hidden>
      <div class="config-panel" style="font-size:11px;display:flex;flex-direction:column;gap:8px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="enabled-host"/> Activar en <span class="cfg-host"></span></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-collect"/> Auto-recoger botón Recoger (DOM)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="collect-all"/> Recoger todo (ignorar límite de temporizador)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-bandit"/> Auto-bandidos</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-farm"/> Auto-granjas</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px"><input type="checkbox" data-cfg="farm-skip-full"/> Saltar granja/bandidos si el almacén está lleno</label>
        <label style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-wrap:wrap">Modo de almacén lleno
          <select data-cfg="farm-full-mode" style="background:#111;color:#cfc;border:1px solid #333;margin-left:6px">
            <option value="any">1 recurso lleno</option>
            <option value="all">los 3 recursos llenos</option>
          </select>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px"><input type="checkbox" data-cfg="farm-long-claims"/> Recogidas de 10min donde esté investigada la lealtad de aldeanos</label>
        <label style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-wrap:wrap">Clave de la investigación de lealtad
          <input data-cfg="farm-loyalty-tech" placeholder="auto-detectar (id del servidor o nombre)" title="Id de investigación del servidor (p.ej. rural_loyalty) o el nombre localizado de la academia. La pestaña Registro vuelca pares id(nombre) cuando falla la auto-detección." style="width:190px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/>
        </label>
        <label style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-wrap:wrap">Duración de la recogida nocturna
          <select data-cfg="farm-sleep-dur" style="background:#111;color:#cfc;border:1px solid #333;margin-left:6px">
            <option value="auto">auto (8h si se conoce, si no 4h)</option>
            <option value="14400">4 h</option>
            <option value="28800">8 h</option>
          </select>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px"><input type="checkbox" data-cfg="farm-sleep-auto"/> Recogida nocturna automática (1/día, debe acabar antes de las 24:00)</label>
        <label style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-wrap:wrap">Llenado máximo del almacén para la recogida nocturna %
          <input type="number" data-cfg="farm-sleep-fill" min="10" max="95" style="width:60px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/>
        </label>
        <div id="gb-farm-optmap" style="margin-left:12px;font-size:10px;color:#888"></div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-build"/> Construcciones instantáneas gratis</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="instant-research"/> Investigación instantánea gratis (academia)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-queue"/> Encolar construcciones automáticamente</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-quest-build"/> Reclamar auto. el descuento de construcción de misiones</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-quest-res"/> Reclamar auto. recursos/favor de misiones</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-cave"/> Auto-cueva (guardar plata sobrante)</label>
        <label style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-wrap:wrap">Cueva cuando la plata >= % del almacén
          <input type="number" data-cfg="cave-thresh" min="50" max="99" style="width:50px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/>
        </label>
        <div style="margin-left:12px;font-size:10px;color:#888">Por ciudad (sin marcar = saltar esa ciudad):</div>
        <div class="cave-towns" style="display:flex;flex-direction:column;gap:2px;max-height:120px;overflow:auto"></div>
        <div style="border-top:1px solid #333;padding-top:6px;color:#f5a623;font-size:10px">Economía (fase 8+)</div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-culture"/> Auto-cultura</label>
        <label style="margin-left:12px;display:flex;gap:8px;flex-wrap:wrap;font-size:10px">
          <label><input type="checkbox" data-cfg="cult-festival"/> fiesta</label>
          <label><input type="checkbox" data-cfg="cult-procession"/> procesión</label>
          <label><input type="checkbox" data-cfg="cult-theater"/> teatro</label>
          <label><input type="checkbox" data-cfg="cult-olympic"/> juegos olímpicos</label>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px;color:#f96"><input type="checkbox" data-cfg="allow-premium-culture"/> Permitir cultura de pago (olímpicos = 50 oro)</label>
        <label style="margin-left:12px;flex-wrap:wrap;font-size:10px">Presupuesto diario de oro para olímpicos
          <input type="number" data-cfg="culture-gold-budget" min="0" max="500" step="50" style="width:60px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-trade"/> Comercio entre ciudades (llenar almacén)</label>
        <label style="margin-left:12px;flex-wrap:wrap">Preajuste
          <select data-cfg="trade-preset" style="background:#111;color:#cfc;border:1px solid #333;margin-left:4px">
            <option value="storage">almacén</option>
            <option value="party">fiesta (financiar cultura)</option>
            <option value="unit">unidades (financiar reclutamiento)</option>
          </select>
          Reserva % <input type="number" data-cfg="trade-reserve" min="0" max="80" style="width:45px;background:#111;color:#cfc;border:1px solid #333"/>
          Lote mínimo <input type="number" data-cfg="trade-min" min="100" max="50000" step="100" style="width:60px;background:#111;color:#cfc;border:1px solid #333"/>
          Saltos máx. entre islas <input type="number" data-cfg="trade-max-hops" min="0" max="200" step="1" title="Rechaza llenar almacén entre islas más lejanas que esto (0 = solo la misma isla). Una isla ilegible nunca bloquea." style="width:45px;background:#111;color:#cfc;border:1px solid #333"/>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="island-ship"/> Envío de recursos continente-&gt;isla</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-rural-trade"/> Comercio con aldeas de granjeros</label>
        <label style="margin-left:12px;flex-wrap:wrap">Ratio mínimo <input type="number" data-cfg="rural-ratio" step="0.25" min="0.25" max="2" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/>
          Recurso <select data-cfg="rural-res" style="background:#111;color:#cfc;border:1px solid #333"><option value="iron">plata</option><option value="stone">piedra</option><option value="wood">madera</option></select>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-rural-level"/> Mejora de aldeas de granjeros</label>
        <label style="margin-left:12px">Nivel máx. <input type="number" data-cfg="rural-level-max" min="1" max="6" style="width:40px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-research"/> Auto-investigación</label>
        <button data-cfg="research-csfast" style="align-self:flex-start;margin-left:12px;background:#333;border:1px solid #555;color:#6cf;padding:2px 6px;cursor:pointer;font-size:10px">Cargar investigación CS-rápido</button>
        <div style="border-top:1px solid #333;padding-top:6px;color:#f5a623;font-size:10px">Comodidad / supervivencia</div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="pause-activity"/> Pausar cuando yo esté activo</label>
        <label style="margin-left:12px">Min. de pausa <input type="number" data-cfg="pause-ms" min="1" max="60" style="width:40px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="night-pause"/> Pausa nocturna</label>
        <label style="margin-left:12px">Horas <input type="number" data-cfg="night-start" min="0" max="23" style="width:40px;background:#111;color:#cfc;border:1px solid #333"/>-<input type="number" data-cfg="night-end" min="0" max="23" style="width:40px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Registra cada payload que el bot enviaría y no envía nada. Úsalo para comparar los payloads del bot con una acción hecha a mano antes de activar una función arriesgada."><input type="checkbox" data-cfg="dry-run"/> <b style="color:#6cf">Simulacro (registra payloads, no envía nada)</b></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Una función que no encuentra nada que hacer duplica su propio intervalo (hasta 8x) hasta que vuelve a actuar."><input type="checkbox" data-cfg="orch-adaptive"/> Cadencia adaptativa (frenar funciones ociosas)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Cuando un almacén se queda lleno, adelanta cueva→comercio→aldeas por delante de la granja y desactiva el frenado por ociosidad en esa ruta de vaciado."><input type="checkbox" data-cfg="orch-deadlock"/> Resolver atasco de almacén</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Copiar/Exportar sustituyen nombres e ids de jugadores por hashes cortos. Desactívalo solo para depurar en local."><input type="checkbox" data-cfg="export-redact"/> Ocultar nombres/ids en Copiar + Exportar</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="captcha-global"/> Parada total global por captcha</label>
        <label>Espera tras captcha (min) <input type="text" data-cfg="captcha-ladder" placeholder="5,15,60" title="Minutos separados por comas; mínimo 1 cada uno. El mínimo impide desactivar el cortacircuitos." style="width:100px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/></label>
        <button type="button" data-cfg="captcha-clear" style="align-self:flex-start;background:#333;border:1px solid #555;color:#fc6;padding:2px 6px;cursor:pointer;font-size:10px">Limpiar pausas por captcha</button>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Salta una acción que ha fallado igual 3 veces seguidas (espera 5/15/60min). El diario sigue registrando igualmente."><input type="checkbox" data-cfg="decision-memory"/> Memoria de decisiones (saltar fallos repetidos)</label>
        <label>Presupuesto de peticiones / min <input type="number" data-cfg="req-budget" min="5" max="120" style="width:50px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/>
          Umbral blando % <input type="number" data-cfg="posts-soft" min="20" max="95" title="Retrasa (no rechaza) cuando los envíos del último minuto superan este % del presupuesto duro" style="width:45px;background:#111;color:#cfc;border:1px solid #333;margin-left:4px"/></label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:10px">
          Preajustes
          <button type="button" data-preset="afk" style="background:#333;border:1px solid #555;color:#8cf;padding:2px 6px;cursor:pointer">AFK nocturno</button>
          <button type="button" data-preset="farm" style="background:#333;border:1px solid #555;color:#8cf;padding:2px 6px;cursor:pointer">Granjeo activo</button>
          <button type="button" data-preset="war" style="background:#333;border:1px solid #555;color:#fc6;padding:2px 6px;cursor:pointer">Guerra</button>
          <button type="button" data-preset="undo" style="background:#333;border:1px solid #555;color:#aaa;padding:2px 6px;cursor:pointer">Deshacer preajuste</button>
        </div>
        <button type="button" data-cfg="storage-prune" style="align-self:flex-start;background:#333;border:1px solid #555;color:#fc6;padding:2px 6px;cursor:pointer;font-size:10px">Purgar vistos/alertados (almacenamiento)</button>
        <label>URL del webhook <input type="text" data-cfg="webhook-url" placeholder="webhook de Discord o https://api.telegram.org/bot.../sendMessage" style="width:100%;background:#111;color:#cfc;border:1px solid #333;margin-top:2px;font-size:10px"/></label>
        <label style="margin-left:0;display:flex;gap:8px;flex-wrap:wrap;font-size:10px">Eventos
          <label><input type="checkbox" data-cfg="wh-captcha"/> captcha</label>
          <label><input type="checkbox" data-cfg="wh-attack"/> ataque</label>
          <label><input type="checkbox" data-cfg="wh-pattern"/> patrón (3×/24h)</label>
          <label><input type="checkbox" data-cfg="wh-warehouse"/> almacén</label>
          <label><input type="checkbox" data-cfg="wh-culture"/> cultura</label>
        </label>
        <label>chat_id de Telegram <input type="text" data-cfg="wh-tg-chat" placeholder="opcional si no está en la URL" style="width:140px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px;font-size:10px"/></label>
        <div style="border-top:1px solid #333;padding-top:6px;color:#f96;font-size:10px">ALTO RIESGO (por defecto OFF)</div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-merchant"/> Francotirador del mercader</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Las ofertas de recursos del barco mercante empiezan en 0.5:1 y suben +0.1 por trato. Bombea con tratos de 1 unidad y luego envía el trato grande a 1:1."><input type="checkbox" data-cfg="auto-pt-trade"/> Bombeo del ratio del barco mercante</label>
        <label style="margin-left:12px;font-size:10px">ratio objetivo <input type="number" step="0.1" min="0.5" max="2" data-cfg="pt-ratio" style="width:52px;background:#111;color:#cfc;border:1px solid #333"/>
          cantidad de bombeo <input type="number" min="1" max="100" data-cfg="pt-pump" style="width:52px;background:#111;color:#cfc;border:1px solid #333"/>
          bombeos máx. <input type="number" min="0" max="20" data-cfg="pt-maxpumps" style="width:52px;background:#111;color:#cfc;border:1px solid #333"/>
          reserva % <input type="number" min="0" max="90" data-cfg="pt-reserve" style="width:52px;background:#111;color:#cfc;border:1px solid #333"/>
        </label>
        <label style="margin-left:12px;display:flex;gap:8px;flex-wrap:wrap;font-size:10px">recibir
          <label><input type="checkbox" data-cfg="pt-want-wood"/> madera</label>
          <label><input type="checkbox" data-cfg="pt-want-stone"/> piedra</label>
          <label><input type="checkbox" data-cfg="pt-want-iron"/> plata</label>
        </label>
        <div style="margin-left:12px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span id="gb-pt-status" style="font-size:10px;color:#888"></span>
          <button data-cfg="pt-now" style="background:#333;border:1px solid #555;color:#80e090;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px">Bombear + comerciar ya</button>
          <button data-cfg="pt-copy" title="Copia el HTML de la ventana del mercader abierta - hace falta una vez para confirmar el analizador de ofertas" style="background:#333;border:1px solid #555;color:#6cf;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px">Copiar HTML de la oferta</button>
        </div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-favor"/> Granjeo de favor (enviado divino)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-wonder"/> Donaciones a la Maravilla</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Gasta favor en la maravilla de la alianza. Requiere haber capturado wonderFavorTpl. Por defecto OFF."><input type="checkbox" data-cfg="auto-wonder-favor"/> Lanzar favor en la Maravilla (captura el poder antes)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="cs-alert"/> Alertas de BC / ataques entrantes</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-militia"/> Auto-milicia ante ataques entrantes</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-dodge"/> Auto-esquiva</label>
        <label style="margin-left:12px">Modo <select data-cfg="dodge-mode" style="background:#111;color:#cfc;border:1px solid #333"><option value="notify">solo avisar</option><option value="auto">enviar auto.</option></select>
          Mínimo <input type="number" data-cfg="dodge-floor" min="0" max="500" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-recruit"/> Auto-reclutamiento</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px"><input type="checkbox" data-cfg="recruit-spells"/> Lanzar primero hechizos de reclutamiento</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="grepodata"/> Asistencia de Grepodata Index+</label>
        <label>Umbral de construcción instantánea gratis (seg) <input type="number" data-cfg="ib-free-thresh" min="60" max="600" style="width:70px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/></label>
        <label>Minutos máx. para recoger <input type="number" data-cfg="collect-max-min" min="1" max="120" style="width:70px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/></label>
        <label>Cadencia de granjas mín-máx (min) <input type="number" data-cfg="farm-min" min="1" max="60" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/> - <input type="number" data-cfg="farm-max" min="1" max="60" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label>Cadencia de ciudades mín-máx (min) <input type="number" data-cfg="town-min" min="1" max="60" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/> - <input type="number" data-cfg="town-max" min="1" max="60" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <button data-cfg="clear-captcha" style="align-self:flex-start;background:#333;border:1px solid #555;color:#f96;padding:3px 8px;cursor:pointer;font-size:11px">Limpiar cortacircuitos de captcha</button>
      </div>
    </section>
    <section data-tab="stats" hidden>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
        <b style="font-size:11px;color:#f5a623">Estadísticas</b>
        <button data-stats="1h" style="background:#262626;border:1px solid #333;color:#aaa;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">1h</button>
        <button data-stats="24h" class="on" style="background:#333;border:1px solid #555;color:#fff;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">24h</button>
        <button data-stats="7d" style="background:#262626;border:1px solid #333;color:#aaa;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">7d</button>
        <span style="flex:1"></span>
        <button id="gb-preflight" title="Sondeo de solo lectura de cada módulo: colecciones, claves de acción aprendidas, payloads hipotéticos. No envía nada." style="background:#333;border:1px solid #555;color:#6cf;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">Comprobación</button>
      </div>
      <pre class="stats-body" style="font-size:10px;white-space:pre-wrap;background:#111;padding:6px;border:1px solid #333;max-height:320px;overflow:auto;color:#cfc"></pre>
    </section>
    <section data-tab="log" hidden>
      <div class="gb-logsub">
        <button data-logsub="live" class="on">Registro en vivo</button>
        <button data-logsub="mem">Decisiones</button>
        <button type="button" data-act="copy-log" title="Copiar todo el registro en vivo al portapapeles (hasta 200 líneas)">Copiar registro</button>
        <button type="button" data-act="evidence" title="Instantánea de solo lectura y anonimizada para las validaciones de TASKS. Copia JSON. No envía nada.">Evidencia</button>
        <input class="jrn-filter" placeholder="filtrar función/acción/objetivo"/>
      </div>
      <div class="log-list"></div>
      <div class="jrn-pane" hidden>
        <div class="jrn-head"></div>
        <div class="jrn-list"></div>
        <div class="jrn-btns">
          <button data-jrn="copy">Copiar JSON</button>
          <button data-jrn="clear-skips">Limpiar saltos</button>
          <button data-jrn="clear">Vaciar diario</button>
        </div>
      </div>
    </section>
    <footer>
      <div class="gb-status-row">
        <span id="gb-next-farms" style="color:#6cf"></span>
        <span id="gb-next-towns" style="color:#fc6"></span>
        <span id="gb-last-action" style="color:#8c8"></span>
        <span id="gb-collect-state" style="color:#f96;font-weight:bold"></span>
        <span id="gb-status" style="color:#888"></span>
      </div>
      <details class="gb-actions">
        <summary>Acciones</summary>
        <div class="gb-actions-menu">
          <button type="button" data-act="copy">Copiar JSON</button>
          <button type="button" data-act="export">Exportar</button>
          <button type="button" data-act="refresh">Actualizar ciudades</button>
          <button type="button" data-act="scrape-farms">Granjas ya</button>
          <button type="button" data-act="scrape-towns">Ciudades ya</button>
          <button type="button" data-act="diag">Diag</button>
          <button type="button" data-act="evidence" title="Instantánea de solo lectura y anonimizada para las validaciones de TASKS">Evidencia</button>
          <button type="button" data-act="preflight">Comprobación</button>
          <button type="button" data-act="clear">Borrar hallazgos</button>
          <button type="button" data-act="reset-pos" title="Restablecer la posición del panel">Restablecer posición</button>
        </div>
      </details>
    </footer>
  `;
  document.body.appendChild(panel);
  ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach(dir => {
    const h = document.createElement('div');
    h.className = 'gb-resize gb-resize-' + dir;
    h.dataset.dir = dir;
    h.title = 'Redimensionar';
    panel.appendChild(h);
  });
  applyPanelGeom(state.panelGeom);

  // paint nav shell; full showTab runs after bindConfig / filter lets below
  {
    const start = TAB_IDS.includes(state.activeTab) ? state.activeTab : 'findings';
    const g0 = tabGroupOf(start);
    _lastTabInGroup[g0.id] = start;
    paintNav(start);
    panel.querySelectorAll('section[data-tab]').forEach(s => {
      s.hidden = s.dataset.tab !== start;
    });
  }
  // close Actions menu after a pick
  panel.querySelector('.gb-actions')?.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('button[data-act]');
    if (!btn) return;
    const det = panel.querySelector('.gb-actions');
    if (det) det.open = false;
  });

  // Log tab sub-views: live ring buffer vs the persisted decision journal
  // [data-logsub] only - the Copiar registro / Evidencia buttons live in the
  // same row but must not switch sub-view or steal the .on highlight
  panel.querySelectorAll('.gb-logsub button[data-logsub]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mem = btn.dataset.logsub === 'mem';
      panel.querySelectorAll('.gb-logsub button[data-logsub]').forEach(b => b.classList.toggle('on', b === btn));
      const live = panel.querySelector('.log-list');
      const pane = panel.querySelector('.jrn-pane');
      if (live) live.hidden = mem;
      if (pane) pane.hidden = !mem;
      if (mem) renderJournal(); else renderLog();
    });
  });
  panel.querySelectorAll('[data-stats]').forEach(btn => {
    btn.addEventListener('click', () => {
      statsWindow = btn.dataset.stats;
      panel.querySelectorAll('[data-stats]').forEach(b => {
        const on = b === btn;
        b.classList.toggle('on', on);
        b.style.background = on ? '#333' : '#262626';
        b.style.color = on ? '#fff' : '#aaa';
        b.style.borderColor = on ? '#555' : '#333';
      });
      renderStats();
    });
  });
  panel.querySelector('#gb-preflight')?.addEventListener('click', () => preflightRunAndRender());
  panel.querySelector('.jrn-filter')?.addEventListener('input', () => journalFilterDebounced());
  panel.querySelector('[data-jrn=copy]')?.addEventListener('click', () => {
    const text = JSON.stringify({ decisions: state.decisions, skips: state.decisionSkips }, null, 2);
    navigator.clipboard.writeText(text).then(() => flash('diario copiado')).catch(() => flash('fallo al copiar'));
  });
  panel.querySelector('[data-jrn=clear-skips]')?.addEventListener('click', () => {
    jrnClearSkips();
    renderJournal();
  });
  panel.querySelector('[data-jrn=clear]')?.addEventListener('click', () => {
    if (!confirm('¿Vaciar el diario de decisiones de ' + location.host + '?')) return;
    jrnClear();
    renderJournal();
  });

  panel.querySelector('#gb-tpl-save')?.addEventListener('click', () => {
    const n = panel.querySelector('#gb-tpl-name')?.value?.trim();
    if (n) qolSaveTemplate(n);
  });
  panel.querySelector('#gb-tpl-apply')?.addEventListener('click', () => {
    const n = panel.querySelector('#gb-tpl-name')?.value?.trim();
    if (n) qolApplyTemplate(n);
  });
  panel.querySelector('#gb-cfg-export')?.addEventListener('click', () => {
    const text = JSON.stringify(qolExportConfig(), null, 2);
    navigator.clipboard.writeText(text).then(() => flash('config copiada')).catch(() => flash('fallo al copiar'));
  });
  panel.querySelector('#gb-cfg-import')?.addEventListener('click', () => {
    const raw = prompt('Pega el JSON de configuración de GrepBot');
    if (!raw) return;
    try {
      if (qolImportConfig(JSON.parse(raw))) flash('config importada');
      else flash('fallo al importar');
    } catch (e) { flash('JSON inválido'); }
  });
  panel.querySelector('#gb-note-save')?.addEventListener('click', () => {
    const p = panel.querySelector('#gb-note-player')?.value?.trim();
    const n = panel.querySelector('#gb-note-text')?.value?.trim();
    if (p) { intelSetNote(p, n); renderIntel(); flash('nota guardada'); }
  });
  panel.querySelector('#gb-ally-save')?.addEventListener('click', () => {
    const a = panel.querySelector('#gb-ally-name')?.value?.trim();
    const n = panel.querySelector('#gb-ally-note')?.value?.trim();
    if (a) { intelSetAllianceNote(a, n); renderIntel(); flash('nota de alianza guardada'); }
  });
  panel.querySelector('#gb-quest-scan')?.addEventListener('click', () => {
    questScanTick('manual');
    gbTimeout(renderQuests, 600);
  });
  panel.querySelector('footer button[data-act=refresh]').addEventListener('click', () => {
    fetchOwnedTowns();
    state.towns.forEach((t, i) => gbTimeout(() => fetchTownResources(t), i * 600));
  });
  panel.querySelector('header button[data-act=toggle]').addEventListener('click', (e) => {
    e.stopPropagation();
    const collapsing = !panel.classList.contains('collapsed');
    if (collapsing) {
      // remember expanded size before CSS forces 40x40
      const w = panel.style.width || (panel.offsetWidth + 'px');
      const h = panel.style.height || (panel.offsetHeight + 'px');
      if (!state.panelGeom) state.panelGeom = {};
      state.panelGeom.width = w;
      state.panelGeom.height = h;
      panel.classList.add('collapsed');
    } else {
      panel.classList.remove('collapsed');
      if (state.panelGeom && state.panelGeom.width) panel.style.width = state.panelGeom.width;
      if (state.panelGeom && state.panelGeom.height) {
        panel.style.height = state.panelGeom.height;
        panel.style.maxHeight = 'none';
      }
    }
    const btn = panel.querySelector('header button[data-act=toggle]');
    btn.textContent = panel.classList.contains('collapsed') ? '[]' : '_';
    btn.title = panel.classList.contains('collapsed') ? 'Restaurar' : 'Minimizar';
    savePanelGeom();
  });
  panel.querySelector('#gb-ib-btn').addEventListener('click', () => {
    if (gbLocked('ib')) return;
    ibCompleteAll(ibOrders());
  });
  panel.querySelector('#gb-ab-auto')?.addEventListener('change', e => {
    state.abAuto = e.target.checked; save(STORE.AB_AUTO, state.abAuto);
    gbLog('auto-queue', state.abAuto ? 'ON' : 'OFF');
    const cfg = panel.querySelector('[data-cfg=auto-queue]'); if (cfg) cfg.checked = state.abAuto;
    if (state.abAuto) abScan('toggle');
    renderAbQueue();
  });
  panel.querySelector('#gb-ab-csfast')?.addEventListener('click', () => { abLoadCsFast(); flash('objetivos CS-rápido'); });
  panel.querySelector('#gb-cq-b')?.addEventListener('change', () => renderCqRows());
  panel.querySelector('#gb-cq-strict')?.addEventListener('change', e => {
    state.abQueueStrict = e.target.checked;
    save(STORE.AB_QUEUE_STRICT, state.abQueueStrict);
    gbLog('auto-queue: strict order', state.abQueueStrict ? 'ON' : 'OFF');
  });
  panel.querySelector('#gb-cq-add')?.addEventListener('click', () => {
    const townId = abCurrentTownId() || abTownIds()[0];
    if (!townId) { flash('sin ciudad'); return; }
    const b = panel.querySelector('#gb-cq-b')?.value;
    const lvlEl = panel.querySelector('#gb-cq-lvl');
    const lvl = lvlEl && lvlEl.value !== '' ? +lvlEl.value : null;
    abCqAdd(townId, b, lvl);
    renderCqRows();
    renderAbPlan();
  });
  panel.querySelector('#gb-cq-clear')?.addEventListener('click', () => {
    const townId = abCurrentTownId() || abTownIds()[0];
    if (!townId) return;
    abCqSet(townId, []);
    renderCqRows();
    renderAbPlan();
  });
  panel.querySelector('#gb-cq-copy')?.addEventListener('click', () => {
    const townId = abCurrentTownId() || abTownIds()[0];
    if (!townId) return;
    const list = abCqGet(townId);
    if (!list.length) { flash('cola vacía'); return; }
    if (!confirm(`¿Copiar esta cola de ${list.length} entradas a TODAS las ciudades? Se reemplazan las colas personalizadas existentes.`)) return;
    abTownIds().forEach(id => { if (String(id) !== String(townId)) abCqSet(id, list.map(e => ({ b: e.b, lvl: e.lvl }))); });
    gbLog(`auto-queue: custom queue copied to ${abTownIds().length} town(s)`);
    flash('cola copiada');
  });
  panel.querySelector('#gb-ab-now')?.addEventListener('click', () => {
    const was = state.abAuto;
    if (!was) { state.abAuto = true; save(STORE.AB_AUTO, true); }
    const el = panel.querySelector('#gb-ab-auto'); if (el) el.checked = true;
    const cfg = panel.querySelector('[data-cfg=auto-queue]'); if (cfg) cfg.checked = true;
    abScan('manual');
    if (!was) { /* leave ON after manual - user asked for queue */ }
  });
  panel.querySelector('footer button[data-act=copy]').addEventListener('click', () => {
    const dump = redactFindingsExport({ findings: state.findings, farms: state.farms });
    const text = JSON.stringify(dump, null, 2);
    navigator.clipboard.writeText(text)
      .then(() => flash('copiado'))
      .catch(() => {
        try {
          const ta = document.createElement('textarea');
          ta.value = text; document.body.appendChild(ta); ta.select();
          const ok = document.execCommand('copy');
          ta.remove();
          flash(ok ? 'copiado' : 'fallo al copiar');
        } catch (_) { flash('fallo al copiar'); }
      });
  });
  panel.querySelector('footer button[data-act=export]').addEventListener('click', () => {
    const dump = redactFindingsExport({ findings: state.findings, farms: state.farms });
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `grepbot-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  });
  panel.querySelector('footer button[data-act=clear]').addEventListener('click', () => {
    if (!confirm('¿Borrar todos los hallazgos?')) return;
    state.findings = []; state.seen = {}; seenThisRun.clear();
    save(STORE.FINDINGS, state.findings); save(STORE.SEEN, state.seen);
    renderFindings();
  });
  panel.querySelector('footer button[data-act=diag]').addEventListener('click', () => {
    diagRun();
  });
  panel.querySelector('button[data-act=copy-log]')?.addEventListener('click', () => {
    const text = gbLogText();
    if (!text) { flash('registro vacío'); return; }
    const ok = () => flash('registro copiado');
    const fail = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        const done = document.execCommand('copy');
        ta.remove();
        flash(done ? 'registro copiado' : 'fallo al copiar');
      } catch (_) { flash('fallo al copiar'); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok).catch(fail);
    } else {
      fail();
    }
  });
  panel.querySelectorAll('button[data-act=evidence]').forEach(btn => {
    btn.addEventListener('click', () => { evidenceCopy(); });
  });
  panel.querySelector('footer button[data-act=preflight]')?.addEventListener('click', () => {
    showTab('stats');
    preflightRunAndRender();
  });
  panel.querySelector('footer button[data-act=scrape-farms]').addEventListener('click', () => {
    flash('leyendo granjas...');
    gbLog('manual: Farms now pressed');
    state.nextFarmScrape = 0;
    save(STORE.NEXT_FARM, 0);
    autoClaimFarms('manual');
    farmTick();
  });
  panel.querySelector('#gb-sleep-claim')?.addEventListener('click', () => {
    farmSleepClaimNow('manual');
    renderSleepStatus();
  });
  panel.querySelector('footer button[data-act=scrape-towns]').addEventListener('click', () => {
    flash('leyendo ciudades...');
    state.nextTownsScrape = 0;
    save(STORE.NEXT_TOWNS, 0);
    farmTick();
  });

  // farm claim timing block (loyalty 10min / sleep 4-8h) - shared by both
  // bindConfig branches so the learned option map stays visible after a rebind
  function syncFarmTimingCfg(sec) {
    if (!sec) return;
    const lc = sec.querySelector('[data-cfg=farm-long-claims]'); if (lc) lc.checked = !!state.farmLongClaims;
    const lt = sec.querySelector('[data-cfg=farm-loyalty-tech]'); if (lt) lt.value = state.farmLoyaltyTech || '';
    const sd = sec.querySelector('[data-cfg=farm-sleep-dur]'); if (sd) sd.value = String(state.farmSleepDur || 'auto');
    const sa = sec.querySelector('[data-cfg=farm-sleep-auto]'); if (sa) sa.checked = !!state.farmSleepAuto;
    const sf = sec.querySelector('[data-cfg=farm-sleep-fill]'); if (sf) sf.value = state.farmSleepFillPct;
    const om = sec.querySelector('#gb-farm-optmap');
    if (om) {
      om.textContent = 'opciones de recogida aprendidas: ' + farmOptionMapText() +
        ' (recoge un temporizador a mano en el juego para enseñar el resto)';
    }
  }
  function bindConfig() {
    const sec = panel.querySelector('section[data-tab=config]');
    if (!sec) return;
    if (configBound) {
      sec.querySelector('[data-cfg=enabled-host]').checked = state.enabledHosts[location.host] === true;
      sec.querySelector('[data-cfg=collect-all]').checked = state.collectAll;
      const acol = sec.querySelector('[data-cfg=auto-collect]'); if (acol) acol.checked = state.autoCollect;
      sec.querySelector('[data-cfg=auto-bandit]').checked = state.autoBandit;
      sec.querySelector('[data-cfg=auto-farm]').checked = state.autoFarm;
      sec.querySelector('[data-cfg=farm-skip-full]').checked = state.farmSkipFull;
      const fm = sec.querySelector('[data-cfg=farm-full-mode]'); if (fm) fm.value = state.farmFullMode || 'any';
      syncFarmTimingCfg(sec);
      sec.querySelector('[data-cfg=auto-build]').checked = state.ibAuto;
      const ir = sec.querySelector('[data-cfg=instant-research]'); if (ir) ir.checked = state.ibResearch;
      sec.querySelector('[data-cfg=auto-queue]').checked = state.abAuto;
      sec.querySelector('[data-cfg=auto-quest-build]').checked = state.questAutoBuild;
      sec.querySelector('[data-cfg=auto-quest-res]').checked = state.questAutoRes;
      const ac = sec.querySelector('[data-cfg=auto-cave]'); if (ac) ac.checked = state.autoCave;
      const ct = sec.querySelector('[data-cfg=cave-thresh]'); if (ct) ct.value = state.caveThreshPct;
      const dr = sec.querySelector('[data-cfg=dry-run]'); if (dr) dr.checked = !!state.dryRun;
      const oa = sec.querySelector('[data-cfg=orch-adaptive]'); if (oa) oa.checked = state.orchAdaptive !== false;
      const od = sec.querySelector('[data-cfg=orch-deadlock]'); if (od) od.checked = state.orchDeadlockResolve !== false;
      const er = sec.querySelector('[data-cfg=export-redact]'); if (er) er.checked = state.exportRedact !== false;
      renderCaveTowns();
      return;
    }
    configBound = true;
    const hostEl = sec.querySelector('.cfg-host');
    if (hostEl) hostEl.textContent = location.host;
    const setChk = (sel, val) => { const el = sec.querySelector(sel); if (el) el.checked = !!val; };
    setChk('[data-cfg=enabled-host]', state.enabledHosts[location.host] === true);
    setChk('[data-cfg=collect-all]', state.collectAll);
    setChk('[data-cfg=auto-collect]', state.autoCollect);
    setChk('[data-cfg=auto-bandit]', state.autoBandit);
    setChk('[data-cfg=auto-farm]', state.autoFarm);
    setChk('[data-cfg=farm-skip-full]', state.farmSkipFull);
    const fm0 = sec.querySelector('[data-cfg=farm-full-mode]'); if (fm0) fm0.value = state.farmFullMode || 'any';
    syncFarmTimingCfg(sec);
    setChk('[data-cfg=auto-build]', state.ibAuto);
    setChk('[data-cfg=instant-research]', state.ibResearch);
    setChk('[data-cfg=auto-queue]', state.abAuto);
    setChk('[data-cfg=auto-quest-build]', state.questAutoBuild);
    setChk('[data-cfg=auto-quest-res]', state.questAutoRes);
    setChk('[data-cfg=auto-cave]', state.autoCave);
    const setNum = (sel, val) => { const el = sec.querySelector(sel); if (el) el.value = val; };
    setNum('[data-cfg=cave-thresh]', state.caveThreshPct);
    setNum('[data-cfg=ib-free-thresh]', state.ibFreeThresh);
    setNum('[data-cfg=collect-max-min]', state.collectMaxMin);
    setNum('[data-cfg=farm-min]', Math.round(state.farmMinMs / 60000));
    setNum('[data-cfg=farm-max]', Math.round(state.farmMaxMs / 60000));
    setNum('[data-cfg=town-min]', Math.round(state.townMinMs / 60000));
    setNum('[data-cfg=town-max]', Math.round(state.townMaxMs / 60000));
    sec.querySelector('[data-cfg=enabled-host]')?.addEventListener('change', e => {
      state.enabledHosts[location.host] = e.target.checked;
      save(STORE.ENABLED_HOSTS, state.enabledHosts);
      flash(e.target.checked ? 'activado en ' + location.host : 'desactivado en ' + location.host);
    });
    sec.querySelector('[data-cfg=auto-collect]')?.addEventListener('change', e => {
      state.autoCollect = e.target.checked; save(STORE.AUTO_COLLECT, state.autoCollect);
      flash(state.autoCollect ? 'auto-recoger ON' : 'auto-recoger OFF');
    });
    sec.querySelector('[data-cfg=collect-all]')?.addEventListener('change', e => {
      state.collectAll = e.target.checked; save(STORE.COLLECT_ALL, state.collectAll);
      flash(state.collectAll ? 'recoger-todo ON' : 'recoger-todo OFF');
      if (state.collectAll) collectAllBackground();
    });
    sec.querySelector('[data-cfg=auto-bandit]')?.addEventListener('change', e => {
      state.autoBandit = e.target.checked; save(STORE.AUTO_BANDIT, state.autoBandit);
      gbLog('auto-bandit', state.autoBandit ? 'ON' : 'OFF');
      if (state.autoBandit) {
        try { banditClearLoop(); } catch (_) {}
        banditIdleUntil = 0;
        banditScan();
      }
    });
    sec.querySelector('[data-cfg=auto-farm]')?.addEventListener('change', e => {
      state.autoFarm = e.target.checked; save(STORE.AUTO_FARM, state.autoFarm);
      gbLog('auto-farm', state.autoFarm ? 'ON' : 'OFF');
      if (state.autoFarm) autoClaimFarms('toggle');
    });
    sec.querySelector('[data-cfg=farm-skip-full]')?.addEventListener('change', e => {
      state.farmSkipFull = e.target.checked; save(STORE.FARM_SKIP_FULL, state.farmSkipFull);
      gbLog('farm-skip-full', state.farmSkipFull ? 'ON' : 'OFF');
    });
    sec.querySelector('[data-cfg=farm-full-mode]')?.addEventListener('change', e => {
      state.farmFullMode = e.target.value === 'all' ? 'all' : 'any';
      save(STORE.FARM_FULL_MODE, state.farmFullMode);
      gbLog('farm-full-mode', state.farmFullMode);
    });
    sec.querySelector('[data-cfg=auto-build]')?.addEventListener('change', e => {
      state.ibAuto = e.target.checked; save(STORE.IB_AUTO, state.ibAuto);
      gbLog('instant-build', state.ibAuto ? 'ON' : 'OFF');
      if (state.ibAuto) ibScan();
    });
    sec.querySelector('[data-cfg=farm-long-claims]')?.addEventListener('change', e => {
      state.farmLongClaims = e.target.checked; save(STORE.FARM_LONG_CLAIMS, state.farmLongClaims);
      gbLog('farm 10min claims', state.farmLongClaims ? 'ON' : 'OFF');
    });
    sec.querySelector('[data-cfg=farm-loyalty-tech]')?.addEventListener('change', e => {
      state.farmLoyaltyTech = String(e.target.value || '').trim();
      save(wkey(STORE.FARM_LOYALTY_TECH), state.farmLoyaltyTech);
      farmLoyaltyReset(); // don't make the user wait out the 60s cache
      gbLog('farm loyalty tech: ' + (state.farmLoyaltyTech || 'auto-detect'));
    });
    sec.querySelector('[data-cfg=farm-sleep-dur]')?.addEventListener('change', e => {
      state.farmSleepDur = e.target.value; save(STORE.FARM_SLEEP_DUR, state.farmSleepDur);
      syncFarmTimingCfg(sec);
    });
    sec.querySelector('[data-cfg=farm-sleep-auto]')?.addEventListener('change', e => {
      state.farmSleepAuto = e.target.checked; save(STORE.FARM_SLEEP_AUTO, state.farmSleepAuto);
      gbLog('auto sleep claim', state.farmSleepAuto ? 'ON' : 'OFF');
    });
    sec.querySelector('[data-cfg=instant-research]')?.addEventListener('change', e => {
      state.ibResearch = e.target.checked; save(STORE.IB_RESEARCH, state.ibResearch);
      gbLog('instant-research', state.ibResearch ? 'ON' : 'OFF');
      if (state.ibResearch && state.ibAuto) ibScan();
      else renderBuild();
    });
    sec.querySelector('[data-cfg=auto-queue]')?.addEventListener('change', e => {
      state.abAuto = e.target.checked; save(STORE.AB_AUTO, state.abAuto);
      gbLog('auto-queue', state.abAuto ? 'ON' : 'OFF');
      const el = panel.querySelector('#gb-ab-auto'); if (el) el.checked = state.abAuto;
      if (state.abAuto) abScan('toggle');
      renderAbQueue();
    });
    sec.querySelector('[data-cfg=auto-quest-build]')?.addEventListener('change', e => {
      state.questAutoBuild = e.target.checked; save(STORE.QUEST_AUTO_BUILD, state.questAutoBuild);
      gbLog('auto-quest-build', state.questAutoBuild ? 'ON' : 'OFF');
      if (state.questAutoBuild) questScanTick('toggle');
    });
    sec.querySelector('[data-cfg=auto-quest-res]')?.addEventListener('change', e => {
      state.questAutoRes = e.target.checked; save(STORE.QUEST_AUTO_RES, state.questAutoRes);
      gbLog('auto-quest-res', state.questAutoRes ? 'ON' : 'OFF');
      if (state.questAutoRes) questScanTick('toggle');
    });
    sec.querySelector('[data-cfg=auto-cave]')?.addEventListener('change', e => {
      state.autoCave = e.target.checked; save(STORE.AUTO_CAVE, state.autoCave);
      gbLog('auto-cave', state.autoCave ? 'ON' : 'OFF');
      if (state.autoCave) caveScan('toggle');
      renderCaveTowns();
    });
    // ---- Phase 8.2+ toggles ----
    const saveNum = (sel, fn) => sec.querySelector(sel)?.addEventListener('change', e => { fn(+e.target.value); });
    const ct = state.cultureTypes || {};
    setChk('[data-cfg=auto-culture]', state.autoCulture);
    setChk('[data-cfg=cult-festival]', ct.festival !== false);
    setChk('[data-cfg=cult-procession]', !!ct.procession);
    setChk('[data-cfg=cult-theater]', !!ct.theater);
    setChk('[data-cfg=cult-olympic]', !!ct.olympic);
    setChk('[data-cfg=allow-premium-culture]', !!state.allowPremiumCulture);
    setNum('[data-cfg=culture-gold-budget]', state.cultureGoldBudget || 0);
    setChk('[data-cfg=auto-trade]', state.autoTrade);
    setChk('[data-cfg=island-ship]', state.islandShip);
    setChk('[data-cfg=auto-rural-trade]', state.autoRuralTrade);
    setChk('[data-cfg=auto-rural-level]', state.autoRuralLevel);
    setChk('[data-cfg=auto-research]', state.autoResearch);
    setChk('[data-cfg=pause-activity]', state.pauseOnActivity);
    setChk('[data-cfg=night-pause]', state.nightPause);
    setChk('[data-cfg=captcha-global]', state.captchaGlobalKill !== false);
    setChk('[data-cfg=decision-memory]', state.decisionMemory !== false);
    setChk('[data-cfg=dry-run]', !!state.dryRun);
    setChk('[data-cfg=orch-adaptive]', state.orchAdaptive !== false);
    setChk('[data-cfg=orch-deadlock]', state.orchDeadlockResolve !== false);
    setChk('[data-cfg=export-redact]', state.exportRedact !== false);
    setChk('[data-cfg=auto-merchant]', state.autoMerchant);
    setChk('[data-cfg=auto-pt-trade]', state.autoPtTrade);
    {
      const c = state.ptCfg || {};
      const want = c.wantRes || {};
      setNum('[data-cfg=pt-ratio]', c.targetRatio != null ? c.targetRatio : 1);
      setNum('[data-cfg=pt-pump]', c.pumpAmount != null ? c.pumpAmount : 1);
      setNum('[data-cfg=pt-maxpumps]', c.maxPumps != null ? c.maxPumps : 6);
      setNum('[data-cfg=pt-reserve]', c.reservePct != null ? c.reservePct : 10);
      setChk('[data-cfg=pt-want-wood]', want.wood !== false);
      setChk('[data-cfg=pt-want-stone]', want.stone !== false);
      setChk('[data-cfg=pt-want-iron]', !!want.iron);
      const st = sec.querySelector('#gb-pt-status');
      if (st) st.textContent = typeof ptStatusText === 'function' ? ptStatusText() : '';
    }
    setChk('[data-cfg=auto-favor]', state.autoFavor);
    setChk('[data-cfg=auto-wonder]', state.autoWonder);
    setChk('[data-cfg=cs-alert]', state.csAlert !== false);
    setChk('[data-cfg=auto-militia]', state.autoMilitia);
    setChk('[data-cfg=auto-dodge]', state.autoDodge);
    setChk('[data-cfg=auto-recruit]', state.autoRecruit);
    setChk('[data-cfg=recruit-spells]', state.recruitSpells);
    setChk('[data-cfg=grepodata]', state.grepodataIndex);
    setNum('[data-cfg=rural-ratio]', state.ruralTradeRatio);
    setNum('[data-cfg=rural-level-max]', state.ruralLevelMax);
    setNum('[data-cfg=pause-ms]', Math.round((state.pauseActivityMs || 180000) / 60000));
    setNum('[data-cfg=night-start]', state.nightStart);
    setNum('[data-cfg=night-end]', state.nightEnd);
    setNum('[data-cfg=req-budget]', state.reqBudgetPerMin);
    setNum('[data-cfg=posts-soft]', state.postsPerMinSoftPct != null ? state.postsPerMinSoftPct : 60);
    const cl = sec.querySelector('[data-cfg=captcha-ladder]');
    if (cl) cl.value = (state.captchaLadder || [5, 15, 60]).join(',');
    setChk('[data-cfg=auto-wonder-favor]', !!state.autoWonderFavor);
    setNum('[data-cfg=dodge-floor]', state.dodgeFloor);
    const rr = sec.querySelector('[data-cfg=rural-res]'); if (rr) rr.value = state.ruralTradeRes || 'iron';
    const dm = sec.querySelector('[data-cfg=dodge-mode]'); if (dm) dm.value = state.dodgeMode || 'notify';
    const wh = sec.querySelector('[data-cfg=webhook-url]'); if (wh) wh.value = state.webhookUrl || '';
    const we = state.webhookEvents || {};
    setChk('[data-cfg=wh-captcha]', we.captcha !== false);
    setChk('[data-cfg=wh-attack]', we.attack !== false);
    setChk('[data-cfg=wh-pattern]', we.pattern !== false);
    setChk('[data-cfg=wh-warehouse]', !!we.warehouse);
    setChk('[data-cfg=wh-culture]', !!we.culture);
    const tg = sec.querySelector('[data-cfg=wh-tg-chat]'); if (tg) tg.value = we.telegramChatId || '';
    const tp = sec.querySelector('[data-cfg=trade-preset]'); if (tp) tp.value = state.tradePreset || 'storage';
    setNum('[data-cfg=trade-reserve]', state.tradeReservePct);
    setNum('[data-cfg=trade-min]', state.tradeMinBatch);
    setNum('[data-cfg=trade-max-hops]', state.tradeMaxHops);
    const bindToggle = (sel, key, store, onOn) => {
      sec.querySelector(sel)?.addEventListener('change', e => {
        state[key] = e.target.checked; save(store, state[key]);
        gbLog(key, state[key] ? 'ON' : 'OFF');
        if (state[key] && onOn) onOn();
      });
    };
    bindToggle('[data-cfg=auto-culture]', 'autoCulture', STORE.AUTO_CULTURE, () => cultureScan('toggle'));
    bindToggle('[data-cfg=auto-trade]', 'autoTrade', STORE.AUTO_TRADE, () => tradeScan('toggle'));
    bindToggle('[data-cfg=island-ship]', 'islandShip', STORE.ISLAND_SHIP, () => tradeScan('toggle'));
    bindToggle('[data-cfg=auto-rural-trade]', 'autoRuralTrade', STORE.AUTO_RURAL_TRADE, () => ruralTradeScan('toggle'));
    bindToggle('[data-cfg=auto-rural-level]', 'autoRuralLevel', STORE.AUTO_RURAL_LEVEL, () => ruralLevelScan('toggle'));
    bindToggle('[data-cfg=auto-research]', 'autoResearch', STORE.AUTO_RESEARCH, () => researchScan('toggle'));
    bindToggle('[data-cfg=pause-activity]', 'pauseOnActivity', STORE.PAUSE_ON_ACTIVITY);
    bindToggle('[data-cfg=night-pause]', 'nightPause', STORE.NIGHT_PAUSE);
    bindToggle('[data-cfg=captcha-global]', 'captchaGlobalKill', STORE.CAPTCHA_GLOBAL);
    bindToggle('[data-cfg=decision-memory]', 'decisionMemory', STORE.DECISION_MEM);
    bindToggle('[data-cfg=orch-adaptive]', 'orchAdaptive', STORE.ORCH_ADAPTIVE);
    bindToggle('[data-cfg=orch-deadlock]', 'orchDeadlockResolve', STORE.ORCH_DEADLOCK);
    bindToggle('[data-cfg=export-redact]', 'exportRedact', STORE.EXPORT_REDACT);
    sec.querySelector('[data-cfg=dry-run]')?.addEventListener('change', e => {
      state.dryRun = e.target.checked; save(STORE.DRY_RUN, state.dryRun);
      gbLog('DRY RUN ' + (state.dryRun ? 'ON - payloads logged, DOM clicks blocked' : 'OFF - posts go to the server'));
      flash(state.dryRun ? 'simulacro ON' : 'simulacro OFF');
      updateStatus();
    });
    bindToggle('[data-cfg=auto-merchant]', 'autoMerchant', STORE.AUTO_MERCHANT, () => merchantScan('toggle'));
    bindToggle('[data-cfg=auto-pt-trade]', 'autoPtTrade', STORE.AUTO_PT_TRADE, () => ptTradeScan('toggle'));
    const savePt = (key, val) => {
      if (!state.ptCfg || typeof state.ptCfg !== 'object') state.ptCfg = {};
      state.ptCfg[key] = val;
      save(STORE.PT_CFG, state.ptCfg);
    };
    saveNum('[data-cfg=pt-ratio]', v => savePt('targetRatio', Math.min(2, Math.max(0.5, v || 1))));
    saveNum('[data-cfg=pt-pump]', v => savePt('pumpAmount', Math.max(1, Math.floor(v || 1))));
    saveNum('[data-cfg=pt-maxpumps]', v => savePt('maxPumps', Math.min(20, Math.max(0, Math.floor(v || 0)))));
    saveNum('[data-cfg=pt-reserve]', v => savePt('reservePct', Math.min(90, Math.max(0, Math.floor(v || 0)))));
    const savePtWant = () => {
      savePt('wantRes', {
        wood: !!sec.querySelector('[data-cfg=pt-want-wood]')?.checked,
        stone: !!sec.querySelector('[data-cfg=pt-want-stone]')?.checked,
        iron: !!sec.querySelector('[data-cfg=pt-want-iron]')?.checked,
      });
    };
    ['pt-want-wood', 'pt-want-stone', 'pt-want-iron'].forEach(k => {
      sec.querySelector('[data-cfg=' + k + ']')?.addEventListener('change', savePtWant);
    });
    sec.querySelector('[data-cfg=pt-now]')?.addEventListener('click', () => {
      if (!state.ptTradeTpl) { flash('comercia una vez a mano primero'); return; }
      if (!confirm('¿Bombear el ratio del barco mercante y enviar ahora el trato grande?')) return;
      const was = state.autoPtTrade;
      if (!was) { state.autoPtTrade = true; save(STORE.AUTO_PT_TRADE, true); }
      ptTradeScan('manual');
    });
    sec.querySelector('[data-cfg=pt-copy]')?.addEventListener('click', () => {
      const root = typeof ptWindowRoot === 'function' ? ptWindowRoot() : null;
      if (!root) { flash('abre primero la ventana del mercader'); return; }
      navigator.clipboard.writeText(root.innerHTML.slice(0, 20000))
        .then(() => flash('HTML de la oferta copiado'))
        .catch(() => flash('fallo al copiar'));
    });
    bindToggle('[data-cfg=auto-favor]', 'autoFavor', STORE.AUTO_FAVOR, () => favorScan('toggle'));
    bindToggle('[data-cfg=auto-wonder]', 'autoWonder', STORE.AUTO_WONDER, () => wonderScan('toggle'));
    bindToggle('[data-cfg=cs-alert]', 'csAlert', STORE.CS_ALERT);
    bindToggle('[data-cfg=auto-militia]', 'autoMilitia', STORE.AUTO_MILITIA);
    bindToggle('[data-cfg=auto-dodge]', 'autoDodge', STORE.AUTO_DODGE);
    bindToggle('[data-cfg=auto-recruit]', 'autoRecruit', STORE.AUTO_RECRUIT, () => recruitScan('toggle'));
    bindToggle('[data-cfg=recruit-spells]', 'recruitSpells', STORE.RECRUIT_SPELLS);
    bindToggle('[data-cfg=grepodata]', 'grepodataIndex', STORE.GREPODATA_INDEX);
    const saveCult = () => {
      state.cultureTypes = {
        festival: !!sec.querySelector('[data-cfg=cult-festival]')?.checked,
        procession: !!sec.querySelector('[data-cfg=cult-procession]')?.checked,
        theater: !!sec.querySelector('[data-cfg=cult-theater]')?.checked,
        olympic: !!sec.querySelector('[data-cfg=cult-olympic]')?.checked,
      };
      save(STORE.CULTURE_TYPES, state.cultureTypes);
    };
    ['cult-festival', 'cult-procession', 'cult-theater', 'cult-olympic'].forEach(k => {
      sec.querySelector('[data-cfg=' + k + ']')?.addEventListener('change', saveCult);
    });
    bindToggle('[data-cfg=allow-premium-culture]', 'allowPremiumCulture', STORE.ALLOW_PREMIUM_CULTURE);
    saveNum('[data-cfg=culture-gold-budget]', v => {
      state.cultureGoldBudget = Math.max(0, v);
      save(STORE.CULTURE_GOLD_BUDGET, state.cultureGoldBudget);
    });
    saveNum('[data-cfg=rural-ratio]', v => { state.ruralTradeRatio = v; save(STORE.RURAL_TRADE_RATIO, v); });
    saveNum('[data-cfg=rural-level-max]', v => { state.ruralLevelMax = v; save(STORE.RURAL_LEVEL_MAX, v); });
    saveNum('[data-cfg=pause-ms]', v => { state.pauseActivityMs = Math.max(1, v) * 60000; save(STORE.PAUSE_ACTIVITY_MS, state.pauseActivityMs); });
    saveNum('[data-cfg=night-start]', v => { state.nightStart = v; save(STORE.NIGHT_START, v); });
    saveNum('[data-cfg=night-end]', v => { state.nightEnd = v; save(STORE.NIGHT_END, v); });
    saveNum('[data-cfg=req-budget]', v => { state.reqBudgetPerMin = v; save(STORE.REQ_BUDGET, v); });
    saveNum('[data-cfg=posts-soft]', v => {
      state.postsPerMinSoftPct = Math.min(95, Math.max(20, v || 60));
      save(STORE.POSTS_SOFT_PCT, state.postsPerMinSoftPct);
    });
    sec.querySelector('[data-cfg=captcha-ladder]')?.addEventListener('change', e => {
      const parts = String(e.target.value || '').split(/[,;\s]+/).map(x => Math.max(1, Math.min(24 * 60, +x || 0))).filter(n => n >= 1);
      if (parts.length < 1) { flash('la escalera necesita ≥1 valor'); return; }
      if (parts.some(n => n < 2)) gbLog('captcha ladder: values <2min are aggressive');
      state.captchaLadder = parts;
      save(STORE.CAPTCHA_LADDER, parts);
      flash('escalera de captcha ' + parts.join(','));
    });
    sec.querySelector('[data-cfg=captcha-clear]')?.addEventListener('click', () => {
      captchaClear();
      flash('pausas por captcha limpiadas');
      updateStatus();
    });
    sec.querySelector('[data-cfg=storage-prune]')?.addEventListener('click', () => {
      const before = JSON.stringify(state.seen || {}).length + JSON.stringify(state.alerted || {}).length;
      const ids = Object.keys(state.seen || {});
      if (ids.length > 500) {
        ids.slice(0, ids.length - 500).forEach(k => { delete state.seen[k]; });
        save(STORE.SEEN, state.seen);
      }
      const aks = Object.keys(state.alerted || {});
      const cut = Date.now() - 7 * 86400000;
      aks.forEach(k => { if ((state.alerted[k] || 0) < cut) delete state.alerted[k]; });
      save(STORE.ALERTED, state.alerted);
      const after = JSON.stringify(state.seen || {}).length + JSON.stringify(state.alerted || {}).length;
      flash('purgados ~' + Math.max(0, before - after) + 'B');
      gbLog('storage prune: seen=' + Object.keys(state.seen).length + ' alerted=' + Object.keys(state.alerted).length);
    });
    bindToggle('[data-cfg=auto-wonder-favor]', 'autoWonderFavor', STORE.AUTO_WONDER_FAVOR);
    let _presetUndo = null;
    sec.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.preset;
        if (kind === 'undo') {
          if (!_presetUndo) { flash('nada que deshacer'); return; }
          Object.keys(_presetUndo).forEach(k => { state[k] = _presetUndo[k]; });
          _presetUndo = null;
          bindConfig();
          flash('preajuste deshecho');
          return;
        }
        const presets = {
          afk: {
            autoFarm: true, farmSleepAuto: true, farmLongClaims: true,
            autoCave: true, autoTrade: true, islandShip: true, autoCulture: true,
            autoResearch: true, abAuto: true, ibAuto: false, autoCollect: false,
            nightPause: true, dodgeMode: 'notify', autoDodge: false,
            autoRecruit: false, autoFavor: false,
          },
          farm: {
            autoFarm: true, farmSleepAuto: false, farmLongClaims: true,
            autoCave: true, autoTrade: true, islandShip: true, autoCulture: true,
            autoResearch: true, abAuto: true, ibAuto: true, autoCollect: true,
            nightPause: false, dodgeMode: 'notify', autoDodge: false,
            autoRecruit: false, autoFavor: false,
          },
          war: {
            autoFarm: true, autoCave: true, autoTrade: true, islandShip: true,
            autoCulture: false, autoResearch: false, abAuto: false, ibAuto: false,
            autoCollect: true, nightPause: false, dodgeMode: 'notify', autoDodge: false,
            autoRecruit: false, autoFavor: false,
          },
        };
        const patch = presets[kind];
        if (!patch) return;
        const keys = Object.keys(patch);
        const diff = keys.map(k => `${k}: ${state[k]}→${patch[k]}`).join(', ');
        if (!confirm('¿Aplicar el preajuste ' + kind + '?\n' + diff + '\n\nLo de ALTO RIESGO sigue OFF. simulacro/hosts sin tocar.')) return;
        _presetUndo = {};
        keys.forEach(k => { _presetUndo[k] = state[k]; state[k] = patch[k]; });
        // Persist allow-listed keys only
        try {
          save(STORE.AUTO_FARM, state.autoFarm);
          save(STORE.AUTO_CAVE, state.autoCave);
          save(STORE.AUTO_TRADE, state.autoTrade);
          save(STORE.ISLAND_SHIP, state.islandShip);
          save(STORE.AUTO_CULTURE, state.autoCulture);
          save(STORE.AUTO_RESEARCH, state.autoResearch);
          save(STORE.AB_AUTO, state.abAuto);
          save(STORE.IB_AUTO, state.ibAuto);
          save(STORE.AUTO_COLLECT, state.autoCollect);
          save(STORE.NIGHT_PAUSE, state.nightPause);
          save(STORE.DODGE_MODE, state.dodgeMode);
          save(STORE.AUTO_DODGE, false);
          save(STORE.AUTO_RECRUIT, false);
          save(STORE.AUTO_FAVOR, false);
          save(STORE.FARM_SLEEP_AUTO, state.farmSleepAuto);
          save(STORE.FARM_LONG_CLAIMS, state.farmLongClaims);
        } catch (_) {}
        bindConfig();
        flash('preajuste ' + kind + ' aplicado');
        gbLog('preset: ' + kind + ' (' + keys.length + ' keys)');
      });
    });
    saveNum('[data-cfg=dodge-floor]', v => { state.dodgeFloor = v; save(STORE.DODGE_FLOOR, v); });
    sec.querySelector('[data-cfg=rural-res]')?.addEventListener('change', e => {
      state.ruralTradeRes = e.target.value; save(STORE.RURAL_TRADE_RES, state.ruralTradeRes);
    });
    sec.querySelector('[data-cfg=dodge-mode]')?.addEventListener('change', e => {
      state.dodgeMode = e.target.value; save(STORE.DODGE_MODE, state.dodgeMode);
    });
    sec.querySelector('[data-cfg=webhook-url]')?.addEventListener('change', e => {
      state.webhookUrl = e.target.value.trim(); save(STORE.WEBHOOK_URL, state.webhookUrl);
      gbLog('webhook url', state.webhookUrl ? 'set' : 'cleared');
    });
    const saveWebhookEvents = () => {
      state.webhookEvents = {
        captcha: !!sec.querySelector('[data-cfg=wh-captcha]')?.checked,
        attack: !!sec.querySelector('[data-cfg=wh-attack]')?.checked,
        pattern: !!sec.querySelector('[data-cfg=wh-pattern]')?.checked,
        warehouse: !!sec.querySelector('[data-cfg=wh-warehouse]')?.checked,
        culture: !!sec.querySelector('[data-cfg=wh-culture]')?.checked,
        telegramChatId: (sec.querySelector('[data-cfg=wh-tg-chat]')?.value || '').trim() || undefined,
      };
      save(STORE.WEBHOOK_EVENTS, state.webhookEvents);
    };
    ['wh-captcha', 'wh-attack', 'wh-pattern', 'wh-warehouse', 'wh-culture'].forEach(k => {
      sec.querySelector('[data-cfg=' + k + ']')?.addEventListener('change', saveWebhookEvents);
    });
    sec.querySelector('[data-cfg=wh-tg-chat]')?.addEventListener('change', saveWebhookEvents);
    sec.querySelector('[data-cfg=trade-preset]')?.addEventListener('change', e => {
      state.tradePreset = e.target.value; save(STORE.TRADE_PRESET, state.tradePreset);
      gbLog('tradePreset', state.tradePreset);
    });
    saveNum('[data-cfg=trade-reserve]', v => {
      state.tradeReservePct = Math.min(80, Math.max(0, v)); save(STORE.TRADE_RESERVE, state.tradeReservePct);
    });
    saveNum('[data-cfg=trade-min]', v => {
      state.tradeMinBatch = Math.max(100, v); save(STORE.TRADE_MIN, state.tradeMinBatch);
    });
    saveNum('[data-cfg=trade-max-hops]', v => {
      state.tradeMaxHops = Math.max(0, Math.min(200, v)); save(STORE.TRADE_MAX_HOPS, state.tradeMaxHops);
    });
    sec.querySelector('[data-cfg=research-csfast]')?.addEventListener('click', () => {
      researchLoadCsFast(); flash('investigación CS-rápido');
    });
    saveNum('[data-cfg=cave-thresh]', v => {
      state.caveThreshPct = Math.min(99, Math.max(50, v || 90));
      save(STORE.CAVE_THRESH, state.caveThreshPct);
      gbLog('cave-thresh', state.caveThreshPct + '%');
    });
    saveNum('[data-cfg=farm-sleep-fill]', v => {
      state.farmSleepFillPct = Math.min(95, Math.max(10, v || 60));
      save(STORE.FARM_SLEEP_FILL, state.farmSleepFillPct);
    });
    saveNum('[data-cfg=ib-free-thresh]', v => { state.ibFreeThresh = v; save(STORE.IB_FREE_THRESH, v); });
    saveNum('[data-cfg=collect-max-min]', v => { state.collectMaxMin = v; save(STORE.COLLECT_MAX_MIN, v); });
    saveNum('[data-cfg=farm-min]', v => { state.farmMinMs = v * 60000; save(STORE.FARM_MIN, state.farmMinMs); });
    saveNum('[data-cfg=farm-max]', v => { state.farmMaxMs = v * 60000; save(STORE.FARM_MAX, state.farmMaxMs); });
    saveNum('[data-cfg=town-min]', v => { state.townMinMs = v * 60000; save(STORE.TOWN_MIN, state.townMinMs); });
    saveNum('[data-cfg=town-max]', v => { state.townMaxMs = v * 60000; save(STORE.TOWN_MAX, state.townMaxMs); });
    sec.querySelector('[data-cfg=clear-captcha]')?.addEventListener('click', () => {
      captchaClear();
      gbLog('captcha breakers cleared by user');
      flash('cortacircuitos de captcha limpiados');
    });
    renderCaveTowns();
  }
  bindConfig();
  {
    const start = TAB_IDS.includes(state.activeTab) ? state.activeTab : 'findings';
    showTab(start, { force: true });
  }

  // farms textarea persistence (debounced: parse+save+render once typing settles)
  const ta = panel.querySelector('textarea');
  ta.value = state.farms;
  let farmsInputTimer = null;
  ta.addEventListener('input', () => {
    state.farms = ta.value;
    clearTimeout(farmsInputTimer);
    farmsInputTimer = gbTimeout(() => {
      save(STORE.FARMS, state.farms);
      refreshFarmsParsed();
      renderFarms();
    }, 400);
  });

  // drag
  (function drag(el, handle) {
    let sx, sy, dx, dy, dragging = false, moved = false;
    gbListen(handle, 'mousedown', e => {
      if (e.target.closest && e.target.closest('.gb-resize')) return;
      dragging = true; moved = false;
      sx = e.clientX; sy = e.clientY; dx = el.offsetLeft; dy = el.offsetTop;
      e.preventDefault();
    });
    gbListen(document, 'mousemove', e => {
      if (!dragging) return;
      moved = true;
      el.style.left = (e.clientX - sx + dx) + 'px';
      el.style.top = (e.clientY - sy + dy) + 'px';
      el.style.right = 'auto';
    });
    gbListen(document, 'mouseup', () => {
      if (!dragging) return;
      dragging = false;
      if (moved) savePanelGeom();
    });
  })(panel, panel.querySelector('header'));

  // resize - all edges + corners
  (function resize(el) {
    const DIRS = {
      n: { t: 1 }, s: { b: 1 }, e: { r: 1 }, w: { l: 1 },
      ne: { t: 1, r: 1 }, nw: { t: 1, l: 1 },
      se: { b: 1, r: 1 }, sw: { b: 1, l: 1 },
    };
    let sx, sy, sw, sh, sl, st, flags, resizing = false;
    el.querySelectorAll('.gb-resize').forEach(handle => {
      gbListen(handle, 'mousedown', e => {
        if (el.classList.contains('collapsed')) return;
        resizing = true;
        flags = DIRS[handle.dataset.dir] || DIRS.se;
        sx = e.clientX; sy = e.clientY;
        const rect = el.getBoundingClientRect();
        sw = rect.width; sh = rect.height;
        sl = rect.left; st = rect.top;
        // pin left/top so opposite edges stay fixed (also clears right-anchor)
        el.style.left = sl + 'px';
        el.style.top = st + 'px';
        el.style.right = 'auto';
        e.preventDefault();
        e.stopPropagation();
      });
    });
    gbListen(document, 'mousemove', e => {
      if (!resizing) return;
      const maxW = Math.floor(window.innerWidth * 0.9);
      const maxH = Math.floor(window.innerHeight * 0.9);
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      let w = sw, h = sh;
      if (flags.r) w = sw + dx;
      if (flags.b) h = sh + dy;
      if (flags.l) w = sw - dx;
      if (flags.t) h = sh - dy;
      w = Math.min(maxW, Math.max(PANEL_MIN_W, w));
      h = Math.min(maxH, Math.max(PANEL_MIN_H, h));
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      el.style.maxHeight = 'none';
      if (flags.l) el.style.left = (sl + (sw - w)) + 'px';
      if (flags.t) el.style.top = (st + (sh - h)) + 'px';
    });
    gbListen(document, 'mouseup', () => {
      if (!resizing) return;
      resizing = false;
      savePanelGeom();
    });
  })(panel);

  panel.querySelector('footer button[data-act=reset-pos]').addEventListener('click', resetPanelGeom);

  // Trailing-edge debounce for filter inputs. Plain setTimeout on purpose:
  // these are sub-second UI timers, not automation, so they stay out of the
  // reinject dispose bag.
  function gbDebounce(fn, ms) {
    let t = null;
    return function () {
      if (t) clearTimeout(t);
      t = setTimeout(() => { t = null; fn(); }, ms);
    };
  }
  const findingsFilterDebounced = gbDebounce(() => {
    save(STORE.FINDINGS_FILTER, state.findingsFilter);
    renderFindings();
  }, 150);
  const journalFilterDebounced = gbDebounce(() => renderJournal(), 150);
  function ensureFindingsFilter(sec) {
    if (findingsFilterEl && findingsFilterEl.isConnected) return findingsFilterEl;
    const filt = document.createElement('div');
    filt.className = 'findings-filter';
    filt.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap';
    filt.innerHTML = '<input data-f="type" placeholder="filtrar tipo" style="flex:1;min-width:60px;background:#111;color:#cfc;border:1px solid #333;padding:2px 4px;font:11px monospace"/><input data-f="attacker" placeholder="filtrar atacante" style="flex:1;min-width:60px;background:#111;color:#cfc;border:1px solid #333;padding:2px 4px;font:11px monospace"/>';
    filt.querySelectorAll('input').forEach(inp => {
      inp.value = state.findingsFilter[inp.dataset.f] || '';
      inp.addEventListener('input', () => {
        state.findingsFilter[inp.dataset.f] = inp.value;
        // debounced: a full list rebuild + storage write per keystroke was the
        // worst offender in the panel (80 rows re-created while typing)
        findingsFilterDebounced();
      });
    });
    findingsFilterEl = filt;
    return filt;
  }
  function renderFindings() {
    const sec = panel.querySelector('section[data-tab=findings]');
    if (!sec) return;
    const filt = ensureFindingsFilter(sec);
    let list = sec.querySelector('.findings-list');
    if (!list) {
      // first paint: mount filter + list without wiping (keeps input focus on re-filter)
      if (!filt.parentNode) sec.appendChild(filt);
      list = document.createElement('div');
      list.className = 'findings-list';
      sec.appendChild(list);
    } else if (!filt.parentNode) {
      sec.insertBefore(filt, list);
    }
    list.replaceChildren();
    const typeF = (state.findingsFilter.type || '').toLowerCase();
    const atkF = (state.findingsFilter.attacker || '').toLowerCase();
    const slice = state.findings.filter(f => {
      if (typeF && !(f.type || '').toLowerCase().includes(typeF)) return false;
      if (atkF && !(f.attacker?.name || '').toLowerCase().includes(atkF)) return false;
      return true;
    }).slice(0, 80);
    if (!slice.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:#888;padding:10px';
      empty.textContent = state.findings.length ? 'sin coincidencias' : 'aún no hay hallazgos - abre el buzón';
      list.appendChild(empty);
      return;
    }
    for (const f of slice) {
      const row = document.createElement('div');
      row.className = 'finding';

      const meta = document.createElement('div');
      meta.className = 'meta';
      const when = new Date(f.ts).toLocaleTimeString();
      const target = f.town?.id != null
        ? `${f.town.name || 'ciudad'} #${f.town.id}`
        : `t#${f.town?.id || '?'}`;
      const coord = (f.town?.x != null) ? ` (${f.town.x}|${f.town.y})` : '';
      meta.textContent = `#${f.id} | ${when} | ${f.type} | ${target}${coord}`;
      row.appendChild(meta);

      const units = document.createElement('div');
      units.className = 'units';
      units.textContent = f.units
        ? Object.entries(f.units).map(([k,v]) => `${k}:${v}`).join(' ')
        : '-';
      row.appendChild(units);

      if (f.resources && (f.resources.wood != null || f.resources.stone != null || f.resources.iron != null)) {
        const res = document.createElement('div');
        res.className = 'res';
        res.textContent = `Ma${f.resources.wood ?? '?'} Pi${f.resources.stone ?? '?'} Pl${f.resources.iron ?? '?'}`;
        row.appendChild(res);
      }

      if (f.town && f.town.id != null) {
        const actions = document.createElement('div');
        actions.style.cssText = 'margin-top:3px';
        const atkBtn = document.createElement('button');
        atkBtn.type = 'button';
        atkBtn.textContent = '-> Atacar';
        atkBtn.title = `Usar la ciudad #${f.town.id} como objetivo de ataque`;
        atkBtn.style.cssText = 'background:#333;border:1px solid #555;color:#f96;padding:1px 6px;cursor:pointer;font-size:10px';
        atkBtn.addEventListener('click', () => prepareAttack(Object.assign({ kind: 'town' }, f.town)));
        actions.appendChild(atkBtn);
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.textContent = 'Copiar id';
        copyBtn.title = 'Copiar el id de la ciudad al portapapeles';
        copyBtn.style.cssText = 'background:#333;border:1px solid #555;color:#9cf;padding:1px 6px;cursor:pointer;font-size:10px;margin-left:4px';
        copyBtn.addEventListener('click', () => {
          const id = String(f.town.id);
          try {
            navigator.clipboard.writeText(id);
            flash('copiado ' + id);
          } catch (_) {
            flash('id: ' + id);
          }
        });
        actions.appendChild(copyBtn);
        row.appendChild(actions);
      }

      list.appendChild(row);
    }
  }
  // Decision journal view (Log tab -> Decisions). Built as DOM nodes, not HTML:
  // r/d carry raw server error strings.
  function renderJournal() {
    const pane = panel && panel.querySelector('.jrn-pane');
    const list = pane && pane.querySelector('.jrn-list');
    if (!list || pane.hidden) return;
    const q = (panel.querySelector('.jrn-filter')?.value || '').trim().toLowerCase();
    const skips = jrnActiveSkips();
    const head = pane.querySelector('.jrn-head');
    if (head) {
      head.textContent = '';
      head.appendChild(document.createTextNode(
        `${state.decisions.length} decisiones  |  memoria ${state.decisionMemory === false ? 'OFF' : 'ON'}  |  `));
      const b = document.createElement('b');
      b.textContent = `${skips.length} saltando`;
      head.appendChild(b);
      if (skips.length) {
        const soonest = skips.slice().sort((a, b2) => a.until - b2.until)[0];
        head.appendChild(document.createTextNode(
          ` (${soonest.key} ${fmtSec(Math.round((soonest.until - Date.now()) / 1000))})`));
      }
    }
    const rows = state.decisions.filter(r => !q ||
      (r.f + ' ' + r.a + ' ' + r.k + ' ' + r.r).toLowerCase().includes(q)).slice(-120).reverse();
    list.textContent = '';
    if (!rows.length) {
      list.textContent = q ? '(sin coincidencias)' : '(aún no hay nada registrado)';
      return;
    }
    const table = document.createElement('table');
    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.className = r.r === 'ok' ? 'ok' : (r.r.slice(0, 5) === 'skip:' ? 'skip' : 'err');
      const cell = (cls, text, title) => {
        const td = document.createElement('td');
        td.className = cls;
        td.textContent = text;
        if (title) td.title = title;
        tr.appendChild(td);
      };
      cell('t', new Date(r.ts).toLocaleTimeString());
      cell('f', r.f);
      cell('a', r.a);
      cell('k', r.k === '-' ? '' : r.k);
      cell('r', (r.r.slice(0, 5) === 'skip:' ? r.r.slice(5) : r.r) + ((r.n || 1) > 1 ? ' x' + r.n : ''), r.d || '');
      table.appendChild(tr);
    }
    list.appendChild(table);
  }
  function flash(msg) {
    const f = document.createElement('div');
    f.textContent = msg; f.style.cssText = 'position:fixed;top:60px;right:8px;background:#f5a623;color:#000;padding:6px 10px;border-radius:4px;z-index:100000';
    document.body.appendChild(f); gbTimeout(() => f.remove(), 1500);
  }

  // Strip PII from export/copy dumps (player names/ids kept as hashes).
  // Opt-out via Config -> "Redact names/ids in Copy + Export" (default ON): raw
  // dumps carry other players' names, ids and town coordinates off-box the
  // moment they are pasted anywhere.
  function redactFindingsExport(dump) {
    if (state.exportRedact === false) {
      gbLogT('export-raw', 60000, 'export: redaction OFF - dump contains player names/ids');
      return dump;
    }
    const redactPlayer = (p) => {
      if (!p || typeof p !== 'object') return p;
      return { id: p.id != null ? 'p' + String(p.id).slice(-4) : null, name: p.name ? String(p.name).slice(0, 1) + '...' : null };
    };
    const findings = (dump.findings || []).map(f => {
      if (!f || typeof f !== 'object') return f;
      const out = Object.assign({}, f);
      out.attacker = redactPlayer(f.attacker);
      out.defender = redactPlayer(f.defender);
      if (out.town && typeof out.town === 'object') {
        out.town = { id: out.town.id, name: out.town.name ? String(out.town.name).slice(0, 1) + '...' : null, x: out.town.x, y: out.town.y };
      }
      delete out.raw;
      return out;
    });
    return { findings, farms: dump.farms };
  }

  let _statusLast = '';
  let _statusCsLast = '';
  let _statusLastAction = '';
  function updateStatus() {
    if (!panel) return;
    const el = panel.querySelector('#gb-status');
    if (!el) return;
    const csrfShort = state.csrf ? state.csrf.slice(0, 6) + '...' : 'NONE';
    const farms = state.farmsParsed.length;
    const okFarms = Object.values(state.farmResources).filter(r => r && r.ok).length;
    const lastErr = Object.values(state.farmResources).filter(r => r && !r.ok).slice(-1)[0];
    const errTxt = lastErr ? ` err:${(lastErr.err || '').slice(0, 20)}` : '';
    const paused = Object.keys(state.captchaBreakers || {}).filter(k => captchaPaused(k));
    const pauseInfo = {};
    automationPaused(pauseInfo);
    let pauseTxt = paused.length ? ` ||${paused.join(',')}` : '';
    if (pauseInfo.reason) pauseTxt += ` ||${pauseInfo.reason}`;
    if (captchaGlobalUntil > Date.now()) pauseTxt += ' ||ALL';
    const memSkips = jrnActiveSkips();
    if (memSkips.length) pauseTxt += ` mem:${memSkips.length}`;
    if (gbServerPaused()) pauseTxt += ` ||srv:${fmtSec(Math.round(gbServerCooldownLeftMs() / 1000))}`;
    if (storageWarnUntil > Date.now()) pauseTxt += ` ⚠${storageWarnMsg || 'quota'}`;
    try {
      const dl = typeof econDeadlock === 'function' ? econDeadlock() : null;
      if (dl && dl.open) pauseTxt += ' WH';
    } catch (_) {}
    try {
      const tb = typeof tplHealthBannerText === 'function' ? tplHealthBannerText() : '';
      if (tb) pauseTxt += ' tpl!';
    } catch (_) {}
    const dryTxt = state.dryRun ? ' DRY' : '';
    const txt = `csrf:${csrfShort} farms:${okFarms}/${farms}${errTxt}${dryTxt}${pauseTxt}`;
    if (txt !== _statusLast) {
      _statusLast = txt;
      el.textContent = txt;
      let titleExtra = '';
      try { titleExtra = tplHealthBannerText() || ''; } catch (_) {}
      el.title = (titleExtra ? titleExtra + ' | ' : '') + JSON.stringify({ csrf: !!state.csrf, captcha: state.captchaBreakers, pause: pauseInfo.reason, memory: memSkips.map(s => s.key) });
    }
    const la = panel.querySelector('#gb-last-action');
    if (la) {
      let chip = '';
      try {
        const list = state.decisions || [];
        for (let i = list.length - 1; i >= 0; i--) {
          const r = list[i];
          if (!r || r.r !== 'ok') continue;
          const ago = Math.max(0, Math.round((Date.now() - r.ts) / 1000));
          const agoTxt = ago < 60 ? ago + 's' : (ago < 3600 ? Math.round(ago / 60) + 'm' : Math.round(ago / 3600) + 'h');
          const act = String(r.a || '').slice(0, 18);
          chip = `${r.f}: ${act} OK hace ${agoTxt}`;
          la.style.color = ago > 900 && hostEnabled() && !pauseInfo.reason ? '#fc6' : '#8c8';
          break;
        }
        if (!chip && state.dryRun) chip = 'DRY (sin OK real)';
      } catch (_) {}
      if (chip !== (_statusLastAction || '')) {
        _statusLastAction = chip;
        la.textContent = chip;
      }
    }
    const cs = panel.querySelector('#gb-collect-state');
    if (cs) {
      const csTxt = pauseInfo.reason ? `pausa:${pauseInfo.reason}` : '';
      if (csTxt !== _statusCsLast) {
        _statusCsLast = csTxt;
        cs.textContent = csTxt;
      }
    }
  }
  let _timerFarmLast = '', _timerTownLast = '';
  function renderTimers() {
    if (!panel) return;
    const fe = panel.querySelector('#gb-next-farms');
    const te = panel.querySelector('#gb-next-towns');
    if (fe) {
      const t = state.nextFarmScrape
        ? `~ granjas: ${fmtSec(Math.max(0, Math.round((state.nextFarmScrape - Date.now()) / 1000)))}`
        : '~ granjas: -';
      if (t !== _timerFarmLast) { _timerFarmLast = t; fe.textContent = t; }
    }
    if (te) {
      const t = state.nextTownsScrape
        ? `~ ciudades: ${fmtSec(Math.max(0, Math.round((state.nextTownsScrape - Date.now()) / 1000)))}`
        : '~ ciudades: -';
      if (t !== _timerTownLast) { _timerTownLast = t; te.textContent = t; }
    }
  }
  function diagRun() {
    refreshFarmsParsed();
    updateStatus();
    const lines = [];
    lines.push('GrepBot diag ' + new Date().toISOString());
    lines.push('host: ' + location.host);
    lines.push('csrf: ' + (state.csrf ? 'yes' : 'NO'));
    const bridge = gameBridgeStatus();
    lines.push('bridge: uw=' + !!bridge.uw + ' Game=' + !!bridge.Game + ' MM=' + !!bridge.MM +
      ' gpAjax=' + !!bridge.gpAjax + ' ITowns=' + !!bridge.ITowns + ' GameData=' + !!bridge.GameData +
      ' farmRel=' + !!bridge.farmRel + ' farmTown=' + !!bridge.farmTown +
      ' townCol=' + !!bridge.townCol + ' attackSpot=' + !!bridge.attackSpot);
    lines.push('farmAction: ' + (state.farmAction || 'none'));
    const farms = state.farmsParsed || [];
    const gameN = farms.filter(f => f.fromGame).length;
    lines.push('farms: ' + farms.length + ' (game=' + gameN + ' manual=' + (farms.length - gameN) + ')');
    for (const f of farms) {
      const src = f._attrs || (f._rel && f._rel.attributes) || f._rel || {};
      const loot = f.lootable_at != null ? f.lootable_at : src.lootable_at;
      const last = src.last_looted_at;
      let delta = '?';
      if (loot != null && last != null && isFinite(+loot) && isFinite(+last)) delta = (+loot - +last) + 's';
      lines.push('  id=' + f.vill_id +
        ' name=' + (f.name || src.name || '?') +
        ' rel=' + (f.relation_id != null ? f.relation_id : (src.id != null ? src.id : '?')) +
        ' status=' + (src.relation_status != null ? src.relation_status : '?') +
        ' lootable=' + (loot != null ? loot : '?') +
        ' last=' + (last != null ? last : '?') +
        ' stage=' + (src.expansion_stage != null ? src.expansion_stage : '?') +
        ' delta=' + delta);
    }
    const townIds = (state.towns || []).map(t => t.id != null ? t.id : t);
    lines.push('towns: ' + townIds.length + ' ids=[' + townIds.join(',') + ']');
    try {
      const cd = caveDiag();
      if (cd && cd.info) {
        const info = cd.info;
        const tid = (caveListTownIds()[0]) || '?';
        let tname = '?';
        try {
          const t = info.town;
          if (t) tname = (typeof t.getName === 'function' ? t.getName() : null) || t.name || '?';
        } catch (_) {}
        const iron = info.iron, cap = info.cap;
        const pct = (iron != null && cap > 0) ? Math.round((iron / cap) * 100) : '?';
        lines.push('cave town ' + tid + ' ' + tname +
          ': hide=' + (info.hideLvl != null ? info.hideLvl : '?') +
          ' iron=' + (iron != null ? iron : '?') + '/' + (cap != null ? cap : '?') +
          ' (' + pct + '%) hideCap=' + (info.hideCap != null ? info.hideCap : '?') +
          ' stored=' + (info.stored != null ? info.stored : '?') +
          ' unlimited=' + !!info.unlimited);
        lines.push('  methods: ' + ((cd.keys && cd.keys.length) ? cd.keys.join(',') : '(none)'));
        lines.push('  attrs: ' + ((cd.attrs && cd.attrs.length) ? cd.attrs.join(',') : '(none)'));
      } else {
        lines.push('cave town ?: (no model)');
      }
    } catch (e) {
      lines.push('cave town ?: FAIL ' + String(e).slice(0, 80));
    }
    function finishDiag(extraLine) {
      if (extraLine) lines.push(extraLine);
      const report = lines.join('\n');
      console.groupCollapsed('[grepbot] diag');
      console.log(report);
      console.groupEnd();
      const okFlash = () => {
        flash('diag copiado');
        gbLog('diag: copied ' + farms.length + ' farms, csrf=' + (state.csrf ? 'yes' : 'NO'));
      };
      const failFlash = () => {
        flash('diag listo - pégalo desde la consola');
        gbLog('diag: clipboard fail - expand [grepbot] diag in console');
      };
      const tryExecCopy = () => {
        try {
          const ta = document.createElement('textarea');
          ta.value = report;
          document.body.appendChild(ta);
          ta.select();
          const ok = document.execCommand('copy');
          ta.remove();
          if (ok) okFlash(); else failFlash();
        } catch (_) { failFlash(); }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(report).then(okFlash).catch(tryExecCopy);
      } else {
        tryExecCopy();
      }
    }
    const first = farms[0];
    if (!first) {
      finishDiag();
      return;
    }
    fetchFarmResources(first, () => {
      const r = state.farmResources[first.vill_id] || {};
      finishDiag('test fetch vill=' + first.vill_id +
        ': ' + (r.ok ? 'ok' : 'FAIL') +
        ' action=' + (r.action || state.farmAction || '?') +
        ' wood=' + (r.wood != null ? r.wood : '?') +
        ' stone=' + (r.stone != null ? r.stone : '?') +
        ' iron=' + (r.iron != null ? r.iron : '?') +
        ' pop=' + (r.pop != null ? r.pop : '?') +
        ' err=' + (r.err || ''));
    });
  }

