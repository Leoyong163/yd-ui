<script setup lang="ts">
/**
 * SearchSelect —— 可搜索单选（带清空）。
 *
 * 从宿主 `src/pages/InlineSearchSelect.vue` 抽出（P3 抽取）。宿主里这份组件存了两份
 * 完全相同的副本（`pages/` 与 `pages/role-form/` 各一份），入库后只有这一份。
 *
 * 行为原样保留：聚焦/点击即打开并清空查询、输入即过滤、Enter 选中首个匹配、
 * Esc 关闭、箭头按钮 mousedown 切换（preventDefault 保住输入焦点）、
 * 悬停时清空按钮顶掉箭头、外部 mousedown 关闭。
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'

defineOptions({ name: 'SearchSelect', inheritAttrs: false })

export type SearchSelectOption = {
  value: string
  label: string
  meta?: string
}

const props = withDefaults(
  defineProps<{
    /** 选中值（受控，配 `@update:value` 使用） */
    value?: string
    options: SearchSelectOption[]
    disabled?: boolean
    placeholder?: string
    emptyText?: string
  }>(),
  { value: undefined, disabled: false, placeholder: '请选择', emptyText: '无匹配结果' },
)

const emit = defineEmits<{ (e: 'update:value', val: string | undefined): void }>()

/** 清空按钮的 × 不在图标 sprite 里 —— 与 SearchBox 的放大镜同理，随组件自带。 */
const CLOSE_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'

const rootRef = ref<HTMLDivElement | null>(null)
const menuRef = ref<HTMLDivElement | null>(null)
const query = ref('')
const open = ref(false)
const rect = ref<DOMRect | null>(null)

const selected = computed(() => props.options.find((option) => option.value === props.value))
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return props.options.filter((option) => `${option.label} ${option.value} ${option.meta ?? ''}`.toLowerCase().includes(q))
})

function setValue(val: string | undefined) {
  emit('update:value', val)
}

function openForPick() {
  if (props.disabled) return
  open.value = true
  query.value = ''
}

function selectOption(option: SearchSelectOption) {
  if (props.disabled) return
  setValue(option.value)
  query.value = ''
  open.value = false
}

function onInput(event: Event) {
  if (props.disabled) return
  query.value = (event.target as HTMLInputElement).value
  open.value = true
}

function onKeyDown(event: KeyboardEvent) {
  if (props.disabled) return
  if (event.key === 'Escape') open.value = false
  if (event.key === 'Enter' && filtered.value[0]) {
    event.preventDefault()
    selectOption(filtered.value[0])
  }
}

function onArrowMouseDown(event: MouseEvent) {
  event.preventDefault()
  if (props.disabled) return
  open.value = !open.value
}

function onClearMouseDown(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  setValue(undefined)
  query.value = ''
  open.value = false
}

function updatePosition() {
  if (rootRef.value) rect.value = rootRef.value.getBoundingClientRect()
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

function handleDocumentMouseDown(event: MouseEvent) {
  const target = event.target as Node
  if (!rootRef.value?.contains(target) && !menuRef.value?.contains(target)) {
    open.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleDocumentMouseDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocumentMouseDown)
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
})
</script>

<template>
  <div
    ref="rootRef"
    v-bind="$attrs"
    :class="['search-select', { 'has-value': !!value, 'is-open': open, disabled }]"
  >
    <input
      type="text"
      class="input search-select-input"
      :value="open ? query : (selected ? selected.label : '')"
      :placeholder="placeholder"
      :disabled="disabled"
      @mousedown="openForPick"
      @click="openForPick"
      @focus="openForPick"
      @input="onInput"
      @keydown="onKeyDown"
    />
    <button type="button" class="search-select-arrow" aria-label="展开选项" :disabled="disabled" @mousedown="onArrowMouseDown">
      <Icon name="chevronDown" />
    </button>
    <button
      v-if="value && !disabled"
      type="button"
      class="search-select-clear"
      aria-label="清空选项"
      v-html="CLOSE_ICON"
      @mousedown="onClearMouseDown"
    ></button>
    <Teleport to="body">
      <div
        v-if="open && rect"
        ref="menuRef"
        class="search-select-menu"
        role="listbox"
        :style="{ top: rect.bottom + 4 + 'px', left: rect.left + 'px', width: Math.max(280, rect.width) + 'px' }"
      >
        <template v-if="filtered.length">
          <button
            v-for="option in filtered"
            :key="option.value"
            type="button"
            :class="`search-select-option${option.value === value ? ' selected' : ''}`"
            @mousedown.prevent
            @click="selectOption(option)"
          >
            <slot name="option" :option="option" :selected="option.value === value">
              <span class="search-select-value">{{ option.label }}</span>
              <em v-if="option.meta">{{ option.meta }}</em>
            </slot>
          </button>
        </template>
        <div v-else class="search-select-empty">{{ emptyText }}</div>
      </div>
    </Teleport>
  </div>
</template>
