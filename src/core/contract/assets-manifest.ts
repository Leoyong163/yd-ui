/**
 * 资产键清单 —— **纯数据**，没有任何导入，也不依赖打包器。
 *
 * 存在的理由：`kpi-assets.ts` 里的 URL 是打包器解析出来的（`import x from './x.png'`），
 * 这种写法原生 HTML 页面拿不到。所以把「有哪些键、对应哪个文件」抽成一份纯数据，
 * 供三方共用：
 *   · 原生 HTML / 静态单文件 —— 按文件名拼 `dist-lite/assets/<file>`
 *   · 文档站与 AI 助手     —— 读 `schema/class-contract.json` 里的资产表
 *   · `kpi-assets.ts`      —— 用 `Record<KpiKey, string>` 约束，漏一个键就编译不过
 *
 * 同步校验：每个值都必须在 `core/assets/` 里真实存在（scripts/check-layering.cjs）。
 */

export const KPI_ASSET_FILES = {
  pending: 'kpi-pending.png',
  processed: 'kpi-processed.png',
  submitted: 'kpi-submitted.png',
  cc: 'kpi-cc.png',
} as const

/** KPI 资产键 —— 全库唯一的键空间定义。 */
export type KpiKey = keyof typeof KPI_ASSET_FILES
