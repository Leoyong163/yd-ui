# Changelog

本库遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## 记录约定（与《组件库Git策略与模块演进规划.md》配套）

- 条目前缀 = Conventional Commits 的 scope，即模块：`core` / `vue` / `icons` / `tokens` / `schema` / `docs` / `ai` / `ci`。
- **新增**组件 / 图标 / 令牌 / 主题 = minor；**删除或改名** = major（必须配 codemod 或迁移说明）。
- 视觉相关变更（令牌改值、样式配方调整）在条目末尾标 `visual`，并附基线比对结果（`DIFF_TOTAL`）。
- 页面模板（`examples/`）是独立内容线：增删模板**不** bump 库版本，条目记在对应版本下但不影响语义。
- 每次合入 main 打 tag 时，把「Unreleased」改名为该版本号并补日期。

## [Unreleased]

### Added

- **vue**: 从宿主表单/展示件抽取 6 个组件（P3）—— `PortalMenu`（锚点浮层容器）、`SearchSelect`（可搜索单选，带清空）、`SingleSelect`（按钮式单选）、`SelectCard`（可勾选卡片，可展开详情）、`ChipTree`（叶子芯片树，连续叶子并成一行）、`HoverCard`（悬停/聚焦浮层）。组件层 12 → **18 个 SFC**，全部不含 `<style>`。
- **core**: 6 个新类名家族（`portal-menu` / `search-select` / `single-select` / `select-card` / `chip-tree` / `hover-card`）；类名契约 27 家族 / 128 类名 → **33 家族 / 190 类名**（由 `build:contract` 自动生成）。**全部是新增选择器，未改动既有族的任何配方。**
- **core**: 状态词表新增 `has-value`（已选，清空按钮的显隐条件）/ `is-branch` / `is-leaf`（芯片树行身份）。
- **core**: 权限树工具泛化 —— 新增 `ChipTreeNode` 与 `TreeNodeLike` 类型，`countTreeNodes` / `branchIds` / `findTreeNode` 改为对节点类型泛型，两棵树共用一套遍历（宿主里那份重复的 `countPermNodes` 不再需要）。
- **schema**: 6 条组件契约（含 props / slots / events / a11y / 示例代码 / native 等价写法）+ 新增「表单」分组；`pending` 里登记本批**刻意缓抽**的 `FormSelect` / `RolePicker` / `RoleAuthDropdown` 及原因。
- **docs**: 文档站新增 10 个实时演示（SearchSelect / SingleSelect / SelectCard 为受控交互，能就地改值并显示当前 value）；`llms.txt` 与 README 同步到 18 组件 / 33 家族 / 190 类名，并补齐新家族的类名配方与已知缺口。
- **ci**: `CHANGELOG.md` 与 PR 模板（`.github/PULL_REQUEST_TEMPLATE.md`：版本语义 + 门禁 + 同步义务勾选项）。

### Fixed

- **core**: 抽 `SearchSelect` 时修掉宿主里的两处**静默失效** —— `var(--fill-color)` 与 `var(--text-tertiary)` 这两个令牌在库里根本不存在，宿主那两条声明（行悬停底色、选项右侧小字）一直没生效。入库后改用真令牌（`--bg-hover` / `--text-muted`）。
- **vue**: `PortalMenu` 修掉宿主的监听器泄漏 —— 原实现只在 unmount 时解绑 `scroll`/`resize`，关闭菜单后监听器仍挂着，每次开关都会叠加一对；现在关闭即解绑。
- **vue**: 6 个新组件一律用 `inheritAttrs: false` + `v-bind="$attrs"` —— 它们的根是 fragment（根元素 + Teleport），不显式转发会丢掉外部传入的 `class` / `style`。

### Changed

- **ci**: `docs-preview` workflow 增加 `pull_request` 触发（preview / main）——feat→preview、preview→main 的 PR 从此有 checks 可依；Pages 发布三件套与 deploy job 均避开 PR 事件，PR 检查不碰线上预览站；concurrency 组按 ref 隔离。

## [0.1.0] - 2026-09-21

首批抽取完成：两层结构（core 零框架层 + vue 组件层）+ dist-lite 直引包。
抽取硬指标达成：30 组页面快照、6630 个元素逐属性样式指纹比对 `DIFF_TOTAL = 0`。

### Added

- **core**: 样式三层（tokens → base → components）+ 41 个 SVG 图标 + 4 张 KPI 素材 + 控件语义契约（tag-class / tree / assets-manifest / skin-hooks）+ 设计令牌真源（`theme/tokens.ts`）。
- **vue**: 12 个组件（Icon / IconTile / KpiImg / StatusTag / UrgencyTag / Modal / SearchBox / Pagination / PermissionTree / PermissionTreeRows / OverflowTooltip / EmptyState），一律不含 `<style>`。
- **dist-lite**: 三层合并 CSS + sprite + 素材 + manifest（原生 HTML 零构建直引，产物入库由 `check:lite` 守同步）。
- **schema**: `components.json` 组件契约（同时是文档站数据源）+ `class-contract.json` 类名契约（27 家族 / 128 类名，自动生成）。
- **docs-site**: 组件文档站（左侧导航 + 实时 Demo + API 表 + 令牌色板 + 亮暗切换 + 原生指南），自带 vite 配置随库走。
- **ai**: Claude skill / Copilot instructions / Cursor rules / `llms.txt`。
- **ci**: `check` 四条静态门禁（tokens / schema / layering / lite）+ 三个浏览器门禁（docs / vanilla / parity）+ `verify` 一键验收（自动拉起服务、跑完即收）。
- **ci**: preview 预览线流水线 —— 推 `preview` 自动：静态门禁 → 构建文档站 → 部署 GitHub Pages（门禁红了不发布）。

### Changed

- 公开前脱敏：去掉公司名 / 内部标识 / 宿主路径，D2 门禁改成通用判据。

### Fixed

- **ci**: pnpm 构建白名单改用 v11 的 `allowBuilds`（旧名 `onlyBuiltDependencies` 已被移除，静默忽略导致 CI 报 `ERR_PNPM_IGNORED_BUILDS`）。
- **ci**: dayjs 显式声明为 devDependency（CI 构建报 ENOENT）。

[Unreleased]: https://github.com/Leoyong163/yd-ui/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Leoyong163/yd-ui/releases/tag/v0.1.0
