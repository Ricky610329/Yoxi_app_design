/* ==========================================================================
   yoxi 城事 介紹網站 — 明信片 SVG（window.postcardArt）

   抄自 prototype/js/shell.js 的 ARTS／MOTIFS／postcardArt；風格參數 ART 抄自 prototype/js/mock.js。
   那邊改了要同步這邊（介紹網站不載 mock.js／shell.js，因為它們會接管整頁的 body）。
   畫面上每一張明信片旁邊都要標「AI 生成示意」——這是模擬 AI「風格鎖定」的替代畫法，不是生成模型的輸出。
   漸層 id 必須全頁唯一：同一頁有兩張同風格同 seed 的卡時，後一張的 url(#id) 會抓到第一份定義，
   若第一份藏在 display:none 裡就整片不上色（shell.js 的註解有寫這次事故）。所以 id 帶流水號 artSeq。
   下面的 hex 是明信片畫面本身的色票（等同地圖的 PALETTE），不是頁面 UI 色。
   ========================================================================== */
(function () {
'use strict';

/* 風格參數：抄自 prototype/js/mock.js 的 ART */
const ARTS = {
  glass:   { sky: ['#F5C7B8', '#FF8A6B', '#C7452E'], ground: '#1E3A5C', motif: 'chimney' },
  market:  { sky: ['#FFE2B8', '#FFB259', '#D4761F'], ground: '#2A2118', motif: 'lantern' },
  moat:    { sky: ['#CFE6F2', '#7FB6D6', '#2E6F96'], ground: '#1B4332', motif: 'bridge' },
  temple:  { sky: ['#FFD9C2', '#F2765A', '#8C2B1E'], ground: '#241A16', motif: 'roof' },
  harbour: { sky: ['#D6ECF5', '#6FB0CC', '#1F5C7A'], ground: '#0E2A38', motif: 'lighthouse' },
  station: { sky: ['#E8DCC8', '#C4A57B', '#6B4E2E'], ground: '#2B2016', motif: 'dome' },
  hill:    { sky: ['#DCEFD4', '#8FC084', '#3E6B47'], ground: '#1C3A26', motif: 'trees' },
  lake:    { sky: ['#E0D4F0', '#9B8ACB', '#4A3C73'], ground: '#1F2440', motif: 'water' },
  rail:    { sky: ['#F0E4D0', '#D9A86C', '#8A5A2B'], ground: '#2E2419', motif: 'track' },
  oldst:   { sky: ['#FFE8CC', '#E8A15C', '#A35F28'], ground: '#332415', motif: 'arcade' },
  hakka:   { sky: ['#E4EDDC', '#A8BE8C', '#556B3D'], ground: '#232E1C', motif: 'terrace' },
  brick:   { sky: ['#F7DCC9', '#DB8F63', '#8F4A28'], ground: '#2C1D14', motif: 'wall' },
};

/* ---- 以下逐字抄自 prototype/js/shell.js（MOTIFS、artSeq、postcardArt） ---- */
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
/* 每一張的漸層 id 都要全頁唯一。以前是 g + 風格 + seed，同一頁只要有兩張
   同風格同 seed 的卡（抵達解鎖的幕 2 與幕 3、回顧的成品卡與幕 2），
   後面那張的 url(#id) 會取到第一份定義；而第一份藏在 display:none 裡，
   沒有 layout，天空就整片不上色 —— 產品高潮那張卡是灰白的。 */
let artSeq = 0;

function postcardArt(key, opt = {}) {
  const a = ARTS[key] || ARTS.glass;
  const id = `g${key}${opt.seed || 0}${opt.wide ? 'w' : ''}_${artSeq++}`;
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

window.postcardArt = postcardArt;
window.POSTCARD_ARTS = ARTS;
})();
