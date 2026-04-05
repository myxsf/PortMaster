import { CircleHelp, RefreshCcw, Search, SlidersHorizontal } from 'lucide-react'

interface ToolbarProps {
  value: string
  onChange: (value: string) => void
  onRefresh: () => void
}

export function Toolbar({ value, onChange, onRefresh }: ToolbarProps) {
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
          onClick={onRefresh}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#2a333d] bg-[#1a2028] px-3 text-sm text-slate-200 transition hover:border-[#2496ED]/40 hover:bg-[#1c2631]"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>

        <button
          type="button"
          className="hidden h-10 items-center gap-2 rounded-xl border border-[#2a333d] bg-[#1a2028] px-3 text-sm text-slate-200 transition hover:border-[#2496ED]/40 hover:bg-[#1c2631] lg:inline-flex"
        >
          <SlidersHorizontal className="h-4 w-4" />
          All Ports
        </button>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#2a333d] bg-[#1a2028] text-slate-300 transition hover:border-[#2496ED]/40 hover:bg-[#1c2631]"
        >
          <CircleHelp className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
