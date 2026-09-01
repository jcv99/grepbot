  function spsCfg() {
    const c = (state.spySendCfg && typeof state.spySendCfg === 'object' && !Array.isArray(state.spySendCfg)) ? state.spySendCfg : {};
    return {
      targetId: String(c.targetId || '').trim(),
      sourceTownId: String(c.sourceTownId || '').trim(),
      mode: c.mode === 'bulk' ? 'bulk' : 'rapid',
      chunk: gbCfgClamp(c.chunk, 1, 1000000, SPS_DEFAULT_CHUNK),
      waves: gbCfgClamp(c.waves, 0, SPS_MAX_WAVES, 5),
      untilEmpty: c.untilEmpty !== false,
      bulkAll: c.bulkAll !== false,
      bulkAmount: gbCfgClamp(c.bulkAmount, 0, 100000000, 0),
      gapMs: gbCfgClamp(c.gapMs, 300, 60000, 1200),
    };
  }
  function spsCfgSave(patch) {
    state.spySendCfg = Object.assign({}, spsCfg(), patch || {});
    save(STORE.SPY_SEND_CFG, state.spySendCfg);
  }
  function spsHistory() {
    if (!Array.isArray(state.spySendHistory)) state.spySendHistory = [];
    return state.spySendHistory;
  }
  function spsPushHistory(entry) {
    const h = spsHistory();
    h.unshift(entry);
    if (h.length > SPS_HISTORY_MAX) h.length = SPS_HISTORY_MAX;
    save(STORE.SPY_SEND_HISTORY, h);
  }

  function spsCaveSilver(townId) {
    let info = null;
    try { info = caveTownInfo(townId); } catch (_) { info = null; }
    if (!info) return { stored: null, hideLvl: null, unlimited: false };
    const stored = Number.isFinite(+info.stored) && +info.stored >= 0 ? +info.stored : null;
    return { stored, hideLvl: Number.isFinite(+info.hideLvl) ? +info.hideLvl : null, unlimited: !!info.unlimited };
  }

  function spsStoredFromResponse(res) {
    if (!res || typeof res !== 'object') return null;
    const probe = [res, res.json, res.data, res.response];
    for (const o of probe) {
      if (!o || typeof o !== 'object') continue;
      const v = o.stored_iron != null ? o.stored_iron : (o.espionage_storage != null ? o.espionage_storage : null);
      if (v != null && Number.isFinite(+v) && +v >= 0) return +v;
    }
    return null;
  }
  function spsIsOwnTown(id) {
    const s = String(id == null ? '' : id);
    if (!s) return false;
    if ((state.towns || []).some(t => String(t.id) === s)) return true;
    try {
      const uw = gameUw();
      if (uw.ITowns && uw.ITowns.towns && uw.ITowns.towns[s]) return true;
    } catch (_) { return false; }
    return false;
  }
  function spsSourceTownId(cfg) {
    const towns = state.towns || [];
    const want = String(cfg.sourceTownId || '');
    if (want && towns.some(t => String(t.id) === want)) return want;
    try {
      const uw = gameUw();
      const cur = uw.Game && uw.Game.townId;
      if (cur != null) return String(cur);
    } catch (_) {}
    return towns.length ? String(towns[0].id) : '';
  }
  function spsPost(srcTownId, targetId, amount, onDone) {
    const params = { id: +targetId, espionage_iron: Math.floor(+amount), town_id: +srcTownId };
    if (state.exportRedact === false) gbLog('spy ajax:', JSON.stringify(params));
    else gbLog(`spy ajax: town_info/spy town ${srcTownId} -> ${targetId} (${Math.floor(+amount)} plata)`);
    gameAjaxPost('spy', 'town_info', 'spy', params, onDone);
  }

  function spsPlan() {
    const cfg = spsCfg();
    const src = spsSourceTownId(cfg);
    if (!src) return { error: 'sin ciudad de origen' };
    const target = String(cfg.targetId || '').trim();
    if (!/^\d+$/.test(target)) return { error: 'objetivo invalido (id de ciudad numerico)' };
    if (String(target) === String(src)) return { error: 'origen y objetivo son la misma ciudad' };
    if (spsIsOwnTown(target)) return { error: 'el objetivo es una ciudad propia' };
    const cave = spsCaveSilver(src);
    const out = { cfg, src, target, cave };
    if (cfg.mode === 'bulk') {
      if (cfg.bulkAll) {
        if (cave.stored == null) return Object.assign(out, { error: 'plata de la cueva ilegible: escribe una cantidad exacta en vez de "toda"' });
        if (!(cave.stored > 0)) return Object.assign(out, { error: 'la cueva no tiene plata' });
        out.amount = cave.stored;
      } else {
        if (!(cfg.bulkAmount > 0)) return Object.assign(out, { error: 'cantidad invalida' });
        out.amount = cave.stored != null ? Math.min(cfg.bulkAmount, cave.stored) : cfg.bulkAmount;
        if (!(out.amount > 0)) return Object.assign(out, { error: 'la cueva no tiene plata' });
      }
      out.waves = 1;
      out.total = out.amount;
      return out;
    }

    const chunk = cfg.chunk;
    if (cave.stored != null && !(cave.stored > 0)) return Object.assign(out, { error: 'la cueva no tiene plata' });
    let waves = cfg.waves;
    if (!waves) {
      if (cave.stored == null) return Object.assign(out, { error: 'plata ilegible: "hasta vaciar" necesita un numero de rafagas' });
      waves = Math.min(SPS_MAX_WAVES, Math.ceil(cave.stored / chunk));
    } else if (cfg.untilEmpty && cave.stored != null) {
      waves = Math.min(waves, Math.max(1, Math.ceil(cave.stored / chunk)));
    }
    out.chunk = chunk;
    out.waves = Math.max(1, Math.min(SPS_MAX_WAVES, waves));
    out.total = cave.stored != null ? Math.min(cave.stored, out.waves * chunk) : out.waves * chunk;
    return out;
  }
  function spsPlanText(plan) {
    const lines = [];
    const name = townNameById(plan.src);
    lines.push((state.dryRun ? '[SIMULACION] ' : '') + `Espiar #${plan.target}`);
    lines.push(`Origen: ${name} (#${plan.src})`);
    lines.push(`Cueva: ${plan.cave.stored == null ? 'ilegible' : plan.cave.stored + ' plata'}${plan.cave.hideLvl != null ? ` (nivel ${plan.cave.hideLvl})` : ''}`);
    if (plan.cfg.mode === 'bulk') lines.push(`Modo masivo: 1 envio de ${plan.amount} plata`);
    else lines.push(`Modo rapido: hasta ${plan.waves} rafaga(s) de ${plan.chunk} plata${plan.cfg.untilEmpty ? ' (para al vaciar la cueva)' : ''}`);
    lines.push(`Plata comprometida: ~${plan.total}`);
    lines.push('Enviar?');
    return lines.join('\n');
  }

  function spsStop() {
    if (!gbLocked('spy')) { flash('espionaje: no hay rafaga en curso'); return; }
    spsStopFlag = true;
    gbLog('spy: stop requested');
    flash('espionaje: parando tras la rafaga actual');
  }
  function spsProgress(txt) {
    const sec = panel && panel.querySelector('section[data-tab=spy]');
    const el = sec && sec.querySelector('#gb-sp-progress');
    if (el) el.textContent = txt;
  }
  function spsRun() {
    if (gbLocked('spy')) { flash('espionaje ya en curso'); return; }
    if (!hostEnabled()) { flash('bot desactivado en este servidor'); return; }
    if (automationPaused({})) { flash('automatizacion en pausa'); return; }
    if (captchaPaused('spy')) { flash('espionaje pausado (captcha)'); return; }
    const plan = spsPlan();
    if (plan.error) { flash(plan.error); gbLog('spy: ' + plan.error); return; }
    let ok = false;
    try { ok = gameUw().confirm(spsPlanText(plan)); } catch (_) { ok = false; }
    if (!ok) { gbLog('spy: confirm declined'); return; }

    const token = gbLock('spy');
    if (!token) { flash('espionaje ocupado (otro envio en curso)'); return; }
    spsStopFlag = false;
    const startedAt = Date.now();
    let wave = 0, sentWaves = 0, spent = 0, stopWhy = 'done', anyDry = false, anyReal = false;
    let remaining = plan.cave.stored;
    const finish = () => {
      gbUnlock('spy', token);

      if (anyReal) { try { spyLastSpy()[plan.target] = Date.now(); spyHistorySave(); } catch (_) {} }
      const msg = `espionaje: ${sentWaves} envio(s), ${spent} plata (${stopWhy})${anyDry ? ' [simulacion]' : ''}`;
      gbLog('spy: ' + msg);
      flash(msg);
      spsProgress(msg);
      spsPushHistory({
        ts: startedAt, src: plan.src, target: plan.target, mode: plan.cfg.mode,
        waves: sentWaves, silver: spent, why: stopWhy,
        left: remaining == null ? null : remaining,
      });
      renderSpySend();
    };
    const step = () => {
      gbLockTouch('spy', token);
      if (spsStopFlag) { stopWhy = 'parado'; return finish(); }
      if (wave >= plan.waves) { stopWhy = 'rafagas completadas'; return finish(); }
      if (remaining != null && remaining <= 0) { stopWhy = 'cueva vacia'; return finish(); }
      if (captchaPaused('spy')) { stopWhy = 'captcha'; return finish(); }
      if (automationPaused({})) { stopWhy = 'pausa'; return finish(); }
      const want = plan.cfg.mode === 'bulk' ? plan.amount : plan.chunk;
      const amount = remaining != null ? Math.min(want, remaining) : want;
      if (!(amount > 0)) { stopWhy = 'cueva vacia'; return finish(); }
      wave++;
      spsProgress(`enviando rafaga ${wave}/${plan.waves} (${amount} plata)...`);
      spsPost(plan.src, plan.target, amount, (err, res) => {
        if (err) {

          if (err === 'dryrun') {

            anyDry = true;
            sentWaves++;
            if (remaining != null) remaining = Math.max(0, remaining - amount);
            spent += amount;
            gbTimeout(step, 200);
            return;
          }

          if (err === 'pending') {
            stopWhy = state.dryRun
              ? 'simulacion: intento duplicado (la plata no baja en simulacion)'
              : 'intento duplicado (la cueva no se ha actualizado aun)';
            return finish();
          }
          stopWhy = 'error: ' + err;
          gbLogT('spy-send-err', 60000, `spy err ${err}`);
          return finish();
        }
        sentWaves++;
        anyReal = true;
        spent += amount;
        const srv = spsStoredFromResponse(res);
        if (srv != null) remaining = srv;
        else if (remaining != null) remaining = Math.max(0, remaining - amount);
        else {
          const re = spsCaveSilver(plan.src);
          remaining = re.stored;
        }
        spsProgress(`rafaga ${wave}/${plan.waves} enviada; cueva ${remaining == null ? '-' : remaining}`);
        renderSpySend();
        gbTimeout(step, plan.cfg.gapMs + Math.random() * 400);
      });
    };
    step();
  }
  function spsReadForm() {
    const sec = panel && panel.querySelector('section[data-tab=spy]');
    if (!sec) return spsCfg();
    spsCfgSave({
      targetId: sec.querySelector('[data-sp=target]')?.value?.trim() || '',
      sourceTownId: sec.querySelector('[data-sp=src]')?.value || '',
      mode: sec.querySelector('[data-sp=mode]')?.value === 'bulk' ? 'bulk' : 'rapid',
      chunk: gbCfgClamp(sec.querySelector('[data-sp=chunk]')?.value, 1, 1000000, SPS_DEFAULT_CHUNK),
      waves: gbCfgClamp(sec.querySelector('[data-sp=waves]')?.value, 0, SPS_MAX_WAVES, 5),
      untilEmpty: !!sec.querySelector('[data-sp=until]')?.checked,
      bulkAll: !!sec.querySelector('[data-sp=bulk-all]')?.checked,
      bulkAmount: gbCfgClamp(sec.querySelector('[data-sp=bulk-amount]')?.value, 0, 100000000, 0),
      gapMs: gbCfgClamp(sec.querySelector('[data-sp=gap]')?.value, 300, 60000, 1200),
    });
    return spsCfg();
  }
  function spsRenderHistory(sec) {
    const box = sec.querySelector('.sp-hist');
    if (!box) return;
    const h = spsHistory();
    box.replaceChildren();
    if (!h.length) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#888;font-size:10px;padding:4px 0';
      e.textContent = 'sin envios registrados';
      box.appendChild(e);
      return;
    }
    for (const r of h.slice(0, 12)) {
      const d = document.createElement('div');
      d.style.cssText = 'display:grid;grid-template-columns:.8fr .7fr .6fr .7fr 1fr;gap:4px;font-size:10px;border-bottom:1px solid #2a2a2a;padding:2px 0';
      const when = (() => { try { return new Date(r.ts).toLocaleTimeString(); } catch (_) { return '-'; } })();
      const vals = [when, '#' + r.target, r.mode === 'bulk' ? 'masivo' : 'rapido', `${r.waves}x`, `${r.silver} plata - ${r.why || ''}`];
      for (const v of vals) {
        const s = document.createElement('span');
        s.textContent = String(v);
        d.appendChild(s);
      }
      box.appendChild(d);
    }
  }
  function renderSpySend() {
    const sec = panel && panel.querySelector('section[data-tab=spy]');
    if (!sec || sec.hidden) return;
    const cfg = spsCfg();
    const srcSel = sec.querySelector('[data-sp=src]');
    if (srcSel) {
      const sig = (state.towns || []).map(t => t.id + ':' + (t.name || '')).join('|');
      if (srcSel.dataset.sig !== sig) {
        srcSel.dataset.sig = sig;
        srcSel.replaceChildren();
        for (const t of (state.towns || [])) {
          const o = document.createElement('option');
          o.value = String(t.id);
          o.textContent = `${(t.name || t.id)} #${t.id}`;
          srcSel.appendChild(o);
        }
      }
      const want = spsSourceTownId(cfg);
      if (srcSel.value !== want) srcSel.value = want;
    }
    const tgt = sec.querySelector('[data-sp=target]');
    if (tgt && document.activeElement !== tgt) tgt.value = cfg.targetId || '';
    const pick = sec.querySelector('[data-sp=pick]');
    if (pick && document.activeElement !== pick) {
      let targets = [];
      try { targets = (attackKnownTargets() || []).filter(t => !spsIsOwnTown(t.id)); } catch (_) { targets = []; }
      const sig = targets.map(t => t.id + ':' + (t.name || '')).join('|');
      if (pick.dataset.sig !== sig) {
        pick.dataset.sig = sig;
        pick.replaceChildren();
        const first = document.createElement('option');
        first.value = '';
        first.textContent = targets.length ? `objetivos conocidos (${targets.length})...` : 'sin objetivos conocidos';
        pick.appendChild(first);
        for (const t of targets) {
          const o = document.createElement('option');
          o.value = String(t.id);
          const coord = t.x != null && t.y != null ? ` ${t.x}|${t.y}` : '';
          o.textContent = `${(t.name || '?').slice(0, 16)} #${t.id}${coord}`;
          pick.appendChild(o);
        }
      }
      pick.value = targets.some(t => String(t.id) === String(cfg.targetId)) ? String(cfg.targetId) : '';
    }
    const modeSel = sec.querySelector('[data-sp=mode]');
    if (modeSel) modeSel.value = cfg.mode;
    const chunk = sec.querySelector('[data-sp=chunk]');
    if (chunk && document.activeElement !== chunk) chunk.value = cfg.chunk;
    const waves = sec.querySelector('[data-sp=waves]');
    if (waves && document.activeElement !== waves) waves.value = cfg.waves;
    const until = sec.querySelector('[data-sp=until]');
    if (until) until.checked = cfg.untilEmpty;
    const bulkAll = sec.querySelector('[data-sp=bulk-all]');
    if (bulkAll) bulkAll.checked = cfg.bulkAll;
    const bulkAmount = sec.querySelector('[data-sp=bulk-amount]');
    if (bulkAmount) {
      if (document.activeElement !== bulkAmount) bulkAmount.value = cfg.bulkAmount || '';
      bulkAmount.disabled = cfg.bulkAll;
      bulkAmount.style.opacity = cfg.bulkAll ? '0.4' : '1';
    }
    const gap = sec.querySelector('[data-sp=gap]');
    if (gap && document.activeElement !== gap) gap.value = cfg.gapMs;
    const rapidRow = sec.querySelector('.sp-rapid');
    if (rapidRow) rapidRow.hidden = cfg.mode !== 'rapid';
    const bulkRow = sec.querySelector('.sp-bulk');
    if (bulkRow) bulkRow.hidden = cfg.mode !== 'bulk';

    const caveEl = sec.querySelector('#gb-sp-cave');
    if (caveEl) {
      const src = spsSourceTownId(cfg);
      const cave = src ? spsCaveSilver(src) : { stored: null, hideLvl: null };

      caveEl.textContent = `cueva: ${cave.stored == null ? '\u2014' : cave.stored + ' plata'}${cave.hideLvl != null ? ` | nivel ${cave.hideLvl}` : ''}${cave.unlimited ? ' | ilimitada' : ''}`;
      caveEl.style.color = cave.stored == null ? '#f96' : '#6dda7e';
    }
    const preview = sec.querySelector('#gb-sp-plan');
    if (preview) {
      const p = spsPlan();
      preview.textContent = p.error ? p.error : (p.cfg.mode === 'bulk'
        ? `1 envio de ${p.amount} plata a #${p.target}`
        : `hasta ${p.waves} rafaga(s) de ${p.chunk} plata (~${p.total}) a #${p.target}`);
      preview.style.color = p.error ? '#f96' : '#ccc';
    }
    const runBtn = sec.querySelector('#gb-sp-run');
    if (runBtn) runBtn.disabled = gbLocked('spy');
    const stopBtn = sec.querySelector('#gb-sp-stop');
    if (stopBtn) stopBtn.disabled = !gbLocked('spy');
    spsRenderHistory(sec);
  }
  function bindSpyTab() {
    const sec = panel && panel.querySelector('section[data-tab=spy]');
    if (!sec || sec.dataset.bound) return;
    sec.dataset.bound = '1';
    const sync = () => { spsReadForm(); renderSpySend(); };

    sec.querySelectorAll('[data-sp]:not([data-sp=pick])').forEach(el => {
      el.addEventListener('change', sync);
    });
    sec.querySelector('[data-sp=pick]')?.addEventListener('change', e => {
      const id = e.target.value;
      if (!id) return;
      spsCfgSave({ targetId: String(id) });
      renderSpySend();
    });
    sec.querySelector('#gb-sp-run')?.addEventListener('click', () => { spsReadForm(); spsRun(); renderSpySend(); });
    sec.querySelector('#gb-sp-stop')?.addEventListener('click', () => spsStop());
    sec.querySelector('#gb-sp-clear')?.addEventListener('click', () => {
      state.spySendHistory = [];
      save(STORE.SPY_SEND_HISTORY, state.spySendHistory);
      renderSpySend();
    });
  }

  const SNAPSHOT_SLOTS = 6;
  const SNAPSHOT_INTERVAL_MS = 300000;
