import "dotenv/config";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

type JoinMessage = { type: "JOIN"; branchId: string };
type PublishBody = { branchId: string; message: unknown };

const WS_PORT = Number(process.env.PORT || process.env.WS_PORT || 10000);
const PUBLISH_SECRET = process.env.WS_PUBLISH_SECRET || "";

const rooms = new Map<string, Set<WebSocket>>();
const heartbeats = new WeakMap<WebSocket, boolean>();

function safeJsonParse(data: unknown) {
  if (typeof data !== "string") return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function broadcast(branchId: string, message: unknown) {
  const clients = rooms.get(branchId);
  if (!clients || clients.size === 0) return;
  const payload = JSON.stringify(message);

  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}

const server = http.createServer(async (req, res) => {
  // Health check endpoints for Render/Docker
  if (req.method === "GET" && (req.url === "/" || req.url === "/healthz")) {
    res.statusCode = 200;
    res.end("OK");
    return;
  }

  if (req.method !== "POST" || req.url !== "/publish") {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!PUBLISH_SECRET || token !== PUBLISH_SECRET) {
    res.statusCode = 401;
    res.end("Unauthorized");
    return;
  }

  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk;
  });
  req.on("end", () => {
    try {
      const body = JSON.parse(raw) as PublishBody;
      if (!body?.branchId) {
        res.statusCode = 400;
        res.end("Invalid payload");
        return;
      }
      broadcast(body.branchId, body.message);
      res.statusCode = 200;
      res.end("ok");
    } catch {
      res.statusCode = 400;
      res.end("Invalid JSON");
    }
  });
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  heartbeats.set(ws, true);
  ws.on("pong", () => {
    heartbeats.set(ws, true);
  });
});

wss.on("close", () => {
  // no-op
});

wss.on("connection", (ws) => {
  let joinedBranchId: string | null = null;

  ws.once("message", (data) => {
    const parsed = safeJsonParse(typeof data === "string" ? data : data.toString());
    const msg = parsed as JoinMessage | null;

    if (!msg || msg.type !== "JOIN" || typeof msg.branchId !== "string" || !msg.branchId) {
      ws.close();
      return;
    }

    joinedBranchId = msg.branchId;
    const set = rooms.get(joinedBranchId) ?? new Set<WebSocket>();
    set.add(ws);
    rooms.set(joinedBranchId, set);

    ws.on("close", () => {
      if (!joinedBranchId) return;
      const s = rooms.get(joinedBranchId);
      if (!s) return;
      s.delete(ws);
      if (s.size === 0) rooms.delete(joinedBranchId);
    });
  });
});

const intervalId = setInterval(() => {
  for (const ws of wss.clients) {
    const ok = heartbeats.get(ws) ?? false;
    if (!ok) {
      try {
        ws.terminate();
      } catch {
        // ignore
      }
      continue;
    }
    heartbeats.set(ws, false);
    try {
      ws.ping();
    } catch {
      // ignore
    }
  }
}, 25_000);

server.listen(WS_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[ws-server] listening on :${WS_PORT}`);
});

// Graceful shutdown handling for environments like Render / Docker
const shutdown = () => {
  // eslint-disable-next-line no-console
  console.log("[ws-server] SIGTERM signal received: closing HTTP server");
  clearInterval(intervalId);
  
  // Terminate all active WebSocket connections
  for (const ws of wss.clients) {
    try {
      ws.terminate();
    } catch {
      // ignore
    }
  }

  wss.close(() => {
    server.close(() => {
      // eslint-disable-next-line no-console
      console.log("[ws-server] HTTP server closed");
      process.exit(0);
    });
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
