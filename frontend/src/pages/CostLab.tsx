import { useEffect, useState } from 'react'
import { usePostSSE } from '../hooks/useSSE'
import { MessageStream } from '../components/MessageStream'
import { CostMeter } from '../components/CostMeter'
import { HowItWorks } from '../components/HowItWorks'

interface CostSummary {
  total_sessions: number
  total_cost_usd: number
  total_input_tokens: number
  total_output_tokens: number
  total_cache_read_tokens: number
  total_cache_write_tokens: number
}

interface DailyCost {
  date: string
  cost: number
  sessions: number
}

interface TopSession {
  session_id: string
  cost: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  turns: number
  last_used: number
}

export function CostLab() {
  const [summary, setSummary] = useState<CostSummary | null>(null)
  const [dailyCosts, setDailyCosts] = useState<DailyCost[]>([])
  const [topSessions, setTopSessions] = useState<TopSession[]>([])
  const [maxBudget, setMaxBudget] = useState(0.001)
  const [budgetResult, setBudgetResult] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)

  const { messages, status, error, run, clear } = usePostSSE({
    onMessage: (evt, data) => {
      if (evt === 'budget_result') {
        setBudgetResult(data)
        loadData()
      }
    },
  })

  const loadData = () => {
    setLoading(true)
    fetch('/api/cost/summary')
      .then((r) => r.json())
      .then((d) => {
        setSummary(d.summary)
        setDailyCosts(d.dailyCosts ?? [])
        setTopSessions(d.topSessions ?? [])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const handleBudgetDemo = () => {
    setBudgetResult(null)
    run('/api/cost/budget-demo', { maxBudgetUsd: maxBudget })
  }

  const cacheHitRate = summary
    ? (summary.total_cache_read_tokens / Math.max(summary.total_input_tokens, 1) * 100).toFixed(1)
    : '0'

  const maxDayCost = Math.max(...dailyCosts.map((d) => d.cost), 0.0001)

  return (
    <div className="flex flex-col h-full p-6 max-w-5xl mx-auto w-full overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">💰 Cost Lab</h1>
        <p className="text-gray-400 text-sm">
          Demonstrates cost tracking, <code className="text-blue-400 bg-gray-800 px-1 rounded">maxBudgetUsd</code>, and cache efficiency
        </p>
      </div>

      {loading ? (
        <div className="text-gray-500 animate-pulse text-sm">Loading cost data...</div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Spend', value: `$${(summary.total_cost_usd ?? 0).toFixed(4)}`, color: 'green' },
              { label: 'Sessions', value: summary.total_sessions ?? 0, color: 'blue' },
              { label: 'Input Tokens', value: (summary.total_input_tokens ?? 0).toLocaleString(), color: 'purple' },
              { label: 'Cache Hit Rate', value: `${cacheHitRate}%`, color: 'cyan' },
            ].map((stat) => (
              <div key={stat.label} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <div className="text-xs text-gray-500 mb-1">{stat.label}</div>
                <div className="text-xl font-bold text-white">{stat.value}</div>
              </div>
            ))}
          </div>

          {dailyCosts.length > 0 && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-6">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Cost Over Time</h3>
              <div className="flex items-end gap-1 h-24">
                {dailyCosts.slice().reverse().map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className="w-full bg-blue-600 rounded-sm hover:bg-blue-500 transition-colors"
                      style={{ height: `${(d.cost / maxDayCost) * 100}%`, minHeight: '2px' }}
                    />
                    <div className="absolute bottom-full mb-1 bg-gray-900 text-xs text-white px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                      {d.date}: ${d.cost.toFixed(5)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topSessions.length > 0 && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 mb-6 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700">
                <h3 className="text-sm font-medium text-gray-300">Top Sessions by Cost</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-500">
                      <th className="text-left px-4 py-2">Session</th>
                      <th className="text-right px-4 py-2">Cost</th>
                      <th className="text-right px-4 py-2">Input</th>
                      <th className="text-right px-4 py-2">Output</th>
                      <th className="text-right px-4 py-2">Cache</th>
                      <th className="text-right px-4 py-2">Turns</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSessions.map((s) => (
                      <tr key={s.session_id} className="border-b border-gray-700/50 hover:bg-gray-750">
                        <td className="px-4 py-2 font-mono text-gray-400">{s.session_id.slice(0, 12)}...</td>
                        <td className="px-4 py-2 text-right text-green-300">${s.cost.toFixed(5)}</td>
                        <td className="px-4 py-2 text-right text-gray-300">{s.input_tokens?.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-gray-300">{s.output_tokens?.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-cyan-300">{s.cache_read_tokens?.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-gray-300">{s.turns}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Cache Efficiency</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-gray-900 rounded-full h-3">
                <div
                  className="bg-cyan-500 rounded-full h-3 transition-all"
                  style={{ width: `${Math.min(parseFloat(cacheHitRate), 100)}%` }}
                />
              </div>
              <span className="text-cyan-300 text-sm font-mono">{cacheHitRate}%</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Cache read tokens are ~10x cheaper than regular input. Repeated system prompts and CLAUDE.md get cached automatically.</p>
          </div>
        </>
      ) : null}

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 mb-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Budget Cap Demo</h3>
        <div className="flex items-center gap-3 mb-4">
          <label className="text-xs text-gray-400">maxBudgetUsd:</label>
          <input
            type="number"
            step="0.001"
            min="0.001"
            value={maxBudget}
            onChange={(e) => setMaxBudget(parseFloat(e.target.value))}
            className="w-24 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
          />
          <span className="text-xs text-gray-500">Very low value triggers error_max_budget_usd</span>
        </div>

        {budgetResult && (
          <div className={`rounded-lg p-3 mb-3 text-sm border ${
            (budgetResult as { budgetExceeded?: boolean })?.budgetExceeded
              ? 'bg-red-950 border-red-700 text-red-300'
              : 'bg-green-950 border-green-700 text-green-300'
          }`}>
            {(budgetResult as { budgetExceeded?: boolean })?.budgetExceeded
              ? `✗ Budget cap hit! Used $${(budgetResult as { totalCostUsd?: number })?.totalCostUsd?.toFixed(5)} in ${(budgetResult as { numTurns?: number })?.numTurns} turns`
              : '✓ Completed within budget'}
          </div>
        )}

        <div className="flex items-center justify-between">
          <CostMeter messages={messages} status={status} />
          <div className="flex gap-2">
            {messages.length > 0 && <button onClick={clear} className="px-3 py-1.5 bg-gray-700 text-gray-300 text-xs rounded-lg hover:bg-gray-600">Clear</button>}
            <button
              onClick={handleBudgetDemo}
              disabled={status === 'streaming'}
              className="px-4 py-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
            >
              {status === 'streaming' ? '⟳ Running...' : 'Run Budget Demo'}
            </button>
          </div>
        </div>
        <div className="mt-4 overflow-y-auto max-h-48">
          <MessageStream messages={messages} />
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-4 text-xs text-gray-400">
        <div className="font-medium text-gray-300 mb-1">📊 OpenTelemetry Traces</div>
        Run <code className="bg-gray-900 px-1 rounded">docker-compose up</code> to see traces in Jaeger at{' '}
        <a href="http://localhost:16686" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
          localhost:16686
        </a>
      </div>

      {error && <div className="bg-red-950 border border-red-700 rounded-lg p-3 text-sm text-red-300 mb-4">Error: {error}</div>}

      <HowItWorks
        feature="Cost Tracking + Budget Caps"
        sdkApi="ResultMessage.total_cost_usd, ResultMessage.usage, ResultMessage.modelUsage | query({ options: { maxBudgetUsd: 0.01 } })"
        description="Every ResultMessage includes total_cost_usd, usage (input/output/cache tokens), and modelUsage (per-model breakdown). maxBudgetUsd stops the agent when costs exceed the limit, returning subtype: 'error_max_budget_usd'."
        whyUseIt="Essential for production cost controls. Track costs per session in your DB. Set per-request budgets to prevent runaway agents. Use cache_read_input_tokens to measure cache efficiency and optimize system prompts."
        docsUrl="https://docs.anthropic.com/en/api/agent-sdk/typescript"
      />
    </div>
  )
}
