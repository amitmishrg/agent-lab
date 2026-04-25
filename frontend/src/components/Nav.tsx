import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { path: '/query', icon: '⚡', name: 'Query Lab', desc: 'query() basics' },
  { path: '/startup', icon: '🚀', name: 'Startup Lab', desc: 'startup() pre-warming' },
  { path: '/sessions', icon: '💾', name: 'Session Lab', desc: 'resume, fork, list' },
  { path: '/permissions', icon: '🔐', name: 'Permissions Lab', desc: 'modes + canUseTool' },
  { path: '/hooks', icon: '🪝', name: 'Hooks Lab', desc: 'intercept + control' },
  { path: '/subagents', icon: '🤖', name: 'Subagent Lab', desc: 'multi-agent teams' },
  { path: '/mcp', icon: '🔌', name: 'MCP Lab', desc: 'external tools' },
  { path: '/custom-tools', icon: '🛠️', name: 'Custom Tools Lab', desc: 'tool() builder' },
  { path: '/streaming', icon: '💬', name: 'Streaming Lab', desc: 'multi-turn chat' },
  { path: '/structured', icon: '📋', name: 'Structured Lab', desc: 'typed JSON output' },
  { path: '/checkpointing', icon: '⏪', name: 'Checkpoint Lab', desc: 'file rewind' },
  { path: '/cost', icon: '💰', name: 'Cost Lab', desc: 'tracking + budgets' },
]

export function Nav() {
  return (
    <nav className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col h-full overflow-y-auto flex-shrink-0">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧪</span>
          <div>
            <div className="font-bold text-white text-sm">Agent Lab</div>
            <div className="text-xs text-gray-500">Claude SDK Explorer</div>
          </div>
        </div>
      </div>
      <div className="flex-1 py-2">
        {NAV_ITEMS.map((item, i) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-start gap-3 px-4 py-2.5 mx-2 my-0.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
              }`
            }
          >
            <span className="mt-0.5 text-base flex-shrink-0">{item.icon}</span>
            <div className="min-w-0">
              <div className="font-medium text-xs leading-tight">
                <span className="text-gray-500 mr-1">{i + 1}.</span>
                {item.name}
              </div>
              <div className="text-xs text-gray-500 truncate leading-tight mt-0.5">
                {item.desc}
              </div>
            </div>
          </NavLink>
        ))}
      </div>
      <div className="p-3 border-t border-gray-800 text-xs text-gray-600">
        @anthropic-ai/claude-agent-sdk
      </div>
    </nav>
  )
}
