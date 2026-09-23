<script setup lang="ts">
/**
 * PortalMenu —— 锚点浮层容器。
 *
 * 从宿主 `src/pages/role-form/PortalMenu.vue` 抽出（P3 抽取），去掉业务语义后只剩两件事：
 *   1. 把内容 Teleport 到 body，并跟随锚点元素定位（滚动 / 缩放时重算）；
 *   2. 点外部关闭。
 *
 * 为什么定位数学留在组件里而不是 CSS：它是**几何**（跟着锚点的实时 rect 走），
 * 不是视觉配方。盒子外观（边框 / 圆角 / 背景 / 阴影 / 滚动）全在 `.portal-menu`，
 * 这样原生侧只要自己算好 top/left 就能拿到完全一样的外观。
 *
 * 相比宿主版本修掉一处泄漏：原实现只在 unmount 时解绑 scroll/resize，
 * 关闭菜单后监听器仍挂着（每次开关都叠加一对）。这里在关闭时即解绑。
 */
import { ref, watch, onBeforeUnmount, type PropType } from 'vue'

defineOptions({ name: 'PortalMenu', inheritAttrs: false })

const props = defineProps({
  open: { type: Boolean, required: true },
  anchorEl: { type: Object as PropType<HTMLElement | null>, default: null },
  width: { type: Number, default: undefined },
  minWidth: { type: Number, default: 160 },
  align: { type: String as PropType<'left' | 'right'>, default: 'left' },
  role: { type: String, default: 'listbox' },
})

const emit = defineEmits<{ (e: 'close'): void }>()

const menuRef = ref<HTMLDivElement | null>(null)
const rect = ref<DOMRect | null>(null)

function update() {
  if (props.anchorEl) rect.value = props.anchorEl.getBoundingClientRect()
}

function bind() {
  window.addEventListener('scroll', update, true)
  window.addEventListener('resize', update)
}
function unbind() {
  window.removeEventListener('scroll', update, true)
  window.removeEventListener('resize', update)
}

watch(
  () => [props.open, props.anchorEl] as const,
  ([isOpen, anchorEl]) => {
    if (!isOpen || !anchorEl) {
      rect.value = null
      unbind()
      return
    }
    update()
    bind()
  },
  { immediate: true },
)

function handleMouseDown(event: MouseEvent) {
  if (!props.open) return
  const target = event.target as Node
  if (menuRef.value?.contains(target) || props.anchorEl?.contains(target)) return
  emit('close')
}

document.addEventListener('mousedown', handleMouseDown)

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleMouseDown)
  unbind()
})

const menuWidth = () => props.width ?? Math.max(props.minWidth, rect.value?.width ?? 0)
const leftPos = () => {
  if (!rect.value) return 0
  const mw = menuWidth()
  return props.align === 'right'
    ? Math.max(8, rect.value.right - mw)
    : Math.min(rect.value.left, window.innerWidth - mw - 8)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && rect"
      ref="menuRef"
      class="portal-menu"
      :role="role"
      :style="{
        top: rect.bottom + 4 + 'px',
        left: leftPos() + 'px',
        width: menuWidth() + 'px',
        margin: 0,
      }"
    >
      <slot />
    </div>
  </Teleport>
</template>
