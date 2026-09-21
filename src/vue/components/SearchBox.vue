<script setup lang="ts">
withDefaults(defineProps<{ placeholder?: string }>(), { placeholder: '搜索' })

const SEARCH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3" stroke-linecap="round"/></svg>`
</script>

<template>
  <div class="search-box">
    <span class="search-icon" aria-hidden="true" v-html="SEARCH_ICON"></span>
    <input type="search" class="input" :placeholder="placeholder" :aria-label="placeholder" />
  </div>
</template>
