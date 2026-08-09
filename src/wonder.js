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
  function defenseAssessment(mov,incoming){const eta=dodgeEtaSec(mov);const all=incoming||dodgeIncomingMovements();const simultaneous=all.filter(x=>String(x.dest)===String(mov.dest)).length;const local=defenseLocalStrength(mov.dest);const supports=defenseSupportOptions(mov.dest,eta);const safe=dodgeSafeTown(mov.dest,all);const evacUnits=dodgeTownUnits(mov.dest);const evac=safe?dodgeSupportValidate(mov.dest,safe,evacUnits):{ok:false,why:'no-safe-town'};const militia=dodgeCanRaiseMilitia(mov.dest);let risk=0;if(mov.hasCs)risk+=60;if(eta!=null&&eta<15*60)risk+=25;if(simultaneous>1)risk+=Math.min(25,(simultaneous-1)*8);if(local.score<200)risk+=10;if(supports.length)risk-=Math.min(20,supports.length*5);return{eta,simultaneous,local,supports,safeTown:safe,evac,militia,risk,hasCs:!!mov.hasCs}}
  function defenseShouldDodge(mov,incoming){const mode=defenseMode(),a=defenseAssessment(mov,incoming);if(mode==='notify')return{yes:false,assessment:a,why:'notify'};if(mode==='safe')return{yes:true,assessment:a,why:'safe'};if(!state.defenseCfg.smartAuto)return{yes:false,assessment:a,why:'smart-auto-off'};if(!a.evac.ok)return{yes:false,assessment:a,why:'cannot-evacuate'};if(a.hasCs||a.risk>=35)return{yes:true,assessment:a,why:'risk'};return{yes:false,assessment:a,why:'defend/observe'}}
  function dodgeReturnSave(){save(STORE.DODGE_RETURNS,state.dodgeReturns||{})}
  function dodgeReturnRecord(mov,from,dest,data){const id=String((data&&(data.command_id||data.commandId||data.movement_id||data.id))||'');if(!id)return;const arrival=+(mov&&mov.arrival)||0,margin=Math.max(0,+((state.defenseCfg&&state.defenseCfg.returnMarginSec)||120));const due=(arrival>1e12?arrival:arrival*1000)+margin*1000;state.dodgeReturns[id]={commandId:id,attackId:String(mov.id||''),from:String(from),dest:String(dest),attackArrival:arrival,dueAt:due||Date.now()+margin*1000,state:'waiting',createdAt:Date.now()};dodgeReturnSave()}
  function dodgeReturnTick(){if(!hostEnabled()||automationPaused({}))return;const now=Date.now();for(const[id,r]of Object.entries(state.dodgeReturns||{})){if(!r||r.state==='done'||r.state==='manual')continue;if(+r.dueAt>now)continue;const live=militaryOutgoingMovements().find(x=>String(x.commandId)===String(r.commandId));if(live&&state.cancelTpl){r.state='returning';dodgeReturnSave();militaryCancelCommand(r.commandId,{confirmed:true,automation:true},err=>{if(!err){r.state='done';r.doneAt=Date.now()}else if(err==='not-cancelable'){r.state='manual';r.why='support already arrived; withdraw manually'}else{r.state='waiting';r.lastError=String(err)}dodgeReturnSave()});}else{r.state='manual';r.why=live?'cancel template missing':'movement no longer cancelable/visible';dodgeReturnSave();gbLogT('dodge-return-'+id,60000,`dodge return ${id}: ${r.why}`)}}}

  const DODGE_CHECK_MS = 5000;
  const DODGE_RETRY_MS = 15000;
  const DODGE_FAIL_BACKOFF = [15000, 45000, 120000];
  const DODGE_QUEUE_TTL = 3600000;
