# yoxi 城事 web app — 架構契約

這份文件是 `app/` 的單一契約。並行做各區塊的人（或 agent）只讀這份就能開工；
改了契約要先改這裡。人看的說明在 `app/README.md`（做完再寫）。

## 0. 這是什麼、選了哪一版

`prototype/` 是 102 張各自獨立的 HTML 設計原型；`app/` 是把其中**一組決定**做成一個真的能用的
單頁 web app（hash 路由、狀態持久、可安裝 PWA），手機直接開、桌機看得到手機外框。

目前主畫面是「**雙主頁第一版**」：底欄只顯示 `#/ride` 與 `#/album`。`#/ride` 的面板頂端以變體 F 的 pill 切換「搭車／探索」，預設搭車；探索使用 `#/ride?mode=explore`，選定地區再加 `&area=<地點 id>`。`/explore` 等舊路由仍保留供舊連結與流程對照；`/place/:id` 不在新 UI 的地點選擇路徑中。

以下是原「合一版」的資料與流程決定；新主畫面沿用其中的地圖、卡片狀態和叫車流程：

| 軸線 | 選 | 在 app 裡長什麼樣 |
|---|---|---|
| 入口 | 底欄雙主頁（叫車／收藏） | `#/ride`、`#/album`；探索舊路由保留作深連結對照 |
| 地圖歸誰 | **F＋E** 同頁切模式 | 叫車首頁是真實新竹地圖（`HSMAP` paper）；搭車不顯示景點，探索同時最多 **4** 個景點，可設為下車點 |
| 轉換點 | **K1** 內容頁設為下車點 | 地方詳情：走得到（≤ 3 km）主要動作「走路前往」、次要「設為下車點」；走不到主次對調。門檻統一 **3 km**（`APP.fmt.WALK_MAX_M`） |
| 收藏組織 | 摘要式首頁 | 「我的明信片」主卡（張數＋最近三張疊卡，點了進 `/postcards`，收下的每一格都點得進詳情）、兩張統計卡（「去過的地方」＝不重複的地點數）、「回顧」一列（今天的回顧 → `/lookback`、這一週 → `/week`、城市足跡 → `/footprint`）、獎章精選卡 |
| 獎章呈現 | **X4** 勳章牆（六角金屬章，章面是地標線稿） | 首頁放大最近收下的一枚＋一列小章＋「顯示全部」→ `/badges` 三欄章牆；沒有進度環、沒有集點卡；還在路上的寫「收集 4/8」 |
| 探索敘事 | **X2** 缺口導向 | 頂部仍是「今天的地方」一張大卡；下面是「你還沒有 ○○ 類」的缺口區塊、這個月的路線、還沒去的地方 |
| 認知負擔 | **L1** 一屏一事 | 每個畫面可按的東西 ≤ 10，`/explore`／`/album` 索引頁 ≤ 12（`tools/audit-load.html` 的量法） |
| 儀式 | 抵達 → 收集 → 抽卡 | 夜色地圖上這個地方亮起光柱 → 點它出「收集明信片」→ 卡背蓄力、翻開（特效照稀有度分級，金框最重）→ 結果（只寫畫風名，不寫機率，也不寫「必得」；機率只在「?」裡）；點畫面可快轉、鍵盤有「跳過動畫」，抽完焦點停在「抽到 ○○」；減少動態效果時直接看結果 |
| 家人 | 分享選項 | 長輩圖在分享面板第一格；沒有「家人模式」 |
| 好康任務 | 不同頁 | 原封不動，不合併 |
| 好友 | 不做 | 五個未決還在，不進 app |

app 比原型多出來的東西（原型是一疊畫面，app 要能走完一圈）：
- 叫車真的會「叫」：下車點填好 → 叫車 → 配對中 → 行程中（含「這條路上」內容卡）→ 行程完成 → 評分後金色橫幅 → 限定版解鎖 → 點數 +50。
- 設定下車地點頁（`#/dropoff`）：清單＋搜尋，資料全部來自 `MOCK`。
- 第一次開的 onboarding（三張，可略過）。
- 推播是 app 內的浮層（早／晚各一則，一天最多兩則），由 demo 工具觸發。
- demo 工具：桌機在手機外框旁邊一條面板；手機在「設定 → demo 工具」。桌機面板：早上推播、晚上推播、模擬抵達（地點下拉選單＋「走路抵達」「搭 yoxi 抵達」，任何一頁都能按；地點預設跟著這一頁）、重設。設定頁的模擬抵達仍只在前往中／行程中出現。

### 雙主頁的叫車面板

- `#/ride` 預設是一般搭車地圖與叫車欄位；搭車面板跟探索一樣上下拉：往下拉收到只剩拉把（整張地圖露出來），往上拉或點拉把回到叫車欄位，拖曳時跟手、放開後接續動畫。面板頂端的「探索」切到 `#/ride?mode=explore`，地圖顯示四個附近地點，並依 `APP.place(id).dist` 預選最近的地區。探索面板收合態用一張精簡地點卡顯示名稱、短句、距離與步行分鐘，動作是「用 yoxi」及「收集」；上拉或點「收集」時保留完整地點卡與兩個動作，卡片堆接在下方，內容過長可捲動。點卡片開啟可翻面的懸浮小卡，不進地點詳情頁。地區只從地圖圖釘切換，不另設附近地區清單。選點後網址寫成 `#/ride?mode=explore&area=<地點 id>`；往下拉只收合面板，仍留在探索。探索面板有三段：展開（卡片）／收合（地點卡）／只剩拉把。兩個模式的地圖都一開始就畫成最大可見高度、貼齊上緣，面板收放不縮放地圖；定位鈕與地圖署名跟著貼到可見範圍底邊（`ride.js` 的 `mountFullMap`／`bindDragSheet`）。從地圖點選會把面板帶回收合態（只剩拉把時也會叫回來）；切回「搭車」清除探索 query。
- 手勢與可及性（2026-09-25 review）：拉把是 `<button class="sheet__grip" data-act="toggle-sheet" aria-expanded>`，44 px 高（面板 padding-top 0，只剩拉把時高 44）；移動 ≤ 8 px 算點一下，超過就照拖的方向（加放手速度）換段；只認主要指標的左鍵、`setPointerCapture`，失焦或 `lostpointercapture` 就作廢回原段；拖曳一開始就拿掉 `is-collapsed`，卡片堆跟著手長出來。視窗改大小（ResizeObserver＋resize）整張地圖重畫。探索模式的上車點只留 pin、不畫地址標籤；地點卡的標籤是「今天的地方／離你最近／你選的地方」（照 `MOCK.TODAY`）。懸浮小卡掛在 `.device`（`data-overlay`），用 `APP.ui.a11yDialog`。已經有下車點時不放「機場接送」（可按數）。
- 四組展示對應：`glass-kiln → p11,p17`、`market → p1,p2,p7,p20`、`moat → p3,p19`、`hill → p6,p21`。群組只定義卡片歸屬，收集與公里數仍由 `STATE`／`MOCK`／`APP.fmt` 計算；卡片不連地點詳情。
- 舊 `/place/:id`、探索與回顧路由仍能直接開啟，供既有資料和流程對照；新底欄和叫車卡片面板不導向它們。

## 1. 檔案配置

```
app/
  index.html                單一入口。載入順序見 §2
  manifest.webmanifest      PWA
  sw.js                     service worker：只在 http(s) 註冊；file:// 下安靜略過
  ARCHITECTURE.md           本文件
  README.md                 人看的：怎麼開、怎麼裝、怎麼測、選了什麼
  css/app.css               核心：桌機外框／手機滿版、轉場、tabbar、demo 面板、hsmap 需要的規則
  css/views/{system,ride,explore,album}.css   各區塊自己的樣式（各區塊 agent 只動自己那支）
  js/app.js                 核心：window.APP（router、view registry、store、fmt、nav、ui、map）
  js/views/system.js        設定、onboarding、推播浮層、demo 工具、分享
  js/views/ride.js          叫車首頁（E）、下車地點、上車地點、配對／行程中／行程完成、抽屜、點數、通知
  js/views/explore-fx.js    explore 的特效工具 APP.fx（粒子、震動、停格、閃光、合成音效、卡面畫風濾鏡）；在 explore-cards.js 之前載入
  js/views/explore-cards.js 明信片怎麼拿到的（DRAW_STYLES、drawStyle、openOdds、cardStyleOf、collect、cardOrigin）
  js/views/explore-face.js  明信片長什麼樣（cardFace、postcardSrc、POSTCARD_GEN、cardPhoto、paintCardArt；監看 .device 自動疊上收下的那一款）
  js/views/explore-gold.js  金框明信片的金粉（APP.fx.gold）：畫面上標了 data-gold-aura 的金框卡，邊緣一直散出金粉，捲動、拖面板、換頁時帶著慣性跟著飄
  js/views/explore.js       探索（X2）、探索地圖、地方詳情（K1）、前往中、路線列表／詳情
  js/views/explore-unlock.js 抵達與抽卡（/unlock）
  js/views/album.js         收藏（摘要式＋X4 六角章）、明信片子頁、全部獎章、明信片、獎章、城市足跡、每日回顧、週回顧、長輩圖
  assets/icons/             PWA 圖示（Pillow 產生；不連網）
  assets/postcards/         明信片五款的成品（<明信片 id>-<款式>.jpg，480×640；目前 p1–p11，清單在 explore-face.js 的 POSTCARD_GEN）＋ index.json（底圖、提示詞、種子）；不進 sw 預先快取，由 sw 在執行期 cache-first 存（看過一次離線也有），載不到時卡面退回照片＋SVG 濾鏡
  tools/serve.py            本機靜態伺服器（測 PWA 用）
  tools/make-icons.py       產生 PWA 圖示
  tools/gen-postcards.py    生成明信片成品：實景照片 → Stable Diffusion img2img＋ControlNet（本機跑，環境見檔頭）
  tests/run.py              測試總入口（node 單元測試 ＋ headless Chrome 瀏覽器測試）
  tests/runner.html         瀏覽器端測試跑者（iframe 載入 index.html）
  tests/harness.js          瀏覽器端測試 API（T／app）
  tests/specs/*.spec.js     各區塊的瀏覽器測試
  tests/unit/*.test.mjs     node 單元測試（router、fmt、store、place、views；helpers 的 loadApp({ views, now }) 載真的 mock／state 與 views 檔）
```

**不動 `prototype/`。** 全部只讀。需要共用的東西從 `../prototype/...` 載入；
需要的新邏輯寫在 `app/`。

## 2. 載入順序（index.html）

```
css: ../prototype/css/tokens.css → base.css → components.css → chengshi.css
     → css/app.css → css/views/system.css → ride.css → explore.css → album.css
js:  ../prototype/js/icons.js → mock.js → state.js → shell.js → interact.js
     → ../prototype/assets/map/hs-core.js → hs-wide.js → hs-places.js → ../prototype/js/hsmap.js
     → ../prototype/assets/photos/credits.js → ../prototype/js/photos.js
     → js/app.js → js/views/system.js → ride.js → explore-fx.js → explore-cards.js → explore-face.js → explore-gold.js → explore.js → explore-unlock.js → album.js
```
傳統 `<script>`，不用 ES module（file:// 會被 CORS 擋）。`APP.start()` 在 DOMContentLoaded 之後才跑，
所以四支 views 在它之前都已註冊完。`concept.css` 不載；`hsmap` 需要的規則（`.hsmap-*`、署名）由 `app.css` 自備。

既有 `shell.js` 在 DOMContentLoaded 會把狀態列插進 `.device__screen`（沿用），body 沒有 `data-tab` 所以它不會插 tab bar；
tab bar 由 app 自己畫。`shell.js` 的連結改寫只碰 `.html` 結尾的 href，app 全用 `#/…`，互不干擾。
`interact.js` 的 `boot()` 只綁當時存在的元素，所以 view `mount()` 之後要自己呼叫 `INTERACT.initSheet／initPan／initPills／initSwitches`。
（例外：core 在 render 之後、mount 之前已經對 `main.view` 做了 `SHELL.injectArt`、`SHELL.injectIcons`，並把 `[data-toast]` 綁成 `element.onclick` → `APP.ui.toast`；
不要再呼叫 `INTERACT.initToasts()`，它用 addEventListener 綁全頁，會重複綁。）
`photos.js` 用路徑猜照片目錄，猜不到 `app/`，所以 index.html 在它之前設 `window.PHOTOS_BASE = '../prototype/assets/photos/'`。

## 3. 核心 API（`window.APP`，由 `js/app.js` 提供）

### 3.1 註冊畫面
```js
APP.view('place', {
  path: '/place/:id',            // 或 ['/place/:id', '/place']；:id 進 params
  tab: 'explore',                // 'ride' | 'explore' | 'album' | null（null＝不顯示 tab bar，全螢幕流程）
  status: 'light',               // 狀態列字色：'light'（在紅／深底上）| 'dark'
  title: p => '地方詳情',        // 字串或函式；document.title = `${title} — yoxi 城事`
  root: false,                   // true＝tab 根（back 不會離開 app）
  render(params, ctx) { return `<header …>…`; },   // 純函式，回 HTML 字串，不碰 DOM
  mount(root, params, ctx) { … return () => cleanup; },  // 綁事件（element.onclick）、跑 INTERACT.init*、畫地圖
});
```
`ctx` = `{ query: URLSearchParams, from: 上一個 path（含 ?query）或 null, state: STATE, store: APP.store, path, pattern }`。
render／mount 丟例外時畫面換成錯誤卡（`[data-app-error]`）、錯誤寫進 `<pre id="app-errors" hidden>`，不會白畫面。
還沒被註冊的 §8 path 顯示「尚未建檔：<path>」卡（view 名 `_placeholder`，tab 照 §8）；§8 以外的 path 是 `_404`。
`render` 出來的第一層會被包在 `<main class="view" data-view="place">` 裡，放進 `#view`。
每次導覽：舊 view 的 cleanup → `html[data-view-ready]` 移除 → 新 view render＋mount → 轉場 → `html[data-view-ready="1"]`。
首屏完成後 `html[data-app-ready="1"]`。
其他選項：`remember: false`＝不把這條路由記進 `tabPaths`（暫時的畫面，例 `/drawer`）。`tab: 'explore'` 的舊路由歸在叫車底下：底欄亮「叫車」、位置記在 `tabPaths.ride`。

### 3.2 導覽
```js
APP.nav.go('/place/glass-kiln');            // push
APP.nav.go('/ride', { replace: true });
APP.nav.back('/explore');                   // 有歷史就 history.back()，沒有就 go(fallback, {replace:true})
APP.nav.current();                          // { path:'/place/glass-kiln', pattern:'/place/:id', params:{id}, query, name, tab }
APP.nav.go('/trip', { dir:'back' });        // dir 可覆寫轉場：'push'|'back'|'tab'|'none'
```
前進／返回靠 `history.state.i`（app 自己蓋的序號）判斷；`nav.back` 在序號 > 0 時才 `history.back()`，否則 replace 到 fallback。
每一筆歷史的 `history.state` 還記著它的來歷：`prev`（上一筆的網址）、`via`（`push`＝nav.go、`link`＝點 `<a href="#/…">`、`tab`＝切底欄、`up`＝nav.up 換上來的上一層）；
replace 這一筆不動 prev 與 via。重新整理之後照樣在（history.state 會留著）。
```js
APP.nav.prev()                                  // 上一筆：{ hash, path, pattern, name, tab }，沒有（第一筆、深連結）就 null
APP.nav.up('/postcards')                        // 回邏輯上的上一層：上一筆就是來處而且 backIf 說好 → history.back()；不然就地換成 parent（via up）
APP.nav.up('/ride', { backIf: p => p.path === '/ride', dir: 'none' })   // backIf 預設：上一筆是有底欄的一般頁、而且不是這一頁
APP.nav.upAction(opt)                           // nav.up 會怎麼走（'back'|'replace'），不導覽
```
「上一筆不是來處」的一律就地換：沒有上一筆（深連結、第一筆）、這一筆是切底欄停回來的（via tab）、是 nav.up 換上來的（via up）、上一筆跟這一頁同一個網址。
`nav.tab(id)`：已經在該 tab 時回到該 tab 的根，否則回到 `tabPaths[id]`。除錯用：`APP.resolve(path)`、`APP.routes()`、`APP.PLANNED`。
連結寫 `<a href="#/place/glass-kiln">` 就會走 router；返回鍵寫 `<a href="#" data-back="/explore">`（router 攔 data-back，照歷史退一格）；
子頁的返回鍵再加 `data-up`（`<a href="#" data-back="/postcards" data-up>`）＝ `APP.nav.up('/postcards')`，用預設規則回上一層。
tab 切換：`APP.nav.tab('album')` 記住各 tab 最後停的 path（切回來還在同一頁）。
頁內狀態（例：收藏的 pill）要寫回網址時用 `APP.nav.replaceQuery('tab=journal')`：只換目前這頁的 query，不重畫、不新增歷史，同步 `current()` 與 `tabPaths`（切 tab 再回來停在同一段）。不要自己呼叫 `history.replaceState`，router 看不到。
mount 期間掛在 `window`／`document` 上的 listener（例：`INTERACT.initSheet／initPan`）由 router 記下，離開該頁時自動移除。
轉場：push 從右滑入、back 從左滑回、tab 切換淡入；`html[data-still]` 或 `?still=1` 時關動畫。
- `nav.go` 的目標跟目前網址相同時一律 replace（不然退回那一筆只有 popstate、沒有 hashchange，要按兩次返回）；網址沒變的 popstate 用 `state.i` 對齊序號。
- 每次導覽一開始呼叫 `APP.ui.dismissOverlays()`（§3.5）。
- 導覽完焦點移到新畫面第一個 `h1`（加 `tabindex=-1`、`[data-nav-focus]`，不畫外框），沒有就放 `main`；mount 自己放了焦點、或焦點在對話框／浮層／demo 面板裡時不搶。
- 這次載入的第一個 route 是不帶 query 的 `/ride` 或 `/album`、而且還沒看過 onboarding → 先去 `/welcome`（裝成 app 從主畫面開也看得到介紹）。

### 3.3 狀態
- 收藏／獎章／路線／點數／設定：**沿用 `STATE`**（`../prototype/js/state.js`，localStorage `yoxi-chengshi-v1-2`）。
  新收的卡日期用 `APP.fmt.todayMMDD()`，不再寫死 09.21。
  **讀**直接讀 `STATE`（`has`、`card`、`count`、`all`、`badge`…）；**寫**一律經過 app.js 的 `APP.state`（state.js 是 prototype 的檔，app 不改它）：
  ```js
  APP.state.collect(id, opt)    // 只有 APP.explore.collect 用（它決定搭車或走路、款式、公里）
  APP.state.setToday(patch)     APP.state.setSetting(k, v)     APP.state.markLastSeen()
  APP.state.reset()             // 回到 demo 初始（8 張）
  APP.state.wipe()              // 清除我的足跡的 STATE 那一半：明信片、公里、日誌清空（哪些欄位算足跡只寫在這裡）；settings 留著
  APP.state.batch(fn)           // 一串寫入（可以夾著 APP.store）寫完才發一次 state:change；回傳 fn 的結果
  ```
  每一次寫都自己 `emit('state:change')`（在 batch 裡就等 batch 結束），呼叫的人不用配對。
- app 自己的狀態：`APP.store`（localStorage `yoxi-chengshi-app-v1`）
  ```js
  APP.store.get('dropoff')            // 讀
  APP.store.set('dropoff', {...})     // 寫＋save＋emit('store:change', {key})
  APP.store.patch({ a:1, b:2 })
  APP.store.reset()                   // 只清 app 狀態；STATE 那一半是 APP.state.reset()
  APP.store.clear('footprint')        // 一類鍵回到預設（清除我的足跡）；偏好與不認得的鍵不動，回傳清了哪些鍵
  APP.store.all                       // 整個物件（唯讀用）；APP.store.reload() 重新讀 localStorage
  ```
  `tabPaths` 由 router 安靜寫入（不 emit）。
  鍵、型別、類別都在 app.js 的 `KEYS` 表（一把鍵一行：預設值、型別、類別；`fresh()` 從它產生）。**新增一把鍵只改 `KEYS`**（加這張表的一列）；
  類別 `footprint`＝你去過哪、做過什麼（清除我的足跡會回到預設），`pref`＝偏好（留著），`meta`＝結構本身。
  | 鍵 | 型別 | 說明 |
  |---|---|---|
  | `onboarded` | bool | 看過 onboarding（pref） |
  | `dropoff` | `{ id, name, km, setAt, via:'k1'|'e'|'search'|'route' }` 或 null | 下車點。km 從 MOCK 的距離算（距離不明時是 null，畫面寫「距離待確認」、不顯示車資與分鐘），車資與分鐘不存，畫面用 `APP.fmt` 現算 |
  | `trip` | `{ placeId, phase:'matching'|'riding'|'done', startedAt, rated:bool, km, via, stars? }` 或 null | 進行中的叫車。**只有 `APP.ride.trip`（§7）讀寫**；km 距離不明是 null；via＝下車點從哪個入口設的（轉換歸因）；stars 評分後才有 |
  | `pushes` | `[{ when:'am'|'pm', at:ISO }]` | 今天發過的推播（最多兩則） |
  | `draws` | `{ 地點 id: 款式 key }` | 走路抵達抽到、還沒收的款式（重進不重抽；收下就清掉） |
  | `cardStyle` | `{ 明信片 id: 款式 key }` | 收下時抽到的款式（金框的明信片在收藏裡也是金框） |
  | `fxMute` | bool | 抵達與抽卡的音效關掉（pref） |
  | `rideSpots` | bool | 叫車地圖上要不要疊城事的景點（設定頁可關；pref） |
  | `rideVia` | `{ 明信片 id: 'k1'|'e'|'route'|'search' }` | 搭車收下的那一趟是從哪個入口叫的（行程紀錄的小標；`APP.ride.trip.consume` 寫） |
  | `tabPaths` | `{ ride, album }` | 各 tab 最後停的 path（由 nav 維護；`remember:false` 的不記） |
  | `version` | number | store 的結構版本（目前 2；meta）；load 時每個鍵照 `KEYS` 的型別檢查，型別不對退回預設，不認得的鍵原樣保留 |
  沒標類別的都是 footprint。
- 事件：`APP.on('store:change'|'state:change'|'route:change', fn)`／`APP.emit(...)`。
  `state:change` 由 `APP.state` 自己發（見上），統計、設定開關、demo 面板靠它更新（底欄不聽這些事件，也沒有小紅點）。
- id 認不得的 `trip`／`dropoff`（舊版資料、手改）：`APP.ride.trip` 讀的時候一律當作沒有行程（任何畫面都一樣）；`/ride`、`/trip`、`/trip/done` 的 mount 與 `arrive()` 再真的清掉，不會卡住叫車。
- 「清除我的足跡」（system）＝`APP.state.batch(() => { APP.state.wipe(); APP.store.clear('footprint'); })`：STATE 的明信片、公里、日誌，加上 store 裡 footprint 類的鍵（`dropoff`、`trip`、`rideVia`、`cardStyle`、`draws`、`pushes`、`tabPaths`）回到預設；保留 pref（`onboarded`、`fxMute`、`rideSpots`）與 `STATE.settings`。
- 每日回顧結束時用 `APP.state.setToday` 多寫 `date:'MM.DD'`；收藏首頁只認今天的心情與照片。

### 3.4 格式與公式（不准手寫數字）
```js
APP.fmt.WALK_MAX_M = 3000
APP.fmt.fare(km)      // Math.round(75 + 22 * km)   → 車資
APP.fmt.rideMin(km)   // Math.round(3 + 2.2 * km)
APP.fmt.walkMin(m)    // Math.round(m / 75)
APP.fmt.dist(m)       // < 1000 → '900 m'；否則 '1.4 km'（一位小數）
APP.fmt.canWalk(m)    // m <= WALK_MAX_M
APP.fmt.todayMMDD()   // '09.23'
APP.fmt.greet(hour)   // 5–11 早安、11–18 午安、其餘晚安
APP.fmt.num(n)        // 千分位
APP.fmt.km(m)         // 公尺 → 公里（一位小數的數字），給 fare／rideMin 用
APP.fmt.clock(d)      // '9:05'（狀態列用）
APP.esc(s)            // HTML escape
```
`fmt.dist` 先四捨五入再挑單位（999.6 → '1.0 km'）。
`APP.place(id)` → `MOCK.findPlace` 的正規化結果：`{ id, name, art, dist(m), type, hook, story[], why[], card(明信片 id), lat?, lon? }`，
另有 `area, eyebrow, tip, hours, state（SPOTS 上的 today/seen/new 或 null）, raw（findPlace 原物件）`。
接受地點 id、明信片 id、路線站 id，一律正規化成地點（p1 → station、p2 → market、p9 → neiwan；只出現在路線上的卡如 p3、p14 保留卡片 id）；**不認得的 id 回 `null`**（findPlace 會默默退回今天的地方，這裡擋掉），`/place/:id` 請自己顯示找不到。
`card` 找不到明信片時是 `null`。距離以 findPlace 為準（例：brick 在 PENDING 是 2400、SPOTS 是 1500，取 2400）。
`APP.places()` → 全部可去的地方（SPOTS ∪ PENDING ∪ TODAY ∪ FAR_PLACE，去重）。
`APP.place` 對自己的輸出是穩定的（`APP.place(APP.place(x).id).id === APP.place(x).id`）；路線詳情的每一站、demo 面板的選單都直接問它，不自己查 `CARD_TO_PLACE`。
`APP.footprintPlace(cardId)` → 城市足跡上的地點 id（地圖認得的地方）或 `null`：CARD_TO_PLACE → 景點同名 → hs-places 名稱以卡名開頭。
**跟 `APP.place(id).id` 刻意不同**：足跡以地圖認得的地點為準，路線站的卡落到同名的地點（p3 → moat、p6 → hill、p8 → lake），地圖上沒有的站（p10、p12–p18）是 `null`；
`APP.place` 則把它們當成只在路線上的站（id 就是明信片 id）。兩種答案都是現行行為，產品決定前不合併；要改就改 `app.js` 的 `footprintPlace` 與 `tests/unit/place.test.mjs` 的對照表。
收藏（足跡、去過的地方、週回顧的地方數、城市顏色、明信片詳情的距離與故事）一律問 `footprintPlace`，其餘都問 `APP.place`；不要再在 view 裡寫第三種查法。

### 3.5 UI 零件
```js
APP.ui.toast(msg)                                 // 沿用 SHELL.toast，掛在 .device 內
APP.ui.confirm({ text, yes:'清除', no:'先不要', danger })  // Promise：按是 true、按否 false、沒有回答就被關掉（Esc、點遮罩、導覽離開、已經有一個開著）null；
                                                  // danger:true 時預設焦點在「否」。「否」本身是動作的（叫車前的「直接叫車」）要寫 === false
APP.ui.dismissOverlays()                          // 收掉 .device 裡所有 [data-overlay]（router 每次導覽一開始自己呼叫）
APP.ui.overlay(el, { dialog, label, focus, onClose })   // 掛一個浮層：標 data-overlay、掛到 .device、交給 a11yDialog；回傳 close()（可重複呼叫，也是 el._dismiss）
APP.ui.announce(text)                             // 念給報讀器聽（常駐的 #app-live）
APP.ui.share({ title, kind, card, url })          // 分享面板；第一格永遠是「傳給家人（長輩圖）」→ #/elder（有 card 時 #/elder?card=<id>）；
                                                  // url 沒給就用打開那一刻的網址（面板上 data-share-url）
APP.ui.push({ when:'am'|'pm' })                   // 推播浮層（system.js 實作並掛到 APP.ui.push）
APP.ui.setStatus(tone)                            // 切狀態列字色
```
tab bar：`<nav class="tabbar" id="tabbar">` 沿用 chengshi.css 樣式與 `TABSETS.default` 的圖示；只建一次，換頁只更新 `is-active`／`aria-current`。沒有小紅點。

**浮層約定**：掛在 `.device`（`main.view` 外面）、換頁就該消失的東西（分享面板、推播、確認框、機率說明、懸浮小卡）加 `data-overlay`；要收尾的設 `el._dismiss = function(){…}`（移除自己、還焦點、拆 listener，可重複呼叫）。
新的浮層一律用 `APP.ui.overlay(el, opt)` 掛（確認框、機率說明、推播、分享面板都是）：上面這些它一次做完，回傳的 `close()` 就是 `_dismiss`。
叫車的懸浮小卡是同一個元素重複開關（hidden），自己接 `data-overlay`＋`_dismiss`＋`a11yDialog`。toast 不是浮層，會跟著跳到下一頁。
**對話框**：`APP.ui.a11yDialog(el, { label, onEsc, focus })` → release。Tab／Shift+Tab 在框裡繞；開著時 `#view`、`#tabbar`、`#demo-panel` 設 `inert`（疊層計數，全部關掉才解除）；只有最上層吃 Esc；沒標 `data-overlay` 的對話框在導覽時當作按了 Esc。
**toast**：畫面上的 toast 是 `aria-hidden`，文字另外放進常駐的 `#app-live`（`role=status`），先清空、稍後再放字，報讀器才念得到。

### 3.6 地圖
```js
const m = APP.map.mount(containerEl, {
  style: 'paper',            // hsmap preset；叫車首頁 paper、足跡 fog、夜間回顧可 navy
  center: 'station' | [lat, lon] | placeId,
  spanM: 1800,
  spots: MOCK.SPOTS | false, // 要疊哪些景點；叫車首頁 ≤ 4、探索地圖 ≤ 10（超過就 throw）
  max: 4,
  compact: true,             // .spot--compact（叫車首頁用）
  fog: false | { seen:[...], fade:[...] },
  pan: true,                 // 加 data-pan 並 INTERACT.initPan
  onSpot(spot, el) {}        // 點景點（小卡由呼叫端畫；可用 SHELL.bindPeek）
});
m.handle   // HSMAP 的 handle（project／spotsAt／coverage）
m.el / m.svg / m.spotsEl / m.spots   // .map 元素、svg、景點層、實際畫上去的景點（spotsAt 後、含 x/y/px/py/edge）
m.destroy()   // 拆掉地圖，連同 pan 時 INTERACT.initPan 掛在 window 上的 listener（同一頁重畫地圖不會越疊越多）
```
其他選項：`overlay`（HTML 字串，插進 .map；裡面的 `.pin` 會跟著平移，`.fab`／`[data-recenter]` 不動——要在 initPan 之前就在，所以用這個而不是 mount 後再插）、
`clamp`（預設 true，框外的景點夾到邊緣並加 `.spot--edge`）、`layers／labels／avoid／rotate／dataset` 直接傳給 HSMAP。
container 要有尺寸（.map 以 `position:absolute; inset:0` 填滿它；container 是 static 會被改成 relative）。
沒給 `onSpot` 時景點是 `<a href="#/place/:id">`；有給時是 `<button>` 並以 `onclick` 呼叫。每顆 `.spot` 有 `data-spot="<id>"`。
選到的景點加 `.is-selected`（app.css：從底部尖角放大 1.4 倍、框換海軍藍、壓在其他景點上面）；叫車首頁的探索模式與 `/explore/map` 共用。景點縮圖維持插圖不換實景照片（38–46 px 的照片糊成一團、跟「還沒去＝灰階」的狀態搶辨識度）。
max 預設 10；`spots.length > max` 直接 throw。
景點會自動推開（`declutter`，預設開；`declutter:false` 關）：量每顆 `.spot` 的大小兩兩推開幾輪、夾在地圖框內（上緣留 `spotsTop`，預設 64 px），有 `onSpot` 的地圖連選到放大 1.4 倍的空間都算進去（倍數在 app.js 的 `SPOT_SELECTED_SCALE` 與 app.css 各寫一次，要一起改）。推完 `m.spots` 的 x/y/px/py 是實際畫的位置，原位在 `px0／py0`。
內部：建 `<div class="map app-map" data-pan><svg class="map__svg"></svg><div class="map__spots" data-panlayer></div></div>`，
`HSMAP.render(svg, …)` → `handle.spotsAt(list, {clamp:true})` → `SHELL.renderSpots`。右下角 ODbL 署名由 hsmap 自帶，不要關。
叫車首頁的 pin（上車點）與景點 `.spot` 是兩套標記，不共用 class。

## 4. DOM 契約（測試與 CSS 都靠它）

```
html[data-app-ready="1"][data-view-ready="1"]
body[data-view="place"][data-tab="explore"][data-route="/place/:id"]
#app > .stage > .device > .device__screen > #view > main.view[data-view]
                                  .device > nav.tabbar#tabbar（tab 為 null 時 hidden）
#demo-panel（.stage 內、.device 的旁邊；桌機才顯示；內容空的時候 :empty 隱藏）
<pre id="app-errors" hidden>（window.onerror／render 錯誤；headless 驗收讀它）
#app-live（body 底下，role=status aria-live=polite，視覺隱藏；toast 與 APP.ui.announce 的文字）
html[data-layout="desktop"|"phone"]（§9 的判斷結果，給測試與除錯）
[data-nav-focus]（導覽後拿到焦點的 h1／main）
```
demo 面板的「模擬抵達」下拉選單遇到清單外的地方（路線站的明信片 id，例 /place/p14）會多一個選項排在最前面並選起來。
demo 面板的 class（app.css 提供）：`.demo-panel__t` 標題、`.demo-panel__btn`（海軍藍）、`.demo-panel__btn--ghost`、`.demo-panel__note`；模擬抵達那一組（system.css 提供）：`.demo-panel__group`、`__label`、`__select`（`[data-demo-place]`）、`__row`、`.demo-panel__btn--gold`，按鈕是 `data-act="arrive-walk"`／`"arrive-ride"`。
內建卡片：`.app-empty > .app-empty__card`（`__eyebrow`、`__t`、`__p`），views 要做「找不到」也可以沿用。
- 每個可按的東西都要有行為：`href="#/…"`（必須是已註冊的 route）、`element.onclick`、或 `data-toast="…"`。
  只做裝飾的東西不要用 `<button>`／`<a>`。
- 動作按鈕加 `data-act="<動詞-名詞>"`（例 `set-dropoff`、`go-walk`、`call-ride`、`collect`、`rate`），測試靠它點。
- 需要程式產生插畫的地方用 `data-art="glass" data-seed="1"` 然後 `SHELL.injectArt(root)`；圖上要有 `<span class="ai-mark">AI 生成示意</span>`。
- 圖示 `<span data-icon="sun">` 然後 `SHELL.injectIcons(root)`。

## 5. 設計紀律（全部沿用 AGENTS.md；違反就是 FAIL）

- 禁用詞：任務／完成／達成／挑戰／每日。沒有連續天數、倒數、限量、排名、未讀數字。獎章寫「收集 4/8」。
- 紅色只給品牌情緒（頁首、抽屜、地圖 pin、強調數字、logo）；海軍藍給可按的東西。
- 顏色、字級、圓角（六種）、動畫時間一律用 `tokens.css` 的變數；新 CSS 不准出現 hex 色碼（hsmap 的 PALETTE 除外）。
- 數字不手寫：統計、車資、時間、距離、覆蓋率全從 `STATE／MOCK／APP.fmt` 算。
- 不加 CDN、不加 webfont、不連網（sw.js 只快取同源檔）。
- 隱私分軌：日誌／心情／照片只有你（沒有分享鍵）；明信片／獎章／週回顧／長輩圖才可分享。
- 推播一天最多兩則；叫車地圖 ≤ 4 景點；探索地圖 ≤ 10；抵達驗證 80 公尺內停 1 分鐘（文案用）。
- 用 `element.onclick`，不用 `addEventListener` 綁按鈕（測試的攔截器裝在後面）。
- 每個 view 檔頭用中文註解寫：回答什麼／從哪張原型來／刻意沒有的東西。

## 6. 測試契約

### 6.1 跑法
```bash
python app/tests/run.py              # 全部：node 單元測試 → headless Chrome 跑 tests/runner.html → 摘要，非零 exit 表示 FAIL
python app/tests/run.py --only ride  # 只跑一個 spec（逗號分隔可多個）
python app/tests/run.py --unit       # 只跑 node
python app/tests/run.py --browser    # 只跑瀏覽器
python app/tests/run.py --keep       # dump 出來的 DOM 留在 app/tests/.out/（已 gitignore）
python app/tests/run.py --selftest   # 驗 harness 本身（fixtures/selftest.html 對 fixtures/mini-app.html）
node --test "app/tests/unit/*.test.mjs"   # 直接跑單元測試（node 24 不吃目錄參數，要給 glob）
```
Chrome 旗標沿用 `prototype/tools/verify-quiet.py`：`--headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --force-device-scale-factor=1 --virtual-time-budget=N --dump-dom`（預設 N=180000，`--budget` 可調）。
結果寫在 `runner.html` 的 `<pre id="result">`（JSON：`{specs:[{name, tests:[{name, ok, msg, ms}]}], missing:[找不到的 spec 檔], only, summary:{pass, fail, total, ok}}`），完成時 `html[data-tests-done="1"]`，Python 解析它。
找不到的 spec 檔（`missing`）算 FAIL、exit 1。virtual time 下改 iframe 大小不會送出 ResizeObserver／resize，要測的話自己補發 `resize`。
手動看：`chrome --allow-file-access-from-files app/tests/runner.html`（file:// 下 iframe 要同源才讀得到），或經 `app/tools/serve.py`。

### 6.2 瀏覽器端 API（`tests/harness.js`）
```js
T.spec('ride', function (t) {
  t.test('設為下車點後叫車鈕就緒', async function (app) {
    await app.reset();                              // 清兩把 localStorage、重載 iframe、等 data-app-ready、略過 onboarding
    await app.go('/place/neiwan');                  // 導覽並等 data-view-ready
    await app.click('[data-act="set-dropoff"]');    // 點（走 element.onclick 或 href）
    await app.at('/ride');                          // 等到某個 path
    t.ok(app.$('[data-act="call-ride"]').classList.contains('is-ready'), '叫車鈕就緒');
    t.eq(app.text('[data-fare]'), String(APP_of(app).fmt.fare(28)), '車資用公式');
  });
});
```
`app` = `{ win, doc, APP, STATE, MOCK, $(sel), $$(sel), text(sel), go(path, {expect, redirectOk, ms}), at(path, ms), click(sel|el), waitFor(fn, ms, label), tick(ms), reset({onboarded, store, hash, still, cards}), route() }`，
延伸：`view()`（目前的 `main.view[data-view]`）、`errors`（iframe 的 onerror／unhandledrejection＋`#app-errors`，每次 go 清空）、`readyMs`、`reload(hash)`（不清狀態重載）、`storage('state'|'store')`（讀 localStorage JSON）。
`t` = `{ test(name, fn, {timeout}), ok, eq, includes, fail, noDeadButtons(app), noBannedWords(app, {allow}), noHardcodedHex(cssText, name), countTappables(app) }`。
各 spec 共用、只寫一份的（`T.*`）：
- `T.ROUTES`：§8 每條 route 一個範例網址（`{ path, area, flow?, expect? }`）；`T.routes({ area, extra, skip, root })` 從它挑。app.spec 拿它跟 `APP.routes()` 對帳，新增 route 沒放範例就 FAIL。
- `T.tapMax(path)`：可按數上限（§6.3-4）。
- `T.fixtures.trip(o)`／`T.fixtures.dropoff(o)`：store 的行程與下車點初值（§3.3 的形狀只在這裡）；`app.reset({ cards: [{ id, date, by, note, km }] })` 在 demo 的 8 張之外多收幾張（收完重載，跟真的收過一樣）。
- `T.helpers`：`clickBack`、`histI`、`drag(app, grip, dy, {id, init, hold})`、`drawThrough`（非 still 的抽卡）。
node 端：`tests/unit/helpers.mjs` 的 `loadApp({ views: ['ride', 'album', …] | 'all', now, storage })` 照 index.html 的順序載真的 views（只跑到註冊與匯出，不 render），`now` 固定時間。
純計算（公式、排序、機率、日期範圍）寫成 node 測試（`tests/unit/views.test.mjs`），瀏覽器 spec 只驗畫面與流程。
- 斷言是軟的：失敗記下來繼續跑，任何一條失敗該 test 就 FAIL；例外與逾時（預設 8 s）也是 FAIL，附 stack 前兩行。
- `app.click` 派一個真的 click 事件（`el.click()`），`element.onclick`、href 導覽、router 的 `a[data-back]` 都照真實順序發生。
- 每個 spec 開跑前 harness 自動 `reset()` 一次；spec 內各 test 要不要 reset 自己決定。
- `app.click(sel, ms | { ms, hit:true })`：`hit` 時用 `elementFromPoint` 做命中測試，點不到（被蓋住、display:none）就丟例外；預設照舊 `el.click()`。
- `noDeadButtons`／`noBannedWords` 除了 `main.view`（與 `#tabbar`），也掃看得到的浮層（`[data-overlay]`、`.scrim`、`.sharesheet`、`.sys-share`、`.pushmock`、`.toast`）與顯示中的 `#demo-panel`；`target="_blank"` 的真連結算有行為。
- 死按鈕判準：`href="#/…"` 且 `APP.resolve` 落在已註冊的 view（落到 `_404`／`_placeholder` 都算死）、`element.onclick`、`data-toast／data-switch／data-pills／data-flip／data-share／data-reset／data-recenter／data-tab／data-i`、或祖先有這些；`data-back` 只在 `<a>` 上才算（app.js 只攔 `a[data-back]`）。
- 禁用詞白名單（yoxi 既有文案）：「好康任務」「行程完成」，在 `harness.js` 的 `WORD_OK`。
每個 spec 檔在 `runner.html` 用 `<script src="specs/xxx.spec.js" onerror="T.missing(…)">` 登記（新增 spec 要加一行；檔案不在時會列在「找不到的 spec 檔」，不擋其他 spec）。

### 6.3 每個區塊的 spec 至少要有
1. 該區塊每個 route 都能 render（`await app.go(path)` 不丟例外、`main.view[data-view]` 存在、`t.noDeadButtons`、`t.noBannedWords`）。
2. 每個主要互動改到狀態（例：collect 之後 `STATE.count()` +1；set-dropoff 之後 `store.dropoff.id` 對）。
3. 畫面上的數字跟公式一致（車資、分鐘、距離、收集 n/m、點數＝明細相加）。
4. 可按數：`/explore` 與 `/album` 兩個索引頁 ≤ 12，其餘畫面 ≤ 10（`t.countTappables(app)`；地圖上的景點與 tab bar 不算；`[data-gallery]` 容器裡的連結整片算一個（例：`/postcards` 的明信片格）；清單超過就收成「更多」或「全部」）。
5. 返回鍵回到正確的來處（從 A 進 B 再 back，回 A）。

## 7. 誰動哪些檔（並行時不要踩到別人）

| 角色 | 只動 |
|---|---|
| core | `index.html`、`css/app.css`、`js/app.js`、`manifest.webmanifest`、`sw.js` 的註冊點 |
| harness | `tests/run.py`、`tests/runner.html`、`tests/harness.js`、`tests/specs/app.spec.js`、`tests/unit/*` |
| pwa | `manifest.webmanifest`、`sw.js`、`assets/icons/*`、`tools/make-icons.py`、`tools/serve.py` |
| ride／explore／album／system | 各自的 `js/views/X.js`、`css/views/X.css`、`tests/specs/X.spec.js` |
| qa | 任何檔，但只修 bug 與縫合，不改契約 |

需要 core 多給一個 helper 時：先在自己的 view 檔裡以 `APP.<area>.<fn>` 命名空間放（例 `APP.ride.setDropoff()`），
別人要用就從那裡拿；不要改 `app.js`。跨區塊共用的動作只有這幾個，**由這些人提供**：
- `APP.ride.setDropoff(placeId, via)`：寫 `store.dropoff` 並 toast「已設為下車點」→ 回 `#/ride`（ride 提供；explore 的 K1 與 E 小卡都呼叫它）
- `APP.explore.collect(placeId, { note })`：收下一張明信片（explore 提供；/unlock 用）。呼叫的人只給那一句話，其餘由它判斷：有搭 yoxi 抵達這裡的那一趟（`APP.ride.trip.arrivedAt`）就是搭車——必得金框、公里用這一趟的、收下時 `APP.ride.trip.consume` 用掉它（連同 rideVia 歸因）；否則走路——款式是這次抵達抽到的（`store.draws`，還沒抽就當場抽）、公里用地方的距離，行程不碰（還沒領的限定版不會消失）。經 `APP.state.collect` 寫進 STATE（跟 app store 的寫入包成一次 state:change，寫完才發）；款式記進 `store.cardStyle[卡片 id]`，清掉 `store.draws[地點 id]`；回傳是否新收。測試要準備「收過了」的狀態用 `T.helpers.collect(app, placeId, { by, style, note })` 或 `app.reset({ cards })`
- `APP.explore.cardOrigin(cardId)`（explore 提供）：收下的那一張是怎麼來的，還沒收是 null：`{ id, date, note, km, by:'walk'|'ride', style, gold, limited, via }`。`gold`＝抽到金框那一款或限定版；`limited`＝`APP.ride.limitedCard`；`via`＝`store.rideVia`。收藏、叫車的浮起來小卡、探索的「已收藏」一行都問它，不各自翻 STATE 的 by、store.cardStyle、store.rideVia
- `APP.ride.trip`（ride 提供）：**行程 module，`store.trip` 只有它讀寫**，別的區塊與畫面一律透過它。讀：`current()`（id 認得的那一趟或 null）、`active()`（配對中／行程中）、`arrivedAt(placeId)`（搭車抵達這裡、phase done 的那一趟）、`pending()`（抵達了、明信片還沒收：`{ trip, place, card, limited, href }`）、`phase(t, now)`（純函式，matching 過了 `MATCH_MS` 算 riding）。寫：`start(placeId, via)`、`toRiding()`、`arrive()`、`arriveAt(placeId)`（demo 搭 yoxi 抵達）、`cancel()`、`rate(stars)`、`consume(placeId)` → `{ via, km }`（搭車收下時用掉這一趟、記 `store.rideVia[明信片 id]`）、`clear()`、`clearBroken()`。行程的形狀只在 ride.js 的 `make()` 寫一次；km 一律從地方的距離算，距離不明是 null。node 測試在 `tests/unit/trip.test.mjs`
- `APP.ride.RIDE_BONUS`（ride 提供）：搭車抵達走不到的地方的加點，＝`MOCK.FAR_PLACE.ridePoints`（資料缺了才用 50）；全 app 唯一來源，explore 的「+50 點」也讀它。`APP.ride.pointsRows()` 每一列多一個 `place` 欄位
- 抽卡（explore 提供）：`APP.explore.DRAW_STYLES`（每個地方五款：四種畫風＋金框；`walk`／`ride` 權重為千分比，各自加總 1000）、`APP.explore.drawStyle(by, r)`（純函式）、`APP.explore.openOdds()`（機率說明）。搭 yoxi 抵達必得金框：是不是搭車只問 `APP.ride.trip.arrivedAt(地點 id)`（這個地方、phase done），`?ride=1` 只是入口的記號；走路抵達在 mount 抽一次、記在 `store.draws[地點 id]`（render 只讀，還沒抽就畫卡背），重進不重抽。機率只放在 `/unlock` 收集面板與成品右上角的「?」（`data-act="open-odds"`）；面板與結果都不寫機率、不寫「必得」。`openOdds()` 掛在 `.device`，帶 `data-overlay`＋`_dismiss`。金框 ≠ +50 點：點數仍只給走不到的地方（`APP.ride.limitedPlace`）
- `APP.fx`（explore-fx.js）：`engine(canvas)` 粒子（burst／converge／ring／stream）、`shaker(el)`、`hitstop(root, eng, ms)`、`flash(el, rgb)`、`sfx`（Web Audio 合成，`store.fxMute` 靜音）、`filters()`（`#exf-watercolor／oil／woodcut／ink／gold／paper／brush`）、`color(token)`、`sfx.stopAll()`（切掉已排好的聲音；靜音與離開 /unlock 時呼叫）。顏色一律從 tokens 讀；`calm()` 就是 `APP.reduceMotion()`。`APP.explore._` 是不可列舉的內部零件，只給 explore 三支檔案用
- 明信片的卡面（explore 提供，`explore-face.js`）：`APP.explore.cardFace(cardId, key)` → `{ gen, photo, credit }`——疊法只有這一個，`/unlock` 的卡面與收藏的卡都照它；`postcardSrc(cardId, key)` → `assets/postcards/<id>-<key>.jpg`（只有 `POSTCARD_GEN` 裡的；其餘回空字串，卡面退回照片＋SVG 濾鏡）；`cardPhoto(cardId)` 底圖照片（明信片自己的 → 對照表的地點 → 這張卡所在地點的；出處也從它來）；`cardStyleOf(cardId)`（explore-cards.js）收下的是哪一款（`store.cardStyle` → 沒紀錄的：搭車卡金框、走路卡以明信片 id 為種子照機率表抽一次）。別的區塊要顯示「收下的那一張」：在畫插圖的元素上加 `data-card-art="<明信片 id>"`，explore-face.js 監看整台 `.device`（`#view` 與掛在上面的浮層、懸浮小卡）自動疊上 `<img class="card-gen">`，畫面不用自己呼叫，順序跟 `/unlock` 卡面一樣：生成的成品 → 沒有成品或載不到：底圖照片＋那一款的 SVG 濾鏡（`.card-gen--photo`，先排成 220 px 寬套濾鏡再縮放到容器，容器加 `.card-photo-host` 藏起底下的插圖）→ 都沒有才留插圖（還沒收的不疊）。收藏裡顯示明信片的地方都要帶 `data-card-art`（含週回顧的卡與封面）；明信片詳情寫底圖照片的出處（`data-credit`，作者、授權、連結）
- 金框卡在哪裡顯示都有金框和金粉（explore 提供，`explore-gold.js`）：在「畫金框的那個元素」加 `data-gold-aura`，金粉就從它的邊緣冒出來（照元素的旋轉角度）。`[data-card-art]` 的金框卡沒人標的話，`paintCardArt` 自己補 `data-gold-aura`＋`.card-gold`（通用的框，explore.css）；框畫在外層的（明信片詳情整張卡、叫車的浮起來小卡）由畫面自己標在外層，`paintCardArt` 看到祖先標了就不再補。`/unlock` 翻開之後（`finish()`）才標，翻開前不洩底。整台手機一張 `canvas.gold-aura`（掛 `.device`、z-index 97、`pointer-events:none`、`aria-hidden`）；金粉裁在卡片的捲動範圍裡，被別的東西蓋住的邊不冒（`elementFromPoint`）；卡片移動時金粉被「跟著卡片走的空氣」帶著、有慣性（`APP.fx.gold.step` 是純函式）。樣子：細金粉、會翻會閃的金箔、細長四芒閃光、暗底的散景；相對空氣動得快的金粉拉出變淡的尾巴；每張卡每 4.8 秒有一道斜光掃過框、從亮的地方多灑一把（每張卡錯開）。`APP.reduceMotion()` 時不建 canvas（框照舊）；看不到金框卡時不跑 rAF。測試用：`APP.fx.gold.tracked()`、`particles()`
- `APP.system.demoArrive(placeId, 'walk'|'ride')`：demo 面板的模擬抵達。走路 → `/unlock/:id`（行程進行中不行）；搭 yoxi → `APP.ride.trip.arriveAt(placeId)`（這一趟在這裡結束、取代原本的行程；距離不明的 km 是 null，跟一般叫車一樣）＋ `/unlock/:id?ride=1`
- `APP.ui.push({when})`：推播浮層（system 提供；點推播進 `#/ride?mode=explore&area=...`（早）或 `#/lookback`（晚））
- `APP.ui.share(opt)`：分享面板（system 提供；album 的週回顧與明信片用；明信片分享帶 `card`，長輩圖 `/elder?card=<id>` 把那張排第一）
- `APP.album`（album 提供）：`visitedPlaces()`（不重複的地點）、`recentCards()`（照收下的先後、最後收的排第一：看 `STATE.all.cards` 的鍵順序，不比 `MM.DD`，同一天連收與跨年都對）、`cityColors()`（足跡頁的城市顏色，從去過的地方算）、`weekStats()`（`now.after`＝範圍之後才收的卡）。角標：`APP.ride.limitedCard(id)` 為真寫「yoxi 限定版」，其他金框卡寫「yoxi 金框」

## 8. 路由總表

| path | view | tab | 來源原型 | 誰做 |
|---|---|---|---|---|
| `/` | 導到 `/ride`（第一次開先 `/welcome`；首次載入不帶 query 的 `/ride`、`/album` 也一樣） | — | — | core |
| `/welcome` | onboarding 三張 | null | 新 | system |
| `/ride` | 預設搭車；面板內 pill 切探索（`?mode=explore`），選地區再加 `&area=` | ride | `variant-f-home.html`、`variant-e-home.html`、`concept-map-home.html` | ride |
| `/dropoff` | 設定下車地點（清單＋搜尋） | ride | 新（參考 `pickup.html` 版型） | ride |
| `/pickup` | 設定上車地點 | ride | `pickup.html` | ride |
| `/trip` | 配對中→行程中（「這條路上」卡） | null | `ride.html` | ride |
| `/trip/done` | 行程完成、評分、金色橫幅 | null | `ride-done.html` | ride |
| `/drawer` | 側邊抽屜（覆蓋層） | ride | `drawer.html` | ride |
| `/points` | 和泰 Points（總數＝明細相加） | ride | `points.html` | ride |
| `/notify` | 通知中心 | ride | `notify.html` | ride |
| `/trips` | 行程紀錄 | ride | `trips.html` | ride |
| `/explore` | 探索（X2 缺口導向＋今天的地方） | explore | `variant-x2-explore.html`、`explore.html`、`variant-l1-explore.html` | explore |
| `/explore/map` | 探索地圖（真實地圖 ≤ 10 景點、小卡） | explore | `map.html`、`concept-map-explore.html` | explore |
| `/place/:id` | 地方詳情（K1） | explore | `variant-k1-place.html`、`place.html` | explore |
| `/going/:id` | 前往中（走路；這個地方已搭 yoxi 抵達、明信片還沒收時改顯示「收下這張明信片」卡） | null | `going.html` | explore |
| `/unlock/:id` | 抵達 → 收集 → 抽卡（搭 yoxi 抵達必得金框，問 `APP.ride.trip.arrivedAt`；`?ride=1` 只是入口記號；`data-at` 1 抵達／2 抽卡／3 結果） | null | `unlock.html` | explore |
| `/routes` | 路線列表 | explore | `routes.html` | explore |
| `/route/:id` | 路線詳情（斷點處可設為下車點） | explore | `route.html`、`variant-k4-route.html` | explore |
| `/album` | 收藏（明信片主卡、統計、「回顧」一列、獎章精選卡；`?tab=journal／week／badges` 舊連結落在這頁、對應那一塊亮一下，再用 `replaceQuery('')` 拿掉） | album | `variant-s3-album.html`、`album.html`、`variant-x4-badges.html` | album |
| `/postcards` | 明信片子頁，標題「明信片」（收下的／還沒去的兩段，收下的每一格連到詳情，左上返回） | album | 新 | album |
| `/badges` | 全部獎章（三欄六角章牆） | album | 新（參考 `variant-x4-badges.html`） | album |
| `/postcard/:id` | 明信片詳情（翻面） | album | `postcard.html` | album |
| `/badge/:id` | 獎章詳情 | album | `badge.html` | album |
| `/footprint` | 城市足跡（真實地圖＋霧、覆蓋率算出來） | album | `fogmap.html`、`concept-map-footprint.html` | album |
| `/lookback` | 每日回顧四幕（只有你） | null | `lookback.html` | album |
| `/week` | 週回顧（可分享） | album | `week.html` | album |
| `/elder` | 長輩圖（`?card=<id>` 把那張排第一並預選） | album | `elder.html` | album |
| `/settings` | 城事設定（隱私開關、重設、demo 工具） | null | `settings.html` | system |
| `/*` | 404：一句話＋回叫車 | null | 新 | core |

**返回規則**（2026-09-25）：
- 叫車：`/dropoff` 選好、`/pickup` 選好、取消行程、`/trip/done`「回首頁」都是「上一格是 `/ride` 就退回，不是就就地換成 `/ride`」（`APP.nav.up('/ride', { backIf: 上一格是 /ride })`）；「在地圖上挑」把 `/dropoff` 那一格換成探索模式，選好後退回原本那一格 `/ride`。
- 收藏子頁：返回鍵是 `data-back="上一層" data-up`（album.js 的 `subMount` 標），交給 `APP.nav.up` 的預設規則：退一格會落在有 tab 的一般頁（而且不是自己）就 `history.back()`；切 tab 停回來、直接開網址、重新整理後的第一筆、從流程頁（例 `/unlock`）進來的，改成就地換成上一層（換上來的那一層再按返回也往上走）。上一層：`/postcards`、`/badges`、`/week`、`/footprint` → `/album`；`/badge/:id` → `/badges`；`/postcard/:id` → `/postcards`；`/elder` → `/week`。
- 探索舊路由的保底去處（找不到頁、先不去了、已收過的「回探索」、`/routes` 的關閉）是 `/ride?mode=explore(&area=<id>)`，不是舊的 `/explore`。

## 9. 桌機／手機

- 桌機：寬度 ≥ 560，而且（有 hover 加細指標，或高度 ≥ 700）——手機橫放（844×390、觸控）算手機。JS 的 `DESKTOP_MQ` 與 app.css 的兩個 `@media` 要同步。沿用 `.stage > .device` 手機外框（390×844），縮放量的是 `.stage` 實際的 padding；狀態列顯示真實時間；旁邊 `#demo-panel`（高度上限＝縮放後外框的高度，太高就在面板裡捲）。
- 手機（其餘）：`.device` 滿版（100vw × 100dvh，無圓角、無瀏海、隱藏原型狀態列與 home indicator），`#demo-panel` 隱藏。
  安全區的做法是在 `.device` 上把 `--statusbar-h` 改成 `max(env(safe-area-inset-top), 12px)`、`--safe-bottom` 改成 `max(env(safe-area-inset-bottom), 4px)`，
  而不是給 `.device__screen` 加 padding：紅色頁首照樣延伸到最上緣，內容（本來就 `padding-top: var(--statusbar-h)`）自然避開瀏海，不會多留 54px 空白。
  所以 views 需要避開狀態列時一律用 `var(--statusbar-h)`，不要寫 54px。
- `manifest.webmanifest`：`display: standalone`、`theme_color` 用 yoxi 紅、`start_url: ./index.html`（從主畫面開會先看 onboarding）。
- `sw.js`：`location.protocol` 是 http(s) 才註冊。導覽 network-first（3 秒逾時或離線退回快取）；PRECACHE 清單裡的靜態檔 stale-while-revalidate；`assets/postcards/`、`../prototype/assets/photos/` 的圖片 cache-first，第一次抓到就存進 `<VERSION>-img`；activate 清掉兩種快取的舊版。新 sw 接手、而且之前已經有一個在管這一頁時，toast「有新版本，重新整理就會套用」；回到前景時 `reg.update()`。`python app/tools/check-sw.py`：清單缺檔即 FAIL，index.html 載的每個檔與 manifest 的 icons 都要在 PRECACHE，載外部網址也算 FAIL。

## 10. 驗收

1. `python app/tests/run.py` 全綠。
2. `python prototype/tools/verify-quiet.py` 八段 PASS，六條承諾數字與基準相同（app 不動 prototype，所以理論上不可能變；變了就是有人碰了）。
3. 手動：桌機 Chrome 開 `app/index.html`，走完 A（推播早→探索→地方→前往→解鎖→收藏）、B（路線→內灣→設為下車點→叫車→行程→評分→限定版→點數）、C（推播晚→回顧→日誌→週回顧→長輩圖）。
