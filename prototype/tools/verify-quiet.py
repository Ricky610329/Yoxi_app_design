# -*- coding: utf-8 -*-
"""
「叫車畫面會不會變吵」—— 六條防護承諾的驗收。

    python prototype/tools/verify-quiet.py

這一份把三種驗法串成一份報告，讓每一條承諾都有數字可以貼進簡報：

  幾何（③④⑤⑥）  跑 tools/audit-quiet.html，在 iframe 裡量真實的
                  getBoundingClientRect，看景點有沒有壓到受保護的元素。
  像素（①③）     把變體的縮圖跟 home.html 的縮圖逐像素相減，
                  看差異落在哪個範圍。說「畫面沒變」要有座標。
  結構（②）       比對 sheet 裡所有可按的東西（連結與按鈕）的順序、
                  文字與目的地。一樣，叫車的 tap 數就一樣。

需要 Chrome 或 Edge、Pillow，以及先跑過 tools/shoot.py。
"""
import io
import re
import shutil
import subprocess
import sys
from html import unescape
from html.parser import HTMLParser
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ROOT = Path(__file__).resolve().parent.parent
THUMBS = ROOT / 'assets' / 'thumbs'

BROWSERS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    shutil.which('google-chrome') or '',
    shutil.which('chromium') or '',
]

VARIANTS = [
    ('變體 D', 'variant-d-home', '城事圖層預設關閉'),
    ('變體 E', 'variant-e-home', '景點常駐'),
    ('變體 F', 'variant-f-home', '叫車模式'),
]


def browser():
    for b in BROWSERS:
        if b and Path(b).exists():
            return b
    return None


# ---------------------------------------------------------------- 幾何
def geometry():
    exe = browser()
    if not exe:
        return ['（找不到 Chrome 或 Edge，幾何驗收略過）']
    out = subprocess.run(
        [exe, '--headless=new', '--disable-gpu', '--allow-file-access-from-files',
         '--virtual-time-budget=12000', '--dump-dom',
         (ROOT / 'tools' / 'audit-quiet.html').as_uri()],
        capture_output=True, text=True, encoding='utf-8', errors='replace').stdout
    m = re.search(r'<pre id="out">(.*?)</pre>', out, re.S)
    return unescape(m.group(1)).strip().splitlines() if m else ['（稽核頁沒有回傳結果）']


# ---------------------------------------------------------------- 像素
def pixels():
    try:
        from PIL import Image, ImageChops
    except ImportError:
        return ['（需要 Pillow：pip install Pillow）']

    base = THUMBS / 'home.png'
    if not base.exists():
        return ['（缺 home.png，先跑 tools/shoot.py）']

    lines = []
    ia = Image.open(base).convert('RGB')
    for name, stem, note in VARIANTS:
        f = THUMBS / (stem + '.png')
        if not f.exists():
            lines.append('%-8s 缺縮圖 %s' % (name, f.name))
            continue
        ib = Image.open(f).convert('RGB')
        if ia.size != ib.size:
            lines.append('%-8s 尺寸不同，無法比對' % name)
            continue
        d = ImageChops.difference(ia, ib).convert('L')
        # 閾值 8：避開 JPEG 式的微差與抗鋸齒，只算看得出來的差異
        mask = d.point(lambda p: 255 if p > 8 else 0)
        n = sum(mask.histogram()[255:])
        pct = 100.0 * n / (ia.size[0] * ia.size[1])
        box = mask.getbbox()
        lines.append('%-8s %s：差異 %.2f%%，範圍 %s' % (name, note, pct, box or '無'))
    return lines


# ---------------------------------------------------------------- 結構
class Sheet(HTMLParser):
    """收集 sheet 裡所有可按的東西：順序、目的地、文字。

    三種東西不算：展開態才出現的（data-expand-only）在收合態根本不存在；
    模式 pill 是變體 F 多出來的東西；一載入就 u-hidden 的區塊（變體 F 的
    今天模式面板）在叫車模式下不在畫面上。都不影響叫車的 tap 數。
    """

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0          # >0 表示正在 sheet 裡面
        self.skip = 0
        self.stack = []
        self.hits = []
        self.buf = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = a.get('class', '')
        if tag == 'div' and 'sheet' in cls.split() and self.depth == 0:
            self.depth = 1
            self.stack = [tag]
            return
        if not self.depth:
            return
        self.stack.append(tag)
        if self.skip:
            self.skip += 1
            return
        if ('data-expand-only' in a or 'pill' in cls.split()
                or 'u-hidden' in cls.split()):
            self.skip = 1
            return
        if tag in ('a', 'button'):
            self.buf = [a.get('href', '—'), '']

    def handle_data(self, data):
        if self.buf is not None:
            self.buf[1] += data

    def handle_endtag(self, tag):
        if not self.depth:
            return
        if self.skip:
            self.skip -= 1
        if self.buf is not None and tag in ('a', 'button'):
            txt = ' '.join(self.buf[1].split())[:24]
            self.hits.append('%s → %s' % (txt or '(圖示)', self.buf[0]))
            self.buf = None
        if self.stack:
            self.stack.pop()
        if not self.stack:
            self.depth = 0


def taps(path):
    p = Sheet()
    p.feed((ROOT / 'screens' / path).read_text(encoding='utf-8'))
    return p.hits


def structure():
    ref = taps('home.html')
    lines = ['基準 home.html 的 sheet 可按元素 %d 個：' % len(ref)]
    lines += ['    ' + h for h in ref]
    for name, stem, _ in VARIANTS:
        got = taps(stem + '.html')
        if got == ref:
            lines.append('  PASS  ② %s：完全相同' % name)
        else:
            lines.append('  FAIL  ② %s：' % name)
            lines += ['          少了 ' + h for h in ref if h not in got]
            lines += ['          多了 ' + h for h in got if h not in ref]
    return lines


def main():
    print('═' * 64)
    print('「叫車畫面變吵」防護驗收')
    print('═' * 64)
    print('\n── 幾何：③ 收合態外洩 ④ 景點數量 ⑤ 覆蓋 ⑥ 視覺語言 ' + '─' * 8)
    for l in geometry():
        print(l)
    print('\n── 像素：① 與現況的差異落在哪 ' + '─' * 26)
    for l in pixels():
        print(l)
    print('\n── 結構：② 叫車關鍵路徑的 tap 數 ' + '─' * 24)
    for l in structure():
        print(l)
    print()
    return 0


if __name__ == '__main__':
    sys.exit(main())
