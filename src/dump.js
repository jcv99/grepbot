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

  function pickDumpDestination(fromId, res, towns, ledger) {
    const from = String(fromId);
    const ids = towns.map(t => String(t.id)).filter(id => id !== from);
    const roomOf = id => {
      const l = ledger[id] || ledger[+id];
      if (!l || !(l.cap > 0)) return null;
      const have = gbNum(l[res]);
      if (have == null) return null;
      return Math.max(0, l.cap - have);
    };
    const sinks = dumpSinkList().filter(id => ids.includes(id));
    if (sinks.length) {

      const best = sinks.map(id => ({ id, room: roomOf(id) }))
        .filter(x => x.room != null && x.room > 0)
        .sort((a, b) => b.room - a.room)[0];
      return best ? best.id : null;
    }
    const wanted = ids.map(id => ({ id, bias: dumpProfileWants(id, res), room: roomOf(id) }))
      .filter(x => x.bias >= 0.5 && x.room != null && x.room > 0)
      .sort((a, b) => (b.bias - a.bias) || (b.room - a.room))[0];
    if (wanted) return wanted.id;

    let jobs = [];
    try {
      const probe = Object.create(null);
      for (const [k, v] of Object.entries(ledger)) probe[k] = structuredClone(v);
      jobs = transportBalanceJobs(towns, probe) || [];
    } catch (e) { jobs = []; gbLogT('dump-balance-err', 60000, 'dump: transportBalanceJobs threw: ' + String(e).slice(0, 120)); }
    const hit = jobs.find(j => {
      if (String(j.from) !== from) return false;
      const n = gbNum(j[res]);
      return n != null && n > 0;
    });
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

      let perTown = 0;
      for (const res of GB_RES_KEYS) {
        if (src.tradeCap <= 0) break;

        if (perTown >= 1) break;
        const have = gbNum(src[res]);
        if (have == null) continue;
        const fillPct = Math.round(have / src.cap * 100);
        if (fillPct < dumpThresholdFor(res)) continue;
        if (res === 'iron' && typeof caveHasHeadroom === 'function' && caveHasHeadroom(id)) {
          gbLogT('dump-cave-' + id, 600000, `dump: town ${id} iron held - cave still has headroom`);
          continue;
        }
        if (res === 'iron') {
          let caveSkip = false;
          try {
            const r = ironReservedForCave(id);
            if (r && r.reserved) {
              gbLogT('dump-cave-res-' + id, 600000, `dump: town ${id} iron reserved for cave`);
              caveSkip = true;
            }
          } catch (e) {
            gbLogT('dump-cave-err-' + id, 60000, 'dump: ironReservedForCave threw: ' + String(e).slice(0, 120));
            caveSkip = true;
          }
          if (caveSkip) continue;
        }
        const keep = Math.floor(src.cap * dumpKeepPctFor(res) / 100);
        const surplus = Math.max(0, have - keep);

        let amount = Math.floor(surplus * DUMP_SURPLUS_SHARE);
        if (amount <= 0) continue;
        const to = pickDumpDestination(id, res, towns, ledger);
        if (!to) {
          gbLogT('dump-nodest-' + id + '-' + res, 600000, `dump: no destination for ${res} from ${id}`);
          continue;
        }
        const tgt = ledger[to] || ledger[+to];
        if (!tgt || !(tgt.cap > 0)) continue;
        const tgtHave = gbNum(tgt[res]);
        if (tgtHave == null) continue;
        amount = Math.floor(Math.min(amount, src.tradeCap, Math.max(0, tgt.cap - tgtHave)));
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
  function ruralRelModels() {
    try {
      const uw = gameUw();
      const col = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('FarmTownPlayerRelation');
      return (col && col.models) || [];
    } catch (_) { return []; }
  }
