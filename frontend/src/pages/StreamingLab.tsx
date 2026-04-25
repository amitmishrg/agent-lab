import { useState, useRef, useEffect } from 'react'
import { usePostSSE } from '../hooks/useSSE'
import { CostMeter } from '../components/CostMeter'
import { HowItWorks } from '../components/HowItWorks'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export function StreamingLab() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [turnCount, setTurnCount] = useState(0)
  const [model, setModel] = useState('claude-sonnet-4-5')
  const [permMode, setPermMode] = useState<string>('acceptEdits')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages: sseMessages, status, run, clear } = usePostSSE({
    onMessage: (evt, data) => {
      if (evt === 'assistant') {
        const content = (data as { message?: { content?: Array<{ type: string; text?: string }> } })?.message?.content
        const text = content?.filter((b) => b.type === 'text').map((b) => b.text).join('') ?? ''
        if (text) {
          setChatMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last?.role === 'assistant') {
              return [...prev.slice(0, -1), { ...last, content: last.content + text }]
            }
            return [...prev, { role: 'assistant', content: text, timestamp: Date.now() }]
          })
        }
      }
      if (evt === 'result') {
        setTurnCount((n) => n + 1)
      }
    },
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const ensureSession = async (): Promise<string> => {
    if (sessionId) return sessionId
    const res = await fetch('/api/streaming/start', { method: 'POST' })
    const d = await res.json() as { sessionId: string }
    setSessionId(d.sessionId)
    return d.sessionId
  }

  const handleSend = async () => {
    if (!input.trim() || status === 'streaming') return
    const msg = input.trim()
    setInput('')
    setChatMessages((prev) => [...prev, { role: 'user', content: msg, timestamp: Date.now() }])

    const sid = await ensureSession()
    run('/api/streaming/send', {
      sessionId: sid,
      message: msg,
      model,
      permissionMode: permMode,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const handleClear = async () => {
    if (sessionId) {
      await fetch(`/api/streaming/${sessionId}`, { method: 'DELETE' }).catch(() => {})
    }
    setSessionId(null)
    setChatMessages([])
    setTurnCount(0)
    clear()
  }

  const handleModelChange = async (newModel: string) => {
    setModel(newModel)
    if (sessionId) {
      await fetch(`/api/streaming/${sessionId}/model`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: newModel }),
      }).catch(() => {})
    }
  }

  const handlePermModeChange = async (newMode: string) => {
    setPermMode(newMode)
    if (sessionId) {
      await fetch(`/api/streaming/${sessionId}/permission-mode`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      }).catch(() => {})
    }
  }

  return (
    <div className="flex flex-col h-full p-6 max-w-3xl mx-auto w-full">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white mb-1">💬 Streaming Lab</h1>
        <p className="text-gray-400 text-sm">
          Demonstrates streaming input mode for multi-turn conversations
        </p>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-3 mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Turn:</span>
            <span className="text-white font-mono font-medium">{turnCount}</span>
          </div>
          {sessionId && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Session:</span>
              <code className="text-blue-300 font-mono">{sessionId.slice(0, 12)}...</code>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">Model:</span>
            <select
              value={model}
              onChange={(e) => handleModelChange(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-gray-200 text-xs focus:outline-none"
            >
              <option value="claude-sonnet-4-5">Sonnet 4.5</option>
              <option value="claude-haiku-4-5">Haiku 4.5</option>
              <option value="claude-opus-4-7">Opus 4.7</option>
            </select>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">Permission:</span>
            <select
              value={permMode}
              onChange={(e) => handlePermModeChange(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-gray-200 text-xs focus:outline-none"
            >
              <option value="acceptEdits">acceptEdits</option>
              <option value="dontAsk">dontAsk</option>
              <option value="plan">plan</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CostMeter messages={sseMessages} status={status} />
          {chatMessages.length > 0 && (
            <button onClick={handleClear} className="px-3 py-1 bg-gray-700 text-gray-400 text-xs rounded hover:bg-gray-600">
              Clear session
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 mb-4 space-y-3">
        {chatMessages.length === 0 ? (
          <div className="text-center text-gray-600 text-sm py-12">
            <div className="text-4xl mb-3">💬</div>
            <div>Start a conversation. Each message maintains full context.</div>
            <div className="text-xs mt-2 text-gray-700">Try: "What files are in the sandbox?" then follow-up with "Describe the first one"</div>
          </div>
        ) : (
          chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-700 text-gray-100 rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        {status === 'streaming' && (
          <div className="flex justify-start">
            <div className="bg-gray-700 rounded-2xl px-4 py-3 text-sm text-gray-400 rounded-bl-sm">
              <span className="animate-pulse">Claude is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
          className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-600 focus:outline-none resize-none"
          disabled={status === 'streaming'}
        />
        <button
          onClick={() => void handleSend()}
          disabled={status === 'streaming' || !input.trim()}
          className="self-end px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
        >
          {status === 'streaming' ? '⟳' : '↑'}
        </button>
      </div>

      <HowItWorks
        feature="Streaming Input — Multi-turn conversations"
        sdkApi="query({ prompt: asyncIterable<SDKUserMessage>, options }) — stream messages into a running session"
        description="Pass an AsyncIterable<SDKUserMessage> as the prompt to stream messages into an ongoing session. The agent reads messages as they arrive, maintaining full conversation context. Each turn adds to the shared history automatically."
        whyUseIt="Essential for chat interfaces, interactive agents, and any multi-turn workflow where you don't know all messages upfront. Use setModel() and setPermissionMode() on the Query object to change settings mid-session."
        docsUrl="https://docs.anthropic.com/en/api/agent-sdk/typescript"
      />
    </div>
  )
}
