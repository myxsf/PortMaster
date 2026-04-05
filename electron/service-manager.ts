import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'

import type {
  LocalLaunchInput,
  SavedServiceInput,
  ServiceItem,
  ServiceProtocol,
  ServiceSource,
  ServiceStatus,
} from './contracts.js'

const execFileAsync = promisify(execFile)
let cachedDockerBinary: string | null | undefined

interface PersistedRegistry {
  aliases: Record<string, string>
  actionLogs: Record<string, string[]>
  localLaunches: Record<string, PersistedLaunch>
  savedServices: Record<string, SavedService>
}

interface PersistedLaunch {
  alias?: string
  command: string
  cwd?: string
  expectedPort?: number
  logFile: string
  lastKnownPort?: number
  launcherPid?: number
}

interface SavedService {
  alias?: string
  command: string
  cwd?: string
  port: number
  host: string
  protocol: ServiceProtocol
  detectedName: string
  path: string
  source: ServiceSource
}

interface LocalRuntime {
  port: number
  pid: number
  host: string
  protocol: ServiceProtocol
  commandName: string
  command: string
  cwd?: string
  uptime: string
  path: string
}

interface DockerRuntime {
  id: string
  containerId: string
  containerName: string
  image: string
  port: number
  host: string
  protocol: ServiceProtocol
  uptime: string
  status: ServiceStatus
  path: string
  pid: number
  logs: string[]
}

interface DockerListResult {
  services: DockerRuntime[]
  error?: string
}

const DEFAULT_REGISTRY: PersistedRegistry = {
  aliases: {},
  actionLogs: {},
  localLaunches: {},
  savedServices: {},
}

const COMMON_APP_PORTS = new Set([
  3000,
  3001,
  4173,
  4200,
  5173,
  5432,
  6379,
  8000,
  8080,
  8081,
  9000,
])

function registryPath() {
  return path.join(app.getPath('userData'), 'service-registry.json')
}

function logsDir() {
  return path.join(app.getPath('userData'), 'logs')
}

async function ensureRuntimeDirs() {
  await fs.mkdir(path.dirname(registryPath()), { recursive: true })
  await fs.mkdir(logsDir(), { recursive: true })
}

async function resolveDockerBinary() {
  if (cachedDockerBinary !== undefined) {
    return cachedDockerBinary
  }

  const candidates = [
    process.env.DOCKER_BIN,
    '/Applications/Docker.app/Contents/Resources/bin/docker',
    '/usr/local/bin/docker',
    '/opt/homebrew/bin/docker',
    'docker',
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    try {
      if (candidate.includes('/')) {
        await fs.access(candidate)
      }

      await execFileAsync(candidate, ['version', '--format', '{{.Client.Version}}'])
      cachedDockerBinary = candidate
      return candidate
    } catch {
      continue
    }
  }

  cachedDockerBinary = null
  return null
}

async function readRegistry(): Promise<PersistedRegistry> {
  await ensureRuntimeDirs()

  try {
    const content = await fs.readFile(registryPath(), 'utf8')
    const parsed = JSON.parse(content) as Partial<PersistedRegistry>

    return {
      aliases: parsed.aliases ?? {},
      actionLogs: parsed.actionLogs ?? {},
      localLaunches: parsed.localLaunches ?? {},
      savedServices: parsed.savedServices ?? {},
    }
  } catch {
    return DEFAULT_REGISTRY
  }
}

async function writeRegistry(registry: PersistedRegistry) {
  await ensureRuntimeDirs()
  await fs.writeFile(registryPath(), JSON.stringify(registry, null, 2), 'utf8')
}

function detectName(label: string) {
  const normalized = label.toLowerCase()

  if (normalized.includes('spring')) return 'Spring Boot'
  if (normalized.includes('vite')) return 'Vite'
  if (normalized.includes('next')) return 'Next.js'
  if (normalized.includes('node')) return 'Node.js'
  if (normalized.includes('python')) return 'Python'
  if (normalized.includes('django')) return 'Python Django'
  if (normalized.includes('java')) return 'Java'
  if (normalized.includes('mysql')) return 'MySQL'
  if (normalized.includes('redis')) return 'Redis'
  if (normalized.includes('postgres')) return 'PostgreSQL'
  if (normalized.includes('nginx')) return 'Nginx'

  return label
}

function decodeEscapedText(value: string) {
  if (!value.includes('\\x')) {
    return value
  }

  try {
    return decodeURIComponent(
      value.replaceAll('%', '%25').replace(/\\x([0-9a-fA-F]{2})/g, '%$1'),
    )
  } catch {
    return value
  }
}

function formatElapsed(raw: string) {
  const value = raw.trim()
  if (!value) return 'unknown'

  const dayMatch = value.match(/^(\d+)-(\d+):(\d+):(\d+)$/)
  if (dayMatch) {
    const [, day, hour, minute] = dayMatch
    return `${day}d ${hour}h ${minute}m`
  }

  const hourMatch = value.match(/^(\d+):(\d+):(\d+)$/)
  if (hourMatch) {
    const [, hour, minute] = hourMatch
    return `${Number(hour)}h ${minute}m`
  }

  const minuteMatch = value.match(/^(\d+):(\d+)$/)
  if (minuteMatch) {
    const [, minute] = minuteMatch
    return `${Number(minute)}m`
  }

  return value
}

function nowLogStamp() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false })
}

function appendActionLog(registry: PersistedRegistry, id: string, message: string) {
  const current = registry.actionLogs[id] ?? []
  registry.actionLogs[id] = [`[${nowLogStamp()}] PM    ${message}`, ...current].slice(0, 20)
}

function mergeLogs(...groups: string[][]) {
  return groups
    .flat()
    .filter(Boolean)
    .slice(0, 20)
}

async function readLogTail(filePath?: string) {
  if (!filePath) return []

  try {
    const content = await fs.readFile(filePath, 'utf8')
    return content.split(/\r?\n/).filter(Boolean).slice(-10).reverse()
  } catch {
    return []
  }
}

async function getProcessInfo(pid: number) {
  try {
    const { stdout } = await execFileAsync('ps', [
      '-o',
      'command=',
      '-o',
      'etime=',
      '-o',
      'comm=',
      '-p',
      String(pid),
    ])

    const lines = stdout
      .split('\n')
      .map((line) => line.trimEnd())
      .filter(Boolean)

    const line = decodeEscapedText(lines[0] ?? '')
    const match = line.match(/^(.*\S)\s+(\S+)\s+(\S+)$/)

    if (!match) {
      return {
        command: line.trim(),
        uptime: 'unknown',
        commandName: 'unknown',
      }
    }

    return {
      command: decodeEscapedText(match[1].trim()),
      uptime: formatElapsed(match[2]),
      commandName: decodeEscapedText(match[3].trim()),
    }
  } catch {
    return {
      command: '',
      uptime: 'unknown',
      commandName: 'unknown',
    }
  }
}

async function getProcessCwd(pid: number) {
  try {
    const { stdout } = await execFileAsync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'])
    const cwdLine = stdout
      .split('\n')
      .find((line) => line.startsWith('n'))

    return cwdLine ? decodeEscapedText(cwdLine.slice(1)) : undefined
  } catch {
    return undefined
  }
}

async function resolveLaunchShell() {
  if (process.platform === 'win32') {
    return process.env.ComSpec || 'cmd.exe'
  }

  const candidates = [
    process.env.SHELL,
    '/bin/zsh',
    '/bin/bash',
    '/bin/sh',
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      continue
    }
  }

  return '/bin/sh'
}

function getCommandToken(command?: string) {
  const first = command?.trim().split(/\s+/)[0] ?? ''
  return path.basename(first).toLowerCase()
}

function getLaunchMatchScore(
  runtime: LocalRuntime,
  input: LocalLaunchInput,
  launcherPid?: number,
) {
  let score = 0
  const normalizedRuntimeCommand = runtime.command.toLowerCase()
  const normalizedRuntimeName = runtime.commandName.toLowerCase()
  const normalizedRuntimeCwd = runtime.cwd?.toLowerCase()
  const normalizedInputCwd = input.cwd?.toLowerCase()
  const commandToken = getCommandToken(input.command)

  if (input.expectedPort && runtime.port === input.expectedPort) {
    score += 10_000
  }

  if (launcherPid && runtime.pid === launcherPid) {
    score += 2_000
  }

  if (normalizedInputCwd && normalizedRuntimeCwd === normalizedInputCwd) {
    score += 1_200
  }

  if (normalizedInputCwd && runtime.path.toLowerCase() === normalizedInputCwd) {
    score += 800
  }

  if (commandToken && normalizedRuntimeName.includes(commandToken)) {
    score += 280
  }

  if (commandToken && normalizedRuntimeCommand.includes(commandToken)) {
    score += 180
  }

  if (COMMON_APP_PORTS.has(runtime.port)) {
    score += 90
  }

  if (runtime.port < 10_000) {
    score += 20
  }

  return score
}

async function waitForLocalPortState(port: number, expectedRunning: boolean, timeoutMs = 1500) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const services = await listLocalServices()
    const isRunning = services.some((service) => service.port === port)

    if (isRunning === expectedRunning) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 120))
  }
}

async function listLocalServices() {
  const { stdout } = await execFileAsync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpcn'])
  const lines = stdout.split('\n').filter(Boolean)
  const runtimes: LocalRuntime[] = []

  let currentPid = 0
  let currentCommandName = ''

  for (const line of lines) {
    const value = line.slice(1)

    if (line.startsWith('p')) {
      currentPid = Number(value)
      currentCommandName = ''
      continue
    }

    if (line.startsWith('c')) {
      currentCommandName = decodeEscapedText(value)
      continue
    }

    if (!line.startsWith('n')) continue

    const normalized = decodeEscapedText(value.trim())
    const portMatch = normalized.match(/:(\d+)$/)
    if (!portMatch || !currentPid) continue

    const port = Number(portMatch[1])
    const rawHost = normalized.slice(0, normalized.lastIndexOf(':'))
    const host = rawHost === '*' || rawHost === '[::1]' || rawHost === '::1'
      ? 'localhost'
      : rawHost || 'localhost'
    const info = await getProcessInfo(currentPid)
    const cwd = await getProcessCwd(currentPid)

    runtimes.push({
      port,
      pid: currentPid,
      host,
      protocol: 'tcp',
      commandName: currentCommandName || info.commandName,
      command: info.command,
      cwd,
      uptime: info.uptime,
      path: cwd || info.command,
    })
  }

  const deduped = new Map<number, LocalRuntime>()
  for (const runtime of runtimes) {
    deduped.set(runtime.port, runtime)
  }

  return [...deduped.values()].sort((a, b) => a.port - b.port)
}

function parseDockerPorts(input: string) {
  const matches = [...input.matchAll(/(?:0\.0\.0\.0:|\[::\]:)?(\d+)->(\d+)\/(tcp|udp)/g)]

  return matches.map((match) => ({
    hostPort: Number(match[1]),
    containerPort: Number(match[2]),
    protocol: match[3] as ServiceProtocol,
  }))
}

async function listDockerServices(): Promise<DockerListResult> {
  try {
    const dockerBinary = await resolveDockerBinary()
    if (!dockerBinary) {
      return {
        services: [],
        error: 'Docker CLI was not found. Open Docker Desktop or install the Docker CLI.',
      }
    }

    const { stdout } = await execFileAsync(dockerBinary, ['ps', '-a', '--format', '{{json .}}'])
    const lines = stdout.split('\n').filter(Boolean)
    const services: DockerRuntime[] = []

    for (const line of lines) {
      const item = JSON.parse(line) as {
        ID: string
        Image: string
        Names: string
        Ports: string
        Status: string
      }

      const ports = parseDockerPorts(item.Ports)
      if (ports.length === 0) continue

      let logs: string[] = []
      try {
        const logOutput = await execFileAsync(dockerBinary, ['logs', '--tail', '10', item.ID])
        logs = `${logOutput.stdout}\n${logOutput.stderr}`
          .split(/\r?\n/)
          .filter(Boolean)
          .slice(-10)
          .reverse()
      } catch {
        logs = []
      }

      for (const mapped of ports) {
        services.push({
          id: `docker:${item.ID}:${mapped.hostPort}`,
          containerId: item.ID,
          containerName: item.Names,
          image: item.Image,
          port: mapped.hostPort,
          host: 'localhost',
          protocol: mapped.protocol,
          uptime: item.Status,
          status: item.Status.toLowerCase().includes('up') ? 'active' : 'inactive',
          path: item.Image,
          pid: 0,
          logs,
        })
      }
    }

    return { services: services.sort((a, b) => a.port - b.port) }
  } catch (error) {
    return {
      services: [],
      error: error instanceof Error ? error.message : 'Unable to query Docker containers.',
    }
  }
}

function toSavedService(
  runtime: LocalRuntime,
  launchMeta: PersistedLaunch | undefined,
  alias: string | undefined,
): SavedService {
  return {
    alias,
    command: launchMeta?.command ?? runtime.command,
    cwd: launchMeta?.cwd ?? runtime.cwd,
    port: runtime.port,
    host: runtime.host,
    protocol: runtime.protocol,
    detectedName: detectName(runtime.commandName),
    path: runtime.path,
    source: 'local',
  }
}

export async function listServices(): Promise<ServiceItem[]> {
  const registry = await readRegistry()
  const dockerResult = await listDockerServices()
  const docker = dockerResult.services
  const dockerPorts = new Set(docker.map((service) => service.port))
  const local = (await listLocalServices()).filter((runtime) => !dockerPorts.has(runtime.port))

  const localServices = await Promise.all(
    local.map(async (runtime) => {
      const id = `local:${runtime.port}`
      const launchMeta = registry.localLaunches[id]
      const alias = registry.aliases[id] ?? launchMeta?.alias
      const runtimeLogs = await readLogTail(launchMeta?.logFile)
      const logs = mergeLogs(registry.actionLogs[id] ?? [], runtimeLogs)

      if (launchMeta) {
        launchMeta.lastKnownPort = runtime.port
      }

      return {
        id,
        port: runtime.port,
        pid: runtime.pid,
        status: 'active' as ServiceStatus,
        source: 'local' as ServiceSource,
        customAlias: alias,
        detectedName: detectName(runtime.commandName),
        path: runtime.path,
        uptime: runtime.uptime,
        logs,
        host: runtime.host,
        protocol: runtime.protocol,
        command: launchMeta?.command ?? runtime.command,
        cwd: launchMeta?.cwd ?? runtime.cwd,
        restartable: Boolean(launchMeta?.command),
        stoppable: true,
        recordable: true,
        recorded: Boolean(registry.savedServices[id]),
        launchedByPortMaster: Boolean(launchMeta),
      }
    }),
  )

  const activeLocalIds = new Set(localServices.map((service) => service.id))
  const rememberedServices: ServiceItem[] = Object.entries(registry.savedServices)
    .filter(([id, saved]) => saved.source === 'local' && !activeLocalIds.has(id))
    .map(([id, saved]) => ({
      id,
      port: saved.port,
      pid: 0,
      status: 'inactive' as ServiceStatus,
      source: 'local' as ServiceSource,
      customAlias: registry.aliases[id] ?? saved.alias,
      detectedName: saved.detectedName,
      path: saved.path,
      uptime: 'stopped',
      logs: mergeLogs(registry.actionLogs[id] ?? []),
      host: saved.host,
      protocol: saved.protocol,
      command: saved.command,
      cwd: saved.cwd,
      restartable: true,
      stoppable: false,
      recordable: true,
      recorded: true,
      launchedByPortMaster: Boolean(registry.localLaunches[id]),
      notes: 'Recorded service',
    }))

  const dockerServices: ServiceItem[] = docker.map((container) => {
    const alias = registry.aliases[container.id]

    return {
      id: container.id,
      port: container.port,
      pid: container.pid,
      status: container.status,
      source: 'docker',
      customAlias: alias,
      detectedName: detectName(container.containerName || container.image),
      path: container.path,
      uptime: container.uptime,
      logs: mergeLogs(registry.actionLogs[container.id] ?? [], container.logs),
      host: container.host,
      protocol: container.protocol,
      containerId: container.containerId,
      containerName: container.containerName,
      image: container.image,
      restartable: true,
      stoppable: true,
      recordable: false,
      recorded: false,
    }
  })

  if (dockerResult.error) {
    registry.actionLogs['system:docker'] = [
      `[${nowLogStamp()}] PM    docker scan failed: ${dockerResult.error}`,
      ...(registry.actionLogs['system:docker'] ?? []),
    ].slice(0, 20)
  }

  await writeRegistry(registry)

  return [...localServices, ...rememberedServices, ...dockerServices]
    .sort((a, b) => a.port - b.port)
}

export async function saveAlias(id: string, alias: string) {
  const registry = await readRegistry()
  const value = alias.trim()

  if (value) {
    registry.aliases[id] = value
  } else {
    delete registry.aliases[id]
  }

  if (registry.localLaunches[id]) {
    registry.localLaunches[id].alias = value || undefined
  }

  appendActionLog(
    registry,
    id,
    value ? `alias updated to "${value}"` : 'alias cleared',
  )

  await writeRegistry(registry)
  return listServices()
}

export async function stopService(id: string) {
  const registry = await readRegistry()

  if (id.startsWith('docker:')) {
    const dockerBinary = await resolveDockerBinary()
    if (!dockerBinary) {
      throw new Error('Docker CLI was not found. Open Docker Desktop or install the Docker CLI.')
    }
    const containerId = id.split(':')[1]
    await execFileAsync(dockerBinary, ['stop', containerId])
    appendActionLog(registry, id, 'container stopped from PortMaster')
    await writeRegistry(registry)
    return listServices()
  }

  const port = Number(id.split(':')[1])
  const services = await listLocalServices()
  const current = services.find((service) => service.port === port)

  if (current?.pid) {
    process.kill(current.pid, 'SIGTERM')
    appendActionLog(registry, id, `sent SIGTERM to pid ${current.pid}`)
    await writeRegistry(registry)
  }

  await waitForLocalPortState(port, false)
  return listServices()
}

export async function restartService(id: string) {
  const registry = await readRegistry()

  if (id.startsWith('docker:')) {
    const dockerBinary = await resolveDockerBinary()
    if (!dockerBinary) {
      throw new Error('Docker CLI was not found. Open Docker Desktop or install the Docker CLI.')
    }
    const containerId = id.split(':')[1]
    await execFileAsync(dockerBinary, ['restart', containerId])
    appendActionLog(registry, id, 'container restart requested from PortMaster')
    await writeRegistry(registry)
    return listServices()
  }

  const launchMeta = registry.localLaunches[id]
  const savedMeta = registry.savedServices[id]
  const command = launchMeta?.command ?? savedMeta?.command
  const cwd = launchMeta?.cwd ?? savedMeta?.cwd
  const alias = launchMeta?.alias ?? savedMeta?.alias
  const expectedPort =
    launchMeta?.expectedPort ?? launchMeta?.lastKnownPort ?? savedMeta?.port

  if (!command) {
    throw new Error('This local service has no recorded launch command yet.')
  }

  appendActionLog(registry, id, 'restart requested from PortMaster')
  await writeRegistry(registry)

  const current = (await listLocalServices()).find((service) => `local:${service.port}` === id)
  if (current) {
    await stopService(id)
  }

  await launchLocalService({
    command,
    cwd,
    alias,
    expectedPort,
  })

  return listServices()
}

export async function launchLocalService(input: LocalLaunchInput) {
  await ensureRuntimeDirs()

  const expectedPort = input.expectedPort ?? 0
  const registry = await readRegistry()
  const recordId = `local:${expectedPort || Date.now()}`
  const logFile = path.join(
    logsDir(),
    `${recordId.replace(/[:]/g, '-')}.log`,
  )
  const shell = await resolveLaunchShell()

  const child = spawn(input.command, {
    cwd: input.cwd || process.cwd(),
    env: process.env,
    shell,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  await new Promise<void>((resolve, reject) => {
    let settled = false

    child.once('spawn', () => {
      if (settled) return
      settled = true
      resolve()
    })

    child.once('error', (error) => {
      if (settled) return
      settled = true
      reject(
        new Error(
          `Unable to launch "${input.command}"${input.cwd ? ` in ${input.cwd}` : ''}: ${error.message}`,
        ),
      )
    })
  })

  const stream = await fs.open(logFile, 'a')
  child.stdout?.on('data', (chunk) => {
    void stream.appendFile(chunk)
  })
  child.stderr?.on('data', (chunk) => {
    void stream.appendFile(chunk)
  })
  child.unref()

  registry.localLaunches[recordId] = {
    alias: input.alias?.trim() || undefined,
    command: input.command,
    cwd: input.cwd,
    expectedPort: input.expectedPort,
    lastKnownPort: input.expectedPort,
    logFile,
    launcherPid: child.pid ?? undefined,
  }

  if (input.alias?.trim()) {
    registry.aliases[recordId] = input.alias.trim()
  }

  appendActionLog(
    registry,
    recordId,
    `launch requested: ${input.command}${input.cwd ? ` (cwd: ${input.cwd})` : ''}`,
  )

  await writeRegistry(registry)

  for (let attempt = 0; attempt < 8; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    const services = await listLocalServices()
    const matched = [...services]
      .map((service) => ({
        service,
        score: getLaunchMatchScore(service, input, child.pid ?? undefined),
      }))
      .filter(({ score }) => score >= (input.expectedPort ? 10_000 : 260))
      .sort((left, right) => right.score - left.score || left.service.port - right.service.port)[0]
      ?.service

    if (matched) {
      const newId = `local:${matched.port}`
      registry.localLaunches[newId] = {
        ...registry.localLaunches[recordId],
        lastKnownPort: matched.port,
        expectedPort: matched.port,
      }
      delete registry.localLaunches[recordId]

      if (registry.aliases[recordId]) {
        registry.aliases[newId] = registry.aliases[recordId]
        delete registry.aliases[recordId]
      }

      if (registry.actionLogs[recordId]) {
        registry.actionLogs[newId] = registry.actionLogs[recordId]
        delete registry.actionLogs[recordId]
      }

      if (registry.savedServices[recordId]) {
        registry.savedServices[newId] = {
          ...registry.savedServices[recordId],
          port: matched.port,
          command: input.command,
          cwd: input.cwd,
        }
        delete registry.savedServices[recordId]
      }

      appendActionLog(registry, newId, `service bound to detected port ${matched.port}`)

      await writeRegistry(registry)
      break
    }
  }

  return listServices()
}

export async function refreshServices() {
  return listServices()
}

export async function saveServiceRecord(input: SavedServiceInput) {
  const registry = await readRegistry()
  const local = await listLocalServices()
  const runtime = local.find((service) => `local:${service.port}` === input.id)

  if (!runtime) {
    throw new Error('Only currently running local services can be recorded.')
  }

  const launchMeta = registry.localLaunches[input.id]
  const alias = registry.aliases[input.id] ?? launchMeta?.alias
  registry.savedServices[input.id] = toSavedService(runtime, launchMeta, alias)
  appendActionLog(registry, input.id, 'service configuration recorded')
  await writeRegistry(registry)
  return listServices()
}

export async function removeServiceRecord(input: SavedServiceInput) {
  const registry = await readRegistry()
  delete registry.savedServices[input.id]
  appendActionLog(registry, input.id, 'service configuration record removed')
  await writeRegistry(registry)
  return listServices()
}
