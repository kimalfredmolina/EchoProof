# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Non-Obvious Documentation Context

- **`docs/IMPLEMENTATION_PLAN.md`** is the canonical specification for all planned phases (1–9). Phases 3–7 and 9 are not yet implemented — do not assume backend services exist for embeddings, LLM queries, agents, or incidents.
- **`backend/index.js` exists at the root of `backend/` but the actual entry point is `backend/src/server.js`** — `package.json` `"main"` points to `src/server.js` and nodemon targets it directly.
- **There is no routing library in the frontend** — `App.jsx` manages all view state (`VIEW.SETUP | INGESTING | READY`) with a plain `useState` enum. References to "pages" or "routes" in planning docs mean future additions, not current structure.
- **`OPENAI_API_KEY` is required in `.env` but unused in current code** — it's validated at startup (`environment.js`) and will generate a warning if absent, but no feature calls it yet.
- **The Incident model is fully defined but has no API routes yet** — it exists in `backend/src/models/Incident.js` as infrastructure for Phase 7.
