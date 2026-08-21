  // parseReport is ADDITIVE ONLY. Every field it returns must be a value it
  // actually read: an unknown key yields null / {} / a dropped entry, never an
  // invented default. The five `return null` strictness paths below exist
  // because `type: 'unknown'` poisoned downstream filters - do not weaken them
  // to make a new field survive.
  function nameOf(p) {
    if (p == null) return null;
    if (typeof p === 'string') {
      const s = p.trim();
      return s ? { id: null, name: s } : null;
    }
    if (typeof p !== 'object') return null;
    return {
      id: p.id ?? p.player_id ?? null,
      name: p.name || p.player_name || null,
      town_id: p.town_id ?? p.origin_town_id ?? null,
      town_name: p.town_name || p.origin_town_name || null,
      alliance: p.alliance_name || p.alliance || null,
      vacation: p.vacation ?? p.on_vacation ?? null,
    };
  }
  function cleanUnitBag(src) {
    if (!src || typeof src !== 'object' || Array.isArray(src)) return null;
    const u = {};
    Object.keys(src).forEach(k => { const v = Number(src[k]); if (Number.isFinite(v) && v > 0) u[k] = Math.floor(v); });
    return Object.keys(u).length ? u : null;
  }
  // Both null, or both objects - never a half-split, so plan 2.5 can trust the
  // pair as a discriminator for "this report told us who owned what".
  function extractSplitUnits(r) {
    const attacker = cleanUnitBag(r.attacker_units);
    const defender = cleanUnitBag(r.defender_units);
    if (!attacker && !defender) return { attacker: null, defender: null };
    return { attacker: attacker || {}, defender: defender || {} };
  }
  // Legacy contract: a flat union bag. ui.js and intel.js read this shape and
  // it is preserved bit-for-bit.
  function extractUnits(r) {
    // Split keys win when present: they are strictly more informative, and the
    // union they produce is what the legacy readers already expect.
    const split = extractSplitUnits(r);
    if (!split.attacker && !split.defender) return cleanUnitBag(r.units);
    const u = {};
    for (const bag of [split.attacker, split.defender]) {
      for (const [k, v] of Object.entries(bag || {})) u[k] = (u[k] || 0) + v;
    }
    return Object.keys(u).length ? u : null;
  }
  function extractResources(r) {
    const src = r.resources || r.loot || r.resource_pillage || r.haul || {};
    return {
      wood: src.wood ?? null, stone: src.stone ?? null, iron: src.iron ?? null,
      gold: src.gold ?? null, supply: src.supply ?? null,
    };
  }
  // {} when nothing survives, never a partial bag with fabricated levels.
  function parseBuildings(r) {
    const src = r.buildings || r.building_levels || r.buildings_levels;
    if (!src || typeof src !== 'object' || Array.isArray(src)) return {};
    const out = {};
    for (const [k, raw] of Object.entries(src)) {
      const n = Number(raw && typeof raw === 'object' ? (raw.level ?? raw.value) : raw);
      if (!Number.isFinite(n) || n <= 0) continue;
      out[String(k).toLowerCase()] = Math.floor(n);
    }
    return out;
  }
  // 'win' | 'lose' | 'draw' | null. Anything unrecognised stays null so the
  // win-rate math in plan 2.5 never counts a guess.
  function parseOutcome(r) {
    const o = r.outcome;
    if (typeof o === 'string') {
      const s = o.trim().toLowerCase();
      if (/^(win|won|victory|success)$/.test(s)) return 'win';
      if (/^(lose|lost|loss|defeat|failure|failed)$/.test(s)) return 'lose';
      if (/^(draw|tie)$/.test(s)) return 'draw';
    }
    if (o === true) return 'win';
    if (o === false) return 'lose';
    if (o === 1) return 'win';
    if (o === 0) return 'lose';
    if (r.draw === true) return 'draw';
    if (r.win === true) return 'win';
    if (r.win === false) return 'lose';
    if (r.win === 1) return 'win';
    if (r.win === 0) return 'lose';
    return null;
  }
  // null unless at least one field is populated. Never invents level 0 or a
  // placeholder name.
  function parseHero(r) {
    const src = r.hero || r.hero_info || r.defender_hero;
    if (!src || typeof src !== 'object' || Array.isArray(src)) return null;
    const lvl = Number(src.level ?? src.hero_level);
    const out = {
      id: src.id ?? src.hero_id ?? null,
      name: (typeof src.name === 'string' && src.name.trim()) ? src.name.trim()
        : (typeof src.hero_name === 'string' && src.hero_name.trim()) ? src.hero_name.trim() : null,
      level: Number.isFinite(lvl) && lvl > 0 ? Math.floor(lvl) : null,
      cls: (typeof src.class === 'string' && src.class.trim()) ? src.class.trim()
        : (typeof src.hero_class === 'string' && src.hero_class.trim()) ? src.hero_class.trim() : null,
    };
    return (out.id != null || out.name || out.level != null || out.cls) ? out : null;
  }
  function parseReport(id, data) {
    if (data == null) return null;
    let root = data;

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
          if (n < 1e12) n *= 1000;
          return Math.floor(n);
        }
        const parsed = Date.parse(c);
        if (!Number.isNaN(parsed)) return parsed;
      }
      return null;
    })();
    const buildings = parseBuildings(r);
    const split = extractSplitUnits(r);
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
      units_attacker: split.attacker,
      units_defender: split.defender,
      buildings,
      hero: parseHero(r),
      resources: extractResources(r),
      loot: r.resources || r.loot || null,
      outcome: parseOutcome(r),
      // buildings.wall first so the new deep parse feeds the old readers, then
      // the original fallback chain unchanged.
      // `r.wall` may be capitalised (`Wall`) on some clients; lowercase the lookup
      // so the chain stays a chain regardless of server-side keying.
      wall: buildings.wall ?? ((r.wall != null ? r.wall : (r.Wall != null ? r.Wall : undefined))) ?? r.wall_level ?? r.defender_wall ?? (r.defender && (r.defender.wall ?? r.defender.wall_level)) ?? null,
      alliance: r.alliance ?? r.attacker_alliance ?? (r.attacker && (r.attacker.alliance_name || r.attacker.alliance)) ?? null,
      vill_id: r.vill_id ?? r.farm_town_id ?? null,
      vacation: r.vacation ?? r.on_vacation ?? null,
    };
  }
  function parseFarms(text) {
    return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const parts = line.split('|').map(s => s.trim());
      let id = parts[0] && /^\d+$/.test(parts[0]) ? parts[0] : null;
      if (!id) {

        const m = line.match(/^(\d{4,})\s+/);
        if (m) id = m[1];
      }
      if (!id) return null;
      const out = { vill_id: id, x: null, y: null, eta: null, notes: null };

      const afterId = (line.startsWith(id) ? line.slice(id.length) : line).trimStart();
      const coordMatch = afterId.match(/^\|?\s*(-?\d{1,4})[,\s]+(-?\d{1,4})/);
      if (coordMatch) { out.x = +coordMatch[1]; out.y = +coordMatch[2]; }
      for (const p of parts) {
        if (/^\d+\s*(?:min|h|m)$/i.test(p) || /^\d{1,2}:\d{2}$/.test(p)) { out.eta = p; break; }
      }
      // Only seed the skip set with real values; `${out.x},${out.y}` evaluates
      // to the literal string "null,null" when coords are missing, which then
      // silently masks any real note that happens to contain that token.
      const coordSpace = out.x != null && out.y != null ? `${out.x} ${out.y}` : null;
      const coordComma = out.x != null && out.y != null ? `${out.x},${out.y}` : null;
      const skip = new Set([out.eta, coordSpace, coordComma, id].filter(Boolean));
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

    const r = (json && (json.town || json.town_info || json)) || {};
    let res_ = r.resources || r.resource || (json && json.resources) || {};
    if (res_ && typeof res_ === 'object' && res_.resources && typeof res_.resources === 'object') {
      res_ = res_.resources;
    }
    const popRaw = r.population ?? r.pop;
    // A client that reports population as a bare number would otherwise read as
    // "unknown" and drop the value whole.
    const popNum = typeof popRaw === 'number' || (typeof popRaw === 'string' && /^\d+$/.test(popRaw)) ? +popRaw : null;
    const pop = (popRaw && typeof popRaw === 'object') ? popRaw : {};
    const wood = pickNum(res_.wood, r.wood, json && json.wood);
    const stone = pickNum(res_.stone, r.stone, json && json.stone);
    const iron = pickNum(res_.iron, r.iron, json && json.iron);
    return {
      wood, stone, iron,
      pop: pop.current ?? pop.pop ?? popNum ?? null,
      cap: pop.max ?? pop.cap ?? (Number.isFinite(+r.population_max) ? +r.population_max : null) ?? null,
      name: r.name || r.town_name || null,
      got: wood != null || stone != null || iron != null || !!(r.name || r.town_name),
    };
  }
