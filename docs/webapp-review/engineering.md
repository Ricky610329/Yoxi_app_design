# yoxi 城事 web app — 工程審查（前端技術主管視角）

審查對象：`app/`（main，6124d55 之後、另一位 agent 正在改 `app/js/**` 的工作樹）。評架構與做法，不追單一行。

## 三句結論

1. 以「離線、`file://` 直接開、給評審走完三條 demo」為目標，這份 app 的取捨是對的，而且紀律少見地好：一份 341 行的契約（`app/ARCHITECTURE.md`）、公式集中在 `APP.fmt`、render 純函式加 mount 綁事件、錯誤卡不白畫面、179 條瀏覽器測試加 34 條單元測試。
2. 它是「可以接手的原型」，不是「可以延伸的產品骨架」：全域 `window.APP／STATE／MOCK`、字串拼 HTML、兩套 localStorage 狀態、demo 邏輯寫在產品畫面裡、執行期依賴 `../prototype`，這五件事上線前都要換掉，換的成本大約是重寫畫面層、保留契約與測試案例。
3. 測試策略的想法（把設計紀律寫成斷言）值得原樣帶走，但 harness 目前綁在「Windows＋本機 Chrome＋virtual time」上，本次實跑就有 3 條因環境而紅（Windows 關掉動畫效果 → `prefers-reduced-motion` 洩進測試），沒有 CI、沒有視覺回歸與 a11y 檢查。

## 評分表

| 面向 | 分數 | 一句理由 |
|---|---|---|
| 架構取捨 | 4 | 對原型目標完全合理，路由／view 註冊／listener 追蹤都有想過；但全域命名空間與對 prototype 的執行期依賴不可延伸。 |
| 狀態設計 | 3 | 讀取有容錯、trip phase 由時間推導很好；雙軌狀態、demo 種子資料混在使用者資料裡、無 schema 版本與遷移。 |
| 測試策略 | 4 | 覆蓋面與「設計紀律即測試」很強；可攜性、環境隔離、報表格式（無 JUnit）撐不起 CI。 |
| 安全健壯 | 3 | `esc` 紀律實際上守得住（抽查無漏）、有 XSS 與原型鏈 id 的回歸測試；但靠慣例不靠機制，SW 更新策略會讓使用者卡在舊版。 |
| 可讀性與文件 | 4 | 契約、中文檔頭（回答什麼／來源／刻意沒有）、README 三條 demo 都到位；單檔 580–1082 行、幾處註解已過時。 |
| 上線距離 | 2 | 沒有後端邊界、帳號、真實定位與推播、i18n、型別、建置與部署；這是原型本來就不做的，但距離是真的。 |

## 做得對的

1. **契約先行，而且真的被遵守。** `app/ARCHITECTURE.md` §3 的 API、§4 的 DOM 契約、§7 的「誰動哪些檔」與跨區塊函式（`APP.ride.setDropoff`、`APP.explore.collect`、`APP.ui.push`）讓四個區塊能並行開發；四支 views 都只透過 `APP.view()` 註冊（album 7、explore 7、ride 9、system 2，共 25 條，對得上 §8 路由表）。
2. **路由核心的細節處理很成熟。** `app/js/app.js` 的 `route()`：舊 view cleanup → render（純字串）→ decorate → mount → 轉場 → `data-view-ready`；render／mount 丟例外換 `errorCard()` 並寫進 `#app-errors`（L518–L573）。`trackListeners()`（L595）在 mount 期間暫時包住 `addEventListener`，離頁自動拆掉 `INTERACT.initPan` 等掛在 window 的 listener；`backPending`（L350）擋返回連按退出 app。這些都是實際踩過才會寫的。
3. **讀取容錯與不可信輸入有防線。** `load()`（L61–L81）跟預設合併、`tabPaths` 只收 `/` 開頭字串、壞 JSON／私密視窗／存取即丟錯都退回預設，且有對應單元測試（`tests/unit/store.test.mjs`）。`knownId()` 用 `hasOwnProperty` 擋 `/place/constructor`；`phaseOf()`（ride.js L108）從 `startedAt` 推導 phase，不靠 setTimeout 時序，重整也對。
4. **「數字不手寫」落成機制。** `APP.fmt` 集中車資／分鐘／距離公式，`fmt.fixText()`（L136）甚至把 MOCK 敘事裡手寫的「搭車 42 分鐘」換成公式值；flows spec 的「審查 8」「QA 1」驗同一地點在五個畫面車資一致。
5. **設計紀律寫成可執行的斷言。** `harness.js` 的 `noDeadButtons`、`noBannedWords`、`countTappables`、`noHardcodedHex`，把提案的產品承諾（L1 一屏一事、無禁用詞、顏色紀律）變成回歸測試，這在一般團隊是靠 review 口頭維持的。

## 問題

### 接手前要處理

| 問題 | 位置 | 影響 | 建議 |
|---|---|---|---|
| 測試受作業系統設定影響 | `app.js` `isStill()` 讀 `prefers-reduced-motion`；`run.py` 未固定 | 本機（Windows 關閉動畫效果）實跑 176/179，「流程 C 非 still」「QA 8」因 reduced-motion 被當成 still 而紅；結果依機器而變 | harness 啟動 Chrome 時加 `--force-prefers-reduced-motion=0`（或在 iframe 以 `APP.reduceMotion` 注入覆寫），測 reduce 的案例再顯式打開 |
| SW 的 VERSION 寫在兩處 | `sw.js` L19 與 `views/system.js` L23 | 改了一處忘了另一處，設定頁顯示的版本與實際快取不符；`check-sw.py` 不檢查 | 單一來源（`app/version.js` 或由 check-sw 比對兩處） |
| 註解與事實不符 | `prototype/js/hsmap.js` 檔頭「主線畫面不載」、`STATE.collect` 預設日期 `'09.21'` | 下一位會被誤導；直接呼叫 `STATE.collect` 不帶 date 會寫死日期 | 更新檔頭；app 側統一經 `APP.explore.collect` 寫入 |
| 繞過 API 改 STATE | `views/system.js` `wipeFootprint()` 直接改 `STATE.all` 再用 `setToday()` 觸發 save | 依賴「all 是活物件」這個實作細節，STATE 換實作就壞 | 在 app 側包一層 `APP.state.clear()`，或允許 app 內有自己的 state 模組（見下） |

### 上線前

| 問題 | 位置 | 影響 | 建議 |
|---|---|---|---|
| 全域命名空間與載入順序相依 | `index.html` 15 支 `<script>`；`shell.js` 在 DOMContentLoaded 自己插狀態列 | 隱性耦合：app 依賴 shell 先註冊 listener；無法 tree-shake、無法型別檢查、無法做 code split | 換 ES module＋Vite（或同等）建置；`file://` 需求改由「建置後單檔」或本機 server 滿足 |
| 執行期依賴 `../prototype` | CSS 4 支、JS 11 支從 prototype 載入 | 部署必須連 prototype 整個目錄一起上；prototype 的任何修改會靜默改變 app；`SHELL` 948 行裡有大量 app 用不到的變體邏輯 | 把 tokens、元件 CSS、icons、hsmap 抽成 `packages/ui`（版本化），app 只依賴它；prototype 留作設計參考，不當執行期相依 |
| 雙軌狀態、demo 種子混入真實資料 | `STATE.fresh()` 內建 8 張卡與 48 km；`APP.store` 另一把 key | 無法區分「使用者的」與「demo 的」；兩把 key 各自 save，跨鍵寫入（collect 同時動 STATE 與 store.trip）非原子 | 單一 store（分 slice），加 `schemaVersion` 與 migrate；demo 種子改成 fixture，只在 demo 模式注入 |
| 無資料驗證 | `load()` 只驗 `tabPaths`、`pushes`；`dropoff`、`trip` 形狀不驗；STATE 淺合併 | 舊版或損壞的 `trip`（例如 `km` 為字串）會一路流到公式與畫面 | 每個 slice 一個 validator（zod 或手寫 guard），不合法就丟棄該 slice |
| 字串拼 HTML、esc 靠自律 | 四支 views 共約 216 處 `esc(`；`innerHTML` 賦值 11 處 | 目前抽查沒漏（使用者輸入的明信片一句話有 esc 與回歸測試），但規模一大一定會漏一處；無法用 CSP 保護（`index.html` 有 inline script、tabbar 有 inline style） | 換框架（Preact／Lit／Svelte 其一）用預設跳脫的模板；過渡期可先寫 `html\`\`` tagged template 自動 esc，並加 lint 規則禁止裸 `innerHTML =` |
| SW cache-first 讓使用者卡舊版 | `sw.js` fetch：清單內永遠 cache 命中，含 `index.html` | 內容改了但 VERSION 沒加一，已安裝的人永遠拿舊檔；`skipWaiting＋clients.claim` 會讓開著的頁面半新半舊 | 建置產生內容雜湊檔名與自動 VERSION；`index.html` 改 network-first；新版就緒時提示重整，而不是強制接管 |
| demo 功能寫在產品畫面 | `/trip` 的「模擬抵達」按鈕、`arrivedDemo`、`#demo-panel` | 上線要逐頁拆，容易留下後門（手打網址拿 +50 已有擋，但類似邏輯會一再出現） | demo 改為 feature flag 包住的獨立模組，產品 bundle 不含 |
| 測試跑不上 CI | `run.py` `BROWSERS` 只列 Windows 路徑與三個 which 名；Linux 容器需 `--no-sandbox`；結果只有一段 JSON | 在 GitHub Actions（Linux）上找不到 `google-chrome-stable`／`chromium-browser`；一次崩潰全部結果都拿不到；無 JUnit 報表 | 瀏覽器層改 Playwright（跨平台、自帶瀏覽器、trace、截圖）；規格可以幾乎原樣搬，`t.noDeadButtons` 等改寫成 helper |
| 效能與體積 | 同步載入約 470 KB JS，其中地圖資料 378 KB（`hs-core.js`、`hs-wide.js`） | 首屏在中階 Android 上會卡；「首屏 3 秒」測試跑在 virtual time 裡，量不到真實時間 | 地圖資料改 JSON＋按需載入（或向量圖磚）；加 Lighthouse CI 預算 |

### 以後

| 問題 | 位置 | 影響 | 建議 |
|---|---|---|---|
| 單檔過大 | `ride.js` 1082、`explore.js` 1044、`album.js` 1025 行 | 目前結構清楚（資料 → render → mount → 註冊），但多人同改一支會衝突 | 一個 view 一個檔，區塊共用函式放 `ride/shared.js` |
| 無 i18n | 文案全部寫在 render 字串裡 | 英文或台語版要全面翻修 | 抽成 message catalog；禁用詞稽核改掃 catalog＋渲染結果 |
| 無 a11y 自動檢查 | 已有 `aria-label`、`aria-current`，但沒有系統化 | 焦點管理（換頁後焦點落點、modal focus trap）未測 | axe-core 加進 Playwright；換頁後把焦點移到 `h1` |
| 無視覺回歸 | `tools/shoot-app.py` 只拍圖不比對 | 顏色、圓角紀律只靠 hex 掃描 | Playwright `toHaveScreenshot` 以 25 條 route 為基準 |

## 狀態：換成後端時邊界怎麼切

| 資料 | 現在 | 伺服器真相 | 裝置狀態 |
|---|---|---|---|
| 收藏的明信片、點數明細、獎章 | STATE `cards`（點數由 `by==='ride'` 推導） | 是。點數必須由行程紀錄在伺服器端推導，前端不能自報 | 只快取 |
| 行程 `trip`（phase、startedAt、km） | `APP.store.trip`，phase 由時間推導 | 是（派車系統的行程狀態機，含取消、改目的地） | 只存 tripId 與樂觀 UI |
| 下車點 `dropoff` | `APP.store.dropoff` | 送出叫車時才成為伺服器資料 | 是（草稿） |
| 地點、路線、故事、車資公式 | `MOCK`、`APP.fmt` | 是（CMS＋報價 API；車資公式不應留在前端） | 快取 |
| 推播紀錄 `pushes`、上限兩則 | `APP.store.pushes` | 是（排程與頻率上限要在伺服器端守） | 否 |
| 一天的回顧的心情、照片、日誌 | STATE `today` | 視隱私設計：預設只在裝置，或端對端加密同步 | 是 |
| onboarded、tabPaths、設定開關 | store／STATE | 設定要同步；tabPaths 不用 | 是 |

「抵達」目前是 demo 按鈕；上線要換成定位驗證（契約 §5 寫的 80 公尺內停 1 分鐘），而收卡與 +50 點要由伺服器驗證抵達事件後發放，否則就是可刷點的漏洞。

## 上線工作清單

| 項目 | 必要度 | 規模 | 依賴 |
|---|---|---|---|
| 建置工具＋ES module（Vite），保留 hash 路由或換 history 路由 | 必要 | M | — |
| 抽出 `packages/ui`（tokens、元件 CSS、icons、hsmap），斷開 `../prototype` | 必要 | M | 建置 |
| 選定畫面層框架，用預設跳脫模板重寫 25 條 route 的 render | 必要 | L | 建置、ui 套件 |
| 單一狀態 store＋schema 版本＋驗證＋遷移；demo 種子改 fixture | 必要 | M | 建置 |
| API 客戶端與後端邊界（收藏、行程、點數、內容 CMS、報價） | 必要 | L | 後端 |
| 帳號與登入（沿用 yoxi 既有帳號） | 必要 | M | 後端、yoxi 端 |
| 真實定位抵達驗證、真實推播（Web Push 或原生殼） | 必要 | L | 後端、隱私審查 |
| demo 工具移到 feature flag，產品 bundle 不含 | 必要 | S | 建置 |
| SW 改用 Workbox 或雜湊檔名，`index.html` network-first，更新提示 | 必要 | S | 建置 |
| CSP、移除 inline script／style | 必要 | S | 建置 |
| 測試搬到 Playwright（保留紀律斷言），跑在 Linux CI | 必要 | M | 建置 |
| TypeScript（至少 store、API、fmt） | 建議 | M | 建置 |
| 地圖資料按需載入或圖磚、Lighthouse 預算 | 建議 | M | ui 套件 |
| axe-core a11y 檢查、換頁焦點管理 | 建議 | S | Playwright |
| 視覺回歸（25 條 route 基準圖） | 建議 | S | Playwright |
| 錯誤回報（Sentry 類）接 `reportError()` | 建議 | S | — |
| i18n message catalog | 以後 | M | 框架 |
| view 檔拆分（一 view 一檔） | 以後 | S | 框架 |

## 證據

**讀過的檔**：`app/ARCHITECTURE.md`（全篇）、`app/README.md`、`app/tests/README.md`、`app/js/app.js`（全篇）、`app/js/views/{ride,explore,album,system}.js`（檔頭、view 註冊、trip 生命週期、collect、wipeFootprint、innerHTML 與 esc 用法）、`app/tests/harness.js`（結構）、`app/tests/run.py`（全篇）、`app/tests/specs/flows.spec.js`（檔頭與測試清單）、`app/tests/unit/helpers.mjs`、`app/sw.js`、`app/manifest.webmanifest`、`app/index.html`、`app/tools/check-sw.py`、`prototype/js/state.js`（全篇）、`prototype/js/shell.js`（檔頭與 `mount()`）、`prototype/js/hsmap.js`（檔頭）。

**統計**：`wc -l` — app.js 908、ride.js 1082、explore.js 1044、album.js 1025、system.js 580、harness.js 571、flows.spec.js 853（審查時另一位 agent 正在加測試）、ARCHITECTURE.md 341。`APP.view(` — album 7、explore 8（含檔頭註解 1）、ride 9、system 2。`innerHTML` — app.js 6、views 合計 11。`esc(` — views 合計 216。`t.test(` — 瀏覽器 spec 117 處（單元測試用 node:test 的 `test(`，不在此計數）。prototype 執行期相依 JS 約 470 KB，其中地圖資料 378 KB。repo 內沒有 `.github/` CI 設定。

**跑過的指令**：
- `python app/tests/run.py --unit` → node 單元測試 34/34 PASS（約 0.1 秒）。
- `python app/tools/check-sw.py` → 43 筆，PASS。
- `python app/tests/run.py --browser` → 176/179，約 11 秒；紅的是 flows 的「流程 C 非 still」「QA 3 桌機縮放」「QA 8 減少動態效果」。查證本機 Windows 的用戶端動畫設定為關閉（`SPI_GETCLIENTAREAANIMATION = False`），Chrome 因此回報 `prefers-reduced-motion: reduce`，可解釋「C」與「QA 8」；「QA 3」可能與另一位 agent 的修改有關，不作定論。
