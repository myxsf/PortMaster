import { useDeferredValue, useMemo } from 'react'
import { Activity, Boxes, Settings2, Workflow } from 'lucide-react'

import { Sidebar } from './components/Sidebar'
import { ServiceTable } from './components/ServiceTable'
import { Toolbar } from './components/Toolbar'
import { useServiceStore } from './store/useServiceStore'
import type { AppView, ServiceItem } from './types'

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

  return [
    String(service.port),
    service.customAlias ?? '',
    service.detectedName,
    service.path,
  ].some((value) => value.toLowerCase().includes(normalized))
}

function openServiceUrl(service: ServiceItem) {
  const url = `http://localhost:${service.port}`

  if (window.portmaster) {
    void window.portmaster.openExternal(url)
    return
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}

function copyServiceUrl(service: ServiceItem) {
  const value = `http://localhost:${service.port}`

  if (window.portmaster) {
    void window.portmaster.copyText(value)
    return
  }

  void navigator.clipboard.writeText(value)
}

function App() {
  const {
    activeView,
    expandedRows,
    searchQuery,
    services,
    setActiveView,
    setSearchQuery,
    toggleLogs,
    restartService,
    toggleServiceStatus,
    updateAlias,
  } = useServiceStore()

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

    return scoped.filter((service) => matchesSearch(service, deferredSearch))
  }, [activeView, deferredSearch, services])

  const activeCount = visibleServices.filter((service) => service.status === 'active').length
  const currentMeta = viewMeta[activeView]
  const ViewIcon = currentMeta.icon
  const refreshView = () => window.location.reload()

  return (
    <div className="min-h-screen bg-[#0F1115] text-slate-100 antialiased">
      <div className="flex min-h-screen w-full bg-[radial-gradient(circle_at_top_left,rgba(36,150,237,0.14),transparent_26%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.08),transparent_28%),linear-gradient(180deg,#11141A,#0B0D12)]">
        <div className="hidden w-[250px] shrink-0 xl:block">
          <Sidebar activeItem={activeView} onSelect={setActiveView} />
        </div>

        <main className="flex min-h-screen min-w-0 flex-1 flex-col">
          <Toolbar value={searchQuery} onChange={setSearchQuery} onRefresh={refreshView} />

          <section className="flex-1 overflow-auto px-4 py-4 pr-8 xl:px-5 xl:py-5 xl:pr-10">
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
                <div className="rounded-full border border-[#1e6d44] bg-[#12311f] px-4 py-2 text-sm text-[#77f2ac]">
                  {activeCount} active
                </div>
              </div>
            </div>
            </div>

            <ServiceTable
              items={visibleServices}
              expandedRows={expandedRows}
              onAliasSave={updateAlias}
              onToggleLogs={toggleLogs}
              onRestart={restartService}
              onToggleStatus={toggleServiceStatus}
              onOpen={openServiceUrl}
              onCopyUrl={copyServiceUrl}
            />
          </section>
        </main>
      </div>
    </div>
  )
}

export default App
