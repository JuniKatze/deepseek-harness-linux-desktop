/** 不加载兼容模块的负控：固定 Electron 的 null 会使上游把缺失引擎误报为安装损坏。 */
import assert from 'node:assert/strict'
import { lstatSync } from 'node:fs'
import { join } from 'node:path'
import { createEnginePackageResolver } from './locate.mjs'

const archive = process.argv[2]
assert.equal(lstatSync(join(archive, 'absent'), { throwIfNoEntry: false }), null)
const resolve = createEnginePackageResolver(join(archive, 'node_modules', '@deepseek-ai', 'libreoffice-kit', 'index.js'))
assert.throws(() => resolve('@deepseek-ai/libreoffice-kit-absent'), error =>
  error.message.includes('Installed LibreOfficeKit package is incomplete:') && error.cause?.code === 'MODULE_NOT_FOUND')
process.stdout.write('HOST_NODE_PRELOAD_BASELINE_NULL_INCOMPLETE')
