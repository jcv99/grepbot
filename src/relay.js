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
      };
    }

    let ws = null;
    let reconnectTimer = 0;
    let pingTimer = 0;
    let tickTimer = 0;
    let lastTick = 0;
    let inFlight = false;
    let lastSnapshot = { farms: null, towns: null, player: null, queues: null };

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
        lastTick = Date.now();
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
      sock.addEventListener('open', () => {
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
        scheduleReconnect();
      });
      sock.addEventListener('error', () => {
        try { sock.close(); } catch (_) {}
      });
    }

    function boot() {
      if (!isWorldPage()) return;
      // Defer first connect so SPA collection has time to populate.
      setTimeout(connect, 1500);
      // Manual refresh hook on unsafeWindow for the console:
      try { uw().gbRelayTick = tick; } catch (_) {}
    }

    boot();
  })();
