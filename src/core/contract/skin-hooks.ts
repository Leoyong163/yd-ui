/**
 * 皮肤钩子（skin hooks）—— 库**故意不写样式**、但会在模板里输出的类名。
 *
 * 为什么需要这个文件：分层门禁要求「vue 模板里出现的库家族类名必须在类名契约内」。
 * 但有一类类名是刻意的例外 —— 库把控件交出去之后，宿主需要能在**页面上下文**里
 * 微调它（缩小内边距、改字号、按页面收窄），而这类微调不属于控件语义，不该进控件配方层。
 *
 * 实测案例（P2 门禁抓到）：`PermissionTree.vue` 的工具栏按钮输出
 * `class="btn btn-ghost btn-sm tree-toolbar-btn"`，而 `tree-toolbar-btn` 的样式定义
 * 在宿主 `src/styles/demo1/pages.css` 的 `.permission-tree-section .tree-toolbar-btn { … }`。
 * 也就是说：**类名由库输出，样式由宿主提供**，靠页面选择器限定作用域。
 *
 * 这是一种真实存在的耦合。与其让门禁把它当违规、或干脆不检查，不如**显式登记**：
 *   · 门禁放行（因为它在册）
 *   · 但登记项必须「确实被库的某个模板引用」，否则视为陈旧条目报错
 * 这样耦合就是可枚举、可审计的，而不是藏在某个页面 CSS 里没人知道。
 *
 * 登记规则：
 *   · 只登记**库模板会输出的**类名；宿主自己写的类名不在此列（那本来就不归库管）。
 *   · 值写清「谁在用它、用来干什么」，方便日后判断能不能删。
 *   · 新增条目要同时确认：库侧没有任何规则给它上样式（否则它该进 components.css 而不是这里）。
 */

export const SKIN_HOOKS: Record<string, string> = {
  'tree-toolbar-btn':
    '权限树工具栏按钮的皮肤钩子。PermissionTree.vue 输出，宿主 pages.css 用 `.permission-tree-section .tree-toolbar-btn` 缩小内边距；库侧刻意不给样式，避免把页面级密度决策写进控件配方。',
}

/** 该名字是否是已登记的皮肤钩子。 */
export function isSkinHook(cls: string): boolean {
  return Object.prototype.hasOwnProperty.call(SKIN_HOOKS, cls)
}
