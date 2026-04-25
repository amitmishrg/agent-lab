import { Router, type Request, type Response } from 'express'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { initSSE, sendEvent, pipeSDKToSSE } from '../lib/stream-to-sse.js'
import { upsertSession, logCost } from '../db/index.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SANDBOX_DIR = process.env.SANDBOX_DIR
  ? path.resolve(process.env.SANDBOX_DIR)
  : path.resolve(__dirname, '../../sandbox')

interface CheckpointSession {
  query: ReturnType<typeof query>
  userMessageIds: string[]
}

const activeSessions = new Map<string, CheckpointSession>()

export const checkpointingRouter = Router()

checkpointingRouter.get('/files', (_req: Request, res: Response) => {
  try {
    const files = fs.readdirSync(SANDBOX_DIR).map((name) => {
      const filePath = path.join(SANDBOX_DIR, name)
      const stat = fs.statSync(filePath)
      if (stat.isFile()) {
        return {
          name,
          path: filePath,
          size: stat.size,
          modified: stat.mtimeMs,
          content: fs.readFileSync(filePath, 'utf-8').slice(0, 2000),
        }
      }
      return null
    }).filter(Boolean)
    res.json({ files })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: msg })
  }
})

checkpointingRouter.post('/query', (req: Request, res: Response) => {
  initSSE(res)

  const { prompt } = req.body as { prompt: string }

  if (!prompt) {
    sendEvent(res, 'error', { error: 'prompt is required' })
    res.end()
    return
  }

  const abortController = new AbortController()
  res.on('close', () => abortController.abort())

  const gen = query({
    prompt,
    options: {
      cwd: SANDBOX_DIR,
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      enableFileCheckpointing: true,
      abortController,
    },
  })

  let sessionId: string | undefined

  void pipeSDKToSSE(res, gen, (msg) => {
    if (msg.type === 'system' && msg.subtype === 'init') {
      sessionId = msg.session_id
      const existing = activeSessions.get(sessionId)
      if (!existing) {
        activeSessions.set(sessionId, { query: gen, userMessageIds: [] })
      }
      upsertSession({ id: msg.session_id, cwd: SANDBOX_DIR })
    }

    if (msg.type === 'user') {
      const userMsg = msg as { uuid?: string }
      if (userMsg.uuid && sessionId) {
        const session = activeSessions.get(sessionId)
        if (session) {
          session.userMessageIds.push(userMsg.uuid)
          sendEvent(res, 'checkpoint', {
            userMessageId: userMsg.uuid,
            index: session.userMessageIds.length - 1,
          })
        }
      }
    }

    if (msg.type === 'system' && msg.subtype === 'files_persisted') {
      sendEvent(res, 'files_persisted', {
        files: msg.files,
        failed: msg.failed,
      })
    }

    if (msg.type === 'result') {
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
      if (sessionId) {
        const session = activeSessions.get(sessionId)
        if (session) {
          sendEvent(res, 'checkpoints', { userMessageIds: session.userMessageIds })
        }
      }
    }
  })
})

checkpointingRouter.post('/rewind', async (req: Request, res: Response) => {
  const { sessionId, userMessageId, dryRun = false } = req.body as {
    sessionId: string
    userMessageId: string
    dryRun: boolean
  }

  const session = activeSessions.get(sessionId)
  if (!session) {
    res.status(404).json({ error: 'Session not found. Run a checkpointing query first.' })
    return
  }

  try {
    const q = session.query as unknown as {
      rewindFiles: (id: string, opts?: { dryRun?: boolean }) => Promise<{
        canRewind: boolean
        error?: string
        filesChanged?: string[]
        insertions?: number
        deletions?: number
      }>
    }
    const result = await q.rewindFiles(userMessageId, { dryRun })
    res.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: msg })
  }
})

checkpointingRouter.get('/checkpoints/:sessionId', (req: Request, res: Response) => {
  const session = activeSessions.get(req.params.sessionId as string)
  if (!session) {
    res.json({ userMessageIds: [] })
    return
  }
  res.json({ userMessageIds: session.userMessageIds })
})
