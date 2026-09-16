// City-scheme advisor: reads the in-game Notas window and proposes per-city
  // role + mythical + recruit + transport + fire-ship plans. Enforces a
  // 2-cities-per-(god, mythical) pairing rule. Advisor-only: never writes
  // through bridgePost and never edits the Notas window itself. See
  // docs/superpowers/specs/2026-09-16-city-scheme-advisor-design.md.
  const CITY_SCHEME_DEFAULTS = Object.freeze({
    enabled: true,
    pairTarget: 2,
    fireShipsOnAttack: 10,
    mythicalPerCity: 30,
    bigTransporterMythical: 1,
    triremesPerTransportCity: 8,
    parseSelectors: Object.freeze({
      window: '.window_main_container.notes, .gpwindow_content.notes',
      preview: '.preview_box, .notes_preview',
      textarea: 'textarea[name*="note"], .editable_note textarea',
    }),
  });
  const CITY_SCHEME_TICK_MIN_MS = 60000;
  let citySchemeLast = { at: 0, fingerprint: 'none', rows: 0, pairs: 0 };

  function citySchemeCfg() {
    const raw = state.citySchemeCfg && typeof state.citySchemeCfg === 'object' && !Array.isArray(state.citySchemeCfg) ? state.citySchemeCfg : {};
    const out = {
      enabled: raw.enabled !== false,
      pairTarget: gbCfgClamp(raw.pairTarget, 1, 6, CITY_SCHEME_DEFAULTS.pairTarget),
      fireShipsOnAttack: gbCfgClamp(raw.fireShipsOnAttack, 0, 50, CITY_SCHEME_DEFAULTS.fireShipsOnAttack),
      mythicalPerCity: gbCfgClamp(raw.mythicalPerCity, 0, 500, CITY_SCHEME_DEFAULTS.mythicalPerCity),
      bigTransporterMythical: gbCfgClamp(raw.bigTransporterMythical, 0, 10, CITY_SCHEME_DEFAULTS.bigTransporterMythical),
      triremesPerTransportCity: gbCfgClamp(raw.triremesPerTransportCity, 0, 50, CITY_SCHEME_DEFAULTS.triremesPerTransportCity),
    };
    state.citySchemeCfg = out;
    return out;
  }
  function citySchemeSetCfg(patch) {
    const prev = citySchemeCfg();
    const next = Object.assign({}, prev, patch || {});
    state.citySchemeCfg = next;
    const clean = citySchemeCfg();
    save(STORE.CITY_SCHEME_CFG, clean);
    citySchemeInvalidate();
    return clean;
  }
  function citySchemeInvalidate() {
    citySchemeLast.at = 0;
    citySchemeLast.fingerprint = 'none';
  }

  function citySchemeProbe(selector) {
    try { return document.querySelector(selector); } catch (_) { return null; }
  }
  function citySchemePreviewFromHtml(html) {
    if (html == null) return '';
    return String(html)
      .replace(/<br\s*\/?>(\s*)/gi, '\n$1')
      .replace(/<\/div>\s*<div[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\r/g, '');
  }
  function citySchemeModelScrape() {
    try {
      const win = gameUw();
      const notes = (win && win.Game && win.Game.notesCollection) ||
                    (win && win.MM && win.MM.getCollections && win.MM.getCollections().notes) ||
                    (win && win.ITowns && typeof win.ITowns.getNotes === 'function' && win.ITowns.getNotes());
      if (Array.isArray(notes)) return notes.filter(n => typeof n === 'string').join('\n');
    } catch (_) {}
    return null;
  }
  function citySchemeNotesScrape() {
    const sel = CITY_SCHEME_DEFAULTS.parseSelectors;
    const textarea = citySchemeProbe(sel.textarea);
    if (textarea && typeof textarea.value === 'string' && textarea.value) return textarea.value;
    const win = citySchemeProbe(sel.window);
    const preview = win ? win.querySelector(sel.preview) : citySchemeProbe(sel.preview);
    if (preview) {
      const text = preview.textContent != null ? preview.textContent : citySchemePreviewFromHtml(preview.innerHTML);
      if (text && text.trim()) return text;
    }
    const fromModel = citySchemeModelScrape();
    if (fromModel && fromModel.trim()) return fromModel;
    return null;
  }
  const CITY_SCHEME_MYTHICAL_GOD = Object.freeze(Object.assign(Object.create(null), {
    hydra: 'poseidon',
    ladon: 'poseidon',
    griffin: 'zeus',
    grifo: 'zeus',
    harpy: 'athena',
    harpia: 'athena',
    manticore: 'athena',
    manticora: 'athena',
  }));
  const CITY_SCHEME_KEYWORDS = Object.freeze({
    'ataque tierra': { role:'ataque_tierra', mythical:null, god:null },
    'ataque agua':   { role:'ataque_agua',   mythical:null, god:null },
    'ataque':        { role:'ataque_tierra', mythical:null, god:null },
    'def tierra':    { role:'def_tierra',    mythical:null, god:null },
    'def agua':      { role:'def_agua',      mythical:null, god:null },
    'def':           { role:'def_tierra',    mythical:null, god:null },
    'hoplitas':      { role:'ataque_tierra', mythical:'hoplite', god:'ares' },
    'hydra':         { role:'ataque_agua',   mythical:'hydra',   god:'poseidon' },
    'ladon':         { role:'ataque_tierra', mythical:'ladon',   god:'poseidon' },
    'grifo':         { role:'ataque_tierra', mythical:'griffin', god:'zeus' },
    'harpia':        { role:'ataque_tierra', mythical:'harpy',   god:'athena' },
    'manticora':     { role:'ataque_agua',   mythical:'manticore', god:'athena' },
    'trireme':       { role:'ataque_agua',   mythical:null, god:null, transport:'trireme' },
  });

  function citySchemeTokenize(rawLine) {
    const line = String(rawLine == null ? '' : rawLine).trim();
    if (!line) return null;
    const m = line.match(/^(.+?)\s*[-·—]\s*(.+)$/);
    if (!m) return null;
    const cityHint = m[1].trim();
    const keyword = m[2].trim().toLowerCase();
    if (!cityHint || !keyword) return null;
    return { cityHint, keyword };
  }

  function citySchemeTownMap() {
    let towns = null;
    try { towns = townsFromGame(); } catch (_) {}
    if (!Array.isArray(towns) || !towns.length) return null;
    const out = new Map();
    for (const t of towns) {
      if (!t || t.id == null) continue;
      const name = (typeof t.getName === 'function' ? t.getName() : t.name) || '';
      if (name) out.set(String(name), String(t.id));
    }
    return out.size ? out : null;
  }

  function citySchemeResolveTownId(hint, townMap, modelFallback) {
    if (!hint || !townMap) return null;
    if (townMap.has(hint)) return { id: townMap.get(hint), match: 'exact' };
    const hintLower = hint.toLowerCase();
    for (const [name, id] of townMap.entries()) {
      if (name && name.toLowerCase() === hintLower) return { id, match: 'ci' };
    }
    for (const [name, id] of townMap.entries()) {
      if (name && (name.toLowerCase().startsWith(hintLower) || hintLower.startsWith(name.toLowerCase()))) {
        return { id, match: 'prefix' };
      }
    }
    if (modelFallback) {
      try {
        const probe = gbTownModel(hint);
        if (probe && probe.id != null) return { id: String(probe.id), match: 'model' };
      } catch (_) {}
    }
    return null;
  }
  function citySchemeBuildRow(token, townId, cfg, keywordMap) {
    const base = { id: townId, cityHint: token.cityHint, rawKeyword: token.keyword, role: null, mythical: null, god: null };
    if (!townId) return Object.assign(base, { unknownKeyword: token.keyword, pairing: null });
    const mapped = keywordMap[token.keyword];
    if (!mapped) return Object.assign(base, { unknownKeyword: token.keyword, pairing: null });
    const cfgGods = (cfg && cfg.gods && typeof cfg.gods === 'object') ? cfg.gods : null;
    const mythicalKey = (mapped.mythical && (!cfgGods || cfgGods[mapped.mythical])) ? mapped.mythical : null;
    const god = (mythicalKey && mapped.god) || (mythicalKey && CITY_SCHEME_MYTHICAL_GOD[mythicalKey]) || (cfgGods && mythicalKey && cfgGods[mythicalKey]) || null;
    return Object.assign(base, {
      role: mapped.role,
      mythical: mythicalKey,
      god: god || null,
      transport: mapped.transport || null,
      schemeSource: 'keyword',
      unknownKeyword: null,
      pairing: null,
    });
  }

  function citySchemeParse(raw, townMap, cfg) {
    const keywordMap = Object.assign({}, CITY_SCHEME_KEYWORDS, (cfg && cfg.keywordOverrides) || {});
    const rows = [];
    const unparseable = [];
    const unknownKeyword = [];
    const lines = String(raw || '').split(/\n+/);
    for (const line of lines) {
      const token = citySchemeTokenize(line);
      if (!token) {
        if (line && line.trim()) unparseable.push(line);
        continue;
      }
      const resolved = citySchemeResolveTownId(token.cityHint, townMap, true);
      if (!resolved) {
        unparseable.push(line);
        continue;
      }
      const row = citySchemeBuildRow(token, resolved.id, cfg, keywordMap);
      row.match = resolved.match;
      if (row.unknownKeyword) unknownKeyword.push(row);
      rows.push(row);
    }
    return { rows, unparseable, unknownKeyword };
  }

  function citySchemePairing(rows, cfg) {
    const groups = Object.create(null);
    const deltas = [];
    for (const r of rows) {
      if (!r.mythical || !r.god) { r.pairing = null; continue; }
      const key = r.god + '|' + r.mythical;
      (groups[key] = groups[key] || []).push(r);
    }
    for (const key of Object.keys(groups)) {
      const list = groups[key];
      if (list.length === cfg.pairTarget) list.forEach(r => { r.pairing = 'ok'; r.pairingProposal = null; });
      else if (list.length < cfg.pairTarget) {
        list.forEach(r => { r.pairing = 'under'; });
        const sample = list[0];
        deltas.push({ kind: 'add-mate', god: sample.god, mythical: sample.mythical, currentCount: list.length, targetCount: cfg.pairTarget });
      } else {
        list.forEach(r => { r.pairing = 'over'; });
        const keep = list.slice(0, cfg.pairTarget).map(r => r.cityHint);
        const demote = list.slice(cfg.pairTarget).map(r => ({ hint: r.cityHint, role: r.role, mythical: r.mythical, god: r.god }));
        deltas.push({ kind: 'demote', god: list[0].god, mythical: list[0].mythical, keep, demote, currentCount: list.length, targetCount: cfg.pairTarget });
      }
    }
    return { groups, deltas };
  }
  function tryGetTown(townId) {
    try { return gbTownModel(townId); } catch (_) { return null; }
  }

  function citySchemeRecruitPlan(row, cfg) {
    const recruit = {};
    const transport = {};
    let blind = false;

    if (row.mythical) {
      const cost = (() => {
        try { return recruitEffectiveUnitCost(row.id, row.mythical); } catch (_) { return null; }
      })();
      const popPerUnit = cost && cost.population != null ? gbNum(cost.population) : null;
      if (popPerUnit == null || popPerUnit <= 0) blind = true;
      recruit[row.mythical] = blind ? null : cfg.mythicalPerCity;
    }

    const navalAttack = row.role === 'ataque_agua' || (row.mythical && CITY_SCHEME_MYTHICAL_GOD[row.mythical] === 'poseidon');
    if (navalAttack) recruit.fire_ship = cfg.fireShipsOnAttack;

    const coast = roleAdvisorCoast(tryGetTown(row.id));
    if (row.transport === 'trireme' && !row.mythical && coast === true) recruit.trireme = cfg.triremesPerTransportCity;

    const needsBoat = !!(row.mythical && CITY_SCHEME_MYTHICAL_GOD[row.mythical] === 'poseidon' && coast === false);
    if (needsBoat) transport.big_transporter = cfg.bigTransporterMythical;

    let farmLevelsBuildable = null;
    try {
      const pop = gbTownPop(row.id);
      const maxFarm = gbProbeNum(row.id, ['farm_max', 'farmMax', 'max_farm']);
      if (pop != null && maxFarm != null) farmLevelsBuildable = Math.max(0, Math.min(5, Math.floor(maxFarm - (pop.built != null ? pop.built : 0))));
    } catch (_) { farmLevelsBuildable = null; }

    let popHeadroom = null;
    try {
      const pop = gbTownPop(row.id);
      const cap = pop && pop.capacity != null ? gbNum(pop.capacity) : null;
      const used = pop && pop.used != null ? gbNum(pop.used) : 0;
      const recruitPop = Object.values(recruit).reduce((s, n) => s + (gbNum(n) || 0) * 1, 0);
      if (cap != null) popHeadroom = Math.max(0, cap - used - recruitPop);
    } catch (_) { popHeadroom = null; }

    row.recruit = recruit;
    row.transportNeeded = transport;
    row.farmLevelsBuildable = farmLevelsBuildable;
    row.popHeadroom = popHeadroom;
    row.recruitPlanBlind = blind;
    return row;
  }

  function citySchemeNewCityTemplate(townId, town, cfg) {
    const name = (town && (typeof town.getName === 'function' ? town.getName() : town.name)) || String(townId);
    const coast = roleAdvisorCoast(town);
    let threat = null;
    try { threat = cdThreatState(townId); } catch (_) { threat = null; }
    let role = 'ataque_tierra';
    if (coast === true && !(threat && threat.threatened === true)) role = 'ataque_agua';
    else if (threat && threat.threatened === true) role = 'def_tierra';
    const line = name + ' - ' + role;
    return { id: String(townId), hint: name, role, line, coast, threatened: !!(threat && threat.threatened === true) };
  }

  function citySchemeFingerprint(rows) {
    if (!Array.isArray(rows) || !rows.length) return 'empty';
    return rows.map(r => [r.id, r.mythical || '-', r.god || '-', r.role || '-', r.pairing || '-']).join('|');
  }
  function citySchemeTick() {
    const cfg = citySchemeCfg();
    if (!cfg.enabled) return false;
    const raw = citySchemeNotesScrape();
    if (raw == null) {
      citySchemeLast = { at: Date.now(), fingerprint: 'unreadable', rows: 0, pairs: 0, unreadable: true };
      return false;
    }
    const cache = state.citySchemeNotes || {};
    const fp = raw.length + ':' + (raw.slice(0, 64) || '');
    if (cache.fingerprint === fp && cache.at && Date.now() - cache.at < CITY_SCHEME_TICK_MIN_MS) return false;
    const townMap = citySchemeTownMap();
    const parsed = citySchemeParse(raw, townMap, cfg);
    parsed.rows.forEach(r => citySchemeRecruitPlan(r, cfg));
    const paired = citySchemePairing(parsed.rows, cfg);
    const knownIds = new Set(parsed.rows.map(r => r.id));
    const newTowns = (citySchemeTownMap() ? Array.from(citySchemeTownMap().keys()) : [])
      .filter(n => !knownIds.has(citySchemeTownMap().get(n)))
      .map(name => {
        const id = citySchemeTownMap().get(name);
        const town = (() => { try { return gbTownModel(id); } catch (_) { return null; } })();
        return citySchemeNewCityTemplate(id, town, cfg);
      });
    state.citySchemeRows = parsed.rows;
    state.citySchemePairs = paired;
    state.citySchemeNewTowns = newTowns;
    state.citySchemeNotes = { fingerprint: fp, at: Date.now(), raw, unparseable: parsed.unparseable };
    save(STORE.CITY_SCHEME_NOTES, state.citySchemeNotes);
    save(STORE.CITY_SCHEME_ROWS, parsed.rows);
    save(STORE.CITY_SCHEME_PAIRS, paired);
    citySchemeLast = { at: Date.now(), fingerprint: citySchemeFingerprint(parsed.rows), rows: parsed.rows.length, pairs: Object.keys(paired.groups).length };
    return true;
  }

  function citySchemeRender(host, rerender) {
    if (!host) return;
    const wrap = document.createElement('details');
    wrap.className = 'gb-section'; wrap.open = false;
    const summary = document.createElement('summary');
    summary.textContent = 'Esquema de ciudades (Notas)';
    wrap.appendChild(summary);
    const body = document.createElement('div');
    body.className = 'gb-section-body';
    body.style.cssText = 'font-size:9px;overflow:auto;display:grid;gap:4px';
    wrap.appendChild(body);

    const cfg = citySchemeCfg();
    const rows = Array.isArray(state.citySchemeRows) ? state.citySchemeRows : [];
    const pairs = state.citySchemePairs || { groups: {}, deltas: [] };
    const notes = state.citySchemeNotes || {};

    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center';
    const recalc = gbButton('Recalcular', { title:'Vuelve a leer Notas y recalcula', style:'font-size:9px', onClick:() => { citySchemeInvalidate(); citySchemeTick(); if (typeof rerender === 'function') rerender(); } });
    controls.appendChild(recalc);
    const enabledLabel = document.createElement('label');
    enabledLabel.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:9px';
    const enabledCb = document.createElement('input'); enabledCb.type = 'checkbox'; enabledCb.checked = cfg.enabled;
    enabledCb.addEventListener('change', () => { citySchemeSetCfg({ enabled: enabledCb.checked }); if (typeof rerender === 'function') rerender(); });
    enabledLabel.appendChild(enabledCb);
    enabledLabel.appendChild(document.createTextNode('asesor activo'));
    controls.appendChild(enabledLabel);
    body.appendChild(controls);

    const lastAt = citySchemeLast && citySchemeLast.at ? new Date(citySchemeLast.at).toLocaleTimeString() : '—';
    const meta = document.createElement('div'); meta.style.cssText = 'color:#888;font-size:9px';
    meta.textContent = 'filas: ' + rows.length + ' · pares: ' + Object.keys(pairs.groups || {}).length + ' · última: ' + lastAt + (citySchemeLast && citySchemeLast.unreadable ? ' · Notas no legible' : '');
    body.appendChild(meta);

    if (notes.unparseable && notes.unparseable.length) {
      const warn = document.createElement('div'); warn.style.cssText = 'color:#c66;font-size:9px';
      warn.textContent = 'líneas no reconocidas: ' + notes.unparseable.length;
      body.appendChild(warn);
    }

    const header = document.createElement('div');
    header.style.cssText = 'display:grid;grid-template-columns:1.2fr .9fr .9fr .9fr 1fr 1fr .6fr .6fr;gap:3px;color:#888;border-bottom:1px solid #333;padding:2px';
    ['ciudad','rol','mítico','dios','recluta','transporte','granjas','estado'].forEach(t => { const el = document.createElement('span'); el.textContent = t; header.appendChild(el); });
    body.appendChild(header);

    if (!rows.length) {
      const empty = document.createElement('div'); empty.style.cssText = 'color:#888;font-size:9px;padding:4px';
      empty.textContent = 'Sin filas. Abre la ventana Notas en el juego y vuelve a Recalcular.';
      body.appendChild(empty);
    }
    for (const r of rows) {
      const line = document.createElement('div');
      line.style.cssText = 'display:grid;grid-template-columns:1.2fr .9fr .9fr .9fr 1fr 1fr .6fr .6fr;gap:3px;border-bottom:1px solid #222;padding:2px;align-items:center';
      const name = (() => { try { const t = gbTownModel(r.id); return (t && typeof t.getName === 'function' ? t.getName() : (t && t.name) || r.id); } catch (_) { return r.id; } })();
      const recruitSummary = Object.entries(r.recruit || {}).map(([k,v]) => k + ':' + (v == null ? '—' : v)).join(' ') || '—';
      const transportSummary = Object.entries(r.transportNeeded || {}).map(([k,v]) => k + ':' + v).join(' ') || '—';
      const pairing = r.pairing === 'ok' ? 'par ok' : r.pairing === 'under' ? 'falta par' : r.pairing === 'over' ? 'sobra par' : '—';
      const cells = [name, r.role || '—', r.mythical || '—', r.god || '—', recruitSummary, transportSummary, r.farmLevelsBuildable == null ? '—' : String(r.farmLevelsBuildable), pairing];
      cells.forEach(value => { const el = document.createElement('span'); el.textContent = value; line.appendChild(el); });
      body.appendChild(line);
    }

    const deltas = (pairs.deltas || []);
    if (deltas.length) {
      const head = document.createElement('div'); head.style.cssText = 'margin-top:6px;color:#aaa;font-size:9px';
      head.textContent = 'Propuestas de apareamiento';
      body.appendChild(head);
      for (const d of deltas) {
        const row = document.createElement('div'); row.style.cssText = 'color:#bbb;font-size:9px;padding:2px';
        if (d.kind === 'add-mate') row.textContent = '+ añade un par para ' + d.god + ' · ' + d.mythical + ' (actual ' + d.currentCount + '/' + d.targetCount + ')';
        else if (d.kind === 'demote') row.textContent = '- sobra ' + d.mythical + ' (' + d.god + '): mantén ' + d.keep.join(', ') + ', reasigna ' + d.demote.map(x => x.hint + '→ataque tierra').join(', ');
        body.appendChild(row);
      }
    }

    const newTowns = (state.citySchemeNewTowns || []);
    if (newTowns.length) {
      const head = document.createElement('div'); head.style.cssText = 'margin-top:6px;color:#aaa;font-size:9px';
      head.textContent = 'Ciudades nuevas (líneas para Notas)';
      body.appendChild(head);
      const list = document.createElement('div'); list.style.cssText = 'font-size:9px;display:flex;flex-direction:column;gap:2px';
      newTowns.forEach(t => {
        const row = document.createElement('div'); row.textContent = t.line + (t.threatened ? '   (amenaza)' : '   (nueva)');
        list.appendChild(row);
      });
      body.appendChild(list);
    }

    host.appendChild(wrap);
  }

  // Surface for headless smoke + agent inspection.
  window.__grepbotTest = window.__grepbotTest || {};
  window.__grepbotTest.citySchemeTick = citySchemeTick;
  window.__grepbotTest.citySchemeCfg = citySchemeCfg;
  window.__grepbotTest.citySchemeRender = citySchemeRender;
  window.__grepbotTest.citySchemeNotesScrape = citySchemeNotesScrape;
  window.__grepbotTest.citySchemeTokenize = citySchemeTokenize;
  window.__grepbotTest.citySchemeTownMap = citySchemeTownMap;
  window.__grepbotTest.citySchemeResolveTownId = citySchemeResolveTownId;
  window.__grepbotTest.CITY_SCHEME_KEYWORDS = CITY_SCHEME_KEYWORDS;
  window.__grepbotTest.CITY_SCHEME_MYTHICAL_GOD = CITY_SCHEME_MYTHICAL_GOD;
  window.__grepbotTest.citySchemeParse = citySchemeParse;
  window.__grepbotTest.citySchemePairing = citySchemePairing;
  window.__grepbotTest.citySchemeBuildRow = citySchemeBuildRow;
  window.__grepbotTest.citySchemeRecruitPlan = citySchemeRecruitPlan;
  window.__grepbotTest.citySchemeNewCityTemplate = citySchemeNewCityTemplate;
  window.__grepbotTest.citySchemeFingerprint = citySchemeFingerprint;
  window.__grepbotTest.tryGetTown = tryGetTown;
