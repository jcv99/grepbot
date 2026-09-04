  let gbQueueCenterResearchPick = '';

  function makeDraggable(w, h) {
    let drag = null;
    const onDown = e => {
      if (e.target.closest('button,select')) return;
      const r = w.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      e.preventDefault();
    };
    const onMove = e => {
      if (!drag) return;
      const cssMax = parseFloat(getComputedStyle(w).maxWidth) || w.offsetWidth;
      const maxW = Math.min(w.offsetWidth || 0, Math.max(0, innerWidth - cssMax));
      const maxH = Math.max(0, innerHeight - w.offsetHeight);
      w.style.left = Math.max(0, Math.min(innerWidth - maxW, e.clientX - drag.dx)) + 'px';
      w.style.top = Math.max(0, Math.min(maxH, e.clientY - drag.dy)) + 'px';
      w.style.right = 'auto';
    };
    const onUp = () => { drag = null; };
    gbListen(h, 'mousedown', onDown);
    gbListen(document, 'mousemove', onMove);
    gbListen(document, 'mouseup', onUp);
    gbListenerBag.push({ target: document, type: 'mousemove', fn: onMove, opts: undefined }, { target: document, type: 'mouseup', fn: onUp, opts: undefined });
  }

  if (!state._gbQcCssInjected) {
    state._gbQcCssInjected = true;
    gbAddStyle('queue-center', `
    #grepbot-queue-center{position:fixed;top:90px;left:90px;width:760px;height:560px;min-width:520px;min-height:320px;max-width:94vw;max-height:88vh;z-index:2147483646;background:var(--gb-bg-deep);color:var(--gb-fg);border:1px solid #4a505b;border-radius:10px;box-shadow:0 10px 32px rgba(0,0,0,.6);display:flex;flex-direction:column;resize:both;overflow:hidden;font:12px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
    #grepbot-queue-center header{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#24272e;border-bottom:1px solid #3d424c;cursor:move;flex-shrink:0}
    #grepbot-queue-center header b{color:var(--gb-accent);font-size:13px}#grepbot-queue-center .gb-qc-spacer{flex:1}
    #grepbot-queue-center header select{max-width:210px;background:#11141a;color:var(--gb-fg);border:1px solid #4b5260;border-radius:5px;padding:4px 7px}
    #grepbot-queue-center header button,#grepbot-queue-center .gb-qc-btn{background:#2d323b;color:#e9edf2;border:1px solid #4f5764;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:11px}
    #grepbot-queue-center header button:hover,#grepbot-queue-center .gb-qc-btn:hover{background:#39404b;border-color:#707a89}#grepbot-queue-center button:disabled{opacity:.35;cursor:default}
    #grepbot-queue-center .gb-qc-btn:active{background:#4b5462}#grepbot-queue-center .gb-qc-btn.busy{background:#4b5462;border-color:#8a94a3}
    #grepbot-queue-center nav{display:flex;gap:5px;padding:7px 9px;background:#1d2026;border-bottom:1px solid var(--gb-border-soft);flex-shrink:0}
    #grepbot-queue-center .gb-qc-tab{padding:6px 12px;background:#272b33;color:var(--gb-fg-soft2);border:1px solid transparent;border-radius:7px;cursor:pointer;font-weight:600}
    #grepbot-queue-center .gb-qc-tab.on{background:var(--gb-warn-bg);color:var(--gb-fg-hi);border-color:var(--gb-accent-3)}
    #grepbot-queue-center .gb-qc-body{padding:10px;flex:1 1 0;min-height:0;height:0;overflow-y:scroll;overflow-x:hidden;scrollbar-gutter:stable;scrollbar-width:auto;scrollbar-color:#5f6978 var(--gb-bg-deep);overscroll-behavior:contain;display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:max-content;gap:10px;align-content:start}
    #grepbot-queue-center .gb-qc-body::-webkit-scrollbar{width:10px}
    #grepbot-queue-center .gb-qc-body::-webkit-scrollbar-track{background:var(--gb-bg-deep);border-left:1px solid #2e333c}
    #grepbot-queue-center .gb-qc-body::-webkit-scrollbar-thumb{background:#4f5764;border:2px solid var(--gb-bg-deep);border-radius:8px}
    #grepbot-queue-center .gb-qc-body::-webkit-scrollbar-thumb:hover{background:#6a7484}
    #grepbot-queue-center .gb-qc-card{background:#20232a;border:1px solid #383e48;border-radius:8px;overflow:hidden;min-width:0;align-self:start;height:max-content}
    #grepbot-queue-center .gb-qc-card-head{display:flex;gap:8px;align-items:center;padding:8px 9px;background:#272b33;border-bottom:1px solid #383e48}#grepbot-queue-center .gb-qc-card-head>div:first-child{display:flex;flex-direction:column;flex:1;min-width:0}#grepbot-queue-center .gb-qc-card-head small{color:#89919d;font-size:10px}
    #grepbot-queue-center .gb-qc-live-row,#grepbot-queue-center .gb-qc-plan-row,#grepbot-queue-center .gb-qc-job{display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px 9px;border-top:1px solid rgba(255,255,255,.05)}
    #grepbot-queue-center .gb-qc-job-desc{display:flex;flex-direction:column;min-width:0}.gb-qc-job-desc>span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #grepbot-queue-center .gb-qc-acts{display:flex;gap:3px}.gb-qc-btn.danger{color:#ffb0a8}.gb-qc-empty{padding:16px 10px;color:#828a95;text-align:center}
    #grepbot-queue-center .gb-qc-picker{display:flex;gap:6px;align-items:center;padding:8px 9px;border-top:1px solid rgba(255,255,255,.05);background:#1b1e24}
    #grepbot-queue-center .gb-qc-pick{flex:1;min-width:0;background:#20232a;color:var(--gb-fg);border:1px solid #454c58;border-radius:5px;padding:3px 5px;font-size:11px}
    #grepbot-queue-center .gb-qc-sequence{padding:8px 9px 9px;border-top:1px solid rgba(255,255,255,.05);background:#1b1e24}
    #grepbot-queue-center .gb-qc-sequence-title{display:block;margin-bottom:6px;color:#f5c36a;font-size:10px;text-transform:uppercase;letter-spacing:.35px}
    #grepbot-queue-center .gb-qc-sequence-line{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
    #grepbot-queue-center .gb-qc-sequence-chip{padding:3px 6px;border-radius:5px;background:var(--gb-bg-raise);border:1px solid #454c58;color:var(--gb-fg);font-size:10px;white-space:nowrap}
    #grepbot-queue-center .gb-qc-sequence-arrow{color:#757f8c;font-weight:bold}
    #grepbot-queue-center .gb-qc-status{font-size:9px;color:#aab2bd}.gb-qc-status.ready{color:#7ddd96}.gb-qc-status.blocked,.gb-qc-status.unknown{color:#ff9e94}.gb-qc-status.paused{color:var(--gb-warn)}.gb-qc-status.waiting-resources,.gb-qc-status.waiting-population,.gb-qc-status.waiting-queue,.gb-qc-status.waiting-requirement{color:#e5bf70}.gb-qc-muted{color:#929aa5;font-size:10px}
    @media(max-width:760px){#grepbot-queue-center{left:2vw!important;top:4vh!important;width:96vw!important;height:80vh!important}#grepbot-queue-center .gb-qc-body{grid-template-columns:1fr}}
    `);
  }
  function queueCenterTownIds() {
    let ids = [];
    try { ids = Object.keys((gameUw().ITowns && gameUw().ITowns.towns) || {}); } catch (_) {}
    if (!ids.length) ids = (state.towns || []).map(t => String(t.id));
    return ids.map(String);
  }
  function queueCenterTownName(id) {
    try {
      const t = (state.towns || []).find(x => String(x.id) === String(id));
      if (t && t.name) return t.name;
      const gt = gbTownModel(id);
      const a = gt && (gt.attributes || gt);
      if (a && a.name) return String(a.name);
    } catch (_) {}
    return String(id || '?');
  }

  function queueCenterUnitIsNaval(unit) {
    try {
      const d = gbGameDataLookup("units", unit);
      if (!d) return null;
      return !!(d.is_naval || d.naval);
    } catch (_) { return null; }
  }
  function queueCenterUnitId(model) {
    const a = (model && model.attributes) || model || {};
    return String(a.unit_type || a.unit_id || a.type || '?');
  }
  function queueCenterUnitAmount(model) {
    const a = (model && model.attributes) || model || {};
    return +(a.count != null ? a.count : (a.amount != null ? a.amount : a.units)) || 0;
  }
  function queueCenterTimeLeft(model) {
    const a = (model && model.attributes) || model || {};
    const now = gameNow();
    const done = +(a.to_be_completed_at || a.completed_at || a.done_at || a.time_finished || 0);
    if (done > 0) return Math.max(0, done - now);
    const left = +(a.time_left || a.remaining_time || a.recruitment_time || a.research_time || a.building_time || 0);
    return left > 0 ? left : null;
  }
  function queueCenterFmt(sec) {
    if (sec == null || !Number.isFinite(+sec)) return '';
    sec = Math.max(0, Math.floor(+sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), ss = sec % 60;
    return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(ss).padStart(2, '0')}s`;
  }

  function queueCenterButton(txt, title, fn, cls) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.title = title || ''; b.className = 'gb-qc-btn' + (cls ? ' ' + cls : '');
    b.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      if (!gbInstanceAlive()) return;
      if (!gbTabLeader) { flash('GrepBot est\u00e1 activo en otra pesta\u00f1a'); return; }

      b.classList.add('busy');
      let r;
      try { r = fn && fn(e); } finally { b.classList.remove('busy'); }
      if (r !== false) renderQueueCenterFlush();
    });
    return b;
  }
  function queueCenterStatusBadge(status, reason) {
    const s = document.createElement('span'); s.className = 'gb-qc-status ' + String(status || 'pending').replace(/[^a-z-]/gi, '');
    const map = { pending: 'pendiente', ready: 'listo', sending: 'enviando', paused: 'pausada', blocked: 'bloqueada', unknown: 'revisar', 'waiting-resources': 'recursos', 'waiting-population': 'poblaci\u00f3n', 'waiting-queue': 'cola llena', 'waiting-requirement': 'requisito' };
    s.textContent = map[status] || status || 'pendiente'; if (reason) s.title = reason; return s;
  }
  function queueCenterCard(title, subtitle, subTitle) {
    const box = document.createElement('div'); box.className = 'gb-qc-card';
    const h = document.createElement('div'); h.className = 'gb-qc-card-head';
    const left = document.createElement('div'); const b = document.createElement('b'); b.textContent = title; left.appendChild(b);
    if (subtitle) { const sm = document.createElement('small'); sm.textContent = subtitle; if (subTitle) gbTip(sm, subTitle); left.appendChild(sm); }
    h.appendChild(left); box.appendChild(h); return { box, head: h };
  }
  function queueCenterEmpty(text) { return gbEmptyState(text); }
  function queueCenterSequence(title, entries) {
    const wrap = document.createElement('div'); wrap.className = 'gb-qc-sequence';
    const lab = document.createElement('b'); lab.className = 'gb-qc-sequence-title'; lab.textContent = title; wrap.appendChild(lab);
    const line = document.createElement('div'); line.className = 'gb-qc-sequence-line';
    (entries || []).forEach((e, i) => {
      if (i) { const arrow = document.createElement('span'); arrow.className = 'gb-qc-sequence-arrow'; arrow.textContent = '>'; line.appendChild(arrow); }
      const chip = document.createElement('span'); chip.className = 'gb-qc-sequence-chip'; chip.textContent = String(e && e.text != null ? e.text : e || '');
      if (e && e.title) chip.title = e.title; line.appendChild(chip);
    });
    wrap.appendChild(line); return wrap;
  }

  function queueCenterLiveRow(num, label, sec, numTitle) {
    const r = document.createElement('div'); r.className = 'gb-qc-live-row';
    const n = document.createElement('span'); n.textContent = `#${num}`; if (numTitle) n.title = numTitle;
    const nm = document.createElement('b'); nm.textContent = label;

    const t = document.createElement('span'); t.className = 'gb-qc-eta'; t.textContent = queueCenterFmt(sec);
    if (sec != null && Number.isFinite(+sec)) { t.dataset.eta = String(Math.max(0, +sec)); t.dataset.t0 = String(Date.now()); }
    r.append(n, nm, t); return r;
  }

  function queueCenterJobRow(num, desc, badge, lane, townId, job, frozen, i, list) {
    const r = document.createElement('div'); r.className = 'gb-qc-job';
    const numEl = document.createElement('b'); numEl.textContent = `#${num}`;
    gbTip(numEl, 'Posicion en la cola virtual');
    const descEl = document.createElement('div'); descEl.className = 'gb-qc-job-desc';
    const main = document.createElement('span'); main.textContent = desc;
    gbTip(main, 'Descripcion de la orden virtual');
    descEl.append(main, badge);
    const acts = document.createElement('div'); acts.className = 'gb-qc-acts';
    const top = queueCenterButton('\u2191\u2191', 'Saltar al inicio de la cola', () => nativeQueueMove(townId, lane, job.id, -i));
    const up = queueCenterButton('\u2191', 'Subir', () => nativeQueueMove(townId, lane, job.id, -1));
    const dn = queueCenterButton('\u2193', 'Bajar', () => nativeQueueMove(townId, lane, job.id, 1));
    const bot = queueCenterButton('\u2193\u2193', 'Saltar al final de la cola', () => nativeQueueMove(townId, lane, job.id, list.length - 1 - i));
    const del = queueCenterButton('\u00d7', 'Eliminar', () => queueCenterRemove(townId, lane, job, frozen), 'danger');
    top.disabled = frozen || i === 0;
    up.disabled = frozen || i === 0;
    dn.disabled = frozen || i === list.length - 1;
    bot.disabled = frozen || i === list.length - 1;
    del.disabled = !!job.inflight;
    acts.append(top, up, dn, bot, del); r.append(numEl, descEl, acts); return r;
  }

  function queueCenterRemove(townId, lane, job, frozen) {
    if (job.inflight) { flash('Esta orden se est\u00e1 enviando; espera a que termine'); return false; }
    if (job.manualReview) {
      let ok = false;
      try { ok = gameUw().confirm('Comprueba primero la cola real. Borrar este elemento confirma que asumes si la acci\u00f3n se envi\u00f3 o no.'); } catch (_) { ok = false; }
      if (!ok) return false;
    } else if (frozen) {
      let ok = false;
      try { ok = gameUw().confirm('Hay otra acci\u00f3n pendiente en esta cola. \u00bfBorrar este elemento de todos modos?'); } catch (_) { ok = false; }
      if (!ok) return false;
    }
    return nativeQueueRemove(townId, lane, job.id, { force: true });
  }

  function queueCenterLiveCard(body, title, sub, tip, rows, emptyText) {
    const live = queueCenterCard(title, sub, tip);
    body.appendChild(live.box);
    if (rows.length) rows.forEach((r, i) => live.box.appendChild(queueCenterLiveRow(i + 1, r.label, r.sec, r.numTitle)));
    else live.box.appendChild(queueCenterEmpty(emptyText));
    return live;
  }

  function queueCenterPlanCard(body, townId, lane, title, pauseNoun) {
    const { list, fifo, paused } = nativeQueueLaneMeta(townId, lane);
    const plan = queueCenterCard(title,
      fifo ? (paused ? 'FIFO pausada' : 'FIFO activa') : 'Objetivos autom\u00e1ticos',
      fifo ? (paused ? 'Cola FIFO en pausa - el plan automatico no actua' : 'Cola FIFO activa - gestionas las ordenes manualmente') : 'El plan automatico es el due\u00f1o de esta cola');
    body.appendChild(plan.box);
    plan.head.appendChild(queueCenterButton(paused ? '> Reanudar' : '|| Pausar', paused ? `Reanudar ${pauseNoun}` : `Pausar ${pauseNoun}`, () => nativeQueueTogglePaused(townId, lane)));
    if (!list.length && fifo) plan.head.appendChild(queueCenterButton('Objetivos', 'Volver al planificador autom\u00e1tico', () => nativeQueueUseLegacy(townId, lane)));
    return { plan, list, fifo, paused };
  }

  function queueCenterFifoSection(plan, townId, lane, list, fifo, opts) {
    if (!list.length) {
      plan.box.appendChild(queueCenterEmpty(fifo ? opts.emptyFifo : opts.emptyLegacy));
      return false;
    }
    plan.box.appendChild(queueCenterSequence(opts.seqTitle, list.map((j, i) => opts.seqEntry(j, i))));
    const frozen = list.some(j => j && j.inflight);
    list.forEach((j, i) => {
      plan.box.appendChild(queueCenterJobRow(i + 1, opts.rowDesc(j), queueCenterStatusBadge(j.status, j.reason), lane, townId, j, frozen, i, list));
    });
    return true;
  }

  function renderQueueCenterBuild(body, townId) {
    const q = abQueueInfo(townId);
    const liveRows = q.known ? q.orders.map(o => ({
      label: nativeBuildLabel(o.building_type),
      sec: o.to_be_completed_at ? Math.max(0, +o.to_be_completed_at - gameNow()) : o.building_time,
    })) : [];
    queueCenterLiveCard(body, 'Cola real de construcci\u00f3n', q.known ? `${q.len}/${q.max}` : 'estado no legible', 'Numero de ordenes reales en la cola del juego', liveRows, q.known ? 'Sin construcciones reales' : 'No se puede leer la cola real');

    const { plan, list, fifo } = queueCenterPlanCard(body, townId, 'build', 'Plan GrepBot \u00b7 Construcci\u00f3n', 'cola');
    const hasJobs = queueCenterFifoSection(plan, townId, 'build', list, fifo, {
      emptyFifo: 'Cola FIFO vac\u00eda. A\u00f1ade edificios con + desde el Senado.',
      emptyLegacy: 'Esta ciudad usa el planificador de objetivos.',
      seqTitle: 'Orden FIFO',
      seqEntry: (j, i) => ({
        text: `#${i + 1} ${nativeBuildLabel(j.building)}`,
        title: `${nativeBuildLabel(j.building)} ${j.fromLevel}\u2192${j.toLevel}${j.reason ? ' \u00b7 ' + j.reason : ''}`,
      }),
      rowDesc: j => `${nativeBuildLabel(j.building)} ${j.fromLevel}\u2192${j.toLevel}`,
    });
    if (hasJobs) renderQueueCenterSwap(body, townId);
    renderQueueCenterOptimal(body, townId);
  }

  function renderQueueCenterSwap(body, townId) {
    let sug = null;
    try { sug = nativeQueueSuggestSwap(townId); } catch (_) { sug = null; }
    if (!sug) return;
    const box = document.createElement('div');
    box.className = 'gb-qc-card';
    box.style.cssText = 'border-color:#f5a623';
    const txt = document.createElement('div');
    txt.style.cssText = 'font-size:10px;color:#f5a623;padding:4px';
    txt.textContent = `Sugerencia: ascender ${nativeBuildLabel(sug.successor.building)} mientras se esperan recursos para ${nativeBuildLabel(sug.head.building)} (${sug.head.forMinutes} min bloqueada)`;
    box.appendChild(txt);
    const acts = document.createElement('div');
    acts.className = 'gb-qc-acts';
    acts.style.cssText = 'padding:0 4px 4px';
    acts.appendChild(queueCenterButton('Ascender', 'Mueve esta orden a la cabeza de la cola FIFO', () => {
      if (!nativeQueueMove(townId, 'build', sug.swap.successorId, -sug.successorIndex)) {
        flash('no se pudo reordenar (cola congelada)');
        return false;
      }
      flash('orden ascendida');
    }));
    acts.appendChild(queueCenterButton('Ignorar', 'Oculta esta sugerencia 10 minutos', () => {
      buildSwapIgnore(townId, sug.swap.headId);
    }));
    box.appendChild(acts);
    body.appendChild(box);
  }

  function renderQueueCenterOptimal(body, townId) {
    if (state.abOptimalOrderOn === false) return;
    let opt = null;
    try { opt = abOptimalOrderCached(townId); } catch (e) { opt = { error: String(e).slice(0, 60), actions: [] }; }
    const card = queueCenterCard('Secuencia \u00f3ptima \u00b7 Construcci\u00f3n', 'solo consejo - no envia nada', 'Sugerencia de orden: solo se aplica si la pulsas, no se envia sola');
    body.appendChild(card.box);
    if (!opt || opt.error) {
      card.box.appendChild(queueCenterEmpty('No se puede calcular: ' + ((opt && opt.error) || 'desconocido')));
      return;
    }
    const rows = (opt.actions || []).slice(0, 8);
    if (!rows.length) { card.box.appendChild(queueCenterEmpty('Sin objetivos de construccion pendientes.')); return; }
    rows.forEach((a, i) => {
      const r = document.createElement('div'); r.className = 'gb-qc-job';
      const num = document.createElement('b'); num.textContent = `#${i + 1}`;
      const desc = document.createElement('div'); desc.className = 'gb-qc-job-desc';
      const main = document.createElement('span');
      main.textContent = `${nativeBuildLabel(a.building)}${a.level ? ' ' + (a.level - 1) + '\u2192' + a.level : ''}` +
        (a.etaMs ? ' \u00b7 ' + queueCenterFmt(Math.round(a.etaMs / 1000)) : '');
      desc.append(main, queueCenterStatusBadge(a.status, a.why));
      r.append(num, desc); card.box.appendChild(r);
    });
    const addable = rows.filter(a => a.building && a.status !== 'blocked');
    const btn = queueCenterButton('+ A\u00f1adir secuencia', 'Anade estos edificios al final de la cola FIFO. No toca la cabeza actual.', () => {
      let n = 0;
      for (const a of addable) {

        if (!nativeQueueAddBuild(townId, a.building)) break;
        n++;
      }
      if (n) flash(`+${n} edificios anadidos a la cola FIFO @${townId}`);
    });
    btn.disabled = !addable.length;
    card.head.appendChild(btn);
  }

  function queueCenterResearchOptions(townId, info) {
    let all = [];
    try { all = Object.keys((gameUw().GameData && gameUw().GameData.researches) || {}); } catch (_) {}
    return all.filter(id => {
      if (!gbGameDataLookup("researches", id)) return false;
      if (info && info.techs && info.techs[id]) return false;
      if (info && (info.orders || []).some(o => String(researchOrderTechId(o)) === String(id))) return false;
      return !nativeQueueResearchPending(townId, id);
    }).sort((a, b) => nativeResearchLabel(a).localeCompare(nativeResearchLabel(b)));
  }
  function queueCenterResearchPicker(townId, info) {
    const row = document.createElement('div'); row.className = 'gb-qc-picker';
    const sel = document.createElement('select'); sel.className = 'gb-qc-pick';
    const opts = queueCenterResearchOptions(townId, info);
    opts.forEach(id => { const o = document.createElement('option'); o.value = id; o.textContent = nativeResearchLabel(id); if (id === gbQueueCenterResearchPick) o.selected = true; sel.appendChild(o); });
    sel.addEventListener('change', () => { gbQueueCenterResearchPick = sel.value; });
    const add = queueCenterButton('+ A\u00f1adir', 'A\u00f1adir esta investigaci\u00f3n al final de la cola (los requisitos se insertan delante)', () => {
      const tech = sel.value;
      if (!tech) { flash('Selecciona una investigaci\u00f3n'); return false; }
      gbQueueCenterResearchPick = '';
      return nativeQueueAddResearch(townId, tech);
    });

    if (!info || !opts.length) {
      sel.replaceChildren(); sel.disabled = true; add.disabled = true;
      const o = document.createElement('option'); o.value = '';
      o.textContent = info ? 'Sin investigaciones disponibles' : 'Academia ilegible';
      sel.appendChild(o);
    }
    row.append(sel, add); return row;
  }
  function renderQueueCenterResearch(body, townId) {
    const info = researchTownTechs(townId); const orders = (info && info.orders) || [];
    const liveSub = !info ? 'estado no legible'
      : (info.ordersKnown ? `${orders.length}/${researchQueueMax()} \u00b7 Academia ${info.academy || 0}`
        : `cola real ilegible \u00b7 Academia ${info.academy || 0}`);
    queueCenterLiveCard(body, 'Cola real de investigaci\u00f3n', liveSub, 'Estado actual de la cola de investigacion real',
      orders.map(o => {
        const id = researchOrderTechId(o);
        return { label: researchLabel(id) || String(id || '?'), sec: queueCenterTimeLeft(o) };
      }),
      info ? 'Sin investigaciones en curso' : 'No se puede leer la Academia');

    const { plan, list, fifo } = queueCenterPlanCard(body, townId, 'research', 'Plan GrepBot \u00b7 Investigaci\u00f3n', 'cola');
    plan.box.appendChild(queueCenterResearchPicker(townId, info));
    queueCenterFifoSection(plan, townId, 'research', list, fifo, {
      emptyFifo: 'Cola FIFO vac\u00eda. A\u00f1ade investigaciones arriba o con + desde la Academia.',
      emptyLegacy: 'Esta ciudad usa el planificador de objetivos.',
      seqTitle: 'Orden FIFO',
      seqEntry: (j, i) => ({
        text: `#${i + 1} ${nativeResearchLabel(j.tech)}`,
        title: j.reason || nativeResearchLabel(j.tech),
      }),
      rowDesc: j => nativeResearchLabel(j.tech),
    });

    const targets = goalEffectiveResearchTargets(townId, researchEnsureTargets());
    const planned = queueCenterCard('Pr\u00f3ximas investigaciones', fifo && list.length ? 'planificador autom\u00e1tico (en pausa: manda la cola FIFO)' : 'orden del planificador', 'Cola del planificador automatico: lo siguiente que investigara si no tienes FIFO activa');
    body.appendChild(planned.box);
    let shown = 0;
    Object.keys(targets).sort((a, b) => (+targets[a].order || 0) - (+targets[b].order || 0)).forEach(id => {
      const t = targets[id];
      if (!t || !t.tgt) return;
      if (info && info.techs && info.techs[id]) return;
      if (orders.some(o => String(researchOrderTechId(o)) === String(id))) return;
      if (nativeQueueResearchPending(townId, id)) return;
      shown++;
      const r = document.createElement('div'); r.className = 'gb-qc-plan-row';
      const n = document.createElement('span'); n.textContent = `#${shown}`;
      const nm = document.createElement('b'); nm.textContent = researchLabel(id) || id;
      let st = 'pendiente';
      try {
        const dep = researchDepsOk(townId, info, id), aff = dep && researchCanAfford(townId, id, info);

        st = !dep ? 'requisito'
          : (aff && aff.ok ? (aff.blind ? 'listo (sin verificar)' : 'listo')
            : (aff && aff.why) || 'esperando');
      } catch (_) {}
      const badge = document.createElement('span'); badge.className = 'gb-qc-muted'; badge.textContent = st;
      r.append(n, nm, badge); planned.box.appendChild(r);
    });
    if (!shown) planned.box.appendChild(queueCenterEmpty('No hay investigaciones pendientes en el plan.'));
  }

  function renderQueueCenterRecruit(body, townId, wantNaval) {
    const label = wantNaval ? 'Puerto' : 'Cuartel';
    const lane = wantNaval ? 'recruitNaval' : 'recruit';
    const q = recruitQueueInfo(townId);
    const allModels = q.models || [];
    const liveModels = allModels.filter(m => queueCenterUnitIsNaval(queueCenterUnitId(m)) === wantNaval);
    const unclassified = allModels.filter(m => queueCenterUnitIsNaval(queueCenterUnitId(m)) == null);
    const live = queueCenterLiveCard(body, `Cola real \u00b7 ${label}`, q.known ? `${liveModels.length}${q.max != null ? ' / ' + q.max : ''}` : 'estado no legible', 'Numero de ordenes reales en la cola del cuartel/puerto',
      liveModels.map(m => {
        const id = queueCenterUnitId(m);
        return {
          label: `${queueCenterUnitAmount(m)}\u00d7 ${nativeUnitLabel(id)}`,
          sec: queueCenterTimeLeft(m),
          numTitle: `posici\u00f3n en la cola real de ${label.toLowerCase()}`,
        };
      }),
      q.known ? `Sin \u00f3rdenes en ${label.toLowerCase()}` : 'No se puede leer la cola real');

    if (unclassified.length) {
      live.box.appendChild(queueCenterEmpty(`${unclassified.length} orden(es) con tipo de unidad no legible \u2014 sin clasificar`));
    }

    const { plan, list, fifo } = queueCenterPlanCard(body, townId, lane, `Plan GrepBot \u00b7 ${label}`, label.toLowerCase());
    if (list.length >= 2) plan.head.appendChild(queueCenterButton('Compactar', 'Fusionar entradas adyacentes del mismo tipo en la cola virtual', () => {
      const n = nativeQueueCompactRecruit(townId, lane);
      flash(n ? `Compactadas ${n} entradas en ${label.toLowerCase()}` : 'No hay entradas adyacentes iguales para fusionar');
    }));

    if (list[0] && list[0].unit) {
      const headUnit = list[0].unit;
      const totalInp = document.createElement('input'); totalInp.type = 'number'; totalInp.min = '1'; totalInp.value = '200'; totalInp.title = `Total de unidades a encolar (${nativeUnitLabel(headUnit)}); >${NATIVE_RECRUIT_INF_THRESH} se convierte en \u221e`; totalInp.className = 'gb-native-qinp';
      const sep = document.createElement('span'); sep.textContent = '/'; sep.style.color = '#666';
      const chunkInp = document.createElement('input'); chunkInp.type = 'number'; chunkInp.min = '1'; chunkInp.value = '50'; chunkInp.title = 'Tama\u00f1o de cada lote al servidor'; chunkInp.className = 'gb-native-qinp';
      const lotBtn = queueCenterButton('+Lote', `Encolar el total en lotes del tama\u00f1o indicado; la fila se quita sola al agotarse`, () => {
        const r = nativeQueueAddRecruitBatch(townId, headUnit, +totalInp.value || 0, +chunkInp.value || 0);
        if (r && r.ok) flash(r.infinite ? `Cola \u221e encolada en ${label.toLowerCase()}: lotes de ${r.chunk}` : `Lote encolado en ${label.toLowerCase()}: ${r.total} en ${r.lotes} env\u00edo(s) de ${r.chunk}`);
        else flash((r && r.why) || 'no se pudo encolar el lote');
      });
      const infBtn = queueCenterButton('+\u221e', `Encolar \u221e ${nativeUnitLabel(headUnit)} en lotes del tama\u00f1o indicado`, () => {
        const r = nativeQueueAddRecruitInfinite(townId, headUnit, +chunkInp.value || 50);
        if (r && r.ok) flash(`Cola \u221e encolada en ${label.toLowerCase()}: lotes de ${r.chunk}`);
        else flash((r && r.why) || 'no se pudo encolar \u221e');
      });
      const wrap = document.createElement('span'); wrap.className = 'gb-qc-batch'; wrap.append(totalInp, sep, chunkInp, lotBtn, infBtn);
      plan.head.appendChild(wrap);
    }
    queueCenterFifoSection(plan, townId, lane, list, fifo, {
      emptyFifo: `No hay \u00f3rdenes ${wantNaval ? 'navales' : 'terrestres'} pendientes. A\u00f1\u00e1delas con + desde ${label}.`,
      emptyLegacy: 'Esta ciudad usa objetivos autom\u00e1ticos.',
      seqTitle: `Orden FIFO \u00b7 ${label}`,
      seqEntry: (j, i) => ({
        text: `#${i + 1} ${nativeQueueRecruitAmountText(j)}`,
        title: j.reason || nativeUnitLabel(j.unit),
      }),
      rowDesc: j => nativeQueueRecruitAmountText(j),
    });
  }

  let gbQcRendering = false;
  let gbQcReconciledAt = 0;
  let gbQcDirty = false;
  let gbQcPaintTimer = 0;
  let gbQcTickTimer = 0;

  const QC_TAB_LANES = { build: ['build'], research: ['research'], barracks: ['recruit'], docks: ['recruitNaval'] };
  function queueCenterKey(townId) {

    const lanes = QC_TAB_LANES[gbQueueCenterTab] || ['build', 'research', 'recruit', 'recruitNaval'];
    let k = gbQueueCenterTab + '|' + townId;
    for (const lane of lanes) {
      k += '|' + lane + ':';
      try { k += nativeQueueList(townId, lane, false).map(j => `${j.id}${j.inflight ? '!' : ''}${j.manualReview ? 'm' : ''}`).join(','); } catch (_) { k += '?'; }
    }
    return k;
  }
  function queueCenterVisible() {
    const w = gbQueueCenter;
    return !!(w && document.body.contains(w) && w.style.display !== 'none');
  }

  function queueCenterUserBusy() {
    const w = gbQueueCenter, a = document.activeElement;
    if (!w || !a || a === document.body || !w.contains(a)) return false;
    return a.tagName === 'SELECT' || a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable === true;
  }

  function renderQueueCenter() {
    if (!queueCenterVisible()) { gbQcDirty = false; return; }
    gbQcDirty = true;
    if (gbQcPaintTimer) return;
    gbQcPaintTimer = gbTimeout(() => { gbQcPaintTimer = 0; queueCenterPaint(false); }, 90);
  }

  function renderQueueCenterFlush() {
    if (gbQcPaintTimer) { gbClearTimeout(gbQcPaintTimer); gbQcPaintTimer = 0; }
    queueCenterPaint(true);
  }
  function queueCenterPaint(userDriven) {
    const w = gbQueueCenter;
    if (!queueCenterVisible()) { gbQcDirty = false; return; }
    if (gbQcRendering) return;
    if (!userDriven && queueCenterUserBusy()) {

      if (!gbQcPaintTimer) gbQcPaintTimer = gbTimeout(() => { gbQcPaintTimer = 0; queueCenterPaint(false); }, 400);
      return;
    }
    const ids = queueCenterTownIds();
    if (!ids.length) return;
    if (!gbQueueCenterTown || !ids.includes(String(gbQueueCenterTown))) {
      let cur = null;
      try { cur = gameUw().Game && gameUw().Game.townId; } catch (_) {}
      gbQueueCenterTown = String(cur || ids[0]);
    }
    gbQcRendering = true;
    gbQcDirty = false;
    try {

      if (!userDriven && Date.now() - gbQcReconciledAt > 2000) {
        gbQcReconciledAt = Date.now();
        try { nativeQueueReconcileTown(gbQueueCenterTown); } catch (_) {}
      }

      const sel = w.querySelector('.gb-qc-town');
      const sig = ids.map(id => id + '' + queueCenterTownName(id)).join('');
      if (sel.dataset.sig !== sig) {
        sel.dataset.sig = sig;
        sel.replaceChildren();
        ids.forEach(id => {
          const o = document.createElement('option'); o.value = id; o.textContent = queueCenterTownName(id);
          sel.appendChild(o);
        });
      }
      if (sel.value !== String(gbQueueCenterTown)) sel.value = String(gbQueueCenterTown);
      w.querySelectorAll('.gb-qc-tab').forEach(b => b.classList.toggle('on', b.dataset.qtab === gbQueueCenterTab));

      const body = w.querySelector('.gb-qc-body');
      gbPaint(body, stage => {
        if (gbQueueCenterTab === 'build') renderQueueCenterBuild(stage, gbQueueCenterTown);
        else if (gbQueueCenterTab === 'research') renderQueueCenterResearch(stage, gbQueueCenterTown);
        else if (gbQueueCenterTab === 'barracks') renderQueueCenterRecruit(stage, gbQueueCenterTown, false);
        else renderQueueCenterRecruit(stage, gbQueueCenterTown, true);
      }, { key: queueCenterKey(gbQueueCenterTown) });
    } finally { gbQcRendering = false; }
  }

  function queueCenterTick() {
    if (!queueCenterVisible()) { queueCenterStopTick(); return; }
    if (document.hidden) return;
    const now = Date.now();
    let finished = false;
    gbQueueCenter.querySelectorAll('.gb-qc-live-row [data-eta]').forEach(el => {
      const left = +el.dataset.eta - (now - (+el.dataset.t0 || now)) / 1000;
      el.textContent = queueCenterFmt(Math.max(0, left));
      if (left <= 0 && el.dataset.done !== '1') { el.dataset.done = '1'; finished = true; }
    });
    if (finished) { gbQcReconciledAt = 0; renderQueueCenter(); }
  }
  function queueCenterStartTick() {
    if (gbQcTickTimer) return;
    gbQcTickTimer = gbInterval(queueCenterTick, 1000);
  }
  function queueCenterStopTick() {
    if (!gbQcTickTimer) return;
    gbClearInterval(gbQcTickTimer); gbQcTickTimer = 0;
  }
  function openQueueCenter(tab, townId) {
    if (tab) gbQueueCenterTab = tab;
    if (townId != null) gbQueueCenterTown = String(townId);

    if (gbQueueCenter && !document.body.contains(gbQueueCenter)) gbQueueCenter = null;
    if (!gbQueueCenter) {
      const w = document.createElement('div');
      w.id = 'grepbot-queue-center';

      w.innerHTML = `<header><b>Colas GrepBot</b><select class="gb-qc-town" title="Ciudad que est\u00e1s gestionando"></select><span class="gb-qc-spacer"></span><button class="gb-qc-refresh" title="Actualizar">\u21bb</button><button class="gb-qc-close" title="Cerrar">\u00d7</button></header><nav><button class="gb-qc-tab" data-qtab="build" data-gb-tip="Cola de construccion (edificios)">Construcci\u00f3n</button><button class="gb-qc-tab" data-qtab="research" data-gb-tip="Cola de investigacion (academia)">Investigaci\u00f3n</button><button class="gb-qc-tab" data-qtab="barracks" data-gb-tip="Cola de reclutamiento del cuartel">Cuartel</button><button class="gb-qc-tab" data-qtab="docks" data-gb-tip="Cola de reclutamiento del puerto">Puerto</button></nav><div class="gb-qc-body"></div>`;
      document.body.appendChild(w);
      gbTipWalk(w);
      try { applyTheme(); } catch (_) {}
      gbQueueCenter = w;
      w.querySelector('.gb-qc-close').addEventListener('click', () => { w.style.display = 'none'; queueCenterStopTick(); });

      w.querySelector('.gb-qc-refresh').addEventListener('click', () => {
        try { nativeQueueSweep('manual'); } catch (_) {}
        gbQcReconciledAt = 0;
        queueCenterPaint(false);
      });

      w.querySelector('.gb-qc-town').addEventListener('change', e => { gbQueueCenterTown = e.target.value; gbQcReconciledAt = 0; queueCenterPaint(false); });
      w.querySelectorAll('.gb-qc-tab').forEach(b => b.addEventListener('click', () => { gbQueueCenterTab = b.dataset.qtab; renderQueueCenterFlush(); }));

      gbListen(document, 'visibilitychange', () => {
        if (document.hidden || !queueCenterVisible()) return;
        gbQcReconciledAt = 0;
        renderQueueCenter();
      });
      makeDraggable(w, w.querySelector('header'));
    }
    gbQueueCenter.style.display = 'flex';
    gbQcReconciledAt = 0;
    if (gbQcPaintTimer) { gbClearTimeout(gbQcPaintTimer); gbQcPaintTimer = 0; }
    queueCenterPaint(false);
    queueCenterStartTick();
  }

