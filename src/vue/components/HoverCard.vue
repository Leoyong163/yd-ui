<script setup lang="ts">
/**
 * HoverCard —— 悬停 / 聚焦浮层。
 *
 * 从宿主 `src/pages/ApprovalRolePermHoverCard.vue` 抽出（P3 抽取并去业务化）：
 * 触发器与内容都变成插槽，标题/副标题变成 props。宿主里它绑在「角色 → 权限详情」上，
 * 库这一层不关心内容是什么。
 *
 * 浮层位置计算（贴触发器、空间不够时翻到上方）留在组件里 —— 那是几何；
 * 盒子外观在 `.hover-card`，层级走 `--z-toast`（它需要盖过 modal，
 * 宿主原来写死的 1200 在这里归到语义层级）。
 */
import { ref, watch, onBeforeUnmount } from 'vue'

defineOptions({ name: 'HoverCard', inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** 浮层标题；与 `meta` 都为空时不渲染头部 */
    title?: string
    meta?: string
    /** 默认触发器（圆形信息按钮）的无障碍标签 */
    triggerLabel?: string
    /** 悬停多久后出现（ms） */
    openDelay?: number
    /** 移开后多久消失（ms）—— 留一点缓冲，鼠标划过浮层时不闪 */
    closeDelay?: number
    disabled?: boolean
  }>(),
  {
    title: undefined,
    meta: undefined,
    triggerLabel: '查看详情',
    openDelay: 0,
    closeDelay: 140,
    disabled: false,
  },
)

const emit = defineEmits<{ (e: 'update:open', open: boolean): void }>()

/** 默认触发器图标：信息圆圈。不在图标 sprite 里（与 SearchBox 的放大镜同理），随组件自带。 */
const INFO_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'

const triggerRef = ref<HTMLElement | null>(null)
const open = ref(false)
const pos = ref({ top: 0, left: 0 })
let closeTimer: number | null = null
let openTimer: number | null = null

const BUBBLE_W = 320
const BUBBLE_H = 300
const GAP = 8

function setOpen(value: boolean) {
  if (open.value === value) return
  open.value = value
  emit('update:open', value)
}

function clearTimers() {
  if (closeTimer != null) {
    window.clearTimeout(closeTimer)
    closeTimer = null
  }
  if (openTimer != null) {
    window.clearTimeout(openTimer)
    openTimer = null
  }
}

function updatePosition() {
  const el = triggerRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  let left = rect.left
  let top = rect.bottom + GAP
  if (left + BUBBLE_W > window.innerWidth - 12) left = Math.max(12, window.innerWidth - BUBBLE_W - 12)
  if (top + BUBBLE_H > window.innerHeight - 12) top = Math.max(12, rect.top - BUBBLE_H - GAP)
  pos.value = { top, left }
}

function show() {
  if (props.disabled) return
  clearTimers()
  if (props.openDelay > 0) {
    openTimer = window.setTimeout(() => {
      updatePosition()
      setOpen(true)
    }, props.openDelay)
    return
  }
  updatePosition()
  setOpen(true)
}

function hideSoon() {
  clearTimers()
  closeTimer = window.setTimeout(() => setOpen(false), props.closeDelay)
}

function toggle() {
  clearTimers()
  if (open.value) setOpen(false)
  else show()
}

watch(open, (isOpen) => {
  if (isOpen) {
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
  } else {
    window.removeEventListener('scroll', updatePosition, true)
    window.removeEventListener('resize', updatePosition)
  }
})

onBeforeUnmount(() => {
  clearTimers()
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
})
</script>

<template>
  <span
    ref="triggerRef"
    class="hover-card-anchor"
    @mouseenter="show"
    @mouseleave="hideSoon"
    @focusin="show"
    @focusout="hideSoon"
  >
    <slot name="trigger">
      <button
        type="button"
        :class="['hover-card-trigger', { 'is-open': open }]"
        :aria-label="triggerLabel"
        :aria-expanded="open"
        :disabled="disabled"
        v-html="INFO_ICON"
        @click="toggle"
      ></button>
    </slot>
  </span>
  <Teleport to="body">
    <div
      v-if="open"
      class="hover-card"
      role="tooltip"
      :style="{ top: pos.top + 'px', left: pos.left + 'px' }"
      @mouseenter="show"
      @mouseleave="hideSoon"
    >
      <div class="hover-card-arrow" aria-hidden="true" />
      <div v-if="title || meta" class="hover-card-head">
        <div v-if="title" class="hover-card-title">{{ title }}</div>
        <div v-if="meta" class="hover-card-meta">{{ meta }}</div>
      </div>
      <div class="hover-card-body">
        <slot />
      </div>
    </div>
  </Teleport>
</template>
