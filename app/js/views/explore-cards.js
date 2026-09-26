/* ==========================================================================
   yoxi 城事 web app — explore 區塊：明信片與抽卡的共用零件（不註冊畫面）
   契約：app/ARCHITECTURE.md §3、§7。
   載入順序：explore-fx.js → explore-cards.js → explore.js → explore-unlock.js（都在 album.js 之前）。

   回答什麼：一張明信片是哪一款、長什麼樣、怎麼收下。收藏（album）、叫車首頁（ride）、
             探索的各畫面、/unlock 都讀這裡，所以獨立成一支，不跟著任何一個畫面走。
   提供（APP.explore，對外 API，契約 §7）：
     collect(placeId, { note })                  收下一張明信片：搭車或走路、哪一款、幾公里都由這裡自己判斷
     cardOrigin(cardId)                          收下的那一張是怎麼來的：{ by, style, gold, limited, via, date, note, km }
     DRAW_STYLES／drawStyle(by, r)               抽卡機率表（全 app 唯一來源）與純抽取函式
     openOdds()                                  機率說明（掛在 .device，帶 data-overlay＋_dismiss）
     cardStyleOf(cardId)／postcardSrc(cardId, key)／cardPhoto(cardId)／paintCardArt(root)
                                                 生成好的明信片；#view 裡的 [data-card-art] 自動疊上成品
   是不是搭車抵達一律問 ride 的行程 module：APP.ride.trip.arrivedAt(地點 id)；搭車收下由 collect 呼叫
   APP.ride.trip.consume 用掉那一趟（連同 rideVia 歸因）。「是不是金框、是不是限定版」一律問 cardOrigin。
   內部零件 APP.explore._（不可列舉；只給 explore.js 與 explore-unlock.js 共用，別的區塊不要依賴）：
     這一次抵達（arrivalAt：搭車還是走路、幾公里、這次的款式）、這次抵達的款式（storedDraw 只讀／rollDraw 抽並記下）、
     關掉機率說明（closeOdds）、點數（ridePoints）與幾個小工具；explore.js 再掛上頁面零件
     （exploreHome、notFound、backFabBar、distHTML）。
   刻意沒有：畫面（/unlock 在 explore-unlock.js）、特效（explore-fx.js 的 APP.fx）。

   數字一律從 STATE／MOCK／APP.fmt 算；按鈕一律 element.onclick；動作鈕帶 data-act。
   ========================================================================== */

(function () {
'use strict';

const APP = window.APP;
if (!APP) return;

const esc = APP.esc;
const fmt = APP.fmt;

/* ---------------------------------------------------------------- 小工具 */

function M() { return window.MOCK || {}; }
function S() { return window.STATE; }

function collected(p) { return !!(p && p.card && S() && S().has(p.card)); }

function num(n) { return '<span class="num">' + esc(n) + '</span>'; }

/* 搭車抵達走不到的地方回饋的點數：唯一來源是 ride.js 的 APP.ride.RIDE_BONUS（/points 的明細也用它）。
   ride 還沒匯出時退回 MOCK.FAR_PLACE.ridePoints（資料裡同一個數） */
function ridePoints() {
  const R = APP.ride && APP.ride.RIDE_BONUS;
  if (typeof R === 'number') return R;
  return (window.MOCK && MOCK.FAR_PLACE && MOCK.FAR_PLACE.ridePoints) || 50;
}

/* 抽卡機率表（全 app 唯一來源；畫面上的百分比都從這裡算，不另外手寫）。
   每個地方五款：四種一般畫風，越後面越難抽；一款金框（yoxi 限定版），搭 yoxi 抵達必得，走路抵達機率極低。
   權重用千分比，避免浮點誤差；walk 與 ride 各自加總都是 1000。
   畫風之後會以該地的景點照片為底、用 diffusion 生成；現在的原型先用濾鏡示意（explore.css 的 [data-style]）。 */
const DRAW_STYLES = [
  { key: 'watercolor', name: '水彩',     walk: 450, ride: 0 },
  { key: 'oil',        name: '油畫',     walk: 300, ride: 0 },
  { key: 'woodcut',    name: '木刻版畫', walk: 165, ride: 0 },
  { key: 'ink',        name: '水墨',     walk: 80,  ride: 0 },
  { key: 'gold',       name: 'yoxi 金框', walk: 5,   ride: 1000, gold: true },
];

/* 依抵達方式與 r ∈ [0, 1) 抽一款（純函式，給測試與機率頁用） */
function drawStyle(by, r) {
  const k = by === 'ride' ? 'ride' : 'walk';
  const total = DRAW_STYLES.reduce(function (a, d) { return a + d[k]; }, 0);
  let x = Math.min(Math.max(Number(r) || 0, 0), 0.999999) * total;
  for (let i = 0; i < DRAW_STYLES.length; i++) {
    x -= DRAW_STYLES[i][k];
    if (x < 0) return DRAW_STYLES[i];
  }
  return DRAW_STYLES[0];
}

function styleOf(key) {
  return DRAW_STYLES.filter(function (d) { return d.key === key; })[0] || null;
}

/* 千分比 → 「45%」「16.5%」 */
function oddsPct(w) { return (Math.round(w) / 10) + '%'; }

/* 這一次抵達的款式（只讀；render 用這個）：搭 yoxi 抵達必得金框；走路抵達看 store.draws，
   還沒抽就是 null（畫面先是卡背，mount 抽完再畫） */
function storedDraw(p, isRide) {
  if (isRide) return drawStyle('ride', 0);
  return styleOf((APP.store.get('draws') || {})[p.id]);
}
/* 這一次抵達（只讀）：搭 yoxi 抵達這裡的那一趟（行程 module 說了算）、搭車還是走路、幾公里、這次的款式
   （走路還沒抽是 null）。/unlock 的畫面與 collect 都用這一個答案。 */
function arrivalAt(p) {
  const trip = p ? APP.ride.trip.arrivedAt(p.id) : null;
  return {
    trip: trip,
    by: trip ? 'ride' : 'walk',
    km: trip && trip.km != null ? trip.km : fmt.km(p && p.dist),
    draw: p ? storedDraw(p, !!trip) : null,
  };
}
/* 走路抵達抽一款，結果記在 store.draws（地點 id → key）。只在 mount 與收下時呼叫（契約 §3.1：render 不寫 store）。
   重整或返回再進來都是同一張，不能靠重開頁面重抽；收下之後清掉，下次抵達重新抽。 */
function rollDraw(p) {
  const had = storedDraw(p, false);
  if (had) return had;
  const d = drawStyle('walk', Math.random());
  APP.store.set('draws', Object.assign({}, APP.store.get('draws') || {}, { [p.id]: d.key }));
  return d;
}

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
/* 明信片的底圖照片：明信片自己的一張（p10、p19…）→ 所在地點的（station…）。照片與授權在 prototype/assets/photos/credits.js */
const CARD_PHOTO = { p1: 'station', p2: 'market', p3: 'moat', p4: 'harbour', p5: 'rail', p6: 'hill', p7: 'temple',
                     p8: 'lake', p9: 'neiwan', p11: 'glass-kiln', p20: 'brick' };
function cardPhoto(cardId) {
  const P = window.PHOTOS;
  if (!cardId || !P || !P.get) return null;
  return P.get(cardId, 0) || P.get(CARD_PHOTO[cardId], 0) || null;
}
/* 收下的明信片是哪一款：抽到的（store.cardStyle）→ 沒有紀錄的（demo 一開始就有的 8 張）：
   搭車收的是金框；走路的照機率表、用明信片 id 當種子抽一次（每次打開都一樣） */
function cardStyleOf(cardId) {
  const had = styleOf((APP.store.get('cardStyle') || {})[cardId]);
  if (had) return had;
  const c = S() && S().card(cardId);
  if (!c) return null;
  if (c.by === 'ride') return styleOf('gold');
  let h = 7;
  String(cardId).split('').forEach(function (ch) { h = (h * 31 + ch.charCodeAt(0)) % 100003; });
  const goldW = styleOf('gold').walk;
  return drawStyle('walk', ((h * 7919) % 1000) / 1000 * (1 - goldW / 1000));
}

/* 別的畫面（收藏、叫車首頁的卡片）要顯示「收下的那一張」：元素帶 data-card-art="<明信片 id>"，
   這裡把那一款疊在插圖上面，跟 /unlock 的卡面同一個順序：
     生成好的成品（POSTCARD_GEN 裡的）→ 沒有成品、或成品載不到：底圖照片＋那一款的 SVG 濾鏡 → 都沒有才是插圖。
   以前沒有第二步：p12–p22 還沒生成成品，抽卡時看到的是實景照片做的卡面，收下之後收藏裡卻變回插圖。
   還沒收的不疊（維持灰階插圖，「到了就會上色」）。
   金框那一款在哪裡顯示都有金框和金粉（explore-gold.js）：畫面自己標了 data-gold-aura（框畫在外層）就照它的，
   沒標的這裡補上 data-gold-aura＋.card-gold（通用的框，explore.css） */
function paintCardArt(root) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('[data-card-art]:not([data-card-painted])').forEach(function (el) {
    const id = el.getAttribute('data-card-art');
    el.setAttribute('data-card-painted', '');
    if (!S() || !S().has(id)) return;
    const d = cardStyleOf(id);
    if (d && d.gold && !el.closest('[data-gold-aura]')) {
      el.classList.add('card-gold');
      el.setAttribute('data-gold-aura', '');
    }
    const src = postcardSrc(id, d && d.key);
    const ph = cardPhoto(id);
    const photo = ph && window.PHOTOS ? window.PHOTOS.base + ph.file : '';
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
   所以照片一律先排成 PHOTO_W 寬（高照容器的比例）、套濾鏡，再整張縮放到容器大小：哪裡看起來都跟抽到時一樣。
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
(function watchCardArt() {
  const view = document.getElementById('view');
  if (!view || !window.MutationObserver) return;
  let queued = false;
  new MutationObserver(function () {
    if (queued) return;
    queued = true;
    Promise.resolve().then(function () { queued = false; paintCardArt(view); });
  }).observe(view, { childList: true, subtree: true });
})();

/* 收在「?」裡的機率說明。掛在 .device 上（壓在全螢幕的解鎖頁上面），所以離開這一頁要自己收：
   帶 data-overlay、el._dismiss()（core 導覽前會呼叫；/unlock 的 cleanup 也呼叫 closeOdds），可以重複呼叫。
   Esc 與焦點交給 APP.ui.a11yDialog；它在點「?」時才掛 keydown，router 記不到，所以一定要經過 _dismiss 拆掉。 */
let oddsOpen = null;
function openOdds() {
  if (oddsOpen && oddsOpen.isConnected) return oddsOpen;
  const host = document.querySelector('.device') || document.body;
  const rows = function (k) {
    return DRAW_STYLES.map(function (d) {
      return '<li class="ex-odds__row' + (d.gold ? ' is-gold' : '') + '">' +
        '<span>' + esc(d.name) + '</span><span class="num">' + esc(oddsPct(d[k])) + '</span></li>';
    }).join('');
  };
  const scrim = document.createElement('div');
  scrim.className = 'scrim ex-odds';
  scrim.setAttribute('data-overlay', '');
  scrim.innerHTML =
    '<div class="modal app-modal ex-odds__box">' +
      '<h2 class="ex-odds__t">明信片抽取機率</h2>' +
      '<p class="ex-odds__p">每個地方有 ' + num(DRAW_STYLES.length) + ' 款明信片，抵達時依抵達方式抽出一款。</p>' +
      '<h3 class="ex-odds__h">走路抵達</h3><ul class="ex-odds__list" data-odds="walk">' + rows('walk') + '</ul>' +
      '<h3 class="ex-odds__h">搭 yoxi 抵達</h3><ul class="ex-odds__list" data-odds="ride">' + rows('ride') + '</ul>' +
      '<p class="ex-odds__note">機率固定，不因抵達次數改變。畫風以該地景點照片為底，由 AI 生成。</p>' +
      '<button class="btn-primary" type="button" data-act="close-odds">知道了</button>' +
    '</div>';
  let release = null;
  const end = function () {
    if (oddsOpen === scrim) oddsOpen = null;
    scrim.remove();
    if (release) { const r = release; release = null; r(); }
  };
  scrim._dismiss = end;
  scrim.querySelector('[data-act="close-odds"]').onclick = end;
  scrim.onclick = function (e) { if (e.target === scrim) end(); };
  host.appendChild(scrim);
  oddsOpen = scrim;
  release = APP.ui.a11yDialog(scrim.querySelector('.modal'), { label: '明信片抽取機率', onEsc: end });
  return scrim;
}
function closeOdds() {
  if (oddsOpen && oddsOpen._dismiss) oddsOpen._dismiss();
  oddsOpen = null;
}

/* ---------------------------------------------------------------- APP.explore */

/**
 * 收下一張明信片（契約 §7）。placeId 可以是地點 id 或明信片 id；回傳是否為新收。
 * 呼叫的人只給那一句話（note），其餘都在這裡判斷，跟 /unlock 畫面上看到的是同一個答案：
 *   - 搭車還是走路：行程 module 說這一趟搭 yoxi 抵達這裡（APP.ride.trip.arrivedAt）就是搭車，否則走路；
 *   - 哪一款：搭車必得金框；走路是這次抵達抽到的那一款（store.draws，還沒抽就在這裡抽）；
 *   - 幾公里：搭車用這一趟的公里數，走路用地方的距離（距離不明是 0，跟以前一樣）。
 * 搭車收下才用掉這一趟（行程 module 順便記下 rideVia 歸因）；走路收別的地方不碰行程——還沒領的限定版
 * （金框＋點數）不會跟著消失。同一個地方有搭車抵達的那一趟時一律算搭車（/unlock 也是這樣畫的）。
 */
function collect(placeId, opt) {
  opt = opt || {};
  const p = APP.place(placeId);
  const pid = p ? p.id : placeId;
  const target = (p && p.card) || placeId;
  const a = arrivalAt(p);
  const drawn = a.trip ? a.draw : (p ? rollDraw(p) : null);
  const isNew = S().collect(target, {
    by: a.by,
    note: opt.note || '',
    km: a.km,
    date: fmt.todayMMDD(),
  });
  /* 抽到的款式記在 app store（STATE 的卡片結構不動）；這次抵達的暫存抽卡用完就清 */
  if (isNew && drawn) {
    APP.store.set('cardStyle', Object.assign({}, APP.store.get('cardStyle') || {}, { [target]: drawn.key }));
  }
  const draws = APP.store.get('draws');
  if (draws && (draws[pid] || draws[placeId])) {
    const rest = Object.assign({}, draws);
    delete rest[pid]; delete rest[placeId];
    APP.store.set('draws', rest);
  }
  if (a.trip) APP.ride.trip.consume(placeId);
  const drop = APP.store.get('dropoff');
  if (drop && (drop.id === pid || drop.id === placeId)) APP.store.set('dropoff', null);
  /* demo 面板「模擬抵達」留下的暫存：收下之後就用完了 */
  const arrived = APP.store.get('arrivedDemo');
  if (arrived && (arrived === pid || arrived === placeId)) APP.store.set('arrivedDemo', null);
  APP.emit('state:change');
  return isNew;
}

/**
 * 收下的那一張是怎麼來的（還沒收是 null）。收藏、叫車的浮起來小卡、探索的「已收藏」一行都讀這個，
 * 不各自去翻 STATE 的 by、store.cardStyle、store.rideVia：
 *   { id, date, note, km, by:'walk'|'ride', style（DRAW_STYLES 的一款）, via（搭車的轉換歸因或 null）,
 *     limited（yoxi 限定版：ride.js 的判斷，搭 yoxi 去走不到的地方、+50 點）,
 *     gold（畫金框：抽到金框那一款，或是限定版——限定版一定是金框，金框不一定是限定版） }
 */
function cardOrigin(cardId) {
  const c = S() && S().card(cardId);
  if (!c) return null;
  const style = cardStyleOf(cardId);
  const limited = !!(APP.ride && APP.ride.limitedCard && APP.ride.limitedCard(cardId));
  return {
    id: cardId, date: c.date, note: c.note, km: c.km,
    by: c.by === 'ride' ? 'ride' : 'walk',
    style: style,
    gold: limited || !!(style && style.gold),
    limited: limited,
    via: (APP.store.get('rideVia') || {})[cardId] || null,
  };
}

APP.explore = Object.assign(APP.explore || {}, {
  collect: collect,
  cardOrigin: cardOrigin,
  /* 抽卡：機率表、純抽取函式、機率說明（契約 §7） */
  DRAW_STYLES: DRAW_STYLES,
  drawStyle: drawStyle,
  /* 生成好的明信片（收藏與叫車首頁用 data-card-art 掛上來） */
  cardStyleOf: cardStyleOf,
  postcardSrc: postcardSrc,
  cardPhoto: cardPhoto,
  paintCardArt: paintCardArt,
  openOdds: openOdds,
});

/* explore 三支檔案共用的內部零件。不可列舉：Object.keys(APP.explore) 跟拆檔前一模一樣 */
Object.defineProperty(APP.explore, '_', {
  enumerable: false,
  value: {
    M: M, S: S, collected: collected, num: num,
    ridePoints: ridePoints,
    styleOf: styleOf, oddsPct: oddsPct, storedDraw: storedDraw, rollDraw: rollDraw, arrivalAt: arrivalAt,
    closeOdds: closeOdds,
  },
});

})();
