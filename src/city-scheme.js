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
    const mythicalKey = mapped.mythical && cfgGods && cfgGods[mapped.mythical] ? mapped.mythical : mapped.mythical;
    const god = (mapped.god || (mythicalKey && CITY_SCHEME_MYTHICAL_GOD[mythicalKey]) || (cfgGods && mythicalKey && cfgGods[mythicalKey])) || null;
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
    if (row.transport === 'trireme' && !row.mythical) recruit.trireme = 8;

    const coast = roleAdvisorCoast(tryGetTown(row.id));
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

  function citySchemeTick() {
    const cfg = citySchemeCfg();
    if (!cfg.enabled) return false;
    // Heavy lifting in Task 6.
    return true;
  }

  function citySchemeRender(host, rerender) {
    if (!host) return;
    // UI in Task 6.
    const wrap = document.createElement('details');
    wrap.className = 'gb-section'; wrap.open = false;
    const summary = document.createElement('summary');
    summary.textContent = 'Esquema de ciudades (Notas)';
    wrap.appendChild(summary);
    const body = document.createElement('div');
    body.className = 'gb-section-body';
    body.style.cssText = 'font-size:9px;overflow:auto';
    body.textContent = 'Cargando...';
    wrap.appendChild(body);
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
  window.__grepbotTest.tryGetTown = tryGetTown;
