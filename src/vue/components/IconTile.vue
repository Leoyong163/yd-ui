<script setup lang="ts">
import Icon from './Icon.vue'

withDefaults(defineProps<{ name: string; tone?: string; size?: 'sm' | 'lg' }>(), {
  tone: 'blue',
})
</script>

<template>
  <span :class="`icon-tile icon-tile-${tone}${size ? ` icon-tile-${size}` : ''}`" aria-hidden="true">
    <Icon :name="name" />
  </span>
</template>
