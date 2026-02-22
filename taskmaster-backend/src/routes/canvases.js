/**
 * src/routes/canvases.js — v3
 *
 * Novidades:
 *  - canvas.type: 'task' | 'brain'
 *  - Limite de 8 workspaces por usuário
 *  - brain_nodes: GET/PUT /api/canvases/:id/brain-nodes
 *  - Shares: expires_at (24h | null), password_hash, view_indefinite_lock
 *  - PATCH /api/canvases/:id/shares/:shareId/password — define senha no link edit
 *  - Validação de expiração ao acessar link público
 */
const express  = require("express");
const { randomUUID, randomBytes, createHash } = require("crypto");
const { Canvases, Nodes, BrainNodes, Shares } = require("../db");
const { requireAuth }   = require("../middleware/auth");
const { formatNodes, formatBrainNodes } = require("../utils/formatNodes");

const router   = express.Router();
const MAX_NODES   = 500;
const MAX_CANVASES = Canvases.MAX_CANVASES; // 8

// ── helper: hash de senha ────────────────────────────
function hashPassword(pwd) {
  return createHash("sha256").update(pwd + "tm_salt_v3").digest("hex");
}

// ── Middleware: verifica posse do canvas ─────────────
function requireCanvas(req, res, next) {
  const canvas = Canvases.findById.get(req.params.id, req.user.id);
  if (!canvas) return res.status(404).json({ error: "Canvas não encontrado." });
  req.canvas = canvas;
  next();
}

// ════════════════════════════════════════════════════
//  ROTAS PÚBLICAS — vêm ANTES do requireAuth
// ════════════════════════════════════════════════════

// GET /api/canvases/shared/:token
router.get("/shared/:token", (req, res) => {
  const share = Shares.findByToken.get(req.params.token);
  if (!share) return res.status(404).json({ error: "Link inválido ou expirado." });

  // Verifica expiração
  if (Shares.isExpired(share))
    return res.status(410).json({ error: "Este link expirou." });

  const canvas = Canvases.findByIdAny.get(share.canvas_id);
  if (!canvas) return res.status(404).json({ error: "Canvas não encontrado." });

  // Se tem senha e o share é de edição, não bloqueia aqui —
  // o frontend verifica e solicita senha antes de desbloquear edição.
  const hasPassword = !!share.password_hash;

  if (canvas.type === "brain") {
    return res.json({
      canvas,
      nodes: [],
      brainNodes: formatBrainNodes(BrainNodes.findByCanvas.all(canvas.id)),
      mode: share.mode,
      hasPassword,
    });
  }

  res.json({
    canvas,
    nodes: formatNodes(Nodes.findByCanvas.all(canvas.id)),
    brainNodes: [],
    mode: share.mode,
    hasPassword,
  });
});

// POST /api/canvases/shared/:token/verify-password
// Verifica a senha do link de edição protegido
router.post("/shared/:token/verify-password", (req, res) => {
  const share = Shares.findByToken.get(req.params.token);
  if (!share) return res.status(404).json({ error: "Link inválido." });
  if (Shares.isExpired(share)) return res.status(410).json({ error: "Link expirado." });
  if (!share.password_hash) return res.json({ ok: true }); // sem senha

  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Senha obrigatória." });

  const ok = hashPassword(password) === share.password_hash;
  if (!ok) return res.status(401).json({ error: "Senha incorreta." });
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════
//  ROTAS AUTENTICADAS
// ════════════════════════════════════════════════════
router.use(requireAuth);

// GET /api/canvases
router.get("/", (req, res) => {
  const canvases = Canvases.findByUser.all(req.user.id);
  // Inclui flag de view_indefinite_lock em cada canvas
  const withLock = canvases.map((c) => {
    const lockShare = Shares.findViewIndefByCanvas.get(c.id);
    return { ...c, hasViewIndefLock: !!lockShare };
  });
  res.json(withLock);
});

// POST /api/canvases
router.post("/", (req, res) => {
  const count = Canvases.countByUser.get(req.user.id).count;
  if (count >= MAX_CANVASES)
    return res.status(400).json({ error: `Limite de ${MAX_CANVASES} workspaces atingido.` });

  const name = (req.body.name || "Novo Workspace").slice(0, 100);
  const type = req.body.type === "brain" ? "brain" : "task";
  const canvas = Canvases.create.get({ id: randomUUID(), user_id: req.user.id, name, type });
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

// ── TASK NODES ───────────────────────────────────────

// GET /api/canvases/:id/nodes
router.get("/:id/nodes", requireCanvas, (req, res) => {
  res.json(formatNodes(Nodes.findByCanvas.all(req.canvas.id)));
});

// PUT /api/canvases/:id/nodes
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

// ── BRAIN NODES ──────────────────────────────────────

// GET /api/canvases/:id/brain-nodes
router.get("/:id/brain-nodes", requireCanvas, (req, res) => {
  res.json(formatBrainNodes(BrainNodes.findByCanvas.all(req.canvas.id)));
});

// PUT /api/canvases/:id/brain-nodes
router.put("/:id/brain-nodes", requireCanvas, (req, res) => {
  const { nodes } = req.body;
  if (!Array.isArray(nodes))
    return res.status(400).json({ error: "nodes deve ser um array." });
  if (nodes.length > MAX_NODES)
    return res.status(400).json({ error: `Máximo de ${MAX_NODES} nós por canvas.` });

  BrainNodes.replaceAll(req.canvas.id, nodes);
  Canvases.touch.run(req.canvas.id);
  res.json({ saved: nodes.length });
});

// ── SHARES ───────────────────────────────────────────

// GET /api/canvases/:id/shares
router.get("/:id/shares", requireCanvas, (req, res) => {
  res.json(Shares.findByCanvas.all(req.canvas.id));
});

// POST /api/canvases/:id/shares
router.post("/:id/shares", requireCanvas, (req, res) => {
  const mode     = req.body.mode === "edit" ? "edit" : "view";
  const duration = req.body.duration; // "24h" | "indefinite"
  const password = req.body.password || null;

  let expiresAt            = null;
  let viewIndefiniteLock   = 0;

  if (mode === "view" && duration === "indefinite") {
    // Verifica se já existe um lock infinito neste canvas
    const existing = Shares.findViewIndefByCanvas.get(req.canvas.id);
    if (existing) {
      return res.status(400).json({
        error: "Este canvas já possui um link de visualização indefinida ativo. Revogue-o primeiro.",
        lockId: existing.id,
      });
    }
    viewIndefiniteLock = 1;
  } else if (duration === "24h") {
    const exp = new Date();
    exp.setHours(exp.getHours() + 24);
    expiresAt = exp.toISOString();
  }

  const token = randomBytes(22).toString("hex");
  const share = Shares.create.get({
    id:                   randomUUID(),
    canvas_id:            req.canvas.id,
    token,
    mode,
    expires_at:           expiresAt,
    password_hash:        password ? hashPassword(password) : null,
    view_indefinite_lock: viewIndefiniteLock,
  });

  res.status(201).json(share);
});

// PATCH /api/canvases/:id/shares/:shareId/password
// Adiciona ou remove senha de um link de edição
router.patch("/:id/shares/:shareId/password", requireCanvas, (req, res) => {
  const { password } = req.body;
  const hash = password ? hashPassword(password) : null;
  Shares.setPassword.run({ id: req.params.shareId, password_hash: hash });
  res.json({ ok: true });
});

// DELETE /api/canvases/:id/shares/:shareId
router.delete("/:id/shares/:shareId", requireCanvas, (req, res) => {
  Shares.delete.run(req.params.shareId, req.canvas.id);
  res.json({ message: "Link revogado." });
});

module.exports = router;
