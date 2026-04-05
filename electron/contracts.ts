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
