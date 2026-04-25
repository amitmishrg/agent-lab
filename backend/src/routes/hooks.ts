import { Router, type Request, type Response } from 'express'
import { query, type HookCallback, type HookCallbackMatcher } from '@anthropic-ai/claude-agent-sdk'
import { initSSE, sendEvent, pipeSDKToSSE } from '../lib/stream-to-sse.js'
import { upsertSession, logCost, logAudit } from '../db/index.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SANDBOX_DIR = process.env.SANDBOX_DIR
  ? path.resolve(process.env.SANDBOX_DIR)
  : path.resolve(__dirname, '../../sandbox')

export const hooksRouter = Router()

hooksRouter.post('/query', (req: Request, res: Response) => {
  initSSE(res)

  const {
    prompt,
    enabledHooks = [],
    blockEnvFiles = false,
    redirectWrites = false,
    asyncLogging = false,
  } = req.body as {
    prompt: string
    enabledHooks: string[]
    blockEnvFiles: boolean
    redirectWrites: boolean
    asyncLogging: boolean
  }

  if (!prompt) {
    sendEvent(res, 'error', { error: 'prompt is required' })
    res.end()
    return
  }

  const abortController = new AbortController()
  res.on('close', () => abortController.abort())

  const hooks: Record<string, HookCallbackMatcher[]> = {}

  const preToolUseHook: HookCallback = async (input) => {
    const hookInput = input as {
      hook_event_name: string
      tool_name: string
      tool_input: Record<string, unknown>
      session_id?: string
    }

    sendEvent(res, 'hook_event', {
      hookType: 'PreToolUse',
      toolName: hookInput.tool_name,
      toolInput: hookInput.tool_input,
      timestamp: Date.now(),
    })

    logAudit({
      sessionId: hookInput.session_id ?? 'unknown',
      eventType: 'PreToolUse',
      toolName: hookInput.tool_name,
      toolInput: JSON.stringify(hookInput.tool_input),
    })

    if (blockEnvFiles) {
      const filePath = (hookInput.tool_input?.file_path as string) ?? ''
      if (filePath.endsWith('.env')) {
        sendEvent(res, 'hook_event', {
          hookType: 'PreToolUse',
          toolName: hookInput.tool_name,
          decision: 'deny',
          reason: 'Blocked: .env file access denied',
          timestamp: Date.now(),
        })
        logAudit({
          sessionId: hookInput.session_id ?? 'unknown',
          eventType: 'PreToolUse',
          toolName: hookInput.tool_name,
          hookDecision: 'deny',
        })
        return { decision: 'block', reason: 'Access to .env files is blocked' }
      }
    }

    if (redirectWrites && hookInput.tool_name === 'Write') {
      const originalPath = (hookInput.tool_input?.file_path as string) ?? ''
      const sandboxPath = path.join(SANDBOX_DIR, path.basename(originalPath))
      sendEvent(res, 'hook_event', {
        hookType: 'PreToolUse',
        toolName: hookInput.tool_name,
        decision: 'modified',
        original: originalPath,
        redirected: sandboxPath,
        timestamp: Date.now(),
      })
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          updatedInput: { ...hookInput.tool_input, file_path: sandboxPath },
        },
      }
    }

    return {}
  }

  const postToolUseHook: HookCallback = async (input) => {
    const hookInput = (input as unknown) as {
      hook_event_name: string
      tool_name: string
      tool_input: Record<string, unknown>
      tool_result: unknown
      session_id?: string
    }

    if (asyncLogging) {
      void (async () => {
        await new Promise((r) => setTimeout(r, 50))
        sendEvent(res, 'hook_event', {
          hookType: 'PostToolUse',
          toolName: hookInput.tool_name,
          async: true,
          timestamp: Date.now(),
        })
        logAudit({
          sessionId: hookInput.session_id ?? 'unknown',
          eventType: 'PostToolUse',
          toolName: hookInput.tool_name,
          toolOutput: JSON.stringify(hookInput.tool_result).slice(0, 500),
        })
      })()
      return { async_: true } as unknown as Record<string, unknown>
    }

    sendEvent(res, 'hook_event', {
      hookType: 'PostToolUse',
      toolName: hookInput.tool_name,
      timestamp: Date.now(),
    })
    logAudit({
      sessionId: hookInput.session_id ?? 'unknown',
      eventType: 'PostToolUse',
      toolName: hookInput.tool_name,
      toolOutput: JSON.stringify(hookInput.tool_result).slice(0, 500),
    })
    return {}
  }

  const userPromptSubmitHook: HookCallback = async (input) => {
    const hookInput = input as {
      hook_event_name: string
      prompt: string
      session_id?: string
    }
    sendEvent(res, 'hook_event', {
      hookType: 'UserPromptSubmit',
      prompt: hookInput.prompt?.slice(0, 100),
      timestamp: Date.now(),
    })
    return {}
  }

  const stopHook: HookCallback = async (input) => {
    const hookInput = input as {
      hook_event_name: string
      last_assistant_message?: string
      session_id?: string
    }
    sendEvent(res, 'hook_event', {
      hookType: 'Stop',
      lastMessage: hookInput.last_assistant_message?.slice(0, 200),
      timestamp: Date.now(),
    })
    return {}
  }

  const notificationHook: HookCallback = async (input) => {
    const hookInput = input as {
      hook_event_name: string
      message?: string
      session_id?: string
    }
    sendEvent(res, 'hook_event', {
      hookType: 'Notification',
      message: hookInput.message,
      timestamp: Date.now(),
    })
    return {}
  }

  const subagentStartHook: HookCallback = async (input) => {
    const hookInput = input as {
      hook_event_name: string
      agent_id?: string
      agent_type?: string
    }
    sendEvent(res, 'hook_event', {
      hookType: 'SubagentStart',
      agentId: hookInput.agent_id,
      agentType: hookInput.agent_type,
      timestamp: Date.now(),
    })
    return {}
  }

  const subagentStopHook: HookCallback = async (input) => {
    const hookInput = input as {
      hook_event_name: string
      agent_id?: string
      last_assistant_message?: string
    }
    sendEvent(res, 'hook_event', {
      hookType: 'SubagentStop',
      agentId: hookInput.agent_id,
      lastMessage: hookInput.last_assistant_message?.slice(0, 100),
      timestamp: Date.now(),
    })
    return {}
  }

  const preCompactHook: HookCallback = async (input) => {
    sendEvent(res, 'hook_event', {
      hookType: 'PreCompact',
      input,
      timestamp: Date.now(),
    })
    return {}
  }

  const hookMap: Record<string, HookCallback> = {
    PreToolUse: preToolUseHook,
    PostToolUse: postToolUseHook,
    UserPromptSubmit: userPromptSubmitHook,
    Stop: stopHook,
    Notification: notificationHook,
    SubagentStart: subagentStartHook,
    SubagentStop: subagentStopHook,
    PreCompact: preCompactHook,
  }

  for (const hookName of enabledHooks) {
    const cb = hookMap[hookName]
    if (cb) {
      hooks[hookName] = [{ hooks: [cb] }]
    }
  }

  if (!enabledHooks.includes('PreToolUse') && (blockEnvFiles || redirectWrites)) {
    hooks['PreToolUse'] = [{ hooks: [preToolUseHook] }]
  }

  const gen = query({
    prompt,
    options: {
      cwd: SANDBOX_DIR,
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      hooks,
      abortController,
    },
  })

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

hooksRouter.get('/audit/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params
  const logs = req.app.get('db')
    ?.prepare('SELECT * FROM audit_log WHERE session_id = ? ORDER BY timestamp DESC LIMIT 100')
    .all(sessionId) ?? []
  res.json({ logs })
})
