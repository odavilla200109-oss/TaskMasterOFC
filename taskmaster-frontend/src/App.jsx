/**
 * TaskMaster App.jsx v2.1
 *
 * Fixes & Features:
 *  ✦ Fix: Link de edição compartilhada sincroniza (sharedCanvasId armazena canvas.id)
 *  ✦ Fix: Botão para sair do modo compartilhado e voltar aos workspaces
 *  ✦ Fix: Link compartilhado requer login obrigatório
 *  ✦ Fix: Botão Organizar faz fit-to-screen após organizar
 *  ✦ Fix: Organização por prioridade (high → medium → low → none)
 *  ✦ Fix: Subtarefas verticais, card menor, sem controle de prioridade
 *  ✦ Fix: Criação de nó sem sobreposição (collision detection aprimorado)
 *  ✦ New: Seleção de nó ao clicar (highlight visual + glow)
 *  ✦ New: Cookie Consent Banner (LGPD/Google Consent Mode v2)
 *  ✦ New: Sincronização robusta (visibilitychange, retry, periodic, lastSaved)
 *  ✦ Design: Login repaginada — sem referências open source
 *  ✦ Design: Workspace com destaques visuais, hover effects aprimorados
 */

import {
  useState, useRef, useCallback, useEffect,
  createContext, useContext,
} from "react";
import { GoogleLogin } from "@react-oauth/google";
import {
  soundNodeCreate, soundNodeComplete,
  soundSubtaskCreate, soundDelete,
} from "./sounds";

// ═══════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const WS_URL  = API_URL.replace(/^https/, "wss").replace(/^http(?!s)/, "ws");

const Token = {
  get:   ()  => localStorage.getItem("tm_token"),
  set:   (t) => localStorage.setItem("tm_token", t),
  clear: ()  => localStorage.removeItem("tm_token"),
};

async function api(path, opts = {}) {
  const t = Token.get();
  const r = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...opts.headers,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

// ═══════════════════════════════════════════════
//  CONSTANTES
// ═══════════════════════════════════════════════
const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

const NODE_W        = 224;
const NODE_H        = 108;
const NODE_W_CHILD  = 178;   // Subtarefas menores
const NODE_H_CHILD  = 76;
const NODE_GAP_X    = 56;
const NODE_GAP_Y    = 60;

const PRIORITY = {
  order: ["none","low","medium","high"],
  color: { none:"#a7f3d0", low:"#34d399", medium:"#f59e0b", high:"#ef4444" },
  icon:  { none:"○", low:"↓", medium:"◆", high:"▲" },
  label: { none:"Sem Prioridade", low:"Baixa", medium:"Média", high:"Alta" },
};

const SUBTITLES = [
  "Organize suas ideias com clareza.",
  "Do caos à execução, sem fricção.",
  "Transforme pensamentos em ação.",
  "Planejamento visual que flui com você.",
  "Suas tarefas, do seu jeito.",
  "Foco total. Resultados reais.",
];

// ═══════════════════════════════════════════════
//  UTILITÁRIOS
// ═══════════════════════════════════════════════
function getDescendants(nodes, id) {
  const found = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    nodes.forEach((n) => {
      if (n.parentId && found.has(n.parentId) && !found.has(n.id)) {
        found.add(n.id); changed = true;
      }
    });
  }
  return found;
}

function nodeWidth(n)  { return n.parentId ? NODE_W_CHILD : NODE_W; }
function nodeHeight(n) { return n.parentId ? NODE_H_CHILD : NODE_H; }

function collidesNodes(ax, ay, aw, ah, bx, by, bw, bh) {
  return (
    Math.abs(ax - bx) < (aw + bw) / 2 + 12 &&
    Math.abs(ay - by) < (ah + bh) / 2 + 12
  );
}

function findFreePosition(nodes, startX, startY, isChild = false) {
  const W = isChild ? NODE_W_CHILD : NODE_W;
  const H = isChild ? NODE_H_CHILD : NODE_H;
  let x = startX, y = startY, attempts = 0;

  while (attempts < 300) {
    const hit = nodes.some((n) =>
      collidesNodes(n.x, n.y, nodeWidth(n), nodeHeight(n), x, y, W, H)
    );
    if (!hit) return { x, y };
    x += W + NODE_GAP_X;
    if (x > startX + (W + NODE_GAP_X) * 5) {
      x = startX;
      y += H + NODE_GAP_Y;
    }
    attempts++;
  }
  return { x, y };
}

function isOverdue(d) { return d && new Date(d) < new Date(); }
function formatDue(d) {
  if (!d) return null;
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short",
  });
}

// ═══════════════════════════════════════════════
//  CONTEXTO
// ═══════════════════════════════════════════════
const AppCtx = createContext(null);

// ═══════════════════════════════════════════════
//  TEMA
// ═══════════════════════════════════════════════
function applyTheme(dark) {
  const r = document.documentElement;
  if (dark) {
    r.style.setProperty("--bg-card",    "rgba(10,20,15,0.97)");
    r.style.setProperty("--bg-glass",   "rgba(6,14,10,0.82)");
    r.style.setProperty("--border",     "rgba(16,185,129,0.20)");
    r.style.setProperty("--text-main",  "#d1fae5");
    r.style.setProperty("--text-sub",   "#6ee7b7");
    r.style.setProperty("--text-muted", "#3d6b55");
    r.style.setProperty("--node-bg",    "rgba(10,20,15,0.97)");
    r.style.setProperty("--node-shadow","0 4px 28px rgba(0,0,0,0.55), 0 0 0 1px rgba(16,185,129,0.08)");
  } else {
    r.style.setProperty("--bg-card",    "rgba(255,255,255,0.97)");
    r.style.setProperty("--bg-glass",   "rgba(255,255,255,0.75)");
    r.style.setProperty("--border",     "rgba(16,185,129,0.18)");
    r.style.setProperty("--text-main",  "#064e3b");
    r.style.setProperty("--text-sub",   "#065f46");
    r.style.setProperty("--text-muted", "#9ca3af");
    r.style.setProperty("--node-bg",    "rgba(255,255,255,0.97)");
    r.style.setProperty("--node-shadow","0 4px 20px rgba(16,185,129,0.14), 0 1px 4px rgba(0,0,0,0.05)");
  }
}

// ═══════════════════════════════════════════════
//  COOKIE CONSENT BANNER
// ═══════════════════════════════════════════════
function CookieBanner({ onAccept, onDecline }) {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: "rgba(6,10,8,0.97)",
      backdropFilter: "blur(24px) saturate(180%)",
      borderTop: "1px solid rgba(16,185,129,0.25)",
      padding: "18px 24px",
      display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      animation: "tmFadeUp .4s ease both",
      boxShadow: "0 -8px 40px rgba(0,0,0,0.4)",
    }}>
      <div style={{ flex: 1, minWidth: 280 }}>
        <div style={{
          fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14,
          color: "#d1fae5", marginBottom: 4,
          display: "flex", alignItems: "center", gap: 7,
        }}>
          <span style={{ fontSize: 16 }}>🍪</span>
          Cookies & Privacidade
        </div>
        <p style={{
          fontFamily: "'DM Sans',sans-serif", fontSize: 12.5,
          color: "#6ee7b7", margin: 0, lineHeight: 1.6,
        }}>
          Este site utiliza cookies para funcionamento, análise de uso e
          publicidade personalizada. Ao aceitar, você concorda com o uso de
          cookies conforme nossa política de privacidade.
        </p>
      </div>
      <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
        <button
          onClick={onDecline}
          style={{
            background: "transparent",
            border: "1px solid rgba(16,185,129,0.3)",
            color: "#6ee7b7", borderRadius: 10, padding: "9px 18px",
            fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 500,
            cursor: "pointer", transition: "all .2s",
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(16,185,129,0.6)"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"}
        >
          Apenas necessários
        </button>
        <button
          onClick={onAccept}
          style={{
            background: "linear-gradient(135deg,#10b981,#059669)",
            border: "none", color: "#fff", borderRadius: 10, padding: "9px 22px",
            fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700,
            cursor: "pointer", boxShadow: "0 2px 12px rgba(16,185,129,0.35)",
            transition: "all .2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 18px rgba(16,185,129,0.5)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 12px rgba(16,185,129,0.35)"; }}
        >
          Aceitar cookies
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  HOOK: fundo animado
// ═══════════════════════════════════════════════
function useAnimatedBg(ref, dark) {
  const targetHue = useRef(145), currHue = useRef(145), raf = useRef(null);
  useEffect(() => {
    const tick = () => {
      currHue.current += (targetHue.current - currHue.current) * 0.018;
      const h = currHue.current;
      if (ref.current) {
        ref.current.style.background = dark
          ? `radial-gradient(ellipse 80% 60% at 20% 30%,hsl(${h},38%,7%) 0%,transparent 60%),
             radial-gradient(ellipse 60% 80% at 80% 70%,hsl(${h+20},32%,5%) 0%,transparent 60%),
             hsl(${h+8},28%,4%)`
          : `radial-gradient(ellipse 80% 60% at 20% 30%,hsl(${h},85%,94%) 0%,transparent 60%),
             radial-gradient(ellipse 60% 80% at 80% 70%,hsl(${h+25},70%,96%) 0%,transparent 60%),
             hsl(${h+10},50%,98%)`;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [ref, dark]);
  return useCallback((e) => {
    targetHue.current = 125 + (e.clientX / window.innerWidth) * 45;
  }, []);
}

// ═══════════════════════════════════════════════
//  BURST — partículas ao concluir
// ═══════════════════════════════════════════════
function BurstEffect({ x, y }) {
  const parts = [0, 72, 144, 216, 288].map((angle, i) => ({
    i,
    tx: Math.cos(angle * Math.PI / 180) * 70,
    ty: Math.sin(angle * Math.PI / 180) * 70,
  }));
  return (
    <>
      {parts.map(({ i, tx, ty }) => (
        <div key={i} style={{
          position: "absolute", left: x, top: y,
          width: 9, height: 9, borderRadius: "50%",
          pointerEvents: "none", zIndex: 9999,
          transform: "translate(-50%,-50%)",
          background: ["#10b981","#34d399","#6ee7b7","#fbbf24","#a7f3d0"][i],
          animation: `burst${i} .8s ease-out forwards`,
        }} />
      ))}
      <style>{parts.map(({ i, tx, ty }) =>
        `@keyframes burst${i}{0%{transform:translate(-50%,-50%) scale(1);opacity:1}
         100%{transform:translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) scale(0);opacity:0}}`
      ).join("")}</style>
    </>
  );
}

// ═══════════════════════════════════════════════
//  NÓ DE TAREFA
// ═══════════════════════════════════════════════
function NodeCard({
  node, dark,
  isEditing, editVal, setEditVal, onFinishEdit, onStartEdit,
  onDelete, onComplete, onCyclePriority, onAddChild,
  onDragStart, isNew, readOnly,
  isSelected, onSelect,
  isChild,
}) {
  const inputRef = useRef(null);
  const [pop, setPop] = useState(false);
  useEffect(() => { if (isEditing) inputRef.current?.focus(); }, [isEditing]);

  const handleComplete = () => {
    if (!node.completed) { setPop(true); setTimeout(() => setPop(false), 500); }
    onComplete();
  };

  const pc      = isChild ? "transparent" : PRIORITY.color[node.priority];
  const overdue = isOverdue(node.dueDate) && !node.completed;
  const W       = isChild ? NODE_W_CHILD : NODE_W;

  const borderColor = overdue
    ? "#ef4444"
    : isSelected
    ? "#10b981"
    : node.completed
    ? "#86efac"
    : isChild
    ? "var(--border)"
    : pc;

  const shadow = isSelected
    ? dark
      ? "0 0 0 2.5px rgba(16,185,129,0.6), 0 8px 36px rgba(16,185,129,0.28), 0 4px 16px rgba(0,0,0,0.5)"
      : "0 0 0 2.5px rgba(16,185,129,0.5), 0 8px 32px rgba(16,185,129,0.22), 0 2px 8px rgba(0,0,0,0.08)"
    : "var(--node-shadow)";

  return (
    <div
      onMouseDown={(e) => { onSelect(); onDragStart(e); }}
      onDoubleClick={(e) => { if (readOnly) return; e.stopPropagation(); onStartEdit(); }}
      className={`tm-node${isSelected ? " tm-selected" : ""}${isChild ? " tm-child-node" : ""}`}
      style={{
        position:     "absolute",
        left:         node.x,
        top:          node.y,
        width:        W,
        borderRadius: isChild ? 12 : 16,
        overflow:     "hidden",
        background:   "var(--node-bg)",
        border:       `${isSelected ? "2px" : "1.5px"} solid ${borderColor}`,
        boxShadow:    shadow,
        cursor:       readOnly ? "default" : "grab",
        willChange:   "transform, box-shadow",
        animation:    isNew ? "tmNodeIn .35s cubic-bezier(.34,1.56,.64,1) forwards" : "none",
        transition:   "border-color .2s, box-shadow .2s",
        zIndex:       isSelected ? 50 : isChild ? 10 : 20,
      }}
    >
      {/* Stripe de prioridade — apenas para nós raiz */}
      {!isChild && (
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
          background: pc, transition: "background .25s", flexShrink: 0,
        }} />
      )}

      {/* Badge de subtarefa */}
      {isChild && (
        <div style={{
          position: "absolute", top: 6, right: 8,
          fontSize: 8, fontFamily: "'DM Sans',sans-serif",
          fontWeight: 700, letterSpacing: 1,
          color: "var(--text-muted)", textTransform: "uppercase",
          opacity: 0.7,
        }}>
          subtarefa
        </div>
      )}

      {/* Título */}
      <div style={{ padding: isChild ? "9px 10px 6px 12px" : "11px 12px 7px 16px", minHeight: isChild ? 36 : 44 }}>
        {isEditing ? (
          <input
            ref={inputRef}
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            onBlur={() => onFinishEdit(editVal)}
            onKeyDown={(e) => {
              if (e.key === "Enter")  onFinishEdit(editVal);
              if (e.key === "Escape") onFinishEdit(node.title || "");
            }}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Nome da tarefa…"
            style={{
              width: "100%", border: "none", outline: "none",
              background: "transparent",
              fontFamily: "'DM Sans',sans-serif", fontWeight: 500,
              fontSize: isChild ? 12 : 13, color: "var(--text-main)",
            }}
          />
        ) : (
          <div style={{
            fontWeight: 500, fontSize: isChild ? 12 : 13,
            color: node.completed ? "var(--text-muted)" : "var(--text-main)",
            textDecoration: node.completed ? "line-through" : "none",
            lineHeight: 1.45, wordBreak: "break-word",
            paddingRight: isChild ? 36 : 0,
          }}>
            {node.title || (
              <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontWeight: 400, fontSize: isChild ? 11 : 12 }}>
                Duplo clique para editar
              </span>
            )}
          </div>
        )}
      </div>

      {/* Badge de data */}
      {node.dueDate && (
        <div style={{
          margin: `0 ${isChild ? 10 : 12}px 5px ${isChild ? 12 : 16}px`,
          display: "inline-flex", alignItems: "center", gap: 3,
          background: overdue ? "rgba(239,68,68,0.10)" : "rgba(16,185,129,0.08)",
          border: `1px solid ${overdue ? "rgba(239,68,68,0.30)" : "rgba(16,185,129,0.20)"}`,
          borderRadius: 6, padding: "1px 7px",
          fontSize: 10.5, fontFamily: "'DM Sans',sans-serif",
          color: overdue ? "#ef4444" : "var(--text-sub)", fontWeight: 600,
        }}>
          {overdue ? "⚠" : "📅"} {formatDue(node.dueDate)}
        </div>
      )}

      {/* Footer */}
      <div style={{
        display: "flex", alignItems: "center", gap: 2,
        padding: isChild ? "4px 7px 6px 11px" : "5px 8px 7px 13px",
        borderTop: "1px solid var(--border)",
      }}>
        {!readOnly && (
          <>
            {/* Prioridade — somente para nós raiz */}
            {!isChild && (
              <button
                title={PRIORITY.label[node.priority]}
                className="tm-btn"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onCyclePriority(); }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 13, color: node.priority !== "none" ? pc : "var(--text-muted)",
                  borderRadius: 6, padding: "2px 6px", fontWeight: 700,
                }}
              >
                {PRIORITY.icon[node.priority]}
              </button>
            )}

            {/* Adicionar subtarefa */}
            <button
              title="Nova subtarefa"
              className="tm-btn"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onAddChild(); }}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: isChild ? 13 : 15, color: "#10b981",
                borderRadius: 6, padding: "2px 5px", fontWeight: 600, lineHeight: 1,
              }}
            >
              ＋
            </button>

            <DueDatePicker node={node} onFinishEdit={onFinishEdit} isChild={isChild} />
          </>
        )}

        <div style={{ flex: 1 }} />

        {!readOnly && (
          <button
            title="Excluir"
            className="tm-btn"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 12, color: "#f87171",
              borderRadius: 6, padding: "2px 5px",
            }}
          >
            ✕
          </button>
        )}

        <button
          title={node.completed ? "Desmarcar" : "Concluir"}
          className="tm-btn"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); if (!readOnly) handleComplete(); }}
          style={{
            background: node.completed ? "#10b981" : "none",
            border: `2px solid ${node.completed ? "#10b981" : "rgba(16,185,129,0.4)"}`,
            cursor: readOnly ? "default" : "pointer",
            fontSize: 10, color: node.completed ? "white" : "#10b981",
            borderRadius: "50%",
            width: isChild ? 20 : 22, height: isChild ? 20 : 22,
            display: "flex", alignItems: "center", justifyContent: "center",
            transform: pop ? "scale(1.5)" : "scale(1)",
            fontWeight: 700, transition: "all .2s",
          }}
        >
          {node.completed ? "✓" : ""}
        </button>
      </div>
    </div>
  );
}

function DueDatePicker({ node, onFinishEdit, isChild }) {
  const inputRef = useRef(null);
  return (
    <button
      title="Data de vencimento"
      className="tm-btn"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); inputRef.current?.showPicker?.(); }}
      style={{
        background: "none", border: "none", cursor: "pointer",
        fontSize: isChild ? 11 : 12,
        color: "var(--text-muted)", borderRadius: 6, padding: "2px 4px",
        position: "relative",
      }}
    >
      📅
      <input
        ref={inputRef}
        type="date"
        value={node.dueDate || ""}
        onChange={(e) => onFinishEdit(node.title, e.target.value || null)}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ position: "absolute", opacity: 0, width: 1, height: 1, top: 0, left: 0, pointerEvents: "none" }}
      />
    </button>
  );
}

// ═══════════════════════════════════════════════
//  MODAL: COMPARTILHAR
// ═══════════════════════════════════════════════
function ShareModal({ canvasId, onClose }) {
  const [shares,  setShares]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(null);

  useEffect(() => {
    api(`/api/canvases/${canvasId}/shares`)
      .then(setShares).finally(() => setLoading(false));
  }, [canvasId]);

  const create = async (mode) => {
    const s = await api(`/api/canvases/${canvasId}/shares`, { method: "POST", body: { mode } });
    setShares((p) => [...p, s]);
  };
  const revoke = async (id) => {
    await api(`/api/canvases/${canvasId}/shares/${id}`, { method: "DELETE" });
    setShares((p) => p.filter((x) => x.id !== id));
  };
  const copy = (token) => {
    navigator.clipboard.writeText(`${window.location.origin}/shared/${token}`);
    setCopied(token); setTimeout(() => setCopied(null), 2200);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 3000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-card)",
          border: "1.5px solid var(--border)",
          borderRadius: 22, padding: "28px 32px",
          width: "100%", maxWidth: 460,
          boxShadow: "0 24px 80px rgba(0,0,0,0.30)",
          animation: "tmScaleIn .3s cubic-bezier(.34,1.1,.64,1) both",
        }}
      >
        <div style={{
          fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18,
          color: "var(--text-main)", marginBottom: 4,
        }}>
          Compartilhar Canvas
        </div>
        <div style={{
          fontFamily: "'DM Sans',sans-serif", fontSize: 13,
          color: "var(--text-muted)", marginBottom: 22, lineHeight: 1.55,
        }}>
          Gere links de acesso. Colaboradores com link de edição sincronizam em tempo real.
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {["view", "edit"].map((mode) => (
            <button key={mode} onClick={() => create(mode)} className="tm-btn" style={{
              flex: 1,
              background: mode === "edit"
                ? "linear-gradient(135deg,#10b981,#059669)"
                : "rgba(16,185,129,0.08)",
              border: mode === "edit" ? "none" : "1px solid var(--border)",
              color: mode === "edit" ? "white" : "var(--text-sub)",
              borderRadius: 12, padding: "11px",
              fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 13,
              cursor: "pointer",
            }}>
              {mode === "edit" ? "＋ Link de Edição" : "＋ Visualização"}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{
            textAlign: "center", padding: 24,
            color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif", fontSize: 13,
          }}>
            Carregando…
          </div>
        ) : shares.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "20px",
            border: "1.5px dashed var(--border)", borderRadius: 13,
            color: "var(--text-muted)", fontFamily: "'DM Sans',sans-serif", fontSize: 13,
          }}>
            Nenhum link criado ainda
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {shares.map((s) => (
              <div key={s.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(16,185,129,0.04)", border: "1px solid var(--border)",
                borderRadius: 13, padding: "10px 14px",
              }}>
                <span style={{
                  fontSize: 10, fontFamily: "'DM Sans',sans-serif", fontWeight: 700,
                  letterSpacing: 1.2, textTransform: "uppercase", flexShrink: 0,
                  color: s.mode === "edit" ? "#10b981" : "var(--text-muted)",
                  background: s.mode === "edit" ? "rgba(16,185,129,0.12)" : "rgba(0,0,0,0.04)",
                  borderRadius: 6, padding: "2px 8px",
                }}>
                  {s.mode === "edit" ? "Edição" : "Visualização"}
                </span>
                <span style={{
                  flex: 1, fontSize: 11, color: "var(--text-muted)",
                  fontFamily: "monospace",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  /shared/{s.token.slice(0, 14)}…
                </span>
                <button onClick={() => copy(s.token)} className="tm-btn" style={{
                  background: "none", border: "1px solid var(--border)", borderRadius: 8,
                  padding: "4px 12px", cursor: "pointer", fontSize: 12,
                  color: "var(--text-sub)", fontFamily: "'DM Sans',sans-serif",
                  fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0,
                }}>
                  {copied === s.token ? "✓ Copiado!" : "Copiar"}
                </button>
                <button onClick={() => revoke(s.id)} className="tm-btn" style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#f87171", fontSize: 15, padding: "2px 4px", flexShrink: 0,
                }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <button onClick={onClose} className="tm-btn" style={{
          marginTop: 22, width: "100%", background: "none",
          border: "1px solid var(--border)", borderRadius: 12, padding: "11px",
          fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--text-muted)",
          cursor: "pointer",
        }}>
          Fechar
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  SIDEBAR: CANVASES
// ═══════════════════════════════════════════════
function CanvasSidebar({ canvases, activeId, onSelect, onCreate, onDelete, onRename, membersMap }) {
  const [renaming, setRenaming]   = useState(null);
  const [renameVal, setRenameVal] = useState("");

  return (
    <div style={{
      position: "fixed", left: 0, top: 56, bottom: 0, width: 224, zIndex: 500,
      background: "var(--bg-glass)", backdropFilter: "blur(20px) saturate(160%)",
      borderRight: "1.5px solid var(--border)",
      display: "flex", flexDirection: "column", padding: "14px 8px", gap: 3,
      overflowY: "auto",
    }}>
      <div style={{
        fontFamily: "'DM Sans',sans-serif", fontSize: 10.5, fontWeight: 700,
        color: "var(--text-muted)", letterSpacing: 1.8, textTransform: "uppercase",
        padding: "4px 10px", marginBottom: 6,
      }}>
        Workspaces
      </div>

      {canvases.map((c) => {
        const isActive = c.id === activeId;
        const members  = membersMap[c.id] || 0;
        return (
          <div key={c.id} style={{
            display: "flex", alignItems: "center", gap: 4, borderRadius: 11,
            background: isActive ? "rgba(16,185,129,0.13)" : "transparent",
            border: isActive ? "1px solid rgba(16,185,129,0.28)" : "1px solid transparent",
            padding: "2px 4px", transition: "all .15s",
          }}>
            {renaming === c.id ? (
              <input
                autoFocus value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onBlur={() => { onRename(c.id, renameVal); setRenaming(null); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter")  { onRename(c.id, renameVal); setRenaming(null); }
                  if (e.key === "Escape") setRenaming(null);
                }}
                style={{
                  flex: 1, border: "none", outline: "none", background: "transparent",
                  fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--text-main)",
                  padding: "7px 6px",
                }}
              />
            ) : (
              <button
                onClick={() => onSelect(c.id)}
                onDoubleClick={() => { setRenaming(c.id); setRenameVal(c.name); }}
                style={{
                  flex: 1, background: "none", border: "none", cursor: "pointer",
                  textAlign: "left", fontFamily: "'DM Sans',sans-serif", fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#10b981" : "var(--text-main)",
                  padding: "7px 8px", borderRadius: 9,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {c.name}
              </button>
            )}

            {members > 1 && (
              <span style={{
                fontSize: 10, color: "#10b981", background: "rgba(16,185,129,0.12)",
                borderRadius: 20, padding: "1px 6px", fontWeight: 600, flexShrink: 0,
                fontFamily: "'DM Sans',sans-serif",
              }}>
                {members}
              </span>
            )}

            {canvases.length > 1 && (
              <button
                onClick={() => onDelete(c.id)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#f87171", fontSize: 12, padding: "4px", borderRadius: 6,
                  opacity: 0.5, flexShrink: 0, transition: "opacity .15s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "0.5"}
              >
                ✕
              </button>
            )}
          </div>
        );
      })}

      <button onClick={onCreate} className="tm-btn" style={{
        marginTop: "auto",
        background: "rgba(16,185,129,0.07)",
        border: "1.5px dashed rgba(16,185,129,0.28)",
        borderRadius: 11, padding: "10px", cursor: "pointer",
        fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 500,
        color: "#10b981", textAlign: "center",
      }}>
        ＋ Novo Workspace
      </button>

      <div style={{
        fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "var(--text-muted)",
        textAlign: "center", padding: "4px 0",
      }}>
        Duplo clique para renomear
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  HOOK: WebSocket de colaboração (backoff exponencial)
// ═══════════════════════════════════════════════
function useCollabWS({ canvasId, shareToken, jwtToken, onPatch, onMembers }) {
  const wsRef      = useRef(null);
  const retryDelay = useRef(3000);
  const retryTimer = useRef(null);
  const unmounted  = useRef(false);

  const connect = useCallback(() => {
    if (!canvasId || unmounted.current) return;

    const params = new URLSearchParams();
    if (jwtToken)   params.set("jwt",   jwtToken);
    if (shareToken) params.set("share", shareToken);

    const ws = new WebSocket(`${WS_URL}/ws?${params}`);
    wsRef.current = ws;

    ws.onopen = () => {
      retryDelay.current = 3000;
      ws.send(JSON.stringify({ type: "join", canvasId }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "patch")   onPatch(msg.nodes);
        if (msg.type === "members") onMembers(canvasId, msg.count);
        if (msg.type === "joined")  onMembers(canvasId, msg.members);
      } catch (_) {}
    };

    ws.onclose = () => {
      if (unmounted.current) return;
      retryTimer.current = setTimeout(() => {
        retryDelay.current = Math.min(retryDelay.current * 1.5, 30_000);
        connect();
      }, retryDelay.current);
    };

    ws.onerror = () => {};
  }, [canvasId, shareToken, jwtToken, onPatch, onMembers]);

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      clearTimeout(retryTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendPatch = useCallback((nodes) => {
    const ws = wsRef.current;
    if (ws?.readyState === 1) {
      ws.send(JSON.stringify({ type: "patch", canvasId, nodes }));
    }
  }, [canvasId]);

  return { sendPatch };
}

// ═══════════════════════════════════════════════
//  TELA: CANVAS (APP PRINCIPAL)
// ═══════════════════════════════════════════════
function AppScreen() {
  const { user, setScreen, dark, setDark } = useContext(AppCtx);

  // Canvas state
  const [canvases,      setCanvases]      = useState([]);
  const [activeId,      setActiveId]      = useState(null);
  const [nodes,         setNodes]         = useState([]);
  const [past,          setPast]          = useState([]);
  const [future,        setFuture]        = useState([]);
  const [scale,         setScale]         = useState(1);
  const [pan,           setPan]           = useState({ x: 80, y: 80 });

  // UI state
  const [editingId,     setEditingId]     = useState(null);
  const [editVal,       setEditVal]       = useState("");
  const [selectedId,    setSelectedId]    = useState(null);
  const [bursts,        setBursts]        = useState([]);
  const [newId,         setNewId]         = useState(null);

  // Shared canvas
  const [sharedCanvasId, setSharedCanvasId] = useState(null);
  const [shareToken,    setShareToken]    = useState(null);
  const [readOnly,      setReadOnly]      = useState(false);

  // Save state
  const [saving,        setSaving]        = useState(false);
  const [saveError,     setSaveError]     = useState(false);
  const [lastSaved,     setLastSaved]     = useState(null);
  const [loading,       setLoading]       = useState(true);

  // Collab
  const [showShare,     setShowShare]     = useState(false);
  const [membersMap,    setMembersMap]    = useState({});

  // Refs (evitam re-render em handlers)
  const panRef     = useRef({ x: 80, y: 80 });
  const scaleRef   = useRef(1);
  const wrapRef    = useRef(null);
  const bgRef      = useRef(null);
  const isPanning  = useRef(false);
  const lastMouse  = useRef({ x: 0, y: 0 });
  const canPan     = useRef(false);
  const dragging   = useRef(null);
  const dragSaved  = useRef(false);
  const nodesRef   = useRef(nodes);
  const saveTimer  = useRef(null);
  const periodicTimer = useRef(null);
  const wsPatching = useRef(false);
  const saveRetries = useRef(0);

  nodesRef.current = nodes;
  useEffect(() => { panRef.current   = pan;   }, [pan]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);

  const onBgMove = useAnimatedBg(bgRef, dark);
  useEffect(() => { applyTheme(dark); }, [dark]);

  // ── Detecta acesso via link compartilhado ──
  useEffect(() => {
    const path = window.location.pathname;

    if (path.startsWith("/shared/")) {
      const token = path.replace("/shared/", "");

      if (!user || !Token.get()) {
        // Requer login — armazena token pendente
        localStorage.setItem("tm_pending_share", token);
        setScreen("login");
        return;
      }

      setShareToken(token);
      api(`/api/canvases/shared/${token}`)
        .then((data) => {
          setNodes(data.nodes);
          setSharedCanvasId(data.canvas.id);  // ← FIX: armazena o canvas.id real
          setReadOnly(data.mode === "view");
          setLoading(false);
        })
        .catch(() => setLoading(false));
      return;
    }

    if (!user) { setLoading(false); return; }

    api("/api/canvases").then(async (list) => {
      setCanvases(list);
      if (list.length > 0) {
        setActiveId(list[0].id);
        const n = await api(`/api/canvases/${list[0].id}/nodes`);
        setNodes(n);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user, setScreen]);

  // ── WebSocket colaboração ──
  const handleWsPatch = useCallback((incoming) => {
    wsPatching.current = true;
    setNodes(incoming);
    setTimeout(() => { wsPatching.current = false; }, 150);
  }, []);

  const handleMembers = useCallback((cid, count) => {
    setMembersMap((m) => ({ ...m, [cid]: count }));
  }, []);

  const { sendPatch } = useCollabWS({
    canvasId:  activeId || sharedCanvasId,  // ← FIX: usa sharedCanvasId
    shareToken,
    jwtToken:  Token.get(),
    onPatch:   handleWsPatch,
    onMembers: handleMembers,
  });

  // ── Salvar com retry ──
  const doSave = useCallback(async (nodesList) => {
    if (!activeId || readOnly) return;
    setSaving(true);
    setSaveError(false);
    try {
      await api(`/api/canvases/${activeId}/nodes`, {
        method: "PUT", body: { nodes: nodesList },
      });
      setLastSaved(new Date());
      setSaveError(false);
      saveRetries.current = 0;
    } catch {
      saveRetries.current++;
      setSaveError(true);
      if (saveRetries.current < 3) {
        setTimeout(() => doSave(nodesList), 2000 * saveRetries.current);
      }
    } finally {
      setSaving(false);
    }
  }, [activeId, readOnly]);

  // ── Auto-save + broadcast ──
  useEffect(() => {
    if ((!activeId && !sharedCanvasId) || loading || wsPatching.current) return;
    if (readOnly) return;
    clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      if (activeId) await doSave(nodes);
      sendPatch(nodes);
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [nodes, activeId, sharedCanvasId, loading, readOnly, sendPatch, doSave]);

  // ── Save em visibilitychange (switching abas) ──
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && activeId && !readOnly) {
        clearTimeout(saveTimer.current);
        doSave(nodesRef.current);
        sendPatch(nodesRef.current);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [activeId, readOnly, doSave, sendPatch]);

  // ── Periodic sync a cada 60s como fallback ──
  useEffect(() => {
    if (!activeId || readOnly) return;
    periodicTimer.current = setInterval(() => {
      if (!wsPatching.current) doSave(nodesRef.current);
    }, 60_000);
    return () => clearInterval(periodicTimer.current);
  }, [activeId, readOnly, doSave]);

  // ── Save ao fechar/refresh a página ──
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (saving || saveError) {
        e.preventDefault();
        e.returnValue = "Suas alterações estão sendo salvas…";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saving, saveError]);

  // ── Sair do modo compartilhado ──
  const exitSharedMode = useCallback(async () => {
    window.history.replaceState(null, "", "/");
    setShareToken(null);
    setSharedCanvasId(null);
    setReadOnly(false);
    setNodes([]);
    setPast([]); setFuture([]);
    setLoading(true);

    if (user) {
      try {
        const list = await api("/api/canvases");
        setCanvases(list);
        if (list.length > 0) {
          setActiveId(list[0].id);
          const n = await api(`/api/canvases/${list[0].id}/nodes`);
          setNodes(n);
        }
      } catch (_) {}
    }
    setLoading(false);
  }, [user]);

  // ── Trocar canvas ──
  const switchCanvas = useCallback(async (id) => {
    setActiveId(id); setLoading(true); setSelectedId(null);
    const n = await api(`/api/canvases/${id}/nodes`);
    setNodes(n); setPast([]); setFuture([]);
    setLoading(false);
  }, []);

  // ── Ações de canvas ──
  const createCanvas = async () => {
    const name = prompt("Nome do novo workspace:", "Novo Workspace");
    if (!name) return;
    const c = await api("/api/canvases", { method: "POST", body: { name } });
    setCanvases((p) => [...p, c]);
    switchCanvas(c.id);
  };

  const deleteCanvas = async (id) => {
    if (!confirm("Excluir workspace e todas as suas tarefas?")) return;
    await api(`/api/canvases/${id}`, { method: "DELETE" });
    const next = canvases.filter((c) => c.id !== id);
    setCanvases(next);
    if (activeId === id && next.length > 0) switchCanvas(next[0].id);
  };

  const renameCanvas = async (id, name) => {
    if (!name.trim()) return;
    const updated = await api(`/api/canvases/${id}`, { method: "PATCH", body: { name } });
    setCanvases((p) => p.map((c) => c.id === id ? { ...c, name: updated.name } : c));
  };

  // ── Histórico ──
  const saveHistory = useCallback((next) => {
    setPast((p) => [...p.slice(-50), nodesRef.current]);
    setFuture([]);
    setNodes(next);
  }, []);

  const undo = useCallback(() => setPast((p) => {
    if (!p.length) return p;
    const prev = p[p.length - 1];
    setFuture((f) => [nodesRef.current, ...f]);
    setNodes(prev); return p.slice(0, -1);
  }), []);

  const redo = useCallback(() => setFuture((f) => {
    if (!f.length) return f;
    const next = f[0];
    setPast((p) => [...p, nodesRef.current]);
    setNodes(next); return f.slice(1);
  }), []);

  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === "INPUT") return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z")  { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) {
        e.preventDefault(); redo();
      }
      if (e.key === "Escape") setSelectedId(null);
      if (e.key === "Delete" && selectedId && !readOnly) {
        soundDelete();
        const del = getDescendants(nodesRef.current, selectedId);
        saveHistory(nodesRef.current.filter((n) => !del.has(n.id)));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, redo, selectedId, readOnly, saveHistory]);

  // ── Nós ──
  const addNode = useCallback((parentId = null, cx = null, cy = null) => {
    const id = uid();
    const w  = wrapRef.current?.clientWidth  ?? 900;
    const h  = wrapRef.current?.clientHeight ?? 600;

    let baseX, baseY;
    const isChild = !!parentId;

    if (parentId) {
      const parent   = nodesRef.current.find((n) => n.id === parentId);
      const siblings = nodesRef.current.filter((n) => n.parentId === parentId);
      if (parent) {
        const parentIsChild = !!parent.parentId;
        const parentH = parentIsChild ? NODE_H_CHILD : NODE_H;

        if (siblings.length === 0) {
          // Primeiro filho: centralizado sob o pai
          baseX = parent.x + Math.floor((NODE_W - NODE_W_CHILD) / 2);
          baseY = parent.y + parentH + NODE_GAP_Y;
        } else {
          // Próximos filhos: abaixo do último irmão
          const lastSib = siblings[siblings.length - 1];
          baseX = lastSib.x;
          baseY = lastSib.y + NODE_H_CHILD + Math.floor(NODE_GAP_Y * 0.55);
        }
      } else {
        baseX = cx ?? 80; baseY = cy ?? 80;
      }
      soundSubtaskCreate();
    } else {
      baseX = cx ?? (-panRef.current.x + w / 2) / scaleRef.current - NODE_W / 2;
      baseY = cy ?? (-panRef.current.y + h / 2) / scaleRef.current - NODE_H / 2;
      soundNodeCreate();
    }

    const { x, y } = findFreePosition(nodesRef.current, baseX, baseY, isChild);
    const node = { id, title: "", x, y, priority: "none", completed: false, parentId, dueDate: null };
    saveHistory([...nodesRef.current, node]);
    setEditingId(id); setEditVal("");
    setNewId(id); setTimeout(() => setNewId(null), 500);
    setSelectedId(id);
  }, [saveHistory]);

  const finishEdit = useCallback((id, title, dueDate) => {
    if (dueDate !== undefined) {
      saveHistory(nodesRef.current.map((n) => n.id === id ? { ...n, dueDate } : n));
      return;
    }
    if (!title.trim()) saveHistory(nodesRef.current.filter((n) => n.id !== id));
    else               saveHistory(nodesRef.current.map((n) => n.id === id ? { ...n, title } : n));
    setEditingId(null);
  }, [saveHistory]);

  const deleteNode = useCallback((id) => {
    soundDelete();
    const del = getDescendants(nodesRef.current, id);
    saveHistory(nodesRef.current.filter((n) => !del.has(n.id)));
    setSelectedId(null);
  }, [saveHistory]);

  const completeNode = useCallback((id) => {
    const node = nodesRef.current.find((n) => n.id === id);
    if (!node) return;
    const done = !node.completed;
    saveHistory(nodesRef.current.map((n) => n.id === id ? { ...n, completed: done } : n));
    if (done) {
      soundNodeComplete();
      const bId = uid();
      setBursts((b) => [...b, { id: bId, x: node.x + nodeWidth(node) / 2, y: node.y + nodeHeight(node) / 2 }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== bId)), 800);
    }
  }, [saveHistory]);

  const cyclePriority = useCallback((id) => {
    const node = nodesRef.current.find((n) => n.id === id);
    if (!node || node.parentId) return; // subtarefas não têm prioridade
    const next = PRIORITY.order[(PRIORITY.order.indexOf(node.priority) + 1) % PRIORITY.order.length];
    saveHistory(nodesRef.current.map((n) => n.id === id ? { ...n, priority: next } : n));
  }, [saveHistory]);

  // ── Fit to screen ──
  const fitToScreen = useCallback((nodeList) => {
    const nList = nodeList || nodesRef.current;
    if (!nList.length) return;
    const wrapW = wrapRef.current?.clientWidth  ?? 900;
    const wrapH = wrapRef.current?.clientHeight ?? 600;
    const PAD   = 90;

    const minX = Math.min(...nList.map((n) => n.x)) - PAD;
    const maxX = Math.max(...nList.map((n) => n.x + nodeWidth(n)))  + PAD;
    const minY = Math.min(...nList.map((n) => n.y)) - PAD;
    const maxY = Math.max(...nList.map((n) => n.y + nodeHeight(n))) + PAD;

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const newScale = Math.min(wrapW / contentW, wrapH / contentH, 1.4);

    setPan({
      x: (wrapW - contentW * newScale) / 2 - minX * newScale,
      y: (wrapH - contentH * newScale) / 2 - minY * newScale,
    });
    setScale(newScale);
  }, []);

  // ── Organizar em árvore (prioridade + vertical subtasks + fit) ──
  const organizeTree = useCallback(() => {
    const ORDER  = ["high", "medium", "low", "none"];
    const result = [...nodesRef.current];

    // Apenas raízes, ordenadas por prioridade
    const roots = result
      .filter((n) => !n.parentId)
      .sort((a, b) => ORDER.indexOf(a.priority) - ORDER.indexOf(b.priority));

    // Calcula altura total de uma sub-árvore para espaçamento vertical
    function subtreeH(nodeId, depth = 0) {
      const children = result.filter((n) => n.parentId === nodeId);
      const selfH = depth === 0 ? NODE_H : NODE_H_CHILD;
      if (!children.length) return selfH;
      const gap = depth === 0 ? NODE_GAP_Y : Math.floor(NODE_GAP_Y * 0.55);
      const childTotal = children.reduce((acc, c) => {
        return acc + subtreeH(c.id, depth + 1) + Math.floor(NODE_GAP_Y * 0.45);
      }, 0);
      return selfH + gap + childTotal;
    }

    function placeSubtree(nodeId, x, y, depth = 0) {
      const idx = result.findIndex((n) => n.id === nodeId);
      if (idx === -1) return y;
      const isChild   = depth > 0;
      const nodeH     = isChild ? NODE_H_CHILD : NODE_H;
      const nodeX     = isChild ? x + Math.floor((NODE_W - NODE_W_CHILD) / 2) : x;
      result[idx]     = { ...result[idx], x: nodeX, y };

      const children  = result.filter((n) => n.parentId === nodeId);
      const gapY      = depth === 0 ? NODE_GAP_Y : Math.floor(NODE_GAP_Y * 0.55);
      let curY        = y + nodeH + gapY;

      children.forEach((child) => {
        const after = placeSubtree(child.id, nodeX, curY, depth + 1);
        curY = after + Math.floor(NODE_GAP_Y * 0.45);
      });

      return curY;
    }

    const COL_GAP = NODE_W + NODE_GAP_X * 2;
    let colX      = 60;

    roots.forEach((root) => {
      placeSubtree(root.id, colX, 60);
      colX += COL_GAP;
    });

    saveHistory(result);
    // Fit após organizar (aguarda re-render)
    setTimeout(() => fitToScreen(result), 60);
  }, [saveHistory, fitToScreen]);

  // ── Eventos do canvas ──
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const rect   = wrapRef.current.getBoundingClientRect();
    const mx     = e.clientX - rect.left;
    const my     = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const oldS   = scaleRef.current;
    const newS   = Math.min(Math.max(oldS * factor, 0.1), 5);
    const ratio  = newS / oldS;
    setPan((p) => ({ x: mx - (mx - p.x) * ratio, y: my - (my - p.y) * ratio }));
    setScale(newS);
  }, []);

  const onCanvasDown = useCallback((e) => {
    if (e.button !== 0) return;
    const isCanvas = e.target === wrapRef.current || e.target.dataset.canvas;
    if (isCanvas) {
      canPan.current    = true;
      isPanning.current = false;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      setSelectedId(null);
    }
  }, []);

  const startDrag = useCallback((e, id) => {
    if (e.button !== 0 || readOnly) return;
    e.stopPropagation();
    const node = nodesRef.current.find((n) => n.id === id);
    if (!node) return;
    canPan.current = false;
    const rect = wrapRef.current.getBoundingClientRect();
    const mx   = (e.clientX - rect.left  - panRef.current.x) / scaleRef.current;
    const my   = (e.clientY - rect.top   - panRef.current.y) / scaleRef.current;
    dragging.current  = { id, ox: mx - node.x, oy: my - node.y };
    dragSaved.current = false;
  }, [readOnly]);

  const onMouseMove = useCallback((e) => {
    onBgMove(e);

    if (dragging.current) {
      if (!dragSaved.current) {
        setPast((p) => [...p.slice(-50), nodesRef.current]);
        setFuture([]); dragSaved.current = true;
      }
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx   = (e.clientX - rect.left - panRef.current.x) / scaleRef.current;
      const my   = (e.clientY - rect.top  - panRef.current.y) / scaleRef.current;
      const drag = dragging.current;
      setNodes((ns) => ns.map((n) =>
        n.id === drag.id ? { ...n, x: mx - drag.ox, y: my - drag.oy } : n
      ));
      return;
    }

    if (canPan.current) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      if (!isPanning.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4))
        isPanning.current = true;
      if (isPanning.current) {
        setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
        lastMouse.current = { x: e.clientX, y: e.clientY };
      }
    }
  }, [onBgMove]);

  const onMouseUp = useCallback(() => {
    dragging.current  = null;
    canPan.current    = false;
    isPanning.current = false;
  }, []);

  const onDblClick = useCallback((e) => {
    if (readOnly) return;
    if (!e.target.dataset.canvas && e.target !== wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x    = (e.clientX - rect.left - panRef.current.x) / scaleRef.current - NODE_W / 2;
    const y    = (e.clientY - rect.top  - panRef.current.y) / scaleRef.current - NODE_H / 2;
    addNode(null, x, y);
  }, [addNode, readOnly]);

  // ── Toolbar actions ──
  const makeIndependent = useCallback(() =>
    saveHistory(nodes.map((n) => ({ ...n, parentId: null }))), [nodes, saveHistory]);

  const exportCanvas = useCallback(() => {
    const blob = new Blob(
      [JSON.stringify({ nodes, version: 2 }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href = url; a.download = "taskmaster.json"; a.click();
    URL.revokeObjectURL(url);
  }, [nodes]);

  const importCanvas = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try { saveHistory(JSON.parse(ev.target.result).nodes || []); } catch (_) {}
      };
      reader.readAsText(file);
    };
    input.click();
  }, [saveHistory]);

  const toggleDark = async () => {
    const next = !dark; setDark(next);
    if (user) {
      try { await api("/api/auth/me/darkmode", { method: "PATCH", body: { darkMode: next } }); }
      catch (_) {}
    }
  };

  const handleLogout = async () => {
    try { await api("/api/auth/logout", { method: "POST" }); } catch (_) {}
    Token.clear(); setScreen("login");
  };

  // ── Derivados ──
  const connections = nodes
    .filter((n) => n.parentId && nodes.find((p) => p.id === n.parentId))
    .map((n) => ({ child: n, parent: nodes.find((p) => p.id === n.parentId) }));

  const completed     = nodes.filter((n) => n.completed).length;
  const overdueCt     = nodes.filter((n) => isOverdue(n.dueDate) && !n.completed).length;
  const isShared      = !!shareToken;
  const hasSidebar    = !isShared && canvases.length > 0 && !!user;
  const sideW         = hasSidebar ? 224 : 0;
  const activeMembers = membersMap[activeId || sharedCanvasId || ""] || 0;

  if (loading) return (
    <div style={{
      width: "100%", height: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "var(--bg-card)",
      fontFamily: "'DM Sans',sans-serif", color: "#10b981", fontSize: 15, gap: 10,
    }}>
      <span style={{ animation: "tmSpin 1s linear infinite", display: "inline-block", fontSize: 22 }}>⟳</span>
      Carregando workspace…
    </div>
  );

  return (
    <div
      ref={bgRef}
      style={{ width: "100%", height: "100vh", overflow: "hidden", position: "relative", userSelect: "none" }}
    >
      {showShare && activeId && <ShareModal canvasId={activeId} onClose={() => setShowShare(false)} />}

      {hasSidebar && (
        <CanvasSidebar
          canvases={canvases} activeId={activeId} membersMap={membersMap}
          onSelect={switchCanvas} onCreate={createCanvas}
          onDelete={deleteCanvas} onRename={renameCanvas}
        />
      )}

      {/* ── HEADER ── */}
      <header style={{
        position: "fixed", top: 0, left: sideW, right: 0, zIndex: 1000,
        display: "flex", alignItems: "center", gap: 6, padding: "9px 16px",
        backdropFilter: "blur(28px) saturate(160%)",
        background: "var(--bg-glass)",
        borderBottom: "1.5px solid var(--border)",
        boxShadow: "0 2px 20px rgba(16,185,129,0.06)",
        fontFamily: "'DM Sans',sans-serif",
        transition: "left .2s",
      }}>
        {/* Logo */}
        <div style={{
          fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 19,
          color: "var(--text-main)", letterSpacing: -0.8,
          display: "flex", alignItems: "baseline", gap: 2,
        }}>
          TM
          <span style={{
            fontSize: 8.5, fontFamily: "'DM Sans',sans-serif", fontWeight: 400,
            color: "#6ee7b7", marginLeft: 4, letterSpacing: 2, textTransform: "uppercase",
          }}>taskmaster</span>
        </div>

        {/* Badges de modo */}
        {isShared && (
          <span style={{
            fontSize: 10.5, background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.3)", color: "#10b981",
            borderRadius: 20, padding: "3px 10px", fontWeight: 700, letterSpacing: 0.8,
          }}>
            {readOnly ? "SOMENTE LEITURA" : "✦ EDIÇÃO COLABORATIVA"}
          </span>
        )}

        {activeMembers > 1 && !isShared && (
          <span style={{
            fontSize: 10.5, background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.22)", color: "#10b981",
            borderRadius: 20, padding: "3px 10px", fontWeight: 600,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: "#10b981",
              animation: "tmPulse 2s ease infinite", display: "inline-block",
            }} />
            {activeMembers} online
          </span>
        )}

        <div style={{ width: 1, height: 22, background: "var(--border)", margin: "0 2px" }} />

        {/* Ações principais */}
        {!readOnly && (
          <button className="tm-btn" onClick={() => addNode()} style={{
            background: "linear-gradient(135deg,#10b981,#059669)", color: "white",
            border: "none", cursor: "pointer", borderRadius: 10, padding: "7px 15px",
            fontWeight: 700, fontSize: 13, boxShadow: "0 2px 10px rgba(16,185,129,0.30)",
          }}>
            ＋ Nova Tarefa
          </button>
        )}

        {!readOnly && [
          { label: "↩", action: undo,  enabled: past.length > 0,   title: "Desfazer (Ctrl+Z)" },
          { label: "↪", action: redo,  enabled: future.length > 0, title: "Refazer (Ctrl+Y)" },
        ].map((b) => (
          <button key={b.label} className="tm-btn" onClick={b.action}
            disabled={!b.enabled} title={b.title}
            style={{
              background: "rgba(16,185,129,0.07)", color: "var(--text-sub)",
              border: "1px solid var(--border)", cursor: b.enabled ? "pointer" : "not-allowed",
              borderRadius: 9, padding: "6px 10px",
              fontWeight: 600, fontSize: 14, opacity: b.enabled ? 1 : 0.3,
            }}
          >
            {b.label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Indicador de save */}
        {saveError && (
          <button
            onClick={() => doSave(nodesRef.current)}
            style={{
              display: "flex", alignItems: "center", gap: 5, fontSize: 11,
              color: "#f87171", background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8,
              padding: "4px 10px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
            }}
          >
            ⚠ Erro ao salvar — clique para tentar novamente
          </button>
        )}
        {saving && !saveError && (
          <span style={{ fontSize: 11, color: "#6ee7b7", animation: "tmPulse 1.2s ease infinite" }}>
            ● salvando…
          </span>
        )}
        {lastSaved && !saving && !saveError && (
          <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
            ✓ salvo {lastSaved.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}

        {!readOnly && [
          { label: "⬚ Organizar",     action: organizeTree,          title: "Organizar em árvore + centralizar" },
          { label: "⊡ Desconectar",   action: makeIndependent,       title: "Remover conexões" },
          { label: "⊞ Centralizar",   action: () => fitToScreen(),   title: "Centralizar visão" },
          { label: "↑ Exportar",      action: exportCanvas,          title: "Exportar JSON" },
          { label: "↓ Importar",      action: importCanvas,          title: "Importar JSON" },
          { label: "🗑 Limpar",       action: () => saveHistory([]), title: "Excluir tudo", danger: true },
        ].map((b) => (
          <button key={b.label} className="tm-btn" onClick={b.action} title={b.title} style={{
            background: b.danger ? "rgba(239,68,68,0.07)" : "rgba(16,185,129,0.07)",
            color:      b.danger ? "#f87171" : "var(--text-sub)",
            border: "1px solid var(--border)",
            cursor: "pointer", borderRadius: 9, padding: "6px 11px",
            fontWeight: 500, fontSize: 12,
          }}>
            {b.label}
          </button>
        ))}

        {activeId && !readOnly && (
          <button className="tm-btn" onClick={() => setShowShare(true)} style={{
            background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.28)",
            color: "#10b981", borderRadius: 9, padding: "6px 12px",
            fontWeight: 600, fontSize: 12, cursor: "pointer",
          }}>
            🔗 Compartilhar
          </button>
        )}

        {/* Sair do modo compartilhado */}
        {isShared && (
          <button className="tm-btn" onClick={exitSharedMode} style={{
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
            color: "#f87171", borderRadius: 9, padding: "6px 12px",
            fontWeight: 600, fontSize: 12, cursor: "pointer",
          }}>
            ← Sair do compartilhado
          </button>
        )}

        <button className="tm-btn" onClick={toggleDark} title={dark ? "Modo claro" : "Modo escuro"} style={{
          background: "rgba(16,185,129,0.07)", border: "1px solid var(--border)",
          cursor: "pointer", borderRadius: 9, padding: "6px 8px", fontSize: 15,
        }}>
          {dark ? "☀️" : "🌙"}
        </button>

        <div style={{ width: 1, height: 22, background: "var(--border)", margin: "0 2px" }} />

        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            {user.photo
              ? <img src={user.photo} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "1.5px solid var(--border)" }} />
              : <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "linear-gradient(135deg,#10b981,#059669)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", fontWeight: 700, fontSize: 12, fontFamily: "'Syne',sans-serif",
                }}>
                  {user.name?.[0]?.toUpperCase() || "U"}
                </div>
            }
            <span style={{ fontSize: 12.5, color: "var(--text-main)", fontWeight: 500, maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.name}
            </span>
            <button className="tm-btn" onClick={handleLogout} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", fontSize: 11.5, padding: "3px 6px",
            }}>
              Sair
            </button>
          </div>
        )}
      </header>

      {/* ── CANVAS ── */}
      <div
        ref={wrapRef}
        data-canvas="true"
        style={{
          position: "absolute", inset: 0, top: 54, left: sideW,
          overflow: "hidden",
          cursor: isPanning.current ? "grabbing" : "crosshair",
          transition: "left .2s",
        }}
        onMouseDown={onCanvasDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        onDoubleClick={onDblClick}
      >
        {/* Grid de pontos */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          <defs>
            <pattern id="tmGrid"
              x={pan.x % (24 * scale)} y={pan.y % (24 * scale)}
              width={24 * scale} height={24 * scale}
              patternUnits="userSpaceOnUse">
              <circle cx={1} cy={1} r={1}
                fill={dark ? "rgba(16,185,129,0.09)" : "rgba(16,185,129,0.16)"} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#tmGrid)" />
        </svg>

        {/* Camada transformável */}
        <div data-canvas="true" style={{
          position: "absolute", top: 0, left: 0,
          transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`,
          transformOrigin: "0 0", width: 10000, height: 10000,
        }}>
          {/* Linhas de conexão */}
          <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
            <defs>
              <marker id="tmArrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                <path d="M0,0 L0,7 L7,3.5 z" fill="rgba(16,185,129,0.45)" />
              </marker>
            </defs>
            {connections.map(({ parent, child }) => {
              const pw = nodeWidth(parent);
              const ch = nodeHeight(child);
              const ph = nodeHeight(parent);
              const x1 = parent.x + pw / 2;
              const y1 = parent.y + ph;
              const x2 = child.x  + nodeWidth(child) / 2;
              const y2 = child.y;
              const ym = (y1 + y2) / 2;
              return (
                <path
                  key={`${parent.id}-${child.id}`}
                  d={`M ${x1} ${y1} C ${x1} ${ym}, ${x2} ${ym}, ${x2} ${y2}`}
                  fill="none"
                  stroke={dark ? "rgba(16,185,129,0.32)" : "rgba(16,185,129,0.42)"}
                  strokeWidth={1.6}
                  strokeDasharray="8 5"
                  markerEnd="url(#tmArrow)"
                />
              );
            })}
          </svg>

          {/* Partículas */}
          {bursts.map((b) => <BurstEffect key={b.id} x={b.x} y={b.y} />)}

          {/* Nós */}
          {nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node} dark={dark}
              isEditing={editingId === node.id}
              editVal={editVal} setEditVal={setEditVal}
              isNew={node.id === newId}
              readOnly={readOnly}
              isSelected={selectedId === node.id}
              isChild={!!node.parentId}
              onSelect={() => setSelectedId(node.id)}
              onFinishEdit={(title, dueDate) => finishEdit(node.id, title, dueDate)}
              onStartEdit={() => { setEditingId(node.id); setEditVal(node.title); }}
              onDelete={() => deleteNode(node.id)}
              onComplete={() => completeNode(node.id)}
              onCyclePriority={() => cyclePriority(node.id)}
              onAddChild={() => addNode(node.id)}
              onDragStart={(e) => startDrag(e, node.id)}
            />
          ))}
        </div>
      </div>

      {/* ── INDICADORES ── */}
      {nodes.length === 0 && !readOnly && (
        <div style={{
          position: "fixed", bottom: 48, left: "50%", transform: "translateX(-50%)",
          background: "var(--bg-glass)", backdropFilter: "blur(14px)",
          border: "1.5px dashed var(--border)", borderRadius: 14, padding: "12px 28px",
          pointerEvents: "none", color: "#059669", fontSize: 13.5, fontWeight: 500,
          fontFamily: "'DM Sans',sans-serif",
        }}>
          Duplo clique no canvas para criar uma tarefa ✦
        </div>
      )}

      {/* Zoom indicator */}
      <div style={{
        position: "fixed", bottom: 18, right: 18, zIndex: 100,
        background: "var(--bg-glass)", backdropFilter: "blur(12px)",
        border: "1px solid var(--border)", borderRadius: 10, padding: "5px 12px",
        fontFamily: "'DM Sans',sans-serif", color: "var(--text-sub)", fontSize: 12, fontWeight: 600,
      }}>
        {Math.round(scale * 100)}%
      </div>

      {/* Stats */}
      {nodes.length > 0 && (
        <div style={{
          position: "fixed", bottom: 18, left: sideW + 18, zIndex: 100,
          background: "var(--bg-glass)", backdropFilter: "blur(12px)",
          border: "1px solid var(--border)", borderRadius: 10, padding: "5px 14px",
          fontFamily: "'DM Sans',sans-serif", color: "var(--text-sub)", fontSize: 12,
          display: "flex", gap: 12, transition: "left .2s",
        }}>
          <span>📋 {nodes.length} {nodes.length === 1 ? "tarefa" : "tarefas"}</span>
          <span>✓ {completed} concluídas</span>
          {overdueCt > 0 && <span style={{ color: "#ef4444" }}>⚠ {overdueCt} atrasadas</span>}
          {selectedId && <span style={{ color: "#10b981" }}>✦ selecionado</span>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
//  TELA: LOGIN — repaginada
// ═══════════════════════════════════════════════
function TypewriterSubtitle() {
  const [index, setIndex]         = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [phase, setPhase]         = useState("typing");
  const t = useRef(null);

  useEffect(() => {
    const current = SUBTITLES[index];
    if (phase === "typing") {
      if (displayed.length < current.length)
        t.current = setTimeout(() => setDisplayed(current.slice(0, displayed.length + 1)), 46);
      else t.current = setTimeout(() => setPhase("pause"), 2600);
    } else if (phase === "pause") {
      t.current = setTimeout(() => setPhase("erasing"), 500);
    } else if (phase === "erasing") {
      if (displayed.length > 0)
        t.current = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 26);
      else { setIndex((i) => (i + 1) % SUBTITLES.length); setPhase("typing"); }
    }
    return () => clearTimeout(t.current);
  }, [displayed, phase, index]);

  return (
    <div style={{
      fontFamily: "'DM Sans',sans-serif", fontSize: "clamp(14px,1.8vw,18px)",
      fontWeight: 400, color: "var(--text-sub)", minHeight: 32, letterSpacing: 0.2,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span>{displayed}</span>
      <span style={{
        display: "inline-block", width: 2, height: "1.1em",
        background: "#10b981", borderRadius: 2, marginLeft: 2,
        animation: "tmBlink 1s step-end infinite", verticalAlign: "middle",
      }} />
    </div>
  );
}

function FloatingNode({ x, y, size, delay, dark }) {
  return (
    <div style={{
      position: "absolute", left: `${x}%`, top: `${y}%`, width: size,
      borderRadius: 14, background: "var(--bg-card)",
      border: "1.5px solid var(--border)",
      boxShadow: dark
        ? "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(16,185,129,0.06)"
        : "0 8px 24px rgba(16,185,129,0.09), 0 1px 4px rgba(0,0,0,0.04)",
      padding: "13px 16px",
      pointerEvents: "none", backdropFilter: "blur(8px)",
      animation: `tmFloat 8s ease-in-out ${delay}s infinite`, opacity: 0.7,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 4, height: 32, borderRadius: 4, background: "linear-gradient(180deg,#10b981,#059669)", flexShrink: 0 }} />
        <div>
          <div style={{ height: 7, width: "72%", background: "rgba(16,185,129,0.22)", borderRadius: 4, marginBottom: 5 }} />
          <div style={{ height: 5, width: "48%", background: "rgba(16,185,129,0.12)", borderRadius: 4 }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(16,185,129,0.35)" }} />
        <div style={{ height: 5, width: "36%", background: "rgba(16,185,129,0.12)", borderRadius: 4 }} />
        <div style={{ marginLeft: "auto", fontSize: 9, color: "rgba(16,185,129,0.5)", fontFamily: "monospace" }}>✦</div>
      </div>
    </div>
  );
}

function LoginScreen() {
  const { setUser, setScreen, dark, setDark } = useContext(AppCtx);
  const bgRef    = useRef(null);
  const onBgMove = useAnimatedBg(bgRef, dark);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [error, setError]             = useState(null);
  const pendingShare = localStorage.getItem("tm_pending_share");

  useEffect(() => { applyTheme(dark); }, [dark]);

  // Verifica token existente (sessão salva)
  useEffect(() => {
    const token = Token.get();
    if (!token) { setLoadingAuth(false); return; }

    api("/api/auth/me")
      .then(async (u) => {
        if (u.darkMode) setDark(true);
        setUser(u);
        // Redireciona para share pendente se houver
        if (pendingShare) {
          localStorage.removeItem("tm_pending_share");
          window.history.replaceState(null, "", `/shared/${pendingShare}`);
        }
        setScreen("app");
      })
      .catch(() => { Token.clear(); setLoadingAuth(false); });
  }, []); // eslint-disable-line

  const handleGoogleSuccess = async (res) => {
    setLoadingLogin(true); setError(null);
    try {
      const { token, user } = await api("/api/auth/google", {
        method: "POST", body: { credential: res.credential },
      });
      Token.set(token);
      if (user.darkMode) setDark(true);
      setUser(user);
      if (pendingShare) {
        localStorage.removeItem("tm_pending_share");
        window.history.replaceState(null, "", `/shared/${pendingShare}`);
      }
      setScreen("app");
    } catch (e) { setError(e.message); }
    finally { setLoadingLogin(false); }
  };

  const handleSkip = () => {
    if (pendingShare) {
      setError("Para acessar um workspace compartilhado, você precisa fazer login com o Google.");
      return;
    }
    setUser({ id: "anonymous", name: "Visitante", email: null, photo: null });
    setScreen("app");
  };

  const floaters = [
    { x: 3,  y: 18, size: 144, delay: 0   },
    { x: 85, y: 8,  size: 122, delay: 1.4 },
    { x: 1,  y: 62, size: 132, delay: 2.3 },
    { x: 83, y: 58, size: 148, delay: 0.9 },
    { x: 75, y: 32, size: 112, delay: 2.0 },
    { x: 10, y: 40, size: 124, delay: 3.2 },
  ];

  if (loadingAuth) return (
    <div style={{
      width: "100%", height: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: dark ? "#030807" : "#f0fdf4",
      fontFamily: "'DM Sans',sans-serif", color: "#10b981", fontSize: 14, gap: 10,
    }}>
      <span style={{ animation: "tmSpin 1s linear infinite", display: "inline-block", fontSize: 20 }}>⟳</span>
      Verificando sessão…
    </div>
  );

  return (
    <div
      ref={bgRef} onMouseMove={onBgMove}
      style={{ width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}
    >
      {/* Dot grid */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `radial-gradient(circle,rgba(16,185,129,${dark ? .07 : .16}) 1px,transparent 1px)`,
        backgroundSize: "26px 26px",
      }} />

      {floaters.map((f, i) => <FloatingNode key={i} {...f} dark={dark} />)}

      {/* Toggle dark */}
      <button onClick={() => setDark((d) => !d)} style={{
        position: "fixed", top: 18, right: 18, zIndex: 200,
        background: "var(--bg-glass)", backdropFilter: "blur(10px)",
        border: "1px solid var(--border)", borderRadius: 10,
        padding: "8px 10px", fontSize: 16, cursor: "pointer",
      }}>
        {dark ? "☀️" : "🌙"}
      </button>

      <main style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "60px 20px 40px", position: "relative", zIndex: 10, gap: 48,
      }}>
        {/* Hero */}
        <div style={{ textAlign: "center" }}>
          {pendingShare && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(16,185,129,0.11)", border: "1px solid rgba(16,185,129,0.28)",
              borderRadius: 100, padding: "5px 16px", marginBottom: 22,
              fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600,
              color: "#059669", letterSpacing: 0.5,
            }}>
              <span>🔗</span>
              Faça login para acessar o workspace compartilhado
            </div>
          )}

          {!pendingShare && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.22)",
              borderRadius: 100, padding: "5px 18px", marginBottom: 22,
              fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700,
              color: "#059669", letterSpacing: 1.4, textTransform: "uppercase",
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%", background: "#10b981",
                display: "inline-block", boxShadow: "0 0 6px #10b981",
                animation: "tmBlink 2s ease infinite",
              }} />
              Workspace visual inteligente
            </div>
          )}

          <div style={{
            fontFamily: "'Syne',sans-serif", fontWeight: 900,
            fontSize: "clamp(52px,9vw,104px)",
            color: "var(--text-main)", letterSpacing: -3, lineHeight: 1,
            marginBottom: 18, animation: "tmFadeUp .65s ease both",
          }}>
            TaskMaster
          </div>

          <div style={{ animation: "tmFadeUp .65s ease .14s both" }}>
            <TypewriterSubtitle />
          </div>
        </div>

        {/* Card de login */}
        <div style={{
          background: "var(--bg-card)", backdropFilter: "blur(28px) saturate(160%)",
          border: "1.5px solid var(--border)", borderRadius: 24,
          padding: "36px 40px", width: "100%", maxWidth: 400,
          boxShadow: dark
            ? "0 12px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(16,185,129,0.1)"
            : "0 10px 52px rgba(16,185,129,0.12), 0 2px 8px rgba(0,0,0,0.04)",
          display: "flex", flexDirection: "column", gap: 14,
          animation: "tmScaleIn .5s cubic-bezier(.34,1.1,.64,1) .18s both",
        }}>
          <div style={{
            fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20,
            color: "var(--text-main)", textAlign: "center",
          }}>
            {pendingShare ? "Login necessário" : "Começar agora"}
          </div>
          <div style={{
            fontFamily: "'DM Sans',sans-serif", fontSize: 13,
            color: "var(--text-muted)", textAlign: "center", marginBottom: 4,
            lineHeight: 1.55,
          }}>
            {pendingShare
              ? "Entre com sua conta Google para acessar o workspace compartilhado."
              : "Entre com sua conta para salvar seus workspaces e colaborar em tempo real."
            }
          </div>

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 12, padding: "10px 14px", fontSize: 13,
              color: "#f87171", fontFamily: "'DM Sans',sans-serif", textAlign: "center",
              lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          {loadingLogin ? (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              padding: "14px 20px", background: "rgba(16,185,129,0.07)",
              borderRadius: 14, border: "1px solid var(--border)",
              fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "var(--text-muted)",
            }}>
              <span style={{ animation: "tmSpin 1s linear infinite", display: "inline-block", fontSize: 18 }}>⟳</span>
              Entrando…
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError("Login Google falhou. Tente novamente.")}
                theme={dark ? "filled_black" : "filled_green"}
                size="large"
                locale="pt-BR"
                width="320"
              />
            </div>
          )}

          {!pendingShare && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>ou</span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>

              <button onClick={handleSkip} className="tm-btn" style={{
                background: "rgba(16,185,129,0.05)", color: "#059669",
                border: "1.5px dashed rgba(16,185,129,0.30)", cursor: "pointer",
                borderRadius: 14, padding: "13px 20px",
                fontFamily: "'DM Sans',sans-serif", fontWeight: 500, fontSize: 13.5, width: "100%",
              }}>
                Usar sem conta →
              </button>

              <p style={{
                fontFamily: "'DM Sans',sans-serif", fontSize: 11.5,
                color: "var(--text-muted)", textAlign: "center", lineHeight: 1.6,
              }}>
                Sem login, os dados não são salvos entre sessões.
              </p>
            </>
          )}
        </div>
      </main>

      {/* Footer simples */}
      <footer style={{
        position: "relative", zIndex: 10,
        borderTop: "1px solid var(--border)",
        background: "var(--bg-glass)", backdropFilter: "blur(14px)",
        padding: "16px 40px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
        fontFamily: "'DM Sans',sans-serif",
      }}>
        <div style={{
          fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15,
          color: "var(--text-main)", letterSpacing: -0.4,
        }}>
          TaskMaster
          <span style={{
            fontFamily: "'DM Sans',sans-serif", fontWeight: 400, fontSize: 10,
            color: "#6ee7b7", marginLeft: 8, letterSpacing: 2, textTransform: "uppercase",
            verticalAlign: "middle",
          }}>
            TM
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          Organize. Priorize. Execute.
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", gap: 12, alignItems: "center" }}>
          <span>© {new Date().getFullYear()} TaskMaster</span>
          <span style={{ color: "rgba(16,185,129,0.4)" }}>·</span>
          <span>Todos os direitos reservados</span>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  ROOT
// ═══════════════════════════════════════════════
export default function TaskMasterApp() {
  const [screen, setScreen] = useState("login");
  const [user,   setUser]   = useState(null);
  const [dark,   setDark]   = useState(() => localStorage.getItem("tm_dark") === "1");

  // Cookie consent
  const [cookieConsent, setCookieConsent] = useState(
    () => localStorage.getItem("tm_cookie_consent") // null | 'granted' | 'essential'
  );

  useEffect(() => { localStorage.setItem("tm_dark", dark ? "1" : "0"); }, [dark]);

  const handleCookieAccept = () => {
    localStorage.setItem("tm_cookie_consent", "granted");
    setCookieConsent("granted");
    // Google Consent Mode v2 — update para granted
    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        analytics_storage:    "granted",
        ad_storage:           "granted",
        ad_user_data:         "granted",
        ad_personalization:   "granted",
      });
    }
  };

  const handleCookieDecline = () => {
    localStorage.setItem("tm_cookie_consent", "essential");
    setCookieConsent("essential");
  };

  return (
    <AppCtx.Provider value={{ user, setUser, screen, setScreen, dark, setDark }}>
      {screen === "login" ? <LoginScreen /> : <AppScreen />}
      {cookieConsent === null && (
        <CookieBanner onAccept={handleCookieAccept} onDecline={handleCookieDecline} />
      )}
    </AppCtx.Provider>
  );
}
