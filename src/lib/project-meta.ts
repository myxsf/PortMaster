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

function isAbsoluteProjectPath(value?: string) {
  if (!value) return false
  return value.startsWith('/') || /^[A-Za-z]:\//.test(value)
}

function buildProjectPathFromSegments(segments: string[], endIndex: number) {
  const selected = segments.slice(0, endIndex + 1)
  if (selected.length === 0) return undefined

  const first = selected[0]
  if (/^[A-Za-z]:$/.test(first)) {
    return `${first}/${selected.slice(1).join('/')}`.replace(/\/+$/, '')
  }

  return `/${selected.join('/')}`.replace(/\/+$/, '')
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
  if (!normalized || !isAbsoluteProjectPath(normalized)) {
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

  const projectPath = buildProjectPathFromSegments(segments, labelIndex)
  const projectLabel = segments[labelIndex]

  if (!projectPath) {
    return null
  }

  return {
    id: `project:${projectPath}`,
    label: projectLabel,
    path: projectPath,
  }
}
