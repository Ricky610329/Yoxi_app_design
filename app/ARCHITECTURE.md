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
| 收藏組織 | 摘要式首頁 | 明信片主卡、兩張統計卡、明信片與獎章網格；舊路線書架只作對照 |
| 獎章呈現 | **X4** 勳章牆 | 沒有進度環、沒有集點卡；寫「收集 4/8」 |
| 探索敘事 | **X2** 缺口導向 | 頂部仍是「今天的地方」一張大卡；下面是「你還沒有 ○○ 類」的缺口區塊、這個月的路線、還沒去的地方 |
| 認知負擔 | **L1** 一屏一事 | 每個畫面可按的東西 ≤ 10，`/explore`／`/album` 索引頁 ≤ 12（`tools/audit-load.html` 的量法） |
| 儀式 | 三幕解鎖（主線） | 灰點爆開上色 → AI 生成中 → 成品；點畫面可跳到成品 |
| 家人 | 分享選項 | 長輩圖在分享面板第一格；沒有「家人模式」 |
| 好康任務 | 不同頁 | 原封不動，不合併 |
| 好友 | 不做 | 五個未決還在，不進 app |

app 比原型多出來的東西（原型是一疊畫面，app 要能走完一圈）：
- 叫車真的會「叫」：下車點填好 → 叫車 → 配對中 → 行程中（含「這條路上」內容卡）→ 行程完成 → 評分後金色橫幅 → 限定版解鎖 → 點數 +50。
- 設定下車地點頁（`#/dropoff`）：清單＋搜尋，資料全部來自 `MOCK`。
- 第一次開的 onboarding（三張，可略過）。
- 推播是 app 內的浮層（早／晚各一則，一天最多兩則），由 demo 工具觸發。
- demo 工具：桌機在手機外框旁邊一條面板；手機在「設定 → demo 工具」。內容：早上推播、晚上推播、模擬抵達（只在前往中／行程中出現）、重設。

### 雙主頁的叫車面板

- `#/ride` 預設是一般搭車地圖與叫車欄位；搭車面板只能往下拉收合，點「展開搭車」恢復，不接受向上拖曳。面板頂端的「探索」切到 `#/ride?mode=explore`，才顯示四個附近地點與可上下拉的 sheet。點地圖 pin 或清單地點後，網址寫成 `#/ride?mode=explore&area=<地點 id>`；收合態顯示地點名稱、距離、卡片收集數與設為下車點，展開態顯示周邊卡片。往下拉只收合面板，仍留在探索。從地圖點選會先收合面板，從展開清單點選則維持展開；切回「搭車」清除探索 query。
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
  js/views/explore.js       探索（X2）、探索地圖、地方詳情（K1）、前往中、解鎖三幕、路線列表／詳情
  js/views/album.js         收藏（S3＋X4）、明信片、獎章、城市足跡、每日回顧、週回顧、長輩圖
  assets/icons/             PWA 圖示（Pillow 產生；不連網）
  tools/serve.py            本機靜態伺服器（測 PWA 用）
  tools/make-icons.py       產生 PWA 圖示
  tests/run.py              測試總入口（node 單元測試 ＋ headless Chrome 瀏覽器測試）
  tests/runner.html         瀏覽器端測試跑者（iframe 載入 index.html）
  tests/harness.js          瀏覽器端測試 API（T／app）
  tests/specs/*.spec.js     各區塊的瀏覽器測試
  tests/unit/*.test.mjs     node 單元測試（router、fmt、store）
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
     → js/app.js → js/views/system.js → ride.js → explore.js → album.js
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

### 3.2 導覽
```js
APP.nav.go('/place/glass-kiln');            // push
APP.nav.go('/ride', { replace: true });
APP.nav.back('/explore');                   // 有歷史就 history.back()，沒有就 go(fallback, {replace:true})
APP.nav.current();                          // { path:'/place/glass-kiln', pattern:'/place/:id', params:{id}, query, name, tab }
APP.nav.go('/trip', { dir:'back' });        // dir 可覆寫轉場：'push'|'back'|'tab'|'none'
```
前進／返回靠 `history.state.i`（app 自己蓋的序號）判斷；`nav.back` 在序號 > 0 時才 `history.back()`，否則 replace 到 fallback。
`nav.tab(id)`：已經在該 tab 時回到該 tab 的根，否則回到 `tabPaths[id]`。除錯用：`APP.resolve(path)`、`APP.routes()`、`APP.PLANNED`。
連結寫 `<a href="#/place/glass-kiln">` 就會走 router；返回鍵寫 `<a href="#" data-back="/explore">`（router 攔 data-back）。
tab 切換：`APP.nav.tab('album')` 記住各 tab 最後停的 path（切回來還在同一頁）。
頁內狀態（例：收藏的 pill）要寫回網址時用 `APP.nav.replaceQuery('tab=journal')`：只換目前這頁的 query，不重畫、不新增歷史，同步 `current()` 與 `tabPaths`（切 tab 再回來停在同一段）。不要自己呼叫 `history.replaceState`，router 看不到。
mount 期間掛在 `window`／`document` 上的 listener（例：`INTERACT.initSheet／initPan`）由 router 記下，離開該頁時自動移除。
轉場：push 從右滑入、back 從左滑回、tab 切換淡入；`html[data-still]` 或 `?still=1` 時關動畫。

### 3.3 狀態
- 收藏／獎章／路線／點數／設定：**沿用 `STATE`**（`../prototype/js/state.js`，localStorage `yoxi-chengshi-v1-2`）。
  新收的卡日期用 `APP.fmt.todayMMDD()`，不再寫死 09.21。
- app 自己的狀態：`APP.store`（localStorage `yoxi-chengshi-app-v1`）
  ```js
  APP.store.get('dropoff')            // 讀
  APP.store.set('dropoff', {...})     // 寫＋save＋emit('store:change', {key})
  APP.store.patch({ a:1, b:2 })
  APP.store.reset()                   // 只清 app 狀態；STATE.reset() 另外呼叫
  APP.store.all                       // 整個物件（唯讀用）；APP.store.reload() 重新讀 localStorage
  ```
  `tabPaths` 由 router 安靜寫入（不 emit）。
  鍵與型別（預設值在 app.js 的 `fresh()`）：
  | 鍵 | 型別 | 說明 |
  |---|---|---|
  | `onboarded` | bool | 看過 onboarding |
  | `dropoff` | `{ id, name, km, setAt, via:'k1'|'e'|'search'|'route' }` 或 null | 下車點。km 從 MOCK 的距離算，車資與分鐘不存，畫面用 `APP.fmt` 現算 |
  | `trip` | `{ placeId, phase:'matching'|'riding'|'done', startedAt, rated:bool, km }` 或 null | 進行中的叫車 |
  | `pushes` | `[{ when:'am'|'pm', at:ISO }]` | 今天發過的推播（最多兩則） |
  | `arrivedDemo` | string 或 null | demo「模擬抵達」暫存的 placeId |
  | `tabPaths` | `{ ride, explore, album }` | 各 tab 最後停的 path（由 nav 維護） |
- 事件：`APP.on('store:change'|'state:change'|'route:change', fn)`／`APP.emit(...)`。
  任何寫 `STATE.*` 的地方請跟著 `APP.emit('state:change')`，tab bar 的小紅點與統計才會更新。

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
`APP.place(id)` → `MOCK.findPlace` 的正規化結果：`{ id, name, art, dist(m), type, hook, story[], why[], card(明信片 id), lat?, lon? }`，
另有 `area, eyebrow, tip, hours, state（SPOTS 上的 today/seen/new 或 null）, raw（findPlace 原物件）`。
接受地點 id、明信片 id（p9 → neiwan）、路線站 id；**不認得的 id 回 `null`**（findPlace 會默默退回今天的地方，這裡擋掉），`/place/:id` 請自己顯示找不到。
`card` 找不到明信片時是 `null`。距離以 findPlace 為準（例：brick 在 PENDING 是 2400、SPOTS 是 1500，取 2400）。
`APP.places()` → 全部可去的地方（SPOTS ∪ PENDING ∪ TODAY ∪ FAR_PLACE，去重）。

### 3.5 UI 零件
```js
APP.ui.toast(msg)                                 // 沿用 SHELL.toast，掛在 .device 內
APP.ui.confirm({ text, yes:'清除', no:'先不要' })  // Promise<bool>，沿用 interact.js 的 .scrim/.modal 樣式
APP.ui.share(opt)                                 // SHELL.shareSheet；第一格永遠是「傳給家人（長輩圖）」→ #/elder
APP.ui.push({ when:'am'|'pm' })                   // 推播浮層（system.js 實作並掛到 APP.ui.push）
APP.ui.setStatus(tone)                            // 切狀態列字色
```
tab bar：`<nav class="tabbar" id="tabbar">` 沿用 chengshi.css 樣式與 `TABSETS.default` 的圖示；
探索 tab 在「今天的地方還沒收」時有 `.tabbar__dot`（不是未讀數字）。

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
m.destroy()
```
其他選項：`overlay`（HTML 字串，插進 .map；裡面的 `.pin` 會跟著平移，`.fab`／`[data-recenter]` 不動——要在 initPan 之前就在，所以用這個而不是 mount 後再插）、
`clamp`（預設 true，框外的景點夾到邊緣並加 `.spot--edge`）、`layers／labels／avoid／rotate／dataset` 直接傳給 HSMAP。
container 要有尺寸（.map 以 `position:absolute; inset:0` 填滿它；container 是 static 會被改成 relative）。
沒給 `onSpot` 時景點是 `<a href="#/place/:id">`；有給時是 `<button>` 並以 `onclick` 呼叫。每顆 `.spot` 有 `data-spot="<id>"`。
max 預設 10；`spots.length > max` 直接 throw。
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
```
demo 面板的 class（app.css 提供）：`.demo-panel__t` 標題、`.demo-panel__btn`（海軍藍）、`.demo-panel__btn--ghost`、`.demo-panel__note`。
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
`app` = `{ win, doc, APP, STATE, MOCK, $(sel), $$(sel), text(sel), go(path, {expect, redirectOk, ms}), at(path, ms), click(sel|el), waitFor(fn, ms, label), tick(ms), reset({onboarded, store, hash}), route() }`，
延伸：`view()`（目前的 `main.view[data-view]`）、`errors`（iframe 的 onerror／unhandledrejection＋`#app-errors`，每次 go 清空）、`readyMs`、`reload(hash)`（不清狀態重載）、`storage('state'|'store')`（讀 localStorage JSON）。
`t` = `{ test(name, fn, {timeout}), ok, eq, includes, fail, noDeadButtons(app), noBannedWords(app, {allow}), noHardcodedHex(cssText, name), countTappables(app) }`。
- 斷言是軟的：失敗記下來繼續跑，任何一條失敗該 test 就 FAIL；例外與逾時（預設 8 s）也是 FAIL，附 stack 前兩行。
- `app.click` 派一個真的 click 事件（`el.click()`），`element.onclick`、href 導覽、router 的 `a[data-back]` 都照真實順序發生。
- 每個 spec 開跑前 harness 自動 `reset()` 一次；spec 內各 test 要不要 reset 自己決定。
- 死按鈕判準：`href="#/…"` 且 `APP.resolve` 落在已註冊的 view（落到 `_404`／`_placeholder` 都算死）、`element.onclick`、`data-toast／data-switch／data-pills／data-flip／data-share／data-reset／data-recenter／data-tab／data-i`、或祖先有這些；`data-back` 只在 `<a>` 上才算（app.js 只攔 `a[data-back]`）。
- 禁用詞白名單（yoxi 既有文案）：「好康任務」「行程完成」，在 `harness.js` 的 `WORD_OK`。
每個 spec 檔在 `runner.html` 用 `<script src="specs/xxx.spec.js" onerror="T.missing(…)">` 登記（新增 spec 要加一行；檔案不在時會列在「找不到的 spec 檔」，不擋其他 spec）。

### 6.3 每個區塊的 spec 至少要有
1. 該區塊每個 route 都能 render（`await app.go(path)` 不丟例外、`main.view[data-view]` 存在、`t.noDeadButtons`、`t.noBannedWords`）。
2. 每個主要互動改到狀態（例：collect 之後 `STATE.count()` +1；set-dropoff 之後 `store.dropoff.id` 對）。
3. 畫面上的數字跟公式一致（車資、分鐘、距離、收集 n/m、點數＝明細相加）。
4. 可按數：`/explore` 與 `/album` 兩個索引頁 ≤ 12，其餘畫面 ≤ 10（`t.countTappables(app)`；地圖上的景點與 tab bar 不算；清單超過就收成「更多」或「全部」）。
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
- `APP.explore.collect(placeId, { by, note, km })`：包 `STATE.collect` ＋ emit ＋ 清 `trip`（explore 提供；ride 的限定版解鎖也用它）
- `APP.ui.push({when})`：推播浮層（system 提供；點推播進 `#/ride?mode=explore&area=...`（早）或 `#/lookback`（晚））
- `APP.ui.share(opt)`：分享面板（system 提供；album 的週回顧與明信片用）

## 8. 路由總表

| path | view | tab | 來源原型 | 誰做 |
|---|---|---|---|---|
| `/` | 導到 `/ride`（第一次開先 `/welcome`） | — | — | core |
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
| `/going/:id` | 前往中（走路） | null | `going.html` | explore |
| `/unlock/:id` | 抵達解鎖三幕（`?ride=1` 金框限定版） | null | `unlock.html` | explore |
| `/routes` | 路線列表 | explore | `routes.html` | explore |
| `/route/:id` | 路線詳情（斷點處可設為下車點） | explore | `route.html`、`variant-k4-route.html` | explore |
| `/album` | 收藏（S3 書架＋pill：明信片／獎章 X4／日誌／這一週） | album | `variant-s3-album.html`、`album.html`、`variant-x4-badges.html` | album |
| `/postcard/:id` | 明信片詳情（翻面） | album | `postcard.html` | album |
| `/badge/:id` | 獎章詳情 | album | `badge.html` | album |
| `/footprint` | 城市足跡（真實地圖＋霧、覆蓋率算出來） | album | `fogmap.html`、`concept-map-footprint.html` | album |
| `/lookback` | 每日回顧四幕（只有你） | null | `lookback.html` | album |
| `/week` | 週回顧（可分享） | album | `week.html` | album |
| `/elder` | 長輩圖 | album | `elder.html` | album |
| `/settings` | 城事設定（隱私開關、重設、demo 工具） | null | `settings.html` | system |
| `/*` | 404：一句話＋回叫車 | null | 新 | core |

## 9. 桌機／手機

- 桌機（viewport ≥ 560px）：沿用 `.stage > .device` 手機外框（390×844），狀態列顯示真實時間；旁邊 `#demo-panel`。
- 手機（< 560px）：`.device` 滿版（100vw × 100dvh，無圓角、無瀏海、隱藏原型狀態列與 home indicator），`#demo-panel` 隱藏。
  安全區的做法是在 `.device` 上把 `--statusbar-h` 改成 `max(env(safe-area-inset-top), 12px)`、`--safe-bottom` 改成 `max(env(safe-area-inset-bottom), 4px)`，
  而不是給 `.device__screen` 加 padding：紅色頁首照樣延伸到最上緣，內容（本來就 `padding-top: var(--statusbar-h)`）自然避開瀏海，不會多留 54px 空白。
  所以 views 需要避開狀態列時一律用 `var(--statusbar-h)`，不要寫 54px。
- `manifest.webmanifest`：`display: standalone`、`theme_color` 用 yoxi 紅、`start_url: ./index.html#/ride`。
- `sw.js`：`location.protocol` 是 http(s) 才註冊；cache-first 同源靜態檔（清單由 pwa agent 維護）。

## 10. 驗收

1. `python app/tests/run.py` 全綠。
2. `python prototype/tools/verify-quiet.py` 八段 PASS，六條承諾數字與基準相同（app 不動 prototype，所以理論上不可能變；變了就是有人碰了）。
3. 手動：桌機 Chrome 開 `app/index.html`，走完 A（推播早→探索→地方→前往→解鎖→收藏）、B（路線→內灣→設為下車點→叫車→行程→評分→限定版→點數）、C（推播晚→回顧→日誌→週回顧→長輩圖）。
