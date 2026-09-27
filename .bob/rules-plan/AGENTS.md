# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Non-Obvious Architectural Constraints

- **Ingestion is intentionally fire-and-forget** — `runIngestion()` is not awaited by design. Any new ingestion steps must be added sequentially inside `runIngestion()` and update `ingestionProgress` via `updateProgress()`. Do not restructure this to be synchronous.
- **GitHub rate limits are a real bottleneck** — `fetchPullRequests` and `fetchCommits` each call `octokit.repos.getCommit` / `octokit.pulls.listFiles` per item. Large repos will hit secondary rate limits. Any changes to these services should preserve or improve this pattern, not make it more aggressive.
- **MongoDB is the only persistence layer** — there is no cache, queue, or file system storage. All ingestion output goes to the `Document` collection. Vector search (Phase 3) will require a MongoDB Atlas Vector Search index to be created manually on the `embedding` field.
- **`SystemContext` status enum is load-bearing** — frontend polling logic and ingestion pipeline both branch on `pending | indexing | ready | failed`. Adding new statuses requires updating both `SystemContext.js` schema and frontend `App.jsx` polling handler.
- **CORS is locked to `env.FRONTEND_URL`** — any additional frontend origin (e.g., staging) requires updating this env var; there is no allowlist. Do not widen CORS to `*`.
- **No authentication layer exists** — all `/api/*` routes are open. Any future auth middleware must be added to `server.js` before the route registrations.
