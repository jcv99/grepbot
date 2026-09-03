  function transportReservePct() {
    return Math.min(80, Math.max(0, gbCfgNum(state.transportReserve, 20))) / 100;
  }
  function transportMinBatch() {
    return Math.min(10000, Math.max(100, gbCfgNum(state.transportMin, 1000)));
  }

  function transportProduction(townId) {
    let t = null;
    try {
      const uw = gameUw();
      t = gbTownModel(townId);
    } catch (_) {}
    if (!t) return null;
    let p = null;
    try { p = t.getProduction ? t.getProduction() : (t.production && t.production()); } catch (_) {}
    if (!p || typeof p !== 'object') return null;

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

  function transportProjectHeadroom(townId, deltaMs) {
    const st = transportTownRes(townId);
    if (!st || !(st.cap > 0)) return { woodFree: null, stoneFree: null, ironFree: null, blind: true };
    const inc = tradeIncomingByTown();

    if (!inc.known) return { woodFree: null, stoneFree: null, ironFree: null, blind: true };
    const mov = inc.byTown[String(townId)] || {};
    const ms = Math.max(0, +deltaMs || 0);

    const out = { blind: false };
    for (const k of GB_RES_KEYS) {
      const rate = st.production ? st.production[k] : null;
      if (rate == null) { out[k + 'Free'] = null; out.blind = true; continue; }
      const grown = rate * (ms / 1000);
      const projected = (+st[k] || 0) + (+mov[k] || 0) + grown;
      out[k + 'Free'] = Math.max(0, st.cap - projected);
    }
    return { woodFree: out.woodFree, stoneFree: out.stoneFree, ironFree: out.ironFree, blind: out.blind };
  }

  function transportTownETA(townId, resource, targetFillPct) {
    if (!GB_RES_KEYS.includes(resource)) return null;
    const st = transportTownRes(townId);
    if (!st || !(st.cap > 0)) return { ms: null, blind: true };
    if (!st.production || st.production[resource] == null) return { ms: null, blind: true };
    const want = Math.max(0, Math.min(1, +targetFillPct || 0)) * st.cap;
    const key = resource + 'Free';

    let delta = TRANSPORT_ETA_MAX_MS / 128;
    for (let i = 0; i < 8 && delta <= TRANSPORT_ETA_MAX_MS; i++) {
      const h = transportProjectHeadroom(townId, delta);
      if (h[key] == null) return { ms: null, blind: true };
      if (st.cap - h[key] >= want) return { ms: delta, blind: false };
      delta *= 2;
    }
    return null;
  }

  function transportBias(townId, res) {
    let p = null;
    try { p = goalEffective(townId); } catch (_) {}
    const v = p && p.resource ? +p.resource[res] : 0;
    return Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
  }

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

    let ironKeep = keep;
    try {
      const r = ironReservedForCave(srcId);
      if (r && r.reserved) {
        const rawThresh = (state.caveThreshPct == null) ? 90 : +state.caveThreshPct;
        const thresh = gbCfgClamp(rawThresh, 50, 99, 90) / 100;
        ironKeep = Math.max(keep, Math.ceil(src.cap * thresh));
        gbLogT('transport-iron-reserved-' + srcId, 600000,
          `transport: town ${srcId} iron held for cave (keep ${ironKeep})`);
      } else if (r && r.blind) {
        gbLogT('transport-iron-blind-' + srcId, 600000,
          `transport: town ${srcId} cave reserve unreadable - no iron deduction`);
      }
    } catch (_) {}

    for (const res of GB_RES_KEYS) {

      if (src.tradeCap < minBatch) return false;
      if (src[res] / src.cap < TRANSPORT_SRC_FILL) continue;
      const srcKeep = res === 'iron' ? ironKeep : keep;
      const surplus = Math.max(0, src[res] - srcKeep);
      if (surplus < minBatch) continue;

      if (transportBias(srcId, res) > 0) continue;

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
        break;
      }
    }
    return false;
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

  const DUMP_MAX_JOBS = 4;
