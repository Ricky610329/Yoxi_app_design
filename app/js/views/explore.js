/* ==========================================================================
   yoxi 城事 web app — 今天內容與地方探索流程
   契約：app/ARCHITECTURE.md §3、§4、§5、§7、§8。只用 APP.view() 註冊，不改 app.js。

   今天內容嵌入 /ride?mode=today；另註冊地方詳情、前往、解鎖與路線畫面。
   提供 APP.explore.renderToday()、mountToday()、collect()（ride 的限定版解鎖也用）。

   /ride?mode=today 地圖首頁的今天 sheet（X2 缺口導向＋今天的地方）
     回答什麼：今天出門去哪？收藏裡還缺什麼、可以順便補哪一張？
     原型：variant-x2-explore.html（缺口）、explore.html（今天的地方、路線、還沒去）、
           variant-l1-explore.html（一屏一事：摘要可按數 ≤ 10，其他內容收進展開區）
     刻意沒有：百分比、進度環、勾選清單、「最快集滿」的排序理由、倒數與限量。
               缺口是一句陳述（你還沒有『水路』這一組的 1 張），不是一張待辦清單。
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
/* 今天展開區中的清單保持精簡；地圖上的十個地點由 ride.js 管理。 */
const TODAY_PENDING_MAX = 3;
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
      '<a class="btn-primary" href="#' + (o.href || '/ride?mode=today') + '" data-act="go-today">' +
        esc(o.cta || '回地圖') + '</a>' +
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
  renderToday: renderToday,
  mountToday: mountToday,
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

/* ---------------------------------------------------------------- 今天 sheet 的內容（由 ride.js 嵌入共用地圖） */

function renderToday() {
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

  const routes = pickRoutes();

  /* ---- X2 缺口 ---- */
  const g = gapPick();
  let gapHTML = '';
  if (g) {
    const chips = g.places.slice(0, 3);
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

  /* ---- 還沒去的地方：在展開內容裡精簡列出 ---- */
  const rows = TODAY_PENDING_MAX;
  const pending = (M().PENDING || []).filter(function (p) {
    const q = APP.place(p.id);
    return q && !collected(q);
  }).slice(0, rows);
  const pendHTML =
    '<section class="ex-block ex-block--last">' +
      '<div class="sec"><h2 class="sec__t">還沒去的地方</h2></div>' +
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

  return '<div class="ex-today-content">' + today +
    '<div class="ex-today-more" data-expand-only>' + gapHTML + routeHTML + pendHTML + '</div></div>';
}

/* 首頁放兩條：還沒走完的優先，其餘照 MOCK 順序補 */
function pickRoutes() {
  const all = M().ROUTES || [];
  const open = all.filter(function (r) { return S().routeDone(r.id) < r.total; });
  const rest = all.filter(function (r) { return open.indexOf(r) < 0; });
  return open.concat(rest).slice(0, 2);
}

function mountToday(root) {
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

/* 地圖上的位置圖釘由共用首頁管理；前往畫面仍沿用 placeMe。 */
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
    return backFabBar('/ride?mode=today') + notFound({ title: '找不到這個地方',
      text: '這個地方可能還沒寫好內容，或網址打錯了。先回地圖看看今天的地方。' });
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
        backFab('/ride?mode=today') +
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

/* 車已經叫了（配對中／行程中）：同時「走路前往」別的地方沒有意義 */
function activeTrip() {
  const t = APP.store.get('trip');
  return t && t.phase !== 'done' ? t : null;
}

function renderGoing(params) {
  const p = APP.place(params.id);
  if (!p) {
    return backFabBar('/ride?mode=today') + notFound({ title: '找不到這個地方', text: '沒有目的地就沒辦法帶路。先回地圖挑一個。' });
  }
  const trip = activeTrip();
  if (trip) {
    const dest = APP.place(trip.placeId);
    return backFabBar('/ride?mode=today') +
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
  if (!p || activeTrip()) { APP.ui.setStatus('dark'); return; }
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
    APP.nav.back('/ride?mode=today');
  };
  return function () { if (m) m.destroy(); };
}

/* ---------------------------------------------------------------- /unlock/:id */

function cardName(p) {
  const c = (M().POSTCARDS || []).filter(function (x) { return x.id === p.card; })[0];
  return c ? c.name : p.name;
}

/* ?ride=1 的限定版只給「真的搭車抵達這裡」的那一趟：store.trip 是這個地方、而且已抵達（phase done）。
   跟 /ride 的金色入口、/trip/done 的金色橫幅同一個判斷（ride.js 的 pendingUnlock 也要 phase done）。
   沒有這一趟就把網址上的 ?ride=1 當沒看到：不然手打一個網址就能拿金框和 +50 點。 */
function rideTripFor(p, ctx) {
  if (!p || !ctx || !ctx.query || ctx.query.get('ride') !== '1') return null;
  const trip = APP.store.get('trip');
  if (!trip || trip.phase !== 'done') return null;
  return trip.placeId === p.id ? trip : null;
}

function limitedPlace(p) {
  if (APP.ride && APP.ride.limitedPlace) return APP.ride.limitedPlace(p);
  return !!p && p.dist != null && p.dist > fmt.WALK_MAX_M;
}

function renderUnlock(params, ctx) {
  const p = APP.place(params.id);
  if (!p) {
    return backFabBar('/ride?mode=today') + notFound({ title: '找不到這個地方', text: '沒有這個地方的明信片。先回地圖看看。' });
  }
  const trip = rideTripFor(p, ctx);
  const isRide = !!trip;
  /* 金框＋50 點只給走不到的地方（ride.js 的 limitedPlace）；近的地方搭車抵達是一般卡 */
  const gold = isRide && limitedPlace(p);
  const got = collected(p);
  const name = cardName(p);
  const today = fmt.todayMMDD();
  const year = new Date().getFullYear();
  const km = isRide && trip.km != null ? trip.km : fmt.km(p.dist);
  const arriveBy = isRide
    ? '搭 yoxi 抵達 · ' + num(km) + ' 公里'
    : (p.dist != null ? '走了 ' + distHTML(p.dist) + ' 抵達' : '走路抵達');

  const act3Acts = got
    ? '<p class="ex-unlock__have">已在收藏裡</p>' +
      '<div class="ex-unlock__acts">' +
        (p.card ? '<a class="btn-primary ex-unlock__btn" href="#/postcard/' + esc(p.card) + '" data-act="open-postcard">看這張明信片</a>' : '') +
        '<a class="btn-link ex-center ex-unlock__link" href="#/ride?mode=today" data-act="go-today">回地圖</a>' +
      '</div>'
    : (gold
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

  return '<div class="unlock ex-unlock" data-unlock' + (gold ? ' data-ride' : '') + '>' +
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
          '<div class="postcard' + (gold && !got ? ' postcard--gold' : '') + '" data-final-card>' +
            (gold && !got ? '<span class="postcard__ribbon">yoxi 限定版</span>' : '') +
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
  const isRide = !!rideTripFor(p, ctx);
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

  if (collected(p) || APP.reduceMotion()) {
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
      /* 收的當下再判一次（畫面開著的時候行程可能被取消或換掉了） */
      const trip = rideTripFor(p, ctx);
      const ride = isRide && !!trip;
      const km = ride && trip.km != null ? trip.km : fmt.km(p.dist);
      /* 轉換歸因：這趟車是從哪個入口叫的，記在 app store（行程紀錄的小標），collect 會清掉 trip 所以先記 */
      if (ride && trip.via && p.card) {
        const rv = Object.assign({}, APP.store.get('rideVia') || {});
        rv[p.card] = trip.via;
        APP.store.set('rideVia', rv);
      }
      collect(p.id, { by: ride ? 'ride' : 'walk', note: note, km: km });
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
        '<a class="hdr-red__close" href="#" data-back="/ride?mode=today" aria-label="返回"><span data-icon="close"></span></a>' +
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

APP.view('place', {
  path: '/place/:id', tab: 'ride', status: 'light',
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
  path: '/routes', tab: 'ride', status: 'light', title: '這個月的路線',
  render: renderRoutes,
});

APP.view('route', {
  path: '/route/:id', tab: 'ride', status: 'light',
  title: function (params) {
    const R = (M().ROUTES || []).filter(function (r) { return r.id === params.id; })[0];
    return R ? R.name : '找不到這條路線';
  },
  render: renderRoute, mount: mountRoute,
});

})();
