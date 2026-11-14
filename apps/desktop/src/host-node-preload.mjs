// @ts-check
/**
 * Desktop Host 的进程级 Node 兼容：仅修正 Electron ASAR 在禁用缺失异常时返回的 null。
 * --import 保证插件首次导入 node:fs 前已生效；真实状态和异常仍由 Electron 负责。
 * 修改只归当前 Node-mode 子进程所有，退出时恢复自己仍持有的函数及 ESM 导出。
 */

import builtinFs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'

/** @type {{ lstatSync: typeof builtinFs.lstatSync }} */
const fs = builtinFs

if (process.versions.electron !== undefined && process.env.ELECTRON_RUN_AS_NODE === '1') {
  const original = fs.lstatSync
  /**
   * @this {unknown}
   * @param {Parameters<typeof fs.lstatSync>} args - 原始路径、选项及调用参数。
   * @returns {ReturnType<typeof fs.lstatSync>} Node 规定的状态或缺失结果；不捕获底层错误。
   */
  function compatibleLstatSync(...args) {
    /** @type {ReturnType<typeof fs.lstatSync> | null} */
    const result = Reflect.apply(original, this, args)
    return result === null && args[1]?.throwIfNoEntry === false ? undefined : result
  }
  // 各 overload 的 Stats/BigIntStats 对应关系由原函数保持，包装器只统一缺失结果。
  fs.lstatSync = /** @type {typeof fs.lstatSync} */ (compatibleLstatSync)
  syncBuiltinESMExports()
  process.once('exit', () => {
    // 后续所有者若替换了函数，不得由本兼容层覆盖其修改。
    if (fs.lstatSync !== compatibleLstatSync) return
    fs.lstatSync = original
    syncBuiltinESMExports()
  })
}
