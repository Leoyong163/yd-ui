<script setup lang="ts">
import { computed } from 'vue'
import { KPI_ASSETS } from '../../core/contract/kpi-assets'

const props = defineProps<{ kpiKey: string }>()
const src = computed(() => KPI_ASSETS[props.kpiKey])
</script>

<template>
  <img class="kpi-asset" :src="src" alt="" width="40" height="40" draggable="false" />
</template>
