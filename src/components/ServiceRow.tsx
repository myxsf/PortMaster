import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, Copy, ExternalLink, FileText } from 'lucide-react'
import { SiDocker } from 'react-icons/si'

import { getServiceIcon } from '../lib/service-icon'
import type { ServiceItem } from '../types'

interface ServiceRowProps {
  service: ServiceItem
  expanded: boolean
  onAliasSave: (alias: string) => void
  onToggleRecord: () => void
  onToggleLogs: () => void
  onToggleStatus: () => void
  onOpen: () => void
  onCopyUrl: () => void
}

function StatusPill({ service }: { service: ServiceItem }) {
  const active = service.status === 'active'
  const errored = service.status === 'error'
  const statusColor = active
    ? 'bg-[#22C55E] shadow-[0_0_16px_rgba(34,197,94,0.95)]'
    : errored
      ? 'bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.9)]'
      : 'bg-slate-500'

  return (
    <div className="flex items-center gap-3">
      <span className={`relative h-2.5 w-2.5 shrink-0 rounded-full ${statusColor}`}>
        <span
          className={`absolute inset-0 rounded-full ${
            active ? 'animate-ping bg-[#22C55E]/70' : 'bg-transparent'
          }`}
        />
      </span>
      <div className="min-w-0">
        <div className="text-[2.05rem] font-semibold leading-none tracking-tight text-sky-300">
          {service.port}
        </div>
        <div className="mt-0.5 truncate text-sm text-slate-500">localhost:{service.port}</div>
      </div>
    </div>
  )
}

function ServiceSwitch({
  checked,
  onToggle,
}: {
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onToggle}
      className={`relative h-9 w-[74px] rounded-full border transition ${
        checked
          ? 'border-[#29cf67] bg-[#29cf67]'
          : 'border-[#36465a] bg-[#263447]'
      }`}
    >
      <span
        className={`absolute top-1 h-7 w-7 rounded-full bg-[#0b1016] shadow-lg transition ${
          checked ? 'left-[40px]' : 'left-[3px]'
        }`}
      />
    </button>
  )
}

export function ServiceRow({
  service,
  expanded,
  onAliasSave,
  onToggleRecord,
  onToggleLogs,
  onToggleStatus,
  onOpen,
  onCopyUrl,
}: ServiceRowProps) {
  const [draftAlias, setDraftAlias] = useState(service.customAlias ?? '')
  const [isEditingAlias, setIsEditingAlias] = useState(false)
  const { icon: TechIcon, className } = getServiceIcon(service.detectedName)
  const isRunning = service.status === 'active'
  const stopLabel = isRunning
    ? service.source === 'local' && (service.recorded || service.launchedByPortMaster)
      ? 'Close'
      : 'Kill'
    : 'Start'
  const secondaryPath = service.cwd ?? service.path

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.985 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="group overflow-hidden border-b border-[#202a33] bg-[#12171f] transition hover:bg-[#16202a]"
    >
      <div className="grid min-h-[94px] grid-cols-[150px_210px_minmax(240px,1.2fr)_88px_130px_minmax(280px,1fr)_320px] items-center gap-4 px-5 py-4">
        <div className="relative pr-10">
          <StatusPill service={service} />
          <button
            type="button"
            onClick={onCopyUrl}
            className="absolute right-0 top-1 rounded-lg border border-[#2a3440] bg-[#19222d] p-2 text-slate-400 opacity-0 transition hover:text-slate-100 group-hover:opacity-100"
            title="Copy URL"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>

        <div>
          <input
            value={isEditingAlias ? draftAlias : (service.customAlias ?? '')}
            onChange={(event) => setDraftAlias(event.target.value)}
            onFocus={() => {
              setDraftAlias(service.customAlias ?? '')
              setIsEditingAlias(true)
            }}
            onBlur={() => {
              onAliasSave(draftAlias)
              setIsEditingAlias(false)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onAliasSave(draftAlias)
                event.currentTarget.blur()
              }
            }}
            placeholder="Add Alias..."
            className="w-full rounded-lg border border-[#22303d] bg-[#0b1117] px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-[#5f7290] focus:border-[#2496ED]/60"
          />
        </div>

        <div>
          <div className="flex items-center gap-2.5">
            <span className={`shrink-0 text-lg ${className}`}>
              <TechIcon />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-slate-100">
                  {service.detectedName}
                </span>
                {service.recorded ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-[#1f6f47] bg-[#133121] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[#8ff0b8]">
                    <Bookmark className="h-3 w-3" />
                    Recorded
                  </span>
                ) : null}
                {service.source === 'docker' ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-[#2496ED]/30 bg-[#0c2436] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[#66c6ff]">
                    <SiDocker className="h-3 w-3" />
                    Docker
                  </span>
                ) : null}
              </div>
              <div className="truncate text-xs text-[#6b7f99]">{secondaryPath}</div>
            </div>
          </div>
        </div>

        <div className="text-sm text-slate-200">
          {service.pid}
        </div>

        <div className="whitespace-nowrap text-sm text-slate-200">
          {service.uptime}
        </div>

        <div>
          <div className="truncate font-mono text-xs text-[#8a9aae]" title={service.path}>
            {service.path}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <div className="grid w-full grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onOpen}
                disabled={!isRunning}
                className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-[#2b3540] bg-[#1b2129] px-3 text-[11px] font-medium text-slate-100 transition hover:border-[#2496ED]/40 hover:bg-[#1f2a36]"
              >
                <ExternalLink className="h-3 w-3" />
                Open
              </button>
              <button
                type="button"
                onClick={onToggleLogs}
                className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-[#2b3540] bg-[#1b2129] px-3 text-[11px] font-medium text-slate-100 transition hover:border-[#2496ED]/40 hover:bg-[#1f2a36]"
              >
                <FileText className="h-3 w-3" />
                View Logs
              </button>
              <button
                type="button"
                onClick={onToggleRecord}
                disabled={!service.recordable}
                className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-[#2b3540] bg-[#1b2129] px-3 text-[11px] font-medium text-slate-100 transition hover:border-[#2496ED]/40 hover:bg-[#1f2a36]"
              >
                <Bookmark className="h-3 w-3" />
                {service.recorded ? 'Recorded' : 'Record'}
              </button>
              <div className="flex h-10 min-w-0 items-center justify-between rounded-lg border border-[#2b3540] bg-[#1b2129] px-3">
                <span className="shrink-0 text-[11px] font-medium text-slate-300">
                  {stopLabel}
                </span>
                <div className="ml-3 shrink-0">
                  <ServiceSwitch checked={isRunning} onToggle={onToggleStatus} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="border-t border-[#202a33] bg-[#0b1016]"
          >
            <div className="terminal-scroll overflow-auto px-5 py-4 font-mono text-xs leading-6 text-slate-300">
              {service.logs.length > 0 ? (
                service.logs.map((line) => (
                  <div key={`${service.id}-${line}`}>{line}</div>
                ))
              ) : (
                <div className="text-slate-500">No recent logs available for this service.</div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}
