// GrepBot local-relay WebSocket client.
//
// Wire (per GrepBot's src/relay.js):
//   server -> browser  {type:'command', id, cmd, args}
//   browser -> server  {type:'result',  id, cmd, ok, data?, error?, gate?}
//                     {type:'data',    kind, payload}      snapshot push
//                     {type:'ack',     kind}                ping / kind-unknown
//                     {type:'hello',   kind, payload}       sent by the tab on open
//
// We are the server-side of that socket: the in-tab bot opens an outbound
// connection to ws://127.0.0.1:8731 and we accept it. Single connection per
// process. Reconnects with backoff on close. All writes go through the bot's
// own gate ladder (relayCommands / relayRaw / arm / rate limit) -- this
// wrapper only carries bytes; we never decide policy here.

import { WebSocketServer, WebSocket } from 'ws';

export interface RelayResult {
  type: 'result';
  id: string;
  cmd: string;
  ok: boolean;
  data?: unknown;
  error?: string;
  gate?: string;
}

export interface RelayData {
  type: 'data';
  kind: string;
  payload: unknown;
}

export interface RelayAck {
  type: 'ack';
  kind: string;
}

export interface RelayHello {
  type: 'hello';
  kind: string;
  payload: Record<string, unknown>;
}

export type RelayInbound = RelayResult | RelayData | RelayAck | RelayHello;

export interface RelayHelloInfo {
  ua: string;
  url: string;
  at: number;
}

export type RelayState = 'idle' | 'connecting' | 'ready' | 'closed';

interface Pending {
  resolve: (msg: RelayResult) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
  cmd: string;
}

export interface RelayClient {
  state(): RelayState;
  send(cmd: string, args: Record<string, unknown>, timeoutMs?: number): Promise<RelayResult>;
  onData(cb: (kind: string, payload: unknown) => void): void;
  onHello(cb: (info: RelayHelloInfo) => void): void;
  onState(cb: (state: RelayState) => void): void;
  lastHello(): RelayHelloInfo | null;
  close(): Promise<void>;
}

export function startRelay(url: string, port: number): RelayClient {
  const pending = new Map<string, Pending>();
  const dataCbs: Array<(kind: string, payload: unknown) => void> = [];
  const stateCbs: Array<(state: RelayState) => void> = [];
  const helloCbs: Array<(info: RelayHelloInfo) => void> = [];
  let hello: RelayHelloInfo | null = null;
  let current: RelayState = 'idle';

  const wss = new WebSocketServer({ host: '127.0.0.1', port });
  let socket: WebSocket | null = null;
  // Track backoff for the *server-side* of the relay: the bot uses its own
  // backoff to dial in, so we keep the port open indefinitely.
  let retryNote = 0;

  function emitState(s: RelayState) {
    current = s;
    for (const cb of stateCbs) cb(s);
  }

  wss.on('connection', (s) => {
    socket = s;
    retryNote = 0;
    emitState(socket.readyState === WebSocket.OPEN ? 'ready' : 'connecting');

    s.on('message', (raw) => {
      let msg: RelayInbound;
      try {
        msg = JSON.parse(raw.toString()) as RelayInbound;
      } catch {
        return;
      }

      if (msg.type === 'result') {
        const p = pending.get(msg.id);
        if (p) {
          pending.delete(msg.id);
          clearTimeout(p.timer);
          p.resolve(msg);
        }
        return;
      }
      if (msg.type === 'data') {
        for (const cb of dataCbs) cb(msg.kind, msg.payload);
        return;
      }
      if (msg.type === 'hello') {
        hello = msg.payload as unknown as RelayHelloInfo;
        for (const cb of helloCbs) cb(hello);
        return;
      }
      // 'ack' and anything else: ignore.
    });

    s.on('close', () => {
      socket = null;
      // Reject all in-flight commands with a transport-level error so MCP
      // tool calls don't hang forever waiting for a result.
      for (const [id, p] of pending) {
        clearTimeout(p.timer);
        p.reject(new Error('relay-closed'));
      }
      pending.clear();
      emitState('closed');
    });

    s.on('error', () => {
      // Closed handler will run; nothing else needed here.
    });
  });

  wss.on('error', () => {
    // Most likely EADDRINUSE -- caller (index.ts) reports and tells the
    // user to free the port or another MCP server is already serving it.
    emitState('closed');
  });

  function send(cmd: string, args: Record<string, unknown>, timeoutMs = 30_000): Promise<RelayResult> {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('relay-not-ready'));
    }
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise<RelayResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pending.delete(id)) {
          reject(new Error(`relay-timeout:${cmd}`));
        }
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer, cmd });
      socket!.send(JSON.stringify({ type: 'command', id, cmd, args }));
    });
  }

  // Touch the URL so the unused-variable warning stays quiet, even though we
  // bind the port directly. The URL exists for future diagnostics only.
  void url;

  return {
    state: () => current,
    send,
    onData: (cb) => dataCbs.push(cb),
    onHello: (cb) => helloCbs.push(cb),
    onState: (cb) => stateCbs.push(cb),
    lastHello: () => hello,
    close: () =>
      new Promise<void>((resolve) => {
        if (socket && socket.readyState === WebSocket.OPEN) socket.close();
        wss.close(() => resolve());
      }),
  };
  // retryNote is currently unused: wss.on('connection') always accepts the
  // next tab. Reserved for future use if we ever need server-side backoff.
  void retryNote;
}
