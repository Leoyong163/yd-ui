#!/usr/bin/env node
/**
 * build-lite.mjs —— 产出 **原生 HTML 直引包** `dist-lite/`。
 *
 *   node scripts/build-lite.mjs           # 写入
 *   node scripts/build-lite.mjs --check   # 只校验（不同步则退出码 1，CI 用）
 *
 * 面向谁：不跑构建的消费者 —— 静态 HTML 页面、单文件原型、邮件模板预览、
 * 别的技术栈（jQuery / 原生 / 服务端模板）。他们要的是「一个 <link> 就够」。
 *
 * 产出：
 *   yd-ui.css        三层样式（tokens → base → components）的合并产物，顺序即级联
 *   icons.svg        SVG sprite，用 <use href="#yd-icon-home"> 引用
 *   assets/*.png     KPI 配图（文件名与 core/contract/assets-manifest.ts 一致）
 *   manifest.json    包内容清单 + CSS 内容哈希（供 check 与文档站读取）
 *
 * 为什么产物要**入库**（而不是像 dist 那样忽略）：
 *   判据是「消费方需不需要先跑构建」——原生页面不跑构建，所以它必须在仓库里。
 *   代价是要用这个脚本的 --check 模式守住它与源码同步。
 *
 * 注意：这里只搬样式，**不含任何 JS**。交互（弹窗开关、树展开、分页）属 vue 层；
 * 原生页面要么用不依赖脚本的形态（<details>、[hidden]），要么自己写几行事件绑定。
 * 详见《组件库分层与解耦规范.md》§5。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const p = (...s) => join(root, ...s)
const CHECK = process.argv.includes('--check')

const OUT_DIR = p('dist-lite')
const STYLES = ['tokens.css', 'base.css', 'components.css']

/* ==========================================================================
   1. 合并三层 CSS
   ========================================================================== */
const banner = `/* ==========================================================================
   @yd/ui · yd-ui.css —— 原生 HTML 直引包（零构建、零 JS）
   ==========================================================================

   由 \`scripts/build-lite.mjs\` 生成，**请勿手改**。改样式请改：
     src/core/styles/{tokens,base,components}.css
   然后重新生成：
     node scripts/build-lite.mjs
   校验是否同步（CI 用）：
     node scripts/build-lite.mjs --check

   这是以下三条的合并产物，**顺序即级联，不可调换**：
     1. tokens.css      设计令牌（真源 src/core/theme/tokens.ts，别手改）
     2. base.css        reset + 排版角色
     3. components.css  控件配方
   如果它要插进你自己的页面样式里，请注意：本文件必须排在页面级样式之前，
   否则页面里的上下文覆盖（如 \`.my-page .btn { … }\`）会静默失效。

   配套资源（同目录）：
     icons.svg          图标 sprite —— <svg><use href="#yd-icon-home"/></svg>
     assets/*.png       KPI 配图 —— 文件名见 manifest.json 的 assets

   用法：
     <link rel="stylesheet" href="./dist-lite/yd-ui.css">
     <button class="btn btn-primary">提交</button>
     <span class="tag tag-pending">待审批</span>

   可用的类名清单与状态词表见 schema/class-contract.json（机器可读，也是 AI 的白名单）。
   ========================================================================== */

`

const parts = []

/**
 * 去掉 CSS 注释后再检测 @import。
 * 必须去注释 —— tokens.css 的横幅里就写着「用 @import 位置固定它」，
 * 直接正则匹配会把这句说明当成真的 @import 拦下来（第一版就是这么误报的）。
 */
function stripCssComments(src) {
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
    if (c === '"' || c === "'") {
      quote = c
      out += c
      i += 1
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2)
      i = e < 0 ? src.length : e + 2
      out += ' '
      continue
    }
    out += c
    i += 1
  }
  return out
}

for (const f of STYLES) {
  const full = p('src', 'core', 'styles', f)
  if (!existsSync(full)) {
    console.error(`[lite] 缺少样式层文件 ${f}`)
    process.exit(1)
  }
  const body = readFileSync(full, 'utf8')
  if (/@import\s/.test(stripCssComments(body))) {
    console.error(
      `[lite] ${f} 里有真的 @import（不只是注释里提到）—— 合并产物里不能留 @import，必须内联。`,
    )
    process.exit(1)
  }
  parts.push(`/* ---------- ${f} ---------- */\n\n${body.trim()}\n`)
}
const css = banner + parts.join('\n')

/* ==========================================================================
   2. 生成图标 sprite
   ========================================================================== */
const { icons } = await import(pathToFileURL(p('src', 'core', 'icons', 'icons.ts')).href)

const PRESENTATION_ATTRS = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit']

function toSymbol(key, svg) {
  const m = /<svg([^>]*)>([\s\S]*)<\/svg>/.exec(svg.trim())
  if (!m) return null
  const attrs = m[1]
  const inner = m[2]
  const viewBox = /viewBox\s*=\s*"([^"]+)"/.exec(attrs)?.[1]
  if (!viewBox) return null
  // 根 svg 上的呈现属性要下移到 <g>，否则 <symbol> 里会丢描边设置。
  // 用 <g> 而不是直接写在 <symbol> 上：继承行为更明确，也不受 symbol 建立新视口的实现差异影响。
  const carried = PRESENTATION_ATTRS.map((a) => {
    const v = new RegExp(`${a}\\s*=\\s*"([^"]*)"`).exec(attrs)?.[1]
    return v ? `${a}="${v}"` : null
  })
    .filter(Boolean)
    .join(' ')
  return `  <symbol id="yd-icon-${key}" viewBox="${viewBox}"><g ${carried}>${inner.trim()}</g></symbol>`
}

const keys = Object.keys(icons).sort()
const symbols = []
const broken = []
for (const k of keys) {
  const s = toSymbol(k, icons[k])
  if (s) symbols.push(s)
  else broken.push(k)
}
if (broken.length) {
  console.error(`[lite] 这些图标的 SVG 解析失败：${broken.join(', ')}`)
  process.exit(1)
}

const seen = new Map()
let duplicateCount = 0
for (const k of keys) {
  const body = icons[k]
  if (seen.has(body)) duplicateCount += 1
  else seen.set(body, k)
}

const sprite = `<?xml version="1.0" encoding="UTF-8"?>
<!-- @yd/ui 图标 sprite —— 由 scripts/build-lite.mjs 从 src/core/icons/icons.ts 生成，请勿手改。
     用法（注意 currentColor 会继承外层文字颜色，所以尺寸与颜色都由你控制）：
       <svg class="yd-icon" width="18" height="18"><use href="#yd-icon-shield"/></svg>
     可用 id 清单见同目录 manifest.json 的 icons 字段。 -->
<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">
${symbols.join('\n')}
</svg>
`

/* ==========================================================================
   3. 资产
   ========================================================================== */
const { KPI_ASSET_FILES } = await import(pathToFileURL(p('src', 'core', 'contract', 'assets-manifest.ts')).href)
const assetSrcDir = p('src', 'core', 'assets')
const missingAssets = Object.entries(KPI_ASSET_FILES).filter(([, f]) => !existsSync(join(assetSrcDir, f)))
if (missingAssets.length) {
  console.error(`[lite] 缺少素材：${missingAssets.map(([, f]) => f).join(', ')}`)
  process.exit(1)
}

const cssHash = createHash('sha256').update(css).digest('hex').slice(0, 16)
const spriteHash = createHash('sha256').update(sprite).digest('hex').slice(0, 16)

const manifest = {
  name: '@yd/ui · dist-lite',
  generatedBy: 'scripts/build-lite.mjs',
  desc: '原生 HTML 直引包：零构建、零 JS。只含样式与静态资源。',
  bytes: { css: Buffer.byteLength(css), sprite: Buffer.byteLength(sprite) },
  hashes: { css: cssHash, sprite: spriteHash },
  cssOrder: STYLES,
  cssNote: '顺序即级联。本文件必须排在页面级样式之前，否则页面上下文覆盖会静默失效。',
  icons: keys,
  iconSymbolPrefix: 'yd-icon-',
  duplicateIconBodies: duplicateCount,
  assets: KPI_ASSET_FILES,
  assetsNote: '文件名与 core/contract/assets-manifest.ts 一致；原生页面直接引 ./assets/<文件名>。',
  interactive: {
    note: '本包不含 JS。需要交互的原生页面请用不依赖脚本的形态，或自行绑定事件。',
    patterns: [
      '弹窗：容器加 hidden 属性控制显隐，内容用 .modal-backdrop > .modal 结构',
      '折叠/树：用 <details>/<summary> 承载展开收起，内部仍用 .tree-row 等类名',
      '分页：静态标记 <button class="page-btn active">，翻页逻辑由你的后端或少量 JS 负责',
    ],
  },
}
const manifestJson = JSON.stringify(manifest, null, 2) + '\n'

/* ==========================================================================
   4. 写入 或 校验
   ========================================================================== */
const targets = [
  ['yd-ui.css', css],
  ['icons.svg', sprite],
  ['manifest.json', manifestJson],
]
for (const [, file] of Object.entries(KPI_ASSET_FILES)) {
  targets.push([`assets/${file}`, null]) // null = 二进制，单独处理
}

if (CHECK) {
  const diffs = []
  for (const [name, content] of targets) {
    const full = join(OUT_DIR, name)
    if (!existsSync(full)) {
      diffs.push(`${name} 缺失`)
      continue
    }
    if (content === null) continue // 二进制只校验存在
    if (readFileSync(full, 'utf8') !== content) diffs.push(`${name} 内容不同步`)
  }
  if (diffs.length) {
    console.error('[lite] dist-lite 与源码不同步：')
    for (const d of diffs) console.error(`  · ${d}`)
    console.error('  运行 `node scripts/build-lite.mjs` 重新生成。')
    process.exit(1)
  }
  console.log(
    `[lite] 已同步：yd-ui.css ${(Buffer.byteLength(css) / 1024).toFixed(1)} KB · ` +
      `icons.svg ${keys.length} 个符号 ${(Buffer.byteLength(sprite) / 1024).toFixed(1)} KB · ` +
      `assets ${Object.keys(KPI_ASSET_FILES).length} 个`,
  )
  process.exit(0)
}

rmSync(OUT_DIR, { recursive: true, force: true })
mkdirSync(join(OUT_DIR, 'assets'), { recursive: true })
for (const [name, content] of targets) {
  const full = join(OUT_DIR, name)
  if (content === null) {
    copyFileSync(join(assetSrcDir, name.replace('assets/', '')), full)
  } else {
    writeFileSync(full, content, 'utf8')
  }
}

console.log(`[lite] 已写入 ${OUT_DIR}`)
console.log(`  yd-ui.css      ${(Buffer.byteLength(css) / 1024).toFixed(1)} KB  (sha256 ${cssHash})`)
console.log(`  icons.svg      ${keys.length} 个符号 ${(Buffer.byteLength(sprite) / 1024).toFixed(1)} KB  (${duplicateCount} 个别名共用同一图形)`)
console.log(`  assets/        ${readdirSync(join(OUT_DIR, 'assets')).join(', ')}`)
console.log(`  manifest.json  包清单 + 哈希`)
