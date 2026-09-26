# EchoProof — Development Checklist

> Track task completion per push. Check off each item as it is merged into `main`.
> Last updated: feat/ingest-markdown-docs

---

## Progress Overview

| Phase | Status | Tasks Done |
|---|---|---|
| Phase 1 — Foundation | ✅ Complete | 7 / 7 |
| Phase 2 — GitHub Ingestion | 🟡 In Progress | 6 / 8 |
| Phase 3 — Knowledge Indexing | ⬜ Not Started | 0 / 6 |
| Phase 4 — AI Query Engine | ⬜ Not Started | 0 / 6 |
| Phase 5 — Multi-Agent Investigation | ⬜ Not Started | 0 / 6 |
| Phase 6 — Debugging Workflow | ⬜ Not Started | 0 / 7 |
| Phase 7 — Incident Memory | ⬜ Not Started | 0 / 5 |
| Phase 8 — Frontend Polish | 🟡 In Progress | 1 / 10 |
| Phase 9 — Demo Preparation | ⬜ Not Started | 0 / 7 |

---

## Phase 1 — Foundation

> Goal: Frontend can communicate with the backend and the backend can create a `SystemContext` record.

- [x] Initialize React + Vite frontend
- [x] Initialize Node.js + Express backend
- [x] Configure MongoDB connection (`MONGODB_URI`)
- [x] Configure environment variables (`.env` with `PORT`, `MONGODB_URI`, `GITHUB_TOKEN`, `OPENAI_API_KEY`, `FRONTEND_URL`)
- [x] Create `SystemContext` Mongoose model
- [x] Create `Document` Mongoose model
- [x] Create `Incident` Mongoose model

---

## Phase 2 — GitHub Ingestion

> Goal: A GitHub repository can be analyzed and its engineering history stored in MongoDB.

- [x] Install and configure Octokit (`@octokit/rest`)
- [x] Validate GitHub repository URLs on `POST /api/context`
- [x] Fetch repository metadata (name, description, owner)
- [x] Fetch merged pull requests (number, title, body, author, dates, comments, changed files, URL)
- [x] Fetch commits (SHA, message, author, date, changed files)
- [x] Fetch Markdown documentation (`README.md`, `/docs/*`, `/adr/*`, `*.md`)
- [x] Store raw ingested documents in MongoDB
- [x] Track and expose ingestion status (`pending` → `indexing` → `ready` / `failed`) via `GET /api/context/:id/status`

---

## Phase 3 — Knowledge Indexing

> Goal: A natural-language query can retrieve relevant repository knowledge.

- [ ] Clean and normalize raw documents
- [ ] Chunk documents into appropriately sized segments
- [ ] Generate embeddings using `text-embedding-3-small` (OpenAI)
- [ ] Store embeddings in MongoDB alongside document metadata
- [ ] Create MongoDB vector index for semantic search
- [ ] Attach full metadata to every chunk (URL, author, date, SHA, PR number, file path)

---

## Phase 4 — AI Query Engine

> Goal: EchoProof can answer questions about repository history and explain its evidence.

- [ ] Implement `POST /api/context/:id/query` endpoint
- [ ] Build question-analysis prompt (extract intent and key terms)
- [ ] Implement parallel retrieval across all document types (PRs, commits, ADRs, docs, incidents)
- [ ] Implement evidence ranking (score and sort retrieved chunks by relevance)
- [ ] Implement LLM answer synthesis with source references
- [ ] Handle insufficient-evidence case (return honest "not enough evidence" response)

---

## Phase 5 — Multi-Agent Investigation

> Goal: One user question triggers multiple specialized investigations and combines their results.

- [ ] Create Orchestrator Agent (delegates to sub-agents, collects results, synthesizes final answer)
- [ ] Create Code Investigation Agent (relevant files, execution paths, code relationships)
- [ ] Create Git History Agent (commits, change timeline, related commits)
- [ ] Create Pull Request Agent (PR search, discussion analysis, motivation extraction)
- [ ] Create Documentation Agent (README, ADR, design doc analysis)
- [ ] Create Historical Incident Agent (searches saved incidents for similar bugs)
- [ ] Implement parallel agent execution (`Promise.all` or equivalent)
- [ ] Merge and deduplicate evidence from all agents before synthesis

---

## Phase 6 — Debugging Workflow

> Goal: EchoProof can demonstrate an end-to-end debugging workflow.

- [ ] Add dedicated bug-report input (separate from general query)
- [ ] Identify relevant source code files from the bug description
- [ ] Analyze Git history for changes related to the reported bug
- [ ] Search historical incidents for similar past issues
- [ ] Generate root-cause report (problem, root cause, evidence, affected files)
- [ ] Generate recommended fix proposal (never auto-applied)
- [ ] Generate recommended tests for the proposed fix

---

## Phase 7 — Incident Memory

> Goal: A previously solved issue can influence a future investigation.

- [ ] Implement `POST /api/context/:id/incidents` — save investigation as incident
- [ ] Implement `GET /api/context/:id/incidents` — list saved incidents
- [ ] Implement `GET /api/context/:id/incidents/:incidentId` — get single incident
- [ ] Generate and store embedding for each saved incident
- [ ] Wire Historical Incident Agent to search incident embeddings during future investigations
- [ ] Surface similar past incidents (title, ID, similarity rating, previous root cause, previous resolution) in investigation results

---

## Phase 8 — Frontend Polish

> Goal: Complete, production-quality UI across all pages.

- [x] **Repository Setup page** — URL input, "Analyze Repository" button, progress bar, step label, error state
- [ ] **Main Dashboard** — repo name, status badge, document/PR/commit/incident counts, question input, "Investigate" button
- [ ] **Investigation UI** — per-agent live status list (pending / running / complete)
- [ ] **Answer UI** — root cause, why, evidence list with clickable GitHub links, confidence badge
- [ ] **Save Investigation form** — editable title/problem/root cause/resolution, affected files, evidence, generated tests, save button
- [ ] **Incident History page** — chronological list of saved incidents with timestamps and links
- [ ] **Search History** — recent investigations with timestamps
- [ ] Loading and in-progress states across all views
- [ ] Error states with descriptive messages across all views
- [ ] Empty states (no incidents, no results) across all views
- [ ] Responsive layout (desktop + mobile)

---

## Phase 9 — Demo Preparation

> Goal: A controlled demo repository that lets EchoProof showcase cross-source reasoning end-to-end.

- [ ] Create demo repository (e.g. `echoproof-demo` / `payment-service`)
- [ ] Add several meaningful pull requests (e.g. JWT → HTTP-only cookie auth migration)
- [ ] Add meaningful commit history with descriptive messages
- [ ] Add architecture documentation (`README.md`, `/docs/`)
- [ ] Add at least one ADR (e.g. `ADR-003 — Authentication Architecture`)
- [ ] Introduce at least one intentional bug that EchoProof can discover
- [ ] Add at least one pre-seeded historical incident to demonstrate the Echo effect

---

## Completion Criteria (MVP Definition of Done)

The MVP is complete when a developer can:

- [ ] Enter a GitHub repository URL
- [ ] Start repository ingestion
- [ ] See ingestion progress in real time
- [ ] Successfully ingest PRs, commits, and documentation
- [ ] Search repository knowledge using natural language
- [ ] Ask a debugging or architecture question
- [ ] Trigger multiple specialized AI agents
- [ ] Run relevant investigations in parallel
- [ ] Receive a synthesized answer with evidence
- [ ] View supporting GitHub sources (clickable links)
- [ ] Identify a likely root cause
- [ ] Generate a recommended fix
- [ ] Generate recommended tests
- [ ] Save the investigation as an incident
- [ ] Retrieve that incident during a future investigation
- [ ] Demonstrate measurable time/effort improvement over a manual workflow

---

## How to Use This File

1. When you complete a task, check its box: `- [ ]` → `- [x]`
2. Update the **Progress Overview** table at the top (increment the "Tasks Done" count).
3. Update the phase status emoji:
   - ⬜ Not Started
   - 🟡 In Progress
   - ✅ Complete
4. Commit the updated `CHECKLIST.md` in the same PR as the work it tracks.
