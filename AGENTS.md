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

## 常見坑（都踩過）

- Windows 顯示縮放會讓 Chrome 用 1.25 倍出圖：shoot.py 已鎖 `--force-device-scale-factor=1`，自己寫截圖腳本也要帶。
- `overflow:hidden` 會把 `preserve-3d` 壓平：翻面的明信片改成 `overflow:visible`，兩個面各自裁圓角。
- Overpass API 連續請求會 429，`fetch-map.py` 有 mirror 與快取（`tools/.cache/`，不進版控）；Wikimedia Commons API 連發三次就 429，`fetch-photos.py` 有 sleep 與退避。
- bash heredoc 裡放含引號的 Python 一行指令很容易炸：長腳本寫成檔案再跑。
- git 會警告 LF→CRLF，忽略即可；不要改 `.gitattributes`。

## 交給下一位的待辦（優先序）

見 `docs/HANDOFF.md` 的「下一步」與 `prototype/proposal.html` 的「還沒決定的事」。
