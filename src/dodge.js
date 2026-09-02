  function defenseLocalStrength(townId){const u=dodgeTownUnits(townId);let score=0,count=0;for(const[id,n0]of Object.entries(u)){const n=+n0||0,m=unitMeta(id);if(!m||m.is_naval)continue;const fn=classifyUnitFn(id);if(fn==='defense'||fn==='both'){score+=n*Math.max(1,+m.population||1);count+=n}}return{score,count}}
  function defenseSupportOptions(dest,eta){const out=[];let ids=[];try{ids=Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{})}catch(_){};const target={town_id:+dest,id:+dest,kind:'town',...townCoords(dest)};for(const id of ids){if(String(id)===String(dest))continue;const units={};const live=townLiveUnits(id);for(const[k,n]of Object.entries(live)){const fn=classifyUnitFn(k),m=unitMeta(k);if(m&&!m.is_naval&&(fn==='defense'||fn==='both')&&+n>0)units[k]=+n}if(!Object.keys(units).length)continue;const same=isSameIsland(id,target),boats=boatCapacityCheck(units,same);if(!boats.ok)continue;const travel=computeTravelSeconds(id,target,units,true);if(travel!=null&&(eta==null||travel<eta))out.push({from:id,travel,units})}return out.sort((a,b)=>a.travel-b.travel)}

  const THREAT_CS_BASE = 60;
  const THREAT_ETA15_BASE = 25;
  const THREAT_ETA15_SEC = 15 * 60;
  const THREAT_SIM_PER = 8;
  const THREAT_SIM_CAP = 25;
  const THREAT_WEAK_BASE = 10;
  const THREAT_WEAK_FLOOR = 200;
  const THREAT_SUPPORT_PER = 5;
  const THREAT_SUPPORT_CAP = 20;

  const THREAT_TYPE_RISK = {
    raid: 5,
    attack: 15,
    attack_sea: 15,
    siege: 40,
    revolt: 70,
    colonize: 70,
    take_over: 70,
    conquer: 70,
    portal_attack: 70,
    _default: 25,
  };
  function riskForAttackType(type) {
    const table = (state.defenseCfg && state.defenseCfg.attackRisk) || {};
    const key = String(type || '').toLowerCase();
    const raw = table[key] != null ? table[key] : (THREAT_TYPE_RISK[key] != null ? THREAT_TYPE_RISK[key] : null);
    if (raw != null) {
      const n = +raw;
      return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : THREAT_TYPE_RISK._default;
    }

    const d = +(table._default != null ? table._default : THREAT_TYPE_RISK._default);
    return Number.isFinite(d) ? Math.max(0, Math.min(100, d)) : THREAT_TYPE_RISK._default;
  }

  const THREAT_BAND_HIGH = 45;
  const THREAT_BAND_MED = 20;

  let _threatMemo = { src: undefined, v: null };
  function defenseThreatWeights(over) {
    const stored = (state.predictCfg && state.predictCfg.threatWeights) || null;
    if (!over && _threatMemo.src === stored && _threatMemo.v) return _threatMemo.v;
    const w = (over && typeof over === 'object') ? over : (stored || {});

    const out = {
      cs: gbCfgClamp(w.cs, 0, 120, THREAT_CS_BASE),
      eta15: gbCfgClamp(w.eta15, 0, 60, THREAT_ETA15_BASE),
      simPer: gbCfgClamp(w.simPer, 0, 30, THREAT_SIM_PER),
      simCap: gbCfgClamp(w.simCap, 0, 100, THREAT_SIM_CAP),
      weak: gbCfgClamp(w.weak, 0, 60, THREAT_WEAK_BASE),
      supportPer: gbCfgClamp(w.supportPer, 0, 30, THREAT_SUPPORT_PER),
      supportCap: gbCfgClamp(w.supportCap, 0, 100, THREAT_SUPPORT_CAP),
    };
    if (!over) _threatMemo = { src: stored, v: out };
    return out;
  }
  function defenseThreatBand(risk, hasCs) {
    if (hasCs) return 'cs';
    if (risk >= THREAT_BAND_HIGH) return 'high';
    if (risk >= THREAT_BAND_MED) return 'med';
    return 'low';
  }
  function defenseFactorText(f) {
    return `type=${f.type},cs=${f.cs},eta=${f.eta},sim=${f.simultaneous},weak=${f.weak},support=${f.support}` + (f.snipe ? `,snipe=${f.snipe}` : '');
  }
  function defenseAssessment(mov,incoming,weightsOver){
    const w=defenseThreatWeights(weightsOver);
    const eta=dodgeEtaSec(mov);const all=incoming||dodgeIncomingMovements();
    const simultaneous=all.filter(x=>String(x.dest)===String(mov.dest)).length;
    const local=defenseLocalStrength(mov.dest);const supports=defenseSupportOptions(mov.dest,eta);
    const safe=dodgeSafeTown(mov.dest,all);const evacUnits=dodgeTownUnits(mov.dest);
    const evac=safe?dodgeSupportValidate(mov.dest,safe,evacUnits):{ok:false,why:'no-safe-town'};
    const militia=dodgeCanRaiseMilitia(mov.dest);
    const factors={

      type: riskForAttackType(mov.type),
      cs: mov.hasCs?w.cs:0,

      eta:(eta!=null&&eta<THREAT_ETA15_SEC)?w.eta15:0,
      simultaneous: simultaneous>1?Math.min(w.simCap,(simultaneous-1)*w.simPer):0,
      weak: local.score<THREAT_WEAK_FLOOR?w.weak:0,
      support: supports.length?-Math.min(w.supportCap,supports.length*w.supportPer):0,
    };

    let snipe = null;
    try { snipe = (csWaveClusters(all) || []).find(t => String(t.dest) === String(mov.dest)) || null; } catch (_) {}
    factors.snipe = (snipe && snipe.verdict === 'covered') ? 10 : 0;
    const raw=factors.type+factors.cs+factors.eta+factors.simultaneous+factors.weak+factors.support+factors.snipe;

    const risk=Math.max(0,Math.min(100,raw));
    return{eta,simultaneous,local,supports,safeTown:safe,evac,militia,risk,hasCs:!!mov.hasCs,snipe,
      band:defenseThreatBand(risk,!!mov.hasCs),attackType:String(mov.type||''),factors,weights:w,computedAt:Date.now()};
  }
  function defenseShouldDodge(mov,incoming){const mode=defenseMode(),a=defenseAssessment(mov,incoming);if(mode==='notify')return{yes:false,assessment:a,why:'notify'};if(mode==='safe')return{yes:true,assessment:a,why:'safe'};return{yes:false,assessment:a,why:'defend/observe'}}
  function dodgeReturnSave(){save(STORE.DODGE_RETURNS,state.dodgeReturns||{})}
  function dodgeReturnRecord(mov,from,dest,data){const id=String((data&&(data.command_id||data.commandId||data.movement_id||data.id))||'');if(!id)return;const arrival=+(mov&&mov.arrival)||0,margin=Math.max(0,+((state.defenseCfg&&state.defenseCfg.returnMarginSec)||120));

    let due=0;
    if (Number.isFinite(arrival) && arrival > 0) {
      due = (arrival > 1e12 ? arrival : arrival * 1000) + margin * 1000;
    }
    if (!due) due = Date.now() + margin * 1000;
    state.dodgeReturns[id]={commandId:id,attackId:String(mov.id||''),from:String(from),dest:String(dest),attackArrival:arrival,dueAt:due,state:'waiting',createdAt:Date.now()};dodgeReturnSave()}
  function dodgeReturnTick(){if(!hostEnabled()||automationPaused({}))return;const now=Date.now();for(const[id,r]of Object.entries(state.dodgeReturns||{})){if(!r||r.state==='done'||r.state==='manual')continue;if(+r.dueAt>now)continue;const live=militaryOutgoingMovements().find(x=>String(x.commandId)===String(r.commandId));if(live&&state.cancelTpl){r.state='returning';dodgeReturnSave();militaryCancelCommand(r.commandId,{confirmed:true,automation:true},err=>{if(!err){r.state='done';r.doneAt=Date.now()}else if(err==='not-cancelable'){r.state='manual';r.why='support already arrived; withdraw manually'}else{r.state='waiting';r.lastError=String(err)}dodgeReturnSave()});}else{r.state='manual';r.why=live?'cancel template missing':'movement no longer cancelable/visible';dodgeReturnSave();gbLogT('dodge-return-'+id,60000,`dodge return ${id}: ${r.why}`)}}}
  const DODGE_CHECK_MS = 5000;
  const DODGE_FAIL_BACKOFF = [15000, 45000, 120000];
  const DODGE_QUEUE_TTL = 3600000;

  function wonderFavorScan(reason) {
    if (!hostEnabled() || !state.autoWonderFavor || captchaPaused('wonder')) return;
    if (automationPaused({})) return;
    if (gbLocked('wonder-favor')) return;
    const tpl = state.wonderFavorTpl;
    if (!tpl || !tpl.action_name) {
      gbLogT('wonder-favor-tpl', 300000, 'wonder favor: hand-cast once to teach wonderFavorTpl');
      return;
    }
    const wfCoords = wonderCoords();
    if (!wfCoords) {
      gbLogT('wonder-favor-id', 300000, 'wonder favor: set wonderCfg.islandX / wonderCfg.islandY');
      return;
    }
    const wfLock = gbLock('wonder-favor');
    if (!wfLock) return;

    const wfArgs = Object.assign({}, tpl.arguments || {});
    if ('island_x' in wfArgs || 'island_y' in wfArgs) {
      wfArgs.island_x = wfCoords.x;
      wfArgs.island_y = wfCoords.y;
    } else {
      gbLogT('wonder-favor-tpl-coords', 300000,
        'wonder favor: la plantilla aprendida no lleva island_x/island_y - se envia tal cual (revisa el objetivo)');
    }
    const payload = Object.assign({}, tpl, {
      arguments: wfArgs,
      town_id: tpl.town_id,
    });
    bridgePost('wonder', payload, (err) => {
      gbUnlock('wonder-favor', wfLock);
      if (!err) gbLog('wonder favor: cast OK (' + scanReason(reason) + ')');
      else if (err !== 'captcha' && err !== 'captcha-pause' && err !== 'dryrun') {
        gbLogT('wonder-favor-err', 60000, 'wonder favor err ' + err);
      }
    });
  }
  function dodgeQueueLoad() {
    const raw = load(STORE.DODGE_QUEUE, null) || {};
    const cut = Date.now() - DODGE_QUEUE_TTL;
    const out = Object.create(null);
    Object.keys(raw).forEach(k => {
      const e = raw[k];
      if (!e || !(e.ts >= cut)) return;

      const st = e.state === 'sending' ? 'pending' : e.state;
      out[k] = {
        state: st || 'pending', ts: +e.ts || Date.now(), notified: !!e.notified,
        tries: +e.tries || 0, nextAt: +e.nextAt || 0,
        militiaState: e.militiaState === 'sending' ? 'pending' : (e.militiaState || 'pending'), militiaNextAt:+e.militiaNextAt||0,
        dest: e.dest, type: e.type, hasCs: !!e.hasCs,
      };
    });
    return out;
  }
  function dodgeQueueSave() {
    if(!gbTabLeader)return false;
    try {
      const cut = Date.now() - DODGE_QUEUE_TTL;
      const out = {};
      Object.keys(dodgeQueue).forEach(k => {
        const e = dodgeQueue[k];
        if (!e || e.ts < cut) return;
        out[k] = {
          state: e.state === 'sending' ? 'pending' : e.state,
          ts: e.ts, notified: !!e.notified, tries: e.tries || 0, nextAt: e.nextAt || 0,
          militiaState:e.militiaState==='sending'?'pending':(e.militiaState||'pending'),militiaNextAt:+e.militiaNextAt||0,
          dest: e.dest, type: e.type, hasCs: !!e.hasCs,
        };
      });
      save(STORE.DODGE_QUEUE, out);
    } catch (_) {}
  }
  const dodgeQueue = dodgeQueueLoad();
  const DODGE_HOSTILE_TYPES = /^(attack|attack_land|attack_sea|attack_takeover|raid|siege|revolt|colonize|take_over|conquer|portal_attack|portal_attack_olympus|portal_revolt_olympus)$/;
  const DODGE_HOSTILE_PREFIX = /^(attack|portal_attack|portal_revolt)(_|$)/;
  const DODGE_FRIENDLY_TYPES = /^(support|support_sea|portal_support_olympus|trade|return|spy|farm|reward|abort)$/;
  function dodgeIsHostileMovement(a) {
    const type = gbMovementType(a);
    if (DODGE_FRIENDLY_TYPES.test(type)) return false;
    if (a.is_attack === true || a.is_attack === 1) return true;
    if (DODGE_HOSTILE_TYPES.test(type)) return true;
    if (DODGE_HOSTILE_PREFIX.test(type)) return true;

    const alt = [a.command_type, a.movement_type];
    for (const v of alt) {
      const t = String(v || '').toLowerCase().trim();
      if (DODGE_HOSTILE_TYPES.test(t) || DODGE_HOSTILE_PREFIX.test(t)) return true;
    }
    return false;
  }
  function dodgeOwnTownIds() {
    const out = new Set();
    try { Object.keys((gameUw().ITowns && gameUw().ITowns.towns) || {}).forEach(id => out.add(String(id))); } catch (_) {}
    try { (state.towns || []).forEach(t => { if (t && t.id != null) out.add(String(t.id)); }); } catch (_) {}
    try { Object.keys((state.nativeQueue && state.nativeQueue.towns) || {}).forEach(id => out.add(String(id))); } catch (_) {}
    try {
      const uw = gameUw();
      const id = uw.Game && (uw.Game.townId ?? uw.Game.town_id);
      if (id != null) out.add(String(id));
    } catch (_) {}
    return out;
  }
  function dodgeMovementTownId(m, a, side) {
    const methods = side === 'dest'
      ? ['getTargetTownId', 'getDestinationTownId', 'getTargetId']
      : ['getHomeTownId', 'getOriginTownId', 'getSourceTownId'];
    for (const name of methods) {
      try {
        if (m && typeof m[name] === 'function') {
          const v = m[name]();
          if (v != null && String(v) !== '') return String(v);
        }
      } catch (_) {}
    }
    const attrs = side === 'dest'
      ? ['destination_town_id', 'target_town_id', 'destination_id', 'target_id']
      : ['origin_town_id', 'home_town_id', 'source_town_id', 'origin_id'];
    for (const name of attrs) {
      try {
        const v = a && a[name];
        if (v != null && String(v) !== '') return String(v);
      } catch (_) {}
    }
    return '';
  }
  function dodgeIncomingSnapshot() {
    const uw = gameUw();
    const out = [];
    const myTowns = dodgeOwnTownIds();
    if (!myTowns.size) {
      gbLogT('dodge-notowns-read', 120000, 'dodge: own towns unreadable — incoming scan is blind, not empty');
      return { known:false, moves:out, why:'towns-unreadable', rawCount:0 };
    }
    let models = [];
    let collectionKnown = false;
    try {
      models = movementModels() || [];
      if (models.length) collectionKnown = true;
      if (!collectionKnown && mmCol('MovementsUnits')) collectionKnown = true;
      if (!collectionKnown && uw.MM && typeof uw.MM.getCollections === 'function') {
        const cols = uw.MM.getCollections();
        if (cols && Object.prototype.hasOwnProperty.call(cols, 'MovementsUnits')) collectionKnown = true;
      }
    } catch (_) {}
    if (!collectionKnown) {
      gbLogT('dodge-movements-read', 120000, 'dodge: MovementsUnits unreadable — incoming scan is blind, not empty');
      return { known:false, moves:out, why:'movements-unreadable', rawCount:models.length };
    }
    for (const m of models) {
      try {
        const a = m && (m.attributes || m) || {};
        const dest = dodgeMovementTownId(m, a, 'dest');
        if (!dest || !myTowns.has(dest)) continue;
        const origin = dodgeMovementTownId(m, a, 'origin');
        const type = gbMovementType(a);

        try { if (typeof m.isReturning === 'function' && m.isReturning() === true) continue; } catch (_) {}
        if (DODGE_FRIENDLY_TYPES.test(type)) continue;

        let incoming = false;
        try { if (typeof m.isIncomingMovement === 'function') incoming = m.isIncomingMovement() === true; } catch (_) {}
        if (!incoming && origin && !myTowns.has(origin)) incoming = true;
        if (!incoming && !origin && dest) incoming = true; // destination is ours; unknown origin must fail toward warning, not silence

        let hostile = false;
        try { hostile = typeof m.isIncomingAttack === 'function' && m.isIncomingAttack() === true; } catch (_) {}
        if (!hostile && dodgeIsHostileMovement(a)) hostile = true;
        // Client updates occasionally introduce a new movement type before this
        // userscript knows its literal name. An external incoming movement that is
        // not in the explicit friendly allow-list is safer to treat as hostile than
        // to suppress a Telegram warning completely.
        if (!hostile && incoming && (!origin || !myTowns.has(origin))) hostile = true;
        if (!hostile) continue;

        let units = a.units || {};
        try { if ((!units || typeof units !== 'object') && typeof m.getUnits === 'function') units = m.getUnits() || {}; } catch (_) {}
        let arrival = a.arrived_at || a.arrival_at || a.finished_at || a.arrival_time || null;
        try { if (typeof m.getArrivalAt === 'function') arrival = m.getArrivalAt() || arrival; } catch (_) {}
        const hasCs = !!(units && (units.colonize_ship || units.colony_ship)) || /^(revolt|colonize|take_over|conquer|attack_takeover)$/.test(type);
        out.push({
          id: (typeof m.getCommandId === 'function' ? (() => { try { return m.getCommandId(); } catch (_) { return null; } })() : null) || a.command_id || a.id || m.id,
          dest, origin, type: type || 'attack', hasCs,
          arrival,
          units: units || {},
          model: m,
        });
      } catch (_) {}
    }
    return { known:true, moves:out, why:'', rawCount:models.length };
  }
  function dodgeIncomingMovements() {
    return dodgeIncomingSnapshot().moves;
  }
  function dodgeSafeTown(excludeId, incoming) {
    try {
      const uw = gameUw();
      const threatened = new Set();
      (incoming || dodgeIncomingMovements() || []).forEach(m => threatened.add(String(m.dest)));
      const ids = Object.keys((uw.ITowns && uw.ITowns.towns) || {})
        .filter(id => String(id) !== String(excludeId));
      const clean = ids.filter(id => !threatened.has(String(id)));
      if (clean.length) {
        const src = townCoords(excludeId);
        clean.sort((a,b)=>{const A=townCoords(a),B=townCoords(b);const as=(src.island!=null&&A.island!=null&&String(src.island)===String(A.island))?0:1;const bs=(src.island!=null&&B.island!=null&&String(src.island)===String(B.island))?0:1;if(as!==bs)return as-bs;const da=islandDistance(src.x,src.y,A.x,A.y),db=islandDistance(src.x,src.y,B.x,B.y);return (da==null?1e9:da)-(db==null?1e9:db)});
        return clean[0];
      }
      if (ids.length) {
        gbLogT('dodge-nosafe', 120000, 'dodge: every other town has incoming \u2014 no safe destination, evacuation blocked');
        return null;
      }
    } catch (_) {}
    return null;
  }
  function dodgeCanRaiseMilitia(townId) {
    const farm = gbBuildingLevel(townId, 'farm');
    if (farm != null && farm < 1) return { ok: false, why: 'no farm building' };
    try {
      const uw = gameUw();
      const t = uw.ITowns && uw.ITowns.towns && uw.ITowns.towns[townId];
      const u = (t && t.units && t.units()) || null;
      if (u && +u.militia > 0) return { ok: false, why: 'militia already standing' };

      const avail = t && t.getAvailablePopulation && +t.getAvailablePopulation();
      if (avail != null && Number.isFinite(avail) && avail <= 0) return { ok: false, why: 'no free population' };
    } catch (_) {}
    return { ok: true, why: null };
  }
  function dodgeRaiseMilitia(townId, onDone) {
    const can = dodgeCanRaiseMilitia(townId);
    if (!can.ok) {
      gbLogT('militia-skip-' + townId, 120000, `militia: town ${townId} skipped (${can.why})`);
      return onDone && onDone('skip:' + can.why);
    }
    gameAjaxPost('militia', 'building_farm', 'request_militia', { town_id: +townId }, onDone);
  }
  function dodgeSendOut(townId, units, safeId, onDone) {
    const payload = {
      model_url: 'Town/' + townId,
      action_name: (state.attackTpl && state.attackTpl.action_name) || 'sendUnits',
      arguments: Object.assign({ id: +safeId, type: 'support' }, units),
      town_id: +townId,
    };
    bridgePost('dodge', payload, onDone);
  }
  function dodgeTownUnits(townId) {
    try {
      const uw = gameUw();
      const t = uw.ITowns.towns[townId];
      const u = Object.assign({}, t.units && t.units());
      delete u.militia;
      const floor = +state.dodgeFloor || 0;

      if (floor > 0) {
        ['sword', 'hoplite', 'archer'].forEach(k => {
          if (u[k] > floor) u[k] -= floor;
          else delete u[k];
        });
      }
      Object.keys(u).forEach(k => { if (!(+u[k] > 0)) delete u[k]; });
      return u;
    } catch (_) { return {}; }
  }
  function dodgeSupportValidate(fromTownId, safeTownId, units) {
    if (!safeTownId || !units || !Object.keys(units).length) return { ok: false, why: 'no-destination-or-units' };
    const live = dodgeTownUnits(fromTownId);
    for (const [u, n] of Object.entries(units)) if ((+live[u] || 0) < (+n || 0)) return { ok: false, why: `units-changed:${u}` };
    const same = isSameIsland(fromTownId, { town_id: +safeTownId, id: +safeTownId, kind: 'town', ...townCoords(safeTownId) });
    const boats = boatCapacityCheck(units, same);
    if (!boats.ok) return { ok: false, why: boats.reason || 'transport-capacity' };
    const destGod = recruitTownGod(safeTownId);
    for (const u of Object.keys(units)) {
      const d = unitMeta(u);
      if (!d) return { ok: false, why: `unit-meta:${u}` };
      if (d.god) {
        const need = String(d.god).toLowerCase();
        if (!destGod || destGod !== need) return { ok: false, why: `god-mismatch:${u}` };
      }
    }
    return { ok: true, boats };
  }

  function dodgeArrivalSec(mov) {
    let a = +(mov && mov.arrival);
    if (!Number.isFinite(a) || a <= 0) return null;
    return a > 1e12 ? Math.floor(a / 1000) : a;
  }
  function dodgeEtaSec(mov) {
    const a = dodgeArrivalSec(mov);
    return a == null ? null : Math.max(0, a - gameNow());
  }

  const CS_CLUSTER_GAP_DEFAULT = 900;
  const CS_COVER_DEFAULT = 180;
  const CS_TIGHT_DEFAULT = 5;
  function csCfg() {
    const c = (state.defenseCfg && typeof state.defenseCfg === 'object') ? state.defenseCfg : {};
    return {
      on: c.snipeDetect !== false,
      clusterGapSec: gbCfgClamp(c.csClusterGapSec, 60, 21600, CS_CLUSTER_GAP_DEFAULT),
      coverSec: gbCfgClamp(c.csCoverSec, 5, 900, CS_COVER_DEFAULT),
      tightSec: gbCfgClamp(c.csTightSec, 0, 120, CS_TIGHT_DEFAULT),
    };
  }
  function csWaveClusters(incoming) {
    const cfg = csCfg();
    const byTown = new Map();
    for (const mov of (incoming || [])) {
      if (!mov || mov.dest == null) continue;
      const k = String(mov.dest);
      if (!byTown.has(k)) byTown.set(k, []);
      byTown.get(k).push(mov);
    }
    const out = [];
    for (const [dest, list] of byTown) {
      const timed = [];
      let unknownArrival = 0;
      for (const m of list) {
        const at = dodgeArrivalSec(m);

        if (at == null) { unknownArrival++; continue; }
        timed.push({ at, hasCs: !!m.hasCs, id: m.id });
      }
      timed.sort((a, b) => a.at - b.at);
      if (!timed.length) {
        out.push({ dest, n: list.length, unknownArrival, firstAt: null, lastAt: null, csAt: null, gapSec: null, cover: 0, tightestGapSec: null, verdict: 'unknown' });
        continue;
      }

      const cluster = [timed[0]];
      for (let i = 1; i < timed.length; i++) {
        if (timed[i].at - cluster[cluster.length - 1].at > cfg.clusterGapSec) break;
        cluster.push(timed[i]);
      }
      let tightestGapSec = null;
      for (let i = 1; i < cluster.length; i++) {
        const g = cluster[i].at - cluster[i - 1].at;
        if (tightestGapSec == null || g < tightestGapSec) tightestGapSec = g;
      }
      const csIdx = cluster.findIndex(x => x.hasCs);
      const firstAt = cluster[0].at, lastAt = cluster[cluster.length - 1].at;
      if (csIdx < 0) {
        out.push({ dest, n: cluster.length, unknownArrival, firstAt, lastAt, csAt: null, gapSec: null, cover: 0, tightestGapSec, verdict: 'no-cs' });
        continue;
      }
      const csAt = cluster[csIdx].at;
      if (csIdx === 0) {

        out.push({ dest, n: cluster.length, unknownArrival, firstAt, lastAt, csAt, gapSec: null, cover: 0, tightestGapSec, verdict: 'cs-solo' });
        continue;
      }
      const gapSec = csAt - cluster[csIdx - 1].at;

      let cover = 0;
      for (const x of cluster) if (x.at < csAt && csAt - x.at <= cfg.coverSec) cover++;
      let verdict;
      if (gapSec <= cfg.tightSec) verdict = 'tight';
      else if (cover >= 1) verdict = 'covered';
      else verdict = 'open';
      out.push({ dest, n: cluster.length, unknownArrival, firstAt, lastAt, csAt, gapSec, cover, tightestGapSec, verdict });
    }
    return out;
  }
  const CS_VERDICT_ES = { open: 'ventana abierta', covered: 'cubierta', tight: 'muy justa', 'cs-solo': 'CS sola', 'no-cs': 'sin CS', unknown: 'ilegible' };
  function csTrainLine(train) {
    if (!train) return '';
    const parts = [`tren ${train.n}`, CS_VERDICT_ES[train.verdict] || train.verdict];
    if (train.gapSec != null) parts.push(`ventana ${train.gapSec}s`);
    else if (train.tightestGapSec != null) parts.push(`hueco min ${train.tightestGapSec}s`);
    if (train.cover) parts.push(`cubierta ${train.cover}`);
    if (train.unknownArrival) parts.push(`${train.unknownArrival} sin hora`);
    return parts.join(' \u00b7 ');
  }
  const DODGE_MILITIA_WINDOW_SEC = 15 * 60;
  function dodgeNotify(mov, entry, train) {
    if (entry.notified) return;
    entry.notified = true;
    const trainTxt = (train && train.verdict !== 'no-cs') ? ' | ' + csTrainLine(train) : '';
    const msg = `incoming ${mov.type || 'atk'} \u2192 town ${mov.dest}` + (mov.hasCs ? ' [CS]' : '') +
      (mov.arrival ? ` ETA ${mov.arrival}` : '') + trainTxt;
    gbLog('dodge: ' + msg);
    flash(msg);
    try {
      const payload = Object.assign({}, mov, { cs: !!mov.hasCs });
      if (train && train.verdict !== 'no-cs') payload.snipe = { verdict: train.verdict, gapSec: train.gapSec, cover: train.cover, n: train.n };
      if (!mov.hasCs || state.csAlert !== false) alertWebhook('attack', payload);
    } catch (_) {}

  }
  function dodgeTryMilitia(mov,entry) {
    if(!state.autoMilitia||captchaPausedAny('militia','dodge')||entry.militiaState==='raised'||entry.militiaState==='sending')return;
    const eta=dodgeEtaSec(mov),now=Date.now();if(eta==null||eta>DODGE_MILITIA_WINDOW_SEC||eta<=0){gbLogT('militia-eta-'+mov.dest,60000,`militia: waiting; hostile ETA ${eta==null?'unknown':fmtSec(eta)}`);return}
    if(entry.militiaNextAt&&entry.militiaNextAt>now)return;
    const can=dodgeCanRaiseMilitia(mov.dest);
    if(!can.ok){if(/already standing/.test(can.why||'')){entry.militiaState='raised';dodgeQueueSave()}else{entry.militiaState='pending';entry.militiaNextAt=now+30000}return}
    const token=gbLock('militia',30000);if(!token){entry.militiaNextAt=now+2000;return}entry.militiaState='sending';dodgeQueueSave();
    dodgeRaiseMilitia(mov.dest,err=>{gbUnlock('militia',token);if(!err){entry.militiaState='raised';entry.militiaNextAt=0;gbLog(`militia: raised in ${mov.dest} (ETA ${fmtSec(eta)})`)}else if(err==='timeout_unknown'||err==='pending'){entry.militiaState='unknown';entry.militiaNextAt=Date.now() + 5 * 60 * 1000;gbLog(`militia: outcome unknown (${err}); retry bounded to 5min \u2014 militia consumes population and re-firing without resolution is unsafe`)}else{entry.militiaState='pending';entry.militiaNextAt=Date.now()+30000;gbLogT('militia-retry-'+mov.dest,30000,`militia: retry scheduled (${err})`)}dodgeQueueSave()});
  }

  const DEFENSE_HISTORY_MAX = 200;
  const DEFENSE_HISTORY_TTL_MS = 3600000;
  function defenseHistoryNote(mov, decision) {
    if (!Array.isArray(state.defenseHistory)) state.defenseHistory = [];
    const a = decision && decision.assessment;
    const row = {
      ts: Date.now(),
      movId: String(mov.id),
      attackType: (a && a.attackType) || String(mov.type || ''),
      risk: a ? a.risk : null,
      band: a ? a.band : null,
      decision: decision && decision.yes ? 'dodge' : 'hold',
      why: (decision && decision.why) || '',
    };
    const last = state.defenseHistory[state.defenseHistory.length - 1];

    if (last && last.movId === row.movId && last.decision === row.decision && last.band === row.band) return;
    state.defenseHistory.push(row);
    const cut = Date.now() - DEFENSE_HISTORY_TTL_MS;
    while (state.defenseHistory.length && (state.defenseHistory.length > DEFENSE_HISTORY_MAX || state.defenseHistory[0].ts < cut)) {
      state.defenseHistory.shift();
    }
    save(STORE.DEFENSE_HISTORY, state.defenseHistory);
  }
  function dodgeTrySend(entry, mov) {
    if (entry.state === 'sent' || entry.state === 'sending') return;
    if (!state.autoDodge) { entry.state='notified'; return; }
    const incomingNow = dodgeIncomingMovements();
    const decision = defenseShouldDodge(mov, incomingNow);
    try { defenseHistoryNote(mov, decision); } catch (_) {}
    if (!decision.yes) { entry.state='notified'; whyNote('defense',mov.dest,'no-dodge',`${decision.why}; risk=${decision.assessment.risk}`); gbLogT('defense-decide-'+mov.id,60000,`defense: ${mov.dest} no dodge (${decision.why}, risk=${decision.assessment.risk})`); return; }
    if (captchaPaused('dodge')) return;
    if (gbLocked('dodge')) {
      entry.state = 'pending';
      entry.nextAt = Date.now() + 2000;
      return;
    }

    const safe = dodgeSafeTown(mov.dest, incomingNow);
    const units = dodgeTownUnits(mov.dest);
    const valid = dodgeSupportValidate(mov.dest, safe, units);
    if (!valid.ok) {
      entry.state = 'pending';
      entry.tries = (entry.tries || 0) + 1;
      const bo = backoffFor(entry.tries, DODGE_FAIL_BACKOFF);
      entry.nextAt = Date.now() + bo;
      gbLogT('dodge-nousable', 30000, `dodge: cannot evacuate ${mov.dest} (${valid.why}); retry later`);
      return;
    }
    entry.state = 'sending';
    const lockToken = gbLock('dodge');
    if (!lockToken) { entry.state = 'pending'; entry.nextAt = Date.now() + 2000; return; }
    dodgeSendOut(mov.dest, units, safe, (err, data) => {
      gbUnlock('dodge', lockToken);
      if (!err) {
        entry.state = 'sent';
        entry.ts = Date.now();
        gbLog(`dodge: sent units from ${mov.dest} \u2192 ${safe}`);
        try { dodgeReturnRecord(mov, mov.dest, safe, data); } catch (_) {}
      } else {
        entry.tries = (entry.tries || 0) + 1;
        if (err === 'timeout_unknown' || err === 'pending') {
          entry.state = 'unknown';
          entry.nextAt = Date.now() + TX_UNKNOWN_RECHECK_MS;
          gbLog(`dodge: outcome unknown (${err}); bounded recheck in ${Math.round(TX_UNKNOWN_RECHECK_MS/1000)}s \u2014 units may have already left`);
        } else {
          entry.state = 'failed';
          const bo = backoffFor(entry.tries, DODGE_FAIL_BACKOFF);
          entry.nextAt = Date.now() + bo;
          gbLog(`dodge: send failed ${err} (retry in ${Math.round(bo / 1000)}s)`);
        }
      }
      dodgeQueueSave();
    });
  }
  function dodgeScan(reason) {
    if (!hostEnabled()) return;
    // Telegram attack alerts are read-only and stay active during CAPTCHA/server
    // write pauses. Reuse this 5s defensive loop for faster mobile warning.
    let telegramIncoming = null;
    if (state.telegramEnabled && telegramEventEnabled('attack')) {
      try { telegramIncoming = dodgeIncomingMovements() || []; telegramAttackMonitor(telegramIncoming); } catch (_) { telegramIncoming = null; }
    }
    if (automationPaused({})) return;
    const wantDodge = state.autoDodge;
    const wantCs = state.csAlert !== false;
    const wantMilitia = state.autoMilitia;
    if (!wantDodge && !wantCs && !wantMilitia) return;

    const dodgeOk = wantDodge && !captchaPaused('dodge');
    const militiaOk = wantMilitia && !captchaPausedAny('militia', 'dodge');
    if (!dodgeOk && !militiaOk && !wantCs) return;
    const incoming = telegramIncoming || dodgeIncomingMovements();

    const trains = (wantCs && csCfg().on) ? csWaveClusters(incoming) : [];
    const trainFor = dest => trains.find(t => String(t.dest) === String(dest)) || null;
    const live = new Set();
    const now = Date.now();
    for (const mov of incoming) {
      const key = String(mov.id);
      live.add(key);
      let entry = dodgeQueue[key];
      if (!entry) {
        entry = dodgeQueue[key] = {
          state: 'pending', ts: now, notified: false, tries: 0, nextAt: 0,
          militiaState:'pending',militiaNextAt:0,
          dest: mov.dest, type: mov.type, hasCs: mov.hasCs,
        };
      }
      entry.hasCs=!!(entry.hasCs||mov.hasCs);entry.type=mov.type||entry.type;entry.dest=mov.dest||entry.dest;
      if (wantCs || militiaOk || dodgeOk) dodgeNotify(mov, entry, trainFor(mov.dest));
      if(militiaOk)dodgeTryMilitia(mov,entry);
      if (!dodgeOk) continue;
      if (entry.state === 'sent') continue;
      if (entry.state === 'sending') continue;
      if (entry.nextAt && entry.nextAt > now) continue;
      if (entry.state === 'failed' || entry.state === 'pending' || entry.state === 'notified' || entry.state === 'unknown') {
        dodgeTrySend(entry, mov);
      }

      if (!entry || entry.state !== 'sent') {
        try { supportTryBurst(mov); }
        catch (e) {
          const msg=String(e&&e.stack||e).slice(0,180);
          gbLogT('dodge-support-burst',60000,'dodge support burst error: '+msg);
          try{markModuleHealth('support','err',{error:msg})}catch(_){}
          try{whyNote('support',mov.dest,'error',msg)}catch(_){}
        }
      }
    }

    for (const t of trains) {
      if (t.verdict === 'no-cs') continue;
      gbLogT(`cs-${t.dest}-${t.verdict}-${t.cover}`, 60000,
        `cs: town ${t.dest} ${t.verdict} n=${t.n} gap=${t.gapSec == null ? '?' : t.gapSec}s cover=${t.cover}` +
        (t.unknownArrival ? ` unreadable=${t.unknownArrival}` : ''));
    }
    try { supportScan('dodge'); }
    catch (e) {
      const msg=String(e&&e.stack||e).slice(0,180);
      gbLogT('dodge-support-scan',60000,'support scan error: '+msg);
      try{markModuleHealth('support','err',{error:msg})}catch(_){}
      try{whyNote('support','dodge','error',msg)}catch(_){}
    }
    try { emergencyScan('dodge'); }
    catch (e) {
      const msg=String(e&&e.stack||e).slice(0,180);
      gbLogT('dodge-emergency-scan',60000,'emergency cave scan error: '+msg);
      try{markModuleHealth('cave','err',{error:msg})}catch(_){}
      try{whyNote('cave','emergency','error',msg)}catch(_){}
    }

    const cut = now - DODGE_QUEUE_TTL;
    Object.keys(dodgeQueue).forEach(k => {
      const e = dodgeQueue[k];
      if (!live.has(k) && e.ts < cut) delete dodgeQueue[k];
      else if (e.state === 'sent' && e.ts < cut) delete dodgeQueue[k];
    });
    dodgeQueueSave();
  }

  const RECRUIT_SPELLS = ['call_of_the_ocean', 'spartan_training', 'fertility_improvement'];
  const RECRUIT_SPELL_GODS = {
    call_of_the_ocean: 'poseidon',
    spartan_training: 'ares',
    fertility_improvement: 'hera',
  };
  const RECRUIT_SPELL_COSTS = {
    call_of_the_ocean: 60,
    fertility_improvement: 80,
    spartan_training: 80,
  };
