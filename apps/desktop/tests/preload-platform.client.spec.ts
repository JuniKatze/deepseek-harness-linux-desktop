// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { DESKTOP_IPC } from '../src/ipc.ts'
import { markDocumentPlatform, syncWindowFullscreen } from '../src/preload-platform.ts'

const on = vi.hoisted(() => vi.fn())
vi.mock('electron', () => ({ ipcRenderer: { on } }))

afterEach(() => {
  delete document.documentElement.dataset.fullscreen
  vi.restoreAllMocks()
  on.mockClear()
})

it('marks Linux without adding titlebar layout to the product document', () => {
  vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
  markDocumentPlatform()
  expect(document.documentElement.dataset.platform).toBe('linux')
  expect(document.documentElement.hasAttribute('data-linux-titlebar')).toBe(false)
  expect(document.documentElement.style.getPropertyValue('--dsh-linux-titlebar-height')).toBe('')
})

it.each(['linux', 'darwin', 'win32'] as const)('mirrors the sent fullscreen state onto html[data-fullscreen] on %s', (platform) => {
  vi.spyOn(process, 'platform', 'get').mockReturnValue(platform)
  syncWindowFullscreen()
  expect(on).toHaveBeenCalledExactlyOnceWith(DESKTOP_IPC.windowFullscreen, expect.any(Function))
  const handler = on.mock.calls[0]?.[1] as (event: unknown, fullscreen: boolean) => void
  handler({}, true)
  expect(document.documentElement.dataset.fullscreen).toBe('true')
  handler({}, false)
  expect(document.documentElement.dataset.fullscreen).toBeUndefined()
  // A repeated windowed report stays a no-op rather than toggling the flag.
  handler({}, false)
  expect(document.documentElement.dataset.fullscreen).toBeUndefined()
})
