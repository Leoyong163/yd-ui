/**
 * 权限树的通用类型与工具 —— 属库。
 *
 * 从宿主 `src/shared.ts` 拆出（P1-T3）。判据：`TreeNode` 是 `PermissionTree` 组件的
 * 公开 props 类型，`countTreeNodes` 是不含任何业务规则的通用递归工具。
 *
 * 注意 `owned` 字段：它是「该节点是否已授权」这一展示语义，组件据此渲染
 * `.tree-owned` / `.tree-denied`。业务侧如何判定 owned 不是库的事。
 *
 * P3 抽取时把工具函数改成**对节点类型泛化**：`ChipTree` 用的是另一种节点
 * （只需 id/name/type/children，不要求 owned），两棵树共用同一套遍历实现，
 * 不再各写一份 `countXxxNodes`（宿主里就有两份重复的计数函数）。
 */

export type TreeNode = {
  id: string
  name: string
  type: string
  owned: boolean
  children?: TreeNode[]
}

/**
 * 芯片树（`ChipTree`）用的最小节点：不要求 `owned`。
 * 那棵树只展示「已授权」的项 —— 授权态在数据侧就筛掉了，不必逐节点带标记。
 */
export type ChipTreeNode = {
  id: string
  name: string
  type?: string
  children?: ChipTreeNode[]
}

/** 任何能被这套工具遍历的树节点：有 id，子节点同型。 */
export type TreeNodeLike<T> = {
  id: string
  children?: T[]
}

/** 递归统计节点总数（含自身）。 */
export function countTreeNodes<T extends TreeNodeLike<T>>(nodes: T[]): number {
  return nodes.reduce((total, node) => total + 1 + countTreeNodes(node.children || []), 0)
}

/** 递归取出所有含子节点的节点 id，供「收起全部」使用。 */
export function branchIds<T extends TreeNodeLike<T>>(nodes: T[]): string[] {
  return nodes.flatMap((node) => (node.children?.length ? [node.id, ...branchIds(node.children)] : []))
}

/** 按 id 查找节点。 */
export function findTreeNode<T extends TreeNodeLike<T>>(nodes: T[], id: string): T | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
    const hit = node.children ? findTreeNode(node.children, id) : undefined
    if (hit) return hit
  }
  return undefined
}
