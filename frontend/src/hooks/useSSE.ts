import { useState, useEffect, useRef, useCallback } from 'react'

export interface SSEMessage {
  event: string
  data: unknown
}

export type SSEStatus = 'idle' | 'streaming' | 'done' | 'error'

interface UsePostSSEOptions {
  onMessage?: (event: string, data: unknown) => void
}

interface UsePostSSEResult {
  messages: SSEMessage[]
  status: SSEStatus
  error: string | null
  run: (url: string, body: unknown) => void
  clear: () => void
}

export function usePostSSE(options?: UsePostSSEOptions): UsePostSSEResult {
  const [messages, setMessages] = useState<SSEMessage[]>([])
  const [status, setStatus] = useState<SSEStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const onMessageRef = useRef(options?.onMessage)
  onMessageRef.current = options?.onMessage

  const clear = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setMessages([])
    setStatus('idle')
    setError(null)
  }, [])

  const run = useCallback((url: string, body: unknown) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setMessages([])
    setStatus('streaming')
    setError(null)

    void (async () => {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          const text = await res.text()
          throw new Error(`HTTP ${res.status}: ${text}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let pendingEvent = 'message'

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const parts = buffer.split('\n')
          buffer = parts.pop() ?? ''

          for (const line of parts) {
            if (line.startsWith('event: ')) {
              pendingEvent = line.slice(7).trim()
            } else if (line.startsWith('data: ')) {
              const rawData = line.slice(6)
              let parsed: unknown
              try { parsed = JSON.parse(rawData) } catch { parsed = rawData }

              const evt = pendingEvent
              pendingEvent = 'message'

              if (evt === 'done') {
                setStatus('done')
                return
              }

              if (evt === 'error') {
                const errData = parsed as { error?: string }
                setError(errData?.error ?? 'Unknown error')
                setStatus('error')
                return
              }

              setMessages((prev) => [...prev, { event: evt, data: parsed }])
              onMessageRef.current?.(evt, parsed)
            } else if (line === '') {
              pendingEvent = 'message'
            }
          }
        }

        setStatus((prev) => prev === 'streaming' ? 'done' : prev)
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === 'AbortError') return
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        setStatus('error')
      }
    })()
  }, [])

  useEffect(() => () => { abortRef.current?.abort() }, [])

  return { messages, status, error, run, clear }
}

export interface UseSSEResult {
  messages: SSEMessage[]
  status: SSEStatus
  error: string | null
  clear: () => void
}

export function useSSE(url: string | null, options?: { onMessage?: (e: string, d: unknown) => void }): UseSSEResult {
  const [messages, setMessages] = useState<SSEMessage[]>([])
  const [status, setStatus] = useState<SSEStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const onMessageRef = useRef(options?.onMessage)
  onMessageRef.current = options?.onMessage

  const clear = useCallback(() => {
    setMessages([])
    setStatus('idle')
    setError(null)
  }, [])

  useEffect(() => {
    if (!url) return
    esRef.current?.close()
    setStatus('streaming')
    setMessages([])
    setError(null)

    const es = new EventSource(url)
    esRef.current = es

    const handleMsg = (eventType: string) => (e: MessageEvent) => {
      let parsed: unknown
      try { parsed = JSON.parse(e.data as string) } catch { parsed = e.data }
      setMessages((prev) => [...prev, { event: eventType, data: parsed }])
      onMessageRef.current?.(eventType, parsed)
    }

    const events = ['system','assistant','user','result','hook_event','subagent_spawn','subagent_done','subagent_message','mcp_status','mcp_tool_call','mcp_error','custom_tool_call','structured_result','structured_error','checkpoint','checkpoints','files_persisted','budget_result','timing','meta','permission_request','permission_decision','fork_init','fork_complete','subagent_config']
    for (const evt of events) es.addEventListener(evt, handleMsg(evt))
    es.addEventListener('done', () => { setStatus('done'); es.close() })
    es.addEventListener('error', (e: MessageEvent) => {
      let parsed: unknown
      try { parsed = JSON.parse(e.data as string) } catch { parsed = { error: 'SSE error' } }
      setError((parsed as { error?: string })?.error ?? 'SSE error')
      setStatus('error')
      es.close()
    })
    es.onerror = () => { if (es.readyState === EventSource.CLOSED) setStatus((p) => p === 'streaming' ? 'done' : p) }

    return () => { es.close(); esRef.current = null }
  }, [url])

  return { messages, status, error, clear }
}
