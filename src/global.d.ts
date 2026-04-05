import type { PortMasterApi } from './types'

export {}

declare global {
  interface Window {
    portmaster?: PortMasterApi
  }
}
