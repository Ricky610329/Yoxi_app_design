/* yoxi 城事 web app 的版本：唯一來源。
   index.html 用 <script> 載（設定頁「關於」顯示的版本，system.js 讀 window.APP_VERSION），
   sw.js 用 importScripts 載（快取的名字跟著它換代）。
   ★ 新增檔案、或 PRECACHE 清單變了：這裡的數字加一。瀏覽器更新 service worker 時也會比對 importScripts 進來的檔，
     所以只改這一支也會觸發更新。檢查：python app/tools/check-sw.py */
self.APP_VERSION = 'chengshi-app-v24';
