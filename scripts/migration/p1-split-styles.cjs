#!/usr/bin/env node
/**
 * p1-split-styles.cjs —— P1-T6：把宿主 `components.css` 拆成「库控件配方」与「宿主残余」。
 *
 * 为什么不能手工拆：
 *   652 个类名、7566 行，且大量规则是**组合选择器**（`.tag-approved, .tag-active { … }`）。
 *   手工拆一定会漏掉片段、或整条误删。必须由脚本按确定规则切分，并保证：
 *     1. 两个输出文件的规则**内部顺序与原文件完全一致**（CSS 级联依赖顺序）；
 *     2. 一条规则里若混了库类与宿主类，按选择器**逐片段**拆到两边；
 *     3. `@media` / `@supports` 块按内部规则归属整块搬走，混合块拆成两个同前缀块。
 *
 * 归属判据来自 `docs/P0裁决结论.md` §3.3 族裁决表（以「族」为单位，不做逐类猜测）。
 * 一条经验规则解决 90% 的情况：**选择器里只要出现一个宿主类，整条就归宿主**
 * —— 因为那是「页面容器内的局部微调」（P0 §3.1 SCOPED_ONLY），不是控件配方。
 *
 * 用法：
 *   node scripts/p1-split-styles.cjs --report          # 只打印分类结果，不写文件
 *   node scripts/p1-split-styles.cjs                   # 写出 lib + host 两个文件
 *   node scripts/p1-split-styles.cjs --src <in.css> --lib-out <a.css> --host-out <b.css>
 */

const fs = require('fs')
const path = require('path')

/* ---------- 参数 ---------- */
function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback
}
const REPORT = process.argv.includes('--report')
const SRC = arg('src', 'src/styles/demo1/components.css')
const LIB_OUT = arg('lib-out', 'D:/demo/组件库/src/styles/components.css')
const HOST_OUT = arg('host-out', 'src/styles/demo1/components.css')
const REPORT_OUT = arg('report-out', '.workbuddy/verify/p1-split-report.md')

/* ---------- 归属规则 ---------- */
// 族前缀：命中即「库」。与 docs/P0裁决结论.md §3.3 一一对应。
const LIB_FAMILIES = [
  'btn', // 按钮族
  'tag', // 标签族
  'card', // 卡片族
  'table', // 表格族
  'cell-', // 表格单元格变体（cell-name / cell-muted / cell-node）同族
  'perm-tree',
  'tree', // 树族
  'leaf',
  'tabs',
  'tab',
  'pagination',
  'page-btn', // 分页族
  'input',
  'select',
  'textarea',
  'form-', // 表单控件族
  'checkbox',
  'radio',
  'check-row',
  'radio-row',
  'switch',
  'icon-tile',
  'icon-3d', // 图标族（icon-3d 是旧别名，随族搬）
  'modal',
  'empty-state',
  'search-box',
  'search-icon',
  'kpi-asset',
  'overflow-tooltip', // OverflowTooltip 的浮层，随该组件入库
  'ant-', // 给 antd 上主题，属库的一部分（P0 §5.3）
  'anticon',
  // 刻意**不**收录，否则等于把死类/未实现样式搬进库：
  //   toast / error-summary → P0 §3.3 判为「待建组件」，不进库
  //   spinner / skeleton / dragover / has-error → P0 §5.4 挂起待定
  //   badge / chip / dropdown / tooltip → 当前无控件实现
]

// 显式例外：即使命中前缀也**不归库**（页面语义/宿主内部）
const HOST_OVERRIDES = new Set([
  'table-toolbar', // 页面级工具条，非表格控件本体
  'table-actions',
  'card-grid', // 页面布局用的卡片排布，不是 card 控件
  'input-hint-page',
])

// 状态修饰语：不是组件，归属由「它修饰谁」决定 → 分类时忽略它们
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
  // 实测漏判的两条：`.form-field.full`（满宽表单）与 `.tree-row.highlight`（树行强调）
  // 都只是控件本体的布局/强调修饰，去掉修饰语后主体落在 lib 族，正是它们该在的地方。
  'full',
  'highlight',
  // 第二轮复核又抓到三条：它们都是控件本体上的修饰语，去掉后主体落回 lib 族。
  //   `.form-field .required::after`  → 必填星号，属表单控件族
  //   `.table td.nowrap`             → 表格单元格不换行变体
  //   `.btn .spinner`                → 按钮加载态里的指示器
  'required',
  'nowrap',
  'spinner',
])

function familyOf(cls) {
  if (HOST_OVERRIDES.has(cls)) return 'host'
  for (const f of LIB_FAMILIES) {
    if (cls === f || cls.startsWith(f)) return 'lib'
  }
  return 'host'
}

/* ---------- 选择器分类 ---------- */
/**
 * 返回 'lib' | 'host'。
 * 规则：选择器里出现任一宿主类 → host；否则（全是库类/状态语/元素）→ 看主体（最后一段）。
 */
function classifySelector(rawSel) {
  // 选择器里可能夹着注释（`.icon-tile, /* 旧别名 */ .icon-3d`）——先把注释抹掉，
  // 否则注释里的词会被当成类名参与归属判定。
  const sel = rawSel.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim()
  const classes = [...sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1])
  if (!classes.length) {
    // 纯元素/属性选择器：控件相关元素归库，其余（html/body/*）归宿主
    const el = sel.trim().toLowerCase()
    if (/^(input|select|textarea|button|table|label)\b/.test(el)) return 'lib'
    return 'host'
  }
  const meaningful = classes.filter((c) => !STATE_WORDS.has(c))
  if (!meaningful.length) return 'host' // 形如 `.active`，无法判断主体
  // 宿主类出现在**任意位置**（含祖先）即判宿主 —— SCOPED_ONLY 规则
  if (meaningful.some((c) => familyOf(c) === 'host')) return 'host'
  // 去掉状态语后，主体（最后一个）必须是库类
  return familyOf(meaningful[meaningful.length - 1]) === 'lib' ? 'lib' : 'host'
}

/* ---------- 极简但正确的 CSS 顶层切分 ---------- */
/**
 * 把 CSS 切成顶层块。每块形如：
 *   { kind:'comment'|'rule'|'at', text, prelude?, body? }
 * 括号/字符串/注释感知，不用正则做括号匹配。
 */
function tokenizeTopLevel(css) {
  const blocks = []
  let i = 0
  let buf = '' // 累积块之间的空白与游离文本
  const n = css.length

  function flushRaw() {
    if (buf.trim()) blocks.push({ kind: 'raw', text: buf })
    else if (buf) blocks.push({ kind: 'ws', text: buf })
    buf = ''
  }

  while (i < n) {
    // 顶层「琐碎内容」：空白与注释。必须在这里就地吃掉，否则会被并进后面的选择器——
    // 实测踩到过：`/* Flat icon tile — soft solid, no plastic 3D */` 注释内部带逗号，
    // 一旦并入选择器，splitSelectors 会把注释从逗号处切开，切出 `/ * Flat icon tile — soft solid`
    // 这种半截片段，于是本来整条归库的规则被误判成「需要拆分」。
    if (css[i] === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      const stop = end === -1 ? n : end + 2
      buf += css.slice(i, stop)
      i = stop
      continue
    }
    if (/\s/.test(css[i])) {
      const s = i
      while (i < n && /\s/.test(css[i])) i += 1
      buf += css.slice(s, i)
      continue
    }
    // @ 规则
    if (css[i] === '@') {
      let j = i
      let depthParen = 0
      while (j < n) {
        const ch = css[j]
        if (ch === '(') depthParen += 1
        else if (ch === ')') depthParen -= 1
        else if (ch === '"' || ch === "'") {
          const q = ch
          j += 1
          while (j < n && css[j] !== q) {
            if (css[j] === '\\') j += 1
            j += 1
          }
        } else if (ch === ';' && depthParen === 0) break
        else if (ch === '{' && depthParen === 0) break
        j += 1
      }
      if (css[j] === ';') {
        buf += css.slice(i, j + 1)
        i = j + 1
        continue
      }
      if (css[j] === '{') {
        const prelude = css.slice(i, j).trim()
        const bodyStart = j + 1
        // 找配对的 }
        let k = bodyStart
        let depth = 1
        while (k < n && depth > 0) {
          const ch = css[k]
          if (css.startsWith('/*', k)) {
            const e2 = css.indexOf('*/', k + 2)
            k = e2 === -1 ? n : e2 + 2
            continue
          }
          if (ch === '"' || ch === "'") {
            const q = ch
            k += 1
            while (k < n && css[k] !== q) {
              if (css[k] === '\\') k += 1
              k += 1
            }
          } else if (ch === '{') depth += 1
          else if (ch === '}') depth -= 1
          k += 1
        }
        const body = css.slice(bodyStart, k - 1)
        flushRaw()
        blocks.push({ kind: 'at', prelude, body })
        i = k
        continue
      }
      // 兜底
      buf += css[i]
      i += 1
      continue
    }
    // 普通规则
    let j = i
    let depthParen = 0
    while (j < n) {
      const ch = css[j]
      if (ch === '(') depthParen += 1
      else if (ch === ')') depthParen -= 1
      else if (ch === '"' || ch === "'") {
        const q = ch
        j += 1
        while (j < n && css[j] !== q) {
          if (css[j] === '\\') j += 1
          j += 1
        }
      } else if (ch === '{' && depthParen === 0) break
      j += 1
    }
    if (j >= n) {
      buf += css.slice(i)
      i = n
      break
    }
    const selector = css.slice(i, j).trim()
    const bodyStart = j + 1
    let k = bodyStart
    let depth = 1
    while (k < n && depth > 0) {
      const ch = css[k]
      if (css.startsWith('/*', k)) {
        const e2 = css.indexOf('*/', k + 2)
        k = e2 === -1 ? n : e2 + 2
        continue
      }
      if (ch === '"' || ch === "'") {
        const q = ch
        k += 1
        while (k < n && css[k] !== q) {
          if (css[k] === '\\') k += 1
          k += 1
        }
      } else if (ch === '{') depth += 1
      else if (ch === '}') depth -= 1
      k += 1
    }
    const body = css.slice(bodyStart, k - 1)
    flushRaw()
    blocks.push({ kind: 'rule', selector, body })
    i = k
  }
  flushRaw()
  return blocks
}

/** 把选择器串按顶层逗号切分（忽略 :not() 等括号内的逗号） */
function splitSelectors(selector) {
  const out = []
  let depth = 0
  let cur = ''
  for (let i = 0; i < selector.length; i += 1) {
    const ch = selector[i]
    if (ch === '(') depth += 1
    else if (ch === ')') depth -= 1
    if (ch === ',' && depth === 0) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out.filter(Boolean)
}

/* ---------- 主流程 ---------- */
const css = fs.readFileSync(SRC, 'utf8')

// 防呆：这个脚本的输入必须是**未拆分的原始 components.css**。
// 若拿已经拆分过的宿主残余再跑一次，库侧规则已经不在输入里，会生成一个几乎空的库文件，
// 把上一次的成果覆盖掉（不可逆，只能从 .workbuddy/verify/p1-backup/ 还原）。
if (css.includes('本文件是拆分后的**宿主残余**')) {
  console.error('[p1-split-styles] 输入文件已经是拆分后的宿主残余，拒绝二次拆分。')
  console.error('  请先从备份还原：')
  console.error('    Copy-Item .workbuddy/verify/p1-backup/components.css src/styles/demo1/components.css -Force')
  process.exit(2)
}

const blocks = tokenizeTopLevel(css)

const stats = { libRules: 0, hostRules: 0, splitRules: 0, atLib: 0, atHost: 0, atMixed: 0, raw: 0 }
const detail = []
const libParts = []
const hostParts = []

// 注释跟着它所属的规则走：CSS 里的段注释（`/* ===== Pagination ===== */`）是阅读锚点，
// 若全部丢给宿主残余文件，库文件就会变成一堆没有分节的裸规则。做法是把注释暂存，
// 由下一条被输出的规则取走。
let pending = ''
function takePending() {
  const p = pending
  pending = ''
  return p
}

function emitRule(target, selector, body) {
  const head = takePending()
  const lead = head ? head.replace(/\s+$/, '') + '\n' : ''
  target.push(`${lead}${selector} {\n${body.trim()}\n}\n`)
}

function emitAt(target, prelude, body) {
  const head = takePending()
  const lead = head ? head.replace(/\s+$/, '') + '\n' : ''
  target.push(`${lead}${prelude} {\n${body.trim()}\n}\n`)
}

for (const b of blocks) {
  if (b.kind === 'ws') continue
  if (b.kind === 'raw') {
    stats.raw += 1
    pending += b.text
    continue
  }
  if (b.kind === 'rule') {
    const sels = splitSelectors(b.selector)
    const libs = sels.filter((s) => classifySelector(s) === 'lib')
    const hosts = sels.filter((s) => classifySelector(s) === 'host')
    if (libs.length && !hosts.length) {
      stats.libRules += 1
      emitRule(libParts, sels.join(', '), b.body)
      detail.push({ kind: 'LIB', selector: sels.join(', ') })
    } else if (hosts.length && !libs.length) {
      stats.hostRules += 1
      emitRule(hostParts, sels.join(', '), b.body)
      detail.push({ kind: 'HOST', selector: sels.join(', ') })
    } else {
      stats.splitRules += 1
      emitRule(libParts, libs.join(', '), b.body)
      emitRule(hostParts, hosts.join(', '), b.body)
      detail.push({ kind: 'SPLIT', selector: sels.join(', '), lib: libs.join(' | '), host: hosts.join(' | ') })
    }
    continue
  }
  // at-rule
  const inner = tokenizeTopLevel(b.body)
  const innerRules = inner.filter((x) => x.kind === 'rule')
  if (!innerRules.length) {
    // 纯声明 at-rule（@font-face / @keyframes / @charset 等）→ 宿主，原样保留
    stats.atHost += 1
    emitAt(hostParts, b.prelude, b.body)
    detail.push({ kind: 'AT_HOST', selector: b.prelude })
    continue
  }
  const libInner = []
  const hostInner = []
  let innerPending = ''
  for (const r of inner) {
    if (r.kind === 'ws') continue
    if (r.kind === 'raw') {
      innerPending += r.text
      continue
    }
    const lead = innerPending ? innerPending.replace(/\s+$/, '') + '\n' : ''
    innerPending = ''
    const sels = splitSelectors(r.selector)
    const libs = sels.filter((s) => classifySelector(s) === 'lib')
    const hosts = sels.filter((s) => classifySelector(s) === 'host')
    if (libs.length && hosts.length) {
      libInner.push(`${lead}${libs.join(', ')} {\n${r.body.trim()}\n}`)
      hostInner.push(`${hosts.join(', ')} {\n${r.body.trim()}\n}`)
    } else if (libs.length) libInner.push(`${lead}${libs.join(', ')} {\n${r.body.trim()}\n}`)
    else hostInner.push(`${lead}${sels.join(', ')} {\n${r.body.trim()}\n}`)
  }
  if (libInner.length && hostInner.length) {
    stats.atMixed += 1
    emitAt(libParts, b.prelude, libInner.join('\n'))
    emitAt(hostParts, b.prelude, hostInner.join('\n'))
    detail.push({
      kind: 'AT_MIXED',
      selector: b.prelude,
      lib: String(libInner.length),
      host: String(hostInner.length),
    })
  } else if (libInner.length) {
    stats.atLib += 1
    emitAt(libParts, b.prelude, libInner.join('\n'))
    detail.push({ kind: 'AT_LIB', selector: b.prelude })
  } else {
    stats.atHost += 1
    emitAt(hostParts, b.prelude, b.body)
    detail.push({ kind: 'AT_HOST', selector: b.prelude })
  }
}
// 文件末尾若还压着没被取走的注释，归宿主，避免丢失
if (pending.trim()) hostParts.push(pending)

/* ---------- 输出 ---------- */
if (REPORT) {
  // 两侧类名清单：用来一眼发现「库侧混进了页面类」或「宿主残留了控件类」
  const libClasses = new Set()
  const hostClasses = new Set()
  for (const b of blocks) {
    if (b.kind === 'rule') {
      for (const s of splitSelectors(b.selector)) {
        const cs = [...s.replace(/\/\*[\s\S]*?\*\//g, ' ').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1])
        for (const c of cs) (classifySelector(s) === 'lib' ? libClasses : hostClasses).add(c)
      }
    } else if (b.kind === 'at') {
      for (const r of tokenizeTopLevel(b.body).filter((x) => x.kind === 'rule')) {
        for (const s of splitSelectors(r.selector)) {
          const cs = [...s.replace(/\/\*[\s\S]*?\*\//g, ' ').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1])
          for (const c of cs) (classifySelector(s) === 'lib' ? libClasses : hostClasses).add(c)
        }
      }
    }
  }
  const skip = new Set([...STATE_WORDS, ...LIB_FAMILIES])
  const libList = [...libClasses].filter((c) => !STATE_WORDS.has(c)).sort()
  const hostList = [...hostClasses].filter((c) => !STATE_WORDS.has(c)).sort()
  void skip

  const L = []
  L.push('# P1-T6 样式拆分报告')
  L.push('')
  L.push(`源文件：\`${SRC}\``)
  L.push('')
  L.push('| 指标 | 数量 |')
  L.push('| --- | --- |')
  L.push(`| 顶层块总数 | ${blocks.length} |`)
  L.push(`| 整条归库 | ${stats.libRules} |`)
  L.push(`| 整条归宿主 | ${stats.hostRules} |`)
  L.push(`| 组合选择器需拆分 | ${stats.splitRules} |`)
  L.push(`| @ 块整块归库 | ${stats.atLib} |`)
  L.push(`| @ 块整块归宿主 | ${stats.atHost} |`)
  L.push(`| @ 块内部混合 | ${stats.atMixed} |`)
  L.push(`| 游离文本/注释 | ${stats.raw} |`)
  L.push('')
  L.push(`## 库侧类名（${libList.length}）`)
  L.push('')
  L.push(libList.map((c) => '`' + c + '`').join(' · '))
  L.push('')
  L.push(`## 宿主侧类名（${hostList.length}）`)
  L.push('')
  L.push(hostList.map((c) => '`' + c + '`').join(' · '))
  L.push('')
  L.push('## 逐条分类（仅需人工过目的行）')
  L.push('')
  L.push('| 判定 | 选择器 | 库侧片段 | 宿主侧片段 |')
  L.push('| --- | --- | --- | --- |')
  for (const d of detail) {
    if (d.kind !== 'SPLIT' && d.kind !== 'AT_MIXED') continue
    L.push(`| ${d.kind} | \`${d.selector.replace(/\|/g, '\\|')}\` | ${d.lib || ''} | ${d.host || ''} |`)
  }
  L.push('')
  fs.mkdirSync(path.dirname(REPORT_OUT), { recursive: true })
  fs.writeFileSync(REPORT_OUT, L.join('\n'), 'utf8')
  console.log('SPLIT_STATS=' + JSON.stringify(stats))
  console.log('REPORT=' + REPORT_OUT)
  console.log('LIB_CLASSES=' + libList.length + ' HOST_CLASSES=' + hostList.length)
  const needReview = detail.filter((d) => d.kind === 'SPLIT' || d.kind === 'AT_MIXED')
  console.log('NEED_REVIEW=' + needReview.length)
  for (const d of needReview.slice(0, 60)) console.log('  [' + d.kind + '] ' + d.selector.replace(/\n/g, ' '))
  process.exit(0)
}

const LIB_BANNER = `/* 由 \`scripts/p1-split-styles.cjs\` 从宿主 \`src/styles/demo1/components.css\` 机械拆分而来（P1-T6）。
   归属依据：docs/P0裁决结论.md §3.3 族裁决表。

   本文件是**库的控件配方层**，加载顺序不变式：必须排在宿主 pages.css 之前。 */

`
const HOST_BANNER = `/* 本文件是拆分后的**宿主残余**（P1-T6）：
   原 \`components.css\` 中属库的控件配方已搬到 \`@yd/ui/src/styles/components.css\`，
   这里只剩页面语义类与无法判定归属的规则。层级位置与拆分前一致（紧随库配方之后）。 */

`
fs.writeFileSync(LIB_OUT, LIB_BANNER + libParts.join(''), 'utf8')
fs.writeFileSync(HOST_OUT, HOST_BANNER + hostParts.join(''), 'utf8')
console.log('SPLIT_STATS=' + JSON.stringify(stats))
console.log('LIB=' + LIB_OUT + ' ' + fs.statSync(LIB_OUT).size)
console.log('HOST=' + HOST_OUT + ' ' + fs.statSync(HOST_OUT).size)
if (process.argv.includes('--override-src')) {
  // 显式确认时才覆盖源文件（默认 SRC 与 HOST_OUT 同路径 → 已覆盖）
}
