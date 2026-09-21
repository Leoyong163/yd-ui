#!/usr/bin/env node
/**
 * vanilla-probe.cjs —— 原生示例页的浏览器验收。
 *
 *   node scripts/vanilla-probe.cjs [--url http://127.0.0.1:5175/examples/vanilla/index.html]
 *
 * 同 `docs-probe.cjs` 一样，用真实浏览器而不是截图，检查的是可量化的事实：
 *   · 零控制台报错、零 4xx/5xx 响应（含 favicon、sprite、素材）
 *   · **外部 SVG sprite 的 <use> 真的解析成功**（最常见也最难发现的失败：
 *     引用写错时页面不报错，只是图标空白 —— getBBox 会是 0）
 *   · 每个组件族都真有渲染出东西（不是空标签），且尺寸非零
 *   · 状态标签的颜色确实各不相同（说明类名真的命中了不同规则，不是全落在一个兜底上）
 *   · dist-lite 的合并 CSS 真的被加载了（不是靠宿主样式撑起来的）
 *
 * 退出码 0 = 全部通过。
 */
const path = require('path')
const fs = require('fs')

const LIB = path.join(__dirname, '..')
const pwPath = 'C:/Users/yddp/.workbuddy/binaries/node/workspace/node_modules/playwright-core'
const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'

const i = process.argv.indexOf('--url')
const URL_ARG = i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : 'http://127.0.0.1:5175/examples/vanilla/index.html'

const checks = []
const add = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail || '' })

;(async () => {
  const { chromium } = require(pwPath)
  if (!fs.existsSync(CHROME)) {
    console.error(`[vanilla] 找不到 Chrome：${CHROME}`)
    process.exit(2)
  }

  const browser = await chromium.launch({ executablePath: CHROME })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  const consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  const badResponses = []
  page.on('response', (r) => {
    if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`)
  })

  await page.goto(URL_ARG, { waitUntil: 'networkidle' }).catch((e) => {
    console.error('[vanilla] 打开失败：', e.message)
    process.exit(2)
  })
  await page.waitForTimeout(400)

  /* ---------- 1. 控制台与网络 ---------- */
  add('零控制台报错', consoleErrors.length === 0, [...new Set(consoleErrors)].slice(0, 5).join(' | '))
  add('零 4xx/5xx 响应', badResponses.length === 0, [...new Set(badResponses)].slice(0, 8).join(' | '))

  /* ---------- 2. dist-lite 合并 CSS 真的生效 ---------- */
  const cssInfo = await page.evaluate(() => {
    const sheet = [...document.styleSheets].find((s) => (s.href || '').includes('yd-ui.css'))
    let rules = 0
    try {
      rules = sheet ? sheet.cssRules.length : 0
    } catch {
      rules = -1
    }
    const probe = document.createElement('div')
    probe.className = 'btn btn-primary'
    document.body.appendChild(probe)
    const cs = getComputedStyle(probe)
    const out = { present: !!sheet, rules, display: cs.display, background: cs.backgroundColor, radius: cs.borderTopLeftRadius }
    probe.remove()
    return out
  })
  add('加载了 dist-lite/yd-ui.css', cssInfo.present, `rules=${cssInfo.rules}`)
  add('控件配方真的命中（.btn.btn-primary）', cssInfo.display === 'inline-flex' && cssInfo.radius !== '0px', JSON.stringify(cssInfo))

  /* ---------- 3. 外部 SVG sprite 的 use 真的解析成功 ---------- */
  const iconInfo = await page.evaluate(async () => {
    const svgs = [...document.querySelectorAll('svg')].filter((s) => s.querySelector('use'))
    const spriteHref = svgs.length ? svgs[0].querySelector('use').getAttribute('href') : ''
    const file = spriteHref.split('#')[0]
    let symbolIds = []
    let fetchOk = false
    try {
      const res = await fetch(file)
      fetchOk = res.ok
      const text = await res.text()
      symbolIds = [...text.matchAll(/<symbol[^>]*id="([^"]+)"/g)].map((m) => m[1])
    } catch {}
    const unresolved = []
    let zeroBox = 0
    for (const s of svgs) {
      const href = s.querySelector('use').getAttribute('href') || ''
      const id = href.split('#')[1]
      if (id && symbolIds.length && !symbolIds.includes(id)) unresolved.push(id)
      const b = s.getBBox()
      if (b.width < 0.5 || b.height < 0.5) zeroBox += 1
    }
    return { total: svgs.length, spriteFile: file, fetchOk, symbolCount: symbolIds.length, unresolved, zeroBox }
  })
  add('sprite 文件可获取', iconInfo.fetchOk, `${iconInfo.spriteFile} → ${iconInfo.symbolCount} 个 symbol`)
  add('所有 <use> 指向存在的 symbol', iconInfo.unresolved.length === 0, iconInfo.unresolved.join(', '))
  add('图标真的画出来了（getBBox 非零）', iconInfo.zeroBox === 0, `svg(带use) ${iconInfo.total} 个，零尺寸 ${iconInfo.zeroBox} 个`)

  /* ---------- 4. 各族都有非零渲染 ---------- */
  const families = await page.evaluate(() => {
    const sels = {
      btn: '.btn',
      tag: '.tag',
      card: '.card',
      table: '.table',
      formField: '.form-field',
      input: '.input',
      select: '.select',
      checkRow: '.check-row',
      radioRow: '.radio-row',
      switch: '.switch-track',
      tabs: '.tabs, .tab',
      pagination: '.pagination',
      pageBtn: '.page-btn',
      modal: '.modal',
      permTree: '.perm-tree',
      treeRow: '.tree-row',
      treeToggle: '.tree-toggle',
      iconTile: '.icon-tile',
      kpiAsset: '.kpi-asset',
      emptyState: '.empty-state',
      searchBox: '.search-box',
    }
    const out = {}
    for (const [k, sel] of Object.entries(sels)) {
      const els = [...document.querySelectorAll(sel)]
      const withSize = els.filter((e) => {
        const r = e.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      })
      out[k] = { count: els.length, sized: withSize.length }
    }
    return out
  })
  const emptyFamilies = Object.entries(families)
    .filter(([, v]) => v.sized === 0)
    .map(([k]) => k)
  add(
    '所有组件族都有非零渲染',
    emptyFamilies.length === 0,
    emptyFamilies.length ? `无渲染：${emptyFamilies.join(', ')}` : `${Object.keys(families).length} 族`,
  )

  /* ---------- 5. 状态标签的语义配色分组 ---------- */
  /**
   * 设计意图：14 个 tag-* 视觉类**不是** 14 种配色，而是收敛到 7 个「语义色调」——
   * 「待处理 / 紧急 / 即将到期」共用琥珀色，因为它们对用户是同一类信号；
   * 「已通过 / 有效 / 成功」共用绿色，同理。
   *
   * 所以正确的断言不是「配色越多越好」，而是：
   *   **组内必须完全一致（同一语义 = 同一视觉），组间必须互不混淆（不同语义不得撞色）。**
   * 组内不一致 → 同一语义在不同地方长相不同；组间撞色 → 用户分不清语义。
   * 两种都是真缺陷，而这正是要钉住的东西。
   *
   * 说明：本清单是「设计意图」的验收标准。若确为新增语义色，请同时更新这里与
   * core/styles/components.css，而不是放宽断言 —— 放宽等于放弃这条保护。
   */
  const TONE_GROUPS = {
    '琥珀 · 待办/提醒': ['tag-pending', 'tag-high', 'tag-expiring'],
    '蓝 · 处理中': ['tag-processing', 'tag-extending'],
    '紫 · 抄送': ['tag-cc'],
    '绿 · 通过/有效': ['tag-approved', 'tag-active', 'tag-success'],
    '红 · 驳回/危险': ['tag-rejected', 'tag-urgent', 'tag-expired', 'tag-danger'],
    '灰 · 失效/中性': ['tag-withdrawn', 'tag-terminated', 'tag-normal'],
    '青 · 兜底': ['tag-info'],
  }
  const ALL_DECLARED = Object.values(TONE_GROUPS).flat()

  const observed = await page.evaluate(() => {
    const out = {}
    for (const el of document.querySelectorAll('.tag')) {
      const cls = [...el.classList].find((c) => c.startsWith('tag-'))
      if (!cls || out[cls]) continue
      const cs = getComputedStyle(el)
      out[cls] = `${cs.color} / ${cs.backgroundColor}`
    }
    return out
  })

  const groupErrors = []
  const pairOwner = new Map() // 配色 -> 已有的组名（用来查撞色）
  for (const [groupName, members] of Object.entries(TONE_GROUPS)) {
    const present = members.filter((m) => observed[m])
    if (!present.length) {
      groupErrors.push(`组「${groupName}」在页面里一个都没演示到`)
      continue
    }
    const pairs = new Set(present.map((m) => observed[m]))
    if (pairs.size !== 1) {
      groupErrors.push(
        `组「${groupName}」组内配色不一致（同一语义两种长相）：` +
          present.map((m) => `${m}=${observed[m]}`).join(' ; '),
      )
      continue
    }
    const pair = [...pairs][0]
    if (pairOwner.has(pair)) {
      groupErrors.push(`组「${groupName}」与组「${pairOwner.get(pair)}」配色相同，语义撞色：${pair}`)
    } else {
      pairOwner.set(pair, groupName)
    }
  }
  const unregistered = Object.keys(observed).filter((c) => !ALL_DECLARED.includes(c))
  if (unregistered.length) {
    groupErrors.push(`页面用了未登记的 tag 类：${unregistered.join(', ')}`)
  }

  add(
    `状态标签按语义收敛到 ${Object.keys(TONE_GROUPS).length} 组配色（组内一致、组间互异）`,
    groupErrors.length === 0,
    groupErrors.length
      ? groupErrors.join(' | ')
      : `${Object.keys(observed).length} 个类 → ${pairOwner.size} 组，各组配色互不重复`,
  )

  /* ---------- 6. 表结构与关键 aria ---------- */
  const a11y = await page.evaluate(() => ({
    treeRole: document.querySelectorAll('[role="tree"]').length,
    treeItem: document.querySelectorAll('[role="treeitem"]').length,
    group: document.querySelectorAll('[role="group"]').length,
    dialog: document.querySelectorAll('[role="dialog"][aria-modal="true"]').length,
    closeLabel: document.querySelectorAll('[aria-label="关闭"]').length,
  }))
  add('树的 role 齐备', a11y.treeRole >= 1 && a11y.treeItem >= 4 && a11y.group >= 1, JSON.stringify(a11y))
  add('模态框有 dialog/aria-modal/关闭标签', a11y.dialog >= 1 && a11y.closeLabel >= 1, JSON.stringify(a11y))

  await browser.close()

  /* ---------- 输出 ---------- */
  const failed = checks.filter((c) => !c.ok)
  const lines = checks.map((c) => `${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  — ${c.detail}` : ''}`)
  const report = `VANILLA_PROBE checks=${checks.length} failed=${failed.length}\n` + lines.join('\n') + '\n'

  const outPath = path.join(LIB, '.workbuddy', 'verify', 'vanilla-probe.txt')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, report, 'utf8')
  process.stdout.write(report)

  process.exit(failed.length ? 1 : 0)
})().catch((e) => {
  console.error('[vanilla] 运行失败：', e)
  process.exit(2)
})
