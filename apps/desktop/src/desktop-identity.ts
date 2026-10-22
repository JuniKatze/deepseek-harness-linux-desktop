/** Linux 并行安装版与官方桌面端共享数据，但使用独立的运行时身份。 */

import { join } from 'node:path'

/**
 * 返回桌面端占用的 Harness profile 目录名。
 *
 * Linux 社区并行版不能复用旧桌面壳的 `desktop` profile，否则新壳会在首次启动时迁移
 * 旧插件与默认模型配置；macOS 和 Windows 继续保留现有目录，避免改变既有安装行为。
 * @param platform - 目标桌面平台。
 * @returns `$DSH_HOME/profiles` 下的稳定目录名。
 */
export function desktopProfileName(platform: NodeJS.Platform = process.platform): 'desktop' | 'linux-desktop' {
  return platform === 'linux' ? 'linux-desktop' : 'desktop'
}

/**
 * 返回桌面端向操作系统注册的外部唤醒协议。
 *
 * 旧社区桌面端已经占用 `dsh://`。Linux 并行版注册独立协议，使登录完成页或其他外部
 * 唤起不会在两个桌面壳之间抢占默认处理程序。
 * @param platform - 目标桌面平台。
 * @returns 不含 `://` 的协议名。
 */
export function desktopOpenProtocol(platform: NodeJS.Platform = process.platform): 'dsh' | 'dsh-linux' {
  return platform === 'linux' ? 'dsh-linux' : 'dsh'
}

/**
 * 构造桌面端用于聚焦现有窗口的外部 URL。
 * @param platform - 目标桌面平台。
 * @returns 带尾部 `open` 的协议 URL。
 */
export function desktopOpenUrl(platform: NodeJS.Platform = process.platform): string {
  return `${desktopOpenProtocol(platform)}://open`
}

/**
 * 返回 Linux 并行版独占的 Electron `userData` 目录。
 *
 * 包内 `name` 仍用于模块身份，因此不能依赖 Electron 根据 `productName` 自动选择
 * 配置目录。显式路径同时隔离桌面设置、Cookie、缓存和单实例锁。
 * @param appData - 操作系统提供的用户应用配置根目录。
 * @param platform - 目标桌面平台。
 * @returns Linux 上的固定目录；其他平台维持 Electron 原有路径。
 */
export function desktopUserDataDirectory(
  appData: string,
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  return platform === 'linux' ? join(appData, 'DSH Linux Desktop') : undefined
}
