/**
 * src/ws.js — Motor de colaboração em tempo real
 *
 * Protocolo de mensagens (JSON):
 *   Cliente → Servidor:
 *     { type: "join",   canvasId }
 *     { type: "patch",  canvasId, nodes }
 *     { type: "ping" }
 *
 *   Servidor → Cliente:
 *     { type: "patch",  nodes, from }   ← broadcast para outros membros
 *     { type: "joined", canvasId, members }
 *     { type: "members", count }
 *     { type: "pong" }
 *     { type: "error",  message }
 */

const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const { Nodes, Canvases, Shares } = require("./db");

// canvasRooms: Map<canvasId, Set<WebSocket>>
const canvasRooms = new Map();

function getRoom(canvasId) {
  if (!canvasRooms.has(canvasId)) canvasRooms.set(canvasId, new Set());
  return canvasRooms.get(canvasId);
}

function broadcast(canvasId, message, excludeWs = null) {
  const room = getRoom(canvasId);
  const payload = JSON.stringify(message);
  for (const client of room) {
    if (client !== excludeWs && client.readyState === 1) {
      client.send(payload);
    }
  }
}

function broadcastMemberCount(canvasId) {
  const count = getRoom(canvasId).size;
  broadcast(canvasId, { type: "members", count });
}

function formatNodes(rows) {
  return rows.map((r) => ({
    id:        r.id,
    title:     r.title,
    x:         r.x,
    y:         r.y,
    priority:  r.priority,
    completed: r.completed === 1,
    parentId:  r.parent_id || null,
    dueDate:   r.due_date  || null,
  }));
}

function resolveCanvasAccess(canvasId, token, userId) {
  // Dono do canvas
  if (userId) {
    const canvas = Canvases.findById.get(canvasId, userId);
    if (canvas) return { canvas, mode: "edit" };
  }
  // Link de compartilhamento
  if (token) {
    const share = Shares.findByToken.get(token);
    if (share && share.canvas_id === canvasId) {
      const canvas = Canvases.findByIdAny.get(canvasId);
      if (canvas) return { canvas, mode: share.mode };
    }
  }
  return null;
}

function initWebSocket(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    ws.canvasId  = null;
    ws.userId    = null;
    ws.mode      = "view";
    ws.isAlive   = true;

    // Tenta extrair JWT da query string: /ws?token=...
    const url    = new URL(req.url, "http://localhost");
    const rawJwt = url.searchParams.get("jwt");
    const shareToken = url.searchParams.get("share");

    if (rawJwt) {
      try {
        const payload = jwt.verify(rawJwt, process.env.JWT_SECRET);
        ws.userId = payload.sub;
      } catch {}
    }
    ws.shareToken = shareToken || null;

    ws.on("pong", () => { ws.isAlive = true; });

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      switch (msg.type) {

        // ── Entrar num canvas ─────────────────────────
        case "join": {
          const canvasId = msg.canvasId;
          if (!canvasId) return;

          const access = resolveCanvasAccess(canvasId, ws.shareToken, ws.userId);
          if (!access) {
            ws.send(JSON.stringify({ type: "error", message: "Acesso negado ao canvas." }));
            return;
          }

          // Sai do canvas anterior se houver
          if (ws.canvasId && ws.canvasId !== canvasId) {
            getRoom(ws.canvasId).delete(ws);
            broadcastMemberCount(ws.canvasId);
          }

          ws.canvasId = canvasId;
          ws.mode     = access.mode;
          getRoom(canvasId).add(ws);

          // Envia estado atual do canvas
          const nodes = formatNodes(Nodes.findByCanvas.all(canvasId));
          ws.send(JSON.stringify({
            type:    "joined",
            canvasId,
            nodes,
            mode:    ws.mode,
            members: getRoom(canvasId).size,
          }));

          broadcastMemberCount(canvasId);
          break;
        }

        // ── Salvar e transmitir patch ─────────────────
        case "patch": {
          if (!ws.canvasId) return;
          if (ws.mode !== "edit") {
            ws.send(JSON.stringify({ type: "error", message: "Sem permissão de edição." }));
            return;
          }

          const { nodes } = msg;
          if (!Array.isArray(nodes)) return;

          // Persiste no banco
          Nodes.replaceAll(ws.canvasId, nodes);
          Canvases.touch.run(ws.canvasId);

          // Transmite para outros membros do canvas
          broadcast(ws.canvasId, {
            type:  "patch",
            nodes: formatNodes(Nodes.findByCanvas.all(ws.canvasId)),
            from:  ws.userId || "anonymous",
          }, ws);

          break;
        }

        case "ping":
          ws.send(JSON.stringify({ type: "pong" }));
          break;
      }
    });

    ws.on("close", () => {
      if (ws.canvasId) {
        getRoom(ws.canvasId).delete(ws);
        broadcastMemberCount(ws.canvasId);
        // Limpa sala vazia
        if (getRoom(ws.canvasId).size === 0) {
          canvasRooms.delete(ws.canvasId);
        }
      }
    });

    ws.on("error", () => {});
  });

  // Heartbeat — desconecta zumbis a cada 30s
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) { ws.terminate(); return; }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on("close", () => clearInterval(heartbeat));

  console.log("  WebSocket pronto em /ws");
  return wss;
}

module.exports = { initWebSocket };
