  const HUD_ETA_CAP_H = 24;
  let hudProdWidget = null;
  let hudEtaWidget = null;
  function hudCurrentTownId() {
    try { const id = gameUw().Game && gameUw().Game.townId; if (id != null) return String(id); } catch (_) {}
    const t = (state.towns || [])[0];
    return t ? String(t.id) : null;
  }
  function hudTownOrder() {
    let ids = [];
    try { ids = Object.keys((gameUw().ITowns && gameUw().ITowns.towns) || {}).map(String); } catch (_) {}
    if (!ids.length) ids = (state.towns || []).map(t => String(t.id));
    const cur = hudCurrentTownId();

    return cur && ids.includes(cur) ? [cur].concat(ids.filter(x => x !== cur)) : ids;
  }
  function hudEtaText(sec) {
    if (sec == null || !Number.isFinite(sec)) return '\u2014';
    if (sec <= 0) return 'lleno';
    if (sec >= HUD_ETA_CAP_H * 3600) return HUD_ETA_CAP_H + 'h+';
    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
  }
  function hudCell(text, color) {
    const s = document.createElement('span');
    s.textContent = text;
    if (color) s.style.color = color;
    return s;
  }
  function hudRenderProduction(body) {
    body.replaceChildren();
    const ids = hudTownOrder();
    if (!ids.length) { body.appendChild(hudCell('sin ciudades legibles', 'var(--gb-fg-mute)')); return; }
    const head = document.createElement('div');
    head.style.cssText = 'display:grid;grid-template-columns:1.2fr repeat(3,1fr) .8fr;gap:4px;font-size:9px;color:var(--gb-fg-mute);border-bottom:1px solid var(--gb-border-soft);padding-bottom:2px';
    ['ciudad', 'madera', 'piedra', 'plata', 'lleno en'].forEach(t => head.appendChild(hudCell(t)));
    body.appendChild(head);
    for (const id of ids.slice(0, 12)) {
      const rs = (typeof townResState === 'function') ? townResState(id) : null;
      const rate = (typeof economyProductionRate === 'function') ? economyProductionRate(id) : null;
      const row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:1.2fr repeat(3,1fr) .8fr;gap:4px;padding:1px 0;border-bottom:1px solid var(--gb-rule)';
      row.appendChild(hudCell(townNameById(id)));
      let soonest = null;
      for (const k of GB_RES_KEYS) {
        if (!rs || !(rs.cap > 0)) { row.appendChild(hudCell('\u2014', 'var(--gb-fg-mute)')); continue; }
        const cur = +rs[k] || 0;
        const perH = rate ? +rate[k] : null;
        const pct = Math.round(cur / rs.cap * 100);
        row.appendChild(hudCell(`${fmt(cur)} ${perH == null ? '\u2014' : '+' + Math.round(perH) + '/h'}`,
          pct >= 97 ? 'var(--gb-err-3)' : (pct >= 85 ? 'var(--gb-warn-2)' : null)));
        if (perH != null && perH > 0) {
          const sec = Math.max(0, (rs.cap - cur) / perH * 3600);
          if (soonest == null || sec < soonest) soonest = sec;
        }
      }
      row.appendChild(hudCell(hudEtaText(soonest), soonest != null && soonest < 3600 ? 'var(--gb-warn-2)' : null));
      body.appendChild(row);
    }
  }
  function hudRenderCountdown(body) {
    body.replaceChildren();
    let incoming = [];
    try { incoming = dodgeIncomingMovements() || []; } catch (_) {
      body.appendChild(hudCell('movimientos no legibles', 'var(--gb-fg-mute)'));
      return;
    }
    if (!incoming.length) { body.appendChild(hudCell('sin ataques entrantes', 'var(--gb-fg-mute)')); return; }
    const rows = incoming
      .map(m => ({ m, eta: dodgeEtaSec(m) }))

      .sort((a, b) => (a.eta == null ? Infinity : a.eta) - (b.eta == null ? Infinity : b.eta));
    for (const { m, eta } of rows.slice(0, 12)) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;align-items:center;padding:1px 0;border-bottom:1px solid var(--gb-rule);white-space:nowrap';
      const etaCell = hudCell(eta == null ? '\u2014' : queueCenterFmt(eta));
      etaCell.style.fontWeight = 'bold';
      etaCell.style.color = eta == null ? 'var(--gb-fg-mute)'
        : (eta < 300 ? 'var(--gb-err-3)' : (eta < 900 ? 'var(--gb-warn-2)' : 'var(--gb-fg-2)'));
      row.appendChild(etaCell);
      row.appendChild(hudCell(String(m.type || 'atk')));
      row.appendChild(hudCell('\u2192 ' + townNameById(m.dest)));
      row.appendChild(hudCell('de ' + (m.origin || '?'), 'var(--gb-fg-mute)'));

      if (m.hasCs) row.appendChild(hudCell('[CS]', 'var(--gb-err-3)'));
      let n = 0;
      try { n = Object.values(m.units || {}).reduce((a, b) => a + (+b || 0), 0); } catch (_) {}
      if (n > 0) row.appendChild(hudCell(n + ' u.', 'var(--gb-fg-mute)'));
      body.appendChild(row);
    }
  }
  function hudEnsure() {
    if (!hudProdWidget) {
      hudProdWidget = gbWidgetRegister({
        id: 'production', title: 'Producci\u00f3n',
        defaultPos: { left: '8px', top: '60px' },
        tickMs: 5000, render: hudRenderProduction,
      });
    }
    if (!hudEtaWidget) {
      hudEtaWidget = gbWidgetRegister({
        id: 'countdown', title: 'Ataques entrantes',
        defaultPos: { left: '8px', top: '260px' },
        tickMs: HUD_TICK_MS, render: hudRenderCountdown,
      });
    }
  }
  function hudToggle(which) {
    hudEnsure();
    const w = which === 'countdown' ? hudEtaWidget : hudProdWidget;
    if (!w) return false;
    const open = !w.isOpen();
    if (open) w.open(); else w.close();
    const key = which === 'countdown' ? 'hudCountdown' : 'hudProduction';
    state[key] = open;
    save(which === 'countdown' ? STORE.HUD_COUNTDOWN : STORE.HUD_PRODUCTION, open);
    return open;
  }
  function hudRestore() {
    hudEnsure();
    if (state.hudProduction && hudProdWidget) hudProdWidget.open();
    if (state.hudCountdown && hudEtaWidget) hudEtaWidget.open();
  }

  let gbQueueCenter = null;
  let gbQueueCenterTab = 'build';
  let gbQueueCenterTown = null;

