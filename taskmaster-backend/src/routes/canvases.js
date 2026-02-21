/**
 * src/routes/canvases.js
 *
 * CORREÇÕES APLICADAS:
 * - Rota pública GET /shared/:token movida para ANTES do router.use(requireAuth)
 *   (antes estava bloqueada pelo middleware de autenticação)
 * - Validação de limite de nodes por canvas (máx. 500)
 * - Uso de formatNodes centralizado em src/utils/formatNodes.js
 */
const express  = require("express");
const { randomUUID, randomBytes } = require("crypto");
const { Canvases, Nodes, Shares } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { formatNodes } = require("../utils/formatNodes");

const router = express.Router();

const MAX_NODES = 500;

// ── Middleware auxiliar: verifica posse do canvas ────────
function requireCanvas(req, res, next) {
  const canvas = Canvases.findById.get(req.params.id, req.user.id);
  if (!canvas) return res.status(404).json({ error: "Canvas não encontrado." });
  req.canvas = canvas;
  next();
}

// ════════════════════════════════════════════════════════
//  ROTAS PÚBLICAS (sem autenticação)
//  ⚠️ DEVEM vir ANTES do router.use(requireAuth)
// ════════════════════════════════════════════════════════

// GET /api/canvases/shared/:token
// Acesso público via link de compartilhamento
router.get("/shared/:token", (req, res) => {
  const share = Shares.findByToken.get(req.params.token);
  if (!share) return res.status(404).json({ error: "Link inválido ou expirado." });

  const canvas = Canvases.findByIdAny.get(share.canvas_id);
  if (!canvas) return res.status(404).json({ error: "Canvas não encontrado." });

  res.json({
    canvas,
    nodes: formatNodes(Nodes.findByCanvas.all(canvas.id)),
    mode:  share.mode,
  });
});

// ════════════════════════════════════════════════════════
//  ROTAS AUTENTICADAS
//  Todas as rotas abaixo exigem JWT válido
// ════════════════════════════════════════════════════════
router.use(requireAuth);

// GET /api/canvases
// Lista todos os canvases do usuário autenticado
router.get("/", (req, res) => {
  res.json(Canvases.findByUser.all(req.user.id));
});

// POST /api/canvases
// Cria um novo canvas
router.post("/", (req, res) => {
  const name   = (req.body.name || "Novo Canvas").slice(0, 100);
  const canvas = Canvases.create.get({ id: randomUUID(), user_id: req.user.id, name });
  res.status(201).json(canvas);
});

// PATCH /api/canvases/:id
// Renomeia um canvas
router.patch("/:id", requireCanvas, (req, res) => {
  const name = (req.body.name || "").slice(0, 100);
  if (!name) return res.status(400).json({ error: "Nome obrigatório." });
  const updated = Canvases.rename.get({ id: req.params.id, user_id: req.user.id, name });
  res.json(updated);
});

// DELETE /api/canvases/:id
// Exclui um canvas e todos os seus nodes (CASCADE)
router.delete("/:id", requireCanvas, (req, res) => {
  Canvases.delete.run(req.params.id, req.user.id);
  res.json({ message: "Canvas excluído." });
});

// GET /api/canvases/:id/nodes
// Retorna todos os nodes de um canvas
router.get("/:id/nodes", requireCanvas, (req, res) => {
  res.json(formatNodes(Nodes.findByCanvas.all(req.canvas.id)));
});

// PUT /api/canvases/:id/nodes
// Substitui todos os nodes do canvas (save completo)
router.put("/:id/nodes", requireCanvas, (req, res) => {
  const { nodes } = req.body;

  if (!Array.isArray(nodes))
    return res.status(400).json({ error: "nodes deve ser um array." });

  if (nodes.length > MAX_NODES)
    return res.status(400).json({ error: `Máximo de ${MAX_NODES} nós por canvas.` });

  Nodes.replaceAll(req.canvas.id, nodes);
  Canvases.touch.run(req.canvas.id);

  res.json({ saved: nodes.length });
});

// GET /api/canvases/:id/shares
// Lista os links de compartilhamento do canvas
router.get("/:id/shares", requireCanvas, (req, res) => {
  res.json(Shares.findByCanvas.all(req.canvas.id));
});

// POST /api/canvases/:id/shares
// Cria um novo link de compartilhamento
router.post("/:id/shares", requireCanvas, (req, res) => {
  const mode  = req.body.mode === "edit" ? "edit" : "view";
  const token = randomBytes(20).toString("hex");
  const share = Shares.create.get({
    id:        randomUUID(),
    canvas_id: req.canvas.id,
    token,
    mode,
  });
  res.status(201).json(share);
});

// DELETE /api/canvases/:id/shares/:shareId
// Revoga um link de compartilhamento
router.delete("/:id/shares/:shareId", requireCanvas, (req, res) => {
  Shares.delete.run(req.params.shareId, req.canvas.id);
  res.json({ message: "Link revogado." });
});

module.exports = router;
