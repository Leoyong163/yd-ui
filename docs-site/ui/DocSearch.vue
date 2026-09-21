<script setup lang="ts">
import { computed } from 'vue'

const model = defineModel<string>({ default: '' })
const value = computed({
  get: () => model.value,
  set: (v: string) => (model.value = v),
})
const SEARCH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3" stroke-linecap="round"/></svg>`
</script>

<template>
  <label class="doc-search">
    <span class="doc-search-icon" aria-hidden="true" v-html="SEARCH_ICON"></span>
    <input
      v-model="value"
      class="input"
      type="search"
      placeholder="搜索组件…"
      aria-label="搜索组件"
    />
  </label>
</template>
