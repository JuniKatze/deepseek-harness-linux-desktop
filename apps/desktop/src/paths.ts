/** Filesystem ownership for the Electron-managed desktop installation. */

import { join } from 'node:path'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { desktopProfileName } from './desktop-identity.ts'

/** Stable desktop installation paths under the shared Harness home. */
export interface DesktopPaths {
  readonly profile: string
  readonly lock: string
}

/**
 * Resolve every Electron-owned path without changing the shared data roots.
 * @param dshHome - Harness home shared with npm-installed dsh.
 * @param platform - Target desktop platform that owns the profile.
 * @returns immutable desktop path set.
 */
export function resolveDesktopPaths(
  dshHome: string = resolveDshHome(),
  platform: NodeJS.Platform = process.platform,
): DesktopPaths {
  const profile = join(dshHome, 'profiles', desktopProfileName(platform))
  return {
    profile,
    lock: join(profile, 'lock'),
  }
}
