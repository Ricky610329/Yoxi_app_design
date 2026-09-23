# -*- coding: utf-8 -*-
"""
把 pitch/deck/index.html 印成初賽提案 PDF，並做交件前的硬檢查。

    python pitch/deck/build-pdf.py            印 PDF＋預覽 PNG＋檢查
    python pitch/deck/build-pdf.py --no-png   不輸出預覽 PNG

輸出：
    pitch/deck/out/yoxi_城事_初賽提案.pdf
    pitch/deck/out/preview/p01.png …（每頁一張，960 寬）

硬條件（任一不過 exit 1）：
    - 正文頁（data-kind="main"）≤ 15，摘要頁剛好 1
    - PDF 總頁數 = 摘要 1 + 正文 + 附錄
    - PDF ≤ 15 MB
    - 版面溢出：deck.js 在頁面上量的 data-overflow 為空（用 --dump-dom 讀）
    - 禁用詞：HTML 文字節點不得出現 任務／完成／達成／挑戰／每日
      （排除 class 含 official 的元素：官方欄位名稱、題目原文、禁用詞清單本身）
只列不擋：剩下的 .todo 佔位（依 data-doc 分組）。

Chrome：用自己的 --user-data-dir，跑完自己刪；不碰任何其他 chrome／edge 程序。
"""
import io, re, shutil, subprocess, sys, tempfile, time
from collections import OrderedDict
from html.parser import HTMLParser
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

DECK = Path(__file__).resolve().parent
HTML = DECK / 'index.html'
OUT = DECK / 'out'
PDF = OUT / 'yoxi_城事_初賽提案.pdf'
PREVIEW = OUT / 'preview'
MAX_MAIN = 15
MAX_MB = 15
BANNED = ['任務', '完成', '達成', '挑戰', '每日']

CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    shutil.which('google-chrome') or '',
    shutil.which('chromium') or '',
    shutil.which('chrome') or '',
]


def find_browser():
    for c in CANDIDATES:
        if c and Path(c).exists():
            return c
    return None


# ---------------------------------------------------------------- HTML 掃描
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}


class Scan(HTMLParser):
    """數 section 種類、收 .todo、收禁用詞命中（跳過 script/style 與 .official 子樹）。"""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []          # [(tag, skip, todo_doc)]
        self.kinds = []
        self.todos = []          # [(doc, text)]
        self.hits = []           # [(word, text)]
        self.slide = 0
        self._todo = None        # [doc, text-buffer, depth]

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = (a.get('class') or '').split()
        if tag == 'section' and 'slide' in cls:
            self.kinds.append(a.get('data-kind'))
            self.slide = len(self.kinds)
        parent_skip = self.stack[-1][1] if self.stack else False
        skip = parent_skip or tag in ('script', 'style') or 'official' in cls
        if 'todo' in cls and self._todo is None:
            self._todo = [a.get('data-doc') or '?', '', len(self.stack), self.slide]
        if tag not in VOID:
            self.stack.append((tag, skip))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        # 容錯：往回找同名標籤
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break
        if self._todo is not None and len(self.stack) <= self._todo[2]:
            self.todos.append((self._todo[0], self._todo[1].strip(), self._todo[3]))
            self._todo = None

    def handle_data(self, data):
        if self._todo is not None:
            self._todo[1] += data
        skip = self.stack[-1][1] if self.stack else False
        if skip:
            return
        for w in BANNED:
            if w in data:
                self.hits.append((w, data.strip()[:60], self.slide))


def page_label(kinds, idx):
    """第 idx（1 起）個 section 的人看標籤。"""
    k = kinds[idx - 1] if 0 < idx <= len(kinds) else None
    if k == 'main':
        return '正文 %d' % sum(1 for x in kinds[:idx] if x == 'main')
    if k == 'appendix':
        return '附錄 A-%d' % sum(1 for x in kinds[:idx] if x == 'appendix')
    return '摘要' if k == 'summary' else '頁首'


# ---------------------------------------------------------------- Chrome
def run_chrome(chrome, args, timeout=180):
    prof = tempfile.mkdtemp(prefix='yoxi-deck-')
    try:
        base = [chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars',
                '--allow-file-access-from-files', '--force-device-scale-factor=1',
                '--no-first-run', '--no-default-browser-check',
                '--user-data-dir=' + prof]
        return subprocess.run(base + args, capture_output=True, timeout=timeout)
    finally:
        for _ in range(5):
            try:
                shutil.rmtree(prof)
                break
            except OSError:
                time.sleep(0.5)


def print_pdf(chrome):
    OUT.mkdir(parents=True, exist_ok=True)
    if PDF.exists():
        PDF.unlink()
    url = HTML.as_uri() + '?print=1'
    common = ['--virtual-time-budget=5000', '--run-all-compositor-stages-before-draw',
              '--print-to-pdf=' + str(PDF)]
    r = run_chrome(chrome, ['--no-pdf-header-footer'] + common + [url])
    if not PDF.exists() or PDF.stat().st_size == 0:
        print('  --no-pdf-header-footer 沒有產出，改用 --print-to-pdf-no-header')
        r = run_chrome(chrome, ['--print-to-pdf-no-header'] + common + [url])
    if not PDF.exists():
        print(r.stderr.decode('utf-8', 'replace')[-2000:])
        return False
    return True


def dump_overflow(chrome):
    url = HTML.as_uri() + '?print=1'
    r = run_chrome(chrome, ['--window-size=1920,1080', '--virtual-time-budget=5000', '--dump-dom', url])
    dom = r.stdout.decode('utf-8', 'replace')
    m = re.search(r'<html[^>]*>', dom)
    tag = m.group(0) if m else ''
    if 'data-checked' not in tag:
        return None
    ov = re.search(r'data-overflow="([^"]*)"', tag)
    return (ov.group(1) if ov else '').replace('&gt;', '>').replace('&amp;', '&')


# ---------------------------------------------------------------- main
def main():
    want_png = '--no-png' not in sys.argv
    ok = True

    scan = Scan()
    scan.feed(HTML.read_text(encoding='utf-8'))
    n_sum = scan.kinds.count('summary')
    n_main = scan.kinds.count('main')
    n_app = scan.kinds.count('appendix')
    expect = n_sum + n_main + n_app
    print('HTML：摘要 %d、正文 %d、附錄 %d（共 %d 頁）' % (n_sum, n_main, n_app, expect))
    if n_sum != 1:
        print('  FAIL 摘要頁應剛好 1 頁'); ok = False
    if n_main > MAX_MAIN:
        print('  FAIL 正文 %d 頁超過 %d' % (n_main, MAX_MAIN)); ok = False
    other = [k for k in scan.kinds if k not in ('summary', 'main', 'appendix')]
    if other:
        print('  FAIL 有 section 的 data-kind 不認得：%s' % other); ok = False

    if scan.hits:
        print('禁用詞：FAIL %d 處' % len(scan.hits))
        for w, t, s in scan.hits:
            print('  [%s] 「%s」 … %s' % (page_label(scan.kinds, s), w, t))
        ok = False
    else:
        print('禁用詞：PASS（排除 .official）')

    groups = OrderedDict()
    for doc, text, s in scan.todos:
        groups.setdefault(doc, []).append('%s：%s' % (page_label(scan.kinds, s), text))
    print('待補佔位 .todo：%d 個（不算失敗）' % len(scan.todos))
    for doc, items in groups.items():
        print('  data-doc="%s"（%d）' % (doc, len(items)))
        for it in items:
            print('    - ' + it)

    chrome = find_browser()
    if not chrome:
        print('FAIL 找不到 Chrome／Edge'); return 1
    print('瀏覽器：' + chrome)

    ov = dump_overflow(chrome)
    if ov is None:
        print('版面溢出：FAIL 讀不到 deck.js 的檢查結果'); ok = False
    elif ov:
        print('版面溢出：FAIL')
        for part in ov.split(' ;; '):
            print('  ' + part)
        ok = False
    else:
        print('版面溢出：PASS')

    if not print_pdf(chrome):
        print('FAIL PDF 沒有產出'); return 1

    size_mb = PDF.stat().st_size / 1024 / 1024
    try:
        from pypdf import PdfReader
        pages = len(PdfReader(str(PDF)).pages)
    except ImportError:
        print('FAIL 需要 pypdf：pip install pypdf'); return 1
    print('PDF：%s，%d 頁，%.2f MB' % (PDF.relative_to(DECK.parent.parent), pages, size_mb))
    if pages != expect:
        print('  FAIL PDF 頁數 %d ≠ HTML 的 %d（有頁面溢出成兩頁，或分頁不對）' % (pages, expect)); ok = False
    if size_mb > MAX_MB:
        print('  FAIL 檔案超過 %d MB' % MAX_MB); ok = False

    if want_png:
        try:
            import pymupdf
        except ImportError:
            print('FAIL 需要 pymupdf：pip install pymupdf'); return 1
        if PREVIEW.exists():
            shutil.rmtree(PREVIEW)
        PREVIEW.mkdir(parents=True)
        doc = pymupdf.open(str(PDF))
        for i, page in enumerate(doc):
            zoom = 960 / page.rect.width
            pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom))
            pix.save(str(PREVIEW / ('p%02d.png' % (i + 1))))
        doc.close()
        print('預覽：%s（%d 張，960 寬）' % (PREVIEW.relative_to(DECK.parent.parent), pages))

    print('結果：' + ('PASS' if ok else 'FAIL'))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
