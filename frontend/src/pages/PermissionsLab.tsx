import { useState } from 'react'
import { usePostSSE } from '../hooks/useSSE'
import { MessageStream } from '../components/MessageStream'
import { CostMeter } from '../components/CostMeter'
import { HowItWorks } from '../components/HowItWorks'

type PermMode = 'default' | 'acceptEdits' | 'dontAsk' | 'bypassPermissions' | 'plan'

const MODES: { id: PermMode; label: string; desc: string; color: string }[] = [
  { id: 'default', label: 'default', desc: 'Prompts for dangerous ops. canUseTool fires.', color: 'blue' },
  { id: 'acceptEdits', label: 'acceptEdits', desc: 'Auto-accepts file edits. No prompts for writes.', color: 'green' },
  { id: 'dontAsk', label: 'dontAsk', desc: "Denies if not pre-approved. Silent refusal.", color: 'yellow' },
  { id: 'bypassPermissions', label: 'bypassPermissions', desc: 'Skips all checks. IGNORES allowedTools!', color: 'red' },
  { id: 'plan', label: 'plan', desc: 'Planning only. No tool execution.', color: 'purple' },
]

const ALL_TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch']

interface PermRequest {
  requestId: string
  toolName: string
  toolInput: unknown
}

export function PermissionsLab() {
  const [prompt, setPrompt] = useState('Read sandbox/demo.ts, then try to write a test file.')
  const [mode, setMode] = useState<PermMode>('default')
  const [allowedTools, setAllowedTools] = useState<string[]>(['Read', 'Glob'])
  const [disallowedTools, setDisallowedTools] = useState<string[]>([])
  const [pendingRequest, setPendingRequest] = useState<PermRequest | null>(null)

  const { messages, status, error, run, clear } = usePostSSE({
    onMessage: (evt, data) => {
      if (evt === 'permission_request') {
        setPendingRequest(data as PermRequest)
      }
      if (evt === 'permission_decision') {
        setPendingRequest(null)
      }
    },
  })

  const handleRun = () => {
    if (!prompt.trim()) return
    setPendingRequest(null)
    run('/api/permissions/query', {
      prompt: prompt.trim(),
      mode,
      allowedTools,
      disallowedTools,
    })
  }

  const handleDecision = async (allow: boolean) => {
    if (!pendingRequest) return
    await fetch(`/api/permissions/decision/${pendingRequest.requestId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allow }),
    })
    setPendingRequest(null)
  }

  const toggleTool = (tool: string, list: 'allowed' | 'disallowed') => {
    if (list === 'allowed') {
      setAllowedTools((prev) =>
        prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
      )
    } else {
      setDisallowedTools((prev) =>
        prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
      )
    }
  }

  const modeInfo = MODES.find((m) => m.id === mode)

  return (
    <div className="flex flex-col h-full p-6 max-w-4xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">🔐 Permissions Lab</h1>
        <p className="text-gray-400 text-sm">
          Demonstrates <code className="text-blue-400 bg-gray-800 px-1 rounded">permissionMode</code>, <code className="text-blue-400 bg-gray-800 px-1 rounded">canUseTool</code>, <code className="text-blue-400 bg-gray-800 px-1 rounded">allowedTools</code>, <code className="text-blue-400 bg-gray-800 px-1 rounded">disallowedTools</code>
        </p>
      </div>

      {mode === 'bypassPermissions' && (
        <div className="bg-red-950 border border-red-600 rounded-lg p-3 mb-4 flex items-start gap-2">
          <span className="text-red-400 text-lg">⚠</span>
          <div>
            <div className="text-red-300 font-medium text-sm">Warning: bypassPermissions</div>
            <div className="text-red-400 text-xs mt-1">
              allowedTools does NOT restrict bypassPermissions. All tools will run regardless of your allowedTools selection. Only use in fully trusted, sandboxed environments.
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 mb-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">Permission Mode</label>
          <div className="grid grid-cols-5 gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`p-2 rounded-lg border text-xs transition-colors ${
                  mode === m.id
                    ? m.color === 'red' ? 'bg-red-900 border-red-600 text-red-100'
                    : m.color === 'green' ? 'bg-green-900 border-green-600 text-green-100'
                    : m.color === 'yellow' ? 'bg-yellow-900 border-yellow-600 text-yellow-100'
                    : m.color === 'purple' ? 'bg-purple-900 border-purple-600 text-purple-100'
                    : 'bg-blue-900 border-blue-600 text-blue-100'
                    : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500'
                }`}
              >
                <div className="font-mono font-medium">{m.label}</div>
              </button>
            ))}
          </div>
          {modeInfo && (
            <div className="mt-2 text-xs text-gray-400 bg-gray-900 rounded p-2">{modeInfo.desc}</div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Allowed Tools</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TOOLS.map((tool) => (
                <button
                  key={tool}
                  onClick={() => toggleTool(tool, 'allowed')}
                  className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                    allowedTools.includes(tool)
                      ? 'bg-green-800 border-green-600 text-green-100'
                      : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {tool}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Disallowed Tools</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TOOLS.map((tool) => (
                <button
                  key={tool}
                  onClick={() => toggleTool(tool, 'disallowed')}
                  className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                    disallowedTools.includes(tool)
                      ? 'bg-red-800 border-red-600 text-red-100'
                      : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {tool}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none resize-none"
            disabled={status === 'streaming'}
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-700">
          <CostMeter messages={messages} status={status} />
          <div className="flex gap-2">
            {messages.length > 0 && (
              <button onClick={clear} className="px-3 py-1.5 bg-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-600">Clear</button>
            )}
            <button
              onClick={handleRun}
              disabled={status === 'streaming' || !prompt.trim()}
              className="px-5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
            >
              {status === 'streaming' ? '⟳ Running...' : '▶ Run'}
            </button>
          </div>
        </div>
      </div>

      {pendingRequest && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-white font-semibold mb-2">🔐 Permission Request</h3>
            <p className="text-gray-400 text-sm mb-3">
              Claude wants to use: <span className="text-blue-300 font-mono font-medium">{pendingRequest.toolName}</span>
            </p>
            <pre className="bg-gray-900 rounded p-3 text-xs text-gray-300 max-h-48 overflow-auto mb-4">
              {JSON.stringify(pendingRequest.toolInput, null, 2)}
            </pre>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => handleDecision(false)}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm rounded-lg"
              >
                ✗ Deny
              </button>
              <button
                onClick={() => handleDecision(true)}
                className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm rounded-lg"
              >
                ✓ Allow
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="bg-red-950 border border-red-700 rounded-lg p-3 text-sm text-red-300 mb-4">Error: {error}</div>}

      <div className="flex-1 overflow-y-auto min-h-0">
        <MessageStream messages={messages} />
      </div>

      <HowItWorks
        feature="Permissions — Modes + canUseTool"
        sdkApi="query({ options: { permissionMode, allowedTools, disallowedTools, canUseTool } })"
        description="permissionMode controls the global permission strategy. allowedTools pre-approves specific tools. canUseTool is a callback fired before each tool execution — return 'allow' or 'deny'. disallowedTools removes tools from the model's context entirely. Note: bypassPermissions ignores allowedTools."
        whyUseIt="Use acceptEdits for CI/CD pipelines. Use dontAsk for strict sandboxed environments. Use canUseTool for interactive approval flows or custom audit logging per tool call."
        docsUrl="https://docs.anthropic.com/en/agent-sdk/permissions"
      />
    </div>
  )
}
