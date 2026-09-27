import { useState, useEffect, useRef } from 'react'

// ── API helpers ──────────────────────────────────────────────────────────────

async function startIngestion(repoUrl) {
  const res = await fetch('/api/context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

async function fetchStatus(contextId) {
  const res = await fetch(`/api/context/${contextId}/status`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

async function fetchContext(contextId) {
  const res = await fetch(`/api/context/${contextId}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

async function submitQuery(contextId, question) {
  const res = await fetch(`/api/context/${contextId}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return normalizeQueryResult(data)
}

async function saveIncident(contextId, payload) {
  const res = await fetch(`/api/context/${contextId}/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

async function fetchIncidents(contextId) {
  const res = await fetch(`/api/context/${contextId}/incidents`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

function normalizeQueryResult(data) {
  const nestedAnswer = data.answer && typeof data.answer === 'object' ? data.answer : null
  const evidence = Array.isArray(data.evidence) ? data.evidence : []
  const sources = evidence.length > 0
    ? evidence.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        url: item.url,
        reference: item.reference || '',
        excerpt: item.excerpt || '',
        author: item.metadata?.author || '',
      }))
    : Array.isArray(data.sources) ? data.sources : []

  return {
    ...data,
    rootCause: nestedAnswer?.rootCause ?? data.rootCause ?? null,
    why: nestedAnswer?.why ?? data.why ?? null,
    answerText: nestedAnswer?.summary
      ?? (typeof data.answer === 'string' ? data.answer : 'No answer was generated.'),
    sources,
  }
}

// ── Small shared components ──────────────────────────────────────────────────

const STEPS = [
  'Fetching repository metadata',
  'Fetching pull requests',
  'Fetching commits',
  'Fetching documentation',
  'Complete',
]

function StepList({ currentStep, status }) {
  return (
    <ol className="text-left space-y-2 mt-4">
      {STEPS.map((step, i) => {
        const stepIndex = STEPS.indexOf(currentStep)
        const isDone = status === 'ready' || i < stepIndex || currentStep === 'Complete'
        const isActive = step === currentStep && status === 'indexing'
        return (
          <li key={step} className="flex items-center gap-3 text-sm">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
              ${isDone ? 'bg-green-500 text-white' : isActive ? 'bg-blue-500 text-white animate-pulse' : 'bg-gray-200 text-gray-400'}`}>
              {isDone ? '✓' : i + 1}
            </span>
            <span className={isDone ? 'text-gray-700' : isActive ? 'text-blue-700 font-medium' : 'text-gray-400'}>
              {step}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function ConfidenceBadge({ level }) {
  const styles = {
    high: 'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-red-100 text-red-700 border-red-200',
  }
  const labels = { high: 'High Confidence', medium: 'Medium Confidence', low: 'Low Confidence' }
  const cls = styles[level] || styles.low
  return (
    <span className={`inline-block border rounded-full px-3 py-0.5 text-xs font-semibold ${cls}`}>
      {labels[level] || 'Low Confidence'}
    </span>
  )
}

const TYPE_LABELS = {
  pull_request: 'PR', commit: 'Commit', adr: 'ADR',
  design_document: 'Doc', readme: 'README', incident: 'Incident',
}

function SourceCard({ source, index }) {
  const label = TYPE_LABELS[source.type] || source.type
  return (
    <div className="border border-gray-200 rounded-lg px-4 py-3 bg-gray-50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 text-xs font-semibold bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">{label}</span>
          <span className="text-sm font-medium text-gray-800 truncate">{source.title}</span>
        </div>
        <span className="shrink-0 text-xs text-gray-400">#{index + 1}</span>
      </div>
      {source.author && (
        <p className="mt-1 text-xs text-gray-500"><span className="font-medium text-gray-600">Author:</span> {source.author}</p>
      )}
      {source.reference && <p className="mt-1 text-xs font-medium text-gray-600">{source.reference}</p>}
      {source.excerpt && <p className="mt-1 text-xs text-gray-500 leading-relaxed">{source.excerpt}</p>}
      {source.url && (
        <a href={source.url} target="_blank" rel="noopener noreferrer"
          className="mt-1 inline-block text-xs text-blue-600 hover:underline truncate max-w-full">
          {source.url}
        </a>
      )}
    </div>
  )
}

// ── Answer panel ─────────────────────────────────────────────────────────────

function AnswerPanel({ result, onClear, onSave }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-gray-900">Investigation Result</h3>
        <ConfidenceBadge level={result.confidence} />
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
        <p className="text-xs text-blue-500 font-medium mb-0.5">Question</p>
        <p className="text-sm text-blue-900">{result.question}</p>
      </div>

      {result.rootCause && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Root Cause</p>
          <p className="text-sm text-gray-800 leading-relaxed">{result.rootCause}</p>
        </div>
      )}

      {result.why && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Why</p>
          <p className="text-sm text-gray-800 leading-relaxed">{result.why}</p>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Answer</p>
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{result.answerText}</p>
      </div>

      {Array.isArray(result.agents) && result.agents.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Specialized Agents</p>
          <div className="space-y-2">
            {result.agents.map((agent) => (
              <div key={agent.id} className="border border-gray-200 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-800">{agent.label}</p>
                  <span className="text-xs text-gray-500 capitalize">{agent.status.replace('_', ' ')}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{agent.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.sources && result.sources.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Evidence ({result.sources.length} source{result.sources.length !== 1 ? 's' : ''})
          </p>
          <div className="space-y-2">
            {result.sources.map((src, i) => <SourceCard key={i} source={src} index={i} />)}
          </div>
        </div>
      )}

      {/* Phase 7 — Save to memory */}
      <button
        onClick={onSave}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg transition text-sm"
      >
        Save to EchoProof Memory
      </button>

      <button
        onClick={onClear}
        className="w-full border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium py-2 rounded-lg transition text-sm"
      >
        Ask Another Question
      </button>
    </div>
  )
}

// ── Save Incident form ────────────────────────────────────────────────────────

function SaveIncidentForm({ initial, onSaved, onCancel }) {
  const [title, setTitle] = useState(initial.title || '')
  const [problem, setProblem] = useState(initial.problem || '')
  const [rootCause, setRootCause] = useState(initial.rootCause || '')
  const [resolution, setResolution] = useState(initial.resolution || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e) {
    e.preventDefault()
    if (!title.trim()) return setError('Title is required.')
    setSaving(true)
    setError('')
    try {
      const saved = await saveIncident(initial.contextId, {
        title: title.trim(),
        problem,
        rootCause,
        resolution,
        evidence: initial.evidence || [],
        affectedFiles: initial.affectedFiles || [],
        generatedTests: initial.generatedTests || [],
        confidence: initial.confidence || '',
      })
      onSaved(saved)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const field = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-bold text-gray-900">Save to EchoProof Memory</h3>
        <button type="button" onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600">✕ Cancel</button>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Title <span className="text-red-500">*</span></label>
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          className={field.replace('resize-none', '')}
          placeholder="Short description of this incident" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Problem</label>
        <textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={2} className={field}
          placeholder="What was the reported issue?" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Root Cause</label>
        <textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={2} className={field}
          placeholder="What caused it?" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Resolution</label>
        <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={2} className={field}
          placeholder="How was it resolved?" />
      </div>

      {/* Read-only evidence preview */}
      {initial.evidence && initial.evidence.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Evidence ({initial.evidence.length} sources)</p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 space-y-1 max-h-32 overflow-y-auto">
            {initial.evidence.map((src, i) => (
              <p key={i} className="text-xs text-gray-600 truncate">
                <span className="font-medium">{TYPE_LABELS[src.type] || src.type}</span> — {src.title}
              </p>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
      )}

      <button type="submit" disabled={saving || !title.trim()}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-2.5 rounded-lg transition text-sm">
        {saving ? 'Saving…' : 'Save to EchoProof Memory'}
      </button>
    </form>
  )
}

// ── Incident History view ────────────────────────────────────────────────────

function relativeTime(iso) {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function IncidentHistoryView({ contextId, repoName, onBack }) {
  const [incidents, setIncidents] = useState(null)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    fetchIncidents(contextId)
      .then(setIncidents)
      .catch((err) => setError(err.message))
  }, [contextId])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-2xl">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">EchoProof Memory</p>
            <p className="text-sm font-semibold text-gray-800">{repoName}</p>
          </div>
          <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600 transition">← Back</button>
        </div>

        <h2 className="text-base font-bold text-gray-900 mb-4">Incident History</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
        )}

        {incidents === null && !error && (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-6 justify-center">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            Loading incidents…
          </div>
        )}

        {incidents !== null && incidents.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <p className="text-sm">No incidents saved yet.</p>
            <p className="text-xs mt-1">Complete an investigation and click "Save to EchoProof Memory".</p>
          </div>
        )}

        {incidents !== null && incidents.length > 0 && (
          <div className="space-y-3">
            {incidents.map((inc) => (
              <div key={inc._id} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === inc._id ? null : inc._id)}
                  className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-gray-50 transition"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{inc.title}</p>
                    {inc.problem && <p className="text-xs text-gray-500 mt-0.5 truncate">{inc.problem}</p>}
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {inc.confidence && <ConfidenceBadge level={inc.confidence} />}
                    <span className="text-xs text-gray-400">{relativeTime(inc.createdAt)}</span>
                    <span className="text-gray-400 text-xs">{expanded === inc._id ? '▲' : '▼'}</span>
                  </div>
                </button>

                {expanded === inc._id && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
                    {inc.rootCause && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Root Cause</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{inc.rootCause}</p>
                      </div>
                    )}
                    {inc.resolution && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Resolution</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{inc.resolution}</p>
                      </div>
                    )}
                    {inc.affectedFiles && inc.affectedFiles.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Affected Files</p>
                        <ul className="space-y-0.5">
                          {inc.affectedFiles.map((f, i) => (
                            <li key={i} className="text-xs font-mono text-gray-600">{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {inc.evidence && inc.evidence.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Evidence</p>
                        <div className="space-y-1">
                          {inc.evidence.map((ev, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                              <span className="shrink-0 font-semibold bg-blue-100 text-blue-700 rounded px-1">{TYPE_LABELS[ev.type] || ev.type}</span>
                              {ev.url
                                ? <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">{ev.title}</a>
                                : <span className="truncate">{ev.title}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main App ─────────────────────────────────────────────────────────────────

const VIEW = {
  SETUP: 'setup',
  INGESTING: 'ingesting',
  READY: 'ready',
  ANSWERING: 'answering',
  ANSWER: 'answer',
  SAVE_INCIDENT: 'save_incident',
  INCIDENT_SAVED: 'incident_saved',
  INCIDENT_HISTORY: 'incident_history',
}

export default function App() {
  const [view, setView] = useState(VIEW.SETUP)
  const [repoUrl, setRepoUrl] = useState('')
  const [error, setError] = useState('')
  const [contextId, setContextId] = useState(null)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [statusLabel, setStatusLabel] = useState('')
  const [context, setContext] = useState(null)
  const [question, setQuestion] = useState('')
  const [queryError, setQueryError] = useState('')
  const [queryResult, setQueryResult] = useState(null)
  const [savedIncident, setSavedIncident] = useState(null)
  const pollRef = useRef(null)

  useEffect(() => () => clearInterval(pollRef.current), [])

  function startPolling(id) {
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const s = await fetchStatus(id)
        setProgress(s.progress)
        setCurrentStep(s.currentStep)
        setStatusLabel(s.currentStep)
        if (s.status === 'ready') {
          clearInterval(pollRef.current)
          const ctx = await fetchContext(id)
          setContext(ctx)
          setView(VIEW.READY)
        } else if (s.status === 'failed') {
          clearInterval(pollRef.current)
          setError(s.currentStep.replace('Failed: ', ''))
          setView(VIEW.SETUP)
        }
      } catch (err) {
        clearInterval(pollRef.current)
        setError(err.message)
        setView(VIEW.SETUP)
      }
    }, 2000)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const trimmed = repoUrl.trim()
    if (!trimmed) return setError('Please enter a GitHub repository URL.')
    if (!/^https:\/\/github\.com\/[^/]+\/[^/]+/.test(trimmed)) {
      return setError('URL must be in the format: https://github.com/owner/repo')
    }
    try {
      const { contextId: id } = await startIngestion(trimmed)
      setContextId(id)
      setProgress(0)
      setCurrentStep('Fetching repository metadata')
      setView(VIEW.INGESTING)
      startPolling(id)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleQuery(e) {
    e.preventDefault()
    setQueryError('')
    const q = question.trim()
    if (!q) return setQueryError('Please enter a question.')
    setView(VIEW.ANSWERING)
    try {
      const result = await submitQuery(contextId, q)
      setQueryResult(result)
      setView(VIEW.ANSWER)
    } catch (err) {
      setQueryError(err.message)
      setView(VIEW.READY)
    }
  }

  function handleReset() {
    clearInterval(pollRef.current)
    setView(VIEW.SETUP)
    setRepoUrl('')
    setError('')
    setContextId(null)
    setProgress(0)
    setCurrentStep('')
    setContext(null)
    setQuestion('')
    setQueryError('')
    setQueryResult(null)
    setSavedIncident(null)
  }

  // Build pre-filled incident payload from query result
  function buildIncidentInitial() {
    if (!queryResult) return {}
    return {
      contextId,
      title: queryResult.question || '',
      problem: queryResult.question || '',
      rootCause: queryResult.rootCause || '',
      resolution: '',
      evidence: (queryResult.sources || []).map((s) => ({
        type: s.type || '',
        title: s.title || '',
        url: s.url || '',
        reference: s.reference || '',
      })),
      affectedFiles: [],
      generatedTests: [],
      confidence: queryResult.confidence || '',
    }
  }

  // ════════════════════════════════════════════════════════
  // INCIDENT HISTORY VIEW
  // ════════════════════════════════════════════════════════
  if (view === VIEW.INCIDENT_HISTORY) {
    return (
      <IncidentHistoryView
        contextId={contextId}
        repoName={context?.name}
        onBack={() => setView(VIEW.READY)}
      />
    )
  }

  // ════════════════════════════════════════════════════════
  // SETUP VIEW
  // ════════════════════════════════════════════════════════
  if (view === VIEW.SETUP) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-md p-10 w-full max-w-lg">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900">EchoProof</h1>
            <p className="text-gray-500 mt-2 text-sm">Your codebase remembers what your team forgot.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">GitHub Repository URL</label>
            <input type="url" value={repoUrl}
              onChange={(e) => { setRepoUrl(e.target.value); setError('') }}
              placeholder="https://github.com/owner/repo"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
            <button type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition">
              Analyze Repository
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════
  // INGESTING VIEW
  // ════════════════════════════════════════════════════════
  if (view === VIEW.INGESTING) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-md p-10 w-full max-w-lg">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold text-gray-900">Analyzing Repository</h2>
            <p className="text-gray-400 text-sm mt-1 font-mono truncate">{repoUrl}</p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 mb-2 overflow-hidden">
            <div className="bg-blue-500 h-3 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mb-6">
            <span>{statusLabel || 'Starting…'}</span>
            <span>{progress}%</span>
          </div>
          <StepList currentStep={currentStep} status="indexing" />
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════
  // ANSWERING VIEW
  // ════════════════════════════════════════════════════════
  if (view === VIEW.ANSWERING) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-md p-10 w-full max-w-lg text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-900">Investigating…</h2>
          <p className="text-gray-400 text-sm mt-1">Searching repository history and synthesizing an answer.</p>
          <p className="mt-4 text-sm text-gray-500 font-mono italic truncate px-4">"{question}"</p>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════
  // SAVE INCIDENT VIEW
  // ════════════════════════════════════════════════════════
  if (view === VIEW.SAVE_INCIDENT) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
        <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-2xl">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Repository</p>
              <p className="text-sm font-semibold text-gray-800">{context?.name}</p>
            </div>
            <button onClick={() => setView(VIEW.ANSWER)} className="text-xs text-gray-400 hover:text-gray-600">← Back</button>
          </div>
          <SaveIncidentForm
            initial={buildIncidentInitial()}
            onSaved={(inc) => { setSavedIncident(inc); setView(VIEW.INCIDENT_SAVED) }}
            onCancel={() => setView(VIEW.ANSWER)}
          />
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════
  // INCIDENT SAVED CONFIRMATION VIEW
  // ════════════════════════════════════════════════════════
  if (view === VIEW.INCIDENT_SAVED) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-md p-10 w-full max-w-lg text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-green-600 text-2xl">✓</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Saved to EchoProof Memory</h2>
          <p className="text-gray-500 text-sm mt-2">{savedIncident?.title}</p>
          <p className="text-gray-400 text-xs mt-1">
            This incident will surface automatically in future investigations.
          </p>
          <div className="mt-6 space-y-3">
            <button onClick={() => setView(VIEW.INCIDENT_HISTORY)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition text-sm">
              View Incident History
            </button>
            <button onClick={() => { setView(VIEW.READY); setQuestion('') }}
              className="w-full border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium py-2.5 rounded-lg transition text-sm">
              Ask Another Question
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════
  // ANSWER VIEW
  // ════════════════════════════════════════════════════════
  if (view === VIEW.ANSWER) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
        <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-2xl">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Repository</p>
              <p className="text-sm font-semibold text-gray-800">{context?.name}</p>
            </div>
            <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600 transition">← New repo</button>
          </div>
          <AnswerPanel
            result={queryResult}
            onClear={() => { setView(VIEW.READY); setQuestion('') }}
            onSave={() => setView(VIEW.SAVE_INCIDENT)}
          />
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════
  // READY VIEW — dashboard + query input
  // ════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-green-600 text-2xl">✓</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Repository Ready</h2>
          <p className="text-gray-500 text-sm mt-1">{context?.name}</p>
          {context?.description && <p className="text-gray-400 text-xs mt-1">{context.description}</p>}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Documents', value: context?.ingestionProgress?.totalDocuments ?? 0 },
            { label: 'Status', value: 'Ready' },
            { label: 'Context ID', value: contextId?.slice(-6) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-gray-800">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <form onSubmit={handleQuery} className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Ask a question about this repository</label>
          <textarea value={question}
            onChange={(e) => { setQuestion(e.target.value); setQueryError('') }}
            placeholder="Why was authentication changed? When was rate limiting introduced?"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          {queryError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{queryError}</div>}
          <button type="submit" disabled={!question.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 rounded-lg transition">
            Investigate
          </button>
        </form>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button onClick={() => setView(VIEW.INCIDENT_HISTORY)}
            className="border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium py-2.5 rounded-lg transition text-sm">
            Incident History
          </button>
          <button onClick={handleReset}
            className="border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium py-2.5 rounded-lg transition text-sm">
            New Repository
          </button>
        </div>
      </div>
    </div>
  )
}
