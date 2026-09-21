<script setup lang="ts">
import { reactive } from 'vue'
import type { TreeNode } from '../../core/contract/tree'
import PermissionTreeRows from './PermissionTreeRows.vue'

const props = defineProps<{ nodes: TreeNode[] }>()

const collapsed = reactive(new Set<string>())

function toggle(id: string) {
  if (collapsed.has(id)) collapsed.delete(id)
  else collapsed.add(id)
}

function expandAll() {
  collapsed.clear()
}

function collapseAll() {
  const ids = props.nodes.filter((n) => n.children?.length).map((n) => n.id)
  collapsed.clear()
  ids.forEach((id) => collapsed.add(id))
}
</script>

<template>
  <div class="perm-tree">
    <div class="tree-toolbar" aria-label="权限树操作">
      <button type="button" class="btn btn-ghost btn-sm tree-toolbar-btn" @click="expandAll">展开</button>
      <button type="button" class="btn btn-ghost btn-sm tree-toolbar-btn" @click="collapseAll">收起</button>
    </div>
    <div class="tree-list" role="tree" aria-label="权限节点">
      <PermissionTreeRows :nodes="nodes" :depth="1" :collapsed="collapsed" @toggle="toggle" />
    </div>
  </div>
</template>
