# TaskMaster — Memória do Projeto (Claude)

## Repositório
- GitHub: `odavilla200109-oss/TaskMasterOFC`
- Branch de trabalho: `claude/tender-ishizaka`
- Worktree local: `C:\Users\horse\Documents\TaskMasterOFC\.claude\worktrees\tender-ishizaka\`

## Estrutura do Projeto

```
TaskMasterOFC/
├── taskmaster-backend/
│   ├── src/
│   │   ├── server.js          ← entry point (node src/server.js)
│   │   ├── db.js              ← SQLite (better-sqlite3, WAL)
│   │   ├── ws.js              ← WebSocket colaboração
│   │   ├── middleware/auth.js ← JWT verify
│   │   ├── routes/auth.js     ← Google OAuth + JWT
│   │   ├── routes/canvases.js ← CRUD workspaces + nodes + shares
│   │   ├── routes/reports.js  ← reportar erros
│   │   └── utils/formatNodes.js
│   ├── package.json           ← "start": "node src/server.js"
│   ├── railway.toml           ← startCommand = "node src/server.js"
│   ├── Procfile               ← web: node src/server.js
│   └── .env.example
│
└── taskmaster-frontend/
    ├── src/
    │   ├── App.jsx            ← Root: context + routing (~40 linhas)
    │   ├── main.jsx
    │   ├── sounds.js
    │   ├── index.css
    │   ├── config/constants.js     ← API_URL, WS_URL, Token, api(), uid, constantes
    │   ├── context/AppContext.jsx  ← AppCtx (React context)
    │   ├── theme/theme.js          ← applyTheme(dark)
    │   ├── utils/nodeUtils.js      ← getDescendants, nW, nH, collides, freePos, isOverdue, fmtDue, brainOrbit
    │   ├── icons/index.jsx         ← Ic (todos SVG) + PriIcon
    │   ├── hooks/
    │   │   ├── useAnimatedBg.js   ← background animado com mouse
    │   │   └── useCollabWS.js     ← WebSocket colaboração
    │   ├── components/
    │   │   ├── Modal.jsx           ← Modal + MTitle
    │   │   ├── CookieBanner.jsx
    │   │   ├── BurstEffect.jsx     ← partículas ao completar tarefa
    │   │   ├── DueDatePicker.jsx
    │   │   ├── NodeCard.jsx        ← card de tarefa
    │   │   ├── BrainNodeCard.jsx   ← card de brainstorm
    │   │   ├── ProfileMenu.jsx
    │   │   ├── Sidebar.jsx
    │   │   ├── ShareModal.jsx
    │   │   └── PasswordModal.jsx
    │   └── pages/
    │       ├── AppScreen.jsx       ← tela principal (canvas + lógica)
    │       ├── LoginScreen.jsx     ← login Google + visitante
    │       ├── ReportPage.jsx      ← /report
    │       ├── TermsPage.jsx       ← /terms
    │       └── PrivacyPage.jsx     ← /privacy
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── vercel.json

## Tech Stack
- Frontend: React 18 + Vite + Google OAuth (@react-oauth/google)
- Backend: Node.js + Express + WebSocket (ws) + SQLite (better-sqlite3)
- Deploy: Railway (backend) + Vercel (frontend)
- Auth: Google OAuth + JWT
- Fontes: Plus Jakarta Sans (títulos) + Inter (corpo)

## Deploy
- Backend: Railway — `node src/server.js`
- Frontend: Vercel
- Env vars backend: JWT_SECRET, GOOGLE_CLIENT_ID, ALLOWED_ORIGINS, PORT

## Funcionalidades
- Workspaces tipo Task (tarefas hierárquicas) e Brain (brainstorm radial)
- Colaboração em tempo real via WebSocket
- Compartilhamento: links públicos com senha e expiração
- Auth Google OAuth + visitante (sem conta)
- Undo/Redo (50 itens), dark/light mode
- Export/Import JSON
- LGPD: deleção de conta com cascade

## Banco de Dados (SQLite)
Tabelas: users, canvases, nodes, brain_nodes, canvas_shares, error_reports
Limites: 8 workspaces/user, 500 nodes/canvas, 1 link ∞ view/canvas

## Contexto / Histórico de Mudanças
- Reorganização: App.jsx (1987 linhas) → 22 arquivos modulares
- Backend: removidos arquivos duplicados da raiz, package.json corrigido
- Fix deploy Railway: railway.toml + Procfile + paths require corrigidos em server.js
- Fontes atualizadas: DM Sans → Inter, Syne → Plus Jakarta Sans
- Fix ícones: --text-muted dark mode melhorado para visibilidade
- Termos e Privacidade: conteúdo atualizado com textos oficiais do cliente

## Padrões do Código
- Estilos: todos inline no JSX (sem CSS framework)
- Cores: tema verde (#10b981 primário), CSS variables --bg-card, --border, --text-main, --text-sub, --text-muted
- Animações: definidas em index.css (tmFadeUp, tmScaleIn, tmNodeIn, etc)
- Contexto global: AppCtx (user, setUser, screen, setScreen, dark, setDark)
```
