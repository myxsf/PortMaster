# PortMaster

PortMaster 是一个面向开发环境的桌面控制台，用来统一管理 `localhost` 端口、本地项目、Docker 容器和常用启动命令。

这一版的重点不只是“看见端口”，而是把下面这条链路做完整：

- 发现本地服务和 Docker 容器
- 记录项目与服务
- 保存或推断启动命令
- 后续直接在面板里启动、关闭、查看日志

仓库地址：`https://github.com/myxsf/PortMaster`

## 软件截图

![PortMaster 首页](./src/assets/hero.png)

![PortMaster 图标](./assets/portmaster-icon.svg)

## 现在能做什么

- 扫描本机监听端口，识别常见开发服务
- 读取 Docker 容器端口，并在 Docker 页统一管理
- 给服务设置别名，方便按项目或用途区分
- 对正在运行的本地服务执行“记录”
- 把手动填写的项目配置保存在“自定义”页
- 常见 Java、Spring Boot、Node、Vue、Python、Go、Open WebUI、Ollama 提供命令示例
- 对已经记录过的服务，关闭后仍保留记录，后续可以直接再次 `Start`
- 项目组支持“记录项目”“全部启动”“全部关闭”
- 日志中心支持在“开发日志 / 全部日志”之间切换，并按范围清理日志

## 适合怎么用

### 方式一：先手动启动，再记录

适合已经有自己终端习惯的项目。

1. 在终端里先启动项目
2. 回到 PortMaster，找到对应端口
3. 点击“记录”
4. 以后这个服务即使关闭，也会保留在列表里
5. 下次直接点击“启动”

### 方式二：先在“自定义”里配置，再直接启动

适合固定命令的项目，或者自动识别不到合适命令的项目。

1. 打开左侧 `自定义`
2. 填写项目名、服务名、端口、工作目录、启动命令
3. 保存配置
4. 点击 `按配置启动`
5. 配置会同步出现在主列表里，后续可以直接复用

## 页面说明

### 首页

- 展示项目简介
- 提供 GitHub 仓库按钮
- 预留讨论 Q 群按钮

### 仪表盘

- 只看本地服务
- 支持搜索端口、别名、进程名、路径
- 对本地项目提供“打开”“查看日志”“记录”“启动 / 关闭”

### Docker 容器

- 只看 Docker 容器
- 支持“启动 / 停止”
- 启动后会校验容器是否真的进入运行状态

### 日志中心

- 统一查看最近日志
- 支持按项目或端口筛选
- 支持清理当前筛选范围的日志

### 自定义

- 保存项目级配置
- 给每个输入项提供示例
- 必填项明确标记
- 可直接按配置启动

## 安装依赖

```bash
npm install
```

## 开发启动

启动桌面应用：

```bash
npm run dev
```

只启动前端调试页：

```bash
npm run dev:renderer
```

只用生产构建结果预览桌面端：

```bash
npm run desktop:preview
```

## 构建

构建前端和 Electron 主进程：

```bash
npm run build
```

生成图标资源：

```bash
npm run generate:icons
```

## 打包命令

### macOS

ARM 版本：

```bash
npm run dist:mac:arm64
```

Intel 版本：

```bash
npm run dist:mac:x64
```

也可以直接使用：

```bash
npm run dist:mac
```

### Windows

ARM 版本：

```bash
npm run dist:win:arm64
```

X64 版本：

```bash
npm run dist:win:x64
```

也可以直接使用：

```bash
npm run dist:win
```

## 直接下载 Release / 本地产物

打包后的文件默认在 `release/` 目录。

当前项目里常见的文件名包括：

```text
release/PortMaster-0.0.0-macos-arm64.dmg
release/PortMaster-0.0.0-macos-arm64.zip
release/PortMaster-0.0.0-windows-x64-setup.exe
release/PortMaster-0.0.0-windows-x64-portable.exe
release/PortMaster-0.0.0-windows-x64.zip
release/PortMaster-0.0.0-windows-arm64-setup.exe
release/PortMaster-0.0.0-windows-arm64-portable.exe
release/PortMaster-0.0.0-windows-arm64.zip
```

如果你是从 GitHub Release 下载，优先选择：

- macOS Apple Silicon：`PortMaster-0.0.0-macos-arm64.dmg`
- Windows x64：`PortMaster-0.0.0-windows-x64-setup.exe`
- 不想安装可用：`portable.exe`

## 常见启动命令示例

```bash
# Spring Boot
./mvnw spring-boot:run

# Maven Java
mvn spring-boot:run

# Gradle Spring Boot
./gradlew bootRun

# React / Vue / Node
npm run dev

# Python
python main.py

# FastAPI
python -m uvicorn main:app --reload

# Go
go run .

# Open WebUI
docker compose up -d

# Ollama
ollama serve
```

## 使用建议

- 第一次启动不确定命令时，可以先手动启动一次，再回来“记录”
- 项目有多个端口时，建议都放到同一个项目名下，方便“全部启动 / 全部关闭”
- 如果点击“启动”后没起来，先看“查看日志”
- Docker 服务没起来时，先确认 Docker Desktop 已启动，再检查 compose 文件和镜像状态

## 技术栈

- `React 19`
- `TypeScript`
- `Tailwind CSS v4`
- `Zustand`
- `Framer Motion`
- `Electron`
