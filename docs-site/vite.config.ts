import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 文档站的独立构建配置（P2b：从宿主「迁回」库内）。
 *
 * 为什么必须独立：在 P2b 之前，这份站点住在业务宿主 `宿主工程` 里，
 * 靠宿主 `vite.config.ts` 的 alias 才能解析 `@yd/ui`，构建则借用宿主的
 * `vite.docs.config.ts`（mergeConfig）。后果是——
 *   **库自己的文档站，离开宿主就跑不起来。**
 * 库要能整体交付给别的项目用，就不能带着这种反向依赖。
 *
 * 现在这份配置自带全部解析规则，只依赖库自己：
 *   · `../src`     —— 库的源码（core / vue 两层）
 *   · `../schema`  —— 类名契约与组件清单
 *   · `../node_modules` —— peer 依赖（vue / ant-design-vue / dayjs）
 *
 * 与宿主配置的**唯一**共同点，是那份 alias 的写法（消费者契约）。
 * 两侧不再共享文件，改一边不会牵动另一边。
 *
 * 用法（在库根目录执行）：
 *   npm run docs          → http://localhost:5174/
 *   npm run docs:build    → docs-site/dist-docs/
 *   npm run docs:preview  → 预览构建产物
 *
 * 注意根路径：`root` 显式钉在 docs-site，因此入口就是 `/`（不再是 `/docs.html`）。
 * 不显式指定的话 Vite 会用 `process.cwd()`，从库根跑就会指错目录。
 */
const DOCS_DIR = path.dirname(fileURLToPath(import.meta.url))
const LIB_DIR = path.resolve(DOCS_DIR, '..')
const LIB_MODULES = path.join(LIB_DIR, 'node_modules')

/**
 * peer 依赖兜底。
 *
 * 库的源码在 `../src`，那里的 `import { computed } from 'vue'` 会从
 * `docs-site/../src/...` 逐级向上找 node_modules —— 库根有，所以理论上能找到。
 * 但显式钉死更稳：`vite build` 与 `vite dev` 是两条不同的解析路径，
 * 这条经验是从宿主配置里搬过来的（那边踩过一次 build 才炸的坑）。
 */
const PEER_ALIAS = ['vue', 'ant-design-vue', 'dayjs'].flatMap((name) => [
  { find: new RegExp(`^${name}$`), replacement: path.join(LIB_MODULES, name) },
  { find: new RegExp(`^${name}/(.*)$`), replacement: `${path.join(LIB_MODULES, name)}/$1` },
])

export default defineConfig({
  root: DOCS_DIR,
  // 相对路径，产物可放在任意子路径下（如 https://host/ui-docs/）
  base: './',
  // 只要 vue —— 文档站零 Tailwind（317 个 class 里没有原子类），
  // 样式全部来自库的 core 三层 + 自带的 site.css。
  plugins: [vue()],
  resolve: {
    alias: [
      // `@yd/ui` 必须排在 `@yd/ui/...` 之后，否则裸前缀会先命中，
      // 把 `@yd/ui/core/styles/tokens.css` 拼成 `src/index.ts/core/styles/...`
      { find: /^@yd\/ui\/(.*)$/, replacement: `${LIB_DIR}/src/$1` },
      { find: /^@yd\/ui$/, replacement: `${LIB_DIR}/src/index.ts` },
      { find: /^@yd\/schema\/(.*)$/, replacement: `${LIB_DIR}/schema/$1` },
      ...PEER_ALIAS,
    ],
  },
  server: {
    port: 5174,
    strictPort: true,
    // 库源码与 schema 都在 docs-site 之外，必须显式放行
    fs: { allow: [DOCS_DIR, LIB_DIR] },
  },
  preview: {
    port: 5174,
    strictPort: true,
  },
  optimizeDeps: {
    // 库源码不参与预打包，避免改了库要重启 dev server
    exclude: ['@yd/ui'],
  },
  build: {
    outDir: path.resolve(DOCS_DIR, 'dist-docs'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
