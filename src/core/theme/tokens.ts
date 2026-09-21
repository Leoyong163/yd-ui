/**
 * 设计令牌的唯一真源。
 *
 * 两个消费方：
 *  1. CSS —— 由 `node --experimental-strip-types scripts/gen-tokens.mjs` 生成为
 *     `src/styles/demo1/variables.css`。**该 CSS 文件是产物，不要手改。**
 *  2. JS（antd）—— `App.vue` 的 ConfigProvider theme 从这里取值。
 *
 * 为什么必须有一份 JS 形态的值：antd 会用色值算法从 `colorPrimary` 一类种子令牌
 * 派生出 hover / active / 边框整套色阶，传 `var(--primary)` 会让派生直接失效。
 * 所以凡是被 antd 派生的令牌，这里给的必须是真实色值；只有纯展示用途的可以留 `var()`。
 *
 * 值一律以「CSS 值字符串」形式书写（`'8px'`、`'1.25'`、`'400'`），
 * 这样生成器只做 `--key: value;` 的机械拼装，不引入任何单位推断逻辑——
 * 代价是 antd 需要数字时要用 `num()` 转一下。
 */

export type Tokens = Record<string, string>

/** :root —— 亮色主题 */
export const lightTokens: Tokens = {
  /* Brand */
  primary: '#1678ff',
  'primary-hover': '#0f66e0',
  'primary-active': '#0a52c0',
  'primary-soft': 'rgba(22, 120, 255, 0.09)',
  'primary-soft-2': 'rgba(22, 120, 255, 0.15)',
  'primary-border': 'rgba(22, 120, 255, 0.32)',
  'primary-glow': 'rgba(22, 120, 255, 0.22)',
  cyan: '#00B42A',
  'cyan-soft': 'rgba(0, 180, 42, 0.12)',
  purple: '#722ED1',
  'purple-soft': 'rgba(114, 46, 209, 0.12)',

  /* Auxiliary Colors */
  'color-blue': '#3370FF',
  'color-indigo': '#304FFE',
  'color-magenta': '#EB2F96',
  'color-pink': '#F5319D',
  'color-yellow': '#FADC19',
  'color-lime': '#52C41A',
  'color-orange': '#FF7D00',
  'color-red': '#F53F3F',

  /* Semantic */
  success: '#32A645',
  'success-soft': 'rgba(50, 166, 69, 0.12)',
  warning: '#ED6D0C',
  'warning-soft': 'rgba(237, 109, 12, 0.12)',
  danger: '#F54A45',
  'danger-soft': 'rgba(245, 74, 69, 0.12)',
  info: '#1456F0',
  'info-soft': 'rgba(20, 86, 240, 0.12)',

  /* Surfaces & Backgrounds */
  'bg-1': '#EFF0F1',
  'bg-2': '#F5F6F7',
  'bg-3': '#F8F9FA',
  bg: 'var(--bg-2)',
  'bg-elevated': '#ffffff',
  'bg-muted': 'var(--bg-1)',
  'bg-hover': 'rgba(31, 35, 41, 0.05)',
  'bg-active': 'rgba(31, 35, 41, 0.10)',
  surface: '#ffffff',
  'surface-2': 'var(--bg-3)',
  'surface-3': 'var(--bg-2)',
  glass: 'rgba(255, 255, 255, 0.85)',
  'glass-border': 'rgba(255, 255, 255, 0.65)',

  /* Text */
  text: '#1F2329',
  'text-secondary': '#646A73',
  'text-muted': '#8F959E',
  'text-disabled': '#BBBFC4',
  'text-inverse': '#ffffff',

  /* Icons */
  'icon-1': '#2B2F36',
  'icon-2': '#646A73',
  'icon-3': '#8F959E',

  /* Borders */
  border: '#DEE0E3',
  'border-strong': '#D0D3D6',
  divider: '#DEE0E3',

  /* Elevation */
  'shadow-xs': '0 1px 2px rgba(31, 35, 41, 0.04)',
  'shadow-sm': '0 1px 2px rgba(31, 35, 41, 0.03), 0 1px 4px rgba(31, 35, 41, 0.04)',
  shadow: '0 2px 8px rgba(31, 35, 41, 0.06), 0 1px 2px rgba(31, 35, 41, 0.03)',
  'shadow-md': '0 6px 16px rgba(31, 35, 41, 0.06), 0 2px 4px rgba(31, 35, 41, 0.02)',
  'shadow-lg': '0 12px 28px rgba(31, 35, 41, 0.08), 0 4px 8px rgba(31, 35, 41, 0.03)',
  'shadow-primary': '0 4px 14px rgba(22, 120, 255, 0.28)',
  'focus-ring': '0 0 0 3px rgba(22, 120, 255, 0.28)',

  /* Spacing scale (4px base) */
  'space-2xs': '2px',
  'space-xs': '4px',
  'space-sm': '8px',
  'space-md': '12px',
  'space-lg': '16px',
  'space-xl': '24px',
  'space-2xl': '32px',
  'space-3xl': '48px',

  /* Type scale */
  'fs-mini': '10px',
  'fs-kicker': '12px',
  'fs-label': '13px',
  'fs-body': '14px',
  'fs-title-3': '16px',
  'fs-title-2': '18px',
  'fs-title-1': '20px',
  'fs-page': '24px',
  'fs-kpi': '30px',
  'lh-mini': '16px',
  'lh-kicker': '20px',
  'lh-label': '20px',
  'lh-body': '22px',
  'lh-title-3': '24px',
  'lh-title-2': '28px',
  'lh-title-1': '30px',
  'lh-page': '36px',
  'lh-kpi': '46px',
  'text-xs': 'var(--fs-kicker)',
  'text-sm': 'var(--fs-label)',
  'text-base': 'var(--fs-body)',
  'text-md': 'var(--fs-title-3)',
  'text-lg': 'var(--fs-title-3)',
  'text-xl': 'var(--fs-title-2)',
  'text-2xl': 'var(--fs-page)',
  'text-3xl': 'var(--fs-kpi)',
  'leading-tight': '1.25',
  'leading-snug': '1.4',
  'leading-normal': '1.55',
  'leading-body': 'calc(var(--lh-body) / 14)',
  'weight-body': '400',
  'weight-medium': '500',
  'weight-label': '500',
  'weight-semibold': '600',
  'weight-kpi': '600',
  'tracking-tight': '0',

  /* Layout */
  'sidebar-w': '240px',
  'sidebar-collapsed-w': '72px',
  'radius-sm': '6px',
  radius: '8px',
  'radius-lg': '12px',
  'radius-xl': '16px',
  'control-h': '36px',
  'control-h-sm': '30px',

  /* Fonts */
  'font-ui':
    '"Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  'font-mono': '"SF Mono", Menlo, Consolas, monospace',
  font: 'var(--font-ui)',
  'font-display': 'var(--font-ui)',

  /* Motion */
  'ease-out': 'cubic-bezier(0.22, 1, 0.36, 1)',
  'ease-spring': 'cubic-bezier(0.34, 1.3, 0.64, 1)',
  transition: '0.18s var(--ease-out)',
  'transition-fast': '0.12s var(--ease-out)',
  'transition-slow': '0.28s var(--ease-out)',

  /* Z-index */
  'z-sidebar': '100',
  'z-overlay': '200',
  'z-dropdown': '300',
  'z-modal': '400',
  'z-toast': '500',
}

/**
 * [data-theme="dark"] —— 只写与亮色不同的项。
 *
 * 注意：这里是「覆盖集」，不是全集。生成器只输出这些键。
 * 新增暗色令牌时必须同时想清楚它在哪些组件配方里被用到。
 */
export const darkTokens: Tokens = {
  primary: '#4d94ff',
  'primary-hover': '#6aa6ff',
  'primary-active': '#1678ff',
  'primary-soft': 'rgba(77, 148, 255, 0.14)',
  'primary-soft-2': 'rgba(77, 148, 255, 0.22)',
  'primary-border': 'rgba(77, 148, 255, 0.4)',
  'primary-glow': 'rgba(77, 148, 255, 0.28)',
  cyan: '#2dd4bf',
  'cyan-soft': 'rgba(45, 212, 191, 0.14)',
  purple: '#a78bfa',
  'purple-soft': 'rgba(167, 139, 250, 0.14)',

  success: '#34d399',
  'success-soft': 'rgba(52, 211, 153, 0.14)',
  warning: '#fbbf24',
  'warning-soft': 'rgba(251, 191, 36, 0.14)',
  danger: '#f87171',
  'danger-soft': 'rgba(248, 113, 113, 0.14)',
  /* 之前漏掉的一项：亮色 #1456F0 在暗底上只有 3.00:1。
     目前 `var(--info)` 在 CSS 里尚无引用点，但 antd 的 colorInfo 会吃它。 */
  info: '#5b9bff',
  'info-soft': 'rgba(91, 155, 255, 0.14)',

  bg: '#0a101c',
  'bg-elevated': '#121a2b',
  'bg-muted': '#172033',
  'bg-hover': 'rgba(255, 255, 255, 0.05)',
  'bg-active': 'rgba(77, 148, 255, 0.14)',
  surface: '#121a2b',
  'surface-2': '#0e1624',
  'surface-3': '#182234',
  glass: 'rgba(18, 26, 43, 0.86)',
  'glass-border': 'rgba(255, 255, 255, 0.08)',

  text: '#eef3fb',
  'text-secondary': '#a8b6cc',
  'text-muted': '#7d8ca3',
  'text-inverse': '#0a101c',
  border: '#243247',
  'border-strong': '#354860',
  divider: '#1e2a3d',

  'icon-1': '#eef3fb',
  'icon-2': '#a8b6cc',
  'icon-3': '#7d8ca3',

  'shadow-xs': '0 1px 2px rgba(0, 0, 0, 0.35)',
  'shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.4)',
  shadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
  'shadow-md': '0 8px 28px rgba(0, 0, 0, 0.45)',
  'shadow-lg': '0 16px 48px rgba(0, 0, 0, 0.5)',
  'shadow-primary': '0 4px 18px rgba(22, 120, 255, 0.35)',
  'focus-ring': '0 0 0 3px rgba(77, 148, 255, 0.35)',
}

/** 把 `var(--x)` 别名展开成真实值（antd 的色值派生需要真值，不能吃 var()）。 */
function resolveAliases(tokens: Tokens, seen: string[] = []): Tokens {
  const out: Tokens = {}
  for (const [key, value] of Object.entries(tokens)) {
    const m = /^var\(--([\w-]+)\)$/.exec(value.trim())
    if (m && !seen.includes(m[1])) {
      const target = tokens[m[1]]
      out[key] = target === undefined ? value : resolveAliases({ [m[1]]: target }, [...seen, m[1]])[m[1]]
    } else {
      out[key] = value
    }
  }
  return out
}

/** 亮色全集，别名已展开 */
export const light: Tokens = resolveAliases(lightTokens)

/** 暗色全集（亮色 + 暗色覆盖），别名已展开 */
export const dark: Tokens = resolveAliases({ ...lightTokens, ...darkTokens })

/** `'8px'` → `8`。antd 的 borderRadius / controlHeight / fontSize 要数字。 */
export function num(value: string | undefined, fallback = 0): number {
  if (value === undefined) return fallback
  const n = Number.parseFloat(value)
  return Number.isNaN(n) ? fallback : n
}
