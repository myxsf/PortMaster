import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Activity, Boxes, Settings2, Workflow, X } from 'lucide-react'

import { HomePage } from './components/HomePage'
import { Sidebar } from './components/Sidebar'
import { LogsExplorer } from './components/LogsExplorer'
import { SettingsPage } from './components/SettingsPage'
import { ServiceTable } from './components/ServiceTable'
import { Toolbar } from './components/Toolbar'
import { getProjectMeta } from './lib/project-meta'
import { useServiceStore } from './store/useServiceStore'
import type {
  AppView,
  LocalLaunchInput,
  ServiceItem,
  ServiceVisibilityMode,
  ToastItem,
} from './types'

const viewMeta: Record<AppView, { title: string; subtitle: string; icon: typeof Activity }> = {
  home: {
    title: '首页',
    subtitle: 'PortMaster 简介、仓库入口和讨论入口。',
    icon: Activity,
  },
  dashboard: {
    title: '仪表盘',
    subtitle: '查看和管理本地服务端口。',
    icon: Activity,
  },
  docker: {
    title: 'Docker 容器',
    subtitle: '这里只显示 Docker 容器服务。',
    icon: Boxes,
  },
  topology: {
    title: '端口拓扑',
    subtitle: '该功能暂未开放，后续会补充。',
    icon: Workflow,
  },
  networkLogs: {
    title: '日志中心',
    subtitle: '按来源、项目、端口查看服务日志。',
    icon: Activity,
  },
  settings: {
    title: '自定义',
    subtitle: '自定义项目、端口、启动命令，以及首次记录后的复用启动。',
    icon: Settings2,
  },
}

function matchesSearch(service: ServiceItem, query: string) {
  if (!query) {
    return true
  }

  const normalized = query.toLowerCase()
  const numericQuery = /^\d+$/.test(normalized)

  if (numericQuery) {
    return [String(service.port), String(service.pid)].some((value) =>
      value.includes(normalized),
    )
  }

  return [
    service.customAlias ?? '',
    service.detectedName,
    service.command ?? '',
    service.cwd ?? '',
    service.path,
  ].some((value) => value.toLowerCase().includes(normalized))
}

function getServiceSortWeight(service: ServiceItem, mode: ServiceVisibilityMode) {
  const hasAlias = service.customAlias?.trim() ? 1 : 0
  const isProject = Boolean(getProjectMeta(service))

  if (mode === 'develop') {
    if (isProject) return 0
    if (hasAlias) return 1
    return 2
  }

  return hasAlias ? 0 : 1
}

function getProjectSortLabel(service: ServiceItem) {
  const meta = getProjectMeta(service)
  return meta?.label.toLowerCase() ?? ''
}

const DEV_ALLOW_KEYWORDS = [
  'node',
  'vite',
  'next',
  'react',
  'nuxt',
  'python',
  'django',
  'flask',
  'fastapi',
  'uvicorn',
  'gunicorn',
  'java',
  'spring',
  'tomcat',
  'go',
  'gin',
  'mysql',
  'mysqld',
  'redis',
  'postgres',
  'postgresql',
  'mongo',
  'nginx',
  'php',
  'apache',
  'docker',
  'container',
  'maven',
  'gradle',
]

const DEV_BLOCK_KEYWORDS = [
  'qq',
  'wechat',
  'wecom',
  'wechat',
  'cursor',
  'idea',
  'controlcenter',
  'rapportd',
  'wps',
  'lingma',
  'server-darwin-arm64',
  '/library/containers/',
  '/library/caches/',
  '/applications/wps',
]

function isDevelopService(service: ServiceItem) {
  if (service.source === 'docker') {
    return true
  }

  if (service.host === 'localhost') {
    const localPath = `${service.cwd ?? ''} ${service.path}`.toLowerCase()
    if (DEV_BLOCK_KEYWORDS.some((keyword) => localPath.includes(keyword))) {
      return false
    }

    if (getProjectMeta(service) || localPath.includes('/documents/')) {
      return true
    }
  }

  const corpus = [
    service.detectedName,
    service.command ?? '',
    service.path,
    service.cwd ?? '',
    service.containerName ?? '',
    service.image ?? '',
  ]
    .join(' ')
    .toLowerCase()

  if (service.launchedByPortMaster) {
    return true
  }

  if (DEV_BLOCK_KEYWORDS.some((keyword) => corpus.includes(keyword))) {
    return false
  }

  if (DEV_ALLOW_KEYWORDS.some((keyword) => corpus.includes(keyword))) {
    return true
  }

  return service.port === 3000 ||
    service.port === 3306 ||
    service.port === 3307 ||
    service.port === 5432 ||
    service.port === 6379 ||
    service.port === 8000 ||
    service.port === 8080
}

function openServiceUrl(service: ServiceItem) {
  const url = `http://${service.host || 'localhost'}:${service.port}`

  if (window.portmaster) {
    void window.portmaster.openExternal(url)
    return
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}

function App() {
  const {
    activeView,
    clearError,
    errorMessage,
    isLoading,
    isMutating,
    lastUpdatedAt,
    loadServices,
    launchService,
    searchQuery,
    refreshServices,
    services,
    setActiveView,
    setSearchQuery,
    setVisibilityMode,
    toggleRecord,
    toggleServiceStatus,
    updateAlias,
    visibilityMode,
  } = useServiceStore()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [helpOpen, setHelpOpen] = useState(false)
  const [launchDialogOpen, setLaunchDialogOpen] = useState(false)
  const [launchMode, setLaunchMode] = useState<'form' | 'terminal'>('form')
  const [launchForm, setLaunchForm] = useState({
    command: '',
    cwd: '',
    alias: '',
    expectedPort: '',
  })

  const pushToast = (toast: Omit<ToastItem, 'id'>) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((current) => [...current, { ...toast, id }])

    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id))
    }, 2600)
  }

  useEffect(() => {
    void loadServices()

    const interval = window.setInterval(() => {
      void refreshServices()
    }, 7000)

    return () => window.clearInterval(interval)
  }, [loadServices, refreshServices])

  const deferredSearch = useDeferredValue(searchQuery)

  const toUserMessage = (error: unknown, fallback: string) =>
    (error instanceof Error ? error.message : fallback)
      .replace(/^Error invoking remote method '[^']+':\s*/i, '')
      .replace(/^Error:\s*/i, '')
      .trim() || fallback

  const visibleServices = useMemo(() => {
    const scoped = services.filter((service) => {
      if (activeView === 'dashboard') {
        return service.source === 'local'
      }

      if (activeView === 'docker') {
        return service.source === 'docker'
      }

      return true
    })

    const modeFiltered = visibilityMode === 'all'
      ? scoped
      : scoped.filter((service) => isDevelopService(service))

    return modeFiltered
      .filter((service) => matchesSearch(service, deferredSearch))
      .sort((left, right) => {
        return (
          getServiceSortWeight(left, visibilityMode) - getServiceSortWeight(right, visibilityMode) ||
          getProjectSortLabel(left).localeCompare(getProjectSortLabel(right)) ||
          left.port - right.port ||
          left.detectedName.localeCompare(right.detectedName)
        )
      })
  }, [activeView, deferredSearch, services, visibilityMode])

  const activeCount = visibleServices.filter((service) => service.status === 'active').length
  const currentMeta = viewMeta[activeView]
  const ViewIcon = currentMeta.icon
  const showHero = activeView !== 'networkLogs' && activeView !== 'home'
  const refreshView = () => {
    void refreshServices()
      .then(() => {
        pushToast({
          title: '刷新完成',
          description: '已经重新扫描本地端口和 Docker 容器。',
          tone: 'success',
        })
      })
      .catch((error: Error) => {
        pushToast({
          title: '刷新失败',
          description: toUserMessage(error, '刷新失败。'),
          tone: 'error',
        })
      })
  }
  const submitLaunchLocalService = async () => {
    const command = launchForm.command.trim()
    if (!command) {
      pushToast({
        title: '请先填写启动命令',
        description: '输入命令后才能启动服务。',
        tone: 'error',
      })
      return
    }

    const cwd = launchForm.cwd.trim()
    const alias = launchForm.alias.trim()
    const expectedPort = launchForm.expectedPort.trim()
      ? Number(launchForm.expectedPort.trim())
      : undefined
    const payload: LocalLaunchInput = {
      command,
      cwd: cwd || undefined,
      alias: alias || undefined,
      expectedPort:
        expectedPort !== undefined && Number.isFinite(expectedPort) ? expectedPort : undefined,
    }

    try {
      await launchService(payload)
      setLaunchDialogOpen(false)
      pushToast({
        title: '已发送启动请求',
        description: payload.alias || payload.command,
        tone: 'success',
      })
    } catch (error) {
      pushToast({
        title: '启动失败',
        description: toUserMessage(error, '启动服务失败。'),
        tone: 'error',
      })
    }
  }

  const handleOpen = (service: ServiceItem) => {
    openServiceUrl(service)
    pushToast({
      title: '已打开服务',
      description: `http://${service.host || 'localhost'}:${service.port}`,
      tone: 'info',
    })
  }

  const handleAliasSave = async (id: string, alias: string) => {
    try {
      await updateAlias(id, alias)
      pushToast({
        title: alias.trim() ? '别名已保存' : '别名已清空',
        description: alias.trim() || '已移除自定义别名',
        tone: 'success',
      })
    } catch (error) {
      pushToast({
        title: '别名保存失败',
        description: toUserMessage(error, '保存别名失败。'),
        tone: 'error',
      })
    }
  }

  const handleToggleRecord = async (service: ServiceItem) => {
    try {
      await toggleRecord(service.id, service.recorded)
      pushToast({
        title: service.recorded ? '已取消记录' : '已记录服务',
        description: service.recorded
          ? `端口 ${service.port} 关闭后将不再保留记录。`
          : `端口 ${service.port} 关闭后仍会保留，后续可直接再次启动。`,
        tone: 'success',
      })
    } catch (error) {
      pushToast({
        title: service.recorded ? '取消记录失败' : '记录服务失败',
        description: toUserMessage(error, '更新服务记录失败。'),
        tone: 'error',
      })
    }
  }

  const handleToggleStatus = async (service: ServiceItem) => {
    try {
      await toggleServiceStatus(service.id)
      pushToast({
        title: service.status === 'active' ? '已发送关闭请求' : '已发送启动请求',
        description:
          service.status === 'active'
            ? `端口 ${service.port} 正在尝试关闭。`
            : `端口 ${service.port} 正在尝试启动。`,
        tone: 'success',
      })
    } catch (error) {
      pushToast({
        title: service.status === 'active' ? '关闭失败' : '启动失败',
        description: toUserMessage(error, '切换服务状态失败。'),
        tone: 'error',
      })
    }
  }

  const handleOpenLogs = () => {
    setActiveView('networkLogs')
  }

  const handleToggleGroupStatus = async (groupItems: ServiceItem[]) => {
    const activeItems = groupItems.filter((item) => item.status === 'active')
    const targets = activeItems.length > 0 ? activeItems : groupItems

    for (const service of targets) {
      await handleToggleStatus(service)
    }
  }

  const handleRecordGroup = async (groupItems: ServiceItem[]) => {
    const targets = groupItems.filter((item) => item.source === 'local' && !item.recorded)

    for (const service of targets) {
      await handleToggleRecord(service)
    }

    if (targets.length > 0) {
      pushToast({
        title: '项目已记录',
        description: `${targets.length} 个服务已写入可复用启动记录。`,
        tone: 'success',
      })
    }
  }

  return (
    <div className="min-h-screen bg-[#0F1115] text-slate-100 antialiased">
      <div className="pointer-events-none fixed right-6 top-6 z-[100] flex w-[320px] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.34)] backdrop-blur ${
              toast.tone === 'success'
                ? 'border-[#1f6f47] bg-[#10251a]/95'
                : toast.tone === 'error'
                  ? 'border-[#7b3636] bg-[#2b1619]/95'
                  : 'border-[#285b86] bg-[#11202e]/95'
            }`}
          >
            <div className="text-sm font-semibold text-white">{toast.title}</div>
            {toast.description ? (
              <div className="mt-1 text-xs text-slate-300">{toast.description}</div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex min-h-screen w-full bg-[radial-gradient(circle_at_top_left,rgba(36,150,237,0.14),transparent_26%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.08),transparent_28%),linear-gradient(180deg,#11141A,#0B0D12)]">
        <div className="hidden w-[250px] shrink-0 xl:block">
          <Sidebar activeItem={activeView} onSelect={setActiveView} />
        </div>

        <main className="flex min-h-screen min-w-0 flex-1 flex-col">
          <Toolbar
            value={searchQuery}
            onChange={setSearchQuery}
            onLaunch={() => setLaunchDialogOpen(true)}
            onRefresh={refreshView}
            onHelp={() => setHelpOpen(true)}
            visibilityMode={visibilityMode}
            onVisibilityModeChange={setVisibilityMode}
            isBusy={isLoading || isMutating}
          />

          <section className="flex-1 overflow-auto px-4 py-4 pr-8 xl:px-5 xl:py-5 xl:pr-10">
            {errorMessage ? (
              <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#5b2a2a] bg-[#2a1518] px-4 py-3 text-sm text-rose-100">
                <span>{errorMessage}</span>
                <button
                  type="button"
                  onClick={clearError}
                  className="rounded-lg border border-[#7b3636] px-3 py-1 text-xs text-rose-100 transition hover:bg-[#401c20]"
                >
                  关闭
                </button>
              </div>
            ) : null}

            {showHero ? (
              <div className="mb-4 rounded-[20px] border border-[#1c2933] bg-[linear-gradient(90deg,rgba(20,27,36,0.96),rgba(18,24,31,0.94),rgba(18,36,31,0.82))] px-6 py-5 shadow-[0_10px_40px_rgba(0,0,0,0.22)]">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl border border-[#2496ED]/20 bg-[#2496ED]/10">
                      <ViewIcon className="h-4.5 w-4.5 text-[#7CC6FF]" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-[#7CC6FF]">
                        PortMaster
                      </p>
                      <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white">
                        {currentMeta.title}
                      </h1>
                      <p className="mt-1 text-sm text-slate-400">{currentMeta.subtitle}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <div className="rounded-full border border-[#2b3640] bg-[#1b2129] px-4 py-2 text-sm text-slate-300">
                      {visibleServices.length} 个条目
                    </div>
                    <div className="rounded-full border border-[#25405a] bg-[#122130] px-4 py-2 text-sm text-[#8fcfff]">
                      {visibilityMode === 'develop' ? '开发模式' : '全部模式'}
                    </div>
                    <div className="rounded-full border border-[#1e6d44] bg-[#12311f] px-4 py-2 text-sm text-[#77f2ac]">
                      {activeCount} 运行中
                    </div>
                    {lastUpdatedAt ? (
                      <div className="rounded-full border border-[#253746] bg-[#121a23] px-4 py-2 text-sm text-slate-400">
                        更新于 {new Date(lastUpdatedAt).toLocaleTimeString()}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {activeView === 'home' ? (
              <HomePage />
            ) : activeView === 'networkLogs' ? (
              <LogsExplorer
                services={services}
                onRefresh={refreshView}
                isBusy={isLoading || isMutating}
                visibilityMode={visibilityMode}
                onVisibilityModeChange={setVisibilityMode}
              />
            ) : activeView === 'settings' ? (
              <SettingsPage services={services} onSaved={refreshView} />
            ) : (
              <ServiceTable
                items={visibleServices}
                groupProjects={visibilityMode === 'develop'}
                onAliasSave={handleAliasSave}
                onToggleRecord={(id) => {
                  const service = services.find((item) => item.id === id)
                  if (!service) return Promise.resolve()
                  return handleToggleRecord(service)
                }}
                onRecordGroup={handleRecordGroup}
                onOpenLogs={handleOpenLogs}
                onToggleStatus={(id) => {
                  const service = services.find((item) => item.id === id)
                  if (!service) return Promise.resolve()
                  return handleToggleStatus(service)
                }}
                onToggleGroupStatus={handleToggleGroupStatus}
                onOpen={handleOpen}
              />
            )}
          </section>
        </main>
      </div>

      {helpOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#04070bcc]/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[28px] border border-[#23303a] bg-[linear-gradient(180deg,#111821,#0c1218)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[#7CC6FF]">使用说明</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">PortMaster 怎么用</h2>
                <p className="mt-2 text-sm text-slate-400">
                  这是一个本机服务控制台，核心是把“发现服务”“记录项目”“再次启动”“查看日志”和“关闭端口”串成一套可重复使用的流程。
                </p>
              </div>

              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#2a333d] bg-[#1a2028] text-slate-400 transition hover:border-[#2496ED]/40 hover:bg-[#1c2631] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[#1f2a33] bg-[#101720] p-4">
                <div className="text-sm font-semibold text-white">1. 先看现有服务</div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  `仪表盘` 看本地进程，`Docker 容器` 看容器。上方搜索支持端口、别名、进程名和路径。
                </p>
              </div>

              <div className="rounded-2xl border border-[#1f2a33] bg-[#101720] p-4">
                <div className="text-sm font-semibold text-white">2. Record 是什么</div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  `Record` 会把当前服务的端口、工作目录和启动信息记下来。你手动在终端启动一次后，也可以在这里记录，后面就能直接点 `Start` 复用。
                </p>
              </div>

              <div className="rounded-2xl border border-[#1f2a33] bg-[#101720] p-4">
                <div className="text-sm font-semibold text-white">3. 手动命令也能接管</div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  如果自动识别不到合适命令，就到 `自定义` 里填写项目名、端口、工作目录和启动命令。常见 Java、Spring Boot、Node、Vue、Python、Go、Open WebUI、Ollama 都给了示例。
                </p>
              </div>

              <div className="rounded-2xl border border-[#1f2a33] bg-[#101720] p-4">
                <div className="text-sm font-semibold text-white">4. 启动 / 关闭 / 查看日志</div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  `Start` 会尝试用记录下来的命令再次启动，并校验端口是否真的起来。`Close` 会发送关闭请求。`View Logs` 用来排查为什么提示已请求启动但服务没真正起来。
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[#1f2a33] bg-[#0f151d] p-4 text-sm leading-6 text-slate-300">
                如果同一个项目下有多个端口，例如前端和后端，列表会按项目折叠显示。项目行支持“记录项目”和“全部启动 / 全部关闭”。
              </div>
              <div className="rounded-2xl border border-[#1f2a33] bg-[#0f151d] p-4 text-sm leading-6 text-slate-300">
                Docker 页会在发送启动后校验容器是否真的转为运行中。如果还是没起来，先看“查看日志”，再检查 Docker Desktop 和 compose 配置。
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {launchDialogOpen ? (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-[#04070bcc]/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[28px] border border-[#23303a] bg-[linear-gradient(180deg,#111821,#0c1218)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[#7CC6FF]">启动服务</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">输入启动命令</h2>
                <p className="mt-2 text-sm text-slate-400">
                  在这里输入命令、工作目录和预期端口，PortMaster 会校验端口是否真的启动成功，并把启动日志记录下来。
                </p>
              </div>

              <button
                type="button"
                onClick={() => setLaunchDialogOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#2a333d] bg-[#1a2028] text-slate-400 transition hover:border-[#2496ED]/40 hover:bg-[#1c2631] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6">
              <div className="mb-4 inline-flex rounded-2xl border border-[#23303a] bg-[#0e141c] p-1">
                {[
                  ['form', '表单模式'],
                  ['terminal', '命令行模式'],
                ].map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setLaunchMode(mode as 'form' | 'terminal')}
                    className={`rounded-xl px-4 py-2 text-sm transition ${
                      launchMode === mode
                        ? 'bg-[#16324a] text-[#8fcfff]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {launchMode === 'terminal' ? (
                <div className="space-y-4">
                  <div className="rounded-[24px] border border-[#1f2a33] bg-[linear-gradient(180deg,#0b1117,#0a0f14)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                    <div className="mb-4 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
                      <span className="ml-3 text-xs uppercase tracking-[0.24em] text-[#6f87a5]">embedded terminal</span>
                    </div>
                    <div className="space-y-3 font-mono text-sm text-slate-200">
                      <label className="block">
                        <div className="mb-2 text-xs uppercase tracking-[0.2em] text-[#7CC6FF]">$ command</div>
                        <textarea
                          value={launchForm.command}
                          onChange={(event) =>
                            setLaunchForm((current) => ({ ...current, command: event.target.value }))
                          }
                          rows={6}
                          placeholder="例如: npm run dev"
                          className="w-full rounded-2xl border border-[#22303d] bg-[#050a0f] px-4 py-3 font-mono text-sm text-slate-100 outline-none transition placeholder:text-[#5f7290] focus:border-[#2496ED]/60"
                        />
                      </label>

                      <div className="rounded-xl border border-dashed border-[#22303d] bg-[#071018] px-4 py-3 text-xs leading-6 text-[#6f87a5]">
                        像终端一样只输入命令即可。命令行模式适合你已经很熟悉启动方式，只想让 PortMaster 帮你接管启动和日志。
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="block">
                    <div className="mb-2 text-sm font-medium text-slate-200">命令</div>
                    <textarea
                      value={launchForm.command}
                      onChange={(event) =>
                        setLaunchForm((current) => ({ ...current, command: event.target.value }))
                      }
                      rows={4}
                      placeholder="例如: npm run dev"
                      className="w-full rounded-2xl border border-[#22303d] bg-[#0b1117] px-4 py-3 font-mono text-sm text-slate-100 outline-none transition placeholder:text-[#5f7290] focus:border-[#2496ED]/60"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <div className="mb-2 text-sm font-medium text-slate-200">工作目录</div>
                      <input
                        value={launchForm.cwd}
                        onChange={(event) =>
                          setLaunchForm((current) => ({ ...current, cwd: event.target.value }))
                        }
                        placeholder="/Users/xiangzai/project"
                        className="w-full rounded-xl border border-[#22303d] bg-[#0b1117] px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-[#5f7290] focus:border-[#2496ED]/60"
                      />
                    </label>

                    <label className="block">
                      <div className="mb-2 text-sm font-medium text-slate-200">别名</div>
                      <input
                        value={launchForm.alias}
                        onChange={(event) =>
                          setLaunchForm((current) => ({ ...current, alias: event.target.value }))
                        }
                        placeholder="例如: backend"
                        className="w-full rounded-xl border border-[#22303d] bg-[#0b1117] px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-[#5f7290] focus:border-[#2496ED]/60"
                      />
                    </label>
                  </div>

                  <label className="block max-w-[220px]">
                    <div className="mb-2 text-sm font-medium text-slate-200">预期端口</div>
                    <input
                      value={launchForm.expectedPort}
                      onChange={(event) =>
                        setLaunchForm((current) => ({
                          ...current,
                          expectedPort: event.target.value.replace(/[^\d]/g, ''),
                        }))
                      }
                      placeholder="例如: 8080"
                      className="w-full rounded-xl border border-[#22303d] bg-[#0b1117] px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-[#5f7290] focus:border-[#2496ED]/60"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setLaunchDialogOpen(false)}
                className="inline-flex h-11 items-center rounded-xl border border-[#2a333d] bg-[#1a2028] px-4 text-sm text-slate-200 transition hover:border-[#2496ED]/40 hover:bg-[#1c2631]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void submitLaunchLocalService()}
                className="inline-flex h-11 items-center rounded-xl border border-[#1f6f47] bg-[#133121] px-4 text-sm text-[#9bf3be] transition hover:border-[#22C55E]/50 hover:bg-[#174028]"
              >
                启动服务
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
