import { useEffect, useState } from 'react'
import type { SSEMessage } from '../hooks/useSSE'

interface CostMeterProps {
  messages: SSEMessage[]
  status: string
}

export function CostMeter({ messages, status }: CostMeterProps) {
  const [currentCost, setCurrentCost] = useState(0)
  const [tokens, setTokens] = useState({ input: 0, output: 0 })

  useEffect(() => {
    const result = messages.findLast((m) => m.event === 'result')
    if (result) {
      const d = result.data as { total_cost_usd?: number; usage?: { input_tokens?: number; output_tokens?: number } }
      setCurrentCost(d.total_cost_usd ?? 0)
      setTokens({
        input: d.usage?.input_tokens ?? 0,
        output: d.usage?.output_tokens ?? 0,
      })
    }
  }, [messages])

  useEffect(() => {
    if (status === 'idle') {
      setCurrentCost(0)
      setTokens({ input: 0, output: 0 })
    }
  }, [status])

  const isActive = status === 'streaming'

  return (
    <div className={`flex items-center gap-3 text-xs px-3 py-1.5 rounded-lg border ${
      isActive
        ? 'bg-green-950 border-green-700 text-green-300 animate-pulse'
        : currentCost > 0
        ? 'bg-gray-800 border-gray-700 text-gray-300'
        : 'bg-gray-900 border-gray-800 text-gray-600'
    }`}>
      <span>💰</span>
      <span className="font-mono font-medium">${currentCost.toFixed(5)}</span>
      {tokens.input > 0 && (
        <>
          <span className="text-gray-600">|</span>
          <span>{tokens.input.toLocaleString()} in</span>
          <span>{tokens.output.toLocaleString()} out</span>
        </>
      )}
      {isActive && <span className="text-green-400">●</span>}
    </div>
  )
}
