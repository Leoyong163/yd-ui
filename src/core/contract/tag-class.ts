/**
 * 标签状态映射 —— 控件语义，属库。
 *
 * 从宿主 `src/shared.ts` 拆出（P1-T3）。判据：它描述的是「标签控件的状态词 → 样式类」
 * 这一层控件语义，与具体业务无关；`StatusTag` / `UrgencyTag` 两个组件直接依赖它。
 *
 * 真源唯一性：`docs/P0裁决结论.md` §4 确认，这 14 个类名此前没有生产者也没有唯一出处，
 * 现在这里是它们唯一的取值空间定义。
 */

/** 审批/权限状态 → 标签样式类。未命中时回落 `tag-info`。 */
export const STATUS_TAG_CLASS: Record<string, string> = {
  待处理: 'tag-pending',
  待审批: 'tag-pending',
  审批中: 'tag-processing',
  抄送我: 'tag-cc',
  已通过: 'tag-approved',
  已驳回: 'tag-rejected',
  已撤回: 'tag-withdrawn',
  已终止: 'tag-terminated',
  延期审批中: 'tag-extending',
  有效: 'tag-active',
  即将到期: 'tag-expiring',
  已过期: 'tag-expired',
  正常: 'tag-active',
}

/** 兜底类，`tag-*` 家族的无生产者成员（`tag-danger` / `tag-success`）不在此暴露。 */
export const TAG_FALLBACK_CLASS = 'tag-info'

export function statusTagClass(status: string): string {
  return STATUS_TAG_CLASS[status] || TAG_FALLBACK_CLASS
}

/** 紧急程度 → 标签样式类。 */
export const URGENCY_TAG_CLASS: Record<string, string> = {
  非常紧急: 'tag-urgent',
  紧急: 'tag-high',
  普通: 'tag-normal',
}

export function urgencyTagClass(urgency: string): string {
  return URGENCY_TAG_CLASS[urgency] || 'tag-normal'
}
