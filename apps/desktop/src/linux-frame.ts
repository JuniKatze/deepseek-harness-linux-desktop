/** Linux 壳将标题栏和原样的 Web 工作区放在两个独立文档中。 */
import { WebContentsView, type BrowserWindow, type WebContents } from 'electron'
import { LINUX_TITLEBAR_HEIGHT } from './windows-layout.ts'

/** Linux 标题栏文档地址，只由 Electron 主窗口加载。 */
export const LINUX_TITLEBAR_URL = 'dsh-app://shell/titlebar.html'

/** 保留原生窗口作为壳，工作区的布局和生命周期由这个视图持有。 */
export class LinuxDesktopFrame {
  readonly view: WebContentsView

  /**
   * @param window - 承载壳标题栏的原生窗口。
   * @param preload - 原有工作区使用的隔离 preload。
   */
  constructor(private readonly window: BrowserWindow, preload: string) {
    this.view = new WebContentsView({ webPreferences: {
      preload, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true,
      webviewTag: true, devTools: true,
    } })
    window.contentView.addChildView(this.view)
    const resize = (): void => {
      const { width, height } = window.getContentBounds()
      const top = this.top
      this.view.setBounds({ x: 0, y: top, width, height: Math.max(0, height - top) })
    }
    window.on('resize', resize)
    window.on('enter-full-screen', resize)
    window.on('leave-full-screen', resize)
    window.once('closed', () => {
      window.off('resize', resize)
      window.off('enter-full-screen', resize)
      window.off('leave-full-screen', resize)
      this.webContents.close({ waitForBeforeUnload: false })
    })
    resize()
  }

  /** 工作区文档；产品 IPC、快捷键与流连接仅绑定此对象。 */
  get webContents(): WebContents { return this.view.webContents }

  /** 原生内容坐标中的工作区顶边；全屏时工作区覆盖标题栏。 */
  get top(): number { return this.window.isFullScreen() ? 0 : LINUX_TITLEBAR_HEIGHT }
}
