import { useEffect, useMemo, useState } from 'react'
import { Play, Plus, Save, TestTube2, Trash2 } from 'lucide-react'

import type { CustomServiceConfig, ServiceItem } from '../types'

interface SettingsPageProps {
  services: ServiceItem[]
  onSaved?: () => void
}

function requireDesktopApi() {
  if (!window.portmaster) {
    throw new Error('当前没有连接到桌面应用。')
  }

  return window.portmaster
}

const PRESETS = [
  { label: 'Spring Boot', stackLabel: 'Spring Boot', command: './mvnw spring-boot:run' },
  { label: 'Java Maven', stackLabel: 'Java', command: 'mvn spring-boot:run' },
  { label: 'Java Gradle', stackLabel: 'Java', command: './gradlew bootRun' },
  { label: 'React / Vite', stackLabel: 'React', command: 'npm run dev' },
  { label: 'Vue / Nuxt', stackLabel: 'Vue', command: 'npm run dev' },
  { label: 'Node.js', stackLabel: 'Node.js', command: 'npm run dev' },
  { label: 'Python', stackLabel: 'Python', command: 'python main.py' },
  { label: 'FastAPI', stackLabel: 'Python', command: 'python -m uvicorn main:app --reload' },
  { label: 'Go', stackLabel: 'Go', command: 'go run .' },
  { label: 'Open WebUI', stackLabel: 'Open WebUI', command: 'docker compose up -d' },
  { label: 'Ollama', stackLabel: 'Ollama', command: 'ollama serve' },
]

function createEmptyConfig(): CustomServiceConfig {
  return {
    id: `custom-${Date.now()}`,
    projectLabel: '',
    projectPath: '',
    serviceName: '',
    port: 0,
    host: '',
    alias: '',
    command: '',
    cwd: '',
    stackLabel: '',
    icon: '',
    notes: '',
  }
}

function FieldLabel({
  title,
  required = false,
  example,
}: {
  title: string
  required?: boolean
  example?: string
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.24em] text-[#7CC6FF]">
        {title}
        {required ? ' *' : ''}
      </div>
      {example ? (
        <div className="mt-1 text-xs text-slate-500">示例：{example}</div>
      ) : null}
    </div>
  )
}

export function SettingsPage({ services, onSaved }: SettingsPageProps) {
  const [items, setItems] = useState<CustomServiceConfig[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [draft, setDraft] = useState<CustomServiceConfig>(createEmptyConfig())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void (async () => {
      const custom = await requireDesktopApi().listCustomServices()
      setItems(custom)
      if (custom[0]) {
        setSelectedId(custom[0].id)
        setDraft(custom[0])
      }
    })()
  }, [])

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId),
    [items, selectedId],
  )

  const normalizedHost = draft.host.trim() || 'localhost'
  const testMatched = services.find(
    (service) => service.port === draft.port && service.host === normalizedHost,
  )

  const applyPreset = (label: string) => {
    const preset = PRESETS.find((item) => item.label === label)
    if (!preset) return
    setDraft((current) => ({
      ...current,
      command: preset.command,
      stackLabel: current.stackLabel || preset.stackLabel,
      serviceName: current.serviceName || preset.label,
    }))
  }

  const persist = async () => {
    if (!draft.projectLabel.trim() || !draft.serviceName.trim() || !draft.command.trim() || !draft.port) {
      window.alert('项目名、服务名、端口和启动命令为必填项。')
      return
    }

    setLoading(true)
    try {
      const saved = await requireDesktopApi().saveCustomService({
        ...draft,
        host: normalizedHost,
        port: Number(draft.port),
      })
      setItems(saved)
      setSelectedId(draft.id)
      onSaved?.()
    } finally {
      setLoading(false)
    }
  }

  const remove = async () => {
    if (!selected) return
    const confirmed = window.confirm(`确定删除 ${selected.projectLabel} / ${selected.serviceName} 这条自定义配置吗？`)
    if (!confirmed) return
    const saved = await requireDesktopApi().removeCustomService(selected.id)
    setItems(saved)
    const next = saved[0] ?? createEmptyConfig()
    setSelectedId(saved[0]?.id ?? '')
    setDraft(next)
    onSaved?.()
  }

  const launch = async () => {
    if (!draft.command.trim() || !draft.port) {
      window.alert('请先填写端口和启动命令。')
      return
    }

    await requireDesktopApi().launchLocalService({
      command: draft.command,
      cwd: draft.cwd || draft.projectPath || undefined,
      alias: draft.alias || undefined,
      expectedPort: Number(draft.port),
      recordId: `custom:${draft.id}`,
    })
    onSaved?.()
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.84fr)_minmax(520px,1.4fr)]">
      <div className="rounded-[20px] border border-[#23303a] bg-[#0d1319] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-white">自定义项目</div>
            <div className="mt-1 text-sm text-slate-400">
              这里保存“项目级启动记录”。保存后，即使 Close All，项目记录也仍然保留。
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = createEmptyConfig()
              setDraft(next)
              setSelectedId(next.id)
            }}
            className="inline-flex h-10 min-w-[92px] items-center justify-center gap-2 rounded-xl border border-[#2a333d] bg-[#1a2028] px-4 text-sm text-slate-200"
          >
            <Plus className="h-4 w-4" />
            新建
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {items.length > 0 ? (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedId(item.id)
                  setDraft(item)
                }}
                className={`block w-full rounded-2xl border px-4 py-3 text-left transition ${
                  item.id === selectedId
                    ? 'border-[#2496ED]/40 bg-[#122130]'
                    : 'border-[#1f2a33] bg-[#10161d] hover:bg-[#141d27]'
                }`}
              >
                <div className="truncate text-sm font-semibold text-white">{item.projectLabel}</div>
                <div className="mt-1 truncate text-xs text-slate-400">
                  {item.serviceName} · {item.host}:{item.port}
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-[#22303d] bg-[#0b1117] px-4 py-5 text-sm text-slate-400">
              还没有自定义项目。可以先把常用的前端、后端、Docker Compose 或大模型服务配置在这里。
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[20px] border border-[#23303a] bg-[#0d1319] p-5">
        <div className="mb-5 rounded-[22px] border border-[#1f2a33] bg-[#0b1117] p-4">
          <div className="text-sm font-semibold text-white">怎么用这一页</div>
          <div className="mt-2 text-sm leading-6 text-slate-300">
            适合两种场景：一是你已经知道启动命令，直接保存；二是你先手动启动一次，再回到列表里 Record，后面也可以来这里补充和修正命令。
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <FieldLabel title="项目名" required example="travellog" />
            <input
              value={draft.projectLabel}
              onChange={(event) => setDraft((current) => ({ ...current, projectLabel: event.target.value }))}
              placeholder="例如：travellog"
              className="mt-2 w-full rounded-xl border border-[#22303d] bg-[#0b1117] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-[#5f7290]"
            />
          </label>

          <label className="block">
            <FieldLabel title="服务名" required example="backend" />
            <input
              value={draft.serviceName}
              onChange={(event) => setDraft((current) => ({ ...current, serviceName: event.target.value }))}
              placeholder="例如：backend"
              className="mt-2 w-full rounded-xl border border-[#22303d] bg-[#0b1117] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-[#5f7290]"
            />
          </label>

          <label className="block md:col-span-2">
            <FieldLabel title="项目路径" example="/Users/xiangzai/Documents/codex/travellog" />
            <input
              value={draft.projectPath}
              onChange={(event) => setDraft((current) => ({ ...current, projectPath: event.target.value }))}
              placeholder="例如：/Users/xiangzai/Documents/codex/travellog"
              className="mt-2 w-full rounded-xl border border-[#22303d] bg-[#0b1117] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-[#5f7290]"
            />
          </label>

          <label className="block">
            <FieldLabel title="端口" required example="8080" />
            <input
              inputMode="numeric"
              value={draft.port ? String(draft.port) : ''}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  port: Number(event.target.value.replace(/[^\d]/g, '')) || 0,
                }))
              }
              placeholder="例如：8080"
              className="mt-2 w-full rounded-xl border border-[#22303d] bg-[#0b1117] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-[#5f7290]"
            />
          </label>

          <label className="block">
            <FieldLabel title="Host" example="localhost" />
            <input
              value={draft.host}
              onChange={(event) => setDraft((current) => ({ ...current, host: event.target.value }))}
              placeholder="例如：localhost"
              className="mt-2 w-full rounded-xl border border-[#22303d] bg-[#0b1117] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-[#5f7290]"
            />
          </label>

          <label className="block">
            <FieldLabel title="别名" example="api-dev" />
            <input
              value={draft.alias ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, alias: event.target.value }))}
              placeholder="例如：api-dev"
              className="mt-2 w-full rounded-xl border border-[#22303d] bg-[#0b1117] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-[#5f7290]"
            />
          </label>

          <label className="block">
            <FieldLabel title="技术标签" example="Spring Boot / React / Ollama" />
            <input
              value={draft.stackLabel ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, stackLabel: event.target.value }))}
              placeholder="例如：Spring Boot"
              className="mt-2 w-full rounded-xl border border-[#22303d] bg-[#0b1117] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-[#5f7290]"
            />
          </label>

          <label className="block md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <FieldLabel title="启动命令" required example="npm run dev" />
              <select
                defaultValue=""
                onChange={(event) => {
                  applyPreset(event.target.value)
                  event.currentTarget.value = ''
                }}
                className="rounded-lg border border-[#22303d] bg-[#0b1117] px-3 py-2 text-xs text-slate-200"
              >
                <option value="">插入常见示例</option>
                {PRESETS.map((preset) => (
                  <option key={preset.label} value={preset.label}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={draft.command}
              onChange={(event) => setDraft((current) => ({ ...current, command: event.target.value }))}
              placeholder="例如：npm run dev"
              className="mt-2 min-h-[120px] w-full rounded-xl border border-[#22303d] bg-[#0b1117] px-4 py-3 font-mono text-sm text-slate-100 outline-none placeholder:text-[#5f7290]"
            />
          </label>

          <label className="block md:col-span-2">
            <FieldLabel title="工作目录" example="/Users/xiangzai/Documents/codex/travellog/backend" />
            <input
              value={draft.cwd ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, cwd: event.target.value }))}
              placeholder="例如：/Users/xiangzai/Documents/codex/travellog/backend"
              className="mt-2 w-full rounded-xl border border-[#22303d] bg-[#0b1117] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-[#5f7290]"
            />
          </label>

          <label className="block md:col-span-2">
            <FieldLabel title="备注" example="docker compose 或首次手动启动后补录都可以" />
            <textarea
              value={draft.notes ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
              placeholder="例如：backend 本地调试，依赖 redis 和 mysql"
              className="mt-2 min-h-[90px] w-full rounded-xl border border-[#22303d] bg-[#0b1117] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-[#5f7290]"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={persist}
            disabled={loading}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#1f6f47] bg-[#133121] px-4 text-sm text-[#9bf3be]"
          >
            <Save className="h-4 w-4" />
            保存配置
          </button>
          <button
            type="button"
            onClick={launch}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#25405a] bg-[#122130] px-4 text-sm text-[#8fcfff]"
          >
            <Play className="h-4 w-4" />
            按配置启动
          </button>
          <button
            type="button"
            onClick={() => {
              if (testMatched) {
                window.alert(`端口 ${draft.port} 当前已被占用，检测到服务：${testMatched.detectedName}。如果这不是你要启动的服务，请先关闭占用进程。`)
              } else {
                window.alert(`端口 ${draft.port || '-'} 当前没有检测到正在监听的服务。`)
              }
            }}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#2a333d] bg-[#1a2028] px-4 text-sm text-slate-200"
          >
            <TestTube2 className="h-4 w-4" />
            测试端口
          </button>
          {selected ? (
            <button
              type="button"
              onClick={remove}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#553232] bg-[#23161a] px-4 text-sm text-rose-200"
            >
              <Trash2 className="h-4 w-4" />
              删除配置
            </button>
          ) : null}
        </div>

        <div className="mt-4 rounded-2xl border border-[#1f2a33] bg-[#0b1117] px-4 py-3 text-sm text-slate-300">
          {testMatched
            ? `检测结果：${normalizedHost}:${draft.port} 当前已被 ${testMatched.detectedName} 占用。`
            : `检测结果：${normalizedHost}:${draft.port || '-'} 当前没有检测到监听。`}
        </div>
      </div>
    </div>
  )
}
