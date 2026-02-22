/**
 * src/routes/reports.js — v3
 *
 * Rotas públicas:
 *   POST /api/reports       — envia report de erro
 *
 * Rotas admin (protegidas por ADMIN_SECRET no env):
 *   GET    /api/reports/admin       — lista todos os reports
 *   DELETE /api/reports/admin/:id   — apaga um report
 *   DELETE /api/reports/admin       — apaga todos
 */
const express = require("express");
const { randomUUID } = require("crypto");
const { ErrorReports } = require("../db");

const router = express.Router();

function requireAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return res.status(503).json({ error: "Admin não configurado." });
  const auth = req.headers["x-admin-secret"] || req.query.secret;
  if (auth !== secret) return res.status(401).json({ error: "Não autorizado." });
  next();
}

// POST /api/reports
router.post("/", (req, res) => {
  const { message, email, page } = req.body;
  if (!message || !message.trim())
    return res.status(400).json({ error: "Mensagem obrigatória." });

  const report = ErrorReports.create.get({
    id:      randomUUID(),
    message: message.slice(0, 2000),
    email:   (email || "").slice(0, 200) || null,
    page:    (page  || "").slice(0, 200) || null,
  });

  res.status(201).json({ ok: true, id: report.id });
});

// GET /api/reports/admin
router.get("/admin", requireAdmin, (req, res) => {
  const reports = ErrorReports.findAll.all();
  const count   = ErrorReports.count.get().count;
  res.json({ reports, count });
});

// DELETE /api/reports/admin/:id
router.delete("/admin/:id", requireAdmin, (req, res) => {
  ErrorReports.delete.run(req.params.id);
  res.json({ ok: true });
});

// DELETE /api/reports/admin — apaga todos
router.delete("/admin", requireAdmin, (req, res) => {
  ErrorReports.deleteAll.run();
  res.json({ ok: true, message: "Todos os reports apagados." });
});

module.exports = router;
