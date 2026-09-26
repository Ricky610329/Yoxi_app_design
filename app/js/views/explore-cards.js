/* ==========================================================================
   yoxi 城事 web app — explore 區塊：明信片與抽卡的共用零件（不註冊畫面）
   契約：app/ARCHITECTURE.md §3、§7。
   載入順序：explore-fx.js → explore-cards.js → explore-face.js → explore-gold.js → explore.js → explore-unlock.js（都在 album.js 之前）。

   回答什麼：一張明信片怎麼拿到的——抽到哪一款、怎麼收下、收下的是搭車還是走路、是不是金框或限定版。
             收藏（album）、叫車首頁（ride）、探索的各畫面、/unlock 都讀這裡，所以獨立成一支，不跟著任何一個畫面走。
             長什麼樣（成品、照片＋濾鏡、插圖的疊法）在 explore-face.js。
   提供（APP.explore，對外 API，契約 §7）：
     collect(placeId, { note })                  收下一張明信片：搭車或走路、哪一款、幾公里都由這裡自己判斷
     cardOrigin(cardId)                          收下的那一張是怎麼來的：{ by, style, gold, limited, via, date, note, km }
     DRAW_STYLES／drawStyle(by, r)               抽卡機率表（全 app 唯一來源）與純抽取函式
     openOdds()                                  機率說明（掛在 .device，帶 data-overlay＋_dismiss）
     cardStyleOf(cardId)                         收下的是哪一款（抽到的；demo 一開始就有的照規則補）
   是不是搭車抵達一律問 ride 的行程 module：APP.ride.trip.arrivedAt(地點 id)；搭車收下由 collect 呼叫
   APP.ride.trip.consume 用掉那一趟（連同 rideVia 歸因）。「是不是金框、是不是限定版」一律問 cardOrigin。
   內部零件 APP.explore._（不可列舉；只給 explore.js 與 explore-unlock.js 共用，別的區塊不要依賴）：
     這一次抵達（arrivalAt：搭車還是走路、幾公里、這次的款式）、這次抵達的款式（storedDraw 只讀／rollDraw 抽並記下）、
     關掉機率說明（closeOdds）、點數（ridePoints）與幾個小工具；explore.js 再掛上頁面零件
     （exploreHome、notFound、backFabBar、distHTML）。
   刻意沒有：畫面（/unlock 在 explore-unlock.js）、卡面（explore-face.js）、特效（explore-fx.js 的 APP.fx）。

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

/* 搭車抵達走不到的地方回饋的點數：唯一來源是 ride.js 的 APP.ride.RIDE_BONUS（/points 的明細也用它；
   資料缺了退回幾點也只寫在那裡）。ride.js 比這支先載入 */
function ridePoints() { return APP.ride.RIDE_BONUS; }

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

/* 收在「?」裡的機率說明。掛在 .device 上（壓在全螢幕的解鎖頁上面），所以離開這一頁要自己收：
   帶 data-overlay、el._dismiss()（core 導覽前會呼叫；/unlock 的 cleanup 也呼叫 closeOdds），可以重複呼叫。
   掛法（data-overlay、_dismiss、Esc 與焦點）交給 APP.ui.overlay；它在點「?」時才掛 keydown，router 記不到，
   所以一定要經過 _dismiss 拆掉。 */
let oddsOpen = null;
function openOdds() {
  if (oddsOpen && oddsOpen.isConnected) return oddsOpen;
  const rows = function (k) {
    return DRAW_STYLES.map(function (d) {
      return '<li class="ex-odds__row' + (d.gold ? ' is-gold' : '') + '">' +
        '<span>' + esc(d.name) + '</span><span class="num">' + esc(oddsPct(d[k])) + '</span></li>';
    }).join('');
  };
  const scrim = document.createElement('div');
  scrim.className = 'scrim ex-odds';
  scrim.innerHTML =
    '<div class="modal app-modal ex-odds__box">' +
      '<h2 class="ex-odds__t">明信片抽取機率</h2>' +
      '<p class="ex-odds__p">每個地方有 ' + num(DRAW_STYLES.length) + ' 款明信片，抵達時依抵達方式抽出一款。</p>' +
      '<h3 class="ex-odds__h">走路抵達</h3><ul class="ex-odds__list" data-odds="walk">' + rows('walk') + '</ul>' +
      '<h3 class="ex-odds__h">搭 yoxi 抵達</h3><ul class="ex-odds__list" data-odds="ride">' + rows('ride') + '</ul>' +
      '<p class="ex-odds__note">機率固定，不因抵達次數改變。畫風以該地景點照片為底，由 AI 生成。</p>' +
      '<button class="btn-primary" type="button" data-act="close-odds">知道了</button>' +
    '</div>';
  const end = APP.ui.overlay(scrim, {
    dialog: scrim.querySelector('.modal'),
    label: '明信片抽取機率',
    onClose: function () { if (oddsOpen === scrim) oddsOpen = null; },
  });
  scrim.querySelector('[data-act="close-odds"]').onclick = end;
  scrim.onclick = function (e) { if (e.target === scrim) end(); };
  oddsOpen = scrim;
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
  /* STATE 與 app store 的寫入包成一次 state:change，全部寫完才發 */
  return APP.state.batch(function () {
    const a = arrivalAt(p);
    const drawn = a.trip ? a.draw : (p ? rollDraw(p) : null);
    const isNew = APP.state.collect(target, {
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
    return isNew;
  });
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
  /* 收下的是哪一款（卡面在 explore-face.js） */
  cardStyleOf: cardStyleOf,
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
