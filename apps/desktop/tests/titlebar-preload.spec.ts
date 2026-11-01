import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { en } from '../src/locale.ts'
import { TITLEBAR_IPC, type DesktopTitlebarApi, type DesktopTitlebarView } from '../src/titlebar-api.ts'

const electron = vi.hoisted(() => ({
  contextBridge: { exposeInMainWorld: vi.fn<(name: string, api: DesktopTitlebarApi) => void>() },
  ipcRenderer: {
    invoke: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    on: vi.fn<(channel: string, listener: (event: unknown, view: DesktopTitlebarView) => void) => void>(),
    removeListener: vi.fn(),
  },
}))
vi.mock('electron', () => electron)

const view: DesktopTitlebarView = {
  locale: 'en', theme: 'dark', maximized: true,
  messages: {
    menuBar: en.menuBar, edit: en.edit, windowMinimize: en.windowMinimize,
    windowMaximize: en.windowMaximize, windowRestore: en.windowRestore, updateClose: en.updateClose,
  },
}

beforeEach(() => {
  vi.stubGlobal('process', { ...process, isMainFrame: true })
  vi.stubGlobal('location', new URL('dsh-app://shell/titlebar.html'))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetAllMocks()
  vi.resetModules()
})

it('exposes only titlebar status, controls, native menus and subscriptions', async () => {
  await import('../src/preload-titlebar.ts')
  expect(electron.contextBridge.exposeInMainWorld).toHaveBeenCalledTimes(1)
  const [name, api] = electron.contextBridge.exposeInMainWorld.mock.calls[0]!
  expect(name).toBe('dshTitlebar')
  expect(Object.keys(api).sort()).toEqual(['control', 'openMenu', 'status', 'subscribe'])
  electron.ipcRenderer.invoke.mockResolvedValueOnce(view)
  await expect(api.status()).resolves.toEqual(view)
  for (const action of ['minimize', 'toggle-maximize', 'close'] as const) await api.control(action)
  await api.openMenu('application', 4, 36)
  await api.openMenu('edit', 38, 36)
  expect(electron.ipcRenderer.invoke.mock.calls).toEqual([
    [TITLEBAR_IPC.status],
    [TITLEBAR_IPC.control, 'minimize'],
    [TITLEBAR_IPC.control, 'toggle-maximize'],
    [TITLEBAR_IPC.control, 'close'],
    [TITLEBAR_IPC.menu, 'application', 4, 36],
    [TITLEBAR_IPC.menu, 'edit', 38, 36],
  ])
})

it.each([
  'dsh-app://app/titlebar.html',
  'dsh-app://shell/update-dialog.html',
  'dsh-app://shell/titlebar.html?workspace=1',
  'dsh-app://shell/titlebar.html#frame',
  'https://shell/titlebar.html',
  'file:///titlebar.html',
])('does not expose or subscribe from %s', async (url) => {
  vi.stubGlobal('location', new URL(url))
  await import('../src/preload-titlebar.ts')
  expect(electron.contextBridge.exposeInMainWorld).not.toHaveBeenCalled()
  expect(electron.ipcRenderer.on).not.toHaveBeenCalled()
  expect(electron.ipcRenderer.invoke).not.toHaveBeenCalled()
})

it('does not expose the bridge in a child frame at the exact shell URL', async () => {
  vi.stubGlobal('process', { ...process, isMainFrame: false })
  await import('../src/preload-titlebar.ts')
  expect(electron.contextBridge.exposeInMainWorld).not.toHaveBeenCalled()
  expect(electron.ipcRenderer.on).not.toHaveBeenCalled()
})

it('forwards only views and removes each subscription independently', async () => {
  await import('../src/preload-titlebar.ts')
  const api = electron.contextBridge.exposeInMainWorld.mock.calls[0]![1]
  const first = vi.fn()
  const second = vi.fn()
  const disposeFirst = api.subscribe(first)
  const disposeSecond = api.subscribe(second)
  const [channel, receiveFirst] = electron.ipcRenderer.on.mock.calls[0]!
  const receiveSecond = electron.ipcRenderer.on.mock.calls[1]![1]
  expect(channel).toBe(TITLEBAR_IPC.changed)
  receiveFirst({ sender: 'not exposed' }, view)
  receiveSecond({ sender: 'not exposed' }, view)
  expect(first.mock.calls).toEqual([[view]])
  expect(second.mock.calls).toEqual([[view]])
  disposeFirst()
  expect(electron.ipcRenderer.removeListener.mock.calls).toEqual([[TITLEBAR_IPC.changed, receiveFirst]])
  disposeSecond()
  expect(electron.ipcRenderer.removeListener).toHaveBeenLastCalledWith(TITLEBAR_IPC.changed, receiveSecond)
})

it('preserves IPC rejections for the renderer to report', async () => {
  await import('../src/preload-titlebar.ts')
  const api = electron.contextBridge.exposeInMainWorld.mock.calls[0]![1]
  const error = new Error('titlebar IPC failed')
  electron.ipcRenderer.invoke.mockRejectedValue(error)
  await expect(api.status()).rejects.toBe(error)
  await expect(api.control('close')).rejects.toBe(error)
  await expect(api.openMenu('application', 4, 36)).rejects.toBe(error)
})
