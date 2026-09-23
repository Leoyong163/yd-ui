#!/usr/bin/env node
/**
 * build-contract.mjs —— 从**真源**生成 `schema/class-contract.json`（类名契约）。
 *
 *   node --experimental-strip-types scripts/build-contract.mjs           # 写入
 *   node --experimental-strip-types scripts/build-contract.mjs --check   # 只校验（不同步则退出码 1）
 *
 * 为什么需要它：这个库的两条消费路径——Vue 组件与原生 HTML——必须长得一样。
 * 保证「一样」的办法不是写文档约定，而是让它们**共用同一份类名清单**：
 *   组件不带 <style>，外观全来自 `core/styles/components.css`；
 *   原生 HTML 拼的也是这套类名。于是「谁可以用哪些类名」成为一个可机读的事实。
 *
 * 这份契约的消费者：
 *   · 原生 HTML / 静态单文件作者 —— 查可用类名与状态修饰语
 *   · 文档站                  —— 渲染类名清单、状态词表
 *   · AI 编码助手              —— 拿它当白名单，不再臆造类名
 *   · 门禁 scripts/check-layering.cjs —— 校验库内 .vue 模板没用到契约外的类名
 *
 * 真源（本文件只读它们，从不手改契约）：
 *   core/styles/components.css      → 类名清单、家族、状态修饰语、响应式类
 *   core/contract/tag-class.ts      → 状态词 → 类名、紧急程度 → 类名
 *   core/contract/assets-manifest.ts→ 资产键 → 文件名
 *   core/icons/icons.ts             → 图标键、色板 tone
 *
 * 契约是**生成物**，请勿手改；改了会被 check 打回。
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const p = (...s) => join(root, ...s)
const CHECK = process.argv.includes('--check')
const OUT = p('schema', 'class-contract.json')

/* ==========================================================================
   1. 家族表 —— 与宿主 scripts/p1-split-styles.cjs 的 LIB_FAMILIES 同源
   ========================================================================== */

/** 家族前缀；匹配时按长度降序，最长前缀优先（避免 tab 抢走 tabs-x）。 */
const FAMILY_PREFIXES = [
  'btn',
  'tag',
  'card',
  'table',
  'cell-',
  'perm-tree',
  'tree',
  'leaf',
  'tabs',
  'tab',
  'pagination',
  'page-btn',
  'input',
  'select',
  'textarea',
  'form-',
  'checkbox',
  'radio',
  'check-row',
  'radio-row',
  'switch',
  'icon-tile',
  'icon-3d',
  'modal',
  'empty-state',
  'search-box',
  'search-icon',
  'search-select',
  'single-select',
  'select-card',
  'portal-menu',
  'chip-tree',
  'hover-card',
  'kpi-asset',
  'overflow-tooltip',
  'ant-',
  'anticon',
]

/** 家族说明 —— 人读用；也是 AI 判断「该用哪个族」的依据。 */
const FAMILY_META = {
  btn: { title: '按钮', root: 'btn', note: '变体 btn-primary / btn-secondary / btn-ghost；尺寸 btn-sm / btn-lg；加载态 .is-loading' },
  tag: { title: '状态标签', root: 'tag', note: '语义配色由状态词决定（见 statusWords）；紧急程度见 urgencyWords' },
  card: { title: '卡片', root: 'card', note: '结构 card-header / card-title / card-body / card-footer' },
  table: { title: '表格', root: 'table', note: '外层 table-wrap 负责横向滚动；单元格变体 cell-name / cell-muted / cell-node' },
  'cell-': { title: '表格单元格变体', root: null, note: '依附 .table 使用，不可单独使用' },
  'perm-tree': { title: '权限树', root: 'perm-tree', note: '结构 tree-toolbar / tree-list / tree-row / tree-children' },
  tree: { title: '树节点', root: null, note: '行 tree-row（层级修饰 tree-level-N）、开关 tree-toggle、文本 tree-name / tree-type、授权态 tree-owned / tree-denied' },
  leaf: { title: '树叶子节点', root: 'leaf', note: '无子节点时占位，保持缩进对齐（.tree-toggle.leaf）' },
  tabs: { title: '标签页', root: 'tabs', note: '' },
  tab: { title: '标签页项', root: 'tab', note: '选中态 .active' },
  pagination: { title: '分页容器', root: 'pagination', note: '结构 pagination-info / pagination-pages / pagination-size / pagination-jump' },
  'page-btn': { title: '分页按钮', root: 'page-btn', note: '当前页 .active；首尾页用 disabled 属性而非类名' },
  input: { title: '输入框', root: 'input', note: '' },
  select: { title: '下拉选择', root: 'select', note: '' },
  textarea: { title: '多行输入', root: 'textarea', note: '' },
  'form-': { title: '表单结构', root: null, note: 'form-field / form-label / form-hint；满宽 .full；必填星号由 .required 生成' },
  checkbox: { title: '多选框', root: 'checkbox', note: '' },
  radio: { title: '单选框', root: 'radio', note: '' },
  'check-row': { title: '多选行', root: 'check-row', note: '多选框 + 说明文本的整行' },
  'radio-row': { title: '单选行', root: 'radio-row', note: '' },
  switch: { title: '开关', root: 'switch', note: '' },
  'icon-tile': { title: '图标方块', root: 'icon-tile', note: '配色 icon-tile-{tone}；尺寸 icon-tile-sm / icon-tile-lg' },
  'icon-3d': { title: '图标方块（旧别名）', root: 'icon-3d', note: '历史遗留，新代码请用 icon-tile' },
  modal: { title: '模态框', root: 'modal', note: '结构 modal-backdrop > modal > modal-header / modal-title / modal-close / modal-body / modal-footer；尺寸 modal-sm / modal-lg / modal-xl' },
  'empty-state': { title: '空状态', root: 'empty-state', note: '' },
  'search-box': { title: '搜索框', root: 'search-box', note: '内含 search-icon + .input' },
  'search-icon': { title: '搜索图标', root: 'search-icon', note: '依附 .search-box' },
  'search-select': { title: '可搜索单选', root: 'search-select', note: '输入框复用 .input；菜单 search-select-menu；选项 search-select-option；状态 .has-value / .is-open / .disabled' },
  'single-select': { title: '单选触发按钮', root: 'single-select', note: '外层 single-select-wrap 负责定位；菜单 single-select-menu；选中态 .selected' },
  'select-card': { title: '可勾选卡片', root: 'select-card', note: '结构 select-card-main（checkbox + text）/ select-card-toggle / select-card-details；状态 .selected / .focus / .open' },
  'portal-menu': { title: '锚点浮层容器', root: 'portal-menu', note: '位置由调用方 inline 提供，盒子外观在类名上' },
  'chip-tree': { title: '叶子芯片树', root: 'chip-tree', note: '分支行 chip-tree-row .is-branch、叶子行 chip-tree-leaf-wrap + chip-tree-leaf；缩进用 chip-tree-depth-N / chip-tree-leaf-depth-N' },
  'hover-card': { title: '悬停浮层', root: 'hover-card', note: '触发器 hover-card-trigger；结构 head / title / meta / body / arrow' },
  'kpi-asset': { title: 'KPI 配图', root: 'kpi-asset', note: '图片地址见 assets 表' },
  'overflow-tooltip': { title: '溢出提示浮层', root: null, note: '由 antd Tooltip 承载，类名用于覆盖浮层样式' },
  'ant-': { title: 'antd 主题覆盖', root: null, note: '只给 antd 组件上主题，不是自研控件类名' },
  anticon: { title: 'antd 图标容器', root: null, note: '同上' },
}

/** 状态修饰语：不是独立控件，而是「加在某个控件本体上」的修饰。 */
const STATE_WORDS = new Set([
  'active',
  'selected',
  'open',
  'done',
  'current',
  'disabled',
  'hover',
  'focus',
  'dragover',
  'actions',
  'is-loading',
  'is-open',
  'is-active',
  'has-error',
  'full',
  'highlight',
  'required',
  'nowrap',
  'spinner',
  // 从宿主抽来的选择类控件引入的状态词：
  //   has-value  —— SearchSelect 已选中（清空按钮的显隐条件）
  //   is-branch / is-leaf —— ChipTree 行身份修饰（分支行可折叠、叶子行占位对齐）
  'has-value',
  'is-branch',
  'is-leaf',
])

/* ==========================================================================
   2. CSS 解析 —— 注释/字符串感知，能钻进 @media 等嵌套块
   ========================================================================== */

function stripComments(css) {
  let out = ''
  let i = 0
  let quote = null
  while (i < css.length) {
    const c = css[i]
    if (quote) {
      out += c
      if (c === '\\') {
        out += css[i + 1] ?? ''
        i += 2
        continue
      }
      if (c === quote) quote = null
      i += 1
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      out += c
      i += 1
      continue
    }
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      i = end < 0 ? css.length : end + 2
      out += ' '
      continue
    }
    out += c
    i += 1
  }
  return out
}

/** 逐条规则回调：{ selector, at }（at 为 @media/@supports 的 prelude，顶层为 null） */
function walkRules(css, onRule) {
  let i = 0
  while (i < css.length) {
    while (i < css.length && /\s/.test(css[i])) i += 1
    if (i >= css.length) break
    if (css[i] === '}') {
      i += 1
      continue
    }

    // 读到 '{' 或 ';'（'@import ...;' 这种直接跳过）
    let j = i
    while (j < css.length && css[j] !== '{' && css[j] !== ';') {
      if (css[j] === '"' || css[j] === "'") {
        const q = css[j]
        j += 1
        while (j < css.length && css[j] !== q) {
          if (css[j] === '\\') j += 1
          j += 1
        }
      }
      j += 1
    }
    if (j >= css.length) break
    if (css[j] === ';') {
      i = j + 1
      continue
    }

    const prelude = css.slice(i, j).trim()
    // 配对右花括号
    let k = j + 1
    let depth = 1
    while (k < css.length && depth > 0) {
      const c = css[k]
      if (c === '{') depth += 1
      else if (c === '}') depth -= 1
      else if (c === '"' || c === "'") {
        const q = c
        k += 1
        while (k < css.length && css[k] !== q) {
          if (css[k] === '\\') k += 1
          k += 1
        }
      }
      k += 1
    }
    const body = css.slice(j + 1, k - 1)

    if (prelude.startsWith('@')) {
      if (/^@(media|supports|container|layer|scope)\b/i.test(prelude)) {
        walkRules(body, (r) => onRule({ ...r, at: r.at ?? prelude }))
      }
    } else if (prelude) {
      onRule({ selector: prelude, at: null })
    }

    i = k
  }
}

/** 按顶层逗号切选择器（忽略括号内） */
function splitSelectors(sel) {
  const out = []
  let depth = 0
  let cur = ''
  for (const c of sel) {
    if (c === '(' || c === '[') depth += 1
    if (c === ')' || c === ']') depth -= 1
    if (c === ',' && depth === 0) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  if (cur.trim()) out.push(cur)
  return out
}

/* ==========================================================================
   3. 主流程
   ========================================================================== */

const cssPath = p('src', 'core', 'styles', 'components.css')
if (!existsSync(cssPath)) {
  console.error(`[contract] 找不到 ${cssPath}`)
  process.exit(1)
}
const css = stripComments(readFileSync(cssPath, 'utf8'))

/** class → 出现次数；stateClass → 与之同现的家族集合；responsive 类集合 */
const classHits = new Map()
const stateOwner = new Map()
const responsive = new Set()
let ruleCount = 0
let mediaRuleCount = 0

const sortedPrefixes = [...FAMILY_PREFIXES].sort((a, b) => b.length - a.length)
function familyOf(cls) {
  for (const f of sortedPrefixes) {
    if (cls === f || cls.startsWith(f)) {
      // 'tab' 不该抢走 'table-*' —— 但 'table' 更长，排序已保证它先匹配
      return f
    }
  }
  return null
}

walkRules(css, ({ selector, at }) => {
  ruleCount += 1
  if (at) mediaRuleCount += 1
  for (const one of splitSelectors(selector)) {
    const classes = new Set()
    for (const m of one.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) classes.add(m[1])
    if (!classes.size) continue
    const fams = new Set()
    for (const c of classes) {
      classHits.set(c, (classHits.get(c) || 0) + 1)
      if (at) responsive.add(c)
      const f = familyOf(c)
      if (f && !STATE_WORDS.has(c)) fams.add(f)
    }
    for (const c of classes) {
      if (!STATE_WORDS.has(c)) continue
      if (!stateOwner.has(c)) stateOwner.set(c, new Set())
      for (const f of fams) stateOwner.get(c).add(f)
      // 状态词单独出现在规则里（如 `.full`）时没有家族归属，就登记为通用状态
      if (!fams.size) stateOwner.get(c).add('*')
    }
  }
})

const allClasses = [...classHits.keys()].sort()

/* 家族分组 */
const familyMap = new Map()
const unmatched = []
for (const cls of allClasses) {
  if (STATE_WORDS.has(cls)) continue
  const f = familyOf(cls)
  if (!f) {
    unmatched.push(cls)
    continue
  }
  if (!familyMap.has(f)) familyMap.set(f, [])
  familyMap.get(f).push(cls)
}

const families = [...familyMap.entries()]
  .sort((a, b) => b[1].length - a[1].length)
  .map(([prefix, classes]) => {
    const meta = FAMILY_META[prefix] || {}
    const sorted = [...classes].sort((a, b) => {
      const ra = meta.root && a === meta.root
      const rb = meta.root && b === meta.root
      if (ra !== rb) return ra ? -1 : 1
      return a.length - b.length || a.localeCompare(b)
    })
    const states = [...stateOwner.entries()]
      .filter(([, s]) => s.has(prefix))
      .map(([s]) => s)
      .sort()
    return {
      prefix,
      title: meta.title || prefix,
      root: meta.root && classes.includes(meta.root) ? meta.root : null,
      note: meta.note || '',
      count: sorted.length,
      classes: sorted,
      ...(states.length ? { states } : {}),
      ...(sorted.some((c) => responsive.has(c)) ? { responsive: true } : {}),
    }
  })

/* ==========================================================================
   4. 读其余真源
   ========================================================================== */

const load = (rel) => import(pathToFileURL(p(...rel.split('/'))).href)

const { STATUS_TAG_CLASS, URGENCY_TAG_CLASS, TAG_FALLBACK_CLASS } = await load('src/core/contract/tag-class.ts')
const { KPI_ASSET_FILES } = await load('src/core/contract/assets-manifest.ts')
const { SKIN_HOOKS } = await load('src/core/contract/skin-hooks.ts')
const { icons, tones, shortcutPalette } = await load('src/core/icons/icons.ts')

const iconKeys = Object.keys(icons).sort()
const assetDir = p('src', 'core', 'assets')
const assetFilesOnDisk = existsSync(assetDir) ? readdirSync(assetDir).sort() : []
const missingAssets = Object.values(KPI_ASSET_FILES).filter((f) => !assetFilesOnDisk.includes(f))

/* ==========================================================================
   5. 组装 + 落盘
   ========================================================================== */

const contract = {
  package: '@yd/ui',
  version: JSON.parse(readFileSync(p('package.json'), 'utf8')).version,
  generatedBy: 'scripts/build-contract.mjs',
  source: 'src/core/styles/components.css',
  sourceRuleCount: ruleCount,
  sourceMediaRuleCount: mediaRuleCount,
  classCount: allClasses.length,

  layers: {
    core: {
      desc: '零框架层：去掉 Vue 依然成立。CSS 三层 + 图标 + 素材 + 契约映射表 + 令牌真源。',
      entry: '@yd/ui/core',
      consumers: ['原生 HTML / 静态单文件', 'Vue 应用', '其它框架'],
      cssOrder: [
        '@yd/ui/core/styles/tokens.css',
        '@yd/ui/core/styles/base.css',
        '@yd/ui/core/styles/components.css',
      ],
      cssNote: '三条 @import 的位置就是级联顺序，且必须全部排在宿主页面级样式（pages.css）之前。顺序反转会让页面上下文覆盖静默失效。',
      directLink: 'dist-lite/yd-ui.css（同样三条的合并产物，供不跑构建的原生页面 <link> 引用）',
    },
    vue: {
      desc: 'Vue 层：只做结构与行为。组件内不含 <style>，外观全部来自 core 的类名。',
      entry: '@yd/ui',
      consumers: ['Vue 3 应用'],
      ban: 'V2 组件不得带 <style> —— 这条是两层能共用同一份 CSS 的前提。',
    },
  },

  families,
  unmatchedClasses: unmatched.sort(),

  /**
   * 皮肤钩子：库模板会输出、但库**故意不给样式**的类名。
   * 宿主用页面选择器给它们上样式（如 `.permission-tree-section .tree-toolbar-btn`）。
   * 这是库与宿主之间唯一被允许的样式耦合出口 —— 因此显式登记，便于审计。
   * 真源：`src/core/contract/skin-hooks.ts`。门禁会校验每一项都被模板真的引用（防陈旧）。
   */
  skinHooks: SKIN_HOOKS,

  stateClasses: [...STATE_WORDS].sort(),
  stateOwners: Object.fromEntries(
    [...stateOwner.entries()].map(([k, v]) => [k, [...v].sort()]).sort((a, b) => a[0].localeCompare(b[0])),
  ),
  responsiveClasses: [...responsive].sort(),

  statusWords: STATUS_TAG_CLASS,
  tagFallback: TAG_FALLBACK_CLASS,
  urgencyWords: URGENCY_TAG_CLASS,

  tones,
  iconKeys,
  shortcutPalette,
  assets: KPI_ASSET_FILES,
  assetFilesOnDisk,
}

const json = JSON.stringify(contract, null, 2) + '\n'
const previous = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''

if (previous === json) {
  console.log(
    `[contract] 已同步：${families.length} 个家族 / ${allClasses.length} 个类名 / ${ruleCount} 条规则（其中 ${mediaRuleCount} 条在 @media 内）`,
  )
  if (missingAssets.length) {
    console.error(`[contract] ⚠ assets 表里的文件在 core/assets/ 不存在：${missingAssets.join(', ')}`)
    process.exit(1)
  }
  process.exit(0)
}

if (CHECK) {
  console.error('[contract] class-contract.json 与真源不同步。')
  console.error(`  当前 ${previous.length} 字节 / 应为 ${json.length} 字节`)
  console.error('  运行 `node --experimental-strip-types scripts/build-contract.mjs` 重新生成。')
  process.exit(1)
}

writeFileSync(OUT, json, 'utf8')
console.log(
  `[contract] 已写入 ${OUT}\n  ${families.length} 个家族 · ${allClasses.length} 个类名 · ${ruleCount} 条规则（@media 内 ${mediaRuleCount} 条）`,
)
if (unmatched.length) {
  console.log(`  未归属家族（既非家族类也非状态词）：${unmatched.join(', ')}`)
}
if (missingAssets.length) {
  console.error(`  ⚠ assets 表里的文件在 core/assets/ 不存在：${missingAssets.join(', ')}`)
  process.exit(1)
}
