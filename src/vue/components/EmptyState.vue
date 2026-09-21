<script setup lang="ts">
withDefaults(defineProps<{ title?: string; desc?: string }>(), { title: '暂无数据', desc: '' })

const EMPTY_ICON = `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="8" y="12" width="32" height="28" rx="2"/><path d="M16 12V10a8 8 0 0116 0v2M18 24h12M18 30h8"/></svg>`
</script>

<template>
  <div class="empty-state">
    <div v-html="EMPTY_ICON"></div>
    <h3>{{ title }}</h3>
    <p v-if="desc">{{ desc }}</p>
  </div>
</template>
