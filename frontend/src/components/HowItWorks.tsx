import { useState } from 'react'

interface HowItWorksProps {
  feature: string
  sdkApi: string
  description: string
  whyUseIt: string
  docsUrl?: string
}

export function HowItWorks({ feature, sdkApi, description, whyUseIt, docsUrl }: HowItWorksProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-6 border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-gray-750 text-sm text-gray-300 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>📚</span>
          <span>How this works</span>
        </span>
        <span className="text-gray-500">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 py-4 bg-gray-850 space-y-3 text-sm">
          <div>
            <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">SDK Feature</div>
            <div className="text-white font-medium">{feature}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">SDK API</div>
            <code className="text-blue-300 bg-gray-900 px-2 py-1 rounded text-xs font-mono">{sdkApi}</code>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">What it does</div>
            <p className="text-gray-300 text-xs leading-relaxed">{description}</p>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">Why use it in production</div>
            <p className="text-gray-300 text-xs leading-relaxed">{whyUseIt}</p>
          </div>
          {docsUrl && (
            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
            >
              <span>→</span>
              <span>View SDK docs</span>
            </a>
          )}
        </div>
      )}
    </div>
  )
}
