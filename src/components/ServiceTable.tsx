import { AnimatePresence } from 'framer-motion'

import type { ServiceItem } from '../types'
import { ServiceRow } from './ServiceRow'

interface ServiceTableProps {
  items: ServiceItem[]
  expandedRows: string[]
  onAliasSave: (id: string, alias: string) => void
  onToggleLogs: (id: string) => void
  onRestart: (id: string) => void
  onToggleStatus: (id: string) => void
  onOpen: (service: ServiceItem) => void
  onCopyUrl: (service: ServiceItem) => void
}

export function ServiceTable({
  items,
  expandedRows,
  onAliasSave,
  onToggleLogs,
  onRestart,
  onToggleStatus,
  onOpen,
  onCopyUrl,
}: ServiceTableProps) {
  return (
    <section className="space-y-3">
      <div className="mr-4 overflow-x-auto overflow-y-hidden rounded-[18px] border border-[#23303a] bg-[#0d1319] shadow-[0_12px_30px_rgba(0,0,0,0.24)] xl:mr-6">
        <div className="min-w-[1460px]">
          <div className="grid grid-cols-[150px_210px_250px_80px_92px_minmax(220px,1fr)_320px_40px] items-center gap-4 border-b border-[#202a33] bg-[linear-gradient(180deg,#101820,#0c1218)] px-5 py-3 text-xs font-medium uppercase tracking-[0.22em] text-[#7d8ea3]">
            <span>Status</span>
            <span>Custom Alias</span>
            <span>Process Name</span>
            <span>PID</span>
            <span>Uptime</span>
            <span>Path</span>
            <span>Actions</span>
            <span aria-hidden="true" />
          </div>

          <AnimatePresence mode="popLayout">
            {items.map((service) => (
              <ServiceRow
                key={service.id}
                service={service}
                expanded={expandedRows.includes(service.id)}
                onAliasSave={(alias) => onAliasSave(service.id, alias)}
                onToggleLogs={() => onToggleLogs(service.id)}
                onRestart={() => onRestart(service.id)}
                onToggleStatus={() => onToggleStatus(service.id)}
                onOpen={() => onOpen(service)}
                onCopyUrl={() => onCopyUrl(service)}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
