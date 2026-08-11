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
          buildings: null,
          buildingsAt: 0,
          hero: null,
          heroAt: 0,
          last: 0,
        };
      }
      const d = byPlayer[key];
      d.reports++;
      if (f.units) d.units.push(f.units);
      if (raw && typeof raw === 'object' && (raw.town_id != null || raw.town_name)) d.towns.push({ id: raw.town_id, name: raw.town_name });
      else if (f.town && (f.town.id != null || f.town.name)) d.towns.push(f.town);
      if (f.wall != null) d.walls.push(f.wall);
      // Latest-wins by report timestamp, so a stale spy cannot overwrite a
      // fresher one just by arriving later in the ring buffer.
      if (f.buildings && Object.keys(f.buildings).length && (+f.ts || 0) >= (d.buildingsAt || 0)) {
        d.buildings = f.buildings; d.buildingsAt = +f.ts || 0;
      }
      if (f.hero && (+f.ts || 0) >= (d.heroAt || 0)) { d.hero = f.hero; d.heroAt = +f.ts || 0; }
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

  // ===== Enemy city timeline (v4 plan 2.2) ===================================
  // One retention policy shared by the read trio 2.2 / 2.3 / 2.4. Findings
  // themselves are bounded by the 500-row ring in spy.js; this is the read-time
  // soft cap, matching the journal's own 7d window.
  const INTEL_HISTORY_TTL_MS = 7 * 86400000;
  const INTEL_TIMELINE_PER_TOWN = 8;   // rows kept per town, oldest trimmed
  const INTEL_TIMELINE_MAX_TOWNS = 30; // matches the dossier .slice(0, 30)
  // 3d per the Grepolis vacation-cap norm: a player who takes time off is
  // usually gone 3-7 days, so anything quieter than that is the actionable
  // signal rather than ordinary silence.
  const GHOST_STALE_MS = 3 * 86400000;
  const GHOST_MAX_ROWS = 30;
  // 5d = typical Grepolis vacation cap floor, the point where a re-spy starts
  // paying off; 14d = likely abandoned, where re-spying is wasted.
  // DELIBERATE DEVIATION from plan 2.4 section 3: the inactivity scan uses its
  // OWN 14d window, not the shared 7d INTEL_HISTORY_TTL_MS. Inside a 7d window
  // ageMs can never reach 14d, so 'desaparecido' would be a branch that cannot
  // fire. 2.2 and 2.3 keep the 7d policy; only this axis needs the longer view,
  // because its whole point is measuring absence.
  const PLAYER_INACTIVE_MS = 5 * 86400000;
  const PLAYER_DISAPPEARED_MS = 14 * 86400000;
  const PLAYER_HISTORY_MS = PLAYER_DISAPPEARED_MS;
  const PLAYER_MAX_ROWS = 30;

  function intelTownKey(f) {
    if (!f) return null;
    if (f.town && f.town.id != null && f.town.id !== '') return 'town:' + f.town.id;
    if (f.vill_id != null && f.vill_id !== '') return 'farm:' + f.vill_id;
    return null;
  }
  function intelTownLabel(f, key) {
    if (f && f.town && f.town.name) {
      const c = (f.town.x != null && f.town.y != null) ? ` (${f.town.x}|${f.town.y})` : '';
      return f.town.name + c;
    }
    return key;
  }
  // Unknown is rendered '?', never 0. A finding that never carried a wall level
  // must not read as "the wall was torn down".
  function intelDiffNum(prev, cur, unit) {
    // `== null` on purpose: Number(null) is 0, so a `prev && prev.wall` that
    // collapsed to null would fabricate a 0 baseline and print "+18 muro
    // (0->18)" on the very first row of every town.
    if (cur == null) return '?';
    const b = Number(cur);
    if (!Number.isFinite(b)) return '?';
    const suffix = unit ? ' ' + unit : '';
    if (prev == null) return String(b) + suffix;
    const a = Number(prev);
    if (!Number.isFinite(a)) return String(b) + suffix;
    const d = b - a;
    if (d === 0) return 'sin cambio';
    return (d > 0 ? '+' : '') + d + suffix + ` (${a}→${b})`;
  }
  function intelDiffUnits(prev, cur) {
    if (!cur || !Object.keys(cur).length) return 'unidades:?';
    const keys = new Set(Object.keys(cur).concat(Object.keys(prev || {})));
    const parts = [];
    for (const k of Array.from(keys).sort()) {
      const a = +(prev || {})[k] || 0, b = +cur[k] || 0;
      if (!prev) { if (b) parts.push(`${k}:${b}`); continue; }
      if (a !== b) parts.push(`${k} ${a}→${b}`);
    }
    return parts.length ? parts.join(', ') : 'sin cambio';
  }
  // extractResources writes null for every unknown and Number(null) is 0, so a
  // defense report carrying no loot must be skipped, not printed as W0 S0 I0.
  // Labels follow the Spanish client (iron = plata).
  const INTEL_RES_ES = { wood: 'mad', stone: 'pie', iron: 'pla' };
  function intelDiffRes(prev, cur) {
    const c = cur || {}, p = prev || {};
    const parts = [];
    for (const k of GB_RES_KEYS) {
      if (c[k] == null) continue;
      const b = Number(c[k]);
      if (!Number.isFinite(b)) continue;
      const a = p[k] == null ? null : Number(p[k]);
      const d = (a != null && Number.isFinite(a)) ? b - a : null;
      parts.push(`${INTEL_RES_ES[k]}${b}` + (d ? (d > 0 ? '+' : '') + d : ''));
    }
    return parts.length ? parts.join(' ') : '?';
  }
  // Pure: no state read, no log.
  function intelDiffPair(prev, cur) {
    const p = prev || null;
    const boolLabel = v => (v == null ? null : (v ? 'ON' : 'OFF'));
    const pv = boolLabel(p && p.vacation), cv = boolLabel(cur && cur.vacation);
    const pName = p && p.town && p.town.name, cName = cur && cur.town && cur.town.name;
    const pAlly = p && p.alliance, cAlly = cur && cur.alliance;
    // buildings/hero come from plan 2.1. When a report predates it the fields
    // are absent and the column stays '—' rather than claiming a change.
    const pB = (p && p.buildings) || null, cB = (cur && cur.buildings) || null;
    let deep = '—';
    if (cB && Object.keys(cB).length) {
      const keys = Object.keys(cB).sort();
      // A key missing from the previous bag is UNKNOWN (parseBuildings drops
      // unreadable entries), so it renders "?→12", never "0→12".
      const changed = pB ? keys.filter(k => pB[k] == null || +cB[k] !== +pB[k]) : keys;
      deep = changed.length
        ? changed.slice(0, 3).map(k => `${k} ${pB ? (pB[k] == null ? '?' : +pB[k]) + '→' : ''}${cB[k]}`).join(', ') + (changed.length > 3 ? ' …' : '')
        : 'sin cambio';
    }
    if (cur && cur.hero) {
      const h = [cur.hero.name, cur.hero.level != null ? 'lv' + cur.hero.level : null].filter(Boolean).join(' ');
      deep = (deep === '—' ? '' : deep + ' | ') + 'heroe ' + (h || '?');
    }
    return {
      wall: intelDiffNum(p && p.wall, cur && cur.wall, 'muro'),
      units: intelDiffUnits(p && p.units, cur && cur.units),
      res: intelDiffRes(p && p.resources, cur && cur.resources),
      name: (cName && pName && cName !== pName) ? `nombre: ${pName} → ${cName}` : (cName || '?'),
      alliance: (cAlly && pAlly && cAlly !== pAlly) ? `alianza: ${pAlly} → ${cAlly}` : (cAlly || '?'),
      vacation: (cv == null) ? '?' : (pv != null && pv !== cv ? `vacaciones ${cv}` : cv),
      deep,
    };
  }
  function intelCityTimeline() {
    const now = Date.now();
    const all = state.findings || [];
    const fresh = all.filter(f => f && +f.ts >= now - INTEL_HISTORY_TTL_MS);
    if (all.length && !fresh.length) {
      gbLogT('intel-timeline-empty', 300000, 'intel: city timeline empty after 7d filter');
    }
    const byTown = new Map();
    for (const f of fresh) {
      const key = intelTownKey(f);
      if (!key) continue;
      if (!byTown.has(key)) byTown.set(key, []);
      byTown.get(key).push(f);
    }
    const out = [];
    for (const [key, list] of byTown) {
      if (list.length < 2) continue; // a single report is not a timeline
      list.sort((a, b) => (+a.ts || 0) - (+b.ts || 0));
      const kept = list.slice(-INTEL_TIMELINE_PER_TOWN);
      const rows = kept.map((cur, i) => ({
        ts: +cur.ts || 0,
        prev: i ? kept[i - 1] : null,
        cur,
        diff: intelDiffPair(i ? kept[i - 1] : null, cur),
      }));
      out.push({
        townKey: key,
        label: intelTownLabel(kept[kept.length - 1], key),
        reports: list.length,
        lastTs: +kept[kept.length - 1].ts || 0,
        rows,
      });
    }
    return out.sort((a, b) => b.lastTs - a.lastTs).slice(0, INTEL_TIMELINE_MAX_TOWNS);
  }
  function renderIntelTimeline() {
    const list = panel && panel.querySelector('.intel-timeline');
    if (!list) return;
    const sec = list.closest('section[data-tab]');
    if (sec && sec.hidden) return;
    const groups = intelCityTimeline();
    if (!groups.length) {
      placeholder(list, 'sin historial de ciudad (recibe 2+ informes sobre la misma)');
      return;
    }
    const table = tableShell(list, ['Ciudad', 'Fecha', 'Muro', 'Unidades', 'Recursos', 'Nombre', 'Alianza', 'Vac.', 'Edificios / heroe'], 'intel-timeline');
    const tbody = table.querySelector('tbody');
    const wanted = [];
    // Index-suffixed: two reports on the same town can share a timestamp, and a
    // duplicate data-key made the set comparison never match (full rebuild + a
    // lost sort on every 15s render).
    for (const g of groups) g.rows.forEach((r, i) => wanted.push(g.townKey + '@' + r.ts + '#' + i));
    const have = new Set(Array.from(tbody.children).map(tr => tr.dataset.key));
    const sameSet = have.size === wanted.length && wanted.every(k => have.has(k));
    if (!sameSet) tbody.replaceChildren();
    for (const g of groups) {
      g.rows.forEach((r, i) => {
        const key = g.townKey + '@' + r.ts + '#' + i;
        const d = r.diff;
        const cells = [
          { cls: 'id', text: g.label },
          { cls: '', text: r.ts ? new Date(r.ts).toLocaleString() : '?' },
          { cls: '', text: d.wall },
          { cls: '', text: d.units },
          { cls: '', text: d.res },
          { cls: '', text: d.name },
          { cls: '', text: d.alliance },
          { cls: '', text: d.vacation },
          { cls: '', text: d.deep },
        ];
        let tr = sameSet ? tbody.querySelector(`tr[data-key="${key}"]`) : null;
        if (!tr) {
          tr = document.createElement('tr');
          tr.dataset.key = key;
          cells.forEach(() => tr.appendChild(document.createElement('td')));
          tbody.appendChild(tr);
        }
        patchCells(tr, cells);
        // Unknown wall sorts as '' (string compare), not 0 - ranking an
        // unspied town as the weakest one is exactly the wrong answer.
        const wallRaw = (r.cur && r.cur.wall != null && Number.isFinite(+r.cur.wall)) ? String(+r.cur.wall) : '';
        tr.dataset.sort = [g.label, String(r.ts), wallRaw, d.units, d.res, d.name, d.alliance, d.vacation, d.deep].join('\t');
      });
    }
    sortApplySaved(table);
  }

  // ===== Ghost town detector (v4 plan 2.3) ===================================
  // Own ladder, not fmtSec: fmtSec tops out at minutes, so a 4-day-quiet town
  // would read "5760m".
  function ghostAgeLabel(ageMs) {
    const s = Math.max(0, Math.round((+ageMs || 0) / 1000));
    if (s >= 86400) return Math.floor(s / 86400) + 'd';
    if (s >= 3600) return Math.floor(s / 3600) + 'h';
    return Math.floor(s / 60) + 'm';
  }
  function ghostReasonText(r) { return (r && r.reasons || []).join(', '); }
  function intelGhostTowns() {
    const now = Date.now();
    const fresh = (state.findings || []).filter(f => f && +f.ts >= now - INTEL_HISTORY_TTL_MS);
    const latest = new Map();
    for (const f of fresh) {
      const key = intelTownKey(f);
      if (!key) continue;
      const cur = latest.get(key);
      if (!cur || (+f.ts || 0) > (+cur.ts || 0)) latest.set(key, f);
    }
    const out = [];
    for (const [key, last] of latest) {
      const ageMs = now - (+last.ts || 0);
      const vacation = (last.defender && last.defender.vacation === true) || last.vacation === true;
      // Defenderless is only claimed when a defender block exists but carries no
      // name. A finding with no defender at all is an unknown, not an abandon.
      const abandoned = !!(last.defender && !last.defender.name);
      const reasons = [];
      if (ageMs >= GHOST_STALE_MS) reasons.push('sin actividad 3d');
      if (vacation) reasons.push('defensor en vacaciones');
      if (abandoned) reasons.push('sin nombre de defensor');
      if (!reasons.length) continue;
      out.push({
        townKey: key,
        label: intelTownLabel(last, key),
        lastTs: +last.ts || 0,
        ageMs,
        vacation,
        abandoned,
        wall: (last.wall != null && Number.isFinite(+last.wall)) ? +last.wall : null,
        alliance: last.alliance || null,
        reasons,
      });
    }
    if (!out.length && (state.findings || []).length) {
      gbLogT('intel-ghost-empty', 300000, 'intel: ghost towns empty after 7d filter');
    }
    return out.sort((a, b) => b.ageMs - a.ageMs).slice(0, GHOST_MAX_ROWS);
  }
  function renderIntelGhost() {
    const list = panel && panel.querySelector('.intel-ghost');
    if (!list) return;
    const sec = list.closest('section[data-tab]');
    if (sec && sec.hidden) return;
    const rows = intelGhostTowns();
    if (!rows.length) { placeholder(list, 'sin pueblos fantasma (7d)'); return; }
    const table = tableShell(list, ['Ciudad', 'Última', 'Edad', 'Muro', 'Alianza', 'Razón'], 'intel-ghost');
    const tbody = table.querySelector('tbody');
    const wanted = rows.map(r => r.townKey);
    const have = new Set(Array.from(tbody.children).map(tr => tr.dataset.key));
    const sameSet = have.size === wanted.length && wanted.every(k => have.has(k));
    if (!sameSet) tbody.replaceChildren();
    for (const r of rows) {
      const cells = [
        { cls: 'id', text: r.label },
        { cls: '', text: r.lastTs ? new Date(r.lastTs).toLocaleString() : '?' },
        { cls: '', text: ghostAgeLabel(r.ageMs) },
        { cls: '', text: r.wall == null ? '?' : String(r.wall) },
        { cls: '', text: r.alliance || '?' },
        { cls: '', text: ghostReasonText(r) },
      ];
      let tr = sameSet ? tbody.querySelector(`tr[data-key="${r.townKey}"]`) : null;
      if (!tr) {
        tr = document.createElement('tr');
        tr.dataset.key = r.townKey;
        cells.forEach(() => tr.appendChild(document.createElement('td')));
        tbody.appendChild(tr);
      }
      patchCells(tr, cells);
      // Age sorts on the raw ms, not the humanised label ("2d" vs "20h").
      // Unknown wall sorts as '' so it is not ranked as level 0.
      tr.dataset.sort = [r.label, String(r.lastTs), String(r.ageMs), r.wall == null ? '' : String(r.wall), r.alliance || '', ghostReasonText(r)].join('\t');
    }
    sortApplySaved(table);
  }

  // ===== Player inactivity tracker (v4 plan 2.4) =============================
  const inactiveAgeLabel = ghostAgeLabel;
  function inactiveStatusLabel(row) {
    if (!row) return '';
    if (row.disappeared) return 'desaparecido';
    if (row.inactive) return 'inactivo';
    return '';
  }
  function intelPlayerInactivity() {
    const now = Date.now();
    const me = intelMyIdentity();
    const fresh = (state.findings || []).filter(f => f && +f.ts >= now - PLAYER_HISTORY_MS);
    const maps = { attackers: new Map(), defenders: new Map() };
    const bump = (which, actor) => {
      // A blind identity makes intelActorIsMe false for everything, so the rule
      // degrades to "show everything" rather than silently dropping rows.
      if (!actor || intelActorIsMe(actor, me)) return;
      const key = intelPlayerKey(actor);
      if (!key || key === 'unknown') return;
      const m = maps[which];
      const cur = m.get(key) || { key, player: intelPlayerLabel(actor, key), lastTs: 0, n: 0 };
      cur.n++;
      return { m, key, cur };
    };
    for (const f of fresh) {
      for (const [which, actor] of [['attackers', f.attacker], ['defenders', f.defender]]) {
        const hit = bump(which, actor);
        if (!hit) continue;
        if ((+f.ts || 0) > hit.cur.lastTs) {
          hit.cur.lastTs = +f.ts || 0;
          const noteKey = (actor && typeof actor === 'object' && actor.name) ? actor.name : hit.cur.player;
          // Guard, do not assign: a newer finding whose name misses the note map
          // must not erase a note an earlier finding already resolved.
          if (state.playerNotes && state.playerNotes[noteKey]) hit.cur.note = state.playerNotes[noteKey];
        }
        hit.m.set(hit.key, hit.cur);
      }
    }
    const finish = (m) => Array.from(m.values())
      .map(r => {
        const ageMs = now - r.lastTs;
        return Object.assign({}, r, {
          ageMs,
          inactive: ageMs >= PLAYER_INACTIVE_MS,
          disappeared: ageMs >= PLAYER_DISAPPEARED_MS,
        });
      })
      .filter(r => r.inactive)
      .sort((a, b) => a.lastTs - b.lastTs)
      .slice(0, PLAYER_MAX_ROWS);
    const out = { attackers: finish(maps.attackers), defenders: finish(maps.defenders) };
    if (!out.attackers.length && !out.defenders.length && (state.findings || []).length) {
      gbLogT('intel-inactive-empty', 300000, 'intel: player inactivity empty after 14d filter');
    }
    return out;
  }
  function renderIntelInactiveTable(cls, rows, sortKey, emptyText) {
    const list = panel && panel.querySelector(cls);
    if (!list) return;
    if (!rows.length) { placeholder(list, emptyText); return; }
    const table = tableShell(list, ['Jugador', 'Última', 'Edad', 'Informes', 'Estado', 'Nota'], sortKey);
    const tbody = table.querySelector('tbody');
    const wanted = rows.map(r => r.key);
    const have = new Set(Array.from(tbody.children).map(tr => tr.dataset.key));
    const sameSet = have.size === wanted.length && wanted.every(k => have.has(k));
    if (!sameSet) tbody.replaceChildren();
    for (const r of rows) {
      const status = inactiveStatusLabel(r);
      const cells = [
        { cls: 'id', text: r.player },
        { cls: '', text: r.lastTs ? new Date(r.lastTs).toLocaleString() : '?' },
        { cls: '', text: inactiveAgeLabel(r.ageMs) },
        { cls: '', text: String(r.n) },
        { cls: '', text: status },
        { cls: '', text: r.note || '' },
      ];
      let tr = sameSet ? tbody.querySelector(`tr[data-key="${CSS.escape(r.key)}"]`) : null;
      if (!tr) {
        tr = document.createElement('tr');
        tr.dataset.key = r.key;
        cells.forEach(() => tr.appendChild(document.createElement('td')));
        tbody.appendChild(tr);
      }
      patchCells(tr, cells);
      // Age sorts on raw ms, not the humanised label ("2d" vs "20h").
      tr.dataset.sort = [r.player, String(r.lastTs), String(r.ageMs), String(r.n), status, r.note || ''].join('\t');
    }
    sortApplySaved(table);
  }
  function renderIntelInactive() {
    const box = panel && panel.querySelector('.intel-inactive');
    if (!box) return;
    const sec = box.closest('section[data-tab]');
    if (sec && sec.hidden) return;
    const data = intelPlayerInactivity();
    renderIntelInactiveTable('.intel-inactive-atk', data.attackers, 'intel-inactive-atk', 'sin atacantes inactivos (5d)');
    renderIntelInactiveTable('.intel-inactive-def', data.defenders, 'intel-inactive-def', 'sin defensores inactivos (5d)');
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
    try { renderIntelTimeline(); } catch (_) {}
    try { renderIntelGhost(); } catch (_) {}
    try { renderIntelInactive(); } catch (_) {}
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
