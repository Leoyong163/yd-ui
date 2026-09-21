#!/usr/bin/env node
/**
 * 修正库内组件的内部依赖路径（P2 组件搬迁的附带动作）。
 *
 * 组件从宿主 `src/components/` 搬到库 `src/components/` 后，它们原先指向
 * `../shared`（宿主业务模块）和 `../icons` 的 import 必须改指库内的 foundation 层，
 * 否则库会反向依赖宿主 —— 那正是《组件库建设详细规划》R1 禁止的事。
 *
 * 用法：node scripts/fix-lib-imports.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const lib = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(lib, 'src', 'components')

/** 每个文件里要做的字符串替换（精确、按文件白名单，不做通配） */
const PLAN = {
  'Icon.vue': [["from '../icons'", "from '../foundation/icons'"]],
  'StatusTag.vue': [["from '../shared'", "from '../foundation/tag-class'"]],
  'UrgencyTag.vue': [["from '../shared'", "from '../foundation/tag-class'"]],
  'KpiImg.vue': [["from '../shared'", "from '../foundation/kpi-assets'"]],
  'PermissionTree.vue': [["from '../shared'", "from '../foundation/tree'"]],
  'PermissionTreeRows.vue': [["from '../shared'", "from '../foundation/tree'"]],
}

const log = []
for (const [file, pairs] of Object.entries(PLAN)) {
  const p = join(dir, file)
  let text = readFileSync(p, 'utf8')
  for (const [from, to] of pairs) {
    const n = text.split(from).length - 1
    if (n === 0) {
      log.push(`MISS  ${file}  ${from}`)
      continue
    }
    text = text.split(from).join(to)
    log.push(`OK    ${file}  ${from}  x${n}  ->  ${to}`)
  }
  writeFileSync(p, text, 'utf8')
}

// 复核：库内不得再出现指向宿主业务模块的相对 import
let residual = 0
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.vue')) continue
  const t = readFileSync(join(dir, f), 'utf8')
  for (const bad of ["from '../shared'", "from '../icons'", "from '../theme/"]) {
    if (t.includes(bad)) {
      log.push(`RESIDUAL  ${f}  ${bad}`)
      residual += 1
    }
  }
}
log.push(`residual=${residual}`)
console.log(log.join('\n'))
process.exit(residual === 0 ? 0 : 1)
