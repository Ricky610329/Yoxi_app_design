# 工作時間線

依 commit 順序；每一筆一句話。細節看該 commit 的訊息與畫面檔頭註解。

## 2026-09-21 第一輪：從零到三條 demo 流程

| commit | 做了什麼 |
|---|---|
| `6f04a69` | 設計系統地基（tokens、base、components）與研究素材（yoxi 截圖還原） |
| `d197948`〜`368fda2` | 原型骨架、流程 A／B／C 與 P1 畫面，19 張，demo 總覽 |
| `eca268e` | 探索的地圖檢視與全景圖 |
| `610a279` | 地圖歸屬的四個變體（A–C）與並排比較頁 |
| `f072d67` | 跨頁面狀態（state.js）與手勢（sheet 拖曳、平移、翻面） |
| `0805d8c`〜`3d30839` | 補齊沿用畫面與詳情頁，抽屜不再有死連結 |
| `872b3e4`〜`4101cb2` | 依稽核修正：渲染、整塊失效、資料矛盾、跑版 |
| `51198fe` | 重構：四份重複的地圖程式碼抽成共用函式 |
| `5bbcc2d` | 把探索地圖併進叫車地圖：變體 D／E／F |

## 2026-09-22 驗收體系與第一輪收尾

| commit | 做了什麼 |
|---|---|
| `be4c939` | 變體比較頁補問題二；六條防護承諾改成可重跑的數字 |
| `2b8372b`〜`9760c8a` | 互動煙霧測試、一鍵驗收 `verify-quiet.py`、縮圖流程、承諾①改 DOM 比對 |
| `9f8eb59`〜`5be7a28` | 稽核抓到的資料層錯誤、假綠燈、文案紀律、時序 |
| `671a3be` | 尺寸收回元件，縮圖可重現 |
| `987ec3f` | 全站稽核：死按鈕與數字矛盾 |
| `e4738af` | 罐頭文案換成真的內容；抵達驗證的說明 |
| `e5341d7` | Demo 首頁重整：畫面目錄單一來源、三條流程附講稿、導覽列 |
| `5343c4a`、`9d168d1` | 三份設計審查的修正；重拍縮圖 |

## 2026-09-22 第二輪：層級樹、變體大量化、願景稿

| commit | 做了什麼 |
|---|---|
| `f9445e4` | 層級樹＋評語、變體註冊表、共用明信片牆、功能數與圍牆稽核 |
| `8c69204` | 收藏 S1–S5、探索 X1–X5、T1 |
| `6194bf6` | 低認知負擔 L1–L6，以可按數／到達步數自動量測 |
| `65e5826` | 願景探索稿 12 張（家人、活動、行程、健康） |
| `f8cd8d0` | 重拍 92 張縮圖與 mini |

## 2026-09-22 第三輪：真實質感、好友系統、轉換點

| commit | 做了什麼 |
|---|---|
| `5f46c07` | OSM 地圖引擎 hsmap、概念稿區、好友六頁＋板、照片管線、明信片翻面 bug 修正 |
| `105326f` | 地圖概念稿七頁、五張概念板、全部縮圖 |
| `f2b4eea` | 概念稿與探索稿在樹上改為已建檔 |
| `9e99c5d` | 轉換點 K1–K7＋共用落點頁；84 張驗收全綠 |
| `f3e2e6d` | README |
| `424a079` | 提案總覽 proposal.html（roadmap＋決策矩陣） |

## 2026-09-23 web app：合一版做成真的能用的 app（`app/`）

| commit | 做了什麼 |
|---|---|
| `d193bce` | 第一波：核心殼（hash router、view registry、store、`APP.fmt` 公式、地圖包裝、tab bar、桌機外框）、測試框架（node 單元＋headless Chrome）、PWA（manifest、sw.js、圖示、serve.py）；契約 `app/ARCHITECTURE.md` |
| `26c8e4d` | 第二波：叫車／探索／收藏／系統四個區塊並行建置，25 條 route；測試 140/140 |
| `eefd15b` | 第三波：三條流程端到端測試 `flows.spec.js`（19 條，含限定版沒收就回首頁／再叫車的兩條路）、QA 縫合（router 自動移除 mount 期間的 window listener、`nav.replaceQuery`、收卡與設下車點防連點、足跡覆蓋率改固定範圍、探索地圖景點推開）、視覺 QA（42 張手機寬度截圖工具 `shoot-app.py`、六處 CSS 修正）；文件（`app/README.md`、根 README、HANDOFF §10、AGENTS、本檔）。瀏覽器測試 159/159 |
| `d65a42a` | 第四波：來回檢查。乾淨 clone 重跑抓到順序相依的 flaky（/trip 配對中改由 startedAt 推導）；逐行審查修 8 個 bug（手打 `?ride=1` 就能拿金框＋50 點、返回鍵連按退出 app、確認框疊開、原型鏈 id、壞 store 值、harness 逾時污染）；亂按 QA 17 項（內灣頁兩個分鐘數、清除足跡真的清空、1280×720 縮放、行程中不能改下車點、週回顧數字不倒退…）；五個視角評估 `docs/webapp-review/` 引出 5 項（+50 只給走不到的地方、trip 帶 via 歸因、叫車地圖景點開關、VERSION 單一來源、週標題終點）；無障礙 6 項（對比 ≥ 4.5、對話框焦點與 Esc、toast aria-live、44×44 命中區）；五種敘述方向 `docs/narratives/`。瀏覽器測試 187/187、單元 34/34、sw v4 |

## 2026-09-23 初賽交件：`pitch/`（2026 和泰 AI 黑客松 · yoxi 題）

六個 Opus agent 並行：資料規劃、AI 架構與成本、商業與 KPI、roadmap 與差異化、影片、簡報；主 agent 寫共用簡報與交件清單。敘述立場改為「站在 yoxi 的角度、給經營層的路線圖備忘錄」。

| commit | 做了什麼 |
|---|---|
| `5273fc4` | `pitch/BRIEF.md` 共用工作簡報、`pitch/docs/competition.md` 官方事實 |
| `638aeea` | `roadmap.md`（五階段時間軸、19 條風險）、`competitive.md`、交件清單 `pitch/README.md`、摘要頁 `summary.md` |
| `172d28c` | `data-plan.md`：現況與痛點（400 則評論分佈）、三種人物、資料盤點、推薦怎麼算、隱私治理、拿到真資料後兩週 |
| `0a6faa0` | `ai-architecture.md`：AI 四角色、架構圖、模型選用（只用有智財賠償的 GA 模型）、三情境成本、決賽前接真 AI 的最短路徑 |
| `f164a30` | `business.md`（發現 yoxi 收入是每趟派遣費 10 元 → 點數改三級＋上限）、`kpi.md`（北極星非叫車開啟週活躍率、K1 對 K7） |
| `eaba103` | 影片：`script.md`／`shots.json`／`storyboard.html`／`build-video.py`（TTS＋ffmpeg，2:45.5，23 鏡頭）／`README.md` |
| `aa95b8e` | 簡報 HTML 框架＋初稿（摘要 1＋正文 15＋附錄 5）、`build-pdf.py` 六項硬檢查 |
| `3ec8ad9` | 對齊內容量假設（每城 60 個地方、每月 34 篇草稿、1 位編輯）；README／AGENTS／HANDOFF §11／WORKLOG 指向 pitch/ |
| `85e1b73` | 摘要頁補目標值與成本；影片腳本註明點數級距 |
| `8cb1ee2` | 簡報第二波：用六份佐證文件補齊全部數字佔位；附錄 A-2 外部數字出處 15 列 |
| `ec3a212` | 跨文件一致性稽核：人力約 7 FTE／每月 NT$81.9 萬、推播停損 15%、第 1 步前提改北極星、K1 提前到第 0 步，另 15 處小不一致 |
| `1048465` | 簡報第三波：評審 12 點修正（代號換白話、第 8 頁攤開派遣費 vs 點數的帳、第 11 頁改人看得懂的三張卡…）；試辦範圍拍板為第 0 步＋K1＋今天的地方最小版 |

評審視角試打分：73.5／100（主題 8、創意 7、可行性 8、AI 整合 6），預估入圍 15 隊；第三波已針對其 12 點修正。交件前仍要人做的：隊名與成員、GitHub 公開與否、影片要不要換真人配音、拿到 yoxi 真資料後是否換第 4 頁（見 `pitch/README.md`）。

## 2026-09-23 初賽影片重做：向量動畫＋願景版

使用者要求：影片用向量動畫風格重做、少自我解釋、講願景；子 agent 一律開 Opus 5.5。主 agent 寫願景版腳本（13 格、旁白約 430 字）、動畫契約 `pitch/video/anim/CONTRACT.md` 與共用程式庫 `lib.js`，三個 Opus agent 並行：管線（`build-video.py` 重寫）、第 1–7 格場景、第 8–13 格場景。

| commit | 做了什麼 |
|---|---|
| `6aa1e31` | 四張 web app 截圖搬到 `pitch/deck/assets/`（只剩簡報第 6 頁在用）；刪影片舊管線的 `shoot-extra.py` 與舊畫格，舊鏡頭表改名 `shots-draft-v1.json` |
| `8777ec5` | 影片：`shots.json` 願景版 13 格；`anim/`（SVG 舞台、每格畫面是 t 的純函數、真實新竹街道三組地圖、共用零件、字幕條、交叉淡接、兩支場景檔）；`build-video.py`（檢查 → TTS → timeline.js → 標準庫 WebSocket 走 DevTools 逐格截圖餵 ffmpeg → 音軌對齊；`--frame／--only／--fps／--check／--audio-dir`）；README／script.md／storyboard 改版。成片 2:08.2、30 fps、13.4 MB；`--check` 13/13 格純函數；verify-quiet 八段 PASS 且六條承諾與基準相同；build-pdf PASS |

畫面規矩：顏色只讀 `tokens.css`、數字只讀 `timeline.js` 的 `calc`（公式算）、地圖格自動署名 OpenStreetMap、明信片格標「AI 生成示意」。全片 30 fps 約 4 分鐘可重產；正式版只換真人配音（每格一個音檔 → `--audio-dir`）。

## 2026-09-23 介紹網站：`site/`

使用者要「專門介紹這個 app 的本機網站，捲動式、可互動」。主 agent 寫骨架（section 與掛載點、`scroll.js` 捲動框架、`data.js` 公式與地點、`site.css` 基底、`tools/shoot-site.py` 截圖驗收、`CONTRACT.md`），兩個 Opus agent 並行：內容 agent（各段文案、週曆條、三條線卡、19 個 scrolly 步驟、AI 卡、承諾清單、路線圖、影片、入口與頁尾）、互動 agent（hero 霧地圖、可點的真實地圖＋明信片、3 公里距離尺、叫車首頁圖層開／關對照）。

| commit | 做了什麼 |
|---|---|
| `6a7070b` | `site/`：十三段一頁式介紹站，`file://` 直接開，沒有 build／框架／CDN／webfont；只讀 prototype、app 截圖、pitch 影片。CSS 不寫 hex、數字走 `data-fmt`／`SITE_DATA.fmt`、禁用詞掃過；手機寬度可看。README／AGENTS／HANDOFF §12 指向。shoot-site 十三段＋整頁＋互動後截圖無 JS 例外；verify-quiet 八段 PASS 且六條承諾與基準相同 |

已知不夠好的：六條承諾的量測值是寫在 HTML 的字面值（它們是 verify-quiet 的量測結果，不是公式）；路線圖第 0 步守門指標「叫車完成率」為避禁用詞改寫成「叫車成功率」；hero 霧散開的效果偏含蓄；探索地圖把 2.5 km 外的地點夾到邊緣標「圖外」。

## 2026-09-24 web app：雙主頁與探索面板

使用者把範圍收斂為「叫車／收藏」兩個底欄入口；預設叫車頁的搭車模式，面板頂端切「搭車／探索」。探索可上下拉，搭車只處理向下收合。收藏維持原本的主頁用途。這輪討論用的 Apple 健身截圖、腦力激盪圖與四張逐輪回饋截圖已收進 `docs/references/`，索引在該目錄的 `README.md`；目前的成品截圖在 `app/assets/shots/`。

| commit | 做了什麼／為什麼 |
|---|---|
| `b6aeb95` | 第一版把叫車與收藏收斂成雙主頁，探索卡片放在可上拉的叫車面板裡，更新收藏摘要與自動截圖。 |
| `46ecf74` → `1b861fb` | 曾把搭車與探索拆成獨立底欄頁，隨後依使用者指正回滾；這兩筆只保留在歷史，**目前不是獨立探索底欄**。 |
| `4ae48bb` | 依變體 F 的版型，在叫車面板頂端放「搭車／探索」，底欄回到「叫車／收藏」。 |
| `c0a496a` | 讓搭車面板的下拉收合及恢復跟手順暢；探索預選最近地區、縮短資訊、改用「用 yoxi／收集」，卡片改為疊放並可開啟翻面的懸浮小卡。 |
| `a7fdc03` | 移除使用者指出的「附近的地方」清單及返回入口；地區由地圖圖釘選，展開面板直接看卡片。 |
| `5d96b07` | 上拉探索時保留整塊地點資訊與兩個動作，卡片堆接在下方；更新截圖為最近地區的展開狀態。 |

互動與資料契約在 `app/ARCHITECTURE.md`，接手摘要在 `docs/HANDOFF.md` §13。最後 UI 驗收：`python app/tests/run.py` 的 node 34/34、瀏覽器 189/189；`python app/tools/check-sw.py` 45 筆 PASS（PWA v9）；`python prototype/tools/verify-quiet.py` 八段全 PASS，六條承諾數字維持基準。原型、簡報與介紹網站沒有跟著改版；舊探索路由仍能以深連結供對照。

## 2026-09-25 web app 全面 review 與修正（分支 `fix/app-review`）

使用者要求「掃一下這個 APP」→「全修」。四個唯讀 agent 分區審查（約 60 條，都用 Playwright 重現過）；五個 agent 各在自己的 worktree 修，主 agent 先定跨區塊約定（`data-overlay`／`dismissOverlays`、`confirm` 的 `danger`、`remember:false`、`APP.ride.RIDE_BONUS`、`share` 的 `card`、景點推開歸 core、`APP.place` 正規化），再合併、縫合、寫文件。細節見 `docs/HANDOFF.md` §14 與 `app/ARCHITECTURE.md`。

| commit | 做了什麼／為什麼 |
|---|---|
| `94bb5e2`、`4b2e918`、`a670c99` | PWA：導覽 network-first、靜態檔 SWR、明信片與照片執行期快取、check-sw 缺檔即失敗、`start_url` 會先看 onboarding；測試跑者：缺 spec 算 FAIL、掃浮層與 demo 面板、`click({hit})`；system：分享與推播換頁就收、複製連結用打開時的網址、長輩圖帶明信片、清除足跡清乾淨、demo 面板認得路線站 |
| `281d3cc` | core：導覽收浮層、對話框焦點圈與 inert、同網址 replace、換頁焦點、底欄只建一次、live region、桌機判斷、景點推開、`APP.place` 正規化、store 版本與型別檢查、`fmt.dist` 先四捨五入 |
| `ff3542d`〜`6359e3b` | ride：明信片 id、壞行程、過期確認框、返回紀錄、拉把手勢／跟手／鍵盤、視窗改大小重畫、懸浮小卡改掛 `.device`、距離待確認、`RIDE_BONUS`、tokens 與死碼 |
| `45f9c01`〜`b1d00a3` | explore：搭車抵達不被走路收掉、機率框換頁就收、抽卡鍵盤與報讀、計時器與音效收乾淨、金框結果頁會停、render 不寫 store、拆成 explore-cards／explore／explore-unlock |
| `359ac5d`、`d63c115` | album：子頁返回鍵、「回顧」一列、`/postcards` 可點、金框看得到、限定版與金框分開、「今天多了一張」看日期、長輩圖用分享的那張、去過的地方去重、週回顧範圍、文案誠實與空狀態、刪舊書架 |
| `9fe6c53` | 縫合：`confirm` 三態（沒回答＝null）、刪掉 explore 重複的推開景點、生成腳本指向新檔名 |
| `3ba1a5c`、`fbd5948` | 使用者追加：抽卡結果與收集面板不寫機率、不寫「必得金框」，機率只在「?」 |
| `0d2adc0` | VERSION v16；app.css 拿掉已刪的選擇器 |

驗收：`python app/tests/run.py` node 47/47、瀏覽器 272/272（改前 34／201）；check-sw 60 筆 PASS。截圖沒有重拍（shoot-app 在 Mac 會卡住）。

## 2026-09-26 收藏疊卡順序、金框卡的金粉（分支 `feat/gold-card-aura`）

使用者要收藏首頁的三張是最新收下的、金卡在哪裡都有金粒子特效（隨畫面移動有物理性質）。細節見 `docs/HANDOFF.md` §15 與 `app/ARCHITECTURE.md` §7。

| commit | 做了什麼／為什麼 |
|---|---|
| `f3d7f0b` | `recentCards` 照收下的先後（`STATE.all.cards` 鍵順序），同一天連收、跨年都對；新增 `explore-gold.js`：`data-gold-aura` 的元素邊緣散金粉，被跟著卡片走的空氣帶著、有慣性；收藏、叫車面板、浮起來的小卡、`/unlock` 翻開後都標；VERSION v17 |
| `a1924ec` | 使用者：「物理不錯、質感差」。只改畫法：細金粉／會翻的金箔／細長閃光／暗底散景、遠近分層、相對空氣才拉變淡的尾巴、沿圓角冒、每 4.8 秒斜光掃過框；三頁穩定 60 fps |
| `0779b58` | 使用者：「防空洞有實體圖片，總覽還是示意圖」。p12–p22 沒有生成成品，paintCardArt 沒有退回照片那一步；改成跟 /unlock 一樣：成品 → 照片＋畫風濾鏡 → 插圖；週回顧補 data-card-art；詳情寫照片出處；叫車面板角標拉長的 bug |

驗收：`python app/tests/run.py` node 47/47、瀏覽器 277/277；Playwright 看過捲動、換頁、翻面、蓋住、still。

## 2026-09-26 架構整理：散掉的概念收成 deep module（分支 `refactor/app-deepening`）

使用者要「看看這個網站有沒有可以改進的」→ 架構審查（8 個候選）→「全修，不動到任何功能」。每一步都要 app 測試全綠、golden master（496 個畫面與流程）0 差異才 commit。細節見 `docs/HANDOFF.md` §16 與 `app/ARCHITECTURE.md`。

| commit | 做了什麼／為什麼 |
|---|---|
| `bc68b87` | 測試接縫：node 的 `loadApp` 載得動 views、specs 共用路由表／fixtures／小工具 |
| `ebae4ca` | 明信片 → 地點只剩 `APP.place` 與 `APP.footprintPlace`（兩種答案保留，產品待決） |
| `c7eaeb1` | `APP.ride.trip`：`store.trip` 只有它讀寫；demo 搭車抵達距離不明不再算成 0（使用者核可） |
| `5668d34` | `collect(placeId, { note })` 自己判斷搭車或走路、款式、公里；`cardOrigin` 當唯一的讀法 |
| `2001136` | store 的 `KEYS` 表（型別＋類別）、`APP.store.clear('footprint')`、`APP.state`（寫 STATE 一定發 state:change） |
| `bb53366` | 返回規則收回 router：`history.state` 記來歷、`APP.nav.prev／up`；刪掉 ride 與 album 各自的歷史簿記 |
| `e3f5e78` | 拆出 `explore-face.js`：`cardFace` 唯一的卡面疊法、監看整台 `.device`；VERSION v18 |
| `f5b0c65` | 地圖 destroy 自己拆拖曳 listener；拉面板換段抽成純函式 `snapTarget` |
| `fc0cafc` | 版本只在 `js/version.js`、`APP.ui.overlay`、拿掉 `arrivedDemo` 與舊 core 的相容死碼 |
| `495c4a0` | 只牽涉一個區塊的回歸測試從 flows.spec 搬回各區塊 |

驗收：`python app/tests/run.py` node 77/77、瀏覽器 280/280；check-sw 63 筆 PASS。

## 2026-09-27 明信片款式改成透明規則（分支 `feat/transparent-card-rules`）

使用者貼來長輩視角的回饋：抽卡的機率像賭博。四點裡選了「做 1＋4，2、3 只記錄」。細節見 `docs/HANDOFF.md` §17。

| commit | 做了什麼／為什麼 |
|---|---|
| `abdf3d7` | 拿掉 `DRAW_STYLES` 的機率：走路看季節定畫風、搭 yoxi 是金框、三節多蓋節慶郵戳、搭 yoxi 20 km 以上多蓋遠行紀念戳；面板先寫會收到哪一款與為什麼，「?」換成規則說明；郵戳記在 `store.cardMarks`；demo 面板「模擬日期」；VERSION v19 |

沒做的：圖鑑進度條換獎勵（=刻意拿掉的集點卡）、每週目標（會有「沒達到」）——週回顧維持只寫「這一週你去了 N 個地方」。

驗收：`python app/tests/run.py` node 80/80、瀏覽器 282/282；check-sw PASS；`verify-quiet.py` 在這台 Mac 只跑得了 ②（PASS、與基準相同）。

## 2026-09-27 節日版：那一週都拿得到、會動的節日插畫（同分支）

使用者：節日版要整個放假的那一週都拿得到；郵戳太陽春，要龍舟、月亮和玉兔、櫻花樹、鞭炮的動畫，但不能擋掉景色、也不能小到看不出來。細節見 `docs/HANDOFF.md` §18。

| commit | 做了什麼／為什麼 |
|---|---|
| `2655314` | `FESTIVALS` 改成當天＋官方連假、`festSpan` 算那一週；加賞櫻；新增 `explore-fest.js`／`explore-fest.css`：四種會動的 SVG 插畫，只放在卡片四周、5 秒停；比例測試；VERSION v20 |

驗收：`python app/tests/run.py` node 80/80、瀏覽器 283/283；check-sw PASS。

## 2026-09-27 龍舟、櫻花、長輩圖＝那張明信片（同分支，worktree）

使用者：龍舟醜、櫻花少；分享的早安圖要有卡片、圖片、特效。細節見 `docs/HANDOFF.md` §19。

| commit | 做了什麼／為什麼 |
|---|---|
| `65d2546` | 龍舟重畫（龍頭、龍鱗、划手、海水紋）、櫻花樹冠加密；`/elder` 整張換成收下的那張明信片（成品、金框、節日插畫、署名）＋大字祝福 |

驗收：`python app/tests/run.py` node 80/80、瀏覽器 284/284。

## 2026-09-27 照使用者的流程補齊（分支 `feat/flow-progress-rewards`）

使用者貼來一條流程（來回接送、100 m、每一次都拿得到的明信片、款式規則、一鍵 LINE、子女回應、進度換相框與稱號），要專案照它走、抽獎改成固定規則的進度累積。細節與前後對照見 `docs/HANDOFF.md` §20。ride 與 family 兩段交給兩個 worktree agent 並行，explore／album 自己做。

| commit | 做了什麼／為什麼 |
|---|---|
| `7423519` | 先定 store 的鍵（visits、look、shares、replies），並行的兩個 agent 從這一版開工 |
| `8afe694` | 每一次來都收一張（一天一張）；首訪紀念、里程紀念（累積 km，取代單趟遠行戳）；抵達 100 m；/rewards 相框與稱號；收藏首頁與明信片頁跟著改 |
| `a512058`、`658cfea` | 一鍵傳到 LINE（示意）、/line、/family/:id 子女喜歡與留言、APP.family |
| `dccbe8a`、`53faf46`、`2a0e683` | 叫車的來回：去程 → 司機候車 → 回程 → 到家結算；候車時收下這一次的明信片 |
| `4e43007`、`a33c7f0` | 相框牆的文字與櫻花框；ARCHITECTURE 契約、pitch/docs 的 80 m → 100 m、明信片 README 的機率表換成規則表 |
| （本段最後一筆） | 合併後的縫合：回訪也算進行程紀錄與點數、回訪的歸因不蓋掉第一次、`rideRound` 取代 `rideVia._round`、候車頁的 100 m 讀同一個常數、/going 候車中的說法、demo 走路抵達候車中的地方；VERSION v21 |

驗收：`python app/tests/run.py` node 106/106、瀏覽器 313/313；check-sw PASS；`verify-quiet.py` 在這台 Mac 只跑得了 ②（PASS）。

## 2026-09-27 翻卡特效：木刻版畫套印、水彩暈成白紙、油畫厚塗筆觸（分支 `feat/reveal-fx`，已合併）

使用者：抽完卡的「?」底下兩段小字刪掉；木刻版畫沒有特效、油畫與水彩要更明顯，水墨保持。照水墨好看的地方重做另外三款：換掉整個場景、做這個媒材才有的動作、留一樣東西在結果頁。

| commit | 做了什麼／為什麼 |
|---|---|
| `f8f9422` | 規則說明（「?」）拿掉開頭「沒有抽籤…」與底下三節／收一張／AI 生成的註記；卡面本身仍標「AI 生成示意」 |
| `31daad3` | 木刻版畫＝套印（白紙 → 紅版 → 最後一版，停格、震、木屑、放射刻線、木紋，`.is-print`）；水彩＝濕紙暈成白紙、五團顏料化開（`.is-wash`）；油畫＝五道厚塗筆觸一筆一筆刷上去（`.is-paint`）。新濾鏡 `exf-print／gouge／grain／bloom／impasto`、新音效 `drip／brush／press`；蓄力拍數不變（四季一樣重）；跳過、`?still=1`、減少動態效果都停在同一個結果 |
| （合併到 main 時） | `explore-fx.js` 檔頭拿掉舊的「常見的款式輕、稀有的重」 |

驗收：`python app/tests/run.py` 全綠（合併後的 main：瀏覽器 314/314，check-sw PASS）；Playwright 逐格看過四款翻卡與 still／減少動態效果的結果頁。`verify-quiet.py` 在這台 Mac 找不到 Chrome，沒跑；沒動 `prototype/`。

## 2026-09-27 收藏首頁一屏：相框與稱號併進獎章卡（分支 `feat/album-rewards-into-medals`）

使用者：收藏頁只有一個「相框與稱號」一列很怪，而且要往下捲；要收藏頁不捲，傾向把它併進其中一個選項。

| commit | 做了什麼／為什麼 |
|---|---|
| `116882c` | 「相框與稱號」從獨立一張卡改成獎章卡最底下一列（細線隔開；稱號多半是湊齊一組獎章換來的，同一類東西）；放大那一枚章上下各少 4px、入口的小樣縮小、那一行字不折行。390×844 的內容從 792 降到約 760（可視 784），預設／回訪＋換相框／0 張都不用捲；album.spec 加一條「一屏不用捲」 |

驗收：`python app/tests/run.py` 全綠；Playwright 看過三種狀態的 /album。沒動 `prototype/`。

## 2026-09-27 拿掉相框與稱號（分支 `feat/remove-rewards`）

使用者：還是要捲；已經有獎章了，把相框跟稱號的功能整個刪掉。上一段量的是手機版（狀態列 12px），桌機外框的狀態列 54px，其實還差 33px。細節見 `docs/HANDOFF.md` §21。

| commit | 做了什麼／為什麼 |
|---|---|
| （本段這一筆） | 刪 `album-rewards.js`／`.css`、`/rewards`、store 的 `look`、首頁的稱號與入口、家人頁的稱號；家人頁的明信片改成自己問 `cardOrigin`；「每一次來」的樣式搬到 album.css；VERSION v22。「一屏不用捲」的測試改在桌機外框量 |

驗收：`python app/tests/run.py` node 103/103、瀏覽器 308/308；check-sw PASS；Playwright 看過桌機外框的 /album、/family、/line。沒動 `prototype/`。

## 2026-09-27 翻開之後的那一句（分支 `feat/card-verse`）

使用者：抽到之後的小字（「冬天的畫風是水墨／春節那一週去的，卡面有鞭炮」）不要了，改成跟這個景點或主題有關的一句話，詩情畫意或文學的都可以；不同地點、不同組合要有不同的句子。

| commit | 做了什麼／為什麼 |
|---|---|
| （本段這一筆） | 新增 `explore-verse.js`：22 張明信片 × 九種組合（四季、金框、春節、端午、中秋、賞櫻）＋一組通用句，共 207 句、全表不重複；大多是依 `mock.js` 的地方故事寫的（鐘塔、窯口、油桐、河津櫻…），十幾句是剛好合適的古典詩詞（寫作者與篇名，例：南寮漁港的中秋是張九齡〈望月懷遠〉）。/unlock 結果頁的 `[data-why]` 換成 `[data-verse]`；「為什麼是這一款」留在收集面板與「?」，按下去之前還是看得到。節日碰上搭 yoxi 用節日那一句。新單元測試 `verse.test.mjs`（每張每種組合都有、不重複、≤ 26 字、無禁用詞與阿拉伯數字、引用有出處）。VERSION v22 |

| （本段第二筆） | 收藏的明信片頁也一樣：「為什麼是這一款」那一列拿掉，標題底下改接同一句（`[data-verse]`，照收下那一次的款式與節日；畫風、金框、節日插畫、郵戳卡面上本來就看得到） |

| （本段第三筆） | 節日那一週搭 yoxi 也有自己的一句（`'gold+spring'`、`'gold+duanwu'`、`'gold+moon'`、`'gold+sakura'`）：22 張 × 4＋通用 4，全表 299 句、不重複；原本節日碰上搭車跟走路是同一句，使用者要分開 |

驗收：`python app/tests/run.py` 全綠；Playwright 看過四種組合的 /unlock 結果頁與兩張明信片頁。沒動 `prototype/`。

## 2026-09-27 金卡的翻卡特效改成全部裡面最精緻的一款（分支 `feat/gold-reveal`）

使用者：其他款的特效太精緻了，拿到金卡的特效反而很平凡，要改成全部裡面最精緻的。
之前四季的畫風各自把整個場景變成那個媒材（宣紙、白紙、筆觸、套印），金框只有閃光、光芒、粒子，什麼也沒留下。

| commit | 做了什麼／為什麼 |
|---|---|
| （本段這一筆） | 金框＝燙金：蓄力時金色光軌像陀螺儀繞著卡片轉、一拍比一拍多，昇格時收進卡片再閃光；翻開時轉一圈半、兩側甩出光絲 → 停格、重震 → 夜色鍍成金（`.ex-gilt`）、背後一圈一圈描出紋章（`.ex-seal`）、金箔翻著閃著飄下來 → 兩道金線沿卡片的邊描下去（`.ex-foil`），在底部合起來再爆一次金光、蓋上限定版緞帶、一個大和弦；卡名掃兩次光，結果頁的金粉裡混著金箔。停在 `.is-gilt`（跳過、still、減少動態效果同一個樣子）。`APP.fx` 多了 `orbit()`、`leaf` 金箔、`sfx.foil／crown`；explore.spec 加一條 |

驗收：`python app/tests/run.py` 全綠；Playwright 逐格看過蓄力、昇格、翻開、燙金、結果頁，還有 still 與減少動態效果的結果頁。沒動 `prototype/`。

## 2026-09-29 一般瀏覽器恢復完整動畫（分支 `fix/browser-browsing`）

使用者：只調整可操作的 app，不新增內容、按鈕或功能；一般瀏覽器也要完整播放動畫，不改電腦設定。

原因：這台 Chrome 的 `prefers-reduced-motion` 回報 reduce，app 原本直接略過抵達與翻卡，共用 base CSS 也把動畫與轉場縮成近乎零。VS Code 預覽與原本測試的 no-preference 環境沒有重現這個問題。

入口標記 `data-motion="full"`，JS、翻卡、金粉、節日及收藏 CSS 採同一個展示設定；still 仍優先、跳過與離頁清理照舊。`motion.css` 只恢復原 CSS 的 duration（依 `index.html` 順序由 `tools/sync-motion.py` 產生），不覆寫拖曳時的 `transition: none`、不讀 file:// 下可能被拒絕的 CSSOM。測試入口檢查產物同步，新增 `--system-motion` 驗一般瀏覽器設定；VERSION v24，快取清單同步。

驗收：node 106/106、瀏覽器一般與系統偏好兩組皆 309/309；check-sw 與 motion 同步 PASS。實際 Chrome 保持 reduce，抵達 pin 為原本 0.576 秒、收卡依序走到結果，無 console 例外。原型八段驗收通過，六條承諾與基準一致（464 節點、4 個叫車入口、4 個景點、6 個受保護元素、0 外洩／覆蓋、標記 class 無交集；E／F 原有 DOM 差異 3／39 處未變）。沒有修改原型，驗收產生的時間戳不納入提交。

## 2026-09-29 遊喜樂命名與收藏精簡（分支 `refactor/youxile-album`）

使用者正式定名「遊喜樂」，授權整理整個收藏頁；今天與週回顧只看里程、移除步數焦點，足跡配色加深。

- 命名先提交 `c47892f`：App、網站、pitch 真相文件、HTML 簡報與影片原始稿統一遊喜樂；yoxi 仍是叫車服務名稱，internal 儲存鍵與路徑保留。新 PDF 名稱 `yoxi_遊喜樂_初賽提案.pdf`，22 頁／8.12 MB，摘要 1、正文 15、附錄 6，無溢出。
- 收藏首頁刪去重複累積統計，明信片主卡與獎章維持原有功能；三入口固定用鎖（私人今天）、分享（週摘要）、地圖（城市足跡）。
- 今天的回顧從四幕改單頁，當日里程、照片與有文字標籤的心情同頁可看；再按一次可取消選擇，儲存才寫入，直接返回不更動；同日回填，跨日不沿用。刪除步數跳號、折線與重複卡片／月里程。
- 週摘要只有一組七日里程圖、期間收卡與既有分享。示意資料仍只讀共用 MOCK；每日公里先取一位小數，週總再由每日相加，畫面可直接核對（目前示意 25.3 公里）。不顯示或另存步數。
- 足跡改墨藍灰霧、暖沙色去過區域與清楚的地圖字，強化城市色帶；範圍與覆蓋公式不變。明信片詳情的距離也統一公里。
- VERSION v25、motion CSS 同步、重拍 App 截圖與總覽；更新架構與操作說明。桌機截圖改用既有 fixture 初始化 onboarded，修正原本直開根路由被導去歡迎頁而拍錯畫面的問題。

驗收：Node 106/106、完整 browser 309/309（含系統 reduced-motion 偏好），check-sw 與 motion PASS。Chrome 桌機及 360×640 實測選取、儲存、返回、翻卡；原型八段 PASS，整份報告只差輸出順序，所有數值與基準相同。既有 `pitch/writing/` 與原型 load 產物未納入提交。

影片也重建為遊喜樂：沿用 Microsoft Hanhan Desktop 聲線，127.53 秒、1080p／30fps、13.4 MB；網站引用的 MP4、字幕、分鏡與影片文件同步。Windows System.Speech 在 sandbox 內 SelectVoice 會拋空參考例外，以受審查的 sandbox 外執行同一腳本後成功；未新增套件、聲線或外部 TTS。網站 13 段＋整頁截圖檢查 PASS。

## 2026-09-29 回憶卡製作與收藏視覺調整（分支 `refactor/youxile-album`）

使用者：今天的回顧改為去過地點的製卡入口，流程單純、沿用原本明信片風格；可以加自己的照片與心情，不要下拉選單或生圖工具式面板。這次只做可操作流程與構圖示意。三格以數據為主且字級一致，獎章保留原設計放大；城市足跡最終改成非道路區域上色、道路留白。

- 新增 `album-memory.js/css`，沿用 `/lookback` 網址。今天到訪的地點優先做模板，無當日記錄時明示使用最近去過的地方；深藍底、完整卡面左右滑動，照片／心情在卡下調整，只有「做成我的卡」一個主要動作。空收藏導回探索。
- 照片只在本機縮圖與 JPEG 壓縮；製作後保存到 `today.memoryCards`，重開保留照片、心情與原日期。核對 localStorage 真正寫入，容量不足則回復，不顯示假的成功。內部 prompt 由地點與心情產生，畫面明示是模板構圖，未接 AI 生圖。
- 首頁三格顯示回憶卡張數、週里程、足跡比例。依最窄格和最長數值計算共同字級，ResizeObserver 隨框調整。獎章恢復原版主章＋小章並放大。週頁保留七日里程、期間明信片與分享。
- 足跡使用真實 paper 地圖資料，灰色未訪、yoxi 紅已訪；色層放在建物上方與水系／道路／鐵路下方，因此整個已訪非道路範圍上色而保留路網。移除城市色帶，覆蓋公式與範圍不變。
- 晚間推播與設定同步為回憶卡入口；VERSION v27、PRECACHE 與 motion 同步，更新操作文件、9 張相關截圖與總覽。

驗收：Node 108/108、完整 browser 310/310（系統 reduced-motion 偏好）PASS；照片格式／上傳／移除／保存／重載、容量失敗回復、空狀態、原收藏及點數不變均有測試。Chrome 實看製卡与道路留白效果，首頁数字無溢出；原型八段 PASS，整份基準與結束報告忽略行序後完全一致。沒有改 prototype 來源，既有 load 產物與 `pitch/writing/` 不提交。

## 2026-09-29 全部改動整合到 main

使用者要求將全部改動整理到 main。整合 `refactor/youxile-album`（瀏覽器動畫、遊喜樂命名、收藏與回憶卡、足跡、簡報／影片）與 `docs/competition-writing-scope`（競賽技術文件及離線 HTML 閱讀版），以合併提交 `ea58bb2` 保留兩邊歷史，無衝突。工作區原有的 21 份未追蹤文件與文件分支完全相同（只有換行差異），合併後逐檔核對一致。

整合驗收：Node 108/108、完整 browser 310/310（系統動態偏好）、PWA 清單與 motion 同步皆 PASS。文件五張 SVG 與來源一致；125 個本機連結、桌機及手機的 8 章／31 表格、字體放大、導覽、列印與圖片載入皆通過，無水平溢出或外部資源。原型八段 PASS，與上一輪完整報告忽略行序後完全一致，六條承諾數值不變。

本次將驗收產生的兩份 load 檔時間戳一併提交，數據內容無變動；main 在驗收後快轉到整合版本。只整理本機 main，不推送遠端，保留既有分支與獨立工作樹。

## 2026-09-29 分享邊界與 Expo 技術提案（分支 `docs/share-boundary-expo-stack`）

從整合後的 `f22318c` 開文件分支。依使用者修正，明信片留在 App 製作與收藏，圖片由系統分享面板交給 LINE；家人看圖、回話與貼圖留在外部，不回傳子女資料。同步 `pitch/BRIEF.md` 與 `pitch/writing/` 正文、API、資料需求、成本和來源，移除主方案中的自有家庭回應頁。圖鑑及回程不依分享結果判定。

補四張抽象圖：服務分層、分享資料邊界、Expo 技術棧、原型至正式接入；原有架構、流程及時序同步更新，HTML 封面加入圖解捷徑。技術提案區分現有 HTML／PWA、Expo／React Native／TypeScript 手機 demo、裝置 SDK、Mock 服務介面及 Python／FastAPI 雲端候選，不改 App 程式。

成本刪去回應頁與聊天資料服務，試點工程重新加總為 176–280 人時（假設）；首款里程碑樣式已含於表內，避免重複相加，整套 Expo UI 移植另需盤點。模型單價未改。

驗收：九張 SVG 與 Markdown 來源一致，147 個檔案／章節連結有效；桌面／手機八章與 33 表格，導覽、Expo 圖解捷徑、字體放大、列印入口及圖片載入通過，無正文水平溢出或外部資源請求。整合後原型前後八段 PASS，完整報告忽略行序後相同、六條承諾不變；驗收時間戳還原。未建 Expo App、未實際發送 LINE 訊息、未推送。

## 2026-09-29 以服務循環重寫方案文件（分支 `docs/service-centered-proposal`）

使用者認為既有技術文件與圖解過度聚焦外部分享，要求從較高視角說明方案架構、流程、AI 技術與工具選用、成本資源及補充資料，增加完整敘述。先提出重寫方向，取得 go 後執行。

主要提交：`4ee2a35`。閱讀入口為 `pitch/writing/index.html`，Markdown 原稿仍是編輯來源。

- 五個章節改沿「探索 → 步行或 yoxi → 到訪收卡 → 收藏與回憶 → 再次探索」，以探索與推薦、出行與到訪、收藏與回憶三個服務解釋架構。長輩為優先示範情境，分享與來回接送依需求選用。
- 新增產品循環圖，重畫服務分層與完整旅程；原部署、Expo、分享邊界與時序移到 `notes/technical-appendix.md`。閱讀版頁首改為四個產品與 AI 圖解捷徑。
- AI 章說明推薦理由、來源約束文案、預生成圖像與選用式回憶表達，補工具候選、選用理由與驗證。既有回憶卡仍明示為本機模板；小型試點比較 AI 推薦理由與模板，硬篩選與備援由規則處理。
- 成本正文先寫交付、角色、階段與優化取捨。現行試點新假設為 236–384 小時（29.5–48 人天），前提是既有 App 與企業 API 可重用；歷史 176–280／284–456 區間及模型單價算式移到 `notes/cost-assumptions.md`，不可直接相加。人工與模型費分開，避免重複計算。
- 補充資料以探索、步行、抵達、收藏、回憶卡五張現有截圖，連回程式、來源與尚待驗證的範圍。素材稱為示意成品，試點前仍查核地點與授權。同步 BRIEF 的主線、AI 角色及敘述優先原則。

驗收：十張 SVG 與來源相符；十份文件、29 個表格、146 個本機連結通過。Chrome 桌面與手機的導覽、字體、圖解捷徑、備存與列印入口正常，圖片全載入，無正文水平溢出或外部請求。查看封面、桌面／手機及三張主圖，修正支援箭頭重疊。新工時與模型算式重算、禁用詞、相對連結、Markdown 區塊及 diff 檢查皆通過。

原型前後驗收八段 PASS，兩份完整報告忽略行序後一致，六條承諾數值不變；E／F 原有 3／39 處 DOM 差異保留。sandbox 內空回傳的報告不作證據，有效報告由獲准的 sandbox 外 Chrome 取得。驗收產生的兩份 load 時間戳已還原。未修改 App／原型／簡報／影片，未部署或推送；閱讀版列印入口可用，本次未另產製 PDF。

## 2026-09-29 匯出方案 PDF（分支 `docs/proposal-pdf`）

依使用者要求，從重寫版本 `f0151d6` 的閱讀版產製獨立 PDF。因使用者工作區同時切回 `main`，改在隔離 worktree 製作，不切換其分支。新增 `pitch/writing/tools/build-pdf.py` 及操作說明；產出 `output/pdf/遊喜樂_方案架構與落地評估.pdf`，A4 共 39 頁、約 3.36 MiB，包含五個主要章節、五張原型畫面及技術／成本附錄。

封面附可點選目錄與頁碼，七個章節有書籤；程式文件連到固定的 GitHub 來源版本，移除依賴本機路徑的連結。PDF 自動檢查無空白頁、越界內容或本機檔案連結，19 個章節跳轉有效。逐頁渲染檢視，調整表格跨頁、技術圖大小與補充資料尾段，避免孤立殘頁。原型前後八段驗收通過，完整報告忽略行序後一致，六條承諾未變；驗收時間戳還原。未改產品程式、未推送。
