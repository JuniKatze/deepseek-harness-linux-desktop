/** Marks the document root with the host platform so shared Web UI CSS can scope desktop-only rules. */

import { ipcRenderer } from 'electron'
import { DESKTOP_IPC } from './ipc.ts'
import { LINUX_TITLEBAR_HEIGHT } from './windows-layout.ts'

/**
 * Sets `data-platform` (e.g. `darwin`) on `<html>`, deferring to DOMContentLoaded
 * when the preload runs before the document root exists.
 */
export function markDocumentPlatform(): void {
  const mark = (): void => {
    document.documentElement.dataset.platform = process.platform
    if (process.platform === 'linux') {
      document.documentElement.dataset.linuxTitlebar = ''
      document.documentElement.style.setProperty('--dsh-linux-titlebar-height', `${LINUX_TITLEBAR_HEIGHT}px`)
    }
  }
  // lib.dom types documentElement non-null, but a preload runs before the
  // document root exists.
  const root = document.documentElement as HTMLElement | null
  if (root === null) window.addEventListener('DOMContentLoaded', mark)
  else mark()
}

/**
 * Mirrors the window's macOS and Windows fullscreen state onto `<html data-fullscreen>` so
 * CSS drops the clearance for hidden native window controls. The main
 * process sends the state on every transition and after each load.
 */
export function syncWindowFullscreen(): void {
  // The main process sends this IPC on every platform with custom window chrome.
  ipcRenderer.on(DESKTOP_IPC.windowFullscreen, (_event, fullscreen: boolean) => {
    const root = document.documentElement as HTMLElement | null
    if (root === null) return
    if (fullscreen) root.dataset.fullscreen = 'true'
    else delete root.dataset.fullscreen
  })
}
