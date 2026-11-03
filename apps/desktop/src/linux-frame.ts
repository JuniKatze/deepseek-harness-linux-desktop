/** Linux 壳将标题栏和原样的 Web 工作区放在两个独立文档中。 */
import { WebContentsView, type BrowserWindow, type WebContents } from 'electron'
import type { DesktopMainWindowContent } from './main-window-content.ts'
import { LINUX_TITLEBAR_HEIGHT } from './windows-layout.ts'

/** Linux 标题栏文档地址，只由 Electron 主窗口加载。 */
export const LINUX_TITLEBAR_URL = 'dsh-app://shell/titlebar.html'

/** 保留原生窗口作为壳，工作区的布局和生命周期由这个视图持有。 */
export class LinuxDesktopFrame implements DesktopMainWindowContent {
  readonly view: WebContentsView

  /**
   * @param window - 承载壳标题栏的原生窗口。
   * @param preload - 原有工作区使用的隔离 preload。
   */
  constructor(readonly window: BrowserWindow, preload: string) {
    this.view = new WebContentsView({ webPreferences: {
      preload, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true,
      webviewTag: true, devTools: true,
    } })
    window.contentView.addChildView(this.view)
    const resize = (): void => {
      const { width, height } = window.getContentBounds()
      const top = this.productTop
      this.view.setBounds({ x: 0, y: top, width, height: Math.max(0, height - top) })
    }
    window.on('resize', resize)
    window.on('enter-full-screen', resize)
    window.on('leave-full-screen', resize)
    window.once('closed', () => {
      window.off('resize', resize)
      window.off('enter-full-screen', resize)
      window.off('leave-full-screen', resize)
      this.productContents.close({ waitForBeforeUnload: false })
    })
    resize()
  }

  /** 壳标题栏文档；只有标题栏 IPC 与窗口外观状态绑定此对象。 */
  get chromeContents(): WebContents { return this.window.webContents }

  /** 工作区文档；产品 IPC、快捷键与流连接仅绑定此对象。 */
  get productContents(): WebContents { return this.view.webContents }

  /**
   * 首次导航先加载壳文档，再加载工作区；后续重复调用只更新工作区。
   * @param url 已由主进程验证的工作区地址。
   * @returns 工作区加载完成的 Promise。
   */
  async loadProduct(url: string): Promise<void> {
    if (this.chromeContents.getURL() !== LINUX_TITLEBAR_URL) await this.window.loadURL(LINUX_TITLEBAR_URL)
    await this.productContents.loadURL(url)
  }

  /** 原生内容坐标中的工作区顶边；全屏时工作区覆盖标题栏。 */
  get productTop(): number { return this.window.isFullScreen() ? 0 : LINUX_TITLEBAR_HEIGHT }
}
