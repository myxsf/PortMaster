import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, FolderTree } from 'lucide-react'

import { getProjectMeta } from '../lib/project-meta'
import type { ServiceItem } from '../types'
import { ServiceRow } from './ServiceRow'

interface ServiceTableProps {
  items: ServiceItem[]
  groupProjects?: boolean
  onAliasSave: (id: string, alias: string) => void
  onToggleRecord: (id: string) => void
  onRecordGroup?: (items: ServiceItem[]) => void
  onOpenLogs: (service: ServiceItem) => void
  onToggleStatus: (id: string) => void
  onToggleGroupStatus?: (items: ServiceItem[]) => void
  onOpen: (service: ServiceItem) => void
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

function buildTableBlocks(items: ServiceItem[], groupProjects: boolean) {
  if (!groupProjects) {
    return items.map((service) => ({ type: 'service', service }) as TableBlock)
  }

  const sorted = [...items]
  const grouped = new Map<string, ProjectGroup>()
  const assignedIds = new Set<string>()

  for (const service of sorted) {
    const group = getProjectMeta(service)
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

  const qualifiedGroupIds = new Set([...grouped.values()].map((group) => group.id))

  const blocks: TableBlock[] = []

  for (const service of sorted) {
    const group = getProjectMeta(service)
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
  groupProjects = true,
  onAliasSave,
  onToggleRecord,
  onRecordGroup,
  onOpenLogs,
  onToggleStatus,
  onToggleGroupStatus,
  onOpen,
}: ServiceTableProps) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])
  const blocks = useMemo(() => buildTableBlocks(items, groupProjects), [groupProjects, items])

  return (
    <section className="space-y-3">
      <div className="overflow-x-auto overflow-y-hidden rounded-[18px] border border-[#23303a] bg-[#0d1319] shadow-[0_12px_30px_rgba(0,0,0,0.24)]">
        <div className="min-w-[1880px] pr-10">
          <div className="grid grid-cols-[minmax(140px,0.82fr)_minmax(220px,1fr)_minmax(260px,1.15fr)_90px_minmax(180px,0.92fr)_minmax(280px,1.15fr)_minmax(420px,1.28fr)] items-center gap-6 border-b border-[#202a33] bg-[linear-gradient(180deg,#101820,#0c1218)] px-6 py-3 text-xs font-medium uppercase tracking-[0.22em] text-[#7d8ea3]">
            <span>状态</span>
            <span>自定义别名</span>
            <span>服务名</span>
            <span>PID</span>
            <span>运行时长</span>
            <span>路径</span>
            <span>操作</span>
          </div>

          <AnimatePresence initial={false} mode="popLayout">
            {blocks.map((block) => {
            if (block.type === 'service') {
              const { service } = block
              const projectMeta = getProjectMeta(service)

              return (
                <ServiceRow
                  key={service.id}
                  service={service}
                  onAliasSave={(alias) => onAliasSave(service.id, alias)}
                  onToggleRecord={() => onToggleRecord(service.id)}
                  onToggleLogs={() => onOpenLogs(service)}
                  onToggleStatus={() => onToggleStatus(service.id)}
                  onOpen={() => onOpen(service)}
                  projectMeta={projectMeta}
                />
              )
            }

            const isExpanded = expandedGroups.includes(block.group.id)
            const activeItems = block.group.items.filter((item) => item.status === 'active')
            const recordableItems = block.group.items.filter((item) => item.source === 'local')
            const allRecorded =
              recordableItems.length > 0 && recordableItems.every((item) => item.recorded)
            const groupSwitchChecked = activeItems.length > 0
            const groupSwitchLabel = groupSwitchChecked ? '全部关闭' : '全部启动'
            const groupStatusLabel =
              activeItems.length === 0
                ? '全部已停止'
                : activeItems.length === block.group.items.length
                  ? '全部运行中'
                  : `部分运行 ${activeItems.length}/${block.group.items.length}`

            return (
              <motion.div
                key={block.group.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="border-b border-[#4d3a19] bg-[linear-gradient(180deg,#161615,#1a1812)]"
              >
                <div className="flex w-full items-center justify-between gap-4 px-5 py-4 transition hover:bg-[#221e15]">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedGroups((current) =>
                        current.includes(block.group.id)
                          ? current.filter((id) => id !== block.group.id)
                          : [...current, block.group.id],
                      )
                    }
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                      <FolderTree className="h-4 w-4 text-[#f6d38b]" />
                      <span className="truncate">{block.group.label}</span>
                      <span className="rounded-full border border-[#7d5b1f] bg-[#2a210f] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#f6d38b]">
                        {block.group.items.length} ports
                      </span>
                      <span className="rounded-full border border-[#3a3f47] bg-[#171d24] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-300">
                        {groupStatusLabel}
                      </span>
                    </div>
                    <div className="mt-1 truncate font-mono text-xs text-[#b3a27a]" title={block.group.path}>
                      {block.group.path}
                    </div>
                  </button>
                  <div className="flex items-center gap-4">
                    {onRecordGroup && recordableItems.length > 0 ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          void onRecordGroup(block.group.items)
                        }}
                        className="inline-flex items-center rounded-xl border border-[#1f6f47] bg-[#133121] px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-[#9bf3be] transition hover:border-[#22C55E]/50 hover:bg-[#174028]"
                      >
                        {allRecorded ? '已记录' : '记录项目'}
                      </button>
                    ) : null}
                    {onToggleGroupStatus ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          void onToggleGroupStatus(block.group.items)
                        }}
                        className="inline-flex items-center rounded-xl border border-[#2b3540] bg-[#1b2129] px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-200 transition hover:border-[#2496ED]/40 hover:bg-[#1f2a36]"
                      >
                        {groupSwitchLabel}
                      </button>
                    ) : null}
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#d5c39a]">
                      <span>{isExpanded ? '收起' : '展开'}</span>
                      <ChevronDown
                        className={`h-4 w-4 transition ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>
                </div>

                {isExpanded ? (
                  <div className="border-t border-[#4d3a19] bg-[#131517]">
                    {block.group.items.map((service) => (
                      <ServiceRow
                        key={service.id}
                        service={service}
                        onAliasSave={(alias) => onAliasSave(service.id, alias)}
                        onToggleRecord={() => onToggleRecord(service.id)}
                        onToggleLogs={() => onOpenLogs(service)}
                        onToggleStatus={() => onToggleStatus(service.id)}
                        onOpen={() => onOpen(service)}
                        projectMeta={block.group}
                      />
                    ))}
                  </div>
                ) : null}
              </motion.div>
            )
            })}
          </AnimatePresence>

          {items.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 border-t border-[#202a33] px-8 py-12 text-center">
              <div className="text-lg font-medium text-slate-200">暂时还没有检测到服务</div>
              <div className="max-w-xl text-sm text-slate-500">
                刷新后这里会显示本机监听端口和 Docker 容器。可以先启动本地服务，或确认 Docker 是否已经运行。
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
