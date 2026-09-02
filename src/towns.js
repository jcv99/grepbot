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
      const t = gbTownModel(id);
      if (!t || !t.resources) return null;
      const r = t.resources();
      if (!r || r.wood == null) return null;
      return r;
    } catch (_) { return null; }
  }
  const TOWN_LIST_GUESSES = ['get_towns', 'towns_overview', 'get_owned_towns', 'overview_towns', 'town_list'];

  function townLadder(guesses, learned) { return xhrGuessLadder(guesses, learned); }
  function townLearnAction(key, storeKey, action) {
    if (!action || state[key] === action) return;
    const had = state[key];
    state[key] = action;
    save(storeKey, action);
    gbLog(had ? `towns endpoint = ${action} (was ${had})` : `towns endpoint = ${action}`);
  }
  function fetchOwnedTowns(i = 0, pressureRetries = 0) {
    if (!gbInstanceAlive() || !hostEnabled() || automationPaused({})) return;
    if (!state.csrf) return;
    const ladder = townLadder(TOWN_LIST_GUESSES, state.townListAction);
    if (i >= ladder.length) { scrapeTownsDom(); return; }
    const action = ladder[i];
    const params = new URLSearchParams();
    params.set('action', action); params.set('h', state.csrf);
    const u = '/index.php?' + params.toString();
    gbXhr({
      method: 'GET', url: u, budget: 'scrape',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      onload(res) {
        const retryMs = httpRetryAfterMs(res);
        if (retryMs) {
          if (pressureRetries >= 3) {
            gbLogT('towns-http-limit', 60000, `towns list HTTP ${res.status}, retry limit reached`);
            return;
          }
          gbLogT('towns-http', 30000, `towns list HTTP ${res.status}, retry ${pressureRetries + 1}/3 in ${retryMs}ms`);
          gbTimeout(() => fetchOwnedTowns(i, pressureRetries + 1), retryMs);
          return;
        }
        if (res.status && res.status >= 400) return fetchOwnedTowns(i + 1, 0);
        const body = (res.responseText || '').slice(0, 2000);
        if (!body || body[0] !== '{') return fetchOwnedTowns(i + 1, 0);
        try {
          const data = JSON.parse(res.responseText);
          const json = (data && data.json) ? data.json : data;
          const list = extractTowns(json);
          if (list && list.length) {
            state.towns = list;
            save(STORE.TOWNS, state.towns);
            renderWorld();
            townLearnAction('townListAction', STORE.TOWN_LIST_ACTION, action);
            console.info('[grepbot] towns:', list.length, 'via', action);
            return;
          }
        } catch (e) {  }
        fetchOwnedTowns(i + 1, 0);
      },
      onerror(e) {

        const why = e && e.error ? String(e.error) : '';
        if (why === 'budget' || why === 'disabled' || why === 'disposed') return;
        fetchOwnedTowns(i + 1, 0);
      },
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
  function fetchTownResources(town, onDone) {
    const TOWN_ACTION_GUESSES = ['town_info', 'get_town_info', 'town_overview', 'overview_towns', 'get_resources', 'resource_header'];
    let pressureRetries = 0;
    let finished = false;
    const finish = (ok) => { if (finished) return; finished = true; if (onDone) onDone(!!ok); };
    const ladder = townLadder(TOWN_ACTION_GUESSES, state.townAction);
    tryGuess(town, 0);
    function tryGuess(town, i) {
      if (!hostEnabled() || automationPaused({}) || !gbInstanceAlive()) return finish(false);
      if (i >= ladder.length) {
        state.townResources[town.id] = { ts: Date.now(), ok: false, err: 'no endpoint' };
        saveSoon(STORE.TOWN_RES, state.townResources); renderWorldSoon(); finish(false); return;
      }
      const action = ladder[i];
      const params = new URLSearchParams();
      params.set('action', action); params.set('town_id', town.id); params.set('h', state.csrf || '');
      gbXhr({
        method: 'GET', url: '/index.php?' + params.toString(), budget: 'scrape',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }, anonymous: false,
        onload(res) {
          const retryMs = httpRetryAfterMs(res);
          if (retryMs) {
            if (++pressureRetries > 3) {
              state.townResources[town.id] = { ts: Date.now(), ok: false, err: 'HTTP retry cap ' + res.status };
              saveSoon(STORE.TOWN_RES, state.townResources); renderWorldSoon(); finish(false); return;
            }
            gbLogT('town-res-http', 30000, `town ${town.id} HTTP ${res.status}, retry ${retryMs}ms`);
            gbTimeout(() => tryGuess(town, i), retryMs); return;
          }
          pressureRetries = 0;
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
            saveSoon(STORE.TOWN_RES, state.townResources); renderWorldSoon();
            townLearnAction('townAction', STORE.TOWN_ACTION, action);
            finish(true);
          } catch (_) { tryGuess(town, i + 1); }
        },
        onerror(e) {
          const why = e && e.error ? String(e.error) : '';
          if (why === 'disabled' || why === 'budget' || why === 'disposed') return finish(false);
          tryGuess(town, i + 1);
        },
      });
    }
  }
  function scrapeAllTowns() {
    if (!hostEnabled() || automationPaused({})) return;
    if (gbLocked('town-scrape')) { gbLogT('town-scrape-inflight', 30000, 'town scrape: skipped (in flight)'); return; }
    const townScrapeLock = gbLock('town-scrape', 300000);
    if (!townScrapeLock) return;
    const delay = SYNC.TOWN_MIN_MS + Math.random() * (SYNC.TOWN_MAX_MS - SYNC.TOWN_MIN_MS);
    state.nextTownsScrape = Date.now() + delay; save(STORE.NEXT_TOWNS, state.nextTownsScrape); renderTimers();
    const finish = (fromGame, fromHttp) => {
      gbUnlock('town-scrape', townScrapeLock);
      const ids = state.towns.map(t => t.id);
      pruneMapsToIds(state.townResources, ids); save(STORE.TOWN_RES, state.townResources);

      try { townGrowthSample(ids); } catch (_) {}
      renderWorld();
      gbLog(`towns scrape: ${state.towns.length} towns (${fromGame} via game data, ${fromHttp} via HTTP)`);
    };
    const gameTowns = townsFromGame();
    if (gameTowns && gameTowns.length) {
      if (gameTowns.length !== state.towns.length) gbLog(`towns: ${gameTowns.length} from game data`);
      state.towns = gameTowns; save(STORE.TOWNS, state.towns);
    } else if (!state.towns.length) {
      gbLogT('towns-fallback', 300000, 'towns: game data unavailable, HTTP fallback');
      fetchOwnedTowns();
      finish(0, 0);
      return;
    }
    let fromGame = 0;
    const http = [];
    for (const t of state.towns) {
      const r = townResourcesFromGame(t.id);
      if (r) {
        fromGame++;
        state.townResources[t.id] = {
          ts: Date.now(), wood: r.wood ?? null, stone: r.stone ?? null, iron: r.iron ?? null,
          pop: r.population ?? null, cap: r.storage ?? null, ok: true, action: 'game-data',
        };
      } else http.push(t);
    }
    if (!http.length) { finish(fromGame, 0); return; }
    let pending = http.length, completed = 0;
    http.forEach((t, i) => {
      gbTimeout(() => {
        if (!gbLockTouch('town-scrape', townScrapeLock, 300000)) return;
        fetchTownResources(t, () => {
          completed++; pending--;
          gbLockTouch('town-scrape', townScrapeLock, 300000);
          if (pending <= 0) finish(fromGame, completed);
        });
      }, i * 650);
    });
  }
