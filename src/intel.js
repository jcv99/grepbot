  // ---------- intel moat (Phase 13): dossiers, threat board, grepodata, watchlist ----------
  function intelPlayerKey(p) {
    if (p == null) return null;
    if (typeof p === 'string') return p.trim() || null;
    if (typeof p === 'object') {
      if (p.id != null) return 'id:' + p.id;
      if (p.name) return String(p.name);
      if (p.player_name) return String(p.player_name);
    }
    return null;
  }
  function intelPlayerLabel(p, key) {
    if (p && typeof p === 'object' && (p.name || p.player_name)) return p.name || p.player_name;
    if (typeof p === 'string') return p;
    if (key && key.indexOf('id:') === 0) return key.slice(3);
    return key || 'unknown';
  }
  function intelDossiers() {
    const byPlayer = {};
    for (const f of (state.findings || [])) {
      const raw = f.attacker || f.defender || f.player || null;
      const key = intelPlayerKey(raw) || 'unknown';
      if (!byPlayer[key]) {
        byPlayer[key] = {
          player: intelPlayerLabel(raw, key),
          key,
          reports: 0,
          units: [],
          towns: [],
          walls: [],
          last: 0,
        };
      }
      const d = byPlayer[key];
      d.reports++;
      if (f.units) d.units.push(f.units);
      if (f.town && (f.town.id != null || f.town.name)) d.towns.push(f.town);
      if (f.wall != null) d.walls.push(f.wall);
      if (f.ts && f.ts > d.last) d.last = f.ts;
      const noteKey = (raw && typeof raw === 'object' && raw.name) ? raw.name : d.player;
      if (state.playerNotes && state.playerNotes[noteKey]) d.note = state.playerNotes[noteKey];
      if (state.allianceNotes && f.alliance && state.allianceNotes[f.alliance]) {
        d.allianceNote = state.allianceNotes[f.alliance];
      }
    }
    return Object.values(byPlayer).sort((a, b) => b.last - a.last);
  }
  function intelThreatBoard() {
    return (typeof dodgeIncomingMovements === 'function') ? dodgeIncomingMovements() : [];
  }
  function renderIntel() {
    const box = panel && panel.querySelector('.intel-panel');
    if (!box) return;
    const sec = box.closest('section[data-tab]');
    if (sec && sec.hidden) return;
    const threats = intelThreatBoard();
    const dossiers = intelDossiers().slice(0, 30);
    let html = '';
    html += '=== Incoming ===\n';
    if (!threats.length) html += '(none)\n';
    else {
      threats.forEach(t => {
        html += `${t.hasCs ? '[CS] ' : ''}${t.type || 'atk'} → ${t.dest} from ${t.origin || '?'}` +
          (t.arrival ? ` @${t.arrival}` : '') + '\n';
      });
    }
    html += '\n=== Dossiers ===\n';
    dossiers.forEach(d => {
      html += `${d.player}: ${d.reports} reports` +
        (d.note ? ` — ${d.note}` : '') +
        (d.allianceNote ? ` [ally: ${d.allianceNote}]` : '') + '\n';
    });
    if (state.watchlist && state.watchlist.length) {
      html += '\n=== Watchlist ===\n' + state.watchlist.map(w =>
        typeof w === 'object' ? `${w.id || w.townId} ${w.name || ''}` : String(w)
      ).join('\n') + '\n';
    }
    if (state.allianceNotes && Object.keys(state.allianceNotes).length) {
      html += '\n=== Alliance notes ===\n';
      Object.keys(state.allianceNotes).forEach(k => {
        html += `${k}: ${state.allianceNotes[k]}\n`;
      });
    }
    box.textContent = html;
  }
  function intelSetNote(player, note) {
    if (!state.playerNotes) state.playerNotes = {};
    if (!note) delete state.playerNotes[player];
    else state.playerNotes[player] = String(note).slice(0, 200);
    save(STORE.PLAYER_NOTES, state.playerNotes);
  }
  function intelSetAllianceNote(alliance, note) {
    if (!state.allianceNotes) state.allianceNotes = {};
    if (!note) delete state.allianceNotes[alliance];
    else state.allianceNotes[alliance] = String(note).slice(0, 200);
    save(STORE.ALLIANCE_NOTES, state.allianceNotes);
  }
  function intelGrepodataAssist() {
    if (!state.grepodataIndex) return;
    try {
      const btn = document.querySelector('.grepodata_index, a.index_report, [data-action="index"], .btn_index');
      if (btn && !btn.dataset.grepbotIndexed) {
        btn.dataset.grepbotIndexed = '1';
        btn.click();
        gbLogT('grepodata', 10000, 'intel: Grepodata Index+ clicked');
      }
    } catch (_) {}
  }
  function intelWatchlistScan() {
    if (!state.watchlist || !state.watchlist.length) return;
    // Notify when a watched town appears in findings (town.id / vill_id)
    for (const w of state.watchlist) {
      const id = String(w.id || w.townId || w);
      const hit = (state.findings || []).find(f => {
        const tid = f.town && f.town.id;
        const vid = f.vill_id != null ? f.vill_id : (f.vill && f.vill.id);
        return String(tid) === id || String(vid) === id || String(f.town_id) === id;
      });
      if (!hit) continue;
      // Vacation: findings never carry it; only suppress when we know vacation=true elsewhere
      let onVac = null;
      try {
        if (hit.vacation === true || hit.on_vacation === true) onVac = true;
        else if (hit.attacker && (hit.attacker.vacation === true || hit.attacker.on_vacation === true)) onVac = true;
        else if (hit.defender && (hit.defender.vacation === true || hit.defender.on_vacation === true)) onVac = true;
      } catch (_) {}
      if (onVac === true) continue;
      gbLog(`watchlist: ${id} seen in findings`);
      try { alertWebhook('attack', { watchlist: id, finding: hit }); } catch (_) {}
    }
  }
