import { useEffect, useState } from 'react'

interface Session {
  sessionId?: string
  id?: string
  summary?: string
  label?: string
  tag?: string
  total_cost_usd?: number
  turn_count?: number
  lastModified?: number
  last_used?: number
}

interface SessionBrowserProps {
  selected: string | null
  onSelect: (id: string) => void
}

export function SessionBrowser({ selected, onSelect }: SessionBrowserProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [tagging, setTagging] = useState<string | null>(null)
  const [tagVal, setTagVal] = useState('')

  const load = () => {
    setLoading(true)
    fetch('/api/sessions')
      .then((r) => r.json())
      .then((d) => { setSessions(d.sessions ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const getId = (s: Session) => s.sessionId ?? s.id ?? ''
  const getLabel = (s: Session) => s.label ?? s.summary ?? getId(s).slice(0, 16) + '...'
  const getCost = (s: Session) => s.total_cost_usd ?? 0
  const getTurns = (s: Session) => s.turn_count ?? 0
  const getTime = (s: Session) => {
    const ts = s.lastModified ?? s.last_used
    return ts ? new Date(ts).toLocaleDateString() : ''
  }

  const handleRename = async (id: string) => {
    await fetch(`/api/sessions/${id}/rename`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: renameVal }),
    })
    setRenaming(null)
    setRenameVal('')
    load()
  }

  const handleTag = async (id: string) => {
    await fetch(`/api/sessions/${id}/tag`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: tagVal }),
    })
    setTagging(null)
    setTagVal('')
    load()
  }

  const handleRemoveTag = async (id: string) => {
    await fetch(`/api/sessions/${id}/tag`, { method: 'DELETE' })
    load()
  }

  if (loading) return <div className="text-gray-500 text-sm p-4">Loading sessions...</div>
  if (sessions.length === 0) return <div className="text-gray-600 text-sm p-4">No sessions yet. Run a query to create one.</div>

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs text-gray-500">{sessions.length} sessions</span>
        <button onClick={load} className="text-xs text-gray-600 hover:text-gray-400">↻ refresh</button>
      </div>
      {sessions.map((s) => {
        const id = getId(s)
        const isSelected = selected === id
        return (
          <div
            key={id}
            onClick={() => onSelect(id)}
            className={`cursor-pointer rounded-lg p-3 text-sm border transition-colors ${
              isSelected
                ? 'bg-blue-900 border-blue-600'
                : 'bg-gray-800 border-gray-700 hover:bg-gray-750 hover:border-gray-600'
            }`}
          >
            {renaming === id ? (
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <input
                  className="flex-1 text-xs bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white"
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRename(id)}
                  autoFocus
                />
                <button onClick={() => handleRename(id)} className="text-xs text-green-400 hover:text-green-300">✓</button>
                <button onClick={() => setRenaming(null)} className="text-xs text-gray-500">✕</button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-xs truncate text-gray-200">{getLabel(s)}</div>
                  {s.tag && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs bg-blue-800 text-blue-200 px-1 rounded">{s.tag}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveTag(id) }}
                        className="text-gray-600 hover:text-gray-400 text-xs"
                      >✕</button>
                    </div>
                  )}
                  <div className="flex gap-2 mt-1 text-xs text-gray-500">
                    {getCost(s) > 0 && <span>💰${getCost(s).toFixed(4)}</span>}
                    {getTurns(s) > 0 && <span>🔄{getTurns(s)}</span>}
                    {getTime(s) && <span>{getTime(s)}</span>}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => { setRenaming(id); setRenameVal(getLabel(s)) }}
                    className="text-xs text-gray-600 hover:text-gray-400 p-1"
                    title="Rename"
                  >✎</button>
                  {tagging === id ? (
                    <div className="flex gap-1">
                      <input
                        className="text-xs bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-white w-20"
                        value={tagVal}
                        onChange={(e) => setTagVal(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleTag(id)}
                        autoFocus
                        placeholder="tag..."
                      />
                      <button onClick={() => handleTag(id)} className="text-xs text-green-400">✓</button>
                      <button onClick={() => setTagging(null)} className="text-xs text-gray-500">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setTagging(id); setTagVal(s.tag ?? '') }}
                      className="text-xs text-gray-600 hover:text-gray-400 p-1"
                      title="Tag"
                    >🏷</button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
