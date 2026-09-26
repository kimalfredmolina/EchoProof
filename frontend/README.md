# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

EchoProof — Full Feature & Task Breakdown
🏗️ Phase 1 — Foundation (Infrastructure & Auth)
 Set up MongoDB schema for SystemContext (repo URL, name, description, ingestion status)
 Set up MongoDB schema for Document (type: PR/commit/ADR/design-doc, content, metadata, embeddings)
 Configure .env with GITHUB_TOKEN, OPENAI_API_KEY, MONGODB_URI
 Connect Mongoose to MongoDB in backend/index.js
 Add GitHub API client (Octokit) to the backend
📥 Phase 2 — Ingestion Pipeline ("Legacy Decoder" core)
 POST /api/context — create a new SystemContext from a GitHub repo URL
 Fetch all merged PRs from the repo via GitHub API (title, body, comments, linked commits)
 Fetch commit messages from the repo
 Fetch any .md files in /docs, /adr, or root as design docs
 Chunk and embed each document using OpenAI embeddings (text-embedding-3-small)
 Store embedded chunks in MongoDB (or a vector store like mongodb-atlas-vector-search)
 Background job / async ingestion so the API doesn't time out on large repos
 GET /api/context/:id/status — poll ingestion progress (pending / indexing / ready)
🤖 Phase 3 — Query & Answer Engine
 POST /api/context/:id/query — accept a natural language question
 Vector-search the embedded chunks to find the most relevant PRs/docs
 If multiple PRs are relevant, pass all of them to the LLM (the "synthesis" wow moment)
 Prompt the LLM to answer in teammate voice: what changed, why, who, when, with PR link
 Return answer + source links (PR URLs, commit SHAs) so the answer is verifiable
 Subagent pattern: parallelize embedding lookups across document types (PRs vs commits vs ADRs)
🎨 Phase 4 — Frontend (One search box)
 Replace current ping/pong UI with the EchoProof UI
 Repo URL input + "Analyze Repo" button → triggers ingestion, shows progress
 Ingestion status indicator (pending → indexing → ready)
 Single search/question input box (the core UI)
 Answer display area — plain text answer with clickable source PR links
 Loading state while the query is being answered
 Error state (repo not found, ingestion failed, no answer found)
🧪 Phase 5 — Polish & Demo Readiness
 Test against a real public GitHub repo with known PRs
 Verify multi-PR synthesis works (the "two PRs → one answer" wow moment)
 Add a demo repo suggestion (e.g. a well-documented open source project) for the pitch
 Impact metric placeholder: log query response time for before/after comparison
 Basic input validation (valid GitHub URL, repo must be public or token-accessible)
🗂️ System Context — specifically what you were asked about
A System Context in this project is the record created when you point EchoProof at a repo. It holds:

Field	Purpose
repoUrl	The GitHub repo being analyzed
name	Human-readable name (e.g. my-org/payment-service)
status	pending → indexing → ready
documents	All ingested PRs, commits, ADRs linked to this context
createdAt	When ingestion started
So to make a system context, you need:

A GitHub repo URL from the user
A POST /api/context endpoint that creates the DB record
A GitHub API call to start pulling PRs and docs
An embedding + storage step to make it queryable