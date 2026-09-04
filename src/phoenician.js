  let ptViewCache = null;
  function ptCfg() {
    const c = state.ptCfg || {};
    return {

      targetRatio: +c.targetRatio > 0 ? +c.targetRatio : 1.0,

      minAmount: Math.max(1, Math.floor(+c.pumpAmount || 1)),
      reservePct: Math.min(90, Math.max(0, gbCfgNum(c.reservePct, 10))),
      wantRes: c.wantRes && typeof c.wantRes === 'object' ? c.wantRes : { wood: true, stone: true, iron: false },
    };
  }

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
    const townId = gbNum(tid);
    if (townId != null && townId > 0) return townId;

    try {
      if (typeof m.isInCurrentTown === 'function' && m.isInCurrentTown()) {
        const cur = gbNum(uw.Game && uw.Game.townId);
        return cur != null && cur > 0 ? cur : null;
      }
    } catch (_) {}
    return null;
  }
  function ptInitBlob(text) {
    const s = String(text || '');
    const m = s.match(/PhoenicianSalesman\s*\.\s*initialize\s*\(\s*\{/);
    if (!m) return null;
    const start = s.indexOf('{', m.index);
    if (start < 0) return null;
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(s.slice(start, i + 1)); } catch (_) { return null; }
        }
      }
    }
    return null;
  }
  function ptOffersFromInit(init) {
    if (!init || typeof init !== 'object') return null;
    const goods = init.goods;
    if (!goods || typeof goods !== 'object') return null;
    const exchange = String(goods.exchange_resource || '').toLowerCase();
    if (PT_RES.indexOf(exchange) === -1) return null;
    const offers = [];
    const push = (kind, entry, idx) => {
      if (!entry || typeof entry !== 'object') return;
      const name = String(entry.name || '').toLowerCase();
      if (!name) return;
      const costPer = +((entry.cost || {})[exchange]);
      if (!Number.isFinite(costPer) || costPer <= 0) return;
      const stock = Number.isFinite(+entry.amount) ? +entry.amount : null;
      offers.push({
        id: `${kind}:${name}`,
        kind, name, exchange, costPer,

        ratio: 1 / costPer,
        give: exchange,
        get: kind === 'resource' ? name : null,
        stock,
        idx,
      });
    };
    (Array.isArray(goods.resources) ? goods.resources : []).forEach((e, i) => push('resource', e, i));
    (Array.isArray(goods.units) ? goods.units : []).forEach((e, i) => push('unit', e, i));
    return offers.length ? offers : null;
  }
  function ptExchangeFromRow(el) {
    let hay = '';
    try {
      const price = el.querySelector('.ph_offer_price');
      hay = price ? (price.innerHTML || '') : '';
    } catch (_) { hay = ''; }
    const hits = new Set();
    for (const r of PT_RES) {
      if (new RegExp(`\\b${r}_(?:img|\\d+x\\d+)`).test(hay)) hits.add(r);
    }
    return hits.size === 1 ? [...hits][0] : null;
  }
  function ptOffersFromDomRows(root) {
    if (!root || !root.querySelectorAll) return null;
    let rows = [];
    try { rows = Array.from(root.querySelectorAll('.ph_order_info,[id^="ph_res_order_info_"],[id^="ph_unit_order_info_"]')); } catch (_) { return null; }
    const offers = [];
    const seen = new Set();
    rows.forEach((el) => {
      let hidden = null;
      try { hidden = el.querySelector('input.ph_unit_order_unit_hidden,input[name="resource"],input[name="unit"]'); } catch (_) {}
      if (!hidden) return;
      const kind = String(hidden.getAttribute('name') || '').toLowerCase() === 'unit' ? 'unit' : 'resource';
      const name = String(hidden.value || '').toLowerCase().trim();
      if (!name) return;
      let ratioTxt = '';
      try { ratioTxt = (el.querySelector('.ph_ratio_count') || {}).textContent || ''; } catch (_) {}

      const m = String(ratioTxt).replace(',', '.').match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/);
      if (!m) return;
      const recv = +m[1], costPer = +m[2] / (recv > 0 ? recv : 1);
      if (!Number.isFinite(costPer) || costPer <= 0) return;
      const id = `${kind}:${name}`;
      if (seen.has(id)) return;
      seen.add(id);
      const exchange = ptExchangeFromRow(el);
      offers.push({
        id, kind, name, exchange, costPer,
        ratio: 1 / costPer,
        give: exchange,
        get: kind === 'resource' ? name : null,

        stock: null,
        idx: offers.length,
      });
    });
    return offers.length ? offers : null;
  }

  function ptParseOffers(root) {
    if (!root) return null;
    let blob = null;
    try {
      const scripts = root.querySelectorAll ? Array.from(root.querySelectorAll('script')) : [];
      for (const sc of scripts) {
        blob = ptInitBlob(sc.textContent || '');
        if (blob) break;
      }
      if (!blob) blob = ptInitBlob(root.innerHTML || root.textContent || '');
    } catch (_) { blob = null; }
    const fromInit = ptOffersFromInit(blob);
    if (fromInit) return fromInit;
    return ptOffersFromDomRows(root);
  }
  function ptWindowRoot() {

    try {
      const sel = '[class*="phoenician"],[class*="salesman"],#ph_offers,#ph_trader';
      const nodes = Array.from(document.querySelectorAll(sel));
      for (const n of nodes) {
        if (!n.querySelector) continue;
        if (n.querySelector('.ph_order_info,[id^="ph_res_order_info_"],[id^="ph_unit_order_info_"]')) return n;
      }
    } catch (_) {}
    return null;
  }

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

          html = (j && ((j.plain && j.plain.html) || j.html || (j.json && j.json.html))) || html;
        } catch (_) {}

        let offers = ptOffersFromInit(ptInitBlob(html));
        if (!offers) {
          let doc = null;
          try { doc = new DOMParser().parseFromString(String(html), 'text/html'); } catch (_) {}
          offers = ptParseOffers(doc && doc.body);
        }
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
      const v = gbNum(args[k]);
      if (v != null && v > bestVal) { bestVal = v; best = k; }
    });
    return best;
  }
  function ptCanonicalTrade(offer, amount) {
    if (!offer || !offer.name) return null;
    const kind = offer.kind === 'unit' ? 'unit' : 'resource';
    const data = {};
    data[kind + '_name'] = offer.name;
    data[kind + '_amount'] = Math.max(1, Math.floor(amount));
    return { action: 'trade_' + kind + 's', data };
  }
  function ptTradePost(townId, offer, amount, onDone, feature) {
    const feat = feature || 'pttrade';
    const tpl = state.ptTradeTpl;
    if (tpl && tpl.action && ptAmountKey(tpl)) {
      const key = ptAmountKey(tpl);
      const data = Object.assign({}, tpl.arguments || {});
      data[key] = Math.max(1, Math.floor(amount));
      const tid = gbNum(townId);
      if (tid != null && tid > 0) data.town_id = tid;

      if (offer && offer.name) {
        Object.keys(data).forEach(k => {
          if (/^(resource|unit)_name$/i.test(k)) data[k] = offer.name;
          else if (/offer(_id)?$/i.test(k) && offer.id != null) data[k] = offer.id;
        });
      }
      gameAjaxPost(feat, tpl.controller || 'phoenician_salesman', tpl.action, data, onDone);
      return;
    }
    const canon = ptCanonicalTrade(offer, amount);
    if (!canon) {
      gbLogT('pt-nocanon', 600000, 'phoenician: oferta sin nombre de mercancia - no se envia nada');
      onDone('no-good');
      return;
    }
    const data = Object.assign({}, canon.data);
    const tid = gbNum(townId);
    if (tid != null && tid > 0) data.town_id = tid;
    gameAjaxPost(feat, 'phoenician_salesman', canon.action, data, onDone);
  }

  function ptTownCaps(townId) {
    const uw = gameUw();
    let t = null;
    try { t = gbTownModel(townId); } catch (_) {}
    let tradeCap = null;
    try { if (t && t.getAvailableTradeCapacity) tradeCap = gbNum(t.getAvailableTradeCapacity()); } catch (_) {}
    const st = townResState(townId);
    return { tradeCap, res: st };
  }

  function ptRoom(townId, give, get) {
    const caps = ptTownCaps(townId);
    const cfg = ptCfg();
    const st = caps.res;
    let out = null, room = null;
    if (st) {
      const cap = gbNum(st.cap);
      const keep = cap != null ? Math.floor(cap * (cfg.reservePct / 100)) : null;
      const have = gbNum(st[give]);
      if (have != null && keep != null) out = Math.max(0, have - keep);
      const cur = gbNum(st[get]);
      if (cap != null && cap > 0 && cur != null) room = Math.max(0, cap - cur);
    }
    return { out, room, tradeCap: caps.tradeCap };
  }

  function ptTradeScan(reason) {
    if (!hostEnabled() || !state.autoPtTrade || captchaPaused('pttrade')) return;
    if (automationPaused({})) return;
    if (gbLocked('pt-trade')) return;
    const townId = ptSalesmanTown();
    if (townId == null) {
      gbLogT('pt-noship', 600000, `phoenician: no merchant ship readable (${scanReason(reason)})`);
      return;
    }
    const cfg = ptCfg();
    ptOffers(townId, (offers) => {
      if (!offers || !offers.length) return;

      const wanted = offers.filter((o) => {
        if (o.kind !== 'resource') return false;
        if (!(o.ratio > 0) || !(o.costPer > 0)) return false;
        if (!o.get || !cfg.wantRes[o.get]) return false;
        if (o.stock != null && o.stock <= 0) return false;
        return o.ratio >= cfg.targetRatio;
      }).sort((a, b) => b.ratio - a.ratio);
      const pick = wanted[0];
      if (!pick) {
        gbLogT('pt-nooffer', 300000,
          `phoenician: ninguna oferta llega al ratio minimo ${cfg.targetRatio} para los recursos pedidos`);
        return;
      }
      const give = pick.exchange || pick.give;
      const get = pick.get;
      if (PT_RES.indexOf(give) === -1) {
        gbLogT('pt-noexchange', 600000,
          'phoenician: no se puede leer con que recurso paga el barco - no se envia nada');
        return;
      }
      const room = ptRoom(townId, give, get);
      if (room.room != null && room.room <= 0) {
        gbLogT('pt-full', 300000, `phoenician: town ${townId} ${get} already at capacity - skip`);
        return;
      }

      const bounds = [];
      if (pick.stock != null) bounds.push(pick.stock);
      if (room.room != null) bounds.push(room.room);
      if (room.tradeCap != null) bounds.push(room.tradeCap);
      if (room.out != null) bounds.push(Math.floor(room.out / pick.costPer));
      if (!bounds.length) {
        gbLogT('pt-noread', 300000,
          `phoenician: town ${townId} sin lectura de capacidad ni de stock - no se envia nada`);
        return;
      }
      const amount = Math.floor(Math.min.apply(null, bounds));
      if (!(amount >= cfg.minAmount)) {
        gbLogT('pt-small', 300000,
          `phoenician: town ${townId} solo daria para ${amount} ${get} (minimo ${cfg.minAmount}) - skip`);
        return;
      }
      const ptLock = gbLock('pt-trade');
      if (!ptLock) return;
      const cost = Math.ceil(amount * pick.costPer);
      ptTradePost(townId, pick, amount, (err) => {
        gbUnlock('pt-trade', ptLock);
        if (err === 'dryrun') {
          gbLog(`phoenician: DRY-RUN cambiaria ${cost} ${give} por ${amount} ${get} (ratio ${pick.ratio.toFixed(2)})`);
          return;
        }
        if (err) {
          gbLogT('pt-trade-err', 60000, `phoenician: trade ${err}`);
          return;
        }
        ptViewCache = null;
        gbLog(`phoenician: ${cost} ${give} -> ${amount} ${get} (ratio ${pick.ratio.toFixed(2)})`);
      });
    });
  }
  function ptStatusText() {
    const townId = ptSalesmanTown();
    const tpl = state.ptTradeTpl ? 'payload aprendido' : 'ruta canonica trade_resources';
    const view = state.ptViewUrl ? 'vista aprendida' : 'solo ventana abierta';
    return (townId == null ? 'sin barco' : `barco en la ciudad ${townId}`) + `  |  ${tpl}  |  ${view}`;
  }

  const FAVOR_TEMPLE_PLUNDER = /temple_plunder|plunder_temple|templeplunder|saqueo.?templo|plunderung.?tempel/i;
  const favorOwnMoves = Object.create(null);

  const FAVOR_AUTOMATION_ENABLED = false;
  function favorCurrent() {
    try {
      const uw = gameUw();
      const gods = (uw.Game && uw.Game.gods) || (uw.MM && uw.MM.getModelByNameAndPlayerId && uw.MM.getModelByNameAndPlayerId('PlayerGods'));
      if (!gods) return {};
      const a = gods.attributes || gods;
      return a;
    } catch (_) { return {}; }
  }
