import { useState, useEffect } from 'react'
import { usePostSSE } from '../hooks/useSSE'
import { MessageStream } from '../components/MessageStream'
import { HowItWorks } from '../components/HowItWorks'

export function StartupLab() {
  const [prompt, setPrompt] = useState('What files exist in the sandbox directory?')
  const [warmed, setWarmed] = useState(false)
  const [warmElapsed, setWarmElapsed] = useState<number | null>(null)
  const [warming, setWarming] = useState(false)
  const [coldElapsed, setColdElapsed] = useState<number | null>(null)
  const [warmQueryElapsed, setWarmQueryElapsed] = useState<number | null>(null)
  const [coldStartMs, setColdStartMs] = useState<number | null>(null)
  const [warmStartMs, setWarmStartMs] = useState<number | null>(null)

  const coldSSE = usePostSSE({
    onMessage: (evt) => {
      if (evt === 'result' && coldStartMs !== null) {
        setColdElapsed(Date.now() - coldStartMs)
      }
    },
  })

  const warmSSE = usePostSSE({
    onMessage: (evt, data) => {
      if (evt === 'result' && warmStartMs !== null) {
        setWarmQueryElapsed(Date.now() - warmStartMs)
      }
      if (evt === 'timing') {
        setWarmQueryElapsed((data as { elapsed_ms?: number })?.elapsed_ms ?? null)
      }
    },
  })

  useEffect(() => {
    fetch('/api/startup/status')
      .then((r) => r.json())
      .then((d) => {
        setWarmed(d.warmed)
        if (d.warm_elapsed_ms) setWarmElapsed(d.warm_elapsed_ms)
      })
      .catch(() => {})
  }, [])

  const handleWarm = async () => {
    setWarming(true)
    try {
      const res = await fetch('/api/startup/warm', { method: 'POST' })
      const d = await res.json() as { warmed: boolean; elapsed_ms: number }
      setWarmed(d.warmed)
      setWarmElapsed(d.elapsed_ms)
    } finally {
      setWarming(false)
    }
  }

  const handleColdRun = () => {
    if (!prompt.trim()) return
    setColdStartMs(Date.now())
    setColdElapsed(null)
    coldSSE.run('/api/startup/query', { prompt: prompt.trim(), mode: 'cold' })
  }

  const handleWarmRun = () => {
    if (!prompt.trim()) return
    setWarmStartMs(Date.now())
    setWarmQueryElapsed(null)
    warmSSE.run('/api/startup/query', { prompt: prompt.trim(), mode: 'warm' })
    setWarmed(false)
  }

  const saving = coldElapsed !== null && warmQueryElapsed !== null
    ? coldElapsed - warmQueryElapsed
    : null

  return (
    <div className="flex flex-col h-full p-6 max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">🚀 Startup Lab</h1>
        <p className="text-gray-400 text-sm">
          Demonstrates <code className="text-blue-400 bg-gray-800 px-1 rounded">startup()</code> — pre-warm the subprocess to eliminate cold start latency
        </p>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 mb-6">
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-400 mb-2">Prompt (used for both queries)</label>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleWarm}
              disabled={warming || warmed}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {warming ? (
                <span className="flex items-center gap-2"><span className="animate-spin">⟳</span> Warming...</span>
              ) : warmed ? '✓ Warmed' : '🔥 Warm Subprocess'}
            </button>
            {warmElapsed !== null && (
              <span className="text-sm text-orange-400">Warm-up: {warmElapsed}ms</span>
            )}
          </div>
        </div>
      </div>

      {saving !== null && (
        <div className="bg-green-950 border border-green-700 rounded-lg p-4 mb-6 text-center">
          <div className="text-green-300 font-medium">
            Cold: {coldElapsed}ms | Warm: {warmQueryElapsed}ms | Saved: {saving}ms ({Math.round(saving / (coldElapsed ?? 1) * 100)}%)
          </div>
          <div className="text-green-500 text-xs mt-1">startup() moved subprocess spawn cost to app boot time</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        <div className="flex flex-col bg-gray-800 rounded-xl border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-200">Cold Query</h2>
            <div className="flex items-center gap-2">
              {coldElapsed !== null && (
                <span className="text-xs text-blue-300">{coldElapsed}ms</span>
              )}
              {coldSSE.status === 'streaming' && coldStartMs !== null && (
                <span className="text-xs text-blue-400 animate-pulse">
                  {Date.now() - coldStartMs}ms...
                </span>
              )}
              <button
                onClick={handleColdRun}
                disabled={coldSSE.status === 'streaming' || !prompt.trim()}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs rounded transition-colors"
              >
                {coldSSE.status === 'streaming' ? '⟳ Running...' : 'Run Cold'}
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-500 mb-3">No pre-warming. Spawns subprocess on demand.</div>
          <div className="flex-1 overflow-y-auto">
            <MessageStream messages={coldSSE.messages} />
          </div>
        </div>

        <div className="flex flex-col bg-gray-800 rounded-xl border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-200">Pre-warmed Query</h2>
            <div className="flex items-center gap-2">
              {warmQueryElapsed !== null && (
                <span className="text-xs text-orange-300">{warmQueryElapsed}ms</span>
              )}
              <button
                onClick={handleWarmRun}
                disabled={warmSSE.status === 'streaming' || !warmed || !prompt.trim()}
                className="px-3 py-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs rounded transition-colors"
              >
                {warmSSE.status === 'streaming' ? '⟳ Running...' : !warmed ? 'Warm first ↑' : 'Run Warm'}
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-500 mb-3">
            Subprocess already spawned. Prompt goes straight to a ready process.
          </div>
          <div className="flex-1 overflow-y-auto">
            <MessageStream messages={warmSSE.messages} />
          </div>
        </div>
      </div>

      <HowItWorks
        feature="startup() — Pre-warming"
        sdkApi="const warm = await startup({ options }); const q = warm.query(prompt);"
        description="startup() pre-spawns the Claude Code subprocess during app initialization, performing the handshake and loading configurations. When query() is called on the returned WarmQuery handle, the prompt goes directly to an already-running process — eliminating the 2-4 second cold start."
        whyUseIt="In production, call startup() in your app's startup routine so the first user request is fast. The WarmQuery handle is single-use — after one query(), create a new warm handle for the next user."
        docsUrl="https://docs.anthropic.com/en/api/agent-sdk/typescript"
      />
    </div>
  )
}
