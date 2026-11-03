import { describe, expect, it } from 'vitest'
import { desktopCapabilities } from '../src/desktop-capabilities.ts'

describe('desktop platform capabilities', () => {
  it('keeps Linux on the independent shell, tray and local-only update policy', () => {
    expect(desktopCapabilities('linux')).toEqual({
      shellTitlebar: true,
      persistentApplicationMenu: false,
      tray: true,
      updates: false,
      commandManager: false,
    })
  })

  it.each([
    ['win32', {
      shellTitlebar: false,
      persistentApplicationMenu: true,
      tray: true,
      updates: true,
      commandManager: true,
    }],
    ['darwin', {
      shellTitlebar: false,
      persistentApplicationMenu: true,
      tray: false,
      updates: true,
      commandManager: true,
    }],
  ] as const)('keeps %s on the existing Desktop product capabilities', (platform, expected) => {
    expect(desktopCapabilities(platform)).toEqual(expected)
  })
})
