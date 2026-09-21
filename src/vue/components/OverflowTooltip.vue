<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, watch } from 'vue'
import { Tooltip } from 'ant-design-vue'

const props = withDefaults(
  defineProps<{ text: string; className?: string; force?: boolean }>(),
  { className: '', force: false },
)

const textRef = ref<HTMLElement | null>(null)
const isOverflowing = ref(false)
const open = ref(false)

let observer: ResizeObserver | null = null
let frame1 = 0
let frame2 = 0
const timers: number[] = []

function measureOverflow(el: HTMLElement | null): boolean {
  if (!el) return false
  if (el.clientWidth <= 0) return false
  return el.scrollWidth - el.clientWidth > 0.5
}

function checkOverflow() {
  const next = measureOverflow(textRef.value)
  isOverflowing.value = next
  return next
}

function schedule() {
  window.cancelAnimationFrame(frame1)
  window.cancelAnimationFrame(frame2)
  frame1 = window.requestAnimationFrame(() => {
    checkOverflow()
    frame2 = window.requestAnimationFrame(() => checkOverflow())
  })
}

function setup() {
  schedule()
  timers.push(window.setTimeout(schedule, 80))
  timers.push(window.setTimeout(schedule, 200))

  observer?.disconnect()
  observer = new ResizeObserver(() => schedule())
  if (textRef.value) {
    observer.observe(textRef.value)
    let parent: HTMLElement | null = textRef.value.parentElement
    for (let i = 0; i < 3 && parent; i += 1) {
      observer.observe(parent)
      parent = parent.parentElement
    }
  }
  window.addEventListener('resize', schedule)
}

onMounted(setup)
watch(() => [props.text, props.className, props.force], setup)

onBeforeUnmount(() => {
  window.cancelAnimationFrame(frame1)
  window.cancelAnimationFrame(frame2)
  timers.forEach((t) => window.clearTimeout(t))
  observer?.disconnect()
  window.removeEventListener('resize', schedule)
})

function tryOpen() {
  if (props.force || checkOverflow()) open.value = true
  else open.value = false
}

function onMouseLeave() {
  open.value = false
}

function onOpenChange(next: boolean) {
  if (!next) {
    open.value = false
    return
  }
  tryOpen()
}
</script>

<template>
  <Tooltip
    :open="open"
    :mouse-enter-delay="0.08"
    placement="top"
    overlay-class-name="overflow-tooltip-overlay"
    @open-change="onOpenChange"
  >
    <template #title>{{ text }}</template>
    <div
      ref="textRef"
      :class="className"
      :data-overflow="isOverflowing ? 'true' : 'false'"
      style="max-width: 100%; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis"
      @mouseenter="tryOpen"
      @mouseleave="onMouseLeave"
    >
      {{ text }}
    </div>
  </Tooltip>
</template>
