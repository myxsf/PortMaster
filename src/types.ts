export type ServiceStatus = 'active' | 'inactive' | 'error'
export type ServiceSource = 'local' | 'docker'

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
}
