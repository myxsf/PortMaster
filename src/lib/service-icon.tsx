import type { IconType } from 'react-icons'
import {
  SiDocker,
  SiMysql,
  SiNginx,
  SiNodedotjs,
  SiPostgresql,
  SiPython,
  SiRedis,
  SiSpringboot,
  SiVite,
} from 'react-icons/si'

interface ServiceIconMeta {
  icon: IconType
  className: string
}

const defaultMeta: ServiceIconMeta = {
  icon: SiNodedotjs,
  className: 'text-emerald-300',
}

export function getServiceIcon(label: string): ServiceIconMeta {
  const normalized = label.toLowerCase()

  if (normalized.includes('spring')) {
    return { icon: SiSpringboot, className: 'text-emerald-400' }
  }

  if (normalized.includes('vite')) {
    return { icon: SiVite, className: 'text-violet-300' }
  }

  if (normalized.includes('python') || normalized.includes('django')) {
    return { icon: SiPython, className: 'text-yellow-300' }
  }

  if (normalized.includes('mysql')) {
    return { icon: SiMysql, className: 'text-sky-300' }
  }

  if (normalized.includes('redis')) {
    return { icon: SiRedis, className: 'text-rose-300' }
  }

  if (normalized.includes('postgres')) {
    return { icon: SiPostgresql, className: 'text-blue-300' }
  }

  if (normalized.includes('nginx')) {
    return { icon: SiNginx, className: 'text-emerald-300' }
  }

  if (normalized.includes('docker')) {
    return { icon: SiDocker, className: 'text-sky-300' }
  }

  if (normalized.includes('node')) {
    return { icon: SiNodedotjs, className: 'text-lime-300' }
  }

  return defaultMeta
}
