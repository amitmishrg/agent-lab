import { logAudit } from '../db/index.js'
import { type SDKMessage } from '@anthropic-ai/claude-agent-sdk'

export function auditSDKMessage(sessionId: string, msg: SDKMessage): void {
  if (msg.type === 'assistant') {
    const content = msg.message?.content
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'tool_use') {
          logAudit({
            sessionId,
            eventType: 'tool_use',
            toolName: block.name,
            toolInput: JSON.stringify(block.input),
          })
        }
      }
    }
    logAudit({ sessionId, eventType: 'assistant_message' })
  } else if (msg.type === 'result') {
    logAudit({
      sessionId,
      eventType: `result_${msg.subtype}`,
    })
  }
}
