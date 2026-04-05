import { create } from 'zustand'

import type { AppView, LocalLaunchInput, ServiceItem, ServiceVisibilityMode } from '../types'

interface ServiceStore {
  activeView: AppView
  errorMessage?: string
  isLoading: boolean
  isMutating: boolean
  lastUpdatedAt?: number
  searchQuery: string
  visibilityMode: ServiceVisibilityMode
  expandedRows: string[]
  services: ServiceItem[]
  setActiveView: (view: AppView) => void
  setSearchQuery: (query: string) => void
  setVisibilityMode: (mode: ServiceVisibilityMode) => void
  clearError: () => void
  loadServices: () => Promise<void>
  refreshServices: () => Promise<void>
  launchService: (input: LocalLaunchInput) => Promise<void>
  updateAlias: (id: string, alias: string) => Promise<void>
  toggleRecord: (id: string, recorded: boolean) => Promise<void>
  toggleLogs: (id: string) => void
  restartService: (id: string) => Promise<void>
  toggleServiceStatus: (id: string) => Promise<void>
}

function normalizeDesktopError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : fallback

  return raw
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim() || fallback
}

function requireDesktopApi() {
  if (!window.portmaster) {
    throw new Error('当前没有连接到桌面应用，请直接打开 PortMaster 客户端。')
  }

  return window.portmaster
}

export const useServiceStore = create<ServiceStore>((set) => ({
  activeView: 'dashboard',
  errorMessage: undefined,
  isLoading: false,
  isMutating: false,
  lastUpdatedAt: undefined,
  searchQuery: '',
  visibilityMode: 'develop',
  expandedRows: [],
  services: [],
  setActiveView: (view) => set({ activeView: view }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setVisibilityMode: (mode) => set({ visibilityMode: mode }),
  clearError: () => set({ errorMessage: undefined }),
  loadServices: async () => {
    set({ isLoading: true, errorMessage: undefined })

    try {
      const services = await requireDesktopApi().listServices()

      set({
        services,
        isLoading: false,
        lastUpdatedAt: Date.now(),
      })
    } catch (error) {
      const message = normalizeDesktopError(error, '加载服务列表失败。')
      set({
        isLoading: false,
        errorMessage: message,
      })
      throw error instanceof Error ? error : new Error(message)
    }
  },
  refreshServices: async () => {
    set({ isMutating: true, errorMessage: undefined })

    try {
      const services = await requireDesktopApi().refreshServices()

      set({
        services,
        isMutating: false,
        lastUpdatedAt: Date.now(),
      })
    } catch (error) {
      const message = normalizeDesktopError(error, '刷新服务列表失败。')
      set({
        isMutating: false,
        errorMessage: message,
      })
      throw error instanceof Error ? error : new Error(message)
    }
  },
  launchService: async (input) => {
    set({ isMutating: true, errorMessage: undefined })

    try {
      const services = await requireDesktopApi().launchLocalService(input)

      set({
        services,
        isMutating: false,
        lastUpdatedAt: Date.now(),
      })
    } catch (error) {
      const message = normalizeDesktopError(error, '启动服务失败。')
      set({
        isMutating: false,
        errorMessage: message,
      })
      throw error instanceof Error ? error : new Error(message)
    }
  },
  updateAlias: async (id, alias) => {
    try {
      const services = await requireDesktopApi().saveAlias(id, alias)

      set({
        services,
        errorMessage: undefined,
        lastUpdatedAt: Date.now(),
      })
    } catch (error) {
      const message = normalizeDesktopError(error, '保存别名失败。')
      set({
        errorMessage: message,
      })
      throw error instanceof Error ? error : new Error(message)
    }
  },
  toggleRecord: async (id, recorded) => {
    try {
      const api = requireDesktopApi()
      const services = recorded
        ? await api.removeServiceRecord({ id })
        : await api.saveServiceRecord({ id })

      set({
        services,
        errorMessage: undefined,
        lastUpdatedAt: Date.now(),
      })
    } catch (error) {
      const message = normalizeDesktopError(error, '更新记录失败。')
      set({
        errorMessage: message,
      })
      throw error instanceof Error ? error : new Error(message)
    }
  },
  toggleLogs: (id) =>
    set((state) => ({
      expandedRows: state.expandedRows.includes(id)
        ? state.expandedRows.filter((rowId) => rowId !== id)
        : [...state.expandedRows, id],
    })),
  restartService: async (id) => {
    set({ isMutating: true, errorMessage: undefined })

    try {
      const services = await requireDesktopApi().restartService(id)

      set({
        services,
        isMutating: false,
        lastUpdatedAt: Date.now(),
      })
    } catch (error) {
      const message = normalizeDesktopError(error, '启动服务失败。')
      set({
        isMutating: false,
        errorMessage: message,
      })
      throw error instanceof Error ? error : new Error(message)
    }
  },
  toggleServiceStatus: async (id) => {
    const current = useServiceStore.getState().services.find((service) => service.id === id)
    if (!current) return

    set({ isMutating: true, errorMessage: undefined })

    try {
      const api = requireDesktopApi()
      const services =
        current.status === 'active'
          ? await api.stopService(id)
          : await api.restartService(id)

      set({
        services,
        isMutating: false,
        lastUpdatedAt: Date.now(),
      })
    } catch (error) {
      const message = normalizeDesktopError(error, '切换服务状态失败。')
      set({
        isMutating: false,
        errorMessage: message,
      })
      throw error instanceof Error ? error : new Error(message)
    }
  },
}))
