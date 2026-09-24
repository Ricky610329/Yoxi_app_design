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
      - 搭車地圖沒有探索景點；只支援往下收合面板。探索地圖同時最多 4 個景點，面板可上下拉。
      - 收藏仍在底欄；沒有數字徽章、沒有未讀數字。
     - 金色橫幅只在評分之後出現（評分與付款是 yoxi 的既有職責，城事排在它們後面）。
     - 行程地圖上不畫路線：這份原型沒有做路徑規劃，一條假的線等於一個沒算過的數字。
     - 車資、分鐘、公里、點數沒有一個是手寫的：全部 APP.fmt／STATE／MOCK 算。
     - 「略過下車地點，繼續叫車」拿掉：app 版的叫車需要目的地才算得出車資，
       而且叫車首頁的可按數已經到 10。

   跨區塊提供（ARCHITECTURE.md §7）：
     APP.ride.setDropoff(placeId, via)   寫 store.dropoff → toast → #/ride（已在 /ride 就重畫）
     APP.ride.clearDropoff()
     APP.ride.arrive()                   demo：行程直接抵達 → #/trip/done（system 的 demo 面板用）
     APP.ride.pointsRows() / pointsTotal()   點數明細與總數（總數＝明細相加）
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
/* 變體 E 的四個地方，順序＝重要性（今天的地方先佔位）。座標只是 nearSpots 的格式要求，
   真正的位置由 HSMAP 的經緯度決定。 */
const NEAR_POS = { 'glass-kiln': [0, 0], market: [0, 0], moat: [0, 0], hill: [0, 0] };
/* 抵達解鎖回饋（state.js 的 STATE.points 同一個算法：每張搭車卡 50 點） */
const RIDE_BONUS = 50;
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
function bindToasts(root) {
  root.querySelectorAll('[data-toast]').forEach(function (el) {
    if (!el.onclick) el.onclick = function (e) { if (e) e.preventDefault(); APP.ui.toast(el.dataset.toast); };
  });
}
function hdrClose(back, extra) {
  return '<div class="hdr-red__bar"><a class="hdr-red__close" href="#" data-back="' + back + '" aria-label="關閉">' +
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
function tripNow() {
  const t = store().get('trip');
  return t && t.placeId ? t : null;
}
function tripPlace(t) { return (t && APP.place(t.placeId)) || null; }
/* 行程現在是哪一段：存的是 matching 但已經過了 MATCH_MS → riding。now 可注入（測試用）。 */
function phaseOf(t, now) {
  if (!t) return null;
  if (t.phase !== 'matching') return t.phase;
  const t0 = Date.parse(t.startedAt);
  if (isNaN(t0)) return 'riding';                /* 舊資料沒有 startedAt：不要永遠卡在配對中 */
  return ((now == null ? Date.now() : now) - t0 >= MATCH_MS) ? 'riding' : 'matching';
}
/* 行程進行中（配對中或行程中；抵達之後不算） */
function tripActive() {
  const t = tripNow();
  return t && t.phase !== 'done' ? t : null;
}
function validDate(iso) {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime()) ? d : null;
}
/* 抵達了、限定明信片還沒收的那一趟：它一直留在 store.trip，直到 APP.explore.collect 收卡才清。
   按「回首頁」不能讓限定版消失（產品決定），所以 /ride 與明信片頁都有一個回去解鎖的入口。 */
function pendingUnlock() {
  const t = tripNow();
  if (!t || t.phase !== 'done') return null;
  const p = tripPlace(t);
  if (!p) return null;
  const card = M().cardIdOf(p.id);
  if (S().has(card)) return null;
  return { trip: t, place: p, card: card, limited: limitedPlace(p),
           href: '#/unlock/' + encodeURIComponent(p.id) + '?ride=1' };
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

/* ---------------------------------------------------------------- 跨區塊 API */
let lastSet = { id: null, at: 0 };
function setDropoff(placeId, via) {
  /* 車已經叫了：目的地不能從旁邊偷改（K1、E 小卡、路線斷點、搜尋四個入口都經過這裡） */
  if (tripActive()) { APP.ui.toast('行程進行中，先抵達或取消行程'); return false; }
  const p = APP.place(placeId);
  if (!p) { APP.ui.toast('找不到這個地方'); return false; }
  /* 連點兩下（第二下常落在轉場中的舊畫面上）：同一個地方、剛設過、人已經在 /ride → 不再寫、不再導 */
  const here = APP.nav.current();
  const d0 = store().get('dropoff');
  if (here && here.path === '/ride' && d0 && d0.id === p.id && lastSet.id === p.id && Date.now() - lastSet.at < 1000) {
    return true;
  }
  lastSet = { id: p.id, at: Date.now() };
  store().set('dropoff', {
    id: p.id, name: p.name, km: F.km(p.dist), setAt: new Date().toISOString(), via: via || 'e',
  });
  APP.ui.toast('已設為下車點');
  const cur = APP.nav.current();
  if (cur && cur.path === '/ride') APP.nav.go('/ride', { replace: true, dir: 'none' });
  else APP.nav.go('/ride');
  return true;
}

function clearDropoff() {
  store().set('dropoff', null);
  const cur = APP.nav.current();
  if (cur && cur.path === '/ride') APP.nav.go('/ride', { replace: true, dir: 'none' });
}

function arrive() {
  const t = tripNow();
  if (!t) { APP.ui.toast('目前沒有行程'); return false; }
  store().set('trip', Object.assign({}, t, { phase: 'done' }));
  store().set('dropoff', null);
  const cur = APP.nav.current();
  /* 從行程中頁抵達：取代那一頁（返回不會回到已結束的行程）；從 demo 面板或別頁叫：照常 push */
  APP.nav.go('/trip/done', { replace: !!(cur && cur.path === '/trip') });
  return true;
}

function callRide() {
  const here = APP.nav.current();
  if (here && here.path === '/trip') return;     /* 連點：第一下已經到行程頁了 */
  const t = tripNow();
  if (t && t.phase !== 'done') { APP.nav.go('/trip'); return; }
  const d = store().get('dropoff');
  if (!d || !d.id) { APP.ui.toast('先選一個下車點'); return; }
  /* 上一趟的限定版還沒收：先問一次。先去解鎖 → 不建新 trip；直接叫車 → 新行程覆蓋舊的（契約 §3.3 只有一筆 trip） */
  const pend = pendingUnlock();
  if (pend) {
    if (asking) return;
    asking = true;
    APP.ui.confirm({ text: pend.limited ? '上一趟的限定明信片還沒收，要先去解鎖嗎？' : '上一趟的明信片還沒收，要先去收下嗎？',
                     yes: pend.limited ? '先去解鎖' : '先去收下', no: '直接叫車' })
      .then(function (yes) {
        asking = false;
        if (yes) APP.nav.go(pend.href.slice(1));
        else startTrip(d);
      });
    return;
  }
  startTrip(d);
}

let asking = false;
function startTrip(d) {
  const p = APP.place(d.id);
  store().set('trip', {
    placeId: d.id, phase: 'matching', startedAt: new Date().toISOString(), rated: false,
    km: p ? F.km(p.dist) : d.km,
    via: d.via || null,          /* 轉換歸因：這個下車點是從哪個入口設的 */
  });
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
               time: '', km: F.km(p ? p.dist : 0), city: true, limited: limitedCard(pc.id),
               via: (store().get('rideVia') || {})[pc.id] || null });
  });
  PLAIN_TRIPS.forEach(function (x) { out.push(Object.assign({ city: false }, x)); });
  out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  return out;
}

/* 點數明細：每一趟的搭車回饋＋每張搭車卡的城事解鎖回饋。總數一律＝明細相加。 */
function pointsRows() {
  const rows = [];
  pastTrips().forEach(function (tr) {
    rows.push({ name: tr.from + ' → ' + tr.to + ' · 搭乘', src: '搭車回饋', date: tr.date,
                amt: Math.floor(F.fare(tr.km) / FARE_PER_POINT), city: false });
    if (tr.city && tr.limited) {
      rows.push({ name: tr.to + ' · 抵達解鎖', src: '城事解鎖回饋', date: tr.date, amt: RIDE_BONUS, city: true });
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
  pendingUnlock: pendingUnlock,
  limitedPlace: limitedPlace,
  limitedCard: limitedCard,
  VIA_LABEL: VIA_LABEL,
  tripActive: tripActive,
  phaseOf: phaseOf,
  MATCH_MS: MATCH_MS,
});

/* ==========================================================================
   /ride — 叫車首頁（E）
   ========================================================================== */

/* 地圖上的四顆：沿用 SHELL.nearSpots（對不上的 id 直接丟錯，不安靜地少一顆），
   一定含今天的地方；去過的換成 seen（有勾）。 */
function rideSpots() {
  const m = M();
  let list = SHELL.nearSpots(NEAR_POS);
  if (!list.some(function (s) { return s.id === m.TODAY.id; })) {
    const t = m.SPOTS.filter(function (s) { return s.id === m.TODAY.id; })[0];
    if (t) list = [Object.assign({}, t)].concat(list.slice(0, 3));
  }
  return list.map(function (s) {
    const c = S().card(m.cardIdOf(s.id));
    if (c && s.state !== 'today') s.state = 'seen';
    delete s.x; delete s.y;
    return s;
  });
}

function rideOverlay() {
  return '' +
    '<a class="fab fab--navy ride-fab ride-fab--menu" href="#/drawer" aria-label="選單" data-act="open-drawer">' +
      '<span data-icon="menu"></span></a>' +
    '<button class="fab ride-fab ride-fab--scan" type="button" aria-label="掃碼" ' +
      'data-toast="' + TOAST_NA + '"><span data-icon="scan"></span></button>' +
    '<a class="fab ride-fab ride-fab--bell" href="#/notify" aria-label="通知" data-act="open-notify">' +
      '<span data-icon="bell"></span></a>' +
    '<button class="fab ride-fab ride-fab--loc" type="button" data-recenter aria-label="定位">' +
      '<span data-icon="locate"></span></button>' +
    '<div class="pin ride-pin" data-pin="pickup" style="left:50%; top:60%">' +
      '<span class="pin__label">' + esc(home()) + '</span>' +
      '<span class="pin__drop"><span data-icon="hail"></span></span>' +
      '<span class="pin__dot"></span></div>';
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

/* 真地圖的代價（concept-map-home ②③④）：玻璃窯在 hs-places 跟家同一個座標、
   東門市場與護城河只差 143 公尺、十八尖山落在定位鈕底下。
   受保護的矩形（四顆浮動鈕、上車點 pin 與地址標籤、狀態列）當場量，
   每個景點從真實落點往外找最近的淨空處；找不到就留在原地。 */
function keepClear(map, me) {
  const H = map.handle;
  const box = map.el.getBoundingClientRect();
  if (!box.width || !box.height) return;
  const sx = H.width / box.width, sy = H.height / box.height;   /* CSS px → 地圖 px */
  const rel = function (el) {
    const r = el.getBoundingClientRect();
    return [(r.left - box.left) * sx, (r.top - box.top) * sy, (r.right - box.left) * sx, (r.bottom - box.top) * sy];
  };
  const rects = [[0, 0, H.width, 60]];
  map.el.querySelectorAll('.fab, .pin, .pin__label').forEach(function (el) { rects.push(rel(el)); });
  const hit = function (a, b, pad) {
    return !(a[2] + pad < b[0] || a[0] - pad > b[2] || a[3] + pad < b[1] || a[1] - pad > b[3]);
  };
  const placed = [];
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
        if (placed.some(function (P) { return hit(bx, P, 4); })) continue;
        best = [X, Y, bx];
        break;
      }
    }
    if (!best) return;
    placed.push(best[2]);
    el.style.left = (best[0] / H.width * 100).toFixed(1) + '%';
    el.style.top = (best[1] / H.height * 100).toFixed(1) + '%';
  });
}

function rideRender() {
  let trip = tripNow();
  const pend = pendingUnlock();
  if (trip && trip.phase === 'done') trip = null;      /* 已抵達：不是「回到行程」；限定版另有金色入口 */
  /* 行程進行中：下車點欄位是這一趟的目的地（store.dropoff 可能已經被別的入口改過或清掉），點了回行程 */
  const tp = trip ? tripPlace(trip) : null;
  const d = store().get('dropoff');
  const dp = tp || (d && d.id ? APP.place(d.id) : null);
  const km = tp ? (trip.km != null ? trip.km : F.km(tp.dist)) : dp ? F.km(dp.dist) : (d ? d.km : 0);


  const dropField = dp
    ? '<div class="route-input__field ride-drop"' + (tp ? ' data-trip-dest' : '') + '>' +
        (tp ? '<a class="ride-drop__main" href="#/trip" data-act="open-trip">'
            : '<a class="ride-drop__main" href="#/dropoff" data-act="pick-dropoff">') +
          '<span class="route-input__label">' + (tp ? '這一趟的下車點' : '下車點') + '</span>' +
          '<span class="route-input__value" data-drop-name>' + esc(dp.name) + '</span>' +
          '<span class="ride-drop__meta">' + esc(dp.type) + ' · ' + esc(F.dist(dp.dist)) +
            ' · 預估 <b class="num ride-em">$<span data-fare>' + F.fare(km) + '</span></b>' +
            ' · 車程 <span class="num" data-min>' + F.rideMin(km) + '</span> 分</span>' +
        '</a>' +
        (tp ? '' : '<button class="ride-drop__clear" type="button" data-act="clear-dropoff">清除</button>') +
      '</div>'
    : '<a class="route-input__field" href="#/dropoff" data-act="pick-dropoff">' +
        '<span class="route-input__value route-input__value--ph">要去哪裡？</span></a>';

  const callText = trip ? '回到行程' : dp ? '叫車前往 ' + dp.name : '選好下車點就可以叫車';

  return '' +
    '<div class="ride-map" data-ride-map></div>' +

    '<div class="banner ride-banner">' +
      '<div class="banner__item ride-banner__promo">' +
        '<span><span class="ride-em">點</span>從天降 · 搭車好禮</span>' +
      '</div>' +
    '</div>' +

    '<div class="sheet ride-sheet ride-sheet--ride">' +
      '<div class="sheet__grip ride-mode__grip"><div class="sheet__handle"></div></div>' +
      rideModePills('ride') +
      '<button class="ride-mode__restore" type="button" data-act="restore-ride">展開搭車 <span class="arrow"></span></button>' +
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
      '<div class="ride-sheet__row">' +
        '<button class="btn-pill" type="button" data-toast="' + TOAST_NA + '">' + icon('plane', 18) + '機場接送</button>' +
      '</div>' +
      (dp || trip ? '<button class="btn-primary ride-call is-ready" type="button" data-act="call-ride">' +
        esc(callText) + '</button>' : '') +
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
  const offs = [];
  const tb = document.getElementById('tabbar');

  /* 評分完直接回首頁的人：限定明信片還沒收 → trip 留著（render 畫了金色入口）；
     已經收過（別的路收的）→ 這趟沒有東西要等了，安靜收掉 */
  const t0 = store().get('trip');
  if (t0 && t0.phase === 'done' && !pendingUnlock()) store().set('trip', null);

  /* ---- 地圖 ---- */
  const host = root.querySelector('[data-ride-map]');
  const map = APP.map.mount(host, {
    style: 'paper', center: RIDE_CENTER, spanM: RIDE_SPAN,
    spots: false, max: 4, compact: true, pan: true,
    layers: { label: true },
    overlay: rideOverlay(),
  });
  offs.push(function () { map.destroy(); });

  /* 上車點 pin 落在家的真實經緯度 */
  const H = map.handle;
  const me = H.project(HOME_LL[0], HOME_LL[1]);
  const pin = map.el.querySelector('[data-pin="pickup"]');
  if (pin) {
    pin.style.left = (me[0] / H.width * 100).toFixed(1) + '%';
    pin.style.top = (me[1] / H.height * 100).toFixed(1) + '%';
  }
  SHELL.injectIcons(root);
  keepClear(map, me);
  bindToasts(root);

  /* ---- sheet ---- */
  const clr = root.querySelector('[data-act="clear-dropoff"]');
  if (clr) clr.onclick = function () { clearDropoff(); };
  const call = root.querySelector('[data-act="call-ride"]');
  if (call) call.onclick = function () { callRide(); };
  const stopDown = bindRideDownSheet(root.querySelector('.ride-sheet'));

  return function () {
    stopDown();
    offs.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } });
    if (tb) tb.classList.remove('is-yield');
  };
}

/* ==========================================================================
   雙主頁第一版：叫車地圖選地點，同一張上滑面板看周邊卡片。
   四組卡片是展示用的明確對應；收集狀態仍由 STATE 決定。
   ========================================================================== */
const CARD_AREAS = [
  { id: 'glass-kiln', name: '水利路', cards: ['p11', 'p17'] },
  { id: 'market', name: '東門與舊城', cards: ['p1', 'p2', 'p7', 'p20'] },
  { id: 'moat', name: '護城河', cards: ['p3', 'p19'] },
  { id: 'hill', name: '十八尖山', cards: ['p6', 'p21'] },
];
function cardArea(id) { return CARD_AREAS.filter(function (a) { return a.id === id; })[0] || null; }
function areaProgress(a) {
  return { done: a.cards.filter(function (id) { return S().has(id); }).length, total: a.cards.length };
}
function areaCard(id) { return (M().POSTCARDS || []).filter(function (p) { return p.id === id; })[0] || null; }
function areaListHTML() {
  return '<div class="ride-v2__section"><h2>附近有卡片的地方</h2><p>選一個地方，看看周邊還有什麼可以收下。</p></div>' +
    '<div class="ride-v2__area-list">' + CARD_AREAS.map(function (a) {
      const p = APP.place(a.id), r = areaProgress(a);
      return '<button class="ride-v2__area" type="button" data-act="select-area" data-area="' + esc(a.id) + '">' +
        '<span class="ride-v2__area-art" data-art="' + esc(p.art) + '" data-seed="2"></span>' +
        '<span class="ride-v2__area-body"><strong>' + esc(a.name) + '</strong><small>' + esc(p.name) +
          ' · ' + esc(F.dist(p.dist)) + '</small></span>' +
        '<span class="ride-v2__area-count">' + r.done + '/' + r.total + '<span class="arrow"></span></span></button>';
    }).join('') + '</div>';
}
function areaCardsHTML(a) {
  const r = areaProgress(a), p = APP.place(a.id);
  return '<div class="ride-v2__section"><button class="ride-v2__back" type="button" data-act="all-areas">' +
      '<span class="arrow arrow--left"></span>附近的地方</button>' +
      '<h2>' + esc(a.name) + '的卡片</h2>' +
      '<p>收集 ' + r.done + '/' + r.total + ' · 離你 ' + esc(F.dist(p.dist)) + '</p></div>' +
    '<div class="ride-v2__card-grid">' + a.cards.map(function (id) {
      const c = areaCard(id);
      if (!c) return '';
      const got = S().has(id);
      return '<div class="ride-v2__card' + (got ? ' is-collected' : '') + '" data-card="' + esc(id) + '">' +
        '<span class="ride-v2__card-art" data-art="' + esc(c.art) + '" data-seed="' + M().POSTCARDS.indexOf(c) + '">' +
          '<span class="ai-mark">AI 生成示意</span></span>' +
        '<strong>' + esc(c.name) + '</strong><small>' + (got ? '已收藏' : '還沒收下') + '</small></div>';
    }).join('') + '</div>' +
    '<button class="btn-primary ride-v2__set" type="button" data-act="set-area-dropoff">設為下車點 · ' + esc(p.name) + '</button>';
}
function areaIntroHTML(a) {
  if (!a) return '<div class="ride-v2__eyebrow">yoxi 城事</div><h1>今天想去哪裡？</h1>' +
    '<button class="ride-v2__teaser" type="button" data-act="expand-cards">' +
      '<span data-icon="postcard"></span><span>附近有卡片可以收集</span><span class="arrow"></span></button>';
  const r = areaProgress(a), p = APP.place(a.id);
  return '<div class="ride-v2__eyebrow">你選的地方 · 離你 ' + esc(F.dist(p.dist)) + '</div>' +
    '<h1>' + esc(a.name) + '</h1>' +
    '<button class="ride-v2__teaser" type="button" data-act="expand-cards">' +
      '<span data-icon="postcard"></span><span>周邊卡片 · 收集 ' + r.done + '/' + r.total + '</span><span class="arrow"></span></button>' +
    '<button class="ride-v2__area-cta" type="button" data-act="set-area-dropoff">設為下車點 · ' + esc(p.name) + '</button>';
}
function rideV2Overlay() {
  return '<a class="fab fab--navy ride-fab ride-fab--menu" href="#/drawer" aria-label="選單" data-act="open-drawer">' +
      '<span data-icon="menu"></span></a>' +
    '<button class="fab ride-fab ride-fab--loc" type="button" data-recenter aria-label="定位">' +
      '<span data-icon="locate"></span></button>' +
    '<div class="pin ride-pin" data-pin="pickup" style="left:50%;top:60%">' +
      '<span class="pin__label">' + esc(home()) + '</span>' +
      '<span class="pin__drop"><span data-icon="hail"></span></span><span class="pin__dot"></span></div>';
}
function rideV2Render(params, ctx) {
  const a = cardArea(ctx.query.get('area'));
  const trip = tripActive(), d = store().get('dropoff');
  const dp = trip ? tripPlace(trip) : d && d.id ? APP.place(d.id) : null;
  const km = dp ? (trip && trip.km != null ? trip.km : F.km(dp.dist)) : 0;
  const pend = pendingUnlock();
  return '<div class="ride-map ride-v2__map" data-ride-map></div>' +
    '<section class="sheet sheet--drag is-collapsed ride-sheet ride-v2__sheet" style="--sheet-min:455px">' +
      '<div class="sheet__grip"><div class="sheet__handle"></div></div>' +
      rideModePills('explore') +
      '<div class="ride-v2__intro" data-area-intro>' + areaIntroHTML(a) + '</div>' +
      '<div class="ride-v2__ride">' +
        '<a class="ride-v2__field" href="#/pickup" data-act="pick-pickup"><span class="ride-v2__dot"></span>' +
          '<span><small>上車點</small><strong data-pickup-name>' + esc(home()) + '</strong></span></a>' +
        (dp ? '<div class="ride-v2__field"><span class="ride-v2__dot ride-v2__dot--red"></span>' +
            '<a href="' + (trip ? '#/trip' : '#/dropoff') + '" data-act="pick-dropoff"><small>下車點</small>' +
              '<strong data-drop-name>' + esc(dp.name) + '</strong><span class="ride-v2__fare">' + esc(F.dist(dp.dist)) + ' · 預估 $<b data-fare>' + F.fare(km) +
              '</b> · <b data-min>' + F.rideMin(km) + '</b> 分鐘</span></a>' +
            (trip ? '' : '<button type="button" data-act="clear-dropoff" aria-label="清除下車點">×</button>') + '</div>'
          : '<a class="ride-v2__field" href="#/dropoff" data-act="pick-dropoff"><span class="ride-v2__dot ride-v2__dot--red"></span>' +
              '<span><small>下車點</small><strong>要去哪裡？</strong></span></a>') +
        (dp ? '<button class="btn-primary ride-v2__call is-ready" type="button" data-act="call-ride">' +
          (trip ? '回到行程' : '叫車前往 ' + esc(dp.name)) + '</button>' : '') +
        (pend ? '<a class="ride-v2__pending" href="' + pend.href + '" data-act="unlock-ride">' +
          '上一趟的明信片還在等你收下 <span class="arrow"></span></a>' : '') +
      '</div>' +
      '<div class="ride-v2__expanded" data-expand-only data-area-expanded>' + (a ? areaCardsHTML(a) : areaListHTML()) + '</div>' +
    '</section>';
}
function rideV2Mount(root, params, ctx) {
  const sheet = root.querySelector('.ride-sheet');
  const intro = root.querySelector('[data-area-intro]');
  const expanded = root.querySelector('[data-area-expanded]');
  const tabbar = document.getElementById('tabbar');
  let selected = cardArea(ctx.query.get('area'));
  const map = APP.map.mount(root.querySelector('[data-ride-map]'), {
    style: 'paper', center: RIDE_CENTER, spanM: RIDE_SPAN,
    spots: store().get('rideSpots') === false ? false : rideSpots(), max: 4, compact: true, pan: true, layers: { label: true },
    overlay: rideV2Overlay(), onSpot: function (s) { selectArea(s.id, true); },
  });
  const H = map.handle, me = H.project(HOME_LL[0], HOME_LL[1]);
  const pin = map.el.querySelector('[data-pin="pickup"]');
  if (pin) { pin.style.left = (me[0] / H.width * 100).toFixed(1) + '%'; pin.style.top = (me[1] / H.height * 100).toFixed(1) + '%'; }
  SHELL.injectIcons(root);
  keepClear(map, me);
  function setOpen(open) {
    sheet.classList.toggle('is-collapsed', !open);
    if (tabbar) tabbar.classList.toggle('is-yield', open);
  }
  function paint() {
    intro.innerHTML = areaIntroHTML(selected);
    expanded.innerHTML = selected ? areaCardsHTML(selected) : areaListHTML();
    SHELL.injectArt(expanded);
    SHELL.injectIcons(sheet);
    intro.querySelector('[data-act="expand-cards"]').onclick = function () { setOpen(true); };
    const introSet = intro.querySelector('[data-act="set-area-dropoff"]');
    if (introSet) introSet.onclick = function () { if (selected) setDropoff(selected.id, 'e'); };
    expanded.querySelectorAll('[data-act="select-area"]').forEach(function (b) {
      b.onclick = function () { selectArea(b.getAttribute('data-area'), false); };
    });
    const back = expanded.querySelector('[data-act="all-areas"]');
    if (back) back.onclick = function () { selectArea(null, false); };
    const set = expanded.querySelector('[data-act="set-area-dropoff"]');
    if (set) set.onclick = function () { if (selected) setDropoff(selected.id, 'e'); };
    map.spotsEl.querySelectorAll('.spot').forEach(function (el) {
      el.classList.toggle('is-selected', !!selected && el.getAttribute('data-spot') === selected.id);
    });
  }
  function selectArea(id, fromMap) {
    selected = cardArea(id);
    APP.nav.replaceQuery('mode=explore' + (selected ? '&area=' + encodeURIComponent(selected.id) : ''));
    paint();
    if (fromMap) setOpen(false);
  }
  paint();
  const clear = root.querySelector('[data-act="clear-dropoff"]');
  if (clear) clear.onclick = clearDropoff;
  const call = root.querySelector('[data-act="call-ride"]');
  if (call) call.onclick = callRide;
  const stopDrag = bindExploreSheet(sheet, setOpen);
  return function () { stopDrag(); map.destroy(); if (tabbar) tabbar.classList.remove('is-yield'); };
}

/* 搭車只有往下收合；回到叫車欄位靠明確按鈕，沒有向上拖曳手勢。 */
function bindRideDownSheet(sheet) {
  const grip = sheet.querySelector('.ride-mode__grip');
  const restore = sheet.querySelector('[data-act="restore-ride"]');
  let y0 = null;
  function down(e) { y0 = e.clientY; }
  function move(e) { if (y0 !== null && e.clientY - y0 > 4) e.preventDefault(); }
  function up(e) {
    if (y0 === null) return;
    if (e.clientY - y0 > 24) sheet.classList.add('is-condensed');
    y0 = null;
  }
  restore.onclick = function () { sheet.classList.remove('is-condensed'); };
  grip.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', up);
  return function () {
    grip.removeEventListener('pointerdown', down);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
}

function bindExploreSheet(sheet, setOpen) {
  const grip = sheet.querySelector('.sheet__grip');
  let y0 = null, moved = 0, base = 0;
  function down(e) {
    y0 = e.clientY;
    moved = 0;
    base = sheet.getBoundingClientRect().height;
    sheet.style.transition = 'none';
  }
  function move(e) {
    if (y0 === null) return;
    moved = y0 - e.clientY;
    if (Math.abs(moved) > 4) e.preventDefault();
    const max = sheet.parentElement.getBoundingClientRect().height * .82;
    sheet.style.maxHeight = Math.max(120, Math.min(max, base + moved)) + 'px';
  }
  function up() {
    if (y0 === null) return;
    sheet.style.transition = '';
    sheet.style.maxHeight = '';
    setOpen(Math.abs(moved) > 24 ? moved > 0 : sheet.classList.contains('is-collapsed'));
    y0 = null;
  }
  grip.style.cursor = 'grab';
  grip.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', up);
  return function () {
    grip.removeEventListener('pointerdown', down);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
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
        '<a class="row-nav" href="#/ride" data-act="pick-on-map">' +
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
            '<span class="row-nav__sub">' + esc(p.type) + ' · ' + (p.dist == null ? '距離待確認' : esc(F.dist(p.dist))) + '</span>' +
          '</span>' +
          '<span class="ride-tag ' + (walk ? 'ride-tag--walk' : 'ride-tag--ride') + '">' + (walk ? '走得到' : '叫車') + '</span>' +
        '</button>';
      }).join('') +
      (hit.length > shown.length
        ? '<button class="ride-more" type="button" data-act="more-dropoff">全部 ' + hit.length + ' 個地方</button>' : '');
      SHELL.injectArt(list);
      list.querySelectorAll('[data-act="choose-dropoff"]').forEach(function (b) {
        b.onclick = function () { setDropoff(b.getAttribute('data-id'), 'search'); };
      });
      const more = list.querySelector('[data-act="more-dropoff"]');
      if (more) more.onclick = function () { expanded = true; draw(); };
    }
    input.oninput = function () { draw(); };
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
        APP.nav.back('/ride');
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
  title: function () { const t = tripNow(); return phaseOf(t) === 'matching' ? '正在找車' : '行程中'; },
  render: function () {
    const t = tripNow();
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
    const km = t.km != null ? t.km : F.km(p.dist);
    const min = F.rideMin(km);
    const rs = p.raw && p.raw.inRideStory;
    const story = p.story || [];
    const pick = story.filter(function (s) { return s.label === '以前的它'; })[0] || story[0];
    const heading = rs ? rs.heading : (p.name + ' 以前是什麼樣子');
    const paras = rs ? [rs.text].concat(pick ? [pick.text] : []) : story.slice(0, 2).map(function (s) { return s.text; });
    const matching = phaseOf(t) === 'matching';

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
            '<span class="ride-trip__eta"><span class="num" data-min>' + min + '</span><span>分鐘後抵達</span></span>' +
          '</div>' +
          '<div class="ride-trip__fare">預估車資 <b class="num ride-em">$<span data-fare>' + F.fare(km) + '</span></b>' +
            ' · <span class="num">' + kmText(km) + '</span> 公里</div>' +
          '<div class="card ride-story">' +
            '<button class="why__head ride-story__head" type="button" data-act="toggle-story" aria-expanded="false">' +
              '<span class="u-row u-gap3">' + icon('place', 22) +
                '<span><span class="ride-story__eyebrow">這條路上</span>' +
                '<span class="ride-story__t">' + esc(heading) + '</span></span></span>' +
              '<span class="arrow ride-story__arrow"></span></button>' +
            '<div class="ride-story__body" data-story hidden>' +
              paras.map(function (x) { return '<p class="story__text">' + esc(x) + '</p>'; }).join('') +
              '<p class="story__note">這一段是為車上的這 <span class="num">' + min + '</span> 分鐘寫的。</p>' +
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
    const t = tripNow();
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
      const cur = tripNow();
      if (!cur || cur.phase !== 'matching') return;
      store().set('trip', Object.assign({}, cur, { phase: 'riding' }));
      root.querySelector('[data-phase="matching"]').hidden = true;
      root.querySelector('[data-phase="riding"]').hidden = false;
      document.title = '行程中 — yoxi 城事';
    }
    if (t.phase === 'matching') {
      if (still() || phaseOf(t) === 'riding') toRiding();
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
      APP.ui.confirm({ text: '要取消這趟行程嗎？下車點會留著。', yes: '取消行程', no: '繼續搭' }).then(function (yes) {
        if (!yes) return;
        store().set('trip', null);
        APP.nav.go('/ride', { replace: true, dir: 'back' });
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
  title: function () { const t = tripNow(); return t && t.phase === 'done' && tripPlace(t) ? '行程完成' : '行程'; },
  render: function () {
    const t = tripNow();
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
    const km = t.km != null ? t.km : F.km(p.dist);
    const min = F.rideMin(km);
    const start = validDate(t.startedAt) || new Date();
    const end = new Date(start.getTime() + min * 60000);
    const stars = t.stars || 0;
    const got = S().has(M().cardIdOf(p.id));

    return hdr +
      '<div class="scroll ride-done">' +
        '<div class="ride-done__pad"><div class="card ride-done__sum">' +
          '<div class="ride-done__art" data-art="' + esc(p.art) + '" data-seed="7" data-wide><span class="ai-mark">AI 生成示意</span></div>' +
          '<div class="ride-done__body">' +
            '<div class="u-row ride-done__line"><span class="u-heavy">新竹市 → ' + esc(p.name) + '</span>' +
              '<span class="num ride-done__fare">$<span data-fare>' + F.fare(km) + '</span></span></div>' +
            '<div class="ride-done__meta">' + esc(F.clock(start)) + ' – ' + esc(F.clock(end)) +
              ' · <span class="num" data-min>' + min + '</span> 分鐘 · <span class="num" data-km>' + kmText(km) + '</span> 公里 · 和泰 Pay 信用卡</div>' +
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
    const gold = root.querySelector('[data-gold]');
    root.querySelectorAll('[data-act="rate"]').forEach(function (b) {
      b.onclick = function () {
        const t = tripNow();
        if (!t) return;
        const n = Number(b.getAttribute('data-star'));
        store().set('trip', Object.assign({}, t, { rated: true, stars: n }));
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
  path: '/drawer', tab: 'ride', status: 'light', title: '選單',
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
    const AM = { href: '#/ride?area=' + today.id, act: 'open-today', icon: 'place', t: '今天的地方',
                 sub: today.name + ' · 離你 ' + F.dist(today.dist) };
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
                    sub: '城事解鎖回饋 · ' + city.name.replace(' · 抵達解鎖', '') });
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
          ' · <span data-km>' + kmText(tr.km) + '</span> 公里' + (tr.city ? ' · 城事' : '') +
          (tr.via && VIA_LABEL[tr.via] ? ' · <span data-via="' + esc(tr.via) + '">' + VIA_LABEL[tr.via] + '</span>' : '') + '</span></span>' +
        '<span class="u-row u-gap3"><span class="num ride-trips__fare">$<span data-fare>' + F.fare(tr.km) + '</span></span>' +
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
