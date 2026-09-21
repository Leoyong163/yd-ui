#!/usr/bin/env node
/**
 * check-schema.mjs —— 守 `schema/components.json` 与类名契约的一致性。
 *
 *   node scripts/check-schema.mjs [--json]
 *
 * 为什么需要它：`components.json` 是**手工维护**的（`check:tokens` 只守令牌，
 * `check:layering` 只守代码），但它同时是文档站与 AI 助手的**唯一数据源**。
 * 手工维护 + 无校验 = 会悄悄烂掉：字段漏了、组件漏了、示例代码里写了不存在的类名 ——
 * 这些都不会报错，只会让文档和实现慢慢对不上。
 *
 * 所以这里做四件事：
 *   1. 结构完整性：必备字段齐全、group 引用有效、status 取值合法
 *   2. 双向覆盖：每个 SFC 都有文档条目，每个文档条目都有对应 SFC
 *   3. 路径不漂移：usage.styles 必须指 core/styles，且文件真实存在
 *   4. **native 示例代码里的类名必须在类名契约内** ——
 *      这条最要紧：文档教人写的类名如果不存在，那是「静默失效」的源头。
 *
 * 退出码 0 = 全部通过。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LIB = path.join(__dirname, '..')
const SRC = path.join(LIB, 'src')
const JSON_OUT = process.argv.includes('--json')

const problems = []
const notes = []
const fail = (where, msg) => problems.push({ where, msg })
const read = (p) => fs.readFileSync(p, 'utf8')

/* ---------- 载入 ---------- */
const schemaPath = path.join(LIB, 'schema', 'components.json')
const contractPath = path.join(LIB, 'schema', 'class-contract.json')
for (const p of [schemaPath, contractPath]) {
  if (!fs.existsSync(p)) {
    console.error(`[schema] 缺少 ${path.relative(LIB, p)}`)
    process.exit(1)
  }
}

let schema
try {
  schema = JSON.parse(read(schemaPath))
} catch (e) {
  console.error(`[schema] components.json 不是合法 JSON：${e.message}`)
  process.exit(1)
}
const contract = JSON.parse(read(contractPath))

/* 校验用的已知类名集合：与 check-layering 的口径保持一致 */
const knownTokens = new Set([
  ...contract.families.flatMap((f) => f.classes),
  ...contract.stateClasses,
  ...contract.unmatchedClasses,
  ...Object.keys(contract.skinHooks || {}),
])

/* ==========================================================================
   1. 结构完整性
   ========================================================================== */
const TOP_KEYS = ['package', 'version', 'title', 'updatedAt', 'stage', 'layers', 'usage', 'groups', 'components', 'pending', 'knownGaps']
for (const k of TOP_KEYS) {
  if (schema[k] === undefined || schema[k] === null) fail('components.json', `缺少顶层字段 ${k}`)
}
if (!Array.isArray(schema.components) || !schema.components.length) {
  fail('components.json', 'components 为空')
  process.exit(1)
}
if (!Array.isArray(schema.groups) || !schema.groups.length) fail('components.json', 'groups 为空')

const groupKeys = new Set((schema.groups || []).map((g) => g.key))
const STATUSES = new Set(['stable', 'beta', 'internal', 'deprecated'])

/* layers：两层结构必须写进契约，否则读者（含 AI）不知道有两层 */
const layers = schema.layers || {}
for (const tier of ['core', 'vue']) {
  if (!layers[tier]) fail('components.json → layers', `缺少 ${tier} 层描述`)
  else {
    for (const k of ['tier', 'title', 'entry', 'desc', 'hardRules']) {
      // 注意用 `=== undefined` 而不是真值判断：core 层的 tier 就是数字 0，真值判断会误报
      if (layers[tier][k] === undefined) fail('components.json → layers.' + tier, `缺少 ${k}`)
    }
  }
}
if (!layers.rule && !(layers.note || '').includes('vue → core')) {
  notes.push('layers.note 未点明「依赖方向 vue → core」')
}

/* usage：样式路径不得漂移 */
const styles = schema.usage?.styles
if (!Array.isArray(styles) || styles.length !== 3) {
  fail('components.json → usage.styles', '应为三条 @import')
} else {
  for (const s of styles) {
    const m = /@import\s+'([^']+)'/.exec(s)
    if (!m) {
      fail('components.json → usage.styles', `不是合法 @import：${s}`)
      continue
    }
    const spec = m[1]
    if (!spec.startsWith('@yd/ui/core/styles/')) {
      fail('components.json → usage.styles', `路径漂移：${spec} —— 分层后应走 @yd/ui/core/styles/`)
      continue
    }
    const file = path.join(SRC, 'core', 'styles', spec.replace('@yd/ui/core/styles/', ''))
    if (!fs.existsSync(file)) fail('components.json → usage.styles', `文件不存在：${spec}`)
  }
}
if (!schema.usage?.import) fail('components.json → usage', '缺少 import 示例')
if (!schema.usage?.nativeUsage?.css) fail('components.json → usage.nativeUsage', '缺少原生路径的 CSS 接法')

/* ==========================================================================
   2. 逐组件校验
   ========================================================================== */
const seen = new Set()
for (const c of schema.components) {
  const at = `components.json → ${c.name || '(未命名)'}`
  for (const k of ['name', 'title', 'group', 'status', 'desc']) {
    if (!c[k]) fail(at, `缺少 ${k}`)
  }
  if (seen.has(c.name)) fail(at, `组件名重复：${c.name}`)
  seen.add(c.name)

  if (c.group && !groupKeys.has(c.group)) fail(at, `group「${c.group}」不在 groups 里`)
  if (c.status && !STATUSES.has(c.status)) fail(at, `status「${c.status}」不是合法取值`)

  for (const arr of ['props', 'slots', 'events', 'demos']) {
    if (!Array.isArray(c[arr])) fail(at, `${arr} 必须是数组`)
  }
  for (const [i, d] of (c.demos || []).entries()) {
    if (!d.title) fail(at, `demos[${i}] 缺少 title`)
    if (!d.code) fail(at, `demos[${i}] 缺少 code`)
  }

  /* 对应 SFC 必须存在 */
  const sfc = path.join(SRC, 'vue', 'components', `${c.name}.vue`)
  if (!fs.existsSync(sfc)) fail(at, `找不到对应组件文件 src/vue/components/${c.name}.vue`)

  /* ---------- native 字段：这一层的边界必须写清楚 ---------- */
  const n = c.native
  if (!n) {
    fail(at, '缺少 native 字段 —— 每个组件都要说明「原生 HTML 侧有没有等价写法」')
    continue
  }
  if (typeof n.available !== 'boolean') fail(at, 'native.available 必须是布尔值')
  if (!n.note || n.note.length < 15) fail(at, 'native.note 太短，必须解释「有 / 没有等价写法」的原因')
  if (n.available && !n.code) fail(at, 'native.available=true 但没有给 code')

  /* ---------- native 示例代码里的类名必须在契约内 ---------- */
  if (n.code) {
    const classes = [...n.code.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].trim().split(/\s+/))
    for (const cls of new Set(classes)) {
      if (!knownTokens.has(cls)) {
        fail(at, `native.code 用了契约外的类名「${cls}」—— 文档教人写的类名必须真实存在`)
      }
    }
    if (!classes.length) notes.push(`${c.name}.native.code 不含库类名（Icon / OverflowTooltip 属正常：前者用 sprite，后者属行为）`)
  }
}

/* ==========================================================================
   3. 反向覆盖：每个 SFC 都要有文档条目
   ========================================================================== */
const vueDir = path.join(SRC, 'vue', 'components')
if (fs.existsSync(vueDir)) {
  for (const f of fs.readdirSync(vueDir).filter((f) => f.endsWith('.vue'))) {
    const name = f.replace(/\.vue$/, '')
    if (!seen.has(name)) fail('components.json', `组件 ${name}.vue 没有文档条目（组件存在但文档漏了）`)
  }
}

/* ==========================================================================
   4. AI 接入物是否齐全
   ========================================================================== */
for (const f of ['llms.txt', 'ai/copilot-instructions.md', 'ai/cursor-rules.mdc', 'ai/claude-skill/SKILL.md', '组件库分层与解耦规范.md']) {
  if (!fs.existsSync(path.join(LIB, f))) fail('库根', `缺少 ${f}`)
}

/* ---------- 输出 ---------- */
const summary = {
  ok: problems.length === 0,
  components: schema.components.length,
  withNative: schema.components.filter((c) => c.native?.available).length,
  withoutNative: schema.components.filter((c) => c.native && !c.native.available).length,
  contractTokens: knownTokens.size,
  problems,
}

if (JSON_OUT) {
  console.log(JSON.stringify(summary, null, 2))
} else {
  console.log(
    `[schema] ${schema.components.length} 个组件 · native 有等价写法 ${summary.withNative} / 无 ${summary.withoutNative} · ` +
      `类名校验集 ${knownTokens.size} 个 token`,
  )
  for (const n of notes) console.log(`  · ${n}`)
  if (problems.length) {
    console.error(`\n[schema] ✗ ${problems.length} 处问题：`)
    for (const p of problems) console.error(`  ${p.where}\n      ${p.msg}`)
  } else {
    console.log('[schema] ✓ 结构 / 覆盖 / 路径 / native 类名 全部通过')
  }
}

process.exit(problems.length ? 1 : 0)
