// GrepBot -> grepolis-mcp localhost relay (v1.0.0+).
  //
  // Opens an outbound WebSocket to ws://127.0.0.1:8731 from the world tab.
  // GrepBot never runs a server (CLAUDE.md: NO SERVER). The browser tab is
  // always the *client* of this socket. The MCP server (separate process)
  // owns the loopback port and listens.
  //
  // Wire protocol (newline-free JSON):
  //   browser -> server  {"type":"hello", "kind":"hello", "payload":{...}}
  //   browser -> server  {"type":"data",  "kind":<k>,    "payload":<obj>}
  //   server -> browser  {"type":"request","kind":<k>}
  //   browser -> server  {"type":"ack"}
  //
  // Kinds pushed: farms, towns, player, queues. GrepBot state already
  // collects `state.farmsParsed`; relay pushes a denormalised row so the MCP
  // server can normalise without running game logic.
  (function () {
    'use strict';
    const RELAY_URL = 'ws://127.0.0.1:8731';
    const NS = 'gb-relay';
    const TICK_MS = 15000;
    const RETRY_MS = 4000;
    const PING_MS = 25000;

    function uw() {
      try { return (typeof unsafeWindow !== 'undefined' && unsafeWindow) || window; } catch (_) { return window; }
    }

    function safe(fn, fb) {
      try { return fn(); } catch (_) { return fb; }
    }

    function isWorldPage() {
      try { return /\/game\//.test(location.href); } catch (_) { return false; }
    }

    function getState(u) {
      // GrepBot's `state` is the module-scope variable in core.js. It's not
      // exposed on unsafeWindow, so we mirror what farms.js reads: scrape the
      // backbone collections the SPA loads at world render.
      return safe(() => {
        if (u && u.__gbState) return u.__gbState;
        return null;
      }, null);
    }

    function snapshotFarms(u) {
      return safe(() => {
        const MM = u.MM;
        if (!MM || typeof MM.getOnlyCollectionByName !== 'function') return null;
        const col = MM.getOnlyCollectionByName('FarmTownPlayerRelation');
        if (!col || !col.length) return null;
        const rows = [];
        for (let i = 0; i < col.length; i++) {
          const r = col.at ? col.at(i) : col.models[i];
          if (!r) continue;
          const relation_id = +r.id;
          if (!relation_id) continue;
          rows.push({
            relation_id,
            farm_town_id: safe(() => r.getFarmTownId && r.getFarmTownId(), null),
            town_id: safe(() => r.getTownId && r.getTownId(), null),
            island_id: safe(() => r.getIslandId && r.getIslandId(), null),
            lootable_at: safe(() => r.getLootableAt && r.getLootableAt(), null),
            relation_status: safe(() => r.getRelationStatus && r.getRelationStatus(), null),
            expansion_stage: safe(() => r.getExpansionStage && r.getExpansionStage(), null),
            name: safe(() => r.getName && r.getName(), null),
          });
        }
        return { at: Date.now(), count: rows.length, rows };
      }, null);
    }

    function snapshotTowns(u) {
      return safe(() => {
        const IT = u.ITowns;
        if (!IT) return null;
        const out = { at: Date.now(), rows: [] };
        const towns = IT.towns || (typeof IT.getTowns === 'function' ? IT.getTowns() : null);
        if (!towns) return out;
        const ids = Array.isArray(towns) ? towns.map(t => t && t.id).filter(Boolean) : Object.keys(towns);
        for (const id of ids) {
          const t = (typeof IT.getTown === 'function') ? IT.getTown(id) : (IT.towns && IT.towns[id]);
          if (!t) continue;
          const res = safe(() => t.resources && t.resources(), null);
          out.rows.push({
            id: +id,
            name: safe(() => t.getName && t.getName(), null),
            island_id: safe(() => t.getIslandId && t.getIslandId(), null),
            points: safe(() => t.getPoints && t.getPoints(), null),
            population: safe(() => t.getPopulation && t.getPopulation(), null),
            wood: res && res.wood != null ? +res.wood : null,
            stone: res && res.stone != null ? +res.stone : null,
            iron: res && res.iron != null ? +res.iron : null,
            capacity: safe(() => +t.getStorageCapacity && +t.getStorageCapacity(), null),
          });
        }
        return out;
      }, null);
    }

    function snapshotPlayer(u) {
      return safe(() => {
        const G = u.Game;
        if (!G) return null;
        const pick = (k) => (G[k] != null ? G[k] : null);
        return {
          at: Date.now(),
          // Which build is actually live in the tab -- otherwise a stale
          // Tampermonkey install is invisible from the MCP side.
          gb_version: safe(() => runningVersion(), null),
          player_id: pick('player_id'),
          player_name: pick('player_name'),
          alliance_id: pick('alliance_id'),
          world: pick('market_id'),
          locale: pick('locale_lang'),
          game_speed: pick('game_speed'),
          player_points: pick('player_points'),
          player_rank: pick('player_rank'),
          player_villages: pick('player_villages'),
          premium_features: pick('features'),
          gods_active: pick('gods_active'),
          csrf_token: pick('csrfToken'),
          master_url: pick('master_url'),
        };
      }, null);
    }

    function snapshotBp(u) {
      // Battle points ("puntos de combate"). Source of truth is the in-page
      // DOM node the topbar uses -- safer than relying on a backbone method
      // that varies across client builds. Falls back to Player model method.
      return safe(() => {
        const node = document.querySelector(
          '.nui_battlepoints_container .points'
        );
        const txt = node && node.textContent ? node.textContent.trim() : null;
        if (txt) {
          const n = parseInt(txt.replace(/\s+/g, ''), 10);
          if (Number.isFinite(n)) return { at: Date.now(), bp: n };
        }
        // Backbone fallback
        const MM = u.MM;
        if (MM && typeof MM.getOnlyModelByName === 'function') {
          const pl = MM.getOnlyModelByName('Player');
          if (pl) {
            const fn = pl.getBattlePoints || pl.getHonor || pl.getPoints;
            if (typeof fn === 'function') {
              const v = parseInt(fn.call(pl), 10);
              if (Number.isFinite(v)) return { at: Date.now(), bp: v };
            }
          }
        }
        return { at: Date.now(), bp: null, hint: 'BP not visible yet -- open world map first' };
      }, { at: Date.now(), bp: null });
    }

    const MAP_CHUNK_RADIUS = 2;   // (2*2+1)^2 = 25 chunks around own town
    const MAP_TOWN_CAP = 400;

    function mapTownRow(t, ownPlayerId) {
      // Chunk towns are plain server JSON, so copy the scalars wholesale
      // rather than guessing at field names -- the MCP side picks what it
      // needs and a renamed field shows up as data instead of as null.
      const row = {};
      for (const k in t) {
        if (!Object.prototype.hasOwnProperty.call(t, k)) continue;
        const v = t[k];
        const ty = typeof v;
        if (v === null || ty === 'number' || ty === 'string' || ty === 'boolean') row[k] = v;
      }
      if (ownPlayerId != null && row.player_id != null) row.own = (+row.player_id === +ownPlayerId);
      return row;
    }

    function snapshotMap(u) {
      // Towns the client has actually loaded, read out of WMap's chunk cache.
      //
      // There is no `WMap.getTowns` in the live client (checked against
      // archive/captures/grepo-dump/js/game.min.js) -- the earlier version of
      // this function called it, always threw, and shipped an empty list that
      // looked like "no enemies nearby". The real accessors are
      // `WMap.toChunk(x,y)` / `WMap.mapData.getChunk(cx,cy)`, and each chunk
      // carries a `towns` map of server JSON.
      //
      // Only chunks the SPA has already fetched are readable, so this stays
      // best-effort: `chunks_read` / `chunks_missing` make an empty result
      // diagnosable instead of silently meaning "nothing there".
      // NEVER return null here. A null is not pushed by tick(), so the MCP
      // side cannot tell "this threw" from "never sent" -- both read as
      // relay offline for the `map` kind, with no way to see why. Always
      // return the envelope and carry the failure in `error`.
      const out = {
        at: Date.now(), towns: [], source: null,
        chunks_read: 0, chunks_missing: 0, center: null,
        error: null, has: {},
      };
      try {
        const W = u.WMap;
        const IT = u.ITowns;
        const ownPlayerId = safe(() => +u.Game.player_id, null);

        // What the page actually exposes -- so an empty result names the
        // missing accessor instead of being indistinguishable from "no towns".
        out.has = {
          WMap: !!W,
          mapData: !!(W && W.mapData),
          getChunk: !!(W && W.mapData && typeof W.mapData.getChunk === 'function'),
          toChunk: !!(W && typeof W.toChunk === 'function'),
          findTownInChunks: !!(W && W.mapData && typeof W.mapData.findTownInChunks === 'function'),
          ITowns: !!(IT && typeof IT.getTowns === 'function'),
          townId: safe(() => u.Game.townId, null),
        };

        const md = W && W.mapData;
        const canChunk = md && typeof md.getChunk === 'function'
          && W && typeof W.toChunk === 'function';
        if (canChunk) {
          // Center on the current town; findTownInChunks is the client's own
          // way of resolving it to island coords.
          let center = safe(() => md.findTownInChunks(u.Game.townId), null);
          if (center && center.x != null && center.y != null) {
            const c = safe(() => W.toChunk(+center.x, +center.y), null);
            if (c && c.chunk) {
              out.center = { x: +center.x, y: +center.y, chunk: c.chunk };
              const seen = Object.create(null);
              for (let dx = -MAP_CHUNK_RADIUS; dx <= MAP_CHUNK_RADIUS; dx++) {
                for (let dy = -MAP_CHUNK_RADIUS; dy <= MAP_CHUNK_RADIUS; dy++) {
                  const cx = c.chunk.x + dx, cy = c.chunk.y + dy;
                  if (cx < 0 || cy < 0) continue;
                  // getChunk dereferences a sparse array and throws on a chunk
                  // the SPA has not fetched -- that is "not loaded", not an error.
                  const chunk = safe(() => md.getChunk(cx, cy), null);
                  if (!chunk || !chunk.towns || chunk.loading === true) { out.chunks_missing++; continue; }
                  out.chunks_read++;
                  for (const k in chunk.towns) {
                    if (!Object.prototype.hasOwnProperty.call(chunk.towns, k)) continue;
                    const t = chunk.towns[k];
                    if (!t || !t.id || seen[t.id]) continue;
                    // The client separates real towns from farm villages and
                    // free spots by these two fields (see mapData.getTown /
                    // getTownType); a farm village is not an attack target
                    // for battle points.
                    if (t.expansion_stage !== undefined) continue;
                    if (t.points === undefined) continue;
                    seen[t.id] = 1;
                    out.towns.push(mapTownRow(t, ownPlayerId));
                    if (out.towns.length >= MAP_TOWN_CAP) break;
                  }
                  if (out.towns.length >= MAP_TOWN_CAP) break;
                }
                if (out.towns.length >= MAP_TOWN_CAP) break;
              }
              if (out.towns.length) out.source = 'wmap-chunks';
            }
          }
        }

        // Fall back to own towns only -- never a target list, but it keeps
        // live_map answering something when the map has not rendered.
        if (!out.towns.length && IT && typeof IT.getTowns === 'function') {
          try {
            for (const t of IT.getTowns()) {
              if (!t) continue;
              out.towns.push({
                id: +t.id,
                name: typeof t.getName === 'function' ? t.getName() : null,
                player_id: ownPlayerId,
                points: typeof t.getPoints === 'function' ? t.getPoints() : null,
                own: true,
              });
            }
            if (out.towns.length) out.source = 'itowns-own-only';
          } catch (_) {}
        }
      } catch (e) {
        out.error = String((e && e.message) || e);
      }
      return out;
    }

    function snapshotQueues(u) {
      // GrepBot's native queue state. The minimal shape the LLM needs:
      // build / research / recruit / recruitNaval per-town plan lists.
      return safe(() => {
        if (!u.nativeQueue) return null;
        const nq = u.nativeQueue;
        const roots = [];
        // The native queue root structure varies across GrepBot versions.
        // Accept either {seq, towns} or the legacy abCustomQueue list.
        if (nq.roots && Array.isArray(nq.roots)) {
          for (const r of nq.roots) roots.push(r);
        } else if (nq.towns) {
          for (const k of Object.keys(nq.towns)) roots.push(nq.towns[k]);
        } else if (typeof nq === 'object') {
          for (const k of Object.keys(nq)) {
            const v = nq[k];
            if (v && typeof v === 'object') roots.push(v);
          }
        }
        return { at: Date.now(), roots };
      }, null);
    }

    function buildSnapshot(u) {
      return {
        farms: snapshotFarms(u),
        towns: snapshotTowns(u),
        player: snapshotPlayer(u),
        queues: snapshotQueues(u),
        bp: snapshotBp(u),
        map: snapshotMap(u),
      };
    }

    let ws = null;
    let reconnectTimer = 0;
    let pingTimer = 0;
    let tickTimer = 0;
    let lastTick = 0;
    let inFlight = false;
    let lastSnapshot = { farms: null, towns: null, player: null, queues: null };
    let statusTimer = 0;

    // -- header pill -------------------------------------------------------
    // The panel header carries #gb-head-ai. relay.js owns it: it is the only
    // module that knows the socket state. The pill may not exist yet (boot
    // order, panel not built, collapsed) -- every write is a no-op then.
    const AI_STATES = {
      off:  { icon: '○', cls: '',     txt: 'IA sin conexion' },
      wait: { icon: '◐', cls: 'warn', txt: 'IA conectando' },
      on:   { icon: '●', cls: 'ok',   txt: 'IA conectada' },
    };

    function aiState() {
      if (!ws) return 'off';
      if (ws.readyState === 0) return 'wait';
      if (ws.readyState === 1) return 'on';
      return 'off';
    }

    function paintAi() {
      const el = safe(() => document.querySelector('#gb-head-ai'), null);
      if (!el) return;
      const key = aiState();
      const s = AI_STATES[key];
      const label = s.icon + ' IA';
      if (el.textContent !== label) el.textContent = label;
      const cls = 'gb-pill' + (s.cls ? ' ' + s.cls : '');
      if (el.className !== cls) el.className = cls;
      let title = s.txt + ' (' + RELAY_URL + ').';
      if (key === 'on') {
        title += lastTick
          ? ' Ultimo envio hace ' + Math.round((Date.now() - lastTick) / 1000) + ' s.'
          : ' Todavia sin enviar datos.';
      } else if (key === 'off') {
        title += ' Arranca el servidor MCP y espera ' + Math.round(RETRY_MS / 1000) + ' s.';
      }
      if (el.title !== title) el.title = title;
    }

    // Second pill: whether AI *writes* can execute right now. Distinct from the
    // socket pill -- a connected relay with a closed arm window is read-only,
    // and that difference is the whole safety story.
    function paintArmed() {
      const el = safe(() => document.querySelector('#gb-head-armed'), null);
      if (!el) return;
      const on = state.relayCommands === true;
      const left = relayArmLeftMs();
      let label, cls, title;
      if (!on) {
        label = '- IA-W'; cls = 'gb-pill';
        title = 'Comandos de IA desactivados. Actívalos en Ajustes > Diagnostico y datos.';
      } else if (left > 0) {
        label = '! IA-W ' + Math.ceil(left / 60000) + 'm'; cls = 'gb-pill warn';
        title = 'Ventana de escritura ABIERTA: la IA puede ejecutar acciones durante '
          + Math.ceil(left / 60000) + ' min. Quedan ' + relayWriteBudgetLeft() + ' escrituras esta hora.'
          + (state.relayRaw === true ? ' Passthrough directo ACTIVO.' : '');
      } else {
        label = '- IA-W'; cls = 'gb-pill';
        title = 'Comandos de IA activos pero sin armar: solo lectura. Pulsa "Armar IA" en Ajustes.';
      }
      if (el.textContent !== label) el.textContent = label;
      if (el.className !== cls) el.className = cls;
      if (el.title !== title) el.title = title;
    }

    function startStatusTimer() {
      if (statusTimer) return;
      statusTimer = setInterval(() => { paintAi(); paintArmed(); }, 5000);
    }

    function send(obj) {
      try {
        if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
      } catch (_) { /* drop on closed */ }
    }

    function tick() {
      if (inFlight) return;
      inFlight = true;
      try {
        const snap = buildSnapshot(uw());
        lastSnapshot = snap;
        if (snap.farms) send({ type: 'data', kind: 'farms', payload: snap.farms });
        if (snap.towns) send({ type: 'data', kind: 'towns', payload: snap.towns });
        if (snap.player) send({ type: 'data', kind: 'player', payload: snap.player });
        if (snap.queues) send({ type: 'data', kind: 'queues', payload: snap.queues });
        if (snap.bp) send({ type: 'data', kind: 'bp', payload: snap.bp });
        if (snap.map) send({ type: 'data', kind: 'map', payload: snap.map });
        lastTick = Date.now();
        paintAi();
      } finally {
        inFlight = false;
      }
    }

    function handleRequest(msg) {
      const k = msg && msg.kind;
      const u = uw();
      if (k === 'farms') lastSnapshot.farms = snapshotFarms(u);
      else if (k === 'towns') lastSnapshot.towns = snapshotTowns(u);
      else if (k === 'player') lastSnapshot.player = snapshotPlayer(u);
      else if (k === 'queues') lastSnapshot.queues = snapshotQueues(u);
      else if (k === 'bp') lastSnapshot.bp = snapshotBp(u);
      else if (k === 'map') lastSnapshot.map = snapshotMap(u);
      else { send({ type: 'ack', kind: 'unknown' }); return; }
      send({ type: 'data', kind: k, payload: lastSnapshot[k] });
    }

    // ===== AI command channel ===============================================
    //
    //   server -> browser  {type:'command', id, cmd, args}
    //   browser -> server  {type:'result',  id, cmd, ok, data, error, gate}
    //
    // Everything that touches the server goes through bridgePost /
    // gameAjaxPost, so dry run, the captcha breaker, the request budget, the
    // circuit breaker, safe mode, decision memory, the planner reservation and
    // the journal all still apply. This file adds ONE new thing: who is
    // allowed to ask, and when.
    const RELAY_ARM_MAX_MS = 60 * 60 * 1000;
    const RELAY_CMD_TIMEOUT_MS = 25000;   // > BRIDGE_TIMEOUT_MS (15s)
    const RELAY_CMD_MIN_GAP_MS = 4000;
    const RELAY_WRITE_WINDOW_MS = 60 * 60 * 1000;

    let relayWriteStamps = [];
    let relayLastWriteAt = 0;

    function relayArmLeftMs() {
      const until = +(state.relayArmUntil || 0);
      return until > Date.now() ? until - Date.now() : 0;
    }
    function relayArmed() { return relayArmLeftMs() > 0; }
    function relayArm(minutes) {
      const min = Math.max(1, Math.min(RELAY_ARM_MAX_MS / 60000, +minutes || +state.relayArmMin || 15));
      state.relayArmUntil = Date.now() + min * 60000;
      save(STORE.RELAY_ARM_UNTIL, state.relayArmUntil);
      gbLog(`relay: armed for ${min} min - AI write commands will execute`);
      paintArmed();
      return min;
    }
    function relayDisarm() {
      state.relayArmUntil = 0;
      save(STORE.RELAY_ARM_UNTIL, 0);
      gbLog('relay: disarmed - AI write commands refused');
      paintArmed();
    }
    function relayWriteBudgetLeft() {
      const cut = Date.now() - RELAY_WRITE_WINDOW_MS;
      relayWriteStamps = relayWriteStamps.filter(t => t > cut);
      return Math.max(0, (+state.relayWriteCap || 40) - relayWriteStamps.length);
    }

    function relayUnitIsTransport(id) {
      const m = safe(() => unitMeta(id), null);
      // A transport is the naval unit that CARRIES: warships have capacity 0.
      return !!(m && m.is_naval && +m.capacity > 0);
    }

    function relayFarmByVillId(villId) {
      const want = String(villId);
      return safe(() => (mergedFarms() || []).find(f => String(f.vill_id) === want), null) || null;
    }

    // Only these state flags may be flipped by `toggle`. An open-ended setter
    // would let the AI turn off the very guards below it (dryRun, safeMode,
    // captchaGlobalKill, enabledHosts) -- those are deliberately absent.
    const RELAY_TOGGLES = {
      autoFarm: STORE.AUTO_FARM, autoCave: STORE.AUTO_CAVE, autoCulture: STORE.AUTO_CULTURE,
      autoTrade: STORE.AUTO_TRADE, autoTradeRoutes: STORE.AUTO_TRADE_ROUTES, islandShip: STORE.ISLAND_SHIP,
      abAuto: STORE.AB_AUTO, autoResearch: STORE.AUTO_RESEARCH, autoRecruit: STORE.AUTO_RECRUIT,
      autoBandit: STORE.AUTO_BANDIT, autoCollect: STORE.AUTO_COLLECT, ibAuto: STORE.IB_AUTO,
      autoRuralTrade: STORE.AUTO_RURAL_TRADE, autoRuralLevel: STORE.AUTO_RURAL_LEVEL,
      autoMerchant: STORE.AUTO_MERCHANT, autoPtTrade: STORE.AUTO_PT_TRADE,
      questAutoBuild: STORE.QUEST_AUTO_BUILD, questAutoRes: STORE.QUEST_AUTO_RES,
      orchAdaptive: STORE.ORCH_ADAPTIVE,
    };

    const RELAY_SCANS = {
      orch: () => orchTick(),
      farm: () => autoClaimFarms('relay'),
      cave: () => caveScan('relay'),
      culture: () => cultureScan('relay'),
      trade: () => tradeScan('relay'),
      build: () => abScan('relay'),
      research: () => researchScan('relay'),
      recruit: () => recruitScan('relay'),
      ruraltrade: () => ruralTradeScan('relay'),
      rurallevel: () => ruralLevelScan('relay'),
      merchant: () => merchantScan('relay'),
      pttrade: () => ptTradeScan('relay'),
      wonder: () => wonderScan('relay'),
      hero: () => heroScan('relay'),
      godspell: () => godSpellScan('relay'),
      dodge: () => dodgeScan('relay'),
      support: () => supportScan('relay'),
      emergency: () => emergencyScan('relay'),
      bandit: () => banditScan(),
      quests: () => questScanTick('relay'),
      instant: () => ibScan(),
      queues: () => nativeQueueSweep('manual'),
    };

    const RELAY_LANES = { build: 1, recruit: 1, recruitNaval: 1, research: 1 };

    // Registry. `risk` decides which gates apply: read = master toggle only,
    // write = + arm window + rate limit, raw = + the relayRaw toggle.
    const RELAY_CMDS = {
      // -- read ------------------------------------------------------------
      manifest: {
        risk: 'read', doc: 'List every command with its risk class and arguments.',
        run: (a, done) => done(null, relayManifest()),
      },
      status: {
        risk: 'read', doc: 'Bot health: gates, pauses, budget, locks, arm window.',
        run: (a, done) => {
          const why = {};
          const paused = safe(() => automationPaused(why), false);
          done(null, {
            hostEnabled: safe(() => hostEnabled(), false),
            host: location.host,
            dryRun: !!state.dryRun,
            safeMode: !!state.safeMode,
            paused, pauseReason: why.reason || null,
            serverPaused: safe(() => gbServerPaused(), false),
            serverCooldownMs: safe(() => gbServerCooldownLeftMs(), 0),
            budget: safe(() => reqBudgetByScope(), null),
            budgetPerMin: +state.reqBudgetPerMin || 0,
            locks: safe(() => gbLockList(), []),
            commandsEnabled: state.relayCommands === true,
            rawEnabled: state.relayRaw === true,
            armedMs: relayArmLeftMs(),
            writesLeftThisHour: relayWriteBudgetLeft(),
            version: safe(() => runningVersion(), null),
          });
        },
      },
      snapshot: {
        risk: 'read', doc: 'Force a fresh snapshot push.', args: { kind: 'farms|towns|player|queues|bp|map' },
        run: (a, done) => {
          const k = String(a.kind || '');
          if (!/^(farms|towns|player|queues|bp|map)$/.test(k)) return done('bad-kind');
          handleRequest({ kind: k });
          done(null, lastSnapshot[k] || null);
        },
      },
      units: {
        risk: 'read', doc: 'Live units in a town, with off/def/naval class and transport flag.', args: { town_id: 'number' },
        run: (a, done) => {
          const tid = +a.town_id;
          if (!tid) return done('no-town');
          const live = safe(() => townLiveUnits(tid), {}) || {};
          const rows = Object.keys(live).map(id => ({
            id, n: +live[id] || 0,
            fn: safe(() => classifyUnitFn(id), 'unknown'),
            transport: relayUnitIsTransport(id),
          })).filter(r => r.n > 0);
          done(null, { town_id: tid, units: rows });
        },
      },
      town: {
        risk: 'read', doc: 'Resources, population, coords, building levels and real build queue.', args: { town_id: 'number' },
        run: (a, done) => {
          const tid = +a.town_id;
          if (!tid) return done('no-town');
          done(null, {
            town_id: tid,
            name: safe(() => townNameById(tid), null),
            resources: safe(() => townResState(tid), null),
            population: safe(() => gbTownPop(tid), null),
            coords: safe(() => townCoords(tid), null),
            levels: safe(() => abCurrentLevels(tid), null),
            buildQueue: safe(() => abQueueInfo(tid), null),
          });
        },
      },
      incoming: {
        risk: 'read', doc: 'Hostile incoming movements (attacks, colonisation, revolt).',
        run: (a, done) => done(null, safe(() => dodgeIncomingMovements(), []) || []),
      },
      outgoing: {
        risk: 'read', doc: 'Your own outgoing commands plus colony threats.',
        run: (a, done) => done(null, {
          movements: safe(() => militaryOutgoingMovements(), []) || [],
          colonyThreats: safe(() => militaryColonyThreats(), []) || [],
        }),
      },
      queues: {
        risk: 'read', doc: 'GrepBot virtual queue for a town.', args: { town_id: 'number', lane: 'build|recruit|recruitNaval|research (optional)' },
        run: (a, done) => {
          const tid = +a.town_id;
          if (!tid) return done('no-town');
          const lanes = a.lane ? [String(a.lane)] : Object.keys(RELAY_LANES);
          const out = {};
          for (const l of lanes) {
            if (!RELAY_LANES[l]) return done('bad-lane');
            out[l] = {
              jobs: safe(() => nativeQueueList(tid, l, false), []) || [],
              paused: safe(() => nativeQueuePaused(tid, l), false),
              fifo: safe(() => nativeQueueIsFifo(tid, l), false),
            };
          }
          done(null, { town_id: tid, lanes: out });
        },
      },
      plan: {
        risk: 'read', doc: 'Goal planner output for one town, or every town.', args: { town_id: 'number (optional)' },
        run: (a, done) => done(null, a.town_id
          ? safe(() => goalPlanTown(+a.town_id), null)
          : safe(() => goalPlanAll(), null)),
      },
      simulate: {
        risk: 'read', doc: 'Forecast what the bot would do over N hours. Sends nothing.', args: { town_id: 'number (optional)', hours: 'number' },
        run: (a, done) => {
          const h = +a.hours || 24;
          done(null, a.town_id ? safe(() => simulateTown(+a.town_id, h), null) : safe(() => simulateAccount(h), null));
        },
      },
      intel: {
        risk: 'read', doc: 'Threat board, dossiers and ranked spy targets.',
        run: (a, done) => done(null, {
          threats: safe(() => intelThreatBoard(), null),
          dossiers: safe(() => intelDossiers(), null),
          spyTargets: safe(() => spyRankTargets(), null),
        }),
      },
      journal: {
        risk: 'read', doc: 'Decision journal slice, rollup stats and active skip windows.', args: { limit: 'number', feature: 'string (optional)' },
        run: (a, done) => done(null, {
          entries: safe(() => jrnSlice({ limit: +a.limit || 100, feature: a.feature || null }), []),
          stats: safe(() => jrnStats(), null),
          skips: safe(() => jrnActiveSkips(), []),
        }),
      },
      preflight: {
        risk: 'read', doc: 'Run every module read-path probe. Sends nothing.',
        run: (a, done) => done(null, safe(() => preflightRun(), null)),
      },
      arm: {
        // Deliberately NOT a cold start: extending a live window is a
        // convenience, opening one is a decision only the user makes.
        risk: 'read', doc: 'Extend an ALREADY OPEN arm window. Cannot open one from cold.', args: { minutes: 'number' },
        run: (a, done) => {
          if (!relayArmed()) return done('not-armed');
          done(null, { armedMinutes: relayArm(a.minutes), armedMs: relayArmLeftMs() });
        },
      },
      disarm: {
        risk: 'read', doc: 'Close the arm window now.',
        run: (a, done) => { relayDisarm(); done(null, { armedMs: 0 }); },
      },

      // -- write -----------------------------------------------------------
      attack: {
        risk: 'write',
        doc: 'Send units from one of your towns at a target town. mission: attack|support|revolt.',
        args: {
          target_id: 'number', from_town_id: 'number', mission: 'attack|support|revolt',
          units: '{unitId:count} (optional)', troop_mode: 'all|offense|defense|all_of_type|harass (used when units is absent)',
          unit_type: 'string (all_of_type)', exclude: '[unitId] (optional)', exclude_transports: 'bool',
        },
        run: (a, done) => {
          const src = +a.from_town_id;
          if (!src) return done('no-source');
          const target = safe(() => resolveTarget({
            targetId: String(a.target_id || ''), targetType: a.target_type || 'town',
            targetX: a.x, targetY: a.y,
          }), null);
          if (!target) return done('bad-target');
          let units = (a.units && typeof a.units === 'object' && !Array.isArray(a.units))
            ? Object.assign({}, a.units)
            : safe(() => selectUnitsForTown(src, a.troop_mode || 'all', a.unit_type, null, a.harass_preset), {}) || {};
          for (const id of (Array.isArray(a.exclude) ? a.exclude : [])) delete units[id];
          if (a.exclude_transports) {
            for (const id of Object.keys(units)) if (relayUnitIsTransport(id)) delete units[id];
          }
          for (const id of Object.keys(units)) if (!(+units[id] > 0)) delete units[id];
          if (!Object.keys(units).length) return done('no-units');
          sendAttackViaBridge(target, src, units, a.mission || 'attack', done);
        },
      },
      support: {
        risk: 'write', doc: 'Send defensive units to one of your own towns.',
        args: { from_town_id: 'number', to_town_id: 'number', units: '{unitId:count}' },
        run: (a, done) => {
          if (!+a.from_town_id || !+a.to_town_id) return done('no-town');
          if (!a.units || typeof a.units !== 'object') return done('no-units');
          supportBridgePost(+a.from_town_id, +a.to_town_id, a.units, done);
        },
      },
      cancel_command: {
        risk: 'write', doc: 'Withdraw one of your outgoing commands.', args: { command_id: 'number' },
        run: (a, done) => {
          if (!a.command_id) return done('no-command');
          militaryCancelCommand(a.command_id, { confirmed: true, automation: true }, done);
        },
      },
      dodge: {
        risk: 'write', doc: 'Evacuate units to a safe town, or raise militia.',
        args: { town_id: 'number', mode: 'send|militia', units: '{unitId:count} (send)', safe_town_id: 'number (send)' },
        run: (a, done) => {
          const tid = +a.town_id;
          if (!tid) return done('no-town');
          if (String(a.mode) === 'militia') return dodgeRaiseMilitia(tid, done);
          const dest = +a.safe_town_id || safe(() => { const s = dodgeSafeTown(tid, null); return s && (s.id || s); }, 0);
          if (!dest) return done('no-safe-town');
          const units = (a.units && typeof a.units === 'object') ? a.units : safe(() => dodgeTownUnits(tid), null);
          if (!units || !Object.keys(units).length) return done('no-units');
          dodgeSendOut(tid, units, dest, done);
        },
      },
      claim_farm: {
        risk: 'write', doc: 'Claim farming villages. mode: all (normal pass) or sleep (4h/8h haul).',
        args: { mode: 'all|sleep', duration: 'seconds (optional)' },
        run: (a, done) => {
          if (String(a.mode) === 'sleep') return farmSleepClaimNow('relay', done);
          autoClaimFarms('relay', a.duration ? +a.duration : undefined, (res) => done(null, res || null));
        },
      },
      cave_store: {
        risk: 'write', doc: 'Stash silver in a town cave. Omit amount to use the emergency plan.',
        args: { town_id: 'number', amount: 'number (optional)' },
        run: (a, done) => {
          const tid = +a.town_id;
          if (!tid) return done('no-town');
          if (a.amount != null) {
            if (!(+a.amount > 0)) return done('bad-amount');
            return caveStoreIron(tid, +a.amount, done);
          }
          emergencyStoreNow(tid, { confirmed: true }, done);
        },
      },
      trade: {
        risk: 'write', doc: 'Send resources between two of your towns.',
        args: { from_town_id: 'number', to_town_id: 'number', wood: 'number', stone: 'number', iron: 'number' },
        run: (a, done) => {
          if (!+a.from_town_id || !+a.to_town_id) return done('no-town');
          const w = +a.wood || 0, s = +a.stone || 0, i = +a.iron || 0;
          if (w + s + i <= 0) return done('no-resources');
          tradeSend(+a.from_town_id, +a.to_town_id, w, s, i, done);
        },
      },
      rural: {
        risk: 'write', doc: 'Farming-village relation actions.',
        args: { mode: 'trade|unlock|upgrade', relation_id: 'number', farm_town_id: 'number', town_id: 'number', amount: 'number (trade)' },
        run: (a, done) => {
          const rel = +a.relation_id, farm = +a.farm_town_id, tid = +a.town_id;
          if (!rel || !farm || !tid) return done('bad-args');
          if (String(a.mode) === 'unlock') return ruralUnlock(rel, farm, tid, done);
          if (String(a.mode) === 'upgrade') return ruralUpgrade(rel, farm, tid, done);
          if (!(+a.amount > 0)) return done('bad-amount');
          ruralTradePost(rel, farm, +a.amount, tid, done);
        },
      },
      queue_add: {
        risk: 'write', doc: 'Append to a GrepBot virtual lane. Prerequisites are inserted automatically.',
        args: { town_id: 'number', kind: 'build|recruit|research', building: 'string', unit: 'string', amount: 'number', tech: 'string' },
        run: (a, done) => {
          const tid = +a.town_id;
          if (!tid) return done('no-town');
          const kind = String(a.kind || '');
          let ok = false;
          if (kind === 'build') ok = nativeQueueAddBuild(tid, String(a.building || ''));
          else if (kind === 'recruit') ok = nativeQueueAddRecruit(tid, String(a.unit || ''), +a.amount || 1);
          else if (kind === 'research') ok = nativeQueueAddResearch(tid, String(a.tech || ''));
          else return done('bad-kind');
          done(ok ? null : 'rejected', { added: !!ok });
        },
      },
      queue_remove: {
        risk: 'write', doc: 'Remove a job from a lane. force skips the lane-state gate, never the prerequisite check.',
        args: { town_id: 'number', lane: 'build|recruit|recruitNaval|research', job_id: 'string', force: 'bool' },
        run: (a, done) => {
          const tid = +a.town_id, lane = String(a.lane || '');
          if (!tid || !RELAY_LANES[lane]) return done('bad-lane');
          const ok = nativeQueueRemove(tid, lane, String(a.job_id || ''), { force: !!a.force });
          done(ok ? null : 'rejected', { removed: !!ok });
        },
      },
      queue_move: {
        risk: 'write', doc: 'Reorder a job within its lane.',
        args: { town_id: 'number', lane: 'string', job_id: 'string', delta: 'number' },
        run: (a, done) => {
          const tid = +a.town_id, lane = String(a.lane || '');
          if (!tid || !RELAY_LANES[lane]) return done('bad-lane');
          const ok = nativeQueueMove(tid, lane, String(a.job_id || ''), +a.delta || 0);
          done(ok ? null : 'rejected', { moved: !!ok });
        },
      },
      queue_mode: {
        risk: 'write', doc: 'Pause/resume a lane, or hand it back to the goal planner.',
        args: { town_id: 'number', lane: 'string', mode: 'pause|legacy' },
        run: (a, done) => {
          const tid = +a.town_id, lane = String(a.lane || '');
          if (!tid || !RELAY_LANES[lane]) return done('bad-lane');
          const ok = String(a.mode) === 'legacy' ? nativeQueueUseLegacy(tid, lane) : nativeQueueTogglePaused(tid, lane);
          done(ok ? null : 'rejected', { ok: !!ok });
        },
      },
      research: {
        risk: 'write', doc: 'Start one research in a town academy.', args: { town_id: 'number', tech: 'string' },
        run: (a, done) => {
          if (!+a.town_id || !a.tech) return done('bad-args');
          researchPost(+a.town_id, String(a.tech), done);
        },
      },
      recruit: {
        risk: 'write', doc: 'Queue units in barracks/docks, or accept units offered by a farming village.',
        args: { town_id: 'number', unit: 'string', amount: 'number', vill_id: 'number (village accept)' },
        run: (a, done) => {
          const unit = String(a.unit || ''), n = +a.amount || 0;
          if (!unit || !(n > 0)) return done('bad-args');
          if (a.vill_id) {
            const farm = relayFarmByVillId(a.vill_id);
            if (!farm) return done('unknown-village');
            return villageAcceptUnits(farm, unit, n, done);
          }
          if (!+a.town_id) return done('no-town');
          recruitBuild(+a.town_id, unit, n, done);
        },
      },
      culture: {
        risk: 'write', doc: 'Start a celebration. olympic additionally needs allowPremiumCulture and daily budget.',
        args: { town_id: 'number', type: 'festival|procession|theater|olympic' },
        run: (a, done) => {
          if (!+a.town_id || !a.type) return done('bad-args');
          cultureStart(String(a.type), +a.town_id, done);
        },
      },
      spell: {
        risk: 'write', doc: 'Cast a god power on one of your towns. power_id must be explicit.',
        args: { town_id: 'number', power_id: 'string' },
        run: (a, done) => {
          if (!+a.town_id || !a.power_id) return done('bad-args');
          godSpellCast(+a.town_id, String(a.power_id), done);
        },
      },
      hero: {
        risk: 'write', doc: 'Assign, unassign or recall a hero.',
        args: { mode: 'assign|unassign|cancel', hero: 'string', town_id: 'number (assign)' },
        run: (a, done) => {
          const hero = String(a.hero || '');
          if (!hero) return done('no-hero');
          const opts = { confirmed: true, automation: true };
          if (String(a.mode) === 'unassign') return heroUnassign(hero, opts, done);
          if (String(a.mode) === 'cancel') return heroCancelTravel(hero, opts, done);
          if (!+a.town_id) return done('no-town');
          heroAssignToTown(hero, +a.town_id, opts, done);
        },
      },
      instant: {
        risk: 'write', doc: 'Instantly finish build/research orders that are already FREE. Never buys with gold.',
        run: (a, done) => {
          const orders = safe(() => ibOrders(true), []) || [];
          const free = orders.filter(o => o && o.isFree);
          if (!free.length) return done(null, { completed: 0, note: 'no free orders' });
          Promise.resolve(ibCompleteAll(free))
            .then(r => done(null, { completed: free.length, result: r == null ? null : r }))
            .catch(e => done(String(e)));
        },
      },
      quest_claim: {
        risk: 'write', doc: 'Claim one quest reward. Only fires when every reward is safe.',
        args: { quest_id: 'string' },
        run: (a, done) => {
          const id = String(a.quest_id || '');
          if (!id) return done('no-quest');
          const list = safe(() => questsFromGame(), []) || [];
          const entry = list.find(q => String(q.questId) === id || String(q.progressableId) === id);
          if (!entry) return done('unknown-quest');
          claimQuestViaBridge(entry, done);
        },
      },
      set_target: {
        risk: 'write', doc: 'Change planning targets. Local state only, sends nothing.',
        args: { town_id: 'number', building: 'string', level: 'number', profile: 'string', overrides: 'object' },
        run: (a, done) => {
          if (a.building != null) { abSetTarget(String(a.building), +a.level || 0); return done(null, { ok: true }); }
          if (!+a.town_id) return done('no-town');
          if (a.profile) return done(goalSetProfile(+a.town_id, String(a.profile)) ? null : 'rejected', { ok: true });
          if (a.overrides) return done(goalSetTownOverrides(+a.town_id, a.overrides) ? null : 'rejected', { ok: true });
          done('bad-args');
        },
      },
      toggle: {
        risk: 'write', doc: 'Flip one whitelisted automation flag. Guard flags are not exposed.',
        args: { key: Object.keys(RELAY_TOGGLES).join('|'), value: 'bool' },
        run: (a, done) => {
          const k = String(a.key || '');
          if (!Object.prototype.hasOwnProperty.call(RELAY_TOGGLES, k)) return done('unknown-toggle');
          state[k] = !!a.value;
          save(RELAY_TOGGLES[k], state[k]);
          gbLog(`relay toggle ${k} ${state[k] ? 'ON' : 'OFF'}`);
          done(null, { key: k, value: state[k] });
        },
      },
      kick: {
        risk: 'write', doc: 'Run a feature scan now. Each scan applies its own gates.',
        args: { scan: Object.keys(RELAY_SCANS).join('|') },
        run: (a, done) => {
          const k = String(a.scan || '');
          const fn = RELAY_SCANS[k];
          if (!fn) return done('unknown-scan');
          try { fn(); } catch (e) { return done(String(e)); }
          done(null, { kicked: k });
        },
      },
      panic: {
        risk: 'write', doc: 'Emergency stop: forces dry run ON and halts automation.',
        run: (a, done) => { gbPanicActivate(); done(null, { panic: true }); },
      },
      recover: {
        risk: 'write', doc: 'Leave panic. Dry run stays ON deliberately - clear it by hand.',
        run: (a, done) => { gbPanicRecover(); done(null, { panic: false, dryRun: !!state.dryRun }); },
      },

      // -- raw ---------------------------------------------------------------
      bridge: {
        risk: 'raw',
        doc: 'Arbitrary frontend_bridge post. Covers everything GrepBot has no wrapper for (colonise, alliance, messages, marketplace).',
        args: { model_url: 'string', action_name: 'string', arguments: 'object', town_id: 'number', feature: 'string (optional)' },
        run: (a, done) => {
          const feature = relayRawFeature(a.feature);
          if (!feature) return done('bad-feature');
          if (!a.model_url || !a.action_name) return done('bad-payload');
          bridgePost(feature, {
            model_url: String(a.model_url),
            action_name: String(a.action_name),
            arguments: (a.arguments && typeof a.arguments === 'object') ? a.arguments : {},
            town_id: +a.town_id || 0,
          }, done);
        },
      },
      ajax: {
        risk: 'raw', doc: 'Arbitrary gpAjax controller/action post.',
        args: { controller: 'string', action: 'string', data: 'object', feature: 'string (optional)' },
        run: (a, done) => {
          const feature = relayRawFeature(a.feature);
          if (!feature) return done('bad-feature');
          if (!a.controller || !a.action) return done('bad-payload');
          gameAjaxPost(feature, String(a.controller), String(a.action),
            (a.data && typeof a.data === 'object') ? a.data : {}, done);
        },
      },
    };

    function relayRawFeature(name) {
      // Default to 'airaw', which planner.js lists in TX_WRITE_FEATURES so the
      // full write guard chain runs. A caller-supplied feature is only honoured
      // if it is ALSO a write feature -- otherwise txRun would take the read
      // path and silently skip dry run, safe mode and the circuit breaker.
      if (!name) return 'airaw';
      const f = String(name);
      return (typeof TX_WRITE_FEATURES !== 'undefined' && TX_WRITE_FEATURES.has(f)) ? f : null;
    }

    function relayManifest() {
      return {
        version: safe(() => runningVersion(), null),
        armedMs: relayArmLeftMs(),
        rawEnabled: state.relayRaw === true,
        commands: Object.keys(RELAY_CMDS).map(name => ({
          name, risk: RELAY_CMDS[name].risk,
          doc: RELAY_CMDS[name].doc || '',
          args: RELAY_CMDS[name].args || {},
        })),
      };
    }

    function handleCommand(msg) {
      const id = msg && msg.id;
      const name = String((msg && msg.cmd) || '');
      const args = (msg && msg.args && typeof msg.args === 'object') ? msg.args : {};
      const reply = (ok, extra) => {
        send(Object.assign({ type: 'result', id, cmd: name, ok: !!ok }, extra || {}));
      };

      // -- gate ladder -----------------------------------------------------
      if (state.relayCommands !== true) return reply(false, { error: 'commands-off' });
      const entry = Object.prototype.hasOwnProperty.call(RELAY_CMDS, name) ? RELAY_CMDS[name] : null;
      if (!entry) return reply(false, { error: 'unknown-cmd' });
      const risk = entry.risk || 'write';
      if (risk === 'raw' && state.relayRaw !== true) return reply(false, { error: 'raw-off' });
      if (risk !== 'read') {
        if (!relayArmed()) return reply(false, { error: 'not-armed' });
        if (Date.now() - relayLastWriteAt < RELAY_CMD_MIN_GAP_MS) return reply(false, { error: 'rate-limited', gate: 'min-gap' });
        if (relayWriteBudgetLeft() <= 0) return reply(false, { error: 'rate-limited', gate: 'hourly-cap' });
      }
      const token = gbLock('relay-cmd');
      if (!token) return reply(false, { error: 'busy' });

      // -- dispatch --------------------------------------------------------
      // txRun may call onDone with one arg, both, or NEVER (soft-ceiling
      // defer, reconcile retry, disposed instance). Without the timeout an
      // MCP tool call would hang until its own deadline with no explanation.
      let settled = false;
      let timer = 0;
      const settle = (err, data) => {
        if (settled) return;
        settled = true;
        if (timer) { try { clearTimeout(timer); } catch (_) {} timer = 0; }
        gbUnlock('relay-cmd', token);
        if (risk !== 'read' && !err) {
          relayLastWriteAt = Date.now();
          relayWriteStamps.push(Date.now());
        }
        if (err) reply(false, { error: String(err), gate: String(err) });
        else reply(true, { data: data === undefined ? null : data });
      };
      timer = gbTimeout(() => settle('no-callback'), RELAY_CMD_TIMEOUT_MS);

      if (risk === 'raw') gbLog(`relay-cmd ${name} RAW: ${JSON.stringify(args).slice(0, 600)}`);
      else gbLog(`relay-cmd ${name} (${risk})`);

      try { entry.run(args, settle); } catch (e) { settle(String(e)); }
    }

    function clearTimers() {
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = 0; }
      if (pingTimer) { clearInterval(pingTimer); pingTimer = 0; }
      if (tickTimer) { clearInterval(tickTimer); tickTimer = 0; }
    }

    function scheduleReconnect() {
      if (reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = 0;
        connect();
      }, RETRY_MS);
    }

    function connect() {
      if (typeof WebSocket === 'undefined') return;
      clearTimers();
      let sock;
      try {
        sock = new WebSocket(RELAY_URL);
      } catch (_) {
        scheduleReconnect();
        return;
      }
      ws = sock;
      paintAi();
      sock.addEventListener('open', () => {
        paintAi();
        send({
          type: 'hello', kind: 'hello',
          payload: {
            ua: safe(() => navigator.userAgent, ''),
            url: safe(() => location.href, ''),
            at: Date.now(),
          },
        });
        // Push immediately, then keep ticking.
        tick();
        tickTimer = setInterval(tick, TICK_MS);
        pingTimer = setInterval(() => send({ type: 'ack', kind: 'ping' }), PING_MS);
      });
      sock.addEventListener('message', (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch (_) { return; }
        if (m && m.type === 'request') handleRequest(m);
        else if (m && m.type === 'command') handleCommand(m);
      });
      sock.addEventListener('close', () => {
        clearTimers();
        ws = null;
        paintAi();
        scheduleReconnect();
      });
      sock.addEventListener('error', () => {
        try { sock.close(); } catch (_) {}
      });
    }

    function boot() {
      if (!isWorldPage()) return;
      // The pill must read "sin conexion" from the moment the panel exists,
      // not only once a socket has been attempted.
      startStatusTimer();
      paintAi();
      paintArmed();
      // Defer first connect so SPA collection has time to populate.
      setTimeout(connect, 1500);
      // Manual refresh hook on unsafeWindow for the console:
      try { uw().gbRelayTick = tick; } catch (_) {}
      // relay.js lives in its own IIFE, so ui.js cannot see these directly.
      // Same escape hatch planner.js uses for `__grepbotPlanner`.
      try {
        GB_ROOT.__grepbotRelay = {
          arm: relayArm, disarm: relayDisarm,
          armedMs: relayArmLeftMs, armed: relayArmed,
          writesLeft: relayWriteBudgetLeft,
          manifest: relayManifest,
          paint: () => { paintAi(); paintArmed(); },
          connected: () => aiState() === 'on',
        };
      } catch (_) {}
    }

    boot();
  })();
