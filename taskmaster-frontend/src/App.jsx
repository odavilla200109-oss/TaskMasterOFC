/**
 * TaskMaster App.jsx v3.0
 *
 * Novidades:
 *  ✦ Workspaces: Task (lista) vs Brain (brainstorm radial)
 *  ✦ Limite de 8 workspaces por usuário
 *  ✦ Brain nodes: arrastar, colorir, conexões orgânicas, sem collab
 *  ✦ Sidebar ocultável (collapsed / expanded) com destaque de foco
 *  ✦ Share: 24h vs indefinido, senha em links de edição
 *  ✦ Cadeado para desbloquear edição em shared com senha
 *  ✦ Perfil clicável: trocar conta, sair, excluir dados (LGPD)
 *  ✦ Ícones SVG inline — sem dependência de emoji do sistema
 *  ✦ SEO otimizado no index.html
 *  ✦ Página /report e /terms e /privacy (roteadas no frontend)
 *  ✦ Cookie consent com gtag Consent Mode v2
 *  ✦ Sync robusto: debounce + visibilitychange + periodic + retry
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

// ─────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────
const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

const NODE_W        = 224;
const NODE_H        = 108;
const NODE_W_CHILD  = 178;
const NODE_H_CHILD  = 76;
const NODE_GAP_X    = 56;
const NODE_GAP_Y    = 60;

const BRAIN_ROOT_W  = 190;
const BRAIN_ROOT_H  = 60;
const BRAIN_CHILD_W = 148;
const BRAIN_CHILD_H = 44;
const BRAIN_ORBIT_R = 230;

const MAX_WS = 8;

const PRIORITY = {
  order: ["none","low","medium","high"],
  color: { none:"#a7f3d0", low:"#34d399", medium:"#f59e0b", high:"#ef4444" },
  label: { none:"Sem prioridade", low:"Baixa", medium:"Média", high:"Alta" },
};

const BRAIN_COLORS = [
  "#10b981","#3b82f6","#8b5cf6","#f59e0b",
  "#ef4444","#ec4899","#06b6d4","#84cc16",
];

const SUBTITLES = [
  "Organize suas ideias com clareza.",
  "Do caos à execução, sem fricção.",
  "Transforme pensamentos em ação.",
  "Planejamento visual que flui com você.",
  "Suas tarefas, do seu jeito.",
  "Foco total. Resultados reais.",
];

// ─────────────────────────────────────────────────
//  SVG ICONS
// ─────────────────────────────────────────────────
const Ic = {
  Check: ({s=12})=>(
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none">
      <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Plus: ({s=13,c="#10b981"})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M7 2V12M2 7H12" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  Trash: ({s=12})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M2 4H12M5 4V3H9V4M3 4L4 12H10L11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Cal: ({s=12,c="currentColor"})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="2.5" width="11" height="10" rx="2" stroke={c} strokeWidth="1.3"/>
      <path d="M5 1V4M9 1V4M1.5 6H12.5" stroke={c} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  Lock: ({s=13,open=false})=>open?(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4.5 6V4.5A2.5 2.5 0 0 1 7 2C7.9 2 8.7 2.4 9.2 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="7" cy="9.5" r="1" fill="currentColor"/>
    </svg>
  ):(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4.5 6V4.5A2.5 2.5 0 0 1 9.5 4.5V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="7" cy="9.5" r="1" fill="currentColor"/>
    </svg>
  ),
  Brain: ({s=14,c="currentColor"})=>(
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M8 2C6 2 4 3.5 4 5.5C4 7 5 8 4 9.5C3 11 2 12 3.5 13C5 14 6 13 8 13C10 13 11 14 12.5 13C14 12 13 11 12 9.5C11 8 12 7 12 5.5C12 3.5 10 2 8 2Z" stroke={c} strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M8 5V8M6 6.5H10" stroke={c} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  Pencil: ({s=12,c="currentColor"})=>(
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none">
      <path d="M8 2L10 4L4 10H2V8L8 2Z" stroke={c} strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  ),
  Eye: ({s=13})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M1 7C1 7 3 3 7 3C11 3 13 7 13 7C13 7 11 11 7 11C3 11 1 7 1 7Z" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ),
  Share: ({s=13})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <circle cx="11" cy="3" r="1.8" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="3" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="11" cy="11" r="1.8" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M4.7 6.2L9.3 4.1M4.7 7.8L9.3 9.9" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  ),
  ChevL: ({s=13})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  ChevR: ({s=13})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M5 2L10 7L5 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  User: ({s=15})=>(
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M2 14C2 11.2 4.7 9 8 9C11.3 9 14 11.2 14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  Logout: ({s=13})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M9 7H2M7 4L10 7L7 10M5 2H11C11.6 2 12 2.4 12 3V11C12 11.6 11.6 12 11 12H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Warn: ({s=13,c="#f59e0b"})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M7 1L13 12H1L7 1Z" stroke={c} strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M7 5V8M7 10V10.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  PriNone: ({s=14})=>(
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="5.5" stroke="#a7f3d0" strokeWidth="1.5"/>
    </svg>
  ),
  PriLow: ({s=14})=>(
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M4 10L8 13L12 10" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 6L8 9L12 6" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/>
    </svg>
  ),
  PriMed: ({s=14})=>(
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <rect x="3" y="5.5" width="10" height="2" rx="1" fill="#f59e0b"/>
      <rect x="3" y="9" width="10" height="2" rx="1" fill="#f59e0b" opacity="0.45"/>
    </svg>
  ),
  PriHigh: ({s=14})=>(
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M8 3L13 11H3L8 3Z" fill="#ef4444"/>
    </svg>
  ),
  Org: ({s=13})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <rect x="5" y="1.5" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="1" y="9.5" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="9" y="9.5" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M7 4.5V7M3 7H11M3 7V9.5M11 7V9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  Fit: ({s=13})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M1 5V2H4M10 2H13V5M13 9V12H10M4 12H1V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Export: ({s=13})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M7 1V9M4 6L7 9L10 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 11H12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  Import: ({s=13})=>(
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M7 9V1M4 6L7 3L10 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 11H12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  Moon: ({s=14})=>(
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M14 10A7 7 0 0 1 6 2a6 6 0 1 0 8 8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  ),
  Sun: ({s=14})=>(
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 1V3M8 13V15M1 8H3M13 8H15M3.2 3.2L4.6 4.6M11.4 11.4L12.8 12.8M3.2 12.8L4.6 11.4M11.4 4.6L12.8 3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
};

function PriIcon({ p, s=14 }) {
  if (p==="high")   return <Ic.PriHigh s={s}/>;
  if (p==="medium") return <Ic.PriMed  s={s}/>;
  if (p==="low")    return <Ic.PriLow  s={s}/>;
  return <Ic.PriNone s={s}/>;
}

// ─────────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────────
function getDescendants(nodes, id) {
  const found = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    nodes.forEach(n => {
      if (n.parentId && found.has(n.parentId) && !found.has(n.id)) {
        found.add(n.id); changed = true;
      }
    });
  }
  return found;
}

function nW(n) { return n.parentId ? NODE_W_CHILD : NODE_W; }
function nH(n) { return n.parentId ? NODE_H_CHILD : NODE_H; }

function collides(ax,ay,aw,ah, bx,by,bw,bh) {
  return Math.abs(ax-bx)<(aw+bw)/2+12 && Math.abs(ay-by)<(ah+bh)/2+12;
}

function freePos(nodes, sx, sy, child=false) {
  const W = child?NODE_W_CHILD:NODE_W, H = child?NODE_H_CHILD:NODE_H;
  let x=sx, y=sy, a=0;
  while (a<300) {
    if (!nodes.some(n=>collides(n.x,n.y,nW(n),nH(n),x,y,W,H))) return {x,y};
    x += W+NODE_GAP_X;
    if (x>sx+(W+NODE_GAP_X)*5) { x=sx; y+=H+NODE_GAP_Y; }
    a++;
  }
  return {x,y};
}

function isOverdue(d) { return d && new Date(d)<new Date(); }
function fmtDue(d) {
  if (!d) return null;
  return new Date(d+"T00:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short"});
}

function brainOrbit(root, count, index) {
  const total = Math.max(count,6);
  const angle = (2*Math.PI*index)/total + (Math.floor(index/6)*Math.PI/6);
  const radius = BRAIN_ORBIT_R + Math.floor(index/6)*80;
  return {
    x: root.x + BRAIN_ROOT_W/2 - BRAIN_CHILD_W/2 + Math.cos(angle)*radius,
    y: root.y + BRAIN_ROOT_H/2 - BRAIN_CHILD_H/2 + Math.sin(angle)*radius,
  };
}

// ─────────────────────────────────────────────────
//  CONTEXT
// ─────────────────────────────────────────────────
const AppCtx = createContext(null);

// ─────────────────────────────────────────────────
//  THEME
// ─────────────────────────────────────────────────
function applyTheme(dark) {
  const r = document.documentElement;
  if (dark) {
    r.style.setProperty("--bg-card",    "rgba(8,18,13,0.97)");
    r.style.setProperty("--bg-glass",   "rgba(5,12,9,0.87)");
    r.style.setProperty("--border",     "rgba(16,185,129,0.17)");
    r.style.setProperty("--text-main",  "#d1fae5");
    r.style.setProperty("--text-sub",   "#6ee7b7");
    r.style.setProperty("--text-muted", "#3d6b55");
    r.style.setProperty("--node-bg",    "rgba(8,18,13,0.97)");
    r.style.setProperty("--node-shadow","0 4px 28px rgba(0,0,0,.55),0 0 0 1px rgba(16,185,129,.07)");
  } else {
    r.style.setProperty("--bg-card",    "rgba(255,255,255,0.97)");
    r.style.setProperty("--bg-glass",   "rgba(255,255,255,0.76)");
    r.style.setProperty("--border",     "rgba(16,185,129,0.18)");
    r.style.setProperty("--text-main",  "#064e3b");
    r.style.setProperty("--text-sub",   "#065f46");
    r.style.setProperty("--text-muted", "#9ca3af");
    r.style.setProperty("--node-bg",    "rgba(255,255,255,0.97)");
    r.style.setProperty("--node-shadow","0 4px 20px rgba(16,185,129,.14),0 1px 4px rgba(0,0,0,.05)");
  }
}

// ─────────────────────────────────────────────────
//  ANIMATED BG HOOK
// ─────────────────────────────────────────────────
function useAnimatedBg(ref, dark) {
  const tH=useRef(145), cH=useRef(145), raf=useRef(null);
  useEffect(()=>{
    const tick=()=>{
      cH.current+=(tH.current-cH.current)*.018;
      const h=cH.current;
      if(ref.current)ref.current.style.background=dark
        ?`radial-gradient(ellipse 80% 60% at 20% 30%,hsl(${h},38%,7%) 0%,transparent 60%),radial-gradient(ellipse 60% 80% at 80% 70%,hsl(${h+20},32%,5%) 0%,transparent 60%),hsl(${h+8},28%,4%)`
        :`radial-gradient(ellipse 80% 60% at 20% 30%,hsl(${h},85%,94%) 0%,transparent 60%),radial-gradient(ellipse 60% 80% at 80% 70%,hsl(${h+25},70%,96%) 0%,transparent 60%),hsl(${h+10},50%,98%)`;
      raf.current=requestAnimationFrame(tick);
    };
    raf.current=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(raf.current);
  },[ref,dark]);
  return useCallback(e=>{tH.current=125+(e.clientX/window.innerWidth)*45;},[]);
}

// ─────────────────────────────────────────────────
//  COOKIE BANNER
// ─────────────────────────────────────────────────
function CookieBanner({onAccept,onDecline}) {
  return (
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:9999,background:"rgba(4,10,7,.97)",backdropFilter:"blur(20px)",borderTop:"1px solid rgba(16,185,129,.22)",padding:"14px 22px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",animation:"tmFadeUp .4s ease both",boxShadow:"0 -4px 24px rgba(0,0,0,.35)"}}>
      <div style={{flex:1,minWidth:260}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,color:"#d1fae5",marginBottom:3}}>🍪 Cookies &amp; Privacidade</div>
        <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:11.5,color:"#6ee7b7",margin:0,lineHeight:1.55}}>
          Utilizamos cookies para funcionamento, análise e publicidade. Ao aceitar, você concorda com nossa{" "}
          <a href="/privacy" style={{color:"#10b981"}}>Política de Privacidade</a>.
        </p>
      </div>
      <div style={{display:"flex",gap:8,flexShrink:0}}>
        <button onClick={onDecline} className="tm-btn" style={{background:"transparent",border:"1px solid rgba(16,185,129,.28)",color:"#6ee7b7",borderRadius:9,padding:"7px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:12,cursor:"pointer"}}>Apenas necessários</button>
        <button onClick={onAccept} className="tm-btn" style={{background:"linear-gradient(135deg,#10b981,#059669)",border:"none",color:"#fff",borderRadius:9,padding:"7px 18px",fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:700,cursor:"pointer"}}>Aceitar</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
//  MODAL BASE
// ─────────────────────────────────────────────────
function Modal({onClose,children,maxW=460}) {
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.55)",backdropFilter:"blur(8px)"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--bg-card)",border:"1.5px solid var(--border)",borderRadius:22,padding:"26px 30px",width:"100%",maxWidth:maxW,boxShadow:"0 24px 80px rgba(0,0,0,.28)",animation:"tmScaleIn .3s cubic-bezier(.34,1.1,.64,1) both"}}>
        {children}
      </div>
    </div>
  );
}

function MTitle({children}) {
  return <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:"var(--text-main)",marginBottom:6}}>{children}</div>;
}

// ─────────────────────────────────────────────────
//  BURST (particle completion effect)
// ─────────────────────────────────────────────────
function BurstEffect({x,y}) {
  const pts=[0,72,144,216,288].map((a,i)=>({i,tx:Math.cos(a*Math.PI/180)*70,ty:Math.sin(a*Math.PI/180)*70}));
  return (
    <>
      {pts.map(({i,tx,ty})=>(
        <div key={i} style={{position:"absolute",left:x,top:y,width:9,height:9,borderRadius:"50%",pointerEvents:"none",zIndex:9999,transform:"translate(-50%,-50%)",background:["#10b981","#34d399","#6ee7b7","#fbbf24","#a7f3d0"][i],animation:`burst${i} .8s ease-out forwards`}}/>
      ))}
      <style>{pts.map(({i,tx,ty})=>`@keyframes burst${i}{0%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) scale(0);opacity:0}}`).join("")}</style>
    </>
  );
}

// ─────────────────────────────────────────────────
//  DUE DATE PICKER
// ─────────────────────────────────────────────────
function DueDatePicker({node,onFinishEdit,isChild}) {
  const ref=useRef(null);
  return (
    <button title="Data de vencimento" className="tm-btn"
      onMouseDown={e=>e.stopPropagation()}
      onClick={e=>{e.stopPropagation();ref.current?.showPicker?.();}}
      style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",padding:"3px 4px",borderRadius:6,color:"var(--text-muted)",position:"relative"}}>
      <Ic.Cal s={isChild?11:12}/>
      <input ref={ref} type="date" value={node.dueDate||""}
        onChange={e=>onFinishEdit(node.title,e.target.value||null)}
        onMouseDown={e=>e.stopPropagation()}
        style={{position:"absolute",opacity:0,width:1,height:1,pointerEvents:"none"}}/>
    </button>
  );
}

// ─────────────────────────────────────────────────
//  TASK NODE CARD
// ─────────────────────────────────────────────────
function NodeCard({
  node,dark,isEditing,editVal,setEditVal,
  onFinishEdit,onStartEdit,onDelete,onComplete,
  onCyclePriority,onAddChild,onDragStart,
  isNew,readOnly,isSelected,onSelect,isChild,
}) {
  const inputRef=useRef(null);
  const [pop,setPop]=useState(false);
  useEffect(()=>{if(isEditing)inputRef.current?.focus();},[isEditing]);

  const handleComplete=()=>{
    if(!node.completed){setPop(true);setTimeout(()=>setPop(false),500);}
    onComplete();
  };

  const pc   = isChild?"transparent":PRIORITY.color[node.priority];
  const over = isOverdue(node.dueDate)&&!node.completed;
  const W    = isChild?NODE_W_CHILD:NODE_W;
  const bc   = over?"#ef4444":isSelected?"#10b981":node.completed?"#86efac":isChild?"var(--border)":pc;

  return (
    <div
      onMouseDown={e=>{onSelect();onDragStart(e);}}
      onDoubleClick={e=>{if(readOnly)return;e.stopPropagation();onStartEdit();}}
      className={`tm-node${isSelected?" tm-selected":""}${isChild?" tm-child-node":""}`}
      style={{
        position:"absolute",left:node.x,top:node.y,width:W,
        borderRadius:isChild?12:16,overflow:"hidden",
        background:"var(--node-bg)",
        border:`${isSelected?"2px":"1.5px"} solid ${bc}`,
        boxShadow:"var(--node-shadow)",
        cursor:readOnly?"default":"grab",
        willChange:"transform,box-shadow",
        animation:isNew?"tmNodeIn .35s cubic-bezier(.34,1.56,.64,1) forwards":"none",
        transition:"border-color .2s,box-shadow .2s",
        zIndex:isSelected?50:isChild?10:20,
      }}
    >
      {!isChild&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:4,background:pc,transition:"background .25s"}}/>}
      {isChild&&<div style={{position:"absolute",top:5,right:8,fontSize:8,fontFamily:"'DM Sans',sans-serif",fontWeight:700,letterSpacing:1,color:"var(--text-muted)",textTransform:"uppercase",opacity:.6}}>subtarefa</div>}

      {/* Title */}
      <div style={{padding:isChild?"8px 10px 5px 12px":"11px 12px 7px 16px",minHeight:isChild?32:40}}>
        {isEditing?(
          <input ref={inputRef} value={editVal} onChange={e=>setEditVal(e.target.value)}
            onBlur={()=>onFinishEdit(editVal)}
            onKeyDown={e=>{if(e.key==="Enter")onFinishEdit(editVal);if(e.key==="Escape")onFinishEdit(node.title||"");}}
            onMouseDown={e=>e.stopPropagation()}
            placeholder="Nome da tarefa…"
            style={{width:"100%",border:"none",outline:"none",background:"transparent",fontFamily:"'DM Sans',sans-serif",fontWeight:500,fontSize:isChild?12:13,color:"var(--text-main)"}}/>
        ):(
          <div style={{fontWeight:500,fontSize:isChild?12:13,color:node.completed?"var(--text-muted)":"var(--text-main)",textDecoration:node.completed?"line-through":"none",lineHeight:1.45,wordBreak:"break-word",paddingRight:isChild?28:0}}>
            {node.title||<span style={{color:"var(--text-muted)",fontStyle:"italic",fontWeight:400,fontSize:isChild?11:12}}>Duplo clique para editar</span>}
          </div>
        )}
      </div>

      {/* Due date badge */}
      {node.dueDate&&(
        <div style={{margin:`0 ${isChild?10:12}px 5px ${isChild?12:16}px`,display:"inline-flex",alignItems:"center",gap:4,background:over?"rgba(239,68,68,.1)":"rgba(16,185,129,.08)",border:`1px solid ${over?"rgba(239,68,68,.3)":"rgba(16,185,129,.2)"}`,borderRadius:6,padding:"2px 8px",fontSize:10.5,fontFamily:"'DM Sans',sans-serif",color:over?"#ef4444":"var(--text-sub)",fontWeight:600}}>
          <Ic.Cal s={11} c={over?"#ef4444":"var(--text-sub)"}/> {fmtDue(node.dueDate)}{over&&" ⚠"}
        </div>
      )}

      {/* Footer */}
      <div style={{display:"flex",alignItems:"center",gap:2,padding:isChild?"4px 7px 6px 11px":"5px 8px 7px 13px",borderTop:"1px solid var(--border)"}}>
        {!readOnly&&(
          <>
            {!isChild&&(
              <button title={PRIORITY.label[node.priority]} className="tm-btn"
                onMouseDown={e=>e.stopPropagation()}
                onClick={e=>{e.stopPropagation();onCyclePriority();}}
                style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",padding:"3px 5px",borderRadius:6}}>
                <PriIcon p={node.priority} s={14}/>
              </button>
            )}
            <button title="Nova subtarefa" className="tm-btn"
              onMouseDown={e=>e.stopPropagation()}
              onClick={e=>{e.stopPropagation();onAddChild();}}
              style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",padding:"3px 4px",borderRadius:6}}>
              <Ic.Plus s={isChild?12:13}/>
            </button>
            <DueDatePicker node={node} onFinishEdit={onFinishEdit} isChild={isChild}/>
          </>
        )}
        <div style={{flex:1}}/>
        {!readOnly&&(
          <button title="Excluir" className="tm-btn"
            onMouseDown={e=>e.stopPropagation()}
            onClick={e=>{e.stopPropagation();onDelete();}}
            style={{background:"none",border:"none",cursor:"pointer",color:"#f87171",display:"flex",alignItems:"center",padding:"3px 4px",borderRadius:6}}>
            <Ic.Trash s={11}/>
          </button>
        )}
        <button title={node.completed?"Desmarcar":"Concluir"} className="tm-btn"
          onMouseDown={e=>e.stopPropagation()}
          onClick={e=>{e.stopPropagation();if(!readOnly)handleComplete();}}
          style={{background:node.completed?"#10b981":"none",border:`2px solid ${node.completed?"#10b981":"rgba(16,185,129,.4)"}`,cursor:readOnly?"default":"pointer",width:isChild?20:22,height:isChild?20:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",transform:pop?"scale(1.5)":"scale(1)",transition:"all .2s"}}>
          {node.completed&&<Ic.Check s={isChild?9:11}/>}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
//  BRAIN NODE CARD
// ─────────────────────────────────────────────────
function BrainNodeCard({node,dark,onDragStart,onDelete,onColorChange,isSelected,onSelect,readOnly,isNew,isEditing,editVal,setEditVal,onFinishEdit}) {
  const [hov,setHov]=useState(false);
  const [picker,setPicker]=useState(false);
  const inputRef=useRef(null);
  useEffect(()=>{if(isEditing)inputRef.current?.focus();},[isEditing]);

  const W = node.isRoot?BRAIN_ROOT_W:BRAIN_CHILD_W;
  const H = node.isRoot?BRAIN_ROOT_H:BRAIN_CHILD_H;
  const c = node.color||"#10b981";

  return (
    <div
      onMouseDown={e=>{onSelect();onDragStart(e);}}
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>{setHov(false);setPicker(false);}}
      className={`tm-brain-node${isNew?" tm-node-new":""}`}
      style={{
        position:"absolute",left:node.x,top:node.y,
        width:W,height:H,borderRadius:H/2,
        background:node.isRoot
          ?`linear-gradient(135deg,${c}25,${c}10)`
          :dark?"rgba(8,18,13,.92)":"rgba(255,255,255,.92)",
        border:`${isSelected?"2.5px":"1.8px"} solid ${c}`,
        boxShadow:isSelected
          ?`0 0 0 3px ${c}30,0 6px 28px ${c}20`
          :node.isRoot
          ?`0 0 0 1px ${c}40,0 8px 32px ${c}20`
          :"var(--node-shadow)",
        display:"flex",alignItems:"center",justifyContent:"center",
        cursor:readOnly?"default":"grab",userSelect:"none",
        transition:"border-color .2s,box-shadow .2s",
        zIndex:node.isRoot?30:isSelected?25:15,
        animation:isNew?"tmNodeIn .4s cubic-bezier(.34,1.56,.64,1) forwards":"none",
      }}
    >
      {isEditing?(
        <input ref={inputRef} value={editVal} onChange={e=>setEditVal(e.target.value)}
          onBlur={()=>onFinishEdit(editVal)}
          onKeyDown={e=>{if(e.key==="Enter")onFinishEdit(editVal);if(e.key==="Escape")onFinishEdit(node.title||"");}}
          onMouseDown={e=>e.stopPropagation()}
          placeholder={node.isRoot?"Ideia central…":"Expandir ideia…"}
          style={{width:"80%",border:"none",outline:"none",background:"transparent",fontFamily:"'DM Sans',sans-serif",fontWeight:node.isRoot?700:500,fontSize:node.isRoot?13:12,color:node.isRoot?c:"var(--text-main)",textAlign:"center"}}/>
      ):(
        <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:node.isRoot?13.5:12,fontWeight:node.isRoot?700:500,color:node.isRoot?c:"var(--text-main)",textAlign:"center",padding:"0 14px",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",lineHeight:1.35}}>
          {node.title||<span style={{opacity:.35,fontStyle:"italic"}}>{node.isRoot?"ideia central":"expandir…"}</span>}
        </span>
      )}

      {/* Lápis de cor */}
      {hov&&!readOnly&&!isEditing&&(
        <button onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();setPicker(p=>!p);}}
          style={{position:"absolute",top:-11,right:-11,background:"var(--bg-card)",border:"1.5px solid var(--border)",borderRadius:"50%",width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,.15)",zIndex:10}}>
          <Ic.Pencil s={11} c="#10b981"/>
        </button>
      )}

      {/* Color picker */}
      {picker&&!readOnly&&(
        <div onMouseDown={e=>e.stopPropagation()} style={{position:"absolute",top:-54,left:"50%",transform:"translateX(-50%)",background:"var(--bg-card)",border:"1.5px solid var(--border)",borderRadius:12,padding:"8px 10px",display:"flex",gap:6,zIndex:200,boxShadow:"0 8px 28px rgba(0,0,0,.2)"}}>
          {BRAIN_COLORS.map(col=>(
            <button key={col} onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onColorChange(col);setPicker(false);}}
              style={{width:18,height:18,borderRadius:"50%",background:col,border:col===c?"2.5px solid white":"2px solid transparent",cursor:"pointer",outline:"none",boxShadow:col===c?`0 0 0 2px ${col}`:"none",transition:"transform .12s"}}
              onMouseEnter={e=>e.currentTarget.style.transform="scale(1.25)"}
              onMouseLeave={e=>e.currentTarget.style.transform=""}/>
          ))}
        </div>
      )}

      {/* Delete */}
      {hov&&!readOnly&&!isEditing&&(
        <button onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onDelete();}}
          style={{position:"absolute",bottom:-11,right:-11,background:"rgba(239,68,68,.1)",border:"1.5px solid rgba(239,68,68,.35)",borderRadius:"50%",width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",zIndex:10}}>
          <Ic.Trash s={10}/>
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
//  PROFILE MENU
// ─────────────────────────────────────────────────
function ProfileMenu({user,onLogout,onDeleteAccount,onSwitchAccount}) {
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);

  return (
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} className="tm-btn" style={{display:"flex",alignItems:"center",gap:6,background:"rgba(16,185,129,.07)",border:"1px solid var(--border)",borderRadius:10,padding:"4px 9px 4px 5px",cursor:"pointer"}}>
        {user.photo
          ?<img src={user.photo} alt="" style={{width:26,height:26,borderRadius:"50%",objectFit:"cover",border:"1.5px solid var(--border)"}}/>
          :<div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#10b981,#059669)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:700,fontSize:11,fontFamily:"'Syne',sans-serif"}}>{user.name?.[0]?.toUpperCase()||"U"}</div>
        }
        <span style={{fontSize:12.5,color:"var(--text-main)",fontWeight:500,maxWidth:82,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{opacity:.45}}><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>

      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 8px)",right:0,background:"var(--bg-card)",border:"1.5px solid var(--border)",borderRadius:14,padding:"6px",minWidth:200,boxShadow:"0 12px 40px rgba(0,0,0,.22)",animation:"tmScaleIn .18s ease both",zIndex:5000}}>
          <div style={{padding:"8px 12px 6px",borderBottom:"1px solid var(--border)",marginBottom:4}}>
            <div style={{fontSize:12,fontWeight:600,color:"var(--text-main)",fontFamily:"'DM Sans',sans-serif"}}>{user.name}</div>
            <div style={{fontSize:11,color:"var(--text-muted)",fontFamily:"'DM Sans',sans-serif"}}>{user.email}</div>
          </div>
          {[
            {label:"Trocar conta",icon:<Ic.User s={13}/>,action:onSwitchAccount},
            {label:"Sair",icon:<Ic.Logout s={13}/>,action:onLogout},
          ].map(item=>(
            <button key={item.label} onClick={()=>{setOpen(false);item.action();}} className="tm-btn" style={{width:"100%",display:"flex",alignItems:"center",gap:9,background:"none",border:"none",cursor:"pointer",padding:"8px 12px",borderRadius:9,textAlign:"left",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"var(--text-main)"}}>
              <span style={{color:"var(--text-muted)"}}>{item.icon}</span>{item.label}
            </button>
          ))}
          <div style={{borderTop:"1px solid var(--border)",marginTop:4,paddingTop:4}}>
            <button onClick={()=>{setOpen(false);onDeleteAccount();}} className="tm-btn" style={{width:"100%",display:"flex",alignItems:"center",gap:9,background:"none",border:"none",cursor:"pointer",padding:"8px 12px",borderRadius:9,textAlign:"left",fontFamily:"'DM Sans',sans-serif",fontSize:12.5,color:"#f87171"}}>
              <Ic.Trash s={13}/>Excluir meus dados
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
//  SIDEBAR
// ─────────────────────────────────────────────────
function Sidebar({canvases,activeId,onSelect,onCreate,onDelete,onRename,membersMap,collapsed,onToggle}) {
  const [renaming,setRenaming]=useState(null);
  const [renameVal,setRenameVal]=useState("");

  const W=collapsed?40:224;

  return (
    <div style={{position:"fixed",left:0,top:56,bottom:0,width:W,zIndex:500,background:"var(--bg-glass)",backdropFilter:"blur(20px) saturate(160%)",borderRight:"1.5px solid var(--border)",display:"flex",flexDirection:"column",padding:"10px 6px",gap:3,overflowY:"auto",transition:"width .2s",overflow:"hidden"}}>
      {collapsed?(
        <>
          <button onClick={onToggle} className="tm-btn" title="Expandir" style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",padding:"6px",borderRadius:8,display:"flex",justifyContent:"center",marginBottom:4}}>
            <Ic.ChevR s={13}/>
          </button>
          {canvases.map(c=>(
            <button key={c.id} onClick={()=>onSelect(c.id)} title={c.name} className="tm-btn" style={{width:28,height:28,borderRadius:"50%",border:`2px solid ${c.id===activeId?"#10b981":"var(--border)"}`,background:c.id===activeId?"rgba(16,185,129,.15)":"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",color:c.id===activeId?"#10b981":"var(--text-muted)",fontSize:11,fontWeight:700,fontFamily:"'Syne',sans-serif",transition:"all .15s"}}>
              {c.type==="brain"?<Ic.Brain s={12} c={c.id===activeId?"#10b981":"var(--text-muted)"}/>:c.name[0]?.toUpperCase()}
            </button>
          ))}
        </>
      ):(
        <>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"2px 8px 6px",marginBottom:2}}>
            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,fontWeight:700,color:"var(--text-muted)",letterSpacing:1.8,textTransform:"uppercase"}}>
              Workspaces ({canvases.length}/{MAX_WS})
            </span>
            <button onClick={onToggle} className="tm-btn" title="Recolher" style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",padding:"2px",display:"flex"}}>
              <Ic.ChevL s={12}/>
            </button>
          </div>

          {canvases.map(c=>{
            const active=c.id===activeId;
            const members=membersMap[c.id]||0;
            return (
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:3,borderRadius:10,background:active?"rgba(16,185,129,.11)":"transparent",border:active?"1px solid rgba(16,185,129,.25)":"1px solid transparent",padding:"2px 4px",transition:"all .15s"}}>
                <div style={{flexShrink:0,width:18,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {c.type==="brain"
                    ?<Ic.Brain s={13} c={active?"#10b981":"var(--text-muted)"}/>
                    :<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="10" height="10" rx="2" stroke={active?"#10b981":"var(--text-muted)"} strokeWidth="1.3"/><path d="M4 6H8M6 4V8" stroke={active?"#10b981":"var(--text-muted)"} strokeWidth="1.3" strokeLinecap="round"/></svg>
                  }
                </div>
                {renaming===c.id?(
                  <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)}
                    onBlur={()=>{onRename(c.id,renameVal);setRenaming(null);}}
                    onKeyDown={e=>{if(e.key==="Enter"){onRename(c.id,renameVal);setRenaming(null);}if(e.key==="Escape")setRenaming(null);}}
                    style={{flex:1,border:"none",outline:"none",background:"transparent",fontFamily:"'DM Sans',sans-serif",fontSize:12.5,color:"var(--text-main)",padding:"6px 3px"}}/>
                ):(
                  <button onClick={()=>onSelect(c.id)} onDoubleClick={()=>{setRenaming(c.id);setRenameVal(c.name);}}
                    style={{flex:1,background:"none",border:"none",cursor:"pointer",textAlign:"left",fontFamily:"'DM Sans',sans-serif",fontSize:12.5,fontWeight:active?600:400,color:active?"#10b981":"var(--text-main)",padding:"6px 4px",borderRadius:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {c.name}
                  </button>
                )}
                {c.hasViewIndefLock&&<span title="Link ∞ ativo" style={{flexShrink:0,fontSize:8.5,color:"#f59e0b",opacity:.8}}>∞</span>}
                {members>1&&<span style={{fontSize:9.5,color:"#10b981",background:"rgba(16,185,129,.12)",borderRadius:20,padding:"1px 5px",fontWeight:600,flexShrink:0,fontFamily:"'DM Sans',sans-serif"}}>{members}</span>}
                {canvases.length>1&&(
                  <button onClick={()=>onDelete(c.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#f87171",display:"flex",alignItems:"center",padding:"3px",borderRadius:5,opacity:.4,flexShrink:0,transition:"opacity .15s"}}
                    onMouseEnter={e=>e.currentTarget.style.opacity="1"}
                    onMouseLeave={e=>e.currentTarget.style.opacity="0.4"}>
                    <Ic.Trash s={10}/>
                  </button>
                )}
              </div>
            );
          })}

          <button onClick={()=>onCreate("task")} disabled={canvases.length>=MAX_WS} className="tm-btn" style={{marginTop:8,background:"rgba(16,185,129,.07)",border:"1.5px dashed rgba(16,185,129,.28)",borderRadius:10,padding:"8px",cursor:canvases.length>=MAX_WS?"not-allowed":"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:500,color:"#10b981",textAlign:"center",opacity:canvases.length>=MAX_WS?.4:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
            <Ic.Plus s={11}/>Tarefa
          </button>
          <button onClick={()=>onCreate("brain")} disabled={canvases.length>=MAX_WS} className="tm-btn" style={{background:"rgba(139,92,246,.07)",border:"1.5px dashed rgba(139,92,246,.28)",borderRadius:10,padding:"8px",cursor:canvases.length>=MAX_WS?"not-allowed":"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:500,color:"#8b5cf6",textAlign:"center",opacity:canvases.length>=MAX_WS?.4:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
            <Ic.Brain s={12} c="#8b5cf6"/>Brainstorm
          </button>
          {canvases.length>=MAX_WS&&<div style={{fontSize:10.5,color:"var(--text-muted)",textAlign:"center",fontFamily:"'DM Sans',sans-serif",padding:"3px 6px",lineHeight:1.5}}>Limite de {MAX_WS} atingido</div>}
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9.5,color:"var(--text-muted)",textAlign:"center",paddingTop:2}}>Duplo clique para renomear</div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
//  SHARE MODAL v3
// ─────────────────────────────────────────────────
function ShareModal({canvasId,hasLock,onClose}) {
  const [shares,setShares]=useState([]);
  const [loading,setLoading]=useState(true);
  const [copied,setCopied]=useState(null);
  const [creating,setCreating]=useState(false);
  const [mode,setMode]=useState("view");
  const [duration,setDuration]=useState("24h");
  const [password,setPassword]=useState("");

  useEffect(()=>{api(`/api/canvases/${canvasId}/shares`).then(setShares).finally(()=>setLoading(false));},[canvasId]);

  const lockActive=hasLock&&shares.some(s=>s.view_indefinite_lock===1||s.view_indefinite_lock===true);

  const create=async()=>{
    setCreating(true);
    try{
      const s=await api(`/api/canvases/${canvasId}/shares`,{method:"POST",body:{mode,duration,password:password||undefined}});
      setShares(p=>[...p,s]);setPassword("");
    }catch(e){alert(e.message);}finally{setCreating(false);}
  };

  const revoke=async(id)=>{
    await api(`/api/canvases/${canvasId}/shares/${id}`,{method:"DELETE"});
    setShares(p=>p.filter(x=>x.id!==id));
  };

  const copy=token=>{
    navigator.clipboard.writeText(`${window.location.origin}/shared/${token}`);
    setCopied(token);setTimeout(()=>setCopied(null),2200);
  };

  return (
    <Modal onClose={onClose}>
      <MTitle>Compartilhar Workspace</MTitle>
      <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"var(--text-muted)",marginBottom:18,lineHeight:1.5}}>
        Crie links de acesso. Links de edição podem ter senha.
      </p>

      {/* Form */}
      <div style={{background:"rgba(16,185,129,.04)",border:"1px solid var(--border)",borderRadius:14,padding:"14px",marginBottom:16,display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",gap:8}}>
          {["view","edit"].map(m=>(
            <button key={m} onClick={()=>setMode(m)} className="tm-btn" style={{flex:1,padding:"8px",borderRadius:10,fontSize:12.5,fontWeight:600,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",background:mode===m?"linear-gradient(135deg,#10b981,#059669)":"transparent",color:mode===m?"white":"var(--text-sub)",border:mode===m?"none":"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
              {m==="edit"?<><Ic.Pencil s={11} c={mode===m?"white":"currentColor"}/>Edição</>:<><Ic.Eye s={11}/>Visualização</>}
            </button>
          ))}
        </div>

        {mode==="view"&&(
          <div style={{display:"flex",gap:8}}>
            {[["24h","24 horas"],["indefinite","Indefinido"]].map(([v,l])=>(
              <button key={v} onClick={()=>setDuration(v)} className="tm-btn" style={{flex:1,padding:"7px",borderRadius:9,fontSize:12,fontWeight:500,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",background:duration===v?"rgba(16,185,129,.15)":"transparent",color:duration===v?"#10b981":"var(--text-muted)",border:`1px solid ${duration===v?"rgba(16,185,129,.4)":"var(--border)"}`}}>
                {v==="indefinite"&&"♾ "}{l}
              </button>
            ))}
          </div>
        )}

        {mode==="view"&&duration==="indefinite"&&lockActive&&(
          <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.25)",borderRadius:9,padding:"8px 12px",fontSize:12,color:"#f59e0b",fontFamily:"'DM Sans',sans-serif"}}>
            <Ic.Warn s={13}/> Já existe um link ∞ ativo. Revogue-o antes.
          </div>
        )}

        {mode==="edit"&&(
          <input value={password} onChange={e=>setPassword(e.target.value)}
            placeholder="Senha de edição (opcional)"
            style={{background:"transparent",border:"1px solid var(--border)",borderRadius:9,padding:"8px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:12.5,color:"var(--text-main)",outline:"none"}}/>
        )}

        <button onClick={create} disabled={creating||(mode==="view"&&duration==="indefinite"&&lockActive)} className="tm-btn" style={{background:"linear-gradient(135deg,#10b981,#059669)",color:"white",border:"none",borderRadius:10,padding:"10px",fontSize:13,fontWeight:700,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",opacity:(mode==="view"&&duration==="indefinite"&&lockActive)?.4:1}}>
          {creating?"Criando…":"＋ Gerar link"}
        </button>
      </div>

      {/* List */}
      {loading?<div style={{textAlign:"center",padding:18,color:"var(--text-muted)",fontFamily:"'DM Sans',sans-serif",fontSize:13}}>Carregando…</div>
        :shares.length===0?<div style={{textAlign:"center",padding:"16px",border:"1.5px dashed var(--border)",borderRadius:12,color:"var(--text-muted)",fontFamily:"'DM Sans',sans-serif",fontSize:13}}>Nenhum link criado</div>
        :<div style={{display:"flex",flexDirection:"column",gap:7}}>
          {shares.map(s=>(
            <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(16,185,129,.03)",border:"1px solid var(--border)",borderRadius:12,padding:"9px 12px"}}>
              <div style={{display:"flex",flexDirection:"column",gap:2,flex:1,minWidth:0}}>
                <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
                  <span style={{fontSize:10,fontFamily:"'DM Sans',sans-serif",fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:s.mode==="edit"?"#10b981":"var(--text-muted)",background:s.mode==="edit"?"rgba(16,185,129,.12)":"rgba(0,0,0,.04)",borderRadius:5,padding:"1px 7px"}}>
                    {s.mode==="edit"?"Edição":"Visualização"}
                  </span>
                  {(s.view_indefinite_lock===1||s.view_indefinite_lock===true)&&<span style={{fontSize:10,color:"#f59e0b",background:"rgba(245,158,11,.1)",borderRadius:5,padding:"1px 7px",fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>♾ Ativo</span>}
                  {s.password_hash&&<Ic.Lock s={11}/>}
                  {s.expires_at&&<span style={{fontSize:10,color:"var(--text-muted)",fontFamily:"'DM Sans',sans-serif"}}>exp. {new Date(s.expires_at).toLocaleDateString("pt-BR")}</span>}
                </div>
                <span style={{fontSize:10,color:"var(--text-muted)",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>/shared/{s.token.slice(0,14)}…</span>
              </div>
              <button onClick={()=>copy(s.token)} className="tm-btn" style={{background:"none",border:"1px solid var(--border)",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:11.5,color:"var(--text-sub)",fontFamily:"'DM Sans',sans-serif",fontWeight:500,whiteSpace:"nowrap",flexShrink:0}}>
                {copied===s.token?"✓":"Copiar"}
              </button>
              <button onClick={()=>revoke(s.id)} className="tm-btn" style={{background:"none",border:"none",cursor:"pointer",color:"#f87171",display:"flex",alignItems:"center",padding:"4px",flexShrink:0}}>
                <Ic.Trash s={11}/>
              </button>
            </div>
          ))}
        </div>
      }
      <button onClick={onClose} className="tm-btn" style={{marginTop:18,width:"100%",background:"none",border:"1px solid var(--border)",borderRadius:12,padding:"10px",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"var(--text-muted)",cursor:"pointer"}}>Fechar</button>
    </Modal>
  );
}

// ─────────────────────────────────────────────────
//  PASSWORD UNLOCK MODAL
// ─────────────────────────────────────────────────
function PasswordModal({shareToken,onUnlock,onCancel}) {
  const [pwd,setPwd]=useState("");
  const [err,setErr]=useState("");
  const [loading,setL]=useState(false);

  const submit=async()=>{
    setL(true);setErr("");
    try{await api(`/api/canvases/shared/${shareToken}/verify-password`,{method:"POST",body:{password:pwd}});onUnlock();}
    catch(e){setErr(e.message);}finally{setL(false);}
  };

  return (
    <Modal onClose={onCancel} maxW={380}>
      <div style={{textAlign:"center",marginBottom:14}}>
        <div style={{width:46,height:46,borderRadius:"50%",background:"rgba(16,185,129,.1)",border:"1.5px solid rgba(16,185,129,.3)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><Ic.Lock s={20}/></div>
        <MTitle>Workspace protegido</MTitle>
        <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"var(--text-muted)"}}>Insira a senha para desbloquear edição.</p>
      </div>
      <input autoFocus type="password" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}
        placeholder="Senha de edição"
        style={{width:"100%",background:"transparent",border:"1.5px solid var(--border)",borderRadius:11,padding:"11px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:14,color:"var(--text-main)",outline:"none",marginBottom:8,boxSizing:"border-box"}}/>
      {err&&<div style={{color:"#f87171",fontSize:12.5,fontFamily:"'DM Sans',sans-serif",marginBottom:8}}>{err}</div>}
      <div style={{display:"flex",gap:8}}>
        <button onClick={onCancel} className="tm-btn" style={{flex:1,background:"none",border:"1px solid var(--border)",borderRadius:11,padding:"10px",fontSize:13,color:"var(--text-muted)",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Apenas visualizar</button>
        <button onClick={submit} disabled={loading||!pwd} className="tm-btn" style={{flex:1,background:"linear-gradient(135deg,#10b981,#059669)",color:"white",border:"none",borderRadius:11,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",opacity:(!pwd||loading)?.5:1}}>
          {loading?"…":"Desbloquear"}
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────
//  COLLAB WEBSOCKET HOOK
// ─────────────────────────────────────────────────
function useCollabWS({canvasId,shareToken,jwtToken,onPatch,onBrainPatch,onMembers}) {
  const wsRef=useRef(null),retryDelay=useRef(3000),retryTimer=useRef(null),unmounted=useRef(false);

  const connect=useCallback(()=>{
    if(!canvasId||unmounted.current)return;
    const p=new URLSearchParams();
    if(jwtToken)p.set("jwt",jwtToken);if(shareToken)p.set("share",shareToken);
    const ws=new WebSocket(`${WS_URL}/ws?${p}`);wsRef.current=ws;

    ws.onopen=()=>{retryDelay.current=3000;ws.send(JSON.stringify({type:"join",canvasId}));};
    ws.onmessage=e=>{
      try{const msg=JSON.parse(e.data);
        if(msg.type==="patch")onPatch(msg.nodes);
        if(msg.type==="brain-patch")onBrainPatch(msg.brainNodes);
        if(msg.type==="members")onMembers(canvasId,msg.count);
        if(msg.type==="joined")onMembers(canvasId,msg.members);
      }catch(_){}
    };
    ws.onclose=()=>{
      if(unmounted.current)return;
      retryTimer.current=setTimeout(()=>{retryDelay.current=Math.min(retryDelay.current*1.5,30_000);connect();},retryDelay.current);
    };
    ws.onerror=()=>{};
  },[canvasId,shareToken,jwtToken,onPatch,onBrainPatch,onMembers]);

  useEffect(()=>{
    unmounted.current=false;connect();
    return()=>{unmounted.current=true;clearTimeout(retryTimer.current);wsRef.current?.close();};
  },[connect]);

  const sendPatch=useCallback(nodes=>{if(wsRef.current?.readyState===1)wsRef.current.send(JSON.stringify({type:"patch",canvasId,nodes}));},[canvasId]);
  const sendBrainPatch=useCallback(nodes=>{if(wsRef.current?.readyState===1)wsRef.current.send(JSON.stringify({type:"brain-patch",canvasId,nodes}));},[canvasId]);
  return {sendPatch,sendBrainPatch};
}

// ─────────────────────────────────────────────────
//  APP SCREEN
// ─────────────────────────────────────────────────
function AppScreen() {
  const {user,setScreen,dark,setDark}=useContext(AppCtx);

  // State
  const [canvases,setCanvases]=useState([]);
  const [activeId,setActiveId]=useState(null);
  const [activeType,setActiveType]=useState("task");
  const [nodes,setNodes]=useState([]);
  const [brainNodes,setBrainNodes]=useState([]);
  const [past,setPast]=useState([]);
  const [future,setFuture]=useState([]);
  const [scale,setScale]=useState(1);
  const [pan,setPan]=useState({x:80,y:80});
  const [editingId,setEditingId]=useState(null);
  const [editVal,setEditVal]=useState("");
  const [selectedId,setSelectedId]=useState(null);
  const [bursts,setBursts]=useState([]);
  const [newId,setNewId]=useState(null);

  // Shared
  const [sharedId,setSharedId]=useState(null);
  const [shareToken,setShareToken]=useState(null);
  const [readOnly,setReadOnly]=useState(false);
  const [showPwd,setShowPwd]=useState(false);

  // Save
  const [saving,setSaving]=useState(false);
  const [saveErr,setSaveErr]=useState(false);
  const [lastSaved,setLastSaved]=useState(null);
  const [loading,setLoading]=useState(true);

  // UI
  const [showShare,setShowShare]=useState(false);
  const [membersMap,setMembersMap]=useState({});
  const [sideCol,setSideCol]=useState(false);
  const [showDelConfirm,setShowDelConfirm]=useState(false);

  // Refs
  const panRef=useRef({x:80,y:80});
  const scaleRef=useRef(1);
  const wrapRef=useRef(null);
  const bgRef=useRef(null);
  const isPanning=useRef(false);
  const lastMouse=useRef({x:0,y:0});
  const canPan=useRef(false);
  const dragging=useRef(null);
  const dragSaved=useRef(false);
  const nodesRef=useRef(nodes);
  const brainRef=useRef(brainNodes);
  const saveTimer=useRef(null);
  const periodicRef=useRef(null);
  const wsPatching=useRef(false);
  const saveRetries=useRef(0);
  const typeRef=useRef(activeType);

  nodesRef.current=nodes;
  brainRef.current=brainNodes;
  typeRef.current=activeType;
  useEffect(()=>{panRef.current=pan;},[pan]);
  useEffect(()=>{scaleRef.current=scale;},[scale]);

  const onBgMove=useAnimatedBg(bgRef,dark);
  useEffect(()=>{applyTheme(dark);},[dark]);

  // ── Load ──
  useEffect(()=>{
    const path=window.location.pathname;
    if(path.startsWith("/shared/")){
      const token=path.replace("/shared/","");
      if(!user||!Token.get()){localStorage.setItem("tm_pending_share",token);setScreen("login");return;}
      setShareToken(token);
      api(`/api/canvases/shared/${token}`).then(data=>{
        const isBrain=data.canvas?.type==="brain";
        if(isBrain){setBrainNodes(data.brainNodes||[]);setActiveType("brain");}
        else{setNodes(data.nodes||[]);setActiveType("task");}
        setSharedId(data.canvas.id);
        if(data.mode==="edit"&&data.hasPassword){setReadOnly(true);setShowPwd(true);}
        else setReadOnly(data.mode==="view");
        setLoading(false);
      }).catch(()=>setLoading(false));
      return;
    }
    if(!user){setLoading(false);return;}
    api("/api/canvases").then(async list=>{
      setCanvases(list);
      if(list.length>0){
        const first=list[0];setActiveId(first.id);setActiveType(first.type||"task");
        if(first.type==="brain"){const bn=await api(`/api/canvases/${first.id}/brain-nodes`);setBrainNodes(bn);}
        else{const n=await api(`/api/canvases/${first.id}/nodes`);setNodes(n);}
      }
      setLoading(false);
    }).catch(()=>setLoading(false));
  },[user,setScreen]);

  // ── WS ──
  const handlePatch=useCallback(inc=>{wsPatching.current=true;setNodes(inc);setTimeout(()=>{wsPatching.current=false;},150);},[]);
  const handleBrainPatch=useCallback(inc=>{wsPatching.current=true;setBrainNodes(inc);setTimeout(()=>{wsPatching.current=false;},150);},[]);
  const handleMembers=useCallback((cid,count)=>{setMembersMap(m=>({...m,[cid]:count}));},[]);

  const {sendPatch,sendBrainPatch}=useCollabWS({
    canvasId:activeId||sharedId,shareToken,jwtToken:Token.get(),
    onPatch:handlePatch,onBrainPatch:handleBrainPatch,onMembers:handleMembers,
  });

  // ── Save ──
  const doSave=useCallback(async(list,isBrain=false)=>{
    if(!activeId||readOnly)return;
    setSaving(true);setSaveErr(false);
    try{
      await api(`/api/canvases/${activeId}/${isBrain?"brain-nodes":"nodes"}`,{method:"PUT",body:{nodes:list}});
      setLastSaved(new Date());saveRetries.current=0;
    }catch{
      saveRetries.current++;setSaveErr(true);
      if(saveRetries.current<3)setTimeout(()=>doSave(list,isBrain),2000*saveRetries.current);
    }finally{setSaving(false);}
  },[activeId,readOnly]);

  useEffect(()=>{
    const isBrain=activeType==="brain";
    const cur=isBrain?brainNodes:nodes;
    if((!activeId&&!sharedId)||loading||wsPatching.current||readOnly)return;
    clearTimeout(saveTimer.current);setSaving(true);
    saveTimer.current=setTimeout(async()=>{
      if(activeId)await doSave(cur,isBrain);
      isBrain?sendBrainPatch(cur):sendPatch(cur);
    },600);
    return()=>clearTimeout(saveTimer.current);
  },[nodes,brainNodes,activeId,sharedId,loading,readOnly,activeType,sendPatch,sendBrainPatch,doSave]);

  useEffect(()=>{
    const h=()=>{
      if(document.visibilityState==="hidden"&&activeId&&!readOnly){
        clearTimeout(saveTimer.current);
        const isBrain=typeRef.current==="brain";
        doSave(isBrain?brainRef.current:nodesRef.current,isBrain);
      }
    };
    document.addEventListener("visibilitychange",h);
    return()=>document.removeEventListener("visibilitychange",h);
  },[activeId,readOnly,doSave]);

  useEffect(()=>{
    if(!activeId||readOnly)return;
    periodicRef.current=setInterval(()=>{
      const isBrain=typeRef.current==="brain";
      if(!wsPatching.current)doSave(isBrain?brainRef.current:nodesRef.current,isBrain);
    },60_000);
    return()=>clearInterval(periodicRef.current);
  },[activeId,readOnly,doSave]);

  useEffect(()=>{
    const h=e=>{if(saving||saveErr){e.preventDefault();e.returnValue="";}};
    window.addEventListener("beforeunload",h);return()=>window.removeEventListener("beforeunload",h);
  },[saving,saveErr]);

  // ── Sair do shared ──
  const exitShared=useCallback(async()=>{
    window.history.replaceState(null,"","/");
    setShareToken(null);setSharedId(null);setReadOnly(false);
    setNodes([]);setBrainNodes([]);setPast([]);setFuture([]);setLoading(true);
    if(user){
      try{
        const list=await api("/api/canvases");setCanvases(list);
        if(list.length>0){const first=list[0];setActiveId(first.id);setActiveType(first.type||"task");
          if(first.type==="brain"){const bn=await api(`/api/canvases/${first.id}/brain-nodes`);setBrainNodes(bn);}
          else{const n=await api(`/api/canvases/${first.id}/nodes`);setNodes(n);}
        }
      }catch(_){}
    }
    setLoading(false);
  },[user]);

  // ── Switch canvas ──
  const switchCanvas=useCallback(async id=>{
    setActiveId(id);setLoading(true);setSelectedId(null);setPast([]);setFuture([]);
    const c=canvases.find(x=>x.id===id);const type=c?.type||"task";setActiveType(type);
    if(type==="brain"){const bn=await api(`/api/canvases/${id}/brain-nodes`);setBrainNodes(bn);setNodes([]);}
    else{const n=await api(`/api/canvases/${id}/nodes`);setNodes(n);setBrainNodes([]);}
    setLoading(false);
  },[canvases]);

  const createCanvas=async type=>{
    const name=prompt(`Nome do workspace de ${type==="brain"?"brainstorm":"tarefas"}:`,"Novo Workspace");
    if(!name)return;
    try{const c=await api("/api/canvases",{method:"POST",body:{name,type}});setCanvases(p=>[...p,c]);switchCanvas(c.id);}
    catch(e){alert(e.message);}
  };
  const deleteCanvas=async id=>{
    if(!confirm("Excluir workspace?"))return;
    await api(`/api/canvases/${id}`,{method:"DELETE"});
    const next=canvases.filter(c=>c.id!==id);setCanvases(next);
    if(activeId===id&&next.length>0)switchCanvas(next[0].id);
  };
  const renameCanvas=async(id,name)=>{
    if(!name.trim())return;
    const u=await api(`/api/canvases/${id}`,{method:"PATCH",body:{name}});
    setCanvases(p=>p.map(c=>c.id===id?{...c,name:u.name}:c));
  };

  // ── History ──
  const saveHistory=useCallback((next,isBrain=false)=>{
    setPast(p=>[...p.slice(-50),{nodes:nodesRef.current,brain:brainRef.current}]);
    setFuture([]);
    if(isBrain)setBrainNodes(next);else setNodes(next);
  },[]);

  const undo=useCallback(()=>setPast(p=>{
    if(!p.length)return p;const prev=p[p.length-1];
    setFuture(f=>[{nodes:nodesRef.current,brain:brainRef.current},...f]);
    setNodes(prev.nodes);setBrainNodes(prev.brain);return p.slice(0,-1);
  }),[]);

  const redo=useCallback(()=>setFuture(f=>{
    if(!f.length)return f;const next=f[0];
    setPast(p=>[...p,{nodes:nodesRef.current,brain:brainRef.current}]);
    setNodes(next.nodes);setBrainNodes(next.brain);return f.slice(1);
  }),[]);

  useEffect(()=>{
    const h=e=>{
      if(e.target.tagName==="INPUT")return;
      if((e.ctrlKey||e.metaKey)&&e.key==="z"){e.preventDefault();undo();}
      if((e.ctrlKey||e.metaKey)&&(e.key==="y"||(e.shiftKey&&e.key==="z"))){e.preventDefault();redo();}
      if(e.key==="Escape")setSelectedId(null);
      if(e.key==="Delete"&&selectedId&&!readOnly){
        soundDelete();
        if(typeRef.current==="brain"){
          const del=getDescendants(brainRef.current,selectedId);
          saveHistory(brainRef.current.filter(n=>!del.has(n.id)),true);
        }else{
          const del=getDescendants(nodesRef.current,selectedId);
          saveHistory(nodesRef.current.filter(n=>!del.has(n.id)));
        }
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[undo,redo,selectedId,readOnly,saveHistory]);

  // ── Task actions ──
  const addNode=useCallback((parentId=null,cx=null,cy=null)=>{
    const id=uid();const w=wrapRef.current?.clientWidth??900,h=wrapRef.current?.clientHeight??600;
    let bx,by;const isChild=!!parentId;
    if(parentId){
      const parent=nodesRef.current.find(n=>n.id===parentId);
      const sibs=nodesRef.current.filter(n=>n.parentId===parentId);
      if(parent){
        const ph=parent.parentId?NODE_H_CHILD:NODE_H;
        if(sibs.length===0){bx=parent.x+Math.floor((NODE_W-NODE_W_CHILD)/2);by=parent.y+ph+NODE_GAP_Y;}
        else{const last=sibs[sibs.length-1];bx=last.x;by=last.y+NODE_H_CHILD+Math.floor(NODE_GAP_Y*.55);}
      }else{bx=cx??80;by=cy??80;}
      soundSubtaskCreate();
    }else{
      bx=cx??(-panRef.current.x+w/2)/scaleRef.current-NODE_W/2;
      by=cy??(-panRef.current.y+h/2)/scaleRef.current-NODE_H/2;
      soundNodeCreate();
    }
    const{x,y}=freePos(nodesRef.current,bx,by,isChild);
    const node={id,title:"",x,y,priority:"none",completed:false,parentId,dueDate:null};
    saveHistory([...nodesRef.current,node]);
    setEditingId(id);setEditVal("");setNewId(id);setTimeout(()=>setNewId(null),500);setSelectedId(id);
  },[saveHistory]);

  const finishEdit=useCallback((id,title,dueDate)=>{
    if(dueDate!==undefined){saveHistory(nodesRef.current.map(n=>n.id===id?{...n,dueDate}:n));return;}
    if(!title.trim())saveHistory(nodesRef.current.filter(n=>n.id!==id));
    else saveHistory(nodesRef.current.map(n=>n.id===id?{...n,title}:n));
    setEditingId(null);
  },[saveHistory]);

  const deleteNode=useCallback(id=>{
    soundDelete();const del=getDescendants(nodesRef.current,id);
    saveHistory(nodesRef.current.filter(n=>!del.has(n.id)));setSelectedId(null);
  },[saveHistory]);

  const completeNode=useCallback(id=>{
    const node=nodesRef.current.find(n=>n.id===id);if(!node)return;
    const done=!node.completed;
    saveHistory(nodesRef.current.map(n=>n.id===id?{...n,completed:done}:n));
    if(done){
      soundNodeComplete();
      const bId=uid();
      setBursts(b=>[...b,{id:bId,x:node.x+nW(node)/2,y:node.y+nH(node)/2}]);
      setTimeout(()=>setBursts(b=>b.filter(x=>x.id!==bId)),800);
    }
  },[saveHistory]);

  const cyclePriority=useCallback(id=>{
    const node=nodesRef.current.find(n=>n.id===id);if(!node||node.parentId)return;
    const next=PRIORITY.order[(PRIORITY.order.indexOf(node.priority)+1)%PRIORITY.order.length];
    saveHistory(nodesRef.current.map(n=>n.id===id?{...n,priority:next}:n));
  },[saveHistory]);

  // ── Brain actions ──
  const addBrainNode=useCallback((parentId=null,cx=null,cy=null)=>{
    const id=uid();const w=wrapRef.current?.clientWidth??900,h=wrapRef.current?.clientHeight??600;
    const isRoot=brainRef.current.length===0&&parentId===null;
    let x,y;
    if(isRoot){
      x=cx??(-panRef.current.x+w/2)/scaleRef.current-BRAIN_ROOT_W/2;
      y=cy??(-panRef.current.y+h/2)/scaleRef.current-BRAIN_ROOT_H/2;
    }else{
      const root=brainRef.current.find(n=>n.isRoot);
      const effectiveParent=parentId?brainRef.current.find(n=>n.id===parentId):root;
      const sibs=brainRef.current.filter(n=>n.parentId===(effectiveParent?.id||null));
      const pos=brainOrbit(effectiveParent||{x:400,y:300},sibs.length+1,sibs.length);
      x=pos.x;y=pos.y;
    }
    const color=BRAIN_COLORS[brainRef.current.length%BRAIN_COLORS.length];
    const root=brainRef.current.find(n=>n.isRoot);
    const node={id,title:"",x,y,color,parentId:isRoot?null:(parentId||root?.id||null),isRoot};
    saveHistory([...brainRef.current,node],true);
    setEditingId(id);setEditVal("");setNewId(id);setTimeout(()=>setNewId(null),500);setSelectedId(id);
    soundNodeCreate();
  },[saveHistory]);

  const finishBrainEdit=useCallback((id,title)=>{
    if(!title.trim())saveHistory(brainRef.current.filter(n=>n.id!==id),true);
    else saveHistory(brainRef.current.map(n=>n.id===id?{...n,title}:n),true);
    setEditingId(null);
  },[saveHistory]);

  const deleteBrainNode=useCallback(id=>{
    soundDelete();const del=getDescendants(brainRef.current,id);
    saveHistory(brainRef.current.filter(n=>!del.has(n.id)),true);setSelectedId(null);
  },[saveHistory]);

  const changeBrainColor=useCallback((id,color)=>{
    saveHistory(brainRef.current.map(n=>n.id===id?{...n,color}:n),true);
  },[saveHistory]);

  // ── Fit / Organize ──
  const fitToScreen=useCallback((override=null)=>{
    const isBrain=typeRef.current==="brain";
    const list=override||(isBrain?brainRef.current:nodesRef.current);
    if(!list.length)return;
    const wW=wrapRef.current?.clientWidth??900,wH=wrapRef.current?.clientHeight??600,PAD=100;
    const gW=n=>isBrain?(n.isRoot?BRAIN_ROOT_W:BRAIN_CHILD_W):nW(n);
    const gH=n=>isBrain?(n.isRoot?BRAIN_ROOT_H:BRAIN_CHILD_H):nH(n);
    const minX=Math.min(...list.map(n=>n.x))-PAD,maxX=Math.max(...list.map(n=>n.x+gW(n)))+PAD;
    const minY=Math.min(...list.map(n=>n.y))-PAD,maxY=Math.max(...list.map(n=>n.y+gH(n)))+PAD;
    const ns=Math.min(wW/(maxX-minX),wH/(maxY-minY),1.4);
    setPan({x:(wW-(maxX-minX)*ns)/2-minX*ns,y:(wH-(maxY-minY)*ns)/2-minY*ns});setScale(ns);
  },[]);

  const organizeTree=useCallback(()=>{
    if(activeType!=="task")return;
    const ORDER=["high","medium","low","none"],result=[...nodesRef.current];
    const roots=result.filter(n=>!n.parentId).sort((a,b)=>ORDER.indexOf(a.priority)-ORDER.indexOf(b.priority));
    function place(nodeId,x,y,depth=0){
      const idx=result.findIndex(n=>n.id===nodeId);if(idx===-1)return y;
      const ic=depth>0,nHh=ic?NODE_H_CHILD:NODE_H,nx=ic?x+Math.floor((NODE_W-NODE_W_CHILD)/2):x;
      result[idx]={...result[idx],x:nx,y};
      const ch=result.filter(n=>n.parentId===nodeId);
      const gy=depth===0?NODE_GAP_Y:Math.floor(NODE_GAP_Y*.55);let cy=y+nHh+gy;
      ch.forEach(c=>{const a=place(c.id,nx,cy,depth+1);cy=a+Math.floor(NODE_GAP_Y*.45);});
      return cy;
    }
    let cx=60;roots.forEach(r=>{place(r.id,cx,60);cx+=NODE_W+NODE_GAP_X*2;});
    saveHistory(result);setTimeout(()=>fitToScreen(result),60);
  },[saveHistory,fitToScreen,activeType]);

  // ── Canvas events ──
  const onWheel=useCallback(e=>{
    e.preventDefault();const rect=wrapRef.current.getBoundingClientRect();
    const mx=e.clientX-rect.left,my=e.clientY-rect.top;
    const factor=e.deltaY<0?1.1:.9,oldS=scaleRef.current;
    const newS=Math.min(Math.max(oldS*factor,.1),5),ratio=newS/oldS;
    setPan(p=>({x:mx-(mx-p.x)*ratio,y:my-(my-p.y)*ratio}));setScale(newS);
  },[]);

  const onCanvasDown=useCallback(e=>{
    if(e.button!==0)return;
    const isC=e.target===wrapRef.current||e.target.dataset.canvas;
    if(isC){canPan.current=true;isPanning.current=false;lastMouse.current={x:e.clientX,y:e.clientY};setSelectedId(null);}
  },[]);

  const startDrag=useCallback((e,id)=>{
    if(e.button!==0||readOnly)return;e.stopPropagation();canPan.current=false;
    const list=typeRef.current==="brain"?brainRef.current:nodesRef.current;
    const node=list.find(n=>n.id===id);if(!node)return;
    const rect=wrapRef.current.getBoundingClientRect();
    const mx=(e.clientX-rect.left-panRef.current.x)/scaleRef.current;
    const my=(e.clientY-rect.top-panRef.current.y)/scaleRef.current;
    dragging.current={id,ox:mx-node.x,oy:my-node.y};dragSaved.current=false;
  },[readOnly]);

  const onMouseMove=useCallback(e=>{
    onBgMove(e);
    if(dragging.current){
      if(!dragSaved.current){
        setPast(p=>[...p.slice(-50),{nodes:nodesRef.current,brain:brainRef.current}]);
        setFuture([]);dragSaved.current=true;
      }
      const rect=wrapRef.current?.getBoundingClientRect();if(!rect)return;
      const mx=(e.clientX-rect.left-panRef.current.x)/scaleRef.current;
      const my=(e.clientY-rect.top-panRef.current.y)/scaleRef.current;
      const d=dragging.current;
      if(typeRef.current==="brain")setBrainNodes(ns=>ns.map(n=>n.id===d.id?{...n,x:mx-d.ox,y:my-d.oy}:n));
      else setNodes(ns=>ns.map(n=>n.id===d.id?{...n,x:mx-d.ox,y:my-d.oy}:n));
      return;
    }
    if(canPan.current){
      const dx=e.clientX-lastMouse.current.x,dy=e.clientY-lastMouse.current.y;
      if(!isPanning.current&&(Math.abs(dx)>4||Math.abs(dy)>4))isPanning.current=true;
      if(isPanning.current){setPan(p=>({x:p.x+dx,y:p.y+dy}));lastMouse.current={x:e.clientX,y:e.clientY};}
    }
  },[onBgMove]);

  const onMouseUp=useCallback(()=>{dragging.current=null;canPan.current=false;isPanning.current=false;},[]);

  const onDblClick=useCallback(e=>{
    if(readOnly)return;
    if(!e.target.dataset.canvas&&e.target!==wrapRef.current)return;
    const rect=wrapRef.current.getBoundingClientRect();
    const x=(e.clientX-rect.left-panRef.current.x)/scaleRef.current;
    const y=(e.clientY-rect.top-panRef.current.y)/scaleRef.current;
    if(typeRef.current==="brain")addBrainNode(null,x,y);
    else addNode(null,x-NODE_W/2,y-NODE_H/2);
  },[addNode,addBrainNode,readOnly]);

  // ── Export / Import ──
  const exportCanvas=useCallback(()=>{
    const isBrain=activeType==="brain";
    const d=isBrain?{brainNodes,type:"brain",version:3}:{nodes,type:"task",version:3};
    const url=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="taskmaster.json";a.click();URL.revokeObjectURL(url);
  },[nodes,brainNodes,activeType]);

  const importCanvas=useCallback(()=>{
    const input=document.createElement("input");input.type="file";input.accept=".json";
    input.onchange=e=>{
      const file=e.target.files[0];if(!file)return;
      const reader=new FileReader();
      reader.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(d.type==="brain")saveHistory(d.brainNodes||[],true);else saveHistory(d.nodes||[]);}catch(_){}};
      reader.readAsText(file);
    };input.click();
  },[saveHistory]);

  const toggleDark=async()=>{
    const next=!dark;setDark(next);
    if(user){try{await api("/api/auth/me/darkmode",{method:"PATCH",body:{darkMode:next}});}catch(_){}}
  };

  const handleLogout=async()=>{try{await api("/api/auth/logout",{method:"POST"});}catch(_){}Token.clear();setScreen("login");};
  const handleSwitchAccount=()=>{Token.clear();setScreen("login");};
  const handleDeleteAccount=async()=>{
    setShowDelConfirm(false);
    try{await api("/api/auth/me",{method:"DELETE"});Token.clear();localStorage.clear();setScreen("login");}
    catch(e){alert(e.message);}
  };

  // ── Derivados ──
  const taskConns=activeType==="task"
    ?nodes.filter(n=>n.parentId&&nodes.find(p=>p.id===n.parentId)).map(n=>({child:n,parent:nodes.find(p=>p.id===n.parentId)}))
    :[];
  const brainConns=activeType==="brain"
    ?brainNodes.filter(n=>n.parentId&&brainNodes.find(p=>p.id===n.parentId)).map(n=>({child:n,parent:brainNodes.find(p=>p.id===n.parentId)}))
    :[];

  const completed=nodes.filter(n=>n.completed).length;
  const overdueCt=nodes.filter(n=>isOverdue(n.dueDate)&&!n.completed).length;
  const isShared=!!shareToken;
  const hasSidebar=!isShared&&canvases.length>0&&!!user;
  const sideW=hasSidebar?(sideCol?40:224):0;
  const activeMembers=membersMap[activeId||sharedId||""]||0;
  const activeCanvas=canvases.find(c=>c.id===activeId);
  const hasLock=activeCanvas?.hasViewIndefLock||false;

  if(loading)return(
    <div style={{width:"100%",height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg-card)",fontFamily:"'DM Sans',sans-serif",color:"#10b981",fontSize:15,gap:10}}>
      <span style={{animation:"tmSpin 1s linear infinite",display:"inline-block",fontSize:22}}>⟳</span>Carregando workspace…
    </div>
  );

  return (
    <div ref={bgRef} style={{width:"100%",height:"100vh",overflow:"hidden",position:"relative",userSelect:"none"}}>
      {showShare&&activeId&&<ShareModal canvasId={activeId} hasLock={hasLock} onClose={()=>setShowShare(false)}/>}
      {showPwd&&<PasswordModal shareToken={shareToken} onUnlock={()=>{setReadOnly(false);setShowPwd(false);}} onCancel={()=>{setReadOnly(true);setShowPwd(false);}}/>}

      {showDelConfirm&&(
        <Modal onClose={()=>setShowDelConfirm(false)} maxW={400}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:10}}>⚠️</div>
            <MTitle>Excluir todos os dados?</MTitle>
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"var(--text-muted)",marginBottom:18,lineHeight:1.5}}>
              Esta ação é irreversível. Sua conta e todos os workspaces serão apagados (LGPD Art. 18).
            </p>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setShowDelConfirm(false)} className="tm-btn" style={{flex:1,background:"none",border:"1px solid var(--border)",borderRadius:11,padding:"10px",fontSize:13,color:"var(--text-muted)",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Cancelar</button>
              <button onClick={handleDeleteAccount} className="tm-btn" style={{flex:1,background:"linear-gradient(135deg,#ef4444,#b91c1c)",color:"white",border:"none",borderRadius:11,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Excluir tudo</button>
            </div>
          </div>
        </Modal>
      )}

      {hasSidebar&&<Sidebar canvases={canvases} activeId={activeId} membersMap={membersMap} onSelect={switchCanvas} onCreate={createCanvas} onDelete={deleteCanvas} onRename={renameCanvas} collapsed={sideCol} onToggle={()=>setSideCol(p=>!p)}/>}

      {/* HEADER */}
      <header style={{position:"fixed",top:0,left:sideW,right:0,zIndex:1000,display:"flex",alignItems:"center",gap:5,padding:"8px 14px",backdropFilter:"blur(28px) saturate(160%)",background:"var(--bg-glass)",borderBottom:"1.5px solid var(--border)",boxShadow:"0 2px 14px rgba(16,185,129,.06)",fontFamily:"'DM Sans',sans-serif",transition:"left .2s"}}>
        
        {/* Logo */}
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:"var(--text-main)",letterSpacing:-0.8,display:"flex",alignItems:"baseline",gap:2}}>
          TM<span style={{fontSize:7.5,fontFamily:"'DM Sans',sans-serif",fontWeight:400,color:"#6ee7b7",marginLeft:4,letterSpacing:2.5,textTransform:"uppercase"}}>taskmaster</span>
        </div>

        {activeType==="brain"&&<span style={{fontSize:10.5,background:"rgba(139,92,246,.12)",border:"1px solid rgba(139,92,246,.3)",color:"#8b5cf6",borderRadius:20,padding:"3px 10px",fontWeight:700,letterSpacing:.5,display:"flex",alignItems:"center",gap:4}}><Ic.Brain s={11} c="#8b5cf6"/>Brainstorm</span>}
        {isShared&&<span style={{fontSize:10.5,background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.3)",color:"#10b981",borderRadius:20,padding:"3px 10px",fontWeight:700,letterSpacing:.5}}>{readOnly?"SOMENTE LEITURA":"✦ EDIÇÃO COLABORATIVA"}</span>}
        {activeMembers>1&&!isShared&&<span style={{fontSize:10.5,background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.22)",color:"#10b981",borderRadius:20,padding:"3px 10px",fontWeight:600,display:"flex",alignItems:"center",gap:4}}><span style={{width:5,height:5,borderRadius:"50%",background:"#10b981",animation:"tmPulse 2s ease infinite",display:"inline-block"}}/>{activeMembers} online</span>}

        {isShared&&readOnly&&(
          <button onClick={()=>setShowPwd(true)} className="tm-btn" style={{background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.28)",color:"#f59e0b",borderRadius:9,padding:"5px 10px",display:"flex",alignItems:"center",gap:4,cursor:"pointer",fontSize:12,fontWeight:600}}>
            <Ic.Lock s={12}/>Desbloquear edição
          </button>
        )}

        <div style={{width:1,height:20,background:"var(--border)",margin:"0 2px"}}/>

        {!readOnly&&activeType==="task"&&(
          <button className="tm-btn" onClick={()=>addNode()} style={{background:"linear-gradient(135deg,#10b981,#059669)",color:"white",border:"none",cursor:"pointer",borderRadius:9,padding:"6px 13px",fontWeight:700,fontSize:12.5,boxShadow:"0 2px 10px rgba(16,185,129,.28)",display:"flex",alignItems:"center",gap:5}}>
            <Ic.Plus s={12} c="white"/>Tarefa
          </button>
        )}
        {!readOnly&&activeType==="brain"&&(
          <button className="tm-btn" onClick={()=>addBrainNode()} style={{background:"linear-gradient(135deg,#8b5cf6,#6d28d9)",color:"white",border:"none",cursor:"pointer",borderRadius:9,padding:"6px 13px",fontWeight:700,fontSize:12.5,boxShadow:"0 2px 10px rgba(139,92,246,.25)",display:"flex",alignItems:"center",gap:5}}>
            <Ic.Brain s={12} c="white"/>Nó
          </button>
        )}

        {!readOnly&&[
          {l:"↩",a:undo,e:past.length>0,t:"Desfazer (Ctrl+Z)"},
          {l:"↪",a:redo,e:future.length>0,t:"Refazer (Ctrl+Y)"},
        ].map(b=>(
          <button key={b.l} className="tm-btn" onClick={b.a} disabled={!b.e} title={b.t} style={{background:"rgba(16,185,129,.07)",color:"var(--text-sub)",border:"1px solid var(--border)",cursor:b.e?"pointer":"not-allowed",borderRadius:8,padding:"5px 9px",fontWeight:600,fontSize:13,opacity:b.e?1:.3}}>{b.l}</button>
        ))}

        <div style={{flex:1}}/>

        {saveErr&&<button onClick={()=>doSave(activeType==="brain"?brainRef.current:nodesRef.current,activeType==="brain")} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#f87171",background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.22)",borderRadius:8,padding:"4px 9px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>⚠ Salvar</button>}
        {saving&&!saveErr&&<span style={{fontSize:11,color:"#6ee7b7",animation:"tmPulse 1.2s ease infinite"}}>● salvando…</span>}
        {lastSaved&&!saving&&!saveErr&&<span style={{fontSize:10,color:"var(--text-muted)"}}>✓ {lastSaved.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span>}

        {!readOnly&&activeType==="task"&&[
          {l:"Organizar",i:<Ic.Org s={12}/>,a:organizeTree,t:"Organizar por prioridade"},
          {l:"Centralizar",i:<Ic.Fit s={12}/>,a:()=>fitToScreen(),t:"Centralizar visão"},
        ].map(b=>(
          <button key={b.l} className="tm-btn" onClick={b.a} title={b.t} style={{background:"rgba(16,185,129,.07)",color:"var(--text-sub)",border:"1px solid var(--border)",cursor:"pointer",borderRadius:8,padding:"5px 10px",fontWeight:500,fontSize:12,display:"flex",alignItems:"center",gap:4}}>
            {b.i}{b.l}
          </button>
        ))}
        {!readOnly&&activeType==="brain"&&(
          <button className="tm-btn" onClick={()=>fitToScreen()} title="Centralizar" style={{background:"rgba(139,92,246,.07)",color:"#8b5cf6",border:"1px solid rgba(139,92,246,.25)",cursor:"pointer",borderRadius:8,padding:"5px 10px",fontWeight:500,fontSize:12,display:"flex",alignItems:"center",gap:4}}>
            <Ic.Fit s={12}/>Centralizar
          </button>
        )}

        {!readOnly&&[
          {l:"Exportar",i:<Ic.Export s={12}/>,a:exportCanvas},
          {l:"Importar",i:<Ic.Import s={12}/>,a:importCanvas},
        ].map(b=>(
          <button key={b.l} className="tm-btn" onClick={b.a} style={{background:"rgba(16,185,129,.07)",color:"var(--text-sub)",border:"1px solid var(--border)",cursor:"pointer",borderRadius:8,padding:"5px 10px",fontWeight:500,fontSize:12,display:"flex",alignItems:"center",gap:4}}>
            {b.i}{b.l}
          </button>
        ))}

        {activeId&&!readOnly&&(
          <button className="tm-btn" onClick={()=>setShowShare(true)} style={{background:"rgba(16,185,129,.10)",border:"1px solid rgba(16,185,129,.28)",color:"#10b981",borderRadius:8,padding:"5px 11px",fontWeight:600,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
            <Ic.Share s={12}/>Compartilhar
          </button>
        )}
        {isShared&&(
          <button className="tm-btn" onClick={exitShared} style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.25)",color:"#f87171",borderRadius:8,padding:"5px 11px",fontWeight:600,fontSize:12,cursor:"pointer"}}>← Sair</button>
        )}

        <button className="tm-btn" onClick={toggleDark} title={dark?"Modo claro":"Modo escuro"} style={{background:"rgba(16,185,129,.07)",border:"1px solid var(--border)",cursor:"pointer",borderRadius:8,padding:"5px 7px",display:"flex",alignItems:"center"}}>
          {dark?<Ic.Sun s={14}/>:<Ic.Moon s={14}/>}
        </button>

        {user&&<ProfileMenu user={user} onLogout={handleLogout} onSwitchAccount={handleSwitchAccount} onDeleteAccount={()=>setShowDelConfirm(true)}/>}
      </header>

      {/* CANVAS */}
      <div ref={wrapRef} data-canvas="true" style={{position:"absolute",inset:0,top:54,left:sideW,overflow:"hidden",cursor:"crosshair",transition:"left .2s"}}
        onMouseDown={onCanvasDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onWheel={onWheel} onDoubleClick={onDblClick}>

        {/* Grid */}
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}>
          <defs>
            <pattern id="tmGrid" x={pan.x%(24*scale)} y={pan.y%(24*scale)} width={24*scale} height={24*scale} patternUnits="userSpaceOnUse">
              <circle cx={1} cy={1} r={1} fill={dark?"rgba(16,185,129,.08)":"rgba(16,185,129,.15)"}/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#tmGrid)"/>
        </svg>

        {/* Transform layer */}
        <div data-canvas="true" style={{position:"absolute",top:0,left:0,transform:`translate(${pan.x}px,${pan.y}px) scale(${scale})`,transformOrigin:"0 0",width:10000,height:10000}}>
          
          {/* SVG connections */}
          <svg style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none",overflow:"visible"}}>
            <defs>
              <marker id="tmArrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                <path d="M0,0 L0,7 L7,3.5 z" fill="rgba(16,185,129,.42)"/>
              </marker>
            </defs>

            {/* Task connections */}
            {taskConns.map(({parent,child})=>{
              const x1=parent.x+nW(parent)/2,y1=parent.y+nH(parent);
              const x2=child.x+nW(child)/2,y2=child.y,ym=(y1+y2)/2;
              return <path key={`${parent.id}-${child.id}`} d={`M${x1} ${y1}C${x1} ${ym},${x2} ${ym},${x2} ${y2}`} fill="none" stroke={dark?"rgba(16,185,129,.28)":"rgba(16,185,129,.40)"} strokeWidth={1.5} strokeDasharray="8 5" markerEnd="url(#tmArrow)"/>;
            })}

            {/* Brain connections — curved organic */}
            {brainConns.map(({parent,child})=>{
              const pw=parent.isRoot?BRAIN_ROOT_W:BRAIN_CHILD_W,ph=parent.isRoot?BRAIN_ROOT_H:BRAIN_CHILD_H;
              const cw=child.isRoot?BRAIN_ROOT_W:BRAIN_CHILD_W,ch2=child.isRoot?BRAIN_ROOT_H:BRAIN_CHILD_H;
              const x1=parent.x+pw/2,y1=parent.y+ph/2;
              const x2=child.x+cw/2,y2=child.y+ch2/2;
              const mx=(x1+x2)/2,my=(y1+y2)/2;
              const offset=Math.min(Math.abs(x2-x1),Math.abs(y2-y1))*0.3;
              const color=child.color||"#10b981";
              return <path key={`b-${parent.id}-${child.id}`} d={`M${x1} ${y1}Q${mx+offset} ${my-offset},${x2} ${y2}`} fill="none" stroke={color} strokeWidth={1.6} strokeOpacity={.5} strokeLinecap="round"/>;
            })}
          </svg>

          {/* Bursts */}
          {bursts.map(b=><BurstEffect key={b.id} x={b.x} y={b.y}/>)}

          {/* Task nodes */}
          {activeType==="task"&&nodes.map(node=>(
            <NodeCard key={node.id} node={node} dark={dark}
              isEditing={editingId===node.id} editVal={editVal} setEditVal={setEditVal}
              isNew={node.id===newId} readOnly={readOnly} isSelected={selectedId===node.id} isChild={!!node.parentId}
              onSelect={()=>setSelectedId(node.id)}
              onFinishEdit={(title,dueDate)=>finishEdit(node.id,title,dueDate)}
              onStartEdit={()=>{setEditingId(node.id);setEditVal(node.title);}}
              onDelete={()=>deleteNode(node.id)} onComplete={()=>completeNode(node.id)}
              onCyclePriority={()=>cyclePriority(node.id)}
              onAddChild={()=>addNode(node.id)}
              onDragStart={e=>startDrag(e,node.id)}/>
          ))}

          {/* Brain nodes */}
          {activeType==="brain"&&brainNodes.map(node=>(
            <BrainNodeCard key={node.id} node={node} dark={dark}
              isEditing={editingId===node.id} editVal={editVal} setEditVal={setEditVal}
              isNew={node.id===newId} readOnly={readOnly} isSelected={selectedId===node.id}
              onSelect={()=>setSelectedId(node.id)}
              onFinishEdit={title=>finishBrainEdit(node.id,title)}
              onDelete={()=>deleteBrainNode(node.id)}
              onColorChange={color=>changeBrainColor(node.id,color)}
              onDragStart={e=>startDrag(e,node.id)}/>
          ))}
        </div>
      </div>

      {/* Empty hints */}
      {activeType==="task"&&nodes.length===0&&!readOnly&&(
        <div style={{position:"fixed",bottom:48,left:"50%",transform:"translateX(-50%)",background:"var(--bg-glass)",backdropFilter:"blur(14px)",border:"1.5px dashed var(--border)",borderRadius:14,padding:"11px 26px",pointerEvents:"none",color:"#059669",fontSize:13,fontWeight:500,fontFamily:"'DM Sans',sans-serif"}}>
          Duplo clique no canvas para criar uma tarefa ✦
        </div>
      )}
      {activeType==="brain"&&brainNodes.length===0&&!readOnly&&(
        <div style={{position:"fixed",bottom:48,left:"50%",transform:"translateX(-50%)",background:"rgba(139,92,246,.08)",backdropFilter:"blur(14px)",border:"1.5px dashed rgba(139,92,246,.35)",borderRadius:14,padding:"11px 26px",pointerEvents:"none",color:"#8b5cf6",fontSize:13,fontWeight:500,fontFamily:"'DM Sans',sans-serif",textAlign:"center"}}>
          Clique em "Nó" ou duplo clique para criar sua ideia central ✦
        </div>
      )}

      {/* Zoom */}
      <div style={{position:"fixed",bottom:18,right:18,zIndex:100,background:"var(--bg-glass)",backdropFilter:"blur(12px)",border:"1px solid var(--border)",borderRadius:10,padding:"5px 12px",fontFamily:"'DM Sans',sans-serif",color:"var(--text-sub)",fontSize:12,fontWeight:600}}>
        {Math.round(scale*100)}%
      </div>

      {/* Stats */}
      {activeType==="task"&&nodes.length>0&&(
        <div style={{position:"fixed",bottom:18,left:sideW+16,zIndex:100,background:"var(--bg-glass)",backdropFilter:"blur(12px)",border:"1px solid var(--border)",borderRadius:10,padding:"5px 14px",fontFamily:"'DM Sans',sans-serif",color:"var(--text-sub)",fontSize:12,display:"flex",gap:12,transition:"left .2s"}}>
          <span>📋 {nodes.length}</span><span>✓ {completed}</span>
          {overdueCt>0&&<span style={{color:"#ef4444"}}>⚠ {overdueCt}</span>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
//  TYPEWRITER
// ─────────────────────────────────────────────────
function Typewriter() {
  const [idx,setIdx]=useState(0);
  const [disp,setDisp]=useState("");
  const [phase,setPhase]=useState("typing");
  const t=useRef(null);
  useEffect(()=>{
    const cur=SUBTITLES[idx];
    if(phase==="typing"){
      if(disp.length<cur.length)t.current=setTimeout(()=>setDisp(cur.slice(0,disp.length+1)),46);
      else t.current=setTimeout(()=>setPhase("pause"),2600);
    }else if(phase==="pause"){t.current=setTimeout(()=>setPhase("erasing"),500);}
    else if(phase==="erasing"){
      if(disp.length>0)t.current=setTimeout(()=>setDisp(disp.slice(0,-1)),26);
      else{setIdx(i=>(i+1)%SUBTITLES.length);setPhase("typing");}
    }
    return()=>clearTimeout(t.current);
  },[disp,phase,idx]);
  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:"clamp(14px,1.8vw,18px)",fontWeight:400,color:"var(--text-sub)",minHeight:30,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <span>{disp}</span>
      <span style={{display:"inline-block",width:2,height:"1.1em",background:"#10b981",borderRadius:2,marginLeft:2,animation:"tmBlink 1s step-end infinite",verticalAlign:"middle"}}/>
    </div>
  );
}

// ─────────────────────────────────────────────────
//  FLOATING NODE (login BG decoration)
// ─────────────────────────────────────────────────
function FloatNode({x,y,size,delay,dark}) {
  return (
    <div style={{position:"absolute",left:`${x}%`,top:`${y}%`,width:size,borderRadius:14,background:"var(--bg-card)",border:"1.5px solid var(--border)",boxShadow:dark?"0 8px 32px rgba(0,0,0,.4)":"0 8px 24px rgba(16,185,129,.09)",padding:"12px 15px",pointerEvents:"none",backdropFilter:"blur(8px)",animation:`tmFloat 8s ease-in-out ${delay}s infinite`,opacity:.68}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:9}}>
        <div style={{width:4,height:30,borderRadius:4,background:"linear-gradient(180deg,#10b981,#059669)",flexShrink:0}}/>
        <div>
          <div style={{height:7,width:"70%",background:"rgba(16,185,129,.22)",borderRadius:4,marginBottom:5}}/>
          <div style={{height:5,width:"46%",background:"rgba(16,185,129,.12)",borderRadius:4}}/>
        </div>
      </div>
      <div style={{display:"flex",gap:5,alignItems:"center"}}>
        <div style={{width:15,height:15,borderRadius:"50%",border:"2px solid rgba(16,185,129,.35)"}}/>
        <div style={{height:5,width:"35%",background:"rgba(16,185,129,.12)",borderRadius:4}}/>
        <div style={{marginLeft:"auto",fontSize:9,color:"rgba(16,185,129,.45)",fontFamily:"monospace"}}>✦</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
//  LOGIN SCREEN
// ─────────────────────────────────────────────────
function LoginScreen() {
  const {setUser,setScreen,dark,setDark}=useContext(AppCtx);
  const bgRef=useRef(null);const onBgMove=useAnimatedBg(bgRef,dark);
  const [authLoading,setAuthLoading]=useState(true);
  const [loginLoading,setLoginLoading]=useState(false);
  const [error,setError]=useState(null);
  const pending=localStorage.getItem("tm_pending_share");

  useEffect(()=>{applyTheme(dark);},[dark]);

  // Restore session
  useEffect(()=>{
    const token=Token.get();if(!token){setAuthLoading(false);return;}
    api("/api/auth/me").then(async u=>{
      if(u.darkMode)setDark(true);setUser(u);
      if(pending){localStorage.removeItem("tm_pending_share");window.history.replaceState(null,"",`/shared/${pending}`);}
      setScreen("app");
    }).catch(()=>{Token.clear();setAuthLoading(false);});
  },[]);

  const handleGoogle=async res=>{
    setLoginLoading(true);setError(null);
    try{
      const{token,user}=await api("/api/auth/google",{method:"POST",body:{credential:res.credential}});
      Token.set(token);if(user.darkMode)setDark(true);setUser(user);
      if(pending){localStorage.removeItem("tm_pending_share");window.history.replaceState(null,"",`/shared/${pending}`);}
      setScreen("app");
    }catch(e){setError(e.message);}finally{setLoginLoading(false);}
  };

  const handleSkip=()=>{
    if(pending){setError("Para acessar um workspace compartilhado, é necessário fazer login com o Google.");return;}
    setUser({id:"anonymous",name:"Visitante",email:null,photo:null});setScreen("app");
  };

  const floats=[
    {x:3,y:18,size:140,delay:0},{x:85,y:8,size:120,delay:1.4},
    {x:1,y:62,size:130,delay:2.3},{x:83,y:58,size:145,delay:.9},
    {x:75,y:32,size:110,delay:2},{x:10,y:40,size:122,delay:3.2},
  ];

  if(authLoading)return(
    <div style={{width:"100%",height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:dark?"#030807":"#f0fdf4",fontFamily:"'DM Sans',sans-serif",color:"#10b981",fontSize:14,gap:10}}>
      <span style={{animation:"tmSpin 1s linear infinite",display:"inline-block",fontSize:20}}>⟳</span>Verificando sessão…
    </div>
  );

  return (
    <div ref={bgRef} onMouseMove={onBgMove} style={{width:"100%",minHeight:"100vh",display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>
      <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:0,backgroundImage:`radial-gradient(circle,rgba(16,185,129,${dark?.07:.16}) 1px,transparent 1px)`,backgroundSize:"26px 26px"}}/>
      {floats.map((f,i)=><FloatNode key={i} {...f} dark={dark}/>)}

      <button onClick={()=>setDark(d=>!d)} style={{position:"fixed",top:18,right:18,zIndex:200,background:"var(--bg-glass)",backdropFilter:"blur(10px)",border:"1px solid var(--border)",borderRadius:10,padding:"7px 9px",display:"flex",alignItems:"center",cursor:"pointer"}}>
        {dark?<Ic.Sun s={15}/>:<Ic.Moon s={15}/>}
      </button>

      <main style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 20px 40px",position:"relative",zIndex:10,gap:44}}>

        {/* Hero */}
        <div style={{textAlign:"center"}}>
          {pending&&(
            <div style={{display:"inline-flex",alignItems:"center",gap:7,background:"rgba(16,185,129,.11)",border:"1px solid rgba(16,185,129,.28)",borderRadius:100,padding:"5px 16px",marginBottom:20,fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:600,color:"#059669"}}>
              🔗 Faça login para acessar o workspace compartilhado
            </div>
          )}
          {!pending&&(
            <div style={{display:"inline-flex",alignItems:"center",gap:7,background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.22)",borderRadius:100,padding:"5px 18px",marginBottom:20,fontFamily:"'DM Sans',sans-serif",fontSize:10.5,fontWeight:700,color:"#059669",letterSpacing:1.4,textTransform:"uppercase"}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:"#10b981",display:"inline-block",boxShadow:"0 0 6px #10b981",animation:"tmBlink 2s ease infinite"}}/>
              Workspace visual inteligente
            </div>
          )}

          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:"clamp(52px,9vw,100px)",color:"var(--text-main)",letterSpacing:-3,lineHeight:1,marginBottom:18,animation:"tmFadeUp .65s ease both"}}>
            TaskMaster
          </div>
          <div style={{animation:"tmFadeUp .65s ease .14s both"}}><Typewriter/></div>
        </div>

        {/* Login card */}
        <div style={{background:"var(--bg-card)",backdropFilter:"blur(28px) saturate(160%)",border:"1.5px solid var(--border)",borderRadius:24,padding:"32px 38px",width:"100%",maxWidth:400,boxShadow:dark?"0 12px 60px rgba(0,0,0,.6),0 0 0 1px rgba(16,185,129,.1)":"0 10px 52px rgba(16,185,129,.12),0 2px 8px rgba(0,0,0,.04)",display:"flex",flexDirection:"column",gap:13,animation:"tmScaleIn .5s cubic-bezier(.34,1.1,.64,1) .18s both"}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color:"var(--text-main)",textAlign:"center"}}>
            {pending?"Login necessário":"Começar agora"}
          </div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"var(--text-muted)",textAlign:"center",lineHeight:1.55}}>
            {pending?"Entre com Google para acessar o workspace compartilhado.":"Entre com sua conta para salvar workspaces e colaborar em tempo real."}
          </div>

          {error&&<div style={{background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.2)",borderRadius:12,padding:"10px 14px",fontSize:13,color:"#f87171",fontFamily:"'DM Sans',sans-serif",textAlign:"center",lineHeight:1.5}}>{error}</div>}

          {loginLoading?(
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:9,padding:"14px",background:"rgba(16,185,129,.07)",borderRadius:14,border:"1px solid var(--border)",fontFamily:"'DM Sans',sans-serif",fontSize:14,color:"var(--text-muted)"}}>
              <span style={{animation:"tmSpin 1s linear infinite",display:"inline-block",fontSize:18}}>⟳</span>Entrando…
            </div>
          ):(
            <div style={{display:"flex",justifyContent:"center"}}>
              <GoogleLogin onSuccess={handleGoogle} onError={()=>setError("Login Google falhou.")} theme={dark?"filled_black":"filled_green"} size="large" locale="pt-BR" width="320"/>
            </div>
          )}

          {!pending&&(
            <>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,height:1,background:"var(--border)"}}/>
                <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"var(--text-muted)",fontWeight:500}}>ou</span>
                <div style={{flex:1,height:1,background:"var(--border)"}}/>
              </div>
              <button onClick={handleSkip} className="tm-btn" style={{background:"rgba(16,185,129,.05)",color:"#059669",border:"1.5px dashed rgba(16,185,129,.30)",cursor:"pointer",borderRadius:14,padding:"12px 20px",fontFamily:"'DM Sans',sans-serif",fontWeight:500,fontSize:13.5,width:"100%"}}>
                Usar sem conta →
              </button>
              <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:11.5,color:"var(--text-muted)",textAlign:"center",lineHeight:1.6}}>
                Sem login, os dados não são salvos entre sessões.
              </p>
            </>
          )}

          {/* Consentimento LGPD */}
          <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:10.5,color:"var(--text-muted)",textAlign:"center",lineHeight:1.6,borderTop:"1px solid var(--border)",paddingTop:10,margin:0}}>
            Ao entrar, você concorda com a coleta de dados conforme nossa{" "}
            <a href="/privacy" style={{color:"#10b981",textDecoration:"underline"}}>Política de Privacidade</a>.
          </p>
        </div>

        {/* Termos e privacidade */}
        <div style={{display:"flex",gap:18,alignItems:"center",zIndex:10}}>
          {[["Termos de Uso","/terms"],["Política de Privacidade","/privacy"],["Reportar Erro","/report"]].map(([l,h])=>(
            <a key={h} href={h} style={{fontFamily:"'DM Sans',sans-serif",fontSize:11.5,color:"var(--text-muted)",textDecoration:"none",transition:"color .2s"}}
              onMouseEnter={e=>e.currentTarget.style.color="#10b981"}
              onMouseLeave={e=>e.currentTarget.style.color="var(--text-muted)"}>{l}</a>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={{position:"relative",zIndex:10,borderTop:"1px solid var(--border)",background:"var(--bg-glass)",backdropFilter:"blur(14px)",padding:"14px 36px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,fontFamily:"'DM Sans',sans-serif"}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:15,color:"var(--text-main)",letterSpacing:-0.4}}>TaskMaster</div>
        <div style={{fontSize:12,color:"var(--text-muted)"}}>Organize. Priorize. Execute.</div>
        <div style={{fontSize:11,color:"var(--text-muted)"}}>© {new Date().getFullYear()} TaskMaster — Todos os direitos reservados</div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────
//  REPORT PAGE
// ─────────────────────────────────────────────────
function ReportPage() {
  const {dark,setDark}=useContext(AppCtx);
  const [msg,setMsg]=useState("");
  const [email,setEmail]=useState("");
  const [sent,setSent]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{applyTheme(dark);},[dark]);

  const submit=async()=>{
    if(!msg.trim()){setError("Descreva o erro antes de enviar.");return;}
    setLoading(true);setError("");
    try{
      await api("/api/reports",{method:"POST",body:{message:msg,email:email||undefined,page:"app"}});
      setSent(true);
    }catch(e){setError(e.message);}finally{setLoading(false);}
  };

  return (
    <div style={{minHeight:"100vh",background:"var(--bg-card)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 20px",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{width:"100%",maxWidth:480,background:"var(--bg-glass)",border:"1.5px solid var(--border)",borderRadius:24,padding:"36px 38px",boxShadow:"0 12px 48px rgba(0,0,0,.15)"}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:28,color:"var(--text-main)",marginBottom:4}}>TaskMaster</div>
        <MTitle>Reportar um erro</MTitle>
        <p style={{fontSize:13,color:"var(--text-muted)",marginBottom:22,lineHeight:1.6}}>
          Nos ajude a melhorar descrevendo o problema que encontrou.
          Para suporte direto: <a href="mailto:davilla200109@gmail.com" style={{color:"#10b981"}}>davilla200109@gmail.com</a>
        </p>

        {sent?(
          <div style={{textAlign:"center",padding:"28px 0"}}>
            <div style={{fontSize:44,marginBottom:14}}>✅</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:17,color:"var(--text-main)",marginBottom:8}}>Report enviado!</div>
            <p style={{fontSize:13,color:"var(--text-muted)",lineHeight:1.6}}>
              Estamos trabalhando para melhorar o TaskMaster, agradecemos sua compreensão.
            </p>
            <button onClick={()=>window.history.back()} className="tm-btn" style={{marginTop:20,background:"linear-gradient(135deg,#10b981,#059669)",color:"white",border:"none",borderRadius:12,padding:"11px 28px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Voltar</button>
          </div>
        ):(
          <>
            <div style={{marginBottom:12}}>
              <label style={{display:"block",fontSize:12.5,fontWeight:600,color:"var(--text-sub)",marginBottom:6}}>Descreva o erro *</label>
              <textarea value={msg} onChange={e=>setMsg(e.target.value)} rows={5}
                placeholder="O que aconteceu? Quais passos levaram ao erro?"
                style={{width:"100%",background:"transparent",border:"1.5px solid var(--border)",borderRadius:12,padding:"12px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"var(--text-main)",outline:"none",resize:"vertical",boxSizing:"border-box",lineHeight:1.55}}/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{display:"block",fontSize:12.5,fontWeight:600,color:"var(--text-sub)",marginBottom:6}}>E-mail de contato (opcional)</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="Para retorno da equipe"
                style={{width:"100%",background:"transparent",border:"1.5px solid var(--border)",borderRadius:12,padding:"11px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"var(--text-main)",outline:"none",boxSizing:"border-box"}}/>
            </div>
            {error&&<div style={{color:"#f87171",fontSize:12.5,marginBottom:10}}>{error}</div>}
            <button onClick={submit} disabled={loading} className="tm-btn" style={{width:"100%",background:"linear-gradient(135deg,#10b981,#059669)",color:"white",border:"none",borderRadius:12,padding:"13px",fontSize:14,fontWeight:700,cursor:"pointer",opacity:loading?.6:1}}>
              {loading?"Enviando…":"Enviar report"}
            </button>
          </>
        )}
      </div>
      <div style={{display:"flex",gap:16,marginTop:24}}>
        {[["← Voltar","javascript:history.back()"],["Termos","/terms"],["Privacidade","/privacy"]].map(([l,h])=>(
          <a key={h} href={h} style={{fontSize:12,color:"var(--text-muted)",textDecoration:"none"}}>{l}</a>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
//  TERMS PAGE
// ─────────────────────────────────────────────────
function TermsPage() {
  const {dark}=useContext(AppCtx);
  useEffect(()=>{applyTheme(dark);},[dark]);
  return (
    <div style={{minHeight:"100vh",background:"var(--bg-card)",padding:"60px 20px",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{maxWidth:720,margin:"0 auto"}}>
        <a href="/" style={{fontSize:13,color:"#10b981",textDecoration:"none",marginBottom:28,display:"inline-block"}}>← Voltar</a>
        <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:36,color:"var(--text-main)",marginBottom:6}}>Termos de Uso</h1>
        <p style={{fontSize:12.5,color:"var(--text-muted)",marginBottom:36}}>Última atualização: {new Date().getFullYear()}</p>
        {[
          ["1. Aceitação","Ao usar o TaskMaster, você concorda com estes termos. O uso continuado após alterações constitui aceitação das novas condições."],
          ["2. Uso Permitido","O TaskMaster é oferecido para organização pessoal e profissional de tarefas e ideias. É proibido usar a plataforma para atividades ilegais, spam, ou qualquer finalidade que prejudique outros usuários."],
          ["3. Contas","Cada usuário é responsável pela segurança de sua conta e pelo conteúdo criado. O TaskMaster permite até 8 workspaces por conta."],
          ["4. Compartilhamento","Links compartilhados gerados pelo usuário são de responsabilidade exclusiva de quem os criou. Links de visualização indefinida ficam restritos a um por workspace."],
          ["5. Disponibilidade","O TaskMaster é fornecido \"como está\". Não garantimos disponibilidade ininterrupta e podemos realizar manutenções sem aviso prévio."],
          ["6. Encerramento","Você pode excluir sua conta a qualquer momento através das configurações de perfil. Todos os dados serão removidos permanentemente."],
          ["7. Contato","Para dúvidas sobre estes termos, entre em contato: davilla200109@gmail.com"],
        ].map(([t,c])=>(
          <div key={t} style={{marginBottom:28}}>
            <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18,color:"var(--text-main)",marginBottom:8}}>{t}</h2>
            <p style={{fontSize:14,color:"var(--text-sub)",lineHeight:1.7,margin:0}}>{c}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
//  PRIVACY PAGE
// ─────────────────────────────────────────────────
function PrivacyPage() {
  const {dark}=useContext(AppCtx);
  useEffect(()=>{applyTheme(dark);},[dark]);
  return (
    <div style={{minHeight:"100vh",background:"var(--bg-card)",padding:"60px 20px",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{maxWidth:720,margin:"0 auto"}}>
        <a href="/" style={{fontSize:13,color:"#10b981",textDecoration:"none",marginBottom:28,display:"inline-block"}}>← Voltar</a>
        <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:36,color:"var(--text-main)",marginBottom:6}}>Política de Privacidade</h1>
        <p style={{fontSize:12.5,color:"var(--text-muted)",marginBottom:36}}>Última atualização: {new Date().getFullYear()}</p>
        {[
          ["Dados coletados","Coletamos: nome, e-mail e foto de perfil via Google OAuth; conteúdo de workspaces e tarefas; preferências de tema; dados de uso para melhorar o serviço."],
          ["Uso dos dados","Seus dados são usados exclusivamente para fornecer o serviço TaskMaster. Não vendemos dados pessoais a terceiros."],
          ["Cookies","Utilizamos cookies para autenticação (JWT), preferências de tema e, com seu consentimento, cookies de publicidade do Google AdSense para manter o serviço gratuito."],
          ["Google AdSense","O TaskMaster utiliza Google AdSense para exibir anúncios. O Google pode usar cookies para personalizar anúncios conforme sua navegação. Você pode gerenciar isso nas configurações do Google."],
          ["Seus direitos (LGPD)","Conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), você tem direito a: acessar seus dados, corrigi-los, e excluí-los permanentemente a qualquer momento pelo menu de perfil."],
          ["Retenção","Seus dados são mantidos enquanto sua conta existir. Ao excluir a conta, todos os dados são removidos permanentemente dos nossos servidores."],
          ["Contato","Dúvidas sobre privacidade: davilla200109@gmail.com"],
        ].map(([t,c])=>(
          <div key={t} style={{marginBottom:28}}>
            <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18,color:"var(--text-main)",marginBottom:8}}>{t}</h2>
            <p style={{fontSize:14,color:"var(--text-sub)",lineHeight:1.7,margin:0}}>{c}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
//  ROOT
// ─────────────────────────────────────────────────
export default function TaskMasterApp() {
  const [screen,setScreen]=useState("login");
  const [user,setUser]=useState(null);
  const [dark,setDark]=useState(()=>localStorage.getItem("tm_dark")==="1");

  const [cookieConsent,setCookieConsent]=useState(()=>localStorage.getItem("tm_cookie_consent"));

  useEffect(()=>{localStorage.setItem("tm_dark",dark?"1":"0");},[dark]);

  // Route-based page detection
  const path=window.location.pathname;

  const handleCookieAccept=()=>{
    localStorage.setItem("tm_cookie_consent","granted");setCookieConsent("granted");
    if(typeof window.gtag==="function")window.gtag("consent","update",{analytics_storage:"granted",ad_storage:"granted",ad_user_data:"granted",ad_personalization:"granted"});
  };
  const handleCookieDecline=()=>{
    localStorage.setItem("tm_cookie_consent","essential");setCookieConsent("essential");
  };

  const renderPage=()=>{
    if(path==="/report")return<ReportPage/>;
    if(path==="/terms") return<TermsPage/>;
    if(path==="/privacy")return<PrivacyPage/>;
    if(screen==="login")return<LoginScreen/>;
    return<AppScreen/>;
  };

  return (
    <AppCtx.Provider value={{user,setUser,screen,setScreen,dark,setDark}}>
      {renderPage()}
      {cookieConsent===null&&path!=="/terms"&&path!=="/privacy"&&(
        <CookieBanner onAccept={handleCookieAccept} onDecline={handleCookieDecline}/>
      )}
    </AppCtx.Provider>
  );
}
