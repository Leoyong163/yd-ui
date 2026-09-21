<script setup lang="ts">
import { computed } from 'vue'
import { statusTagClass } from '../../core/contract/tag-class'

const props = defineProps<{ status: string }>()
const cls = computed(() => statusTagClass(props.status))
</script>

<template>
  <span :class="`tag ${cls}`">{{ status }}</span>
</template>
