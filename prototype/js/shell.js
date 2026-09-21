/* ==========================================================================
   yoxi 城事 — Shell
   手機外框、狀態列、tab bar、圖示注入、頁面切換、明信片視覺生成。

   每個畫面只要在 <body> 上標註 data-* ，其餘由這裡接管：
     data-tab    ride | explore | album   （不寫＝不顯示 tab bar）
     data-status dark | light             （狀態列顏色，預設 dark）
     data-time   21:35                    （狀態列時間，預設 21:35）
   ========================================================================== */

(function () {
'use strict';

/* 傳統 script，不用 ES module —— file:// 底下 module 會被 CORS 擋掉，
   評審直接雙擊開啟 HTML 就會整頁空白。icons.js 與 mock.js 需先載入。 */
const ARTS = window.MOCK.ART;

/* --------------------------------------------------------------------------
   圖示注入
   -------------------------------------------------------------------------- */

function injectIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    const svg = ICONS[el.dataset.icon];
    if (svg) el.innerHTML = svg;
  });
}

/* --------------------------------------------------------------------------
   狀態列
   截圖實測：21:35、訊號、Wi-Fi、電量 93
   -------------------------------------------------------------------------- */

function statusbar(tone, time) {
  return `
    <div class="statusbar ${tone === 'light' ? 'statusbar--light' : ''}">
      <div class="statusbar__time">
        <span>${time}</span>
        <span data-icon="arrowLoc" style="width:11px;height:11px"></span>
      </div>
      <div class="statusbar__right">
        <span data-icon="signal" style="width:17px;height:12px"></span>
        <span data-icon="wifi" style="width:16px;height:12px"></span>
        <span class="statusbar__battery"><span>93</span></span>
      </div>
    </div>`;
}

/* --------------------------------------------------------------------------
   底部 tab bar
   叫車（現在）／探索（未來）／收藏（過去）

   提示用單一小圓點，刻意不顯示數字 —— 數字＝未讀壓力＝任務感。
   -------------------------------------------------------------------------- */

const TABS = [
  { id: 'ride',    label: '叫車', icon: 'tabRide',    href: 'home.html' },
  { id: 'explore', label: '探索', icon: 'tabExplore', href: 'explore.html', dot: true },
  { id: 'album',   label: '收藏', icon: 'tabAlbum',   href: 'album.html' },
];

function tabbar(active) {
  return `
    <nav class="tabbar" id="tabbar">
      ${TABS.map(t => `
        <a class="tabbar__item ${t.id === active ? 'is-active' : ''}" href="${t.href}">
          <span class="tabbar__icon">
            <span data-icon="${t.icon}" style="display:block;width:26px;height:26px"></span>
            ${t.dot && t.id !== active ? '<i class="tabbar__dot"></i>' : ''}
          </span>
          <span>${t.label}</span>
        </a>`).join('')}
    </nav>`;
}

/* --------------------------------------------------------------------------
   明信片視覺生成器

   所有明信片由同一組風格參數產生：三段色帶的天空 + 光源 + 地平線 + 主體剪影。
   這是為了模擬 AI 的「風格鎖定」—— 每張內容不同，但看得出是同一個系列。

   原型階段的替代方案，見 plan §8 風險 3：決賽現場不賭即時 API。
   -------------------------------------------------------------------------- */

const MOTIFS = {
  chimney:    `<rect x="26" y="34" width="9" height="46" fill="currentColor"/>
               <rect x="24" y="30" width="13" height="6" rx="2" fill="currentColor"/>
               <path d="M44 80V52h30v28Z" fill="currentColor"/>
               <path d="M44 52 59 40l15 12Z" fill="currentColor"/>`,
  lantern:    `<rect x="18" y="26" width="64" height="3" fill="currentColor"/>
               <g fill="currentColor">
                 <ellipse cx="30" cy="38" rx="7" ry="9"/><rect x="29" y="29" width="2" height="6"/>
                 <ellipse cx="50" cy="41" rx="7" ry="9"/><rect x="49" y="29" width="2" height="9"/>
                 <ellipse cx="70" cy="37" rx="7" ry="9"/><rect x="69" y="29" width="2" height="5"/>
               </g>
               <path d="M14 80V60h72v20Z" fill="currentColor"/>`,
  bridge:     `<path d="M8 66h84v4H8Z" fill="currentColor"/>
               <path d="M14 66c0-16 14-26 36-26s36 10 36 26" fill="none" stroke="currentColor" stroke-width="4"/>
               <g stroke="currentColor" stroke-width="2.5">
                 <path d="M26 66V49M38 66V43M50 66V40M62 66V43M74 66V49"/>
               </g>
               <path d="M0 80V70h100v10Z" fill="currentColor"/>`,
  roof:       `<path d="M12 50h76l-6-7H18Z" fill="currentColor"/>
               <path d="M18 43 50 26l32 17Z" fill="currentColor"/>
               <path d="M8 52c8-2 14-5 14-5M92 52c-8-2-14-5-14-5" stroke="currentColor" stroke-width="3" fill="none"/>
               <rect x="22" y="52" width="56" height="28" fill="currentColor"/>`,
  lighthouse: `<path d="M44 80V34h12v46Z" fill="currentColor"/>
               <rect x="40" y="26" width="20" height="9" rx="2" fill="currentColor"/>
               <path d="M50 20 56 27H44Z" fill="currentColor"/>
               <path d="M0 80V68h100v12Z" fill="currentColor"/>
               <path d="M62 30h26M62 34h20" stroke="currentColor" stroke-width="2" opacity=".5"/>`,
  dome:       `<path d="M20 80V44h60v36Z" fill="currentColor"/>
               <path d="M34 44a16 16 0 0 1 32 0Z" fill="currentColor"/>
               <rect x="48" y="18" width="4" height="12" fill="currentColor"/>
               <g fill="#FFF" opacity=".25">
                 <rect x="28" y="54" width="7" height="14"/><rect x="42" y="54" width="7" height="14"/>
                 <rect x="56" y="54" width="7" height="14"/><rect x="70" y="54" width="7" height="6"/>
               </g>`,
  trees:      `<g fill="currentColor">
                 <path d="M22 72 32 44l10 28Z"/><rect x="30" y="68" width="4" height="10"/>
                 <path d="M44 74 56 38l12 36Z"/><rect x="54" y="70" width="4" height="10"/>
                 <path d="M68 72 78 48l10 24Z"/><rect x="76" y="68" width="4" height="10"/>
               </g>
               <path d="M0 80V76h100v4Z" fill="currentColor"/>`,
  water:      `<path d="M0 80V62h100v18Z" fill="currentColor"/>
               <g stroke="#FFF" stroke-width="2" opacity=".3" fill="none">
                 <path d="M8 68h18M34 68h22M64 68h26M14 74h24M46 74h20M74 74h18"/>
               </g>
               <circle cx="72" cy="30" r="11" fill="currentColor" opacity=".35"/>`,
  track:      `<path d="M0 80 32 48h36l32 32Z" fill="currentColor"/>
               <g stroke="#FFF" stroke-width="2.5" opacity=".35">
                 <path d="M40 48 26 80M60 48l14 32"/>
                 <path d="M36 56h28M32 64h36M27 72h46"/>
               </g>`,
  arcade:     `<path d="M10 80V40h80v40Z" fill="currentColor"/>
               <g fill="#FFF" opacity=".22">
                 <path d="M20 80V58a8 8 0 0 1 16 0v22Z"/>
                 <path d="M42 80V58a8 8 0 0 1 16 0v22Z"/>
                 <path d="M64 80V58a8 8 0 0 1 16 0v22Z"/>
               </g>
               <rect x="6" y="36" width="88" height="6" rx="2" fill="currentColor"/>`,
  terrace:    `<g fill="currentColor">
                 <path d="M0 80V70h34v10ZM30 70V60h38v10ZM62 60V50h38v30H62Z"/>
               </g>
               <g stroke="#FFF" stroke-width="1.6" opacity=".25">
                 <path d="M4 75h26M34 65h30M66 55h30"/>
               </g>`,
  wall:       `<path d="M0 80V46h100v34Z" fill="currentColor"/>
               <g stroke="#FFF" stroke-width="1.4" opacity=".22">
                 <path d="M0 55h100M0 64h100M0 73h100"/>
                 <path d="M16 46v9M48 46v9M80 46v9M32 55v9M64 55v9M96 55v9M16 64v9M48 64v9M80 64v9"/>
               </g>`,
};

/**
 * 產生一張明信片的 SVG。
 * @param {string} key   ART 的鍵（glass / market / moat …）
 * @param {object} [opt] { seed } 微調光源位置，讓同風格的卡片不完全一樣
 */
function postcardArt(key, opt = {}) {
  const a = ARTS[key] || ARTS.glass;
  const id = `g${key}${opt.seed || 0}${opt.wide ? 'w' : ''}`;
  const sunX = 26 + ((opt.seed || 0) * 17) % 48;

  /* 橫式與直式是兩套構圖，不是同一張圖硬裁。
     直式（明信片本體）：主體在中央偏下，地面佔滿下緣。
     橫式（首頁橫幅、探索主卡）：壓縮高度，主體退到中段，
     下緣留給遮罩壓文字 —— 否則剪影會跟深色遮罩糊在一起。 */
  const H       = opt.wide ? 70 : 133;
  const sunY    = opt.wide ? 18 : 32;
  const sunR    = opt.wide ? 9  : 13;
  const band1   = opt.wide ? 36 : 56;
  const band2   = opt.wide ? 43 : 64;
  const motifTf = opt.wide ? 'translate(12.5,8) scale(0.75)' : 'translate(0,28)';
  const groundY = opt.wide ? 64 : 106;

  return `
<svg class="postcard__art" viewBox="0 0 100 ${H}" preserveAspectRatio="xMidYMid slice"
     xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="${a.sky[0]}"/>
      <stop offset="52%"  stop-color="${a.sky[1]}"/>
      <stop offset="100%" stop-color="${a.sky[2]}"/>
    </linearGradient>
    <clipPath id="c${id}"><rect width="100" height="${H}"/></clipPath>
  </defs>

  <g clip-path="url(#c${id})">
    <rect width="100" height="${H}" fill="url(#${id})"/>

    <!-- 光源 -->
    <circle cx="${sunX}" cy="${sunY}" r="${sunR}"       fill="#FFF" opacity=".34"/>
    <circle cx="${sunX}" cy="${sunY}" r="${sunR * 0.54}" fill="#FFF" opacity=".55"/>

    <!-- 遠景色帶 -->
    <rect y="${band1}" width="100" height="10" fill="${a.ground}" opacity=".18"/>
    <rect y="${band2}" width="100" height="8"  fill="${a.ground}" opacity=".3"/>

    <!-- 主體剪影 -->
    <g transform="${motifTf}" fill="${a.ground}" opacity=".94">
      <g style="color:${a.ground}">${MOTIFS[a.motif] || MOTIFS.wall}</g>
    </g>

    <!-- 地面 -->
    <rect y="${groundY}" width="100" height="${H - groundY}" fill="${a.ground}"/>

    <!-- 顆粒感：模擬生成模型的紋理 -->
    <g opacity=".07">
      ${Array.from({ length: 26 }, (_, i) => {
        const x = (i * 37 + (opt.seed || 0) * 11) % 100;
        const y = (i * 53) % H;
        return `<circle cx="${x}" cy="${y}" r="${0.6 + (i % 3) * 0.4}" fill="#FFF"/>`;
      }).join('')}
    </g>
  </g>
</svg>`;
}

/* 把 <div data-art="glass" data-seed="2"> 填成明信片視覺 */
function injectArt(root = document) {
  root.querySelectorAll('[data-art]').forEach(el => {
    el.insertAdjacentHTML('afterbegin',
      postcardArt(el.dataset.art, {
        seed: Number(el.dataset.seed || 0),
        wide: el.hasAttribute('data-wide'),
      }));
  });
}

/* --------------------------------------------------------------------------
   模擬推播浮層（demo 工具，非產品畫面）
   -------------------------------------------------------------------------- */

function showPush({ time = '08:10', date = '9月21日 星期日', title, body, href }) {
  const el = document.createElement('div');
  el.className = 'pushmock';
  el.innerHTML = `
    <div class="pushmock__clock">
      <div class="pushmock__time">${time}</div>
      <div class="pushmock__date">${date}</div>
    </div>
    <a class="pushmock__card" href="${href}">
      <span class="pushmock__app">y</span>
      <span>
        <span class="pushmock__t">yoxi 城事</span>
        <span class="pushmock__b">${body}</span>
      </span>
    </a>
    <button class="pushmock__close" style="margin-top:auto;margin-bottom:40px;color:#fff;opacity:.6;font-size:13px">
      關閉（demo）
    </button>`;
  document.querySelector('.device')?.appendChild(el);
  el.querySelector('.pushmock__close').onclick = () => el.remove();
  return el;
}

/* --------------------------------------------------------------------------
   sheet 與 tab bar 的交界
   sheet 展開到全高時，tab bar 降低不透明度而非消失 ——
   用視覺讓渡取代「出現／消失」，避免版面跳動。
   -------------------------------------------------------------------------- */

function yieldTabbar(on) {
  document.getElementById('tabbar')?.classList.toggle('is-yield', on);
}

/* --------------------------------------------------------------------------
   啟動
   -------------------------------------------------------------------------- */

function mount() {
  const screen = document.querySelector('.device__screen');
  if (!screen) return;

  const tone = document.body.dataset.status || 'dark';
  const time = document.body.dataset.time || '21:35';
  const tab  = document.body.dataset.tab;

  screen.insertAdjacentHTML('afterbegin', statusbar(tone, time));

  const device = document.querySelector('.device');
  if (tab) {
    device.insertAdjacentHTML('beforeend', tabbar(tab));
    screen.classList.add('has-tabbar');
  }
  device.insertAdjacentHTML('beforeend',
    `<div class="home-bar ${tone === 'light' ? 'home-bar--light' : ''}"></div>`);

  injectArt();
  injectIcons();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}

window.SHELL = { injectIcons, injectArt, postcardArt, showPush, yieldTabbar };
})();
