# site/ — 「yoxi 城事」介紹網站的契約（並行做的人都照這份）

一頁式、捲動式、可互動的介紹網站，`file://` 直接開 `site/index.html`。**沒有 build、沒有框架、沒有 CDN、沒有 webfont、不連網**；
只從 `../prototype`（tokens.css、icons.js、hsmap.js＋地圖資料、照片與授權）、`../app/assets/shots/`（web app 截圖）、`../pitch/video/out/draft.mp4`（影片）讀共用檔，**不改它們**。

## 檔案與歸屬

| 檔 | 誰寫 | 是什麼 |
|---|---|---|
| `index.html` | 主 agent 建骨架；**內容 agent** 填每一段的文案、步驟、卡片 | 一頁全部的 section；每個互動 widget 只留一個掛載點 `<div id="w-…">` |
| `css/site.css` | 主 agent（並行期間凍結） | 版型、字級、按鈕、卡片、手機框、scrolly 版面、reveal、導覽列 |
| `css/sections.css` | 內容 agent | 各段自己的樣式（週曆條、AI 卡、路線圖、承諾對照、影片、頁尾） |
| `css/widgets.css` | **互動 agent** | 掛載點裡的互動元件樣式（hero 霧地圖、今天的地方地圖、距離尺、圖層對照滑桿） |
| `js/data.js` | 主 agent 建；內容 agent 可**追加**區塊（roadmap、ai、promises 的文字） | `window.SITE_DATA`：公式、地點、連結、文案資料 |
| `js/scroll.js` | 主 agent（凍結） | 捲動框架：reveal、進度 `--p`、scrolly 步驟、導覽列高亮、開發參數 |
| `js/sections.js` | 內容 agent | 週曆條切換、AI 卡展開、路線圖展開、隱私兩軌切換、影片、任何純內容互動 |
| `js/postcard.js` | 互動 agent | 明信片 SVG（抄 `prototype/js/shell.js` 的 `ARTS`＋`postcardArt`，檔頭註明來源） |
| `js/widgets.js` | 互動 agent | `#hero-map`（霧隨捲動散開）、`#w-explore`（可點的真實地圖）、`#w-fare`（距離尺）、`#w-compare`（叫車首頁圖層開／關對照） |
| `tools/shoot-site.py` | 主 agent | 用 headless Chrome 對每一段截圖到 `site/tools/.shots/`（不進版控） |

載入順序（`index.html` 已寫好，不要改順序）：
`../prototype/css/tokens.css → css/site.css → css/sections.css → css/widgets.css`；
`../prototype/js/icons.js → ../prototype/assets/map/hs-places.js、hs-core.js、hs-wide.js → ../prototype/js/hsmap.js → ../prototype/assets/photos/credits.js → js/data.js → js/scroll.js → js/postcard.js → js/widgets.js → js/sections.js`。
每支 JS 自己在 `DOMContentLoaded` 初始化；找不到掛載點就靜靜略過（頁面不能因為某段沒做而炸）。

## `window.SITE`（`js/scroll.js`）

```js
SITE.clamp01(x) / SITE.lerp(a, b, k) / SITE.el(tag, attrs, parent, text)
SITE.on('progress', fn)   // fn({ el, p })：每個 [data-progress] 元素捲動時的進度 0..1（rAF 節流）
SITE.on('step', fn)       // fn({ scrolly, step, value })：[data-scrolly] 裡哪個 .step 變成目前
SITE.progressOf(el)       // 立刻算一次某元素的進度
SITE.reduced              // prefers-reduced-motion
```

HTML 的約定（`css/site.css` 有對應樣式）：

- `[data-reveal]`：進入視窗就加 `.is-in`（淡入上移）；`data-reveal-delay="120"` 毫秒；`?reveal=all` 全部立刻顯示（截圖用）。
- `[data-progress]`：捲動時被寫入 CSS 變數 `--p`（0=剛從下方進來，1=剛從上方離開）；`data-progress="pin"` 是給「外層很高、內層 sticky」的段，`--p` 是 sticky 期間的 0..1。
- `[data-scrolly]`：左邊一欄 `.steps > .step[data-step="…"]`、右邊 `.stage[data-scrolly-stage]`（sticky）。哪個 `.step` 的中線最接近視窗 45% 線就是目前：它得到 `.is-active`，stage 得到 `data-active="…"`；stage 裡 `img[data-shot="…"]` 與 `data-step` 同名的那張得到 `.is-current`（交叉淡接由 CSS 做）。
- `[data-section]` 的 section 進入視窗時，導覽列對應的 `a[data-nav="id"]` 得到 `.is-active`；頂端 `.progress-bar` 寬度＝整頁捲動比例。
- 開發參數：`?y=2400` 載入後捲到那個像素；`?reveal=all`；`?nomotion=1` 關掉平滑捲動。

## `window.SITE_DATA`（`js/data.js`）

```js
SITE_DATA.fmt          // 與 app/js/app.js APP.fmt 同一套：fare(km)、rideMin(km)、walkMin(m)、ridePts(km)、km(m)
SITE_DATA.WALK_MAX_M   // 3000：走路門檻；超過才建議叫車、才有搭車抵達的 +50 與金框
SITE_DATA.RIDE_BONUS   // 50（原型畫面固定 +50；簡報建議依距離 20／35／50）
SITE_DATA.places       // 10 個新竹地點：{ id, name, type, dist(m), hook, art, real, photo }（id 對得上 hs-places.js 與 credits.js）
SITE_DATA.far          // 內灣老街：{ id:'neiwan', name, km: 28.0, art, photo }
SITE_DATA.links        // 深連結：app 各 route、prototype 各頁、簡報 PDF、影片
```

**數字不手寫**：畫面上的車資、分鐘、點數、公里一律用 `SITE_DATA.fmt` 算；文案裡要引用「$691」「65 分」這種數字，就用 JS 填進 `<span data-fmt="fare:28">`（`scroll.js` 會在載入時把 `data-fmt="fare:28"`、`min:28`、`walk:900`、`pts:28`、`km:900` 填成算出來的值）。

## 風格與紅線

- **顏色**：只用 `tokens.css` 的變數（`var(--yoxi-…)`、`var(--gold)`）；新 CSS **不寫 hex**。紅＝品牌情緒（強調字、pin、字標、頁首）；海軍藍＝可按的東西與主文字；霧色／紙色當底；金色只給搭 yoxi 抵達版。
- **圓角**：`--r-card 8`、`--r-tile 22`、`--r-btn 4`、`--r-pill 999`、`--r-sheet 16`、`--r-img 6`。
- **字**：`Noto Sans TC`（系統有）、後援 Microsoft JhengHei／PingFang；站內字級用 `site.css` 的 `--site-*` 變數。
- **禁用詞**：任務／完成／達成／挑戰／每日；沒有連續天數、倒數、限量、排名、未讀數字；獎章寫「收集 4/8」。引用官方題目名稱是引用，可以。
- **誠實**：明信片是 AI 生成示意（有明信片的地方要標）；地圖 © OpenStreetMap 貢獻者（每個有地圖的段落要署名）；實景照片一定要顯示 `credits.js` 的作者與授權；六條防護承諾量在原型 `home.html`，合一版 app 只有「最多 4 個景點」有測試；「設為下車點」是產品設計不是 AI。
- **互動一定可鍵盤**：按鈕用 `<button>`，滑桿用 `<input type="range">`，可展開用 `aria-expanded`；焦點樣式不要拿掉。
- **不加動畫 library**：CSS transition＋`scroll.js` 的 `--p` 就夠；尊重 `prefers-reduced-motion`。
- 手機寬度（390px）要能看：scrolly 會變成上下堆疊（`site.css` 已處理），widget 自己要縮得下。

## 怎麼看自己的畫面

```
python site/tools/shoot-site.py                 # 每一段一張 1440×900（捲到該段），另一張整頁 1440×高；輸出 site/tools/.shots/
python site/tools/shoot-site.py --only explore --y 5200   # 指定段或指定像素
```
也可以直接用 Chrome 開 `site/index.html?reveal=all`。截圖後用 Read 工具看圖；每個互動元件至少截「初始」與「互動後」兩張（互動後的狀態可用 `?demo=<widget>:<state>` 之類自己在 widget 裡加開發參數）。
