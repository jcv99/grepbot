  // ===== Resource dump automation (v4 plan 3.4) ==============================
  // POLICY layer over the transport planner from plan 1.3: it decides whether a
  // (source, destination, resource) move is ALLOWED, it does not invent a new
  // way to move resources. Every job is shaped like a transport job and goes
  // out through tradeSend, so dry-run, the captcha breaker, the request budget
  // and the decision journal all apply unchanged.
  //
  // HIGH-RISK, default OFF: a trade post is irreversible from the server's
  // side, and an over-eager dump can ship away iron a build order needed
  // between the scan and the post.
  const DUMP_MAX_JOBS = 4;
  const DUMP_SURPLUS_SHARE = 0.5;
  function dumpCfgNum(map, key, def, lo, hi) {
    const v = +((map || {})[key]);
    return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def;
  }
  function dumpThresholdFor(res) {
    return dumpCfgNum(state.dumpThreshold, res, res === 'iron' ? 90 : 95, 50, 100);
  }
  function dumpKeepPctFor(res) {
    return dumpCfgNum(state.dumpKeep, res, 50, 0, 95);
  }
  function dumpSinkList() {
    const raw = state.dumpSinks;
    return Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
  }
  // true only when the cave can still absorb iron here. Unreadable capacity is
  // UNKNOWN, not "full": ironReservedForCave's own comment sets the precedent
  // that a blind read must not silently block the other feature, so a blind
  // cave does NOT reserve the iron.
  function caveHasHeadroom(townId) {
    if (!state.autoCave) return false;
    let info = null;
    try { info = caveTownInfo(townId); } catch (_) { return false; }
    if (!info || !(info.hideLvl > 0)) return false;
    if (info.unlimited) return true;
    if (info.hideCap == null || info.stored == null) return false;
    return info.stored < info.hideCap;
  }
  function dumpProfileWants(townId, res) {
    try {
      const p = goalEffective(townId);
      const v = p && p.resource ? +p.resource[res] : 0;
      return Number.isFinite(v) ? v : 0;
    } catch (_) { return 0; }
  }
  // Three-tier cascade: explicit user sinks, then profile appetite, then the
  // transport planner's own thresholds. Returns a town id or null.
  function pickDumpDestination(fromId, res, towns, ledger) {
    const from = String(fromId);
    const ids = towns.map(t => String(t.id)).filter(id => id !== from);
    const roomOf = id => {
      const l = ledger[id] || ledger[+id];
      if (!l || !(l.cap > 0)) return null;
      return Math.max(0, l.cap - (+l[res] || 0));
    };
    const sinks = dumpSinkList().filter(id => ids.includes(id));
    if (sinks.length) {
      // An explicit sink wins outright, but still only if it has real room -
      // a haul over the target warehouse evaporates on arrival.
      // An explicit sink wins outright, but still only if it has real room -
      // a haul over the target warehouse evaporates on arrival.
      const best = sinks.map(id => ({ id, room: roomOf(id) }))
        .filter(x => x.room != null && x.room > 0)
        .sort((a, b) => b.room - a.room)[0];
      return best ? best.id : null;
    }
    const wanted = ids.map(id => ({ id, bias: dumpProfileWants(id, res), room: roomOf(id) }))
      .filter(x => x.bias >= 0.5 && x.room != null && x.room > 0)
      .sort((a, b) => (b.bias - a.bias) || (b.room - a.room))[0];
    if (wanted) return wanted.id;
    // Tier 3: let the transport planner answer with its own thresholds rather
    // than re-deriving them here - but on a CLONE. transportBalanceJobs calls
    // tradeApplyJob internally, and running it on the shared ledger would
    // deduct resources for jobs we are only inspecting, on top of the real
    // transport pass tradeScan already ran this tick.
    // Tier 3: let the transport planner answer with its own thresholds rather
    // than re-deriving them here - but on a CLONE. transportBalanceJobs calls
    // tradeApplyJob internally, and running it on the shared ledger would
    // deduct resources for jobs we are only inspecting, on top of the real
    // transport pass tradeScan already ran this tick.
    let jobs = [];
    try {
      const probe = Object.create(null);
      for (const [k, v] of Object.entries(ledger)) probe[k] = Object.assign({}, v);
      jobs = transportBalanceJobs(towns, probe) || [];
    } catch (_) { jobs = []; }
    const hit = jobs.find(j => String(j.from) === from && (+j[res] || 0) > 0);
    return hit ? String(hit.to) : null;
  }
  function dumpJobs(towns, L) {
    if (!state.autoDump) return [];
    const ledger = L || tradeLedger(towns);
    if (!ledger) return [];
    const jobs = [];
    for (const t of towns) {
      const id = String(t.id);
      const src = ledger[id] || ledger[t.id];
      if (!src || !(src.cap > 0)) {
        gbLogT('dump-blind-' + id, 600000, `dump: town ${id} capacity unreadable - skipped`);
        continue;
      }
      // ONE basis for both the threshold test and the amount: the ledger, which
      // already counts in-flight arrivals and every deduction made earlier this
      // scan. Testing the threshold against live stock while sizing against the
      // ledger let the same resource keep re-firing as the ledger shrank.
      // ONE basis for both the threshold test and the amount: the ledger, which
      // already counts in-flight arrivals and every deduction made earlier this
      // scan. Testing the threshold against live stock while sizing against the
      // ledger let the same resource keep re-firing as the ledger shrank.
      let perTown = 0;
      for (const res of GB_RES_KEYS) {
        if (src.tradeCap <= 0) break;
        // One job per town per scan: otherwise the first town with three
        // resources over threshold eats the whole per-scan budget and every
        // later town is starved.
        // One job per town per scan: otherwise the first town with three
        // resources over threshold eats the whole per-scan budget and every
        // later town is starved.
        if (perTown >= 1) break;
        const fillPct = Math.round((+src[res] || 0) / src.cap * 100);
        if (fillPct < dumpThresholdFor(res)) continue;
        if (res === 'iron' && caveHasHeadroom(id)) {
          gbLogT('dump-cave-' + id, 600000, `dump: town ${id} iron held - cave still has headroom`);
          continue;
        }
        // Second, independent guard: the cave may be about to need this iron
        // even when the hide is technically full-ish.
        // Second, independent guard: the cave may be about to need this iron
        // even when the hide is technically full-ish.
        if (res === 'iron') {
          try {
            const r = ironReservedForCave(id);
            if (r && r.reserved) {
              gbLogT('dump-cave-res-' + id, 600000, `dump: town ${id} iron reserved for cave`);
              continue;
            }
          } catch (_) {}
        }
        const keep = Math.floor(src.cap * dumpKeepPctFor(res) / 100);
        const surplus = Math.max(0, (+src[res] || 0) - keep);
        // Half the surplus, never all of it: a town that zeroes a resource and
        // then meets a build order that needs it is stranded until the next
        // production cycle.
        // Half the surplus, never all of it: a town that zeroes a resource and
        // then meets a build order that needs it is stranded until the next
        // production cycle.
        let amount = Math.floor(surplus * DUMP_SURPLUS_SHARE);
        if (amount <= 0) continue;
        const to = pickDumpDestination(id, res, towns, ledger);
        if (!to) {
          gbLogT('dump-nodest-' + id + '-' + res, 600000, `dump: no destination for ${res} from ${id}`);
          continue;
        }
        const tgt = ledger[to] || ledger[+to];
        if (!tgt || !(tgt.cap > 0)) continue;
        amount = Math.floor(Math.min(amount, src.tradeCap, Math.max(0, tgt.cap - (+tgt[res] || 0))));
        const minBatch = gbCfgClamp(state.tradeMinBatch, 100, Infinity, 1000);
        if (amount < minBatch) continue;
        const job = { from: id, to, wood: 0, stone: 0, iron: 0, dump: res };
        job[res] = amount;
        jobs.push(job);
        tradeApplyJob(ledger, job);
        perTown++;
        if (jobs.length >= DUMP_MAX_JOBS) return jobs;
      }
    }
    return jobs;
  }
