<script setup lang="ts">
import { computed } from 'vue'
import { urgencyTagClass } from '../../core/contract/tag-class'

const props = defineProps<{ level: string }>()
const cls = computed(() => urgencyTagClass(props.level))
</script>

<template>
  <span :class="`tag ${cls}`">{{ level }}</span>
</template>
