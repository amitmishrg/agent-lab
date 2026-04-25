import { useState } from 'react'
import { usePostSSE } from '../hooks/useSSE'
import { MessageStream } from '../components/MessageStream'
import { CostMeter } from '../components/CostMeter'
import { HowItWorks } from '../components/HowItWorks'

interface McpServerStatus {
  name: string
  status: string
}

export function McpLab() {
  const [prompt, setPrompt] = useState('List the files in the sandbox directory and show their contents.')
  const [servers, setServers] = useState<string[]>(['filesystem'])
  const [githubToken, setGithubToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [serverStatuses, setServerStatuses] = useState<McpServerStatus[]>([])

  const { messages, status, error, run, clear } = usePostSSE({
    onMessage: (evt, data) => {
      if (evt === 'mcp_status') {
        const d = data as { servers?: McpServerStatus[] }
        setServerStatuses(d.servers ?? [])
      }
    },
  })

  const handleRun = () => {
    if (!prompt.trim()) return
    setServerStatuses([])
    run('/api/mcp/query', {
      prompt: prompt.trim(),
      servers,
      githubToken: githubToken || undefined,
    })
  }

  const toggleServer = (s: string) => {
    setServers((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  const mcpToolCalls = messages.filter((m) => m.event === 'mcp_tool_call')
  const mcpErrors = messages.filter((m) => m.event === 'mcp_error')

  return (
    <div className="flex flex-col h-full p-6 max-w-4xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">🔌 MCP Lab</h1>
        <p className="text-gray-400 text-sm">
          Demonstrates <code className="text-blue-400 bg-gray-800 px-1 rounded">mcpServers</code> option — connect external tool servers via Model Context Protocol
        </p>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 mb-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">MCP Servers</label>
          <div className="flex gap-3">
            <button
              onClick={() => toggleServer('filesystem')}
              className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                servers.includes('filesystem')
                  ? 'bg-teal-900 border-teal-600 text-teal-100'
                  : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500'
              }`}
            >
              📁 filesystem
            </button>
            <button
              onClick={() => toggleServer('github')}
              className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                servers.includes('github')
                  ? 'bg-blue-900 border-blue-600 text-blue-100'
                  : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500'
              }`}
            >
              🐙 github
            </button>
          </div>
        </div>

        {servers.includes('github') && (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">GitHub Token</label>
            <div className="flex gap-2">
              <input
                type={showToken ? 'text' : 'password'}
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_... (leave empty to demo failed connection)"
                className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
              />
              <button onClick={() => setShowToken(!showToken)} className="text-xs text-gray-500 hover:text-gray-300 px-2">
                {showToken ? 'hide' : 'show'}
              </button>
            </div>
            {!githubToken && (
              <div className="text-xs text-yellow-400 mt-1">Leave empty to demonstrate failed server connection state</div>
            )}
          </div>
        )}

        {serverStatuses.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Server Status</label>
            <div className="flex gap-2">
              {serverStatuses.map((s) => (
                <div
                  key={s.name}
                  className={`px-3 py-1 rounded-full text-xs border ${
                    s.status === 'connected'
                      ? 'bg-green-900 border-green-600 text-green-200'
                      : s.status === 'failed'
                      ? 'bg-red-900 border-red-600 text-red-200'
                      : 'bg-yellow-900 border-yellow-600 text-yellow-200'
                  }`}
                >
                  {s.name}: {s.status}
                </div>
              ))}
            </div>
          </div>
        )}

        {mcpErrors.length > 0 && (
          <div className="bg-red-950 border border-red-700 rounded p-3 text-xs text-red-300">
            {mcpErrors.map((e, i) => {
              const d = e.data as { server?: string; error?: string }
              return <div key={i}>⚠ {d.server}: {d.error}</div>
            })}
          </div>
        )}

        {mcpToolCalls.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">MCP Tool Calls ({mcpToolCalls.length})</label>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {mcpToolCalls.map((m, i) => {
                const d = m.data as { server?: string; tool?: string; fullName?: string }
                const isFsCall = d.server === 'filesystem'
                return (
                  <div key={i} className={`text-xs px-2 py-1 rounded font-mono ${isFsCall ? 'text-teal-300 bg-teal-950' : 'text-blue-300 bg-blue-950'}`}>
                    {d.fullName}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Prompt</label>
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
            {messages.length > 0 && <button onClick={clear} className="px-3 py-1.5 bg-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-600">Clear</button>}
            <button
              onClick={handleRun}
              disabled={status === 'streaming' || !prompt.trim() || servers.length === 0}
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
        feature="MCP Servers — External Tools"
        sdkApi='query({ options: { mcpServers: { "filesystem": { type: "stdio", command: "npx", args: [...] } } } })'
        description="MCP (Model Context Protocol) servers add external tool capabilities to the agent. The SDK spawns them as subprocesses and exposes their tools as mcp__serverName__toolName. Tools appear in the system init message and can be called like built-in tools."
        whyUseIt="Use MCP to connect your agent to databases, file systems, GitHub, Slack, browsers, and hundreds of other external systems without writing any tool execution code yourself."
        docsUrl="https://docs.anthropic.com/en/agent-sdk/mcp"
      />
    </div>
  )
}
