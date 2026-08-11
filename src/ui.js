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
    const table = tableShell(list, ['id', 'name', 'W', 'S', 'I', 'pop', 'seen', ''], 'farms');
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
      const sort = [f.vill_id, r?.name || '', r?.wood ?? '', r?.stone ?? '', r?.iron ?? '', r?.pop ?? '', r?.ts ?? ''].join('\t');
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
    const pctTxt = (ps && ps.usedPct != null) ? ` \u00b7 ${ps.usedPct}%` : ' \u00b7 -';
    const eta = (ps && ps.etaMs != null) ? ' \u00b7 ' + fmtSec(Math.round(ps.etaMs / 1000)) : ' \u00b7 \u2014';
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
  const TAB_GROUPS = [
    { id: 'home', label: 'Inicio', tabs: [
      { id: 'overview', label: 'Resumen' },
    ]},
    { id: 'economy', label: 'Economía', tabs: [
      { id: 'world', label: 'Ciudades' },
      { id: 'farms', label: 'Aldeas' },
      { id: 'build', label: 'Construcción' },
      { id: 'quests', label: 'Misiones' },
    ]},
    { id: 'military', label: 'Militar', tabs: [
      { id: 'attack', label: 'Ataques' },
      { id: 'intel', label: 'Inteligencia' },
    ]},
    { id: 'data', label: 'Datos', tabs: [
      { id: 'findings', label: 'Hallazgos' },
    ]},
    { id: 'system', label: 'Sistema', tabs: [
      { id: 'config', label: 'Ajustes' },
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
    #grepbot-panel{position:fixed;top:10px;right:10px;width:560px;min-width:430px;max-width:92vw;max-height:82vh;z-index:2147483647;
      background:#181a1f;color:#eef1f5;font:12px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif,"Segoe UI Symbol","Noto Sans Symbols 2","DejaVu Sans";border:1px solid #414650;border-radius:10px;
      box-shadow:0 4px 16px rgba(0,0,0,.5);display:flex;flex-direction:column;visibility:visible !important;opacity:1 !important;
      box-sizing:border-box;}
    #grepbot-panel header{padding:8px 10px;background:#22252b;cursor:move;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-shrink:0;border-radius:10px 10px 0 0}
    #grepbot-panel header b{color:#f5a623;font-weight:600}
    #grepbot-panel header button{background:none;border:1px solid #555;color:#eee;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:11px}
    #grepbot-panel .gb-nav{display:flex;gap:4px;padding:7px 8px 5px;background:#202329;flex-shrink:0;border-bottom:1px solid #353a44;overflow-x:auto}
    #grepbot-panel .gb-nav button{flex:0 0 auto;padding:5px 10px;background:#292d35;border:1px solid transparent;border-radius:7px;color:#aeb5c0;cursor:pointer;font:600 11px system-ui,-apple-system,Segoe UI,sans-serif}
    #grepbot-panel .gb-nav button:hover{color:#ccc}
    #grepbot-panel .gb-nav button.on{color:#fff;background:#3a321f;border-color:#c98b22}
    #grepbot-panel .gb-subtabs{display:flex;gap:4px;padding:5px 8px;background:#17191e;border-bottom:1px solid #353a44;flex-shrink:0;overflow-x:auto}
    #grepbot-panel .gb-subtabs button{flex:0 0 auto;padding:4px 9px;background:transparent;border:1px solid transparent;border-radius:6px;color:#9fa7b3;cursor:pointer;font:11px system-ui,-apple-system,Segoe UI,sans-serif;white-space:nowrap}
    #grepbot-panel .gb-subtabs button:hover{color:#eee;border-color:#555}
    #grepbot-panel .gb-subtabs button.on{background:#2b3038;color:#fff;border-color:#59616f}
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
    #grepbot-panel td.pop-near{color:#fc6}
    #grepbot-panel td.pop-warn{color:#f66;font-weight:bold}
    #grepbot-panel .pop-warn-row{color:#f66;font-weight:bold}
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
    #grepbot-panel .atk-harass button,#grepbot-panel .atk-roles button,#grepbot-panel #gb-atk-src-all,#grepbot-panel #gb-atk-src-none,#grepbot-panel #gb-atk-src-off,#grepbot-panel #gb-atk-src-def,#grepbot-panel #gb-atk-cmds-refresh,#grepbot-panel #gb-atk-heroes-refresh,#grepbot-panel .atk-cmds button,#grepbot-panel .atk-heroes button{background:#333;border:1px solid #555;color:#eee;padding:1px 6px;cursor:pointer;font-size:10px}
    #grepbot-panel .atk-cmds button:disabled,#grepbot-panel .atk-heroes button:disabled{opacity:.45;cursor:not-allowed}
    #grepbot-panel .quest-list{max-height:200px;overflow:auto;font-size:10px}
    #grepbot-panel .quest-row{display:grid;grid-template-columns:1.4fr .5fr 1fr .6fr;gap:4px;border-bottom:1px solid #2a2a2a;padding:3px 0}
    #grepbot-panel .quest-hist{max-height:100px;overflow:auto;font-size:9px;color:#9d9;margin-top:6px;background:#111;padding:4px;border:1px solid #333;white-space:pre-wrap}
    #grepbot-panel .gb-head-main{display:flex;align-items:center;gap:8px;min-width:0}
    #grepbot-panel .gb-head-status{display:flex;gap:4px;align-items:center;flex-wrap:wrap}
    #grepbot-panel .gb-pill{padding:2px 6px;border-radius:999px;font-size:9px;font-weight:700;border:1px solid #444;background:#2b3038;color:#cbd1da}
    #grepbot-panel .gb-pill.ok{border-color:#3c7350;color:#8fe0a8;background:#1c3023}
    #grepbot-panel .gb-pill.warn{border-color:#8a6725;color:#ffd27a;background:#382e1c}
    #grepbot-panel .gb-pill.bad{border-color:#8a3b42;color:#ff9aa3;background:#381f23}
    #grepbot-panel .gb-dashboard-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:6px 0 8px}
    #grepbot-panel .gb-card{background:#22262d;border:1px solid #353b45;border-radius:8px;padding:7px;min-width:0}
    #grepbot-panel .gb-card .k{font-size:9px;color:#8f98a5;text-transform:uppercase;letter-spacing:.04em}
    #grepbot-panel .gb-card .v{font-size:17px;font-weight:700;color:#f5f7fa;line-height:1.2;margin-top:2px}
    #grepbot-panel .gb-card .s{font-size:9px;color:#9ca5b2;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #grepbot-panel .gb-quick{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0 8px}
    #grepbot-panel .gb-quick button,#grepbot-panel .gb-action{background:#2b3038;border:1px solid #4a515d;color:#eef1f5;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:10px}
    #grepbot-panel .gb-quick button:hover,#grepbot-panel .gb-action:hover{border-color:#c98b22}
    #grepbot-panel .gb-section{margin:7px 0;border:1px solid #343943;border-radius:8px;background:#1c1f25;overflow:hidden}
    #grepbot-panel .gb-section>summary{cursor:pointer;list-style:none;padding:7px 9px;font-size:11px;font-weight:700;color:#e8ebef;background:#22262d;display:flex;align-items:center;justify-content:space-between}
    #grepbot-panel .gb-section>summary::-webkit-details-marker{display:none}
    #grepbot-panel .gb-section>summary::after{content:'+';color:#8f98a5;font-size:14px}
    #grepbot-panel .gb-section[open]>summary::after{content:'-'}
    #grepbot-panel .gb-section-body{padding:7px}
    #grepbot-panel pre{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
    @media (max-width:700px){#grepbot-panel{width:94vw;min-width:320px;right:3vw}.gb-dashboard-cards{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
    #grepbot-queue-center{position:fixed;top:90px;left:90px;width:760px;height:560px;min-width:520px;min-height:320px;max-width:94vw;max-height:88vh;z-index:2147483646;background:#17191e;color:#eef1f5;border:1px solid #4a505b;border-radius:10px;box-shadow:0 10px 32px rgba(0,0,0,.6);display:flex;flex-direction:column;resize:both;overflow:hidden;font:12px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
    #grepbot-queue-center header{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#24272e;border-bottom:1px solid #3d424c;cursor:move;flex-shrink:0}
    #grepbot-queue-center header b{color:#f5a623;font-size:13px}#grepbot-queue-center .gb-qc-spacer{flex:1}
    #grepbot-queue-center header select{max-width:210px;background:#11141a;color:#eef1f5;border:1px solid #4b5260;border-radius:5px;padding:4px 7px}
    #grepbot-queue-center header button,#grepbot-queue-center .gb-qc-btn{background:#2d323b;color:#e9edf2;border:1px solid #4f5764;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:11px}
    #grepbot-queue-center header button:hover,#grepbot-queue-center .gb-qc-btn:hover{background:#39404b;border-color:#707a89}#grepbot-queue-center button:disabled{opacity:.35;cursor:default}
    #grepbot-queue-center nav{display:flex;gap:5px;padding:7px 9px;background:#1d2026;border-bottom:1px solid #353a44;flex-shrink:0}
    #grepbot-queue-center .gb-qc-tab{padding:6px 12px;background:#272b33;color:#aeb5c0;border:1px solid transparent;border-radius:7px;cursor:pointer;font-weight:600}
    #grepbot-queue-center .gb-qc-tab.on{background:#3a321f;color:#fff;border-color:#c98b22}
    #grepbot-queue-center .gb-qc-body{padding:10px;flex:1 1 0;min-height:0;height:0;overflow-y:scroll;overflow-x:hidden;scrollbar-gutter:stable;scrollbar-width:auto;scrollbar-color:#5f6978 #17191e;overscroll-behavior:contain;display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:max-content;gap:10px;align-content:start}
    #grepbot-queue-center .gb-qc-body::-webkit-scrollbar{width:10px}
    #grepbot-queue-center .gb-qc-body::-webkit-scrollbar-track{background:#17191e;border-left:1px solid #2e333c}
    #grepbot-queue-center .gb-qc-body::-webkit-scrollbar-thumb{background:#4f5764;border:2px solid #17191e;border-radius:8px}
    #grepbot-queue-center .gb-qc-body::-webkit-scrollbar-thumb:hover{background:#6a7484}
    #grepbot-queue-center .gb-qc-card{background:#20232a;border:1px solid #383e48;border-radius:8px;overflow:hidden;min-width:0;align-self:start;height:max-content}
    #grepbot-queue-center .gb-qc-card-head{display:flex;gap:8px;align-items:center;padding:8px 9px;background:#272b33;border-bottom:1px solid #383e48}#grepbot-queue-center .gb-qc-card-head>div:first-child{display:flex;flex-direction:column;flex:1;min-width:0}#grepbot-queue-center .gb-qc-card-head small{color:#89919d;font-size:10px}
    #grepbot-queue-center .gb-qc-live-row,#grepbot-queue-center .gb-qc-plan-row,#grepbot-queue-center .gb-qc-job{display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px 9px;border-top:1px solid rgba(255,255,255,.05)}
    #grepbot-queue-center .gb-qc-job-desc{display:flex;flex-direction:column;min-width:0}.gb-qc-job-desc>span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #grepbot-queue-center .gb-qc-acts{display:flex;gap:3px}.gb-qc-btn.danger{color:#ffb0a8}.gb-qc-empty{padding:16px 10px;color:#828a95;text-align:center}
    #grepbot-queue-center .gb-qc-picker{display:flex;gap:6px;align-items:center;padding:8px 9px;border-top:1px solid rgba(255,255,255,.05);background:#1b1e24}
    #grepbot-queue-center .gb-qc-pick{flex:1;min-width:0;background:#20232a;color:#eef1f5;border:1px solid #454c58;border-radius:5px;padding:3px 5px;font-size:11px}
    #grepbot-queue-center .gb-qc-sequence{padding:8px 9px 9px;border-top:1px solid rgba(255,255,255,.05);background:#1b1e24}
    #grepbot-queue-center .gb-qc-sequence-title{display:block;margin-bottom:6px;color:#f5c36a;font-size:10px;text-transform:uppercase;letter-spacing:.35px}
    #grepbot-queue-center .gb-qc-sequence-line{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
    #grepbot-queue-center .gb-qc-sequence-chip{padding:3px 6px;border-radius:5px;background:#2b3038;border:1px solid #454c58;color:#eef1f5;font-size:10px;white-space:nowrap}
    #grepbot-queue-center .gb-qc-sequence-arrow{color:#757f8c;font-weight:bold}
    #grepbot-queue-center .gb-qc-status{font-size:9px;color:#aab2bd}.gb-qc-status.ready{color:#7ddd96}.gb-qc-status.blocked,.gb-qc-status.unknown{color:#ff9e94}.gb-qc-status.paused{color:#ffd27a}.gb-qc-status.waiting-resources,.gb-qc-status.waiting-population,.gb-qc-status.waiting-queue,.gb-qc-status.waiting-requirement{color:#e5bf70}.gb-qc-muted{color:#929aa5;font-size:10px}
    @media(max-width:760px){#grepbot-queue-center{left:2vw!important;top:4vh!important;width:96vw!important;height:80vh!important}#grepbot-queue-center .gb-qc-body{grid-template-columns:1fr}}
  `);

  panel = document.createElement('div');
  panel.id = 'grepbot-panel';

  document.querySelectorAll('#grepbot-panel').forEach(p => { try { p.remove(); } catch (_) {} });
  panel.style.zIndex = '2147483647';
  panel.innerHTML = `
    <header><div class="gb-head-main"><b>GrepBot v${runningVersion()}</b><div class="gb-head-status"><span id="gb-head-mode" class="gb-pill">...</span><span id="gb-head-health" class="gb-pill">...</span></div></div><div style="display:flex;gap:4px"><button data-act="queues" title="Abrir centro de colas">Colas</button><button data-act="toggle" title="Minimizar">_</button></div></header>
    <div class="gb-nav" role="tablist" aria-label="GrepBot groups"></div>
    <div class="gb-subtabs" role="tablist" aria-label="GrepBot tabs"></div>
    <section data-tab="findings"></section>
    <section data-tab="farms" hidden>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
        <button id="gb-sleep-claim" style="background:#333;border:1px solid #555;color:#8cf;padding:2px 8px;cursor:pointer;font-size:11px">Sleep claim (4h/8h)</button>
        <span id="gb-sleep-status" style="font-size:10px;color:#888"></span>
      </div>
      <div id="gb-farm-teach-banner" hidden style="font-size:10px;color:#fc6;background:#2a2211;border:1px solid #664;padding:4px 6px;margin-bottom:4px;border-radius:3px"></div>
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
        <label>target <input data-atk="target" style="width:70px" placeholder="town id"/></label>
        <select data-atk="target-type" title="Generic sender only supports canonical town targets"><option value="town">ciudad</option></select>
        <select data-atk="pick" title="Known town targets from reports/history" style="max-width:150px"></select>
        <label>x <input data-atk="x" style="width:40px"/></label>
        <label>y <input data-atk="y" style="width:40px"/></label>
        <select data-atk="mission"><option value="attack">ataque</option><option value="support">apoyo</option><option value="revolt">revolt</option></select>
      </div>
      <div id="gb-atk-target-hint" style="font-size:9px;color:#888;margin:-2px 0 4px"></div>
      <div class="atk-row">
        <select data-atk="timing"><option value="send_now">enviar ya</option><option value="arrive_at">llegar a las</option></select>
        <input data-atk="arrival" type="datetime-local" step="1" title="arrival (local)"/>
        <label>pad ms <input data-atk="pad" type="number" style="width:50px" value="200"/></label>
      </div>
      <div class="atk-row">
        <select data-atk="troop">
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
        <button type="button" data-harass="1sling">1 honda</button>
        <button type="button" data-harass="5sling">5 hondas</button>
        <button type="button" data-harass="light">&le;8 ligeras</button>
      </div>
      <div style="font-size:9px;color:#888;margin-top:2px">roles de ciudad (guardado por mundo)</div>
      <div class="atk-roles"></div>
      <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-top:4px">
        <span style="font-size:9px;color:#888">atacar desde</span>
        <button type="button" id="gb-atk-src-all">Todo</button>
        <button type="button" id="gb-atk-src-none">Ninguno</button>
        <button type="button" id="gb-atk-src-off">Ofensiva</button>
        <button type="button" id="gb-atk-src-def">Defense</button>
      </div>
      <div class="atk-sources"></div>
      <div class="atk-pertown" hidden></div>
      <div class="atk-btns" style="margin-top:6px">
        <button id="gb-atk-preview">Previsualizar</button>
        <button id="gb-atk-arm">Armar</button>
        <button id="gb-atk-cancel">Cancelar</button>
        <button id="gb-atk-now">Enviar ya</button>
      </div>
      <div class="atk-sched"></div>
      <div style="border-top:1px solid #333;margin:8px 0 4px;padding-top:6px;display:flex;align-items:center;gap:6px">
        <b style="font-size:11px;color:#f5a623">Enviados / cancelar</b>
        <button type="button" id="gb-atk-cmds-refresh" style="margin-left:auto">Refrescar</button>
      </div>
      <div class="atk-cmds" style="max-height:120px;overflow:auto"></div>
      <div style="border-top:1px solid #333;margin:8px 0 4px;padding-top:6px;display:flex;align-items:center;gap:6px">
        <b style="font-size:11px;color:#f5a623">Heroes</b>
        <button type="button" id="gb-atk-heroes-refresh" style="margin-left:auto">Refrescar</button>
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
        <span id="gb-ib-dot" class="ib-dot"></span><b style="font-size:11px;color:#f5a623">Construccion instantanea</b>
        <span style="flex:1"></span>
        <button id="gb-ib-btn">Complete all free</button>
      </div>
      <div class="ib-rows"></div>
      <div id="gb-ib-status" style="font-size:10px;color:#888;margin-top:4px"></div>
      <div style="border-top:1px solid #333;margin:8px 0 6px;padding-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <b style="font-size:11px;color:#f5a623">Auto-cola</b>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:10px"><input type="checkbox" id="gb-ab-auto"/> ON</label>
        <button id="gb-ab-csfast" style="background:#333;border:1px solid #555;color:#6cf;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px">Cargar CS-fast</button>
        <button id="gb-ab-now" style="background:#333;border:1px solid #555;color:#80e090;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px">Enviar cola ya</button>
      </div>
      <div style="font-size:9px;color:#888;margin-bottom:4px">Las colas creadas con + en el Senado son FIFO estrictas por ciudad. Se rellena cada hueco real libre, nivel a nivel, revalidando coste y requisitos. Las ciudades sin cola FIFO siguen usando cur/tgt/max.</div>
      <div class="ab-queue"></div>
      <div id="gb-ab-status" style="font-size:10px;color:#888;margin-top:4px"></div>
    </section>
    <section data-tab="overview" hidden>
      <div style="font-size:15px;font-weight:750;margin-bottom:2px">Resumen de la cuenta</div>
      <div style="font-size:10px;color:#939ba7;margin-bottom:4px">Estado, próximas acciones y bloqueos importantes sin entrar en configuración avanzada.</div>
      <div class="gb-dashboard-cards"></div>
      <div class="gb-quick">
        <button id="gb-quick-safe">MODO SEGURO</button>
        <button id="gb-quick-preflight">Comprobar sistema</button>
        <button id="gb-quick-sim">Simular 24 h</button>
        <button id="gb-quick-config">Ajustes</button>
      </div>
      <div class="dashboard-summary" style="font-size:10px;color:#aab2bd;margin-bottom:4px"></div>
      <details class="gb-section" open><summary>Próximas acciones</summary><div class="gb-section-body"><pre class="timeline-panel" style="font-size:10px;white-space:pre-wrap;margin:0;max-height:150px;overflow:auto"></pre></div></details>
      <details class="gb-section"><summary>Estado operativo</summary><div class="gb-section-body"><pre class="overview-panel" style="font-size:10px;white-space:pre-wrap;margin:0;max-height:180px;overflow:auto;color:#cfd6df"></pre></div></details>
      <details class="gb-section" open><summary>Objetivos y cola por ciudad</summary><div class="gb-section-body"><div class="goals-panel" style="font-size:10px;max-height:300px;overflow:auto"></div></div></details>
      <details class="gb-section"><summary>Recursos y reservas</summary><div class="gb-section-body"><div class="planner-controls" style="font-size:10px;display:flex;gap:5px;flex-wrap:wrap;align-items:center"></div><div class="planner-panel" style="font-size:10px;max-height:240px;overflow:auto;margin-top:6px"></div></div></details>
      <details class="gb-section"><summary>Simulación y motivos</summary><div class="gb-section-body"><div style="display:flex;gap:5px;align-items:center;margin-bottom:5px"><label>Horizonte <input id="gb-sim-hours" type="number" min="1" max="168" value="24" style="width:55px;background:#111;color:#cfc;border:1px solid #444;border-radius:4px;padding:3px"/> h</label><button id="gb-sim-run" class="gb-action">Simular</button></div><pre class="sim-panel" style="font-size:10px;white-space:pre-wrap;margin:0 0 6px;max-height:160px;overflow:auto"></pre><pre class="why-panel" style="font-size:10px;white-space:pre-wrap;margin:0;max-height:130px;overflow:auto;color:#bbb"></pre></div></details>
      <details class="gb-section"><summary>Salud del sistema</summary><div class="gb-section-body"><div class="health-panel" style="font-size:10px;max-height:220px;overflow:auto"></div></div></details>
      <details class="gb-section"><summary>Plantillas y copia de seguridad</summary><div class="gb-section-body"><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><input id="gb-tpl-name" placeholder="nombre de plantilla" style="width:130px;background:#111;color:#cfc;border:1px solid #444;border-radius:4px;padding:4px;font-size:11px"/><button id="gb-tpl-save" class="gb-action">Guardar plantilla</button><button id="gb-tpl-apply" class="gb-action">Aplicar plantilla</button><button id="gb-cfg-export" class="gb-action">Exportar configuración</button><button id="gb-cfg-import" class="gb-action">Importar configuración</button></div></div></details>
    </section>
    <section data-tab="intel" hidden>
      <div style="font-size:11px;color:#f5a623;margin-bottom:4px">Intel / amenazas</div>
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
        <input id="gb-note-player" placeholder="player" style="width:80px;background:#111;color:#cfc;border:1px solid #333;font-size:11px"/>
        <input id="gb-note-text" placeholder="note" style="flex:1;background:#111;color:#cfc;border:1px solid #333;font-size:11px"/>
        <button id="gb-note-save" style="background:#333;border:1px solid #555;color:#eee;padding:2px 6px;cursor:pointer;font-size:10px">Guardar nota</button>
      </div>
      <div style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <input id="gb-anote-ally" placeholder="alianza" style="width:80px;background:#111;color:#cfc;border:1px solid #333;font-size:11px"/>
        <input id="gb-anote-text" placeholder="nota de alianza" style="flex:1;background:#111;color:#cfc;border:1px solid #333;font-size:11px"/>
        <button id="gb-anote-save" style="background:#333;border:1px solid #555;color:#eee;padding:2px 6px;cursor:pointer;font-size:10px">Guardar nota de alianza</button>
      </div>
    </section>
    <section data-tab="config" hidden>
      <div class="config-panel" style="font-size:11px;display:flex;flex-direction:column;gap:8px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="enabled-host"/> Enable on <span class="cfg-host"></span></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#fc6"><input type="checkbox" data-cfg="safe-mode"/> SAFE MODE (block premium/attacks/favor/killpoints/donations)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-collect"/> Auto-collect visible resource rewards</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px"><input type="checkbox" data-cfg="collect-all"/> Recolect all (ignore timer cap)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-bandit"/> Auto-bandit</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-farm"/> Auto-farm</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px"><input type="checkbox" data-cfg="farm-skip-full"/> Skip farm/bandit if warehouse full</label>
        <label style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-wrap:wrap">Warehouse full mode
          <select data-cfg="farm-full-mode" style="background:#111;color:#cfc;border:1px solid #333;margin-left:6px">
            <option value="any">cualquier recurso lleno</option>
            <option value="all">los 3 recursos llenos</option>
          </select>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px"><input type="checkbox" data-cfg="farm-long-claims"/> 10min claims where villager loyalty researched</label>
        <label style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-wrap:wrap">Loyalty tech key
          <input data-cfg="farm-loyalty-tech" placeholder="auto-detect (server id or label)" title="Server research id (e.g. rural_loyalty) or the localized academy name. Log tab dumps id(label) pairs when auto-detect misses." style="width:190px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/>
        </label>
        <label style="display:flex;align-items:center;gap:6px;margin-left:12px;flex-wrap:wrap">Sleep claim length
          <select data-cfg="farm-sleep-dur" style="background:#111;color:#cfc;border:1px solid #333;margin-left:6px">
            <option value="auto">auto (8h si se sabe, si no 4h)</option>
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
        <div style="border-top:1px solid #333;padding-top:6px;color:#f5a623;font-size:10px">Fase 8+ economia</div>
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
            <option value="smart">predictivo inteligente</option>
            <option value="storage">almacen</option>
            <option value="party">fiesta (sin implementar)</option>
            <option value="unit">unidades (sin implementar)</option>
          </select>
          Reserve % <input type="number" data-cfg="trade-reserve" min="0" max="80" style="width:45px;background:#111;color:#cfc;border:1px solid #333"/>
          Min batch <input type="number" data-cfg="trade-min" min="100" max="50000" step="100" style="width:60px;background:#111;color:#cfc;border:1px solid #333"/>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="island-ship"/> Mainland→island res ship</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#f96" title="ALTO RIESGO: mueve recursos entre tus ciudades sin vuelta atras. Equilibra segun el sesgo 'resource' del perfil de cada ciudad. Pruebalo con Simulacion antes de activarlo."><input type="checkbox" data-cfg="auto-transport"/> Auto transporte inter-ciudad</label>
        <label style="margin-left:12px;flex-wrap:wrap">Reserve % <input type="number" data-cfg="transport-reserve" min="0" max="80" style="width:45px;background:#111;color:#cfc;border:1px solid #333"/>
          Min batch <input type="number" data-cfg="transport-min" min="100" max="10000" step="100" style="width:60px;background:#111;color:#cfc;border:1px solid #333"/>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-rural-trade"/> Rural village trade</label>
        <label style="margin-left:12px;flex-wrap:wrap">Min ratio <input type="number" data-cfg="rural-ratio" step="0.25" min="0.25" max="2" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/>
          Res <select data-cfg="rural-res" style="background:#111;color:#cfc;border:1px solid #333"><option value="iron">plata</option><option value="stone">piedra</option><option value="wood">madera</option></select>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-rural-level"/> Farm village upgrade</label>
        <label style="margin-left:12px">Max level <input type="number" data-cfg="rural-level-max" min="1" max="6" style="width:40px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-research"/> Auto-research</label>
        <button data-cfg="research-csfast" style="align-self:flex-start;margin-left:12px;background:#333;border:1px solid #555;color:#6cf;padding:2px 6px;cursor:pointer;font-size:10px">Cargar CS-fast de investigacion</button>
        <div style="border-top:1px solid #333;padding-top:6px;color:#f5a623;font-size:10px">QoL / survival</div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="pause-activity"/> Pause when I am active</label>
        <label style="margin-left:12px">Pause min <input type="number" data-cfg="pause-ms" min="1" max="60" style="width:40px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="night-pause"/> Night pause</label>
        <label style="margin-left:12px">Hours <input type="number" data-cfg="night-start" min="0" max="23" style="width:40px;background:#111;color:#cfc;border:1px solid #333"/>–<input type="number" data-cfg="night-end" min="0" max="23" style="width:40px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Log every payload the bot would send and send nothing. Use it to compare bot payloads against a hand-clicked action before enabling a risky feature."><input type="checkbox" data-cfg="dry-run"/> <b style="color:#6cf">Simulacion (registra payloads, no envia nada)</b></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="A feature that keeps finding nothing to do doubles its own interval (up to 8x) until it acts again."><input type="checkbox" data-cfg="orch-adaptive"/> Adaptive cadence (back off idle features)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Si un almacen se llena y la recoleccion deja de rendir, cueva/comercio/aldeas pasan por delante de la recoleccion y no se les aplica el frenado por inactividad. Solo cambia el ORDEN, nunca el presupuesto."><input type="checkbox" data-cfg="orch-deadlock"/> Resolver atasco de almacen (prioriza vaciado)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Copy/Export replace player names and ids with short hashes. Turn OFF only for local debugging."><input type="checkbox" data-cfg="export-redact"/> Redact names/ids in Copy + Export</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="captcha-global"/> Global captcha kill-switch</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Skip an action that failed the same way 3x in a row (5/15/60min backoff). Journal keeps recording either way."><input type="checkbox" data-cfg="decision-memory"/> Decision memory (skip repeat failures)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Anade a la pestana Intel el resumen de batallas por jugador y el ranking de granjas por botin. Solo lectura, se recalcula en cada render."><input type="checkbox" data-cfg="intel-battle-stats"/> Estadisticas de batalla en Intel</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Muestra en Colas > Construccion una secuencia aconsejada. Solo consejo: la cola FIFO manda y nada se envia sin pulsar el boton."><input type="checkbox" data-cfg="ab-optimal-order"/> Secuencia optima de construccion (consejo)</label>
        <label>Req budget / min <input type="number" data-cfg="req-budget" min="5" max="120" style="width:50px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/></label>
        <label>Webhook URL <input type="text" data-cfg="webhook-url" placeholder="Discord webhook or https://api.telegram.org/bot…/sendMessage" style="width:100%;background:#111;color:#cfc;border:1px solid #333;margin-top:2px;font-size:10px"/></label>
        <label style="margin-left:0;display:flex;gap:8px;flex-wrap:wrap;font-size:10px">Events
          <label><input type="checkbox" data-cfg="wh-captcha"/> captcha</label>
          <label><input type="checkbox" data-cfg="wh-attack"/> attack</label>
          <label><input type="checkbox" data-cfg="wh-warehouse"/> warehouse</label>
          <label><input type="checkbox" data-cfg="wh-culture"/> culture</label>
          <label title="Aviso ~10 min antes de que un almacen llegue al limite."><input type="checkbox" data-cfg="wh-capping"/> Pre-aviso de almacen (~10 min)</label>
        </label>
        <label>Telegram chat_id <input type="text" data-cfg="wh-tg-chat" placeholder="optional if not in URL" style="width:140px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px;font-size:10px"/></label>
        <div style="border-top:1px solid #333;padding-top:6px;color:#f96;font-size:10px">ALTO RIESGO (por defecto OFF)</div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-merchant"/> Merchant sniper</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Las ofertas de recursos del barco mercante empiezan en 0.5:1 y suben +0.1 por trato. Bombea con tratos de 1 unidad y luego envia el trato grande a 1:1."><input type="checkbox" data-cfg="auto-pt-trade"/> Bombeo del ratio del barco mercante</label>
        <label style="margin-left:12px;font-size:10px">ratio objetivo <input type="number" step="0.1" min="0.5" max="2" data-cfg="pt-ratio" style="width:52px;background:#111;color:#cfc;border:1px solid #333"/>
          cantidad de bombeo <input type="number" min="1" max="100" data-cfg="pt-pump" style="width:52px;background:#111;color:#cfc;border:1px solid #333"/>
          bombeos max. <input type="number" min="0" max="20" data-cfg="pt-maxpumps" style="width:52px;background:#111;color:#cfc;border:1px solid #333"/>
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
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-favor" disabled/> Favor farm (disabled: unsafe target path)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-wonder"/> WW donations</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Gasta favor en la maravilla de la alianza. Requiere haber capturado wonderFavorTpl. Por defecto OFF."><input type="checkbox" data-cfg="auto-wonder-favor"/> Lanzar favor en la Maravilla (captura el poder antes)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="cs-alert"/> CS / incoming alerts</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-militia"/> Auto-militia on incoming</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-dodge"/> Auto-dodge</label>
        <label style="margin-left:12px">Defense mode <select data-cfg="defense-mode" style="background:#111;color:#cfc;border:1px solid #333"><option value="notify">avisar</option><option value="safe">esquiva segura</option><option value="smart">smart</option></select> <label><input type="checkbox" data-cfg="defense-smart-auto"/> smart auto</label> check return +<input type="number" data-cfg="defense-return-margin" min="0" max="3600" style="width:55px;background:#111;color:#cfc;border:1px solid #333"/>s (manual if support arrived) · leave <input type="number" data-cfg="dodge-floor" min="0" max="500" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="auto-recruit"/> Auto-recruit</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px"><input type="checkbox" data-cfg="recruit-spells"/> Cast recruit spells first</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:12px;color:#f96" title="Convierte aldeanos en unidades cuando la aldea no admite mas recursos. Recompute: compara espada+arquero vs hoplita+hondero, elige la pareja con mas tropas y dentro de ella la unidad con menos. Requiere abrir la aldea y pulsar Aceptar una vez a mano la primera vez."><input type="checkbox" data-cfg="village-recruit"/> Reclutar en aldeas saturadas</label>
        <label style="margin-left:24px;display:flex;gap:8px;flex-wrap:wrap;font-size:10px">% llenado aldea
          <input type="number" data-cfg="village-recruit-fill" min="50" max="99" style="width:50px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/>
          cantidad por tick
          <input type="number" data-cfg="village-recruit-amount" min="1" max="20" style="width:50px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-cfg="grepodata"/> Grepodata Index+ assist</label>
        <label>IB free threshold (sec, safety cap 290) <input type="number" data-cfg="ib-free-thresh" min="60" max="300" style="width:70px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/></label>
        <label>Collect max min <input type="number" data-cfg="collect-max-min" min="1" max="120" style="width:70px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/></label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer" title="Lee los recursos de cada aldea por HTTP. Solo funciona en mundos cuyo cliente responde a una accion farm_town_*. Si no, cada barrido gasta el presupuesto de peticiones sin devolver nada y se apaga solo."><input type="checkbox" data-cfg="farm-scrape"/> Escanear recursos de aldeas (HTTP)</label>
        <label>Farm cadence min-max (min) <input type="number" data-cfg="farm-min" min="1" max="60" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/> - <input type="number" data-cfg="farm-max" min="1" max="60" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label>Town cadence min-max (min) <input type="number" data-cfg="town-min" min="1" max="60" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/> - <input type="number" data-cfg="town-max" min="1" max="60" style="width:50px;background:#111;color:#cfc;border:1px solid #333"/></label>
        <label title="Minutos de pausa tras el 1er, 2o, 3er... captcha del mismo modulo. Lista separada por comas, de 1 a 1440. Vacio = 5,15,60.">Escalera de captcha (min) <input type="text" data-cfg="captcha-ladder" placeholder="5,15,60" style="width:110px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/></label>
        <label title="Por debajo del presupuesto duro: al pasar este % los envios se retrasan en vez de descartarse. 60 = empieza a frenar en el 60% de las peticiones/min.">Freno suave de envios (% del presupuesto) <input type="number" data-cfg="posts-soft-pct" min="10" max="100" style="width:60px;background:#111;color:#cfc;border:1px solid #333;margin-left:6px"/></label>
        <button data-cfg="clear-captcha" style="align-self:flex-start;background:#333;border:1px solid #555;color:#f96;padding:3px 8px;cursor:pointer;font-size:11px">Limpiar cortacircuitos de captcha</button>
      </div>
    </section>
    <section data-tab="stats" hidden>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
        <b style="font-size:11px;color:#f5a623">Estadisticas</b>
        <button data-stats="1h" style="background:#262626;border:1px solid #333;color:#aaa;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">1h</button>
        <button data-stats="24h" class="on" style="background:#333;border:1px solid #555;color:#fff;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">24h</button>
        <button data-stats="7d" style="background:#262626;border:1px solid #333;color:#aaa;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">7d</button>
        <span style="flex:1"></span>
        <button id="gb-preflight" title="Read-only probe of every module: collections, learned action keys, would-be payloads. Sends nothing." style="background:#333;border:1px solid #555;color:#6cf;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px">Comprobar sistema</button>
      </div>
      <pre class="stats-body" style="font-size:10px;white-space:pre-wrap;background:#111;padding:6px;border:1px solid #333;max-height:320px;overflow:auto;color:#cfc"></pre>
    </section>
    <section data-tab="log" hidden>
      <div class="gb-logsub">
        <button data-logsub="live" class="on">Registro en vivo</button>
        <button data-logsub="mem">Decisiones</button>
        <input class="jrn-filter" placeholder="filter feature/action/target"/>
      </div>
      <div class="log-list"></div>
      <div class="jrn-pane" hidden>
        <div class="jrn-head"></div>
        <div class="jrn-list"></div>
        <div class="jrn-btns">
          <button data-jrn="copy">Copiar JSON</button>
          <button data-jrn="clear-skips">Limpiar saltos</button>
          <button data-jrn="clear">Limpiar bitacora</button>
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
        <summary>Acciones</summary>
        <div class="gb-actions-menu">
          <button type="button" data-act="panic" style="color:#f66;font-weight:bold" title="Parada de emergencia: pausa toda la automatizacion, fuerza Simulacion y libera los bloqueos. No envia nada.">⚠ PÁNICO</button>
          <button type="button" data-act="panic-recover" disabled title="Disponible 30 s despues del panico. Limpia las ventanas de salto y reanuda. Simulacion sigue ON.">Reanudar (limpiar saltos)</button>
          <button type="button" data-act="copy">Copiar JSON</button>
          <button type="button" data-act="export">Exportar</button>
          <button type="button" data-act="refresh">Refrescar ciudades</button>
          <button type="button" data-act="scrape-farms">Granjas ahora</button>
          <button type="button" data-act="scrape-towns">Ciudades ahora</button>
          <button type="button" data-act="diag">Diagnostico</button>
          <button type="button" data-act="preflight">Comprobar sistema</button>
          <button type="button" data-act="evidence" title="Instantanea de solo lectura y anonimizada para las validaciones de TASKS. Copia JSON. No envia nada.">Evidencia</button>
          <button type="button" data-act="clear">Limpiar hallazgos</button>
          <button type="button" data-act="reset-pos" title="Reset panel position">Restablecer posicion</button>
          <button type="button" data-act="preset-afk" title="Activa granjas, cueva, construccion e investigacion con cadencia lenta y presupuesto bajo. Todo HIGH-RISK queda OFF.">Perfil: AFK nocturno</button>
          <button type="button" data-act="preset-farming" title="Cadencia corta, banda y cueva, todo economico, culture OFF.">Perfil: recoleccion activa</button>
          <button type="button" data-act="preset-war" title="Construccion, dodge notify, sin cultura ni investigacion. HIGH-RISK forzado a OFF.">Perfil: guerra</button>
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

  {
    const start = TAB_IDS.includes(state.activeTab) ? state.activeTab : 'findings';
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
  panel.querySelector('[data-jrn=copy]')?.addEventListener('click', () => {
    const text = JSON.stringify({ decisions: state.decisions, skips: state.decisionSkips }, null, 2);
    navigator.clipboard.writeText(text).then(() => flash('bitacora copiada')).catch(() => flash('fallo al copiar'));
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
  panel.querySelector('#gb-sim-run')?.addEventListener('click',()=>{const h=Math.max(1,+panel.querySelector('#gb-sim-hours')?.value||24);dashboardSimulation=simulateAccount(h);state.simCfg.horizonHours=h;save(STORE.SIM_CFG,state.simCfg);renderDashboard();});
  panel.querySelector('#gb-cfg-export')?.addEventListener('click', () => {
    const text = JSON.stringify(qolRedactConfigDump(qolExportConfig()), null, 2);
    navigator.clipboard.writeText(text).then(() => flash('configuracion copiada')).catch(() => flash('fallo al copiar'));
  });
  panel.querySelector('#gb-cfg-import')?.addEventListener('click', () => {
    const raw = prompt('Pegar JSON de la config de GrepBot');
    if (!raw) return;
    try {
      if (qolImportConfig(JSON.parse(raw))) flash('configuracion importada');
      else flash('importacion fallida');
    } catch (e) { flash('JSON invalido'); }
  });
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
      const acoll = sec.querySelector('[data-cfg=auto-collect]'); if (acoll) acoll.checked = !!state.autoCollect;
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
    setNum('[data-cfg=posts-soft-pct]', state.postsPerMinSoftPct != null ? state.postsPerMinSoftPct : 60);
    const cl = sec.querySelector('[data-cfg=captcha-ladder]');
    if (cl) cl.value = (Array.isArray(state.captchaLadder) && state.captchaLadder.length ? state.captchaLadder : [5, 15, 60]).join(',');
    sec.querySelector('[data-cfg=safe-mode]')?.addEventListener('change',e=>{state.safeMode=!!e.target.checked;save(STORE.SAFE_MODE,state.safeMode);gbLog('safeMode',state.safeMode);updateStatus();});
    sec.querySelector('[data-cfg=enabled-host]')?.addEventListener('change', e => {
      state.enabledHosts[location.host] = e.target.checked;
      save(STORE.ENABLED_HOSTS, state.enabledHosts);
      flash(e.target.checked ? 'enabled on ' + location.host : 'disabled on ' + location.host);
    });
    sec.querySelector('[data-cfg=auto-collect]')?.addEventListener('change', e => {
      state.autoCollect = e.target.checked; save(STORE.AUTO_COLLECT, state.autoCollect);
      gbLog('auto-collect', state.autoCollect ? 'ON' : 'OFF');
      if (state.autoCollect) autoCollectResources();
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
      if (state.autoFarm) { autoClaimFarms('toggle'); farmScheduleClaimWake(null, 'toggle', true); }
      else farmCancelClaimWake();
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
    sec.querySelector('[data-cfg=farm-scrape]')?.addEventListener('change', e => {
      state.farmScrape = e.target.checked; save(STORE.FARM_SCRAPE, state.farmScrape);
      if (state.farmScrape) farmScrapeRevive('config ON');
      else farmScrapeClearErrors();
      gbLog('farm resource scrape', state.farmScrape ? 'ON' : 'OFF');
      updateStatus();
    });
    sec.querySelector('[data-cfg=farm-loyalty-tech]')?.addEventListener('change', e => {
      state.farmLoyaltyTech = String(e.target.value || '').trim();
      save(wkey(STORE.FARM_LOYALTY_TECH), state.farmLoyaltyTech);
      farmLoyaltyReset();
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
    setChk('[data-cfg=auto-transport]', state.autoTransport);
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
    setChk('[data-cfg=auto-wonder-favor]', !!state.autoWonderFavor);
    setChk('[data-cfg=auto-favor]', state.autoFavor);
    setChk('[data-cfg=auto-wonder]', state.autoWonder);
    setChk('[data-cfg=cs-alert]', state.csAlert !== false);
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
    const defense=state.defenseCfg||{mode:'notify',smartAuto:false,returnMarginSec:120};
    const dm=sec.querySelector('[data-cfg=defense-mode]');if(dm)dm.value=defenseMode();
    setChk('[data-cfg=defense-smart-auto]',!!defense.smartAuto);
    setNum('[data-cfg=defense-return-margin]',Math.max(0,+defense.returnMarginSec||120));
    const wh = sec.querySelector('[data-cfg=webhook-url]'); if (wh) wh.value = state.webhookUrl || '';
    const we = state.webhookEvents || {};
    setChk('[data-cfg=wh-captcha]', we.captcha !== false);
    setChk('[data-cfg=wh-attack]', we.attack !== false);
    setChk('[data-cfg=wh-warehouse]', !!we.warehouse);
    setChk('[data-cfg=wh-culture]', !!we.culture);
    setChk('[data-cfg=wh-capping]', !!we.cappingPreWarn);
    const tg = sec.querySelector('[data-cfg=wh-tg-chat]'); if (tg) tg.value = we.telegramChatId || '';
    const tp = sec.querySelector('[data-cfg=trade-preset]'); if (tp) tp.value = state.tradePreset || 'storage';
    setNum('[data-cfg=trade-reserve]', state.tradeReservePct);
    setNum('[data-cfg=trade-min]', state.tradeMinBatch);
    setNum('[data-cfg=transport-reserve]', state.transportReserve);
    setNum('[data-cfg=transport-min]', state.transportMin);
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
    bindToggle('[data-cfg=auto-transport]', 'autoTransport', STORE.AUTO_TRANSPORT, () => tradeScan('toggle'));
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
    sec.querySelector('[data-cfg=dry-run]')?.addEventListener('change', e => {
      state.dryRun = e.target.checked; save(STORE.DRY_RUN, state.dryRun);
      gbLog('DRY RUN ' + (state.dryRun ? 'ON - payloads logged, nothing sent' : 'OFF - posts go to the server'));
      flash(state.dryRun ? 'dry run ON' : 'dry run OFF');
      updateStatus();
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
      if (!confirm('Bombear el ratio del barco mercante y enviar ahora el trato grande?')) return;
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
    bindToggle('[data-cfg=village-recruit]', 'autoVillageRecruit', STORE.AUTO_VILLAGE_RECRUIT, () => villageRecruitScan('toggle'));
    saveNum('[data-cfg=village-recruit-fill]', v => {
      state.villageRecruitFillPct = Math.min(99, Math.max(50, v || 90));
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
    sec.querySelector('[data-cfg=defense-mode]')?.addEventListener('change',e=>{state.defenseCfg=Object.assign({},state.defenseCfg,{mode:['notify','safe','smart'].includes(e.target.value)?e.target.value:'notify'});save(STORE.DEFENSE_CFG,state.defenseCfg)});
    sec.querySelector('[data-cfg=defense-smart-auto]')?.addEventListener('change',e=>{state.defenseCfg=Object.assign({},state.defenseCfg,{smartAuto:!!e.target.checked});save(STORE.DEFENSE_CFG,state.defenseCfg)});
    saveNum('[data-cfg=defense-return-margin]',v=>{state.defenseCfg=Object.assign({},state.defenseCfg,{returnMarginSec:Math.max(0,Math.min(3600,+v||0))});save(STORE.DEFENSE_CFG,state.defenseCfg)});
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
        cappingPreWarn: !!sec.querySelector('[data-cfg=wh-capping]')?.checked,
        telegramChatId: (sec.querySelector('[data-cfg=wh-tg-chat]')?.value || '').trim() || undefined,
      };
      save(STORE.WEBHOOK_EVENTS, state.webhookEvents);
    };
    ['wh-captcha', 'wh-attack', 'wh-warehouse', 'wh-culture', 'wh-capping'].forEach(k => {
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
    saveNum('[data-cfg=transport-reserve]', v => {
      state.transportReserve = Math.min(80, Math.max(0, v)); save(STORE.TRANSPORT_RESERVE, state.transportReserve);
    });
    saveNum('[data-cfg=transport-min]', v => {
      state.transportMin = Math.min(10000, Math.max(100, v)); save(STORE.TRANSPORT_MIN, state.transportMin);
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
    saveNum('[data-cfg=ib-free-thresh]', v => { state.ibFreeThresh = Math.max(60,Math.min(300,+v||300)); save(STORE.IB_FREE_THRESH, state.ibFreeThresh); });
    saveNum('[data-cfg=collect-max-min]', v => { state.collectMaxMin = v; save(STORE.COLLECT_MAX_MIN, v); });
    saveNum('[data-cfg=farm-min]', v => { state.farmMinMs = v * 60000; save(STORE.FARM_MIN, state.farmMinMs); });
    saveNum('[data-cfg=farm-max]', v => { state.farmMaxMs = v * 60000; save(STORE.FARM_MAX, state.farmMaxMs); });
    saveNum('[data-cfg=town-min]', v => { state.townMinMs = v * 60000; save(STORE.TOWN_MIN, state.townMinMs); });
    saveNum('[data-cfg=town-max]', v => { state.townMaxMs = v * 60000; save(STORE.TOWN_MAX, state.townMaxMs); });
    sec.querySelector('[data-cfg=captcha-ladder]')?.addEventListener('change', e => {
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

  const ta = panel.querySelector('textarea');
  ta.value = state.farms;
  let farmsInputTimer = null;
  ta.addEventListener('input', () => {
    state.farms = ta.value;
    gbClearTimeout(farmsInputTimer);
    farmsInputTimer = gbTimeout(() => {
      save(STORE.FARMS, state.farms);
      refreshFarmsParsed();
      renderFarms();
    }, 400);
  });

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
    filt.innerHTML = '<input data-f="type" placeholder="type filter" style="flex:1;min-width:60px;background:#111;color:#cfc;border:1px solid #333;padding:2px 4px;font:11px monospace"/><input data-f="attacker" placeholder="attacker filter" style="flex:1;min-width:60px;background:#111;color:#cfc;border:1px solid #333;padding:2px 4px;font:11px monospace"/>';
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

      const bldgKeys = Object.keys(f.buildings || {});
      if (bldgKeys.length) {
        const b = document.createElement('div');
        b.className = 'res';
        const top = bldgKeys.sort((x, y) => f.buildings[y] - f.buildings[x]).slice(0, 3);
        b.textContent = 'bldg: ' + top.map(k => `${k}=${f.buildings[k]}`).join(' ') + (bldgKeys.length > 3 ? ' …' : '');
        b.title = bldgKeys.sort().map(k => `${k}=${f.buildings[k]}`).join(' ');
        row.appendChild(b);
      }
      if (f.hero) {
        const h = document.createElement('div');
        h.className = 'res';
        h.textContent = 'heroe: ' + [f.hero.name, f.hero.level != null ? 'lv' + f.hero.level : null, f.hero.cls].filter(Boolean).join(' ');
        row.appendChild(h);
      }

      list.appendChild(row);
    }
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
    if (captchaGlobalUntil > Date.now()) pauseTxt += ' ||ALL';
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
    const dryTxt = state.dryRun ? ' [DRY]' : ''; const safeTxt=state.safeMode?' SAFE':'';
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
    const txt = `${panicTxt}csrf:${csrfShort} farms:${okFarms}/${farms}${errTxt}${dryTxt}${safeTxt}${pauseTxt}`;
    if (txt !== _statusLast) {
      _statusLast = txt;
      el.textContent = txt;
      el.title = (tplBanner ? tplBanner + ' | ' : '') + JSON.stringify({ csrf: !!state.csrf, captcha: state.captchaBreakers, pause: pauseInfo.reason, memory: memSkips.map(s => s.key), circuits: openCircuits, unknownTransactions: unknownTx });
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
      const timing = state.autoFarm ? farmClaimTiming() : null;
      const claimTxt = !state.autoFarm ? 'claim: off'
        : (timing && timing.ready > 0 ? `claim: ${timing.ready} ready`
          : (timing && Number.isFinite(timing.nextAt) ? `claim: ${fmtSec(Math.max(0, timing.nextAt - timing.now))}`
            : (timing && timing.expiredModelWait ? 'claim: model sync' : 'claim: -')));
      const scrapeTxt = state.nextFarmScrape
        ? `scrape: ${fmtSec(Math.max(0, Math.round((state.nextFarmScrape - Date.now()) / 1000)))}`
        : 'scrape: -';
      const t = `${claimTxt} · ${scrapeTxt}`;
      if (t !== _timerFarmLast) { _timerFarmLast = t; fe.textContent = t; }
    }
    if (te) {
      const t = state.nextTownsScrape
        ? `towns: ${fmtSec(Math.max(0, Math.round((state.nextTownsScrape - Date.now()) / 1000)))}`
        : 'towns: -';
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
