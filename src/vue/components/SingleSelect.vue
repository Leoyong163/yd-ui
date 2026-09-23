<script setup lang="ts">
/**
 * SingleSelect —— 单选触发按钮（无搜索）。
 *
 * 从宿主 `src/pages/role-form/RoleSingleSelect.vue` 抽出（P3 抽取）。
 * 宿主版本用私有 `SelectChevron` 组件画箭头，入库后改用 sprite 里的 `chevronDown` ——
 * 原生侧用 `<use href="…/icons.svg#yd-icon-chevronDown">` 就能拿到同一个图形。
 *
 * 根元素是 `.single-select-wrap`（宿主版本把 button 当根，于是菜单只能靠 Teleport 定位，
 * 原生侧没有可承载 absolute 菜单的定位祖先）。加一层 wrap 之后两层结构一致。
 */
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'

defineOptions({ name: 'SingleSelect', inheritAttrs: false })

export type SingleSelectOption = {
  value: string
  label: string
}

const props = withDefaults(
  defineProps<{
    value?: string
    options: SingleSelectOption[]
    placeholder?: string
    disabled?: boolean
  }>(),
  { value: undefined, placeholder: '请选择', disabled: false },
)

const emit = defineEmits<{ (e: 'update:value', value: string): void }>()

const triggerRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLDivElement | null>(null)
const open = ref(false)
const pos = ref<{ top: number; left: number; width: number } | null>(null)

const selected = () => props.options.find((option) => option.value === props.value)

function updatePosition() {
  if (!triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  pos.value = { top: rect.bottom + 4, left: rect.left, width: rect.width }
}

watch(open, (isOpen) => {
  if (isOpen) {
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
  } else {
    window.removeEventListener('scroll', updatePosition, true)
    window.removeEventListener('resize', updatePosition)
  }
})

function closeOnOutsideClick(event: MouseEvent) {
  const target = event.target as Node
  if (!triggerRef.value?.contains(target) && !menuRef.value?.contains(target)) open.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', closeOnOutsideClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', closeOnOutsideClick)
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
})

function toggleOpen() {
  open.value = !open.value
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
  if ((event.key === 'ArrowDown' || event.key === 'Enter') && !open.value) {
    event.preventDefault()
    open.value = true
  }
}

function selectOption(value: string) {
  emit('update:value', value)
  open.value = false
}
</script>

<template>
  <div class="single-select-wrap" v-bind="$attrs">
    <button
      ref="triggerRef"
      type="button"
      :class="['single-select', { 'is-open': open }]"
      role="combobox"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :disabled="disabled"
      @click="toggleOpen"
      @keydown="onKeyDown"
    >
      <span :class="selected() ? 'single-select-value' : 'single-select-placeholder'">
        {{ selected()?.label ?? placeholder }}
      </span>
      <span class="single-select-chevron"><Icon name="chevronDown" /></span>
    </button>
    <Teleport to="body">
      <div
        v-if="open && pos"
        ref="menuRef"
        class="single-select-menu"
        role="listbox"
        :style="{ position: 'fixed', top: pos.top + 'px', left: pos.left + 'px', width: pos.width + 'px' }"
      >
        <button
          v-for="option in options"
          :key="option.value"
          type="button"
          role="option"
          :aria-selected="option.value === value"
          :class="`single-select-option${option.value === value ? ' selected' : ''}`"
          @click="selectOption(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </Teleport>
  </div>
</template>
