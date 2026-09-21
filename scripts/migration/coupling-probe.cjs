#!/usr/bin/env node
/**
 * coupling-probe.cjs — 前端样式耦合度静态探测
 *
 * 回答三个问题：
 *   1. 这堆 CSS 里有多少是死的？（决定能否安全清理/搬运）
 *   2. 组件和样式到底怎么耦合的？（决定"抽组件库"是否抽得出外观）
 *   3. 重复写了几遍？（重复处就是还没被抽象出来的组件边界）
 *
 * 无外部依赖。用法：
 *   node coupling-probe.cjs --root . --src src [--out coupling.json]
 *
 * 输出：stdout 摘要 + <out> JSON。摘要面向人读，JSON 供后续脚本聚合。
 */
const fs = require('fs')
const path = require('path')

const argv = process.argv.slice(2)
const arg = (k, d) => {
  const i = argv.indexOf(k)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}
const ROOT = path.resolve(arg('--root', '.'))
const SRC = path.resolve(ROOT, arg('--src', 'src'))
const OUT = path.resolve(ROOT, arg('--out', 'coupling.json'))

const walk = (dir, exts, out = []) => {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue
      walk(p, exts, out)
    } else if (exts.some((x) => e.name.endsWith(x))) out.push(p)
  }
  return out
}
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/')

/* ---------- 1) 稳健提取 CSS 选择器中的 class ----------
 * 陷阱：不要用「前一字符是 } 或行首」的正则——会漏掉 @media / @supports 块内的全部规则。
 * 正确做法：对每个 '{'，向前回溯到最近的 '{' | '}' | ';'，中间那段即选择器。
 */
function extractClasses(text) {
  const t = text.replace(/\/\*[\s\S]*?\*\//g, '')
  const found = new Set()
  let i = -1
  while ((i = t.indexOf('{', i + 1)) !== -1) {
    const start = Math.max(t.lastIndexOf('{', i - 1), t.lastIndexOf('}', i - 1), t.lastIndexOf(';', i - 1))
    const sel = t.slice(start + 1, i).trim()
    if (!sel || sel.startsWith('@')) continue
    let m
    const re = /\.(-?[A-Za-z_][\w-]*)/g
    while ((m = re.exec(sel))) found.add(m[1])
  }
  return found
}

const cssFiles = walk(path.join(SRC, 'styles'), ['.css']).concat(
  fs.existsSync(path.join(SRC, 'index.css')) ? [path.join(SRC, 'index.css')] : []
)
const classFiles = {}
const cssMeta = []
for (const f of cssFiles) {
  const txt = fs.readFileSync(f, 'utf8')
  const set = extractClasses(txt)
  cssMeta.push({ file: rel(f), lines: txt.split('\n').length, classes: set.size })
  for (const c of set) (classFiles[c] = classFiles[c] || new Set()).add(rel(f))
}
const defined = new Set(Object.keys(classFiles))

/* ---------- 2) Vue 使用面：字面量 + 动态前缀 ---------- */
const vueFiles = walk(SRC, ['.vue'])
const literal = new Set()
const dynPrefixes = new Set()
const fileUsed = {}
const fileInline = {}
const inlineGroups = {}

const norm = (s) => s.replace(/\s+/g, '').replace(/;+$/, '').toLowerCase()

for (const f of vueFiles) {
  const txt = fs.readFileSync(f, 'utf8')
  const r = rel(f)
  const used = new Set()

  let m
  /* 陷阱：`:class="..."` 里含有子串 `class="`，若只用 /\bclass="([^"]*)"/ 会把绑定表达式
   * 也当成静态类名，进而把 `node.owned` / `currentSys.systemCode` 这类表达式片段算成类名
   * （表现为幽灵 class 数量虚高）。必须用否定后顾排除带冒号的绑定形式，并统一做标识符校验。 */
  const staticRe = /(?<!:)class="([^"]*)"/g
  while ((m = staticRe.exec(txt))) {
    m[1].split(/\s+/).forEach((x) => { if (/^[A-Za-z_][\w-]*$/.test(x)) { used.add(x); literal.add(x) } })
  }

  const bindRe = /\s:class="([\s\S]*?)"/g
  while ((m = bindRe.exec(txt))) {
    const inner = m[1]
    let q
    const tplRe = /`([^`]*)`/g
    while ((q = tplRe.exec(inner))) {
      const s = q[1]
      if (!s.includes('${')) { s.split(/\s+/).forEach((x) => { if (x) { used.add(x); literal.add(x) } }); continue }
      const vars = s.match(/\$\{[^}]*\}/g) || []
      const parts = s.split(/\$\{[^}]*\}/)
      parts.forEach((p, idx) => {
        const toks = p.split(/\s+/).filter(Boolean)
        toks.forEach((tk, j) => {
          if (idx < vars.length && j === toks.length - 1) {
            const pre = tk.replace(/-$/, '')
            if (pre && /^[A-Za-z_]/.test(pre)) dynPrefixes.add(pre + '-')
          } else if (/^[A-Za-z_][\w-]*$/.test(tk)) { used.add(tk); literal.add(tk) }
        })
      })
    }
    const strRe = /'([^']*)'|"([^"]*)"/g
    while ((q = strRe.exec(inner))) {
      const v = q[1] || q[2] || ''
      if (!v || v.includes('${')) continue
      v.split(/\s+/).forEach((x) => { if (/^[A-Za-z_][\w-]*$/.test(x)) { used.add(x); literal.add(x) } })
    }
  }
  fileUsed[r] = used

  // 内联 style 重复度
  let n = 0
  const sRe = /style="([^"]*)"/g
  while ((m = sRe.exec(txt))) {
    n++
    const k = norm(m[1])
    if (k.length < 12) continue
    ;(inlineGroups[k] = inlineGroups[k] || { sample: m[1].replace(/\s+/g, ' ').slice(0, 140), at: [] }).at.push(
      r + ':' + txt.slice(0, m.index).split('\n').length
    )
  }
  fileInline[r] = n
}

/* ---------- 3) 人工补充动态枚举（项目相关，按需改这里）----------
 * 模板串只能推出前缀，推不出取值空间。把这些枚举补上才不会误报死 CSS。
 * 例：IconTile 的 tone 默认 'blue' + 页面里的 TONES 数组；shared.ts 的状态→类名映射。
 */
const EXTRA_DYNAMIC = []
for (const v of EXTRA_DYNAMIC) literal.add(v)

/* ---------- 4) 判定 ---------- */
const dead = []
const uncertain = []
for (const c of defined) {
  if (literal.has(c)) continue
  if ([...dynPrefixes].some((p) => c.startsWith(p))) uncertain.push(c)
  else dead.push(c)
}
const undefinedUsed = [...literal].filter((c) => !defined.has(c))

/* ---------- 5) import 入度 → 区分组件与路由页 ---------- */
const inDeg = {}
const importedBy = {}
for (const f of vueFiles) inDeg[rel(f)] = 0
for (const f of vueFiles) {
  const txt = fs.readFileSync(f, 'utf8')
  let m
  const re = /from\s+['"](\.[^'"]+)['"]/g
  while ((m = re.exec(txt))) {
    let t = path.resolve(path.dirname(f), m[1])
    if (!t.endsWith('.vue')) t += '.vue'
    const k = rel(t)
    if (inDeg[k] !== undefined) {
      inDeg[k]++
      ;(importedBy[k] = importedBy[k] || []).push(rel(f))
    }
  }
}
const orphans = Object.entries(inDeg).filter(([, n]) => n === 0)

/* ---------- 6) 一个 class 被几个样式表定义（>1 = 冲突，谁后加载谁赢）---------- */
const conflicts = [...defined].filter((c) => classFiles[c].size > 1)

const dupInline = Object.entries(inlineGroups)
  .map(([k, v]) => ({ key: k, sample: v.sample, n: v.at.length, at: v.at }))
  .filter((g) => g.n >= 2)
  .sort((a, b) => b.n - a.n)
const dupSaved = dupInline.reduce((a, g) => a + g.n - 1, 0)

/* ---------- 输出 ---------- */
const L = []
L.push('== CSS ==')
for (const c of cssMeta.sort((a, b) => b.classes - a.classes)) {
  L.push(`  ${c.file.padEnd(36)} ${String(c.lines).padStart(5)} 行  ${String(c.classes).padStart(4)} class`)
}
L.push(`  合计 ${cssMeta.reduce((a, b) => a + b.lines, 0)} 行 / class 去重 ${defined.size}`)
L.push('')
L.push('== 契约面 ==')
L.push(`  .vue 文件 ${vueFiles.length}`)
L.push(`  模板字面量引用 ${[...defined].filter((c) => literal.has(c)).length}`)
L.push(`  死 class（无字面量、无动态前缀） ${dead.length}  (${Math.round((dead.length / Math.max(1, defined.size)) * 100)}%)`)
L.push(`  动态不可判 ${uncertain.length}`)
L.push(`  用了但 CSS 未定义（幽灵） ${undefinedUsed.length}`)
L.push(`  被多个样式表定义（冲突） ${conflicts.length}`)
L.push(`  内联 style 总数 ${Object.values(fileInline).reduce((a, b) => a + b, 0)}`)
L.push(`  完全重复的内联 style ${dupInline.length} 组 / 可省 ${dupSaved} 处`)
L.push('')
L.push('  死 class 按文件：')
const deadByFile = {}
for (const c of dead) for (const f of classFiles[c]) (deadByFile[f] = deadByFile[f] || []).push(c)
for (const [f, arr] of Object.entries(deadByFile).sort((a, b) => b[1].length - a[1].length)) {
  L.push(`    ${f.padEnd(30)} ${String(arr.length).padStart(3)}: ${arr.slice(0, 20).join(' ')}${arr.length > 20 ? ' …' : ''}`)
}
L.push('')
L.push('  冲突 class（同名校验必查）：')
L.push('    ' + conflicts.join(' '))
L.push('')
L.push('  幽灵 class（markup 指向空）：')
L.push('    ' + undefinedUsed.slice(0, 80).join(' '))
L.push('')
L.push('== 零引用组件（可能是废弃，也可能是页面手写实现绕过了它）==')
for (const [f] of orphans) L.push(`  ${f}`)
L.push('')
L.push('== 重复最多的内联 style（重复处 = 待抽象组件边界）==')
for (const g of dupInline.slice(0, 20)) {
  L.push(`  ×${g.n}  ${g.sample}`)
  L.push(`        ${g.at.slice(0, 6).join('  ')}${g.at.length > 6 ? ' …' : ''}`)
}

console.log(L.join('\n'))
fs.writeFileSync(
  OUT,
  JSON.stringify(
    { root: ROOT, src: rel(SRC), cssMeta, defined: defined.size, dead, uncertain, dynPrefixes: [...dynPrefixes], undefinedUsed, conflicts, inDeg, importedBy, orphans: orphans.map(([f]) => f), fileUsed: Object.fromEntries(Object.entries(fileUsed).map(([k, v]) => [k, [...v]])), fileInline, dupInline, classFiles: Object.fromEntries(Object.entries(classFiles).map(([k, v]) => [k, [...v]])) },
    null,
    2
  ),
  'utf8'
)
console.log(`\nJSON -> ${rel(OUT)}`)
