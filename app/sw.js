/* ==========================================================================
   yoxi 城事 app — service worker

   快取策略（只管同源 GET；跨源請求直接放行給瀏覽器，sw 不代抓、不快取、不對外網發任何請求）：
   1. 導覽（開 app、重新整理、iframe）：network-first。
      連得上就拿網路上最新的 index.html（順手更新快取裡那份），
      NAV_TIMEOUT_MS 內沒回應或離線才退回快取；hash 路由，快取找不到就一律回 index.html。
      → 改了 index.html 不必等使用者開兩次，也不會因為忘了加 VERSION 就永遠卡在舊版。
   2. 圖片（app/assets/postcards/*、prototype/assets/photos/* 的 jpg／png／webp）：cache-first。
      先找預先快取，再找執行期快取（RUNTIME）；都沒有才上網抓，抓成功就存進 RUNTIME。
      生成的明信片（55 張、約 3 MB）不進預先快取，看過一次之後離線也有卡面；沒看過的離線時退回插畫。
   3. 其他靜態檔（PRECACHE 清單裡的 css／js／圖示…）：stale-while-revalidate。
      先回快取（快、離線可用），同時在背景抓一份新的蓋回快取，下次開就是新的。
      清單外的檔（例如 tests/）只走網路、不寫入快取。
   更新：js/version.js 的 VERSION 加一 → 瀏覽器發現 sw.js（連同 importScripts 的 version.js）變了 → install 重新預先快取（cache:'reload' 繞過 HTTP 快取）
         → skipWaiting → activate 刪掉舊版本的兩個快取（PRECACHE 與 RUNTIME 都跟著 VERSION）→ clients.claim。
         頁面（app.js 的註冊段）看到新的 sw 接手，會跳「有新版本，重新整理就會套用」。
         忘了加 VERSION 也會更新（1＋3），只是晚一次開啟，而且不會跳提示。

   ★ 新增檔案要來這裡加：app/css、app/js、prototype/assets/map、
     prototype/assets/photos 底下多了檔案，或 index.html 多載了 prototype 的檔，
     就把路徑加進下面的 PRECACHE，並把 js/version.js 的數字加一（設定頁顯示的版本也讀它，只有這一處）。
     檢查：python app/tools/check-sw.py（清單有、檔案沒有／檔案有、清單沒有／index.html 載的檔不在清單 → exit 1）
   注意：cache.addAll 是全有全無，清單裡任何一個 404 整個 install 就失敗。

   註冊在 js/app.js 的 start() 最後（file:// 下完全略過）：
     if (/^https?:$/.test(location.protocol) && 'serviceWorker' in navigator) {
       navigator.serviceWorker.register('./sw.js') …
       controllerchange 而且之前已經有 controller → APP.ui.toast('有新版本，重新整理就會套用')
     }
   ========================================================================== */

importScripts('./js/version.js');
const VERSION = self.APP_VERSION;          /* 唯一來源：js/version.js（設定頁顯示的也是它） */
const RUNTIME = VERSION + '-img';          /* 執行期的圖片快取；跟著 VERSION 換代，activate 一起清 */
const NAV_TIMEOUT_MS = 3000;               /* 導覽等網路最多這麼久，超過就先給快取（網路回來仍會更新快取） */

/* cache-first 的圖片目錄（相對 sw.js）與副檔名 */
const IMAGE_DIRS = ['./assets/postcards/', '../prototype/assets/photos/']
  .map((p) => new URL(p, self.location).href);
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

// 路徑相對於 sw.js（app/）。順序照 ARCHITECTURE §2 的載入順序。
const PRECACHE = [
  /* PRECACHE:BEGIN — check-sw.py 讀這一段 */
  // 入口
  './',
  './index.html',
  './manifest.webmanifest',
  // prototype css
  '../prototype/css/tokens.css',
  '../prototype/css/base.css',
  '../prototype/css/components.css',
  '../prototype/css/chengshi.css',
  // app css
  './css/app.css',
  './css/views/system.css',
  './css/views/ride.css',
  './css/views/explore.css',
  './css/views/explore-fest.css',
  './css/views/album.css',
  './css/views/album-rewards.css',
  './css/views/album-family.css',
  // prototype js
  '../prototype/js/icons.js',
  '../prototype/js/mock.js',
  '../prototype/js/state.js',
  '../prototype/js/shell.js',
  '../prototype/js/interact.js',
  '../prototype/assets/map/hs-core.js',
  '../prototype/assets/map/hs-wide.js',
  '../prototype/assets/map/hs-places.js',
  '../prototype/js/hsmap.js',
  '../prototype/assets/photos/credits.js',
  '../prototype/js/photos.js',
  // app js
  './js/version.js',
  './js/app.js',
  './js/views/system.js',
  './js/views/ride.js',
  './js/views/explore-fx.js',
  './js/views/explore-fest.js',
  './js/views/explore-cards.js',
  './js/views/explore-face.js',
  './js/views/explore-gold.js',
  './js/views/explore.js',
  './js/views/explore-unlock.js',
  './js/views/album.js',
  './js/views/album-rewards.js',
  './js/views/album-family.js',
  // 照片
  '../prototype/assets/photos/brick-1.jpg',
  '../prototype/assets/photos/harbour-1.jpg',
  '../prototype/assets/photos/hill-1.jpg',
  '../prototype/assets/photos/lake-1.jpg',
  '../prototype/assets/photos/market-1.jpg',
  '../prototype/assets/photos/moat-1.jpg',
  '../prototype/assets/photos/neiwan-1.jpg',
  '../prototype/assets/photos/rail-1.jpg',
  '../prototype/assets/photos/station-1.jpg',
  '../prototype/assets/photos/temple-1.jpg',
  '../prototype/assets/photos/glass-kiln-1.jpg',
  '../prototype/assets/photos/p10-1.jpg',
  '../prototype/assets/photos/p12-1.jpg',
  '../prototype/assets/photos/p13-1.jpg',
  '../prototype/assets/photos/p14-1.jpg',
  '../prototype/assets/photos/p15-1.jpg',
  '../prototype/assets/photos/p16-1.jpg',
  '../prototype/assets/photos/p17-1.jpg',
  '../prototype/assets/photos/p18-1.jpg',
  '../prototype/assets/photos/p19-1.jpg',
  '../prototype/assets/photos/p21-1.jpg',
  '../prototype/assets/photos/p22-1.jpg',
  // 圖示
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon.svg',
  // 設計稿內連結的互動截圖
  './assets/shots/ride-float.png',
  './assets/shots/ride-float-back.png',
  /* PRECACHE:END */
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(PRECACHE.map((p) => new Request(p, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const keep = [VERSION, RUNTIME];
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('chengshi-app-') && keep.indexOf(k) < 0)
            .map((k) => caches.delete(k))))
      .then(() => caches.open(RUNTIME))              /* 執行期快取只在這裡建（見 openExisting） */
      .then(() => self.clients.claim())
  );
});

/* fetch 裡只開「已經存在」的快取，不建新的：舊版 sw 被取代的那一刻手上還有請求在跑，
   caches.open 會把新版 activate 剛刪掉的舊快取又建回來（實測會留下整包舊的 -img）。
   快取不在＝這個 sw 已經過時：只走網路。 */
async function openExisting(name) {
  return (await caches.has(name)) ? caches.open(name) : null;
}

/* 可以存的回應：同源、200（206 分段、錯誤頁、跳轉都不存） */
function storable(res) {
  return !!res && res.status === 200 && res.type === 'basic';
}

function isImage(url) {
  return IMAGE_EXT.test(url.pathname) && IMAGE_DIRS.some((d) => url.href.startsWith(d));
}

/* 1. 導覽：network-first，逾時或離線退回快取 */
async function navigate(event, req, url) {
  const cache = await openExisting(VERSION);
  if (!cache) return fetch(req);
  const key = url.origin + url.pathname;             /* ?still=1 之類的 query 不影響是哪一頁 */
  const net = fetch(req).then(async (res) => {
    /* 只更新本來就預先快取的入口（./、./index.html）；tests/runner.html 之類的不寫進快取 */
    if (storable(res) && await cache.match(key)) await cache.put(key, res.clone());
    return res;
  });
  event.waitUntil(net.then(() => {}, () => {}));
  const fallback = async () => (await cache.match(key)) || (await cache.match('./index.html'));
  let timer;
  const late = new Promise((resolve) => { timer = setTimeout(() => resolve('late'), NAV_TIMEOUT_MS); });
  try {
    const first = await Promise.race([net, late]);
    if (first !== 'late') return first;
    const hit = await fallback();                     /* 網路太慢：有快取先給快取 */
    return hit || await net;
  } catch (err) {
    return (await fallback()) || Response.error();   /* 離線 */
  } finally {
    clearTimeout(timer);
  }
}

/* 2. 圖片：cache-first，第一次抓成功就存進 RUNTIME */
async function image(event, req) {
  const pre = await openExisting(VERSION);
  const rt = await openExisting(RUNTIME);
  const hit = (pre && await pre.match(req)) || (rt && await rt.match(req));
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (rt && storable(res)) {
      const copy = res.clone();
      event.waitUntil(rt.put(req, copy).catch(() => {}));
    }
    return res;
  } catch (err) {
    return Response.error();                          /* 離線又沒看過：<img> onerror，卡面退回插畫 */
  }
}

/* 3. 預先快取的靜態檔：stale-while-revalidate；清單外只走網路 */
async function staleWhileRevalidate(event, req) {
  const cache = await openExisting(VERSION);
  const hit = cache && await cache.match(req);
  if (!hit) return fetch(req);
  event.waitUntil(
    fetch(req).then((res) => { if (storable(res)) return cache.put(req, res); }).catch(() => {})
  );
  return hit;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // 跨源：不碰

  if (req.mode === 'navigate') event.respondWith(navigate(event, req, url));
  else if (isImage(url)) event.respondWith(image(event, req));
  else event.respondWith(staleWhileRevalidate(event, req));
});
