/**
 * 演示渲染层 —— 文档站里「实时预览」部分。
 *
 * 为什么单独成文件：`schema/components.json` 里只有**元数据与示例代码字符串**（纯数据，
 * 不含任何 vue 依赖，因此可以同时给文档站和 AI agent 用）。真正能跑的 Vue 组件必须写在这里，
 * 因为库目录里没有 node_modules，库自身不能承载「演示代码」。
 *
 * 键的约定：`<组件名>::<该组件第几个 demo>`，与 components.json 里 demos 数组的下标对应。
 */
import { defineComponent, h, ref, computed } from 'vue'
import {
  Icon,
  IconTile,
  SearchBox,
  EmptyState,
  StatusTag,
  UrgencyTag,
  KpiImg,
  Modal,
  OverflowTooltip,
  Pagination,
  PermissionTree,
  type TreeNode,
} from '@yd/ui'

/** 布局小工具：把一行演示项横向摆开 */
const Row = (children: unknown[]) =>
  defineComponent({
    render: () => h('div', { style: 'display:flex;align-items:center;gap:14px;flex-wrap:wrap' }, children as never),
  })

/** 示例数据：一棵覆盖两种授权态的权限树 */
const TREE_NODES: TreeNode[] = [
  {
    id: 'sys-1',
    name: '权限自助门户',
    type: '系统',
    owned: true,
    children: [
      {
        id: 'mod-1',
        name: '权限申请',
        type: '模块',
        owned: true,
        children: [
          { id: 'p-1', name: '发起个人申请', type: '功能', owned: true },
          { id: 'p-2', name: '代他人发起', type: '功能', owned: false },
          { id: 'p-3', name: '申请草稿箱', type: '功能', owned: true },
        ],
      },
      {
        id: 'mod-2',
        name: '审批中心',
        type: '模块',
        owned: false,
        children: [
          { id: 'p-4', name: '待我审批', type: '功能', owned: false },
          { id: 'p-5', name: '抄送我的', type: '功能', owned: true },
        ],
      },
    ],
  },
  {
    id: 'sys-2',
    name: '运营后台',
    type: '系统',
    owned: false,
    children: [{ id: 'p-6', name: '查看报表', type: '功能', owned: false }],
  },
]

/* ---------- 需要内部状态的演示 ---------- */

const ModalDemo = (size?: 'sm' | 'lg' | 'xl') =>
  defineComponent({
    setup() {
      const open = ref(false)
      return () =>
        h('div', {}, [
          h(
            'button',
            { class: 'btn btn-primary', type: 'button', onClick: () => (open.value = true) },
            `打开对话框${size ? `（${size}）` : ''}`,
          ),
          open.value
            ? h(
                Modal,
                { title: '权限明细', size, onClose: () => (open.value = false) },
                {
                  default: () =>
                    h('div', {}, [
                      h('p', { style: 'margin-bottom:10px' }, '该角色同时持有 3 项敏感类型的查看权限：'),
                      h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, [
                        h('span', { class: 'tag tag-urgent' }, '联系方式'),
                        h('span', { class: 'tag tag-high' }, '地址信息'),
                        h('span', { class: 'tag tag-normal' }, '业务指标'),
                      ]),
                    ]),
                  footer: () =>
                    h('div', { style: 'display:flex;gap:8px;justify-content:flex-end' }, [
                      h(
                        'button',
                        { class: 'btn btn-secondary', type: 'button', onClick: () => (open.value = false) },
                        '取消',
                      ),
                      h(
                        'button',
                        { class: 'btn btn-primary', type: 'button', onClick: () => (open.value = false) },
                        '确认',
                      ),
                    ]),
                },
              )
            : null,
        ])
    },
  })

const PaginationDemo = defineComponent({
  setup() {
    const page = ref(3)
    const pageSize = ref(10)
    const total = 86
    return () =>
      h(
        'div',
        { style: 'width:100%' },
        [
          h(Pagination, {
            page: page.value,
            pageSize: pageSize.value,
            total,
            'onUpdate:page': (v: number) => (page.value = v),
            'onUpdate:pageSize': (v: number) => (pageSize.value = v),
          }),
          h(
            'div',
            { style: 'margin-top:12px;font-family:var(--font-mono);font-size:12px;color:var(--text-muted)' },
            `page=${page.value} · pageSize=${pageSize.value} · total=${total}`,
          ),
        ],
      )
  },
})

const TreeDemo = defineComponent({
  setup() {
    return () => h(PermissionTree, { nodes: TREE_NODES })
  },
})

const EmptyStateWithDesc = defineComponent({
  render: () => h(EmptyState, { title: '没有待审批的申请', desc: '所有申请都已处理完毕。' }),
})

/* ---------- 汇总表 ---------- */
export const RENDERERS: Record<string, unknown> = {
  'Icon::0': Row([h(Icon, { name: 'shield', className: 'icon-18' }), h(Icon, { name: 'key', className: 'icon-18' }), h(Icon, { name: 'users', className: 'icon-18' })]),

  'IconTile::0': Row([
    h(IconTile, { name: 'shield', tone: 'blue' }),
    h(IconTile, { name: 'key', tone: 'cyan' }),
    h(IconTile, { name: 'users', tone: 'purple' }),
    h(IconTile, { name: 'send', tone: 'orange' }),
    h(IconTile, { name: 'check', tone: 'green' }),
    h(IconTile, { name: 'file', tone: 'rose' }),
  ]),
  'IconTile::1': Row([
    h(IconTile, { name: 'shield', size: 'sm' }),
    h(IconTile, { name: 'shield' }),
    h(IconTile, { name: 'shield', size: 'lg' }),
  ]),

  'SearchBox::0': Row([
    h('div', { style: 'width:220px' }, [h(SearchBox)]),
    h('div', { style: 'width:260px' }, [h(SearchBox, { placeholder: '搜索角色或应用' })]),
  ]),

  'EmptyState::0': defineComponent({ render: () => h(EmptyState) }),
  'EmptyState::1': EmptyStateWithDesc,

  'StatusTag::0': Row(
    ['待审批', '审批中', '已通过', '已驳回', '已撤回'].map((s) => h(StatusTag, { status: s })),
  ),
  'StatusTag::1': Row(
    ['有效', '即将到期', '已过期', '未登记的词'].map((s) => h(StatusTag, { status: s })),
  ),

  'UrgencyTag::0': Row(
    ['非常紧急', '紧急', '普通'].map((s) => h(UrgencyTag, { level: s })),
  ),

  'KpiImg::0': Row(
    (['pending', 'processed', 'submitted', 'cc'] as const).map((k) => h(KpiImg, { kpiKey: k })),
  ),

  'Modal::0': ModalDemo(),
  'Modal::1': ModalDemo('lg'),

  'OverflowTooltip::0': Row([
    h('div', { style: 'width:170px' }, [
      h(OverflowTooltip, { text: '数据中心 · 全量记录查看与导出' }),
    ]),
    h('div', { style: 'width:300px' }, [
      h(OverflowTooltip, { text: '数据中心 · 全量记录查看与导出' }),
    ]),
  ]),

  'Pagination::0': PaginationDemo,

  'PermissionTree::0': TreeDemo,
  'PermissionTreeRows::0': TreeDemo,
}

/** 有没有这个演示的可跑实现 */
export function hasRenderer(name: string, index: number) {
  return Boolean(RENDERERS[`${name}::${index}`])
}

/** 组件名 → 渲染器（用于检索） */
export const RENDERER_NAMES = computed(() => Object.keys(RENDERERS))
