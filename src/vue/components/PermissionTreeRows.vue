<script setup lang="ts">
import type { TreeNode } from '../../core/contract/tree'

defineOptions({ name: 'PermissionTreeRows' })

const props = defineProps<{ nodes: TreeNode[]; depth: number; collapsed: Set<string> }>()
const emit = defineEmits<{ (e: 'toggle', id: string): void }>()
</script>

<template>
  <template v-for="node in nodes" :key="node.id">
    <div
      :class="`tree-row tree-level-${depth}`"
      role="treeitem"
      :aria-expanded="node.children?.length ? !collapsed.has(node.id) : undefined"
    >
      <button
        v-if="node.children?.length"
        type="button"
        class="tree-toggle"
        :aria-label="!collapsed.has(node.id) ? '收起' : '展开'"
        @click="emit('toggle', node.id)"
      >{{ !collapsed.has(node.id) ? '▾' : '▸' }}</button>
      <span v-else class="tree-toggle leaf" aria-hidden="true"></span>
      <span class="tree-name">{{ node.name }}</span>
      <span class="tree-type">{{ node.type }}</span>
      <span :class="node.owned ? 'tree-owned' : 'tree-denied'">{{ node.owned ? '已授权' : '未授权' }}</span>
    </div>
    <div v-if="node.children?.length && !collapsed.has(node.id)" class="tree-children" role="group">
      <PermissionTreeRows :nodes="node.children" :depth="depth + 1" :collapsed="collapsed" @toggle="(id) => emit('toggle', id)" />
    </div>
  </template>
</template>
