  // ---------- QoL: pause-on-activity, templates, overview, town groups, health (8.7 / 9.2 / 9.4 / 14.4) ----------
  function qolBindActivityPause() {
    if (qolBindActivityPause._bound) return;
    qolBindActivityPause._bound = true;
    const bump = () => bumpUserActivity();
    ['mousemove', 'keydown', 'mousedown', 'touchstart'].forEach(ev => {
      gbListen(document, ev, bump, { passive: true });
    });
    gbListen(document, 'visibilitychange', () => {
      if (!document.hidden) bumpUserActivity();
    });
  }
  function qolSaveTemplate(name) {
    if (!name) return;
    if (!state.cityTemplates) state.cityTemplates = {};
    state.cityTemplates[name] = {
      abTargets: JSON.parse(JSON.stringify(state.abTargets || {})),
      researchTargets: JSON.parse(JSON.stringify(state.researchTargets || {})),
      recruitTargets: JSON.parse(JSON.stringify(state.recruitTargets || {})),
      savedAt: Date.now(),
    };
    save(STORE.CITY_TEMPLATES, state.cityTemplates);
    gbLog(`template: saved "${name}"`);
    flash('plantilla guardada: ' + name);
  }
  function qolApplyTemplate(name) {
    const t = state.cityTemplates && state.cityTemplates[name];
    if (!t) { flash('falta la plantilla'); return; }
    // Clone - never share references with the stored template (mutate-one = mutate-all).
    if (t.abTargets) {
      state.abTargets = JSON.parse(JSON.stringify(t.abTargets));
      save(STORE.AB_TARGETS, state.abTargets);
    }
    if (t.researchTargets) {
      state.researchTargets = JSON.parse(JSON.stringify(t.researchTargets));
      save(STORE.RESEARCH_TARGETS, state.researchTargets);
    }
    if (t.recruitTargets) {
      state.recruitTargets = JSON.parse(JSON.stringify(t.recruitTargets));
      save(STORE.RECRUIT_TARGETS, state.recruitTargets);
    }
    gbLog(`template: applied "${name}"`);
    flash('plantilla aplicada: ' + name);
    try { renderAbQueue && renderAbQueue(); } catch (_) {}
  }
  function qolSetTownGroup(groupName, townIds) {
    if (!state.townGroups) state.townGroups = {};
    state.townGroups[groupName] = (townIds || []).map(String);
    save(STORE.TOWN_GROUPS, state.townGroups);
  }
  function qolApplyGroupTemplate(groupName, templateName) {
    const ids = (state.townGroups && state.townGroups[groupName]) || [];
    const t = state.cityTemplates && state.cityTemplates[templateName];
    if (!t || !ids.length) { flash('falta el grupo o la plantilla'); return; }
    // Apply recruit targets per town if present
    if (t.recruitTargets) {
      const sample = Object.values(t.recruitTargets)[0] || t.recruitTargets;
      if (!state.recruitTargets) state.recruitTargets = {};
      ids.forEach(id => { state.recruitTargets[id] = JSON.parse(JSON.stringify(sample)); });
      save(STORE.RECRUIT_TARGETS, state.recruitTargets);
    }
    if (t.abTargets) {
      state.abTargets = JSON.parse(JSON.stringify(t.abTargets));
      save(STORE.AB_TARGETS, state.abTargets);
    }
    if (t.researchTargets) {
      state.researchTargets = JSON.parse(JSON.stringify(t.researchTargets));
      save(STORE.RESEARCH_TARGETS, state.researchTargets);
    }
    gbLog(`group "${groupName}": applied template "${templateName}" -> ${ids.length} towns`);
  }
  function qolOverviewData() {
    const uw = gameUw();
    let townN = 0, farmReady = 0, farmTotal = 0, cultureBusy = 0;
    let buildQ = 0, researchQ = 0, caveFill = [];
    try { townN = Object.keys((uw.ITowns && uw.ITowns.towns) || {}).length; } catch (_) {}
    try {
      const rel = ruralRelModels && ruralRelModels();
      if (rel) {
        farmTotal = rel.length;
        const now = gameNow();
        rel.forEach(r => {
          const a = r.attributes || {};
          if (+a.relation_status === 1 && (!a.lootable_at || +a.lootable_at <= now)) farmReady++;
        });
      }
    } catch (_) {}
    try {
      const models = uw.MM && uw.MM.getModels && uw.MM.getModels().Celebration;
      if (models) cultureBusy = Object.keys(models).length;
    } catch (_) {}
    try {
      const bo = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('BuildingOrder');
      if (bo && bo.models) buildQ = bo.models.length;
    } catch (_) {}
    try {
      const ro = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('ResearchOrder');
      if (ro && ro.models) researchQ = ro.models.length;
    } catch (_) {}
    try {
      const ids = (typeof caveListTownIds === 'function') ? caveListTownIds() : [];
      ids.slice(0, 20).forEach(id => {
        const info = typeof caveTownInfo === 'function' ? caveTownInfo(id) : null;
        if (info && info.hideCap) caveFill.push({ id, pct: Math.round(100 * (info.stored || 0) / info.hideCap) });
      });
    } catch (_) {}
    const breakers = Object.keys(state.captchaBreakers || {}).filter(k => captchaPaused(k));
    const pause = {};
    automationPaused(pause);
    return {
      townN, farmReady, farmTotal, cultureBusy, buildQ, researchQ, caveFill,
      breakers, pause: pause.reason || null,
      health: Object.assign({}, moduleHealth),
      globalCaptcha: captchaGlobalUntil > Date.now() ? captchaGlobalUntil : 0,
      userPause: userPausedUntil > Date.now() ? userPausedUntil : 0,
    };
  }
  function renderOverview() {
    const box = panel && panel.querySelector('.overview-panel');
    if (!box) return;
    const sec = box.closest('section[data-tab]');
    if (sec && sec.hidden) return;
    const d = qolOverviewData();
    const lines = [
      `Ciudades: ${d.townN}`,
      `Granjas listas: ${d.farmReady}/${d.farmTotal}`,
      `Cultura ocupada: ${d.cultureBusy}`,
      `Cola de construcción: ${d.buildQ} | Cola de investigación: ${d.researchQ}`,
      d.pause ? `|| en pausa: ${d.pause}` : 'Automatización: activa',
      d.breakers.length ? `Captcha: ${d.breakers.join(',')}` : 'Captcha: despejado',
      (() => {
        const parts = Object.keys(d.health).map(k => {
          const h = d.health[k];
          return `${k} ok${h.ok}/err${h.err}/cap${h.captcha}`;
        });
        return 'Salud: ' + (parts.length ? parts.join('  |  ') : '(aún nada)');
      })(),
    ];
    box.textContent = lines.join('\n');
  }
  // Config dumps carry other players' names (note keys are player/alliance
  // names) and watchlist rules. The Config tab "Redact names/ids in Copy +
  // Export" toggle promised to cover Export but only ever reached the findings
  // dump, so Export config leaked raw names off-box. Redacted dumps are marked
  // and refused by qolImportConfig -- importing hashes would corrupt the notes.
  function qolRedactConfigDump(dump) {
    if (state.exportRedact === false) {
      gbLogT('cfg-export-raw', 60000, 'export config: redaction OFF - dump contains player names');
      return dump;
    }
    const cut = (s) => (s ? String(s).slice(0, 1) + '...' : s);
    const redactNotes = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      const out = {};
      Object.keys(obj).forEach((k, i) => { out[cut(k) + i] = '<note>'; });
      return out;
    };
    dump.playerNotes = redactNotes(dump.playerNotes);
    dump.allianceNotes = redactNotes(dump.allianceNotes);
    dump.watchlist = (dump.watchlist || []).map((w) => {
      if (!w || typeof w !== 'object') return cut(w);
      const out = {};
      Object.keys(w).forEach((k) => { out[k] = typeof w[k] === 'string' ? cut(w[k]) : w[k]; });
      return out;
    });
    dump.redacted = true;
    return dump;
  }
  function qolExportConfig() {
    const dump = {
      ver: state.configVer || 1,
      host: location.host,
      abTargets: state.abTargets,
      researchTargets: state.researchTargets,
      recruitTargets: state.recruitTargets,
      cityTemplates: state.cityTemplates,
      townGroups: state.townGroups,
      cultureTypes: state.cultureTypes,
      favorCfg: state.favorCfg,
      wonderCfg: state.wonderCfg,
      merchantWish: state.merchantWish,
      priorityOrder: state.priorityOrder,
      playerNotes: state.playerNotes,
      allianceNotes: state.allianceNotes,
      watchlist: state.watchlist,
    };
    return qolRedactConfigDump(dump);
  }
  function qolImportConfig(obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (obj.redacted) {
      gbLog('config import refused: dump is redacted (re-export with redaction OFF)');
      return false;
    }
    const keys = ['abTargets', 'researchTargets', 'recruitTargets', 'cityTemplates', 'townGroups',
      'cultureTypes', 'favorCfg', 'wonderCfg', 'merchantWish', 'priorityOrder', 'playerNotes',
      'allianceNotes', 'watchlist'];
    keys.forEach(k => {
      if (obj[k] != null) {
        state[k] = obj[k];
        const storeKey = {
          abTargets: STORE.AB_TARGETS,
          researchTargets: STORE.RESEARCH_TARGETS,
          recruitTargets: STORE.RECRUIT_TARGETS,
          cityTemplates: STORE.CITY_TEMPLATES,
          townGroups: STORE.TOWN_GROUPS,
          cultureTypes: STORE.CULTURE_TYPES,
          favorCfg: STORE.FAVOR_CFG,
          wonderCfg: STORE.WONDER_CFG,
          merchantWish: STORE.MERCHANT_WISH,
          priorityOrder: STORE.PRIORITY_ORDER,
          playerNotes: STORE.PLAYER_NOTES,
          allianceNotes: STORE.ALLIANCE_NOTES,
          watchlist: STORE.WATCHLIST,
        }[k];
        if (storeKey) save(storeKey, state[k]);
      }
    });
    state.configVer = (obj.ver || 1);
    save(STORE.CONFIG_VER, state.configVer);
    gbLog('config imported');
    return true;
  }
