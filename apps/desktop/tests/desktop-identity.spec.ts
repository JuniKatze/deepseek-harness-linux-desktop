import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { desktopOpenProtocol, desktopOpenUrl, desktopProfileName, desktopUserDataDirectory } from '../src/desktop-identity.ts'
import { resolveDesktopPaths } from '../src/paths.ts'

describe('desktop installation identity', () => {
  it('isolates the Linux profile while preserving existing macOS and Windows paths', () => {
    const home = '/home/tester/.dsh'
    expect(resolveDesktopPaths(home, 'linux')).toEqual({
      profile: join(home, 'profiles', 'linux-desktop'),
      lock: join(home, 'profiles', 'linux-desktop', 'lock'),
    })
    for (const platform of ['darwin', 'win32'] as const) {
      expect(resolveDesktopPaths(home, platform).profile).toBe(join(home, 'profiles', 'desktop'))
    }
    expect(desktopProfileName('linux')).toBe('linux-desktop')
    expect(desktopProfileName('darwin')).toBe('desktop')
  })

  it('uses an independent wake-up protocol on Linux', () => {
    expect(desktopOpenProtocol('linux')).toBe('dsh-linux')
    expect(desktopOpenUrl('linux')).toBe('dsh-linux://open')
    expect(desktopOpenProtocol('darwin')).toBe('dsh')
    expect(desktopOpenUrl('win32')).toBe('dsh://open')
  })

  it('isolates Electron user data on Linux', () => {
    expect(desktopUserDataDirectory('/home/tester/.config', 'linux')).toBe('/home/tester/.config/DSH Linux Desktop')
    expect(desktopUserDataDirectory('/home/tester/Library/Application Support', 'darwin')).toBeUndefined()
    expect(desktopUserDataDirectory('C:\\Users\\tester\\AppData\\Roaming', 'win32')).toBeUndefined()
  })
})
