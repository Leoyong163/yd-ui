#!/usr/bin/env node
/**
 * check-layering.cjs —— 分层门禁。守住「core 不认识 Vue」与「组件不含样式」这两条不变式。
 *
 *   node scripts/check-layering.cjs
 *   node scripts/check-layering.cjs --json      # 机器可读输出
 *   node scripts/check-layering.cjs --root <dir>  # 指向另一份库副本（自测用）
 *
 * 门禁自身有自测：`node scripts/check-layering.selftest.cjs` 会故意注入违规、
 * 验证它确实报得出来。没见过失败的门禁等于没有门禁。
 *
 * 为什么需要机器守：这两条不变式**不报错**。往 core 里 import 一个 Vue composable，
 * 或者给组件补个 <style>，代码照样跑、页面照样对；等到「原生 HTML 想用这套样式却做不到」
 * 或者「同一个控件在 Vue 与 HTML 下慢慢长得不一样」时，才发现代价。所以用门禁挡在提交前。
 *
 * 八项检查：
 *   C1  core/ 不得依赖 vue / ant-design-vue
 *   C2  core/ 不得出现 .vue 文件，也不得 import .vue
 *   C3  任何库文件不得反向依赖宿主（越出库根、或引用宿主别名 @/）
 *   V1  vue/ 下的组件不得带 <style> 块
 *   V2  vue/ 模板里出现的**库家族类名**必须在 schema/class-contract.json 里存在
 *   A1  契约里登记的资产文件必须在 core/assets/ 真实存在，且 core/styles 三层齐全
 *   A2  已登记的皮肤钩子必须真的被某个模板输出（防陈旧条目）
 *   D1  文档站（docs-site/）的 import 只能来自库自身 / peer 依赖 / 相对路径
 *   D2  文档站不得出现宿主的开发端口 5173 或宿主目录的绝对路径
 *
 * 退出码 0 = 通过。
 */
const fs = require('fs')
const path = require('path')

/** --root <dir>：把门禁指向另一份库副本（自测用，见 check-layering.selftest.cjs） */
const rootArgIdx = process.argv.indexOf('--root')
const LIB = path.resolve(
  rootArgIdx >= 0 && process.argv[rootArgIdx + 1] ? process.argv[rootArgIdx + 1] : path.join(__dirname, '..'),
)
const SRC = path.join(LIB, 'src')
const JSON_OUT = process.argv.includes('--json')

/* ---------- 小工具 ---------- */
const problems = []
const notes = []
function fail(check, file, msg) {
  problems.push({ check, file: path.relative(LIB, file).replace(/\\/g, '/'), msg })
}

function walk(dir, filter) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full, filter))
    else if (!filter || filter(full)) out.push(full)
  }
  return out
}
const rel = (f) => path.relative(LIB, f).replace(/\\/g, '/')
const read = (f) => fs.readFileSync(f, 'utf8')

/**
 * 去掉 JS/TS 注释（含 HTML 注释）。必须先注释化再扫依赖：
 * 否则「文档注释里写了 `from 'vue'` 这行禁令」会被当成真的 import —— P2 首次跑门禁时
 * `src/core/index.ts` 就这样被误报了两条。门禁的误报比不检查更糟：它会训练人忽略它。
 */
function stripComments(src) {
  let out = ''
  let i = 0
  let quote = null
  while (i < src.length) {
    const c = src[i]
    if (quote) {
      out += c
      if (c === '\\') {
        out += src[i + 1] ?? ''
        i += 2
        continue
      }
      if (c === quote) quote = null
      i += 1
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c
      out += c
      i += 1
      continue
    }
    if (c === '/' && src[i + 1] === '/') {
      const e = src.indexOf('\n', i)
      i = e < 0 ? src.length : e
      out += '\n'
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2)
      i = e < 0 ? src.length : e + 2
      out += ' '
      continue
    }
    if (c === '<' && src.startsWith('<!--', i)) {
      const e = src.indexOf('-->', i + 4)
      i = e < 0 ? src.length : e + 3
      out += ' '
      continue
    }
    out += c
    i += 1
  }
  return out
}

/* ---------- 读取契约 ---------- */
const contractPath = path.join(LIB, 'schema', 'class-contract.json')
if (!fs.existsSync(contractPath)) {
  console.error('[layering] 缺少 schema/class-contract.json，请先跑 npm run build:contract')
  process.exit(1)
}
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'))
const knownClasses = new Set([
  ...contract.families.flatMap((f) => f.classes),
  ...contract.stateClasses,
  ...contract.unmatchedClasses,
  ...Object.keys(contract.skinHooks || {}),
])
const familyPrefixes = contract.families.map((f) => f.prefix).sort((a, b) => b.length - a.length)
const categoryOf = (cls) => familyPrefixes.find((f) => cls === f || cls.startsWith(f)) || null

/* ==========================================================================
   C1 / C2 —— core 不得依赖 Vue，不得有 .vue
   ========================================================================== */
const coreDir = path.join(SRC, 'core')
const coreFiles = walk(coreDir)

const FORBIDDEN_DEPS = [
  { re: /from\s+['"]vue['"]/, what: "import 'vue'" },
  { re: /from\s+['"]vue\/[^'"]+['"]/, what: 'import vue/... 子路径' },
  { re: /from\s+['"]ant-design-vue/, what: 'import ant-design-vue' },
  { re: /require\(\s*['"]vue['"]\s*\)/, what: "require('vue')" },
]

for (const f of coreFiles) {
  if (f.endsWith('.vue')) {
    fail('C2', f, 'core/ 里不允许出现 .vue 文件（组件属 vue 层）')
    continue
  }
  const src = stripComments(read(f))
  for (const { re, what } of FORBIDDEN_DEPS) {
    if (re.test(src)) fail('C1', f, `零框架层不得依赖 Vue：${what}`)
  }
  for (const m of src.matchAll(/from\s+['"]([^'"]+\.vue)['"]/g)) {
    fail('C2', f, `零框架层不得 import 组件：${m[1]}`)
  }
}

/* ==========================================================================
   C3 —— 不得反向依赖宿主
   ========================================================================== */
const allLibFiles = walk(SRC, (f) => /\.(ts|vue|mjs|cjs|css)$/.test(f))
for (const f of allLibFiles) {
  const src = stripComments(read(f))
  // 相对路径：**真解析**再判断有没有越出库根。
  // 不用「数几个 ..」这种启发式 —— 需要几层取决于文件深度，
  // 固定阈值必然漏判（src/core/contract/x.ts 与 src/index.ts 的深度就不一样）。
  for (const m of src.matchAll(/from\s+['"](\.[^'"]*)['"]/g)) {
    const resolved = path.resolve(path.dirname(f), m[1])
    const relToLib = path.relative(LIB, resolved)
    if (relToLib.startsWith('..') || path.isAbsolute(relToLib)) {
      fail('C3', f, `相对路径越出库根，疑似反向依赖宿主：${m[1]}`)
    }
  }
  // 宿主别名
  for (const m of src.matchAll(/from\s+['"](@\/[^'"]*)['"]/g)) {
    fail('C3', f, `引用了宿主别名：${m[1]}`)
  }
}

/* ==========================================================================
   V1 —— 组件不得带 <style>
   ========================================================================== */
const vueFiles = walk(path.join(SRC, 'vue'), (f) => f.endsWith('.vue'))
for (const f of vueFiles) {
  const src = read(f)
  if (/<style[\s>]/i.test(src)) {
    fail('V1', f, '组件不得带 <style> 块 —— 外观一律进 core/styles 的对应层')
  }
}

/* ==========================================================================
   V2 —— 模板里的库家族类名必须在契约内
   ========================================================================== */
function classTokensOf(template) {
  const tokens = new Set()
  const add = (value) => {
    // 先抠出 ${...} 里的字符串字面量，再把插值整体抹掉
    for (const s of value.matchAll(/'([^']*)'/g)) addRaw(s[1])
    addRaw(value.replace(/\$\{[^}]*\}/g, ' '))
  }
  const addRaw = (value) => {
    for (const m of value.matchAll(/[A-Za-z_][\w-]*/g)) {
      const tok = m[0]
      if (tok.endsWith('-')) continue // 插值留下的残尾，如 `icon-tile-`
      tokens.add(tok)
    }
  }
  for (const m of template.matchAll(/:?class\s*=\s*"([^"]*)"/g)) add(m[1])
  for (const m of template.matchAll(/:?class\s*=\s*'([^']*)'/g)) add(m[1])
  return tokens
}

const templateClasses = new Set()
let templateClassScanned = 0
for (const f of vueFiles) {
  const src = read(f)
  const tpl = src.match(/<template>([\s\S]*)<\/template>/)
  if (!tpl) {
    notes.push(`${rel(f)} 没有 <template>（子组件/纯脚本？）`)
    continue
  }
  for (const tok of classTokensOf(tpl[1])) {
    templateClassScanned += 1
    templateClasses.add(tok)
    const cat = categoryOf(tok)
    if (!cat) continue // 非库家族：可能是宿主透传类名、插值变量、业务类
    if (knownClasses.has(tok)) continue
    fail(
      'V2',
      f,
      `模板用了契约外的库类名「${tok}」（family=${cat}）—— ` +
        `要么是笔误（改名），要么是故意留给宿主的皮肤钩子（登记到 core/contract/skin-hooks.ts）`,
    )
  }
}

/* ==========================================================================
   A2 —— 皮肤钩子不得陈旧
   ========================================================================== */
for (const hook of Object.keys(contract.skinHooks || {})) {
  if (!templateClasses.has(hook)) {
    fail(
      'A2',
      path.join(SRC, 'core', 'contract', 'skin-hooks.ts'),
      `已登记的皮肤钩子「${hook}」没有任何库模板输出它 —— 陈旧条目，请删除`,
    )
  }
}

/* ==========================================================================
   A1 —— 资产与样式三层
   ========================================================================== */
const assetDir = path.join(SRC, 'core', 'assets')
for (const [key, file] of Object.entries(contract.assets || {})) {
  if (!fs.existsSync(path.join(assetDir, file))) {
    fail('A1', path.join(assetDir, file), `契约里的资产键「${key}」指向的 ${file} 不存在`)
  }
}
const stylesDir = path.join(SRC, 'core', 'styles')
for (const f of ['tokens.css', 'base.css', 'components.css', 'index.css']) {
  if (!fs.existsSync(path.join(stylesDir, f))) fail('A1', path.join(stylesDir, f), `缺少样式层文件 ${f}`)
}
const stylesIndex = path.join(stylesDir, 'index.css')
if (fs.existsSync(stylesIndex)) {
  const order = [...read(stylesIndex).matchAll(/@import\s+['"]\.\/([\w.-]+)['"]/g)].map((m) => m[1])
  const want = ['tokens.css', 'base.css', 'components.css']
  if (order.join(',') !== want.join(',')) {
    fail('A1', stylesIndex, `三层顺序被改动：实际 [${order.join(', ')}]，应为 [${want.join(', ')}]`)
  }
}

/* ==========================================================================
   D1 / D2 —— 文档站不得依赖任何宿主
   --------------------------------------------------------------------------
   为什么需要：文档站以前住在业务宿主里，靠宿主的 vite alias 才能解析 @yd/ui，
   库的门禁 vanilla-parity 也默认去请求宿主的 5173 —— 于是**库离开宿主就跑不了自己的验收**，
   而库要交给别的项目用时，文档站也不会被一起带走。根治靠把文档站迁回库内，
   防复发靠这两条：
     D1  文档站的 import 只能是：库自身 / peer 依赖 / 相对路径 /（配置文件里的）构建工具
     D2  文档站不得出现宿主的开发端口（5173）或宿主目录的绝对路径
   ========================================================================== */
const DOCS = path.join(LIB, 'docs-site')
const docsFiles = walk(DOCS, (f) => /\.(vue|ts|mjs|cjs|css|html)$/.test(f)).filter((f) => {
  const r = rel(f)
  return !r.includes('docs-site/dist-docs/') && !r.includes('docs-site/node_modules/')
})

// 应用代码允许的裸包名
const DOCS_ALLOWED = new Set(['vue', 'ant-design-vue', 'dayjs'])
// 构建配置额外允许（只对 vite.config.* 生效）
const DOCS_ALLOWED_CONFIG = new Set(['vite', '@vitejs/plugin-vue', 'node:path', 'node:url', 'path', 'fs'])

for (const f of docsFiles) {
  const isConfig = /vite\.config\./.test(f)
  const src = stripComments(read(f))
  for (const m of src.matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/g)) {
    const spec = m[1]
    if (spec.startsWith('.') || spec.startsWith('@yd/')) continue
    const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]
    if (DOCS_ALLOWED.has(pkg)) continue
    if (isConfig && DOCS_ALLOWED_CONFIG.has(spec)) continue
    fail(
      'D1',
      f,
      `文档站只能依赖库自身与 peer 依赖，不该依赖「${spec}」—— ` +
        `它必须能脱离任何宿主独立跑起来`,
    )
  }
}

// D2 扫原始源码（不做注释剥离）：stripComments 会把 `http://x` 里那个 `//`
// 当行注释、连带把后半行吞掉，正好把要抓的 url 藏起来。改为跳过 .vue 里的
// <pre> 代码示例 —— 那是「讲给读者看」的正文，不是运行时的依赖。
const HOST_MARKERS = [/localhost:5173\b/, /YD_UI_DIR/, /D:[\\/]demo[\\/]grok/i]
for (const f of docsFiles) {
  let src = read(f)
  if (f.endsWith('.vue')) src = src.replace(/<pre[\s\S]*?<\/pre>/g, ' ')
  for (const re of HOST_MARKERS) {
    const m = src.match(re)
    if (m) {
      fail('D2', f, `文档站引用了宿主的地址/端口（${m[0]}）—— 迁回库内后不应再出现`)
      break
    }
  }
}

/* ---------- 输出 ---------- */
const summary = {
  ok: problems.length === 0,
  coreFiles: coreFiles.length,
  vueFiles: vueFiles.length,
  docsFiles: docsFiles.length,
  templateClassScanned,
  /** 契约自报的类名数（对外口径） */
  contractClasses: contract.classCount,
  /** 校验用的已知类名集合大小（= contractClasses + 状态修饰类 + 皮肤钩子） */
  knownTokens: knownClasses.size,
  families: familyPrefixes.length,
  problems,
}

if (JSON_OUT) {
  console.log(JSON.stringify(summary, null, 2))
} else {
  console.log(
    `[layering] core ${coreFiles.length} 文件 · vue ${vueFiles.length} 组件 · docs-site ${docsFiles.length} 文件 · ` +
      // 「类名」用契约自报的 classCount（与文档、README、规范文档一致）；
      // knownClasses 是**校验用**的更大集合（额外含状态修饰类与皮肤钩子），
      // 两者故意不同，不要把 knownClasses.size 当类名数报出去。
      `契约 ${contract.classCount} 类名 / ${familyPrefixes.length} 家族 ` +
      `（校验集含状态修饰与钩子共 ${knownClasses.size} 个 token）· 模板扫到 ${templateClassScanned} 个类名`,
  )
  for (const n of notes) console.log(`  · ${n}`)
  if (problems.length) {
    console.error(`\n[layering] ✗ ${problems.length} 处违规：`)
    for (const p of problems) console.error(`  ${p.check}  ${p.file}\n      ${p.msg}`)
  } else {
    console.log('[layering] ✓ C1/C2/C3/V1/V2/A1/A2/D1/D2 全部通过')
  }
}

process.exit(problems.length ? 1 : 0)
