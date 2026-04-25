import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Nav } from './components/Nav'
import { QueryLab } from './pages/QueryLab'
import { StartupLab } from './pages/StartupLab'
import { SessionLab } from './pages/SessionLab'
import { PermissionsLab } from './pages/PermissionsLab'
import { HooksLab } from './pages/HooksLab'
import { SubagentLab } from './pages/SubagentLab'
import { McpLab } from './pages/McpLab'
import { CustomToolsLab } from './pages/CustomToolsLab'
import { StreamingLab } from './pages/StreamingLab'
import { StructuredLab } from './pages/StructuredLab'
import { CheckpointLab } from './pages/CheckpointLab'
import { CostLab } from './pages/CostLab'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-gray-950">
        <Nav />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/query" replace />} />
            <Route path="/query" element={<QueryLab />} />
            <Route path="/startup" element={<StartupLab />} />
            <Route path="/sessions" element={<SessionLab />} />
            <Route path="/permissions" element={<PermissionsLab />} />
            <Route path="/hooks" element={<HooksLab />} />
            <Route path="/subagents" element={<SubagentLab />} />
            <Route path="/mcp" element={<McpLab />} />
            <Route path="/custom-tools" element={<CustomToolsLab />} />
            <Route path="/streaming" element={<StreamingLab />} />
            <Route path="/structured" element={<StructuredLab />} />
            <Route path="/checkpointing" element={<CheckpointLab />} />
            <Route path="/cost" element={<CostLab />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
