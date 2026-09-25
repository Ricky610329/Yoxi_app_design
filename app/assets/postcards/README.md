# 明信片成品（AI 生成）

明信片各五款，對應抽卡的五種畫風。目前生成了 p1–p11（55 張）；p12–p22 還沒生成，畫面上退回「實景照片＋SVG 濾鏡」的示意，補的時候跑 `app/tools/gen-postcards.py` 再更新 `explore.js` 的 `POSTCARD_GEN`。

| 檔名 | 款式 | 走路抵達的機率 |
|---|---|---|
| `<id>-watercolor.jpg` | 水彩 | 45% |
| `<id>-oil.jpg` | 油畫 | 30% |
| `<id>-woodcut.jpg` | 木刻版畫 | 16.5% |
| `<id>-ink.jpg` | 水墨 | 8% |
| `<id>-gold.jpg` | yoxi 金框 | 0.5%（搭 yoxi 抵達 100%） |

機率的唯一來源是 `app/js/views/explore.js` 的 `DRAW_STYLES`，這張表只是對照。

## 怎麼做的

- **底圖**：`prototype/assets/photos/` 的實景照片（Wikimedia Commons）。作者與授權在 `credits.js`，畫面上每張卡都會顯示。
- **模型**：`Lykon/dreamshaper-8`（Stable Diffusion 1.5 微調，CreativeML OpenRAIL-M）＋ `lllyasviel/control_v11p_sd15_canny`（ControlNet 1.1）。img2img 加上照片的 Canny 邊緣來固定構圖，所以建築會留在原來的位置，只有畫風改變。
- **產生器**：`app/tools/gen-postcards.py`。每張的底圖、提示詞、種子與參數都寫在 `index.json`，可以重現。

## 誠實標示

- 這些是 AI 依實景照片改作的示意圖，不是照片。畫面上一律標「AI 生成示意」，並附上底圖的作者、授權與出處連結。
- 三個虛構地點的底圖是同類的實景，名稱照實寫在 `credits.js`：p11 水利路老玻璃窯用新竹市玻璃工坊，p16 舊社的矽砂場用南寮海水浴場，p17 水源地的窯口用高雄唐榮磚窯。
- 如果底圖授權是 CC BY-SA，改作也以 CC BY-SA 4.0 分享。
