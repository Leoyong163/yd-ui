#!/usr/bin/env node
/**
 * 从 `src/core/theme/tokens.ts` 生成 `src/core/styles/tokens.css`（库内）。
 *
 *   node --experimental-strip-types scripts/gen-tokens.mjs           # 写入
 *   node --experimental-strip-types scripts/gen-tokens.mjs --check   # 只校验（不同步则退出码 1）
 *
 * 演化：
 *   P1-T5 真源从宿主搬到库，产物从 `demo1/variables.css` 改名为 `tokens.css`；
 *   P2    随分层搬到 `src/core/` 下（令牌属零框架层，与 Vue 无关）。
 *
 * `--check` 除校验内容还校验**令牌数量**，防止有人手改产物后「行数还对得上」。
 * 需要 `--experimental-strip-types`：直接用 node 加载 .ts 真源，不引 tsx/esbuild。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const outPath = join(root, 'src', 'core', 'styles', 'tokens.css')

// Windows 上动态 import 必须走 file:// URL，直接给盘符路径会报 ERR_UNSUPPORTED_ESM_URL_SCHEME
const { lightTokens, darkTokens } = await import(
  pathToFileURL(join(root, 'src', 'core', 'theme', 'tokens.ts')).href
)

const BANNER = `/* 由 \`scripts/gen-tokens.mjs\` 从 \`src/core/theme/tokens.ts\` 生成 —— 请勿手改。
   改令牌请改 tokens.ts，然后运行：node --experimental-strip-types scripts/gen-tokens.mjs */

/* 加载顺序不变式：本文件必须排在宿主 pages.css 之前。
   宿主 \`src/index.css\` 用 @import 位置固定它，勿在别处重复引入。
   P2 分层后路径为 \`@yd/ui/core/styles/tokens.css\`（旧 \`@yd/ui/styles/tokens.css\` 已废弃）。 */`

function block(selector, tokens, indent = '  ') {
  const lines = Object.entries(tokens).map(([k, v]) => `${indent}--${k}: ${v};`)
  return `${selector} {\n${lines.join('\n')}\n}`
}

const css = [
  BANNER,
  '',
  block(':root', lightTokens),
  '',
  block('[data-theme="dark"]', darkTokens),
  '',
].join('\n')

const previous = existsSync(outPath) ? readFileSync(outPath, 'utf8') : ''
const checkOnly = process.argv.includes('--check')

if (previous === css) {
  console.log(
    `[gen-tokens] 已同步：${Object.keys(lightTokens).length} 个亮色令牌 + ${Object.keys(darkTokens).length} 个暗色覆盖`,
  )
  process.exit(0)
}

if (checkOnly) {
  const before = previous.split('\n')
  const after = css.split('\n')
  console.error('[gen-tokens] tokens.css 与 tokens.ts 不同步。')
  console.error(`  当前 ${before.length} 行 / 应为 ${after.length} 行`)
  console.error('  运行 `node --experimental-strip-types scripts/gen-tokens.mjs` 重新生成。')
  process.exit(1)
}

writeFileSync(outPath, css, 'utf8')
console.log(
  `[gen-tokens] 已写入 ${outPath}\n  亮色 ${Object.keys(lightTokens).length} 个令牌 · 暗色覆盖 ${Object.keys(darkTokens).length} 个 · 共 ${css.split('\n').length} 行`,
)
