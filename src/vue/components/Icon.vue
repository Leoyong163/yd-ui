<script setup lang="ts">
import { computed } from 'vue'
import { icons } from '../../core/icons/icons'

const props = defineProps<{ name: string; className?: string }>()

const svg = computed(() => icons[props.name] || '')
</script>

<template>
  <span v-if="svg" :class="className" aria-hidden="true" v-html="svg"></span>
</template>
