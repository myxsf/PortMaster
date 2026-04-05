export type ServiceStatus = 'active' | 'inactive' | 'error'
export type ServiceSource = 'local' | 'docker'
export type ServiceProtocol = 'tcp' | 'udp'
export type ServiceVisibilityMode = 'develop' | 'all'

export type AppView =
  | 'dashboard'
  | 'docker'
  | 'topology'
  | 'networkLogs'
  | 'settings'

export interface ServiceItem {
  id: string
  port: number
  pid: number
  status: ServiceStatus
  source: ServiceSource
  customAlias?: string
  detectedName: string
  path: string
  uptime: string
  logs: string[]
  host: string
  protocol: ServiceProtocol
  command?: string
  cwd?: string
  containerId?: string
  containerName?: string
  image?: string
  restartable: boolean
  stoppable: boolean
  recordable: boolean
  recorded: boolean
  launchedByPortMaster?: boolean
  notes?: string
}

export interface LocalLaunchInput {
  command: string
  cwd?: string
  alias?: string
  expectedPort?: number
}

export interface SavedServiceInput {
  id: string
}

export interface PortMasterApi {
  openExternal: (url: string) => Promise<void>
  copyText: (value: string) => Promise<void>
  listServices: () => Promise<ServiceItem[]>
  refreshServices: () => Promise<ServiceItem[]>
  saveAlias: (id: string, alias: string) => Promise<ServiceItem[]>
  stopService: (id: string) => Promise<ServiceItem[]>
  restartService: (id: string) => Promise<ServiceItem[]>
  launchLocalService: (input: LocalLaunchInput) => Promise<ServiceItem[]>
  saveServiceRecord: (input: SavedServiceInput) => Promise<ServiceItem[]>
  removeServiceRecord: (input: SavedServiceInput) => Promise<ServiceItem[]>
}

export interface ToastItem {
  id: number
  title: string
  description?: string
  tone: 'success' | 'error' | 'info'
}
