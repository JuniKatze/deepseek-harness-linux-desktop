/**
 * 固定发布版社区源码校验：只读 index 和工作树，不依赖 tag 对象、网络或构建产物。
 * 更新基线必须显式选择发布版本，同时更新树哈希和 EOF 例外；不跟随分支。
 * whitespace 仍由原始 git diff --cached --check 判定；仅在五树和特定 blob 均精确
 * 一致时，将上游已有的单个 EOF 空行诊断纠正为接受，其他诊断及 Git 失败均保留。
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/** 固定发布版的完整 Git 树及唯一允许的上游 EOF 空行；不接受 CLI 或环境覆盖。 */
export const COMMUNITY_UPSTREAM = {
  release: 'dsh-v0.2.2-rc.3',
  trees: {
    packages: '9bd05dac849733c1a5538a0af14f3dad99c1e0f9',
    vendor: '721abc98e443b0d2cff281cd0e900bac05b3bcd4',
    'apps/cli': 'd0ff23c88f4f18b3e5102921bdff74f5fc99cb3d',
    'apps/desktop-host': '41cea339d960cb3b285f186e54507579d1b1b1e6',
    'apps/web': '957d36696ae6cc69f1f4a7ff69228b9825f99b3a',
  },
  eof: {
    path: 'packages/experimental/deepseek-chat-import/src/client/mount.ts',
    blob: '99e8a44407707c73ed8d9bbdfbefbb808cc895e8',
    line: 65,
  },
} as const

type TreeHashes = Readonly<Record<keyof typeof COMMUNITY_UPSTREAM.trees, string>>

interface Entry {
  path: string
  mode: string
  oid: string
}

function git(root: string, args: string[]): Buffer {
  const result = spawnSync('git', ['-C', root, ...args], { maxBuffer: 64 * 1024 * 1024 })
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} 失败（${String(result.status)}）：${result.stderr.toString('utf8').trim()}`)
  }
  return result.stdout
}

function objectId(kind: 'blob' | 'tree', bytes: Buffer): string {
  return createHash('sha1').update(`${kind} ${bytes.length}\0`).update(bytes).digest('hex')
}

/** 按 Git 的目录排序和对象编码计算树，不写入 index 或 object database。 */
function treeId(entries: Entry[]): string {
  const children = new Map<string, Entry[]>()
  const files: Entry[] = []
  for (const entry of entries) {
    const slash = entry.path.indexOf('/')
    if (slash < 0) { files.push(entry); continue }
    const directory = entry.path.slice(0, slash)
    const child = { ...entry, path: entry.path.slice(slash + 1) }
    const group = children.get(directory)
    if (group === undefined) children.set(directory, [child])
    else group.push(child)
  }
  for (const [path, group] of children) files.push({ path, mode: '40000', oid: treeId(group) })
  const sortKey = (entry: Entry): Buffer => Buffer.from(entry.path + (entry.mode === '40000' ? '/' : '\0'))
  files.sort((left, right) => Buffer.compare(sortKey(left), sortKey(right)))
  return objectId('tree', Buffer.concat(files.map(entry => Buffer.concat([
    Buffer.from(`${entry.mode} ${entry.path}\0`), Buffer.from(entry.oid, 'hex'),
  ]))))
}

function indexEntries(root: string, paths: string[]): Entry[] {
  return git(root, ['ls-files', '--stage', '-z', '--', ...paths]).toString('utf8').split('\0').filter(Boolean).map((record) => {
    const match = /^(100644|100755|120000) ([0-9a-f]{40}) 0\t([\s\S]+)$/.exec(record)
    const mode = match?.[1]
    const oid = match?.[2]
    const path = match?.[3]
    if (mode === undefined || oid === undefined || path === undefined) {
      throw new Error(`受保护 index 项未合并、模式不支持或格式无效：${JSON.stringify(record)}`)
    }
    return { mode, oid, path }
  })
}

function worktreeEntries(root: string, entries: Entry[]): Entry[] {
  const directories = new Set<string>()
  return entries.map((entry) => {
    for (let parent = dirname(entry.path); parent !== '.'; parent = dirname(parent)) {
      if (directories.has(parent)) break
      if (!lstatSync(join(root, parent)).isDirectory()) throw new Error(`工作树父路径不是实际目录：${parent}`)
      directories.add(parent)
    }
    const file = join(root, entry.path)
    const stat = lstatSync(file)
    if (stat.isSymbolicLink()) return { ...entry, mode: '120000', oid: objectId('blob', readlinkSync(file, { encoding: 'buffer' })) }
    if (!stat.isFile()) throw new Error(`工作树受保护路径不是文件或符号链接：${entry.path}`)
    // Windows 不提供 POSIX executable bit；文件类型和原字节仍独立校验，模式由 index 校验。
    const mode = process.platform === 'win32' && entry.mode !== '120000'
      ? entry.mode : (stat.mode & 0o111) === 0 ? '100644' : '100755'
    return { ...entry, mode, oid: objectId('blob', readFileSync(file)) }
  })
}

/**
 * 校验固定五棵树的 staged 对象、未过滤工作树字节和所有新增未忽略路径，再执行原始 whitespace 检查。
 * @param root - 要校验的仓库根目录；尊重 Git 为当前提交选择的 index。
 * @param expectedTrees - 五棵树的期望哈希，默认固定发布版；隔离测试可注入小型 fixture 的树，不改变 EOF 例外。
 * @returns 0 表示全部通过或仅存在精确上游 EOF 误报，1 表示源码偏移，2 表示 whitespace 或读取失败；均不修改仓库。
 */
export function verifyCommunityUpstream(root: string, expectedTrees: TreeHashes = COMMUNITY_UPSTREAM.trees): number {
  try {
    const paths = Object.keys(COMMUNITY_UPSTREAM.trees) as (keyof TreeHashes)[]
    const staged = indexEntries(root, paths)
    const working = worktreeEntries(root, staged)
    const problems: string[] = []
    for (const path of paths) {
      for (const [plane, entries] of [['index', staged], ['worktree', working]] as const) {
        const scoped = entries.filter(entry => entry.path.startsWith(`${path}/`)).map(entry => ({ ...entry, path: entry.path.slice(path.length + 1) }))
        const actual = treeId(scoped)
        if (actual !== expectedTrees[path]) {
          problems.push(`${plane} ${path}：期望 ${expectedTrees[path]}，实际 ${actual}`)
        }
      }
    }
    const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '-z', '--', ...paths]).toString('utf8').split('\0').filter(Boolean)
    for (const path of untracked) problems.push(`worktree 新增未跟踪文件：${JSON.stringify(path)}`)
    if (problems.length !== 0) {
      console.error(`community-upstream：必须恢复 ${COMMUNITY_UPSTREAM.release} 的完整上游字节：\n${problems.join('\n')}`)
      return 1
    }
    console.log(`community-upstream：${COMMUNITY_UPSTREAM.release} 五棵树 index/worktree 哈希一致。`)
    const check = spawnSync('git', ['-C', root, '-c', 'color.ui=false', 'diff', '--cached', '--check', '--no-ext-diff', '--no-textconv'], {
      encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' }, maxBuffer: 64 * 1024 * 1024,
    })
    if (check.error !== undefined) throw check.error
    const { eof } = COMMUNITY_UPSTREAM
    const exactDiagnostic = `${eof.path}:${eof.line}: new blank line at EOF.\n`
    if (check.status === 2 && check.stdout === exactDiagnostic && check.stderr === ''
      && staged.some(entry => entry.path === eof.path && entry.oid === eof.blob && entry.mode === '100644')
      && working.some(entry => entry.path === eof.path && entry.oid === eof.blob && entry.mode === '100644')) {
      console.log(`community-upstream：仅接受固定上游 EOF 空行 ${eof.path}:${eof.line}（blob ${eof.blob}）；原始 git diff --cached --check 已执行，其他诊断不豁免。`)
      return 0
    }
    if (check.stdout !== '') process.stdout.write(check.stdout)
    if (check.stderr !== '') process.stderr.write(check.stderr)
    if (check.status !== 0) {
      console.error(`community-upstream：git diff --cached --check 未通过（${String(check.status)}）；不接受其他 whitespace 诊断或执行失败。`)
      return 2
    }
    return 0
  } catch (error) {
    console.error(`community-upstream：校验失败，停止接受 EOF 例外：${error instanceof Error ? error.message : String(error)}`)
    return 2
  }
}

if (import.meta.main) {
  if (process.argv.length !== 2) {
    console.error('用法：node scripts/verify-community-upstream.ts；不接受基线覆盖参数。')
    process.exitCode = 2
  } else {
    process.exitCode = verifyCommunityUpstream(resolve(import.meta.dirname, '..'))
  }
}
