# Agent Note: 社区 Linux 桌面的边界

Status: implemented

[English](2026-11-04-community-linux-desktop-boundary.md) | 中文

## 问题

社区 Linux 安装包需要独立的可执行文件、协议、profile、userData 目录、标题栏、托盘行为和发布身份。把这些需求放进客户端或插件包会让分叉在插件树中偏离上游，并把平台特定行为扩散到无关包。

## 决策

社区 Linux 行为留在 Electron Desktop 壳中。`apps/desktop/src/desktop-distribution.mjs` 负责发布身份和状态目录名，`desktop-capabilities.ts` 负责主进程与 preload 共享的产品能力，`main-window-content.ts` 负责区分壳文档与产品文档。`LinuxDesktopFrame` 使用一个标题栏文档和一个独立的工作区 `WebContentsView` 实现该文档接口。

分叉同步上游时保留上游插件组合与 `vendor/`。必要的跨运行时兼容修正仅限于原有拥有者的实现及其回归测试。Linux 专属产品行为仍只通过 Desktop 构建脚本、主进程生命周期、壳自有 preload、渲染资源、测试和 Desktop 文档进入。

## 采用过的替代方案

**为 Linux 标题栏修改客户端插件。** 该方案落选，因为窗口所有权、IPC 准入和原生窗口操作已经属于 Electron 壳；放进客户端插件会让插件树分叉，并把原生窗口行为耦合到 Web 状态。

**在运行时和打包脚本中重复身份值。** 该方案落选，因为可执行文件名、协议、profile 目录、包名和 userData 路径必须在主进程、electron-builder、运行时准备、smoke 检查和发布产物之间保持一致。

**保留分散的 `process.platform === 'linux'` 判断。** 该方案落选，因为产品策略与实现机制会变得无法区分。显式能力声明让更新、托盘、菜单和标题栏是否可用能够作为一个声明接受评审。

## 影响

插件树可以与上游保持一致，同时 Linux 发行版保留独立状态和发布身份。通用 Linux 打包与壳能力可以独立于社区专用名称和文档向上游推进。

桌面壳因此持有更多生命周期状态和测试。新增平台能力时需要更新能力声明和既有 Desktop 测试，不能只插入另一个局部平台分支。

## 测试

聚焦测试覆盖发行值、能力矩阵、主窗口文档所有权、Linux IPC 准入、标题栏行为、托盘生命周期、打包配置和本地打包环境。`package:desktop:linux:x64` 执行官方 build gate、运行时准备、Office 转换、electron-builder、已打包运行时 smoke 和 `.deb` 生成。
