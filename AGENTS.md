# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Stack

- **Backend**: Node.js + Express 5 (CommonJS `require`), Mongoose 9, `@octokit/rest`, nodemon for dev
- **Frontend**: React 19 + Vite 8 + Tailwind CSS 4 (ESM `import`), no router — single `App.jsx`
- **DB**: MongoDB Atlas (connection string in `backend/.env`)

## Commands

All commands must be run from the respective subdirectory — there are no root-level scripts.

```bash
# Backend
cd backend && npm run dev     # nodemon src/server.js → http://localhost:5000
cd backend && npm start       # production

# Frontend
cd frontend && npm run dev    # vite → http://localhost:5173
cd frontend && npm run build
cd frontend && npm run lint   # eslint on *.js / *.jsx

# No test runner is configured (backend test script exits 1)
```

## Critical Architecture Details

- **`environment.js` resolves `.env` relative to its own `__dirname`** (`../../.env`), so the `.env` file must sit at `backend/.env` — not the project root.
- **`validateEnv()` only warns, never throws** — missing `MONGODB_URI` / `GITHUB_TOKEN` / `OPENAI_API_KEY` produce a console warning; `connectDatabase()` is what actually hard-fails on a missing URI.
- **Ingestion runs fire-and-forget**: `runIngestion()` is called without `await` in the controller. Progress is polled via `GET /api/context/:id/status` at 2-second intervals from the frontend.
- **Vite dev server proxies `/api` → `http://localhost:5000`** (configured in `vite.config.js`), so frontend fetch calls use bare `/api/...` paths — no hardcoded backend URL.
- **CORS origin is driven by `env.FRONTEND_URL`** (defaults to `http://localhost:5173`). Other origins are blocked.

## Document Types (enforced enum)

Valid `Document.type` values: `pull_request`, `commit`, `design_document`, `adr`, `readme`, `issue`, `source_code`, `incident`. Markdown files are auto-classified via `classifyMarkdownType()` in `ingestion.service.js`.

## SystemContext Status Flow

`pending` → `indexing` → `ready` | `failed`

Ingestion progress percentage milestones: 10% (metadata), 30% (PRs), 60% (commits), 90% (docs), 100% (complete).

## Code Style

- **Backend**: CommonJS only (`require`/`module.exports`). No TypeScript. Console logs use bracketed prefixes: `[server]`, `[db]`, `[ingestion]`, `[github]`, `[env]`.
- **Frontend**: ESM (`import`/`export`). `.jsx` files only (no `.tsx`). Tailwind utility classes inline — no CSS modules or separate stylesheets.
- **Mongoose subdocuments** always use `{ _id: false }` in their schema options.
- **No try/catch in controllers** — Express 5 automatically propagates async errors to the global error handler at the bottom of `server.js`.

## Branch Strategy

`feat/*` → `dev` → `main`. Current active branch pattern: `feature/<name>` (note: README says `feat/*` but existing branch uses `feature/`).
