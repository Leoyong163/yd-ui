#!/usr/bin/env node
/**
 * P2 · 把库的 `src/` 拆成两层：`core/`（零框架）与 `vue/`（Vue 层）。
 *
 *   node scripts/p2-split-layers.mjs           # 执行
 *   node scripts/p2-split-layers.mjs --dry     # 只打印计划
 *   node scripts/p2-split-layers.mjs --force   # 已分层时也重写入口文件
 *
 * 为什么要这一步：库的视觉本来就与 Vue 无关（组件不带 <style>，所有外观都在
 * `styles/*.css` 的类名配方里），但目录结构把这个事实藏住了 —— `components/*.vue`
 * 与 `foundation/*.ts` 平铺在同一层，看不出「哪些代码能脱离 Vue 使用」。
 * 拆完之后，「能不能不用 Vue」变成一个看目录就能回答的问题。
 *
 * 分层判据（详见《组件库分层与解耦规范.md》§2）：
 *   core/  去掉 Vue 之后依然成立的东西 —— CSS 三层、图标、素材、纯映射表、令牌真源
 *   vue/   没有响应式状态 / 生命周期就不成立的东西 —— 12 个 SFC
 *
 * 本脚本只做「搬 + 改 import + 重写入口」，不动任何一行逻辑。
 * 门禁是宿主 `vite build` 退出码 0 且基线 `DIFF_TOTAL = 0`。
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  existsSync,
  rmSync,
  readdirSync,
  statSync,
} from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const SRC = join(root, 'src')
const DRY = process.argv.includes('--dry')
const FORCE = process.argv.includes('--force')

const lines = []
const say = (s) => {
  lines.push(s)
  console.log(s)
}

/* ---------- 搬运计划 ---------- */
/** [src 内相对路径, 目标相对路径]，目录整搬 */
const MOVES = [
  ['styles', 'core/styles'],
  ['theme/tokens.ts', 'core/theme/tokens.ts'],
  ['foundation/icons.ts', 'core/icons/icons.ts'],
  ['foundation/assets', 'core/assets'],
  ['foundation/tag-class.ts', 'core/contract/tag-class.ts'],
  ['foundation/tree.ts', 'core/contract/tree.ts'],
  ['foundation/kpi-assets.ts', 'core/contract/kpi-assets.ts'],
  ['components', 'vue/components'],
]

/** 被搬文件内部的相对 import 改写（逐条精确替换，不做模糊匹配） */
const IMPORT_REWRITES = [
  { file: 'core/contract/kpi-assets.ts', from: "'./assets/", to: "'../assets/" },
  { file: 'vue/components/Icon.vue', from: "'../foundation/icons'", to: "'../../core/icons/icons'" },
  { file: 'vue/components/StatusTag.vue', from: "'../foundation/tag-class'", to: "'../../core/contract/tag-class'" },
  { file: 'vue/components/UrgencyTag.vue', from: "'../foundation/tag-class'", to: "'../../core/contract/tag-class'" },
  { file: 'vue/components/KpiImg.vue', from: "'../foundation/kpi-assets'", to: "'../../core/contract/kpi-assets'" },
  { file: 'vue/components/PermissionTree.vue', from: "'../foundation/tree'", to: "'../../core/contract/tree'" },
  { file: 'vue/components/PermissionTreeRows.vue', from: "'../foundation/tree'", to: "'../../core/contract/tree'" },
]

/* ---------- 新入口文件的内容 ---------- */
const CORE_INDEX = `/**
 * @yd/ui/core —— **零框架层**（Tier 0）
 *
 * 判据：把 Vue 整个拿掉，这里的东西依然成立。
 *
 *   styles/    三层 CSS：tokens → base → components（控件配方）
 *   icons/     图标 SVG 字符串表（不依赖图标字体，可整表被 AI 读取）
 *   assets/    静态素材（KPI 配图等）
 *   contract/  纯映射表与纯函数：状态词→类名、树遍历、资产键
 *   theme/     设计令牌唯一真源（CSS 产物为 styles/tokens.css）
 *
 * 消费者：
 *   · 原生 HTML / 静态单文件 —— 引 \`dist-lite/yd-ui.css\` + 用类名契约拼结构
 *   · Vue 应用            —— import { ... } from '@yd/ui'
 *   · 任何其它框架        —— 只引 CSS 与这里导出的纯数据
 *
 * 硬约束（违反即门禁失败，见 scripts/check-layering.cjs）：
 *   C1 本目录不得出现 \`from 'vue'\` / \`from 'ant-design-vue'\` / \`*.vue\` 导入
 *   C2 本目录不得出现 .vue 文件
 *   C3 本目录不得反向 import 宿主（宿主路径一律不许出现）
 *
 * 注意：本入口的 TS 形态仍需打包器解析 \`import x from './x.png'\` 这类资源导入。
 * 需要「零构建直接用」的场景请走 \`dist-lite/\`（产物，见 scripts/build-lite.mjs）。
 */

/* ---------- 图标 ---------- */
export { icons, shortcutPalette, shortcutIcon, tones } from './icons/icons'

/* ---------- 契约：状态词 → 类名 ---------- */
export {
  STATUS_TAG_CLASS,
  URGENCY_TAG_CLASS,
  TAG_FALLBACK_CLASS,
  statusTagClass,
  urgencyTagClass,
} from './contract/tag-class'

/* ---------- 契约：树 ---------- */
export { countTreeNodes, branchIds, findTreeNode } from './contract/tree'
export type { TreeNode } from './contract/tree'

/* ---------- 契约：资产键 ---------- */
export { KPI_ASSETS } from './contract/kpi-assets'
export type { KpiKey } from './contract/kpi-assets'

/* ---------- 令牌真源 ---------- */
export { lightTokens, darkTokens } from './theme/tokens'
`

const VUE_INDEX = `/**
 * @yd/ui/vue —— **Vue 层**（Tier 1）
 *
 * 判据：没有响应式状态 / 生命周期 / 插槽就不成立的东西。放这里的只有 12 个 SFC。
 *
 * 两条硬约束：
 *   V1 组件不得带 <style> 块 —— 外观一律来自 core/styles 的类名配方。
 *      这条是两层能解耦的根本原因：组件的视觉不写在组件里。
 *   V2 组件不得反向 import 宿主（禁止越出库目录的相对路径）。
 *
 * 因此「组件」与「原生 HTML」用的是同一套类名、同一份 CSS ——
 * 不存在「Vue 版长这样、HTML 版长那样」的漂移空间。
 */
export { default as Icon } from './components/Icon.vue'
export { default as IconTile } from './components/IconTile.vue'
export { default as SearchBox } from './components/SearchBox.vue'
export { default as EmptyState } from './components/EmptyState.vue'
export { default as Modal } from './components/Modal.vue'
export { default as StatusTag } from './components/StatusTag.vue'
export { default as UrgencyTag } from './components/UrgencyTag.vue'
export { default as KpiImg } from './components/KpiImg.vue'
export { default as Pagination } from './components/Pagination.vue'
export { default as OverflowTooltip } from './components/OverflowTooltip.vue'
export { default as PermissionTree } from './components/PermissionTree.vue'
export { default as PermissionTreeRows } from './components/PermissionTreeRows.vue'
`

const ROOT_INDEX = `/**
 * @yd/ui —— 韵达权限自助门户 · 系统组件库（聚合入口）
 *
 * 这个库分两层，**依赖方向是单向的**：vue → core，core 不认识 vue。
 *
 *   core/  Tier 0 · 零框架层     CSS 三层 + 图标 + 素材 + 纯映射表 + 令牌
 *                                → 原生 HTML / 静态单文件 / 任何框架都能用
 *   vue/   Tier 1 · Vue 层       12 个 SFC，只做结构与行为，外观全部来自 core 的类名
 *
 * 详细规范见《组件库分层与解耦规范.md》；类名契约见 schema/class-contract.json。
 *
 * 用法 A（Vue 应用）—— 组件 + 样式
 *   import { Modal, StatusTag } from '@yd/ui'
 *   @import '@yd/ui/core/styles/tokens.css';
 *   @import '@yd/ui/core/styles/base.css';
 *   @import '@yd/ui/core/styles/components.css';
 *
 * 用法 B（原生 HTML）—— 只用类名，不引 Vue
 *   <link rel="stylesheet" href="…/dist-lite/yd-ui.css">
 *   <button class="btn btn-primary">提交</button>
 *   <span class="tag tag-pending">待审批</span>
 *
 * 只想要零框架那一层时，请直接引 \`@yd/ui/core\`，不要走这个聚合入口 ——
 * 聚合入口会连带把 12 个组件拉进依赖图。
 *
 * 三条禁令（规划 §3.3）：
 *   R1 库不得 import 宿主任何模块（禁止反向依赖）
 *   R2 组件不得带 <style>，样式一律进 core/styles 的对应层
 *   R3 库不得写死任何业务规则（如到期风险阈值），业务规则留宿主
 */

export * from './core'
export * from './vue'
`

/* ---------- 执行 ---------- */

if (!existsSync(SRC)) {
  console.error(`[p2] 找不到 ${SRC}`)
  process.exit(1)
}

const alreadySplit = existsSync(join(SRC, 'core')) && existsSync(join(SRC, 'vue', 'components'))
const legacyPresent = existsSync(join(SRC, 'components')) || existsSync(join(SRC, 'foundation'))

if (alreadySplit && !legacyPresent && !FORCE) {
  say('[p2] 已是分层结构（src/core + src/vue），跳过搬运。加 --force 可重写入口文件。')
} else {
  for (const [from, to] of MOVES) {
    const src = join(SRC, from)
    const dst = join(SRC, to)
    if (!existsSync(src)) {
      say(`[p2] 跳过（源不存在）：${from}`)
      continue
    }
    const isDir = statSync(src).isDirectory()
    say(`[p2] ${isDir ? 'DIR ' : 'FILE'}  ${from.padEnd(28)} -> ${to}`)
    if (DRY) continue
    mkdirSync(dirname(dst), { recursive: true })
    // 目标已存在时先清掉，避免 renameSync 变成「移到子目录里」
    if (existsSync(dst)) rmSync(dst, { recursive: true, force: true })
    renameSync(src, dst)
  }

  if (DRY) {
    say('[p2] --dry 模式，未改动任何文件。')
    process.exit(0)
  }

  // foundation/ 搬空后删掉，避免留下空目录让人以为那里还有东西
  const foundation = join(SRC, 'foundation')
  if (existsSync(foundation) && readdirSync(foundation).length === 0) {
    rmSync(foundation, { recursive: true })
    say('[p2] 清理空目录 foundation/')
  }

  let hit = 0
  for (const r of IMPORT_REWRITES) {
    const p = join(SRC, r.file)
    if (!existsSync(p)) {
      say(`[p2] 改写跳过（文件不存在）：${r.file}`)
      continue
    }
    const before = readFileSync(p, 'utf8')
    const after = before.split(r.from).join(r.to)
    if (before === after) {
      say(`[p2] 改写无命中：${r.file}  ${r.from}`)
      continue
    }
    writeFileSync(p, after, 'utf8')
    hit += 1
  }
  say(`[p2] 内部 import 改写命中：${hit} 处`)
}

if (!DRY) {
  mkdirSync(join(SRC, 'core'), { recursive: true })
  writeFileSync(join(SRC, 'core', 'index.ts'), CORE_INDEX, 'utf8')
  writeFileSync(join(SRC, 'vue', 'index.ts'), VUE_INDEX, 'utf8')
  writeFileSync(join(SRC, 'index.ts'), ROOT_INDEX, 'utf8')
  say('[p2] 已写入 src/core/index.ts · src/vue/index.ts · src/index.ts')

  // 残留自检：搬完之后 src 下不该再出现旧路径
  const leftovers = []
  for (const bad of ['components', 'foundation', 'styles', 'theme/tokens.ts']) {
    if (existsSync(join(SRC, bad))) leftovers.push(bad)
  }
  say(leftovers.length ? `[p2] ⚠ 仍有旧路径残留：${leftovers.join(', ')}` : '[p2] 旧路径已清空')
}
