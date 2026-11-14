/** 隔离 Git fixture 的进程入口：仅测试可注入小树哈希，发布版 CLI 不提供覆盖入口。 */

import { verifyCommunityUpstream } from '../../../verify-community-upstream.ts'

const root = process.argv[2]
const serialized = process.argv[3]
if (root === undefined || serialized === undefined) throw new Error('缺少 fixture 根目录或树哈希')
const trees: NonNullable<Parameters<typeof verifyCommunityUpstream>[1]> = JSON.parse(serialized)
process.exitCode = verifyCommunityUpstream(root, trees)
