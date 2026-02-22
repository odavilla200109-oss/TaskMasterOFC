/**
 * src/db.js — TaskMaster v3.0 Database Layer
 *
 * Novidades v3:
 *  - canvases.type: 'task' | 'brain'  (workspace de tarefas vs brainstorm)
 *  - canvases.workspace_limit: 8 por usuário
 *  - brain_nodes: nós de brainstorm (id, canvas_id, title, x, y, color, parent_id)
 *  - canvas_shares: expires_at (NULL = indefinido), password_hash (edit links)
 *  - canvas_shares: view_indefinite_lock (só 1 por canvas)
 *  - error_reports: id, message, email?, created_at
 *  - Users.deleteAll: cascade deleta tudo (LGPD)
 */
const Database = require("better-sqlite3");
const path     = require("path");
const fs       = require("fs");

const DB_PATH = process.env.DB_PATH || "./data/taskmaster.db";
fs.mkdirSync(path.dirname(path.resolve(DB_PATH)), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("synchronous = NORMAL");

// ── Schema ─────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    google_id  TEXT UNIQUE,
    name       TEXT NOT NULL,
    email      TEXT UNIQUE NOT NULL,
    photo      TEXT,
    dark_mode  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS canvases (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL DEFAULT 'Meu Workspace',
    type       TEXT NOT NULL DEFAULT 'task' CHECK(type IN ('task','brain')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS nodes (
    id         TEXT PRIMARY KEY,
    canvas_id  TEXT NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
    title      TEXT NOT NULL DEFAULT '',
    x          REAL NOT NULL DEFAULT 0,
    y          REAL NOT NULL DEFAULT 0,
    priority   TEXT NOT NULL DEFAULT 'none'
                 CHECK(priority IN ('none','low','medium','high')),
    completed  INTEGER NOT NULL DEFAULT 0,
    parent_id  TEXT REFERENCES nodes(id) ON DELETE SET NULL,
    due_date   TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS brain_nodes (
    id         TEXT PRIMARY KEY,
    canvas_id  TEXT NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
    title      TEXT NOT NULL DEFAULT '',
    x          REAL NOT NULL DEFAULT 0,
    y          REAL NOT NULL DEFAULT 0,
    color      TEXT NOT NULL DEFAULT '#10b981',
    parent_id  TEXT REFERENCES brain_nodes(id) ON DELETE CASCADE,
    is_root    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS canvas_shares (
    id                    TEXT PRIMARY KEY,
    canvas_id             TEXT NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
    token                 TEXT UNIQUE NOT NULL,
    mode                  TEXT NOT NULL DEFAULT 'view'
                            CHECK(mode IN ('view','edit')),
    expires_at            TEXT,
    password_hash         TEXT,
    view_indefinite_lock  INTEGER NOT NULL DEFAULT 0,
    created_at            TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS error_reports (
    id         TEXT PRIMARY KEY,
    message    TEXT NOT NULL,
    email      TEXT,
    page       TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_canvases_user    ON canvases(user_id);
  CREATE INDEX IF NOT EXISTS idx_nodes_canvas     ON nodes(canvas_id);
  CREATE INDEX IF NOT EXISTS idx_nodes_parent     ON nodes(parent_id);
  CREATE INDEX IF NOT EXISTS idx_brain_canvas     ON brain_nodes(canvas_id);
  CREATE INDEX IF NOT EXISTS idx_brain_parent     ON brain_nodes(parent_id);
  CREATE INDEX IF NOT EXISTS idx_shares_token     ON canvas_shares(token);
  CREATE INDEX IF NOT EXISTS idx_shares_canvas    ON canvas_shares(canvas_id);
  CREATE INDEX IF NOT EXISTS idx_reports_created  ON error_reports(created_at);
`);

// ── Migrações seguras ──────────────────────────────────
const migrate = (sql) => { try { db.exec(sql); } catch (_) {} };

migrate("ALTER TABLE users    ADD COLUMN dark_mode INTEGER NOT NULL DEFAULT 0");
migrate("ALTER TABLE nodes    ADD COLUMN due_date  TEXT");
migrate("ALTER TABLE canvases ADD COLUMN type      TEXT NOT NULL DEFAULT 'task'");
migrate("ALTER TABLE canvas_shares ADD COLUMN expires_at           TEXT");
migrate("ALTER TABLE canvas_shares ADD COLUMN password_hash        TEXT");
migrate("ALTER TABLE canvas_shares ADD COLUMN view_indefinite_lock INTEGER NOT NULL DEFAULT 0");

// ── Users ──────────────────────────────────────────────
const Users = {
  findByGoogleId: db.prepare("SELECT * FROM users WHERE google_id=?"),
  findById:       db.prepare("SELECT * FROM users WHERE id=?"),
  findByEmail:    db.prepare("SELECT * FROM users WHERE email=?"),
  create: db.prepare(`
    INSERT INTO users (id,google_id,name,email,photo)
    VALUES (@id,@google_id,@name,@email,@photo) RETURNING *
  `),
  update: db.prepare(`
    UPDATE users SET name=@name,photo=@photo,updated_at=datetime('now')
    WHERE id=@id RETURNING *
  `),
  setDarkMode: db.prepare("UPDATE users SET dark_mode=@dark_mode WHERE id=@id"),
  // LGPD — exclui o usuário e TUDO via CASCADE
  deleteAll: db.prepare("DELETE FROM users WHERE id=?"),
};

// ── Canvases ───────────────────────────────────────────
const MAX_CANVASES = 8;

const Canvases = {
  findByUser:    db.prepare("SELECT * FROM canvases WHERE user_id=? ORDER BY updated_at DESC"),
  findById:      db.prepare("SELECT * FROM canvases WHERE id=? AND user_id=?"),
  findByIdAny:   db.prepare("SELECT * FROM canvases WHERE id=?"),
  countByUser:   db.prepare("SELECT COUNT(*) as count FROM canvases WHERE user_id=?"),
  create: db.prepare(`
    INSERT INTO canvases (id,user_id,name,type) VALUES (@id,@user_id,@name,@type) RETURNING *
  `),
  rename: db.prepare(`
    UPDATE canvases SET name=@name,updated_at=datetime('now')
    WHERE id=@id AND user_id=@user_id RETURNING *
  `),
  touch:  db.prepare("UPDATE canvases SET updated_at=datetime('now') WHERE id=?"),
  delete: db.prepare("DELETE FROM canvases WHERE id=? AND user_id=?"),
  MAX_CANVASES,
};

// ── Task Nodes ─────────────────────────────────────────
const Nodes = {
  findByCanvas:   db.prepare("SELECT * FROM nodes WHERE canvas_id=? ORDER BY created_at ASC"),
  deleteByCanvas: db.prepare("DELETE FROM nodes WHERE canvas_id=?"),
  upsert: db.prepare(`
    INSERT INTO nodes (id,canvas_id,title,x,y,priority,completed,parent_id,due_date)
    VALUES (@id,@canvas_id,@title,@x,@y,@priority,@completed,@parent_id,@due_date)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title, x=excluded.x, y=excluded.y,
      priority=excluded.priority, completed=excluded.completed,
      parent_id=excluded.parent_id, due_date=excluded.due_date,
      updated_at=datetime('now')
  `),
  replaceAll: db.transaction((canvasId, nodes) => {
    Nodes.deleteByCanvas.run(canvasId);
    for (const n of nodes) {
      Nodes.upsert.run({
        id:        n.id,
        canvas_id: canvasId,
        title:     n.title    || "",
        x:         n.x        || 0,
        y:         n.y        || 0,
        priority:  ["none","low","medium","high"].includes(n.priority) ? n.priority : "none",
        completed: n.completed ? 1 : 0,
        parent_id: n.parentId || null,
        due_date:  n.dueDate  || null,
      });
    }
  }),
};

// ── Brain Nodes ────────────────────────────────────────
const BrainNodes = {
  findByCanvas:   db.prepare("SELECT * FROM brain_nodes WHERE canvas_id=? ORDER BY is_root DESC, created_at ASC"),
  deleteByCanvas: db.prepare("DELETE FROM brain_nodes WHERE canvas_id=?"),
  upsert: db.prepare(`
    INSERT INTO brain_nodes (id,canvas_id,title,x,y,color,parent_id,is_root)
    VALUES (@id,@canvas_id,@title,@x,@y,@color,@parent_id,@is_root)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title, x=excluded.x, y=excluded.y,
      color=excluded.color, parent_id=excluded.parent_id,
      updated_at=datetime('now')
  `),
  replaceAll: db.transaction((canvasId, nodes) => {
    BrainNodes.deleteByCanvas.run(canvasId);
    for (const n of nodes) {
      BrainNodes.upsert.run({
        id:        n.id,
        canvas_id: canvasId,
        title:     (n.title || "").slice(0, 120),
        x:         n.x       || 0,
        y:         n.y       || 0,
        color:     n.color   || "#10b981",
        parent_id: n.parentId || null,
        is_root:   n.isRoot  ? 1 : 0,
      });
    }
  }),
};

// ── Shares ─────────────────────────────────────────────
const Shares = {
  findByCanvas:           db.prepare("SELECT * FROM canvas_shares WHERE canvas_id=?"),
  findByToken:            db.prepare("SELECT * FROM canvas_shares WHERE token=?"),
  findViewIndefByCanvas:  db.prepare("SELECT * FROM canvas_shares WHERE canvas_id=? AND view_indefinite_lock=1 LIMIT 1"),
  create: db.prepare(`
    INSERT INTO canvas_shares (id,canvas_id,token,mode,expires_at,password_hash,view_indefinite_lock)
    VALUES (@id,@canvas_id,@token,@mode,@expires_at,@password_hash,@view_indefinite_lock) RETURNING *
  `),
  setPassword: db.prepare("UPDATE canvas_shares SET password_hash=@password_hash WHERE id=@id"),
  delete:    db.prepare("DELETE FROM canvas_shares WHERE id=? AND canvas_id=?"),
  deleteAll: db.prepare("DELETE FROM canvas_shares WHERE canvas_id=?"),
  // Verifica se share expirou
  isExpired: (share) => {
    if (!share.expires_at) return false;
    return new Date(share.expires_at) < new Date();
  },
};

// ── Error Reports ──────────────────────────────────────
const ErrorReports = {
  findAll:  db.prepare("SELECT * FROM error_reports ORDER BY created_at DESC"),
  findById: db.prepare("SELECT * FROM error_reports WHERE id=?"),
  create: db.prepare(`
    INSERT INTO error_reports (id,message,email,page)
    VALUES (@id,@message,@email,@page) RETURNING *
  `),
  delete:   db.prepare("DELETE FROM error_reports WHERE id=?"),
  deleteAll: db.prepare("DELETE FROM error_reports"),
  count:    db.prepare("SELECT COUNT(*) as count FROM error_reports"),
};

module.exports = { db, Users, Canvases, Nodes, BrainNodes, Shares, ErrorReports };
