  // ---------- auto-cave (Phase 8.1): stash excess iron into Hide ----------
  // Bridge payload from ModernBot autoHide / GameModels.Hide.storeIron:
  //   model_url: BuildingHide, action_name: storeIron, arguments: { iron_to_store }
  const CAVE_MIN_STORE = 100; // skip tiny posts

  function caveTownEnabled(townId) {
    const id = String(townId);
    const map = state.caveTowns || {};
    // missing key = enabled when global ON
    return map[id] !== false;
  }
  function setCaveTownEnabled(townId, on) {
    const id = String(townId);
    if (!state.caveTowns) state.caveTowns = {};
    state.caveTowns[id] = !!on;
    save(STORE.CAVE_TOWNS, state.caveTowns);
  }

  // Method names differ per client build, so every read below is a probe list,
  // never one hardcoded call (`gbProbeNum` / `gbProbeAttr` live in core.js).
  // Town API (game.min): getHideStorageCapacity / getEspionageStorage;
  // capacity = hideLvl * getMaxStorageLimitPerHideLevel() unless max hide,
  // which returns getHideStorageLevelUnlimited() === -1 (inf sentinel).
  const CAVE_CAP_FNS = ['getHideStorageCapacity', 'getEspionageStorageCapacity', 'getHideCapacity',
    'getMaxEspionageStorage', 'getEspionageStoreCapacity'];
  const CAVE_STORED_FNS = ['getEspionageStorage', 'getHideStorage', 'getEspionageStore',
    'getStoredIron', 'getHideIron'];

  // GameData.constants.common.hide_storage_level_unlimited - always -1 on live.
  // MUST compare with === / < 0, never >= : any positive hideCap is >= -1.
  function caveUnlimSentinel() {
    try {
      const gdb = uwCached().GameDataBuildings;
      if (gdb && typeof gdb.getHideStorageLevelUnlimited === 'function') {
        const v = +gdb.getHideStorageLevelUnlimited();
        if (isFinite(v)) return v;
      }
    } catch (_) {}
    return -1;
  }
  function cavePerLevelLimit() {
    try {
      const gdb = uwCached().GameDataBuildings;
      if (gdb && typeof gdb.getMaxStorageLimitPerHideLevel === 'function') {
        const v = +gdb.getMaxStorageLimitPerHideLevel();
        if (isFinite(v) && v > 0) return v;
      }
    } catch (_) {}
    return null;
  }

  function caveTownInfo(townId) {
    const uw = uwCached();
    let t = null;
    try {
      t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]);
    } catch (_) {}
    if (!t) return null;
    let hideLvl = 0;
    try {
      if (t.getBuildings) hideLvl = +t.getBuildings().get('hide') || 0;
      else if (t.buildings) hideLvl = +(t.buildings().attributes || {}).hide || 0;
    } catch (_) {}
    let iron = null, cap = null, resStorage = null;
    try {
      const r = t.resources && t.resources();
      if (r && r.iron != null) iron = +r.iron;
      if (r && r.storage != null) resStorage = +r.storage;
    } catch (_) {}
    // Shared reader first (core `townResState`) so cave and the farm warehouse
    // gate can never disagree about what "full" means for the same town.
    const shared = townResState(townId);
    if (shared) {
      cap = shared.cap;
      if (iron == null) iron = shared.iron;
    }
    if (!(cap > 0)) cap = gbProbeNum(t, ['getStorageCapacity', 'getStorage', 'getResourceCapacity']);
    if (!(cap > 0)) cap = gbProbeNum(t.storage, ['getCapacity']);
    // resources().storage is capacity on most builds (small values = building level).
    if (!(cap > 0) && resStorage > 100) cap = resStorage;
    if (!(cap > 0)) cap = null;

    let hideCap = null, stored = null, unlimited = false;
    hideCap = gbProbeNum(t, CAVE_CAP_FNS);
    if (hideCap == null) hideCap = gbProbeAttr(t, ['hide_capacity', 'espionage_storage_capacity']);
    stored = gbProbeNum(t, CAVE_STORED_FNS);
    if (stored == null) stored = gbProbeAttr(t, ['espionage_storage', 'hide_storage', 'stored_iron']);
    try {
      // BuildingHide model (present once the cave window has been opened at least once).
      const hb = uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('BuildingHide');
      const hm = hb && hb.models && hb.models.filter(m => String((m.attributes || {}).town_id) === String(townId))[0];
      if (hm) {
        if (hideCap == null) hideCap = gbProbeNum(hm, CAVE_CAP_FNS) ?? gbProbeAttr(hm, ['capacity', 'max_storage']);
        if (stored == null) stored = gbProbeNum(hm, CAVE_STORED_FNS) ?? gbProbeAttr(hm, ['storage', 'iron', 'stored_iron']);
      }
    } catch (_) {}
    try {
      const gdb = uw.GameDataBuildings;
      const gd = uw.GameData && uw.GameData.buildings && uw.GameData.buildings.hide;
      const maxHide = gd && gd.max_level;
      if (maxHide != null && hideLvl >= +maxHide) unlimited = true;
      // Town.getHideStorageCapacity at max level returns the inf sentinel (-1).
      const unlim = caveUnlimSentinel();
      if (hideCap != null && (hideCap === unlim || hideCap < 0)) unlimited = true;
      // Formula fallback when the town method is missing / throws (Diag saw hideCap=null
      // with stored=5000 on hide5 -> 5x1000, i.e. already full and still posting).
      if (!unlimited && !(hideCap > 0) && hideLvl > 0) {
        const per = cavePerLevelLimit();
        if (per > 0) hideCap = hideLvl * per;
      }
      if (!unlimited && !(hideCap > 0) && gd && gd.storage != null) {
        const s = gd.storage;
        const v = +(Array.isArray(s) || typeof s === 'object' ? s[hideLvl] : s);
        if (isFinite(v) && v > 0) hideCap = v;
      }
      // Never probe getEspionageStorage on GameDataBuildings - that is the town
      // *stored* reader, not a capacity table.
      if (!unlimited && !(hideCap > 0) && gdb) {
        hideCap = gbProbeNum(gdb, ['getHideStorageCapacity'], [hideLvl]);
      }
    } catch (_) {}
    if (unlimited) hideCap = null; // UI shows inf; free-space math must not use -1
    return { town: t, hideLvl, iron, cap, hideCap, stored, unlimited };
  }

  // Dump what the client actually exposes, so unknown builds can be taught by name.
  function caveDiag(townId) {
    const uw = uwCached();
    const id = townId != null ? townId : (caveListTownIds()[0]);
    let t = null;
    try {
      t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(id) : uw.ITowns.towns[id]);
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
    const pct = Math.min(99, Math.max(50, +state.caveThreshPct || 90));
    const keep = Math.floor(info.cap * (pct / 100));
    if (info.iron < keep) return 0; // not at threshold yet
    let excess = Math.floor(info.iron - keep);
    if (excess < CAVE_MIN_STORE) return 0;
    // Unlimited (max hide) -> stash all excess. Finite -> clamp / refuse when full.
    // Unknown finite capacity or stored -> refuse (don't burn budget on a full cave).
    if (!info.unlimited) {
      if (!(info.hideCap > 0) || info.stored == null) return 0;
      const free = Math.floor(info.hideCap - info.stored);
      if (free <= 0) return 0; // cave full
      excess = Math.min(excess, free);
    }
    return excess >= CAVE_MIN_STORE ? excess : 0;
  }

  function caveStoreIron(townId, amount, onDone) {
    bridgePost('cave', {
      model_url: 'BuildingHide',
      action_name: 'storeIron',
      arguments: { iron_to_store: +amount },
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
    if (gbLocked('cave')) { gbLogT('cave-inflight', 30000, 'cave: skipped (in flight)'); return; }
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
      if (!info.unlimited && info.hideCap > 0 && info.stored != null && info.stored >= info.hideCap) {
        gbLogT('cave-full-' + id, 120000, `cave: town ${id} hide full (${info.stored}/${info.hideCap})`);
        continue;
      }
      if (!info.unlimited && (!(info.hideCap > 0) || info.stored == null)) {
        gbLogT('cave-unknown-' + id, 300000,
          `cave: town ${id} skip stash (hideCap=${info.hideCap} stored=${info.stored}) - open cave once or run caveDiag()`);
        continue;
      }
      const amt = caveExcessAmount(info);
      if (!amt) continue;
      jobs.push({ id, amt, iron: info.iron, cap: info.cap });
    }
    if (!jobs.length) {
      gbLogT('cave-idle', 120000, `cave: nothing to stash (${reason || 'scan'})`);
      return;
    }
    gbLock('cave');
    let i = 0, done = 0, captcha = false;
    (function next() {
      if (i >= jobs.length || captcha) {
        gbUnlock('cave');
        if (done) gbLog(`cave: stashed ${done}/${jobs.length} town(s)${captcha ? ' (captcha abort)' : ''}`);
        renderCaveTowns();
        return;
      }
      const job = jobs[i++];
      caveStoreIron(job.id, job.amt, (err) => {
        if (err === 'captcha' || err === 'captcha-pause') {
          captcha = true;
          i = jobs.length;
        } else if (!err) {
          done++;
          gbLogT('cave-ok-' + job.id, 30000, `cave: town ${job.id} stored ${job.amt} iron (was ${job.iron}/${job.cap})`);
        } else {
          gbLogT('cave-err-' + job.id, 60000, `cave: town ${job.id} err ${err}`);
        }
        gbTimeout(next, 500 + Math.random() * 400);
      });
    })();
  }

  function renderCaveTowns() {
    const box = panel && panel.querySelector('.cave-towns');
    if (!box) return;
    const ids = caveListTownIds();
    box.replaceChildren();
    if (!ids.length) {
      const e = document.createElement('div');
      e.style.cssText = 'color:#888;font-size:10px';
      e.textContent = 'no towns loaded yet';
      box.appendChild(e);
      return;
    }
    const uw = uwCached();
    const nameById = Object.create(null);
    try {
      (townsFromGame() || []).forEach(t => { if (t.id != null && t.name) nameById[String(t.id)] = t.name; });
    } catch (_) {}
    ids.forEach(id => {
      let name = nameById[String(id)] || id;
      if (name === id) {
        try {
          const t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(id) : uw.ITowns.towns[id]);
          if (t && t.getName) name = t.getName();
          else if (t && t.name) name = t.name;
        } catch (_) {}
      }
      const info = caveTownInfo(id);
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:10px;margin-left:12px';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = caveTownEnabled(id);
      chk.addEventListener('change', () => {
        setCaveTownEnabled(id, chk.checked);
        gbLog(`cave town ${id}`, chk.checked ? 'ON' : 'OFF');
      });
      const span = document.createElement('span');
      let extra = '';
      if (info) {
        const pct = info.cap > 0 && info.iron != null ? Math.round(100 * info.iron / info.cap) : '?';
        const cave = info.unlimited ? 'inf'
          : (info.stored != null && info.hideCap != null ? `${info.stored}/${info.hideCap}`
            : (info.hideCap != null ? `?/${info.hideCap}` : 'n/a'));
        extra = ` - hide${info.hideLvl} iron ${pct}% cave ${cave}`;
        if (pct === '?' || (!info.unlimited && info.hideCap == null)) {
          gbLogT('cave-unknown-' + id, 300000,
            `cave: town ${id} unread fields (iron=${info.iron} cap=${info.cap} hideCap=${info.hideCap} stored=${info.stored}) - run caveDiag()`);
        }
      }
      span.textContent = `${name} (#${id})${extra}`;
      label.appendChild(chk);
      label.appendChild(span);
      box.appendChild(label);
    });
  }
