  const CAVE_MIN_STORE = 100;
  function caveTownEnabled(townId) {
    const id = String(townId);
    const map = state.caveTowns || {};

    return map[id] !== false;
  }
  function setCaveTownEnabled(townId, on) {
    const id = String(townId);
    if (!state.caveTowns) state.caveTowns = {};
    state.caveTowns[id] = !!on;
    save(STORE.CAVE_TOWNS, state.caveTowns);
  }
  const CAVE_CAP_FNS = ['getHideStorageCapacity', 'getEspionageStorageCapacity', 'getHideCapacity',
    'getMaxEspionageStorage', 'getEspionageStoreCapacity'];
  const CAVE_STORED_FNS = ['getEspionageStorage', 'getHideStorage', 'getEspionageStore',
    'getStoredIron', 'getHideIron'];
  function caveCapacityFromLevel(level) {
    const n = gbNum(level);
    if (n == null) return { capacity: null, unlimited: false };
    const lvl = Math.max(0, Math.floor(n));
    if (lvl === 10) return { capacity: null, unlimited: true };
    return { capacity: lvl > 0 && lvl < 10 ? lvl * 1000 : null, unlimited: false };
  }
  function caveTownInfo(townId) {
    const uw = uwCached();
    let t = null;
    try {
      t = gbTownModel(townId);
    } catch (_) {}
    if (!t) return null;
    let hideLvl = gbBuildingLevel(townId, 'hide');
    let iron = null, cap = null, resStorage = null;
    try {
      const r = t.resources && t.resources();
      if (r && r.iron != null) iron = gbNum(r.iron);
      if (r && r.storage != null) resStorage = gbNum(r.storage);
    } catch (_) {}

    const shared = townResState(townId);
    if (shared) {
      cap = shared.cap;
      if (iron == null) iron = shared.iron;
    }
    if (!(cap > 0)) cap = gbProbeNum(t, ['getStorageCapacity', 'getStorage', 'getResourceCapacity']);
    if (!(cap > 0)) cap = gbProbeNum(t.storage, ['getCapacity']);

    if (!(cap > 0) && resStorage != null && resStorage > 100) cap = resStorage;
    if (!(cap > 0)) cap = null;

    let hideCap = null, stored = null, unlimited = false;
    hideCap = gbProbeNum(t, CAVE_CAP_FNS);
    if (hideCap == null) hideCap = gbProbeAttr(t, ['hide_capacity', 'espionage_storage_capacity']);
    stored = gbProbeNum(t, CAVE_STORED_FNS);
    if (stored == null) stored = gbProbeAttr(t, ['espionage_storage', 'hide_storage', 'stored_iron']);
    try {

      const hb = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('BuildingHide');
      const hm = hb && hb.models && hb.models.filter(m => String((m.attributes || {}).town_id) === String(townId))[0];
      if (hm) {
        if (hideCap == null) hideCap = gbProbeNum(hm, CAVE_CAP_FNS) ?? gbProbeAttr(hm, ['capacity', 'max_storage']);
        if (stored == null) stored = gbProbeNum(hm, CAVE_STORED_FNS) ?? gbProbeAttr(hm, ['storage', 'iron', 'stored_iron']);
      }
    } catch (_) {}
    try {
      const gdb = uw.GameDataBuildings;
      if (hideCap == null && gdb && hideLvl != null) hideCap = gbProbeNum(gdb, ['getHideStorageCapacity', 'getEspionageStorage'], [hideLvl]);
      const gd = uw.GameData && uw.GameData.buildings && uw.GameData.buildings.hide;
      if (hideCap == null && gd && gd.storage != null && hideLvl != null) {
        const s = gd.storage;
        const v = gbNum(Array.isArray(s) || typeof s === 'object' ? s[hideLvl] : s);
        if (v != null && v > 0) hideCap = v;
      }
      const maxHide = gbNum(gd && gd.max_level);
      if (maxHide != null && maxHide > 0 && hideLvl === maxHide) unlimited = true;
      const unlimFn = gdb && gdb.getHideStorageLevelUnlimited;
      if (typeof unlimFn === 'function') {
        const unlimitedLevel = gbNum(unlimFn.call(gdb));
        if (unlimitedLevel != null && unlimitedLevel > 0 && hideLvl === unlimitedLevel) unlimited = true;
      }
    } catch (_) {}

    if (hideCap != null && hideCap < 0) { unlimited = true; hideCap = null; }
    if (stored != null && stored < 0) stored = null;
    if (hideLvl != null) {
      const levelCapacity = caveCapacityFromLevel(hideLvl);
      if (levelCapacity.unlimited) unlimited = true;
      else if (hideCap == null) hideCap = levelCapacity.capacity;
    }
    return { town: t, hideLvl, iron, cap, hideCap, stored, unlimited };
  }
  function caveDiag(townId) {
    const uw = uwCached();
    const id = townId != null ? townId : (caveListTownIds()[0]);
    let t = null;
    try {
      t = gbTownModel(id);
    } catch (_) {}
    if (!t) { gbLog('cave diag: no town model'); return null; }
    const keys = new Set();
    for (let o = t; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
      Object.getOwnPropertyNames(o).forEach(k => keys.add(k));
    }
    const hits = [...keys].filter(k => /hide|espio|storage|capacit/i.test(k)).sort();
    const attrs = Object.keys(t.attributes || {}).filter(k => /hide|espio|storage|capacit|iron/i.test(k)).sort();
    const info = caveTownInfo(id);
    gbLog(`cave diag town ${id}: methods/props [${hits.join(', ')}]`);
    gbLog(`cave diag town ${id}: attrs [${attrs.join(', ')}]`);
    gbLog(`cave diag town ${id}: hide${info && info.hideLvl} iron=${info && info.iron} cap=${info && info.cap} hideCap=${info && info.hideCap} stored=${info && info.stored} unlimited=${info && info.unlimited}`);
    return { keys: hits, attrs, info };
  }
  function caveExcessAmount(info) {
    if (!info || !(info.cap > 0) || info.iron == null) return 0;
    if (!(info.hideLvl > 0)) return 0;
    const pct = gbCfgClamp(state.caveThreshPct, 50, 99, 90);
    const keep = Math.floor(info.cap * (pct / 100));
    if (info.iron < keep) return 0;
    let excess = Math.floor(info.iron - keep);
    try { const av = plannerAvailable(info.town && (info.town.id || (info.town.attributes && info.town.attributes.id))); if (av && Number.isFinite(av.iron)) excess = Math.min(excess, Math.floor(av.iron)); } catch (_) {}
    if (excess < CAVE_MIN_STORE) return 0;

    if (!info.unlimited && (info.hideCap == null || info.stored == null)) {

      const tid = (info.town && (info.town.id || (info.town.attributes && info.town.attributes.id))) || '?';
      const what = [info.hideCap == null ? 'capacidad' : null, info.stored == null ? 'almacenado' : null].filter(Boolean).join('+');
      gbLogT('cave-unreadable-' + tid, 300000, `cave: town ${tid} hide ${what} unreadable - skipping (no blind stash)`);
      return 0;
    }
    if (!info.unlimited && info.hideCap != null && info.hideCap > 0 && info.stored != null) {
      const free = Math.floor(info.hideCap - info.stored);
      if (free <= 0) return 0;
      excess = Math.min(excess, free);
    }
    return excess >= CAVE_MIN_STORE ? excess : 0;
  }

  function caveStoreIron(townId, amount, onDone, feature) {
    const amt = gbNum(amount);
    if (amt == null || amt <= 0) {
      gbLogT('cave-bad-amount-' + townId, 60000, `cave: town ${townId} storeIron skipped — unreadable or non-positive amount (${amount})`);
      if (onDone) onDone('skip:bad-amount');
      return;
    }
    bridgePost(feature || 'cave', {
      model_url: 'BuildingHide',
      action_name: 'storeIron',
      arguments: { iron_to_store: amt },
      town_id: +townId,
    }, onDone);
  }
  function caveListTownIds() {
    const ids = [];
    const seen = new Set();
    try {
      const fromGame = townsFromGame();
      if (fromGame) {
        fromGame.forEach(t => {
          const id = String(t.id);
          if (!seen.has(id)) { seen.add(id); ids.push(id); }
        });
      }
    } catch (_) {}
    try {
      const uw = uwCached();
      const towns = uw.ITowns && uw.ITowns.towns;
      if (towns) {
        Object.keys(towns).forEach(id => {
          if (!seen.has(String(id))) { seen.add(String(id)); ids.push(String(id)); }
        });
      }
    } catch (_) {}
    return ids;
  }
  function caveScan(reason) {
    if (!hostEnabled() || !state.autoCave || captchaPaused('cave')) return;
    if (!gameBridgeReady()) { gbLogT('cave-nobridge', 60000, 'cave: bridge not ready'); return; }
    const ids = caveListTownIds();
    if (!ids.length) { gbLogT('cave-notowns', 120000, 'cave: no towns'); return; }
    const jobs = [];
    for (const id of ids) {
      if (!caveTownEnabled(id)) continue;
      const info = caveTownInfo(id);
      if (!info) continue;
      if (!(info.hideLvl > 0)) {
        gbLogT('cave-nohide-' + id, 300000, `cave: town ${id} has no hide building`);
        continue;
      }
      if (!info.unlimited && info.hideCap != null && info.hideCap > 0 && info.stored != null && info.stored >= info.hideCap) {
        gbLogT('cave-full-' + id, 120000, `cave: town ${id} hide full (${info.stored}/${info.hideCap})`);
        continue;
      }
      const amt = caveExcessAmount(info);
      if (!amt) continue;
      jobs.push({ id, amt, iron: info.iron, cap: info.cap });
    }
    if (!jobs.length) {
      gbLogT('cave-idle', 120000, `cave: nothing to stash (${scanReason(reason)})`);
      return;
    }
    let i=0,done=0,captcha=false;
    (function next(){
      if(i>=jobs.length||captcha){
        if(done)gbLog(`cave: stashed ${done}/${jobs.length} town(s)${captcha?' (captcha abort)':''}`);
        renderCaveTowns();return;
      }
      const job=jobs[i++];
      const lockName=`cave:${String(job.id)}`,lockToken=gbLock(lockName,120000);
      if(!lockToken){gbTimeout(next,100);return}
      const fresh=caveTownInfo(job.id),freshAmt=caveExcessAmount(fresh);
      if(!fresh||freshAmt<CAVE_MIN_STORE){
        gbUnlock(lockName,lockToken);
        gbLogT('cave-stale-'+job.id,60000,`cave: town ${job.id} changed before send — skipped`);
        gbTimeout(next,150);return;
      }
      caveStoreIron(job.id,Math.min(job.amt,freshAmt),(err)=>{
        gbUnlock(lockName,lockToken);
        if(err==='captcha'||err==='captcha-pause'){captcha=true;i=jobs.length}
        else if(!err){done++;gbLog(`cave: town ${job.id} stored ${Math.min(job.amt,freshAmt)} iron (was ${job.iron}/${job.cap})`)}
        else gbLogT('cave-err-'+job.id,60000,`cave: town ${job.id} err ${err}`);
        gbTimeout(next,500+Math.random()*400);
      });
    })();
  }
  function caveTownRowText(id, nameById, uw) {
    let name = nameById[String(id)] || id;
    if (name === id) {
      try {
        const t = gbTownModel(id);
        if (t && t.getName) name = t.getName();
        else if (t && t.name) name = t.name;
      } catch (_) {}
    }
    const info = caveTownInfo(id);
    let extra = '';
    if (info) {
      const pct = info.cap > 0 && info.iron != null ? Math.round(100 * info.iron / info.cap) : '?';
      const cave = info.unlimited ? 'inf'
        : (info.stored != null && info.hideCap != null ? `${info.stored}/${info.hideCap}`
          : (info.hideCap != null ? `?/${info.hideCap}` : 'n/a'));
      extra = ` \u2014 hide${info.hideLvl} iron ${pct}% cave ${cave}`;
      if (pct === '?' || (!info.unlimited && info.hideCap == null)) {
        gbLogT('cave-unknown-' + id, 300000,
          `cave: town ${id} unread fields (iron=${info.iron} cap=${info.cap} hideCap=${info.hideCap} stored=${info.stored}) \u2014 run caveDiag()`);
      }
    }
    return `${name} (#${id})${extra}`;
  }

  function caveTownsTick() {
    const sec = panel && panel.querySelector('section[data-tab=config]');
    if (!sec || sec.hidden || panel.classList.contains('collapsed')) return;
    if (document.hidden) return;
    renderCaveTowns();
    renderTradeTowns();
  }
  function renderCaveTowns() {
    const box = panel && panel.querySelector('.cave-towns');
    if (!box) return;
    const ids = caveListTownIds();
    if (!ids.length) {
      box.replaceChildren();
      const e = document.createElement('div');
      e.style.cssText = 'color:#888;font-size:10px';
      e.textContent = 'no towns loaded yet';
      gbTip(e, 'No hay ciudades cargadas todavia - pulsa Refrescar ciudades');
      box.appendChild(e);
      return;
    }

    const have = [...box.querySelectorAll('label[data-cave-town]')];
    const haveIds = have.map(l => l.dataset.caveTown);
    const sameSet = haveIds.length === ids.length && ids.every(id => haveIds.includes(String(id)));
    if (sameSet) {
      const uwc = uwCached();
      const names = Object.create(null);
      try {
        (townsFromGame() || []).forEach(t => { if (t.id != null && t.name) names[String(t.id)] = t.name; });
      } catch (_) {}
      have.forEach(l => {
        const id = l.dataset.caveTown;
        const chk = l.querySelector('input');
        const span = l.querySelector('span');
        if (chk && document.activeElement !== chk) chk.checked = caveTownEnabled(id);
        if (span) {
          const txt = caveTownRowText(id, names, uwc);
          if (span.textContent !== txt) span.textContent = txt;
        }
      });
      return;
    }
    box.replaceChildren();
    const uw = uwCached();
    const nameById = Object.create(null);
    try {
      (townsFromGame() || []).forEach(t => { if (t.id != null && t.name) nameById[String(t.id)] = t.name; });
    } catch (_) {}
    ids.forEach(id => {
      const label = document.createElement('label');
      label.dataset.caveTown = String(id);
      label.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:10px;margin-left:12px';
      gbTip(label, 'Habilita la cueva automatica en esta ciudad (sin marca = se salta)');
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = caveTownEnabled(id);
      gbTip(chk, 'Marca para guardar plata automaticamente en la cueva de esta ciudad');
      chk.addEventListener('change', () => {
        setCaveTownEnabled(id, chk.checked);
        gbLog(`cave town ${id}`, chk.checked ? 'ON' : 'OFF');
      });
      const span = document.createElement('span');
      span.textContent = caveTownRowText(id, nameById, uw);
      gbTip(span, 'Estado de la cueva: plata actual, capacidad, nivel del edificio');
      label.appendChild(chk);
      label.appendChild(span);
      box.appendChild(label);
    });
  }
