/* ==========================================================================
   yoxi 城事 web app — 核心（window.APP）
   契約：app/ARCHITECTURE.md §3、§4、§9。改 API 先改那份文件。

   提供：view registry、hash router、nav（go/back/tab/current）、轉場、導覽後的焦點、
         store（localStorage yoxi-chengshi-app-v1，有結構版本與型別檢查）、事件 on/emit、fmt（全部公式）、
         esc、place()/places()（明信片 id／路線站 id 都正規化成地點）、
         ui（toast＋live region／confirm／a11yDialog／dismissOverlays／setStatus；share/push 由 system.js 覆寫）、
         map.mount()（HSMAP ＋ SHELL.renderSpots ＋ 景點互相推開）、桌機外框／手機滿版的判斷。

   規矩：
   - 模組層級不碰 DOM：node 單元測試會用 vm 載入這支，只 stub window／localStorage。
     所有 DOM 動作都在 APP.start() 之後。
   - 按鈕一律 element.onclick（測試的攔截器裝在後面，看不到早綁的 listener）。
   - 沒有任何寫死的數字：車資、分鐘、距離全在 fmt。
   ========================================================================== */

(function () {
'use strict';

const W = (typeof window !== 'undefined') ? window : globalThis;
const APP_KEY = 'yoxi-chengshi-app-v1';
/* 底欄的兩個入口。view 的 tab 仍可以是 'explore'（舊的探索路由），它歸在叫車底下：
   底欄亮叫車、tabPaths 記在 ride、再按叫車回 /ride（TAB_GROUP）。 */
const TABS = ['ride', 'album'];
const TAB_GROUP = { explore: 'ride' };
function tabGroup(tab) {
  const g = (tab && Object.prototype.hasOwnProperty.call(TAB_GROUP, tab)) ? TAB_GROUP[tab] : tab;
  return TABS.indexOf(g) >= 0 ? g : null;
}

/* --------------------------------------------------------------------------
   事件
   -------------------------------------------------------------------------- */
const listeners = {};
function on(name, fn) {
  (listeners[name] = listeners[name] || []).push(fn);
  return function off() {
    const a = listeners[name] || [];
    const i = a.indexOf(fn);
    if (i >= 0) a.splice(i, 1);
  };
}
function emit(name, data) {
  (listeners[name] || []).slice().forEach(function (fn) {
    try { fn(data); } catch (e) { console.error('APP.emit(' + name + '):', e); }
  });
}

/* --------------------------------------------------------------------------
   store：app 自己的狀態（收藏／點數等沿用 STATE）
   -------------------------------------------------------------------------- */
/* 存檔結構的版本：沒有 version 的是第 1 版（tabPaths 還有 explore）。
   讀進來一律跟 fresh() 對過型別，版本只是讓下一次改結構時知道要不要搬資料。 */
const STORE_VERSION = 2;

function fresh() {
  return {
    version: STORE_VERSION,
    onboarded: false,
    dropoff: null,        /* { id, name, km, setAt, via:'k1'|'e'|'search'|'route' } */
    trip: null,           /* { placeId, phase:'matching'|'riding'|'done', startedAt, rated, km } */
    pushes: [],           /* [{ when:'am'|'pm', at:ISO }] */
    arrivedDemo: null,    /* placeId */
    rideSpots: true,      /* 叫車地圖上要不要疊城事的景點（設定頁可關） */
    rideVia: {},          /* 明信片 id → 這趟車是從哪裡叫的（k1／e／route／search），行程紀錄的轉換歸因 */
    draws: {},            /* 地點 id → 走路抵達抽到、還沒收的款式 key（explore） */
    cardStyle: {},        /* 明信片 id → 收下時抽到的款式 key（explore） */
    fxMute: false,        /* 抵達與抽卡的音效關掉（explore） */
    tabPaths: { ride: '/ride', album: '/album' },
  };
}

/* 每個鍵收什麼型別（預設是 null 的鍵光看 fresh() 看不出來）。'?' 結尾＝也可以是 null；map＝一般物件（不是陣列） */
const KIND = {
  version: 'number', onboarded: 'boolean', dropoff: 'object?', trip: 'object?', pushes: 'array',
  arrivedDemo: 'string?', rideSpots: 'boolean', rideVia: 'map', draws: 'map', cardStyle: 'map',
  fxMute: 'boolean', tabPaths: 'map',
};
function kindOk(kind, v) {
  if (!kind) return true;
  const nullable = kind.slice(-1) === '?';
  const k = nullable ? kind.slice(0, -1) : kind;
  if (v === null || v === undefined) return nullable && v === null;
  if (k === 'array') return Array.isArray(v);
  if (k === 'object' || k === 'map') return typeof v === 'object' && !Array.isArray(v);
  if (k === 'number') return typeof v === 'number' && isFinite(v);
  return typeof v === k;
}

function ls() {
  try { return W.localStorage || (typeof localStorage !== 'undefined' ? localStorage : null); }
  catch (e) { return null; }
}

function load() {
  const base = fresh();
  try {
    const L = ls();
    const raw = L && L.getItem(APP_KEY);
    const got = raw ? JSON.parse(raw) : null;
    if (!got || typeof got !== 'object' || Array.isArray(got)) return base;
    /* 認得的鍵：型別不對（舊版、手改、別的程式寫壞）就用預設值；
       不認得的鍵原樣留著（別的區塊新加、還沒進 fresh() 的，不能讀一次就被洗掉） */
    const s = {};
    Object.keys(got).forEach(function (k) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
      s[k] = got[k];
    });
    Object.keys(base).forEach(function (k) {
      if (!Object.prototype.hasOwnProperty.call(got, k) || !kindOk(KIND[k], got[k])) s[k] = base[k];
    });
    /* tabPaths 只收「/ 開頭的字串」：舊版或手改過的值（null、數字、整串字串）不能讓 nav.tab 導到怪地方。
       第 1 版的 tabPaths.explore 不再用（探索歸在叫車底下），順手丟掉 */
    const tp = s.tabPaths;
    s.tabPaths = fresh().tabPaths;
    TABS.forEach(function (k) {
      if (typeof tp[k] === 'string' && tp[k][0] === '/') s.tabPaths[k] = tp[k];
    });
    s.version = STORE_VERSION;
    return s;
  } catch (e) {
    return base;
  }
}

let S = load();

function save() {
  try { const L = ls(); if (L) L.setItem(APP_KEY, JSON.stringify(S)); }
  catch (e) { /* 私密視窗會丟錯，忽略 */ }
}

const store = {
  KEY: APP_KEY,
  fresh: fresh,
  get all() { return S; },
  get: function (k) { return S[k]; },
  set: function (k, v) { S[k] = v; save(); emit('store:change', { key: k }); return v; },
  patch: function (obj) {
    Object.assign(S, obj || {});
    save();
    Object.keys(obj || {}).forEach(function (k) { emit('store:change', { key: k }); });
  },
  reset: function () { S = fresh(); save(); emit('store:change', { key: null }); },
  /* 重新從 localStorage 讀（測試換了 localStorage 之後用） */
  reload: function () { S = load(); },
};

/* --------------------------------------------------------------------------
   fmt：全部公式，畫面不准手寫數字
   -------------------------------------------------------------------------- */
function pad2(n) { return (n < 10 ? '0' : '') + n; }
const fmt = {
  WALK_MAX_M: 3000,
  fare:    function (km) { return Math.round(75 + 22 * km); },
  rideMin: function (km) { return Math.round(3 + 2.2 * km); },
  walkMin: function (m)  { return Math.round(m / 75); },
  dist:    function (m) {
    m = Number(m) || 0;
    /* 先四捨五入再挑單位：999.6 公尺是「1.0 km」，不是「1000 m」 */
    const r = Math.round(m);
    return r < 1000 ? r + ' m' : (m / 1000).toFixed(1) + ' km';
  },
  canWalk: function (m) { return m != null && m <= fmt.WALK_MAX_M; },
  km:      function (m) { return Math.round((Number(m) || 0) / 100) / 10; },   /* 公尺 → 公里（一位小數） */
  todayMMDD: function (d) { d = d || new Date(); return pad2(d.getMonth() + 1) + '.' + pad2(d.getDate()); },
  clock:   function (d) { d = d || new Date(); return d.getHours() + ':' + pad2(d.getMinutes()); },
  greet:   function (hour) {
    const h = hour == null ? new Date().getHours() : hour;
    return (h >= 5 && h < 11) ? '早安' : (h >= 11 && h < 18) ? '午安' : '晚安';
  },
  num:     function (n) {
    const s = String(Math.round(Number(n) || 0));
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },
};

/* MOCK 的敘事文字裡手寫了數字（例：內灣「從你家 28 公里，搭車 42 分鐘」），
   跟同一頁用公式算的分鐘數對不起來。把「搭車 N 分鐘」「走路 N 分鐘」「N 公里」換成這個地方的公式值。
   只換阿拉伯數字，「不到三公里」這種描述不動。dist 是公尺；null（距離待確認）就原樣回傳。 */
fmt.fixText = function (text, dist) {
  if (text == null || dist == null || isNaN(Number(dist))) return text;
  const km = fmt.km(dist);
  return String(text)
    .replace(/搭車\s*\d+\s*分鐘/g, '搭車 ' + fmt.rideMin(km) + ' 分鐘')
    .replace(/走路\s*\d+\s*分鐘/g, '走路 ' + fmt.walkMin(dist) + ' 分鐘')
    .replace(/\d+(?:\.\d+)?\s*公里/g, km + ' 公里');
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* --------------------------------------------------------------------------
   地方：MOCK.findPlace 的正規化
   dist 一律公尺；card 是明信片 id（沒有對應的明信片就是 null）
   -------------------------------------------------------------------------- */
function M() { return W.MOCK || {}; }

function knownId(id) {
  const m = M();
  if (!id || typeof id !== 'string') return false;
  if (m.TODAY && m.TODAY.id === id) return true;
  if (m.FAR_PLACE && m.FAR_PLACE.id === id) return true;
  /* 用 hasOwnProperty：'constructor'、'toString' 這類 id 不能從原型鏈上撿到東西
     （否則 findPlace 會默默退回今天的地方，/place/constructor 顯示成玻璃窯） */
  if (m.CARD_TO_PLACE && Object.prototype.hasOwnProperty.call(m.CARD_TO_PLACE, id)) return true;
  const hit = function (arr) { return (arr || []).some(function (p) { return p.id === id; }); };
  if (hit(m.SPOTS) || hit(m.PENDING) || hit(m.POSTCARDS)) return true;
  return (m.ROUTES || []).some(function (r) {
    return (r.stops || []).some(function (s) { return s.id === id || s.card === id; });
  });
}

function cardOf(p) {
  const m = M();
  const cards = m.POSTCARDS || [];
  const isCard = function (c) { return cards.some(function (x) { return x.id === c; }); };
  const c = m.cardIdOf ? m.cardIdOf(p.id) : p.id;
  if (isCard(c)) return c;
  const byName = cards.filter(function (x) { return x.name === p.name; })[0];
  return byName ? byName.id : null;
}

/* 可去的地方（SPOTS ∪ PENDING ∪ TODAY ∪ FAR_PLACE）的原始資料，依序、去重 */
function basePlaces() {
  const m = M();
  const seen = {};
  return [].concat(m.SPOTS || [], m.PENDING || [], m.TODAY ? [m.TODAY] : [], m.FAR_PLACE ? [m.FAR_PLACE] : [])
    .filter(function (p) {
      if (!p || !p.id || seen[p.id]) return false;
      seen[p.id] = 1;
      return true;
    });
}

/* 任何 id → 它真正的地點 id。
   MOCK.CARD_TO_PLACE 只列了六張明信片；其餘的（p1 新竹車站、p2 東門市場…）從可去的地方反查
   「哪個地方的明信片是這張」，否則 /place/p1 跟 /place/station 會是兩個不同的地方（p2 甚至沒有距離）。
   路線站 id（s1、g2…）先換成站上的明信片 id 再查。都查不到（只在路線上、沒有對應地方的站，例 p3、p14）就原樣回傳。 */
function canonId(id) {
  const m = M();
  const own = Object.prototype.hasOwnProperty;
  (m.ROUTES || []).some(function (r) {
    return (r.stops || []).some(function (st) {
      if (st.id === id && st.card) { id = st.card; return true; }
      return false;
    });
  });
  if (m.CARD_TO_PLACE && own.call(m.CARD_TO_PLACE, id)) return m.CARD_TO_PLACE[id];
  const isCard = (m.POSTCARDS || []).some(function (c) { return c.id === id; });
  if (!isCard) return id;
  const hit = basePlaces().filter(function (p) { return cardOf(p) === id; })[0];
  return hit ? hit.id : id;
}

function place(id) {
  const m = M();
  if (!id || !m.findPlace || !knownId(id)) return null;
  const f = m.findPlace(canonId(id));
  if (!f) return null;
  const spot = (m.SPOTS || []).filter(function (s) { return s.id === f.id; })[0];
  const geo = (W.HSINCHU_PLACES || {})[f.id];
  const dist = f.distance != null ? f.distance : (spot && spot.dist != null ? spot.dist : null);
  const fix = function (t) { return fmt.fixText(t, dist); };
  const fixList = function (arr) {
    return (arr || []).map(function (x) { return Object.assign({}, x, { text: fix(x.text) }); });
  };
  return {
    id: f.id,
    name: f.name,
    art: f.art,
    dist: dist,                               /* 公尺；null＝距離待確認 */
    type: f.type || '地方',
    hook: fix(f.hook || ''),
    area: f.area || '',
    eyebrow: f.eyebrow || '',
    story: fixList(f.story),
    why: fixList(f.why),
    tip: fix(f.tip || ''),
    hours: f.hours || '',
    card: cardOf(f),
    state: spot ? spot.state : null,          /* SPOTS 上的 today／seen／new */
    lat: geo ? geo.lat : undefined,
    lon: geo ? geo.lon : undefined,
    raw: f,
  };
}

function places() {
  const out = [];
  basePlaces().forEach(function (p) {
    const n = place(p.id);
    if (n) out.push(n);
  });
  return out;
}

/* --------------------------------------------------------------------------
   view registry 與路由比對
   -------------------------------------------------------------------------- */
const views = {};            /* name → def */
const routes = [];           /* { pattern, keys, re, name } */

function compile(pattern) {
  const keys = [];
  const src = pattern.split('/').map(function (seg) {
    if (seg[0] === ':') { keys.push(seg.slice(1)); return '([^/]+)'; }
    return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('/');
  return { pattern: pattern, keys: keys, re: new RegExp('^' + src + '$') };
}

function view(name, def) {
  if (!name || !def) throw new Error('APP.view(name, def)');
  def = Object.assign({}, def, { name: name });
  const paths = [].concat(def.path || []);
  if (!paths.length) throw new Error('APP.view(' + name + ')：少了 path');
  if (views[name]) {                               /* 重複註冊＝覆寫 */
    for (let i = routes.length - 1; i >= 0; i--) if (routes[i].name === name) routes.splice(i, 1);
  }
  views[name] = def;
  paths.forEach(function (p) {
    const r = compile(p);
    r.name = name;
    routes.push(r);
  });
  /* 參數少的先比（/trip/done 不會被 /trip/:x 吃掉） */
  routes.sort(function (a, b) { return a.keys.length - b.keys.length; });
  return def;
}

/* §8 路由總表：還沒被區塊註冊的 path 先顯示「尚未建檔」，app 仍能跑、測試能導覽 */
const PLANNED = [
  ['/welcome', null], ['/ride', 'ride'], ['/dropoff', 'ride'], ['/pickup', 'ride'],
  ['/trip', null], ['/trip/done', null], ['/drawer', 'ride'], ['/points', 'ride'],
  ['/notify', 'ride'], ['/trips', 'ride'],
  ['/explore', 'explore'], ['/explore/map', 'explore'], ['/place/:id', 'explore'],
  ['/going/:id', null], ['/unlock/:id', null], ['/routes', 'explore'], ['/route/:id', 'explore'],
  ['/album', 'album'], ['/postcard/:id', 'album'], ['/badge/:id', 'album'], ['/footprint', 'album'],
  ['/lookback', null], ['/week', 'album'], ['/elder', 'album'], ['/settings', null],
].map(function (x) { const r = compile(x[0]); r.tab = x[1]; return r; });

function parse(hash) {
  let h = String(hash || '').replace(/^#/, '');
  if (!h) h = '/';
  if (h[0] !== '/') h = '/' + h;
  const qi = h.indexOf('?');
  let path = qi >= 0 ? h.slice(0, qi) : h;
  const qs = qi >= 0 ? h.slice(qi + 1) : '';
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return { path: path || '/', qs: qs, query: new URLSearchParams(qs) };
}

function exec(r, path) {
  const m = r.re.exec(path);
  if (!m) return null;
  const params = {};
  r.keys.forEach(function (k, i) {
    try { params[k] = decodeURIComponent(m[i + 1]); } catch (e) { params[k] = m[i + 1]; }
  });
  return params;
}

/* 回傳 { name, def, pattern, params } */
function resolve(path) {
  for (let i = 0; i < routes.length; i++) {
    const params = exec(routes[i], path);
    if (params) return { name: routes[i].name, def: views[routes[i].name], pattern: routes[i].pattern, params: params };
  }
  for (let i = 0; i < PLANNED.length; i++) {
    const params = exec(PLANNED[i], path);
    if (params) {
      return { name: '_placeholder', pattern: PLANNED[i].pattern, params: params,
               def: Object.assign({}, BUILTIN._placeholder, { tab: PLANNED[i].tab }) };
    }
  }
  return { name: '_404', def: BUILTIN._404, pattern: '/*', params: {} };
}

/* 內建畫面：尚未建檔、404、錯誤卡 */
function emptyCard(o) {
  return '<div class="app-empty">' +
    '<div class="app-empty__card' + (o.kind ? ' app-empty__card--' + o.kind : '') + '">' +
      '<p class="app-empty__eyebrow">' + esc(o.eyebrow) + '</p>' +
      '<h1 class="app-empty__t">' + esc(o.title) + '</h1>' +
      (o.text ? '<p class="app-empty__p">' + esc(o.text) + '</p>' : '') +
      '<a class="btn-primary" href="#/ride" data-act="go-ride">回叫車</a>' +
    '</div></div>';
}
const BUILTIN = {
  _placeholder: {
    name: '_placeholder', status: 'dark', title: '尚未建檔',
    render: function (params, ctx) {
      return emptyCard({ eyebrow: '尚未建檔', title: '尚未建檔：' + ctx.path,
                         text: '這一頁還在做，先回叫車首頁。', kind: 'todo' });
    },
  },
  _404: {
    name: '_404', status: 'dark', tab: null, title: '找不到這一頁',
    render: function (params, ctx) {
      return emptyCard({ eyebrow: '404', title: '這裡沒有東西',
                         text: '你要找的 ' + ctx.path + ' 不在這個 app 裡。', kind: 'missing' });
    },
  },
};

/* --------------------------------------------------------------------------
   以下是 DOM 部分（全部在 start() 之後才會跑）
   -------------------------------------------------------------------------- */
let started = false;
let cur = null;             /* { path, qs, query, pattern, params, name, tab, def } */
let curIdx = 0;             /* history.state.i：判斷前進／返回、back 會不會離開 app */
let cleanup = null;
let pendingDir = null;
let finishTimer = null;
let finishPending = null;
/* nav.back 已經呼叫 history.back()、還沒等到 popstate：這段期間再按返回不能再退一格
   （返回鍵連按兩下，第二下常落在轉場中的舊畫面上；序號只剩 1 時第二下會直接退出 app） */
let backPending = false;
let backTimer = null;
function clearBackPending() {
  backPending = false;
  if (backTimer) { clearTimeout(backTimer); backTimer = null; }
}
/* 上一次 route() 畫的是哪個 location.hash：popstate 回到同一個網址（不會有 hashchange）時靠它認出來 */
let routedHash = null;
let routedOnce = false;     /* 這次載入是不是已經畫過第一頁（首頁的 onboarding 判斷用） */

/* 兩個 hash 是不是同一頁（location.hash 會把中文 percent-encode，比之前先解開） */
function normHash(h) {
  h = String(h == null ? '' : h).replace(/^#/, '');
  try { h = decodeURIComponent(h); } catch (e) { /* 壞掉的 % 序列：原樣比 */ }
  return h;
}
function sameHash(a, b) { return normHash(a) === normHash(b); }

function $(sel, root) { return (root || document).querySelector(sel); }

function isStill() {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.hasAttribute('data-still')) return true;
  try { if (W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches) return true; }
  catch (e) { /* ignore */ }
  return false;
}

function durationMs() {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--t-base').trim();
    const n = parseFloat(v);
    if (!isNaN(n)) return /ms$/.test(v) ? n : n * 1000;
  } catch (e) { /* ignore */ }
  return 240;
}

function stamp(i, replaceUrl) {
  try {
    const st = Object.assign({}, history.state || {}, { yoxiApp: 1, i: i });
    if (replaceUrl != null) history.replaceState(st, '', replaceUrl);
    else history.replaceState(st, '');
  } catch (e) { /* ignore */ }
}

function fullPath(p) { return p.path + (p.qs ? '?' + p.qs : ''); }

/* ---- nav ---- */
const nav = {
  go: function (path, opt) {
    opt = opt || {};
    path = String(path || '/').replace(/^#/, '');
    if (path[0] !== '/') path = '/' + path;
    if (!started) { try { location.hash = '#' + path; } catch (e) { /* ignore */ } return; }
    const url = '#' + path;
    let dir = opt.dir || 'push';
    /* 目標就是現在這一頁：換掉這一筆，不疊一筆一模一樣的。疊了之後按返回只有 popstate、沒有 hashchange，
       畫面不動、序號也對不上，要按兩次；那筆若是第一筆，第二次直接離開 app */
    const replace = !!opt.replace || sameHash(url, location.hash);
    try {
      if (replace) {
        history.replaceState({ yoxiApp: 1, i: curIdx }, '', url);
        if (!opt.dir) dir = 'none';
      } else {
        curIdx += 1;
        history.pushState({ yoxiApp: 1, i: curIdx }, '', url);
      }
    } catch (e) {
      /* 萬一 pushState 被擋（某些 file:// 環境）：退回改 hash，讓 hashchange 接手 */
      pendingDir = dir;
      if (replace) location.replace(url); else location.hash = url;
      return;
    }
    route(dir);
  },
  back: function (fallback) {
    if (backPending) return;
    if (curIdx > 0) {
      backPending = true;
      /* popstate 一定會來；保險起見一秒後也放開（例如瀏覽器擋掉了這次返回） */
      backTimer = setTimeout(clearBackPending, 1000);
      pendingDir = 'back';
      history.back();
      return;
    }
    nav.go(fallback || '/ride', { replace: true, dir: 'back' });
  },
  tab: function (id) {
    id = tabGroup(id);
    if (!id) return;
    const here = cur && tabGroup(cur.tab);
    /* 已經在這個 tab：回到它的根；不然回到它最後停的那一頁 */
    const target = (here === id) ? '/' + id : (S.tabPaths[id] || '/' + id);
    if (cur && target === fullPath(cur)) return;
    nav.go(target, { dir: 'tab' });
  },
  current: function () {
    if (!cur) return null;
    return { path: cur.path, pattern: cur.pattern, params: Object.assign({}, cur.params),
             query: new URLSearchParams(cur.qs), name: cur.name, tab: cur.tab };
  },
  href: function (path) { return '#' + path; },
  /* 只換目前這一頁的 query（不重畫、不新增歷史）：pill 之類的頁內狀態寫回網址用。
     同步 current()、tabPaths，切 tab 再回來會停在同一段。qs 可以是 'tab=journal' 或 URLSearchParams。 */
  replaceQuery: function (qs) {
    if (!cur) return;
    qs = String(qs == null ? '' : qs).replace(/^\?/, '');
    cur.qs = qs;
    cur.query = new URLSearchParams(qs);
    const full = fullPath(cur);
    try { history.replaceState(Object.assign({}, history.state || {}, { yoxiApp: 1, i: curIdx }), '', '#' + full); }
    catch (e) { /* ignore */ }
    routedHash = location.hash;
    remember(cur.tab, cur.def, full);
  },
};

/* 記住各 tab 最後停的 path（安靜地寫，不 emit）。view 設 remember:false 的過場頁（例 /drawer）不記：
   不然開抽屜 → 切收藏 → 再按叫車，會回到抽屜 */
function remember(tab, def, full) {
  const g = tabGroup(tab);
  if (!g || (def && def.remember === false)) return;
  S.tabPaths = Object.assign({}, S.tabPaths, { [g]: full });
  save();
}

/* ---- 路由主流程 ---- */
/* popstate 一定先於 hashchange。網址變了的交給 onHashChange（它要拿舊的序號判斷前進／返回）；
   網址沒變（同一個 hash 的兩筆紀錄之間，例如舊版疊出來的重複紀錄）不會有 hashchange：
   這裡把序號對齊 history.state.i、放開 nav.back 的等待，畫面不用重畫 */
function onPopState() {
  clearBackPending();
  if (location.hash !== routedHash) return;
  pendingDir = null;
  const st = history.state;
  if (st && typeof st.i === 'number') curIdx = st.i;
}

function onHashChange() {
  const st = history.state;
  let dir = pendingDir;
  pendingDir = null;
  if (st && typeof st.i === 'number') {
    if (!dir) dir = st.i < curIdx ? 'back' : (st.i > curIdx ? 'push' : 'none');
    curIdx = st.i;
  } else {
    /* 點 <a href="#/…"> 產生的新紀錄：蓋上序號 */
    curIdx += 1;
    stamp(curIdx);
    if (!dir) dir = 'push';
  }
  route(dir);
}

function finishNow() {
  if (finishTimer) { clearTimeout(finishTimer); finishTimer = null; }
  if (finishPending) { const f = finishPending; finishPending = null; f(); }
}

/* 第一次載入就落在這些底欄的根（裝到桌面後的 start_url、書籤）時，還沒看過 onboarding 先去 /welcome */
const FIRST_RUN_ROOTS = ['/ride', '/album'];
function hasWelcome() { return routes.some(function (r) { return r.pattern === '/welcome'; }); }

function route(dir) {
  /* 0. 上一頁開著的浮層（確認框、分享面板、推播…）先收掉：留著的話，它的動作會落在新的這一頁上 */
  dismissOverlays();
  finishNow();
  clearBackPending();
  const p = parse(location.hash);
  routedHash = location.hash;
  const firstRoute = !routedOnce;
  routedOnce = true;

  /* '/'：第一次開先 onboarding（system 有註冊才去），其餘去叫車 */
  if (p.path === '/') {
    const toWelcome = !S.onboarded && hasWelcome();
    nav.go(toWelcome ? '/welcome' : '/ride', { replace: true, dir: 'none' });
    return;
  }
  if (firstRoute && !S.onboarded && !p.qs && FIRST_RUN_ROOTS.indexOf(p.path) >= 0 && hasWelcome()) {
    nav.go('/welcome', { replace: true, dir: 'none' });
    return;
  }

  const r = resolve(p.path);
  const def = r.def;
  const prev = cur;
  const tab = def.tab === undefined ? null : def.tab;
  cur = { path: p.path, qs: p.qs, query: p.query, pattern: r.pattern, params: r.params,
          name: r.name, tab: tab, def: def };

  /* 跨 tab 的根畫面用淡入，不用滑動（探索歸在叫車底下：叫車 → 探索是往前滑，不是換 tab） */
  if (dir === 'push' && prev && def.root && tabGroup(prev.tab) && tabGroup(tab) &&
      tabGroup(prev.tab) !== tabGroup(tab)) dir = 'tab';
  if (!prev) dir = 'none';

  /* 1. 舊 view 收尾 */
  if (cleanup) { try { cleanup(); } catch (e) { console.error('view cleanup:', e); } cleanup = null; }
  document.documentElement.removeAttribute('data-view-ready');

  /* 2. 記住各 tab 最後停的 path（安靜地寫，不 emit；remember:false 的過場頁不記） */
  remember(tab, def, fullPath(p));

  const ctx = { query: p.query, from: prev ? fullPath(prev) : null, state: W.STATE,
                store: store, path: p.path, pattern: r.pattern };

  /* 3. render */
  const host = $('#view');
  const main = document.createElement('main');
  main.className = 'view';
  main.setAttribute('data-view', r.name);
  let ok = true;
  try {
    const html = def.render ? def.render(r.params, ctx) : '';
    main.innerHTML = html == null ? '' : String(html);
  } catch (e) {
    ok = false;
    reportError(e, 'render ' + r.name);
    main.innerHTML = errorCard(e);
  }

  /* body 屬性、標題、狀態列、tab bar */
  const b = document.body;
  b.setAttribute('data-view', r.name);
  b.setAttribute('data-route', r.pattern);
  if (tab) b.setAttribute('data-tab', tab); else b.removeAttribute('data-tab');
  let title = def.title;
  try { if (typeof title === 'function') title = title(r.params, ctx); } catch (e) { title = ''; }
  document.title = (title ? title + ' — ' : '') + 'yoxi 城事';
  setStatus(def.status || 'dark');
  renderTabbar();

  /* 舊的 main 標成離場，不再被測試選到 */
  const olds = Array.prototype.slice.call(host.querySelectorAll(':scope > main.view'));
  olds.forEach(function (o) {
    o.removeAttribute('data-view');
    o.setAttribute('data-leaving', '');
    o.setAttribute('inert', '');
    o.setAttribute('aria-hidden', 'true');
  });
  host.appendChild(main);

  /* 4. 共用裝飾：圖示、插畫、data-toast（views 可以在 mount 裡覆寫 onclick） */
  try {
    if (W.SHELL) { SHELL.injectArt(main); SHELL.injectIcons(main); }
    main.querySelectorAll('[data-toast]').forEach(function (el) {
      if (!el.onclick) el.onclick = function (e) { if (e) e.preventDefault(); ui.toast(el.dataset.toast); };
    });
  } catch (e) { reportError(e, 'decorate ' + r.name); }

  /* 5. mount：mount 期間掛在 window／document 上的 listener 記下來，離開這一頁時拆掉
     （INTERACT.initSheet／initPan 每次都在 window 上掛 pointermove／pointerup，不拆會越積越多） */
  if (ok && def.mount) {
    const tracked = trackListeners();
    let c = null;
    try {
      c = def.mount(main, r.params, ctx);
    } catch (e) {
      reportError(e, 'mount ' + r.name);
      main.innerHTML = errorCard(e);
    } finally {
      tracked.stop();
    }
    cleanup = function () {
      try { if (typeof c === 'function') c(); }
      finally { tracked.remove(); }
    };
  }

  /* 6. 轉場 → ready */
  const done = function () {
    olds.forEach(function (o) { o.remove(); });
    main.classList.remove('view--in-push', 'view--in-back', 'view--in-tab');
    focusView(main);
    document.documentElement.setAttribute('data-view-ready', '1');
    if (!document.documentElement.hasAttribute('data-app-ready')) {
      document.documentElement.setAttribute('data-app-ready', '1');
    }
    emit('route:change', nav.current());
  };

  if (dir === 'none' || !olds.length || isStill()) { done(); return; }
  main.classList.add('view--in-' + dir);
  olds.forEach(function (o) { o.classList.add('view--out-' + dir); });
  finishPending = done;
  finishTimer = setTimeout(function () { finishTimer = null; finishPending = null; done(); }, durationMs() + 40);
}

/* 暫時包住 window／document 的 addEventListener，記下 mount 期間掛上去的 listener。
   只在 mount 同步執行的那一段有效；stop() 還原，remove() 拆掉記到的那些。 */
function trackListeners() {
  const added = [];
  const targets = [W, document];
  const saved = targets.map(function (tg) {
    const own = Object.prototype.hasOwnProperty.call(tg, 'addEventListener');
    const orig = tg.addEventListener;
    tg.addEventListener = function (type, fn, opt) {
      added.push([tg, type, fn, opt]);
      return orig.call(tg, type, fn, opt);
    };
    return { tg: tg, own: own, orig: orig };
  });
  return {
    added: added,
    stop: function () {
      saved.forEach(function (x) {
        if (x.own) x.tg.addEventListener = x.orig;
        else delete x.tg.addEventListener;
      });
    },
    remove: function () {
      added.splice(0).forEach(function (a) {
        try { a[0].removeEventListener(a[1], a[2], a[3]); } catch (e) { /* ignore */ }
      });
    },
  };
}

function errorCard(e) {
  return '<div class="app-empty"><div class="app-empty__card app-empty__card--error" data-app-error>' +
    '<p class="app-empty__eyebrow">畫面出錯</p>' +
    '<h1 class="app-empty__t">這一頁沒有畫出來</h1>' +
    '<p class="app-empty__p">' + esc(e && e.message ? e.message : String(e)) + '</p>' +
    '<a class="btn-primary" href="#/ride" data-act="go-ride">回叫車</a>' +
    '</div></div>';
}

function reportError(e, where) {
  console.error('[APP] ' + (where || ''), e);
  try {
    const pre = document.getElementById('app-errors');
    if (pre) pre.textContent += '[' + (where || 'error') + '] ' + (e && e.stack ? e.stack : String(e)) + '\n';
  } catch (x) { /* ignore */ }
}

/* ---- tab bar ---- */
const TABDEF = [
  { id: 'ride',    label: '叫車', icon: 'tabRide' },
  { id: 'album',   label: '收藏', icon: 'tabAlbum' },
];

/* 底欄只建一次；之後每次導覽只換 is-active／aria-current（整條重畫會把停在某一格上的鍵盤焦點弄丟）。
   底欄不看 STATE／store（沒有小圓點、沒有數字），所以只在 route() 裡更新。 */
function buildTabbar(nb) {
  nb.innerHTML = TABDEF.map(function (t) {
    return '<a class="tabbar__item" href="#/' + t.id + '" data-tab-id="' + t.id + '">' +
      '<span class="tabbar__icon">' +
        '<span data-icon="' + t.icon + '" style="display:block;width:26px;height:26px"></span>' +
      '</span><span>' + t.label + '</span></a>';
  }).join('');
  nb.querySelectorAll('[data-tab-id]').forEach(function (a) {
    a.onclick = function (e) { if (e) e.preventDefault(); nav.tab(a.getAttribute('data-tab-id')); };
  });
  if (W.SHELL) SHELL.injectIcons(nb);
}

function renderTabbar() {
  const nb = $('#tabbar');
  if (!nb) return;
  const screen = $('.device__screen');
  const tab = cur && cur.tab;
  if (!tab) {
    nb.hidden = true;
    if (screen) screen.classList.remove('has-tabbar');
    return;
  }
  nb.hidden = false;
  if (screen) screen.classList.add('has-tabbar');
  if (!nb.querySelector('[data-tab-id]')) buildTabbar(nb);
  /* 探索的舊路由（tab:'explore'）亮叫車：探索模式現在住在 /ride 裡 */
  const active = tabGroup(tab);
  nb.querySelectorAll('[data-tab-id]').forEach(function (a) {
    const on = a.getAttribute('data-tab-id') === active;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

/* ---- 導覽後的焦點 ----
   換頁之後焦點常常落在 body（剛按的連結跟著舊畫面一起拆掉了），報讀器什麼都不念。
   mount 自己放好焦點（在新畫面裡）就不動；在浮層、對話框、demo 面板裡也不搶；
   其餘移到新畫面的第一個 h1（沒有 h1 或 h1 看不見就是 main 本身）。這些目標不是可按的東西，不畫外框（app.css）。 */
function focusView(main) {
  if (!main || !main.isConnected) return;
  const a = document.activeElement;
  if (a && a !== document.body && a !== document.documentElement && a.isConnected) {
    if (main.contains(a)) return;
    if (a.closest && a.closest('[aria-modal="true"], [data-overlay], #demo-panel')) return;
  }
  const put = function (el) {
    if (!el) return false;
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.setAttribute('data-nav-focus', '');
    try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (x) { /* ignore */ } }
    return document.activeElement === el;
  };
  if (!put(main.querySelector('h1'))) put(main);
}

/* ---- 狀態列 ---- */
function setStatus(tone) {
  const light = tone === 'light';
  const sb = $('.device .statusbar');
  if (sb) sb.classList.toggle('statusbar--light', light);
  const hb = $('.device .home-bar');
  if (hb) hb.classList.toggle('home-bar--light', light);
  document.body.setAttribute('data-status', light ? 'light' : 'dark');
}

function tickClock() {
  const t = $('.device .statusbar__time > span');
  if (t) t.textContent = fmt.clock();
}

/* ---- 對話框可及性：焦點移進去、Tab 在框裡繞、背景 inert、Esc 關、關掉之後焦點回原處 ----
   a11yDialog(dialogEl, { label, onEsc, focus }) → release()。release 可以重複呼叫。
   疊著開（例：分享面板上又開確認框）時只有最上面那個吃 Tab／Esc；全部關掉才解除背景的 inert。 */
const dialogs = [];                                  /* 開著的對話框，最上面的在最後 */
const INERT_IDS = ['view', 'tabbar', 'demo-panel'];  /* 對話框開著時整塊不能點、不能 Tab、報讀器看不到 */
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';

function syncInert() {
  const on = dialogs.length > 0;
  INERT_IDS.forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert');
  });
}

/* 框被別人直接拆掉、沒呼叫 release：當作關了（不然背景永遠 inert） */
function pruneDialogs() {
  dialogs.slice().forEach(function (d) { if (!d.dlg.isConnected) d.release(); });
}

function tabbables(root) {
  return Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), function (el) {
    if (el.disabled || el.getAttribute('tabindex') === '-1') return false;
    if (el.closest('[inert], [hidden]')) return false;
    return el.getClientRects().length > 0;
  });
}

function focusEl(el) {
  if (!el) return;
  try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (x) { /* ignore */ } }
}

function a11yDialog(dlg, opt) {
  opt = opt || {};
  pruneDialogs();
  const before = document.activeElement;
  dlg.setAttribute('role', 'dialog');
  dlg.setAttribute('aria-modal', 'true');
  if (opt.label) dlg.setAttribute('aria-label', opt.label);
  const entry = { dlg: dlg, release: null, onEsc: opt.onEsc || null };
  const onKey = function (e) {
    if (dialogs[dialogs.length - 1] !== entry) return;
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      if (opt.onEsc) opt.onEsc();
      return;
    }
    if (e.key !== 'Tab') return;
    /* Tab／Shift+Tab 在框裡繞：到了最後一個回第一個，反之亦然；焦點跑到框外就拉回來 */
    const list = tabbables(dlg);
    const a = document.activeElement;
    if (!list.length) {
      e.preventDefault();
      if (!dlg.hasAttribute('tabindex')) dlg.setAttribute('tabindex', '-1');
      focusEl(dlg);
      return;
    }
    const first = list[0], last = list[list.length - 1];
    const inside = dlg.contains(a);
    if (e.shiftKey && (!inside || a === first || a === dlg)) { e.preventDefault(); focusEl(last); }
    else if (!e.shiftKey && (!inside || a === last)) { e.preventDefault(); focusEl(first); }
  };
  document.addEventListener('keydown', onKey);
  dialogs.push(entry);
  syncInert();
  const first = opt.focus || tabbables(dlg)[0] || dlg.querySelector(FOCUSABLE);
  focusEl(first);
  let released = false;
  entry.release = function release() {
    if (released) return;
    released = true;
    document.removeEventListener('keydown', onKey);
    const i = dialogs.indexOf(entry);
    if (i >= 0) dialogs.splice(i, 1);
    /* 先解除背景的 inert，原本的按鈕才叫得回焦點 */
    syncInert();
    if (before && before !== document.body && before.isConnected && typeof before.focus === 'function' &&
        !(before.closest && before.closest('[inert]'))) {
      focusEl(before);
    }
  };
  return entry.release;
}

/* ---- 浮層：導覽時一律收掉 ----
   掛在 .device 上（main.view 外面）、換頁就該消失的東西加 data-overlay；要善後的在元素上放 el._dismiss()
   （移除自己、還焦點、拆 listener；可以重複呼叫）。沒有 _dismiss 的直接 remove()（有 _release 順手叫）。
   開著的 APP.ui.confirm 也是浮層（回 false）。route() 每次導覽一開始就呼叫這支。
   toast 不是浮層：「已設為下車點」要跟著跳到下一頁。 */
function dismissOverlays() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.device [data-overlay]').forEach(function (el) {
    try {
      if (typeof el._dismiss === 'function') el._dismiss();
      else {
        el.remove();
        if (typeof el._release === 'function') el._release();
      }
    } catch (e) {
      console.error('dismissOverlays:', e);
      try { el.remove(); } catch (x) { /* ignore */ }
    }
  });
  /* 安全網：沒標 data-overlay、但用 a11yDialog 開著的對話框，當作按了 Esc（每個 onEsc 都只是關掉自己）；
     還是沒關的至少放掉背景的 inert，新的一頁才點得到 */
  dialogs.slice().reverse().forEach(function (d) {
    if (d.dlg.isConnected && d.onEsc) {
      try { d.onEsc(); } catch (e) { console.error('dismissOverlays onEsc:', e); }
    }
    d.release();
  });
}

const TOAST_MS = 3200;       /* 至少 3 秒：讀得完一句話 */
const LIVE_DELAY_MS = 60;    /* live region 先清空、隔一下才放字：同一句話連兩次也會再念 */

/* 報讀器用的 live region：一開始就在（先有 region 再換內容才會被念），整個 app 只有一個。
   畫面上的 toast 設 aria-hidden，不念兩次。 */
function liveRegion() {
  if (typeof document === 'undefined' || !document.body) return null;
  let el = document.getElementById('app-live');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-live';
    el.className = 'app-sr-only';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    document.body.appendChild(el);
  }
  return el;
}
let liveTimer = null;
function announce(text) {
  const el = liveRegion();
  if (!el) return;
  el.textContent = '';
  if (liveTimer) clearTimeout(liveTimer);
  /* 用 setTimeout 不用 rAF：測試的 iframe 在畫面外，rAF 不會跑 */
  liveTimer = setTimeout(function () { liveTimer = null; el.textContent = text; }, LIVE_DELAY_MS);
}

/* ---- UI 零件 ---- */
const ui = {
  toast: function (msg, opt) {
    const text = String(msg == null ? '' : msg);
    if (W.SHELL && SHELL.toast) {
      const r = SHELL.toast(text, Object.assign({ ms: TOAST_MS }, opt || {}));
      const host = $('.device') || document.body;
      const list = host.querySelectorAll('.toast');
      const t = list[list.length - 1];
      if (t) t.setAttribute('aria-hidden', 'true');
      announce(text);
      return r;
    }
    console.info('[toast]', text);
  },
  announce: announce,
  a11yDialog: a11yDialog,
  dismissOverlays: dismissOverlays,
  /* o.danger：做了就回不去的動作（清除、重設、取消行程），預設焦點放在「不要」那顆 */
  confirm: function (o) {
    o = o || {};
    /* 同一時間只有一個確認框：連按「取消行程」「重設」會開第二個，兩個都按「是」動作就做兩次。
       已經有一個開著時，新的這次直接回 false（第一個照常等使用者回答）。 */
    if (document.querySelector('.app-confirm')) return Promise.resolve(false);
    return new Promise(function (resolve) {
      const host = $('.device') || document.body;
      const scrim = document.createElement('div');
      scrim.className = 'scrim app-confirm';
      scrim.setAttribute('data-overlay', '');
      scrim.innerHTML =
        '<div class="modal app-modal" role="dialog" aria-modal="true">' +
          '<p class="modal__text">' + esc(o.text || '確定嗎？') + '</p>' +
          '<div class="app-modal__acts">' +
            '<button class="btn-primary" type="button" data-act="confirm-yes">' + esc(o.yes || '好') + '</button>' +
            '<button class="btn-ghost" type="button" data-act="confirm-no">' + esc(o.no || '先不要') + '</button>' +
          '</div></div>';
      let release = null;
      let settled = false;
      const end = function (v) {
        if (settled) return;
        settled = true;
        scrim.remove();
        if (release) release();
        resolve(v);
      };
      const yesB = scrim.querySelector('[data-act="confirm-yes"]');
      const noB = scrim.querySelector('[data-act="confirm-no"]');
      yesB.onclick = function () { end(true); };
      noB.onclick = function () { end(false); };
      scrim.onclick = function (e) { if (e.target === scrim) end(false); };
      /* 導覽時（APP.ui.dismissOverlays）當作「先不要」 */
      scrim._dismiss = function () { end(false); };
      host.appendChild(scrim);
      release = a11yDialog(scrim.querySelector('.modal'), {
        label: o.text || '確定嗎？',
        onEsc: function () { end(false); },
        focus: o.danger ? noB : yesB,
      });
    });
  },
  /* 預設實作：system.js 會覆寫這兩個 */
  share: function () { ui.toast('分享尚未接上'); },
  push: function () { ui.toast('推播尚未接上'); },
  setStatus: setStatus,
};

/* ---- 地圖 ---- */
/* 景點互相推開（舊城區的地方真實座標只差一兩百公尺，縮圖會疊成一團；東門市場與護城河只差 143 公尺）。
   量每顆 .spot 的版面大小（offsetWidth／Height，不受桌機縮放與轉場的 transform 影響），
   兩兩比：要嘛左右錯開、要嘛上下錯開；不夠就沿著重疊較小的那一軸各推一半，反覆幾輪，每輪夾回地圖框內。
   - .spot 的錨點在底邊中央（translate(-50%, -100%)），選到時從底邊往上放大 grow 倍（app.css .is-selected）：
     左右要留「一顆放大、一顆原尺寸」的寬，上下要留下面那顆放大後的高——任何一顆被選到都不會壓到別顆。
   - 上緣留 top（預設 64：狀態列／頁首／定位鈕那一條），景點原尺寸的框不進去。
   - 推完寫回 style 與 m.spots 的 x/y（百分比）、px/py（地圖座標）；原本的位置留在 px0/py0。寧可離真實位置遠一點，也不要疊。 */
const SPOT_SELECTED_SCALE = 1.4;      /* 跟 app.css 的 .app-map .spot.is-selected scale() 一致 */
const SPOT_GAP_X = 4;
const SPOT_GAP_Y = 8;                 /* 上下多留一點：底下的小尖角（::after）凸出框外約 7px */
const SPOT_EDGE = 4;
const SPOT_TOP = 64;
function declutter(layer, placed, handle, o) {
  o = o || {};
  const W0 = layer.clientWidth, H0 = layer.clientHeight;
  if (!W0 || !H0 || placed.length < 2) return;
  const g = o.grow || 1;
  const top = o.top != null ? o.top : SPOT_TOP;
  const kx = (handle && handle.width ? handle.width : W0) / W0;     /* 版面 px → 地圖 px */
  const ky = (handle && handle.height ? handle.height : H0) / H0;
  const it = [];
  layer.querySelectorAll('.spot[data-i]').forEach(function (el) {
    const s = placed[Number(el.dataset.i)];
    if (!s || !el.offsetWidth) return;
    it.push({ el: el, s: s, w: el.offsetWidth, h: el.offsetHeight,
              x: s.px != null ? s.px / kx : s.x / 100 * W0, y: s.py != null ? s.py / ky : s.y / 100 * H0 });
  });
  if (it.length < 2) return;
  it.forEach(function (a) { a.x0 = a.x; a.y0 = a.y; });
  /* 夾回框內；框太小放不下時以「不掉出下緣／右緣」為先 */
  const clamp = function (a) {
    const hw = g * a.w / 2;
    a.x = Math.min(W0 - hw - SPOT_EDGE, Math.max(hw + SPOT_EDGE, a.x));
    a.y = Math.min(H0 - SPOT_GAP_Y, Math.max(Math.max(g * a.h + SPOT_EDGE, top + a.h), a.y));
  };
  it.forEach(clamp);
  for (let round = 0; round < 80; round++) {
    let moved = false;
    for (let i = 0; i < it.length; i++) for (let j = i + 1; j < it.length; j++) {
      const a = it[i], b = it[j];
      const needX = Math.max(g * a.w + b.w, a.w + g * b.w) / 2 + SPOT_GAP_X;
      const lower = a.y > b.y || (a.y === b.y && i > j) ? a : b;
      const needY = g * lower.h + SPOT_GAP_Y;
      const ox = needX - Math.abs(a.x - b.x);
      const oy = needY - Math.abs(a.y - b.y);
      if (ox <= 0.5 || oy <= 0.5) continue;
      moved = true;
      /* 沿位移較小的那一軸推開；完全同一點時 i 往左（上）、j 往右（下） */
      if (ox <= oy) {
        const sx = a.x < b.x || (a.x === b.x) ? -1 : 1;
        a.x += sx * ox / 2; b.x -= sx * ox / 2;
      } else {
        const sy = a.y < b.y || (a.y === b.y) ? -1 : 1;
        a.y += sy * oy / 2; b.y -= sy * oy / 2;
      }
    }
    it.forEach(clamp);
    if (!moved) break;
  }
  it.forEach(function (a) {
    const s = a.s;
    s.px0 = s.px; s.py0 = s.py;
    if (Math.abs(a.x - a.x0) < 0.5 && Math.abs(a.y - a.y0) < 0.5) return;
    s.x = Math.round(a.x / W0 * 1000) / 10;
    s.y = Math.round(a.y / H0 * 1000) / 10;
    s.px = a.x * kx;
    s.py = a.y * ky;
    a.el.style.left = (a.x / W0 * 100).toFixed(2) + '%';
    a.el.style.top = (a.y / H0 * 100).toFixed(2) + '%';
  });
}

const map = {
  /**
   * 在 container 裡長一張 HSMAP 真實地圖（container 要有尺寸；它若是 static 會被改成 relative）。
   * 回傳 { el, svg, spotsEl, spots, handle, destroy() }。
   */
  mount: function (container, opt) {
    opt = opt || {};
    if (!container) throw new Error('APP.map.mount：少了 container');
    if (!W.HSMAP) throw new Error('APP.map.mount：HSMAP 沒有載入');
    const max = opt.max || 10;
    const wantSpots = opt.spots !== false;
    const list = wantSpots ? (opt.spots || M().SPOTS || []) : [];
    if (list.length > max) {
      throw new Error('APP.map.mount：景點 ' + list.length + ' 個，超過上限 ' + max);
    }

    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    const el = document.createElement('div');
    el.className = 'map app-map';
    el.innerHTML = '<svg class="map__svg"></svg><div class="map__spots" data-panlayer></div>' + (opt.overlay || '');
    container.appendChild(el);
    const svg = el.querySelector('svg');
    const spotsEl = el.querySelector('.map__spots');

    const hopt = {
      style: opt.style || 'paper',
      center: opt.center || 'station',
      spanM: opt.spanM || 1800,
      fog: opt.fog || false,
    };
    ['layers', 'labels', 'avoid', 'rotate', 'dataset', 'width', 'height'].forEach(function (k) {
      if (opt[k] != null) hopt[k] = opt[k];
    });
    const handle = HSMAP.render(svg, hopt);

    let placed = [];
    if (wantSpots && list.length) {
      placed = handle.spotsAt(list, { clamp: opt.clamp !== false })
        .filter(function (s) { return !s.offMap; });
      const hasCb = typeof opt.onSpot === 'function';
      SHELL.renderSpots(spotsEl, {
        spots: placed,
        max: max,
        compact: !!opt.compact,
        href: hasCb ? null : function (s) { return '#/place/' + encodeURIComponent(s.id); },
      });
      spotsEl.querySelectorAll('.spot[data-i]').forEach(function (b) {
        const s = placed[Number(b.dataset.i)];
        if (!s) return;
        b.setAttribute('data-spot', s.id);
        if (s.name && !b.hasAttribute('aria-label')) b.setAttribute('aria-label', s.name);
        if (s.edge) b.classList.add('spot--edge');
        if (hasCb) {
          b.setAttribute('type', 'button');
          b.onclick = function (e) { if (e) e.preventDefault(); opt.onSpot(s, b); };
        }
      });
      /* 選得到的景點（有 onSpot）會被放大成 .is-selected：留出放大後的位置 */
      if (opt.declutter !== false) {
        declutter(spotsEl, placed, handle, { grow: hasCb ? SPOT_SELECTED_SCALE : 1, top: opt.spotsTop });
      }
    }

    if (opt.pan) {
      el.setAttribute('data-pan', '');
      if (W.INTERACT) INTERACT.initPan(el);
    }

    return {
      el: el, svg: svg, spotsEl: spotsEl, spots: placed, handle: handle,
      destroy: function () {
        try { handle.destroy(); } catch (e) { /* ignore */ }
        el.remove();
      },
    };
  },
};

/* ---- 桌機外框／手機滿版 ----
   桌機＝寬 ≥ 560，而且（有滑鼠：hover＋細指標，或畫面夠高 ≥ 700）。只看寬度的話，手機橫放（844×390）
   會被當成桌機：外框縮到四成、tab bar 被切掉。這句跟 app.css 的兩個 @media 是同一個條件，改了三處一起改。
   桌機時 scale = min(1, (innerHeight − .stage 上下 padding) / 844)，寫進 --device-scale；app.css 用 transform 縮、
   用負 margin 把版面佔位也縮掉（置中與 demo 面板才不會錯位）。手機模式不縮。
   html[data-layout="desktop"|"phone"] 給測試與除錯看。 */
const DESKTOP_MQ = '(min-width: 560px) and (hover: hover) and (pointer: fine), (min-width: 560px) and (min-height: 700px)';
const DESKTOP_MIN_W = 560;
function isDesktop() {
  try { if (W.matchMedia) return W.matchMedia(DESKTOP_MQ).matches; } catch (e) { /* ignore */ }
  return (W.innerWidth || 0) >= DESKTOP_MIN_W;
}
function deviceH() {
  const d = $('.device');
  const v = d ? parseFloat(getComputedStyle(d).getPropertyValue('--device-h')) : NaN;
  return v > 0 ? v : 844;
}
/* .stage 上下的 padding（base.css 的 --sp-6 ×2）：當場量，不寫死（寫死 48 時 1280×720 整頁會多捲 16px） */
function stagePadY() {
  const s = $('.stage');
  if (!s) return 64;
  const cs = getComputedStyle(s);
  const v = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  return v > 0 ? v : 0;
}
function fitDevice() {
  const html = document.documentElement;
  const h = W.innerHeight || 0;
  const desk = isDesktop();
  const scale = (desk && h > 0) ? Math.max(0.3, Math.min(1, (h - stagePadY()) / deviceH())) : 1;
  html.setAttribute('data-layout', desk ? 'desktop' : 'phone');
  html.style.setProperty('--device-scale', String(Math.round(scale * 1000) / 1000));
  return scale;
}
let fitTimer = null;
function onResize() {
  if (fitTimer) return;
  fitTimer = setTimeout(function () { fitTimer = null; fitDevice(); }, 100);
}

/* 狀態列時鐘：下一次排在下一個整分，之後每分鐘一次 */
function scheduleClock() {
  tickClock();
  const now = new Date();
  const wait = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
  setTimeout(scheduleClock, Math.max(250, wait + 20));
}

/* ---- 啟動 ---- */
function start() {
  if (started) return;
  started = true;
  const html = document.documentElement;
  const q = new URLSearchParams(location.search);
  if (q.has('still')) html.setAttribute('data-still', '');

  W.addEventListener('error', function (e) { reportError(e.error || e.message, 'window.onerror'); });
  W.addEventListener('unhandledrejection', function (e) { reportError(e.reason, 'unhandledrejection'); });

  /* 返回鍵：<a href="#" data-back="/explore"> */
  document.addEventListener('click', function (e) {
    const a = e.target.closest && e.target.closest('a[data-back]');
    if (!a) return;
    e.preventDefault();
    nav.back(a.getAttribute('data-back') || '/ride');
  });

  W.addEventListener('popstate', onPopState);
  W.addEventListener('hashchange', onHashChange);
  liveRegion();

  /* 桌機狀態列顯示真實時間 */
  scheduleClock();
  fitDevice();
  W.addEventListener('resize', onResize);

  const st = history.state;
  if (st && typeof st.i === 'number') curIdx = st.i;
  else { curIdx = 0; stamp(0); }
  route('none');

  /* PWA：只在 http(s) 註冊；file:// 安靜略過（策略見 sw.js 檔頭）。
     新的 sw 接手（controllerchange）而且之前已經有一個在管這一頁 → 有新版本了，提示重新整理；
     第一次安裝時 controller 從無到有，不提示。回到前景時順便問一次有沒有新版（裝成 app 的人很少冷啟動）。 */
  if (/^https?:$/.test(location.protocol) && 'serviceWorker' in navigator) {
    const swc = navigator.serviceWorker;
    let hadController = !!swc.controller;
    let told = false;
    swc.addEventListener('controllerchange', function () {
      if (hadController && !told) { told = true; ui.toast('有新版本，重新整理就會套用'); }
      hadController = true;
    });
    swc.register('./sw.js').then(function (reg) {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible' && reg && reg.update) reg.update().catch(function () {});
      });
    }).catch(function (err) {
      console.info('[sw] 未註冊：', err && err.message);
    });
  }
}

W.APP = {
  version: 1,
  view: view,
  views: views,
  routes: function () { return routes.map(function (r) { return { pattern: r.pattern, name: r.name }; }); },
  PLANNED: PLANNED.map(function (r) { return { pattern: r.pattern, tab: r.tab }; }),
  resolve: function (path) { const r = resolve(parse(path).path); return { name: r.name, pattern: r.pattern, params: r.params }; },
  parse: parse,
  nav: nav,
  store: store,
  on: on,
  emit: emit,
  fmt: fmt,
  esc: esc,
  place: place,
  places: places,
  ui: ui,
  map: map,
  start: start,
  /* 動畫要不要省掉：?still=1（html[data-still]）或系統的「減少動態效果」。views 一律問這個 */
  reduceMotion: isStill,
  fitDevice: fitDevice,
};

if (typeof document !== 'undefined' && document.addEventListener) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else setTimeout(start, 0);
}
})();
