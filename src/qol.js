  function qolBindActivityPause() {
    if (qolBindActivityPause._bound) return;
    qolBindActivityPause._bound = true;
    const bump = () => bumpUserActivity();
    ['mousemove', 'keydown', 'mousedown', 'touchstart'].forEach(ev => {
      gbListen(document, ev, bump, { passive: true });
    });
    gbListen(document, 'visibilitychange', () => {
      if (!document.hidden) bumpUserActivity();
    });
  }
  // ===== Draggable widget system (v4 plan 6.2) ===============================
  // One host + drag + persistence helper so 6.11 / 6.12 / 6.14 do not each
  // reinvent the Queue Center's chrome. The clamp math is taken verbatim from
  // queue-center.js so a widget cannot be dragged off-screen either.
  //
  // Every listener goes through gbListen, so teardown is already handled by the
  // existing gbListenerBag sweep - a widget cannot leak a document-level
  // mousemove past a hot reload.
  const GB_WIDGET_DEFAULT_POS = { left: '8px', top: '60px' };
  const gbWidgets = Object.create(null);
  function gbWidgetGeom() {
    if (!state.widgetGeom || typeof state.widgetGeom !== 'object' || Array.isArray(state.widgetGeom)) state.widgetGeom = {};
    return state.widgetGeom;
  }
  function gbWidgetSaveGeom(id, pos) {
    const g = gbWidgetGeom();
    g[String(id)] = { left: pos.left, top: pos.top };
    save(STORE.WIDGET_GEOM, g);
  }
  function gbWidgetRegister(opts) {
    const o = opts || {};
    const id = String(o.id || '');
    if (!id) return null;
    // Re-registering the same id disposes the old one first: a hot reload must
    // not leave two hosts fighting over the same geometry key.
    if (gbWidgets[id]) { try { gbWidgets[id].dispose(); } catch (_) {} }
    const host = document.createElement('div');
    host.className = 'gb-widget';
    host.dataset.widget = id;
    const geom = gbWidgetGeom()[id] || o.defaultPos || GB_WIDGET_DEFAULT_POS;
    host.style.cssText = `position:fixed;left:${geom.left};top:${geom.top};z-index:2147483646;display:none;` +
      'min-width:180px;max-width:60vw;max-height:70vh;overflow:auto;' +
      'background:var(--gb-bg-alt);color:var(--gb-fg);border:1px solid var(--gb-border);border-radius:8px;' +
      'box-shadow:0 4px 16px rgba(0,0,0,.45);font:11px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
    const head = document.createElement('div');
    head.className = 'gb-widget-head';
    head.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 6px;cursor:move;' +
      'background:var(--gb-bg-raise);border-bottom:1px solid var(--gb-border-soft);border-radius:8px 8px 0 0;user-select:none';
    const title = document.createElement('b');
    title.textContent = o.title || id;
    title.style.color = 'var(--gb-accent)';
    const close = document.createElement('button');
    close.type = 'button'; close.textContent = '\u00d7'; close.title = 'Cerrar';
    close.style.cssText = 'margin-left:auto;background:none;border:1px solid var(--gb-chrome-3);color:var(--gb-fg-2);cursor:pointer;font-size:11px;line-height:1;padding:0 5px';
    head.append(title, close);
    const body = document.createElement('div');
    body.className = 'gb-widget-body';
    body.style.cssText = 'padding:6px';
    host.append(head, body);
    document.body.appendChild(host);
    try { applyTheme(); } catch (_) {}

    let drag = null;
    let timer = 0;
    // Widgets tick as fast as 1s (the incoming-attack countdown), so they paint
    // through gbPaint: the row structure is stable between ticks, only the
    // clocks move, and patching those text nodes leaves the window's scroll,
    // hover and selection alone. o.key(), when the widget renders anything
    // clickable, is what forces a real rebuild instead of a patch.
    const render = () => {
      try {
        if (typeof o.render !== 'function') return;
        gbPaint(body, stage => o.render(stage), { key: typeof o.key === 'function' ? o.key() : o.key });
      } catch (e) { gbLogT('widget-render-' + id, 60000, `widget ${id}: ${String(e).slice(0, 60)}`); }
    };
    gbListen(head, 'mousedown', e => {
      if (e.target.closest('button, select, input')) return;
      const r = host.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, left0: host.style.left, top0: host.style.top };
      e.preventDefault();
    });
    gbListen(document, 'mousemove', e => {
      if (!drag) return;
      host.style.left = Math.max(0, Math.min(innerWidth - host.offsetWidth, e.clientX - drag.dx)) + 'px';
      host.style.top = Math.max(0, Math.min(innerHeight - host.offsetHeight, e.clientY - drag.dy)) + 'px';
    });
    gbListen(document, 'mouseup', () => {
      if (!drag) return;
      const moved = host.style.left !== drag.left0 || host.style.top !== drag.top0;
      drag = null;
      // A click on the header that never moved is not a reposition; writing
      // storage for it would burn a GM_setValue on every open/close.
      if (moved) gbWidgetSaveGeom(id, { left: host.style.left, top: host.style.top });
    });
    const api = {
      id,
      el: host,
      isOpen: () => host.style.display !== 'none',
      open() {
        host.style.display = 'block';
        render();
        // The tick belongs to the widget and only runs while it is OPEN, so a
        // closed countdown widget costs nothing.
        if (o.tickMs && !timer) timer = gbInterval(() => { if (api.isOpen() && !document.hidden) render(); }, o.tickMs);
      },
      close() { host.style.display = 'none'; },
      refresh() { if (api.isOpen()) render(); },
      dispose() {
        try { if (timer) gbClearInterval(timer); } catch (_) {}
        timer = 0;
        try { host.remove(); } catch (_) {}
        delete gbWidgets[id];
      },
    };
    gbListen(close, 'click', () => api.close());
    gbWidgets[id] = api;
    return api;
  }
  function gbWidgetUnregister(id) {
    const w = gbWidgets[String(id)];
    if (w) w.dispose();
  }
  function gbWidgetDisposeAll() { for (const id of Object.keys(gbWidgets)) gbWidgetUnregister(id); }

  // ===== Keyboard shortcuts (v4 plan 6.3) ====================================
  // One document-level keydown, registered through gbListen so teardown is
  // already handled. It PASSIVELY checks focus and never pushes focus or
  // synthesises a focus event.
  //
  // A bare key is never a shortcut: it would steal the game's own chat, search
  // and unit-pick keys. Alt is rejected outright so AltGr on a European layout
  // cannot spuriously fire one.
  const GB_KEY_ACTIONS = {
    'panel-config': { label: 'Abrir Config', run: () => { showTab('config'); } },
    'preflight': { label: 'Comprobar sistema', run: () => { showTab('stats'); preflightRunAndRender(); } },
    'copy-findings': { label: 'Copiar hallazgos', run: () => { const b = panel && panel.querySelector('footer button[data-act=copy]'); if (b) b.click(); } },
    'copy-all': { label: 'Copiar todo (log + datos)', run: () => bundleCopy() },
    'queue-center': { label: 'Abrir Colas', run: () => openQueueCenter() },
    'rescan-inbox': { label: 'Releer bandeja', run: () => scrapeInboxDom() },
    'toggle-pause': {
      label: 'Pausa por actividad',
      run: () => {
        state.pauseOnActivity = !state.pauseOnActivity;
        save(STORE.PAUSE_ON_ACTIVITY, state.pauseOnActivity);
        // Writes state directly; the Config checkbox re-reads it on next open.
        flash('pausa por actividad ' + (state.pauseOnActivity ? 'ON' : 'OFF'));
      },
    },
    'diag': { label: 'Diagnostico', run: () => diagRun() },
  };
  const GB_KEY_DEFAULTS = {
    'Ctrl+Shift+,': 'panel-config',
    'Ctrl+Shift+P': 'preflight',
    'Ctrl+Shift+F': 'copy-findings',
    'Ctrl+Shift+Q': 'queue-center',
    'Ctrl+Shift+R': 'rescan-inbox',
    'Ctrl+Shift+L': 'toggle-pause',
    'Ctrl+Shift+D': 'diag',
  };
  function gbKeyBindings() {
    const b = state.keybindings;
    return (b && typeof b === 'object' && !Array.isArray(b)) ? Object.assign({}, GB_KEY_DEFAULTS, b) : Object.assign({}, GB_KEY_DEFAULTS);
  }
  // e.key is the LAYOUT-DEPENDENT character: with Shift held, Ctrl+Shift+, and
  // Ctrl+Shift+. arrive as '<' and '>' on most layouts, so neither published
  // default ever matched. e.code names the PHYSICAL key and is locale-free, so
  // it is tried first; the e.key form stays as a fallback so a user binding on a
  // locale-specific character keeps working.
  const GB_KEY_CODE_CHAR = {
    Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'",
    BracketLeft: '[', BracketRight: ']', Backslash: '\\', Backquote: '`',
    Minus: '-', Equal: '=',
  };
  function gbKeyChars(e) {
    const out = [];
    const code = String(e.code || '');
    if (/^Key[A-Z]$/.test(code)) out.push(code.slice(3));
    else if (/^Digit[0-9]$/.test(code)) out.push(code.slice(5));
    else if (GB_KEY_CODE_CHAR[code]) out.push(GB_KEY_CODE_CHAR[code]);
    // Single printable character only: a bare modifier press has key 'Shift'
    // and must not resolve to a binding.
    const k = String(e.key || '');
    if (k.length === 1) { const u = k.toUpperCase(); if (!out.includes(u)) out.push(u); }
    return out;
  }
  function gbKeyFingerprints(e) {
    if (e.altKey) return [];
    if (!(e.ctrlKey || e.metaKey)) return [];
    const prefix = e.shiftKey ? 'Ctrl+Shift+' : 'Ctrl+';
    return gbKeyChars(e).map(c => prefix + c);
  }
  function gbKeyTypingTarget(e) {
    const ae = document.activeElement;
    if (ae) {
      const tag = String(ae.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (ae.isContentEditable) return true;
    }
    // The focused node may not be the contenteditable ROOT - a chat widget can
    // put the attribute on an ancestor - so test the event target's chain too.
    try {
      const t = e.target;
      if (t && t.closest && t.closest('[contenteditable="true"], [contenteditable=""], input, textarea, select')) return true;
    } catch (_) {}
    return false;
  }
  function gbKeyBind() {
    if (gbKeyBind._bound) return;
    gbKeyBind._bound = true;
    gbListen(document, 'keydown', e => {
      if (state.keyboardShortcuts === false) return;
      if (gbKeyTypingTarget(e)) return;
      const fps = gbKeyFingerprints(e);
      if (!fps.length) return;
      const binds = gbKeyBindings();
      const fp = fps.find(c => binds[c]);
      const actionId = fp && binds[fp];
      const action = actionId && GB_KEY_ACTIONS[actionId];
      if (!action) return;
      e.preventDefault();
      e.stopPropagation();
      try { action.run(); } catch (err) { gbLogT('key-' + actionId, 60000, `shortcut ${fp}: ${String(err).slice(0, 60)}`); }
      gbLogT('key-fired-' + actionId, 5000, `shortcut ${fp} -> ${action.label}`);
    }, true);
  }
  function qolSaveTemplate(name) {
    if (!name) return;
    if (!state.cityTemplates) state.cityTemplates = {};
    state.cityTemplates[name] = {
      abTargets: structuredClone(state.abTargets || {}),
      researchTargets: structuredClone(state.researchTargets || {}),
      recruitTargets: structuredClone(state.recruitTargets || {}),
      savedAt: Date.now(),
    };
    save(STORE.CITY_TEMPLATES, state.cityTemplates);
    gbLog(`template: saved "${name}"`);
    flash('plantilla guardada: ' + name);
  }
  function qolApplyTemplate(name) {
    const t = state.cityTemplates && state.cityTemplates[name];
    if (!t) { flash('falta plantilla'); return; }
    const histBefore = qolConfigSnapshot();

    if (t.abTargets) {
      state.abTargets = structuredClone(t.abTargets);
      save(STORE.AB_TARGETS, state.abTargets);
    }
    if (t.researchTargets) {
      state.researchTargets = structuredClone(t.researchTargets);
      save(STORE.RESEARCH_TARGETS, state.researchTargets);
    }
    if (t.recruitTargets) {
      state.recruitTargets = structuredClone(t.recruitTargets);
      save(STORE.RECRUIT_TARGETS, state.recruitTargets);
    }
    qolHistoryPush(histBefore, 'template:' + name);
    gbLog(`template: applied "${name}"`);
    flash('plantilla aplicada: ' + name);
    try { renderAbQueue && renderAbQueue(); } catch (_) {}
  }

  function renderGoals() {
    const sec=panel&&panel.querySelector('section[data-tab=overview]');if(!sec||sec.hidden)return;const box=sec.querySelector('.goals-panel');if(!box)return;box.replaceChildren();
    let ids=[];try{ids=Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{})}catch(_){};const profiles=goalProfiles();
    const rerender=()=>{renderGoals();renderPlanner();renderDashboard();};
    for(const tid of ids){let name=tid;try{const t=gbTownModel(tid);name=(t&&t.getName&&t.getName())||name}catch(_){} const plan=goalPlanTown(tid);
      const head=document.createElement('div');head.style.cssText='display:flex;gap:4px;align-items:center;padding:4px;border-bottom:1px solid #333';const b=document.createElement('b');b.textContent=`${name} · ${plan.progress}%`;head.appendChild(b);
      const edit=document.createElement('button');edit.textContent='Edit';edit.title='Edit per-town goal overrides/reserves as JSON';edit.style.cssText='font-size:8px;padding:1px 4px';edit.addEventListener('click',()=>{const cur=goalTownCfg(tid),raw=prompt('Overrides de objetivos por ciudad JSON\nClaves: build, research, units, reserve:{hard,soft}, defensive (0..1, null = hereda del perfil), resource:{wood,stone,iron} (-1..+1)',JSON.stringify({build:cur.build,research:cur.research,units:cur.units,reserve:cur.reserve,defensive:cur.defensive!=null?cur.defensive:null,resource:cur.resource||{}},null,2));if(raw==null)return;try{if(!goalSetTownOverrides(tid,JSON.parse(raw)))throw new Error('invalid object');rerender()}catch(e){flash('JSON de objetivos invalido')}});head.appendChild(edit);
      const rec=document.createElement('button');rec.textContent='Recalc';rec.style.cssText='font-size:8px;padding:1px 4px';rec.addEventListener('click',()=>{goalPlanTown(tid);rerender()});head.appendChild(rec);
      const reset=document.createElement('button');reset.textContent='Reset Q';reset.title='Clear virtual-queue order/block/mandatory overrides';reset.style.cssText='font-size:8px;padding:1px 4px';reset.addEventListener('click',()=>{goalQueueReset(tid);rerender()});head.appendChild(reset);
      const sel=document.createElement('select');sel.title='Perfil de la ciudad. "Personalizado" = usa los overrides JSON de esta ciudad (boton Edit); cualquier otro perfil los sustituye.';sel.style.cssText='background:#111;color:#cfc;border:1px solid #333;font-size:9px;margin-left:auto';for(const [id,p] of Object.entries(profiles)){const o=document.createElement('option');o.value=id;o.textContent=p.label||id;sel.appendChild(o)}sel.value=plan.profile;sel.addEventListener('change',()=>{goalSetProfile(tid,sel.value);rerender()});head.appendChild(sel);box.appendChild(head);
      // v4 plan 2.9 work item 5: advisory sequence as a third line per town.
      if (state.abOptimalOrderOn !== false) {
        try {
          const opt=abOptimalOrderCached(tid), first=((opt&&opt.actions)||[]).slice(0,4);
          if(first.length){const o=document.createElement('div');o.style.cssText='padding:1px 6px;color:#8ac;font-size:9px';
            o.title='Secuencia aconsejada (solo consejo). Aplicala desde Colas > Construccion.';
            o.textContent='  optima: '+first.map(a=>`${a.building}${a.level?' '+a.level:''}`).join(' > ');box.appendChild(o)}
        } catch (_) {}
      }
      const lines=(plan.actions||[]).slice(0,12);if(!lines.length){const e=document.createElement('div');e.textContent='  objetivo cumplido / sin acciones';e.style.cssText='padding:2px 6px;color:#777';box.appendChild(e)}else for(const a of lines){const row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:1fr auto;gap:3px;padding:2px 4px;border-bottom:1px solid #1e1e1e;align-items:center';const text=document.createElement('span');const c=a.cost||{},cost=[c.wood||0,c.stone||0,c.iron||0].join('/');text.textContent=`${a.mandatory?'! ':''}${a.kind} ${a.id}${a.level?' → '+a.level:''}${a.amount?' ×'+a.amount:''} · ${a.status} · ${cost}${a.why?' · '+a.why:''}`;row.appendChild(text);const acts=document.createElement('span');acts.style.cssText='display:flex;gap:2px';const mk=(label,title,fn)=>{const x=document.createElement('button');x.textContent=label;x.title=title;x.style.cssText='font-size:8px;padding:0 3px';x.addEventListener('click',()=>{fn();rerender()});acts.appendChild(x)};mk('↑','move earlier',()=>goalQueueMove(tid,a.queueKey,-1));mk('↓','move later',()=>goalQueueMove(tid,a.queueKey,1));mk(a.status==='user-blocked'?'ON':'B','block/unblock',()=>goalQueueToggleBlock(tid,a.queueKey));mk(a.mandatory?'*':'!','mandatory priority',()=>goalQueueToggleMandatory(tid,a.queueKey));mk('×','suppress until Reset Q',()=>goalQueueHide(tid,a.queueKey));row.appendChild(acts);box.appendChild(row)}
    }
  }


  function plannerFmt(n) { return n == null || !Number.isFinite(+n) ? '?' : Math.floor(+n).toLocaleString(); }
  function renderPlanner() {
    const sec = panel && panel.querySelector('section[data-tab=overview]');
    if (!sec || sec.hidden) return;
    const controls = sec.querySelector('.planner-controls'), box = sec.querySelector('.planner-panel');
    if (!controls || !box) return;
    const cfg=plannerCfgRoot(), g=cfg.global;
    if (!controls.dataset.bound) {
      controls.dataset.bound='1'; controls.replaceChildren();
      for (const mode of ['hard','soft']) for (const k of PLANNER_KEYS) {
        const lab=document.createElement('label'); lab.textContent=`${mode[0].toUpperCase()} ${k.slice(0,3)} `;
        const inp=document.createElement('input'); inp.type='number'; inp.min='0'; inp.style.cssText='width:55px;background:#111;color:#cfc;border:1px solid #333;font-size:9px';
        inp.dataset.mode=mode; inp.dataset.key=k; inp.value=g[mode][k]||0;
        // Resolve the config root at change time: qolImportConfig replaces
        // state.plannerCfg wholesale, so a captured `g` would be an orphan and
        // the edit would be saved over by the imported copy.
        inp.addEventListener('change',()=>{ const root=plannerCfgRoot().global; root[mode][k]=Math.max(0,+inp.value||0); plannerSaveCfg(); renderPlanner(); });
        lab.appendChild(inp); controls.appendChild(lab);
      }
    } else {
      controls.querySelectorAll('input[data-mode][data-key]').forEach(inp=>{
        const m=inp.dataset.mode,k=inp.dataset.key;
        if(document.activeElement!==inp) inp.value=(g[m]&&g[m][k])||0;
      });
    }
    box.replaceChildren();
    const hdr=document.createElement('div'); hdr.style.cssText='display:grid;grid-template-columns:1.3fr repeat(3,.8fr) .7fr .7fr;gap:3px;padding:3px;color:#888;border-bottom:1px solid #333';
    hdr.textContent=''; ['town','real W/S/I','reserved W/S/I','available W/S/I','pop','merchants'].forEach(x=>{const s=document.createElement('span');s.textContent=x;hdr.appendChild(s)}); box.appendChild(hdr);
    const ids=[]; try{ Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{}).forEach(x=>ids.push(x)); }catch(_){}
    for(const tid of ids){ const s=plannerSnapshot(tid); if(!s) continue; let name=tid; try{const t=gbTownModel(tid); name=(t&&t.getName&&t.getName())||name}catch(_){}
      const row=document.createElement('div'); row.style.cssText='display:grid;grid-template-columns:1.3fr repeat(3,.8fr) .7fr .7fr;gap:3px;padding:3px;border-bottom:1px solid #222';
      const vals=[name,`${plannerFmt(s.live.wood)}/${plannerFmt(s.live.stone)}/${plannerFmt(s.live.iron)}`,`${plannerFmt(s.committed.wood)}/${plannerFmt(s.committed.stone)}/${plannerFmt(s.committed.iron)}`,`${plannerFmt(s.availableSoft.wood)}/${plannerFmt(s.availableSoft.stone)}/${plannerFmt(s.availableSoft.iron)}`,`${plannerFmt(s.availableSoft.population)}`,`${plannerFmt(s.availableSoft.tradeCap)}`];
      vals.forEach(v=>{const e=document.createElement('span');e.textContent=v;row.appendChild(e)}); row.title=`hard reserve ${JSON.stringify(s.reserve.hard)} | soft ${JSON.stringify(s.reserve.soft)} | incoming ${JSON.stringify(s.incoming)}`; box.appendChild(row);
    }
  }

  function qolOverviewData() {
    const uw = gameUw();
    let townN = 0, farmReady = 0, farmTotal = 0, cultureBusy = 0;
    let buildQ = 0, researchQ = 0, caveFill = [];
    try { townN = Object.keys((uw.ITowns && uw.ITowns.towns) || {}).length; } catch (_) {}
    try {
      const rel = ruralRelModels && ruralRelModels();
      if (rel) {
        farmTotal = rel.length;
        const now = gameNow();
        rel.forEach(r => {
          const a = r.attributes || {};
          if (+a.relation_status === 1 && (!a.lootable_at || +a.lootable_at <= now)) farmReady++;
        });
      }
    } catch (_) {}
    try {
      const models = uw.MM && uw.MM.getModels && uw.MM.getModels().Celebration;
      if (models) cultureBusy = Object.keys(models).length;
    } catch (_) {}
    try {
      const bo = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('BuildingOrder');
      if (bo && bo.models) buildQ = bo.models.length;
    } catch (_) {}
    try {
      const ro = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('ResearchOrder');
      if (ro && ro.models) researchQ = ro.models.length;
    } catch (_) {}
    try {
      const ids = (typeof caveListTownIds === 'function') ? caveListTownIds() : [];
      ids.slice(0, 20).forEach(id => {
        const info = typeof caveTownInfo === 'function' ? caveTownInfo(id) : null;
        if (info && info.hideCap) caveFill.push({ id, pct: Math.round(100 * (info.stored || 0) / info.hideCap) });
      });
    } catch (_) {}
    const breakers = Object.keys(state.captchaBreakers || {}).filter(k => captchaPaused(k));
    const pause = {};
    automationPaused(pause);
    return {
      townN, farmReady, farmTotal, cultureBusy, buildQ, researchQ, caveFill,
      breakers, pause: pause.reason || null,
      health: Object.assign({}, moduleHealth),
      globalCaptcha: captchaGlobalUntil > Date.now() ? captchaGlobalUntil : 0,
      userPause: userPausedUntil > Date.now() ? userPausedUntil : 0,
    };
  }

  function renderHealth() {
    const sec=panel&&panel.querySelector('section[data-tab=overview]');if(!sec||sec.hidden)return;const box=sec.querySelector('.health-panel');if(!box)return;box.replaceChildren();
    const names=new Set([...Object.keys(moduleHealth||{}),...Object.keys(state.circuits||{})]);
    if(!names.size){box.textContent='(no module activity yet)';return}
    const hdr=document.createElement('div');hdr.style.cssText='display:grid;grid-template-columns:1fr repeat(5,.7fr);gap:3px;color:#888;border-bottom:1px solid #333;padding:2px';['module','ok/err','timeout','lat ms','last','circuit'].forEach(v=>{const x=document.createElement('span');x.textContent=v;hdr.appendChild(x)});box.appendChild(hdr);
    [...names].sort().forEach(name=>{const h=moduleHealth[name]||{},c=state.circuits&&state.circuits[name];const row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:1fr repeat(5,.7fr);gap:3px;border-bottom:1px solid #222;padding:2px';const age=h.last?fmtSec((Date.now()-h.last)/1000):'-';const vals=[name,`${h.ok||0}/${h.err||0}`,String(h.timeout||0),h.avgLatency==null?'-':String(Math.round(h.avgLatency)),age,c&&c.open?'OPEN':(c&&c.strikes?`strike ${c.strikes}`:'ok')];vals.forEach(v=>{const x=document.createElement('span');x.textContent=v;row.appendChild(x)});box.appendChild(row)})
  }

  // ===== Dashboard + Simulator (v2.0) ========================================
  function simulateTown(townId,horizonHours){const h=Math.max(1,+horizonHours||24),snap=plannerSnapshot(townId),forecast=economyForecast(townId,h*3600),plan=goalPlanTown(townId);if(!snap)return{townId:String(townId),error:'state-unreadable',actions:[]};const stock={wood:snap.availableSoft.wood,stone:snap.availableSoft.stone,iron:snap.availableSoft.iron,population:snap.availableSoft.population};if(forecast&&forecast.production){for(const k of ['wood','stone','iron'])stock[k]+=forecast.production[k]*h}const actions=[];let bottleneck='';for(const a of(plan.actions||[])){if(a.kind==='build'&&a.costExact===false){const why='future build cost requires live recalculation after previous level';actions.push({...a,sim:'waiting',simWhy:why});if(!bottleneck)bottleneck=why;break}const c=plannerNormCost(a.cost);if(!c){actions.push({...a,sim:'blocked:cost'});continue}let ok=true,why='';for(const k of PLANNER_KEYS){if((+c[k]||0)>+(stock[k]||0)){ok=false;why=`${k} ${Math.floor(stock[k]||0)}/${Math.ceil(c[k]||0)}`;break}}if(!ok){actions.push({...a,sim:'waiting',simWhy:why});if(!bottleneck)bottleneck=why;break}for(const k of PLANNER_KEYS)stock[k]-=+c[k]||0;actions.push({...a,sim:'would-run'})}return{townId:String(townId),horizonHours:h,actions,final:stock,bottleneck,productionKnown:!!(forecast&&forecast.productionKnown)}}
  function simulateAccount(horizonHours){let ids=[];try{ids=Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{})}catch(_){};const towns=ids.map(id=>simulateTown(id,horizonHours));return{at:Date.now(),horizonHours:+horizonHours||24,towns,totalActions:towns.reduce((n,t)=>n+t.actions.filter(a=>a.sim==='would-run').length,0),blocked:towns.filter(t=>t.bottleneck).length}}
  let dashboardSimulation=null;
  function renderDashboard() {
    const sec=panel&&panel.querySelector('section[data-tab=overview]');
    if(!sec||sec.hidden)return;
    const sum=sec.querySelector('.dashboard-summary'),time=sec.querySelector('.timeline-panel'),sim=sec.querySelector('.sim-panel'),cards=sec.querySelector('.gb-dashboard-cards');
    if(!sum||!time||!sim)return;
    let ids=[];try{ids=Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{})}catch(_){}
    const threats=dodgeIncomingMovements();
    const unknown=Object.values(state.txState||{}).filter(t=>t&&/^(unknown|manual-review)$/.test(t.state||'')).length;
    const circuits=Object.keys(state.circuits||{}).filter(k=>state.circuits[k]&&state.circuits[k].open);
    const fps=clientFingerprintNow();
    const compatible=Object.values(fps.required).every(Boolean);
    const activeGoals=ids.filter(id=>(goalPlanTown(id).actions||[]).length).length;
    const avgProgress=ids.length?Math.round(ids.reduce((n,id)=>n+goalProgress(id),0)/ids.length):100;
    const pauseInfo={}; const paused=automationPaused(pauseInfo);
    sum.textContent=`towns ${ids.length} · progress ${avgProgress}% · ${activeGoals} objetivo(s) activos · ${unknown} transacción(es) pendientes de revisar · ${circuits.length} circuit breaker abierto(s)`;
    if(cards){
      cards.replaceChildren();
      const data=[
        ['Ciudades',ids.length,activeGoals?`${activeGoals} con trabajo pendiente`:'sin objetivos pendientes'],
        ['Progreso',`${avgProgress}%`,avgProgress>=100?'objetivos completados':'media de objetivos'],
        ['Amenazas',threats.length,threats.length?'requieren revisión':'sin entradas hostiles detectadas'],
        ['Sistema',compatible&&!unknown&&!circuits.length?'OK':'Revisar',paused?`pausado: ${pauseInfo.reason}`:(state.safeMode?'SAFE MODE':'automatización disponible')],
      ];
      for(const [k,v,sub] of data){const c=document.createElement('div');c.className='gb-card';const a=document.createElement('div');a.className='k';a.textContent=k;const b=document.createElement('div');b.className='v';b.textContent=String(v);const d=document.createElement('div');d.className='s';d.textContent=sub;c.append(a,b,d);cards.appendChild(c)}
    }
    const mode=panel.querySelector('#gb-head-mode');if(mode){mode.textContent=state.safeMode?'SAFE':'NORMAL';mode.className='gb-pill '+(state.safeMode?'warn':'ok')}
    const health=panel.querySelector('#gb-head-health');if(health){const bad=!compatible||unknown||circuits.length;health.textContent=bad?'REVISAR':'SISTEMA OK';health.className='gb-pill '+(bad?'bad':'ok')}
    const quickSafe=sec.querySelector('#gb-quick-safe');if(quickSafe)quickSafe.textContent=state.safeMode?'SAFE MODE: ON':'SAFE MODE: OFF';
    const rows=[];
    for(const id of ids){let name=id;try{name=gbTownModel(id).getName()||id}catch(_){}const p=goalPlanTown(id),f=economyForecast(id);const a=(p.actions||[])[0];if(a)rows.push(`${name}: ${a.kind} ${a.id}${a.level?' → '+a.level:''} · ${a.status}${a.why?' · '+a.why:''}`);if(f&&Object.values(f.overflow).some(Boolean))rows.push(`${name}: AVISO · almacén previsto al límite en ${Object.entries(f.overflow).filter(([,v])=>v).map(([k])=>k).join(', ')}`)}
    time.textContent=rows.slice(0,30).join('\n')||'No hay acciones planificadas.';
    if(dashboardSimulation){const lines=[`Simulación ${dashboardSimulation.horizonHours} h · ${dashboardSimulation.totalActions} acciones · ${dashboardSimulation.blocked} ciudad(es) con cuello de botella`];for(const t of dashboardSimulation.towns)lines.push(`Ciudad ${t.townId}: ${t.actions.filter(a=>a.sim==='would-run').length} acciones · final ${Math.floor(t.final.wood)}/${Math.floor(t.final.stone)}/${Math.floor(t.final.iron)} · ${t.bottleneck||'sin bloqueo'}${t.productionKnown?'':' · producción desconocida'}`);sim.textContent=lines.join('\n')}else sim.textContent='Todavía no se ha ejecutado una simulación.';
    const why=sec.querySelector('.why-panel');if(why)why.textContent=(state.whyLog||[]).slice(0,12).map(x=>`${new Date(x.ts).toLocaleTimeString()} · ${x.feature} · ${x.status}${x.why?' · '+x.why:''}`).join('\n')||'Todavía no hay decisiones registradas.';
    renderHealth();
  }

  function renderOverview() {
    const box = panel && panel.querySelector('.overview-panel');
    if (!box) return;
    const sec = box.closest('section[data-tab]');
    if (sec && sec.hidden) return;
    const d = qolOverviewData();
    const lines = [
      `Towns: ${d.townN}`,
      `Farms ready: ${d.farmReady}/${d.farmTotal}`,
      `Culture busy: ${d.cultureBusy}`,
      `Build queue: ${d.buildQ} | Research queue: ${d.researchQ}`,
      d.pause ? `|| paused: ${d.pause}` : 'Automation: active',
      d.breakers.length ? `Captcha: ${d.breakers.join(',')}` : 'Captcha: clear',
      (() => {
        const parts = Object.keys(d.health).map(k => {
          const h = d.health[k];
          return `${k} ok${h.ok}/err${h.err}/cap${h.captcha}`;
        });
        return 'Health: ' + (parts.length ? parts.join(' · ') : '(none yet)');
      })(),
    ];
    box.textContent = lines.join('\n');
    if (sec && !sec.dataset.uxBound) {
      sec.dataset.uxBound = '1';
      sec.querySelector('#gb-quick-safe')?.addEventListener('click', () => { state.safeMode = !state.safeMode; save(STORE.SAFE_MODE, state.safeMode); renderOverview(); flash(state.safeMode ? 'SAFE MODE activado' : 'SAFE MODE desactivado'); });
      sec.querySelector('#gb-quick-preflight')?.addEventListener('click', () => { preflightRunAndRender(); showTab('stats'); });
      sec.querySelector('#gb-quick-sim')?.addEventListener('click', () => { dashboardSimulation = simulateAccount(24); const h=sec.querySelector('#gb-sim-hours'); if(h)h.value='24'; renderDashboard(); });
      sec.querySelector('#gb-quick-config')?.addEventListener('click', () => showTab('config'));
    }
    try { renderGoals(); renderPlanner(); renderDashboard(); } catch (_) {}
  }
  const CONFIG_EXPORT_SCHEMA = 3;
  // Config export carries player notes / watchlist - redact by default.
  function qolRedactConfigDump(dump) {
    if (state.exportRedact === false) {
      gbLogT('cfg-export-raw', 60000, 'export config: redaction OFF - dump contains player names');
      return dump;
    }
    const cut = (s) => (s ? String(s).slice(0, 1) + '...' : s);
    const redactNotes = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      const out = {};
      Object.keys(obj).forEach((k, i) => { out[cut(k) + i] = '<note>'; });
      return out;
    };
    dump.playerNotes = redactNotes(dump.playerNotes);
    dump.allianceNotes = redactNotes(dump.allianceNotes);
    dump.watchlist = (dump.watchlist || []).map((w) => {
      if (!w || typeof w !== 'object') return cut(w);
      const out = {};
      Object.keys(w).forEach((k) => { out[k] = typeof w[k] === 'string' ? cut(w[k]) : w[k]; });
      return out;
    });
    dump.redacted = true;
    return dump;
  }
  // ===== Config snapshot, history and import preview (v4 plans 6.9 + 6.10) ===
  // ONE allow-list, shared by export, undo/redo and the import preview. It is
  // an allow-list on purpose: a deny-list would silently start carrying every
  // new config key somebody adds, including secrets.
  //
  // Deliberately excluded and never snapshotted: webhookUrl and the Telegram
  // chat id, csrf, captcha breakers, learned templates, findings, decisions and
  // host consent. Undo must not be able to resurrect a credential or replay a
  // learned payload.
  const CONFIG_HISTORY_MAX = 20;
  const CONFIG_HISTORY_TTL_MS = 7 * 86400000;
  const CONFIG_SNAPSHOT_KEYS = [
    'abTargets', 'abOrder', 'researchTargets', 'recruitTargets', 'plannerCfg',
    'goalProfiles', 'townGoals', 'virtualQueueOverrides', 'nativeQueue',
    'predictCfg', 'defenseCfg', 'safeMode', 'autoTransport', 'transportReserve',
    'transportMin', 'cityTemplates', 'townGroups', 'cultureTypes', 'favorCfg',
    'spyCfg', 'profileAutoCfg', 'wonderCfg', 'merchantWish', 'priorityOrder',
    'playerNotes', 'watchlist',
  ];
  function qolConfigSnapshot() {
    const out = { schema: CONFIG_EXPORT_SCHEMA, ver: state.configVer || 1, host: location.host };
    for (const k of CONFIG_SNAPSHOT_KEYS) {
      if (state[k] === undefined) continue;
      // structuredClone preserves Date/Map/Set/RegExp that JSON would silently
      // mangle, and throws DataCloneError on unsupported types so a regression
      // is logged instead of masquerading as a clean snapshot.
      try { out[k] = structuredClone(state[k]); } catch (e) { gbLogT('cfg-snap-' + k, 60000, 'config snapshot: ' + k + ' ' + String(e && e.message || e).slice(0, 80)); }
    }
    return out;
  }
  function qolHistoryRing(which) {
    const key = which === 'redo' ? 'configRedo' : 'configUndo';
    if (!Array.isArray(state[key])) state[key] = [];
    return state[key];
  }
  function qolHistorySave() {
    save(STORE.CONFIG_UNDO, qolHistoryRing('undo'));
    save(STORE.CONFIG_REDO, qolHistoryRing('redo'));
  }
  function qolHistoryPrune(ring) {
    const cut = Date.now() - CONFIG_HISTORY_TTL_MS;
    while (ring.length && (ring.length > CONFIG_HISTORY_MAX || +(ring[0].at || 0) < cut)) ring.shift();
  }
  // Push only when the canonical config ACTUALLY differs: a change handler that
  // rewrote a value to the same thing must not consume an undo slot.
  function qolHistoryPush(before, reason, which) {
    const after = qolConfigSnapshot();
    let same = false;
    try { same = JSON.stringify(before) === JSON.stringify(after); } catch (_) {}
    if (same) return false;
    const ring = qolHistoryRing(which || 'undo');
    ring.push({ schema: CONFIG_EXPORT_SCHEMA, ver: before.ver, at: Date.now(), reason: String(reason || 'config'), data: before });
    qolHistoryPrune(ring);
    if (!which || which === 'undo') { state.configRedo = []; }
    qolHistorySave();
    return true;
  }
  function qolHistoryCounts() { return { undo: qolHistoryRing('undo').length, redo: qolHistoryRing('redo').length }; }
  function qolHistoryStep(from, to, label) {
    const src = qolHistoryRing(from);
    if (!src.length) return false;
    const entry = src.pop();
    // A snapshot from a NEWER schema is refused and put back: applying it would
    // mean interpreting fields this build does not understand.
    if (+entry.schema > CONFIG_EXPORT_SCHEMA) {
      src.push(entry);
      gbLog(`config ${label}: refused - snapshot schema ${entry.schema} newer than ${CONFIG_EXPORT_SCHEMA}`);
      return false;
    }
    const current = qolConfigSnapshot();
    // history:false so the apply below cannot recurse into the ring.
    const ok = qolImportConfig(entry.data, { history: false, source: label });
    if (!ok) { src.push(entry); gbLog(`config ${label}: nothing applied`); return false; }
    const dest = qolHistoryRing(to);
    dest.push({ schema: CONFIG_EXPORT_SCHEMA, ver: current.ver, at: Date.now(), reason: entry.reason, data: current });
    qolHistoryPrune(dest);
    qolHistorySave();
    const norm = (+entry.ver && +entry.ver < CONFIG_VER_CURRENT)
      ? ` normalized v${entry.ver} -> v${CONFIG_VER_CURRENT}` : '';
    const c = qolHistoryCounts();
    gbLog(`config ${label}: ${entry.reason}${norm} (undo ${c.undo}, redo ${c.redo})`);
    return true;
  }
  function qolHistoryUndo() { return qolHistoryStep('undo', 'redo', 'undo'); }
  function qolHistoryRedo() { return qolHistoryStep('redo', 'undo', 'redo'); }
  // Validation-only pass. It assigns NOTHING: the wizard can show the user what
  // would happen before anything is written.
  function qolPrepareConfigImport(raw) {
    let obj = raw;
    if (typeof raw === 'string') {
      try { obj = JSON.parse(raw); } catch (e) { return { ok: false, errors: ['JSON invalido'], sections: [], ignored: [], candidate: null }; }
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, errors: ['no es un objeto de configuracion'], sections: [], ignored: [], candidate: null };
    const errors = [];
    if (obj.host && String(obj.host) !== String(location.host)) errors.push(`mundo distinto: ${obj.host} != ${location.host}`);
    if (obj.schema != null && +obj.schema > CONFIG_EXPORT_SCHEMA) errors.push(`esquema ${obj.schema} mas nuevo que ${CONFIG_EXPORT_SCHEMA}`);
    const sections = [], ignored = [];
    const cur = qolConfigSnapshot();
    for (const k of Object.keys(obj)) {
      if (['schema', 'ver', 'host'].includes(k)) continue;
      if (!CONFIG_SNAPSHOT_KEYS.includes(k)) { ignored.push(k); continue; }
      let changed = false;
      try { changed = JSON.stringify(cur[k]) !== JSON.stringify(obj[k]); } catch (_) { changed = true; }
      sections.push({ key: k, changed });
    }
    return {
      ok: errors.length === 0 && sections.length > 0,
      errors, sections, ignored,
      candidate: obj,
      sourceHost: obj.host || null,
      schema: obj.schema != null ? +obj.schema : null,
      ver: obj.ver != null ? +obj.ver : null,
    };
  }
  // The ONLY export path the UI may use: raw qolExportConfig is internal until
  // redaction has run.
  function qolExportConfigForUi() {
    try { return qolRedactConfigDump(qolExportConfig()); } catch (_) { return null; }
  }
  function qolExportConfig() {
    return { schema:CONFIG_EXPORT_SCHEMA, ver:state.configVer||1, host:location.host,
      abTargets:state.abTargets,abOrder:state.abOrder,researchTargets:state.researchTargets,recruitTargets:state.recruitTargets,
      plannerCfg:state.plannerCfg,goalProfiles:state.goalProfiles,townGoals:state.townGoals,virtualQueueOverrides:state.virtualQueueOverrides,nativeQueue:state.nativeQueue,predictCfg:state.predictCfg,defenseCfg:state.defenseCfg,safeMode:!!state.safeMode,
      autoTransport:!!state.autoTransport,transportReserve:+state.transportReserve||20,transportMin:+state.transportMin||1000,
      cityTemplates:state.cityTemplates,townGroups:state.townGroups,cultureTypes:state.cultureTypes,favorCfg:state.favorCfg,spyCfg:state.spyCfg,profileAutoCfg:state.profileAutoCfg,wonderCfg:state.wonderCfg,merchantWish:state.merchantWish,priorityOrder:state.priorityOrder,playerNotes:state.playerNotes,watchlist:state.watchlist };
  }
  function qolImportConfig(obj, opts) {
    if(!obj||typeof obj!=='object'||Array.isArray(obj))return false;if(obj.host&&String(obj.host)!==String(location.host)){gbLog(`config import refused: file host ${obj.host} != ${location.host}`);return false}if(obj.schema!=null&&+obj.schema>CONFIG_EXPORT_SCHEMA){gbLog(`config import refused: schema ${obj.schema} newer than supported ${CONFIG_EXPORT_SCHEMA}`);return false}
    const clone=v=>structuredClone(v),isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);const validators={abTargets:isObj,abOrder:Array.isArray,researchTargets:isObj,recruitTargets:isObj,plannerCfg:isObj,goalProfiles:isObj,townGoals:isObj,virtualQueueOverrides:isObj,nativeQueue:isObj,predictCfg:isObj,defenseCfg:isObj,safeMode:v=>typeof v==='boolean',autoTransport:v=>typeof v==='boolean',transportReserve:v=>Number.isFinite(+v),transportMin:v=>Number.isFinite(+v),cityTemplates:isObj,townGroups:isObj,cultureTypes:isObj,favorCfg:isObj,spyCfg:isObj,profileAutoCfg:isObj,wonderCfg:isObj,merchantWish:Array.isArray,priorityOrder:Array.isArray,playerNotes:isObj,watchlist:Array.isArray};const before=qolConfigSnapshot();const storeFor={abTargets:STORE.AB_TARGETS,abOrder:STORE.AB_ORDER,researchTargets:STORE.RESEARCH_TARGETS,recruitTargets:STORE.RECRUIT_TARGETS,plannerCfg:STORE.PLANNER_CFG,goalProfiles:STORE.GOAL_PROFILES,townGoals:STORE.TOWN_GOALS,virtualQueueOverrides:STORE.VIRTUAL_QUEUE_OVERRIDES,nativeQueue:STORE.NATIVE_QUEUE,predictCfg:STORE.PREDICT_CFG,defenseCfg:STORE.DEFENSE_CFG,safeMode:STORE.SAFE_MODE,autoTransport:STORE.AUTO_TRANSPORT,transportReserve:STORE.TRANSPORT_RESERVE,transportMin:STORE.TRANSPORT_MIN,cityTemplates:STORE.CITY_TEMPLATES,townGroups:STORE.TOWN_GROUPS,cultureTypes:STORE.CULTURE_TYPES,favorCfg:STORE.FAVOR_CFG,spyCfg:STORE.SPY_CFG,profileAutoCfg:STORE.PROFILE_AUTO_CFG,wonderCfg:STORE.WONDER_CFG,merchantWish:STORE.MERCHANT_WISH,priorityOrder:STORE.PRIORITY_ORDER,playerNotes:STORE.PLAYER_NOTES,watchlist:STORE.WATCHLIST};let applied=0;
    for(const k of Object.keys(validators)){if(obj[k]==null)continue;if(!validators[k](obj[k])){gbLog(`config import: ignored invalid ${k}`);continue}let v=clone(obj[k]);if(k==='priorityOrder'){const allowed=new Set(PRIORITY_ORDER_DEFAULT);v=v.map(String).filter((x,i,a)=>allowed.has(x)&&a.indexOf(x)===i);v=v.concat(PRIORITY_ORDER_DEFAULT.filter(x=>!v.includes(x)))}else if(k==='abOrder'){v=v.map(String).filter((x,i,a)=>AB_BUILDINGS.includes(x)&&a.indexOf(x)===i);v=v.concat(AB_BUILDINGS.filter(x=>!v.includes(x)))}else if(k==='abTargets'){const c={};for(const[b,n]of Object.entries(v))if(AB_BUILDINGS.includes(b))c[b]=abClampTarget(b,n);v=c}else if(k==='nativeQueue'){
      const clean={version:1,seq:Math.max(0,+v.seq||0),towns:{}},seen=new Set();
      const jobId=(raw,prefix)=>{let id=/^[A-Za-z0-9:._-]{1,160}$/.test(String(raw||''))?String(raw):'';if(!id||seen.has(id)){clean.seq++;id=`${prefix}:import:${clean.seq.toString(36)}`}seen.add(id);return id};
      for(const[tid,t]of Object.entries(v.towns||{}).slice(0,500)){if(!/^\d+$/.test(String(tid))||!isObj(t))continue;const townId=String(tid),build=[],recruit=[],recruitNaval=[],research=[];
        for(const j of (Array.isArray(t.build)?t.build:[]).slice(0,300)){if(!isObj(j)||!AB_BUILDINGS.includes(String(j.building))||!Number.isFinite(+j.toLevel)||+j.toLevel<=0)continue;const uncertain=!!(j.inflight||j.manualReview||j.reconcile),flight=j.reconcile||j.inflight||null,flightBuilding=flight&&AB_BUILDINGS.includes(String(flight.building))?String(flight.building):String(j.building);build.push({id:jobId(j.id,'b'),kind:'build',townId,building:String(j.building),fromLevel:Math.max(0,Math.floor(+j.fromLevel||(+j.toLevel-1))),toLevel:Math.max(1,Math.floor(+j.toLevel)),status:uncertain?'unknown':'pending',reason:uncertain?'acción importada pendiente de revisión':'',createdAt:Number.isFinite(+j.createdAt)?+j.createdAt:Date.now(),inflight:null,manualReview:uncertain,reconcile:flight&&isObj(flight)?{building:flightBuilding,targetLevel:Math.max(1,Math.floor(+flight.targetLevel||+j.toLevel)),at:+flight.at||Date.now(),accepted:!!flight.accepted}:null})}
        // Both recruit lanes are read, and every job is re-routed by hull type:
        // a file written before the barracks/harbour split carries all of them
        // in `recruit`, and importing a trireme into the barracks lane would
        // stall it forever.
        for(const j of [].concat((Array.isArray(t.recruit)?t.recruit:[]).slice(0,300),(Array.isArray(t.recruitNaval)?t.recruitNaval:[]).slice(0,300))){if(!isObj(j)||!/^[a-z0-9_:-]+$/i.test(String(j.unit||''))||!gbGameDataLookup("units", String(j.unit))||!Number.isFinite(+j.amount)||+j.amount<=0)continue;const uncertain=!!(j.inflight||j.manualReview);const dest=nativeRecruitLane(String(j.unit))==='recruitNaval'?recruitNaval:recruit;dest.push({id:jobId(j.id,'u'),kind:'recruit',townId,unit:String(j.unit),amount:Math.max(1,Math.floor(+j.amount)),status:uncertain?'unknown':'pending',reason:uncertain?'acción importada pendiente de revisión':'',createdAt:Number.isFinite(+j.createdAt)?+j.createdAt:Date.now(),inflight:null,manualReview:uncertain})}
        for(const j of (Array.isArray(t.research)?t.research:[]).slice(0,300)){if(!isObj(j)||!/^[a-z0-9_:-]+$/i.test(String(j.tech||''))||!gbGameDataLookup("researches", String(j.tech)))continue;const uncertain=!!(j.inflight||j.manualReview);research.push({id:jobId(j.id,'r'),kind:'research',townId,tech:String(j.tech),status:uncertain?'unknown':'pending',reason:uncertain?'acción importada pendiente de revisión':'',createdAt:Number.isFinite(+j.createdAt)?+j.createdAt:Date.now(),inflight:null,manualReview:uncertain})}
        clean.towns[townId]={build,recruit,recruitNaval,research,paused:{build:!!(t.paused&&t.paused.build),recruit:!!(t.paused&&t.paused.recruit),recruitNaval:!!(t.paused&&(t.paused.recruitNaval!=null?t.paused.recruitNaval:t.paused.recruit)),research:!!(t.paused&&t.paused.research)},mode:{build:build.length||t.mode&&t.mode.build==='fifo'?'fifo':'legacy',recruit:recruit.length||t.mode&&t.mode.recruit==='fifo'?'fifo':'legacy',recruitNaval:recruitNaval.length||t.mode&&(t.mode.recruitNaval==='fifo'||t.mode.recruitNaval==null&&t.mode.recruit==='fifo')?'fifo':'legacy',research:research.length||t.mode&&t.mode.research==='fifo'?'fifo':'legacy'}}
      }v=clean
    }else if(k==='watchlist')v=v.slice(0,500);else if(k==='merchantWish')v=v.slice(0,100).filter(x=>isObj(x)&&(x.item||x.id)&&Number.isFinite(+x.maxPrice)&&+x.maxPrice>0);state[k]=v;save(storeFor[k],v);applied++}
    state.configVer=CONFIG_VER_CURRENT;save(STORE.CONFIG_VER,CONFIG_VER_CURRENT);if(state.autoFavor){state.autoFavor=false;save(STORE.AUTO_FAVOR,false)}goalPlanAll();
    // A zero-section import changed nothing, so it must not create an undo
    // entry the user would then have to step back through.
    if (applied > 0 && !(opts && opts.history === false)) qolHistoryPush(before, (opts && opts.source) || 'import');
    gbLog(`config imported: ${applied} validated section(s)`);return applied>0;
  }



  // ---------- config presets ----------
  // One click for a whole posture. HIGH-RISK loops (favor, auto dodge, recruit,
  // premium culture, merchant/wonder spending) are absent from every preset on
  // purpose: a preset may only ever turn them OFF, never ON, because enabling
  // them is a ToS-escalation decision the user has to make deliberately.
  const CONFIG_PRESET_HIGH_RISK = {
    // 8 toggles - all spend loops and any path that can escalate ToS risk.
    // A preset must only ever set these to OFF, never ON.
    autoFavor: [STORE.AUTO_FAVOR, false],
    autoRecruit: [STORE.AUTO_RECRUIT, false],
    autoDodge: [STORE.AUTO_DODGE, false],
    allowPremiumCulture: [STORE.ALLOW_PREMIUM_CULTURE, false],
    autoMerchant: [STORE.AUTO_MERCHANT, false],
    autoWonder: [STORE.AUTO_WONDER, false],
    autoWonderFavor: [STORE.AUTO_WONDER_FAVOR, false],
    autoPtTrade: [STORE.AUTO_PT_TRADE, false],
    autoVillageRecruit: [STORE.AUTO_VILLAGE_RECRUIT, false],
  };
  const CONFIG_PRESETS = {
    afk: {
      label: 'AFK nocturno',
      values: {
        autoCollect: [STORE.AUTO_COLLECT, true],
        autoFarm: [STORE.AUTO_FARM, true],
        farmLongClaims: [STORE.FARM_LONG_CLAIMS, true],
        autoCave: [STORE.AUTO_CAVE, true],
        abAuto: [STORE.AB_AUTO, true],
        ibAuto: [STORE.IB_AUTO, true],
        autoResearch: [STORE.AUTO_RESEARCH, true],
        autoTrade: [STORE.AUTO_TRADE, true],
        autoCulture: [STORE.AUTO_CULTURE, true],
        autoRuralTrade: [STORE.AUTO_RURAL_TRADE, true],
        orchAdaptive: [STORE.ORCH_ADAPTIVE, true],
        orchDeadlockResolve: [STORE.ORCH_DEADLOCK, true],
        pauseOnActivity: [STORE.PAUSE_ON_ACTIVITY, false],
        nightPause: [STORE.NIGHT_PAUSE, false],
        autoBandit: [STORE.AUTO_BANDIT, false],
        reqBudgetPerMin: [STORE.REQ_BUDGET, 25],
        postsPerMinSoftPct: [STORE.POSTS_SOFT_PCT, 50],
        farmMinMs: [STORE.FARM_MIN, 8 * 60000],
        farmMaxMs: [STORE.FARM_MAX, 10 * 60000],
      },
    },
    farming: {
      label: 'Recoleccion activa',
      values: {
        autoCollect: [STORE.AUTO_COLLECT, true],
        autoFarm: [STORE.AUTO_FARM, true],
        farmLongClaims: [STORE.FARM_LONG_CLAIMS, true],
        autoBandit: [STORE.AUTO_BANDIT, true],
        autoCave: [STORE.AUTO_CAVE, true],
        abAuto: [STORE.AB_AUTO, true],
        ibAuto: [STORE.IB_AUTO, true],
        autoTrade: [STORE.AUTO_TRADE, true],
        autoResearch: [STORE.AUTO_RESEARCH, true],
        autoCulture: [STORE.AUTO_CULTURE, false],
        orchAdaptive: [STORE.ORCH_ADAPTIVE, true],
        orchDeadlockResolve: [STORE.ORCH_DEADLOCK, true],
        pauseOnActivity: [STORE.PAUSE_ON_ACTIVITY, true],
        nightPause: [STORE.NIGHT_PAUSE, false],
        reqBudgetPerMin: [STORE.REQ_BUDGET, 40],
        postsPerMinSoftPct: [STORE.POSTS_SOFT_PCT, 60],
        farmMinMs: [STORE.FARM_MIN, 5 * 60000],
        farmMaxMs: [STORE.FARM_MAX, 6 * 60000],
      },
    },
    war: {
      label: 'Guerra (defensivo)',
      values: {
        autoCollect: [STORE.AUTO_COLLECT, true],
        autoFarm: [STORE.AUTO_FARM, true],
        autoCave: [STORE.AUTO_CAVE, true],
        abAuto: [STORE.AB_AUTO, true],
        ibAuto: [STORE.IB_AUTO, true],
        autoTrade: [STORE.AUTO_TRADE, true],
        autoCulture: [STORE.AUTO_CULTURE, false],
        autoResearch: [STORE.AUTO_RESEARCH, false],
        autoBandit: [STORE.AUTO_BANDIT, false],
        orchAdaptive: [STORE.ORCH_ADAPTIVE, true],
        orchDeadlockResolve: [STORE.ORCH_DEADLOCK, true],
        pauseOnActivity: [STORE.PAUSE_ON_ACTIVITY, true],
        nightPause: [STORE.NIGHT_PAUSE, false],
        reqBudgetPerMin: [STORE.REQ_BUDGET, 40],
        postsPerMinSoftPct: [STORE.POSTS_SOFT_PCT, 70],
      },
    },
  };
  // ===== Profile auto-switching (v4 plan 6.8) ================================
  // A BOUNDED RULE LIST, never user JavaScript. No eval, no expression parser,
  // no free-text condition: a rule is a fixed record of day set, time window and
  // three enumerated conditions, and anything that does not parse is dropped
  // rather than coerced. Nothing here simulates a user event or invents an
  // endpoint - it only calls the existing qolApplyPreset.
  const PROFILE_AUTO_PRESETS = ['afk', 'farming', 'war'];
  const PROFILE_AUTO_WHEN = { activity: ['any', 'active', 'idle'], incoming: ['any', 'yes', 'no'], warehouse: ['any', 'full', 'not-full'] };
  const PROFILE_FULL_RATIO = 0.97;
  function profileAutoCfg() {
    const c = (state.profileAutoCfg && typeof state.profileAutoCfg === 'object' && !Array.isArray(state.profileAutoCfg)) ? state.profileAutoCfg : {};
    const hold = +c.minHoldMin;
    return {
      enabled: c.enabled === true,
      // Floor of 15 minutes: a shorter hold lets two rules ping-pong the whole
      // config on every 20s tick.
      minHoldMin: Number.isFinite(hold) ? Math.max(15, Math.min(1440, hold)) : 15,
      rules: Array.isArray(c.rules) ? c.rules.map(profileAutoNormalise).filter(Boolean) : [],
    };
  }
  function profileAutoNormalise(r) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
    if (!PROFILE_AUTO_PRESETS.includes(r.profile)) return null;
    const days = Array.isArray(r.days) ? r.days.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6) : [];
    // An empty day set never matches. That is deliberate: a rule the user has
    // not scoped to any day should do nothing, not everything.
    const mins = v => { const n = +v; return Number.isInteger(n) && n >= 0 && n <= 1439 ? n : null; };
    const startMin = mins(r.startMin), endMin = mins(r.endMin);
    if (startMin == null || endMin == null) return null;
    const w = (r.when && typeof r.when === 'object') ? r.when : {};
    const when = {};
    for (const k of Object.keys(PROFILE_AUTO_WHEN)) {
      when[k] = PROFILE_AUTO_WHEN[k].includes(w[k]) ? w[k] : 'any';
    }
    const pr = +r.priority;
    return {
      id: /^[A-Za-z0-9_:-]{1,32}$/.test(String(r.id || '')) ? String(r.id) : ('r' + startMin + '-' + endMin + '-' + r.profile),
      enabled: r.enabled !== false,
      priority: Number.isFinite(pr) ? Math.max(0, Math.min(999, Math.floor(pr))) : 100,
      profile: r.profile, days, startMin, endMin, when,
    };
  }
  function profileAutoInWindow(rule, now) {
    if (!rule.days.includes(now.getDay())) return false;
    const m = now.getHours() * 60 + now.getMinutes();
    // Half-open [start, end); start > end crosses midnight. Same explicit form
    // the night-pause window uses rather than guessing server time.
    return rule.startMin <= rule.endMin
      ? (m >= rule.startMin && m < rule.endMin)
      : (m >= rule.startMin || m < rule.endMin);
  }
  // Each reader returns 'yes' | 'no' | null, where null is BLIND. A blind read
  // never satisfies a condition and never falsifies one - the rule just does
  // not match, and the reason is logged once.
  function profileAutoActivity() {
    if (!state.pauseOnActivity) return 'idle';
    return (typeof userPausedUntil === 'number' && Date.now() < userPausedUntil) ? 'active' : 'idle';
  }
  function profileAutoIncoming() {
    try { return (dodgeIncomingMovements() || []).length ? 'yes' : 'no'; } catch (_) { return null; }
  }
  function profileAutoWarehouse() {
    let ids = [];
    try { ids = Object.keys((gameUw().ITowns && gameUw().ITowns.towns) || {}); } catch (_) { return null; }
    if (!ids.length) return null;
    let anyFull = false, allReadable = true;
    for (const id of ids) {
      const rs = (typeof townResState === 'function') ? townResState(id) : null;
      if (!rs || !(rs.cap > 0)) { allReadable = false; continue; }
      if (Math.max(rs.wood, rs.stone, rs.iron) / rs.cap >= PROFILE_FULL_RATIO) anyFull = true;
    }
    if (anyFull) return 'full';
    // "not-full" requires EVERY town to have been readable: one unreadable town
    // could be the full one.
    return allReadable ? 'not-full' : null;
  }
  function profileAutoMatch(rule, reads) {
    for (const k of Object.keys(PROFILE_AUTO_WHEN)) {
      const want = rule.when[k];
      if (want === 'any') continue;
      const got = reads[k];
      if (got == null) return false; // blind: does not match, does not falsify
      if (k === 'activity' && got !== want) return false;
      if (k !== 'activity' && got !== want) return false;
    }
    return true;
  }
  function profileAutoLast() {
    const l = state.profileAutoLast;
    return (l && typeof l === 'object' && !Array.isArray(l)) ? l : { profile: null, ruleId: null, switchedAt: 0 };
  }
  function profileAutoTick() {
    const cfg = profileAutoCfg();
    if (!cfg.enabled || !cfg.rules.length) return;
    const now = new Date();
    const reads = { activity: profileAutoActivity(), incoming: profileAutoIncoming(), warehouse: profileAutoWarehouse() };
    for (const k of Object.keys(reads)) {
      if (reads[k] == null) gbLogT('profile-auto-blind-' + k, 600000, `profile-auto: ${k} unreadable - rules needing it will not match`);
    }
    const hit = cfg.rules
      .filter(r => r.enabled && profileAutoInWindow(r, now) && profileAutoMatch(r, reads))
      .sort((a, b) => (a.priority - b.priority) || String(a.id).localeCompare(String(b.id)))[0];
    // No match keeps the CURRENT profile. Bouncing back to a default would make
    // every gap in the schedule a config change.
    if (!hit) return;
    const last = profileAutoLast();
    if (last.profile === hit.profile) return;
    const held = Date.now() - (+last.switchedAt || 0);
    if (last.profile && held < cfg.minHoldMin * 60000) return;
    const from = last.profile || '(ninguno)';
    if (!qolApplyPreset(hit.profile)) return;
    state.profileAutoLast = { profile: hit.profile, ruleId: hit.id, switchedAt: Date.now() };
    save(STORE.PROFILE_AUTO_LAST, state.profileAutoLast);
    gbLog(`profile-auto: switched ${from} -> ${hit.profile} (rule ${hit.id}; activity=${reads.activity}; incoming=${reads.incoming}; warehouse=${reads.warehouse})`);
    try { updateStatus(); } catch (_) {}
    try { bindConfig(); } catch (_) {}
  }
  function profileAutoSave(list) {
    const rules = (Array.isArray(list) ? list : []).map(profileAutoNormalise).filter(Boolean);
    state.profileAutoCfg = Object.assign({}, state.profileAutoCfg, { rules });
    save(STORE.PROFILE_AUTO_CFG, state.profileAutoCfg);
    return rules;
  }
  function qolApplyPreset(name, opts) {
    const preset = CONFIG_PRESETS[name];
    if (!preset) return false;
    const histBefore = (opts && opts.history === false) ? null : qolConfigSnapshot();
    const applied = [];
    const put = (key, pair) => {
      const [store, val] = pair;
      if (state[key] === val) return;
      state[key] = val;
      save(store, val);
      applied.push(key + '=' + val);
    };
    Object.keys(preset.values).forEach(k => put(k, preset.values[k]));
    Object.keys(CONFIG_PRESET_HIGH_RISK).forEach(k => put(k, CONFIG_PRESET_HIGH_RISK[k]));
    if (name === 'war') {
      // Notify, never auto: dodging on its own is the highest-risk loop there is.
      if (!state.defenseCfg || typeof state.defenseCfg !== 'object') state.defenseCfg = { mode: 'notify', returnMarginSec: 120, smartAuto: false };
      state.defenseCfg.mode = 'notify';
      save(STORE.DEFENSE_CFG, state.defenseCfg);
      state.webhookEvents = Object.assign({}, state.webhookEvents || {}, { captcha: true, attack: true });
      save(STORE.WEBHOOK_EVENTS, state.webhookEvents);
    }
    if (histBefore) qolHistoryPush(histBefore, 'preset:' + name);
    gbLog(`config preset "${preset.label}" applied: ${applied.length} setting(s) changed; HIGH-RISK loops forced OFF`);
    return true;
  }

  const ORCH_MS = 20000;
  const ORCH_MAX_PER_TICK = 3;
  const ORCH_SPACING_MS = 450;
  const ORCH_JITTER = 0.2;
  const ORCH_CADENCE = {
    culture: 90000,
    cave: 30000,
    build: 30000,
    research: 45000,
    trade: 120000,
    farm: 60000,
    ruraltrade: 90000,
    rurallevel: 120000,
    recruit: 30000,
    villrecruit: 300000,
    merchant: 45000,
    pttrade: 120000,
    favor: 60000,
    wonder: 180000,
    spy: 1800000,
    hero: 300000,
    godspell: 180000,
  };
  const ORCH_CAPTCHA = {
    culture: 'culture', cave: 'cave', build: 'build', research: 'research',
    trade: 'trade', farm: 'farm', ruraltrade: 'ruraltrade', rurallevel: 'rurallevel',
    recruit: 'recruit', villrecruit: 'villageRecruit', merchant: 'merchant', pttrade: 'pttrade', favor: 'favor', wonder: 'wonder', spy: 'spy', hero: 'hero', godspell: 'godspell',
  };

  const ORCH_JRN = {
    culture: 'culture', cave: 'cave', build: 'build', research: 'research',
    trade: 'trade', farm: 'farm', ruraltrade: 'ruraltrade', rurallevel: 'rurallevel',
    recruit: 'recruit', villrecruit: 'villageRecruit', merchant: 'merchant', pttrade: 'pttrade', favor: 'favor', wonder: 'wonder', spy: 'spy', hero: 'hero', godspell: 'godspell',
  };
  const ORCH_IDLE_TRIP = 4;
  const ORCH_IDLE_MAX = 8;
  const orchLastRun = {};
  const orchIdle = {};
  const orchJrnMark = {};
  function orchSafe(key,fn){try{return fn()}catch(e){const msg=String(e&&e.stack||e).slice(0,220);gbLog(`orch ${key} exception: ${msg}`);markModuleHealth(key,'err',{error:msg});whyNote(key,'orchestrator','error',msg);orchIdle[key]=0;return null}}
  const ORCH_HANDLERS = {
    culture:()=>orchSafe('culture',()=>profTime('orch:culture',()=>cultureScan('orch'))),
    cave:()=>orchSafe('cave',()=>profTime('orch:cave',()=>caveScan('orch'))),
    build:()=>orchSafe('build',()=>profTime('orch:build',()=>{abEnsureTargets();abScan('orch')})),
    research:()=>orchSafe('research',()=>profTime('orch:research',()=>researchScan('orch'))),
    trade:()=>orchSafe('trade',()=>profTime('orch:trade',()=>tradeScan('orch'))),
    farm:()=>orchSafe('farm',()=>profTime('orch:farm',()=>autoClaimFarms('orch'))),
    ruraltrade:()=>orchSafe('ruraltrade',()=>profTime('orch:ruraltrade',()=>ruralTradeScan('orch'))),
    rurallevel:()=>orchSafe('rurallevel',()=>profTime('orch:rurallevel',()=>ruralLevelScan('orch'))),
    recruit:()=>orchSafe('recruit',()=>profTime('orch:recruit',()=>recruitScan('orch'))),
    villrecruit:()=>orchSafe('villrecruit',()=>profTime('orch:villrecruit',()=>villageRecruitScan('orch'))),
    merchant:()=>orchSafe('merchant',()=>profTime('orch:merchant',()=>merchantScan('orch'))),
    pttrade:()=>orchSafe('pttrade',()=>profTime('orch:pttrade',()=>ptTradeScan('orch'))),
    favor:()=>orchSafe('favor',()=>profTime('orch:favor',()=>favorScan('orch'))),
    wonder:()=>orchSafe('wonder',()=>profTime('orch:wonder',()=>{wonderScan('orch');wonderFavorScan('orch')})),
    spy:()=>orchSafe('spy',()=>profTime('orch:spy',()=>spyCycle('orch'))),
    hero:()=>orchSafe('hero',()=>profTime('orch:hero',()=>heroScan('orch'))),
    godspell:()=>orchSafe('godspell',()=>profTime('orch:godspell',()=>godSpellScan('orch'))),
  };
