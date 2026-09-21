/**
 * Modern Duotone Icons — 从 demo1/js/utils/icons.js 原样搬过来的 SVG 字符串。
 * Premium quality SVG icons with layered fills and currentColor strokes.
 */

const stroke = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const toneFill = 'fill="currentColor" fill-opacity="0.18" stroke="none"';

export const icons: Record<string, string> = {
  home: `<svg viewBox="0 0 24 24" ${stroke}><path ${toneFill} d="M3 10l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10z"/><path d="M3 10l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10z"/><path d="M9 22V12h6v10"/></svg>`,
  apply: `<svg viewBox="0 0 24 24" ${stroke}><path ${toneFill} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 2v6h6"/><path d="M12 12v6"/><path d="M9 15h6"/></svg>`,
  approval: `<svg viewBox="0 0 24 24" ${stroke}><path ${toneFill} d="M4 4h16v16H4z" rx="2" ry="2"/><rect width="16" height="16" x="4" y="4" rx="2" ry="2"/><path d="M9 12l2 2 4-4"/></svg>`,
  expiry: `<svg viewBox="0 0 24 24" ${stroke}><path ${toneFill} d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  permissions: `<svg viewBox="0 0 24 24" ${stroke}><path ${toneFill} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>`,
  brand: `<svg viewBox="0 0 24 24" ${stroke}><path ${toneFill} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" ${stroke}><path ${toneFill} d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" ${stroke}><circle cx="12" cy="12" r="5" ${toneFill}/><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" ${stroke}><path ${toneFill} d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  panelLeft: `<svg viewBox="0 0 24 24" ${stroke}><path ${toneFill} d="M3 3h6v18H3z"/><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M9 3v18"/></svg>`,
  file: `<svg viewBox="0 0 24 24" ${stroke}><path ${toneFill} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 2v6h6"/></svg>`,
  users: `<svg viewBox="0 0 24 24" ${stroke}><path ${toneFill} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  send: `<svg viewBox="0 0 24 24" ${stroke}><path ${toneFill} d="M22 2l-7 20-4-9-9-4 20-7z"/><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>`,
  key: `<svg viewBox="0 0 24 24" ${stroke}><circle cx="7.5" cy="15.5" r="4.5" ${toneFill}/><path d="M10.5 12.5L21 2v4l-2 2 1 1-1 1 1 1-2 2-3-3"/><circle cx="7.5" cy="15.5" r="4.5"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" ${stroke}><path ${toneFill} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" ${stroke}><circle cx="12" cy="12" r="10" ${toneFill}/><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  check: `<svg viewBox="0 0 24 24" ${stroke}><path d="M20 6L9 17l-5-5"/></svg>`,
  chevronRight: `<svg viewBox="0 0 24 24" ${stroke}><path d="M9 18l6-6-6-6"/></svg>`,
  spark: `<svg viewBox="0 0 24 24" ${stroke}><path ${toneFill} d="M12 3l2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8L12 3z"/><path d="M12 3l2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8L12 3z"/></svg>`,

  // 侧栏用（18x18 viewBox，跟 demo1/index.html 的侧栏图标保持一致）
  navHome: `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M2.25 7.5L9 2.25L15.75 7.5V15a.75.75 0 01-.75.75H11.25V10.5H6.75V15.75H3a.75.75 0 01-.75-.75V7.5z"/></svg>`,
  navApply: `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M2.25 8.25L15.75 2.25L10.125 15.75L7.875 10.5L2.25 8.25z"/><path d="M7.875 10.5L10.875 7.5" stroke-linecap="round"/></svg>`,
  navApproval: `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12.75 3H5.25A1.5 1.5 0 003.75 4.5v9.75A1.5 1.5 0 005.25 15.75h7.5a1.5 1.5 0 001.5-1.5V4.5A1.5 1.5 0 0012.75 3z"/><path d="M6.75 8.25h4.5M6.75 11.25h4.5M6.75 2.25h4.5V5.25h-4.5V2.25z" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  navExpiring: `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="9" r="6.75"/><path d="M9 5.25V9l2.625 1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  navPermissions: `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M9 2.1L14.25 4.125V7.95C14.25 11.325 12.15 13.8 9 15.15 5.85 13.8 3.75 11.325 3.75 7.95V4.125L9 2.1z"/><path d="M6.75 8.625l1.5 1.5 3-3" stroke-linecap="round"/></svg>`,
  chevronDown: `<svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`,
  hamburger: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round"/></svg>`,
  collapse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  sunOutline: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><circle cx="12" cy="12" r="3.75"/><path d="M12 2.75v2M12 19.25v2M3.9 3.9l1.4 1.4M18.7 18.7l1.4 1.4M2.75 12h2M19.25 12h2M3.9 20.1l1.4-1.4M18.7 5.3l1.4-1.4"/></svg>`,
  moonOutline: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M20.5 14.2A8.2 8.2 0 0110.3 4 6.8 6.8 0 1020.5 14.2z"/></svg>`,
  bellOutline: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M15 7.5a5 5 0 00-10 0c0 5.833-2.5 5.833-2.5 5.833h15S15 13.333 15 7.5z"/><path d="M8.333 16.667h3.334" stroke-linecap="round"/></svg>`,
};

// flat aliases
icons.plus = icons.apply;
icons.checkSquare = icons.approval;
icons.homeFill = icons.home;
icons.clockFill = icons.clock;
icons.checkFill = icons.check;
icons.sendFill = icons.send;
icons.usersFill = icons.users;
icons.shieldFill = icons.shield;
icons.fileFill = icons.file;
icons.keyFill = icons.key;
icons.sparkFill = icons.spark;

export const shortcutPalette = ['file', 'shield', 'users', 'key', 'send', 'clock', 'check', 'spark'];
export const tones = ['blue', 'cyan', 'purple', 'orange', 'green', 'rose'];

export function shortcutIcon(index = 0) {
  return icons[shortcutPalette[index % shortcutPalette.length]];
}
