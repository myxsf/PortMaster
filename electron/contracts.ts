export type ServiceStatus = 'active' | 'inactive' | 'error'
export type ServiceSource = 'local' | 'docker'
export type ServiceProtocol = 'tcp' | 'udp'

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
