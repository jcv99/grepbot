  const SNAPSHOT_BUDGET_BYTES = 200000;
  let snapshotLastAt = 0;
  function snapshotRing() {
    if (!Array.isArray(state.snapshots)) state.snapshots = [];
    return state.snapshots;
  }
  function snapshotPayload() {
    let jrn = null;
    try { jrn = (typeof jrnStats === 'function') ? jrnStats(24 * 3600000) : null; } catch (_) {}
    return {
      cV: state.configVer,
      cfg: {
        autoFarm: !!state.autoFarm, autoCave: !!state.autoCave, autoTrade: !!state.autoTrade,
        abAuto: !!state.abAuto, ibAuto: !!state.ibAuto, autoResearch: !!state.autoResearch,
        autoRecruit: !!state.autoRecruit, autoCulture: !!state.autoCulture,
        dryRun: !!state.dryRun, safeMode: !!state.safeMode,
      },
      plans: {
        abTargets: state.abTargets, researchTargets: state.researchTargets,
        recruitTargets: state.recruitTargets, merchantWish: state.merchantWish,
      },
      txState: state.txState,
      circuits: state.circuits,
      decisionSkips: state.decisionSkips,
      farmOptionMap: state.farmOptionMap,
      farmUnitsOption: state.farmUnitsOption,
      lastSeenTs: state.lastSeenTs,

      decisions: jrn ? { ok: jrn.ok, err: jrn.err, total: jrn.total } : null,
    };
  }
  function snapshotBuild(reason) {
    if (state.snapshotsOn === false) return false;
    let text = '';
    try { text = JSON.stringify(snapshotPayload()); } catch (_) { return false; }

    if (text.length > SNAPSHOT_BUDGET_BYTES) {
      gbLogT('snapshot-oversize', 60000, `snapshot: ${text.length}B over the ${SNAPSHOT_BUDGET_BYTES}B budget - dropped`);
      return false;
    }
    const ring = snapshotRing();
    ring.push({ at: Date.now(), sizeBytes: text.length, reason: reason || 'tick', payload: JSON.parse(text) });
    while (ring.length > SNAPSHOT_SLOTS) ring.shift();
    snapshotLastAt = Date.now();
    save(STORE.SNAPSHOTS, ring);
    return true;
  }
  function snapshotTick() {
    if (state.snapshotsOn === false) return;
    if (Date.now() - snapshotLastAt < SNAPSHOT_INTERVAL_MS) return;

    if (automationPaused({})) return;
    snapshotBuild('tick');
  }
  function snapshotList() {
    return snapshotRing().map((s, i) => ({ slot: i, at: s.at, sizeBytes: s.sizeBytes, reason: s.reason }));
  }
  function snapshotTotalBytes() { return snapshotRing().reduce((n, s) => n + (+s.sizeBytes || 0), 0); }

  function snapshotRestore(slot) {
    if (state.safeMode) { flash('modo seguro: restaurar esta desactivado'); return false; }
    const s = snapshotRing()[slot];
    if (!s || !s.payload) return false;
    const p = s.payload;
    const put = (key, store, v) => { if (v === undefined) return; state[key] = v; save(store, v); };
    put('abTargets', STORE.AB_TARGETS, p.plans && p.plans.abTargets);
    put('researchTargets', STORE.RESEARCH_TARGETS, p.plans && p.plans.researchTargets);
    put('recruitTargets', STORE.RECRUIT_TARGETS, p.plans && p.plans.recruitTargets);
    put('merchantWish', STORE.MERCHANT_WISH, p.plans && p.plans.merchantWish);
    put('txState', STORE.TX_STATE, p.txState);
    put('circuits', STORE.CIRCUITS, p.circuits);
    put('decisionSkips', STORE.DECISION_SKIPS, p.decisionSkips);
    put('farmOptionMap', STORE.FARM_OPTION_MAP, p.farmOptionMap);
    put('farmUnitsOption', STORE.FARM_UNITS_OPTION, p.farmUnitsOption);
    gbLog(`snapshot: restored slot ${slot} from ${new Date(s.at).toLocaleString()}`);
    return true;
  }

  function profRings() {
    if (!state.profileRings || typeof state.profileRings !== 'object') state.profileRings = {};
    return state.profileRings;
  }
  function profTime(key, fn) {
    if (!state.profilerOn) return fn();
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    try {
      return fn();
    } finally {

      const dt = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0;
      const r = profRings();
      const e = r[key] || (r[key] = { count: 0, sumMs: 0, maxMs: 0, lastMs: 0, lastAt: 0 });
      e.count++; e.sumMs += dt; e.lastMs = dt; e.lastAt = Date.now();
      if (dt > e.maxMs) e.maxMs = dt;
    }
  }
  function profTopLines(n) {
    const r = profRings();
    const rows = Object.entries(r)
      .filter(([, e]) => e && e.count > 0)
      .map(([k, e]) => ({ k, avg: e.sumMs / e.count, max: e.maxMs, count: e.count }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, n || 8);
    if (!rows.length) return [];
    return ['perfilador (ms por llamada)'].concat(
      rows.map(x => `  ${x.k.padEnd(22)} ${x.avg.toFixed(1).padStart(7)} med  ${x.max.toFixed(1).padStart(7)} max  ${String(x.count).padStart(5)} llam.`));
  }

  const MEM_SAMPLE_MS = 300000;
  const MEM_RING = 24;
  const MEM_MAPS = ['dodgeReturns', 'txState', 'decisionSkips', 'farmResources', 'townResources', 'spellCooldown', 'buildSwapIgnore'];
  let memNextAt = 0;
  function memRing() {
    if (!Array.isArray(state.memSamples)) state.memSamples = [];
    return state.memSamples;
  }
  function memSample() {
    let used = null, total = null;
    try {
      const m = (typeof performance !== 'undefined') ? performance.memory : null;
      if (m && Number.isFinite(+m.usedJSHeapSize)) { used = +m.usedJSHeapSize; total = +m.totalJSHeapSize; }
    } catch (_) {}
    const maps = {};
    for (const k of MEM_MAPS) {
      const v = state[k];
      maps[k] = (v && typeof v === 'object') ? Object.keys(v).length : null;
    }

    return { ts: Date.now(), used, total, maps, blind: used == null };
  }
  function memTick() {
    if (!state.memProbeOn) return;
    const now = Date.now();
    if (now < memNextAt) return;
    memNextAt = now + MEM_SAMPLE_MS;
    const ring = memRing();
    ring.push(memSample());
    while (ring.length > MEM_RING) ring.shift();
  }
  function memLines() {
    const ring = memRing();
    if (!ring.length) return [];
    const last = ring[ring.length - 1], first = ring[0];
    const mb = n => (n == null ? null : (n / 1048576).toFixed(1));
    const lines = [];
    if (last.blind) {
      gbLogT('mem-api', 3600000, 'memory probe: performance.memory no disponible (solo Chromium) - solo tamanos de mapas');
      lines.push('memoria: API no disponible (solo Chromium)');
    } else {
      const d = (last.used != null && first.used != null) ? last.used - first.used : null;
      lines.push(`memoria: ${mb(last.used)} Mb usados / ${mb(last.total)} Mb total` +
        (d != null ? ` (delta ${d >= 0 ? '+' : ''}${mb(d)} Mb en ${ring.length} muestras)` : ''));
    }
    lines.push('mapas: ' + MEM_MAPS.map(k => `${k}=${last.maps[k] == null ? '?' : last.maps[k]}`).join(' '));
    return lines;
  }

  function diagnosticsTick() {
    try { snapshotTick(); } catch (_) {}
    try { memTick(); } catch (_) {}
  }
  function statsPct(n, d) { return d ? Math.round(n / d * 100) + '%' : '-'; }

  const statsYieldToMain = () => (globalThis.scheduler && typeof globalThis.scheduler.yield === 'function')
    ? globalThis.scheduler.yield()
    : new Promise(r => setTimeout(r, 0));

  const FAVOR_HUD_WINDOW_MS = 600000;
  const FAVOR_HUD_GODS = ['zeus', 'poseidon', 'hera', 'athena', 'hades', 'ares', 'artemis', 'aphrodite'];
  const favorRateSamples = Object.create(null);
  function favorHudGods(fav) {

    const seen = new Set();
    for (const k of Object.keys(fav || {})) {
      const m = String(k).match(/^(?:favor_)?([a-z]+)(?:_max)?$/i);
      if (m && FAVOR_HUD_GODS.includes(m[1].toLowerCase())) seen.add(m[1].toLowerCase());
    }
    return seen.size ? Array.from(seen) : FAVOR_HUD_GODS;
  }
  function favorHudRead(fav, god) {
    const cur = +(fav[god] != null ? fav[god] : fav['favor_' + god]);
    const maxRaw = fav['max_favor_' + god] != null ? fav['max_favor_' + god]
      : (fav['favor_' + god + '_max'] != null ? fav['favor_' + god + '_max'] : fav['max_' + god]);
    const max = +maxRaw;
    return {
      cur: Number.isFinite(cur) ? cur : null,
      max: Number.isFinite(max) && max > 0 ? max : null,
    };
  }
  function favorHudRate(god, cur) {
    const now = Date.now();
    const list = favorRateSamples[god] || (favorRateSamples[god] = []);
    list.push({ ts: now, p: cur });
    while (list.length && now - list[0].ts > FAVOR_HUD_WINDOW_MS) list.shift();
    if (list.length < 2) return null;
    const first = list[0];
    const dt = (now - first.ts) / 1000;
    if (dt <= 0) return null;
    const rate = (cur - first.p) / dt;

    return rate > 0 ? rate : 0;
  }
  function favorHudBlock() {
    const lines = [];
    let fav = null;
    try { fav = favorCurrent(); } catch (_) {}
    if (!fav || typeof fav !== 'object') {
      gbLogT('favor-hud-blind', 300000, 'favor HUD: god pools unreadable');
      return ['favor (dioses) no legible'];
    }
    const thresh = Number.isFinite(+((state.favorCfg || {}).thresh)) ? +state.favorCfg.thresh : 200;
    const rows = [];
    for (const god of favorHudGods(fav)) {
      const r = favorHudRead(fav, god);
      if (r.cur == null && r.max == null) continue;
      const rate = r.cur == null ? null : favorHudRate(god, r.cur);
      let eta = '\u2014';
      if (r.cur != null && r.cur >= thresh) eta = 'ya';
      else if (rate == null) eta = '\u2026';
      else if (rate > 0 && r.cur != null) eta = fmtSec(Math.round((thresh - r.cur) / rate));
      rows.push(`  ${god.padEnd(11)}${String(r.cur == null ? '?' : Math.round(r.cur)).padStart(6)}` +
        `${String(r.max == null ? '?' : Math.round(r.max)).padStart(7)}` +
        `${(rate == null ? '\u2026' : (rate * 60).toFixed(1) + '/m').padStart(9)}` +
        `  ${eta}`);
    }
    if (!rows.length) {
      gbLogT('favor-hud-blind', 300000, 'favor HUD: god pools unreadable');
      return ['favor (dioses) no legible'];
    }
    lines.push(`favor (dioses)      actual    max     tasa  eta ${thresh}`);
    lines.push(...rows);
    return lines;
  }

  const GROWTH_MAX_SAMPLES = 96;
  const GROWTH_TTL_MS = 7 * 86400000;
  const GROWTH_SPARK = '\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588';
  function townGrowthHist() {
    if (!state.townGrowthHist || typeof state.townGrowthHist !== 'object' || Array.isArray(state.townGrowthHist)) state.townGrowthHist = {};
    return state.townGrowthHist;
  }
  function townGrowthSample(ids) {

    if (!Array.isArray(ids) || !ids.length) return;
    const H = townGrowthHist();
    const now = Date.now(), cut = now - GROWTH_TTL_MS;
    let changed = false;
    for (const id of (ids || [])) {
      const key = String(id);
      const r = (state.townResources || {})[id] || (state.townResources || {})[key];
      if (!r || !r.ok) continue;

      const row = { t: now };
      for (const k of GB_RES_KEYS) if (Number.isFinite(+r[k])) row[k] = +r[k];
      if (Number.isFinite(+r.pop)) row.pop = +r.pop;
      if (Object.keys(row).length < 2) continue;
      const list = H[key] || (H[key] = []);
      list.push(row);
      while (list.length && (list.length > GROWTH_MAX_SAMPLES || list[0].t < cut)) list.shift();
      changed = true;
    }

    const live = new Set((ids || []).map(String));
    for (const k of Object.keys(H)) if (!live.has(k)) { delete H[k]; changed = true; }
    if (changed) save(STORE.TOWN_GROWTH_HIST, H);
  }
  function growthSpark(values) {
    const v = values.filter(x => Number.isFinite(x));
    if (v.length < 2) return '';
    const min = Math.min(...v), max = Math.max(...v), span = max - min;

    if (!(span > 0)) return GROWTH_SPARK[0].repeat(Math.min(24, v.length));
    return v.slice(-24).map(x => GROWTH_SPARK[Math.min(GROWTH_SPARK.length - 1, Math.floor((x - min) / span * (GROWTH_SPARK.length - 1)))]).join('');
  }
  function growthBlock() {
    const H = townGrowthHist();
    const id = (typeof hudCurrentTownId === 'function' ? hudCurrentTownId() : null) || Object.keys(H)[0];
    const list = id ? H[String(id)] : null;
    if (!list || list.length < 2) return [];
    const spanMs = list[list.length - 1].t - list[0].t;
    const days = Math.max(0.1, spanMs / 86400000);
    const lines = [`crecimiento - ${townNameById(id)} (${id})  ${list.length} muestras / ${days.toFixed(1)}d`];
    for (const [key, label] of [['pop', 'pob  '], ['wood', 'mad  '], ['stone', 'pie  '], ['iron', 'pla  ']]) {
      const vals = list.map(x => x[key]).filter(x => Number.isFinite(x));
      if (vals.length < 2) continue;
      const first = vals[0], last = vals[vals.length - 1], d = last - first;
      lines.push(`  ${label}${growthSpark(vals)}  ${fmt(first)} -> ${fmt(last)}  ` +
        `${d >= 0 ? '+' : ''}${fmt(d)} / ${days.toFixed(1)}d`);
    }
    return lines.length > 1 ? lines : [];
  }
  function preflightProbe(name, fn) {
    try {
      const r = fn();
      if (!r) return { name, ok: false, detail: 'no result' };
      return { name, ok: r.ok !== false, detail: r.detail || '', warn: !!r.warn };
    } catch (e) {
      return { name, ok: false, detail: String(e).slice(0, 80) };
    }
  }
  function preflightRun() {
    const out = [];
    const uw = gameUw();
    const bs = gameBridgeStatus();
    out.push(preflightProbe('bridge', () => ({
      ok: bs.MM && bs.gpAjax && bs.ITowns,
      detail: Object.keys(bs).filter(k => bs[k]).join(' ') || 'nothing readable',
    })));
    out.push(preflightProbe('csrf', () => ({
      ok: !!state.csrf,
      detail: state.csrf ? state.csrf.slice(0, 6) + '\u2026' : 'not found (GM_xmlhttpRequest report fetch needs it)',
    })));
    out.push(preflightProbe('towns', () => {
      const t = (townsFromGame() || []);
      return { ok: t.length > 0, detail: t.length + ' towns readable' };
    }));
    out.push(preflightProbe('farm claims', () => {
      const farms = farmsFromGame() || [];
      const ready = farms.filter(f => f.lootable_at == null || gameNow() >= f.lootable_at).length;
      const tpl = state.claimTpl ? 'template learned' : 'template NOT learned (claim once by hand)';
      return {
        ok: farms.length > 0,
        warn: !state.claimTpl,
        detail: `${farms.length} villages, ${ready} claimable, ${tpl}, options ${farmOptionMapText()}`,
      };
    }));
    out.push(preflightProbe('farm unit claims', () => {
      const mode = String(state.farmUnitsMode || 'off');
      if (mode === 'off') return { ok: true, warn: true, detail: 'disabled in Config (resources only)' };

      const villages = farmsFromGame() || [];
      const sample = villages[0] || null;
      const opt = farmUnitOption(sample);
      const unit = opt != null ? farmUnitIdFor(opt) : null;
      const table = (typeof farmClaimUnitsTable === 'function') ? farmClaimUnitsTable(sample) : null;
      const amount = table && unit && table[unit] != null ? +table[unit] : null;
      const dryMap = (state.farmResDry && typeof state.farmResDry === 'object') ? state.farmResDry : {};
      const dry = Object.keys(dryMap).filter(k => farmResDryMarked(k)).length;
      const capped = villages.filter(f => {
        const left = farmDailyLeft(f);
        return left != null && left <= 0;
      }).length;
      return {
        ok: opt != null,
        warn: opt == null || amount == null,
        detail: opt == null
          ? `mode ${mode}, pick ${state.farmUnitsPref || 'auto'} - no unit card readable (claim units once by hand or pin a unit in Ajustes)`
          : `mode ${mode}, pick ${state.farmUnitsPref || 'auto'} -> option ${opt} (${unit}), amount ${amount == null ? '\u2014' : amount}, ${capped} village(s) at the daily cap, ${dry} marked dry`,
      };
    }));
    out.push(preflightProbe('farm resource scrape', () => {
      const st = (typeof farmScrapeState === 'function') ? farmScrapeState() : { dead: false, misses: 0 };
      const on = !!state.farmScrape;
      const learned = !!state.farmAction;
      if (!on) return { ok: true, warn: true, detail: 'disabled in Config (reads no village stock)' };
      if (st.dead) return { ok: false, detail: `endpoint dead after ${st.misses} empty sweeps - teach it by opening a village, then re-enable` };
      const okRows = Object.values(state.farmResources || {}).filter(r => r && r.ok).length;
      return {
        ok: okRows > 0 || !learned,
        warn: !learned,
        detail: `${okRows} villages with data, action ${state.farmAction || 'not learned'}, misses ${st.misses || 0}`,
      };
    }));
    out.push(preflightProbe('long farm claim', () => {
      const sec = farmLongClaimDuration();
      const opt = farmOptionFor(sec);
      return {
        ok: opt != null,
        warn: opt == null,
        detail: opt != null ? `${farmDurLabel(sec)} = option ${opt}` : `${farmDurLabel(sec)} not learned - claim that timer once by hand`,
      };
    }));
    out.push(preflightProbe('instant build', () => {
      const orders = ibOrders() || [];
      const free = orders.filter(o => o.isFree).length;
      return { ok: true, detail: `${orders.length} orders, ${free} free now, action ${state.ibAction}` };
    }));
    out.push(preflightProbe('instant research', () => {
      const r = (typeof ibResearchOrders === 'function' ? (ibResearchOrders({}) || []) : []);
      return {
        ok: state.ibResearch !== false,
        detail: `${r.length} research orders, action ${state.ibActionR}${state.ibResearch === false ? ' (OFF)' : ''}`,
      };
    }));
    out.push(preflightProbe('cave', () => {
      const ids = caveListTownIds() || [];
      let withHide = 0, readable = 0;
      ids.forEach(id => {
        const info = caveTownInfo(id);
        if (!info) return;
        readable++;
        if (info.hideLvl > 0) withHide++;
      });
      return {
        ok: readable > 0,
        warn: withHide === 0,
        detail: `${readable}/${ids.length} towns readable, ${withHide} with a hide`,
      };
    }));
    out.push(preflightProbe('trade', () => {
      const t = tradeListTowns() || [];
      const cap = t.filter(x => x.cap > 0).length;
      return { ok: t.length >= 2, detail: `${t.length} towns, ${cap} with readable capacity` };
    }));
    out.push(preflightProbe('research', () => {
      const ids = (townsFromGame() || []).map(t => t.id);
      const info = ids.length ? researchTownTechs(ids[0]) : null;
      const n = info && info.techs ? Object.keys(info.techs).length : 0;
      return { ok: !!info && info.academy != null && info.academy >= 0 && n >= 0, warn: !n, detail: info ? `${n} researched-tech flags, academy ${info.academy == null ? 'UNREADABLE' : info.academy}` : 'academy techs unreadable' };
    }));

    out.push(preflightProbe('academy read path', () => {
      const ids = (townsFromGame() || []).map(t => t.id);
      const tid = ids[0];
      const info = tid != null ? researchTownTechs(tid) : null;
      if (!info) return { ok: false, detail: 'no readable town' };
      const parts = [];
      let bad = 0;
      let defs = 0;
      try { defs = Object.keys((gameUw().GameData && gameUw().GameData.researches) || {}).length; } catch (_) {}
      if (defs) parts.push(`GameData.researches ${defs}`);
      else { parts.push('GameData.researches UNREADABLE'); bad++; }
      if (info.academy == null) { parts.push('academy UNREADABLE'); bad++; }
      else parts.push(`academy ${info.academy}`);
      parts.push(info.library == null ? 'library UNREADABLE' : `library ${info.library}`);
      if (info.library == null) bad++;
      parts.push(info.ordersKnown ? `real queue ${info.orders.length}/${researchQueueMax()}` : 'real queue UNREADABLE (open that town once)');
      if (!info.ordersKnown) bad++;
      const pts = researchPointsAvailable(tid, info);
      if (pts == null) { parts.push('research points UNREADABLE'); bad++; }
      else parts.push(`research points ${pts}`);
      parts.push(info.smallIsland == null ? 'small-island flag unreadable' : `small island ${info.smallIsland}`);
      return { ok: bad === 0, warn: bad > 0, detail: parts.join(', ') };
    }));

    out.push(preflightProbe('village recruit', () => {
      const parts = [];
      let bad = 0, warn = 0;
      const tpl = state.acceptUnitsTpl;
      if (tpl && tpl.action_name) parts.push(`tpl ${tpl.action_name}`);
      else { parts.push('tpl UNLEARNED (open a village, click Aceptar once)'); warn++; }
      const farms = (state.farmsParsed || []);
      const sample = farms.find(f => f && f.vill_id);
      if (!sample) { parts.push('no farms known'); warn++; return { ok: true, warn: true, detail: parts.join(', ') }; }
      const counts = villageUnitCounts(sample.vill_id);
      if (counts && counts.known) {
        const u = counts.units;
        parts.push(`units ${u.sword}/${u.archer}/${u.hoplite}/${u.slinger}`);
      } else { parts.push('unit counts UNREADABLE (attribute shape unknown)'); bad++; }
      const fr = state.farmResources && state.farmResources[sample.vill_id];
      if (fr && fr.ok && fr.cap > 0) parts.push(`fill read OK (cap ${fr.cap})`);
      else { parts.push('fill read pending (next farm scrape)'); warn++; }
      return { ok: bad === 0, warn: warn > 0 || bad > 0, detail: parts.join(', ') };
    }));

    out.push(preflightProbe('tx registry', () => {
      const tx = state.txState || {};

      const inflight = Object.values(tx).filter(t => t && /^(planned|precheck|sending|confirming|reconciling|sent|dryrun|aborted|failed|unknown|manual-review)$/.test(t.state || '')).length;
      const unknown = Object.values(tx).filter(t => t && /^(unknown|manual-review)$/.test(t.state || '')).length;
      const stale = Object.values(tx).filter(t => t && t.state === 'aborted' && (Date.now() - (+t.updatedAt || 0)) > 600000).length;
      return {
        ok: true,
        warn: unknown > 0 || stale > 0,
        detail: `${Object.keys(tx).length} transactions, ${inflight} live, ${unknown} unknown, ${stale} stale-aborted`,
      };
    }));
    out.push(preflightProbe('phoenician', () => {
      const view = !!state.ptViewUrl;
      const tpl = !!state.ptTradeTpl;
      const on = !!state.autoPtTrade;
      const parser = (typeof ptParseOffers === 'function') ? 'parser defined' : 'parser MISSING';
      return {
        ok: view || tpl || !on,
        warn: on && !(view && tpl),
        detail: `view ${view ? 'aprendida' : 'SIN aprender'}, tpl ${tpl ? 'aprendido' : 'SIN aprender'}, auto ${on ? 'ON' : 'OFF'}, ${parser}`,
      };
    }));
    out.push(preflightProbe('native queue', () => {
      const nq = state.nativeQueue || {};
      const towns = Object.keys(nq.towns || {}).length;
      const build = Object.values(nq.towns || {}).reduce((n, t) => n + (Array.isArray(t.build) ? t.build.length : 0), 0);
      const recruit = Object.values(nq.towns || {}).reduce((n, t) => n + (Array.isArray(t.recruit) ? t.recruit.length : 0), 0);
      const research = Object.values(nq.towns || {}).reduce((n, t) => n + (Array.isArray(t.research) ? t.research.length : 0), 0);
      return { ok: towns === 0 || (build + recruit + research) > 0, detail: `${towns} town(s) in native queue, ${build} build / ${recruit} recruit / ${research} research jobs` };
    }));
    out.push(preflightProbe('intel: battle stats', () => {
      const n = (state.findings || []).length;
      const withVerdict = (state.findings || []).filter(f => f && f.outcome).length;
      return {
        ok: true,

        warn: n < 5,
        detail: state.intelBattleStats === false
          ? 'desactivado en Config'
          : `${n} informes, ${withVerdict} con resultado` + (n < 5 ? ' - muestra pequena' : ''),
      };
    }));
    out.push(preflightProbe('colony threats', () => {
      const rows = militaryColonyThreats();
      const known = rows.filter(r => r.etaKnown).length;
      const withRecall = rows.filter(r => r.recallCandidates.length).length;
      return {
        ok: true,
        warn: rows.length - known > 0,
        detail: `${rows.length} amenazas, ${known} con ETA legible, ${withRecall} con refuerzo retirable` +
          (state.cancelTpl ? '' : ' - plantilla de cancelacion SIN aprender'),
      };
    }));
    out.push(preflightProbe('support: auto-send', () => {
      const cfg = supportCfg();
      const tpl = !!(state.supportTpl && state.supportTpl.action_name);
      const paused = captchaPaused('support');
      const ledger = Object.keys(state.supportLastSend || {}).length;
      return {

        ok: true,
        warn: (cfg.auto && !tpl) || (cfg.auto && paused),
        detail: `auto ${cfg.auto ? 'ON' : 'OFF'}, tpl ${tpl ? state.supportTpl.action_name : 'SIN aprender (envia un apoyo a mano)'}` +
          `, confirmar>${cfg.confirmThreshold}, ${ledger} ventana(s) en registro` + (paused ? ', CAPTCHA' : ''),
      };
    }));
    out.push(preflightProbe('refuerzos: pestana manual', () => {
      const plan = rfPlan();
      const tpl = !!(state.supportTpl && state.supportTpl.action_name);
      const target = plan.targetId ? rfResolveTarget(plan) : null;
      const sources = Array.isArray(plan.sourceTownIds) ? plan.sourceTownIds.length : (state.towns || []).length;
      let ready = 0;
      if (target) {
        try {
          ready = rfBuildSchedule(plan).rows.filter(r => r.unitCount && r.boats.ok).length;
        } catch (_) { ready = 0; }
      }
      return {
        ok: true,
        warn: !!plan.targetId && !target,
        detail: `ayuda ${RF_MODE_ES[plan.helpMode] || plan.helpMode}, destino ${plan.targetId ? (target ? '#' + target.town_id : 'NO resuelto') : 'sin fijar'}`
          + `, ${sources} origen(es), ${ready} listo(s), ruta ${tpl ? 'plantilla ' + state.supportTpl.action_name : 'canonica town_info/send_units'}`,
      };
    }));
    out.push(preflightProbe('espionaje: envio manual', () => {
      const cfg = spsCfg();
      const src = spsSourceTownId(cfg);
      const cave = src ? spsCaveSilver(src) : { stored: null, hideLvl: null };
      const plan = spsPlan();
      return {
        ok: true,

        warn: cave.stored == null,
        detail: `modo ${cfg.mode === 'bulk' ? 'masivo' : 'rapido'}, origen ${src ? '#' + src : '-'}, cueva ${cave.stored == null ? 'ILEGIBLE' : cave.stored + ' plata'}`
          + `, ${plan.error ? 'plan: ' + plan.error : 'plan listo (~' + plan.total + ' plata)'}`,
      };
    }));
    out.push(preflightProbe('snapshots', () => {
      const l = snapshotList();
      const kb = Math.round(snapshotTotalBytes() / 1024);
      return {
        ok: true,
        warn: state.snapshotsOn !== false && !l.length,
        detail: state.snapshotsOn === false ? 'desactivado'
          : `${l.length}/${SNAPSHOT_SLOTS} ranuras, ${kb} KB` + (l.length ? `, ultima ${new Date(l[l.length - 1].at).toLocaleTimeString()}` : ''),
      };
    }));
    out.push(preflightProbe('profiler', () => {
      const n = Object.keys(state.profileRings || {}).length;
      return { ok: true, detail: state.profilerOn ? `activo, ${n} clave(s) muestreadas` : 'desactivado (por defecto)' };
    }));
    out.push(preflightProbe('memory probe', () => {
      if (!state.memProbeOn) return { ok: true, detail: 'desactivado (por defecto)' };
      const s0 = memSample();
      return {
        ok: true,

        warn: s0.blind,
        detail: (s0.blind ? 'heap no legible (solo Chromium), ' : `heap ${(s0.used / 1048576).toFixed(1)} Mb, `) +
          `${(state.memSamples || []).length} muestras`,
      };
    }));
    out.push(preflightProbe('favor pool read', () => {
      let fav = null;
      try { fav = favorCurrent(); } catch (_) {}
      if (!fav || typeof fav !== 'object') return { ok: false, detail: 'PlayerGods no legible' };
      const gods = favorHudGods(fav);
      const readable = gods.filter(g => favorHudRead(fav, g).cur != null);
      const withMax = gods.filter(g => favorHudRead(fav, g).max != null);
      return {
        ok: readable.length > 0,
        warn: withMax.length === 0,
        detail: `${readable.length}/${gods.length} pozo(s) legibles, ${withMax.length} con maximo legible` +
          (readable.length ? ` (${readable.join(',')})` : ''),
      };
    }));
    out.push(preflightProbe('wall repair', () => {
      if (!state.autoWallRepair) return { ok: true, detail: 'desactivado (por defecto)' };
      const ids = (townsFromGame() || []).map(t => String(t.id));
      const readable = ids.filter(id => abWallDamage(id) != null).length;
      const damaged = ids.filter(id => (abWallDamage(id) || 0) > 0).length;
      return {
        ok: true,

        warn: readable === 0,
        detail: `${readable}/${ids.length} ciudad(es) con dano legible, ${damaged} danada(s)` +
          (readable === 0 ? ' - nombre de atributo no capturado en este cliente' : ''),
      };
    }));
    out.push(preflightProbe('godspell', () => {
      const cfg = state.favorCfg || {};
      const power = cfg.spellPower ? String(cfg.spellPower) : '';
      if (!state.autoFavor) return { ok: true, detail: 'desactivado (autoFavor OFF)' };
      if (!power) return { ok: true, warn: true, detail: 'sin id de poder - no se lanza nada (estado seguro por defecto)' };
      const known = !!RECRUIT_SPELL_GODS[power];
      const target = cfg.targetId && ['farm_town', 'farm', 'village'].includes(String(cfg.targetType || ''));
      return {
        ok: true,
        warn: !target || !known,
        detail: `poder ${power}${known ? '' : ' (dios desconocido - veredicto ciego)'}, objetivo ${target ? 'ok' : 'FALTA farm_town'}, reserva ${godSpellReservePct()}%`,
      };
    }));
    out.push(preflightProbe('hero: stamina readable', () => {
      const hs = (typeof playerHeroesListCached === 'function' ? playerHeroesListCached() : []);
      if (!hs.length) return { ok: true, detail: heroesEnabled() ? 'sin heroes legibles' : 'heroes desactivados en este mundo' };
      const withStam = hs.filter(h => h.stamina && h.stamina.current != null).length;
      const withEquip = hs.filter(h => h.equipment).length;
      return {
        ok: true,

        warn: withStam === 0,
        detail: `${hs.length} heroe(s), ${withStam} con vigor legible, ${withEquip} con equipo legible` +
          (withStam === 0 ? ' - nombres de atributo no capturados en este cliente' : '') +
          `, auto ${state.autoHero ? 'ON (propone)' : 'OFF'}`,
      };
    }));
    out.push(preflightProbe('spy: auto scheduler', () => {
      const cfg = spyCfg();
      const tpl = !!(state.spyTpl && state.spyTpl.action_name);
      let ranked = 0;
      try { ranked = spyRankTargets().length; } catch (_) {}
      return {
        ok: true,

        warn: !!state.spyEnabled && !tpl,
        detail: `auto ${state.spyEnabled ? 'ON' : 'OFF'}, ruta ${tpl ? state.spyTpl.action_name : 'SIN aprender'}` +
          `, simulacion ${cfg.dryRun ? 'ON' : 'OFF'}, ${ranked} objetivo(s) en cola`,
      };
    }));
    out.push(preflightProbe('militia', () => {
      return {
        ok: true,
        warn: false,
        detail: `auto ${state.autoMilitia ? 'ON' : 'OFF'} (levanta dentro de la ventana de ETA)`,
      };
    }));
    out.push(preflightProbe('cave: emergency', () => {
      const ids = (typeof caveListTownIds === 'function' ? caveListTownIds() : []);
      const ready = ids.filter(id => { try { return emergencyPlan(id).ok; } catch (_) { return false; } }).length;
      const ledger = Object.keys(state.emergencyLastStash || {}).length;
      return {
        ok: true,

        warn: !!state.emergencyCaveAuto && ready === 0,
        detail: `auto ${state.emergencyCaveAuto ? 'ON' : 'OFF'}, ${ready}/${ids.length} ciudad(es) listas ahora, minimo ${emergencyMinIron()}, ${ledger} movimiento(s) en registro`,
      };
    }));
    out.push(preflightProbe('dump', () => {
      if (!state.autoDump) return { ok: true, detail: 'desactivado (por defecto)' };
      const degenerate = [];
      for (const r of ['wood', 'stone', 'iron']) {
        const th = dumpThresholdFor(r), keep = dumpKeepPctFor(r);

        if (keep >= th) degenerate.push(`${r} conservar ${keep}% >= umbral ${th}%`);
      }
      const sinks = dumpSinkList();
      const ids = (townsFromGame() || []).map(t => String(t.id));
      const anyHide = ids.some(id => { try { const i = caveTownInfo(id); return i && i.hideLvl > 0; } catch (_) { return false; } });
      if (!sinks.length && !anyHide) {
        return { ok: false, detail: 'sin destinos configurados y ninguna ciudad con cueva - el vaciado no tendria a donde ir' };
      }
      return {
        ok: true,
        warn: degenerate.length > 0,
        detail: `ON, ${sinks.length || 'auto'} destino(s)` + (degenerate.length ? ' - ' + degenerate.join('; ') : ''),
      };
    }));
    out.push(preflightProbe('trade routes', () => {
      const all = Object.values(state.tradeRoutes || {});
      const enabled = all.filter(r => r && r.enabled !== false).length;
      const towns = new Set((townsFromGame() || []).map(t => String(t.id)));

      const orphan = all.filter(r => r && (!towns.has(String(r.from)) || !towns.has(String(r.to)))).length;
      return {
        ok: true,
        warn: orphan > 0 || (state.autoTradeRoutes && !enabled),
        detail: `${all.length} rutas, ${enabled} activas, bucle ${state.autoTradeRoutes ? 'ON' : 'OFF'}` +
          (orphan ? `, ${orphan} con ciudades desconocidas en este mundo` : ''),
      };
    }));
    out.push(preflightProbe('intel: threat engine weights', () => {
      const raw = (state.predictCfg && state.predictCfg.threatWeights) || null;
      const w = defenseThreatWeights();

      const drift = raw ? Object.keys(w).filter(k => raw[k] != null && +raw[k] !== w[k]) : [];
      return {
        ok: true,
        warn: drift.length > 0,
        detail: `cs ${w.cs} eta15 ${w.eta15} sim ${w.simPer}/${w.simCap} weak ${w.weak} apoyo -${w.supportPer}/${w.supportCap}` +
          (raw ? '' : ' (por defecto)') + (drift.length ? ` - fuera de rango y ajustado: ${drift.join(',')}` : ''),
      };
    }));
    out.push(preflightProbe('farm profit', () => {
      const farms = state.farmsParsed || [];
      const rows = Object.values(state.farmProfit || {});
      const scored = rows.filter(r => r && r.score != null).length;
      const blind = rows.length - scored;
      return {
        ok: true,
        warn: farms.length > 0 && scored === 0,
        detail: `${farms.length} aldeas, ${scored} puntuadas, ${blind} ciegas, marcha ${state.farmTravelSecPerUnit || 0}s/u`,
      };
    }));
    out.push(preflightProbe('loot calculator', () => {
      const e = gbLootEstimate({ kind: 'farm-claim', durationSec: 3600, loyalty: 1, headroom: 100000 });
      const carry = gbLootEstimate({ kind: 'attack-loot', units: { sword: 1 } });
      return {
        ok: true,

        warn: !!e.blind,
        detail: `farm-claim ${e.total}/h` + (e.blind ? ` BLIND (${e.blindReason})` : '') +
          ` \u00b7 attack-loot ${carry.blind ? 'ciego (' + carry.blindReason + ')' : carry.total}`,
      };
    }));
    out.push(preflightProbe('composition advisor', () => {
      const rows = militaryCompositionAll();
      const withShort = rows.filter(r => r.shortageTotal > 0).length;
      const blind = rows.reduce((n, r) => n + (r.blind || 0), 0);
      return {
        ok: true,
        warn: blind > 0,
        detail: `${rows.length} ciudades, ${withShort} con faltantes, ${blind} ciegas`,
      };
    }));
    out.push(preflightProbe('research graph', () => {
      const g = researchGraphBuild();
      if (!g.known) return { ok: false, detail: g.why };
      return { ok: true, warn: !!g.blind, detail: `${g.ids.length} tecnologias leidas` + (g.blind ? ' - ' + g.why : '') };
    }));
    out.push(preflightProbe('optimal build order', () => {
      if (state.abOptimalOrderOn === false) return { ok: true, detail: 'desactivado en Config' };
      const ids = (townsFromGame() || []).map(t => t.id);
      const tid = ids.find(id => Object.keys(goalEffectiveBuildTargets(id) || {}).length);
      if (tid == null) return { ok: true, warn: true, detail: 'ninguna ciudad con objetivos de construccion' };
      const opt = abOptimalOrderCached(tid);
      if (opt.error) return { ok: false, detail: `ciudad ${tid}: ${opt.error}` };
      const blocked = (opt.actions || []).filter(a => a.status === 'blocked' || a.status === 'waiting-resources').length;
      const ledgerBlind = (opt.actions || []).some(a => a.why === 'planner-unreadable');
      return {
        ok: true,
        warn: ledgerBlind,
        detail: `${(opt.actions || []).length} entradas \u00b7 ${blocked} bloqueadas` + (ledgerBlind ? ' - contable del planificador no legible' : ''),
      };
    }));
    out.push(preflightProbe('goal profile', () => {
      const known = goalProfiles();
      const goals = state.townGoals || {};
      const ids = Object.keys(goals);
      const bad = ids.filter(id => !known[(goals[id] || {}).profile || 'custom']);
      return {
        ok: bad.length === 0,
        detail: ids.length
          ? `${ids.length} town(s) assigned, ${Object.keys(known).length} profiles known` + (bad.length ? `, UNKNOWN profile on ${bad.join(',')}` : '')
          : `no per-town profile assigned yet, ${Object.keys(known).length} profiles known`,
      };
    }));
    out.push(preflightProbe('queue center', () => {
      const towns = (typeof townsFromGame === 'function' ? townsFromGame() : null) || [];
      return {
        ok: typeof nativeQueueHasPending === 'function',
        detail: `open the Queue Center window: ${towns.length} town(s) resolvable`,
      };
    }));
    out.push(preflightProbe('cost reads', () => {
      const ids = (townsFromGame() || []).map(t => t.id);
      const tid = ids[0];
      const parts = [];
      let blind = 0;
      const cap = tid != null ? townResState(tid) : null;
      if (cap) parts.push('stock+capacity ok');
      else { parts.push('stock UNREADABLE'); blind++; }
      const pop = tid != null ? gbTownPop(tid) : null;
      if (pop != null) parts.push('population ok');
      else { parts.push('population UNREADABLE'); blind++; }
      const gold = gbPlayerGold();
      if (gold != null) parts.push('gold ok');
      else { parts.push('gold UNREADABLE'); blind++; }
      const rc = typeof researchCost === 'function' ? researchCost(RESEARCH_CS_FAST[0]) : null;
      if (rc) parts.push('research costs ok');
      else { parts.push('research costs UNREADABLE'); blind++; }
      const bc = (tid != null && typeof abBuildingCost === 'function') ? abBuildingCost(tid, 'main') : null;
      if (bc) parts.push('building costs ok');
      else { parts.push('building costs unreadable (open a build window once)'); blind++; }
      return { ok: blind < 5, warn: blind > 0, detail: parts.join(', ') };
    }));
    out.push(preflightProbe('attack', () => {

      const ajax = (() => { try { return !!(gameUw().gpAjax && gameUw().gpAjax.ajaxPost); } catch (_) { return false; } })();
      return {
        ok: ajax,
        warn: false,
        detail: (ajax ? 'gpAjax ready, town_info/send_units' : 'gpAjax UNAVAILABLE (open the game tab)')
          + (state.attackTpl ? ' + bridge template override learned' : ''),
      };
    }));
    out.push(preflightProbe('cancel', () => {
      const n = typeof militaryOutgoingMovements === 'function' ? militaryOutgoingMovements().length : 0;
      return { ok: true, warn: !state.cancelTpl, detail: state.cancelTpl ? `template learned; ${n} cancelable` : `template not learned; ${n} cancelable (cancel once manually)` };
    }));
    out.push(preflightProbe('heroes', () => {
      if (!heroesEnabled()) return { ok: true, warn: true, detail: 'heroes disabled on this world' };
      const list = playerHeroesList();
      const acts = state.heroTpl && typeof state.heroTpl === 'object' ? Object.keys(state.heroTpl) : [];
      return { ok: list.length > 0, warn: !list.length || !acts.length, detail: `${list.length} hero(es); learned actions: ${acts.join(',') || 'none'}` };
    }));
    out.push(preflightProbe('incoming', () => {
      const mv = (typeof dodgeIncomingMovements === 'function' ? (dodgeIncomingMovements() || []) : []);
      const trains = (typeof csWaveClusters === 'function' ? (csWaveClusters(mv) || []) : []);
      const unknown = trains.reduce((n, t) => n + (t.unknownArrival || 0), 0);

      let total = 0, dropped = [];
      try {
        const models = movementModels();
        total = models.length;
        const mine = new Set(Object.keys((gameUw().ITowns && gameUw().ITowns.towns) || {}).map(String));
        const kept = new Set(mv.map(x => String(x.id)));
        for (const m of models) {
          const a = m.attributes || {};
          const dest = String(a.destination_town_id || a.target_town_id || '');
          if (!mine.has(dest)) continue;
          if (kept.has(String(a.id || m.id))) continue;
          const t = gbMovementType(a) || '?';
          if (!dropped.includes(t)) dropped.push(t);
        }
      } catch (_) { total = -1; }

      return {
        ok: true,
        warn: unknown > 0 || total === 0,
        detail: `${mv.length} incoming movements visible de ${total < 0 ? '\u2014' : total} MovementsUnits`
          + `, ${trains.length} tren(es), ${unknown} sin hora de llegada legible`
          + (dropped.length ? `; descartados en mis ciudades: ${dropped.join(',')}` : ''),
      };
    }));
    out.push(preflightProbe('quests', () => {
      const col = mmCol('Progressable') || mmCol('IslandQuest');
      const n = col && col.models ? col.models.length : 0;
      return { ok: n >= 0, detail: n ? n + ' quest models' : 'no quest collection (open a quest once)' };
    }));
    out.push(preflightProbe('bandit camp', () => {
      let spot = null;
      try { spot = uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('PlayerAttackSpot'); } catch (_) {}
      return { ok: !!spot, warn: !spot, detail: spot ? 'attack spot model present' : 'no attack spot on this world' };
    }));
    out.push(preflightProbe('scheduler', () => {
      const on = orchStatus().filter(s => s.on);
      const idle = on.filter(s => s.idle >= 4).map(s => s.key);
      return {
        ok: true,
        detail: `${on.length} econ features ON${idle.length ? ', idle-backed-off: ' + idle.join(',') : ''}`,
      };
    }));
    out.push(preflightProbe('client fingerprint',()=>{const r=clientFingerprintCompatible(state.clientFingerprint,clientFingerprintNow());return{ok:r.ok,detail:r.ok?'compatible':r.why}}));
    out.push(preflightProbe('resource planner',()=>{let ids=[];try{ids=Object.keys((uw.ITowns&&uw.ITowns.towns)||{})}catch(_){};const bad=ids.filter(id=>!plannerSnapshot(id));return{ok:bad.length===0,detail:bad.length?`unreadable towns: ${bad.join(',')}`:`${ids.length} town snapshots`}}));
    out.push(preflightProbe('goal planner',()=>{const plans=goalPlanAll();const bad=plans.filter(p=>p.error);return{ok:bad.length===0,warn:bad.length>0,detail:`${plans.length} plans, ${bad.length} unreadable`}}));
    out.push(preflightProbe('safe mode',()=>({ok:true,warn:!!state.safeMode,detail:state.safeMode?'ON: high-impact writes blocked':'off'})));
    out.push(preflightProbe('guards', () => {
      const locks = gbLockList();
      const paused = Object.keys(state.captchaBreakers || {}).filter(k => captchaPaused(k));
      const parts = [];
      if (state.dryRun) parts.push('DRY-RUN ON (nothing will be sent)');
      if (locks.length) parts.push('locks held: ' + locks.join(','));
      if (paused.length) parts.push('captcha: ' + paused.join(','));
      if (gbServerPaused()) parts.push('server cooldown ' + fmtSec(Math.round(gbServerCooldownLeftMs() / 1000)));
      const skips = jrnActiveSkips();
      if (skips.length) parts.push(skips.length + ' memory skip windows');
      const openCircuits = Object.keys(state.circuits || {}).filter(k => state.circuits[k] && state.circuits[k].open);
      const unknownTx = Object.values(state.txState || {}).filter(t => t && /^(unknown|manual-review)$/.test(t.state || '')).length;
      if (openCircuits.length) parts.push('OPEN circuits: ' + openCircuits.join(','));
      if (unknownTx) parts.push(unknownTx + ' UNKNOWN transaction(s) require reconciliation/review');
      return { ok: openCircuits.length === 0 && unknownTx === 0, warn: parts.length > 0, detail: parts.length ? parts.join(' | ') : 'clear' };
    }));
    return out;
  }
