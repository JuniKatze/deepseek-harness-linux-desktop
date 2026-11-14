# DeepSeek Harness Linux Desktop (Community Build)

[中文说明](#中文说明)

## English

This repository is a community fork of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It adds an unofficial Electron desktop package for Debian Linux. It is not affiliated with, endorsed by, or published by DeepSeek. The current upstream base is the released `dsh-v0.2.2-rc.3` tag; this branch follows released versions, not later commits on upstream `master`.

### Supported system

- Debian 12 or 13
- amd64 / x86_64
- Electron Desktop mode with the bundled DeepSeek Harness Desktop Host

### Upstream plugin parity

The first-party plugin sources and composition remain exactly those of `dsh-v0.2.2-rc.3`. The [fixed upstream check](scripts/verify-community-upstream.ts) protects the complete `packages/`, `vendor/`, `apps/cli/`, `apps/web/`, and `apps/desktop-host/` trees, including file bytes and Git modes. Linux-specific behavior belongs to Desktop; it must not modify plugin sources or rewrite first-party plugin files during packaging.

From the repository root, run `pnpm run verify-community-upstream`. The check compares both the index and the working tree with fixed release fingerprints, rejects added source files, and does not fetch a branch or require a local tag object. Ignored build outputs are not source-tree inputs. Advance these fingerprints only when explicitly following another released version.

The whitespace hook still runs the original Git check. It accepts the single EOF blank line already present in the fixed upstream file only after all protected trees and that file match their recorded hashes; every other whitespace diagnostic remains a failure. Do not reformat upstream plugin files to satisfy local checks.

### Package identity

- Debian package: `dsh-desktop-linux`
- Command: `dsh-linux-desktop`
- Installation directory: `/opt/DSH Linux Desktop`
- Desktop entry: `dsh-linux-desktop.desktop`
- Application ID: `io.github.junikatze.dsh-linux-desktop`
- External protocol: `dsh-linux://open`
- Harness profile: `$DSH_HOME/profiles/linux-desktop`
- Electron user data: `$XDG_CONFIG_HOME/DSH Linux Desktop`

The package can coexist with other DeepSeek Harness desktop shells. It shares sessions, credentials, attachments, and storage under `$DSH_HOME`, but keeps executable dependencies, plugin activation, model overrides, caches, and desktop state separate.

### Install

Download the `.deb` and `SHA256SUMS` from GitHub Releases, verify the checksum, then install:

```sh
sha256sum -c SHA256SUMS --ignore-missing
sudo apt install ./dsh-desktop-linux-<version>-linux-amd64-unsigned.deb
```

The package is currently unsigned. Verify that it came from this repository's Releases page before installing.

The sidebar uses the upstream DeepSeek Harness logo and wordmark. Closing the workspace window hides it to the system tray without stopping tasks; use the tray menu to reopen it or explicitly quit. Quitting warns before interrupting active tasks. This does not enable login autostart or a separate background service.

The Linux titlebar is a shell-owned document, separate from the unchanged Web workspace in its own WebContentsView; no DSH plugin changes are required. The dependency patch for the Office WASM fallback remains in place.

### Known limitations

- No in-app automatic updates or server-enforced updates; the update-channel setting is not shown.
- No GUI management of the `dsh` command.
- Office conversion uses the bundled WASM engine instead of a native LibreOffice engine.
- Only amd64 is currently packaged.

### Build

From the repository root:

```sh
pnpm install
pnpm run package:desktop:linux:x64
```

The verified `.deb` is written under `apps/desktop/.desktop-build/targets/linux-x64/unsigned-artifacts/`.

## 中文说明

本仓库是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的社区分叉，增加非官方 Debian Linux Electron 桌面安装包。它不是 DeepSeek 官方发行，也不代表 DeepSeek 的认可或支持。当前上游基线是已发布的 `dsh-v0.2.2-rc.3` 标签；本分支只跟随发布版本，不同步上游 `master` 上的后续提交。

### 支持范围

- Debian 12 或 13
- amd64 / x86_64
- Electron Desktop 模式，并保留随包的 DeepSeek Harness Desktop Host

### 上游插件一致性

第一方插件源码和组合严格保持为 `dsh-v0.2.2-rc.3`。[固定上游检查](scripts/verify-community-upstream.ts)保护完整的 `packages/`、`vendor/`、`apps/cli/`、`apps/web/` 和 `apps/desktop-host/` 树，包括文件字节与 Git 模式。Linux 专属行为属于 Desktop，不得修改插件源码，也不得在打包时重写第一方插件文件。

在仓库根运行 `pnpm run verify-community-upstream`。检查同时将 index 和工作树与固定发布指纹比较，拒绝新增源码文件，不拉取分支，也不要求本地存在 tag 对象。被忽略的构建产物不属于源码树输入。只有明确跟进另一个发布版本时，才能更新这些指纹。

空白检查 hook 仍执行原始 Git 检查。只有所有保护树及特定文件均匹配记录哈希时，才接受固定上游文件原有的那一个 EOF 空行；其他空白诊断仍然失败。不要为通过本地检查而重新格式化上游插件文件。

### 包身份

- Debian 包名：`dsh-desktop-linux`
- 命令：`dsh-linux-desktop`
- 安装目录：`/opt/DSH Linux Desktop`
- 桌面项：`dsh-linux-desktop.desktop`
- 应用 ID：`io.github.junikatze.dsh-linux-desktop`
- 外部协议：`dsh-linux://open`
- Harness profile：`$DSH_HOME/profiles/linux-desktop`
- Electron 用户数据：`$XDG_CONFIG_HOME/DSH Linux Desktop`

本包可以和其他 DeepSeek Harness 桌面壳并行安装。它们共享 `$DSH_HOME` 下的会话、凭证、附件和 storage，但可执行依赖、插件激活、模型覆盖、缓存及桌面状态彼此独立。

### 安装

从 GitHub Releases 下载 `.deb` 和 `SHA256SUMS`，校验后安装：

```sh
sha256sum -c SHA256SUMS --ignore-missing
sudo apt install ./dsh-desktop-linux-<版本>-linux-amd64-unsigned.deb
```

当前安装包未签名。安装前请确认文件来自本仓库的 Releases 页面。

侧栏使用上游 DeepSeek Harness 的 logo 和字标。关闭工作区窗口会隐藏到系统托盘，不会停止任务；通过托盘菜单可以重新打开或明确退出，退出前会提示正在运行的任务将被中断。这不启用登录自启动，也不安装独立后台服务。

Linux 标题栏是壳自有的文档，与独立 WebContentsView 中原样的 Web 工作区分离，不修改 DSH 插件。Office WASM 回退所需的依赖补丁仍然保留。

### 已知限制

- 不提供应用内自动更新或服务端强制更新，也不显示更新渠道设置。
- 不在 GUI 中管理 `dsh` 命令。
- Office 转换使用随包的 WASM 引擎，不提供 Linux 原生 LibreOffice 引擎。
- 当前只打包 amd64。

### 构建

在仓库根目录执行：

```sh
pnpm install
pnpm run package:desktop:linux:x64
```

验证后的 `.deb` 位于 `apps/desktop/.desktop-build/targets/linux-x64/unsigned-artifacts/`。
