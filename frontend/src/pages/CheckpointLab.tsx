import { useEffect, useState } from 'react'
import { usePostSSE } from '../hooks/useSSE'
import { CostMeter } from '../components/CostMeter'
import { HowItWorks } from '../components/HowItWorks'

interface SandboxFile {
  name: string
  path: string
  size: number
  modified: number
  content: string
}

interface RewindResult {
  canRewind: boolean
  error?: string
  filesChanged?: string[]
  insertions?: number
  deletions?: number
}

export function CheckpointLab() {
  const [files, setFiles] = useState<SandboxFile[]>([])
  const [prompt, setPrompt] = useState(
    'Edit sandbox/demo.ts to add a fibonacci function, edit sandbox/readme.md to document it, and create a new file sandbox/fibonacci.test.ts with basic tests.'
  )
  const [checkpoints, setCheckpoints] = useState<string[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [rewindResults, setRewindResults] = useState<Record<string, RewindResult>>({})
  const [fileChanges, setFileChanges] = useState<Array<{ file: string; action: string }>>([])

  const { messages, status, error, run, clear } = usePostSSE({
    onMessage: (evt, data) => {
      if (evt === 'system') {
        const d = data as { subtype?: string; session_id?: string }
        if (d.subtype === 'init' && d.session_id) {
          setSessionId(d.session_id)
        }
      }
      if (evt === 'checkpoints') {
        setCheckpoints((data as { userMessageIds?: string[] })?.userMessageIds ?? [])
      }
      if (evt === 'files_persisted') {
        const d = data as { files?: Array<{ filename: string }> }
        const files = d.files ?? []
        setFileChanges((prev) => [
          ...prev,
          ...files.map((f) => ({ file: f.filename, action: 'persisted' })),
        ])
      }
      if (evt === 'result') {
        loadFiles()
      }
    },
  })

  const loadFiles = () => {
    fetch('/api/checkpointing/files')
      .then((r) => r.json())
      .then((d) => setFiles(d.files ?? []))
      .catch(() => {})
  }

  useEffect(() => { loadFiles() }, [])

  const handleRun = () => {
    if (!prompt.trim()) return
    setCheckpoints([])
    setFileChanges([])
    setRewindResults({})
    run('/api/checkpointing/query', { prompt: prompt.trim() })
  }

  const handleRewind = async (msgId: string, dryRun: boolean) => {
    if (!sessionId) return
    const res = await fetch('/api/checkpointing/rewind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, userMessageId: msgId, dryRun }),
    })
    const result = await res.json() as RewindResult
    setRewindResults((prev) => ({ ...prev, [msgId]: result }))
    if (!dryRun && result.canRewind) {
      loadFiles()
    }
  }

  return (
    <div className="flex flex-col h-full p-6 max-w-6xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">⏪ Checkpoint Lab</h1>
        <p className="text-gray-400 text-sm">
          Demonstrates <code className="text-blue-400 bg-gray-800 px-1 rounded">enableFileCheckpointing</code> and <code className="text-blue-400 bg-gray-800 px-1 rounded">rewindFiles()</code>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        <div className="flex flex-col gap-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Sandbox Files</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {files.map((f) => (
                <div key={f.name} className="bg-gray-900 rounded p-2 text-xs border border-gray-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-blue-300">{f.name}</span>
                    <span className="text-gray-600">{f.size}B</span>
                  </div>
                  <pre className="text-gray-400 overflow-x-auto max-h-20">{f.content.slice(0, 200)}{f.content.length > 200 ? '...' : ''}</pre>
                </div>
              ))}
              {files.length === 0 && <div className="text-gray-600 text-xs">No files loaded</div>}
            </div>
            <button onClick={loadFiles} className="mt-2 text-xs text-gray-500 hover:text-gray-300">↻ Refresh</button>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <label className="block text-xs font-medium text-gray-400 mb-2">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none resize-none"
              disabled={status === 'streaming'}
            />
            <div className="flex items-center justify-between mt-3">
              <CostMeter messages={messages} status={status} />
              <div className="flex gap-2">
                {messages.length > 0 && <button onClick={() => { clear(); setCheckpoints([]); setFileChanges([]) }} className="px-3 py-1.5 bg-gray-700 text-gray-300 text-xs rounded hover:bg-gray-600">Clear</button>}
                <button
                  onClick={handleRun}
                  disabled={status === 'streaming' || !prompt.trim()}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
                >
                  {status === 'streaming' ? '⟳ Running...' : '▶ Run'}
                </button>
              </div>
            </div>
          </div>

          {fileChanges.length > 0 && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">File Changes</h3>
              <div className="space-y-1">
                {fileChanges.map((fc, i) => (
                  <div key={i} className="text-xs text-green-400 flex items-center gap-2">
                    <span>✎</span>
                    <span className="font-mono">{fc.file}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {checkpoints.length > 0 && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">
                Checkpoints ({checkpoints.length})
                {sessionId && <span className="text-xs text-gray-600 ml-2">session: {sessionId.slice(0, 8)}...</span>}
              </h3>
              <div className="space-y-3">
                {checkpoints.map((msgId, i) => {
                  const result = rewindResults[msgId]
                  return (
                    <div key={msgId} className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-xs text-gray-400">Turn {i + 1}</span>
                          <code className="ml-2 text-xs font-mono text-gray-500">{msgId.slice(0, 12)}...</code>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleRewind(msgId, true)}
                            className="px-2 py-0.5 bg-yellow-900 border border-yellow-700 text-yellow-300 text-xs rounded hover:bg-yellow-800"
                          >
                            Dry run
                          </button>
                          <button
                            onClick={() => handleRewind(msgId, false)}
                            className="px-2 py-0.5 bg-red-900 border border-red-700 text-red-300 text-xs rounded hover:bg-red-800"
                          >
                            Rewind
                          </button>
                        </div>
                      </div>
                      {result && (
                        <div className={`text-xs rounded p-2 mt-1 ${result.canRewind ? 'bg-green-950 text-green-300' : 'bg-red-950 text-red-300'}`}>
                          {result.canRewind ? (
                            <>
                              ✓ {result.filesChanged?.length ?? 0} files would change
                              {result.insertions !== undefined && ` (+${result.insertions}/-${result.deletions})`}
                              {result.filesChanged && (
                                <div className="mt-1 font-mono">{result.filesChanged.join(', ')}</div>
                              )}
                            </>
                          ) : (
                            `✗ ${result.error}`
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex-1 bg-gray-800 rounded-xl border border-gray-700 p-4 overflow-y-auto">
            <h3 className="text-sm font-medium text-gray-300 mb-3">SDK Messages</h3>
            {error && <div className="bg-red-950 border border-red-700 rounded p-2 text-xs text-red-300 mb-2">Error: {error}</div>}
            <div className="space-y-2">
              {messages.map((m, i) => {
                if (m.event === 'assistant') {
                  const content = (m.data as { message?: { content?: Array<{ type: string; text?: string; name?: string }> } })?.message?.content ?? []
                  const texts = content.filter((b) => b.type === 'text').map((b) => b.text).join('').slice(0, 150)
                  const tools = content.filter((b) => b.type === 'tool_use').map((b) => b.name)
                  return (
                    <div key={i} className="text-xs border-l-2 border-blue-600 pl-2 text-gray-300">
                      {texts && <p>{texts}...</p>}
                      {tools.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tools.map((t, j) => <span key={j} className="bg-gray-700 text-gray-300 px-1 rounded font-mono">{t}</span>)}
                        </div>
                      )}
                    </div>
                  )
                }
                return null
              })}
              {status === 'streaming' && <div className="text-gray-500 text-xs animate-pulse">Streaming...</div>}
            </div>
          </div>
        </div>
      </div>

      <HowItWorks
        feature="File Checkpointing + Rewind"
        sdkApi="query({ options: { enableFileCheckpointing: true } }) then query.rewindFiles(userMessageId, { dryRun })"
        description="enableFileCheckpointing creates snapshots before each file modification. rewindFiles() restores files to their state at a given user message UUID. Use dryRun: true to preview what would change before committing."
        whyUseIt="Essential for safe autonomous coding agents. Checkpoint lets you undo Claude's file changes if a multi-step edit goes wrong, without requiring git. Perfect for agent sandboxes and interactive debugging."
        docsUrl="https://docs.anthropic.com/en/api/agent-sdk/typescript"
      />
    </div>
  )
}
