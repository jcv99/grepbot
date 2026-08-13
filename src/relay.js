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

    function startStatusTimer() {
      if (statusTimer) return;
      statusTimer = setInterval(paintAi, 5000);
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
      // Defer first connect so SPA collection has time to populate.
      setTimeout(connect, 1500);
      // Manual refresh hook on unsafeWindow for the console:
      try { uw().gbRelayTick = tick; } catch (_) {}
    }

    boot();
  })();
