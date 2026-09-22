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

/* 冪等：同一個元素被注入第二次不會多長一個 SVG。
   共用函式內部會注入一次，畫面往往又全域注入一次，mount() 還會再一次 ——
   重複的 SVG 漸層 id 會讓瀏覽器全部取用第一個定義，顏色就跑掉了。 */
function injectIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    const svg = ICONS[el.dataset.icon];
    /* 記住上次注入的是哪一個圖示：換了名字要重畫，沒換就跳過。
       （例如每日回顧的完成卡會依心情換圖示） */
    if (svg && el.dataset.iconDone !== el.dataset.icon) {
      el.innerHTML = svg;
      el.dataset.iconDone = el.dataset.icon;
    }
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

/* 每個變體有自己的一組分頁，因為它們的叫車／探索／收藏是不同的檔案。
   <body data-tabs="變體名"> 指定要用哪一組，沒寫就用預設。 */
/* ?still=1：定格模式，見 base.css。要在任何轉場開始之前就掛上，
   所以寫在最前面，不等 DOMContentLoaded。 */
if (new URLSearchParams(location.search).has('still')) {
  document.documentElement.setAttribute('data-still', '');
}

/* ?flow=a：demo 導覽列（js/tour.js）。只在帶參數時才載入 catalog 與 tour，
   平常打開畫面一個位元組都不多，49 張畫面也不用各自加 script 標籤。
   async=false 讓兩支照順序執行：tour 需要 catalog 先在。 */
if (new URLSearchParams(location.search).has('flow')) {
  const base = ((document.currentScript && document.currentScript.src) || '')
    .replace(/[^\/]*$/, '');
  ['catalog.js', 'tour.js'].forEach(function (f) {
    const s = document.createElement('script');
    s.src = base + f;
    s.async = false;
    document.head.appendChild(s);
  });
}

const TABSETS = {
  default: [
    { id: 'ride',    label: '叫車', icon: 'tabRide',    href: 'home.html' },
    { id: 'explore', label: '探索', icon: 'tabExplore', href: 'explore.html', dot: true },
    { id: 'album',   label: '收藏', icon: 'tabAlbum',   href: 'album.html' },
  ],
  /* 上一輪「問題一」的三個變體。它們各自只改了一兩張畫面，
     但分頁列如果還指向現況，走一步就掉回現況 —— 變體等於沒做。 */
  a: [
    { id: 'ride',    label: '叫車', icon: 'tabRide',    href: 'home.html' },
    { id: 'explore', label: '探索', icon: 'tabExplore', href: 'variant-a-explore.html', dot: true },
    { id: 'album',   label: '收藏', icon: 'tabAlbum',   href: 'variant-a-album.html' },
  ],
  b: [
    { id: 'ride',    label: '叫車', icon: 'tabRide',    href: 'home.html' },
    { id: 'explore', label: '探索', icon: 'tabExplore', href: 'variant-b-explore.html', dot: true },
    { id: 'album',   label: '收藏', icon: 'tabAlbum',   href: 'variant-b-album.html' },
  ],
  c: [
    { id: 'ride',    label: '叫車', icon: 'tabRide',    href: 'home.html' },
    { id: 'explore', label: '探索', icon: 'tabExplore', href: 'variant-c-explore.html', dot: true },
    { id: 'album',   label: '收藏', icon: 'tabAlbum',   href: 'variant-c-album.html' },
  ],
  d: [
    { id: 'ride',    label: '叫車', icon: 'tabRide',    href: 'variant-d-home.html' },
    { id: 'explore', label: '探索', icon: 'tabExplore', href: 'variant-d-explore.html', dot: true },
    { id: 'album',   label: '收藏', icon: 'tabAlbum',   href: 'variant-d-album.html' },
  ],
  e: [
    { id: 'ride',    label: '叫車', icon: 'tabRide',    href: 'variant-e-home.html' },
    { id: 'explore', label: '探索', icon: 'tabExplore', href: 'variant-e-explore.html', dot: true },
    { id: 'album',   label: '收藏', icon: 'tabAlbum',   href: 'variant-e-album.html' },
  ],
  /* 變體 F 只有兩個分頁：叫車與探索合在同一個畫面裡 */
  f: [
    { id: 'ride',   label: '地圖', icon: 'tabExplore', href: 'variant-f-home.html', dot: true },
    { id: 'album',  label: '收藏', icon: 'tabAlbum',   href: 'variant-f-album.html' },
  ],
};

function tabbar(active, set) {
  const TABS = TABSETS[set] || TABSETS.default;
  /* 變體 A／B／C 的叫車頁是共用的 home.html，連過去時要把變體帶著 */
  const carry = (set === 'a' || set === 'b' || set === 'c')
    ? function (h) { return h === 'home.html' ? 'home.html?v=' + set : h; }
    : function (h) { return h; };
  return `
    <nav class="tabbar" id="tabbar">
      ${TABS.map(t => `
        <a class="tabbar__item ${t.id === active ? 'is-active' : ''}" href="${carry(t.href)}">
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
/* 每一張的漸層 id 都要全頁唯一。以前是 g + 風格 + seed，同一頁只要有兩張
   同風格同 seed 的卡（抵達解鎖的幕 2 與幕 3、回顧完成卡與幕 2），
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

/* 把 <div data-art="glass" data-seed="2"> 填成明信片視覺 */
function injectArt(root = document) {
  root.querySelectorAll('[data-art]').forEach(el => {
    if (el.querySelector(':scope > .postcard__art')) return;   /* 已經注入過 */
    el.insertAdjacentHTML('afterbegin',
      postcardArt(el.dataset.art, {
        seed: Number(el.dataset.seed || 0),
        wide: el.hasAttribute('data-wide'),
      }));
  });
}


/* --------------------------------------------------------------------------
   地圖的共用零件

   霧地圖格子與景點圖釘原本在四個畫面重複貼上，再加三個變體會變成七份，
   任何一次微調都要改七個地方。道路與地名是各畫面自己的美術，不抽；
   只抽真正重複的這兩段。
   -------------------------------------------------------------------------- */

/** 霧地圖的格子。回傳 SVG 內容字串，塞進畫面自己的 <svg> 裡。 */
function fogCells(w, h) {
  const rows = window.MOCK.FOG;
  const cw = w / rows[0].length;
  const ch = h / rows.length;
  return rows.map(function (row, y) {
    return row.map(function (st, x) {
      const cls = st === 'seen' ? 'fogmap__cell--seen'
                : st === 'fade' ? 'fogmap__cell--fade'
                : 'fogmap__cell--fog';
      return '<rect class="fogmap__cell ' + cls + '" x="' + (x * cw) + '" y="' + (y * ch) +
             '" width="' + (cw + .5) + '" height="' + (ch + .5) + '"/>';
    }).join('');
  }).join('');
}

/** 霧地圖的覆蓋率（%）。畫面上不要再寫死數字。 */
function fogCoverage() {
  const flat = window.MOCK.FOG.flat();
  return Math.round(flat.filter(function (c) { return c !== 'fog'; }).length / flat.length * 100);
}

/**
 * 景點圖釘。
 * @param {Element} el   容器
 * @param {object}  opt  spots 要畫哪些（預設 MOCK.SPOTS）
 *                       max 最多幾個 —— 叫車首頁靠它控制「不要變吵」
 *                       compact 縮小一號，疊在叫車地圖上時用
 *                       squeeze/offset 垂直壓縮與位移，避開瀏海與 sheet
 *                       href(spot) 有回傳值就用 <a>，沒有就用 <button>
 */
function renderSpots(el, opt) {
  opt = opt || {};
  const list = (opt.spots || window.MOCK.SPOTS).slice(0, opt.max || 99);
  const sq = opt.squeeze != null ? opt.squeeze : 1;
  const of = opt.offset  != null ? opt.offset  : 0;

  el.innerHTML = list.map(function (s, i) {
    const cls = s.state === 'today' ? 'spot--today'
              : (s.state === 'seen' ? 'spot--seen' : 'spot--new');
    const href = opt.href && opt.href(s);
    const tag  = href ? 'a' : 'button';
    return '<' + tag + ' class="spot ' + cls + (opt.compact ? ' spot--compact' : '') + '"' +
      ' data-i="' + i + '"' + (href ? ' href="' + href + '"' : '') +
      ' style="left:' + s.x + '%; top:' + (of + s.y * sq) + '%">' +
      (s.state === 'today' ? '<span class="spot__halo"></span>' : '') +
      '<span class="spot__img" data-art="' + s.art + '" data-seed="' + i + '"></span>' +
      (s.state === 'seen' ? '<span class="spot__tick"><span data-icon="check"></span></span>' : '') +
      '</' + tag + '>';
  }).join('');

  injectArt(el);
  injectIcons(el);
  return list;
}

/**
 * 點圖釘 → 底部浮出小卡。不跳頁，可以連看好幾個。
 * @param {Element} peekEl  .peek 元素
 * @param {Array}   list    renderSpots 回傳的清單
 * @param {object}  opt     onOpen(spot) 讓畫面自己決定小卡內容與連結
 */
/* 排在所有 DOMContentLoaded 綁定之後才跑。
   頁內腳本在 body 裡，執行時 interact.js 還沒 boot（它等 DOMContentLoaded），
   所以想「程式化地點一顆 pill」就得排到它後面去。 */
/* 短暫的提示條。
   用在「這顆按鈕在正式版會做事，但這份原型沒有做那一段」的地方 ——
   按下去完全沒反應是最難自我發現、現場也最尷尬的一種缺陷。 */
function toast(msg, opt) {
  opt = opt || {};
  const host = document.querySelector('.device') || document.body;
  host.querySelectorAll('.toast').forEach(function (t) { t.remove(); });
  const t = document.createElement('div');
  t.className = 'toast';
  if (opt.bottom) t.style.bottom = opt.bottom;
  t.textContent = msg;
  host.appendChild(t);
  setTimeout(function () { t.remove(); }, opt.ms || 2400);
}

/* 分享面板。elder=true 時把長輩圖放在第一個選項 ——
   那是這個提案最難被複製的一格，不該只埋在收藏頁第三層。 */
function shareSheet(opt) {
  opt = opt || {};
  const host = document.querySelector('.device') || document.body;
  if (host.querySelector('.sharesheet')) return;

  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.style.cssText = 'place-items:end stretch; padding:0';

  const rows = [];
  if (opt.elder !== false) {
    rows.push(['<a class="row-nav" href="elder.html">',
               '傳給家人', '自動排成長輩圖：大字、吉祥話、你昨天去過的地方']);
  }
  rows.push(['<button class="row-nav" data-act="save">', '存成圖片', '存到相簿，原圖不含任何位置資訊']);
  rows.push(['<button class="row-nav" data-act="link">', '複製連結', '對方點開只看得到這一張，看不到你的其他紀錄']);

  scrim.innerHTML =
    '<div class="sharesheet">' +
      '<div class="sharesheet__handle"></div>' +
      '<div class="sharesheet__t">' + (opt.title || '分享這張') + '</div>' +
      rows.map(function (r) {
        return r[0] +
          '<span class="row-nav__body">' +
            '<span class="row-nav__title">' + r[1] + '</span>' +
            '<span class="row-nav__sub">' + r[2] + '</span>' +
          '</span><span class="arrow"></span></' + (r[0].indexOf('<a') === 0 ? 'a' : 'button') + '>';
      }).join('') +
      '<div class="sharesheet__note">日誌與心情不會被分享。只有明信片與週回顧可以拿出去。</div>' +
    '</div>';

  const close = function () { scrim.remove(); };
  scrim.addEventListener('click', function (e) { if (e.target === scrim) close(); });
  scrim.querySelectorAll('[data-act]').forEach(function (b) {
    b.addEventListener('click', function () {
      close();
      toast(b.dataset.act === 'save' ? '已存到相簿' : '連結已複製');
    });
  });
  host.appendChild(scrim);
}

/* 排在所有 DOMContentLoaded 綁定之後才跑。
   頁內腳本在 body 裡，執行時 interact.js 還沒 boot（它等 DOMContentLoaded），
   所以想「程式化地點一顆 pill」就得排到它後面去。

   全部跑完之後在 <html> 掛上 data-shell-ready，稽核工具才有東西可以等 ——
   之前它們是固定等 700ms 就斷言，機器忙一點就會量到半成品，
   變體 F 的「切模式時地圖高度不變」因此間歇性地 FAIL 過。 */
const readyQueue = [];
let readyDone = false;

function drainReady() {
  while (readyQueue.length) {
    const fn = readyQueue.shift();
    try { fn(); } catch (e) { console.error('SHELL.ready:', e); }
  }
  readyDone = true;
  document.documentElement.setAttribute('data-shell-ready', '1');
}

function ready(fn) {
  if (readyDone) { setTimeout(fn, 0); return; }
  readyQueue.push(fn);
  if (readyQueue.length > 1) return;          /* 已經排過了 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(drainReady, 0); });
  } else {
    setTimeout(drainReady, 0);
  }
}

/* 沒有任何頁內腳本呼叫 ready() 的畫面也要掛上標記，稽核才不會空等。 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { setTimeout(drainReady, 0); });
} else {
  setTimeout(drainReady, 0);
}


/* 叫車地圖上要疊哪幾個景點、疊在哪。
   pos 是 { 景點id: [x%, y%] }，座標是底邊中心。

   為什麼要抽出來：這段本來在變體 D／E／F 各複製一份，
   結果 mock.js 把 SPOTS[0].id 從 'glass' 改成 'glass-kiln' 時只改了一處，
   三個變體同時少掉「今天的地方」那一顆 —— 而四份稽核工具全部報全過，
   因為它們只檢查「景點數量不超過 4」，沒有下界。
   所以這裡自己把對不上的 key 叫出來，別再安靜地少一顆。 */
function nearSpots(pos) {
  const byId = {};
  MOCK.SPOTS.forEach(function (s) { byId[s.id] = s; });

  const miss = Object.keys(pos).filter(function (k) { return !byId[k]; });
  if (miss.length) {
    throw new Error('nearSpots：MOCK.SPOTS 裡沒有 ' + miss.join('、') +
                    '。改過 SPOTS 的 id 就要同步改各變體的 POS。');
  }
  return Object.keys(pos).map(function (k) {
    const c = Object.assign({}, byId[k]);
    c.x = pos[k][0];
    c.y = pos[k][1];
    return c;
  });
}

function bindPeek(peekEl, list, opt) {
  opt = opt || {};
  let open = -1;

  function show(i) {
    const s = list[i];
    if (!s) return;
    const img = peekEl.querySelector('.peek__img');
    if (img) {
      img.innerHTML = postcardArt(s.art, { seed: i });
      img.style.filter = s.state === 'new'
        ? 'grayscale(1) contrast(.72) brightness(1.16)' : '';
    }
    const set = function (sel, txt) {
      const e = peekEl.querySelector(sel);
      if (e) e.textContent = txt;
    };
    set('[data-peek-name]', s.name);
    set('[data-peek-meta]', s.type + ' · ' +
        (s.dist >= 1000 ? (s.dist / 1000).toFixed(1) + ' km' : s.dist + ' m'));
    set('[data-peek-hook]', s.hook);
    peekEl.classList.add('is-on');
    open = i;
    if (opt.onOpen) opt.onOpen(s, i);
  }

  document.querySelectorAll('.spot[data-i]').forEach(function (btn) {
    if (btn.tagName === 'A') return;          /* <a> 直接跳頁，不開小卡 */
    btn.onclick = function () {
      const i = Number(btn.dataset.i);
      if (open === i) { peekEl.classList.remove('is-on'); open = -1; }
      else show(i);
    };
  });

  return { show: show, close: function () { peekEl.classList.remove('is-on'); open = -1; } };
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
   連結改寫
   兩件事，都在點擊的瞬間做，畫面裡的 href 照舊寫最自然的那個目標：

   1. 返回鍵知道自己從哪來。每個站內連結帶上 ?from=<現在這一頁>，
      目標頁上標了 data-back 的返回鍵就改指回去。地方詳情從叫車首頁的
      banner 進、從地圖小卡進、從探索進，返回都回得到原本那一張。
      以前返回是寫死的常數，三個入口只有一個回得對。
   2. 變體不掉回現況。在變體裡（body data-tabs 或 ?v=）點到主線的
      home / explore / album / map，改指到那個變體自己的那一張；
      其餘共用頁（地方詳情、前往中、抽屜、上車點……）把 ?v= 帶著走，
      它們的 tab bar 與返回鍵才知道自己在哪個變體。以前圍牆只蓋到
      tab bar，按一下漢堡或返回就掉回現況，變體等於沒做。
   -------------------------------------------------------------------------- */

/* 每個變體的三個根與地圖分別是哪一張。主線的檔名 → 變體的檔名。 */
const ROOTS = {
  a: { 'home.html': 'home.html',           'explore.html': 'variant-a-explore.html',
       'album.html': 'variant-a-album.html', 'map.html': 'variant-a-map.html' },
  b: { 'home.html': 'home.html',           'explore.html': 'variant-b-explore.html',
       'album.html': 'variant-b-album.html', 'map.html': 'variant-b-explore.html' },
  c: { 'home.html': 'home.html',           'explore.html': 'variant-c-explore.html',
       'album.html': 'variant-c-album.html', 'map.html': 'variant-c-map.html' },
  d: { 'home.html': 'variant-d-home.html', 'explore.html': 'variant-d-explore.html',
       'album.html': 'variant-d-album.html', 'map.html': 'variant-d-home.html?layer=on' },
  e: { 'home.html': 'variant-e-home.html', 'explore.html': 'variant-e-explore.html',
       'album.html': 'variant-e-album.html', 'map.html': 'variant-e-home.html' },
  f: { 'home.html': 'variant-f-home.html', 'explore.html': 'variant-f-home.html?mode=today',
       'album.html': 'variant-f-album.html', 'map.html': 'variant-f-home.html?mode=today' },
};

/* 導覽、變體與工具自己的參數，不算在「這是哪一頁」裡 */
const CARRY = ['flow', 'step', 'still', 'from', 'v'];

/* 'place.html?id=neiwan' 這種寫法：檔名 + 內容參數 */
function pageKey(href) {
  const u = new URL(href, location.href);
  const p = new URLSearchParams(u.search);
  CARRY.forEach(function (k) { p.delete(k); });
  const base = u.pathname.split('/').pop();
  const qs = decodeURIComponent(p.toString());
  return qs ? base + '?' + qs : base;
}

function variantKey() {
  return document.body.dataset.tabs ||
         new URLSearchParams(location.search).get('v') || '';
}

/**
 * 站內連結點下去實際會去哪。
 * @param {string} raw   href 原文
 * @param {object} opt   back＝這是返回鍵（不加 from）；tab＝這是 tab bar（不加 from）
 */
function rewriteHref(raw, opt) {
  opt = opt || {};
  if (!raw || raw[0] === '#' || /^[a-z]+:/i.test(raw)) return raw;
  let u = new URL(raw, location.href);
  if (!/\.html$/.test(u.pathname)) return raw;

  const v = variantKey();
  if (v && ROOTS[v]) {
    const to = ROOTS[v][u.pathname.split('/').pop()];
    if (to) {
      const t = new URL(to, location.href);
      u.searchParams.forEach(function (val, k) {
        if (!t.searchParams.has(k)) t.searchParams.set(k, val);
      });
      u = t;
    }
    u.searchParams.set('v', v);
  }
  if (!opt.back && !opt.tab && !u.searchParams.has('from')) {
    u.searchParams.set('from', pageKey(location.href));
  }
  return u.pathname.split('/').pop() + u.search + u.hash;
}

/* 標了 data-back 的返回鍵：有 ?from= 就指回去 */
function applyBack(root) {
  const from = new URLSearchParams(location.search).get('from');
  if (!from || !/^[a-z0-9-]+\.html(\?[\w=&.%-]*)?$/i.test(from)) return;
  (root || document).querySelectorAll('a[data-back]').forEach(function (a) {
    a.setAttribute('href', from);
  });
}

/* 用 capture，搶在畫面自己的 handler 之前把 href 換掉 */
document.addEventListener('click', function (e) {
  const a = e.target.closest('a[href]');
  if (!a || !a.closest('.device')) return;
  if (a.hasAttribute('data-toast') || a.hasAttribute('data-share')) return;
  a.setAttribute('href', rewriteHref(a.getAttribute('href'), {
    back: a.hasAttribute('data-back'),
    tab:  !!a.closest('.tabbar'),
  }));
}, true);

/* 程式化跳頁。跟點 <a> 一樣會帶 from／v，有導覽列時再帶 flow 參數。
   抵達解鎖的「收進收藏」與每日回顧的「看收藏」都是用 JS 跳的，
   不經過 <a>，上面那個 click 攔不到 —— 走到這裡就會掉出流程。 */
function go(href) {
  let h = rewriteHref(href);
  if (window.TOUR) h = TOUR.href(h);
  location.href = h;
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
    /* 變體 A／B／C 沒有自己的叫車頁，共用 home.html。
       共用的那一頁如果不知道自己是從哪個變體來的，分頁列就會用預設組 ——
       按一下「叫車」再按一下「探索」，人就掉回現況，變體等於沒做。
       所以讓它靠 ?v= 把變體帶著走。 */
    const vParam = new URLSearchParams(location.search).get('v');
    device.insertAdjacentHTML('beforeend',
      tabbar(tab, document.body.dataset.tabs || vParam));
    screen.classList.add('has-tabbar');
  }
  device.insertAdjacentHTML('beforeend',
    `<div class="home-bar ${tone === 'light' ? 'home-bar--light' : ''}"></div>`);

  injectArt();
  injectIcons();
  applyBack();
  /* 頁內腳本在 DOMContentLoaded 之後才長出來的返回鍵也要接 */
  ready(function () { applyBack(); });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}

window.SHELL = {
    nearSpots: nearSpots,
    ready: ready,
    go: go,
    rewriteHref: rewriteHref,
    pageKey: pageKey,
    ROOTS: ROOTS,
    toast: toast,
    shareSheet: shareSheet,
  injectIcons, injectArt, postcardArt, showPush, yieldTabbar,
  fogCells, fogCoverage, renderSpots, bindPeek,
};
})();
