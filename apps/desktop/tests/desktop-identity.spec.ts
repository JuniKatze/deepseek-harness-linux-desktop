import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LINUX_DESKTOP_DISTRIBUTION } from '../src/desktop-distribution.mjs'
import {
  configureDesktopUserData,
  desktopOpenProtocol,
  desktopOpenUrl,
  desktopProfileName,
  desktopUserDataDirectory,
} from '../src/desktop-identity.ts'
import { resolveDesktopPaths } from '../src/paths.ts'

describe('desktop installation identity', () => {
  it('isolates the Linux profile while preserving existing macOS and Windows paths', () => {
    const home = '/home/tester/.dsh'
    expect(resolveDesktopPaths(home, 'linux')).toEqual({
      profile: join(home, 'profiles', LINUX_DESKTOP_DISTRIBUTION.profileName),
      lock: join(home, 'profiles', LINUX_DESKTOP_DISTRIBUTION.profileName, 'lock'),
    })
    for (const platform of ['darwin', 'win32'] as const) {
      expect(resolveDesktopPaths(home, platform).profile).toBe(join(home, 'profiles', 'desktop'))
    }
    expect(desktopProfileName('linux')).toBe('linux-desktop')
    expect(desktopProfileName('darwin')).toBe('desktop')
  })

  it('uses an independent wake-up protocol on Linux', () => {
    expect(desktopOpenProtocol('linux')).toBe(LINUX_DESKTOP_DISTRIBUTION.protocolScheme)
    expect(desktopOpenUrl('linux')).toBe(`${LINUX_DESKTOP_DISTRIBUTION.protocolScheme}://open`)
    expect(desktopOpenProtocol('darwin')).toBe('dsh')
    expect(desktopOpenUrl('win32')).toBe('dsh://open')
  })

  it('isolates Electron user data on Linux', () => {
    expect(desktopUserDataDirectory('/home/tester/.config', 'linux'))
      .toBe(join('/home/tester/.config', LINUX_DESKTOP_DISTRIBUTION.userDataDirectoryName))
    expect(desktopUserDataDirectory('/home/tester/Library/Application Support', 'darwin')).toBeUndefined()
    expect(desktopUserDataDirectory('C:\\Users\\tester\\AppData\\Roaming', 'win32')).toBeUndefined()
  })

  it('sets Linux user data before Electron reads its default paths', () => {
    const writes: Array<[string, string]> = []
    expect(configureDesktopUserData({
      getPath: name => name === 'appData' ? '/home/tester/.config' : '/unexpected',
      setPath: (name, path) => { writes.push([name, path]) },
    }, 'linux')).toBe(join('/home/tester/.config', LINUX_DESKTOP_DISTRIBUTION.userDataDirectoryName))
    expect(writes).toEqual([['userData', join('/home/tester/.config', LINUX_DESKTOP_DISTRIBUTION.userDataDirectoryName)]])

    writes.length = 0
    expect(configureDesktopUserData({
      getPath: () => '/home/tester/Library/Application Support',
      setPath: (name, path) => { writes.push([name, path]) },
    }, 'darwin')).toBeUndefined()
    expect(writes).toEqual([])
  })
})
