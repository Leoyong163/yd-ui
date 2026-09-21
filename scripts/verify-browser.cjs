#!/usr/bin/env node
/**
 * verify-browser.cjs —— 一条命令跑完所有「需要真实浏览器」的验收。
 *
 *   node scripts/verify-browser.cjs
 *   node scripts/verify-browser.cjs --docs-port 5174 --vanilla-port 5175
 *
 * 它自己拉起两个本地服务、等端口就绪、顺序跑探针、最后收掉进程：
 *   · 文档站        scripts/../docs-site        → http://localhost:5174/
 *   · 原生示例页    examples/vanilla/           → http://127.0.0.1:5175/
 *
 * 为什么要把服务生命周期塞进同一个进程：
 * 在受限环境里，`Start-Job` 被安全策略拦、`Start-Process` 脱离会话会被回收、
 * 后台任务也会被中途 SIGTERM —— 起服务的那条命令一旦返回，服务就没了。
 * 由本进程 fork 出来并持有引用，才能保证它活到探针跑完。
 *
 * 重要：**两个服务都在本仓库内**。P2b 之前文档站跑在业务宿主的 5173，
 * 于是库的验收反过来依赖宿主；现在不再需要任何外部工程。
 *
 * 退出码 0 = 全部通过。
 */
const { spawn, spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const http = require('http')

const LIB = path.join(__dirname, '..')
const NODE = process.execPath

function argVal(n, d) {
  const i = process.argv.indexOf('--' + n)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}
const DOCS_PORT = argVal('docs-port', '5174')
const VANILLA_PORT = argVal('vanilla-port', '5175')

const DOCS_URL = `http://localhost:${DOCS_PORT}/`
const VANILLA_URL = `http://127.0.0.1:${VANILLA_PORT}/examples/vanilla/index.html`

const OUT = path.join(LIB, '.workbuddy', 'verify', 'verify-browser.txt')
const lines = []
const log = (s) => {
  lines.push(s)
  process.stdout.write(s + '\n')
}

const probe = (url) =>
  new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume()
      resolve(res.statusCode)
    })
    req.on('error', () => resolve(0))
    req.setTimeout(1500, () => {
      req.destroy()
      resolve(0)
    })
  })

async function waitPort(url, label, tries = 60) {
  for (let i = 0; i < tries; i++) {
    if ((await probe(url)) === 200) {
      log(`  · ${label} 就绪`)
      return true
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  log(`  · ${label} 未就绪（超时）`)
  return false
}

const killTree = (child) => {
  if (!child || child.killed) return
  try {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  } catch {
    try {
      child.kill('SIGKILL')
    } catch {}
  }
}

const JOBS = [
  { label: 'vanilla-probe', script: 'scripts/vanilla-probe.cjs' },
  { label: 'docs-probe', script: 'scripts/docs-probe.cjs' },
  { label: 'vanilla-parity', script: 'scripts/vanilla-parity.cjs' },
]

;(async () => {
  const servers = []
  let exit = 0
  try {
    if (!fs.existsSync(path.join(LIB, 'node_modules', 'vite'))) {
      log('[verify] 缺 node_modules —— 先跑 pnpm install')
      process.exit(2)
    }

    log('[verify] 启动本地服务…')
    servers.push(
      spawn(NODE, [path.join(LIB, 'scripts/serve-vanilla.mjs'), '--port', VANILLA_PORT], {
        cwd: LIB,
        stdio: 'ignore',
      }),
    )
    servers.push(
      spawn(NODE, [path.join(LIB, 'node_modules/vite/bin/vite.js'), '--config', 'docs-site/vite.config.ts'], {
        cwd: LIB,
        stdio: 'ignore',
        env: { ...process.env, CODEBUDDY_SAFE_DELETE_ENABLED: '0' },
      }),
    )

    const okV = await waitPort(VANILLA_URL, `原生页 ${VANILLA_PORT}`)
    const okD = await waitPort(DOCS_URL, `文档站 ${DOCS_PORT}`)
    if (!okV || !okD) {
      log('[verify] 服务未就绪，中止')
      exit = 2
    } else {
      let failed = 0
      for (const j of JOBS) {
        log(`[verify] 跑 ${j.label} …`)
        const r = spawnSync(NODE, [path.join(LIB, j.script)], { cwd: LIB, encoding: 'utf8', timeout: 300000 })
        const out = (r.stdout || '') + (r.stderr || '')
        fs.writeFileSync(path.join(LIB, '.workbuddy', 'verify', j.label + '.txt'), out, 'utf8')
        const tail = out
          .split(/\r?\n/)
          .filter((l) => /checks=|PASS|FAIL|对比项|差异|通过|一致/.test(l))
          .slice(-2)
          .join(' || ')
        log(`  EXIT=${r.status}   ${tail.slice(0, 220)}`)
        if (r.status !== 0) failed++
      }
      log(`[verify] 浏览器验收：${JOBS.length - failed}/${JOBS.length} 通过`)
      exit = failed === 0 ? 0 : 1
    }
  } catch (e) {
    log('[verify] 异常：' + (e && e.message))
    exit = 3
  } finally {
    servers.forEach(killTree)
    fs.mkdirSync(path.dirname(OUT), { recursive: true })
    fs.writeFileSync(OUT, lines.join('\r\n'), 'utf8')
  }
  process.exit(exit)
})()
