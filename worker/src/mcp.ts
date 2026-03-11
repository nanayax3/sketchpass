import { Env } from './room';

// MCP Streamable HTTP transport — handles JSON-RPC 2.0 requests

const SERVER_INFO = {
  name: 'sketchpass',
  version: '1.0.0',
};

const TOOLS = [
  {
    name: 'draw_stroke',
    description: 'Draw a freehand stroke on the canvas. Provide a list of {x, y} points (canvas is 1200x800).',
    inputSchema: {
      type: 'object',
      properties: {
        room_id: { type: 'string', description: 'Room code (e.g. AB3XY)' },
        points: {
          type: 'array',
          items: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
          description: 'Array of {x, y} points. Canvas is 1200 wide × 800 tall.',
        },
        color: { type: 'string', description: 'Hex color e.g. #cc44ff', default: '#000000' },
        size: { type: 'number', description: 'Brush size in pixels (1-60)', default: 8 },
        author: { type: 'string', description: 'Name shown on canvas', default: 'Claude' },
      },
      required: ['room_id', 'points'],
    },
  },
  {
    name: 'fill',
    description: 'Flood fill an area of the canvas starting from a point.',
    inputSchema: {
      type: 'object',
      properties: {
        room_id: { type: 'string' },
        x: { type: 'number', description: 'X coordinate (0-1200)' },
        y: { type: 'number', description: 'Y coordinate (0-800)' },
        color: { type: 'string', description: 'Hex fill color', default: '#000000' },
        author: { type: 'string', default: 'Claude' },
      },
      required: ['room_id', 'x', 'y'],
    },
  },
  {
    name: 'draw_shape',
    description: 'Draw a shape (line, rect, or circle) on the canvas.',
    inputSchema: {
      type: 'object',
      properties: {
        room_id: { type: 'string' },
        shape: { type: 'string', enum: ['line', 'rect', 'circle'] },
        x1: { type: 'number' }, y1: { type: 'number' },
        x2: { type: 'number' }, y2: { type: 'number' },
        color: { type: 'string', default: '#000000' },
        size: { type: 'number', default: 4 },
        author: { type: 'string', default: 'Claude' },
      },
      required: ['room_id', 'shape', 'x1', 'y1', 'x2', 'y2'],
    },
  },
  {
    name: 'get_canvas',
    description: 'Get the current canvas as a base64 PNG image so you can see what has been drawn.',
    inputSchema: {
      type: 'object',
      properties: {
        room_id: { type: 'string', description: 'Room code (e.g. AB3XY)' },
      },
      required: ['room_id'],
    },
  },
  {
    name: 'erase_stroke',
    description: 'Erase part of the canvas along a path of points.',
    inputSchema: {
      type: 'object',
      properties: {
        room_id: { type: 'string' },
        points: {
          type: 'array',
          items: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
        },
        size: { type: 'number', description: 'Eraser size in pixels (1-60)', default: 20 },
        author: { type: 'string', default: 'Claude' },
      },
      required: ['room_id', 'points'],
    },
  },
  {
    name: 'clear_canvas',
    description: 'Clear the entire canvas.',
    inputSchema: {
      type: 'object',
      properties: {
        room_id: { type: 'string' },
        author: { type: 'string', default: 'Claude' },
      },
      required: ['room_id'],
    },
  },
];

async function injectCommand(env: Env, roomId: string, cmd: object): Promise<void> {
  const id = env.DRAWING_ROOM.idFromName(roomId.toUpperCase());
  const room = env.DRAWING_ROOM.get(id);
  await room.fetch(new Request(`https://internal/room/${roomId}/command`, {
    method: 'POST',
    body: JSON.stringify(cmd),
    headers: { 'Content-Type': 'application/json' },
  }));
}

async function handleToolCall(env: Env, name: string, args: Record<string, unknown>): Promise<string> {
  const roomId = String(args.room_id ?? '').toUpperCase();
  if (!roomId) return 'Error: room_id is required';
  const author = String(args.author ?? 'Claude');

  switch (name) {
    case 'get_canvas': {
      const id = env.DRAWING_ROOM.idFromName(roomId);
      const room = env.DRAWING_ROOM.get(id);
      const res = await room.fetch(new Request(`https://internal/room/${roomId}/snapshot`));
      const { snapshot } = await res.json() as { snapshot: string | null };
      if (!snapshot) return 'Canvas is empty — nothing has been drawn yet.';
      // Return as image content so Claude can actually see it
      const base64 = snapshot.replace(/^data:image\/png;base64,/, '');
      return { type: 'image', data: base64, mimeType: 'image/png' } as unknown as string;
    }

    case 'draw_stroke': {
      const points = args.points as Array<{ x: number; y: number }>;
      if (!points?.length) return 'Error: points array is empty';

      // Send as a stroke sequence
      await injectCommand(env, roomId, {
        type: 'draw', tool: 'brush', phase: 'start',
        x: points[0].x, y: points[0].y,
        color: args.color ?? '#000000', size: args.size ?? 8, author,
      });
      for (let i = 1; i < points.length; i++) {
        await injectCommand(env, roomId, {
          type: 'draw', tool: 'brush', phase: 'move',
          x: points[i].x, y: points[i].y,
          color: args.color ?? '#000000', size: args.size ?? 8, author,
        });
      }
      await injectCommand(env, roomId, {
        type: 'draw', tool: 'brush', phase: 'end',
        x: points[points.length - 1].x, y: points[points.length - 1].y,
        color: args.color ?? '#000000', size: args.size ?? 8, author,
      });
      return `Drew stroke with ${points.length} points in room ${roomId}`;
    }

    case 'fill': {
      await injectCommand(env, roomId, {
        type: 'draw', tool: 'fill',
        x: args.x, y: args.y,
        color: args.color ?? '#000000', size: 1, author,
      });
      return `Filled at (${args.x}, ${args.y}) with ${args.color} in room ${roomId}`;
    }

    case 'draw_shape': {
      await injectCommand(env, roomId, {
        type: 'draw', tool: args.shape,
        x1: args.x1, y1: args.y1, x2: args.x2, y2: args.y2,
        color: args.color ?? '#000000', size: args.size ?? 4, author,
      });
      return `Drew ${args.shape} in room ${roomId}`;
    }

    case 'erase_stroke': {
      const points = args.points as Array<{ x: number; y: number }>;
      if (!points?.length) return 'Error: points array is empty';
      await injectCommand(env, roomId, {
        type: 'draw', tool: 'eraser', phase: 'start',
        x: points[0].x, y: points[0].y,
        color: '#ffffff', size: args.size ?? 20, author,
      });
      for (let i = 1; i < points.length; i++) {
        await injectCommand(env, roomId, {
          type: 'draw', tool: 'eraser', phase: 'move',
          x: points[i].x, y: points[i].y,
          color: '#ffffff', size: args.size ?? 20, author,
        });
      }
      await injectCommand(env, roomId, {
        type: 'draw', tool: 'eraser', phase: 'end',
        x: points[points.length - 1].x, y: points[points.length - 1].y,
        color: '#ffffff', size: args.size ?? 20, author,
      });
      return `Erased stroke with ${points.length} points in room ${roomId}`;
    }

    case 'clear_canvas': {
      await injectCommand(env, roomId, { type: 'clear', author });
      return `Cleared canvas in room ${roomId}`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

export async function handleMcp(request: Request, env: Env): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // SSE stream for initialize (some clients expect GET)
  if (request.method === 'GET') {
    return new Response(JSON.stringify({ server: SERVER_INFO, tools: TOOLS }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  let body: { jsonrpc: string; id: unknown; method: string; params?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { id, method, params = {} } = body;

  function ok(result: unknown) {
    return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  function err(code: number, message: string) {
    return new Response(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  switch (method) {
    case 'initialize':
      return ok({
        protocolVersion: '2024-11-05',
        serverInfo: SERVER_INFO,
        capabilities: { tools: {} },
      });

    case 'notifications/initialized':
      return new Response(null, { status: 204, headers: corsHeaders });

    case 'tools/list':
      return ok({ tools: TOOLS });

    case 'tools/call': {
      const toolName = params.name as string;
      const toolArgs = (params.arguments ?? {}) as Record<string, unknown>;
      try {
        const result = await handleToolCall(env, toolName, toolArgs);
        if (typeof result === 'object' && result !== null && 'type' in result && (result as {type:string}).type === 'image') {
          const img = result as { type: string; data: string; mimeType: string };
          return ok({ content: [{ type: 'image', data: img.data, mimeType: img.mimeType }] });
        }
        return ok({ content: [{ type: 'text', text: result as string }] });
      } catch (e) {
        return err(-32603, String(e));
      }
    }

    default:
      return err(-32601, `Method not found: ${method}`);
  }
}
