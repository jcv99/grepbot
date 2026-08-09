  function recruitUnitDef(unitId) {
    try {
      const uw = gameUw();
      return (uw.GameData && uw.GameData.units && uw.GameData.units[unitId]) || null;
    } catch (_) { return null; }
  }
  function recruitControllerFor(unitId) {
    const def = recruitUnitDef(unitId);
    if (!def) return null;
    if (def.is_naval || def.naval) return { controller: 'building_docks', feature: 'recruit' };
    return { controller: 'building_barracks', feature: 'recruit' };
  }
  function recruitHasSpell(townId, powerId) {
    try {
      const uw = gameUw();
      const col = uw.MM && uw.MM.getFirstTownAgnosticCollectionByName &&
        uw.MM.getFirstTownAgnosticCollectionByName('CastedPowers');
      const frag = col && col.fragments && col.fragments[townId];
      const models = (frag && frag.models) || [];
      return models.some(m => {
        const pid = (m.attributes || {}).power_id;
        if (powerId) return pid === powerId;
        return RECRUIT_SPELLS.includes(pid);
      });
    } catch (_) { return false; }
  }
  function recruitSpellGateOk(townId, powerId) {
    if (!powerId || !RECRUIT_SPELLS.includes(powerId)) return { ok: false, why: 'bad-power' };
    const academy = gbBuildingLevel(townId, 'academy');
    if (academy != null && academy < 1) return { ok: false, why: 'no-academy' };
    const god = recruitTownGod(townId);
    if (!god) return { ok: false, why: 'no-town-god' };
    return { ok: true, why: null };
  }
  function recruitSpellCooldown(townId, powerId) {
    const map = state.spellCooldown || (state.spellCooldown = {});
    const t = map[String(townId)] || (map[String(townId)] = {});
    const until = +t[powerId] || 0;
    return until > Date.now() ? until - Date.now() : 0;
  }
  function recruitSpellCooldownStamp(townId, powerId, ms) {
    if (!state.spellCooldown) state.spellCooldown = {};
    const t = state.spellCooldown[String(townId)] || (state.spellCooldown[String(townId)] = {});
    t[powerId] = Date.now() + (ms || 30 * 60 * 1000);
  }
  function recruitCastSpell(townId, powerId, onDone) {
    if (!powerId || !RECRUIT_SPELLS.includes(powerId)) return onDone && onDone('bad-power');
    const pre = recruitSpellGateOk(townId, powerId);
    if (!pre.ok) { gbLogT('spell-precond-' + townId, 300000, `spell: blocked precheck (${pre.why})`); return onDone && onDone('skip:' + pre.why); }
    const left = recruitSpellCooldown(townId, powerId);
    if (left > 0) { gbLogT('spell-cooldown-' + townId, 60000, `spell: cooldown ${Math.ceil(left/1000)}s left`); return onDone && onDone('skip:cooldown'); }
    gameAjaxPost('spell', 'town_overviews', 'cast_power', {
      power_id: powerId,
      town_id: +townId,
    }, onDone);
  }
  function recruitBuild(townId, unitId, amount, onDone) {
    const ctrl = recruitControllerFor(unitId);
    if (!ctrl) return onDone && onDone('unknown-unit');
    gameAjaxPost('recruit', ctrl.controller, 'build', {
      unit_id: unitId,
      amount: +amount,
      town_id: +townId,
    }, onDone);
  }
  function recruitRequiredBuildings(def) {
    const out = {};
    const absorb = (x) => {
      if (!x) return;
      if (Array.isArray(x)) {
        x.forEach(v => {
          if (!v || typeof v !== 'object') return;
          const id = v.building_id || v.building || v.id || v.type;
          const lvl = +(v.level ?? v.min_level ?? v.value);
          if (id && Number.isFinite(lvl)) out[id] = Math.max(out[id] || 0, lvl);
        });
      } else if (typeof x === 'object') {
        Object.entries(x).forEach(([id, raw]) => {
          const lvl = +(raw && typeof raw === 'object' ? (raw.level ?? raw.min_level ?? raw.value) : raw);
          if (Number.isFinite(lvl)) out[id] = Math.max(out[id] || 0, lvl);
        });
      }
    };
    absorb(def.building_dependencies); absorb(def.required_buildings); absorb(def.requirements && def.requirements.buildings);
    if (def.required_building) {
      const id = typeof def.required_building === 'string' ? def.required_building : (def.required_building.id || def.required_building.building_id);
      const lvl = typeof def.required_building === 'object' ? +(def.required_building.level ?? def.required_building.min_level ?? 1) : 1;
      if (id) out[id] = Math.max(out[id] || 0, Number.isFinite(lvl) ? lvl : 1);
    }
    return out;
  }
  function recruitTownGod(townId) {
    try {
      const t = gbTownModel(townId);
      if (!t) return null;
      if (typeof t.getGod === 'function') { const g = t.getGod(); if (g) return String(g).toLowerCase(); }
      const a = t.attributes || {};
      const g = a.god || a.god_id || a.deity;
      return g ? String(g).toLowerCase() : null;
    } catch (_) { return null; }
  }
  function recruitResearchDeps(def) {
    const need = def.research_required || def.research_dependencies || def.required_researches;
    if (!need) return [];
    if (Array.isArray(need)) return need.map(x => typeof x === 'string' ? x : (x && (x.id || x.research_id || x.research_type))).filter(Boolean);
    if (typeof need === 'string') return [need];
    if (typeof need === 'object') return Object.keys(need).filter(k => need[k]);
    return [];
  }
  function recruitCanBuild(townId, unitId) {
    const def = recruitUnitDef(unitId);
    if (!def) return false;
    try {
      const t = gbTownModel(townId);
      if (!t) return false;
      const rdeps = recruitResearchDeps(def);
      if (rdeps.length) {
        const info = typeof researchTownTechs === 'function' ? researchTownTechs(townId) : null;
        if (!info || !info.techs) return false;
        for (const tech of rdeps) if (!info.techs[tech]) return false;
      }
      let buildings = null;
      try { const b = t.getBuildings ? t.getBuildings() : (t.buildings && t.buildings()); buildings = b && (b.attributes || b); } catch (_) {}
      if (!buildings) return false;
      const bdeps = recruitRequiredBuildings(def);
      for (const [bid, lvl] of Object.entries(bdeps)) if (+(buildings[bid] || 0) < +lvl) return false;
      if (def.is_naval || def.naval) {
        const docksNeed = +(def.docks_level ?? def.harbor_level ?? def.required_docks_level ?? 1);
        if (+(buildings.docks || 0) < (Number.isFinite(docksNeed) ? docksNeed : 1)) return false;
      } else {
        const barracksNeed = +(def.barracks_level ?? def.required_barracks_level ?? 1);
        if (+(buildings.barracks || 0) < (Number.isFinite(barracksNeed) ? barracksNeed : 1)) return false;
      }
      if (def.god || def.mythical || def.is_mythical) {
        const requiredGod = def.god ? String(def.god).toLowerCase() : null;
        const townGod = recruitTownGod(townId);
        if (requiredGod && (!townGod || townGod !== requiredGod)) return false;
        const templeNeed = +(def.temple_level ?? def.required_temple_level ?? 1);
        if (+(buildings.temple || 0) < (Number.isFinite(templeNeed) ? templeNeed : 1)) return false;
        const favorCost = +(def.favor ?? (def.resources && def.resources.favor) ?? 0);
        if (favorCost > 0) {
          if (!requiredGod) return false;
          const fav = favorCurrent();
          const haveFavor = +(fav[requiredGod] ?? fav['favor_' + requiredGod]);
          if (!Number.isFinite(haveFavor) || haveFavor < favorCost) return false;
        }
      }
      return true;
    } catch (_) { return false; }
  }
  function recruitQueueInfo(townId,unitId) {
    const t = gbTownModel(townId);
    if (!t) return { known: false, len: 0, max: null, models: [] };
    let col = null, models = [];
    try { col = t.getUnitOrdersCollection && t.getUnitOrdersCollection();if(!col||!Array.isArray(col.models))return {known:false,len:0,max:null,models:[]};models=col.models.slice(); } catch (_) {return {known:false,len:0,max:null,models:[]}}
    if(unitId){const want=recruitUnitDef(unitId),wantNaval=!!(want&&(want.is_naval||want.naval));models=models.filter(m=>{const a=m.attributes||m,id=a.unit_type||a.unit_id||a.type,d=recruitUnitDef(id);return !d||!!(d.is_naval||d.naval)===wantNaval})}
    let max = null;
    try { if (col && typeof col.getMaxQueueLength === 'function') max = +col.getMaxQueueLength(); } catch (_) {}
    try { if (!(max > 0) && col && col.max_queue_length != null) max = +col.max_queue_length; } catch (_) {}
    try {
      const uw = gameUw();
      const q = uw.GameDataUnitQueue || uw.GameDataUnits;
      if (!(max > 0) && q && typeof q.getQueueMax === 'function') max = +q.getQueueMax(townId);
    } catch (_) {}
    return { known: true, len: models.length, max: max > 0 ? max : null, models };
  }
  function recruitQueuedAmount(townId, unit) {
    const q = recruitQueueInfo(townId);
    let queued = 0;
    for (const m of q.models || []) {
      const a = m.attributes || {};
      const uid = a.unit_type || a.unit_id || a.type;
      if (String(uid) === String(unit)) queued += +(a.count != null ? a.count : (a.amount != null ? a.amount : a.units)) || 0;
    }
    return queued;
  }
  function recruitQueueHasSpace(townId,unitId) {
    const q = recruitQueueInfo(townId,unitId);
    if (!q.known) return false;
    if (q.max != null) return q.len < q.max;
    // If max cannot be read, fail conservatively: only start when queue is empty.
    return q.len === 0;
  }
  function recruitAffordableAmount(townId, unit, want) {
    const def = recruitUnitDef(unit), t = gbTownModel(townId);
    if (!def || !t || !def.resources) return 0;
    try {
      const r = t.resources && t.resources();
      const pop = t.getAvailablePopulation && +t.getAvailablePopulation();
      if (!r || pop == null) return 0;
      const rw = +def.resources.wood || 0, rs = +def.resources.stone || 0, ri = +def.resources.iron || 0, rp = +def.population || 0;
      let amount = Math.max(0, +want || 0);
      if (rw > 0) amount = Math.min(amount, Math.floor(+r.wood / rw));
      if (rs > 0) amount = Math.min(amount, Math.floor(+r.stone / rs));
      if (ri > 0) amount = Math.min(amount, Math.floor(+r.iron / ri));
      if (rp > 0) amount = Math.min(amount, Math.floor(pop / rp));
      const favorCost = +(def.favor ?? def.resources.favor ?? 0);
      if (favorCost > 0) {
        const god = def.god && String(def.god).toLowerCase();
        const fav = favorCurrent();
        const have = god ? +(fav[god] ?? fav['favor_' + god]) : NaN;
        if (!Number.isFinite(have)) return 0;
        amount = Math.min(amount, Math.floor(have / favorCost));
      }
      return Math.max(0, Math.floor(amount));
    } catch (_) { return 0; }
  }
  function recruitValidateJob(job) {
    if (!recruitCanBuild(job.townId, job.unit)) return { ok: false, why: 'requirements' };
    if (!recruitQueueHasSpace(job.townId,job.unit)) return { ok: false, why: 'queue' };
    const amount = recruitAffordableAmount(job.townId, job.unit, job.amount);
    if (!(amount > 0)) return { ok: false, why: 'resources/pop/favor' };
    return { ok: true, amount: Math.min(amount, job.amount) };
  }

  let recruitNativeCursor=0,recruitLegacyCursor=0;
  function recruitRotate(ids,cursor){if(!ids.length)return ids;const at=Math.max(0,cursor%ids.length);return ids.slice(at).concat(ids.slice(0,at))}
  function recruitScan(reason) {
    const nativePending = nativeQueueHasPending('recruit');
    if (!hostEnabled() || (!state.autoRecruit && !nativePending) || captchaPaused('recruit')) return;
    if (automationPaused({})) return;
    if (gbLocked('recruit')) return;
    const targets = goalEffectiveRecruitTargets();
    const explicitIds=Object.keys(nativeQueueRoot().towns).filter(id=>nativeQueueIsFifo(id,'recruit')&&nativeQueueList(id,'recruit',false).length);
    const legacyIds=Object.keys(targets).filter(id=>!nativeQueueIsFifo(id,'recruit'));
    const townIds=recruitRotate(explicitIds,recruitNativeCursor++).concat(recruitRotate(legacyIds,recruitLegacyCursor++));
    if (!townIds.length) {
      gbLogT('recruit-empty', 300000, 'recruit: no town targets configured');
      return;
    }
    const uw = gameUw();
    let job = null;
    for (const tid of townIds) {
      if (nativeQueueIsFifo(tid, 'recruit')) {
        const explicit = nativeQueueRecruitHead(tid);
        if (!explicit) continue;
        if (!recruitQueueHasSpace(tid,explicit.unit)) { nativeQueueSetJobState(explicit, 'waiting-slot', 'cola real llena'); continue; }
        if (!recruitCanBuild(tid, explicit.unit) || !recruitControllerFor(explicit.unit)) {
          nativeQueueSetJobState(explicit, 'blocked', 'requisitos/controlador'); continue;
        }
        const affordable = recruitAffordableAmount(tid, explicit.unit, explicit.amount);
        if (affordable < +explicit.amount) { nativeQueueSetJobState(explicit, 'waiting-resources', 'recursos/población/favor'); continue; }
        nativeQueueSetJobState(explicit, 'ready', 'listo');
        job = { kind:'build', townId:tid, unit:explicit.unit, amount:+explicit.amount, nativeJobId:explicit.id };
        break;
      }
      const want = targets[tid];
      if (!want || typeof want !== 'object') continue;
      let t = null;
      try { t = uw.ITowns.towns[tid]; } catch (_) {}
      if (!t) continue;
      const have = goalUnitCounts(tid);
      for (const unit of Object.keys(want)) {
        const tgt = +want[unit] || 0;
        if (!(tgt > 0)) continue;
        if (!recruitCanBuild(tid, unit)) continue;
        if (!recruitControllerFor(unit)) continue;
        if (!recruitQueueHasSpace(tid,unit)) continue;
        const cur = +have[unit] || 0;
        const queued = recruitQueuedAmount(tid, unit);
        const need = tgt - cur - queued;
        if (need <= 0) continue;
        let amount = recruitAffordableAmount(tid, unit, need);
        if (!(amount > 0)) continue;
        // A spell is an optional accelerator, never a reason to spend favor when
        // no affordable recruitment can immediately follow it, or to block
        // normal recruiting in SAFE MODE.
        if (state.recruitSpells && !state.safeMode) {
          const wantPower = (state.favorCfg && state.favorCfg.recruitPower) || null;
          if (wantPower && RECRUIT_SPELLS.includes(wantPower) && !recruitHasSpell(tid, wantPower)
              && !captchaPausedAny('recruit', 'spell') && recruitSpellGateOk(tid, wantPower).ok
              && !recruitSpellCooldown(tid, wantPower)) {
            job = { kind:'spell', townId:tid, power:wantPower };
            break;
          }
        }
        amount = Math.min(amount, 50);
        job = { kind: 'build', townId: tid, unit, amount };
        break;
      }
      if (job) break;
    }
    if (!job) {
      gbLogT('recruit-idle', 180000, `recruit: idle (${reason || 'scan'})`);
      return;
    }
    const lockToken = gbLock('recruit');
    if (!lockToken) return;
    if (job.kind === 'spell') {
      recruitCastSpell(job.townId, job.power, (err) => {
        gbUnlock('recruit', lockToken);
        if (!err) gbLog(`spell: ${job.power} on ${job.townId}`);
        else if (err === 'timeout_unknown' || err === 'pending') {
          recruitSpellCooldownStamp(job.townId, job.power);
          gbLog(`spell: outcome unknown (${err}); cooldown 30min — favor is irreversible, manual review required`);
        } else gbLogT('spell-err', 60000, `spell err ${err}`);
      });
      return;
    }
    const valid = recruitValidateJob(job);
    if (!valid.ok) { gbUnlock('recruit', lockToken); gbLogT('recruit-stale-' + job.townId, 60000, `recruit: final precheck blocked (${valid.why})`); return; }
    if (job.nativeJobId && valid.amount < job.amount) {
      const head = nativeQueueList(job.townId, 'recruit', false)[0];
      nativeQueueSetJobState(head, 'waiting-resources', 'cantidad completa no asequible');
      gbUnlock('recruit', lockToken); return;
    }
    job.amount = valid.amount;
    if (job.nativeJobId) {
      const head = nativeQueueList(job.townId, 'recruit', false)[0];
      if (!head || head.id !== job.nativeJobId) { gbUnlock('recruit', lockToken); return; }
      head.manualReview=false;
      head.inflight = { amount:job.amount, at:Date.now() };
      nativeQueueSave();
    }
    recruitBuild(job.townId, job.unit, job.amount, (err) => {
      gbUnlock('recruit', lockToken);
      if (!err) {
        gbLog(`recruit: town ${job.townId} ${job.amount}× ${job.unit}`);
        if (job.nativeJobId) nativeQueueRecruitApplied(job.townId, job.nativeJobId, job.amount);
      } else {
        if (job.nativeJobId) {
          const head = nativeQueueList(job.townId, 'recruit', false)[0];
          if (head && head.id === job.nativeJobId) {
            head.inflight = null;
            const ambiguous=err === 'pending' || err === 'timeout_unknown';head.manualReview=ambiguous;
            nativeQueueSetJobState(head, ambiguous ? 'unknown' : 'blocked', ambiguous?'resultado desconocido; comprobar la cola real':String(err));
          }
        }
        gbLogT('recruit-err', 60000, `recruit err ${err}`);
      }
    });
  }
