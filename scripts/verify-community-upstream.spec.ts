import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { load } from 'js-yaml'
import { COMMUNITY_UPSTREAM } from './verify-community-upstream.ts'
import { removeFixtureSafely } from './test-fixture-cleanup.ts'

const repository = resolve(import.meta.dirname, '..')
const checker = join(import.meta.dirname, 'tests/fixtures/community-upstream/check.ts')
const roots: string[] = []
const children = new Set<{ child: ReturnType<typeof spawn>; exited: Promise<void> }>()
const { eof } = COMMUNITY_UPSTREAM
const scopes = Object.keys(COMMUNITY_UPSTREAM.trees) as (keyof typeof COMMUNITY_UPSTREAM.trees)[]

interface Fixture {
  root: string
  env: NodeJS.ProcessEnv
  trees: Record<keyof typeof COMMUNITY_UPSTREAM.trees, string>
  files: Map<string, Buffer>
}

interface Result {
  status: number | null
  stdout: string
  stderr: string
}

afterEach(async () => {
  for (const { child } of children) if (child.exitCode === null && child.signalCode === null) child.kill()
  await Promise.all([...children].map(item => item.exited))
  children.clear()
  for (const root of roots.splice(0)) removeFixtureSafely(root)
})

function command(fixture: Fixture, executable: string, args: string[], input?: Buffer | string): Result {
  const result = spawnSync(executable, args, { cwd: fixture.root, env: fixture.env, encoding: 'utf8', input, timeout: 60_000 })
  expect(result.error, `${executable} ${args.join(' ')}`).toBeUndefined()
  expect(result.signal).toBeNull()
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

function git(fixture: Fixture, args: string[], input?: Buffer | string): string {
  const result = command(fixture, 'git', args, input)
  expect(result.status, result.stderr).toBe(0)
  return result.stdout.trim()
}

function write(fixture: Fixture, path: string, bytes: Buffer | string): void {
  mkdirSync(dirname(join(fixture.root, path)), { recursive: true })
  writeFileSync(join(fixture.root, path), bytes)
}

function stage(fixture: Fixture, path: string, bytes: Buffer | string, mode = '100644'): string {
  const oid = git(fixture, ['hash-object', '-w', '--stdin'], bytes)
  git(fixture, ['update-index', '--add', '--cacheinfo', mode, oid, path])
  return oid
}

// fixture 只写自身的 Git 对象和 ref，不调用 git add/commit/checkout 或任何仓库 hook。
function setHead(fixture: Fixture): string {
  const tree = git(fixture, ['write-tree'])
  const commit = git(fixture, ['hash-object', '-t', 'commit', '-w', '--stdin'],
    `tree ${tree}\nauthor Fixture <fixture@example.test> 1 +0000\ncommitter Fixture <fixture@example.test> 1 +0000\n\nfixture\n`)
  git(fixture, ['update-ref', 'refs/heads/fixture', commit])
  return commit
}

function fixture(restoreEof = true): Fixture {
  const container = mkdtempSync(join(tmpdir(), 'dsh-community-upstream-'))
  roots.push(container)
  const root = join(container, 'repository')
  mkdirSync(root)
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')))
  env.GIT_CONFIG_NOSYSTEM = '1'
  env.GIT_CONFIG_GLOBAL = join(container, 'absent.gitconfig')
  env.LC_ALL = 'C'
  const result: Fixture = { root, env, trees: { ...COMMUNITY_UPSTREAM.trees }, files: new Map() }
  git(result, ['init', '--quiet', '--initial-branch=fixture', '--object-format=sha1'])
  git(result, ['config', 'core.autocrlf', 'false'])
  git(result, ['config', 'core.quotePath', 'false'])
  git(result, ['config', 'core.whitespace', 'blank-at-eol,blank-at-eof,space-before-tab'])
  const mount = readFileSync(join(repository, eof.path))
  expect(git(result, ['hash-object', '--stdin'], mount)).toBe(eof.blob)
  const files: Record<string, Buffer | string> = {
    '.gitignore': 'node_modules/\nlib/\n',
    '.gitattributes': '* text=auto eol=lf\n',
    [eof.path]: mount,
    'packages/core/source.ts': 'export const value = 1\n',
    'packages/a.c': 'file before directory\n',
    'packages/a/source.ts': 'nested\n',
    'packages/a0': 'file after directory\n',
    'packages/多字节/source.ts': 'unicode\n',
    'vendor/framework/index.ts': 'export const vendor = true\n',
    'apps/cli/src/index.ts': 'export const cli = true\n',
    'apps/desktop-host/src/index.ts': 'export const desktop = true\n',
    'apps/web/src/index.ts': 'export const web = true\n',
  }
  for (const [path, bytes] of Object.entries(files)) {
    write(result, path, bytes)
    stage(result, path, bytes)
    result.files.set(path, Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes))
  }
  const tree = git(result, ['write-tree'])
  for (const scope of scopes) result.trees[scope] = git(result, ['rev-parse', `${tree}:${scope}`])
  if (restoreEof) stage(result, eof.path, mount.subarray(0, -1))
  setHead(result)
  if (restoreEof) stage(result, eof.path, mount)
  return result
}

function check(fixture: Fixture): Result {
  return command(fixture, process.execPath, [checker, fixture.root, JSON.stringify(fixture.trees)])
}

function expectRejected(result: Result, diagnostic: string): void {
  expect(result.status).not.toBe(0)
  expect(result.stdout + result.stderr).toContain(diagnostic)
  expect(result.stdout).not.toContain('仅接受固定上游 EOF 空行')
}

function parallelCheck(fixture: Fixture): Promise<Result> {
  const child = spawn(process.execPath, [checker, fixture.root, JSON.stringify(fixture.trees)], { cwd: fixture.root, env: fixture.env })
  const exited = new Promise<void>(resolveExit => child.once('close', () => resolveExit()))
  children.add({ child, exited })
  return new Promise((resolveResult, reject) => {
    let stdout = ''
    let stderr = ''
    child.stdout!.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk })
    child.stderr!.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk })
    child.once('error', reject)
    child.once('close', (status, signal) => {
      if (signal !== null) reject(new Error(`fixture 子进程收到 ${signal}`))
      else resolveResult({ status, stdout, stderr })
    })
  })
}

describe('固定发布版社区源码与 whitespace 校验', () => {
  it('保留五棵完整树、发布标签和唯一 EOF blob 的发布基线', () => {
    expect(COMMUNITY_UPSTREAM).toEqual({
      release: 'dsh-v0.2.2-rc.3',
      trees: { packages: '9bd05dac849733c1a5538a0af14f3dad99c1e0f9', vendor: '721abc98e443b0d2cff281cd0e900bac05b3bcd4', 'apps/cli': 'd0ff23c88f4f18b3e5102921bdff74f5fc99cb3d', 'apps/desktop-host': '41cea339d960cb3b285f186e54507579d1b1b1e6', 'apps/web': '957d36696ae6cc69f1f4a7ff69228b9825f99b3a' },
      eof: { path: 'packages/experimental/deepseek-chat-import/src/client/mount.ts', blob: '99e8a44407707c73ed8d9bbdfbefbb808cc895e8', line: 65 },
    })
  })

  it('公开命令、hygiene 与提交/推送 hooks 共用无条件的固定基线入口', () => {
    const config = readFileSync(join(repository, 'lefthook.yml'), 'utf8')
    expect(load(config)).toMatchObject({
      'pre-commit': { jobs: expect.arrayContaining([{ name: 'whitespace (staged)', run: 'node scripts/verify-community-upstream.ts' }]) },
    })
    const manifest: { scripts: Record<string, string> } = JSON.parse(readFileSync(join(repository, 'package.json'), 'utf8'))
    expect(manifest.scripts['verify-community-upstream']).toBe('node scripts/verify-community-upstream.ts')
    expect(manifest.scripts.hygiene).toBe('node scripts/verify-community-upstream.ts && tsx scripts/run-gates.ts hygiene')
    expect(load(config)).toMatchObject({
      'pre-push': { jobs: [
        { name: 'community upstream', run: 'node scripts/verify-community-upstream.ts' },
        { name: 'typecheck', run: 'pnpm run typecheck' },
      ] },
    })
    const attributes = readFileSync(join(repository, '.gitattributes'), 'utf8')
    expect(attributes).not.toContain('-blank-at-eof')
  })

  it('发布版 CLI 在常规 unit lane 校验当前仓库的实际五树', () => {
    const result = spawnSync(process.execPath, [join(repository, 'scripts/verify-community-upstream.ts')], {
      cwd: repository, encoding: 'utf8', timeout: 60_000,
    })
    expect(result.error).toBeUndefined()
    expect(result.signal).toBeNull()
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toContain('五棵树 index/worktree 哈希一致')
  })

  it('接受无新增 whitespace 的相同树，且不修改 index 或文件', () => {
    const f = fixture(false)
    const index = readFileSync(join(f.root, '.git/index'))
    expect(check(f).status).toBe(0)
    expect(readFileSync(join(f.root, '.git/index'))).toEqual(index)
    for (const [path, bytes] of f.files) expect(readFileSync(join(f.root, path))).toEqual(bytes)
  })

  it('浅克隆无 tag 对象时只接受原始检查的唯一已知 EOF 误报', () => {
    const f = fixture()
    write(f, '.git/shallow', `${git(f, ['rev-parse', 'HEAD'])}\n`)
    expect(git(f, ['rev-parse', '--is-shallow-repository'])).toBe('true')
    expect(git(f, ['tag', '--list'])).toBe('')
    const raw = command(f, 'git', ['diff', '--cached', '--check'])
    expect(raw.status).toBe(2)
    expect(raw.stdout).toBe(`${eof.path}:65: new blank line at EOF.\n`)
    const guarded = check(f)
    expect(guarded.status, guarded.stderr).toBe(0)
    expect(guarded.stdout).toContain(`仅接受固定上游 EOF 空行 ${eof.path}:65`)
  })

  it('允许保护目录之外的普通开发变更，不缩小五树校验', () => {
    const f = fixture()
    for (const path of ['apps/desktop/src/asar-fs.ts', 'packages-extra/source.ts', 'scripts/change.ts']) {
      write(f, path, 'export const local = true\n')
      stage(f, path, 'export const local = true\n')
    }
    expect(check(f).status).toBe(0)
  })

  it.each(scopes)('%s 拒绝 staged 内容偏移，即使工作树已恢复上游', (scope) => {
    const f = fixture()
    const path = [...f.files.keys()].find(path => path.startsWith(`${scope}/`))!
    stage(f, path, 'different\n')
    expectRejected(check(f), `index ${scope}`)
  })

  it.each(scopes)('%s 拒绝仅工作树偏移，即使 index 完全相同', (scope) => {
    const f = fixture()
    const path = [...f.files.keys()].find(path => path.startsWith(`${scope}/`))!
    write(f, path, 'different\n')
    expectRejected(check(f), `worktree ${scope}`)
  })

  it.each(['packages/new.ts', 'vendor/new.ts', 'apps/cli/new.ts', 'apps/desktop-host/new.ts', 'apps/web/new.ts'])('拒绝新增未跟踪源码 %s', (path) => {
    const f = fixture()
    write(f, path, 'new source\n')
    expectRejected(check(f), '新增未跟踪文件')
  })

  it('忽略未跟踪构建产物，但已暂存的同名新增仍拒绝', () => {
    const f = fixture()
    const path = 'packages/core/lib/generated.js'
    write(f, path, 'artifact\n')
    expect(check(f).status).toBe(0)
    stage(f, path, 'artifact\n')
    expectRejected(check(f), 'index packages')
  })

  it.each(['delete', 'rename', 'mode'])('拒绝 staged %s，不能仅比较文件文本', (operation) => {
    const f = fixture()
    const path = 'packages/core/source.ts'
    const bytes = f.files.get(path)!
    if (operation === 'mode') stage(f, path, bytes, '100755')
    else {
      git(f, ['update-index', '--force-remove', '--', path])
      if (operation === 'rename') {
        const target = 'packages/core/renamed.ts'
        write(f, target, bytes)
        stage(f, target, bytes)
      }
    }
    expectRejected(check(f), 'index packages')
  })

  it.each(['--assume-unchanged', '--skip-worktree'])('不相信 index %s 标记提供的工作树缓存', (flag) => {
    const f = fixture()
    const path = 'packages/core/source.ts'
    git(f, ['update-index', flag, '--', path])
    write(f, path, 'changed without Git noticing\n')
    expect(git(f, ['diff', '--name-only', '--', path])).toBe('')
    expectRejected(check(f), 'worktree packages')
  })

  it('拒绝被 text clean 过滤掩盖的 CRLF 工作树字节', () => {
    const f = fixture()
    const path = 'packages/core/source.ts'
    write(f, path, f.files.get(path)!.toString().replaceAll('\n', '\r\n'))
    expect(git(f, ['diff', '--name-only', '--', path])).toBe('')
    expectRejected(check(f), 'worktree packages')
  })

  it.each(['remove-eof', 'extra-eof', 'trailing-space', 'code-change'])('固定路径 %s 也不获得 EOF 豁免', (change) => {
    const f = fixture()
    const original = f.files.get(eof.path)!
    const bytes = change === 'remove-eof' ? original.subarray(0, -1)
      : change === 'extra-eof' ? Buffer.concat([original, Buffer.from('\n')])
        : change === 'trailing-space' ? Buffer.from(original.toString().replace(' */\n', ' */ \n'))
          : Buffer.from(original.toString().replace('import type', 'import /* changed */ type'))
    write(f, eof.path, bytes)
    stage(f, eof.path, bytes)
    expectRejected(check(f), 'index packages')
  })

  it.each(['new space \n', ' \tnew tab\n', 'new eof\n\n', 'new blank\n \n'])('拒绝另一个文件的新 whitespace %j，保留原始诊断', (bytes) => {
    const f = fixture()
    const path = 'scripts/other.ts'
    write(f, path, bytes)
    stage(f, path, bytes)
    const raw = command(f, 'git', ['diff', '--cached', '--check'])
    expect(raw.status).toBe(2)
    const guarded = check(f)
    expectRejected(guarded, `${path}:`)
    expect(guarded.stdout).toContain(raw.stdout)
  })

  it.each(['blob', 'mode'])('即使五树哈希匹配测试基线，也不能给非固定 %s 接受同文 EOF 诊断', (change) => {
    const f = fixture()
    const original = f.files.get(eof.path)!
    if (change === 'blob') {
      const bytes = Buffer.from(original.toString().replace('Remote contribution', 'Changed contribution'))
      write(f, eof.path, bytes)
      stage(f, eof.path, bytes)
    } else {
      stage(f, eof.path, original, '100755')
      if (process.platform !== 'win32') chmodSync(join(f.root, eof.path), 0o755)
    }
    const tree = git(f, ['write-tree'])
    f.trees.packages = git(f, ['rev-parse', `${tree}:packages`])
    expect(command(f, 'git', ['diff', '--cached', '--check']).stdout).toBe(`${eof.path}:65: new blank line at EOF.\n`)
    expectRejected(check(f), '未通过（2）')
  })

  it('没有上游 EOF 诊断时仍拒绝其他 whitespace', () => {
    const f = fixture(false)
    stage(f, 'scripts/other.ts', 'bad \n')
    expectRejected(check(f), 'scripts/other.ts:1: trailing whitespace')
  })

  it('拒绝未合并 index 项和空语料', () => {
    const f = fixture()
    const path = 'packages/core/source.ts'
    const oid = git(f, ['hash-object', '-w', '--stdin'], 'conflict\n')
    git(f, ['update-index', '--index-info'], `0 ${'0'.repeat(40)}\t${path}\n100644 ${oid} 1\t${path}\n100644 ${oid} 2\t${path}\n`)
    expectRejected(check(f), '未合并')
    git(f, ['read-tree', '--empty'])
    expectRejected(check(f), 'index packages')
  })

  it('拒绝新增 gitlink 模式而非把它当作固定源码', () => {
    const f = fixture()
    git(f, ['update-index', '--add', '--cacheinfo', '160000', git(f, ['rev-parse', 'HEAD']), 'packages/gitlink'])
    expectRejected(check(f), '模式不支持')
  })

  it('直接哈希含 NUL 的二进制原字节，不通过文本解码比较', () => {
    const f = fixture(false)
    const path = 'packages/core/binary.dat'
    const bytes = Buffer.from([0, 255, 13, 10])
    write(f, path, bytes)
    stage(f, path, bytes)
    const tree = git(f, ['write-tree'])
    f.trees.packages = git(f, ['rev-parse', `${tree}:packages`])
    setHead(f)
    expect(check(f).status).toBe(0)
    write(f, path, Buffer.from([0, 254, 13, 10]))
    expectRejected(check(f), 'worktree packages')
  })

  it('拒绝缺失文件与非文件占位，不将读取错误当成匹配', () => {
    const f = fixture()
    const path = join(f.root, 'packages/core/source.ts')
    rmSync(path)
    expectRejected(check(f), '校验失败')
    mkdirSync(path)
    expectRejected(check(f), '不是文件或符号链接')
  })

  it.skipIf(process.platform === 'win32')('拒绝工作树 executable bit 偏移（Windows 无 POSIX bit）', () => {
    const f = fixture()
    chmodSync(join(f.root, 'packages/core/source.ts'), 0o755)
    expectRejected(check(f), 'worktree packages')
  })

  it.skipIf(process.platform === 'win32')('校验符号链接原字节且拒绝父目录链接（Windows 需额外链接权限）', () => {
    const f = fixture(false)
    const path = 'vendor/link'
    symlinkSync('framework/index.ts', join(f.root, path))
    stage(f, path, 'framework/index.ts', '120000')
    const tree = git(f, ['write-tree'])
    f.trees.vendor = git(f, ['rev-parse', `${tree}:vendor`])
    setHead(f)
    expect(check(f).status).toBe(0)
    rmSync(join(f.root, path))
    symlinkSync('elsewhere', join(f.root, path))
    expectRejected(check(f), 'worktree vendor')
    rmSync(join(f.root, path))
    symlinkSync('framework/index.ts', join(f.root, path))
    const parent = join(f.root, 'packages/core')
    renameSync(parent, join(f.root, 'saved-core'))
    symlinkSync(join(f.root, 'saved-core'), parent, 'dir')
    expectRejected(check(f), '父路径不是实际目录')
  })

  it('已知 EOF 诊断若伴随 Git 警告也拒绝，不吞掉 stderr', () => {
    const f = fixture()
    write(f, '.gitattributes', '* text=auto eol=lf\n* invalid?attribute\n')
    const raw = command(f, 'git', ['diff', '--cached', '--check'])
    expect(raw.stdout).toBe(`${eof.path}:65: new blank line at EOF.\n`)
    expect(raw.stderr).toContain('not a valid attribute name')
    const guarded = check(f)
    expectRejected(guarded, '未通过（2）')
    expect(guarded.stderr).toContain(raw.stderr)
  })

  it('Git 的 check 执行错误不匹配已知 EOF 例外', () => {
    const f = fixture()
    git(f, ['config', 'diff.algorithm', 'not-a-diff-algorithm'])
    const raw = command(f, 'git', ['diff', '--cached', '--check'])
    expect(raw.status, JSON.stringify(raw)).toBe(128)
    expectRejected(check(f), '未通过（128）')
  })

  it('尊重 Git 为当前操作选择的 alternate index，不写回任何 index', () => {
    const f = fixture()
    const alternate = join(f.root, '.git/alternate-index')
    copyFileSync(join(f.root, '.git/index'), alternate)
    stage(f, 'packages/core/source.ts', 'wrong staged contents\n')
    expectRejected(check(f), 'index packages')
    f.env.GIT_INDEX_FILE = alternate
    const before = readFileSync(alternate)
    expect(check(f).status).toBe(0)
    expect(readFileSync(alternate)).toEqual(before)
  })

  it('发布版 CLI 拒绝覆盖版本参数，不提供降低基线的入口', () => {
    const f = fixture()
    const result = command(f, process.execPath, [join(repository, 'scripts/verify-community-upstream.ts'), '--ref', 'HEAD'])
    expectRejected(result, '不接受基线覆盖参数')
  })

  it('两个独立进程的 fixture 可同时校验并各自完成退出', async () => {
    const first = fixture()
    const second = fixture(false)
    expect(first.root).not.toBe(second.root)
    const results = await Promise.all([parallelCheck(first), parallelCheck(second)])
    for (const result of results) expect(result.status, result.stderr).toBe(0)
    for (const { child, exited } of children) { await exited; expect(child.exitCode).toBe(0) }
    expect(lstatSync(first.root).isDirectory()).toBe(true)
  })
})
