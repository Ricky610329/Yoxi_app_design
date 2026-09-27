# app/tests — yoxi 城事 web app 的測試

契約在 `app/ARCHITECTURE.md` §6；這份是操作手冊。

## 怎麼跑

```bash
python app/tests/run.py              # 全部：node 單元測試 → headless Chrome 跑 runner.html；非零 exit＝有 FAIL
python app/tests/run.py --unit       # 只跑 node --test（unit/*.test.mjs）
python app/tests/run.py --browser    # 只跑瀏覽器測試
python app/tests/run.py --only ride  # 只跑一個 spec（逗號分隔可多個）
python app/tests/run.py --keep       # dump 出來的 DOM 留在 app/tests/.out/（gitignore）
python app/tests/run.py --budget 300000   # 調 --virtual-time-budget（預設 180000 ms）
python app/tests/run.py --selftest   # 驗 harness 本身：fixtures/selftest.html 對 fixtures/mini-app.html
node --test "app/tests/unit/*.test.mjs"   # 直接跑單元測試（node 24 不吃目錄參數）
```

- 需要 Chrome 或 Edge（路徑偵測同 `prototype/tools/verify-quiet.py`）與 node 18+（本 repo 用 24）。找不到會印清楚。
- 瀏覽器測試跑在 virtual time 裡：`setTimeout` 不會真的等，整包通常幾秒就跑完。改 iframe 大小不會送出 ResizeObserver／`resize`，要測就自己補發 `resize`；rAF／WAAPI 在畫面外的 iframe 也不走，app 的時序用 `setTimeout`。
- 手動看結果：`chrome --allow-file-access-from-files app/tests/runner.html`（file:// 下 iframe 要同源才讀得到），
  或 `python app/tools/serve.py` 後開 `/tests/runner.html`。網址參數：`?only=ride`、`?frame=1`（把受測 iframe 顯示出來）、
  `?app=fixtures/mini-app.html`（換受測頁）。

## 檔案

| 檔 | 做什麼 |
|---|---|
| `run.py` | 總入口，解析 `<pre id="result">` 印表格 |
| `runner.html` | 載 harness 與各 spec；spec 檔不存在會列在「找不到的 spec 檔」，而且算 FAIL（run.py exit 1） |
| `harness.js` | `T`、`app`、`t` |
| `specs/app.spec.js` | core：§8 每條 route、tab bar、返回與 `nav.prev／nav.up`、持久化、store／STATE 分離、首屏 3 秒、CSS 無 hex、無 placeholder、地圖 |
| `specs/{system,ride,explore,album}.spec.js` | 各區塊自己寫；最後一段是「回歸測試（從 flows.spec 搬來）」：只牽涉這個區塊的審查／QA／評估，名稱保留原編號 |
| `specs/flows.spec.js` | 跨區塊：三條 demo 流程端到端、縫合、全站兩種狀態掃描、非 still 模式、跨區塊的審查／QA／評估、無障礙 |
| `unit/*.test.mjs` | node：router 比對、`fmt` 公式、store、place（`helpers.mjs` 用 `vm` 載 app.js，`document` 為 undefined）；`views.test.mjs` 載真的 views 測各區塊匯出的純邏輯（點數、限定版、款式規則（cardRule、ruleLines）、cardStyleOf、去過的地方、recentCards、weekStats 四種日期、cityColors、`APP.state`、`cardFace`）；`trip.test.mjs` 測行程 module `APP.ride.trip`（phase 推導、start／arrive／cancel／rate／consume、距離不明的 km、壞掉的 id；來回的 waiting／back／returning、候車時收下、不搭回程、`canCollect`、`roundFare` 與回程的搭車回饋）、`collect` 怎麼判斷搭車或走路、`cardOrigin`、拉面板的 `snapTarget`；`store.test.mjs` 含 `store.clear('footprint')`；`place.test.mjs` 含 22 張明信片的 `APP.place`／`footprintPlace` 對照表 |
| `fixtures/mini-app.html`、`fixtures/selftest.html` | 驗 harness 本身 |

## 寫新 spec

1. 建 `specs/<區塊>.spec.js`（runner.html 已預留 system／ride／explore／album 四行；其他名字要自己加一行
   `<script src="specs/xxx.spec.js" onerror="T.missing(this.getAttribute('src'))"></script>`）。
2. 內容：

```js
T.spec('ride', function (t) {
  t.test('設為下車點後回叫車', async function (app) {
    await app.reset();                              // 乾淨狀態、已略過 onboarding
    await app.go('/place/neiwan');
    await app.click('[data-act="set-dropoff"]');
    await app.at('/ride');
    t.eq(app.APP.store.get('dropoff').id, 'neiwan', 'store.dropoff');
    t.eq(app.text('[data-fare]'), String(app.APP.fmt.fare(28)), '車資用公式');
    t.noDeadButtons(app);
    t.noBannedWords(app);
    t.ok(t.countTappables(app) <= 10, '可按數 ' + t.countTappables(app));
  });
});
```

注意事項：
- 斷言是**軟**的：失敗記下來、繼續跑；任何一條失敗該 test 就 FAIL。前一步拿到 null 之後的例外也會一起列出。
- 每個 test 預設 8 秒逾時；長的用 `t.test(name, fn, { timeout: 20000 })`。
- harness 在**每個 spec 開頭** reset 一次；test 之間不會自動 reset，要乾淨狀態就自己 `await app.reset()`。
- 不要 `await` 一個自己不會結束的東西；等畫面用 `app.at()`／`app.waitFor()`，不要 `tick(2000)` 硬等。
- 流程頁（`/trip`、`/unlock/:id`…）若沒有前提狀態會被導走：先用 `app.reset({ store: { trip: T.fixtures.trip({ phase: 'done' }) } })` 布置好，
  或 `app.go(path, { redirectOk: true })` 接受任何落點（回傳落地 path）。
- 行程、下車點的初值一律用 `T.fixtures.trip(overrides)`／`T.fixtures.dropoff(overrides)`，不要自己寫物件字面量（形狀只在 harness 一處）；
  要多收幾張卡就 `app.reset({ cards: [{ id, date, by, km }] })`，不要 `STATE.collect` 再手動 `emit`。
- 掃 route 用 `T.routes({ area, extra, skip, root })`（共用路由表 `T.ROUTES`，app.spec 會跟 `APP.routes()` 對帳），可按數上限用 `T.tapMax(path)`。
- 純計算（不碰 DOM 的公式、排序、款式規則）寫在 `unit/*.test.mjs`：`loadApp({ views: [...], now })` 載真的 views，時間可注入。
- 按鈕一律 `element.onclick` 綁、加 `data-act`，測試用 `[data-act="…"]` 點。返回鍵要是 `<a href="#" data-back="/x">`。
- 讀 app 內的全域用 `app.APP`／`app.STATE`／`app.MOCK`（iframe 重載後物件會換，不要存在 spec 的變數裡跨 reset 用）。

## API

### `app`（瀏覽器端，iframe 裡的 app）

| 成員 | 說明 |
|---|---|
| `win`、`doc`、`APP`、`STATE`、`MOCK` | iframe 的 window／document／全域（getter，重載後自動換新） |
| `$(sel)`、`$$(sel)` | 在 iframe 裡查（`$$` 回陣列） |
| `text(sel)` | 壓掉空白的 textContent；找不到回 `null` |
| `view()` | 目前的 `main.view[data-view]`（離場中的不算） |
| `route()` | `APP.nav.current()`：`{ path, pattern, params, query, name, tab }` |
| `go(path, opt)` | `APP.nav.go` 後等 `html[data-view-ready="1"]` 且 path 相符。`opt.expect` 預期落點（`go('/')`→`'/ride'`）、`opt.redirectOk` 任何落點都可、`opt.ms` 等多久（預設 4 s）。回傳落地 path |
| `at(path, ms)` | 等到停在某個 path 且 view-ready |
| `click(sel \| el, ms \| {ms, hit})` | 等元素出現（預設 2 s）後 `el.click()`，再等 30 ms；`hit:true` 先用 `elementFromPoint` 做命中測試，點不到（被蓋住、display:none）就丟例外 |
| `waitFor(fn, ms, label)` | 每 20 ms 輪詢到 truthy，逾時丟 `等待逾時 …：label` |
| `tick(ms)` | 等一下（預設 50 ms，virtual time） |
| `reset(opt)` | iframe 先到 about:blank → 清 `yoxi-chengshi-v1-2` 與 `yoxi-chengshi-app-v1` → 寫 `{onboarded:true, ...opt.store}` → 載 `../index.html?still=1` → 等 `data-app-ready`（6 s）。`opt.onboarded:false` 測 welcome；`opt.hash` 直接開某頁；`opt.still:false` 不帶 `?still=1`（動畫與 setTimeout 照真的跑，之後的 reload 也沿用，直到下一次 reset）；`opt.cards:[{id, date, by, note, km}]` 在 demo 的 8 張之外照順序多收幾張（`date` 預設今天、`by` 預設 walk；收不下來就丟例外），收完再重載一次 |
| `reload(hash, opt)` | 不清狀態重載（測持久化）；`opt.still` 可切換 still 模式 |
| `storage('state' \| 'store')` | 直接讀 localStorage 的 JSON |
| `errors` | iframe 的 `window.onerror`／`unhandledrejection`／資源載入失敗＋app 自己的 `#app-errors`；每次 `go`／`reset` 清空 |
| `readyMs` | 上次載入到 `data-app-ready` 花的毫秒 |

### `t`

| 成員 | 說明 |
|---|---|
| `test(name, fn(app), opt)` | 登記一條；`opt.timeout`（預設 8000） |
| `ok(cond, msg)`、`eq(a, b, msg)`、`includes(strOrArr, x, msg)`、`fail(msg)` | 軟斷言；回傳布林 |
| `noDeadButtons(app, msg)` | 掃 `main.view`、`#tabbar`、看得到的浮層（`[data-overlay]`、`.scrim`、`.sharesheet`、`.sys-share`、`.pushmock`、`.toast`）與顯示中的 `#demo-panel` 的 `a, button, [role=button]`；有行為＝`href="#/…"` 指到已註冊 view（`APP.resolve` 不是 `_404`／`_placeholder`）、`onclick`、`data-toast／switch／pills／flip／share／reset／recenter／tab／i`、`<a data-back>`、`target="_blank"` 的真連結、或祖先有 |
| `noBannedWords(app, {allow, msg})` | 任務／完成／達成／挑戰／每日；掃 `main.view`（與上面同一組浮層、demo 面板）的文字節點、`title`／`aria-label`／`placeholder`、`document.title`。白名單 `WORD_OK`：好康任務、行程完成 |
| `noHardcodedHex(cssText, name)` | 宣告值裡不准有 `#rgb…`（selector 的 `#id`、註解、`url(#…)` 不算） |
| `countTappables(app)` | `main.view` 內看得見的 `a[href], button, [role=button], .pill, .sw-toggle`；不算 `.spot`、tab bar、`[data-expand-only]`、`href="#"` 又沒行為的；`[data-gallery]` 容器整片算一個；巢狀只算外層。量法同 `prototype/tools/audit-load.html` |

### `T`

`T.spec(name, fn(t))`、`T.run({only})`、`T.missing(src)`、`T.app`、`T.t`、`T.BANNED`、`T.WORD_OK`、`T.KEYS`，以及各 spec 共用的：

| 成員 | 說明 |
|---|---|
| `T.ROUTES` | §8 每條 route 一個範例網址：`{ path, area, flow?, expect? }`（`area`＝誰做；`flow`＝沒有前提狀態會被導走）。新增 route 要在 harness.js 加一筆，app.spec 會跟 `APP.routes()` 對帳 |
| `T.routes({ area, extra, skip, root })` | 從 `T.ROUTES` 挑：`area:'album'` 或陣列、`extra` 這支 spec 另外要測的網址（接在後面）、`skip` 拿掉、`root:false` 不要 `'/'`。每次回新的物件 |
| `T.TAP_MAX`、`T.tapMax(path)` | 可按數上限：`/explore`、`/album` 12，其餘 10（query 不算） |
| `T.fixtures.trip(o)`、`T.fixtures.dropoff(o)`、`T.fixtures.T0` | store 的行程／下車點初值（預設內灣、`startedAt`／`setAt`＝`T0`），`o` 覆寫欄位；某欄位要「沒有」就給 `undefined` |
| `T.helpers.clickBack(app)` | 點目前畫面的 `a[data-back]` |
| `T.helpers.histI(app)` | router 蓋在 `history.state` 上的序號 |
| `T.helpers.drag(app, grip, dy, { id, init, hold })` | 在拉把上拖 `dy`（正＝往下）：down 在拉把、move／up 在 window；`hold` 回傳放手函式 |
| `T.helpers.revealThrough(app)` | 非 still 的 `/unlock`：點發光的地方 → 收集 → 一路點到 `data-at="3"` |
| `T.helpers.seasonDate(app, key)` | 四季畫風的 key → 那個季節中間那個月 15 號（`'YYYY-MM-DD'`）；`app.reset({ store: { demoDate } })` 用它指定 `/unlock` 的款式 |
| `T.helpers.collect(app, placeId, { by, style, note })` | 收下一張，走跟 `/unlock` 一樣的路：`by:'ride'` 先 `APP.ride.trip.arriveAt`（會取代原本的行程）；走路要指定畫風就給 `style`（四季的一款，暫時撥 `store.demoDate`，收完撥回來）。回傳是否新收。要「收過了、但不動行程」就用 `app.reset({ cards })` |

### node：`unit/helpers.mjs`

`loadApp({ storage, noStorage, realMock, realState, views, session, now })` → `{ APP, ctx, storage, STATE, MOCK }`。
`views` 給 `['ride', 'album', …]` 或 `'all'`（照 index.html 的順序載；有給就自動載真的 mock／state／hs-places／photos）；
`now`（毫秒或 ISO）固定 `new Date()`／`Date.now()`。只跑到「註冊畫面＋匯出 `APP.<區塊>`」，render／mount 不在 node 測。
`system` 的 demo 面板在 `state:change` 時會畫 DOM，會 `emit` 的測試不要載它。`memoryStorage(init, opt)`、`fixedDate(at)` 也可單獨用。
