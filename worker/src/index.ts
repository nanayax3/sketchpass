import { DrawingRoom, Env } from './room';
import { handleMcp } from './mcp';

export { DrawingRoom };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function corsResponse(body: string | null, status = 200): Response {
  return new Response(body, {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);

    // GET /room/:id — create or verify room exists, return info
    if (parts[0] === 'room' && parts[1] && !parts[2]) {
      const roomId = parts[1].toUpperCase();
      return corsResponse(JSON.stringify({ roomId }));
    }

    // GET /room/:id/ws — WebSocket upgrade
    if (parts[0] === 'room' && parts[1] && parts[2] === 'ws') {
      const roomId = parts[1].toUpperCase();
      const id = env.DRAWING_ROOM.idFromName(roomId);
      const room = env.DRAWING_ROOM.get(id);
      return room.fetch(request);
    }

    // /mcp — MCP server endpoint
    if (url.pathname === '/mcp' || url.pathname === '/mcp/') {
      return handleMcp(request, env);
    }

    // GET / — health check
    if (url.pathname === '/' || url.pathname === '') {
      return corsResponse(JSON.stringify({ ok: true, service: 'sketchpass' }));
    }

    return corsResponse(JSON.stringify({ error: 'Not found' }), 404);
  },
};
