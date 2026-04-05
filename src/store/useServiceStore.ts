import { create } from 'zustand'

import { mockServices } from '../data/mockServices'
import type { AppView, ServiceItem, ServiceStatus } from '../types'

interface ServiceStore {
  activeView: AppView
  searchQuery: string
  expandedRows: string[]
  services: ServiceItem[]
  setActiveView: (view: AppView) => void
  setSearchQuery: (query: string) => void
  updateAlias: (id: string, alias: string) => void
  toggleLogs: (id: string) => void
  restartService: (id: string) => void
  toggleServiceStatus: (id: string) => void
}

function nextStatus(current: ServiceStatus): ServiceStatus {
  if (current === 'active') {
    return 'inactive'
  }

  return 'active'
}

export const useServiceStore = create<ServiceStore>((set) => ({
  activeView: 'dashboard',
  searchQuery: '',
  expandedRows: [],
  services: mockServices,
  setActiveView: (view) => set({ activeView: view }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  updateAlias: (id, alias) =>
    set((state) => ({
      services: state.services.map((service) =>
        service.id === id
          ? { ...service, customAlias: alias.trim() || undefined }
          : service,
      ),
    })),
  toggleLogs: (id) =>
    set((state) => ({
      expandedRows: state.expandedRows.includes(id)
        ? state.expandedRows.filter((rowId) => rowId !== id)
        : [...state.expandedRows, id],
    })),
  restartService: (id) =>
    set((state) => ({
      services: state.services.map((service) =>
        service.id === id
          ? {
              ...service,
              status: 'active',
              logs: [
                `[${new Date().toLocaleTimeString('en-GB', { hour12: false })}] INFO  restart requested from PortMaster`,
                ...service.logs,
              ].slice(0, 10),
            }
          : service,
      ),
    })),
  toggleServiceStatus: (id) =>
    set((state) => ({
      services: state.services.map((service) =>
        service.id === id
          ? {
              ...service,
              status: nextStatus(service.status),
              logs: [
                `[${new Date().toLocaleTimeString('en-GB', { hour12: false })}] INFO  ${
                  service.status === 'active' ? 'service stopped from dashboard' : 'service resumed from dashboard'
                }`,
                ...service.logs,
              ].slice(0, 10),
            }
          : service,
      ),
    })),
}))
