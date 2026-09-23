# anim/ — 向量動畫的契約（並行做場景與管線的人都照這份）

影片不再是截圖＋標題卡，而是一支**向量動畫**：`index.html` 在 1920×1080 的 `<svg>` 上，把每一格畫面畫成「時間 t 的純函數」；
`build-video.py` 用 headless Chrome 的 DevTools 協定逐格 `seek(t)` → 截圖 → 餵給 ffmpeg，再合上 TTS 旁白。
**沒有 CSS animation／transition、沒有 requestAnimationFrame、沒有 Date／Math.random**：同一個 t 永遠畫出同一張圖。

## 檔案

| 檔 | 誰寫 | 是什麼 |
|---|---|---|
| `index.html` | 主 agent | 舞台、載入順序、`window.ANIM`、開發用的 `?t=`／`?play=1`／`?shot=N`／`?hud=1` |
| `lib.js` | 主 agent（**場景 agent 不要改**） | 顏色（讀 tokens.css）、緩動、SVG 小工具、地圖層（包 HSMAP）、共用零件 PRIM、字幕條、鏡頭交叉淡接 |
| `scenes-a.js` | 場景 agent A | 註冊 `quiet、question、name、morning、walk、lightup、far`（第 1–7 格） |
| `scenes-b.js` | 場景 agent B | 註冊 `ride、gold、night、ai、roadmap、end`（第 8–13 格） |
| `timeline.js` | `build-video.py` 產生（不要手改） | `window.TIMELINE`：每格的起訖秒數、旁白、字幕時間、公式算好的數字 |
| `anim.css` | 主 agent | 只有舞台外框與開發 HUD；場景不用 CSS class 做動畫 |

載入順序（`index.html`）：`../../../prototype/css/tokens.css` → `../../../prototype/js/icons.js` → `../../../prototype/assets/map/hs-places.js`、`hs-core.js`、`hs-wide.js` → `../../../prototype/js/hsmap.js` → `timeline.js` → `lib.js` → `scenes-a.js` → `scenes-b.js`。
全部本機檔，不連網、不加 webfont；字型用系統的 **Noto Sans TC**（這台機器有 `C:/Windows/Fonts/NotoSansTC-VF.ttf`），後援 Microsoft JhengHei。

## `window.TIMELINE`（`timeline.js`）

```js
window.TIMELINE = {
  fps: 30, lead: 0.25, tail: 0.65, fade: 0.5, total: 137.4,
  calc: {                                  // 全部由 build-video.py 依 app 公式算，場景只讀不寫
    neiwan: { id: 'neiwan', label: '內灣老街', km: 28.0, fare: 691, min: 65, pts: 34, bonus: 50 },
    kiln:   { id: 'glass-kiln', label: '水利路的老玻璃窯', m: 900, walkMin: 12 },
    walkMaxKm: 3, pushPerDay: 2, pilotCity: '新竹', pilotWeeks: 12, badge: { have: 4, of: 8 },
    roadmap: [ { step: 0, name: '記錄與獎章', when: '2027 Q1 · 新竹 12 週' }, … ]   // 名稱來自 catalog.js ROADMAP
  },
  shots: [
    { i: 1, id: 's01-quiet', scene: 'quiet', section: '開場', theme: 'light',
      start: 0, dur: 9.8, end: 9.8, speech: 8.9,      // speech = 旁白 wav 長度；旁白從 start+lead 開始
      narration: ['…', '…'], caption: '…',
      subs: [ { t0: 0.25, t1: 4.6, text: '…' }, … ],   // 絕對秒數；字幕條由 lib 畫，場景不用管
      calc: { walk_m: 900 }                              // shots.json 原樣帶過來（可省）
    }, …
  ]
};
```

## `window.ANIM`（`lib.js` + `index.html`）

```js
ANIM.ready      // Promise：字型載好、地圖建好、所有場景註冊完
ANIM.duration   // = TIMELINE.total
ANIM.seek(t)    // 同步、可重入、可倒退：畫出絕對時間 t 的那一格
ANIM.shotAt(t)  // 目前這格（TIMELINE.shots 的元素）
ANIM.scene(name, { mount(g, ctx, shot), update(u, ctx, shot) })   // 場景註冊
```

- 一格 = 一個 `<g class="shot">`，在 `[start, end + fade)` 之間掛在舞台上；下一格在 `[start, start+fade)` 淡入、上一格同時淡出（交叉淡接由 lib 做，場景不用管）。地圖層只有一層、後宣告視角的格贏，所以**相鄰兩格都用地圖時，視角要接得上**（同一個 set、同一個中心與 zoom），不然淡接一開始地圖會跳。
- `mount(g, ctx, shot)`：建一次持久元素（把 handle 存在 `ctx.state`）。lib 已經先在 `g` 裡放了一張滿版底色矩形（依 `theme`：light＝`--yoxi-mist`，dark＝`--yoxi-navy`），要換底色就改 `ctx.bg.setAttribute('fill', …)`。**地圖層在所有鏡頭之下，要看到地圖的格必須把 `ctx.bg` 設成 `opacity: 0`**（不然被底色蓋住）。
- `update(u, ctx, shot)`：`u` 是這格的**局部秒數**（0 起算，可能略大於 `dur`，最多多 `fade` 秒），把所有屬性設成 u 的函數。旁白從 `u = lead`（0.25 秒）就開始，所以**第一個畫面在 0.6 秒內要成形**；`dur - tail - hold` 之後旁白已唸完，最後 `hold` 秒是給動畫收尾的。
- 動畫要「長度無關」：進場用固定秒數（例如 `seg(u, 0, .6)`），收尾用 `seg(u, shot.dur - 1.2, shot.dur - .4)`，中間的變化用 `u / shot.dur` 之類的比例，這樣 TTS 長度變了不用改場景。

## `ctx`（每格一份）

```js
ctx.g, ctx.bg, ctx.state, ctx.shot, ctx.dur       // 群組、底色矩形、自己的暫存物件、這格的 TIMELINE 資料、秒數
ctx.C            // 顏色：red, redLogo, redDark, redSoft, navy, navySoft, cream, creamDeep, mist, paper, slate, slateLite, line, white, gold, goldLite
ctx.calc         // = TIMELINE.calc
ctx.map          // 地圖層（見下）
ctx.credit(kind) // 每個 update 裡呼叫：'ai' → 左下角出現「明信片為 AI 生成示意」；地圖的「© OpenStreetMap 貢獻者」在呼叫 ctx.map.view() 那一格自動出現；沒呼叫就不顯示
ctx.rng(seed)    // 有種子的亂數（mulberry32）；不要用 Math.random
```

lib 另外掛在 `window.A` 上給所有場景用：

```js
A.el(tag, attrs, parent) / A.setA(node, attrs) / A.g(parent, attrs) / A.text(parent, x, y, str, attrs)
A.tr(x, y, s, deg)                 // transform 字串
A.icon(parent, name, x, y, size)   // 把 prototype ICONS[name]（24×24）放進來：place、postcard、badge、steps、route、elder、lock、share、bell、sun、camera、point…
A.E.linear/out/in/inOut/outBack/outExpo,  A.clamp01, A.lerp, A.mix
A.seg(u, t0, t1, ease)             // u 在 [t0,t1] 內 → 0..1（預設 ease out）
A.pulse(u, period)                 // 0→1→0 的呼吸
A.pathLen(pathEl) / A.pointAt(pathEl, k) / A.drawPath(pathEl, k)   // 沿路徑、畫到 k
A.PRIM.pin(parent, {x, y, s, state:'grey'|'red'|'gold'})           // 地點釘，錨點在針尖；回傳 g，之後用 A.PRIM.pinState(g, state, pop) 換色
A.PRIM.postcard(parent, {x, y, w, h, seed, gold, label})          // 明信片（向量風景；label=true 角落「AI 生成示意」）
A.PRIM.phone(parent, {x, y, s})    // 向量手機＋yoxi 叫車首頁；回傳 { g, setDropoff(text), screen }
A.PRIM.car(parent, {x, y, s})      // 小車（朝右）；回傳 g
A.PRIM.walker(parent, {x, y, s})   // 步行小點；回傳 g（有 .ring 可呼吸）
A.PRIM.wordmark(parent, {x, y, size, anchor})     // 「yoxi 城事」字標
A.PRIM.statement(parent, {x, y, lines, size, anchor, fill, weight, lh})  // 大字（【】包住的字用紅色強調）；回傳 g，用 opacity 淡入
A.PRIM.tag(parent, {x, y, text, fg, bg, size})    // 圓角小標籤；回傳 g
A.PRIM.coin(parent, {x, y, r})     // 點數硬幣
A.PRIM.card(parent, {x, y, w, h, r, fill, stroke})   // 圓角卡片
```

## 地圖層 `ctx.map`

真實新竹街道（OpenStreetMap，ODbL）由 `prototype/js/hsmap.js` 一次建好、放在所有鏡頭之下；場景**每個 update** 都要重新宣告視角，沒宣告那一格就看不到地圖。

```js
ctx.map.view({ set: 'core'|'wide'|'night', cx, cy, zoom, opacity })
        // set：core＝車站周邊 3 km、霧風格；wide＝11 km、霧風格；night＝車站周邊 3 km、海軍藍夜色
        // (cx, cy)＝要放在畫面正中央的「地圖座標」（地圖 svg 是 1920×1080 的像素座標）；zoom 預設 1
ctx.map.place(id)         // → { px, py }：地點在目前 set 的地圖座標（id 見 hs-places.js：station, temple, brick, market, moat, hill, lake, harbour, rail, glass-kiln；neiwan 在圖外）
ctx.map.toStage(px, py)   // 依目前 view 換成舞台座標（畫 pin、步行小點時用這個，pin 才不會跟著地圖縮放）
ctx.map.fog([{ px, py, r }], opacity)   // 霧上的洞（地圖座標、r 是地圖像素）；不呼叫＝整片霧；opacity 預設 .92；傳 [] 加 opacity 0 = 沒有霧
ctx.map.route(points)     // 給一串 {px,py}（地圖座標），回傳舞台座標的 SVG path 字串（沿目前 view）
```

## 風格（兩個場景 agent 都要守，不然接不起來）

- **扁平向量**：純色面、細描邊少用、無漸層（只有明信片內的天空可以一層）、無陰影模糊（要層次就用 `--yoxi-navy` 8% 的實色矩形）。
- **顏色**：紅只給品牌情緒（pin、強調字、字標、logo、硬幣光暈）；海軍藍給可按的東西與主文字；霧＝地圖的 fog 色；奶油色＝去過的地；金色只給搭 yoxi 抵達版的框。**不出現 tokens.css 以外的 hex**（地圖自己的 PALETTE 除外）。
- **圓角**：8（卡）、22（圖示磚）、4（按鈕）、999（膠囊）、16（拉把）、6（小圖）— 乘以你的縮放。
- **字**：`Noto Sans TC`。大字 64–96px、weight 900；說明字 28–36px、weight 400–500；小字 22–24px。**一格最多一句大字**，畫面裡的字越少越好，觀眾在聽旁白。
- **動**：進場 0.5–0.7 秒 ease-out；退場 0.3 秒 ease-in；鏡頭慢慢動（每秒不超過畫面 3%）；「上色」那種爆開用 outBack。旁白開始（u=0.25）之前畫面要成形。
- **禁用詞**：任務／完成／達成／挑戰／每日；沒有連續天數、倒數、限量、排名、未讀數字。獎章寫「收集 4/8」（讀 `calc.badge`）。
- **數字不手寫**：畫面上的公里、車資、分鐘、點數、週數、獎章數一律讀 `ctx.calc`。
- **署名**（左下角，字幕條左邊）：畫到地圖的格由 `ctx.map.view()` 自動署名，畫到明信片的格叫 `ctx.credit('ai')`。

## 開發怎麼看

```
file:///…/pitch/video/anim/index.html?t=12.5      停在第 12.5 秒
file:///…/pitch/video/anim/index.html?shot=5       停在第 5 格開頭 +0.5 秒
file:///…/pitch/video/anim/index.html?play=1       從頭播（用 rAF 推 t，只給人眼看；截圖不用這個）
file:///…/pitch/video/anim/index.html?play=1&shot=5&hud=1   從第 5 格播並顯示 t／格號
python pitch/video/build-video.py --frame 12.5     用 headless Chrome 截那一格到 out/frames/
python pitch/video/build-video.py --only 5 --fps 10   只算第 5 格、低幀率預覽 → out/preview.mp4
```
