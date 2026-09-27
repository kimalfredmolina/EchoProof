# EchoProof — AI Decision Memory

> Your codebase remembers what your team forgot.

EchoProof is an AI software-maintenance teammate that investigates repository history, delegates work to specialized agents, synthesizes evidence, recommends fixes, generates tests, and preserves engineering knowledge as reusable memory.

---

## Quickstart for Collaborators

### Prerequisites

- [Node.js v22.12+](https://nodejs.org/)
- The `.env` file sent to you by the team (place it at `backend/.env`)

---

### 1. Clone the repository

```bash
git clone https://github.com/kimalfredmolina/EchoProof-AI-Decision-Memory.git
cd EchoProof-AI-Decision-Memory
```

### 2. Place the `.env` file

Put the shared `backend/.env` file inside the `backend/` folder:

```
EchoProof-AI-Decision-Memory/
└── backend/
    └── .env   ← place it here
```

### 3. Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend (open a new terminal)
cd frontend
npm install
```

### 4. Start the app

Open **two terminals**:

**Terminal 1 — Backend**
```bash
cd backend
npm run dev
```

Expected output:
```
[db] MongoDB connected successfully
[server] Running on http://localhost:5000
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
```

Expected output:
```
VITE ready
➜ Local: http://localhost:5173/
```

### 5. Open the app

Go to **http://localhost:5173** in your browser.

---

## Testing the Ingestion

Once both servers are running, paste this into a terminal to analyze the repo:

```powershell
Invoke-RestMethod -Method POST `
  -Uri http://localhost:5000/api/context `
  -ContentType "application/json" `
  -Body '{"repoUrl":"https://github.com/kimalfredmolina/EchoProof-AI-Decision-Memory"}'
```

Poll the status with the returned `contextId`:

```powershell
Invoke-RestMethod http://localhost:5000/api/context/<contextId>/status
```

After the context reports `ready`, trigger the Phase 5 multi-agent investigation:

```powershell
Invoke-RestMethod -Method POST `
  -Uri http://localhost:5000/api/context/<contextId>/query `
  -ContentType "application/json" `
  -Body '{"question":"Why was authentication changed?"}'
```

The response contains every agent's status and summary, merged/deduplicated evidence, confidence, and an evidence-grounded answer. Public repositories work normally. Private repositories require a `GITHUB_TOKEN` that can read the repository and an exact `owner/repo` entry in `PRIVATE_REPOSITORY_ALLOWLIST`; comma-separate multiple repositories or use `*` only in a trusted local deployment. Retrieval currently falls back to lexical matching because the Phase 3 indexing pipeline is not present in this checkout. External OpenAI synthesis is opt-in with `ALLOW_EXTERNAL_SYNTHESIS=true`; enabling it authorizes sending retrieved public or private evidence to OpenAI. With it disabled, EchoProof returns a local evidence-only summary.

Or just use the UI at **http://localhost:5173** — paste the repo URL and click **Analyze Repository**.

---

## Project Structure

```
EchoProof-AI-Decision-Memory/
├── backend/                  # Node.js + Express API
│   ├── src/
│   │   ├── config/           # Database + environment config
│   │   ├── controllers/      # Route handlers
│   │   ├── models/           # Mongoose models (SystemContext, Document, Incident)
│   │   ├── routes/           # Express routes
│   │   └── services/         # GitHub ingestion + business logic
│   └── .env                  # ← your shared env file goes here (not committed)
├── frontend/                 # React + Vite + Tailwind
│   └── src/
│       └── App.jsx           # Repository Setup UI
└── docs/
    ├── CHECKLIST.md          # Development progress tracker
    ├── FEATURES.md           # Full feature specification
    └── SYSTEM_CONTEXT.md     # System architecture overview
```

---

## What's in the `.env`

| Variable | Purpose |
|---|---|
| `PORT` | Backend port (default `5000`) |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `GITHUB_TOKEN` | GitHub token with access to repositories being ingested |
| `PRIVATE_REPOSITORY_ALLOWLIST` | Comma-separated private `owner/repo` values (`*` only for trusted local use) |
| `OPENAI_API_KEY` | OpenAI API key for optional grounded synthesis and future embeddings |
| `ALLOW_EXTERNAL_SYNTHESIS` | Set `true` to permit public or private evidence to be sent to OpenAI |
| `GROQ_API_KEY` | Groq API key retained for Groq-based integrations |
| `FRONTEND_URL` | Frontend URL for CORS (default `http://localhost:5173`) |

---

## Deploying to Render and Vercel

The frontend calls the backend through `VITE_API_URL`; Vite embeds this value at build time. The backend accepts browser requests only from the exact origins in `FRONTEND_URL`.

### 1. Deploy the backend on Render

The root [`render.yaml`](render.yaml) can create the web service as a Render Blueprint. If you configure it manually, use:

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Health Check Path | `/api/ping` |
| Node | `>=22.12.0` |

Set `MONGODB_URI`, `GITHUB_TOKEN`, `GROQ_API_KEY`, and `FRONTEND_URL` in Render. Set `FRONTEND_URL` to the exact Vercel origin, such as `https://your-app.vercel.app`, with no path. Multiple exact production/preview origins can be comma-separated. Do not set `PORT`; Render supplies it.

### 2. Deploy the frontend on Vercel

Import this repository and configure:

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node | `>=22.12.0` |

Add `VITE_API_URL=https://your-backend.onrender.com` to the Vercel Production environment (and Preview if required), with no `/api` suffix or trailing slash. Redeploy after changing it because Vite environment variables are embedded during the build.

Finally, update Render's `FRONTEND_URL` if Vercel assigns a different production domain, then verify `https://your-backend.onrender.com/api/ping` and submit a repository through the deployed UI.

---

## Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Stable releases only |
| `dev` | Integration branch — all features merge here first |
| `feat/*` | Individual feature branches |

Feature branches follow the pattern `feat/<feature-name>` and are merged into `dev` via pull request.

---

## Current Progress

| Phase | Status |
|---|---|
| Phase 1 — Foundation | ✅ Complete |
| Phase 2 — GitHub Ingestion | ✅ Complete |
| Phase 3 — Knowledge Indexing | ⬜ Not Started |
| Phase 4 — AI Query Engine | ✅ Complete |
| Phase 5 — Multi-Agent Investigation | ✅ Complete |
| Phase 6 — Debugging Workflow | ⬜ Not Started |
| Phase 7 — Incident Memory | ⬜ Not Started |
| Phase 8 — Frontend Polish | 🟡 In Progress |
| Phase 9 — Demo Preparation | ⬜ Not Started |

See [`docs/CHECKLIST.md`](docs/CHECKLIST.md) for the full task-level breakdown.
