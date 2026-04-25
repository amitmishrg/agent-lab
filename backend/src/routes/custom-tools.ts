import { Router, type Request, type Response } from 'express'
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { initSSE, sendEvent, pipeSDKToSSE } from '../lib/stream-to-sse.js'
import { upsertSession, logCost } from '../db/index.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SANDBOX_DIR = process.env.SANDBOX_DIR
  ? path.resolve(process.env.SANDBOX_DIR)
  : path.resolve(__dirname, '../../sandbox')

const weatherTool = tool(
  'weather',
  'Get current weather for a city',
  { city: z.string().describe('City name to get weather for') },
  async ({ city }) => {
    try {
      const resp = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json() as {
        current_condition?: Array<{
          temp_C?: string
          weatherDesc?: Array<{ value?: string }>
          humidity?: string
        }>
      }
      const cond = data.current_condition?.[0]
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              city,
              temperature_c: cond?.temp_C,
              condition: cond?.weatherDesc?.[0]?.value,
              humidity: cond?.humidity,
            }),
          },
        ],
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true }
    }
  }
)

const jokeTool = tool(
  'random_joke',
  'Get a random joke by category',
  { category: z.enum(['programming', 'general']).describe('Joke category') },
  async ({ category }) => {
    try {
      const url =
        category === 'programming'
          ? 'https://official-joke-api.appspot.com/jokes/programming/random'
          : 'https://official-joke-api.appspot.com/jokes/general/random'
      const resp = await fetch(url)
      const data = await resp.json() as Array<{ setup?: string; punchline?: string }>
      const joke = Array.isArray(data) ? data[0] : data
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ setup: joke.setup, punchline: joke.punchline }),
          },
        ],
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true }
    }
  }
)

const countWordsTool = tool(
  'count_words',
  'Count words, characters, and sentences in text',
  { text: z.string().describe('Text to analyze') },
  async ({ text }) => {
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
    const charCount = text.length
    const sentenceCount = (text.match(/[.!?]+/g) ?? []).length
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ word_count: wordCount, char_count: charCount, sentence_count: sentenceCount }),
        },
      ],
    }
  },
  {
    annotations: {
      readOnlyHint: true,
    },
  }
)

const sdkServer = createSdkMcpServer({
  name: 'agent-lab-tools',
  tools: [weatherTool, jokeTool, countWordsTool],
})

export const TOOL_DEFINITIONS = [
  {
    name: 'weather',
    description: 'Get current weather for a city',
    schema: { city: 'string' },
    code: `tool('weather', 'Get current weather for a city',
  { city: z.string() },
  async ({ city }) => {
    const resp = await fetch(\`https://wttr.in/\${city}?format=j1\`)
    const data = await resp.json()
    // returns temperature, condition, humidity
  }
)`,
  },
  {
    name: 'random_joke',
    description: 'Get a random joke by category',
    schema: { category: "'programming' | 'general'" },
    code: `tool('random_joke', 'Get a random joke',
  { category: z.enum(['programming', 'general']) },
  async ({ category }) => {
    const resp = await fetch('https://official-joke-api.appspot.com/...')
    // returns setup + punchline
  }
)`,
  },
  {
    name: 'count_words',
    description: 'Count words, characters, sentences (readOnly)',
    schema: { text: 'string' },
    code: `tool('count_words', 'Count words in text',
  { text: z.string() },
  async ({ text }) => ({
    word_count, char_count, sentence_count
  }),
  { annotations: { readOnlyHint: true } }
)`,
  },
]

export const customToolsRouter = Router()

customToolsRouter.get('/definitions', (_req: Request, res: Response) => {
  res.json({ tools: TOOL_DEFINITIONS })
})

customToolsRouter.post('/query', (req: Request, res: Response) => {
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
      allowedTools: ['mcp__agent-lab-tools__*'],
      mcpServers: { 'agent-lab-tools': sdkServer },
      abortController,
    },
  })

  void pipeSDKToSSE(res, gen, (msg) => {
    if (msg.type === 'assistant') {
      const content = msg.message?.content
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_use' && (block.name as string).startsWith('mcp__agent-lab-tools__')) {
            const toolName = (block.name as string).replace('mcp__agent-lab-tools__', '')
            const def = TOOL_DEFINITIONS.find((t) => t.name === toolName)
            sendEvent(res, 'custom_tool_call', {
              toolName,
              input: block.input,
              definition: def,
              timestamp: Date.now(),
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
