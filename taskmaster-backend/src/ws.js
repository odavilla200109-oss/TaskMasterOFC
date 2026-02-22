/**
 * src/ws.js — v3
 * Suporte a canvas de tipo 'task' e 'brain'.
 * Brain nodes: patch via { type: "brain-patch", nodes }
 */
const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const { Nodes, BrainNodes, Canvases, Shares } = require("./db");
const { formatNodes, formatBrainNodes } = require("./utils/formatNodes");

const canvasRooms = new Map();

function getRoom(canvasId) {
  if (!canvasRooms.has(canvasId)) canvasRooms.set(canvasId, new Set());
  return canvasRooms.get(canvasId);
}

function broadcast(canvasId, message, excludeWs = null) {
  const room    = getRoom(canvasId);
  const payload = JSON.stringify(message);
  for (const client of room) {
    if (client !== excludeWs && client.readyState === 1)
      client.send(payload);
  }
}

function broadcastMemberCount(canvasId) {
  broadcast(canvasId, { type: "members", count: getRoom(canvasId).size });
}

function resolveCanvasAccess(canvasId, shareToken, userId) {
  if (userId) {
    const canvas = Canvases.findById.get(canvasId, userId);
    if (canvas) return { canvas, mode: "edit" };
  }
  if (shareToken) {
    const share = Shares.findByToken.get(shareToken);
    if (share && share.canvas_id === canvasId && !Shares.isExpired(share)) {
      const canvas = Canvases.findByIdAny.get(canvasId);
      if (canvas) return { canvas, mode: share.mode };
    }
  }
  return null;
}

function initWebSocket(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    ws.canvasId   = null;
    ws.userId     = null;
    ws.mode       = "view";
    ws.isAlive    = true;
    ws.editUnlocked = false; // senha de edição verificada

    const url        = new URL(req.url, "http://localhost");
    const rawJwt     = url.searchParams.get("jwt");
    const shareToken = url.searchParams.get("share");

    if (rawJwt) {
      try {
        const payload = jwt.verify(rawJwt, process.env.JWT_SECRET);
        ws.userId = payload.sub;
      } catch (_) {}
    }
    ws.shareToken = shareToken || null;

    ws.on("pong", () => { ws.isAlive = true; });

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      switch (msg.type) {

        case "join": {
          const canvasId = msg.canvasId;
          if (!canvasId) return;

          const access = resolveCanvasAccess(canvasId, ws.shareToken, ws.userId);
          if (!access) {
            ws.send(JSON.stringify({ type: "error", message: "Acesso negado ao canvas." }));
            return;
          }

          if (ws.canvasId && ws.canvasId !== canvasId) {
            getRoom(ws.canvasId).delete(ws);
            broadcastMemberCount(ws.canvasId);
          }

          ws.canvasId = canvasId;
          ws.mode     = access.mode;
          getRoom(canvasId).add(ws);

          const isBrain  = access.canvas.type === "brain";
          const nodes    = isBrain ? [] : formatNodes(Nodes.findByCanvas.all(canvasId));
          const brainNodes = isBrain ? formatBrainNodes(BrainNodes.findByCanvas.all(canvasId)) : [];

          ws.send(JSON.stringify({
            type: "joined", canvasId,
            nodes, brainNodes,
            canvasType: access.canvas.type,
            mode:    ws.mode,
            members: getRoom(canvasId).size,
          }));

          broadcastMemberCount(canvasId);
          break;
        }

        // Patch de task nodes
        case "patch": {
          if (!ws.canvasId) return;
          if (ws.mode !== "edit") {
            ws.send(JSON.stringify({ type: "error", message: "Sem permissão de edição." }));
            return;
          }
          const { nodes } = msg;
          if (!Array.isArray(nodes) || nodes.length > 500) return;

          Nodes.replaceAll(ws.canvasId, nodes);
          Canvases.touch.run(ws.canvasId);

          broadcast(ws.canvasId, {
            type:  "patch",
            nodes: formatNodes(Nodes.findByCanvas.all(ws.canvasId)),
            from:  ws.userId || "anonymous",
          }, ws);
          break;
        }

        // Patch de brain nodes
        case "brain-patch": {
          if (!ws.canvasId) return;
          if (ws.mode !== "edit") {
            ws.send(JSON.stringify({ type: "error", message: "Sem permissão de edição." }));
            return;
          }
          const { nodes: bNodes } = msg;
          if (!Array.isArray(bNodes) || bNodes.length > 500) return;

          BrainNodes.replaceAll(ws.canvasId, bNodes);
          Canvases.touch.run(ws.canvasId);

          broadcast(ws.canvasId, {
            type:       "brain-patch",
            brainNodes: formatBrainNodes(BrainNodes.findByCanvas.all(ws.canvasId)),
            from:       ws.userId || "anonymous",
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
        if (getRoom(ws.canvasId).size === 0)
          canvasRooms.delete(ws.canvasId);
      }
    });

    ws.on("error", () => {});
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) { ws.terminate(); return; }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on("close", () => clearInterval(heartbeat));
  console.log("  WebSocket v3 pronto em /ws");
  return wss;
}

module.exports = { initWebSocket };
