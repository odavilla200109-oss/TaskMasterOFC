/**
 * ╔═══════════════════════════════════════════════╗
 * ║          TASKMASTER BACKEND v2.0             ║
 * ║   REST API + WebSocket (colaboração real)     ║
 * ╚═══════════════════════════════════════════════╝
 */
require("dotenv").config();

const http      = require("http");
const express   = require("express");
const cors      = require("cors");
const helmet    = require("helmet");
const morgan    = require("morgan");
const rateLimit = require("express-rate-limit");

const authRoutes   = require("./src/routes/auth");
const canvasRoutes = require("./src/routes/canvases");
const { initWebSocket } = require("./src/ws");

// ── Validação de env ────────────────────────────────────
["JWT_SECRET","GOOGLE_CLIENT_ID"].forEach((k) => {
  if (!process.env[k]) {
    console.error(`❌  Variável de ambiente ausente: ${k}`);
    process.exit(1);
  }
});

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 3001;

// ── CORS ────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",").map((s) => s.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error(`CORS bloqueado: ${origin}`));
  },
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: true,
}));

// ── Segurança ───────────────────────────────────────────
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ── Rate limiting ───────────────────────────────────────
app.use(rateLimit({
  windowMs: 60_000, max: 300,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Muitas requisições." },
}));

const authLimiter = rateLimit({
  windowMs: 60_000, max: 15,
  message: { error: "Muitas tentativas de login." },
});

app.use(express.json({ limit: "4mb" }));

// ── Health ──────────────────────────────────────────────
app.get("/health", (_, res) => res.json({ status: "ok", version: "2.0.0", time: new Date().toISOString() }));

// ── Rotas ───────────────────────────────────────────────
app.use("/api/auth",     authLimiter, authRoutes);
app.use("/api/canvases", canvasRoutes);

// ── 404 ─────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` }));

// ── Errors ──────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error("[Error]", err.message);
  if (err.message?.includes("CORS")) return res.status(403).json({ error: err.message });
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === "production" ? "Erro interno." : err.message,
  });
});

// ── WebSocket ───────────────────────────────────────────
initWebSocket(server);

// ── Start ───────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║   TaskMaster API v2 rodando! 🚀      ║
╠══════════════════════════════════════╣
║  HTTP: http://localhost:${PORT}         ║
║  WS:   ws://localhost:${PORT}/ws       ║
║  Env:  ${(process.env.NODE_ENV||"development").padEnd(27)}║
╚══════════════════════════════════════╝`);
});
