  // ===== Inter-city transport (v4 plan 1.3) ==================================
  // There is NO separate transport endpoint in this game client. Plan 27's
  // "sniff transportTpl" hint names a symbol that does not exist anywhere in
  // src/; the only inter-city post is tradeSend (trade.js) and this module uses
  // it verbatim. Do not invent a transport controller, action name or payload
  // field here.
  //
  // This module owns the capacity/ETA model that plans 3.2 (support auto-send),
  // 3.4 (resource dump) and 5.1 (resource balancing) consume. The four public
  // signatures below are a contract: do not break them between v4.0 and v4.3.
  // Every one of them returns a `blind` flag rather than a fabricated number -
  // a check may only block on a value it actually read.

  const TRANSPORT_MAX_JOBS = 4;          // mirrors tradeIslandShipJobs' ceiling
  const TRANSPORT_SRC_FILL = 0.85;       // source must be this full to donate
  const TRANSPORT_TGT_FILL = 0.25;       // target must be this empty to receive
  const TRANSPORT_ETA_MAX_MS = 24 * 3600 * 1000;

  function transportReservePct() {
    return Math.min(80, Math.max(0, gbCfgNum(state.transportReserve, 20))) / 100;
  }
  function transportMinBatch() {
    return Math.min(10000, Math.max(100, gbCfgNum(state.transportMin, 1000)));
  }

  // Per-resource production, units/second. null = unreadable (blind).
  // Grepolis reports production per hour on some builds and per second on
  // others; the same >100 heuristic ironReservedForCave uses (core.js) decides.
  function transportProduction(townId) {
    let t = null;
    try {
      const uw = gameUw();
      t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]);
    } catch (_) {}
    if (!t) return null;
    let p = null;
    try { p = t.getProduction ? t.getProduction() : (t.production && t.production()); } catch (_) {}
    if (!p || typeof p !== 'object') return null;
    // Per-resource null, not a whole-object null: one unreadable rate must not
    // blind the other two. Callers test the key they actually use.
    const out = {};
    let any = false;
    for (const k of GB_RES_KEYS) {
      const raw = +p[k];
      if (!Number.isFinite(raw) || raw < 0) { out[k] = null; continue; }
      out[k] = raw > 100 ? raw / 3600 : raw;
      any = true;
    }
    return any ? out : null;
  }

  // {wood, stone, iron, cap, tradeCap, etaWoodMs, etaStoneMs, etaIronMs,
  //  islandType, small, fillPct:{...}, blind}
  // etaXxxMs is ms until that resource hits cap at current production; 0 means
  // already at cap, null means production is unreadable.
  function transportTownRes(townId) {
    const base = tradeTownRes(townId);
    if (!base) return null;
    const blind = !(base.cap > 0);
    const prod = transportProduction(townId);
    const fillPct = {};
    const eta = {};
    for (const k of GB_RES_KEYS) {
      fillPct[k] = base.cap > 0 ? Math.max(0, Math.min(1, (+base[k] || 0) / base.cap)) : null;
      if (!(base.cap > 0)) { eta[k] = null; continue; }
      const room = base.cap - (+base[k] || 0);
      if (room <= 0) { eta[k] = 0; continue; }
      const rate = prod ? prod[k] : null;
      eta[k] = rate > 0 ? (room / rate) * 1000 : null;
    }
    const prodBlind = !prod || GB_RES_KEYS.some(k => prod[k] == null);
    return {
      id: base.id, wood: base.wood, stone: base.stone, iron: base.iron,
      cap: base.cap, tradeCap: base.tradeCap, pop: base.pop,
      small: base.small, islandType: base.small ? 'small' : 'main',
      fillPct,
      etaWoodMs: eta.wood, etaStoneMs: eta.stone, etaIronMs: eta.iron,
      production: prod,
      blind: blind || prodBlind,
    };
  }

  // Free warehouse space deltaMs from now, accounting for production and for
  // resources already in flight toward this town.
  function transportProjectHeadroom(townId, deltaMs) {
    const st = transportTownRes(townId);
    if (!st || !(st.cap > 0)) return { woodFree: null, stoneFree: null, ironFree: null, blind: true };
    const inc = tradeIncomingByTown();
    // Unknown incoming is not "none": overstating headroom is how a haul
    // evaporates on arrival. Report blind and let the caller refuse.
    if (!inc.known) return { woodFree: null, stoneFree: null, ironFree: null, blind: true };
    const mov = inc.byTown[String(townId)] || {};
    const ms = Math.max(0, +deltaMs || 0);
    // The only projected drain this tree can actually read is the cave iron
    // reserve. Build/culture/recruit consumption is not exposed as a rate
    // anywhere in src/, so it is NOT deducted - reporting it as zero would be
    // inventing a number. Callers that need it must read their own ledger.
    let ironDrain = 0;
    try {
      const r = ironReservedForCave(townId);
      if (r && r.reserved) ironDrain = Math.ceil(st.cap * (Math.min(99, Math.max(50, +state.caveThreshPct || 90)) / 100));
    } catch (_) {}
    const out = { blind: false };
    for (const k of GB_RES_KEYS) {
      const rate = st.production ? st.production[k] : null;
      if (rate == null) { out[k + 'Free'] = null; out.blind = true; continue; }
      const grown = rate * (ms / 1000);
      const projected = (+st[k] || 0) + (+mov[k] || 0) + grown + (k === 'iron' ? ironDrain : 0);
      out[k + 'Free'] = Math.max(0, st.cap - projected);
    }
    return { woodFree: out.woodFree, stoneFree: out.stoneFree, ironFree: out.ironFree, blind: out.blind };
  }

  // ms until `resource` reaches targetFillPct (0..1) of cap. null when the
  // target is unreachable inside the visible 24h window, or when production is
  // unreadable. Samples transportProjectHeadroom with a doubling delta so the
  // answer stays consistent with the headroom model other plans read.
  function transportTownETA(townId, resource, targetFillPct) {
    if (!GB_RES_KEYS.includes(resource)) return null;
    const st = transportTownRes(townId);
    if (!st || !(st.cap > 0)) return { ms: null, blind: true };
    if (!st.production || st.production[resource] == null) return { ms: null, blind: true };
    const want = Math.max(0, Math.min(1, +targetFillPct || 0)) * st.cap;
    const key = resource + 'Free';
    // Doubling probe, floored so the 8 samples still span the full 24h window
    // the contract promises (60s * 2^7 would stop at ~2h).
    let delta = TRANSPORT_ETA_MAX_MS / 128; // 675000ms; 8 doublings reach 24h
    for (let i = 0; i < 8 && delta <= TRANSPORT_ETA_MAX_MS; i++) {
      const h = transportProjectHeadroom(townId, delta);
      if (h[key] == null) return { ms: null, blind: true };
      if (st.cap - h[key] >= want) return { ms: delta, blind: false };
      delta *= 2;
    }
    return null;
  }

  // -1..+1 pull for a resource on a town. +1 attracts, -1 repels, 0 neutral.
  function transportBias(townId, res) {
    let p = null;
    try { p = goalEffective(townId); } catch (_) {}
    const v = p && p.resource ? +p.resource[res] : 0;
    return Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
  }

  // One fleet-wide balanced move list. Runs on the SAME tradeLedger every other
  // sub-planner uses, and every job is still handed to tradeValidateJob by
  // tradeScan before it is sent - this planner never bypasses the validator.
  // One source town's contribution. Mutates `ledger` through tradeApplyJob and
  // appends to `jobs`; returns true when the fleet-wide job ceiling is reached.
  function transportBalanceSourceTown(srcId, ids, ledger, jobs) {
    const src = ledger[srcId];
    if (!src || !(src.cap > 0)) {
      gbLogT('transport-blind-' + srcId, 600000, `transport: town ${srcId} capacity unreadable - skipped`);
      return false;
    }
    const minBatch = transportMinBatch();
    const reserve = transportReservePct();
    if (src.tradeCap < minBatch) return false;
    const keep = Math.floor(src.cap * reserve);
    // Iron the cave is about to eat is not surplus. Blind is "unknown, not no":
    // the cave reserve is simply not deducted and the send proceeds.
    let ironKeep = keep;
    try {
      const r = ironReservedForCave(srcId);
      if (r && r.reserved) {
        const thresh = Math.min(99, Math.max(50, +state.caveThreshPct || 90)) / 100;
        ironKeep = Math.max(keep, Math.ceil(src.cap * thresh));
        gbLogT('transport-iron-reserved-' + srcId, 600000,
          `transport: town ${srcId} iron held for cave (keep ${ironKeep})`);
      } else if (r && r.blind) {
        gbLogT('transport-iron-blind-' + srcId, 600000,
          `transport: town ${srcId} cave reserve unreadable - no iron deduction`);
      }
    } catch (_) {}
    for (const res of GB_RES_KEYS) {
      // Re-read every loop: tradeApplyJob has mutated src for earlier resources.
      if (src.tradeCap < minBatch) return false;
      if (src[res] / src.cap < TRANSPORT_SRC_FILL) continue;
      const srcKeep = res === 'iron' ? ironKeep : keep;
      const surplus = Math.max(0, src[res] - srcKeep);
      if (surplus < minBatch) continue;
      // A source biased AGAINST a resource gives it away; one biased FOR it
      // keeps it. Neutral sources donate normally.
      if (transportBias(srcId, res) > 0) continue;
      // Attraction is an ORDERING, not a capacity licence: a +1 town is served
      // first, but the physical headroom clamp below is never relaxed - a haul
      // over the target warehouse evaporates on arrival.
      const dests = ids
        .filter(id => id !== srcId)
        .map(id => ({ id, bias: transportBias(id, res) }))
        .filter(d => d.bias >= 0)
        .sort((a, b) => b.bias - a.bias);
      for (const d of dests) {
        const tgt = ledger[d.id];
        if (!tgt || !(tgt.cap > 0)) {
          gbLogT('transport-blind-' + d.id, 600000, `transport: town ${d.id} capacity unreadable - skipped`);
          continue;
        }
        const tgtFill = tgt[res] / tgt.cap;
        // +1 bias relaxes the "target must be 25% empty" gate up to 50%.
        const tgtGate = TRANSPORT_TGT_FILL + d.bias * 0.25;
        if (tgtFill > tgtGate) {
          gbLogT('transport-pair-' + srcId + '-' + d.id, 600000,
            `transport: ${srcId}->${d.id} ${res} skipped (target ${Math.round(tgtFill * 100)}% > ${Math.round(tgtGate * 100)}%)`);
          continue;
        }
        const headroom = Math.max(0, tgt.cap - tgt[res]);
        const amount = Math.floor(Math.min(headroom, src.tradeCap, surplus));
        if (amount < minBatch) continue;
        const job = { from: srcId, to: d.id, wood: 0, stone: 0, iron: 0, reason: 'transport-balance' };
        job[res] = amount;
        jobs.push(job);
        tradeApplyJob(ledger, job);
        if (jobs.length >= TRANSPORT_MAX_JOBS) return true;
        break; // one destination per (source, resource) per scan
      }
    }
    return false;
  }

  // ===== Resource balancing AI (v4 plan 5.1) =================================
  // Greedy one-move-at-a-time over (from, to, resource) triples, scored on how
  // much each move closes the fleet's distance to a per-resource target fill.
  //
  // Greedy, NOT a linear program, and deliberately: the score is linear and the
  // constraints are tight, so a solver would return the same answer at the same
  // cost while adding a dependency this paste-only repo cannot validate against
  // fixtures. 192 triples is sub-millisecond; the honest win is that the whole
  // pass is reviewable in one screen.
  const AI_TARGET_FILL = { wood: 0.60, stone: 0.50, iron: 0.30 };
  const AI_MAX_JOBS = 6;
  const AI_SRC_FILL = 0.85;
  const AI_TGT_FILL = 0.25;
  // Profile bias in -1..+1 becomes a weight in [0.25, 2.0]: an extreme +1 must
  // tilt the ranking, not dominate it 8x.
  function transportAiWeight(townId, res) {
    const b = transportBias(townId, res);
    return Math.max(0.25, Math.min(2.0, 1 + b));
  }
  function transportAiTownScore(l, townId) {
    if (!l || !(l.cap > 0)) return 0;
    let s = 0;
    for (const r of GB_RES_KEYS) {
      const fill = (+l[r] || 0) / l.cap;
      s += transportAiWeight(townId, r) * Math.abs(fill - AI_TARGET_FILL[r]);
    }
    return s;
  }
  // Lower is better: the score is a DISTANCE from the target fill.
  function transportAiScore(ledger, ids) {
    let s = 0;
    for (const id of ids) s += transportAiTownScore(ledger[id] || ledger[+id], id);
    return s;
  }
  function transportAiJobs(towns, L) {
    if (!state.autoTransportAi) return [];
    const ledger = L || tradeLedger(towns);
    if (!ledger) return [];
    const ids = towns.map(t => String(t.id));
    const minBatch = transportMinBatch();
    const reserve = transportReservePct();
    const jobs = [];
    for (let round = 0; round < AI_MAX_JOBS; round++) {
      const before = transportAiScore(ledger, ids);
      let best = null;
      for (const from of ids) {
        const src = ledger[from] || ledger[+from];
        if (!src || !(src.cap > 0) || src.tradeCap < minBatch) continue;
        const keep = Math.floor(src.cap * reserve);
        for (const res of GB_RES_KEYS) {
          if ((+src[res] || 0) / src.cap < AI_SRC_FILL) continue;
          if (res === 'iron') {
            // Same cave-first claim every other resource mover honours. Blind
            // is "unknown, not no", so a blind read does not block the move.
            let reserved = false;
            try { const r = ironReservedForCave(from); reserved = !!(r && r.reserved); } catch (_) {}
            if (reserved) continue;
          }
          const surplus = Math.max(0, (+src[res] || 0) - keep);
          if (surplus < minBatch) continue;
          for (const to of ids) {
            if (to === from) continue;
            const tgt = ledger[to] || ledger[+to];
            if (!tgt || !(tgt.cap > 0)) continue;
            if ((+tgt[res] || 0) / tgt.cap > AI_TGT_FILL) continue;
            const room = Math.max(0, tgt.cap - (+tgt[res] || 0));
            // Size the move to the BALANCE POINT, not to the maximum the
            // warehouses allow. Shipping everything a source can spare just
            // moves the imbalance to the other town: 9500/500 becomes
            // 2000/8000 instead of the 6000/4000 the target fill asks for.
            const srcIdeal = Math.max(0, (+src[res] || 0) - AI_TARGET_FILL[res] * src.cap);
            const tgtIdeal = Math.max(0, AI_TARGET_FILL[res] * tgt.cap - (+tgt[res] || 0));
            const amount = Math.floor(Math.min(srcIdeal, tgtIdeal, surplus, src.tradeCap, room));
            if (amount < minBatch) continue;
            // Score the move on a CLONE: transportAiScore must not see a
            // ledger the trial mutated, or every later trial is measured
            // against a different world.
            const probe = Object.create(null);
            for (const id of ids) probe[id] = Object.assign({}, ledger[id] || ledger[+id]);
            const job = { from, to, wood: 0, stone: 0, iron: 0, ai: res };
            job[res] = amount;
            tradeApplyJob(probe, job);
            const delta = transportAiScore(probe, ids) - before;
            // Only a move that actually IMPROVES balance is worth a request.
            if (delta >= 0) continue;
            if (!best || delta < best.delta) best = { job, delta };
          }
        }
      }
      if (!best) break;
      jobs.push(best.job);
      tradeApplyJob(ledger, best.job);
    }
    return jobs;
  }

  function transportBalanceJobs(towns, L) {
    if (!state.autoTransport) return [];
    const ledger = L || tradeLedger(towns);
    if (!ledger) return [];
    const jobs = [];
    const ids = towns.map(t => t.id);
    for (const srcId of ids) {
      if (transportBalanceSourceTown(srcId, ids, ledger, jobs)) break;
    }
    return jobs;
  }
