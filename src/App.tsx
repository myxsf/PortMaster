import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Activity, Boxes, Settings2, Workflow, X } from 'lucide-react'

import { Sidebar } from './components/Sidebar'
import { ServiceTable } from './components/ServiceTable'
import { Toolbar } from './components/Toolbar'
import { useServiceStore } from './store/useServiceStore'
import type {
  AppView,
  LocalLaunchInput,
  ServiceItem,
  ToastItem,
} from './types'

const viewMeta: Record<AppView, { title: string; subtitle: string; icon: typeof Activity }> = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Local processes with instant port visibility.',
    icon: Activity,
  },
  docker: {
    title: 'Docker Containers',
    subtitle: 'Only Docker-backed services are shown in this view.',
    icon: Boxes,
  },
  topology: {
    title: 'Port Topology',
    subtitle: 'Topology view can later reuse the same service source of truth.',
    icon: Workflow,
  },
  networkLogs: {
    title: 'Network Logs',
    subtitle: 'Monitor runtime events and service stream output.',
    icon: Activity,
  },
  settings: {
    title: 'Settings',
    subtitle: 'Settings stays in-app while you keep service visibility nearby.',
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
]

function isDevelopService(service: ServiceItem) {
  if (service.source === 'docker') {
    return true
  }

  if (service.host === 'localhost') {
    const localPath = `${service.cwd ?? ''} ${service.path}`.toLowerCase()
    if (localPath.includes('/users/') || localPath.includes('/documents/')) {
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

function copyServiceUrl(service: ServiceItem) {
  const value = `http://${service.host || 'localhost'}:${service.port}`

  if (window.portmaster) {
    void window.portmaster.copyText(value)
    return
  }

  void navigator.clipboard.writeText(value)
}

function App() {
  const {
    activeView,
    clearError,
    errorMessage,
    expandedRows,
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
    toggleLogs,
    toggleRecord,
    toggleServiceStatus,
    updateAlias,
    visibilityMode,
  } = useServiceStore()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [helpOpen, setHelpOpen] = useState(false)

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
        const leftAliased = left.customAlias?.trim() ? 1 : 0
        const rightAliased = right.customAlias?.trim() ? 1 : 0

        return rightAliased - leftAliased || left.port - right.port || left.detectedName.localeCompare(right.detectedName)
      })
  }, [activeView, deferredSearch, services, visibilityMode])

  const activeCount = visibleServices.filter((service) => service.status === 'active').length
  const currentMeta = viewMeta[activeView]
  const ViewIcon = currentMeta.icon
  const refreshView = () => {
    void refreshServices()
      .then(() => {
        pushToast({
          title: 'Refresh completed',
          description: 'PortMaster rescanned local ports and Docker containers.',
          tone: 'success',
        })
      })
      .catch((error: Error) => {
        pushToast({
          title: 'Refresh failed',
          description: error.message,
          tone: 'error',
        })
      })
  }
  const launchLocalService = async () => {
    const command = window.prompt(
      'Command to run',
      'npm run dev',
    )

    if (!command?.trim()) {
      return
    }

    const cwd = window.prompt(
      'Working directory (optional)',
      '',
    )?.trim()

    const alias = window.prompt('Alias (optional)', '')?.trim()
    const portInput = window.prompt('Expected port (optional)', '')
    const expectedPort = portInput?.trim() ? Number(portInput.trim()) : undefined

    const payload: LocalLaunchInput = {
      command: command.trim(),
      cwd: cwd || undefined,
      alias: alias || undefined,
      expectedPort: Number.isFinite(expectedPort) ? expectedPort : undefined,
    }

    try {
      await launchService(payload)
      pushToast({
        title: 'Launch requested',
        description: payload.alias || payload.command,
        tone: 'success',
      })
    } catch (error) {
      pushToast({
        title: 'Launch failed',
        description: error instanceof Error ? error.message : 'Unable to launch service.',
        tone: 'error',
      })
    }
  }

  const handleOpen = (service: ServiceItem) => {
    openServiceUrl(service)
    pushToast({
      title: 'Opened service',
      description: `http://${service.host || 'localhost'}:${service.port}`,
      tone: 'info',
    })
  }

  const handleCopyUrl = (service: ServiceItem) => {
    copyServiceUrl(service)
    pushToast({
      title: 'URL copied',
      description: `localhost:${service.port}`,
      tone: 'success',
    })
  }

  const handleAliasSave = async (id: string, alias: string) => {
    try {
      await updateAlias(id, alias)
      pushToast({
        title: alias.trim() ? 'Alias saved' : 'Alias cleared',
        description: alias.trim() || 'Custom alias removed',
        tone: 'success',
      })
    } catch (error) {
      pushToast({
        title: 'Alias update failed',
        description: error instanceof Error ? error.message : 'Unable to update alias.',
        tone: 'error',
      })
    }
  }

  const handleToggleRecord = async (service: ServiceItem) => {
    try {
      await toggleRecord(service.id, service.recorded)
      pushToast({
        title: service.recorded ? 'Record removed' : 'Service recorded',
        description: service.recorded
          ? `Port ${service.port} will disappear after stop.`
          : `Port ${service.port} will stay available for future start.`,
        tone: 'success',
      })
    } catch (error) {
      pushToast({
        title: service.recorded ? 'Remove record failed' : 'Record failed',
        description:
          error instanceof Error ? error.message : 'Unable to update service record.',
        tone: 'error',
      })
    }
  }

  const handleToggleStatus = async (service: ServiceItem) => {
    try {
      await toggleServiceStatus(service.id)
      pushToast({
        title: service.status === 'active' ? 'Service stopped' : 'Service start requested',
        description:
          service.status === 'active'
            ? `Port ${service.port} received a stop request.`
            : `Port ${service.port} received a start request.`,
        tone: 'success',
      })
    } catch (error) {
      pushToast({
        title: service.status === 'active' ? 'Stop failed' : 'Start failed',
        description: error instanceof Error ? error.message : 'Unable to change service state.',
        tone: 'error',
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
            onLaunch={launchLocalService}
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
                  Dismiss
                </button>
              </div>
            ) : null}

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
                  {visibleServices.length} visible
                </div>
                <div className="rounded-full border border-[#25405a] bg-[#122130] px-4 py-2 text-sm text-[#8fcfff]">
                  {visibilityMode === 'develop' ? 'Develop mode' : 'All mode'}
                </div>
                <div className="rounded-full border border-[#1e6d44] bg-[#12311f] px-4 py-2 text-sm text-[#77f2ac]">
                  {activeCount} active
                </div>
                {lastUpdatedAt ? (
                  <div className="rounded-full border border-[#253746] bg-[#121a23] px-4 py-2 text-sm text-slate-400">
                    updated {new Date(lastUpdatedAt).toLocaleTimeString()}
                  </div>
                ) : null}
              </div>
            </div>
            </div>

            <ServiceTable
              items={visibleServices}
              expandedRows={expandedRows}
              onAliasSave={handleAliasSave}
              onToggleRecord={(id) => {
                const service = services.find((item) => item.id === id)
                if (!service) return Promise.resolve()
                return handleToggleRecord(service)
              }}
              onToggleLogs={toggleLogs}
              onToggleStatus={(id) => {
                const service = services.find((item) => item.id === id)
                if (!service) return Promise.resolve()
                return handleToggleStatus(service)
              }}
              onOpen={handleOpen}
              onCopyUrl={handleCopyUrl}
            />
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
                  这是一个本机服务面板，主要用来查看 localhost 端口、Docker 容器，以及记录你常开的开发服务。
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
                <div className="text-sm font-semibold text-white">1. 看服务</div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  `Dashboard` 看本地进程，`Docker Containers` 看容器。上方搜索支持端口、别名、进程名和路径。
                </p>
              </div>

              <div className="rounded-2xl border border-[#1f2a33] bg-[#101720] p-4">
                <div className="text-sm font-semibold text-white">2. Record 是什么</div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  `Record` 会把当前服务的启动信息记下来。这样你把它关掉以后，列表里还会保留一条记录，之后可以直接再 `Start`。
                </p>
              </div>

              <div className="rounded-2xl border border-[#1f2a33] bg-[#101720] p-4">
                <div className="text-sm font-semibold text-white">3. Open / View Logs / Close</div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  `Open` 会打开浏览器，`View Logs` 看最近日志。对已记录或由 PortMaster 拉起的服务，运行中显示 `Close`，更贴近“关闭本地服务”的意思。
                </p>
              </div>

              <div className="rounded-2xl border border-[#1f2a33] bg-[#101720] p-4">
                <div className="text-sm font-semibold text-white">4. Develop 模式</div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  `Develop` 默认优先显示开发相关服务，`All` 会放开全部。你本地启动的大多数 localhost 服务都会被归到开发视图里。
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#1f2a33] bg-[#0f151d] p-4 text-sm leading-6 text-slate-300">
              如果同一个项目下有多个端口，例如前端和后端，列表会按项目折叠显示。点击项目行可以展开对应端口。
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
