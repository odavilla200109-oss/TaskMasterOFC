/**
 * TaskMaster App.jsx v2.0 — Produção
 *
 * CORREÇÕES APLICADAS:
 *  ✦ uid() agora usa crypto.randomUUID() — sem risco de colisão
 *  ✦ WS_URL trata https→wss e http→ws explicitamente na ordem correta
 *  ✦ WebSocket com backoff exponencial (3s → 30s max)
 *  ✦ historyApiFallback removido do vite.config (não é opção do Vite)
 *
 * Features:
 *  ✦ Canvas infinito (pan + zoom)
 *  ✦ Nós sem sobreposição na criação
 *  ✦ Stripe de prioridade sem vazamento
 *  ✦ Organização em árvore (raiz + filhos)
 *  ✦ Múltiplos canvases com sidebar
 *  ✦ Compartilhamento (view / edit)
 *  ✦ Modo escuro persistido
 *  ✦ Data de vencimento com alerta
 *  ✦ Sons dopaminérgicos
 *  ✦ Colaboração em tempo real via WebSocket
 */

import { useState, useRef, useCallback, useEffect, createContext, useContext } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { soundNodeCreate, soundNodeComplete, soundSubtaskCreate, soundDelete } from "./sounds";

// ═══════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// CORREÇÃO: trata https→wss antes de http→ws (ordem importa para evitar double-replace)
const WS_URL = API_URL.replace(/^https/, "wss").replace(/^http(?!s)/, "ws");

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

// ═══════════════════════════════════════════════════════
//  CONSTANTES
// ═══════════════════════════════════════════════════════

// CORREÇÃO: usa crypto.randomUUID() — sem risco de colisão como o Math.random()
const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

const NODE_W   = 224;
const NODE_H   = 108;
const NODE_GAP_X = 36;
const NODE_GAP_Y = 64;

const PRIORITY = {
  order:  ["none","low","medium","high"],
  color:  { none:"#a7f3d0", low:"#34d399", medium:"#f59e0b", high:"#ef4444" },
  icon:   { none:"○", low:"↓", medium:"◆", high:"▲" },
  label:  { none:"Sem Prioridade", low:"Baixa", medium:"Média", high:"Alta" },
};

const SUBTITLES = [
  "Organize suas ideias de maneira fácil.",
  "Brainstorm e Task List gratuito.",
  "Transforme caos em clareza, um nó por vez.",
  "Planejamento visual que flui com você.",
  "Do pensamento à execução, sem fricção.",
  "Suas tarefas, do seu jeito.",
];

// ═══════════════════════════════════════════════════════
//  UTILITÁRIOS
// ═══════════════════════════════════════════════════════
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

function collides(ax, ay, bx, by) {
  return Math.abs(ax - bx) < NODE_W + 10 && Math.abs(ay - by) < NODE_H + 10;
}

function findFreePosition(nodes, startX, startY) {
  let x = startX, y = startY;
  let attempts = 0;
  while (attempts < 200) {
    const hit = nodes.some((n) => collides(n.x, n.y, x, y));
    if (!hit) return { x, y };
    x += NODE_W + NODE_GAP_X;
    if (x > startX + (NODE_W + NODE_GAP_X) * 4) {
      x = startX;
      y += NODE_H + NODE_GAP_Y;
    }
    attempts++;
  }
  return { x, y };
}

function isOverdue(d) { return d && new Date(d) < new Date(); }
function formatDue(d) {
  if (!d) return null;
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day:"2-digit", month:"short" });
}

// ═══════════════════════════════════════════════════════
//  CONTEXTO
// ═══════════════════════════════════════════════════════
const AppCtx = createContext(null);

// ═══════════════════════════════════════════════════════
//  CSS VARS → modo escuro/claro
// ═══════════════════════════════════════════════════════
function applyTheme(dark) {
  const r = document.documentElement;
  if (dark) {
    r.style.setProperty("--bg-card",    "rgba(12,22,17,0.98)");
    r.style.setProperty("--bg-glass",   "rgba(8,18,12,0.80)");
    r.style.setProperty("--border",     "rgba(16,185,129,0.22)");
    r.style.setProperty("--text-main",  "#d1fae5");
    r.style.setProperty("--text-sub",   "#6ee7b7");
    r.style.setProperty("--text-muted", "#3d6b55");
  } else {
    r.style.setProperty("--bg-card",    "rgba(255,255,255,0.97)");
    r.style.setProperty("--bg-glass",   "rgba(255,255,255,0.75)");
    r.style.setProperty("--border",     "rgba(16,185,129,0.18)");
    r.style.setProperty("--text-main",  "#064e3b");
    r.style.setProperty("--text-sub",   "#065f46");
    r.style.setProperty("--text-muted", "#9ca3af");
  }
}

// ═══════════════════════════════════════════════════════
//  HOOK: fundo animado
// ═══════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════
//  BURST — partículas ao concluir
// ═══════════════════════════════════════════════════════
function BurstEffect({ x, y }) {
  const parts = [0,72,144,216,288].map((angle, i) => {
    const rad = angle * Math.PI / 180;
    return { i, tx: Math.cos(rad) * 64, ty: Math.sin(rad) * 64 };
  });
  return (
    <>
      {parts.map(({ i, tx, ty }) => (
        <div key={i} style={{
          position:"absolute", left:x, top:y, width:8, height:8, borderRadius:"50%",
          pointerEvents:"none", zIndex:9999, transform:"translate(-50%,-50%)",
          background:["#10b981","#34d399","#6ee7b7","#fbbf24","#a7f3d0"][i],
          animation:`burst${i} .75s ease-out forwards`,
        }}/>
      ))}
      <style>{parts.map(({ i, tx, ty }) =>
        `@keyframes burst${i}{0%{transform:translate(-50%,-50%) scale(1);opacity:1}
         100%{transform:translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) scale(0);opacity:0}}`
      ).join("")}</style>
    </>
  );
}

// ═══════════════════════════════════════════════════════
//  NÓ DE TAREFA
// ═══════════════════════════════════════════════════════
function NodeCard({
  node, dark, isEditing, editVal, setEditVal,
  onFinishEdit, onStartEdit, onDelete, onComplete,
  onCyclePriority, onAddChild, onDragStart, isNew, readOnly,
}) {
  const inputRef = useRef(null);
  const [pop, setPop] = useState(false);
  useEffect(() => { if (isEditing) inputRef.current?.focus(); }, [isEditing]);

  const handleComplete = () => {
    if (!node.completed) { setPop(true); setTimeout(() => setPop(false), 500); }
    onComplete();
  };

  const pc      = PRIORITY.color[node.priority];
  const overdue = isOverdue(node.dueDate) && !node.completed;

  return (
    <div
      onMouseDown={onDragStart}
      onDoubleClick={(e) => { if (readOnly) return; e.stopPropagation(); onStartEdit(); }}
      style={{
        position:     "absolute",
        left:         node.x,
        top:          node.y,
        width:        NODE_W,
        borderRadius: 16,
        overflow:     "hidden",
        background:   "var(--bg-card)",
        border:       `2px solid ${overdue ? "#ef4444" : node.completed ? "#86efac" : pc}`,
        boxShadow:    dark
          ? "0 4px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(16,185,129,0.08)"
          : "0 4px 24px rgba(16,185,129,0.16), 0 1px 4px rgba(0,0,0,0.05)",
        cursor:     readOnly ? "default" : "grab",
        willChange: "transform",
        animation:  isNew ? "tmNodeIn .32s cubic-bezier(.34,1.56,.64,1) forwards" : "none",
      }}
      className="tm-node"
    >
      {/* Stripe de prioridade */}
      <div style={{
        position:   "absolute",
        left:0, top:0, bottom:0,
        width:      5,
        background: pc,
        transition: "background .25s",
        flexShrink: 0,
      }} />

      {/* Título */}
      <div style={{ padding:"11px 12px 7px 18px", minHeight:46 }}>
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
              width:"100%", border:"none", outline:"none", background:"transparent",
              fontFamily:"'DM Sans',sans-serif", fontWeight:500, fontSize:13,
              color:"var(--text-main)",
            }}
          />
        ) : (
          <div style={{
            fontWeight:500, fontSize:13,
            color: node.completed ? "var(--text-muted)" : "var(--text-main)",
            textDecoration: node.completed ? "line-through" : "none",
            lineHeight:1.45, wordBreak:"break-word",
          }}>
            {node.title || (
              <span style={{color:"var(--text-muted)",fontStyle:"italic",fontWeight:400}}>
                Duplo clique para editar
              </span>
            )}
          </div>
        )}
      </div>

      {/* Badge de data */}
      {node.dueDate && (
        <div style={{
          margin:"0 12px 6px 18px",
          display:"inline-flex", alignItems:"center", gap:4,
          background: overdue ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.08)",
          border:`1px solid ${overdue ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.2)"}`,
          borderRadius:6, padding:"2px 8px",
          fontSize:11, fontFamily:"'DM Sans',sans-serif",
          color: overdue ? "#ef4444" : "var(--text-sub)", fontWeight:600,
        }}>
          {overdue ? "⚠" : "📅"} {formatDue(node.dueDate)}
        </div>
      )}

      {/* Footer */}
      <div style={{
        display:"flex", alignItems:"center", gap:2,
        padding:"5px 8px 8px 13px",
        borderTop:"1px solid var(--border)",
      }}>
        {!readOnly && (
          <>
            <button title={PRIORITY.label[node.priority]} className="tm-btn"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onCyclePriority(); }}
              style={{ background:"none",border:"none",cursor:"pointer",fontSize:14,
                color:node.priority!=="none" ? pc : "var(--text-muted)",
                borderRadius:6, padding:"3px 6px", fontWeight:700 }}>
              {PRIORITY.icon[node.priority]}
            </button>

            <button title="Nova subtarefa" className="tm-btn"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onAddChild(); }}
              style={{ background:"none",border:"none",cursor:"pointer",fontSize:15,
                color:"#10b981",borderRadius:6,padding:"2px 6px",fontWeight:600,lineHeight:1 }}>
              ＋
            </button>

            <DueDatePicker node={node} onFinishEdit={onFinishEdit} />
          </>
        )}

        <div style={{ flex:1 }} />

        {!readOnly && (
          <button title="Excluir" className="tm-btn"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{ background:"none",border:"none",cursor:"pointer",fontSize:13,
              color:"#f87171",borderRadius:6,padding:"3px 6px" }}>
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
            border:`2px solid ${node.completed ? "#10b981" : "#d1fae5"}`,
            cursor: readOnly ? "default" : "pointer",
            fontSize:11, color: node.completed ? "white" : "#10b981",
            borderRadius:"50%", width:22, height:22,
            display:"flex", alignItems:"center", justifyContent:"center",
            transform: pop ? "scale(1.5)" : "scale(1)", fontWeight:700,
          }}>
          {node.completed ? "✓" : ""}
        </button>
      </div>
    </div>
  );
}

function DueDatePicker({ node, onFinishEdit }) {
  const inputRef = useRef(null);
  return (
    <button title="Data de vencimento" className="tm-btn"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); inputRef.current?.showPicker?.(); }}
      style={{ background:"none",border:"none",cursor:"pointer",fontSize:12,
        color:"var(--text-muted)",borderRadius:6,padding:"3px 5px",position:"relative" }}>
      📅
      <input
        ref={inputRef}
        type="date"
        value={node.dueDate || ""}
        onChange={(e) => onFinishEdit(node.title, e.target.value || null)}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ position:"absolute",opacity:0,width:1,height:1,top:0,left:0,pointerEvents:"none" }}
      />
    </button>
  );
}

// ═══════════════════════════════════════════════════════
//  MODAL: COMPARTILHAR
// ═══════════════════════════════════════════════════════
function ShareModal({ canvasId, onClose }) {
  const [shares,  setShares]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(null);

  useEffect(() => {
    api(`/api/canvases/${canvasId}/shares`).then(setShares).finally(() => setLoading(false));
  }, [canvasId]);

  const create = async (mode) => {
    const s = await api(`/api/canvases/${canvasId}/shares`, { method:"POST", body:{ mode } });
    setShares((p) => [...p, s]);
  };
  const revoke = async (id) => {
    await api(`/api/canvases/${canvasId}/shares/${id}`, { method:"DELETE" });
    setShares((p) => p.filter((x) => x.id !== id));
  };
  const copy = (token) => {
    navigator.clipboard.writeText(`${window.location.origin}/shared/${token}`);
    setCopied(token); setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div onClick={onClose} style={{
      position:"fixed",inset:0,zIndex:3000,
      display:"flex",alignItems:"center",justifyContent:"center",
      background:"rgba(0,0,0,0.45)",backdropFilter:"blur(5px)",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background:"var(--bg-card)",border:"1.5px solid var(--border)",
        borderRadius:22,padding:"28px 32px",width:"100%",maxWidth:460,
        boxShadow:"0 24px 64px rgba(0,0,0,0.25)",
      }}>
        <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:"var(--text-main)",marginBottom:6 }}>
          Compartilhar Canvas
        </div>
        <div style={{ fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"var(--text-muted)",marginBottom:22 }}>
          Links gerados ficam ativos até você revogar. Pessoas com link de edição colaboram em tempo real.
        </div>

        <div style={{ display:"flex",gap:10,marginBottom:20 }}>
          {["view","edit"].map((mode) => (
            <button key={mode} onClick={() => create(mode)} className="tm-btn" style={{
              flex:1,
              background: mode==="edit" ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(16,185,129,0.1)",
              border: mode==="edit" ? "none" : "1px solid var(--border)",
              color: mode==="edit" ? "white" : "var(--text-sub)",
              borderRadius:13,padding:"11px",
              fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:13,cursor:"pointer",
            }}>
              {mode==="edit" ? "＋ Link de Edição" : "＋ Visualização"}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:"center",padding:24,color:"var(--text-muted)",fontFamily:"'DM Sans',sans-serif",fontSize:13 }}>
            Carregando…
          </div>
        ) : shares.length === 0 ? (
          <div style={{ textAlign:"center",padding:"20px",border:"1.5px dashed var(--border)",borderRadius:13,color:"var(--text-muted)",fontFamily:"'DM Sans',sans-serif",fontSize:13 }}>
            Nenhum link criado ainda
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {shares.map((s) => (
              <div key={s.id} style={{
                display:"flex",alignItems:"center",gap:8,
                background:"rgba(16,185,129,0.04)",border:"1px solid var(--border)",
                borderRadius:13,padding:"10px 14px",
              }}>
                <span style={{
                  fontSize:10,fontFamily:"'DM Sans',sans-serif",fontWeight:700,letterSpacing:1.2,
                  textTransform:"uppercase",flexShrink:0,
                  color: s.mode==="edit" ? "#10b981" : "var(--text-muted)",
                  background: s.mode==="edit" ? "rgba(16,185,129,0.12)" : "rgba(0,0,0,0.04)",
                  borderRadius:6,padding:"2px 8px",
                }}>
                  {s.mode==="edit" ? "Edição" : "Visualização"}
                </span>
                <span style={{ flex:1,fontSize:11,color:"var(--text-muted)",fontFamily:"monospace",
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                  /shared/{s.token.slice(0,14)}…
                </span>
                <button onClick={() => copy(s.token)} className="tm-btn" style={{
                  background:"none",border:"1px solid var(--border)",borderRadius:8,
                  padding:"4px 12px",cursor:"pointer",fontSize:12,
                  color:"var(--text-sub)",fontFamily:"'DM Sans',sans-serif",fontWeight:500,
                  whiteSpace:"nowrap",flexShrink:0,
                }}>
                  {copied===s.token ? "✓ Copiado!" : "Copiar"}
                </button>
                <button onClick={() => revoke(s.id)} className="tm-btn" style={{
                  background:"none",border:"none",cursor:"pointer",
                  color:"#f87171",fontSize:15,padding:"2px 4px",flexShrink:0,
                }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <button onClick={onClose} className="tm-btn" style={{
          marginTop:22,width:"100%",background:"none",border:"1px solid var(--border)",
          borderRadius:13,padding:"11px",fontFamily:"'DM Sans',sans-serif",
          fontSize:13,color:"var(--text-muted)",cursor:"pointer",
        }}>
          Fechar
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  SIDEBAR: CANVASES
// ═══════════════════════════════════════════════════════
function CanvasSidebar({ canvases, activeId, onSelect, onCreate, onDelete, onRename, membersMap }) {
  const [renaming,  setRenaming]  = useState(null);
  const [renameVal, setRenameVal] = useState("");

  return (
    <div style={{
      position:"fixed",left:0,top:56,bottom:0,width:224,zIndex:500,
      background:"var(--bg-glass)",backdropFilter:"blur(20px) saturate(160%)",
      borderRight:"1.5px solid var(--border)",
      display:"flex",flexDirection:"column",padding:"14px 8px",gap:3,overflowY:"auto",
    }}>
      <div style={{
        fontFamily:"'DM Sans',sans-serif",fontSize:10.5,fontWeight:700,
        color:"var(--text-muted)",letterSpacing:1.8,textTransform:"uppercase",
        padding:"4px 10px",marginBottom:6,
      }}>
        Meus Canvases
      </div>

      {canvases.map((c) => {
        const isActive = c.id === activeId;
        const members  = membersMap[c.id] || 0;
        return (
          <div key={c.id} style={{
            display:"flex",alignItems:"center",gap:4,borderRadius:11,
            background: isActive ? "rgba(16,185,129,0.14)" : "transparent",
            border: isActive ? "1px solid rgba(16,185,129,0.28)" : "1px solid transparent",
            padding:"2px 4px",transition:"all .15s",
          }}>
            {renaming === c.id ? (
              <input autoFocus value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onBlur={() => { onRename(c.id, renameVal); setRenaming(null); }}
                onKeyDown={(e) => {
                  if (e.key==="Enter")  { onRename(c.id, renameVal); setRenaming(null); }
                  if (e.key==="Escape") setRenaming(null);
                }}
                style={{ flex:1,border:"none",outline:"none",background:"transparent",
                  fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"var(--text-main)",padding:"7px 6px" }}
              />
            ) : (
              <button
                onClick={() => onSelect(c.id)}
                onDoubleClick={() => { setRenaming(c.id); setRenameVal(c.name); }}
                style={{
                  flex:1,background:"none",border:"none",cursor:"pointer",textAlign:"left",
                  fontFamily:"'DM Sans',sans-serif",fontSize:13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#10b981" : "var(--text-main)",
                  padding:"7px 8px",borderRadius:9,overflow:"hidden",
                  textOverflow:"ellipsis",whiteSpace:"nowrap",
                }}>
                {c.name}
              </button>
            )}

            {members > 1 && (
              <span style={{
                fontSize:10,color:"#10b981",background:"rgba(16,185,129,0.12)",
                borderRadius:20,padding:"1px 6px",fontWeight:600,flexShrink:0,
                fontFamily:"'DM Sans',sans-serif",
              }}>
                {members}
              </span>
            )}

            {canvases.length > 1 && (
              <button onClick={() => onDelete(c.id)} style={{
                background:"none",border:"none",cursor:"pointer",
                color:"#f87171",fontSize:12,padding:"4px",borderRadius:6,
                opacity:0.55,flexShrink:0,transition:"opacity .15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity="1"}
              onMouseLeave={(e) => e.currentTarget.style.opacity="0.55"}>
                ✕
              </button>
            )}
          </div>
        );
      })}

      <button onClick={onCreate} className="tm-btn" style={{
        marginTop:"auto",
        background:"rgba(16,185,129,0.08)",
        border:"1.5px dashed rgba(16,185,129,0.3)",
        borderRadius:11,padding:"10px",cursor:"pointer",
        fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:500,
        color:"#10b981",textAlign:"center",
      }}>
        ＋ Novo Canvas
      </button>

      <div style={{
        fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"var(--text-muted)",
        textAlign:"center",padding:"4px 0",
      }}>
        Duplo clique para renomear
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  HOOK: WebSocket de colaboração
//
//  CORREÇÃO: Backoff exponencial na reconexão
//  (antes: setTimeout fixo de 3s → podia gerar centenas de
//   tentativas se o servidor ficasse fora por muito tempo)
// ═══════════════════════════════════════════════════════
function useCollabWS({ canvasId, shareToken, jwtToken, onPatch, onMembers }) {
  const wsRef       = useRef(null);
  const retryDelay  = useRef(3000);
  const retryTimer  = useRef(null);
  const unmounted   = useRef(false);

  const connect = useCallback(() => {
    if (!canvasId || unmounted.current) return;

    const params = new URLSearchParams();
    if (jwtToken)   params.set("jwt",   jwtToken);
    if (shareToken) params.set("share", shareToken);

    const ws = new WebSocket(`${WS_URL}/ws?${params}`);
    wsRef.current = ws;

    ws.onopen = () => {
      retryDelay.current = 3000; // reset do backoff ao conectar com sucesso
      ws.send(JSON.stringify({ type:"join", canvasId }));
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
      // Backoff exponencial: 3s → 4.5s → 6.75s → … → máx 30s
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
      ws.send(JSON.stringify({ type:"patch", canvasId, nodes }));
    }
  }, [canvasId]);

  return { sendPatch };
}

// ═══════════════════════════════════════════════════════
//  TELA: CANVAS (APP PRINCIPAL)
// ═══════════════════════════════════════════════════════
function AppScreen() {
  const { user, setScreen, dark, setDark } = useContext(AppCtx);

  const [canvases,   setCanvases]   = useState([]);
  const [activeId,   setActiveId]   = useState(null);
  const [nodes,      setNodes]      = useState([]);
  const [past,       setPast]       = useState([]);
  const [future,     setFuture]     = useState([]);
  const [scale,      setScale]      = useState(1);
  const [pan,        setPan]        = useState({ x:80, y:80 });
  const [editingId,  setEditingId]  = useState(null);
  const [editVal,    setEditVal]    = useState("");
  const [bursts,     setBursts]     = useState([]);
  const [newId,      setNewId]      = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [showShare,  setShowShare]  = useState(false);
  const [readOnly,   setReadOnly]   = useState(false);
  const [shareToken, setShareToken] = useState(null);
  const [membersMap, setMembersMap] = useState({});

  const panRef     = useRef({ x:80, y:80 });
  const scaleRef   = useRef(1);
  const wrapRef    = useRef(null);
  const bgRef      = useRef(null);
  const isPanning  = useRef(false);
  const lastMouse  = useRef({ x:0, y:0 });
  const canPan     = useRef(false);
  const dragging   = useRef(null);
  const dragSaved  = useRef(false);
  const nodesRef   = useRef(nodes);
  const saveTimer  = useRef(null);
  const wsPatching = useRef(false);

  nodesRef.current = nodes;
  useEffect(() => { panRef.current   = pan;   }, [pan]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);

  const onBgMove = useAnimatedBg(bgRef, dark);
  useEffect(() => { applyTheme(dark); }, [dark]);

  // ── Detecta acesso via link compartilhado ───────────
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith("/shared/")) {
      const token = path.replace("/shared/", "");
      setShareToken(token);
      api(`/api/canvases/shared/${token}`).then((data) => {
        setNodes(data.nodes);
        setReadOnly(data.mode === "view");
        setLoading(false);
      }).catch(() => setLoading(false));
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
  }, [user]);

  // ── WebSocket colaboração ────────────────────────────
  const handleWsPatch = useCallback((incoming) => {
    wsPatching.current = true;
    setNodes(incoming);
    setTimeout(() => { wsPatching.current = false; }, 100);
  }, []);

  const handleMembers = useCallback((cid, count) => {
    setMembersMap((m) => ({ ...m, [cid]: count }));
  }, []);

  const { sendPatch } = useCollabWS({
    canvasId:  activeId || (shareToken ? nodes[0]?.canvas_id : null),
    shareToken,
    jwtToken:  Token.get(),
    onPatch:   handleWsPatch,
    onMembers: handleMembers,
  });

  // ── Auto-save + broadcast ────────────────────────────
  useEffect(() => {
    if ((!activeId && !shareToken) || loading || wsPatching.current) return;
    if (readOnly) return;
    clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      if (activeId) {
        try { await api(`/api/canvases/${activeId}/nodes`, { method:"PUT", body:{ nodes } }); } catch {}
      }
      sendPatch(nodes);
      setSaving(false);
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [nodes, activeId, shareToken, loading, readOnly, sendPatch]);

  // ── Trocar canvas ────────────────────────────────────
  const switchCanvas = useCallback(async (id) => {
    setActiveId(id); setLoading(true);
    const n = await api(`/api/canvases/${id}/nodes`);
    setNodes(n); setPast([]); setFuture([]);
    setLoading(false);
  }, []);

  // ── Ações de canvas ──────────────────────────────────
  const createCanvas = async () => {
    const name = prompt("Nome do novo canvas:", "Novo Canvas");
    if (!name) return;
    const c = await api("/api/canvases", { method:"POST", body:{ name } });
    setCanvases((p) => [...p, c]);
    switchCanvas(c.id);
  };

  const deleteCanvas = async (id) => {
    if (!confirm("Excluir canvas e todos os seus nós?")) return;
    await api(`/api/canvases/${id}`, { method:"DELETE" });
    const next = canvases.filter((c) => c.id !== id);
    setCanvases(next);
    if (activeId === id && next.length > 0) switchCanvas(next[0].id);
  };

  const renameCanvas = async (id, name) => {
    if (!name.trim()) return;
    const updated = await api(`/api/canvases/${id}`, { method:"PATCH", body:{ name } });
    setCanvases((p) => p.map((c) => c.id === id ? { ...c, name: updated.name } : c));
  };

  // ── Histórico ────────────────────────────────────────
  const saveHistory = useCallback((next) => {
    setPast((p) => [...p.slice(-50), nodesRef.current]);
    setFuture([]);
    setNodes(next);
  }, []);

  const undo = useCallback(() => setPast((p) => {
    if (!p.length) return p;
    const prev = p[p.length-1];
    setFuture((f) => [nodesRef.current, ...f]);
    setNodes(prev);
    return p.slice(0,-1);
  }), []);

  const redo = useCallback(() => setFuture((f) => {
    if (!f.length) return f;
    const next = f[0];
    setPast((p) => [...p, nodesRef.current]);
    setNodes(next);
    return f.slice(1);
  }), []);

  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === "INPUT") return;
      if ((e.ctrlKey||e.metaKey) && e.key==="z") { e.preventDefault(); undo(); }
      if ((e.ctrlKey||e.metaKey) && (e.key==="y"||(e.shiftKey&&e.key==="z"))) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, redo]);

  // ── Nós ──────────────────────────────────────────────
  const addNode = useCallback((parentId = null, cx = null, cy = null) => {
    const id = uid();
    const w  = wrapRef.current?.clientWidth  ?? 900;
    const h  = wrapRef.current?.clientHeight ?? 600;

    let baseX = cx ?? (-panRef.current.x + w/2) / scaleRef.current - NODE_W/2;
    let baseY = cy ?? (-panRef.current.y + h/2) / scaleRef.current - NODE_H/2;

    if (parentId) {
      const parent   = nodesRef.current.find((n) => n.id === parentId);
      const siblings = nodesRef.current.filter((n) => n.parentId === parentId).length;
      if (parent) {
        baseX = parent.x + siblings * (NODE_W + NODE_GAP_X);
        baseY = parent.y + NODE_H + NODE_GAP_Y;
      }
      soundSubtaskCreate();
    } else {
      soundNodeCreate();
    }

    const { x, y } = findFreePosition(nodesRef.current, baseX, baseY);
    const node = { id, title:"", x, y, priority:"none", completed:false, parentId, dueDate:null };
    saveHistory([...nodesRef.current, node]);
    setEditingId(id); setEditVal("");
    setNewId(id); setTimeout(() => setNewId(null), 500);
  }, [saveHistory]);

  const finishEdit = useCallback((id, title, dueDate) => {
    if (dueDate !== undefined) {
      saveHistory(nodesRef.current.map((n) => n.id===id ? { ...n, dueDate } : n));
      return;
    }
    if (!title.trim()) saveHistory(nodesRef.current.filter((n) => n.id !== id));
    else               saveHistory(nodesRef.current.map((n) => n.id===id ? { ...n, title } : n));
    setEditingId(null);
  }, [saveHistory]);

  const deleteNode = useCallback((id) => {
    soundDelete();
    const del = getDescendants(nodesRef.current, id);
    saveHistory(nodesRef.current.filter((n) => !del.has(n.id)));
  }, [saveHistory]);

  const completeNode = useCallback((id) => {
    const node = nodesRef.current.find((n) => n.id === id);
    if (!node) return;
    const done = !node.completed;
    saveHistory(nodesRef.current.map((n) => n.id===id ? { ...n, completed:done } : n));
    if (done) {
      soundNodeComplete();
      const bId = uid();
      setBursts((b) => [...b, { id:bId, x:node.x+NODE_W/2, y:node.y+NODE_H/2 }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== bId)), 800);
    }
  }, [saveHistory]);

  const cyclePriority = useCallback((id) => {
    const node = nodesRef.current.find((n) => n.id === id);
    if (!node) return;
    const next = PRIORITY.order[(PRIORITY.order.indexOf(node.priority)+1) % PRIORITY.order.length];
    saveHistory(nodesRef.current.map((n) => n.id===id ? { ...n, priority:next } : n));
  }, [saveHistory]);

  // ── Organizar em árvore ──────────────────────────────
  const organizeTree = useCallback(() => {
    const ORDER  = ["high","medium","low","none"];
    const result = [...nodesRef.current];
    const roots  = result.filter((n) => !n.parentId)
      .sort((a,b) => ORDER.indexOf(a.priority) - ORDER.indexOf(b.priority));

    const MARGIN_X = NODE_W + NODE_GAP_X;
    const MARGIN_Y = NODE_H + NODE_GAP_Y;
    let colX = 60;

    function placeSubtree(nodeId, x, y) {
      const idx      = result.findIndex((n) => n.id === nodeId);
      result[idx]    = { ...result[idx], x, y };
      const children = result.filter((n) => n.parentId === nodeId);
      let childX     = x;
      children.forEach((child) => {
        placeSubtree(child.id, childX, y + MARGIN_Y);
        const desc    = getDescendants(result, child.id);
        const leafCols = Math.max(1, [...desc].filter((d) => d !== child.id && !result.some((n) => n.parentId === d)).length);
        childX        += Math.max(leafCols, 1) * MARGIN_X;
      });
      return Math.max(children.length, 1);
    }

    roots.forEach((root) => {
      placeSubtree(root.id, colX, 60);
      const desc  = getDescendants(result, root.id);
      const width = Math.max(1, desc.size) * MARGIN_X;
      colX       += width;
    });

    saveHistory(result);
  }, [saveHistory]);

  // ── Eventos do canvas ────────────────────────────────
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
      lastMouse.current = { x:e.clientX, y:e.clientY };
    }
  }, []);

  const startDrag = useCallback((e, id) => {
    if (e.button !== 0 || readOnly) return;
    e.stopPropagation();
    canPan.current = false;
    const node = nodesRef.current.find((n) => n.id === id);
    if (!node) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const mx   = (e.clientX - rect.left - panRef.current.x) / scaleRef.current;
    const my   = (e.clientY - rect.top  - panRef.current.y) / scaleRef.current;
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
      setNodes((ns) => ns.map((n) => n.id===drag.id ? { ...n, x:mx-drag.ox, y:my-drag.oy } : n));
      return;
    }

    if (canPan.current) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      if (!isPanning.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        isPanning.current = true;
      }
      if (isPanning.current) {
        setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
        lastMouse.current = { x:e.clientX, y:e.clientY };
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
    const x    = (e.clientX - rect.left - panRef.current.x) / scaleRef.current - NODE_W/2;
    const y    = (e.clientY - rect.top  - panRef.current.y) / scaleRef.current - NODE_H/2;
    addNode(null, x, y);
  }, [addNode, readOnly]);

  // ── Toolbar ──────────────────────────────────────────
  const makeIndependent = useCallback(() =>
    saveHistory(nodes.map((n) => ({ ...n, parentId:null }))), [nodes, saveHistory]);

  const exportCanvas = useCallback(() => {
    const blob = new Blob([JSON.stringify({ nodes, version:2 }, null, 2)], { type:"application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href=url; a.download="taskmaster.json"; a.click();
    URL.revokeObjectURL(url);
  }, [nodes]);

  const importCanvas = useCallback(() => {
    const input = document.createElement("input");
    input.type="file"; input.accept=".json";
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
    const next = !dark;
    setDark(next);
    if (user) { try { await api("/api/auth/me/darkmode", { method:"PATCH", body:{ darkMode:next } }); } catch (_) {} }
  };

  const handleLogout = async () => {
    try { await api("/api/auth/logout", { method:"POST" }); } catch (_) {}
    Token.clear(); setScreen("login");
  };

  // ── Derivados ────────────────────────────────────────
  const connections = nodes
    .filter((n) => n.parentId && nodes.find((p) => p.id === n.parentId))
    .map((n) => ({ child:n, parent:nodes.find((p) => p.id === n.parentId) }));

  const completed     = nodes.filter((n) => n.completed).length;
  const overdueCt     = nodes.filter((n) => isOverdue(n.dueDate) && !n.completed).length;
  const isShared      = !!shareToken;
  const hasSidebar    = !isShared && canvases.length > 0;
  const sideW         = hasSidebar ? 224 : 0;
  const activeMembers = membersMap[activeId] || 0;

  if (loading) return (
    <div style={{ width:"100%",height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg-card)",fontFamily:"'DM Sans',sans-serif",color:"#10b981",fontSize:15,gap:10 }}>
      <span style={{ animation:"tmSpin 1s linear infinite",display:"inline-block",fontSize:22 }}>⟳</span>
      Carregando workspace…
    </div>
  );

  return (
    <div ref={bgRef} style={{ width:"100%",height:"100vh",overflow:"hidden",position:"relative",userSelect:"none" }}>
      {showShare && activeId && <ShareModal canvasId={activeId} onClose={() => setShowShare(false)} />}

      {hasSidebar && (
        <CanvasSidebar
          canvases={canvases} activeId={activeId} membersMap={membersMap}
          onSelect={switchCanvas} onCreate={createCanvas}
          onDelete={deleteCanvas} onRename={renameCanvas}
        />
      )}

      {/* ── HEADER ─────────────────────────────────── */}
      <header style={{
        position:"fixed",top:0,left:sideW,right:0,zIndex:1000,
        display:"flex",alignItems:"center",gap:7,padding:"10px 18px",
        backdropFilter:"blur(28px) saturate(160%)",
        background:"var(--bg-glass)",
        borderBottom:"1.5px solid var(--border)",
        boxShadow:"0 2px 20px rgba(16,185,129,0.08)",
        fontFamily:"'DM Sans',sans-serif",
        transition:"left .2s",
      }}>
        <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:21,color:"var(--text-main)",letterSpacing:-1,display:"flex",alignItems:"baseline",gap:2 }}>
          TM
          <span style={{ fontSize:9,fontFamily:"'DM Sans',sans-serif",fontWeight:400,color:"#6ee7b7",marginLeft:4,letterSpacing:2,textTransform:"uppercase" }}>
            taskmaster
          </span>
        </div>

        {isShared && (
          <span style={{ fontSize:11,background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",color:"#10b981",borderRadius:20,padding:"3px 10px",fontWeight:600,letterSpacing:1 }}>
            {readOnly ? "SOMENTE LEITURA" : "EDIÇÃO COLABORATIVA"}
          </span>
        )}

        {activeMembers > 1 && !isShared && (
          <span style={{ fontSize:11,background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.25)",color:"#10b981",borderRadius:20,padding:"3px 10px",fontWeight:600,display:"flex",alignItems:"center",gap:5 }}>
            <span style={{ width:6,height:6,borderRadius:"50%",background:"#10b981",animation:"tmPulse 2s ease infinite",display:"inline-block" }}/>
            {activeMembers} online
          </span>
        )}

        <div style={{ width:1,height:24,background:"var(--border)",margin:"0 2px" }} />

        {!readOnly && (
          <button className="tm-btn" onClick={() => addNode()} style={{
            background:"linear-gradient(135deg,#10b981,#059669)",color:"white",border:"none",
            cursor:"pointer",borderRadius:10,padding:"7px 15px",fontWeight:600,fontSize:13,
            boxShadow:"0 2px 10px rgba(16,185,129,0.32)",
          }}>
            ＋ Nova Tarefa
          </button>
        )}

        {!readOnly && [
          { label:"↩", action:undo, enabled:past.length>0,   title:"Desfazer (Ctrl+Z)" },
          { label:"↪", action:redo, enabled:future.length>0, title:"Refazer (Ctrl+Y)" },
        ].map((b) => (
          <button key={b.label} className="tm-btn" onClick={b.action}
            disabled={!b.enabled} title={b.title}
            style={{ background:"rgba(16,185,129,0.09)",color:"var(--text-sub)",border:"none",
              cursor:b.enabled?"pointer":"not-allowed",borderRadius:10,padding:"7px 11px",
              fontWeight:600,fontSize:14,opacity:b.enabled?1:0.35 }}>
            {b.label}
          </button>
        ))}

        <div style={{ flex:1 }} />

        {saving && (
          <span style={{ fontSize:11,color:"#6ee7b7",animation:"tmPulse 1.2s ease infinite" }}>
            ● salvando…
          </span>
        )}

        {!readOnly && [
          { label:"⬚ Organizar",     action:organizeTree,          title:"Organizar em árvore" },
          { label:"⊡ Independentes", action:makeIndependent,       title:"Remover conexões" },
          { label:"↑ Exportar",      action:exportCanvas,          title:"Exportar JSON" },
          { label:"↓ Importar",      action:importCanvas,          title:"Importar JSON" },
          { label:"🗑 Limpar",       action:() => saveHistory([]), title:"Excluir tudo", danger:true },
        ].map((b) => (
          <button key={b.label} className="tm-btn" onClick={b.action} title={b.title} style={{
            background: b.danger ? "rgba(239,68,68,0.07)" : "rgba(16,185,129,0.08)",
            color:      b.danger ? "#f87171" : "var(--text-sub)",
            border:"none",cursor:"pointer",borderRadius:10,padding:"7px 12px",fontWeight:500,fontSize:12.5,
          }}>
            {b.label}
          </button>
        ))}

        {activeId && !readOnly && (
          <button className="tm-btn" onClick={() => setShowShare(true)} style={{
            background:"rgba(16,185,129,0.13)",border:"1px solid rgba(16,185,129,0.28)",
            color:"#10b981",borderRadius:10,padding:"7px 12px",fontWeight:600,fontSize:12.5,cursor:"pointer",
          }}>
            🔗 Compartilhar
          </button>
        )}

        <button className="tm-btn" onClick={toggleDark} title={dark?"Modo claro":"Modo escuro"} style={{
          background:"rgba(16,185,129,0.08)",border:"none",cursor:"pointer",borderRadius:10,padding:"7px 9px",fontSize:16,
        }}>
          {dark ? "☀️" : "🌙"}
        </button>

        <div style={{ width:1,height:24,background:"var(--border)",margin:"0 2px" }} />

        {user && (
          <div style={{ display:"flex",alignItems:"center",gap:7 }}>
            {user.photo
              ? <img src={user.photo} alt="" style={{ width:30,height:30,borderRadius:"50%",objectFit:"cover",border:"1.5px solid var(--border)" }}/>
              : <div style={{ width:30,height:30,borderRadius:"50%",background:"linear-gradient(135deg,#10b981,#059669)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:700,fontSize:13,fontFamily:"'Syne',sans-serif" }}>
                  {user.name?.[0]?.toUpperCase() || "U"}
                </div>
            }
            <span style={{ fontSize:13,color:"var(--text-main)",fontWeight:500,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
              {user.name}
            </span>
            <button className="tm-btn" onClick={handleLogout} style={{
              background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",fontSize:12,padding:"4px 6px",
            }}>
              Sair
            </button>
          </div>
        )}
      </header>

      {/* ── CANVAS ─────────────────────────────────── */}
      <div
        ref={wrapRef}
        data-canvas="true"
        style={{ position:"absolute",inset:0,top:56,left:sideW,overflow:"hidden",cursor:isPanning.current?"grabbing":"grab",transition:"left .2s" }}
        onMouseDown={onCanvasDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        onDoubleClick={onDblClick}
      >
        {/* Grid de pontos */}
        <svg style={{ position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none" }}>
          <defs>
            <pattern id="tmGrid"
              x={pan.x % (20*scale)} y={pan.y % (20*scale)}
              width={20*scale} height={20*scale}
              patternUnits="userSpaceOnUse">
              <circle cx={1} cy={1} r={1} fill={dark?"rgba(16,185,129,0.09)":"rgba(16,185,129,0.14)"} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#tmGrid)" />
        </svg>

        {/* Camada transformável */}
        <div data-canvas="true" style={{
          position:"absolute",top:0,left:0,
          transform:`translate(${pan.x}px,${pan.y}px) scale(${scale})`,
          transformOrigin:"0 0",
          width:8000,height:8000,
        }}>
          {/* Linhas de conexão */}
          <svg style={{ position:"absolute",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none",overflow:"visible" }}>
            <defs>
              <marker id="tmArrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="rgba(16,185,129,0.5)" />
              </marker>
            </defs>
            {connections.map(({ parent, child }) => {
              const x1=parent.x+NODE_W/2, y1=parent.y+NODE_H;
              const x2=child.x+NODE_W/2,  y2=child.y;
              const ym=(y1+y2)/2;
              return (
                <path key={`${parent.id}-${child.id}`}
                  d={`M ${x1} ${y1} C ${x1} ${ym}, ${x2} ${ym}, ${x2} ${y2}`}
                  fill="none"
                  stroke={dark?"rgba(16,185,129,0.35)":"rgba(16,185,129,0.45)"}
                  strokeWidth={1.8}
                  strokeDasharray="7 5"
                  markerEnd="url(#tmArrow)"
                />
              );
            })}
          </svg>

          {/* Partículas */}
          {bursts.map((b) => <BurstEffect key={b.id} x={b.x} y={b.y} />)}

          {/* Nós */}
          {nodes.map((node) => (
            <NodeCard key={node.id} node={node} dark={dark}
              isEditing={editingId===node.id} editVal={editVal} setEditVal={setEditVal}
              isNew={node.id===newId} readOnly={readOnly}
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

      {/* ── INDICADORES ────────────────────────────── */}
      {nodes.length===0 && !readOnly && (
        <div style={{
          position:"fixed",bottom:48,left:"50%",transform:"translateX(-50%)",
          background:"var(--bg-glass)",backdropFilter:"blur(14px)",
          border:"1.5px dashed var(--border)",borderRadius:14,padding:"12px 28px",
          pointerEvents:"none",color:"#059669",fontSize:13.5,fontWeight:500,
          fontFamily:"'DM Sans',sans-serif",
        }}>
          Duplo clique no canvas para criar uma tarefa ✦
        </div>
      )}

      <div style={{
        position:"fixed",bottom:18,right:18,zIndex:100,
        background:"var(--bg-glass)",backdropFilter:"blur(12px)",
        border:"1px solid var(--border)",borderRadius:10,padding:"5px 12px",
        fontFamily:"'DM Sans',sans-serif",color:"var(--text-sub)",fontSize:12,fontWeight:600,
      }}>
        {Math.round(scale*100)}%
      </div>

      {nodes.length > 0 && (
        <div style={{
          position:"fixed",bottom:18,left:sideW+18,zIndex:100,
          background:"var(--bg-glass)",backdropFilter:"blur(12px)",
          border:"1px solid var(--border)",borderRadius:10,padding:"5px 14px",
          fontFamily:"'DM Sans',sans-serif",color:"var(--text-sub)",fontSize:12,
          display:"flex",gap:12,transition:"left .2s",
        }}>
          <span>📋 {nodes.length} {nodes.length===1?"tarefa":"tarefas"}</span>
          <span>✓ {completed} concluídas</span>
          {overdueCt > 0 && <span style={{ color:"#ef4444" }}>⚠ {overdueCt} atrasadas</span>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  TELA: LOGIN
// ═══════════════════════════════════════════════════════
function TypewriterSubtitle() {
  const [index,     setIndex]     = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [phase,     setPhase]     = useState("typing");
  const t = useRef(null);

  useEffect(() => {
    const current = SUBTITLES[index];
    if (phase==="typing") {
      if (displayed.length < current.length)
        t.current = setTimeout(() => setDisplayed(current.slice(0, displayed.length+1)), 44);
      else t.current = setTimeout(() => setPhase("pause"), 2400);
    } else if (phase==="pause") {
      t.current = setTimeout(() => setPhase("erasing"), 500);
    } else if (phase==="erasing") {
      if (displayed.length > 0)
        t.current = setTimeout(() => setDisplayed(displayed.slice(0,-1)), 24);
      else { setIndex((i) => (i+1)%SUBTITLES.length); setPhase("typing"); }
    }
    return () => clearTimeout(t.current);
  }, [displayed, phase, index]);

  return (
    <div style={{
      fontFamily:"'DM Sans',sans-serif",fontSize:"clamp(14px,1.9vw,19px)",
      fontWeight:400,color:"var(--text-sub)",minHeight:32,letterSpacing:0.2,
      display:"flex",alignItems:"center",justifyContent:"center",
    }}>
      <span>{displayed}</span>
      <span style={{
        display:"inline-block",width:2,height:"1.1em",background:"#10b981",
        borderRadius:2,marginLeft:2,animation:"tmBlink 1s step-end infinite",verticalAlign:"middle",
      }}/>
    </div>
  );
}

function FloatingNode({ x, y, size, delay }) {
  return (
    <div style={{
      position:"absolute",left:`${x}%`,top:`${y}%`,width:size,borderRadius:13,
      background:"var(--bg-card)",border:"1.5px solid var(--border)",
      boxShadow:"0 4px 20px rgba(16,185,129,0.07)",padding:"11px 14px",
      pointerEvents:"none",backdropFilter:"blur(6px)",
      animation:`tmFloat 7s ease-in-out ${delay}s infinite`,opacity:0.65,
    }}>
      <div style={{ height:8,width:"72%",background:"rgba(16,185,129,0.22)",borderRadius:4,marginBottom:8 }}/>
      <div style={{ display:"flex",gap:6,alignItems:"center" }}>
        <div style={{ width:15,height:15,borderRadius:"50%",border:"2px solid rgba(16,185,129,0.35)" }}/>
        <div style={{ height:6,width:"48%",background:"rgba(16,185,129,0.13)",borderRadius:4 }}/>
      </div>
    </div>
  );
}

function LoginScreen() {
  const { setUser, setScreen, dark, setDark } = useContext(AppCtx);
  const bgRef    = useRef(null);
  const onBgMove = useAnimatedBg(bgRef, dark);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => { applyTheme(dark); }, [dark]);

  useEffect(() => {
    const token = Token.get();
    if (!token) return;
    api("/api/auth/me").then(async (u) => {
      if (u.darkMode) setDark(true);
      setUser(u);
      setScreen("app");
    }).catch(() => Token.clear());
  }, []);

  const handleGoogleSuccess = async (res) => {
    setLoading(true); setError(null);
    try {
      const { token, user } = await api("/api/auth/google", {
        method: "POST", body: { credential: res.credential },
      });
      Token.set(token);
      if (user.darkMode) setDark(true);
      setUser(user);
      setScreen("app");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleSkip = () => {
    setUser({ id:"anonymous",name:"Visitante",email:null,photo:null });
    setScreen("app");
  };

  const floaters = [
    {x:3,  y:16, size:138, delay:0  },
    {x:86, y:9,  size:118, delay:1.3},
    {x:1,  y:60, size:128, delay:2.2},
    {x:83, y:56, size:144, delay:0.8},
    {x:76, y:31, size:108, delay:1.9},
    {x:9,  y:38, size:119, delay:3.1},
  ];

  return (
    <div ref={bgRef} onMouseMove={onBgMove} style={{
      width:"100%",minHeight:"100vh",display:"flex",flexDirection:"column",overflow:"hidden",position:"relative",
    }}>
      <div style={{
        position:"absolute",inset:0,pointerEvents:"none",zIndex:0,
        backgroundImage:`radial-gradient(circle,rgba(16,185,129,${dark?.08:.18}) 1px,transparent 1px)`,
        backgroundSize:"24px 24px",
      }}/>

      {floaters.map((f,i) => <FloatingNode key={i} {...f} />)}

      <button onClick={() => setDark((d) => !d)} style={{
        position:"fixed",top:16,right:16,zIndex:200,
        background:"var(--bg-glass)",backdropFilter:"blur(10px)",
        border:"1px solid var(--border)",borderRadius:10,
        padding:"8px 10px",fontSize:16,cursor:"pointer",
      }}>
        {dark ? "☀️" : "🌙"}
      </button>

      <main style={{
        flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
        padding:"60px 20px 40px",position:"relative",zIndex:10,gap:44,
      }}>
        <div style={{ textAlign:"center" }}>
          <div style={{
            display:"inline-flex",alignItems:"center",gap:8,
            background:"rgba(16,185,129,0.11)",border:"1px solid rgba(16,185,129,0.28)",
            borderRadius:100,padding:"5px 16px",marginBottom:22,
            fontFamily:"'DM Sans',sans-serif",fontSize:11.5,fontWeight:700,
            color:"#059669",letterSpacing:1.6,textTransform:"uppercase",
          }}>
            <span style={{ width:7,height:7,borderRadius:"50%",background:"#10b981",
              display:"inline-block",boxShadow:"0 0 6px #10b981",animation:"tmBlink 2s ease infinite" }}/>
            Gratuito &amp; Open Source
          </div>

          <div style={{
            fontFamily:"'Syne',sans-serif",fontWeight:900,
            fontSize:"clamp(56px,9.5vw,108px)",
            color:"var(--text-main)",letterSpacing:-3,lineHeight:1,marginBottom:20,
            animation:"tmFadeUp .65s ease both",
          }}>
            TaskMaster
          </div>

          <div style={{ animation:"tmFadeUp .65s ease .14s both" }}>
            <TypewriterSubtitle />
          </div>
        </div>

        <div style={{
          background:"var(--bg-card)",backdropFilter:"blur(28px) saturate(160%)",
          border:"1.5px solid var(--border)",borderRadius:24,
          padding:"36px 40px",width:"100%",maxWidth:408,
          boxShadow:"0 10px 52px rgba(16,185,129,0.11),0 2px 8px rgba(0,0,0,0.04)",
          display:"flex",flexDirection:"column",gap:14,
          animation:"tmScaleIn .5s cubic-bezier(.34,1.1,.64,1) .18s both",
        }}>
          <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color:"var(--text-main)",textAlign:"center" }}>
            Comece agora
          </div>
          <div style={{ fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"var(--text-muted)",textAlign:"center",marginBottom:4 }}>
            Entre com sua conta para salvar e colaborar
          </div>

          {error && (
            <div style={{
              background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",
              borderRadius:11,padding:"10px 14px",fontSize:13,
              color:"#f87171",fontFamily:"'DM Sans',sans-serif",textAlign:"center",
            }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{
              display:"flex",alignItems:"center",justifyContent:"center",gap:10,
              padding:"14px 20px",background:"rgba(16,185,129,0.08)",
              borderRadius:14,border:"1px solid var(--border)",
              fontFamily:"'DM Sans',sans-serif",fontSize:14,color:"var(--text-muted)",
            }}>
              <span style={{ animation:"tmSpin 1s linear infinite",display:"inline-block",fontSize:18 }}>⟳</span>
              Entrando…
            </div>
          ) : (
            <div style={{ display:"flex",justifyContent:"center" }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError("Login Google falhou. Tente novamente.")}
                theme="filled_green"
                size="large"
                locale="pt-BR"
                width="328"
              />
            </div>
          )}

          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ flex:1,height:1,background:"var(--border)" }}/>
            <span style={{ fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"var(--text-muted)",fontWeight:500 }}>ou</span>
            <div style={{ flex:1,height:1,background:"var(--border)" }}/>
          </div>

          <button onClick={handleSkip} className="tm-btn" style={{
            background:"rgba(16,185,129,0.06)",color:"#059669",
            border:"1.5px dashed rgba(16,185,129,0.33)",cursor:"pointer",
            borderRadius:14,padding:"13px 20px",fontFamily:"'DM Sans',sans-serif",
            fontWeight:500,fontSize:14,width:"100%",
          }}>
            Usar sem fazer login →
          </button>

          <p style={{ fontFamily:"'DM Sans',sans-serif",fontSize:11.5,color:"var(--text-muted)",textAlign:"center",lineHeight:1.6 }}>
            Sem login, as alterações não serão salvas entre sessões.
          </p>
        </div>
      </main>

      <footer style={{
        position:"relative",zIndex:10,borderTop:"1px solid var(--border)",
        background:"var(--bg-glass)",backdropFilter:"blur(14px)",
        padding:"18px 40px",display:"flex",alignItems:"center",
        justifyContent:"space-between",flexWrap:"wrap",gap:12,
        fontFamily:"'DM Sans',sans-serif",
      }}>
        <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,color:"var(--text-main)",letterSpacing:-0.5 }}>
          TaskMaster
          <span style={{ fontFamily:"'DM Sans',sans-serif",fontWeight:400,fontSize:11,color:"#6ee7b7",marginLeft:8,letterSpacing:2,textTransform:"uppercase",verticalAlign:"middle" }}>
            TM
          </span>
        </div>
        <div style={{ fontSize:12.5,color:"var(--text-muted)" }}>Organize. Priorize. Conquiste.</div>
        <div style={{ fontSize:12,color:"var(--text-muted)",display:"flex",gap:14,alignItems:"center" }}>
          <span>© {new Date().getFullYear()} TaskMaster</span>
          <span style={{ color:"#d1fae5" }}>·</span>
          <span>Gratuito para sempre</span>
          <span style={{ color:"#d1fae5" }}>·</span>
          <span>Feito com 💚</span>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  ROOT
// ═══════════════════════════════════════════════════════
export default function TaskMasterApp() {
  const [screen, setScreen] = useState("login");
  const [user,   setUser]   = useState(null);
  const [dark,   setDark]   = useState(() => localStorage.getItem("tm_dark") === "1");

  useEffect(() => { localStorage.setItem("tm_dark", dark ? "1" : "0"); }, [dark]);

  return (
    <AppCtx.Provider value={{ user, setUser, screen, setScreen, dark, setDark }}>
      {screen === "login" ? <LoginScreen /> : <AppScreen />}
    </AppCtx.Provider>
  );
}
