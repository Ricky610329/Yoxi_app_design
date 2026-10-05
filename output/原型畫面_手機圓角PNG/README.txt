解決方案設計｜原型畫面：五張 app 截圖

擷取日期：2026-10-05
來源：本專案目前 app/ 原始碼，APP_VERSION chengshi-app-v30
重拍指令：node app/tools/capture-slide.mjs
第 2、3 張已同步為搭 yoxi 的乘車中與抵達收卡狀態。

01_探索.png      /ride?mode=explore&area=glass-kiln
02_前往.png      /trip（搭 yoxi 前往水利路老玻璃窯）
03_抵達收卡.png  /unlock/glass-kiln?ride=1（搭 yoxi 抵達，金框）
04_收藏.png      /album
05_回憶卡.png    /lookback

規格：1170 × 2532 px，PNG RGBA；手機 viewport 390 × 844，原生 3 倍渲染。
外框圓角：44 CSS px（輸出 132 px），沿用 prototype/css/base.css 的手機外框半徑。
四角為真正透明，無白色底板、無額外邊框；可直接放上投影片並等比例縮放。
圓角由瀏覽器裁切，只改截圖 fixture 的外緣；畫面內容來自現行 app。

五張使用 app 原有示範資料，逐張重設狀態；不是同一次連續操作的狀態累積。
第 2 張由行程 API 建立搭車狀態；第 3 張由同一 API 建立搭車抵達，再以 still=1 顯示收卡結果。
收藏頁使用原始示範的 8 張明信片。
回憶卡使用青草湖模板，現行選項為「晴光／柔光／暮色」。
參考投影片第 5 張的「即時心情」文字，可依目前介面調整為光線選擇。

已確認：五張圖解析度一致、四角 alpha=0、畫面無 JavaScript 錯誤及破圖。
PDF 與投影片未修改。
