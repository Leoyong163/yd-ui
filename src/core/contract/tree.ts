/**
 * 权限树的通用类型与工具 —— 属库。
 *
 * 从宿主 `src/shared.ts` 拆出（P1-T3）。判据：`TreeNode` 是 `PermissionTree` 组件的
 * 公开 props 类型，`countTreeNodes` 是不含任何业务规则的通用递归工具。
 *
 * 注意 `owned` 字段：它是「该节点是否已授权」这一展示语义，组件据此渲染
 * `.tree-owned` / `.tree-denied`。业务侧如何判定 owned 不是库的事。
 */

export type TreeNode = {
  id: string
  name: string
  type: string
  owned: boolean
  children?: TreeNode[]
}

/** 递归统计节点总数（含自身）。 */
export function countTreeNodes(nodes: TreeNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countTreeNodes(node.children || []), 0)
}

/** 递归取出所有含子节点的节点 id，供「收起全部」使用。 */
export function branchIds(nodes: TreeNode[]): string[] {
  return nodes.flatMap((node) => (node.children?.length ? [node.id, ...branchIds(node.children)] : []))
}

/** 按 id 查找节点。 */
export function findTreeNode(nodes: TreeNode[], id: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
    const hit = node.children ? findTreeNode(node.children, id) : undefined
    if (hit) return hit
  }
  return undefined
}
