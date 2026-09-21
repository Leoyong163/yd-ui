#!/usr/bin/env node
/**
 * check-layering.selftest.cjs —— 门禁自测：验证 check-layering.cjs **确实会失败**。
 *
 *   node scripts/check-layering.selftest.cjs
 *
 * 为什么必须有这个：没见过失败的门禁等于没有门禁。
 * 这类静态检查最常见的失效方式不是规则写错，而是规则写得让正则**永远匹配不到** ——
 * 命令行显示 ✓，实际什么都没查。改一次规则就跑一次这个自测。
 *
 * 两类用例：
 *   ① 基线：门禁跑**真实库**必须通过 —— 防规则过严（误报会训练人忽略门禁）
 *   ② 违规：在合成副本里逐条注入，断言门禁报得出、且报的是**对的检查项**
 *
 * 实现说明：用合成的极小库（synthetic fixture）而不是复制真库。
 * 原因是实测 `fs.cpSync` 在受限沙箱里会让 node 直接终止（0xC0000417，无可读报错），
 * 而合成副本只需 mkdir/writeFile，既避开这个坑，也让每个用例的输入完全显式。
 *
 * 退出码 0 = 自测通过。
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const LIB = path.join(__dirname, '..')
const GATE = path.join(__dirname, 'check-layering.cjs')
const TMP = path.join(LIB, '.workbuddy', 'selftest-tmp')

let failures = 0
let cases = 0

/* ---------- 合成库 ---------- */
const FIXTURE = {
  'package.json': `{ "name": "@yd/ui", "version": "0.0.0-selftest" }\n`,
  'schema/class-contract.json': JSON.stringify(
    {
      package: '@yd/ui',
      version: '0.0.0-selftest',
      families: [
        { prefix: 'btn', title: '按钮', root: 'btn', note: '', count: 2, classes: ['btn', 'btn-ghost'] },
        { prefix: 'tag', title: '标签', root: 'tag', note: '', count: 1, classes: ['tag'] },
      ],
      unmatchedClasses: [],
      stateClasses: ['active'],
      stateOwners: {},
      responsiveClasses: [],
      statusWords: {},
      tagFallback: 'tag',
      urgencyWords: {},
      tones: [],
      iconKeys: [],
      shortcutPalette: [],
      assets: {},
      skinHooks: { 'tree-toolbar-btn': '合成fixture里的皮肤钩子' },
    },
    null,
    2,
  ) + '\n',
  'src/core/styles/tokens.css': `:root { --x: 1px; }\n`,
  'src/core/styles/base.css': `* { box-sizing: border-box; }\n`,
  'src/core/styles/components.css': `.btn { color: red; }\n.btn-ghost { color: blue; }\n.tag { color: green; }\n`,
  'src/core/styles/index.css': `@import './tokens.css';\n@import './base.css';\n@import './components.css';\n`,
  'src/core/contract/tree.ts': `export const count = 0\n`,
  'src/core/icons/icons.ts': `export const icons = {}\n`,
  'src/core/index.ts': `export { count } from './contract/tree'\n`,
  'src/vue/index.ts': `export { default as Demo } from './components/Demo.vue'\n`,
  'src/vue/components/Demo.vue':
    `<script setup lang="ts">\nconst x = 1\n</script>\n\n<template>\n  <div class="btn btn-ghost tag tree-toolbar-btn">{{ x }}</div>\n</template>\n`,
  // 文档站的合成版本：只引库自身与 vue —— 这是 D1/D2 的合规基线
  'docs-site/index.html': `<!doctype html>\n<script type="module" src="/main.ts"></script>\n`,
  'docs-site/main.ts':
    `import { createApp } from 'vue'\n` +
    `import '@yd/ui/core/styles/tokens.css'\n` +
    `import './site.css'\n` +
    `createApp({}).mount('#app')\n`,
  'docs-site/site.css': `body { margin: 0; }\n`,
  'docs-site/DocsApp.vue': `<template>\n  <pre class="demo-code"><code>npm run docs   # 5174</code></pre>\n  <div class="doc-root">docs</div>\n</template>\n`,
}

function buildFixture() {
  fs.rmSync(TMP, { recursive: true, force: true })
  for (const [rel, content] of Object.entries(FIXTURE)) {
    const full = path.join(TMP, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, content, 'utf8')
  }
}

const writeFixture = (rel, content) => {
  const full = path.join(TMP, rel)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content, 'utf8')
}
const readFixture = (rel) => fs.readFileSync(path.join(TMP, rel), 'utf8')

/* ---------- 跑门禁 ---------- */
function runGate(root) {
  try {
    const out = execFileSync(process.execPath, [GATE, '--root', root, '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, parsed: JSON.parse(out) }
  } catch (e) {
    const raw = (e.stdout || '') + (e.stderr || '')
    try {
      return { code: e.status ?? 1, parsed: JSON.parse(raw) }
    } catch {
      return { code: e.status ?? 1, parsed: { problems: [], _raw: raw.slice(0, 400) } }
    }
  }
}

/* ---------- 断言 ---------- */
function caseRealLib() {
  cases += 1
  const { code, parsed } = runGate(LIB)
  const ps = parsed.problems || []
  if (code === 0 && ps.length === 0) {
    console.log(`  ✓ 基线：真实库通过门禁（${parsed.coreFiles} core 文件 / ${parsed.vueFiles} 组件 / ${parsed.contractClasses} 类名）`)
  } else {
    failures += 1
    console.error(`  ✗ 基线：真实库未通过（退出码 ${code}，违规 ${ps.length}）`)
    for (const p of ps.slice(0, 8)) console.error(`      ${p.check} ${p.file} :: ${p.msg}`)
  }
}

function expect(label, mutate, predicate) {
  cases += 1
  buildFixture()
  mutate()
  const { code, parsed } = runGate(TMP)
  const ps = parsed.problems || []
  if (predicate({ code, problems: ps, parsed })) {
    console.log(`  ✓ ${label} → ${ps.length ? ps.map((p) => p.check).join('+') : '（无违规）'}`)
  } else {
    failures += 1
    console.error(`  ✗ ${label}`)
    console.error(`      退出码=${code} 违规数=${ps.length}`)
    for (const p of ps.slice(0, 6)) console.error(`      ${p.check} ${p.file} :: ${p.msg}`)
    if (parsed._raw) console.error(`      原始输出：${parsed._raw}`)
  }
}

console.log(`[selftest] 合成副本：${TMP}\n`)

/* ---------- ① 基线 ---------- */
caseRealLib()

/* ---------- ② 违规注入 ---------- */
expect(
  '合成副本本身应通过（fixture 有效性自检）',
  () => {},
  ({ code, problems }) => code === 0 && problems.length === 0,
)

expect(
  'C1 应报出 core 依赖 vue',
  () => writeFixture('src/core/contract/tree.ts', `import { computed } from 'vue'\nexport const count = 0\n`),
  ({ code, problems }) => code === 1 && problems.some((p) => p.check === 'C1' && p.file.endsWith('tree.ts')),
)

expect(
  'C1 不应被文档注释误伤（注释里写 import vue 不算违规）',
  () =>
    writeFixture(
      'src/core/contract/tree.ts',
      `// 本文件不得出现 import { x } from 'vue' —— 这句话只是说明\n/** 也不得 from 'ant-design-vue' */\nexport const count = 0\n`,
    ),
  ({ code, problems }) => code === 0 && problems.length === 0,
)

expect(
  'C2 应报出 core 里的 .vue 文件',
  () => writeFixture('src/core/contract/Oops.vue', `<template><div /></template>\n`),
  ({ code, problems }) => code === 1 && problems.some((p) => p.check === 'C2'),
)

expect(
  'C3 应报出越出库根的相对路径',
  () => writeFixture('src/core/contract/tree.ts', `import { riskLevel } from '../../../../../host/src/shared'\nexport const count = 0\n`),
  ({ code, problems }) => code === 1 && problems.some((p) => p.check === 'C3'),
)

expect(
  'C3 不应误伤库内正常相对路径',
  () => writeFixture('src/core/contract/tree.ts', `import { icons } from '../icons/icons'\nexport const count = 0\n`),
  ({ code, problems }) => code === 0 && problems.length === 0,
)

expect(
  'C3 应报出宿主别名 @/',
  () => writeFixture('src/core/contract/tree.ts', `import { riskLevel } from '@/shared'\nexport const count = 0\n`),
  ({ code, problems }) => code === 1 && problems.some((p) => p.check === 'C3' && p.msg.includes('宿主别名')),
)

expect(
  'V1 应报出组件带 <style>',
  () => writeFixture('src/vue/components/Demo.vue', readFixture('src/vue/components/Demo.vue') + `\n<style scoped>.btn { color: pink }</style>\n`),
  ({ code, problems }) => code === 1 && problems.some((p) => p.check === 'V1'),
)

expect(
  'V2 应报出契约外的库类名',
  () => writeFixture('src/vue/components/Demo.vue', readFixture('src/vue/components/Demo.vue').replace('class="btn', 'class="btn-primry')),
  ({ code, problems }) => code === 1 && problems.some((p) => p.check === 'V2' && p.msg.includes('btn-primry')),
)

expect(
  'V2 不应误伤契约内的类名与已登记皮肤钩子',
  () =>
    writeFixture(
      'src/vue/components/Demo.vue',
      `<template>\n  <div :class="\`btn \${x ? 'btn-ghost' : ''} active tree-toolbar-btn\`"></div>\n</template>\n`,
    ),
  ({ code, problems }) => code === 0 && problems.length === 0,
)

expect(
  'V2 不应误伤非库家族的类名（宿主透传/业务类）',
  // 注意必须保留 tree-toolbar-btn：它是合成 fixture 里唯一被模板引用的皮肤钩子，
  // 少了它 A2 会（正确地）报「陈旧条目」。第一版自测就是漏了这点被自己抓出来的。
  () => writeFixture('src/vue/components/Demo.vue', `<template>\n  <div class="my-own-class data-role-tag tree-toolbar-btn"></div>\n</template>\n`),
  ({ code, problems }) => code === 0 && problems.length === 0,
)

expect(
  'A1 应报出三层顺序被改动',
  () => writeFixture('src/core/styles/index.css', `@import './base.css';\n@import './tokens.css';\n@import './components.css';\n`),
  ({ code, problems }) => code === 1 && problems.some((p) => p.check === 'A1' && p.msg.includes('三层顺序')),
)

expect(
  'A2 应报出陈旧皮肤钩子（登记了但没模板用）',
  () => {
    const c = JSON.parse(readFixture('schema/class-contract.json'))
    c.skinHooks['never-used-hook'] = '陈旧条目'
    writeFixture('schema/class-contract.json', JSON.stringify(c, null, 2) + '\n')
  },
  ({ code, problems }) => code === 1 && problems.some((p) => p.check === 'A2'),
)

/* ---------- D1 / D2：文档站隔离 ---------- */
expect(
  'D1 应报出文档站引入第三方包（非库、非 peer）',
  () => writeFixture('docs-site/main.ts', `import { chunk } from 'lodash-es'\nimport { createApp } from 'vue'\n`),
  ({ code, problems }) => code === 1 && problems.some((p) => p.check === 'D1' && p.msg.includes('lodash-es')),
)

expect(
  'D1 应报出文档站引用宿主别名 @/',
  () => writeFixture('docs-site/main.ts', `import { helper } from '@/host/helper'\n`),
  ({ code, problems }) => code === 1 && problems.some((p) => p.check === 'D1'),
)

expect(
  'D1 不应误伤 vue / @yd/* / 相对路径',
  () =>
    writeFixture(
      'docs-site/main.ts',
      `import { createApp } from 'vue'\nimport '@yd/ui/core/styles/base.css'\nimport DocsApp from './DocsApp.vue'\ncreateApp(DocsApp)\n`,
    ),
  ({ code, problems }) => code === 0 && problems.length === 0,
)

expect(
  'D2 应报出文档站运行时引用宿主端口 5173',
  () => writeFixture('docs-site/main.ts', `const HOST = 'http://localhost:5173/'\nexport default HOST\n`),
  ({ code, problems }) => code === 1 && problems.some((p) => p.check === 'D2' && p.msg.includes('5173')),
)

expect(
  'D2 应报出文档站写死宿主目录绝对路径',
  () => writeFixture('docs-site/main.ts', `const DIR = 'D:/demo/grok/host/vue'\nexport default DIR\n`),
  ({ code, problems }) => code === 1 && problems.some((p) => p.check === 'D2'),
)

expect(
  'D2 不应误伤 .vue 里 <pre> 代码示例中的宿主地址（那是讲给读者看的正文）',
  () =>
    writeFixture(
      'docs-site/DocsApp.vue',
      `<template>\n  <pre><code>node scripts/p0-baseline.cjs --url http://localhost:5173/</code></pre>\n  <div class="doc-root">docs</div>\n</template>\n`,
    ),
  ({ code, problems }) => code === 0 && problems.length === 0,
)

/* ---------- 收尾 ---------- */
fs.rmSync(TMP, { recursive: true, force: true })

console.log(`\n[selftest] ${cases - failures}/${cases} 通过`)
if (failures) {
  console.error(`[selftest] ✗ ${failures} 项未通过 —— 门禁规则有问题，别信它的 ✓`)
  process.exit(1)
}
console.log('[selftest] ✓ 门禁确实会失败，且真库与正常写法都不误报')
