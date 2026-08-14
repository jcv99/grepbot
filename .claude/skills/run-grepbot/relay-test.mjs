// End-to-end test for the GrepBot AI command channel (src/relay.js).
//
//   node .claude/skills/run-grepbot/relay-test.mjs
//
// What it does:
//   1. serves the repo over HTTP so the page URL contains "/game/" --
//      relay.js's isWorldPage() gate refuses to boot on anything else, which
//      is why the plain smoke driver reports "relay module not booted".
//   2. runs a WebSocket server on 127.0.0.1:8731 (the port relay.js dials).
//   3. boots the built artifact in headless Chromium over CDP.
//   4. drives the Config checkboxes through the real DOM, then sends
//      {type:'command'} frames and asserts the gate ladder.
//
// Node 22 built-ins only (http, crypto, net, child_process, global WebSocket
// for CDP) plus the system chromium -- same contract as driver.mjs. There is
// no WebSocket *server* in Node, so a minimal RFC6455 one lives below.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const smokeHtml = join(here, 'smoke.html');
const artifact = join(repo, 'grepbot.user.js');
const CHROME = process.env.GREPBOT_CHROME || 'chromium';
const RELAY_PORT = 8731;

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('[relay-test]', ...a);

let failures = 0;
function check(name, cond, detail) {
  if (cond) { log(`  PASS ${name}`); return true; }
  failures++;
  log(`  FAIL ${name}${detail ? ' -- ' + detail : ''}`);
  return false;
}

// ------------------------------------------------------- minimal WS server --
// Text frames only, server never masks, client always does. Handles 7/16/64
// bit payload lengths and continuation frames: the browser's `map` snapshot
// is comfortably over the 125-byte short form and can exceed 64 KB.
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function startWsServer(port, onMessage) {
  const clients = new Set();
  const srv = createServer((req, res) => { res.writeHead(426); res.end(); });

  srv.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    const accept = createHash('sha1').update(key + WS_GUID).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    socket.setNoDelay(true);
    clients.add(socket);

    let buf = Buffer.alloc(0);
    let fragOp = 0;
    let fragParts = [];

    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        if (buf.length < 2) return;
        const b0 = buf[0], b1 = buf[1];
        const fin = (b0 & 0x80) !== 0;
        const opcode = b0 & 0x0f;
        const masked = (b1 & 0x80) !== 0;
        let len = b1 & 0x7f;
        let off = 2;
        if (len === 126) { if (buf.length < off + 2) return; len = buf.readUInt16BE(off); off += 2; }
        else if (len === 127) { if (buf.length < off + 8) return; len = Number(buf.readBigUInt64BE(off)); off += 8; }
        let mask = null;
        if (masked) { if (buf.length < off + 4) return; mask = buf.subarray(off, off + 4); off += 4; }
        if (buf.length < off + len) return;
        const body = Buffer.from(buf.subarray(off, off + len));
        if (mask) for (let i = 0; i < body.length; i++) body[i] ^= mask[i % 4];
        buf = buf.subarray(off + len);

        if (opcode === 0x8) { try { socket.end(); } catch (_) {} clients.delete(socket); return; }
        if (opcode === 0x9) { socket.write(frame(body, 0xA)); continue; }
        if (opcode === 0xA) continue;

        if (opcode === 0x0) fragParts.push(body);
        else { fragOp = opcode; fragParts = [body]; }
        if (!fin) continue;
        const full = Buffer.concat(fragParts);
        fragParts = [];
        if (fragOp !== 0x1) continue;
        let msg = null;
        try { msg = JSON.parse(full.toString('utf8')); } catch (_) { continue; }
        try { onMessage(msg, socket); } catch (e) { log('onMessage threw', e.message); }
      }
    });

    socket.on('error', () => { clients.delete(socket); });
    socket.on('close', () => { clients.delete(socket); });
  });

  function frame(payload, opcode = 0x1) {
    const body = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8');
    const n = body.length;
    let head;
    if (n < 126) { head = Buffer.alloc(2); head[1] = n; }
    else if (n < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(n, 2); }
    else { head = Buffer.alloc(10); head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2); }
    head[0] = 0x80 | opcode;
    return Buffer.concat([head, body]);
  }

  const send = (obj) => {
    const f = frame(JSON.stringify(obj));
    for (const c of clients) { try { c.write(f); } catch (_) {} }
  };

  return new Promise((res, rej) => {
    srv.on('error', rej);
    srv.listen(port, '127.0.0.1', () => res({
      send,
      clientCount: () => clients.size,
      close: () => { for (const c of clients) { try { c.destroy(); } catch (_) {} } srv.close(); },
    }));
  });
}

// ------------------------------------------------------------ HTTP server --
// relay.js only boots when location.href matches /\/game\//, so the page must
// be served under that path. Everything else is served from the repo root so
// smoke.html's relative "../../../grepbot.user.js" resolves.
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };

function startHttpServer() {
  const srv = createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let file;
    if (url === '/game/smoke.html') file = smokeHtml;
    else if (url === '/grepbot.user.js') file = artifact;
    else file = join(repo, url.replace(/^\/+/, ''));
    if (!existsSync(file) || !file.startsWith(repo) && file !== smokeHtml) {
      res.writeHead(404); res.end('nope'); return;
    }
    try {
      const body = readFileSync(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch (e) { res.writeHead(500); res.end(String(e)); }
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r({ port: srv.address().port, close: () => srv.close() })));
}

// -------------------------------------------------------------------- CDP --
async function launch(pageUrl) {
  const profile = join(tmpdir(), `grepbot-relay-${process.pid}`);
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(profile, { recursive: true });

  const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--window-size=1280,800', '--disable-web-security',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, pageUrl,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let err = '';
  proc.stderr.on('data', c => { err += c; });

  const portFile = join(profile, 'DevToolsActivePort');
  let port = null;
  for (let i = 0; i < 80 && port === null; i++) {
    await wait(125);
    if (existsSync(portFile)) {
      const p = readFileSync(portFile, 'utf8').split('\n')[0].trim();
      if (p) port = Number(p);
    }
  }
  if (!port) throw new Error(`chromium never wrote DevToolsActivePort\n${err.slice(0, 800)}`);

  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await wait(125);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
    } catch (_) { /* not ready */ }
  }
  if (!target) throw new Error('no CDP page target');

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
    const i = ++id; pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression: `(() => { try { return (${expression}); } catch (e) { return '__ERR__' + e.message; } })()`,
      returnByValue: true, awaitPromise: true,
    });
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  return {
    evaluate,
    close: () => { try { ws.close(); } catch (_) {} proc.kill('SIGKILL'); rmSync(profile, { recursive: true, force: true }); },
  };
}

// ------------------------------------------------------------------- main --
const results = new Map();
let seq = 0;

function makeCommandSender(relay) {
  return function cmd(name, args, timeoutMs = 8000) {
    const id = ++seq;
    return new Promise((res) => {
      const t = setTimeout(() => { results.delete(id); res({ __timeout: true }); }, timeoutMs);
      results.set(id, (r) => { clearTimeout(t); res(r); });
      relay.send({ type: 'command', id, cmd: name, args: args || {} });
    });
  };
}

// Drive a Config control through the real DOM: this covers the ui.js wiring
// (data-cfg -> state -> STORE) in the same pass, instead of poking state.
const setCfg = (key, on) => `(() => {
  const el = document.querySelector('#grepbot-panel [data-cfg="${key}"]');
  if (!el) return 'missing';
  el.checked = ${on ? 'true' : 'false'};
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return 'ok';
})()`;

const clickCfg = (key) => `(() => {
  const el = document.querySelector('#grepbot-panel [data-cfg="${key}"]');
  if (!el) return 'missing';
  el.click();
  return 'ok';
})()`;

async function main() {
  if (!existsSync(artifact)) throw new Error(`missing artifact: ${artifact} (run python3 build.py)`);

  let hello = null;
  const relay = await startWsServer(RELAY_PORT, (msg) => {
    if (msg.type === 'hello') hello = msg;
    if (msg.type === 'result' && results.has(msg.id)) { results.get(msg.id)(msg); results.delete(msg.id); }
  });
  log(`ws server on 127.0.0.1:${RELAY_PORT}`);

  const http = await startHttpServer();
  const pageUrl = `http://127.0.0.1:${http.port}/game/smoke.html`;
  log(`page ${pageUrl}`);

  const d = await launch(pageUrl);
  const cmd = makeCommandSender(relay);

  try {
    // relay.js defers its first connect by 1500ms after boot.
    for (let i = 0; i < 60 && !hello; i++) await wait(250);
    check('browser connected to relay', !!hello, 'no hello frame');
    if (!hello) return;

    const panel = await d.evaluate("!!document.querySelector('#grepbot-panel')");
    check('panel mounted', panel === true, String(panel));

    // -- read commands work with everything still OFF ---------------------
    let r = await cmd('manifest');
    check('manifest before enable is refused', r.ok === false && r.error === 'commands-off', JSON.stringify(r).slice(0, 200));

    check('enable host', (await d.evaluate(setCfg('enabled-host', true))) === 'ok');
    check('enable relay commands', (await d.evaluate(setCfg('relay-commands', true))) === 'ok');
    await wait(200);

    r = await cmd('manifest');
    const names = r.ok && r.data && r.data.commands ? r.data.commands.map(c => c.name) : [];
    check('manifest lists commands', r.ok === true && names.length > 20, `${names.length} commands`);
    check('manifest carries risk classes', r.ok === true && r.data.commands.every(c => /^(read|write|raw)$/.test(c.risk)));

    r = await cmd('status');
    check('status is a read command', r.ok === true && r.data && r.data.commandsEnabled === true, JSON.stringify(r).slice(0, 200));
    check('status reports not armed', r.ok === true && r.data.armedMs === 0, `armedMs=${r.ok && r.data.armedMs}`);

    r = await cmd('unknown_thing');
    check('unknown command rejected', r.ok === false && r.error === 'unknown-cmd', JSON.stringify(r).slice(0, 120));

    // -- write refused while disarmed -------------------------------------
    r = await cmd('kick', { scan: 'orch' });
    check('write refused while disarmed', r.ok === false && r.error === 'not-armed', JSON.stringify(r).slice(0, 120));

    // -- raw refused even when armed --------------------------------------
    check('click Armar IA', (await d.evaluate(clickCfg('relay-arm'))) === 'ok');
    await wait(200);
    r = await cmd('status');
    check('arm window is open', r.ok === true && r.data.armedMs > 0, `armedMs=${r.ok && r.data.armedMs}`);

    r = await cmd('bridge', { model_url: 'Town/1', action_name: 'noop', arguments: {}, town_id: 1 });
    check('raw refused while relayRaw OFF', r.ok === false && r.error === 'raw-off', JSON.stringify(r).slice(0, 120));

    // -- armed write executes ---------------------------------------------
    r = await cmd('kick', { scan: 'orch' });
    check('armed write executes', r.ok === true && r.data && r.data.kicked === 'orch', JSON.stringify(r).slice(0, 200));

    // The gate ladder runs before a command validates its own arguments, so
    // these two must clear the min-gap window first or they only ever prove
    // the rate limiter works (which the next check does deliberately).
    await wait(4200);
    r = await cmd('kick', { scan: 'not_a_scan' });
    check('unknown scan rejected', r.ok === false && r.error === 'unknown-scan', JSON.stringify(r).slice(0, 120));

    await wait(4200);
    r = await cmd('toggle', { key: 'dryRun', value: false });
    check('guard flags are not toggleable', r.ok === false && r.error === 'unknown-toggle', JSON.stringify(r).slice(0, 120));

    // A rejected command must NOT consume the write budget: both of the above
    // were refused, so a real write still goes through immediately after.
    await wait(4200);
    const a = await cmd('toggle', { key: 'autoFarm', value: false });
    check('rejected commands do not burn the min-gap', a.ok === true, JSON.stringify(a).slice(0, 160));
    const b = await cmd('toggle', { key: 'autoFarm', value: false });
    check('min-gap rate limit', b.ok === false && b.error === 'rate-limited', JSON.stringify(b).slice(0, 120));

    // -- raw passthrough once enabled -------------------------------------
    check('enable relay raw', (await d.evaluate(setCfg('relay-raw', true))) === 'ok');
    await wait(4200);   // clear the min-gap window
    r = await cmd('bridge', { model_url: 'Town/1', action_name: 'noop', arguments: { x: 1 }, town_id: 1 }, 30000);
    check('raw reaches the transport once enabled', r.ok === true || (r.error && r.error !== 'raw-off'),
      JSON.stringify(r).slice(0, 200));

    // -- disarm closes the window -----------------------------------------
    check('click Desarmar', (await d.evaluate(clickCfg('relay-disarm'))) === 'ok');
    await wait(200);
    r = await cmd('kick', { scan: 'orch' });
    check('write refused after disarm', r.ok === false && r.error === 'not-armed', JSON.stringify(r).slice(0, 120));

    // -- master toggle OFF also slams the window shut ---------------------
    check('re-enable + re-arm', (await d.evaluate(clickCfg('relay-arm'))) === 'ok');
    check('disable relay commands', (await d.evaluate(setCfg('relay-commands', false))) === 'ok');
    await wait(200);
    r = await cmd('status');
    check('master OFF refuses even reads', r.ok === false && r.error === 'commands-off', JSON.stringify(r).slice(0, 120));
    check('re-enable relay commands', (await d.evaluate(setCfg('relay-commands', true))) === 'ok');
    await wait(200);
    r = await cmd('status');
    check('re-enabling does NOT restore the old arm window',
      r.ok === true && r.data.armedMs === 0, `armedMs=${r.ok && r.data.armedMs}`);

    const errs = await d.evaluate('JSON.stringify(window.__SMOKE_ERRORS__ || [])');
    check('no page errors', errs === '[]', String(errs).slice(0, 400));
  } finally {
    d.close();
    relay.close();
    http.close();
  }
}

main().then(() => {
  if (failures) { log(`FAIL — ${failures} check(s) failed`); process.exit(1); }
  log('PASS — all checks green');
  process.exit(0);
}).catch(e => {
  log('ERROR', e && e.stack || String(e));
  process.exit(1);
});
