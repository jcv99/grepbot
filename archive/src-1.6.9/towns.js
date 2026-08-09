  // ---------- owned towns ----------
  // Prefer the game's own collections - zero requests, always correct.
  function townsFromGame() {
    try {
      const col = mmCol('Town');
      if (!col || !col.models || !col.models.length) return null;
      return col.models.map(m => {
        const a = m.attributes || {};
        return { id: String(a.id), name: a.name || null, x: a.island_x ?? null, y: a.island_y ?? null, island: a.island_id ?? null };
      });
    } catch (e) { return null; }
  }
  function townResourcesFromGame(id) {
    const uw = gameUw();
    try {
      const t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(id) : uw.ITowns.towns[id]);
      if (!t || !t.resources) return null;
      const r = t.resources();
      if (!r || r.wood == null) return null;
      return r;
    } catch (_) { return null; }
  }
  const TOWN_LIST_GUESSES = ['get_towns', 'towns_overview', 'get_owned_towns', 'overview_towns', 'town_list'];
  function fetchOwnedTowns(i = 0) {
    if (!state.csrf) return;
    if (captchaPaused('town') || (captchaGlobalUntil && Date.now() < captchaGlobalUntil)) return;
    if (i >= TOWN_LIST_GUESSES.length) { scrapeTownsDom(); return; }
    const action = TOWN_LIST_GUESSES[i];
    const params = new URLSearchParams();
    params.set('action', action); params.set('h', state.csrf);
    const u = '/index.php?' + params.toString();
    gbXhr({
      method: 'GET', url: u,
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      onload(res) {
        const retryMs = httpRetryAfterMs(res);
        if (retryMs) {
          gbLogT('towns-http', 30000, `towns list HTTP ${res.status}, retry ${retryMs}ms`);
          gbTimeout(() => fetchOwnedTowns(i), retryMs);
          return;
        }
        if (res.status && res.status >= 400) return fetchOwnedTowns(i + 1);
        const body = (res.responseText || '').slice(0, 2000);
        if (!body || body[0] !== '{') return fetchOwnedTowns(i + 1);
        try {
          const data = JSON.parse(res.responseText);
          const json = (data && data.json) ? data.json : data;
          const list = extractTowns(json);
          if (list && list.length) {
            state.towns = list;
            save(STORE.TOWNS, state.towns);
            renderWorld();
            console.info('[grepbot] towns:', list.length, 'via', action);
            return;
          }
        } catch (e) { /* try next */ }
        fetchOwnedTowns(i + 1);
      },
      onerror() { fetchOwnedTowns(i + 1); },
    });
  }
  function extractTowns(json) {
    if (!json) return null;
    const out = [];
    const tryArr = (arr) => {
      if (!Array.isArray(arr)) return false;
      for (const t of arr) {
        if (!t || typeof t !== 'object') continue;
        const id = t.id ?? t.town_id;
        if (!id) continue;
        out.push({ id: String(id), name: t.name || null, x: t.x ?? null, y: t.y ?? null, island: t.island_id ?? null });
      }
      return out.length > 0;
    };
    if (tryArr(json)) return out;
    if (tryArr(json.towns)) return out;
    if (tryArr(json.owned_towns)) return out;
    const walk = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) { obj.forEach(walk); return; }
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (k === 'towns' && Array.isArray(v)) tryArr(v);
        else if (v && typeof v === 'object') walk(v);
      }
    };
    walk(json);
    return out.length ? out : null;
  }
  function scrapeTownsDom() {
    document.querySelectorAll('[data-townid], a[data-town-id]').forEach(a => {
      const id = a.getAttribute('data-townid') || a.getAttribute('data-town-id');
      if (!id || state.towns.find(t => t.id === id)) return;
      state.towns.push({ id: String(id), name: (a.textContent || '').trim() || null });
    });
    save(STORE.TOWNS, state.towns);
    renderWorld();
  }
  function fetchTownResources(town) {
    if (captchaPaused('town') || (captchaGlobalUntil && Date.now() < captchaGlobalUntil)) return;
    const TOWN_ACTION_GUESSES = ['town_info', 'get_town_info', 'town_overview', 'overview_towns', 'get_resources', 'resource_header'];
    tryGuess(town, 0);
    function tryGuess(town, i) {
      if (captchaPaused('town') || (captchaGlobalUntil && Date.now() < captchaGlobalUntil)) return;
      if (i >= TOWN_ACTION_GUESSES.length) {
        state.townResources[town.id] = { ts: Date.now(), ok: false, err: 'no endpoint' };
        save(STORE.TOWN_RES, state.townResources);
        renderWorld();
        return;
      }
      const action = TOWN_ACTION_GUESSES[i];
      const params = new URLSearchParams();
      params.set('action', action); params.set('town_id', town.id); params.set('h', state.csrf);
      const u = '/index.php?' + params.toString();
      gbXhr({
        method: 'GET', url: u,
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        anonymous: false,
        onload(res) {
          const retryMs = httpRetryAfterMs(res);
          if (retryMs) {
            gbLogT('town-res-http', 30000, `town ${town.id} HTTP ${res.status}, retry ${retryMs}ms`);
            gbTimeout(() => tryGuess(town, i), retryMs);
            return;
          }
          if (res.status && res.status >= 400) return tryGuess(town, i + 1);
          const body = (res.responseText || '').slice(0, 500);
          if (!body || body[0] !== '{' || /<html/i.test(body)) return tryGuess(town, i + 1);
          try {
            const p = parseResourceJson(JSON.parse(res.responseText));
            if (!p.got) return tryGuess(town, i + 1);
            state.townResources[town.id] = {
              ts: Date.now(), wood: p.wood, stone: p.stone, iron: p.iron,
              pop: p.pop, cap: p.cap, ok: true, action,
            };
            save(STORE.TOWN_RES, state.townResources);
            renderWorld();
          } catch (e) { tryGuess(town, i + 1); }
        },
        onerror() { tryGuess(town, i + 1); },
      });
    }
  }
  function scrapeAllTowns() {
    if (!hostEnabled() || automationPaused({}) || captchaPaused('town')) return;
    if (gbLocked('town-scrape')) { gbLogT('town-scrape-inflight', 30000, 'town scrape: skipped (in flight)'); return; }
    gbLock('town-scrape');
    const delay = SYNC.TOWN_MIN_MS + Math.random() * (SYNC.TOWN_MAX_MS - SYNC.TOWN_MIN_MS);
    state.nextTownsScrape = Date.now() + delay;
    save(STORE.NEXT_TOWNS, state.nextTownsScrape);
    renderTimers();
    try {
      const gameTowns = townsFromGame();
      if (gameTowns && gameTowns.length) {
        if (gameTowns.length !== state.towns.length) gbLog(`towns: ${gameTowns.length} from game data`);
        state.towns = gameTowns;
        save(STORE.TOWNS, state.towns);
      } else if (!state.towns.length) {
        gbLogT('towns-fallback', 300000, 'towns: game data unavailable, HTTP fallback');
        fetchOwnedTowns();
      }
      let fromGame = 0, fromHttp = 0;
      state.towns.forEach((t, i) => {
        const r = townResourcesFromGame(t.id);
        if (r) {
          fromGame++;
          state.townResources[t.id] = {
            ts: Date.now(), wood: r.wood ?? null, stone: r.stone ?? null, iron: r.iron ?? null,
            pop: r.population ?? null, cap: r.storage ?? null, ok: true, action: 'game-data',
          };
        } else if (hostEnabled() && !automationPaused({}) && !captchaPaused('town')) {
          fromHttp++;
          gbTimeout(() => fetchTownResources(t), fromHttp * 600);
        }
      });
      const ids = state.towns.map(t => t.id);
      pruneMapsToIds(state.townResources, ids);
      save(STORE.TOWN_RES, state.townResources);
      renderWorld();
      gbLog(`towns scrape: ${state.towns.length} towns (${fromGame} via game data, ${fromHttp} via HTTP)`);
    } finally {
      // HTTP fetches may still be in flight; unlock after staggered window
      gbTimeout(() => { gbUnlock('town-scrape'); }, Math.max(2000, state.towns.length * 700));
    }
  }

