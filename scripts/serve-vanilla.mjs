#!/usr/bin/env node
/**
 * serve-vanilla.mjs —— 给 `examples/vanilla/` 起一个静态服务（零依赖）。
 *
 *   node scripts/serve-vanilla.mjs [--port 5175]
 *
 * 为什么需要它：原生示例页**不能双击打开**。
 * 它属 ES-module 时代之外的纯静态页，但用了两处需要 HTTP 的东西：
 *   1. 外部 SVG sprite（`<use href="../../dist-lite/icons.svg#yd-icon-x">`）—— `file://` 下被 CORS 拦
 *   2. 字体等外部资源
 * 所以必须经 HTTP 提供。这个服务只做一件事：把**库根目录**当静态根，端口默认 5175。
 *
 * 刻意不放进宿主工程的 Vite dev server —— 那一层会引入别名、插件与热更新，
 * 而这一页要证明的恰恰是「不装 Vue、不跑构建也能用」。用最笨的静态服务最有说服力。
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize, sep } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')

const portIdx = process.argv.indexOf('--port')
const PORT = Number(portIdx >= 0 ? process.argv[portIdx + 1] : 0) || 5175

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`)
    let rel = decodeURIComponent(url.pathname)
    if (rel === '/' || rel === '') rel = '/examples/vanilla/index.html'
    if (rel.endsWith('/')) rel += 'index.html'

    // 目录穿越防护：归一化后必须仍在 ROOT 之内
    const target = normalize(join(ROOT, rel))
    if (!target.startsWith(ROOT + sep) && target !== ROOT) {
      res.writeHead(403).end('forbidden')
      return
    }

    const st = await stat(target)
    if (st.isDirectory()) {
      res.writeHead(302, { Location: rel + '/' }).end()
      return
    }

    const body = await readFile(target)
    res.writeHead(200, {
      'Content-Type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Content-Length': body.length,
    })
    res.end(body)
  } catch (e) {
    if (e && e.code === 'ENOENT') res.writeHead(404).end('not found')
    else {
      res.writeHead(500).end(String((e && e.message) || e))
    }
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[vanilla] 静态根 ${ROOT}`)
  console.log(`[vanilla] 原生示例页：http://127.0.0.1:${PORT}/examples/vanilla/index.html`)
  console.log(`[vanilla] 直引包：    http://127.0.0.1:${PORT}/dist-lite/yd-ui.css`)
  console.log('[vanilla] Ctrl+C 停止')
})
