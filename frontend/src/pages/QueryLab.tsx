import { useState } from 'react'
import { usePostSSE } from '../hooks/useSSE'
import { MessageStream } from '../components/MessageStream'
import { CostMeter } from '../components/CostMeter'
import { HowItWorks } from '../components/HowItWorks'

const ALL_TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch']

export function QueryLab() {
  const [prompt, setPrompt] = useState('List the files in the sandbox directory and describe what each one does.')
  const [maxTurns, setMaxTurns] = useState<number | undefined>(5)
  const [selectedTools, setSelectedTools] = useState<string[]>(['Read', 'Glob', 'Grep'])

  const { messages, status, error, run, clear } = usePostSSE()

  const handleRun = () => {
    if (!prompt.trim()) return
    run('/api/query', { prompt: prompt.trim(), maxTurns, allowedTools: selectedTools })
  }

  const toggleTool = (tool: string) => {
    setSelectedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    )
  }

  return (
    <div className="flex flex-col h-full p-6 max-w-4xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">⚡ Query Lab</h1>
        <p className="text-gray-400 text-sm">
          Demonstrates <code className="text-blue-400 bg-gray-800 px-1 rounded">query(&#123; prompt, options &#125;)</code> — the core SDK entry point
        </p>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 mb-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none resize-none"
            placeholder="Enter your prompt..."
            disabled={status === 'streaming'}
          />
        </div>

        <div className="flex gap-6 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Max Turns</label>
            <select
              value={maxTurns ?? ''}
              onChange={(e) => setMaxTurns(e.target.value ? parseInt(e.target.value) : undefined)}
              className="bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
              disabled={status === 'streaming'}
            >
              <option value="1">1 turn</option>
              <option value="5">5 turns</option>
              <option value="10">10 turns</option>
              <option value="">Unlimited</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Allowed Tools</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TOOLS.map((tool) => (
                <button
                  key={tool}
                  onClick={() => toggleTool(tool)}
                  disabled={status === 'streaming'}
                  className={`px-2 py-0.5 rounded text-xs border transition-colors disabled:opacity-50 ${
                    selectedTools.includes(tool)
                      ? 'bg-blue-700 border-blue-500 text-blue-100'
                      : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {tool}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-700">
          <CostMeter messages={messages} status={status} />
          <div className="flex gap-2">
            {messages.length > 0 && (
              <button
                onClick={clear}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={handleRun}
              disabled={status === 'streaming' || !prompt.trim()}
              className="px-5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {status === 'streaming' ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⟳</span> Running...
                </span>
              ) : '▶ Run'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-700 rounded-lg p-3 text-sm text-red-300 mb-4">
          Error: {error}
        </div>
      )}

      {status === 'streaming' && messages.length === 0 && (
        <div className="text-center text-gray-500 text-sm py-4 animate-pulse">
          Initializing agent...
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        <MessageStream messages={messages} />
      </div>

      <HowItWorks
        feature="query() — Basic Agent Query"
        sdkApi="for await (const msg of query({ prompt, options: { allowedTools, maxTurns, cwd } })) { ... }"
        description="query() starts an autonomous agent session. It returns an AsyncGenerator that yields SDKMessage objects in sequence: system init, assistant messages (with tool_use blocks), user messages (tool results), and a final result message with cost and turn count."
        whyUseIt="Use query() when you need a one-shot or multi-turn autonomous task. The agent handles tool execution, permission checks, and context management automatically. Pass allowedTools to restrict what the agent can do."
        docsUrl="https://docs.anthropic.com/en/api/agent-sdk/typescript"
      />
    </div>
  )
}
