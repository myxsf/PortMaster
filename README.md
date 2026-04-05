# PortMaster

PortMaster 是一个基于 `React + TypeScript + Tailwind CSS + Electron` 的桌面端 localhost 管理工具原型。它目前提供高扫描效率的单行横向列表界面，用于统一查看本地进程和 Docker 容器的端口状态。

## 当前能力

- 左侧导航切换本地进程、Docker 容器、拓扑页和设置页
- 顶部全局搜索，按端口号、别名、进程名实时过滤
- 行式服务列表，包含状态、端口、别名、技术识别、PID、Uptime、Path、Actions
- 支持模拟交互：
  - 编辑并保存自定义别名
  - 展开/收起微型日志窗口
  - Restart
  - Kill/Stop 开关
  - Copy URL
  - Open 到外部浏览器

## 技术栈

- `React 19`
- `TypeScript`
- `Tailwind CSS v4`
- `Zustand`
- `framer-motion`
- `Electron`

## 启动方式

先安装依赖：

```bash
npm install
```

开发模式启动桌面应用：

```bash
npm run dev
```

这个命令会同时做两件事：

1. 启动 Vite 开发服务器
2. 自动打开 Electron 桌面窗口

如果你只想启动前端页面调样式：

```bash
npm run dev:renderer
```

## 构建方式

构建前端和 Electron 主进程：

```bash
npm run build
```

生成应用图标资源：

```bash
npm run generate:icons
```

用生产构建结果预览桌面应用：

```bash
npm run desktop:preview
```

打包 macOS 桌面安装产物：

```bash
npm run dist:mac
```

`npm run dist:desktop` 目前等价于 `npm run dist:mac`。

打包 Windows 安装产物：

```bash
npm run dist:win
```

Windows 配置已经准备了三类目标：

- `nsis` 安装包
- `portable` 便携版
- `zip` 压缩包

说明：当前项目默认关闭了 macOS 自动签名，这样在本机没有配置 Apple Developer 证书，或环境里的 `codesign` 不是苹果原生命令时，也可以先顺利打包。

如果你以后要启用正式签名，请先确认：

```bash
which codesign
```

输出应优先是：

```bash
/usr/bin/codesign
```

如果像你现在这样命中的是 Conda 的：

```bash
/opt/anaconda3/bin/codesign
```

那就需要先调整 `PATH`，否则 `electron-builder` 仍会在签名阶段报错。

打包结果默认输出到：

```bash
release/
```

常见文件会类似：

```text
release/PortMaster-0.0.0-arm64.dmg
release/PortMaster-0.0.0-arm64-mac.zip
release/PortMaster-0.0.0-x64-setup.exe
release/PortMaster-0.0.0-x64-portable.exe
release/PortMaster-0.0.0-x64.zip
```

是否真的生成 Windows 文件，取决于当前机器环境是否支持对应目标的跨平台构建。

## 目录结构

```text
electron/
  main.ts
  preload.ts
src/
  components/
  data/
  lib/
  store/
  App.tsx
  index.css
  types.ts
```

## 关键文件

- `electron/main.ts`
  - Electron 主进程，负责创建桌面窗口
- `electron/preload.ts`
  - 暴露 `openExternal` 和 `copyText` 给前端
- `assets/portmaster-icon.svg`
  - 应用主图标源文件
- `scripts/generate-icons.mjs`
  - 自动生成 `png / icns / ico`
- `src/store/useServiceStore.ts`
  - Zustand 状态中心
- `src/data/mockServices.ts`
  - 5 个本地服务 + 3 个 Docker 容器 mock 数据
- `src/components/ServiceRow.tsx`
  - 单行服务组件
- `src/components/ServiceTable.tsx`
  - 列表表头和行为容器

## 下一步建议

- 接入真实端口扫描和 PID 读取
- 接入 Docker CLI 或 Docker Engine API
- 用系统级命令替换当前 mock 的 restart / stop
- 增加拓扑图视图和设置页表单
