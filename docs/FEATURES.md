# EchoProof — Feature Specification

> **"Your codebase remembers what your team forgot."**
>
> EchoProof is an AI software-maintenance teammate that investigates repository history, delegates work to specialized agents, synthesizes evidence, recommends fixes, generates tests, and preserves engineering knowledge as reusable memory.

---

## Table of Contents

1. [Repository Connection & Ingestion](#1-repository-connection--ingestion)
2. [Knowledge Indexing](#2-knowledge-indexing)
3. [Multi-Agent Investigation Engine](#3-multi-agent-investigation-engine)
4. [AI Query Engine](#4-ai-query-engine)
5. [Evidence-Based Answers](#5-evidence-based-answers)
6. [Debugging Workflow](#6-debugging-workflow)
7. [Fix Generation](#7-fix-generation)
8. [Test Generation](#8-test-generation)
9. [Verification Workflow](#9-verification-workflow)
10. [Incident Memory](#10-incident-memory)
11. [Frontend UI](#11-frontend-ui)
12. [API](#12-api)
13. [Security & AI Safety](#13-security--ai-safety)

---

## 1. Repository Connection & Ingestion

### 1.1 Repository Connection

- Developer enters a GitHub repository URL (`https://github.com/org/repo`).
- The system validates the URL format and confirms the repository is accessible.
- A `SystemContext` record is created as the root object for all repository knowledge.

### 1.2 Asynchronous Ingestion Pipeline

- The `POST /api/context` endpoint returns immediately with a `contextId` and `pending` status.
- Ingestion runs asynchronously in the background so large repositories do not block the UI.
- Ingestion progresses through named steps: fetching PRs, commits, documentation, embedding.

### 1.3 Data Sources Ingested

| Source | Data Collected |
|---|---|
| **Pull Requests** | Number, title, body, author, dates, comments, changed files, linked commits, URL |
| **Commits** | SHA, message, author, date, changed files |
| **Documentation** | `README.md`, `/docs/*`, `/adr/*`, all `*.md` files |

### 1.4 Ingestion Status Tracking

- Real-time status available via `GET /api/context/:id/status`.
- Possible states: `pending`, `indexing`, `ready`, `failed`.
- Progress response includes percentage, current step, processed documents, and total documents.
- Ingestion failures surface the last successful step so developers know where to resume.

---

## 2. Knowledge Indexing

### 2.1 Document Processing Pipeline

Every ingested document passes through the following pipeline:

```
Raw Document → Normalize → Clean → Chunk → Generate Embedding → Store → Vector Index
```

### 2.2 Document Types

The system stores and indexes the following document types:

- `pull_request`
- `commit`
- `design_document`
- `adr`
- `readme`
- `issue`
- `source_code`
- `incident`

### 2.3 Metadata Preservation

Every document chunk retains metadata (URL, author, date, SHA, PR number, file path) so retrieved evidence can always be traced back to its original GitHub source.

### 2.4 Vector Search

- Embeddings are generated using `text-embedding-3-small`.
- Stored in MongoDB with vector indexing.
- Supports semantic retrieval — natural-language queries return relevant documents even without exact keyword matches.

---

## 3. Multi-Agent Investigation Engine

### 3.1 Main Orchestrator Agent

Responsibilities:

- Understand the developer's question or bug report.
- Decide which specialized agents are required.
- Delegate investigation tasks.
- Collect and compare results from all agents.
- Produce the final synthesized response.

### 3.2 Specialized Agents

| Agent | Responsibilities |
|---|---|
| **Code Investigation Agent** | Identifies relevant files, traces execution paths, analyzes code relationships, explains technical behavior |
| **Git History Agent** | Analyzes commits, identifies when behavior changed, finds related commits, compares historical changes |
| **Pull Request Agent** | Searches PRs, analyzes discussions, extracts decisions and motivations from PR descriptions and comments |
| **Documentation Agent** | Analyzes README files, ADRs, and design documentation; finds documented architectural decisions |
| **Historical Incident Agent** | Searches previous EchoProof incidents, identifies similar bugs, compares previous solutions |

### 3.3 Parallel Agent Execution

- When multiple investigation sources are relevant, all applicable agents run simultaneously.
- Parallel execution reduces investigation time compared with sequential manual searching.
- The orchestrator waits for all agents to complete before synthesizing results.

```
Question → Orchestrator → [ Code Agent | Git Agent | PR Agent | Docs Agent | Incident Agent ]
                                              ↓
                                        Synthesizer
```

---

## 4. AI Query Engine

### 4.1 Natural-Language Questions

- Developer submits a free-text question against an indexed repository.
- Examples: *"Why was authentication changed to HTTP-only cookies?"* or *"When was rate limiting introduced?"*

### 4.2 Query Pipeline

```
User Question → Question Analysis → Parallel Retrieval → Evidence Ranking → LLM Synthesis → Verified Answer
```

### 4.3 Retrieval Sources

The query engine retrieves evidence across all indexed source types simultaneously:

- Pull requests
- Commits
- ADRs
- Documentation
- Previous incidents

### 4.4 Confidence Indicator

Every answer includes a confidence level based on evidence quality:

| Level | Meaning |
|---|---|
| **High** | Multiple independent sources support the conclusion |
| **Medium** | Evidence exists but some information is incomplete |
| **Low** | Limited evidence; developer verification recommended |

The confidence indicator never implies certainty when the underlying evidence is weak.

---

## 5. Evidence-Based Answers

### 5.1 Source Attribution

- Every important conclusion includes source references.
- If evidence is insufficient, EchoProof clearly states it cannot answer confidently rather than guessing.

### 5.2 Answer Structure

Every investigation answer includes:

| Field | Description |
|---|---|
| **Root Cause** | What the investigation found |
| **Why** | The motivation or reason behind the change |
| **Evidence** | List of supporting sources (PRs, commits, ADRs, incidents) |
| **Confidence** | High / Medium / Low |

### 5.3 Clickable Source Links

- Every evidence source in the answer links to its original GitHub location.
- Developers can navigate directly to the referenced PR, commit, or document.

---

## 6. Debugging Workflow

### 6.1 Bug Report Input

- Developer submits a natural-language bug description, e.g.:
  *"The POST /api/orders endpoint started returning 401 after yesterday's deployment."*

### 6.2 Automated Investigation Scope

The system investigates:

1. Authentication middleware
2. Relevant commits
3. Recent pull requests
4. Environment and configuration changes
5. API behavior
6. Previous incidents
7. Documentation

### 6.3 Debugging Report

The final report includes:

| Section | Content |
|---|---|
| **Problem** | Summary of the reported issue |
| **Root Cause** | Identified cause with evidence |
| **Evidence** | Supporting sources with links |
| **Affected Files** | Files relevant to the root cause |
| **Recommended Fix** | Proposed code change |
| **Recommended Tests** | Tests to verify the fix |
| **Related Historical Incidents** | Previously resolved similar issues |

---

## 7. Fix Generation

### 7.1 Proposed Fix

- After root cause identification, EchoProof generates a proposed code fix.
- The fix is presented as a **proposal** — it is never automatically applied to production code.
- The developer reviews and approves all changes.

### 7.2 Fix Output

The fix output includes:

- Root cause summary
- Affected file path(s)
- Recommended change description
- Potential impact if left unfixed

---

## 8. Test Generation

### 8.1 Recommended Tests

After proposing a fix, EchoProof generates a list of recommended tests covering:

- Authenticated request succeeds
- Unauthenticated request returns the expected error
- Expired credential handling
- Invalid credential handling
- Authorization edge cases specific to the affected code

### 8.2 Developer Review

- All generated tests are shown to the developer for review before use.
- EchoProof does not automatically run tests against production systems without explicit developer action.

---

## 9. Verification Workflow

### 9.1 Verification Pipeline

```
Proposed Fix → Generate Test → Run Test → Verification Result (PASS / FAIL)
```

### 9.2 Verification Output

When test execution is available, the result includes:

- Total test count
- Passed count
- Failed count
- Build status
- Overall verification result

### 9.3 Honest AI Qualification

When actual test execution is unavailable, EchoProof clearly states that the result is an **AI analysis**, not a verified test run. This distinction is always visible to the developer.

---

## 10. Incident Memory

### 10.1 Save Investigation

After completing an investigation, the developer can save it as an incident.

Saved fields:

- Title
- Problem description
- Root cause
- Resolution
- Evidence list (type, title, URL, reference)
- Affected files
- Generated tests
- Verification result
- Confidence level

### 10.2 Historical Search

- All future investigations automatically search the incident store.
- The Historical Incident Agent retrieves similar past incidents based on semantic similarity.
- Retrieved incidents are included in the evidence presented to the developer.

### 10.3 Echo Effect

When a new issue resembles a past incident, EchoProof surfaces:

- Incident title and ID
- Similarity rating
- Previous root cause
- Previous resolution

This prevents developers from solving the same problem from scratch repeatedly.

---

## 11. Frontend UI

### 11.1 Repository Setup Page

- GitHub URL input field.
- "Analyze Repository" button.
- Real-time ingestion progress bar with percentage.
- Current step label (e.g., *"Processing: Pull Requests"*).
- Error state with descriptive message on failure.

### 11.2 Main Dashboard

Displays after ingestion completes:

- Repository name and ready status indicator.
- Document count, PR count, commit count, incident count.
- Natural-language question input.
- "Investigate" button.
- Recent investigations list.

### 11.3 Investigation UI

While the investigation runs:

- Per-agent status list showing each agent as pending, in-progress, or complete.
- Makes the multi-agent workflow visible so developers understand what is being investigated.

### 11.4 Answer UI

Investigation results display:

- Root Cause section
- Why section (reasoning)
- Evidence list with clickable GitHub links
- Confidence badge (High / Medium / Low)
- "Save to EchoProof Memory" action

### 11.5 Incident UI

Save Investigation form:

- Editable title, problem, root cause, and resolution fields.
- Affected files list.
- Evidence list.
- Generated tests.
- "Save to EchoProof Memory" button.

### 11.6 Search History

- Chronological list of previous investigations.
- Shows title and relative timestamp.
- Each entry links to the full investigation result.

### 11.7 UI States

The frontend handles all required states:

- Loading / in-progress states
- Error states with descriptive messages
- Empty states (no incidents, no results)
- Responsive layout

---

## 12. API

### 12.1 Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/context` | Start repository ingestion |
| `GET` | `/api/context/:id` | Get context details |
| `GET` | `/api/context/:id/status` | Get ingestion status and progress |
| `POST` | `/api/context/:id/query` | Submit a question for investigation |
| `GET` | `/api/context/:id/incidents` | List saved incidents |
| `POST` | `/api/context/:id/incidents` | Save a new incident |
| `GET` | `/api/context/:id/incidents/:incidentId` | Get a specific incident |
| `GET` | `/api/context/:id/documents` | List indexed documents |
| `GET` | `/api/context/:id/search` | Search documents |

### 12.2 Key Request/Response Contracts

**Start Ingestion**
```json
POST /api/context
{ "repoUrl": "https://github.com/org/repo" }
→ { "contextId": "...", "status": "pending" }
```

**Ingestion Status**
```json
GET /api/context/:id/status
→ { "status": "indexing", "progress": 72, "currentStep": "Processing pull requests", "processedDocuments": 144, "totalDocuments": 200 }
```

**Query**
```json
POST /api/context/:id/query
{ "question": "Why was authentication changed to HTTP-only cookies?" }
```

---

## 13. Security & AI Safety

### 13.1 Security Requirements

- API keys are never exposed to the frontend.
- All secrets are stored in environment variables and never committed to Git.
- GitHub repository URLs are validated before processing.
- External repository content is treated as untrusted input and sanitized before processing.
- The system never automatically executes arbitrary repository code.

### 13.2 AI Safety Principles

| Principle | Description |
|---|---|
| **Evidence First** | The AI prioritizes retrieved repository evidence over general knowledge |
| **Source Attribution** | Every important claim includes a traceable source reference |
| **No Evidence = No Strong Claim** | If evidence is insufficient, EchoProof says so clearly |
| **Human Approval** | The developer approves all code changes, tests, deployments, and architectural decisions |

EchoProof assists the developer rather than replacing developer judgment.

### 13.3 AI Output Qualification

- AI-generated recommendations are visually distinguished from verified execution results.
- Fix proposals are marked as proposals, not confirmed solutions.
- Test results from actual execution are distinguished from AI-predicted test outcomes.

---

## Feature Summary by Development Phase

| Phase | Features Delivered |
|---|---|
| **Phase 1 — Foundation** | Frontend ↔ backend connection, MongoDB setup, Mongoose models, basic API structure |
| **Phase 2 — GitHub Ingestion** | Octokit integration, PR/commit/documentation ingestion, raw document storage, status tracking |
| **Phase 3 — Knowledge Indexing** | Document cleaning, chunking, embedding generation, vector storage, semantic search |
| **Phase 4 — AI Query Engine** | Question processing, retrieval, evidence ranking, answer synthesis, source references |
| **Phase 5 — Multi-Agent Investigation** | Orchestrator, 5 specialized agents, parallel execution, evidence merging |
| **Phase 6 — Debugging Workflow** | Bug report input, root-cause report, fix generation, test generation |
| **Phase 7 — Incident Memory** | Incident model, save/search incidents, historical evidence in future investigations |
| **Phase 8 — Frontend Polish** | All pages, agent progress UI, source citations, loading/error/empty states, responsive layout |
| **Phase 9 — Demo Preparation** | Controlled demo repository with PRs, commits, ADRs, planted bug, historical incident |
