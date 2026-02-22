// ─────────────────────────────────────────────────
//  CONFIG & CONSTANTS
// ─────────────────────────────────────────────────
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
export const WS_URL  = API_URL.replace(/^https/, "wss").replace(/^http(?!s)/, "ws");

export const Token = {
  get:   ()  => localStorage.getItem("tm_token"),
  set:   (t) => localStorage.setItem("tm_token", t),
  clear: ()  => localStorage.removeItem("tm_token"),
};

export async function api(path, opts = {}) {
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

export const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

export const NODE_W        = 224;
export const NODE_H        = 108;
export const NODE_W_CHILD  = 178;
export const NODE_H_CHILD  = 76;
export const NODE_GAP_X    = 56;
export const NODE_GAP_Y    = 60;

export const BRAIN_ROOT_W  = 190;
export const BRAIN_ROOT_H  = 60;
export const BRAIN_CHILD_W = 148;
export const BRAIN_CHILD_H = 44;
export const BRAIN_ORBIT_R = 230;

export const MAX_WS = 8;

export const PRIORITY = {
  order: ["none","low","medium","high"],
  color: { none:"#a7f3d0", low:"#34d399", medium:"#f59e0b", high:"#ef4444" },
  label: { none:"Sem prioridade", low:"Baixa", medium:"Média", high:"Alta" },
};

export const BRAIN_COLORS = [
  "#10b981","#3b82f6","#8b5cf6","#f59e0b",
  "#ef4444","#ec4899","#06b6d4","#84cc16",
];

export const SUBTITLES = [
  "Organize suas ideias com clareza.",
  "Do caos à execução, sem fricção.",
  "Transforme pensamentos em ação.",
  "Planejamento visual que flui com você.",
  "Suas tarefas, do seu jeito.",
  "Foco total. Resultados reais.",
];
