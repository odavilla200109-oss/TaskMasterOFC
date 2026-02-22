# Relatório de Análise e Mapeamento de Arquivos

Gerado em: 2026-02-22T19:31:45.655853Z

## Escopo

- Diretório analisado: `/workspace/TaskMasterOFC`.
- Inventário completo: `docs/inventario_arquivos_completo.txt`.
- Inventário sem dependências (`node_modules`): `docs/inventario_sem_node_modules.txt`.

## Visão geral

- Total de arquivos (incluindo `node_modules`): **3849**.
- Total de arquivos (excluindo `node_modules`): **48**.

## Distribuição por área (incluindo `node_modules`)

- `taskmaster-frontend`: 2237 arquivos
- `taskmaster-backend`: 1611 arquivos
- `CLAUDE_MEMORY.md`: 1 arquivos

## Distribuição por área (sem `node_modules`)

- `taskmaster-frontend`: 33 arquivos
- `taskmaster-backend`: 12 arquivos
- `docs`: 2 arquivos
- `CLAUDE_MEMORY.md`: 1 arquivos

## Extensões mais frequentes (incluindo `node_modules`)

- `.js`: 2075
- `.map`: 460
- `.md`: 341
- `.json`: 308
- `.ts`: 261
- `(sem_ext)`: 223
- `.cts`: 28
- `.mts`: 28
- `.jsx`: 19
- `.mjs`: 19
- `.cjs`: 17
- `.txt`: 16
- `.node`: 5
- `.h`: 4
- `.mk`: 4

## Extensões mais frequentes (sem `node_modules`)

- `.jsx`: 19
- `.js`: 15
- `.json`: 4
- `.txt`: 3
- `.toml`: 1
- `(sem_ext)`: 1
- `.html`: 1
- `.css`: 1
- `.md`: 1
- `.svg`: 1
- `.xml`: 1

## Estrutura funcional principal

### Backend (`taskmaster-backend`)
- `taskmaster-backend/Procfile`
- `taskmaster-backend/package.json`
- `taskmaster-backend/railway.toml`
- `taskmaster-backend/src/db.js`
- `taskmaster-backend/src/middleware/auth.js`
- `taskmaster-backend/src/routes/auth.js`
- `taskmaster-backend/src/routes/canvases.js`
- `taskmaster-backend/src/routes/reports.js`
- `taskmaster-backend/src/server.js`
- `taskmaster-backend/src/utils/formatNodes.js`
- `taskmaster-backend/src/ws.js`
- `taskmaster-backend/vercel.json`

### Frontend (`taskmaster-frontend`)
- `taskmaster-frontend/index.html`
- `taskmaster-frontend/package.json`
- `taskmaster-frontend/public/favicon.svg`
- `taskmaster-frontend/public/robots.txt`
- `taskmaster-frontend/public/sitemap.xml`
- `taskmaster-frontend/src/App.jsx`
- `taskmaster-frontend/src/components/BrainNodeCard.jsx`
- `taskmaster-frontend/src/components/BurstEffect.jsx`
- `taskmaster-frontend/src/components/CookieBanner.jsx`
- `taskmaster-frontend/src/components/DueDatePicker.jsx`
- `taskmaster-frontend/src/components/Modal.jsx`
- `taskmaster-frontend/src/components/NodeCard.jsx`
- `taskmaster-frontend/src/components/PasswordModal.jsx`
- `taskmaster-frontend/src/components/ProfileMenu.jsx`
- `taskmaster-frontend/src/components/ShareModal.jsx`
- `taskmaster-frontend/src/components/Sidebar.jsx`
- `taskmaster-frontend/src/config/constants.js`
- `taskmaster-frontend/src/context/AppContext.jsx`
- `taskmaster-frontend/src/hooks/useAnimatedBg.js`
- `taskmaster-frontend/src/hooks/useCollabWS.js`
- `taskmaster-frontend/src/icons/index.jsx`
- `taskmaster-frontend/src/index.css`
- `taskmaster-frontend/src/main.jsx`
- `taskmaster-frontend/src/pages/AppScreen.jsx`
- `taskmaster-frontend/src/pages/LoginScreen.jsx`
- `taskmaster-frontend/src/pages/PrivacyPage.jsx`
- `taskmaster-frontend/src/pages/ReportPage.jsx`
- `taskmaster-frontend/src/pages/TermsPage.jsx`
- `taskmaster-frontend/src/sounds.js`
- `taskmaster-frontend/src/theme/theme.js`
- `taskmaster-frontend/src/utils/nodeUtils.js`
- `taskmaster-frontend/vercel.json`
- `taskmaster-frontend/vite.config.js`

## Observações

- Há grande volume de arquivos de terceiros em `taskmaster-backend/node_modules` e `taskmaster-frontend/node_modules`.
- O código fonte da aplicação está concentrado em `taskmaster-backend/src` e `taskmaster-frontend/src`.
- O mapeamento completo foi preservado em arquivo texto para auditoria e busca rápida.

