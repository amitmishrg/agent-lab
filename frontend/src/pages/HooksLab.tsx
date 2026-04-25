import { useState } from 'react'
import { usePostSSE } from '../hooks/useSSE'
import { MessageStream } from '../components/MessageStream'
import { HookEventLog } from '../components/HookEventLog'
import { CostMeter } from '../components/CostMeter'
import { HowItWorks } from '../components/HowItWorks'

const HOOK_OPTIONS = [
  { id: 'PreToolUse', label: 'PreToolUse', color: 'orange', desc: 'Before each tool execution' },
  { id: 'PostToolUse', label: 'PostToolUse', color: 'green', desc: 'After each tool execution' },
  { id: 'UserPromptSubmit', label: 'UserPromptSubmit', color: 'blue', desc: 'When prompt is submitted' },
  { id: 'Stop', label: 'Stop', color: 'purple', desc: 'When agent stops' },
  { id: 'Notification', label: 'Notification', color: 'cyan', desc: 'Notifications from agent' },
  { id: 'SubagentStart', label: 'SubagentStart', color: 'pink', desc: 'When subagent spawns' },
  { id: 'SubagentStop', label: 'SubagentStop', color: 'rose', desc: 'When subagent completes' },
  { id: 'PreCompact', label: 'PreCompact', color: 'yellow', desc: 'Before context compaction' },
]

export function HooksLab() {
  const [prompt, setPrompt] = useState('Read the demo.ts file and describe its functions.')
  const [enabledHooks, setEnabledHooks] = useState<string[]>(['PreToolUse', 'PostToolUse', 'Stop'])
  const [blockEnvFiles, setBlockEnvFiles] = useState(false)
  const [redirectWrites, setRedirectWrites] = useState(false)
  const [asyncLogging, setAsyncLogging] = useState(false)

  const { messages, status, error, run, clear } = usePostSSE()

  const handleRun = () => {
    if (!prompt.trim()) return
    run('/api/hooks/query', {
      prompt: prompt.trim(),
      enabledHooks,
      blockEnvFiles,
      redirectWrites,
      asyncLogging,
    })
  }

  const toggleHook = (id: string) => {
    setEnabledHooks((prev) =>
      prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]
    )
  }

  const hookEvents = messages.filter((m) => m.event === 'hook_event')
  const sdkMessages = messages.filter((m) => m.event !== 'hook_event')

  return (
    <div className="flex flex-col h-full p-6 max-w-6xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">🪝 Hooks Lab</h1>
        <p className="text-gray-400 text-sm">
          Demonstrates SDK hooks — intercept, validate, block, and log tool execution in real time
        </p>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 mb-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">Enabled Hooks</label>
          <div className="grid grid-cols-4 gap-2">
            {HOOK_OPTIONS.map((hook) => (
              <button
                key={hook.id}
                onClick={() => toggleHook(hook.id)}
                className={`p-2 rounded-lg border text-xs text-left transition-colors ${
                  enabledHooks.includes(hook.id)
                    ? 'bg-gray-700 border-gray-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'
                }`}
              >
                <div className="font-medium">{hook.label}</div>
                <div className="text-gray-500 text-xs leading-tight mt-0.5">{hook.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-6 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={blockEnvFiles}
              onChange={(e) => setBlockEnvFiles(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-300">Block .env file writes (PreToolUse demo)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={redirectWrites}
              onChange={(e) => setRedirectWrites(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-300">Redirect writes to /sandbox (input mutation)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={asyncLogging}
              onChange={(e) => setAsyncLogging(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-300">Async audit logging (non-blocking PostToolUse)</span>
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
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

      {error && <div className="bg-red-950 border border-red-700 rounded-lg p-3 text-sm text-red-300 mb-4">Error: {error}</div>}

      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        <div className="flex flex-col bg-gray-800 rounded-xl border border-gray-700 p-4 overflow-hidden">
          <h3 className="text-sm font-medium text-gray-300 mb-3 flex-shrink-0">SDK Messages</h3>
          <div className="flex-1 overflow-y-auto">
            <MessageStream messages={sdkMessages} />
          </div>
        </div>

        <div className="flex flex-col bg-gray-800 rounded-xl border border-gray-700 p-4 overflow-hidden">
          <h3 className="text-sm font-medium text-gray-300 mb-2 flex-shrink-0 flex items-center justify-between">
            <span>Hook Events ({hookEvents.length})</span>
            {hookEvents.length > 0 && (
              <span className="text-xs text-gray-500">real-time</span>
            )}
          </h3>
          <div className="flex-1 overflow-y-auto">
            <HookEventLog messages={messages} />
          </div>
        </div>
      </div>

      <HowItWorks
        feature="Hooks — Intercept, validate, block, transform"
        sdkApi="query({ options: { hooks: { PreToolUse: [{ matcher: 'Edit|Write', hooks: [cb] }] } } })"
        description="Hooks are async callbacks fired at key points in the agent lifecycle. PreToolUse fires before each tool execution — return { decision: 'block' } to prevent it. PostToolUse fires after. Both can return updated inputs. UserPromptSubmit fires when the prompt is submitted. Stop fires when the agent finishes."
        whyUseIt="Use PreToolUse for security policies (block .env access, require approval). Use PostToolUse for audit logging. Use async: true in PostToolUse for non-blocking logging that doesn't slow the agent down."
        docsUrl="https://docs.anthropic.com/en/agent-sdk/hooks"
      />
    </div>
  )
}
