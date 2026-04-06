import { app } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { launchLocalService, listServices, stopService } from '../service-manager.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '../..')
const fixtureScript = path.join(repoRoot, 'scripts/test-http-service.mjs')

const FORM_PORT = 43111
const TERMINAL_PORT = 43112

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

async function ensureStopped(port: number) {
  const services = await listServices()
  const matched = services.find((service) => service.port === port)
  if (matched) {
    await stopService(matched.id)
  }
}

async function run() {
  await app.whenReady()

  await ensureStopped(FORM_PORT)
  await ensureStopped(TERMINAL_PORT)

  console.log(`Starting form-mode smoke test on port ${FORM_PORT}...`)
  const formCommand = `node "${fixtureScript}" ${FORM_PORT}`
  const formServices = await launchLocalService({
    command: formCommand,
    cwd: repoRoot,
    alias: 'smoke-form',
    expectedPort: FORM_PORT,
  })
  const formMatched = formServices.find((service) => service.port === FORM_PORT)
  assert(formMatched, `Form mode did not detect port ${FORM_PORT}.`)
  assert(formMatched?.status === 'active', `Form mode service ${FORM_PORT} is not active.`)
  console.log(`Form mode passed: ${formMatched?.id}`)

  await stopService(formMatched!.id)
  const afterFormStop = await listServices()
  assert(!afterFormStop.find((service) => service.port === FORM_PORT), 'Form mode stop failed.')
  console.log(`Form mode stop passed: ${FORM_PORT} is closed.`)

  console.log(`Starting terminal-mode smoke test on port ${TERMINAL_PORT}...`)
  const terminalCommand = `cd "${repoRoot}" && node "./scripts/test-http-service.mjs" ${TERMINAL_PORT}`
  const terminalServices = await launchLocalService({
    command: terminalCommand,
    alias: 'smoke-terminal',
  })
  const terminalMatched = terminalServices.find((service) => service.port === TERMINAL_PORT)
  assert(terminalMatched, `Terminal mode did not detect port ${TERMINAL_PORT}.`)
  assert(
    terminalMatched?.status === 'active',
    `Terminal mode service ${TERMINAL_PORT} is not active.`,
  )
  console.log(`Terminal mode passed: ${terminalMatched?.id}`)

  await stopService(terminalMatched!.id)
  const afterTerminalStop = await listServices()
  assert(
    !afterTerminalStop.find((service) => service.port === TERMINAL_PORT),
    'Terminal mode stop failed.',
  )
  console.log(`Terminal mode stop passed: ${TERMINAL_PORT} is closed.`)

  console.log('Launch smoke test finished successfully.')
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => {
    void app.quit()
  })
