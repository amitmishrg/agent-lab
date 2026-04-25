import { Router, type Request, type Response } from 'express'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { initSSE, sendEvent, pipeSDKToSSE } from '../lib/stream-to-sse.js'
import { upsertSession, logCost } from '../db/index.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SANDBOX_DIR = process.env.SANDBOX_DIR
  ? path.resolve(process.env.SANDBOX_DIR)
  : path.resolve(__dirname, '../../sandbox')

const SCHEMAS: Record<string, Record<string, unknown>> = {
  bug_report: {
    type: 'object',
    properties: {
      bugs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            file: { type: 'string' },
            line: { type: 'number' },
            severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
            description: { type: 'string' },
            suggested_fix: { type: 'string' },
          },
          required: ['file', 'line', 'severity', 'description', 'suggested_fix'],
        },
      },
      summary: { type: 'string' },
      total_issues: { type: 'number' },
    },
    required: ['bugs', 'summary', 'total_issues'],
  },
  code_review: {
    type: 'object',
    properties: {
      overall_score: { type: 'number', minimum: 1, maximum: 10 },
      strengths: { type: 'array', items: { type: 'string' } },
      issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: { type: 'string' },
            description: { type: 'string' },
            priority: { type: 'string' },
          },
          required: ['category', 'description', 'priority'],
        },
      },
      recommended_actions: { type: 'array', items: { type: 'string' } },
    },
    required: ['overall_score', 'strengths', 'issues', 'recommended_actions'],
  },
  todos: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            estimated_hours: { type: 'number' },
            priority: { type: 'string', enum: ['urgent', 'normal', 'low'] },
          },
          required: ['title', 'description', 'estimated_hours', 'priority'],
        },
      },
      total_hours: { type: 'number' },
    },
    required: ['tasks', 'total_hours'],
  },
}

const DEFAULT_PROMPTS: Record<string, string> = {
  bug_report: 'Analyze sandbox/buggy.ts for bugs and issues. Return results in the structured format.',
  code_review: 'Review the code quality of sandbox/demo.ts. Provide a structured code review.',
  todos: 'What tasks are needed to improve the sandbox project? Create a structured TODO list.',
}

export const structuredRouter = Router()

structuredRouter.get('/schemas', (_req: Request, res: Response) => {
  res.json({ schemas: SCHEMAS, defaultPrompts: DEFAULT_PROMPTS })
})

structuredRouter.post('/query', (req: Request, res: Response) => {
  initSSE(res)

  const { prompt, schemaName } = req.body as {
    prompt?: string
    schemaName: 'bug_report' | 'code_review' | 'todos'
  }

  const schema = SCHEMAS[schemaName]
  if (!schema) {
    sendEvent(res, 'error', { error: `Unknown schema: ${schemaName}` })
    res.end()
    return
  }

  const finalPrompt = prompt ?? DEFAULT_PROMPTS[schemaName]
  const abortController = new AbortController()
  res.on('close', () => abortController.abort())

  const gen = query({
    prompt: finalPrompt,
    options: {
      cwd: SANDBOX_DIR,
      allowedTools: ['Read', 'Glob', 'Grep'],
      outputFormat: {
        type: 'json_schema',
        schema,
      },
      abortController,
    },
  })

  void pipeSDKToSSE(res, gen, (msg) => {
    if (msg.type === 'result') {
      if (msg.subtype === 'success' && msg.structured_output) {
        sendEvent(res, 'structured_result', {
          schemaName,
          data: msg.structured_output,
        })
      }
      if (msg.subtype === 'error_max_structured_output_retries') {
        sendEvent(res, 'structured_error', {
          error: 'Max structured output retries exceeded',
          errors: (msg as { errors?: string[] }).errors,
        })
      }
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
