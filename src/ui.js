  // Per-tab sticky UI state (sort column, list filters). state.tabFilters existed
  // since v1.5 and was never read or written - this is what it was for.
  function tabFilters() {
    if (!state.tabFilters || typeof state.tabFilters !== 'object') state.tabFilters = {};
    return state.tabFilters;
  }
  function tabFilterGet(key) { return tabFilters()[key] != null ? tabFilters()[key] : null; }
  function tabFilterSet(key, val) {
    const f = tabFilters();
    if (val == null || val === '') delete f[key];
    else f[key] = val;
    save(STORE.TAB_FILTERS, f);
  }
  const _gbSortFn = new WeakMap();
  function sortRows(table, col, asc) {
    const rowDataFn = _gbSortFn.get(table);
    if (!rowDataFn) return;
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody') || table;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (!rows.length) return;
    if (thead) {
      thead.querySelectorAll('th').forEach(h => delete h.dataset.sort);
      const th = thead.querySelectorAll('th')[col];
      if (th) th.dataset.sort = asc ? 'asc' : 'desc';
    }
    rows.sort((a, b) => {
      const av = rowDataFn(a, col), bv = rowDataFn(b, col);
      const an = parseFloat(av), bn = parseFloat(bv);
      const cmp = (!isNaN(an) && !isNaN(bn)) ? an - bn : String(av).localeCompare(String(bv));
      return asc ? cmp : -cmp;
    });
    rows.forEach(r => tbody.appendChild(r));
  }
  // Row-set rebuilds (tbody.replaceChildren) drop the chosen order, so the sort
  // has to be re-applied after every rebuild, not only on click.
  function sortApplySaved(table) {
    const key = table && table.dataset ? table.dataset.gbSortKey : '';
    if (!key) return;
    const saved = tabFilterGet('sort:' + key);
    if (!saved || saved.col == null) return;
    sortRows(table, +saved.col, !!saved.asc);
  }
  function makeSortable(table, rowDataFn, key) {
    const thead = table.querySelector('thead');
    if (!thead) return;
    _gbSortFn.set(table, rowDataFn);
    if (key) table.dataset.gbSortKey = key;
    thead.querySelectorAll('th').forEach((th, col) => {
      if (th.dataset.nosort) return;
      th.style.cursor = 'pointer';
      th.title = 'sort';
      th.addEventListener('click', () => {
        const asc = th.dataset.sort !== 'asc';
        sortRows(table, col, asc);
        if (key) tabFilterSet('sort:' + key, { col, asc });
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
  function tableShell(list, headers, key) {
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
      makeSortable(table, (tr, col) => (tr.dataset.sort || '').split('\t')[col] || '', key);
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
      farmProfitCell(f),
      { cls: r ? (r.ok ? 'stale' : 'err') : 'stale',
        text: r ? (r.ok ? `${Math.round((Date.now() - r.ts) / 1000)}s` : (r.err || 'err')) : '-' },
    ];
  }
  // '-' means "not ranked" and carries the reason in the tooltip - a village
  // whose town capacity is unreadable must not render as a zero-yield village.
  function farmProfitCell(f) {
    const p = (state.farmProfit || {})[String(f.vill_id)];
    if (!p || p.score == null) return { cls: 'stale', text: '-' };
    return { cls: '', text: String(Math.round(p.score * 60)) };
  }
  // A village sweep updates state per village and used to repaint the whole
  // table (and the whole World table) once per village - 40 full rebuilds per
  // 5min cycle for a 40-village account. These coalesce the burst into one paint
  // at the end of the sweep. Use the *Soon form from any per-item loop; the bare
  // render stays for click paths that must paint now.
  const RENDER_SOON_MS = 120;
  let _renderFarmsSoonT = 0;
  let _renderWorldSoonT = 0;
  function renderFarmsSoon() {
    if (_renderFarmsSoonT) return;
    _renderFarmsSoonT = gbTimeout(() => { _renderFarmsSoonT = 0; try { renderFarms(); } catch (_) {} }, RENDER_SOON_MS);
  }
  function renderWorldSoon() {
    if (_renderWorldSoonT) return;
    _renderWorldSoonT = gbTimeout(() => { _renderWorldSoonT = 0; try { renderWorld(); } catch (_) {} }, RENDER_SOON_MS);
  }
  function renderFarms() {
    renderSleepStatus();
    const list = panel && panel.querySelector('.farms-list');
    if (!list) return;
    // Nothing below is observable while the browser tab is hidden or the hosting
    // panel section is not the visible one; a village sweep otherwise rebuilds
    // the table once per village for nobody. showTab() re-renders on the way in,
    // so there is no stale-paint window.
    // Resolved via closest() rather than a fixed data-tab value: the farms list
    // is a block inside a section, not a tab of its own (TAB_GROUPS has no
    // 'farms' id), so a hardcoded selector would silently never match.
    if (document.hidden) return;
    const sec = list.closest('section[data-tab]');
    if (sec && sec.hidden) return;
    if (!state.farmsParsed.length) {
      if (!list.querySelector('div')) placeholder(list, 'no farms parsed yet - add vill_id lines below');
      return;
    }
    try { farmProfitRefresh(); } catch (_) {}
    const table = tableShell(list, ['id', 'name', 'W', 'S', 'I', 'pop', 'res/min', 'seen', ''], 'farms');
    const tbody = table.querySelector('tbody');

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
        // Farm-town attacks use a different game path than Town/sendUnits. The old ATK button
        // prepared an objective that the sender intentionally refuses, so it is removed fail-closed.
        const thrBtn = document.createElement('button');
        thrBtn.textContent = 'THR'; thrBtn.title = 'Set threshold';
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
      const prof = (state.farmProfit || {})[String(f.vill_id)];
      // Unranked sorts as '' (string compare), never 0 - a blind village is
      // unknown, not worthless.
      const sort = [f.vill_id, r?.name || '', r?.wood ?? '', r?.stone ?? '', r?.iron ?? '', r?.pop ?? '',
        prof && prof.score != null ? Math.round(prof.score * 60) : '', r?.ts ?? ''].join('\t');
      if (tr.dataset.sort !== sort) tr.dataset.sort = sort;
      patchCells(tr, cells);
    }
    if (!sameSet) sortApplySaved(table);
  }
  let _worldTotalsLast = '';
  function renderWorld() {
    const totals = panel.querySelector('.world-totals');
    const list = panel.querySelector('.world-list');
    if (!totals || !list) return;
    // Same rationale as renderFarms: towns.js calls this once per scraped town,
    // and townPopState() runs per town inside. Hidden = no observer, no work.
    if (document.hidden) return;
    const sec = list.closest('section[data-tab]');
    if (sec && sec.hidden) return;
    let w = 0, s = 0, i = 0, p = 0, okN = 0;
    for (const r of Object.values(state.townResources)) {
      if (!r || !r.ok) continue;
      okN++;
      if (r.wood != null) w += r.wood;
      if (r.stone != null) s += r.stone;
      if (r.iron != null) i += r.iron;
      if (r.pop != null) p += r.pop;
    }
    // Population subtotal from the same walk: how many towns are at/near the
    // pop cap, so a warehouse-focused user still sees the recruit ceiling.
    let popNear = 0, popWarn = 0, popRead = 0;
    for (const t of state.towns) {
      const ps = townPopState(t.id);
      if (!ps || ps.usedPct == null) continue;
      popRead++;
      if (ps.warn) popWarn++; else if (ps.near) popNear++;
    }
    const head = `${state.towns.length} towns | ${okN} ok`;
    const popTxt = popRead
      ? ` | poblacion ${popWarn} al limite / ${popNear} cerca / ${popRead} leidas`
      : ' | poblacion no legible';
    // Same computation the pre-warn watcher uses - one source of truth.
    let preTxt = '';
    try {
      const pre = cappingPending();
      if (pre.length) preTxt = '\npreaviso: ' + pre.slice(0, 6).map(x => `${x.name}: ${x.resource} ~${x.etaMin}min`).join(' | ');
    } catch (_) {}
    const res = `Wood ${fmt(w)} | Stone ${fmt(s)} | Iron ${fmt(i)} | Pop ${fmt(p)}${popTxt}${preTxt}`;
    if (head + res !== _worldTotalsLast) {
      _worldTotalsLast = head + res;
      totals.replaceChildren();
      const totalsH = document.createElement('div');
      totalsH.style.cssText = 'font-weight:bold;color:#f5a623';
      totalsH.textContent = head;
      if (popWarn) totalsH.className = 'pop-warn-row';
      totals.appendChild(totalsH);
      const totalsR = document.createElement('div');
      totalsR.style.cssText = 'color:#cfc;margin-top:3px;white-space:pre-wrap';
      totalsR.textContent = res;
      totals.appendChild(totalsR);
    }
    if (!state.towns.length) {
      if (!list.querySelector('div')) placeholder(list, 'no towns loaded yet - click Refresh towns');
      return;
    }
    const table = tableShell(list, ['id', 'name', 'W', 'S', 'I', 'pop', 'seen'], 'world');
    const tbody = table.querySelector('tbody');
    const wanted = state.towns.map(t => String(t.id));
    const have = new Set(Array.from(tbody.children).map(tr => tr.dataset.key));
    const sameSet = have.size === wanted.length && wanted.every(k => have.has(k));
    if (!sameSet) tbody.replaceChildren();
    for (const t of state.towns) {
      const key = String(t.id);
      const r = state.townResources[t.id];
      const ps = townPopState(t.id);
      const cells = [
        { cls: 'id', text: String(t.id) },
        { cls: '', text: t.name || '-' },
        { cls: '', text: r?.ok ? fmt(r.wood) : '-' },
        { cls: '', text: r?.ok ? fmt(r.stone) : '-' },
        { cls: '', text: r?.ok ? fmt(r.iron) : '-' },
        popCell(ps, r),
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
      const sort = [t.id, t.name || '', r?.wood ?? '', r?.stone ?? '', r?.iron ?? '', ps?.usedPct ?? (r?.pop ?? ''), r?.ts ?? ''].join('\t');
      if (tr.dataset.sort !== sort) tr.dataset.sort = sort;
      patchCells(tr, cells);
    }
    if (!sameSet) sortApplySaved(table);
  }
  // One cell, three segments - NOT three <div>s as plan 2.7 sketched:
  // patchCells only manages textContent + className, and rebuilding the cell as
  // HTML on every render would defeat the keyed-row patching the v1.4.0 render
  // rules exist to protect.
  function popCell(ps, r) {
    const cap = (ps && ps.cap) ?? (r && r.cap);
    const used = (ps && ps.used != null) ? ps.used : (r && r.ok ? r.pop : null);
    if (used == null && !(cap > 0)) return { cls: '', text: '-' };
    const pctTxt = (ps && ps.usedPct != null) ? ` · ${ps.usedPct}%` : ' · -';
    const eta = (ps && ps.etaMs != null) ? ' · ' + fmtSec(Math.round(ps.etaMs / 1000)) : ' · —';
    const cls = ps && ps.warn ? 'pop-warn' : (ps && ps.near ? 'pop-near' : '');
    return { cls, text: `${fmt(used)}/${fmt(cap)}${pctTxt}${eta}` };
  }
  function fmt(n) {
    if (n == null) return '-';
    if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
    if (n >= 1000) return Math.round(n/1000) + 'k';
    return String(n);
  }
  const PANEL_MIN_W = 360, PANEL_MIN_H = 200, PANEL_SQ = 40;
  // Stroke icons on a 24-unit grid, one visual family. LITERAL markup only -
  // these strings are assigned through gbLit, so nothing off the wire may ever
  // reach them (same rule as the panel template).
  const GB_ICONS = {
    home: '<path d="M3 11l9-7 9 7"></path><path d="M5 10v10h14V10"></path>',
    sword: '<path d="M4 20l7-7"></path><path d="M14 4l6 6-9 9H5v-6z"></path>',
    gear: '<circle cx="12" cy="12" r="3"></circle><path d="M19 12a7 7 0 0 0-.2-1.6l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2.8-1.6L13.4 2h-3.9l-.3 2.9a7 7 0 0 0-2.8 1.6l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 3.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2.8 1.6l.3 2.9h3.9l.3-2.9a7 7 0 0 0 2.8-1.6l2.3 1 2-3.4-2-1.5c.1-.5.2-1 .2-1.6z"></path>',
    pulse: '<path d="M3 12h4l2 6 4-14 2 8h6"></path>',
    plus: '<path d="M5 12h14"></path><path d="M12 5v14"></path>',
    village: '<path d="M3 21V9l9-6 9 6v12"></path><path d="M9 21v-6h6v6"></path>',
    list: '<path d="M4 6h16"></path><path d="M4 12h16"></path><path d="M4 18h10"></path>',
    shield: '<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"></path>',
    bars: '<path d="M4 19h16"></path><path d="M7 19v-7"></path><path d="M12 19V6"></path><path d="M17 19v-4"></path>',
    clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"></rect>',
    alert: '<path d="M12 3l9 16H3z"></path><path d="M12 9v5"></path><path d="M12 17h.01"></path>',
    info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 8v5"></path><path d="M12 16h.01"></path>',
    check: '<circle cx="12" cy="12" r="9"></circle><path d="M8 12.5l2.5 2.5 5-5"></path>',
  };
  function gbIcon(name, size, color) {
    const body = GB_ICONS[name];
    if (!body) return null;
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('width', String(size || 13));
    el.setAttribute('height', String(size || 13));
    el.setAttribute('viewBox', '0 0 24 24');
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', color || 'currentColor');
    el.setAttribute('stroke-width', '2');
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = gbLit(body);
    return el;
  }

  // v5.9.0: four groups instead of three. 'Inicio' and 'Sistema' were labels
  // that did not say what was inside them, and 'Inicio' held a single tab, so
  // the sub-tab row below it was a whole row of chrome offering no choice -
  // paintNav now hides that row for any single-tab group. Tab IDS are
  // unchanged (state.activeTab persists one), only the grouping and the labels
  // move.
  const TAB_GROUPS = [
    { id: 'home', label: 'Resumen', icon: 'home', tabs: [
      { id: 'overview', label: 'Resumen' },
    ]},
    { id: 'military', label: 'Militar', icon: 'sword', tabs: [
      { id: 'attack', label: 'Ataques' },
      { id: 'reinforce', label: 'Refuerzos' },
      { id: 'train', label: 'Entrenamiento' },
      { id: 'spy', label: 'Espionaje' },
      { id: 'intel', label: 'Inteligencia' },
    ]},
    { id: 'settings', label: 'Ajustes', icon: 'gear', tabs: [
      { id: 'config', label: 'Ajustes' },
    ]},
    { id: 'diag', label: 'Diagnóstico', icon: 'pulse', tabs: [
      { id: 'stats', label: 'Diagnóstico' },
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
    flash('panel restablecido');
  }
  // Badge count for a nav group: how many things inside are waiting on the
  // user. A count that cannot be READ returns null and paints no badge - an
  // unreadable collection must never render as a reassuring 0 (CLAUDE.md
  // "never render an unreadable number as 0").
  function navBadgeCount(groupId) {
    try {
      if (groupId === 'military') {
        if (typeof dodgeIncomingMovements !== 'function') return null;
        const inc = dodgeIncomingMovements();
        return Array.isArray(inc) ? inc.length : null;
      }
      if (groupId === 'diag') {
        const unknown = Object.values(state.txState || {}).filter(t => t && /^(unknown|manual-review)$/.test(t.state || '')).length;
        const open = Object.keys(state.circuits || {}).filter(k => state.circuits[k] && state.circuits[k].open).length;
        return unknown + open;
      }
    } catch (_) { return null; }
    return 0;
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
      const ico = gbIcon(g.icon, 13);
      if (ico) b.appendChild(ico);
      b.appendChild(document.createTextNode(g.label));
      const n = navBadgeCount(g.id);
      if (n) {
        const bad = document.createElement('span');
        bad.className = 'gb-nav-badge';
        bad.textContent = String(n);
        gbTip(bad, g.id === 'military' ? 'Movimientos hostiles en camino' : 'Envios sin confirmar y cortacircuitos abiertos');
        b.appendChild(bad);
      }
      if (g.id === group.id) b.classList.add('on');
      b.addEventListener('click', () => {
        if (g.id === group.id) return;
        const prefer = _lastTabInGroup[g.id] || g.tabs[0].id;
        showTab(prefer);
      });
      nav.appendChild(b);
    });

    // A group with one tab has nothing to choose: the row would be pure chrome.
    sub.hidden = group.tabs.length < 2;
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
  // ===== Theme (v4 plan 6.1) =================================================
  // 'system' resolves ONCE at apply time. This is a two-value toggle, not a
  // sync engine: adding a matchMedia listener would mean repainting the panel
  // whenever the OS flips, which nobody asked for.
  const GB_THEMES = ['dark', 'light', 'system'];
  function gbThemeResolved() {
    const t = GB_THEMES.includes(state.theme) ? state.theme : 'dark';
    if (t !== 'system') return t;
    try {
      return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    } catch (_) { return 'dark'; }
  }
  function applyTheme() {
    const cls = 'gb-theme-' + gbThemeResolved();
    const targets = [panel, (gbQueueCenter || null)];
    // Widget hosts (v4 plan 6.2) live on document.body, not inside the panel,
    // so they need the theme class themselves or their var() lookups resolve
    // to nothing and they render unstyled.
    try { document.querySelectorAll('.gb-widget').forEach(w => targets.push(w)); } catch (_) {}
    for (const el of targets) {
      if (!el || !el.classList) continue;
      el.classList.remove('gb-theme-dark', 'gb-theme-light');
      el.classList.add(cls);
    }
  }
  function showTab(tabId, opts) {
    if (!panel) return;
    if (!TAB_IDS.includes(tabId)) tabId = 'overview';
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
      if (tabId === 'attack') renderAttack();
      else if (tabId === 'reinforce') renderReinforce();
      else if (tabId === 'spy') renderSpySend();
      else if (tabId === 'log') { renderLog(); renderJournal(); }
      else if (tabId === 'stats') { renderStats(); renderOverview(); }
      else if (tabId === 'overview') renderOverview();
      else if (tabId === 'intel') renderIntel();
      else if (tabId === 'train') renderTrain();
      else if (tabId === 'config') { bindConfig(); renderCaveTowns(); }
      return;
    }
    if (tabId === 'attack') { bindAttackTab(); renderAttack(); }
    if (tabId === 'reinforce') { bindReinforceTab(); renderReinforce(); }
    if (tabId === 'spy') { bindSpyTab(); renderSpySend(); }
    if (tabId === 'train') { bindTrainTab(); renderTrain(); }
    if (tabId === 'config') { bindConfig(); renderCaveTowns(); }
    if (tabId === 'overview') renderOverview();
    if (tabId === 'intel') renderIntel();
    if (tabId === 'log') { renderLog(); renderJournal(); }
    if (tabId === 'stats') { renderStats(); renderOverview(); }
  }

  gbAddStyle('panel', `
    /* ===== Theme system (v4 plan 6.1) =======================================
       Every recurring palette literal in this stylesheet is a custom property.
       The DEFAULT rule carries today's exact dark values, so an install that
       never touches the setting looks identical and no migration is needed.
       .gb-theme-light re-points the same names. There is deliberately NO
       .gb-theme-dark rule: it used to be a byte-identical copy of the default
       block (54 duplicated declarations parsed on every install) and applyTheme
       only ever ADDS a class, so the default already covers both the class-less
       host and the resolved-dark one. Nothing outside #grepbot-panel
       and #grepbot-queue-center is scoped, so the game's own DOM is untouched.
       ===================================================================== */
    #grepbot-panel, #grepbot-queue-center, .gb-widget {
      --gb-bg:#181a1f;
      --gb-bg-deep:#17191e;
      --gb-bg-alt:#22252b;
      --gb-bg-alt2:#202329;
      --gb-bg-alt3:#22262d;
      --gb-bg-alt4:#292d35;
      --gb-bg-raise:#2b3038;
      --gb-bg-row:#262626;
      --gb-rule:#2a2a2a;
      --gb-input-bg:#111;
      --gb-chrome:#333;
      --gb-chrome-2:#444;
      --gb-chrome-3:#555;
      --gb-border:#414650;
      --gb-border-soft:#353a44;
      --gb-border-soft2:#353b45;
      --gb-border-hard:#59616f;
      --gb-fg:#eef1f5;
      --gb-fg-2:#eee;
      --gb-fg-hi:#fff;
      --gb-fg-soft:#cbd1da;
      --gb-fg-soft2:#aeb5c0;
      --gb-fg-soft3:#ccc;
      --gb-fg-mute:#aaa;
      --gb-fg-mute2:#888;
      --gb-fg-mute3:#777;
      --gb-fg-mute4:#666;
      --gb-fg-dim:#8f98a5;
      --gb-fg-dim2:#9fa7b3;
      --gb-accent:#f5a623;
      --gb-accent-2:#f0c060;
      --gb-accent-3:#c98b22;
      --gb-link:#6cf;
      --gb-input-fg:#cfc;
      --gb-ok:#8fe0a8;
      --gb-ok-2:#9d9;
      --gb-ok-3:#6dda7e;
      --gb-ok-4:#80e090;
      --gb-ok-5:#4caf50;
      --gb-ok-border:#3c7350;
      --gb-ok-bg:#1c3023;
      --gb-warn:#ffd27a;
      --gb-warn-2:#fc6;
      --gb-warn-3:#f96;
      --gb-warn-bg:#3a321f;
      --gb-warn-bg2:#382e1c;
      --gb-warn-border:#8a6725;
      --gb-err:#ff9aa3;
      --gb-err-2:#f55;
      --gb-err-3:#f66;
      --gb-err-4:#faa;
      --gb-err-bg:#381f23;
      --gb-err-border:#8a3b42;
    }
    #grepbot-panel.gb-theme-light, #grepbot-queue-center.gb-theme-light, .gb-widget.gb-theme-light {
      --gb-bg:#f4f5f7;
      --gb-bg-deep:#eceef1;
      --gb-bg-alt:#e8eaee;
      --gb-bg-alt2:#eceef1;
      --gb-bg-alt3:#e4e7ec;
      --gb-bg-alt4:#dfe3e9;
      --gb-bg-raise:#dde1e7;
      --gb-bg-row:#e9ebef;
      --gb-rule:#d5d9df;
      --gb-input-bg:#ffffff;
      --gb-chrome:#d9dde3;
      --gb-chrome-2:#cdd2d9;
      --gb-chrome-3:#b8bfc9;
      --gb-border:#b0b7c2;
      --gb-border-soft:#c6ccd4;
      --gb-border-soft2:#c6ccd4;
      --gb-border-hard:#98a1ad;
      --gb-fg:#1b1e24;
      --gb-fg-2:#23262c;
      --gb-fg-hi:#000000;
      --gb-fg-soft:#33373f;
      --gb-fg-soft2:#3c4149;
      --gb-fg-soft3:#3c4149;
      --gb-fg-mute:#5b6270;
      --gb-fg-mute2:#5b6270;
      --gb-fg-mute3:#6b7280;
      --gb-fg-mute4:#6b7280;
      --gb-fg-dim:#5b6270;
      --gb-fg-dim2:#5b6270;
      --gb-accent:#a3660b;
      --gb-accent-2:#8a5709;
      --gb-accent-3:#6f4507;
      --gb-link:#0b62b0;
      --gb-input-fg:#14361f;
      --gb-ok:#1d7a3e;
      --gb-ok-2:#1d7a3e;
      --gb-ok-3:#166b34;
      --gb-ok-4:#166b34;
      --gb-ok-5:#1d7a3e;
      --gb-ok-border:#8fc9a4;
      --gb-ok-bg:#dff3e6;
      --gb-warn:#8a5a00;
      --gb-warn-2:#8a5a00;
      --gb-warn-3:#a34a12;
      --gb-warn-bg:#fdf1d6;
      --gb-warn-bg2:#fdf1d6;
      --gb-warn-border:#d9b268;
      --gb-err:#b3121f;
      --gb-err-2:#b3121f;
      --gb-err-3:#c0202c;
      --gb-err-4:#c0202c;
      --gb-err-bg:#fbe3e5;
      --gb-err-border:#e29aa1;
    }
    #grepbot-panel .gb-qat{display:flex;gap:4px;align-items:center;flex-wrap:wrap;padding:4px 6px;border-bottom:1px solid var(--gb-border-soft);background:var(--gb-bg-alt2)}
    #grepbot-panel .gb-qat button{background:var(--gb-chrome);border:1px solid var(--gb-chrome-3);color:var(--gb-fg-2);padding:2px 7px;cursor:pointer;font-size:10px;border-radius:3px}
    #grepbot-panel .gb-qat button:disabled{opacity:.45;cursor:not-allowed}
    #grepbot-panel{position:fixed;top:10px;right:10px;width:560px;min-width:430px;max-width:92vw;max-height:82vh;z-index:2147483647;
      background:var(--gb-bg);color:var(--gb-fg);font:12px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif,"Segoe UI Symbol","Noto Sans Symbols 2","DejaVu Sans";border:1px solid var(--gb-border);border-radius:10px;
      box-shadow:0 4px 16px rgba(0,0,0,.5);display:flex;flex-direction:column;visibility:visible !important;opacity:1 !important;
      box-sizing:border-box;}
    #grepbot-panel header{padding:8px 10px;background:var(--gb-bg-alt);cursor:move;touch-action:none;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-shrink:0;border-radius:10px 10px 0 0}
    #grepbot-panel header b{color:var(--gb-accent);font-weight:600}
    #grepbot-panel header button{background:none;border:1px solid var(--gb-chrome-3);color:var(--gb-fg-2);padding:2px 6px;border-radius:3px;cursor:pointer;font-size:11px}
    #grepbot-panel .gb-nav{display:flex;gap:4px;padding:7px 8px 5px;background:var(--gb-bg-alt2);flex-shrink:0;border-bottom:1px solid var(--gb-border-soft);overflow-x:auto}
    #grepbot-panel .gb-nav button{flex:0 0 auto;padding:5px 10px;background:var(--gb-bg-alt4);border:1px solid transparent;border-radius:7px;color:var(--gb-fg-soft2);cursor:pointer;font:600 11px system-ui,-apple-system,Segoe UI,sans-serif}
    #grepbot-panel .gb-nav button:hover{color:var(--gb-fg-soft3)}
    #grepbot-panel .gb-nav button.on{color:var(--gb-fg-hi);background:var(--gb-warn-bg);border-color:var(--gb-accent-3)}
    #grepbot-panel .gb-subtabs{display:flex;gap:4px;padding:5px 8px;background:var(--gb-bg-deep);border-bottom:1px solid var(--gb-border-soft);flex-shrink:0;overflow-x:auto}
    #grepbot-panel .gb-subtabs button{flex:0 0 auto;padding:4px 9px;background:transparent;border:1px solid transparent;border-radius:6px;color:var(--gb-fg-dim2);cursor:pointer;font:11px system-ui,-apple-system,Segoe UI,sans-serif;white-space:nowrap}
    #grepbot-panel .gb-subtabs button:hover{color:var(--gb-fg-2);border-color:var(--gb-chrome-3)}
    #grepbot-panel .gb-subtabs button.on{background:var(--gb-bg-raise);color:var(--gb-fg-hi);border-color:var(--gb-border-hard)}
    #grepbot-panel section{padding:8px 10px;overflow:auto;flex:1;min-height:0}
    #grepbot-panel footer{padding:6px 10px;border-top:1px solid var(--gb-chrome-2);display:flex;gap:8px;align-items:center;flex-shrink:0;position:relative}
    #grepbot-panel footer .gb-status-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;flex:1;min-width:0;font-size:10px}
    #grepbot-panel footer .gb-actions{position:relative;flex-shrink:0}
    #grepbot-panel footer .gb-actions > summary{list-style:none;cursor:pointer;background:var(--gb-chrome);border:1px solid var(--gb-chrome-3);color:var(--gb-fg-2);padding:3px 8px;border-radius:3px;font-size:11px;user-select:none}
    #grepbot-panel footer .gb-actions > summary::-webkit-details-marker{display:none}
    #grepbot-panel footer .gb-actions-menu{position:absolute;right:0;bottom:calc(100% + 4px);min-width:140px;background:var(--gb-bg-row);border:1px solid var(--gb-chrome-3);border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,.5);display:flex;flex-direction:column;padding:4px;z-index:5}
    #grepbot-panel footer .gb-actions-menu button{background:transparent;border:0;color:var(--gb-fg-2);padding:5px 8px;text-align:left;cursor:pointer;font:11px monospace;border-radius:2px}
    #grepbot-panel footer .gb-actions-menu button:hover{background:var(--gb-chrome);color:var(--gb-accent)}
    #grepbot-panel textarea{width:100%;height:100%;min-height:180px;background:var(--gb-input-bg);color:var(--gb-input-fg);border:1px solid var(--gb-chrome);font:11px/1.4 monospace;resize:vertical}
    #grepbot-panel .gb-resize{position:absolute;z-index:2;background:transparent;user-select:none}
    #grepbot-panel .gb-resize-n{top:-2px;left:8px;right:8px;height:8px;cursor:n-resize}
    #grepbot-panel .gb-resize-s{bottom:-2px;left:8px;right:8px;height:8px;cursor:s-resize}
    #grepbot-panel .gb-resize-e{right:-2px;top:8px;bottom:8px;width:8px;cursor:e-resize}
    #grepbot-panel .gb-resize-w{left:-2px;top:8px;bottom:8px;width:8px;cursor:w-resize}
    #grepbot-panel .gb-resize-ne,#grepbot-panel .gb-resize-nw,#grepbot-panel .gb-resize-se,#grepbot-panel .gb-resize-sw{width:12px;height:12px;z-index:3}
    #grepbot-panel .gb-resize-ne{top:-2px;right:-2px;cursor:ne-resize}
    #grepbot-panel .gb-resize-nw{top:-2px;left:-2px;cursor:nw-resize}
    #grepbot-panel .gb-resize-se{right:0;bottom:0;cursor:se-resize;
      background:linear-gradient(135deg,transparent 50%,var(--gb-fg-mute4) 50%,var(--gb-fg-mute4) 60%,transparent 60%,transparent 70%,var(--gb-fg-mute4) 70%,var(--gb-fg-mute4) 80%,transparent 80%)}
    #grepbot-panel .gb-resize-sw{bottom:-2px;left:-2px;cursor:sw-resize}
    #grepbot-panel.collapsed{width:${PANEL_SQ}px !important;height:${PANEL_SQ}px !important;max-height:none !important;min-width:0;min-height:0;
      overflow:hidden;padding:0;border-radius:6px;cursor:move}
    #grepbot-panel.collapsed header{padding:0;width:100%;height:100%;justify-content:center;align-items:center;border:0}
    #grepbot-panel.collapsed header b{display:none}
    /* Scope the collapse-icon rules to the toggle button only. The Colas button
       shares the header but must remain a real button (and would otherwise
       overlap the toggle glyph with its own "GB" ::before). */
    #grepbot-panel.collapsed header button[data-act=toggle]{border:0;padding:0;flex:1;width:auto;height:100%;font-size:0;font-weight:700;color:var(--gb-accent);border-radius:6px;cursor:pointer}
    #grepbot-panel.collapsed header button[data-act=toggle]::before{content:"GB";display:block;font-size:11px;line-height:${PANEL_SQ}px}
    /* Hide Colas while collapsed so the toggle (restore) owns the whole 40x40.
       Flex would otherwise give Colas its content width and collapse toggle to ~0px. */
    #grepbot-panel.collapsed header [data-act=queues]{display:none}
    /* The Colas+toggle wrapper div has no explicit height, so height:100% on the
       toggle resolves to 0. Stretch the wrapper so the toggle fills the header. */
    #grepbot-panel.collapsed header > div:last-child{height:100%}
    /* Hide header status pills when collapsed so the square stays a square. */
    #grepbot-panel.collapsed .gb-head-main,#grepbot-panel.collapsed .gb-head-status,#grepbot-panel.collapsed .gb-head-mode,#grepbot-panel.collapsed .gb-head-health{display:none !important}
    #grepbot-panel.collapsed .gb-qat,#grepbot-panel.collapsed .gb-nav,#grepbot-panel.collapsed .gb-subtabs,#grepbot-panel.collapsed section,#grepbot-panel.collapsed footer,#grepbot-panel.collapsed .gb-resize{display:none !important}
    #grepbot-panel .farms-list{margin-bottom:6px;max-height:200px;overflow:auto}
    #grepbot-panel .farms-list table{width:100%;border-collapse:collapse;font-size:10px}
    #grepbot-panel .farms-list th,#grepbot-panel .farms-list td{padding:2px 4px;border-bottom:1px solid var(--gb-rule);text-align:right}
    #grepbot-panel .farms-list th{background:var(--gb-bg-row);color:var(--gb-fg-mute);text-align:left;font-weight:normal;position:sticky;top:0}
    #grepbot-panel .farms-list td.id{text-align:left;color:var(--gb-link);font-family:monospace}
    #grepbot-panel .farms-list td.stale{color:var(--gb-fg-mute2)}
    #grepbot-panel .farms-list td.err{color:var(--gb-err-2)}
    #grepbot-panel td.pop-near{color:var(--gb-warn-2)}
    #grepbot-panel td.pop-warn{color:var(--gb-err-3);font-weight:bold}
    #grepbot-panel .pop-warn-row{color:var(--gb-err-3);font-weight:bold}
    #grepbot-panel .farms-list tr.alert td{background:rgba(255,80,80,.18);color:var(--gb-err-4)}
    #grepbot-panel .farms-list tr.alert td.id{color:var(--gb-err-2);font-weight:bold}
    #grepbot-panel .world-list table{width:100%;border-collapse:collapse;font-size:10px}
    #grepbot-panel .world-list th,#grepbot-panel .world-list td{padding:2px 4px;border-bottom:1px solid var(--gb-rule);text-align:right}
    #grepbot-panel .world-list th{background:var(--gb-bg-row);color:var(--gb-fg-mute);text-align:left;font-weight:normal;position:sticky;top:0}
    #grepbot-panel .world-list td.id{text-align:left;color:var(--gb-link);font-family:monospace}
    #grepbot-panel .finding{padding:6px;border-bottom:1px solid var(--gb-rule);font-size:11px}
    #grepbot-panel .finding .meta{color:var(--gb-fg-mute2);margin-bottom:3px}
    #grepbot-panel .finding .units{color:var(--gb-link)}
    #grepbot-panel .finding .res{color:var(--gb-warn-3)}
    #grepbot-panel .log-list{height:100%;min-height:180px;max-height:280px;overflow:auto;font-size:10px;white-space:pre-wrap;word-break:break-word;color:var(--gb-ok-2);background:var(--gb-input-bg);padding:4px;border:1px solid var(--gb-chrome)}
    #grepbot-panel .gb-logsub{display:flex;gap:4px;align-items:center;margin-bottom:4px}
    #grepbot-panel .gb-logsub button{background:var(--gb-bg-row);border:1px solid var(--gb-chrome);color:var(--gb-fg-mute);padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px}
    #grepbot-panel .gb-logsub button.on{background:var(--gb-chrome);color:var(--gb-fg-hi);border-color:var(--gb-chrome-3)}
    #grepbot-panel .gb-logsub input{flex:1;min-width:0;background:var(--gb-input-bg);color:var(--gb-input-fg);border:1px solid var(--gb-chrome);font:10px monospace;padding:2px 4px}
    #grepbot-panel .jrn-head{font-size:10px;color:var(--gb-fg-mute2);margin-bottom:3px}
    #grepbot-panel .jrn-head b{color:var(--gb-warn-3)}
    #grepbot-panel .jrn-list{min-height:160px;max-height:250px;overflow:auto;font-size:10px;background:var(--gb-input-bg);border:1px solid var(--gb-chrome);padding:2px}
    #grepbot-panel .jrn-list table{width:100%;border-collapse:collapse}
    #grepbot-panel .jrn-list td{padding:1px 3px;border-bottom:1px solid var(--gb-rule);vertical-align:top}
    #grepbot-panel .jrn-list td.t{color:var(--gb-fg-mute4);white-space:nowrap}
    #grepbot-panel .jrn-list td.f{color:var(--gb-link)}
    #grepbot-panel .jrn-list td.a{color:var(--gb-fg-mute);word-break:break-all}
    #grepbot-panel .jrn-list td.k{color:var(--gb-fg-mute2);text-align:right}
    #grepbot-panel .jrn-list td.r{text-align:right;white-space:nowrap}
    #grepbot-panel .jrn-list tr.ok td.r{color:var(--gb-ok-3)}
    #grepbot-panel .jrn-list tr.skip td.r{color:var(--gb-fg-mute3)}
    #grepbot-panel .jrn-list tr.err td.r{color:var(--gb-err-2)}
    #grepbot-panel .jrn-btns{display:flex;gap:4px;margin-top:4px}
    #grepbot-panel .jrn-btns button{background:var(--gb-chrome);border:1px solid var(--gb-chrome-3);color:var(--gb-fg-2);padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px}
    #grepbot-panel .ib-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--gb-chrome-3);transition:background .4s}
    #grepbot-panel .ib-dot.free{background:var(--gb-ok-5)}
    #grepbot-panel .ib-dot.paid{background:var(--gb-accent-2)}
    #grepbot-panel .ib-rows{max-height:240px;overflow:auto;font-size:10px}
    #grepbot-panel .ib-town{color:var(--gb-fg-mute2);font-size:9px;margin-top:4px;margin-bottom:1px}
    #grepbot-panel .ib-row{display:flex;justify-content:space-between;gap:12px;padding:2px 0;border-bottom:1px solid var(--gb-rule)}
    #grepbot-panel .ib-type{color:var(--gb-fg-mute);flex:1}
    #grepbot-panel .ib-time{color:var(--gb-fg-mute2)}
    #grepbot-panel .ib-cost{color:var(--gb-accent-2);min-width:36px;text-align:right}
    #grepbot-panel .ib-free{color:var(--gb-ok-3);font-weight:bold;min-width:36px;text-align:right}
    #grepbot-panel #gb-ib-btn{background:var(--gb-chrome);border:1px solid var(--gb-chrome-3);color:var(--gb-ok-4);padding:2px 8px;border-radius:3px;cursor:pointer;font-size:11px}
    #grepbot-panel #gb-ib-btn:disabled{opacity:.4;cursor:default}
    #grepbot-panel .ab-queue{max-height:220px;overflow:auto;margin-top:2px}
    #grepbot-panel .atk-sched{max-height:160px;overflow:auto;margin-top:6px}
    #grepbot-panel .atk-sources{max-height:80px;overflow:auto;display:flex;flex-wrap:wrap;gap:4px 8px;margin:4px 0}
    #grepbot-panel .atk-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:4px}
    /* display:flex beats the UA sheet rule for [hidden], so a row the renderer
       hides with .hidden = true stayed on screen. */
    #grepbot-panel .atk-row[hidden]{display:none}
    #grepbot-panel .atk-row input,#grepbot-panel .atk-row select{background:var(--gb-input-bg);color:var(--gb-input-fg);border:1px solid var(--gb-chrome);padding:2px 4px;font:11px monospace}
    #grepbot-panel .atk-btns button{background:var(--gb-chrome);border:1px solid var(--gb-chrome-3);color:var(--gb-fg-2);padding:3px 8px;border-radius:3px;cursor:pointer;font-size:11px;margin-right:4px}
    #grepbot-panel .atk-btns #gb-atk-now{color:var(--gb-warn-3)}
    #grepbot-panel .atk-btns #gb-atk-arm{color:var(--gb-link)}
    #grepbot-panel .atk-btns #gb-rf-now,#grepbot-panel .atk-btns #gb-sp-run{color:var(--gb-warn-3)}
    #grepbot-panel .atk-btns #gb-rf-arm{color:var(--gb-link)}
    #grepbot-panel .atk-btns button:disabled{opacity:.45;cursor:not-allowed}
    #grepbot-panel #gb-rf-src-all,#grepbot-panel #gb-rf-src-none,#grepbot-panel #gb-rf-src-off,#grepbot-panel #gb-rf-src-def{background:var(--gb-chrome);border:1px solid var(--gb-chrome-3);color:var(--gb-fg-2);padding:1px 6px;cursor:pointer;font-size:10px}
    #grepbot-panel .rf-sched{max-height:180px;overflow:auto;margin-top:6px}
    #grepbot-panel .sp-hist{font-size:10px}
    #grepbot-panel .atk-harass button,#grepbot-panel .atk-roles button,#grepbot-panel #gb-atk-src-all,#grepbot-panel #gb-atk-src-none,#grepbot-panel #gb-atk-src-off,#grepbot-panel #gb-atk-src-def,#grepbot-panel #gb-atk-cmds-refresh,#grepbot-panel #gb-atk-heroes-refresh,#grepbot-panel #gb-atk-comp-refresh,#grepbot-panel #gb-atk-colony-refresh,#grepbot-panel #gb-plan-import,#grepbot-panel #gb-plan-export,#grepbot-panel #gb-plan-clear,#grepbot-panel .atk-colony button,#grepbot-panel .atk-comp button,#grepbot-panel .atk-cmds button,#grepbot-panel .atk-heroes button{background:var(--gb-chrome);border:1px solid var(--gb-chrome-3);color:var(--gb-fg-2);padding:1px 6px;cursor:pointer;font-size:10px}
    #grepbot-panel .atk-cmds button:disabled,#grepbot-panel .atk-heroes button:disabled{opacity:.45;cursor:not-allowed}
    #grepbot-panel .quest-list{max-height:200px;overflow:auto;font-size:10px}
    #grepbot-panel .quest-row{display:grid;grid-template-columns:1.4fr .5fr 1fr .6fr;gap:4px;border-bottom:1px solid var(--gb-rule);padding:3px 0}
    #grepbot-panel .quest-hist{max-height:100px;overflow:auto;font-size:9px;color:var(--gb-ok-2);margin-top:6px;background:var(--gb-input-bg);padding:4px;border:1px solid var(--gb-chrome);white-space:pre-wrap}
    #grepbot-panel .gb-head-main{display:flex;align-items:center;gap:8px;min-width:0}
    #grepbot-panel .gb-head-status{display:flex;gap:4px;align-items:center;flex-wrap:wrap}
    #grepbot-panel .gb-pill{padding:2px 6px;border-radius:999px;font-size:9px;font-weight:700;border:1px solid var(--gb-chrome-2);background:var(--gb-bg-raise);color:var(--gb-fg-soft)}
    #grepbot-panel .gb-pill.ok{border-color:var(--gb-ok-border);color:var(--gb-ok);background:var(--gb-ok-bg)}
    #grepbot-panel .gb-pill.warn{border-color:var(--gb-warn-border);color:var(--gb-warn);background:var(--gb-warn-bg2)}
    #grepbot-panel .gb-pill.bad{border-color:var(--gb-err-border);color:var(--gb-err);background:var(--gb-err-bg)}
    #grepbot-panel .gb-dashboard-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:6px 0 8px}
    #grepbot-panel .gb-card{background:var(--gb-bg-alt3);border:1px solid var(--gb-border-soft2);border-radius:8px;padding:7px;min-width:0}
    #grepbot-panel .gb-card .k{font-size:9px;color:var(--gb-fg-dim);text-transform:uppercase;letter-spacing:.04em}
    #grepbot-panel .gb-card .v{font-size:17px;font-weight:700;color:#f5f7fa;line-height:1.2;margin-top:2px}
    #grepbot-panel .gb-card .s{font-size:9px;color:#9ca5b2;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #grepbot-panel .gb-quick{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0 8px}
    #grepbot-panel .gb-quick button,#grepbot-panel .gb-action{background:var(--gb-bg-raise);border:1px solid #4a515d;color:var(--gb-fg);padding:5px 8px;border-radius:6px;cursor:pointer;font-size:10px}
    #grepbot-panel .gb-quick button:hover,#grepbot-panel .gb-action:hover{border-color:var(--gb-accent-3)}
    #grepbot-panel .gb-cfg-input{background:var(--gb-input-bg);color:var(--gb-input-fg);border:1px solid var(--gb-chrome);font-size:11px;padding:2px 4px;border-radius:3px;font-family:monospace}
    #grepbot-panel .gb-cfg-row{display:flex;align-items:center;gap:6px;cursor:pointer}
    #grepbot-panel .gb-section{margin:7px 0;border:1px solid var(--gb-border-soft);border-radius:8px;background:var(--gb-bg-alt2);overflow:hidden}
    #grepbot-panel .gb-section>summary{cursor:pointer;list-style:none;padding:7px 9px;font-size:11px;font-weight:700;color:var(--gb-fg);background:var(--gb-bg-alt3);display:flex;align-items:center;justify-content:space-between}
    #grepbot-panel .gb-section>summary::-webkit-details-marker{display:none}
    #grepbot-panel .gb-section>summary::after{content:'+';color:var(--gb-fg-dim);font-size:14px}
    #grepbot-panel .gb-section[open]>summary::after{content:'-'}
    #grepbot-panel .gb-section-body{padding:7px}
    #grepbot-panel .config-panel{font-size:11px;display:flex;flex-direction:column;gap:2px}
    #grepbot-panel .gb-cfg-toolbar{position:sticky;top:0;z-index:2;display:flex;gap:5px;align-items:center;padding:4px 0 6px;background:var(--gb-bg)}
    #grepbot-panel .gb-cfg-filter{flex:1;min-width:0;background:var(--gb-input-bg);color:var(--gb-input-fg);border:1px solid var(--gb-chrome);border-radius:6px;padding:4px 7px;font-size:11px}
    #grepbot-panel .gb-cfg-empty{padding:8px;font-size:10px;color:var(--gb-fg-dim)}
    /* The filter hides rows with the hidden property. .gb-cfg-row / .gb-cfg-num
       set display:flex from a CLASS rule, which outranks the UA sheet's
       [hidden] rule - without this the filter looked like it did nothing.
       (No backticks in this block: it lives inside a template literal.) */
    #grepbot-panel .config-panel [hidden]{display:none!important}
    #grepbot-panel .gb-cfg-group{margin:4px 0}
    #grepbot-panel .gb-cfg-group>.gb-section-body{display:flex;flex-direction:column;gap:5px}
    #grepbot-panel .gb-cfg-group.risk>summary{color:var(--gb-warn-3)}
    #grepbot-panel .gb-cfg-group .gb-cfg-row{padding:2px 4px;border-radius:5px}
    #grepbot-panel .gb-cfg-group .gb-cfg-row:hover{background:var(--gb-bg-alt4)}
    #grepbot-panel .gb-cfg-num{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:1px 4px}
    #grepbot-panel .gb-cfg-sub{margin-left:16px;font-size:10px;color:var(--gb-fg-soft2)}
    #grepbot-panel .gb-cfg-sub .gb-cfg-input{font-size:10px}
    #grepbot-panel .gb-cfg-note{font-size:9px;color:var(--gb-fg-dim);white-space:pre-wrap;margin-left:16px}
    #grepbot-panel .gb-cfg-warn{color:var(--gb-warn-2)}
    #grepbot-panel .gb-cfg-risk{color:var(--gb-warn-3)}
    #grepbot-panel .gb-cfg-accent{color:var(--gb-link)}
    #grepbot-panel .gb-cfg-btn{align-self:flex-start;margin-left:16px;background:var(--gb-bg-raise);border:1px solid var(--gb-chrome-2);color:var(--gb-link);padding:3px 8px;border-radius:5px;cursor:pointer;font-size:10px}
    #grepbot-panel .gb-cfg-btn:hover{border-color:var(--gb-accent-3)}
    #grepbot-panel .gb-cfg-btn.danger{color:var(--gb-warn-3)}
    #grepbot-panel .gb-cfg-btn.ok{color:var(--gb-ok-4)}
    #grepbot-panel .gb-cfg-num .gb-cfg-btn{align-self:auto;margin-left:0}
    #grepbot-panel .cave-towns{display:flex;flex-direction:column;gap:2px;max-height:120px;overflow:auto;margin-left:16px}
    #grepbot-panel pre{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
    @media (max-width:700px){#grepbot-panel{width:94vw;min-width:320px;right:3vw}.gb-dashboard-cards{grid-template-columns:repeat(2,minmax(0,1fr))!important}}

    /* ===== v5.9.0 panel UX rework ==========================================
       New chrome for the Resumen hero/attention/next lists, the icon nav, the
       Ajustes rail and the grouped Acciones menu. Every rule is scoped to
       #grepbot-panel and every colour is a theme custom property, so the light
       theme follows without a second block.
       ===================================================================== */
    /* .gb-subtabs sets display:flex from a CLASS rule, which outranks the UA
       sheet's [hidden] rule - without this the single-tab group's row stayed on
       screen even though paintNav hid it (the .atk-row[hidden] bug again). */
    #grepbot-panel .gb-subtabs[hidden]{display:none}
    #grepbot-panel .gb-nav button svg{flex:0 0 auto}
    #grepbot-panel .gb-nav-badge{background:var(--gb-err-bg);border:1px solid var(--gb-err-border);color:var(--gb-err);border-radius:999px;font-size:9px;font-weight:700;padding:0 5px;line-height:14px}
    #grepbot-panel .gb-qat button{display:inline-flex;align-items:center;gap:4px;border-radius:5px;padding:3px 8px}
    #grepbot-panel .gb-qat .gb-qat-sep{width:1px;height:16px;background:var(--gb-chrome-2)}
    #grepbot-panel .gb-qat button[data-qat=panic]{margin-left:auto;color:var(--gb-err-3);border-color:var(--gb-err-border);background:var(--gb-err-bg);font-weight:700}
    #grepbot-panel .gb-hero{display:flex;align-items:center;gap:9px;margin-bottom:8px}
    #grepbot-panel .gb-hero-dot{width:10px;height:10px;border-radius:50%;background:var(--gb-ok-3);flex:0 0 auto}
    #grepbot-panel .gb-hero-dot.warn{background:var(--gb-warn-2)}
    #grepbot-panel .gb-hero-dot.bad{background:var(--gb-err-2)}
    #grepbot-panel .gb-hero-t{font-size:15px;font-weight:750;line-height:1.2}
    #grepbot-panel .gb-hero-s{font-size:10px;color:var(--gb-fg-dim)}
    #grepbot-panel .gb-chips{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px}
    #grepbot-panel .gb-chip{font-size:10px;color:var(--gb-fg-soft2);background:var(--gb-bg-alt3);border:1px solid var(--gb-border-soft2);border-radius:999px;padding:2px 8px}
    #grepbot-panel .gb-chip.warn{color:var(--gb-warn);border-color:var(--gb-warn-border);background:var(--gb-warn-bg2)}
    #grepbot-panel .gb-chip.bad{color:var(--gb-err);border-color:var(--gb-err-border);background:var(--gb-err-bg)}
    #grepbot-panel .gb-lbl{font-size:10px;font-weight:700;color:var(--gb-fg-dim);text-transform:uppercase;letter-spacing:.05em;margin:8px 0 5px}
    #grepbot-panel .gb-att{display:flex;align-items:flex-start;gap:8px;padding:8px 9px;border-radius:8px;border:1px solid var(--gb-warn-border);background:var(--gb-warn-bg2);margin-bottom:6px}
    #grepbot-panel .gb-att.bad{border-color:var(--gb-err-border);background:var(--gb-err-bg)}
    #grepbot-panel .gb-att-t{font-size:12px;font-weight:700;color:var(--gb-warn)}
    #grepbot-panel .gb-att.bad .gb-att-t{color:var(--gb-err)}
    #grepbot-panel .gb-att-s{font-size:10px;color:var(--gb-fg-soft2)}
    #grepbot-panel .gb-att-ok{font-size:11px;color:var(--gb-fg-dim);padding:2px 0 6px}
    #grepbot-panel .gb-next-row{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;background:var(--gb-bg-alt2);border:1px solid var(--gb-border-soft);margin-bottom:4px}
    #grepbot-panel .gb-next-town{font-size:11px;color:var(--gb-fg-soft);width:96px;flex:0 0 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #grepbot-panel .gb-next-what{font-size:11px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #grepbot-panel .gb-next-when{font-size:10px;color:var(--gb-ok-3);white-space:nowrap}
    #grepbot-panel .gb-next-when.wait{color:var(--gb-warn-2)}
    #grepbot-panel .gb-cfg-split{display:flex;gap:8px;align-items:flex-start}
    #grepbot-panel .gb-cfg-rail{width:168px;flex:0 0 auto;display:flex;flex-direction:column;gap:1px;border-right:1px solid var(--gb-border-soft);padding-right:7px}
    #grepbot-panel .gb-cfg-rail button{display:flex;align-items:center;gap:6px;padding:5px 7px;border-radius:6px;color:var(--gb-fg-soft2);font:10.5px system-ui,-apple-system,Segoe UI,sans-serif;border:1px solid transparent;background:transparent;cursor:pointer;text-align:left;width:100%}
    #grepbot-panel .gb-cfg-rail button:hover{background:var(--gb-bg-alt4)}
    #grepbot-panel .gb-cfg-rail button.on{background:var(--gb-bg-raise);color:var(--gb-fg-hi);border-color:var(--gb-border-hard);font-weight:700}
    #grepbot-panel .gb-cfg-rail button.risk{color:var(--gb-warn-3)}
    #grepbot-panel .gb-cfg-rail button .dot{width:6px;height:6px;border-radius:50%;background:var(--gb-err-2);flex:0 0 auto}
    #grepbot-panel .gb-cfg-rail button .n{margin-left:auto;font-size:9px;color:var(--gb-fg-dim);font-weight:400}
    #grepbot-panel .gb-cfg-rail-note{font-size:9px;color:var(--gb-fg-dim);padding:6px 7px 0;line-height:1.35}
    #grepbot-panel .gb-cfg-panes{flex:1;min-width:0}
    #grepbot-panel .gb-cfg-panes .gb-cfg-num{flex-wrap:wrap}
    #grepbot-panel .gb-cfg-panes .gb-cfg-row{align-items:flex-start}
    #grepbot-panel .gb-cfg-body{display:flex;flex-direction:column;flex:1;min-width:0}
    #grepbot-panel .gb-cfg-help{flex:0 0 100%;margin-left:19px;font-size:9.5px;line-height:1.35;color:var(--gb-fg-dim);white-space:normal}
    #grepbot-panel .gb-cfg-body .gb-cfg-help{margin-left:0;margin-top:1px}
    /* The rail is the affordance for switching group now, so the pane header
       keeps its title and drops the +/- marker that invited a collapse into an
       empty pane. */
    #grepbot-panel .gb-cfg-panes .gb-cfg-group>summary::after{content:''}
    /* The rail owns which group is on screen, so a pane it hid must stay hidden
       even though .gb-section sets no display of its own - [hidden] on <details>
       is honoured by the UA sheet, and the filter path clears it again. */
    #grepbot-panel .gb-menu-h{font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--gb-fg-dim);padding:5px 8px 2px}
    #grepbot-panel .gb-menu-sep{height:1px;background:var(--gb-chrome-2);margin:5px 3px}
    #grepbot-panel footer .gb-foot-lbl{color:var(--gb-fg-dim)}
    #grepbot-panel footer .gb-foot-sep{color:var(--gb-chrome-2)}
    #grepbot-panel #gb-foot-preflight{background:var(--gb-warn-bg);border:1px solid var(--gb-accent-3);color:var(--gb-accent-2);font-weight:700;padding:4px 8px;border-radius:5px;cursor:pointer;font-size:10px;flex-shrink:0}
    #grepbot-panel .gb-diag-hero{display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid var(--gb-border-soft);border-radius:8px;background:var(--gb-bg-alt2);margin-bottom:8px}
    #grepbot-panel .gb-diag-hero-t{font-size:13px;font-weight:750}
    #grepbot-panel .gb-diag-hero-s{font-size:10px;color:var(--gb-fg-dim)}
    #grepbot-panel .gb-pf-row{display:flex;align-items:flex-start;gap:8px;padding:5px 7px;border-radius:6px}
    #grepbot-panel .gb-pf-t{font-size:11px;color:var(--gb-fg-soft)}
    #grepbot-panel .gb-pf-t.warn{color:var(--gb-warn)}
    #grepbot-panel .gb-pf-t.bad{color:var(--gb-err)}
    #grepbot-panel .gb-pf-s{font-size:10px;color:var(--gb-fg-dim)}

    /* ===== Accessibility ===================================================
       The panel had no focus indicator at all: a keyboard user tabbing through
       ~300 Config controls could not tell where they were. :focus-visible only
       paints for keyboard focus, so mouse users see no change.
       Scoped to our own roots - the game's DOM is never restyled.
       ===================================================================== */
    #grepbot-panel :focus-visible,
    #grepbot-queue-center :focus-visible,
    .gb-widget :focus-visible {
      outline:2px solid var(--gb-link);
      outline-offset:1px;
      border-radius:2px;
    }
    /* Vestibular safety: honour the OS "reduce motion" setting. The panel's
       transitions are decorative (hover tints, toast fades); none carries
       information that is lost by removing them. */
    @media (prefers-reduced-motion: reduce){
      #grepbot-panel *,#grepbot-queue-center *,.gb-widget *{
        animation-duration:.001ms!important;
        animation-iteration-count:1!important;
        transition-duration:.001ms!important;
        scroll-behavior:auto!important;
      }
    }
    /* Windows high-contrast / forced-colors: our custom properties are all
       ignored there, so an unstyled panel renders as invisible text on an
       invisible ground. Re-anchor on the system keywords and keep a visible
       border so the panel still reads as a distinct surface. */
    @media (forced-colors: active){
      #grepbot-panel,#grepbot-queue-center,.gb-widget{
        border:1px solid CanvasText;
        background:Canvas;
        color:CanvasText;
        forced-color-adjust:none;
      }
      #grepbot-panel button,#grepbot-queue-center button,.gb-widget button{
        border:1px solid ButtonText;
        background:ButtonFace;
        color:ButtonText;
      }
      #grepbot-panel :focus-visible,
      #grepbot-queue-center :focus-visible,
      .gb-widget :focus-visible{outline:2px solid Highlight}
    }
  `);

  // Sweep stale panel instances BEFORE assigning id + appending, otherwise the
  // detach-then-remove ordering reads as if the new node removes itself.
  document.querySelectorAll('#grepbot-panel').forEach(p => { try { p.remove(); } catch (_) {} });

  panel = document.createElement('div');
  panel.id = 'grepbot-panel';
  panel.style.zIndex = '2147483647';
  // `<details class="gb-section">` block with summary + body. Used 7× in the
  // Overview tab — pass open=true to render expanded by default.
  // One clipboard path for every panel copy button. The async API first, then a
  // textarea + execCommand fallback: the game page can refuse the permission,
  // and a copy button that silently does nothing is worse than an ugly one.
  function gbClipWrite(text, okMsg) {
    const done = ok => flash(ok ? okMsg : 'fallo al copiar');
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        done(ok);
      } catch (_) { done(false); }
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => done(true), fallback);
        return;
      }
    } catch (_) {}
    fallback();
  }

  function gbSection(title, body, open) {
    return `<details class="gb-section"${open ? ' open' : ''}><summary>${title}</summary><div class="gb-section-body">${body}</div></details>`;
  }
  // Same block, for the Config tab. `tone` is a css class ('risk' paints the
  // header orange). Every group is a plain <details> so the filter in
  // bindConfig can open/close it and hide whole groups without touching the
  // controls themselves - bindConfig still finds every control by
  // `[data-cfg=...]`, so grouping is presentation only.
  function gbCfgGroup(title, body, open, tone) {
    return `<details class="gb-section gb-cfg-group${tone ? ' ' + tone : ''}"${open ? ' open' : ''}><summary>${title}</summary><div class="gb-section-body">${body}</div></details>`;
  }

  // LITERAL ONLY - no interpolation. The only `${}` allowed in this template are
  // build-time constants (runningVersion()) and gbSection() calls whose bodies
  // are themselves literal. Never interpolate a player name, town name, alliance
  // name, report field or anything else that came off the wire: this is the one
  // string in the panel big enough that an added `${x}` reads as harmless, and it
  // would be the repo's first XSS sink. Wire data goes through textContent.
  panel.innerHTML = `
    <header><div class="gb-head-main"><b>GrepBot v${runningVersion()}</b><div class="gb-head-status"><span id="gb-head-mode" class="gb-pill" data-gb-tip="Perfil activo (AFK / recoleccion / guerra / personalizado)">...</span><span id="gb-head-health" class="gb-pill" data-gb-tip="Salud agregada del bot: OK / con errores / parado">...</span></div></div><div style="display:flex;gap:4px"><button data-act="queues" title="Abrir centro de colas">Colas</button><button data-act="toggle" title="Minimizar">_</button></div></header>
    <div class="gb-qat" role="toolbar" aria-label="GrepBot acciones rapidas">
      <select data-qs="town" title="Cambiar de ciudad" style="background:var(--gb-input-bg);color:var(--gb-input-fg);border:1px solid var(--gb-chrome);font-size:10px;max-width:150px"></select>
      <button type="button" data-qat="collect" data-ico="plus" title="Recoger recursos ahora">Recoger</button>
      <button type="button" data-qat="farms" data-ico="village" title="Cobrar aldeas y re-escanear">Aldeas</button>
      <button type="button" data-qat="queue" data-ico="list" title="Ejecutar la cola de construccion ahora">Cola</button>
      <span class="gb-qat-sep" aria-hidden="true"></span>
      <button type="button" data-qat="dodge" data-ico="shield" title="Escanear entrantes ahora">Esquivar</button>
      <button type="button" data-qat="hud-prod" data-ico="bars" title="Mostrar/ocultar el HUD de produccion">Producción</button>
      <button type="button" data-qat="hud-eta" data-ico="clock" title="Mostrar/ocultar la cuenta atras de ataques">Llegadas</button>
      <button type="button" data-qat="panic" data-ico="stop" title="Parada de emergencia: pausa toda la automatizacion, fuerza Simulacion y libera los bloqueos. No envia nada.">Parar todo</button>
    </div>
    <div class="gb-nav" role="tablist" aria-label="GrepBot groups"></div>
    <div class="gb-subtabs" role="tablist" aria-label="GrepBot tabs"></div>
    <section data-tab="attack" hidden>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <b style="font-size:11px;color:#f5a623">Attack sync</b>
        <span id="gb-atk-skew" style="font-size:9px;color:#888"></span>
        <span id="gb-atk-armed" style="font-size:10px;color:#f96;font-weight:bold;margin-left:auto"></span>
      </div>
      <div class="atk-row">
        <label data-gb-tip="ID de ciudad destino (deja vacio y elige en el desplegable)">target <input data-atk="target" style="width:70px" placeholder="town id"/></label>
        <select data-atk="target-type" title="Generic sender only supports canonical town targets"><option value="town">ciudad</option></select>
        <select data-atk="pick" title="Known town targets from reports/history" style="max-width:150px"></select>
        <label data-gb-tip="Coordenada X (isla) del objetivo">x <input data-atk="x" style="width:40px"/></label>
        <label data-gb-tip="Coordenada Y (isla) del objetivo">y <input data-atk="y" style="width:40px"/></label>
        <select data-atk="mission" data-gb-tip="Tipo de envio: ataque, apoyo o provocacion de revuelta"><option value="attack">ataque</option><option value="support">apoyo</option><option value="revolt">revolt</option></select>
      </div>
      <div id="gb-atk-target-hint" style="font-size:9px;color:#888;margin:-2px 0 4px"></div>
      <div class="atk-row">
        <select data-atk="timing" data-gb-tip="Cuando enviar: ahora o para llegar a una hora concreta"><option value="send_now">enviar ya</option><option value="arrive_at">llegar a las</option></select>
        <input data-atk="arrival" type="datetime-local" step="1" title="arrival (local)"/>
        <label data-gb-tip="Retraso aleatorio en ms aplicado al envio (anti-deteccion de patron exacto)">pad ms <input data-atk="pad" type="number" style="width:50px" value="200"/></label>
      </div>
      <div class="atk-row">
        <select data-atk="troop" data-gb-tip="Que tropas enviar: ofensiva, defensa, todas, un tipo concreto, acosar, o editar manualmente por ciudad">
          <option value="offense">ofensiva</option>
          <option value="defense">defensa</option>
          <option value="all">todas las tropas</option>
          <option value="all_of_type">todo el tipo</option>
          <option value="harass">acosar</option>
          <option value="per_town">editar por ciudad</option>
        </select>
        <label style="display:flex;align-items:center;gap:3px">unit
          <select data-atk="unit-type" title="only used when troop mode is 'all of type'"></select>
        </label>
      </div>
      <div class="atk-harass" style="display:flex;gap:4px;flex-wrap:wrap;margin:4px 0">
        <span style="font-size:9px;color:#888;align-self:center">acosar</span>
        <button type="button" data-harass="1sling" data-gb-tip="Acoso de 1 hondera: minimo coste, molesta al objetivo">1 honda</button>
        <button type="button" data-harass="5sling" data-gb-tip="Acoso de 5 honderas: mas molestia, coste bajo">5 hondas</button>
        <button type="button" data-harass="light" data-gb-tip="Acoso con hasta 8 tropas ligeras: maximo movimiento por recursos">&le;8 ligeras</button>
      </div>
      <div style="font-size:9px;color:#888;margin-top:2px">roles de ciudad (guardado por mundo)</div>
      <div class="atk-roles"></div>
      <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-top:4px">
        <span style="font-size:9px;color:#888">atacar desde</span>
        <button type="button" id="gb-atk-src-all" data-gb-tip="Marcar todas las ciudades propias como origen del envio">Todo</button>
        <button type="button" id="gb-atk-src-none" data-gb-tip="Desmarcar todas las ciudades como origen">Ninguno</button>
        <button type="button" id="gb-atk-src-off" data-gb-tip="Solo ciudades con rol ofensivo">Ofensiva</button>
        <button type="button" id="gb-atk-src-def" data-gb-tip="Solo ciudades con rol defensivo">Defensa</button>
      </div>
      <div class="atk-sources"></div>
      <div class="atk-pertown" hidden></div>
      <div class="atk-btns" style="margin-top:6px">
        <button id="gb-atk-preview" data-gb-tip="Previsualizar el envio (ventana de confirmacion, no envia)">Previsualizar</button>
        <button id="gb-atk-arm" data-gb-tip="Armar el envio para que se ejecute al cumplirse la condicion de envio">Armar</button>
        <button id="gb-atk-cancel" data-gb-tip="Cancelar el envio armado">Cancelar</button>
        <button id="gb-atk-now" data-gb-tip="Saltarse la condicion y enviar de inmediato">Enviar ya</button>
      </div>
      <div class="atk-sched"></div>
      <div style="border-top:1px solid #333;margin:8px 0 4px;padding-top:6px;display:flex;align-items:center;gap:6px">
        <b style="font-size:11px;color:#f5a623">Enviados / cancelar</b>
        <button type="button" id="gb-atk-cmds-refresh" style="margin-left:auto" data-gb-tip="Refrescar la lista de comandos ya enviados">Refrescar</button>
      </div>
      <div style="border-top:1px solid #333;margin:8px 0 4px;padding-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <b style="font-size:11px;color:#5be">Plan compartido</b>
        <span style="font-size:9px;color:#888">solo pegar · nunca dispara solo</span>
        <button type="button" id="gb-plan-import" style="margin-left:auto" data-gb-tip="Pegar un plan compartido desde otro bot o ciudad">Importar...</button>
        <button type="button" id="gb-plan-export" data-gb-tip="Copiar el plan actual al portapapeles">Exportar</button>
        <button type="button" id="gb-plan-clear" data-gb-tip="Borrar el plan compartido">Vaciar</button>
      </div>
      <div class="atk-shared" style="max-height:110px;overflow:auto;font-size:10px"></div>
      <div class="atk-cmds" style="max-height:120px;overflow:auto"></div>
      <div style="border-top:1px solid #333;margin:8px 0 4px;padding-top:6px;display:flex;align-items:center;gap:6px">
        <b style="font-size:11px;color:#f5a623">Colonización / revuelta</b>
        <span style="font-size:9px;color:#888">incidentes en curso · retirar refuerzo</span>
        <button type="button" id="gb-atk-colony-refresh" style="margin-left:auto" data-gb-tip="Refrescar la lista de colonizaciones y revueltas en curso">Refrescar</button>
      </div>
      <div class="atk-colony" style="max-height:120px;overflow:auto"></div>
      <div style="border-top:1px solid #333;margin:8px 0 4px;padding-top:6px;display:flex;align-items:center;gap:6px">
        <b style="font-size:11px;color:#f5a623">Heroes</b>
        <button type="button" id="gb-atk-heroes-refresh" style="margin-left:auto" data-gb-tip="Refrescar el estado y posicion de los heroes">Refrescar</button>
      </div>
      <div class="atk-heroes" style="max-height:160px;overflow:auto"></div>
      <div style="border-top:1px solid #333;margin:8px 0 4px;padding-top:6px;display:flex;align-items:center;gap:6px">
        <b style="font-size:11px;color:#5be">Composición</b>
        <span style="font-size:9px;color:#888">por ciudad · solo lectura</span>
        <button type="button" id="gb-atk-comp-refresh" style="margin-left:auto" data-gb-tip="Refrescar la composicion de tropas por ciudad">Refrescar</button>
      </div>
      <div class="atk-comp" style="max-height:200px;overflow:auto"></div>
    </section>
    <section data-tab="reinforce" hidden>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <b style="font-size:11px;color:#5be">Refuerzos</b>
        <span id="gb-rf-skew" style="font-size:9px;color:#888"></span>
        <span id="gb-rf-armed" style="font-size:10px;color:#f96;font-weight:bold;margin-left:auto"></span>
      </div>
      <div class="atk-row">
        <label data-gb-tip="ID de la ciudad que recibe el refuerzo (propia o aliada)">destino <input data-rf="target" style="width:70px" placeholder="town id"/></label>
        <select data-rf="pick" title="Ciudades propias y objetivos conocidos" style="max-width:170px"></select>
        <label data-gb-tip="Coordenada X (isla) del destino">x <input data-rf="x" style="width:40px"/></label>
        <label data-gb-tip="Coordenada Y (isla) del destino">y <input data-rf="y" style="width:40px"/></label>
      </div>
      <div id="gb-rf-target-hint" style="font-size:9px;color:#888;margin:-2px 0 4px"></div>
      <div class="atk-row">
        <select data-rf="help" data-gb-tip="Que ayuda enviar: solo tropas de tierra, solo barcos de guerra, ambas, un tipo concreto, o editar por ciudad">
          <option value="both">ayuda: ambas</option>
          <option value="land">ayuda: terrestre</option>
          <option value="naval">ayuda: naval</option>
          <option value="all_of_type">ayuda: todo el tipo</option>
          <option value="per_town">ayuda: editar por ciudad</option>
        </select>
        <label style="display:flex;align-items:center;gap:3px">unidad
          <select data-rf="unit-type" title="solo se usa con el modo 'todo el tipo'"></select>
        </label>
        <label data-gb-tip="Unidades de cada tipo que se quedan en casa (reserva minima por ciudad de origen)">reserva <input data-rf="floor" type="number" min="0" style="width:50px" value="0"/></label>
      </div>
      <div class="atk-row">
        <select data-rf="timing" data-gb-tip="Cuando enviar: ahora o para llegar a una hora concreta"><option value="send_now">enviar ya</option><option value="arrive_at">llegar a las</option></select>
        <input data-rf="arrival" type="datetime-local" step="1" title="llegada (hora local)"/>
        <label data-gb-tip="Retraso en ms aplicado al envio">pad ms <input data-rf="pad" type="number" style="width:50px" value="200"/></label>
      </div>
      <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-top:4px">
        <span style="font-size:9px;color:#888">enviar desde</span>
        <button type="button" id="gb-rf-src-all" data-gb-tip="Marcar todas las ciudades propias como origen">Todo</button>
        <button type="button" id="gb-rf-src-none" data-gb-tip="Desmarcar todas las ciudades">Ninguno</button>
        <button type="button" id="gb-rf-src-def" data-gb-tip="Solo ciudades con rol defensivo (roles de la pestana Ataques)">Defensa</button>
        <button type="button" id="gb-rf-src-off" data-gb-tip="Solo ciudades con rol ofensivo">Ofensiva</button>
      </div>
      <div class="rf-sources atk-sources"></div>
      <div class="rf-pertown" hidden></div>
      <div class="atk-btns" style="margin-top:6px">
        <button id="gb-rf-preview" data-gb-tip="Calcular marcha, transporte y hora de envio; no envia nada">Previsualizar</button>
        <button id="gb-rf-arm" data-gb-tip="Armar el refuerzo para que salga a la hora calculada">Armar</button>
        <button id="gb-rf-cancel" data-gb-tip="Cancelar el refuerzo armado">Cancelar</button>
        <button id="gb-rf-now" data-gb-tip="Enviar el refuerzo de inmediato">Enviar ya</button>
      </div>
      <div id="gb-rf-tpl" style="font-size:9px;color:#888;margin-top:4px"></div>
      <div class="rf-sched atk-sched"></div>
    </section>
    <section data-tab="train" hidden>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <b style="font-size:11px;color:#5be">Entrenamiento</b>
        <span id="gb-tr-state" style="font-size:9px;color:#888"></span>
      </div>
      <div class="atk-row">
        <button type="button" data-tr="auto" data-gb-tip="Mismo ajuste que 'Reclutamiento automatico' en Ajustes. Repone los objetivos permanentes de abajo en cada ciclo del orquestador">Reposicion automatica: —</button>
        <button type="button" data-tr="batch" data-gb-tip="Mismo ajuste que 'Lote de reclutamiento' en Ajustes. Dispara la lista entera de una vez, todo-o-nada, y se re-arma tras cada disparo">Lote recurrente: —</button>
      </div>
      <div style="font-size:10px;color:var(--gb-fg-soft2);margin:6px 0 2px">
        <b style="color:#5be">Objetivos permanentes</b> — el bot mantiene cada unidad en la cantidad fijada y vuelve a reclutar en cuanto baja (tropas en casa + fuera + cola).
      </div>
      <div class="atk-row">
        <label data-gb-tip="Ciudad a la que se le fija el objetivo">ciudad <select data-tr="tgt-town" style="max-width:170px"></select></label>
        <label data-gb-tip="Unidad a mantener (cuartel, puerto o templo segun la unidad)">unidad <select data-tr="tgt-unit" style="max-width:150px"></select></label>
        <label data-gb-tip="Cantidad a mantener. 0 quita el objetivo">objetivo <input data-tr="tgt-amount" type="number" min="0" max="100000" step="1" style="width:70px" value="50"/></label>
        <button type="button" data-tr="tgt-add" data-gb-tip="Fija o actualiza el objetivo de esa unidad en esa ciudad">Fijar</button>
        <button type="button" data-tr="tgt-clear" data-gb-tip="Borra todos los objetivos de la ciudad seleccionada">Borrar ciudad</button>
      </div>
      <div id="gb-tr-targets" style="max-height:200px;overflow:auto"></div>
      <div id="gb-tr-note" style="font-size:9px;color:#888;margin-top:4px"></div>
      <div style="font-size:10px;color:var(--gb-fg-soft2);margin:8px 0 2px">
        <b style="color:#5be">Packs de entrenamiento</b> — varias unidades a la vez (espada + arquero + birreme). Al aplicarlo, el pack se escribe en el lote de la ciudad y se entrena entero de una tacada.
      </div>
      <div class="atk-row">
        <select data-tr="pack" style="max-width:170px" data-gb-tip="Pack seleccionado"></select>
        <input data-tr="pack-name" placeholder="nombre del pack" style="width:130px" data-gb-tip="Nombre para Nuevo o para Desde el lote"/>
        <button type="button" data-tr="pack-new" data-gb-tip="Crea un pack vacio con ese nombre">Nuevo</button>
        <button type="button" data-tr="pack-from-town" data-gb-tip="Guarda como pack el lote de la ciudad elegida abajo">Desde el lote</button>
        <button type="button" data-tr="pack-del" data-gb-tip="Borra el pack seleccionado (no toca los lotes ya aplicados)">Borrar</button>
      </div>
      <div class="atk-row">
        <label data-gb-tip="Unidad a anadir al pack">unidad <select data-tr="pack-unit" style="max-width:150px"></select></label>
        <label data-gb-tip="Cantidad por disparo del lote">cantidad <input data-tr="pack-amount" type="number" min="1" max="10000" step="1" style="width:70px" value="10"/></label>
        <button type="button" data-tr="pack-add" data-gb-tip="Anade la unidad al pack (si ya estaba, actualiza la cantidad)">+ unidad</button>
      </div>
      <div id="gb-tr-pack-rows"></div>
      <div class="atk-row">
        <label data-gb-tip="Ciudad destino del pack">aplicar a <select data-tr="pack-town" style="max-width:170px"></select></label>
        <select data-tr="pack-mode" data-gb-tip="Reemplazar deja en el lote solo el pack; sumar conserva lo que ya hubiera">
          <option value="replace">reemplazar el lote</option>
          <option value="append">sumar al lote</option>
        </select>
        <button type="button" data-tr="pack-apply" data-gb-tip="Escribe el pack en el lote de la ciudad (o de todas)">Aplicar</button>
      </div>
      <div id="gb-tr-pack-note" style="font-size:9px;color:#888;margin-top:4px"></div>
      <div style="font-size:10px;color:var(--gb-fg-soft2);margin:8px 0 2px">
        <b style="color:#5be">Lote recurrente</b> — lista fija por ciudad que se dispara entera solo cuando recursos Y poblacion cubren el lote completo. No se consume: se re-arma tras cada disparo.
      </div>
      <div class="atk-row">
        Ciudad <select data-cfg="batch-recruit-town" style="min-width:160px"></select>
        <button type="button" data-cfg="batch-recruit-add" data-gb-tip="Anade una linea nueva a la lista de la ciudad seleccionada">+ linea</button>
        <button type="button" data-cfg="batch-recruit-arm" data-gb-tip="Lanza el chequeo ahora (sin esperar al proximo ciclo del orch)">armar todo</button>
        <button type="button" data-cfg="batch-recruit-clear" data-gb-tip="Borra la lista de la ciudad seleccionada">desarmar</button>
      </div>
      <div id="gb-batch-recruit-rows"></div>
      <div id="gb-batch-recruit-summary" style="font-size:10px;color:#888;margin-top:2px"></div>
    </section>
    <section data-tab="spy" hidden>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <b style="font-size:11px;color:#5be">Espionaje</b>
        <span id="gb-sp-cave" style="font-size:9px;color:#888"></span>
      </div>
      <div class="atk-row">
        <label data-gb-tip="Ciudad de origen: la plata sale de SU cueva">origen <select data-sp="src" style="max-width:150px"></select></label>
        <label data-gb-tip="ID de la ciudad a espiar (no puede ser propia)">objetivo <input data-sp="target" style="width:70px" placeholder="town id"/></label>
        <select data-sp="pick" title="Objetivos conocidos de informes e historial" style="max-width:150px"></select>
      </div>
      <div class="atk-row">
        <select data-sp="mode" data-gb-tip="Rapido: varias rafagas pequenas. Masivo: un unico envio grande">
          <option value="rapid">modo rapido (rafagas)</option>
          <option value="bulk">modo masivo (un envio)</option>
        </select>
        <label data-gb-tip="Espera entre rafagas en ms (se le suma un jitter aleatorio)">pausa ms <input data-sp="gap" type="number" min="300" style="width:60px" value="1200"/></label>
      </div>
      <div class="sp-rapid atk-row">
        <label data-gb-tip="Plata por rafaga">plata/rafaga <input data-sp="chunk" type="number" min="1" style="width:70px" value="1000"/></label>
        <label data-gb-tip="Numero de rafagas. 0 = hasta vaciar la cueva (necesita leer la plata)">rafagas <input data-sp="waves" type="number" min="0" style="width:50px" value="5"/></label>
        <label style="display:flex;align-items:center;gap:3px" data-gb-tip="Parar en cuanto la cueva se quede sin plata"><input data-sp="until" type="checkbox"/> hasta vaciar</label>
      </div>
      <div class="sp-bulk atk-row" hidden>
        <label style="display:flex;align-items:center;gap:3px" data-gb-tip="Enviar toda la plata de la cueva en un solo espionaje"><input data-sp="bulk-all" type="checkbox"/> toda la plata</label>
        <label data-gb-tip="Cantidad exacta de plata a enviar">cantidad <input data-sp="bulk-amount" type="number" min="0" style="width:80px"/></label>
      </div>
      <div id="gb-sp-plan" style="font-size:10px;color:#ccc;margin:2px 0"></div>
      <div class="atk-btns" style="margin-top:4px">
        <button id="gb-sp-run" data-gb-tip="Confirmar y enviar el espionaje">Espiar</button>
        <button id="gb-sp-stop" data-gb-tip="Parar tras la rafaga en curso">Detener</button>
        <button id="gb-sp-clear" data-gb-tip="Vaciar el historial de espionajes">Vaciar historial</button>
      </div>
      <div id="gb-sp-progress" style="font-size:10px;color:#8ac;margin-top:4px"></div>
      <div style="font-size:9px;color:#888;margin-top:6px">historial</div>
      <div class="sp-hist" style="max-height:140px;overflow:auto"></div>
    </section>
    <section data-tab="overview" hidden>
      <div class="gb-hero">
        <span class="gb-hero-dot"></span>
        <div style="min-width:0">
          <div class="gb-hero-t">Leyendo el estado…</div>
          <div class="gb-hero-s"></div>
        </div>
      </div>
      <div class="gb-chips"></div>
      <div class="gb-lbl">Necesita tu atención</div>
      <div class="gb-attention"></div>
      <div class="gb-lbl">Qué hará a continuación</div>
      <div class="gb-next"></div>
      <div class="gb-dashboard-cards"></div>
      <div class="gb-quick">
        <button id="gb-quick-safe" data-gb-tip="Pausa global: bloquea premium, ataques, favor, puntos y donaciones">MODO SEGURO</button>
        <button id="gb-quick-sim" data-gb-tip="Simular 24 h para ver que haria el bot">Simular 24 h</button>
        <button id="gb-quick-config" data-gb-tip="Abrir la pestaña de configuracion (Ajustes)">Ajustes</button>
      </div>
      ${gbSection('Objetivos y cola por ciudad', '<div class="goals-panel" style="font-size:10px;max-height:300px;overflow:auto"></div>', true)}
      ${gbSection('Recursos y reservas', '<div class="planner-controls" style="font-size:10px;display:flex;gap:5px;flex-wrap:wrap;align-items:center"></div><div class="planner-panel" style="font-size:10px;max-height:240px;overflow:auto;margin-top:6px"></div>')}
      ${gbSection('Simulación y motivos', '<div style="display:flex;gap:5px;align-items:center;margin-bottom:5px"><label data-gb-tip="Horas a simular (1-168)">Horizonte <input id="gb-sim-hours" type="number" min="1" max="168" value="24" style="width:55px;background:#111;color:#cfc;border:1px solid #444;border-radius:4px;padding:3px"/> h</label><button id="gb-sim-run" class="gb-action" data-gb-tip="Correr la simulacion con el horizonte indicado">Simular</button></div><pre class="sim-panel" style="font-size:10px;white-space:pre-wrap;margin:0 0 6px;max-height:160px;overflow:auto"></pre><pre class="why-panel" style="font-size:10px;white-space:pre-wrap;margin:0;max-height:130px;overflow:auto;color:#bbb"></pre>')}
      ${gbSection('Salud del sistema', '<div class="health-panel" style="font-size:10px;max-height:220px;overflow:auto"></div>')}
      ${gbSection('Plantillas y copia de seguridad', '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><input id="gb-tpl-name" placeholder="nombre de plantilla" style="width:130px;background:#111;color:#cfc;border:1px solid #444;border-radius:4px;padding:4px;font-size:11px" data-gb-tip="Nombre para guardar o aplicar una plantilla de configuracion"/><button id="gb-tpl-save" class="gb-action" data-gb-tip="Guardar la configuracion actual con el nombre indicado">Guardar plantilla</button><button id="gb-tpl-apply" class="gb-action" data-gb-tip="Aplicar la plantilla cuyo nombre escribiste arriba">Aplicar plantilla</button><button id="gb-cfg-export" class="gb-action" data-gb-tip="Exportar la configuracion completa al portapapeles">Exportar configuración</button><button id="gb-cfg-import" class="gb-action" data-gb-tip="Pegar e importar una configuracion previamente exportada">Importar configuración</button><button id="gb-cfg-undo" class="gb-action" title="Deshacer el ultimo cambio de configuracion">Deshacer</button><button id="gb-cfg-redo" class="gb-action" title="Rehacer">Rehacer</button><span id="gb-cfg-hist" style="font-size:10px;color:#888"></span></div>')}
    </section>
    <section data-tab="intel" hidden>
      <div style="font-size:11px;color:#f5a623;margin-bottom:4px">Intel / amenazas</div>
      <select data-intel="view" title="Cambiar la vista del panel Intel" style="background:var(--gb-input-bg);color:var(--gb-input-fg);border:1px solid var(--gb-chrome);font-size:10px;margin-bottom:4px"><option value="summary">Resumen</option><option value="heatmap">Mapa de calor</option><option value="defense">Tablero de defensa</option><option value="pool">Reservas por alianza</option><option value="activity">Actividad de miembros</option></select>
      <input data-intel="ally-filter" placeholder="filtrar alianza" style="background:var(--gb-input-bg);color:var(--gb-input-fg);border:1px solid var(--gb-chrome);font-size:10px;width:120px;margin-left:4px" data-gb-tip="Filtrar la vista actual por nombre de alianza"/>
      <select data-intel="status" title="Marcar estado diplomatico" style="background:var(--gb-input-bg);color:var(--gb-input-fg);border:1px solid var(--gb-chrome);font-size:10px;margin-left:4px"><option value="">estado...</option><option value="war">guerra</option><option value="ally">aliado</option><option value="nap">NAP</option><option value="neutral">neutral</option><option value="clear">quitar</option></select>
      <pre class="intel-panel" style="font-size:10px;white-space:pre-wrap;background:#111;padding:6px;border:1px solid #333;max-height:280px;overflow:auto;color:#cfc"></pre>
      <div class="intel-timeline" style="font-size:11px;margin-top:6px"></div>
      <div class="intel-ghost" style="font-size:11px;margin-top:6px"></div>
      <div class="intel-inactive" style="font-size:11px;margin-top:6px">
        <div style="color:#888;margin-top:4px">Atacantes inactivos</div>
        <div class="intel-inactive-atk"></div>
        <div style="color:#888;margin-top:4px">Defensores inactivos</div>
        <div class="intel-inactive-def"></div>
      </div>
      <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <input class="gb-cfg-input" id="gb-note-player" placeholder="player" style="width:80px;;font-size:11px" data-gb-tip="Nombre del jugador al que apuntar la nota"/>
        <input class="gb-cfg-input" id="gb-note-text" placeholder="note" style="flex:1;;font-size:11px" data-gb-tip="Texto de la nota del jugador"/>
        <button id="gb-note-save" style="background:#333;border:1px solid #555;color:#eee;padding:2px 6px;cursor:pointer;font-size:10px" data-gb-tip="Guardar la nota del jugador">Guardar nota</button>
      </div>
      <div style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <input class="gb-cfg-input" id="gb-anote-ally" placeholder="alianza" style="width:80px;;font-size:11px" data-gb-tip="Nombre de la alianza a la que apuntar la nota"/>
        <input class="gb-cfg-input" id="gb-anote-text" placeholder="nota de alianza" style="flex:1;;font-size:11px" data-gb-tip="Texto de la nota de alianza"/>
        <button id="gb-anote-save" style="background:#333;border:1px solid #555;color:#eee;padding:2px 6px;cursor:pointer;font-size:10px" data-gb-tip="Guardar la nota de la alianza">Guardar nota de alianza</button>
      </div>
    </section>
    <section data-tab="config" hidden>
      <div class="config-panel">
        <div class="gb-cfg-toolbar">
          <input class="gb-cfg-filter" type="search" placeholder="Buscar un ajuste por nombre o por lo que hace…" title="Filtra por texto. Mientras escribes se buscan todos los grupos a la vez; vacia el campo para volver al grupo elegido."/>
        </div>
        <div class="gb-cfg-empty" hidden>Ningun ajuste coincide con el filtro.</div>
        <div class="gb-cfg-split">
        <nav class="gb-cfg-rail" aria-label="Grupos de ajustes"></nav>
        <div class="gb-cfg-panes">
        ${gbCfgGroup('General y seguridad', `
          <label class="gb-cfg-row" data-gb-tip="Activar el bot solo en este dominio (marcado por mundo)"><input type="checkbox" data-cfg="enabled-host"/> Activar en <span class="cfg-host"></span></label>
          <label class="gb-cfg-row" title="El unico freno pasa a ser el interruptor de arriba. Desactiva panico, cortacircuitos, memoria de decisiones, modo seguro, salud de plantillas, pausa nocturna, pausa por actividad y el frenado adaptativo del orquestador. El cortacircuitos de captcha y el enfriamiento por presion del servidor siguen activos: ahi el servidor ya esta rechazando el envio."><input type="checkbox" data-cfg="never-stop"/> <b class="gb-cfg-accent">No parar nunca (solo para con el interruptor de arriba)</b></label>
          <label class="gb-cfg-row gb-cfg-warn" data-gb-tip="Bloquea premium, ataques, favor, puntos y donaciones"><input type="checkbox" data-cfg="safe-mode"/> MODO SEGURO (bloquea premium/ataques/favor/puntos/donaciones)</label>
          <label class="gb-cfg-row" title="Registra cada payload que el bot enviaria y no envia nada. Sirve para comparar el payload del bot con una accion pulsada a mano antes de activar algo arriesgado."><input type="checkbox" data-cfg="dry-run"/> <b class="gb-cfg-accent">Simulacion (registra payloads, no envia nada)</b></label>
          <label class="gb-cfg-row" data-gb-tip="Apagado global de captcha: cualquier captcha detiene todo el bot"><input type="checkbox" data-cfg="captcha-global"/> Interruptor global de captcha</label>
          <label class="gb-cfg-row" title="Salta una accion que fallo igual 3 veces seguidas (5/15/60 min de espera). La bitacora sigue registrando en ambos casos."><input type="checkbox" data-cfg="decision-memory"/> Memoria de decisiones (salta fallos repetidos)</label>
          <label class="gb-cfg-num" data-gb-tip="Numero maximo de envios al servidor por minuto (presupuesto duro)">Presupuesto de peticiones / min <input class="gb-cfg-input" type="number" data-cfg="req-budget" min="5" max="120" style="width:50px"/></label>
          <label class="gb-cfg-num" title="Por debajo del presupuesto duro: al pasar este % los envios se retrasan en vez de descartarse. 60 = empieza a frenar en el 60% de las peticiones/min.">Freno suave de envios (% del presupuesto) <input class="gb-cfg-input" type="number" data-cfg="posts-soft-pct" min="10" max="100" style="width:60px"/></label>
          <label class="gb-cfg-num" title="Minutos de pausa tras el 1er, 2o, 3er... captcha del mismo modulo. Lista separada por comas, de 1 a 1440. Vacio = 5,15,60.">Escalera de captcha (min) <input class="gb-cfg-input" type="text" data-cfg="captcha-ladder" placeholder="5,15,60" style="width:110px"/></label>
          <button data-cfg="clear-captcha" class="gb-cfg-btn danger" data-gb-tip="Limpiar los cortacircuitos de captcha de todos los modulos">Limpiar cortacircuitos de captcha</button>
        `, true)}
        ${gbCfgGroup('Recolección y aldeas', `
          <label class="gb-cfg-row" data-gb-tip="Cobrar recompensas visibles (boton Recoger) automaticamente"><input type="checkbox" data-cfg="auto-collect"/> Recoger recompensas de recursos visibles</label>
          <label class="gb-cfg-row gb-cfg-sub" data-gb-tip="Recoger aunque el tiempo mostrado sea mayor que el umbral"><input type="checkbox" data-cfg="collect-all"/> Recoger todo (ignora el tope de tiempo)</label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="Minutos maximos mostrados para que el bot recoja sin forzar">Minutos maximos para recoger <input class="gb-cfg-input" type="number" data-cfg="collect-max-min" min="1" max="120" style="width:70px"/></label>
          <label class="gb-cfg-row" data-gb-tip="Atacar campamentos bandidos automaticamente"><input type="checkbox" data-cfg="auto-bandit"/> Campamento bandido automatico</label>
          <label class="gb-cfg-row" data-gb-tip="Cobrar aldeas propias periodicamente"><input type="checkbox" data-cfg="auto-farm"/> Recoleccion automatica de aldeas</label>
          <label class="gb-cfg-row gb-cfg-sub" data-gb-tip="Saltar aldeas/bandido si el almacen de la ciudad esta demasiado lleno"><input type="checkbox" data-cfg="farm-skip-full"/> Saltar aldeas/bandido con el almacen lleno</label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="Cuando considerar el almacen lleno: 1 recurso o los 3">Criterio de almacen lleno
            <select class="gb-cfg-input" data-cfg="farm-full-mode" data-gb-tip="Cuando considerar el almacen lleno">
              <option value="any">cualquier recurso lleno</option>
              <option value="all">los 3 recursos llenos</option>
            </select>
          </label>
          <label class="gb-cfg-row gb-cfg-sub" data-gb-tip="Pedir cobros de 10 min en aldeas donde la lealtad esta investigada"><input type="checkbox" data-cfg="farm-long-claims"/> Cobros de 10 min donde la lealtad de aldeanos esta investigada</label>
          <label class="gb-cfg-num gb-cfg-sub" title="La aldea tiene dos mitades: recursos y unidades. Con 'al agotarse los recursos' la aldea pasa a pedir unidades el resto del dia en cuanto el servidor rechaza el cobro de recursos (tope diario alcanzado). Las unidades ocupan poblacion.">Cobrar unidades en aldeas
            <select class="gb-cfg-input" data-cfg="farm-units-mode" data-gb-tip="Cuando pedir unidades en vez de recursos">
              <option value="off">nunca (solo recursos)</option>
              <option value="fallback">al agotarse los recursos del dia</option>
              <option value="always">siempre (solo unidades)</option>
            </select>
          </label>
          <label class="gb-cfg-num gb-cfg-sub" title="Que carta de unidad pedir. 'automatica' elige la carta de mas valor que la ciudad puede aceptar (poblacion libre y edificio requerido); 'aprendida' repite la que pulsaste a mano.">Unidad a pedir
            <select class="gb-cfg-input" data-cfg="farm-units-pref" data-gb-tip="Unidad que se pide en la mitad de unidades de la aldea">
              <option value="auto">automatica (mejor valor)</option>
              <option value="learned">aprendida (pulsa una vez a mano)</option>
              <option value="sword">Espadachin</option>
              <option value="slinger">Hondero</option>
              <option value="archer">Arquero</option>
              <option value="hoplite">Hoplita</option>
            </select>
          </label>
          <label class="gb-cfg-row gb-cfg-sub" title="Bajo presion (captcha, enfriamiento del servidor o presupuesto justo) recorta la lista de aldeas en vez de ampliar la cadencia, y reclama primero las mas rentables."><input type="checkbox" data-cfg="adaptive-farm"/> Recoleccion adaptativa bajo presion</label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="Porcentaje de aldeas a descartar bajo presion (de menos rentable a mas)">Descartar bajo presion <input class="gb-cfg-input" type="number" data-cfg="farm-drop-pct" min="0" max="90" style="width:45px"/> %</label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="ID o nombre exacto de la investigacion de lealtad (la pestana Registro lo vuelca si la deteccion automatica falla)">Clave de la investigacion de lealtad
            <input class="gb-cfg-input" data-cfg="farm-loyalty-tech" placeholder="auto (id del servidor o etiqueta)" title="Id de investigacion del servidor (p.ej. rural_loyalty) o el nombre localizado de la academia. La pestana Registro vuelca los pares id(etiqueta) cuando la deteccion automatica falla." style="width:190px"/>
          </label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="Duracion del cobro nocturno: auto, 4h o 8h">Duracion del cobro nocturno
            <select class="gb-cfg-input" data-cfg="farm-sleep-dur" data-gb-tip="Duracion del cobro nocturno">
              <option value="auto">auto (8h si se sabe, si no 4h)</option>
              <option value="14400">4 h</option>
              <option value="28800">8 h</option>
            </select>
          </label>
          <label class="gb-cfg-row gb-cfg-sub" data-gb-tip="Cobro nocturno automatico: 1 vez al dia, debe acabar antes de las 24:00"><input type="checkbox" data-cfg="farm-sleep-auto"/> Cobro nocturno automatico (1/dia, debe acabar antes de las 24:00)</label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="Porcentaje maximo de llenado del almacen para activar el cobro nocturno">Llenado maximo de almacen para el cobro nocturno %
            <input class="gb-cfg-input" type="number" data-cfg="farm-sleep-fill" min="10" max="95" style="width:60px"/>
          </label>
          <label class="gb-cfg-num gb-cfg-sub" title="Segundos de marcha por unidad de coordenada de isla. El juego no expone la formula de marcha, asi que 0 (por defecto) deja el ranking res/min independiente de la distancia.">Segundos de marcha por unidad de isla <input class="gb-cfg-input" type="number" data-cfg="farm-travel" min="0" max="600" step="0.5" style="width:60px"/></label>
          <div id="gb-farm-optmap" class="gb-cfg-note" data-gb-tip="Mapa aprendido: que opcion de cobro usa cada duracion (5min, 10min, ...) en este mundo"></div>
          <button data-cfg="farm-forget-options" class="gb-cfg-btn gb-cfg-sub" title="Borra el mapa de opciones aprendido (recursos y unidades) y reactiva la plantilla de cobro. Usalo si los cobros fallan seguido: vuelve a pulsar cada duracion una vez a mano para reaprenderlas.">Olvidar opciones de cobro aprendidas</button>
          <label class="gb-cfg-row" title="Lee los recursos de cada aldea por HTTP. Solo funciona en mundos cuyo cliente responde a una accion farm_town_*. Si no, cada barrido gasta el presupuesto de peticiones sin devolver nada y se apaga solo."><input type="checkbox" data-cfg="farm-scrape"/> Escanear recursos de aldeas (HTTP)</label>
          <label class="gb-cfg-num" data-gb-tip="Cadencia del escaneo de aldeas: minimo y maximo en minutos">Cadencia de aldeas min-max (min) <input class="gb-cfg-input" type="number" data-cfg="farm-min" min="1" max="60" style="width:50px"/> - <input class="gb-cfg-input" type="number" data-cfg="farm-max" min="1" max="60" style="width:50px"/></label>
          <label class="gb-cfg-num" data-gb-tip="Cadencia del escaneo de ciudades: minimo y maximo en minutos">Cadencia de ciudades min-max (min) <input class="gb-cfg-input" type="number" data-cfg="town-min" min="1" max="60" style="width:50px"/> - <input class="gb-cfg-input" type="number" data-cfg="town-max" min="1" max="60" style="width:50px"/></label>
        `, true)}
        ${gbCfgGroup('Construcción e investigación', `
          <label class="gb-cfg-row" data-gb-tip="Completar gratis la construccion en cola cuando el tiempo restante esta dentro del umbral"><input type="checkbox" data-cfg="auto-build"/> Construccion instantanea gratis</label>
          <label class="gb-cfg-row" data-gb-tip="Completar gratis la investigacion en la academia cuando esta dentro del umbral"><input type="checkbox" data-cfg="instant-research"/> Investigacion instantanea gratis (academia)</label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="Segundos antes de acabar para considerarlo gratis (max 290)">Umbral de instantanea gratis (s, tope de seguridad 290) <input class="gb-cfg-input" type="number" data-cfg="ib-free-thresh" min="60" max="300" style="width:70px"/></label>
          <label class="gb-cfg-row" data-gb-tip="Anadir automaticamente el siguiente edificio del plan a la cola"><input type="checkbox" data-cfg="auto-queue"/> Cola de construccion automatica</label>
          <label class="gb-cfg-row gb-cfg-sub" data-gb-tip="Si la cola de construccion esta vacia y no hay objetivo pendiente, el bot anade un edificio aleatorio de los disponibles (excluye especiales: Teatro, Termas, Biblioteca, Faro, Torre, Estatua, Oraculo, Oficina comercial). Solo uno por ciclo; la cola sigue vacia hasta la siguiente pasada."><input type="checkbox" data-cfg="ab-random-fallback"/> Cola aleatoria cuando este vacia</label>
          <label class="gb-cfg-row gb-cfg-sub" title="Si el coste de poblacion de la siguiente construccion supera la poblacion libre de la ciudad, mete 2 niveles de granja al principio de la cola. Antes comprueba lo que ya se esta construyendo (cola real + cola virtual); si la granja ya esta en marcha o al maximo, no hace nada."><input type="checkbox" data-cfg="pop-rescue-farm"/> Granja automatica si falta poblacion</label>
          <label class="gb-cfg-row gb-cfg-sub" title="Un muro danado conserva su nivel, asi que el planificador no lo ve. Con esto activado el nivel efectivo baja segun el dano y la cola lo reconstruye. Gasta recursos: por defecto OFF."><input type="checkbox" data-cfg="auto-wall-repair"/> Reparar muralla danada</label>
          <label class="gb-cfg-num gb-cfg-sub" title="Si la cabeza de la cola lleva bloqueada por recursos mas de estos minutos, Colas > Construccion ofrece ascender la siguiente orden que SI se puede pagar. Solo sugerencia: nunca reordena solo. 0 = desactivado.">Sugerir adelanto tras <input class="gb-cfg-input" type="number" data-cfg="build-swap-min" min="0" max="120" style="width:45px"/> min bloqueada</label>
          <label class="gb-cfg-row gb-cfg-sub" title="Muestra en Colas > Construccion una secuencia aconsejada. Solo consejo: la cola FIFO manda y nada se envia sin pulsar el boton."><input type="checkbox" data-cfg="ab-optimal-order"/> Secuencia optima de construccion (consejo)</label>
          <label class="gb-cfg-row" data-gb-tip="Lanzar la siguiente investigacion del plan automaticamente"><input type="checkbox" data-cfg="auto-research"/> Investigacion automatica</label>
          <button data-cfg="research-csfast" class="gb-cfg-btn gb-cfg-sub" data-gb-tip="Cargar el preset CS-fast (investigaciones recomendadas para CS)">Cargar CS-fast de investigacion</button>
          <div class="research-path gb-cfg-note" data-gb-tip="Camino de investigacion calculado para CS-fast"></div>
          <label class="gb-cfg-row" data-gb-tip="Cobrar el descuento de construccion que otorgan las misiones"><input type="checkbox" data-cfg="auto-quest-build"/> Cobrar el descuento de construccion de las misiones</label>
          <label class="gb-cfg-row" data-gb-tip="Cobrar automaticamente las recompensas de recursos y favor de misiones"><input type="checkbox" data-cfg="auto-quest-res"/> Cobrar recursos/favor de las misiones</label>
        `, true)}
        ${gbCfgGroup('Almacén, cueva y comercio', `
          <label class="gb-cfg-row" data-gb-tip="Guardar plata sobrante en la cueva cuando supera el umbral"><input type="checkbox" data-cfg="auto-cave"/> Cueva automatica (guarda la plata sobrante)</label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="Porcentaje de llenado del almacen a partir del cual la plata se guarda">Guardar cuando la plata &ge; % del almacen
            <input class="gb-cfg-input" type="number" data-cfg="cave-thresh" min="50" max="99" style="width:50px"/>
          </label>
          <div class="gb-cfg-note gb-cfg-sub" data-gb-tip="Selector por ciudad: desmarcadas se saltan en el barrido">Por ciudad (sin marcar = se salta esa ciudad):</div>
          <div class="cave-towns"></div>
          <label class="gb-cfg-row gb-cfg-risk" title="ALTO RIESGO: guarda plata en la cueva ignorando el umbral cuando un ataque serio va a caer en menos de 15 min. Solo actua sobre ciudades con la cueva activada arriba."><input type="checkbox" data-cfg="emergency-cave-auto"/> Cueva de emergencia ante ataque (ALTO RIESGO, OFF)</label>
          <label class="gb-cfg-num gb-cfg-sub">Emergencia:
            confirmar &gt; <input class="gb-cfg-input" type="number" data-cfg="emergency-cave-confirm" min="0" max="1000000" step="100" style="width:70px" data-gb-tip="Plata minima para activar la cueva de emergencia"/>
            minimo <input class="gb-cfg-input" type="number" data-cfg="emergency-cave-min-iron" min="1" max="100000" style="width:60px" data-gb-tip="Minimo de plata a guardar en cada activacion de emergencia"/>
            <button data-cfg="emergency-cave-now" class="gb-cfg-btn danger" title="Guarda ahora la plata de todas las ciudades con cueva activada, ignorando el umbral.">Guardar plata YA</button>
          </label>
          <label class="gb-cfg-row" data-gb-tip="Enviar mercantes entre ciudades para llenar almacenes"><input type="checkbox" data-cfg="auto-trade"/> Comercio entre ciudades (llenar almacen)</label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="Perfil de comercio, reserva minima y lote minimo por envio">Perfil
            <select class="gb-cfg-input" data-cfg="trade-preset" data-gb-tip="Perfil de envio: solo 'almacen' esta implementado">
              <option value="storage">almacen</option>
              <option value="party">fiesta (sin implementar)</option>
              <option value="unit">unidades (sin implementar)</option>
            </select>
            Reserva % <input class="gb-cfg-input" type="number" data-cfg="trade-reserve" min="0" max="80" style="width:45px" data-gb-tip="Reserva minima del recurso en el destino"/>
            Lote minimo <input class="gb-cfg-input" type="number" data-cfg="trade-min" min="100" max="50000" step="100" style="width:60px" data-gb-tip="Cantidad minima por envio de mercante"/>
          </label>
          <label class="gb-cfg-row" data-gb-tip="Enviar recursos desde el continente a una isla propia"><input type="checkbox" data-cfg="island-ship"/> Envio de recursos continente a isla</label>
          <label class="gb-cfg-row gb-cfg-risk" title="ALTO RIESGO: envia las rutas guardadas en cada ciclo de comercio. Sin vuelta atras. Pruebalo con Simulacion antes de activarlo."><input type="checkbox" data-cfg="auto-trade-routes"/> Rutas de comercio guardadas</label>
          <button data-cfg="trade-routes-edit" class="gb-cfg-btn gb-cfg-sub" title="Editar las rutas como JSON. Siempre disponible, incluso con el bucle apagado.">Rutas...</button>
          <label class="gb-cfg-row gb-cfg-risk" title="ALTO RIESGO: mueve recursos entre tus ciudades sin vuelta atras. Equilibra segun el sesgo 'resource' del perfil de cada ciudad. Pruebalo con Simulacion antes de activarlo."><input type="checkbox" data-cfg="auto-transport"/> Auto transporte inter-ciudad</label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="Reserva y lote minimo para el transporte">Reserva % <input class="gb-cfg-input" type="number" data-cfg="transport-reserve" min="0" max="80" style="width:45px"/>
            Lote minimo <input class="gb-cfg-input" type="number" data-cfg="transport-min" min="100" max="10000" step="100" style="width:60px"/>
          </label>
          <label class="gb-cfg-row gb-cfg-risk" title="ALTO RIESGO: vacia recursos por encima del umbral hacia otras ciudades. Sin vuelta atras. Envia solo la MITAD del excedente y nunca el hierro que la cueva todavia puede guardar."><input type="checkbox" data-cfg="auto-dump"/> Auto vaciado de recursos</label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="Umbral por encima del cual vaciar cada recurso">Vaciar por encima de %
            mad <input class="gb-cfg-input" type="number" data-cfg="dump-th-wood" min="50" max="100" style="width:45px"/>
            pie <input class="gb-cfg-input" type="number" data-cfg="dump-th-stone" min="50" max="100" style="width:45px"/>
            pla <input class="gb-cfg-input" type="number" data-cfg="dump-th-iron" min="50" max="100" style="width:45px"/>
          </label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="Porcentaje a conservar siempre del recurso (no se vacia por debajo)">Conservar %
            mad <input class="gb-cfg-input" type="number" data-cfg="dump-keep-wood" min="0" max="95" style="width:45px"/>
            pie <input class="gb-cfg-input" type="number" data-cfg="dump-keep-stone" min="0" max="95" style="width:45px"/>
            pla <input class="gb-cfg-input" type="number" data-cfg="dump-keep-iron" min="0" max="95" style="width:45px"/>
          </label>
          <label class="gb-cfg-num gb-cfg-sub" title="Ciudades propias que aceptan el vaciado, separadas por comas. Vacio = usa el sesgo del perfil y luego el planificador de transporte.">Destinos <input class="gb-cfg-input" data-cfg="dump-sinks" placeholder="vacio = auto" style="width:180px" data-gb-tip="Ciudades propias que aceptan el vaciado (separadas por comas)"/></label>
          <label class="gb-cfg-row" data-gb-tip="Comerciar con aldeas propias (enviar/recibir recursos)"><input type="checkbox" data-cfg="auto-rural-trade"/> Comercio con aldeas</label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="Ratio minimo para que el comercio merezca la pena y recurso objetivo">Ratio minimo <input class="gb-cfg-input" type="number" data-cfg="rural-ratio" step="0.25" min="0.25" max="2" style="width:50px"/>
            Recurso <select class="gb-cfg-input" data-cfg="rural-res" data-gb-tip="Recurso a pedir/comerciar en las aldeas"><option value="iron">plata</option><option value="stone">piedra</option><option value="wood">madera</option></select>
          </label>
          <label class="gb-cfg-row" data-gb-tip="Mejorar aldeas propias automaticamente"><input type="checkbox" data-cfg="auto-rural-level"/> Mejora de aldeas</label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="Nivel maximo al que se permite mejorar aldeas">Nivel maximo <input class="gb-cfg-input" type="number" data-cfg="rural-level-max" min="1" max="6" style="width:40px"/></label>
        `)}
        ${gbCfgGroup('Cultura', `
          <label class="gb-cfg-row" data-gb-tip="Lanzar festividades y celebraciones automaticamente"><input type="checkbox" data-cfg="auto-culture"/> Cultura automatica</label>
          <label class="gb-cfg-num gb-cfg-sub">
            <label data-gb-tip="Permitir festival"><input type="checkbox" data-cfg="cult-festival"/> festival</label>
            <label data-gb-tip="Permitir procesion"><input type="checkbox" data-cfg="cult-procession"/> procesion</label>
            <label data-gb-tip="Permitir teatro"><input type="checkbox" data-cfg="cult-theater"/> teatro</label>
            <label data-gb-tip="Permitir olimpiada (50 oro + academia 30)"><input type="checkbox" data-cfg="cult-olympic"/> olimpiada</label>
          </label>
          <label class="gb-cfg-row gb-cfg-sub gb-cfg-risk" data-gb-tip="Permitir cultura premium: la olimpiada cuesta 50 oro"><input type="checkbox" data-cfg="allow-premium-culture"/> Permitir cultura premium (olimpiada = 50 oro)</label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="Oro maximo que el bot gastara al dia en olimpiadas">Presupuesto diario de oro para la olimpiada
            <input class="gb-cfg-input" type="number" data-cfg="culture-gold-budget" min="0" max="500" step="50" style="width:60px"/>
          </label>
        `)}
        ${gbCfgGroup('Ritmo y pausas', `
          <label class="gb-cfg-row" data-gb-tip="Detectar actividad del usuario (movimientos del raton) y pausar el bot"><input type="checkbox" data-cfg="pause-activity"/> Pausar cuando estoy activo</label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="Minutos de pausa tras detectar actividad">Minutos de pausa <input class="gb-cfg-input" type="number" data-cfg="pause-ms" min="1" max="60" style="width:40px"/></label>
          <label class="gb-cfg-row" data-gb-tip="Pausar el bot durante la noche"><input type="checkbox" data-cfg="night-pause"/> Pausa nocturna</label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="Rango horario (formato 24h) en que se aplica la pausa nocturna">Horas <input class="gb-cfg-input" type="number" data-cfg="night-start" min="0" max="23" style="width:40px"/>-<input class="gb-cfg-input" type="number" data-cfg="night-end" min="0" max="23" style="width:40px"/></label>
          <label class="gb-cfg-row" title="Un modulo que nunca encuentra nada que hacer duplica su propio intervalo (hasta 8x) hasta que vuelve a actuar."><input type="checkbox" data-cfg="orch-adaptive"/> Cadencia adaptativa (frena modulos inactivos)</label>
          <label class="gb-cfg-row" title="Si un almacen se llena y la recoleccion deja de rendir, cueva/comercio/aldeas pasan por delante de la recoleccion y no se les aplica el frenado por inactividad. Solo cambia el ORDEN, nunca el presupuesto."><input type="checkbox" data-cfg="orch-deadlock"/> Resolver atasco de almacen (prioriza vaciado)</label>
          <label class="gb-cfg-row" title="Aplica un perfil (AFK / recoleccion / guerra) segun dia, hora y condiciones. Lista de reglas acotada: no acepta codigo ni texto libre."><input type="checkbox" data-cfg="profile-auto"/> Cambio automatico de perfiles</label>
        `)}
        ${gbCfgGroup('Interfaz', `
          <label class="gb-cfg-num" data-gb-tip="Tema visual del panel">Tema
            <select class="gb-cfg-input" data-cfg="theme" data-gb-tip="Tema visual del panel">
              <option value="dark">oscuro</option>
              <option value="light">claro</option>
              <option value="system">del sistema</option>
            </select>
          </label>
          <label class="gb-cfg-row" title="Ctrl/Cmd+Shift+tecla. Nunca se dispara mientras escribes en un campo del juego o del panel."><input type="checkbox" data-cfg="keyboard-shortcuts"/> Atajos de teclado</label>
          <div class="key-list gb-cfg-note" data-gb-tip="Lista de atajos de teclado activos"></div>
          <button data-cfg="keybindings-edit" class="gb-cfg-btn gb-cfg-sub" data-gb-tip="Editar las combinaciones de atajos de teclado">Reasignar atajos...</button>
          <label class="gb-cfg-row" title="Anade un menu GrepBot junto al popup de ciudad del juego. No intercepta ningun evento del juego: solo se monta al lado."><input type="checkbox" data-cfg="context-menu"/> Menu contextual junto al popup del juego</label>
        `)}
        ${gbCfgGroup('Avisos y notificaciones', `
          <label class="gb-cfg-num" data-gb-tip="URL del webhook (Discord o Telegram) al que enviar avisos">URL de webhook <input class="gb-cfg-input" type="text" data-cfg="webhook-url" placeholder="webhook de Discord o https://api.telegram.org/bot.../sendMessage" style="width:100%;font-size:10px"/></label>
          <label class="gb-cfg-num" data-gb-tip="Tipos de evento que disparan un aviso al webhook">Eventos
            <label data-gb-tip="Aviso cuando aparece un captcha"><input type="checkbox" data-cfg="wh-captcha"/> captcha</label>
            <label data-gb-tip="Aviso cuando se envia un ataque"><input type="checkbox" data-cfg="wh-attack"/> ataque</label>
            <label data-gb-tip="Aviso cuando un almacen se llena"><input type="checkbox" data-cfg="wh-warehouse"/> almacen</label>
            <label data-gb-tip="Aviso en eventos de cultura"><input type="checkbox" data-cfg="wh-culture"/> cultura</label>
            <label title="Aviso ~10 min antes de que un almacen llegue al limite."><input type="checkbox" data-cfg="wh-capping"/> pre-aviso de almacen (~10 min)</label>
            <label title="Aviso cuando alguien te espia repetidamente en 24h."><input type="checkbox" data-cfg="wh-counter-intel"/> contra-inteligencia</label>
            <label title="ALTO RIESGO de divulgacion: publica resumenes de tus informes de espionaje al webhook. Por defecto OFF y con nombres ocultos."><input type="checkbox" data-cfg="intel-digest"/> resumen de espionaje</label>
          </label>
          <label class="gb-cfg-num" data-gb-tip="chat_id de Telegram (opcional si ya va en la URL)">Telegram chat_id <input class="gb-cfg-input" type="text" data-cfg="wh-tg-chat" placeholder="opcional si no va en la URL" style="width:140px;font-size:10px"/></label>
          <label class="gb-cfg-row" title="Notificaciones del navegador. Comparten el mismo antirrebote de 5 min que los webhooks: un evento, un aviso."><input type="checkbox" data-cfg="notify-enabled"/> Notificaciones de escritorio</label>
          <label class="gb-cfg-num gb-cfg-sub">
            <button data-cfg="notify-permission" class="gb-cfg-btn" data-gb-tip="Pedir permiso al navegador para mostrar notificaciones">Permitir notificaciones</button>
            <label data-gb-tip="Silenciar el sonido de las notificaciones"><input type="checkbox" data-cfg="notify-muted"/> silenciar sonido</label>
            volumen <input class="gb-cfg-input" type="number" data-cfg="notify-volume" min="0" max="100" step="10" style="width:50px" data-gb-tip="Volumen del sonido (0-100)"/>%
            <button data-cfg="notify-test" class="gb-cfg-btn" data-gb-tip="Disparar una notificacion de prueba">Probar</button>
          </label>
        `)}
        ${gbCfgGroup('Diagnóstico y datos', `
          <label class="gb-cfg-row" title="Guarda cada 5 min una instantanea acotada de la configuracion y el estado de transacciones. No copia la bitacora ni los hallazgos."><input type="checkbox" data-cfg="snapshots-on"/> Instantaneas de estado</label>
          <button data-cfg="snapshot-restore" class="gb-cfg-btn gb-cfg-sub" data-gb-tip="Restaurar una instantanea guardada anteriormente">Restaurar instantanea...</button>
          <label class="gb-cfg-row" title="Mide ms por llamada de cada bucle. Muy barato, pero por defecto OFF."><input type="checkbox" data-cfg="profiler-on"/> Perfilador de rendimiento</label>
          <label class="gb-cfg-row" title="Muestrea el heap (solo Chromium) y el tamano de los mapas de estado cada 5 min."><input type="checkbox" data-cfg="mem-probe-on"/> Sonda de memoria</label>
          <label class="gb-cfg-row" title="Copiar/Exportar sustituyen nombres e ids de jugador por hashes cortos. Desactivalo solo para depurar en local."><input type="checkbox" data-cfg="export-redact"/> Anonimizar nombres/ids en Copiar y Exportar</label>
          <label class="gb-cfg-row" title="Anade a la pestana Intel el resumen de batallas por jugador y el ranking de granjas por botin. Solo lectura, se recalcula en cada render."><input type="checkbox" data-cfg="intel-battle-stats"/> Estadisticas de batalla en Intel</label>
          <label class="gb-cfg-row" data-gb-tip="Asistencia Grepodata Index+ para cruzar espias con bases de datos externas"><input type="checkbox" data-cfg="grepodata"/> Asistencia Grepodata Index+</label>
        `)}
        ${gbCfgGroup('Defensa y militar (ALTO RIESGO)', `
          <label class="gb-cfg-row" data-gb-tip="Avisar cuando se detecte CS o entrantes hostiles"><input type="checkbox" data-cfg="cs-alert"/> Avisos de CS / entrantes</label>
          <label class="gb-cfg-row" data-gb-tip="Solicitar milicia automaticamente ante entrantes (gasta recursos)"><input type="checkbox" data-cfg="auto-militia"/> Milicia automatica ante entrantes</label>
          <label class="gb-cfg-row" data-gb-tip="Esquivar tropas automaticamente ante ataques (ALTO RIESGO)"><input type="checkbox" data-cfg="auto-dodge"/> Esquiva automatica</label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="Modo: solo avisar, o esquivar a una ciudad segura">Modo de defensa <select class="gb-cfg-input" data-cfg="defense-mode" data-gb-tip="Solo avisar, o esquivar a una ciudad segura"><option value="notify">avisar</option><option value="safe">esquiva segura</option></select>
            margen de regreso +<input class="gb-cfg-input" type="number" data-cfg="defense-return-margin" min="0" max="3600" style="width:55px" data-gb-tip="Segundos extra que se aplican al margen de regreso para asegurar que las tropas vuelven"/>s (manual si llego apoyo)
            dejar en casa <input class="gb-cfg-input" type="number" data-cfg="dodge-floor" min="0" max="500" style="width:50px" data-gb-tip="Tropas minimas que quedan en cada ciudad aunque se esquive"/>
          </label>
          <label class="gb-cfg-num gb-cfg-sub" title="Pesos del motor de amenaza (v4 5.3). Los valores por defecto reproducen exactamente el comportamiento anterior.">Amenaza:
            CS <input class="gb-cfg-input" type="number" data-cfg="threat-cs" min="0" max="120" style="width:45px" data-gb-tip="Peso de CS en el calculo de amenaza"/>
            ETA&lt;15m <input class="gb-cfg-input" type="number" data-cfg="threat-eta15" min="0" max="60" style="width:45px" data-gb-tip="Peso de los entrantes con ETA menor a 15 minutos"/>
            simult <input class="gb-cfg-input" type="number" data-cfg="threat-sim" min="0" max="30" style="width:45px" data-gb-tip="Peso por cada atacante simultaneo"/>
            apoyo -<input class="gb-cfg-input" type="number" data-cfg="threat-support" min="0" max="30" style="width:45px" data-gb-tip="Reduccion de amenaza si llegan apoyos"/>
          </label>
          <label class="gb-cfg-num gb-cfg-sub" title="Riesgo base por tipo de ataque (v4 5.4). Un saqueo y un asedio no son la misma amenaza. El umbral de esquiva, si se rellena, manda sobre el umbral general de arriba.">Esquiva:
            umbral <input class="gb-cfg-input" type="number" data-cfg="defense-risk-threshold" min="10" max="200" placeholder="auto" style="width:55px" data-gb-tip="Umbral de riesgo para esquivar (vacio = auto)"/>
            CS +<input class="gb-cfg-input" type="number" data-cfg="defense-risk-cs" min="0" max="120" style="width:45px" data-gb-tip="Riesgo adicional por CS presente"/>
            saqueo <input class="gb-cfg-input" type="number" data-cfg="defense-risk-raid" min="0" max="100" style="width:45px" data-gb-tip="Riesgo base por saqueo"/>
            asedio <input class="gb-cfg-input" type="number" data-cfg="defense-risk-siege" min="0" max="100" style="width:45px" data-gb-tip="Riesgo base por asedio"/>
          </label>
          <label class="gb-cfg-row" title="Agrupa los entrantes de una ciudad en oleadas y dice si la CS tiene ventana de snipe. Solo lectura."><input type="checkbox" data-cfg="cs-snipe"/> Detector de contra-snipe</label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="Parametros del detector de contra-snipe">Snipe:
            agrupar oleadas <input class="gb-cfg-input" type="number" data-cfg="cs-cluster-gap" min="60" max="21600" style="width:60px" data-gb-tip="Segundos maximos entre entrantes para considerarlos la misma oleada"/>s
            cobertura <input class="gb-cfg-input" type="number" data-cfg="cs-cover" min="5" max="900" style="width:55px" data-gb-tip="Cobertura de la CS en segundos"/>s
            muy justa &lt;= <input class="gb-cfg-input" type="number" data-cfg="cs-tight" min="0" max="120" style="width:45px" data-gb-tip="Ventana (s) considerada muy justa"/>s
          </label>
          <label class="gb-cfg-row gb-cfg-risk" title="ALTO RIESGO: envia tropas reales de otras ciudades cuando llega un ataque de banda alta o con CS. Gasta tropas sin vuelta atras; pide confirmacion por ventana. Aprende su propia plantilla: envia un apoyo a mano una vez."><input type="checkbox" data-cfg="support-auto"/> Apoyo automatico (ALTO RIESGO, OFF)</label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="Umbrales para confirmar un apoyo automatico">Apoyo:
            confirmar &gt; <input class="gb-cfg-input" type="number" data-cfg="support-confirm" min="0" max="10000" style="width:60px" data-gb-tip="Amenaza minima para confirmar envio de apoyo"/>
            dejar en casa <input class="gb-cfg-input" type="number" data-cfg="support-home-floor" min="0" max="50" style="width:45px" data-gb-tip="Tropas que la ciudad de origen debe conservar siempre"/>
            ETA min <input class="gb-cfg-input" type="number" data-cfg="support-min-eta" min="30" max="3600" style="width:55px" data-gb-tip="ETA minima del apoyo (s)"/>s
            no armar bajo <input class="gb-cfg-input" type="number" data-cfg="support-no-arm" min="10" max="600" style="width:50px" data-gb-tip="ETA minima del ataque entrante para armar el apoyo"/>s
          </label>
          <label class="gb-cfg-row gb-cfg-risk" title="Explorador automatico. Gasta plata y puede devolver captcha. Su propia Simulacion viene activada: veras el payload antes de gastar nada. No envia nada hasta aprender la ruta espiando a mano una vez."><input type="checkbox" data-cfg="auto-spy"/> Auto-espionaje (aprende la ruta a mano)</label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="Limites del ciclo de espionaje automatico">Espionaje:
            por ciclo <input class="gb-cfg-input" type="number" data-cfg="spy-per-cycle" min="1" max="5" style="width:40px" data-gb-tip="Numero maximo de espias por ciclo"/>
            hueco min <input class="gb-cfg-input" type="number" data-cfg="spy-min-gap" min="1" max="1440" style="width:50px" data-gb-tip="Minutos minimos entre dos espias al mismo objetivo"/> min
            top informes <input class="gb-cfg-input" type="number" data-cfg="spy-top" min="0" max="50" style="width:45px" data-gb-tip="Numero maximo de informes a mostrar por objetivo"/>
            <label data-gb-tip="Ver el payload antes de enviar (no envia nada)"><input type="checkbox" data-cfg="spy-dry"/> Simulacion</label>
          </label>
          <label class="gb-cfg-row" data-gb-tip="Reclutar tropas automaticamente en cuarteles/puerto"><input type="checkbox" data-cfg="auto-recruit"/> Reclutamiento automatico</label>
          <label class="gb-cfg-row gb-cfg-sub" data-gb-tip="Lanzar hechizos de reclutamiento antes de reclutar"><input type="checkbox" data-cfg="recruit-spells"/> Lanzar antes los hechizos de reclutamiento</label>
          <label class="gb-cfg-row gb-cfg-sub gb-cfg-risk" title="Convierte aldeanos en unidades cuando la aldea no admite mas recursos. Recompute: compara espada+arquero vs hoplita+hondero, elige la pareja con mas tropas y dentro de ella la unidad con menos. Requiere abrir la aldea y pulsar Aceptar una vez a mano la primera vez."><input type="checkbox" data-cfg="village-recruit"/> Reclutar en aldeas saturadas</label>
          <label class="gb-cfg-num gb-cfg-sub" style="margin-left:28px" data-gb-tip="% de llenado y cantidad a reclutar por tick">% llenado aldea
            <input class="gb-cfg-input" type="number" data-cfg="village-recruit-fill" min="50" max="99" style="width:50px" data-gb-tip="% minimo de llenado de la aldea para reclutar"/>
            cantidad por tick
            <input class="gb-cfg-input" type="number" data-cfg="village-recruit-amount" min="1" max="20" style="width:50px" data-gb-tip="Cantidad de aldeanos a reclutar por tick"/>
          </label>
          <label class="gb-cfg-row gb-cfg-risk" data-gb-tip="Recluta todas las unidades de la lista de una sola vez. Solo se dispara cuando los recursos Y la poblacion cubren el lote entero a la vez (todo-o-nada). Si falta aunque sea una unidad, no se envia nada. Lista persistente por ciudad: el ciclo re-arms tras cada disparo."><input type="checkbox" data-cfg="batch-recruit"/> Lote de reclutamiento (todo-o-nada)</label>
          <div class="gb-cfg-note gb-cfg-sub">El editor por ciudad (objetivos permanentes y lineas del lote) vive en Militar &rarr; Entrenamiento.</div>
        `, false, 'risk')}
        ${gbCfgGroup('Premium y favor (ALTO RIESGO)', `
          <label class="gb-cfg-row" data-gb-tip="Compra las UNIDADES del barco mercante que estan en la lista de deseos, al precio exacto o menor. Se paga con el recurso de cambio del barco (plata), no con oro."><input type="checkbox" data-cfg="auto-merchant"/> Francotirador del mercader (unidades)</label>
          <label class="gb-cfg-row" title="Cambia plata por madera/piedra en el barco mercante cuando el ratio de la visita llega al minimo pedido. El ratio de la visita es fijo: no hay bombeo."><input type="checkbox" data-cfg="auto-pt-trade"/> Cambio de recursos del barco mercante</label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="Parametros del cambio de recursos">ratio minimo <input class="gb-cfg-input" type="number" step="0.1" min="0.5" max="5" data-cfg="pt-ratio" style="width:52px" data-gb-tip="Recurso recibido por cada unidad de plata gastada. Por debajo de esto no se cambia nada."/>
            cantidad minima <input class="gb-cfg-input" type="number" min="1" max="10000" data-cfg="pt-pump" style="width:52px" data-gb-tip="Cambio mas pequeno que merece la pena enviar"/>
            reserva % <input class="gb-cfg-input" type="number" min="0" max="90" data-cfg="pt-reserve" style="width:52px" data-gb-tip="Reserva % sobre el stock que no se gasta"/>
          </label>
          <label class="gb-cfg-num gb-cfg-sub" data-gb-tip="Recursos que el bot acepta recibir en el barco mercante">recibir
            <label data-gb-tip="Aceptar madera"><input type="checkbox" data-cfg="pt-want-wood"/> madera</label>
            <label data-gb-tip="Aceptar piedra"><input type="checkbox" data-cfg="pt-want-stone"/> piedra</label>
            <label data-gb-tip="Aceptar plata"><input type="checkbox" data-cfg="pt-want-iron"/> plata</label>
          </label>
          <div class="gb-cfg-num gb-cfg-sub">
            <span id="gb-pt-status" class="gb-cfg-note" data-gb-tip="Estado actual del bombeo del barco mercante"></span>
            <button data-cfg="pt-now" class="gb-cfg-btn ok" data-gb-tip="Bombear hasta el ratio objetivo y luego enviar un trato grande">Bombear + comerciar ya</button>
            <button data-cfg="pt-copy" class="gb-cfg-btn" title="Copia el HTML de la ventana del mercader abierta - hace falta una vez para confirmar el analizador de ofertas">Copiar HTML de la oferta</button>
          </div>
          <label class="gb-cfg-row" data-gb-tip="Granja de favor desactivada por seguridad: ruta de objetivo insegura"><input type="checkbox" data-cfg="auto-favor" disabled/> Granja de favor (desactivada: ruta de objetivo insegura)</label>
          <label class="gb-cfg-num gb-cfg-sub" title="ALTO RIESGO. El favor gastado no vuelve. No se lanza NADA sin escribir aqui un id de poder explicito: nunca hay valor por defecto.">Hechizo divino:
            poder <input class="gb-cfg-input" data-cfg="godspell-power" placeholder="id exacto, sin valor por defecto" style="width:170px" data-gb-tip="ID exacto del poder a lanzar (sin valor por defecto)"/>
            coste <input class="gb-cfg-input" type="number" data-cfg="godspell-cost" min="0" max="500" style="width:55px" data-gb-tip="Coste en favor a no superar"/>
            reserva % <input class="gb-cfg-input" type="number" data-cfg="godspell-reserve" min="0" max="95" style="width:50px" data-gb-tip="Reserva % de favor que el bot no gasta"/>
          </label>
          <label class="gb-cfg-row" data-gb-tip="Donar recursos a la Maravilla del mundo"><input type="checkbox" data-cfg="auto-wonder"/> Donaciones a la Maravilla</label>
          <label class="gb-cfg-row" title="Gasta favor en la maravilla de la alianza. Requiere haber capturado wonderFavorTpl. Por defecto OFF."><input type="checkbox" data-cfg="auto-wonder-favor"/> Lanzar favor en la Maravilla (captura el poder antes)</label>
        `, false, 'risk')}
        </div>
        </div>
      </div>
    </section>
    <section data-tab="stats" hidden>
      <div class="gb-diag-hero">
        <div style="flex:1;min-width:0">
          <div class="gb-diag-hero-t">Comprobación del sistema</div>
          <div class="gb-diag-hero-s" id="gb-pf-when">Lee todos los módulos sin enviar nada al juego.</div>
        </div>
        <button id="gb-preflight" class="gb-action" title="Prueba de solo lectura de cada modulo: colecciones, claves aprendidas, payloads que se enviarian. No envia nada." style="background:var(--gb-warn-bg);border:1px solid var(--gb-accent-3);color:var(--gb-accent-2);font-weight:700;flex-shrink:0">Comprobar ahora</button>
      </div>
      <div class="gb-pf-list"></div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
        <b style="font-size:11px;color:#f5a623">Qué ha hecho</b>
        <button data-stats="1h" data-gb-tip="Ver estadisticas de la ultima hora" style="background:#262626;border:1px solid #333;color:#aaa;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">1h</button>
        <button data-stats="24h" class="on" data-gb-tip="Ver estadisticas de las ultimas 24 horas" style="background:#333;border:1px solid #555;color:#fff;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">24h</button>
        <button data-stats="7d" data-gb-tip="Ver estadisticas de los ultimos 7 dias" style="background:#262626;border:1px solid #333;color:#aaa;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">7d</button>
      </div>
      <pre class="stats-body" style="font-size:10px;white-space:pre-wrap;background:#111;padding:6px;border:1px solid #333;max-height:320px;overflow:auto;color:#cfc"></pre>
      ${gbSection('Estado operativo (texto de máquina)', '<pre class="overview-panel" style="font-size:10px;white-space:pre-wrap;margin:0;max-height:180px;overflow:auto;color:#cfd6df"></pre>')}
    </section>
    <section data-tab="log" hidden>
      <div class="gb-logsub">
        <button data-logsub="live" class="on" data-gb-tip="Ver el registro en vivo (gbLog)">Registro en vivo</button>
        <button data-logsub="mem" data-gb-tip="Ver la bitacora de decisiones (journal)">Decisiones</button><button data-logsub="replay" data-gb-tip="Reproducir el journal por ventana de tiempo">Reproducir</button><button data-logsub="pending" data-gb-tip="Transacciones unknown / manual-review en txState (las que REVISAR rojo cuenta)">Pendientes</button>
        <input class="jrn-filter" placeholder="filter feature/action/target" data-gb-tip="Filtrar por feature, action o target"/>
      </div>
      <div class="log-list"></div>
      <div class="jrn-btns log-btns">
        <button data-log="copy" data-gb-tip="Copiar el registro en vivo entero (anillo completo) al portapapeles">Copiar todo</button>
        <button data-log="download" data-gb-tip="Descargar el registro en vivo entero como .txt">Descargar .txt</button>
      </div>
      <div class="jrn-pane" hidden>
        <div class="jrn-head"></div>
        <div class="jrn-list"></div>
        <div class="jrn-btns">
          <button data-jrn="copy" data-gb-tip="Copiar la bitacora visible al portapapeles">Copiar JSON</button>
          <button data-jrn="copy-log" data-gb-tip="Copiar el registro en vivo (anillo completo) al portapapeles">Copiar log</button>
          <button data-jrn="clear-skips" data-gb-tip="Borrar las ventanas de salto por decision">Limpiar saltos</button>
          <button data-jrn="clear" data-gb-tip="Borrar la bitacora de decisiones (historial)">Limpiar bitacora</button>
          <button data-jrn="clear-all" data-gb-tip="Borrar bitacora, saltos, cortacircuitos, captchas y transacciones desconocidas">Limpiar registros</button>
        </div>
      </div>
      <div class="pending-pane" hidden>
        <div class="pending-head"></div>
        <div class="pending-list"></div>
        <div class="pending-btns">
          <button data-pending="refresh" data-gb-tip="Refrescar la lista de pendientes">Refrescar</button>
          <button data-pending="copy" data-gb-tip="Copiar el listado al portapapeles">Copiar JSON</button>
          <button data-pending="clear-all" data-gb-tip="Marcar todas las transacciones unknown/manual-review como abortadas">Limpiar todas</button>
        </div>
      </div>
    </section>
    <footer>
      <div class="gb-status-row">
        <span id="gb-next-farms" data-gb-tip="Cuenta atras hasta el proximo cobro y escaneo de aldeas" style="color:#6cf"></span>
        <span id="gb-next-towns" data-gb-tip="Cuenta atras hasta el proximo escaneo de ciudades" style="color:#fc6"></span>
        <span id="gb-collect-state" data-gb-tip="Estado de la recoleccion automatica (activa / apagada / pausas)" style="color:#f96;font-weight:bold"></span>
        <span id="gb-status" style="color:#888"></span>
      </div>
      <button type="button" id="gb-foot-preflight" data-act="preflight" data-gb-tip="Probar todos los modulos sin enviar nada (solo lectura)">Comprobar sistema</button>
      <details class="gb-actions">
        <summary>Más</summary>
        <div class="gb-actions-menu">
          <div class="gb-menu-h">Actualizar ahora</div>
          <button type="button" data-act="refresh" data-gb-tip="Volver a leer las ciudades del juego">Releer ciudades</button>
          <button type="button" data-act="scrape-farms" data-gb-tip="Forzar el escaneo de aldeas ahora (ignora la cadencia)">Cobrar aldeas ahora</button>
          <button type="button" data-act="scrape-towns" data-gb-tip="Forzar el escaneo de ciudades ahora (ignora la cadencia)">Escanear ciudades ahora</button>
          <div class="gb-menu-h">Perfiles</div>
          <button type="button" data-act="preset-afk" title="Activa granjas, cueva, construccion e investigacion con cadencia lenta y presupuesto bajo. Todo HIGH-RISK queda OFF.">AFK nocturno</button>
          <button type="button" data-act="preset-farming" title="Cadencia corta, banda y cueva, todo economico, culture OFF.">Recolección activa</button>
          <button type="button" data-act="preset-war" title="Construccion, dodge notify, sin cultura ni investigacion. HIGH-RISK forzado a OFF.">Guerra</button>
          <div class="gb-menu-h">Datos</div>
          <button type="button" data-act="copy" data-gb-tip="Copiar JSON de estado al portapapeles">Copiar el estado</button>
          <button type="button" data-act="export" data-gb-tip="Exportar la configuracion completa al portapapeles">Exportar la configuración</button>
          <button type="button" data-act="bundle" title="Copia TODO en un solo texto: evidencia, configuracion, bitacora de decisiones, log, hallazgos, puente y preflight. Respeta la opcion de anonimizado. No envia nada.">Copiar todo para un informe</button>
          <button type="button" data-act="bundle-file" title="Lo mismo que Copiar todo, pero guardado en un archivo .txt.">Guardar un informe (.txt)</button>
          <button type="button" data-act="evidence" title="Instantanea de solo lectura y anonimizada para las validaciones de TASKS. Copia JSON. No envia nada.">Evidencia</button>
          <button type="button" data-act="clear" data-gb-tip="Borrar los hallazgos de inteligencia almacenados">Limpiar hallazgos</button>
          <div class="gb-menu-h">Diagnóstico</div>
          <button type="button" data-act="diag" data-gb-tip="Volcar diagnostico de bridge y estado de partidas">Diagnóstico del puente</button>
          <button type="button" data-act="diag-farms" title="Vuelca en el Registro, por aldea: cupo diario restante, marca de agotado, tipo de cobro elegido y la carta de unidad. Solo lectura, no envia nada.">Diagnóstico de aldeas</button>
          <div class="gb-menu-h">Ventana</div>
          <button type="button" data-act="reset-pos" title="Reset panel position">Volver a su sitio</button>
          <div class="gb-menu-sep"></div>
          <button type="button" data-act="panic" style="color:#f66;font-weight:bold" title="Parada de emergencia: pausa toda la automatizacion, fuerza Simulacion y libera los bloqueos. No envia nada.">Parar todo</button>
          <button type="button" data-act="panic-recover" disabled title="Disponible 30 s despues del panico. Limpia las ventanas de salto y reanuda. Simulacion sigue ON.">Reanudar (limpiar saltos)</button>
        </div>
      </details>
    </footer>
  `;
  document.body.appendChild(panel);

  // Materialize every data-gb-tip in the panel chrome into a real title + aria-label.
  gbTipWalk(panel);
  ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach(dir => {
    const h = document.createElement('div');
    h.className = 'gb-resize gb-resize-' + dir;
    h.dataset.dir = dir;
    h.title = 'Resize';
    panel.appendChild(h);
  });
  applyPanelGeom(state.panelGeom);
  applyTheme();
  try { renderTownSwitch(); } catch (_) {}

  {
    const start = TAB_IDS.includes(state.activeTab) ? state.activeTab : 'overview';
    const g0 = tabGroupOf(start);
    _lastTabInGroup[g0.id] = start;
    paintNav(start);
    panel.querySelectorAll('section[data-tab]').forEach(s => {
      s.hidden = s.dataset.tab !== start;
    });
  }

  panel.querySelector('.gb-actions')?.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('button[data-act]');
    if (!btn) return;
    const det = panel.querySelector('.gb-actions');
    if (det) det.open = false;
  });

  panel.querySelectorAll('.gb-logsub button').forEach(btn => {
    btn.addEventListener('click', () => {
      const sub = btn.dataset.logsub;

      // The journal pane hosts BOTH non-live sub-views, so it must be visible
      // for replay too - keying its visibility off 'mem' alone left the replay
      // rendering into a hidden pane.
      const usesPane = sub === 'mem' || sub === 'replay';
      const usesPending = sub === 'pending';
      panel.querySelectorAll('.gb-logsub button').forEach(b => b.classList.toggle('on', b === btn));
      const live = panel.querySelector('.log-list');
      const liveBtns = panel.querySelector('.log-btns');
      const pane = panel.querySelector('.jrn-pane');
      const pend = panel.querySelector('.pending-pane');
      if (live) live.hidden = usesPane || usesPending;
      // The live-log copy buttons live outside .jrn-pane, so they need the same
      // visibility flip - otherwise they stay on screen under the journal.
      if (liveBtns) liveBtns.hidden = usesPane || usesPending;
      if (pane) pane.hidden = !(usesPane);
      if (pend) pend.hidden = !usesPending;
      if (sub === 'mem') renderJournal();
      else if (sub === 'replay') renderReplay();
      else if (sub === 'pending') renderPending();
      else renderLog();
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
  {
    const jf = panel.querySelector('.jrn-filter');
    if (jf) {
      const savedJf = tabFilterGet('jrn');
      if (savedJf) jf.value = String(savedJf);
      jf.addEventListener('input', () => {
        tabFilterSet('jrn', jf.value.trim());
        journalFilterDebounced();
      });
    }
  }
  // Copy / download of the live log ring from the live sub-view itself. The
  // journal pane has its own "Copiar log", but that pane is hidden while the
  // user is looking at "Registro en vivo", which left no way to grab the log
  // from the view that shows it.
  panel.querySelector('[data-log=copy]')?.addEventListener('click', () => {
    const text = gbLogDumpText();
    if (!text) { flash('registro vacio'); return; }
    gbClipWrite(text, 'log copiado (' + text.split('\n').length + ' lineas)');
  });
  panel.querySelector('[data-log=download]')?.addEventListener('click', () => {
    const text = gbLogDumpText();
    if (!text) { flash('registro vacio'); return; }
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;
    a.download = `grepbot-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    a.click();
    gbTimeout(() => { try { URL.revokeObjectURL(objectUrl); } catch (_) {} }, 0);
    flash('log descargado');
  });
  panel.querySelector('[data-jrn=copy]')?.addEventListener('click', () => {
    const text = JSON.stringify({ decisions: state.decisions, skips: state.decisionSkips }, null, 2);
    navigator.clipboard.writeText(text).then(() => flash('bitacora copiada')).catch(() => flash('fallo al copiar'));
  });
  // Clipboard copy of the live log ring (the same text "Copiar todo" embeds,
  // but exposed here so the user does not have to round-trip through the
  // bundle). No explicit cap: gbLogDumpText defaults to LOG_MAX.
  panel.querySelector('[data-jrn=copy-log]')?.addEventListener('click', () => {
    const text = gbLogDumpText();
    if (!text) { flash('registro vacio'); return; }
    gbClipWrite(text, 'log copiado (' + text.split('\n').length + ' lineas)');
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
  // "Limpiar registros" - the union button. The previous "Limpiar bitacora"
  // only cleared the journal history and skip windows, leaving circuit
  // breakers, captcha cooldowns and txState unknown entries intact. Those
  // are the registries that actually gate writes; clearing only the journal
  // left the bot silently blocked, which is what the user reported as
  // "unable to remove all registry problems". Every clear runs through its
  // existing helper so storage, journal ring, circuit save and tx save all
  // get the durability they expect.
  panel.querySelector('[data-jrn=clear-all]')?.addEventListener('click', () => {
    if (!confirm('Limpiar TODOS los registros de GrepBot en ' + location.host + '?\n\n' +
      '- Bitacora de decisiones (historial)\n' +
      '- Ventanas de salto por decision\n' +
      '- Cortacircuitos por feature\n' +
      '- Cooldowns de captcha (incluido el global)\n' +
      '- Transacciones unknown / manual-review (marcadas como aborted)\n\n' +
      'No envia nada al servidor. Solo desbloquea el bot.')) return;
    jrnClear();
    circuitClear();
    captchaClear();
    try { txClearUnknown(); } catch (_) {}
    try { gbUnlockAll(); } catch (_) {}
    gbLog('memory: all registries cleared (journal, skips, circuits, captcha, tx)');
    flash('registros limpiados');
    updateStatus();
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
  panel.querySelector('#gb-sim-run')?.addEventListener('click',()=>{const h=Math.max(1,+panel.querySelector('#gb-sim-hours')?.value||24);dashboardSimulation=simulateAccount(h);state.simCfg.horizonHours=h;save(STORE.SIM_CFG,state.simCfg);renderDashboard();});
  // ===== Config wizard (v4 plan 6.9) + undo/redo (v4 plan 6.10) =============
  // Export goes through qolExportConfigForUi ONLY: the raw dump is internal
  // until redaction has run, so no UI path can stringify it directly.
  function renderConfigHistoryButtons() {
    const c = qolHistoryCounts();
    const u = panel.querySelector('#gb-cfg-undo'), r = panel.querySelector('#gb-cfg-redo'), h = panel.querySelector('#gb-cfg-hist');
    if (u) u.disabled = !c.undo;
    if (r) r.disabled = !c.redo;
    if (h) h.textContent = `deshacer ${c.undo} / rehacer ${c.redo}`;
  }
  function openConfigWizard() {
    const dump = qolExportConfigForUi();
    const raw = prompt(
      'Asistente de configuracion.\n' +
      'Se muestra tu configuracion ACTUAL ya saneada (sin webhook, csrf, plantillas aprendidas ni hallazgos).\n' +
      'Copiala para hacer copia de seguridad, o pega otra y acepta para validarla antes de aplicar.',
      JSON.stringify(dump, null, 2));
    if (raw == null) return;
    const prep = qolPrepareConfigImport(raw);
    if (!prep.ok) {
      alert('No se aplica nada.\n\n' + (prep.errors.length ? prep.errors.join('\n') : 'ninguna seccion valida') +
        (prep.ignored.length ? '\n\nIgnoradas: ' + prep.ignored.join(', ') : ''));
      return;
    }
    const changed = prep.sections.filter(x => x.changed);
    const summary =
      `Secciones validas: ${prep.sections.length}\n` +
      `Cambian: ${changed.length ? changed.map(x => x.key).join(', ') : 'ninguna'}\n` +
      (prep.ignored.length ? `Ignoradas (no reconocidas): ${prep.ignored.join(', ')}\n` : '') +
      `\nAplicar? Se podra deshacer.`;
    if (!confirm(summary)) return;
    if (qolImportConfig(prep.candidate, { source: 'wizard' })) {
      flash(`configuracion importada (${changed.length} cambios)`);
      bindConfig(); renderCaveTowns(); updateStatus(); renderConfigHistoryButtons();
    } else flash('importacion fallida');
  }
  panel.querySelector('#gb-cfg-export')?.addEventListener('click', () => {
    const text = JSON.stringify(qolExportConfigForUi(), null, 2);
    navigator.clipboard.writeText(text).then(() => flash('configuracion copiada')).catch(() => flash('fallo al copiar'));
  });
  panel.querySelector('#gb-cfg-import')?.addEventListener('click', openConfigWizard);
  panel.querySelector('#gb-cfg-undo')?.addEventListener('click', () => {
    if (!qolHistoryUndo()) { flash('nada que deshacer'); return; }
    flash('cambio deshecho'); bindConfig(); renderCaveTowns(); updateStatus(); renderConfigHistoryButtons();
  });
  panel.querySelector('#gb-cfg-redo')?.addEventListener('click', () => {
    if (!qolHistoryRedo()) { flash('nada que rehacer'); return; }
    flash('cambio rehecho'); bindConfig(); renderCaveTowns(); updateStatus(); renderConfigHistoryButtons();
  });
  renderConfigHistoryButtons();
  // One capture-phase listener on the Config section: snapshot BEFORE the real
  // handler runs, compare after it returns. Scoped to [data-cfg] controls only,
  // so panel navigation, the Stats simulation, journal clears and scrape
  // buttons - which have non-config side effects - never checkpoint.
  {
    const cfgSec = panel.querySelector('section[data-tab=config]');
    if (cfgSec && !cfgSec.dataset.histBound) {
      cfgSec.dataset.histBound = '1';
      const checkpoint = e => {
        const t = e.target;
        if (!t || !t.closest || !t.closest('[data-cfg]')) return;
        const before = qolConfigSnapshot();
        // Deferred to a microtask so the element's own change handler has
        // already mutated state by the time we compare.
        gbTimeout(() => {
          try {
            if (qolHistoryPush(before, 'config')) renderConfigHistoryButtons();
          } catch (_) {}
        }, 0);
      };
      gbListen(cfgSec, 'change', checkpoint, true);
    }
  }

  panel.querySelector('#gb-note-save')?.addEventListener('click', () => {
    const p = panel.querySelector('#gb-note-player')?.value?.trim();
    const n = panel.querySelector('#gb-note-text')?.value?.trim();
    if (p) { intelSetNote(p, n); renderIntel(); flash('nota guardada'); }
  });
  panel.querySelector('#gb-anote-save')?.addEventListener('click', () => {
    const a = panel.querySelector('#gb-anote-ally')?.value?.trim();
    const n = panel.querySelector('#gb-anote-text')?.value?.trim();
    // Empty note deletes the entry, same contract as the player note.
    if (a && intelSetAllianceNote(a, n)) { renderIntel(); flash(n ? 'nota de alianza guardada' : 'nota de alianza borrada'); }
  });
  panel.querySelector('#gb-quest-scan')?.addEventListener('click', () => {
    questScanTick('manual');
    gbTimeout(renderQuests, 600);
  });
  panel.querySelector('footer button[data-act=panic]')?.addEventListener('click', () => {
    if (!gbPanicActivate()) { flash('panico ya activo'); return; }
    const dr = panel.querySelector('[data-cfg=dry-run]'); if (dr) dr.checked = true;
    flash('PANICO: automatizacion detenida');
    updateStatus();
  });
  panel.querySelector('footer button[data-act=panic-recover]')?.addEventListener('click', () => {
    const r = gbPanicRecover();
    if (!r.ok) { flash(r.why === 'grace' ? 'espera 30 s para reanudar' : 'panico no activo'); return; }
    flash(r.reason ? 'saltos limpiados, sigue en pausa: ' + r.reason : 'automatizacion reanudada');
    updateStatus();
  });
  panel.querySelector('footer button[data-act=refresh]').addEventListener('click', () => {
    fetchOwnedTowns();
    state.towns.forEach((t, i) => gbTimeout(() => fetchTownResources(t), i * 600));
  });
  // ===== Quick-action toolbar (v4 plan 6.5) ==================================
  // Every button delegates to the same function the Actions menu already calls,
  // so no new post route, no new lock and no new template - each target takes
  // its own lock internally.
  {
    // Icons are attached from the GB_ICONS table rather than written into the
    // panel template: the template is literal-only and one SVG per button
    // would triple its size for no readability gain.
    panel.querySelectorAll('.gb-qat button[data-ico]').forEach(b => {
      const ico = gbIcon(b.getAttribute('data-ico'), 12);
      if (ico) b.insertBefore(ico, b.firstChild);
    });
    const qat = (sel, fn) => panel.querySelector(`.gb-qat button[data-qat=${sel}]`)?.addEventListener('click', () => {
      try { fn(); } catch (e) { flash('fallo: ' + String(e).slice(0, 40)); }
    });
    qat('collect', () => { autoCollectResources(); flash('recogiendo'); });
    qat('farms', () => { state.nextFarmScrape = 0; save(STORE.NEXT_FARM, 0); autoClaimFarms('manual'); farmTick(); flash('cobrando aldeas'); });
    qat('dodge', () => { dodgeScan('manual'); flash('escaneando entrantes'); });
    qat('queue', () => { abEnsureTargets(); abScan('manual'); flash('cola de construccion'); });
    qat('hud-prod', () => { flash('HUD produccion ' + (hudToggle('production') ? 'ON' : 'OFF')); });
    qat('hud-eta', () => { flash('HUD ataques ' + (hudToggle('countdown') ? 'ON' : 'OFF')); });
    qat('panic', () => {
      if (!gbPanicActivate()) { flash('panico ya activo'); return; }
      const dr = panel.querySelector('[data-cfg=dry-run]'); if (dr) dr.checked = true;
      flash('PANICO: automatizacion detenida');
      updateStatus();
    });
  }
  // ===== City quick-switch (v4 plan 6.6) =====================================
  // The option VALUE is the raw town id, pinned explicitly: a Spanish label in
  // the value would ship a bad town_id to the server (CLAUDE.md UI-language
  // rule, the [data-atk=mission] precedent).
  function renderTownSwitch() {
    const sel = panel && panel.querySelector('[data-qs=town]');
    if (!sel) return;
    let ids = [];
    try { ids = Object.keys((gameUw().ITowns && gameUw().ITowns.towns) || {}); } catch (_) {}
    if (!ids.length) ids = (state.towns || []).map(t => String(t.id));
    let cur = '';
    try { cur = String((gameUw().Game && gameUw().Game.townId) || ''); } catch (_) {}
    const sig = ids.join(',') + '|' + cur;
    if (sel.dataset.sig === sig) return;
    sel.dataset.sig = sig;
    sel.replaceChildren();
    if (!ids.length) {
      const o = document.createElement('option');
      o.value = ''; o.textContent = 'sin ciudades';
      sel.appendChild(o);
      return;
    }
    for (const id of ids) {
      const o = document.createElement('option');
      o.value = String(id);
      o.textContent = `${townNameById(id)} (${id})`;
      sel.appendChild(o);
    }
    if (cur) sel.value = cur;
  }
  // THE TOWN-SWITCH CALL IS AN EXPLICIT UNKNOWN. No confirmed API for changing
  // the active town exists in this tree, so this probes a candidate list of
  // real functions and refuses when none is present. It never simulates a click
  // on a guessed selector and never writes Game.townId directly - that would
  // desynchronise the client from the server's idea of the open town.
  const TOWN_SWITCH_FNS = ['selectTown', 'setCurrentTown', 'switchTown', 'changeTown', 'jumpToTown'];
  function jumpToTown(id) {
    if (!id) return false;
    let uw = null;
    try { uw = gameUw(); } catch (_) { return false; }
    for (const host of [uw && uw.ITowns, uw && uw.Game, uw && uw.HelperTown]) {
      if (!host) continue;
      for (const fn of TOWN_SWITCH_FNS) {
        if (typeof host[fn] !== 'function') continue;
        try { host[fn](+id || id); gbLog(`town switch: ${fn}(${id})`); return true; } catch (_) {}
      }
    }
    gbLogT('town-switch-unknown', 600000,
      'town switch: no known API on this client - use the game\'s own selector (nothing was guessed)');
    flash('cambio de ciudad no soportado en este cliente');
    return false;
  }
  const INTEL_VIEWS = ['summary', 'heatmap', 'defense', 'pool', 'activity'];
  panel.querySelector('#gb-plan-import')?.addEventListener('click', () => {
    const raw = prompt('Pega aqui el plan compartido (JSON). Solo se importan objetivos: nada se envia y nada se arma automaticamente.');
    if (raw == null) return;
    const r = sharedPlanImport(raw);
    if (!r.ok) { alert('No se importa nada.\n\n' + (r.errors.join('\n') || 'sin objetivos validos') + (r.rejected.length ? '\n\nRechazados:\n' + r.rejected.join('\n') : '')); return; }
    const added = sharedPlanApplyToAttackPlan(r);
    flash(`${added} objetivo(s) importados${r.rejected.length ? `, ${r.rejected.length} rechazados` : ''}`);
    renderAttack();
  });
  panel.querySelector('#gb-plan-export')?.addEventListener('click', () => {
    const text = JSON.stringify(sharedPlanExport(), null, 2);
    navigator.clipboard.writeText(text).then(() => flash('plan copiado')).catch(() => flash('fallo al copiar'));
  });
  panel.querySelector('#gb-plan-clear')?.addEventListener('click', () => {
    if (!confirm('Vaciar los objetivos importados?')) return;
    sharedPlanClear(); renderAttack(); flash('objetivos vaciados');
  });
  panel.querySelector('[data-intel=view]')?.addEventListener('change', e => {
    intelView = INTEL_VIEWS.includes(e.target.value) ? e.target.value : 'summary';
    renderIntel();
  });
  panel.querySelector('[data-intel=ally-filter]')?.addEventListener('change', e => {
    state.intelAllianceFilter = String(e.target.value || '').trim().slice(0, 40);
    save(STORE.INTEL_ALLY_FILTER, state.intelAllianceFilter);
    renderIntel();
  });
  panel.querySelector('[data-intel=status]')?.addEventListener('change', e => {
    const v = e.target.value;
    e.target.value = '';
    if (!v) return;

    // Alliance-wide when the filter box names one, otherwise ask for the
    // player. Never inferred from whatever row happens to be on screen.
    const status = v === 'clear' ? null : v;
    const ally = state.intelAllianceFilter;
    if (ally) {
      if (!confirm(`Marcar la alianza "${ally}" como ${status || 'sin estado'}?`)) return;
      intelSetAllianceStatus(ally, status);
    } else {
      const who = prompt('Jugador a marcar (nombre exacto):');
      if (!who) return;
      intelSetPlayerStatus(who.trim(), status);
    }
    flash('estado diplomatico actualizado');
    renderIntel();
  });
  panel.querySelector('[data-qs=town]')?.addEventListener('change', e => {
    const id = e.target.value;
    if (!jumpToTown(id)) renderTownSwitch();
  });
  panel.querySelector('header button[data-act=queues]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openQueueCenter();
  });
  panel.querySelector('header button[data-act=toggle]').addEventListener('click', (e) => {
    e.stopPropagation();
    const collapsing = !panel.classList.contains('collapsed');
    if (collapsing) {

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
  panel.querySelector('#gb-ib-btn')?.addEventListener('click', () => {
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

    // One-shot manual fill must never persistently enable automation.
    abScan('manual');
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
          flash(ok ? 'copied' : 'copy failed');
        } catch (_) { flash('fallo al copiar'); }
      });
  });
  panel.querySelector('footer button[data-act=export]').addEventListener('click', () => {
    const dump = redactFindingsExport({ findings: state.findings, farms: state.farms });
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;
    a.download = `grepbot-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    gbTimeout(() => { try { URL.revokeObjectURL(objectUrl); } catch (_) {} }, 0);
  });
  panel.querySelector('footer button[data-act=clear]').addEventListener('click', () => {
    if (!confirm('Limpiar todos los hallazgos?')) return;
    state.findings = []; state.seen = {}; seenThisRun.clear();
    save(STORE.FINDINGS, state.findings); save(STORE.SEEN, state.seen);
    renderFindings();
  });
  panel.querySelectorAll('button[data-act=evidence]').forEach(btn => {
    btn.addEventListener('click', () => { evidenceCopy(); });
  });
  panel.querySelectorAll('button[data-act=bundle]').forEach(btn => {
    btn.addEventListener('click', () => { bundleCopy(); });
  });
  panel.querySelectorAll('button[data-act=bundle-file]').forEach(btn => {
    btn.addEventListener('click', () => { bundleDownload(); });
  });
  panel.querySelector('footer button[data-act=diag]').addEventListener('click', () => {
    diagRun();
  });
  panel.querySelector('footer button[data-act=diag-farms]')?.addEventListener('click', () => {
    showTab('log');
    farmClaimDiag(12);
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

    // Manual sweep overrides both the Config toggle and the dead-endpoint
    // breaker - it is how the user re-probes after teaching the action.
    scrapeAllFarms(true);
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
  function syncFarmTimingCfg(sec) {
    if (!sec) return;
    const lc = sec.querySelector('[data-cfg=farm-long-claims]'); if (lc) lc.checked = !!state.farmLongClaims;
    const fsc = sec.querySelector('[data-cfg=farm-scrape]'); if (fsc) fsc.checked = !!state.farmScrape;
    const lt = sec.querySelector('[data-cfg=farm-loyalty-tech]'); if (lt) lt.value = state.farmLoyaltyTech || '';
    const sd = sec.querySelector('[data-cfg=farm-sleep-dur]'); if (sd) sd.value = String(state.farmSleepDur || 'auto');
    const sa = sec.querySelector('[data-cfg=farm-sleep-auto]'); if (sa) sa.checked = !!state.farmSleepAuto;
    const sf = sec.querySelector('[data-cfg=farm-sleep-fill]'); if (sf) sf.value = state.farmSleepFillPct;
    const um = sec.querySelector('[data-cfg=farm-units-mode]'); if (um) um.value = String(state.farmUnitsMode || 'off');
    const up = sec.querySelector('[data-cfg=farm-units-pref]'); if (up) up.value = String(state.farmUnitsPref || 'auto');
    const om = sec.querySelector('#gb-farm-optmap');
    if (om) {
      const sample = (farmsFromGame() || [])[0] || null;
      const uOpt = farmUnitOption(sample);
      const dup = farmOptionMapConflicts();
      om.textContent = 'learned claim options: ' + farmOptionMapText() +
        (dup ? ' | CONFLICTO: ' + dup + ' comparten opcion - pulsa Olvidar y reaprende' : '') +
        ' (claim a timer by hand in game to teach the rest)' +
        ' | units: ' + (uOpt == null ? 'not learned' : uOpt + ' (' + (farmUnitIdFor(uOpt) || '?') + ')');
    }
  }
  function bindConfig() {
    const sec = panel.querySelector('section[data-tab=config]');
    if (!sec) return;
    const setNum = (sel, val) => { const el = sec.querySelector(sel); if (el) el.value = val; };

    // Split (audit 2026-08-13, plan Tier 1 item 1). This function used to have
    // two modes: a full bind path, and a short "already bound" repaint branch
    // that returned early. The repaint branch synced 30 of the 142 controls the
    // bind path knows about, so every caller that is not first boot - tab switch,
    // preset apply, undo/redo, config import, snapshot restore, profile apply -
    // repainted stale values, and the next click wrote the stale value back.
    // (The bind path had the mirror-image hole: 11 controls, theme and the
    // diagnostics toggles among them, were only ever synced by the repaint
    // branch, so they showed their HTML default on first render.)
    //
    // Now the whole body runs on every call and only the LISTENER INSTALLS are
    // gated on bindNow, through onCfg/saveNum/bindToggle. Adding a control means
    // writing its value-set once; it is live in both modes by construction.
    // Nothing in this body may build DOM or have a side effect other than
    // writing a control value - it runs on every repaint.
    const bindNow = !configBound;
    configBound = true;
    const onCfg = (sel, type, fn) => { if (bindNow) sec.querySelector(sel)?.addEventListener(type, fn); };
    const hostEl = sec.querySelector('.cfg-host');
    if (hostEl) hostEl.textContent = location.host;

    // Group filter (bindNow only - it installs listeners and stamps the
    // remembered open state, it never writes a control value). The filter hides
    // rows and whole groups; it must NEVER remove or move a control, because
    // every setChk/onCfg below resolves by `[data-cfg=...]` on a hidden node
    // just as well as on a visible one.
    if (bindNow) {
      const filt = sec.querySelector('.gb-cfg-filter');
      const empty = sec.querySelector('.gb-cfg-empty');
      const rail = sec.querySelector('.gb-cfg-rail');
      const groups = Array.from(sec.querySelectorAll('.gb-cfg-group'));
      const rowsOf = g => Array.from(g.querySelectorAll(':scope > .gb-section-body > *'));
      // Accent folding both ways: the group titles and many labels carry
      // Spanish accents, and nobody types "recolección" into a filter box.
      const fold = v => String(v == null ? '' : v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const q = () => fold((filt ? filt.value : '').trim());

      // v5.9.0: the eleven groups are a left rail instead of eleven stacked
      // <details>. Scrolling past ten collapsed headers to reach the eleventh
      // was the whole problem; one click now swaps the pane. The groups
      // themselves are untouched DOM, so the filter below and every
      // `[data-cfg=...]` lookup keep working on a hidden pane exactly as before.
      let railSel = 0;
      const savedSel = tabFilterGet('cfg:group');
      if (savedSel != null && +savedSel >= 0 && +savedSel < groups.length) railSel = +savedSel;
      const applyRail = () => {
        groups.forEach((g, idx) => {
          const on = idx === railSel;
          g.hidden = !on;
          if (on) g.open = true;
        });
        if (rail) Array.from(rail.children).forEach((b, idx) => b.classList.toggle('on', idx === railSel));
      };
      if (rail) {
        rail.replaceChildren();
        groups.forEach((g, idx) => {
          const b = document.createElement('button');
          b.type = 'button';
          const risk = g.classList.contains('risk');
          if (risk) {
            b.classList.add('risk');
            const dot = document.createElement('span');
            dot.className = 'dot';
            b.appendChild(dot);
          }
          const sum = g.querySelector(':scope > summary');
          const label = ((sum && sum.textContent) || '').replace(/\s*\(ALTO RIESGO\)\s*/i, '').trim();
          b.appendChild(document.createTextNode(label));
          const n = document.createElement('span');
          n.className = 'n';
          n.textContent = String(g.querySelectorAll('[data-cfg]').length);
          b.appendChild(n);
          gbTip(b, risk ? 'Puede gastar oro o mover tropas' : 'Controles de este grupo');
          b.addEventListener('click', () => {
            railSel = idx;
            tabFilterSet('cfg:group', idx);
            if (filt && filt.value) { filt.value = ''; }
            applyFilter();
          });
          rail.appendChild(b);
        });
        const note = document.createElement('div');
        note.className = 'gb-cfg-rail-note';
        note.textContent = 'El punto rojo marca los grupos que pueden gastar oro o mover tropas.';
        rail.appendChild(note);
      }

      // v5.9.0: the one-line explanation each control already carries as a
      // tooltip is rendered UNDER the control as well. The text is not new and
      // not duplicated per row in the template - it is lifted from the title /
      // data-gb-tip the row already has, so there is one source for it. The
      // node goes INSIDE the row's own <label>, never beside it: the filter
      // treats every child of .gb-section-body as a row, and a sibling would
      // be shown and hidden on its own.
      sec.querySelectorAll('.gb-cfg-panes .gb-cfg-row, .gb-cfg-panes .gb-cfg-num').forEach(row => {
        if (row.dataset.gbHelp) return;
        row.dataset.gbHelp = '1';
        const txt = (row.getAttribute('title') || row.getAttribute('data-gb-tip') || '').trim();
        if (!txt) return;
        const help = document.createElement('span');
        help.className = 'gb-cfg-help';
        help.textContent = txt;

        // A checkbox row is [control][label text]; both are flex items, so a
        // help line added as a third item pushes the label onto its own row.
        // Wrap the label side in a column instead, leaving the row two items.
        const lead = row.firstElementChild;
        const leadIsBox = row.classList.contains('gb-cfg-row') && lead && lead.tagName === 'INPUT' && lead.type === 'checkbox';
        if (leadIsBox) {
          const body = document.createElement('span');
          body.className = 'gb-cfg-body';
          Array.from(row.childNodes).forEach(n => { if (n !== lead) body.appendChild(n); });
          body.appendChild(help);
          row.appendChild(body);
          return;
        }
        row.appendChild(help);
      });

      groups.forEach(g => {
        g.dataset.open = g.open ? '1' : '0';

        // Remember the user's own expand state only while no filter is active;
        // the toggles the filter itself performs must not overwrite it.
        g.addEventListener('toggle', () => { if (!q()) g.dataset.open = g.open ? '1' : '0'; });
      });

      // While the filter box has text every group is searched at once and the
      // rail stands down - a hit in a group the user is not looking at is
      // exactly what searching is for.
      const applyFilter = () => {
        const needle = q();
        if (rail) rail.hidden = !!needle;
        let shown = 0;
        if (!needle) {
          groups.forEach(g => { rowsOf(g).forEach(r => { r.hidden = false; }); });
          applyRail();
          if (empty) empty.hidden = true;
          return;
        }
        groups.forEach(g => {
          let hits = 0;
          const rows = rowsOf(g);
          const match = rows.map(r => fold(r.textContent).includes(needle)
            || Array.from(r.querySelectorAll('[data-cfg]')).some(c => fold(c.getAttribute('data-cfg') || '').includes(needle)));

          // A toggle and the settings it governs are one unit: a matched parent
          // row drags its indented followers along, or the filter would show a
          // checkbox with its own thresholds cut off.
          const isChild = r => r.classList.contains('gb-cfg-sub') || r.classList.contains('gb-cfg-note') || r.classList.contains('cave-towns');
          rows.forEach((r, i) => {
            if (!match[i] || isChild(r)) return;
            for (let j = i + 1; j < rows.length && isChild(rows[j]); j++) match[j] = true;
          });
          rows.forEach((r, i) => { r.hidden = !match[i]; if (match[i]) hits++; });
          g.hidden = !hits;
          g.open = hits > 0;
          shown += hits;
        });
        if (empty) empty.hidden = shown > 0;
      };
      if (filt) filt.addEventListener('input', applyFilter);
      applyFilter();
    }
    const setChk = (sel, val) => { const el = sec.querySelector(sel); if (el) el.checked = !!val; };

    // saveNum is hoisted above its callsites further down for the same reason
    // setNum is hoisted to the top of bindConfig.
    const saveNum = (sel, fn) => onCfg(sel, 'change', e => { fn(+e.target.value); });
    setChk('[data-cfg=enabled-host]', state.enabledHosts[location.host] === true);
    setChk('[data-cfg=auto-collect]', state.autoCollect);
    setChk('[data-cfg=collect-all]', state.collectAll);
    setChk('[data-cfg=auto-bandit]', state.autoBandit);
    setChk('[data-cfg=auto-farm]', state.autoFarm);
    setChk('[data-cfg=farm-skip-full]', state.farmSkipFull);
    setChk('[data-cfg=farm-scrape]', state.farmScrape);
    const fm0 = sec.querySelector('[data-cfg=farm-full-mode]'); if (fm0) fm0.value = state.farmFullMode || 'any';
    syncFarmTimingCfg(sec);
    setChk('[data-cfg=auto-build]', state.ibAuto);
    setChk('[data-cfg=instant-research]', state.ibResearch);
    setChk('[data-cfg=auto-queue]', state.abAuto);
    setChk('[data-cfg=ab-random-fallback]', state.abRandomFallback !== false);
    setChk('[data-cfg=auto-wall-repair]', !!state.autoWallRepair);
    setChk('[data-cfg=pop-rescue-farm]', !!state.popRescueFarm);
    setNum('[data-cfg=build-swap-min]', gbCfgNum(state.buildSwapThresholdMin, 5));
    setChk('[data-cfg=auto-quest-build]', state.questAutoBuild);
    setChk('[data-cfg=auto-quest-res]', state.questAutoRes);
    setChk('[data-cfg=auto-cave]', state.autoCave);
    setNum('[data-cfg=cave-thresh]', state.caveThreshPct);
    setNum('[data-cfg=ib-free-thresh]', state.ibFreeThresh);
    setNum('[data-cfg=collect-max-min]', state.collectMaxMin);
    setNum('[data-cfg=farm-travel]', state.farmTravelSecPerUnit || 0);
    setNum('[data-cfg=farm-min]', Math.round(state.farmMinMs / 60000));
    setNum('[data-cfg=farm-max]', Math.round(state.farmMaxMs / 60000));
    setNum('[data-cfg=town-min]', Math.round(state.townMinMs / 60000));
    setNum('[data-cfg=town-max]', Math.round(state.townMaxMs / 60000));
    setNum('[data-cfg=posts-soft-pct]', state.postsPerMinSoftPct != null ? state.postsPerMinSoftPct : 60);
    const cl = sec.querySelector('[data-cfg=captcha-ladder]');
    if (cl) cl.value = (Array.isArray(state.captchaLadder) && state.captchaLadder.length ? state.captchaLadder : [5, 15, 60]).join(',');
    onCfg('[data-cfg=never-stop]', 'change',e=>{state.neverStop=!!e.target.checked;save(STORE.NEVER_STOP,state.neverStop);gbLog('neverStop',state.neverStop);updateStatus();});
    onCfg('[data-cfg=safe-mode]', 'change',e=>{state.safeMode=!!e.target.checked;save(STORE.SAFE_MODE,state.safeMode);gbLog('safeMode',state.safeMode);updateStatus();});
    onCfg('[data-cfg=enabled-host]', 'change', e => {
      state.enabledHosts[location.host] = e.target.checked;
      save(STORE.ENABLED_HOSTS, state.enabledHosts);
      flash(e.target.checked ? 'enabled on ' + location.host : 'disabled on ' + location.host);
    });
    onCfg('[data-cfg=auto-collect]', 'change', e => {
      state.autoCollect = e.target.checked; save(STORE.AUTO_COLLECT, state.autoCollect);
      gbLog('auto-collect', state.autoCollect ? 'ON' : 'OFF');
      if (state.autoCollect) autoCollectResources();
    });
    onCfg('[data-cfg=collect-all]', 'change', e => {
      state.collectAll = e.target.checked; save(STORE.COLLECT_ALL, state.collectAll);
      flash(state.collectAll ? 'collect-all ON' : 'collect-all OFF');
      if (state.collectAll) collectAllBackground();
    });
    onCfg('[data-cfg=auto-bandit]', 'change', e => {
      state.autoBandit = e.target.checked; save(STORE.AUTO_BANDIT, state.autoBandit);
      gbLog('auto-bandit', state.autoBandit ? 'ON' : 'OFF');
      if (state.autoBandit) {
        try { banditClearLoop(); } catch (_) {}
        banditIdleUntil = 0;
        banditScan();
      }
    });
    onCfg('[data-cfg=auto-farm]', 'change', e => {
      state.autoFarm = e.target.checked; save(STORE.AUTO_FARM, state.autoFarm);
      gbLog('auto-farm', state.autoFarm ? 'ON' : 'OFF');
      if (state.autoFarm) { autoClaimFarms('toggle'); farmScheduleClaimWake(null, 'toggle', true); }
      else farmCancelClaimWake();
    });
    onCfg('[data-cfg=farm-skip-full]', 'change', e => {
      state.farmSkipFull = e.target.checked; save(STORE.FARM_SKIP_FULL, state.farmSkipFull);
      gbLog('farm-skip-full', state.farmSkipFull ? 'ON' : 'OFF');
    });
    onCfg('[data-cfg=farm-full-mode]', 'change', e => {
      state.farmFullMode = e.target.value === 'all' ? 'all' : 'any';
      save(STORE.FARM_FULL_MODE, state.farmFullMode);
      gbLog('farm-full-mode', state.farmFullMode);
    });
    onCfg('[data-cfg=auto-build]', 'change', e => {
      state.ibAuto = e.target.checked; save(STORE.IB_AUTO, state.ibAuto);
      gbLog('instant-build', state.ibAuto ? 'ON' : 'OFF');
      if (state.ibAuto) ibScan();
    });
    onCfg('[data-cfg=farm-long-claims]', 'change', e => {
      state.farmLongClaims = e.target.checked; save(STORE.FARM_LONG_CLAIMS, state.farmLongClaims);
      gbLog('farm 10min claims', state.farmLongClaims ? 'ON' : 'OFF');
    });
    onCfg('[data-cfg=farm-units-mode]', 'change', e => {
      const v = String(e.target.value || 'off');
      state.farmUnitsMode = /^(off|fallback|always)$/.test(v) ? v : 'off';
      save(STORE.FARM_UNITS_MODE, state.farmUnitsMode);
      gbLog('farm unit claims:', state.farmUnitsMode);
      syncFarmTimingCfg(sec);
    });
    onCfg('[data-cfg=farm-units-pref]', 'change', e => {
      state.farmUnitsPref = String(e.target.value || 'auto');
      save(STORE.FARM_UNITS_PREF, state.farmUnitsPref);
      gbLog('farm unit claim card:', state.farmUnitsPref);
      syncFarmTimingCfg(sec);
    });
    onCfg('[data-cfg=farm-scrape]', 'change', e => {
      state.farmScrape = e.target.checked; save(STORE.FARM_SCRAPE, state.farmScrape);
      if (state.farmScrape) farmScrapeRevive('config ON');
      else farmScrapeClearErrors();
      gbLog('farm resource scrape', state.farmScrape ? 'ON' : 'OFF');
      updateStatus();
    });
    onCfg('[data-cfg=farm-loyalty-tech]', 'change', e => {
      state.farmLoyaltyTech = String(e.target.value || '').trim();
      save(wkey(STORE.FARM_LOYALTY_TECH), state.farmLoyaltyTech);
      farmLoyaltyReset();
      gbLog('farm loyalty tech: ' + (state.farmLoyaltyTech || 'auto-detect'));
    });
    onCfg('[data-cfg=farm-sleep-dur]', 'change', e => {
      state.farmSleepDur = e.target.value; save(STORE.FARM_SLEEP_DUR, state.farmSleepDur);
      syncFarmTimingCfg(sec);
    });
    onCfg('[data-cfg=farm-sleep-auto]', 'change', e => {
      state.farmSleepAuto = e.target.checked; save(STORE.FARM_SLEEP_AUTO, state.farmSleepAuto);
      gbLog('auto sleep claim', state.farmSleepAuto ? 'ON' : 'OFF');
    });
    onCfg('[data-cfg=instant-research]', 'change', e => {
      state.ibResearch = e.target.checked; save(STORE.IB_RESEARCH, state.ibResearch);
      gbLog('instant-research', state.ibResearch ? 'ON' : 'OFF');
      if (state.ibResearch && state.ibAuto) ibScan();
      else renderBuild();
    });
    saveNum('[data-cfg=build-swap-min]', v => {
      state.buildSwapThresholdMin = Math.max(0, Math.min(120, Number.isFinite(+v) ? +v : 5));
      save(STORE.BUILD_SWAP_MIN, state.buildSwapThresholdMin);
    });
    onCfg('[data-cfg=pop-rescue-farm]', 'change', e => {
      state.popRescueFarm = !!e.target.checked;
      save(STORE.POP_RESCUE_FARM, state.popRescueFarm);
      gbLog('pop rescue ' + (state.popRescueFarm ? 'ON - farm goes to the head of the queue when population blocks a build' : 'OFF'));
      try { abScan('toggle'); } catch (_) {}
    });
    onCfg('[data-cfg=auto-wall-repair]', 'change', e => {
      state.autoWallRepair = !!e.target.checked;
      save(STORE.AUTO_WALL_REPAIR, state.autoWallRepair);
      gbLog('wall repair ' + (state.autoWallRepair ? 'ON - damaged walls count as below target' : 'OFF'));
      try { abScan('toggle'); } catch (_) {}
    });
    onCfg('[data-cfg=auto-queue]', 'change', e => {
      state.abAuto = e.target.checked; save(STORE.AB_AUTO, state.abAuto);
      gbLog('auto-queue', state.abAuto ? 'ON' : 'OFF');
      const el = panel.querySelector('#gb-ab-auto'); if (el) el.checked = state.abAuto;
      if (state.abAuto) abScan('toggle');
      renderAbQueue();
    });
    onCfg('[data-cfg=ab-random-fallback]', 'change', e => {
      state.abRandomFallback = e.target.checked; save(STORE.AB_RANDOM_FALLBACK, state.abRandomFallback);
      gbLog('ab-random-fallback', state.abRandomFallback ? 'ON' : 'OFF');
      if (state.abRandomFallback) abScan('toggle');
      renderAbQueue();
    });
    onCfg('[data-cfg=auto-quest-build]', 'change', e => {
      state.questAutoBuild = e.target.checked; save(STORE.QUEST_AUTO_BUILD, state.questAutoBuild);
      gbLog('auto-quest-build', state.questAutoBuild ? 'ON' : 'OFF');
      if (state.questAutoBuild) questScanTick('toggle');
    });
    onCfg('[data-cfg=auto-quest-res]', 'change', e => {
      state.questAutoRes = e.target.checked; save(STORE.QUEST_AUTO_RES, state.questAutoRes);
      gbLog('auto-quest-res', state.questAutoRes ? 'ON' : 'OFF');
      if (state.questAutoRes) questScanTick('toggle');
    });
    onCfg('[data-cfg=auto-cave]', 'change', e => {
      state.autoCave = e.target.checked; save(STORE.AUTO_CAVE, state.autoCave);
      gbLog('auto-cave', state.autoCave ? 'ON' : 'OFF');
      if (state.autoCave) caveScan('toggle');
      renderCaveTowns();
    });

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
    setChk('[data-cfg=auto-trade-routes]', state.autoTradeRoutes);
    setChk('[data-cfg=auto-transport]', state.autoTransport);
    setChk('[data-cfg=auto-dump]', state.autoDump);
    for (const r of ['wood', 'stone', 'iron']) {
      setNum('[data-cfg=dump-th-' + r + ']', dumpThresholdFor(r));
      setNum('[data-cfg=dump-keep-' + r + ']', dumpKeepPctFor(r));
    }
    { const ds = sec.querySelector('[data-cfg=dump-sinks]'); if (ds) ds.value = dumpSinkList().join(','); }
    setChk('[data-cfg=intel-battle-stats]', state.intelBattleStats !== false);
    setChk('[data-cfg=ab-optimal-order]', state.abOptimalOrderOn !== false);
    setChk('[data-cfg=auto-rural-trade]', state.autoRuralTrade);
    setChk('[data-cfg=auto-rural-level]', state.autoRuralLevel);
    setChk('[data-cfg=auto-research]', state.autoResearch);
    setChk('[data-cfg=pause-activity]', state.pauseOnActivity);
    setChk('[data-cfg=night-pause]', state.nightPause);
    setChk('[data-cfg=captcha-global]', state.captchaGlobalKill !== false);
    setChk('[data-cfg=decision-memory]', state.decisionMemory !== false);
    setChk('[data-cfg=dry-run]', !!state.dryRun);

    // safe-mode had a change listener but no value-set, so the box always
    // rendered UNCHECKED while state.safeMode was true - the panel and
    // safeModeBlock() disagreed, and unticking an already-unticked box fired
    // no change event, so the gate could not be cleared from the UI at all.
    setChk('[data-cfg=safe-mode]', !!state.safeMode);
    setChk('[data-cfg=never-stop]', state.neverStop !== false);
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
      setNum('[data-cfg=pt-reserve]', c.reservePct != null ? c.reservePct : 10);
      setChk('[data-cfg=pt-want-wood]', want.wood !== false);
      setChk('[data-cfg=pt-want-stone]', want.stone !== false);
      setChk('[data-cfg=pt-want-iron]', !!want.iron);
      const st = sec.querySelector('#gb-pt-status');
      if (st) st.textContent = typeof ptStatusText === 'function' ? ptStatusText() : '';
    }
    setChk('[data-cfg=auto-wonder-favor]', !!state.autoWonderFavor);
    { const fc = state.favorCfg || {};
      const gp = sec.querySelector('[data-cfg=godspell-power]'); if (gp) gp.value = fc.spellPower || '';
      setNum('[data-cfg=godspell-cost]', Number.isFinite(+fc.spellCost) ? +fc.spellCost : 0);
      setNum('[data-cfg=godspell-reserve]', godSpellReservePct()); }
    setChk('[data-cfg=auto-favor]', state.autoFavor);
    setChk('[data-cfg=auto-wonder]', state.autoWonder);
    setChk('[data-cfg=cs-alert]', state.csAlert !== false);
    { const dc = state.defenseCfg || {}, ar = dc.attackRisk || {};
      const dt = sec.querySelector('[data-cfg=defense-risk-threshold]');
      if (dt) dt.value = Number.isFinite(+dc.riskThresholdDodge) ? +dc.riskThresholdDodge : '';
      setNum('[data-cfg=defense-risk-cs]', Number.isFinite(+ar.csBonus) ? +ar.csBonus : defenseThreatWeights().cs);
      setNum('[data-cfg=defense-risk-raid]', riskForAttackType('raid'));
      setNum('[data-cfg=defense-risk-siege]', riskForAttackType('siege')); }
    { const cs = csCfg();
      setChk('[data-cfg=cs-snipe]', cs.on);
      setNum('[data-cfg=cs-cluster-gap]', cs.clusterGapSec);
      setNum('[data-cfg=cs-cover]', cs.coverSec);
      setNum('[data-cfg=cs-tight]', cs.tightSec); }

    // militia smart gate removed (AI); militia raises unconditionally within window
    { const sc = spyCfg();
      setChk('[data-cfg=auto-spy]', !!state.spyEnabled);
      setChk('[data-cfg=spy-dry]', sc.dryRun);
      setNum('[data-cfg=spy-per-cycle]', sc.perCycle);
      setNum('[data-cfg=spy-min-gap]', Math.round(sc.minGapMs / 60000));
      setNum('[data-cfg=spy-top]', sc.autoTopReported); }
    setChk('[data-cfg=auto-militia]', state.autoMilitia);
    setChk('[data-cfg=auto-dodge]', state.autoDodge);
    setChk('[data-cfg=auto-recruit]', state.autoRecruit);
    setChk('[data-cfg=recruit-spells]', state.recruitSpells);
    setChk('[data-cfg=village-recruit]', state.autoVillageRecruit);
    setNum('[data-cfg=village-recruit-fill]', state.villageRecruitFillPct);
    setNum('[data-cfg=village-recruit-amount]', state.villageRecruitAmount);
    setChk('[data-cfg=grepodata]', state.grepodataIndex);
    setNum('[data-cfg=rural-ratio]', state.ruralTradeRatio);
    setNum('[data-cfg=rural-level-max]', state.ruralLevelMax);
    setNum('[data-cfg=pause-ms]', Math.round((state.pauseActivityMs || 180000) / 60000));
    setNum('[data-cfg=night-start]', state.nightStart);
    setNum('[data-cfg=night-end]', state.nightEnd);
    setNum('[data-cfg=req-budget]', state.reqBudgetPerMin);
    setNum('[data-cfg=dodge-floor]', state.dodgeFloor);
    const rr = sec.querySelector('[data-cfg=rural-res]'); if (rr) rr.value = state.ruralTradeRes || 'iron';
    const defense=state.defenseCfg||{mode:'notify',returnMarginSec:120};
    const dm=sec.querySelector('[data-cfg=defense-mode]');if(dm)dm.value=defenseMode();
    { const sc = supportCfg();
      setChk('[data-cfg=support-auto]', sc.auto);
      setNum('[data-cfg=support-confirm]', sc.confirmThreshold);
      setNum('[data-cfg=support-home-floor]', sc.homeFloor);
      setNum('[data-cfg=support-min-eta]', sc.minEtaSec);
      setNum('[data-cfg=support-no-arm]', sc.noArmSec); }
    { const tw = defenseThreatWeights();
      setNum('[data-cfg=threat-cs]', tw.cs); setNum('[data-cfg=threat-eta15]', tw.eta15);
      setNum('[data-cfg=threat-sim]', tw.simPer); setNum('[data-cfg=threat-support]', tw.supportPer); }
    setNum('[data-cfg=defense-return-margin]',Math.max(0,+defense.returnMarginSec||120));
    const wh = sec.querySelector('[data-cfg=webhook-url]'); if (wh) wh.value = state.webhookUrl || '';
    const we = state.webhookEvents || {};
    setChk('[data-cfg=wh-captcha]', we.captcha !== false);
    setChk('[data-cfg=wh-attack]', we.attack !== false);
    setChk('[data-cfg=wh-warehouse]', !!we.warehouse);
    setChk('[data-cfg=wh-culture]', !!we.culture);
    setChk('[data-cfg=wh-capping]', !!we.cappingPreWarn);
    setChk('[data-cfg=wh-counter-intel]', we['counter-intel'] !== false);
    setChk('[data-cfg=intel-digest]', !!state.intelDigest);
    setChk('[data-cfg=notify-enabled]', !!state.notifyEnabled);
    setChk('[data-cfg=notify-muted]', !!state.notifyMuted);
    setNum('[data-cfg=notify-volume]', Math.round((Number.isFinite(+state.notifyVolume) ? +state.notifyVolume : 0.4) * 100));
    { const pb = sec.querySelector('[data-cfg=notify-permission]');
      if (pb) {
        let perm = 'unsupported';
        try { perm = (typeof Notification !== 'undefined') ? Notification.permission : 'unsupported'; } catch (_) {}
        const ES = { granted: 'concedido', denied: 'denegado', default: 'sin pedir', unsupported: 'no soportado' };
        pb.textContent = 'Permiso: ' + (ES[perm] || perm);

        // Only 'default' can be acted on: the API ignores requestPermission
        // once the user has decided either way, so an enabled button would lie.
        pb.disabled = perm !== 'default';
      } }
    const tg = sec.querySelector('[data-cfg=wh-tg-chat]'); if (tg) tg.value = we.telegramChatId || '';
    const tp = sec.querySelector('[data-cfg=trade-preset]'); if (tp) tp.value = state.tradePreset || 'storage';
    setNum('[data-cfg=trade-reserve]', state.tradeReservePct);
    setNum('[data-cfg=trade-min]', state.tradeMinBatch);
    setNum('[data-cfg=transport-reserve]', state.transportReserve);
    setNum('[data-cfg=transport-min]', state.transportMin);
    const bindToggle = (sel, key, store, onOn) => {
      onCfg(sel, 'change', e => {
        state[key] = e.target.checked; save(store, state[key]);
        gbLog(key, state[key] ? 'ON' : 'OFF');
        if (state[key] && onOn) onOn();
      });
    };
    bindToggle('[data-cfg=auto-culture]', 'autoCulture', STORE.AUTO_CULTURE, () => cultureScan('toggle'));
    bindToggle('[data-cfg=auto-trade]', 'autoTrade', STORE.AUTO_TRADE, () => tradeScan('toggle'));
    bindToggle('[data-cfg=island-ship]', 'islandShip', STORE.ISLAND_SHIP, () => tradeScan('toggle'));
    bindToggle('[data-cfg=auto-trade-routes]', 'autoTradeRoutes', STORE.AUTO_TRADE_ROUTES, () => tradeScan('toggle'));
    onCfg('[data-cfg=trade-routes-edit]', 'click', () => {
      const cur = Object.values(state.tradeRoutes || {});
      const raw = prompt(
        'Rutas de comercio (JSON, lista).\nClaves: from, to, wood, stone, iron, minBatch, maxPerCycle, enabled,\ntrigger:{mode:"always"|"belowPct"|"abovePct", resource:"wood"|"stone"|"iron", value:0-100}.\nUna ruta con from===to o sin cantidades se descarta.',
        JSON.stringify(cur.length ? cur : [{ from: '', to: '', wood: 500, stone: 0, iron: 0, minBatch: 100, maxPerCycle: 0, enabled: true, trigger: { mode: 'always', resource: 'wood', value: 0 } }], null, 2));
      if (raw == null) return;
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error('not a list');
        const before = parsed.length;
        const saved = tradeRoutesSave(parsed);
        const kept = Object.keys(saved).length;
        flash(kept === before ? `${kept} rutas guardadas` : `${kept}/${before} rutas guardadas (el resto invalidas)`);
        gbLog(`trade routes: ${kept}/${before} saved`);
      } catch (e) { flash('JSON de rutas invalido'); }
    });
    bindToggle('[data-cfg=auto-transport]', 'autoTransport', STORE.AUTO_TRANSPORT, () => tradeScan('toggle'));
    bindToggle('[data-cfg=auto-dump]', 'autoDump', STORE.AUTO_DUMP, () => tradeScan('toggle'));
    const saveDumpMap = (field, store, res, v, lo, hi) => {
      if (!state[field] || typeof state[field] !== 'object') state[field] = {};
      state[field][res] = Math.max(lo, Math.min(hi, Number.isFinite(+v) ? +v : state[field][res]));
      save(store, state[field]);
    };
    for (const r of ['wood', 'stone', 'iron']) {
      saveNum('[data-cfg=dump-th-' + r + ']', v => saveDumpMap('dumpThreshold', STORE.DUMP_THRESHOLD, r, v, 50, 100));
      saveNum('[data-cfg=dump-keep-' + r + ']', v => saveDumpMap('dumpKeep', STORE.DUMP_KEEP, r, v, 0, 95));
    }
    onCfg('[data-cfg=dump-sinks]', 'change', e => {

      // Only own-town ids survive: a typo must not become a destination.
      const own = new Set((townsFromGame() || []).map(t => String(t.id)));
      const raw = String(e.target.value || '').split(/[,\s]+/).map(x => x.trim()).filter(Boolean);
      const kept = raw.filter(x => own.has(x));
      state.dumpSinks = kept;
      save(STORE.DUMP_SINKS, kept);
      e.target.value = kept.join(',');
      if (kept.length !== raw.length) flash(`${kept.length}/${raw.length} destinos validos`);
    });
    bindToggle('[data-cfg=intel-battle-stats]', 'intelBattleStats', STORE.INTEL_BATTLE_STATS, () => { try { renderIntel(); } catch (_) {} });
    bindToggle('[data-cfg=ab-optimal-order]', 'abOptimalOrderOn', STORE.AB_OPTIMAL_ORDER_ON, () => { if (state.abOptimalOrderOn === false) abOptimalOrderClear(); });
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
    onCfg('[data-cfg=dry-run]', 'change', e => {
      state.dryRun = e.target.checked; save(STORE.DRY_RUN, state.dryRun);
      gbLog('DRY RUN ' + (state.dryRun ? 'ON - payloads logged, nothing sent' : 'OFF - posts go to the server'));
      flash(state.dryRun ? 'dry run ON' : 'dry run OFF');
      updateStatus();

      // A dryrun entry that was logged earlier still occupies its txState slot
      // for TX_TERMINAL_TTL (30 min) — so the first real post after toggle-off
      // gets blocked as `duplicate blocked ... state=dryrun`. Sweep on transition.
      if (!state.dryRun && state.txState && typeof state.txState === 'object') {
        let swept = 0;
        for (const k of Object.keys(state.txState)) {
          if (state.txState[k] && state.txState[k].state === 'dryrun') {
            delete state.txState[k]; swept++;
          }
        }
        if (swept) { txSave(); gbLog(`dry-run OFF: swept ${swept} stale txState entries`); }
      }
    });
    bindToggle('[data-cfg=auto-merchant]', 'autoMerchant', STORE.AUTO_MERCHANT, () => merchantScan('toggle'));
    bindToggle('[data-cfg=auto-pt-trade]', 'autoPtTrade', STORE.AUTO_PT_TRADE, () => ptTradeScan('toggle'));
    bindToggle('[data-cfg=auto-wonder-favor]', 'autoWonderFavor', STORE.AUTO_WONDER_FAVOR);
    const savePt = (key, val) => {
      if (!state.ptCfg || typeof state.ptCfg !== 'object') state.ptCfg = {};
      state.ptCfg[key] = val;
      save(STORE.PT_CFG, state.ptCfg);
    };
    saveNum('[data-cfg=pt-ratio]', v => savePt('targetRatio', Math.min(2, Math.max(0.5, v || 1))));
    saveNum('[data-cfg=pt-pump]', v => savePt('pumpAmount', Math.max(1, Math.floor(v || 1))));
    saveNum('[data-cfg=pt-reserve]', v => savePt('reservePct', Math.min(90, Math.max(0, Math.floor(v || 0)))));
    const savePtWant = () => {
      savePt('wantRes', {
        wood: !!sec.querySelector('[data-cfg=pt-want-wood]')?.checked,
        stone: !!sec.querySelector('[data-cfg=pt-want-stone]')?.checked,
        iron: !!sec.querySelector('[data-cfg=pt-want-iron]')?.checked,
      });
    };
    ['pt-want-wood', 'pt-want-stone', 'pt-want-iron'].forEach(k => {
      onCfg('[data-cfg=' + k + ']', 'change', savePtWant);
    });
    onCfg('[data-cfg=pt-now]', 'click', () => {
      if (!state.ptTradeTpl) { flash('comercia una vez a mano primero'); return; }
      if (!confirm('Bombear el ratio del barco mercante y enviar ahora el trato grande?')) return;
      const was = state.autoPtTrade;
      if (!was) { state.autoPtTrade = true; save(STORE.AUTO_PT_TRADE, true); }
      ptTradeScan('manual');
    });
    onCfg('[data-cfg=pt-copy]', 'click', () => {
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
    bindToggle('[data-cfg=auto-recruit]', 'autoRecruit', STORE.AUTO_RECRUIT, () => { try { renderTrain(); } catch (_) {} recruitScan('toggle'); });
    bindToggle('[data-cfg=village-recruit]', 'autoVillageRecruit', STORE.AUTO_VILLAGE_RECRUIT, () => villageRecruitScan('toggle'));
    saveNum('[data-cfg=village-recruit-fill]', v => {
      state.villageRecruitFillPct = gbCfgClamp(v, 50, 99, 90);
      save(STORE.VILLAGE_RECRUIT_FILL, state.villageRecruitFillPct);
    });
    saveNum('[data-cfg=village-recruit-amount]', v => {
      state.villageRecruitAmount = Math.min(20, Math.max(1, v || 1));
      save(STORE.VILLAGE_RECRUIT_AMOUNT, state.villageRecruitAmount);
    });
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
      onCfg('[data-cfg=' + k + ']', 'change', saveCult);
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
    onCfg('[data-cfg=rural-res]', 'change', e => {
      state.ruralTradeRes = e.target.value; save(STORE.RURAL_TRADE_RES, state.ruralTradeRes);
    });
    onCfg('[data-cfg=defense-mode]', 'change',e=>{state.defenseCfg=Object.assign({},state.defenseCfg,{mode:['notify','safe'].includes(e.target.value)?e.target.value:'notify'});save(STORE.DEFENSE_CFG,state.defenseCfg)});

    // Weights live under the existing PREDICT_CFG key, already world-scoped.
    const saveThreat = (key, v, lo, hi) => {
      if (!state.predictCfg || typeof state.predictCfg !== 'object') state.predictCfg = { horizonHours: 6 };
      const w = Object.assign({}, defenseThreatWeights());
      w[key] = Math.max(lo, Math.min(hi, Number.isFinite(+v) ? +v : w[key]));
      state.predictCfg.threatWeights = w;
      save(STORE.PREDICT_CFG, state.predictCfg);
      try { renderIntel(); } catch (_) {}
    };
    const saveSupport = (key, v, lo, hi) => {
      if (!state.supportCfg || typeof state.supportCfg !== 'object') state.supportCfg = {};
      state.supportCfg[key] = Math.max(lo, Math.min(hi, Number.isFinite(+v) ? +v : state.supportCfg[key]));
      save(STORE.SUPPORT_CFG, state.supportCfg);
    };
    onCfg('[data-cfg=support-auto]', 'change', e => {
      if (!state.supportCfg || typeof state.supportCfg !== 'object') state.supportCfg = {};
      state.supportCfg.auto = !!e.target.checked;
      save(STORE.SUPPORT_CFG, state.supportCfg);
      gbLog('support auto ' + (state.supportCfg.auto ? 'ON - real troops, confirm gate per window' : 'OFF'));
      if (state.supportCfg.auto && !state.supportTpl) flash('apoyo ON pero sin plantilla: envia un apoyo a mano una vez');
    });
    const saveFavorCfg = (key, v) => {
      state.favorCfg = Object.assign({}, state.favorCfg, { [key]: v });
      save(STORE.FAVOR_CFG, state.favorCfg);
    };
    onCfg('[data-cfg=godspell-power]', 'change', e => {
      const raw = String(e.target.value || '').trim();

      // Stored verbatim, validated at cast time. An empty box means "cast
      // nothing", which is the default and the safe state.
      saveFavorCfg('spellPower', raw);
      gbLog('godspell power ' + (raw ? 'set to ' + raw : 'cleared - nothing will be cast'));
    });
    saveNum('[data-cfg=godspell-cost]', v => saveFavorCfg('spellCost', Math.max(0, Math.min(500, +v || 0))));
    saveNum('[data-cfg=godspell-reserve]', v => saveFavorCfg('spellReserve', Math.max(0, Math.min(95, +v || 50))));
    const saveSpy = (key, v) => {
      if (!state.spyCfg || typeof state.spyCfg !== 'object') state.spyCfg = {};
      state.spyCfg[key] = v;
      spyCfgSave();
    };
    onCfg('[data-cfg=auto-spy]', 'change', e => {
      state.spyEnabled = !!e.target.checked;
      save(STORE.AUTO_SPY, state.spyEnabled);
      gbLog('auto-spy ' + (state.spyEnabled ? 'ON' : 'OFF'));
      if (state.spyEnabled && !state.spyTpl) flash('espionaje ON pero sin ruta: espia una ciudad a mano una vez');
    });
    onCfg('[data-cfg=spy-dry]', 'change', e => saveSpy('dryRun', !!e.target.checked));
    saveNum('[data-cfg=spy-per-cycle]', v => saveSpy('perCycle', Math.max(1, Math.min(5, +v || 1))));
    saveNum('[data-cfg=spy-min-gap]', v => saveSpy('minGapMs', Math.max(60000, Math.min(86400000, (+v || 20) * 60000))));
    saveNum('[data-cfg=spy-top]', v => saveSpy('autoTopReported', Math.max(0, Math.min(50, +v || 0))));
    const saveDefense = (key, v) => {
      state.defenseCfg = Object.assign({}, state.defenseCfg, { [key]: v });
      save(STORE.DEFENSE_CFG, state.defenseCfg);
    };
    const saveAttackRisk = (key, v, lo, hi) => {
      const ar = Object.assign({}, (state.defenseCfg || {}).attackRisk || {});
      ar[key] = Math.max(lo, Math.min(hi, Number.isFinite(+v) ? +v : 0));
      saveDefense('attackRisk', ar);
    };
    onCfg('[data-cfg=defense-risk-threshold]', 'change', e => {
      const raw = String(e.target.value || '').trim();

      // Empty means "no override": the 5.3 weight applies again.
      saveDefense('riskThresholdDodge', raw === '' ? null : Math.max(10, Math.min(200, +raw || 35)));
    });
    saveNum('[data-cfg=defense-risk-cs]', v => saveAttackRisk('csBonus', v, 0, 120));
    saveNum('[data-cfg=defense-risk-raid]', v => saveAttackRisk('raid', v, 0, 100));
    saveNum('[data-cfg=defense-risk-siege]', v => saveAttackRisk('siege', v, 0, 100));
    onCfg('[data-cfg=cs-snipe]', 'change', e => saveDefense('snipeDetect', !!e.target.checked));
    saveNum('[data-cfg=cs-cluster-gap]', v => saveDefense('csClusterGapSec', Math.max(60, Math.min(21600, +v || 900))));
    saveNum('[data-cfg=cs-cover]', v => saveDefense('csCoverSec', Math.max(5, Math.min(900, +v || 180))));
    saveNum('[data-cfg=cs-tight]', v => saveDefense('csTightSec', Math.max(0, Math.min(120, Number.isFinite(+v) ? +v : 5))));
    saveNum('[data-cfg=support-confirm]', v => saveSupport('confirmThreshold', v, 0, 10000));
    saveNum('[data-cfg=support-home-floor]', v => saveSupport('homeFloor', v, 0, 50));
    saveNum('[data-cfg=support-min-eta]', v => saveSupport('minEtaSec', v, 30, 3600));
    saveNum('[data-cfg=support-no-arm]', v => saveSupport('noArmSec', v, 10, 600));
    saveNum('[data-cfg=threat-cs]', v => saveThreat('cs', v, 0, 120));
    saveNum('[data-cfg=threat-eta15]', v => saveThreat('eta15', v, 0, 60));
    saveNum('[data-cfg=threat-sim]', v => saveThreat('simPer', v, 0, 30));
    saveNum('[data-cfg=threat-support]', v => saveThreat('supportPer', v, 0, 30));
    saveNum('[data-cfg=defense-return-margin]',v=>{state.defenseCfg=Object.assign({},state.defenseCfg,{returnMarginSec:Math.max(0,Math.min(3600,+v||0))});save(STORE.DEFENSE_CFG,state.defenseCfg)});
    onCfg('[data-cfg=webhook-url]', 'change', e => {
      state.webhookUrl = e.target.value.trim(); save(STORE.WEBHOOK_URL, state.webhookUrl);
      gbLog('webhook url', state.webhookUrl ? 'set' : 'cleared');
    });
    const saveWebhookEvents = () => {
      state.webhookEvents = {
        captcha: !!sec.querySelector('[data-cfg=wh-captcha]')?.checked,
        attack: !!sec.querySelector('[data-cfg=wh-attack]')?.checked,
        warehouse: !!sec.querySelector('[data-cfg=wh-warehouse]')?.checked,
        culture: !!sec.querySelector('[data-cfg=wh-culture]')?.checked,
        cappingPreWarn: !!sec.querySelector('[data-cfg=wh-capping]')?.checked,
        'counter-intel': !!sec.querySelector('[data-cfg=wh-counter-intel]')?.checked,
        telegramChatId: (sec.querySelector('[data-cfg=wh-tg-chat]')?.value || '').trim() || undefined,
      };
      save(STORE.WEBHOOK_EVENTS, state.webhookEvents);
    };
    ['wh-captcha', 'wh-attack', 'wh-warehouse', 'wh-culture', 'wh-capping', 'wh-counter-intel'].forEach(k => {
      onCfg('[data-cfg=' + k + ']', 'change', saveWebhookEvents);
    });
    onCfg('[data-cfg=wh-tg-chat]', 'change', saveWebhookEvents);
    onCfg('[data-cfg=intel-digest]', 'change', e => {
      state.intelDigest = !!e.target.checked;
      save(STORE.INTEL_DIGEST, state.intelDigest);
      gbLog('intel digest ' + (state.intelDigest ? 'ON - spy summaries go to the webhook' : 'OFF'));
      if (state.intelDigest && !(state.webhookUrl || '').trim()) flash('resumen ON pero sin URL de webhook');
    });
    onCfg('[data-cfg=notify-enabled]', 'change', e => {
      state.notifyEnabled = !!e.target.checked;
      save(STORE.NOTIFY_ENABLED, state.notifyEnabled);
      let perm = 'unsupported';
      try { perm = (typeof Notification !== 'undefined') ? Notification.permission : 'unsupported'; } catch (_) {}
      if (state.notifyEnabled && perm !== 'granted') flash('falta permiso del navegador: pulsa "Permiso"');
    });
    onCfg('[data-cfg=notify-muted]', 'change', e => {
      state.notifyMuted = !!e.target.checked; save(STORE.NOTIFY_MUTED, state.notifyMuted);
    });
    saveNum('[data-cfg=notify-volume]', v => {
      state.notifyVolume = Math.max(0, Math.min(1, (Number.isFinite(+v) ? +v : 40) / 100));
      save(STORE.NOTIFY_VOLUME, state.notifyVolume);
    });
    onCfg('[data-cfg=notify-permission]', 'click', () => {

      // Must be called from the click handler itself: browsers only honour
      // requestPermission inside a real user gesture.
      try {
        const r = Notification.requestPermission();
        if (r && typeof r.then === 'function') r.then(() => bindConfig());
        else bindConfig();
      } catch (e) { flash('notificaciones no soportadas'); }
    });
    onCfg('[data-cfg=notify-test]', 'click', () => {
      try { alertPlayChime('attack'); } catch (_) {}
      let perm = 'unsupported';
      try { perm = (typeof Notification !== 'undefined') ? Notification.permission : 'unsupported'; } catch (_) {}
      if (perm === 'granted') { try { new Notification('GrepBot', { body: 'prueba de notificacion', tag: 'gb-test' }); } catch (_) {} }
      else flash('sonido probado; permiso de notificacion: ' + perm);
    });
    onCfg('[data-cfg=snapshots-on]', 'change', e => {
      state.snapshotsOn = !!e.target.checked; save(STORE.SNAPSHOTS_ON, state.snapshotsOn);
    });
    onCfg('[data-cfg=profiler-on]', 'change', e => {
      state.profilerOn = !!e.target.checked; save(STORE.PROFILER_ON, state.profilerOn);
      if (!state.profilerOn) state.profileRings = {};
    });
    onCfg('[data-cfg=mem-probe-on]', 'change', e => {
      state.memProbeOn = !!e.target.checked; save(STORE.MEM_PROBE_ON, state.memProbeOn);
    });
    onCfg('[data-cfg=snapshot-restore]', 'click', () => {
      const l = snapshotList();
      if (!l.length) { flash('sin instantaneas'); return; }
      const menu = l.map(x => `${x.slot}: ${new Date(x.at).toLocaleString()} (${Math.round(x.sizeBytes / 1024)} KB)`).join('\n');
      const pick = prompt('Restaurar que ranura?\n' + menu, String(l[l.length - 1].slot));
      if (pick == null) return;
      const slot = +pick;
      if (!Number.isInteger(slot) || !l.some(x => x.slot === slot)) { flash('ranura no valida'); return; }
      if (!confirm('Restaurar sobrescribe objetivos, transacciones y ventanas de salto. Continuar?')) return;
      if (snapshotRestore(slot)) { flash('instantanea restaurada'); bindConfig(); updateStatus(); }
      else flash('no se pudo restaurar');
    });
    onCfg('[data-cfg=context-menu]', 'change', e => {
      state.contextMenu = !!e.target.checked;
      save(STORE.CONTEXT_MENU, state.contextMenu);
      if (!state.contextMenu) { try { ctxDispose(); } catch (_) {} }
      else { try { contextMenuStart(); } catch (_) {} }
    });
    onCfg('[data-cfg=keyboard-shortcuts]', 'change', e => {
      state.keyboardShortcuts = !!e.target.checked;
      save(STORE.KEYBOARD_SHORTCUTS, state.keyboardShortcuts);
    });
    onCfg('[data-cfg=keybindings-edit]', 'click', () => {
      const raw = prompt(
        'Atajos (JSON). Clave = combinacion, valor = accion.\nAcciones: ' + Object.keys(GB_KEY_ACTIONS).join(', ') +
        '\nSolo Ctrl/Cmd(+Shift)+una tecla; Alt no se acepta.',
        JSON.stringify(gbKeyBindings(), null, 2));
      if (raw == null) return;
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape');
        const clean = {};
        for (const [fp, act] of Object.entries(parsed)) {

          // Only bindings this build can actually run, and only in the locked
          // Ctrl(+Shift)+key shape - anything else is dropped, not coerced.
          if (!GB_KEY_ACTIONS[act]) continue;
          if (!/^Ctrl(\+Shift)?\+[^+]$/.test(fp)) continue;
          clean[fp] = act;
        }
        state.keybindings = clean;
        save(STORE.KEYBINDINGS, clean);
        flash(`${Object.keys(clean).length}/${Object.keys(parsed).length} atajos guardados`);
        bindConfig();
      } catch (_) { flash('JSON de atajos invalido'); }
    });
    onCfg('[data-cfg=theme]', 'change', e => {
      state.theme = GB_THEMES.includes(e.target.value) ? e.target.value : 'dark';
      save(STORE.THEME, state.theme);
      applyTheme();
      gbLog('theme ' + state.theme + ' (' + gbThemeResolved() + ')');
    });
    onCfg('[data-cfg=trade-preset]', 'change', e => {
      state.tradePreset = e.target.value; save(STORE.TRADE_PRESET, state.tradePreset);
      gbLog('tradePreset', state.tradePreset);
    });
    saveNum('[data-cfg=trade-reserve]', v => {
      state.tradeReservePct = Math.min(80, Math.max(0, v)); save(STORE.TRADE_RESERVE, state.tradeReservePct);
    });
    saveNum('[data-cfg=trade-min]', v => {
      state.tradeMinBatch = gbCfgClamp(v, 100, Infinity, 1000); save(STORE.TRADE_MIN, state.tradeMinBatch);
    });
    saveNum('[data-cfg=transport-reserve]', v => {
      state.transportReserve = Math.min(80, Math.max(0, v)); save(STORE.TRANSPORT_RESERVE, state.transportReserve);
    });
    saveNum('[data-cfg=transport-min]', v => {
      state.transportMin = Math.min(10000, gbCfgClamp(v, 100, Infinity, 1000)); save(STORE.TRANSPORT_MIN, state.transportMin);
    });
    onCfg('[data-cfg=research-csfast]', 'click', () => {
      researchLoadCsFast(); flash('CS-fast research');
    });
    onCfg('[data-cfg=emergency-cave-auto]', 'change', e => {
      state.emergencyCaveAuto = !!e.target.checked;
      save(STORE.EMERGENCY_CAVE_AUTO, state.emergencyCaveAuto);
      gbLog('emergency cave auto ' + (state.emergencyCaveAuto ? 'ON - stashes ignoring the threshold on an imminent hit' : 'OFF'));
      if (state.emergencyCaveAuto && !state.autoCave) flash('emergencia ON: recuerda activar las cuevas por ciudad arriba');
    });
    saveNum('[data-cfg=emergency-cave-confirm]', v => {
      state.emergencyCaveConfirm = Math.max(0, Math.min(1000000, Number.isFinite(+v) ? +v : 1000));
      save(STORE.EMERGENCY_CAVE_CONFIRM, state.emergencyCaveConfirm);
    });
    saveNum('[data-cfg=emergency-cave-min-iron]', v => {
      state.emergencyCaveMinIron = Math.max(1, Math.min(100000, Number.isFinite(+v) ? +v : 50));
      save(STORE.EMERGENCY_CAVE_MIN, state.emergencyCaveMinIron);
    });
    onCfg('[data-cfg=emergency-cave-now]', 'click', () => { try { emergencyStashAllNow(); } catch (e) { flash('fallo: ' + String(e).slice(0, 40)); } });
    saveNum('[data-cfg=cave-thresh]', v => {
      state.caveThreshPct = gbCfgClamp(v, 50, 99, 90);
      save(STORE.CAVE_THRESH, state.caveThreshPct);
      gbLog('cave-thresh', state.caveThreshPct + '%');
    });
    saveNum('[data-cfg=farm-sleep-fill]', v => {
      state.farmSleepFillPct = Math.min(95, Math.max(10, v || 60));
      save(STORE.FARM_SLEEP_FILL, state.farmSleepFillPct);
    });
    onCfg('[data-cfg=adaptive-farm]', 'change', e => {
      state.adaptiveFarm = !!e.target.checked;
      save(STORE.ADAPTIVE_FARM, state.adaptiveFarm);
      gbLog('adaptive farm ' + (state.adaptiveFarm ? 'ON - trims the claim set under pressure' : 'OFF'));
    });
    saveNum('[data-cfg=farm-drop-pct]', v => {
      state.farmDropPressurePct = Math.max(0, Math.min(90, +v || 0));
      save(STORE.FARM_DROP_PCT, state.farmDropPressurePct);
    });
    saveNum('[data-cfg=farm-travel]', v => {
      state.farmTravelSecPerUnit = Math.min(600, Math.max(0, Number.isFinite(+v) ? +v : 0));
      save(STORE.FARM_TRAVEL, state.farmTravelSecPerUnit);

      // Force-recompute: the 5min memo would otherwise hide the change.
      try { farmProfitInvalidate(); farmProfitRefresh(true); renderFarms(); } catch (_) {}
    });
    saveNum('[data-cfg=ib-free-thresh]', v => { state.ibFreeThresh = Math.max(60,Math.min(300,+v||300)); save(STORE.IB_FREE_THRESH, state.ibFreeThresh); });
    saveNum('[data-cfg=collect-max-min]', v => { state.collectMaxMin = v; save(STORE.COLLECT_MAX_MIN, v); });
    saveNum('[data-cfg=farm-min]', v => { state.farmMinMs = v * 60000; save(STORE.FARM_MIN, state.farmMinMs); });
    saveNum('[data-cfg=farm-max]', v => { state.farmMaxMs = v * 60000; save(STORE.FARM_MAX, state.farmMaxMs); });
    saveNum('[data-cfg=town-min]', v => { state.townMinMs = v * 60000; save(STORE.TOWN_MIN, state.townMinMs); });
    saveNum('[data-cfg=town-max]', v => { state.townMaxMs = v * 60000; save(STORE.TOWN_MAX, state.townMaxMs); });
    onCfg('[data-cfg=captcha-ladder]', 'change', e => {
      const raw = String(e.target.value || '').split(/[,\s]+/).map(x => parseInt(x, 10))
        .filter(n => Number.isFinite(n) && n >= 1 && n <= 24 * 60);

      // Empty / unparseable input means "back to the default ladder", never an
      // empty array - captchaLadder() would then fall back silently every trip.
      state.captchaLadder = raw.length ? raw : [5, 15, 60];
      save(STORE.CAPTCHA_LADDER, state.captchaLadder);
      e.target.value = state.captchaLadder.join(',');
      gbLog('captcha ladder =', state.captchaLadder.join(',') + ' min');
    });
    saveNum('[data-cfg=posts-soft-pct]', v => {
      state.postsPerMinSoftPct = Math.min(100, Math.max(10, v || 60));
      save(STORE.POSTS_SOFT_PCT, state.postsPerMinSoftPct);
      gbLog('posts soft ceiling =', state.postsPerMinSoftPct + '% of ' + (state.reqBudgetPerMin || 40) + '/min');
    });
    onCfg('[data-cfg=farm-forget-options]', 'click', () => {
      if (!confirm('Olvidar las opciones de cobro aprendidas (recursos y unidades)?')) return;
      state.farmOptionMap = {};
      save(wkey(STORE.FARM_OPTION_MAP), state.farmOptionMap);
      state.farmUnitsOption = null;
      save(wkey(STORE.FARM_UNITS_OPTION), null);

      try { tplHealthMarkLearned('claimTpl'); } catch (_) {}
      gbLog('farm: learned claim options cleared by user (resources + units)');
      flash('opciones de cobro olvidadas');
      syncFarmTimingCfg(sec);
    });
    onCfg('[data-cfg=clear-captcha]', 'click', () => {
      captchaClear();
      gbLog('captcha breakers cleared by user');
      flash('cortacircuitos de captcha limpiados');
    });

    // Controls whose value-set only ever existed in the deleted repaint branch,
    // so the bind path had never initialised them: on a first render the theme
    // select, the diagnostics toggles and the emergency-cave numbers showed
    // their HTML default rather than state.
    setChk('[data-cfg=snapshots-on]', state.snapshotsOn !== false);
    setChk('[data-cfg=profiler-on]', !!state.profilerOn);
    setChk('[data-cfg=mem-probe-on]', !!state.memProbeOn);
    setChk('[data-cfg=keyboard-shortcuts]', state.keyboardShortcuts !== false);
    setChk('[data-cfg=context-menu]', state.contextMenu !== false);
    setChk('[data-cfg=emergency-cave-auto]', !!state.emergencyCaveAuto);
    setNum('[data-cfg=emergency-cave-confirm]', emergencyConfirmAt());
    setNum('[data-cfg=emergency-cave-min-iron]', emergencyMinIron());
    { const th = sec.querySelector('[data-cfg=theme]'); if (th) th.value = GB_THEMES.includes(state.theme) ? state.theme : 'dark'; }
    { const kl = sec.querySelector('.key-list');
      if (kl) {
        const b = gbKeyBindings();
        kl.textContent = Object.keys(b).sort().map(fp => `${fp}  ${(GB_KEY_ACTIONS[b[fp]] || {}).label || b[fp]}`).join('\n');
      } }
    renderResearchPath(sec);
    renderCaveTowns();

    setChk('[data-cfg=batch-recruit]', !!state.batchRecruit);
    onCfg('[data-cfg=batch-recruit]', 'change', e => {
      state.batchRecruit = e.target.checked; save(STORE.BATCH_RECRUIT, state.batchRecruit);
      gbLog('batch-recruit', state.batchRecruit ? 'ON' : 'OFF');
      try { updateStatus(); } catch (_) {}
      try { renderTrain(); } catch (_) {}
    });
  }
  bindConfig();
  {
    const start = TAB_IDS.includes(state.activeTab) ? state.activeTab : 'overview';
    showTab(start, { force: true });
  }

  // The manual `vill_id | x y | ETA | notes` textarea lived in the removed Aldeas
  // tab. `state.farms` is still parsed from storage on boot and merged with the
  // auto-discovered relations; it just has no editor in the panel any more.
  // Drag is bound on DOCUMENT in the CAPTURE phase, not on the header itself.
  // The game owns the page: any handler of its own that calls stopPropagation()
  // on a mousedown before it reaches the panel would silently kill a
  // header-bound listener, and the panel would just stop being movable. A
  // capture listener on document sees the event first, on the way down.
  // Pointer events (not mouse) so a capture keeps the drag alive when the
  // cursor crosses a game overlay or an iframe mid-drag.
  (function drag(el) {
    let sx, sy, dx, dy, dragging = false, moved = false, pid = null;
    const inHandle = t => !!(t && t.closest && t.closest('#grepbot-panel header') && !t.closest('.gb-resize') && !t.closest('button,select,input,textarea'));
    gbListen(document, 'pointerdown', e => {
      if (e.button != null && e.button !== 0) return;
      if (!inHandle(e.target)) return;
      dragging = true; moved = false; pid = e.pointerId;
      sx = e.clientX; sy = e.clientY; dx = el.offsetLeft; dy = el.offsetTop;
      try { if (pid != null) el.setPointerCapture(pid); } catch (_) {}
      e.preventDefault();
    }, true);
    gbListen(document, 'pointermove', e => {
      if (!dragging || (pid != null && e.pointerId !== pid)) return;
      moved = true;
      el.style.left = (e.clientX - sx + dx) + 'px';
      el.style.top = (e.clientY - sy + dy) + 'px';
      el.style.right = 'auto';
    }, true);
    const end = e => {
      if (!dragging || (pid != null && e && e.pointerId != null && e.pointerId !== pid)) return;
      dragging = false;
      try { if (pid != null) el.releasePointerCapture(pid); } catch (_) {}
      pid = null;
      if (moved) savePanelGeom();
    };
    gbListen(document, 'pointerup', end, true);
    gbListen(document, 'pointercancel', end, true);
  })(panel);

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
  const presetHandler = (name) => () => {
    if (typeof qolApplyPreset !== 'function') return;
    qolApplyPreset(name);
    try { bindConfig(); } catch (_) {}
    try { if (typeof updateStatus === 'function') updateStatus(); } catch (_) {}
    flash('perfil aplicado: ' + name);
  };
  panel.querySelector('footer button[data-act=preset-afk]')?.addEventListener('click', presetHandler('afk'));
  panel.querySelector('footer button[data-act=preset-farming]')?.addEventListener('click', presetHandler('farming'));
  panel.querySelector('footer button[data-act=preset-war]')?.addEventListener('click', presetHandler('war'));
  function gbDebounce(fn, ms) {
    let t = null;
    return function () {
      if (t) gbClearTimeout(t);
      t = gbTimeout(() => { t = null; fn(); }, ms);
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
    // LITERAL ONLY - no interpolation (the filter VALUES are read back off these
    // inputs; they are never written into this string).
    filt.innerHTML = '<input class="gb-cfg-input" data-f="type" placeholder="type filter" style="flex:1;min-width:60px;;padding:2px 4px;font:11px monospace"/><input class="gb-cfg-input" data-f="attacker" placeholder="attacker filter" style="flex:1;min-width:60px;;padding:2px 4px;font:11px monospace"/>';
    filt.querySelectorAll('input').forEach(inp => {
      inp.value = state.findingsFilter[inp.dataset.f] || '';
      inp.addEventListener('input', () => {
        state.findingsFilter[inp.dataset.f] = inp.value;

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
      gbTip(meta, 'ID · hora · tipo de informe · ciudad objetivo');
      row.appendChild(meta);

      const units = document.createElement('div');
      units.className = 'units';
      units.textContent = f.units
        ? Object.entries(f.units).map(([k,v]) => `${k}:${v}`).join(' ')
        : '-';
      gbTip(units, 'Unidades observadas en el informe');
      row.appendChild(units);

      if (f.resources && (f.resources.wood != null || f.resources.stone != null || f.resources.iron != null)) {
        const res = document.createElement('div');
        res.className = 'res';
        res.textContent = `W${f.resources.wood ?? '?'} S${f.resources.stone ?? '?'} I${f.resources.iron ?? '?'}`;
        gbTip(res, 'Recursos observados (madera/piedra/plata)');
        row.appendChild(res);
      }

      const bldgKeys = Object.keys(f.buildings || {});
      if (bldgKeys.length) {
        const b = document.createElement('div');
        b.className = 'res';
        const top = bldgKeys.sort((x, y) => f.buildings[y] - f.buildings[x]).slice(0, 3);
        b.textContent = 'bldg: ' + top.map(k => `${k}=${f.buildings[k]}`).join(' ') + (bldgKeys.length > 3 ? ' …' : '');
        b.title = bldgKeys.sort().map(k => `${k}=${f.buildings[k]}`).join(' ');
        gbTip(b, 'Top 3 edificios por nivel (hover para ver todos)');
        row.appendChild(b);
      }
      if (f.hero) {
        const h = document.createElement('div');
        h.className = 'res';
        h.textContent = 'heroe: ' + [f.hero.name, f.hero.level != null ? 'lv' + f.hero.level : null, f.hero.cls].filter(Boolean).join(' ');
        gbTip(h, 'Heroe visto en el informe');
        row.appendChild(h);
      }

      list.appendChild(row);
    }
  }
  // v4 plan 8.5: walk the decision ring forward, one row at a time, with the
  // open skip window for that row beside it. Read-only - the replay never
  // writes a decision.
  const REPLAY_WINDOWS = { '1h': 3600000, '24h': 86400000, '7d': 604800000 };
  let replayWindow = '24h';
  // Replay-bar button factory: shared chrome style across <, >, fin.
  function replayButton(label, fn, disabled, title) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label;
    b.style.cssText = 'background:var(--gb-chrome);border:1px solid var(--gb-chrome-3);color:var(--gb-fg-2);font-size:10px;padding:1px 6px;cursor:pointer';
    b.disabled = !!disabled;
    if (title) gbTip(b, title);
    b.addEventListener('click', () => { fn(); renderReplay(); });
    return b;
  }
  function renderReplay() {
    const pane = panel && panel.querySelector('.jrn-pane');
    const list = pane && pane.querySelector('.jrn-list');
    if (!list || pane.hidden) return;
    const rows = jrnSlice({ since: Date.now() - REPLAY_WINDOWS[replayWindow] });
    const cur = Math.max(0, Math.min(rows.length - 1, +state.replayCursor || 0));
    state.replayCursor = cur;
    list.replaceChildren();
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:4px;align-items:center;font-size:10px;margin-bottom:4px;flex-wrap:wrap';
    for (const w of Object.keys(REPLAY_WINDOWS)) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = w;
      gbTip(b, `Reproducir la ventana ${w} (1h / 24h / 7d)`);
      b.style.cssText = 'background:' + (w === replayWindow ? 'var(--gb-chrome-3)' : 'var(--gb-chrome)') +
        ';border:1px solid var(--gb-chrome-3);color:var(--gb-fg-2);font-size:10px;padding:1px 6px;cursor:pointer';
      b.addEventListener('click', () => { replayWindow = w; state.replayCursor = 0; renderReplay(); });
      bar.appendChild(b);
    }
    bar.appendChild(replayButton('<', () => { state.replayCursor = Math.max(0, cur - 1); }, !rows.length, 'Decision anterior'));
    bar.appendChild(replayButton('>', () => { state.replayCursor = Math.min(rows.length - 1, cur + 1); }, !rows.length, 'Decision siguiente'));
    bar.appendChild(replayButton('fin', () => { state.replayCursor = Math.max(0, rows.length - 1); }, !rows.length, 'Ir a la ultima decision'));
    const pos = document.createElement('span');
    pos.style.color = 'var(--gb-fg-mute)';
    gbTip(pos, 'Posicion actual en la ventana de replay');
    pos.textContent = rows.length ? `${cur + 1}/${rows.length}` : 'sin filas en la ventana';
    bar.appendChild(pos);
    list.appendChild(bar);
    if (!rows.length) return;
    const row = rows[cur];
    const win = jrnWindowOf(row);
    const box = document.createElement('div');
    box.style.cssText = 'font-size:11px;white-space:pre-wrap;line-height:1.5';
    box.textContent =
      `${new Date(row.ts).toLocaleString()}\n` +
      `feature : ${row.f}\n` +
      `accion  : ${row.a}\n` +
      `objetivo: ${row.k}\n` +
      `resultado: ${row.r}${row.n > 1 ? ` (x${row.n})` : ''}\n` +
      (row.d ? `detalle : ${row.d}\n` : '') +
      (win ? `ventana de salto: ${win.r}, ${Math.max(0, Math.round((win.until - Date.now()) / 1000))}s restantes, ${win.trips} disparo(s)` : 'sin ventana de salto abierta');
    list.appendChild(box);
    // Neighbouring rows for context, in chronological order.
    const ctx = document.createElement('div');
    ctx.style.cssText = 'margin-top:6px;font-size:10px;color:var(--gb-fg-mute);white-space:pre-wrap';
    ctx.textContent = rows.slice(Math.max(0, cur - 3), cur + 4)
      .map((r, i) => `${(Math.max(0, cur - 3) + i) === cur ? '> ' : '  '}${new Date(r.ts).toLocaleTimeString()} ${r.f} ${r.a} ${r.r}`)
      .join('\n');
    list.appendChild(ctx);
  }
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
      tr.className = r.r === 'ok' ? 'ok' : ((r.r.slice(0, 5) === 'skip:' || jrnPendingResult(r.r)) ? 'skip' : 'err');
      const cell = (cls, text, title) => {
        const td = document.createElement('td');
        td.className = cls;
        td.textContent = text;
        if (title) td.title = title;
        tr.appendChild(td);
      };
      cell('t', new Date(r.ts).toLocaleTimeString(), 'Marca temporal local');
      cell('f', r.f, 'Modulo (feature) que intento la accion');
      cell('a', r.a, 'Accion concreta enviada o intentada');
      cell('k', r.k === '-' ? '' : r.k, 'Objetivo / target');
      cell('r', (r.r.slice(0, 5) === 'skip:' ? r.r.slice(5) : r.r) + ((r.n || 1) > 1 ? ' x' + r.n : ''), r.d || '');
      table.appendChild(tr);
    }
    list.appendChild(table);
  }
  function flash(msg) {
    const f = document.createElement('div');
    // gb-flash is one of the classes the DOM observer ignores. Since that
    // observer moved to document.body, an unmarked toast would feed itself:
    // append + remove are two body mutations that re-arm the collect/native
    // scans, which can flash again.
    f.className = 'gb-flash';
    f.textContent = msg; f.style.cssText = 'position:fixed;top:60px;right:8px;background:#f5a623;color:#000;padding:6px 10px;border-radius:4px;z-index:100000';
    document.body.appendChild(f); gbTimeout(() => f.remove(), 1500);
  }
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

      // hero.name is player-authored text (plan 2.1), so it is redacted like
      // any other player name. Level/class are game data and ship raw.
      if (out.hero && typeof out.hero === 'object') {
        out.hero = { id: out.hero.id != null ? 'h' + String(out.hero.id).slice(-4) : null,
          name: out.hero.name ? String(out.hero.name).slice(0, 1) + '…' : null,
          level: out.hero.level, cls: out.hero.cls };
      }
      delete out.raw;
      return out;
    });
    return { findings, farms: dump.farms };
  }
  // v4 plan 2.10: read-only "camino de investigacion". No button, no post - it
  // only reports what the graph could and could not read.
  function renderResearchPath(sec) {
    const box = (sec || panel) && (sec || panel).querySelector('.research-path');
    if (!box) return;
    const ids = (townsFromGame() || []).map(t => t.id);
    const lines = [];
    for (const tid of ids.slice(0, 6)) {
      let target = null;
      try { target = researchNextTargetFor(tid); } catch (_) {}
      if (!target) { lines.push(`${tid}: sin objetivo pendiente`); continue; }
      const p = researchPathFor(tid, target);
      const label = researchLabel(target) || target;
      if (!p.known) { lines.push(`${tid}: ${label} - camino no legible (${p.why})`); continue; }
      // A partial graph or an unread real queue means the path shown is a lower
      // bound, not a complete answer - say so rather than implying it is done.
      const caveat = p.ordersKnown === false ? ' [cola real no leida]' : '';
      lines.push(`${tid}: ${label}` + (p.missing.length
        ? ' <- ' + p.missing.map(m => m.label).join(' <- ')
        : ' (sin prerrequisitos pendientes)') + caveat);
    }
    let head = 'camino de investigacion';
    try { const g = researchGraphBuild(); if (g.known && g.blind) head += ' (grafo parcial: ' + g.why + ')'; } catch (_) {}
    const txt = lines.length ? head + '\n' + lines.join('\n') : '';
    if (box.textContent !== txt) box.textContent = txt;
  }
  function pendingCollect() {
    const out = [];
    for (const intent of Object.keys(state.txState || {})) {
      const t = state.txState[intent];
      if (!t || !/^(unknown|manual-review)$/.test(t.state || '')) continue;
      out.push({ intent, ...t });
    }
    out.sort((a, b) => (+a.unknownAt || +a.updatedAt || 0) - (+b.unknownAt || +b.updatedAt || 0));
    return out;
  }
  function renderPending() {
    const pane = panel && panel.querySelector('.pending-pane');
    if (!pane || pane.hidden) return;
    const list = pane.querySelector('.pending-list');
    const head = pane.querySelector('.pending-head');
    const rows = pendingCollect();
    if (head) {
      head.textContent = '';
      head.appendChild(document.createTextNode(
        `${rows.length} transaccion(es) pendiente(s) · estado unknown / manual-review (lo que REVISAR rojo cuenta)`));
    }
    list.textContent = '';
    if (!rows.length) {
      list.textContent = 'Sin transacciones pendientes.';
      return;
    }
    const now = Date.now();
    const table = document.createElement('table');
    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.className = r.state === 'manual-review' ? 'skip' : 'err';
      const cell = (cls, text) => {
        const td = document.createElement('td');
        td.className = cls;
        td.textContent = text;
        return td;
      };
      const since = r.unknownAt || r.updatedAt || r.createdAt || 0;
      const age = since ? (now - since) : 0;
      tr.appendChild(cell('k', fmtSec(Math.max(0, Math.round(age / 1000)))));
      tr.appendChild(cell('k', r.feature || '-'));
      tr.appendChild(cell('k', r.endpoint || r.transport || '-'));
      tr.appendChild(cell('k', r.intent));
      tr.appendChild(cell('k', r.state));
      tr.appendChild(cell('k', r.detail || '-'));
      const action = document.createElement('td');
      const btn = document.createElement('button');
      btn.textContent = 'limpiar';
      btn.style.cssText = 'font-size:9px;padding:1px 5px;background:#262626;color:#f96;border:1px solid #555;border-radius:3px;cursor:pointer';
      btn.title = 'Marca esta transaccion como abortada y libera el planner';
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (!confirm('Limpiar la transaccion pendiente:\n' + r.intent + '\n\nSolo si ya se reconcilio con el servidor o rechazo definitivo.')) return;
        const ok = txClearOne(r.intent);
        flash(ok ? 'pendiente limpiada' : 'estado cambio, ya no era pendiente');
        renderPending();
        updateStatus();
      });
      action.appendChild(btn);
      tr.appendChild(action);
      table.appendChild(tr);
    }
    list.appendChild(table);
  }

  panel.querySelectorAll('[data-pending]').forEach(btn => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.pending;
      if (act === 'refresh') { renderPending(); return; }
      if (act === 'copy') {
        const rows = pendingCollect();
        navigator.clipboard.writeText(JSON.stringify(rows, null, 2)).then(() => flash('pendientes copiadas')).catch(() => flash('fallo al copiar'));
        return;
      }
      if (act === 'clear-all') {
        const n = pendingCollect().length;
        if (!n) { flash('sin pendientes'); return; }
        if (!confirm('Vas a marcar ' + n + ' transaccion(es) pendiente(s) como abortadas. Continuar solo si ya se reconciliaron con el servidor.')) return;
        txClearUnknown();
        renderPending();
        updateStatus();
        flash(n + ' pendiente(s) limpiada(s)');
      }
    });
  });
  let _statusLast = '';
  let _statusCsLast = '';
  let _statusPanicLast = null;
  function updateStatus() {
    if (!panel) return;
    const el = panel.querySelector('#gb-status');
    if (!el) return;
    const csrfShort = state.csrf ? state.csrf.slice(0, 6) + '…' : 'NONE';
    const farms = state.farmsParsed.length;
    const okFarms = Object.values(state.farmResources).filter(r => r && r.ok).length;
    const scrapeOff = typeof farmScrapeEnabled === 'function' && !farmScrapeEnabled();
    const lastErr = scrapeOff ? null : Object.values(state.farmResources).filter(r => r && !r.ok).slice(-1)[0];
    const errTxt = scrapeOff ? ' scrape:off' : (lastErr ? ` err:${(lastErr.err || '').slice(0, 20)}` : '');
    const paused = Object.keys(state.captchaBreakers || {}).filter(k => captchaPaused(k));
    const pauseInfo = {};
    automationPaused(pauseInfo);
    let pauseTxt = paused.length ? ` ||${paused.join(',')}` : '';
    if (pauseInfo.reason) pauseTxt += ` ||${pauseInfo.reason}`;

    // The global captcha kill said only 'ALL' with no idea how long it lasts,
    // so the operator's only options were reload-and-hope or wait blind.
    if (captchaGlobalUntil > Date.now()) pauseTxt += ` ||ALL:${fmtSec(Math.ceil((captchaGlobalUntil - Date.now()) / 1000))}`;
    const memSkips = jrnActiveSkips();
    if (memSkips.length) pauseTxt += ` mem:${memSkips.length}`;
    const openCircuits = Object.keys(state.circuits || {}).filter(k => state.circuits[k] && state.circuits[k].open);
    const unknownTx = Object.values(state.txState || {}).filter(t => t && /^(unknown|manual-review)$/.test(t.state || '')).length;
    if (openCircuits.length) pauseTxt += ` circuit:${openCircuits.length}`;
    if (unknownTx) pauseTxt += ` tx?:${unknownTx}`;
    if (gbServerPaused()) pauseTxt += ` ||srv:${fmtSec(Math.round(gbServerCooldownLeftMs() / 1000))}`;
    if(gbTabCoordSupported&&!gbTabLeader)pauseTxt+=' ||other-tab';
    if (storageWarnUntil > Date.now()) pauseTxt += ` !${storageWarnMsg || 'quota'}`;
    if (typeof orchDeadlockOpen === 'function' && orchDeadlockOpen()) pauseTxt += ' !WH';
    let tplBanner = '';
    try { tplBanner = tplHealthBannerText() || ''; } catch (_) {}
    if (tplBanner) pauseTxt += ' tpl!';
    const dryTxt = state.dryRun ? ' [DRY]' : ''; const safeTxt=(state.safeMode&&!gbNeverStop())?' SAFE':(gbNeverStop()?' NOSTOP':'');

    // Panic owns the head of the status line and its colour; the 5s updateStatus
    // interval (boot.js) is what flips grace -> recovery, no extra scheduler.
    const panicOn = gbPanicActive();
    const panicPend = gbPanicPending();
    const panicTxt = panicOn
      ? `⚠ PANIC ${Math.ceil(gbPanicLeftMs() / 1000)}s `
      : (panicPend ? '⚠ PANIC: clear skips to resume ' : '');
    const rec = panel.querySelector('footer button[data-act=panic-recover]');
    if (rec) { const dis = !(panicPend && !panicOn); if (rec.disabled !== dis) rec.disabled = dis; }
    const panicPhase = panicOn ? 'on' : (panicPend ? 'grace' : '');
    if (_statusPanicLast !== panicPhase) {
      _statusPanicLast = panicPhase;
      el.style.color = panicOn ? '#f44' : (panicPend ? '#fa3' : '#888');
      el.style.fontWeight = panicPhase ? 'bold' : '';
    }

    // Request budget by scope. This was already computed and journalled but was
    // only reachable through the Stats tab, so `skip:budget` in the Decisions
    // view was the first the operator heard of a starved pool. Rendered only
    // once something is actually consumed, to keep an idle pill quiet.
    let budgetTxt = '';
    let budget = null;
    try {
      budget = reqBudgetByScope();
      const cap = state.reqBudgetPerMin || 40;
      if (budget && (budget.scrape || budget.read || budget.action)) {
        budgetTxt = ` req:${budget.scrape}/${budget.read}/${budget.action}·${cap}`;
      }
    } catch (_) {}
    const txt = `${panicTxt}csrf:${csrfShort} farms:${okFarms}/${farms}${errTxt}${dryTxt}${safeTxt}${budgetTxt}${pauseTxt}`;
    if (txt !== _statusLast) {
      _statusLast = txt;
      el.textContent = txt;
      el.title = (tplBanner ? tplBanner + ' | ' : '')
        + 'req = scrape/read/accion por minuto\n'
        + JSON.stringify({ csrf: !!state.csrf, captcha: state.captchaBreakers, captchaAllUntil: captchaGlobalUntil || 0, requestBudget: budget, softDelayMs: (() => { try { return reqBudgetSoftDelayMs(); } catch (_) { return null; } })(), pause: pauseInfo.reason, memory: memSkips.map(s => s.key), circuits: openCircuits, unknownTransactions: unknownTx });
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

    // 1s cadence. The farm branch calls farmClaimTiming(), which walks the whole
    // FarmTownPlayerRelation collection - pointless against a hidden tab, where
    // nobody can read the countdown. boot.js re-renders on visibilitychange /
    // pageshow, so the first visible frame is correct.
    if (document.hidden) return;
    const fe = panel.querySelector('#gb-next-farms');
    const te = panel.querySelector('#gb-next-towns');
    if (fe) {
      const timing = state.autoFarm ? farmClaimTiming() : null;
      const claimTxt = !state.autoFarm ? 'Aldeas apagadas'
        : (timing && timing.ready > 0 ? `Aldeas: ${timing.ready} listas`
          : (timing && Number.isFinite(timing.nextAt) ? `Aldeas en ${fmtSec(Math.max(0, timing.nextAt - timing.now))}`
            : (timing && timing.expiredModelWait ? 'Aldeas: esperando al juego' : 'Aldeas: —')));
      const scrapeTxt = state.nextFarmScrape
        ? `escaneo en ${fmtSec(Math.max(0, Math.round((state.nextFarmScrape - Date.now()) / 1000)))}`
        : 'escaneo —';
      const t = `${claimTxt} · ${scrapeTxt}`;
      if (t !== _timerFarmLast) { _timerFarmLast = t; fe.textContent = t; }
    }
    if (te) {
      const t = state.nextTownsScrape
        ? `Ciudades en ${fmtSec(Math.max(0, Math.round((state.nextTownsScrape - Date.now()) / 1000)))}`
        : 'Ciudades —';
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
        lines.push('  methods: ' + ((cd.keys && cd.keys.length) ? cd.keys.join(',') : '(ninguno)'));
        lines.push('  attrs: ' + ((cd.attrs && cd.attrs.length) ? cd.attrs.join(',') : '(ninguno)'));
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
        flash('diagnostico copiado');
        gbLog('diag: copied ' + farms.length + ' farms, csrf=' + (state.csrf ? 'yes' : 'NO'));
      };
      const failFlash = () => {
        flash('diagnostico listo — pegalo desde la consola');
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

  ensureHostDefault();
  migrateConfig();
  gbTimeout(clientFingerprintCheck, 10000);
  state.csrf = huntCsrf() || state.csrf;
  if (state.csrf) save(wkey(STORE.CSRF), state.csrf);
  hookFetch();
  hookXhr();
  renderFindings();
  renderWorld();

  gbMenu('GrepBot: copy findings', () => {

    const dump = redactFindingsExport({ findings: state.findings, farms: state.farms });
    navigator.clipboard.writeText(JSON.stringify(dump, null, 2));
  });
  gbMenu('GrepBot: copiar todo (log + datos)', () => { bundleCopy(); });
  gbMenu('GrepBot: guardar todo (.txt)', () => { bundleDownload(); });
  gbMenu('GrepBot: colas', () => { openQueueCenter(); });
  gbMenu('GrepBot: diag', () => { diagRun(); });
  gbMenu('GrepBot: reset panel position', () => { resetPanelGeom(); });
  gbMenu('GrepBot: rescan inbox', () => {
    seenThisRun.clear(); Object.keys(state.seen).forEach(k => delete state.seen[k]);
    seenCount = 0;
    save(STORE.SEEN, state.seen); scrapeInboxDom();
  });
  gbMenu('GrepBot: clear captcha', () => { captchaClear(); flash('captcha limpiado'); });
  gbMenu('GrepBot: clear circuit breakers', () => {
    if (!confirm('Limpiar todos los cortacircuitos de GrepBot? Solo despues de revisar los errores estructurales.')) return;
    circuitClear();
    gbLog('circuit breakers manually cleared');
    flash('cortacircuitos limpiados');
    updateStatus();
  });
  gbMenu('GrepBot: review unknown transactions', () => {
    const unknown = Object.entries(state.txState || {}).filter(([, t]) => t && /^(unknown|manual-review)$/.test(t.state || ''));
    if (!unknown.length) { flash('sin transacciones desconocidas'); return; }
    const sample = unknown.slice(0, 4).map(([k]) => k).join('\n');
    if (!confirm(`Marcar ${unknown.length} transaccion(es) DESCONOCIDA(S) como revisadas manualmente/canceladas?\n\nEsto puede afectarlow the same intent to be attempted again. First verify the game state.\n\n${sample}`)) return;
    txClearUnknown();
    gbLog(`transactions: manually reviewed/aborted ${unknown.length} unknown outcome(s)`);
    flash(`revisadas ${unknown.length} tx desconocidas`);
    updateStatus();
  });
