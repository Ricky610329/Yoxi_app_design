# 交接文件 — yoxi 城事設計原型

最後更新：2026-09-23（branch `feat/webapp`，`26c8e4d` 之後）。這份文件給接手的人或 AI agent：專案是什麼、做到哪裡、東西放哪裡、怎麼驗、哪些還沒決定。
人看的導覽在 `README.md`，agent 的規矩在 `AGENTS.md`，時間線在 `docs/WORKLOG.md`。

## 1. 專案一句話

把 yoxi（和泰叫車）變成一個**不搭車也會打開**的城市探索與收藏工具，再把「發現一個地方 → 叫車去那裡」接回本業。
提案的高階版本在 `prototype/proposal.html`（五步 roadmap、一軸一行的決策矩陣）；demo 在 `prototype/index.html`。

## 2. 做到哪裡（五輪）

| 輪 | 內容 | 入口 |
|---|---|---|
| 第一輪 | 三條 demo 流程（A 不搭車的日常、B 搭車的轉換、C 晚上的回顧）共 33 張主線畫面檔（登記表 37 個節點，含參數狀態）；地圖歸屬變體 0／A–F；六條防護承諾與一鍵驗收 | `index.html`、`variants.html#axis-map` |
| 第二輪 | 層級樹＋評語（`overview.html`）、變體註冊表、收藏 S1–S5、探索 X1–X5、T1、低認知負擔 L1–L6（可按數／到達步數自動量測）、願景探索稿 12 張 | `overview.html`、`variants.html`、`vision.html` |
| 第三輪 | 真實 OSM 地圖引擎與六種底圖、單／雙地圖、微 3D、實景照片、好友系統六頁＋AI 鄰居、五張概念板；轉換點 K1–K7 | `concept.html`、`variants.html#axis-conv` |
| 提案 | 提案總覽頁、README、本交接 | `proposal.html` |
| web app | 合一版做成單頁 web app：25 條 route、hash 路由、localStorage 狀態、PWA；瀏覽器測試 187 條＋node 單元測試 34 條。見 §10 | `app/index.html`、`app/README.md` |
| 初賽交件 | 2026 和泰 AI 黑客松 yoxi 題的交件包：HTML 簡報（摘要 1＋正文 15＋附錄，`build-pdf.py` 印 PDF 並檢查頁數／大小／溢出／禁用詞）、3 分鐘向量動畫影片（腳本、場景、TTS 草稿配音）、六份佐證文件（資料、AI 架構與成本、商業、KPI、roadmap、差異化）。敘述立場：站在 yoxi 的角度寫成給經營層的路線圖備忘錄。見 §11 | `pitch/README.md`、`pitch/BRIEF.md` |

規模：102 張畫面檔（33 主線＋43 變體＋12 願景稿＋14 概念稿，含 `variant-k-ride` 落點頁）、10 條設計軸線 36 個變體、5 張概念板、10 張 CC 照片。

## 3. 檔案地圖

```
prototype/
  index.html       demo 首頁：三條流程＋講稿（tour.js 的字幕列）＋六扇門
  proposal.html    提案總覽（從 catalog 的 ROADMAP／AXES 渲染）
  overview.html    層級樹＋評語（localStorage key yoxi-chengshi-review-v1，與 demo 狀態分開；可匯出／匯入 JSON）
  variants.html    變體卡牆（依 AXES 分區；六條承諾晶片）
  vision.html      願景探索稿目錄        concept.html   概念稿目錄（含五張板）
  screens/         102 張畫面：主線｜variant-<key>-<頁>｜vision-<主題>-<abc>｜concept-map-*｜concept-friend-*
  js/
    catalog.js     單一登記表：SCREENS／GROUPS／FLOWS／TABS／STATES／AXES／VARIANTS／VISIONS／CONCEPTS／ROADMAP／THUMB_ALIAS＋buildTree()
    mock.js        假資料（地點、明信片、路線、獎章、FAMILY／EVENTS／PLANS／HEALTH）；findPlace()
    state.js       進度（localStorage key yoxi-chengshi-v1-2）：收過的卡、note、路線、獎章、設定
    shell.js       共用零件：TABSETS／ROOTS、rewriteHref、postcardArt／injectArt、renderSpots／bindPeek、postcardWall／badgeGrid、toast、shareSheet、ready
    interact.js    互動：sheet 拖曳、平移、data-toast／data-switch／data-pills／data-flip／data-cap
    tour.js        導覽字幕列（?flow=&step=）    review.js   評語層
    hsmap.js       地圖引擎（五種 preset、傾斜、霧化、iso）  photos.js  站位→實景照片   mock-friends.js  好友資料
  css/             tokens（色票、字級、六種圓角、動畫）｜base｜components（yoxi 既有）｜chengshi（城事新增）｜concept（只有概念稿載）
  assets/          thumbs/（430×912 與 mini 86×182）、boards/（1600×1000 PNG）、map/（hs-core／hs-wide／hs-places）、photos/（＋credits.js）、vendor/leaflet、load.js／load.json（功能數量測）
  boards/          五張概念板的 HTML（board.css／board.js 共用）
  tools/           verify-quiet.py（總驗收）、shoot.py（縮圖）、audit-app／audit-load／audit-quiet／audit-tree／audit-walls／smoke-variants（瀏覽器稽核）、fetch-map.py、fetch-photos.py
app/               web app（合一版）；只讀 ../prototype，原型一個字沒動
  index.html       單一入口        ARCHITECTURE.md  契約（選版、API、DOM、測試、分工、路由總表）        README.md  人看的
  js/app.js        核心 window.APP：router、store、fmt 公式、nav、ui、map.mount
  js/views/        ride.js｜explore.js｜album.js｜system.js（四個區塊，各自註冊 view）
  css/             app.css（外框、轉場、tab bar、demo 面板）＋ views/{ride,explore,album,system}.css
  tests/           run.py 總入口｜harness.js｜runner.html｜specs/*.spec.js（瀏覽器）｜unit/*.test.mjs（node）
  sw.js、manifest.webmanifest、assets/icons/   PWA
  tools/           serve.py（本機／區網伺服器）｜make-icons.py｜check-sw.py（快取清單對帳）｜shoot-app.py（每條 route 的截圖）
docs/              本交接、工作時間線
brain_strom.png    最初的腦力激盪圖      Yoxi_app截圖.zip  yoxi 現有 app 截圖（還原用）
```

資料流：`catalog.js` 是唯一真相 → 五個總覽頁與 `tools/audit-tree.html` 都從它渲染／對帳；`shoot.py` 的 `SHOTS` 與 `catalog.js` 的 `THUMB_ALIAS` 必須逐條對得上（樹的第 5 關會查縮圖存在）。

## 4. 設計紀律（改任何畫面前先讀）

- 紅色＝品牌情緒（頁首、抽屜、地圖 pin、強調數字、logo）；海軍藍＝可按。`css/tokens.css` 檔尾。
- 禁用詞：任務／完成／達成／挑戰／每日；沒有 streak、倒數、限量、排名、未讀數字。
- 六條防護承諾（`variants.html` 晶片；`tools/verify-quiet.py` 重跑）：圖層關閉時 464 個節點逐節點相同／叫車關鍵路徑 4 tap 不變／收合態 sheet 0 像素改動／叫車地圖同時最多 4 個景點／與六個受保護元素 0 px² 重疊／pin 與景點兩套標記 class 交集為空。第七顆「E 的足跡上色」還沒量，故意寫在頁上。
- 隱私分軌：只有你（日誌、心情、照片、走過的路線）／你可分享（明信片、獎章、週回顧、長輩圖）。
- 好友系統四道圍牆：沒有聊天、沒有已讀、沒有數量、AI 有標示可關。
- 推播一天最多兩則；探索地圖最多 10 個景點；抵達驗證 80 公尺內停 1 分鐘。

## 5. 怎麼驗、怎麼拍

```bash
python prototype/tools/verify-quiet.py            # 八段：幾何③④⑤⑥、DOM①、結構②、互動、全站、圍牆、樹、功能數（寫 assets/load.json）
python prototype/tools/shoot.py                   # 全部縮圖；--only a,b 只拍幾張；--mini 小圖；--board 五張板
python prototype/tools/fetch-map.py --from-cache  # 重新塑形地圖資料（快取在 tools/.cache，不進版控；沒快取才會連 Overpass）
python prototype/tools/fetch-photos.py --list     # Commons 候選照片；--only id,id 下載
python app/tests/run.py                           # web app：node 單元＋headless Chrome；--only ride 只跑一個 spec、--unit 只跑 node
```
瀏覽器可直接開 `tools/audit-app.html`（`?scope=vision`／`?scope=concept`）、`audit-walls.html`、`audit-tree.html`、`audit-load.html`。
截圖用的 Chrome 旗標：`--headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --force-device-scale-factor=1 --virtual-time-budget=N`；頁面帶 `?still=1` 關動畫。

## 6. 各軸線目前的決定（細節在 proposal.html 的矩陣）

| 軸線 | 我們選 | 未定的 |
|---|---|---|
| 地圖該歸誰 | E 景點常駐＋一鍵設為下車點（D 是預設關的降落傘） | |
| 轉換點在哪 | K1 內容頁設為下車點（允許動叫車首頁後升級 E） | K1 的 3 km 門檻 vs 主線 10 km |
| 城事從哪裡進 | — | 候選 G 抽屜 vs 三分頁 tab bar |
| 收藏怎麼組織 | S3 路線書架 | |
| 探索主敘事 | X2 缺口導向 | |
| 獎章呈現 | X4 勳章牆 | |
| 好康任務同頁 | 不同頁（T1 是對照組） | |
| 畫面功能數 | L1 一屏一事 | |
| 儀式長度 | — | 三幕 vs 候選 I 一秒版 |
| 家人 | — | 分享選項 vs 候選 L 模式 |

## 7. 已知問題與限制

- `screens/concept-map-tiles.html` 需要網路（CARTO／Esri 圖磚）；其他全部離線。
- 微 3D 的建物高度七成八是推的（OSM 只有 21.7% 有樓層數）。
- 明信片與插圖是程式生成示意（`postcardArt`），標「AI 生成示意」；十張實景照片只覆蓋十個地點。
- `unlock.html` 的 `?when=night` 時間寫進 DOM 但被 `.unlock` 的 z-index 蓋住（主線既有行為）。
- 好友系統與 AI 鄰居是概念稿，沒接主線；五個未決寫在 `boards/board-friends.html`。
- 車資、時間、里程都是公式或示意值（`75＋22×km`、`3＋2.2×km` 分、走路 `m/75`）。

## 8. 下一步（建議順序）

1. **入口決定**（G 抽屜 vs tab bar）：影響第 1 步能不能上；先用 G 拿開啟數據的論述在 `variants.html#axis-entry`。
2. **量 E 的足跡上色**：補第七條承諾的判準（叫車模式下地圖非道路著色面積上限），寫進 `tools/audit-quiet.html`。
3. **K1 門檻重談**：3 km／10 km 統一到一個地方（`place.html`、`variant-k1-place.html`、`variant-k-ride.html`）。
4. **好友五問**：AI 該不該回信、能不能寄給不在 app 的人、回一張、20 字、入口。
5. **內容供給**：城市景點與活動誰整理、多久更新（brainstorm 的但書）；`routes.html` 主張每月由 AI 從官方活動與熱點重生。
6. 如果要做正式版：把 `postcardArt` 換成真的生成資產、把 `hsmap` 的資料改成線上更新、把 `state.js` 換成後端。
7. **web app 上 https**：`app/` 放上 GitHub Pages 或任何 https 靜態主機（連同 `prototype/` 一起，app 用 `../prototype` 載共用檔），手機就能「加到主畫面」安裝。
8. **web app 換真資產**：`postcardArt` 換成真的生成圖；八張對不到座標的卡補座標（或擴大底圖）。
9. **web app 換真抵達**：geolocation（80 公尺內停 1 分鐘）取代 demo 的「模擬抵達」。
10. **web app 換後端**：`STATE` 與 `APP.store` 的 localStorage 換成帳號＋後端，才能跨裝置。
11. **把六條承諾搬進 app 的測試**：合一版的 `/ride` 目前只有「剛好 4 顆景點」有斷言；②tap 數、③收合態 0 像素、⑤不遮 pin 與浮動鈕、⑥兩套標記 class 交集為空，都要在 `app/tests` 重量（五份評估都點到，見 `docs/webapp-review/README.md`）。
12. **評估提出、需要產品決定的**：探索是否退回一天一個（UX）；探索 tab 的小紅點算不算未讀提示（UX）；上線順序拆成「記錄與獎章＋K1＋抽屜入口」先上（商業）；投影用 1080p 或全螢幕（評審）。

## 9. 交給 Codex 的最短路徑

1. 讀 `AGENTS.md` → 本文件 §3、§4、§5。
2. 跑 `python prototype/tools/verify-quiet.py` 拿基準。
3. 從 §8 挑一項，開分支，照 `AGENTS.md` 的慣例做，做完再跑一次驗收，commit。
4. 需要背景時：`docs/WORKLOG.md` 有每一筆 commit 做了什麼；每張畫面的檔頭註解有「為什麼這樣做」。

## 10. web app（合一版）

**結論**：`app/` 是提案推薦那一組決定的可用版本；契約在 `app/ARCHITECTURE.md`，測試在 `app/tests/`，原型一個字沒動。

選版（`ARCHITECTURE.md` §0）：tab bar 三分頁、E 景點常駐（叫車地圖 ≤ 4）、K1 內容頁設為下車點、S3 路線書架、X4 勳章牆、X2 缺口導向、L1 一屏一事、三幕解鎖、家人＝分享選項、好康任務不同頁、好友不做。
§6 裡原本未決、在 app 拍板的：

| 未決 | app 的選擇 |
|---|---|
| 城事從哪裡進（G 抽屜 vs tab bar） | tab bar 三分頁 |
| K1 門檻 3 km vs 10 km | 統一 3 km（`APP.fmt.WALK_MAX_M`） |
| 家人（分享選項 vs 候選 L 模式） | 分享選項：分享面板第一格是長輩圖 |
| 儀式長度 | 三幕（點畫面可跳到成品） |

跟原型的關係：只從 `../prototype` 讀 tokens／components／chengshi／mock／state／shell／interact／hsmap／photos，不改。
所以 `python prototype/tools/verify-quiet.py` 的八段與六條承諾數字應與基準相同；變了就是有人碰了 `prototype/`。

| 要找 | 在哪 |
|---|---|
| 契約（API、DOM、測試、分工、路由總表） | `app/ARCHITECTURE.md` |
| 怎麼開、三條 demo 怎麼走、已知限制 | `app/README.md` |
| 測試操作手冊 | `app/tests/README.md`；`python app/tests/run.py` |
| 每個畫面為什麼這樣做 | `app/js/views/*.js` 檔頭（回答什麼／從哪張原型來／刻意沒有的東西） |

已知問題：

- **brick 的距離兩處不一致**：`MOCK.PENDING` 是 2400 m、`MOCK.SPOTS` 是 1500 m。app 統一走 `APP.place(id).dist`（以 `findPlace` 為準，取 2400），不要直接讀 SPOTS 的 dist。
- **`interact.js` 的 listener 不會自己解除**：`initSheet／initPan` 用 `addEventListener` 掛在 `window` 上。原型不能改，所以由 app 的 router 在 mount 期間記下、離開該頁時移除（第三波加的，`ARCHITECTURE.md` §3.2）；自己在 mount 外呼叫 `INTERACT.init*` 就不受這個保護。
- **內灣在底圖外**：底圖只有新竹 11×12 km，內灣在 28 km 外，行程與路線上會夾到地圖邊緣（`.spot--edge`）。
- **城市足跡少算八張卡**：22 張明信片裡 8 張（p10 合興、p12 九讚頭、p13 橫山、p14 玻璃工藝博物館、p15 春池玻璃、p16 舊社的矽砂場、p17 水源地的窯口、p18 頭前溪河口）對不到地圖座標，收了也不進覆蓋率（`album.js` 的 `placeOfCard`）。
- 叫車、抵達、推播都是模擬；PWA 只能在 localhost 或 https 安裝。
- **六條承諾在 app 只有④有斷言**：合一版動了叫車首頁（tab bar、4 顆景點、banner 第一格），驗收數字量的是原型的 `home.html`。講的時候要說清楚（`docs/narratives/zero-harm.md`）。
- **桌機縮放後拖曳跟手 80%**：1280×720 投影時 `.device` 用 `transform: scale()` 縮到約 0.8，`interact.js` 的平移與 sheet 拖曳用 clientX／Y 差值換算，沒有除以 scale。要修得動 `prototype/js/interact.js`。
- **+50 點與金框只給走不到（> 3 km）的地方**：近的地方搭車抵達照實記 `by:'ride'`，但只算一般搭車回饋（每 20 元 1 點，無條件捨去）。`STATE.points` 是原型算法（所有 ride 卡 ×50），app 的點數頁用 `APP.ride.pointsTotal` 自己算；初始兩張搭車卡都走不到，兩邊目前一致。
- **轉換歸因**：`store.trip.via` 與 `store.rideVia[cardId]` 記下車點來源（k1／e／route／search），行程紀錄顯示；原型的 `state.js` 卡片欄位不能加，所以放在 app 的 store。

五個視角的評估（商業、UX、工程、無障礙、評審）在 `docs/webapp-review/`（索引 `README.md` 有交叉整理與已回應清單）；五種敘述方向與 demo 講稿在 `docs/narratives/`。

## 11. 初賽交件（`pitch/`）

**結論**：`pitch/` 是 2026 和泰 AI 黑客松 yoxi 題「不搭車，也打開 yoxi」的初賽交件包；官方事實在 `pitch/docs/competition.md`，工作簡報（立場、數字紀律、檔案歸屬）在 `pitch/BRIEF.md`，上傳前清單在 `pitch/README.md`。

| 要找 | 在哪 |
|---|---|
| 簡報 HTML 與 PDF 管線 | `pitch/deck/index.html`、`deck.css`、`deck.js`、`build-pdf.py` → `out/yoxi_城事_初賽提案.pdf`（out/ 不進版控） |
| 影片（向量動畫） | `pitch/video/shots.json`（旁白與每格畫面指示，機器真相）、`anim/`（`CONTRACT.md` 契約、`lib.js` 共用零件與地圖層、`scenes-a.js`／`scenes-b.js` 十三格場景、`index.html` 舞台）、`build-video.py`（TTS → 逐格 DevTools 截圖 → ffmpeg）→ `out/draft.mp4`；`script.md`、`storyboard.html` 由腳本重寫 |
| 每個數字的出處 | `pitch/docs/{data-plan,ai-architecture,business,kpi,roadmap,competitive}.md`，每份開頭三行寫回答哪幾頁／結論／未決 |
| 摘要頁文字 | `pitch/summary.md`（官方七欄，順序不能改） |

規矩：`prototype/`、`app/` 不動（要新截圖跑工具，PNG 放 `pitch/deck/assets/`；影片不用截圖，畫面全是 `anim/` 的向量場景）；簡報只用 `tokens.css` 的色票、不加 CDN 與 webfont；外部數字沒有 URL 就標「假設」；yoxi 寄來的解題資料不進 repo（注意事項第 9 條）。

幾個在交件包裡拍板、與 repo 先前寫法不同的決定：點數改為 3 km 以上按距離三級（20／35／50 點）＋每人每月上限（原型畫面仍是固定 +50，簡報有註明）；新竹 12 週試辦範圍＝第 0 步＋地方頁「用 yoxi 前往」（K1）＋「今天的地方」最小版（抽屜內每天一張卡＋早上一則可關推播，不動 tab bar），完整探索頁與 tab bar 決定移到 2027 Q2；簡報正文不用內部代號（K1／K7／E／G／合一版），只在附錄 A-3 保留對照；北極星「非叫車開啟週活躍率」；內容供給每城 1 位編輯（內容量假設以 `business.md` §4 為準、雲端成本以 `ai-architecture.md` §4 為準）。

還沒有答案的：隊名與成員；GitHub 是否公開（第 15 頁與附錄直接寫了網址）；+50 級距與每月上限由誰簽核；yoxi 真資料的欄位（決定第 4 頁要不要換成真圖）；影片要不要換真人配音（每格一個音檔 → `build-video.py --audio-dir`）。

