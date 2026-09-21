# docs-site —— 组件库文档站

`@yd/ui` 的组件文档站：组件预览、API、设计令牌、分层说明、给 AI 的接入指引。

**它属于库，不属于任何宿主。** 库被交给别的项目用时，文档站跟着走。

## 为什么它从宿主搬了回来（P2b）

在此之前，这套站点住在业务宿主 `宿主工程` 里，靠宿主的 `vite.config.ts` alias 才能
解析 `@yd/ui`，构建则借用宿主的 `vite.docs.config.ts`。后果是：

| 症状 | 后果 |
|---|---|
| 库的门禁 `vanilla-parity.cjs` 默认指向宿主的 `5173` | **库离开宿主，就跑不了自己的验收** |
| 库的 `README.md` 让人去宿主目录起服务 | 拿到库的人不知道文档站在哪 |
| 文档站的源码在宿主仓 | 「把库给别的项目用」时，文档站不会被一起带走 |

现在站点自带 [`vite.config.ts`](./vite.config.ts)，只依赖库自己。

## 跑起来

在**库根目录**执行（不是在这里）：

```bash
pnpm install          # 首次：装 vue / vite / @vitejs/plugin-vue
npm run docs          # → http://localhost:5174/
npm run docs:build    # → docs-site/dist-docs/
npm run docs:preview  # 预览构建产物
```

路径是 `/` 而不是 `/docs.html`：`root` 显式钉在 `docs-site`，入口就是 `index.html`。
（不显式指定 `root` 的话 Vite 会用 `process.cwd()`，从库根跑就会指错目录。）

## 结构

```
docs-site/
├─ index.html        入口（由原宿主 docs.html 迁来，脚本路径 /site/main.ts → /main.ts）
├─ main.ts           挂载 DocsApp
├─ DocsApp.vue       站点本体：导航、页面路由（hash）、组件演示区
├─ site.css          站点骨架样式（header / sider / content / 代码块）
├─ data/renderers.ts 演示渲染器：把 components.json 里的代码片段跑成活的控件
├─ ui/               DemoBlock.vue、DocSearch.vue
├─ vite.config.ts    独立构建配置
└─ dist-docs/        构建产物（不入库）
```

## 两条边界（别破坏）

**一、零宿主依赖。** `main.ts` 的 import 只有 `vue`、`@yd/ui/core/styles/*`、`./site.css`、
`./DocsApp.vue`。不引宿主任何样式或组件 —— 这不是巧合，是刻意的：
**只要这一页看起来是对的，就证明库的样式能脱离宿主、脱离 Vue 独立成立。**
加任何宿主引用都会让这个证据失效。

**二、零 Tailwind。** 站点 317 个 class 里没有一个原子类，样式全部来自库的 core 三层
（`tokens.css` → `base.css` → `components.css`）加自带的 `site.css`。
所以 `vite.config.ts` 里**只挂 `vue()` 插件**，不挂 Tailwind —— 库的 `base.css`
自带 reset（`*{box-sizing}` + `body{margin:0;font-family}`），不依赖任何预检样式。

## 配套门禁

这两个脚本在库根的 `scripts/` 下，默认都打这个站点的 5174：

```bash
npm run docs                       # 另开一个终端先起站点
node scripts/docs-probe.cjs        # 浏览器验收：控制台零报错、导航数对、组件真的渲染了、令牌切换后计算值确实变了
node scripts/docs-inspect.cjs      # 抓渲染结果成文本，供人工核对
```

跨两层的那个断言（core 的类名配方 == vue 组件的视觉）由 `scripts/vanilla-parity.cjs` 守着：
它把本站在 `#/component/*` 页里渲染出的控件，与 `examples/vanilla/index.html` 里手写 HTML
拼出的同名控件逐属性比对，25 项 × 26 个属性，全等才算过。
