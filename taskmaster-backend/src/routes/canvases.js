/**
 * src/routes/canvases.js
 */
const express  = require("express");
const { randomUUID, randomBytes } = require("crypto");
const { Canvases, Nodes, Shares } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

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

function requireCanvas(req, res, next) {
  const canvas = Canvases.findById.get(req.params.id, req.user.id);
  if (!canvas) return res.status(404).json({ error: "Canvas não encontrado." });
  req.canvas = canvas;
  next();
}

router.use(requireAuth);

// GET /api/canvases
router.get("/", (req, res) => {
  res.json(Canvases.findByUser.all(req.user.id));
});

// POST /api/canvases
router.post("/", (req, res) => {
  const name   = (req.body.name || "Novo Canvas").slice(0, 100);
  const canvas = Canvases.create.get({ id: randomUUID(), user_id: req.user.id, name });
  res.status(201).json(canvas);
});

// PATCH /api/canvases/:id
router.patch("/:id", requireCanvas, (req, res) => {
  const name = (req.body.name || "").slice(0, 100);
  if (!name) return res.status(400).json({ error: "Nome obrigatório." });
  const updated = Canvases.rename.get({ id: req.params.id, user_id: req.user.id, name });
  res.json(updated);
});

// DELETE /api/canvases/:id
router.delete("/:id", requireCanvas, (req, res) => {
  Canvases.delete.run(req.params.id, req.user.id);
  res.json({ message: "Canvas excluído." });
});

// GET /api/canvases/:id/nodes
router.get("/:id/nodes", requireCanvas, (req, res) => {
  res.json(formatNodes(Nodes.findByCanvas.all(req.canvas.id)));
});

// PUT /api/canvases/:id/nodes
router.put("/:id/nodes", requireCanvas, (req, res) => {
  const { nodes } = req.body;
  if (!Array.isArray(nodes)) return res.status(400).json({ error: "nodes deve ser array." });
  Nodes.replaceAll(req.canvas.id, nodes);
  Canvases.touch.run(req.canvas.id);
  res.json({ saved: nodes.length });
});

// GET /api/canvases/:id/shares
router.get("/:id/shares", requireCanvas, (req, res) => {
  res.json(Shares.findByCanvas.all(req.canvas.id));
});

// POST /api/canvases/:id/shares
router.post("/:id/shares", requireCanvas, (req, res) => {
  const mode  = req.body.mode === "edit" ? "edit" : "view";
  const token = randomBytes(20).toString("hex");
  const share = Shares.create.get({ id: randomUUID(), canvas_id: req.canvas.id, token, mode });
  res.status(201).json(share);
});

// DELETE /api/canvases/:id/shares/:shareId
router.delete("/:id/shares/:shareId", requireCanvas, (req, res) => {
  Shares.delete.run(req.params.shareId, req.canvas.id);
  res.json({ message: "Link revogado." });
});

// ── Acesso público via token de compartilhamento ───────

// GET /api/shared/:token
router.get("/shared/:token", (req, res) => {
  const share = Shares.findByToken.get(req.params.token);
  if (!share) return res.status(404).json({ error: "Link inválido." });
  const canvas = Canvases.findByIdAny.get(share.canvas_id);
  if (!canvas) return res.status(404).json({ error: "Canvas não encontrado." });
  res.json({ canvas, nodes: formatNodes(Nodes.findByCanvas.all(canvas.id)), mode: share.mode });
});

module.exports = router;
