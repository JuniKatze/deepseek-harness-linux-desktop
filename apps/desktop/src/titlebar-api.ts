/** Electron 壳自有标题栏的状态与窗口操作，不提供工作区或插件访问能力。 */
import type { DesktopMessages } from './locale.ts'

/** 仅供壳标题栏 preload 与主进程通信的 IPC 通道。 */
export const TITLEBAR_IPC = {
  status: 'dsh-titlebar:status',
  changed: 'dsh-titlebar:changed',
  control: 'dsh-titlebar:control',
  menu: 'dsh-titlebar:menu',
} as const

/** 主进程拥有的窗口状态、主题和本地化标签。 */
export interface DesktopTitlebarView {
  readonly locale: string
  readonly theme: 'light' | 'dark'
  readonly maximized: boolean
  readonly messages: Pick<DesktopMessages,
    'menuBar' | 'edit' | 'windowMinimize' | 'windowMaximize' | 'windowRestore' | 'updateClose'>
}

/** 仅向壳标题栏主 frame 暴露；IPC 失败通过返回的 Promise 拒绝。 */
export interface DesktopTitlebarApi {
  /** @returns 主进程当前的标题栏状态。 */
  status(): Promise<DesktopTitlebarView>
  /**
   * @param action 对所属窗口执行的操作。
   * @returns 操作完成时兑现的 Promise。
   */
  control(action: 'minimize' | 'toggle-maximize' | 'close'): Promise<void>
  /**
   * @param name 要打开的原生菜单。
   * @param x 菜单左侧相对标题栏文档的 CSS 像素坐标。
   * @param y 菜单顶部相对标题栏文档的 CSS 像素坐标。
   * @returns 原生菜单关闭时兑现的 Promise。
   */
  openMenu(name: 'application' | 'edit', x: number, y: number): Promise<void>
  /**
   * @param listener 接收主进程后续状态，不接收 Electron event 对象。
   * @returns 移除本次订阅的函数；页面离开时由调用方执行。
   */
  subscribe(listener: (view: DesktopTitlebarView) => void): () => void
}
