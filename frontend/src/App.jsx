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
  return data // { contextId, status }
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

// ── Step label → icon ────────────────────────────────────────────────────────

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
        const isDone =
          status === 'ready' || i < stepIndex || currentStep === 'Complete'
        const isActive = step === currentStep && status === 'indexing'
        return (
          <li key={step} className="flex items-center gap-3 text-sm">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
                ${isDone ? 'bg-green-500 text-white' : isActive ? 'bg-blue-500 text-white animate-pulse' : 'bg-gray-200 text-gray-400'}`}
            >
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

// ── Main App ─────────────────────────────────────────────────────────────────

const VIEW = { SETUP: 'setup', INGESTING: 'ingesting', READY: 'ready' }

export default function App() {
  const [view, setView] = useState(VIEW.SETUP)
  const [repoUrl, setRepoUrl] = useState('')
  const [error, setError] = useState('')
  const [contextId, setContextId] = useState(null)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [statusLabel, setStatusLabel] = useState('')
  const [context, setContext] = useState(null)
  const pollRef = useRef(null)

  // ── Stop polling on unmount ──
  useEffect(() => () => clearInterval(pollRef.current), [])

  // ── Poll status while ingesting ──
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

  // ── Submit handler ──
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

  // ── Reset ──
  function handleReset() {
    clearInterval(pollRef.current)
    setView(VIEW.SETUP)
    setRepoUrl('')
    setError('')
    setContextId(null)
    setProgress(0)
    setCurrentStep('')
    setContext(null)
  }

  // ════════════════════════════════════════════════════════
  // SETUP VIEW
  // ════════════════════════════════════════════════════════
  if (view === VIEW.SETUP) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-md p-10 w-full max-w-lg">

          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900">EchoProof</h1>
            <p className="text-gray-500 mt-2 text-sm">
              Your codebase remembers what your team forgot.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              GitHub Repository URL
            </label>
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => { setRepoUrl(e.target.value); setError('') }}
              placeholder="https://github.com/owner/repo"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition"
            >
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

          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-3 mb-2 overflow-hidden">
            <div
              className="bg-blue-500 h-3 rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mb-6">
            <span>{statusLabel || 'Starting…'}</span>
            <span>{progress}%</span>
          </div>

          {/* Step list */}
          <StepList currentStep={currentStep} status="indexing" />
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════
  // READY VIEW
  // ════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-md p-10 w-full max-w-lg">

        {/* Success header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-green-600 text-2xl">✓</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Repository Ready</h2>
          <p className="text-gray-500 text-sm mt-1">{context?.name}</p>
          {context?.description && (
            <p className="text-gray-400 text-xs mt-1">{context.description}</p>
          )}
        </div>

        {/* Stats */}
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

        {/* Completed steps */}
        <StepList currentStep="Complete" status="ready" />

        <button
          onClick={handleReset}
          className="mt-6 w-full border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium py-2.5 rounded-lg transition text-sm"
        >
          Analyze Another Repository
        </button>
      </div>
    </div>
  )
}
