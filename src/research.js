  function researchCandidate(townId, tech, targets, info) {
    const tgt = (targets || {})[tech] || {};
    let missing = null;
    try {
      const p = researchPathFor(townId, tech);
      if (p && p.known) missing = p.missing.length;
    } catch (_) {}

    let profiled = false;
    try {
      const e = goalEffective(townId);
      profiled = !!(e && e.research && +e.research[tech] > 0);
    } catch (_) {}
    let points = null;
    try { const n = researchPointsAvailable(townId, info); if (Number.isFinite(n)) points = n; } catch (_) {}

    let cost = null;
    try {
      const d = gbGameDataLookup("researches", tech);
      if (d) {
        for (const k of ['research_points', 'researchPoints', 'points', 'cost_points']) {
          const n = gbNum(d[k]);
          if (n != null && n > 0) { cost = n; break; }
        }
      }
    } catch (_) {}
    return {
      townId: String(townId), tech,
      order: +tgt.order || 0,
      missing, profiled, points, cost,

      slack: (points != null && cost != null) ? points - cost : null,
    };
  }
  function researchCandidateCmp(a, b) {

    if (a.profiled !== b.profiled) return a.profiled ? -1 : 1;

    const am = a.missing == null ? Infinity : a.missing;
    const bm = b.missing == null ? Infinity : b.missing;
    if (am !== bm) return am - bm;

    const as = a.slack == null ? -Infinity : a.slack;
    const bs = b.slack == null ? -Infinity : b.slack;
    if (as !== bs) return bs - as;

    if (a.order !== b.order) return a.order - b.order;
    return String(a.townId).localeCompare(String(b.townId));
  }
  function researchCandidateWhy(c) {
    const parts = [];
    if (c.profiled) parts.push('perfil');
    parts.push(c.missing == null ? 'prerreq ?' : `prerreq ${c.missing}`);
    if (c.slack != null) parts.push(`holgura ${c.slack}`);
    parts.push(`orden ${c.order}`);
    return parts.join(', ');
  }
  function researchAdviseOrder(townId, ordered, targets, info) {
    try {
      const graph = researchGraphBuild();
      if (!graph.known) {
        gbLogT('research-graph-blind', 600000, `research graph blind: ${graph.why}`);
        return ordered;
      }

      const queued = (info && info.ordersKnown ? info.orders : []).map(researchOrderTechId).filter(x => x != null);
      const have = researchHaveSet(info, queued);
      const idx = t => (+((targets || {})[t] || {}).order || 0);
      const ranked = researchGraphRank(graph, ordered, have, idx);
      if (graph.blind) gbLogT('research-graph-partial', 600000, `research graph partial: ${graph.why}`);
      return ranked.map(r => r.tech);
    } catch (e) {
      gbLogT('research-graph-err', 600000, 'research graph: ' + String(e).slice(0, 60));
      return ordered;
    }
  }

  function researchPathFor(townId, target) {
    const graph = researchGraphBuild();
    if (!graph.known) return { known: false, blind: true, target, missing: [], why: graph.why };
    const info = researchTownTechs(townId);
    if (!info) return { known: false, blind: true, target, missing: [], why: 'town unreadable' };
    if (!info.techs) return { known: false, blind: true, target, missing: [], why: 'researched flags unreadable' };
    const queued = (info.ordersKnown ? info.orders : []).map(researchOrderTechId).filter(x => x != null);
    const c = researchGraphClosure(graph, target, researchHaveSet(info, queued));
    return {
      known: !c.blind,
      blind: c.blind,
      target,
      ordersKnown: !!info.ordersKnown,
      missing: c.missing.map(id => ({ id, label: researchLabel(id) || id })),
      why: c.why || (c.blind ? 'camino no legible' : ''),
    };
  }

  function researchNextTargetFor(townId) {
    try {
      const info = researchTownTechs(townId);
      if (!info) return null;

      const targets = goalEffectiveResearchTargets(townId, state.researchTargets || {});
      const ordered = Object.keys(targets)
        .filter(t => targets[t] && targets[t].tgt && !(info.techs || {})[t])
        .sort((a, b) => (+targets[a].order || 0) - (+targets[b].order || 0));
      if (!ordered.length) return null;
      return researchAdviseOrder(townId, ordered, targets, info)[0] || null;
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

  function researchResMod(townId) {
    try {
      const uw = gameUw();
      const g = uw.GeneralModifications;
      if (!(g && g.getResearchResourcesModification)) return null;
      const v = gbNum(g.getResearchResourcesModification(townId != null ? townId : (uw.Game && uw.Game.townId)));
      return v != null && v > 0 ? v : null;
    } catch (_) { return null; }
  }
  function researchCost(tech, townId) {
    const d = gbGameDataLookup("researches", tech);
    if (!d) return null;
    const src = d.resources || d.costs || d.cost || d;
    const cost = {
      wood: gbNum(src.wood),
      stone: gbNum(src.stone),
      iron: gbNum(src.iron),
    };
    if (cost.wood == null || cost.stone == null || cost.iron == null) return null;
    if (!(cost.wood || cost.stone || cost.iron)) return null;

    const mod = researchResMod(townId);
    if (mod != null && mod !== 1) {
      cost.wood = Math.ceil(cost.wood * mod);
      cost.stone = Math.ceil(cost.stone * mod);
      cost.iron = Math.ceil(cost.iron * mod);
    }
    return cost;
  }
  function researchPointCost(tech) {
    const d = gbGameDataLookup("researches", tech);
    if (!d) return null;
    const v = gbProbeAttr(d, ['research_points', 'research_points_cost', 'points', 'research_point_cost']);
    return v != null && v > 0 ? v : null;
  }
  function researchConstant(name) {
    try {
      const c = gameUw().Game && gameUw().Game.constants && gameUw().Game.constants.academy;
      const v = c ? +c[name] : NaN;
      return isFinite(v) ? v : null;
    } catch (_) { return null; }
  }

  function researchAcademyTearingDown(townId) {
    try {
      const t = gbTownModel(townId);
      const col = t && ((t.buildingOrders && t.buildingOrders())
        || (t.getCollection && t.getCollection('building_orders')));
      if (!col) return null;
      if (col.isBuildingTearingDown) return !!col.isBuildingTearingDown('academy');
      const models = col.models || [];
      for (const m of models) {
        const a = (m && m.attributes) || {};
        const bid = (m && m.getBuildingId && m.getBuildingId()) || a.building_id;
        if (String(bid) !== 'academy') continue;
        if (m.isBeingTearingDown) { if (m.isBeingTearingDown()) return true; continue; }
        if (a.level_to != null && a.level_from != null && +a.level_to < +a.level_from) return true;
      }
      return false;
    } catch (_) { return null; }
  }

  function researchPointsSpent(info) {
    if (!info || !info.techs) return null;

    if (!info.ordersKnown) return null;
    let all = null;
    try { all = gameUw().GameData && gameUw().GameData.researches; } catch (_) {}
    if (!all || typeof all !== 'object') return null;
    const queued = new Set();
    (info.orders || []).forEach(o => { const id = researchOrderTechId(o); if (id != null) queued.add(String(id)); });
    let sum = 0;
    for (const k of Object.keys(all)) {
      if (!info.techs[k] && !queued.has(String(k))) continue;
      const pts = gbProbeAttr(all[k], ['research_points', 'research_points_cost', 'points', 'research_point_cost']);
      if (pts == null) return null;
      sum += pts;
    }
    return sum;
  }

  function researchPointsAvailable(townId, info) {
    const t = (info && info.town) || gbTownModel(townId);

    const direct = gbProbeNum(t, ['getAvailableResearchPoints', 'getFreeResearchPoints', 'getResearchPoints']);
    if (direct != null) return direct;
    if (!info) return null;
    const perAcademy = researchConstant('points_per_academy_level');
    if (perAcademy == null) return null;
    if (info.academy == null) return null;
    const acad = +info.academy;
    if (!isFinite(acad) || acad < 0) return null;
    const level = researchAcademyTearingDown(townId) === true ? Math.max(0, acad - 1) : acad;
    let current = level * perAcademy;
    if (info.library == null) return null;
    if (info.library === 1) {
      const perLibrary = researchConstant('points_per_library_level');
      if (perLibrary == null) return null;
      current += perLibrary;
    }
    const spent = researchPointsSpent(info);
    if (spent == null) return null;
    return current - spent;
  }

  function researchCanAfford(townId, tech, info) {
    let blind = false;
    let blindWhy = null;

    if (!gbGameDataLookup("researches", tech)) return { ok: false, blind: false, why: 'tech unknown' };
    const needPts = researchPointCost(tech);
    const have = researchPointsAvailable(townId, info);
    if (needPts == null || have == null) {
      blind = true;
      blindWhy = needPts == null ? 'research point cost unreadable' : 'available research points unreadable';
      gbLogT('research-blind-pts-' + townId, 600000,
        `research: ${blindWhy} @${townId} - letting the server decide`);
    } else if (have < needPts) {
      return { ok: false, blind: false, why: `points ${have}/${needPts}` };
    }
    const cost = researchCost(tech, townId);
    if (!cost) {
      gbLogT('research-blind-cost-' + tech, 600000, `research: resource cost for ${tech} unreadable - letting the server decide`);
      return { ok: true, blind: true, why: 'resource cost unreadable' };
    }
    const aff = gbAfford(townId, cost);
    const readShort = (aff.short || []).filter(s => !/unreadable/.test(s));
    if (readShort.length) return { ok: false, blind: false, why: readShort.join(', ') };
    if (aff.blind) {
      gbLogT('research-blind-res-' + townId, 600000, `research: ${aff.detail || 'resources unreadable'} @${townId} - letting the server decide`);
      return { ok: true, blind: true, why: aff.detail || 'resources unreadable' };
    }
    return { ok: true, blind, why: blindWhy };
  }

  function researchPayload(townId, techId) {
    const tid = gbNum(townId);
    if (tid == null) return null;
    return {
      model_url: 'ResearchOrder',
      action_name: 'research',
      arguments: { id: String(techId) },
      town_id: tid,
    };
  }

  const RESEARCH_ENDPOINT = 'ResearchOrder/research';

  function researchSkipWhy(townId, tech) {
    return gbSkipActiveWrite('research', 'bridge', RESEARCH_ENDPOINT, researchPayload(townId, tech));
  }
  function researchPost(townId, techId, onDone) {
    const payload = researchPayload(townId, techId);
    if (!payload) return onDone && onDone('town-unreadable');
    bridgePost('research', payload, onDone);
  }
  function researchOrderTechId(order) {
    try {
      const a = (order && order.attributes) || order || {};
      return a.research_type || a.research_id || a.research || a.type || a.id || null;
    } catch (_) { return null; }
  }

  function researchDepsVerdict(townId, info, tech) {
    try {
      const uw = gameUw();
      const def = uw.GameData && uw.GameData.researches && uw.GameData.researches[tech];

      if (!def) return { ok: false, blind: false, why: 'tech unknown' };
      if (!info || !info.town) return { ok: false, blind: true, why: 'town unreadable' };
      if (!info.techs) return { ok: false, blind: true, why: 'researched flags unreadable' };
      const rdeps = def.research_dependencies || def.dependencies || [];
      const depList = Array.isArray(rdeps) ? rdeps : Object.keys(rdeps || {}).filter(k => rdeps[k]);
      for (const d of depList) {
        const id = typeof d === 'string' ? d : (d && (d.id || d.research_id || d.research_type));
        if (id && !info.techs[id]) return { ok: false, blind: false, why: `requiere ${id}` };
      }
      const bdeps = def.building_dependencies || def.required_buildings || {};
      let buildings = null;
      try {
        const b = info.town.getBuildings ? info.town.getBuildings() : (info.town.buildings && info.town.buildings());
        buildings = b && (b.attributes || b);
      } catch (_) { buildings = null; }
      if (!buildings) return { ok: false, blind: true, why: 'building levels unreadable' };
      for (const b of Object.keys(bdeps || {})) {
        const raw = bdeps[b];
        const need = +(raw && typeof raw === 'object' ? (raw.level ?? raw.min_level ?? raw.value) : raw) || 0;
        const have = +(buildings[b] || 0);
        if (have < need) return { ok: false, blind: false, why: `${b} ${have}/${need}` };
      }
      const academyNeed = +(def.academy_level ?? def.required_academy_level ?? def.building_level ?? def.level ?? 0);
      if (academyNeed > 0 && info.academy == null) return { ok: false, blind: true, why: 'nivel de academia ilegible' };
      if (academyNeed > 0 && +info.academy < academyNeed) return { ok: false, blind: false, why: `academia ${info.academy}/${academyNeed}` };

      if (def.requires_farming_villages && info.smallIsland === true) {
        return { ok: false, blind: false, why: 'isla peque\u00f1a: sin aldeas rurales' };
      }
      const res = def.resources || def.costs || def.cost;
      if (!res || res.wood == null || res.stone == null || res.iron == null) {
        return { ok: false, blind: true, why: 'GameData cost missing' };
      }
      if (researchPointCost(tech) == null) return { ok: false, blind: true, why: 'GameData research_points missing' };
      return { ok: true, blind: false, why: null };
    } catch (e) { return { ok: false, blind: true, why: String(e).slice(0, 60) }; }
  }
  function researchDepsOk(townId, info, tech) {
    const v = researchDepsVerdict(townId, info, tech);
    if (!v.ok && v.blind) {
      gbLogT('research-dep-blind-' + tech, 600000,
        `research: dependency read incomplete for ${tech} (${v.why}) - letting the server decide`);
    }
    return v.ok || v.blind;
  }
  function researchValidateJob(job) {
    const info = researchTownTechs(job.townId);
    if (!info) return { ok: false, why: 'research state unreadable' };

    if (info.academy === 0) return { ok: false, why: 'sin academia' };
    if (info.academy == null) {
      gbLogT('research-academy-blind-' + job.townId, 600000,
        `research: academy level for town ${job.townId} unreadable - letting the server decide`);
    }
    if (info.techs && info.techs[job.tech]) return { ok: false, why: 'already researched' };

    if (!info.ordersKnown) {
      gbLogT('research-orders-unknown-' + job.townId, 600000,
        `research: real research queue for town ${job.townId} unreadable (open that town once)`);
      return { ok: false, why: 'cola real ilegible; abre esa ciudad una vez' };
    }
    if ((info.orders || []).some(o => String(researchOrderTechId(o)) === String(job.tech))) return { ok: false, why: 'already queued' };
    if ((info.orders || []).length >= researchQueueMax()) return { ok: false, why: 'queue full' };
    if (!researchDepsOk(job.townId, info, job.tech)) return { ok: false, why: 'dependencies unavailable/unmet' };
    const aff = researchCanAfford(job.townId, job.tech, info);
    return { ok: aff.ok, why: aff.why };
  }

  function researchNativeStatus(why) {
    const w = String(why || '');
    if (/queue full/.test(w)) return 'waiting-queue';
    if (/^points /.test(w) || /resource|wood|stone|iron/i.test(w)) return 'waiting-resources';
    if (/dependenc/i.test(w)) return 'waiting-requirement';
    return 'blocked';
  }

  const RESEARCH_IDLE_BACKOFF_MS = 20000;
  let researchIdleUntil = 0;
  function researchScan(reason) {
    if (reason === 'native-watch' && Date.now() < researchIdleUntil) return;
    const nativePending = nativeQueueHasPending('research'), cdPending = cityDesignerHasExecutableWork('research');
    if (!hostEnabled() || (!state.autoResearch && !nativePending && !cdPending) || captchaPaused('research')) return;
    if (automationPaused({})) return;
    const globalTargets = researchEnsureTargets();
    let townIds = [];
    try {
      const uw = gameUw();
      townIds = Object.keys((uw.ITowns && uw.ITowns.towns) || {});
    } catch (_) {}
    let job = null;
    for(const tid of townIds)if(nativeQueuePlannerOwnsTown(tid))nativeQueueClearForPlanner(tid,'research-scan',true);

    const explicitIds = Object.keys(nativeQueueRoot().towns)
      .filter(id => !nativeQueuePlannerOwnsTown(id) && nativeQueueIsFifo(id, 'research') && nativeQueueList(id, 'research', false).length);
    for (const tid of explicitIds) {
      const queuedJobs = nativeQueueResearchCandidates(tid);
      for (const item of queuedJobs) {
        const valid = researchValidateJob({ townId: tid, tech: item.tech });
        if (!valid.ok) {
          nativeQueueSetJobState(item, researchNativeStatus(valid.why), String(valid.why || ''));
          // No reservation and no head-of-line blocking: an unaffordable or
          // dependency-blocked research does not stop a later independent one.
          continue;
        }
        const memWhy = researchSkipWhy(tid, item.tech);
        if (memWhy) {
          nativeQueueSetJobState(item, 'blocked', `memoria: ${memWhy}`);
          gbLogT('research-mem-' + tid + '-' + item.tech, 60000, `research: ${item.tech} @${tid} skipped from memory (${memWhy})`);
          continue;
        }
        nativeQueueSetJobState(item, 'ready', 'listo');
        job = { townId: tid, tech: item.tech, nativeJobId: item.id };
        break;
      }
      if (job) break;
    }

    if (job) townIds = []; else if(!state.autoResearch) townIds=townIds.filter(tid=>cdIsProfile(goalTownCfg(tid).profile));
    const candidates = [];
    for (const tid of townIds) {
      if (nativeQueuePlannerOwnsTown(tid)) { if(nativeQueuePlannerLaneBlocked(tid,'research')) continue; } else if (nativeQueueIsFifo(tid, 'research')) continue;
      const targets = goalEffectiveResearchTargets(tid, globalTargets);
      let ordered = Object.keys(targets).sort((a, b) => (+targets[a].order || 0) - (+targets[b].order || 0));
      const info = researchTownTechs(tid);

      if (!info || info.academy === 0) continue;

      if (!info.ordersKnown) {
        gbLogT('research-orders-unknown-' + tid, 600000,
          `research: town ${tid} real research queue unreadable - skipping (open that town once)`);
        continue;
      }
      const queueMax = researchQueueMax();
      if (info.orders.length >= queueMax) continue;
      const queued = new Set();
      info.orders.forEach(o => {
        const id = researchOrderTechId(o);
        if (id != null) queued.add(String(id));
      });

      ordered = researchAdviseOrder(tid, ordered, targets, info);
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
            `research: ${tech} @${tid} skipped from memory (${memWhy}) \u2014 trying next tech`);
          continue;
        }

        candidates.push(researchCandidate(tid, tech, targets, info));
        if (candidates.length >= RESEARCH_CANDIDATE_MAX) break;
      }
      if (candidates.length >= RESEARCH_CANDIDATE_MAX) break;
    }
    if (!job && candidates.length) {
      candidates.sort(researchCandidateCmp);
      const pick = candidates[0];

      job = { townId: pick.townId, tech: pick.tech, cdRevision:cdIsProfile(goalTownCfg(pick.townId).profile)?cdProfileRevision(pick.townId):null };
      if (candidates.length > 1) {
        gbLogT('research-rank', 300000,
          `research: picked ${pick.tech} @${pick.townId} (${researchCandidateWhy(pick)}) from ${candidates.length} candidates`);
      }
    }
    if (!job) {
      researchIdleUntil = Date.now() + RESEARCH_IDLE_BACKOFF_MS;
      gbLogT('research-idle', 180000, `research: idle (${scanReason(reason)})`);
      return;
    }
    researchIdleUntil = 0;
    if(job.cdRevision!=null&&+job.cdRevision!==cdProfileRevision(job.townId)){gbLogT('research-cd-stale-'+job.townId,60000,'research: city-designer revision changed; stale job dropped');return}
    const valid = researchValidateJob(job);
    if (!valid.ok) {
      if (job.nativeJobId) {
        const head = nativeQueueList(job.townId, 'research', false).find(j=>j&&j.id===job.nativeJobId);
        if (head) nativeQueueSetJobState(head, researchNativeStatus(valid.why), String(valid.why || ''));
      }
      researchIdleUntil = Date.now() + RESEARCH_IDLE_BACKOFF_MS;
      gbLogT('research-stale-' + job.townId + '-' + job.tech, 60000, `research: final precheck blocked (${valid.why})`); return;
    }
    const lockName=`research:${String(job.townId)}`;
    const lockToken = gbLock(lockName,120000);
    if (!lockToken) return;
    if (job.nativeJobId) {
      const head = nativeQueueList(job.townId, 'research', false).find(j=>j&&j.id===job.nativeJobId);
      if (!head) { gbUnlock(lockName, lockToken); return; }
      head.manualReview = false;
      head.inflight = { tech: job.tech, at: Date.now() };
      nativeQueueSetJobState(head, 'sending', 'enviando a la cola real');
      nativeQueueSave();
    }
    researchPost(job.townId, job.tech, (err) => {
      gbUnlock(lockName, lockToken);
      if (!err) {
        gbLog(`research: town ${job.townId} \u2192 ${job.tech}`);
        if (job.nativeJobId) nativeQueueResearchApplied(job.townId, job.nativeJobId);
      } else {
        if (job.nativeJobId) {
          const head = nativeQueueList(job.townId, 'research', false).find(j=>j&&j.id===job.nativeJobId);
          if (head) {
            head.inflight = null;

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

  // Dedicated Telegram channel. The bot token is stored only in Tampermonkey
  // storage and is deliberately excluded from config exports, diagnostics and logs.
  function telegramTokenLooksValid(token) {
    return /^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(String(token || '').trim());
  }
  function telegramChatIdLooksValid(chatId) {
    return /^-?\d{4,}$/.test(String(chatId || '').trim());
  }
