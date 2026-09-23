# AGENTS.md — 給接手的 AI agent（Codex／Claude／其他）

這個 repo 是「yoxi 城事」的 HTML 設計原型：一個提給 yoxi（和泰叫車）的提案，把叫車 app 變成不搭車也會打開的城市探索與收藏工具。
**沒有 build、沒有框架、沒有套件管理**：全部是 `file://` 直接開的 HTML＋傳統 `<script>`，工具是 Python 3（Pillow）＋ headless Chrome。
人看的入口是 `README.md`；接手前先讀 `docs/HANDOFF.md`（架構、慣例、坑）與 `docs/WORKLOG.md`（做過什麼）。

## 開始工作前一定要做的事

1. 讀 `prototype/js/catalog.js` 的檔頭與 `VARIANTS／AXES／ROADMAP` 區塊：它是畫面、流程、變體、願景稿、概念稿的**單一登記表**，所有總覽頁都從它渲染。
2. 跑一次驗收，記下基準：`python prototype/tools/verify-quiet.py`（約 4 分鐘）。收工前再跑一次，**八段必須全 PASS，而且六條承諾的數字必須與基準相同**。
3. 不在 `main` 上直接動工：開分支，做到一個可驗證的段落就 commit，訊息寫「做了什麼、為什麼」（中文可）。不要 push，除非使用者明說。

## 不可以做的事

- **不動叫車主畫面的收合態**：`screens/home.html` 的 sheet 收合態是六條承諾的基準；新內容一律加 `data-expand-only`。改了 `home.html`、`css/tokens.css`、`css/components.css`、`js/shell.js` 的共用邏輯，六條承諾的數字會變，變了就要能解釋。
- **不寫禁用詞**：任務／完成／達成／挑戰／每日（`tools/audit-app.html` 會掃算繪後的文字）。沒有連續天數、倒數、限量、排名、未讀數字。獎章寫「收集 4/8」。
- **顏色紀律**：紅色只給品牌情緒（頁首、抽屜、地圖 pin、強調數字、logo）；海軍藍給可按的東西。圓角只有 `tokens.css` 的六種。
- **數字不手寫**：畫面上的統計、車資、時間、覆蓋率一律從 `STATE／MOCK` 或公式算；曾經寫死的數字後來都變成簡報引錯的來源。
- **不加 CDN、不加 webfont、不連網**（唯一例外是 `screens/concept-map-tiles.html`，而且 `?still=1` 時不得發任何請求）。

## 慣例（做畫面／變體時）

- 新畫面放 `prototype/screens/`，檔頭用中文註解寫「回答什麼／動了什麼／刻意沒有的東西」。載入順序：`css/tokens → base → components → chengshi`；`js/icons → mock → state → shell → interact`。
- 加變體的順序：`js/shell.js` 的 `TABSETS／ROOTS`（只有會換整組 tab 的變體才要；沒改的根填 identity）→ `js/catalog.js` 的 `VARIANTS` 加一筆（`state:'planned'`）→ `tools/shoot.py` 的 `SHOTS` 與 `tools/audit-app.html` 的清單加 stem → 建檔 → `python prototype/tools/shoot.py --only <stem> --mini` → 驗收全綠 → `state:'built'`。
- 概念稿／探索稿類的畫面：`<body data-vision="…">`＋`<span class="vision-mark">`，稽核會跳過死按鈕與禁用詞，但 `audit-tree` 仍要求登記與縮圖對得上；專用樣式放 `css/concept.css`。
- 地圖一律用 `js/hsmap.js`（`HSMAP.render(svg, {style, center, spanM, fog})`），不要再手畫 SVG 路網；資料在 `assets/map/`（OpenStreetMap，ODbL，每張圖右下角要有署名）。
- 按鈕要有行為才不算死按鈕：`data-toast`／`data-switch`／`data-pills`／`data-cap`／`data-recenter`／inline `onclick`。**用 `element.onclick` 而不是 `addEventListener`**（稽核的攔截器裝在頁面腳本之後，看不到早綁的 listener）。
- 返回鍵用 `data-back`；`shell.js` 的 `rewriteHref` 會帶 `?from=`，`../` 開頭的路徑會保留。
- 縮圖：`python prototype/tools/shoot.py`（全部）／`--only a,b`／`--mini`／`--board`。要拍固定狀態就在 URL 帶參數並在 `THUMB_ALIAS` 登記別名。

## `pitch/`（初賽交件）的規矩

- **真相在 `pitch/BRIEF.md`**（立場、數字紀律、檔案歸屬）與 `pitch/docs/competition.md`（官方原文）；改立場先改 BRIEF。
- **簡報是 HTML**：`pitch/deck/index.html`，`python pitch/deck/build-pdf.py` 印 PDF 並檢查摘要 1 頁／正文 ≤ 15／頁數對得上／≤ 15 MB／無溢出／無禁用詞；官方欄位名與題目原文放 `.official` 才不被禁用詞掃到。
- **影片**：`pitch/video/shots.json` 是鏡頭表真相，`build-video.py` 會檢查每句旁白 ≤ 25 字、中文數字等於 app 公式、總長 ≤ 180 秒。
- **數字**：簡報每個數字要能回溯到 `pitch/docs/*.md`；外部數字附 URL 與查詢日期，沒有就標「假設」。內容量假設以 `business.md` 為準、雲端成本以 `ai-architecture.md` 為準。
- **不動 `prototype/`、`app/`**；yoxi 寄來的解題資料不進 repo。

## `app/`（web app）的規矩

- **契約在 `app/ARCHITECTURE.md`**：API、DOM、測試、分工、路由總表都在那裡；改契約先改那份。人看的在 `app/README.md`。
- **改 app 不動 `prototype/`**：app 只從 `../prototype` 讀共用檔；需要的新邏輯寫在 `app/`。
- **四個區塊各自一支檔**：`js/views/{ride,explore,album,system}.js`＋同名的 `css/views/X.css`＋`tests/specs/X.spec.js`；跨區塊的動作走 `APP.ride.setDropoff`、`APP.explore.collect`、`APP.ui.push`、`APP.ui.share`，不改 `js/app.js`。
- **按鈕用 `element.onclick`＋`data-act="動詞-名詞"`**：測試靠 `data-act` 點；返回鍵是 `<a href="#" data-back="/x">`。
- **新 CSS 不寫 hex**：顏色、字級、圓角、動畫時間全用 `tokens.css` 的變數（測試會掃）。數字一律走 `APP.fmt`／`STATE`／`MOCK`。
- **每條 route 要有 spec**：render、死按鈕、禁用詞、可按數（一般 ≤ 10，`/explore`、`/album` ≤ 12）、數字對公式、返回鍵。
- **收工前**：`python app/tests/run.py` 全綠，而且 `python prototype/tools/verify-quiet.py` 八段 PASS、六條承諾數字與基準相同。
- **新增檔案**：加進 `app/sw.js` 的 `PRECACHE`、`VERSION` 加一，跑 `python app/tools/check-sw.py`（清單與檔案對不上就 exit 1；`cache.addAll` 全有全無，一個 404 整個安裝失敗）。

## `site/`（介紹網站）的規矩

- **契約在 `site/CONTRACT.md`**：檔案歸屬、`window.SITE`（捲動框架）與 `window.SITE_DATA`（公式、地點、連結）的 API、`data-reveal／data-progress／data-scrolly／data-fmt` 的 HTML 約定。
- **只讀共用檔不改**：`../prototype`（tokens、icons、hsmap、地圖資料、照片授權）、`../app/assets/shots/`、`../pitch/video/out/`。
- **新 CSS 不寫 hex**、圓角只用 `--r-*`、字級用 `site.css` 的 `--site-*`；畫面上的車資／分鐘／點數一律 `data-fmt` 或 `SITE_DATA.fmt`。
- 禁用詞與誠實標示同上（明信片「AI 生成示意」、地圖署名、照片授權）。
- 驗收：`python site/tools/shoot-site.py`（每段一張＋整頁，會印 JS 例外）；加段落要同時加 `data-section`、導覽列連結與 `shoot-site.py` 的 `SECTIONS`。

## 常見坑（都踩過）

- Windows 顯示縮放會讓 Chrome 用 1.25 倍出圖：shoot.py 已鎖 `--force-device-scale-factor=1`，自己寫截圖腳本也要帶。
- `overflow:hidden` 會把 `preserve-3d` 壓平：翻面的明信片改成 `overflow:visible`，兩個面各自裁圓角。
- Overpass API 連續請求會 429，`fetch-map.py` 有 mirror 與快取（`tools/.cache/`，不進版控）；Wikimedia Commons API 連發三次就 429，`fetch-photos.py` 有 sleep 與退避。
- bash heredoc 裡放含引號的 Python 一行指令很容易炸：長腳本寫成檔案再跑。
- git 會警告 LF→CRLF，忽略即可；不要改 `.gitattributes`。

## 交給下一位的待辦（優先序）

見 `docs/HANDOFF.md` 的「下一步」與 `prototype/proposal.html` 的「還沒決定的事」。
