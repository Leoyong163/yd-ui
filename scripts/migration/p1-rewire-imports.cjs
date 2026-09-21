#!/usr/bin/env node
/**
 * p1-rewire-imports.cjs —— 把宿主的组件引用从本地路径改到库（P1-T7 / P2 批次 1-3）。
 *
 * 为什么不手工改：
 *   12 个组件在 13 个文件里有 22 处引用，路径有三种形态（`./`、`../`、`../../`）。
 *   逐处手改既费时又容易漏，而漏掉的那一处会在运行时才炸（组件解析失败）。
 *
 * 改写规则（只认「默认导入 + 组件路径」这一种形态，其它形态原样不动并报警）：
 *   import X    from '../components/X.vue'    →  import { X } from '@yd/ui'
 *   import X    from './components/X.vue'     →  import { X } from '@yd/ui'
 *   import Y    from '../../components/X.vue' →  import { X as Y } from '@yd/ui'
 *
 * 用法：
 *   node scripts/p1-rewire-imports.cjs --dry     # 只打印将要发生的改写
 *   node scripts/p1-rewire-imports.cjs           # 写入
 */

const fs = require('fs')
const path = require('path')

const DRY = process.argv.includes('--dry')
const ROOT = arg('root', 'src')
const COMPONENTS = [
  'Icon',
  'IconTile',
  'SearchBox',
  'EmptyState',
  'Modal',
  'StatusTag',
  'UrgencyTag',
  'KpiImg',
  'Pagination',
  'OverflowTooltip',
  'PermissionTree',
  'PermissionTreeRows',
]
const RE = /import\s+(\w+)\s+from\s+'(?:\.\.?\/)+components\/(\w+)\.vue'(;?)/g

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(vue|ts)$/.test(e.name)) out.push(p)
  }
  return out
}

const files = walk(ROOT)
const log = []
const leftover = []
let changed = 0
let sites = 0

for (const f of files) {
  const before = fs.readFileSync(f, 'utf8')
  let hit = 0
  const after = before.replace(RE, (m, local, name, semi) => {
    if (!COMPONENTS.includes(name)) {
      leftover.push(`${f}: 不认识的组件 ${name}（未改写）`)
      return m
    }
    hit += 1
    const spec = local === name ? `{ ${name} }` : `{ ${name} as ${local} }`
    return `import ${spec} from '@yd/ui'${semi}`
  })
  if (hit) {
    sites += hit
    changed += 1
    log.push(`${f}  x${hit}`)
    if (!DRY) fs.writeFileSync(f, after, 'utf8')
  }
  // 复查：改写后不应再有任何指向 components/*.vue 的引用
  // （注意 dry-run 也要查 `after`——查 `before` 会把「即将被改掉的」误报成残留）
  const rest = after.match(/(?:\.\.?\/)+components\/\w+\.vue/g)
  if (rest) for (const r of rest) leftover.push(`${f}: 残留 ${r}`)
}

console.log(`${DRY ? '[dry-run] ' : ''}改写文件 ${changed} 个 / 引用点 ${sites} 处`)
for (const l of log) console.log('  ' + l)
if (leftover.length) {
  console.log('需人工确认：')
  for (const l of leftover) console.log('  ! ' + l)
}
process.exit(leftover.length ? 1 : 0)
