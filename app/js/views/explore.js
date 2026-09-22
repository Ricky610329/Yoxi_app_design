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
   /unlock/:id     抵達解鎖三幕（灰點爆開上色 → AI 生成中 → 成品；?ride=1 金框限定版）
     原型：unlock.html。點畫面任意處跳到成品；html[data-still] 直接停在第三幕。
     刻意沒有：分享鈕（分享在明信片頁，這一頁只做「收下」一件事）、司機姓名（MOCK 沒有這筆資料，不編）。
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
/* 搭車抵達一張卡回饋的點數：跟 state.js 的 points（ride 卡數 × 50）同一個數，
   MOCK.FAR_PLACE.ridePoints 是它在資料裡的來源 */
function ridePoints() {
  return (window.MOCK && MOCK.FAR_PLACE && MOCK.FAR_PLACE.ridePoints) || 50;
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

function notFound(o) {
  return '<div class="app-empty ex-empty">' +
    '<div class="app-empty__card app-empty__card--missing" data-ex-missing>' +
      '<p class="app-empty__eyebrow">' + esc(o.eyebrow || '找不到') + '</p>' +
      '<h1 class="app-empty__t">' + esc(o.title) + '</h1>' +
      '<p class="app-empty__p">' + esc(o.text || '') + '</p>' +
      '<a class="btn-primary" href="#' + (o.href || '/explore') + '" data-act="go-explore">' +
        esc(o.cta || '回探索') + '</a>' +
    '</div></div>';
}

function backFab(fallback) {
  return '<a class="fab ex-back" href="#" data-back="' + fallback + '" aria-label="返回">' +
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

/* 設為下車點：一律走 ride 提供的 APP.ride.setDropoff（契約 §7）。
   ride.js 在 explore.js 之前載入，正常情況永遠走第一行；內嵌實作只是 ride 沒載到時的保底。 */
function setDropoff(id, via) {
  if (APP.ride && typeof APP.ride.setDropoff === 'function') return APP.ride.setDropoff(id, via);
  const p = APP.place(id);
  if (!p) return;
  APP.store.set('dropoff', { id: p.id, name: p.name, km: fmt.km(p.dist),
                             setAt: new Date().toISOString(), via: via });
  APP.ui.toast('已設為下車點');
  APP.nav.go('/ride');
}

/* ---------------------------------------------------------------- APP.explore */

/**
 * 收下一張明信片（契約 §7）。
 * placeId 可以是地點 id 或明信片 id；回傳是否為新收。
 */
function collect(placeId, opt) {
  opt = opt || {};
  const p = APP.place(placeId);
  const target = (p && p.card) || placeId;
  const isNew = S().collect(target, {
    by: opt.by || 'walk',
    note: opt.note || '',
    km: opt.km,
    date: fmt.todayMMDD(),
  });
  const pid = p ? p.id : placeId;
  const trip = APP.store.get('trip');
  if (trip && (trip.placeId === pid || trip.placeId === placeId)) APP.store.set('trip', null);
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
  /* 給別的區塊與測試用的純計算（沒有副作用） */
  gap: gapPick,
  breakpoint: function (routeId) {
    const R = (M().ROUTES || []).filter(function (r) { return r.id === routeId; })[0];
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
      peek.classList.remove('is-on'); openId = null; return;
    }
    openId = p.id;
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

  const m = APP.map.mount(wrap, {
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
    return backFabBar('/explore') + notFound({ title: '找不到這個地方',
      text: '這個地方可能還沒寫好內容，或網址打錯了。先回探索看看今天的地方。' });
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
      '<a class="btn-ghost" href="#' + (R ? '/route/' + esc(R.id) : '/routes') + '" data-act="open-route">先看看路線</a>' +
      '<p class="ex-foot__note">' + num(r.km) + ' 公里，這一段搭車比較合理。按下去只是填好下車點，還沒叫車。</p>';
  }

  return '<div class="scroll ex-place">' +
      '<div class="ex-hero' + (got ? '' : ' is-gray') + '">' +
        '<div class="ex-hero__art" data-art="' + esc(p.art) + '" data-seed="1" data-wide></div>' +
        '<span class="ai-mark ex-hero__mark">AI 生成示意</span>' +
        (got ? '' : '<span class="ex-hero__lock"><span data-icon="lock" class="ex-ic36"></span>到了才上色</span>') +
        backFab('/explore') +
      '</div>' +
      '<section class="ex-pad ex-head">' +
        '<span class="ex-eyebrow">' + esc(p.type) + (p.area ? ' · ' + esc(p.area) : '') + '</span>' +
        '<h1 class="ex-name">' + esc(p.name) + '</h1>' +
        '<div class="ex-meta" data-place-meta>' + meta + '</div>' +
        (got ? '<span class="ex-gotline">已收藏' + (S().card(p.card) && S().card(p.card).date ? ' · ' + esc(S().card(p.card).date) : '') + '</span>' : '') +
      '</section>' +
      '<section class="story ex-pad">' +
        (p.story || []).map(function (s) {
          return '<div class="story__block"><div class="story__label">' + esc(s.label) + '</div>' +
            '<p class="story__text">' + esc(s.text) + '</p></div>';
        }).join('') +
      '</section>' +
      (p.why && p.why.length
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

function renderGoing(params) {
  const p = APP.place(params.id);
  if (!p) {
    return backFabBar('/explore') + notFound({ title: '找不到這個地方', text: '沒有目的地就沒辦法帶路。先回探索挑一個。' });
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
  if (!p) { APP.ui.setStatus('dark'); return; }
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
    APP.nav.back('/explore');
  };
  return function () { if (m) m.destroy(); };
}

/* ---------------------------------------------------------------- /unlock/:id */

function cardName(p) {
  const c = (M().POSTCARDS || []).filter(function (x) { return x.id === p.card; })[0];
  return c ? c.name : p.name;
}

function renderUnlock(params, ctx) {
  const p = APP.place(params.id);
  if (!p) {
    return backFabBar('/explore') + notFound({ title: '找不到這個地方', text: '沒有這個地方的明信片。先回探索看看。' });
  }
  const isRide = ctx.query.get('ride') === '1';
  const got = collected(p);
  const name = cardName(p);
  const today = fmt.todayMMDD();
  const year = new Date().getFullYear();
  const trip = APP.store.get('trip');
  const km = isRide && trip && trip.km != null ? trip.km : fmt.km(p.dist);
  const arriveBy = isRide
    ? '搭 yoxi 抵達 · ' + num(km) + ' 公里'
    : (p.dist != null ? '走了 ' + distHTML(p.dist) + ' 抵達' : '走路抵達');

  const act3Acts = got
    ? '<p class="ex-unlock__have">已在收藏裡</p>' +
      '<div class="ex-unlock__acts">' +
        (p.card ? '<a class="btn-primary ex-unlock__btn" href="#/postcard/' + esc(p.card) + '" data-act="open-postcard">看這張明信片</a>' : '') +
        '<a class="btn-link ex-center ex-unlock__link" href="#/explore" data-act="go-explore">回探索</a>' +
      '</div>'
    : (isRide
        ? '<div class="ex-unlock__gold" data-gold-note>' +
            '<span class="ex-unlock__goldrow"><span data-icon="badge" class="ex-ic16"></span>司機同行紀念 · 這一段是 yoxi 陪你到的</span>' +
            '<span class="ex-unlock__goldrow" data-points>和泰 Points ' + num('+' + ridePoints()) + '</span>' +
          '</div>'
        : '') +
      '<div class="ex-unlock__in">' +
        '<input class="ex-unlock__input" data-one-line maxlength="40" placeholder="寫一句話（選填，最多 40 字）" aria-label="寫一句話">' +
      '</div>' +
      '<div class="ex-unlock__acts">' +
        '<button class="btn-primary ex-unlock__btn" type="button" data-act="collect">收進收藏</button>' +
      '</div>';

  return '<div class="unlock ex-unlock" data-unlock' + (isRide ? ' data-ride' : '') + '>' +
      '<div class="unlock__scene' + (got ? '' : ' is-on') + '" data-scene="1">' +
        '<div class="burst ex-burst">' +
          '<span class="burst__wave"></span><span class="burst__wave"></span>' +
          '<span class="ex-burst__bits">' +
            [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { return '<i style="--i:' + i + '"></i>'; }).join('') +
          '</span>' +
          '<span class="burst__dot ex-burst__dot"></span>' +
        '</div>' +
        '<h1 class="unlock__title">你到了<br>' + esc(name) + '</h1>' +
        '<p class="unlock__sub">' + arriveBy + '</p>' +
      '</div>' +
      '<div class="unlock__scene" data-scene="2">' +
        '<div class="gen">' +
          '<div class="gen__layer" data-art="' + esc(p.art) + '" data-seed="1"></div>' +
          '<div class="gen__layer ex-gen__l2"></div>' +
          '<div class="gen__layer ex-gen__l3"></div>' +
          '<div class="gen__layer ex-gen__l4"></div>' +
          '<div class="gen__sweep"></div>' +
          '<span class="gen__tag" data-gen-tag>yoxi ✕ AI 生成中</span>' +
        '</div>' +
        '<h2 class="unlock__title ex-unlock__t2">正在畫下今天的這裡</h2>' +
        '<p class="unlock__sub">依這個地方的樣子、今天的天氣與光線生成</p>' +
        '<p class="unlock__sub ex-unlock__skip">點一下畫面直接看結果</p>' +
      '</div>' +
      '<div class="unlock__scene' + (got ? ' is-on' : '') + '" data-scene="3">' +
        '<div class="ex-unlock__card">' +
          '<div class="postcard' + (isRide && !got ? ' postcard--gold' : '') + '" data-final-card>' +
            (isRide && !got ? '<span class="postcard__ribbon">yoxi 限定版</span>' : '') +
            '<div class="ex-fill" data-art="' + esc(p.art) + '" data-seed="1"></div>' +
            '<span class="ai-mark">AI 生成示意</span>' +
            '<span class="postcard__foot">' +
              '<span class="postcard__name">' + esc(name) + '</span>' +
              '<span class="postcard__date">' + year + '.' + esc(today) + ' · ' + esc(p.area || '新竹市') + '</span>' +
            '</span>' +
          '</div>' +
        '</div>' +
        act3Acts +
      '</div>' +
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

function mountUnlock(root, params, ctx) {
  const p = APP.place(params.id);
  if (!p) { APP.ui.setStatus('dark'); return; }
  const isRide = ctx.query.get('ride') === '1';
  const box = root.querySelector('[data-unlock]');
  const timers = [];
  const show = function (n) {
    box.querySelectorAll('.unlock__scene').forEach(function (s) {
      s.classList.toggle('is-on', s.getAttribute('data-scene') === String(n));
    });
    box.setAttribute('data-at', String(n));
  };
  const finish = function () {
    timers.forEach(clearTimeout);
    timers.length = 0;
    show(3);
  };

  const still = document.documentElement.hasAttribute('data-still');
  if (collected(p) || still) {
    finish();
  } else {
    show(1);
    const T = sceneMs();
    const tag = box.querySelector('[data-gen-tag]');
    timers.push(setTimeout(function () { show(2); if (tag) tag.textContent = '讀取今天的天氣與光線'; }, Math.round(T * 1.4)));
    timers.push(setTimeout(function () { if (tag) tag.textContent = '鎖定風格 · yoxi ✕ AI'; }, Math.round(T * 2.8)));
    timers.push(setTimeout(finish, Math.round(T * 4.2)));
  }
  /* 點畫面任意處跳到成品（成品那一幕本身不攔） */
  box.onclick = function () {
    if (box.getAttribute('data-at') !== '3') finish();
  };

  const btn = box.querySelector('[data-act="collect"]');
  let collecting = false;
  if (btn) {
    btn.onclick = function (e) {
      if (e) e.stopPropagation();
      /* 連點兩下只收一次、只導一次（第二下常落在轉場中還沒拆掉的舊畫面上） */
      if (collecting) return;
      collecting = true;
      btn.disabled = true;
      const input = box.querySelector('[data-one-line]');
      const note = input ? String(input.value || '').trim().slice(0, 40) : '';
      const trip = APP.store.get('trip');
      const km = isRide && trip && trip.km != null ? trip.km : fmt.km(p.dist);
      collect(p.id, { by: isRide ? 'ride' : 'walk', note: note, km: km });
      APP.ui.toast('收進收藏了');
      APP.nav.go('/album', { dir: 'push' });
    };
  }
  return function () { timers.forEach(clearTimeout); };
}

/* ---------------------------------------------------------------- /routes */

function renderRoutes() {
  return '<header class="hdr-red hdr-red--compact">' +
      '<div class="hdr-red__bar">' +
        '<a class="hdr-red__close" href="#" data-back="/explore" aria-label="返回"><span data-icon="close"></span></a>' +
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
  const R = (M().ROUTES || []).filter(function (r) { return r.id === params.id; })[0];
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
  const R = (M().ROUTES || []).filter(function (r) { return r.id === params.id; })[0];
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
    const R = (M().ROUTES || []).filter(function (r) { return r.id === params.id; })[0];
    return R ? R.name : '找不到這條路線';
  },
  render: renderRoute, mount: mountRoute,
});

})();
