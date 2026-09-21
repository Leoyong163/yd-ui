/**
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
