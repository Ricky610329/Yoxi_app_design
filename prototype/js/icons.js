/* ==========================================================================
   yoxi 城事 — Icons
   海軍藍 + 紅的雙色扁平風格，與 yoxi 既有圖示磚同一套語言。
   不得引入線性圖示或 Material icon。

   用法：<span data-icon="bell"></span>  →  由 shell.js 自動填入 SVG
   ========================================================================== */

const NAVY = '#062040';
const RED  = '#FF2E1A';

const svg = (body, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;

const ICONS = {

  /* --- yoxi 既有 ----------------------------------------------------- */

  // 漢堡選單：白色橫條，每條左側一小截紅色
  menu: svg(`
    <rect x="3"  y="5"  width="18" height="2.6" rx="1.3" fill="#fff"/>
    <rect x="3"  y="5"  width="5"  height="2.6" rx="1.3" fill="${RED}"/>
    <rect x="3"  y="10.7" width="18" height="2.6" rx="1.3" fill="#fff"/>
    <rect x="3"  y="10.7" width="5" height="2.6" rx="1.3" fill="${RED}"/>
    <rect x="3"  y="16.4" width="18" height="2.6" rx="1.3" fill="#fff"/>
    <rect x="3"  y="16.4" width="5" height="2.6" rx="1.3" fill="${RED}"/>`),

  // 掃碼
  scan: svg(`
    <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"
      fill="none" stroke="${NAVY}" stroke-width="2.2" stroke-linecap="round"/>
    <rect x="5" y="11" width="14" height="2.4" rx="1.2" fill="${RED}"/>`),

  // 鈴鐺
  bell: svg(`
    <path d="M12 3a6 6 0 0 0-6 6c0 3.5-.7 5.2-1.6 6.2-.5.6-.1 1.6.7 1.6h13.8c.8 0 1.2-1 .7-1.6C18.7 14.2 18 12.5 18 9a6 6 0 0 0-6-6Z" fill="${NAVY}"/>
    <path d="M9.4 19a2.7 2.7 0 0 0 5.2 0Z" fill="${RED}"/>`),

  // 定位
  locate: svg(`
    <circle cx="12" cy="12" r="7.4" fill="none" stroke="${NAVY}" stroke-width="2.2"/>
    <circle cx="12" cy="12" r="3" fill="${RED}"/>
    <path d="M12 1.6v3.2M12 19.2v3.2M1.6 12h3.2M19.2 12h3.2"
      stroke="${NAVY}" stroke-width="2.2" stroke-linecap="round"/>`),

  close: svg(`
    <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>`),

  // 招手的人（地圖 pin 內）
  hail: svg(`
    <circle cx="10.2" cy="5" r="2.4" fill="#fff"/>
    <path d="M9 8.6h2.6l2 4.2 3.4-4.6 1.7 1.3-4.4 6.1v6.2h-2.2v-5.3H11v5.3H8.8V13l-2.6 2.1-1.4-1.7 3.4-2.9Z" fill="#fff"/>`),

  plane: svg(`
    <path d="M21 14.2 13.6 12V5.6a1.6 1.6 0 1 0-3.2 0V12L3 14.2v2l7.4-1.6v4l-2.2 1.3v1.5L12 20.4l3.8 1v-1.5l-2.2-1.3v-4L21 16.2Z" fill="currentColor"/>`),

  camera: svg(`
    <path d="M4 7h3.2l1.3-2h7l1.3 2H20a1.6 1.6 0 0 1 1.6 1.6v9.8A1.6 1.6 0 0 1 20 20H4a1.6 1.6 0 0 1-1.6-1.6V8.6A1.6 1.6 0 0 1 4 7Z" fill="${NAVY}"/>
    <circle cx="12" cy="13.2" r="3.6" fill="${RED}"/>`),

  point: svg(`
    <circle cx="12" cy="12" r="9.4" fill="${NAVY}"/>
    <path d="M9.6 17.4V6.6h3.6a3.5 3.5 0 0 1 0 7h-1.5v3.8Zm2.1-6h1.4a1.4 1.4 0 0 0 0-2.8h-1.4Z" fill="#fff"/>`),

  /* --- 底部 tab ------------------------------------------------------- */

  // 叫車
  tabRide: svg(`
    <path d="M4.6 12.6 6.3 7.4A2.4 2.4 0 0 1 8.6 5.8h6.8a2.4 2.4 0 0 1 2.3 1.6l1.7 5.2Z" fill="currentColor"/>
    <rect x="3.2" y="12.2" width="17.6" height="6.4" rx="1.8" fill="currentColor"/>
    <rect x="5.4" y="18.6" width="3.6" height="2.4" rx="1" fill="currentColor"/>
    <rect x="15" y="18.6" width="3.6" height="2.4" rx="1" fill="currentColor"/>
    <rect x="9.4" y="2.6" width="5.2" height="2.8" rx="1" fill="${RED}"/>`),

  // 探索
  tabExplore: svg(`
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/>
    <path d="M15.8 8.2 13.9 14 8.2 15.8 10.1 10Z" fill="${RED}"/>`),

  // 收藏（明信片）
  tabAlbum: svg(`
    <rect x="2.6" y="5.4" width="18.8" height="13.2" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/>
    <path d="M2.6 15.4 8 10.6l4 3.4 3.4-2.8 6 5.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="8.2" cy="9.6" r="1.8" fill="${RED}"/>`),

  /* --- 城事 ----------------------------------------------------------- */

  // 明信片
  postcard: svg(`
    <rect x="2.4" y="5" width="19.2" height="14" rx="2" fill="${NAVY}"/>
    <rect x="4.8" y="7.4" width="8" height="9.2" rx="1" fill="${RED}"/>
    <path d="M14.4 9.4h4.8M14.4 12h4.8M14.4 14.6h3" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>`),

  // 獎章
  badge: svg(`
    <circle cx="12" cy="9.6" r="6.6" fill="${NAVY}"/>
    <circle cx="12" cy="9.6" r="3.4" fill="${RED}"/>
    <path d="M8 15.4 6.4 22l5.6-2.8L17.6 22 16 15.4Z" fill="${NAVY}"/>`),

  // 足跡
  steps: svg(`
    <ellipse cx="8" cy="7.6" rx="3.1" ry="4.4" transform="rotate(-14 8 7.6)" fill="${NAVY}"/>
    <ellipse cx="16" cy="15.4" rx="3.1" ry="4.4" transform="rotate(14 16 15.4)" fill="${RED}"/>`),

  // 地點釘
  place: svg(`
    <path d="M12 2.4c-3.9 0-7 3.1-7 7 0 5.1 7 12.2 7 12.2s7-7.1 7-12.2c0-3.9-3.1-7-7-7Z" fill="${NAVY}"/>
    <circle cx="12" cy="9.4" r="2.9" fill="#fff"/>`),

  // 路線
  route: svg(`
    <circle cx="5.6" cy="6" r="3" fill="${NAVY}"/>
    <circle cx="18.4" cy="18" r="3" fill="${RED}"/>
    <path d="M5.6 9.4v4a3.6 3.6 0 0 0 3.6 3.6h5.8" fill="none" stroke="${NAVY}"
      stroke-width="2.2" stroke-linecap="round" stroke-dasharray="1 4"/>`),

  // 長輩圖
  elder: svg(`
    <rect x="2.6" y="4.4" width="18.8" height="15.2" rx="2.2" fill="${NAVY}"/>
    <circle cx="8" cy="9.6" r="2.2" fill="#FFD24A"/>
    <path d="M2.6 17.2 8.4 12l3.6 3 3.2-2.4 6.2 4.6v2.4H2.6Z" fill="${RED}"/>`),

  // 鎖頭（隱私）
  lock: svg(`
    <rect x="5" y="10.4" width="14" height="10" rx="2" fill="currentColor"/>
    <path d="M8.2 10.4V8a3.8 3.8 0 0 1 7.6 0v2.4" fill="none" stroke="currentColor" stroke-width="2.2"/>`),

  // 分享
  share: svg(`
    <circle cx="18" cy="5.8" r="2.8" fill="${RED}"/>
    <circle cx="6" cy="12" r="2.8" fill="${NAVY}"/>
    <circle cx="18" cy="18.2" r="2.8" fill="${NAVY}"/>
    <path d="M8.5 10.7 15.5 7.1M8.5 13.3l7 3.6" stroke="${NAVY}" stroke-width="1.8"/>`),

  // 天氣
  sun: svg(`
    <circle cx="12" cy="12" r="4.6" fill="${RED}"/>
    <path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.4 5.4l1.9 1.9M16.7 16.7l1.9 1.9M18.6 5.4l-1.9 1.9M7.3 16.7l-1.9 1.9"
      stroke="${NAVY}" stroke-width="2" stroke-linecap="round"/>`),

  /* --- 心情三選一 ------------------------------------------------------ */

  moodGood: svg(`
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
    <circle cx="8.6" cy="9.8" r="1.5" fill="currentColor"/>
    <circle cx="15.4" cy="9.8" r="1.5" fill="currentColor"/>
    <path d="M7.4 14.4a5.4 5.4 0 0 0 9.2 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),

  moodOk: svg(`
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
    <circle cx="8.6" cy="9.8" r="1.5" fill="currentColor"/>
    <circle cx="15.4" cy="9.8" r="1.5" fill="currentColor"/>
    <path d="M8.2 15.2h7.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),

  moodLow: svg(`
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
    <circle cx="8.6" cy="9.8" r="1.5" fill="currentColor"/>
    <circle cx="15.4" cy="9.8" r="1.5" fill="currentColor"/>
    <path d="M7.4 16.2a5.4 5.4 0 0 1 9.2 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),

  /* --- 狀態列 ---------------------------------------------------------- */

  signal: svg(`
    <rect x="0.6" y="7.6" width="2.6" height="3.4" rx=".8" fill="currentColor"/>
    <rect x="4.4" y="5.6" width="2.6" height="5.4" rx=".8" fill="currentColor"/>
    <rect x="8.2" y="3.4" width="2.6" height="7.6" rx=".8" fill="currentColor"/>
    <rect x="12" y="1.2" width="2.6" height="9.8" rx=".8" fill="currentColor"/>`, '0 0 16 12'),

  wifi: svg(`
    <path d="M8 10.6 6.1 8.4a2.9 2.9 0 0 1 3.8 0Z" fill="currentColor"/>
    <path d="M3.5 6.1a6.6 6.6 0 0 1 9 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    <path d="M1.2 3.5a9.9 9.9 0 0 1 13.6 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`, '0 0 16 12'),

  arrowLoc: svg(`
    <path d="M11.4 1 1 5.6l4.3 1.5L7 11.4Z" fill="currentColor"/>`, '0 0 12 12'),
};

window.ICONS = ICONS;
