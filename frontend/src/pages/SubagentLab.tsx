import { useEffect, useState } from 'react'
import { usePostSSE } from '../hooks/useSSE'
import { MessageStream } from '../components/MessageStream'
import { CostMeter } from '../components/CostMeter'
import { HowItWorks } from '../components/HowItWorks'

interface AgentNode {
  id: string
  type: string
  status: 'running' | 'done'
  summary?: string
  spawnedAt: number
}

export function SubagentLab() {
  const [preset, setPreset] = useState<string>('code-review-team')
  const [customPrompt, setCustomPrompt] = useState('')
  const [presets, setPresets] = useState<Array<{ id: string; prompt: string; agents: string[] }>>([])
  const [agentNodes, setAgentNodes] = useState<AgentNode[]>([])

  useEffect(() => {
    fetch('/api/subagents/presets')
      .then((r) => r.json())
      .then((d) => setPresets(d.presets ?? []))
      .catch(() => {})
  }, [])

  const { messages, status, error, run, clear } = usePostSSE({
    onMessage: (evt, data) => {
      if (evt === 'subagent_spawn') {
        const d = data as { agentId?: string; agentType?: string }
        setAgentNodes((prev) => [
          ...prev,
          { id: d.agentId ?? Math.random().toString(36), type: d.agentType ?? 'agent', status: 'running', spawnedAt: Date.now() },
        ])
      }
      if (evt === 'subagent_done') {
        const d = data as { agentId?: string; summary?: string }
        setAgentNodes((prev) =>
          prev.map((n) => n.id === d.agentId ? { ...n, status: 'done', summary: d.summary } : n)
        )
      }
    },
  })

  const handleRun = () => {
    clear()
    setAgentNodes([])
    const selectedPreset = presets.find((p) => p.id === preset)
    run('/api/subagents/query', {
      preset,
      prompt: customPrompt.trim() || selectedPreset?.prompt,
    })
  }

  const selectedPreset = presets.find((p) => p.id === preset)

  return (
    <div className="flex flex-col h-full p-6 max-w-6xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">🤖 Subagent Lab</h1>
        <p className="text-gray-400 text-sm">
          Demonstrates <code className="text-blue-400 bg-gray-800 px-1 rounded">agents</code> option — delegate tasks to specialized subagents
        </p>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 mb-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">Preset</label>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`p-3 rounded-lg border text-left text-xs transition-colors ${
                  preset === p.id
                    ? 'bg-blue-900 border-blue-600 text-blue-100'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                }`}
              >
                <div className="font-medium text-sm">{p.id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</div>
                <div className="text-gray-400 mt-1">Agents: {p.agents.join(', ')}</div>
              </button>
            ))}
          </div>
        </div>

        {selectedPreset && (
          <div className="bg-gray-900 rounded p-3 text-xs text-gray-400">
            <span className="text-gray-500">Default prompt: </span>{selectedPreset.prompt}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Custom prompt (optional override)</label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={2}
            placeholder={selectedPreset?.prompt}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none resize-none"
            disabled={status === 'streaming'}
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-700">
          <CostMeter messages={messages} status={status} />
          <div className="flex gap-2">
            {messages.length > 0 && (
              <button onClick={() => { clear(); setAgentNodes([]) }} className="px-3 py-1.5 bg-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-600">Clear</button>
            )}
            <button
              onClick={handleRun}
              disabled={status === 'streaming'}
              className="px-5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
            >
              {status === 'streaming' ? '⟳ Running...' : '▶ Run Team'}
            </button>
          </div>
        </div>
      </div>

      {agentNodes.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Agent Execution Tree</h3>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-blue-300">
              <span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0"></span>
              <span>Main Agent</span>
              {status === 'streaming' && <span className="text-xs text-blue-400 animate-pulse">running...</span>}
              {status === 'done' && <span className="text-xs text-blue-400">✓ done</span>}
            </div>
            <div className="ml-6 space-y-2 border-l-2 border-gray-700 pl-4">
              {agentNodes.map((node) => (
                <div key={node.id} className={`flex items-start gap-2 text-sm ${
                  node.status === 'done' ? 'text-green-300' : 'text-purple-300'
                }`}>
                  <span className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${
                    node.status === 'done' ? 'bg-green-500' : 'bg-purple-500 animate-pulse'
                  }`}></span>
                  <div>
                    <div className="font-medium">{node.type}</div>
                    {node.status === 'done' && node.summary && (
                      <div className="text-xs text-gray-500 mt-0.5 max-w-sm truncate">{node.summary}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && <div className="bg-red-950 border border-red-700 rounded-lg p-3 text-sm text-red-300 mb-4">Error: {error}</div>}

      <div className="flex-1 overflow-y-auto min-h-0">
        <MessageStream messages={messages} />
      </div>

      <HowItWorks
        feature="Subagents — Multi-agent teams"
        sdkApi='query({ options: { allowedTools: ["Agent"], agents: { "name": { description, prompt, tools } } } })'
        description="Subagents are specialized agent instances spawned by the main agent via the Agent tool. Each subagent has its own description, system prompt, and tool restrictions. Messages from subagents include parent_tool_use_id so you can track which messages belong to which subagent."
        whyUseIt="Use subagents when you need parallel specialized work — e.g., a security scanner and a code reviewer running simultaneously. Each subagent gets focused instructions without polluting the main agent's context."
        docsUrl="https://docs.anthropic.com/en/agent-sdk/subagents"
      />
    </div>
  )
}
