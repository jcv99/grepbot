# Instant-build `complete error: remembered` tight loop

## Symptom (panel log)

```
3:15:22 PM claimed Stridragavnos (rel 14684)
3:15:23 PM instant: 1 free order(s), auto-completing
3:15:23 PM instant-build complete error: remembered
3:15:23 PM instant: completed 0/1
3:15:24 PM instant: 1 free order(s), auto-completing
3:15:24 PM instant-build complete error: remembered
3:15:24 PM instant: completed 0/1
... (repeats ~every 1–3 s for the whole skip window)
```

`done` never moves past `0/1`; nothing is completed; the bot is hammering a single
free order with zero progress.

## Root cause

Two stacked bugs surface as one symptom.

### 1. Original 3 hard failures opened a `decisionSkips` window (legitimate)

`bridgePost` (src/core.js:1329) records every exit into the decision journal
(src/journal.js:96 `jrnPush`). The key comes from `jrnTag` (src/journal.js:50):

```
feature | action                        | target
build   | BuildingOrder/completeInstant | <town_id>
```

**The target is the town, not the order.** `arguments.order_id` is not one of
the ids `jrnTag` prefers (`building_id` / `research_id` / `farm_town_id` /
`offer_id` / `power_id` / `id`), so it falls through to `payload.town_id`. One
hard failure on one order therefore silences **every** free order of that town,
and the model keeps reporting all of them as free.

After **3 consecutive `jrnHard` results** (any result that is not `ok`,
`timeout`, `captcha`, or `skip:*`) `jrnNote` (src/journal.js:164) writes a
`state.decisionSkips[key]` entry with a 5/15/60 min backoff and the bot logs
`memory: build … failed 3x (<err>) - skipping Nm`.

The most likely triggers for `completeInstant` posts on a live world right now:

- Client renamed the action. Server returns `unknown action` / `invalid action`.
  `ibComplete` falls back to `finishInstantly` once (src/build-tab.js:250); if
  the client also rejected that, you get two `err` calls in a row for the same
  order, which trips the window after the next scan.
- The post hit `data.error` from `classify` (src/core.js:1395). Anything that is
  not captcha/timeout becomes a hard err.
- The post was blocked by the template-health gate (`bail('tpl-stale')`,
  src/core.js:1349). `tpl-stale` was **not** in `JRN_SKIP_ERRS`, so `jrnResult`
  returned it verbatim and `jrnHard` counted it: an invalidated `ibAction` also
  opened a `decisionSkips` window, i.e. two independent blocks from one root
  cause, one of which outlives the 30 min `TPL_HEALTH_STALE_MS` self-heal.

Not a trigger, contrary to an earlier draft of this doc: `resolve('unknown')`
(src/build-tab.js, timeout branch) is the *promise* value of `ibComplete`, not a
journal result. The journal saw `timeout`, and `jrnHard` (src/journal.js:44)
excludes `timeout`, `captcha`, `ok` and `skip:*`.

Once the window opens, **every** subsequent `bridgePost` for that exact key
short-circuits at `jrnSkipped(jtag)` (src/core.js:1341) with `err =
'remembered'`, which is logged by `ibComplete` (src/build-tab.js:261) as:

```
instant-build complete error: remembered
```

### 2. The bot never backs off when posts are short-circuited

`ibCompleteAll` (src/build-tab.js:274) chains `ibComplete` calls with
`gbTimeout(next, 400 + Math.random() * 200)` and, when the batch ends, fires
`gbTimeout(ibScan, 3000)` (src/build-tab.js:290) **unconditionally** — even when
`done === 0` and every result was a `remembered` skip. Combined with the boot
loop:

- `gbInterval(scan, IB_CHECK_MS)` every 10 s (src/boot.js:113)
- `ibArmNext` re-arming on the next visible countdown (src/build-tab.js:310)
- `visibilitychange` / `pageshow` re-running `ibScan` (src/boot.js:70, 80)
- build-button click hook (src/boot.js:103)

…the bot restarts `ibScan` ~every 1–3 s. Each scan re-detects the same free
order (model still says `gold===0 && timeLeft<=thresh`), calls
`ibCompleteAll`, every call short-circuits at `jrnSkipped`, `done` stays `0`,
and the cycle restarts.

The order is genuinely still free in the model because the server never
actually completed it — the bot's posts were rejected, so the building clock
keeps running and the model keeps reporting `isFree: true` until either the
real countdown hits 0 or the user completes it by hand.

### Why this looks spammy even when the bot is "doing the right thing"

- `bridgePost` already uses `gbLogT('mem-skip-<key>', 60000)` (src/core.js:1342)
  so the skip reason itself is throttled. But `ibComplete` then receives
  `err='remembered'` from its callback and logs the un-throttled line
  `instant-build complete error: remembered` (src/build-tab.js:261).
- `instant: completed 0/1` fires every batch (src/build-tab.js:288) with no
  throttle and no differentiation between "0 because everything was a real
  error" and "0 because everything was a skip".

So during the entire 5–60 min backoff, the user sees a wall of identical
`complete error: remembered` lines.

## Solution (shipped in v1.6.6)

Five changes. None touch the bridge contract or the captcha breaker.

### A. Don't re-arm `ibScan` 3 s after a batch that completed nothing

`ibCompleteAll` fired `gbTimeout(ibScan, 3000)` unconditionally. It is now gated
on `done > 0`, and the batch line is throttled:

```js
gbLogT('ib-batch-done', 60000,
  `instant: completed ${done}/${free.length}${captcha ? ' (captcha abort)' : ''}`);
if (done) { flash(`instantánea x${done}`); gbTimeout(ibScan, 3000); }
```

The 10 s `IB_CHECK_MS` interval (src/boot.js:113) is the recovery path; the 3 s
accelerator only earns its keep when something actually moved.

### B. Skip remembered orders in `ibScan`, before the batch is announced

This is the change that actually stops the loop. A/B/C only quiet it: the scan
still walked the batch to have every post short-circuit at `jrnSkipped`. New
journal helper (src/journal.js), plus `ibJrnPayload(order)` in build-tab so the
scan can key on the same tag without posting:

```js
function gbSkipActive(feature, payload) {
  const tag = jrnTag(feature, payload);
  return jrnSkipped(tag) ? (jrnWhy(tag) || 'remembered') : '';
}
```

```js
const live = free.filter(o => {
  const why = gbSkipActive('build', ibJrnPayload(o));
  if (!why) return true;
  gbLogT('ib-mem-' + o.town_id, 60000, `instant: #${o.id} skipped from memory (${why})`);
  return false;
});
if (!live.length) return;
```

`ibJrnPayload` mirrors `jrnTag`'s inputs (`model_url`, `action_name` from
`ibActionFor`, `arguments.order_id`, `town_id`) — keep the two in sync, or the
pre-check silently stops matching the window it is meant to read.

### C. Throttle the callback logs in `ibComplete`

`remembered` gets `gbLogT('ib-remembered-<order>', 60000)`. Pure local gates
(`tpl-stale`, `budget`, `disabled`, `dryrun`) resolve `'skip'` rather than
`'err'` and log under `gbLogT('ib-gate-<err>', 60000)` — nothing was posted, so
they are not evidence about the payload. Reconciliation via `goneOk()` runs
first on `captcha` / `timeout` / `remembered` / `paused`; on the synchronous
bail paths it is a cheap no-op, on the async ones it converts a real completion
into `'ok'`.

### D. `tpl-stale` is a skip, not a hard failure

src/journal.js, `JRN_SKIP_ERRS` now includes `'tpl-stale'`. It is a local gate,
so it must not feed `gbFailStreak` — otherwise an invalidated template opened a
second, longer block (up to 60 min) on top of the 30 min template window it came
from.

### E. Re-learn `ibAction` when both free actions are rejected

`ibResetLearnedAction(kind, err)` fires only from the `finishInstantly` fallback
path and only for `ibUnknownActionErr(err)`: it clears `state.ibAction` /
`state.ibActionR` and persists `null`, so `ibActionFor` falls back to the
constant `'completeInstant'` on the next scan. Side effect worth knowing:
`tplHealthOk` returns `true` when `state[name]` is empty (src/core.js:721), so
clearing the learned name also lifts the `tpl-stale` gate.

## Immediate user-side workaround

While the fix is not built, recover without a reload:

1. Open the panel **Log** tab → **Decisiones** sub-view.
2. Filter for `build` → look at the most recent record. Confirm `r` is the
   same hard error three times (the trip that opened the window).
3. Click **Limpiar saltos** (src/ui.js:806) to clear every active skip window.
4. If the original failures were `unknown action`, **hand-click a free
   complete in the game UI once** so `ibLearnAction` (src/build-tab.js:192)
   sniffs the new action name from the request body and persists it.
5. Toggle `autoBuild`/`state.ibAuto` off and on (or run `ibScan` once via the
   panel) to restart the loop.

If the same loop comes back within seconds, the learned `ibAction` is still
wrong — clear it from the panel, hand-click, retry. Or set
`state.decisionMemory = false` (Config → "Memoria de decisiones") to suppress
the skip window while validating the new action name in dry run with
`state.dryRun = true`.

## Recovery behaviour after v1.6.6

- `jrnSkipped` (src/journal.js) returns `false` when the window expires and
  decrements `trips` once, so after 5 min the town is retried.
- If the action is still rejected, 3 more hard fails re-trip the window — but no
  longer *within one batch*: the scan now drops remembered orders (B) and does
  not self-re-arm at 3 s (A), so decisions accumulate at the 10 s interval, not
  at 1–3 s.
- The 5/15/60 min ladder still caps at 60 min. What changed is that an
  unknown-action root cause now self-heals (E) instead of pinning the town for
  an hour per retry.

## Related

- `docs/ROADMAP.md` — Phase 8.5 instant build + research.
- `docs/TASKS.md` — gate 8.5: validate the free-complete post end-to-end on
  `es146` before relying on auto.
- `docs/error-patterns.md` — the post-v1.6.6 shape of this bug in the panel log
  is a single throttled `instant: #<id> skipped from memory (<err>, Nm left)`
  per minute, not a wall of `complete error: remembered`.
