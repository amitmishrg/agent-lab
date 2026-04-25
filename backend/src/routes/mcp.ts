import { Router, type Request, type Response } from 'express'
import { query, type McpServerConfig } from '@anthropic-ai/claude-agent-sdk'
import { initSSE, sendEvent, pipeSDKToSSE } from '../lib/stream-to-sse.js'
import { upsertSession, logCost } from '../db/index.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SANDBOX_DIR = process.env.SANDBOX_DIR
  ? path.resolve(process.env.SANDBOX_DIR)
  : path.resolve(__dirname, '../../sandbox')

export const mcpRouter = Router()

mcpRouter.get('/status', (_req: Request, res: Response) => {
  res.json({ servers: ['filesystem', 'github'], sandboxDir: SANDBOX_DIR })
})

mcpRouter.post('/query', (req: Request, res: Response) => {
  initSSE(res)

  const { prompt, servers = [], githubToken } = req.body as {
    prompt: string
    servers: string[]
    githubToken?: string
  }

  if (!prompt) {
    sendEvent(res, 'error', { error: 'prompt is required' })
    res.end()
    return
  }

  const abortController = new AbortController()
  res.on('close', () => abortController.abort())

  const mcpServers: Record<string, McpServerConfig> = {}
  const allowedTools: string[] = ['Read', 'Glob', 'Grep']

  if (servers.includes('filesystem')) {
    mcpServers['filesystem'] = {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', SANDBOX_DIR],
    }
    allowedTools.push('mcp__filesystem__*')
  }

  if (servers.includes('github')) {
    if (!githubToken) {
      sendEvent(res, 'mcp_error', {
        server: 'github',
        error: 'GitHub token required. Set GITHUB_TOKEN.',
      })
    }
    mcpServers['github'] = {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { GITHUB_TOKEN: githubToken ?? '' },
    }
    allowedTools.push('mcp__github__*')
  }

  const gen = query({
    prompt,
    options: {
      cwd: SANDBOX_DIR,
      allowedTools,
      mcpServers,
      abortController,
    },
  })

  void pipeSDKToSSE(res, gen, (msg) => {
    if (msg.type === 'system' && msg.subtype === 'init') {
      const serverStatuses = msg.mcp_servers ?? []
      sendEvent(res, 'mcp_status', { servers: serverStatuses })
      upsertSession({ id: msg.session_id, cwd: SANDBOX_DIR })
    }
    if (msg.type === 'assistant') {
      const content = msg.message?.content
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_use' && (block.name as string).startsWith('mcp__')) {
            const parts = (block.name as string).split('__')
            sendEvent(res, 'mcp_tool_call', {
              server: parts[1],
              tool: parts.slice(2).join('__'),
              fullName: block.name,
              input: block.input,
            })
          }
        }
      }
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
    }
  })
})
