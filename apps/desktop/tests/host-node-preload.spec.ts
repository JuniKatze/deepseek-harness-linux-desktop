/** Desktop 的私有 --import 只修正 Electron Node-mode fs 语义，不改变插件的引擎选择。 */
import { spawnSync } from 'node:child_process'
import { existsSync, type WriteStream } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { finished } from 'node:stream/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { COVERAGE_TEST_TIMEOUT_ENV, parseCoverageTestTimeout } from '../../../scripts/coverage-partitions.ts'

const preload = new URL('../src/host-node-preload.mjs', import.meta.url)
const fixture = new URL('./fixtures/host-node-preload-check.mjs', import.meta.url)
const require = createRequire(import.meta.url)
const electronDirectory = dirname(require.resolve('electron'))
const electronMarker = join(electronDirectory, 'path.txt')

// 子进程各自最多等待 30 秒；外层还要容纳编译和清理，且不得缩短 CI 已配置的预算。
const timeout = Math.max(60_000, parseCoverageTestTimeout(process.env[COVERAGE_TEST_TIMEOUT_ENV]) ?? 0)
vi.setConfig({ testTimeout: timeout, hookTimeout: timeout })

function assertExit(result: ReturnType<typeof spawnSync>, stdout = 'HOST_NODE_PRELOAD_OK'): void {
  expect(result.error).toBeUndefined()
  expect(result.signal).toBeNull()
  expect(result.status, result.stderr?.toString()).toBe(0)
  expect(result.stdout?.toString()).toBe(stdout)
}

describe('Desktop Host Node preload', () => {
  it.each(['electron-node', 'plain-node', 'electron-main', 'later-owner'])(
    'preserves fs values, errors, arguments and cleanup ownership in %s', (scenario) => {
      // 所有 builtin、process.versions 与退出监听器修改都属于这个被等待退出的子进程。
      assertExit(spawnSync(process.execPath, [
        '--import', fixture.href, '--import', preload.href, '--input-type=module',
        '-e', 'import { verify } from ' + JSON.stringify(fixture.href) + '; verify()',
      ], {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: scenario === 'electron-main' ? '' : '1', DSH_PRELOAD_SCENARIO: scenario },
        encoding: 'utf8', timeout: 30_000, windowsHide: true,
      }))
    },
  )

  // Electron 的入口模块会自动下载安装；缺少现成二进制时跳过，不执行 require('electron')。
  it.skipIf(!existsSync(electronMarker))('loads the private preload from ASAR before unchanged Office native detection', async () => {
    const distribution = process.env.ELECTRON_OVERRIDE_DIST_PATH ?? join(electronDirectory, 'dist')
    const electron = join(distribution, (await readFile(electronMarker, 'utf8')).trim())
    expect(existsSync(electron), 'Electron path.txt must point to an installed executable').toBe(true)
    const root = await mkdtemp(join(tmpdir(), 'desktop host preload '))
    onTestFinished(async () => { await rm(root, { recursive: true, force: true }) })
    const source = join(root, 'source')
    const lib = join(source, 'lib')
    await mkdir(lib, { recursive: true })
    // 独立发射当前私有模块，验证 Host 编译程序保留同名 .mjs；不构建插件或仓库产物。
    const program = ts.createProgram([fileURLToPath(preload)], {
      allowJs: true, checkJs: true, strict: true, skipLibCheck: true, noEmitOnError: true, esModuleInterop: true,
      target: ts.ScriptTarget.ES2024, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
      types: ['node'], outDir: lib,
    })
    const diagnostics = ts.getPreEmitDiagnostics(program)
    expect(diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))).toEqual([])
    expect(program.emit().emitSkipped).toBe(false)
    expect(existsSync(join(lib, 'host-node-preload.mjs'))).toBe(true)
    const locateSource = await readFile(new URL('../../../packages/document/office-kit/src/locate.ts', import.meta.url), 'utf8')
    // 只消除类型语法；回归执行上游现有探测逻辑，而非另写一个 !== undefined 判断替身。
    await writeFile(join(source, 'locate.mjs'), ts.transpileModule(locateSource, {
      compilerOptions: { target: ts.ScriptTarget.ES2024, module: ts.ModuleKind.ESNext },
    }).outputText)
    const scope = join(source, 'node_modules', '@deepseek-ai')
    for (const name of ['libreoffice-kit', 'libreoffice-kit-native', 'libreoffice-kit-wasm', 'libreoffice-kit-broken']) {
      const directory = join(scope, name)
      await mkdir(directory, { recursive: true })
      await writeFile(join(directory, name === 'libreoffice-kit-broken' ? 'installed' : 'package.json'), '{}')
    }
    await writeFile(join(scope, 'libreoffice-kit', 'index.js'), '')
    await writeFile(join(source, 'capture.mjs'), "import fs from 'node:fs'; export const original = fs.lstatSync;\n")
    await copyFile(new URL('./fixtures/host-node-asar-check.mjs', import.meta.url), join(source, 'probe.mjs'))
    await copyFile(new URL('./fixtures/host-node-asar-baseline.mjs', import.meta.url), join(source, 'baseline.mjs'))
    const builderRequire = createRequire(require.resolve('app-builder-lib/package.json'))
    const { createPackageWithOptions } = builderRequire('@electron/asar') as {
      createPackageWithOptions: (source: string, destination: string, options: object) => Promise<WriteStream>
    }
    const archive = join(root, 'app.asar')
    await finished(await createPackageWithOptions(source, archive, {}))
    assertExit(spawnSync(electron, [join(archive, 'baseline.mjs'), archive], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8', timeout: 30_000, windowsHide: true,
    }), 'HOST_NODE_PRELOAD_BASELINE_NULL_INCOMPLETE')
    assertExit(spawnSync(electron, [
      '--import', pathToFileURL(join(archive, 'capture.mjs')).href,
      '--import', pathToFileURL(join(archive, 'lib', 'host-node-preload.mjs')).href,
      join(archive, 'probe.mjs'), archive,
    ], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8', timeout: 30_000, windowsHide: true }))
  })
})
