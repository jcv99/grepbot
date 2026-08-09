  // parsers from src/parse.js
  // Pure parsers - node-runnable (no GM/DOM). Also @require'd into the userscript build.
  function nameOf(p) {
    if (p == null) return null;
    if (typeof p === 'string') {
      const s = p.trim();
      return s ? { id: null, name: s } : null;
    }
    if (typeof p !== 'object') return null;
    return { id: p.id ?? p.player_id ?? null, name: p.name || p.player_name || null };
  }

  function extractUnits(r) {
    const u = {};
    const src = r.units || r.attacker_units || {};
    Object.keys(src).forEach(k => { const v = src[k]; if (typeof v === 'number' && v > 0) u[k] = v; });
    return Object.keys(u).length ? u : null;
  }

  function extractResources(r) {
    const src = r.resources || r.loot || {};
    return {
      wood: src.wood ?? null, stone: src.stone ?? null, iron: src.iron ?? null,
      gold: src.gold ?? null, supply: src.supply ?? null,
    };
  }

  function parseReport(id, data) {
    if (data == null) return null;
    let root = data;
    // Unwrap {json:"..."} / {json:{...}} envelopes (I8)
    for (let depth = 0; depth < 3 && root && typeof root === 'object' && root.json != null; depth++) {
      let inner = root.json;
      if (typeof inner === 'string') {
        try { inner = JSON.parse(inner); } catch (_) { break; }
      }
      if (!inner || typeof inner !== 'object') break;
      root = inner;
    }
    if (typeof root === 'string') {
      try { root = JSON.parse(root); } catch (_) { return null; }
    }
    if (!root || typeof root !== 'object') return null;
    const r = root.report || root;
    if (!r || typeof r !== 'object') return null;
    const type = r.type || r.report_type || null;
    // Require a recognizable report shape - never invent type:'unknown' for garbage.
    if (!type && r.attacker == null && r.defender == null && !r.units && !r.attacker_units && r.outcome == null && r.win == null) {
      return null;
    }
    const now = Date.now();
    const serverTs = (() => {
      const keys = ['time', 'timestamp', 'created_at', 'reported_at', 'date', 'started_at', 'ended_at'];
      for (const k of keys) {
        const c = r[k];
        if (c == null || c === '') continue;
        if (typeof c === 'number' || (/^\d+(\.\d+)?$/.test(String(c)))) {
          let n = +c;
          if (!Number.isFinite(n) || n <= 0) continue;
          if (n < 1e12) n *= 1000; // unix seconds -> ms
          return Math.floor(n);
        }
        const parsed = Date.parse(c);
        if (!Number.isNaN(parsed)) return parsed;
      }
      return null;
    })();
    return {
      id, ts: serverTs != null ? serverTs : now,
      type: type || 'unknown',
      attacker: nameOf(r.attacker),
      defender: nameOf(r.defender),
      town: {
        id: r.defender?.town_id || r.town_id || null,
        name: r.defender?.town_name || r.town_name || null,
        x: r.defender?.x ?? r.x ?? null,
        y: r.defender?.y ?? r.y ?? null,
      },
      units: extractUnits(r),
      resources: extractResources(r),
      loot: r.resources || null,
      outcome: r.outcome ?? r.win ?? null,
      // raw omitted - GM write weight (audit backlog); keep slim findings
    };
  }

  function parseFarms(text) {
    return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const parts = line.split('|').map(s => s.trim());
      let id = parts[0] && /^\d+$/.test(parts[0]) ? parts[0] : null;
      if (!id) {
        // tolerate "12345 500 600 | notes" (no leading pipe)
        const m = line.match(/^(\d{4,})\s+/);
        if (m) id = m[1];
      }
      if (!id) return null;
      const out = { vill_id: id, x: null, y: null, eta: null, notes: null };
      // Match coords AFTER the village id - bare "12345 500 600" must not
      // left-match "2345 500" from inside the id.
      // slice, not `new RegExp('^'+id)` - parseFarms runs per line on every
      // textarea keystroke; a compiled-per-line regex is the hot cost here.
      const afterId = (line.startsWith(id) ? line.slice(id.length) : line).trimStart();
      const coordMatch = afterId.match(/^\|?\s*(-?\d{1,4})[,\s]+(-?\d{1,4})/);
      if (coordMatch) { out.x = +coordMatch[1]; out.y = +coordMatch[2]; }
      for (const p of parts) {
        if (/^\d+[hm]$/i.test(p) || /^\d{1,2}:\d{2}$/.test(p)) { out.eta = p; break; }
      }
      const skip = new Set([out.eta, out.x != null ? `${out.x} ${out.y}` : null, `${out.x},${out.y}`, id]);
      out.notes = parts.slice(1).filter(p => p && !skip.has(p)).join(' | ') || null;
      return out;
    }).filter(Boolean);
  }

  function parseBodyLoose(s) {
    let j = null;
    try { j = JSON.parse(s); } catch (_) {}
    if (!j) {
      try {
        const p = new URLSearchParams(s);
        j = {};
        for (const [k, v] of p) { try { j[k] = JSON.parse(v); } catch (_) { j[k] = v; } }
      } catch (_) { return null; }
    }
    // Unwrap {"json":"<stringified>"} and double-wrapped envelopes
    let cur = j;
    for (let depth = 0; depth < 3 && cur && cur.json; depth++) {
      let inner = cur.json;
      if (typeof inner === 'string') {
        try { inner = JSON.parse(inner); } catch (_) { break; }
      }
      if (!inner || typeof inner !== 'object') break;
      if (inner.model_url || inner.action_name || inner.arguments) return inner;
      cur = inner;
    }
    return j;
  }


  function parseResourceJson(data) {
    const json = (data && data.json) ? (typeof data.json === 'string' ? (() => { try { return JSON.parse(data.json); } catch (_) { return data; } })() : data.json) : data;
    // Prefer town/town_info; do NOT pick json.resources as `r` (that double-derefs)
    const r = (json && (json.town || json.town_info || json)) || {};
    let res_ = r.resources || r.resource || (json && json.resources) || {};
    if (res_ && typeof res_ === 'object' && res_.resources && typeof res_.resources === 'object') {
      res_ = res_.resources; // nested {resources:{wood,...}}
    }
    const pop = r.population || r.pop || {};
    const wood = pickNum(res_.wood, r.wood, json && json.wood);
    const stone = pickNum(res_.stone, r.stone, json && json.stone);
    const iron = pickNum(res_.iron, r.iron, json && json.iron);
    return {
      wood, stone, iron,
      pop: pop.current ?? pop.pop ?? null,
      cap: pop.max ?? pop.cap ?? null,
      name: r.name || r.town_name || null,
      got: wood != null || stone != null || iron != null || !!(r.name || r.town_name),
    };
  }

