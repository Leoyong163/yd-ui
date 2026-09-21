#!/usr/bin/env node
/**
 * p0-dead-verify.cjs — P0-T4：把"删除候选"逐条钉死
 *
 * 探测器（coupling-probe）判"死"的依据是**模板里没有静态 class 引用**。
 * 但有两类会因此被误判，直接照单删除会出事：
 *
 *   1. antd 运行时类名。`ant-form-item-label`、`ant-select-item-option-selected` 这类
 *      从不写在模板里，是 antd 自己生成的——我们的 CSS 只是在给它上主题色。
 *      删掉 = 暗色表单立刻回退成默认色。
 *   2. 由字符串拼装的状态类。`dragover`、`is-loading`、`has-error` 由 JS 切换，
 *      静态扫描看不到。删掉 = 交互态失效。
 *
 * 本脚本对所有源文件做**全文词面搜索**（含 .vue/.ts 里的模板串、三元、数组常量），
 * 逐条给出可否删除。
 *
 * 用法：
 *   node scripts/p0-dead-verify.cjs [--table docs/类名归属裁决表.md] [--src src] \
 *        [--md out.md] [--json out.json]
 */
const fs = require('fs')
const path = require('path')

function arg(name, def) {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}
const TABLE = path.resolve(arg('table', 'docs/类名归属裁决表.md'))
const SRC = path.resolve(arg('src', 'src'))
const MD_OUT = arg('md', '')
const JSON_OUT = arg('json', '')

/* ---------- 1) 取 A 组（删除候选）清单，按样式表分组 ---------- */
if (!fs.existsSync(TABLE)) {
  console.error('table not found: ' + TABLE)
  process.exit(1)
}
const lines = fs.readFileSync(TABLE, 'utf8').split(/\r?\n/)
let inA = false
let curFile = null
const dead = [] // { cls, file }
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  if (/^##\s+A\s/.test(line)) {
    inA = true
    continue
  }
  if (inA && /^##\s/.test(line)) break
  if (!inA) continue
  const h = line.match(/^###\s+(\S+?)（(\d+)）/)
  if (h) {
    curFile = h[1]
    continue
  }
  if (line.trim() === '```') {
    // 收集到下一个 ```
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() === '```') {
        i = j
        break
      }
      for (const c of lines[j].trim().split(/\s+/).filter(Boolean)) dead.push({ cls: c, file: curFile })
    }
  }
}

/* ---------- 2) 收集源文件全文（排除样式表本身） ---------- */
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue
      walk(p, out)
    } else if (/\.(vue|ts|tsx|js|jsx|html)$/.test(e.name)) out.push(p)
  }
  return out
}
const files = walk(SRC)
for (const extra of ['index.html']) {
  const p = path.resolve(extra)
  if (fs.existsSync(p)) files.push(p)
}
const corpus = files.map((f) => {
  const raw = fs.readFileSync(f, 'utf8')
  // 只保留"字符串字面量"参与匹配。
  // 为什么：若对全文做词面搜索，`const success = ...`、`pending` 作为变量名、
  // `error` 作为 prop 名都会命中的，会把大量真死类误判成"还活着"。
  // 类名只会出现在引号/反引号里，所以先抽字符串再匹配。
  const strings = []
  const re = /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g
  let m
  while ((m = re.exec(raw))) strings.push(m[0])
  return { rel: path.relative(process.cwd(), f).replace(/\\/g, '/'), raw, strings, joined: strings.join('\n') }
})

/* ---------- 3) 逐条判定 ---------- */
// 所有 CSS 里定义过的类名，用于判断"字符串里是否还在和别的类名并列"
const knownClasses = (() => {
  const set = new Set()
  const cssDir = path.join(SRC, 'styles')
  const walkCss = (d) => {
    if (!fs.existsSync(d)) return
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walkCss(p)
      else if (e.name.endsWith('.css')) {
        const t = fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
        let i = -1
        while ((i = t.indexOf('{', i + 1)) !== -1) {
          const start = Math.max(t.lastIndexOf('{', i - 1), t.lastIndexOf('}', i - 1), t.lastIndexOf(';', i - 1))
          const sel = t.slice(start + 1, i).trim()
          if (!sel || sel.startsWith('@')) continue
          let m
          const re = /\.(-?[A-Za-z_][\w-]*)/g
          while ((m = re.exec(sel))) set.add(m[1])
        }
      }
    }
  }
  walkCss(cssDir)
  return [...set]
})()

const results = []
for (const d of dead) {
  const { cls } = d
  // 3.1 antd 运行时类名：从不写在模板里，由组件库自己生成
  if (/^ant-/.test(cls) || cls === 'anticon') {
    const styled = corpus.some((f) => f.raw.includes('.' + cls))
    results.push({ ...d, verdict: styled ? 'ANT_RUNTIME_STYLED' : 'ANT_RUNTIME_UNSTYLED', where: '' })
    continue
  }
  // 3.2 字面出现在字符串里（class 属性、三元、数组常量、模板串固定片段）
  const esc = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const wordRe = new RegExp('(?<![\\w-])' + esc + '(?![\\w-])')
  const hits = corpus.filter((f) => wordRe.test(f.joined)).map((f) => f.rel)
  if (hits.length) {
    // 抓一段证据，让人能一眼判断是"类名引用"还是"只是同名的业务字符串"
    let snippet = ''
    let clsCtx = false
    outer: for (const f of corpus) {
      for (const s of f.strings) {
        if (wordRe.test(s)) {
          const at = s.search(wordRe)
          snippet = (f.rel + ': ' + s.slice(Math.max(0, at - 18), at + cls.length + 18).replace(/\s+/g, ' ')).slice(0, 90)
          // 置信度信号：同一个字符串里还有没有**别的已知 CSS 类名**。
          // 有 → 这是在一串 class 里（如 `apply-cat-item${x ? ' active' : ''}`），基本可断定为类名引用。
          // 没有 → 可能是同名业务字符串（如 '#app'、'success'、'[{ required: true }]'），留给人工一眼核。
          clsCtx = knownClasses.some((k) => k !== cls && new RegExp('(?<![\\w-])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w-])').test(s))
          break outer
        }
      }
    }
    results.push({ ...d, verdict: 'ALIVE_LITERAL', where: hits.slice(0, 2).join(', '), snippet, clsCtx })
    continue
  }
  // 3.3 是否可能由字符串拼装（含模板串插值）
  const parts = cls.split('-')
  let dyn = null
  for (let n = parts.length - 1; n >= 1; n--) {
    const stem = parts.slice(0, n).join('-')
    const hit = corpus.find((f) => f.joined.includes(stem + '-${') || f.joined.includes(stem + '-" +') || f.joined.includes(stem + "-' +"))
    if (hit) {
      dyn = { stem: stem + '-${…}', where: hit.rel }
      break
    }
  }
  if (dyn) {
    results.push({ ...d, verdict: 'ALIVE_DYNAMIC', where: dyn.where + ' 拼装前缀 ' + dyn.stem })
    continue
  }
  results.push({ ...d, verdict: 'SAFE_TO_DELETE', where: '' })
}

const tally = results.reduce((a, r) => ((a[r.verdict] = (a[r.verdict] || 0) + 1), a), {})
const byFile = {}
for (const r of results) {
  byFile[r.file] = byFile[r.file] || {}
  byFile[r.file][r.verdict] = (byFile[r.file][r.verdict] || 0) + 1
}

/* ---------- 4) 输出 ---------- */
if (JSON_OUT) fs.writeFileSync(path.resolve(JSON_OUT), JSON.stringify({ tally, byFile, results }, null, 1), 'utf8')

if (MD_OUT) {
  const L = []
  const safe = results.filter((r) => r.verdict === 'SAFE_TO_DELETE')
  L.push('# P0-T4 删除候选逐条确认', '')
  L.push('> 由 `scripts/p0-dead-verify.cjs` 生成。对 `src/**` 全部 `.vue/.ts/.js/html` 做全文词面搜索。', '')
  L.push('## 结论', '')
  L.push('| 判定 | 数量 | 说明 | 处置 |')
  L.push('| --- | --- | --- | --- |')
  L.push(`| SAFE_TO_DELETE | ${tally.SAFE_TO_DELETE || 0} | 全文无任何引用，且无拼装前缀 | 可删 |`)
  L.push(`| ALIVE_LITERAL | ${tally.ALIVE_LITERAL || 0} | 在 JS/模板串里字面出现（探测器漏掉） | **不可删** |`)
  L.push(`| ALIVE_DYNAMIC | ${tally.ALIVE_DYNAMIC || 0} | 由模板串按前缀拼装 | **不可删** |`)
  L.push(`| ANT_RUNTIME_STYLED | ${tally.ANT_RUNTIME_STYLED || 0} | antd 运行时生成的类名，且我们的 CSS 在给它上样式 | **绝对不可删** |`)
  L.push(`| ANT_RUNTIME_UNSTYLED | ${tally.ANT_RUNTIME_UNSTYLED || 0} | antd 运行时类名，但未发现对应样式 | 保留（无害） |`)
  L.push('')
  L.push('## 各样式表分布', '')
  L.push('| 样式表 | ' + ['SAFE_TO_DELETE', 'ALIVE_LITERAL', 'ALIVE_DYNAMIC', 'ANT_RUNTIME_STYLED', 'ANT_RUNTIME_UNSTYLED'].join(' | ') + ' |')
  L.push('| --- | --- | --- | --- | --- | --- |')
  for (const f of Object.keys(byFile)) {
    L.push('| ' + f + ' | ' + ['SAFE_TO_DELETE', 'ALIVE_LITERAL', 'ALIVE_DYNAMIC', 'ANT_RUNTIME_STYLED', 'ANT_RUNTIME_UNSTYLED'].map((k) => byFile[f][k] || 0).join(' | ') + ' |')
  }
  L.push('')
  for (const v of ['ALIVE_LITERAL', 'ALIVE_DYNAMIC', 'ANT_RUNTIME_STYLED']) {
    const rows = results.filter((r) => r.verdict === v)
    if (!rows.length) continue
    L.push(`## ${v}（${rows.length}）—— 不可删`, '')
    L.push('| 类名 | 定义于 | 置信 | 证据（原文片段，供人工复核） |')
    L.push('| --- | --- | --- | --- |')
    for (const r of rows) {
      const conf = r.verdict === 'ALIVE_LITERAL' ? (r.clsCtx ? '高（同串还有别的类名）' : '待确认（可能只是同名词）') : '高'
      L.push(`| \`${r.cls}\` | ${r.file} | ${conf} | ${(r.snippet || r.where || '—').replace(/\|/g, '\\|')} |`)
    }
    L.push('')
  }
  L.push(`## SAFE_TO_DELETE（${safe.length}）—— 删除清单`, '')
  L.push('> 删除时按样式表分组进行，每删一张表先跑一次基线比对（`p0-baseline-diff.cjs`）。')
  L.push('> 注意：这些类可能出现在**组合选择器**里（如 `.tag-approved, .tag-active`），删除时只能移除该选择器片段，不能整条规则删掉。')
  L.push('')
  const grp = {}
  for (const r of safe) (grp[r.file] = grp[r.file] || []).push(r.cls)
  for (const f of Object.keys(grp)) {
    L.push(`### ${f}（${grp[f].length}）`, '', '```', grp[f].join('  '), '```', '')
  }
  fs.writeFileSync(path.resolve(MD_OUT), L.join('\n'), 'utf8')
}

console.log('DEAD_TOTAL=' + dead.length + ' UNIQUE=' + new Set(dead.map((d) => d.cls)).size)
const safeUniq = new Set(results.filter((r) => r.verdict === 'SAFE_TO_DELETE').map((r) => r.cls))
console.log('SAFE_UNIQUE=' + safeUniq.size)
console.log('TALLY=' + JSON.stringify(tally))
const notSafe = results.filter((r) => r.verdict !== 'SAFE_TO_DELETE')
console.log('NOT_SAFE=' + notSafe.length + ' -> ' + notSafe.map((r) => r.cls + ':' + r.verdict).join(' '))
if (MD_OUT) console.log('MD -> ' + path.resolve(MD_OUT))
