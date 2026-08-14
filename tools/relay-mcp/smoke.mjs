// Round-trip smoke for tools/relay-mcp/dist/index.js.
// 1. Boots the wrapper. It binds 127.0.0.1:8731 and registers 41 tools.
// 2. Poses as a GrepBot tab: WS connect, hello, then respond to a status
//    command with a fake result.
// 3. Calls server.tools._tools? -- no. Instead, manually exercise the
//    relay client (relay.js) by exposing its internal send().
//
// We avoid driving through stdio JSON-RPC here (MCP Server requires a real
// MCP client); instead we directly import startRelay() and verify that the
// server->browser command path round-trips.

import WebSocket from 'ws';

const { startRelay } = await import('/media/vol/linux/Backups/j/Documents/DeV/grepbot/tools/relay-mcp/dist/relay.js');

// Test on a non-default port to dodge TIME_WAIT from earlier boots.
const TEST_PORT = 18731;
const relay = startRelay(`ws://127.0.0.1:${TEST_PORT}`, TEST_PORT);
relay.onHello((info) => console.log('[bot-side hello received]', info.url));
relay.onState((s) => console.log('[server state]', s));

// Wait for state=ready before opening the bot-side socket.
await new Promise((r) => setTimeout(r, 300));

const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`);
ws.on('open', () => {
  console.log('[bot-side ws open]');
  ws.send(JSON.stringify({ type: 'hello', kind: 'hello', payload: { ua: 'smoke-bot', url: 'https://es146.grepolis.com/', at: Date.now() } }));
  // Wait briefly for server to register hello, then issue a fake command.
  setTimeout(() => {
    ws.send(JSON.stringify({ type: 'command', id: 'smoke-1', cmd: 'status', args: {} }));
  }, 200);
});

ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  console.log('[bot-side recv]', JSON.stringify(msg));
  if (msg.type === 'command' && msg.cmd === 'status') {
    // Reply with the result the bot would have returned.
    ws.send(JSON.stringify({
      type: 'result', id: msg.id, cmd: msg.cmd, ok: true,
      data: { dryRun: false, armedMs: 0, version: 'smoke' },
    }));
  }
});

await new Promise((r) => setTimeout(r, 800));

// Now invoke the relay's send() the way the MCP server would.
const result = await relay.send('status', {}, 2000);
console.log('[server got result]', JSON.stringify(result, null, 2));

ws.close();
await relay.close();
console.log('[smoke ok]');
process.exit(0);
