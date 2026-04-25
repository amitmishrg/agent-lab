import { useEffect, useState } from 'react'
import { usePostSSE } from '../hooks/useSSE'
import { MessageStream } from '../components/MessageStream'
import { CostMeter } from '../components/CostMeter'
import { HowItWorks } from '../components/HowItWorks'

interface ToolDefinition {
  name: string
  description: string
  schema: Record<string, string>
  code: string
}

const SUGGESTED_PROMPTS = [
  "What's the weather in Bengaluru and tell me a programming joke?",
  "Count the words in this paragraph: The quick brown fox jumps over the lazy dog. It was a bright sunny day.",
  "Get the weather for Tokyo and New York, then tell me a general joke.",
]

export function CustomToolsLab() {
  const [prompt, setPrompt] = useState(SUGGESTED_PROMPTS[0])
  const [tools, setTools] = useState<ToolDefinition[]>([])
  const [calledTools, setCalledTools] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/custom-tools/definitions')
      .then((r) => r.json())
      .then((d) => setTools(d.tools ?? []))
      .catch(() => {})
  }, [])

  const { messages, status, error, run, clear } = usePostSSE({
    onMessage: (evt, data) => {
      if (evt === 'custom_tool_call') {
        const d = data as { toolName?: string }
        if (d.toolName) setCalledTools((prev) => new Set([...prev, d.toolName!]))
      }
    },
  })

  const handleRun = () => {
    if (!prompt.trim()) return
    setCalledTools(new Set())
    run('/api/custom-tools/query', { prompt: prompt.trim() })
  }

  return (
    <div className="flex flex-col h-full p-6 max-w-4xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">🛠️ Custom Tools Lab</h1>
        <p className="text-gray-400 text-sm">
          Demonstrates <code className="text-blue-400 bg-gray-800 px-1 rounded">tool()</code> and <code className="text-blue-400 bg-gray-800 px-1 rounded">createSdkMcpServer()</code> — build custom in-process tools
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {tools.map((t) => (
          <div
            key={t.name}
            className={`bg-gray-800 rounded-xl border p-3 transition-colors ${
              calledTools.has(t.name) ? 'border-purple-500' : 'border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-sm text-purple-300 font-medium">{t.name}</span>
              {calledTools.has(t.name) && (
                <span className="text-xs bg-purple-900 text-purple-300 px-1.5 py-0.5 rounded">called ✓</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-2">{t.description}</p>
            <div className="text-xs text-gray-500 mb-2">
              {Object.entries(t.schema).map(([k, v]) => (
                <span key={k} className="inline-block mr-2">
                  <span className="text-gray-400">{k}</span>: <span className="text-blue-400">{v}</span>
                </span>
              ))}
            </div>
            <details>
              <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400">view handler code</summary>
              <pre className="mt-2 text-xs bg-gray-900 rounded p-2 overflow-x-auto text-gray-300 border border-gray-700">
                {t.code}
              </pre>
            </details>
          </div>
        ))}
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 mb-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">Suggested Prompts</label>
          <div className="flex flex-col gap-1.5">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => setPrompt(p)}
                className={`text-left text-xs px-3 py-2 rounded border transition-colors ${
                  prompt === p
                    ? 'bg-blue-900 border-blue-600 text-blue-100'
                    : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Custom Prompt</label>
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
            {messages.length > 0 && <button onClick={() => { clear(); setCalledTools(new Set()) }} className="px-3 py-1.5 bg-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-600">Clear</button>}
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

      <div className="flex-1 overflow-y-auto min-h-0">
        <MessageStream messages={messages} />
      </div>

      <HowItWorks
        feature="Custom Tools — tool() + createSdkMcpServer()"
        sdkApi='const t = tool("name", "desc", schema, handler); const srv = createSdkMcpServer({ tools: [t] })'
        description="tool() creates an in-process MCP tool with a Zod schema, description, and async handler. createSdkMcpServer() bundles tools into an MCP server that runs in the same process — no subprocess spawning. Pass it as mcpServers and allow mcp__serverName__* in allowedTools."
        whyUseIt="Use for domain-specific tools: internal APIs, databases, real-time data. In-process tools are faster (no IPC) and can share Node.js state. Mark readOnlyHint: true for parallel execution."
        docsUrl="https://docs.anthropic.com/en/api/agent-sdk/typescript"
      />
    </div>
  )
}
