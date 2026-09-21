<script setup lang="ts">
/**
 * 文档站外壳。
 *
 * 形态对齐 antd / tdesign 的组件文档：顶部栏 + 左侧分组导航 + 右侧「预览 / 代码 / API」。
 * 数据源是库里的 `schema/components.json` —— 也就是说这一页和 AI agent 读的是同一份契约，
 * 不存在「文档和实际组件对不上」的问题。
 */
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import manifest from '@yd/schema/components.json'
import { lightTokens, darkTokens } from '@yd/ui/core/theme/tokens'
import { Icon } from '@yd/ui'
import DemoBlock from './ui/DemoBlock.vue'
import DocSearch from './ui/DocSearch.vue'
import { RENDERERS } from './data/renderers'

type PropRow = { name: string; type: string; required?: boolean; default?: string; desc: string }
type ComponentDoc = {
  name: string
  title: string
  group: string
  status: string
  desc: string
  props: PropRow[]
  slots: { name: string; desc: string }[]
  events: { name: string; payload: string; desc: string }[]
  a11y?: string[]
  demos: { title: string; desc?: string; code: string }[]
  /**
   * 原生 HTML 侧有没有等价写法。
   *
   * `available: false` 不是缺陷，是**设计决定** —— 说明这条需求属「行为」而非「样式」，
   * 因此不属于零框架层。OverflowTooltip 就是这一类（要测量 DOM 才知道有没有被截断）。
   * 把这类用例显式写出来，比留白更有用：它划清了 core 的边界在哪。
   */
  native?: { available: boolean; code?: string; note: string }
}

const components = manifest.components as unknown as ComponentDoc[]
const groups = manifest.groups as { key: string; title: string }[]
const pending = manifest.pending as { group: string; items: string[]; note: string }[]
const knownGaps = manifest.knownGaps as string[]

/* ---------- 路由（hash，避免引入 vue-router） ---------- */
const GUIDES = [
  { key: 'overview', title: '概述' },
  { key: 'start', title: '快速开始' },
  { key: 'html', title: '原生 HTML' },
  { key: 'tokens', title: '设计令牌' },
  { key: 'architecture', title: '架构与迁移' },
  { key: 'ai', title: 'AI 接入' },
]

const route = ref('guide/overview')
function readHash() {
  const raw = (window.location.hash || '').replace(/^#\/?/, '')
  route.value = raw || 'guide/overview'
}
onMounted(() => {
  readHash()
  window.addEventListener('hashchange', readHash)
})
onBeforeUnmount(() => window.removeEventListener('hashchange', readHash))
function go(to: string) {
  window.location.hash = '/' + to
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const activeComponent = computed(() => {
  const m = /^component\/(.+)$/.exec(route.value)
  return m ? components.find((c) => c.name === m[1]) ?? null : null
})
const activeGuide = computed(() => {
  const m = /^guide\/(.+)$/.exec(route.value)
  return m ? m[1] : null
})

/* ---------- 主题 ---------- */
const theme = ref<'light' | 'dark'>('light')
function applyTheme() {
  document.documentElement.dataset.theme = theme.value
}
function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  applyTheme()
}
onMounted(applyTheme)

/* ---------- 搜索 ---------- */
const query = ref('')
const navModel = computed(() =>
  groups.map((g) => ({
    ...g,
    items: components
      .filter((c) => c.group === g.key)
      .filter((c) => {
        const q = query.value.trim().toLowerCase()
        if (!q) return true
        return (
          c.name.toLowerCase().includes(q) ||
          c.title.includes(q) ||
          c.desc.toLowerCase().includes(q)
        )
      }),
  })),
)
const guideHits = computed(() =>
  GUIDES.filter((g) => !query.value.trim() || g.title.includes(query.value.trim())),
)

/* ---------- 令牌页 ---------- */
const COLOR_KEYS: string[][] = [
  ['品牌', ['primary', 'primary-hover', 'primary-active', 'primary-soft', 'primary-soft-2', 'primary-border', 'primary-glow', 'cyan', 'cyan-soft', 'purple', 'purple-soft']],
  ['辅助色', ['color-blue', 'color-indigo', 'color-magenta', 'color-pink', 'color-yellow', 'color-lime', 'color-orange', 'color-red']],
  ['语义', ['success', 'success-soft', 'warning', 'warning-soft', 'danger', 'danger-soft', 'info', 'info-soft']],
  ['背景与容器', ['bg-1', 'bg-2', 'bg-3', 'bg', 'bg-elevated', 'bg-muted', 'bg-hover', 'bg-active', 'surface', 'surface-2', 'surface-3', 'glass', 'glass-border']],
  ['文字', ['text', 'text-secondary', 'text-muted', 'text-disabled', 'text-inverse']],
  ['图标', ['icon-1', 'icon-2', 'icon-3']],
  ['描边', ['border', 'border-strong', 'divider']],
]
const SCALAR_GROUPS: { title: string; match: (k: string) => boolean }[] = [
  { title: '间距（4px 基准）', match: (k) => k.startsWith('space-') },
  { title: '字号与行高', match: (k) => k.startsWith('fs-') || k.startsWith('lh-') },
  { title: '字重与字距', match: (k) => k.startsWith('weight-') || k.startsWith('tracking-') || k.startsWith('leading-') },
  { title: '圆角与控件高度', match: (k) => k.startsWith('radius') || k.startsWith('control-h') },
  { title: '阴影与焦点环', match: (k) => k.startsWith('shadow-') || k === 'focus-ring' },
  { title: '布局', match: (k) => k.startsWith('sidebar-') },
  { title: '动效', match: (k) => k.startsWith('ease-') || k.startsWith('transition') },
  { title: '层级', match: (k) => k.startsWith('z-') },
  { title: '字体族', match: (k) => k.startsWith('font') },
]
const colorKeysFlat = COLOR_KEYS.flatMap(([, ks]) => ks)
const scalarGroups = computed(() =>
  SCALAR_GROUPS.map((g) => ({
    title: g.title,
    rows: Object.entries(lightTokens).filter(([k]) => !colorKeysFlat.includes(k) && g.match(k)),
  })).filter((g) => g.rows.length),
)
function darkOf(key: string) {
  const d = darkTokens[key]
  const l = lightTokens[key]
  return d && d !== l ? d : ''
}
const lightCount = Object.keys(lightTokens).length
const darkCount = Object.keys(darkTokens).length
const darkOnlyCount = Object.keys(darkTokens).filter(
  (k) => darkTokens[k] !== (lightTokens as Record<string, string>)[k],
).length

/* ---------- 演示渲染 ---------- */
function rendererOf(name: string, index: number) {
  return RENDERERS[`${name}::${index}`]
}

/**
 * 哪些组件的预览区要用块级布局。
 *
 * 判据有两条：
 *   ① 组件本身需要整行宽度（树、分页）—— 放在 flex 里会被挤成窄条；
 *   ② 组件的计算样式会因外层是 flex 而变（flex 会把子元素的 display 块化、
 *      并让 min-height:auto 解析为内容最小值）。EmptyState 属这条：
 *      它是居中块，放 flex 里 min-height 就变成 auto，与它在普通块里的取值不一致，
 *      会让「原生 HTML 与 Vue 渲染一致」的比对出现恒定假差异。
 */
function needsBlockStage(name: string) {
  return ['PermissionTree', 'PermissionTreeRows', 'Pagination', 'EmptyState'].includes(name)
}

/**
 * 极简行内 Markdown：只认 `code` 与 **粗体** —— components.json 的 native.note 里只用这两类标记。
 *
 * 顺序很重要：**先转义、再替换标记**。note 里会出现 <span> / <use> 这类片段，
 * 不先转义就会被当成真标签插进 DOM，轻则布局乱掉，重则变成注入点。
 */
function mdInline(s: string) {
  const escaped = String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
}

/* ---------- 一键复制 ---------- */
const copiedKey = ref('')
async function copyText(text: string, key: string) {
  try {
    await navigator.clipboard.writeText(text)
    copiedKey.value = key
    window.setTimeout(() => (copiedKey.value = ''), 1400)
  } catch {
    copiedKey.value = ''
  }
}

/* ---------- 归属分层：core（零框架） → vue（组件） → 宿主 ---------- */
const archCore = [
  { label: '令牌层', file: 'core/styles/tokens.css', chips: [`${lightCount} 个亮色令牌`, `${darkCount} 个暗色覆盖`] },
  { label: '基础层', file: 'core/styles/base.css', chips: ['reset', '排版角色', '滚动条', '焦点环', 'reduced-motion'] },
  { label: '控件配方层', file: 'core/styles/components.css', chips: ['btn*', 'tag*', 'card*', 'table*', 'form-*', 'tree*', 'pagination*', 'modal*', 'tabs*', 'ant-* 主题'] },
  { label: '图标与素材', file: 'core/icons/ · core/assets/', chips: ['icons.ts（41 个符号）', 'kpi-*.png ×4'] },
  { label: '契约映射', file: 'core/contract/', chips: ['tag-class.ts', 'tree.ts', 'assets-manifest.ts', 'skin-hooks.ts'] },
  { label: '令牌真源', file: 'core/theme/tokens.ts', chips: ['生成 → core/styles/tokens.css'] },
]
const archVue = [
  { label: '组件', file: 'vue/components/*.vue', chips: components.map((c) => c.name) },
]
const archHost = [
  { label: '布局层', file: 'demo1/layout.css', chips: ['sidebar*', 'main-wrap', 'topbar', 'grid'] },
  { label: '页面层', file: 'demo1/pages.css', chips: ['col-panel*', 'list-item*', 'file-*', 'flow-*', 'stat-*', 'role-*', 'approval-*'] },
  { label: '宿主残余', file: 'demo1/components.css', chips: ['drawer*', 'toast*', 'chip*', 'segment*', 'timeline*', 'skeleton*', 'upload-zone'] },
  { label: '业务规则', file: 'shared.ts', chips: ['riskLevel(3天/7天阈值)'] },
  { label: '动画', file: 'demo1/animations.css', chips: ['进出场', '关键帧'] },
]
/* 皮肤钩子：库输出类名、宿主给样式。目前只有一处，必须登记在案。 */
const skinHooks = [{ cls: 'tree-toolbar-btn', by: 'pages.css', why: '权限树工具条按钮的皮肤' }]
</script>

<template>
  <div class="doc-root">
    <!-- ============ 顶部栏 ============ -->
    <header class="doc-header">
      <div class="doc-brand" @click="go('guide/overview')">
        <span class="brand-mark"><Icon name="brand" /></span>
        <span class="doc-brand-name">YD Design</span>
        <span class="doc-version">@yd/ui v{{ manifest.version }}</span>
      </div>
      <div class="doc-header-spacer"></div>
      <div class="doc-header-search">
        <DocSearch v-model="query" />
      </div>
      <button type="button" class="doc-theme-btn" :title="theme === 'dark' ? '切到亮色' : '切到暗色'" @click="toggleTheme">
        <Icon :name="theme === 'dark' ? 'sunOutline' : 'moonOutline'" />
      </button>
    </header>

    <div class="doc-body">
      <!-- ============ 侧栏 ============ -->
      <aside class="doc-sider">
        <div v-if="guideHits.length" class="doc-nav-group">
          <div class="doc-nav-group-title">指南</div>
          <button
            v-for="g in guideHits"
            :key="g.key"
            type="button"
            :class="['doc-nav-item', { active: activeGuide === g.key }]"
            @click="go('guide/' + g.key)"
          >{{ g.title }}</button>
        </div>
        <div v-for="grp in navModel" :key="grp.key" class="doc-nav-group">
          <div class="doc-nav-group-title">{{ grp.title }}</div>
          <button
            v-for="c in grp.items"
            :key="c.name"
            type="button"
            :class="['doc-nav-item', { active: activeComponent?.name === c.name }]"
            @click="go('component/' + c.name)"
          >
            <span>{{ c.title }}</span>
            <span class="nav-badge">{{ c.name }}</span>
          </button>
        </div>
      </aside>

      <!-- ============ 内容 ============ -->
      <main class="doc-content">
        <!-- ---------- 组件页 ---------- -->
        <template v-if="activeComponent">
          <h1 class="doc-page-title">
            {{ activeComponent.title }}
            <span class="tag-soft is-lib">已入库</span>
          </h1>
          <div class="doc-page-sub">{{ activeComponent.name }} · {{ manifest.package }} v{{ manifest.version }}</div>
          <p class="doc-lead">{{ activeComponent.desc }}</p>

          <template v-for="(d, i) in activeComponent.demos" :key="i">
            <DemoBlock
              :title="d.title"
              :desc="d.desc"
              :code="d.code"
              :block="needsBlockStage(activeComponent.name)"
              :plain="needsBlockStage(activeComponent.name)"
            >
              <component :is="rendererOf(activeComponent.name, i)" v-if="rendererOf(activeComponent.name, i)" />
              <span v-else class="tag-soft is-gap">此演示暂无可跑实现</span>
            </DemoBlock>
          </template>

          <!-- ---------- 原生 HTML 侧：同一套类名 ---------- -->
          <template v-if="activeComponent.native">
            <h2 class="doc-h2">原生 HTML 等价写法</h2>
            <div :class="['nat', { 'is-none': !activeComponent.native.available }]">
              <div class="nat-head">
                <span :class="['nat-badge', activeComponent.native.available ? 'is-yes' : 'is-no']">
                  {{ activeComponent.native.available ? 'core 层有等价写法' : 'core 层没有，且不应有' }}
                </span>
                <span class="doc-page-sub" style="margin: 0">
                  不装 Vue、不跑构建 —— 只引 dist-lite 的 CSS 与本套类名
                </span>
              </div>
              <div class="nat-note" v-html="mdInline(activeComponent.native.note)"></div>
              <pre v-if="activeComponent.native.code" class="demo-code"><code>{{ activeComponent.native.code }}</code></pre>
            </div>
          </template>

          <h2 class="doc-h2">API</h2>

          <h3 class="doc-h3">Props</h3>
          <div class="doc-table-wrap">
            <table class="doc-table">
              <thead>
                <tr><th style="width:180px">参数</th><th style="width:260px">类型</th><th style="width:120px">默认值</th><th>说明</th></tr>
              </thead>
              <tbody>
                <tr v-for="p in activeComponent.props" :key="p.name">
                  <td><code>{{ p.name }}</code><span v-if="p.required" class="req-dot" title="必填"></span></td>
                  <td class="type-cell"><code>{{ p.type }}</code></td>
                  <td><code>{{ p.default ?? '—' }}</code></td>
                  <td>{{ p.desc }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <template v-if="activeComponent.events.length">
            <h3 class="doc-h3">Events</h3>
            <div class="doc-table-wrap">
              <table class="doc-table">
                <thead><tr><th style="width:200px">事件</th><th style="width:140px">参数</th><th>说明</th></tr></thead>
                <tbody>
                  <tr v-for="e in activeComponent.events" :key="e.name">
                    <td><code>{{ e.name }}</code></td><td><code>{{ e.payload }}</code></td><td>{{ e.desc }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

          <template v-if="activeComponent.slots.length">
            <h3 class="doc-h3">Slots</h3>
            <div class="doc-table-wrap">
              <table class="doc-table">
                <thead><tr><th style="width:200px">插槽</th><th>说明</th></tr></thead>
                <tbody>
                  <tr v-for="s in activeComponent.slots" :key="s.name">
                    <td><code>{{ s.name }}</code></td><td>{{ s.desc }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

          <template v-if="activeComponent.a11y?.length">
            <h3 class="doc-h3">无障碍</h3>
            <div class="callout is-info">
              <div>
                <div v-for="(a, i) in activeComponent.a11y" :key="i">· {{ a }}</div>
              </div>
            </div>
          </template>

          <h3 class="doc-h3">引入</h3>
          <pre class="demo-code"><code>{{ `import { ${activeComponent.name} } from '@yd/ui'` }}</code></pre>
        </template>

        <!-- ---------- 指南：概述 ---------- -->
        <template v-else-if="activeGuide === 'overview'">
          <h1 class="doc-page-title">概述</h1>
          <div class="doc-page-sub">{{ manifest.title }} · {{ manifest.stage }}</div>
          <p class="doc-lead">
            这套组件库把「权限自助门户」里的控件配方、设计令牌与 12 个组件从宿主应用里抽了出来，
            让它们可以被单独引用、单独演进，也能被 AI 编码助手读懂。
            抽取的目标不是重构，而是<strong>零视觉变化地把所有权讲清楚</strong>。
          </p>

          <div class="stat-row">
            <div class="stat-box"><div class="v">{{ components.length }}</div><div class="k">组件（vue 层）</div></div>
            <div class="stat-box"><div class="v">2</div><div class="k">结构层：core 零框架 / vue</div></div>
            <div class="stat-box"><div class="v">128</div><div class="k">类名（core 层契约，自动生成）</div></div>
            <div class="stat-box"><div class="v is-ok">0</div><div class="k">回归基线差异（DIFF_TOTAL）</div></div>
          </div>

          <div class="callout is-ok">
            <div>
              <b>两层不是靠约定，是靠门禁。</b> core 不得依赖 vue、组件不得带 <code>&lt;style&gt;</code>、
              模板不得用契约外的类名 —— 三条都有命令守，违反即失败。
              而「两层的视觉是同一份」这件事，用真实浏览器逐属性比对来证明。
              详见「<a href="#/guide/html" style="color:var(--primary)">原生 HTML</a>」与
              「<a href="#/guide/architecture" style="color:var(--primary)">架构与迁移</a>」。
            </div>
          </div>

          <div class="callout is-ok">
            <div>
              <b>搬迁已完成且可复核。</b> 30 组快照（5 页 × 3 视口 × 亮/暗）、6630 个元素的逐属性样式指纹，
              搬迁前后比对 <code>DIFF_TOTAL = 0</code>（新增 / 删除 / 样式 / 几何 / 计数 全部为 0）。
              也就是说这一整套拆分对界面是<strong>像素级无影响</strong>的。
            </div>
          </div>

          <h2 class="doc-h2">这一版做了什么</h2>
          <div class="doc-table-wrap">
            <table class="doc-table">
              <thead><tr><th style="width:110px">阶段</th><th style="width:190px">任务</th><th>结果</th></tr></thead>
              <tbody>
                <tr><td>P1-T1/T2</td><td>建库工程 + 宿主接入</td><td><code>@yd/ui</code> 包建成；宿主通过 Vite alias 直引库源码，改库即改宿主，无需发布或同步脚本</td></tr>
                <tr><td>P1-T3</td><td>拆 shared.ts</td><td>控件语义（标签映射 / 树类型 / KPI 资产）入库；业务规则 <code>riskLevel</code> 留宿主</td></tr>
                <tr><td>P1-T4</td><td>迁 icons.ts</td><td>图标集整体入库，宿主改为 re-export</td></tr>
                <tr><td>P1-T5</td><td>迁 tokens.ts</td><td>令牌真源与生成器入库，宿主 <code>gen:tokens</code> 转发</td></tr>
                <tr><td>P1-T6</td><td>样式三层分层</td><td><code>components.css</code> 拆成库控件配方（202 条规则）+ 宿主残余（103 条），零人工裁决残留</td></tr>
                <tr><td>P1-T7 + P2</td><td>公开出口 + 组件搬迁</td><td>12 个组件全部入库，21 处引用机械改写，宿主不再保留组件副本</td></tr>
                <tr><td>P2 · 分层</td><td>物理两层 core / vue</td><td>样式、图标、素材、契约映射移到 <code>core/</code>；12 个 SFC 移到 <code>vue/</code>。依赖方向锁死为单向，由门禁守</td></tr>
                <tr><td>P2 · 契约</td><td>类名契约与门禁</td><td>自动生成 <code>class-contract.json</code>（27 家族 / 128 类名）；<code>check-layering</code> 6 条规则 + 14 项自检</td></tr>
                <tr><td>P2 · 直引</td><td>零构建包 dist-lite</td><td>三层 CSS 合并 + 41 符号 sprite + 素材 + 清单；原生示例页零 Vue、零构建可用</td></tr>
                <tr><td>P2 · 验证</td><td>两层一致性实测</td><td><code>vanilla-parity</code> 真浏览器逐属性比对 25 组选择器 × 26 属性，全数一致</td></tr>
              </tbody>
            </table>
          </div>

          <h2 class="doc-h2">怎么读这套文档</h2>
          <p class="doc-p">
            左侧「组件」分组下每个页面都是同一结构：<strong>实时预览 → 可复制代码 → API 表</strong>。
            预览用的是真正从库里 import 进来的组件，不是截图或手写的静态 HTML —— 所以只要这一页显示正常，
            就说明库能被独立引用。
          </p>
          <p class="doc-p">
            「AI 接入」一页说明怎么让 VSCode 里的 Copilot / Claude 之类助手按这套规范生成代码。
          </p>
        </template>

        <!-- ---------- 指南：快速开始 ---------- -->
        <template v-else-if="activeGuide === 'start'">
          <h1 class="doc-page-title">快速开始</h1>
          <div class="doc-page-sub">三步接入一个新前端项目</div>

          <h2 class="doc-h2">1. 引样式</h2>
          <p class="doc-p">
            三条 <code class="doc-code-inline">@import</code> 的<strong>位置就是级联顺序</strong>，
            而且必须全部排在你自己页面样式之前。顺序反转会让页面级的上下文覆盖静默失效（不报错、只是长得不对）。
          </p>
          <pre class="demo-code"><code>/* 你的入口 CSS */
@import '@yd/ui/core/styles/tokens.css';      /* 设计令牌 */
@import '@yd/ui/core/styles/base.css';        /* reset + 排版角色 */
@import '@yd/ui/core/styles/components.css';  /* 控件配方 */
/* ↓ 再引你自己的 */
@import './your-pages.css';</code></pre>

          <h2 class="doc-h2">2. 引组件</h2>
          <pre class="demo-code"><code>import { Modal, StatusTag, PermissionTree } from '@yd/ui'</code></pre>
          <p class="doc-p">
            peer 依赖只有两个：<code class="doc-code-inline">vue ^3.4</code> 与
            <code class="doc-code-inline">ant-design-vue ^4.2</code>（仅 OverflowTooltip 用到）。
            两个都标成了 <b>optional</b> —— 因为只有 <code class="doc-code-inline">vue/</code> 层需要它们；
            只消费 <code class="doc-code-inline">core/</code>（原生 HTML、静态页、别的框架）不必安装。
          </p>

          <h2 class="doc-h2">3. 直接用类名（不用组件时）</h2>
          <p class="doc-p">
            库的视觉由全局类名驱动，所以「只用类名不用组件」完全可行，而且这是推荐做法。
            这也是两层结构的入口：<b>用组件</b>和<b>用类名</b>拿到的是同一个视觉，因为 CSS 只有一份。
            不装 Vue 的完整接法见「<a href="#/guide/html" style="color:var(--primary)">原生 HTML</a>」一页。
          </p>
          <pre class="demo-code"><code>&lt;button class="btn btn-primary"&gt;提交&lt;/button&gt;
&lt;span class="tag tag-pending"&gt;待审批&lt;/span&gt;
&lt;div class="card"&gt;
  &lt;div class="card-header"&gt;&lt;div class="card-title"&gt;标题&lt;/div&gt;&lt;/div&gt;
  &lt;div class="card-body"&gt;…&lt;/div&gt;
&lt;/div&gt;</code></pre>

          <div class="callout is-warn">
            <div>
              <b>三条禁令</b>（违反会在评审打回）：<br />
              ① 库不得 import 宿主任何模块 —— 禁止反向依赖；<br />
              ② 组件不得带 <code>&lt;style&gt;</code> 块 —— 样式一律进 <code>styles/</code> 的对应层；<br />
              ③ 库不得写死业务规则（如到期风险阈值）—— 业务规则留宿主。
            </div>
          </div>

          <h2 class="doc-h2">本地开发这套库</h2>
          <pre class="demo-code"><code># 首次：装构建依赖（本文档站要靠它自己跑起来）
pnpm install

# 改令牌真源 → 重新生成 tokens.css
npm run gen:tokens

# 只校验是否同步（CI 用，退出码 1 表示不同步）
npm run check:tokens

# 打开本文档站：它就在本仓库里，不需要任何宿主
npm run docs                       # → http://localhost:5174/</code></pre>
        </template>

        <!-- ---------- 指南：原生 HTML / 两层结构 ---------- -->
        <template v-else-if="activeGuide === 'html'">
          <h1 class="doc-page-title">原生 HTML · 两层结构</h1>
          <div class="doc-page-sub">不装 Vue、不跑构建，只用类名 —— 以及为什么这样能成立</div>
          <p class="doc-lead">
            库分两层：<code class="doc-code-inline">core</code>（零框架）与 <code class="doc-code-inline">vue</code>（12 个组件）。
            <strong>两层的视觉是同一份定义</strong> —— 所以「用 Vue 组件」和「手写 HTML」不是两套东西，
            而是同一套类名的两种消费方式。这一页讲原生那一侧怎么用，以及边界在哪。
          </p>

          <h2 class="doc-h2">为什么能共用</h2>
          <p class="doc-p">
            因为库有一条硬约束：<b>组件自身不带 <code class="doc-code-inline">&lt;style&gt;</code></b>。
            所有外观都写在 <code class="doc-code-inline">core/styles/components.css</code> 的类名配方里，
            组件只负责<strong>拼类名</strong>。看 StatusTag 的全貌就明白了：
          </p>
          <pre class="demo-code"><code>&lt;!-- vue 层：StatusTag.vue 的全部视觉逻辑 --&gt;
&lt;script setup&gt;
import { statusTagClass } from '../../core/contract/tag-class'
&lt;/script&gt;
&lt;template&gt;
  &lt;span :class="`tag ${statusTagClass(status)}`"&gt;{{ status }}&lt;/span&gt;
&lt;/template&gt;

&lt;!-- 原生层：手写，等价 --&gt;
&lt;span class="tag tag-pending"&gt;待审批&lt;/span&gt;</code></pre>
          <div class="callout is-ok">
            <div>
              两条路产出的是<b>同一个类名</b>，CSS 只有一份，所以不存在「改了一边忘了另一边」的漂移空间。
              这不是口头承诺 —— <code>vanilla-parity</code> 脚本会同时打开 Vue 文档站与原生示例页，
              对同一批选择器逐属性比对计算样式，不一致就失败。
            </div>
          </div>

          <h2 class="doc-h2">这一页里就混着两种写法</h2>
          <p class="doc-p">
            下面这块预览是<strong>手写 HTML</strong>（不是组件渲染的），它就贴在 Vue 文档站里，
            用库的类名、走库的同一个 CSS 文件。能同时成立，本身就是分层的证据：
          </p>
          <div class="demo-block">
            <div class="demo-block-head"><span class="demo-block-title">原生标记（无 Vue 组件参与）</span></div>
            <div class="demo-stage is-block" style="background-image: none">
              <div class="tabs" style="margin-bottom: 16px">
                <button type="button" class="tab active">待我审批 <span class="tab-count">12</span></button>
                <button type="button" class="tab">我已审批 <span class="tab-count">38</span></button>
                <button type="button" class="tab">我发起的 <span class="tab-count">5</span></button>
              </div>
              <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 16px">
                <button type="button" class="btn btn-primary">主按钮</button>
                <button type="button" class="btn btn-secondary">次按钮</button>
                <button type="button" class="btn btn-ghost">幽灵</button>
                <button type="button" class="btn btn-primary" disabled>禁用</button>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px">
                <span class="tag tag-pending">待处理</span>
                <span class="tag tag-processing">审批中</span>
                <span class="tag tag-cc">抄送我</span>
                <span class="tag tag-approved">已通过</span>
                <span class="tag tag-rejected">已驳回</span>
                <span class="tag tag-withdrawn">已撤回</span>
                <span class="tag tag-info">未登记的词</span>
              </div>
              <div class="card" style="max-width: 340px">
                <div class="card-header">
                  <span class="icon-tile icon-tile-blue icon-tile-sm">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                      <circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" stroke-linecap="round" />
                    </svg>
                  </span>
                  <div class="card-title">手写卡片</div>
                </div>
                <div class="card-body" style="font-size: 13px; color: var(--text-secondary)">
                  这段标记没有经过任何 Vue 组件，类名与样式全部来自 core 层。
                </div>
                <div class="card-footer">
                  <button type="button" class="btn btn-ghost btn-sm">取消</button>
                  <button type="button" class="btn btn-primary btn-sm">确定</button>
                </div>
              </div>
            </div>
          </div>

          <h2 class="doc-h2">原生侧怎么接入</h2>
          <p class="doc-p">
            不装依赖、不跑构建。库把三层 CSS 合并成一个文件，连同一份 SVG sprite 与素材，
            放在 <code class="doc-code-inline">dist-lite/</code>：
          </p>
          <pre class="demo-code"><code>&lt;!-- ① 唯一需要的样式入口（= tokens + base + components 三层合并） --&gt;
&lt;link rel="stylesheet" href="./dist-lite/yd-ui.css"&gt;

&lt;!-- ② 图标：sprite 里的符号，id 前缀 yd-icon- --&gt;
&lt;svg width="18" height="18" viewBox="0 0 24 24"&gt;
  &lt;use href="./dist-lite/icons.svg#yd-icon-shield"/&gt;
&lt;/svg&gt;

&lt;!-- ③ 配图 --&gt;
&lt;img class="kpi-asset" src="./dist-lite/assets/kpi-pending.png" width="40" height="40" alt=""&gt;

&lt;!-- ④ 然后就只剩拼类名了 --&gt;
&lt;button class="btn btn-primary"&gt;提交&lt;/button&gt;
&lt;span class="tag tag-pending"&gt;待审批&lt;/span&gt;</code></pre>
          <div class="callout is-info">
            <div>
              <b>dist-lite 是提交进仓库的构建产物</b> —— 因为原生消费者不跑构建，产物必须在仓库里现成可用。
              改完 <code>core/styles/</code> 必须 <code>npm run build:lite</code> 重建；
              CI 用 <code>npm run check:lite</code> 守「产物与源码是否同步」（比对 sha256）。
            </div>
          </div>

          <h2 class="doc-h2">类名别凭感觉拼，查契约</h2>
          <p class="doc-p">
            类名契约是从真源 CSS <strong>生成</strong>的，原生作者、文档站、AI 助手读的是同一份：
          </p>
          <div class="doc-table-wrap">
            <table class="doc-table">
              <thead><tr><th style="width:250px">文件</th><th>内容</th></tr></thead>
              <tbody>
                <tr><td><code>schema/class-contract.json</code></td><td>27 个家族 / 128 个类名 / 状态修饰语 / 状态词表 / 图标键 / 资产表 / 皮肤钩子</td></tr>
                <tr><td><code>dist-lite/manifest.json</code></td><td>CSS 与 sprite 的哈希、图标 id 列表、资产文件名</td></tr>
                <tr><td><code>core/styles/components.css</code></td><td>真正的样式真源（合并产物由它生成，勿手改产物）</td></tr>
              </tbody>
            </table>
          </div>
          <p class="doc-p">
            想查「某个状态词用哪个类」，看契约里的 <code class="doc-code-inline">statusWords</code> 表；
            不要自己拼 <code class="doc-code-inline">tag-</code> 前缀 —— 拼错的类名不会报错，只会掉样式。
          </p>

          <h2 class="doc-h2">core 是 vue 的超集：一个反例</h2>
          <p class="doc-p">
            标签页（<code class="doc-code-inline">.tabs</code> / <code class="doc-code-inline">.tab</code>）
            在 core 层有完整配方，但<strong>没有对应的 Vue 组件</strong>。
            原因很实际：原生页面里切换标签页通常交给后端路由（<code class="doc-code-inline">/list?tab=2</code>，整页重渲染），
            用不着 Vue 接管，所以没必要写组件。
            于是它的类名住在 core，只有手写 HTML 这一侧会用 —— 这就是「core 是 vue 超集」的证据。
          </p>

          <h2 class="doc-h2">边界：哪些东西 core 层没有</h2>
          <p class="doc-p">
            <b>core 层只有样式，一条 JS 都没有。</b>这不是遗漏，是刻意的：
            交互逻辑一旦进了 core，core 就不再零框架；而每个原生页面的交互需求又各不相同
            （原生 / jQuery / 服务端渲染），库没法替它们决定。所以：
          </p>
          <div class="doc-table-wrap">
            <table class="doc-table">
              <thead><tr><th style="width:190px">需求</th><th style="width:130px">core 层</th><th>原生侧怎么做</th></tr></thead>
              <tbody>
                <tr>
                  <td>弹窗开关 / Esc 关闭</td>
                  <td>只有结构</td>
                  <td>容器 <code>hidden</code> 属性 + 两三行事件绑定；要完整焦点管理就引 vue 层</td>
                </tr>
                <tr>
                  <td>树 / 折叠展开</td>
                  <td>只有结构</td>
                  <td>用原生 <code>&lt;details&gt;</code> / <code>&lt;summary&gt;</code> 承载，类名照旧，零 JS</td>
                </tr>
                <tr>
                  <td>分页翻页</td>
                  <td>只有结构</td>
                  <td>静态按钮 + 后端路由（<code>?page=2</code>），或自行绑定事件</td>
                </tr>
                <tr>
                  <td>溢出才弹的提示</td>
                  <td><b>没有，且不应有</b></td>
                  <td>需要测量 DOM 才能判断真截断，属行为；原生用 <code>title</code> 属性静默降级</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="doc-p">
            每个组件页底部都有一节「原生 HTML 等价写法」，逐组件说明有没有等价写法、以及为什么 ——
            包括那条<b>故意没有</b>的（OverflowTooltip）。
          </p>

          <h2 class="doc-h2">验收：四个命令</h2>
          <pre class="demo-code"><code># 分层边界：core 不得依赖 vue、组件不得带 &lt;style&gt;、模板不得用契约外的类名
node scripts/check-layering.cjs

# 直引包与源码是否同步（CI 用，退出码 1 = 不同步）
node scripts/build-lite.mjs --check

# 原生渲染 vs Vue 渲染，逐属性比对计算样式（25 组 × 26 属性）
node scripts/vanilla-parity.cjs

# 原生示例页自身验收：零报错、sprite 可解析、各族非零渲染、语义配色不混淆
node scripts/vanilla-probe.cjs</code></pre>
          <p class="doc-p">
            完整的原生示例页在库仓库：<code class="doc-code-inline">examples/vanilla/index.html</code>
            （一个文件，覆盖按钮 / 标签 / 图标 / 卡片 / 表格 / 表单 / 分页 / 弹窗 / 权限树 / 标签页 / 空状态）。
          </p>
        </template>

        <!-- ---------- 指南：设计令牌 ---------- -->
        <template v-else-if="activeGuide === 'tokens'">
          <h1 class="doc-page-title">设计令牌</h1>
          <div class="doc-page-sub">真源 core/theme/tokens.ts · 产物 core/styles/tokens.css · {{ lightCount }} 亮色 + {{ darkCount }} 暗色覆盖</div>
          <p class="doc-lead">
            令牌只有一处真源：<code class="doc-code-inline">core/theme/tokens.ts</code>（在零框架层里，
            所以原生页面也能从 tokens.css 拿到同一批 <code class="doc-code-inline">var(--token)</code>）。
            CSS 是它生成的产物（<strong>不要手改 tokens.css</strong>），antd 的主题桥也从同一份取值。
            下面所有色块用的都是 <code class="doc-code-inline">var(--key)</code>，所以切换右上角主题时会实时变化。
          </p>
          <div class="callout is-info">
            <div>
              暗色不是「另写一套」，而是<strong>覆盖集</strong>：只有 {{ darkOnlyCount }} 个令牌在暗色下取值不同，
              其余继承亮色。凡是被 antd 派生的令牌（<code>colorPrimary</code> 一类）必须给真实色值，
              给 <code>var()</code> 会让色阶派生失效 —— 生成器会先把别名展开再输出。
            </div>
          </div>

          <div v-for="[title, keys] in COLOR_KEYS" :key="title" class="token-section">
            <h3 class="doc-h3">{{ title }}</h3>
            <div class="swatch-grid">
              <div v-for="k in keys" :key="k" :class="['swatch', { 'dark-only': darkOf(k) }]">
                <div class="swatch-chip" :style="{ background: `var(--${k})` }"></div>
                <div class="swatch-meta">
                  <div class="swatch-name">--{{ k }}</div>
                  <div class="swatch-val">{{ lightTokens[k as keyof typeof lightTokens] }}</div>
                  <div v-if="darkOf(k)" class="swatch-val">暗色 → {{ darkOf(k) }}</div>
                </div>
              </div>
            </div>
          </div>

          <div v-for="g in scalarGroups" :key="g.title" class="token-section">
            <h3 class="doc-h3">{{ g.title }}</h3>
            <div class="doc-table-wrap">
              <table class="doc-table">
                <thead><tr><th style="width:220px">令牌</th><th style="width:320px">亮色值</th><th>暗色值</th></tr></thead>
                <tbody>
                  <tr v-for="[k, v] in g.rows" :key="k">
                    <td><code>--{{ k }}</code></td>
                    <td><code>{{ v }}</code></td>
                    <td><code>{{ darkOf(k) || '—（继承亮色）' }}</code></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>

        <!-- ---------- 指南：架构与迁移 ---------- -->
        <template v-else-if="activeGuide === 'architecture'">
          <h1 class="doc-page-title">架构与迁移</h1>
          <div class="doc-page-sub">库层与宿主层的边界在哪里</div>
          <p class="doc-lead">
            判断一个类该进库还是留宿主，用的不是「它看起来像不像组件」，而是
            <strong>「它是控件语义，还是页面语义」</strong>。下面这张图就是这条线划完之后的结果。
          </p>

          <h2 class="doc-h2">归属分层</h2>
          <p class="doc-p">
            库分两层，<b>依赖方向只有一条：vue → core</b>。
            core 不 import vue、不含 <code class="doc-code-inline">.vue</code> 文件、也不反向依赖宿主；
            vue 层的组件全部不含 <code class="doc-code-inline">&lt;style&gt;</code>，视觉一律由 core 的类名提供。
            这条方向不靠自觉，靠 <code class="doc-code-inline">npm run check:layering</code> 守 —— 违反直接失败。
          </p>

          <div class="dep-rule">
            <span class="dep-box is-core">@yd/ui/core</span>
            <span class="dep-arrow">←──<small>✓ 允许</small></span>
            <span class="dep-box is-vue">@yd/ui/vue</span>
            <span class="dep-arrow is-bad">──→<small>✗ 禁止</small></span>
            <span class="dep-box is-core">@yd/ui/core</span>
          </div>

          <div class="arch">
            <div class="arch-tier">@yd/ui/core —— 零框架层（Tier 0）· 原生 HTML / 静态页 / 任意框架都能直接用</div>
            <div v-for="row in archCore" :key="row.label" class="arch-row is-lib">
              <div class="arch-label">{{ row.label }}<small>{{ row.file }}</small></div>
              <div class="arch-body">
                <span v-for="c in row.chips" :key="c" class="arch-chip">{{ c }}</span>
              </div>
            </div>

            <div class="arch-tier">@yd/ui/vue —— 组件层（Tier 1）· 12 个 SFC，只依赖 core</div>
            <div v-for="row in archVue" :key="row.label" class="arch-row is-vue">
              <div class="arch-label">{{ row.label }}<small>{{ row.file }}</small></div>
              <div class="arch-body">
                <span v-for="c in row.chips" :key="c" class="arch-chip">{{ c }}</span>
              </div>
            </div>

            <div class="arch-tier">宿主 —— 页面语义与业务规则，不进库</div>
            <div v-for="row in archHost" :key="row.label" class="arch-row">
              <div class="arch-label">{{ row.label }}<small>宿主 · src/{{ row.file }}</small></div>
              <div class="arch-body">
                <span v-for="c in row.chips" :key="c" class="arch-chip">{{ c }}</span>
              </div>
            </div>
          </div>

          <h3 class="doc-h3">唯一一处跨边界耦合：皮肤钩子</h3>
          <p class="doc-p">
            有一处类名是<strong>库输出、宿主给样式</strong>的 —— 它既不属于 core 的配方，
            也不能算宿主自造。这种耦合藏起来最危险，所以它被<strong>显式登记</strong>，
            门禁校验「登记的钩子必须真被用到、模板里出现的库族类名必须在契约内」：
          </p>
          <div class="doc-table-wrap">
            <table class="doc-table">
              <thead><tr><th style="width:210px">类名</th><th style="width:130px">样式来自</th><th>为什么这么办</th></tr></thead>
              <tbody>
                <tr v-for="h in skinHooks" :key="h.cls">
                  <td><code>{{ h.cls }}</code></td>
                  <td><code>{{ h.by }}</code></td>
                  <td>{{ h.why }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="doc-p">
            登记表在 <code class="doc-code-inline">core/contract/skin-hooks.ts</code>。
            新增钩子必须同时改登记表与 <code class="doc-code-inline">class-contract.json</code>，
            否则 <code class="doc-code-inline">check:layering</code> 会以「模板用了契约外的类名」失败。
          </p>

          <h2 class="doc-h2">样式加载顺序 = 级联，不能乱动</h2>
          <pre class="demo-code"><code>宿主 src/index.css
  1  fonts.css
  2  tailwind.css
  3  theme.css
  6  @yd/ui/core/styles/tokens.css        ← 原 demo1/variables.css
  7  @yd/ui/core/styles/base.css          ← 原 demo1/base.css
  8  demo1/layout.css                （宿主）
  9a @yd/ui/core/styles/components.css    ← 原 demo1/components.css 的控件配方部分
  9b demo1/components.css            ← 同一文件拆分后的宿主残余（紧随其后，保持相对顺序）
 10  demo1/pages.css                 （宿主）
 11  demo1/animations.css</code></pre>
          <div class="callout is-warn">
            <div>
              <b>不变式：库的控件配方必须仍排在宿主 pages.css 之前。</b>
              宿主 <code>pages.css</code> 里有大量 <code>.approval-actions .btn</code> 这类页面上下文覆盖，
              它们靠「更晚加载」压过库内配方。顺序反了不会报错，只会长得不对。
            </div>
          </div>

          <h2 class="doc-h2">怎么验证没搞坏</h2>
          <p class="doc-p">
            每次搬迁都必须过一道实测门：把 30 组页面快照的<strong>逐属性计算样式指纹</strong>与基线逐项比对，
            退出码为 0 才允许继续。这道门做过确定性自检 —— 同一份代码独立采两次，差异为 0，
            说明它不会因为测量抖动误报。
          </p>
          <pre class="demo-code"><code>node scripts/p0-baseline.cjs --url http://localhost:5173/ --out .workbuddy/verify/after
node scripts/p0-baseline-diff.cjs --base .workbuddy/verify/baseline --next .workbuddy/verify/after
# 退出码 0 = 通过；报告会指名到「哪个元素、哪个属性、从什么变成什么」</code></pre>

          <h2 class="doc-h2">两层结构的四道门</h2>
          <p class="doc-p">
            分层这种事，靠「大家注意一下」是守不住的 —— 它会慢慢烂掉，而且是静默地烂。
            所以每一层规则都对应一个会失败的命令：
          </p>
          <div class="doc-table-wrap">
            <table class="doc-table">
              <thead><tr><th style="width:210px">命令</th><th style="width:230px">守什么</th><th>怎么发现问题</th></tr></thead>
              <tbody>
                <tr>
                  <td><code>check:layering</code></td>
                  <td>core 不依赖 vue（C1/C2/C3）、组件不带 &lt;style&gt;（V1）、模板类名在契约内（V2）</td>
                  <td>静态扫描 + 逐条断言；自带 <code>selftest</code>，会主动灌注 14 种违规证明「真的会失败」</td>
                </tr>
                <tr>
                  <td><code>check:lite</code></td>
                  <td>dist-lite 直引包与 core 源码同步</td>
                  <td>比对 sha256；不同步退出码 1（改完 core/styles 忘了重建就靠它）</td>
                </tr>
                <tr>
                  <td><code>vanilla-parity</code></td>
                  <td>「原生 HTML 渲染」与「Vue 组件渲染」计算样式一致</td>
                  <td>真浏览器开两页，25 组选择器 × 26 个属性逐项比对；<b>这是分层没退化的唯一硬证据</b></td>
                </tr>
                <tr>
                  <td><code>vanilla-probe</code></td>
                  <td>原生示例页自身成立（零报错、sprite 可解析、各族非零渲染、语义配色不混淆）</td>
                  <td>&lt;use&gt; 引用写错时页面不报错、只是图标空白，所以用 getBBox 量实际绘制结果</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="callout is-ok">
            <div>
              <b>parity 是关键那一道。</b>分层的全部价值压在一个断言上：<b>core 的类名配方，就是 vue 组件的视觉，没有第二份定义。</b>
              一旦有人给组件加了 <code>&lt;style&gt;</code>，两层就开始分叉 —— 而分叉是静默的，两边页面各自都「看起来正常」。
              所以用真实浏览器逐属性比对来钉住它。
            </div>
          </div>

          <h2 class="doc-h2">已知缺口</h2>
          <div class="callout is-warn">
            <div><div v-for="(g, i) in knownGaps" :key="i">· {{ g }}</div></div>
          </div>

          <h2 class="doc-h2">候选中：已有样式、还没有组件的部分</h2>
          <p class="doc-p">
            这些类名有完整配方，但项目里没有对应的组件实现。迁移时刻意<strong>没有</strong>把它们搬进库 ——
            把没有实现的样式搬进组件库，等于往库里塞死代码。
          </p>
          <div v-for="p in pending" :key="p.group" class="pending-group">
            <h4>{{ p.group }}</h4>
            <div class="pending-items"><span v-for="i in p.items" :key="i" class="arch-chip">{{ i }}</span></div>
            <div class="pending-note">{{ p.note }}</div>
          </div>
        </template>

        <!-- ---------- 指南：AI 接入 ---------- -->
        <template v-else-if="activeGuide === 'ai'">
          <h1 class="doc-page-title">AI 接入</h1>
          <div class="doc-page-sub">让 VSCode 里的编码助手按这套规范写代码</div>
          <p class="doc-lead">
            组件库对 AI 友好与否，取决于<strong>规范能不能被机器读到</strong>。所以这里产出了三样东西：
            一份极简自然语言说明、一份机器可读契约、一份可被助手自动加载的规则文件。
          </p>

          <h2 class="doc-h2">五份产物</h2>
          <p class="doc-p">
            关键一点：助手必须知道<b>有两条生成路径</b> —— 写 Vue 就用组件，写原生 HTML 就用类名。
            不把这件事写进契约，助手就会在原生页面里 import 组件，或者反过来手写一套 CSS。
          </p>
          <div class="doc-table-wrap">
            <table class="doc-table">
              <thead><tr><th style="width:250px">文件</th><th style="width:110px">给谁看</th><th>作用</th></tr></thead>
              <tbody>
                <tr>
                  <td><code>llms.txt</code></td><td>LLM</td>
                  <td>把「组件速查 + 可用类名 + 硬约束 + 已知缺口」压成一份可直接塞进上下文的说明。适合一次性粘贴或让助手主动读取。</td>
                </tr>
                <tr>
                  <td><code>schema/components.json</code></td><td>工具链</td>
                  <td>完整契约：每个组件的 props / events / slots / 无障碍备注 / 示例代码，以及<b>每个组件的 native 字段</b>（原生侧有没有等价写法）。<strong>本文档站读的就是这一份</strong>，所以文档和实现不可能对不上。</td>
                </tr>
                <tr>
                  <td><code>schema/class-contract.json</code></td><td>LLM · 工具链</td>
                  <td>类名白名单：27 个家族 / 128 个类名。助手写原生 HTML 时只该用这里面的类名 —— 这比一句「请遵循设计规范」有效得多。</td>
                </tr>
                <tr>
                  <td><code>dist-lite/manifest.json</code></td><td>LLM · 工具链</td>
                  <td>直引包清单：图标 id、素材文件名、哈希。避免助手凭感觉拼 <code>#yd-icon-xxx</code> 或 <code>kpi-xxx.png</code>。</td>
                </tr>
                <tr>
                  <td><code>.vscode/instructions.md</code><br />（或 Cursor / Claude 的规则文件）</td><td>编辑器</td>
                  <td>放进项目根目录，助手每次补全都会带上这份约束，不需要你每次重复交代。</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 class="doc-h2">VSCode Copilot 用法</h2>
          <p class="doc-p">
            Copilot 从 <code class="doc-code-inline">.github/copilot-instructions.md</code> 读取项目级指令。
            把库的规则文件放进去（或直接复制 <code class="doc-code-inline">llms.txt</code> 的内容），
            之后的补全就会优先用库的组件和类名。
          </p>
          <pre class="demo-code"><code># 项目根建立
.github/copilot-instructions.md

# 内容最短可用版本：
本项目 UI 使用内部组件库 @yd/ui。
- 组件：`import { Modal, StatusTag } from '@yd/ui'`，不要自己写这些控件。
- 样式：一律用库的类名（.btn .btn-primary / .tag / .card / .table / .form-field / .perm-tree），
  不要内联样式、不要新造 CSS 类。
- 颜色/间距只用 var(--token)，不要写死色值。
- 状态词只能从这些里选：待处理 待审批 审批中 抄送我 已通过 已驳回 已撤回 已终止 延期审批中 有效 即将到期 已过期 正常
- 完整契约见 schema/components.json，说明见 llms.txt。
- 三个不要：不要给库组件加 &lt;style&gt;；不要在库里写业务规则；不要新造状态词。</code></pre>

          <h2 class="doc-h2">Claude / Cursor / 其它助手</h2>
          <p class="doc-p">
            这类助手通常支持「项目规则文件」或 MCP。两种接法：
          </p>
          <pre class="demo-code"><code># ① 规则文件（最简单，通用）
CLAUDE.md  /  .cursor/rules/yd-ui.md  /  AGENTS.md

# ② 让助手主动读契约（适合任务复杂时）
"先读 ../../组件库/llms.txt 和 schema/components.json，再按里面的类名写页面。"</code></pre>

          <h2 class="doc-h2">为什么这样能减少返工</h2>
          <div class="callout is-ok">
            <div>
              AI 生成 UI 代码最常见的三类问题是：<b>自己造样式</b>、<b>用不存在的类名</b>、<b>臆造状态词</b>。
              这三类都能靠「把可选项枚举出来」消掉 ——
              所以 <code>llms.txt</code> 里给的是<strong>白名单</strong>（可用类名清单、已登记状态词清单），
              而不是一句「请遵循设计规范」。
            </div>
          </div>

          <h2 class="doc-h2">直接粘给助手的一段话</h2>
          <pre class="demo-code"><code>你在为一个 Vue 3 + Vite 项目写界面。UI 必须使用内部组件库 @yd/ui。

1) 样式入口（顺序固定，勿改）：
   @import '@yd/ui/core/styles/tokens.css';
   @import '@yd/ui/core/styles/base.css';
   @import '@yd/ui/core/styles/components.css';
2) 组件按名导入：import { Modal, StatusTag, Pagination, PermissionTree } from '@yd/ui'
3) 只用这些类名，不要新造：{{ components.length }} 个组件见组件表；
   .btn/.btn-primary/.btn-secondary/.btn-ghost/.btn-sm、.tag/.tag-*、
   .card/.card-header/.card-title/.card-body、.table/.table-wrap/.cell-name、
   .form-field/.form-label/.form-hint、.perm-tree/.tree-*、.pagination/.page-btn
4) 颜色间距只用 var(--token)。
5) StatusTag 的 status 只能取：待处理 待审批 审批中 抄送我 已通过 已驳回 已撤回 已终止 延期审批中 有效 即将到期 已过期 正常
6) 需要完整 props/事件/示例时读 schema/components.json。</code></pre>

          <h3 class="doc-h3">如果这个项目不用 Vue</h3>
          <p class="doc-p">
            同一份契约还能生成另一套说法 —— 让助手知道「这一侧没有组件可用，只有类名」：
          </p>
          <pre class="demo-code"><code>你在写纯 HTML／静态页面，**不要引入 Vue，也不要引入组件库的 JS**。
样式只需一行：&lt;link rel="stylesheet" href="./dist-lite/yd-ui.css"&gt;

1) 控件一律用类名拼，可用类名看 schema/class-contract.json（不要自己造类名、不要写内联样式）。
2) 状态词 → 类名查同一份契约的 statusWords 表，不要凭感觉拼 tag- 前缀。
3) 图标用 sprite：&lt;use href="./dist-lite/icons.svg#yd-icon-{name}"&gt;，
   id 清单见 dist-lite/manifest.json —— 不要猜。
4) 配图只有 4 个键（pending/processed/submitted/cc），文件名见 manifest.json 的 assets。
5) 交互要自己解决：core 层**没有 JS**。弹窗用 hidden 属性；折叠用 &lt;details&gt;；
   需要精确行为（如焦点陷阱、溢出才弹的提示）才考虑引 vue 层。</code></pre>
        </template>

        <template v-else>
          <h1 class="doc-page-title">没找到这一页</h1>
          <div class="doc-page-sub">{{ route }}</div>
          <p class="doc-lead">从左侧导航选一个页面。</p>
        </template>
      </main>
    </div>
  </div>
</template>
