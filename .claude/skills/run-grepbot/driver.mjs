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
//   7. fails on any window.error / unhandledrejection / console.error
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

// Panel tab ids, in nav order (src/ui.js TAB_GROUPS).
const TABS = ['attack', 'overview', 'intel', 'config', 'stats', 'log'];

const log = (...a) => console.log('[driver]', ...a);
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
    'file://' + smokeHtml,
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

    // ---- error verdict ----
    const errs = JSON.parse(await d.evaluate(errorsExpr) || '[]');
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
  tab <id>            click a panel sub-tab (findings farms world attack quests
                      build overview intel config stats log)
  click <selector>    document.querySelector(sel).click()
  text <selector>     innerText of the first match (4k cap)
  html <selector>     outerHTML of the first match (4k cap)
  eval <js>           evaluate an expression in the page, print the value
  ss [name]           screenshot -> data/smoke/<name>.png
  errors              dump window.__SMOKE_ERRORS__
  preflight           open Actions > Preflight, print the Stats output
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
