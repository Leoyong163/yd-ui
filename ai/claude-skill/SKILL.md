---
name: yd-ui
description: 用内部组件库 @yd/ui 写界面（Vue 3 组件路径，或原生 HTML 类名路径）。当任务涉及这个项目的任何 UI —— 新建页面、加表单、做表格、写弹窗、调样式、改配色、加标签状态 —— 都应先加载本技能。库分两层：core 零框架层（原生 HTML 也能用）与 vue 组件层，先判断写的是哪一种，再按里面的组件清单与类名白名单写代码，不要自造组件或 CSS。触发词：@yd/ui、组件库、Portal Design、写页面、加个弹窗、做个表单、标签配色、统一风格、原生 HTML、静态页。
---

# @yd/ui 组件库使用规范

## 为什么需要这份规范

这个项目的 UI **不是自由发挥的**：视觉全部由组件库的全局类名驱动。
AI 生成 UI 代码最常犯的三类错，都能靠「照白名单写」消掉：

| 常见错误 | 后果 | 本规范的约束 |
| --- | --- | --- |
| 自己写一套 CSS / 内联样式 | 与全站风格分叉，暗色主题下必坏 | 只用下面列出的类名 |
| 引用不存在的类名 | 静默失效，不报错 | 类名白名单 |
| 臆造状态词 | 标签变灰底兜底色 | 状态词白名单 |

## 零、先判断写的是哪一侧（这一步错了后面全错）

库分两层，**依赖方向只有 `vue → core`**：

- **`core/` 零框架层** —— 样式三层、图标、素材、控件语义映射表。不依赖任何框架。
- **`vue/` 组件层** —— 18 个 SFC，只依赖 core。组件**不含 `<style>`**，视觉全部来自 core 的类名。

| 你在写 | 怎么做 |
| --- | --- |
| **Vue** 界面 | 引 §一 的三条样式 + §二 的组件；不用组件时用 §三 的类名 |
| **原生 HTML / 静态页** | 只引一个 CSS 文件、只用类名。**不要 import 组件、不要装 Vue** |

原生路径的全部依赖就一行 `@import` 的等价物：

```html
<link rel="stylesheet" href="./dist-lite/yd-ui.css">

<button class="btn btn-primary">提交</button>
<svg width="18" height="18" viewBox="0 0 24 24">
  <use href="./dist-lite/icons.svg#yd-icon-shield"/>
</svg>
```

图标 id 与素材文件名查 `dist-lite/manifest.json`，不要猜。
**core 层不含 JS** —— 弹窗用 `hidden` 属性（页面里补 `[hidden]{display:none}`，因为库给了
`.modal-backdrop` `display:flex`），折叠用 `<details>`，翻页走后端路由。

## 一、接入方式

```ts
// 1) 样式：三条 @import 的**位置就是级联顺序**，且都必须排在宿主页面样式之前
@import '@yd/ui/core/styles/tokens.css';
@import '@yd/ui/core/styles/base.css';
@import '@yd/ui/core/styles/components.css';

// 2) 组件：具名导入
import { Modal, StatusTag, PermissionTree, Pagination } from '@yd/ui'
```

peer 依赖：`vue ^3.4`、`ant-design-vue ^4.2`（仅 `OverflowTooltip` 用到）。
两者都是 **optional** —— 只消费 core 层不必安装。

## 二、组件白名单（18 个，不要自己实现这些）

| 组件 | 用途 | 关键 props | 事件 |
| --- | --- | --- | --- |
| `Icon` | 内联 SVG 图标 | `name`（必填）、`className` | — |
| `IconTile` | 图标 + 底色方块 | `name`、`tone`（blue/cyan/purple/orange/green/rose）、`size`（sm/lg） | — |
| `SearchBox` | 搜索输入（纯展示，无 v-model） | `placeholder` | — |
| `EmptyState` | 空状态占位 | `title`、`desc` | — |
| `StatusTag` | 业务状态 → 标签配色 | `status`（必填） | — |
| `UrgencyTag` | 紧急度标签 | `level`（非常紧急/紧急/普通） | — |
| `KpiImg` | KPI 配图 | `kpiKey`（pending/processed/submitted/cc） | — |
| `Modal` | 对话框（受控，用 v-if 控制挂载） | `title`（必填）、`size`（sm/lg/xl） | `close` |
| `OverflowTooltip` | 仅在真截断时才弹的提示 | `text`（必填）、`className`、`force` | — |
| `Pagination` | 分页条 | `page`、`pageSize`、`total` | `update:page`、`update:pageSize` |
| `PermissionTree` | 权限树（展开态内置） | `nodes` | — |
| `PermissionTreeRows` | 权限树递归行（内部件） | `nodes`、`depth`、`collapsed` | `toggle` |
| `PortalMenu` | 锚点浮层容器（下拉/面板定位底座） | `open`（必填）、`anchorEl`、`width`、`minWidth`、`align` | `close` |
| `SearchSelect` | 可搜索单选（带清空） | `value`、`options`（必填）、`disabled`、`placeholder`、`emptyText` | `update:value` |
| `SingleSelect` | 按钮式单选（无搜索） | `value`、`options`（必填）、`placeholder`、`disabled` | `update:value` |
| `SelectCard` | 可勾选卡片（可展开详情） | `checked`、`title`（必填）、`meta`、`details`、`focused`、`detailsLabel` | `update:checked`、`expand` |
| `ChipTree` | 叶子芯片树（连续叶子并成一行） | `nodes`（必填）、`emptyText`、`defaultExpandAll`、`expandLabel`、`collapseLabel`、`ariaLabel` | — |
| `HoverCard` | 悬停/聚焦浮层 | `title`、`meta`、`triggerLabel`、`openDelay`、`closeDelay`、`disabled` | `update:open` |

**状态词白名单**（`StatusTag` 只能取这些，其它词会变灰色兜底）：
`待处理 待审批 审批中 抄送我 已通过 已驳回 已撤回 已终止 延期审批中 有效 即将到期 已过期 正常`

## 三、类名白名单（不用组件、只用类名时）

- 按钮：`.btn` + `.btn-primary` / `.btn-secondary` / `.btn-ghost` / `.btn-danger` / `.btn-sm` / `.btn-icon`
- 标签：`.tag` + `.tag-pending` `.tag-processing` `.tag-cc` `.tag-approved` `.tag-rejected`
  `.tag-withdrawn` `.tag-terminated` `.tag-extending` `.tag-active` `.tag-expiring`
  `.tag-expired` `.tag-urgent` `.tag-high` `.tag-normal` `.tag-info`
- 卡片：`.card` `.card-header` `.card-title` `.card-body` `.card-footer`
- 表格：`.table` `.table-wrap` `.cell-name` `.cell-muted` `.cell-node`
- 表单：`.form-field`（≥768px 自动变两栏 grid）`.form-label` `.form-hint` `.form-checkbox`
  原生勾选框：`input[type=checkbox].form-checkbox-native`
- 树：`.perm-tree` `.tree-toolbar` `.tree-list` `.tree-row` `.tree-toggle` `.tree-name`
  `.tree-type` `.tree-owned` `.tree-denied` `.tree-children`
- 分页：`.pagination` `.pagination-info` `.pagination-pages` `.pagination-size` `.pagination-jump` `.page-btn`
- 标签页：`.tabs` > `.tab`（当前项 `.tab.active`）> `.tab-count`
  —— **core 独有的纯 CSS 配方，没有 Vue 组件**（原生页面切换标签通常走后端路由）
- 工具：`.sr-only`（屏读专用）、`.mobile-only` / `.desktop-only`（响应式显隐）
- 状态修饰**必须加前缀**，不要裸用：`.btn.active` `.page-btn.active` `.tab.active`

完整白名单是 `schema/class-contract.json`（27 个家族 / 128 个类名，从真源 CSS 自动生成）。
**不要凭感觉拼类名** —— 拼错的类名不会报错，只会掉样式。

## 四、硬约束

1. **不要内联样式表达间距/颜色**。颜色间距只用 `var(--token)`，不要写死色值。
2. **不要新造状态词**给 `StatusTag` —— 先往 `core/contract/tag-class.ts` 的 `STATUS_TAG_CLASS` 登记。
3. **不要给库组件加 `<style>`**。缺样式就补进 `core/styles/components.css` 的对应族。
4. **不要在库里写业务规则**（阈值、状态机、权限判定）。业务规则留宿主，库只给控件语义。
5. **不要让 core 依赖 vue**。依赖方向只有 `vue → core`；core 里不该出现 vue / `.vue` 文件。
6. **不要脱离样式顺序使用**。`components.css` 必须排在宿主页面样式之前。
7. **不要用 `--bg-1` / `--bg-2` / `--bg-3`**：这三个是半主题化的原始色阶，没有暗色覆盖，
   直接消费会在暗色模式下拿到接近白色的值。用 `--bg` / `--bg-muted` / `--surface-*`。

## 五、已知缺口（按需绕开，别假设它们存在）

- `Modal` 没有焦点陷阱，需要严格无障碍时自行补焦点管理。
- `SearchBox` 没绑 `v-model` / `search`，需要真搜索要自行接管。
- `Pagination` 只列前 5 页、跳页框未接事件。
- `SearchSelect` / `SingleSelect` 的菜单**不翻转定位**（贴视口底部会溢出），也没有方向键导航。
- `HoverCard` 的箭头固定贴浮层左上角，触发点在屏幕右侧时会偏。
- **没有** Drawer / Toast / Skeleton / Timeline / StatCard / FileList / Breadcrumb 组件 ——
  这些样式在宿主里但没抽成组件，不要 `import` 它们。
- **没有** FormSelect / RolePicker / RoleAuthDropdown —— 它们存在于源项目里，但绑定 antd 内部
  DOM 结构或携带角色域业务语义，抽取时被刻意缓抽。

## 六、参考文件

- `组件库分层与解耦规范.md` —— 分层规则全文（准入判据、门禁、新增流程、常见违规修法）
- `schema/components.json` —— 完整契约（props / events / slots / 示例代码 / **native 原生等价写法**）
- `schema/class-contract.json` —— 类名白名单（自动生成）
- `dist-lite/manifest.json` —— 图标 id 与素材文件名（原生路径要查这个）
- `llms.txt` —— 压缩版说明，适合一次性塞进上下文
- `core/theme/tokens.ts` —— 设计令牌真源

不确定组件怎么用时，**先读 `schema/components.json` 里对应组件的 `demos` 与 `native`**，
照着示例改，不要凭通用 UI 库的习惯写。
