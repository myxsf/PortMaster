import { useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ChevronDown, FolderTree } from 'lucide-react'

import type { ServiceItem } from '../types'
import { ServiceRow } from './ServiceRow'

interface ServiceTableProps {
  items: ServiceItem[]
  expandedRows: string[]
  onAliasSave: (id: string, alias: string) => void
  onToggleRecord: (id: string) => void
  onToggleLogs: (id: string) => void
  onToggleStatus: (id: string) => void
  onOpen: (service: ServiceItem) => void
  onCopyUrl: (service: ServiceItem) => void
}

interface ProjectGroup {
  id: string
  label: string
  path: string
  items: ServiceItem[]
}

type TableBlock =
  | { type: 'service'; service: ServiceItem }
  | { type: 'project'; group: ProjectGroup }

const INFRA_SERVICE_NAMES = new Set([
  'mysql',
  'redis',
  'postgresql',
  'postgres',
  'docker',
  'nginx',
])

const PROJECT_LEAF_NAMES = new Set([
  'frontend',
  'backend',
  'client',
  'server',
  'web',
  'api',
  'admin',
  'app',
])

function sortServices(items: ServiceItem[]) {
  return [...items].sort((left, right) => {
    const leftAliased = left.customAlias?.trim() ? 1 : 0
    const rightAliased = right.customAlias?.trim() ? 1 : 0

    return rightAliased - leftAliased || left.port - right.port || left.detectedName.localeCompare(right.detectedName)
  })
}

function normalizeProjectPath(value?: string) {
  return value?.replace(/\\/g, '/').replace(/\/+$/, '')
}

function deriveProjectGroup(service: ServiceItem): Omit<ProjectGroup, 'items'> | null {
  if (service.source !== 'local') {
    return null
  }

  if (INFRA_SERVICE_NAMES.has(service.detectedName.toLowerCase())) {
    return null
  }

  const normalized = normalizeProjectPath(service.cwd ?? service.path)
  if (!normalized?.startsWith('/')) {
    return null
  }

  const segments = normalized.split('/').filter(Boolean)
  const codexIndex = segments.indexOf('codex')

  if (codexIndex >= 0 && segments[codexIndex + 1]) {
    const projectName = segments[codexIndex + 1]
    const projectPath = `/${segments.slice(0, codexIndex + 2).join('/')}`

    return {
      id: `project:${projectPath}`,
      label: projectName,
      path: projectPath,
    }
  }

  const leaf = segments[segments.length - 1]?.toLowerCase()
  if (leaf && PROJECT_LEAF_NAMES.has(leaf) && segments.length >= 2) {
    const projectPath = `/${segments.slice(0, -1).join('/')}`
    return {
      id: `project:${projectPath}`,
      label: segments[segments.length - 2],
      path: projectPath,
    }
  }

  return null
}

function buildTableBlocks(items: ServiceItem[]) {
  const sorted = sortServices(items)
  const grouped = new Map<string, ProjectGroup>()
  const assignedIds = new Set<string>()

  for (const service of sorted) {
    const group = deriveProjectGroup(service)
    if (!group) {
      continue
    }

    const current = grouped.get(group.id)
    if (current) {
      current.items.push(service)
    } else {
      grouped.set(group.id, { ...group, items: [service] })
    }
  }

  const qualifiedGroupIds = new Set(
    [...grouped.values()].filter((group) => group.items.length >= 2).map((group) => group.id),
  )

  const blocks: TableBlock[] = []

  for (const service of sorted) {
    const group = deriveProjectGroup(service)
    if (group && qualifiedGroupIds.has(group.id)) {
      if (!assignedIds.has(group.id)) {
        blocks.push({
          type: 'project',
          group: grouped.get(group.id)!,
        })
        assignedIds.add(group.id)
      }
      continue
    }

    blocks.push({ type: 'service', service })
  }

  return blocks
}

export function ServiceTable({
  items,
  expandedRows,
  onAliasSave,
  onToggleRecord,
  onToggleLogs,
  onToggleStatus,
  onOpen,
  onCopyUrl,
}: ServiceTableProps) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])
  const blocks = useMemo(() => buildTableBlocks(items), [items])

  return (
    <section className="space-y-3">
      <div className="mr-4 overflow-x-auto overflow-y-hidden rounded-[18px] border border-[#23303a] bg-[#0d1319] shadow-[0_12px_30px_rgba(0,0,0,0.24)] xl:mr-6">
        <div className="min-w-[1520px]">
          <div className="grid grid-cols-[150px_210px_minmax(240px,1.2fr)_88px_130px_minmax(280px,1fr)_320px] items-center gap-4 border-b border-[#202a33] bg-[linear-gradient(180deg,#101820,#0c1218)] px-5 py-3 text-xs font-medium uppercase tracking-[0.22em] text-[#7d8ea3]">
            <span>Status</span>
            <span>Custom Alias</span>
            <span>Process Name</span>
            <span>PID</span>
            <span>Uptime</span>
            <span>Path</span>
            <span>Actions</span>
          </div>

          <AnimatePresence mode="popLayout">
            {blocks.map((block) => {
              if (block.type === 'service') {
                const { service } = block

                return (
                  <ServiceRow
                    key={service.id}
                    service={service}
                    expanded={expandedRows.includes(service.id)}
                    onAliasSave={(alias) => onAliasSave(service.id, alias)}
                    onToggleRecord={() => onToggleRecord(service.id)}
                    onToggleLogs={() => onToggleLogs(service.id)}
                    onToggleStatus={() => onToggleStatus(service.id)}
                    onOpen={() => onOpen(service)}
                    onCopyUrl={() => onCopyUrl(service)}
                  />
                )
              }

              const isExpanded = expandedGroups.includes(block.group.id)

              return (
                <div key={block.group.id} className="border-b border-[#202a33] bg-[#111821]">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedGroups((current) =>
                        current.includes(block.group.id)
                          ? current.filter((id) => id !== block.group.id)
                          : [...current, block.group.id],
                      )
                    }
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[#15212b]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                        <FolderTree className="h-4 w-4 text-[#7CC6FF]" />
                        <span className="truncate">{block.group.label}</span>
                        <span className="rounded-full border border-[#28435a] bg-[#122130] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#8fcfff]">
                          {block.group.items.length} ports
                        </span>
                      </div>
                      <div className="mt-1 truncate font-mono text-xs text-[#6f8197]">
                        {block.group.path}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                      <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
                      <ChevronDown
                        className={`h-4 w-4 transition ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="border-t border-[#1d2a34] bg-[#0f151d]">
                      {block.group.items.map((service) => (
                        <ServiceRow
                          key={service.id}
                          service={service}
                          expanded={expandedRows.includes(service.id)}
                          onAliasSave={(alias) => onAliasSave(service.id, alias)}
                          onToggleRecord={() => onToggleRecord(service.id)}
                          onToggleLogs={() => onToggleLogs(service.id)}
                          onToggleStatus={() => onToggleStatus(service.id)}
                          onOpen={() => onOpen(service)}
                          onCopyUrl={() => onCopyUrl(service)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </AnimatePresence>

          {items.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 border-t border-[#202a33] px-8 py-12 text-center">
              <div className="text-lg font-medium text-slate-200">No services detected yet</div>
              <div className="max-w-xl text-sm text-slate-500">
                PortMaster will show real listening ports and Docker containers here. Try
                refreshing, starting a local service, or checking whether Docker is running.
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
