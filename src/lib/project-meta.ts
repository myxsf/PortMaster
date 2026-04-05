import type { ServiceItem } from '../types'

export interface ProjectMeta {
  id: string
  label: string
  path: string
}

const INFRA_SERVICE_NAMES = new Set([
  'mysql',
  'mysqld',
  'redis',
  'postgresql',
  'postgres',
  'mongo',
  'mongodb',
  'nginx',
])

const PROJECT_LEAF_NAMES = new Set([
  'frontend',
  'backend',
  'client',
  'server',
  'web',
  'api',
  'admin',
  'app',
])

function normalizeProjectPath(value?: string) {
  return value?.replace(/\\/g, '/').replace(/\/+$/, '')
}

export function getProjectMeta(service: ServiceItem): ProjectMeta | null {
  if (service.projectId && service.projectLabel && service.projectPath) {
    return {
      id: service.projectId,
      label: service.projectLabel,
      path: service.projectPath,
    }
  }

  if (INFRA_SERVICE_NAMES.has(service.detectedName.toLowerCase())) {
    return null
  }

  const normalized = normalizeProjectPath(service.cwd ?? service.path)
  if (!normalized?.startsWith('/')) {
    return null
  }

  if (
    normalized.includes('/var/db/redis') ||
    normalized.includes('/var/lib/mysql') ||
    normalized.includes('/postgres')
  ) {
    return null
  }

  const segments = normalized.split('/').filter(Boolean)
  if (segments.length === 0) {
    return null
  }

  const leaf = segments[segments.length - 1]?.toLowerCase()
  const labelIndex =
    leaf && PROJECT_LEAF_NAMES.has(leaf) && segments.length >= 2
      ? segments.length - 2
      : segments.length - 1

  const projectPath = `/${segments.slice(0, labelIndex + 1).join('/')}`
  const projectLabel = segments[labelIndex]

  return {
    id: `project:${projectPath}`,
    label: projectLabel,
    path: projectPath,
  }
}
