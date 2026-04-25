import { Router, type Request, type Response } from 'express'
import {
  query,
  listSessions,
  getSessionMessages,
  renameSession,
  tagSession,
} from '@anthropic-ai/claude-agent-sdk'
import { initSSE, sendEvent, pipeSDKToSSE } from '../lib/stream-to-sse.js'
import { db, upsertSession, logCost } from '../db/index.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SANDBOX_DIR = process.env.SANDBOX_DIR
  ? path.resolve(process.env.SANDBOX_DIR)
  : path.resolve(__dirname, '../../sandbox')

export const sessionsRouter = Router()

sessionsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const sdkSessions = await listSessions({ limit: 100 })
    const dbSessions = db
      .prepare('SELECT * FROM sessions ORDER BY last_used DESC')
      .all() as Array<{
      id: string
      label: string | null
      tag: string | null
      cwd: string | null
      created_at: number
      last_used: number
      total_cost_usd: number
      turn_count: number
    }>

    const dbMap = new Map(dbSessions.map((s) => [s.id, s]))
    const merged = sdkSessions.map((sdk) => ({
      ...sdk,
      ...dbMap.get(sdk.sessionId),
    }))

    const localOnly = dbSessions.filter(
      (s) => !sdkSessions.find((sdk) => sdk.sessionId === s.id)
    )

    res.json({ sessions: [...merged, ...localOnly] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: msg })
  }
})

sessionsRouter.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const messages = await getSessionMessages(req.params.id as string)
    res.json({ messages })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: msg })
  }
})

sessionsRouter.post('/:id/resume', (req: Request, res: Response) => {
  initSSE(res)

  const { prompt, allowedTools, wrongCwd } = req.body as {
    prompt: string
    allowedTools?: string[]
    wrongCwd?: boolean
  }

  if (!prompt) {
    sendEvent(res, 'error', { error: 'prompt is required' })
    res.end()
    return
  }

  const abortController = new AbortController()
  res.on('close', () => abortController.abort())

  const sessionId = req.params.id as string
  const session = db
    .prepare('SELECT cwd FROM sessions WHERE id = ?')
    .get(sessionId) as { cwd: string | null } | undefined

  const cwd = wrongCwd
    ? '/tmp/wrong-cwd-demo'
    : (session?.cwd ?? SANDBOX_DIR)

  const gen = query({
    prompt,
    options: {
      resume: sessionId,
      cwd,
      allowedTools: allowedTools ?? ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      abortController,
    },
  })

  void pipeSDKToSSE(res, gen, (msg) => {
    if (msg.type === 'result') {
      upsertSession({
        id: msg.session_id,
        cwd,
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

sessionsRouter.post('/:id/fork', (req: Request, res: Response) => {
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

  const sessionId = req.params.id as string
  const session = db
    .prepare('SELECT cwd FROM sessions WHERE id = ?')
    .get(sessionId) as { cwd: string | null } | undefined

  const cwd = session?.cwd ?? SANDBOX_DIR

  const gen = query({
    prompt,
    options: {
      resume: sessionId,
      forkSession: true,
      cwd,
      allowedTools: allowedTools ?? ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      abortController,
    },
  })

  let forkSessionId: string | undefined

  void pipeSDKToSSE(res, gen, (msg) => {
    if (msg.type === 'system' && msg.subtype === 'init') {
      forkSessionId = msg.session_id
      sendEvent(res, 'fork_init', { newSessionId: msg.session_id, parentId: sessionId })
    }
    if (msg.type === 'result') {
      const sid = forkSessionId ?? msg.session_id
      upsertSession({
        id: sid,
        cwd,
        totalCostUsd: msg.total_cost_usd,
        turnCount: msg.num_turns,
      })
      sendEvent(res, 'fork_complete', { newSessionId: sid, parentId: sessionId })
    }
  })
})

sessionsRouter.put('/:id/rename', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const { title } = req.body as { title: string }
    await renameSession(id, title)
    db.prepare('UPDATE sessions SET label = ? WHERE id = ?').run(title, id)
    res.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: msg })
  }
})

sessionsRouter.put('/:id/tag', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const { tag } = req.body as { tag: string }
    await tagSession(id, tag)
    db.prepare('UPDATE sessions SET tag = ? WHERE id = ?').run(tag, id)
    res.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: msg })
  }
})

sessionsRouter.delete('/:id/tag', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    await tagSession(id, null)
    db.prepare('UPDATE sessions SET tag = NULL WHERE id = ?').run(id)
    res.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: msg })
  }
})
