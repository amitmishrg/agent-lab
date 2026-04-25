import { Router, type Request, type Response } from 'express'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { initSSE, sendEvent, pipeSDKToSSE } from '../lib/stream-to-sse.js'
import { db, upsertSession, logCost } from '../db/index.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SANDBOX_DIR = process.env.SANDBOX_DIR
  ? path.resolve(process.env.SANDBOX_DIR)
  : path.resolve(__dirname, '../../sandbox')

export const costRouter = Router()

costRouter.get('/summary', (_req: Request, res: Response) => {
  const summary = db.prepare(`
    SELECT
      COUNT(DISTINCT session_id) as total_sessions,
      SUM(cost_usd) as total_cost_usd,
      SUM(input_tokens) as total_input_tokens,
      SUM(output_tokens) as total_output_tokens,
      SUM(cache_read_tokens) as total_cache_read_tokens,
      SUM(cache_write_tokens) as total_cache_write_tokens
    FROM cost_log
  `).get() as {
    total_sessions: number
    total_cost_usd: number
    total_input_tokens: number
    total_output_tokens: number
    total_cache_read_tokens: number
    total_cache_write_tokens: number
  }

  const byModel = db.prepare(`
    SELECT model, SUM(cost_usd) as cost, SUM(input_tokens) as input_tokens, SUM(output_tokens) as output_tokens
    FROM cost_log GROUP BY model ORDER BY cost DESC
  `).all()

  const topSessions = db.prepare(`
    SELECT session_id, SUM(cost_usd) as cost, SUM(input_tokens) as input_tokens,
           SUM(output_tokens) as output_tokens, SUM(cache_read_tokens) as cache_read_tokens,
           COUNT(*) as turns, MAX(timestamp) as last_used
    FROM cost_log GROUP BY session_id ORDER BY cost DESC LIMIT 10
  `).all()

  const dailyCosts = db.prepare(`
    SELECT
      strftime('%Y-%m-%d', datetime(timestamp/1000, 'unixepoch')) as date,
      SUM(cost_usd) as cost,
      COUNT(DISTINCT session_id) as sessions
    FROM cost_log
    GROUP BY date
    ORDER BY date DESC
    LIMIT 30
  `).all()

  res.json({
    summary,
    byModel,
    topSessions,
    dailyCosts,
  })
})

costRouter.get('/session/:id', (req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT * FROM cost_log WHERE session_id = ? ORDER BY timestamp
  `).all(req.params.id as string) as Array<{
    id: number
    session_id: string
    model: string
    input_tokens: number
    output_tokens: number
    cache_read_tokens: number
    cache_write_tokens: number
    cost_usd: number
    timestamp: number
  }>

  const total = rows.reduce((sum, r) => sum + r.cost_usd, 0)
  const cacheHitRate =
    rows.reduce((sum, r) => sum + r.cache_read_tokens, 0) /
    Math.max(rows.reduce((sum, r) => sum + r.input_tokens, 0), 1)

  res.json({ rows, total, cacheHitRate })
})

costRouter.post('/budget-demo', (req: Request, res: Response) => {
  initSSE(res)

  const { maxBudgetUsd = 0.001, prompt } = req.body as {
    maxBudgetUsd?: number
    prompt?: string
  }

  const abortController = new AbortController()
  res.on('close', () => abortController.abort())

  const finalPrompt =
    prompt ??
    'Search the web for information about the Claude Agent SDK, then analyze the sandbox files, run bash commands to check system info, and write a comprehensive report. Be thorough.'

  const gen = query({
    prompt: finalPrompt,
    options: {
      cwd: SANDBOX_DIR,
      allowedTools: ['Read', 'Bash', 'Glob', 'Grep'],
      maxBudgetUsd,
      abortController,
    },
  })

  void pipeSDKToSSE(res, gen, (msg) => {
    if (msg.type === 'result') {
      sendEvent(res, 'budget_result', {
        subtype: msg.subtype,
        totalCostUsd: msg.total_cost_usd,
        numTurns: msg.num_turns,
        maxBudgetUsd,
        budgetExceeded: msg.subtype === 'error_max_budget_usd',
      })
      upsertSession({
        id: msg.session_id,
        cwd: SANDBOX_DIR,
        totalCostUsd: msg.total_cost_usd,
        turnCount: msg.num_turns,
      })
      logCost({
        sessionId: msg.session_id,
        model: Object.keys(msg.modelUsage ?? {})[0] ?? 'unknown',
        inputTokens: msg.usage?.input_tokens ?? 0,
        outputTokens: msg.usage?.output_tokens ?? 0,
        cacheReadTokens: msg.usage?.cache_read_input_tokens ?? 0,
        cacheWriteTokens: msg.usage?.cache_creation_input_tokens ?? 0,
        costUsd: msg.total_cost_usd,
      })
    }
  })
})
