import { useState, useEffect } from 'react'

async function pingBackend() {
  let res
  try {
    res = await fetch('/api/ping', { cache: 'no-store' })
  } catch {
    throw new Error('Network error')
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  let data
  try {
    data = await res.json()
  } catch {
    throw new Error('Invalid JSON — backend may be down')
  }

  if (!data || data.message !== 'pong') {
    throw new Error('Unexpected response from server')
  }

  return data
}

function App() {
  const [status, setStatus] = useState('Checking connection...')
  const [message, setMessage] = useState('')
  const [timestamp, setTimestamp] = useState('')
  const [connected, setConnected] = useState(null)

  const runPing = () => {
    setStatus('Checking connection...')
    setMessage('')
    setTimestamp('')
    setConnected(null)

    pingBackend()
      .then((data) => {
        setStatus(data.status)
        setMessage(data.message)
        setTimestamp(data.timestamp)
        setConnected(true)
      })
      .catch((err) => {
        setStatus(`Connection failed — ${err.message}`)
        setConnected(false)
      })
  }

  useEffect(() => {
    runPing()
  }, [])

  const isLoading = connected === null
  const isError = connected === false

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-md p-10 max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-blue-600 mb-6">
          Backend Connection Test
        </h1>

        <div
          className={`rounded-lg px-6 py-4 mb-4 ${
            isLoading
              ? 'bg-yellow-50'
              : isError
              ? 'bg-red-100'
              : 'bg-green-100'
          }`}
        >
          <p
            className={`text-lg font-semibold ${
              isLoading
                ? 'text-yellow-700'
                : isError
                ? 'text-red-700'
                : 'text-green-700'
            }`}
          >
            {status}
          </p>
        </div>

        {connected && message && (
          <div className="text-gray-600 text-sm space-y-1">
            <p>
              <span className="font-medium">Response:</span>{' '}
              <span className="font-mono text-blue-500">{message}</span>
            </p>
            <p>
              <span className="font-medium">Timestamp:</span>{' '}
              <span className="font-mono text-gray-400">{timestamp}</span>
            </p>
          </div>
        )}

        <button
          onClick={runPing}
          className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Ping Again
        </button>
      </div>
    </div>
  )
}

export default App
