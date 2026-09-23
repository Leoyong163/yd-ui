<script setup lang="ts">
/**
 * SelectCard —— 可勾选卡片（勾选 + 可展开详情）。
 *
 * 从宿主 `src/pages/RoleCard.vue` 抽出（P3 抽取并去业务化）：
 *   · 业务对象 `role` → `title` / `meta` / `details` 三个原子 props，详情内容走默认插槽；
 *   · antd `Checkbox` → 库内自绘复选框（`appearance:none` + `:checked::after` 勾）。
 *     这是刻意的：库不该为一个勾选框把 antd 拉进组件依赖，原生侧也需要能直接复刻。
 */
import { ref } from 'vue'
import Icon from './Icon.vue'

defineOptions({ name: 'SelectCard' })

const props = withDefaults(
  defineProps<{
    checked: boolean
    /** 主标题（宿主里是角色名） */
    title: string
    /** 次要说明（宿主里是角色 ID） */
    meta?: string
    /** 详情兜底文案；给了 `default` 插槽时以插槽为准 */
    details?: string
    /** 键盘/程序化聚焦态 */
    focused?: boolean
    /** 详情开关的文案 */
    detailsLabel?: string
  }>(),
  { meta: undefined, details: undefined, focused: false, detailsLabel: '详情' },
)

const emit = defineEmits<{
  (e: 'update:checked', checked: boolean): void
  (e: 'expand', expanded: boolean): void
}>()

const expanded = ref(false)

/** 整行点击即切换勾选（与宿主的「点行=选中」一致） */
function toggleChecked() {
  emit('update:checked', !props.checked)
}

function onCheckboxChange(event: Event) {
  emit('update:checked', (event.target as HTMLInputElement).checked)
}

function toggleExpanded(event: MouseEvent) {
  event.stopPropagation()
  expanded.value = !expanded.value
  emit('expand', expanded.value)
}
</script>

<template>
  <div :class="['select-card', { selected: checked, focus: focused }]">
    <div class="select-card-main" @click="toggleChecked">
      <input
        type="checkbox"
        class="select-card-checkbox"
        :checked="checked"
        @click.stop
        @change="onCheckboxChange"
      />
      <span class="select-card-text">
        <span class="select-card-name">{{ title }}</span>
        <span v-if="meta" class="select-card-meta">{{ meta }}</span>
      </span>
      <button
        type="button"
        :class="['select-card-toggle', { open: expanded }]"
        :aria-expanded="expanded"
        @click="toggleExpanded"
      >
        {{ detailsLabel }}
        <span class="select-card-toggle-icon"><Icon name="chevronDown" /></span>
      </button>
    </div>
    <div v-if="expanded" class="select-card-details">
      <slot>{{ details }}</slot>
    </div>
  </div>
</template>
