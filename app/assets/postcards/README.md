# 明信片成品（AI 生成）

明信片各五款，對應五種畫風。目前生成了 p1–p11（55 張）；p12–p22 還沒生成，畫面上退回「實景照片＋SVG 濾鏡」的示意，補的時候跑 `app/tools/gen-postcards.py` 再更新 `explore-face.js` 的 `POSTCARD_GEN`。

哪一款不是抽的，全部照規則（2026-09-27 拿掉機率）：

| 檔名 | 款式 | 什麼時候收到 |
|---|---|---|
| `<id>-watercolor.jpg` | 水彩 | 春天（3–5 月）走路抵達 |
| `<id>-oil.jpg` | 油畫 | 夏天（6–8 月）走路抵達 |
| `<id>-woodcut.jpg` | 木刻版畫 | 秋天（9–11 月）走路抵達 |
| `<id>-ink.jpg` | 水墨 | 冬天（12–2 月）走路抵達 |
| `<id>-gold.jpg` | yoxi 金框 | 搭 yoxi 抵達（不分季節） |

規則的唯一來源是 `app/js/views/explore-cards.js` 的 `CARD_STYLES`，這張表只是對照。節日版的插畫、首訪紀念戳、里程紀念戳是程式疊在卡面上的，不另外生圖。

## 怎麼做的

- **底圖**：`prototype/assets/photos/` 的實景照片（Wikimedia Commons）。作者與授權在 `credits.js`，畫面上每張卡都會顯示。
- **模型**：`Lykon/dreamshaper-8`（Stable Diffusion 1.5 微調，CreativeML OpenRAIL-M）＋ `lllyasviel/control_v11p_sd15_canny`（ControlNet 1.1）。img2img 加上照片的 Canny 邊緣來固定構圖，所以建築會留在原來的位置，只有畫風改變。
- **產生器**：`app/tools/gen-postcards.py`。每張的底圖、提示詞、種子與參數都寫在 `index.json`，可以重現。

## 誠實標示

- 這些是 AI 依實景照片改作的示意圖，不是照片。畫面上一律標「AI 生成示意」，並附上底圖的作者、授權與出處連結。
- 三個虛構地點的底圖是同類的實景，名稱照實寫在 `credits.js`：p11 水利路老玻璃窯用新竹市玻璃工坊，p16 舊社的矽砂場用南寮海水浴場，p17 水源地的窯口用高雄唐榮磚窯。
- 如果底圖授權是 CC BY-SA，改作也以 CC BY-SA 4.0 分享。
