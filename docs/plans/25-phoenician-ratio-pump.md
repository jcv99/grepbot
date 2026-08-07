# 25 — Phoenician salesman ratio pump

**Risk:** Med · **Size:** L · **Status:** CODED in v1.6.2, **default OFF**,
offer parser **unconfirmed against a live window**

## Mechanic

When the merchant ship visits a town, its resource-for-resource offers open at
ratio **0.5:1** and every executed trade bumps the ratio **+0.1**. Five 1-unit
trades therefore lift an offer to **1:1**, and only then is the bulk trade (the
remaining ~1495) worth sending.

## Constraint that shapes the design

The salesman window is server-rendered: `WndHandlerPhoenicianSalesman` does
`requestContentGet('phoenician_salesman', 'index', {town_id})`, and nothing in
`archive/captures/grepo-dump/js/game.min.js` exposes an offers collection or a
ratio field. `merchant.js` only ever handled the *gold* item offers
(`PhoenicianSalesmanOffer/buy`).

So `src/phoenician.js` learns instead of guessing:

- **View URL** — `ptLearnFromXhr` (called from both spy hooks) stores the
  client's own `phoenician_salesman` index request as `state.ptViewUrl`
  (world-scoped). No learned URL ⇒ offers are read only from the open window.
- **Trade payload** — the same sniff stores one hand-clicked trade as
  `state.ptTradeTpl` `{controller, action, arguments, amountKey, town_id}`,
  registered with `tplHealthMarkLearned('ptTradeTpl')`. No template ⇒
  `ptTradePost` posts nothing. Self-posts are ignored while the `pt-trade` lock
  is held, so a pump of amount 1 can never overwrite the real template.
- **Offers** — `ptParseOffers` reads ratio / give / get / stock out of the
  markup (open window first, else the learned view URL through `gbXhr`,
  memoized 30s). A parse miss is **unknown**, so the feature logs once and posts
  nothing; Config has a **Copy offer HTML** button to capture the real markup.

## Loop (`ptTradeScan`, orch key `pttrade`, cadence 120s)

Gates: `hostEnabled`, `state.autoPtTrade` (default OFF), `captchaPaused`,
`automationPaused`, `gbLock('pt-trade')` (TTL 180s).

Preconditions before any post: ship town readable; offer ratio readable and the
received resource wanted; free trade capacity; warehouse room for the incoming
resource; outgoing stock above `reservePct`.

Then: post `pumpAmount` (default 1), **re-read the ratio**, repeat until
`targetRatio` (1.0), `maxPumps` (6), or **the ratio did not move** — a flat ratio
means the +0.1 assumption is wrong on this world, so abort rather than burn
trades. Finally one bulk trade of
`min(stock, warehouse room, trade capacity, stock - reserve)`; a bulk trade is
refused when every capacity read is blind (the scraped stock is never the only
bound).

Everything goes through `gameAjaxPost('pttrade', …)`, so dry run, request budget,
captcha breaker and decision memory all apply.

## Validation

1. Open the merchant window once (teaches the view URL), press **Copy offer
   HTML** and confirm `ptParseOffers` matches the real markup.
2. Do one trade by hand; Preflight "merchant ship" must flip to *payload
   learned*.
3. Dry run ON: expect 5 × amount-1 `DRY-RUN pttrade` lines, then one bulk line.
4. Live only after the sniffed payload matches the hand-clicked body, and check
   the ratio really reads 1.0 before the bulk trade fires.
