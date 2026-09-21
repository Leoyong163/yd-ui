/**
 * KPI 卡片配图映射 —— 属库。
 *
 * 从宿主 `src/shared.ts` 拆出（P1-T3）；P2 分层后图片与本文档一起落在
 * `core/`（零框架层），因此库自包含，不反向依赖宿主的 `src/assets/*`。
 *
 * 键空间不在这里定义，而是 `assets-manifest.ts`（纯数据，原生 HTML 侧也读它）。
 * 这里只负责把键解析成**打包器处理过的 URL**——这一步是构建期行为，
 * 纯静态页面走 `dist-lite/assets/` 直连文件名，不走这里。
 */

import { KPI_ASSET_FILES } from './assets-manifest'
import type { KpiKey } from './assets-manifest'

import kpiPending from '../assets/kpi-pending.png'
import kpiProcessed from '../assets/kpi-processed.png'
import kpiSubmitted from '../assets/kpi-submitted.png'
import kpiCc from '../assets/kpi-cc.png'

/**
 * 语义键 → 图片 URL。`KpiImg` 组件的 `kpiKey` 取值即此表的键。
 *
 * 类型写成 `Record<KpiKey, string>` 是刻意的：`KPI_ASSET_FILES` 里新增一个键
 * 而这里忘了加，TypeScript 会直接报错，不会静默漏图。
 */
export const KPI_ASSETS: Record<KpiKey, string> = {
  pending: kpiPending,
  processed: kpiProcessed,
  submitted: kpiSubmitted,
  cc: kpiCc,
}

export type { KpiKey }
export { KPI_ASSET_FILES }
