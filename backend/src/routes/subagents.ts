import { Router, type Request, type Response } from 'express'
import { query, type AgentDefinition } from '@anthropic-ai/claude-agent-sdk'
import { initSSE, sendEvent, pipeSDKToSSE } from '../lib/stream-to-sse.js'
import { upsertSession, logCost } from '../db/index.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SANDBOX_DIR = process.env.SANDBOX_DIR
  ? path.resolve(process.env.SANDBOX_DIR)
  : path.resolve(__dirname, '../../sandbox')

const PRESETS: Record<string, { prompt: string; agents: Record<string, AgentDefinition> }> = {
  'code-review-team': {
    prompt: 'Review the sandbox directory comprehensively: check code quality, security issues, and test coverage. Use the code-reviewer, security-scanner, and test-runner agents.',
    agents: {
      'code-reviewer': {
        description: 'Expert code reviewer for quality and style improvements.',
        prompt: 'You are an expert code reviewer. Analyze code quality, style, and maintainability. Check for code smells, poor patterns, and opportunities for improvement.',
        tools: ['Read', 'Glob', 'Grep'],
      },
      'security-scanner': {
        description: 'Security expert who finds vulnerabilities.',
        prompt: 'You are a security expert. Scan code for vulnerabilities, unsafe patterns, injection risks, and security anti-patterns.',
        tools: ['Read', 'Grep'],
      },
      'test-runner': {
        description: 'Test specialist who checks test coverage.',
        prompt: 'You are a testing expert. Check for test coverage, test quality, and missing test cases.',
        tools: ['Bash', 'Read'],
      },
    },
  },
  'research-team': {
    prompt: 'Research the Claude Agent SDK: search for documentation, summarize key features, and explain how to use it effectively.',
    agents: {
      'web-researcher': {
        description: 'Web researcher who finds and collects information.',
        prompt: 'You are a web researcher. Search the web for information and fetch relevant pages.',
        tools: ['WebSearch', 'WebFetch'],
      },
      summarizer: {
        description: 'Expert at distilling and summarizing information.',
        prompt: 'You are a summarization expert. Take information and distill it into clear, concise summaries.',
        tools: ['Read'],
      },
    },
  },
}

export const subagentsRouter = Router()

subagentsRouter.get('/presets', (_req: Request, res: Response) => {
  res.json({
    presets: Object.entries(PRESETS).map(([id, p]) => ({
      id,
      prompt: p.prompt,
      agents: Object.keys(p.agents),
    })),
  })
})

subagentsRouter.post('/query', (req: Request, res: Response) => {
  initSSE(res)

  const { prompt, preset, agents: customAgents } = req.body as {
    prompt?: string
    preset?: string
    agents?: Record<string, AgentDefinition>
  }

  const abortController = new AbortController()
  res.on('close', () => abortController.abort())

  let finalPrompt: string
  let agents: Record<string, AgentDefinition>

  if (preset && PRESETS[preset]) {
    finalPrompt = prompt ?? PRESETS[preset].prompt
    agents = PRESETS[preset].agents
  } else if (customAgents) {
    finalPrompt = prompt ?? 'Complete the assigned task.'
    agents = customAgents
  } else {
    sendEvent(res, 'error', { error: 'Must provide preset or agents' })
    res.end()
    return
  }

  const agentNames = Object.keys(agents)
  sendEvent(res, 'subagent_config', { agents: agentNames, prompt: finalPrompt })

  const gen = query({
    prompt: finalPrompt,
    options: {
      cwd: SANDBOX_DIR,
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Agent', 'WebSearch', 'WebFetch'],
      agents,
      abortController,
      hooks: {
        SubagentStart: [
          {
            hooks: [
              async (input) => {
                const hookInput = input as { agent_id?: string; agent_type?: string }
                sendEvent(res, 'subagent_spawn', {
                  agentId: hookInput.agent_id,
                  agentType: hookInput.agent_type,
                  timestamp: Date.now(),
                })
                return {}
              },
            ],
          },
        ],
        SubagentStop: [
          {
            hooks: [
              async (input) => {
                const hookInput = input as {
                  agent_id?: string
                  last_assistant_message?: string
                }
                sendEvent(res, 'subagent_done', {
                  agentId: hookInput.agent_id,
                  summary: hookInput.last_assistant_message?.slice(0, 200),
                  timestamp: Date.now(),
                })
                return {}
              },
            ],
          },
        ],
      },
    },
  })

  void pipeSDKToSSE(res, gen, (msg) => {
    if (msg.type === 'assistant') {
      const assistantMsg = msg as {
        parent_tool_use_id?: string
        session_id?: string
      }
      if (assistantMsg.parent_tool_use_id) {
        sendEvent(res, 'subagent_message', {
          parentToolUseId: assistantMsg.parent_tool_use_id,
        })
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
