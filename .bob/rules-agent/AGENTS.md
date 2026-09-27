# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Non-Obvious Coding Rules

- **Backend is CommonJS, frontend is ESM** — never mix `import`/`export` into backend files or `require()` into frontend files. `backend/package.json` has `"type": "commonjs"`, `frontend/package.json` has `"type": "module"`.
- **No try/catch needed in Express controllers** — Express 5 auto-catches async rejections and forwards them to the global error handler in `server.js`. Only add try/catch when you need custom recovery logic.
- **`env` object is the single source of truth for config** — import from `../config/environment` rather than reading `process.env` directly anywhere in backend code.
- **Progress updates use dot-notation `$set` patches** — `updateProgress()` in `ingestion.service.js` maps flat keys to `ingestionProgress.<key>` paths. When updating `ingestionProgress` fields directly with `findByIdAndUpdate`, use `$set: { 'ingestionProgress.field': value }` consistently.
- **`Document.embedding` field exists but is unpopulated** — it is reserved for Phase 3 (OpenAI embeddings). Do not attempt to query on it yet; there is no vector index.
- **Tailwind 4 via Vite plugin** — Tailwind is loaded as `@tailwindcss/vite` plugin, not via `postcss.config.js`. There is no `tailwind.config.js`; utility classes work out of the box with no config file needed.
- **`classifyMarkdownType()`** is the only place that determines Document type for Markdown files — extend it when adding new document type classifications (e.g., future `changelog` type).
- **Commit title is hard-truncated to 120 chars** in `ingestion.service.js` — match this limit if adding similar title fields elsewhere.
