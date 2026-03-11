export interface Env {
  DRAWING_ROOM: DurableObjectNamespace;
  CANVAS_STORE: KVNamespace;
}

interface ClientMeta {
  name: string;
  color: string;
}

export class DrawingRoom {
  private state: DurableObjectState;
  private canvasSnapshot: string | null = null;

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      this.canvasSnapshot = await this.state.storage.get<string>('canvas') ?? null;
    });
  }

  async fetch(request: Request): Promise<Response> {
    // Internal canvas fetch (from MCP handler)
    if (request.method === 'GET' && new URL(request.url).pathname.endsWith('/snapshot')) {
      return new Response(JSON.stringify({ snapshot: this.canvasSnapshot }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Internal command injection (from MCP handler)
    if (request.method === 'POST' && new URL(request.url).pathname.endsWith('/command')) {
      const cmd = await request.json() as Record<string, unknown>;
      this.broadcastAll(JSON.stringify({ ...cmd, author: cmd.author ?? 'Claude' }));
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const url = new URL(request.url);
    const name = url.searchParams.get('name') || 'Anonymous';
    const color = url.searchParams.get('color') || '#000000';

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server, ['client']);
    server.serializeAttachment({ name, color } satisfies ClientMeta);

    // Send current canvas state to new joiner
    if (this.canvasSnapshot) {
      server.send(JSON.stringify({ type: 'canvas_state', data: this.canvasSnapshot }));
    }

    // Send current room info
    const sockets = this.state.getWebSockets('client');
    const users = sockets
      .map(ws => {
        try { return ws.deserializeAttachment() as ClientMeta; }
        catch { return null; }
      })
      .filter(Boolean);

    server.send(JSON.stringify({ type: 'room_state', users, userCount: sockets.length }));

    // Notify others
    this.broadcastExcept(server, JSON.stringify({ type: 'user_joined', name, color }));

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }

    const meta = ws.deserializeAttachment() as ClientMeta;

    switch (data.type) {
      case 'draw':
        // Broadcast drawing commands to all other clients immediately
        this.broadcastExcept(ws, JSON.stringify({ ...data, author: meta.name }));
        break;

      case 'canvas_snapshot':
        // Store snapshot for late joiners (throttled by client)
        if (typeof data.data === 'string') {
          this.canvasSnapshot = data.data;
          await this.state.storage.put('canvas', this.canvasSnapshot);
        }
        break;

      case 'pass':
        // Pass the canvas to the other person
        if (typeof data.canvasData === 'string') {
          this.canvasSnapshot = data.canvasData;
          await this.state.storage.put('canvas', this.canvasSnapshot);
          this.broadcastExcept(ws, JSON.stringify({
            type: 'your_turn',
            canvasData: data.canvasData,
            from: meta.name,
          }));
        }
        break;

      case 'clear':
        this.canvasSnapshot = null;
        await this.state.storage.delete('canvas');
        this.broadcastExcept(ws, JSON.stringify({ type: 'clear', author: meta.name }));
        break;

      case 'cursor':
        // Broadcast cursor position (throttled by client)
        this.broadcastExcept(ws, JSON.stringify({ ...data, name: meta.name, color: meta.color }));
        break;
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    let meta: ClientMeta | null = null;
    try { meta = ws.deserializeAttachment() as ClientMeta; } catch { /* */ }
    if (meta) {
      this.broadcastExcept(ws, JSON.stringify({ type: 'user_left', name: meta.name }));
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  private broadcastExcept(sender: WebSocket, message: string): void {
    for (const ws of this.state.getWebSockets('client')) {
      if (ws !== sender) {
        try { ws.send(message); } catch { /* ignore closed sockets */ }
      }
    }
  }

  private broadcastAll(message: string): void {
    for (const ws of this.state.getWebSockets('client')) {
      try { ws.send(message); } catch { /* ignore closed sockets */ }
    }
  }
}
