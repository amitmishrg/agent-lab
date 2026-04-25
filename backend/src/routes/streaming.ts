import { Router, type Request, type Response } from 'express'
import { query, type SDKUserMessage, type PermissionMode } from '@anthropic-ai/claude-agent-sdk'
import { initSSE, sendEvent } from '../lib/stream-to-sse.js'
import { upsertSession, logCost } from '../db/index.js'
import { randomUUID } from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SANDBOX_DIR = process.env.SANDBOX_DIR
  ? path.resolve(process.env.SANDBOX_DIR)
  : path.resolve(__dirname, '../../sandbox')

interface StreamingSession {
  sessionId: string
  queryRef: ReturnType<typeof query> | null
  messageQueue: SDKUserMessage[]
  resolveNext: (() => void) | null
  permissionMode: PermissionMode
  model?: string
  createdAt: number
}

const streamingSessions = new Map<string, StreamingSession>()

async function* messageQueueIterable(
  session: StreamingSession
): AsyncGenerator<SDKUserMessage> {
  while (true) {
    if (session.messageQueue.length > 0) {
      yield session.messageQueue.shift()!
    } else {
      await new Promise<void>((resolve) => {
        session.resolveNext = resolve
      })
      session.resolveNext = null
    }
  }
}

export const streamingRouter = Router()

streamingRouter.post('/start', (_req: Request, res: Response) => {
  const sessionId = randomUUID()
  streamingSessions.set(sessionId, {
    sessionId,
    queryRef: null,
    messageQueue: [],
    resolveNext: null,
    permissionMode: 'default',
    createdAt: Date.now(),
  })
  res.json({ sessionId })
})

streamingRouter.post('/send', (req: Request, res: Response) => {
  initSSE(res)

  const { sessionId, message, model, permissionMode } = req.body as {
    sessionId: string
    message: string
    model?: string
    permissionMode?: PermissionMode
  }

  if (!sessionId || !message) {
    sendEvent(res, 'error', { error: 'sessionId and message required' })
    res.end()
    return
  }

  let session = streamingSessions.get(sessionId)
  if (!session) {
    session = {
      sessionId,
      queryRef: null,
      messageQueue: [],
      resolveNext: null,
      permissionMode: 'default',
      createdAt: Date.now(),
    }
    streamingSessions.set(sessionId, session)
  }

  if (permissionMode) session.permissionMode = permissionMode
  if (model) session.model = model

  const abortController = new AbortController()
  res.on('close', () => abortController.abort())

  const userMsg: SDKUserMessage = {
    type: 'user',
    message: {
      role: 'user',
      content: message,
    },
    parent_tool_use_id: null,
  }

  if (session.queryRef === null) {
    const iterable = messageQueueIterable(session)
    session.messageQueue.push(userMsg)

    const queryOptions: Parameters<typeof query>[0]['options'] = {
      cwd: SANDBOX_DIR,
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      permissionMode: session.permissionMode,
      abortController,
    }

    const q = query({ prompt: iterable, options: queryOptions })
    session.queryRef = q

    void (async () => {
      try {
        for await (const msg of q) {
          sendEvent(res, msg.type, msg)
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
            sendEvent(res, 'done', { done: true })
            res.end()
            return
          }
        }
        sendEvent(res, 'done', { done: true })
        res.end()
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        sendEvent(res, 'error', { error: errMsg })
        res.end()
      }
    })()
  } else {
    session.messageQueue.push(userMsg)
    session.resolveNext?.()

    void (async () => {
      try {
        if (!session!.queryRef) {
          res.end()
          return
        }
        for await (const msg of session!.queryRef) {
          sendEvent(res, msg.type, msg)
          if (msg.type === 'result') {
            upsertSession({
              id: msg.session_id,
              cwd: SANDBOX_DIR,
              totalCostUsd: msg.total_cost_usd,
              turnCount: msg.num_turns,
            })
            sendEvent(res, 'done', { done: true })
            res.end()
            return
          }
        }
        sendEvent(res, 'done', { done: true })
        res.end()
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        sendEvent(res, 'error', { error: errMsg })
        res.end()
      }
    })()
  }
})

streamingRouter.delete('/:sessionId', (req: Request, res: Response) => {
  const sid = req.params.sessionId as string
  const session = streamingSessions.get(sid)
  if (session?.queryRef) {
    session.queryRef.return(undefined)
  }
  streamingSessions.delete(sid)
  res.json({ ok: true })
})

streamingRouter.put('/:sessionId/model', async (req: Request, res: Response) => {
  const session = streamingSessions.get(req.params.sessionId as string)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }
  const { model } = req.body as { model: string }
  if (session.queryRef) {
    try {
      await (session.queryRef as unknown as { setModel: (m: string) => Promise<void> }).setModel(model)
    } catch {
      // ignore
    }
  }
  session.model = model
  res.json({ ok: true })
})

streamingRouter.put('/:sessionId/permission-mode', async (req: Request, res: Response) => {
  const session = streamingSessions.get(req.params.sessionId as string)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }
  const { mode } = req.body as { mode: PermissionMode }
  if (session.queryRef) {
    try {
      await (session.queryRef as unknown as { setPermissionMode: (m: PermissionMode) => Promise<void> }).setPermissionMode(mode)
    } catch {
      // ignore
    }
  }
  session.permissionMode = mode
  res.json({ ok: true })
})
