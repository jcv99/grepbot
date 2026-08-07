  // ---------- quests: model/XHR learn + safe auto-claim + panel/history ----------
  const QUEST_SCAN_MS = 12000;
  const QUEST_RESCAN_MS = 6 * 60 * 60 * 1000;
  const QUEST_HISTORY_MAX = 100;
  let questScanBusy = false;
  let questAutoBusy = false;
  let questCursor = 0;
  let questMo = null;
  // Per-quest claim backoff. bridgePost timeouts never trip the decision-memory
  // skip window (the captcha breaker owns that path), so without this a quest
  // whose claim never lands retries every ~17s forever.
  function questClaimFailLoad() {
    const raw = load(STORE.QUEST_CLAIM_FAIL, null) || {};
    const now = Date.now();
    const out = Object.create(null);
    Object.keys(raw).forEach(id => {
      const f = raw[id];
      if (f && +f.until > now) out[id] = { n: +f.n || 0, until: +f.until };
    });
    return out;
  }
  function questClaimFailSave() {
    try {
      const now = Date.now();
      const out = {};
      Object.keys(questClaimFail).forEach(id => {
        const f = questClaimFail[id];
        if (f && f.until > now) out[id] = { n: f.n, until: f.until };
      });
      save(STORE.QUEST_CLAIM_FAIL, out);
    } catch (_) {}
  }
  const questClaimFail = questClaimFailLoad();
  const QUEST_FAIL_BACKOFF_MS = [5 * 60000, 30 * 60000, 6 * 3600000];
  function questClaimBlocked(id) {
    const f = questClaimFail[id];
    return !!(f && f.until > Date.now());
  }
  function questClaimFailed(id, err) {
    const f = questClaimFail[id] || (questClaimFail[id] = { n: 0, until: 0 });
    f.n++;
    const wait = QUEST_FAIL_BACKOFF_MS[Math.min(f.n - 1, QUEST_FAIL_BACKOFF_MS.length - 1)];
    f.until = Date.now() + wait;
    questClaimFailSave();
    gbLog('quest: claim backoff', id, 'fail #' + f.n, Math.round(wait / 60000) + 'min', String(err || ''));
  }
  function questClaimOk(id) { delete questClaimFail[id]; questClaimFailSave(); }

  const QUEST_SAFE_BUILD = /build_cost_reduction|construction_cost_reduction|buildcostreduction|building_cost_reduction/;
  const QUEST_SAFE_RES = /^(resources|favor)$/i;

  function questRows() {
    return Array.from(document.querySelectorAll('.quests .quest, #questlog .quest, .questlog .quest'))
      .filter(el => el && el.dataset && el.dataset.questId);
  }
  function questSelectedRow(rows) {
    return (rows || questRows()).find(r => r.classList.contains('selected')) || null;
  }
  function questRewardRoot() {
    return document.querySelector('#quest_inspector, .quest.quest_progress, .quest_progress');
  }
  function questActionButton(root) {
    const btn = (root || questRewardRoot())?.querySelector('.btn_action');
    return btn && !btn.classList.contains('disabled') ? btn : null;
  }
  function questKey(row) {
    return row?.dataset?.questId || '';
  }
  function questProgress(row) {
    const txt = row?.querySelector('.curr')?.textContent || row?.querySelector('.value_container')?.textContent || '';
    const m = txt.match(/(\d+(?:[.,]\d+)?)\s*%/);
    return m ? parseFloat(m[1].replace(',', '.')) : null;
  }
  function classifyRewardObj(r) {
    if (!r || typeof r !== 'object') return 'other';
    const type = String(r.type || '').toLowerCase();
    const pid = String(r.power_id || r.id || r.subtype || '').toLowerCase();
    const raw = [type, pid, r.title, r.name, JSON.stringify(r.configuration || {})].filter(Boolean).join(' ').toLowerCase();
    if (QUEST_SAFE_RES.test(type) || type === 'resource' || /favor/.test(type) && !/instant/.test(pid)) {
      if (type === 'favor' || /favor/.test(type)) return 'favor';
      if (type === 'resources' || type === 'resource' || r.wood != null || r.stone != null || r.iron != null) return 'resources';
    }
    if (QUEST_SAFE_BUILD.test(pid) || QUEST_SAFE_BUILD.test(raw)) return 'build-cost-reduction';
    if (/(build|construction|construct|edific|constru).{0,24}(cost|price|gold|reduction|discount|rebaja)/.test(raw)) return 'build-cost-reduction';
    if (type === 'unit' || /unit_/.test(pid)) return 'units';
    if (/hero/.test(type) || /hero/.test(pid)) return 'hero';
    if (r.stashable) return 'stashable';
    return 'other';
  }
  function normalizeReward(r, src) {
    const kind = classifyRewardObj(r);
    return {
      id: r.power_id || r.id || r.subtype || '',
      type: r.type || '',
      power_id: r.power_id || '',
      kind,
      stashable: !!r.stashable,
      configuration: r.configuration || null,
      raw: typeof r === 'object' ? JSON.stringify(r).slice(0, 240) : String(r),
      src: src || 'model',
    };
  }
  function questRewardKindFromNode(node) {
    const bits = [];
    ['title', 'aria-label', 'data-power_id', 'data-power-id', 'data-type', 'data-id'].forEach(name => {
      const v = node.getAttribute(name); if (v) bits.push(v);
    });
    bits.push((node.textContent || '').trim());
    bits.push(Array.from(node.classList || []).join(' '));
    if (node.firstElementChild && node.firstElementChild.className) bits.push(String(node.firstElementChild.className));
    const s = bits.join(' ').toLowerCase();
    if (QUEST_SAFE_BUILD.test(s)) return 'build-cost-reduction';
    if (/\bfavor\b/.test(s)) return 'favor';
    if (/\bresource|wood|stone|iron|madera|piedra|plata\b/.test(s)) return 'resources';
    if (/(build|construction|construct|edific|constru).{0,24}(cost|price|gold|reduction|discount|rebaja)/.test(s)) return 'build-cost-reduction';
    return 'other';
  }
  function questRewardsFromDom(root) {
    const scope = root || questRewardRoot();
    if (!scope) return [];
    const seen = new Set();
    const rewards = [];
    scope.querySelectorAll('.reward_icon, li.reward_icon, .rewards [class*="reward_icon"]').forEach(node => {
      const classes = Array.from(node.classList || []);
      const childClasses = node.firstElementChild ? Array.from(node.firstElementChild.classList || []) : [];
      const id = (classes.concat(childClasses).find(c => /reduction|reward|power|build|construct|cost|favor|resource/i.test(c)) || '').trim();
      const kind = questRewardKindFromNode(node);
      const key = [id, kind, (node.textContent || '').trim()].join('|').slice(0, 200);
      if (!key || seen.has(key)) return;
      seen.add(key);
      rewards.push({
        id, type: '', power_id: id, kind,
        title: node.getAttribute('title') || '',
        text: (node.textContent || '').trim(),
        classes: classes.concat(childClasses),
        src: 'dom',
      });
    });
    return rewards;
  }
  function mmCollection(name) {
    const uw = gameUw();
    try {
      const col = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName(name);
      if (col && col.models) return col;
    } catch (_) {}
    try {
      const cols = uw.MM && uw.MM.getCollections && uw.MM.getCollections();
      if (cols && cols[name]) {
        const c = Array.isArray(cols[name]) ? cols[name][0] : cols[name];
        if (c && c.models) return c;
      }
    } catch (_) {}
    return null;
  }
  function rewardsFromModel(model) {
    const out = [];
    try {
      if (model && typeof model.getRewards === 'function') {
        const list = model.getRewards() || [];
        (Array.isArray(list) ? list : []).forEach(r => out.push(normalizeReward(r, 'getRewards')));
        return out;
      }
    } catch (_) {}
    try {
      const a = model.attributes || model;
      const cfg = a.configuration || {};
      const staticR = (a.static && a.static.rewards) || a.rewards || cfg.rewards || [];
      (Array.isArray(staticR) ? staticR : []).forEach(r => out.push(normalizeReward(r, 'attrs')));
    } catch (_) {}
    return out;
  }
  function questsFromGame() {
    const out = [];
    const seen = new Set();
    ['IslandQuest', 'Progressable'].forEach(name => {
      const col = mmCollection(name);
      if (!col) return;
      (col.models || []).forEach(m => {
        const a = m.attributes || {};
        const id = String(a.id || m.id || '');
        if (!id || seen.has(id)) return;
        seen.add(id);
        let progress = null;
        try {
          if (typeof m.getProgress === 'function') progress = m.getProgress();
          else if (a.progress != null) progress = +a.progress;
          else if (a.progress_percent != null) progress = +a.progress_percent;
        } catch (_) {}
        let canClaim = false;
        try {
          if (typeof m.isClaimable === 'function') canClaim = !!m.isClaimable();
          else if (typeof m.isFinished === 'function') canClaim = !!m.isFinished();
          else if (typeof m.getReward === 'function') canClaim = !!m.getReward();
          else if (typeof m.hasReward === 'function') canClaim = !!m.hasReward();
          else if (progress != null && progress >= 100) canClaim = true;
          else if (a.state === 'satisfied' || a.status === 'satisfied') canClaim = true;
        } catch (_) {}
        const rewards = rewardsFromModel(m);
        // progressable_id (singular) is IslandQuest; progressables_id belongs to PlayerIsland
        const pid = a.progressable_id != null ? a.progressable_id : id;
        out.push({
          questId: id,
          progressableId: String(pid),
          name: a.questname || a.quest_name || a.name || '',
          title: a.name || a.summary || a.questname || id,
          progress,
          canClaim,
          rewards,
          state: a.state || a.status || '',
          fromGame: true,
          modelName: name,
        });
      });
    });
    return out;
  }
  function questRewardsSig(arr) {
    if (!arr || !arr.length) return '';
    return arr.map(r => {
      if (!r) return '';
      return String(r.power_id || r.id || '') + ':' + String(r.kind || r.type || '');
    }).join('|');
  }
  function mergeQuestEntry(entry) {
    if (!entry || !entry.questId) return;
    const prev = state.questRewards[entry.questId] || {};
    const rewards = (entry.rewards && entry.rewards.length) ? entry.rewards : (prev.rewards || []);
    const autoBuildReward = rewards.some(r => r.kind === 'build-cost-reduction');
    const autoResReward = rewards.some(r => r.kind === 'resources' || r.kind === 'favor');
    const safeAuto = rewards.length > 0 && rewards.every(r => isSafeQuestReward(r));
    const nextProgress = entry.progress != null ? entry.progress : prev.progress;
    const nextCanClaim = entry.canClaim != null ? !!entry.canClaim : !!prev.canClaim;
    const nextTitle = entry.title != null ? entry.title : prev.title;
    const nextName = entry.name != null ? entry.name : prev.name;
    const nextSig = questRewardsSig(rewards);
    // Cheap equality - skip stringify + GM_setValue on every 12s ingest tick
    const unchanged = prev.questId != null
      && prev.progress === nextProgress
      && !!prev.canClaim === nextCanClaim
      && !!prev.safeAuto === !!safeAuto
      && (prev.title || '') === (nextTitle || '')
      && (prev.name || '') === (nextName || '')
      && questRewardsSig(prev.rewards) === nextSig;
    if (unchanged) return prev;
    const merged = Object.assign({}, prev, entry, {
      rewards,
      updatedAt: Date.now(),
      autoBuildReward,
      autoResReward,
      safeAuto,
    });
    state.questRewards[entry.questId] = merged;
    save(STORE.QUEST_REWARDS, state.questRewards);
    if (nextSig && nextSig !== questRewardsSig(prev.rewards)) {
      gbLog('quest reward learned:', merged.title || merged.name || merged.questId, nextSig.slice(0, 180));
    }
    return merged;
  }
  function isSafeQuestReward(r) {
    if (!r) return false;
    if (r.kind === 'build-cost-reduction') return !!state.questAutoBuild;
    if (r.kind === 'resources' || r.kind === 'favor') return !!state.questAutoRes;
    return false;
  }
  function pushQuestHistory(entry) {
    state.questHistory.unshift(entry);
    if (state.questHistory.length > QUEST_HISTORY_MAX) state.questHistory.length = QUEST_HISTORY_MAX;
    save(STORE.QUEST_HISTORY, state.questHistory);
  }
  function learnQuestRewardsFromPayload(data, hint) {
    if (!data || typeof data !== 'object') return;
    const walk = (obj, depth) => {
      if (!obj || depth > 6) return;
      if (Array.isArray(obj)) { obj.forEach(x => walk(x, depth + 1)); return; }
      if (typeof obj !== 'object') return;
      // reward-looking objects
      if (obj.power_id || obj.type === 'resources' || obj.type === 'favor' || (obj.rewards && Array.isArray(obj.rewards))) {
        const qid = String(obj.progressable_id || obj.quest_id || obj.id || hint || '');
        if (obj.rewards && Array.isArray(obj.rewards)) {
          mergeQuestEntry({
            questId: qid || ('xhr-' + Date.now()),
            rewards: obj.rewards.map(r => normalizeReward(r, 'xhr')),
            title: obj.name || obj.summary || '',
            fromXhr: true,
          });
        } else if (obj.power_id || QUEST_SAFE_RES.test(String(obj.type || ''))) {
          if (qid) {
            const prev = state.questRewards[qid] || { questId: qid, rewards: [] };
            const rewards = (prev.rewards || []).slice();
            rewards.push(normalizeReward(obj, 'xhr'));
            mergeQuestEntry(Object.assign({}, prev, { rewards }));
          }
        }
      }
      Object.keys(obj).forEach(k => {
        if (k === 'json' || k === 'r' || k === 'data' || k === 'quests' || k === 'island_quests' || k === 'progressable' || k === 'rewards') walk(obj[k], depth + 1);
      });
    };
    walk(data.json || data, 0);
  }
  function claimQuestViaBridge(entry, onDone) {
    const uw = gameUw();
    const pid = entry.progressableId || entry.questId;
    if (!pid || !(uw.gpAjax && uw.gpAjax.ajaxPost)) return onDone && onDone('noajax');
    // model_url needs the model's own numeric id (130950), not the progressable
    // NAME ('BuildCaveLevel5') - a name-keyed url never resolves, gpAjax never
    // calls back, and the game pops its own error dialog on every retry.
    const mid = /^\d+$/.test(String(entry.questId)) ? String(entry.questId) : String(pid);
    if (!/^\d+$/.test(mid)) return onDone && onDone('no-numeric-id');
    const payload = {
      model_url: 'IslandQuest/' + mid,
      action_name: 'claimReward',
      arguments: { progressable_id: +pid || pid },
      town_id: uw.Game && uw.Game.townId,
    };
    gbLog('quest bridge claim:', JSON.stringify(payload).slice(0, 200));
    bridgePost('quest', payload, (err, data) => {
      if (err) return onDone && onDone(err);
      if (data && data.error) return onDone && onDone(String(data.error));
      onDone && onDone(null, data);
    });
  }
  function questNeedsRescan(info) {
    if (!info) return true;
    if (!Array.isArray(info.rewards) || !info.rewards.length) return true;
    return ((info.updatedAt || 0) + QUEST_RESCAN_MS) < Date.now();
  }
  function clickQuestRow(row) {
    const target = row?.querySelector('.headline') || row;
    if (!target) return false;
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  }
  function chooseQuestRow(rows) {
    if (!rows.length) return null;
    // priority: completed+claimable -> missing rewards -> stale -> round-robin
    const scored = rows.map(r => {
      const id = questKey(r);
      const info = state.questRewards[id];
      const prog = questProgress(r);
      let score = 0;
      if (prog != null && prog >= 100) score += 100;
      if (info && info.safeAuto) score += 40;
      if (questNeedsRescan(info)) score += 20;
      if (r.classList.contains('selected')) score += 5;
      return { r, score, id };
    });
    scored.sort((a, b) => b.score - a.score);
    if (scored[0].score >= 20) return scored[0].r;
    questCursor = questCursor % rows.length;
    return rows[questCursor++];
  }
  function questAutoClaim(root, entry) {
    if (questAutoBusy || !entry?.canClaim) return;
    const rewards = entry.rewards || [];
    // ALL rewards must be classified + permitted - mixed packs are never claimed
    if (!rewards.length || !rewards.every(isSafeQuestReward)) return;
    if (!state.questAutoBuild && !state.questAutoRes) return;
    if (questClaimBlocked(entry.questId)) {
      gbLogT('quest-block-' + entry.questId, 60000, 'quest: claim backoff active', entry.title || entry.questId);
      return;
    }
    questAutoBusy = true;
    const kinds = rewards.map(r => r.kind).join(',');
    const finish = (method, ok, err) => {
      if (ok) questClaimOk(entry.questId);
      else questClaimFailed(entry.questId, err);
      pushQuestHistory({
        ts: Date.now(),
        questId: entry.questId,
        title: entry.title || entry.name || entry.questId,
        rewards,
        autoClaimed: !!ok,
        method,
        kinds,
      });
      gbLog(`quest: auto-claim ${ok ? 'OK' : 'fail'} via ${method}`, entry.title || entry.questId, kinds);
      if (ok) flash('quest claim: ' + kinds);
      gbTimeout(() => { questAutoBusy = false; questScanTick('post-claim'); renderQuests(); }, 2500);
    };
    const questStillClaimable = () => {
      const cur = state.questRewards[entry.questId];
      if (cur && cur.canClaim === false) return false;
      try {
        const live = questsFromGame().find(q => String(q.questId) === String(entry.questId));
        if (live && live.canClaim === false) return false;
      } catch (_) {}
      return true;
    };
    claimQuestViaBridge(entry, (err) => {
      // No DOM fallback - timeout/unknown must not claim a different quest
      if (err === 'timeout') {
        if (!questStillClaimable()) return finish('bridge-reconcile', true);
        return finish('bridge', false, 'timeout_unknown');
      }
      if (err) return finish('bridge', false, err);
      if (!questStillClaimable()) return finish('bridge', true);
      // Response OK but quest still claimable -> ambiguous
      return finish('bridge', false, 'unconfirmed');
    });
  }
  function questSnapshot(row, rewards, canClaim) {
    const questId = questKey(row);
    const headline = row?.querySelector('.headline');
    const progress = questProgress(row);
    const entry = {
      questId,
      progressableId: headline?.dataset?.questProgressableId || row?.dataset?.questProgressableId || '',
      name: row?.dataset?.questName || '',
      title: (headline?.textContent || '').trim(),
      progress,
      updatedAt: Date.now(),
      selected: !!row?.classList.contains('selected'),
      canClaim: !!canClaim && progress != null && progress >= 100,
      rewards: rewards || [],
    };
    entry.autoBuildReward = entry.rewards.some(r => r.kind === 'build-cost-reduction');
    entry.autoResReward = entry.rewards.some(r => r.kind === 'resources' || r.kind === 'favor');
    entry.safeAuto = entry.rewards.length > 0 && entry.rewards.every(isSafeQuestReward);
    return entry;
  }
  function questCaptureCurrent(row) {
    const root = questRewardRoot();
    let rewards = questRewardsFromDom(root);
    const id = questKey(row);
    // prefer model rewards if richer
    const fromGame = questsFromGame().find(q => q.questId === id || String(q.progressableId).includes(id));
    if (fromGame && fromGame.rewards && fromGame.rewards.length) {
      rewards = fromGame.rewards;
    }
    const entry = questSnapshot(row, rewards, !!questActionButton(root) || !!(fromGame && fromGame.canClaim));
    if (fromGame && fromGame.progress != null && entry.progress == null) entry.progress = fromGame.progress;
    if (fromGame && fromGame.canClaim) entry.canClaim = entry.canClaim || (entry.progress != null && entry.progress >= 100) || fromGame.canClaim;
    mergeQuestEntry(entry);
    questAutoClaim(root, state.questRewards[entry.questId]);
  }
  function ingestGameQuests() {
    questsFromGame().forEach(q => mergeQuestEntry(q));
  }
  function questScanTick(reason) {
    if (!hostEnabled() || questScanBusy) return;
    bindQuestObserver();
    ingestGameQuests();
    // try claim completed safe quests from models without DOM
    if (!questAutoBusy) {
      const claimable = Object.values(state.questRewards).filter(e => e.canClaim && e.safeAuto);
      if (claimable.length) {
        questAutoClaim(questRewardRoot(), claimable[0]);
      }
    }
    const rows = questRows();
    if (!rows.length) { renderQuests(); return; }
    const row = chooseQuestRow(rows);
    if (!row) { renderQuests(); return; }
    questScanBusy = true;
    const finish = () => { questScanBusy = false; renderQuests(); };
    if (!row.classList.contains('selected')) {
      clickQuestRow(row);
      gbTimeout(() => {
        try { questCaptureCurrent(questSelectedRow(questRows()) || row); }
        finally { finish(); }
      }, 450);
      return;
    }
    try { questCaptureCurrent(row); }
    finally { finish(); }
  }
  function bindQuestObserver() {
    const container = document.querySelector('.quests, #questlog');
    if (!container) { questMo = null; return; }
    if (questMo) return;
    questMo = new MutationObserver(() => {
      clearTimeout(bindQuestObserver._t);
      bindQuestObserver._t = gbTimeout(() => questScanTick('mutation'), 400);
    });
    questMo.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
  }
  function questDispose() {
    if (questMo) {
      try { questMo.disconnect(); } catch (_) {}
      questMo = null;
    }
    clearTimeout(bindQuestObserver._t);
  }
  try {
    const _uw = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
    _uw.__grepbotQuestDispose = questDispose;
  } catch (_) {}
  function renderQuests() {
    const sec = panel && panel.querySelector('section[data-tab=quests]');
    if (!sec || sec.hidden) return;
    const list = sec.querySelector('.quest-list');
    const hist = sec.querySelector('.quest-hist');
    if (!list) return;
    list.replaceChildren();
    const entries = Object.values(state.questRewards || {}).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (!entries.length) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#888;padding:6px 0';
      e.textContent = 'no quests learned yet - open quest log or wait for scan';
      list.appendChild(e);
    } else {
      const hdr = document.createElement('div');
      hdr.className = 'quest-row';
      hdr.style.color = '#888';
      ['quest', '%', 'rewards', 'auto'].forEach(t => {
        const s = document.createElement('span');
        s.textContent = t;
        hdr.appendChild(s);
      });
      list.appendChild(hdr);
      entries.slice(0, 40).forEach(q => {
        const row = document.createElement('div');
        row.className = 'quest-row';
        const kinds = (q.rewards || []).map(r => r.kind).filter(Boolean);
        const uniq = Array.from(new Set(kinds)).join(',') || '-';
        const auto = q.safeAuto ? (q.canClaim ? 'CLAIM' : 'yes') : 'no';
        const autoColor = auto === 'CLAIM' ? '#6dda7e' : (auto === 'yes' ? '#fc6' : '#888');
        const title = (q.title || q.name || q.questId || '').slice(0, 28);
        const c1 = document.createElement('span');
        c1.title = String(q.questId || '');
        c1.textContent = title;
        const c2 = document.createElement('span');
        c2.textContent = q.progress != null ? String(Math.round(q.progress)) : '-';
        const c3 = document.createElement('span');
        c3.title = uniq;
        c3.textContent = uniq.slice(0, 22);
        const c4 = document.createElement('span');
        c4.style.color = autoColor;
        c4.textContent = auto;
        row.append(c1, c2, c3, c4);
        list.appendChild(row);
      });
    }
    if (hist) {
      const lines = (state.questHistory || []).slice(0, 30).map(h => {
        const when = new Date(h.ts).toLocaleTimeString();
        const kinds = h.kinds || (h.rewards || []).map(r => r.kind).join(',');
        return `${when} ${h.autoClaimed ? 'OK' : 'NO'} ${h.method || '?'} ${(h.title || h.questId || '').slice(0, 24)} [${kinds}]`;
      });
      hist.textContent = lines.join('\n') || '(empty)';
    }
  }

