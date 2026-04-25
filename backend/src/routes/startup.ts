import { Router, type Request, type Response } from 'express'
import { startup, query, type WarmQuery } from '@anthropic-ai/claude-agent-sdk'
import { initSSE, sendEvent, pipeSDKToSSE } from '../lib/stream-to-sse.js'
import { upsertSession, logCost } from '../db/index.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SANDBOX_DIR = process.env.SANDBOX_DIR
  ? path.resolve(process.env.SANDBOX_DIR)
  : path.resolve(__dirname, '../../sandbox')

let warmQuery: WarmQuery | null = null
let warmElapsedMs = 0

export const startupRouter = Router()

startupRouter.post('/warm', async (req: Request, res: Response) => {
  try {
    if (warmQuery) {
      warmQuery.close()
      warmQuery = null
    }
    const start = Date.now()
    warmQuery = await startup({
      options: {
        cwd: SANDBOX_DIR,
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      },
    })
    warmElapsedMs = Date.now() - start
    res.json({ warmed: true, elapsed_ms: warmElapsedMs })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: msg })
  }
})

startupRouter.post('/query', (req: Request, res: Response) => {
  initSSE(res)

  const { prompt, allowedTools } = req.body as {
    prompt: string
    allowedTools?: string[]
  }

  if (!prompt) {
    sendEvent(res, 'error', { error: 'prompt is required' })
    res.end()
    return
  }

  const abortController = new AbortController()
  res.on('close', () => abortController.abort())

  const start = Date.now()
  let gen: AsyncGenerator<import('@anthropic-ai/claude-agent-sdk').SDKMessage, void>

  if (warmQuery) {
    const wq = warmQuery
    warmQuery = null
    gen = wq.query(prompt)
    sendEvent(res, 'meta', { mode: 'warm', warm_elapsed_ms: warmElapsedMs })
  } else {
    gen = query({
      prompt,
      options: {
        cwd: SANDBOX_DIR,
        allowedTools: allowedTools ?? ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
        abortController,
      },
    })
    sendEvent(res, 'meta', { mode: 'cold' })
  }

  void pipeSDKToSSE(res, gen, (msg) => {
    if (msg.type === 'result') {
      const elapsed = Date.now() - start
      sendEvent(res, 'timing', { elapsed_ms: elapsed })
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

startupRouter.get('/status', (_req: Request, res: Response) => {
  res.json({ warmed: warmQuery !== null, warm_elapsed_ms: warmElapsedMs })
})
