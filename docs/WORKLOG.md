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

驗收：`python app/tests/run.py` node 47/47、瀏覽器 277/277；Playwright 看過捲動、換頁、翻面、蓋住、still。
