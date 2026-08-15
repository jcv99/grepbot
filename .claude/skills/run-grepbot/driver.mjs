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
//   8. arms dry run and pushes a real write through bridgePost -> txRun,
//      asserting it bails 'dryrun' and journals skip:dryrun (nothing sent)
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
const CHROME = process.env.GREPBOT_CHROME || 'chromium';

const argv = process.argv.slice(2);
const mode = argv.find(a => !a.startsWith('-')) || 'smoke';
const noBuild = argv.includes('--no-build');
const keepOpen = argv.includes('--keep-open');
// Suppress smoke.html's __grepbotTestMode, i.e. boot exactly as Tampermonkey
// does. Costs you window.__grepbotTest and everything built on it.
const noTest = argv.includes('--notest');

// Panel tab ids, in nav order (src/ui.js TAB_GROUPS).
const TABS = ['attack', 'overview', 'intel', 'config', 'stats', 'log'];
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

const journalExpr = (n) => `JSON.stringify((${T}.state.decisions || []).slice(-${n || 5}), null, 1)`;

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

    // ---- real user flow: Actions > Preflight ----
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

    // ---- internals handle ----
    const apiCount = await d.evaluate(`Object.keys(${T} || {}).length`);
    log('test exports:', apiCount);
    const hasApi = apiCount > 50;
    if (!bad && !hasApi && !noTest) {
      bad = `window.__grepbotTest has ${apiCount} keys — __grepbotTestMode was not true before the IIFE ran (smoke.html)`;
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

    // ---- real write flow, dry run: bridgePost -> txRun -> journal ----
    // Last, because it mutates state.dryRun / enabledHosts. Needs the
    // internals handle, so --notest legitimately has no write coverage.
    if (!hasApi) {
      log('dry-run post: skipped (no __grepbotTest handle)');
    } else {
      log('arm:', await d.evaluate(armExpr));
      const posted = jparse(await d.evaluate(postExpr('farm', '{ town_id: 7 }')), {});
      const jtail = jparse(await d.evaluate(journalExpr(1)), []);
      log(`dry-run post: res=${posted.res} journal=${(jtail[0] || {}).r}`);
      if (!bad && posted.res !== 'dryrun') {
        bad = `dry-run bridgePost returned "${posted.res}", expected "dryrun" — the write never reached the dry-run gate`;
      }
      if (!bad && (jtail[0] || {}).r !== 'skip:dryrun') {
        bad = `journal recorded "${(jtail[0] || {}).r}", expected "skip:dryrun"`;
      }
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
  tab <id>            click a panel sub-tab (attack overview intel config
                      stats log)
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
