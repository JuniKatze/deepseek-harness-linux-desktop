/** 在独立进程内模拟 Electron 的 fs 偏差，避免修改 Vitest worker 的 builtin 或进程身份。 */
import assert from 'node:assert/strict'
import fs, { lstatSync } from 'node:fs'
import { createRequire, syncBuiltinESMExports } from 'node:module'

const nativeLstatSync = fs.lstatSync
const stats = nativeLstatSync(import.meta.filename)
const bigStats = nativeLstatSync(import.meta.filename, { bigint: true })
const calls = []
const failure = Object.assign(new Error('unreadable installed engine'), { code: 'EACCES' })
const missingFailure = Object.assign(new Error('missing path'), { code: 'ENOENT' })
const exitListeners = process.listenerCount('exit')
const enabled = process.env.DSH_PRELOAD_SCENARIO !== 'plain-node'
  && process.env.DSH_PRELOAD_SCENARIO !== 'electron-main'
if (process.env.DSH_PRELOAD_SCENARIO !== 'plain-node') {
  Object.defineProperty(process.versions, 'electron', { value: '44.7.0', configurable: true })
}

function original(...args) {
  calls.push({ receiver: this, args })
  if (args[0] === 'unreadable') throw failure
  if (args[0] === 'throwing-missing') throw missingFailure
  if (args[0] === 'missing') return null
  if (args[0] === 'node-missing') return undefined
  if (args[0] === 'stats') return stats
  if (args[0] === 'big-stats') return bigStats
  return Reflect.apply(nativeLstatSync, this, args)
}
fs.lstatSync = original
syncBuiltinESMExports()

/** 执行入口在 --import 之后调用；退出监听器独立核对兼容层的实际恢复结果。 */
export function verify() {
  assert.equal(fs.lstatSync === original, !enabled)
  assert.equal(fs.lstatSync, lstatSync)
  assert.equal(createRequire(import.meta.url)('node:fs').lstatSync, lstatSync)
  assert.equal(process.listenerCount('exit'), exitListeners + Number(enabled))

  const receiver = Object.freeze({ owner: 'fixture' })
  const path = 'missing'
  const options = { throwIfNoEntry: false }
  const extra = Object.freeze({ marker: true })
  assert.equal(Reflect.apply(lstatSync, receiver, [path, options, extra]), enabled ? undefined : null)
  assert.deepEqual(calls.at(-1), { receiver, args: [path, options, extra] })
  assert.equal(calls.at(-1).receiver, receiver)
  assert.equal(calls.at(-1).args[1], options)
  assert.equal(calls.at(-1).args[2], extra)

  assert.equal(fs.lstatSync('missing'), null)
  assert.equal(fs.lstatSync('missing', {}), null)
  assert.equal(fs.lstatSync('missing', { throwIfNoEntry: true }), null)
  assert.equal(fs.lstatSync('node-missing', options), undefined)
  assert.equal(fs.lstatSync('stats', options), stats)
  assert.equal(fs.lstatSync('big-stats', { ...options, bigint: true }), bigStats)
  assert.equal(typeof bigStats.size, 'bigint')
  assert.equal(typeof stats.size, 'number')
  assert.throws(() => fs.lstatSync('unreadable', options), error => error === failure)
  assert.throws(() => fs.lstatSync('throwing-missing'), error => error === missingFailure)
  const buffer = Buffer.from(import.meta.filename)
  const url = new URL(import.meta.url)
  assert.ok(fs.lstatSync(buffer, options).isFile())
  assert.equal(calls.at(-1).args[0], buffer)
  assert.ok(fs.lstatSync(url, options).isFile())
  assert.equal(calls.at(-1).args[0], url)

  const expected = process.env.DSH_PRELOAD_SCENARIO === 'later-owner' ? function laterOwner() { return stats } : original
  if (expected !== original) {
    fs.lstatSync = expected
    syncBuiltinESMExports()
  }
  process.once('exit', () => {
    assert.equal(fs.lstatSync, expected)
    assert.equal(lstatSync, expected)
    process.stdout.write('HOST_NODE_PRELOAD_OK')
  })
}
