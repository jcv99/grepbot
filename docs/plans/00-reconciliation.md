# 00 — Backlog reconciliation (read first)

Verified 2026-08-07 against `src/` @ v1.5.13.

`docs/BACKLOG.md` §2 lists 14 bug IDs as OPEN (C1–C7, I9–I15);
`docs/audit-findings-2026-08-06.md` adds I8, for 15 total. **All 15 are fixed in
the current tree.** The audit file even contradicts itself: line 11 says "Coded
in v1.5.0: C1–C7, I8–I15" while every section below it still reads OPEN. The
per-item status lines were never updated after the fix wave landed.

Planning off those tables would mean re-implementing work that already exists.

## Evidence

| ID | Backlog claim | Reality | Evidence |
|----|---------------|---------|----------|
| C1 | `priorityOrder` default still 6 keys | FIXED | `core.js:399` loads `PRIORITY_ORDER_DEFAULT`; migration `core.js:430-432` |
| C2 | Dispose does not restore hooks | FIXED | `gbHookOrig` `core.js:160`; restore `core.js:196-204`; `gbAbortXhrs`/`gbUnregisterMenus` `core.js:222-224`; `__grepbotQuestDispose` `core.js:235` |
| C3 | World state not isolated | FIXED | `WORLD_SCOPED_BASES` `core.js:132`; auto-key in `load`/`save` `core.js:731,745`; `configVer` migration `core.js:427-444` |
| C4 | Dodge drops simultaneous attacks | FIXED | `dodgeQueue` + `notified\|pending\|sent\|failed` states `dodge.js:8-42,230-253` |
| C5 | `intelDossiers()` throws | FIXED | `units: []`, `towns: []` initialised; `intelPlayerKey(raw)` string key — `intel.js:18-35` |
| C6 | `@connect *` | FIXED | `header.js:15-18` = grepolis.com, discord.com, discordapp.com, api.telegram.org |
| C7 | Auto-on without consent | FIXED | `autoFarm`/`ibAuto`/`ibResearch`/`questAutoBuild`/`questAutoRes` all `false` (`core.js:321-337`); `enabledHosts[h] = false` (`core.js:1267`) |
| I8 | `parseReport` too permissive | FIXED | 5 `return null` paths (lines 29, 41, 43, 45, 49); "never invent type:'unknown'" comment `parse-inline.js:47` |
| I9 | Trade over-allocates | FIXED | `tradeLedger(towns)` threaded through both job builders — `trade.js:149-158` |
| I10 | Wonder 3× capacity, RAM-only budget | FIXED | `wood+stone+iron ≤ tradeCap`, `tradeCap===0` skips — `wonder.js:57-59`; `wonderSaveSpent` persists `wonder.js:110,129` |
| I11 | Global captcha lost on reload | FIXED | `STORE.CAPTCHA_GLOBAL_UNTIL` persisted `core.js:108,420,424`; central check `core.js:494,1030` |
| I12 | GM XHR no timeout | FIXED | central `gbXhr` with `timeout`/`ontimeout`/abort — `core.js:749-802`; all scrapers use it |
| I13 | Journal dedup order stale | FIXED | `list.splice(i, 1)` + `list.push(r)` — `journal.js:92-93` |
| I14 | Findings trim deletes `seen[id]` | FIXED | trim is `state.findings.splice(500)` only, comment cites I14 — `spy.js:144-146` |
| I15 | Quest row `innerHTML` | FIXED | zero `innerHTML` in `quests.js` |

Also stale in `BACKLOG.md` §1:

| Claim | Reality |
|---|---|
| "Telegram webhooks — comment only, Discord-only payload, no chat_id UI" | Implemented: `alertIsTelegram`, `alertTelegramChatId`, `sendMessage` payload with `chat_id` — `alerts.js:1-42` |
| "`webhookEvents` loaded, no panel wiring" | Wired — read `ui.js:1168`, saved `ui.js:1246-1253` |
| "`tradePreset` loaded but never read" | Read — `trade.js:151` |
| "`tradeReservePct` / `tradeMinBatch` not exposed" (§5.7) | Used `trade.js:70-71,113-114`; Config UI `ui.js:1175-1176,1264-1267` |
| "`allianceNotes` loaded unused" | **Partly true** — read in `intel.js:42,78`, but `intelSetAllianceNote` (`intel.js:92`) has no caller ⇒ no UI. Its player-note sibling `intelSetNote` (`intel.js:86`) **is** wired at `ui.js:863`. See plan 03. |

## Actions

1. Rewrite `BACKLOG.md` §2 to a single line: *"C1–C7, I9–I15 fixed as of
   v1.5.13 — see `docs/plans/00-reconciliation.md`."* Keep the evidence-dump row.2. Mark `audit-findings-2026-08-06.md` **CLOSED** at the top, or move it to
   `docs/archive-audits/`. Its per-item OPEN labels are actively misleading.
3. Drop the §1 rows for Telegram, `webhookEvents`, `tradePreset`, and the §5.7
   row for `tradeReservePct`/`tradeMinBatch`.
4. Retarget "Top ROI picks": #1 (intel dossier crash) is already fixed. New list
   is Evidence dump → warehouse deadlock → trade presets.
5. Triage the untracked `FINAL_AUDIT_GrepBot_1.5.8_100pct.txt` (53 KB, root) the
   same way before trusting it — it is one minor version older than the audit
   file that turned out to be stale, so assume nothing in it is current until
   each claim is grepped. Then move it under `docs/` or delete it; the repo root
   is meant to stay minimal (`CLAUDE.md` "Repo layout").

## Note on the working tree

At the time of writing, 13 `src/` modules were modified but uncommitted
(v1.5.12 → v1.5.13): dry-run coverage for DOM clicks (`gbDomClick`), `autoCollect`
gating, `sourceTownIds == null` "all towns" semantics, `gbCfgNum` finite-config
helper, and a dodge fix that returns `null` instead of falling back to an unsafe
town. None of it implements a backlog feature, so no plan here collides with it —
but **rebase these plans on the committed state once that wave lands.**
