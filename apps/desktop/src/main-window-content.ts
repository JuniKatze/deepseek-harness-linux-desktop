/** 主窗口壳文档与产品文档的稳定分工。 */

import type { WebContents } from 'electron'

/** 主窗口提供的最小文档能力，便于单项测试而不伪造完整 BrowserWindow。 */
export interface MainWindowDocument {
  readonly webContents: WebContents
  loadURL(url: string): Promise<void>
}

/** 主窗口向桌面生命周期暴露的文档所有权。 */
export interface DesktopMainWindowContent {
  readonly chromeContents: WebContents
  readonly productContents: WebContents
  /** 产品文档顶部相对窗口内容区的位置。 */
  readonly productTop: number
  /**
   * 在承载产品的文档中加载地址。
   * @param url 已由调用方验证的 Desktop 文档地址。
   * @returns 文档加载完成的 Promise。
   */
  loadProduct(url: string): Promise<void>
}

/** 直接用 BrowserWindow 文档承载壳和产品的平台实现。 */
export class SingleDocumentMainWindowContent implements DesktopMainWindowContent {
  /** @param window 同时承载壳与产品的主窗口。 */
  constructor(readonly window: MainWindowDocument) {}

  get chromeContents(): WebContents { return this.window.webContents }

  get productContents(): WebContents { return this.window.webContents }

  get productTop(): number { return 0 }

  loadProduct(url: string): Promise<void> { return this.window.loadURL(url) }
}
