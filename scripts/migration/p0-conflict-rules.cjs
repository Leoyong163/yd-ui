#!/usr/bin/env node
/**
 * p0-conflict-rules.cjs — P0-T2 的决策依据：冲突类的**规则形态**与归属判定
 *
 * 为什么需要它：
 *   `@import` 顺序决定 components.css 与 pages.css 里同名类的胜负（后者胜）。
 *   所以「把某类判给库」若只是改归属、不处理两份定义，外观就会变。
 *   但反过来——**同名不等于冲突**。必须先看每份定义的形态：
 *
 *     bare      `.tag { … }`            基础配方本体
 *     state     `.tag:hover { … }`      基础配方的状态分支
 *     theme     `[data-theme="dark"] .tag { … }`  基础配方的主题分支
 *     modifier  `.tag.active { … }`     基础配方的组合修饰
 *     scoped    `.approval-actions .btn { … }`    页面上下文覆盖 ← **不是冲突**
 *
 *   本项目 pages.css 里大量“同名定义”其实是 scoped 形态（只在某个页面容器内微调），
 *   把这类判成冲突会导致 46 条“必须人工合并”的假警报，把真正要处理的那几条淹掉。
 *
 * 判定：
 *   DUP_BASE     双方都有基础形态 → **真冲突**，必须合并去重后归一处
 *   SCOPED_ONLY  只有一方是基础形态，另一方全是 scoped → 假冲突，归基础侧，scoped 原样留宿主
 *   SCOPED_BOTH  双方都只有 scoped 形态 → 归属由语义与用量定，两份都保留但需明确层级
 *
 * 用法：
 *   node scripts/p0-conflict-rules.cjs [--table docs/类名归属裁决表.md] \
 *        [--styles src/styles/demo1] [--json out.json] [--md out.md]
 */
const fs = require('fs')
const path = require('path')

function arg(name, def) {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}

const TABLE = path.resolve(arg('table', 'docs/类名归属裁决表.md'))
const STYLES = path.resolve(arg('styles', 'src/styles/demo1'))
const ORDER = (arg('order', 'variables.css,base.css,layout.css,components.css,pages.css,animations.css') || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const JSON_OUT = arg('json', '')
const MD_OUT = arg('md', '')

/* ---------------- CSS 解析 ---------------- */
const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '')
function parseRules(text) {
  const t = stripComments(text)
  const out = []
  let i = 0
  while (i < t.length) {
    let j = i
    while (j < t.length && t[j] !== '{' && t[j] !== '}' && t[j] !== ';') j++
    if (j >= t.length) break
    if (t[j] === '}' || t[j] === ';') {
      i = j + 1
      continue
    }
    const prelude = t.slice(i, j).trim()
    let depth = 1
    let k = j + 1
    while (k < t.length && depth > 0) {
      if (t[k] === '{') depth++
      else if (t[k] === '}') depth--
      k++
    }
    const body = t.slice(j + 1, k - 1)
    if (prelude.startsWith('@')) {
      const at = prelude.replace(/\s+/g, ' ')
      for (const r of parseRules(body)) out.push({ at: at + (r.at ? ' & ' + r.at : ''), sel: r.sel, body: r.body })
    } else {
      const sel = prelude.replace(/\s+/g, ' ')
      // 一个 prelude 可能是逗号分组的选择器列表，拆成单条
      for (const one of sel.split(',').map((s) => s.trim()).filter(Boolean)) out.push({ at: null, sel: one, body })
    }
    i = k
  }
  return out
}
function declsOf(body) {
  const map = {}
  for (const part of body.split(';')) {
    const s = part.trim()
    if (!s) continue
    const idx = s.indexOf(':')
    if (idx < 0) continue
    const prop = s.slice(0, idx).trim().toLowerCase()
    const val = s.slice(idx + 1).trim().replace(/\s+/g, ' ')
    if (prop) map[prop] = val
  }
  return map
}
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')
}
function hasClass(sel, c) {
  return new RegExp('\\.' + escapeRe(c) + '(?![\\w-])').test(sel)
}

/**
 * 把一条规则按 `.c` 出现的形态归类。
 * 做法：找到含 `.c` 的那个复合选择器（compound），看它是不是等于 `.c` 或 `.c` + 状态伪类，
 * 以及它前面有没有祖先/兄弟上下文。
 */
function classify(sel, c, at) {
  const clsRe = new RegExp('\\.' + escapeRe(c) + '(?![\\w-])')
  const compounds = sel.split(/\s*(?:>|\+|~)\s*|\s+/).filter(Boolean)
  let idx = -1
  for (let i = 0; i < compounds.length; i++) {
    if (clsRe.test(compounds[i])) {
      idx = i
      break
    }
  }
  if (idx < 0) return { kind: 'other', context: null }
  const comp = compounds[idx]
  const ancestor = compounds.slice(0, idx).join(' ')
  // 去掉 .c 本身后，看这个复合选择器还剩下什么
  const rest = comp.replace(clsRe, '')
  const isThemePrefix = /^\[data-theme/.test(compounds[0] || '') && idx === 1
  const restIsPseudoOnly = rest === '' || /^(:{1,2}[-\w()]+)+$/.test(rest)

  if (!ancestor && restIsPseudoOnly) {
    const hasState = /^:/.test(rest)
    if (isThemePrefix) return { kind: 'theme', context: at }
    return { kind: hasState ? 'state' : 'bare', context: at, pseudo: rest || null }
  }
  if (ancestor && /^\[data-theme/.test(ancestor) && restIsPseudoOnly) return { kind: 'theme', context: ancestor + (at ? ' @' + at : '') }
  if (!ancestor && !restIsPseudoOnly) return { kind: 'modifier', context: rest }
  return { kind: 'scoped', context: (ancestor ? ancestor + ' ' : '') + '.' + c + rest }
}

const BASE_KINDS = new Set(['bare', 'state', 'theme', 'modifier'])
const KIND_LABEL = { bare: '本体', state: '状态', theme: '主题', modifier: '修饰', scoped: '页面上下文', other: '其他' }

/* ---------------- 取冲突类名 ---------------- */
if (!fs.existsSync(TABLE)) {
  console.error('table not found: ' + TABLE)
  process.exit(1)
}
const conflicts = []
{
  let inC = false
  for (const line of fs.readFileSync(TABLE, 'utf8').split(/\r?\n/)) {
    if (/^##\s+C\s/.test(line)) {
      inC = true
      continue
    }
    if (inC && /^##\s/.test(line)) break
    if (!inC) continue
    const m = line.match(/^\|\s*`([^`]+)`\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|/)
    if (!m) continue
    const cls = m[1].trim()
    if (/\s/.test(cls)) continue
    conflicts.push({
      cls,
      defined: m[2].split('+').map((s) => s.trim()).filter(Boolean),
      byComp: parseInt(m[3], 10) || 0,
      byPage: parseInt(m[4], 10) || 0,
      byEntry: parseInt(m[5], 10) || 0,
    })
  }
}

/* ---------------- 解析样式表 ---------------- */
const files = {}
for (const f of ORDER) {
  const p = path.join(STYLES, f)
  if (fs.existsSync(p)) files[f] = parseRules(fs.readFileSync(p, 'utf8'))
}

/* ---------------- 逐类判定 ---------------- */
const orderIdx = (f) => ORDER.indexOf(f)
const results = []
for (const c of conflicts) {
  const per = {}
  for (const f of Object.keys(files)) {
    const kinds = { bare: [], state: [], theme: [], modifier: [], scoped: [], other: [] }
    const merged = {}
    let n = 0
    for (const r of files[f]) {
      if (!hasClass(r.sel, c.cls)) continue
      n++
      const k = classify(r.sel, c.cls, r.at)
      kinds[k.kind].push((r.at ? r.at + ' ' : '') + r.sel)
      if (BASE_KINDS.has(k.kind)) Object.assign(merged, declsOf(r.body))
    }
    if (n === 0) continue
    per[f] = { ruleCount: n, counts: Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, v.length])), kinds, baseDecl: merged, hasBase: BASE_KINDS.has('bare') ? kinds.bare.length + kinds.state.length + kinds.theme.length + kinds.modifier.length > 0 : false }
    per[f].hasBase = kinds.bare.length + kinds.state.length + kinds.theme.length + kinds.modifier.length > 0
  }
  const present = Object.keys(per).sort((a, b) => orderIdx(a) - orderIdx(b))
  const baseSide = present.filter((f) => per[f].hasBase)
  const scopedOnly = present.filter((f) => !per[f].hasBase)

  let verdict
  if (baseSide.length >= 2) verdict = 'DUP_BASE'
  else if (baseSide.length === 1) verdict = 'SCOPED_ONLY'
  else verdict = 'SCOPED_BOTH'

  const owner = baseSide.length === 1 ? baseSide[0] : baseSide.length >= 2 ? baseSide.sort((a, b) => orderIdx(b) - orderIdx(a))[0] : present.sort((a, b) => orderIdx(b) - orderIdx(a))[0]

  // 真冲突才需要算"丢了哪些声明"
  let staleProps = []
  let lostProps = []
  if (verdict === 'DUP_BASE') {
    const finals = baseSide.slice().sort((a, b) => orderIdx(a) - orderIdx(b))
    const last = per[finals[finals.length - 1]].baseDecl
    for (const f of finals.slice(0, -1)) {
      const d = per[f].baseDecl
      for (const p of Object.keys(d)) {
        if (!(p in last)) lostProps.push(f + ':' + p)
        else if (last[p] !== d[p]) staleProps.push(`${p}(${d[p]} vs ${last[p]})`)
      }
    }
  }

  results.push({
    cls: c.cls,
    verdict,
    baseSide,
    scopedSide: scopedOnly,
    owner,
    per,
    staleProps,
    lostProps,
    scopedCtx: scopedOnly.flatMap((f) => per[f].kinds.scoped).slice(0, 4),
    byComp: c.byComp,
    byPage: c.byPage,
    byEntry: c.byEntry,
  })
}

const tally = results.reduce((a, r) => ((a[r.verdict] = (a[r.verdict] || 0) + 1), a), {})

/* ---------------- 输出 ---------------- */
if (JSON_OUT) fs.writeFileSync(path.resolve(JSON_OUT), JSON.stringify({ order: ORDER, tally, results }, null, 1), 'utf8')

if (MD_OUT) {
  const L = []
  const g = (v) => results.filter((r) => r.verdict === v)
  L.push('# P0-T2 冲突类规则形态分析（裁决依据）', '')
  L.push('> 由 `scripts/p0-conflict-rules.cjs` 生成。加载顺序：' + ORDER.join(' → ') + '（**后者胜**）。', '')
  L.push('## 一、结论先行', '')
  L.push('「同名」不等于「冲突」。按规则形态拆开后：', '')
  L.push('| 判定 | 数量 | 含义 | 处置 |')
  L.push('| --- | --- | --- | --- |')
  L.push(`| DUP_BASE 真冲突 | ${(tally.DUP_BASE || 0)} | 两侧都定义了基础配方本体，后者静默覆盖前者 | **必须合并去重**，再定归属 |`)
  L.push(`| SCOPED_ONLY 假冲突 | ${(tally.SCOPED_ONLY || 0)} | 一侧是基础配方，另一侧只是页面容器内的局部微调 | 基础侧归一处，微调原样留宿主 |`)
  L.push(`| SCOPED_BOTH | ${(tally.SCOPED_BOTH || 0)} | 两侧都只是局部微调，没有本体 | 归属按语义定，两份各自保留 |`)
  L.push('')
  if (g('DUP_BASE').length) {
    L.push('## 二、真冲突（DUP_BASE）—— 必须逐条合并', '')
    L.push('这些类在两个样式表里都有**本体级**定义，后加载的静默获胜。改归属前必须先合并。', '')
    L.push('| 类名 | 基础侧 | 实际生效者 | 同属性不同值（搬走会改观感） | 被覆盖丢掉的声明 | 组件用 | 页面用 |')
    L.push('| --- | --- | --- | --- | --- | --- | --- |')
    for (const r of g('DUP_BASE')) {
      L.push(`| \`${r.cls}\` | ${r.baseSide.join(' + ')} | ${r.owner} | ${r.staleProps.join('; ') || '—'} | ${r.lostProps.slice(0, 6).join('; ') || '—'} | ${r.byComp} | ${r.byPage} |`)
    }
    L.push('')
  }
  L.push('## 三、假冲突（SCOPED_ONLY）—— 归属已明确，无需合并', '')
  L.push('这些类的 pages.css 定义全部是**带祖先限定的页面上下文覆盖**，不是本体重定义。', '')
  L.push('基础配方归基础侧文件，页面微调按原样保留在宿主，二者是层级关系而非竞争关系。', '')
  L.push('| 类名 | 基础配方在 | 页面上下文覆盖在 | 覆盖示例（前 2 条） | 组件用 | 页面用 |')
  L.push('| --- | --- | --- | --- | --- | --- |')
  for (const r of g('SCOPED_ONLY')) {
    L.push(`| \`${r.cls}\` | ${r.baseSide.join(' + ')} | ${r.scopedSide.join(' + ') || '—'} | ${r.scopedCtx.slice(0, 2).map((s) => '`' + s + '`').join(', ') || '—'} | ${r.byComp} | ${r.byPage} |`)
  }
  L.push('')
  if (g('SCOPED_BOTH').length) {
    L.push('## 四、双侧仅局部微调（SCOPED_BOTH）', '')
    L.push('| 类名 | 定义于 | 组件用 | 页面用 | 入口用 |')
    L.push('| --- | --- | --- | --- | --- |')
    for (const r of g('SCOPED_BOTH')) L.push(`| \`${r.cls}\` | ${Object.keys(r.per).join(' + ')} | ${r.byComp} | ${r.byPage} | ${r.byEntry} |`)
    L.push('')
  }
  L.push('## 五、全部明细', '')
  L.push('| 类名 | 判定 | 生效者 | 本体 | 状态 | 主题 | 修饰 | 页面上下文 |')
  L.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const r of results) {
    const tot = { bare: 0, state: 0, theme: 0, modifier: 0, scoped: 0 }
    for (const f of Object.keys(r.per)) for (const k of Object.keys(tot)) tot[k] += r.per[f].counts[k] || 0
    L.push(`| \`${r.cls}\` | ${r.verdict} | ${r.owner} | ${tot.bare} | ${tot.state} | ${tot.theme} | ${tot.modifier} | ${tot.scoped} |`)
  }
  fs.writeFileSync(path.resolve(MD_OUT), L.join('\n'), 'utf8')
}

console.log('CONFLICTS=' + results.length)
console.log('TALLY=' + JSON.stringify(tally))
console.log('DUP_BASE=' + g0(results, 'DUP_BASE').map((r) => r.cls).join(' '))
function g0(arr, v) {
  return arr.filter((r) => r.verdict === v)
}
const sc = g0(results, 'SCOPED_ONLY')
console.log('SCOPED_ONLY_SAMPLE=' + sc.slice(0, 12).map((r) => r.cls + '(' + r.scopedCtx.length + ')').join(' '))
if (MD_OUT) console.log('MD -> ' + path.resolve(MD_OUT))
