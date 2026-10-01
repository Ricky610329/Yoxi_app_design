# 方案說明影片（初賽）

## 2026-10-01：早安卡開場的程式動畫腳本

先看 [三分鐘動畫腳本、分鏡敘述與畫面字詞](storyboard-demo-scenarios.html)。依投影片與使用者確認的方向，先出現「早安」，再讓現有青草湖油畫卡彈出，從長輩傳圖的日常接到產品 demo。共 14 鏡、178 秒（預留 2 秒輸出餘裕）：開場 22 秒、產品 Demo 84 秒、三個動畫情境 44 秒、AI 與價值 22 秒、結尾 6 秒。HTML 維持純文字閱讀，包含概要、時間表、畫面與動態、逐鏡節拍、旁白、片上字詞、轉場、素材及實作提醒；不提供生成畫面。

來源為 `shots-demo-scenarios.json`，版面為 `demo-scenarios.template.html`；執行 `python pitch/video/build-demo-storyboard.py` 重建 HTML，檢查總秒數、句長、字詞、場景名稱及必要欄位。影片擬沿用 SVG／JavaScript 純函數舞台，搭配真實卡面與實際 App 關鍵狀態 PNG 與 SVG 過渡；需要新增本機圖片、預載與序列層，現有 PRIM 並未具備這些能力。每鏡的 `scene_key` 是預定名稱，尚未註冊。製片時須固定 demo 地點、日期及交通方式，並依音檔調整停留，不能把配置秒數直接當成既有管線的 hold。

這份腳本獨立於以下既有向量影片管線；尚未改寫正式 `shots.json`／動畫場景或產生新 MP4，不會被 `build-video.py --docs` 覆寫。派車與到訪為模擬，回憶卡為本機私人作品，LINE 分享用到訪明信片作情境示意。

## 既有向量影片

初賽第二件交件：**3 分鐘以內**、YouTube「不公開」、標題 `yoxi_遊喜樂_2026 和泰 AI 黑客松`、連結到 11/21 都要看得到（`../docs/competition.md` §5.2）。
影片是一支**向量動畫**：`anim/index.html` 在 1920×1080 的 SVG 上把每一格畫成「時間 t 的純函數」，`build-video.py` 用 headless Chrome 逐格截圖、合上旁白，編成 MP4。
**影片畫面本身就是最終畫面**；正式版只把 Windows TTS 換成真人配音，不用另外錄螢幕或剪接。

| 檔 | 是什麼 | 誰寫 |
|---|---|---|
| `shots.json` | 鏡頭表的機器真相：每格的段落、場景名、深淺色、旁白、字幕、畫面描述、hold、算式 | 人 |
| `anim/` | 向量動畫舞台：`index.html`（舞台）、`lib.js`（共用零件、地圖層、字幕條、交叉淡接）、`scenes-a.js`／`scenes-b.js`（13 個場景）、`CONTRACT.md`（契約） | 人 |
| `anim/timeline.js` | `window.TIMELINE`：每格起訖秒數、字幕時間、公式算好的數字（車資、分鐘、點數、路線圖） | 腳本（不要手改） |
| `build-video.py` | 管線：檢查 → TTS／配音 → timeline.js → 逐格截圖 → ffmpeg；另寫分鏡表、分鏡板、字幕檔 | 人 |
| `script.md` | 旁白逐字稿＋分鏡表（人看的真相）；`BEGIN:shots`～`END:shots` 之間由腳本重寫 | 人＋腳本 |
| `storyboard.html` | 分鏡板，`file://` 直接開；縮圖是動畫在每格 55% 處的畫面 | 腳本 |
| `out/draft.mp4` | 影片 1920×1080、30 fps、H.264（CRF 18）＋AAC 160k 48 kHz 立體聲 | 腳本 |
| `out/draft.srt` | 旁白字幕（每句一條，時間＝timeline 的字幕時間） | 腳本 |
| `out/board/NN-<id>.png` | 分鏡縮圖 480×270 | 腳本 |
| `out/frames/tNNN.N.png` | `--frame` 截的單張 1920×1080 | 腳本 |
| `out/build/` | 中間檔（TTS wav 快取、音軌、ffmpeg 記錄）；可以整個刪 | 腳本 |
| `out/preview.mp4` | `--only` 的預覽（不進版控） | 腳本 |

## 怎麼重產

需要：Python 3＋Pillow（只用來查缺字、縮分鏡圖）、Chrome 或 Edge（路徑清單沿用 `app/tools/shoot-app.py`）、ffmpeg（`PATH` 上的，或 WinGet 的 Gyan.FFmpeg.Essentials）、Windows 內建的 `Microsoft Hanhan Desktop` 語音（zh-TW）、字型 `C:/Windows/Fonts/NotoSansTC-VF.ttf`。
**不需要**任何 pip 套件：跟 Chrome 講話用的是腳本裡用標準庫寫的最小 WebSocket 用戶端。

```bash
python pitch/video/build-video.py                   # 全部：TTS → timeline.js → 逐格截圖 → out/draft.mp4＋分鏡縮圖
python pitch/video/build-video.py --docs            # 只寫 timeline.js／script.md／storyboard.html／draft.srt，不開 Chrome（幾秒）
python pitch/video/build-video.py --frame 12.5,40   # 只截那幾秒 → out/frames/t012.5.png、t040.0.png
python pitch/video/build-video.py --only 5 --fps 10 # 只算第 5 格、10 fps → out/preview.mp4（draft.mp4 不動）
python pitch/video/build-video.py --board           # 只重截分鏡縮圖
python pitch/video/build-video.py --check           # 每格同一個 t 截兩次比 bytes，證明畫面是 t 的純函數
```

| 參數 | 作用 |
|---|---|
| `--no-tts` | 不跑 TTS，靜音＋依字數估秒數（4.6 字／秒）；排版迭代用。**會把 timeline.js、script.md 改成估計的秒數**，交件前要不帶它再跑一次 |
| `--rate N` | TTS 語速（-10～10，預設 2） |
| `--only 3,5-7` | 只算那些格，接成 `out/preview.mp4`；音軌也只有那些格 |
| `--fps N` | 幀率（預設 30；預覽用 5–10） |
| `--frame 12.5,40` | 只截那幾秒的 1920×1080 PNG |
| `--docs` | 只寫文件，不開 Chrome |
| `--board` | 只重截 `out/board/`（可配 `--only`） |
| `--check` | 每格中間那一秒：截一次 → 跳到別處（含倒退）→ 跳回來再截，bytes 必須相同 |
| `--audio-dir DIR` | 正式版真人配音（見下） |
| `--jpeg` | 截圖改用 JPEG q95（見「速度」） |

改稿的流程：改 `shots.json` → `build-video.py --docs` 看 `script.md` 的總長與段落小計 → `--frame`／`--only` 看畫面 → 全部重產。
開發時也可以直接用 Chrome 開 `anim/index.html?t=12.5`、`?shot=5`、`?play=1&hud=1`（見 `anim/CONTRACT.md`）。

### 腳本會檢查什麼（不過就 exit 1）

- 禁用詞（任務／完成／達成／挑戰／每日）：掃旁白、字幕（caption）、段落名，以及路線圖名稱等畫面會出現的 calc 字串。
- 每句旁白 ≤ 25 字（去標點算）。
- `calc` 的 `say_km／say_fare／say_min／say_pts／say_walk`：旁白要唸出 app 公式算出的中文數字（車資 `75 + 22 × km`、車程 `3 + 2.2 × km`、走路 `m ÷ 75`、搭車回饋 `⌊車資 ÷ 20⌋`、走不到 +50、走路門檻 3 km）。
- Noto Sans TC 缺字（會畫成方框）。
- `scene` 名稱要在 `anim/scenes-a.js`＋`scenes-b.js` 以 `ANIM.scene('名字'` 註冊（regex 掃；動態註冊的檔只確認名字字串在，會印「注意」）。
- 總長 ≤ 180 秒；Chrome 裡 `data-error` 或任何 JS 例外；成片 ffprobe 長度 ≤ 180 秒。

### 時間怎麼算

每格秒數＝0.25 秒前導＋旁白長度＋0.65 秒尾巴＋`hold`；下一格在這格結束時開始，0.5 秒交叉淡接（由 `lib.js` 做）。
旁白 wav 依「語音＋語速＋文字」雜湊快取在 `out/build/`，文字沒變不重念。字幕依字數把旁白長度分給每一句。
畫面上的數字全部在 `timeline.js` 的 `calc`：內灣 28.0 km → $691、65 分、34 點、+50；玻璃窯 900 m → 走路 12 分；路線圖五步的名稱讀 `prototype/js/catalog.js` 的 ROADMAP，季度照 `pitch/docs/roadmap.md`。

### 速度

截圖用 DevTools 協定：`ANIM.seek(t)` → `Page.captureScreenshot`（PNG、`optimizeForSpeed`）→ 直接寫進 ffmpeg 的 stdin（`image2pipe`），**不落地**。
實測（這台機器，Chrome headless，x264 同時編碼）：

- stub 場景：約 19–20 幀／秒。
- 壓力測試（真實地圖三組 set＋霧洞＋三張明信片＋大字，每格都有交叉淡接）：PNG 約 13 幀／秒、JPEG q95 約 16 幀／秒。
- **30 fps 全片（約 128 秒 ≈ 3,850 幀）估 4–5 分鐘**（PNG）；`--fps 10` 的預覽不到 1 分半。

PNG 是無損的，預設用它；JPEG 只快兩成左右，而且紅字邊緣會有極輕微的壓縮痕跡，所以只留 `--jpeg` 當選項。

## 正式版怎麼做

畫面不用重做；只把旁白換成真人配音，重編一次。

1. **錄音**：照 `script.md`「旁白全文」逐段錄，**一格一個檔**，檔名是 `NN-<id>.wav`（例如 `01-s01-quiet.wav`，清單上已經寫好檔名），也可以是 `.m4a`／`.mp3`。手機錄音 App 或 Audacity 都可以，48 kHz、單聲道即可。安靜房間、離嘴一個拳頭；檔頭檔尾留白不要超過半秒（腳本不會自動切靜音，留白會算進秒數）。
   - 數字照中文讀法：「二十八公里」「十二週」。不要唸成英文或阿拉伯數字讀法。
2. **重編**：把檔案放在同一個資料夾，跑

   ```bash
   python pitch/video/build-video.py --audio-dir D:/yoxi-voice
   ```

   腳本用 ffprobe 量每個檔的長度，重算每格秒數、字幕時間、`timeline.js`，動畫會自動跟著伸縮（場景是「長度無關」寫的）。缺的格退回 TTS 並印警告。真人通常比 TTS 快，總長會變短。
3. **檢查**：開 `out/draft.mp4` 從頭看一次；`--check` 再跑一次。

### 字幕檔

`out/draft.srt` 的時間跟著這次的旁白音檔走（用 `--audio-dir` 重跑，字幕時間就是真人配音的），YouTube Studio → 字幕 → 新增 → 「上傳檔案（含時間）」上傳 `draft.srt`，語言選「中文（台灣）」，再在編輯器裡把句子拖準。
字幕條已經燒在畫面裡（`lib.js` 畫的），SRT 是給關掉畫面字幕、或需要 CC 的人看的；兩者文字相同。

## YouTube 上傳設定

| 項目 | 設定 |
|---|---|
| 標題 | `yoxi_遊喜樂_2026 和泰 AI 黑客松`（一字不改，官方規定格式「出題企業_作品名稱_2026 和泰 AI 黑客松」） |
| 瀏覽權限 | **不公開**（Unlisted）。不要選「私人」，評審會看不到 |
| 觀眾 | 「否，這不是為兒童打造的內容」 |
| 說明欄 | 一句產品說明＋GitHub 連結＋「畫面為向量示意；明信片為 AI 生成示意；地圖資料 © OpenStreetMap 貢獻者（ODbL）」 |
| 字幕 | 上傳 SRT（見上） |
| 留言 | 可關閉 |
| 有效期 | 連結要到 **2026-11-21（決賽）** 都能看；這段期間不要刪、不要改成私人、不要重新上傳換網址 |

上傳後用**沒有登入的無痕視窗**開一次連結，確認看得到、有聲音、有字幕。

## 上傳前檢查清單

- [ ] 長度 ≤ 3:00（YouTube 顯示的長度，不是本機播放器的）
- [ ] 標題完全等於 `yoxi_遊喜樂_2026 和泰 AI 黑客松`；權限是「不公開」
- [ ] 旁白與字幕沒有禁用詞：任務／完成／達成／挑戰／每日（`build-video.py` 會掃 shots.json；字幕若在 YouTube 上改過，手動再掃一次）
- [ ] 數字與 app 一致：內灣 28.0 km → $691、65 分；搭車回饋 34 點；抵達解鎖 +50；玻璃窯 900 m → 走路 12 分鐘；獎章寫「收集 4/8」；新竹試辦 12 週
- [ ] 「設為下車點」沒有被說成 AI；沒有連續天數、倒數、限量、排名、未讀數字
- [ ] 明信片畫面看得到「AI 生成示意」
- [ ] 地圖畫面左下有「地圖 © OpenStreetMap 貢獻者」署名（`lib.js` 在字幕條左邊的署名列自動畫）
- [ ] 結尾卡有署名：「畫面為向量示意 · 明信片為 AI 生成示意 · 地圖資料 © OpenStreetMap 貢獻者（ODbL）」
- [ ] 若用了 `prototype/assets/photos/` 的實景照片，畫面或說明欄要列作者與授權（`credits.js`）；目前沒有用
- [ ] 無痕視窗開得到、有聲音、字幕對得上
- [ ] 連結貼進報名表，並記在 `pitch/README.md` 交件清單

## 已知限制

- 草稿是 Windows TTS（Hanhan），「yoxi」「AI」「Points」「app」這類英文字的念法不自然，只拿來對長度；正式版用真人配音。
- 沒有配樂。正式版可以加無版權配樂（例如 YouTube 音效庫），音量壓在旁白之下（約 -20 dB 以下），用 ffmpeg 或剪接軟體混進 `draft.mp4` 的音軌即可。
- `--no-tts` 會把 `timeline.js`／`script.md`／`storyboard.html` 改成估計秒數；交件前一定要不帶 `--no-tts` 重產。
- 成片長度以幀為單位截斷，會比 `timeline.js` 的 `total` 短不到一幀（30 fps 時 < 0.034 秒）。
