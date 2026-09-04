  function gbWidgetSaveGeom(id, pos) {
    const g = gbWidgetGeom();
    g[String(id)] = { left: pos.left, top: pos.top };
    save(STORE.WIDGET_GEOM, g);
  }
  function gbWidgetRegister(opts) {
    const o = opts || {};
    const id = String(o.id || '');
    if (!id) return null;

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
    const close = gbButton('\u00d7', {
      title: 'Cerrar',
      style: 'margin-left:auto;background:none;border:1px solid var(--gb-chrome-3);color:var(--gb-fg-2);cursor:pointer;font-size:11px;line-height:1;padding:0 5px',
    });
    head.append(title, close);
    const body = document.createElement('div');
    body.className = 'gb-widget-body';
    body.style.cssText = 'padding:6px';
    host.append(head, body);
    document.body.appendChild(host);
    try { applyTheme(); } catch (_) {}

    let drag = null;
    let timer = 0;

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

      if (moved) gbWidgetSaveGeom(id, { left: host.style.left, top: host.style.top });
    });
    const api = {
      id,
      el: host,
      isOpen: () => host.style.display !== 'none',
      open() {
        host.style.display = 'block';
        render();

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

  const GB_KEY_ACTIONS = {
    'panel-config': { label: 'Abrir Config', run: () => { showTab('config'); } },
    'preflight': { label: 'Comprobar sistema', run: () => { showTab('stats'); preflightRunAndRender(); } },
    'copy-findings': { label: 'Copiar hallazgos', run: () => { const b = panel && panel.querySelector('footer button[data-act=copy]'); if (b) b.click(); } },
    'copy-all': { label: 'Copiar todo (log + datos)', run: () => bundleCopy() },
    'queue-center': { label: 'Abrir Colas', run: () => openQueueCenter() },
    'rescan-inbox': { label: 'Releer bandeja', run: () => scrapeInboxDom() },
    'diag': { label: 'Diagnostico', run: () => diagRun() },

    'panic': {
      label: 'PANICO (parar todo)',
      run: () => {
        const fired = gbPanicActivate();
        flash(fired ? 'PANICO: automatizacion detenida' : 'PANICO ya activo');
      },
    },
    'toggle-profiler': {
      label: 'Perfilador ON/OFF',
      run: () => {
        state.profilerOn = !state.profilerOn;
        save(STORE.PROFILER_ON, state.profilerOn);
        flash('perfilador ' + (state.profilerOn ? 'ON' : 'OFF'));
      },
    },
  };
  const GB_KEY_DEFAULTS = {
    'Ctrl+Shift+,': 'panel-config',
    'Ctrl+Shift+P': 'preflight',
    'Ctrl+Shift+F': 'copy-findings',
    'Ctrl+Shift+Q': 'queue-center',
    'Ctrl+Shift+R': 'rescan-inbox',
    'Ctrl+Shift+L': 'toggle-pause',
    'Ctrl+Shift+D': 'diag',
    'Ctrl+Shift+B': 'copy-all',
    'Ctrl+Shift+Backspace': 'panic',
    'Ctrl+Alt+P': 'toggle-profiler',
  };
  function gbKeyBindings() {
    const b = state.keybindings;
    return (b && typeof b === 'object' && !Array.isArray(b)) ? Object.assign({}, GB_KEY_DEFAULTS, b) : Object.assign({}, GB_KEY_DEFAULTS);
  }

  const GB_KEY_CODE_CHAR = {
    Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'",
    BracketLeft: '[', BracketRight: ']', Backslash: '\\', Backquote: '`',
    Minus: '-', Equal: '=',
  };

  const GB_KEY_NAMED = new Set(['Backspace', 'Delete', 'Escape', 'Enter', 'Home', 'End']);
  function gbKeyChars(e) {
    const out = [];
    const code = String(e.code || '');
    if (/^Key[A-Z]$/.test(code)) out.push(code.slice(3));
    else if (/^Digit[0-9]$/.test(code)) out.push(code.slice(5));
    else if (GB_KEY_CODE_CHAR[code]) out.push(GB_KEY_CODE_CHAR[code]);
    const k = String(e.key || '');

    if (k.length === 1) { const u = k.toUpperCase(); if (!out.includes(u)) out.push(u); }
    else if (GB_KEY_NAMED.has(k) && !out.includes(k)) out.push(k);
    return out;
  }

  function gbKeyFingerprints(e) {
    if (!(e.ctrlKey || e.metaKey)) return [];
    const prefix = 'Ctrl+' + (e.altKey ? 'Alt+' : '') + (e.shiftKey ? 'Shift+' : '');
    return gbKeyChars(e).map(c => prefix + c);
  }
  function gbKeyTypingTarget(e) {
    const ae = document.activeElement;
    if (ae) {
      const tag = String(ae.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (ae.isContentEditable) return true;
    }

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
    const sec=panel&&panel.querySelector('section[data-tab=overview]');if(!sec||sec.hidden)return;const box=sec.querySelector('.goals-panel');if(!box)return;
    let ids=[];try{ids=Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{})}catch(_){};const profiles=goalProfiles();

    const sig=[ids.join(','),Object.keys(profiles).join(','),state.abOptimalOrderOn!==false?'1':'0'];
    for(const tid of ids){const p=goalPlanTown(tid),c=cdIsProfile(p.profile)?cdTownState(tid):null;sig.push(tid+':'+p.progress+':'+p.profile+':'+(p.actions||[]).length+(c?':'+c.revision+':'+cdPhase(tid)+':'+(+c.stripEnabled)+':'+(+c.safeBackline)+':'+(+c.breakthrough)+':'+(+c.wallMax):''))}
    const sigStr=sig.join('|');
    if(box.dataset.gbGoalsSig===sigStr)return;
    box.dataset.gbGoalsSig=sigStr;
    box.replaceChildren();
    const rerender=()=>{renderGoals();renderPlanner();renderDashboard();};
    for(const tid of ids){let name=tid;try{const t=gbTownModel(tid);name=(t&&t.getName&&t.getName())||name}catch(_){} const plan=goalPlanTown(tid);
      const head=document.createElement('div');head.style.cssText='display:flex;gap:4px;align-items:center;padding:4px;border-bottom:1px solid #333';const b=document.createElement('b');b.textContent=`${name} \u00b7 ${plan.progress}%`;head.appendChild(b);
      const edit=gbButton('Edit',{title:'Edit per-town goal overrides/reserves as JSON',style:'font-size:8px;padding:1px 4px',onClick:()=>{const cur=goalTownCfg(tid),raw=prompt('Overrides de objetivos por ciudad JSON\nClaves: build, research, units, reserve:{hard,soft}, defensive (0..1, null = hereda del perfil), resource:{wood,stone,iron} (-1..+1)',JSON.stringify({build:cur.build,research:cur.research,units:cur.units,reserve:cur.reserve,defensive:cur.defensive!=null?cur.defensive:null,resource:cur.resource||{}},null,2));if(raw==null)return;try{if(!goalSetTownOverrides(tid,JSON.parse(raw)))throw new Error('invalid object');rerender()}catch(e){flash('JSON de objetivos invalido')}}});head.appendChild(edit);
      const rec=gbButton('Recalc',{title:'Recalcular el plan de objetivos de esta ciudad',style:'font-size:8px;padding:1px 4px',onClick:()=>{goalPlanTown(tid);rerender()}});head.appendChild(rec);
      const reset=gbButton('Reset Q',{title:'Clear virtual-queue order/block/mandatory overrides',style:'font-size:8px;padding:1px 4px',onClick:()=>{goalQueueReset(tid);rerender()}});head.appendChild(reset);
      const sel=document.createElement('select');sel.title='Perfil de la ciudad. "Personalizado" = usa los overrides JSON de esta ciudad (boton Edit); cualquier otro perfil los sustituye.';sel.style.cssText='background:#111;color:#cfc;border:1px solid #333;font-size:9px;margin-left:auto';for(const [id,p] of Object.entries(profiles)){const o=document.createElement('option');o.value=id;o.textContent=p.label||id;sel.appendChild(o)}sel.value=plan.profile;sel.addEventListener('change',()=>{goalSetProfile(tid,sel.value);rerender()});head.appendChild(sel);box.appendChild(head);
      if(cdIsProfile(plan.profile)){const c=cdTownState(tid),row=document.createElement('div');row.style.cssText='display:flex;gap:10px;align-items:center;padding:2px 6px;border-bottom:1px solid #262626;font-size:9px;color:#aaa';const st=document.createElement('b');st.textContent='City Designer: '+cdPhase(tid)+' · rev '+c.revision;st.style.color='#9fd';row.appendChild(st);const mk=(key,label,title)=>{const lab=document.createElement('label');lab.title=title;lab.style.cssText='display:flex;gap:3px;align-items:center';const cb=document.createElement('input');cb.type='checkbox';cb.checked=!!c[key];cb.addEventListener('change',()=>{cdSetOption(tid,key,cb.checked);rerender()});lab.appendChild(cb);lab.appendChild(document.createTextNode(label));row.appendChild(lab)};mk('stripEnabled','permitir strip','Permite demoliciones finales solo tras todos los gates de seguridad');mk('safeBackline','backline segura','Confirmación persistente del usuario: esta ciudad es backline segura');mk('wallMax','muralla MAX','ON: el City Designer lleva la muralla al máximo. OFF: no la construye y, si autorizas strip, el objetivo final es 0.');if(cdCanonicalProfile(plan.profile)==='cd_slinger_50ls')mk('breakthrough','Penetración','Investigación táctica opcional; OFF por defecto');box.appendChild(row)}

      if (state.abOptimalOrderOn !== false) {
        try {
          const opt=abOptimalOrderCached(tid), first=((opt&&opt.actions)||[]).slice(0,4);
          if(first.length){const o=document.createElement('div');o.style.cssText='padding:1px 6px;color:#8ac;font-size:9px';
            o.title='Secuencia aconsejada (solo consejo). Aplicala desde Colas > Construccion.';
            o.textContent='  optima: '+first.map(a=>`${a.building}${a.level?' '+a.level:''}`).join(' > ');box.appendChild(o)}
        } catch (_) {}
      }
      const lines=(plan.actions||[]).slice(0,12);if(!lines.length){const e=document.createElement('div');e.textContent='  objetivo cumplido / sin acciones';e.style.cssText='padding:2px 6px;color:#777';gbTip(e,'No hay acciones pendientes: o el plan esta cumplido o la ciudad no tiene objetivos');box.appendChild(e)}else for(const a of lines){const row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:1fr auto;gap:3px;padding:2px 4px;border-bottom:1px solid #1e1e1e;align-items:center';const text=document.createElement('span');const c=a.cost||{},cost=[c.wood||0,c.stone||0,c.iron||0].join('/');text.textContent=`${a.mandatory?'! ':''}${a.kind} ${a.id}${a.level?' \u2192 '+a.level:''}${a.amount?' \u00d7'+a.amount:''} \u00b7 ${a.status} \u00b7 ${cost}${a.why?' \u00b7 '+a.why:''}`;gbTip(text,'Accion del plan: tipo, nivel, cantidad, estado, coste y motivo');row.appendChild(text);const acts=document.createElement('span');acts.style.cssText='display:flex;gap:2px';const mk=(label,title,fn)=>{const x=document.createElement('button');x.textContent=label;gbTip(x,title);x.style.cssText='font-size:8px;padding:0 3px';x.addEventListener('click',()=>{fn();rerender()});acts.appendChild(x)};mk('\u2191','Subir en la cola virtual',()=>goalQueueMove(tid,a.queueKey,-1));mk('\u2193','Bajar en la cola virtual',()=>goalQueueMove(tid,a.queueKey,1));mk(a.status==='user-blocked'?'ON':'B','Bloquear o desbloquear esta accion',()=>goalQueueToggleBlock(tid,a.queueKey));mk(a.mandatory?'*':'!','Marcar o desmarcar como prioridad obligatoria',()=>goalQueueToggleMandatory(tid,a.queueKey));mk('\u00d7','Suprimir hasta Reset Q',()=>goalQueueHide(tid,a.queueKey));row.appendChild(acts);box.appendChild(row)}
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
        gbTip(lab, `Reserva ${mode} (se respeta antes de enviar) para ${k}`);
        const inp=document.createElement('input'); inp.type='number'; inp.min='0'; inp.style.cssText='width:55px;background:#111;color:#cfc;border:1px solid #333;font-size:9px';
        gbTip(inp, `Cantidad de ${k} que se reserva (${mode})`);
        inp.dataset.mode=mode; inp.dataset.key=k; inp.value=g[mode][k]||0;

        inp.addEventListener('change',()=>{ const root=plannerCfgRoot().global; root[mode][k]=Math.max(0,+inp.value||0); plannerSaveCfg(); renderPlanner(); });
        lab.appendChild(inp); controls.appendChild(lab);
      }
    } else {
      controls.querySelectorAll('input[data-mode][data-key]').forEach(inp=>{
        const m=inp.dataset.mode,k=inp.dataset.key;
        if(document.activeElement!==inp) inp.value=(g[m]&&g[m][k])||0;
      });
    }

    const ids=[]; try{ Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{}).forEach(x=>ids.push(x)); }catch(_){}
    const snapSig=[ids.join(','),(g.hard.wood|0)+'/'+(g.hard.stone|0)+'/'+(g.hard.iron|0)+'|'+(g.soft.wood|0)+'/'+(g.soft.stone|0)+'/'+(g.soft.iron|0)];
    for(const tid of ids){const s=plannerSnapshot(tid);snapSig.push(tid+':'+(s?(+s.live.wood|0)+','+(+s.live.stone|0)+','+(+s.live.iron|0)+','+(+s.committed.wood|0)+','+(+s.committed.stone|0)+','+(+s.committed.iron|0)+','+(+s.availableSoft.wood|0)+','+(+s.availableSoft.stone|0)+','+(+s.availableSoft.iron|0)+','+(+s.availableSoft.population|0)+','+(+s.availableSoft.tradeCap|0):'none'))}
    const plannerSig=snapSig.join('|');
    if(box.dataset.gbPlannerSig===plannerSig)return;
    box.dataset.gbPlannerSig=plannerSig;
    box.replaceChildren();
    const hdr=document.createElement('div'); hdr.style.cssText='display:grid;grid-template-columns:1.3fr repeat(3,.8fr) .7fr .7fr;gap:3px;padding:3px;color:#888;border-bottom:1px solid #333';
    hdr.textContent=''; ['town','real W/S/I','reserved W/S/I','available W/S/I','pop','merchants'].forEach(x=>{const s=document.createElement('span');s.textContent=x;gbTip(s, ['Nombre de la ciudad','Stock real en el almacen (madera/piedra/plata)','Reservado por la cola virtual','Disponible tras restar la reserva','Poblacion libre para reclutar','Capacidad de mercantes libres'][ ['town','real W/S/I','reserved W/S/I','available W/S/I','pop','merchants'].indexOf(x) ]||'');hdr.appendChild(s)}); gbTip(hdr, 'Cabecera de la tabla de recursos y reservas por ciudad'); box.appendChild(hdr);
    for(const tid of ids){ const s=plannerSnapshot(tid); if(!s) continue; let name=tid; try{const t=gbTownModel(tid); name=(t&&t.getName&&t.getName())||name}catch(_){}
      const row=document.createElement('div'); row.style.cssText='display:grid;grid-template-columns:1.3fr repeat(3,.8fr) .7fr .7fr;gap:3px;padding:3px;border-bottom:1px solid #222';
      const vals=[name,`${plannerFmt(s.live.wood)}/${plannerFmt(s.live.stone)}/${plannerFmt(s.live.iron)}`,`${plannerFmt(s.committed.wood)}/${plannerFmt(s.committed.stone)}/${plannerFmt(s.committed.iron)}`,`${plannerFmt(s.availableSoft.wood)}/${plannerFmt(s.availableSoft.stone)}/${plannerFmt(s.availableSoft.iron)}`,`${plannerFmt(s.availableSoft.population)}`,`${plannerFmt(s.availableSoft.tradeCap)}`];
      vals.forEach(v=>{const e=document.createElement('span');e.textContent=v;row.appendChild(e)}); row.title=`hard reserve ${JSON.stringify(s.reserve.hard)} | soft ${JSON.stringify(s.reserve.soft)} | incoming ${JSON.stringify(s.incoming)}`; gbTip(row, `Reservas duras: ${JSON.stringify(s.reserve.hard)} | blandas: ${JSON.stringify(s.reserve.soft)} | entrantes: ${JSON.stringify(s.incoming)}`); box.appendChild(row);
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
    };
  }
  function renderHealth() {
    const sec=panel&&panel.querySelector('section[data-tab=overview]');if(!sec||sec.hidden)return;const box=sec.querySelector('.health-panel');if(!box)return;
    const names=new Set([...Object.keys(moduleHealth||{}),...Object.keys(state.circuits||{})]);

    const sigParts=[];
    for(const name of names){const h=moduleHealth[name]||{},c=state.circuits&&state.circuits[name];sigParts.push(name+':'+(h.ok||0)+'/'+(h.err||0)+':'+(h.timeout||0)+':'+(h.avgLatency==null?'-':Math.round(h.avgLatency))+':'+(h.last||'-')+':'+(c&&c.open?'O':(c&&c.strikes?'S'+c.strikes:'K')))}
    const sig=sigParts.join('|');
    if(box.dataset.gbHealthSig===sig)return;
    box.dataset.gbHealthSig=sig;
    box.replaceChildren();
    if(!names.size){box.textContent='(no module activity yet)';return}
    const hdr=document.createElement('div');hdr.style.cssText='display:grid;grid-template-columns:1fr repeat(5,.7fr);gap:3px;color:#888;border-bottom:1px solid #333;padding:2px';['module','ok/err','timeout','lat ms','last','circuit'].forEach(v=>{const x=document.createElement('span');x.textContent=v;gbTip(x, ['Nombre del modulo','OK / errores acumulados','Timeouts acumulados','Latencia media (ms)','Segundos desde la ultima actividad','Estado del cortacircuito'][ ['module','ok/err','timeout','lat ms','last','circuit'].indexOf(v) ]||'');hdr.appendChild(x)});gbTip(hdr,'Cabecera de la tabla de salud de cada modulo');box.appendChild(hdr);
    [...names].sort().forEach(name=>{const h=moduleHealth[name]||{},c=state.circuits&&state.circuits[name];const row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:1fr repeat(5,.7fr);gap:3px;border-bottom:1px solid #222;padding:2px';gbTip(row, `Salud del modulo ${name}`);const age=h.last?fmtSec((Date.now()-h.last)/1000):'-';const vals=[name,`${h.ok||0}/${h.err||0}`,String(h.timeout||0),h.avgLatency==null?'-':String(Math.round(h.avgLatency)),age,c&&c.open?'OPEN':(c&&c.strikes?`strike ${c.strikes}`:'ok')];vals.forEach(v=>{const x=document.createElement('span');x.textContent=v;row.appendChild(x)});box.appendChild(row)})
  }

  function simulateTown(townId,horizonHours){const h=Math.max(1,+horizonHours||24),snap=plannerSnapshot(townId),forecast=economyForecast(townId,h*3600),plan=goalPlanTown(townId);if(!snap)return{townId:String(townId),error:'state-unreadable',actions:[]};const stock={wood:snap.availableSoft.wood,stone:snap.availableSoft.stone,iron:snap.availableSoft.iron,population:snap.availableSoft.population};if(forecast&&forecast.production){for(const k of ['wood','stone','iron'])stock[k]+=forecast.production[k]*h}const actions=[];let bottleneck='';for(const a of(plan.actions||[])){if(a.kind==='build'&&a.costExact===false){const why='future build cost requires live recalculation after previous level';actions.push({...a,sim:'waiting',simWhy:why});if(!bottleneck)bottleneck=why;break}const c=plannerNormCost(a.cost);if(!c){actions.push({...a,sim:'blocked:cost'});continue}let ok=true,why='';for(const k of PLANNER_KEYS){if((+c[k]||0)>+(stock[k]||0)){ok=false;why=`${k} ${Math.floor(stock[k]||0)}/${Math.ceil(c[k]||0)}`;break}}if(!ok){actions.push({...a,sim:'waiting',simWhy:why});if(!bottleneck)bottleneck=why;break}for(const k of PLANNER_KEYS)stock[k]-=+c[k]||0;actions.push({...a,sim:'would-run'})}return{townId:String(townId),horizonHours:h,actions,final:stock,bottleneck,productionKnown:!!(forecast&&forecast.productionKnown)}}
  function simulateAccount(horizonHours){let ids=[];try{ids=Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{})}catch(_){};const towns=ids.map(id=>simulateTown(id,horizonHours));return{at:Date.now(),horizonHours:+horizonHours||24,towns,totalActions:towns.reduce((n,t)=>n+t.actions.filter(a=>a.sim==='would-run').length,0),blocked:towns.filter(t=>t.bottleneck).length}}
  let dashboardSimulation=null;
  function renderDashboard() {
    const sec=panel&&panel.querySelector('section[data-tab=overview]');
    if(!sec||sec.hidden)return;
    const sum=sec.querySelector('.dashboard-summary'),time=sec.querySelector('.timeline-panel'),sim=sec.querySelector('.sim-panel'),cards=sec.querySelector('.gb-dashboard-cards');
    const attBox=sec.querySelector('.gb-attention');
    if(!sum||!time||!sim)return;
    let ids=[];try{ids=Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{})}catch(_){}
    const threats=dodgeIncomingMovements();
    const unknown=Object.values(state.txState||{}).filter(t=>t&&/^(unknown|manual-review)$/.test(t.state||'')).length;
    const circuits=Object.keys(state.circuits||{}).filter(k=>state.circuits[k]&&state.circuits[k].open);
    const captchaKeys=Object.keys(state.captchaBreakers||{}).filter(k=>captchaPaused(k));
    const fps=clientFingerprintNow();
    const compatible=Object.values(fps.required).every(Boolean);
    const activeGoals=ids.filter(id=>(goalPlanTown(id).actions||[]).length).length;
    const avgProgress=ids.length?Math.round(ids.reduce((n,id)=>n+goalProgress(id),0)/ids.length):100;
    const pauseInfo={}; const paused=automationPaused(pauseInfo);
    const overflow=[];
    for(const id of ids){
      const f=economyForecast(id);
      if(f&&Object.values(f.overflow||{}).some(Boolean)){
        let name=id;try{name=gbTownModel(id).getName()||id}catch(_){}
        overflow.push(name+': '+Object.entries(f.overflow).filter(([,v])=>v).map(([k])=>k).join('/'));
      }
    }
    if(attBox){
      const items=gbAttentionItems({threats,unknown,circuits,captchaKeys,compatible,fps,overflow});
      gbPaint(attBox, stage => { items.forEach(it => stage.appendChild(gbAttentionEl(it))); }, { key: items.map(i => i.title).join('|') });
    }
    sum.textContent=`towns ${ids.length} \u00b7 progress ${avgProgress}% \u00b7 ${activeGoals} objetivo(s) activos \u00b7 ${unknown} transacci\u00f3n(es) pendientes de revisar \u00b7 ${circuits.length} circuit breaker abierto(s)`;
    if(cards){
      cards.replaceChildren();
      const data=[
        ['Ciudades',ids.length,activeGoals?`${activeGoals} con trabajo pendiente`:'sin objetivos pendientes'],
        ['Progreso',`${avgProgress}%`,avgProgress>=100?'objetivos completados':'media de objetivos'],
        ['Amenazas',threats.length,threats.length?'requieren revisi\u00f3n':'sin entradas hostiles detectadas'],
        ['Sistema',compatible&&!unknown&&!circuits.length?'OK':'Revisar',paused?`pausado: ${pauseInfo.reason}`:(state.safeMode?'SAFE MODE':'automatizaci\u00f3n disponible')],
      ];
      for(const [k,v,sub] of data){const c=document.createElement('div');c.className='gb-card';gbTip(c, sub);const a=document.createElement('div');a.className='k';a.textContent=k;const b=document.createElement('div');b.className='v';b.textContent=String(v);const d=document.createElement('div');d.className='s';d.textContent=sub;c.append(a,b,d);cards.appendChild(c)}
    }
    const mode=panel.querySelector('#gb-head-mode');if(mode){mode.textContent=state.safeMode?'SAFE':'NORMAL';mode.className='gb-pill '+(state.safeMode?'warn':'ok')}
    const health=panel.querySelector('#gb-head-health');if(health){const bad=!compatible||unknown||circuits.length;health.textContent=bad?'REVISAR':'SISTEMA OK';health.className='gb-pill '+(bad?'bad':'ok');const tipParts=[];if(!compatible){const miss=Object.entries(fps.required||{}).filter(([,v])=>!v).map(([k])=>k);tipParts.push('fp falta: '+(miss.length?miss.join(','):'fingerprint roto'))}if(unknown){const stuck=Object.entries(state.txState||{}).filter(([,t])=>t&&/^(unknown|manual-review)$/.test(t.state||'')).map(([k])=>k);tipParts.push('tx '+unknown+': '+(stuck.slice(0,4).join(',')+(stuck.length>4?' +'+(stuck.length-4):'')))}if(circuits.length){tipParts.push('cb '+circuits.length+': '+circuits.slice(0,4).join(',')+(circuits.length>4?' +'+(circuits.length-4):''))}gbTip(health, tipParts.length?tipParts.join(' \u00b7 '):'Salud agregada OK')}
    const quickSafe=sec.querySelector('#gb-quick-safe');if(quickSafe)quickSafe.textContent=state.safeMode?'SAFE MODE: ON':'SAFE MODE: OFF';
    const rows=[];
    for(const id of ids){let name=id;try{name=gbTownModel(id).getName()||id}catch(_){}const p=goalPlanTown(id),f=economyForecast(id);const a=(p.actions||[])[0];if(a)rows.push(`${name}: ${a.kind} ${a.id}${a.level?' \u2192 '+a.level:''} \u00b7 ${a.status}${a.why?' \u00b7 '+a.why:''}`);if(f&&Object.values(f.overflow).some(Boolean))rows.push(`${name}: AVISO \u00b7 almac\u00e9n previsto al l\u00edmite en ${Object.entries(f.overflow).filter(([,v])=>v).map(([k])=>k).join(', ')}`)}
    time.textContent=rows.slice(0,30).join('\n')||'No hay acciones planificadas.';
    if(dashboardSimulation){const lines=[`Simulaci\u00f3n ${dashboardSimulation.horizonHours} h \u00b7 ${dashboardSimulation.totalActions} acciones \u00b7 ${dashboardSimulation.blocked} ciudad(es) con cuello de botella`];for(const t of dashboardSimulation.towns)lines.push(`Ciudad ${t.townId}: ${t.actions.filter(a=>a.sim==='would-run').length} acciones \u00b7 final ${Math.floor(t.final.wood)}/${Math.floor(t.final.stone)}/${Math.floor(t.final.iron)} \u00b7 ${t.bottleneck||'sin bloqueo'}${t.productionKnown?'':' \u00b7 producci\u00f3n desconocida'}`);sim.textContent=lines.join('\n')}else sim.textContent='Todav\u00eda no se ha ejecutado una simulaci\u00f3n.';
    const why=sec.querySelector('.why-panel');if(why)why.textContent=(state.whyLog||[]).slice(0,12).map(x=>`${new Date(x.ts).toLocaleTimeString()} \u00b7 ${x.feature} \u00b7 ${x.status}${x.why?' \u00b7 '+x.why:''}`).join('\n')||'Todav\u00eda no hay decisiones registradas.';
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
        return 'Health: ' + (parts.length ? parts.join(' \u00b7 ') : '(none yet)');
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

  const CONFIG_HISTORY_MAX = 20;
  const CONFIG_HISTORY_TTL_MS = 7 * 86400000;
  const CONFIG_SNAPSHOT_KEYS = [
    'abTargets', 'abOrder', 'researchTargets', 'recruitTargets', 'plannerCfg',
    'goalProfiles', 'townGoals', 'virtualQueueOverrides', 'nativeQueue',
    'predictCfg', 'defenseCfg', 'safeMode', 'autoTransport', 'transportReserve',
    'transportMin', 'tradeTowns', 'cityTemplates', 'townGroups', 'cultureTypes', 'favorCfg',
    'spyCfg', 'wonderCfg', 'merchantWish', 'priorityOrder',
    'playerNotes', 'watchlist', 'recruitPacks', 'batchRecruitLists',
  ];
  function qolConfigSnapshot() {
    const out = { schema: CONFIG_EXPORT_SCHEMA, ver: state.configVer || 1, host: location.host };
    for (const k of CONFIG_SNAPSHOT_KEYS) {
      if (state[k] === undefined) continue;

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

    if (+entry.schema > CONFIG_EXPORT_SCHEMA) {
      src.push(entry);
      gbLog(`config ${label}: refused - snapshot schema ${entry.schema} newer than ${CONFIG_EXPORT_SCHEMA}`);
      return false;
    }
    const current = qolConfigSnapshot();

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

  function qolExportConfigForUi() {
    try { return qolRedactConfigDump(qolExportConfig()); } catch (_) { return null; }
  }
  function qolExportConfig() {
    return { schema:CONFIG_EXPORT_SCHEMA, ver:state.configVer||1, host:location.host,
      abTargets:state.abTargets,abOrder:state.abOrder,researchTargets:state.researchTargets,recruitTargets:state.recruitTargets,
      plannerCfg:state.plannerCfg,goalProfiles:state.goalProfiles,townGoals:state.townGoals,virtualQueueOverrides:state.virtualQueueOverrides,nativeQueue:state.nativeQueue,predictCfg:state.predictCfg,defenseCfg:state.defenseCfg,safeMode:!!state.safeMode,
      autoTransport:!!state.autoTransport,transportReserve:+state.transportReserve||20,transportMin:+state.transportMin||1000,tradeTowns:state.tradeTowns,
      cityTemplates:state.cityTemplates,townGroups:state.townGroups,cultureTypes:state.cultureTypes,favorCfg:state.favorCfg,spyCfg:state.spyCfg,wonderCfg:state.wonderCfg,merchantWish:state.merchantWish,priorityOrder:state.priorityOrder,playerNotes:state.playerNotes,watchlist:state.watchlist,recruitPacks:state.recruitPacks,batchRecruitLists:state.batchRecruitLists };
  }
  function qolImportConfig(obj, opts) {
    if(!obj||typeof obj!=='object'||Array.isArray(obj))return false;if(obj.host&&String(obj.host)!==String(location.host)){gbLog(`config import refused: file host ${obj.host} != ${location.host}`);return false}if(obj.schema!=null&&+obj.schema>CONFIG_EXPORT_SCHEMA){gbLog(`config import refused: schema ${obj.schema} newer than supported ${CONFIG_EXPORT_SCHEMA}`);return false}
    const clone=v=>structuredClone(v),isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);const validators={abTargets:isObj,abOrder:Array.isArray,researchTargets:isObj,recruitTargets:isObj,plannerCfg:isObj,goalProfiles:isObj,townGoals:isObj,virtualQueueOverrides:isObj,nativeQueue:isObj,predictCfg:isObj,defenseCfg:isObj,safeMode:v=>typeof v==='boolean',autoTransport:v=>typeof v==='boolean',transportReserve:v=>Number.isFinite(+v),transportMin:v=>Number.isFinite(+v),tradeTowns:isObj,cityTemplates:isObj,townGroups:isObj,cultureTypes:isObj,favorCfg:isObj,spyCfg:isObj,wonderCfg:isObj,merchantWish:Array.isArray,priorityOrder:Array.isArray,playerNotes:isObj,watchlist:Array.isArray,batchRecruit:v=>typeof v==='boolean',batchRecruitLists:isObj,recruitPacks:isObj};const before=qolConfigSnapshot();const storeFor={abTargets:STORE.AB_TARGETS,abOrder:STORE.AB_ORDER,researchTargets:STORE.RESEARCH_TARGETS,recruitTargets:STORE.RECRUIT_TARGETS,plannerCfg:STORE.PLANNER_CFG,goalProfiles:STORE.GOAL_PROFILES,townGoals:STORE.TOWN_GOALS,virtualQueueOverrides:STORE.VIRTUAL_QUEUE_OVERRIDES,nativeQueue:STORE.NATIVE_QUEUE,predictCfg:STORE.PREDICT_CFG,defenseCfg:STORE.DEFENSE_CFG,safeMode:STORE.SAFE_MODE,autoTransport:STORE.AUTO_TRANSPORT,transportReserve:STORE.TRANSPORT_RESERVE,transportMin:STORE.TRANSPORT_MIN,tradeTowns:STORE.TRADE_TOWNS,cityTemplates:STORE.CITY_TEMPLATES,townGroups:STORE.TOWN_GROUPS,batchRecruit:STORE.BATCH_RECRUIT,batchRecruitLists:STORE.BATCH_RECRUIT_LISTS,recruitPacks:STORE.RECRUIT_PACKS,cultureTypes:STORE.CULTURE_TYPES,favorCfg:STORE.FAVOR_CFG,spyCfg:STORE.SPY_CFG,wonderCfg:STORE.WONDER_CFG,merchantWish:STORE.MERCHANT_WISH,priorityOrder:STORE.PRIORITY_ORDER,playerNotes:STORE.PLAYER_NOTES,watchlist:STORE.WATCHLIST};let applied=0;
    for(const k of Object.keys(validators)){if(obj[k]==null)continue;if(!validators[k](obj[k])){gbLog(`config import: ignored invalid ${k}`);continue}let v=clone(obj[k]);if(k==='priorityOrder'){const allowed=new Set(ORCH_ORDER_DEFAULT);v=v.map(String).filter((x,i,a)=>allowed.has(x)&&a.indexOf(x)===i);v=v.concat(ORCH_ORDER_DEFAULT.filter(x=>!v.includes(x)))}else if(k==='abOrder'){v=v.map(String).filter((x,i,a)=>AB_BUILDINGS.includes(x)&&a.indexOf(x)===i);v=v.concat(AB_BUILDINGS.filter(x=>!v.includes(x)))}else if(k==='abTargets'){const c={};for(const[b,n]of Object.entries(v))if(AB_BUILDINGS.includes(b))c[b]=abClampTarget(b,n);v=c}else if(k==='nativeQueue'){
      const clean={version:1,seq:Math.max(0,+v.seq||0),towns:{}},seen=new Set();
      const jobId=(raw,prefix)=>{let id=/^[A-Za-z0-9:._-]{1,160}$/.test(String(raw||''))?String(raw):'';if(!id||seen.has(id)){clean.seq++;id=`${prefix}:import:${clean.seq.toString(36)}`}seen.add(id);return id};
      for(const[tid,t]of Object.entries(v.towns||{}).slice(0,500)){if(!/^\d+$/.test(String(tid))||!isObj(t))continue;const townId=String(tid),build=[],recruit=[],recruitNaval=[],research=[];
        for(const j of (Array.isArray(t.build)?t.build:[]).slice(0,300)){if(!isObj(j)||!AB_BUILDINGS.includes(String(j.building))||!Number.isFinite(+j.toLevel)||+j.toLevel<=0)continue;const uncertain=!!(j.inflight||j.manualReview||j.reconcile),flight=j.reconcile||j.inflight||null,flightBuilding=flight&&AB_BUILDINGS.includes(String(flight.building))?String(flight.building):String(j.building);build.push({id:jobId(j.id,'b'),kind:'build',townId,building:String(j.building),fromLevel:Math.max(0,Math.floor(+j.fromLevel||(+j.toLevel-1))),toLevel:Math.max(1,Math.floor(+j.toLevel)),status:uncertain?'unknown':'pending',reason:uncertain?'acci\u00f3n importada pendiente de revisi\u00f3n':'',createdAt:Number.isFinite(+j.createdAt)?+j.createdAt:Date.now(),inflight:null,manualReview:uncertain,reconcile:flight&&isObj(flight)?{building:flightBuilding,targetLevel:Math.max(1,Math.floor(+flight.targetLevel||+j.toLevel)),at:+flight.at||Date.now(),accepted:!!flight.accepted}:null})}

        for(const j of [].concat((Array.isArray(t.recruit)?t.recruit:[]).slice(0,300),(Array.isArray(t.recruitNaval)?t.recruitNaval:[]).slice(0,300))){const infinite=!!(j&&(j.infinite||+j.amount===-1));if(!isObj(j)||!/^[a-z0-9_:-]+$/i.test(String(j.unit||''))||!gbGameDataLookup("units", String(j.unit)))continue;if(!infinite&&(!Number.isFinite(+j.amount)||+j.amount<=0))continue;const C=Math.max(0,Math.floor(+j.chunkSize||0));const uncertain=!!(j.inflight||j.manualReview);const dest=nativeRecruitLane(String(j.unit))==='recruitNaval'?recruitNaval:recruit;const entry={id:jobId(j.id,'u'),kind:'recruit',townId,unit:String(j.unit),amount:infinite?-1:Math.max(1,Math.floor(+j.amount)),status:uncertain?'unknown':'pending',reason:uncertain?'acci\u00f3n importada pendiente de revisi\u00f3n':(infinite?`\u221e \u00b7 lotes de ${C||nativeUnitStep(String(j.unit))}`:''),createdAt:Number.isFinite(+j.createdAt)?+j.createdAt:Date.now(),inflight:null,manualReview:uncertain};if(infinite){entry.infinite=true;entry.chunkSize=C>0?C:nativeUnitStep(String(j.unit));entry.amount=-1}else if(C>0&&C<entry.amount)entry.chunkSize=C;if(!infinite&&entry.amount>NATIVE_RECRUIT_INF_THRESH){entry.infinite=true;entry.amount=-1;entry.chunkSize=C>0?C:nativeUnitStep(String(j.unit));entry.reason=`\u221e \u00b7 lotes de ${entry.chunkSize}`}dest.push(entry)}
        for(const j of (Array.isArray(t.research)?t.research:[]).slice(0,300)){if(!isObj(j)||!/^[a-z0-9_:-]+$/i.test(String(j.tech||''))||!gbGameDataLookup("researches", String(j.tech)))continue;const uncertain=!!(j.inflight||j.manualReview);research.push({id:jobId(j.id,'r'),kind:'research',townId,tech:String(j.tech),status:uncertain?'unknown':'pending',reason:uncertain?'acci\u00f3n importada pendiente de revisi\u00f3n':'',createdAt:Number.isFinite(+j.createdAt)?+j.createdAt:Date.now(),inflight:null,manualReview:uncertain})}
        clean.towns[townId]={build,recruit,recruitNaval,research,paused:{build:!!(t.paused&&t.paused.build),recruit:!!(t.paused&&t.paused.recruit),recruitNaval:!!(t.paused&&(t.paused.recruitNaval!=null?t.paused.recruitNaval:t.paused.recruit)),research:!!(t.paused&&t.paused.research)},mode:{build:build.length||t.mode&&t.mode.build==='fifo'?'fifo':'legacy',recruit:recruit.length||t.mode&&t.mode.recruit==='fifo'?'fifo':'legacy',recruitNaval:recruitNaval.length||t.mode&&(t.mode.recruitNaval==='fifo'||t.mode.recruitNaval==null&&t.mode.recruit==='fifo')?'fifo':'legacy',research:research.length||t.mode&&t.mode.research==='fifo'?'fifo':'legacy'}}
      }v=clean
    }else if(k==='watchlist')v=v.slice(0,500);else if(k==='merchantWish')v=v.slice(0,100).filter(x=>isObj(x)&&(x.item||x.id)&&Number.isFinite(+x.maxPrice)&&+x.maxPrice>0);state[k]=v;save(storeFor[k],v);applied++}
    state.configVer=CONFIG_VER_CURRENT;save(STORE.CONFIG_VER,CONFIG_VER_CURRENT);if(state.autoFavor){state.autoFavor=false;save(STORE.AUTO_FAVOR,false)}goalPlanAll();

    if (applied > 0 && !(opts && opts.history === false)) qolHistoryPush(before, (opts && opts.source) || 'import');
    gbLog(`config imported: ${applied} validated section(s)`);return applied>0;
  }

  const CONFIG_PRESET_HIGH_RISK = {

    autoFavor: [STORE.AUTO_FAVOR, false],
    autoRecruit: [STORE.AUTO_RECRUIT, false],
    autoDodge: [STORE.AUTO_DODGE, false],
    allowPremiumCulture: [STORE.ALLOW_PREMIUM_CULTURE, false],
    autoMerchant: [STORE.AUTO_MERCHANT, false],
    autoWonder: [STORE.AUTO_WONDER, false],
    autoWonderFavor: [STORE.AUTO_WONDER_FAVOR, false],
    autoPtTrade: [STORE.AUTO_PT_TRADE, false],
    autoVillageRecruit: [STORE.AUTO_VILLAGE_RECRUIT, false],
    batchRecruit: [STORE.BATCH_RECRUIT, false],
  };
  const CONFIG_PRESETS = {
    afk: {
      label: 'Perfil de baja actividad manual',
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
        reqBudgetPerMin: [STORE.REQ_BUDGET, 40],
        postsPerMinSoftPct: [STORE.POSTS_SOFT_PCT, 70],
      },
    },
  };
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

      if (!state.defenseCfg || typeof state.defenseCfg !== 'object') state.defenseCfg = { mode: 'notify', returnMarginSec: 120 };
      state.defenseCfg.mode = 'notify';
      save(STORE.DEFENSE_CFG, state.defenseCfg);
      state.webhookEvents = Object.assign({}, state.webhookEvents || {}, { captcha: true, attack: true });
      save(STORE.WEBHOOK_EVENTS, state.webhookEvents);
    }
    if (histBefore) qolHistoryPush(histBefore, 'preset:' + name);
    gbLog(`config preset "${preset.label}" applied: ${applied.length} setting(s) changed; HIGH-RISK loops forced OFF`);
    return true;
  }
  const ORCH_MODE = 'independent-v5.9.2';
  const ORCH_MS = 20000;
  const ORCH_MAX_PER_TICK = 3;
  const ORCH_SPACING_MS = 450;

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

  const GB_KIND_ES = { build: 'Construir', research: 'Investigar', recruit: 'Reclutar' };
  const GB_RES_ES = { wood: 'madera', stone: 'piedra', iron: 'plata', population: 'población', pop: 'población' };
  function gbWhyEs(why) {
    const w = String(why == null ? '' : why).trim();
    if (!w) return '';
    const m = w.match(/^(wood|stone|iron|population|pop)\s+(\d+)\/(\d+)$/);
    if (m) return `faltan ${Math.max(0, +m[3] - +m[2])} de ${GB_RES_ES[m[1]]}`;
    if (w === 'cost-unreadable') return 'no se puede leer el coste';
    if (w === 'dependency') return 'falta un requisito';
    if (w === 'blocked by user') return 'bloqueado por ti';
    if (/^research:/.test(w)) return 'falta una investigación previa';
    return w;
  }
  function gbAttentionEl(item) {
    const box = document.createElement('div');
    box.className = 'gb-att ' + (item.tone || 'warn');
    box.style.cssText = 'display:flex;align-items:flex-start;gap:8px;padding:6px 8px;border-radius:6px;margin:4px 0;background:rgba(0,0,0,.25)';
    const ico = typeof gbIcon === 'function' ? gbIcon(item.tone === 'bad' ? 'alert' : 'info', 15, item.tone === 'bad' ? '#ff9aa3' : '#ffd27a') : null;
    if (ico) { ico.style.flex = '0 0 auto'; ico.style.marginTop = '1px'; box.appendChild(ico); }
    const mid = document.createElement('div');
    mid.style.cssText = 'flex:1;min-width:0';
    const t = document.createElement('div');
    t.className = 'gb-att-t';
    t.textContent = item.title;
    mid.appendChild(t);
    if (item.sub) {
      const sb = document.createElement('div');
      sb.className = 'gb-att-s';
      sb.textContent = item.sub;
      mid.appendChild(sb);
    }
    box.appendChild(mid);
    if (item.action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'gb-action';
      b.textContent = item.action;
      b.addEventListener('click', item.onClick);
      box.appendChild(b);
    }
    return box;
  }
  function gbAttentionItems(ctx) {
    const items = [];
    (ctx.threats || []).slice(0, 3).forEach(m => {
      const eta = (typeof dodgeEtaSec === 'function') ? dodgeEtaSec(m) : null;
      const when = eta == null ? 'no se puede leer la llegada' : 'llega en ' + fmtSec(eta);
      let name = String(m.dest);
      try { name = gbTownModel(m.dest).getName() || name; } catch (_) {}
      const mode = state.dodgeMode === 'auto' ? 'El esquive automático está activo.' : 'El esquive esta en "solo avisar": el bot no moverá tropas.';
      items.push({
        tone: 'bad',
        title: `Ataque a ${name}, ${when}`,
        sub: mode + (m.hasCs ? ' Lleva barco de conquista.' : ''),
        action: 'Ver',
        onClick: () => showTab('intel'),
      });
    });
    if (ctx.unknown) {
      items.push({
        tone: 'bad',
        title: ctx.unknown === 1 ? 'Un envío quedó sin confirmar' : `${ctx.unknown} envíos quedaron sin confirmar`,
        sub: 'Se acabó el tiempo antes de saber si llegaron al servidor. Compruébalos antes de repetirlos.',
        action: 'Revisar',
        onClick: () => { showTab('log'); const b = panel.querySelector('[data-logsub=pending]'); if (b) b.click(); },
      });
    }
    if (ctx.circuits.length) {
      items.push({
        tone: 'warn',
        title: ctx.circuits.length === 1 ? 'Un módulo está parado por errores repetidos' : `${ctx.circuits.length} módulos están parados por errores repetidos`,
        sub: 'Sin enviar nada más hasta que se revise: ' + ctx.circuits.slice(0, 4).join(', '),
        action: 'Ver',
        onClick: () => showTab('stats'),
      });
    }
    if (ctx.captchaKeys.length) {
      items.push({
        tone: 'warn',
        title: 'El juego pidió un captcha',
        sub: 'En pausa hasta que lo resuelvas: ' + ctx.captchaKeys.slice(0, 4).join(', '),
        action: 'Ver',
        onClick: () => showTab('stats'),
      });
    }
    if (!ctx.compatible) {
      const miss = Object.entries(ctx.fps.required || {}).filter(([, v]) => !v).map(([k]) => k);
      items.push({
        tone: 'bad',
        title: 'El bot no reconoce esta versión del juego',
        sub: 'No puede leer: ' + (miss.length ? miss.join(', ') : 'la huella del cliente') + '. Recarga la página antes de fiarte de nada.',
        action: 'Comprobar',
        onClick: () => { preflightRunAndRender(); showTab('stats'); },
      });
    }
    if (ctx.overflow.length) {
      items.push({
        tone: 'warn',
        title: ctx.overflow.length === 1 ? 'Un almacén se va a llenar' : `${ctx.overflow.length} almacenes se van a llenar`,
        sub: ctx.overflow.slice(0, 3).join(' · ') + '. Lo que sobre se pierde.',
        action: 'Ver',
        onClick: () => showTab('overview'),
      });
    }
    return items;
  }
