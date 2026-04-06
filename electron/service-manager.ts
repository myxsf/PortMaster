import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'

import type {
  CustomServiceConfig,
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
  mutedLogs: Record<string, string[]>
  localLaunches: Record<string, PersistedLaunch>
  savedServices: Record<string, SavedService>
  customServices: Record<string, CustomServiceConfig>
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
  stackLabel?: string
  projectId?: string
  projectLabel?: string
  projectPath?: string
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
  stackLabel?: string
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
  projectId?: string
  projectLabel?: string
  projectPath?: string
}

interface DockerListResult {
  services: DockerRuntime[]
  error?: string
}

const DEFAULT_REGISTRY: PersistedRegistry = {
  aliases: {},
  actionLogs: {},
  mutedLogs: {},
  localLaunches: {},
  savedServices: {},
  customServices: {},
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

const INFRA_SERVICE_NAMES = new Set([
  'mysql',
  'mysqld',
  'redis',
  'postgres',
  'postgresql',
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
      mutedLogs: parsed.mutedLogs ?? {},
      localLaunches: parsed.localLaunches ?? {},
      savedServices: parsed.savedServices ?? {},
      customServices: parsed.customServices ?? {},
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

function detectStackLabel(input: {
  commandName?: string
  command?: string
  cwd?: string
  path?: string
  detectedName?: string
}) {
  const corpus = [
    input.detectedName ?? '',
    input.commandName ?? '',
    input.command ?? '',
    input.cwd ?? '',
    input.path ?? '',
  ]
    .join(' ')
    .toLowerCase()

  if (corpus.includes('spring')) return 'Spring Boot'
  if (corpus.includes('react') || corpus.includes('vite')) return 'React'
  if (corpus.includes('vue') || corpus.includes('nuxt')) return 'Vue'
  if (corpus.includes('next')) return 'Next.js'
  if (corpus.includes('node')) return 'Node.js'
  if (corpus.includes('java')) return 'Java'
  if (corpus.includes('python')) return 'Python'

  return undefined
}

function normalizeFilePath(value?: string) {
  return value?.replace(/\\/g, '/').replace(/\/+$/, '')
}

function inferProjectMetaFromPath(value?: string) {
  const normalized = normalizeFilePath(value)
  if (!normalized?.startsWith('/')) {
    return {}
  }

  const segments = normalized.split('/').filter(Boolean)
  if (segments.length === 0) {
    return {}
  }

  const leaf = segments[segments.length - 1]
  const lowerLeaf = leaf.toLowerCase()
  if (
    INFRA_SERVICE_NAMES.has(lowerLeaf) ||
    normalized.includes('/var/db/redis') ||
    normalized.includes('/var/lib/mysql') ||
    normalized.includes('/postgres')
  ) {
    return {}
  }

  const labelIndex =
    PROJECT_LEAF_NAMES.has(lowerLeaf) && segments.length >= 2
      ? segments.length - 2
      : segments.length - 1

  const projectLabel = segments[labelIndex]
  const projectPath = `/${segments.slice(0, labelIndex + 1).join('/')}`

  return {
    projectId: `project:${projectPath}`,
    projectLabel,
    projectPath,
  }
}

function toCustomServiceId(id: string) {
  return `custom:${id}`
}

function matchCustomServiceConfig(
  runtime: Pick<LocalRuntime, 'port' | 'host' | 'cwd' | 'path'>,
  config: CustomServiceConfig,
) {
  if (config.port !== runtime.port) {
    return false
  }

  const configHost = (config.host || 'localhost').toLowerCase()
  if (configHost !== (runtime.host || 'localhost').toLowerCase()) {
    return false
  }

  const runtimePath = normalizeFilePath(runtime.cwd ?? runtime.path)
  const configPaths = [config.cwd, config.projectPath]
    .map((value) => normalizeFilePath(value))
    .filter(Boolean)

  if (configPaths.length === 0 || !runtimePath) {
    return true
  }

  return configPaths.some((value) => value === runtimePath)
}

function findCustomConfigByRuntime(
  registry: PersistedRegistry,
  runtime: Pick<LocalRuntime, 'port' | 'host' | 'cwd' | 'path'>,
) {
  return Object.values(registry.customServices).find((config) =>
    matchCustomServiceConfig(runtime, config),
  )
}

function findCustomConfigById(registry: PersistedRegistry, id: string) {
  if (!id.startsWith('custom:')) {
    return undefined
  }

  return registry.customServices[id.slice('custom:'.length)]
}

function resolveLocalServiceId(runtime: LocalRuntime, registry: PersistedRegistry) {
  const exactLocalId = `local:${runtime.port}`
  if (registry.localLaunches[exactLocalId] || registry.savedServices[exactLocalId]) {
    return exactLocalId
  }

  const launchMatch = Object.entries(registry.localLaunches).find(([, launch]) => {
    const samePort =
      launch.lastKnownPort === runtime.port || launch.expectedPort === runtime.port
    if (!samePort) return false

    const normalizedCwd = normalizeFilePath(launch.cwd)
    const runtimeCwd = normalizeFilePath(runtime.cwd)
    if (!normalizedCwd || !runtimeCwd) return true

    return normalizedCwd === runtimeCwd
  })
  if (launchMatch) {
    return launchMatch[0]
  }

  const savedMatch = Object.entries(registry.savedServices).find(([, saved]) => {
    if (saved.port !== runtime.port) return false

    const normalizedCwd = normalizeFilePath(saved.cwd)
    const runtimeCwd = normalizeFilePath(runtime.cwd)
    if (!normalizedCwd || !runtimeCwd) return true

    return normalizedCwd === runtimeCwd
  })
  if (savedMatch) {
    return savedMatch[0]
  }

  const customMatch = findCustomConfigByRuntime(registry, runtime)
  if (customMatch) {
    return toCustomServiceId(customMatch.id)
  }

  return exactLocalId
}

function suppressClearedLogs(registry: PersistedRegistry, id: string, lines: string[]) {
  const mutedLines = registry.mutedLogs[id]
  if (!mutedLines?.length) {
    return lines
  }

  return lines.filter((line) => !mutedLines.includes(line))
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
      '-ww',
      '-o',
      'etime=',
      '-o',
      'comm=',
      '-o',
      'command=',
      '-p',
      String(pid),
    ])

    const lines = stdout
      .split('\n')
      .map((line) => line.trimEnd())
      .filter(Boolean)

    const line = decodeEscapedText(lines[0] ?? '')
    const match = line.match(/^(\S+)\s+(\S+)\s+(.*)$/)

    if (!match) {
      return {
        command: line.trim(),
        uptime: 'unknown',
        commandName: 'unknown',
      }
    }

    return {
      command: decodeEscapedText(match[3].trim()),
      uptime: formatElapsed(match[1]),
      commandName: decodeEscapedText(path.basename(match[2].trim())),
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

function buildShellLaunch(shell: string, command: string) {
  if (process.platform === 'win32') {
    return {
      file: shell,
      args: ['/d', '/s', '/c', command],
    }
  }

  return {
    file: shell,
    args: ['-lc', `set -f; ${command}`],
  }
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
      stackLabel: detectStackLabel({
        commandName: currentCommandName || info.commandName,
        command: info.command,
        cwd,
        path: cwd || info.command,
        detectedName: detectName(currentCommandName || info.commandName),
      }),
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

function parseDockerLabels(input: string) {
  const labels: Record<string, string> = {}
  for (const entry of input.split(',')) {
    const separatorIndex = entry.indexOf('=')
    if (separatorIndex <= 0) continue
    labels[entry.slice(0, separatorIndex)] = entry.slice(separatorIndex + 1)
  }
  return labels
}

function parseDockerDesktopPorts(labels: Record<string, string>) {
  return Object.entries(labels)
    .filter(([key, value]) => key.startsWith('desktop.docker.io/ports/') && value.includes(':'))
    .map(([key, value]) => {
      const match = key.match(/desktop\.docker\.io\/ports\/(\d+)\/(tcp|udp)$/)
      if (!match) return null
      const hostPort = Number(value.split(':').pop())
      if (!hostPort) return null
      return {
        hostPort,
        containerPort: Number(match[1]),
        protocol: match[2] as ServiceProtocol,
      }
    })
    .filter(Boolean) as Array<{ hostPort: number; containerPort: number; protocol: ServiceProtocol }>
}

async function listDockerServices(): Promise<DockerListResult> {
  try {
    const dockerBinary = await resolveDockerBinary()
    if (!dockerBinary) {
      return {
        services: [],
        error: '没有找到 Docker CLI。请先打开 Docker Desktop，或安装 Docker 命令行工具。',
      }
    }

    const { stdout } = await execFileAsync(dockerBinary, ['ps', '-a', '--format', '{{json .}}'])
    const lines = stdout.split('\n').filter(Boolean)
    const uniquePortServices = new Map<number, DockerRuntime>()

    for (const line of lines) {
      const item = JSON.parse(line) as {
        ID: string
        Image: string
        Names: string
        Ports: string
        Status: string
        Labels: string
      }

      const labels = parseDockerLabels(item.Labels ?? '')
      const parsedPorts = parseDockerPorts(item.Ports)
      const ports = parsedPorts.length > 0 ? parsedPorts : parseDockerDesktopPorts(labels)
      if (ports.length === 0) continue
      const workingDir = decodeEscapedText(labels['com.docker.compose.project.working_dir'] ?? '')
      const composeProject = labels['com.docker.compose.project']
      const composeService = labels['com.docker.compose.service']?.trim()
      const serviceLabel =
        composeService ||
        item.Names.replace(new RegExp(`^${composeProject ?? ''}[-_]`), '')
      const lowerServiceLabel = serviceLabel.toLowerCase()
      const dockerProjectMeta = INFRA_SERVICE_NAMES.has(lowerServiceLabel)
        ? {}
        : {
            projectLabel: serviceLabel,
            projectId: `docker-project:${workingDir || composeProject || item.ID}:${serviceLabel}`,
            projectPath: workingDir || undefined,
          }

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
        const runtime: DockerRuntime = {
          id: `docker:${item.ID}:${mapped.hostPort}`,
          containerId: item.ID,
          containerName: item.Names,
          image: item.Image,
          port: mapped.hostPort,
          host: 'localhost',
          protocol: mapped.protocol,
          uptime: item.Status,
          status: item.Status.toLowerCase().includes('up') ? 'active' : 'inactive',
          path: workingDir || item.Image,
          pid: 0,
          logs,
          projectId: dockerProjectMeta.projectId,
          projectLabel: dockerProjectMeta.projectLabel,
          projectPath: dockerProjectMeta.projectPath,
        }

        const existing = uniquePortServices.get(mapped.hostPort)
        if (!existing || existing.status !== 'active') {
          uniquePortServices.set(mapped.hostPort, runtime)
        }
      }
    }

    return { services: [...uniquePortServices.values()].sort((a, b) => a.port - b.port) }
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
  const detectedName = detectName(runtime.commandName)
  const projectMeta = inferProjectMetaFromPath(launchMeta?.cwd ?? runtime.cwd ?? runtime.path)
  return {
    alias,
    command: runtime.command || launchMeta?.command || runtime.commandName,
    cwd: launchMeta?.cwd ?? runtime.cwd,
    port: runtime.port,
    host: runtime.host,
    protocol: runtime.protocol,
    detectedName,
    path: runtime.path || runtime.cwd || runtime.command,
    source: 'local',
    stackLabel: runtime.stackLabel ?? detectStackLabel({
      commandName: runtime.commandName,
      command: runtime.command,
      cwd: launchMeta?.cwd ?? runtime.cwd,
      path: runtime.path,
      detectedName,
    }),
    ...projectMeta,
  }
}

async function inferLaunchCommand(cwd?: string, detectedName?: string) {
  if (!cwd) return undefined

  const pathExists = async (target: string) => {
    try {
      await fs.access(target)
      return true
    } catch {
      return false
    }
  }

  const readJson = async <T>(target: string) => {
    try {
      const content = await fs.readFile(target, 'utf8')
      return JSON.parse(content) as T
    } catch {
      return undefined
    }
  }

  const packageJson = await readJson<{ scripts?: Record<string, string> }>(
    path.join(cwd, 'package.json'),
  )
  const packageScripts = packageJson?.scripts ?? {}
  if (packageScripts.dev) {
    if (await pathExists(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm dev'
    if (await pathExists(path.join(cwd, 'yarn.lock'))) return 'yarn dev'
    return 'npm run dev'
  }
  if (packageScripts.start) {
    if (await pathExists(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm start'
    if (await pathExists(path.join(cwd, 'yarn.lock'))) return 'yarn start'
    return 'npm run start'
  }

  if (await pathExists(path.join(cwd, 'mvnw'))) {
    return './mvnw spring-boot:run'
  }

  if (await pathExists(path.join(cwd, 'pom.xml'))) {
    return 'mvn spring-boot:run'
  }

  if (await pathExists(path.join(cwd, 'gradlew'))) {
    return './gradlew bootRun'
  }

  if (await pathExists(path.join(cwd, 'package.json'))) {
    return 'npm run dev'
  }

  if (await pathExists(path.join(cwd, 'requirements.txt'))) {
    return 'python app.py'
  }

  if (await pathExists(path.join(cwd, 'pyproject.toml'))) {
    return 'python -m uvicorn main:app --reload'
  }

  if (await pathExists(path.join(cwd, 'main.py'))) {
    return 'python main.py'
  }

  if (await pathExists(path.join(cwd, 'manage.py'))) {
    return 'python manage.py runserver'
  }

  if (await pathExists(path.join(cwd, 'go.mod'))) {
    return 'go run .'
  }

  if (await pathExists(path.join(cwd, 'compose.yaml')) || await pathExists(path.join(cwd, 'docker-compose.yml'))) {
    return 'docker compose up -d'
  }

  if ((await pathExists(path.join(cwd, 'start.sh'))) || (await pathExists(path.join(cwd, 'run.sh')))) {
    return './start.sh'
  }

  if (await pathExists(path.join(cwd, 'ollama'))) {
    return './ollama serve'
  }

  if (detectedName === 'Java' || detectedName === 'Spring Boot') {
    return 'mvn spring-boot:run'
  }

  if (detectedName === 'Python') {
    return 'python main.py'
  }

  if (detectedName === 'Node.js' || detectedName === 'React' || detectedName === 'Vue') {
    return 'npm run dev'
  }

  if (detectedName === 'Go') {
    return 'go run .'
  }

  return undefined
}

async function stopRedisViaBrewIfNeeded(runtime?: LocalRuntime) {
  if (!runtime) return false

  const corpus = `${runtime.commandName} ${runtime.command} ${runtime.path}`.toLowerCase()
  if (!corpus.includes('redis')) {
    return false
  }

  try {
    await execFileAsync('brew', ['services', 'stop', 'redis'])
    return true
  } catch {
    return false
  }
}

function describeServiceForUser(runtime?: LocalRuntime) {
  if (!runtime) return '当前服务'
  return `${detectName(runtime.commandName)}（端口 ${runtime.port}）`
}

async function findRuntimeById(id: string, registry: PersistedRegistry) {
  const services = await listLocalServices()
  return services.find((service) => resolveLocalServiceId(service, registry) === id)
}

function resolveSavedPort(registry: PersistedRegistry, id: string) {
  return (
    registry.localLaunches[id]?.lastKnownPort ??
    registry.localLaunches[id]?.expectedPort ??
    registry.savedServices[id]?.port ??
    findCustomConfigById(registry, id)?.port
  )
}

export async function listServices(): Promise<ServiceItem[]> {
  const registry = await readRegistry()
  const dockerResult = await listDockerServices()
  const docker = dockerResult.services
  const dockerPorts = new Set(
    docker.filter((service) => service.status === 'active').map((service) => service.port),
  )
  const local = (await listLocalServices()).filter((runtime) => !dockerPorts.has(runtime.port))

  const localServices = await Promise.all(
    local.map(async (runtime) => {
      const id = resolveLocalServiceId(runtime, registry)
      const launchMeta = registry.localLaunches[id]
      const saved = registry.savedServices[id]
      const custom = findCustomConfigById(registry, id)
      const alias = registry.aliases[id] ?? launchMeta?.alias ?? custom?.alias ?? saved?.alias
      const runtimeLogs = await readLogTail(launchMeta?.logFile)
      const logs = suppressClearedLogs(
        registry,
        id,
        mergeLogs(registry.actionLogs[id] ?? [], runtimeLogs),
      )

      if (launchMeta) {
        launchMeta.lastKnownPort = runtime.port
        if (!launchMeta.command || launchMeta.command.length < runtime.command.length) {
          launchMeta.command = runtime.command
        }
        if (!launchMeta.cwd && runtime.cwd) {
          launchMeta.cwd = runtime.cwd
        }
      }

      if (
        saved &&
        (
          !saved.command ||
          !saved.path ||
          !saved.cwd ||
          saved.command.length < runtime.command.length
        )
      ) {
        registry.savedServices[id] = toSavedService(runtime, launchMeta, alias)
      }

      const projectMeta =
        custom
          ? {
              projectId: `project:${custom.projectPath || custom.cwd || custom.serviceName}`,
              projectLabel: custom.projectLabel,
              projectPath: custom.projectPath || custom.cwd || runtime.cwd || runtime.path,
            }
          : inferProjectMetaFromPath(saved?.cwd ?? runtime.cwd ?? runtime.path)

      return {
        id,
        port: runtime.port,
        pid: runtime.pid,
        status: 'active' as ServiceStatus,
        source: 'local' as ServiceSource,
        customAlias: alias,
        detectedName: custom?.serviceName || saved?.detectedName || detectName(runtime.commandName),
        path: custom?.projectPath || runtime.path || runtime.cwd || runtime.command,
        uptime: runtime.uptime,
        logs,
        host: runtime.host,
        protocol: runtime.protocol,
        command: custom?.command || runtime.command || launchMeta?.command || saved?.command,
        cwd: custom?.cwd ?? custom?.projectPath ?? launchMeta?.cwd ?? runtime.cwd ?? saved?.cwd,
        notes: custom?.stackLabel ?? saved?.stackLabel ?? runtime.stackLabel,
        projectId: projectMeta.projectId,
        projectLabel: projectMeta.projectLabel,
        projectPath: projectMeta.projectPath,
        restartable: Boolean(custom?.command || launchMeta?.command || saved?.command || runtime.command),
        stoppable: true,
        recordable: true,
        recorded: Boolean(registry.savedServices[id] || custom),
        launchedByPortMaster: Boolean(launchMeta),
      }
    }),
  )

  const activeLocalIds = new Set(localServices.map((service) => service.id))
  const rememberedServices: ServiceItem[] = Object.entries(registry.savedServices)
    .filter(([id, saved]) => saved.source === 'local' && !activeLocalIds.has(id))
    .map(([id, saved]) => {
      const normalizedProjectMeta = inferProjectMetaFromPath(saved.cwd ?? saved.path)
      return {
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
        notes: saved.stackLabel,
        projectId: normalizedProjectMeta.projectId,
        projectLabel: normalizedProjectMeta.projectLabel,
        projectPath: normalizedProjectMeta.projectPath,
        restartable: true,
        stoppable: false,
        recordable: true,
        recorded: true,
        launchedByPortMaster: Boolean(registry.localLaunches[id]),
      }
    })

  const rememberedCustomServices: ServiceItem[] = Object.values(registry.customServices)
    .map((config) => ({
      id: toCustomServiceId(config.id),
      port: config.port,
      pid: 0,
      status: 'inactive' as ServiceStatus,
      source: 'local' as ServiceSource,
      customAlias: registry.aliases[toCustomServiceId(config.id)] ?? config.alias,
      detectedName: config.serviceName,
      path: config.projectPath || config.cwd || config.command,
      uptime: 'stopped',
      logs: suppressClearedLogs(
        registry,
        toCustomServiceId(config.id),
        mergeLogs(registry.actionLogs[toCustomServiceId(config.id)] ?? []),
      ),
      host: config.host || 'localhost',
      protocol: 'tcp' as ServiceProtocol,
      command: config.command,
      cwd: config.cwd || config.projectPath,
      notes: config.stackLabel || config.notes,
      projectId: `project:${config.projectPath || config.cwd || config.serviceName}`,
      projectLabel: config.projectLabel,
      projectPath: config.projectPath || config.cwd || config.command,
      restartable: true,
      stoppable: false,
      recordable: true,
      recorded: true,
      launchedByPortMaster: Boolean(registry.localLaunches[toCustomServiceId(config.id)]),
    }))
    .filter((service) => !activeLocalIds.has(service.id))

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
      logs: suppressClearedLogs(
        registry,
        container.id,
        mergeLogs(registry.actionLogs[container.id] ?? [], container.logs),
      ),
      host: container.host,
      protocol: container.protocol,
      containerId: container.containerId,
      containerName: container.containerName,
      image: container.image,
      projectId: container.projectId,
      projectLabel: container.projectLabel,
      projectPath: container.projectPath,
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

  return [...localServices, ...rememberedServices, ...rememberedCustomServices, ...dockerServices]
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
      throw new Error('没有找到 Docker CLI。请先打开 Docker Desktop，或安装 Docker 命令行工具。')
    }
    const containerId = id.split(':')[1]
    await execFileAsync(dockerBinary, ['stop', containerId])
    const startedAt = Date.now()
    let stopped = false
    while (Date.now() - startedAt < 10_000) {
      const dockerState = await listDockerServices()
      const matched = dockerState.services.find((service) => service.id === id)
      if (!matched || matched.status !== 'active') {
        stopped = true
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
    appendActionLog(
      registry,
      id,
      stopped ? 'container stopped from PortMaster' : 'container stop requested but it still appears active',
    )
    await writeRegistry(registry)
    return listServices()
  }

  const current = await findRuntimeById(id, registry)
  const port = current?.port ?? resolveSavedPort(registry, id)

  if (!port) {
    throw new Error('Unable to resolve the port for this local service.')
  }

  if (current?.pid) {
    process.kill(current.pid, 'SIGTERM')
    appendActionLog(registry, id, `sent SIGTERM to pid ${current.pid}`)
    await writeRegistry(registry)
  }

  await waitForLocalPortState(port, false, 2500)
  const remaining = (await listLocalServices()).find((service) => service.port === port)
  if (remaining) {
    const stoppedByBrew = await stopRedisViaBrewIfNeeded(remaining)
    if (stoppedByBrew) {
      appendActionLog(registry, id, 'brew services stop requested for redis')
      await writeRegistry(registry)
      await waitForLocalPortState(port, false, 4000)
    } else {
      try {
        process.kill(remaining.pid, 'SIGKILL')
        appendActionLog(registry, id, `sent SIGKILL to pid ${remaining.pid}`)
        await writeRegistry(registry)
        await waitForLocalPortState(port, false, 1500)
      } catch {
        // ignore fallback kill failures
      }
    }
  }

  const stillRunning = (await listLocalServices()).find((service) => service.port === port)
  if (stillRunning) {
    appendActionLog(
      registry,
      id,
      `stop request did not fully close port ${port}; process ${stillRunning.pid} is still listening`,
    )
    await writeRegistry(registry)
    throw new Error(`端口 ${port} 还没有真正关闭，请先结束 ${describeServiceForUser(stillRunning)} 后再试。`)
  }

  return listServices()
}

export async function restartService(id: string) {
  const registry = await readRegistry()

  if (id.startsWith('docker:')) {
    const dockerBinary = await resolveDockerBinary()
    if (!dockerBinary) {
      throw new Error('没有找到 Docker CLI。请先打开 Docker Desktop，或安装 Docker 命令行工具。')
    }
    const containerId = id.split(':')[1]
    await execFileAsync(dockerBinary, ['start', containerId])
    const startedAt = Date.now()
    let started = false
    while (Date.now() - startedAt < 12_000) {
      const dockerState = await listDockerServices()
      const matched = dockerState.services.find((service) => service.id === id)
      if (matched?.status === 'active') {
        started = true
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
    appendActionLog(
      registry,
      id,
      started ? 'container start requested from PortMaster' : 'container start requested but the container did not become active',
    )
    await writeRegistry(registry)
    if (!started) {
      throw new Error('Docker container did not become active after the start request.')
    }
    return listServices()
  }

  const launchMeta = registry.localLaunches[id]
  const savedMeta = registry.savedServices[id]
  const customMeta = findCustomConfigById(registry, id)
  const command = customMeta?.command ?? launchMeta?.command ?? savedMeta?.command
  const cwd = customMeta?.cwd ?? customMeta?.projectPath ?? launchMeta?.cwd ?? savedMeta?.cwd
  const alias = customMeta?.alias ?? launchMeta?.alias ?? savedMeta?.alias
  const expectedPort =
    customMeta?.port ?? launchMeta?.expectedPort ?? launchMeta?.lastKnownPort ?? savedMeta?.port
  const usableCommand = command && !command.endsWith('/Ja') ? command : undefined
  const fallbackCommand =
    usableCommand ??
    await inferLaunchCommand(cwd, customMeta?.serviceName ?? savedMeta?.detectedName)

  if (!fallbackCommand) {
    throw new Error(
      '这个服务还没有可复用的启动命令。请先到“自定义”里补充命令，或者手动启动一次后重新记录。',
    )
  }

  appendActionLog(registry, id, 'restart requested from PortMaster')
  await writeRegistry(registry)

  const current = await findRuntimeById(id, registry)
  if (current) {
    await stopService(id)
  }

  await launchLocalService({
    command: fallbackCommand,
    cwd,
    alias,
    expectedPort,
    recordId: id,
  })

  return listServices()
}

export async function launchLocalService(input: LocalLaunchInput) {
  await ensureRuntimeDirs()

  const expectedPort = input.expectedPort ?? 0
  const registry = await readRegistry()
  const existingRuntime = expectedPort
    ? (await listLocalServices()).find((service) => service.port === expectedPort)
    : undefined
  if (existingRuntime) {
    const existingId = resolveLocalServiceId(existingRuntime, registry)
    if (existingId !== input.recordId) {
      throw new Error(
        `端口 ${expectedPort} 已被 ${describeServiceForUser(existingRuntime)} 占用，请先关闭占用服务，或换一个端口。`,
      )
    }
  }
  const recordId = input.recordId ?? `local:${expectedPort || Date.now()}`
  const keepStableId = recordId.startsWith('custom:')
  const logFile = path.join(
    logsDir(),
    `${recordId.replace(/[:]/g, '-')}.log`,
  )
  const shell = await resolveLaunchShell()
  const { file, args } = buildShellLaunch(shell, input.command)
  const child = spawn(file, args, {
    cwd: input.cwd || process.cwd(),
    env: process.env,
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
          `无法启动命令“${input.command}”${input.cwd ? `（目录：${input.cwd}）` : ''}：${error.message}`,
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
  const closeStream = () => {
    void stream.close().catch(() => {
      // ignore close races for short-lived launchers
    })
  }
  child.once('exit', closeStream)
  child.once('error', closeStream)
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

  let matchedPort: number | undefined

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500))
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
      matchedPort = matched.port
      const newId = keepStableId ? recordId : `local:${matched.port}`
      registry.localLaunches[newId] = {
        ...registry.localLaunches[recordId],
        lastKnownPort: matched.port,
        expectedPort: matched.port,
      }
      if (newId !== recordId) {
        delete registry.localLaunches[recordId]
      }

      if (registry.aliases[recordId] && newId !== recordId) {
        registry.aliases[newId] = registry.aliases[recordId]
        delete registry.aliases[recordId]
      }

      if (registry.actionLogs[recordId] && newId !== recordId) {
        registry.actionLogs[newId] = registry.actionLogs[recordId]
        delete registry.actionLogs[recordId]
      }

      if (registry.savedServices[recordId] && newId !== recordId) {
        registry.savedServices[newId] = {
          ...registry.savedServices[recordId],
          port: matched.port,
          command: input.command,
          cwd: input.cwd,
        }
        delete registry.savedServices[recordId]
      } else if (registry.savedServices[newId]) {
        registry.savedServices[newId] = {
          ...registry.savedServices[newId],
          port: matched.port,
          command: input.command,
          cwd: input.cwd ?? registry.savedServices[newId].cwd,
        }
      }

      appendActionLog(registry, newId, `service bound to detected port ${matched.port}`)

      await writeRegistry(registry)
      break
    }
  }

  if (expectedPort && !matchedPort) {
    const runtimeLogs = await readLogTail(logFile)
    const childExited = child.exitCode !== null
    appendActionLog(
      registry,
      recordId,
      childExited
        ? `launch failed: process exited before port ${expectedPort} was detected`
        : `launch timeout: port ${expectedPort} did not become reachable yet`,
    )
    await writeRegistry(registry)

    throw new Error(
      runtimeLogs[0]
        ? `端口 ${expectedPort} 没有成功启动。最近一条日志：${runtimeLogs[0]}`
        : `端口 ${expectedPort} 在等待时间内没有成功启动。`,
    )
  }

  return listServices()
}

export async function refreshServices() {
  return listServices()
}

export async function saveServiceRecord(input: SavedServiceInput) {
  const registry = await readRegistry()
  const local = await listLocalServices()
  const runtime = local.find((service) => resolveLocalServiceId(service, registry) === input.id)

  if (!runtime) {
    throw new Error('Only currently running local services can be recorded.')
  }

  const launchMeta = registry.localLaunches[input.id]
  const customMeta = findCustomConfigById(registry, input.id)
  const alias = registry.aliases[input.id] ?? launchMeta?.alias ?? customMeta?.alias
  registry.savedServices[input.id] = toSavedService(runtime, launchMeta, alias)
  if (customMeta) {
    registry.savedServices[input.id] = {
      ...registry.savedServices[input.id],
      command: customMeta.command || registry.savedServices[input.id].command,
      cwd: customMeta.cwd || customMeta.projectPath || registry.savedServices[input.id].cwd,
      projectId: `project:${customMeta.projectPath || customMeta.cwd || customMeta.serviceName}`,
      projectLabel: customMeta.projectLabel,
      projectPath: customMeta.projectPath || customMeta.cwd || runtime.cwd || runtime.path,
      detectedName: customMeta.serviceName,
      stackLabel: customMeta.stackLabel || registry.savedServices[input.id].stackLabel,
    }
  }
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

export async function clearServiceLogs(ids: string[]) {
  const registry = await readRegistry()
  const currentServices = await listServices()

  for (const id of ids) {
    const current = currentServices.find((service) => service.id === id)
    registry.mutedLogs[id] = current?.logs ?? []
    registry.actionLogs[id] = []
    const launchMeta = registry.localLaunches[id]
    if (launchMeta?.logFile) {
      try {
        await fs.writeFile(launchMeta.logFile, '', 'utf8')
        registry.mutedLogs[id] = []
      } catch {
        continue
      }
    }
  }

  await writeRegistry(registry)
  return listServices()
}

export async function listCustomServices() {
  const registry = await readRegistry()
  return Object.values(registry.customServices).sort((a, b) =>
    a.projectLabel.localeCompare(b.projectLabel) ||
    a.port - b.port ||
    a.serviceName.localeCompare(b.serviceName),
  )
}

export async function saveCustomService(input: CustomServiceConfig) {
  const registry = await readRegistry()
  registry.customServices[input.id] = {
    ...input,
    projectLabel: input.projectLabel.trim(),
    projectPath: input.projectPath.trim(),
    serviceName: input.serviceName.trim(),
    host: input.host.trim() || 'localhost',
    alias: input.alias?.trim() || undefined,
    command: input.command.trim(),
    cwd: input.cwd?.trim() || undefined,
    stackLabel: input.stackLabel?.trim() || undefined,
    icon: input.icon?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
  }
  await writeRegistry(registry)
  return listCustomServices()
}

export async function removeCustomService(id: string) {
  const registry = await readRegistry()
  delete registry.customServices[id]
  await writeRegistry(registry)
  return listCustomServices()
}
