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
  let gbQueueCenterDrag = null;
  // A background scan can re-render the window at any time (nativeQueueSetJobState
  // repaints it), so the picker's current choice lives outside the DOM.
  let gbQueueCenterResearchPick = '';

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
    try { const d = recruitUnitDef(unit) || {}; return !!(d.is_naval || d.naval); } catch (_) { return false; }
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
        const r = document.createElement('div'); r.className = 'gb-qc-live-row';
        const n = document.createElement('span'); n.textContent = `#${i + 1}`;
        const nm = document.createElement('b'); nm.textContent = nativeBuildLabel(o.building_type);
        const t = document.createElement('span');
        const left = o.to_be_completed_at ? Math.max(0, +o.to_be_completed_at - gameNow()) : o.building_time;
        t.textContent = queueCenterFmt(left);
        r.append(n, nm, t); live.box.appendChild(r);
      });
    } else live.box.appendChild(queueCenterEmpty(q.known ? 'Sin construcciones reales' : 'No se puede leer la cola real'));

    const list = nativeQueueList(townId, 'build', false), fifo = nativeQueueIsFifo(townId, 'build'), paused = nativeQueuePaused(townId, 'build');
    const plan = queueCenterCard('Plan GrepBot · Construcción', fifo ? (paused ? 'FIFO pausada' : 'FIFO activa') : 'Objetivos automáticos');
    body.appendChild(plan.box);
    plan.head.appendChild(queueCenterButton(paused ? '> Reanudar' : '|| Pausar', paused ? 'Reanudar cola' : 'Pausar cola', () => nativeQueueTogglePaused(townId, 'build')));
    if (!list.length && fifo) plan.head.appendChild(queueCenterButton('Objetivos', 'Volver al planificador automático', () => nativeQueueUseLegacy(townId, 'build')));
    if (!list.length) { plan.box.appendChild(queueCenterEmpty(fifo ? 'Cola FIFO vacía. Añade edificios con + desde el Senado.' : 'Esta ciudad usa el planificador de objetivos.')); return; }
    plan.box.appendChild(queueCenterSequence('Orden FIFO', list.map((j, i) => ({
      text: `#${i + 1} ${nativeBuildLabel(j.building)}`,
      title: `${nativeBuildLabel(j.building)} ${j.fromLevel}→${j.toLevel}${j.reason ? ' · ' + j.reason : ''}`,
    }))));
    const frozen = list.some(j => j && (j.inflight || j.manualReview));
    list.forEach((j, i) => {
      const r = document.createElement('div'); r.className = 'gb-qc-job';
      const num = document.createElement('b'); num.textContent = `#${i + 1}`;
      const desc = document.createElement('div'); desc.className = 'gb-qc-job-desc';
      const main = document.createElement('span'); main.textContent = `${nativeBuildLabel(j.building)} ${j.fromLevel}→${j.toLevel}`;
      desc.append(main, queueCenterStatusBadge(j.status, j.reason));
      const acts = document.createElement('div'); acts.className = 'gb-qc-acts';
      const up = queueCenterButton('↑', 'Subir', () => nativeQueueMove(townId, 'build', j.id, -1));
      const dn = queueCenterButton('↓', 'Bajar', () => nativeQueueMove(townId, 'build', j.id, 1));
      const del = queueCenterButton('×', 'Eliminar', () => queueCenterRemove(townId, 'build', j, frozen), 'danger');
      up.disabled = frozen || i === 0;
      dn.disabled = frozen || i === list.length - 1;
      del.disabled = !!j.inflight;
      acts.append(up, dn, del); r.append(num, desc, acts); plan.box.appendChild(r);
    });
  }

  // Academy techs the town could still queue. The list is built from GameData,
  // so an unreadable GameData yields an empty select (and a disabled button)
  // instead of a free-text field that could post a tech id the game never had.
  function queueCenterResearchOptions(townId, info) {
    let all = [];
    try { all = Object.keys((gameUw().GameData && gameUw().GameData.researches) || {}); } catch (_) {}
    return all.filter(id => {
      if (!researchDef(id)) return false;
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
        const r = document.createElement('div'); r.className = 'gb-qc-live-row';
        const n = document.createElement('span'); n.textContent = `#${i + 1}`;
        const nm = document.createElement('b'); nm.textContent = researchLabel(id) || String(id || '?');
        const t = document.createElement('span'); t.textContent = queueCenterFmt(queueCenterTimeLeft(o));
        r.append(n, nm, t); live.box.appendChild(r);
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
        const r = document.createElement('div'); r.className = 'gb-qc-job';
        const num = document.createElement('b'); num.textContent = `#${i + 1}`;
        const desc = document.createElement('div'); desc.className = 'gb-qc-job-desc';
        const main = document.createElement('span'); main.textContent = nativeResearchLabel(j.tech);
        desc.append(main, queueCenterStatusBadge(j.status, j.reason));
        const acts = document.createElement('div'); acts.className = 'gb-qc-acts';
        const up = queueCenterButton('↑', 'Subir', () => nativeQueueMove(townId, 'research', j.id, -1));
        const dn = queueCenterButton('↓', 'Bajar', () => nativeQueueMove(townId, 'research', j.id, 1));
        const del = queueCenterButton('×', 'Eliminar', () => queueCenterRemove(townId, 'research', j, frozen), 'danger');
        up.disabled = frozen || i === 0;
        dn.disabled = frozen || i === list.length - 1;
        del.disabled = !!j.inflight;
        acts.append(up, dn, del); r.append(num, desc, acts); plan.box.appendChild(r);
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
        const r = document.createElement('div'); r.className = 'gb-qc-live-row';
        const n = document.createElement('span'); n.textContent = `#${i + 1}`;
        n.title = `posición en la cola real de ${label.toLowerCase()}`;
        const nm = document.createElement('b'); nm.textContent = `${queueCenterUnitAmount(m)}× ${nativeUnitLabel(id)}`;
        const t = document.createElement('span'); t.textContent = queueCenterFmt(queueCenterTimeLeft(m));
        r.append(n, nm, t); live.box.appendChild(r);
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
      const r = document.createElement('div'); r.className = 'gb-qc-job';
      const num = document.createElement('b'); num.textContent = `#${i + 1}`; num.title = `posición en la cola de ${label.toLowerCase()}`;
      const desc = document.createElement('div'); desc.className = 'gb-qc-job-desc';
      const main = document.createElement('span'); main.textContent = `${j.amount}× ${nativeUnitLabel(j.unit)}`;
      desc.append(main, queueCenterStatusBadge(j.status, j.reason));
      const acts = document.createElement('div'); acts.className = 'gb-qc-acts';
      const up = queueCenterButton('↑', 'Subir', () => nativeQueueMove(townId, lane, j.id, -1));
      const dn = queueCenterButton('↓', 'Bajar', () => nativeQueueMove(townId, lane, j.id, 1));
      const del = queueCenterButton('×', 'Eliminar', () => queueCenterRemove(townId, lane, j, frozen), 'danger');
      up.disabled = frozen || i === 0;
      dn.disabled = frozen || i === list.length - 1;
      del.disabled = !!j.inflight;
      acts.append(up, dn, del); r.append(num, desc, acts); plan.box.appendChild(r);
    });
  }

  function renderQueueCenter() {
    const w = gbQueueCenter;
    if (!w || !document.body.contains(w)) return;
    if (w.style.display === 'none') return;
    const ids = queueCenterTownIds();
    if (!ids.length) return;
    if (!gbQueueCenterTown || !ids.includes(String(gbQueueCenterTown))) {
      let cur = null;
      try { cur = gameUw().Game && gameUw().Game.townId; } catch (_) {}
      gbQueueCenterTown = String(cur || ids[0]);
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
      gbQueueCenter = w;
      w.querySelector('.gb-qc-close').addEventListener('click', () => { w.style.display = 'none'; });
      w.querySelector('.gb-qc-refresh').addEventListener('click', renderQueueCenter);
      w.querySelector('.gb-qc-town').addEventListener('change', e => { gbQueueCenterTown = e.target.value; renderQueueCenter(); });
      w.querySelectorAll('.gb-qc-tab').forEach(b => b.addEventListener('click', () => { gbQueueCenterTab = b.dataset.qtab; renderQueueCenter(); }));
      // The window sits above the game canvas, so drag lives on the header only
      // and the listeners are registered in gbListenerBag for teardown.
      const h = w.querySelector('header');
      h.addEventListener('mousedown', e => {
        if (e.target.closest('button,select')) return;
        const r = w.getBoundingClientRect();
        gbQueueCenterDrag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
        e.preventDefault();
      });
      const move = e => {
        if (!gbQueueCenterDrag) return;
        w.style.left = Math.max(0, Math.min(innerWidth - w.offsetWidth, e.clientX - gbQueueCenterDrag.dx)) + 'px';
        w.style.top = Math.max(0, Math.min(innerHeight - w.offsetHeight, e.clientY - gbQueueCenterDrag.dy)) + 'px';
        w.style.right = 'auto';
      };
      const up = () => { gbQueueCenterDrag = null; };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
      gbListenerBag.push({ target: document, type: 'mousemove', fn: move, opts: undefined }, { target: document, type: 'mouseup', fn: up, opts: undefined });
    }
    gbQueueCenter.style.display = 'flex';
    renderQueueCenter();
  }
