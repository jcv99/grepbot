  let banditTimer = null;
  let banditAttackSentAt = 0;
  let banditIdleUntil = 0;
  function banditIdle(ms, cap) { banditIdleUntil = Date.now() + Math.min(ms, cap || 30000); }
  const BANDIT_OFFENSE_IDS = /^(slinger|rider|chariot|catapult|minotaur|manticore|cyclops?|zyklop|harpy|erinys|giant|godsent)$/i;
  function banditIsOffenseUnit(uw, id) {
    if (/^godsent$/i.test(id)) return true;
    try {
      const def = uw.GameData && uw.GameData.units && uw.GameData.units[id];
      const f = def && def.unit_function;
      if (f === 'function_off' || f === 'off') return true;
      if (f === 'function_def' || f === 'def') return false;
      if (f === 'function_both' || f === 'both' || f === 'function_none' || f === 'none') return false;
    } catch (_) {}
    return BANDIT_OFFENSE_IDS.test(id);
  }
  function movementsUnitsModels(uw) {
    try {
      const col = uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('MovementsUnits');
      if (col && col.models) return col.models;
    } catch (_) {}
    try {
      const cols = uw.MM.getCollections && uw.MM.getCollections().MovementsUnits;
      if (cols && cols[0] && cols[0].models) return cols[0].models;
    } catch (_) {}
    try {
      const map = uw.MM.getModels && uw.MM.getModels().MovementsUnits;
      if (map) return Object.keys(map).map(k => map[k]);
    } catch (_) {}
    return [];
  }
  function banditWrongIsland(uw, m) {
    try {
      if (m.hasReward && m.hasReward()) return false;
      if (typeof m.getIslandId !== 'function') return false;
      const campIsland = m.getIslandId();
      if (campIsland == null) return false;
      let townIsland = null;
      try {
        const towns = uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('Town');
        const cur = towns && towns.getCurrentTown && towns.getCurrentTown();
        if (cur && cur.getIslandId) townIsland = cur.getIslandId();
      } catch (_) {}
      if (townIsland == null) {
        try {
          const t = uw.ITowns && uw.ITowns.towns && uw.ITowns.towns[uw.Game.townId];
          if (t && t.getIslandId) townIsland = t.getIslandId();
        } catch (_) {}
      }
      if (townIsland == null) return false;
      return townIsland !== campIsland;
    } catch (_) { return false; }
  }
  function banditViaGame() {
    if (!hostEnabled() || captchaPaused('bandit')) return true;
    const uw = gameUw();
    let m = null;
    try { m = uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('PlayerAttackSpot'); } catch (_) {}
    if (!m || !(uw.gpAjax && uw.gpAjax.ajaxPost)) return false;
    const playerId = uw.Game && uw.Game.player_id;
    if (playerId == null) { gbLogT('bandit-nopid', 60000, 'bandit: Game.player_id missing'); return true; }
    const post = (action_name, args, onDone) => bridgePost('bandit', {
      model_url: `PlayerAttackSpot/${playerId}`, action_name, arguments: args,
      town_id: uw.Game && uw.Game.townId,
    }, onDone);
    try {
      if (typeof m.getLevel === 'function' && m.getLevel() == null) { gbLogT('bandit-none', 300000, 'bandit: no camp on this world'); banditIdle(300000, 300000); return true; }
      if (m.hasReward && m.hasReward()) {
        if (gbLocked('bandit-reward')) {
          gbLogT('bandit-reward-inflight', 10000, 'bandit: reward claim in flight');
          return true;
        }
        const r = (m.getReward && m.getReward()) || {};
        const pid = r.power_id || '';
        const action = (pid.includes('instant') && !pid.includes('favor')) ? 'useReward'
          : (r.stashable ? 'stashReward' : 'useReward');
        gbLock('bandit-reward');
        banditIdleUntil = 0;
        gbLog('bandit: reward claim posted via', action, pid || '(no power_id)');
        post(action, {}, (err) => {
          gbUnlock('bandit-reward');
          if (err) { gbLog('bandit: reward claim failed', err); return; }
          gbLog('bandit: reward claimed via', action, pid || '(no power_id)');
          flash('bandit: reward claimed');
          logBandit('collected');
        });
        return true;
      }
      const cd = m.getCooldownDuration ? m.getCooldownDuration() : 0;
      if (cd > 0) {
        gbLogT('bandit-cd', 60000, `bandit: cooldown ${Math.floor(cd / 60)}m${cd % 60}s left`);
        banditIdle(cd * 1000);
        return true;
      }
      for (const mov of movementsUnitsModels(uw)) {
        const a = (mov && mov.attributes) || {};
        if (a.destination_is_attack_spot || a.destinationIsAttackSpot ||
            a.origin_is_attack_spot || a.originIsAttackSpot) {
          gbLogT('bandit-enroute', 60000, 'bandit: attack already en route');
          banditIdle(15000);
          return true;
        }
      }
      if (Date.now() - banditAttackSentAt < 8000) {
        gbLogT('bandit-sent-guard', 10000, 'bandit: waiting for movement model after attack');
        banditIdle(8000);
        return true;
      }
      const townId = uw.Game && uw.Game.townId;
      if (townId != null && townWarehouseBlocks(townId)) {
        gbLogT('bandit-wh-full', 60000, `bandit: skip attack (warehouse full, mode=${state.farmFullMode})`);
        banditIdle(30000);
        return true;
      }
      if (banditWrongIsland(uw, m)) {
        gbLogT('bandit-island', 60000, 'bandit: camp on other island - switch town or skip');
        banditIdle(30000);
        return true;
      }
      const t = uw.ITowns && uw.ITowns.towns && uw.ITowns.towns[uw.Game.townId];
      if (!t || !t.units) { gbLogT('bandit-notown', 60000, 'bandit: current town units unavailable'); return true; }
      const units = Object.assign({}, t.units());
      delete units.militia;
      Object.keys(units).forEach(u => {
        try {
          const def = uw.GameData && uw.GameData.units && uw.GameData.units[u];
          if (!def || def.is_naval) delete units[u];
        } catch (_) { delete units[u]; }
        if (units[u] != null && !banditIsOffenseUnit(uw, u)) delete units[u];
        if (!units[u]) delete units[u];
      });
      if (!Object.keys(units).length) { gbLogT('bandit-nounits', 60000, 'bandit: no offense units in current town'); banditIdle(30000); return true; }
      post('attack', units, (err) => {
        if (err) {
          banditAttackSentAt = 0;
          gbLog('bandit: attack failed', err);
          return;
        }
        banditAttackSentAt = Date.now();
        gbLog('bandit: ATTACK confirmed', JSON.stringify(units));
        flash('bandit: attack sent');
        logBandit('attack');
      });
      banditAttackSentAt = Date.now();
      gbLog('bandit: ATTACK posted (await confirm)', JSON.stringify(units));
    } catch (e) { gbLog('bandit game-path fail', String(e)); }
    return true;
  }
  function banditScan() {
    if (!state.autoBandit) return;
    if (!hostEnabled() || automationPaused({}) || captchaPaused('bandit')) {
      banditScheduleNext();
      return;
    }
    if (Date.now() < banditIdleUntil) {
      banditScheduleNext();
      return;
    }
    try {
      if (banditViaGame()) return;
      gbLogT('bandit-dom', 120000, 'bandit: game bridge unavailable, DOM fallback');
      const victory = document.querySelector('.attack_spot_victory .btn_collect, .attack_spot_victory .button_new.double_border');
      if (victory && !victory.dataset.grepbotClicked) {
        victory.dataset.grepbotClicked = String(Date.now());
        if (gbDomClick(victory, 'bandit-reward')) {
          gbLog('bandit: collected reward (DOM)');
          flash('bandit: collected reward');
          logBandit('collected');
        }
        return;
      }
      try {
        const uw = gameUw();
        const tid = uw.Game && uw.Game.townId;
        if (tid != null && townWarehouseBlocks(tid)) {
          gbLogT('bandit-wh-full-dom', 60000, `bandit: skip DOM attack (warehouse full, mode=${state.farmFullMode})`);
          banditIdle(30000);
          return;
        }
      } catch (_) {}
      const camps = document.querySelectorAll('.js-window-main-container.attack_spot:not(.minimized):not(.attack_spot_victory)');
      for (const camp of camps) {
        const btn = camp.querySelector('.btn_attack');
        if (!btn) continue;
        const cdEl = camp.querySelector('.countdown, [class*="countdown"], .cooldown_time');
        if (cdEl && /\d/.test(cdEl.textContent || '')) continue;
        const disabled = btn.getAttribute('disabled') != null || btn.disabled === true
          || btn.getAttribute('aria-disabled') === 'true';
        if (disabled) continue;
        let filled = 0;
        let offense = null;
        try {
          const uwDom = gameUw();
          const tid = uwDom.Game && uwDom.Game.townId;
          const t = tid != null && uwDom.ITowns && uwDom.ITowns.towns && uwDom.ITowns.towns[tid];
          if (t && t.units) {
            offense = Object.assign({}, t.units());
            delete offense.militia;
            Object.keys(offense).forEach(u => {
              if (!offense[u] || !banditIsOffenseUnit(uwDom, u)) delete offense[u];
            });
          }
        } catch (_) {}
        if (!offense || !Object.keys(offense).length) {
          gbLogT('bandit-dom-nooff', 60000, 'bandit: no offense units for DOM fill');
          continue;
        }
        camp.querySelectorAll('.unit_container [data-unit_id], .unit_icon40x40[data-unit_id]').forEach(icon => {
          const uid = icon.getAttribute('data-unit_id');
          const n = uid && +offense[uid] || 0;
          if (!n) return;
          const box = icon.closest('.unit_container') || icon.parentElement;
          const input = box && box.querySelector('input.txt_unit, input[type=text], input[type=number]');
          if (!input || input.dataset.grepbotFilled) return;
          input.dataset.grepbotFilled = String(Date.now());
          input.value = String(n);
          try { input.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
          try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
          filled++;
        });
        if (!filled) {
          gbLogT('bandit-dom-nooff', 60000, 'bandit: no offense unit inputs in camp window');
          continue;
        }
        gbTimeout(() => {
          if (!hostEnabled() || automationPaused({}) || captchaPaused('bandit')) return;
          const atkBtn = camp.querySelector('.btn_attack');
          const stillOff = atkBtn && (atkBtn.getAttribute('disabled') != null || atkBtn.disabled === true);
          if (atkBtn && !stillOff) {
            atkBtn.dataset.grepbotClicked = String(Date.now());
            if (gbDomClick(atkBtn, 'bandit-attack')) {
              gbLog('bandit: attack sent (DOM, offense-only)');
              flash('bandit: attack sent');
              logBandit('attack');
            }
          }
        }, 250);
        return;
      }
    } finally {
      banditScheduleNext();
    }
  }
  let banditLoopTimer = null;
  function banditClearLoop() {
    if (banditLoopTimer) {
      try { clearTimeout(banditLoopTimer); } catch (_) {}
      banditLoopTimer = null;
    }
  }
  function banditScheduleNext() {
    if (banditLoopTimer) return;
    if (!state.autoBandit) return;
    const now = Date.now();
    let delay = 1500;
    if (banditIdleUntil > now) delay = Math.min(30000, Math.max(1500, banditIdleUntil - now));
    banditLoopTimer = gbTimeout(() => {
      banditLoopTimer = null;
      banditScan();
    }, delay);
  }
  function scheduleBanditScan() {
    if (banditTimer) return;
    banditTimer = gbTimeout(() => {
      banditTimer = null;
      banditIdleUntil = 0;
      banditClearLoop();
      banditScan();
    }, 600);
  }
  function logBandit(ev) {
    state.banditLog.push({ ts: Date.now(), ev });
    if (state.banditLog.length > 50) state.banditLog = state.banditLog.slice(-50);
    save(STORE.BANDIT_LOG, state.banditLog);
  }
  banditScheduleNext();
  // autoCollect interval lives in boot.js (orch ownership + pause gate)
