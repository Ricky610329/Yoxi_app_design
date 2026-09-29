# HTML 閱讀版維護

直接用瀏覽器開啟 `pitch/writing/index.html`，不需要伺服器或網路。頁面沿用 repo 的色票與五張原型截圖；搬移時須保留相對路徑，並非單檔分享包。

正文來源為十份 Markdown（含兩份附錄與一份折疊備存）。先改 Markdown，再於專案根目錄執行：

```powershell
python -m pip install -r pitch/writing/tools/requirements.txt
python pitch/writing/tools/render_diagrams.py
python pitch/writing/tools/build-reader.py
python pitch/writing/tools/check-reader.py
```

安裝套件只供建置使用，已產出的 HTML 不載入外部套件。圖表以本機 SVG 呈現，保留 Mermaid 原始碼供核對；調整圖表來源後須同步檢閱生成器中的版面與來源雜湊，再重新生成。`render_diagrams.py --check` 可驗證目前圖面仍對應來源。

`check-reader.py` 需要本機 Chrome 或 Edge；它檢查檔案／章節連結、章節與圖表順序、SVG 用語、主視覺捷徑及來源中的圖數，並實際操作桌面及手機閱讀版的導覽、字體、列印入口與產品循環圖解捷徑，將報告和截圖寫入系統暫存目錄。

圖表清單：01 章為產品價值循環、服務分層；02 章為完整旅程；03 章為 AI 內容產線。完整服務架構、Expo 技術棧、正式接入路徑、分享資料邊界與核心時序移至技術附錄；備存章保留早期卡片規則。頁首只連到四張主敘事圖，細部技術圖留在附錄。圖的原始順序與 `build-reader.py` 的 `DIAGRAMS`、生成器 `SPECS` 必須一致。

版面在 `assets/reader.css`，導覽、放大字體與列印行為在 `assets/reader.js`。圖表與原型圖片可另開檢視；HTML 內同一份文件的連結轉為章節定位，其他程式文件維持原始檔連結。

列印採 A4；一般正文、圖表與參考資料會列印，早期討論備存不列入。列印對話框可選擇另存 PDF。
