/**
 * 文档站入口。
 *
 * 只引库的**零框架层**三层样式 —— **不引宿主任何样式，也不引任何组件**。
 * 这是刻意的：如果这一页看起来是对的，就证明库的样式能脱离宿主、
 * 脱离 Vue 独立成立（文档站组件页的预览倒是用 Vue，但那是在组件页里按需 import 的）。
 *
 * P2 分层后路径都带 `core/`：样式属零框架层。
 */
import { createApp } from 'vue'
import '@yd/ui/core/styles/tokens.css'
import '@yd/ui/core/styles/base.css'
import '@yd/ui/core/styles/components.css'
import './site.css'
import DocsApp from './DocsApp.vue'

createApp(DocsApp).mount('#app')
