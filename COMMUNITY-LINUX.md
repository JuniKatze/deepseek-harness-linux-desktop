# DeepSeek Harness Linux Desktop (Community Build)

[中文说明](#中文说明)

## English

This repository is a community fork of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It adds an unofficial Electron desktop package for Debian Linux. It is not affiliated with, endorsed by, or published by DeepSeek.

### Supported system

- Debian 12 or 13
- amd64 / x86_64
- Electron Desktop mode with the bundled DeepSeek Harness Desktop Host

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

### Known limitations

- No in-app automatic updates or server-enforced updates.
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

本仓库是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的社区分叉，增加非官方 Debian Linux Electron 桌面安装包。它不是 DeepSeek 官方发行，也不代表 DeepSeek 的认可或支持。

### 支持范围

- Debian 12 或 13
- amd64 / x86_64
- Electron Desktop 模式，并保留随包的 DeepSeek Harness Desktop Host

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

### 已知限制

- 不提供应用内自动更新或服务端强制更新。
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
