# 技術附錄｜服務接點與實作候選

本附錄供工程評估使用。正文先交代探索、出行與收藏如何連成體驗；以下再展開候選部署、裝置接點與例外處理。所有雲端 API 與 Expo 接入均為提案，現有 HTML／PWA 是可操作的流程原型。

## 1. 新增服務與既有 yoxi 的接點

方塊代表職責，初期可由一個模組化 API 與背景工作承接。帳號、行程、支付與回饋沿用企業授權服務；地方內容、到訪與收藏由新增模組管理。圖以長輩使用情境展開裝置端，不代表服務限定長輩使用。里程碑客製樣式與 Points 介接屬延伸候選，核心試點先沿用收藏與獎章。

```mermaid
flowchart TB
  subgraph CLIENT["長輩行動端"]
    APP["yoxi App 新增體驗<br/>景點、行程、收卡、收藏"]
    DEMO["獨立手機 demo 候選<br/>Expo / React Native"]
    EXPORT["卡面輸出<br/>預覽、疊字、本機圖片"]
  end
  subgraph NEW["遊喜樂新增服務"]
    API["Cloud Run API<br/>身分、權限、限流、版本"]
    PLACE["地方與推薦<br/>已審內容、偏好、交通條件"]
    VISIT["到訪與卡片<br/>定位驗證、固定規則、去重"]
    BOOK["圖鑑與里程碑<br/>累積紀錄、樣式資格"]
    DB["Firestore 候選<br/>內容版本、收藏、必要事件"]
    STORAGE["Cloud Storage 候選<br/>已審圖庫與素材出處"]
    JOB["背景工作<br/>批次生成與重試"]
    AI["Vertex AI 候選<br/>文字與圖像模型"]
    CMS["內容管理<br/>人工核准與撤架"]
    OPS["監控與分析<br/>錯誤、成本、使用事件"]
  end
  subgraph EXIST["既有 yoxi：接法待企業確認"]
    ID["企業帳號與登入"]
    RIDE["行程、派車、車資與支付<br/>來回候車供給待核可"]
    POINTS["Points / 促銷<br/>非試點必要條件"]
  end
  subgraph OUTSIDE["App 外：由使用者自行操作"]
    OS["手機系統分享面板"]
    LINE["LINE 選對象、傳圖片"]
    FAMILY["子女看圖、家人聊天<br/>內容與身分不回傳 yoxi"]
  end
  APP --> API
  DEMO --> API
  APP --> EXPORT
  DEMO --> EXPORT
  EXPORT -.-> OS
  OS --> LINE
  LINE --> FAMILY
  API -.-> ID
  APP -.-> RIDE
  API --> PLACE
  API --> VISIT
  API --> BOOK
  RIDE -. "授權行程事件" .-> VISIT
  VISIT --> DB
  PLACE --> DB
  BOOK --> DB
  VISIT --> STORAGE
  CMS --> JOB
  JOB --> AI
  AI --> CMS
  CMS --> DB
  CMS --> STORAGE
  BOOK -.-> POINTS
  API --> OPS
  JOB --> OPS
```

## 2. 獨立手機 demo 的候選技術棧

Expo／React Native／TypeScript 用於評估手機 UI、前景定位、圖片輸出與實機操作。是否採用取決於展示需求與團隊能力；既有 PWA 可持續承擔流程測試。正式 yoxi App 的介接方式由企業技術現況決定。

```mermaid
flowchart TB
  UI["介面層<br/>React Native + TypeScript"]
  ROUTER["畫面導覽<br/>Expo Router"]
  DEVICE["裝置能力<br/>Location / FileSystem / SecureStore"]
  SHARE["圖片分享<br/>expo-sharing → 系統分享面板"]
  ADAPTER["服務介面層<br/>Ride / Places / Postcards"]
  MOCK["demo 資料來源<br/>固定景點、模擬行程與抵達"]
  API["正式候選 API<br/>Python FastAPI / HTTPS"]
  CLOUD["雲端運行<br/>Cloud Run + Firestore + Storage"]
  LINE["App 外：LINE<br/>本人傳圖、家人聊天"]
  BUILD["開發與安裝<br/>Development build / EAS 可選"]
  BUILD --> UI
  UI --> ROUTER
  UI --> DEVICE
  UI --> SHARE
  SHARE -.-> LINE
  UI --> ADAPTER
  ADAPTER --> MOCK
  ADAPTER -. "正式串接時切換" .-> API
  API --> CLOUD
```

## 3. 從原型到正式服務的交付選項

圖中的 Expo 是可選的手機驗證階段。共同資料契約可分別接模擬資料與正式 API；正式接入需重新驗證帳號權限、行程事件、資料持久化與復原流程。

```mermaid
flowchart LR
  WEB["現有：HTML / PWA<br/>畫面、規則、素材與流程證據"]
  EXPO["下一步：Expo 手機 demo<br/>移植介面、測定位與分享"]
  CONTRACT["共同契約<br/>景點、行程、到訪、卡片資料"]
  MOCK["展示接點<br/>Mock 行程、明示模擬"]
  BACKEND["待建：正式應用服務<br/>授權、驗證、持久資料"]
  YOXI["企業接入<br/>既有 App 與授權出行服務"]
  WEB -. "設計與規則移植" .-> EXPO
  EXPO --> CONTRACT
  CONTRACT --> MOCK
  CONTRACT -. "通過企業驗證後" .-> BACKEND
  YOXI -.-> BACKEND
```

## 4. 自選分享的資料邊界

使用者先預覽輸出圖文，再由系統分享面板自行選擇 LINE 等工具。私人聊天、收件人與回覆不回傳遊喜樂；收藏與回程不以分享結果為條件。可觀測的是製卡、圖片輸出與分享操作，API 返回或 App 回到前景均不能視為實際送出。

```mermaid
flowchart LR
  subgraph OWN["我們能處理與量測"]
    CARD["卡片預覽與圖片輸出"]
    TAP["使用者點擊分享"]
    EVENT["己方事件<br/>輸出、點擊、呼叫狀態"]
    CARD --> TAP
    TAP --> EVENT
  end
  TAP -. "移交圖片" .-> OS["手機系統分享面板"]
  subgraph EXTERNAL["App 外：子女資料不回傳 yoxi"]
    LINE["LINE 自選對象並傳送"]
    CHAT["家人收圖與聊天<br/>收件人、已讀、回覆不回傳"]
    LINE --> CHAT
  end
  OS --> LINE
```

## 5. 搭車收卡與自選分享的情境時序

這張時序只展開搭車收卡後選擇分享的一個情境，不代表全部使用者都需叫車或分享。回程與分享各自獨立，使用者可在需要時安排回程。

```mermaid
sequenceDiagram
  actor U as 長輩
  participant A as App
  participant Y as yoxi 行程服務
  participant V as 到訪 / 卡片服務
  participant O as 系統分享面板
  participant L as LINE（外部）
  actor C as 子女
  U->>A: 選景點並確認去回程方案
  A->>Y: 經授權介面建立行程
  Y-->>A: 接送與候車狀態
  Y-->>V: 經驗證的行程事件
  A->>V: 地方、位置精度、取樣時間
  V->>V: 驗證與去重，保存卡片及圖鑑
  V-->>A: 已審底圖、款式與紀念欄位
  A->>A: 組卡、預覽、輸出本機圖片
  U->>A: 選擇分享
  A->>O: 移交圖片並記錄呼叫狀態
  U->>O: 選擇 LINE
  O->>L: 交付圖片給外部 App
  U->>L: 選對象並確認傳送
  L-->>C: 子女在 LINE 看圖
  C->>L: 在 LINE 回話或傳貼圖
  L-->>U: 長輩在 LINE 看回應
  U->>A: 返回 App，可安排回程
  A->>Y: 依企業流程安排回程
```

## 6. 候選 API 與資料責任

正式服務需由後端保存有效到訪及收藏紀錄，手機負責互動與呈現。請求重送時應取回同一結果；卡面輸出失敗時保留收藏紀錄，再讓使用者重試。

| 候選介面 | 責任 |
|---|---|
| `GET /v1/places` | 已上架地方、內容版本、推薦依據與有效時間 |
| `POST /v1/arrival-claims` | 依位置精度、取樣時間、場域與授權行程證據核對到訪 |
| `POST /v1/postcards` | 用有效到訪及冪等鍵取得卡片，重送不重複計入 |
| `GET /v1/collection` | 本人卡片、到訪與收藏統計 |
| `POST /v1/events` | 記錄曝光、選擇、前往與收藏等白名單事件及版本 |

個人化可使用本人自選偏好及授權互動；企業彙總趨勢用於選點與內容供給，不直接當成某位使用者的生活史。位置訊號須考慮精度與時間，原型中的距離門檻不等同正式防刷方案。企業私鑰與模型金鑰留在伺服器，編輯發布權限與一般使用者分開。

## 7. 發布、復原與觀測

地方內容與卡面需保存來源、模型／提示版本及核准狀態，讓過期資訊或錯誤素材可撤架。推薦與生成失敗時，回到編輯精選與既有模板；出行與已有收藏維持可用。紀錄失敗率、資料庫用量、模型請求與圖片傳輸，才有依據調整容量。

裝置端可處理個人照片與圖片輸出；若後續需要雲端生成個人卡面，應另外定義使用者同意、上傳範圍、保存期限、刪除與單次成本。既有模板原型不能視為已具備該雲端能力。

技術來源集中於 [補充資料](../08-references-and-evidence.md)，成本拆解見 [成本假設附錄](cost-assumptions.md)。
