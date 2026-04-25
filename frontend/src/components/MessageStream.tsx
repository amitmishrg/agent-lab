import { useState } from 'react'
import type { SSEMessage } from '../hooks/useSSE'

interface ContentBlock {
  type: string
  text?: string
  name?: string
  input?: unknown
  id?: string
}

interface MessageStreamProps {
  messages: SSEMessage[]
  showHookEvents?: boolean
}

const TOOL_COLORS: Record<string, string> = {
  Read: 'bg-blue-900 text-blue-200 border-blue-700',
  Write: 'bg-green-900 text-green-200 border-green-700',
  Edit: 'bg-yellow-900 text-yellow-200 border-yellow-700',
  Bash: 'bg-red-900 text-red-200 border-red-700',
  Glob: 'bg-purple-900 text-purple-200 border-purple-700',
  Grep: 'bg-indigo-900 text-indigo-200 border-indigo-700',
  WebSearch: 'bg-cyan-900 text-cyan-200 border-cyan-700',
  WebFetch: 'bg-teal-900 text-teal-200 border-teal-700',
  Agent: 'bg-pink-900 text-pink-200 border-pink-700',
}

function getToolColor(name: string): string {
  if (name.startsWith('mcp__filesystem')) return 'bg-teal-900 text-teal-200 border-teal-700'
  if (name.startsWith('mcp__github')) return 'bg-blue-900 text-blue-200 border-blue-700'
  if (name.startsWith('mcp__agent-lab-tools')) return 'bg-purple-900 text-purple-200 border-purple-700'
  if (name.startsWith('mcp__')) return 'bg-cyan-900 text-cyan-200 border-cyan-700'
  return TOOL_COLORS[name] ?? 'bg-gray-700 text-gray-200 border-gray-600'
}

function CollapsibleJSON({ data, label = 'JSON' }: { data: unknown; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
      >
        <span>{open ? '▼' : '▶'}</span>
        <span>{label}</span>
      </button>
      {open && (
        <pre className="mt-1 text-xs bg-gray-900 rounded p-2 overflow-x-auto max-h-48 text-gray-300 border border-gray-700">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

function ToolUseBlock({ block }: { block: ContentBlock }) {
  const [expanded, setExpanded] = useState(false)
  const colorClass = getToolColor(block.name ?? '')

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border font-mono ${colorClass} hover:opacity-80 transition-opacity`}
      >
        <span>⚙</span>
        <span>{block.name}</span>
        <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="mt-1 ml-4">
          <pre className="text-xs bg-gray-900 rounded p-2 overflow-x-auto max-h-40 text-gray-300 border border-gray-700">
            {JSON.stringify(block.input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

function SystemMessage({ data }: { data: Record<string, unknown> }) {
  const [raw, setRaw] = useState(false)
  return (
    <div className="animate-fade-in bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="bg-gray-600 text-gray-200 px-1.5 py-0.5 rounded text-xs font-mono">INIT</span>
        <button onClick={() => setRaw(!raw)} className="text-gray-500 hover:text-gray-300 text-xs">
          {raw ? 'hide raw' : 'raw'}
        </button>
      </div>
      {raw ? (
        <pre className="text-gray-400 overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>
      ) : (
        <div className="space-y-1 text-gray-300">
          <div><span className="text-gray-500">session: </span><span className="font-mono text-blue-300">{data.session_id as string}</span></div>
          <div><span className="text-gray-500">model: </span>{data.model as string}</div>
          <div><span className="text-gray-500">mode: </span>{data.permissionMode as string}</div>
          <div><span className="text-gray-500">tools: </span>{(data.tools as string[] | undefined)?.join(', ')}</div>
          {(data.mcp_servers as Array<{ name: string; status: string }> | undefined)?.length ? (
            <div>
              <span className="text-gray-500">mcp: </span>
              {(data.mcp_servers as Array<{ name: string; status: string }>).map((s) => (
                <span key={s.name} className={`mr-1 px-1 rounded ${s.status === 'connected' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                  {s.name}:{s.status}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function AssistantMessage({ data }: { data: Record<string, unknown> }) {
  const [raw, setRaw] = useState(false)
  const isSubagent = !!(data as { parent_tool_use_id?: string }).parent_tool_use_id
  const message = data.message as { content?: ContentBlock[] } | undefined
  const content = message?.content ?? []

  return (
    <div className={`animate-fade-in border-l-4 ${isSubagent ? 'border-purple-500 bg-purple-950/30' : 'border-blue-500 bg-gray-800/50'} rounded-r-lg p-3 text-sm`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium ${isSubagent ? 'text-purple-400' : 'text-blue-400'}`}>
          {isSubagent ? '↳ subagent' : 'Claude'}
        </span>
        <button onClick={() => setRaw(!raw)} className="text-gray-600 hover:text-gray-400 text-xs">
          {raw ? 'hide' : 'raw'}
        </button>
      </div>
      {raw ? (
        <pre className="text-xs text-gray-400 overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>
      ) : (
        <div>
          {content.map((block, i) => {
            if (block.type === 'text') {
              return (
                <p key={i} className="text-gray-200 whitespace-pre-wrap text-sm leading-relaxed">
                  {block.text}
                </p>
              )
            }
            if (block.type === 'tool_use') {
              return <ToolUseBlock key={i} block={block} />
            }
            return null
          })}
        </div>
      )}
    </div>
  )
}

function UserMessage({ data }: { data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false)
  const message = data.message as { content?: unknown[] } | undefined
  const content = message?.content ?? []

  return (
    <div className="animate-fade-in border-l-4 border-green-600 bg-gray-800/30 rounded-r-lg p-3 text-xs">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-green-400 hover:text-green-300 w-full text-left"
      >
        <span>✓</span>
        <span>Tool result</span>
        <span className="text-gray-600">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <pre className="mt-2 text-gray-400 overflow-x-auto max-h-40 text-xs bg-gray-900 rounded p-2 border border-gray-700">
          {JSON.stringify(content, null, 2)}
        </pre>
      )}
    </div>
  )
}

function ResultMessage({ data }: { data: Record<string, unknown> }) {
  const [raw, setRaw] = useState(false)
  const isError = data.subtype !== 'success'

  return (
    <div className={`animate-fade-in rounded-lg p-3 border ${isError ? 'bg-red-950 border-red-700' : 'bg-green-950 border-green-700'}`}>
      <div className="flex items-center justify-between">
        <span className={`font-medium text-sm ${isError ? 'text-red-300' : 'text-green-300'}`}>
          {isError ? '✗ ' : '✓ '}
          {data.subtype as string}
        </span>
        <button onClick={() => setRaw(!raw)} className="text-xs text-gray-500 hover:text-gray-300">
          {raw ? 'hide' : 'raw'}
        </button>
      </div>
      {raw ? (
        <pre className="mt-2 text-xs text-gray-400 overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>
      ) : (
        <div className="mt-2 text-xs space-y-1 text-gray-300">
          {data.result && (
            <p className="text-gray-200 whitespace-pre-wrap">{data.result as string}</p>
          )}
          {(data as { errors?: string[] }).errors?.length ? (
            <div className="text-red-300">
              {(data as { errors: string[] }).errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          ) : null}
          <div className="flex gap-4 text-gray-500 pt-1 border-t border-gray-700">
            <span>💰 ${((data.total_cost_usd as number) ?? 0).toFixed(5)}</span>
            <span>🔄 {data.num_turns as number} turns</span>
            <span className="font-mono truncate max-w-32">📎 {(data.session_id as string)?.slice(0, 8)}...</span>
          </div>
        </div>
      )}
    </div>
  )
}

export function MessageStream({ messages, showHookEvents = false }: MessageStreamProps) {
  if (messages.length === 0) {
    return (
      <div className="text-gray-600 text-sm text-center py-8">
        Messages will appear here when you run a query
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {messages.map((msg, i) => {
        if (msg.event === 'system') {
          const d = msg.data as Record<string, unknown>
          if (d.subtype === 'init') return <SystemMessage key={i} data={d} />
        }
        if (msg.event === 'assistant') {
          return <AssistantMessage key={i} data={msg.data as Record<string, unknown>} />
        }
        if (msg.event === 'user') {
          return <UserMessage key={i} data={msg.data as Record<string, unknown>} />
        }
        if (msg.event === 'result') {
          return <ResultMessage key={i} data={msg.data as Record<string, unknown>} />
        }
        if (msg.event === 'hook_event' && showHookEvents) {
          const d = msg.data as Record<string, unknown>
          return (
            <div key={i} className="animate-fade-in bg-orange-950 border border-orange-700 rounded p-2 text-xs">
              <span className="text-orange-400 font-medium">{d.hookType as string}</span>
              {d.toolName && <span className="text-gray-400 ml-2">→ {d.toolName as string}</span>}
              {d.decision && <span className={`ml-2 px-1 rounded text-xs ${d.decision === 'deny' ? 'bg-red-800 text-red-200' : d.decision === 'modified' ? 'bg-yellow-800 text-yellow-200' : 'bg-green-800 text-green-200'}`}>{d.decision as string}</span>}
            </div>
          )
        }
        if (msg.event === 'subagent_spawn') {
          const d = msg.data as Record<string, unknown>
          return (
            <div key={i} className="animate-fade-in flex items-center gap-2 text-xs text-purple-300 bg-purple-950 border border-purple-700 rounded p-2">
              <span>🤖</span>
              <span>Spawned subagent: <span className="font-mono">{d.agentType as string}</span></span>
            </div>
          )
        }
        if (msg.event === 'custom_tool_call') {
          const d = msg.data as Record<string, unknown>
          return (
            <div key={i} className="animate-fade-in bg-purple-950 border border-purple-700 rounded p-2 text-xs">
              <div className="text-purple-300 font-medium">🛠 {d.toolName as string}</div>
              <CollapsibleJSON data={d.input} label="input" />
            </div>
          )
        }
        if (msg.event === 'mcp_tool_call') {
          const d = msg.data as Record<string, unknown>
          const color = (d.server as string) === 'filesystem' ? 'teal' : 'blue'
          return (
            <div key={i} className={`animate-fade-in bg-${color}-950 border border-${color}-700 rounded p-2 text-xs`}>
              <span className={`text-${color}-300 font-medium font-mono`}>{d.fullName as string}</span>
              <CollapsibleJSON data={d.input} label="input" />
            </div>
          )
        }
        return null
      })}
    </div>
  )
}
