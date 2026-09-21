# -*- coding: utf-8 -*-
"""
「叫車畫面會不會變吵」—— 六條防護承諾的驗收。

    python prototype/tools/verify-quiet.py

這一份把三種驗法串成一份報告，讓每一條承諾都有數字可以貼進簡報：

  幾何（③④⑤⑥）  跑 tools/audit-quiet.html，在 iframe 裡量真實的
                  getBoundingClientRect，看景點有沒有壓到受保護的元素。
  DOM（①）        把變體跑完 JS 的 DOM 跟 home.html 的逐行比對，
                  看多了什麼、少了什麼。不用像素相減 —— 這台機器的顯示縮放
                  會讓同一份指令有時 1 倍有時 1.25 倍出圖，數字不可重現。
  結構（②）       比對 sheet 裡所有可按的東西（連結與按鈕）的順序、
                  文字與目的地。一樣，叫車的 tap 數就一樣。
  互動            跑 tools/smoke-variants.html，真的去 click 每個變體最關鍵的
                  那一段，看狀態有沒有跟著變 —— 點了沒反應是不會報錯的。

需要 Chrome 或 Edge。不依賴 tools/shoot.py 的成品。
"""
import io
import re
import shutil
import subprocess
import tempfile
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


# ------------------------------------------------- 在 headless 裡跑一張稽核頁
def run_page(name, budget=12000):
    exe = browser()
    if not exe:
        return ['（找不到 Chrome 或 Edge，略過）']
    out = subprocess.run(
        [exe, '--headless=new', '--disable-gpu', '--allow-file-access-from-files',
         '--virtual-time-budget=%d' % budget, '--dump-dom',
         (ROOT / 'tools' / name).as_uri()],
        capture_output=True, text=True, encoding='utf-8', errors='replace').stdout
    m = re.search(r'<pre id="out">(.*?)</pre>', out, re.S)
    return unescape(m.group(1)).strip().splitlines() if m else ['（%s 沒有回傳結果）' % name]


# ---------------------------------------------------------------- DOM
def dump(url):
    """把瀏覽器跑完 JS 之後的 DOM 拿出來。"""
    exe = browser()
    if not exe:
        return None
    fname, _, query = url.partition('?')
    uri = (ROOT / 'screens' / fname).as_uri() + '?still=1' + (('&' + query) if query else '')
    return subprocess.run(
        [exe, '--headless=new', '--disable-gpu', '--allow-file-access-from-files',
         '--virtual-time-budget=6000', '--dump-dom', uri],
        capture_output=True, text=True, encoding='utf-8', errors='replace').stdout


# 城事圖層自己的元素。比對之前先把這些整棵子樹從兩邊拿掉 ——
# 剩下的如果一模一樣，就等於「圖層以外的東西一個都沒動」。
LAYER_IDS = {'spots', 'fogLayer', 'peek', 'mode', 'layerBtn'}
LAYER_CLASSES = {'citylayer', 'peek'}


VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'source', 'track', 'wbr'}


class StripLayer(HTMLParser):
    """把城事圖層的子樹整棵拿掉，其餘原樣輸出。

    用 whitelist 逐行放行也可以，但那只是把差異藏起來 ——
    「圖層元素以外完全沒動」這句話要成立，就該真的把圖層拿掉再比。

    三種處理：
      丟掉整棵   圖層自己的元素、非預設的模式面板、<script> 與 <style>
      當作透明   變體 F 把叫車內容包進 <div data-panel="ride">，
                 那層包裝不是畫面，但裡面的內容要留著比
      原樣輸出   其餘
    """

    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.out = []
        self.skip = 0
        self.stack = []          # True = 這個開始標籤有輸出，結束標籤才要輸出

    def _drop(self, tag, a):
        if tag in ('script', 'style'):
            return True          # 不畫在螢幕上
        if a.get('id') in LAYER_IDS:
            return True
        if LAYER_CLASSES & set((a.get('class') or '').split()):
            return True
        # 模式面板：只有預設的那個算畫面，其餘一載入就是隱藏的
        if 'data-panel' in a and a['data-panel'] != 'ride':
            return True
        return False

    def handle_starttag(self, tag, attrs):
        if self.skip:
            self.skip += 1
            return
        a = dict(attrs)
        if self._drop(tag, a):
            self.skip = 1
            return
        transparent = a.get('data-panel') == 'ride'
        if tag not in VOID:
            self.stack.append(not transparent)
        if transparent:
            return
        if tag == 'body':
            a.pop('data-tabs', None)       # 分頁列指向哪一組不是畫面差異
        if tag == 'a' and 'tabbar__item' in (a.get('class') or ''):
            a.pop('href', None)            # 分頁列連到自己那一組，是接線不是畫面
        if tag == 'div' and 'map' in (a.get('class') or '').split():
            # map--layered 只是「這張地圖歸城事圖層管」的 CSS 掛勾，
            # layer-on 是圖層開著。兩個都不會自己畫出任何東西。
            a['class'] = ' '.join(c for c in a['class'].split()
                                  if c not in ('map--layered', 'layer-on'))
        self.out.append('<%s %s>' % (tag, ' '.join(
            '%s="%s"' % (k, v) for k, v in sorted(a.items()) if v is not None)))

    def handle_startendtag(self, tag, attrs):
        if self.skip:
            return
        a = dict(attrs)
        if not self._drop(tag, a):
            self.out.append('<%s/>' % tag)

    def handle_endtag(self, tag):
        if self.skip:
            self.skip -= 1
            return
        if tag in VOID:
            return
        if self.stack and self.stack.pop():
            self.out.append('</%s>' % tag)

    def handle_data(self, data):
        if not self.skip and data.strip():
            self.out.append(' '.join(data.split()))


def strip_layer(html):
    html = re.sub(r'<!--.*?-->', '', html, flags=re.S)
    html = re.sub(r'<title>.*?</title>', '', html, flags=re.S)
    p = StripLayer()
    p.feed(html)
    return p.out


def domdiff():
    """承諾①：圖層關閉時，畫面與現況完全相同。

    為什麼不用像素相減：這台機器的顯示縮放會讓 headless Chrome 有時候用
    1 倍、有時候用 1.25 倍出圖，兩張倍率不同就整張都在差，同一份程式碼
    連跑兩次會得到 0.3% 與 16% 兩種答案 —— 那種數字不能拿出去講。
    DOM 比對沒有這個問題，而且問的是更準確的問題：**除了圖層自己，還動了什麼。**

    註解與 <title> 不算：每一份變體都在開頭寫自己是什麼、為什麼這樣改，
    那是給人看的，不是畫面。
    """
    import difflib
    base = dump('home.html')
    if base is None:
        return ['（找不到 Chrome 或 Edge，略過）']
    a = strip_layer(base)
    lines = ['基準：home.html 去掉城事圖層後有 %d 個節點' % len(a)]
    for name, stem, note in VARIANTS:
        b = strip_layer(dump(stem + '.html'))
        delta = [l for l in difflib.unified_diff(a, b, n=0)
                 if l[:1] in '+-' and not l.startswith(('---', '+++'))]
        if not delta:
            lines.append('  PASS  ① %s（%s）：拿掉圖層之後與現況逐節點相同'
                         % (name, note))
        elif stem == 'variant-d-home':
            # ①只對變體 D 成立，因為只有它承諾「關掉就是原本的 yoxi」。
            lines.append('  FAIL  ① %s：圖層以外還有 %d 處差異' % (name, len(delta)))
            lines += ['          ' + l[:110] for l in delta]
        else:
            # E 與 F 本來就會動到叫車畫面，那是它們寫明的代價。
            # 這裡不是判 PASS／FAIL，是把「到底動了什麼」攤開來。
            lines.append('  —     %s（%s）：叫車畫面多了 %d 處，明細如下'
                         % (name, note, len(delta)))
            lines += ['          ' + l[:110] for l in delta]
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
    for l in run_page('audit-quiet.html'):
        print(l)
    print('\n── DOM：① 圖層關掉之後，跟現況差在哪 ' + '─' * 20)
    for l in domdiff():
        print(l)
    print('\n── 結構：② 叫車關鍵路徑的 tap 數 ' + '─' * 24)
    for l in structure():
        print(l)
    print('\n── 互動：點下去真的有反應嗎 ' + '─' * 28)
    for l in run_page('smoke-variants.html', 15000):
        print(l)
    print()
    return 0


if __name__ == '__main__':
    sys.exit(main())
