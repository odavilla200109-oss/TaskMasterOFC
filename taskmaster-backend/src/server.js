/**
 * TASKMASTER BACKEND v3.0
 * REST API + WebSocket (tarefas + brainstorm)
 */
require("dotenv").config();

const http      = require("http");
const express   = require("express");
const cors      = require("cors");
const helmet    = require("helmet");
const morgan    = require("morgan");
const rateLimit = require("express-rate-limit");

const authRoutes    = require("./src/routes/auth");
const canvasRoutes  = require("./src/routes/canvases");
const reportRoutes  = require("./src/routes/reports");
const { initWebSocket } = require("./src/ws");

["JWT_SECRET", "GOOGLE_CLIENT_ID"].forEach((k) => {
  if (!process.env[k]) {
    console.error(`❌  Variável de ambiente ausente: ${k}`);
    process.exit(1);
  }
});

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 3001;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",").map((s) => s.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error(`CORS bloqueado: ${origin}`));
  },
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","X-Admin-Secret"],
  credentials: true,
}));

app.use(helmet());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev", {
  skip: (req) => req.path === "/health",
}));

app.use(rateLimit({
  windowMs: 60_000, max: 300,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em breve." },
}));

const authLimiter = rateLimit({
  windowMs: 60_000, max: 15,
  message: { error: "Muitas tentativas de login. Aguarde 1 minuto." },
});

const reportLimiter = rateLimit({
  windowMs: 60_000 * 10, max: 5,  // 5 reports a cada 10 min por IP
  message: { error: "Limite de reports atingido." },
});

app.use(express.json({ limit: "4mb" }));

app.get("/health", (_, res) =>
  res.json({ status: "ok", version: "3.0.0", time: new Date().toISOString() })
);

app.use("/api/auth",     authLimiter,   authRoutes);
app.use("/api/canvases", canvasRoutes);
app.use("/api/reports",  reportLimiter, reportRoutes);

app.use((req, res) =>
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` })
);

app.use((err, req, res, _next) => {
  console.error("[Error]", err.message);
  if (err.message?.includes("CORS")) return res.status(403).json({ error: err.message });
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === "production" ? "Erro interno." : err.message,
  });
});

initWebSocket(server);

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║   TaskMaster API v3 rodando! 🚀      ║
╠══════════════════════════════════════╣
║  HTTP: http://localhost:${PORT}         ║
║  WS:   ws://localhost:${PORT}/ws       ║
║  Env:  ${(process.env.NODE_ENV || "development").padEnd(27)}║
╚══════════════════════════════════════╝`);
});
