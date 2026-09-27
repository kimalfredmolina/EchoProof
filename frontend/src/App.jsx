import { useEffect, useRef, useState } from 'react'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardContent } from './components/ui/card'
import { Input } from './components/ui/input'
import { Separator } from './components/ui/separator'
import { Textarea } from './components/ui/textarea'

async function requestJson(url, options) {
  const response = await fetch(url, options)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
  return data
}

function startIngestion(repoUrl) {
  return requestJson('/api/context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl }),
  })
}

function fetchStatus(contextId) {
  return requestJson(`/api/context/${contextId}/status`)
}

function fetchContext(contextId) {
  return requestJson(`/api/context/${contextId}`)
}

function submitQuery(contextId, question) {
  return requestJson(`/api/context/${contextId}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
}

function submitDebugReport(contextId, bugReport) {
  return requestJson(`/api/context/${contextId}/debug`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bugReport }),
  })
}

const STEPS = ['Fetching repository metadata', 'Fetching pull requests', 'Fetching commits', 'Fetching documentation', 'Complete']
const TYPE_LABELS = { pull_request: 'PR', commit: 'Commit', adr: 'ADR', design_document: 'Doc', readme: 'README', incident: 'Incident', source_code: 'Code' }

function BrandMark() {
  return null
}

function StepList({ currentStep, status }) {
  const stepIndex = STEPS.indexOf(currentStep)
  return (
    <ol className="mt-6 space-y-3">
      {STEPS.map((step, index) => {
        const done = status === 'ready' || index < stepIndex || currentStep === 'Complete'
        const active = step === currentStep && status === 'indexing'
        return (
          <li key={step} className="flex items-center gap-3 text-sm">
            <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ${done ? 'bg-mint text-mint-ink' : active ? 'animate-pulse bg-blue text-white' : 'bg-surface text-muted'}`}>
              {done ? '✓' : index + 1}
            </span>
            <span className={done ? 'text-ink' : active ? 'font-semibold text-blue-deep' : 'text-muted'}>{step}</span>
          </li>
        )
      })}
    </ol>
  )
}

function ConfidenceBadge({ level }) {
  const variant = { high: 'success', medium: 'warning', low: 'danger' }[level] || 'danger'
  return <Badge variant={variant}>{level || 'low'} confidence</Badge>
}

function SourceCard({ source, index }) {
  return (
    <div className="rounded-xl border border-line bg-surface/60 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="blue" className="shrink-0">{TYPE_LABELS[source.type] || source.type}</Badge>
          <span className="truncate text-sm font-semibold text-ink">{source.title}</span>
        </div>
        <span className="shrink-0 text-xs text-muted">#{index + 1}</span>
      </div>
      {source.reference && <p className="mt-2 font-mono text-xs text-muted">{source.reference}</p>}
      {source.excerpt && <p className="mt-1 text-xs leading-relaxed text-muted">{source.excerpt}</p>}
      {source.url && <a href={source.url} target="_blank" rel="noreferrer" className="mt-2 inline-block max-w-full truncate text-xs text-blue-deep hover:underline">Open source ↗</a>}
    </div>
  )
}

function AnswerPanel({ result, onClear }) {
  const evidence = Array.isArray(result.evidence) ? result.evidence : []
  const [expandedAgentId, setExpandedAgentId] = useState(null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div><Badge variant="blue">Investigation result</Badge><h2 className="mt-3 font-display text-2xl font-bold tracking-[-0.04em] text-ink">What the repository says</h2></div>
        <ConfidenceBadge level={result.confidence} />
      </div>
      <div className="rounded-xl border border-blue-line bg-blue-wash px-4 py-3"><p className="text-xs font-bold uppercase tracking-[0.1em] text-blue-deep">Question</p><p className="mt-1 text-sm text-ink">{result.question}</p></div>
      <section><p className="label">Root cause</p><p className="copy">{result.answer?.rootCause || result.rootCause || 'No root cause was generated.'}</p></section>
      <section><p className="label">Why</p><p className="copy">{result.answer?.why || result.why || 'The evidence did not provide an additional explanation.'}</p></section>
      <section><p className="label">Answer</p><p className="copy whitespace-pre-line">{result.answer?.summary || result.answerText || 'No answer was generated.'}</p></section>
      <Separator />
      {Array.isArray(result.agents) && result.agents.length > 0 && <section><p className="label mb-3">Specialized agents</p><div className="grid gap-2 sm:grid-cols-2">{result.agents.map((agent) => { const isExpanded = expandedAgentId === agent.id; return <div key={agent.id} className="border border-line bg-white"><button type="button" aria-expanded={isExpanded} onClick={() => setExpandedAgentId(isExpanded ? null : agent.id)} className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-surface"><span className="text-xs font-bold text-ink">{agent.label}</span><span className="flex items-center gap-2"><span className="text-[10px] uppercase text-muted">{agent.status}</span><span className="font-mono text-sm text-accent" aria-hidden="true">{isExpanded ? '−' : '+'}</span></span></button>{isExpanded && <div className="border-t border-line px-3 py-3 text-xs leading-5 text-muted">{agent.summary}{agent.warnings?.length > 0 && <p className="mt-2 text-accent">{agent.warnings.join(' ')}</p>}</div>}</div> })}</div></section>}
      {evidence.length > 0 && <section><p className="label mb-3">Evidence · {evidence.length} sources</p><div className="space-y-2">{evidence.map((source, index) => <SourceCard key={source.id || index} source={source} index={index} />)}</div></section>}
      <Button variant="outline" onClick={onClear} className="w-full">Ask another question</Button>
    </div>
  )
}

function DebugReportPanel({ report, onClear }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3"><div><Badge variant="danger">Debugging report</Badge><h2 className="mt-3 font-display text-2xl font-bold tracking-[-0.04em] text-ink">Root-cause investigation</h2></div><ConfidenceBadge level={report.confidence} /></div>
      <div className="rounded-xl border border-coral-line bg-coral-wash px-4 py-3"><p className="text-xs font-bold uppercase tracking-[0.1em] text-coral-deep">Bug report</p><p className="mt-1 whitespace-pre-line text-sm text-ink">{report.problem}</p></div>
      <section><p className="label">Root cause</p><p className="copy">{report.rootCause}</p><p className="mt-2 text-sm leading-6 text-muted">{report.why}</p></section>
      <section><p className="label mb-2">Affected files</p>{report.affectedFiles?.length ? <ul className="space-y-1 font-mono text-xs text-ink">{report.affectedFiles.map((file) => <li key={file}>{file}</li>)}</ul> : <p className="text-sm text-muted">No affected file was identified with enough confidence.</p>}</section>
      <Separator />
      <section><p className="label">Recommended fix</p><p className="mt-2 text-sm font-bold text-ink">{report.recommendedFix.summary}</p><p className="mt-1 text-sm leading-6 text-muted">{report.recommendedFix.rationale}</p><div className="mt-3 rounded-xl border border-amber-line bg-amber px-4 py-3 text-xs font-semibold text-amber-ink">Proposal only. No repository changes were applied.</div></section>
      <section><p className="label mb-2">Recommended tests</p><ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-ink">{report.recommendedTests.map((test) => <li key={test}>{test}</li>)}</ul></section>
      {report.historicalIncidents?.length > 0 && <section><p className="label mb-2">Similar historical incidents</p><div className="space-y-2">{report.historicalIncidents.map((incident) => <div key={incident.id} className="rounded-xl border border-line bg-surface/60 px-3 py-3"><p className="text-sm font-bold text-ink">{incident.title}</p><p className="mt-1 text-xs leading-5 text-muted">{incident.excerpt}</p></div>)}</div></section>}
      {report.warnings?.length > 0 && <div className="rounded-xl border border-amber-line bg-amber px-4 py-3 text-sm text-amber-ink">{report.warnings.join(' ')}</div>}
      <Button variant="outline" onClick={onClear} className="w-full">Back to repository</Button>
    </div>
  )
}

const VIEW = { SETUP: 'setup', INGESTING: 'ingesting', READY: 'ready', ANSWERING: 'answering', ANSWER: 'answer', DEBUGGING: 'debugging', DEBUG_REPORT: 'debug-report' }

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
  const [bugReport, setBugReport] = useState('')
  const [debugError, setDebugError] = useState('')
  const [debugResult, setDebugResult] = useState(null)
  const pollRef = useRef(null)

  useEffect(() => () => clearInterval(pollRef.current), [])

  function startPolling(id) {
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const status = await fetchStatus(id)
        setProgress(status.progress)
        setCurrentStep(status.currentStep)
        setStatusLabel(status.currentStep)
        if (status.status === 'ready') {
          clearInterval(pollRef.current)
          setContext(await fetchContext(id))
          setView(VIEW.READY)
        } else if (status.status === 'failed') {
          clearInterval(pollRef.current)
          setError(status.currentStep.replace('Failed: ', ''))
          setView(VIEW.SETUP)
        }
      } catch (pollError) {
        clearInterval(pollRef.current)
        setError(pollError.message)
        setView(VIEW.SETUP)
      }
    }, 2000)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const trimmed = repoUrl.trim()
    if (!trimmed) return setError('Please enter a GitHub repository URL.')
    if (!/^https:\/\/github\.com\/[^/]+\/[^/]+/.test(trimmed)) return setError('URL must be in the format: https://github.com/owner/repo')
    try {
      const { contextId: id } = await startIngestion(trimmed)
      setContextId(id)
      setProgress(0)
      setCurrentStep(STEPS[0])
      setView(VIEW.INGESTING)
      startPolling(id)
    } catch (submitError) { setError(submitError.message) }
  }

  async function handleQuery(event) {
    event.preventDefault()
    setQueryError('')
    if (!question.trim()) return setQueryError('Please enter a question.')
    setView(VIEW.ANSWERING)
    try { setQueryResult(await submitQuery(contextId, question.trim())); setView(VIEW.ANSWER) } catch (querySubmitError) { setQueryError(querySubmitError.message); setView(VIEW.READY) }
  }

  async function handleDebug(event) {
    event.preventDefault()
    setDebugError('')
    if (!bugReport.trim()) return setDebugError('Please describe the bug.')
    setView(VIEW.DEBUGGING)
    try { setDebugResult(await submitDebugReport(contextId, bugReport.trim())); setView(VIEW.DEBUG_REPORT) } catch (debugSubmitError) { setDebugError(debugSubmitError.message); setView(VIEW.READY) }
  }

  function reset() {
    clearInterval(pollRef.current)
    setView(VIEW.SETUP); setRepoUrl(''); setError(''); setContextId(null); setProgress(0); setCurrentStep(''); setContext(null); setQuestion(''); setQueryError(''); setQueryResult(null); setBugReport(''); setDebugError(''); setDebugResult(null)
  }

  if (view === VIEW.SETUP) return <div className="app-shell flex min-h-screen flex-col"><main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-5 pb-12 pt-10 lg:px-8"><div className="grid w-full items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20"><div className="animate-rise-in max-w-xl"><h1 className="font-display text-5xl font-bold leading-[0.98] tracking-[-0.065em] text-ink sm:text-6xl">Make every engineering decision <span className="text-blue">findable.</span></h1><p className="mt-6 max-w-lg text-base leading-7 text-muted sm:text-lg">Connect a GitHub repository and turn its code, history, and discussions into a memory your team can investigate.</p><div className="feature-index mt-10"><div className="feature-index-row"><span>01</span><strong>Code context</strong><em>Current implementation</em></div><div className="feature-index-row"><span>02</span><strong>Git history</strong><em>Why it changed</em></div><div className="feature-index-row"><span>03</span><strong>Debug reports</strong><em>What to fix next</em></div></div></div><Card className="animate-rise-in-delay w-full max-w-xl justify-self-end"><CardContent className="p-6 sm:p-8"><div className="mb-7 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Start a context</p><h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-ink">Analyze a repository</h2></div><div className="rounded-xl bg-blue-wash p-3 text-blue-deep">↗</div></div><form onSubmit={handleSubmit} className="space-y-4"><label className="block text-sm font-bold text-ink">GitHub repository URL</label><Input type="url" value={repoUrl} onChange={(event) => { setRepoUrl(event.target.value); setError('') }} placeholder="https://github.com/owner/repo" />{error && <div className="rounded-xl border border-coral-line bg-coral-wash px-4 py-3 text-sm text-coral-deep">{error}</div>}<Button type="submit" variant="accent" className="w-full">Analyze repository <span aria-hidden="true">→</span></Button></form><p className="mt-5 text-xs leading-5 text-muted">Private repositories use the server's configured access policy.</p></CardContent></Card></div></main><footer className="mx-auto w-full max-w-6xl px-5 pb-6 text-xs text-muted lg:px-8">Built for teams who want the why behind the code.</footer></div>

  if (view === VIEW.INGESTING) return <div className="app-shell flex min-h-screen flex-col"><header className="mx-auto flex w-full max-w-6xl items-center px-5 py-6 lg:px-8"><BrandMark compact /></header><main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-5 pb-12 lg:px-8"><Card className="w-full max-w-2xl"><CardContent className="p-6 sm:p-10"><div className="mb-8 flex items-start justify-between gap-5"><div><Badge variant="blue">Indexing context</Badge><h2 className="mt-3 font-display text-2xl font-bold tracking-[-0.04em] text-ink">Reading the repository</h2><p className="mt-2 max-w-md truncate font-mono text-xs text-muted">{repoUrl}</p></div><div className="h-3 w-3 animate-pulse rounded-full bg-blue shadow-[0_0_0_7px_rgba(44,104,255,0.12)]" /></div><div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-[0.1em] text-muted"><span>{statusLabel || 'Starting...'}</span><span className="font-mono text-ink">{progress}%</span></div><div className="h-3 w-full overflow-hidden rounded-full bg-surface"><div className="h-3 rounded-full bg-blue transition-all duration-700" style={{ width: `${progress}%` }} /></div><StepList currentStep={currentStep} status="indexing" /></CardContent></Card></main></div>

  if (view === VIEW.ANSWERING || view === VIEW.DEBUGGING) return <div className="app-shell flex min-h-screen items-center justify-center px-5"><Card className="w-full max-w-lg"><CardContent className="p-8 text-center sm:p-10"><div className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl ${view === VIEW.DEBUGGING ? 'bg-coral-wash text-coral' : 'bg-blue-wash text-blue'}`}>{view === VIEW.DEBUGGING ? '⌁' : '✦'}</div><Badge variant={view === VIEW.DEBUGGING ? 'danger' : 'blue'}>{view === VIEW.DEBUGGING ? 'Debugging report' : 'Investigation running'}</Badge><h2 className="mt-4 font-display text-2xl font-bold tracking-[-0.04em] text-ink">{view === VIEW.DEBUGGING ? 'Tracing the failure' : 'Following the evidence'}</h2><p className="mt-2 text-sm leading-6 text-muted">{view === VIEW.DEBUGGING ? 'Inspecting source, history, and similar incidents.' : 'Searching repository history and synthesizing an answer.'}</p></CardContent></Card></div>

  if (view === VIEW.ANSWER || view === VIEW.DEBUG_REPORT) return <div className="app-shell min-h-screen px-5 py-6 sm:py-10"><div className="mx-auto w-full max-w-4xl"><div className="mb-6 flex items-center justify-between gap-4"><BrandMark compact /><Button variant="ghost" onClick={reset} className="min-h-9 px-3 text-xs">← New repository</Button></div><Card><CardContent className="p-6 sm:p-8">{view === VIEW.ANSWER ? <AnswerPanel result={queryResult} onClear={() => { setView(VIEW.READY); setQuestion('') }} /> : <DebugReportPanel report={debugResult} onClear={() => { setView(VIEW.READY); setBugReport('') }} />}</CardContent></Card></div></div>

  return <div className="app-shell min-h-screen px-5 py-6 sm:py-10"><div className="mx-auto w-full max-w-6xl"><header className="mb-8 flex items-center justify-between gap-4"><BrandMark compact /><Button variant="ghost" onClick={reset} className="min-h-9 px-3 text-xs">← New repository</Button></header><div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><Badge variant="success">Context ready</Badge><h1 className="mt-3 font-display text-3xl font-bold tracking-[-0.055em] text-ink sm:text-4xl">What do you want to understand?</h1><p className="mt-2 text-sm text-muted">Search the decisions behind <span className="font-semibold text-ink">{context?.name}</span>.</p></div><p className="font-mono text-xs text-muted">ID / {contextId?.slice(-8)}</p></div><div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"><Card><CardContent className="p-6 sm:p-8"><div className="mb-7 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Repository context</p><h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-ink">Ask the memory</h2></div><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint text-xl text-mint-ink">✓</div></div><div className="mb-7 grid grid-cols-3 gap-2">{[{ label: 'Documents', value: context?.ingestionProgress?.totalDocuments ?? 0 }, { label: 'Status', value: 'Ready' }, { label: 'Context', value: contextId?.slice(-6) }].map(({ label, value }) => <div key={label} className="rounded-xl border border-line bg-surface/60 p-3"><p className="truncate text-sm font-bold text-ink">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p></div>)}</div><form onSubmit={handleQuery} className="space-y-3"><label className="block text-sm font-bold text-ink">Ask a question</label><Textarea value={question} onChange={(event) => { setQuestion(event.target.value); setQueryError('') }} placeholder="Why was authentication changed? When was rate limiting introduced?" rows={4} />{queryError && <div className="rounded-xl border border-coral-line bg-coral-wash px-4 py-3 text-sm text-coral-deep">{queryError}</div>}<Button type="submit" variant="accent" disabled={!question.trim()} className="w-full">Investigate <span aria-hidden="true">→</span></Button></form></CardContent></Card><Card className="border-coral-line bg-coral-wash/50"><CardContent className="p-6 sm:p-8"><div className="mb-7 flex items-start justify-between gap-4"><div><Badge variant="danger">Debug mode</Badge><h2 className="mt-3 font-display text-2xl font-bold tracking-[-0.04em] text-ink">Something broke?</h2><p className="mt-2 text-sm leading-6 text-muted">Generate a grounded report from code, history, and prior incidents.</p></div><div className="rounded-xl bg-white/80 p-3 text-xl text-coral">⌁</div></div><form onSubmit={handleDebug} className="space-y-3"><label className="block text-sm font-bold text-ink">Describe the bug</label><Textarea value={bugReport} onChange={(event) => { setBugReport(event.target.value); setDebugError('') }} placeholder="Expected behavior, actual behavior, reproduction steps..." rows={7} maxLength={5000} className="border-coral-line bg-white/80 focus:border-coral focus:ring-coral/10" />{debugError && <div className="rounded-xl border border-coral-line bg-white/80 px-4 py-3 text-sm text-coral-deep">{debugError}</div>}<Button type="submit" variant="coral" disabled={!bugReport.trim()} className="w-full">Generate debugging report <span aria-hidden="true">↗</span></Button></form></CardContent></Card></div><footer className="mt-8 flex flex-wrap items-center justify-between gap-3 text-xs text-muted"><span>{context?.description || 'A living index of your repository memory.'}</span><span className="font-mono">EchoProof / workspace</span></footer></div></div>
}