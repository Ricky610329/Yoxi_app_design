# HTML 閱讀版維護

直接用瀏覽器開啟 `pitch/writing/index.html`，不需要伺服器或網路。頁面沿用 repo 的色票與三張原型截圖；搬移時須保留相對路徑，並非單檔分享包。

正文來源為上層八份 Markdown。先改 Markdown，再於專案根目錄執行：

```powershell
python -m pip install -r pitch/writing/tools/requirements.txt
python pitch/writing/tools/render_diagrams.py
python pitch/writing/tools/build-reader.py
python pitch/writing/tools/check-reader.py
```

安裝套件只供建置使用，已產出的 HTML 不載入外部套件。圖表以本機 SVG 呈現，保留 Mermaid 原始碼供核對；調整圖表來源後須同步檢閱生成器中的版面與來源雜湊，再重新生成。`render_diagrams.py --check` 可驗證目前圖面仍對應來源。

`check-reader.py` 需要本機 Chrome 或 Edge；它檢查檔案／章節連結，並實際操作桌面及手機閱讀版，將報告和截圖寫入系統暫存目錄。

版面在 `assets/reader.css`，導覽、放大字體與列印行為在 `assets/reader.js`。圖表與原型圖片可另開檢視；HTML 內同一份文件的連結轉為章節定位，其他程式文件維持原始檔連結。

列印採 A4；一般正文、圖表與參考資料會列印，早期討論備存不列入。列印對話框可選擇另存 PDF。
