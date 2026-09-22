<!-- 目标分支：feat/* → preview（日常预览）；preview → main（发布合并）。不要直接对 main 提非发布 PR。 -->

## 这个 PR 做了什么

<!-- 一两句话 + 关联的波次/模块。例：W1 清债 · vue 层新增 Drawer 组件 -->

## 版本语义

- [ ] 无（docs / examples / chore，不 bump）
- [ ] minor（新增组件 / 图标 / 令牌 / 主题）
- [ ] major（删除或改名 —— 必须附 codemod 或迁移说明）

## 门禁

- [ ] `pnpm run check` 本地通过
- [ ] 涉及渲染的改动跑过浏览器门禁（`pnpm run verify`，或单独 `probe:*`），结果已附

## 同步义务（改了哪项就勾哪项，没涉及的整行删掉）

- [ ] 改了 `core/styles/` → 已跑 `npm run build:lite`，`dist-lite/` 已随本 PR 重建
- [ ] 改了组件 props / events / slots → `schema/components.json` 已同步
- [ ] 改了 API / 类名 / 图标表 → `llms.txt` 与 `ai/*` 已同步
- [ ] 视觉变化（令牌改值 / 样式配方）→ 基线比对结果已附；`DIFF ≠ 0` 已显式接受并更新基线
- [ ] 断点 / 视口矩阵变更 → 基线换代已单独 commit（并计划单独打 tag）
- [ ] 新增图标 / 素材 → manifest 已重建，文档站对应页面已确认出现
- [ ] 该变更对 AI agent 可见 → `CHANGELOG.md` 的 Unreleased 已补条目

## 回滚预案

<!-- 一句话：这个 PR 出问题怎么撤。例：单 commit revert 即可 / 需与 dist-lite 一起回滚 -->
