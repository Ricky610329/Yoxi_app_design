/* ==========================================================================
   yoxi 城事 app — service worker
   策略：同源 GET cache-first（只從 PRECACHE 命中；清單外走網路、不寫入快取）。
   不對外網發任何請求：跨源請求直接放行給瀏覽器（sw 不代抓、不快取）。

   ★ 新增檔案要來這裡加：app/css、app/js、prototype/assets/map、
     prototype/assets/photos 底下多了檔案，或 index.html 多載了 prototype 的檔，
     就把路徑加進下面的 PRECACHE，並把 VERSION 的數字加一（舊快取才會被清掉）。
     檢查：python app/tools/check-sw.py（清單有、檔案沒有／檔案有、清單沒有 → exit 1）
   注意：cache.addAll 是全有全無，清單裡任何一個 404 整個 install 就失敗。

   註冊（index.html 或 app.js；file:// 下完全略過）：
     if (/^https?:$/.test(location.protocol) && 'serviceWorker' in navigator) {
       navigator.serviceWorker.register('./sw.js')
         .catch(err => console.info('[sw] 未註冊：', err && err.message));
     }
   ========================================================================== */

const VERSION = 'chengshi-app-v8';

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
  './css/views/album.css',
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
  './js/app.js',
  './js/views/system.js',
  './js/views/ride.js',
  './js/views/explore.js',
  './js/views/album.js',
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
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('chengshi-app-') && k !== VERSION)
            .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // 跨源：不碰

  const isNav = req.mode === 'navigate';
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: isNav });
    if (hit) return hit;
    try {
      return await fetch(req);                // 清單外的檔（例如 tests/）不寫進快取
    } catch (err) {
      if (isNav) {
        const shell = await cache.match('./index.html');
        if (shell) return shell;              // hash 路由：一律回單一入口
      }
      return Response.error();
    }
  })());
});
