/* ==========================================================================
   yoxi 城事 web app — explore 區塊（探索分頁）
   契約：app/ARCHITECTURE.md §3、§4、§5、§7、§8。只用 APP.view() 註冊，不改 app.js。

   這支檔案註冊七個畫面，並提供 APP.explore.collect()（ride 的限定版解鎖也用）：

   /explore        探索首頁（X2 缺口導向＋今天的地方）
     回答什麼：今天出門去哪？收藏裡還缺什麼、可以順便補哪一張？
     原型：variant-x2-explore.html（缺口）、explore.html（今天的地方、路線、還沒去）、
           variant-l1-explore.html（一屏一事：可按數 ≤ 12，超過就砍列而不是塞更多）
     刻意沒有：百分比、進度環、勾選清單、「最快集滿」的排序理由、倒數與限量。
               缺口是一句陳述（你還沒有『水路』這一組的 1 張），不是一張待辦清單。
   /explore/map    探索地圖（真實新竹 HSMAP paper，≤ 10 景點，點圖釘浮出小卡）
     原型：map.html、concept-map-explore.html
     刻意沒有：超過 10 顆的景點、隨縮放長出來的東西、「X 分鐘後消失」。
   /place/:id      地方詳情（K1：內容頁設為下車點）
     原型：variant-k1-place.html、place.html（?id=neiwan 的主次對調）
     門檻統一 3 km（APP.fmt.WALK_MAX_M）：走得到主「走路前往」、次「設為下車點」；走不到對調。
     刻意沒有：進度環（X4 不用環，寫「收集 n/m」）、折扣／限時等行銷字。
   /going/:id      前往中（走路）
     原型：going.html —— 這一頁刻意什麼都不做。
     刻意沒有：倒數、步數、沿途收集物、任何進度。只說「到了會響」與抵達怎麼驗。
     已經搭 yoxi 抵達這裡、明信片還沒收：不帶路，直接給「收下這張明信片」（→ /unlock/:id?ride=1）。
   /unlock/:id     抵達 → 收集 → 抽卡（搭 yoxi 抵達必得金框。是不是搭車看 store.trip——這個地方、phase done；
                   網址的 ?ride=1 只是入口的記號，手打拿不到金框，少了它也不會把還沒領的限定版當成走路收掉）
     幕一（data-at=1）：夜色地圖上這個地方亮起光柱；點它拉出「收集明信片」面板。
     抽卡（data-at=2）：卡背升起 → 蓄力（拍數＝稀有度）→ 點一下翻開 → 依款式給特效（金框最重）。
     結果（data-at=3）：卡面＋畫風名＋出現機率、一句話、收進收藏。已收過、still、減少動態效果（APP.reduceMotion）直接停在結果。
     特效工具在 explore-fx.js（APP.fx）；點畫面可以快轉：蓄力中 → 可以翻、翻開中 → 結果。
     鍵盤與報讀器：按下「收集明信片」焦點移到「跳過動畫」（平常看不到，鍵盤焦點才浮出來）；抽完焦點移到「抽到 ○○」那一行。
     走路抵達的抽卡在 mount 做（render 是純函式），結果記在 store.draws，重整、返回都不重抽。
     結果頁不會一直動：金粉飄幾秒就停、光芒與全息掃光有限次；離開這一頁音效（sfx.stopAll）與機率說明一起收掉。
     「回探索」與找不到、返回的保底都回叫車首頁的探索模式（/ride?mode=explore&area=<id>），不回舊的 /explore。
     原型：unlock.html（三幕解鎖的前身）。
     刻意沒有：分享鈕（分享在明信片頁，這一頁只做「收下」一件事）、司機姓名（MOCK 沒有這筆資料，不編）。
     抽卡：每個地方五款（四種畫風＋金框），抵達時抽一款。搭 yoxi 抵達必得金框；走路抵達照 DRAW_STYLES 的機率。
     機率依法要揭露，但不擺在畫面上搶戲：收在收集面板與成品右上角的「?」裡（data-act="open-odds"）。
   /routes         這個月的路線
     原型：routes.html
   /route/:id      路線詳情（站點軌道；斷點處可設為下車點，K4 精神）
     原型：route.html、variant-k4-route.html
     刻意沒有：進度環、「還差幾站」、期限。斷點不是關卡，只是腳到不了的地方。

   數字一律從 STATE／MOCK／APP.fmt 算；按鈕一律 element.onclick；動作鈕帶 data-act。
   ========================================================================== */

(function () {
'use strict';

const APP = window.APP;
if (!APP) return;

const esc = APP.esc;
const fmt = APP.fmt;

/* 抵達驗證的兩個數字：契約 §5 的文案規定（80 公尺內停 1 分鐘），全頁只寫在這裡 */
const ARRIVE_RADIUS_M = 80;
const ARRIVE_STAY_MIN = 1;
/* 搭車抵達走不到的地方回饋的點數：唯一來源是 ride.js 的 APP.ride.RIDE_BONUS（/points 的明細也用它）。
   ride 還沒匯出時退回 MOCK.FAR_PLACE.ridePoints（資料裡同一個數） */
function ridePoints() {
  const R = APP.ride && APP.ride.RIDE_BONUS;
  if (typeof R === 'number') return R;
  return (window.MOCK && MOCK.FAR_PLACE && MOCK.FAR_PLACE.ridePoints) || 50;
}
/* 收下時寫的一句話最多幾個字：輸入框的 maxlength、提示文字、收下時的截斷都讀這一個 */
const NOTE_MAX = 40;
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
   這裡把那一款的成品疊在插圖上面；圖載不到就拿掉，插圖照舊。還沒收的不疊（維持灰階插圖）。 */
function paintCardArt(root) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('[data-card-art]:not([data-card-painted])').forEach(function (el) {
    const id = el.getAttribute('data-card-art');
    el.setAttribute('data-card-painted', '');
    if (!S() || !S().has(id)) return;
    const d = cardStyleOf(id);
    const src = postcardSrc(id, d && d.key);
    if (!src) return;
    const img = document.createElement('img');
    img.className = 'card-gen';
    img.alt = '';
    img.decoding = 'async';
    img.setAttribute('data-style', d.key);
    img.onerror = function () { img.remove(); };
    img.src = src;
    /* 放在插圖（第一個子元素）後面、「新」之類的角標前面 */
    const art = el.querySelector(':scope > .postcard__art');
    el.insertBefore(img, art ? art.nextSibling : el.firstChild);
  });
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

/* 探索首頁的可按數上限（L1 一屏一事；§6.3 第 4 條） */
const EXPLORE_TAP_MAX = 12;
/* 探索地圖的視野寬度（公尺）。新竹市區五個景點擠在 800 公尺內，
   框到南寮與竹中就會疊成一團；6.5 km 讓市區分得開，框外兩顆夾到邊緣標 edge。 */
const MAP_SPAN_M = 6500;
/* 你的位置：東區水利路（MOCK.USER.home）。hs-places 沒有這一筆，沿用 concept-map-explore 的座標 */
const HOME_LL = [24.7990, 120.9800];

/* ---------------------------------------------------------------- 小工具 */

function M() { return window.MOCK || {}; }
function S() { return window.STATE; }

function collected(p) { return !!(p && p.card && S() && S().has(p.card)); }

function num(n) { return '<span class="num">' + esc(n) + '</span>'; }

function distHTML(m) {
  if (m == null) return '距離待確認';
  const t = fmt.dist(m).split(' ');
  return num(t[0]) + ' ' + t[1];
}

/* 新 UI 的「探索」是叫車首頁的探索模式（契約 §0：底欄只有叫車與收藏，舊的 /explore 只留給舊連結）。
   找不到、返回的保底、「回探索」一律回這裡；知道是哪個地方就帶 area（ride 不認得的 area 會自己改成最近的地區） */
function exploreHome(id) {
  return '/ride?mode=explore' + (id ? '&area=' + encodeURIComponent(id) : '');
}

function notFound(o) {
  return '<div class="app-empty ex-empty">' +
    '<div class="app-empty__card app-empty__card--missing" data-ex-missing>' +
      '<p class="app-empty__eyebrow">' + esc(o.eyebrow || '找不到') + '</p>' +
      '<h1 class="app-empty__t">' + esc(o.title) + '</h1>' +
      '<p class="app-empty__p">' + esc(o.text || '') + '</p>' +
      '<a class="btn-primary" href="#' + esc(o.href || exploreHome()) + '" data-act="go-explore">' +
        esc(o.cta || '回探索') + '</a>' +
    '</div></div>';
}

function backFab(fallback) {
  return '<a class="fab ex-back" href="#" data-back="' + esc(fallback) + '" aria-label="返回">' +
    '<span class="arrow arrow--left"></span></a>';
}

function trackMini(done, total) {
  let s = '';
  for (let n = 0; n < total; n++) {
    if (n) s += '<i class="track-mini__link' + (n < done ? ' is-done' : '') + '"></i>';
    s += '<i class="track-mini__node' + (n < done ? ' is-done' : '') + '"></i>';
  }
  return s;
}

/* 地方所屬的獎章（獎章清單放明信片 id，要先換過去） */
function badgeOf(p) {
  if (!p || !p.card) return null;
  const b = (M().BADGES || []).filter(function (x) { return x.ids.indexOf(p.card) >= 0; })[0];
  return b ? S().badge(b.id) : null;
}

/* 路線 id → MOCK.ROUTES 的那一條（找不到回 null） */
function routeById(id) {
  return (M().ROUTES || []).filter(function (r) { return r.id === id; })[0] || null;
}

/* 地方所屬的路線（依明信片 id 比對站點） */
function routeOf(p) {
  if (!p) return null;
  return (M().ROUTES || []).filter(function (r) {
    return r.stops.some(function (st) { return st.card && st.card === p.card; });
  })[0] || null;
}

/* 車程的三個數字：km、車資、分鐘 —— 全部公式 */
function rideOf(p) {
  const km = fmt.km(p.dist);
  return { km: km, fare: fmt.fare(km), min: fmt.rideMin(km) };
}

/* 設為下車點：一律交給 ride 提供的 APP.ride.setDropoff（契約 §7；ride.js 在前面載入）。
   不另寫一份：行程中不准改目的地、連點只寫一次，這些規則都在 ride 那邊。 */
function setDropoff(id, via) {
  return !!(APP.ride && APP.ride.setDropoff && APP.ride.setDropoff(id, via));
}

/* ---------------------------------------------------------------- APP.explore */

/**
 * 收下一張明信片（契約 §7）。
 * placeId 可以是地點 id 或明信片 id；回傳是否為新收。
 */
function collect(placeId, opt) {
  opt = opt || {};
  const by = opt.by || 'walk';
  const p = APP.place(placeId);
  const target = (p && p.card) || placeId;
  const isNew = S().collect(target, {
    by: by,
    note: opt.note || '',
    km: opt.km,
    date: fmt.todayMMDD(),
  });
  const pid = p ? p.id : placeId;
  /* 抽到的款式記在 app store（STATE 的卡片結構不動）；這次抵達的暫存抽卡用完就清 */
  if (isNew && opt.style) {
    APP.store.set('cardStyle', Object.assign({}, APP.store.get('cardStyle') || {}, { [target]: opt.style }));
  }
  const draws = APP.store.get('draws');
  if (draws && (draws[pid] || draws[placeId])) {
    const rest = Object.assign({}, draws);
    delete rest[pid]; delete rest[placeId];
    APP.store.set('draws', rest);
  }
  /* 搭車收下才算用掉這一趟。走路收同一個地方不碰 trip：不然還沒領的限定版（金框＋點數）會跟著永遠消失 */
  const trip = APP.store.get('trip');
  if (by === 'ride' && trip && (trip.placeId === pid || trip.placeId === placeId)) APP.store.set('trip', null);
  const drop = APP.store.get('dropoff');
  if (drop && (drop.id === pid || drop.id === placeId)) APP.store.set('dropoff', null);
  /* demo 面板「模擬抵達」留下的暫存：收下之後就用完了 */
  const arrived = APP.store.get('arrivedDemo');
  if (arrived && (arrived === pid || arrived === placeId)) APP.store.set('arrivedDemo', null);
  APP.emit('state:change');
  return isNew;
}

APP.explore = Object.assign(APP.explore || {}, {
  collect: collect,
  /* 抽卡：機率表、純抽取函式、機率說明（契約 §7） */
  DRAW_STYLES: DRAW_STYLES,
  drawStyle: drawStyle,
  /* 生成好的明信片（收藏與叫車首頁用 data-card-art 掛上來） */
  cardStyleOf: cardStyleOf,
  postcardSrc: postcardSrc,
  cardPhoto: cardPhoto,
  paintCardArt: paintCardArt,
  openOdds: openOdds,
  /* 給別的區塊與測試用的純計算（沒有副作用） */
  gap: gapPick,
  breakpoint: function (routeId) {
    const R = routeById(routeId);
    return R ? routeModel(R).brk : null;
  },
});

/* ---------------------------------------------------------------- X2 缺口 */

/* 從還沒收齊的獎章裡挑一枚：還缺的張數最少的；同數比已收比例；再同就照 MOCK 順序。
   只挑一枚、只寫一句陳述，下面最多三個地方。 */
function gapPick() {
  let best = null;
  (M().BADGES || []).forEach(function (b, i) {
    const r = S().badge(b.id);
    if (r.got || !r.total) return;
    const miss = r.ids.filter(function (id) { return !S().has(id); });
    if (!miss.length) return;
    const places = miss.map(function (c) { return APP.place(c); }).filter(Boolean);
    if (!places.length) return;
    const cand = { badge: r, missing: miss.length, ratio: r.done / r.total, places: places, i: i };
    if (!best || cand.missing < best.missing ||
        (cand.missing === best.missing && cand.ratio > best.ratio)) best = cand;
  });
  return best;
}

/* ---------------------------------------------------------------- /explore */

function exploreHeader(on) {
  const cards = '<span data-icon="viewCards" class="ex-vt-ic"></span>卡片';
  const map = '<span data-icon="viewMap" class="ex-vt-ic"></span>地圖';
  return '<header class="hdr-red hdr-red--compact">' +
    '<div class="hdr-red__bar">' +
      '<h1 class="hdr-red__title">探索</h1>' +
      '<nav class="viewtoggle ex-viewtoggle" aria-label="檢視方式">' +
        (on === 'cards'
          ? '<span class="is-on" aria-current="page">' + cards + '</span>' +
            '<a href="#/explore/map" data-act="view-map">' + map + '</a>'
          : '<a href="#/explore" data-act="view-cards">' + cards + '</a>' +
            '<span class="is-on" aria-current="page">' + map + '</span>') +
      '</nav>' +
    '</div></header>';
}

function renderExplore() {
  const T = M().TODAY;
  const tp = APP.place(T.id);
  const got = collected(tp);
  const walk = fmt.canWalk(tp.dist);

  /* ---- 今天的地方 ---- */
  const meta = '<span>離你 ' + distHTML(tp.dist) + '</span><span class="ex-dot">·</span>' +
    (walk ? '<span>走路 ' + num(fmt.walkMin(tp.dist)) + ' 分鐘</span>'
          : '<span>搭車 ' + num(rideOf(tp).min) + ' 分鐘</span>') +
    '<span class="ex-dot">·</span><span>' + esc(tp.type) + '</span>';

  let cta;
  if (got) {
    cta = (tp.card ? '<a class="btn-primary" href="#/postcard/' + esc(tp.card) + '" data-act="open-postcard">已在收藏 · 看明信片</a>' : '') +
          '<a class="btn-ghost" href="#/place/' + esc(tp.id) + '" data-act="open-place">再看看這個地方</a>';
  } else if (walk) {
    cta = '<a class="btn-primary" href="#/going/' + esc(tp.id) + '" data-act="go-walk">走路前往</a>' +
          '<a class="btn-ghost" href="#/place/' + esc(tp.id) + '" data-act="open-place">先看看這是什麼地方</a>';
  } else {
    cta = '<button class="btn-primary" type="button" data-act="set-dropoff">用 yoxi 前往 · 約 $' + num(rideOf(tp).fare) + '</button>' +
          '<a class="btn-ghost" href="#/place/' + esc(tp.id) + '" data-act="open-place">先看看這是什麼地方</a>';
  }

  const today =
    '<section class="ex-block ex-block--white">' +
      '<div class="placecard ex-today' + (got ? ' is-got' : ' is-gray') + '">' +
        '<div class="placecard__art" data-art="' + esc(tp.art) + '" data-seed="1" data-wide>' +
          '<span class="ai-mark">AI 生成示意</span>' +
          (got ? '<span class="ex-got">已收藏</span>' : '') +
          '<span class="placecard__scrim"></span>' +
          '<span class="placecard__body">' +
            '<span class="placecard__eyebrow">今天的地方</span>' +
            '<span class="placecard__name">' + esc(tp.name) + '</span>' +
            '<span class="placecard__hook">' + esc(tp.hook) + '</span>' +
            '<span class="placecard__meta">' + meta + '</span>' +
          '</span>' +
        '</div>' +
      '</div>' +
      '<div class="why ex-why">' +
        '<button class="why__head" type="button" data-act="toggle-why" aria-expanded="false">' +
          '<span class="u-row u-gap2"><span data-icon="sun" class="ex-ic18"></span>為什麼推薦給你</span>' +
          '<span class="arrow ex-why__arrow"></span>' +
        '</button>' +
        '<div class="why__list" data-why-list hidden>' +
          (tp.why || []).map(function (w) {
            return '<div class="why__item"><span class="why__src">' + esc(w.src) + '</span>' + esc(w.text) + '</div>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="ex-cta">' + cta + '</div>' +
    '</section>';

  /* ---- 可按數預算：固定 = 切換 1 ＋ 為什麼 1 ＋ 雙 CTA 2 ＋ 路線（2 張＋全部）3 ---- */
  const routes = pickRoutes();
  let used = 1 + 1 + (got && !tp.card ? 1 : 2) + routes.length + 1;

  /* ---- X2 缺口 ---- */
  const g = gapPick();
  let gapHTML = '';
  if (g) {
    const chips = g.places.slice(0, 3);
    used += chips.length;
    gapHTML =
      '<section class="ex-block ex-gap" data-gap="' + esc(g.badge.id) + '">' +
        '<div class="sec"><h2 class="sec__t">你的收藏還缺什麼</h2></div>' +
        '<p class="ex-gap__line">你還沒有『' + esc(g.badge.name) + '』這一組的 ' + num(g.missing) + ' 張</p>' +
        '<p class="ex-gap__sub">收集 ' + num(g.badge.done) + '/' + esc(g.badge.total) + ' · 不會過期，也沒有先後</p>' +
        '<div class="ex-chips">' +
          chips.map(function (p, i) {
            return '<a class="ex-chip" href="#/place/' + esc(p.id) + '" data-act="open-place" data-gap-place="' + esc(p.id) + '">' +
              '<span class="ex-chip__img" data-art="' + esc(p.art) + '" data-seed="' + (11 + i) + '"></span>' +
              '<span class="ex-chip__body">' +
                '<span class="ex-chip__t">' + esc(p.name) + '</span>' +
                '<span class="ex-chip__s">' + distHTML(p.dist) + '</span>' +
              '</span></a>';
          }).join('') +
        '</div>' +
      '</section>';
  }

  /* ---- 這個月的路線 ---- */
  const routeHTML =
    '<section class="ex-block">' +
      '<div class="sec"><h2 class="sec__t">這個月的路線</h2>' +
        '<a class="sec__m u-row u-gap2" href="#/routes" data-act="open-routes">全部 <span class="arrow"></span></a></div>' +
      '<div class="hscroll">' +
        routes.map(function (r, i) {
          const done = S().routeDone(r.id);
          return '<a class="card ex-rcard" href="#/route/' + esc(r.id) + '" data-act="open-route">' +
            '<span class="ex-rcard__art" data-art="' + esc(r.art) + '" data-seed="' + (i + 3) + '" data-wide></span>' +
            '<span class="ex-rcard__body">' +
              '<span class="ex-rcard__t">' + esc(r.name.split('：')[0]) + '</span>' +
              '<span class="ex-rcard__s">' + esc(r.sub) + '</span>' +
              '<span class="track-mini ex-track">' + trackMini(done, r.total) +
                '<span class="ex-track__n">' + num(done) + '/' + esc(r.total) + '</span></span>' +
            '</span></a>';
        }).join('') +
      '</div>' +
    '</section>';

  /* ---- 還沒去的地方：剩下的預算給它（至少一列，最多三列） ---- */
  used += 1;   /* 在地圖上看 */
  const rows = Math.max(1, Math.min(3, EXPLORE_TAP_MAX - used));
  const pending = (M().PENDING || []).filter(function (p) {
    const q = APP.place(p.id);
    return q && !collected(q);
  }).slice(0, rows);
  const pendHTML =
    '<section class="ex-block ex-block--last">' +
      '<div class="sec"><h2 class="sec__t">還沒去的地方</h2>' +
        '<a class="sec__m u-row u-gap2" href="#/explore/map" data-act="view-map">在地圖上看 <span class="arrow"></span></a></div>' +
      (pending.length
        ? '<div class="card">' + pending.map(function (p, i) {
            const q = APP.place(p.id);
            return '<a class="row-nav ex-row" href="#/place/' + esc(q.id) + '" data-act="open-place">' +
              '<span class="ex-row__img" data-art="' + esc(q.art) + '" data-seed="' + (i + 5) + '"></span>' +
              '<span class="row-nav__body">' +
                '<span class="row-nav__title">' + esc(q.name) + '</span>' +
                '<span class="row-nav__sub">' + distHTML(q.dist) + (p.ago ? ' · ' + esc(p.ago) : '') + '</span>' +
              '</span><span class="arrow"></span></a>';
          }).join('') + '</div>'
        : '<p class="ex-note">推薦過的地方你都去過了。</p>') +
      '<p class="ex-note">推薦過的地方會一直留在這裡，不會過期。</p>' +
    '</section>';

  return exploreHeader('cards') +
    '<div class="scroll ex-scroll">' + today + gapHTML + routeHTML + pendHTML + '</div>';
}

/* 首頁放兩條：還沒走完的優先，其餘照 MOCK 順序補 */
function pickRoutes() {
  const all = M().ROUTES || [];
  const open = all.filter(function (r) { return S().routeDone(r.id) < r.total; });
  const rest = all.filter(function (r) { return open.indexOf(r) < 0; });
  return open.concat(rest).slice(0, 2);
}

function mountExplore(root) {
  const btn = root.querySelector('[data-act="toggle-why"]');
  const list = root.querySelector('[data-why-list]');
  if (btn && list) {
    btn.onclick = function () {
      const open = list.hidden;
      list.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.classList.toggle('is-open', open);
    };
  }
  const dd = root.querySelector('[data-act="set-dropoff"]');
  if (dd) dd.onclick = function () { setDropoff(M().TODAY.id, 'k1'); };
}

/* ---------------------------------------------------------------- /explore/map */

function renderMap() {
  return exploreHeader('map') +
    '<div class="ex-mapwrap" data-ex-map>' +
      '<div class="peek peek--stack ex-peek" data-peek aria-live="polite">' +
        '<div class="ex-peek__top">' +
          '<span class="peek__img" data-peek-img></span>' +
          '<span class="u-fill ex-peek__txt">' +
            '<span class="ex-peek__name" data-peek-name></span>' +
            '<span class="ex-peek__meta" data-peek-meta></span>' +
            '<span class="ex-peek__hook" data-peek-hook></span>' +
          '</span>' +
        '</div>' +
        '<div class="peek__acts" data-peek-acts></div>' +
      '</div>' +
    '</div>';
}

function mountMap(root) {
  const wrap = root.querySelector('[data-ex-map]');
  const peek = root.querySelector('[data-peek]');
  const spots = (M().SPOTS || []).slice(0, 10);
  let openId = null;

  function show(s) {
    const p = APP.place(s.id);
    if (!p) return;
    if (openId === p.id && peek.classList.contains('is-on')) {
      peek.classList.remove('is-on'); openId = null; markSpot(null); return;
    }
    openId = p.id;
    markSpot(s.id);
    const got = collected(p) || s.state === 'seen';
    const img = peek.querySelector('[data-peek-img]');
    img.innerHTML = SHELL.postcardArt(p.art, { seed: 2 });
    img.classList.toggle('is-gray', !got);
    peek.querySelector('[data-peek-name]').textContent = p.name;
    peek.querySelector('[data-peek-meta]').innerHTML = esc(p.type) + ' · ' + distHTML(p.dist);
    peek.querySelector('[data-peek-hook]').textContent = p.hook || s.hook || '';
    const acts = peek.querySelector('[data-peek-acts]');
    const walk = fmt.canWalk(p.dist);
    acts.innerHTML =
      '<a class="btn-ghost" href="#/place/' + esc(p.id) + '" data-act="open-place">看看這個地方</a>' +
      (walk
        ? '<a class="btn-primary" href="#/going/' + esc(p.id) + '" data-act="go-walk">走路前往</a>'
        : '<button class="btn-primary" type="button" data-act="set-dropoff">設為下車點</button>');
    const dd = acts.querySelector('[data-act="set-dropoff"]');
    if (dd) dd.onclick = function () { setDropoff(p.id, 'e'); };
    peek.setAttribute('data-peek-id', p.id);
    peek.classList.add('is-on');
  }

  /* 選到的景點放大（樣式在 app.css 的 .app-map .spot.is-selected） */
  function markSpot(id) {
    if (!m) return;
    m.spotsEl.querySelectorAll('.spot').forEach(function (el) {
      el.classList.toggle('is-selected', !!id && el.getAttribute('data-spot') === id);
    });
  }

  let m = null;
  m = APP.map.mount(wrap, {
    style: 'paper',
    center: 'station',
    spanM: MAP_SPAN_M,
    spots: spots,
    max: 10,
    pan: true,
    overlay:
      '<div class="pin ex-me" data-ex-me><span class="pin__drop ex-me__drop"><span data-icon="hail" class="ex-ic20"></span></span></div>' +
      '<button class="fab ex-locate" type="button" data-recenter aria-label="回到你的位置"><span data-icon="locate"></span></button>',
    onSpot: function (s) { show(s); },
  });
  placeMe(m, root.querySelector('[data-ex-me]'));
  SHELL.injectIcons(wrap);
  spreadSpots(m);

  /* 一打開就有一個明確的答案：先開今天的地方 */
  const today = m.spots.filter(function (s) { return s.state === 'today'; })[0] || m.spots[0];
  if (today) show(today);

  return function () { m.destroy(); };
}

/* 市中心的景點（舊城區一帶）真實座標只差一兩百公尺，縮圖會疊成一團。
   mount 後量每顆 .spot 的實際大小，兩兩重疊就沿著圓心連線各推開一半，反覆幾輪；
   推的時候夾在地圖框內（頂部留給頁首）。跟 ride.js 的 keepClear 同一個想法：寧可離真實位置遠一點，也不要疊。 */
function spreadSpots(m) {
  const layer = m.spotsEl;
  const box = layer.getBoundingClientRect();
  if (!box.width || !box.height) return;
  const els = Array.prototype.slice.call(layer.querySelectorAll('.spot'));
  const it = els.map(function (el) {
    const r = el.getBoundingClientRect();
    return { el: el, w: r.width, h: r.height,
             x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2,
             dx: 0, dy: 0 };
  });
  const GAP = 4;
  for (let round = 0; round < 60; round++) {
    let moved = false;
    for (let i = 0; i < it.length; i++) for (let j = i + 1; j < it.length; j++) {
      const a = it[i], b = it[j];
      const ox = (a.w + b.w) / 2 + GAP - Math.abs(a.x - b.x);
      const oy = (a.h + b.h) / 2 + GAP - Math.abs(a.y - b.y);
      if (ox <= 0 || oy <= 0) continue;
      moved = true;
      /* 沿重疊較小的軸推開（位移最少）；完全同點時往左右分 */
      if (ox < oy) {
        const sx = (a.x < b.x || (a.x === b.x && i < j)) ? -1 : 1;
        a.x += sx * ox / 2; b.x -= sx * ox / 2;
      } else {
        const sy = (a.y < b.y || (a.y === b.y && i < j)) ? -1 : 1;
        a.y += sy * oy / 2; b.y -= sy * oy / 2;
      }
    }
    it.forEach(function (s) {
      s.x = Math.max(s.w / 2 + 4, Math.min(box.width - s.w / 2 - 4, s.x));
      s.y = Math.max(s.h / 2 + 64, Math.min(box.height - s.h / 2 - 4, s.y));
    });
    if (!moved) break;
  }
  it.forEach(function (s) {
    const r = s.el.getBoundingClientRect();
    const cx = r.left - box.left + r.width / 2, cy = r.top - box.top + r.height / 2;
    const dx = s.x - cx, dy = s.y - cy;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    const L = parseFloat(s.el.style.left) || 0, T = parseFloat(s.el.style.top) || 0;
    s.el.style.left = (L + dx / box.width * 100).toFixed(2) + '%';
    s.el.style.top = (T + dy / box.height * 100).toFixed(2) + '%';
  });
}

/* 你的位置：投影到地圖上；出框或壓在某顆景點上（HOME 跟玻璃窯幾乎同一點）就不畫 */
function placeMe(m, pin, xy) {
  if (!pin) return;
  const q = xy ? m.handle.projectM(xy[0], xy[1]) : m.handle.project(HOME_LL[0], HOME_LL[1]);
  const W = m.handle.width, H = m.handle.height;
  const onSpot = (m.spots || []).some(function (s) { return Math.hypot(s.px - q[0], s.py - q[1]) < 40; });
  if (q[0] > 0 && q[0] < W && q[1] > 60 && q[1] < H && !onSpot) {
    pin.style.left = (q[0] / W * 100).toFixed(1) + '%';
    pin.style.top = (q[1] / H * 100).toFixed(1) + '%';
  } else {
    pin.hidden = true;
  }
}

/* ---------------------------------------------------------------- /place/:id */

function renderPlace(params) {
  const p = APP.place(params.id);
  if (!p) {
    return backFabBar(exploreHome()) + notFound({ title: '找不到這個地方',
      text: '這個地方可能還沒寫好內容，或網址打錯了。先回探索看看附近的地方。' });
  }
  const got = collected(p);
  const hasDist = p.dist != null;
  const walk = hasDist && fmt.canWalk(p.dist);
  const r = hasDist ? rideOf(p) : null;

  const meta = !hasDist ? '<span>距離待確認</span>'
    : walk
      ? '<span>離你 ' + distHTML(p.dist) + '</span><span>·</span><span>走路 ' + num(fmt.walkMin(p.dist)) + ' 分鐘</span>'
      : '<span>離你 ' + distHTML(p.dist) + '</span><span>·</span><span>搭車 ' + num(r.min) + ' 分鐘</span>' +
        '<span>·</span><span>車資約 $' + num(r.fare) + '</span>';

  const b = badgeOf(p);
  const reward = got ? '' :
    '<section class="ex-pad">' +
      '<div class="sec"><h2 class="sec__t">到了會得到</h2></div>' +
      '<div class="card card--pad u-row u-gap4">' +
        '<span class="ex-reward__img is-gray" data-art="' + esc(p.art) + '" data-seed="1"></span>' +
        '<span class="u-fill">' +
          '<span class="ex-strong">一張〈' + esc(p.name) + '〉</span>' +
          '<span class="ex-muted">這個地方獨有，由 AI 依當天的光線與季節生成</span>' +
          (b ? '<span class="ex-muted">也會讓〈' + esc(b.name) + '〉多收集一張 · 收集 ' + num(b.done) + '/' + esc(b.total) + '</span>' : '') +
        '</span>' +
      '</div>' +
    '</section>';

  /* ---- K1 動作區 ---- */
  let foot;
  if (got) {
    foot = p.card
      ? '<a class="btn-primary" href="#/postcard/' + esc(p.card) + '" data-act="open-postcard">已在收藏 · 看明信片</a>'
      : '';
  } else if (!hasDist || walk) {
    foot =
      '<div class="ex-foot__row">' +
        '<a class="btn-primary" href="#/going/' + esc(p.id) + '" data-act="go-walk">走路前往</a>' +
        '<button class="btn-ghost" type="button" data-act="set-dropoff">設為下車點</button>' +
      '</div>' +
      '<p class="ex-foot__note">' + (hasDist
        ? distHTML(p.dist) + '，走過去大概 ' + num(fmt.walkMin(p.dist)) + ' 分鐘'
        : '距離待確認；設為下車點只是填好目的地，還沒叫車') + '</p>';
  } else {
    const R = routeOf(p);
    foot =
      '<button class="btn-primary ex-ride" type="button" data-act="set-dropoff">' +
        '<span class="ex-ride__t">用 yoxi 前往 · 約 $' + num(r.fare) + ' · ' + num(r.min) + ' 分</span>' +
        '<span class="ex-ride__tag">限定版 · +' + ridePoints() + ' 點</span>' +
      '</button>' +
      (R ? '<a class="btn-ghost" href="#/route/' + esc(R.id) + '" data-act="open-route">先看看路線</a>'
         : '<a class="btn-ghost" href="#/routes" data-act="open-route">看這個月的路線</a>') +
      '<p class="ex-foot__note">' + num(r.km) + ' 公里，這一段搭車比較合理。按下去只是填好下車點，還沒叫車。</p>';
  }

  return '<div class="scroll ex-place">' +
      '<div class="ex-hero' + (got ? '' : ' is-gray') + '">' +
        '<div class="ex-hero__art" data-art="' + esc(p.art) + '" data-seed="1" data-wide></div>' +
        '<span class="ai-mark ex-hero__mark">AI 生成示意</span>' +
        (got ? '' : '<span class="ex-hero__lock"><span data-icon="lock" class="ex-ic36"></span>到了才上色</span>') +
        backFab(exploreHome(p.id)) +
      '</div>' +
      '<section class="ex-pad ex-head">' +
        '<span class="ex-eyebrow">' + esc(p.type) + (p.area ? ' · ' + esc(p.area) : '') + '</span>' +
        '<h1 class="ex-name">' + esc(p.name) + '</h1>' +
        '<div class="ex-meta" data-place-meta>' + meta + '</div>' +
        (got ? gotLine(p) : '') +
      '</section>' +
      '<section class="story ex-pad">' +
        (p.story || []).map(function (s) {
          return '<div class="story__block"><div class="story__label">' + esc(s.label) + '</div>' +
            '<p class="story__text">' + esc(s.text) + '</p></div>';
        }).join('') +
      '</section>' +
      /* 已收藏：推薦理由（含 MOCK 的通用句「你從沒進去過」「圖鑑裡還沒有這一張」）已經不成立，整段不出現 */
      (!got && p.why && p.why.length
        ? '<section class="ex-pad"><div class="why">' +
            '<div class="why__head ex-why__head"><span class="u-row u-gap2"><span data-icon="sun" class="ex-ic18"></span>為什麼推薦給你</span></div>' +
            '<div class="why__list ex-why__list">' +
              p.why.map(function (w) {
                return '<div class="why__item"><span class="why__src">' + esc(w.src) + '</span>' + esc(w.text) + '</div>';
              }).join('') +
            '</div></div></section>'
        : '') +
      (p.tip || p.hours
        ? '<section class="ex-pad"><div class="card card--pad ex-tip">' +
            (p.tip ? '<div class="ex-tip__k">到了記得看</div><div class="ex-tip__t">' + esc(p.tip) + '</div>' : '') +
            (p.hours ? '<div class="ex-tip__h">' + esc(p.hours) + '</div>' : '') +
          '</div></section>'
        : '') +
      reward +
    '</div>' +
    (foot ? '<div class="ex-foot" data-place-foot>' + foot + '</div>' : '');
}

/* 已收藏那一行：日期 · 走路／搭車 */
function gotLine(p) {
  const c = p.card ? S().card(p.card) : null;
  const bits = ['已收藏'];
  if (c && c.date) bits.push(esc(c.date));
  if (c) bits.push(c.by === 'ride' ? '搭車抵達' : '走路抵達');
  return '<span class="ex-gotline" data-got-line>' + bits.join(' · ') + '</span>';
}

/* 找不到的頁面也要有返回鍵 */
function backFabBar(fallback) {
  return '<div class="ex-bar">' + backFab(fallback) + '</div>';
}

function mountPlace(root, params) {
  const p = APP.place(params.id);
  if (!p) { APP.ui.setStatus('dark'); return; }
  root.querySelectorAll('[data-act="set-dropoff"]').forEach(function (b) {
    b.onclick = function () { setDropoff(p.id, 'k1'); };
  });
}

/* ---------------------------------------------------------------- /going/:id */

/* 車已經叫了（配對中／行程中）：同時「走路前往」別的地方沒有意義。
   已抵達（phase done）的那一趟不算「進行中」：人已經下車了，可以走去別的地方；
   但如果它就是這個地方、明信片還沒收（rodeHere），就不必再走一趟，直接去收那一張。 */
function activeTrip() {
  const t = APP.store.get('trip');
  return t && t.phase !== 'done' ? t : null;
}
function rodeHere(p) { return !!rideTripFor(p) && !collected(p); }

function renderGoing(params) {
  const p = APP.place(params.id);
  if (!p) {
    return backFabBar(exploreHome()) + notFound({ title: '找不到這個地方', text: '沒有目的地就沒辦法帶路。先回探索挑一個。' });
  }
  if (rodeHere(p)) {
    return backFabBar(exploreHome(p.id)) +
      '<div class="app-empty ex-empty"><div class="app-empty__card" data-going-rode>' +
        '<p class="app-empty__eyebrow">搭 yoxi 抵達</p>' +
        '<h1 class="app-empty__t">你已經搭 yoxi 到了' + esc(p.name) + '</h1>' +
        '<p class="app-empty__p">這一趟的明信片還沒收下，不用再走一趟。</p>' +
        '<a class="btn-primary" href="#/unlock/' + encodeURIComponent(p.id) + '?ride=1" data-act="unlock-ride">收下這張明信片</a>' +
      '</div></div>';
  }
  const trip = activeTrip();
  if (trip) {
    const dest = APP.place(trip.placeId);
    return backFabBar(exploreHome(p.id)) +
      '<div class="app-empty ex-empty"><div class="app-empty__card" data-going-trip>' +
        '<p class="app-empty__eyebrow">行程進行中</p>' +
        '<h1 class="app-empty__t">你正在搭車前往 ' + esc(dest ? dest.name : '目的地') + '</h1>' +
        '<p class="app-empty__p">先抵達或取消這一趟，再走路去' + esc(p.name) + '。</p>' +
        '<a class="btn-primary" href="#/trip" data-act="go-trip">回到行程</a>' +
      '</div></div>';
  }
  const hasDist = p.dist != null;
  return '<div class="ex-going__map" data-going-map>' +
      '<div class="ex-going__top">' +
        '<span class="tile-icon ex-going__ic"><span data-icon="steps" class="ex-ic22"></span></span>' +
        '<span class="u-fill">' +
          '<span class="ex-going__d" data-going-dist>' + (hasDist ? '離目的地 ' + distHTML(p.dist) : '距離待確認') + '</span>' +
          '<span class="ex-going__s">往' + esc(p.name) + (hasDist ? ' · 走路約 ' + num(fmt.walkMin(p.dist)) + ' 分鐘' : '') + '</span>' +
        '</span>' +
      '</div>' +
    '</div>' +
    '<div class="sheet sheet--drag is-collapsed ex-going__sheet" data-drag>' +
      '<div class="sheet__handle"></div>' +
      '<div class="card card--pad u-row u-gap3 ex-going__card">' +
        '<span data-icon="bell" class="ex-ic22 ex-noshrink"></span>' +
        '<span class="ex-going__p"><b>到了會自動響，你不用一直看手機。</b>這段路本來就不是拿來滑的。</span>' +
      '</div>' +
      '<div class="card card--pad u-row u-gap3 ex-going__card ex-going__card--mist">' +
        '<span data-icon="place" class="ex-ic22 ex-noshrink"></span>' +
        '<span class="ex-going__p ex-muted">抵達以現場定位確認：半徑 ' + num(ARRIVE_RADIUS_M) + ' 公尺內停留 ' +
          num(ARRIVE_STAY_MIN) + ' 分鐘才算數。明信片是走到現場才拿得到的東西，所以這一關不能只靠按鈕。</span>' +
      '</div>' +
      '<div class="ex-going__acts">' +
        '<button class="demo-btn ex-demo" type="button" data-act="arrive">模擬抵達</button>' +
        '<button class="btn-link ex-center" type="button" data-act="cancel-going">先不去了</button>' +
      '</div>' +
    '</div>';
}

function mountGoing(root, params) {
  const p = APP.place(params.id);
  if (!p || rodeHere(p) || activeTrip()) { APP.ui.setStatus('dark'); return; }
  const host = root.querySelector('[data-going-map]');
  let m = null;
  const geo = window.HSINCHU_PLACES && HSINCHU_PLACES[p.id];
  /* 地圖只有你與目的地兩個點。你放在離目的地 dist 公尺的西南方（示意），框住兩點的中間 */
  const d = p.dist || 900;
  const me = geo ? [geo.x - 0.6 * d, geo.y + 0.8 * d] : null;
  try {
    m = APP.map.mount(host, {
      style: 'paper',
      center: me ? HSMAP.toLL((geo.x + me[0]) / 2, (geo.y + me[1]) / 2) : 'station',
      spanM: me ? Math.max(900, Math.min(8000, d * 1.8)) : 1800,
      spots: geo ? [{ id: p.id, name: p.name, art: p.art, state: 'today', type: p.type, dist: p.dist, hook: p.hook }] : false,
      max: 1,
      overlay: '<div class="pin ex-me" data-ex-me><span class="pin__drop ex-me__drop"><span data-icon="hail" class="ex-ic20"></span></span></div>',
    });
    placeMe(m, root.querySelector('[data-ex-me]'), me);
    SHELL.injectIcons(host);
  } catch (e) {
    console.error('going map', e);
  }
  const sheet = root.querySelector('.sheet[data-drag]');
  if (sheet && window.INTERACT) INTERACT.initSheet(sheet);
  root.querySelector('[data-act="arrive"]').onclick = function () {
    APP.nav.go('/unlock/' + encodeURIComponent(p.id));
  };
  root.querySelector('[data-act="cancel-going"]').onclick = function () {
    APP.nav.back(exploreHome(p.id));
  };
  return function () { if (m) m.destroy(); };
}

/* ---------------------------------------------------------------- /unlock/:id */

function cardName(p) {
  const c = (M().POSTCARDS || []).filter(function (x) { return x.id === p.card; })[0];
  return c ? c.name : p.name;
}

/* 搭 yoxi 抵達（必得金框；走不到的地方再加點數）只看「真的搭車抵達這裡」的那一趟：
   store.trip 是這個地方、而且已抵達（phase done）。跟 /ride 的金色入口、/trip/done 的金色橫幅同一個判斷
   （ride.js 的 pendingUnlock 也要 phase done）。網址上的 ?ride=1 只是入口的記號，不參與判斷：
   - 沒有這一趟：手打 ?ride=1 也拿不到金框和點數；
   - 有這一趟：不論從哪裡進來（demo 的走路抵達、/going 的模擬抵達、少了 ?ride=1 的連結）都是搭車抵達，
     不然走路收下會把還沒領的限定版一起清掉。 */
function rideTripFor(p) {
  if (!p) return null;
  const trip = APP.store.get('trip');
  if (!trip || trip.phase !== 'done') return null;
  return trip.placeId === p.id ? trip : null;
}

/* 點數只給走不到的地方：判斷在 ride.js（APP.ride.limitedPlace），這裡不另寫一份 */
function limitedPlace(p) {
  return !!(APP.ride && APP.ride.limitedPlace && APP.ride.limitedPlace(p));
}

/* 稀有度 1–5 就是 DRAW_STYLES 的順序（越後面越難抽）。特效照稀有度分級給，常見的輕、稀有的重：
   | 稀有度 | 款式     | 蓄力        | 翻開之後                                                        |
   | 1      | 水彩     | 1 拍        | 水彩暈開、幾顆柔光                                              |
   | 2      | 油畫     | 2 拍        | 筆刷掃過、暖色光點、卡片彈一下                                  |
   | 3      | 木刻版畫 | 3 拍        | 砸下來、停格 50ms、輕震、衝擊環、木屑                           |
   | 4      | 水墨     | 4 拍        | 墨滴落下、停格 80ms、夜色洗成宣紙、墨暈、圓相                   |
   | 5      | 金框     | 4 拍＋昇格  | 閃光（整次唯一一次）、光芒、轉一圈半、停格 120ms、重震、金粉噴泉，金粉留著慢慢飄 |
   蓄力每一拍換一個光色（白 → 暖橙 → 朱紅 → 墨 → 金），停在哪一色就透露是哪一級。 */
function tierOf(d) {
  const i = d ? DRAW_STYLES.indexOf(d) : -1;
  return i < 0 ? 1 : i + 1;
}
function auraColor(i) {
  const F = APP.fx;
  if (!F) return [255, 255, 255];
  if (i <= 0) return F.color('--yoxi-white');
  if (i === 1) return F.mix(F.color('--gold'), F.color('--yoxi-red'), .38);
  if (i === 2) return F.color('--yoxi-red');
  if (i === 3) return F.mix(F.color('--yoxi-slate-lite'), F.color('--yoxi-white'), .35);
  return F.color('--gold');
}
const CHARGE_CAPS = ['正在畫下今天的這裡', '讀取今天的天氣與光線', '鎖定畫風', '收筆'];

/* 卡面：有實景照片就用照片（PHOTOS，授權一定要露出），沒有就用插圖；畫風是 explore-fx.js 的 SVG 濾鏡 */
function photoOf(p) {
  if (!p) return null;
  const P = window.PHOTOS;
  return cardPhoto(p.card) || (P && P.get ? P.get(p.id, 0) : null);
}
function faceHTML(p, d) {
  const key = d ? d.key : '';
  const ph = photoOf(p);
  const photo = ph ? window.PHOTOS.base + ph.file : '';
  const gen = postcardSrc(p.card, key);
  /* 生成好的成品優先；載不到（data-fallback）就退回「照片＋SVG 濾鏡」的示意，再沒有就是插圖 */
  const base = gen
    ? '<img class="ex-face__img" src="' + esc(gen) + '" alt="" draggable="false"' +
        (photo ? ' data-fallback="' + esc(photo) + '"' : '') + '>'
    : (photo
        ? '<img class="ex-face__img" src="' + esc(photo) + '" alt="" draggable="false">'
        : '<div class="ex-face__img ex-fill" data-art="' + esc(p.art) + '" data-seed="1"></div>');
  return '<div class="ex-face' + (key ? ' ex-face--' + esc(key) : '') + (gen ? ' ex-face--gen' : '') + '">' + base +
      (key === 'watercolor' || key === 'ink'
        ? '<svg class="ex-face__paper" aria-hidden="true" focusable="false"><rect width="100%" height="100%" filter="url(#exf-paper)"/></svg>' : '') +
      (key === 'ink' ? '<span class="ex-face__seal" aria-hidden="true">城事</span>' : '') +
      (key === 'gold' ? '<span class="ex-face__holo" aria-hidden="true"></span>' : '') +
    '</div>';
}
function creditHTML(p) {
  const ph = photoOf(p);
  if (!ph) return '';
  return '<p class="ex-credit" data-credit>底圖照片 © ' + esc(ph.author || '') + ' · ' + esc(ph.licence || '') +
    ' <a class="ex-credit__a" href="' + esc(ph.source) + '" target="_blank" rel="noopener" data-act="open-credit">出處</a></p>';
}

const SOUND_ICON =
  '<svg class="ex-sound__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor"/>' +
    '<path class="ex-sound__on" d="M15.5 8.8a4.5 4.5 0 0 1 0 6.4M18 6.3a8 8 0 0 1 0 11.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
    '<path class="ex-sound__off" d="M16 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
  '</svg>';

function renderUnlock(params) {
  const p = APP.place(params.id);
  if (!p) {
    return backFabBar(exploreHome()) + notFound({ title: '找不到這個地方', text: '沒有這個地方的明信片。先回探索看看。' });
  }
  const trip = rideTripFor(p);
  const isRide = !!trip;
  const got = collected(p);
  /* 已收過的地方不重抽：顯示當初收下的那一款。走路抵達還沒抽的是 null（卡背；mount 抽完重畫） */
  const draw = got ? cardStyleOf(p.card) : storedDraw(p, isRide);
  /* 金框看抽到的款式（搭車必得）；+50 點仍只給走不到的地方（ride.js 的 limitedPlace） */
  const gold = !got && !!draw && !!draw.gold;
  const bonus = isRide && limitedPlace(p);
  const name = cardName(p);
  const today = fmt.todayMMDD();
  const year = new Date().getFullYear();
  const km = isRide && trip.km != null ? trip.km : fmt.km(p.dist);
  const arriveBy = isRide
    ? '搭 yoxi 抵達 · ' + num(km) + ' 公里'
    : (p.dist != null ? '走了 ' + distHTML(p.dist) + ' 抵達' : '走路抵達');
  const tier = tierOf(draw);
  const odds = '<button class="ex-odds-btn" type="button" data-act="open-odds" aria-label="抽取機率"><span class="ex-odds-btn__i">?</span></button>';

  /* ---- 幕一：抵達。夜色地圖上，這個地方亮起來；點它拉出「收集明信片」 ---- */
  const scene1 = got ? '' :
    '<div class="unlock__scene ex-arrive is-on" data-scene="1">' +
      '<div class="ex-arrive__head">' +
        '<span class="ex-arrive__chip"><span data-icon="' + (isRide ? 'hail' : 'steps') + '" class="ex-ic16"></span>' +
          (isRide ? '搭 yoxi 抵達' : '走路抵達') + '</span>' +
        '<h1 class="unlock__title">你到了<br>' + esc(name) + '</h1>' +
        '<p class="unlock__sub">' + arriveBy + '</p>' +
      '</div>' +
      '<div class="ex-spot-wrap">' +
        '<button class="ex-spot" type="button" data-act="open-spot" aria-label="' + esc(name) + '：收集這裡的明信片">' +
          '<span class="ex-spot__beam"></span>' +
          '<span class="ex-spot__ring"></span><span class="ex-spot__ring"></span><span class="ex-spot__ring"></span>' +
          '<span class="ex-spot__halo"></span>' +
          '<span class="ex-spot__pin"><span class="ex-spot__art" data-art="' + esc(p.art) + '" data-seed="1"></span></span>' +
        '</button>' +
      '</div>' +
      '<p class="ex-arrive__hint" data-arrive-hint>點一下發光的地方</p>' +
      '<div class="ex-sheet" data-arrive-sheet hidden>' +
        '<div class="ex-sheet__row">' +
          '<span class="ex-sheet__art" data-art="' + esc(p.art) + '" data-seed="1"></span>' +
          '<span class="ex-sheet__txt">' +
            '<span class="ex-sheet__t">' + esc(name) + '</span>' +
            '<span class="ex-sheet__p">這裡有 ' + num(DRAW_STYLES.length) + ' 款明信片，收集時隨機抽出一款</span>' +
          '</span>' +
          odds +
        '</div>' +
        (isRide
          ? '<p class="ex-sheet__gold"><span data-icon="badge" class="ex-ic16"></span>搭 yoxi 抵達 · 這一次必得 yoxi 金框</p>'
          : '') +
        '<button class="btn-primary ex-sheet__go" type="button" data-act="draw">收集明信片</button>' +
      '</div>' +
    '</div>';

  /* ---- 抽卡舞台的特效層（只放這一款用得到的） ---- */
  const key = draw ? draw.key : '';
  const stageFx = got ? '' :
    '<div class="ex-stage__fx" aria-hidden="true">' +
      (key === 'gold' ? '<span class="ex-rays"><i></i></span>' : '') +
      '<span class="ex-aura"></span>' +
      (key === 'watercolor' ? '<span class="ex-blots"><i></i><i></i><i></i><i></i></span>' : '') +
      (key === 'oil' ? '<span class="ex-stroke"></span>' : '') +
      (key === 'ink'
        ? '<svg class="ex-enso" viewBox="0 0 200 200" focusable="false"><path d="M142 37 A74 74 0 1 0 172 86" pathLength="1"/></svg><span class="ex-drop"></span>'
        : '') +
    '</div>';

  /* 抽完焦點移到這裡（tabindex=-1），報讀器念一次「抽到 ○○」 */
  const label = draw
    ? '<p class="ex-unlock__style" data-draw="' + esc(draw.key) + '" tabindex="-1">' +
        (got ? '' : '<span class="ex-sr">抽到</span>') +
        '<b class="ex-unlock__sname">' + esc(draw.name) + '</b>' +
        (got ? '' : '<span class="ex-unlock__rare">' +
          (isRide && draw.gold ? '搭 yoxi 抵達必得'
            : num(DRAW_STYLES.length) + ' 款之一 · 出現機率 ' + num(oddsPct(draw[isRide ? 'ride' : 'walk']))) +
        '</span>') +
      '</p>'
    : '';

  const act3Acts = got
    ? '<p class="ex-unlock__have">已在收藏裡</p>' +
      '<div class="ex-unlock__acts">' +
        (p.card ? '<a class="btn-primary ex-unlock__btn" href="#/postcard/' + esc(p.card) + '" data-act="open-postcard">看這張明信片</a>' : '') +
        '<a class="btn-link ex-center ex-unlock__link" href="#' + esc(exploreHome(p.id)) + '" data-act="go-explore">回探索</a>' +
      '</div>'
    : (isRide
        ? '<div class="ex-unlock__gold" data-gold-note>' +
            '<span class="ex-unlock__goldrow"><span data-icon="badge" class="ex-ic16"></span>司機同行紀念 · 這一段是 yoxi 陪你到的</span>' +
            (bonus ? '<span class="ex-unlock__goldrow" data-points>和泰 Points ' + num('+' + ridePoints()) + '</span>' : '') +
          '</div>'
        : '') +
      '<div class="ex-unlock__in">' +
        '<input class="ex-unlock__input" data-one-line maxlength="' + NOTE_MAX + '" placeholder="寫一句話（選填，最多 ' + NOTE_MAX + ' 字）" aria-label="寫一句話">' +
      '</div>' +
      '<div class="ex-unlock__acts">' +
        '<button class="btn-primary ex-unlock__btn" type="button" data-act="collect">收進收藏</button>' +
      '</div>';

  const mute = !!APP.store.get('fxMute');

  return '<div class="unlock ex-unlock" data-unlock data-at="' + (got ? '3' : '1') + '"' + (isRide ? ' data-ride' : '') +
      (draw ? ' data-style="' + esc(draw.key) + '" data-tier="' + tier + '"' : '') + '>' +
      (got ? '' : '<div class="ex-unlock__map" data-arrive-map aria-hidden="true"></div>' +
                  (key === 'ink' ? '<div class="ex-paper" aria-hidden="true"><svg class="ex-face__paper" focusable="false"><rect width="100%" height="100%" filter="url(#exf-paper)"/></svg></div>' : '') +
                  '<canvas class="ex-fx ex-fx--back" data-fx-back aria-hidden="true"></canvas>') +
      scene1 +
      '<div class="unlock__scene ex-stage' + (got ? ' is-on' : '') + '" data-scene="3">' +
        '<div class="ex-stage__shake" data-shake>' +
          '<div class="ex-unlock__card" data-card-box>' +
            stageFx +
            '<div class="ex-flip" data-flip>' +
              (got ? '' :
                '<div class="ex-flip__back" aria-hidden="true">' +
                  '<span class="ex-back__dot"></span><span class="ex-back__mark">yoxi</span><span class="ex-back__sub">城事</span>' +
                '</div>') +
              '<div class="postcard ex-flip__front' + (gold ? ' postcard--gold' : '') + '" data-final-card' +
                  (draw ? ' data-style="' + esc(draw.key) + '"' : '') + '>' +
                (gold ? '<span class="postcard__ribbon" data-ribbon-new>yoxi 限定版</span>' : '') +
                faceHTML(p, draw) +
                '<span class="ai-mark">AI 生成示意</span>' +
                '<span class="postcard__foot">' +
                  '<span class="postcard__name">' + esc(name) + '</span>' +
                  '<span class="postcard__date">' + year + '.' + esc(today) + ' · ' + esc(p.area || '新竹市') + '</span>' +
                '</span>' +
              '</div>' +
            '</div>' +
            odds +
          '</div>' +
          /* 蓄力的說明字每拍換一次，不放 aria-live（報讀器會被每 0.5 秒打斷一次）；鍵盤與報讀器走「跳過動畫」 */
          (got ? '' : '<p class="ex-stage__cap" data-stage-cap>' + CHARGE_CAPS[0] + '</p>') +
        '</div>' +
        '<div class="ex-result" data-result>' +
          label +
          creditHTML(p) +
          act3Acts +
        '</div>' +
      '</div>' +
      (got ? '' :
        '<canvas class="ex-fx ex-fx--front" data-fx aria-hidden="true"></canvas>' +
        '<div class="ex-flash" data-flash aria-hidden="true"></div>' +
        /* 點畫面快轉只有滑鼠與觸控按得到：鍵盤與報讀器在抽卡時焦點停在這顆（平常看不到，鍵盤焦點才浮出來） */
        '<button class="ex-skip" type="button" data-act="skip-draw" hidden>跳過動畫，直接看結果</button>' +
        '<button class="ex-sound" type="button" data-act="toggle-sound" aria-pressed="' + (mute ? 'false' : 'true') + '" aria-label="音效">' +
          SOUND_ICON + '</button>') +
    '</div>';
}

function sceneMs() {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--t-scene').trim();
    const n = parseFloat(v);
    if (!isNaN(n)) return /ms$/.test(v) ? n : n * 1000;
  } catch (e) { /* ignore */ }
  return 1200;
}

/* 抵達畫面的底圖：以這個地方為中心的真實地圖，壓成夜色；地點落在發光點的位置（高度 SPOT_Y） */
const SPOT_Y = .42;
const ARRIVE_SPAN_M = 1400;
function mountArriveMap(host, p) {
  const geo = window.HSINCHU_PLACES && HSINCHU_PLACES[p.id];
  if (!host || !geo || !window.HSMAP || !APP.map) return null;
  try {
    const W = host.clientWidth || 390, H = host.clientHeight || 844;
    const southM = (.5 - SPOT_Y) * H * (ARRIVE_SPAN_M / W);
    return APP.map.mount(host, { style: 'paper', center: HSMAP.toLL(geo.x, geo.y + southM), spanM: ARRIVE_SPAN_M, spots: false });
  } catch (e) {
    console.error('arrive map', e);
    return null;
  }
}

/* 金框結果頁的金粉飄多久（毫秒，跟著 --t-scene 縮放）：之後停下來，頁面回到靜止，不再每秒 60 幀耗電 */
const DUST_MS = 5600;

function mountUnlock(root, params) {
  const p = APP.place(params.id);
  if (!p) { APP.ui.setStatus('dark'); return; }
  const F = APP.fx;
  const isRide = !!rideTripFor(p);
  const got = collected(p);
  /* 走路抵達還沒抽：在這裡抽（render 是純函式，不寫 store），抽完照新的款式重畫這一頁。
     mount 在第一次繪製之前，看不到卡背閃一下；之後重整、返回都讀 store.draws，不會重抽 */
  if (!got && !isRide && !storedDraw(p, false)) {
    rollDraw(p);
    root.innerHTML = renderUnlock(params);
    if (window.SHELL) { SHELL.injectArt(root); SHELL.injectIcons(root); }
  }
  const box = root.querySelector('[data-unlock]');
  const draw = styleOf(box.getAttribute('data-style'));
  const tier = Number(box.getAttribute('data-tier')) || 1;
  const u = sceneMs() / 1200;                    /* 全部時間跟著 --t-scene 縮放 */
  const timers = [];
  const later = function (fn, ms) { const id = setTimeout(fn, Math.round(ms * u)); timers.push(id); return id; };
  let map = null, back = null, front = null, shake = null, motes = null, dust = null, run = null;
  let glow = 0, sheetOpen = false, collecting = false;
  if (F) F.filters();

  const q = function (s) { return box.querySelector(s); };
  /* 生成的成品載不到：換回照片＋SVG 濾鏡的示意 */
  box.querySelectorAll('img[data-fallback]').forEach(function (img) {
    const useFallback = function () {
      img.onerror = null;
      img.src = img.getAttribute('data-fallback');
      img.removeAttribute('data-fallback');
      const face = img.closest('.ex-face');
      if (face) face.classList.remove('ex-face--gen');
    };
    img.onerror = useFallback;
    if (img.complete && !img.naturalWidth) useFallback();
  });
  const cardBox = q('[data-card-box]');
  const flip = q('[data-flip]');
  const cap = q('[data-stage-cap]');
  const skipBtn = q('[data-act="skip-draw"]');
  const noteInput = q('[data-one-line]');
  const focusEl = function (el) {
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  };
  const stopDust = function () { if (dust) { dust.stop(); dust = null; } };
  const engs = {
    set speed(v) { if (back) back.speed = v; if (front) front.speed = v; },
    get speed() { return front ? front.speed : 1; },
  };

  const setAt = function (n) {
    box.setAttribute('data-at', String(n));
    box.querySelectorAll('.unlock__scene').forEach(function (s) {
      s.classList.toggle('is-on', s.getAttribute('data-scene') === (n === 1 ? '1' : '3'));
    });
  };

  /* 結果：不論是跑完、被點掉、還是 still，最後都停在同一個 class 狀態（WAAPI 的動畫全部拿掉，交給 CSS）。
     quiet＝一進來就是結果（已收過、still、減少動態效果）：不搶焦點、不飄金粉。
     不是 quiet（剛抽完）：焦點移到「抽到 ○○」那一行，報讀器念一次抽到什麼；「跳過動畫」收起來 */
  const finish = function (quiet) {
    if (run) run.dead = true;
    timers.forEach(clearTimeout);
    timers.length = 0;
    glow = 0;
    if (motes) { motes.stop(); motes = null; }
    box.classList.remove('is-drawing', 'is-ready', 'is-sheet');
    box.classList.add('is-done');
    if (flip) flip.classList.add('is-front');
    setAt(3);
    if (run) run.anims.forEach(function (a) { try { a.cancel(); } catch (e) { /* ignore */ } });
    if (shake) shake.stop();
    if (draw && !got && F) box.style.setProperty('--aura', 'rgb(' + auraColor(tier - 1).join(' ') + ')');
    if (draw && draw.key === 'ink' && !got) { box.classList.add('is-paper'); APP.ui.setStatus('dark'); }
    if (draw && draw.gold && !got) box.classList.add('is-gold-up');
    if (skipBtn) skipBtn.hidden = true;
    if (!quiet) focusEl(q('[data-draw]') || q('[data-act="collect"]'));
    /* 金框的金粉留著慢慢飄（「剛剛發生過」要看得見），DUST_MS 之後、或開始寫那一句話時停下來；其他款式安靜收尾 */
    if (!quiet && front && draw && draw.gold && !F.calm() && !dust) {
      const gc = [F.color('--gold'), F.color('--gold-lite')];
      const W0 = front.at(box).W;
      dust = front.stream({
        rate: 11,
        one: function () {
          return { x: F.rnd(0, W0), y: -8, vx: F.rnd(-12, 12), vy: F.rnd(34, 80), life: [3.2, 5.2],
                   size: [1, 2.6], kinds: ['star', 'glow'], colors: gc, tw: [4, 9], alpha: [.35, .85], fin: .1, fout: .45 };
        },
      });
      later(stopDust, DUST_MS);
    }
  };
  if (noteInput) noteInput.onfocus = stopDust;

  /* 已收過、still、減少動態效果（APP.reduceMotion）：直接停在結果，不演抵達與抽卡 */
  if (got || APP.reduceMotion() || !F) {
    finish(true);
  } else {
    setAt(1);
    map = mountArriveMap(q('[data-arrive-map]'), p);
    back = F.engine(q('[data-fx-back]'));
    front = F.engine(q('[data-fx]'));
    shake = F.shaker(q('[data-shake]'));
    /* 先讓瀏覽器算一次「還沒亮」的樣式，再加 is-lit，上色的 transition 才有起點（不用 rAF：畫面外會被停掉） */
    void box.offsetWidth;
    box.classList.add('is-lit');
    /* 亮起來的那一刻：一小圈光點、鐘聲，之後光點慢慢從地上升起。
       抽卡已經開始（在它之前就按了「收集明信片」）就不演：play() 會清掉這個計時器，這裡再擋一次 */
    glow = later(function () {
      glow = 0;
      const spot = q('.ex-spot__pin');
      if (run || !spot || F.calm()) return;
      const lit = isRide ? [F.color('--gold'), F.color('--gold-lite')] : [F.color('--yoxi-cream'), F.color('--yoxi-white')];
      const at = front.at(spot);
      F.sfx.arrive(isRide);
      front.burst({ x: at.x, y: at.y, n: 22, speed: [50, 170], life: [.6, 1.2], size: [1.4, 3.2], kinds: ['glow', 'star'], colors: lit, drag: 2.4, tw: [8, 14] });
      front.ring({ x: at.x, y: at.y, size: 26, grow: 4.5, life: .9, colors: [lit[0]], lw: 2.5 });
      motes = front.stream({
        rate: 7,
        one: function () {
          const s = front.at(spot);
          return { x: s.x + F.rnd(-26, 26), y: s.y + F.rnd(-6, 10), vx: F.rnd(-6, 6), vy: F.rnd(-70, -28),
                   life: [1.6, 2.8], size: [1, 2.8], kinds: ['glow', 'star'], colors: lit, tw: [5, 10], alpha: [.5, 1] };
        },
      });
    }, 420);
  }

  /* ---- 幕一：點發光的地方 → 收集面板 ---- */
  const openSheet = function () {
    if (sheetOpen || box.getAttribute('data-at') !== '1') return;
    sheetOpen = true;
    const sheet = q('[data-arrive-sheet]');
    if (!sheet) return;
    if (F) F.sfx.tap();
    sheet.hidden = false;
    box.classList.add('is-sheet');
    if (sheet.animate && F && !F.calm()) {
      sheet.animate([{ transform: 'translateY(105%)' }, { transform: 'none' }], { duration: 420, easing: F.ease.out });
      const spot = q('.ex-spot');
      if (spot) spot.animate([{ transform: 'scale(1)' }, { transform: 'scale(.9)', offset: .3 }, { transform: 'scale(1)' }],
        { duration: 420, easing: F.ease.back });
    }
    focusEl(q('[data-act="draw"]'));
  };
  const spotBtn = q('[data-act="open-spot"]');
  if (spotBtn) spotBtn.onclick = function (e) { if (e) e.stopPropagation(); openSheet(); };

  box.querySelectorAll('[data-act="open-odds"]').forEach(function (b) {
    b.onclick = function (e) { if (e) e.stopPropagation(); openOdds(); };
  });
  const credit = q('[data-act="open-credit"]');
  if (credit) credit.onclick = function (e) { if (e) e.stopPropagation(); };

  const snd = q('[data-act="toggle-sound"]');
  if (snd) snd.onclick = function (e) {
    if (e) e.stopPropagation();
    const mute = !APP.store.get('fxMute');
    APP.store.set('fxMute', mute);
    snd.setAttribute('aria-pressed', mute ? 'false' : 'true');
    /* 關掉就是現在安靜：已經排好、還沒響完的（金框的鐘聲會拖三秒）一起切掉 */
    if (F && F.sfx.stopAll && mute) F.sfx.stopAll();
    if (!mute && F) F.sfx.tap();
    APP.ui.toast(mute ? '音效關了' : '音效開了');
  };

  /* 點畫面：幕一打開面板；抽卡中蓄力 → 快轉到可以翻、可以翻 → 翻開、翻開中 → 直接看結果 */
  box.onclick = function (e) {
    if (e && e.target && e.target.closest && e.target.closest('button, a, input')) return;
    const at = box.getAttribute('data-at');
    if (at === '1') { openSheet(); return; }
    if (at !== '2' || !run) return;
    if (run.phase === 'charge' || run.phase === 'summon') run.fast = true;
    else if (run.phase === 'ready' && run.tap) run.tap();
    else if (run.phase === 'reveal') finish();
  };

  /* ---- 抽卡 ---- */
  function play() {
    const R = run = { dead: false, fast: false, anims: [], phase: 'summon', tap: null };
    const alive = function () { return !R.dead; };
    const W = function (ms) { return new Promise(function (res) { later(res, ms); }); };
    /* 動畫只管畫面；流程用計時器接（不等 animation.finished）：
       畫面外的 iframe、背景分頁會把動畫時鐘停掉，等 finished 就會整段卡住 */
    const A = function (el, kf, o) {
      const dur = (o.duration || 300) + (o.delay || 0);
      if (R.dead) return Promise.resolve();
      if (el && el.animate) {
        R.anims.push(el.animate(kf, Object.assign({ fill: 'forwards' }, o,
          { duration: Math.round((o.duration || 300) * u), delay: Math.round((o.delay || 0) * u) })));
      }
      return W(dur);
    };
    const aura = q('.ex-aura');
    const setAura = function (i) {
      box.style.setProperty('--aura', 'rgb(' + auraColor(i).join(' ') + ')');
    };
    const white = F.color('--yoxi-white'), gold = F.color('--gold'), goldLite = F.color('--gold-lite');
    const red = F.color('--yoxi-red'), cream = F.color('--yoxi-cream'), navy = F.color('--yoxi-navy');
    const slateLite = F.color('--yoxi-slate-lite');

    /* 蓄力的一拍：光往卡片吸、光暈脹一下、卡片抖（越後面抖越大） */
    const beat = function (i) {
      const c = auraColor(i);
      setAura(i);
      F.sfx.charge(i);
      const at = front.at(cardBox);
      front.converge({ x: at.x, y: at.y, n: 14 + i * 10, radius: [150, 280], life: [.42, .66], size: [.9, 2.2],
                       kinds: ['spark', 'glow'], colors: [c, white], len: .06 });
      A(aura, [{ opacity: .3 + i * .1, transform: 'scale(.86)' },
               { opacity: .8, transform: 'scale(' + (1.08 + i * .05) + ')', offset: .35 },
               { opacity: .5 + i * .1, transform: 'scale(1)' }], { duration: 520, easing: F.ease.out });
      const a = 1 + i * .9;
      A(flip, [{ transform: 'none' }, { transform: 'translateX(' + (-a) + 'px) rotate(' + (-a * .4) + 'deg)' },
               { transform: 'translateX(' + a + 'px) rotate(' + (a * .4) + 'deg)' }, { transform: 'translateX(' + (-a * .5) + 'px)' },
               { transform: 'none' }], { duration: 240, easing: F.ease.inOut });
      if (cap) cap.textContent = CHARGE_CAPS[Math.min(i, CHARGE_CAPS.length - 1)];
      return W(560);
    };

    /* 金框的昇格：光收進去 → 停格 → 閃白、轉金、光芒展開 */
    const upgrade = function () {
      if (cap) cap.textContent = '';
      A(aura, [{ transform: 'scale(1)', opacity: .9 }, { transform: 'scale(.55)', opacity: 1 }], { duration: 380, easing: F.ease.in });
      return A(flip, [{ transform: 'none' }, { transform: 'scale(.93)' }], { duration: 380, easing: F.ease.in })
        .then(function () { return alive() ? F.hitstop(box, engs, 140) : null; })
        .then(function () {
          if (!alive()) return null;
          F.sfx.upgrade();
          F.flash(q('[data-flash]'), white);
          setAura(4);
          box.classList.add('is-gold-up');
          shake.add(.45);
          const at = front.at(cardBox);
          back.burst({ x: at.x, y: at.y, n: 64, r0: [at.w * .4, at.w * .6], speed: [200, 560], life: [.45, 1], size: [1, 2.6],
                       kinds: ['spark'], colors: [gold, goldLite, white], drag: 2.4, len: .05 });
          front.ring({ x: at.x, y: at.y, size: 40, grow: 7, life: .7, colors: [goldLite], lw: 3 });
          A(aura, [{ transform: 'scale(.55)', opacity: 1 }, { transform: 'scale(1.18)', opacity: 1 }], { duration: 520, easing: F.ease.out });
          return A(flip, [{ transform: 'scale(.93)' }, { transform: 'scale(1.06)', offset: .4 }, { transform: 'none' }],
                   { duration: 560, easing: F.ease.elastic });
        })
        .then(function () { return alive() ? W(260) : null; });
    };

    /* 翻開：每一款各自的反應（earned juice：越稀有越重） */
    const PRE = 'translateY(6px) scale(.92)';
    const REVEAL = {
      watercolor: function (at) {
        const done = A(flip, [{ transform: PRE + ' rotateY(0deg)' }, { transform: 'translateY(0) scale(1.03) rotateY(180deg)', offset: .75 },
                              { transform: 'translateY(0) scale(1) rotateY(180deg)' }], { duration: 560, easing: F.ease.out });
        return W(190).then(function () {
          if (!alive()) return null;
          F.sfx.reveal(1);
          const pastel = [cream, F.mix(red, white, .72), F.mix(slateLite, white, .5), goldLite];
          box.querySelectorAll('.ex-blots i').forEach(function (b, k) {
            const ang = k * Math.PI / 2 + .6, dx = Math.cos(ang) * 100, dy = Math.sin(ang) * 128;
            A(b, [{ transform: 'translate(' + dx * .3 + 'px,' + dy * .3 + 'px) scale(.2)', opacity: 0 },
                  { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(1.15)', opacity: .75, offset: .4 },
                  { transform: 'translate(' + dx * 1.3 + 'px,' + dy * 1.3 + 'px) scale(1.5)', opacity: 0 }],
              { duration: 1500 + k * 140, delay: k * 70, easing: F.ease.out });
          });
          back.burst({ x: at.x, y: at.y, n: 14, r0: [at.w * .3, at.w * .55], speed: [30, 100], life: [1.2, 2], size: [2, 4.5], kinds: ['glow'],
                       colors: pastel, g: -24, drag: .9, alpha: [.5, .9] });
          return done;
        });
      },
      oil: function (at) {
        const done = A(flip, [{ transform: PRE + ' rotateY(0deg)' }, { transform: 'translateY(0) scale(1.07) rotateY(180deg)', offset: .7 },
                              { transform: 'translateY(0) scale(1) rotateY(180deg)' }], { duration: 520, easing: F.ease.back });
        return W(170).then(function () {
          if (!alive()) return null;
          F.sfx.reveal(2);
          A(q('.ex-stroke'), [{ transform: 'translate(-50%, -50%) rotate(-16deg) translateX(-70%) scaleX(.3)', opacity: 0 },
                              { transform: 'translate(-50%, -50%) rotate(-16deg) translateX(0) scaleX(1)', opacity: .95, offset: .42 },
                              { transform: 'translate(-50%, -50%) rotate(-16deg) translateX(18%) scaleX(1.05)', opacity: 0 }],
            { duration: 950, easing: F.ease.out });
          const amber = auraColor(1);
          front.burst({ x: at.x, y: at.y, n: 20, r0: [at.w * .35, at.w * .6], speed: [80, 230], life: [.6, 1.2], size: [2, 5],
                        kinds: ['star', 'glow'], colors: [amber, goldLite, cream], drag: 2.6, tw: [10, 18] });
          return done;
        });
      },
      woodcut: function (at) {
        return A(flip, [{ transform: PRE + ' rotateY(0deg)' }, { transform: 'translateY(-4px) scale(1.24) rotateY(180deg)' }],
                 { duration: 380, easing: F.ease.out })
          .then(function () {
            return A(flip, [{ transform: 'translateY(-4px) scale(1.24) rotateY(180deg)' }, { transform: 'translateY(0) scale(1) rotateY(180deg)' }],
                     { duration: 150, easing: F.ease.heavy });
          })
          .then(function () {
            if (!alive()) return null;
            F.sfx.thud(false);
            F.sfx.reveal(3);
            return F.hitstop(box, engs, 50);
          })
          .then(function () {
            if (!alive()) return null;
            shake.add(.42);
            const c = front.at(cardBox);
            front.ring({ x: c.x, y: c.y, size: c.w * .55, grow: 2.3, life: .55, colors: [red], lw: 4 });
            front.burst({ x: c.x, y: c.y + c.h * .3, n: 24, speed: [160, 420], angle: [-Math.PI * .95, -Math.PI * .05],
                          life: [.6, 1], size: [3, 7], kinds: ['shard'], colors: [red, cream, slateLite], g: 900, drag: 1.2,
                          spin: [4, 12], blend: 'source-over', fout: .3 });
            back.burst({ x: c.x, y: c.y + c.h * .45, n: 10, speed: [20, 70], life: [.8, 1.4], size: [6, 12], grow: 2,
                         kinds: ['soft'], colors: [cream], alpha: [.15, .3], blend: 'source-over' });
            return A(flip, [{ transform: 'rotateY(180deg) scale(1)' }, { transform: 'rotateY(180deg) scale(1.02)', offset: .3 },
                            { transform: 'rotateY(180deg) scale(1)' }], { duration: 320, easing: F.ease.out });
          });
      },
      ink: function (at) {
        const drop = q('.ex-drop');
        return A(drop, [{ transform: 'translate(-50%, -50%) translateY(-260px) scale(.6, 1.5)', opacity: 0 },
                        { transform: 'translate(-50%, -50%) translateY(-70px) scale(.7, 1.3)', opacity: 1, offset: .6 },
                        { transform: 'translate(-50%, -50%) translateY(0) scale(1.2, .7)', opacity: 1 }],
                 { duration: 440, easing: F.ease.heavy })
          .then(function () {
            if (!alive()) return null;
            F.sfx.plip();
            A(drop, [{ transform: 'translate(-50%, -50%) scale(1.2, .7)', opacity: 1 }, { transform: 'translate(-50%, -50%) scale(3.2, .2)', opacity: 0 }],
              { duration: 260, easing: F.ease.out });
            return F.hitstop(box, engs, 80);
          })
          .then(function () {
            if (!alive()) return null;
            /* 夜色洗成宣紙：墨在紙上才看得見 */
            box.classList.add('is-paper');
            APP.ui.setStatus('dark');
            F.sfx.reveal(4);
            shake.add(.3);
            const c = back.at(cardBox);
            const ink = [navy, F.mix(navy, slateLite, .35)];
            back.burst({ x: c.x, y: c.y, n: 26, speed: [24, 96], life: [1.6, 2.6], size: [10, 22], grow: [2.5, 4],
                         kinds: ['soft'], colors: ink, drag: 1.2, alpha: [.18, .42], blend: 'source-over', fin: .05, fout: .6 });
            back.burst({ x: c.x, y: c.y - c.h * .5, n: 16, speed: [220, 460], angle: [-Math.PI * .92, -Math.PI * .08], life: [.5, .9],
                         size: [1.5, 4], kinds: ['soft'], colors: [navy], g: 700, drag: .6, blend: 'source-over', alpha: [.6, .9] });
            back.ring({ x: c.x, y: c.y, size: c.w * .5, grow: 2.6, life: 1.2, colors: [navy], lw: 1.6 });
            back.ring({ x: c.x, y: c.y, size: c.w * .5, grow: 3.4, life: 1.6, colors: [navy], lw: 1.2 });
            const enso = q('.ex-enso path');
            A(q('.ex-enso'), [{ opacity: 0, transform: 'translate(-50%, -53%) rotate(-30deg) scale(.9)' },
                              { opacity: .8, transform: 'translate(-50%, -53%) rotate(0deg) scale(1)' }], { duration: 1100, easing: F.ease.out });
            A(enso, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1100, delay: 80, easing: F.ease.out });
            return A(flip, [{ transform: PRE + ' rotateY(0deg)' }, { transform: 'translateY(0) scale(1.04) rotateY(180deg)', offset: .7 },
                            { transform: 'translateY(0) scale(1) rotateY(180deg)' }], { duration: 640, easing: F.ease.out });
          });
      },
      gold: function (at) {
        const spin = A(flip, [{ transform: PRE + ' rotateY(0deg)' },
                              { transform: 'translateY(0) scale(1.22) rotateY(420deg)', offset: .62 },
                              { transform: 'translateY(0) scale(1.14) rotateY(540deg)' }], { duration: 980, easing: F.ease.out });
        return W(560).then(function () {
          if (!alive()) return null;
          F.sfx.thud(true);
          F.sfx.reveal(5);
          return F.hitstop(box, engs, 120);
        }).then(function () {
          if (!alive()) return null;
          shake.add(.62);
          const c = front.at(cardBox);
          const gc = [gold, goldLite, white];
          front.ring({ x: c.x, y: c.y, size: c.w * .5, grow: 3.2, life: .7, colors: [goldLite], lw: 5 });
          front.ring({ x: c.x, y: c.y, size: c.w * .4, grow: 4.4, life: 1, colors: [gold], lw: 3 });
          back.burst({ x: c.x, y: c.y, n: 90, r0: [c.w * .35, c.w * .55], speed: [260, 720], life: [.5, 1.1], size: [1, 2.8],
                       kinds: ['spark'], colors: gc, drag: 2, g: 260, len: .045 });
          front.burst({ x: c.x, y: c.y - c.h * .3, n: 70, r0: [c.w * .3, c.w * .5], speed: [300, 680], angle: [-Math.PI * .92, -Math.PI * .08],
                        life: [1.2, 2], size: [1.6, 4], kinds: ['star', 'glow'], colors: gc, g: 720, drag: .9, tw: [8, 16] });
          back.burst({ x: c.x, y: c.y, n: 18, speed: [40, 140], life: [1, 1.8], size: [18, 34], grow: 1.6, kinds: ['glow'],
                       colors: [gold], alpha: [.25, .45], drag: 1.4 });
          A(q('[data-ribbon-new]'), [{ transform: 'scale(2.4) rotate(-14deg)', opacity: 0 }, { transform: 'scale(.9) rotate(0deg)', opacity: 1, offset: .7 },
                                     { transform: 'none', opacity: 1 }], { duration: 480, delay: 260, easing: F.ease.back });
          return spin;
        }).then(function () {
          return A(flip, [{ transform: 'translateY(0) scale(1.14) rotateY(540deg)' }, { transform: 'translateY(0) scale(1) rotateY(540deg)' }],
                   { duration: 620, easing: F.ease.elastic });
        });
      },
    };

    const scene1 = q('[data-scene="1"]');
    const sheet = q('[data-arrive-sheet]');
    const mapEl = q('[data-arrive-map]');
    /* 抵達的光點與鐘聲到此為止（還沒亮起來就按了：連排好的那一次一起取消，不然抽卡中會響鐘、光點冒不停） */
    if (glow) { clearTimeout(glow); glow = 0; }
    if (motes) { motes.stop(); motes = null; }
    F.sfx.unlock();
    F.sfx.tap();
    A(sheet, [{ transform: 'none' }, { transform: 'translateY(110%)' }], { duration: 260, easing: F.ease.in });
    return A(scene1, [{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: F.ease.in })
      .then(function () {
        if (!alive()) return null;
        if (F.calm()) { finish(); return null; }      /* 減少動態：直接看結果（CSS 的淡入接手） */
        box.classList.add('is-drawing');
        setAt(2);
        /* 抽卡時卡片放在畫面正中；翻完才滑回結果的位置 */
        const b = box.getBoundingClientRect(), c = cardBox.getBoundingClientRect();
        const k = b.width / (box.offsetWidth || b.width) || 1;
        box.style.setProperty('--dy', (((b.top + b.height * .45) - (c.top + c.height / 2)) / k).toFixed(1) + 'px');
        if (mapEl) A(mapEl, [{ opacity: .55 }, { opacity: .1 }], { duration: 700, easing: F.ease.out });
        setAura(0);
        F.sfx.whoosh();
        /* 透明度動在外層：.ex-flip 自己有 opacity 動畫時，Chrome 會把 preserve-3d 壓平，翻面就只看得到反過來的卡背 */
        A(cardBox, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: F.ease.out });
        return A(flip, [{ transform: 'translateY(60px) scale(.3) rotate(-10deg)' },
                        { transform: 'translateY(-8px) scale(1.04) rotate(2deg)', offset: .7 },
                        { transform: 'none' }], { duration: 620, easing: F.ease.out });
      })
      .then(function () {
        if (!alive()) return null;
        R.phase = 'charge';
        const beats = Math.min(tier, 4);
        let chain = Promise.resolve();
        for (let i = 0; i < beats; i++) {
          chain = chain.then(function () { return alive() && !R.fast ? beat(i) : null; });
        }
        return chain;
      })
      .then(function () {
        if (!alive()) return null;
        if (tier === 5) {
          if (!R.fast) return upgrade();
          box.classList.add('is-gold-up');
        }
        return null;
      })
      .then(function () {
        if (!alive()) return null;
        setAura(tier - 1);
        A(aura, [{ opacity: .85 }, { opacity: .85 }], { duration: 10 });
        /* 等你翻開（沒動作 3.6 秒後自己翻，demo 不會卡住） */
        R.phase = 'ready';
        box.classList.add('is-ready');
        if (cap) cap.textContent = '點一下翻開';
        return Promise.race([new Promise(function (res) { R.tap = res; }), W(3600)]);
      })
      .then(function () {
        if (!alive()) return null;
        R.tap = null;
        R.phase = 'reveal';
        box.classList.remove('is-ready');
        if (cap) cap.textContent = '';
        F.sfx.flip();
        const at = front.at(cardBox);
        return A(flip, [{ transform: 'none' }, { transform: PRE }], { duration: 140, easing: F.ease.in })
          .then(function () { return alive() ? (REVEAL[draw ? draw.key : 'watercolor'] || REVEAL.watercolor)(at) : null; });
      })
      .then(function () { return alive() ? W(tier >= 4 ? 900 : 520) : null; })
      .then(function () { if (alive()) finish(); });
  }

  const drawBtn = q('[data-act="draw"]');
  if (drawBtn) drawBtn.onclick = function (e) {
    if (e) e.stopPropagation();
    if (run || !F) { if (!F) finish(); return; }
    /* 按下去這顆就停用、面板收走：焦點不能掉到 body，交給「跳過動畫」（鍵盤按 Enter／空白鍵就直接看結果） */
    drawBtn.disabled = true;
    if (skipBtn) { skipBtn.hidden = false; focusEl(skipBtn); }
    play();
  };
  if (skipBtn) skipBtn.onclick = function (e) {
    if (e) e.stopPropagation();
    if (run && box.getAttribute('data-at') !== '3') finish();
  };

  const btn = q('[data-act="collect"]');
  if (btn) {
    btn.onclick = function (e) {
      if (e) e.stopPropagation();
      /* 連點兩下只收一次、只導一次（第二下常落在轉場中還沒拆掉的舊畫面上） */
      if (collecting) return;
      collecting = true;
      btn.disabled = true;
      const note = noteInput ? String(noteInput.value || '').trim().slice(0, NOTE_MAX) : '';
      /* 收的當下再判一次（畫面開著的時候行程可能被取消或換掉了） */
      const trip = rideTripFor(p);
      const ride = isRide && !!trip;
      const km = ride && trip.km != null ? trip.km : fmt.km(p.dist);
      /* 轉換歸因：這趟車是從哪個入口叫的，記在 app store（行程紀錄的小標），collect 會清掉 trip 所以先記 */
      if (ride && trip.via && p.card) {
        const rv = Object.assign({}, APP.store.get('rideVia') || {});
        rv[p.card] = trip.via;
        APP.store.set('rideVia', rv);
      }
      const drawn = ride ? drawStyle('ride', 0) : rollDraw(p);
      collect(p.id, { by: ride ? 'ride' : 'walk', note: note, km: km, style: drawn.key });
      APP.ui.toast('收進收藏了');
      APP.nav.go('/album', { dir: 'push' });
    };
  }

  return function () {
    if (run) run.dead = true;
    timers.forEach(clearTimeout);
    timers.length = 0;
    glow = 0;
    if (motes) motes.stop();
    stopDust();
    if (shake) shake.stop();
    if (back) back.destroy();
    if (front) front.destroy();
    if (map) map.destroy();
    /* 掛在 .device 上的機率說明、還在響的音效：離開這一頁就收掉 */
    closeOdds();
    if (F && F.sfx.stopAll) F.sfx.stopAll();
  };
}

/* ---------------------------------------------------------------- /routes */

function renderRoutes() {
  return '<header class="hdr-red hdr-red--compact">' +
      '<div class="hdr-red__bar">' +
        '<a class="hdr-red__close" href="#" data-back="' + esc(exploreHome()) + '" aria-label="返回"><span data-icon="close"></span></a>' +
        '<h1 class="hdr-red__title ex-hdr-title">這個月的路線</h1>' +
      '</div></header>' +
    '<div class="scroll ex-scroll">' +
      '<p class="ai-note">明信片與插圖都是 AI 依地點生成的示意圖，不是實景照片。</p>' +
      '<div class="ex-routes">' +
        (M().ROUTES || []).map(function (r, i) {
          const done = S().routeDone(r.id);
          return '<a class="card ex-rbig" href="#/route/' + esc(r.id) + '" data-act="open-route" data-route-id="' + esc(r.id) + '">' +
            '<span class="ex-rbig__art" data-art="' + esc(r.art) + '" data-seed="' + (i + 3) + '" data-wide></span>' +
            '<span class="ex-rbig__body">' +
              '<span class="ex-rbig__t">' + esc(r.name) + '</span>' +
              '<span class="ex-rcard__s">' + esc(r.sub) + '</span>' +
              '<span class="track-mini ex-track">' + trackMini(done, r.total) +
                '<span class="ex-track__n">' + num(done) + '/' + esc(r.total) + '</span></span>' +
            '</span></a>';
        }).join('') +
      '</div>' +
      '<p class="ex-note ex-center-text">每個月會長出新的路線。<br>沒走完的不會消失，也不用趕。</p>' +
    '</div>';
}

/* ---------------------------------------------------------------- /route/:id */

function stopPlaceId(st) {
  const c2p = M().CARD_TO_PLACE || {};
  if (st.card && c2p[st.card]) return c2p[st.card];
  const p = APP.place(st.card || st.id);
  return p ? p.id : null;
}

/* 一條路線的畫面模型：每站的狀態、下一站、斷點 */
function routeModel(R) {
  /* 下一站：路線有 feature（先去這裡）且還沒收就是它，否則第一個還沒收的（route.html 的規則） */
  const nx = R.stops.filter(function (st) { return R.feature && st.card === R.feature && !S().has(st.card); })[0] ||
             R.stops.filter(function (st) { return !S().has(st.card); })[0] || null;
  const stops = R.stops.map(function (st) {
    const pid = stopPlaceId(st);
    const p = pid ? APP.place(pid) : null;
    const dist = p && p.dist != null ? p.dist : st.dist;
    return { st: st, pid: pid, place: p, dist: dist,
             done: S().has(st.card), next: st === nx, walk: fmt.canWalk(dist) };
  });
  /* 斷點：腳到不了、還沒收的那一站。下一站本身走不到就是它（同一張畫面不出現兩個「下一步」），
     否則第一個還沒收、走不到的站。 */
  const nxM = stops.filter(function (s) { return s.next; })[0];
  const brk = (nxM && !nxM.walk && nxM.pid) ? nxM
    : stops.filter(function (s) { return !s.done && !s.walk && s.pid; })[0] || null;
  return { stops: stops, next: nxM || null, brk: brk,
           done: stops.filter(function (s) { return s.done; }).length };
}

function renderRoute(params) {
  const R = routeById(params.id);
  if (!R) {
    return backFabBar('/routes') + notFound({ title: '找不到這條路線', text: '這條路線不在這個月的清單裡。',
      href: '/routes', cta: '看這個月的路線' });
  }
  const md = routeModel(R);
  const bd = S().badge(R.badge);
  const lead = md.done >= R.stops.length ? '全部走過了' : (md.done === 0 ? '還沒開始' : '已經走過 ' + md.done + ' 站');

  const track = md.stops.map(function (s, i) {
    const st = s.st;
    const isBrk = md.brk && s === md.brk;
    const body =
      '<span class="route-track__thumb ex-stop__thumb' + (s.done ? '' : ' is-gray') + '" data-art="' + esc(st.art) + '" data-seed="' + (i + 2) + '"></span>' +
      '<span class="ex-stop__txt">' +
        '<span class="ex-strong">' + esc(st.name) + '</span>' +
        '<span class="ex-muted">' + (s.done ? '已收集' : distHTML(s.dist)) + (st.note ? ' · ' + esc(st.note) : '') + '</span>' +
      '</span><span class="arrow"></span>';
    const link = s.pid
      ? '<a class="route-track__body" href="#/place/' + esc(s.pid) + '" data-act="open-place" data-stop="' + esc(st.id) + '">' + body + '</a>'
      : '<a class="route-track__body" href="#" data-toast="這一站的內容還在整理" data-stop="' + esc(st.id) + '">' + body + '</a>';
    const brk = isBrk
      ? '<div class="ex-brk" data-breakpoint="' + esc(s.pid) + '">' +
          '<span class="ex-brk__k">腳到不了的一段</span>' +
          '<span class="ex-brk__t">' + num(fmt.km(s.dist)) + ' 公里，這一站搭車比較合理。</span>' +
          '<button class="btn-ghost ex-brk__btn" type="button" data-act="set-dropoff">設為下車點 · 約 $' +
            num(fmt.fare(fmt.km(s.dist))) + ' · ' + num(fmt.rideMin(fmt.km(s.dist))) + ' 分</button>' +
        '</div>'
      : '';
    return '<div class="route-track__stop' + (s.done ? ' is-done' : '') + (s.next ? ' is-next' : '') +
      (isBrk ? ' is-broken' : '') + '">' +
      '<span class="route-track__rail"><span class="route-track__node"></span></span>' +
      '<div class="ex-stop">' + link + brk + '</div></div>';
  }).join('');

  return '<div class="scroll ex-route">' +
      '<div class="ex-cover">' +
        '<div class="ex-fill" data-art="' + esc(R.art) + '" data-seed="3" data-wide></div>' +
        '<span class="ex-cover__scrim"></span>' +
        '<span class="ai-mark ex-hero__mark">AI 生成示意</span>' +
        backFab('/routes') +
        '<div class="ex-cover__body">' +
          '<div class="ex-cover__k">這個月的路線</div>' +
          '<h1 class="ex-cover__t">' + esc(R.name) + '</h1>' +
          '<div class="ex-cover__s">' + esc(R.sub) + '</div>' +
        '</div>' +
      '</div>' +
      '<section class="ex-pad ex-prog">' +
        '<div class="card card--pad">' +
          '<span class="ex-strong">' + esc(lead) + '</span>' +
          '<span class="track-mini ex-track">' + trackMini(md.done, R.stops.length) +
            '<span class="ex-track__n" data-route-prog>收集 ' + num(md.done) + '/' + esc(R.stops.length) + '</span></span>' +
          '<span class="ex-muted">慢慢走，沒有期限，也不用照順序。</span>' +
        '</div>' +
      '</section>' +
      '<section class="ex-pad"><div class="route-track" data-route-track>' + track + '</div></section>' +
      (bd && bd.name
        ? '<section class="ex-pad">' +
            '<div class="sec"><h2 class="sec__t">全部走過會得到</h2></div>' +
            '<div class="card card--pad">' +
              '<span class="ex-strong">〈' + esc(bd.name) + '〉</span>' +
              '<span class="ex-muted">' + esc(bd.award || '') + '</span>' +
            '</div>' +
          '</section>'
        : '') +
    '</div>';
}

function mountRoute(root, params) {
  const R = routeById(params.id);
  if (!R) { APP.ui.setStatus('dark'); return; }
  const md = routeModel(R);
  const b = root.querySelector('[data-breakpoint] [data-act="set-dropoff"]');
  if (b && md.brk) b.onclick = function () { setDropoff(md.brk.pid, 'route'); };
}

/* ---------------------------------------------------------------- 註冊 */

APP.view('explore', {
  path: '/explore', tab: 'explore', status: 'light', root: true, title: '探索',
  render: renderExplore, mount: mountExplore,
});

APP.view('explore-map', {
  path: '/explore/map', tab: 'explore', status: 'light', title: '探索地圖',
  render: renderMap, mount: mountMap,
});

APP.view('place', {
  path: '/place/:id', tab: 'explore', status: 'light',
  title: function (params) { const p = APP.place(params.id); return p ? p.name : '找不到這個地方'; },
  render: renderPlace, mount: mountPlace,
});

APP.view('going', {
  path: '/going/:id', tab: null, status: 'dark',
  title: function (params) { const p = APP.place(params.id); return p ? '前往 ' + p.name : '前往中'; },
  render: renderGoing, mount: mountGoing,
});

APP.view('unlock', {
  path: '/unlock/:id', tab: null, status: 'light', title: '抵達',
  render: renderUnlock, mount: mountUnlock,
});

APP.view('routes', {
  path: '/routes', tab: 'explore', status: 'light', title: '這個月的路線',
  render: renderRoutes,
});

APP.view('route', {
  path: '/route/:id', tab: 'explore', status: 'light',
  title: function (params) {
    const R = routeById(params.id);
    return R ? R.name : '找不到這條路線';
  },
  render: renderRoute, mount: mountRoute,
});

})();
