import { type Response } from 'express'
import { type SDKMessage } from '@anthropic-ai/claude-agent-sdk'

export function initSSE(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()
}

export function sendEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

export async function pipeSDKToSSE(
  res: Response,
  gen: AsyncGenerator<SDKMessage, void>,
  onMessage?: (msg: SDKMessage) => void
): Promise<void> {
  try {
    for await (const message of gen) {
      sendEvent(res, message.type, message)
      onMessage?.(message)
    }
    sendEvent(res, 'done', { done: true })
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    sendEvent(res, 'error', { error: errMsg })
  } finally {
    res.end()
  }
}
