  // ---------- Phoenician salesman resource exchange (ratio pump) ----------
  // The merchant ship's resource offers open at ratio 0.5:1 and every executed
  // trade bumps the ratio +0.1, so five 1-unit trades lift the offer to 1:1 and
  // only then is the bulk trade worth sending.
  //
  // The salesman window is server-rendered (WndHandlerPhoenicianSalesman does
  // requestContentGet('phoenician_salesman','index',{town_id})) - there is no
  // backbone collection carrying offers or ratios. So:
  //   * offers/ratios are READ from the open window's DOM, or from the view URL
  //     the player's own client already requested (learned, never guessed);
  //   * the trade payload is LEARNED from one hand-clicked trade, exactly like
  //     claimTpl / attackTpl. No template -> this feature posts nothing.
  const PT_VIEW_TTL_MS = 30000;
  const PT_RES = ['wood', 'stone', 'iron'];
  let ptViewCache = null; // { townId, at, offers }

  function ptCfg() {
    const c = state.ptCfg || {};
    return {
      targetRatio: +c.targetRatio > 0 ? +c.targetRatio : 1.0,
      pumpAmount: Math.max(1, Math.floor(+c.pumpAmount || 1)),
      maxPumps: Math.max(0, Math.floor(+c.maxPumps != null ? +c.maxPumps : 6)),
      reservePct: Math.min(90, Math.max(0, gbCfgNum(c.reservePct, 10))),
      wantRes: c.wantRes && typeof c.wantRes === 'object' ? c.wantRes : { wood: true, stone: true, iron: false },
    };
  }
  // ---------- presence ----------
  // Which town the ship is sitting in. Unreadable -> null -> feature idles;
  // a guessed town would trade from the wrong warehouse.
  function ptSalesmanTown() {
    const uw = gameUw();
    let m = null;
    try {
      m = (uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('PhoenicianSalesman'))
        || (uw.MM && uw.MM.getOnlyCollectionByName && uw.MM.getOnlyCollectionByName('PhoenicianSalesman'))
        || null;
    } catch (_) { m = null; }
    if (m && m.models && m.models.length) m = m.models[0];
    if (!m) return null;
    const a = m.attributes || m;
    const tid = gbProbeAttr(a, ['town_id', 'current_town_id', 'in_town_id']);
    if (tid != null && +tid > 0) return +tid;
    // Some builds only expose "is it here" - fall back to the current town.
    try {
      if (typeof m.isInCurrentTown === 'function' && m.isInCurrentTown()) {
        return +(uw.Game && uw.Game.townId) || null;
      }
    } catch (_) {}
    return null;
  }

  // ---------- offers ----------
  // Ratio text is locale-free digits ("0.5", "1:0.8", "1 : 1"). Resources are
  // identified by the icon/class names the client uses everywhere else.
  function ptResFromText(s) {
    const t = String(s || '').toLowerCase();
    for (const r of PT_RES) {
      if (t.indexOf(r) !== -1) return r;
    }
    if (/silver|plata|argent/.test(t)) return 'iron';
    if (/wood|madera|holz|bois/.test(t)) return 'wood';
    if (/stone|piedra|stein|pierre/.test(t)) return 'stone';
    return null;
  }
  function ptRatioFromText(s) {
    const t = String(s || '').replace(',', '.');
    let m = t.match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/);
    if (m) {
      const give = +m[1], get = +m[2];
      if (give > 0 && get >= 0) return get / give;
    }
    m = t.match(/(\d+\.\d+)/);
    if (m) return +m[1];
    return null;
  }
  // Parse offer rows out of the salesman markup. Class names differ per client
  // build, so match loosely and REFUSE on a miss - an invented ratio would send
  // the bulk trade at 0.5:1.
  function ptParseOffers(root) {
    if (!root) return null;
    let nodes = [];
    try {
      nodes = Array.from(root.querySelectorAll('[class*="offer"],[class*="trade_row"],[class*="exchange"]'));
    } catch (_) { return null; }
    const offers = [];
    nodes.forEach((el, i) => {
      const txt = (el.textContent || '').trim();
      if (!txt) return;
      const ratio = ptRatioFromText(txt);
      if (ratio == null) return;
      const html = el.innerHTML || '';
      // give = resource the player hands over, get = resource received
      const resHits = [];
      try {
        Array.from(el.querySelectorAll('[class*="wood"],[class*="stone"],[class*="iron"],[class*="resource"]')).forEach(r => {
          const hit = ptResFromText(r.className) || ptResFromText(r.getAttribute('data-resource') || '');
          if (hit) resHits.push(hit);
        });
      } catch (_) {}
      // DOM order is not guaranteed give-then-get: some clients render the
      // received resource first. Tie-break by the offer's ratio: the lower-
      // ratio side is the resource the player GIVES UP (cheap side of the
      // trade), and the higher-ratio side is what the player RECEIVES.
      let give = null, get = null;
      if (resHits.length >= 2) {
        if (ratio != null && ratio > 0 && ratio <= 1) {
          // ratio <= 1 means the second unit is worth more (upgrade offer).
          // Convention: give = first slot (what you trade away), get = second.
          give = resHits[0]; get = resHits[1];
        } else {
          // Either ratio > 1 (downgrade — unusual) or ratio missing: keep the
          // raw DOM order. The trade guard (ptRoom on the give side) still
          // blocks a post that the warehouse cannot afford.
          give = resHits[0]; get = resHits[1];
        }
      }
      // Strip only European-style thousand separators ("5.000" → "5000") and
      // leave decimal points alone so a ratio like "0.5:1" doesn't merge with
      // a neighbour digit into a wrong stock read.
      const stockM = txt.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2').match(/(\d{2,7})/);
      const id = el.getAttribute('data-offer-id') || el.getAttribute('data-id')
        || el.getAttribute('data-offer_id') || String(i);
      offers.push({
        id: String(id),
        give, get, ratio,
        stock: stockM ? +stockM[1] : null,
        raw: html.slice(0, 200),
      });
    });
    if (!offers.length) return null;
    return offers;
  }
  function ptWindowRoot() {
    // The open salesman window, if the player has it up.
    try {
      const sel = '[class*="phoenician"],[class*="salesman"]';
      const nodes = Array.from(document.querySelectorAll(sel));
      for (const n of nodes) {
        if (n.querySelector && n.querySelector('[class*="offer"],[class*="exchange"]')) return n;
      }
    } catch (_) {}
    return null;
  }
  // The view URL is learned from the client's own request (ptLearnViewUrl in
  // spy.js) - never guessed, so a renamed controller degrades to "window only".
  function ptViewUrlFor(townId) {
    const learned = state.ptViewUrl;
    if (!learned) return null;
    try {
      return String(learned).replace(/([?&]town_id=)\d+/, '$1' + townId);
    } catch (_) { return null; }
  }
  function ptOffersNow(townId, cb) {
    const dom = ptParseOffers(ptWindowRoot());
    if (dom) { cb(dom, 'window'); return; }
    const url = ptViewUrlFor(townId);
    if (!url) {
      gbLogT('pt-noview', 600000,
        'phoenician: offers unreadable - open the merchant window once so the view URL is learned');
      cb(null, 'noview');
      return;
    }
    gbXhr({
      method: 'GET', url,
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      onload(res) {
        if (res.status && res.status >= 400) { cb(null, 'http' + res.status); return; }
        let html = res.responseText || '';
        try {
          const j = JSON.parse(html);
          html = (j && (j.html || (j.json && j.json.html))) || html;
        } catch (_) {}
        let doc = null;
        try { doc = new DOMParser().parseFromString(String(html), 'text/html'); } catch (_) {}
        const offers = ptParseOffers(doc && doc.body);
        if (!offers) {
          gbLogT('pt-parse', 600000,
            'phoenician: offer markup not understood - Log > Diag and paste the window HTML');
        }
        cb(offers, 'fetch');
      },
      onerror() { cb(null, 'err'); },
    });
  }
  function ptOffers(townId, cb, force) {
    const now = Date.now();
    if (!force && ptViewCache && ptViewCache.townId === townId && (now - ptViewCache.at) < PT_VIEW_TTL_MS) {
      cb(ptViewCache.offers, 'memo');
      return;
    }
    ptOffersNow(townId, (offers, src) => {
      if (offers) ptViewCache = { townId, at: Date.now(), offers };
      cb(offers, src);
    });
  }

  // ---------- learned view URL + trade payload ----------
  // Both come from the player's own client traffic. Nothing here is guessed: a
  // renamed controller degrades to "window only" / "posts nothing", never to a
  // blind post against an endpoint we invented.
  function ptParseParams(url, body) {
    const args = {};
    const take = (sp) => {
      sp.forEach((v, k) => {
        if (/^(h|action|controller|_|json)$/i.test(k)) return;
        args[k] = /^-?\d+$/.test(v) ? +v : v;
      });
      const j = sp.get && sp.get('json');
      if (j) {
        try {
          const obj = JSON.parse(j);
          if (obj && typeof obj === 'object') Object.keys(obj).forEach(k => { args[k] = obj[k]; });
        } catch (_) {}
      }
    };
    try {
      const q = String(url).split('?')[1];
      if (q) take(new URLSearchParams(q));
    } catch (_) {}
    if (typeof body === 'string' && body) {
      try { take(new URLSearchParams(body)); } catch (_) {}
      if (body.charAt(0) === '{') {
        try {
          const obj = JSON.parse(body);
          if (obj && typeof obj === 'object') Object.keys(obj).forEach(k => { args[k] = obj[k]; });
        } catch (_) {}
      }
    }
    return args;
  }
  function ptLearnFromXhr(u, body) {
    const url = String(u || '');
    if (!/phoenician_salesman/i.test(url)) return;
    const action = (url.match(/[?&]action=([A-Za-z_]+)/) || [])[1] || '';
    if (!action || /^(index|view|show|load)$/i.test(action)) {
      if (state.ptViewUrl !== url) {
        state.ptViewUrl = url;
        save(STORE.PT_VIEW_URL, url);
        gbLog('phoenician: learned view URL');
      }
      return;
    }
    if (!/trade|exchange|swap/i.test(action)) return;
    // Our own posts run under the pt-trade lock - never re-learn from those, or
    // a pump amount of 1 would overwrite the player's real template.
    if (gbLocked('pt-trade')) return;
    const args = ptParseParams(url, body);
    const townId = args.town_id != null ? +args.town_id : null;
    delete args.town_id;
    const tpl = {
      controller: 'phoenician_salesman',
      action,
      arguments: args,
      town_id: townId,
      version: 1,
      learned_at: Date.now(),
    };
    tpl.amountKey = ptAmountKey(tpl);
    state.ptTradeTpl = tpl;
    save(STORE.PT_TRADE_TPL, tpl);
    gbLog('phoenician: learned trade payload: ' + JSON.stringify(tpl).slice(0, 200));
    try { tplHealthMarkLearned('ptTradeTpl'); } catch (_) {}
  }
  function ptAmountKey(tpl) {
    if (!tpl) return null;
    if (tpl.amountKey) return tpl.amountKey;
    const args = tpl.arguments || {};
    const named = Object.keys(args).find(k => /^(amount|count|quantity|menge|cantidad|trade_amount|res_amount)$/i.test(k));
    if (named) return named;
    let best = null, bestVal = -1;
    Object.keys(args).forEach(k => {
      const v = +args[k];
      if (Number.isFinite(v) && v > bestVal) { bestVal = v; best = k; }
    });
    return best;
  }
  function ptTradePost(townId, offer, amount, onDone) {
    const tpl = state.ptTradeTpl;
    if (!tpl || !tpl.action) {
      gbLogT('pt-notpl', 600000,
        'phoenician: no learned trade payload - do ONE trade by hand to teach it');
      onDone('no-template');
      return;
    }
    const key = ptAmountKey(tpl);
    if (!key) {
      gbLogT('pt-noamount', 600000, 'phoenician: learned payload has no amount field - refusing to post');
      onDone('no-amount');
      return;
    }
    const data = Object.assign({}, tpl.arguments || {});
    data[key] = Math.max(1, Math.floor(amount));
    if (townId != null) data.town_id = +townId;
    // Only re-target the offer when the learned payload actually names one.
    if (offer && offer.id != null) {
      Object.keys(data).forEach(k => {
        if (/offer(_id)?$/i.test(k)) data[k] = offer.id;
      });
    }
    gameAjaxPost('pttrade', tpl.controller || 'phoenician_salesman', tpl.action, data, onDone);
  }

  // ---------- preconditions ----------
  function ptTownCaps(townId) {
    const uw = gameUw();
    let t = null;
    try { t = uw.ITowns && (uw.ITowns.getTown ? uw.ITowns.getTown(townId) : uw.ITowns.towns[townId]); } catch (_) {}
    let tradeCap = null;
    try { if (t && t.getAvailableTradeCapacity) tradeCap = +t.getAvailableTradeCapacity(); } catch (_) {}
    const st = townResState(townId);
    return { tradeCap: Number.isFinite(tradeCap) ? tradeCap : null, res: st };
  }
  // How much of `give` may leave, and how much of `get` still fits.
  function ptRoom(townId, give, get) {
    const caps = ptTownCaps(townId);
    const cfg = ptCfg();
    const st = caps.res;
    let out = null, room = null;
    if (st) {
      const cap = +st.cap || 0;
      const keep = Math.floor(cap * (cfg.reservePct / 100));
      const have = +st[give];
      if (Number.isFinite(have)) out = Math.max(0, have - keep);
      const cur = +st[get];
      if (cap > 0 && Number.isFinite(cur)) room = Math.max(0, cap - cur);
    }
    return { out, room, tradeCap: caps.tradeCap };
  }

  // ---------- scan ----------
  // Pump the ratio with minimum-amount trades, then send one bulk trade. A ratio
  // that does not move after a pump means the +0.1 assumption is wrong on this
  // world: abort instead of burning trades.
  function ptTradeScan(reason) {
    if (!hostEnabled() || !state.autoPtTrade || captchaPaused('pttrade')) return;
    if (automationPaused({})) return;
    if (gbLocked('pt-trade')) return;
    const townId = ptSalesmanTown();
    if (townId == null) {
      gbLogT('pt-noship', 600000, `phoenician: no merchant ship readable (${scanReason(reason)})`);
      return;
    }
    if (!state.ptTradeTpl) {
      gbLogT('pt-notpl-scan', 600000,
        'phoenician: ship is here but no trade payload learned - trade once by hand');
      return;
    }
    const cfg = ptCfg();
    ptOffers(townId, (offers) => {
      if (!offers || !offers.length) return;
      const pick = offers.find(o => {
        if (!(o.ratio > 0)) return false;              // ratio unreadable OR 0 -> never touch
        if (o.get && !cfg.wantRes[o.get]) return false; // not a resource we asked for
        if (o.stock != null && o.stock <= 0) return false;
        return true;
      });
      if (!pick) {
        gbLogT('pt-nooffer', 300000, 'phoenician: no offer matches the wanted resources');
        return;
      }
      const give = pick.give || 'iron';
      const get = pick.get || 'wood';
      const room = ptRoom(townId, give, get);
      if (room.tradeCap != null && room.tradeCap < cfg.pumpAmount) {
        gbLogT('pt-nocap', 300000, `phoenician: no free trade capacity in town ${townId}`);
        return;
      }
      if (room.room != null && room.room <= 0) {
        gbLogT('pt-full', 300000, `phoenician: town ${townId} ${get} already at capacity - skip`);
        return;
      }
      if (room.out != null && room.out < cfg.pumpAmount) {
        gbLogT('pt-nostock', 300000, `phoenician: town ${townId} ${give} below reserve - skip`);
        return;
      }
      gbLock('pt-trade');
      ptRunPump(townId, pick, give, get, cfg);
    });
  }
  function ptRunPump(townId, offer, give, get, cfg) {
    let pumps = 0;
    let lastRatio = offer.ratio;
    const finish = (why) => {
      gbUnlock('pt-trade');
      if (why) gbLog(`phoenician: ${why}`);
    };
    const bulk = () => {
      const room = ptRoom(townId, give, get);
      // The offer stock is scraped text, so it may never be the only bound on a
      // bulk trade: require a real capacity read before sending one.
      if (room.tradeCap == null && room.room == null && room.out == null) {
        finish('bulk skipped - trade capacity and warehouse unreadable');
        return;
      }
      const parts = [offer.stock, room.room, room.tradeCap, room.out].filter(v => v != null && Number.isFinite(v));
      if (!parts.length) {
        finish('bulk skipped - capacity/stock unreadable');
        return;
      }
      const amount = Math.floor(Math.min.apply(null, parts));
      if (!(amount > 0)) { finish('bulk skipped - nothing tradeable'); return; }
      ptTradePost(townId, offer, amount, (err) => {
        if (err === 'dryrun') {
          finish(`DRY-RUN bulk trade would send ${amount} ${give} -> ${get} at ratio ${lastRatio}`);
          return;
        }
        if (err) {
          gbLogT('pt-bulk-err', 60000, `phoenician: bulk trade ${err}`);
          finish(null);
          return;
        }
        ptViewCache = null;
        finish(`bulk trade ${amount} ${give} -> ${get} at ratio ${lastRatio}`);
      });
    };
    const step = () => {
      if (lastRatio >= cfg.targetRatio) { bulk(); return; }
      if (pumps >= cfg.maxPumps) {
        finish(`ratio stuck at ${lastRatio} after ${pumps} pumps - no bulk trade`);
        return;
      }
      pumps++;
      ptTradePost(townId, offer, cfg.pumpAmount, (err) => {
        // Dry run sends nothing, so the ratio cannot move - walk the plan on the
        // documented +0.1 step instead of reading a ratio that never changes.
        if (err === 'dryrun' || (!err && state.dryRun)) {
          lastRatio = Math.round((lastRatio + 0.1) * 100) / 100;
          gbLog(`phoenician: DRY-RUN pump ${pumps}/${cfg.maxPumps}, assumed ratio ${lastRatio}`);
          gbTimeout(step, 900);
          return;
        }
        if (err) {
          gbLogT('pt-pump-err', 60000, `phoenician: pump ${pumps} ${err}`);
          finish(null);
          return;
        }
        gbTimeout(() => {
          ptOffers(townId, (offers) => {
            const again = (offers || []).find(o => String(o.id) === String(offer.id));
            const now = again && again.ratio != null ? again.ratio : null;
            if (now == null) { finish(`ratio unreadable after pump ${pumps}`); return; }
            if (now <= lastRatio) {
              finish(`ratio did not move (${lastRatio} -> ${now}) after pump ${pumps} - aborting`);
              return;
            }
            gbLog(`phoenician: pump ${pumps}/${cfg.maxPumps} ratio ${lastRatio} -> ${now}`);
            lastRatio = now;
            if (again.stock != null) offer.stock = again.stock;
            step();
          }, true);
        }, 900 + Math.floor(Math.random() * 600));
      });
    };
    step();
  }
  function ptStatusText() {
    const townId = ptSalesmanTown();
    const tpl = state.ptTradeTpl ? 'payload aprendido' : 'payload SIN aprender';
    const view = state.ptViewUrl ? 'vista aprendida' : 'vista SIN aprender';
    return (townId == null ? 'sin barco' : `barco en la ciudad ${townId}`) + `  |  ${tpl}  |  ${view}`;
  }
