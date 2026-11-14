/** 以真实 Electron RunAsNode 读取归档，直接核对未修改的 Office 引擎解析。 */
import assert from 'node:assert/strict'
import fs, { lstatSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { original } from './capture.mjs'
import { createEnginePackageResolver } from './locate.mjs'

const archive = process.argv[2]
assert.ok(process.versions.electron)
assert.notEqual(fs.lstatSync, original)
assert.equal(lstatSync, fs.lstatSync)
assert.equal(createRequire(import.meta.url)('node:fs').lstatSync, lstatSync)
assert.equal(lstatSync(join(archive, 'absent'), { throwIfNoEntry: false }), undefined)
assert.equal(lstatSync(join(archive, 'absent'), { throwIfNoEntry: false, bigint: true }), undefined)
assert.throws(() => lstatSync(join(archive, 'absent')), { code: 'ENOENT' })
const resolve = createEnginePackageResolver(join(archive, 'node_modules', '@deepseek-ai', 'libreoffice-kit', 'index.js'))
assert.throws(() => resolve('@deepseek-ai/libreoffice-kit-absent'), { code: 'MODULE_NOT_FOUND' })
assert.throws(() => resolve('@deepseek-ai/libreoffice-kit-broken'), error =>
  error.message.includes('Installed LibreOfficeKit package is incomplete:') && error.cause?.code === 'MODULE_NOT_FOUND')
assert.equal(resolve('@deepseek-ai/libreoffice-kit-native'),
  join(archive + '.unpacked', 'node_modules', '@deepseek-ai', 'libreoffice-kit-native', 'package.json'))
assert.equal(resolve('@deepseek-ai/libreoffice-kit-wasm'),
  join(archive, 'node_modules', '@deepseek-ai', 'libreoffice-kit-wasm', 'package.json'))
process.once('exit', () => {
  assert.equal(fs.lstatSync, original)
  assert.equal(lstatSync, original)
  process.stdout.write('HOST_NODE_PRELOAD_OK')
})
