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
  function intelMyIdentity() {
    try {
      const uw = gameUw();
      const p = uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('Player');
      const a = (p && p.attributes) || {};
      return {
        id: a.id ?? a.player_id ?? (uw.Game && (uw.Game.player_id ?? uw.Game.playerId)) ?? null,
        name: a.name || a.player_name || (uw.Game && (uw.Game.player_name || uw.Game.playerName)) || null,
      };
    } catch (_) { return { id: null, name: null }; }
  }
  function intelActorIsMe(actor, me) {
    if (!actor || !me) return false;
    if (actor.id != null && me.id != null && String(actor.id) === String(me.id)) return true;
    if (actor.name && me.name && String(actor.name).toLowerCase() === String(me.name).toLowerCase()) return true;
    return false;
  }
  function intelDossiers() {
    const byPlayer = {};
    const me = intelMyIdentity();
    for (const f of (state.findings || [])) {
      let raw = f.player || null;
      if (!raw) {
        const a = f.attacker || null, d = f.defender || null;
        if (intelActorIsMe(a, me)) raw = d;
        else if (intelActorIsMe(d, me)) raw = a;
        else raw = a || d;
      }
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
      if (raw && typeof raw === 'object' && (raw.town_id != null || raw.town_name)) d.towns.push({ id: raw.town_id, name: raw.town_name });
      else if (f.town && (f.town.id != null || f.town.name)) d.towns.push(f.town);
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
    html += '=== Entrantes ===\n';
    if (!threats.length) html += '(none)\n';
    else {
      threats.forEach(t => {
        const da = defenseAssessment(t, threats);
        html += `${t.hasCs ? '[CS] ' : ''}${t.type || 'atk'} → ${t.dest} from ${t.origin || '?'}` +
          (t.arrival ? ` @${t.arrival}` : '') + ` | riesgo ${da.risk} | ETA ${da.eta==null?'?':fmtSec(da.eta)} | apoyo ${da.supports.length} | esquivar ${da.evac.ok?'si':'no'}` + '\n';
      });
    }
    html += '\n=== Fichas ===\n';
    dossiers.forEach(d => {
      html += `${d.player}: ${d.reports} informes` +
        (d.note ? ` — ${d.note}` : '') +
        (d.allianceNote ? ` [aliado: ${d.allianceNote}]` : '') + '\n';
    });
    if (state.watchlist && state.watchlist.length) {
      html += '\n=== Lista de vigilancia ===\n' + state.watchlist.map(w =>
        typeof w === 'object' ? `${w.id || w.townId} ${w.name || ''}` : String(w)
      ).join('\n') + '\n';
    }
    if (state.allianceNotes && Object.keys(state.allianceNotes).length) {
      html += '\n=== Notas de alianza ===\n';
      Object.keys(state.allianceNotes).forEach(k => {
        html += `${k}: ${state.allianceNotes[k]}\n`;
      });
    }
    if (state.attackPatternNote) {
      html += '\n=== Patrones de ataque ===\n' + state.attackPatternNote + '\n';
    }
    box.textContent = html;
    try { intelPatternScan(); } catch (_) {}
  }
  function intelSetNote(player, note) {
    if (!state.playerNotes) state.playerNotes = {};
    if (!note) delete state.playerNotes[player];
    else state.playerNotes[player] = String(note).slice(0, 200);
    save(STORE.PLAYER_NOTES, state.playerNotes);
  }
  // state.allianceNotes was read in three places (dossiers, the Intel dump and
  // the export redactor) but nothing could ever write it - there was no setter
  // at all, so the feature was unreachable.
  function intelSetAllianceNote(alliance, note) {
    const key = String(alliance || '').trim();
    if (!key) return false;
    if (!state.allianceNotes || typeof state.allianceNotes !== 'object') state.allianceNotes = {};
    if (!note) delete state.allianceNotes[key];
    else state.allianceNotes[key] = String(note).slice(0, 200);
    save(STORE.ALLIANCE_NOTES, state.allianceNotes);
    return true;
  }
  function intelGrepodataAssist() {
    if (!state.grepodataIndex || state.dryRun) return;
    try {
      const btn = document.querySelector('.grepodata_index, a.index_report, [data-action="index"], .btn_index');
      if (btn && !btn.dataset.grepbotIndexed) {
        if (gbDomClick(btn, 'grepodata')) {
          btn.dataset.grepbotIndexed = '1';
          gbLogT('grepodata', 10000, 'intel: Grepodata Index+ clicked');
        }
      }
    } catch (_) {}
  }
  function watchMatch(finding) {
    if (!finding || !state.watchlist || !state.watchlist.length) return null;
    const hits = [];
    for (const w of state.watchlist) {
      const entry = typeof w === 'object' ? w : { id: w };
      const rule = String(entry.id || entry.townId || entry.name || entry.player || entry.alliance || entry.coords || w);
      const tid = finding.town && finding.town.id;
      const vid = finding.vill_id != null ? finding.vill_id : (finding.vill && finding.vill.id);
      if (entry.id != null || entry.townId != null) {
        const id = String(entry.id || entry.townId);
        if (String(tid) === id || String(vid) === id || String(finding.town_id) === id) {
          hits.push({ kind: 'town', rule, specificity: 4 });
        }
      }
      if (entry.coords || (entry.x != null && entry.y != null)) {
        const c = entry.coords || (entry.x + ' ' + entry.y);
        const fx = finding.town && finding.town.x;
        const fy = finding.town && finding.town.y;
        if (fx != null && fy != null && String(c).indexOf(String(fx)) >= 0 && String(c).indexOf(String(fy)) >= 0) {
          hits.push({ kind: 'coords', rule: String(c), specificity: 3 });
        }
      }
      const pname = finding.attacker && (finding.attacker.name || finding.attacker.player_name);
      if ((entry.player || entry.name) && pname && String(pname).toLowerCase() === String(entry.player || entry.name).toLowerCase()) {
        hits.push({ kind: 'player', rule: String(entry.player || entry.name), specificity: 2 });
      }
      if (entry.alliance && finding.alliance && String(finding.alliance).toLowerCase() === String(entry.alliance).toLowerCase()) {
        hits.push({ kind: 'alliance', rule: String(entry.alliance), specificity: 1 });
      }
      // bare id string fallback (legacy)
      if (typeof w !== 'object') {
        const id = String(w);
        if (String(tid) === id || String(vid) === id || String(finding.town_id) === id) {
          hits.push({ kind: 'town', rule: id, specificity: 4 });
        }
      }
    }
    if (!hits.length) return null;
    hits.sort((a, b) => b.specificity - a.specificity);
    return { hit: true, kind: hits[0].kind, rule: hits[0].rule, extra: hits.length - 1 };
  }
  function intelWatchlistScan() {
    if (!state.watchlist || !state.watchlist.length) return;
    for (const f of (state.findings || []).slice(0, 80)) {
      const m = watchMatch(f);
      if (!m) continue;
      const id = String((f.town && f.town.id) || f.vill_id || f.town_id || m.rule);
      let onVac = null;
      try {
        if (f.vacation === true || f.on_vacation === true) onVac = true;
        else if (f.attacker && (f.attacker.vacation === true || f.attacker.on_vacation === true)) onVac = true;
      } catch (_) {}
      if (onVac === true) continue;
      if (!state.watchHits) state.watchHits = {};
      state.watchHits[m.rule] = Date.now();
      save(STORE.WATCH_HITS, state.watchHits);
      gbLog(`watchlist: ${id} matched (${m.kind}: ${m.rule}${m.extra ? ' +' + m.extra + ' more' : ''})`);
      try { alertWebhook('attack', { watchlist: id, why: m, finding: { type: f.type, ts: f.ts } }); } catch (_) {}
      break; // one webhook per scan pass
    }
  }
  function intelPatternScan() {
    const now = Date.now();
    const windowMs = 24 * 3600000;
    const cut = now - windowMs;
    const by = {};
    (state.findings || []).forEach(f => {
      if (!f || !(f.ts >= cut)) return;
      const key = intelPlayerKey(f.attacker || f.player) || null;
      if (!key || key === 'unknown') return;
      if (!by[key]) by[key] = { key, name: intelPlayerLabel(f.attacker || f.player, key), n: 0, towns: [], first: f.ts, last: f.ts };
      const b = by[key];
      b.n++;
      b.last = Math.max(b.last, f.ts);
      b.first = Math.min(b.first, f.ts);
      const tid = f.town && (f.town.id || f.town.name);
      if (tid != null && b.towns.indexOf(String(tid)) < 0) b.towns.push(String(tid));
    });
    const hits = Object.values(by).filter(b => b.n >= 3);
    state.attackPatternNote = hits.length
      ? hits.map(h => `${h.name}×${h.n}/24h`).join(', ')
      : '';
    hits.forEach(h => {
      const bucket = Math.floor(now / windowMs);
      const ak = 'pattern:' + h.key + ':' + bucket;
      if (state.alerted && state.alerted[ak]) return;
      if (!state.alerted) state.alerted = {};
      state.alerted[ak] = now;
      save(STORE.ALERTED, state.alerted);
      const payload = {
        attacker: state.exportRedact !== false ? String(h.name).slice(0, 2) + '***' : h.name,
        hits: h.n,
        window: '24h',
        towns: (h.towns || []).slice(0, 8).map(t => state.exportRedact !== false ? String(t).slice(0, 2) + '***' : t),
        first: h.first, last: h.last,
      };
      gbLog(`pattern: ${h.name} hit ${h.n}× in 24h`);
      try { alertWebhook('pattern', payload); } catch (_) {}
    });
    return hits;
  }

  const QUEST_SCAN_MS = 12000;
  const QUEST_HISTORY_MAX = 100;
  let questMo = null;
  let questMoContainer = null;
