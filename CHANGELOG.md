# Changelog

## v0.0.0 - 2026-04-06

### Added

- 新增“启动服务”冒烟测试脚本 `npm run test:launch-smoke`
- 新增最小本地 HTTP 服务夹具，用于验证 PortMaster 启动和关闭链路
- README 补充两种下载安装方式：源码安装与系统压缩包解压即用

### Changed

- “自定义”页的端口测试逻辑只会把真正运行中的服务判定为占用
- `dev:desktop`、`desktop:preview`、`test:launch-smoke` 会自动清理 `ELECTRON_RUN_AS_NODE`，避免 Electron 被错误当成 Node 运行
- README 重写为面向最终用户的安装、使用、构建说明
- README 补充各平台“推荐下载”说明，明确 Windows x64、Windows 32 位、macOS Intel、macOS Apple Silicon 应该下载哪个包

### Fixed

- 修复表单模式启动链路的真实验收缺口
- 修复命令行模式启动链路的真实验收缺口
- 修复启动日志文件句柄未及时关闭导致的 Electron 弃用警告
- 修复端口 8080 等“已记录但已停止”服务被误报为占用的问题
- 修复 Windows 下载包启动时报 `spawn lsof ENOENT` 的兼容性问题
