import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDB, db } from './db/index.js'
import { queryRouter } from './routes/query.js'
import { startupRouter } from './routes/startup.js'
import { sessionsRouter } from './routes/sessions.js'
import { permissionsRouter } from './routes/permissions.js'
import { hooksRouter } from './routes/hooks.js'
import { subagentsRouter } from './routes/subagents.js'
import { mcpRouter } from './routes/mcp.js'
import { customToolsRouter } from './routes/custom-tools.js'
import { streamingRouter } from './routes/streaming.js'
import { structuredRouter } from './routes/structured.js'
import { checkpointingRouter } from './routes/checkpointing.js'
import { costRouter } from './routes/cost.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = parseInt(process.env.BACKEND_PORT ?? '3001', 10)
const SANDBOX_DIR = process.env.SANDBOX_DIR
  ? path.resolve(process.env.SANDBOX_DIR)
  : path.resolve(__dirname, '../sandbox')
const DB_PATH = process.env.DB_PATH ?? './data/agent-lab.db'

initDB()

const app = express()

app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    credentials: true,
  })
)

app.use(express.json({ limit: '10mb' }))

app.set('db', db)

app.use('/api/query', queryRouter)
app.use('/api/startup', startupRouter)
app.use('/api/sessions', sessionsRouter)
app.use('/api/permissions', permissionsRouter)
app.use('/api/hooks', hooksRouter)
app.use('/api/subagents', subagentsRouter)
app.use('/api/mcp', mcpRouter)
app.use('/api/custom-tools', customToolsRouter)
app.use('/api/streaming', streamingRouter)
app.use('/api/structured', structuredRouter)
app.use('/api/checkpointing', checkpointingRouter)
app.use('/api/cost', costRouter)

const frontendDist = path.resolve(__dirname, '../../frontend/dist')
app.use(express.static(frontendDist))
app.get('*', (_req, res) => {
  const indexPath = path.join(frontendDist, 'index.html')
  res.sendFile(indexPath)
})

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
)

app.listen(PORT, () => {
  console.log(`\n🧪 Agent Lab running on http://localhost:${PORT}`)
  console.log(`📁 Sandbox dir: ${SANDBOX_DIR}`)
  console.log(`🗄️  DB: ${DB_PATH}\n`)
})
