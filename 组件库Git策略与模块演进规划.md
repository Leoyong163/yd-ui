# 组件库 Git 策略与模块演进规划

> 面向的问题：每个模块怎么做 git；以及后续要往里加的东西——移动端样式、图标库/素材库扩充、主题色库页面丰富、折叠屏与平板等断点、多设备自适应。
>
> 本规划承接 `组件库建设详细规划.md`（P0–P6 阶段划分）。P0/P1 已完成，本文件解决的是「代码怎么进版本控制」和「模块怎么切」，属于 P1.5 性质的基础设施规划。

---

## 0. 现状（实测，2026-09-21）

| 项 | 实测值 |
| --- | --- |
| 宿主 `宿主工程` | **不是 git 仓库**（`fatal: not a git repository`） |
| 库 `D:\demo\组件库` | **不是 git 仓库** |
| `D:\demo`（两者共同的父目录） | 也不是仓库；同级有 40+ 个互不相关的项目与散落文件 |
| 宿主源文件数 / 体积 | 452 个 / **82.82 MB**（排除 `node_modules`、`dist`） |
| 其中 `.workbuddy/verify` | **81.63 MB / 345 文件**（基线快照 24.16 MB × 4 份：`baseline` / `after` / `after-p1` / `after-p1b`） |
| 真正的源码体积 | 约 **1.2 MB**（`src` 0.82 + `site` 0.05 + `scripts` 0.10 + `docs` 0.12） |
| 库体积 | 36 文件 / **0.19 MB** |
| 宿主 `node_modules` | 180.79 MB（不入库） |

**两个直接结论：**

1. **宿主目录里 98% 的体积是不能入库的东西**。`git init && git add .` 会把 96 MB 快照垃圾提交进去，之后每次 `git status` 都卡。做任何仓库拆分之前，先解决这个。
2. 库只有 0.19 MB，**拆分成本极低**——现在切是最便宜的时候，往后每加一个图标库/素材库都会变贵。

---

## 1. 第一个决定：几个仓

### 方案 A · 单仓 monorepo（推荐）

```
yd-design/                        ← 一个 git 仓库
├─ apps/
│   ├─ portal/                    ← 业务门户（现「宿主工程」）
│   └─ docs/                      ← 组件文档站（现 docs.html + site/）
├─ packages/
│   ├─ tokens/                    ← @yd/tokens   设计令牌 + 断点 + 主题集
│   ├─ icons/                     ← @yd/icons    图标库
│   ├─ assets/                    ← @yd/assets   素材库（KPI 图 / 插画 / logo）
│   └─ ui/                        ← @yd/ui       组件 + 样式层
├─ tooling/
│   └─ scripts/                   ← gen-tokens / gen-icons / manifest / 基线门禁
├─ pnpm-workspace.yaml
└─ .gitignore
```

**为什么推荐它**（逐条对着你要做的事）：

| 你要做的事 | 为什么单仓更合适 |
| --- | --- |
| 断点 + 多设备自适应 | 这类改动**天然横跨** tokens → styles → components → 宿主页面。多仓意味着四个仓库同时改，而且**任何中间态都是坏的** |
| 移动端样式 | 直引源码模式下，库改一处宿主立刻变；只有 monorepo 的原子提交能表达「这次视觉变化是有意的」 |
| 图标库 / 素材库扩充 | 加图标要同时动：SVG 源、生成的 TS 表、manifest、文档站图标页。单仓一个 commit 收口 |
| 主题色库丰富 | 新增一套主题要动 tokens 真源、生成的 CSS、文档站主题页。同上 |
| 回归门禁 | 一套基线跑一次覆盖全部模块，不用在多个仓库里各自维护一份门禁 |

代价与对策：

- 仓库会变大（素材二进制）→ 见 §2.4 的 LFS 阈值
- 发布粒度耦合 → 用 changesets 生成内部版本号与 CHANGELOG；真要对外发 npm 时再拆

### 方案 B · 两仓 + submodule（备选）

`yd-ui`（packages 全部 + docs）与 `permission-portal`（宿主），宿主用 submodule 把库挂到 `vendor/yd-ui`。

**什么时候选它**：宿主目录必须原地不动、或库要给别的业务线复用、且不想上 workspace。

代价：submodule 心智负担；**跨边界改动永远是两个提交**（子仓提交 → 更新指针），而这恰好是你未来半年的主要工作模式。

### 方案 C · 两仓 + 私有 registry（暂不选）

改一处 → 发版 → 升依赖，反馈环从秒级变分钟级。这是 P1 已经明确否掉的方案，只有「库要交付给不共享文件系统的同事」时才值得重启讨论。

### 切换触发线（写死，避免反复摇摆）

| 触发条件 | 动作 |
| --- | --- |
| 出现第二个消费方（别的业务系统要引 `@yd/ui`） | 评估 B 或 C |
| 库要交付给不共享文件系统的同事 | 转 C |
| 单仓体积 > 500 MB（不含 LFS 对象） | 把 `assets` 拆成独立仓 |

---

## 2. 每个模块的 git 规则

### 总览

| 模块 | 目录 | 包名 | 变更频率 | 生成物入库 | 版本语义 |
| --- | --- | --- | --- | --- | --- |
| 设计令牌 | `packages/tokens` | `@yd/tokens` | 中 | **是** | 增=minor；改值=minor（标 visual）；删/改名=major |
| 断点 | 并入 `packages/tokens` | — | 低 | **是** | 改断点=基线换代，单独 commit |
| 图标 | `packages/icons` | `@yd/icons` | 高 | **是** | 增=minor；改名/删=major |
| 素材 | `packages/assets` | `@yd/assets` | 高 | 源文件入库，派生格式不入库 | 增=minor；删=minor（走 deprecation） |
| 组件 + 样式 | `packages/ui` | `@yd/ui` | 中 | **否**（无构建产物） | 增 prop=minor；删/改名=major |
| 文档站 | `apps/docs` | — | 中 | 否（`dist-docs` 忽略） | 跟随库版本 |
| 业务门户 | `apps/portal` | — | 高 | 否（`dist` 忽略） | 跟随产品发版 |

「生成物入库」的判据只有一条：**消费方（宿主）需不需要先跑构建才能用**。库是直引源码模式，宿主不跑库的构建，所以生成物必须在仓库里，同时用 CI 校验它与真源同步。

---

### 2.1 `@yd/tokens` —— 令牌 + 断点 + 主题集

**这是未来半年最该先重构的模块**，因为「主题色库丰富」「断点」「多设备」三件事全部落在它身上。

建议目录（从现在的单文件 `tokens.ts` 演进）：

```
packages/tokens/
├─ src/
│   ├─ primitives.ts      原子值：色阶、间距刻度、字阶、层级
│   ├─ semantic.ts        语义层：--primary / --bg / --text / --border …
│   ├─ breakpoints.ts     断点常量（唯一真源）
│   └─ themes/
│       ├─ light.ts
│       ├─ dark.ts
│       ├─ brand-yellow.ts    ← 飞书品牌黄版
│       └─ high-contrast.ts   ← 预留
├─ styles/                （生成物，入库）
│   ├─ tokens.css
│   ├─ theme-brand-yellow.css
│   └─ theme-high-contrast.css
└─ scripts/gen-tokens.mjs
```

规则：

- **真源与生成物同一 commit**。CI 挂 `check:tokens`，不同步直接 fail。
- 生成器保持「只做 `--k: v;` 机械拼装，不掺单位推断」的既有约定；值一律写成 CSS 值字符串。
- 改令牌值属于**视觉变化**，即使语义上只是 minor，也要在 CHANGELOG 里标 `visual`，并附上基线比对结果。

> **断点的坑（必须知道）**：CSS 自定义属性**不能用在 `@media` 条件里**——`@media (min-width: var(--bp-md))` 是无效的。所以断点必须**双出口**：
> 1. **JS 常量**（供 `useBreakpoint()` / `matchMedia`）
> 2. **构建期生成真实的 `@media` 规则**（不能靠 `var()`）
>
> 只做其中一边，都会得到「看起来定义了但实际不生效」的断点。

---

### 2.2 断点与多设备自适应

**断点是双轴的，不只是宽度：**

| 轴 | 取值 | 说明 |
| --- | --- | --- |
| 宽度 | `xs <576` / `sm ≥576` / `md ≥768` / `lg ≥1024` / `xl ≥1280` / `2xl ≥1536` | 常规响应式 |
| 形态 | 单屏 / 折叠态 / 展开态 / 阔折叠 | 折叠屏：`horizontal-viewport-segments`、`env(fold-*)`，**需要能力检测而非只测宽度** |
| 输入 | 触摸 / 精确指针 | `@media (pointer: coarse)`，影响触达尺寸（≥44px） |

**实现策略：组件用容器查询，页面用断点。**

> ⚠️ **不要建一个平铺的 `mobile.css` 去覆写控件。**
> 一个控件的移动端表现是它自身的一部分，应该写进该控件在 `components` 层里的媒体/容器查询块。
> 单独一层 `mobile.css` 会在同一个控件上制造**第二次覆盖战**——这正是 P0 阶段花大力气拆解的 `components.css` × `pages.css` 覆盖关系。别再来一次。

**git 影响**：基线的视口矩阵要扩容，从现在的 3 视口增加折叠（约 344 / 717 双段）与平板（768 / 1024）。采集参数版本化在 `verify/baseline/index.json` 里，**参数一改就是一次「基线换代」，必须单独 commit 并 Tag**。

---

### 2.3 `@yd/icons` —— 图标库

- **源 SVG 与生成 TS 表都入库**；`gen:icons` 脚本 + CI 校验（`check:icons`）。
- 命名规范写死（如 `icon-<域>-<名>`）并配 allowlist——模板里图标是靠字符串类名引用的，没有编译期保护。
- **单文件会失控**：现在 `icons.ts` 是 62 行 SVG 表，扩到几百个图标会变成几千行，既拖慢构建也让 AI 读不动。按域拆：`icons/{nav,status,action,file,device}.ts` + `index.ts` 聚合。
- 产出 `icons.json` manifest，供文档站图标页与 AI 助手共用。
- **改名 / 删除 = major 版本**，并配 codemod。

---

### 2.4 `@yd/assets` —— 素材库

- 二进制**入库**，用 `.gitattributes` 标记；**单文件 > 2 MB 或目录 > 50 MB 时启用 Git LFS**。
- 源文件（png/svg）入库；**派生格式（webp / avif / 多倍图）构建期生成、不入库**。
- 产出 `assets.json` manifest，并导出 TS key 常量（沿用现在 `kpi-assets.ts` 的既有模式）。
- ⚠️ LFS 与「直引源码」并存时，clone 后必须 `git lfs pull` 才能拿到图。这条要写进 README，否则新人会看到一堆空图。

---

### 2.5 `@yd/ui` —— 组件 + 样式层

- 目录按组件建文件夹：`components/<Name>/<Name>.vue`（后续可放 demo / 类型 / 测试）。
- 样式层从现在的三层扩到四层，但**加载顺序不变式依旧成立**：

```
tokens → base → components → responsive        ← 库，全部必须排在宿主 pages.css 之前
```

- 组件与它对应的配方 CSS **必须同一 commit**，否则中间态是坏的。
- 继续禁止：组件内 `<style>`、生成物 `dist`。
- 门禁：`vite build` + 基线 `DIFF_TOTAL = 0`。

---

### 2.6 `apps/docs` —— 文档站

- 独立 app，**只读**库的 manifest 与生成物；`dist-docs` 不入库。
- 未来三个页面直接由数据驱动，不手写：
  - 主题色库页 ← 遍历 tokens 的主题集
  - 图标库页 ← 遍历 `icons.json`
  - 断点页 ← 可视化各断点/形态下的布局
- **硬规则：文档站不得手写组件清单**。一律从 `schema/components.json` 生成，否则文档和实现必然漂移。

---

### 2.7 `apps/portal` —— 业务门户

- 只放业务逻辑与页面级样式，不再放组件与控件配方。
- 门禁：`vite build` + 基线。

---

## 3. 跨模块联动规则

改任何一处，都要知道「还必须同时动哪些东西」：

| 你改了 | 必须同时做 |
| --- | --- |
| tokens 真源 | 跑 `gen:tokens` → 生成物 → 跑基线 → 文档站令牌页自动更新 |
| 断点定义 | 生成 `@media` 骨架 + `useBreakpoint` 常量 + **基线视口矩阵换代** |
| 图标 | 跑 `gen:icons` → `icons.json` → 文档站图标页自动更新 |
| 素材 | 更新 `assets.json` + 导出常量 |
| 组件 props | 更新 `schema/components.json` → 文档站 API 表自动更新 |
| 样式配方 | 跑基线；`DIFF` 非 0 要么修，要么**显式接受并更新基线**（不能默认放过） |

**一句话概括：任何影响视觉的改动 = 真源 + 生成物 + 基线，同一个 commit。**

---

## 4. 提交与分支规范

- **Conventional Commits，scope = 模块名**：
  `feat(tokens): 新增断点令牌` / `fix(ui/modal): 修正移动端高度` / `chore(docs): 补图标页`
- **分支**：trunk-based + 短命分支（`feat/mobile-adaptation`），合并前必过门禁。
- **Tag**：整体版本 `v0.2.0`；分包版本用 changesets 生成（`ui@0.2.0`、`tokens@0.2.0`）。
- **基线随版本打点**：`baseline/v0.1.0`、`baseline/v0.2.0`，出视觉回归时能二分定位到具体版本。

---

## 5. `.gitignore` 与入库清单（先做这一步）

**必须忽略：**

```gitignore
node_modules
dist
dist-docs
*.log
.workbuddy/verify/       # ← 81.63 MB，本机验证产物，绝不能入库
```

**必须入库：**

```
src/  site/  scripts/  docs/  public/
index.html  docs.html
package.json  pnpm-lock.yaml  pnpm-workspace.yaml
tsconfig*.json  vite*.ts
README.md
.workbuddy/memory/       # ← 很小（30 KB），是项目知识，入库
```

**基线快照的处置**（关键决定）：

- **快照本身不入库**。理由有二：① 24 MB × N 份纯属仓库负担；② 它记录的是**本机**的字体渲染与布局结果，换机器本就不可比——跨机比对本就会误报。
- **入库的只有**：采集脚本 `scripts/p0-baseline*.cjs`，以及 `verify/baseline/index.json`（5.4 KB，记录采集参数与元素计数）。
- 好处：门禁在本机随时可复跑，仓库不背 96 MB 垃圾；元素计数一旦变化，说明环境或代码漂移，能被立刻发现。

> `.workbuddy` 目录本身不是缓存，是要保留的项目数据；这里只忽略它下面的 `verify/` 子目录。

---

## 6. 落地步骤（最小改造，分 4 步）

| 步骤 | 内容 | 过关条件 |
| --- | --- | --- |
| **① 挡住不该入库的** | 两处各写 `.gitignore`；`git init` 但**先不 commit**，用文件数与体积核对待入库范围 | 宿主待入库约 460 文件 / 1.5 MB 量级（不是 800 文件 / 83 MB） |
| **② 先各自建仓跑通（保底）** | 宿主一仓、库一仓，各 `main` 一次提交，打 tag `v0.1.0`。**此步不改目录结构**，随时可退回 | 两仓 `git status` 干净 |
| **③ 决定是否迁到单仓** | 若选方案 A：把库与宿主挪进 `yd-design/{packages,apps}`，改 Vite alias 到新路径（`YD_UI_DIR` 环境变量兜底） | `vite build` 通过 **且基线 `DIFF_TOTAL = 0`** |
| **④ 再拆模块** | 从 `@yd/ui` 里把 tokens / icons / assets 拆成独立包（纯搬文件 + 改 import） | 同上，`DIFF_TOTAL = 0` |

**③ 和 ④ 必须以基线为门禁，一次只搬一块，不要一次性搬完。**

---

## 7. 风险清单

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| `.workbuddy/verify` 被提交 | 仓库瞬间 96 MB，`git status` 卡死 | `.gitignore` + 首次 commit 前核对文件数/体积 |
| 生成物与真源不同步 | 消费方拿到旧值，问题极难定位 | CI `check:tokens` / `check:icons`，不同步即 fail |
| 断点用 `var()` 写 `@media` | **静默失效**，看起来定义了其实不生效 | 断点双出口：JS 常量 + 构建期生成 `@media` |
| 另起 `mobile.css` 平铺覆写 | 重演控件覆盖战，外观不可预测 | 移动端表现写进各控件的媒体/容器查询块 |
| 二进制撑爆仓库 | clone 慢、diff 卡 | LFS 阈值；派生格式不入库 |
| 基线跨机器比对 | 门禁误报 | 基线只在同一机器比对；采集参数入 `index.json` |
| 图标改名破坏引用 | 静默坏样式 | 改名/删除走 major + codemod |
| 仓库放在 `D:\demo` 这种杂物盘下 | 误提交无关文件；磁盘/权限风险 | 迁到独立目录（方案 A/C 的天然好处） |

---

## 8. 一句话总结

**先挡住 96 MB 验证产物，再决定几个仓；推荐单仓 pnpm workspace 把 tokens / icons / assets / ui / docs / portal 切成六个模块；断点与自适应要跨模块原子提交，所以单仓是这三个未来需求的最优解。**
