/**
 * @yd/ui —— 某企业权限自助门户 · 系统组件库（聚合入口）
 *
 * 这个库分两层，**依赖方向是单向的**：vue → core，core 不认识 vue。
 *
 *   core/  Tier 0 · 零框架层     CSS 三层 + 图标 + 素材 + 纯映射表 + 令牌
 *                                → 原生 HTML / 静态单文件 / 任何框架都能用
 *   vue/   Tier 1 · Vue 层       18 个 SFC，只做结构与行为，外观全部来自 core 的类名
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
 * 只想要零框架那一层时，请直接引 `@yd/ui/core`，不要走这个聚合入口 ——
 * 聚合入口会连带把 18 个组件拉进依赖图。
 *
 * 三条禁令（规划 §3.3）：
 *   R1 库不得 import 宿主任何模块（禁止反向依赖）
 *   R2 组件不得带 <style>，样式一律进 core/styles 的对应层
 *   R3 库不得写死任何业务规则（如到期风险阈值），业务规则留宿主
 */

export * from './core'
export * from './vue'
