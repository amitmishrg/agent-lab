import { useEffect, useState } from 'react'
import { usePostSSE } from '../hooks/useSSE'
import { CostMeter } from '../components/CostMeter'
import { HowItWorks } from '../components/HowItWorks'

type SchemaName = 'bug_report' | 'code_review' | 'todos'

interface BugReport {
  bugs: Array<{ file: string; line: number; severity: string; description: string; suggested_fix: string }>
  summary: string
  total_issues: number
}
interface CodeReview {
  overall_score: number
  strengths: string[]
  issues: Array<{ category: string; description: string; priority: string }>
  recommended_actions: string[]
}
interface Todos {
  tasks: Array<{ title: string; description: string; estimated_hours: number; priority: string }>
  total_hours: number
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-900 text-red-200 border-red-700',
  high: 'bg-orange-900 text-orange-200 border-orange-700',
  medium: 'bg-yellow-900 text-yellow-200 border-yellow-700',
  low: 'bg-blue-900 text-blue-200 border-blue-700',
}
const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-900 text-red-200',
  normal: 'bg-blue-900 text-blue-200',
  low: 'bg-gray-700 text-gray-300',
}

function BugReportView({ data }: { data: BugReport }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">Bug Report</h3>
        <span className="bg-red-900 text-red-200 px-2 py-0.5 rounded text-xs">{data.total_issues} issues</span>
      </div>
      <p className="text-gray-300 text-sm">{data.summary}</p>
      <div className="space-y-2">
        {data.bugs.map((bug, i) => (
          <div key={i} className="bg-gray-900 rounded-lg p-3 border border-gray-700">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-1.5 py-0.5 rounded border ${SEVERITY_COLORS[bug.severity] ?? ''}`}>{bug.severity}</span>
              <span className="text-xs font-mono text-gray-400">{bug.file}:{bug.line}</span>
            </div>
            <p className="text-gray-200 text-sm">{bug.description}</p>
            <p className="text-green-400 text-xs mt-1">Fix: {bug.suggested_fix}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function CodeReviewView({ data }: { data: CodeReview }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full border-4 border-blue-500 flex items-center justify-center">
          <span className="text-2xl font-bold text-white">{data.overall_score}</span>
        </div>
        <div>
          <h3 className="text-white font-semibold">Code Review</h3>
          <div className="text-gray-400 text-sm">Score: {data.overall_score}/10</div>
        </div>
      </div>
      <div>
        <div className="text-xs font-medium text-green-400 mb-1">Strengths</div>
        <ul className="space-y-1">
          {data.strengths.map((s, i) => (
            <li key={i} className="text-gray-300 text-sm flex items-start gap-1"><span>✓</span><span>{s}</span></li>
          ))}
        </ul>
      </div>
      {data.issues.length > 0 && (
        <div>
          <div className="text-xs font-medium text-red-400 mb-1">Issues</div>
          <div className="space-y-2">
            {data.issues.map((issue, i) => (
              <div key={i} className="bg-gray-900 rounded p-2 text-sm">
                <span className="text-yellow-300 text-xs">[{issue.category}]</span>
                <span className="text-gray-200 ml-2">{issue.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="text-xs font-medium text-blue-400 mb-1">Recommended Actions</div>
        <ul className="space-y-1">
          {data.recommended_actions.map((a, i) => (
            <li key={i} className="text-gray-300 text-sm flex items-start gap-1"><span>→</span><span>{a}</span></li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function TodosView({ data }: { data: Todos }) {
  const grouped = {
    urgent: data.tasks.filter((t) => t.priority === 'urgent'),
    normal: data.tasks.filter((t) => t.priority === 'normal'),
    low: data.tasks.filter((t) => t.priority === 'low'),
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">TODO List</h3>
        <span className="text-gray-400 text-xs">Total: {data.total_hours}h</span>
      </div>
      {(['urgent', 'normal', 'low'] as const).map((priority) => (
        grouped[priority].length > 0 && (
          <div key={priority}>
            <div className={`text-xs font-medium mb-2 px-2 py-0.5 rounded w-fit ${PRIORITY_COLORS[priority]}`}>{priority.toUpperCase()}</div>
            <div className="space-y-2">
              {grouped[priority].map((task, i) => (
                <div key={i} className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium">{task.title}</span>
                    <span className="text-gray-500 text-xs">{task.estimated_hours}h</span>
                  </div>
                  <p className="text-gray-400 text-xs mt-1">{task.description}</p>
                </div>
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  )
}

export function StructuredLab() {
  const [schemaName, setSchemaName] = useState<SchemaName>('bug_report')
  const [prompt, setPrompt] = useState('')
  const [structuredResult, setStructuredResult] = useState<unknown>(null)
  const [schemas, setSchemas] = useState<Record<string, unknown>>({})
  const [defaultPrompts, setDefaultPrompts] = useState<Record<string, string>>({})
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    fetch('/api/structured/schemas')
      .then((r) => r.json())
      .then((d) => {
        setSchemas(d.schemas ?? {})
        setDefaultPrompts(d.defaultPrompts ?? {})
        setPrompt(d.defaultPrompts?.[schemaName] ?? '')
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (defaultPrompts[schemaName]) setPrompt(defaultPrompts[schemaName])
  }, [schemaName, defaultPrompts])

  const { messages, status, error, run, clear } = usePostSSE({
    onMessage: (evt, data) => {
      if (evt === 'structured_result') {
        setStructuredResult((data as { data?: unknown })?.data ?? data)
      }
    },
  })

  const handleRun = () => {
    if (!prompt.trim()) return
    setStructuredResult(null)
    run('/api/structured/query', { prompt: prompt.trim(), schemaName })
  }

  return (
    <div className="flex flex-col h-full p-6 max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">📋 Structured Lab</h1>
        <p className="text-gray-400 text-sm">
          Demonstrates <code className="text-blue-400 bg-gray-800 px-1 rounded">outputFormat: &#123; type: 'json_schema', jsonSchema &#125;</code>
        </p>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 mb-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">Output Schema</label>
          <div className="grid grid-cols-3 gap-2">
            {(['bug_report', 'code_review', 'todos'] as SchemaName[]).map((s) => (
              <button
                key={s}
                onClick={() => { setSchemaName(s); setStructuredResult(null) }}
                className={`p-3 rounded-lg border text-left text-xs transition-colors ${
                  schemaName === s
                    ? 'bg-blue-900 border-blue-600 text-blue-100'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                }`}
              >
                <div className="font-mono font-medium">{s}</div>
              </button>
            ))}
          </div>
        </div>

        {schemas[schemaName] && (
          <details>
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">View JSON schema</summary>
            <pre className="mt-2 text-xs bg-gray-900 rounded p-2 overflow-x-auto text-gray-300 border border-gray-700 max-h-40">
              {JSON.stringify(schemas[schemaName], null, 2)}
            </pre>
          </details>
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
            {(messages.length > 0 || structuredResult) && (
              <button onClick={() => { clear(); setStructuredResult(null) }} className="px-3 py-1.5 bg-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-600">Clear</button>
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

      {status === 'streaming' && !structuredResult && (
        <div className="text-center text-gray-500 text-sm py-4 animate-pulse">Generating structured output...</div>
      )}

      {structuredResult && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-300">Structured Result</h3>
            <button onClick={() => setShowRaw(!showRaw)} className="text-xs text-gray-500 hover:text-gray-300">
              {showRaw ? 'rendered view' : 'raw JSON'}
            </button>
          </div>
          {showRaw ? (
            <pre className="text-xs text-gray-300 overflow-x-auto bg-gray-900 rounded p-3">
              {JSON.stringify(structuredResult, null, 2)}
            </pre>
          ) : (
            <div>
              {schemaName === 'bug_report' && <BugReportView data={structuredResult as BugReport} />}
              {schemaName === 'code_review' && <CodeReviewView data={structuredResult as CodeReview} />}
              {schemaName === 'todos' && <TodosView data={structuredResult as Todos} />}
            </div>
          )}
        </div>
      )}

      <HowItWorks
        feature="Structured Output — JSON Schema enforcement"
        sdkApi="query({ options: { outputFormat: { type: 'json_schema', jsonSchema: { name, schema, strict: true } } } })"
        description="The outputFormat option forces the agent to produce output conforming to a JSON schema. The result appears in ResultMessage.structured_output. The SDK automatically retries if the output doesn't match the schema (up to a limit)."
        whyUseIt="Use when your application needs to parse Claude's output programmatically. Structured output eliminates prompt engineering for output format and gives you type-safe, validated JSON every time."
        docsUrl="https://docs.anthropic.com/en/api/agent-sdk/typescript"
      />
    </div>
  )
}
