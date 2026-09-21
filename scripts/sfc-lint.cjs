#!/usr/bin/env node
/**
 * 用 Vue 官方 SFC 编译器解析一个 .vue 文件，把模板语法错误连同行列号打出来。
 *
 * 为什么需要它：dev server 返回 500 时页面只给一句 "Element is missing end tag"，
 * 不给行号。逐个注释掉模板去试太慢，直接把编译器搬出来问它更快。
 *
 * 用法：node scripts/sfc-lint.cjs site/DocsApp.vue
 */
const fs = require('fs')
const path = require('path')

const SFC = process.argv[2]
if (!SFC) {
  console.error('用法: node scripts/sfc-lint.cjs <file.vue>')
  process.exit(1)
}

// pnpm 布局下 @vue/compiler-sfc 不一定在顶层 node_modules，从 .pnpm 里直接取
function loadCompiler() {
  const candidates = []
  const top = path.join(process.cwd(), 'node_modules', '@vue', 'compiler-sfc')
  candidates.push(top)
  const pnpm = path.join(process.cwd(), 'node_modules', '.pnpm')
  if (fs.existsSync(pnpm)) {
    for (const d of fs.readdirSync(pnpm)) {
      if (d.startsWith('@vue+compiler-sfc@')) {
        candidates.push(path.join(pnpm, d, 'node_modules', '@vue', 'compiler-sfc'))
      }
    }
  }
  for (const c of candidates) {
    try {
      return require(c)
    } catch {
      /* 试下一个 */
    }
  }
  throw new Error('找不到 @vue/compiler-sfc')
}

const { parse, compileTemplate } = loadCompiler()
const filename = path.resolve(SFC)
const source = fs.readFileSync(filename, 'utf8')
const { descriptor, errors } = parse(source, { filename })

const out = []
let hadError = errors.length > 0
out.push(`file: ${filename}`)
out.push(`template 块: ${descriptor.template ? '有' : '无'} · script 块: ${descriptor.scriptSetup ? 'setup' : descriptor.script ? 'script' : '无'}`)

if (errors.length) {
  out.push(`\n== SFC 结构错误 ${errors.length} 条 ==`)
  for (const e of errors) {
    out.push(`  ${e.message}`)
    if (e.loc) out.push(`    行 ${e.loc.start.line}:${e.loc.start.column}  →  行 ${e.loc.end.line}:${e.loc.end.column}`)
    if (e.loc?.source) out.push(`    源码: ${String(e.loc.source).slice(0, 120)}`)
  }
}

if (descriptor.template) {
  const r = compileTemplate({
    source: descriptor.template.content,
    filename,
    id: 'lint',
    compilerOptions: { comments: false },
  })
  if (r.errors?.length) {
    hadError = true
    out.push(`\n== 模板编译错误 ${r.errors.length} 条 ==`)
    for (const e of r.errors) {
      const msg = typeof e === 'string' ? e : e.message
      out.push(`  ${msg}`)
      const loc = typeof e === 'object' ? e.loc : null
      if (loc) out.push(`    行 ${loc.start.line}:${loc.start.column}  →  行 ${loc.end.line}:${loc.end.column}`)
      // 模板内的行号是相对 template 块起点的，换算成文件真实行号
      if (loc) {
        const base = descriptor.template.loc.start.line
        out.push(`    文件真实行 ≈ ${base + loc.start.line - 1}`)
      }
    }
  } else {
    out.push('\n模板编译通过，无错误。')
  }
}

console.log(out.join('\n'))
process.exit(hadError ? 1 : 0)
