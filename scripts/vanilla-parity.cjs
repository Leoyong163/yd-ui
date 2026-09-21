#!/usr/bin/env node
/**
 * vanilla-parity.cjs —— 校验「原生 HTML 拼出来的控件」与「Vue 组件渲染出来的控件」计算样式一致。
 *
 *   node scripts/vanilla-parity.cjs
 *   node scripts/vanilla-parity.cjs --docs http://localhost:5173/docs.html \
 *                                  --vanilla http://127.0.0.1:5175/examples/vanilla/index.html
 *
 * 为什么需要它：分层解耦的全部价值都压在一个断言上 ——
 *   **core 的类名配方，就是 vue 组件的视觉。没有第二份定义。**
 * 如果这个断言不成立（比如哪天有人给组件加了 <style>），两层就会慢慢分叉，
 * 而分叉是**静默的**：两边页面各自都「看起来正常」。所以用真实浏览器逐属性比对来钉住它。
 *
 * 做法：同一对类名（如 .tag.tag-pending）分别在两个页面里取 getComputedStyle，
 * 逐属性比对。左边是 Vue 组件渲染的（文档站），右边是手写 HTML 的（examples/vanilla）。
 *
 * 退出码 0 = 全部一致。
 */
const path = require('path')
const fs = require('fs')

const LIB = path.join(__dirname, '..')
const pwPath = 'C:/Users/yddp/.workbuddy/binaries/node/workspace/node_modules/playwright-core'
const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const DOCS = arg('docs', 'http://localhost:5173/docs.html')
const VANILLA = arg('vanilla', 'http://127.0.0.1:5175/examples/vanilla/index.html')

/* ---------- 比对清单 ---------- */
/**
 * 每一对：同一个选择器，一边由 Vue 组件产出、一边由手写 HTML 产出。
 * `route` 是文档站里能渲染出该组件的页面；`act` 是取样式前要先做的交互。
 */
const CASES = [
  { name: '状态标签 · 待审批', route: '#/component/StatusTag', sel: '.tag.tag-pending' },
  { name: '状态标签 · 已通过', route: '#/component/StatusTag', sel: '.tag.tag-approved' },
  { name: '状态标签 · 已驳回', route: '#/component/StatusTag', sel: '.tag.tag-rejected' },
  { name: '紧迫标签 · 紧急', route: '#/component/UrgencyTag', sel: '.tag.tag-high' },
  { name: '紧迫标签 · 非常紧急', route: '#/component/UrgencyTag', sel: '.tag.tag-urgent' },
  { name: '按钮 · 主', route: '#/component/Modal', sel: '.btn.btn-primary' },
  { name: '图标方块 · blue', route: '#/component/IconTile', sel: '.icon-tile.icon-tile-blue' },
  { name: '图标方块 · sm', route: '#/component/IconTile', sel: '.icon-tile.icon-tile-sm' },
  { name: 'KPI 配图', route: '#/component/KpiImg', sel: '.kpi-asset' },
  { name: '空状态容器', route: '#/component/EmptyState', sel: '.empty-state' },
  { name: '空状态标题', route: '#/component/EmptyState', sel: '.empty-state h3' },
  { name: '搜索框 · 输入', route: '#/component/SearchBox', sel: '.search-box .input' },
  { name: '搜索框 · 图标', route: '#/component/SearchBox', sel: '.search-box .search-icon' },
  { name: '分页 · 统计文案', route: '#/component/Pagination', sel: '.pagination-info' },
  { name: '分页 · 当前页按钮', route: '#/component/Pagination', sel: '.page-btn.active' },
  { name: '分页 · 普通页按钮', route: '#/component/Pagination', sel: '.page-btn:not(.active)' },
  { name: '树 · 一级行', route: '#/component/PermissionTree', sel: '.tree-row.tree-level-1' },
  { name: '树 · 名称', route: '#/component/PermissionTree', sel: '.tree-name' },
  { name: '树 · 类型徽标', route: '#/component/PermissionTree', sel: '.tree-type' },
  { name: '树 · 已授权', route: '#/component/PermissionTree', sel: '.tree-owned' },
  { name: '模态框 · 容器', route: '#/component/Modal', sel: '.modal', act: 'openModal' },
  { name: '模态框 · 头', route: '#/component/Modal', sel: '.modal-header', act: 'openModal' },
  { name: '模态框 · 标题', route: '#/component/Modal', sel: '.modal-title', act: 'openModal' },
  { name: '模态框 · 底栏', route: '#/component/Modal', sel: '.modal-footer', act: 'openModal' },
  { name: '模态框 · 关闭钮', route: '#/component/Modal', sel: '.modal-close', act: 'openModal' },
]

/**
 * 比对的属性。刻意**不含** width/height —— 它们是内容与容器驱动的，两边布局容器不同
 * （文档站在 demo-stage 里，示例页在自己的 dv-stage 里）。这里只比「由类名决定的那些」。
 */
const PROPS = [
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'color',
  'background-color',
  'background-image',
  'border-top-width',
  'border-top-style',
  'border-top-color',
  'border-top-left-radius',
  'border-bottom-left-radius',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'min-height',
  'max-width',
  'display',
  'align-items',
  'justify-content',
  'gap',
  'box-shadow',
  'text-align',
  'white-space',
]

/**
 * 已知且**有正当理由**的差异。空的 —— 一旦这里需要加东西，就说明两层真的开始分叉了，
 * 那时应该去修库，而不是往这里加白名单。留这个结构是为了让「新增例外」必须写明理由。
 */
const ACCEPTED = {}

/* ---------- 读取 ---------- */
/**
 * 把鼠标停到角落里再去读样式。
 *
 * 必须这么做：`page.goto` **不会**重置鼠标位置，所以上一页点击过的坐标会继续悬停在新页面上。
 * 实测踩到的假差异就是这么来的 —— 在 Modal 页点过「打开对话框」之后，
 * 同一个坐标落在权限树页的一行上，`.tree-row:hover` 生效，于是 background-color 与
 * 非 hover 状态对不上。这类假差异比漏检更糟：会让人以为两层真的分叉了。
 */
async function parkMouse(page) {
  await page.mouse.move(2, 2).catch(() => {})
  await page.waitForTimeout(60)
}

async function readStyles(page, sel) {
  return page.evaluate(
    ({ sel, props }) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const cs = getComputedStyle(el)
      const out = {}
      for (const p of props) out[p] = cs.getPropertyValue(p)
      return out
    },
    { sel, props: PROPS },
  )
}

async function collectFromDocs(page) {
  const byRoute = new Map()
  for (const c of CASES) {
    if (!byRoute.has(c.route)) byRoute.set(c.route, [])
    byRoute.get(c.route).push(c)
  }
  const result = new Map()
  for (const [route, cases] of byRoute) {
    await page.goto(DOCS + route, { waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(320)
    if (cases.some((c) => c.act === 'openModal')) {
      const trigger = await page.$('#app .btn.btn-primary')
      if (trigger) {
        await trigger.click().catch(() => {})
        await page.waitForTimeout(260)
      }
    }
    await parkMouse(page)
    for (const c of cases) {
      result.set(c.name, await readStyles(page, c.sel))
    }
  }
  return result
}

async function collectFromVanilla(page) {
  await page.goto(VANILLA, { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(320)
  await parkMouse(page)
  const result = new Map()
  for (const c of CASES) {
    result.set(c.name, await readStyles(page, c.sel))
  }
  return result
}

/* ---------- 主流程 ---------- */
;(async () => {
  let chromium
  try {
    chromium = require(pwPath).chromium
  } catch (e) {
    console.error(`[parity] 加载 playwright-core 失败：${e.message}`)
    process.exit(2)
  }
  if (!fs.existsSync(CHROME)) {
    console.error(`[parity] 找不到 Chrome：${CHROME}`)
    process.exit(2)
  }

  const browser = await chromium.launch({ executablePath: CHROME })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  const consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  const failedRequests = []
  page.on('requestfailed', (r) => failedRequests.push(`${r.url()} ${r.failure()?.errorText}`))

  console.log(`[parity] Vue 侧：${DOCS}`)
  const docsStyles = await collectFromDocs(page)
  console.log(`[parity] 原生侧：${VANILLA}`)
  const vanillaStyles = await collectFromVanilla(page)

  await browser.close()

  /* ---------- 比对 ---------- */
  const missing = []
  const diffs = []
  let compared = 0

  for (const c of CASES) {
    const a = docsStyles.get(c.name)
    const b = vanillaStyles.get(c.name)
    if (!a) missing.push(`Vue 侧找不到 ${c.sel}（${c.name}，路由 ${c.route}）`)
    if (!b) missing.push(`原生侧找不到 ${c.sel}（${c.name}）`)
    if (!a || !b) continue
    compared += 1
    for (const p of PROPS) {
      if (a[p] === b[p]) continue
      const key = `${c.sel}|${p}`
      if (ACCEPTED[key]) continue
      diffs.push({ name: c.name, sel: c.sel, prop: p, vue: a[p], html: b[p] })
    }
  }

  const lines = []
  lines.push(`对比项：${compared} / ${CASES.length}，属性 ${PROPS.length} 个/项`)
  if (missing.length) {
    lines.push('')
    lines.push(`选择器缺失 ${missing.length} 处：`)
    for (const m of missing) lines.push('  · ' + m)
  }
  if (diffs.length) {
    lines.push('')
    lines.push(`样式差异 ${diffs.length} 处：`)
    for (const d of diffs) lines.push(`  · ${d.name}  ${d.sel}  ${d.prop}\n      Vue: ${d.vue}\n      HTML: ${d.html}`)
  }
  if (consoleErrors.length) {
    lines.push('')
    lines.push(`控制台报错 ${consoleErrors.length} 条：`)
    for (const e of [...new Set(consoleErrors)].slice(0, 10)) lines.push('  · ' + e)
  }
  if (failedRequests.length) {
    lines.push('')
    lines.push(`失败请求 ${failedRequests.length} 条：`)
    for (const e of [...new Set(failedRequests)].slice(0, 10)) lines.push('  · ' + e)
  }

  const out = 'PARITY\n' + lines.join('\n') + '\n'
  const outPath = path.join(LIB, '.workbuddy', 'verify', 'vanilla-parity.txt')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, out, 'utf8')
  process.stdout.write(out)

  const ok = !missing.length && !diffs.length && !consoleErrors.length && !failedRequests.length
  console.log(`[parity] ${ok ? '✓ 通过' : '✗ 未通过'}  报告：${outPath}`)
  process.exit(ok ? 0 : 1)
})().catch((e) => {
  console.error('[parity] 运行失败：', e)
  process.exit(2)
})
