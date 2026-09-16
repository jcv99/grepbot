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
