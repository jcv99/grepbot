  function wonderServerDay() {
    try {
      const now = gameNow();
      const d = new Date(now * 1000);
      return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
    } catch (_) {
      return new Date().toISOString().slice(0, 10);
    }
  }
  function wonderLoadSpent() {
    const day = wonderServerDay();
    const saved = load(STORE.WONDER_SPENT, null);
    if (saved && saved.day === day) return { day, amount: +saved.amount || 0 };
    return { day, amount: 0 };
  }
  function wonderSaveSpent(spent) {
    save(STORE.WONDER_SPENT, { day: spent.day, amount: spent.amount });
  }
  let wonderSpentToday = wonderLoadSpent();

  function wonderScan(reason) {
    if (!hostEnabled() || !state.autoWonder || captchaPaused('wonder')) return;
    if (automationPaused({})) return;
    if (gbLocked('wonder')) return;
    const cfg = state.wonderCfg || {};
    const wonderId = cfg.wonderId;
    if (!wonderId) {
      gbLogT('wonder-noid', 300000, 'wonder: set wonderCfg.wonderId');
      return;
    }
    const day = wonderServerDay();
    if (wonderSpentToday.day !== day) wonderSpentToday = { day, amount: 0 };
    const budgetN = Number(cfg.budget);
    const budget = Number.isFinite(budgetN) ? Math.max(0, budgetN) : 50000;
    if (budget <= 0) { gbLogT('wonder-off-budget', 300000, 'wonder: budget is 0 — no donations'); return; }
    if (wonderSpentToday.amount >= budget) {
      gbLogT('wonder-budget', 300000, `wonder: daily budget ${budget} reached`);
      return;
    }
    const reserveN = Number(cfg.reserve);
    const reserve = Number.isFinite(reserveN) ? Math.max(0, reserveN) : 5000;
    const want = {
      wood: +cfg.wood || 0,
      stone: +cfg.stone || 0,
      iron: +cfg.iron || 0,
    };
    if (!(want.wood || want.stone || want.iron)) {
      gbLogT('wonder-noamount', 300000, 'wonder: donation amounts are all 0 — no implicit donation');
      return;
    }
    const towns = (typeof tradeListTowns === 'function') ? tradeListTowns() : [];
    let job = null;
    for (const t of towns) {

      const cap = +t.tradeCap || 0;
      if (cap <= 0) continue;
      let send = {
        wood: Math.max(0, Math.min(want.wood, t.wood - reserve)),
        stone: Math.max(0, Math.min(want.stone, t.stone - reserve)),
        iron: Math.max(0, Math.min(want.iron, t.iron - reserve)),
      };
      let total = send.wood + send.stone + send.iron;
      if (total < 500) continue;
      if (total > cap) {
        const scale = cap / total;
        send = {
          wood: Math.floor(send.wood * scale),
          stone: Math.floor(send.stone * scale),
          iron: Math.floor(send.iron * scale),
        };
        total = send.wood + send.stone + send.iron;
      }
      if (total < 500) continue;
      if (wonderSpentToday.amount + total > budget) {
        const scale = (budget - wonderSpentToday.amount) / total;
        if (scale <= 0) continue;
        send.wood = Math.floor(send.wood * scale);
        send.stone = Math.floor(send.stone * scale);
        send.iron = Math.floor(send.iron * scale);
        total = send.wood + send.stone + send.iron;
        if (total < 500) continue;
      }
      job = { townId: t.id, send };
      break;
    }
    if (!job) {
      gbLogT('wonder-idle', 180000, `wonder: no surplus (${reason || 'scan'})`);
      return;
    }
    const fresh = tradeTownRes(job.townId);
    const tot = job.send.wood + job.send.stone + job.send.iron;
    const pav = plannerAvailable(job.townId, {allowSoft:false});
    if (!fresh || !pav || fresh.tradeCap < tot || pav.tradeCap == null || pav.tradeCap < tot || pav.wood < job.send.wood || pav.stone < job.send.stone || pav.iron < job.send.iron || fresh.wood - job.send.wood < reserve || fresh.stone - job.send.stone < reserve || fresh.iron - job.send.iron < reserve || wonderSpentToday.amount + tot > budget) {
      gbLogT('wonder-stale-' + job.townId, 60000, 'wonder: final stock/capacity/budget precheck failed');
      return;
    }
    const lockToken = gbLock('wonder');
    if (!lockToken) return;
    gameAjaxPost('wonder', 'wonders', 'send_resources', {
      id: +wonderId,
      wood: job.send.wood,
      stone: job.send.stone,
      iron: job.send.iron,
      town_id: +job.townId,
    }, (err) => {
      if (err === 'timeout' || err === 'timeout_unknown' || err === 'pending') {
        gbLogT('wonder-timeout', 60000, `wonder: timeout_unknown town ${job.townId} — no fallback/duplicate`);
        gbUnlock('wonder', lockToken);
        return;
      }
      if (!err) {
        wonderSpentToday.amount += tot;
        wonderSaveSpent(wonderSpentToday);
        gbLog(`wonder: town ${job.townId} sent ${tot} to WW ${wonderId}`);
        gbUnlock('wonder', lockToken);
        return;
      }

      if (!/unknown|not.?found|does.?not.?exist|invalid.?controller|invalid.?action/i.test(String(err))) {
        gbLogT('wonder-err', 60000, `wonder err ${err}`);
        gbUnlock('wonder', lockToken);
        return;
      }
      gameAjaxPost('wonder', 'factions', 'send_resources', {
        wonder_id: +wonderId,
        wood: job.send.wood, stone: job.send.stone, iron: job.send.iron,
        town_id: +job.townId,
      }, (e2) => {
        gbUnlock('wonder', lockToken);
        if (!e2) {
          wonderSpentToday.amount += tot;
          wonderSaveSpent(wonderSpentToday);
          gbLog(`wonder: sent via factions from ${job.townId}`);
        } else gbLogT('wonder-err', 60000, `wonder err ${err}/${e2}`);
      });
    });
  }


  // ===== Defense Manager (v1.9) ==============================================
  function defenseMode(){const m=String((state.defenseCfg&&state.defenseCfg.mode)||'notify');return ['notify','safe','smart'].includes(m)?m:'notify'}
  function defenseLocalStrength(townId){const u=dodgeTownUnits(townId);let score=0,count=0;for(const[id,n0]of Object.entries(u)){const n=+n0||0,m=unitMeta(id);if(!m||m.is_naval)continue;const fn=classifyUnitFn(id);if(fn==='defense'||fn==='both'){score+=n*Math.max(1,+m.population||1);count+=n}}return{score,count}}
  function defenseSupportOptions(dest,eta){const out=[];let ids=[];try{ids=Object.keys((gameUw().ITowns&&gameUw().ITowns.towns)||{})}catch(_){};const target={town_id:+dest,id:+dest,kind:'town',...townCoords(dest)};for(const id of ids){if(String(id)===String(dest))continue;const units={};const live=townLiveUnits(id);for(const[k,n]of Object.entries(live)){const fn=classifyUnitFn(k),m=unitMeta(k);if(m&&!m.is_naval&&(fn==='defense'||fn==='both')&&+n>0)units[k]=+n}if(!Object.keys(units).length)continue;const same=isSameIsland(id,target),boats=boatCapacityCheck(units,same);if(!boats.ok)continue;const travel=computeTravelSeconds(id,target,units,true);if(travel!=null&&(eta==null||travel<eta))out.push({from:id,travel,units})}return out.sort((a,b)=>a.travel-b.travel)}
  // ===== Threat assessment engine (v4 plan 5.3) ==============================
  // defenseAssessment's output is a CONTRACT that plan 5.4 (smart dodge) reads.
  // The nine original fields keep their names and meanings; everything below is
  // additive:
  //   band      'low' | 'med' | 'high' | 'cs'  - discrete bucket for UI and 5.4
  //   factors   per-signal contribution, so a consumer can explain the verdict
  //             instead of quoting one rolled-up number
  //   risk      clamped sum of factors, 0..100
  //   weights   the weight set actually used, for provenance
  //   computedAt
  // The base constants below stay fixed; state.predictCfg.threatWeights only
  // overrides them, and its defaults reproduce the previous magic numbers
  // exactly - nobody who never opens Config sees a behaviour change.
  const THREAT_CS_BASE = 60;
  const THREAT_ETA15_BASE = 25;
  const THREAT_ETA15_SEC = 15 * 60;
  const THREAT_SIM_PER = 8;
  const THREAT_SIM_CAP = 25;
  const THREAT_WEAK_BASE = 10;
  const THREAT_WEAK_FLOOR = 200;
  const THREAT_SUPPORT_PER = 5;
  const THREAT_SUPPORT_CAP = 20;
  const THREAT_SMART_THRESHOLD = 35;
  // Band cut-points live here, not in state: changing them is a one-line edit
  // and they are part of the contract, not a user preference. `band` is a UI
  // bucket and `smartThreshold` is the action gate; they are deliberately
  // independent, so a 'med' band can still dodge. Preflight surfaces the
  // relationship rather than forcing them to agree.
  const THREAT_BAND_HIGH = 45;
  const THREAT_BAND_MED = 20;
  // Memoised on the stored object's identity: defenseAssessment runs per
  // incoming movement per render, and the Config writer replaces the object
  // wholesale, so an identity check is enough to catch every real edit.
  let _threatMemo = { src: undefined, v: null };
  function defenseThreatWeights(over) {
    const stored = (state.predictCfg && state.predictCfg.threatWeights) || null;
    if (!over && _threatMemo.src === stored && _threatMemo.v) return _threatMemo.v;
    const w = (over && typeof over === 'object') ? over : (stored || {});
    const num = (v, d, lo, hi) => {
      const n = +v;
      if (!Number.isFinite(n)) return d;
      return Math.max(lo, Math.min(hi, n));
    };
    // supportPer is stored as a MAGNITUDE and negated in the formula. The
    // clamp to [0, 30] is what makes that safe: a hand-edited -5 becomes 0, so
    // supports can never be turned into a risk INCREASE by a sign mistake.
    const out = {
      cs: num(w.cs, THREAT_CS_BASE, 0, 120),
      eta15: num(w.eta15, THREAT_ETA15_BASE, 0, 60),
      simPer: num(w.simPer, THREAT_SIM_PER, 0, 30),
      simCap: num(w.simCap, THREAT_SIM_CAP, 0, 100),
      weak: num(w.weak, THREAT_WEAK_BASE, 0, 60),
      supportPer: num(w.supportPer, THREAT_SUPPORT_PER, 0, 30),
      supportCap: num(w.supportCap, THREAT_SUPPORT_CAP, 0, 100),
      smartThreshold: num(w.smartThreshold, THREAT_SMART_THRESHOLD, 0, 100),
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
    return `cs=${f.cs},eta=${f.eta},sim=${f.simultaneous},weak=${f.weak},support=${f.support}`;
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
      cs: mov.hasCs?w.cs:0,
      // eta === null is UNREADABLE, not "far away": the branch is skipped
      // rather than scored either way.
      eta:(eta!=null&&eta<THREAT_ETA15_SEC)?w.eta15:0,
      simultaneous: simultaneous>1?Math.min(w.simCap,(simultaneous-1)*w.simPer):0,
      weak: local.score<THREAT_WEAK_FLOOR?w.weak:0,
      support: supports.length?-Math.min(w.supportCap,supports.length*w.supportPer):0,
    };
    const raw=factors.cs+factors.eta+factors.simultaneous+factors.weak+factors.support;
    // Clamped so a hand-edited negative weight cannot produce a band the
    // consumer has no branch for.
    const risk=Math.max(0,Math.min(100,raw));
    return{eta,simultaneous,local,supports,safeTown:safe,evac,militia,risk,hasCs:!!mov.hasCs,
      band:defenseThreatBand(risk,!!mov.hasCs),factors,weights:w,computedAt:Date.now()};
  }
  function defenseShouldDodge(mov,incoming){const mode=defenseMode(),a=defenseAssessment(mov,incoming);if(mode==='notify')return{yes:false,assessment:a,why:'notify'};if(mode==='safe')return{yes:true,assessment:a,why:'safe'};if(!state.defenseCfg.smartAuto)return{yes:false,assessment:a,why:'smart-auto-off'};if(!a.evac.ok)return{yes:false,assessment:a,why:'cannot-evacuate'};if(a.hasCs||a.risk>=a.weights.smartThreshold)return{yes:true,assessment:a,why:`risk band=${a.band} ${defenseFactorText(a.factors)}`};return{yes:false,assessment:a,why:'defend/observe'}}
  function dodgeReturnSave(){save(STORE.DODGE_RETURNS,state.dodgeReturns||{})}
  function dodgeReturnRecord(mov,from,dest,data){const id=String((data&&(data.command_id||data.commandId||data.movement_id||data.id))||'');if(!id)return;const arrival=+(mov&&mov.arrival)||0,margin=Math.max(0,+((state.defenseCfg&&state.defenseCfg.returnMarginSec)||120));const due=(arrival>1e12?arrival:arrival*1000)+margin*1000;state.dodgeReturns[id]={commandId:id,attackId:String(mov.id||''),from:String(from),dest:String(dest),attackArrival:arrival,dueAt:due||Date.now()+margin*1000,state:'waiting',createdAt:Date.now()};dodgeReturnSave()}
  function dodgeReturnTick(){if(!hostEnabled()||automationPaused({}))return;const now=Date.now();for(const[id,r]of Object.entries(state.dodgeReturns||{})){if(!r||r.state==='done'||r.state==='manual')continue;if(+r.dueAt>now)continue;const live=militaryOutgoingMovements().find(x=>String(x.commandId)===String(r.commandId));if(live&&state.cancelTpl){r.state='returning';dodgeReturnSave();militaryCancelCommand(r.commandId,{confirmed:true,automation:true},err=>{if(!err){r.state='done';r.doneAt=Date.now()}else if(err==='not-cancelable'){r.state='manual';r.why='support already arrived; withdraw manually'}else{r.state='waiting';r.lastError=String(err)}dodgeReturnSave()});}else{r.state='manual';r.why=live?'cancel template missing':'movement no longer cancelable/visible';dodgeReturnSave();gbLogT('dodge-return-'+id,60000,`dodge return ${id}: ${r.why}`)}}}

  const DODGE_CHECK_MS = 5000;
  const DODGE_FAIL_BACKOFF = [15000, 45000, 120000];
  const DODGE_QUEUE_TTL = 3600000;
  // Wonder favor cast - default OFF; requires the sniffed wonderFavorTpl.
  function wonderFavorScan(reason) {
    if (!hostEnabled() || !state.autoWonderFavor || captchaPaused('wonder')) return;
    if (automationPaused({})) return;
    if (gbLocked('wonder-favor')) return;
    const tpl = state.wonderFavorTpl;
    if (!tpl || !tpl.action_name) {
      gbLogT('wonder-favor-tpl', 300000, 'wonder favor: hand-cast once to teach wonderFavorTpl');
      return;
    }
    const cfg = state.wonderCfg || {};
    if (!cfg.wonderId) {
      gbLogT('wonder-favor-id', 300000, 'wonder favor: set wonderCfg.wonderId');
      return;
    }
    const wfLock = gbLock('wonder-favor');
    if (!wfLock) return;
    const payload = Object.assign({}, tpl, {
      arguments: Object.assign({}, tpl.arguments || {}, {
        wonder_id: +cfg.wonderId,
      }),
      town_id: tpl.town_id,
    });
    bridgePost('wonder', payload, (err) => {
      gbUnlock('wonder-favor', wfLock);
      if (!err) gbLog('wonder favor: cast OK (' + (reason || 'scan') + ')');
      else if (err !== 'captcha' && err !== 'captcha-pause' && err !== 'dryrun') {
        gbLogT('wonder-favor-err', 60000, 'wonder favor err ' + err);
      }
    });
  }
