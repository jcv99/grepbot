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

      if (f.buildings && Object.keys(f.buildings).length && (+f.ts || 0) >= (d.buildingsAt || 0)) {
        d.buildings = f.buildings; d.buildingsAt = +f.ts || 0;
      }
      if (f.hero && (+f.ts || 0) >= (d.heroAt || 0)) { d.hero = f.hero; d.heroAt = +f.ts || 0; }
      if (f.ts && f.ts > d.last) d.last = f.ts;
      const noteKey = (raw && typeof raw === 'object' && raw.name) ? raw.name : d.player;
      if (state.playerNotes && state.playerNotes[noteKey]) d.note = state.playerNotes[noteKey];
      { const st = intelStatusFor(raw, f.alliance); if (st.status) { d.status = st.status; d.statusSource = st.source; } }
      if (state.allianceNotes && f.alliance && state.allianceNotes[f.alliance]) {
        d.allianceNote = state.allianceNotes[f.alliance];
      }
    }

    try {
      const loss = intelLossRatio(state.findings || []);
      for (const d of Object.values(byPlayer)) if (loss.has(d.key)) d.loss = loss.get(d.key);
    } catch (_) {}
    return Object.values(byPlayer).sort((a, b) => b.last - a.last);
  }

  const INTEL_LOSS_TOP = 5;
  const INTEL_FARM_TOP = 20;

  function intelUnitPop(bag) {
    let pop = 0, known = 0, unknown = 0, naval = 0;
    for (const [id, n0] of Object.entries(bag || {})) {
      const n = gbNum(n0);
      if (n == null || !(n > 0)) continue;
      const m = unitMeta(id);
      if (!m) { unknown += n; continue; }
      if (m.is_naval) { naval += n; continue; }
      const unitPop = gbNum(m.population);
      if (unitPop == null || !(unitPop > 0)) { unknown += n; continue; }
      pop += n * unitPop;
      known += n;
    }
    return { pop, known, unknown, naval };
  }
  function intelLossRatio(findings) {
    const out = new Map();
    const me = intelMyIdentity();
    if (me.id == null && me.name == null) {
      gbLogT('intel-identity-blind', 300000, 'intel: own identity unreadable - battle stats not scoped to you');
    }
    const row = (key, label) => {
      let r = out.get(key);
      if (!r) { r = { key, player: label, battles: 0, asAttacker: 0, wins: 0, losses: 0, draws: 0, popAtk: 0, popDef: 0, unknownUnits: 0, navalUnits: 0 }; out.set(key, r); }
      return r;
    };
    for (const f of (findings || [])) {
      if (!f || !f.outcome) continue;
      const atk = f.attacker, def = f.defender;

      let subject = null, subjectIsAttacker = false;
      if (intelActorIsMe(atk, me) && def) { subject = def; subjectIsAttacker = false; }
      else if (intelActorIsMe(def, me) && atk) { subject = atk; subjectIsAttacker = true; }
      else if (atk) { subject = atk; subjectIsAttacker = true; }
      else if (def) { subject = def; subjectIsAttacker = false; }
      const key = intelPlayerKey(subject);
      if (!key || key === 'unknown') continue;
      const r = row(key, intelPlayerLabel(subject, key));
      r.battles++;
      r.asAttacker += subjectIsAttacker ? 1 : 0;

      if (f.outcome === 'win') r.wins++;
      else if (f.outcome === 'lose') r.losses++;
      else r.draws++;
      const a = intelUnitPop(f.units_attacker || (f.units_defender ? null : f.units));
      const d = intelUnitPop(f.units_defender);
      r.popAtk += a.pop; r.popDef += d.pop;
      r.unknownUnits += a.unknown + d.unknown;
      r.navalUnits += a.naval + d.naval;
    }
    for (const r of out.values()) {
      r.winRate = r.battles ? r.wins / r.battles : null;
      r.lossRate = r.battles ? r.losses / r.battles : null;
    }
    return out;
  }
  function intelFarmProfitability(findings, me) {
    const byVill = new Map();
    const own = me || intelMyIdentity();
    const mineKnown = own.id != null || own.name != null;
    for (const f of (findings || [])) {
      if (!f || f.vill_id == null || f.vill_id === '') continue;

      if (mineKnown && !intelActorIsMe(f.attacker, own)) continue;
      const key = String(f.vill_id);
      let r = byVill.get(key);
      if (!r) { r = { vill_id: key, name: null, raids: 0, haul: 0, hauls: 0, hauledKnown: 0 }; byVill.set(key, r); }
      r.raids++;
      if (!r.name && f.town && f.town.name) r.name = f.town.name;
      const src = f.resources || {};
      let sum = 0, any = false;
      for (const k of GB_RES_KEYS) {
        if (src[k] == null) continue;
        const n = gbNum(src[k]);
        if (n == null) continue;
        sum += n; any = true;
      }

      if (!any) continue;
      r.hauledKnown++;
      r.haul += sum;
      if (sum > 0) r.hauls++;
    }
    return Array.from(byVill.values())
      .map(r => Object.assign({}, r, {

        perRaid: r.hauledKnown ? r.haul / r.hauledKnown : 0,
        successRate: r.hauledKnown ? r.hauls / r.hauledKnown : null,
      }))
      .sort((a, b) => b.perRaid - a.perRaid)
      .slice(0, INTEL_FARM_TOP);
  }
  function intelThreatBoard() {
    return (typeof dodgeIncomingMovements === 'function') ? dodgeIncomingMovements() : [];
  }

  const INTEL_HISTORY_TTL_MS = 7 * 86400000;
  const INTEL_TIMELINE_PER_TOWN = 8;
  const INTEL_TIMELINE_MAX_TOWNS = 30;

  const GHOST_STALE_MS = 3 * 86400000;
  const GHOST_MAX_ROWS = 30;

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

  function intelDiffNum(prev, cur, unit) {

    if (cur == null) return '\u2014';
    const b = gbNum(cur);
    if (b == null) return '\u2014';
    const suffix = unit ? ' ' + unit : '';
    if (prev == null) return String(b) + suffix;
    const a = gbNum(prev);
    if (a == null) return String(b) + suffix;
    const d = b - a;
    if (d === 0) return 'sin cambio';
    return (d > 0 ? '+' : '') + d + suffix + ` (${a}\u2192${b})`;
  }
  function intelDiffUnits(prev, cur) {
    if (!cur || !Object.keys(cur).length) return 'unidades:\u2014';
    const keys = new Set(Object.keys(cur).concat(Object.keys(prev || {})));
    const parts = [];
    for (const k of Array.from(keys).sort()) {
      const aRead = gbNum((prev || {})[k]), bRead = gbNum(cur[k]);
      if (!prev) { if (bRead != null && bRead) parts.push(`${k}:${bRead}`); continue; }
      if (aRead == null || bRead == null) { if (aRead !== bRead) parts.push(`${k} ${aRead == null ? '\u2014' : aRead}\u2192${bRead == null ? '\u2014' : bRead}`); continue; }
      if (aRead !== bRead) parts.push(`${k} ${aRead}\u2192${bRead}`);
    }
    return parts.length ? parts.join(', ') : 'sin cambio';
  }

  const INTEL_RES_ES = { wood: 'mad', stone: 'pie', iron: 'pla' };
  function intelDiffRes(prev, cur) {
    const c = cur || {}, p = prev || {};
    const parts = [];
    for (const k of GB_RES_KEYS) {
      if (c[k] == null) continue;
      const b = gbNum(c[k]);
      if (b == null) continue;
      const a = gbNum(p[k]);
      const d = a != null ? b - a : null;
      parts.push(`${INTEL_RES_ES[k]}${b}` + (d ? (d > 0 ? '+' : '') + d : ''));
    }
    return parts.length ? parts.join(' ') : '\u2014';
  }

  function intelDiffPair(prev, cur) {
    const p = prev || null;
    const boolLabel = v => (v == null ? null : (v ? 'ON' : 'OFF'));
    const pv = boolLabel(p && p.vacation), cv = boolLabel(cur && cur.vacation);
    const pName = p && p.town && p.town.name, cName = cur && cur.town && cur.town.name;
    const pAlly = p && p.alliance, cAlly = cur && cur.alliance;

    const pB = (p && p.buildings) || null, cB = (cur && cur.buildings) || null;
    let deep = '\u2014';
    if (cB && Object.keys(cB).length) {
      const keys = Object.keys(cB).sort();

      const changed = pB ? keys.filter(k => pB[k] == null || +cB[k] !== +pB[k]) : keys;
      deep = changed.length
        ? changed.slice(0, 3).map(k => `${k} ${pB ? (pB[k] == null ? '?' : +pB[k]) + '\u2192' : ''}${cB[k]}`).join(', ') + (changed.length > 3 ? ' \u2026' : '')
        : 'sin cambio';
    }
    if (cur && cur.hero) {
      const h = [cur.hero.name, cur.hero.level != null ? 'lv' + cur.hero.level : null].filter(Boolean).join(' ');
      deep = (deep === '\u2014' ? '' : deep + ' | ') + 'heroe ' + (h || '?');
    }
    return {
      wall: intelDiffNum(p && p.wall, cur && cur.wall, 'muro'),
      units: intelDiffUnits(p && p.units, cur && cur.units),
      res: intelDiffRes(p && p.resources, cur && cur.resources),
      name: (cName && pName && cName !== pName) ? `nombre: ${pName} \u2192 ${cName}` : (cName || '?'),
      alliance: (cAlly && pAlly && cAlly !== pAlly) ? `alianza: ${pAlly} \u2192 ${cAlly}` : (cAlly || '?'),
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
      if (list.length < 2) continue;
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

        const wall = gbNum(r.cur && r.cur.wall);
        const wallRaw = wall != null ? String(wall) : '';
        tr.dataset.sort = [g.label, String(r.ts), wallRaw, d.units, d.res, d.name, d.alliance, d.vacation, d.deep].join('\t');
      });
    }
    sortApplySaved(table);
  }

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
        wall: gbNum(last.wall),
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
    const table = tableShell(list, ['Ciudad', '\u00daltima', 'Edad', 'Muro', 'Alianza', 'Raz\u00f3n'], 'intel-ghost');
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
        { cls: '', text: r.wall == null ? '\u2014' : String(r.wall) },
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

      tr.dataset.sort = [r.label, String(r.lastTs), String(r.ageMs), r.wall == null ? '' : String(r.wall), r.alliance || '', ghostReasonText(r)].join('\t');
    }
    sortApplySaved(table);
  }

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
    const table = tableShell(list, ['Jugador', '\u00daltima', 'Edad', 'Informes', 'Estado', 'Nota'], sortKey);
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
        const tdTips = ['Nombre del jugador', 'Marca temporal del ultimo informe', 'Tiempo desde el ultimo informe', 'Numero de informes en la ventana', 'Estado diplomatico guardado', 'Nota personal sobre el jugador'];
        cells.forEach((_, i) => { const td = document.createElement('td'); gbTip(td, tdTips[i] || ''); tr.appendChild(td); });
        tbody.appendChild(tr);
      }
      patchCells(tr, cells);

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
    const VIEWS = { heatmap: intelHeatmapLines, defense: intelDefenseBoardLines, pool: intelPoolLines, activity: intelActivityLines };
    if (VIEWS[intelView]) {
      let out = [];
      try { out = VIEWS[intelView](); } catch (e) { out = ['vista no disponible: ' + String(e).slice(0, 60)]; }
      box.textContent = out.join('\n');

      try { intelPatternScan(); } catch (_) {}
      try { renderIntelTimeline(); } catch (_) {}
      return;
    }
    const threats = intelThreatBoard();

    const colonyKind = {};
    try { for (const c of militaryColonyThreats()) colonyKind[String(c.mov.id)] = c.kind; } catch (_) {}
    let csTrains = [];
    try { csTrains = csWaveClusters(threats) || []; } catch (_) {}
    const dossiers = intelDossiers().slice(0, 30);
    let html = '';
    html += '=== Entrantes ===\n';
    if (!threats.length) html += '(none)\n';
    else {
      threats.forEach(t => {
        const da = defenseAssessment(t, threats);
        const sup = da.supports.length
          ? `${da.supports.length} (${da.supports.map(s => fmtSec(Math.round(s.travel))).slice(0, 2).join('-')})`
          : '0';
        html += `${t.hasCs ? '[CS] ' : ''}${t.type || 'atk'} \u2192 ${t.dest} from ${t.origin || '?'}` +
          (t.arrival ? ` @${t.arrival}` : '') +
          ` | riesgo ${da.band} ${da.risk} (${defenseFactorText(da.factors)})` +
          ` | ETA ${da.eta==null?'\u2014':fmtSec(da.eta)} | simult ${da.simultaneous}` +
          ` | apoyo ${sup} | milicia ${da.militia && da.militia.ok ? 'si' : 'no'}` +
          ` | esquivar ${da.evac.ok?'si':'no'}${da.evac.ok?'':' ('+(da.evac.why||'?')+')'}` +
          (colonyKind[String(t.id)] ? ` | ${militaryColonyLabel(colonyKind[String(t.id)])}` : '') +
          (() => { const tr = csTrains.find(x => String(x.dest) === String(t.dest)); return (tr && tr.verdict !== 'no-cs') ? ' | ' + csTrainLine(tr) : ''; })() + '\n';
      });
    }
    html += '\n=== Fichas ===\n';
    dossiers.forEach(d => {
      html += `${d.player}: ${d.reports} informes${d.status ? ' ' + NAP_BADGE[d.status] : ''}` +
        (d.note ? ` \u2014 ${d.note}` : '') +
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
    {
      let ci = [];
      try { ci = intelCounterIntelScan(); } catch (_) {}
      if (ci.length) {
        html += '\n=== Contra-inteligencia (quien me espia) ===\n';
        ci.slice(0, 5).forEach(r => {
          html += `${r.name}: ${r.reports} espionaje(s) 24h sobre ${r.distinctTargets} ciudad(es) - ultimo ${new Date(r.last).toLocaleString()}\n`;
        });
      }
    }
    {
      const hist = (state.defenseHistory || []).slice(-20).reverse();
      if (hist.length) {
        html += '\n=== Decisiones de defensa (ultimas 20) ===\n';
        const byType = {};
        hist.forEach(h => { const k = h.attackType || '?'; byType[k] = byType[k] || { dodge: 0, hold: 0 }; byType[k][h.decision]++; });
        Object.entries(byType).forEach(([t, c]) => { html += `${t}: ${c.dodge} esquivadas / ${c.hold} mantenidas\n`; });
        hist.slice(0, 6).forEach(h => {
          html += `  ${new Date(h.ts).toLocaleTimeString()} ${h.attackType || '?'} riesgo ${h.risk == null ? '?' : h.risk} (${h.band || '?'}) -> ${h.decision}\n`;
        });
      }
    }
    if (state.spyEnabled) {
      html += '\n=== Cola de espionaje ===\n';
      let ranked = [];
      try { ranked = spyRankTargets().slice(0, 5); } catch (_) {}
      if (!state.spyTpl) html += '(sin ruta aprendida - espia una ciudad a mano una vez)\n';
      if (!ranked.length) html += '(ningun objetivo pendiente)\n';
      else ranked.forEach((t, i) => {
        html += `${i + 1}. #${t.id}${t.watch ? ' [vigilada]' : ''} - ultimo ${t.lastSpyAt ? new Date(t.lastSpyAt).toLocaleString() : 'nunca'}` +
          ` - ${t.reports24h} informe(s) 24h\n`;
      });
    }
    if (state.intelBattleStats !== false) {
      const findings = state.findings || [];
      const loss = Array.from(intelLossRatio(findings).values())

        .sort((a, b) => ((b.lossRate || 0) - (a.lossRate || 0)) || (b.losses - a.losses) || (b.battles - a.battles))
        .slice(0, INTEL_LOSS_TOP);
      html += '\n=== P\u00e9rdidas (verdicto del informe) ===\n';
      if (!loss.length) html += '(sin informes con resultado)\n';
      else loss.forEach(r => {
        const wr = r.winRate == null ? '\u2014' : Math.round(r.winRate * 100) + '%';
        html += `${r.player}: ${r.battles} batallas (${r.asAttacker} como atacante) | ` +
          `${r.wins}G/${r.losses}P/${r.draws}E \u00b7 exito ${wr} | pob atac ${Math.round(r.popAtk)} def ${Math.round(r.popDef)}` +
          (r.unknownUnits ? ` | ${r.unknownUnits} sin metadatos` : '') + (r.navalUnits ? ` | ${r.navalUnits} navales excluidas` : '') + '\n';
      });
      const farms = intelFarmProfitability(findings);
      html += '\n=== Granjas top (botin por incursion) ===\n';
      if (!farms.length) html += '(sin incursiones a aldeas)\n';
      else farms.forEach(r => {
        const sr = r.successRate == null ? '\u2014' : Math.round(r.successRate * 100) + '%';
        html += `${r.name || r.vill_id}: ${Math.round(r.perRaid)}/incursion \u00b7 ${r.raids} incursiones \u00b7 botin ${Math.round(r.haul)} \u00b7 exito ${sr}\n`;
      });
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

        if (fx != null && fy != null) {
          const cTokens = String(c).split(/\s+/).filter(Boolean).map(String);
          if (cTokens.indexOf(String(fx)) >= 0 && cTokens.indexOf(String(fy)) >= 0) {
            hits.push({ kind: 'coords', rule: String(c), specificity: 3 });
          }
        }
      }
      const pname = finding.attacker && (finding.attacker.name || finding.attacker.player_name);
      if ((entry.player || entry.name) && pname && String(pname).toLowerCase() === String(entry.player || entry.name).toLowerCase()) {
        hits.push({ kind: 'player', rule: String(entry.player || entry.name), specificity: 2 });
      }
      if (entry.alliance && finding.alliance && String(finding.alliance).toLowerCase() === String(entry.alliance).toLowerCase()) {
        hits.push({ kind: 'alliance', rule: String(entry.alliance), specificity: 1 });
      }

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
      break;
    }
  }

  const COUNTER_INTEL_WINDOW_MS = 24 * 3600000;
  function counterIntelThreshold() {
    const n = gbNum((state.defenseCfg || {}).counterIntelMin);
    return n != null ? Math.max(1, Math.min(50, n)) : 3;
  }
  function intelCounterIntelScan() {
    const now = Date.now();
    const cut = now - COUNTER_INTEL_WINDOW_MS;
    const me = intelMyIdentity();
    const ownTownIds = new Set();
    try { (townsFromGame() || []).forEach(t => ownTownIds.add(String(t.id))); } catch (_) {}
    const by = {};
    for (const f of (state.findings || [])) {
      if (!f || !(+f.ts >= cut)) continue;

      if (String(f.type || '').toLowerCase() !== 'spy') continue;

      let mine = intelActorIsMe(f.defender, me);
      if (!mine && !f.defender && f.town && f.town.id != null) mine = ownTownIds.has(String(f.town.id));
      if (!mine) continue;
      const key = intelPlayerKey(f.attacker);
      if (!key || key === 'unknown') continue;
      if (!by[key]) by[key] = { key, name: intelPlayerLabel(f.attacker, key), reports: 0, towns: [], seen: new Set(), first: +f.ts, last: +f.ts };
      const b = by[key];
      b.reports++;
      b.last = Math.max(b.last, +f.ts);
      b.first = Math.min(b.first, +f.ts);
      const tid = f.town && (f.town.id != null ? f.town.id : f.town.name);
      if (tid != null) {

        b.seen.add(String(tid));
        if (b.towns.indexOf(String(tid)) < 0 && b.towns.length < 8) b.towns.push(String(tid));
      }
    }
    const rows = Object.values(by).map(b => Object.assign(b, { distinctTargets: b.seen.size }))
      .sort((a, b) => b.reports - a.reports);
    const min = counterIntelThreshold();
    const hits = rows.filter(b => b.reports >= min);
    hits.forEach(h => {
      const bucket = Math.floor(now / COUNTER_INTEL_WINDOW_MS);
      const ak = 'counter-intel:' + h.key + ':' + bucket;
      if (state.alerted && state.alerted[ak]) return;
      if (!state.alerted) state.alerted = {};
      state.alerted[ak] = now;
      save(STORE.ALERTED, state.alerted);
      gbLog(`counter-intel: ${h.name} spied me ${h.reports}x/24h across ${h.distinctTargets} town(s)`);
      try {
        alertWebhook('counter-intel', {
          watcher: state.exportRedact !== false ? String(h.name).slice(0, 2) + '***' : h.name,
          n: h.reports,
          towns: h.towns.map(t => state.exportRedact !== false ? String(t).slice(0, 2) + '***' : t),
          distinctTargets: h.distinctTargets,
          first: h.first, last: h.last, window: '24h',
        });
      } catch (_) {}
    });
    return rows;
  }

  const INTEL_MATRIX_WINDOW_MS = 7 * 86400000;
  const INTEL_MATRIX_ROWS = 12;
  let intelView = 'summary';
  function intelAllianceName(v) {
    if (typeof v !== 'string') return null;
    const n = v.trim();

    if (!n || n === '?' || n === '-' || n.length > 40) return null;
    return n;
  }
  function intelAllianceMatrix(windowMs) {
    const read = gbNum(windowMs);
    const win = read != null ? read : INTEL_MATRIX_WINDOW_MS;
    const cutoffTs = Date.now() - win;
    const out = { alliances: [], towns: [], totalForAlliance: {}, totalForTown: {}, cells: {}, windowMs: win, cutoffTs };
    const me = intelMyIdentity();
    const own = new Set();
    try { (townsFromGame() || []).forEach(t => own.add(String(t.id))); } catch (_) {}
    for (const t of (state.towns || [])) own.add(String(t.id));
    for (const f of (state.findings || [])) {
      if (!f || !(+f.ts >= cutoffTs)) continue;
      const ally = intelAllianceName(f.alliance);
      if (!ally) continue;
      const tid = f.town && f.town.id != null ? String(f.town.id) : null;

      if (!tid || !own.has(tid)) continue;

      if (intelActorIsMe(f.attacker, me)) continue;
      const key = ally + '::' + tid;
      out.cells[key] = (out.cells[key] || 0) + 1;
      out.totalForAlliance[ally] = (out.totalForAlliance[ally] || 0) + 1;
      out.totalForTown[tid] = (out.totalForTown[tid] || 0) + 1;
    }
    out.alliances = Object.keys(out.totalForAlliance)
      .sort((a, b) => (out.totalForAlliance[b] - out.totalForAlliance[a]) || a.localeCompare(b));
    out.towns = Object.keys(out.totalForTown).sort((a, b) => String(a).localeCompare(String(b)));
    return out;
  }
  const INTEL_HEAT = [' ', '\u00b7', '\u2591', '\u2592', '\u2593', '\u2588'];
  function intelHeatChar(n, max) {
    if (!n) return INTEL_HEAT[0];
    if (!(max > 0)) return INTEL_HEAT[1];
    return INTEL_HEAT[Math.min(INTEL_HEAT.length - 1, 1 + Math.floor((n - 1) / max * (INTEL_HEAT.length - 2)))];
  }
  function intelHeatmapLines() {
    const m = intelAllianceMatrix();
    if (!m.alliances.length) return ['mapa de calor: sin informes con alianza en 7d'];
    const lines = [`mapa de calor - alianza x mis ciudades (7d, ${m.alliances.length} alianzas)`];
    const max = Math.max(...Object.values(m.cells));
    const head = '  ' + ' '.repeat(18) + m.towns.map(t => String(t).slice(-3).padStart(4)).join('');
    lines.push(head + '   tot');
    const shown = m.alliances.slice(0, INTEL_MATRIX_ROWS);
    for (const a of shown) {
      const row = m.towns.map(t => intelHeatChar(m.cells[a + '::' + t] || 0, max).padStart(4)).join('');
      lines.push('  ' + a.slice(0, 18).padEnd(18) + row + String(m.totalForAlliance[a]).padStart(6));
    }
    const rest = m.alliances.slice(INTEL_MATRIX_ROWS);
    if (rest.length) {
      const tot = rest.reduce((n, a) => n + m.totalForAlliance[a], 0);
      lines.push('  ' + `(+${rest.length} alianzas)`.padEnd(18) + ' '.repeat(m.towns.length * 4) + String(tot).padStart(6));
    }
    lines.push('  ' + 'total'.padEnd(18) + m.towns.map(t => String(m.totalForTown[t]).padStart(4)).join(''));
    return lines;
  }

  const NAP_STATUSES = ['war', 'ally', 'nap', 'neutral'];
  const NAP_RANK = { war: 4, ally: 3, nap: 2, neutral: 1 };
  const NAP_BADGE = { war: '[WAR]', ally: '[ALLY]', nap: '[NAP]', neutral: '[NEUTRAL]' };
  function napStore() {
    const s0 = state.napStatus;
    if (!s0 || typeof s0 !== 'object' || Array.isArray(s0)) state.napStatus = { players: {}, alliances: {} };
    if (!state.napStatus.players || typeof state.napStatus.players !== 'object') state.napStatus.players = {};
    if (!state.napStatus.alliances || typeof state.napStatus.alliances !== 'object') state.napStatus.alliances = {};
    return state.napStatus;
  }
  function napSave() { save(STORE.NAP_STATUS, napStore()); }
  function intelSetPlayerStatus(player, status) {
    const key = intelPlayerKey(player) || (typeof player === 'string' ? player.trim() : null);
    if (!key) return false;
    const st = napStore();
    if (!status || !NAP_STATUSES.includes(status)) delete st.players[key];
    else st.players[key] = status;
    napSave();
    return true;
  }
  function intelSetAllianceStatus(alliance, status) {
    const a = intelAllianceName(alliance);
    if (!a) return false;
    const st = napStore();
    if (!status || !NAP_STATUSES.includes(status)) delete st.alliances[a];
    else st.alliances[a] = status;
    napSave();
    return true;
  }

  function intelStatusFor(player, alliance) {
    const st = napStore();
    const pk = intelPlayerKey(player);
    const p = pk ? st.players[pk] : null;
    const a = intelAllianceName(alliance) ? st.alliances[intelAllianceName(alliance)] : null;
    if (p && a) return (NAP_RANK[p] >= NAP_RANK[a]) ? { status: p, source: 'player' } : { status: a, source: 'alliance' };
    if (p) return { status: p, source: 'player' };
    if (a) return { status: a, source: 'alliance' };
    return { status: null, source: null };
  }

  function intelDefenseBoard(threats) {
    const byDest = new Map();
    for (const t of (threats || [])) {
      const k = String(t.dest);
      if (!byDest.has(k)) byDest.set(k, []);
      byDest.get(k).push(t);
    }
    const rows = [];
    for (const [dest, list] of byDest) {
      let local = null;
      try { local = defenseLocalStrength(dest); } catch (_) {}
      const assessed = list.map(t => {
        let a = null;
        try { a = defenseAssessment(t, list); } catch (_) {}
        return { mov: t, a };
      }).sort((x, y) => ((x.a && x.a.eta) == null ? Infinity : x.a.eta) - ((y.a && y.a.eta) == null ? Infinity : y.a.eta));
      const worst = assessed.reduce((m, x) => (x.a && (!m || x.a.risk > m.risk)) ? x.a : m, null);
      rows.push({ dest, list: assessed, local, worst, hasCs: list.some(t => t.hasCs) });
    }
    return rows.sort((a, b) => ((b.worst && b.worst.risk) || 0) - ((a.worst && a.worst.risk) || 0));
  }
  function intelDefenseBoardLines() {
    let threats = [];
    try { threats = intelThreatBoard() || []; } catch (_) {}
    const rows = intelDefenseBoard(threats);
    if (!rows.length) return ['tablero de defensa: sin entrantes'];
    const mode = (state.defenseCfg && state.defenseCfg.mode) || 'notify';
    const lines = [`tablero de defensa - modo ${mode}`];
    for (const r of rows) {
      lines.push(`${townNameById(r.dest)} (#${r.dest})${r.hasCs ? ' [CS]' : ''}` +
        ` - defensa local ${r.local ? Math.round(r.local.score) : '?'}` +
        ` - ${r.list.length} entrante(s)` +
        (r.worst ? ` - peor riesgo ${r.worst.risk} (${r.worst.band})` : ''));
      for (const x of r.list.slice(0, 4)) {
        const a = x.a;
        lines.push(`    ${x.mov.type || 'atk'} de ${x.mov.origin || '?'} ETA ${a && a.eta != null ? fmtSec(a.eta) : '?'}` +
          (a ? ` | apoyo ${a.supports.length} | esquivar ${a.evac.ok ? 'si' : 'no'}` : ' | evaluacion no legible'));
      }
    }
    return lines;
  }

  function intelPoolByAlliance() {
    const et = () => ({ wood: 0, stone: 0, iron: 0 });
    const own = { alliance: '(mis ciudades)', totals: et(), towns: 0, spied: false, lastTs: 0 };
    for (const t of (state.towns || [])) {
      const r = (state.townResources || {})[t.id];
      if (!r || !r.ok) continue;
      for (const k of GB_RES_KEYS) { const n = gbNum(r[k]); if (n != null) own.totals[k] += n; }
      own.towns++;
      if (+r.ts > own.lastTs) own.lastTs = +r.ts;
    }
    const byAlly = new Map();
    const seenTown = new Set();

    const sorted = (state.findings || []).slice().sort((a, b) => (+b.ts || 0) - (+a.ts || 0));
    for (const f of sorted) {
      const a = intelAllianceName(f && f.alliance);
      if (!a || !f.resources) continue;
      const tid = f.town && f.town.id != null ? String(f.town.id) : null;
      if (!tid || seenTown.has(tid)) continue;
      let any = false;
      const add = et();
      for (const k of GB_RES_KEYS) {
        if (f.resources[k] == null) continue;
        const n = gbNum(f.resources[k]);
        if (n == null) continue;
        add[k] = n; any = true;
      }
      if (!any) continue;
      seenTown.add(tid);
      let row = byAlly.get(a);
      if (!row) { row = { alliance: a, totals: et(), towns: 0, spied: true, lastTs: 0 }; byAlly.set(a, row); }
      for (const k of GB_RES_KEYS) row.totals[k] += add[k];
      row.towns++;
      if (+f.ts > row.lastTs) row.lastTs = +f.ts;
    }
    const out = Array.from(byAlly.values()).sort((x, y) =>
      (y.totals.wood + y.totals.stone + y.totals.iron) - (x.totals.wood + x.totals.stone + x.totals.iron));
    return own.towns ? [own].concat(out) : out;
  }
  function intelPoolLines() {
    const rows = intelPoolByAlliance();
    if (!rows.length) return ['reservas: nada legible'];
    const lines = ['reservas por alianza (espiadas = ultimo informe, NO actuales)'];
    for (const r of rows.slice(0, 12)) {
      lines.push(`  ${r.alliance.slice(0, 22).padEnd(22)} mad ${fmt(r.totals.wood)} pie ${fmt(r.totals.stone)} pla ${fmt(r.totals.iron)}` +
        `  ${r.towns} ciudad(es)` + (r.spied ? ` - visto ${r.lastTs ? new Date(r.lastTs).toLocaleString() : '?'}` : ''));
    }
    return lines;
  }

  function intelMemberActivity(opts) {
    const o = opts || {};
    const filter = String(o.alliance || '').trim().toLowerCase();
    const hours = gbNum(o.windowHours);
    const cut = Date.now() - ((hours != null ? hours : 24 * 7) * 3600000);
    const me = intelMyIdentity();
    const byPlayer = {};
    for (const f of (state.findings || [])) {
      if (!f || !(+f.ts >= cut)) continue;
      for (const side of ['attacker', 'defender']) {
        const actor = f[side];
        if (!actor || intelActorIsMe(actor, me)) continue;
        const key = intelPlayerKey(actor);
        if (!key || key === 'unknown') continue;
        const ally = intelAllianceName((actor && (actor.alliance || actor.alliance_name)) || (side === 'attacker' ? f.alliance : null));
        if (filter && String(ally || '').toLowerCase() !== filter) continue;
        const r = byPlayer[key] || (byPlayer[key] = {
          key, player: intelPlayerLabel(actor, key), alliance: ally || null,
          reports: 0, attacksOnMe: 0, attacksByMe: 0, firstTs: +f.ts, lastTs: +f.ts,
        });
        if (ally && !r.alliance) r.alliance = ally;
        r.reports++;
        if (side === 'attacker' && intelActorIsMe(f.defender, me)) r.attacksOnMe++;
        if (side === 'defender' && intelActorIsMe(f.attacker, me)) r.attacksByMe++;
        r.firstTs = Math.min(r.firstTs, +f.ts);
        r.lastTs = Math.max(r.lastTs, +f.ts);
      }
    }
    return Object.values(byPlayer).map(r => Object.assign(r, intelStatusFor({ name: r.player }, r.alliance)))
      .sort((a, b) => b.lastTs - a.lastTs);
  }
  function intelActivityLines() {
    const rows = intelMemberActivity({ alliance: state.intelAllianceFilter || '' });
    if (!rows.length) return ['actividad: sin informes en 7d' + (state.intelAllianceFilter ? ` para "${state.intelAllianceFilter}"` : '')];
    const lines = [`actividad de miembros (7d)${state.intelAllianceFilter ? ' - filtro: ' + state.intelAllianceFilter : ''}`];
    for (const r of rows.slice(0, 20)) {
      lines.push(`  ${(r.player || '?').slice(0, 18).padEnd(18)} ${(r.alliance || '-').slice(0, 14).padEnd(14)}` +
        ` ${String(r.reports).padStart(3)} inf  ${String(r.attacksOnMe).padStart(2)}->mi  ${String(r.attacksByMe).padStart(2)}<-mi` +
        `  ${new Date(r.lastTs).toLocaleString()}${r.status ? ' ' + NAP_BADGE[r.status] : ''}`);
    }
    return lines;
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
      ? hits.map(h => `${h.name}\u00d7${h.n}/24h`).join(', ')
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
      gbLog(`pattern: ${h.name} hit ${h.n}\u00d7 in 24h`);
      try { alertWebhook('pattern', payload); } catch (_) {}
    });
    return hits;
  }
  const QUEST_SCAN_MS = 12000;
  const QUEST_HISTORY_MAX = 100;
