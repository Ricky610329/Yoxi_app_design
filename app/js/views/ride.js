/* ==========================================================================
   yoxi 城事 web app — ride（叫車區）

   回答什麼：
      叫車這一條線在 app 裡真的走得完：叫車首頁預設搭車，面板內可切探索（F＋E）
     → 設定下車地點 → 叫車 → 配對中 → 行程中（「這條路上」內容卡）→ 行程完成
     → 評分之後才出現金色橫幅 → 限定版解鎖（explore 接手）→ 點數 +50。
     旁邊掛著叫車 app 原本就有的幾頁：抽屜、和泰 Points、通知中心、行程紀錄、上車點。

   從哪張原型來：
      /ride        variant-f-home.html（面板內切模式）、variant-e-home.html（探索地點）、home.html（搭車 sheet）、
                  concept-map-home.html（真實地圖的中心與視野）、variant-k-ride.html（車資／分鐘公式）
     /dropoff     新（版型參考 pickup.html）            /pickup     pickup.html
     /trip        ride.html                              /trip/done  ride-done.html
     /drawer      drawer.html                            /points     points.html
     /notify      notify.html                            /trips      trips.html

   刻意沒有的東西：
      - 搭車地圖沒有探索景點。探索地圖同時最多 4 個景點。兩個模式的面板都可上下拉，
        最低收到只剩拉把（看整張地圖）；搭車點拉把拉回來，探索也可以點景點叫回來。
      - 收藏仍在底欄；沒有數字徽章、沒有未讀數字。
     - 金色橫幅只在評分之後出現（評分與付款是 yoxi 的既有職責，城事排在它們後面）。
     - 行程地圖上不畫路線：這份原型沒有做路徑規劃，一條假的線等於一個沒算過的數字。
     - 車資、分鐘、公里、點數沒有一個是手寫的：全部 APP.fmt／STATE／MOCK 算。
     - 「略過下車地點，繼續叫車」拿掉：app 版的叫車需要目的地才算得出車資，
       而且叫車首頁的可按數已經到 10（拉把是 <button>，也算一顆）。選好目的地之後「機場接送」讓位給叫車鈕；
       待收明信片的金色入口在時不放「清除」。
     - 距離不明的地方不寫車資、分鐘、公里（寫「距離待確認」），不拿 0 去算起跳價。

   跨區塊提供（ARCHITECTURE.md §7）：
     APP.ride.setDropoff(placeId, via)   寫 store.dropoff → toast → #/ride（已在 /ride 就重畫）
     APP.ride.clearDropoff()
     APP.ride.arrive()                   demo：行程直接抵達 → #/trip/done（system 的 demo 面板用）
     APP.ride.trip                       行程 module：store.trip 只有它讀寫（current／active／arrivedAt／pending／phase、
                                         start／toRiding／arrive／arriveAt／cancel／rate／consume／clear／clearBroken）
     APP.ride.pointsRows() / pointsTotal()   點數明細與總數（總數＝明細相加）
     APP.ride.snapTarget(order, heights, from, moved, base, v)   拉面板放手停在哪一段（純函式，給測試）
     APP.ride.RIDE_BONUS                 搭車抵達走不到的地方另外回饋的點數（MOCK.FAR_PLACE.ridePoints；全 app 唯一來源）
   ========================================================================== */

(function () {
'use strict';

const APP = window.APP;
const F = APP.fmt;
const esc = APP.esc;

/* 家（上車點）的經緯度：concept-map-home.html 的設定（東區水利路） */
const HOME_LL = [24.7990, 120.9800];
/* 叫車首頁的視野：concept-map-home.html 檔頭 ①——以車站為中心、1.8 km 的視野裡，
   家會落在地圖最右緣（x≈97%），地址標籤被切掉。改用那張概念稿量出來的中心與 2.4 km。 */
const RIDE_CENTER = [24.80217, 120.97604];
const RIDE_SPAN = 2400;
/* 地圖畫得比可見範圍高（mountFullMap），svg 底邊的署名會被面板蓋住，改成貼在容器底邊的 HTML */
const RIDE_CREDIT = '<span class="ride-map__credit">地圖資料 © OpenStreetMap 貢獻者（ODbL）</span>';
/* 變體 E 的四個地方，順序＝重要性（今天的地方先佔位）。座標只是 nearSpots 的格式要求，
   真正的位置由 HSMAP 的經緯度決定。 */
const NEAR_POS = { 'glass-kiln': [0, 0], market: [0, 0], moat: [0, 0], hill: [0, 0] };
/* 抵達解鎖回饋：MOCK.FAR_PLACE.ridePoints（原型的資料；state.js 的 STATE.points 同一個數），
   資料缺了才退回 50。explore 的 /unlock 讀 APP.ride.RIDE_BONUS，全 app 只有這一個來源。 */
const RIDE_BONUS = (function () {
  const f = window.MOCK && window.MOCK.FAR_PLACE;
  return f && typeof f.ridePoints === 'number' ? f.ridePoints : 50;
})();
/* 一般搭車回饋：每 20 元車資 1 點（points.html 的 34 點＝680 元÷20） */
const FARE_PER_POINT = 20;
const DRIVER = { name: '陳先生', plate: 'AHB-2836', car: 'TOYOTA Corolla Cross · 白色' };
const PICKUPS = [
  { name: '水利路 46 巷 58 號', area: '新竹市東區' },
  { name: '水利路 46 巷 2 號', area: '新竹市東區' },
  { name: '水利路 44 巷 2 號', area: '新竹市東區' },
];
/* 城事以外的一般行程（trips.html 的對照組；公里是資料，車資與點數用公式） */
const PLAIN_TRIPS = [
  { from: '東區', to: '竹北', date: '09.18', time: '08:42', km: 9.1 },
];
/* 原型沒做的頁（yoxi 既有功能、活動推播、掃碼…）：全 app 同一句 */
const TOAST_NA = '這份原型沒有做這一頁';
/* 配對中 → 行程中：從叫車（trip.startedAt）起算多久。phase 由時間推導，
   不靠「setTimeout 跑完才寫 riding」—— 離開 /trip 再回來、重整、測試的時序都得到同一個答案。 */
const MATCH_MS = 1200;
const DROP_LIMIT = 7;

/* 上車點只活在這一次開 app（store 沒有這個鍵；契約 §3.3 不另開） */
let pickupName = null;

/* ---------------------------------------------------------------- 小工具 */
function M() { return window.MOCK; }
function S() { return window.STATE; }
function store() { return APP.store; }
function still() { return APP.reduceMotion(); }
function icon(name, size) {
  return '<span data-icon="' + name + '" class="ride-ic"' +
    (size ? ' style="width:' + size + 'px;height:' + size + 'px"' : '') + '></span>';
}
function home() { return pickupName || M().USER.home; }
function kmText(km) { return (Math.round(km * 10) / 10).toFixed(1); }
/* 距離不明（findPlace 沒有 distance、SPOTS 也沒有）：fmt.dist(null) 會寫成「0 m」、fmt.km(null) 算出起跳價，
   都是沒算過的數字。一律寫「距離待確認」，也不顯示車資與分鐘（explore 的 distHTML 同一句）。 */
const DIST_TBD = '距離待確認';
function distText(m) { return m == null ? DIST_TBD : F.dist(m); }
function kmOf(p) { return p && p.dist != null ? F.km(p.dist) : null; }
function hdrClose(back, extra) {
  return '<div class="hdr-red__bar"><a class="hdr-red__close ride-close" href="#" data-back="' + back + '" aria-label="關閉">' +
    '<span data-icon="close"></span></a>' + (extra || '') + '</div>';
}
function emptyCard(eyebrow, title, text) {
  return '<div class="app-empty"><div class="app-empty__card">' +
    '<p class="app-empty__eyebrow">' + esc(eyebrow) + '</p>' +
    '<h1 class="app-empty__t">' + esc(title) + '</h1>' +
    (text ? '<p class="app-empty__p">' + esc(text) + '</p>' : '') +
    '<a class="btn-primary" href="#/ride" data-act="go-ride">回叫車</a>' +
    '</div></div>';
}
/* ---------------------------------------------------------------- 行程（APP.ride.trip）
   store.trip 只有這個 module 讀寫；別的區塊、別的畫面一律透過它（契約 §3.3、§7）。
   唯一的例外是「清除我的足跡」：APP.store.clear('footprint') 把它跟其他足跡一起回到預設（null）。
   一趟行程：{ placeId, phase:'matching'|'riding'|'done', startedAt, rated, km, via, stars? }
   - placeId 要認得（APP.place 不認得的 id 回 null）。舊資料或手改過的 id 不算行程——不然 /ride 顯示
     「回到行程」卻沒有目的地、setDropoff 被擋、/trip 又說沒有行程，只剩重設逃得出去。讀的時候一律當作沒有，
     clearBroken() 才真的清（在 mount 裡叫；render 是純函式，不寫 store）。
   - km：一律 kmOf(地方)。距離不明是 null（畫面寫「距離待確認」），不拿 0 去算起跳價。
   - 一次只有一趟：start、arriveAt 都會取代原本的那一趟。
   - phase：存的是 matching 但已經過了 MATCH_MS 就算 riding（phase(t, now)，now 可注入）。
   - 抵達之後這一趟留著（限定版還沒收），直到搭車收下（consume）才清；走路收同一個地方不碰它。 */
const TRIP = (function () {
  function raw() { return store().get('trip'); }
  function put(t) { store().set('trip', t); return t; }
  /* 行程的形狀只在這裡寫一次 */
  function make(p, o) {
    return {
      placeId: p.id, phase: o.phase, startedAt: o.startedAt || new Date().toISOString(),
      rated: !!o.rated, km: o.km !== undefined ? o.km : kmOf(p), via: o.via || null,
    };
  }
  function current() {
    const t = raw();
    return t && t.placeId && APP.place(t.placeId) ? t : null;
  }
  /* 行程現在是哪一段（純函式）。舊資料沒有 startedAt：不要永遠卡在配對中 */
  function phase(t, now) {
    if (!t) return null;
    if (t.phase !== 'matching') return t.phase;
    const t0 = Date.parse(t.startedAt);
    if (isNaN(t0)) return 'riding';
    return ((now == null ? Date.now() : now) - t0 >= MATCH_MS) ? 'riding' : 'matching';
  }
  /* 進行中：配對中或行程中（抵達之後不算） */
  function active() {
    const t = current();
    return t && t.phase !== 'done' ? t : null;
  }
  /* 搭 yoxi 抵達這個地方的那一趟（已抵達、目的地就是這裡）。/unlock 的金框與 +50 點、/going 的
     「收下這張明信片」、/ride 的金色入口、/trip/done 的金色橫幅都是同一個判斷。網址上的 ?ride=1 只是入口的記號，
     不參與判斷：沒有這一趟，手打 ?ride=1 也拿不到金框和點數；有這一趟，不論從哪裡進來都是搭車抵達
     （不然走路收下會把還沒領的限定版一起清掉）。 */
  function arrivedAt(placeId) {
    const t = current();
    return t && t.phase === 'done' && placeId != null && t.placeId === placeId ? t : null;
  }
  /* 抵達了、明信片還沒收的那一趟。按「回首頁」不能讓限定版消失（產品決定），
     所以 /ride 與明信片頁都有一個回去解鎖的入口。明信片 id 一律用 APP.place(id).card（collect 存的就是它）：
     MOCK.cardIdOf('market') 回 'market'，收過 p2 的人每一趟到東門市場都會被當成還沒收。
     這個地方沒有明信片 → 沒有東西要等。 */
  function pending() {
    const t = current();
    if (!t || t.phase !== 'done') return null;
    const p = APP.place(t.placeId);
    const card = p && p.card;
    if (!card || S().has(card)) return null;
    return { trip: t, place: p, card: card, limited: limitedPlace(p),
             href: '#/unlock/' + encodeURIComponent(p.id) + '?ride=1' };
  }

  /* 叫車：新的一趟從配對中開始。via＝這個下車點是從哪個入口設的（轉換歸因） */
  function start(placeId, via) {
    const p = APP.place(placeId);
    if (!p) return null;
    return put(make(p, { phase: 'matching', via: via }));
  }
  function toRiding() {
    const t = current();
    if (!t || t.phase !== 'matching') return false;
    put(Object.assign({}, t, { phase: 'riding' }));
    return true;
  }
  /* 這一趟抵達了 */
  function arrive() {
    const t = current();
    return t ? put(Object.assign({}, t, { phase: 'done' })) : null;
  }
  /* demo「搭 yoxi 抵達」：這一趟直接在這裡結束。原本就是去這裡的那一趟：保留叫車時間、評分、公里與歸因；
     別的目的地：被這一趟取代（只有一筆 trip）。評了幾顆星不留（跟以前的 demoArrive 一樣）。 */
  function arriveAt(placeId) {
    const p = APP.place(placeId);
    if (!p) return null;
    const t = raw();
    const same = !!(t && t.placeId === p.id);
    return put(make(p, {
      phase: 'done',
      startedAt: same && t.startedAt ? t.startedAt : null,
      rated: same && !!t.rated,
      km: same && t.km != null ? t.km : undefined,
      via: same ? t.via : null,
    }));
  }
  function cancel() {
    if (!active()) return false;
    put(null);
    return true;
  }
  function rate(stars) {
    const t = current();
    if (!t) return null;
    return put(Object.assign({}, t, { rated: true, stars: stars }));
  }
  /* 搭車收下這個地方的明信片：用掉這一趟。placeId 可以是地點 id 或明信片 id。
     這趟車是從哪個入口叫的記進 store.rideVia（行程紀錄的小標）。回傳用掉的那一趟的 { via, km }，沒有就 null */
  function consume(placeId) {
    const t = raw();
    const p = APP.place(placeId);
    const pid = p ? p.id : placeId;
    if (!t || (t.placeId !== pid && t.placeId !== placeId)) return null;
    if (t.via && p && p.card) {
      store().set('rideVia', Object.assign({}, store().get('rideVia') || {}, { [p.card]: t.via }));
    }
    put(null);
    return { via: t.via || null, km: t.km != null ? t.km : null };
  }
  function clear() { if (raw()) put(null); }
  function clearBroken() { if (raw() && !current()) put(null); }

  return {
    current: current, active: active, arrivedAt: arrivedAt, pending: pending, phase: phase,
    start: start, toRiding: toRiding, arrive: arrive, arriveAt: arriveAt, cancel: cancel, rate: rate,
    consume: consume, clear: clear, clearBroken: clearBroken,
  };
})();
function tripPlace(t) { return (t && APP.place(t.placeId)) || null; }
/* 壞掉的行程／下車點（id 不認得）：安靜清掉。在 mount 裡叫（render 是純函式，不寫 store） */
function dropBroken() {
  TRIP.clearBroken();
  const d = store().get('dropoff');
  if (d && !(d.id && APP.place(d.id))) store().set('dropoff', null);
}
function validDate(iso) {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime()) ? d : null;
}

/* 限定版（金框＋和泰 Points +50）只給「走路到不了」的地方：搭車去 900 m 外的地方不該換到 50 點。
   /unlock 決定金框、點數頁算城事解鎖回饋、收藏頁畫金框，全部用這一個判斷（門檻＝APP.fmt.WALK_MAX_M）。
   STATE.points 是原型的算法（by==='ride' 的卡 × 50），app 的點數一律用 pointsRows／pointsTotal。 */
function limitedPlace(p) { return !!p && p.dist != null && p.dist > F.WALK_MAX_M; }
function limitedCard(cardId) {
  const c = S().card(cardId);
  if (!c || c.by !== 'ride') return false;
  return limitedPlace(APP.place(cardId));
}
const VIA_LABEL = { k1: '從地方詳情', e: '從叫車地圖', route: '從路線', search: '搜尋' };

/* ---------------------------------------------------------------- 回到 /ride
   「回到 /ride」有兩種：上一格就是 /ride → 退回去（歷史裡不會疊兩個 /ride、返回鍵不會回到剛離開的頁）；
   不是（深連結、重整後的第一筆、切底欄停回來的、從別的頁進來）→ 就地換成 /ride。
   「上一格是哪一頁」由 router 記在 history.state（APP.nav.up／nav.prev），這裡只給判斷：上一格是 /ride。
   帶 query（例：「在地圖上挑」換成探索模式）一律就地換，選好之後還能退回原本那一格 /ride。 */
function fromRide(prev) { return prev.path === '/ride'; }
function backToRide(query) {
  if (query) APP.nav.go('/ride?' + query, { replace: true, dir: 'back' });
  else APP.nav.up('/ride', { backIf: fromRide });
}

/* ---------------------------------------------------------------- 跨區塊 API */
let lastSet = { id: null, at: 0 };
/* 寫下車點（不導覽）。回傳寫到的地方，或 null（行程中、找不到） */
function writeDropoff(placeId, via) {
  /* 車已經叫了：目的地不能從旁邊偷改（K1、E 小卡、路線斷點、搜尋四個入口都經過這裡） */
  if (TRIP.active()) { APP.ui.toast('行程進行中，先抵達或取消行程'); return null; }
  const p = APP.place(placeId);
  if (!p) { APP.ui.toast('找不到這個地方'); return null; }
  lastSet = { id: p.id, at: Date.now() };
  store().set('dropoff', {
    id: p.id, name: p.name, km: kmOf(p), setAt: new Date().toISOString(), via: via || 'e',
  });
  APP.ui.toast('已設為下車點');
  return p;
}
function setDropoff(placeId, via) {
  /* 連點兩下（第二下常落在轉場中的舊畫面上）：同一個地方、剛設過、人已經在 /ride → 不再寫、不再導 */
  const here = APP.nav.current();
  const d0 = store().get('dropoff');
  const p0 = APP.place(placeId);
  if (p0 && here && here.path === '/ride' && d0 && d0.id === p0.id && lastSet.id === p0.id && Date.now() - lastSet.at < 1000) {
    return true;
  }
  if (!writeDropoff(placeId, via)) return false;
  const cur = APP.nav.current();
  if (cur && cur.path === '/ride') {
    /* 探索模式（例：從 /dropoff「在地圖上挑」進來）：上一格也是 /ride 就退回去，不疊兩個 /ride */
    APP.nav.up('/ride', { backIf: fromRide, dir: 'none' });
  } else APP.nav.go('/ride');
  return true;
}

function clearDropoff() {
  store().set('dropoff', null);
  const cur = APP.nav.current();
  if (cur && cur.path === '/ride') APP.nav.go('/ride', { replace: true, dir: 'none' });
}

function arrive() {
  dropBroken();
  if (!TRIP.arrive()) { APP.ui.toast('目前沒有行程'); return false; }
  store().set('dropoff', null);
  const cur = APP.nav.current();
  /* 從行程中頁抵達：取代那一頁（返回不會回到已結束的行程）；從 demo 面板或別頁叫：照常 push */
  APP.nav.go('/trip/done', { replace: !!(cur && cur.path === '/trip') });
  return true;
}

/* confirm 開著的時候世界可能變了（瀏覽器返回、demo 抵達、別的入口改了下車點）：
   回答回來時只在「還在叫車首頁的搭車模式、trip 與 dropoff 都沒變」才照做 */
function rideSnapshot() {
  return JSON.stringify([TRIP.current(), store().get('dropoff')]);
}
function stillOnRide() {
  const here = APP.nav.current();
  return !!(here && here.path === '/ride' && here.query.get('mode') !== 'explore');
}

function callRide() {
  const here = APP.nav.current();
  if (here && here.path === '/trip') return;     /* 連點：第一下已經到行程頁了 */
  if (TRIP.active()) { APP.nav.go('/trip'); return; }
  const d = store().get('dropoff');
  if (!d || !d.id || !APP.place(d.id)) { APP.ui.toast('先選一個下車點'); return; }
  /* 上一趟的限定版還沒收：先問一次。先去解鎖 → 不建新 trip；直接叫車 → 新行程覆蓋舊的（契約 §3.3 只有一筆 trip）。
     APP.ui.confirm：按「直接叫車」是 false；按 Esc、點遮罩、導覽離開（core 的 dismissOverlays）是 null。
     叫車是有後果的動作，只認真的按了「直接叫車」（=== false）；null 什麼都不做。 */
  const pend = TRIP.pending();
  if (pend) {
    if (asking || document.querySelector('.app-confirm')) return;
    asking = true;
    const snap = rideSnapshot();
    APP.ui.confirm({ text: pend.limited ? '上一趟的限定明信片還沒收，要先去解鎖嗎？' : '上一趟的明信片還沒收，要先去收下嗎？',
                     yes: pend.limited ? '先去解鎖' : '先去收下', no: '直接叫車' }).then(function (yes) {
      asking = false;
      if (!stillOnRide() || rideSnapshot() !== snap) return;
      if (yes === true) APP.nav.go(pend.href.slice(1));
      else if (yes === false) startTrip(d);
    }, function () { asking = false; });
    return;
  }
  startTrip(d);
}

let asking = false;
function startTrip(d) {
  TRIP.start(d.id, d.via);        /* via：轉換歸因，這個下車點是從哪個入口設的 */
  APP.nav.go('/trip');
}

/* 行程紀錄：搭車抵達的明信片＋城事以外的一般行程（新到舊） */
function pastTrips() {
  const out = [];
  M().POSTCARDS.forEach(function (pc) {
    const c = S().card(pc.id);
    if (!c || c.by !== 'ride') return;
    const p = APP.place(pc.id);
    out.push({ card: pc.id, from: '新竹市', to: pc.name, date: String(c.date || ''),
               time: '', km: kmOf(p), city: true, limited: limitedCard(pc.id),
               via: (store().get('rideVia') || {})[pc.id] || null });
  });
  PLAIN_TRIPS.forEach(function (x) { out.push(Object.assign({ city: false }, x)); });
  out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  return out;
}

/* 點數明細：每一趟的搭車回饋＋每張搭車卡的城事解鎖回饋。總數一律＝明細相加。
   place：這一列是哪個地方（通知中心要顯示地名，不從 name 字串裡拆）。距離不明的一趟算不出車資，不列搭車回饋。 */
function pointsRows() {
  const rows = [];
  pastTrips().forEach(function (tr) {
    if (tr.km != null) {
      rows.push({ name: tr.from + ' → ' + tr.to + ' · 搭乘', src: '搭車回饋', date: tr.date, place: tr.to,
                  amt: Math.floor(F.fare(tr.km) / FARE_PER_POINT), city: false });
    }
    if (tr.city && tr.limited) {
      rows.push({ name: tr.to + ' · 抵達解鎖', src: '城事解鎖回饋', date: tr.date, place: tr.to, amt: RIDE_BONUS, city: true });
    }
  });
  rows.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.city ? 1 : 0) - (a.city ? 1 : 0); });
  return rows;
}
function pointsTotal() {
  return pointsRows().reduce(function (t, r) { return t + r.amt; }, 0);
}

APP.ride = Object.assign(APP.ride || {}, {
  setDropoff: setDropoff,
  clearDropoff: clearDropoff,
  arrive: arrive,
  call: callRide,
  pointsRows: pointsRows,
  pointsTotal: pointsTotal,
  pastTrips: pastTrips,
  limitedPlace: limitedPlace,
  limitedCard: limitedCard,
  VIA_LABEL: VIA_LABEL,
  trip: TRIP,
  snapTarget: snapTarget,
  MATCH_MS: MATCH_MS,
  RIDE_BONUS: RIDE_BONUS,
});

/* ==========================================================================
   /ride — 叫車首頁（E）
   ========================================================================== */

/* 地圖上的四顆：沿用 SHELL.nearSpots（對不上的 id 直接丟錯，不安靜地少一顆），
   一定含今天的地方；去過的換成 seen（有勾）。收過沒有看 APP.place(id).card（collect 存的 id）。 */
function rideSpots() {
  const m = M();
  let list = SHELL.nearSpots(NEAR_POS);
  if (!list.some(function (s) { return s.id === m.TODAY.id; })) {
    const t = m.SPOTS.filter(function (s) { return s.id === m.TODAY.id; })[0];
    if (t) list = [Object.assign({}, t)].concat(list.slice(0, 3));
  }
  return list.map(function (s) {
    const p = APP.place(s.id);
    const c = p && p.card ? S().card(p.card) : null;
    if (c && s.state !== 'today') s.state = 'seen';
    delete s.x; delete s.y;
    return s;
  });
}

/* 地圖上的浮動鈕與上車點 pin（搭車與探索同一份）。
   搭車：選單、掃碼、通知、定位＋上車點與地址標籤。
   探索：選單、定位＋上車點；不帶地址標籤——家就在水利路，選到的景點常落在標籤底下被它蓋住。 */
function mapOverlay(mode) {
  const ride = mode === 'ride';
  return '' +
    '<a class="fab fab--navy ride-fab ride-fab--menu" href="#/drawer" aria-label="選單" data-act="open-drawer">' +
      '<span data-icon="menu"></span></a>' +
    (ride
      ? '<button class="fab ride-fab ride-fab--scan" type="button" aria-label="掃碼" data-toast="' + TOAST_NA + '">' +
          '<span data-icon="scan"></span></button>' +
        '<a class="fab ride-fab ride-fab--bell" href="#/notify" aria-label="通知" data-act="open-notify">' +
          '<span data-icon="bell"></span></a>'
      : '') +
    '<button class="fab ride-fab ride-fab--loc" type="button" data-recenter aria-label="定位">' +
      '<span data-icon="locate"></span></button>' +
    '<div class="pin ride-pin" data-pin="pickup" style="left:50%; top:60%">' +
      (ride ? '<span class="pin__label">' + esc(home()) + '</span>' : '') +
      '<span class="pin__drop"><span data-icon="hail"></span></span>' +
      '<span class="pin__dot"></span></div>';
}

/* 地圖的浮動鈕是 mount 時才長出來的（APP.map.mount 的 overlay），
   router 在 render 之後替 data-toast 綁 onclick 的那一輪看不到它們，這裡補綁 */
function bindMapToasts(el) {
  el.querySelectorAll('[data-toast]').forEach(function (b) {
    b.onclick = function (e) { if (e) e.preventDefault(); APP.ui.toast(b.getAttribute('data-toast')); };
  });
}

/* 上車點 pin 落在家的真實經緯度 */
function placePickup(map) {
  const H = map.handle, me = H.project(HOME_LL[0], HOME_LL[1]);
  const pin = map.el.querySelector('[data-pin="pickup"]');
  if (!pin) return;
  pin.style.left = (me[0] / H.width * 100).toFixed(1) + '%';
  pin.style.top = (me[1] / H.height * 100).toFixed(1) + '%';
}

/* 變體 F 的兩顆 pill 放在叫車面板裡；底欄仍是叫車／收藏。 */
function rideModePills(mode) {
  const ride = mode === 'ride';
  return '<div class="pill-group pill-group--onwhite ride-mode__pills" aria-label="叫車頁模式">' +
    (ride ? '<span class="ride-mode__active" aria-current="page">搭車</span>'
          : '<button class="pill" type="button" data-act="mode-ride">搭車</button>') +
    (ride ? '<button class="pill" type="button" data-act="mode-explore">探索</button>'
          : '<span class="ride-mode__active" aria-current="page">探索</span>') +
    '</div>';
}

/* 拉把是一顆真的按鈕：鍵盤（Tab → Enter／空白鍵）也叫得回收起來的面板。
   指標的點與拖由 bindDragSheet 處理，它之後瀏覽器補的那一個 click 不再重複切換。 */
function gripHTML(extra, expanded) {
  return '<button class="sheet__grip' + (extra ? ' ' + extra : '') + '" type="button" data-act="toggle-sheet" ' +
    'aria-label="展開／收合面板" aria-expanded="' + (expanded ? 'true' : 'false') + '">' +
    '<span class="sheet__handle"></span></button>';
}

/* 真地圖的代價（concept-map-home ②③④）：玻璃窯在 hs-places 跟家同一個座標、十八尖山落在定位鈕底下。
   景點彼此推開由 core 的 APP.map.mount 做（m.spots 的 px／py 已經是推開後的位置）；
   這裡只讓景點避開叫車首頁自己的東西：浮動鈕、上車點 pin 與地址標籤、狀態列。矩形當場量，
   每個景點從現在的位置往外找最近的淨空處；找不到就留在原地。 */
function keepClear(map) {
  const H = map.handle;
  const box = map.el.getBoundingClientRect();
  if (!box.width || !box.height) return;
  const sx = H.width / box.width, sy = H.height / box.height;   /* CSS px → 地圖 px */
  const rel = function (el) {
    const r = el.getBoundingClientRect();
    return [(r.left - box.left) * sx, (r.top - box.top) * sy, (r.right - box.left) * sx, (r.bottom - box.top) * sy];
  };
  const rects = [[0, 0, H.width, 60]];
  /* 從地圖的容器找：定位鈕搬到了 map.el 外面 */
  map.el.parentElement.querySelectorAll('.fab, .pin, .pin__label').forEach(function (el) { rects.push(rel(el)); });
  const hit = function (a, b, pad) {
    return !(a[2] + pad < b[0] || a[0] - pad > b[2] || a[3] + pad < b[1] || a[1] - pad > b[3]);
  };
  map.spots.forEach(function (s, i) {
    const el = map.spotsEl.querySelector('.spot[data-i="' + i + '"]');
    if (!el) return;
    const w = s.state === 'today' ? 50 : 38;
    let best = null;
    for (let r = 0; r <= 200 && !best; r += 6) {
      for (let a = 0; a < 360; a += 15) {
        const X = s.px + r * Math.cos(a * Math.PI / 180);
        const Y = s.py + r * Math.sin(a * Math.PI / 180);
        const bx = [X - w / 2, Y - w - 8, X + w / 2, Y + 8];
        if (bx[0] < 8 || bx[2] > H.width - 8 || bx[1] < 2 || bx[3] > H.height - 6) continue;
        if (rects.some(function (R) { return hit(bx, R, 4); })) continue;
        best = [X, Y];
        break;
      }
    }
    if (!best) return;
    el.style.left = (best[0] / H.width * 100).toFixed(1) + '%';
    el.style.top = (best[1] / H.height * 100).toFixed(1) + '%';
  });
}

function rideRender() {
  let trip = TRIP.current();
  const pend = TRIP.pending();
  if (trip && trip.phase === 'done') trip = null;      /* 已抵達：不是「回到行程」；限定版另有金色入口 */
  /* 行程進行中：下車點欄位是這一趟的目的地（store.dropoff 可能已經被別的入口改過或清掉），點了回行程 */
  const tp = trip ? tripPlace(trip) : null;
  const d = store().get('dropoff');
  const dp = tp || (d && d.id ? APP.place(d.id) : null);
  /* 公里：行程中用這一趟存的，否則現算；距離不明是 null → 不寫車資與分鐘 */
  const km = tp ? (trip.km != null ? trip.km : kmOf(tp)) : kmOf(dp);

  const dropField = dp
    ? '<div class="route-input__field ride-drop"' + (tp ? ' data-trip-dest' : '') + '>' +
        (tp ? '<a class="ride-drop__main" href="#/trip" data-act="open-trip">'
            : '<a class="ride-drop__main" href="#/dropoff" data-act="pick-dropoff">') +
          '<span class="route-input__label">' + (tp ? '這一趟的下車點' : '下車點') + '</span>' +
          '<span class="route-input__value" data-drop-name>' + esc(dp.name) + '</span>' +
          '<span class="ride-drop__meta">' + esc(dp.type) + ' · ' + esc(distText(dp.dist)) +
            (km == null ? '' :
              ' · 預估 <b class="num ride-em">$<span data-fare>' + F.fare(km) + '</span></b>' +
              ' · 車程 <span class="num" data-min>' + F.rideMin(km) + '</span> 分') + '</span>' +
        '</a>' +
        /* 金色入口在的時候不放「清除」：那一刻的事是先收明信片或叫車（可按數 ≤ 10）；要換地方點下車點本身就好 */
        (tp || pend ? '' : '<button class="ride-drop__clear" type="button" data-act="clear-dropoff">清除</button>') +
      '</div>'
    : '<a class="route-input__field" href="#/dropoff" data-act="pick-dropoff">' +
        '<span class="route-input__value route-input__value--ph">要去哪裡？</span></a>';

  const callText = trip ? '回到行程' : dp ? '叫車前往 ' + dp.name : '選好下車點就可以叫車';

  return '' +
    '<div class="ride-map ride-map--full" data-ride-map>' + RIDE_CREDIT + '</div>' +

    '<div class="banner ride-banner">' +
      '<div class="banner__item ride-banner__promo">' +
        '<span><span class="ride-em">點</span>從天降 · 搭車好禮</span>' +
      '</div>' +
    '</div>' +

    '<div class="sheet ride-sheet ride-sheet--ride">' +
      gripHTML('ride-mode__grip', true) +
      rideModePills('ride') +
      '<h1 class="sheet__greet">' + esc(F.greet(new Date().getHours())) + '，' + esc(M().USER.name) + ' 今天要去哪？</h1>' +
      '<div class="card">' +
        '<div class="route-input">' +
          '<div class="route-input__rail"><span class="route-input__dot"></span>' +
            '<span class="route-input__line"></span><span class="route-input__dot route-input__dot--to"></span></div>' +
          '<div class="route-input__fields">' +
            '<a class="route-input__field" href="#/pickup" data-act="pick-pickup">' +
              '<span class="ride-field__body"><span class="route-input__label">上車點</span>' +
              '<span class="route-input__value" data-pickup-name>' + esc(home()) + '</span></span>' +
              icon('place', 18) + '</a>' +
            dropField +
          '</div>' +
        '</div>' +
      '</div>' +
      /* 一屏一事：選好目的地之後下一步就是叫車，「機場接送」讓位給叫車鈕（可按數 ≤ 10，拉把也算一顆） */
      (dp || trip
        ? '<button class="btn-primary ride-call is-ready" type="button" data-act="call-ride">' + esc(callText) + '</button>'
        : '<div class="ride-sheet__row">' +
            '<button class="btn-pill" type="button" data-toast="' + TOAST_NA + '">' + icon('plane', 18) + '機場接送</button>' +
          '</div>') +
      /* 評分完直接回首頁的人：限定明信片還沒收，收合態就看得到回去解鎖的入口 */
      (pend
        ? '<a class="banner--gold ride-unlock" href="' + pend.href + '" data-act="unlock-ride">' +
            '<span class="banner--gold__shine"></span>' +
            '<span class="banner--gold__in">' +
              '<span class="banner--gold__art" data-art="' + esc(pend.place.art) + '" data-seed="7"></span>' +
              '<span class="banner--gold__txt">' +
                '<span class="banner--gold__eyebrow">' + (pend.limited ? 'yoxi 限定版' : '搭 yoxi 抵達') + '</span>' +
                '<span class="banner--gold__t">' + (pend.limited ? '限定明信片還沒收 · 去解鎖' : '明信片還沒收 · 去收下') + '</span>' +
                '<span class="banner--gold__p">你抵達了' + esc(pend.place.name) + '</span>' +
              '</span>' +
              '<span class="arrow arrow--onred"></span>' +
            '</span>' +
          '</a>'
        : '') +
    '</div>';
}

function rideMount(root) {
  const tb = document.getElementById('tabbar');
  /* 壞掉的行程／下車點（id 不認得）清掉；render 已經把它們當成沒有 */
  dropBroken();
  /* 評分完直接回首頁的人：限定明信片還沒收 → trip 留著（render 畫了金色入口）；
     已經收過（別的路收的）→ 這趟沒有東西要等了，安靜收掉 */
  const t0 = TRIP.current();
  if (t0 && t0.phase === 'done' && !TRIP.pending()) TRIP.clear();

  /* ---- sheet 與地圖 ---- */
  const sheet = root.querySelector('.ride-sheet');
  const grip = sheet.querySelector('.sheet__grip');
  /* 兩段：open 叫車欄位／hidden 只剩拉把。open 的高度＝內容高（換寬度會重排，地圖重畫時一起重量） */
  let openH = 0;
  function measureOpen() {
    openH = Math.ceil(sheet.scrollHeight);
    sheet.style.setProperty('--ride-open-height', openH + 'px');
  }
  const ctl = rideMap(root, sheet, function () {
    return { spots: false, max: 4, overlay: mapOverlay('ride') };
  }, measureOpen);

  const clr = root.querySelector('[data-act="clear-dropoff"]');
  if (clr) clr.onclick = function () { clearDropoff(); };
  const call = root.querySelector('[data-act="call-ride"]');
  if (call) call.onclick = function () { callRide(); };
  /* 跟探索同一套拉法：跟手、放開接續動畫、點拉把切換 */
  let state = 'open';
  const stopDrag = bindDragSheet(sheet, {
    order: ['hidden', 'open'],
    get: function () { return state; },
    set: function (next) {
      state = next;
      hideSheetBody(sheet, next === 'hidden');
      grip.setAttribute('aria-expanded', next === 'open' ? 'true' : 'false');
    },
    tap: function (from) { return from === 'open' ? 'hidden' : 'open'; },
    heights: function () { return { hidden: ctl.map.peek, open: openH }; },
    dragStart: function () { sheet.classList.remove('is-hidden'); },
  });

  return function () {
    stopDrag();
    ctl.destroy();
    if (tb) tb.classList.remove('is-yield');
  };
}

/* ==========================================================================
   探索模式：預選最近地點，面板上拉看疊放卡片，點開在本頁懸浮翻面。
   四組卡片是展示用的明確對應；收集狀態仍由 STATE 決定。
   ========================================================================== */
const CARD_AREAS = [
  { id: 'glass-kiln', name: '水利路', cards: ['p11', 'p17'] },
  { id: 'market', name: '東門與舊城', cards: ['p1', 'p2', 'p7', 'p20'] },
  { id: 'moat', name: '護城河', cards: ['p3', 'p19'] },
  { id: 'hill', name: '十八尖山', cards: ['p6', 'p21'] },
];
function cardArea(id) { return CARD_AREAS.filter(function (a) { return a.id === id; })[0] || null; }
/* 距離不明的地區不參加「最近」（不然 null 會被當成 0 m） */
function nearestCardArea() {
  let best = CARD_AREAS[0], bestD = Infinity;
  CARD_AREAS.forEach(function (area) {
    const p = APP.place(area.id);
    if (p && p.dist != null && p.dist < bestD) { best = area; bestD = p.dist; }
  });
  return best;
}
function areaProgress(a) {
  return { done: a.cards.filter(function (id) { return S().has(id); }).length, total: a.cards.length };
}
function areaCard(id) { return (M().POSTCARDS || []).filter(function (p) { return p.id === id; })[0] || null; }
function areaCardsHTML(a) {
  const r = areaProgress(a), p = APP.place(a.id);
  const d = p && p.dist != null ? '離你 ' + F.dist(p.dist) : DIST_TBD;
  return '<div class="ride-v2__section"><h2>' + esc(a.name) + '的卡片</h2>' +
      '<p>收集 ' + r.done + '/' + r.total + ' · ' + esc(d) + '</p></div>' +
    '<div class="ride-v2__stack" data-stack-size="' + a.cards.length + '">' + a.cards.map(function (id) {
      const c = areaCard(id);
      if (!c) return '';
      const got = S().has(id);
      return '<button class="ride-v2__card' + (got ? ' is-collected' : '') + '" type="button" data-act="open-card" data-card="' + esc(id) + '" aria-label="看看卡片：' + esc(c.name) + '">' +
        '<span class="ride-v2__card-art" data-art="' + esc(c.art) + '" data-seed="' + M().POSTCARDS.indexOf(c) + '" data-card-art="' + esc(id) + '">' +
          '<span class="ai-mark">AI 生成示意</span></span>' +
        '<strong>' + esc(c.name) + '</strong></button>';
    }).join('') + '</div>';
}
/* 探索面板收合態的自然高度：拉把＋模式切換＋地點資訊（卡片收合時不佔位）。
   寫回 --sheet-min，收合／收起的動畫才不會先在多出來的高度裡空轉。 */
function exploreCollapsedH(sheet) {
  const intro = sheet.querySelector('[data-area-intro]');
  return Math.ceil(intro.offsetTop + intro.offsetHeight + parseFloat(getComputedStyle(sheet).paddingBottom));
}
/* 探索面板展開的高度＝ride.css 的 --sheet-max（82%，相對於 main.view），JS 不另抄一份 */
function sheetMaxPx(sheet) {
  const v = getComputedStyle(sheet).getPropertyValue('--sheet-max').trim();
  const n = parseFloat(v);
  const box = sheet.parentElement.clientHeight;
  if (!isFinite(n)) return box;
  return /%$/.test(v) ? box * n / 100 : n;
}
/* 標籤照資料寫：今天的地方＝MOCK.TODAY；預選的是最近的地區；其餘是使用者從地圖選的 */
function areaLabel(a) {
  const today = M().TODAY;
  if (today && today.id === a.id) return '今天的地方';
  return nearestCardArea().id === a.id ? '離你最近' : '你選的地方';
}
function areaIntroHTML(a) {
  const p = APP.place(a.id);
  const hook = p.hook && p.hook.indexOf('收集於') !== 0 ? p.hook : p.type;
  const meta = p.dist != null ? '離你 ' + F.dist(p.dist) + ' · 走路 ' + F.walkMin(p.dist) + ' 分鐘' : DIST_TBD;
  return '<div class="ride-v2__eyebrow">' + esc(areaLabel(a)) + '</div>' +
    '<div class="ride-v2__feature">' +
      '<span class="ride-v2__feature-art" data-art="' + esc(p.art) + '" data-seed="1"></span>' +
      '<span class="ride-v2__feature-copy"><strong>' + esc(p.name) + '</strong>' +
        '<span class="ride-v2__feature-hook">' + esc(hook) + '</span>' +
        '<span class="ride-v2__feature-meta">' + esc(meta) + '</span></span>' +
    '</div>' +
    '<div class="ride-v2__actions">' +
      '<button class="btn-primary" type="button" data-act="use-yoxi">用 yoxi</button>' +
      '<button class="btn-ghost" type="button" data-act="expand-cards">收集</button>' +
    '</div>';
}
/* 懸浮小卡：翻面鈕在前、關閉鈕在後（關閉鈕用定位放在右上角），Tab 在兩顆之間繞。
   掛在 .device 上（main.view 外面）：遮罩連底欄一起蓋住；data-overlay 讓 core 導覽時收掉它 */
function rideCardFloatHTML() {
  return '<div class="ride-card-float" data-card-float data-overlay role="dialog" aria-modal="true" aria-label="卡片" hidden>' +
    '<div class="ride-card-float__wrap">' +
      '<button class="ride-card-float__object" type="button" data-act="flip-card" aria-label="翻到卡片背面" aria-pressed="false">' +
        '<span class="ride-card-float__front" data-card-front></span>' +
        '<span class="ride-card-float__back" data-card-back></span>' +
      '</button>' +
      '<span class="ride-card-float__hint">點卡片翻面</span>' +
      '<button class="ride-card-float__close" type="button" data-act="close-card" aria-label="關閉卡片">×</button>' +
    '</div></div>';
}
function rideV2Render(params, ctx) {
  const a = cardArea(ctx.query.get('area')) || nearestCardArea();
  return '<div class="ride-map ride-map--full ride-v2__map" data-ride-map>' + RIDE_CREDIT + '</div>' +
    '<section class="sheet sheet--drag is-collapsed ride-sheet ride-v2__sheet" style="--sheet-min:390px">' +
      gripHTML('', false) +
      rideModePills('explore') +
      '<div class="ride-v2__intro" data-area-intro>' + areaIntroHTML(a) + '</div>' +
      '<div class="ride-v2__expanded" data-expand-only data-area-expanded>' + areaCardsHTML(a) + '</div>' +
    '</section>';
}
function rideV2Mount(root, params, ctx) {
  const sheet = root.querySelector('.ride-sheet');
  const grip = sheet.querySelector('.sheet__grip');
  const host = root.querySelector('[data-ride-map]');
  const intro = root.querySelector('[data-area-intro]');
  const expanded = root.querySelector('[data-area-expanded]');
  const tabbar = document.getElementById('tabbar');
  let selected = cardArea(ctx.query.get('area')) || nearestCardArea();
  if (!cardArea(ctx.query.get('area'))) APP.nav.replaceQuery('mode=explore&area=' + encodeURIComponent(selected.id));
  function markSelected(map) {
    map.spotsEl.querySelectorAll('.spot').forEach(function (el) {
      el.classList.toggle('is-selected', !!selected && el.getAttribute('data-spot') === selected.id);
    });
  }
  const ctl = rideMap(root, sheet, function () {
    return {
      spots: store().get('rideSpots') === false ? false : rideSpots(), max: 4,
      overlay: mapOverlay('explore'), onSpot: function (s) { selectArea(s.id, true); },
    };
  }, markSelected);
  /* 三段：hidden 只剩拉把（看整張地圖）／collapsed 地點資訊／open 接著看卡片 */
  let state = 'collapsed';
  function setSheet(next) {
    state = next;
    sheet.classList.toggle('is-collapsed', next !== 'open');
    hideSheetBody(sheet, next === 'hidden');
    grip.setAttribute('aria-expanded', next === 'open' ? 'true' : 'false');
    if (tabbar) tabbar.classList.toggle('is-yield', next === 'open');
  }
  function paint() {
    intro.innerHTML = areaIntroHTML(selected);
    expanded.innerHTML = areaCardsHTML(selected);
    SHELL.injectArt(intro);
    SHELL.injectArt(expanded);
    SHELL.injectIcons(sheet);
    sheet.style.setProperty('--sheet-min', exploreCollapsedH(sheet) + 'px');
    intro.querySelector('[data-act="expand-cards"]').onclick = function () { setSheet('open'); };
    intro.querySelector('[data-act="use-yoxi"]').onclick = function () { setDropoff(selected.id, 'e'); };
    expanded.querySelectorAll('[data-act="open-card"]').forEach(function (b) {
      b.onclick = function () { openCard(b.getAttribute('data-card'), b); };
    });
    markSelected(ctl.map);
  }
  function selectArea(id, fromMap) {
    selected = cardArea(id) || nearestCardArea();
    APP.nav.replaceQuery('mode=explore&area=' + encodeURIComponent(selected.id));
    paint();
    if (fromMap) setSheet('collapsed');    /* 收到只剩拉把時，點景點把面板叫回來 */
  }

  /* ---- 懸浮小卡 ----
     第一次打開才建、掛在 .device 上（main.view 外面、data-overlay）：遮罩連底欄一起蓋住，
     導覽時 core 的 dismissOverlays 叫 _dismiss 收掉（舊版 core 沒有它：這一頁的 cleanup 也會收）。
     APP.ui.a11yDialog 管焦點、Esc、關掉後焦點回到點開的那張卡。新版 core 的 a11yDialog 另外讓 #view／#tabbar inert、
     Tab 在框裡繞；舊版沒有（看有沒有 APP.ui.dismissOverlays）就在這裡自己補。 */
  const coreDialog = typeof APP.ui.dismissOverlays === 'function';
  let floating = null, floatCard = null, release = null, returnFocus = null;
  function behind(on) {
    if (coreDialog) return;
    ['view', 'tabbar'].forEach(function (id) { const el = document.getElementById(id); if (el) el.inert = on; });
  }
  function ensureFloat() {
    if (floating && floating.isConnected) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = rideCardFloatHTML();
    floating = wrap.firstChild;
    (document.querySelector('.device') || document.body).appendChild(floating);
    floatCard = floating.querySelector('[data-act="flip-card"]');
    const closeBtn = floating.querySelector('[data-act="close-card"]');
    floatCard.onclick = function () {
      const flipped = floatCard.classList.toggle('is-flipped');
      floatCard.setAttribute('aria-pressed', flipped ? 'true' : 'false');
      floatCard.setAttribute('aria-label', flipped ? '翻回卡片正面' : '翻到卡片背面');
    };
    closeBtn.onclick = closeCard;
    floating.onclick = function (e) { if (e.target === floating) closeCard(); };
    /* Tab／Shift+Tab 在小卡的兩顆按鈕之間繞，不跑到 demo 面板或網址列（新版 core 的 a11yDialog 自己會做） */
    if (!coreDialog) {
      floating.onkeydown = function (e) {
        if (e.key !== 'Tab') return;
        const f = [floatCard, closeBtn];
        const i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[i < 0 ? 0 : (i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
      };
    }
    floating._dismiss = dismissFloat;
  }
  /* 收起來並拆掉（導覽、這一頁 cleanup）；可以重複叫 */
  function dismissFloat() {
    closeCard();
    if (floating) floating.remove();
    floating = null;
  }
  function closeCard() {
    if (!floating || floating.hidden) return;
    behind(false);
    floating.hidden = true;
    const r = release;
    release = null;
    if (r) r();
    /* Safari 點按鈕不會把焦點給它，a11yDialog 記到的是 body：退回點開的那張卡 */
    const now = document.activeElement;
    if (returnFocus && returnFocus.isConnected && !returnFocus.closest('[inert]') && (!now || now === document.body)) returnFocus.focus();
    returnFocus = null;
  }
  function openCard(id, button) {
    const c = areaCard(id);
    if (!c) return;
    ensureFloat();
    closeCard();
    returnFocus = button;
    floating.setAttribute('aria-label', c.name);
    floatCard.classList.remove('is-flipped');
    floatCard.setAttribute('aria-pressed', 'false');
    floatCard.setAttribute('aria-label', '翻到卡片背面');
    /* 金框的卡浮起來看也是金框、有金粉（explore-gold.js）：框畫在整張卡上，所以標在這裡，
       paintCardArt 看到外層標了就不再替裡面的插圖補一個 */
    const origin = APP.explore.cardOrigin(id);
    const gold = !!(origin && origin.gold);
    floatCard.classList.toggle('is-gold', gold);
    floatCard.toggleAttribute('data-gold-aura', gold);
    floating.querySelector('[data-card-front]').innerHTML =
      '<span class="ride-card-float__art" data-art="' + esc(c.art) + '" data-seed="' + M().POSTCARDS.indexOf(c) + '" data-card-art="' + esc(id) + '"></span>' +
      '<span class="ride-card-float__name">' + esc(c.name) + '</span><span class="ai-mark">AI 生成示意</span>';
    floating.querySelector('[data-card-back]').innerHTML =
      '<span class="ride-card-float__back-mark">yoxi 城事</span><strong>' + esc(c.name) + '</strong>' +
      '<span>' + (S().has(id) ? '已收藏' : '抵達後可以收下') + '</span>';
    SHELL.injectArt(floating);             /* 收下的那一款由 explore-face.js 自己疊上（它監看整台 .device） */
    floating.hidden = false;
    /* 先交給 a11yDialog（它記下現在的焦點＝點開的卡），再把背後變 inert（inert 會把焦點踢掉） */
    release = APP.ui.a11yDialog(floating, { label: c.name, onEsc: closeCard, focus: floatCard });
    behind(true);
  }
  paint();
  const stopDrag = bindDragSheet(sheet, {
    order: ['hidden', 'collapsed', 'open'],
    get: function () { return state; },
    set: setSheet,
    tap: function (from) { return from === 'collapsed' ? 'open' : 'collapsed'; },
    heights: function () {
      return { hidden: ctl.map.peek, collapsed: exploreCollapsedH(sheet), open: sheetMaxPx(sheet) };
    },
    /* 收合態的卡片堆是 display:none，面板長不高：真的開始拖時先拿掉 is-collapsed，讓它排版、跟得上手指 */
    dragStart: function () { sheet.classList.remove('is-collapsed', 'is-hidden'); },
  });
  return function () {
    dismissFloat();
    stopDrag();
    ctl.destroy();
    if (tabbar) tabbar.classList.remove('is-yield');
  };
}

/* ==========================================================================
   叫車首頁的地圖（搭車與探索同一套）：面板收到只剩拉把、整張地圖露出來
   ========================================================================== */
/* 地圖一開始就畫成面板只剩拉把時的高度、貼齊上緣，面板只是蓋在上面：
   收放時地圖不縮放，pin 與景點不會跟街道錯開。中心往南挪（全高 − 現在可見高）的一半，
   現在看到的範圍跟原本一樣。定位鈕搬到容器上，貼著可見範圍的右下角跟著面板上下
   （它的回到原位在 mount 時已經綁好）。回傳的 map 多一個 peek：只剩拉把時面板的高度；
   destroy 連搬出去的定位鈕一起拆。
   容器是 flex:1、面板吃剩下的：容器高＋面板高是定值，面板在哪一段（或拖到一半）算出來的全高都一樣。 */
function mountFullMap(host, sheet, opt) {
  const grip = sheet.querySelector('.sheet__grip');
  const peek = Math.ceil(grip.offsetTop + grip.offsetHeight);
  sheet.style.setProperty('--ride-peek-h', peek + 'px');
  const fullH = Math.max(host.clientHeight, host.clientHeight + sheet.offsetHeight - peek);
  host.style.setProperty('--ride-map-h', fullH + 'px');
  const c = HSMAP.toM(RIDE_CENTER[0], RIDE_CENTER[1]);
  const map = APP.map.mount(host, Object.assign({
    style: 'paper', spanM: RIDE_SPAN, compact: true, pan: true, layers: { label: true },
    center: HSMAP.toLL(c[0], c[1] + (fullH - host.clientHeight) / 2 * RIDE_SPAN / host.clientWidth),
  }, opt));
  const loc = map.el.querySelector('.ride-fab--loc');
  if (loc) host.appendChild(loc);
  map.peek = peek;
  const destroy = map.destroy;
  map.destroy = function () { destroy(); if (loc) loc.remove(); };
  return map;
}

/* 叫車首頁的地圖控制：畫地圖、放上車點 pin、補綁浮動鈕、讓景點避開浮動鈕，
   視窗改大小（手機轉向、網址列收放）時整張重畫——地圖高度、中心、只剩拉把的高度都是當下量的。
   opts() 每次重畫都重新產生 APP.map.mount 的選項；after(map) 在每次畫好之後叫。回傳 { map, destroy }，map 會換。 */
function rideMap(root, sheet, opts, after) {
  const host = root.querySelector('[data-ride-map]');
  const ctl = { map: null };
  function draw() {
    /* 舊的地圖連同它掛在 window 上的拖曳 listener 一起拆（APP.map.mount 的 destroy） */
    if (ctl.map) ctl.map.destroy();
    const map = mountFullMap(host, sheet, opts());
    ctl.map = map;
    placePickup(map);
    SHELL.injectIcons(host);
    bindMapToasts(host);
    keepClear(map);
    if (after) after(map);
  }
  draw();
  /* main.view 的大小變了才重畫（observe 當下那一次、面板收放都不算）。
     ResizeObserver 為主；window resize 也接（沒有 ResizeObserver 的瀏覽器、測試環境補發的事件） */
  let size = [root.clientWidth, root.clientHeight], timer = null;
  function check() {
    const now = [root.clientWidth, root.clientHeight];
    if (now[0] === size[0] && now[1] === size[1]) return;
    size = now;
    clearTimeout(timer);
    timer = setTimeout(function () { if (root.isConnected && now[0] > 0 && now[1] > 0) draw(); }, 80);
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(check) : null;
  if (ro) ro.observe(root);
  window.addEventListener('resize', check);
  ctl.destroy = function () {
    if (ro) ro.disconnect();
    window.removeEventListener('resize', check);
    clearTimeout(timer);
    if (ctl.map) ctl.map.destroy();
  };
  return ctl;
}

/* 只剩拉把：拉把以外的東西不能被 Tab 到（看不見，但還在版面裡） */
function hideSheetBody(sheet, hidden) {
  sheet.classList.toggle('is-hidden', hidden);
  Array.prototype.forEach.call(sheet.children, function (el) {
    if (!el.classList.contains('sheet__grip')) el.inert = hidden;
  });
}

/* 拉把跟手，放手時只往拖的方向換段；那個方向有兩段可選時，挑離「放手高度＋甩出去的慣性」最近的。
   移動 ≤ TAP_PX 算點一下 → opt.tap(目前段)。高度一律用 CSS px（桌機外框會縮放，clientY 要除回去）。
   只認主要指標的左鍵（右鍵拖、第二根手指不算）；抓住指標（setPointerCapture），
   丟了 capture、滑鼠放開卻沒收到 pointerup（macOS 右鍵選單會吃掉）、視窗失焦 → 這次拖曳作廢、回原段。
   段高在 pointerdown 量一次：拖曳中每個 move 只寫 max-height、不讀版面。
   鍵盤：拉把是 <button>，onclick 換段；指標剛處理過的那一下（pointerup 之後瀏覽器補的 click）不再換。
   opt：order 由低到高的段名、heights() → { 段名: px }、get()／set(段名)、tap(段名) → 段名、
        dragStart()（超過 TAP_PX、真的開始拖時叫一次） */
const TAP_PX = 8;
const FLING_MS = 150;        /* 放手時的速度往前推多久 */
const FLING_MAX = 1.5;       /* 速度上限（px/ms）：甩得再快也只多推 225 px */
/* 放手之後停在哪一段（純函式；node 測試直接測它）。order 由低到高的段名、heights { 段名: px }、from 放手前的段、
   moved 拖了多少 px（往上是正）、base 開始拖時的高度、v 放手時的速度（px/ms，往上是正；上限與「停太久不算甩」
   由呼叫的人處理）。移動 ≤ TAP_PX 不換段；只往拖的方向換，那個方向有兩段可選時挑離「放手高度＋甩出去的慣性」最近的。 */
function snapTarget(order, heights, from, moved, base, v) {
  if (Math.abs(moved) <= TAP_PX) return from;
  const i = order.indexOf(from);
  const at = base + moved + (v || 0) * FLING_MS;
  let next = from;
  order.forEach(function (s, j) {
    if (moved > 0 ? j <= i : j >= i) return;
    if (next === from || Math.abs(heights[s] - at) < Math.abs(heights[next] - at)) next = s;
  });
  return next;
}
function bindDragSheet(sheet, opt) {
  const grip = sheet.querySelector('.sheet__grip');
  const order = opt.order;
  let y0 = null, pointer = null, moved = 0, base = 0, k = 1, from = null, h = null, dragging = false;
  let lastY = 0, lastT = 0, vel = 0, pointerAt = 0;
  function now(e) { return (e && e.timeStamp) || performance.now(); }
  function down(e) {
    if (e.button > 0) return;                               /* 右鍵、中鍵 */
    if (e.pointerType && e.isPrimary === false) return;     /* 第二根手指 */
    if (y0 !== null) abort();       /* 上一次的 pointerup 掉了（同一個指標又按下／新的主要指標）：作廢重來 */
    y0 = e.clientY;
    pointer = e.pointerId;
    moved = 0;
    dragging = false;
    vel = 0;
    lastY = e.clientY;
    lastT = now(e);
    base = sheet.offsetHeight;
    k = sheet.getBoundingClientRect().height / base || 1;
    from = opt.get();
    h = opt.heights();
    sheet.style.transition = 'none';
    try { grip.setPointerCapture(e.pointerId); } catch (err) { /* 合成的事件沒有真的指標 */ }
  }
  function move(e) {
    if (y0 === null || e.pointerId !== pointer) return;
    if (e.pointerType && e.buttons === 0) { abort(); return; }
    moved = (y0 - e.clientY) / k;
    const t = now(e);
    if (t > lastT) {
      const v = (lastY - e.clientY) / k / (t - lastT);
      vel = vel * 0.3 + v * 0.7;
      lastY = e.clientY;
      lastT = t;
    }
    if (!dragging && Math.abs(moved) > TAP_PX) {
      dragging = true;
      if (opt.dragStart) opt.dragStart();
    }
    if (!dragging) return;
    e.preventDefault();
    sheet.style.maxHeight = Math.max(h[order[0]], Math.min(h[order[order.length - 1]], base + moved)) + 'px';
  }
  function end() {
    sheet.style.transition = '';
    sheet.style.maxHeight = '';
    try { if (pointer != null && grip.hasPointerCapture(pointer)) grip.releasePointerCapture(pointer); } catch (err) { /* ignore */ }
    y0 = null;
    pointer = null;
    h = null;
    dragging = false;
  }
  function abort() {
    if (y0 === null) return;
    const back = from;
    end();
    opt.set(back);            /* dragStart 拿掉的 class 裝回去 */
  }
  function up(e) {
    if (y0 === null || e.pointerId !== pointer) return;
    pointerAt = Date.now();
    let next = from;
    if (!dragging) next = opt.tap(from);
    else {
      /* 放手前 80 ms 沒動就不算甩；甩得再快也只算到 FLING_MAX */
      const v = now(e) - lastT > 80 ? 0 : Math.max(-FLING_MAX, Math.min(FLING_MAX, vel));
      next = snapTarget(order, h, from, moved, base, v);
    }
    end();
    opt.set(next);
  }
  function cancel(e) {
    if (y0 !== null && e.pointerId === pointer) abort();
  }
  function blur() { abort(); }
  grip.style.cursor = 'grab';
  grip.onclick = function () {
    if (Date.now() - pointerAt < 500) return;
    opt.set(opt.tap(opt.get()));
  };
  grip.addEventListener('pointerdown', down);
  grip.addEventListener('lostpointercapture', cancel);
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('blur', blur);
  return function () {
    if (y0 !== null) end();
    grip.onclick = null;
    grip.removeEventListener('pointerdown', down);
    grip.removeEventListener('lostpointercapture', cancel);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('blur', blur);
  };
}

APP.view('ride', {
  path: '/ride', tab: 'ride', status: 'dark', root: true, title: '叫車',
  render: function (params, ctx) {
    return ctx.query.get('mode') === 'explore' ? rideV2Render(params, ctx) : rideRender();
  },
  mount: function (root, params, ctx) {
    const explore = ctx.query.get('mode') === 'explore';
    const cleanup = explore ? rideV2Mount(root, params, ctx) : rideMount(root);
    const switcher = root.querySelector('[data-act="mode-' + (explore ? 'ride' : 'explore') + '"]');
    switcher.onclick = function () {
      APP.nav.go(explore ? '/ride' : '/ride?mode=explore', { replace: true, dir: 'none' });
    };
    return cleanup;
  },
});

/* ==========================================================================
   /dropoff — 設定下車地點（清單＋搜尋）
   ========================================================================== */
APP.view('dropoff', {
  path: '/dropoff', tab: 'ride', status: 'dark', title: '設定下車地點',
  render: function () {
    return '' +
      '<header class="hdr-plain ride-hdr-plain">' +
        '<a href="#" data-back="/ride" class="ride-back" aria-label="返回"><span class="arrow arrow--left"></span></a>' +
        '<span class="hdr-plain__title">設定下車地點</span><span class="ride-back ride-back--ghost"></span>' +
      '</header>' +
      '<div class="ride-search">' +
        '<span class="route-input__dot route-input__dot--to"></span>' +
        '<label class="ride-search__box">' +
          '<input type="search" data-act="search-dropoff" placeholder="搜尋地名或類型" autocomplete="off" enterkeyhint="search">' +
        '</label>' +
      '</div>' +
      '<div class="scroll ride-list">' +
        '<a class="row-nav" href="#/ride?mode=explore" data-act="pick-on-map">' +
          '<span class="tile-icon tile-icon--lg tile-icon--round ride-tile--navy"><span class="ic-ondark" data-icon="place"></span></span>' +
          '<span class="row-nav__body"><span class="row-nav__title">在地圖上挑</span>' +
          '<span class="row-nav__sub">在地圖選附近有卡片的地方</span></span>' +
          '<span class="arrow"></span></a>' +
        '<div class="ride-gap"></div>' +
        '<div data-drop-list></div>' +
      '</div>';
  },
  mount: function (root) {
    const all = APP.places().slice().sort(function (a, b) {
      const x = a.dist == null ? Infinity : a.dist, y = b.dist == null ? Infinity : b.dist;
      return x - y;
    });
    const input = root.querySelector('[data-act="search-dropoff"]');
    const list = root.querySelector('[data-drop-list]');
    let expanded = false;

    function draw() {
      const q = (input.value || '').trim().toLowerCase();
      const hit = all.filter(function (p) {
        return !q || (p.name + ' ' + p.type).toLowerCase().indexOf(q) >= 0;
      });
      const shown = expanded ? hit : hit.slice(0, DROP_LIMIT);
      if (!hit.length) {
        list.innerHTML = '<p class="ride-list__none">找不到「' + esc(input.value.trim()) + '」。換個字試試，或在地圖上挑。</p>';
        return;
      }
      list.innerHTML = shown.map(function (p) {
        const walk = F.canWalk(p.dist);
        return '<button class="row-nav ride-row" type="button" data-act="choose-dropoff" data-id="' + esc(p.id) + '">' +
          '<span class="ride-row__art" data-art="' + esc(p.art) + '" data-seed="2"></span>' +
          '<span class="row-nav__body">' +
            '<span class="row-nav__title">' + esc(p.name) + '</span>' +
            '<span class="row-nav__sub">' + esc(p.type) + ' · ' + esc(distText(p.dist)) + '</span>' +
          '</span>' +
          '<span class="ride-tag ' + (walk ? 'ride-tag--walk' : 'ride-tag--ride') + '">' + (walk ? '走得到' : '叫車') + '</span>' +
        '</button>';
      }).join('') +
      (hit.length > shown.length
        ? '<button class="ride-more" type="button" data-act="more-dropoff">全部 ' + hit.length + ' 個地方</button>' : '');
      SHELL.injectArt(list);
      list.querySelectorAll('[data-act="choose-dropoff"]').forEach(function (b) {
        /* 選好了就回到叫車首頁那一格（跟 /pickup 一樣退回去），不在歷史裡再疊一個 /ride */
        b.onclick = function () { if (writeDropoff(b.getAttribute('data-id'), 'search')) backToRide(); };
      });
      const more = list.querySelector('[data-act="more-dropoff"]');
      if (more) more.onclick = function () { expanded = true; draw(); };
    }
    input.oninput = function () { draw(); };
    /* 在地圖上挑：這一頁換成探索模式的叫車首頁（返回回到原本的叫車首頁；在地圖上選好也退回那一格） */
    root.querySelector('[data-act="pick-on-map"]').onclick = function (e) {
      if (e) e.preventDefault();
      backToRide('mode=explore');
    };
    draw();
  },
});

/* ==========================================================================
   /pickup — 設定上車地點（pickup.html）
   ========================================================================== */
APP.view('pickup', {
  path: '/pickup', tab: 'ride', status: 'dark', title: '設定上車地點',
  render: function () {
    return '' +
      '<header class="hdr-plain ride-hdr-plain">' +
        '<a href="#" data-back="/ride" class="ride-back" aria-label="返回"><span class="arrow arrow--left"></span></a>' +
        '<span class="hdr-plain__title">設定上車地點</span><span class="ride-back ride-back--ghost"></span>' +
      '</header>' +
      '<div class="ride-search">' +
        '<span class="route-input__dot"></span>' +
        '<label class="ride-search__box">' +
          '<input type="text" value="' + esc(home()) + '" aria-label="上車點" autocomplete="off">' +
          '<span data-icon="camera" class="ride-search__cam"></span>' +
        '</label>' +
      '</div>' +
      '<div class="scroll ride-list">' +
        PICKUPS.map(function (p, i) {
          return '<button class="row-nav ride-row" type="button" data-act="choose-pickup" data-i="' + i + '">' +
            '<span class="tile-icon tile-icon--red tile-icon--lg tile-icon--round"><span class="ic-ondark" data-icon="place"></span></span>' +
            '<span class="row-nav__body"><span class="row-nav__title">' + esc(p.name) + '</span>' +
            '<span class="row-nav__sub">' + esc(p.area) + '</span></span>' +
            '<span class="arrow arrow--ne"></span></button>';
        }).join('') +
        '<div class="ride-more-wrap"><button class="ride-more" type="button" data-toast="' + TOAST_NA + '">搜尋更多</button></div>' +
        '<div class="ride-gap"></div>' +
        '<button class="row-nav ride-row" type="button" data-toast="' + TOAST_NA + '">' +
          '<span class="tile-icon tile-icon--lg tile-icon--round ride-tile--navy"><span class="ic-ondark" data-icon="place"></span></span>' +
          '<span class="row-nav__body"><span class="row-nav__title">在地圖上設定地點</span></span></button>' +
      '</div>';
  },
  mount: function (root) {
    root.querySelectorAll('[data-act="choose-pickup"]').forEach(function (b) {
      b.onclick = function () {
        const p = PICKUPS[Number(b.getAttribute('data-i'))];
        /* 第一列就是家：選回家就回到預設 */
        pickupName = p.name === PICKUPS[0].name ? null : '東區' + p.name;
        APP.ui.toast('上車點已更新');
        backToRide();
      };
    });
  },
});

/* ==========================================================================
   /trip — 配對中 → 行程中（ride.html）
   ========================================================================== */
function tripMapOpts(p) {
  const dLL = (p && p.lat != null) ? [p.lat, p.lon] : null;
  if (!dLL) return { center: HOME_LL, spanM: 2400, dLL: null };
  const dist = p.dist || 0;
  /* 視野依距離：近的地方整段看得到；遠的（內灣 28 km）超出底圖，目的地夾在邊緣 */
  const spanM = Math.max(2400, Math.min(10000, dist * 1.5));
  const f = dist > 6000 ? 0.18 : 0.5;          /* 遠的：中心只往目的地挪一點，家還在畫面裡 */
  const center = [HOME_LL[0] + (dLL[0] - HOME_LL[0]) * f, HOME_LL[1] + (dLL[1] - HOME_LL[1]) * f];
  return { center: center, spanM: spanM, dLL: dLL };
}

APP.view('trip', {
  path: '/trip', tab: null, status: 'light',
  title: function () { return TRIP.phase(TRIP.current()) === 'matching' ? '正在找車' : '行程中'; },
  render: function () {
    const t = TRIP.current();
    const p = tripPlace(t);
    if (!t || !p) {
      return '<header class="hdr-red hdr-red--compact"><div class="hdr-red__bar"><h1 class="hdr-red__title">行程</h1></div></header>' +
        emptyCard('行程', '目前沒有行程', '選一個下車點就可以叫車。');
    }
    if (t.phase === 'done') {
      return '<header class="hdr-red hdr-red--compact"><div class="hdr-red__bar"><h1 class="hdr-red__title">已抵達</h1></div></header>' +
        '<div class="app-empty"><div class="app-empty__card"><p class="app-empty__eyebrow">行程</p>' +
        '<h1 class="app-empty__t">你已經抵達 ' + esc(p.name) + '</h1>' +
        '<a class="btn-primary" href="#/trip/done" data-act="go-done">看這趟的結算</a></div></div>';
    }
    /* 距離不明（km 是 null）：不寫分鐘與車資，免得出現起跳價與 3 分鐘這種沒算過的數字 */
    const km = t.km != null ? t.km : kmOf(p);
    const min = km == null ? null : F.rideMin(km);
    const rs = p.raw && p.raw.inRideStory;
    const story = p.story || [];
    const pick = story.filter(function (s) { return s.label === '以前的它'; })[0] || story[0];
    const heading = rs ? rs.heading : (p.name + ' 以前是什麼樣子');
    const paras = rs ? [rs.text].concat(pick ? [pick.text] : []) : story.slice(0, 2).map(function (s) { return s.text; });
    const matching = TRIP.phase(t) === 'matching';

    return '' +
      '<header class="hdr-red hdr-red--compact ride-trip-hdr">' +
        '<div class="hdr-red__bar"><h1 class="hdr-red__title">前往 ' + esc(p.name) + '</h1></div>' +
      '</header>' +
      '<div class="ride-map ride-map--trip" data-trip-map></div>' +
      '<div class="sheet ride-trip-sheet">' +
        '<div class="sheet__handle"></div>' +

        '<div data-phase="matching"' + (matching ? '' : ' hidden') + '>' +
          '<div class="u-row u-gap4 ride-trip__match">' +
            '<span class="tile-icon tile-icon--lg ride-pulse">' + icon('tabRide', 26) + '</span>' +
            '<span class="u-fill"><span class="ride-trip__big">正在為你找車…</span>' +
            '<span class="ride-trip__sub">往' + esc(p.area || p.name) + '方向的車正在媒合</span></span>' +
          '</div>' +
        '</div>' +

        '<div data-phase="riding"' + (matching ? ' hidden' : '') + '>' +
          '<div class="u-row u-gap4 ride-trip__driver">' +
            '<span class="tile-icon tile-icon--xl">' + icon('moodGood', 28) + '</span>' +
            '<span class="u-fill"><span class="ride-trip__big">' + esc(DRIVER.name) + ' · ' + esc(DRIVER.plate) + '</span>' +
            '<span class="ride-trip__sub">' + esc(DRIVER.car) + '</span></span>' +
            (min == null ? '' :
              '<span class="ride-trip__eta"><span class="num" data-min>' + min + '</span><span>分鐘後抵達</span></span>') +
          '</div>' +
          (km == null
            ? '<div class="ride-trip__fare">預估車資 · ' + DIST_TBD + '</div>'
            : '<div class="ride-trip__fare">預估車資 <b class="num ride-em">$<span data-fare>' + F.fare(km) + '</span></b>' +
                ' · <span class="num">' + kmText(km) + '</span> 公里</div>') +
          '<div class="card ride-story">' +
            '<button class="why__head ride-story__head" type="button" data-act="toggle-story" aria-expanded="false">' +
              '<span class="u-row u-gap3">' + icon('place', 22) +
                '<span><span class="ride-story__eyebrow">這條路上</span>' +
                '<span class="ride-story__t">' + esc(heading) + '</span></span></span>' +
              '<span class="arrow ride-story__arrow"></span></button>' +
            '<div class="ride-story__body" data-story hidden>' +
              paras.map(function (x) { return '<p class="story__text">' + esc(x) + '</p>'; }).join('') +
              '<p class="story__note">' + (min == null ? '這一段是為車上的這段路寫的。'
                : '這一段是為車上的這 <span class="num">' + min + '</span> 分鐘寫的。') + '</p>' +
            '</div>' +
          '</div>' +
          '<div class="ride-trip__acts">' +
            '<button class="btn-ghost" type="button" data-act="call-driver">聯絡司機</button>' +
            '<button class="demo-btn" type="button" data-act="arrive">模擬抵達</button>' +
          '</div>' +
        '</div>' +

        '<button class="btn-link ride-trip__cancel" type="button" data-act="cancel-trip">取消行程</button>' +
      '</div>';
  },
  mount: function (root) {
    dropBroken();
    const t = TRIP.current();
    const p = tripPlace(t);
    if (!t || !p || t.phase === 'done') return;
    const offs = [];

    /* ---- 地圖：家（上車點）與目的地兩顆 pin，不畫路線 ---- */
    const host = root.querySelector('[data-trip-map]');
    const o = tripMapOpts(p);
    const map = APP.map.mount(host, {
      style: 'paper', center: o.center, spanM: o.spanM, spots: false, pan: true,
      overlay:
        '<div class="pin ride-pin" data-pin="pickup"><span class="pin__drop">' + icon('hail') + '</span><span class="pin__dot"></span></div>' +
        '<div class="pin pin--red ride-pin" data-pin="dest"><span class="pin__label">' + esc(p.name) + '</span>' +
          '<span class="pin__drop">' + icon('place') + '</span><span class="pin__dot"></span></div>',
    });
    offs.push(function () { map.destroy(); });
    const H = map.handle;
    function put(el, xy) {
      if (!el) return;
      const x = Math.max(40, Math.min(H.width - 40, xy[0]));
      const y = Math.max(90, Math.min(H.height - 16, xy[1]));
      el.classList.toggle('ride-pin--edge', x !== xy[0] || y !== xy[1]);
      el.style.left = (x / H.width * 100).toFixed(1) + '%';
      el.style.top = (y / H.height * 100).toFixed(1) + '%';
    }
    put(map.el.querySelector('[data-pin="pickup"]'), H.project(HOME_LL[0], HOME_LL[1]));
    if (o.dLL) put(map.el.querySelector('[data-pin="dest"]'), H.project(o.dLL[0], o.dLL[1]));
    SHELL.injectIcons(root);

    /* ---- 配對 → 行程中：時間到（從 startedAt 算）才切；已經過了就當場切 ---- */
    function toRiding() {
      if (!TRIP.toRiding()) return;
      root.querySelector('[data-phase="matching"]').hidden = true;
      root.querySelector('[data-phase="riding"]').hidden = false;
      document.title = '行程中 — yoxi 城事';
    }
    if (t.phase === 'matching') {
      if (still() || TRIP.phase(t) === 'riding') toRiding();
      else {
        const left = MATCH_MS - (Date.now() - Date.parse(t.startedAt));
        const tm = setTimeout(toRiding, Math.max(0, Math.min(MATCH_MS, left)));
        offs.push(function () { clearTimeout(tm); });
      }
    }

    /* ---- 按鈕 ---- */
    const head = root.querySelector('[data-act="toggle-story"]');
    const body = root.querySelector('[data-story]');
    head.onclick = function () {
      const open = body.hidden;
      body.hidden = !open;
      head.setAttribute('aria-expanded', String(open));
      head.classList.toggle('is-open', open);
    };
    root.querySelector('[data-act="call-driver"]').onclick = function () {
      APP.ui.toast('正在撥號給 ' + DRIVER.name + '…');
    };
    root.querySelector('[data-act="arrive"]').onclick = function () { arrive(); };
    root.querySelector('[data-act="cancel-trip"]').onclick = function () {
      const started = t.startedAt, pid = t.placeId;
      APP.ui.confirm({ text: '要取消這趟行程嗎？下車點會留著。', yes: '取消行程', no: '繼續搭', danger: true }).then(function (yes) {
        if (!yes) return;
        /* confirm 開著的時候可能已經抵達（demo 面板）、換了一趟、或人已經不在這一頁：那就不是要取消的這一趟 */
        const cur = TRIP.active();
        const here = APP.nav.current();
        if (!cur || cur.startedAt !== started || cur.placeId !== pid || !here || here.path !== '/trip') return;
        TRIP.cancel();
        backToRide();
      });
    };

    return function () { offs.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } }); };
  },
});

/* ==========================================================================
   /trip/done — 行程完成、評分、評分後才出現的金色橫幅（ride-done.html）
   ========================================================================== */
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.6 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5 6.1 20.6l1.2-6.5L2.5 9.5l6.6-.9Z"/></svg>';

APP.view('trip-done', {
  path: '/trip/done', tab: null, status: 'light',
  title: function () { const t = TRIP.current(); return t && t.phase === 'done' && tripPlace(t) ? '行程完成' : '行程'; },
  render: function () {
    const t = TRIP.current();
    const p = tripPlace(t);
    const hdrOf = function (title) {
      return '<header class="hdr-red hdr-red--compact"><div class="hdr-red__bar"><h1 class="hdr-red__title">' + title + '</h1></div></header>';
    };
    const done = t && p && t.phase === 'done';
    const hdr = hdrOf(done ? '行程完成' : '行程');
    if (t && p && t.phase !== 'done') {
      /* 有行程、還沒抵達（深連結或重整進來）：跟 /trip 的「已抵達 → 看結算」對稱，給回到行程的路 */
      return hdr + '<div class="app-empty"><div class="app-empty__card"><p class="app-empty__eyebrow">行程</p>' +
        '<h1 class="app-empty__t">還在前往 ' + esc(p.name) + ' 的路上</h1>' +
        '<p class="app-empty__p">抵達之後才會有這趟的結算。</p>' +
        '<a class="btn-primary" href="#/trip" data-act="go-trip">回到行程</a></div></div>';
    }
    if (!t || !p) {
      return hdr + emptyCard('行程', '目前沒有行程', '這趟行程已經結束，或還沒抵達。');
    }
    const km = t.km != null ? t.km : kmOf(p);
    const min = km == null ? null : F.rideMin(km);
    const start = validDate(t.startedAt) || new Date();
    const end = min == null ? null : new Date(start.getTime() + min * 60000);
    const stars = t.stars || 0;
    /* 明信片 id 用 APP.place(id).card（collect 存的那個），不是 MOCK.cardIdOf */
    const got = !!(p.card && S().has(p.card));

    return hdr +
      '<div class="scroll ride-done">' +
        '<div class="ride-done__pad"><div class="card ride-done__sum">' +
          '<div class="ride-done__art" data-art="' + esc(p.art) + '" data-seed="7" data-wide><span class="ai-mark">AI 生成示意</span></div>' +
          '<div class="ride-done__body">' +
            '<div class="u-row ride-done__line"><span class="u-heavy">新竹市 → ' + esc(p.name) + '</span>' +
              (km == null ? '' : '<span class="num ride-done__fare">$<span data-fare>' + F.fare(km) + '</span></span>') + '</div>' +
            '<div class="ride-done__meta">' + (km == null
              ? esc(F.clock(start)) + ' 上車 · ' + DIST_TBD + ' · 和泰 Pay 信用卡'
              : esc(F.clock(start)) + ' – ' + esc(F.clock(end)) +
                ' · <span class="num" data-min>' + min + '</span> 分鐘 · <span class="num" data-km>' + kmText(km) + '</span> 公里 · 和泰 Pay 信用卡') + '</div>' +
          '</div>' +
        '</div></div>' +

        '<div class="ride-done__pad"><div class="card card--pad u-center">' +
          '<div class="u-heavy">這趟搭得還好嗎？</div>' +
          '<div class="ride-done__meta">' + esc(DRIVER.name) + '</div>' +
          '<div class="ride-stars" data-stars>' +
            [1, 2, 3, 4, 5].map(function (n) {
              return '<button class="ride-star' + (n <= stars ? ' is-on' : '') + '" type="button" data-act="rate" data-star="' + n +
                '" aria-label="' + n + ' 顆星">' + STAR + '</button>';
            }).join('') +
          '</div>' +
        '</div></div>' +

        '<div class="ride-done__pad" data-gold' + (t.rated ? '' : ' hidden') + '>' +
          '<a class="banner--gold" href="#/unlock/' + encodeURIComponent(p.id) + '?ride=1" data-act="unlock-ride">' +
            '<span class="banner--gold__shine"></span>' +
            '<span class="banner--gold__in">' +
              '<span class="banner--gold__art" data-art="' + esc(p.art) + '" data-seed="7"></span>' +
              '<span class="banner--gold__txt">' +
                '<span class="banner--gold__eyebrow">' + (limitedPlace(p) ? 'yoxi 限定版' : '搭 yoxi 抵達') + '</span>' +
                '<span class="banner--gold__t">你抵達了' + esc(p.name) + '</span>' +
                '<span class="banner--gold__p">' + (got ? '這個地方的明信片已經在收藏裡'
                  : limitedPlace(p) ? '解鎖 yoxi 限定明信片' : '收下這張明信片') + '</span>' +
              '</span>' +
              '<span class="arrow arrow--onred"></span>' +
            '</span>' +
          '</a>' +
        '</div>' +

        '<div class="ride-done__pad ride-done__end">' +
          '<a class="btn-primary" href="#/ride" data-act="go-home">回首頁</a>' +
        '</div>' +
      '</div>';
  },
  mount: function (root) {
    dropBroken();
    /* 回首頁：上一格就是叫車首頁 → 退回去；不然就地換成 /ride。結算頁不留在歷史裡（返回不會又回到這裡） */
    const home = root.querySelector('[data-act="go-home"]');
    if (home) home.onclick = function (e) { if (e) e.preventDefault(); backToRide(); };
    const gold = root.querySelector('[data-gold]');
    root.querySelectorAll('[data-act="rate"]').forEach(function (b) {
      b.onclick = function () {
        const n = Number(b.getAttribute('data-star'));
        if (!TRIP.rate(n)) return;
        root.querySelectorAll('[data-act="rate"]').forEach(function (x) {
          x.classList.toggle('is-on', Number(x.getAttribute('data-star')) <= n);
        });
        if (gold) gold.hidden = false;
      };
    });
  },
});

/* ==========================================================================
   /drawer — 側邊抽屜（drawer.html）。紅色是品牌情緒，這裡可以用。
   ========================================================================== */
APP.view('drawer', {
  /* remember:false：抽屜是覆蓋層，切 tab 再回來不該停在抽屜上（router 不把它記進 tabPaths） */
  path: '/drawer', tab: 'ride', status: 'light', title: '選單', remember: false,
  render: function () {
    const NA = TOAST_NA;
    const item = function (label, href, act) {
      return href
        ? '<a class="drawer__item" href="' + href + '" data-act="' + act + '">' + label + '</a>'
        : '<a class="drawer__item" href="#" data-toast="' + NA + '">' + label + '</a>';
    };
    return '' +
      '<div class="ride-drawer__bg" data-drawer-map></div>' +
      '<div class="ride-drawer__scrim" data-drawer-scrim aria-hidden="true"></div>' +
      '<div class="drawer ride-drawer">' +
        '<div class="u-row ride-drawer__top">' +
          '<a class="ride-drawer__close" href="#" data-back="/ride" aria-label="關閉"><span data-icon="close"></span></a>' +
        '</div>' +
        '<div class="u-row u-gap4 ride-drawer__user">' +
          '<span class="ride-drawer__avatar"><span data-icon="moodGood"></span></span>' +
          '<span class="ride-drawer__name">' + esc(M().USER.name) + '</span>' +
        '</div>' +
        '<div class="ride-drawer__note">' + icon('megaphone', 26) +
          '<span>綁定信用卡即可開始累積會員趟次</span></div>' +
        '<div class="drawer__scroll">' +
          '<nav>' +
            item('行程紀錄', '#/trips', 'open-trips') +
            item('付款設定') +
            '<a class="drawer__item ride-drawer__new" href="#/settings" data-act="open-settings">城事設定<span class="ride-drawer__badge">新</span></a>' +
            item('優惠券') +
            item('好康任務') +
            item('客服中心') +
            item('點數商城') +
          '</nav>' +
          '<div class="ride-drawer__pts">' +
            '<div class="ride-drawer__pts-t">和泰 Points</div>' +
            '<a class="ride-drawer__pts-btn" href="#/points" data-act="open-points">' + icon('point', 18) +
              '<span class="num" data-points-total>' + pointsTotal() + '</span> 點</a>' +
          '</div>' +
        '</div>' +
        '<a class="drawer__foot" href="#" data-toast="' + NA + '">邀請好友賺搭車金</a>' +
      '</div>';
  },
  mount: function (root) {
    let map = null;
    try {
      map = APP.map.mount(root.querySelector('[data-drawer-map]'), {
        style: 'paper', center: HOME_LL, spanM: 1800, spots: false,
      });
    } catch (e) { /* 背景地圖畫不出來不影響抽屜 */ }
    root.querySelector('[data-drawer-scrim]').onclick = function () { APP.nav.back('/ride'); };
    SHELL.injectIcons(root);
    return function () { if (map) map.destroy(); };
  },
});

/* ==========================================================================
   /points — 和泰 Points（總數＝明細相加）
   ========================================================================== */
APP.view('points', {
  path: '/points', tab: 'ride', status: 'light', title: '和泰 Points',
  render: function () {
    const rows = pointsRows();
    const total = rows.reduce(function (t, r) { return t + r.amt; }, 0);
    return '' +
      '<header class="hdr-red">' + hdrClose('/drawer') +
        '<h1 class="hdr-red__title">和泰 Points</h1>' +
        '<p class="hdr-red__sub ride-pts__sub">累積總點數 <span class="num ride-pts__total" data-points-total>' + total + '</span> 點</p>' +
      '</header>' +
      '<div class="scroll ride-pts">' +
        '<div class="ride-done__pad"><div class="card" data-points-rows>' +
          (rows.length ? rows.map(function (r) {
            return '<div class="row-nav ride-pts__row" data-points-row data-city="' + (r.city ? 1 : 0) + '">' +
              '<span class="tile-icon tile-icon--md' + (r.city ? ' ride-tile--navy' : '') + '">' +
                '<span class="' + (r.city ? 'ic-ondark' : '') + '" data-icon="' + (r.city ? 'postcard' : 'tabRide') + '"></span></span>' +
              '<span class="row-nav__body"><span class="row-nav__title">' + esc(r.name) + '</span>' +
                '<span class="row-nav__sub"><span class="' + (r.city ? 'ride-pts__src--city' : '') + '">' + esc(r.src) + '</span> · ' + esc(r.date) + '</span></span>' +
              '<span class="num ride-pts__amt" data-amt="' + r.amt + '">+' + r.amt + '</span>' +
            '</div>';
          }).join('') : '<p class="ride-list__none">還沒有點數紀錄。</p>') +
        '</div></div>' +
        '<div class="ride-done__pad"><div class="card card--pad ride-pts__note">' +
          '和泰 Points 可以折抵 yoxi 車資、iRent 租車、HOTAI 購商城與汽車保養費用。<b>1 點 = 1 元。</b>' +
          '搭車回饋每 <span class="num">' + FARE_PER_POINT + '</span> 元車資 1 點；搭車抵達城事的地方，另外回饋 <span class="num">' + RIDE_BONUS + '</span> 點。' +
        '</div></div>' +
      '</div>';
  },
});

/* ==========================================================================
   /notify — 通知中心（沒有未讀數字、沒有紅點計數）
   ========================================================================== */
APP.view('notify', {
  path: '/notify', tab: 'ride', status: 'light', title: '通知中心',
  render: function () {
    const m = M();
    const today = APP.place(m.TODAY.id);
    const LB = m.LOOKBACK || { steps: 0, places: [] };
    const pushes = (store().get('pushes') || []).slice().sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    const had = { am: false, pm: false };
    const row = function (o) {
      return '<a class="row-nav" href="' + o.href + '" data-act="' + o.act + '">' +
        '<span class="tile-icon"><span data-icon="' + o.icon + '"></span></span>' +
        '<span class="row-nav__body"><span class="row-nav__title">' + esc(o.t) + '</span>' +
        '<span class="row-nav__sub">' + esc(o.sub) + '</span></span><span class="arrow"></span></a>';
    };
    /* 今天的地方在叫車首頁的探索模式（沒帶 mode=explore 會落在搭車模式、地圖上一顆景點都沒有） */
    const AM = { href: '#/ride?mode=explore&area=' + encodeURIComponent(today ? today.id : m.TODAY.id), act: 'open-today',
                 icon: 'place', t: '今天的地方',
                 sub: today ? today.name + ' · ' + (today.dist != null ? '離你 ' + F.dist(today.dist) : DIST_TBD) : '' };
    const PM = { href: '#/lookback', act: 'open-lookback', icon: 'postcard', t: '今天的回顧準備好了',
                 sub: '走了 ' + F.num(LB.steps) + ' 步，經過 ' + (LB.places || []).length + ' 個地方' };
    let mine = pushes.map(function (p) {
      had[p.when] = true;
      const base = p.when === 'pm' ? PM : AM;
      let when = '';
      try { when = F.clock(new Date(p.at)); } catch (e) { when = ''; }
      return row(Object.assign({}, base, { sub: (when ? '今天 ' + when + ' · ' : '') + base.sub }));
    }).join('');
    if (!had.am) mine += row(AM);
    if (!had.pm) mine += row(PM);
    const city = pointsRows().filter(function (r) { return r.city; })[0];
    if (city) {
      mine += row({ href: '#/points', act: 'open-points', icon: 'point', t: '和泰 Points +' + city.amt,
                    sub: '城事解鎖回饋 · ' + city.place });
    }
    const news = function (t, sub) {
      return '<a class="row-nav" href="#" data-toast="' + TOAST_NA + '">' +
        '<span class="tile-icon tile-icon--red"><span class="ic-ondark" data-icon="bell"></span></span>' +
        '<span class="row-nav__body"><span class="row-nav__title">' + t + '</span>' +
        '<span class="row-nav__sub">' + sub + '</span></span><span class="arrow"></span></a>';
    };
    return '' +
      '<div class="ride-col" data-panel-scope>' +
      '<header class="hdr-red">' + hdrClose('/ride') +
        '<h1 class="hdr-red__title">通知中心</h1>' +
        '<div class="hdr-red__pills"><div class="pill-group" data-pills>' +
          '<button class="pill" type="button" data-tab="news">最新消息</button>' +
          '<button class="pill is-active" type="button" data-tab="mine">個人通知</button>' +
        '</div></div>' +
      '</header>' +
      '<div class="scroll sheet-top ride-sheet-top">' +
        '<div data-panel="mine">' + mine + '</div>' +
        '<div data-panel="news" class="u-hidden">' +
          news('點從天降', '趟趟送最高 99 點') + news('月來月好運', '搭 1 趟贈次月 88 折券 1 張') +
        '</div>' +
      '</div></div>';
  },
  mount: function (root) {
    root.querySelectorAll('[data-pills]').forEach(function (g) { INTERACT.initPills(g); });
  },
});

/* ==========================================================================
   /trips — 行程紀錄（trips.html）
   ========================================================================== */
APP.view('trips', {
  path: '/trips', tab: 'ride', status: 'light', title: '行程紀錄',
  render: function () {
    const rows = pastTrips().map(function (tr) {
      const attrs = tr.city
        ? 'href="#/postcard/' + esc(tr.card) + '" data-act="open-trip-card"'
        : 'href="#" data-toast="' + TOAST_NA + '"';
      return '<a class="row-nav" ' + attrs + ' data-trip-row>' +
        '<span class="tile-icon"><span data-icon="tabRide"></span></span>' +
        '<span class="row-nav__body"><span class="row-nav__title">' + esc(tr.from) + ' → ' + esc(tr.to) + '</span>' +
          '<span class="row-nav__sub">' + esc(tr.date) + (tr.time ? ' ' + esc(tr.time) : '') +
          ' · ' + (tr.km == null ? DIST_TBD : '<span data-km>' + kmText(tr.km) + '</span> 公里') + (tr.city ? ' · 城事' : '') +
          (tr.via && VIA_LABEL[tr.via] ? ' · <span data-via="' + esc(tr.via) + '">' + VIA_LABEL[tr.via] + '</span>' : '') + '</span></span>' +
        '<span class="u-row u-gap3">' +
          (tr.km == null ? '' : '<span class="num ride-trips__fare">$<span data-fare>' + F.fare(tr.km) + '</span></span>') +
        '<span class="arrow"></span></span></a>';
    }).join('');
    const empty = function (msg) {
      return '<div class="empty-state"><div class="empty-state__art"></div>' +
        '<div class="empty-state__mark">Get Started.</div><div class="empty-state__msg">' + msg + '</div></div>';
    };
    return '' +
      '<div class="ride-col" data-panel-scope>' +
      '<header class="hdr-red">' + hdrClose('/drawer') +
        '<h1 class="hdr-red__title">行程紀錄</h1>' +
        '<div class="hdr-red__pills"><div class="pill-group" data-pills>' +
          '<button class="pill is-active" type="button" data-tab="mine">' + icon('moodGood', 15) + '個人行程</button>' +
          '<button class="pill" type="button" data-tab="biz">企業簽單</button>' +
          '<button class="pill" type="button" data-tab="booked">預約叫車</button>' +
        '</div></div>' +
      '</header>' +
      '<div class="scroll sheet-top ride-sheet-top">' +
        '<div data-panel="mine">' + (rows || empty('你目前沒有任何行程唷')) + '</div>' +
        '<div data-panel="biz" class="u-hidden">' + empty('你目前沒有任何行程唷') + '</div>' +
        '<div data-panel="booked" class="u-hidden">' + empty('你目前沒有預約中的行程唷') + '</div>' +
      '</div></div>';
  },
  mount: function (root) {
    root.querySelectorAll('[data-pills]').forEach(function (g) { INTERACT.initPills(g); });
  },
});

})();
