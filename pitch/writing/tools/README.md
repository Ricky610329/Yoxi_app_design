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

## 可獨立分享的 PDF

```powershell
python -m pip install PyMuPDF Pillow
python pitch/writing/tools/build-pdf.py
```

需本機 Chrome／Edge。輸出為 `output/pdf/遊喜樂_方案架構與落地評估.pdf`，包含封面、五個主要章節與兩份附錄；內部驗收與早期備存不納入。程式加入目錄頁碼、章節書籤、可跳轉的章節連結及頁尾，檢查空白頁、越界內容與本機檔案連結，並在 `tmp/pdfs/` 產生逐頁 PNG、聯絡表和報告供視覺驗收。匯出後仍須檢視圖片，不能只依自動檢查交件。

此版封面日期為 2026-09-29，程式文件連結固定到 GitHub 的 `f0151d6`，對應這次服務循環重寫。後續內容更新時須同步調整 `build-pdf.py` 中的日期、章節定位與來源版本。PDF 內嵌字型、原型畫面與向量圖，可單獨閱讀；只有開啟外部參考資料時需要網路。

## 八頁精簡版

來源為 `pitch/writing/eight-pages.md`，每個 `<!-- page: 標題 -->` 分隔一頁；依序為架構、流程、AI、工具、成本、資源、原型、參考資料。正文直接起頁，不另加封面。修改後執行：

```powershell
python pitch/writing/tools/build-eight-pages.py
```

依賴同上，另需本目錄 `requirements.txt` 的 markdown-it-py。產出 `pitch/writing/eight-pages.html` 與 `output/pdf/遊喜樂_方案精簡版_8頁.pdf`；版面在 `assets/eight-pages.css`。HTML 須保留 repo 相對路徑，PDF 可獨立分享。

工具檢查八個來源分頁、內容與頁尾間距、橫向溢出、圖片載入、PDF 恰八頁、頁碼及本機連結；並寫入八個章節書籤。`tmp/pdfs/eight-pages/` 保存逐頁 PNG、聯絡表與報告，交件前須視覺檢查。日期及 GitHub 來源版本固定於這次交付，更新內容時同步核對。

## 架構導向的八頁技術章節

使用者分工範圍的新版來源為 `technical-eight-pages.md`：架構、資料流、泳道、AI 管線、工具部署、成本資源、原型、參考來源。圖為主要閱讀線索，正文解釋分工與選擇，可獨立併入隊友提案。原有八頁敘述版保留。

```powershell
python pitch/writing/tools/render-technical-diagrams.py
python pitch/writing/tools/build-eight-pages.py --technical
```

圖的產生器只用 Python 標準庫，色票讀取 `prototype/css/tokens.css`；SVG 存於 `assets/technical/`，可獨立插入其他文件。HTML 是 `technical-eight-pages.html`，版面由 `assets/technical-eight-pages.css` 延伸既有八頁樣式；PDF 為 `output/pdf/遊喜樂_架構與技術方案_8頁.pdf`。驗收圖及報告在 `tmp/pdfs/technical-eight-pages/`，檢查同上；須特別檢視箭頭、深色節點字色及泳道分支順序。
