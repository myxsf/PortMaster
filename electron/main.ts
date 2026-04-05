import { app, BrowserWindow, clipboard, ipcMain, shell, type WebContents } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import {
  launchLocalService,
  listServices,
  removeServiceRecord,
  refreshServices,
  restartService,
  saveServiceRecord,
  saveAlias,
  stopService,
} from './service-manager.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function createWindow() {
  const window = new BrowserWindow({
    width: 1580,
    height: 980,
    minWidth: 1280,
    minHeight: 760,
    backgroundColor: '#0F1115',
    title: 'PortMaster',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL

  if (devServerUrl) {
    window.loadURL(devServerUrl)
    window.webContents.openDevTools({ mode: 'detach' })
    return
  }

  window.loadFile(path.join(__dirname, '../dist/index.html'))
}

app.whenReady().then(() => {
  app.setName('PortMaster')
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('web-contents-created', (_event: Electron.Event, contents: WebContents) => {
  contents.setWindowOpenHandler(({ url }: { url: string }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
})

ipcMain.handle('services:list', () => listServices())
ipcMain.handle('services:refresh', () => refreshServices())
ipcMain.handle('app:open-external', (_event, url: string) => shell.openExternal(url))
ipcMain.handle('app:copy-text', (_event, value: string) => clipboard.writeText(value))
ipcMain.handle('services:alias', (_event, id: string, alias: string) =>
  saveAlias(id, alias),
)
ipcMain.handle('services:record', (_event, input) => saveServiceRecord(input))
ipcMain.handle('services:unrecord', (_event, input) => removeServiceRecord(input))
ipcMain.handle('services:stop', (_event, id: string) => stopService(id))
ipcMain.handle('services:restart', (_event, id: string) => restartService(id))
ipcMain.handle('services:launch-local', (_event, input) => launchLocalService(input))
