/** 验证随包 LibreOffice 两个入口对 Electron ASAR 缺失路径的识别。 */

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const require = createRequire(new URL('../../../packages/document/office-kit/package.json', import.meta.url))
const kitManifest = require.resolve('@deepseek-ai/libreoffice-kit/package.json')
const kit = JSON.parse(readFileSync(kitManifest, 'utf8')) as { version: string }
const nativePackage = '@deepseek-ai/libreoffice-kit-linux-x64-glibc'

it('qualifies the fallback patch against the rc.3 Office dependency', () => {
  expect(kit.version).toBe('0.2.3')
})

describe.each(['index', 'cli'])('LibreOffice %s native package detection', (entry) => {
  const path = join(dirname(kitManifest), 'lib', `${entry}.js`)
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const helper = source.statements.filter(ts.isFunctionDeclaration).find(node => node.name?.text === 'installedPackageExists')
  if (helper === undefined) throw new Error(`LibreOffice ${entry} has no installedPackageExists helper; review the fallback patch`)
  const helperSource = helper.getText(source)

  // CLI 自带引擎解析代码，不能通过导入 Node API 来代替验证；仅隔离文件状态查询，执行安装后的真实函数。
  function probe(statuses: readonly (object | null | undefined)[], failure?: Error): boolean {
    const directories = statuses.map((_status, index) => `resolution-${index}`)
    const records = new Map(directories.map((directory, index) => [join(directory, nativePackage), statuses[index]] as const))
    const result = { exists: (_name: string): boolean => { throw new Error('LibreOffice package probe was not loaded') } }
    runInNewContext(`${helperSource}; result.exists = installedPackageExists`, {
      result, join, require: { resolve: { paths: () => directories } },
      lstatSync: (target: string, options: { throwIfNoEntry: boolean }) => {
        expect(options).toEqual({ throwIfNoEntry: false })
        if (failure !== undefined) throw failure
        return records.get(target)
      },
    })
    return result.exists(nativePackage)
  }

  it.each([null, undefined])('treats a missing native engine reported as %s as absent', (status) => {
    expect(probe([status])).toBe(false)
  })

  it('does not claim that a native engine exists in empty or missing resolution paths', () => {
    expect(probe([])).toBe(false)
    expect(probe([null, undefined])).toBe(false)
  })

  it('still recognizes an installed native engine after missing resolution paths', () => {
    expect(probe([null, undefined, {}])).toBe(true)
  })

  it('propagates filesystem failures instead of reporting the native engine as absent', () => {
    const error = Object.assign(new Error('Native engine path is unreadable'), { code: 'EACCES' })
    expect(() => probe([undefined], error)).toThrow(error)
  })
})
