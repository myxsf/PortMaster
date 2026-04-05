import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Bookmark, ExternalLink, FileText } from 'lucide-react'
import { SiDocker } from 'react-icons/si'

import { getServiceIcon } from '../lib/service-icon'
import type { ProjectMeta } from '../lib/project-meta'
import type { ServiceItem } from '../types'

interface ServiceRowProps {
  service: ServiceItem
  onAliasSave: (alias: string) => void
  onToggleRecord: () => void
  onToggleLogs: () => void
  onToggleStatus: () => void
  onOpen: () => void
  projectMeta?: ProjectMeta | null
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

function getStackBadgeLabel(service: ServiceItem) {
  if (service.notes) {
    return service.notes
  }

  const corpus = [
    service.detectedName,
    service.command ?? '',
    service.cwd ?? '',
    service.path,
  ]
    .join(' ')
    .toLowerCase()

  if (corpus.includes('spring')) return 'Spring Boot'
  if (corpus.includes('react') || corpus.includes('vite')) return 'React'
  if (corpus.includes('vue') || corpus.includes('nuxt')) return 'Vue'
  if (corpus.includes('next')) return 'Next.js'
  if (corpus.includes('node')) return 'Node.js'
  if (corpus.includes('java')) return 'Java'
  if (corpus.includes('python')) return 'Python'

  return null
}

function compactUptime(value: string) {
  return value
    .replace(/^up\s+/i, '')
    .replace(/^exited\s+\(\d+\)\s+/i, '')
    .replace(/about /gi, '')
    .replace(/hours?/gi, 'h')
    .replace(/minutes?/gi, 'm')
    .replace(/seconds?/gi, 's')
    .replace(/days?/gi, 'd')
    .replace(/\s+ago/gi, ' ago')
    .replace(/\s+/g, ' ')
    .trim()
}

export function ServiceRow({
  service,
  onAliasSave,
  onToggleRecord,
  onToggleLogs,
  onToggleStatus,
  onOpen,
  projectMeta,
}: ServiceRowProps) {
  const { icon: TechIcon, className } = getServiceIcon(service.detectedName)
  const isRunning = service.status === 'active'
  const isDockerService = service.source === 'docker'
  const stopLabel = isDockerService
    ? isRunning ? '停止' : '启动'
    : isRunning
      ? service.recorded || service.launchedByPortMaster
        ? '关闭'
        : '结束'
      : '启动'
  const secondaryPath = service.cwd ?? service.path
  const isProjectService = Boolean(projectMeta)
  const stackBadge = useMemo(() => getStackBadgeLabel(service), [service])
  const rowClassName = isProjectService
    ? 'border-b border-[#3d3320] bg-[linear-gradient(180deg,#171a1f,#181712)] hover:bg-[#211d16]'
    : 'border-b border-[#202a33] bg-[#12171f] hover:bg-[#16202a]'
  const actionSurfaceClass = isProjectService
    ? 'bg-[#181712]'
    : 'bg-[#12171f]'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      className={`group overflow-hidden transition ${rowClassName}`}
    >
      <div className="grid min-h-[94px] grid-cols-[minmax(140px,0.82fr)_minmax(220px,1fr)_minmax(260px,1.15fr)_90px_minmax(180px,0.92fr)_minmax(280px,1.15fr)_minmax(420px,1.28fr)] items-center gap-6 px-6 py-4">
        <div>
          <StatusPill service={service} />
        </div>

        <div>
          {isDockerService ? (
            <div className="rounded-lg border border-dashed border-[#22303d] bg-[#0b1117] px-4 py-3 text-sm text-slate-500">
              由 Docker 管理
            </div>
          ) : (
            <input
              key={`${service.id}:${service.customAlias ?? ''}`}
              defaultValue={service.customAlias ?? ''}
              onBlur={(event) => {
                const value = event.currentTarget.value
                if (value !== (service.customAlias ?? '')) {
                  onAliasSave(value)
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  const value = event.currentTarget.value
                  if (value !== (service.customAlias ?? '')) {
                    onAliasSave(value)
                  }
                  event.currentTarget.blur()
                }
              }}
              placeholder="填写别名"
              className="w-full rounded-lg border border-[#22303d] bg-[#0b1117] px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-[#5f7290] focus:border-[#2496ED]/60"
            />
          )}
        </div>

        <div>
          <div className="flex items-center gap-2.5">
            <span className={`shrink-0 text-lg ${className}`}>
              <TechIcon />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium text-slate-100" title={service.detectedName}>
                  {service.detectedName}
                </span>
                {service.recorded && !isDockerService ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-[#1f6f47] bg-[#133121] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[#8ff0b8]">
                    <Bookmark className="h-3 w-3" />
                    已记录
                  </span>
                ) : null}
                {isDockerService ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-[#2496ED]/30 bg-[#0c2436] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[#66c6ff]">
                    <SiDocker className="h-3 w-3" />
                    Docker
                  </span>
                ) : null}
                {!isDockerService && stackBadge ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-[#7d5b1f] bg-[#2a210f] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[#f6d38b]">
                    {stackBadge}
                  </span>
                ) : null}
              </div>
              <div className="truncate text-xs text-[#6b7f99]" title={secondaryPath}>
                {secondaryPath}
              </div>
            </div>
          </div>
        </div>

        <div className="truncate text-sm text-slate-200">
          {service.pid}
        </div>

        <div className="min-w-0 text-sm text-slate-200" title={service.uptime}>
          <div className="truncate">{compactUptime(service.uptime)}</div>
        </div>

        <div>
          <div className="truncate font-mono text-xs text-[#8a9aae]" title={service.path}>
            {service.path}
          </div>
        </div>

        <div className={`min-w-0 ${actionSurfaceClass}`}>
          <div className="grid w-full gap-3">
            {!isDockerService ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={onOpen}
                    disabled={!isRunning}
                    className="inline-flex h-10 min-w-[170px] items-center justify-center gap-1.5 rounded-lg border border-[#2b3540] bg-[#1b2129] px-5 text-[12px] font-medium text-slate-100 transition hover:border-[#2496ED]/40 hover:bg-[#1f2a36] disabled:cursor-not-allowed disabled:text-slate-500"
                  >
                    <ExternalLink className="h-3 w-3" />
                    打开
                  </button>
                  <button
                    type="button"
                    onClick={onToggleLogs}
                    className="inline-flex h-10 min-w-[170px] items-center justify-center gap-1.5 rounded-lg border border-[#2b3540] bg-[#1b2129] px-5 text-[12px] font-medium text-slate-100 transition hover:border-[#2496ED]/40 hover:bg-[#1f2a36]"
                  >
                    <FileText className="h-3 w-3" />
                    查看日志
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={onToggleRecord}
                    disabled={!service.recordable}
                    className={`inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg border px-4 text-[12px] font-medium transition ${
                      service.recordable
                        ? 'border-[#2b3540] bg-[#1b2129] text-slate-100 hover:border-[#2496ED]/40 hover:bg-[#1f2a36]'
                        : 'cursor-not-allowed border-[#25303a] bg-[#161c23] text-slate-500'
                    }`}
                  >
                    <Bookmark className="h-3 w-3" />
                    {service.recorded ? '已记录' : '记录'}
                  </button>
                  <div className="flex h-10 min-w-[170px] items-center justify-between rounded-lg border border-[#2b3540] bg-[#1b2129] px-4">
                    <span className="shrink-0 text-[12px] font-medium text-slate-300">
                      {stopLabel}
                    </span>
                    <div className="ml-3 shrink-0">
                      <ServiceSwitch checked={isRunning} onToggle={onToggleStatus} />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={onOpen}
                    disabled={!isRunning}
                    className="inline-flex h-10 min-w-[170px] items-center justify-center gap-1.5 rounded-lg border border-[#2b3540] bg-[#1b2129] px-5 text-[12px] font-medium text-slate-100 transition hover:border-[#2496ED]/40 hover:bg-[#1f2a36] disabled:cursor-not-allowed disabled:text-slate-500"
                  >
                    <ExternalLink className="h-3 w-3" />
                    打开
                  </button>
                  <button
                    type="button"
                    onClick={onToggleLogs}
                    className="inline-flex h-10 min-w-[170px] items-center justify-center gap-1.5 rounded-lg border border-[#2b3540] bg-[#1b2129] px-5 text-[12px] font-medium text-slate-100 transition hover:border-[#2496ED]/40 hover:bg-[#1f2a36]"
                  >
                    <FileText className="h-3 w-3" />
                    查看日志
                  </button>
                </div>
                <div className="flex h-10 min-w-[170px] items-center justify-between rounded-lg border border-[#2b3540] bg-[#1b2129] px-4">
                  <span className="shrink-0 text-[12px] font-medium text-slate-300">
                    {stopLabel}
                  </span>
                  <div className="ml-3 shrink-0">
                    <ServiceSwitch checked={isRunning} onToggle={onToggleStatus} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
