import { clipboard, contextBridge, shell } from 'electron'

contextBridge.exposeInMainWorld('portmaster', {
  openExternal: async (url: string) => shell.openExternal(url),
  copyText: async (value: string) => clipboard.writeText(value),
})
