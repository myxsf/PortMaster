export {}

declare global {
  interface Window {
    portmaster?: {
      openExternal: (url: string) => Promise<void>
      copyText: (value: string) => Promise<void>
    }
  }
}
