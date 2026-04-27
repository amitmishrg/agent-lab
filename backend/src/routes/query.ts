import { Router, type Request, type Response } from 'express';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { initSSE, sendEvent, pipeSDKToSSE } from '../lib/stream-to-sse.js';
import { upsertSession, logCost } from '../db/index.js';
import { auditSDKMessage } from '../lib/audit-logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SANDBOX_DIR = process.env.SANDBOX_DIR
  ? path.resolve(process.env.SANDBOX_DIR)
  : path.resolve(__dirname, '../../sandbox');

export const queryRouter = Router();

queryRouter.post('/', (req: Request, res: Response) => {
  initSSE(res);

  const { prompt, maxTurns, cwd, allowedTools } = req.body as {
    prompt: string;
    maxTurns?: number;
    cwd?: string;
    allowedTools?: string[];
  };

  if (!prompt) {
    sendEvent(res, 'error', { error: 'prompt is required' });
    res.end();
    return;
  }

  const abortController = new AbortController();
  res.on('close', () => abortController.abort());

  const tools = allowedTools ?? [
    'Read',
    'Write',
    'Edit',
    'Bash',
    'Glob',
    'Grep',
  ];
  const workDir = cwd ?? SANDBOX_DIR;

  const q = query({
    prompt,
    options: {
      maxTurns: maxTurns ?? 10,
      cwd: workDir,
      settingSources: ['project'],
      allowedTools: tools,
      abortController,
    },
  });

  void pipeSDKToSSE(res, q, (msg) => {
    if (msg.type === 'system' && msg.subtype === 'init') {
      upsertSession({ id: msg.session_id, cwd: workDir });
    }
    if (msg.type === 'result') {
      upsertSession({
        id: msg.session_id,
        cwd: workDir,
        totalCostUsd: msg.total_cost_usd,
        turnCount: msg.num_turns,
      });
      logCost({
        sessionId: msg.session_id,
        model: Object.keys(msg.modelUsage ?? {})[0] ?? 'unknown',
        inputTokens: msg.usage?.input_tokens ?? 0,
        outputTokens: msg.usage?.output_tokens ?? 0,
        cacheReadTokens: msg.usage?.cache_read_input_tokens ?? 0,
        cacheWriteTokens: msg.usage?.cache_creation_input_tokens ?? 0,
        costUsd: msg.total_cost_usd,
      });
    }
    if (msg.type === 'assistant') {
      const sessionId =
        (msg as { session_id?: string }).session_id ?? 'unknown';
      auditSDKMessage(sessionId, msg);
    }
  });
});
