  // ---------------------------------------------------------------------------
  // Queue Center: one draggable window that shows, per town, the game's REAL
  // queue (senate / academy / barracks / docks) next to GrepBot's virtual FIFO
  // plan for the same lane. The native +/- tile controls only ever show one
  // building at a time; this is the whole-town view, and the only place where a
  // queued job can be reordered without opening the matching game window.
  //
  // It is a read + reorder surface. Every mutation goes through the same
  // nativeQueue* API the tile controls use, so the tab-leader gate, the
  // in-flight freeze and the prerequisite-removal blocker all still apply.
  // ---------------------------------------------------------------------------
  let gbQueueCenter = null;
  let gbQueueCenterTab = 'build';
  let gbQueueCenterTown = null;
  // A background scan can re-render the window at any time (nativeQueueSetJobState
  // repaints it), so the picker's current choice lives outside the DOM.
  let gbQueueCenterResearchPick = '';

  // Header-only drag wiring. Reusable for any future floating window: clicks on
  // buttons/selects inside the handle are ignored, and the listeners route
  // through gbListen + gbListenerBag so the panel teardown bag also tears them
  // down. The window clamps against its rendered offsetWidth AND the CSS
  // max-width so a wider box on a narrower viewport cannot escape its bound.
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
  // QC styles live here (not in panel CSS) so they only parse once the user
  // opens the window. Injected once per session.
  if (!state._gbQcCssInjected) {
    state._gbQcCssInjected = true;
    GM_addStyle(`
    #grepbot-queue-center{position:fixed;top:90px;left:90px;width:760px;height:560px;min-width:520px;min-height:320px;max-width:94vw;max-height:88vh;z-index:2147483646;background:var(--gb-bg-deep);color:var(--gb-fg);border:1px solid #4a505b;border-radius:10px;box-shadow:0 10px 32px rgba(0,0,0,.6);display:flex;flex-direction:column;resize:both;overflow:hidden;font:12px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
    #grepbot-queue-center header{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#24272e;border-bottom:1px solid #3d424c;cursor:move;flex-shrink:0}
    #grepbot-queue-center header b{color:var(--gb-accent);font-size:13px}#grepbot-queue-center .gb-qc-spacer{flex:1}
    #grepbot-queue-center header select{max-width:210px;background:#11141a;color:var(--gb-fg);border:1px solid #4b5260;border-radius:5px;padding:4px 7px}
    #grepbot-queue-center header button,#grepbot-queue-center .gb-qc-btn{background:#2d323b;color:#e9edf2;border:1px solid #4f5764;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:11px}
    #grepbot-queue-center header button:hover,#grepbot-queue-center .gb-qc-btn:hover{background:#39404b;border-color:#707a89}#grepbot-queue-center button:disabled{opacity:.35;cursor:default}
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
    try { const d = gbGameDataLookup("units", unit) || {}; return !!(d.is_naval || d.naval); } catch (_) { return false; }
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
  // Every button re-renders unless the handler returns false (a refused action
  // already flashed its own reason and left the model untouched).
  function queueCenterButton(txt, title, fn, cls) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.title = title || ''; b.className = 'gb-qc-btn' + (cls ? ' ' + cls : '');
    b.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      if (!gbInstanceAlive()) return;
      if (!gbTabLeader) { flash('GrepBot está activo en otra pestaña'); return; }
      const r = fn && fn(e);
      if (r !== false) renderQueueCenter();
    });
    return b;
  }
  function queueCenterStatusBadge(status, reason) {
    const s = document.createElement('span'); s.className = 'gb-qc-status ' + String(status || 'pending').replace(/[^a-z-]/gi, '');
    const map = { pending: 'pendiente', ready: 'listo', sending: 'enviando', paused: 'pausada', blocked: 'bloqueada', unknown: 'revisar', 'waiting-resources': 'recursos', 'waiting-population': 'población', 'waiting-queue': 'cola llena', 'waiting-requirement': 'requisito' };
    s.textContent = map[status] || status || 'pendiente'; if (reason) s.title = reason; return s;
  }
  function queueCenterCard(title, subtitle) {
    const box = document.createElement('div'); box.className = 'gb-qc-card';
    const h = document.createElement('div'); h.className = 'gb-qc-card-head';
    const left = document.createElement('div'); const b = document.createElement('b'); b.textContent = title; left.appendChild(b);
    if (subtitle) { const sm = document.createElement('small'); sm.textContent = subtitle; left.appendChild(sm); }
    h.appendChild(left); box.appendChild(h); return { box, head: h };
  }
  function queueCenterEmpty(text) { const d = document.createElement('div'); d.className = 'gb-qc-empty'; d.textContent = text; return d; }
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
  // Live-row DOM for the "real queue" card. Renders `#N`, label, time.
  function queueCenterLiveRow(num, label, timeStr, numTitle) {
    const r = document.createElement('div'); r.className = 'gb-qc-live-row';
    const n = document.createElement('span'); n.textContent = `#${num}`; if (numTitle) n.title = numTitle;
    const nm = document.createElement('b'); nm.textContent = label;
    const t = document.createElement('span'); t.textContent = timeStr;
    r.append(n, nm, t); return r;
  }
  // Plan-job DOM for the GrepBot virtual FIFO card. Renders reorder/remove
  // buttons via the same queueCenterButton + nativeQueueMove path the inline
  // version used; disabled states mirror the lane's frozen/manualReview flag.
  function queueCenterJobRow(num, desc, badge, lane, townId, job, frozen, i, list) {
    const r = document.createElement('div'); r.className = 'gb-qc-job';
    const numEl = document.createElement('b'); numEl.textContent = `#${num}`;
    const descEl = document.createElement('div'); descEl.className = 'gb-qc-job-desc';
    const main = document.createElement('span'); main.textContent = desc;
    descEl.append(main, badge);
    const acts = document.createElement('div'); acts.className = 'gb-qc-acts';
    const up = queueCenterButton('↑', 'Subir', () => nativeQueueMove(townId, lane, job.id, -1));
    const dn = queueCenterButton('↓', 'Bajar', () => nativeQueueMove(townId, lane, job.id, 1));
    const del = queueCenterButton('×', 'Eliminar', () => queueCenterRemove(townId, lane, job, frozen), 'danger');
    up.disabled = frozen || i === 0;
    dn.disabled = frozen || i === list.length - 1;
    del.disabled = !!job.inflight;
    acts.append(up, dn, del); r.append(numEl, descEl, acts); return r;
  }
  // Same confirm ladder as nativeRenderQueuePanel: an in-flight job is never
  // removable, a manualReview job needs the user to accept that the post may or
  // may not have landed, and any other job behind a frozen head needs a nudge.
  // nativeQueueRemove still owns the prerequisite-dependency refusal.
  function queueCenterRemove(townId, lane, job, frozen) {
    if (job.inflight) { flash('Esta orden se está enviando; espera a que termine'); return false; }
    if (job.manualReview) {
      let ok = false;
      try { ok = gameUw().confirm('Comprueba primero la cola real. Borrar este elemento confirma que asumes si la acción se envió o no.'); } catch (_) { ok = false; }
      if (!ok) return false;
    } else if (frozen) {
      let ok = false;
      try { ok = gameUw().confirm('Hay otra acción pendiente en esta cola. ¿Borrar este elemento de todos modos?'); } catch (_) { ok = false; }
      if (!ok) return false;
    }
    return nativeQueueRemove(townId, lane, job.id, { force: true });
  }

  function renderQueueCenterBuild(body, townId) {
    const q = abQueueInfo(townId);
    const live = queueCenterCard('Cola real de construcción', q.known ? `${q.len}/${q.max}` : 'estado no legible');
    body.appendChild(live.box);
    if (q.known && q.orders.length) {
      q.orders.forEach((o, i) => {
        const left = o.to_be_completed_at ? Math.max(0, +o.to_be_completed_at - gameNow()) : o.building_time;
        live.box.appendChild(queueCenterLiveRow(i + 1, nativeBuildLabel(o.building_type), queueCenterFmt(left)));
      });
    } else live.box.appendChild(queueCenterEmpty(q.known ? 'Sin construcciones reales' : 'No se puede leer la cola real'));

    const list = nativeQueueList(townId, 'build', false), fifo = nativeQueueIsFifo(townId, 'build'), paused = nativeQueuePaused(townId, 'build');
    const plan = queueCenterCard('Plan GrepBot · Construcción', fifo ? (paused ? 'FIFO pausada' : 'FIFO activa') : 'Objetivos automáticos');
    body.appendChild(plan.box);
    plan.head.appendChild(queueCenterButton(paused ? '> Reanudar' : '|| Pausar', paused ? 'Reanudar cola' : 'Pausar cola', () => nativeQueueTogglePaused(townId, 'build')));
    if (!list.length && fifo) plan.head.appendChild(queueCenterButton('Objetivos', 'Volver al planificador automático', () => nativeQueueUseLegacy(townId, 'build')));
    // The advisory card is most useful precisely when the FIFO is empty, so it
    // must render on this path too, not only after a populated list.
    if (!list.length) { plan.box.appendChild(queueCenterEmpty(fifo ? 'Cola FIFO vacía. Añade edificios con + desde el Senado.' : 'Esta ciudad usa el planificador de objetivos.')); renderQueueCenterOptimal(body, townId); return; }
    plan.box.appendChild(queueCenterSequence('Orden FIFO', list.map((j, i) => ({
      text: `#${i + 1} ${nativeBuildLabel(j.building)}`,
      title: `${nativeBuildLabel(j.building)} ${j.fromLevel}→${j.toLevel}${j.reason ? ' · ' + j.reason : ''}`,
    }))));
    const frozen = list.some(j => j && (j.inflight || j.manualReview));
    list.forEach((j, i) => {
      plan.box.appendChild(queueCenterJobRow(
        i + 1,
        `${nativeBuildLabel(j.building)} ${j.fromLevel}→${j.toLevel}`,
        queueCenterStatusBadge(j.status, j.reason),
        'build', townId, j, frozen, i, list,
      ));
    });
    renderQueueCenterSwap(body, townId);
    renderQueueCenterOptimal(body, townId);
  }

  // Suggestion only (v4 plan 5.6): a stalled head blocks everything behind it,
  // so offer to promote the first successor that is actually affordable. The
  // reorder happens on a user click through the same nativeQueueMove the arrows
  // use, so the in-flight freeze and the tab-leader gate still apply.
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

  // ADVISORY card (v4 plan 2.9). Nothing here posts and nothing here re-routes
  // the auto-queue: the native FIFO head still wins in abPickNextFromLevels.
  // The only write is an explicit user click that APPENDS to the FIFO tail.
  function renderQueueCenterOptimal(body, townId) {
    if (state.abOptimalOrderOn === false) return;
    let opt = null;
    try { opt = abOptimalOrderCached(townId); } catch (e) { opt = { error: String(e).slice(0, 60), actions: [] }; }
    const card = queueCenterCard('Secuencia óptima · Construcción', 'solo consejo - no envia nada');
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
      main.textContent = `${nativeBuildLabel(a.building)}${a.level ? ' ' + (a.level - 1) + '→' + a.level : ''}` +
        (a.etaMs ? ' · ' + queueCenterFmt(Math.round(a.etaMs / 1000)) : '');
      desc.append(main, queueCenterStatusBadge(a.status, a.why));
      r.append(num, desc); card.box.appendChild(r);
    });
    const addable = rows.filter(a => a.building && a.status !== 'blocked');
    const btn = queueCenterButton('+ Añadir secuencia', 'Anade estos edificios al final de la cola FIFO. No toca la cabeza actual.', () => {
      let n = 0;
      for (const a of addable) {
        // nativeQueueAddBuild flashes its own reason on refusal; abort the rest
        // rather than skipping past a conflict and queueing out of order.
        if (!nativeQueueAddBuild(townId, a.building)) break;
        n++;
      }
      if (n) flash(`+${n} edificios anadidos a la cola FIFO @${townId}`);
    });
    btn.disabled = !addable.length;
    card.head.appendChild(btn);
  }

  // Academy techs the town could still queue. The list is built from GameData,
  // so an unreadable GameData yields an empty select (and a disabled button)
  // instead of a free-text field that could post a tech id the game never had.
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
    const add = queueCenterButton('+ Añadir', 'Añadir esta investigación al final de la cola (los requisitos se insertan delante)', () => {
      const tech = sel.value;
      if (!tech) { flash('Selecciona una investigación'); return false; }
      gbQueueCenterResearchPick = '';
      return nativeQueueAddResearch(townId, tech);
    });
    // An unreadable academy means "unknown", not "everything available": without
    // info the filter cannot tell researched from pending, so the picker closes
    // rather than offering a tech the town already has.
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
      : (info.ordersKnown ? `${orders.length}/${researchQueueMax()} · Academia ${info.academy || 0}`
        : `cola real ilegible · Academia ${info.academy || 0}`);
    const live = queueCenterCard('Cola real de investigación', liveSub);
    body.appendChild(live.box);
    if (orders.length) {
      orders.forEach((o, i) => {
        const id = researchOrderTechId(o);
        live.box.appendChild(queueCenterLiveRow(i + 1, researchLabel(id) || String(id || '?'), queueCenterFmt(queueCenterTimeLeft(o))));
      });
    } else live.box.appendChild(queueCenterEmpty(info ? 'Sin investigaciones en curso' : 'No se puede leer la Academia'));

    // Virtual FIFO lane — same contract as build/recruit: reorder, pause, remove.
    const list = nativeQueueList(townId, 'research', false), fifo = nativeQueueIsFifo(townId, 'research'), paused = nativeQueuePaused(townId, 'research');
    const plan = queueCenterCard('Plan GrepBot · Investigación', fifo ? (paused ? 'FIFO pausada' : 'FIFO activa') : 'Objetivos automáticos');
    body.appendChild(plan.box);
    plan.head.appendChild(queueCenterButton(paused ? '> Reanudar' : '|| Pausar', paused ? 'Reanudar cola' : 'Pausar cola', () => nativeQueueTogglePaused(townId, 'research')));
    if (!list.length && fifo) plan.head.appendChild(queueCenterButton('Objetivos', 'Volver al planificador automático', () => nativeQueueUseLegacy(townId, 'research')));
    plan.box.appendChild(queueCenterResearchPicker(townId, info));
    if (!list.length) {
      plan.box.appendChild(queueCenterEmpty(fifo ? 'Cola FIFO vacía. Añade investigaciones arriba o con + desde la Academia.' : 'Esta ciudad usa el planificador de objetivos.'));
    } else {
      plan.box.appendChild(queueCenterSequence('Orden FIFO', list.map((j, i) => ({
        text: `#${i + 1} ${nativeResearchLabel(j.tech)}`,
        title: j.reason || nativeResearchLabel(j.tech),
      }))));
      const frozen = list.some(j => j && (j.inflight || j.manualReview));
      list.forEach((j, i) => {
        plan.box.appendChild(queueCenterJobRow(
          i + 1,
          nativeResearchLabel(j.tech),
          queueCenterStatusBadge(j.status, j.reason),
          'research', townId, j, frozen, i, list,
        ));
      });
    }

    const targets = goalEffectiveResearchTargets(townId, researchEnsureTargets());
    const planned = queueCenterCard('Próximas investigaciones', fifo && list.length ? 'planificador automático (en pausa: manda la cola FIFO)' : 'orden del planificador');
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
        // A blind pass is not a verified "ready" — say so rather than claiming
        // the tech is affordable when nothing was actually read.
        st = !dep ? 'requisito'
          : (aff && aff.ok ? (aff.blind ? 'listo (sin verificar)' : 'listo')
            : (aff && aff.why) || 'esperando');
      } catch (_) {}
      const badge = document.createElement('span'); badge.className = 'gb-qc-muted'; badge.textContent = st;
      r.append(n, nm, badge); planned.box.appendChild(r);
    });
    if (!shown) planned.box.appendChild(queueCenterEmpty('No hay investigaciones pendientes en el plan.'));
  }

  // Barracks and docks are two independent queues, in the game and here: each
  // tab shows only its own lane and its positions are local to that lane, so
  // reordering triremes can never move a hoplite.
  function renderQueueCenterRecruit(body, townId, wantNaval) {
    const label = wantNaval ? 'Puerto' : 'Cuartel';
    const lane = wantNaval ? 'recruitNaval' : 'recruit';
    const q = recruitQueueInfo(townId);
    const liveModels = (q.models || []).filter(m => queueCenterUnitIsNaval(queueCenterUnitId(m)) === wantNaval);
    const live = queueCenterCard(`Cola real · ${label}`, q.known ? `${liveModels.length}${q.max != null ? ' / ' + q.max : ''}` : 'estado no legible');
    body.appendChild(live.box);
    if (liveModels.length) {
      liveModels.forEach((m, i) => {
        const id = queueCenterUnitId(m);
        live.box.appendChild(queueCenterLiveRow(
          i + 1,
          `${queueCenterUnitAmount(m)}× ${nativeUnitLabel(id)}`,
          queueCenterFmt(queueCenterTimeLeft(m)),
          `posición en la cola real de ${label.toLowerCase()}`,
        ));
      });
    } else live.box.appendChild(queueCenterEmpty(q.known ? `Sin órdenes en ${label.toLowerCase()}` : 'No se puede leer la cola real'));

    const list = nativeQueueList(townId, lane, false);
    const fifo = nativeQueueIsFifo(townId, lane), paused = nativeQueuePaused(townId, lane);
    const plan = queueCenterCard(`Plan GrepBot · ${label}`, fifo ? (paused ? 'FIFO pausada' : 'FIFO activa') : 'Objetivos automáticos');
    body.appendChild(plan.box);
    plan.head.appendChild(queueCenterButton(paused ? '> Reanudar' : '|| Pausar', paused ? `Reanudar ${label.toLowerCase()}` : `Pausar ${label.toLowerCase()}`, () => nativeQueueTogglePaused(townId, lane)));
    if (!list.length && fifo) plan.head.appendChild(queueCenterButton('Objetivos', 'Volver al planificador automático', () => nativeQueueUseLegacy(townId, lane)));
    if (!list.length) { plan.box.appendChild(queueCenterEmpty(fifo ? `No hay órdenes ${wantNaval ? 'navales' : 'terrestres'} pendientes. Añádelas con + desde ${label}.` : 'Esta ciudad usa objetivos automáticos.')); return; }
    plan.box.appendChild(queueCenterSequence(`Orden FIFO · ${label}`, list.map((j, i) => ({
      text: `#${i + 1} ${j.amount}× ${nativeUnitLabel(j.unit)}`,
      title: j.reason || nativeUnitLabel(j.unit),
    }))));
    const frozen = list.some(j => j && (j.inflight || j.manualReview));
    list.forEach((j, i) => {
      plan.box.appendChild(queueCenterJobRow(
        i + 1,
        `${j.amount}× ${nativeUnitLabel(j.unit)}`,
        queueCenterStatusBadge(j.status, j.reason),
        lane, townId, j, frozen, i, list,
      ));
    });
  }

  // Reentrancy guard: the reconcile below saves through nativeQueueSave, which
  // calls straight back into this function. Without the guard the window paints
  // twice per repaint from two different snapshots of the same state.
  let gbQcRendering = false;
  let gbQcReconciledAt = 0;
  function renderQueueCenter() {
    const w = gbQueueCenter;
    if (!w || !document.body.contains(w)) return;
    if (w.style.display === 'none') return;
    if (gbQcRendering) return;
    const ids = queueCenterTownIds();
    if (!ids.length) return;
    if (!gbQueueCenterTown || !ids.includes(String(gbQueueCenterTown))) {
      let cur = null;
      try { cur = gameUw().Game && gameUw().Game.townId; } catch (_) {}
      gbQueueCenterTown = String(cur || ids[0]);
    }
    gbQcRendering = true;
    try {
      // The window is a live view of the game, not of storage: re-check the
      // shown town against the real model before painting, so a job the player
      // completed by hand disappears on the next 5s repaint instead of waiting
      // for an auto-queue sweep. Throttled — every button click lands here too.
      if (Date.now() - gbQcReconciledAt > 2000) {
        gbQcReconciledAt = Date.now();
        try { nativeQueueReconcileTown(gbQueueCenterTown); } catch (_) {}
      }
      const sel = w.querySelector('.gb-qc-town'); sel.replaceChildren();
      ids.forEach(id => {
        const o = document.createElement('option'); o.value = id; o.textContent = queueCenterTownName(id);
        if (id === String(gbQueueCenterTown)) o.selected = true;
        sel.appendChild(o);
      });
      w.querySelectorAll('.gb-qc-tab').forEach(b => b.classList.toggle('on', b.dataset.qtab === gbQueueCenterTab));
      const body = w.querySelector('.gb-qc-body'); body.replaceChildren();
      if (gbQueueCenterTab === 'build') renderQueueCenterBuild(body, gbQueueCenterTown);
      else if (gbQueueCenterTab === 'research') renderQueueCenterResearch(body, gbQueueCenterTown);
      else if (gbQueueCenterTab === 'barracks') renderQueueCenterRecruit(body, gbQueueCenterTown, false);
      else renderQueueCenterRecruit(body, gbQueueCenterTown, true);
    } finally { gbQcRendering = false; }
  }

  function openQueueCenter(tab, townId) {
    if (tab) gbQueueCenterTab = tab;
    if (townId != null) gbQueueCenterTown = String(townId);
    // A cached handle whose node the SPA already detached would flip display on
    // an orphan: renderQueueCenter bails on !document.body.contains(w) and the
    // window silently never appears.
    if (gbQueueCenter && !document.body.contains(gbQueueCenter)) gbQueueCenter = null;
    if (!gbQueueCenter) {
      const w = document.createElement('div');
      w.id = 'grepbot-queue-center';
      w.innerHTML = `<header><b>Colas GrepBot</b><select class="gb-qc-town" title="Ciudad que estás gestionando"></select><span class="gb-qc-spacer"></span><button class="gb-qc-refresh" title="Actualizar">↻</button><button class="gb-qc-close" title="Cerrar">×</button></header><nav><button class="gb-qc-tab" data-qtab="build">Construcción</button><button class="gb-qc-tab" data-qtab="research">Investigación</button><button class="gb-qc-tab" data-qtab="barracks">Cuartel</button><button class="gb-qc-tab" data-qtab="docks">Puerto</button></nav><div class="gb-qc-body"></div>`;
      document.body.appendChild(w);
      try { applyTheme(); } catch (_) {}
      gbQueueCenter = w;
      w.querySelector('.gb-qc-close').addEventListener('click', () => { w.style.display = 'none'; });
      // Manual refresh sweeps EVERY town, not just the one on screen — the
      // button is what a player reaches for after hand-editing several queues.
      w.querySelector('.gb-qc-refresh').addEventListener('click', () => {
        try { nativeQueueSweep('manual'); } catch (_) {}
        gbQcReconciledAt = 0;
        renderQueueCenter();
      });
      w.querySelector('.gb-qc-town').addEventListener('change', e => { gbQueueCenterTown = e.target.value; renderQueueCenter(); });
      w.querySelectorAll('.gb-qc-tab').forEach(b => b.addEventListener('click', () => { gbQueueCenterTab = b.dataset.qtab; renderQueueCenter(); }));
      makeDraggable(w, w.querySelector('header'));
    }
    gbQueueCenter.style.display = 'flex';
    renderQueueCenter();
  }
