export type ServiceStatus = 'active' | 'inactive' | 'error'
export type ServiceSource = 'local' | 'docker'
export type ServiceProtocol = 'tcp' | 'udp'
export type ServiceVisibilityMode = 'develop' | 'all'

export type AppView =
  | 'home'
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
  projectId?: string
  projectLabel?: string
  projectPath?: string
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
  recordId?: string
}

export interface SavedServiceInput {
  id: string
}

export interface CustomServiceConfig {
  id: string
  projectLabel: string
  projectPath: string
  serviceName: string
  port: number
  host: string
  alias?: string
  command: string
  cwd?: string
  stackLabel?: string
  icon?: string
  notes?: string
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
  listCustomServices: () => Promise<CustomServiceConfig[]>
  saveCustomService: (input: CustomServiceConfig) => Promise<CustomServiceConfig[]>
  removeCustomService: (id: string) => Promise<CustomServiceConfig[]>
  clearServiceLogs: (ids: string[]) => Promise<ServiceItem[]>
}

export interface ToastItem {
  id: number
  title: string
  description?: string
  tone: 'success' | 'error' | 'info'
}
