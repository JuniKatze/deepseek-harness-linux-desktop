/** 桌面壳按平台开放的稳定产品能力。 */

/** 主进程和隔离 preload 共同遵循的平台能力。 */
export interface DesktopCapabilities {
  /** 主窗口是否使用独立壳文档承载产品工作区。 */
  readonly shellTitlebar: boolean
  /** 是否安装 Electron 应用菜单；Windows 使用隐藏菜单注册快捷键，Linux 改用弹出菜单。 */
  readonly persistentApplicationMenu: boolean
  /** 是否提供系统托盘作为隐藏窗口的恢复入口。 */
  readonly tray: boolean
  /** 是否暴露更新检查和更新渠道设置。 */
  readonly updates: boolean
  /** 是否提供 GUI 中管理 dsh 命令的入口。 */
  readonly commandManager: boolean
}

/**
 * 返回一个桌面平台的稳定产品能力。
 * @param platform 目标桌面平台。
 * @returns 主进程与 preload 共享的能力声明。
 */
export function desktopCapabilities(platform: NodeJS.Platform = process.platform): DesktopCapabilities {
  if (platform === 'linux') {
    return Object.freeze({
      shellTitlebar: true,
      persistentApplicationMenu: false,
      tray: true,
      updates: false,
      commandManager: false,
    })
  }
  if (platform === 'win32') {
    return Object.freeze({
      shellTitlebar: false,
      persistentApplicationMenu: true,
      tray: true,
      updates: true,
      commandManager: true,
    })
  }
  return Object.freeze({
    shellTitlebar: false,
    persistentApplicationMenu: true,
    tray: false,
    updates: true,
    commandManager: true,
  })
}
