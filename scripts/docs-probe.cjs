#!/usr/bin/env node
/**
 * docs-probe.cjs —— 用真实浏览器验收文档站。
 *
 * 不靠截图（截图没法自动判断对错），而是问 DOM 要事实：
 *   · 有没有控制台报错 / 请求 404
 *   · 导航项数量对不对
 *   · 每个组件页是否都渲染出了「预览区里的真实组件」（而不是空的或占位文案）
 *   · 令牌页的色块在亮/暗切换后**计算值确实变了**（证明令牌链路是通的，不是死图）
 *
 * 用法：
 *   node scripts/docs-probe.cjs --url http://localhost:5174/
 */
const path = require('path')
const fs = require('fs')

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback
}

let chromium
try {
  ;({ chromium } = require('playwright-core'))
} catch {
  const p = path.join('C:', 'Users', 'yddp', '.workbuddy', 'binaries', 'node', 'workspace', 'node_modules', 'playwright-core')
  ;({ chromium } = require(p))
}

const URL_ = arg('url', 'http://localhost:5174/')
const OUT = arg('out', '.workbuddy/verify/docs-probe.json')
const CHROME = process.env.CHROME_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'

/** 组件清单也从库的契约里读，避免手写一份会漂移 */
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schema', 'components.json'), 'utf8'))

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const consoleErrors = []
  const failedRequests = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300))
  })
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e.message).slice(0, 300)))
  page.on('requestfailed', (r) => failedRequests.push(r.url() + ' :: ' + (r.failure()?.errorText || '')))
  page.on('response', (r) => {
    if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`)
  })

  const report = { url: URL_, consoleErrors, failedRequests, checks: [] }
  const push = (name, ok, detail) => report.checks.push({ name, ok, detail })

  await page.goto(URL_, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(600)

  // 0) 先把 Vite 错误浮层的正文抓出来 —— 它一出现就会遮住页面，后面所有点击都会失败，
  //    而失败信息（在 shadow DOM 里）恰恰是最有用的线索，所以第一件事就是读它。
  const overlayText = await page.evaluate(() => {
    const el = document.querySelector('vite-error-overlay')
    const t = el?.shadowRoot?.textContent || ''
    return t.replace(/\s+/g, ' ').slice(0, 1200)
  })
  if (overlayText) {
    report.overlay = overlayText
    consoleErrors.unshift('vite-error-overlay: ' + overlayText)
  }
  // 有浮层时点不动页面，后续交互检查统一跳过，避免用 30s × N 的等待换一个必然失败
  const hasOverlay = Boolean(overlayText)

  // 1) 首屏 = 概述页
  const navCount = await page.locator('.doc-nav-item').count()
  // 数量断言**不要写死**。写死过一次：P2 新增「原生 HTML」指南页后，这条就变成假失败
  // （期望 17、实际 18）。真正要守住的是「每个契约组件都被文档化了」，指南只保下限。
  const navLabels = await page.locator('.doc-nav-item').allInnerTexts()
  const missingNav = manifest.components.filter(
    (c) => !navLabels.some((l) => l.includes(c.title) || l.includes(c.name)),
  )
  push('每个契约组件都在导航里', missingNav.length === 0, missingNav.map((c) => c.name).join(', ') || '全部命中')
  const MIN_GUIDES = 5
  push(
    `导航项数量 ≥ 组件 ${manifest.components.length} + 指南 ${MIN_GUIDES}`,
    navCount >= manifest.components.length + MIN_GUIDES,
    `实际 ${navCount}`,
  )

  const statBoxes = await page.locator('.stat-box .v').allInnerTexts()
  push('概述页统计卡渲染', statBoxes.length === 4, statBoxes.join(' / '))

  // 2) 逐个组件页：预览区必须真的渲染出东西
  const perComponent = []
  for (const c of manifest.components) {
    await page.goto(`${URL_}#/component/${c.name}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(180)
    const demoCount = await page.locator('.demo-block').count()
    const stageChildCount = await page.locator('.demo-stage > *').count()
    const apiRows = await page.locator('.doc-table tbody tr').count()
    const title = (await page.locator('.doc-page-title').first().innerText()).trim()
    perComponent.push({ name: c.name, title, demoCount, stageChildCount, apiRows })
  }
  const emptyStages = perComponent.filter((c) => c.stageChildCount === 0)
  push('所有组件页预览区都渲染出内容', emptyStages.length === 0, emptyStages.map((c) => c.name).join(', ') || '全部有内容')
  const noDemo = perComponent.filter((c) => c.demoCount === 0)
  push('所有组件页都有演示块', noDemo.length === 0, noDemo.map((c) => c.name).join(', ') || '全部有演示块')
  const noApi = perComponent.filter((c) => c.apiRows === 0)
  push('所有组件页都有 API 表', noApi.length === 0, noApi.map((c) => c.name).join(', ') || '全部有 API 表')

  // 3) 令牌页：色块数量 + 亮暗切换后计算值确实变化
  await page.goto(`${URL_}#/guide/tokens`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(250)
  const swatchCount = await page.locator('.swatch').count()
  push('令牌页色块数量 > 50', swatchCount > 50, `实际 ${swatchCount}`)

  const chipSel = '.swatch:nth-child(1) .swatch-chip'
  const lightBg = await page.$eval(chipSel, (el) => getComputedStyle(el).backgroundColor)
  const lightBody = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)

  if (!hasOverlay) {
    await page.click('.doc-theme-btn')
  } else {
    // 浮层情况下退化为直接调页面内的方法：至少验证令牌链路是通的
    await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'))
  }
  await page.waitForTimeout(350)
  const themeAttr = await page.getAttribute('html', 'data-theme')
  const darkBg = await page.$eval(chipSel, (el) => getComputedStyle(el).backgroundColor)
  const darkBody = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)

  push('主题切换写入 data-theme', themeAttr === 'dark', String(themeAttr))
  push('令牌色块亮暗计算值不同（令牌链路是活的）', lightBg !== darkBg, `${lightBg} → ${darkBg}`)
  push('页面底色亮暗不同', lightBody !== darkBody, `${lightBody} → ${darkBody}`)

  // 有错误浮层时，页面被遮住，点击必然超时 —— 直接跳过交互检查并如实报告
  if (hasOverlay) {
    push('交互检查（Modal/树/分页/搜索）', false, '跳过：页面存在 Vite 错误浮层')
  } else {

  // 4) 演示交互：Modal 能打开
  await page.goto(`${URL_}#/component/Modal`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(200)
  await page.click('.demo-stage button.btn-primary')
  await page.waitForTimeout(300)
  const modalVisible = await page.locator('.modal-backdrop').count()
  const modalTitle = modalVisible ? (await page.locator('.modal-title').first().innerText()).trim() : ''
  push('Modal 演示可打开（真实交互）', modalVisible === 1 && modalTitle === '权限明细', `backdrop=${modalVisible} title=${modalTitle}`)

  // 5) 演示交互：权限树可展开收起
  await page.goto(`${URL_}#/component/PermissionTree`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(250)
  const rowsBefore = await page.locator('.tree-row').count()
  // 工具栏第一个按钮是「展开」、第二个是「收起」。必须先点收起——
  // 初版探针两次都点了「展开」，于是在已展开状态下点了个空操作，
  // 报出来的「行数没变」是探针的问题，不是组件的问题。
  await page.locator('.tree-toolbar-btn').nth(1).click()
  await page.waitForTimeout(250)
  const rowsAfterCollapse = await page.locator('.tree-row').count()
  await page.locator('.tree-toolbar-btn').nth(0).click()
  await page.waitForTimeout(250)
  const rowsAfterExpand = await page.locator('.tree-row').count()
  push('权限树收起/展开改变行数', rowsAfterCollapse < rowsBefore && rowsAfterExpand === rowsBefore,
    `展开=${rowsBefore} 收起=${rowsAfterCollapse} 再展开=${rowsAfterExpand}`)

  // 6) 分页演示可交互
  await page.goto(`${URL_}#/component/Pagination`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(250)
  const infoBefore = (await page.locator('.pagination-info').first().innerText()).trim()
  await page.locator('.page-btn').nth(1).click()
  await page.waitForTimeout(250)
  const infoAfter = (await page.locator('.pagination-info').first().innerText()).trim()
  push('分页演示响应点击', infoBefore !== infoAfter, `${infoBefore} → ${infoAfter}`)

  // 7) 搜索过滤
  await page.goto(`${URL_}#/guide/overview`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(200)
  await page.fill('.doc-search input', 'tree')
  await page.waitForTimeout(250)
  const filtered = await page.locator('.doc-nav-item').count()
  push('搜索能过滤导航', filtered > 0 && filtered < navCount, `过滤后 ${filtered} 项（未过滤 ${navCount}）`)

  } // end if (!hasOverlay)

  push('无控制台错误', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | ') || '无')
  const realFailures = failedRequests.filter((u) => !/favicon/.test(u))
  push('无失败请求', realFailures.length === 0, realFailures.slice(0, 3).join(' | ') || '无')

  report.perComponent = perComponent
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8')

  const bad = report.checks.filter((c) => !c.ok)
  console.log(`DOCS_PROBE checks=${report.checks.length} failed=${bad.length}`)
  for (const c of report.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}  【${c.detail}】`)
  if (consoleErrors.length) {
    console.log('console errors:')
    for (const e of consoleErrors.slice(0, 8)) console.log('  ' + e)
  }
  if (realFailures.length) {
    console.log('failed requests:')
    for (const e of realFailures.slice(0, 8)) console.log('  ' + e)
  }

  await browser.close()
  process.exit(bad.length ? 1 : 0)
}

main().catch((e) => {
  console.error('PROBE_CRASH', e)
  process.exit(2)
})
