# 项目 UI 规范（Copilot 项目级指令）

> 放在项目根的 `.github/copilot-instructions.md`，Copilot 会自动带上这份约束。
> 内容由组件库 `@yd/ui` 的 `ai/copilot-instructions.md` 复制而来 —— 库更新后请重新复制。

本项目 UI 使用内部组件库 **@yd/ui**。写任何界面代码前先遵守下面四条。

## 0. 先分清你在写哪一种代码

库分两层，**依赖方向只有 `vue → core`**：

- **`core/` 零框架层** —— 样式三层、图标、素材、控件语义映射表。不依赖任何框架。
- **`vue/` 组件层** —— 18 个 SFC，只依赖 core。组件**不含 `<style>`**，视觉全部来自 core 的类名。

于是有两条消费路径，选错了后面全错：

| 你在写 | 怎么做 |
| --- | --- |
| **Vue** 界面 | 引 §1 的三条样式 + §2 的组件；不用组件时用 §3 的类名 |
| **原生 HTML / 静态页** | 只引一个 CSS 文件、只用类名。**不要 import 组件、不要装 Vue** |

原生路径的全部依赖就一行：

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

## 1. 样式入口（顺序固定，勿改位置）

```css
@import '@yd/ui/core/styles/tokens.css';
@import '@yd/ui/core/styles/base.css';
@import '@yd/ui/core/styles/components.css';
/* 你自己的页面样式放这之后 */
```

三条 `@import` 的位置就是级联顺序，必须都排在页面样式之前。

## 2. 组件用库的，不要自己实现

```ts
import { Modal, StatusTag, Pagination, PermissionTree } from '@yd/ui'
```

可用组件（**仅此 12 个**，不存在 Drawer / Toast / Skeleton / Timeline）：

| 组件 | 用途 | 关键 props |
| --- | --- | --- |
| `Icon` | 图标 | `name` |
| `IconTile` | 图标方块 | `name` `tone`(blue/cyan/purple/orange/green/rose) `size`(sm/lg) |
| `SearchBox` | 搜索框（纯展示） | `placeholder` |
| `EmptyState` | 空状态 | `title` `desc` |
| `StatusTag` | 状态标签 | `status` |
| `UrgencyTag` | 紧急度标签 | `level`(非常紧急/紧急/普通) |
| `KpiImg` | KPI 配图 | `kpiKey`(pending/processed/submitted/cc) |
| `Modal` | 对话框 | `title` `size`(sm/lg/xl)，事件 `close` |
| `OverflowTooltip` | 溢出提示 | `text` |
| `Pagination` | 分页 | `page` `pageSize` `total` |
| `PermissionTree` | 权限树 | `nodes` |
| `PermissionTreeRows` | 权限树行（内部件） | `nodes` `depth` `collapsed` |
| `PortalMenu` | 锚点浮层容器 | `open`（必填）`anchorEl` `width` `align`，事件 `close` |
| `SearchSelect` | 可搜索单选（带清空） | `value` `options`（必填）`placeholder` `emptyText`，事件 `update:value` |
| `SingleSelect` | 按钮式单选 | `value` `options`（必填）`placeholder` `disabled`，事件 `update:value` |
| `SelectCard` | 可勾选卡片（可展开详情） | `checked` `title`（必填）`meta` `details` `focused`，事件 `update:checked` `expand` |
| `ChipTree` | 叶子芯片树 | `nodes`（必填）`defaultExpandAll` `emptyText` |
| `HoverCard` | 悬停/聚焦浮层 | `title` `meta` `openDelay` `closeDelay`，事件 `update:open` |

## 3. 只用这些类名，不要新造 CSS

- 按钮 `.btn` `.btn-primary` `.btn-secondary` `.btn-ghost` `.btn-danger` `.btn-sm` `.btn-icon`
- 标签 `.tag` + `.tag-pending` `.tag-processing` `.tag-cc` `.tag-approved` `.tag-rejected` `.tag-withdrawn` `.tag-terminated` `.tag-extending` `.tag-active` `.tag-expiring` `.tag-expired` `.tag-urgent` `.tag-high` `.tag-normal` `.tag-info`
- 卡片 `.card` `.card-header` `.card-title` `.card-body` `.card-footer`
- 表格 `.table` `.table-wrap` `.cell-name` `.cell-muted` `.cell-node`
- 表单 `.form-field` `.form-label` `.form-hint` `.form-checkbox`，原生勾选 `input[type=checkbox].form-checkbox-native`
- 树 `.perm-tree` `.tree-toolbar` `.tree-list` `.tree-row` `.tree-toggle` `.tree-name` `.tree-type` `.tree-owned` `.tree-denied` `.tree-children`
- 分页 `.pagination` `.pagination-info` `.pagination-pages` `.pagination-size` `.pagination-jump` `.page-btn`
- 标签页 `.tabs` > `.tab`（当前项 `.tab.active`）> `.tab-count` —— core 独有的纯 CSS 配方，**没有 Vue 组件**
- 工具 `.sr-only` `.mobile-only` `.desktop-only`

**不要内联样式表达间距/颜色。** 颜色只用 `var(--token)`，不要写死色值（暗色主题会坏）。
完整白名单见库里的 `schema/class-contract.json`（27 个家族 / 128 个类名），不要凭感觉拼。

## 4. 状态词只能从这些里选

```
待处理 待审批 审批中 抄送我 已通过 已驳回 已撤回 已终止 延期审批中 有效 即将到期 已过期 正常
```

`StatusTag` 传其它词会渲染成灰色兜底色。需要新词先往库的
`core/contract/tag-class.ts` 的 `STATUS_TAG_CLASS` 里登记。

## 六个不要

1. 不要给库组件加 `<style>` 块 —— 样式一律进库的 `core/styles/components.css`。
2. 不要在库里写业务规则（阈值、状态机、权限判定）—— 业务规则留宿主。
3. **不要让 core 依赖 vue** —— 依赖方向只有 `vue → core`。
4. 不要用 `--bg-1` / `--bg-2` / `--bg-3`（没有暗色覆盖），改用 `--bg` / `--bg-muted` / `--surface-*`。
5. 不要裸用 `.active` / `.selected` 这类状态类，要用带前缀的 `.btn.active`。
6. 不要假设库里有 Drawer / Toast / Skeleton / Timeline / StatCard 等组件。

## 需要更细的接口

- 每个组件的 props / events / slots / 示例代码 / **原生 HTML 等价写法** → `schema/components.json`
- 可用类名白名单 → `schema/class-contract.json`
- 图标 id 与素材文件名 → `dist-lite/manifest.json`
- 分层规则全文（准入判据、门禁、新增流程）→ `组件库分层与解耦规范.md`
- 压缩版说明 → `llms.txt`
