# EchoProof — AI Decision Memory

> Your codebase remembers what your team forgot.

EchoProof is an AI software-maintenance teammate that investigates repository history, delegates work to specialized agents, synthesizes evidence, recommends fixes, generates tests, and preserves engineering knowledge as reusable memory.

---

## Quickstart for Collaborators

### Prerequisites

- [Node.js v18+](https://nodejs.org/)
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

The response contains every agent's status and summary, merged/deduplicated evidence, confidence, and an evidence-grounded answer. Querying is limited to repositories verified as public; existing contexts created before this field was introduced should be re-ingested. Retrieval falls back to lexical matching while Phase 3 is unfinished. External OpenAI synthesis is opt-in (`ALLOW_EXTERNAL_SYNTHESIS=true`); otherwise EchoProof returns an honest evidence-only summary.

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
| `GITHUB_TOKEN` | GitHub Personal Access Token (`repo` scope) |
| `OPENAI_API_KEY` | OpenAI API key (for embeddings — Phase 3+) |
| `FRONTEND_URL` | Frontend URL for CORS (default `http://localhost:5173`) |

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
| Phase 4 — AI Query Engine | ⬜ Not Started |
| Phase 5 — Multi-Agent Investigation | ⬜ Not Started |
| Phase 6 — Debugging Workflow | ⬜ Not Started |
| Phase 7 — Incident Memory | ⬜ Not Started |
| Phase 8 — Frontend Polish | 🟡 In Progress |
| Phase 9 — Demo Preparation | ⬜ Not Started |

See [`docs/CHECKLIST.md`](docs/CHECKLIST.md) for the full task-level breakdown.
