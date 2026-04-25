import { useState } from 'react'
import type { SSEMessage } from '../hooks/useSSE'

interface HookEventLogProps {
  messages: SSEMessage[]
}

const HOOK_COLORS: Record<string, string> = {
  PreToolUse: 'bg-orange-900 text-orange-200 border-orange-700',
  PostToolUse: 'bg-green-900 text-green-200 border-green-700',
  Stop: 'bg-purple-900 text-purple-200 border-purple-700',
  UserPromptSubmit: 'bg-blue-900 text-blue-200 border-blue-700',
  Notification: 'bg-cyan-900 text-cyan-200 border-cyan-700',
  SubagentStart: 'bg-pink-900 text-pink-200 border-pink-700',
  SubagentStop: 'bg-rose-900 text-rose-200 border-rose-700',
  PreCompact: 'bg-yellow-900 text-yellow-200 border-yellow-700',
}

export function HookEventLog({ messages }: HookEventLogProps) {
  const hookMessages = messages.filter((m) => m.event === 'hook_event')

  if (hookMessages.length === 0) {
    return (
      <div className="text-gray-600 text-sm text-center py-8">
        Hook events will appear here
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {hookMessages.map((msg, i) => {
        const d = msg.data as Record<string, unknown>
        const hookType = d.hookType as string
        const colorClass = HOOK_COLORS[hookType] ?? 'bg-gray-800 text-gray-200 border-gray-700'

        return <HookEvent key={i} d={d} colorClass={colorClass} hookType={hookType} />
      })}
    </div>
  )
}

function HookEvent({ d, colorClass, hookType }: {
  d: Record<string, unknown>
  colorClass: string
  hookType: string
}) {
  const [expanded, setExpanded] = useState(false)
  const ts = d.timestamp
    ? new Date(d.timestamp as number).toLocaleTimeString()
    : ''

  return (
    <div className={`animate-fade-in border rounded p-2 text-xs ${colorClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{hookType}</span>
          {d.toolName && (
            <span className="font-mono opacity-80">{d.toolName as string}</span>
          )}
          {d.decision && (
            <span className={`px-1 rounded text-xs ${
              d.decision === 'deny' ? 'bg-red-800 text-red-100' :
              d.decision === 'modified' ? 'bg-yellow-800 text-yellow-100' :
              d.decision === 'allow' ? 'bg-green-800 text-green-100' : 'bg-gray-700'
            }`}>
              {d.decision as string}
            </span>
          )}
          {d.async && <span className="opacity-60">async</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="opacity-50">{ts}</span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="opacity-60 hover:opacity-100"
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>
      {expanded && (
        <pre className="mt-2 text-xs overflow-x-auto opacity-80 bg-black/20 rounded p-1">
          {JSON.stringify(d, null, 2)}
        </pre>
      )}
    </div>
  )
}
