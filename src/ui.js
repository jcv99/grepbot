  // ---------- sortable tables (Phase 3) ----------
  function makeSortable(table, rowDataFn) {
    const thead = table.querySelector('thead');
    if (!thead) return;
    thead.querySelectorAll('th').forEach((th, col) => {
      if (th.dataset.nosort) return;
      th.style.cursor = 'pointer';
      th.title = 'sort';
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
    el.textContent = `${farmDurLabel(sec)} | ${known ? 'option ' + farmOptionFor(sec) : 'not learned - click that timer once in game'}` +
      ` | auto ${state.farmSleepAuto ? 'ON' : 'OFF'}${state.farmSleepDay ? ' | last ' + state.farmSleepDay : ''}`;
    el.style.color = known ? '#888' : '#fc6';
  }
  // ---------- keyed table rendering (v1.4.0) ----------
  // renderFarms/renderWorld ran `replaceChildren()` on every scrape callback and
  // every 15s repaint: full table teardown, new nodes, new listeners, lost sort
  // order and lost scroll position. Rows are now keyed by id — the table is only
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
      if (!list.querySelector('div')) placeholder(list, 'no farms parsed yet - add vill_id lines below');
      return;
    }
    const table = tableShell(list, ['id', 'name', 'W', 'S', 'I', 'pop', 'seen', '']);
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
        const atkBtn = document.createElement('button');
        atkBtn.textContent = 'ATK'; atkBtn.title = 'Prepare attack';
        atkBtn.style.cssText = 'background:none;border:1px solid #555;color:#f96;padding:1px 5px;cursor:pointer;font-size:11px';
        atkBtn.addEventListener('click', () => prepareAttack(f));
        const thrBtn = document.createElement('button');
        thrBtn.textContent = 'THR'; thrBtn.title = 'Set threshold';
        thrBtn.style.cssText = 'background:none;border:1px solid #555;color:#fc6;padding:1px 5px;cursor:pointer;font-size:11px;margin-left:2px';
        thrBtn.addEventListener('click', () => editThreshold(f));
        actions.appendChild(atkBtn); actions.appendChild(thrBtn);
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
    const head = `${state.towns.length} towns | ${okN} ok`;
    const res = `Wood ${fmt(w)} | Stone ${fmt(s)} | Iron ${fmt(i)} | Pop ${fmt(p)}`;
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
      if (!list.querySelector('div')) placeholder(list, 'no towns loaded yet - click Refresh towns');
      return;
    }
    const table = tableShell(list, ['id', 'name', 'W', 'S', 'I', 'pop', 'seen']);
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
    { id: 'scout', label: 'Scout', tabs: [
      { id: 'findings', label: 'Findings' },
      { id: 'farms', label: 'Farms' },
      { id: 'world', label: 'World' },
    ]},
    { id: 'action', label: 'Action', tabs: [
      { id: 'attack', label: 'Attack' },
      { id: 'quests', label: 'Quests' },
      { id: 'build', label: 'Build' },
    ]},
    { id: 'account', label: 'Account', tabs: [
      { id: 'overview', label: 'Overview' },
      { id: 'intel', label: 'Intel' },
    ]},
    { id: 'system', label: 'System', tabs: [
      { id: 'config', label: 'Config' },
      { id: 'stats', label: 'Stats' },
      { id: 'log', label: 'Log' },
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
    flash('panel reset');
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
    #grepbot-panel .log-list{height:100%;min-height:180px;max-height:280px;overflow:auto;font-size:10px;white-space:pre-wrap;word-break:break-word;color:#9d9;background:#111;padding:4px;border:1px solid #333}
    #grepbot-panel .gb-logsub{display:flex;gap:4px;align-items:center;margin-bottom:4px}
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
    #grepbot-panel .atk-sched{max-height:160px;overflow:auto;margin-top:6px}
    #grepbot-panel .atk-sources{max-height:80px;overflow:auto;display:flex;flex-wrap:wrap;gap:4px 8px;margin:4px 0}
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
    <header><b>GrepBot v${runningVersion()}</b><button data-act="toggle" title="Minimize">_</button></header>
    <div class="gb-nav" role="tablist" aria-label="GrepBot groups"></div>
    <div class="gb-subtabs" role="tablist" aria-label="GrepBot tabs"></div>
    <section data-tab="findings"></section>
    <section data-tab="farms" hidden>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
        <button id="gb-sleep-claim" style="background:#333;border:1px solid #555;color:#8cf;padding:2px 8px;cursor:pointer;font-size:11px">Sleep claim (4h/8h)</button>
        <span id="gb-sleep-status" style="font-size:10px;color:#888"></span>
      </div>
      <div class="farms-list"></div>
      <textarea placeholder="vill_id | x y | ETA | notes&#10;12345 | 500 600 | 2h | safe"></textarea>
    </section>
    <section data-tab="world" hidden>
      <div class="world-totals" style="padding:6px;background:#262626;border-radius:3px;margin-bottom:6px;font-size:11px"></div>
      <div class="world-list"></div>
    </section>
    <section data-tab="attack" hidden>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <b style="font-size:11px;color:#f5a623">Attack sync</b>
        <span id="gb-atk-skew" style="font-size:9px;color:#888"></span>
        <span id="gb-atk-armed" style="font-size:10px;color:#f96;font-weight:bold;margin-left:auto"></span>
      </div>
      <div class="atk-row">
        <label>target <input data-atk="target" style="width:70px" placeholder="id"/></label>
        <label>x <input data-atk="x" style="width:40px"/></label>
        <label>y <input data-atk="y" style="width:40px"/></label>
        <select data-atk="mission"><option>attack</option><option>support</option><option>raid</option><option>siege</option><option>scout</option><option>revolt</option><option value="portal">olympus portal</option></select>
      </div>
      <div class="atk-row">
        <select data-atk="timing"><option value="send_now">send now</option><option value="arrive_at">arrive at</option></select>
        <input data-atk="arrival" type="datetime-local" step="1" title="arrival (local)"/>
        <label>pad ms <input data-atk="pad" type="number" style="width:50px" value="200"/></label>
      </div>
      <div class="atk-row">
        <select data-atk="troop">
          <option value="offense">offense</option>
          <option value="defense">defense</option>
          <option value="all">all troops</option>
          <option value="all_of_type">all of type</option>
          <option value="harass">harass</option>
          <option value="per_town">per town edit</option>
        </select>
        <label style="display:flex;align-items:center;gap:3px">unit
          <select data-atk="unit-type" title="only used when troop mode is 'all of type'"></select>
        </label>
      </div>
      <div class="atk-harass" style="display:flex;gap:4px;flex-wrap:wrap;margin:4px 0">
        <span style="font-size:9px;color:#888;align-self:center">harass</span>
        <button type="button" data-harass="1sling" style="background:#333;border:1px solid #555;color:#eee;padding:1px 6px;cursor:pointer;font-size:10px">1 sling</button>
        <button type="button" data-harass="5sling" style="background:#333;border:1px solid #555;color:#eee;padding:1px 6px;cursor:pointer;font-size:10px">5 sling</button>
        <button type="button" data-harass="light" style="background:#333;border:1px solid #555;color:#eee;padding:1px 6px;cursor:pointer;font-size:10px">light (≤8)</button>
      </div>
      <div style="font-size:9px;color:#888;margin-top:2px">sources</div>
      <div class="atk-sources"></div>
      <div class="atk-pertown" hidden></div>
      <div class="atk-btns" style="margin-top:6px">
        <button id="gb-atk-preview">Preview</button>
        <button id="gb-atk-arm">Arm</button>
        <button id="gb-atk-cancel">Cancel</button>
        <button id="gb-atk-now">Send now</button>
      </div>
      <div class="atk-sched"></div>
      <div style="border-top:1px solid #333;margin:8px 0 4px;padding-top:6px;display:flex;align-items:center;gap:6px">
        <b style="font-size:11px;color:#f5a623">Outgoing (cancel)</b>
        <button type="button" id="gb-atk-cmds-refresh" style="background:#333;border:1px solid #555;color:#eee;padding:1px 6px;cursor:pointer;font-size:10px;margin-left:auto">Refresh</button>
      </div>
      <div class="atk-cmds" style="max-height:120px;overflow:auto"></div>
      <div style="border-top:1px solid #333;margin:8px 0 4px;padding-top:6px;display:flex;align-items:center;gap:6px">
        <b style="font-size:11px;color:#f5a623">Heroes</b>
        <button type="button" id="gb-atk-heroes-refresh" style="background:#333;border:1px solid #555;color:#eee;padding:1px 6px;cursor:pointer;font-size:10px;margin-left:auto">Refresh</button>
      </div>
      <div class="atk-heroes" style="max-height:160px;overflow:auto"></div>
    </section>
    <section data-tab="quests" hidden>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <b style="font-size:11px;color:#f5a623">Quests</b>
        <button id="gb-quest-scan" style="background:#333;border:1px solid #555;color:#eee;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:11px;margin-left:auto">Scan now</button>
      </div>
      <div class="quest-list"></div>
      <div style="font-size:9px;color:#888;margin-top:6px">history</div>
      <div class="quest-hist"></div>
    </section>
    <section data-tab="build" hidden>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span id="gb-ib-dot" class="ib-dot"></span><b style="font-size:11px;color:#f5a623">Instant build</b>
        <span style="flex:1"></span>
        <button id="gb-ib-btn">Complete all free</button>
      </div>
      <div class="ib-rows"></div>
      <div id="gb-ib-status" style="font-size:10px;color:#888;margin-top:4px"></div>
      <div style="border-top:1px solid #333;margin:8px 0 6px;padding-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <b style="font-size:11px;color:#f5a623">Auto-queue</b>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:10px"><input type="checkbox" id="gb-ab-auto"/> ON</label>
        <button id="gb-ab-csfast" style="background:#333;border:1px solid #555;color:#6cf;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px">Load CS-fast</button>
        <button id="gb-ab-now" style="background:#333;border:1px solid #555;color:#80e090;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px">Queue now</button>
      </div>
      <div style="font-size:9px;color:#888;margin-bottom:4px">Auto only fills when ≤1 order left: adds up to 6 (or queue max). Next fill waits half(build time)+5min+rand — not right when a build finishes. Targets = cur/tgt/max.</div>
      <div class="ab-queue"></div>
      <div id="gb-ab-status" style="font-size:10px;color:#888;margin-top:4px"></div>
    </section>
    <section data-tab="overview" hidden>
      <div style="font-size:11px;color:#f5a623;margin-bottom:4px">Account overview</div>
      <pre class="overview-panel" style="font-size:10px;white-space:pre-wrap;background:#111;padding:6px;border:1px solid #333;max-height:280px;overflow:auto;color:#cfc"></pre>
      <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
        <input id="gb-tpl-name" placeholder="template name" style="width:100px;background:#111;color:#cfc;border:1px solid #333;font-size:11px"/>
        <button id="gb-tpl-save" style="background:#333;border:1px solid #555;color:#eee;padding:2px 6px;cursor:pointer;font-size:10px">Save template</button>
        <button id="gb-tpl-apply" style="background:#333;border:1px solid #555;color:#6cf;padding:2px 6px;cursor:pointer;font-size:10px">Apply template</button>
        <button id="gb-cfg-export" style="background:#333;border:1px solid #555;color:#9d9;padding:2px 6px;cursor:pointer;font-size:10px">Export config</button>
        <button id="gb-cfg-import" style="background:#333;border:1px solid #555;color:#fc6;padding:2px 6px;cursor:pointer;font-size:10px">Import config</button>
      </div>
    </section>
    <section data-tab="intel" hidden>
      <div style="font-size:11px;color:#f5a623;margin-bottom:4px">Intel / threats</div>
      <pre class="intel-panel" style="font-size:10px;white-space:pre-wrap;background:#111;padding:6px;border:1px solid #333;max-height:280px;overflow:auto;color:#cfc"></pre>
      <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <input id="gb-note-player" placeholder="player" style="width:80px;background:#111;color:#cfc;border:1px solid #333;font-size:11px"/>
        <input id="gb-note-text" placeholder="note" style="flex:1;background:#111;color:#cfc;border:1px solid #333;font-size:11px"/>
        <button id="gb-note-save" style="background:#333;border:1px solid #555;color:#eee;padding:2px 6px;cursor:pointer;font-size:10px">Save note</button>
      </div>
    </section>
    <section data-tab="config" hidden>
      <div class="config-panel" style="font-size:11px;display:flex;flex-direction:column;gap:8px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="enabled-host"/> Enable on <span class="cfg-host"></span></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="collect-all"/> Recolect all (ignore timer cap)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-bandit"/> Auto-bandit</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-farm"/> Auto-farm</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px"><input type="checkbox" data-cfg="farm-skip-full"/> Skip farm/bandit if warehouse full</label>
        <label style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-wrap:wrap">Warehouse full mode
          <select data-cfg="farm-full-mode" style="background:#111;color:#cfc;border:1px solid #333;margin-left:6px">
            <option value="any">any 1 resource full</option>
            <option value="all">all 3 resources full</option>
          </select>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px"><input type="checkbox" data-cfg="farm-long-claims"/> 10min claims where villager loyalty researched</label>
        <label style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-wrap:wrap">Loyalty tech key
          <input data-cfg="farm-loyalty-tech" placeholder="auto-detect (server id or label)" title="Server research id (e.g. rural_loyalty) or the localized academy name. Log tab dumps id(label) pairs when auto-detect misses." style="width:190px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/>
        </label>
        <label style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-wrap:wrap">Sleep claim length
          <select data-cfg="farm-sleep-dur" style="background:#111;color:#cfc;border:1px solid #333;margin-left:6px">
            <option value="auto">auto (8h if known, else 4h)</option>
            <option value="14400">4 h</option>
            <option value="28800">8 h</option>
          </select>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px"><input type="checkbox" data-cfg="farm-sleep-auto"/> Auto sleep claim (once/day, must end before 24:00)</label>
        <label style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-wrap:wrap">Sleep claim max warehouse fill %
          <input type="number" data-cfg="farm-sleep-fill" min="10" max="95" style="width:60px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/>
        </label>
        <div id="gb-farm-optmap" style="margin-left:12px;font-size:10px;color:#888"></div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-build"/> Instant free builds</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="instant-research"/> Instant free research (academy)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-queue"/> Auto-queue builds</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-quest-build"/> Auto-claim quest build discount</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-quest-res"/> Auto-claim quest resources/favor</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-cave"/> Auto-cave (stash excess iron)</label>
        <label style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-wrap:wrap">Cave when iron ≥ % of warehouse
          <input type="number" data-cfg="cave-thresh" min="50" max="99" style="width:50px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/>
        </label>
        <div style="margin-left:12px;font-size:10px;color:#888">Per-town (unchecked = skip that town):</div>
        <div class="cave-towns" style="display:flex;flex-direction:column;gap:2px;max-height:120px;overflow:auto"></div>
        <div style="border-top:1px solid #333;padding-top:6px;color:#f5a623;font-size:10px">Phase 8+ economy</div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-culture"/> Auto-culture</label>
        <label style="margin-left:12px;display:flex;gap:8px;flex-wrap:wrap;font-size:10px">
          <label><input type="checkbox" data-cfg="cult-festival"/> festival</label>
          <label><input type="checkbox" data-cfg="cult-procession"/> procession</label>
          <label><input type="checkbox" data-cfg="cult-theater"/> theater</label>
          <label><input type="checkbox" data-cfg="cult-olympic"/> olympic</label>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px;color:#f96"><input type="checkbox" data-cfg="allow-premium-culture"/> Allow premium culture (olympic = 50 gold)</label>
        <label style="margin-left:12px;flex-wrap:wrap;font-size:10px">Olympic daily gold budget
          <input type="number" data-cfg="culture-gold-budget" min="0" max="500" step="50" style="width:60px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-trade"/> Inter-city trade (Fill Storage)</label>
        <label style="margin-left:12px;flex-wrap:wrap">Preset
          <select data-cfg="trade-preset" style="background:#111;color:#cfc;border:1px solid #333;margin-left:4px">
            <option value="storage">storage</option>
            <option value="party">party (unimplemented)</option>
            <option value="unit">unit (unimplemented)</option>
          </select>
          Reserve % <input type="number" data-cfg="trade-reserve" min="0" max="80" style="width:45px;background:#111;color:#cfc;border:1px solid #333"/>
          Min batch <input type="number" data-cfg="trade-min" min="100" max="50000" step="100" style="width:60px;background:#111;color:#cfc;border:1px solid #333"/>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="island-ship"/> Mainland→island res ship</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-rural-trade"/> Rural village trade</label>
        <label style="margin-left:12px;flex-wrap:wrap">Min ratio <input type="number" data-cfg="rural-ratio" step="0.25" min="0.25" max="2" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/>
          Res <select data-cfg="rural-res" style="background:#111;color:#cfc;border:1px solid #333"><option>iron</option><option>stone</option><option>wood</option></select>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-rural-level"/> Farm village upgrade</label>
        <label style="margin-left:12px">Max level <input type="number" data-cfg="rural-level-max" min="1" max="6" style="width:40px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-research"/> Auto-research</label>
        <button data-cfg="research-csfast" style="align-self:flex-start;margin-left:12px;background:#333;border:1px solid #555;color:#6cf;padding:2px 6px;cursor:pointer;font-size:10px">Load CS-fast research</button>
        <div style="border-top:1px solid #333;padding-top:6px;color:#f5a623;font-size:10px">QoL / survival</div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="pause-activity"/> Pause when I am active</label>
        <label style="margin-left:12px">Pause min <input type="number" data-cfg="pause-ms" min="1" max="60" style="width:40px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="night-pause"/> Night pause</label>
        <label style="margin-left:12px">Hours <input type="number" data-cfg="night-start" min="0" max="23" style="width:40px;background:#111;color:#cfc;border:1px solid #333"/>–<input type="number" data-cfg="night-end" min="0" max="23" style="width:40px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Log every payload the bot would send and send nothing. Use it to compare bot payloads against a hand-clicked action before enabling a risky feature."><input type="checkbox" data-cfg="dry-run"/> <b style="color:#6cf">Dry run (log payloads, send nothing)</b></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="A feature that keeps finding nothing to do doubles its own interval (up to 8x) until it acts again."><input type="checkbox" data-cfg="orch-adaptive"/> Adaptive cadence (back off idle features)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Copy/Export replace player names and ids with short hashes. Turn OFF only for local debugging."><input type="checkbox" data-cfg="export-redact"/> Redact names/ids in Copy + Export</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="captcha-global"/> Global captcha kill-switch</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Skip an action that failed the same way 3x in a row (5/15/60min backoff). Journal keeps recording either way."><input type="checkbox" data-cfg="decision-memory"/> Decision memory (skip repeat failures)</label>
        <label>Req budget / min <input type="number" data-cfg="req-budget" min="5" max="120" style="width:50px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/></label>
        <label>Webhook URL <input type="text" data-cfg="webhook-url" placeholder="Discord webhook or https://api.telegram.org/bot…/sendMessage" style="width:100%;background:#111;color:#cfc;border:1px solid #333;margin-top:2px;font-size:10px"/></label>
        <label style="margin-left:0;display:flex;gap:8px;flex-wrap:wrap;font-size:10px">Events
          <label><input type="checkbox" data-cfg="wh-captcha"/> captcha</label>
          <label><input type="checkbox" data-cfg="wh-attack"/> attack</label>
          <label><input type="checkbox" data-cfg="wh-warehouse"/> warehouse</label>
          <label><input type="checkbox" data-cfg="wh-culture"/> culture</label>
        </label>
        <label>Telegram chat_id <input type="text" data-cfg="wh-tg-chat" placeholder="optional if not in URL" style="width:140px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px;font-size:10px"/></label>
        <div style="border-top:1px solid #333;padding-top:6px;color:#f96;font-size:10px">HIGH RISK (default OFF)</div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-merchant"/> Merchant sniper</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-favor"/> Favor farm (godsent)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-wonder"/> WW donations</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="cs-alert"/> CS / incoming alerts</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-militia"/> Auto-militia on incoming</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-dodge"/> Auto-dodge</label>
        <label style="margin-left:12px">Mode <select data-cfg="dodge-mode" style="background:#111;color:#cfc;border:1px solid #333"><option value="notify">notify only</option><option value="auto">auto send</option></select>
          Floor <input type="number" data-cfg="dodge-floor" min="0" max="500" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-recruit"/> Auto-recruit</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px"><input type="checkbox" data-cfg="recruit-spells"/> Cast recruit spells first</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="grepodata"/> Grepodata Index+ assist</label>
        <label>IB free threshold (sec) <input type="number" data-cfg="ib-free-thresh" min="60" max="600" style="width:70px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/></label>
        <label>Collect max min <input type="number" data-cfg="collect-max-min" min="1" max="120" style="width:70px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/></label>
        <label>Farm cadence min-max (min) <input type="number" data-cfg="farm-min" min="1" max="60" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/> - <input type="number" data-cfg="farm-max" min="1" max="60" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label>Town cadence min-max (min) <input type="number" data-cfg="town-min" min="1" max="60" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/> - <input type="number" data-cfg="town-max" min="1" max="60" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <button data-cfg="clear-captcha" style="align-self:flex-start;background:#333;border:1px solid #555;color:#f96;padding:3px 8px;cursor:pointer;font-size:11px">Clear captcha breakers</button>
      </div>
    </section>
    <section data-tab="stats" hidden>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
        <b style="font-size:11px;color:#f5a623">Stats</b>
        <button data-stats="1h" style="background:#262626;border:1px solid #333;color:#aaa;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">1h</button>
        <button data-stats="24h" class="on" style="background:#333;border:1px solid #555;color:#fff;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">24h</button>
        <button data-stats="7d" style="background:#262626;border:1px solid #333;color:#aaa;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">7d</button>
        <span style="flex:1"></span>
        <button id="gb-preflight" title="Read-only probe of every module: collections, learned action keys, would-be payloads. Sends nothing." style="background:#333;border:1px solid #555;color:#6cf;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">Preflight</button>
      </div>
      <pre class="stats-body" style="font-size:10px;white-space:pre-wrap;background:#111;padding:6px;border:1px solid #333;max-height:320px;overflow:auto;color:#cfc"></pre>
    </section>
    <section data-tab="log" hidden>
      <div class="gb-logsub">
        <button data-logsub="live" class="on">Live log</button>
        <button data-logsub="mem">Decisions</button>
        <input class="jrn-filter" placeholder="filter feature/action/target"/>
      </div>
      <div class="log-list"></div>
      <div class="jrn-pane" hidden>
        <div class="jrn-head"></div>
        <div class="jrn-list"></div>
        <div class="jrn-btns">
          <button data-jrn="copy">Copy JSON</button>
          <button data-jrn="clear-skips">Clear skips</button>
          <button data-jrn="clear">Clear journal</button>
        </div>
      </div>
    </section>
    <footer>
      <div class="gb-status-row">
        <span id="gb-next-farms" style="color:#6cf"></span>
        <span id="gb-next-towns" style="color:#fc6"></span>
        <span id="gb-collect-state" style="color:#f96;font-weight:bold"></span>
        <span id="gb-status" style="color:#888"></span>
      </div>
      <details class="gb-actions">
        <summary>Actions</summary>
        <div class="gb-actions-menu">
          <button type="button" data-act="copy">Copy JSON</button>
          <button type="button" data-act="export">Export</button>
          <button type="button" data-act="refresh">Refresh towns</button>
          <button type="button" data-act="scrape-farms">Farms now</button>
          <button type="button" data-act="scrape-towns">Towns now</button>
          <button type="button" data-act="diag">Diag</button>
          <button type="button" data-act="preflight">Preflight</button>
          <button type="button" data-act="clear">Clear findings</button>
          <button type="button" data-act="reset-pos" title="Reset panel position">Reset position</button>
        </div>
      </details>
    </footer>
  `;
  document.body.appendChild(panel);
  ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach(dir => {
    const h = document.createElement('div');
    h.className = 'gb-resize gb-resize-' + dir;
    h.dataset.dir = dir;
    h.title = 'Resize';
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
  panel.querySelectorAll('.gb-logsub button').forEach(btn => {
    btn.addEventListener('click', () => {
      const mem = btn.dataset.logsub === 'mem';
      panel.querySelectorAll('.gb-logsub button').forEach(b => b.classList.toggle('on', b === btn));
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
    navigator.clipboard.writeText(text).then(() => flash('journal copied')).catch(() => flash('copy failed'));
  });
  panel.querySelector('[data-jrn=clear-skips]')?.addEventListener('click', () => {
    jrnClearSkips();
    renderJournal();
  });
  panel.querySelector('[data-jrn=clear]')?.addEventListener('click', () => {
    if (!confirm('Clear the decision journal for ' + location.host + '?')) return;
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
    navigator.clipboard.writeText(text).then(() => flash('config copied')).catch(() => flash('copy failed'));
  });
  panel.querySelector('#gb-cfg-import')?.addEventListener('click', () => {
    const raw = prompt('Paste GrepBot config JSON');
    if (!raw) return;
    try {
      if (qolImportConfig(JSON.parse(raw))) flash('config imported');
      else flash('import failed');
    } catch (e) { flash('bad JSON'); }
  });
  panel.querySelector('#gb-note-save')?.addEventListener('click', () => {
    const p = panel.querySelector('#gb-note-player')?.value?.trim();
    const n = panel.querySelector('#gb-note-text')?.value?.trim();
    if (p) { intelSetNote(p, n); renderIntel(); flash('note saved'); }
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
    btn.title = panel.classList.contains('collapsed') ? 'Restore' : 'Minimize';
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
  panel.querySelector('#gb-ab-csfast')?.addEventListener('click', () => { abLoadCsFast(); flash('CS-fast targets'); });
  panel.querySelector('#gb-ab-now')?.addEventListener('click', () => {
    const was = state.abAuto;
    if (!was) { state.abAuto = true; save(STORE.AB_AUTO, true); }
    const el = panel.querySelector('#gb-ab-auto'); if (el) el.checked = true;
    const cfg = panel.querySelector('[data-cfg=auto-queue]'); if (cfg) cfg.checked = true;
    abScan('manual');
    if (!was) { /* leave ON after manual — user asked for queue */ }
  });
  panel.querySelector('footer button[data-act=copy]').addEventListener('click', () => {
    const dump = redactFindingsExport({ findings: state.findings, farms: state.farms });
    const text = JSON.stringify(dump, null, 2);
    navigator.clipboard.writeText(text)
      .then(() => flash('copied'))
      .catch(() => {
        try {
          const ta = document.createElement('textarea');
          ta.value = text; document.body.appendChild(ta); ta.select();
          const ok = document.execCommand('copy');
          ta.remove();
          flash(ok ? 'copied' : 'copy failed');
        } catch (_) { flash('copy failed'); }
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
    if (!confirm('Clear all findings?')) return;
    state.findings = []; state.seen = {}; seenThisRun.clear();
    save(STORE.FINDINGS, state.findings); save(STORE.SEEN, state.seen);
    renderFindings();
  });
  panel.querySelector('footer button[data-act=diag]').addEventListener('click', () => {
    diagRun();
  });
  panel.querySelector('footer button[data-act=preflight]')?.addEventListener('click', () => {
    showTab('stats');
    preflightRunAndRender();
  });
  panel.querySelector('footer button[data-act=scrape-farms]').addEventListener('click', () => {
    flash('farm scrape...');
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
    flash('towns scrape...');
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
      om.textContent = 'learned claim options: ' + farmOptionMapText() +
        ' (claim a timer by hand in game to teach the rest)';
    }
  }
  function bindConfig() {
    const sec = panel.querySelector('section[data-tab=config]');
    if (!sec) return;
    if (configBound) {
      sec.querySelector('[data-cfg=enabled-host]').checked = state.enabledHosts[location.host] === true;
      sec.querySelector('[data-cfg=collect-all]').checked = state.collectAll;
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
      flash(e.target.checked ? 'enabled on ' + location.host : 'disabled on ' + location.host);
    });
    sec.querySelector('[data-cfg=collect-all]')?.addEventListener('change', e => {
      state.collectAll = e.target.checked; save(STORE.COLLECT_ALL, state.collectAll);
      flash(state.collectAll ? 'collect-all ON' : 'collect-all OFF');
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
    setChk('[data-cfg=export-redact]', state.exportRedact !== false);
    setChk('[data-cfg=auto-merchant]', state.autoMerchant);
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
    setNum('[data-cfg=dodge-floor]', state.dodgeFloor);
    const rr = sec.querySelector('[data-cfg=rural-res]'); if (rr) rr.value = state.ruralTradeRes || 'iron';
    const dm = sec.querySelector('[data-cfg=dodge-mode]'); if (dm) dm.value = state.dodgeMode || 'notify';
    const wh = sec.querySelector('[data-cfg=webhook-url]'); if (wh) wh.value = state.webhookUrl || '';
    const we = state.webhookEvents || {};
    setChk('[data-cfg=wh-captcha]', we.captcha !== false);
    setChk('[data-cfg=wh-attack]', we.attack !== false);
    setChk('[data-cfg=wh-warehouse]', !!we.warehouse);
    setChk('[data-cfg=wh-culture]', !!we.culture);
    const tg = sec.querySelector('[data-cfg=wh-tg-chat]'); if (tg) tg.value = we.telegramChatId || '';
    const tp = sec.querySelector('[data-cfg=trade-preset]'); if (tp) tp.value = state.tradePreset || 'storage';
    setNum('[data-cfg=trade-reserve]', state.tradeReservePct);
    setNum('[data-cfg=trade-min]', state.tradeMinBatch);
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
    bindToggle('[data-cfg=export-redact]', 'exportRedact', STORE.EXPORT_REDACT);
    sec.querySelector('[data-cfg=dry-run]')?.addEventListener('change', e => {
      state.dryRun = e.target.checked; save(STORE.DRY_RUN, state.dryRun);
      gbLog('DRY RUN ' + (state.dryRun ? 'ON - payloads logged, nothing sent' : 'OFF - posts go to the server'));
      flash(state.dryRun ? 'dry run ON' : 'dry run OFF');
      updateStatus();
    });
    bindToggle('[data-cfg=auto-merchant]', 'autoMerchant', STORE.AUTO_MERCHANT, () => merchantScan('toggle'));
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
        warehouse: !!sec.querySelector('[data-cfg=wh-warehouse]')?.checked,
        culture: !!sec.querySelector('[data-cfg=wh-culture]')?.checked,
        telegramChatId: (sec.querySelector('[data-cfg=wh-tg-chat]')?.value || '').trim() || undefined,
      };
      save(STORE.WEBHOOK_EVENTS, state.webhookEvents);
    };
    ['wh-captcha', 'wh-attack', 'wh-warehouse', 'wh-culture'].forEach(k => {
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
    sec.querySelector('[data-cfg=research-csfast]')?.addEventListener('click', () => {
      researchLoadCsFast(); flash('CS-fast research');
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
      flash('captcha breakers cleared');
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

  // resize — all edges + corners
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
    filt.innerHTML = '<input data-f="type" placeholder="type filter" style="flex:1;min-width:60px;background:#111;color:#cfc;border:1px solid #333;padding:2px 4px;font:11px monospace"/><input data-f="attacker" placeholder="attacker filter" style="flex:1;min-width:60px;background:#111;color:#cfc;border:1px solid #333;padding:2px 4px;font:11px monospace"/>';
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
      empty.textContent = state.findings.length ? 'no matches' : 'no findings yet - visit inbox';
      list.appendChild(empty);
      return;
    }
    for (const f of slice) {
      const row = document.createElement('div');
      row.className = 'finding';

      const meta = document.createElement('div');
      meta.className = 'meta';
      const when = new Date(f.ts).toLocaleTimeString();
      const target = f.town?.name || `t#${f.town?.id || '?'}`;
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
        res.textContent = `W${f.resources.wood ?? '?'} S${f.resources.stone ?? '?'} I${f.resources.iron ?? '?'}`;
        row.appendChild(res);
      }

      list.appendChild(row);
    }
  }
  // Decision journal view (Log tab → Decisions). Built as DOM nodes, not HTML:
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
        `${state.decisions.length} decisions · memory ${state.decisionMemory === false ? 'OFF' : 'ON'} · `));
      const b = document.createElement('b');
      b.textContent = `${skips.length} skipping`;
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
      list.textContent = q ? '(no match)' : '(nothing recorded yet)';
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
  // Opt-out via Config → "Redact names/ids in Copy + Export" (default ON): raw
  // dumps carry other players' names, ids and town coordinates off-box the
  // moment they are pasted anywhere.
  function redactFindingsExport(dump) {
    if (state.exportRedact === false) {
      gbLogT('export-raw', 60000, 'export: redaction OFF - dump contains player names/ids');
      return dump;
    }
    const redactPlayer = (p) => {
      if (!p || typeof p !== 'object') return p;
      return { id: p.id != null ? 'p' + String(p.id).slice(-4) : null, name: p.name ? String(p.name).slice(0, 1) + '…' : null };
    };
    const findings = (dump.findings || []).map(f => {
      if (!f || typeof f !== 'object') return f;
      const out = Object.assign({}, f);
      out.attacker = redactPlayer(f.attacker);
      out.defender = redactPlayer(f.defender);
      if (out.town && typeof out.town === 'object') {
        out.town = { id: out.town.id, name: out.town.name ? String(out.town.name).slice(0, 1) + '…' : null, x: out.town.x, y: out.town.y };
      }
      delete out.raw;
      return out;
    });
    return { findings, farms: dump.farms };
  }

  let _statusLast = '';
  let _statusCsLast = '';
  function updateStatus() {
    if (!panel) return;
    const el = panel.querySelector('#gb-status');
    if (!el) return;
    const csrfShort = state.csrf ? state.csrf.slice(0, 6) + '…' : 'NONE';
    const farms = state.farmsParsed.length;
    const okFarms = Object.values(state.farmResources).filter(r => r && r.ok).length;
    const lastErr = Object.values(state.farmResources).filter(r => r && !r.ok).slice(-1)[0];
    const errTxt = lastErr ? ` err:${(lastErr.err || '').slice(0, 20)}` : '';
    const paused = Object.keys(state.captchaBreakers || {}).filter(k => captchaPaused(k));
    const pauseInfo = {};
    automationPaused(pauseInfo);
    let pauseTxt = paused.length ? ` ⏸${paused.join(',')}` : '';
    if (pauseInfo.reason) pauseTxt += ` ⏸${pauseInfo.reason}`;
    if (captchaGlobalUntil > Date.now()) pauseTxt += ' ⏸ALL';
    const memSkips = jrnActiveSkips();
    if (memSkips.length) pauseTxt += ` mem:${memSkips.length}`;
    if (gbServerPaused()) pauseTxt += ` ⏸srv:${fmtSec(Math.round(gbServerCooldownLeftMs() / 1000))}`;
    const dryTxt = state.dryRun ? ' 🅳DRY' : '';
    const txt = `csrf:${csrfShort} farms:${okFarms}/${farms}${errTxt}${dryTxt}${pauseTxt}`;
    if (txt !== _statusLast) {
      _statusLast = txt;
      el.textContent = txt;
      el.title = JSON.stringify({ csrf: !!state.csrf, captcha: state.captchaBreakers, pause: pauseInfo.reason, memory: memSkips.map(s => s.key) });
    }
    const cs = panel.querySelector('#gb-collect-state');
    if (cs) {
      const csTxt = pauseInfo.reason ? `paused:${pauseInfo.reason}` : '';
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
        ? `⏱ farms: ${fmtSec(Math.max(0, Math.round((state.nextFarmScrape - Date.now()) / 1000)))}`
        : '⏱ farms: —';
      if (t !== _timerFarmLast) { _timerFarmLast = t; fe.textContent = t; }
    }
    if (te) {
      const t = state.nextTownsScrape
        ? `⏱ towns: ${fmtSec(Math.max(0, Math.round((state.nextTownsScrape - Date.now()) / 1000)))}`
        : '⏱ towns: —';
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
        flash('diag copied');
        gbLog('diag: copied ' + farms.length + ' farms, csrf=' + (state.csrf ? 'yes' : 'NO'));
      };
      const failFlash = () => {
        flash('diag ready — paste from console');
        gbLog('diag: clipboard fail — expand [grepbot] diag in console');
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

