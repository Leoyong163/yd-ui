/**
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
 *   · 原生 HTML / 静态单文件 —— 引 `dist-lite/yd-ui.css` + 用类名契约拼结构
 *   · Vue 应用            —— import { ... } from '@yd/ui'
 *   · 任何其它框架        —— 只引 CSS 与这里导出的纯数据
 *
 * 硬约束（违反即门禁失败，见 scripts/check-layering.cjs）：
 *   C1 本目录不得出现 `from 'vue'` / `from 'ant-design-vue'` / `*.vue` 导入
 *   C2 本目录不得出现 .vue 文件
 *   C3 本目录不得反向 import 宿主（宿主路径一律不许出现）
 *
 * 注意：本入口的 TS 形态仍需打包器解析 `import x from './x.png'` 这类资源导入。
 * 需要「零构建直接用」的场景请走 `dist-lite/`（产物，见 scripts/build-lite.mjs）。
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
export { KPI_ASSETS, KPI_ASSET_FILES } from './contract/kpi-assets'
export type { KpiKey } from './contract/kpi-assets'

/* ---------- 契约：皮肤钩子（库输出、宿主负责样式的类名） ---------- */
export { SKIN_HOOKS, isSkinHook } from './contract/skin-hooks'

/* ---------- 令牌真源 ---------- */
export { lightTokens, darkTokens } from './theme/tokens'
