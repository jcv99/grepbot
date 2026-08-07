# 20 — Storage quota alarm + prune UI

**Risk:** Low · **Size:** M · **Backlog:** §5.5, §6.3

## Current state

Everything persists through GM storage (`GM_setValue`), which is bounded (~5 MB
in practice). The heavy writers:

| Data | Cap | Notes |
|---|---|---|
| `state.seen` | `SEEN_MAX = 2000` (`core.js:299`) | lazy prune (`core.js:582-600`) |
| `state.findings` | 500 (`spy.js:144`) | each may carry `raw: r` — the audit flags dropping `raw` as a GM write-weight win |
| `state.decisions` | ring 400, 7-day TTL | batched save |
| farms / towns / alerted / notes / templates | uncapped | grow with play |

So `seen`, `findings` and `decisions` are bounded, but **`alerted`, farms, towns
and notes are not** — `state.alerted` is only ever trimmed by `pruneMapsToIds`
against known village ids (`farms.js:194`), never by entry count or age, so it
grows with play. `findings[].raw` makes each finding large. Nothing warns before
the quota is hit, and a failed `GM_setValue` is close to silent — the bot appears
to work while losing state on every save.

`grep -riE "quota"` = 0 hits. The 13 `prune` hits are all *scoped* pruners —
the `seen` cap (`core.js:582`), journal TTL (`journal.js:91`), farm/dodge map
cleanup (`farms.js:186,191`, `dodge.js:246`) and `pruneMapsToIds` — none of them
watch total storage size.

## Goal

Measure usage, warn before the ceiling, offer a prune UI.

## Design

1. **Measure.** Sum `JSON.stringify(value).length` per known store key, on demand
   (Stats/Evidence) and on a slow cadence — **not** every save. Measuring is
   itself expensive; do not put it in a hot path.
2. **Report** per-key sizes sorted descending, so the user sees *what* is large
   rather than just a total.
3. **Warn** at a threshold (e.g. 70% of an assumed 5 MB budget): footer badge +
   Log line. The budget is an assumption — label it as such, since GM
   implementations differ.
4. **Detect write failure directly.** Wrap `save` so a throwing/failing
   `GM_setValue` is caught, logged loudly, and surfaced in the footer. This is
   worth more than the estimate: it is the only signal that is definitely true.
   Today a quota failure is invisible.
5. **Prune UI** — explicit, per-category, with counts and confirmation:
   - `seen` → keep newest N
   - `findings` → keep newest N (and optionally strip `raw` from older entries)
   - `alerted` → drop entries older than X days
   - `decisions` → clear journal (already exists in the Decisions sub-view)
   **Never auto-delete.** Pruning `seen` too aggressively re-opens the I14 failure
   mode: dropped ids get re-fetched, so the inbox loops. Any prune that touches
   `seen` must warn about that explicitly.
6. **Drop `raw` from new findings** (audit "Major optimizations") behind a toggle,
   default ON — it is the single biggest write-weight win and it is cheap.

## Files

- `src/core.js` — size measurement, `save` failure detection, threshold state
- `src/stats.js` — size table in Stats + Evidence block
- `src/ui.js` — footer badge, prune dialog
- `src/spy.js` — optional `raw` stripping on ingest

## Risks

- **Measuring on every save would be a performance regression** — on-demand only.
- **Aggressive `seen` pruning causes an inbox re-fetch loop** (I14). Warn, cap,
  and never do it automatically.
- Size estimate ≠ real quota; treat the number as advisory and rely on the
  write-failure detector for truth.

## Validation

1. Stats shows per-key sizes; totals roughly match a manual sum.
2. Artificially inflate a store past the threshold ⇒ warning badge + log line.
3. Simulate a `GM_setValue` failure ⇒ loud log + footer badge, not silence.
   **Primary gate.**
4. Prune `findings` to 100 ⇒ count drops, `seen` untouched, no re-fetch loop
   afterwards (watch for repeated report fetches for 10 min).
5. Prune dialog requires confirmation and reports what it removed.
6. `raw` stripping ON ⇒ new findings smaller, parsing/rendering unaffected.
7. Measurement runs on demand only (no size work in the save path).

## Done when

- Usage is visible per key, a real write failure is impossible to miss, and
  pruning is manual, confirmed, and I14-safe.
