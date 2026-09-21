#!/usr/bin/env node
/**
 * gen-class-ownership.cjs — 生成「类名归属裁决表」
 *
 * 输入：coupling-probe.cjs 产出的 coupling.json（含 classFiles / fileUsed / dead / uncertain / conflicts）
 * 输出：docs/类名归属裁决表.md
 *
 * 原则：脚本只填**可复核的证据**（定义在哪、被谁用几次、是否命中动态前缀），
 *       以及**规则能推出的建议**；规则推不出的显式标为「需人工裁决」，不假装脚本能决定。
 *
 * 用法：
 *   node scripts/coupling-probe.cjs --root . --src src --out coupling.json
 *   node scripts/gen-class-ownership.cjs --json coupling.json --out docs/类名归属裁决表.md
 */
const fs = require('fs')
const path = require('path')

const argv = process.argv.slice(2)
const arg = (k, d) => {
  const i = argv.indexOf(k)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}
const ROOT = path.resolve(arg('--root', '.'))
const JSON_IN = path.resolve(ROOT, arg('--json', 'coupling.json'))
const OUT = path.resolve(ROOT, arg('--out', 'docs/类名归属裁决表.md'))

const data = JSON.parse(fs.readFileSync(JSON_IN, 'utf8'))
const { classFiles, dead, uncertain, conflicts, fileUsed, dynPrefixes, undefinedUsed, cssMeta } = data

const SHORT = (f) => {
  if (f === 'src/index.css') return 'index.css(根)'
  return f.replace(/^src\/styles\/demo1\//, '').replace(/^src\/styles\//, '')
}
const defineIn = (c) => (classFiles[c] || []).map(SHORT)

/* 使用方统计 */
const usage = {}
for (const [file, classes] of Object.entries(fileUsed)) {
  const zone = file.startsWith('src/components/') ? 'comp' : file.startsWith('src/pages/') ? 'page' : 'other'
  for (const c of classes) {
    usage[c] = usage[c] || { comp: 0, page: 0, other: 0, files: [] }
    usage[c][zone]++
    usage[c].files.push(file)
  }
}
const u = (c) => usage[c] || { comp: 0, page: 0, other: 0, files: [] }

/* 语义关键词：只在「组件与页面都在用」的僵局里提建议，不参与单侧用量的判定。
 * 匹配必须严格（等于 / 前缀- / -后缀），用 includes 会把 selected 误判成 select 控件。 */
const UI_WORDS = ['btn', 'input', 'select', 'textarea', 'tag', 'card', 'modal', 'checkbox', 'radio', 'switch', 'tooltip', 'chip', 'tree', 'pagination', 'field', 'label', 'form', 'icon', 'picker', 'dropdown', 'empty']
const HOST_WORDS = ['col-panel', 'list-item', 'page', 'section', 'panel', 'banner', 'stat', 'kpi', 'sidebar', 'route', 'table-wrap', 'highlight', 'upload-zone', 'main', 'topbar']
const kw = (list, c) => list.find((x) => c === x || c.startsWith(x + '-') || c.endsWith('-' + x))
const hintFor = (c, use) => {
  const total = use.comp + use.page + use.other
  if (total === 0) return { own: '需裁决', why: '模板中未见引用（可能由组合选择器生效）' }
  if (use.page === 0 && use.other === 0) return { own: '组件库', why: `仅组件在用（${use.comp} 处）` }
  if (use.comp === 0 && use.page === 0) return { own: '宿主', why: `仅 Shell/入口在用（${use.other} 处）` }
  if (use.comp === 0) return { own: '宿主', why: `仅页面在用（${use.page} 处）` }
  const ui = kw(UI_WORDS, c)
  const host = kw(HOST_WORDS, c)
  if (ui && !host) return { own: '组件库（建议）', why: `双方都用，名词含控件语义（${ui}）` }
  if (host && !ui) return { own: '宿主（建议）', why: `双方都用，名词含页面语义（${host}）` }
  return { own: '需裁决', why: `组件(${use.comp}) 与页面(${use.page}) 都在用，语义不可判` }
}

/* 分组 */
const buckets = { A: [], B: [], C: [], D: [], E: [], F: [], G: [] }
const BASE = ['layout.css', 'base.css', 'animations.css', 'theme.css', 'variables.css', 'fonts.css', 'tailwind.css', 'index.css(根)', 'index.css']
for (const c of Object.keys(classFiles).sort()) {
  const files = defineIn(c)
  const use = u(c)
  if (dead.includes(c)) buckets.A.push({ c, files, note: dynPrefixes.some((p) => c.startsWith(p)) ? '曾疑似动态前缀命中' : '' })
  else if (uncertain.includes(c)) buckets.B.push({ c, files, note: '由模板串拼装，取值空间未知' })
  else if (files.length > 1) buckets.C.push({ c, files, use, hint: hintFor(c, use) })
  else if (files[0] === 'components.css') buckets.D.push({ c, files, use })
  else if (files[0] === 'pages.css') {
    if (use.comp > 0 && use.page === 0) buckets.F.push({ c, files, use })
    else buckets.E.push({ c, files, use })
  } else if (BASE.includes(files[0])) buckets.G.push({ c, files, use })
  else buckets.G.push({ c, files, use })
}

const esc = (s) => String(s).replace(/\|/g, '\\|')
const L = []
L.push('# 类名归属裁决表')
L.push('')
L.push('> 由 `scripts/coupling-probe.cjs` + `scripts/gen-class-ownership.cjs` 生成，可随时重跑。')
L.push('> 证据字段（定义于 / 组件用 / 页面用）来自静态解析，可复核；**建议归属**中规则推不出的部分标为「需裁决」。')
L.push('')
L.push('## 复现')
L.push('')
L.push('```bash')
L.push('node scripts/coupling-probe.cjs --root . --src src --out coupling.json')
L.push('node scripts/gen-class-ownership.cjs --json coupling.json --out docs/类名归属裁决表.md')
L.push('```')
L.push('')
L.push('## 汇总')
L.push('')
L.push('| 分组 | 数量 | 含义 | 谁来决定 |')
L.push('| --- | --- | --- | --- |')
L.push(`| A 删除候选 | ${buckets.A.length} | 定义在 CSS 但无任何模板引用 | 先确认无动态引用，可交脚本批量删 |`)
L.push(`| B 人工核对 | ${buckets.B.length} | 由模板串拼装，静态判不出 | 前端确认取值空间 |`)
L.push(`| C 同名冲突 | ${buckets.C.length} | 被多个样式表定义，后加载者胜 | **需设计裁决** |`)
L.push('| D 归组件库 | ' + buckets.D.length + ' | 仅 `components.css` 定义且组件在用 | 规则可判 |')
L.push('| E 归宿主 | ' + buckets.E.length + ' | 仅 `pages.css` 定义且页面在用 | 规则可判 |')
L.push('| F 需搬迁 | ' + buckets.F.length + ' | 定义在 `pages.css`，但只有组件在用 | **需裁决**（组件越界依赖） |')
L.push('| G 基础层 | ' + buckets.G.length + ' | `layout/base/animations/theme` 与令牌层 | 留宿主 |')
L.push(`| — 幽灵类名 | ${undefinedUsed.length} | markup 用了但无定义，无归属可裁 | 见下方附注 |`)
L.push('')
L.push('决策口径提醒：判定同名冲突的胜负看 `src/styles/index.css` 的 `@import` 顺序（`components.css` 第 9 行 → `pages.css` 第 10 行，**后者胜**），不看文件职责。')
L.push('')

L.push(`## C 同名冲突（${buckets.C.length}）—— 必须逐条裁决`)
L.push('')
L.push('这三列是证据：`定义于` 列出所有定义该类的样式表；`组件用`/`页面用`/`入口用` 是模板引用次数（`src/Shell.vue`、`RootShell.vue` 等归入「入口用」）。')
L.push('')
L.push('判定优先级：**用量证据优先于语义猜测**——只被组件用 → 归库；只被页面用 → 归宿主；双方都在用才看语义关键词；语义也不可判的标为「需裁决」。')
L.push('')
L.push('读表时注意两点：')
L.push('')
L.push('1. **用量只统计静态类名。** 由模板串动态拼装的（如 `` `tag ${cls}` ``）无法计数，因此某个类的用量为 1 不代表它只出现一次。')
L.push('2. **同一控件的变体必须作为一族一起裁决。** 例如本表把 `btn`/`btn-ghost` 判给库、却把 `btn-primary`/`btn-secondary` 判给宿主——那是因为组件只静态用了前两个、页面用了后两个。**这不代表它们该分开**：`.btn` 的变体是同一份配方的组成，必须整体归一处，按单类用量拆开会立刻产生「库里有 `.btn` 但没有 `.btn-primary`」的残缺。')
L.push('')
L.push('| 类名 | 定义于 | 组件用 | 页面用 | 入口用 | 建议归属 | 依据 |')
L.push('| --- | --- | --- | --- | --- | --- | --- |')
for (const x of buckets.C) {
  L.push(`| \`${esc(x.c)}\` | ${x.files.join(' + ')} | ${x.use.comp} | ${x.use.page} | ${x.use.other} | ${x.hint.own} | ${x.hint.why} |`)
}
L.push('')

L.push(`## F 需搬迁（${buckets.F.length}）—— 组件越界依赖页面样式`)
L.push('')
L.push('这些类只定义在 `pages.css`，却只被组件使用。搬到组件库时必须连样式一起搬，否则组件失去外观。')
L.push('')
L.push('| 类名 | 定义于 | 组件用 | 使用方 |')
L.push('| --- | --- | --- | --- |')
for (const x of buckets.F) L.push(`| \`${esc(x.c)}\` | ${x.files.join(' + ')} | ${x.use.comp} | ${[...new Set(x.use.files)].map(SHORT).join(', ')} |`)
if (!buckets.F.length) L.push('（本组为空：组件对 `pages.css` 的越界依赖，都是「组件与页面双方都在用」的类，因此归入 C 同名冲突组裁决。）')
L.push('')

L.push(`## B 人工核对（${buckets.B.length}）—— 动态拼装，静态判不出`)
L.push('')
L.push('这些类名由模板串拼装而成，脚本只能推出前缀。**在确认真实取值空间之前，不要删也不要归库。**')
L.push('')
L.push('| 类名 | 定义于 | 备注 |')
L.push('| --- | --- | --- |')
for (const x of buckets.B) L.push(`| \`${esc(x.c)}\` | ${x.files.join(' + ')} | ${x.note} |`)
L.push('')

L.push(`## D 归组件库（${buckets.D.length}）`)
L.push('')
L.push('| 类名 | 定义于 | 组件用 | 页面用 |')
L.push('| --- | --- | --- | --- |')
for (const x of buckets.D) L.push(`| \`${esc(x.c)}\` | ${x.files.join(' + ')} | ${x.use.comp} | ${x.use.page} |`)
L.push('')

L.push(`## E 归宿主（${buckets.E.length}）`)
L.push('')
L.push('| 类名 | 定义于 | 组件用 | 页面用 |')
L.push('| --- | --- | --- | --- |')
for (const x of buckets.E) L.push(`| \`${esc(x.c)}\` | ${x.files.join(' + ')} | ${x.use.comp} | ${x.use.page} |`)
L.push('')

L.push(`## G 基础层（${buckets.G.length}）—— 留宿主`)
L.push('')
L.push('| 类名 | 定义于 | 组件用 | 页面用 |')
L.push('| --- | --- | --- | --- |')
for (const x of buckets.G) L.push(`| \`${esc(x.c)}\` | ${x.files.join(' + ')} | ${x.use.comp} | ${x.use.page} |`)
L.push('')

L.push(`## A 删除候选（${buckets.A.length}）`)
L.push('')
L.push('定义在 CSS 里，但任何模板都没有引用。删除前请先确认：这些类没有被字符串拼接动态产生。')
L.push('')
const byFile = {}
for (const x of buckets.A) for (const f of x.files) (byFile[f] = byFile[f] || []).push(x.c)
for (const [f, arr] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length)) {
  L.push(`### ${f}（${arr.length}）`)
  L.push('')
  L.push('```')
  for (let i = 0; i < arr.length; i += 8) L.push(arr.slice(i, i + 8).join('  '))
  L.push('```')
  L.push('')
}

L.push(`## 附注：幽灵类名（${undefinedUsed.length}）`)
L.push('')
L.push('这些类名被模板引用，但任何样式表都没有定义它们 —— 没有归属可裁，它们是「组件不存在」的证据（样式靠同行内联 `style` 撑着）。')
L.push('')
L.push('```')
for (let i = 0; i < undefinedUsed.length; i += 6) L.push(undefinedUsed.slice(i, i + 6).map((c) => c.padEnd(28)).join(''))
L.push('```')
L.push('')

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, L.join('\n'), 'utf8')
console.log(`A ${buckets.A.length} / B ${buckets.B.length} / C ${buckets.C.length} / D ${buckets.D.length} / E ${buckets.E.length} / F ${buckets.F.length} / G ${buckets.G.length}`)
console.log(`-> ${OUT}`)
