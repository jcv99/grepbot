  function merchantRowPrice(w) {
    if (!w || typeof w !== 'object') return null;
    if (String(w.pricedIn || '') !== 'exchange') return null;
    const n = gbNum(w.maxPrice);
    return n != null && n > 0 ? n : null;
  }
  function merchantScan(reason) {
    if (!hostEnabled() || !state.autoMerchant || captchaPaused('merchant')) return;
    if (automationPaused({})) return;
    if (gbLocked('merchant')) return;
    if (gbLocked('pt-trade')) return;
    const wish = state.merchantWish || [];
    if (!wish.length) {
      gbLogT('merchant-empty', 300000, 'merchant: wishlist empty');
      return;
    }
    const stale = wish.filter(w => w && merchantRowPrice(w) == null).length;
    if (stale) {
      gbLogT('merchant-priced-in', 600000,
        `merchant: ${stale} linea(s) sin precio en el recurso de cambio - reescribe el maximo en plata (antes era oro) para activarlas`);
    }
    const townId = ptSalesmanTown();
    if (townId == null) {
      gbLogT('merchant-noship', 600000, `merchant: no merchant ship readable (${scanReason(reason)})`);
      return;
    }
    ptOffers(townId, (offers) => {
      if (!offers || !offers.length) {
        gbLogT('merchant-none', 180000, `merchant: no offers (${scanReason(reason)})`);
        return;
      }
      const units = offers.filter(o => o.kind === 'unit');
      if (!units.length) {
        gbLogT('merchant-nounits', 300000, 'merchant: el barco no trae unidades esta visita');
        return;
      }
      let job = null;
      for (const w of wish) {
        const name = String(w.item || w.id || '').toLowerCase().trim();
        const maxPrice = merchantRowPrice(w);
        if (!name || maxPrice == null) continue;
        for (const o of units) {
          if (!merchantExactMatch(name, o.name)) continue;
          if (!(o.costPer > 0)) continue;
          if (o.costPer > maxPrice) continue;
          if (o.stock != null && o.stock <= 0) continue;
          job = { offer: o, wish: w, maxPrice, townId, itemId: o.name };
          break;
        }
        if (job) break;
      }
      if (!job) return;
      merchantBuy(job);
    });
  }
  function merchantBuy(job) {
    const offer = job.offer;
    const exchange = offer.exchange;
    if (PT_RES.indexOf(exchange) === -1) {
      gbLogT('merchant-noexchange', 600000,
        'merchant: no se puede leer con que recurso paga el barco - no se compra nada');
      return;
    }

    const room = ptRoom(job.townId, exchange, exchange);
    if (room.out == null) {
      gbLogT('merchant-blind', 300000,
        `merchant: town ${job.townId} ${exchange} ilegible - no se compra a ciegas`);
      return;
    }
    const affordable = Math.floor(room.out / offer.costPer);
    const bounds = [affordable];
    if (offer.stock != null) bounds.push(offer.stock);
    const wantRaw = gbNum(job.wish.amount);
    const want = wantRaw == null ? null : Math.floor(wantRaw);
    if (want != null && want > 0) bounds.push(want);
    const amount = Math.floor(Math.min.apply(null, bounds));
    if (!(amount > 0)) {
      gbLogT('merchant-poor', 300000,
        `merchant: ${offer.name} cuesta ${offer.costPer} ${exchange} y no alcanza tras la reserva - skip`);
      return;
    }
    const cost = Math.ceil(amount * offer.costPer);
    const merchantLock = gbLock('merchant', 180000);
    if (!merchantLock) return;

    const fresh = ptRoom(job.townId, exchange, exchange);
    if (fresh.out == null || fresh.out < cost || offer.costPer > job.maxPrice) {
      gbUnlock('merchant', merchantLock);
      gbLogT('merchant-stale', 60000, 'merchant: final precheck failed; balance or price moved');
      return;
    }
    ptTradePost(job.townId, offer, amount, (err) => {
      gbUnlock('merchant', merchantLock);
      if (err === 'dryrun') {
        gbLog(`merchant: DRY-RUN compraria ${amount} ${offer.name} por ${cost} ${exchange}`);
        return;
      }

      if (err === 'timeout' || err === 'timeout_unknown' || err === 'pending') {
        gbLogT('merchant-timeout', 60000, `merchant: timeout_unknown ${offer.name} \u2014 sin reintento`);
        return;
      }
      if (err) {
        gbLogT('merchant-err', 60000, `merchant err ${err}`);
        return;
      }
      ptViewCache = null;
      gbLog(`merchant: ${amount} ${offer.name} por ${cost} ${exchange} en la ciudad ${job.townId}`);
    }, 'merchant');
  }

  const PT_VIEW_TTL_MS = 30000;
  const PT_RES = ['wood', 'stone', 'iron'];
