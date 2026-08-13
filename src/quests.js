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
        let canClaim = null,claimStateKnown=false;
        try {
          if (typeof m.isClaimable === 'function') {canClaim=!!m.isClaimable();claimStateKnown=true}
          else if (typeof m.isFinished === 'function') {canClaim=!!m.isFinished();claimStateKnown=true}
          else if (typeof m.getReward === 'function') {canClaim=!!m.getReward();claimStateKnown=true}
          else if (typeof m.hasReward === 'function') {canClaim=!!m.hasReward();claimStateKnown=true}
          else if (progress != null && progress >= 100) {canClaim=true;claimStateKnown=true}
          else if (a.state === 'satisfied' || a.status === 'satisfied') {canClaim=true;claimStateKnown=true}
          else if (/^(?:closed|claimed|completed|rewarded)$/i.test(String(a.state||a.status||''))) {canClaim=false;claimStateKnown=true}
          else if (progress != null && progress < 100) {canClaim=false;claimStateKnown=true}
        } catch (_) {}
        const rewards = rewardsFromModel(m);

        const pid = a.progressable_id != null ? a.progressable_id : id;
        const cfg=a.configuration||{},islandX=cfg.island_x??a.island_x??null,islandY=cfg.island_y??a.island_y??null;
        out.push({
          questId: id,
          progressableId: String(pid),
          name: a.questname || a.quest_name || a.name || '',
          title: a.name || a.summary || a.questname || id,
          progress,
          canClaim,
          claimStateKnown,
          rewards,
          state: a.state || a.status || '',
          fromGame: true,
          modelName: name,
          islandX:islandX==null?null:+islandX,
          islandY:islandY==null?null:+islandY,
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
    const incomingKnown=entry.claimStateKnown===true,nextClaimStateKnown=incomingKnown?true:!!prev.claimStateKnown;
    const incomingCanClaim = incomingKnown ? !!entry.canClaim : !!prev.canClaim;
    const reviewReconciled = !!prev.claimReview && incomingKnown && entry.canClaim === false;
    const nextClaimReview = reviewReconciled ? false : !!prev.claimReview;
    const nextClaimedAt = +prev.claimedAt || (reviewReconciled ? Date.now() : 0);
    const nextCanClaim = (nextClaimReview || nextClaimedAt) ? false : incomingCanClaim;
    const nextTitle = entry.title != null ? entry.title : prev.title;
    const nextName = entry.name != null ? entry.name : prev.name;
    const nextTownId = entry.townId ? String(entry.townId) : String(prev.townId||'');
    const nextModelName=entry.modelName||prev.modelName||'',nextIslandX=entry.islandX!=null?+entry.islandX:(prev.islandX??null),nextIslandY=entry.islandY!=null?+entry.islandY:(prev.islandY??null);
    const nextSig = questRewardsSig(rewards);

    const unchanged = prev.questId != null
      && prev.progress === nextProgress
      && !!prev.canClaim === nextCanClaim
      && !!prev.claimStateKnown === nextClaimStateKnown
      && !!prev.safeAuto === !!safeAuto
      && (prev.title || '') === (nextTitle || '')
      && (prev.name || '') === (nextName || '')
      && String(prev.townId||'') === nextTownId
      && String(prev.modelName||'')===String(nextModelName)
      && (prev.islandX??null)===nextIslandX && (prev.islandY??null)===nextIslandY
      && !!prev.claimReview === nextClaimReview
      && (+prev.claimedAt||0) === nextClaimedAt
      && questRewardsSig(prev.rewards) === nextSig;
    if (unchanged) return prev;
    const merged = Object.assign({}, prev, entry, {
      rewards,
      updatedAt: Date.now(),
      autoBuildReward,
      autoResReward,
      safeAuto,
      canClaim: nextCanClaim,
      claimStateKnown: nextClaimStateKnown,
      claimReview: nextClaimReview,
      claimedAt: nextClaimedAt,
      townId: nextTownId,
      modelName:nextModelName,
      islandX:nextIslandX,
      islandY:nextIslandY,
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
  function questResolveTownId(entry) {
    const ix=Number(entry&&entry.islandX),iy=Number(entry&&entry.islandY);
    if(Number.isFinite(ix)&&Number.isFinite(iy)){try{const towns=gameUw().ITowns&&gameUw().ITowns.towns||{};for(const id of Object.keys(towns)){const p=ruralTownIslandXY(id);if(p&&Number(p.x)===ix&&Number(p.y)===iy)return String(id)}}catch(_){}}
    const fallback=entry&&entry.townId;if(fallback&&/^\d+$/.test(String(fallback))&&abGetTown(String(fallback)))return String(fallback);return null;
  }
  function questClearReviewForTx(tx) {
    const qid=tx&&tx.snapshot&&tx.snapshot.qid;if(qid==null)return false;let live=null;
    try{live=questsFromGame().find(q=>String(q.questId)===String(qid)||String(q.progressableId)===String(qid))||null}catch(_){}if(!live||!live.claimStateKnown)return false;
    let changed=false;for(const q of Object.values(state.questRewards||{})){if(!q||(String(q.questId)!==String(qid)&&String(q.progressableId)!==String(qid)))continue;q.claimReview=false;q.claimError='';q.claimStateKnown=true;q.canClaim=!!live.canClaim;q.claimedAt=live.canClaim?0:(q.claimedAt||Date.now());q.updatedAt=Date.now();changed=true}if(changed)save(STORE.QUEST_REWARDS,state.questRewards);return changed;
  }
  function claimQuestViaBridge(entry, onDone) {
    const uw = gameUw();
    const pid = entry.progressableId || entry.questId;
    if (!pid || !(uw.gpAjax && uw.gpAjax.ajaxPost)) return onDone && onDone('noajax');
    if(!/^\d+$/.test(String(pid)))return onDone&&onDone('no-numeric-id');
    const townId=questResolveTownId(entry);if(!townId)return onDone&&onDone('town-unknown');
    const payload = {
      model_url: 'IslandQuests',
      action_name: 'claimReward',
      arguments: { reward_action:'stash',state:'closed',progressable_id:+pid },
      town_id: +townId,
      nl_init:true,
    };
    gbLog('quest bridge claim:', JSON.stringify(payload).slice(0, 200));
    bridgePost('quest', payload, (err, data) => {
      if (err) return onDone && onDone(err);
      if (data && data.error) return onDone && onDone(String(data.error));
      onDone && onDone(null, data);
    });
  }
  function questAutoClaim(root, entry) {
    if (gbLocked('quest-auto') || !entry?.canClaim || entry.claimReview || entry.claimedAt) return;
    const rewards = entry.rewards || [];

    if (!rewards.length || !rewards.every(isSafeQuestReward)) return;
    if(entry.modelName!=='IslandQuest'){gbLogT('quest-contract-'+entry.questId,300000,'quest: generic/unknown progressable skipped');return}
    if(!questResolveTownId(entry)){gbLogT('quest-town-'+entry.questId,300000,'quest: island town unresolved — fail closed');return}
    if (!state.questAutoBuild && !state.questAutoRes) return;
    if (questClaimBlocked(entry.questId)) {
      gbLogT('quest-block-' + entry.questId, 60000, 'quest: claim backoff active', entry.title || entry.questId);
      return;
    }
    const autoToken = gbLock('quest-auto');
    if (!autoToken) return;
    const kinds = rewards.map(r => r.kind).join(',');
    const setClaimState=(review,err)=>{const cur=state.questRewards[entry.questId]||entry;cur.canClaim=false;cur.claimStateKnown=true;cur.claimReview=!!review;cur.claimedAt=review?0:Date.now();cur.claimError=review?String(err||'resultado desconocido'):'';cur.updatedAt=Date.now();state.questRewards[entry.questId]=cur;save(STORE.QUEST_REWARDS,state.questRewards)};
    const finish = (method, ok, err) => {
      if (ok) questClaimOk(entry.questId);
      else if(!/^(?:timeout|timeout_unknown|pending)(?::|$)/.test(String(err||''))) questClaimFailed(entry.questId, err);
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
      if (ok) flash('reclamo de mision: ' + kinds);
      gbTimeout(() => { gbUnlock('quest-auto', autoToken); questScanTick('post-claim'); renderQuests(); }, 2500);
    };
    // liveOnly: the persisted questRewards entry is OUR OWN last snapshot, so
    // using it to reconcile a timeout lets a stale cache confirm a claim that
    // never landed. Only the live collection may settle an ambiguous outcome.
    const questStillClaimable = (liveOnly) => {
      try {
        const live = questsFromGame().find(q => String(q.questId) === String(entry.questId)||String(q.progressableId)===String(entry.progressableId));
        if (live && live.claimStateKnown) return !!live.canClaim;
      } catch (_) {}
      if (liveOnly) return null;
      const cur = state.questRewards[entry.questId];return cur&&cur.claimStateKnown?!!cur.canClaim:null;
    };
    claimQuestViaBridge(entry, (err) => {
      if (/^(?:timeout|timeout_unknown|pending)(?::|$)/.test(String(err||''))) {
        if (questStillClaimable(true)===false) {setClaimState(false);return finish('bridge-reconcile', true)}
        setClaimState(true,err);return finish('bridge-review', false, err||'timeout_unknown');
      }
      if (err) return finish('bridge', false, err);
      // A successful server callback is authoritative even if the local model
      // has not refreshed yet. Persist a tombstone so stale cache cannot retry.
      setClaimState(false);return finish('bridge', true);
    });
  }
  function questSnapshot(row, rewards, canClaim) {
    const questId = questKey(row);
    const headline = row?.querySelector('.headline');
    const progress = questProgress(row);
    const claimStateKnown=!!canClaim||(progress!=null&&progress<100);const entry = {
      questId,
      progressableId: headline?.dataset?.questProgressableId || row?.dataset?.questProgressableId || '',
      name: row?.dataset?.questName || '',
      title: (headline?.textContent || '').trim(),
      progress,
      updatedAt: Date.now(),
      selected: !!row?.classList.contains('selected'),
      canClaim: claimStateKnown?!!canClaim:null,
      claimStateKnown,
      rewards: rewards || [],
      townId: String(abCurrentTownId()||''),
      townEvidence:'dom-current',
      fromDom:true,
    };
    entry.autoBuildReward = entry.rewards.some(r => r.kind === 'build-cost-reduction');
    entry.autoResReward = entry.rewards.some(r => r.kind === 'resources' || r.kind === 'favor');
    entry.safeAuto = entry.rewards.length > 0 && entry.rewards.every(isSafeQuestReward);
    // Prefer the row's own island coords: the DOM may show the quest while the
    // player is currently viewing a different town, so `abCurrentTownId()` is
    // a stale-id footgun (claimQuestViaBridge would route to the wrong town).
    // Fall back to town-unknown rather than borrowing the current town's id.
    const ds = (typeof row?.dataset === 'object' && row.dataset) || {};
    const ix = +ds.islandX || +ds.island_x || null;
    const iy = +ds.islandY || +ds.island_y || null;
    if (Number.isFinite(ix) && Number.isFinite(iy)) {
      entry.islandX = ix;
      entry.islandY = iy;
      entry.townEvidence = 'dom-island';
    } else {
      entry.islandX = null;
      entry.islandY = null;
      entry.townId = '';
      entry.townEvidence = 'town-unknown';
    }
    return entry;
  }
  function questCaptureCurrent(row) {
    const root = questRewardRoot();
    let rewards = questRewardsFromDom(root);
    const id = questKey(row);

    const idStr=String(id),idRe=new RegExp(`(?:^|[^A-Za-z0-9])${idStr.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:$|[^A-Za-z0-9])`);
    const idMatch=v=>{const a=String(v==null?'':v);return a===idStr||idRe.test(a)};
    const fromGame = questsFromGame().find(q => idMatch(q.questId) || idMatch(q.progressableId));
    if (fromGame && fromGame.rewards && fromGame.rewards.length) {
      rewards = fromGame.rewards;
    }
    const entry = questSnapshot(row, rewards, !!questActionButton(root) || !!(fromGame && fromGame.canClaim));
    if (fromGame) {
      if(fromGame.progress != null && entry.progress == null)entry.progress=fromGame.progress;
      if(fromGame.claimStateKnown){entry.claimStateKnown=true;entry.canClaim=!!fromGame.canClaim}
      entry.modelName=fromGame.modelName;entry.islandX=fromGame.islandX;entry.islandY=fromGame.islandY;entry.progressableId=fromGame.progressableId||entry.progressableId;
    }
    mergeQuestEntry(entry);
    questAutoClaim(root, state.questRewards[entry.questId]);
  }
  function ingestGameQuests() {
    questsFromGame().forEach(q => mergeQuestEntry(q));
  }
  function questScanTick(reason) {
    if (!hostEnabled()) return;
    // Single atomic guard: take the lock once, run the whole tick, release in
    // finally. The previous read-then-acquire pattern left a window where
    // bindQuestObserver/ingestGameQuests ran with no lock held.
    const scanToken = gbLock('quest-scan');
    if (!scanToken) return;
    try {
      bindQuestObserver();
      ingestGameQuests();

      if (!gbLocked('quest-auto')) {
        const claimable = Object.values(state.questRewards).filter(e => e.canClaim && e.safeAuto);
        if (claimable.length) {
          questAutoClaim(questRewardRoot(), claimable[0]);
        }
      }
      const rows = questRows();
      if (!rows.length) return;
      // Never change the player's selected quest during a background scan. Game
      // models are ingested for every row; DOM-only reward details are learned
      // from whichever quest the player is already viewing.
      const row = questSelectedRow(rows);
      if (!row) return;
      try { questCaptureCurrent(row); }
      catch (_) { /* leave the lock release to finally */ }
    } finally {
      gbUnlock('quest-scan', scanToken);
      renderQuests();
    }
  }
  function bindQuestObserver() {
    const container = document.querySelector('.quests, #questlog');
    if (!container) {
      if (questMo) { try { questMo.disconnect(); } catch (_) {} }
      questMo = null;
      questMoContainer = null;
      return;
    }
    if (questMo && questMoContainer === container && container.isConnected) return;
    if (questMo) { try { questMo.disconnect(); } catch (_) {} }
    questMoContainer = container;
    questMo = new MutationObserver(() => {
      if (!gbInstanceAlive()) return;
      gbClearTimeout(bindQuestObserver._t);
      bindQuestObserver._t = gbTimeout(() => questScanTick('mutation'), 400);
    });
    questMo.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
  }
  function questDispose() {
    if (questMo) {
      try { questMo.disconnect(); } catch (_) {}
      questMo = null;
    }
    questMoContainer = null;
    gbClearTimeout(bindQuestObserver._t);
    bindQuestObserver._t = null;
  }
  try {
    // GB_ROOT, not a private unsafeWindow copy: __grepbotDispose reads the hook
    // off GB_ROOT, so a second resolution of the same expression is one more
    // place for the two to disagree (Firefox's wrappedJSObject fallback).
    GB_ROOT.__grepbotQuestDispose = questDispose;
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
        const auto = q.claimReview?'REVIEW':(q.safeAuto ? (q.canClaim ? 'CLAIM' : 'yes') : 'no');
        const autoColor = auto === 'CLAIM' ? '#6dda7e' : (auto === 'REVIEW'?'#ff9d62':(auto === 'yes' ? '#fc6' : '#888'));
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

  const ATTACK_HISTORY_MAX = 50;
  const ATTACK_ROLE_OFFENSE = '__attack_offense';
  const ATTACK_ROLE_DEFENSE = '__attack_defense';
  const HARASS_CAPS = { '1sling': 1, '5sling': 5, light: 8 };
  const HARASS_PREF = ['slinger', 'rider', 'archer', 'hoplite', 'sword'];
  let attackArmed = null;
  let attackPreviewRows = [];
