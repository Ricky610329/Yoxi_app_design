/* ==========================================================================
   yoxi 城事 web app — 核心（window.APP）
   契約：app/ARCHITECTURE.md §3、§4、§9。改 API 先改那份文件。

   提供：view registry、hash router、nav（go/back/tab/current）、轉場、
         store（localStorage yoxi-chengshi-app-v1）、事件 on/emit、fmt（全部公式）、
         esc、place()/places()、ui（toast/confirm/setStatus；share/push 由 system.js 覆寫）、
         map.mount()（HSMAP ＋ SHELL.renderSpots）。

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
const TABS = ['ride', 'explore', 'album'];

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
function fresh() {
  return {
    onboarded: false,
    dropoff: null,        /* { id, name, km, setAt, via:'k1'|'e'|'search'|'route' } */
    trip: null,           /* { placeId, phase:'matching'|'riding'|'done', startedAt, rated, km } */
    pushes: [],           /* [{ when:'am'|'pm', at:ISO }] */
    arrivedDemo: null,    /* placeId */
    rideSpots: true,      /* 叫車地圖上要不要疊城事的景點（設定頁可關） */
    rideVia: {},          /* 明信片 id → 這趟車是從哪裡叫的（k1／e／route／search），行程紀錄的轉換歸因 */
    tabPaths: { ride: '/ride', explore: '/explore', album: '/album' },
  };
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
    if (!got || typeof got !== 'object') return base;
    /* 跟預設合併：舊版存的結構少了鍵也不會讓畫面讀到 undefined */
    const s = Object.assign(base, got);
    /* tabPaths 只收「/ 開頭的字串」：舊版或手改過的值（null、數字、整串字串）不能讓 nav.tab 導到怪地方 */
    s.tabPaths = fresh().tabPaths;
    const tp = got.tabPaths && typeof got.tabPaths === 'object' ? got.tabPaths : {};
    TABS.forEach(function (k) {
      if (typeof tp[k] === 'string' && tp[k][0] === '/') s.tabPaths[k] = tp[k];
    });
    if (!Array.isArray(s.pushes)) s.pushes = [];
    if (!s.rideVia || typeof s.rideVia !== 'object' || Array.isArray(s.rideVia)) s.rideVia = {};
    if (typeof s.rideSpots !== 'boolean') s.rideSpots = true;
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
    return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1) + ' km';
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

function place(id) {
  const m = M();
  if (!id || !m.findPlace || !knownId(id)) return null;
  const f = m.findPlace(id);
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
  const m = M();
  const seen = {};
  const out = [];
  [].concat(m.SPOTS || [], m.PENDING || [], m.TODAY ? [m.TODAY] : [], m.FAR_PLACE ? [m.FAR_PLACE] : [])
    .forEach(function (p) {
      if (!p || seen[p.id]) return;
      seen[p.id] = 1;
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
    try {
      if (opt.replace) {
        history.replaceState({ yoxiApp: 1, i: curIdx }, '', url);
        if (!opt.dir) dir = 'none';
      } else {
        curIdx += 1;
        history.pushState({ yoxiApp: 1, i: curIdx }, '', url);
      }
    } catch (e) {
      /* 萬一 pushState 被擋（某些 file:// 環境）：退回改 hash，讓 hashchange 接手 */
      pendingDir = dir;
      if (opt.replace) location.replace(url); else location.hash = url;
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
    if (TABS.indexOf(id) < 0) return;
    const here = cur && cur.tab;
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
    if (cur.tab && TABS.indexOf(cur.tab) >= 0) {
      S.tabPaths = Object.assign({}, S.tabPaths, { [cur.tab]: full });
      save();
    }
  },
};

/* ---- 路由主流程 ---- */
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

function route(dir) {
  finishNow();
  clearBackPending();
  const p = parse(location.hash);

  /* '/'：第一次開先 onboarding（system 有註冊才去），其餘去叫車 */
  if (p.path === '/') {
    const toWelcome = !S.onboarded && routes.some(function (r) { return r.pattern === '/welcome'; });
    nav.go(toWelcome ? '/welcome' : '/ride', { replace: true, dir: 'none' });
    return;
  }

  const r = resolve(p.path);
  const def = r.def;
  const prev = cur;
  const tab = def.tab === undefined ? null : def.tab;
  cur = { path: p.path, qs: p.qs, query: p.query, pattern: r.pattern, params: r.params,
          name: r.name, tab: tab, def: def };

  /* 跨 tab 的根畫面用淡入，不用滑動 */
  if (dir === 'push' && prev && def.root && prev.tab && tab && prev.tab !== tab) dir = 'tab';
  if (!prev) dir = 'none';

  /* 1. 舊 view 收尾 */
  if (cleanup) { try { cleanup(); } catch (e) { console.error('view cleanup:', e); } cleanup = null; }
  document.documentElement.removeAttribute('data-view-ready');

  /* 2. 記住各 tab 最後停的 path（安靜地寫，不 emit） */
  if (tab && TABS.indexOf(tab) >= 0) {
    S.tabPaths = Object.assign({}, S.tabPaths, { [tab]: fullPath(p) });
    save();
  }

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

/* 今天的地方的明信片還沒收 → 探索 tab 上一個小圓點（不是數字） */
function todayPending() {
  const m = M();
  if (!m.TODAY || !W.STATE) return false;
  const c = m.cardIdOf ? m.cardIdOf(m.TODAY.id) : m.TODAY.id;
  return !STATE.has(c);
}

function renderTabbar() {
  const nb = $('#tabbar');
  if (!nb) return;
  const screen = $('.device__screen');
  const active = cur && cur.tab;
  if (!active) {
    nb.hidden = true;
    if (screen) screen.classList.remove('has-tabbar');
    return;
  }
  nb.hidden = false;
  if (screen) screen.classList.add('has-tabbar');
  const dot = todayPending();
  nb.innerHTML = TABDEF.map(function (t) {
    return '<a class="tabbar__item' + (t.id === active ? ' is-active' : '') + '" href="#/' + t.id +
      '" data-tab-id="' + t.id + '"' + (t.id === active ? ' aria-current="page"' : '') + '>' +
      '<span class="tabbar__icon">' +
        '<span data-icon="' + t.icon + '" style="display:block;width:26px;height:26px"></span>' +
        (t.dot && dot && t.id !== active ? '<i class="tabbar__dot"></i>' : '') +
      '</span><span>' + t.label + '</span></a>';
  }).join('');
  nb.querySelectorAll('[data-tab-id]').forEach(function (a) {
    a.onclick = function (e) { if (e) e.preventDefault(); nav.tab(a.getAttribute('data-tab-id')); };
  });
  if (W.SHELL) SHELL.injectIcons(nb);
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

/* ---- 對話框可及性：焦點移進去、Esc 關、關掉之後焦點回原處 ----
   a11yDialog(dialogEl, { label, onEsc, focus }) → release()。release 可以重複呼叫。 */
function a11yDialog(dlg, opt) {
  opt = opt || {};
  const before = document.activeElement;
  dlg.setAttribute('role', 'dialog');
  dlg.setAttribute('aria-modal', 'true');
  if (opt.label) dlg.setAttribute('aria-label', opt.label);
  const onKey = function (e) {
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      if (opt.onEsc) opt.onEsc();
    }
  };
  document.addEventListener('keydown', onKey);
  const first = opt.focus || dlg.querySelector('button, a[href], input, [tabindex]');
  if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
  let released = false;
  return function release() {
    if (released) return;
    released = true;
    document.removeEventListener('keydown', onKey);
    if (before && before !== document.body && before.isConnected && typeof before.focus === 'function') {
      try { before.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
  };
}

const TOAST_MS = 3200;       /* 至少 3 秒：讀得完一句話 */

/* ---- UI 零件 ---- */
const ui = {
  toast: function (msg, opt) {
    if (W.SHELL && SHELL.toast) {
      const r = SHELL.toast(msg, Object.assign({ ms: TOAST_MS }, opt || {}));
      /* 報讀器要念得到：補 role=status／aria-live，文字在屬性之後再放進去（先有 live region 再有內容才會被念） */
      const host = $('.device') || document.body;
      const list = host.querySelectorAll('.toast');
      const t = list[list.length - 1];
      if (t) {
        t.setAttribute('role', 'status');
        t.setAttribute('aria-live', 'polite');
        t.textContent = '';
        t.textContent = String(msg == null ? '' : msg);
      }
      return r;
    }
    console.info('[toast]', msg);
  },
  a11yDialog: a11yDialog,
  confirm: function (o) {
    o = o || {};
    /* 同一時間只有一個確認框：連按「取消行程」「重設」會開第二個，兩個都按「是」動作就做兩次。
       已經有一個開著時，新的這次直接回 false（第一個照常等使用者回答）。 */
    if (document.querySelector('.app-confirm')) return Promise.resolve(false);
    return new Promise(function (resolve) {
      const host = $('.device') || document.body;
      const scrim = document.createElement('div');
      scrim.className = 'scrim app-confirm';
      scrim.innerHTML =
        '<div class="modal app-modal" role="dialog" aria-modal="true">' +
          '<p class="modal__text">' + esc(o.text || '確定嗎？') + '</p>' +
          '<div class="app-modal__acts">' +
            '<button class="btn-primary" type="button" data-act="confirm-yes">' + esc(o.yes || '好') + '</button>' +
            '<button class="btn-ghost" type="button" data-act="confirm-no">' + esc(o.no || '先不要') + '</button>' +
          '</div></div>';
      let release = null;
      const end = function (v) { scrim.remove(); if (release) release(); resolve(v); };
      scrim.querySelector('[data-act="confirm-yes"]').onclick = function () { end(true); };
      scrim.querySelector('[data-act="confirm-no"]').onclick = function () { end(false); };
      scrim.onclick = function (e) { if (e.target === scrim) end(false); };
      host.appendChild(scrim);
      release = a11yDialog(scrim.querySelector('.modal'), { label: o.text || '確定嗎？', onEsc: function () { end(false); } });
    });
  },
  /* 預設實作：system.js 會覆寫這兩個 */
  share: function () { ui.toast('分享尚未接上'); },
  push: function () { ui.toast('推播尚未接上'); },
  setStatus: setStatus,
};

/* ---- 地圖 ---- */
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

/* ---- 桌機外框縮放：.device 固定 844 高，1280×720／1366×768 的螢幕會把 tab bar 擠到畫面外 ----
   桌機（≥ 560 寬）時 scale = min(1, (innerHeight − 48) / 844)，寫進 --device-scale；app.css 用 transform 縮、
   用負 margin 把版面佔位也縮掉（置中與 demo 面板才不會錯位）。手機模式不縮。 */
const DESKTOP_MIN_W = 560;
const STAGE_PAD_Y = 48;
function deviceH() {
  const d = $('.device');
  const v = d ? parseFloat(getComputedStyle(d).getPropertyValue('--device-h')) : NaN;
  return v > 0 ? v : 844;
}
function fitDevice() {
  const html = document.documentElement;
  const w = W.innerWidth || 0, h = W.innerHeight || 0;
  const scale = (w >= DESKTOP_MIN_W && h > 0) ? Math.max(0.3, Math.min(1, (h - STAGE_PAD_Y) / deviceH())) : 1;
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

  on('state:change', renderTabbar);
  on('store:change', renderTabbar);
  W.addEventListener('popstate', clearBackPending);
  W.addEventListener('hashchange', onHashChange);

  /* 桌機狀態列顯示真實時間 */
  scheduleClock();
  fitDevice();
  W.addEventListener('resize', onResize);

  const st = history.state;
  if (st && typeof st.i === 'number') curIdx = st.i;
  else { curIdx = 0; stamp(0); }
  route('none');

  /* PWA：只在 http(s) 註冊；file:// 安靜略過 */
  if (/^https?:$/.test(location.protocol) && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(function (err) {
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
