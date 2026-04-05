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

function requireDesktopApi() {
  if (!window.portmaster) {
    throw new Error('Desktop runtime API is unavailable. Please open PortMaster as the desktop app.')
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
      const message = error instanceof Error ? error.message : 'Unable to load services.'
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
      const message = error instanceof Error ? error.message : 'Unable to refresh services.'
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
      const message = error instanceof Error ? error.message : 'Unable to launch local service.'
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
      const message = error instanceof Error ? error.message : 'Unable to save alias.'
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
      const message = error instanceof Error ? error.message : 'Unable to update service record.'
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
      const message = error instanceof Error ? error.message : 'Unable to restart service.'
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
      const message =
        error instanceof Error ? error.message : 'Unable to change service state.'
      set({
        isMutating: false,
        errorMessage: message,
      })
      throw error instanceof Error ? error : new Error(message)
    }
  },
}))
