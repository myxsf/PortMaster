import { Activity, Boxes, LayoutDashboard, Network, Settings2 } from 'lucide-react'

import type { AppView } from '../types'
import portmasterIcon from '../../assets/portmaster-icon.svg'

const items = [
  { id: 'dashboard', label: 'Dashboard', caption: 'Local processes', icon: LayoutDashboard },
  { id: 'docker', label: 'Docker Containers', caption: 'Docker management', icon: Boxes },
  { id: 'topology', label: 'Port Topology', caption: 'Topology graph', icon: Network },
  { id: 'networkLogs', label: 'Network Logs', caption: 'Runtime stream', icon: Activity },
  { id: 'settings', label: 'Settings', caption: 'Preferences', icon: Settings2 },
] as const

interface SidebarProps {
  activeItem: AppView
  onSelect: (item: AppView) => void
}

export function Sidebar({ activeItem, onSelect }: SidebarProps) {
  return (
    <aside className="flex h-full w-full flex-col border-r border-[#1d2730] bg-[#0d1218] px-3 py-4">
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-[#1f5f95] bg-[#10263a] p-1 shadow-[0_0_30px_rgba(36,150,237,0.16)]">
          <img src={portmasterIcon} alt="PortMaster icon" className="h-full w-full rounded-[16px]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold tracking-wide text-slate-100">
              PortMaster
            </p>
            <span className="rounded-md border border-[#2496ED]/20 bg-[#2496ED]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#7CC6FF]">
              v0.9
            </span>
          </div>
          <p className="text-xs text-slate-500">desktop control plane</p>
        </div>
      </div>

      <nav className="space-y-1.5">
        {items.map(({ id, label, caption, icon: Icon }) => {
          const selected = id === activeItem

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`group relative flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition ${
                selected
                  ? 'bg-[#11253a] text-sky-100 shadow-[inset_0_0_0_1px_rgba(36,150,237,0.2)]'
                  : 'text-slate-400 hover:bg-[#141b22] hover:text-slate-100'
              }`}
            >
              <span
                className={`absolute inset-y-2 left-0 w-0.5 rounded-full ${
                  selected ? 'bg-[#2496ED]' : 'bg-transparent'
                }`}
              />
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  selected
                    ? 'text-[#7CC6FF]'
                    : 'text-slate-500 transition group-hover:text-slate-300'
                }`}
              />
              <div className="min-w-0">
                <div className="truncate">{label}</div>
                <div className="truncate text-xs text-slate-500">{caption}</div>
              </div>
              {selected ? (
                <span className="ml-auto rounded-md bg-[#22C55E]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#86EFAC]">
                  Active
                </span>
              ) : null}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
