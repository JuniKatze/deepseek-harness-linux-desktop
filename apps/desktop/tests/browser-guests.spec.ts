import { EventEmitter } from 'node:events'
import type { WebContents } from 'electron'
import { afterEach, expect, it, onTestFinished, vi } from 'vitest'
import { DESKTOP_IPC } from '../src/ipc.ts'

const electron = vi.hoisted(() => ({
  fromPartition: vi.fn(() => ({
    setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn(), setDevicePermissionHandler: vi.fn(),
    setDisplayMediaRequestHandler: vi.fn(), on: vi.fn(), webRequest: { onBeforeRequest: vi.fn() },
  })),
}))
vi.mock('electron', () => ({ app: { isPackaged: true }, session: electron }))
const { DesktopBrowserGuests } = await import('../src/browser-guests.ts')
afterEach(() => { vi.clearAllMocks() })

it('binds guest attachment and popup delivery to workspace contents independently from the caption', async () => {
  const shell = Object.assign(new EventEmitter() as WebContents, { send: vi.fn(), isDestroyed: () => false })
  const owner = Object.assign(new EventEmitter() as WebContents, { send: vi.fn(), isDestroyed: () => false })
  const guests = new DesktopBrowserGuests(() => undefined)
  const releaseInput = vi.fn()
  const attachInput = vi.fn(() => releaseInput)
  guests.bind(owner, attachInput)
  const reservation = guests.acquire(owner, 'workspace')
  const captionLease = guests.acquire(shell, 'workspace')
  onTestFinished(async () => {
    await guests.release(owner, reservation.lease)
    await guests.release(shell, captionLease.lease)
  })
  expect(shell.listenerCount('will-attach-webview')).toBe(0)
  const rejected = { preventDefault: vi.fn() }
  owner.emit('will-attach-webview', rejected, {}, { src: 'about:blank#' + captionLease.lease, partition: captionLease.partition })
  expect(rejected.preventDefault).toHaveBeenCalledOnce()
  const approved = { preventDefault: vi.fn() }
  owner.emit('will-attach-webview', approved, {}, { src: 'about:blank#' + reservation.lease, partition: reservation.partition })
  expect(approved.preventDefault).not.toHaveBeenCalled()
  const guest = Object.assign(new EventEmitter() as WebContents, {
    getURL: () => 'about:blank#' + reservation.lease, isDestroyed: () => false,
    setWindowOpenHandler: vi.fn<WebContents['setWindowOpenHandler']>(), close: vi.fn<WebContents['close']>(),
  })
  guest.close.mockImplementation(() => { guest.emit('destroyed') })
  owner.emit('did-attach-webview', {}, guest)
  guest.emit('dom-ready')
  expect(attachInput).toHaveBeenCalledExactlyOnceWith(guest, reservation.lease)
  const open = guest.setWindowOpenHandler.mock.calls[0]![0]
  expect(open(Object.assign({} as Parameters<typeof open>[0], { url: 'https://example.test/' }))).toEqual({ action: 'deny' })
  expect(owner.send).toHaveBeenCalledExactlyOnceWith(DESKTOP_IPC.browserOpenRequested,
    { lease: reservation.lease, url: 'https://example.test/' })
  expect(shell.send).not.toHaveBeenCalled()
  await guests.release(owner, reservation.lease)
  expect(releaseInput).toHaveBeenCalled()
  expect(guest.close).toHaveBeenCalledExactlyOnceWith({ waitForBeforeUnload: false })
})
