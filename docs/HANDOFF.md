# 交接文件 — yoxi 城事設計原型

最後更新：2026-09-24（branch `feat/two-page-card-sheet`；目前雙主頁 UI 見 §13）。這份文件給接手的人或 AI agent：專案是什麼、做到哪裡、東西放哪裡、怎麼驗、哪些還沒決定。
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
| web app | 合一版的底層流程仍在；目前主畫面改為叫車／收藏雙主頁，叫車頁內切搭車／探索，探索面板展開後保留地點資訊並顯示卡片。hash 路由、localStorage 與 PWA 繼續運作；瀏覽器測試 189 條＋node 單元測試 34 條。見 §10、§13 | `app/index.html`、`app/README.md` |
| 介紹網站 | `site/index.html`：一頁式捲動介紹站（hero 霧地圖隨捲動散開、週曆條、三段 scrolly 手機、可點的真實新竹地圖、3 公里距離尺、AI 卡、圖層開／關對照、路線圖、影片）。見 §12 | `site/index.html`、`site/CONTRACT.md` |
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
docs/              本交接、工作時間線、references/（使用者提供的版面參考與回饋圖）
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

以下是原型與提案時期留下的議題，不是這輪雙主頁 UI 的待辦；目前 app 狀態與交接重點以 §13 為準。

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

1. 讀 `AGENTS.md` → 本文件 §13，再看 §3、§4、§5 與 `app/ARCHITECTURE.md`。
2. 跑 `python prototype/tools/verify-quiet.py` 拿基準。
3. 依使用者下一輪的方向開分支；§8 是原型／提案議題清單，不代表已授權的 app 改動。照 `AGENTS.md` 的慣例做，做完再跑一次驗收並 commit。
4. 需要背景時：`docs/WORKLOG.md` 有每一筆 commit 做了什麼；每張畫面的檔頭註解有「為什麼這樣做」。

## 10. web app（合一版）

**目前狀態**：`app/` 從這個合一版演進成雙主頁 UI；現行的互動決定在 §13 與 `app/ARCHITECTURE.md`。本節以下保留合一版當時的選版與技術背景，供理解舊路由和提案對照；原型仍未因這輪 app 改版而修改。

當時的選版（現為歷史背景）：tab bar 三分頁、E 景點常駐（叫車地圖 ≤ 4）、K1 內容頁設為下車點、S3 路線書架、X4 勳章牆、X2 缺口導向、L1 一屏一事、三幕解鎖、家人＝分享選項、好康任務不同頁、好友不做。
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
- **城市足跡少算八張卡**：22 張明信片裡 8 張（p10 合興、p12 九讚頭、p13 橫山、p14 玻璃工藝博物館、p15 春池玻璃、p16 舊社的矽砂場、p17 水源地的窯口、p18 頭前溪河口）對不到地圖座標，收了也不進覆蓋率（`app.js` 的 `APP.footprintPlace`；它跟 `APP.place` 對 p3／p6／p8 的答案刻意不同，見 `app/ARCHITECTURE.md` §3.4）。
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

## 12. 介紹網站（`site/`）

**結論**：`site/index.html` 是給第一次聽到「城事」的人看的一頁式介紹站，`file://` 直接開；沒有 build、框架、CDN、webfont。契約在 `site/CONTRACT.md`。

| 要找 | 在哪 |
|---|---|
| 骨架與各段文案 | `site/index.html`（section 的 id 與掛載點固定；scrolly 用 `data-scrolly／.step[data-step]／img[data-shot]`） |
| 捲動框架 | `site/js/scroll.js`：reveal、`--p` 進度、scrolly 步驟、導覽列高亮、`data-fmt` 填公式數字、`?y=／?reveal=all／?nomotion=1` |
| 資料與公式 | `site/js/data.js`（`SITE_DATA`：與 `app/js/app.js` 同一套公式、10 個地點、內灣、深連結；內容區塊追加在檔尾） |
| 互動元件 | `site/js/widgets.js`（hero 霧地圖、可點的真實地圖、距離尺、圖層對照）、`site/js/postcard.js`（抄 shell.js 的明信片 SVG） |
| 各段樣式 | `site/css/site.css`（基底）、`sections.css`（各段）、`widgets.css`（互動元件） |
| 截圖驗收 | `python site/tools/shoot-site.py`（借 `pitch/video/build-video.py` 的 DevTools 用戶端；輸出 `site/tools/.shots/` 不進版控） |

規矩：只讀 `prototype/`、`app/assets/shots/`、`pitch/video/out/` 不改；不寫 hex；數字走 `data-fmt`；禁用詞與誠實標示同全站。

## 13. 2026-09-24 雙主頁與探索卡片面板（目前 app 主畫面）

使用者希望日常叫車幾乎不受探索影響，因此 `app/index.html` 的底欄現在只有「叫車／收藏」。叫車頁預設「搭車」，面板頂部按變體 F 的結構放「搭車／探索」兩個模式按鈕。收藏頁維持摘要、明信片與獎章的主頁結構。舊 `/explore`、`/place/:id` 等路由仍可用深連結進入，供既有流程對照，主頁入口不導向它們。

| 狀態／動作 | 現行行為 |
|---|---|
| 搭車 | 地圖沒有探索圖釘；面板跟探索一樣上下拉，往下收到只剩拉把看整張地圖，往上拉或點拉把回到叫車欄位（2026-09-25 起，原本的「展開搭車」按鈕拿掉）。 |
| 切到探索 | `#/ride?mode=explore&area=<id>`；四個展示地區中依 `APP.place(id).dist` 預選最近的。地圖圖釘可改選地區，選後面板先收合。 |
| 探索收合態 | 顯示一張精簡地點資訊卡與「用 yoxi／收集」。用 yoxi 回搭車並填下車點；收集打開卡片面板。 |
| 探索上拉 | 地點資訊卡、兩個按鈕留在上方；下方直接接所選地區的疊放卡片。沒有「附近的地方」清單，也不進地點詳情頁。內容超過面板高度時可捲動。 |
| 點卡片 | 在原頁打開可翻面的懸浮小卡，背面只有簡短收藏狀態。這裡的「收集」是查看卡片的入口；真正收下卡片仍走抵達／既有 `STATE` 流程。 |
| 探索下拉 | 只收合面板，仍留在探索與原選定地區；再往下收到只剩拉把，點景點或拉把叫回來。 |

實作入口：`app/js/views/ride.js` 的 `rideV2Render／rideV2Mount`、`CARD_AREAS`、`bindExploreSheet`，樣式在 `app/css/views/ride.css` 的 `.ride-v2__*`；兩個模式的拉法共用同檔的 `bindDragSheet`，全高地圖是 `mountFullMap`。收藏在 `app/js/views/album.js` 與 `app/css/views/album.css`。主路由與資料契約以 `app/ARCHITECTURE.md` 為準，使用說明在 `app/README.md`。PWA 快取版號見 §14（`app/sw.js` 與 `app/js/views/system.js` 需同步）。

目前畫面截圖：`app/assets/shots/ride.png`（預設搭車）、`ride-peek.png`（探索收合）、`ride-cards.png`（預選地區展開，保留上方資訊卡）、`ride-float.png`／`ride-float-back.png`（卡片互動）、`album.png`（收藏）。使用者原始排版圖、草圖與四輪回饋截圖集中在 [`docs/references/README.md`](references/README.md)；參考圖不是 app 資產。重拍用 `python app/tools/shoot-app.py --only ride,ride-peek,ride-cards,ride-float,ride-float-back,album`。

交接驗證：`python app/tests/run.py` 是 node 34/34、瀏覽器 189/189；`python app/tools/check-sw.py` 是 45 筆 PASS；`python prototype/tools/verify-quiet.py` 八段全 PASS，六條承諾的數字與改版前相同。`verify-quiet.py` 會改寫 `prototype/assets/load.js` 與 `load.json` 的 `generatedAt`，若只有時間戳差異，檢查後還原即可。本輪變更留在 `app/`、文件與參考圖，沒有改 `prototype/`、`pitch/` 或 `site/`。

下一位 agent 請從本節、`app/ARCHITECTURE.md` §0 與 `app/README.md` 的「這版怎麼看」開始。這輪 UI 已按最後回饋收束；接下來先等使用者的新調整方向。`docs/WORKLOG.md` 記有這輪各個 commit 與回滾原因。

## 14. 2026-09-25 全面 review 與修正（分支 `fix/app-review`）

使用者要「掃一下這個 APP 有沒有能改進的地方」，接著「全修」。先由四個唯讀 agent 分區（ride／explore／album／core＋system＋PWA）讀碼並用 Playwright 重現，找到約 60 條測試抓不到的問題；再由五個 agent 各在自己的 git worktree 修（core、PWA＋測試跑者＋system、ride、explore、album），主 agent 定好跨區塊約定後合併、縫合、改文件。契約變更都已寫進 `app/ARCHITECTURE.md`（§0、§1–§4、§6–§9，含「返回規則」與「浮層約定」）。

最重要的幾類修正：
- **會弄丟東西的狀態 bug**：走路收卡會清掉搭車的限定版與 +50（`collect` 現在只有 `by:'ride'` 才清 trip，搭車與否只看 `store.trip`）；`cardIdOf` 與 `place().card` 對不上讓「明信片還沒收」永遠掛著；壞掉的 trip id 卡死叫車；確認框、分享面板、機率說明換頁不會關（新增 `data-overlay`／`APP.ui.dismissOverlays`，`APP.ui.confirm` 改成三態：是 true／否 false／沒回答 null）；同網址 push 要按兩次返回。
- **雙主頁改版後斷掉的路**：收藏首頁補「回顧」一列（今天的回顧／這一週／城市足跡）；`/postcards` 每一格點得進詳情（`[data-gallery]` 整片算一個可按）；通知與「在地圖上挑」帶 `mode=explore`；舊路由的保底去處改成 `/ride?mode=explore`；收藏子頁返回鍵在切 tab 之後也對。
- **畫面與手感**：收藏裡看得到金框；「yoxi 限定版」與「yoxi 金框」分開；拉把 8 px 算點、照方向換段、跟手、可用鍵盤；景點在 `APP.map.mount` 自動推開；手機橫放不再被當成桌機；命中區 ≥ 44 px。
- **使用者追加**：抽卡結果與收集面板都不寫機率、不寫「必得金框」，機率只在「?」裡。
- **文案誠實**：「去過的地方」是不重複的地點數；「今天多了一張」看日期；週回顧標題＝圖表的 7 天；城市顏色從去過的地方算；拿掉沒實作的「90 天變淡」。
- **無障礙、PWA、測試跑者**：換頁焦點、對話框焦點圈與 inert、toast 走常駐 live region；明信片成品離線可看（執行期快取）、導覽 network-first、有新版本會提示、`start_url` 會先看 onboarding、`check-sw.py` 缺檔即失敗；找不到 spec 檔算 FAIL、死按鈕與禁用詞也掃浮層與 demo 面板。
- **整理**：`explore.js` 拆成 `explore-cards.js`（明信片與抽卡的共用 API）／`explore.js`／`explore-unlock.js`；album 約 230 行舊書架死碼、ride.css 用不到的樣式刪掉；px 字級與 rgba 換成 tokens。

驗證：`python app/tests/run.py` node 47/47、瀏覽器 272/272；`python app/tools/check-sw.py` 60 筆 PASS（PWA `chengshi-app-v16`）。`app/assets/shots/` 的截圖是改版前拍的，`shoot-app.py` 在這台 Mac 會卡住，沒有重拍。沒有改 `prototype/`、`pitch/`、`site/`。

還沒做的：`app/tests/fixtures/`（selftest）沒有補浮層掃描與 `hit` 的案例；`MM.DD` 沒有年份，週回顧跨年會算錯（STATE 的格式歸 prototype，寫在 album.js 註解）；REVEAL（五款抽卡特效）刻意沒有改成資料表。


## 15. 2026-09-26 收藏疊卡順序、金框卡的金粉（分支 `feat/gold-card-aura`）

使用者要：收藏首頁的三張明信片是「最新獲得的三張」；金卡不管在哪裡顯示都有特效，金粒子從框邊緣散出，隨畫面移動有物理性質、跟著往上或往下飄。

- **疊卡順序**：`APP.album.recentCards` 改看 `STATE.all.cards` 的鍵順序（`STATE.collect` 每收一張就加在最後）。以前比 `MM.DD`、同一天只把 `lastCard` 提前，同一天連收三張時第二、三張會顛倒，跨年後新卡還會排到 demo 的舊卡後面。疊卡、`/postcards`、長輩圖預設、城市顏色都用它。
- **金粉**：新增 `app/js/views/explore-gold.js`（`APP.fx.gold`）。在「畫金框的那個元素」加 `data-gold-aura` 就會從它的邊緣散金粉；`[data-card-art]` 的金框卡沒人標時 `paintCardArt` 自動補 `.card-gold`＋`data-gold-aura`。整台手機一張 canvas（`.device` 上、z-index 97、不吃點擊）；被蓋住的邊不冒（`elementFromPoint`）、裁在捲動範圍裡；金粉被「跟著卡片走的空氣」帶著，有阻力與慣性。減少動態效果時不建 canvas、框照舊；看不到金框卡時不跑 rAF。契約寫在 `app/ARCHITECTURE.md` §7。
- **質感（使用者第二輪：「物理不錯、質感差」）**：物理不動，只改畫法。原本每顆都是一樣的圓金珠、暗底是一團團模糊的光。改成四種：細金粉（大多數、很小很銳利）、扁的金箔（翻到正面那一下閃）、細長的四芒閃光、暗底才有的淡散景；每顆有遠近（大小、亮度、阻力不同，捲動時分得出前後層）；相對空氣動得快的才拉出往後變淡的短尾巴（跟著內容走的不糊）；沿著圓角的邊冒；每張卡每 4.8 秒一道斜光掃過框、從亮的地方多灑一把。亮底的金箔正面用亮金不用香檳色（白底上會變成空心的圈）。390×844、3 倍像素在詳情、`/postcards`、收藏首頁都是穩定 60 fps。
- **沒有生成成品的明信片（使用者第三輪：「十八尖山的防空洞明明有實體圖片，總覽還是示意圖」）**：p12–p22 共 11 張沒有生成的成品（`POSTCARD_GEN` 只有 p1–p11），但都有實景照片。`/unlock` 的卡面會退回「照片＋濾鏡」，收藏各處用的 `paintCardArt` 卻沒有這一步，收下之後就變回插圖。現在 `paintCardArt` 跟 `/unlock` 同一個順序（成品 → 照片＋那一款的濾鏡 → 插圖），濾鏡照抽卡卡面的大小算、再縮放，縮圖也不會糊。一起修的：週回顧的卡與封面沒有 `data-card-art`（p1–p11 也只有插圖）；明信片詳情補上底圖照片的出處（CC 授權要署名）；`/postcards` 與週回顧的說明不再說「不是實景照片」；叫車面板卡片的「AI 生成示意」角標上下都貼住、半透明底色蓋住整張卡（`.ai-mark` 的 `top` 沒清）。還沒收的卡照舊是灰階插圖；長輩圖刻意維持插圖（圖上寫「AI 畫的，不是照片」，而且會分享出去）。
- **標了哪些地方**：收藏首頁疊卡（新增金邊）、`/postcards`、明信片詳情、獎章組成卡、每日回顧「今天多了一張」、週回顧、叫車探索面板的卡、浮起來看的小卡（正反面金框）、`/unlock` 翻開之後（翻開前不標，不洩底）。長輩圖挑的是插圖不是明信片，沒有標。

驗證：`python app/tests/run.py` node 47/47、瀏覽器 277/277（新增 5 條）；Playwright 實機看過手機與桌機縮放外框、捲動中、換頁中、翻面、分享面板蓋住、`?still=1`。`check-sw.py` 的清單本身對，只被工作目錄裡兩個沒進版控的 `* 2.js` 複本（Finder 產生，跟 HEAD 一模一樣）判 FAIL；`verify-quiet.py` 在這台 Mac 仍然找不到 Chrome、只跑得了 ②（PASS）。沒有改 `prototype/`、`pitch/`、`site/`。


## 16. 2026-09-26 架構整理：散掉的概念收成 deep module（分支 `refactor/app-deepening`）

使用者要「看看這個網站有沒有可以改進的」（範圍定為 `app/`），先拿到一份架構審查（8 個候選，只讀），接著「全修，在不動到任何功能的情況下」。
做法：先錄一份 golden master（Playwright、固定時間與亂數、`?still=1`，496 個情境＝10 種 store 狀態 × 每條 route，加上 26 條按 `data-act` 走完的流程；逐步比對 `#view`、浮層、底欄、demo 面板、網址、歷史筆數、兩把 localStorage），每一步都要 `python app/tests/run.py` 全綠、golden master 0 差異（或只有事先說好的差異）才 commit。腳本不進 repo。

收成一處的東西（介面細節都在 `app/ARCHITECTURE.md`）：
- **行程**：`APP.ride.trip`（ride.js）是 `store.trip` 唯一的讀寫者——`current／active／arrivedAt／pending／phase`、`start／toRiding／arrive／arriveAt／cancel／rate／consume／clear`。行程的形狀只寫一次；demo 的「搭 yoxi 抵達」也走它。
- **收下明信片**：`APP.explore.collect(placeId, { note })` 自己判斷搭車或走路、哪一款、幾公里（跟 `/unlock` 畫面同一個 `arrivalAt`）；讀的那一側只有 `APP.explore.cardOrigin(cardId)`（by、style、gold、limited、via）。
- **明信片 → 地點**：`APP.place` 與 `APP.footprintPlace`（app.js）。兩種答案**刻意保留**：足跡把 p3 算成 moat、p6 hill、p8 lake，`APP.place` 當成路線上的站——產品還沒決定，對照表在 `tests/unit/place.test.mjs`。
- **STATE 的寫入**：`APP.state`（app.js）——每次寫都自己發 `state:change`，`batch(fn)` 寫完才發一次；清除足跡的 STATE 欄位只寫在 `APP.state.wipe`。store 的鍵、型別、類別在 app.js 的 `KEYS` 一張表，`APP.store.clear('footprint')`。
- **返回**：router 在 `history.state` 記每一筆的 `prev` 與 `via`，`APP.nav.prev()`、`APP.nav.up(parent, { backIf })`；收藏子頁的返回鍵只標 `data-up`，叫車的「回到 /ride」是 `nav.up('/ride', …)`。ride 的 `histAt` 與 album 的 `yoxi-album-nav` 刪掉。
- **卡面**：新檔 `explore-face.js`，`cardFace(cardId, key)` 是唯一的疊法（`/unlock` 與收藏都照它）；監看整台 `.device`，懸浮小卡不用自己叫 `paintCardArt`。
- **其他**：`APP.map.mount().destroy()` 自己拆 initPan 的 window listener；拉面板的換段是純函式 `APP.ride.snapTarget`；`APP.ui.overlay` 掛浮層（確認框、機率、推播、分享）；版本只在 `app/js/version.js`；拿掉只寫不讀的 `store.arrivedDemo` 與給舊 core 的相容分支；測試的 node 載得動 views（`loadApp({ views, now })`），specs 共用 `T.ROUTES`、`T.fixtures`、`T.helpers`（含 `collect`），只牽涉一個區塊的回歸測試從 flows.spec 搬回各區塊。

跟以前不一樣的只有這三件（都寫在 commit 訊息裡）：
1. demo 面板在距離不明的地方（十八尖山 p6）按「搭 yoxi 抵達」：以前 km 寫成 0、行程完成頁印 $75；現在跟一般叫車一樣寫「距離待確認」（使用者核可）。
2. store 裡的行程指向認不得的地點（舊資料、手改）時，`/going` 與設定頁的「模擬抵達」也當作沒有行程（以前只有 `/ride` 這樣）。
3. 叫車的子頁重新整理之後，上一格若是 `/ride` 會照歷史退回（以前記憶體裡的紀錄沒了，改成就地換成 `/ride`；兩種都停在 `/ride`）。

驗證：`python app/tests/run.py` node 47 → 77、瀏覽器 278 → 280（全綠）；`check-sw.py` 63 筆 PASS（PWA `chengshi-app-v18`）；golden master 每一步對上一步 0 差異（除了上面三件、設定頁顯示的版本號、收藏返回鍵多的 `data-up` 屬性、存檔少了 `arrivedDemo`）。`verify-quiet.py` 在這台 Mac 只跑得了 ①②（PASS、數字與基準相同）；沒有改 `prototype/`、`pitch/`、`site/`。`app/assets/shots/` 沒有重拍（畫面沒變）。

還沒做的：金框標在哪個元素（`data-gold-aura`）仍由各畫面自己決定（那是版面的事）；`/going` 的拉面板還是 prototype 的 `INTERACT.initSheet`（換成 ride 那一套會多出甩動與吸附，是行為改變）；p3／moat 的產品決定。


## 17. 2026-09-27 明信片款式改成透明規則，拿掉抽卡（分支 `feat/transparent-card-rules`）

使用者貼來一份回饋（長輩視角）：稀有度靠機率像賭博，要改成「長輩知道為什麼會拿到特別版」。四點裡使用者選了「做 1＋4，2、3 只記錄」。

**做了的（1、4）**：`/unlock` 走路抵達原本照 `DRAW_STYLES` 隨機抽五款（水彩 45%、油畫 30%、木刻 16.5%、水墨 8%、金框 0.5%），蓄力拍數還會透露稀有度。現在全部照規則（`app/js/views/explore-cards.js` 的 `CARD_STYLES`／`FESTIVALS`／`FAR_KM`／`cardRule`）：
- 走路抵達：畫風跟著季節——春（3–5 月）水彩、夏油畫、秋木刻版畫、冬水墨。跟 `pitch/docs/ai-architecture.md` 的「四季變體」同一個想法。
- 搭 yoxi 抵達：金框（本來就是必得，不是機率；只是不再寫「必得」這種抽卡語氣）。
- 三節那幾天（春節除夕到初五、端午、中秋當天）多蓋一枚節慶郵戳。日期照人事行政總處 115／116 年辦公日曆表（2026-09-27 查），表上沒有的年份不蓋、不猜；**每年要補一行**。
- 搭 yoxi `FAR_KM`（20）公里以上多蓋一枚遠行紀念戳，寫實際公里數。這是「獎勵已經走過的路」，不是機率加成；+50 點的規則沒動（仍只給走不到的地方）。
- 收集面板在按下去之前就寫好「秋天的畫風是木刻版畫／中秋節當天，多蓋一枚中秋郵戳」；結果、明信片頁的「為什麼是這一款」念同樣的句子；「?」從機率表換成規則說明（標出現在的季節）；地方頁「到了會得到」寫「現在走路去是○○，搭 yoxi 去是金框」。
- 翻卡儀式留著，但四季的畫風一樣重（蓄力都 2 拍），只有金框多一段昇格；文案與 `data-act` 從「抽」改成「翻／收到」。
- 郵戳在收下的當下記進 `store.cardMarks`（卡片日期沒有年份、STATE 的卡片沒有公里數，事後推不回來）；`store.draws`（暫存的抽卡結果）拿掉。demo 一開始就有的 8 張沒有郵戳紀錄，款式照收下的月份補（都是九月 → 木刻版畫，搭車的是金框）。
- demo 面板多一個「模擬日期」（`store.demoDate`），現場可以撥到冬天、中秋看別的款式；只影響明信片（款式、郵戳、收下的日期），收藏的回顧照舊用真的今天。

**刻意沒做的（2、3，只記錄）**：
- 2「圖鑑進度條＋里程碑獎勵（相框、稱號）」：本來就沒有保底；獎章已經是「收集 4/8」。進度條換獎勵就是 `album.js` 檔頭刻意拿掉的「進度環與集點卡」，稱號也接近排名，所以不加。
- 3「每週目標（一週 3 次）」：app 本來就沒有「每天 N 個景點」，只有每天一張「今天的地方」，不去也沒事。設了目標就有「沒達到」，跟禁用詞（完成／達成）和「沒有連續天數」衝突；週回顧已經只寫「這一週你去了 N 個地方」，維持紀錄、不設目標。

**要注意**：
- demo 的收藏（全是九月收的）現在清一色是木刻版畫＋金框，比以前單調——這是規則的誠實結果；要展示別的畫風用「模擬日期」。
- `app/assets/shots/`、簡報、影片、網站都沒有重拍或改稿（這台 Mac 的 `shoot-app.py` 叫不到 Chrome）。`unlock-ride.png`（內灣）重拍後卡面會多一枚「遠行 28 km」戳。
- `pitch/` 沒有寫到抽卡或機率，這次沒動；要不要把「三節郵戳、遠行紀念戳」寫進簡報是提案的決定。

驗證：`python app/tests/run.py` node 77 → 80、瀏覽器 280 → 282（全綠）；`check-sw.py` PASS（`chengshi-app-v19`）；Playwright 看過面板、結果、規則說明、遠行戳、冬天、明信片頁、地方頁。`verify-quiet.py` 在這台 Mac 只跑得了 ②（PASS，三個變體與基準「完全相同」），其餘段落找不到 Chrome 略過（它仍印「全部通過」）；`prototype/` 沒動，六條承諾的數字不會變。沒有改 `prototype/`、`pitch/`、`site/`。


## 18. 2026-09-27 節日版明信片：那一週都拿得到、郵戳換成會動的插畫（同分支 `feat/transparent-card-rules`）

使用者第二輪：「節日限定的卡片應該是放假的那個禮拜都可以拿到，不是只有那天」「只改一個印章太爛了」，要中秋有月亮和玉兔、端午龍舟在浪上載浮載沉、賞櫻有櫻花樹與落花、春節放鞭炮；「動畫特效只是輔助，明信片的景色不能全部被擋掉，但也不能太小導致看不出來」。

- **那一週**：`FESTIVALS` 改成記節日當天（`days`）與官方連假（`off`），`festSpan` 算出「當天所在的週一到週日，連假更長就延到連假最後一天」。115 年：春節 2/14–2/22、端午 6/15–6/21、中秋 9/21–9/28（中秋＋教師節連假）；116 年：春節 2/1–2/10、端午 6/7–6/13、中秋 9/13–9/19（週三，沒有連假，查自 104 職場力／商周整理的 116 年辦公日曆表）。**每年要補一行**。
- **賞櫻**：新加的節日版，每年 1/25–3/15（新竹公園河津櫻一月底到二月中，其他品種接著開；三月中為止是假設，要拿當年花況調）。碰上春節以春節為主。
- **插畫**：新檔 `app/js/views/explore-fest.js`（inline SVG，自己畫的，沒有外部素材與授權問題、離線可用）＋ `app/css/views/explore-fest.css`（顏色全用 tokens）。取代原本的節慶郵戳；遠行紀念戳留著，有節日插畫時挪到左上。
- **比例**：插畫只放在卡片四周（右上月亮、左上樹、右側鞭炮、地名上方的浪與龍舟、兔子），浪往下漸淡沒入地名那一條、深藍色，白字照樣清楚。`explore.spec.js` 每一種都量：主角至少五分之一卡寬、卡片正中央不被擋、主角的範圍加起來 ≤ 卡片一半、地名在插畫上面。
- **動多久**：`/unlock` 翻開時開始、明信片頁打開與翻回正面各演一次，約 5 秒停在收尾的樣子（花瓣落地、鞭炮剩上半串、兔子坐下）。這是照 WCAG 2.2.2（自己開始、超過 5 秒要能停）與「結果頁不會一直動」的舊規矩；**使用者如果要一直動，要另外給暫停鈕**。減少動態效果（含 `?still=1`）直接是靜止構圖。
- 版本 v20（新增兩支檔，`check-sw.py` PASS）。

還沒做的：收藏牆、疊卡、週回顧這些小卡沒有節日插畫（小卡一面牆都在動會很吵，要的話建議只放靜止的小角標）；卡片日期沒有年份（已知問題），demo 撥到 2027 年時明信片頁印的是今年。

驗證：`python app/tests/run.py` node 80/80、瀏覽器 283/283；Playwright 逐一看過四種節日在 `/unlock` 與明信片頁的動畫（0.3／1.2／2.4／3.8／6.5 秒）、金框＋節日＋遠行的組合、規則說明、減少動態效果。


## 19. 2026-09-27 龍舟重畫、櫻花加密、長輩圖改成那張明信片本身（同分支 `feat/transparent-card-rules`）

使用者第三輪：「龍舟那個有點醜」「櫻花樹上的櫻花有點少」「把全部的卡片、圖片、特效同步到分享的老人（早安）圖上面，現在分享的早安圖什麼都沒有」。

- **龍舟**：船身分兩層（紅＋深紅的龍骨）、金邊與一排金色龍鱗；S 形脖子、張嘴的龍頭（金角、眉、牙、鬍鬚、鬃毛）；往上捲的龍尾與金鰭；燕尾旗；六個划手有臉、頭髮、紅頭帶，槳連手臂一起划；鼓手打鼓；船尾有掌舵手；船頭水花跟著划槳濺起來。前面那層浪改成海水紋（一排浪頭＋白色捲線），船抬到浪頭上，船身與龍鱗露在水面上。
- **櫻花**：樹冠從 12 叢加到 22 叢，每叢的小圓 11 → 14 個、花 3 → 5 朵。仍然只在左上，比例測試照過。
- **長輩圖**（`/elder`）：以前是程式畫的示意插畫，跟收下的明信片無關。現在整張就是那張明信片：成品或照片＋那一款的濾鏡、金框＋角標＋金粉、節日版會動的插畫、遠行戳，上面壓大字祝福；改成 3:4（跟明信片頁一樣，景色整張看得到）；底下一條寫日期地點、**底圖照片的作者與授權**（這張圖會傳出去，CC 授權要署名）；圖上保留「AI 生成示意」。選地方的小卡也是收下的那一款，節日版寫「中秋版」這種字。以前 §15 寫的「長輩圖刻意維持插圖」由使用者這次推翻。
- **跟另一個 session 的分工**：同一時間另一個 session（`feat/flow-progress-rewards`，從 `bfb54f8` 開）在做累計里程、框與稱號、一鍵 LINE。它把共用的 checkout 切到它的分支，所以這一段改在 worktree `.claude/worktrees/transparent-card-rules`。說好 `/elder` 的畫面歸這邊，「傳給家人」按鈕合併後改去它的 `/line`，那一行由它改。

驗證：`python app/tests/run.py`（在 worktree 跑）node 80/80、瀏覽器 284/284（多一條長輩圖＝那張明信片）；Playwright 看過龍舟放大、櫻花、長輩圖（中秋版走路卡、金框限定版）。

## 20. 2026-09-27 照使用者的流程補齊：每一次來都收一張、首訪／里程紀念、相框與稱號、來回接送、一鍵 LINE（分支 `feat/flow-progress-rewards`）

使用者貼來一條流程，要整個專案照它走，並要求「把不確定的抽獎機制改成固定規則的透明機制：節日、里程、客製化相框、專屬稱號，讓它是可以用進度累積的而不是保底」：
長輩選定／被推薦景點 → yoxi 安全接送（去程＋候車待命＋回程）→ 抵達後於 100 m 範圍內步行探索 → 系統偵測定位，生成當次專屬明信片（保證獲得，非搶量）
→ 款式依規則決定（常態款／節慶限定／首訪紀念／里程紀念）→ 長輩一鍵分享至 LINE 給子女 → 子女按讚／留言 → 系統累積圖鑑進度（非機率保底），達成里程碑解鎖客製化獎勵。

對照前後（使用者選了「四個缺口都補；子女按讚留言與 LINE 做示意就好」「每次去都拿一張」）：

| 流程 | 之前 | 現在 |
|---|---|---|
| 選定／被推薦景點 | 有（今天的地方、探索、推播） | 不變 |
| 去程＋候車待命＋回程 | 只有單程 | 叫車可選「來回 · 司機等你」：去程 → 司機候車 → 回程 → 到家結算（ride.js） |
| 100 m 內步行探索 | 80 m 停 1 分鐘 | `ARRIVE_RADIUS_M` 100（`APP.explore.ARRIVE_RADIUS_M`，候車頁也讀它）；pitch/docs 的 80 m 同步改掉 |
| 當次專屬明信片、保證獲得 | 一個地方一張，再去沒有 | 每一次來都收一張（一天一張）；沒有限量、沒有搶先 |
| 款式依規則 | 季節畫風／金框、節日版、單趟 20 km 遠行戳 | 常態款（季節畫風／金框）、節慶限定（節日那一週）、首訪紀念戳、里程紀念戳（搭 yoxi 累積 30／60／100… km） |
| 一鍵分享至 LINE | 分享 → 長輩圖頁 → 傳送（3 下，沒寫 LINE） | 分享面板第一格「傳到 LINE 給家人」一鍵 → `/line`（示意） |
| 子女按讚／留言 | 沒有 | `/family/:id` 子女的手機：喜歡、快速回覆、打一句；長輩在 `/line` 與明信片頁看到（示意，只寫名字、沒有數字） |
| 進度累積解鎖客製化獎勵 | 只有獎章「收集 n/m」；§17 刻意不做進度換獎勵 | `/rewards` 八個相框、九個稱號，規則與 n/m 先寫好，湊到就收下、自己挑一個用（**同一天使用者拿掉了，見 §21**） |

§17 寫的「2 圖鑑進度條＋里程碑獎勵刻意不做」這次是使用者明確要做，照做；但守住原本的理由：沒有進度環與集點卡的倒數語氣（只寫 n/m）、稱號不比高低（沒有等級、沒有「第一」）、沒有限時。

**怎麼做的**（檔案歸屬見 `app/ARCHITECTURE.md` §1、§7）：
- **每一次來**（`explore-cards.js`）：第一次仍寫 STATE（圖鑑、獎章、去過的地方都只認它），第二次起記 `store.visits`（第 N 次、款式、節日、里程、那一句話、`via`、`seq`）。`canCollect` 一天一張（今天看 demo 的模擬日期）。`cardOrigin(cardId, v)`、`visits`、`recentVisits`（照 `seq`，不照時間：同一秒收兩張也分得出先後）、`rideKm`、`totalKm`。回訪不給限定版與 +50（點數只給第一次）。
- **首訪紀念、里程紀念**：`cardRule({ by, km, date, first, before })`。里程看「搭 yoxi 去收明信片的累積公里」跨過 `MILE_STEPS`，不看單趟（常搭短程的長輩也走得到）；一趟跨過兩個記大的；回程不收明信片，不算。demo 一開始 14.6 km，搭去內灣就跨過 30。
- **畫面**：/unlock 回訪寫「第 N 次來」、今天收過直接看今天那一張；地方頁收過的可以「再走過去一次」；明信片頁 `?v=` 與「每一次來」一排；收藏首頁頁首寫稱號、疊卡含回訪、「留下的距離」含回訪、一列「相框與稱號」入口。
- **相框與稱號**（已拿掉，見 §21；新檔 `album-rewards.js`／`.css`）：規則表 `REWARDS` 是唯一來源，進度全從收下的東西算（不另存）；`store.look`（pref）記選了哪個。相框全用 tokens 畫（竹塹、風城、老朋友、里程、春節、端午、中秋、櫻花），套在 `APP.album.cardHTML` 上（LINE 示意、子女那一頁、預覽）。
- **來回**（ride agent，`dccbe8a`／`53faf46`）：行程多 `waiting`／`returning`、`round`、`collected`、`backAt`；`waiting()`、`back()`、`roundFare()`。候車時在 /unlock 收下，收好回 /trip；「取消回程」＝不搭回程了，變成單程 done、卡照樣收得到。**假設**：`WAIT_MAX_MIN` 60 分、`WAIT_FEE` 100 元一趟（yoxi 沒有公開的來回產品與價格）；畫面只寫「司機最多等 60 分鐘」，沒有計時器、沒有倒數。/ride 選好下車點才出現「單程／來回」，同時收起只會 toast 的掃碼鈕（可按數仍 ≤ 10，單程的叫車步數不變）。來回的歷史記在新的 `store.rideRound['<卡>#<第幾次>']`（agent 原本塞在 `rideVia._round`，合併時改成獨立的鍵）。
- **LINE 與子女回應**（family agent，`a512058`；新檔 `album-family.js`／`.css`）：`APP.family.send／sendToLine／react／repliesHTML`；`store.shares`、`store.replies`。每一頁都標「示意」；子女那一端只看得到那一張，沒有地點、已讀、按讚數。

**要注意／還沒做的**：
- `/elder`（長輩圖頁）的「傳給家人」還是 toast：另一個 session 在改 /elder 的圖，約好合併到 main 之後再把它換成 `APP.family.sendToLine`（一行；`flows.spec` 的流程 C 那幾句要跟著改）。
- 簡報、影片、`pitch/BRIEF.md`、網站沒有寫到回訪、首訪／里程紀念、相框與稱號、來回接送：要不要寫進提案是提案的決定；pitch/docs 只同步了 100 m 與「一人一天一張」。`app/assets/shots/` 沒重拍。
- 週回顧、每日回顧、城市足跡只看第一次（STATE）；回訪沒算進「這一週去了幾個地方」。
- demo 一開始的 8 張卡日期沒有年份，一天一張對它們是比 `MM.DD`（明年同一天會被當成今天收過）。新收的都記了年月日。
- ~~`explore-fx.js` 檔頭還有一句「常見的款式輕、稀有的重」（舊的抽卡說法）~~：合併到 main 時改掉了（見 WORKLOG 的翻卡特效那一段）。

驗證：`python app/tests/run.py` node 106/106、瀏覽器 313/313；`check-sw.py` PASS（`chengshi-app-v21`）；Playwright 看過 /album、/rewards（選相框與稱號）、八種相框、/postcard ?v=2、/unlock 內灣（首訪＋里程 30 km）、規則說明、/place 回訪、/line、/family、分享面板、來回的每一段。`verify-quiet.py` 在這台 Mac 只跑得了 ②（PASS、三個變體與基準完全相同），其餘段落找不到 Chrome 略過；`prototype/` 沒動。

## 21. 2026-09-27 拿掉相框與稱號、收藏首頁真的一屏（分支 `feat/remove-rewards`）

使用者先要收藏首頁不捲，傾向把「相框與稱號」併進其中一個選項：`116882c` 把它併進獎章卡最底下一列。使用者看了還是要捲，
接著說「已經有獎章了，把相框跟稱號的功能整個刪掉」。

**還是要捲的原因**（`116882c` 量錯了）：測試 iframe 與 Playwright 用 390×844 開的是手機版，`--statusbar-h` 只有 12px；
使用者在桌機看的是手機外框，狀態列 54px（有瀏海的真手機也差不多），可視只剩 768px，內容 801px。
量「一屏」一律用桌機外框（`album.spec` 的那一條把 iframe 撐到 1280×720 再量）。

**拿掉了什麼**：`album-rewards.js`／`.css`、`rewards.spec.js`、`/rewards`、`APP.album.rewards／look／setLook／cardHTML／REWARDS`、
store 的 `look` 鍵（舊存檔裡的 `look` 載入時就丟掉）、收藏首頁頁首的稱號與獎章卡底的入口、家人頁寄件人旁的稱號；PRECACHE 少兩筆，VERSION v22。
**留下的**：明信片頁「每一次來」一排的樣式（原本寄住在 album-rewards.css）搬到 `album.css`；`/family`、`/line` 的明信片原本借 `cardHTML` 畫
「那一次」的卡，改成 `album-family.js` 的 `cardArt` 自己問 `APP.explore.cardOrigin`（第幾次、金框、首訪／里程戳、節日插畫；不套相框）。
里程紀念（`MILE_STEPS`、`rideKm`）與首訪紀念是明信片的款式，不是相框與稱號，照舊。

結果：桌機外框裡收藏首頁內容約 755px（可視 768），預設、回訪、0 張都不用捲。

驗證：`python app/tests/run.py` node 103/103、瀏覽器 308/308（少的是 rewards 的測試與 /rewards 這條 route）；`check-sw.py` PASS（`chengshi-app-v22`）；
Playwright（桌機 1512×860）看過 /album、/family、/line。`prototype/` 沒動。

