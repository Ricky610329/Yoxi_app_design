/* ==========================================================================
   yoxi 城事 web app — explore 區塊：明信片的卡面（不註冊畫面）
   契約：app/ARCHITECTURE.md §7。載入順序：explore-cards.js → explore-face.js → explore-gold.js。

   回答什麼：收下的那一張長什麼樣。卡面的疊法只有一個：生成好的成品 → 沒有成品或載不到：底圖照片＋那一款的
             SVG 濾鏡 → 都沒有才是插圖。/unlock 的卡面（explore-unlock.js 的 faceHTML）與收藏、叫車的卡
             （data-card-art）都照 cardFace 疊，出處也從同一張照片來。
   提供（APP.explore）：
     cardFace(cardId, key) → { gen, photo, credit }   這一款的卡面：成品網址、底圖照片網址、照片出處（沒有的是 '' 或 null）
     postcardSrc(cardId, key)／cardPhoto(cardId)       成品的網址、底圖照片（credits.js 的一筆）
     paintCardArt(root)                                把 root 裡收下的 [data-card-art] 疊上那一款（.device 上的會自己疊）
   刻意沒有：哪一款、是不是金框（explore-cards.js 的 cardStyleOf、cardOrigin）；金粉（explore-gold.js）。
   ========================================================================== */

(function () {
'use strict';

const APP = window.APP;
if (!APP || !APP.explore || !APP.explore._) {
  throw new Error('explore-face.js 要在 explore-cards.js 之後載入（index.html 的順序）');
}
const K = APP.explore._;
const styleOf = K.styleOf;

/* ---- 生成好的明信片 ----
   每張明信片五款的成品：景點照片 → Stable Diffusion img2img＋ControlNet（照片的輪廓鎖住構圖）→ 各畫風。
   產生器是 app/tools/gen-postcards.py；檔名 assets/postcards/<明信片 id>-<款式>.jpg。
   只有 POSTCARD_GEN 裡的明信片有成品（匯出時工具會印出這張表）；其餘的卡面退回「照片＋SVG 濾鏡」的示意。 */
const POSTCARD_DIR = 'assets/postcards/';
const POSTCARD_GEN = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11'];
function postcardSrc(cardId, key) {
  if (!cardId || !styleOf(key) || POSTCARD_GEN.indexOf(cardId) < 0) return '';
  return POSTCARD_DIR + cardId + '-' + key + '.jpg';
}
/* 明信片的底圖照片：明信片自己的一張（p10、p19…）→ 對照表裡的地點（station…）→ 這張卡所在地點的。
   照片與授權在 prototype/assets/photos/credits.js。/unlock 的卡面、收藏的卡面與「底圖照片 ©」出處都用這一個 */
const CARD_PHOTO = { p1: 'station', p2: 'market', p3: 'moat', p4: 'harbour', p5: 'rail', p6: 'hill', p7: 'temple',
                     p8: 'lake', p9: 'neiwan', p11: 'glass-kiln', p20: 'brick' };
function cardPhoto(cardId) {
  const P = window.PHOTOS;
  if (!cardId || !P || !P.get) return null;
  const pl = APP.place(cardId);
  return P.get(cardId, 0) || P.get(CARD_PHOTO[cardId], 0) || (pl ? P.get(pl.id, 0) : null) || null;
}

/* 這一款的卡面（純函式，/unlock 與 paintCardArt 共用）：
   gen＝生成好的成品（POSTCARD_GEN 裡的才有，其餘 ''）、photo＝底圖照片的網址（成品載不到或沒有成品時用）、
   credit＝照片的出處（credits.js 的一筆：作者、授權、連結），都沒有是 '' 與 null（那就是插圖） */
function cardFace(cardId, key) {
  const ph = cardPhoto(cardId);
  return {
    gen: postcardSrc(cardId, key),
    photo: ph && window.PHOTOS ? window.PHOTOS.base + ph.file : '',
    credit: ph || null,
  };
}

/* 別的畫面（收藏、叫車首頁的卡片、浮起來的小卡）要顯示「收下的那一張」：元素帶 data-card-art="<明信片 id>"，
   這裡把那一款疊在插圖上面，跟 /unlock 的卡面同一個順序（cardFace）：
     生成好的成品（POSTCARD_GEN 裡的）→ 沒有成品、或成品載不到：底圖照片＋那一款的 SVG 濾鏡 → 都沒有才是插圖。
   以前沒有第二步：p12–p22 還沒生成成品，翻卡時看到的是實景照片做的卡面，收下之後收藏裡卻變回插圖。
   還沒收的不疊（維持灰階插圖，「到了就會上色」）。
   金框那一款在哪裡顯示都有金框和金粉（explore-gold.js）：畫面自己標了 data-gold-aura（框畫在外層）就照它的，
   沒標的這裡補上 data-gold-aura＋.card-gold（通用的框，explore.css） */
function paintCardArt(root) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('[data-card-art]:not([data-card-painted])').forEach(function (el) {
    const id = el.getAttribute('data-card-art');
    el.setAttribute('data-card-painted', '');
    /* data-card-visit：第幾次收下的那一張（回訪的卡款式可能不一樣）；沒寫是第一次 */
    const v = el.getAttribute('data-card-visit');
    const o = APP.explore.cardOrigin(id, v ? Number(v) : undefined);
    if (!o) return;
    const d = o.style;
    if (o.gold && !el.closest('[data-gold-aura]')) {
      el.classList.add('card-gold');
      el.setAttribute('data-gold-aura', '');
    }
    const face = cardFace(id, d && d.key);
    const src = face.gen, photo = face.photo;
    if (!src && !photo) return;
    const img = document.createElement('img');
    img.className = 'card-gen';
    img.alt = '';
    img.decoding = 'async';
    img.setAttribute('data-style', d.key);
    /* 照片卡面：底下的插圖藏起來、墊紙色（濾鏡的邊是柔的，水彩還會留白邊，插圖會從邊上透出來） */
    const usePhoto = function () {
      img.onerror = function () { unfitPhoto(img); el.classList.remove('card-photo-host'); img.remove(); };
      img.classList.add('card-gen--photo');
      el.classList.add('card-photo-host');
      if (APP.fx && APP.fx.filters) APP.fx.filters();
      img.src = photo;
      fitPhoto(el, img);
    };
    if (src) {
      img.onerror = function () { if (photo) usePhoto(); else img.remove(); };
      img.src = src;
    } else {
      usePhoto();
    }
    /* 放在插圖（第一個子元素）後面、「新」之類的角標前面 */
    const art = el.querySelector(':scope > .postcard__art');
    el.insertBefore(img, art ? art.nextSibling : el.firstChild);
  });
}

/* 照片＋濾鏡的卡面：濾鏡的參數是 px（水彩的白邊、油畫的筆觸），照 /unlock 卡面的寬（220 px）調的。
   直接套在 40 px 的獎章縮圖上會糊成一團、套在 290 px 的明信片詳情上又太淡，
   所以照片一律先排成 PHOTO_W 寬（高照容器的比例）、套濾鏡，再整張縮放到容器大小：哪裡看起來都跟翻開時一樣。
   容器大小變了（還沒顯示、面板展開、視窗改大小）由 ResizeObserver 重算。 */
const PHOTO_W = 220;
const photoFit = window.ResizeObserver ? new ResizeObserver(function (entries) {
  entries.forEach(function (e) {
    /* 換頁拆掉的卡（ResizeObserver 在元素離開文件時也會通知）：不再追，免得每重畫一次就多留一批 */
    if (!e.target.isConnected) { photoFit.unobserve(e.target); return; }
    const img = e.target.querySelector(':scope > img.card-gen--photo');
    if (img) fitPhoto(e.target, img);
  });
}) : null;
function fitPhoto(el, img) {
  const w = el.clientWidth, h = el.clientHeight;
  if (photoFit && !img._fit) { img._fit = el; photoFit.observe(el); }
  if (!w || !h) return;
  img.style.width = PHOTO_W + 'px';
  img.style.height = (PHOTO_W * h / w).toFixed(1) + 'px';
  /* 多放大 1 px：縮放的小數會在右邊、下面留一條縫 */
  img.style.transform = 'scale(' + ((w + 1) / PHOTO_W).toFixed(4) + ')';
}
function unfitPhoto(img) {
  if (photoFit && img._fit) photoFit.unobserve(img._fit);
  img._fit = null;
}
/* 整台手機（.device：#view 與掛在它上面的浮層、懸浮小卡）有新的 [data-card-art] 就疊上去，畫面不用自己叫。
   同一輪的變動併成一次（microtask），只找還沒畫過的元素 */
(function watchCardArt() {
  const host = document.querySelector('.device') || document.getElementById('view');
  if (!host || !window.MutationObserver) return;
  let queued = false;
  new MutationObserver(function () {
    if (queued) return;
    queued = true;
    Promise.resolve().then(function () { queued = false; paintCardArt(host); });
  }).observe(host, { childList: true, subtree: true });
})();


APP.explore = Object.assign(APP.explore, {
  cardFace: cardFace,
  postcardSrc: postcardSrc,
  cardPhoto: cardPhoto,
  paintCardArt: paintCardArt,
});

})();
