  function researchEnsureTargets() {
    if (state.researchTargets && typeof state.researchTargets === 'object') return state.researchTargets;
    const t = {};
    RESEARCH_CS_FAST.forEach((k, i) => { t[k] = { order: i, tgt: 1 }; });
    state.researchTargets = t;
    save(STORE.RESEARCH_TARGETS, t);
    return t;
  }
  function researchTownTechs(townId) {
    const uw = gameUw();
    try {
      const t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]);
      if (!t) return null;
      let res = {};
      try { res = (t.researches && t.researches().attributes) || {}; } catch (_) {}
      let acad = 0;
      try { acad = t.getBuildings ? +t.getBuildings().get('academy') : +(t.buildings().attributes || {}).academy; } catch (_) {}
      let orders = [];
      try {
        const col = t.getResearchOrdersCollection && t.getResearchOrdersCollection();
        if (col && col.models) orders = col.models;
        else {
          const mm = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('ResearchOrder');
          if (mm && mm.models) {
            orders = mm.models.filter(m => {
              const a = m.attributes || {};
              return +a.town_id === +townId;
            });
          }
        }
      } catch (_) {}
      return { town: t, techs: res, academy: acad, orders };
    } catch (_) { return null; }
  }

  function researchLabel(key) {
    try {
      const uw = gameUw();
      const r = (uw.GameData && uw.GameData.researches && uw.GameData.researches[key]) || null;
      if (r && (r.name || r.title)) return String(r.name || r.title);
    } catch (_) {}
    return '';
  }

  function researchDef(tech) {
    try {
      const uw = gameUw();
      return (uw.GameData && uw.GameData.researches && uw.GameData.researches[tech]) || null;
    } catch (_) { return null; }
  }

  function researchCost(tech) {
    const d = researchDef(tech);
    if (!d) return null;
    const src = d.resources || d.costs || d.cost || d;
    const cost = {
      wood: +src.wood || 0,
      stone: +src.stone || 0,
      iron: +src.iron || 0,
    };
    if (!(cost.wood || cost.stone || cost.iron)) return null;
    return cost;
  }
  function researchPointCost(tech) {
    const d = researchDef(tech);
    if (!d) return null;
    const v = gbProbeAttr(d, ['research_points', 'research_points_cost', 'points', 'research_point_cost']);
    return v != null && v > 0 ? v : null;
  }
  function researchPointsAvailable(townId, info) {
    const t = (info && info.town) || gbTownModel(townId);
    if (!t) return null;
    const v = gbProbeNum(t, ['getAvailableResearchPoints', 'getFreeResearchPoints', 'getResearchPoints']);
    if (v != null) return v;
    try {
      const r = t.researches && t.researches();
      const a = (r && r.attributes) || {};
      const av = gbProbeAttr(a, ['available_research_points', 'research_points_available', 'points_available']);
      if (av != null) return av;
      const total = gbProbeAttr(a, ['research_points', 'points']);
      const used = gbProbeAttr(a, ['used_research_points', 'points_used']);
      if (total != null && used != null) return total - used;
    } catch (_) {}
    return null;
  }

  function researchCanAfford(townId, tech, info) {
    const needPts = researchPointCost(tech);
    if (needPts == null) return { ok: false, why: 'research point cost unreadable' };
    const have = researchPointsAvailable(townId, info);
    if (have == null) return { ok: false, why: 'available research points unreadable' };
    if (have < needPts) return { ok: false, why: `points ${have}/${needPts}` };
    const cost = researchCost(tech);
    if (!cost) return { ok: false, why: 'resource cost unreadable' };
    const aff = gbAfford(townId, cost);
    if (!aff.ok) return { ok: false, why: aff.detail || 'resources unreadable/insufficient' };
    return { ok: true, why: null };
  }
  function researchPayload(townId, techId) {
    return { id: techId, town_id: +townId };
  }
  const RESEARCH_ENDPOINT = 'building_academy/research';
  // Decision memory is only consulted inside txRun, i.e. AFTER the scan has
  // picked a job, logged it and spent the work. Without this pre-filter the
  // three-strike window was wired blind: the same dead tech was re-selected
  // every cadence, journaled as `remembered`, and no other tech in the town was
  // ever considered because the scan stops at the first candidate.
  function researchSkipWhy(townId, tech) {
    return gbSkipActiveWrite('research', 'ajax', RESEARCH_ENDPOINT, researchPayload(townId, tech));
  }
  function researchPost(townId, techId, onDone) {
    gameAjaxPost('research', 'building_academy', 'research', researchPayload(townId, techId), onDone);
  }
  function researchOrderTechId(order) {
    try {
      const a = (order && order.attributes) || order || {};
      return a.research_type || a.research_id || a.research || a.type || a.id || null;
    } catch (_) { return null; }
  }
  function researchDepsOk(townId, info, tech) {
    try {
      const uw = gameUw();
      const def = uw.GameData && uw.GameData.researches && uw.GameData.researches[tech];
      if (!def || !info || !info.techs || !info.town) return false;
      const rdeps = def.research_dependencies || def.dependencies || [];
      const depList = Array.isArray(rdeps) ? rdeps : Object.keys(rdeps || {}).filter(k => rdeps[k]);
      for (const d of depList) {
        const id = typeof d === 'string' ? d : (d && (d.id || d.research_id || d.research_type));
        if (id && !info.techs[id]) return false;
      }
      const bdeps = def.building_dependencies || def.required_buildings || {};
      let buildings = null;
      try {
        const b = info.town.getBuildings ? info.town.getBuildings() : (info.town.buildings && info.town.buildings());
        buildings = b && (b.attributes || b);
      } catch (_) { buildings = null; }
      if (!buildings) return false;
      for (const b of Object.keys(bdeps || {})) {
        const raw = bdeps[b];
        const need = +(raw && typeof raw === 'object' ? (raw.level ?? raw.min_level ?? raw.value) : raw) || 0;
        const have = +(buildings[b] || 0);
        if (have < need) return false;
      }
      const academyNeed = +(def.academy_level ?? def.required_academy_level ?? def.building_level ?? def.level ?? 0);
      if (academyNeed > 0 && +info.academy < academyNeed) return false;
      const res = def.resources || def.costs || def.cost;
      if (!res || res.wood == null || res.stone == null || res.iron == null) return false;
      if (researchPointCost(tech) == null) return false;
      return true;
    } catch (_) { return false; }
  }
  function researchValidateJob(job) {
    const info = researchTownTechs(job.townId);
    if (!info || !(info.academy > 0)) return { ok: false, why: 'research state unreadable' };
    if (info.techs && info.techs[job.tech]) return { ok: false, why: 'already researched' };
    if ((info.orders || []).some(o => String(researchOrderTechId(o)) === String(job.tech))) return { ok: false, why: 'already queued' };
    if ((info.orders || []).length >= 2) return { ok: false, why: 'queue full' };
    if (!researchDepsOk(job.townId, info, job.tech)) return { ok: false, why: 'dependencies unavailable/unmet' };
    return researchCanAfford(job.townId, job.tech, info);
  }

  // Map researchValidateJob's `why` onto the queue-job status vocabulary the
  // Queue Center and the academy tile controls render.
  function researchNativeStatus(why) {
    const w = String(why || '');
    if (/queue full/.test(w)) return 'waiting-queue';
    if (/^points /.test(w) || /resource|wood|stone|iron/i.test(w)) return 'waiting-resources';
    if (/dependenc/i.test(w)) return 'waiting-requirement';
    return 'blocked';
  }
  // boot.js re-runs this every 5s for as long as anything sits in the virtual
  // research lane. A head that is merely waiting (resources, queue full, memory)
  // does not change in 5s, so an idle sweep re-walks every town, every tech and
  // every GameData lookup 12x/min for nothing. The orchestrator's own cadence is
  // unaffected — only the native watcher backs off.
  const RESEARCH_IDLE_BACKOFF_MS = 20000;
  let researchIdleUntil = 0;
  function researchScan(reason) {
    if (reason === 'native-watch' && Date.now() < researchIdleUntil) return;
    const nativePending = nativeQueueHasPending('research');
    if (!hostEnabled() || (!state.autoResearch && !nativePending) || captchaPaused('research')) return;
    if (automationPaused({})) return;
    if (gbLocked('research')) return;
    const globalTargets = researchEnsureTargets();
    let townIds = [];
    try {
      const uw = gameUw();
      townIds = Object.keys((uw.ITowns && uw.ITowns.towns) || {});
    } catch (_) {}
    let job = null;
    // Explicit FIFO towns first: a town the player queued by hand outranks the
    // target-list planner, and a FIFO town never falls back to it.
    const explicitIds = Object.keys(nativeQueueRoot().towns)
      .filter(id => nativeQueueIsFifo(id, 'research') && nativeQueueList(id, 'research', false).length);
    for (const tid of explicitIds) {
      const head = nativeQueueResearchHead(tid);
      if (!head) continue;
      const valid = researchValidateJob({ townId: tid, tech: head.tech });
      if (!valid.ok) { nativeQueueSetJobState(head, researchNativeStatus(valid.why), String(valid.why || '')); continue; }
      const memWhy = researchSkipWhy(tid, head.tech);
      if (memWhy) {
        nativeQueueSetJobState(head, 'blocked', `memoria: ${memWhy}`);
        gbLogT('research-mem-' + tid + '-' + head.tech, 60000, `research: ${head.tech} @${tid} skipped from memory (${memWhy})`);
        continue;
      }
      nativeQueueSetJobState(head, 'ready', 'listo');
      job = { townId: tid, tech: head.tech, nativeJobId: head.id };
      break;
    }
    // A FIFO job supersedes the planner for this tick. A blocked FIFO head does
    // NOT: the target-list towns are independent and must still be scanned.
    if (job || !state.autoResearch) townIds = [];
    for (const tid of townIds) {
      if (nativeQueueIsFifo(tid, 'research')) continue;
      const targets = goalEffectiveResearchTargets(tid, globalTargets);
      const ordered = Object.keys(targets).sort((a, b) => (+targets[a].order || 0) - (+targets[b].order || 0));
      const info = researchTownTechs(tid);
      if (!info || !(info.academy > 0)) continue;
      const queueMax = 2;
      if (info.orders.length >= queueMax) continue;
      const queued = new Set();
      info.orders.forEach(o => {
        const id = researchOrderTechId(o);
        if (id != null) queued.add(String(id));
      });
      for (const tech of ordered) {
        if (info.techs[tech]) continue;
        if (queued.has(String(tech))) continue;
        const tgt = targets[tech];
        if (!tgt || !tgt.tgt) continue;
        if (!researchDepsOk(tid, info, tech)) continue;
        const aff = researchCanAfford(tid, tech, info);
        if (!aff.ok) {
          gbLogT('research-cant-' + tid + '-' + tech, 300000,
            `research: town ${tid} cannot start ${tech} yet (${aff.why})`);
          continue;
        }
        const memWhy = researchSkipWhy(tid, tech);
        if (memWhy) {
          gbLogT('research-mem-' + tid + '-' + tech, 300000,
            `research: ${tech} @${tid} skipped from memory (${memWhy}) — trying next tech`);
          continue;
        }
        job = { townId: tid, tech };
        break;
      }
      if (job) break;
    }
    if (!job) {
      researchIdleUntil = Date.now() + RESEARCH_IDLE_BACKOFF_MS;
      gbLogT('research-idle', 180000, `research: idle (${reason || 'scan'})`);
      return;
    }
    researchIdleUntil = 0;
    const valid = researchValidateJob(job);
    if (!valid.ok) {
      if (job.nativeJobId) {
        const head = nativeQueueList(job.townId, 'research', false)[0];
        if (head && head.id === job.nativeJobId) nativeQueueSetJobState(head, researchNativeStatus(valid.why), String(valid.why || ''));
      }
      researchIdleUntil = Date.now() + RESEARCH_IDLE_BACKOFF_MS;
      gbLogT('research-stale-' + job.townId + '-' + job.tech, 60000, `research: final precheck blocked (${valid.why})`); return;
    }
    const lockToken = gbLock('research');
    if (!lockToken) return;
    if (job.nativeJobId) {
      const head = nativeQueueList(job.townId, 'research', false)[0];
      if (!head || head.id !== job.nativeJobId) { gbUnlock('research', lockToken); return; }
      head.manualReview = false;
      head.inflight = { tech: job.tech, at: Date.now() };
      nativeQueueSetJobState(head, 'sending', 'enviando a la cola real');
      nativeQueueSave();
    }
    researchPost(job.townId, job.tech, (err) => {
      gbUnlock('research', lockToken);
      if (!err) {
        gbLog(`research: town ${job.townId} → ${job.tech}`);
        if (job.nativeJobId) nativeQueueResearchApplied(job.townId, job.nativeJobId);
      } else {
        if (job.nativeJobId) {
          const head = nativeQueueList(job.townId, 'research', false)[0];
          if (head && head.id === job.nativeJobId) {
            head.inflight = null;
            // timeout/pending is NOT a failure: the post may have landed, so the
            // head goes to manual review instead of being retried blindly.
            const ambiguous = err === 'pending' || err === 'timeout_unknown';
            head.manualReview = ambiguous;
            nativeQueueSetJobState(head, ambiguous ? 'unknown' : 'blocked', ambiguous ? 'resultado desconocido; comprobar la cola real' : String(err));
          }
        }
        gbLogT('research-err', 60000, `research err ${err}`);
      }
    });
  }
  function researchLoadCsFast() {
    const t = {};
    RESEARCH_CS_FAST.forEach((k, i) => { t[k] = { order: i, tgt: 1 }; });
    state.researchTargets = t;
    save(STORE.RESEARCH_TARGETS, t);
    gbLog('research: loaded CS-fast tech list');
  }

  const alertLastSent = Object.create(null);
  const alertPending = Object.create(null);
