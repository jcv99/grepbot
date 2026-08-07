  // ---------- Phoenician merchant sniper (Phase 8.9) ----------
  const MERCHANT_CHECK_MS = 45000;

  function merchantExactMatch(wishName, offerId) {
    const w = String(wishName || '').toLowerCase().trim();
    const id = String(offerId || '').toLowerCase().trim();
    if (!w || !id) return false; // empty id must never match
    return w === id;
  }
  function merchantScan(reason) {
    if (!hostEnabled() || !state.autoMerchant || captchaPaused('merchant')) return;
    if (automationPaused({})) return;
    if (gbLocked('merchant')) return;
    const wish = state.merchantWish || [];
    if (!wish.length) {
      gbLogT('merchant-empty', 300000, 'merchant: wishlist empty');
      return;
    }
    const uw = gameUw();
    let offers = [];
    try {
      const col = uw.MM && (uw.MM.getOnlyCollectionByName && (
        uw.MM.getOnlyCollectionByName('PhoenicianSalesmanOffer') ||
        uw.MM.getOnlyCollectionByName('MerchantOffer') ||
        uw.MM.getOnlyCollectionByName('PremiumExchangeOffer')
      ));
      if (col && col.models) offers = col.models;
    } catch (_) {}
    if (!offers.length) {
      gbLogT('merchant-none', 180000, `merchant: no offers (${reason || 'scan'})`);
      return;
    }
    // Offers are paid in gold. Buying without the balance is a guaranteed
    // rejection, so read it once per scan; null = unreadable -> server decides.
    const gold = gbPlayerGold();
    let job = null;
    for (const w of wish) {
      const name = (w.item || w.id || '').toLowerCase().trim();
      const maxPrice = +w.maxPrice;
      if (!name || !(maxPrice > 0)) continue;
      for (const o of offers) {
        const a = o.attributes || {};
        // Require canonical item id - never fall back to empty / ambiguous substring
        const id = String(a.item_id || a.offer_id || '').toLowerCase().trim();
        if (!id) continue;
        if (!merchantExactMatch(name, id) && !merchantExactMatch(name, String(a.type || '').toLowerCase())) continue;
        // Price must be explicitly present and finite - missing -> 0 is forbidden
        const priceRaw = a.price != null ? a.price : (a.gold != null ? a.gold : null);
        if (priceRaw == null || priceRaw === '') continue;
        const price = +priceRaw;
        if (!Number.isFinite(price) || price < 0) continue;
        if (price > maxPrice) continue;
        if (gold != null && gold < price) {
          gbLogT('merchant-gold', 300000, `merchant: ${id} costs ${price}, gold ${gold} - skip`);
          continue;
        }
        const townId = a.town_id || (uw.Game && uw.Game.townId);
        if (!townId) continue;
        job = { offer: o, wish: w, price, townId, itemId: id };
        break;
      }
      if (job) break;
    }
    if (!job) return;
    // Reconfirm offer still present before buy
    const oid = (job.offer.attributes && (job.offer.attributes.id || job.offer.id)) || job.offer.id;
    if (oid == null || oid === '') {
      gbLogT('merchant-noid', 60000, 'merchant: offer has no id - skip');
      return;
    }
    gbLock('merchant');
    bridgePost('merchant', {
      model_url: `PhoenicianSalesmanOffer/${oid}`,
      action_name: 'buy',
      arguments: {},
      town_id: +job.townId,
    }, (err) => {
      if (err === 'timeout') {
        gbLogT('merchant-timeout', 60000, `merchant: timeout_unknown for ${job.itemId} - no fallback`);
        gbUnlock('merchant');
        return;
      }
      if (!err) {
        gbLog(`merchant: bought ${job.wish.item || job.wish.id} @ ${job.price}`);
        gbUnlock('merchant');
        return;
      }
      // Only fallback when server says the bridge action/endpoint does not exist
      if (!/unknown.?action|invalid.?action|not.?found|does.?not.?exist/i.test(String(err))) {
        gbLogT('merchant-err', 60000, `merchant err ${err}`);
        gbUnlock('merchant');
        return;
      }
      gameAjaxPost('merchant', 'phoenician_salesman', 'buy', {
        offer_id: oid,
        town_id: +job.townId,
      }, (e2) => {
        gbUnlock('merchant');
        if (!e2) gbLog(`merchant: bought via ajax ${job.wish.item || job.wish.id}`);
        else gbLogT('merchant-err', 60000, `merchant err ${err}/${e2}`);
      });
    });
  }
