/** 仅允许壳标题栏主 frame 使用窗口操作和标题栏状态。 */
import { contextBridge, ipcRenderer } from 'electron'
import { TITLEBAR_IPC, type DesktopTitlebarApi, type DesktopTitlebarView } from './titlebar-api.ts'

if (process.isMainFrame && location.href === 'dsh-app://shell/titlebar.html') {
  const api: DesktopTitlebarApi = {
    status: () => ipcRenderer.invoke(TITLEBAR_IPC.status) as Promise<DesktopTitlebarView>,
    control: action => ipcRenderer.invoke(TITLEBAR_IPC.control, action) as Promise<void>,
    openMenu: (name, x, y) => ipcRenderer.invoke(TITLEBAR_IPC.menu, name, x, y) as Promise<void>,
    subscribe: (listener) => {
      const receive = (_event: Electron.IpcRendererEvent, view: DesktopTitlebarView): void => { listener(view) }
      ipcRenderer.on(TITLEBAR_IPC.changed, receive)
      return () => { ipcRenderer.removeListener(TITLEBAR_IPC.changed, receive) }
    },
  }
  contextBridge.exposeInMainWorld('dshTitlebar', api)
}
