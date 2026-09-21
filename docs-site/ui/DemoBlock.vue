<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    desc?: string
    code?: string
    /** 预览区改为块级布局（适合树、分页这类需要整行宽度的演示） */
    block?: boolean
    /** 预览区去掉点阵底纹（全宽控件不需要） */
    plain?: boolean
  }>(),
  { desc: '', code: '', block: false, plain: false },
)

const showCode = ref(false)
const copied = ref(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(props.code || '')
    copied.value = true
    window.setTimeout(() => (copied.value = false), 1400)
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <div class="demo-block">
    <div class="demo-block-head">
      <span class="demo-block-title">{{ title }}</span>
    </div>
    <div v-if="desc" class="demo-block-desc">{{ desc }}</div>
    <div :class="['demo-stage', { 'is-block': block }]" :style="plain ? 'background-image:none' : ''">
      <slot />
    </div>
    <div class="demo-actions">
      <button type="button" class="demo-act" @click="showCode = !showCode">
        {{ showCode ? '收起代码' : '查看代码' }}
      </button>
      <button type="button" class="demo-act" @click="copy">{{ copied ? '已复制' : '复制' }}</button>
    </div>
    <pre v-if="showCode" class="demo-code"><code>{{ code }}</code></pre>
  </div>
</template>
