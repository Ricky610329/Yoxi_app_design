<!-- page: 方案架構 -->
<div class="eyebrow">遊喜樂 · 八頁方案說明 / 01 方案架構</div>

# 讓探索帶動出行，讓收藏帶回下一次使用

<p class="lead">遊喜樂把 yoxi 的服務向出發前與抵達後延伸：先幫人找到想去的地方，再把一次出門留成自己的城市經驗。</p>

現有叫車服務承接的是已經形成的移動需求。本案先從「今天可以去哪裡」切入，以地方內容降低選擇負擔；使用者依自身需求步行或搭 yoxi，抵達後收下地方明信片，逐步累積收藏、回憶卡與城市足跡。探索因此能帶來新的出行意圖，收藏則提供再次開啟 App 的理由。這是試點要檢驗的服務假設，仍需以真實到訪、回看與搭車行為確認價值。

## 三個核心服務，共用一套地方與到訪資料

<div class="architecture">
  <div class="service-row">
    <div><b>探索與推薦</b><span>地方、路線與推薦理由</span><em>接下來可以去哪？</em></div>
    <i>→</i>
    <div><b>出行與到訪</b><span>步行／yoxi、到訪核對</span><em>怎麼去、如何留下紀錄？</em></div>
    <i>→</i>
    <div><b>收藏與回憶</b><span>明信片、回憶卡與足跡</span><em>這次出門留下什麼？</em></div>
  </div>
  <div class="return-line">收藏回看與新的興趣，接回下一次探索 ↶</div>
  <div class="support"><b>共同支援</b>　已審地方內容與卡面 · 本人授權偏好 · 到訪／收藏紀錄 · 版本與觀測</div>
  <div class="support muted"><b>既有 yoxi 能力</b>　帳號、行程、支付與回饋，依企業提供的服務介面接入</div>
</div>
<p class="caption">圖 1｜服務責任與使用循環。三個服務可由同一個模組化後端承接，試點不必先拆成多套系統。</p>

地方庫保存來源、開放資訊與發布版本，供推薦和明信片共同使用；到訪紀錄連接出行與收藏，使同一次到訪在各畫面有一致結果。AI 作為共用能力，協助內容整理、理由表達與卡面製作；車資、叫車確認、收卡資格和點數由明確規則及企業服務處理。

## 以長輩情境檢查易用性，保留日常探索的完整價值

長輩是優先示範情境：畫面提供少量清楚的選擇、容易理解的前往資訊，以及可直接保存的紀念。使用者只在附近走走也能收卡與回看；有交通需求時，目的地自然帶入 yoxi。分享是收藏後的自選動作，由手機系統面板交給既有通訊工具，服務成效主要看探索、到訪與回訪。

<div class="note"><b>現階段基礎：</b>HTML／PWA 已可演示探索、模擬出行、收卡、收藏及本機回憶卡。正式派車接入、到訪驗證、個人化推薦與跨裝置同步仍需建置及驗證。程式證據見第 7–8 頁。</div>

<!-- page: 流程設計 -->
<div class="eyebrow">遊喜樂 · 八頁方案說明 / 02 流程設計</div>

# 把一次出門，接成可回看的旅程

<p class="lead">每一步都有明確的使用者目的與系統回應；步行和搭車共享抵達後的收藏體驗。</p>

<div class="journey">
  <div><b>01 探索</b><span>查看地方與理由</span></div><i>→</i>
  <div><b>02 前往</b><span>步行或 yoxi</span></div><i>→</i>
  <div><b>03 抵達</b><span>核對到訪、收卡</span></div><i>→</i>
  <div><b>04 收藏</b><span>回看與製作回憶卡</span></div>
</div>
<p class="caption">圖 2｜收藏與足跡提供下次探索的起點；需要時另選回程或分享。</p>

## 出發前：先看懂地方，再選擇交通方式

使用者從主頁探索面板或地圖看到地方，點開後了解特色、推薦理由與前往條件。初次使用可先看編輯精選，之後再依本人選定的興趣與授權互動調整建議。推薦只從已上架地方庫取材，開放狀態、距離與移動需求先以規則篩選。

選定地點後，使用者可步行前往，或將地方設為 yoxi 下車點，再確認上下車點及報價。叫車仍由本人確認；探索入口應維持既有操作清楚。原型的車資與時間是公式示意，正式資訊須由企業核可服務提供。

## 抵達時：先留下可靠紀錄，再呈現當次卡片

正式到訪核對須綜合位置精度、取樣時間、場域條件，以及可用的授權行程證據。符合條件後，系統依地方、日期、季節與交通方式選取已審卡面，再加入紀念元素。採預製素材讓收卡不必等待模型即時出圖。

同地同日的重送請求應取回同一張卡；另日再訪可保存新的日期與款式。卡片、獎章與足跡使用同一份有效紀錄，但「卡片張數」與「去過的地方數」各自定義，避免重訪造成統計混淆。

## 回到 App：從地方收藏，延伸自己的表達

收藏頁整理明信片、週里程與城市足跡，讓使用者回看去過的地方。回憶卡再加入本人選擇的照片與心情，保存成自己的版本。現有實作採本機模板；AI 短句是後續選用能力。需要分享時先預覽圖片，再開啟系統分享面板；回程及收藏各自保持可用。

<div class="note"><b>中斷也能接續：</b>AI 失敗時顯示編輯精選與固定模板；定位不足時保留瀏覽及叫車，收卡標示待核對；斷線或重送時查回原紀錄。無車時讓本人重新選擇可用方案並確認費用。</div>

<p class="bridge">這條旅程決定 AI 的位置：協助使用者理解地方、支援內容供給，同時讓核心出行與收藏有穩定規則可依循。</p>

<!-- page: AI 應用方法 -->
<div class="eyebrow">遊喜樂 · 八頁方案說明 / 03 應用的 AI 技術</div>

# AI 支援理解與內容，服務規則掌握結果

<p class="lead">先用少量、可查核的資料建立基準，再比較 AI 是否讓建議更清楚、內容製作更有效率。</p>

## 推薦：規則先選地方，模型再說明原因

試點先以距離、開放狀態、本人需求等硬條件排除不適合的地點，再用可解釋分數排序。語言模型將真實特徵改寫成短句，例如把「本人選了自然主題」與「地方具備可查核的綠地特色」連成理由。資料增加後，再比較文字嵌入等語意比對方法；模型輸出失敗時沿用固定句型。

驗證時用相同地方與條件，比較 AI 理由和模板的理解度、前往選擇率及無依據句子率，保留曝光分母。如此才能分辨改善來自理由表達、地方本身或交通條件。

## 內容：以來源約束生成，讓每項主張可追溯

採檢索增強生成（RAG）的做法：編輯先選可信資料與片段，模型依指定片段起稿，回傳短文、標籤、來源識別碼及待查句子。初期用結構化表和人工選段即可。程式檢查欄位、來源與版本，編輯再核對事實、時間、語氣及可到訪性，核准後才發布。[1]

<div class="pipeline">
  <div>可信來源<br><b>整理與選段</b></div><i>→</i>
  <div>AI 草稿<br><b>附來源識別碼</b></div><i>→</i>
  <div>程式＋編輯<br><b>查核與簽核</b></div><i>→</i>
  <div>版本化發布<br><b>供探索與卡片使用</b></div>
</div>
<p class="caption">圖 3｜格式約束有助於處理輸出，但不能保證事實正確；資料不足時退回補查。</p>

## 圖像：預生成可重用資產，讓抵達即有卡可收

以有權使用的素材、地方特徵與固定風格批次製作候選，人工確認地標、文字、風格及權利後上架。App 抵達時直接取用成品，再由程式加上日期或紀念元素。這把生成、審圖與使用時機分開，也讓每張合格卡面能被多次使用。[2]

現有圖庫使用過 DreamShaper 8 與 ControlNet Canny，參數與腳本可追溯；素材仍須在真實試辦前逐張複核。雲端 Imagen 是候選工具，須以地標可辨識度、候選可用率與核准成品總成本比較。

## 個人回憶：先保留模板，再驗證選用式生成

目前照片、心情與排版在裝置端處理，沒有線上 AI。後續可讓本人主動選用短句或構圖建議，先預覽、改寫或捨棄；日期、里程與收藏數讀取程式資料。先比較保存率、修改比例與隱私疑慮，再決定是否導入，避免讓生成成為收卡與保存的必要步驟。

<!-- page: 工具與選用原因 -->
<div class="eyebrow">遊喜樂 · 八頁方案說明 / 04 工具與選用原因</div>

# 依工作選工具，讓試點可以逐步替換

<p class="lead">工具選擇以可驗證、可回退、可維護為原則。Google Cloud 是優先評估候選，正式接法依 yoxi 技術現況決定。</p>

現有 HTML／PWA 保留作為產品流程基準。需要檢查手機定位、裝置端製圖或系統分享時，再評估 Expo／React Native／TypeScript 的獨立 demo；正式接入既有 App 時，沿用企業可接受的技術與資料契約。這樣能先驗證體驗，再處理部署差異。[3]

| 工作 | 工具或方法 | 選用原因與採用條件 |
|---|---|---|
| 推薦與短理由 | 規則排序＋Gemini Flash-Lite 類輕量模型候選 | 硬條件容易檢查，短文字可比較延遲及每次成本；理由須能指回輸入，失敗時用模板。 |
| 地方內容起稿 | Gemini Flash 類模型＋RAG＋結構化輸出 | 適合評估多段來源整理、固定欄位與來源標記；先比較改字率、無依據句子與總工時。[1] |
| 明信片卡面 | 既有離線圖庫流程；Imagen 雲端批次候選 | 現有腳本可追查製作參數；雲端候選按需評估。兩者皆須審圖、確認權利及地方辨識度。[2] |
| API 與批次工作 | Python／FastAPI；Cloud Run 部署候選 | 便於把內容、到訪、收藏及生成工作分開管理；可部署容器並依用量調整資源，也可接企業既有後端。[4] |
| 內容、資產與狀態 | 企業核可資料庫＋物件儲存；Cloud Storage 候選 | 文字留來源、狀態及版本，圖片存核准成品，個人收藏另存有效紀錄；便於更新、撤回及權限管理。 |

## 從可操作原型，接到可維護服務

試點後端可先採模組化單體：一組 API 處理內容讀取、到訪核對、收藏及事件；生成與審稿流程在背景處理。前端只取得可發布內容與核准卡面。模型名稱、提示及價格設定獨立管理，更換候選時不改叫車與收卡規則。

<div class="note"><b>選型門檻：</b>用同一批固定案例比較繁體中文品質、來源一致性、延遲、失敗率、人工修正時間及單位成本。模型、部署區域、商用條款與資料政策確認後才採購；本頁候選不代表正式服務已建置。</div>

<p class="bridge">工具成本只是投入的一部分。下一頁把人工、生成和服務用量分開，說明先控制哪些因素才有意義。</p>

<!-- page: 成本優化 -->
<div class="eyebrow">遊喜樂 · 八頁方案說明 / 05 成本優化</div>

# 先減少重做與返工，再放大使用量

<p class="lead">預算應看一篇可發布內容、一張核准卡面和一次有效服務的總成本，將人工與雲端費分開估算。</p>

一次性投入用於接起服務、資料與驗證環境；持續支出則隨地方數、更新率與實際使用量增加。內容查證和授權主要受城市與地方數影響，推薦文字受模型請求數影響，圖片傳輸受瀏覽量與快取命中率影響。

<div class="formula">
  <b>每月增量成本＝內容人工與本地支出＋模型費＋基礎服務</b>
  <span>模型費＝文字輸入／輸出用量 × 對應單價＋圖像候選張數 × 每張單價</span>
  <span>基礎服務＝API 運算、資料庫、成品儲存、圖片傳輸、日誌與監控</span>
</div>

## 把生成次數與到訪次數分開

試辦基準是複核 5 個候選地方、每地最多 5 款既有示意卡，共 25 張，未預編新圖候選。若全數需重製且每款先做 2 張，首輪為 5 × 5 × 2＝50 張候選，另計重生；這是第 6 頁基準之外的額外情境，須重估生成與審圖工時。核准卡面可反覆使用，不按抵達次數生圖。

候選數少可降低 API 與審圖量，但也可能缺乏可用成品。因此應同時記錄候選可用率、重生輪數與審圖時間，再決定每款要做多少張。圖像單價或 token 費用依採購當時的模型、區域與官方定價重算。[5]

| 優化方式 | 省下的投入 | 要接受的取捨 |
|---|---|---|
| 預生成卡面，日期與紀念元素由程式疊加 | 重複生圖、現場等待與審圖 | 需管理素材版本，特殊款式較少 |
| 批次產生常用理由，依內容／條件／版本快取 | 即時請求與延遲 | 新狀態由規則攔截，過期內容須撤回 |
| 回憶卡保留本機模板；個人生成自選 | 模型請求與個人資料處理負擔 | 表達變化較少，需先測試生成價值 |
| 小模型先評估，失敗可回模板 | 平均模型成本與服務中斷 | 若增加改字和重生，總成本可能更高 |

## 預算邊界要與投入範圍一致

月聘編輯已含的查證、改寫與審圖工時，不再逐篇重複計價；若逐篇外包，就改以每地人工計算。Points 補貼、正式地圖服務、額外攝影授權、商店帳號、稅及企業內部改造須另估。競賽額度僅抵帳單，原始成本仍需記錄。

<div class="note"><b>第一個月要帶回的資料：</b>每篇發布工時、每張核准卡面總成本、實際模型用量、圖片傳輸與快取命中率。先用這些數據換掉假設，再估算擴城所需預算。</div>

<!-- page: 資源需求與導入 -->
<div class="eyebrow">遊喜樂 · 八頁方案說明 / 06 資源需求評估</div>

# 用一個小型試點，決定下一筆投入

<p class="lead">現行試辦初估 236–384 小時，約 29.5–48 人天。這是工作量假設；須先確認企業介面，再換算排程與報價。</p>

估算以既有 App、帳號及行程服務可重用、企業 API 可介接為前提，範圍是 5 個地方的探索、到訪、收藏、本機回憶卡、AI 理由對照與觀測。不含重建原生 App、派遣後端、60 地方內容產線或正式跨城營運。每人天以 8 小時計，不能直接當作曆日工期。[G4]

| 工作包／主要負責角色 | 初估人時 | 可檢查的交付 |
|---|---:|---|
| 產品與設計 | 24–40 | 範圍、易用性、回退與驗證指標 |
| 城市編輯／來源與授權稽核 | 12–24 | 5 地方事實、素材與權利清單 |
| App 前端接入 | 48–72 | 探索、收藏、足跡與本機回憶卡 |
| 後端到訪／收藏／事件 | 56–88 | 到訪核對、去重、紀錄與觀測 |
| 企業服務介接 | 24–40 | 帳號、定位、行程或下車點介面 |
| 資料／AI 評估 | 32–56 | 固定案例、推薦理由與人工草稿對照 |
| 整合 QA／易用性／成本分析 | 40–64 | 流程回歸、操作觀察與成本報告 |
| **合計** | **236–384** | **29.5–48 人天，規劃假設** |

角色可由既有團隊兼任；城市編輯、App／後端與資料／AI 各有負責範圍，QA 與法遵／資安在整合及審查節點參與。法遵深度、企業介面落差及授權難度若超出試辦範圍，須另估，不用模型額度替代人力需求。

## 投入順序沿著證據往前走

**先驗證服務循環。** 查核 5 個真實地方與卡面，接起「探索—前往—到訪—收藏—回看」。記錄查看後的前往選擇、有效到訪、收藏回看與再次探索；每項比率保留分母、觀測窗與版本，並檢查叫車操作是否受干擾。

**再比較 AI 的增益。** 同一批來源比較模型與人工起稿，同樣地方比較 AI 理由與模板，同時量內容錯誤、使用理解度及總工時。若使用者沒有走到收藏回看，先釐清內容與流程；若 AI 增加返工，就保留既有做法。

**最後才擴內容與城市。** 基礎流程及品質指標通過預先訂定的門檻後，再評估擴至 60 個地方，補審稿台、批次產線與維運能力。以上 5／60 地方為分階段假設；擴大規模前，以試點的真實單位成本與使用行為重新估算。

<!-- page: 原型與程式證據 -->
<div class="eyebrow">遊喜樂 · 八頁方案說明 / 07 八、補充資料：原型與程式</div>

# 由可操作畫面，檢查服務是否接得起來

<p class="lead">以下引用現有 HTML／PWA 原型。畫面展示流程與介面，不代表正式派車、真實定位或線上 AI 已接入。</p>

<div class="screens">
  <figure><img src="../../app/assets/shots/ride-cards.png" alt="探索入口原型"><figcaption><b>探索與前往</b><br>先看地方，再選步行或 yoxi。</figcaption></figure>
  <figure><img src="../../app/assets/shots/album.png" alt="收藏首頁原型"><figcaption><b>到訪後的收藏</b><br>卡片、里程與足跡共同回看。</figcaption></figure>
  <figure><img src="../../app/assets/shots/lookback.png" alt="本機回憶卡原型"><figcaption><b>自己的回憶卡</b><br>用地點模板、照片與心情製卡。</figcaption></figure>
</div>
<p class="caption">圖 4｜原始截圖：ride-cards.png、album.png、lookback.png。地圖 © OpenStreetMap contributors（ODbL）。青草湖卡面為 AI 改作示意，參考照片 © lienyuan lee／Wikimedia Commons，<a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>；照片出處及其他原型素材見 [G5]。保留原畫面的狀態標示。</p>

## 一條展示路徑，對應三組程式證據

從主頁切到探索，查看地方並選擇前往；演示模擬抵達與收卡，再回到收藏製作回憶卡。評審可沿同一條路徑檢查地方、卡面與收藏狀態是否一致；操作入口及啟動方法見 App README。[G1]

**介面與狀態契約**由 App 架構文件說明，包含路由、模組 API 與數字公式。[G2] **收卡規則**由 explore-cards.js、explore-unlock.js 與 explore-face.js 對應到選款、收卡和共用卡面。**個人回憶**由 album-memory.js 處理本機模板、照片與保存，現況沒有 AI 後端請求。[G3]

<div class="note"><b>目前能證明：</b>服務流程可操作、畫面有共同規則、示意素材可追溯。<br><b>試點仍要驗證：</b>真實到訪準確率、企業介接、推薦品質、跨裝置一致性、回訪與搭車轉換。模擬數字及畫面觀感不能替代營運成效。</div>

<!-- page: 參考資料與來源 -->
<div class="eyebrow">遊喜樂 · 八頁方案說明 / 08 八、補充資料：參考來源</div>

# 讓方案主張、技術選擇與證據可追查

本頁連結可直接點選。技術文件用來確認候選能力與限制，研究用來支持設計方向；產品效果仍由本案試點驗證。外部資料查閱日為 2026-09-29。

## 官方技術文件與成本依據

<div class="refs">
<p><b>[1] Google Cloud｜結構化輸出。</b><a href="https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/control-generated-output">Structured output</a>：作為固定欄位、來源標記及輸出格式的技術依據；內容正確性另由來源核對與編輯把關。</p>
<p><b>[2] Google Cloud｜圖像生成與編輯。</b><a href="https://docs.cloud.google.com/vertex-ai/generative-ai/docs/image/overview">Generate and edit images</a>：確認 Imagen 等候選能力；特定地標、參考圖與使用權仍需實測及審查。</p>
<p><b>[3] Expo｜手機測試版本。</b><a href="https://docs.expo.dev/develop/development-builds/introduction/">Development builds</a>：評估含原生能力的獨立 demo；不等同既有 yoxi App 可直接移植。</p>
<p><b>[4] API 與部署。</b><a href="https://fastapi.tiangolo.com/">FastAPI</a>、<a href="https://docs.cloud.google.com/run/docs/overview/what-is-cloud-run">Cloud Run overview</a>、<a href="https://cloud.google.com/storage/docs/introduction">Cloud Storage overview</a>：對應 API、容器工作與成品物件儲存的候選設計。</p>
<p><b>[5] Google Cloud｜計費來源。</b><a href="https://cloud.google.com/vertex-ai/generative-ai/pricing">生成式 AI 定價</a>、<a href="https://cloud.google.com/run/pricing">Cloud Run 定價</a>、<a href="https://cloud.google.com/storage/pricing">Storage 定價</a>：依模型、區域與實際用量重算；本版沒有把 API 單價當成完整營運預算。</p>
</div>

## 設計研究：支持試驗理由，保留效果邊界

<div class="refs">
<p><b>[6] Ryan &amp; Deci（2000）。</b><a href="https://www.selfdeterminationtheory.org/SDT/documents/2000_RyanDeci_SDT.pdf">Self-Determination Theory and the Facilitation of Intrinsic Motivation, Social Development, and Well-Being</a>，<i>American Psychologist, 55</i>(1), 68–78。自主、能力感與關係連結提供設計視角；讓人自選地方並回看收藏，是本案據此提出的推論。</p>
<p><b>[7] Looyestyn et al.（2017）。</b><a href="https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0173403">Does gamification increase engagement with online programs? A systematic review</a>，<i>PLOS ONE, 12</i>(3), e0173403。研究結果因場景與方法而異；明信片、獎章及足跡的長期效果仍應實測。</p>
</div>

## GitHub 程式碼、文件與素材

<div class="refs code-refs">
<p><b>[G1] 操作入口：</b><a href="https://github.com/Ricky610329/Yoxi_app_design/blob/f0151d6/app/README.md">app/README.md</a>（啟動方式、路徑與原型限制）。</p>
<p><b>[G2] 架構契約：</b><a href="https://github.com/Ricky610329/Yoxi_app_design/blob/f0151d6/app/ARCHITECTURE.md">app/ARCHITECTURE.md</a>（路由、狀態、API 與公式）。</p>
<p><b>[G3] 實作入口：</b><a href="https://github.com/Ricky610329/Yoxi_app_design/blob/f0151d6/app/js/views/explore-cards.js">收卡規則</a>、<a href="https://github.com/Ricky610329/Yoxi_app_design/blob/f0151d6/app/js/views/explore-unlock.js">抵達流程</a>、<a href="https://github.com/Ricky610329/Yoxi_app_design/blob/f0151d6/app/js/views/explore-face.js">共用卡面</a>、<a href="https://github.com/Ricky610329/Yoxi_app_design/blob/f0151d6/app/js/views/album-memory.js">本機回憶卡</a>、<a href="https://github.com/Ricky610329/Yoxi_app_design/blob/f0151d6/app/tests/README.md">測試說明</a>。</p>
<p><b>[G4] 估算來源：</b><a href="https://github.com/Ricky610329/Yoxi_app_design/blob/f0151d6/pitch/writing/notes/cost-assumptions.md">成本假設第 9 節</a>（236–384 人時）；<a href="https://github.com/Ricky610329/Yoxi_app_design/blob/f0151d6/pitch/writing/04-cost-and-resources.md">成本與資源正文</a>（5 地方試辦及擴充邊界）。</p>
<p><b>[G5] 圖面來源：</b><a href="https://github.com/Ricky610329/Yoxi_app_design/tree/f0151d6/app/assets/shots">原型截圖</a>、<a href="https://github.com/Ricky610329/Yoxi_app_design/blob/f0151d6/app/assets/postcards/README.md">卡面素材說明</a>、<a href="https://github.com/Ricky610329/Yoxi_app_design/blob/f0151d6/app/tools/gen-postcards.py">生成腳本</a>、<a href="https://github.com/Ricky610329/Yoxi_app_design/blob/f0151d6/prototype/assets/photos/credits.js">照片作者與授權</a>。</p>
</div>

<p class="caption">GitHub 指向來源版本 f0151d6；可讀權限未經匿名驗證，對外送件前須確認收件者可存取。企業未授權公開資料不列入 repo。全稿工時、地方量及候選數均為規劃假設。</p>
