# Sketchpass ✏️

A real-time collaborative drawing canvas. Draw together live, or pass the canvas back and forth. Runs entirely on Cloudflare — no database, no server to maintain.

**[Try the demo →](https://sketchpass.pages.dev)**

---

## Features

- **Live mode** — both people draw simultaneously, strokes sync in real time
- **Pass mode** — draw something, hit "Pass →", the other person adds to it and passes back
- Tools: brush, eraser, flood fill, line, rectangle, circle
- Adjustable brush size, color picker, preset palette
- Works in browser and on mobile (touch support)
- Canvas state preserved for late joiners
- **MCP server** — lets AI assistants (like Claude) draw directly using tool calls

## How it works

1. Open the app and create a room — you get a 5-character code
2. Share the code with the other person
3. Both of you draw on the same canvas

No accounts, no sign-in. Just a code.

---

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite |
| Hosting | Cloudflare Pages |
| Real-time | Cloudflare Workers + Durable Objects |
| Persistence | Durable Object storage |

Everything lives on Cloudflare. One account, no external services.

---

## Setup

### Requirements

- Node.js 18+
- A [Cloudflare account](https://cloudflare.com) (free tier works)
- Wrangler CLI: `npm install -g wrangler`

### 1. Deploy the worker

```bash
cd worker
npm install
wrangler login

# Create the KV namespace
wrangler kv:namespace create CANVAS_STORE
# → Copy the returned ID into wrangler.toml (replace REPLACE_WITH_YOUR_KV_NAMESPACE_ID)

wrangler deploy
# → Note your worker URL: https://sketchpass-worker.YOUR-SUBDOMAIN.workers.dev
```

### 2. Deploy the frontend

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env — set VITE_WORKER_URL to your worker URL from step 1

npm run build
wrangler pages project create sketchpass
wrangler pages deploy dist --project-name sketchpass
```

That's it. Your app is live at `https://sketchpass.pages.dev`.

### Local development

```bash
# Terminal 1
cd worker && npm run dev

# Terminal 2
cd frontend
echo "VITE_WORKER_URL=http://localhost:8787" > .env
npm run dev
```

---

## MCP server

Sketchpass includes an [MCP](https://modelcontextprotocol.io) server so AI assistants can draw on the canvas using tool calls.

**Endpoint:** `https://your-worker.workers.dev/mcp`

Add it as a remote MCP in your AI client (e.g. Claude.ai → Settings → Integrations).

### Available tools

| Tool | Description |
|------|-------------|
| `draw_stroke` | Draw a freehand path (array of `{x, y}` points) |
| `erase_stroke` | Erase along a path |
| `fill` | Flood fill from a point |
| `draw_shape` | Draw a line, rectangle, or circle |
| `clear_canvas` | Clear the whole canvas |

Canvas coordinates: **1200 × 800**. All tools take a `room_id` parameter.

### Example

```json
{
  "tool": "draw_stroke",
  "arguments": {
    "room_id": "AB3XY",
    "points": [{"x": 100, "y": 200}, {"x": 150, "y": 250}, {"x": 200, "y": 200}],
    "color": "#cc44ff",
    "size": 8
  }
}
```

---

## License

MIT
