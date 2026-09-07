#!/usr/bin/env node
// GrepBot headless driver — no npm deps (Node 22 built-ins + system `chromium`).
//
//   node .claude/skills/run-grepbot/driver.mjs            # full smoke
//   node .claude/skills/run-grepbot/driver.mjs --no-build # reuse grepbot.user.js
//   node .claude/skills/run-grepbot/driver.mjs repl       # interactive CDP REPL
//
// Full smoke does, in order:
//   1. python3 build.py                       (skip: --no-build)
//   2. header sanity + `node --check` on the concatenated artifact
//   3. chromium --headless=new + CDP over the DevTools WebSocket, loading
//      smoke.html (stubs MM / ITowns / gpAjax / Game / GM_* )
//   4. asserts the panel mounted and that its rendered version string
//      matches @version in src/header.js  (stale-artifact detector)
//   5. clicks through every panel tab, screenshotting each
//   6. runs the real Actions > Preflight flow and captures its output
//   7. opens the Queue Center window and walks its four lane tabs
//   8. write harness: every TX_WRITE_FEATURES key posts through txRun in
//      dry run (bridge + ajax transports), 0 gpAjax calls, unknown key fails
//   9. fails on any window.error / unhandledrejection / console.error
//
// This is an INIT smoke, not a real-game smoke: the bot needs a logged-in
// Grepolis session. See SKILL.md.

import { spawnSync, spawn } from 'node:child_process';
import { existsSync, statSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as wait } from 'node:timers/promises';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const outDir = resolve(repoRoot, process.env.GREPBOT_SMOKE_OUT || 'data/smoke');
const userJs = resolve(repoRoot, 'grepbot.user.js');
const smokeHtml = resolve(here, 'smoke.html');
const harnessPath = resolve(repoRoot, 'test/fixtures/write-harness.json');
const replayPath = resolve(repoRoot, 'test/fixtures/replay/smoke-patch.json');
const plannerPath = resolve(repoRoot, 'src/planner.js');
const CHROME = process.env.GREPBOT_CHROME || 'chromium';

const argv = process.argv.slice(2);
const mode = argv.find(a => !a.startsWith('-')) || 'smoke';
const noBuild = argv.includes('--no-build');
const keepOpen = argv.includes('--keep-open');
// Suppress smoke.html's __grepbotTestMode, i.e. boot exactly as Tampermonkey
// does. Costs you window.__grepbotTest and everything built on it.
const noTest = argv.includes('--notest');

// Panel tab ids, in nav order (src/ui.js TAB_GROUPS).
const TABS = ['overview', 'attack', 'reinforce', 'train', 'spy', 'intel', 'config', 'stats', 'log'];
// Queue Center lane tabs (src/queue-center.js, the `Colas` header button).
const QTABS = ['build', 'research', 'barracks', 'docks'];

const log = (...a) => console.log('[driver]', ...a);
// evaluate() returns the '__ERR__…' sentinel on a page-side throw, which is
// not JSON. Never hand its result straight to JSON.parse.
const jparse = (s, dflt) => {
  if (typeof s !== 'string' || s.startsWith('__ERR__')) return dflt;
  try { return JSON.parse(s); } catch (_) { return dflt; }
};
function fail(msg, code = 1) { console.error('[driver] FAIL:', msg); process.exit(code); }

// ---------------------------------------------------------------- build ----

function buildAndCheck() {
  // `expect` is the version the artifact must carry. After a build that is
  // whatever build.py reported; with --no-build it is src/header.js as it
  // stands now, which is exactly the stale-artifact check we want. Never
  // re-read src/header.js after building: a concurrent editor bumping
  // @version mid-run would turn a good build into a false failure.
  let expect = null;
  if (noBuild) {
    log('build: skipped (--no-build)');
    const sv = readFileSync(resolve(repoRoot, 'src/header.js'), 'utf8').match(/@version\s+(\d+\.\d+\.\d+)/);
    expect = sv && sv[1];
  } else {
    log('build: python3 build.py');
    const r = spawnSync('python3', ['build.py'], { cwd: repoRoot, encoding: 'utf8' });
    process.stdout.write(r.stdout || '');
    // build.py exits 1 on a gate failure (dup top-level decl / node --check).
    if (r.status !== 0) fail(`build.py exited ${r.status}\n${r.stderr}`);
    const bv = (r.stdout || '').match(/\bv(\d+\.\d+\.\d+)\s*$/m);
    expect = bv && bv[1];
  }

  if (!existsSync(userJs)) fail(`missing ${userJs}`);
  const sz = statSync(userJs).size;
  if (sz < 50_000) fail(`grepbot.user.js suspiciously small: ${sz} bytes`);

  const head = readFileSync(userJs, 'utf8').slice(0, 400);
  if (!head.includes('==UserScript==')) fail('userscript header missing in built artifact');
  const vm = head.match(/@version\s+(\d+\.\d+\.\d+)/);
  if (!vm) fail('header @version not found in artifact');

  if (expect && expect !== vm[1]) {
    fail(`artifact @version ${vm[1]} != expected ${expect} — stale grepbot.user.js, run python3 build.py`);
  }

  const check = spawnSync('node', ['--check', userJs], { encoding: 'utf8' });
  if (check.status !== 0) fail(`node --check failed:\n${check.stderr}`);
  log(`artifact OK: ${sz} bytes, v${vm[1]}, node --check clean`);
  return vm[1];
}

// ------------------------------------------------------------------ CDP ----

async function launch() {
  const profile = join(tmpdir(), `grepbot-cdp-${process.pid}`);
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(profile, { recursive: true });

  const proc = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--window-size=1280,800',
    // file:// SOP otherwise reduces every userscript throw to a bare
    // "Script error." with no filename/line — useless for diagnosis.
    '--allow-file-access-from-files',
    '--disable-web-security',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'file://' + smokeHtml + (noTest ? '?notest' : ''),
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let chromeErr = '';
  proc.stderr.on('data', c => { chromeErr += c; });
  proc.on('error', e => fail(`failed to spawn ${CHROME}: ${e.message}`));

  // chromium writes the real port here once the DevTools endpoint is up.
  const portFile = join(profile, 'DevToolsActivePort');
  let port = null;
  for (let i = 0; i < 80 && port === null; i++) {
    await wait(125);
    if (existsSync(portFile)) {
      const p = readFileSync(portFile, 'utf8').split('\n')[0].trim();
      if (p) port = Number(p);
    }
  }
  if (!port) fail(`chromium never wrote DevToolsActivePort\n${chromeErr.slice(0, 800)}`);

  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await wait(125);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
    } catch (_) { /* endpoint not ready */ }
  }
  if (!target) fail('no CDP page target');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise(res => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

  async function evaluate(expression) {
    const r = await send('Runtime.evaluate', {
      expression: `(() => { try { return (${expression}); } catch (e) { return '__ERR__' + e.message; } })()`,
      returnByValue: true, awaitPromise: true,
    });
    if (r.result && r.result.exceptionDetails) return '__ERR__' + r.result.exceptionDetails.text;
    return r.result && r.result.result ? r.result.result.value : undefined;
  }

  async function screenshot(name) {
    mkdirSync(outDir, { recursive: true });
    const r = await send('Page.captureScreenshot', { format: 'png' });
    if (!r.result || !r.result.data) throw new Error('captureScreenshot returned no data');
    const p = join(outDir, `${name}.png`);
    writeFileSync(p, Buffer.from(r.result.data, 'base64'));
    return p;
  }

  const close = () => { try { ws.close(); } catch (_) {} proc.kill('SIGKILL'); rmSync(profile, { recursive: true, force: true }); };

  return { proc, send, evaluate, screenshot, close, port };
}

// Wait for the smoke stub's settle timer to stamp <title>.
async function settle(evaluate, ms = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const t = await evaluate('document.title');
    if (t && t !== 'SMOKE_PENDING') return t;
    await wait(250);
  }
  return await evaluate('document.title');
}

const errorsExpr = 'JSON.stringify(window.__SMOKE_ERRORS__ || [], null, 2)';

// The panel is a two-level nav: .gb-nav groups (Scout/Action/Account/System)
// and .gb-subtabs tabs. A sub-tab button only exists while its group is
// active, so walk the groups until the wanted button shows up.
const selectTabExpr = (tab) => `(() => {
  const sel = '#grepbot-panel .gb-subtabs button[data-tab="${tab}"]';
  const nav = [...document.querySelectorAll('#grepbot-panel .gb-nav button')];
  let b = document.querySelector(sel);
  for (let i = 0; !b && i < nav.length; i++) { nav[i].click(); b = document.querySelector(sel); }
  if (!b) return 'no-button';
  b.click();
  const s = document.querySelector('#grepbot-panel section[data-tab="${tab}"]');
  return s && !s.hidden ? 'shown' : 'hidden';
})()`;

// ---- the internals handle -------------------------------------------------
// boot.js publishes window.__grepbotTest only when __grepbotTestMode === true
// was set BEFORE the IIFE ran (smoke.html does that). Everything else in the
// bot is sealed inside one IIFE and unreachable from CDP.
const T = 'window.__grepbotTest';

// Open the Queue Center (header `Colas`) and select a lane.
const queuesExpr = (qtab) => `(() => {
  const btn = document.querySelector('#grepbot-panel header button[data-act=queues]');
  if (!btn) return 'no-button';
  btn.click();
  const w = document.getElementById('grepbot-queue-center');
  if (!w) return 'no-window';
  ${qtab ? `const t = w.querySelector('.gb-qc-tab[data-qtab="${qtab}"]'); if (!t) return 'no-tab'; t.click();` : ''}
  return w.style.display === 'none' ? 'hidden' : 'shown';
})()`;

// Two preconditions gate every write, both false on a file:// stub page:
// txRun bails 'disabled' unless state.enabledHosts[location.host] === true,
// and only features in TX_WRITE_FEATURES (planner.js) reach the dry-run gate.
const armExpr = `(() => {
  const t = ${T}; if (!t) return 'no-test-mode';
  t.state.dryRun = true;
  t.state.enabledHosts[location.host] = true;
  return 'armed host=' + JSON.stringify(location.host) + ' dryRun=true';
})()`;

// bridgePost is callback-style; evaluate() awaits promises, so wrap it.
const postExpr = (feature, json) => `new Promise(r => ${T}.bridgePost(${JSON.stringify(feature)}, ${json}, (res, err) => r(JSON.stringify({ res, err: err && String(err) }))))`;
const ajaxPostExpr = (feature, controller, action, dataJson) =>
  `new Promise(r => ${T}.gameAjaxPost(${JSON.stringify(feature)}, ${JSON.stringify(controller)}, ${JSON.stringify(action)}, ${dataJson}, (res, err) => r(JSON.stringify({ res, err: err && String(err) }))))`;
const ajaxCountExpr = 'window.__SMOKE_AJAX_POSTS__ || 0';
const resetAjaxExpr = '(() => { window.__SMOKE_AJAX_POSTS__ = 0; return 0; })()';

const journalExpr = (n) => `JSON.stringify((${T}.state.decisions || []).slice(-${n || 5}), null, 1)`;

function parseTxWriteFeatures() {
  const src = readFileSync(plannerPath, 'utf8');
  const m = src.match(/const TX_WRITE_FEATURES = new Set\(\[([\s\S]*?)\]\)/);
  if (!m) fail('TX_WRITE_FEATURES not found in src/planner.js');
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]).sort();
}

function loadWriteHarness() {
  if (!existsSync(harnessPath)) fail(`missing write harness: ${harnessPath}`);
  const raw = JSON.parse(readFileSync(harnessPath, 'utf8'));
  const cases = raw.cases || [];
  if (!cases.length) fail('write harness has no cases');
  return cases;
}

function harnessCoverage(features, cases) {
  const featSet = new Set(features);
  const caseFeats = new Set(cases.map(c => c.feature));
  const missing = features.filter(f => !caseFeats.has(f));
  const extra = [...caseFeats].filter(f => !featSet.has(f));
  return { missing, extra };
}

async function runWriteHarness(d) {
  const features = parseTxWriteFeatures();
  const cases = loadWriteHarness();
  const cov = harnessCoverage(features, cases);
  if (cov.missing.length) fail(`harness missing TX_WRITE_FEATURES: ${cov.missing.join(', ')}`);
  if (cov.extra.length) fail(`harness has unknown feature keys: ${cov.extra.join(', ')}`);

  log(`write harness: ${cases.length} cases, TX_WRITE_FEATURES=${features.length}`);
  log('arm:', await d.evaluate(armExpr));
  await d.evaluate(resetAjaxExpr);

  const fails = [];
  for (const c of cases) {
    let posted;
    if (c.transport === 'ajax') {
      posted = jparse(await d.evaluate(
        ajaxPostExpr(c.feature, c.controller, c.action, JSON.stringify(c.data || {}))), {});
    } else if (c.transport === 'bridge') {
      posted = jparse(await d.evaluate(
        postExpr(c.feature, JSON.stringify(c.payload || {}))), {});
    } else {
      fails.push(`${c.feature}: bad transport ${c.transport}`);
      continue;
    }
    if (posted.res !== 'dryrun') {
      fails.push(`${c.feature}: res=${posted.res} err=${posted.err || ''}`);
    }
  }

  const ajaxAfter = await d.evaluate(ajaxCountExpr);
  if (+ajaxAfter !== 0) {
    fails.push(`gpAjax.ajaxPost called ${ajaxAfter} time(s) during dry-run harness`);
  }

  // Unknown feature must NOT hit the write dry-run gate (READ path).
  const beforeBad = await d.evaluate(ajaxCountExpr);
  const badFeat = jparse(await d.evaluate(postExpr('farmClaim', '{ town_id: 7 }')), {});
  const afterBad = await d.evaluate(ajaxCountExpr);
  if (badFeat.res === 'dryrun') {
    fails.push('farmClaim returned dryrun — not in TX_WRITE_FEATURES but took write path');
  }
  if (+afterBad <= +beforeBad) {
    fails.push('farmClaim did not reach gpAjax (READ path not exercised)');
  }

  log(`write harness: ${cases.length - fails.length}/${cases.length} dryrun, ajax=${ajaxAfter}, farmClaim=${badFeat.res}`);
  if (fails.length) {
    fails.forEach(f => console.error(`[driver]   harness ${f}`));
    fail(`write harness: ${fails.length} failure(s)`, 2);
  }

  // first-post gate: live post without authorization must not send.
  const farmPayload = JSON.stringify({
    model_url: 'FarmTownPlayerRelation/1',
    action_name: 'claim',
    arguments: { farm_town_id: 4242, type: 'resources', option: 1 },
    town_id: 7,
  });
  await d.evaluate(resetAjaxExpr);
  await d.evaluate(`(() => { const s = ${T}.state; s.dryRun = false; s.firstPostConfirm = true; s.firstPostLive = {}; return 'live-gate'; })()`);
  const blocked = jparse(await d.evaluate(postExpr('farm', farmPayload)), {});
  const ajaxBlocked = await d.evaluate(ajaxCountExpr);
  if (blocked.res !== 'first-post-confirm') {
    fail(`first-post gate: farm res=${blocked.res}, expected first-post-confirm`, 2);
  }
  if (+ajaxBlocked !== 0) {
    fail(`first-post gate: gpAjax count=${ajaxBlocked}, expected 0 while blocked`, 2);
  }
  await d.evaluate(`(() => { ${T}.firstPostLiveAuthorize('farm'); ${T}.state.dryRun = true; return 'restored'; })()`);
  log('first-post gate: blocked live farm, authorize OK');
}

function loadReplayPatch() {
  if (!existsSync(replayPath)) fail(`missing replay patch: ${replayPath} (run python3 tools/har_replay.py)`);
  return JSON.parse(readFileSync(replayPath, 'utf8'));
}

function applyReplayPatchExpr(patch) {
  return `(() => {
    const p = ${JSON.stringify(patch)};
    const T = ${T};
    if (!T) return 'no-test';
    const mk = (row) => {
      const id = row.id;
      const buildings = Object.assign({
        main: 20, storage: 25, farm: 22, academy: 30, temple: 15, barracks: 10,
        docks: 5, market: 10, hide: 10, lumber: 15, stoner: 15, ironer: 15, wall: 5,
        theater: 0, thermal: 0, library: 1, lighthouse: 0, tower: 0, statue: 0,
        oracle: 0, trade_office: 0
      }, row.buildings || {});
      const res = Object.assign({ wood: 12000, stone: 9000, iron: 7000, storage: 21000, population: 120 }, row.resources || {});
      return {
        id, id_: id, name: row.name || ('Town ' + id), player_id: 1,
        attributes: { id, name: row.name || ('Town ' + id), island_x: row.island_x, island_y: row.island_y, island_id: row.island_id, on_small_island: !!row.on_small_island },
        get: (k) => ({ on_small_island: !!row.on_small_island })[k],
        resources: () => res,
        getStorageCapacity: () => +res.storage || 21000,
        getAvailablePopulation: () => +res.population || 120,
        getAvailableTradeCapacity: () => 1500,
        getAvailableResearchPoints: () => 12,
        getBuildings: () => ({ get: (k) => (buildings[k] != null ? buildings[k] : 0), attributes: buildings }),
        researches: () => ({ attributes: { booty: true } }),
        units: {}
      };
    };
    const towns = {};
    (p.towns || []).forEach(row => { towns[row.id] = mk(row); towns[String(row.id)] = towns[row.id]; });
    window.ITowns = { towns, getTown: (id) => towns[id] || towns[String(id)] || null };
    if (p.gameTownId != null) window.Game.townId = p.gameTownId;
    T.state.towns = (p.towns || []).map(row => ({ id: row.id, name: row.name }));
    return 'patched:' + (p.towns || []).length + ' towns';
  })()`;
}

const orchSeedExpr = `(() => {
  const s = ${T}.state;
  s.autoFarm = true; s.autoCave = true; s.abAuto = true; s.autoResearch = true;
  s.autoCulture = true; s.autoTrade = true; s.autoRuralTrade = true; s.autoRuralLevel = true;
  s.autoCollect = true; s.autoBandit = true; s.autoMerchant = false; s.autoPtTrade = false;
  s.farmOptionMap = { 300: 0, 600: 1, 1200: 2, 2400: 3, 5400: 4, 7200: 5, 10800: 6, 14400: 7, 18000: 8, 28800: 9, 36000: 10 };
  if (s.ibResearch === false) s.ibResearch = true;
  s.claimTpl = { action_name: 'claim', arguments: {} };
  s.collectTpl = '/game/town_overviews?action=collect';
  return 'orch-seeded';
})()`;

async function runOrchReplay(d) {
  const patch = loadReplayPatch();
  log('orch replay: patch', await d.evaluate(applyReplayPatchExpr(patch)));
  log('orch replay: seed', await d.evaluate(orchSeedExpr));
  log('arm:', await d.evaluate(armExpr));
  await d.evaluate(resetAjaxExpr);
  await d.evaluate(`(() => { ${T}.orchTick(); ${T}.farmTick(); return 'tick'; })()`);
  await wait(4500);
  const ajaxAfter = await d.evaluate(ajaxCountExpr);
  const jtail = jparse(await d.evaluate(journalExpr(40)), []);
  const drySkips = jtail.filter(r => String(r.r || '').startsWith('skip:dryrun')).length;
  log(`orch replay: ajax=${ajaxAfter} journal dryrun skips=${drySkips}`);
  if (+ajaxAfter !== 0) fail(`orch replay: gpAjax.ajaxPost called ${ajaxAfter} time(s) with dry-run ON`, 2);
}

// ---------------------------------------------------------------- smoke ----

async function runSmoke() {
  const version = buildAndCheck();
  const stamp = Date.now();
  const d = await launch();
  let bad = null;
  try {
    const title = await settle(d.evaluate);
    log('title:', title);

    const panel = await d.evaluate('!!document.getElementById("grepbot-panel")');
    if (panel !== true) bad = 'panel #grepbot-panel never mounted';

    // The panel prints GM_info.script.version; a mismatch means the page
    // loaded a different artifact than the one just built.
    const shown = await d.evaluate('document.querySelector("#grepbot-panel header b").textContent');
    log('panel header:', shown);
    if (!bad && String(shown).indexOf(version) < 0) {
      bad = `panel shows "${shown}", expected v${version} (GM_info stub out of sync, or stale artifact)`;
    }

    // ---- walk every tab, screenshot each ----
    const seen = [];
    for (const tab of TABS) {
      const clicked = await d.evaluate(selectTabExpr(tab));
      seen.push(`${tab}:${clicked}`);
      if (clicked !== 'shown' && !bad) bad = `tab ${tab} did not become visible (${clicked})`;
      await wait(150);
      await d.screenshot(`${stamp}-tab-${tab}`);
    }
    log('tabs:', seen.join(' '));

    // ---- internals handle ----
    const apiCount = await d.evaluate(`Object.keys(${T} || {}).length`);
    log('test exports:', apiCount);
    const hasApi = apiCount > 50;
    if (!bad && !hasApi && !noTest) {
      bad = `window.__grepbotTest has ${apiCount} keys — __grepbotTestMode was not true before the IIFE ran (smoke.html)`;
    }

    // ---- real user flow: Actions > Preflight ----
    // Seed the learned farm option map first (a returning user would have it
    // in storage; the stub cannot learn it from traffic). Without it the
    // "long farm claim" probe FAILs and the 0-FAIL assertion below is moot.
    if (hasApi) {
      await d.evaluate(`(() => { const s = ${T}.state;
        s.farmOptionMap = { 300: 0, 600: 1, 1200: 2, 2400: 3, 5400: 4, 7200: 5, 10800: 6, 14400: 7, 18000: 8, 28800: 9, 36000: 10 };
        if (s.ibResearch === false) s.ibResearch = true;
        return 'seeded'; })()`);
    }
    await d.evaluate('document.querySelector("#grepbot-panel details.gb-actions").open = true');
    await wait(100);
    await d.evaluate('document.querySelector("#grepbot-panel footer button[data-act=preflight]").click()');
    await wait(1200);
    const pre = await d.evaluate(
      '(document.querySelector("#grepbot-panel section[data-tab=stats]").innerText || "").slice(0, 4000)');
    const preShot = await d.screenshot(`${stamp}-preflight`);
    const preLines = String(pre).split('\n').filter(Boolean);
    if (preLines.length < 5 && !bad) bad = 'Preflight produced no output in the Stats tab';
    writeFileSync(join(outDir, `${stamp}-preflight.txt`), String(pre));
    log(`preflight: ${preLines.length} lines -> ${join(outDir, `${stamp}-preflight.txt`)}`);
    log('screenshot:', preShot);

    // ---- preflight verdict: 0 FAIL rows (warns allowed) ----
    // preflightRun() is read-only; re-running it here just gives structured
    // rows instead of scraping the rendered text.
    if (hasApi) {
      const rows = jparse(await d.evaluate(
        `JSON.stringify((${T}.preflightRun() || []).map(r => ({ name: r.name, ok: !!r.ok, warn: !!r.warn, detail: String(r.detail || '') })))`), []);
      const fails = rows.filter(r => !r.ok);
      const warns = rows.filter(r => r.ok && r.warn);
      log(`preflight rows: ${rows.length} total, ${fails.length} FAIL, ${warns.length} warn`);
      if (fails.length) {
        fails.forEach(f => console.error(`[driver]   FAIL ${f.name}: ${f.detail}`));
        if (!bad) bad = `preflight: ${fails.length} FAIL row(s): ${fails.map(f => f.name).join(', ')}`;
      }
    } else {
      log('preflight 0-FAIL assert: skipped (no __grepbotTest handle)');
    }

    // ---- Queue Center: separate window, four lanes ----
    const qseen = [];
    for (const q of QTABS) {
      const r = await d.evaluate(queuesExpr(q));
      qseen.push(`${q}:${r}`);
      if (r !== 'shown' && !bad) bad = `queue center lane ${q} (${r})`;
    }
    log('queue center:', qseen.join(' '));
    await d.screenshot(`${stamp}-queue-center`);

    // ---- write harness: every TX_WRITE_FEATURES key, dry run only ----
    // Last — mutates state.dryRun / enabledHosts. --notest skips it.
    if (!hasApi) {
      log('write harness: skipped (no __grepbotTest handle)');
    } else {
      await runWriteHarness(d);
      await runOrchReplay(d);
    }

    // ---- error verdict ----
    const errs = jparse(await d.evaluate(errorsExpr), []);
    if (errs.length) {
      console.error('[driver] captured page errors:\n' + JSON.stringify(errs, null, 2).slice(0, 3000));
      bad = bad || `${errs.length} page error(s); first: ${errs[0].msg || errs[0].reason || '?'}`;
    }
    writeFileSync(join(outDir, `${stamp}.dom.html`),
      await d.evaluate('document.documentElement.outerHTML'));
  } finally {
    if (!keepOpen) d.close();
  }
  if (bad) fail(bad, 2);
  log(`PASS — artifacts in ${outDir}`);
}

// ----------------------------------------------------------------- repl ----

const REPL_HELP = `commands:
  tabs                list panel tab ids
  tab <id>            click a panel sub-tab (overview attack reinforce train
                      spy intel config stats log)
  click <selector>    document.querySelector(sel).click()
  text <selector>     innerText of the first match (4k cap)
  html <selector>     outerHTML of the first match (4k cap)
  eval <js>           evaluate an expression in the page, print the value
  ss [name]           screenshot -> data/smoke/<name>.png
  errors              dump window.__SMOKE_ERRORS__
  preflight           open Actions > Preflight, print the Stats output
  queues [lane]       open the Queue Center (build research barracks docks)
  cfg <key> [value]   read/set a [data-cfg=<key>] control (fires 'change')
internals (window.__grepbotTest — needs __grepbotTestMode, see smoke.html):
  api [substr]        list exported internals, optionally filtered
  arm                 enable this host + dry run (every write needs both)
  post <feat> <json>  bridgePost through the real txRun stack; \`arm\` first
  call <name> [json]  invoke an export: call orchTick / call plannerSnapshot
  journal [n]         last n decision-memory entries
  help                this
  quit                exit`;

async function runRepl() {
  buildAndCheck();
  const d = await launch();
  log('title:', await settle(d.evaluate));
  log('panel:', await d.evaluate('document.querySelector("#grepbot-panel header b").textContent'));
  console.log(REPL_HELP);
  process.stdout.write('gb> ');

  const rl = (await import('node:readline')).createInterface({ input: process.stdin });
  for await (const line of rl) {
    const s = line.trim();
    const sp = s.indexOf(' ');
    const cmd = sp < 0 ? s : s.slice(0, sp);
    const arg = sp < 0 ? '' : s.slice(sp + 1).trim();
    try {
      if (!s) { /* noop */ }
      else if (cmd === 'quit' || cmd === 'exit') { d.close(); process.exit(0); }
      else if (cmd === 'help') console.log(REPL_HELP);
      else if (cmd === 'tabs') console.log(TABS.join(' '));
      else if (cmd === 'tab') console.log(await d.evaluate(selectTabExpr(arg)));
      else if (cmd === 'click') console.log(await d.evaluate(
        `(() => { const e = document.querySelector(${JSON.stringify(arg)}); if (!e) return 'no match'; e.click(); return 'clicked'; })()`));
      else if (cmd === 'text') console.log(await d.evaluate(
        `(document.querySelector(${JSON.stringify(arg)})||{}).innerText?.slice(0,4000) ?? 'no match'`));
      else if (cmd === 'html') console.log(await d.evaluate(
        `(document.querySelector(${JSON.stringify(arg)})||{}).outerHTML?.slice(0,4000) ?? 'no match'`));
      else if (cmd === 'eval') console.log(await d.evaluate(arg));
      else if (cmd === 'ss') console.log(await d.screenshot(arg || `repl-${Date.now()}`));
      else if (cmd === 'errors') console.log(await d.evaluate(errorsExpr));
      else if (cmd === 'queues') console.log(await d.evaluate(queuesExpr(arg)));
      else if (cmd === 'cfg') {
        const sp2 = arg.indexOf(' ');
        const key = sp2 < 0 ? arg : arg.slice(0, sp2);
        const val = sp2 < 0 ? null : arg.slice(sp2 + 1).trim();
        console.log(await d.evaluate(`(() => {
          const e = document.querySelector('#grepbot-panel [data-cfg=' + ${JSON.stringify(JSON.stringify(key))} + ']');
          if (!e) return 'no such data-cfg';
          ${val === null ? '' : `const v = ${JSON.stringify(val)};
          if (e.type === 'checkbox') e.checked = (v === 'true' || v === '1' || v === 'on'); else e.value = v;
          e.dispatchEvent(new Event('change', { bubbles: true }));
          e.dispatchEvent(new Event('input', { bubbles: true }));`}
          return e.type === 'checkbox' ? String(e.checked) : String(e.value);
        })()`));
      }
      else if (cmd === 'api') console.log(await d.evaluate(
        `Object.keys(${T} || {}).filter(k => k.toLowerCase().includes(${JSON.stringify(arg.toLowerCase())})).join('\\n') || '(none — is __grepbotTestMode set?)'`));
      else if (cmd === 'arm') console.log(await d.evaluate(armExpr));
      else if (cmd === 'post') {
        const sp2 = arg.indexOf(' ');
        if (sp2 < 0) console.log('usage: post <feature> <payload-json>');
        else console.log(await d.evaluate(postExpr(arg.slice(0, sp2), arg.slice(sp2 + 1))));
      }
      else if (cmd === 'call') {
        const sp2 = arg.indexOf(' ');
        const fn = sp2 < 0 ? arg : arg.slice(0, sp2);
        const args = sp2 < 0 ? '' : arg.slice(sp2 + 1).trim();
        console.log(await d.evaluate(
          `(() => { const f = (${T} || {})[${JSON.stringify(fn)}];
             if (typeof f !== 'function') return typeof f === 'undefined' ? 'no such export' : JSON.stringify(f);
             const r = f(...[${args}]);
             return r && typeof r.then === 'function' ? r.then(v => JSON.stringify(v)) : JSON.stringify(r ?? null); })()`));
      }
      else if (cmd === 'journal') console.log(await d.evaluate(journalExpr(Number(arg) || 5)));
      else if (cmd === 'fixture') {
        // fixture <name>: load tests/fixtures/<name>.json, run each command,
        // capture the transcript, hash it, and compare against
        // tests/fixtures/baselines.json. Catches regressions a refactor
        // would silently introduce. (REDESIGN §5.2)
        const fixturePath = join(repoRoot, 'tests', 'fixtures', arg + '.json');
        const fx = JSON.parse(readFileSync(fixturePath, 'utf8'));
        const lines = [];
        for (const step of fx.commands) {
          const c = step.cmd, a = step.arg || '';
          if (c === 'eval') lines.push('eval ' + a + '\n' + String(await d.evaluate(a)));
          else if (c === 'preflight') {
            await d.evaluate('document.querySelector("#grepbot-panel details.gb-actions").open = true');
            await d.evaluate('document.querySelector("#grepbot-panel footer button[data-act=preflight]").click()');
            await wait(1200);
            lines.push('preflight\n' + String(await d.evaluate('document.querySelector("#grepbot-panel section[data-tab=stats]").innerText.slice(0,2000)')));
          }
          else if (c === 'queues') {
            lines.push('queues ' + a + '\n' + String(await d.evaluate(queuesExpr(a))));
          }
          else if (c === 'tab') lines.push('tab ' + a + '\n' + String(await d.evaluate(selectTabExpr(a))));
          else if (c === 'arm') lines.push('arm\n' + String(await d.evaluate(armExpr)));
          else if (c === 'post') {
            const sp3 = a.indexOf(' ');
            const feature = sp3 < 0 ? a : a.slice(0, sp3);
            const payload = sp3 < 0 ? '{}' : a.slice(sp3 + 1);
            lines.push('post ' + a + '\n' + String(await d.evaluate(postExpr(feature, payload))));
          }
          else if (c === 'api') lines.push('api ' + a + '\n' + String(await d.evaluate(
            `Object.keys(${T} || {}).filter(k => k.toLowerCase().includes(${JSON.stringify(a.toLowerCase())})).join('\\n')`)));
          else if (c === 'call') {
            const sp3 = a.indexOf(' ');
            const fn = sp3 < 0 ? a : a.slice(0, sp3);
            const args = sp3 < 0 ? '' : a.slice(sp3 + 1);
            lines.push('call ' + a + '\n' + String(await d.evaluate(
              `(() => { const f = (${T} || {})[${JSON.stringify(fn)}];
                 if (typeof f !== 'function') return typeof f === 'undefined' ? 'no such export' : JSON.stringify(f);
                 const r = f(...[${args}]);
                 return r && typeof r.then === 'function' ? r.then(v => JSON.stringify(v)) : JSON.stringify(r ?? null); })()`)));
          }
          else if (c === 'wait') { await wait(Number(a) || 500); lines.push('wait ' + a); }
          else lines.push('SKIP unknown cmd: ' + c);
        }
        const crypto = await import('node:crypto');
        // Normalize volatile bits so the transcript hash is stable across
        // runs: timestamps, free-memory numbers, game-time fields that
        // change every cadence. REDESIGN §5.2.
        const normalize = (s) => s
          .replace(/\b\d{2}:\d{2}:\d{2}\b/g, '<TIME>')
          .replace(/\b\d+(\.\d+)?\s*(KB|MB|GB)\b/g, '<SIZE>')
          .replace(/\b\d{4,}\b/g, '<NUM>');
        const transcript = normalize(lines.join('\n'));
        const hash = crypto.createHash('sha256').update(transcript).digest('hex');
        const baselinePath = join(repoRoot, 'tests', 'fixtures', 'baselines.json');
        let baseline = null;
        try { baseline = JSON.parse(readFileSync(baselinePath, 'utf8')); } catch (_) {}
        const expected = baseline && baseline[arg];
        if (!expected) {
          console.log(`fixture ${arg}: transcript hash ${hash} (no baseline - R0b bootstrap, run 'fixture ${arg} --record' to capture)`);
          if (process.argv.includes('--record')) {
            baseline = baseline || {};
            baseline[arg] = hash;
            writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
            console.log(`recorded baseline for ${arg}`);
          }
        } else if (expected === hash) {
          console.log(`fixture ${arg}: PASS (sha256 ${hash.slice(0, 12)}...)`);
        } else {
          console.log(`fixture ${arg}: FAIL`);
          console.log(`  expected: ${expected}`);
          console.log(`       now: ${hash}`);
          console.log('--- transcript ---');
          console.log(transcript);
          process.exit(2);
        }
      }
      else if (cmd === 'preflight') {
        await d.evaluate('document.querySelector("#grepbot-panel details.gb-actions").open = true');
        await d.evaluate('document.querySelector("#grepbot-panel footer button[data-act=preflight]").click()');
        await wait(1200);
        console.log(await d.evaluate('document.querySelector("#grepbot-panel section[data-tab=stats]").innerText.slice(0,4000)'));
      }
      else console.log('unknown command; `help`');
    } catch (e) {
      console.error('err:', e.message);
    }
    process.stdout.write('gb> ');
  }
  d.close();
}

if (mode === 'repl') await runRepl();
else await runSmoke();
