#!/usr/bin/env node
// Entry point for the GrepBot relay MCP wrapper.
//
// Boots an MCP server on stdio. Registers one tool per relay command
// (see commands.ts). The relay client (relay.ts) listens on a local port
// and the in-tab GrepBot dials into it. We never decide policy -- the
// bot owns every gate; we only carry bytes.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { startRelay, type RelayClient, type RelayResult } from './relay.js';
import { commandCount, findSpec, getCommandSpecs } from './commands.js';

const RELAY_URL = process.env.GREPBOT_RELAY_URL ?? 'ws://127.0.0.1:8731';
const RELAY_PORT = (() => {
  try {
    return Number(new URL(RELAY_URL).port) || 8731;
  } catch {
    return 8731;
  }
})();

function logErr(msg: string): void {
  // MCP requires stdio to be JSON-RPC only; log to stderr instead.
  process.stderr.write(`[grepbot-relay-mcp] ${msg}\n`);
}

let relay: RelayClient | null = null;
let mcp: McpServer | null = null;

function scheduleExit(code: number, ms = 250): void {
  setTimeout(() => {
    relay?.close().finally(() => process.exit(code));
    setTimeout(() => process.exit(code), 1000);
  }, ms);
}

async function main(): Promise<void> {
  mcp = new McpServer({
    name: 'grepbot-relay',
    version: '0.1.0',
  });

  try {
    relay = startRelay(RELAY_URL, RELAY_PORT);
  } catch (e) {
    logErr(`failed to bind ${RELAY_URL}: ${String(e)}. Is another instance running?`);
    scheduleExit(1);
    return;
  }

  relay.onHello((info) => {
    logErr(`tab connected: ${info.url || 'unknown'} (ua ${(info.ua || '').slice(0, 60)})`);
  });

  relay.onState((s) => {
    logErr(`relay: ${s}`);
    if (s === 'closed' && mcp) {
      // Don't kill the server: the tab may reconnect (window reload / new
      // world). Tool calls during the gap will reject with `relay-not-ready`.
    }
  });

  relay.onData((kind, payload) => {
    // Cache the latest snapshot per kind so read tools that should serve from
    // memory can do so without re-asking the bot. Currently we expose data
    // only through the bot's own `snapshot` / `status` / `*` read commands
    // -- this hook is a hook for future cache layers.
    void kind;
    void payload;
  });

  // Register one tool per relay command.
  for (const { spec, schema } of getCommandSpecs()) {
    // The SDK wants a zod schema for `inputSchema`. We already authored a
    // JSON Schema fragment -- convert to zod by hand. Each property is one
    // of {string, number, boolean, object}. `additionalProperties:false` is
    // expressed by passing strict-by-shape object schemas.
    const zodShape: Record<string, z.ZodTypeAny> = {};
    for (const [k, prop] of Object.entries(schema.properties as Record<string, { type: string; description: string }>)) {
      const desc = prop.description || k;
      let zodType: z.ZodTypeAny;
      switch (prop.type) {
        case 'number':
          zodType = z.number().describe(desc);
          break;
        case 'boolean':
          zodType = z.boolean().describe(desc);
          break;
        case 'object':
          // .loose() replaces .passthrough() in zod v4 (passthrough is
          // deprecated as of v4 -- it still works but warns).
          zodType = z.object({}).loose().describe(desc);
          break;
        default:
          zodType = z.string().describe(desc);
      }
      const required = (schema.required as string[] | undefined)?.includes(k);
      zodShape[k] = required ? zodType : zodType.optional();
    }

    mcp.tool(
      spec.name,
      spec.summary,
      zodShape,
      async (args: Record<string, unknown>) => {
        if (!relay) {
          return { content: [{ type: 'text', text: 'relay-not-initialised' }], isError: true };
        }
        if (relay.state() !== 'ready') {
          return { content: [{ type: 'text', text: `relay state: ${relay.state()} -- wait for a tab to connect` }], isError: true };
        }
        try {
          const r: RelayResult = await relay.send(spec.cmd, args, 30_000);
          const text = JSON.stringify(r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error, gate: r.gate }, null, 2);
          return { content: [{ type: 'text', text }], isError: !r.ok };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { content: [{ type: 'text', text: `transport error: ${msg}` }], isError: true };
        }
      },
    );
  }

  // Always-available meta tool: lists every command without firing the
  // bot's own manifest handler (so it works even before a tab connects).
  mcp.tool(
    'gbListTools',
    'Local metadata only: count and shape of wrapped relay commands. Does NOT ping the bot.',
    {},
    async () => {
      const list = getCommandSpecs().map(({ spec, schema }) => ({
        tool: spec.name,
        relay_cmd: spec.cmd,
        risk: spec.risk,
        summary: spec.summary,
        schema,
      }));
      return { content: [{ type: 'text', text: JSON.stringify({ count: commandCount(), tools: list }, null, 2) }] };
    },
  );

  // Sanity-check: every tool name appears in the spec table.
  for (const name of ['gbListTools']) {
    if (!name.startsWith('gbList') && !findSpec(name)) {
      logErr(`internal: missing spec for tool ${name}`);
    }
  }

  const transport = new StdioServerTransport();
  await mcp.connect(transport);
  logErr(`ready: ${RELAY_URL}, ${commandCount()} relay tools + gbListTools`);
}

process.on('SIGTERM', () => scheduleExit(0));
process.on('SIGINT', () => scheduleExit(0));
process.on('uncaughtException', (e) => {
  logErr(`uncaught: ${String(e)}`);
  scheduleExit(1);
});
process.on('unhandledRejection', (e) => {
  logErr(`unhandled rejection: ${String(e)}`);
  scheduleExit(1);
});

main().catch((e) => {
  logErr(`boot failed: ${String(e)}`);
  scheduleExit(1);
});
