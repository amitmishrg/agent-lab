import Database, { type Database as DatabaseType } from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(__dirname, '../../data/agent-lab.db')

const dataDir = path.dirname(DB_PATH)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

export const db: DatabaseType = new Database(DB_PATH)

export function initDB(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      label TEXT,
      tag TEXT,
      cwd TEXT,
      created_at INTEGER,
      last_used INTEGER,
      total_cost_usd REAL DEFAULT 0,
      turn_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      event_type TEXT,
      tool_name TEXT,
      tool_input TEXT,
      tool_output TEXT,
      hook_decision TEXT,
      timestamp INTEGER
    );

    CREATE TABLE IF NOT EXISTS cost_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      model TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cache_read_tokens INTEGER,
      cache_write_tokens INTEGER,
      cost_usd REAL,
      timestamp INTEGER
    );
  `)

  console.log(`DB initialized at ${DB_PATH}`)
}

export function upsertSession(params: {
  id: string
  label?: string
  tag?: string
  cwd?: string
  totalCostUsd?: number
  turnCount?: number
}): void {
  const now = Date.now()
  const existing = db
    .prepare('SELECT id FROM sessions WHERE id = ?')
    .get(params.id)

  if (existing) {
    db.prepare(`
      UPDATE sessions SET
        last_used = ?,
        total_cost_usd = COALESCE(?, total_cost_usd),
        turn_count = COALESCE(?, turn_count)
      WHERE id = ?
    `).run(now, params.totalCostUsd ?? null, params.turnCount ?? null, params.id)
  } else {
    db.prepare(`
      INSERT INTO sessions (id, label, tag, cwd, created_at, last_used, total_cost_usd, turn_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.id,
      params.label ?? null,
      params.tag ?? null,
      params.cwd ?? null,
      now,
      now,
      params.totalCostUsd ?? 0,
      params.turnCount ?? 0
    )
  }
}

export function logCost(params: {
  sessionId: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  costUsd: number
}): void {
  db.prepare(`
    INSERT INTO cost_log
      (session_id, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.sessionId,
    params.model,
    params.inputTokens,
    params.outputTokens,
    params.cacheReadTokens,
    params.cacheWriteTokens,
    params.costUsd,
    Date.now()
  )
}

export function logAudit(params: {
  sessionId: string
  eventType: string
  toolName?: string
  toolInput?: string
  toolOutput?: string
  hookDecision?: string
}): void {
  db.prepare(`
    INSERT INTO audit_log
      (session_id, event_type, tool_name, tool_input, tool_output, hook_decision, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.sessionId,
    params.eventType,
    params.toolName ?? null,
    params.toolInput ?? null,
    params.toolOutput ?? null,
    params.hookDecision ?? null,
    Date.now()
  )
}
