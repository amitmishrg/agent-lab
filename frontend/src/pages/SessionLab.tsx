import { useState } from 'react'
import { usePostSSE } from '../hooks/useSSE'
import { MessageStream } from '../components/MessageStream'
import { SessionBrowser } from '../components/SessionBrowser'
import { CostMeter } from '../components/CostMeter'
import { HowItWorks } from '../components/HowItWorks'

interface SessionMessage {
  role?: string
  content?: unknown
  type?: string
}

export function SessionLab() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('Continue where we left off and add a fibonacci function to demo.ts')
  const [messages, setMessages] = useState<SessionMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [forkId, setForkId] = useState<string | null>(null)

  const resumeSSE = usePostSSE({
    onMessage: (evt) => {
      if (evt === 'fork_init') setForkId(null)
    },
  })
  const forkSSE = usePostSSE({
    onMessage: (evt, data) => {
      if (evt === 'fork_init') {
        setForkId((data as { newSessionId?: string })?.newSessionId ?? null)
      }
    },
  })

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setMessages([])
    setForkId(null)
    setLoadingMessages(true)
    fetch(`/api/sessions/${id}/messages`)
      .then((r) => r.json())
      .then((d) => { setMessages(d.messages ?? []) })
      .finally(() => setLoadingMessages(false))
  }

  const handleResume = () => {
    if (!selectedId || !prompt.trim()) return
    resumeSSE.run(`/api/sessions/${selectedId}/resume`, { prompt: prompt.trim() })
  }

  const handleFork = () => {
    if (!selectedId || !prompt.trim()) return
    forkSSE.run(`/api/sessions/${selectedId}/fork`, { prompt: prompt.trim() })
  }

  const handleWrongCwd = () => {
    if (!selectedId) return
    resumeSSE.run(`/api/sessions/${selectedId}/resume`, {
      prompt: 'What is in the current directory?',
      wrongCwd: true,
    })
  }

  const activeMessages = [...resumeSSE.messages, ...forkSSE.messages]
  const activeStatus = resumeSSE.status === 'streaming' ? 'streaming' : forkSSE.status

  return (
    <div className="flex h-full p-6 gap-4 max-w-6xl mx-auto w-full">
      <div className="w-72 flex flex-col gap-2">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex-1 overflow-y-auto">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Sessions</h2>
          <SessionBrowser selected={selectedId} onSelect={handleSelect} />
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
            Select a session to continue or fork it
          </div>
        ) : (
          <>
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-300">Session: <code className="text-blue-300 font-mono text-xs">{selectedId.slice(0, 12)}...</code></h2>
                  {forkId && (
                    <div className="mt-1 text-xs text-purple-300">
                      Fork created: <code className="font-mono">{forkId.slice(0, 12)}...</code>
                      <div className="text-gray-500 mt-1 text-xs">
                        {selectedId.slice(0, 8)}... → {forkId.slice(0, 8)}...
                      </div>
                    </div>
                  )}
                </div>
                <CostMeter messages={activeMessages} status={activeStatus} />
              </div>

              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-400 mb-1">Follow-up prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={2}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleResume}
                  disabled={resumeSSE.status === 'streaming' || !prompt.trim()}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                >
                  ↩ Resume (same session)
                </button>
                <button
                  onClick={handleFork}
                  disabled={forkSSE.status === 'streaming' || !prompt.trim()}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                >
                  ⑂ Fork (new session)
                </button>
                <button
                  onClick={handleWrongCwd}
                  disabled={resumeSSE.status === 'streaming'}
                  className="px-4 py-1.5 bg-red-900 hover:bg-red-800 disabled:opacity-50 text-red-200 text-sm rounded-lg transition-colors border border-red-700"
                  title="Demo: resume with wrong cwd"
                >
                  ⚠ Wrong CWD Demo
                </button>
              </div>

              <div className="mt-3 p-2 bg-yellow-950 border border-yellow-800 rounded text-xs text-yellow-300">
                ⚠ Sessions are stored at ~/.claude/projects/&lt;encoded-cwd&gt;. Resuming from a different cwd may fail silently.
              </div>
            </div>

            {(messages.length > 0 || loadingMessages) && (
              <details className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <summary className="text-sm font-medium text-gray-300 cursor-pointer">
                  Message History ({messages.length} messages)
                </summary>
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                  {loadingMessages ? (
                    <div className="text-gray-500 text-sm animate-pulse">Loading...</div>
                  ) : messages.map((m, i) => (
                    <div key={i} className={`rounded p-2 text-xs border ${
                      m.role === 'assistant' ? 'border-blue-700 bg-blue-950' : 'border-green-700 bg-green-950'
                    }`}>
                      <span className={`font-medium ${m.role === 'assistant' ? 'text-blue-300' : 'text-green-300'}`}>
                        {m.role ?? m.type ?? 'unknown'}
                      </span>
                      <pre className="mt-1 text-gray-400 text-xs overflow-x-auto max-h-20">
                        {JSON.stringify(m.content ?? m, null, 2).slice(0, 300)}...
                      </pre>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <div className="flex-1 overflow-y-auto min-h-0 bg-gray-800 rounded-xl border border-gray-700 p-4">
              <MessageStream messages={activeMessages} />
            </div>
          </>
        )}
      </div>

      <HowItWorks
        feature="Sessions — Resume, Fork, List"
        sdkApi="query({ options: { resume: sessionId } }) | query({ options: { resume: id, forkSession: true } })"
        description="Sessions persist conversation history and context. resume: sessionId continues from exactly where the agent left off — it remembers all files read, tool calls made, and conversation turns. forkSession: true creates a new branch from the current session, letting you explore different approaches without losing the original."
        whyUseIt="Resume is essential for long-running workflows that span multiple API calls. Fork lets you A/B test different follow-up approaches or create safe exploration branches."
        docsUrl="https://docs.anthropic.com/en/api/agent-sdk/typescript"
      />
    </div>
  )
}
