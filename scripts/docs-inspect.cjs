#!/usr/bin/env node
/**
 * docs-inspect.cjs —— 把文档站「实际渲染出来的东西」抓成文本，用于人工核对。
 *
 * 与 docs-probe 的分工：probe 判对错（退出码门禁），inspect 供人看内容。
 * 抓：导航清单、概述页正文、某组件页的演示区结构、以及演示区里真实控件的
 * 计算样式（证明库的 CSS 确实作用到了组件上，而不是一坨无样式的裸 DOM）。
 *
 * 用法：node scripts/docs-inspect.cjs --url http://localhost:5174/
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
const OUT = arg('out', 'docs-site/.verify/docs-inspect.json')
const CHROME = process.env.CHROME_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(URL_, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(500)

  const out = { url: URL_ }

  out.documentTitle = await page.title()
  out.h1 = clean(await page.locator('h1').first().innerText().catch(() => ''))

  // 左栏导航（分组 + 条目）
  out.nav = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.doc-nav-group')).map((g) => ({
      group: g.querySelector('.doc-nav-group-title')?.textContent?.trim() || '',
      items: Array.from(g.querySelectorAll('.doc-nav-item')).map((a) => a.textContent.replace(/\s+/g, ' ').trim()),
    })),
  )

  // 概述页正文（前 1500 字）
  out.overviewText = clean(await page.locator('.doc-content, .doc-page, main').first().innerText()).slice(0, 1500)

  // 组件页：演示区结构与真实控件样式
  await page.goto(`${URL_}#/component/StatusTag`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  out.statusTagPage = {
    title: clean(await page.locator('.doc-page-title').first().innerText().catch(() => '')),
    demoText: clean(await page.locator('.demo-stage').first().innerText().catch(() => '')).slice(0, 400),
    codeText: clean(await page.locator('.demo-block pre, .demo-code pre').first().innerText().catch(() => '')).slice(0, 300),
    apiFirstRows: await page.evaluate(() =>
      Array.from(document.querySelectorAll('.doc-table tbody tr')).slice(0, 3).map((tr) =>
        Array.from(tr.children).map((td) => td.textContent.replace(/\s+/g, ' ').trim()),
      ),
    ),
    tagStyles: await page.evaluate(() => {
      const el = document.querySelector('.demo-stage .tag')
      if (!el) return null
      const c = getComputedStyle(el)
      return {
        cls: el.className,
        display: c.display,
        padding: `${c.paddingTop} ${c.paddingRight} ${c.paddingBottom} ${c.paddingLeft}`,
        borderRadius: c.borderRadius,
        fontSize: c.fontSize,
        fontWeight: c.fontWeight,
        color: c.color,
        background: c.backgroundColor,
        rect: (() => { const r = el.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}` })(),
      }
    }),
    // 库的配方类是否真的生效：拿一个 btn 对照
    btnStyles: await page.evaluate(() => {
      const el = document.querySelector('button.btn')
      if (!el) return null
      const c = getComputedStyle(el)
      return { cls: el.className, height: c.height, padding: c.padding, borderRadius: c.borderRadius, font: `${c.fontSize}/${c.fontWeight}` }
    }),
  }

  // 样式是否被加载（库三层 CSS 的产物）
  out.stylesheetCount = await page.evaluate(() => document.styleSheets.length)
  out.bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
  out.rootTokens = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement)
    const pick = ['--primary', '--bg', '--text', '--radius', '--text-muted']
    return Object.fromEntries(pick.map((k) => [k, cs.getPropertyValue(k).trim()]))
  })

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8')
  console.log('DOCS_INSPECT_OK ->', OUT)
  await browser.close()
}

main().catch((e) => {
  console.error('INSPECT_CRASH', e)
  process.exit(2)
})
