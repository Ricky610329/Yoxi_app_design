# yoxi 城事 — 設計原型

「城事」是提給 yoxi（和泰叫車）的一個提案：把叫車 app 變成一個**不搭車也會打開**的城市探索與收藏工具，
再把「發現一個地方 → 叫車去那裡」接回本業。這個 repo 是可以直接打開的 HTML 原型，
含三條 demo 流程、六十幾個變體、願景探索稿、以及第三輪的「真實質感」概念稿與好友系統 mock。

> 不用安裝任何東西。把 `prototype/index.html` 拖進 Chrome 就能看；全部離線（唯一例外見「已知限制」）。

## 三個最快的入口

| 想做什麼 | 打開 |
|---|---|
| 先看整體怎麼接進 yoxi | `prototype/proposal.html`：五步 roadmap、一軸一行的決策矩陣（問題／我們選／代價／什麼時候回頭看）、風險控制、還沒決定的事 |
| 看 demo、聽講稿 | `prototype/index.html` → 三條流程各有「開始導覽」，手機旁邊會出現講的人看的字幕列，鍵盤 ← → 翻頁 |
| 評估某個畫面、寫評語 | `prototype/overview.html`：整個系統的層級樹，點節點在右邊打分、寫評語（存在你的瀏覽器，右上「匯出評語」給我） |
| 看「真的會長怎樣」 | `prototype/concept.html`：真實新竹地圖的六種質感、單／雙地圖、微 3D、好友系統，附五張 1600×1000 概念板 |

其他兩頁：`prototype/variants.html`（依軸線分區的變體卡牆）、`prototype/vision.html`（願景探索稿）。

要接手開發（人或 AI agent）：先讀 `AGENTS.md`（規矩與慣例），再讀 `docs/HANDOFF.md`（架構、驗收、未決、下一步）與 `docs/WORKLOG.md`（每一筆 commit 做了什麼）。

## 三條 demo 流程

| 流程 | 要證明的事 |
|---|---|
| A 不搭車的日常 | 不搭車也玩得下去；AI 推薦有個人化依據；動機來自內容不是獎勵 |
| B 搭車的轉換 | 從發現到叫車只有一步，而且叫車主畫面一個像素都沒動 |
| C 晚上的回顧 | 一天的路變成明信片、日誌與週回顧；隱私分軌：只有你看得到的，跟你可以分享的 |

## 要守的設計紀律

- **紅色＝品牌情緒**（頁首、抽屜、地圖 pin、強調數字、logo）；**海軍藍＝你要按的東西**。新畫面不得破壞這個分工（`css/tokens.css` 檔尾）。
- **禁用詞**：任務／完成／達成／挑戰／每日。城事不是任務系統；沒有連續天數、沒有倒數、沒有限量、沒有排名、沒有未讀數字。
- **六條防護承諾**（叫車沒有變難用）：圖層關掉時 DOM 逐節點相同、叫車關鍵路徑 tap 數不變、收合態 sheet 0 像素改動、同時最多 4 個景點、不遮 pin／浮動鈕、上下車點 pin 與景點縮圖是兩套標記。全部可以當場重跑（見下方驗收）。
- 圓角只有六種、字級照 tokens；圖片目前是程式生成的示意圖（標「AI 生成示意」），正式版才換 AI 依地點生成。

## 變體：每條軸線是一個設計問題

| 軸線 | 變體 | 目前的推薦 |
|---|---|---|
| 地圖該歸誰？ | 0（現況兩張地圖）、A–F | E：景點常駐在叫車地圖上＋一鍵設為下車點 |
| 轉換點在哪？ | K1–K7（內容頁／地圖小卡／下雨才出現的推播／路線斷點／到了之後回程／限定版當理由／沒有轉換點的對照組），共用一張「下車點已填」的落點畫面 `variant-k-ride.html`（家→地方、地方→家、路線的一段三種進法） | K1 內容頁：設為下車點 |
| 城事從哪裡進？ | 候選 G、H（只有論述） | 未定 |
| 收藏怎麼被組織？ | S1–S5（時間牆／圖鑑缺口／路線書架／收藏即地圖／家人視角） | S3 路線書架 |
| 探索的主敘事？ | X1–X5（值得去的地方／缺口導向／路線主敘事／獎章三態／走路就會長） | X2 缺口導向 |
| 獎章怎麼呈現才不是任務？ | X4 三態（勳章牆／進度環／集點卡） | 勳章牆 |
| 好康任務要不要同頁？ | T1（兩態） | 刻意不選（對照組） |
| 畫面上要放多少東西？ | L1–L6（低認知負擔，以「可按數／到達步數」自動量測） | L1 一屏一事 |

願景探索稿（`vision.html`）：家人動向、大型活動、行程規劃、健康出行，各三種呈現，不在 demo 流程上。

## 第三輪：概念稿（`concept.html`）

- **地圖的質感**：`tools/fetch-map.py` 從 OpenStreetMap 抓新竹的真實幾何（離線資料在 `assets/map/`），`js/hsmap.js` 用同一份幾何、同一張色票畫六種底圖：紙感、夜間、插畫、微 3D、傾斜、霧化。景點圖釘、小卡、定位鈕原封不動，只換紙。
- **單地圖 vs 雙地圖**、**微 3D**、**真實圖磚對照**（Leaflet，需要網路）、**實景照片**（Wikimedia Commons CC 授權，出處在圖旁）。
- **好友系統**：好友列表、他的牆、寄明信片（挑一張自己收過的卡＋ 20 字小語）、信箱、AI 鄰居（初始好友，三處標示、可關）、推播。**沒有聊天、沒有語音、沒有未讀點、沒有數量與排名。**
- 五張概念板 PNG 在 `assets/boards/`，可以直接貼進簡報。

## 驗收與工具（需要 Python 3 ＋ Pillow ＋ Chrome）

```bash
python prototype/tools/verify-quiet.py      # 六條承諾、互動、全站（死按鈕／數字一致／禁用詞）、變體圍牆、層級樹、功能數
python prototype/tools/shoot.py             # 重拍全部縮圖（430×912）；--only <stem,...> 只拍幾張；--mini 產生小圖；--board 拍概念板
python prototype/tools/fetch-map.py --from-cache   # 從快取重新產生地圖資料（一次性抓取已做過；--dry-run 看大小）
python prototype/tools/fetch-photos.py --list      # 列 Commons 候選照片（下載要 --only <id,...>）
```

各稽核工具也可以直接在瀏覽器開（`tools/audit-*.html`）；`audit-app.html?scope=concept` 只跑概念稿。

## 檔案結構

```
prototype/
  index.html        demo 首頁（三條流程＋講稿＋四扇門）
  overview.html     層級樹＋評語（key 與 demo 狀態分開，重設 demo 不會清掉評語）
  variants.html     變體卡牆        vision.html   願景探索稿        concept.html  概念稿目錄
  screens/          所有畫面（主線、variant-*、vision-*、concept-*），每檔檔頭有中文註解說明設計理由
  js/               mock.js 假資料｜state.js 進度（localStorage）｜shell.js 共用零件｜interact.js 互動
                    catalog.js 畫面／流程／變體／願景／概念的單一登記表｜hsmap.js 地圖引擎｜photos.js 照片｜mock-friends.js 好友資料
  css/              tokens.css（色票、字級、圓角）｜base.css｜components.css（yoxi 既有）｜chengshi.css（城事新增）｜concept.css（只有概念稿載）
  assets/           thumbs/（縮圖）、map/（OSM 資料）、photos/（CC 照片＋credits.js）、boards/（概念板 PNG）、vendor/leaflet
  boards/           五張概念板的 HTML（1600×1000）
  tools/            驗收與截圖腳本（見上）
brain_strom.png     最初的腦力激盪圖
Yoxi_app截圖.zip    yoxi 現有 app 的截圖（還原用）
```

## 怎麼給評語

1. 開 `prototype/overview.html`，左邊樹找到畫面或變體，右邊按「好／待議／有問題」、1–5 分、寫一句話。
2. 全部寫完按右上「匯出評語」，把下載的 JSON 傳給我；匯入時會逐節點合併，不會蓋掉別人的。
3. 不想用樹：`variants.html` 每張卡右下「在樹上看」會跳到同一個節點。

## 怎麼加一張畫面或變體

1. 在 `js/shell.js` 的 `TABSETS／ROOTS` 登記（只有會換整組 tab 的變體才需要），`js/catalog.js` 的 `VARIANTS` 加一筆（`state:'planned'`），`tools/shoot.py` 的 `SHOTS` 與 `tools/audit-app.html` 的清單加 stem。
2. 建 `screens/variant-<key>-<頁>.html`，檔頭寫「回答什麼／動了什麼／刻意沒有的東西」。
3. `shoot.py --only <stem> --mini` 拍縮圖，`verify-quiet.py` 全綠後把 `state` 改成 `'built'`。
概念稿類的畫面用 `<body data-vision="…">`＋角標，就不進主線稽核；地圖一律走 `HSMAP.render()`，不要再手畫路網。

## 素材與授權

- 地圖資料 © OpenStreetMap 貢獻者，ODbL 1.0（每張地圖右下角都有署名；資料抓取日期在檔頭）。
- 實景照片來自 Wikimedia Commons，作者與授權在 `assets/photos/credits.js`，畫面上必須顯示。
- Leaflet 1.9.4（BSD-2，`assets/vendor/leaflet/LICENSE`）；圖磚頁使用 CARTO 與 Esri 的公開圖磚，僅供設計對照，不進 demo。
- 人物、地方故事、車資與時間都是原型虛構或公式算出來的示意值。

## 已知限制

- `screens/concept-map-tiles.html` 需要網路，其他全部離線。
- 微 3D 的建物高度七成八是推的（OSM 只有 21.7% 的建物有樓層數），只當畫法看，不當地標辨識。
- 明信片與插圖是程式生成示意；十張實景照片只覆蓋十個地點，其餘是站位框。
- 好友系統與 AI 鄰居是概念稿：AI 該不該回信、能不能寄給不在 app 的人，寫在 `boards/board-friends.html` 的「還沒決定」。
