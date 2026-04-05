import { CircleHelp, Play, RefreshCcw, Search } from 'lucide-react'

import type { ServiceVisibilityMode } from '../types'

interface ToolbarProps {
  value: string
  onChange: (value: string) => void
  onLaunch: () => void
  onRefresh: () => void
  onHelp: () => void
  visibilityMode: ServiceVisibilityMode
  onVisibilityModeChange: (mode: ServiceVisibilityMode) => void
  isBusy?: boolean
}

export function Toolbar({
  value,
  onChange,
  onLaunch,
  onRefresh,
  onHelp,
  visibilityMode,
  onVisibilityModeChange,
  isBusy,
}: ToolbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-[#1f2a33] bg-[#121820]/96 px-4 py-3 backdrop-blur xl:px-5">
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Global Search by Port, Alias, Process, and Container ID"
            className="w-full rounded-xl border border-[#26323d] bg-[#0d1319] py-2.5 pl-11 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-[#2496ED]/60 focus:shadow-[0_0_0_3px_rgba(36,150,237,0.12)]"
          />
        </div>

        <button
          type="button"
          onClick={onLaunch}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#1f6f47] bg-[#133121] px-3 text-sm text-[#9bf3be] transition hover:border-[#22C55E]/50 hover:bg-[#174028]"
        >
          <Play className="h-4 w-4" />
          Run Service
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isBusy}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#2a333d] bg-[#1a2028] px-3 text-sm text-slate-200 transition hover:border-[#2496ED]/40 hover:bg-[#1c2631]"
        >
          <RefreshCcw className={`h-4 w-4 ${isBusy ? 'animate-spin' : ''}`} />
          {isBusy ? 'Refreshing' : 'Refresh'}
        </button>

        <div className="hidden items-center rounded-xl border border-[#2a333d] bg-[#1a2028] p-1 lg:flex">
          {(['develop', 'all'] as const).map((mode) => {
            const active = visibilityMode === mode

            return (
              <button
                key={mode}
                type="button"
                onClick={() => onVisibilityModeChange(mode)}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-[#0f1720] text-white shadow-[inset_0_0_0_1px_rgba(36,150,237,0.25)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode === 'develop' ? 'Develop' : 'All'}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={onHelp}
          title="查看使用说明"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#2a333d] bg-[#1a2028] text-slate-400 transition hover:border-[#2496ED]/40 hover:bg-[#1c2631] hover:text-slate-100"
        >
          <CircleHelp className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
