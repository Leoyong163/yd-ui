<script setup lang="ts">
/**
 * ChipTree —— 叶子芯片式权限树。
 *
 * 从宿主 `src/pages/AuthPermTreeParts.vue` + `AuthPermCell.vue` 抽出（P3 抽取）。
 * 渲染语义与宿主一致：**连续的叶子节点合并成一行芯片**（省纵向空间），分支行带计数徽标；
 * 只有分支行能展开。宿主用递归子组件实现，这里改成**一趟扁平化** —— 展开态本来就在
 * `openKeys` 里，扁平列表能一次算完，不必多一个递归 SFC 与配套契约条目。
 *
 * 缩进从宿主的 inline style 挪进契约类名（`chip-tree-depth-N` / `chip-tree-leaf-depth-N`）：
 * 深度是有限枚举，属于视觉配方，应当由 CSS 承载。
 */
import { computed, ref, watch } from 'vue'
import { branchIds, countTreeNodes, type ChipTreeNode } from '../../core/contract/tree'

defineOptions({ name: 'ChipTree' })

const props = withDefaults(
  defineProps<{
    nodes: ChipTreeNode[]
    /** 无数据时的文案（宿主里写死了业务文案，这里改成 prop） */
    emptyText?: string
    /** 初始是否全展开（宿主在悬浮卡里全展开、在表格单元里全收起） */
    defaultExpandAll?: boolean
    expandLabel?: string
    collapseLabel?: string
    ariaLabel?: string
  }>(),
  {
    emptyText: '暂无数据',
    defaultExpandAll: false,
    expandLabel: '全部展开',
    collapseLabel: '全部收起',
    ariaLabel: '权限节点',
  },
)

/** 分支行最多缩进到 4 级、叶子行到 5 级；再深不再缩进（与宿主 Math.min(depth, 4) 一致）。 */
const MAX_BRANCH_DEPTH = 4
const MAX_LEAF_DEPTH = 5

type ChipRow =
  | { kind: 'branch'; key: string; id: string; name: string; depth: number; open: boolean; count: number }
  | { kind: 'leaves'; key: string; depth: number; leaves: ChipTreeNode[] }

const openKeys = ref<string[]>(props.defaultExpandAll ? branchIds(props.nodes) : [])

/** 数据是异步到货时，`defaultExpandAll` 要到手后才生效 */
watch(
  () => props.nodes,
  (nodes) => {
    if (props.defaultExpandAll) openKeys.value = branchIds(nodes)
  },
)

const expandable = computed(() => branchIds(props.nodes))
const total = computed(() => countTreeNodes(props.nodes))
const allOpen = computed(
  () => expandable.value.length > 0 && expandable.value.every((id) => openKeys.value.includes(id)),
)

const rows = computed<ChipRow[]>(() => {
  const out: ChipRow[] = []
  const walk = (nodes: ChipTreeNode[], depth: number) => {
    let leafBuf: ChipTreeNode[] = []
    const flush = (key: string) => {
      if (!leafBuf.length) return
      out.push({ kind: 'leaves', key, depth: Math.min(depth, MAX_LEAF_DEPTH), leaves: leafBuf })
      leafBuf = []
    }
    nodes.forEach((node, index) => {
      const children = node.children || []
      if (!children.length) {
        leafBuf.push(node)
        return
      }
      flush(`leaves-${depth}-${index}-${node.id}`)
      const open = openKeys.value.includes(node.id)
      out.push({
        kind: 'branch',
        key: node.id,
        id: node.id,
        name: node.name,
        depth: Math.min(depth, MAX_BRANCH_DEPTH),
        open,
        count: countTreeNodes(children),
      })
      if (!open) return
      if (children.every((child) => !child.children?.length)) {
        out.push({
          kind: 'leaves',
          key: `leaves-${node.id}`,
          depth: Math.min(depth + 1, MAX_LEAF_DEPTH),
          leaves: children,
        })
      } else {
        walk(children, depth + 1)
      }
    })
    flush(`leaves-end-${depth}`)
  }
  walk(props.nodes, 1)
  return out
})

function toggleKey(id: string) {
  openKeys.value = openKeys.value.includes(id)
    ? openKeys.value.filter((key) => key !== id)
    : [...openKeys.value, id]
}

function toggleAll() {
  openKeys.value = allOpen.value ? [] : [...expandable.value]
}
</script>

<template>
  <div class="chip-tree">
    <div v-if="!nodes.length" class="chip-tree-empty">{{ emptyText }}</div>
    <template v-else>
      <div v-if="expandable.length" class="chip-tree-toolbar">
        <span class="chip-tree-meta">{{ total }} 项</span>
        <button type="button" class="chip-tree-action" @click="toggleAll">
          {{ allOpen ? collapseLabel : expandLabel }}
        </button>
      </div>
      <div class="chip-tree-list" role="tree" :aria-label="ariaLabel">
        <template v-for="row in rows" :key="row.key">
          <div
            v-if="row.kind === 'leaves'"
            :class="['chip-tree-leaf-wrap', `chip-tree-leaf-depth-${row.depth}`]"
            role="group"
          >
            <span v-for="leaf in row.leaves" :key="leaf.id" class="chip-tree-leaf">{{ leaf.name }}</span>
          </div>
          <div
            v-else
            :class="['chip-tree-row', `chip-tree-depth-${row.depth}`, 'is-branch']"
            role="treeitem"
            :aria-expanded="row.open"
          >
            <button
              type="button"
              class="chip-tree-toggle"
              :aria-label="row.open ? collapseLabel : expandLabel"
              @click="toggleKey(row.id)"
            >
              {{ row.open ? '▾' : '▸' }}
            </button>
            <span class="chip-tree-name is-branch">{{ row.name }}</span>
            <span v-if="!row.open" class="chip-tree-count">{{ row.count }}</span>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>
