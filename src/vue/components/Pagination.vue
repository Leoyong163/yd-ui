<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ page: number; pageSize: number; total: number }>()
const emit = defineEmits<{ (e: 'update:page', page: number): void; (e: 'update:pageSize', pageSize: number): void }>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const pageNumbers = computed(() => Array.from({ length: Math.min(5, totalPages.value) }, (_, i) => i + 1))
</script>

<template>
  <div class="pagination">
    <div class="pagination-info">{{ `共 ${total} 条，第 ${page}/${totalPages} 页` }}</div>
    <div class="pagination-pages">
      <button type="button" class="page-btn" :disabled="page <= 1" @click="emit('update:page', page - 1)">上一页</button>
      <button
        v-for="n in pageNumbers"
        :key="n"
        type="button"
        :class="`page-btn${n === page ? ' active' : ''}`"
        @click="emit('update:page', n)"
      >{{ n }}</button>
      <button type="button" class="page-btn" :disabled="page >= totalPages" @click="emit('update:page', page + 1)">下一页</button>
    </div>
    <div class="pagination-size">
      <label>每页</label>
      <select class="select" aria-label="每页条数" :value="pageSize" @change="emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))">
        <option v-for="n in [10, 20, 50]" :key="n" :value="n">{{ n }}</option>
      </select>
      <span>条</span>
    </div>
    <div class="pagination-jump">
      <label>跳至</label>
      <input type="number" class="input" :min="1" :max="totalPages" :value="page" aria-label="跳转页码" style="width: 64px" />
      <span>页</span>
    </div>
  </div>
</template>
