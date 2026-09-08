# AUDIT 2026-08-24 — write-modules batch

Scope: quests, recruit, research, qol, reinforce, rural, research-graph, shared-plan, spy, spy-send, stats, support, towns, trade, transport, tx, ui, wonder (18 src modules) + build.py. Audited against the hard rules in INDEX.md / CLAUDE.md.

## Verified clean

- `txRun` guard order matches the contract: dry → breaker → safe → health (tpl) → dedup → planner → budget → captcha. Captcha is re-read immediately before send; dry-run stamps are swept on toggle-off both in tx.js and in the ui.js config handler.
- `TX_WRITE_FEATURES` covers every write feature posted by this batch: recruit, villrecruit, spell, research, trade, wonder, spy, quest, support. No bare posts found — all writes route through bridgePost / gameAjaxPost.
- spy-send.js: blind cave balance refuses the until-empty path; server `stored_iron` preferred over local subtraction; SPS_MAX_WAVES bounds every path; dry-run waves drain the local counter without stamping the spy cadence.
- research.js: null-vs-0 discipline held (academy null = unreadable / 0 = none; ordersKnown gates queue checks; unreadable points/cost → blind pass, server is authority).
- shared-plan.js: paste-only, host-checked, rejects malformed targets rather than coercing; stages only, never arms.
- quests.js: ambiguous claim outcomes reconcile against the live collection only; backoff ladder persisted across reloads.
- recruit.js spell gating: RECRUIT_SPELL_GODS enforced, unreadable god → blind verdict with once-per-key logging; favor amount hard-stops at 0 when god unknown.

## Findings

### 1. MEDIUM — recruit.js `recruitQueuedAmount` coerces unreadable queue counts to 0

```js
queued += (a.count != null ? a.count : (a.amount != null ? a.amount : a.units)) || 0;
```

Two problems:
- `|| 0` collapses an unreadable count onto a real 0. `txUnitStatus` (tx.js) documents the exact contract for the same three attributes: "A real `0` for an unqueued unit is the only legitimate reading; null means the order shape is unknown and the sweep skips it." recruit.js makes the opposite choice, and the value feeds `need = tgt − cur − queued`, so a failed queue read makes a town look emptier than it is → over-recruit.
- `+=` on a raw attribute string-concatenates if the client ever ships `"5"` instead of `5` (`0 + "5"` → `"05"`). Subtraction later re-coerces, so today's damage is masked, but the accumulator type flips silently.

Fix: mirror txUnitStatus —

```js
const q = gbNum(a.count != null ? a.count : (a.amount != null ? a.amount : a.units));
if (q != null) queued += q; // else: shape unknown, skip
```

### 2. MEDIUM-LOW — tx.js `txMilitiaCount` fabricates 0 on unreadable read

```js
return u ? (+u.militia || 0) : null;
```

`+x || 0` maps null/''/undefined → 0. Same file, `txUnitStatus` carries the comment explaining why this is wrong. Currently fails safe (fabricated 0 → reconcile `unchanged` → `unknown`, never false `applied`), but it violates hard rule "coerce with gbNum; unreadable stays blind" and is a bad pattern to copy.

Fix:

```js
const n = u ? gbNum(u.militia) : null;
return n != null ? n : null;
```

### 3. LOW — tx.js merchant/pttrade readers use Number()+isFinite instead of gbNum

`txMerchantStatus` (`Number(a.price != null ? a.price : a.gold)`) and `txPtTradeStatus` (`Number(a.amount …)`, plus a bare `+t.getAvailableTradeCapacity()` in the tradeCap IIFE). `Number('') === 0`, so an empty-string wire value reads as a real zero; gbNum rejects it. Route all three through gbNum for consistency with the other reconcile readers.

### 4. LOW — qol.js keeps a second repaint discipline

`renderGoals` / `renderPlanner` / `renderHealth` gate on a `data-gb-*-sig` signature and then call bare `box.replaceChildren(...)`, while the rest of the panel uses `gbPaint(host, build, {key})`. The sig-gate is focus-safe (no rebuild when nothing changed), but the invariant list says "Repaint via gbPaint". Either migrate these three or record the sig-gate as an approved alternative in CLAUDE.md so the next module doesn't pick at random.

### 5. LOW — ui.js numeric configs without at-write clamps

Saved raw: `rural-ratio`, `rural-level-max`, `night-start`, `night-end`, `req-budget`, `dodge-floor`, `collect-max-min`. Neighboring controls clamp via gbCfgClamp at write time. Action: confirm each has a read-side clamp; add at-write clamps where missing (req-budget especially — a 0/negative there silently starves every feature).

### 6. INFO — build.py TDZ gate scans single-line initializers only

`checkconstorder` applies TDZREFRE to the declaration line. A multi-line initializer (`const X =\n  someLaterConst();`) evades the forward-reference check. Extend the scan to consume the full initializer expression before matching references.

## Suggested next step

Fix #1 and #2 together (same contract, two files), bump @version, `python3 build.py`, then extend the TDZ gate (#6) so the class of bug can't return.
