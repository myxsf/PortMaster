import { useMemo, useState } from 'react'
import { Download, RefreshCcw, Trash2 } from 'lucide-react'

import { getProjectMeta } from '../lib/project-meta'
import type { ServiceItem, ServiceVisibilityMode } from '../types'

interface LogsExplorerProps {
  services: ServiceItem[]
  onRefresh: () => void
  isBusy?: boolean
  visibilityMode: ServiceVisibilityMode
  onVisibilityModeChange: (mode: ServiceVisibilityMode) => void
}

function requireDesktopApi() {
  if (!window.portmaster) {
    throw new Error('当前没有连接到桌面应用。')
  }

  return window.portmaster
}

type SourceFilter = 'dashboard' | 'docker'
type ScopeFilter = 'project' | 'port'
type LogLevelFilter = 'all' | 'success' | 'error' | 'warn' | 'info'

interface LogEntry {
  id: string
  line: string
  serviceId: string
  serviceLabel: string
}

function inferLogLevel(line: string): LogLevelFilter {
  const normalized = line.toLowerCase()

  if (
    normalized.includes('success') ||
    normalized.includes('started') ||
    normalized.includes('completed') ||
    normalized.includes('listening')
  ) {
    return 'success'
  }

  if (
    normalized.includes('error') ||
    normalized.includes('failed') ||
    normalized.includes('exception')
  ) {
    return 'error'
  }

  if (normalized.includes('warn')) {
    return 'warn'
  }

  return 'info'
}

function normalizeDateTime(value: string) {
  return value ? value.slice(0, 16) : ''
}

function parseLineDateTime(line: string) {
  const isoMatch = line.match(/(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/)
  if (isoMatch) {
    return `${isoMatch[1]}T${isoMatch[2].slice(0, 5)}`
  }

  const timeMatch = line.match(/\[(\d{2}:\d{2}:\d{2})\]/)
  if (timeMatch) {
    const today = new Date().toISOString().slice(0, 10)
    return `${today}T${timeMatch[1].slice(0, 5)}`
  }

  return undefined
}

export function LogsExplorer({
  services,
  onRefresh,
  isBusy,
  visibilityMode,
  onVisibilityModeChange,
}: LogsExplorerProps) {
  const now = new Date()
  const maxDateTime = `${now.toISOString().slice(0, 10)}T${now.toTimeString().slice(0, 5)}`
  const developServices = useMemo(
    () =>
      services.filter((service) => {
        if (service.source === 'docker') return true
        return Boolean(getProjectMeta(service))
      }),
    [services],
  )
  const candidateServices = visibilityMode === 'all' ? services : developServices

  const [source, setSource] = useState<SourceFilter>('dashboard')
  const [scope, setScope] = useState<ScopeFilter>('port')
  const [level, setLevel] = useState<LogLevelFilter>('all')
  const [lastLinesInput, setLastLinesInput] = useState('50')
  const [startDateTime, setStartDateTime] = useState('')
  const [endDateTime, setEndDateTime] = useState(maxDateTime)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedServiceId, setSelectedServiceId] = useState<string>('')

  const sourceServices = useMemo(
    () =>
      candidateServices.filter((service) =>
        source === 'docker' ? service.source === 'docker' : service.source === 'local',
      ),
    [candidateServices, source],
  )

  const projectOptions = useMemo(() => {
    const grouped = new Map<string, { id: string; label: string; services: ServiceItem[] }>()

    for (const service of sourceServices) {
      const meta = getProjectMeta(service)
      if (!meta) continue

      const current = grouped.get(meta.id)
      if (current) {
        current.services.push(service)
      } else {
        grouped.set(meta.id, { id: meta.id, label: meta.label, services: [service] })
      }
    }

    return [...grouped.values()]
  }, [sourceServices])

  const activeProject = projectOptions.find((item) => item.id === selectedProjectId) ?? projectOptions[0]
  const activeService = sourceServices.find((item) => item.id === selectedServiceId) ?? sourceServices[0]
  const effectiveEnd = endDateTime || maxDateTime
  const lastLines = Math.max(1, Number(lastLinesInput || '0') || 20)

  const aggregatedLogs = useMemo<LogEntry[]>(() => {
    const selectedEntries =
      scope === 'project' ? activeProject?.services ?? [] : activeService ? [activeService] : []

    return selectedEntries.flatMap((service) =>
      service.logs.map((line, index) => ({
        id: `${service.id}-${index}-${line}`,
        line,
        serviceId: service.id,
        serviceLabel: `${service.detectedName} · ${service.port}`,
      })),
    )
  }, [activeProject, activeService, scope])

  const filteredLogs = useMemo(() => {
    return aggregatedLogs
      .filter((entry) => level === 'all' || inferLogLevel(entry.line) === level)
      .filter((entry) => {
        const parsed = parseLineDateTime(entry.line)
        if (!startDateTime && !effectiveEnd) return true
        if (!parsed) return !startDateTime
        if (startDateTime && parsed < startDateTime) return false
        if (effectiveEnd && parsed > effectiveEnd) return false
        return true
      })
      .slice(0, lastLines)
  }, [aggregatedLogs, effectiveEnd, lastLines, level, startDateTime])

  const selectedIds = scope === 'project'
    ? (activeProject?.services ?? []).map((service) => service.id)
    : activeService
      ? [activeService.id]
      : []

  const handleDownload = () => {
    if (filteredLogs.length === 0) return

    const content = filteredLogs
      .map((entry) => `[${entry.serviceLabel}] ${entry.line}`)
      .join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `portmaster-logs-${source}-${scope}-${Date.now()}.log`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleClear = async () => {
    if (!selectedIds.length) return
    const confirmed = window.confirm('确定要清空当前筛选范围对应的日志吗？这个操作无法撤销。')
    if (!confirmed) return
    await requireDesktopApi().clearServiceLogs(selectedIds)
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[20px] border border-[#1c2933] bg-[#0d1319] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-lg font-semibold text-white">日志中心</div>
            <div className="mt-1 text-sm text-slate-400">
              先选“开发日志”或“全部日志”，再按本地服务或 Docker、项目或端口筛选。
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleDownload}
              disabled={filteredLogs.length === 0}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#2a333d] bg-[#1a2028] px-4 text-sm text-slate-200 transition hover:border-[#2496ED]/40 hover:bg-[#1c2631] disabled:cursor-not-allowed disabled:text-slate-500"
            >
              <Download className="h-4 w-4" />
              导出日志
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={selectedIds.length === 0}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#553232] bg-[#23161a] px-4 text-sm text-rose-200 transition hover:bg-[#2e1b21] disabled:cursor-not-allowed disabled:text-slate-500"
            >
              <Trash2 className="h-4 w-4" />
              清空日志
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isBusy}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#2a333d] bg-[#1a2028] px-4 text-sm text-slate-200 transition hover:border-[#2496ED]/40 hover:bg-[#1c2631] disabled:cursor-not-allowed disabled:text-slate-500"
            >
              <RefreshCcw className={`h-4 w-4 ${isBusy ? 'animate-spin' : ''}`} />
              {isBusy ? '刷新中' : '刷新日志'}
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-[#1f2a33] bg-[#0b1117] p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-[#7CC6FF]">日志范围</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {([
                ['develop', '开发日志'],
                ['all', '全部日志'],
              ] as Array<[ServiceVisibilityMode, string]>).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onVisibilityModeChange(mode)}
                  className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.14em] transition ${
                    visibilityMode === mode
                      ? 'border-[#2496ED]/40 bg-[#16324a] text-[#8fcfff]'
                      : 'border-[#2b3540] bg-[#121a23] text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#1f2a33] bg-[#0b1117] p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-[#7CC6FF]">日志来源</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(['dashboard', 'docker'] as SourceFilter[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setSource(item)}
                    className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.14em] transition ${
                      source === item
                        ? 'border-[#2496ED]/40 bg-[#16324a] text-[#8fcfff]'
                        : 'border-[#2b3540] bg-[#121a23] text-slate-400 hover:text-white'
                    }`}
                  >
                    {item === 'dashboard' ? '本地服务' : 'Docker'}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#1f2a33] bg-[#0b1117] p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-[#7CC6FF]">筛选方式</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(['project', 'port'] as ScopeFilter[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setScope(item)}
                    className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.14em] transition ${
                      scope === item
                        ? 'border-[#2496ED]/40 bg-[#16324a] text-[#8fcfff]'
                        : 'border-[#2b3540] bg-[#121a23] text-slate-400 hover:text-white'
                    }`}
                  >
                    {item === 'project' ? '项目' : '端口'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(320px,1fr)_minmax(420px,1.3fr)]">
            <div className="space-y-4 rounded-2xl border border-[#1f2a33] bg-[#0b1117] p-4">
              {scope === 'project' ? (
                <label className="block">
                  <div className="text-xs uppercase tracking-[0.24em] text-[#7CC6FF]">项目</div>
                  <select
                    value={activeProject?.id ?? ''}
                    onChange={(event) => setSelectedProjectId(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-[#22303d] bg-[#0e151d] px-4 py-3 text-sm text-slate-100 outline-none"
                  >
                    {projectOptions.length > 0 ? (
                      projectOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label} ({item.services.length} ports)
                        </option>
                      ))
                    ) : (
                      <option value="">当前没有可选项目</option>
                    )}
                  </select>
                </label>
              ) : (
                <label className="block">
                  <div className="text-xs uppercase tracking-[0.24em] text-[#7CC6FF]">端口</div>
                  <select
                    value={activeService?.id ?? ''}
                    onChange={(event) => setSelectedServiceId(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-[#22303d] bg-[#0e151d] px-4 py-3 text-sm text-slate-100 outline-none"
                  >
                    {sourceServices.length > 0 ? (
                      sourceServices.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.detectedName} : {item.port}
                        </option>
                      ))
                    ) : (
                      <option value="">当前没有可选端口</option>
                    )}
                  </select>
                </label>
              )}
            </div>

            <div className="rounded-2xl border border-[#1f2a33] bg-[#0b1117] p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <div className="text-xs uppercase tracking-[0.24em] text-[#7CC6FF]">日志级别</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(['all', 'success', 'error', 'warn', 'info'] as LogLevelFilter[]).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setLevel(item)}
                        className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.14em] transition ${
                          level === item
                            ? 'border-[#2496ED]/40 bg-[#16324a] text-[#8fcfff]'
                            : 'border-[#2b3540] bg-[#121a23] text-slate-400 hover:text-white'
                        }`}
                      >
                        {{
                          all: '全部',
                          success: '成功',
                          error: '错误',
                          warn: '警告',
                          info: '信息',
                        }[item]}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <div className="text-xs uppercase tracking-[0.24em] text-[#7CC6FF]">最近行数</div>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={lastLinesInput}
                    onChange={(event) => setLastLinesInput(event.target.value.replace(/[^\d]/g, ''))}
                    className="mt-2 w-full rounded-xl border border-[#22303d] bg-[#0e151d] px-4 py-3 text-sm text-slate-100 outline-none"
                  />
                </label>

                <label className="block">
                  <div className="text-xs uppercase tracking-[0.24em] text-[#7CC6FF]">开始时间</div>
                  <input
                    type="datetime-local"
                    step={60}
                    value={normalizeDateTime(startDateTime)}
                    max={normalizeDateTime(effectiveEnd || maxDateTime)}
                    onChange={(event) => setStartDateTime(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-[#22303d] bg-[#0e151d] px-4 py-3 text-sm text-slate-100 outline-none"
                  />
                </label>

                <label className="block">
                  <div className="text-xs uppercase tracking-[0.24em] text-[#7CC6FF]">结束时间</div>
                  <input
                    type="datetime-local"
                    step={60}
                    value={normalizeDateTime(effectiveEnd)}
                    min={normalizeDateTime(startDateTime)}
                    max={normalizeDateTime(maxDateTime)}
                    onChange={(event) => setEndDateTime(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-[#22303d] bg-[#0e151d] px-4 py-3 text-sm text-slate-100 outline-none"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[20px] border border-[#23303a] bg-[#0d1319]">
        <div className="border-b border-[#202a33] px-5 py-4">
          <div className="text-lg font-semibold text-white">
            {scope === 'project'
              ? `${activeProject?.label ?? '项目'} 日志`
              : `${activeService?.detectedName ?? '端口'} · ${activeService?.port ?? ''}`}
          </div>
          <div className="mt-1 text-sm text-slate-400">
            筛选后共 {filteredLogs.length} 条
          </div>
        </div>

        <div className="max-h-[68vh] overflow-auto px-5 py-4 font-mono text-xs leading-6 text-slate-300">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((entry) => {
              const lineLevel = inferLogLevel(entry.line)
              return (
                <div key={entry.id} className="rounded-lg px-3 py-2">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    {entry.serviceLabel}
                  </div>
                  <div
                    className={`break-words rounded-lg px-3 py-2 ${
                      lineLevel === 'error'
                        ? 'bg-[#2a1518] text-rose-200'
                        : lineLevel === 'warn'
                          ? 'bg-[#2a210f] text-amber-200'
                          : lineLevel === 'success'
                            ? 'bg-[#10251a] text-emerald-200'
                            : 'bg-[#0b1117]'
                    }`}
                  >
                    {entry.line}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="text-slate-500">当前筛选条件下没有匹配到日志。</div>
          )}
        </div>
      </div>
    </div>
  )
}
