<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'

withDefaults(defineProps<{ title: string; size?: 'sm' | 'lg' | 'xl' }>(), {})
const emit = defineEmits<{ (e: 'close'): void }>()

const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg>`

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <div class="modal-backdrop" @click="onBackdropClick">
    <div :class="`modal ${size ? `modal-${size}` : ''}`" role="dialog" aria-modal="true" :aria-label="title">
      <div class="modal-header">
        <div class="modal-title">{{ title }}</div>
        <button type="button" class="modal-close" aria-label="关闭" @click="emit('close')" v-html="CLOSE_ICON"></button>
      </div>
      <div class="modal-body">
        <slot />
      </div>
      <div v-if="$slots.footer" class="modal-footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>
