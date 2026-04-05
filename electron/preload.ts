import { contextBridge, ipcRenderer } from 'electron'

import type { CustomServiceConfig, LocalLaunchInput } from './contracts.js'

contextBridge.exposeInMainWorld('portmaster', {
  openExternal: async (url: string) => ipcRenderer.invoke('app:open-external', url),
  copyText: async (value: string) => ipcRenderer.invoke('app:copy-text', value),
  listServices: async () => ipcRenderer.invoke('services:list'),
  refreshServices: async () => ipcRenderer.invoke('services:refresh'),
  saveAlias: async (id: string, alias: string) =>
    ipcRenderer.invoke('services:alias', id, alias),
  saveServiceRecord: async (input: { id: string }) =>
    ipcRenderer.invoke('services:record', input),
  removeServiceRecord: async (input: { id: string }) =>
    ipcRenderer.invoke('services:unrecord', input),
  stopService: async (id: string) => ipcRenderer.invoke('services:stop', id),
  restartService: async (id: string) => ipcRenderer.invoke('services:restart', id),
  launchLocalService: async (input: LocalLaunchInput) =>
    ipcRenderer.invoke('services:launch-local', input),
  listCustomServices: async () => ipcRenderer.invoke('settings:custom-services:list'),
  saveCustomService: async (input: CustomServiceConfig) =>
    ipcRenderer.invoke('settings:custom-services:save', input),
  removeCustomService: async (id: string) =>
    ipcRenderer.invoke('settings:custom-services:remove', id),
  clearServiceLogs: async (ids: string[]) => ipcRenderer.invoke('services:logs:clear', ids),
})
