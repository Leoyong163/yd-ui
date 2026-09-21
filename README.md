# @yd/ui · 权限自助门户组件库

从「韵达权限自助门户」抽出的系统组件库：**两层结构 + 一个零构建直引包**。

- **`core/` 零框架层** —— 样式三层、41 个图标符号、4 张素材、控件语义映射表、令牌真源。
  不依赖任何框架，原生 HTML / 静态页 / 其它框架可以直接用。
- **`vue/` 组件层** —— 12 个 SFC，只依赖 `core`。**组件一律不含 `<style>`**，视觉全部由 core 的类名提供。
- **`dist-lite/`** —— 三层 CSS 合并产物 + sprite + 素材，供不跑构建的原生页面 `<link>` 直引。

依赖方向只有一条：**`vue → core`**。
这条方向不靠自觉，靠 `npm run check:layering` 守（core 里 import vue、组件带 `<style>`、
模板用契约外类名，都会让门禁失败）。

抽取的硬要求是**零视觉变化** —— 搬迁前后 30 组页面快照、6630 个元素的逐属性样式指纹比对
`DIFF_TOTAL = 0`；分层之后，两层的视觉一致性由 `vanilla-parity` 实测守（真浏览器逐属性比对）。

> 完整规则（准入判据、门禁、新增流程、常见违规修法）见 **[组件库分层与解耦规范.md](./组件库分层与解耦规范.md)**。

## 目录

```
src/
  index.ts          聚合出口（同时导出 core 与 vue）
  core/             ── 零框架层（Tier 0）：不依赖任何框架 ──
    styles/           tokens.css → base.css → components.css（顺序即级联）
                      index.css = 三层合并入口
    icons/icons.ts    41 个图标（纯 SVG 字符串表，可整表被 AI 读取）
    assets/           kpi-*.png（图片随库发布，库自包含）
    contract/         控件语义映射表（零框架，纯数据）
      tag-class.ts        状态词 → 标签类名（状态词取值空间的唯一真源）
      tree.ts             权限树类型与工具
      assets-manifest.ts  素材键 → 文件名
      skin-hooks.ts       皮肤钩子登记表（库出类名、宿主给样式，唯一被允许的跨边界耦合）
    theme/tokens.ts   设计令牌唯一真源（CSS 是它的产物）
  vue/             ── 组件层（Tier 1）：只依赖 core ──
    index.ts
    components/*.vue  12 个组件（一律不含 <style>）
dist-lite/          原生直引包（构建产物，但提交进仓库 —— 原生消费者不跑构建）
  yd-ui.css           三层合并 CSS
  icons.svg           41 个符号，id 前缀 yd-icon-
  assets/             kpi-*.png
  manifest.json       哈希 / 图标 id / 素材文件名
schema/
  components.json     组件契约：props / events / slots / 无障碍备注 / 示例代码 / native 等价写法
  class-contract.json 类名契约（27 家族 / 128 类名，从 core/styles 自动生成，勿手改）
examples/vanilla/   零构建原生示例页 —— core 层的验收面
ai/                 AI 接入物（见下）
scripts/            门禁与构建脚本（见下）
llms.txt            给 LLM 的压缩版说明
```

## 接入

### Vue 项目

```css
/* 三条 @import 的位置就是级联顺序，必须都排在宿主页面样式之前 */
@import '@yd/ui/core/styles/tokens.css';
@import '@yd/ui/core/styles/base.css';
@import '@yd/ui/core/styles/components.css';
```

```ts
import { Modal, StatusTag, PermissionTree } from '@yd/ui'
```

peer 依赖：`vue ^3.4`、`ant-design-vue ^4.2`（仅 `OverflowTooltip` 用到）。
两个都是 **optional** —— 只消费 `core/` 的项目不必安装。

### 原生 HTML / 零构建

```html
<link rel="stylesheet" href="./dist-lite/yd-ui.css">

<button class="btn btn-primary">提交</button>
<span class="tag tag-pending">待审批</span>

<svg width="18" height="18" viewBox="0 0 24 24">
  <use href="./dist-lite/icons.svg#yd-icon-shield"/>
</svg>
```

不装依赖、不跑构建。图标 id 与素材文件名查 `dist-lite/manifest.json`。
**core 层不含 JS** —— 弹窗用 `hidden` 属性（页面里要补 `[hidden]{display:none}`，因为库给了
`.modal-backdrop` `display:flex`），折叠用 `<details>`，翻页走后端路由。
完整的可运行示例见 `examples/vanilla/index.html`。

### Vite 直引库源码的接法

本库不做 npm 发布，宿主用 alias 直接指到库源码目录（改库即生效，无需同步脚本）：

```ts
const YD_UI_DIR = process.env.YD_UI_DIR || 'D:/demo/组件库'

resolve: {
  alias: [
    { find: /^@yd\/ui\/(.*)$/, replacement: `${YD_UI_DIR}/src/$1` },
    { find: /^@yd\/ui$/, replacement: `${YD_UI_DIR}/src/index.ts` },
    { find: /^@yd\/schema\/(.*)$/, replacement: `${YD_UI_DIR}/schema/$1` },
    // ↓ 必须：库在项目根之外，Rollup 从库目录向上找不到 node_modules，
    //   不钉住 peer 依赖会导致 vite build 报 "Rollup failed to resolve import"
    ...['vue', 'ant-design-vue', 'dayjs'].flatMap((n) => [
      { find: new RegExp(`^${n}$`), replacement: path.join(hostModules, n) },
      { find: new RegExp(`^${n}/(.*)$`), replacement: `${path.join(hostModules, n)}/$1` },
    ]),
  ],
},
server: { fs: { allow: [projectRoot, YD_UI_DIR] } },
```

> 另一种解法是给库目录挂一份 `node_modules`（junction / workspace hoist），
> 那样不需要这段 peer alias。选 alias 是因为它对「库与宿主不在同一仓库」也成立。

## 门禁与构建

```bash
# 改完令牌真源后重新生成 tokens.css
npm run gen:tokens

# 一次跑完三条同步性检查（CI 用）
npm run check

# 分层边界：core 不得依赖 vue、组件不得带 <style>、模板不得用契约外的类名
npm run check:layering
node scripts/check-layering.selftest.cjs   # 给门禁灌违规，证明它真会失败（14 项）

# 类名契约：从 core/styles 真源重新生成
npm run build:contract

# 直引包：重新生成 / 校验是否同步
npm run build:lite
npm run check:lite

# 两层一致性：真浏览器逐属性比对「原生渲染」与「Vue 渲染」
node scripts/vanilla-parity.cjs

# 原生示例页验收：零报错、sprite 可解析、各族非零渲染、语义配色不混淆
node scripts/vanilla-probe.cjs

# 本地看原生示例页（零依赖静态服务器）
node scripts/serve-vanilla.mjs        # → http://127.0.0.1:5175/
```

> **改完 `core/styles/` 一定要 `npm run build:lite`**，否则 `dist-lite/` 会静默落后于源码，
> 原生那一侧就悄悄不对了。`check:lite` 就是为拦这个而存在的。

## AI 接入

| 用途 | 文件 | 放到哪 |
| --- | --- | --- |
| Claude / Claude Code | `ai/claude-skill/SKILL.md` | `~/.claude/skills/yd-ui/SKILL.md` 或项目 `.claude/skills/` |
| VSCode Copilot | `ai/copilot-instructions.md` | 项目根 `.github/copilot-instructions.md` |
| Cursor | `ai/cursor-rules.mdc` | 项目根 `.cursor/rules/` |
| 通用 / 一次性粘贴 | `llms.txt` | 直接贴进对话 |
| 工具链 / MCP | `schema/components.json` | 由工具读取 |

`schema/components.json` 同时是**文档站的数据源**，所以文档和实现不可能对不上。
（该文件目前手工维护 —— 改组件或改 props 时请一并更新；`check:tokens` 只守令牌，不守它。）

## 文档站（组件预览）

文档站（antd / tdesign 风格：左侧导航 + 实时 Demo + 可复制代码 + API 表 + 令牌色板 + 亮暗切换，
含新增的「原生 HTML」与「架构与迁移」指南页）由**宿主工程承载**，不在本仓库内 ——
因为它要靠宿主的 Vite alias 解析 `@yd/ui` 与 `@yd/schema`。
宿主仓库里的位置：`docs.html` + `site/**` + `vite.docs.config.ts`。

```bash
# ① 最常见：宿主 dev server 里顺带就能看（与业务门户共用 5173）
vite                            # 然后打开 http://localhost:5173/docs.html

# ② 单独起一个端口，只跑文档站（热更新）
npm run docs                    # → http://localhost:5174/docs.html

# ③ 产出可部署的静态站（dist-docs/，相对路径 base，可挂任意子路径）
npm run docs:build
npm run docs:preview            # 本地起服务预览构建产物
```

> 静态产物不能直接双击 `index.html` 打开（ES module 在 `file://` 下被 CORS 拦），
> 必须经 HTTP 提供；对外分享就用 `docs:build` + 任意静态托管。

## 四条禁令

1. **R1** 库不得 import 宿主任何模块 —— 禁止反向依赖。
2. **R2** 组件不得带 `<style>` 块 —— 样式一律进 `core/styles/` 的对应层。
3. **R3** 库不得写死业务规则（如到期风险阈值）—— 业务规则留宿主，库只提供控件语义。
4. **R4** core 不得依赖 vue 层 —— 依赖方向只有 `vue → core`。

## 已知缺口

- `Modal` 没有焦点陷阱（focus trap）。
- `SearchBox` 未绑定 `v-model` / `search` 事件，目前只能展示。
- `Pagination` 只列前 5 页；跳页输入框未接事件。
- 宿主里另有 Drawer / Toast / Skeleton / Timeline / StatCard / FileList / Chip / Segment 的样式，
  **尚未抽成组件**，迁移时刻意没有把它们搬进库（避免把没有实现的样式搬成死代码）。
- 原生路径不含 JS（这是设计，不是缺口）—— `OverflowTooltip` 因此没有 core 层等价物。
- `--bg-1` / `--bg-2` / `--bg-3` 只有亮色值、没有暗色覆盖（暗色覆盖的是由它们派生的
  `--bg` / `--bg-muted` / `--surface-2` / `--surface-3`）。当前无人直接消费，但这是陷阱，
  新增消费方请改用派生令牌。
