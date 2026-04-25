import { Router, type Request, type Response } from 'express'
import { query, type PermissionMode, type PermissionResult } from '@anthropic-ai/claude-agent-sdk'
import { initSSE, sendEvent, pipeSDKToSSE } from '../lib/stream-to-sse.js'
import { upsertSession, logCost } from '../db/index.js'
import { randomUUID } from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SANDBOX_DIR = process.env.SANDBOX_DIR
  ? path.resolve(process.env.SANDBOX_DIR)
  : path.resolve(__dirname, '../../sandbox')

interface PendingDecision {
  resolve: (result: PermissionResult) => void
  toolName: string
  toolInput: unknown
  sseRes: Response
}

const pendingDecisions = new Map<string, PendingDecision>()

export const permissionsRouter = Router()

permissionsRouter.post('/query', (req: Request, res: Response) => {
  initSSE(res)

  const { prompt, mode, allowedTools, disallowedTools } = req.body as {
    prompt: string
    mode: PermissionMode
    allowedTools?: string[]
    disallowedTools?: string[]
  }

  if (!prompt) {
    sendEvent(res, 'error', { error: 'prompt is required' })
    res.end()
    return
  }

  const abortController = new AbortController()
  res.on('close', () => abortController.abort())

  const options: Parameters<typeof query>[0]['options'] = {
    cwd: SANDBOX_DIR,
    allowedTools: allowedTools ?? ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
    disallowedTools: disallowedTools ?? [],
    permissionMode: mode,
    abortController,
  }

  if (mode === 'default') {
    options.canUseTool = async (toolName, toolInput, { signal }) => {
      const requestId = randomUUID()
      return new Promise<PermissionResult>((resolve) => {
        sendEvent(res, 'permission_request', {
          requestId,
          toolName,
          toolInput,
        })

        pendingDecisions.set(requestId, {
          resolve,
          toolName,
          toolInput,
          sseRes: res,
        })

        signal?.addEventListener('abort', () => {
          pendingDecisions.delete(requestId)
          resolve({ behavior: 'deny', message: 'Aborted' })
        })
      })
    }
  }

  const gen = query({ prompt, options })

  void pipeSDKToSSE(res, gen, (msg) => {
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
    }
  })
})

permissionsRouter.post('/decision/:requestId', (req: Request, res: Response) => {
  const requestId = req.params.requestId as string
  const { allow } = req.body as { allow: boolean }

  const pending = pendingDecisions.get(requestId)
  if (!pending) {
    res.status(404).json({ error: 'Request not found or already resolved' })
    return
  }

  pendingDecisions.delete(requestId)
  const result: PermissionResult = allow
    ? { behavior: 'allow' }
    : { behavior: 'deny', message: 'Denied by user' }
  pending.resolve(result)

  const decision = allow ? 'allow' : 'deny'
  sendEvent(pending.sseRes, 'permission_decision', {
    requestId,
    decision,
    toolName: pending.toolName,
  })

  res.json({ ok: true, decision })
})
